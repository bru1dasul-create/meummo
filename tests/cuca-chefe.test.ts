// A Cuca, Etapa 2: a chefe da noite (proposta aprovada pelo dono em 24/11: "pode fazer assim"). De dia, a bruxa que
// negocia; de noite ela some da loja e vira a chefe na toca (nível 6, 300 de vida, como todo bicho de noite, mais forte).
// O caldo do caldeirão voa até 6 m e, onde cai, deixa uma poça verde que queima; a cantiga de ninar (a cada 12 s, até
// 5 m, com 1,5 s de aviso no chão) faz dormir 2,5 s quem ficar na área: não anda, não esquiva nem atira; levar golpe
// acorda, e a esquiva durante o aviso escapa. A missão "A Cantiga da Cuca" pede para derrotá-la de noite.

import { describe, expect, it } from 'vitest';
import { loadItemDefs } from '../src/server/items';
import { loadMonsterDefs, parseMonsterDefs } from '../src/server/monsters';
import { loadNpcDefs, parseNpcDefs } from '../src/server/npcs';
import { loadQuestDefs } from '../src/server/quests';
import { World, type Player } from '../src/server/world';
import { TICK_MS } from '../src/shared/constants';
import { GameMap, type TiledObject } from '../src/shared/map';
import { cornerAtFeet, feetAt } from '../src/shared/movement';
import { FakeClock, FakeConn } from './helpers';

const monsters = loadMonsterDefs();
const items = loadItemDefs();
const quests = loadQuestDefs();

describe('a Cuca chefe (os dados)', () => {
  it('nível 6, 300 de vida, só de noite, volta em 5 minutos; 150 de XP e 25 a 40 de ouro', () => {
    expect(monsters.get('cuca')).toMatchObject({ name: 'Cuca', level: 6, hp: 300, xp: 150, gold: [25, 40], nightOnly: true, respawnMs: 300_000 });
  });

  it('o caldo: 10–15 de dano a até 6 m, a cada 1,6 s; a poça verde queima 3–5 a cada meio segundo por 2,5 s', () => {
    const attack = monsters.get('cuca')!.attack;
    expect(attack).toMatchObject({ kind: 'projectile', range: 6, windupMs: 600, intervalMs: 1600, damage: [10, 15], projectile: 'caldo' });
    expect(attack.puddle).toEqual({ durationMs: 2500, damage: [3, 5], radius: 1 });
  });

  it('a cantiga de ninar: a cada 12 s, até 5 m, 1,5 s de aviso; dorme 2,5 s', () => {
    expect(monsters.get('cuca')!.song).toMatchObject({ effect: 'sleep', everyMs: 12_000, range: 5, windupMs: 1500, durationMs: 2500 });
    expect(monsters.get('iara')!.song!.effect).toBe('charm'); // a Iara continua encantando
  });

  it('o que deixa, o Patuá da Cuca, a bruxa só de dia e a missão', () => {
    expect(Object.fromEntries(monsters.get('cuca')!.drops.map((d) => [d.item, d.chance]))).toEqual({ garrafada_cuca: 50, jurubeba: 60, garrafada_grande: 30, patua_cuca: 15 });
    expect(items.get('patua_cuca')).toMatchObject({ name: 'Patuá da Cuca', kind: 'equipment', slot: 'charm', rarity: 'rare', bonus: { damage: 0, hp: 15, defense: 1 } });
    expect(loadNpcDefs().get('cuca')!.dayOnly).toBe(true);
    expect(quests.get('a_cantiga_da_cuca')).toMatchObject({
      giver: 'cuca',
      after: 'o_caldeirao_da_cuca',
      minLevel: 5,
      goal: { kind: 'kill', monster: 'cuca', count: 1 },
      reward: { xp: 200, gold: 50, items: [{ item: 'patua_cuca', n: 1 }] },
    });
  });

  it('o arquivo é conferido: o "efeito" do canto e a "poça" (só de golpe que voa)', () => {
    const base = { nome: 'B', nivel: 1, vida: 10, xp: 1, passoMs: 300 };
    const throws = { tipo: 'projetil', preparoMs: 300, intervaloMs: 1500, dano: [1, 2] };
    expect(() => parseMonsterDefs({ b: { ...base, ataque: throws, canto: { efeito: 'grito' } } })).toThrow(/"efeito" precisa ser "encanto".*ou "sono"/);
    expect(() => parseMonsterDefs({ b: { ...base, ataque: { tipo: 'mordida', preparoMs: 100, intervaloMs: 500, dano: [1, 2], poca: { duracaoMs: 1000, dano: [1, 1] } } } })).toThrow(
      /só o golpe que voa.*deixa poça/,
    );
    expect(() => parseMonsterDefs({ b: { ...base, ataque: { ...throws, poca: { duracaoMs: 1000, dano: [1, 1], raio: 5 } } } })).toThrow(/"raio" precisa ser um número inteiro de 0 a 3/);
  });
});

