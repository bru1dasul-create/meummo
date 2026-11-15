// Pedra com carga (combate passo 2, revisão 17 do protótipo): segurar puxa o estilingue, soltar atira. O servidor
// conta o tempo pelo relógio dele (do `charge` até o `shoot`); a esquiva, um golpe recebido e o desmaio soltam a pedra.

import { describe, expect, it } from 'vitest';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { shotSpread } from '../src/shared/combat';
import { DEFAULT_COMBAT_RULES } from '../src/shared/combatRules';
import { CHARGE_FULL_MS, CHARGE_RANGE_MAX, CHARGE_RANGE_MIN, SHOT_MIN_RANGE, SHOT_RANGE, TICK_MS } from '../src/shared/constants';
import { GameMap, type TiledObject } from '../src/shared/map';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

const PX = 32;

/** Mapa do formato novo (1 tile = 1 metro), aberto. */
function metricMap(): GameMap {
  const spawn: TiledObject = { id: 0, name: 'spawn', x: 5 * PX, y: 5 * PX, point: true };
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

function setup(map: GameMap) {
  const clock = new FakeClock();
  const world = new World(map, { now: clock.now, random: () => 0 });
  const joined = world.join('Ana', new FakeConn());
  if (!joined.ok) throw new Error(joined.reason);
  return { world, clock, player: joined.player };
}

const lastShot = (world: World) => [...world.projectiles.values()].at(-1)!;
/** Sem sorte nos testes (random = 0): o dano rolado é sempre o menor. */
const baseDamage = (player: Player) => player.damage()[0];

describe('pedra com carga', () => {
  it('puxar 1,1 s dá o dobro do dano e a pedra vai 9,5 m; sem puxar, o dano de sempre e 6,5 m', () => {
    const { world, clock, player } = setup(metricMap());
    const base = baseDamage(player);
    world.shoot(player, 1, 0);
    expect(lastShot(world)).toMatchObject({ damage: base, range: CHARGE_RANGE_MIN });
    clock.advance(1000);
    world.charge(player);
    clock.advance(CHARGE_FULL_MS);
    world.shoot(player, 2, 0);
    expect(lastShot(world)).toMatchObject({ damage: 2 * base, range: CHARGE_RANGE_MAX });
    clock.advance(1000);
    world.charge(player);
    clock.advance(CHARGE_FULL_MS / 2); // meia carga
    world.shoot(player, 3, 0);
    expect(lastShot(world).damage).toBe(Math.round(base * 1.5));
    expect(lastShot(world).range).toBeCloseTo(8);
    clock.advance(1000);
    world.charge(player);
    clock.advance(5000); // segurar mais não passa da carga cheia
    world.shoot(player, 4, 0);
    expect(lastShot(world).damage).toBe(2 * base);
    clock.advance(1000);
    world.shoot(player, 5, 0); // o tiro solta a carga: o próximo sem puxar é fraco de novo
    expect(lastShot(world).damage).toBe(base);
  });

  it('a esquiva, um golpe recebido e o desmaio soltam a pedra sem a carga', () => {
    const { world, clock, player } = setup(metricMap());
    const base = baseDamage(player);
    world.charge(player);
    world.requestWalk(player, 1, 0, true); // esquiva
    world.tick();
    clock.advance(CHARGE_FULL_MS);
    world.shoot(player, 1, 0);
    expect(lastShot(world).damage).toBe(base);
    clock.advance(1000);
    world.charge(player);
    (world as unknown as { damage(target: Player, amount: number, by: number, now: number): void }).damage(player, 1, 0, clock.now());
    clock.advance(CHARGE_FULL_MS);
    world.shoot(player, 2, 0);
    expect(lastShot(world).damage).toBe(base);
  });

  it('no mapa antigo, o alcance continua o de sempre (o jogo antigo não puxa)', () => {
    const old = GameMap.fromTiled(tiledFromAscii(['..............', '..............'], { x: 1, y: 1 }), 'velho');
    const { world, player } = setup(old);
    world.shoot(player, 1, 0);
    expect(lastShot(world).range).toBe(SHOT_RANGE);
  });

  it('a mensagem de puxar passa pela conferência', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'charge' }))).toEqual({ t: 'charge' });
    expect(parseClientMsg(JSON.stringify({ t: 'charge', extra: 1 }))).toEqual({ t: 'charge' });
    expect(TICK_MS).toBeGreaterThan(0);
  });
});

