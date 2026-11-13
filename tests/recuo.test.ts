// Recuo (combate passo 2c, revisão 17 do protótipo): o golpe de monstro empurra o jogador na direção em que andava,
// o quanto o monstro diz ("recuo", em centímetros). A defesa que segura deixa 25% do empurrão; a que quebra, 50%.
// Parede segura. O navegador fica sabendo pelo ack.

import { describe, expect, it } from 'vitest';
import type { Projectile } from '../src/server/entities';
import { parseMonsterDefs } from '../src/server/monsters';
import { World, type Player } from '../src/server/world';
import { GUARD_BREAK_PUSH_FACTOR, GUARD_PUSH_FACTOR, TICK_MS } from '../src/shared/constants';
import { GameMap, type TiledObject } from '../src/shared/map';
import { bodyFits } from '../src/shared/movement';
import { FakeClock, FakeConn } from './helpers';

const PX = 32;
const EAST = 0;
const WEST = Math.PI;

/** Mapa do formato novo (1 tile = 1 metro), com uma parede de x = 12 a 13. */
function metricMap(): GameMap {
  const spawn: TiledObject = { id: 0, name: 'spawn', x: 8 * PX, y: 5 * PX, point: true };
  const wall: TiledObject = { id: 1, x: 12 * PX, y: 0, width: PX, height: 12 * PX };
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
        { type: 'objectgroup', name: 'colisao', objects: [wall] },
        { type: 'objectgroup', name: 'pontos', objects: [spawn] },
      ],
    },
    'teste',
  );
}

type Hurt = { damage(target: Player, amount: number, by: number, now: number, travel?: number, push?: number): void };

function setup() {
  const clock = new FakeClock();
  const map = metricMap();
  const world = new World(map, { now: clock.now, random: () => 0 });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  const hit = (amount: number, travel?: number, push?: number) => (world as unknown as Hurt).damage(player, amount, 0, clock.now(), travel, push);
  return { world, clock, conn, player, map, run, hit };
}

/** Um monstro só com o necessário, para ler o "recuo". */
const monsterJson = (attack: Record<string, unknown>) => ({
  teste: {
    nome: 'Teste',
    nivel: 1,
    vida: 10,
    xp: 1,
    passoMs: 300,
    ouro: [0, 0],
    itens: [],
    ataque: { preparoMs: 300, intervaloMs: 1000, dano: [1, 2], ...attack },
  },
});

describe('recuo dos golpes', () => {
  it('cada tipo de golpe tem um recuo padrão; o monstro pode dizer o dele (até 100 cm)', () => {
    expect(parseMonsterDefs(monsterJson({ tipo: 'projetil' })).get('teste')!.attack.pushCm).toBe(12);
    expect(parseMonsterDefs(monsterJson({ tipo: 'investida' })).get('teste')!.attack.pushCm).toBe(34);
    expect(parseMonsterDefs(monsterJson({ tipo: 'mordida', recuo: 30 })).get('teste')!.attack.pushCm).toBe(30);
    expect(parseMonsterDefs(monsterJson({ tipo: 'mordida', recuo: 0 })).get('teste')!.attack.pushCm).toBe(0);
    expect(() => parseMonsterDefs(monsterJson({ tipo: 'mordida', recuo: 150 }))).toThrow(/recuo/);
    expect(() => parseMonsterDefs(monsterJson({ tipo: 'mordida', recuo: -5 }))).toThrow(/recuo/);
  });

  it('o golpe empurra na direção em que andava, e o navegador fica sabendo pelo ack', () => {
    const { conn, player, run, hit } = setup();
    run(TICK_MS);
    const x = player.fx;
    const y = player.fy;
    hit(3, EAST, 0.22);
    expect(player.fx - x).toBeCloseTo(0.22, 5);
    expect(player.fy).toBeCloseTo(y, 9);
    run(TICK_MS);
    expect(conn.ofType('ack').at(-1)).toMatchObject({ x: player.fx, y: player.fy });
    hit(3, WEST, 0.12);
    expect(player.fx - x).toBeCloseTo(0.1, 5);
  });

  it('a defesa que segura deixa 25% do empurrão; a que quebra no golpe, 50%', () => {
    const { world, player, run, hit } = setup();
    world.guard(player, true, WEST); // virada para o oeste: o golpe que anda para o leste vem de frente
    run(200);
    let x = player.fx;
    hit(4, EAST, 0.34);
    expect(player.fx - x).toBeCloseTo(0.34 * GUARD_PUSH_FACTOR, 5);
    player.energy = 5; // o próximo golpe quebra a defesa
    x = player.fx;
    hit(4, EAST, 0.34);
    expect(player.guardBroken).toBe(true);
    expect(player.fx - x).toBeCloseTo(0.34 * GUARD_BREAK_PUSH_FACTOR, 5);
  });

  it('parede segura o empurrão', () => {
    const { player, map, run, hit } = setup();
    run(TICK_MS);
    // encostado quase na parede (x = 12): a caixa do pé termina 5 cm antes dela
    let fx = player.fx;
    while (bodyFits(map, fx + 0.01, player.fy)) fx += 0.01;
    player.fx = fx - 0.05;
    hit(3, EAST, 0.34);
    expect(bodyFits(map, player.fx, player.fy)).toBe(true);
    expect(player.fx).toBeLessThanOrEqual(fx + 1e-6);
    expect(player.fx).toBeGreaterThan(fx - 0.05);
  });

  it('sem direção (fogo no chão), sem empurrão, ou desmaiando, ninguém é empurrado', () => {
    const { player, run, hit } = setup();
    run(TICK_MS);
    const x = player.fx;
    hit(3, undefined, 0.3);
    hit(3, EAST, 0);
    expect(player.fx).toBe(x);
    hit(1000, EAST, 0.3);
    expect(player.dead).toBe(true);
    expect(player.fx).toBe(x);
  });

  it('a fruta do sagui empurra o recuo do monstro que jogou, na direção em que voava', () => {
    const { world, player, run } = setup();
    run(TICK_MS);
    const x = player.fx;
    const shot: Projectile = {
      id: 900,
      ownerId: 0,
      fromMonster: true,
      damage: 2,
      kind: 'fruta',
      viewers: new Set(),
      x: player.fx + 0.5 + 1.5,
      y: player.fy + 0.5,
      dx: -1,
      dy: 0,
      speed: 10,
      range: 4,
      traveled: 0,
      push: 0.12,
    };
    world.projectiles.set(shot.id, shot);
    run(400);
    expect(x - player.fx).toBeCloseTo(0.12, 5); // voava para o oeste: empurrou para o oeste
  });
});
