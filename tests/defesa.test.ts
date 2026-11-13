// Defesa com energia (combate passo 2b, revisão 17 do protótipo, os mesmos números): segurar levanta a defesa, que
// protege um arco de 140° na frente e deixa passar 25% do golpe; segurar e defender gastam energia; sem energia, ela
// quebra e só levanta de novo soltando o botão. Defendendo, anda devagar e não atira.

import { describe, expect, it } from 'vitest';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import type { Projectile } from '../src/server/entities';
import { blockHit, guardCovers } from '../src/shared/combat';
import { DEFAULT_COMBAT_RULES as RULES } from '../src/shared/combatRules';
import {
  CHARGE_FULL_MS,
  GUARD_BREAK_MS,
  GUARD_DRAIN_PER_S,
  GUARD_MAX_ENERGY,
  GUARD_READY_MS,
  GUARD_REGEN_DELAY_MS,
  GUARD_REGEN_PER_S,
  GUARD_WALK_FACTOR,
  STEP_MS,
  TICK_MS,
} from '../src/shared/constants';
import { GameMap, type TiledObject } from '../src/shared/map';
import { sliceDistance } from '../src/shared/movement';
import { FakeClock, FakeConn } from './helpers';

const PX = 32;
const DEG = Math.PI / 180;
const EAST = 0;
const WEST = Math.PI;

/** Mapa do formato novo (1 tile = 1 metro), aberto. */
function metricMap(): GameMap {
  const spawn: TiledObject = { id: 0, name: 'spawn', x: 8 * PX, y: 5 * PX, point: true };
  return GameMap.fromTiled(
    {
      width: 30,
      height: 12,
      tilewidth: PX,
      tileheight: PX,
      orientation: 'orthogonal',
      properties: [{ name: 'nome', type: 'string', value: 'Teste' }],
      tilesets: [],
      layers: [
        { type: 'objectgroup', name: 'colisao', objects: [] },
        { type: 'objectgroup', name: 'pontos', objects: [spawn] },
      ],
    },
    'teste',
  );
}

type Hurt = { damage(target: Player, amount: number, by: number, now: number, travel?: number): void };

function setup() {
  const clock = new FakeClock();
  const world = new World(metricMap(), { now: clock.now, random: () => 0 });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  /** Passa `ms` de jogo, tick a tick. */
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  /** Um golpe de `amount` andando na direção `travel` (radianos). */
  const hit = (amount: number, travel?: number) => (world as unknown as Hurt).damage(player, amount, 0, clock.now(), travel);
  return { world, clock, conn, player, run, hit };
}

describe('defesa com energia: as contas', () => {
  it('bloqueio com energia de sobra: passa 25% e gasta 10 + 0,75 × dano', () => {
    expect(blockHit(100, 40, RULES)).toEqual({ damage: 10, energy: 60, broke: false });
    const small = blockHit(100, 3, RULES);
    expect(small.damage).toBe(1); // pelo menos 1
    expect(small.energy).toBeCloseTo(100 - 12.25);
    expect(small.broke).toBe(false);
  });

  it('uma pedra de 40 com 40 de energia: segura inteira e quebra (como no protótipo)', () => {
    expect(blockHit(40, 40, RULES)).toEqual({ damage: 10, energy: 0, broke: true });
  });

  it('sem energia para o golpe inteiro: protege em parte e quebra', () => {
    // 20 de energia para um golpe que custa 40: metade da proteção → passa 40 × (1 − 0,75 × 0,5) = 25
    expect(blockHit(20, 40, RULES)).toEqual({ damage: 25, energy: 0, broke: true });
  });

  it('o arco é de 140° na frente; lados mais abertos e costas não', () => {
    // defesa virada para o leste: o golpe que anda para o oeste vem de frente
    expect(guardCovers(EAST, WEST, RULES)).toBe(true);
    expect(guardCovers(EAST, EAST, RULES)).toBe(false); // pelas costas
    expect(guardCovers(EAST, WEST + 69 * DEG, RULES)).toBe(true);
    expect(guardCovers(EAST, WEST - 69 * DEG, RULES)).toBe(true);
    expect(guardCovers(EAST, WEST + 75 * DEG, RULES)).toBe(false);
    expect(guardCovers(170 * DEG, -10 * DEG, RULES)).toBe(true); // dá a volta no círculo
  });
});

