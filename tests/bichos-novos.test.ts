// Bichos novos da mata do sul do Capão (aprovados pelo dono em 14/11): o quati (bando, nível 2), o tatu-bola (casca
// de frente e tonto depois da investida, nível 3), os marimbondos (enxame: parte das pedras passa pelo meio, nível 3) e
// o filhote de boitatá (fogo, nível 5, só de noite).

import { describe, expect, it } from 'vitest';
import { loadItemDefs } from '../src/server/items';
import { checkDrops, loadMonsterDefs, parseMonsterDefs } from '../src/server/monsters';
import { World, type Player } from '../src/server/world';
import { TICK_MS } from '../src/shared/constants';
import { LEFT, RIGHT } from '../src/shared/dir';
import { GameMap } from '../src/shared/map';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

describe('data/monsters.json: os bichos novos', () => {
  const defs = loadMonsterDefs();

  it('as quatro chaves, com os níveis combinados', () => {
    expect(defs.get('quati')).toMatchObject({ name: 'Quati', level: 2, nightOnly: false, shell: null, shotDodge: 0 });
    expect(defs.get('tatu_bola')).toMatchObject({ name: 'Tatu-Bola', level: 3 });
    expect(defs.get('marimbondo')).toMatchObject({ name: 'Marimbondos', level: 3, shotDodge: 0.4 });
    expect(defs.get('filhote_boitata')).toMatchObject({ name: 'Filhote de Boitatá', level: 5, nightOnly: true });
    expect(defs.get('filhote_boitata')!.attack.fire).toEqual({ durationMs: 2000, damage: [3, 5] });
  });

  it('a casca do tatu: segura 70% de frente (140°) e fica tonto 2 s depois da investida', () => {
    const shell = defs.get('tatu_bola')!.shell!;
    expect(shell.block).toBeCloseTo(0.7);
    expect(shell.halfArc).toBeCloseTo((70 * Math.PI) / 180);
    expect(shell.dizzyMs).toBe(2000);
    expect(defs.get('tatu_bola')!.attack.kind).toBe('charge');
  });

  it('todo item que eles deixam existe', () => {
    expect(() => checkDrops(defs, loadItemDefs())).not.toThrow();
  });

  it('números fora do lugar dão erro em português', () => {
    const base = { nome: 'B', nivel: 1, vida: 10, xp: 1, passoMs: 300, ataque: { tipo: 'mordida', preparoMs: 100, intervaloMs: 500, dano: [1, 2] } };
    expect(() => parseMonsterDefs({ b: { ...base, casca: { seguraPorcento: 150 } } })).toThrow(/seguraPorcento/);
    expect(() => parseMonsterDefs({ b: { ...base, desvioTiro: 95 } })).toThrow(/desvioTiro/);
  });
});

// ---------- no mundo ----------

const ATTACK = { tipo: 'mordida', preparoMs: 500, intervaloMs: 1000, dano: [5, 5] };
const BASE = { nivel: 3, vida: 100, xp: 10, passoMs: 1e9, agressivo: false, perseguicao: 30, renascerMs: 60_000 };
const monsters = parseMonsterDefs({
  tatu: { nome: 'Tatu', ...BASE, ataque: ATTACK, casca: { seguraPorcento: 70, angulo: 140, tontoMs: 2000 } },
  tatu_brabo: {
    nome: 'Tatu Brabo',
    ...BASE,
    passoMs: 400,
    agressivo: true,
    alcanceAgressao: 8,
    ataque: { tipo: 'investida', alcance: 5, preparoMs: 600, intervaloMs: 3000, dano: [4, 4] },
    casca: { seguraPorcento: 70, angulo: 140, tontoMs: 2000 },
  },
  enxame: { nome: 'Enxame', ...BASE, ataque: ATTACK, desvioTiro: 40 },
  fogo: { nome: 'Fogo', ...BASE, ataque: ATTACK, soNoite: true },
});

type Inner = { damage(target: unknown, amount: number, by: number, now: number, travel?: number): void };

function setup(monster: string, random = () => 0, at = { x: 8, y: 1 }) {
  const clock = new FakeClock();
  const map = GameMap.fromTiled(tiledFromAscii(['.'.repeat(14), '.'.repeat(14), '.'.repeat(14)], { x: 3, y: 1 }, [{ monster, x: at.x, y: at.y, w: 1, h: 1 }]));
  const world = new World(map, { now: clock.now, random, monsters });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  player.admin = true;
  Object.assign(player, { x: 3, y: 1, fx: 3, fy: 1 }); // na mesma linha do bicho (o tiro para o leste passa nele)
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  run(TICK_MS * 2);
  const bicho = () => [...world.monsters.values()][0];
  return { world, clock, conn, player, run, bicho, inner: world as unknown as Inner };
}