// ---------- na toca ----------

const PX = 32;

/** A toca de teste (formato novo, 1 tile = 1 m): a área da Cuca chefe e a bruxa (só de dia) no meio dela. */
function toca() {
  const spawn: TiledObject = { id: 1, name: 'spawn', x: 2 * PX, y: 2 * PX, point: true };
  const area: TiledObject = { id: 2, name: 'cuca', x: 9 * PX, y: 3 * PX, width: 4 * PX, height: 4 * PX, properties: [{ name: 'quantidade', type: 'int', value: 1 }] };
  const map = GameMap.fromTiled(
    { width: 24, height: 14, tilewidth: PX, tileheight: PX, orientation: 'orthogonal', tilesets: [], layers: [{ type: 'objectgroup', name: 'monstros', objects: [area] }, { type: 'objectgroup', name: 'pontos', objects: [spawn] }] },
    'toca',
  );
  const npcs = parseNpcDefs({ cuca: { nome: 'Cuca', mapa: 'toca', x: 11.5, y: 5.5, soDeDia: true, loja: { vende: ['frasco'] }, receitas: ['garrafada_cuca'] } });
  const clock = new FakeClock();
  const world = new World(map, { now: clock.now, random: () => 0.5, monsters, items, npcs, quests });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  player.admin = true;
  world.adminSetLevel(player, 8);
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  run(TICK_MS * 2);
  const turn = (phase: 'dia' | 'noite') => {
    world.gm(player, { do: 'time', phase });
    run(TICK_MS * 2);
  };
  const boss = () => [...world.monsters.values()].find((m) => m.def.id === 'cuca');
  const witch = () => [...world.npcs.values()].find((n) => n.def.id === 'cuca')!;
  return { world, clock, conn, player, run, turn, boss, witch };
}

/** Põe o pé do jogador em (x, y) metros. */
function standAt(player: Player, x: number, y: number): void {
  const corner = cornerAtFeet(x, y);
  player.fx = corner.x;
  player.fy = corner.y;
}

type Inner = { damage(target: unknown, amount: number, by: number, now: number): void };

describe('de dia a bruxa, de noite a chefe', () => {
  it('de dia: a bruxa na lista, nenhuma chefe; anoitece: a bruxa some (e ninguém negocia com ela) e a chefe chega; amanhece: volta tudo', () => {
    const { world, conn, player, turn, boss, witch, run } = toca();
    turn('dia');
    expect(boss()).toBeUndefined();
    conn.clear();
    turn('noite');
    expect(boss()).toBeDefined();
    const night = conn.ofType('npcs').at(-1)!;
    expect(night.npcs.some((n) => n.e.type === 'cuca')).toBe(false);
    // de noite, a bruxa não negocia nem prepara
    standAt(player, 11.5, 6.4);
    player.inventory.add('jurubeba', 2);
    world.craft(player, witch().id, 'garrafada_cuca');
    run(TICK_MS);
    expect(conn.ofType('fail').at(-1)).toMatchObject({ reason: 'cant_trade' });
    conn.clear();
    turn('dia');
    expect(conn.ofType('npcs').at(-1)!.npcs.some((n) => n.e.type === 'cuca')).toBe(true);
  });
});

describe('a cantiga de ninar', () => {
  /** De noite, com a Ana a 3 m da chefe e a cantiga pronta para sair. */
  function singing() {
    const t = toca();
    t.turn('noite');
    const cuca = t.boss()!;
    const feet = feetAt(cuca.x, cuca.y);
    standAt(t.player, feet.x - 3, feet.y);
    cuca.nextSpecialAt = 0;
    return { ...t, cuca };
  }

  it('quem fica na área dorme 2,5 s: não anda nem atira; quem vê fica sabendo', () => {
    const { conn, player, run, world, cuca } = singing();
    for (let t = 0; t < 3000 && conn.ofType('sleep').length === 0; t += TICK_MS) run(TICK_MS);
    const sleep = conn.ofType('sleep')[0]!;
    expect(sleep).toEqual({ t: 'sleep', id: player.id, ms: 2500 });
    expect(conn.ofType('warn').some((m) => m.id === cuca.id)).toBe(true); // o aviso no chão veio antes
    const where = { x: player.fx, y: player.fy };
    world.requestWalk(player, 9999, 0);
    world.shoot(player, 1, 0);
    run(TICK_MS * 4);
    expect({ x: player.fx, y: player.fy }).toEqual(where);
    expect(conn.ofType('shot').some((m) => m.by === player.id)).toBe(false);
    run(2600);
    expect(conn.ofType('sleep').at(-1)).toEqual({ t: 'sleep', id: player.id, ms: 0 }); // acordou sozinha
  });

  it('levar golpe acorda', () => {
    const { conn, player, run, world, clock, cuca } = singing();
    for (let t = 0; t < 3000 && conn.ofType('sleep').length === 0; t += TICK_MS) run(TICK_MS);
    expect(player.asleepUntil).toBeGreaterThan(clock.now());
    (world as unknown as Inner).damage(player, 2, cuca.id, clock.now());
    expect(player.asleepUntil).toBe(0);
    run(TICK_MS);
    expect(conn.ofType('sleep').at(-1)).toEqual({ t: 'sleep', id: player.id, ms: 0 });
  });

  it('a esquiva durante o aviso escapa', () => {
    const { conn, player, run, clock } = singing();
    for (let t = 0; t < 3000 && conn.ofType('warn').length === 0; t += TICK_MS) run(TICK_MS);
    player.invulnerableUntil = clock.now() + 2000; // rolando bem na hora em que a cantiga pega
    run(1700);
    expect(conn.ofType('sleep')).toHaveLength(0);
    expect(player.asleepUntil).toBe(0);
  });
});

