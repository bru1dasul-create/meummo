// "Andar até" no movimento livre: a rota pelo tamanho exato do pé (src/shared/route.ts).
// O caso que o [mundo] achou na etapa 4b: a rota de tile em tile raspava num poste de 0,3 m e travava, e
// depois de travar o toque seguinte também não andava.

import { describe, expect, it } from 'vitest';
import { DOWN, type Dir } from '../src/shared/dir';
import { GameMap, type TiledObject } from '../src/shared/map';
import { bodyFits, footCenter, walkSlice } from '../src/shared/movement';
import { findRoute, followRoute, lineClear } from '../src/shared/route';

const PX = 32; // pixels por metro no Tiled
const RUN = 0.225; // um pedaço correndo (4,5 m/s × 50 ms)

/** Retângulo de colisão em metros. */
const solid = (x: number, y: number, w: number, h: number): TiledObject => ({ id: 0, x: x * PX, y: y * PX, width: w * PX, height: h * PX });

function mapWith(solids: TiledObject[], width = 30, height = 20): GameMap {
  return GameMap.fromTiled(
    {
      width,
      height,
      tilewidth: PX,
      tileheight: PX,
      orientation: 'orthogonal',
      properties: [{ name: 'nome', type: 'string', value: 'Teste' }],
      tilesets: [],
      layers: [
        { type: 'objectgroup', name: 'colisao', objects: solids },
        { type: 'objectgroup', name: 'pontos', objects: [{ id: 0, name: 'spawn', x: 2 * PX, y: 2 * PX, point: true }] },
      ],
    },
    'teste',
  );
}

/** Posição "de canto" de quem tem o centro do pé em (cx, cy). */
const at = (cx: number, cy: number) => {
  const c = footCenter(0, 0);
  return { x: cx - c.x, y: cy - c.y };
};

/** Anda pela rota como o navegador faz (um pedaço por vez), contando os pedaços em que não saiu do lugar. */
function walk(map: GameMap, from: { x: number; y: number }, to: { x: number; y: number }, piece = RUN) {
  const found = findRoute(map, from, to);
  expect(found).not.toBeNull();
  const route = [...found!.points];
  let pose: { x: number; y: number; dir: Dir } = { ...from, dir: DOWN };
  let slices = 0;
  let stuck = 0;
  for (;;) {
    const degrees = followRoute(map, pose, route, piece);
    if (degrees === null) break;
    const next = walkSlice(map, pose, degrees, piece);
    if (!next.moved) stuck += 1;
    pose = { x: next.x, y: next.y, dir: next.dir };
    slices += 1;
    if (slices > 3000) break;
  }
  return { pose, slices, stuck, exact: found!.exact, end: found!.points.at(-1)! };
}

describe('rota do "andar até" pelo tamanho do pé', () => {
  it('vai reto quando nada atrapalha', () => {
    const map = mapWith([]);
    const route = findRoute(map, at(3, 3), at(12, 9));
    expect(route).toEqual({ points: [at(12, 9)], exact: true });
  });

  it('contorna um poste fino que está bem no caminho, sem travar', () => {
    const map = mapWith([solid(10, 5, 0.3, 0.3)]);
    const from = at(5, 5.15);
    const to = at(15, 5.15);
    expect(lineClear(map, from, to, 0)).toBe(false); // a reta bate de frente no poste
    const { pose, stuck, slices } = walk(map, from, to);
    expect(stuck).toBe(0);
    expect(Math.hypot(pose.x - to.x, pose.y - to.y)).toBeLessThan(0.13);
    expect(slices).toBeLessThan(60); // ~10 m de caminho: uns 45 pedaços, sem volta grande
  });

  it('encostado no poste (depois de bater nele), o próximo toque anda', () => {
    const map = mapWith([solid(10, 5, 0.3, 0.3)]);
    const touching = at(10 - 0.3 - 1e-6, 5.15); // a caixa do pé encostada na face esquerda do poste
    expect(bodyFits(map, touching.x, touching.y)).toBe(true);
    const to = at(15, 5.15);
    const { pose, stuck } = walk(map, touching, to);
    expect(stuck).toBe(0);
    expect(Math.hypot(pose.x - to.x, pose.y - to.y)).toBeLessThan(0.13);
  });

  it('entra na roda de bancos pela entrada de 1,55 m e chega perto da fogueira', () => {
    // roda quadrada de 5 m em volta de (20, 10): bancos de 0,5 m com uma entrada de 1,55 m no meio de cada lado
    const side = (5 - 1.55) / 2;
    const map = mapWith([
      solid(17.5, 7.5, side, 0.5), solid(22.5 - side, 7.5, side, 0.5), // em cima
      solid(17.5, 12, side, 0.5), solid(22.5 - side, 12, side, 0.5), // embaixo
      solid(17.5, 7.5, 0.5, side), solid(17.5, 12.5 - side, 0.5, side), // esquerda
      solid(22, 7.5, 0.5, side), solid(22, 12.5 - side, 0.5, side), // direita
      solid(19.6, 9.6, 0.8, 0.8), // a fogueira
    ]);
    const to = at(21.2, 9);
    expect(bodyFits(map, to.x, to.y)).toBe(true);
    for (const from of [at(26, 4), at(14, 15), at(20, 2)]) {
      const { pose, stuck } = walk(map, from, to);
      expect(stuck).toBe(0);
      expect(Math.hypot(pose.x - to.x, pose.y - to.y)).toBeLessThan(0.13);
    }
  });

  it('tocou numa casa: vai até o lugar livre mais perto dela', () => {
    const map = mapWith([solid(5, 10, 5, 4)]);
    const { pose, stuck, exact, end } = walk(map, at(15, 5), at(7.5, 12));
    expect(exact).toBe(false);
    expect(stuck).toBe(0);
    expect(bodyFits(map, end.x, end.y)).toBe(true);
    expect(Math.hypot(pose.x - end.x, pose.y - end.y)).toBeLessThan(0.13);
    const c = footCenter(pose.x, pose.y);
    expect(c.y).toBeLessThan(10); // ficou do lado de cima da casa, encostado (o mais perto de onde tocou)
    expect(c.y).toBeGreaterThan(9.5);
  });

  it('lugar fechado: diz que não dá, sem demorar', () => {
    const map = mapWith([solid(12, 6, 6, 0.5), solid(12, 11.5, 6, 0.5), solid(12, 6, 0.5, 6), solid(17.5, 6, 0.5, 6)]);
    const t0 = performance.now();
    expect(findRoute(map, at(3, 3), at(15, 9))).toBeNull();
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('mapa grande cheio de postes: acha o caminho rápido', () => {
    const posts: TiledObject[] = [];
    for (let y = 3; y < 78; y += 2.5) for (let x = 3; x < 94; x += 2.5) posts.push(solid(x + (y % 5 === 0.5 ? 1 : 0), y, 0.3, 0.3));
    const map = mapWith(posts, 96, 80);
    const t0 = performance.now();
    const { pose, stuck } = walk(map, at(1.5, 1.5), at(93, 77));
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(stuck).toBe(0);
    expect(Math.hypot(pose.x - at(93, 77).x, pose.y - at(93, 77).y)).toBeLessThan(0.13);
  });
});