describe('o tatu-bola', () => {
  it('de frente a casca segura 70% (e o golpe sai como "defendido"); de costas, o golpe é inteiro', () => {
    const { conn, player, bicho, inner, clock, run } = setup('tatu');
    const tatu = bicho()!;
    tatu.dir = LEFT; // olhando para a Ana (que está a oeste)
    inner.damage(tatu, 10, player.id, clock.now(), 0); // pedra voando para o leste: vem pela frente dele
    expect(tatu.hp).toBe(97);
    run(TICK_MS);
    expect(conn.ofType('hit').at(-1)).toMatchObject({ id: tatu.id, dmg: 3, blk: 1 });
    tatu.dir = RIGHT; // de costas para a Ana
    inner.damage(tatu, 10, player.id, clock.now(), 0);
    expect(tatu.hp).toBe(87);
    // golpe de perto (sem o caminho do tiro): vale de que lado quem bateu está
    tatu.dir = LEFT;
    inner.damage(tatu, 10, player.id, clock.now());
    expect(tatu.hp).toBe(84);
  });

  it('tonto (depois da investida), a casca não segura nada', () => {
    const { player, bicho, inner, clock } = setup('tatu');
    const tatu = bicho()!;
    tatu.dir = LEFT;
    tatu.dizzyUntil = clock.now() + 2000;
    inner.damage(tatu, 10, player.id, clock.now(), 0);
    expect(tatu.hp).toBe(90);
  });

  it('depois da investida fica tonto: avisa quem vê e fica parado', () => {
    const { conn, player, run, bicho } = setup('tatu_brabo', () => 0, { x: 8, y: 1 });
    player.fx = player.x = 4; // 4 tiles a oeste, na mesma linha: dá investida
    player.fy = player.y = 1;
    for (let t = 0; t < 4000 && !conn.ofType('fx').some((m) => m.kind === 'dizzy'); t += TICK_MS) run(TICK_MS);
    const dizzy = conn.ofType('fx').find((m) => m.kind === 'dizzy');
    expect(dizzy?.id).toBe(bicho()!.id);
    const where = { x: bicho()!.x, y: bicho()!.y };
    run(1500); // ainda tonto: não sai do lugar
    expect({ x: bicho()!.x, y: bicho()!.y }).toEqual(where);
  });
});

describe('os marimbondos (enxame)', () => {
  it('sorteio: parte das pedras passa pelo meio sem acertar (e quem vê fica sabendo)', () => {
    const passes = setup('enxame', () => 0.1); // 0,1 < 40%: passa
    passes.world.shoot(passes.player, 1, 0);
    passes.run(1500);
    expect(passes.bicho()!.hp).toBe(100);
    expect(passes.conn.ofType('fx').some((m) => m.kind === 'dodge' && m.id === passes.bicho()!.id)).toBe(true);
    expect(passes.conn.ofType('shot_end')[0]!.hit).toBe(0);

    const hits = setup('enxame', () => 0.9); // 0,9 ≥ 40%: acerta
    hits.world.shoot(hits.player, 1, 0);
    hits.run(1500);
    expect(hits.bicho()!.hp).toBeLessThan(100);
    expect(hits.conn.ofType('fx').some((m) => m.kind === 'dodge')).toBe(false);
  });
});

describe('o filhote de boitatá (só de noite)', () => {
  const turn = (world: World, player: Player, phase: 'dia' | 'noite') => world.gm(player, { do: 'time', phase });

  it('de dia não aparece (nem pelo menu ADM); anoitece e ele chega; amanhece e ele vai embora', () => {
    const { world, conn, player, run, bicho } = setup('fogo');
    expect(bicho()).toBeUndefined();
    world.gm(player, { do: 'spawn', monster: 'fogo', n: 1 });
    run(TICK_MS);
    expect(conn.ofType('sys').at(-1)!.text).toMatch(/só aparece de noite/);
    turn(world, player, 'noite');
    run(TICK_MS * 2);
    const fogo = bicho()!;
    expect(fogo.def.id).toBe('fogo');
    turn(world, player, 'dia');
    run(TICK_MS * 2);
    expect(bicho()).toBeUndefined();
    expect(conn.ofType('fx').some((m) => m.kind === 'vanish' && m.id === fogo.id)).toBe(true);
    expect(conn.ofType('despawn').some((m) => m.id === fogo.id)).toBe(true);
    run(70_000); // o dia inteiro sem ele (o tempo de renascer passou e ele não volta)
    expect(bicho()).toBeUndefined();
  });
});
