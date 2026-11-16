// Dia e noite (decisão do dono, 14/11): 30 minutos de dia e 10 de noite, o mesmo relógio em todos os mapas. À noite
// os bichos ficam 25% mais fortes (vida e dano) e dão 50% a mais de XP e ouro; o navegador recebe em que ponto do
// ciclo estamos (welcome.time e a mensagem `time`) e anda sozinho daí. O administrador vira o relógio no menu ADM.

import { describe, expect, it } from 'vitest';
import { DayNightClock } from '../src/server/dayNight';
import { parseMonsterDefs } from '../src/server/monsters';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { DAY_MS, NIGHT_MS, TICK_MS, TWILIGHT_MS } from '../src/shared/constants';
import { DEFAULT_COMBAT_RULES } from '../src/shared/combatRules';
import { cyclePosition, daylightAt, isNightAt, msToNextTurn } from '../src/shared/dayNight';
import { GameMap } from '../src/shared/map';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

const R = DEFAULT_COMBAT_RULES;

describe('as contas do dia e noite', () => {
  it('o padrão: 30 min de dia e 10 de noite', () => {
    expect(R.dayMs).toBe(DAY_MS);
    expect(R.nightMs).toBe(NIGHT_MS);
    expect(DAY_MS).toBe(30 * 60_000);
    expect(NIGHT_MS).toBe(10 * 60_000);
  });

  it('o ciclo dá a volta; noite é a parte depois do dia', () => {
    expect(cyclePosition(DAY_MS + NIGHT_MS + 5, R)).toBe(5);
    expect(cyclePosition(-5, R)).toBe(DAY_MS + NIGHT_MS - 5);
    expect(isNightAt(0, R)).toBe(false);
    expect(isNightAt(DAY_MS - 1, R)).toBe(false);
    expect(isNightAt(DAY_MS, R)).toBe(true);
    expect(msToNextTurn(DAY_MS - 1000, R)).toBe(1000);
    expect(msToNextTurn(DAY_MS + 1000, R)).toBe(NIGHT_MS - 1000);
  });

  it('a luz: 1 de dia, 0 de noite, e escurece/clareia devagar no fim e no começo do dia', () => {
    expect(daylightAt(DAY_MS / 2, R)).toBe(1);
    expect(daylightAt(DAY_MS + 1, R)).toBe(0);
    expect(daylightAt(DAY_MS - TWILIGHT_MS / 2, R)).toBeCloseTo(0.5); // anoitecendo
    expect(daylightAt(TWILIGHT_MS / 2, R)).toBeCloseTo(0.5); // amanhecendo
    expect(daylightAt(DAY_MS - 1, R)).toBeLessThan(0.01);
    // sem noite: sempre dia
    expect(daylightAt(DAY_MS - 1, { dayMs: DAY_MS, nightMs: 0 })).toBe(1);
    expect(isNightAt(DAY_MS + 1, { dayMs: DAY_MS, nightMs: 0 })).toBe(false);
  });

  it('o relógio: anda com o tempo e o administrador vira para o começo da noite ou do dia', () => {
    let t = 1000;
    const clock = new DayNightClock(R, () => t);
    expect(clock.isNight()).toBe(false);
    clock.turnTo('noite');
    expect(clock.isNight()).toBe(true);
    expect(clock.position()).toBe(DAY_MS);
    t += NIGHT_MS; // a noite passa
    expect(clock.isNight()).toBe(false);
    expect(clock.position()).toBe(0);
    clock.turnTo('noite');
    clock.turnTo('dia'); // já com a luz cheia (logo depois do amanhecer), não no escuro do instante 0
    expect(clock.position()).toBe(TWILIGHT_MS);
    expect(daylightAt(clock.position(), DEFAULT_COMBAT_RULES)).toBe(1);
    // a tarde: o começo do anoitecer (ainda dia, a luz cheia), e em TWILIGHT_MS vem a noite
    clock.turnTo('tarde');
    expect(clock.position()).toBe(DAY_MS - TWILIGHT_MS);
    expect(clock.isNight()).toBe(false);
    t += TWILIGHT_MS / 2;
    expect(daylightAt(clock.position(), R)).toBeCloseTo(0.5);
    t += TWILIGHT_MS / 2;
    expect(clock.isNight()).toBe(true);
  });
});

// ---------- no mundo ----------

const BASE = { nivel: 1, passoMs: 1e9, agressivo: false, perseguicao: 30, renascerMs: 1000 };
const monsters = parseMonsterDefs({
  bicho: { nome: 'Bicho', ...BASE, vida: 40, xp: 10, ouro: 4, ataque: { tipo: 'mordida', preparoMs: 500, intervaloMs: 1000, dano: [8, 8] } },
});