describe('o caldo e a poça', () => {
  it('o caldo que acerta deixa a poça verde (quem vê fica sabendo) e ela queima quem fica em cima', () => {
    const { conn, player, run, turn, boss } = toca();
    turn('noite');
    const cuca = boss()!;
    cuca.def.song!.everyMs = 1e9; // (só o caldo neste teste)
    cuca.nextSpecialAt = 1e12;
    const feet = feetAt(cuca.x, cuca.y);
    standAt(player, feet.x - 4.5, feet.y);
    for (let t = 0; t < 6000 && !conn.ofType('fire').some((m) => m.k === 'caldo'); t += TICK_MS) run(TICK_MS);
    const puddle = conn.ofType('fire').find((m) => m.k === 'caldo')!;
    expect(puddle).toMatchObject({ id: cuca.id, ms: 2500, k: 'caldo' });
    expect(puddle.tiles.length).toBeGreaterThanOrEqual(2 * 3); // a casa e as vizinhas (em cruz)
    // a Ana continua em cima: a poça queima mais um pouco
    const hp = player.hp;
    run(1100);
    expect(player.hp).toBeLessThan(hp);
    cuca.def.song!.everyMs = 12_000;
  });

  it('as poças não se somam: a nova toma o lugar da antiga no mesmo chão (quem fica parado não queima em dobro)', () => {
    const { conn, player, run, turn, boss, world } = toca();
    turn('noite');
    const cuca = boss()!;
    cuca.def.song!.everyMs = 1e9;
    cuca.nextSpecialAt = 1e12;
    const feet = feetAt(cuca.x, cuca.y);
    standAt(player, feet.x - 4.5, feet.y);
    // (só para ver as poças: a Ana não desmaia)
    for (let t = 0; t < 9000 && conn.ofType('fire').filter((m) => m.k === 'caldo').length < 3; t += TICK_MS) {
      run(TICK_MS);
      player.hp = player.maxHp;
    }
    expect(conn.ofType('fire').filter((m) => m.k === 'caldo').length).toBeGreaterThanOrEqual(3);
    // cada casa queimando está em uma poça só
    const hazards = (world as unknown as { hazards: { tiles: { x: number; y: number }[] }[] }).hazards;
    const keys = hazards.flatMap((h) => h.tiles.map((t) => `${t.x},${t.y}`));
    expect(new Set(keys).size).toBe(keys.length);
    cuca.def.song!.everyMs = 12_000;
  });
});

describe('a missão "A Cantiga da Cuca"', () => {
  it('aceita de dia com a bruxa; derrotar a chefe de noite conta; de dia, conclui e ganha o patuá', () => {
    const { world, player, run, turn, boss, witch, clock } = toca();
    player.quests.o_caldeirao_da_cuca = { state: 'done', count: 0 };
    turn('dia');
    standAt(player, 11.5, 6.4);
    world.questAction(player, 'accept', 'a_cantiga_da_cuca', witch().id);
    expect(player.quests.a_cantiga_da_cuca).toEqual({ state: 'active', count: 0 });
    turn('noite');
    (world as unknown as Inner).damage(boss()!, 9999, player.id, clock.now());
    expect(player.quests.a_cantiga_da_cuca!.count).toBe(1);
    // de noite a bruxa não está: não dá para concluir
    world.questAction(player, 'complete', 'a_cantiga_da_cuca', witch().id);
    expect(player.quests.a_cantiga_da_cuca!.state).toBe('active');
    turn('dia');
    run(TICK_MS);
    world.questAction(player, 'complete', 'a_cantiga_da_cuca', witch().id);
    expect(player.quests.a_cantiga_da_cuca!.state).toBe('done');
    expect(player.inventory.countOf('patua_cuca')).toBe(1);
  });
});
