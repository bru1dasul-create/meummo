// Mapa 01 do mundo novo (Parque Santo Dias e Vila do Capão), no formato combinado com a [estrutura]: tudo em
// camadas de objetos, 1 tile = 1 metro, colisão tirada do cenário. Etapa 3: só a clareira é andável.

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface TiledObject {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  ellipse?: boolean;
  properties?: { name: string; value: string | number | boolean }[];
}
interface Layer {
  name: string;
  type: string;
  objects: TiledObject[];
}
const FILE = 'public/assets/maps-iso/capao.tmj';
const map = JSON.parse(readFileSync(FILE, 'utf8')) as { width: number; height: number; tilewidth: number; tileheight: number; layers: Layer[] };
const M = map.tilewidth; // pixels por metro
const layer = (name: string) => map.layers.find((l) => l.name === name)!.objects;
const prop = (o: TiledObject, name: string) => o.properties?.find((p) => p.name === name)?.value;

/** Retângulos em metros. */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  type: string;
}
const boxes: Box[] = layer('colisao').map((o) => ({ x0: o.x / M, y0: o.y / M, x1: (o.x + o.width) / M, y1: (o.y + o.height) / M, type: o.type }));
const spawn = layer('pontos').find((o) => o.name === 'spawn')!;
const SPAWN = { x: spawn.x / M, y: spawn.y / M };
/** O pé do personagem novo (movimento livre): uma caixa de 0,6 × 0,4 m. */
const FOOT = { w: 0.6, h: 0.4 };
const footFree = (x: number, y: number) =>
  !boxes.some((b) => x - FOOT.w / 2 < b.x1 && x + FOOT.w / 2 > b.x0 && y - FOOT.h / 2 < b.y1 && y + FOOT.h / 2 > b.y0);

/** Por onde o pé consegue ir a partir do nascimento (grade de 0,2 m em volta da clareira). */
function reachable(): { cells: Set<string>; step: number } {
  const step = 0.2;
  const key = (i: number, j: number) => `${i},${j}`;
  const cells = new Set<string>();
  const start = [Math.round(SPAWN.x / step), Math.round(SPAWN.y / step)] as const;
  const queue: (readonly [number, number])[] = [start];
  cells.add(key(...start));
  while (queue.length > 0) {
    const [i, j] = queue.pop()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const [ni, nj] = [i + di, j + dj];
      const k = key(ni, nj);
      if (cells.has(k)) continue;
      const [x, y] = [ni * step, nj * step];
      if (x < 0 || y < 0 || x > map.width || y > map.height || !footFree(x, y)) continue;
      cells.add(k);
      queue.push([ni, nj]);
    }
  }
  return { cells, step };
}