describe('defesa com energia no servidor', () => {
  it('de frente segura 75% e gasta energia; pelas costas, o golpe inteiro', () => {
    const { world, conn, player, run, hit } = setup();
    world.guard(player, true, EAST);
    run(200);
    const energy = player.energy;
    expect(energy).toBeCloseTo(GUARD_MAX_ENERGY - GUARD_DRAIN_PER_S * 0.2, 0);
    const hp = player.hp;
    hit(20, WEST); // de frente
    expect(hp - player.hp).toBe(5);
    expect(player.energy).toBeCloseTo(energy - (10 + 0.75 * 20));
    run(TICK_MS); // as mensagens saem no fim do tick
    expect(conn.ofType('hit').at(-1)).toMatchObject({ dmg: 5, blk: 1 });
    expect(conn.ofType('energy').at(-1)).toMatchObject({ g: 'up' });
    const before = player.energy;
    hit(20, EAST); // pelas costas
    expect(hp - 5 - player.hp).toBe(20);
    expect(player.energy).toBe(before);
    run(TICK_MS);
    expect(conn.ofType('hit').at(-1)!.blk).toBeUndefined();
    hit(4); // sem direção (fogo no chão): a defesa não segura
    run(TICK_MS);
    expect(conn.ofType('hit').at(-1)).toMatchObject({ dmg: 4 });
  });

  it(`só protege depois de subir (${GUARD_READY_MS} ms)`, () => {
    const { world, player, run, hit } = setup();
    world.guard(player, true, EAST);
    run(TICK_MS); // levantou agora
    const hp = player.hp;
    hit(20, WEST);
    expect(hp - player.hp).toBe(20);
  });

  it('segurar gasta 6 por segundo; soltando, a energia volta 22 por segundo depois de 0,7 s', () => {
    const { world, player, run } = setup();
    world.guard(player, true, EAST);
    run(1000);
    expect(player.energy).toBeCloseTo(GUARD_MAX_ENERGY - GUARD_DRAIN_PER_S, 0);
    run(4000); // mais um pouco, para sobrar espaço para medir a volta
    const low = player.energy;
    expect(low).toBeCloseTo(GUARD_MAX_ENERGY - 5 * GUARD_DRAIN_PER_S, 0);
    world.guard(player, false, EAST);
    run(GUARD_REGEN_DELAY_MS - 100);
    expect(player.energy).toBe(low); // ainda esperando
    run(1100);
    // voltou ~22/s no tempo que passou depois da espera
    expect(player.energy - low).toBeGreaterThan(GUARD_REGEN_PER_S * 0.8);
    expect(player.energy - low).toBeLessThan(GUARD_REGEN_PER_S * 1.1);
    run(5000);
    expect(player.energy).toBe(GUARD_MAX_ENERGY);
  });

  it('acabou a energia: quebra; segurando não levanta de novo; soltando, levanta com 20 de energia depois de 0,85 s', () => {
    const { world, conn, player, run, hit } = setup();
    player.energy = 15;
    world.guard(player, true, EAST);
    run(200);
    const hp = player.hp;
    hit(20, WEST); // custa 25, tinha ~14: protege em parte e quebra
    expect(hp - player.hp).toBeGreaterThan(5);
    expect(hp - player.hp).toBeLessThan(20);
    run(TICK_MS);
    expect(conn.ofType('hit').at(-1)).toMatchObject({ blk: 2 });
    expect(conn.ofType('energy').at(-1)).toMatchObject({ v: 0, g: 'broken' });
    expect(conn.ofType('guard')).toHaveLength(0); // os outros veem; você não recebe a sua
    run(3000); // segurando o botão: a energia volta, mas a defesa não levanta sozinha
    expect(player.energy).toBeGreaterThan(20);
    expect(player.guardUpAt).toBeNull();
    const hp2 = player.hp;
    hit(10, WEST);
    expect(hp2 - player.hp).toBe(10);
    world.guard(player, false, EAST); // soltou
    run(100);
    world.guard(player, true, EAST); // apertou de novo
    run(200);
    expect(player.guardUpAt).not.toBeNull();
    expect(conn.ofType('energy').at(-1)).toMatchObject({ g: 'up' });
  });

  it('quebrou e soltou na hora: só levanta depois do tempo da quebra e com 20 de energia', () => {
    const { world, player, run, hit } = setup();
    player.energy = 5;
    world.guard(player, true, EAST);
    run(200);
    hit(20, WEST); // quebra
    world.guard(player, false, EAST);
    world.guard(player, true, EAST);
    run(GUARD_BREAK_MS - 200);
    expect(player.guardUpAt).toBeNull(); // cedo demais (e sem energia)
    world.guard(player, false, EAST);
    run(GUARD_REGEN_DELAY_MS + 1500); // energia volta passando de 20
    world.guard(player, true, EAST);
    run(100);
    expect(player.guardUpAt).not.toBeNull();
  });

  it('defendendo, anda devagar (70% do andar devagar), na ordem em que o navegador pediu', () => {
    const { world, player, run } = setup();
    const step = () => {
      const x = player.fx;
      run(TICK_MS);
      return player.fx - x;
    };
    world.requestWalk(player, 1, 0);
    expect(step()).toBeCloseTo(sliceDistance(true, false, STEP_MS)); // correndo
    world.requestWalk(player, 2, 0); // pedido antes de segurar a defesa: anda normal
    world.guard(player, true, EAST);
    world.requestWalk(player, 3, 0); // pedido segurando: devagar
    expect(step()).toBeCloseTo(sliceDistance(true, false, STEP_MS));
    expect(step()).toBeCloseTo(sliceDistance(true, true, STEP_MS) * GUARD_WALK_FACTOR);
    world.guard(player, false, EAST);
    world.requestWalk(player, 4, 0);
    expect(step()).toBeCloseTo(sliceDistance(true, false, STEP_MS));
  });

  it('levantar a defesa solta a pedra; defendendo não atira nem usa habilidade', () => {
    const { world, clock, player } = setup();
    const base = player.damage()[0];
    world.charge(player);
    world.guard(player, true, EAST);
    clock.advance(CHARGE_FULL_MS);
    world.shoot(player, 1, 0);
    expect(world.projectiles.size).toBe(0); // defendendo: não atira
    world.guard(player, false, EAST);
    world.shoot(player, 2, 0);
    expect([...world.projectiles.values()].at(-1)!.damage).toBe(base); // a carga caiu com a defesa
    clock.advance(1000);
    world.guard(player, true, EAST);
    const ready = player.skillReadyAt[1];
    world.useSkill(player, 1, 0);
    expect(player.skillReadyAt[1]).toBe(ready);
  });

  it('a fruta do sagui vindo de frente bate na defesa; vindo por trás, não', () => {
    const { world, player, run } = setup();
    world.guard(player, true, EAST);
    run(200);
    const throwAt = (fromEast: boolean) => {
      const cx = player.fx + 0.5;
      const cy = player.fy + 0.5;
      const shot: Projectile = {
        id: 900 + (fromEast ? 1 : 2),
        ownerId: 0,
        fromMonster: true,
        damage: 12,
        kind: 'fruta',
        viewers: new Set(),
        x: cx + (fromEast ? 1.5 : -1.5),
        y: cy,
        dx: fromEast ? -1 : 1,
        dy: 0,
        speed: 10,
        range: 4,
        traveled: 0,
      };
      world.projectiles.set(shot.id, shot);
      const hp = player.hp;
      run(400);
      return hp - player.hp;
    };
    expect(throwAt(true)).toBe(3); // de frente: 12 × 25%
    expect(throwAt(false)).toBe(12); // pelas costas
  });

  it('desmaiar baixa a defesa e acordar enche a energia', () => {
    const { world, player, run, hit } = setup();
    world.guard(player, true, EAST);
    run(500);
    hit(1000, EAST);
    expect(player.dead).toBe(true);
    expect(player.guardWanted).toBe(false);
    expect(player.guardUpAt).toBeNull();
    run(10_000);
    expect(player.dead).toBe(false);
    expect(player.energy).toBe(GUARD_MAX_ENERGY);
  });

  it('a mensagem da defesa passa pela conferência', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'guard', on: true, a: 1.5 }))).toEqual({ t: 'guard', on: true, a: 1.5 });
    expect(parseClientMsg(JSON.stringify({ t: 'guard', on: false, a: 0 }))).toEqual({ t: 'guard', on: false, a: 0 });
    expect(parseClientMsg(JSON.stringify({ t: 'guard', on: 1, a: 0 }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'guard', on: true }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'guard', on: true, a: 99 }))).toBeNull();
  });
});
