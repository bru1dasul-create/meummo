// A flecha que bate na árvore fica presa nela (pedido do dono, 14/11): o servidor diz onde o tiro parou (na casca do
// tronco, não 25 cm dentro) e no que bateu (o tipo do retângulo de colisão: 'tronco', 'parede'...). No fim do alcance,
// diz onde caiu. A [arte] desenha a flecha cravada.

import { describe, expect, it } from 'vitest';
import { World } from '../src/server/world';
import { advanceShot, makeShot } from '../src/shared/combat';
import { TICK_MS } from '../src/shared/constants';
import { GameMap, type TiledObject } from '../src/shared/map';
import { cornerAtFeet } from '../src/shared/movement';
import { FakeClock, FakeConn } from './helpers';

const PX = 32;

/**
 * Mapa do formato novo (1 tile = 1 metro), aberto, com um tronco alto (de cima a baixo do mapa, para o teste não
 * depender da altura do tiro) de x = 12 a 12,4 e uma parede sem tipo de x = 3 a 3,5.
 */
function forestMap(): GameMap {
  const obj = (id: number, x: number, y: number, w: number, h: number, type?: string): TiledObject => ({ id, x: x * PX, y: y * PX, width: w * PX, height: h * PX, ...(type ? { type } : {}) });
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
        { type: 'objectgroup', name: 'colisao', objects: [obj(1, 12, 0, 0.4, 12, 'tronco'), obj(2, 3, 0, 0.5, 12)] },
        { type: 'objectgroup', name: 'pontos', objects: [spawn] },
      ],
    },
    'teste',
  );
}

describe('o que segura o tiro', () => {
  it('o mapa sabe o tipo: tronco, bloco (sem tipo), borda (fora do mapa) ou nada', () => {
    const map = forestMap();
    expect(map.shotBlockerAt(12.2, 5)).toBe('tronco');
    expect(map.shotBlockerAt(3.2, 5)).toBe('bloco');
    expect(map.shotBlockerAt(8, 5)).toBeNull();
    expect(map.shotBlockerAt(40, 5)).toBe('borda');
    expect(map.blocksShotAt(12.2, 5)).toBe(true);
    expect(map.blocksShotAt(8, 5)).toBe(false);
  });

  it('o tiro para na casca do tronco (até 1 cm antes), não 25 cm dentro', () => {
    const map = forestMap();
    const shot = makeShot({ x: 8.2, y: 5 }, 0, 10, 12); // sai em x = 8,7, para o leste
    let result = 'flying';
    for (let i = 0; i < 40 && result === 'flying'; i++) result = advanceShot(shot, 0.05, map);
    expect(result).toBe('wall');
    expect(shot.x).toBeLessThanOrEqual(12);
    expect(shot.x).toBeGreaterThan(11.99);
    expect(shot.traveled).toBeCloseTo(12 - 8.7, 1);
  });
});

describe('o servidor diz onde a flecha parou', () => {
  function setup() {
    const clock = new FakeClock();
    const world = new World(forestMap(), { now: clock.now, random: () => 0 });
    const conn = new FakeConn();
    const joined = world.join('Ana', conn);
    if (!joined.ok) throw new Error(joined.reason);
    const player = joined.player;
    const corner = cornerAtFeet(8, 6);
    player.fx = corner.x;
    player.fy = corner.y;
    player.x = Math.floor(corner.x);
    player.y = Math.floor(corner.y);
    const run = (ms: number) => {
      for (let t = 0; t < ms; t += TICK_MS) {
        clock.advance(TICK_MS);
        world.tick();
      }
    };
    run(TICK_MS * 2);
    return { world, conn, player, run };
  }

  it('bateu no tronco: shot_end sem ninguém, com o ponto na casca e on = "tronco"', () => {
    const { world, conn, player, run } = setup();
    world.shoot(player, 1, 0); // para o leste, no tronco (x = 12)
    run(2000);
    const end = conn.ofType('shot_end')[0];
    expect(end).toBeDefined();
    expect(end!.hit).toBe(0);
    expect(end!.on).toBe('tronco');
    expect(end!.x).toBeGreaterThan(11.98);
    expect(end!.x).toBeLessThanOrEqual(12);
  });

  it('bateu na parede sem tipo: on = "bloco"', () => {
    const { world, conn, player, run } = setup();
    world.shoot(player, 1, Math.PI); // para o oeste, na parede (x = 3,5)
    run(2000);
    const end = conn.ofType('shot_end')[0];
    expect(end?.on).toBe('bloco');
    expect(end!.x).toBeGreaterThanOrEqual(3.5);
    expect(end!.x).toBeLessThan(3.52);
  });

  it('não bateu em nada: diz onde caiu, no fim do alcance (sem on)', () => {
    const { world, conn, player, run } = setup();
    const shot = conn.ofType('shot').length;
    world.shoot(player, 1, Math.PI / 2); // para o sul, sem nada no caminho... até a borda (o mapa tem 12 m)
    run(2000);
    const sent = conn.ofType('shot')[shot]!;
    const end = conn.ofType('shot_end')[0]!;
    expect(end.hit).toBe(0);
    if (end.on === undefined) {
      // caiu no fim do alcance: a distância do começo é o alcance
      expect(Math.hypot(end.x! - sent.x, end.y! - sent.y)).toBeCloseTo(sent.range, 1);
    } else {
      expect(end.on).toBe('borda');
    }
  });
});