type Inner = {
  damage(target: unknown, amount: number, by: number, now: number): void;
  monsterDamage(range: readonly [number, number]): number;
};

function setup() {
  const clock = new FakeClock();
  const map = GameMap.fromTiled(tiledFromAscii(['.'.repeat(12), '.'.repeat(12), '.'.repeat(12)], { x: 1, y: 1 }, [{ monster: 'bicho', x: 4, y: 1, w: 1, h: 1 }]));
  const world = new World(map, { now: clock.now, random: () => 0, monsters });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  player.admin = true;
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  run(TICK_MS * 2);
  const bicho = () => [...world.monsters.values()][0]!;
  const inner = world as unknown as Inner;
  return { world, clock, conn, player, run, bicho, inner };
}

const turn = (world: World, player: Player, phase: 'dia' | 'noite') => world.gm(player, { do: 'time', phase });

describe('a noite no mundo', () => {
  it('as boas-vindas dizem em que ponto do ciclo estamos', () => {
    const { conn } = setup();
    const welcome = conn.ofType('welcome')[0]!;
    expect(welcome.time).toBeGreaterThanOrEqual(0);
    expect(welcome.time).toBeLessThan(DAY_MS); // o relógio falso começa de dia
    expect(welcome.combat.dayMs).toBe(DAY_MS);
  });

  it('anoitece: o bicho fica com 25% a mais de vida (na mesma proporção) e todo mundo acerta o relógio; amanhece: volta', () => {
    const { world, conn, player, run, bicho, inner } = setup();
    inner.damage(bicho(), 20, 0, 0); // metade da vida
    expect(bicho()).toMatchObject({ hp: 20, maxHp: 40 });
    turn(world, player, 'noite');
    run(TICK_MS);
    expect(bicho()).toMatchObject({ hp: 25, maxHp: 50 });
    expect(conn.ofType('time').at(-1)!.at).toBe(DAY_MS);
    expect(conn.ofType('hp').some((m) => m.id === bicho().id && m.maxHp === 50)).toBe(true);
    turn(world, player, 'dia');
    run(TICK_MS);
    expect(bicho()).toMatchObject({ hp: 20, maxHp: 40 });
    expect(conn.ofType('time').at(-1)!.at).toBe(TWILIGHT_MS);
  });

  it('de noite o golpe do bicho dói 25% a mais', () => {
    const { world, player, inner } = setup();
    expect(inner.monsterDamage([8, 8])).toBe(8);
    turn(world, player, 'noite');
    expect(inner.monsterDamage([8, 8])).toBe(10);
  });

  it('derrubar um bicho de noite dá 50% a mais de XP e de ouro', () => {
    const { world, conn, player, run, bicho, inner } = setup();
    turn(world, player, 'noite');
    run(TICK_MS);
    const xpBefore = player.xp;
    inner.damage(bicho(), bicho().hp, player.id, 0);
    run(TICK_MS);
    expect(player.xp - xpBefore).toBe(15); // 10 × 1,5
    expect(conn.ofType('drop').at(-1)!.gold).toBe(6); // 4 × 1,5
  });

  it('o bicho que nasce de noite já nasce mais forte', () => {
    const { world, player, run, bicho, inner } = setup();
    turn(world, player, 'noite');
    run(TICK_MS);
    inner.damage(bicho(), bicho().hp, player.id, 0);
    run(2000); // renasce
    expect(bicho()).toMatchObject({ hp: 50, maxHp: 50 });
  });

  it('o relógio anda sozinho: depois de 30 min do começo do dia, é noite', () => {
    const { world, player, run, bicho } = setup();
    turn(world, player, 'dia');
    run(TICK_MS);
    expect(bicho().maxHp).toBe(40);
    run(DAY_MS); // (o relógio falso anda tick a tick)
    expect(bicho().maxHp).toBe(50);
  });

  it('o comando do ADM: dia, tarde ou noite; quem não é administrador não vira nada', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'gm', cmd: { do: 'time', phase: 'noite' } }))).toEqual({ t: 'gm', cmd: { do: 'time', phase: 'noite' } });
    expect(parseClientMsg(JSON.stringify({ t: 'gm', cmd: { do: 'time', phase: 'tarde' } }))).toEqual({ t: 'gm', cmd: { do: 'time', phase: 'tarde' } });
    expect(parseClientMsg(JSON.stringify({ t: 'gm', cmd: { do: 'time', phase: 'madrugada' } }))).toBeNull();
    const { world, player, run, bicho } = setup();
    player.admin = false;
    turn(world, player, 'noite');
    run(TICK_MS);
    expect(bicho().maxHp).toBe(40);
  });
});