describe('Mapa 01 (Capão): formato do mapa novo', () => {
  it('fica fora da pasta que o servidor de hoje carrega (ele ainda exige tile de 16 px)', () => {
    expect(existsSync('public/assets/maps/capao.tmj')).toBe(false);
  });

  it('tem 96 × 80 metros, tile de 32 px e as camadas combinadas', () => {
    expect([map.width, map.height, map.tilewidth, map.tileheight]).toEqual([96, 80, 32, 32]);
    expect(map.layers.map((l) => l.name)).toEqual(['chao', 'cenario', 'colisao', 'seguro', 'areas', 'pontos']);
    expect(map.layers.every((l) => l.type === 'objectgroup')).toBe(true);
  });

  it('cada coisa sólida do cenário tem a sua colisão (tronco, poste, pedra, gradil, portão, pilar, mata fechada)', () => {
    const covered = (x: number, y: number) => boxes.some((b) => x >= b.x0 - 1e-6 && x <= b.x1 + 1e-6 && y >= b.y0 - 1e-6 && y <= b.y1 + 1e-6);
    for (const o of layer('cenario')) {
      const [x, y] = o.point ? [o.x / M, o.y / M] : [(o.x + o.width / 2) / M, (o.y + o.height / 2) / M];
      const solid = ['arvore', 'poste', 'pedra', 'gradil', 'portao', 'pilar'].includes(o.type) || (o.type === 'arbusto' && prop(o, 'fechado') === true);
      if (solid) expect(covered(x, y), `${o.type} em (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
    }
    // o tronco tem o tamanho do tronco, não o da copa
    const fig = layer('cenario').find((o) => prop(o, 'especie') === 'figueira')!;
    const figBox = boxes.find((b) => b.type === 'tronco' && Math.abs((b.x0 + b.x1) / 2 - fig.x / M) < 0.01)!;
    expect(figBox.x1 - figBox.x0).toBeCloseTo(Number(prop(fig, 'tronco')));
    // a pedrinha passa pela grade do gradil e do portão
    for (const o of layer('colisao').filter((c) => c.type === 'gradil' || c.type === 'portao')) expect(prop(o, 'bloqueiaTiro')).toBe(false);
  });

  it('entre dois troncos sobra pelo menos 1,2 m (o pé passa)', () => {
    const trees = layer('cenario')
      .filter((o) => o.type === 'arvore')
      .map((o) => ({ x: o.x / M, y: o.y / M, t: Number(prop(o, 'tronco')) }));
    for (let i = 0; i < trees.length; i++) {
      for (let j = i + 1; j < trees.length; j++) {
        const [a, b] = [trees[i]!, trees[j]!];
        expect(Math.hypot(a.x - b.x, a.y - b.y) - (a.t + b.t) / 2).toBeGreaterThanOrEqual(1.2);
      }
    }
  });

  it('nasce no meio do círculo ancestral, numa zona segura, com o círculo livre', () => {
    const circle = layer('chao').find((o) => o.type === 'circulo')!;
    const r = circle.width / 2 / M;
    expect(SPAWN.x).toBeCloseTo((circle.x + circle.width / 2) / M);
    expect(SPAWN.y).toBeCloseTo((circle.y + circle.height / 2) / M);
    const safe = layer('seguro').some((o) => SPAWN.x >= o.x / M && SPAWN.x <= (o.x + o.width) / M && SPAWN.y >= o.y / M && SPAWN.y <= (o.y + o.height) / M);
    expect(safe).toBe(true);
    for (let a = 0; a < 360; a += 15) {
      for (const d of [0, r / 2, r - 0.3]) expect(footFree(SPAWN.x + Math.cos((a * Math.PI) / 180) * d, SPAWN.y + Math.sin((a * Math.PI) / 180) * d)).toBe(true);
    }
  });

  it('a trilha até o Portão I tem pelo menos 1,5 m livre de largura', () => {
    // do círculo até 1 m antes do portão (que está fechado nesta etapa)
    for (let x = SPAWN.x; x <= 47; x += 0.25) {
      const y = SPAWN.y + ((x - SPAWN.x) / (48 - SPAWN.x)) * (44 - SPAWN.y);
      for (const off of [-0.75 + FOOT.h / 2, 0, 0.75 - FOOT.h / 2]) expect(footFree(x, y + off), `(${x}, ${y + off})`).toBe(true);
    }
  });

  it('etapa 3: dá para andar do círculo até o portão, e a mata fechada não deixa sair da clareira', () => {
    const { cells, step } = reachable();
    const reach = (x: number, y: number) => cells.has(`${Math.round(x / step)},${Math.round(y / step)}`);
    expect(reach(47.4, 44)).toBe(true); // encostado no portão
    let far = 0;
    for (const k of cells) {
      const [i, j] = k.split(',').map(Number) as [number, number];
      far = Math.max(far, Math.hypot(i * step - SPAWN.x, j * step - SPAWN.y));
    }
    expect(far).toBeGreaterThan(9); // anda pela clareira e um pouco da mata em volta
    expect(far).toBeLessThan(15); // mas não passa do anel de mata fechada (a vila e o resto vêm na etapa 4)
  });
});