describe('atirar andando e mirar o ponto (pedido do dono, 15/11)', () => {
  const walk = (world: World, clock: FakeClock, player: Player, slices: number, slow = false) => {
    for (let i = 0; i < slices; i++) {
      world.requestWalk(player, player.lastSeq + 1, 0, false, slow);
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  const angleOf = (world: World) => {
    const shot = lastShot(world);
    return Math.atan2(shot.dy, shot.dx);
  };

  it('o tiro cai onde foi mirado: nunca além do alcance da carga, nem mais perto que 1,5 m', () => {
    const { world, clock, player } = setup(metricMap());
    world.shoot(player, 1, 0, 4);
    expect(lastShot(world).range).toBe(4);
    clock.advance(1000);
    world.shoot(player, 2, 0, 30); // longe demais: até onde a pedra sem carga chega
    expect(lastShot(world).range).toBe(CHARGE_RANGE_MIN);
    clock.advance(1000);
    world.shoot(player, 3, 0, 0.2);
    expect(lastShot(world).range).toBe(SHOT_MIN_RANGE);
    clock.advance(1000);
    world.charge(player);
    clock.advance(CHARGE_FULL_MS);
    world.shoot(player, 4, 0, 9); // com a carga cheia, chega nos 9 m
    expect(lastShot(world).range).toBe(9);
    expect(parseClientMsg(JSON.stringify({ t: 'shoot', cid: 1, a: 0, d: 7.5 }))).toEqual({ t: 'shoot', cid: 1, a: 0, d: 7.5 });
    expect(parseClientMsg(JSON.stringify({ t: 'shoot', cid: 1, a: 0, d: -3 }))).toEqual({ t: 'shoot', cid: 1, a: 0 });
  });

  it('parado, o tiro vai certinho; correndo, espalha (até 9°); andando devagar, pouco (até 3°)', () => {
    const { world, clock, player } = setup(metricMap());
    world.shoot(player, 5, 1);
    expect(angleOf(world)).toBeCloseTo(1, 6);
    clock.advance(1000);
    walk(world, clock, player, 4);
    world.shoot(player, 6, 1);
    const run = shotSpread(6, 'run', DEFAULT_COMBAT_RULES);
    expect(Math.abs(run)).toBeGreaterThan(0);
    expect(Math.abs(run)).toBeLessThanOrEqual((9 * Math.PI) / 180);
    expect(angleOf(world)).toBeCloseTo(1 + run, 6);
    clock.advance(1000);
    walk(world, clock, player, 4, true);
    world.shoot(player, 7, 1);
    expect(angleOf(world)).toBeCloseTo(1 + shotSpread(7, 'walk', DEFAULT_COMBAT_RULES), 6);
    expect(Math.abs(shotSpread(7, 'walk', DEFAULT_COMBAT_RULES))).toBeLessThanOrEqual((3 * Math.PI) / 180);
    clock.advance(1000); // parou faz tempo: certinho de novo
    world.shoot(player, 8, 1);
    expect(angleOf(world)).toBeCloseTo(1, 6);
    // o desvio muda de tiro para tiro, para os dois lados
    const many = Array.from({ length: 40 }, (_, cid) => shotSpread(cid, 'run', DEFAULT_COMBAT_RULES));
    expect(many.some((v) => v > 0.05) && many.some((v) => v < -0.05)).toBe(true);
  });

  it('puxando, anda devagar (mesmo que o navegador peça para correr)', () => {
    const { world, clock, player } = setup(metricMap());
    const x0 = player.fx;
    walk(world, clock, player, 4);
    const running = player.fx - x0;
    world.charge(player);
    const x1 = player.fx;
    walk(world, clock, player, 4);
    const pulling = player.fx - x1;
    expect(pulling).toBeGreaterThan(0);
    expect(pulling).toBeLessThan(running * 0.6);
    expect(player.lastMoveSlow).toBe(true);
  });
});
