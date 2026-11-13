// Pedra com carga (combate passo 2, revisão 17 do protótipo): segurar puxa o estilingue, soltar atira. O servidor
// conta o tempo pelo relógio dele (do `charge` até o `shoot`); a esquiva, um golpe recebido e o desmaio soltam a pedra.

import { describe, expect, it } from 'vitest';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { CHARGE_FULL_MS, CHARGE_RANGE_MAX, CHARGE_RANGE_MIN, SHOT_RANGE, TICK_MS } from '../src/shared/constants';
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
