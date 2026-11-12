// Mapa 01 do mundo novo (Parque Santo Dias e Vila do Capão), no formato combinado com a [estrutura]: tudo em
// camadas de objetos, 1 tile = 1 metro, colisão tirada do cenário. Etapa 4a: a mata do parque e o lago abertos; o
// Portão I continua fechado (a vila entra na 4b).

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GameMap, type TiledMap } from '../src/shared/map';
import { bodyFits, cornerAtFeet } from '../src/shared/movement';

interface TiledObject {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  ellipse?: boolean;
  polygon?: { x: number; y: number }[];
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
const at = (o: TiledObject) => (o.point ? { x: o.x / M, y: o.y / M } : { x: (o.x + o.width / 2) / M, y: (o.y + o.height / 2) / M });

/** Retângulos em metros. */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  type: string;
}
const boxes: Box[] = layer('colisao').map((o) => ({ x0: o.x / M, y0: o.y / M, x1: (o.x + o.width) / M, y1: (o.y + o.height) / M, type: o.type }));
/** Os retângulos guardados por quadrado de 2 m (para conferir rápido onde o pé cabe). */
const BUCKET = 2;
const buckets = new Map<string, Box[]>();
for (const b of boxes) {
  for (let i = Math.floor(b.x0 / BUCKET); i <= Math.floor(b.x1 / BUCKET); i++) {
    for (let j = Math.floor(b.y0 / BUCKET); j <= Math.floor(b.y1 / BUCKET); j++) {
      const k = `${i},${j}`;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(b);
    }
  }
}
const spawn = layer('pontos').find((o) => o.name === 'spawn')!;
const SPAWN = { x: spawn.x / M, y: spawn.y / M };
/** O pé do personagem novo (movimento livre): uma caixa de 0,6 × 0,4 m. */
const FOOT = { w: 0.6, h: 0.4 };
function footFree(x: number, y: number): boolean {
  const [x0, x1, y0, y1] = [x - FOOT.w / 2, x + FOOT.w / 2, y - FOOT.h / 2, y + FOOT.h / 2];
  for (let i = Math.floor(x0 / BUCKET); i <= Math.floor(x1 / BUCKET); i++) {
    for (let j = Math.floor(y0 / BUCKET); j <= Math.floor(y1 / BUCKET); j++) {
      for (const b of buckets.get(`${i},${j}`) ?? []) if (x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0) return false;
    }
  }
  return true;
}

/** Por onde o pé consegue ir a partir do nascimento (grade de 0,25 m no mapa inteiro). */
const STEP = 0.25;
const reached = (() => {
  const cols = Math.round(map.width / STEP);
  const rows = Math.round(map.height / STEP);
  const seen = new Uint8Array(cols * rows);
  const start = [Math.round(SPAWN.x / STEP), Math.round(SPAWN.y / STEP)] as const;
  const queue: number[] = [start[1] * cols + start[0]];
  seen[queue[0]!] = 1;
  while (queue.length > 0) {
    const cell = queue.pop()!;
    const [i, j] = [cell % cols, Math.floor(cell / cols)];
    for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as const) {
      if (ni < 2 || nj < 2 || ni >= cols - 2 || nj >= rows - 2) continue;
      const k = nj * cols + ni;
      if (seen[k] || !footFree(ni * STEP, nj * STEP)) continue;
      seen[k] = 1;
      queue.push(k);
    }
  }
  return { seen, cols };
})();
const reach = (x: number, y: number) => reached.seen[Math.round(y / STEP) * reached.cols + Math.round(x / STEP)] === 1;
/** Algum ponto alcançável a até `r` metros de (x, y)? */
const reachNear = (x: number, y: number, r: number) => {
  for (let dx = -r; dx <= r; dx += STEP) for (let dy = -r; dy <= r; dy += STEP) if (Math.hypot(dx, dy) <= r && reach(x + dx, y + dy)) return true;
  return false;
};
const inPolygon = (x: number, y: number, o: TiledObject) => {
  const pts = o.polygon!.map((p) => [(o.x + p.x) / M, (o.y + p.y) / M] as const);
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

describe('Mapa 01 (Capão): formato do mapa novo', () => {
  it('fica na pasta do mundo novo (maps-iso), separado dos mapas do jogo antigo (maps)', () => {
    expect(existsSync('public/assets/maps/capao.tmj')).toBe(false);
  });

  it('o lugar do Curupira (42,5; 44,5), ao lado do círculo, é livre e dá para chegar a pé', () => {
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'capao');
    const corner = cornerAtFeet(42.5, 44.5);
    expect(bodyFits(game, corner.x, corner.y)).toBe(true);
    expect(game.isReachable(42, 44)).toBe(true);
    expect(footFree(42.5, 44.5)).toBe(true);
  });

  it('tem 96 × 80 metros, tile de 32 px e as camadas combinadas', () => {
    expect([map.width, map.height, map.tilewidth, map.tileheight]).toEqual([96, 80, 32, 32]);
    expect(map.layers.map((l) => l.name)).toEqual(['chao', 'cenario', 'colisao', 'seguro', 'areas', 'pontos', 'monstros']);
    expect(map.layers.every((l) => l.type === 'objectgroup')).toBe(true);
  });

  it('cada coisa sólida do cenário tem a sua colisão (tronco, poste, pedra, gradil, portão, pilar, tronco caído, mata fechada)', () => {
    const covered = (x: number, y: number) => boxes.some((b) => x >= b.x0 - 1e-6 && x <= b.x1 + 1e-6 && y >= b.y0 - 1e-6 && y <= b.y1 + 1e-6);
    for (const o of layer('cenario')) {
      const { x, y } = at(o);
      const solid = ['arvore', 'poste', 'pedra', 'gradil', 'portao', 'pilar', 'tronco-caido'].includes(o.type) || (o.type === 'arbusto' && prop(o, 'fechado') === true);
      if (solid) expect(covered(x, y), `${o.type} em (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
      // capivara e aguapé são só enfeite: não seguram ninguém
      if (o.type === 'capivara') expect(boxes.some((b) => b.type !== 'agua' && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1)).toBe(false);
    }
    // o tronco tem o tamanho do tronco, não o da copa
    const fig = layer('cenario').find((o) => prop(o, 'especie') === 'figueira')!;
    const figBox = boxes.find((b) => b.type === 'tronco' && Math.abs((b.x0 + b.x1) / 2 - fig.x / M) < 0.01)!;
    expect(figBox.x1 - figBox.x0).toBeCloseTo(Number(prop(fig, 'tronco')));
    // a pedrinha passa pela grade do gradil e do portão, e por cima da água
    for (const o of layer('colisao').filter((c) => ['gradil', 'portao', 'agua'].includes(c.type))) expect(prop(o, 'bloqueiaTiro')).toBe(false);
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
    // do círculo até 1 m antes do portão (que está fechado até a etapa 4b)
    for (let x = SPAWN.x; x <= 47; x += 0.25) {
      const y = SPAWN.y + ((x - SPAWN.x) / (48 - SPAWN.x)) * (44 - SPAWN.y);
      for (const off of [-0.75 + FOOT.h / 2, 0, 0.75 - FOOT.h / 2]) expect(footFree(x, y + off), `(${x}, ${y + off})`).toBe(true);
    }
  });
});

describe('Mapa 01 (Capão), etapa 4a: a mata e o lago', () => {
  it('dá para andar pela mata toda e pela trilha do lago, mas não entrar na água nem passar do portão', () => {
    expect(reach(47.25, 44)).toBe(true); // encostado no portão
    // os cantos da trilha que dá a volta no lago
    for (const [x, y] of [[31, 32], [27, 14], [16, 9], [6, 16], [5, 34], [12, 46], [22, 58], [31, 52]] as const) {
      expect(reachNear(x, y, 0.5), `trilha em (${x}, ${y})`).toBe(true);
    }
    expect(reach(16, 23)).toBe(false); // meio do lago
    for (let y = 2; y < map.height - 2; y += 0.5) for (const x of [48.5, 60, 90]) expect(reach(x, y), `(${x}, ${y})`).toBe(false);
  });

  it('o lago: água em faixas que o pé não atravessa, aguapés na água, capivaras na beira e nada plantado dentro', () => {
    const water = layer('chao').find((o) => o.type === 'agua')!;
    expect(water.polygon!.length).toBeGreaterThan(10);
    expect(boxes.filter((b) => b.type === 'agua').length).toBeGreaterThan(20);
    for (const o of layer('cenario')) {
      const { x, y } = at(o);
      if (o.type === 'aguape') expect(inPolygon(x, y, water), `aguapé em (${x}, ${y})`).toBe(true);
      else if (['arvore', 'arbusto', 'pedra', 'tronco-caido', 'capivara'].includes(o.type)) expect(inPolygon(x, y, water), `${o.type} em (${x}, ${y})`).toBe(false);
    }
    expect(layer('cenario').filter((o) => o.type === 'aguape').length).toBeGreaterThanOrEqual(8);
    expect(layer('cenario').filter((o) => o.type === 'capivara').length).toBe(3);
  });

  it('a pedra do Véu (mata profunda) e a beira do lago têm brilho e dá para chegar perto', () => {
    const stone = layer('cenario').find((o) => o.type === 'pedra' && prop(o, 'ancestral') === true)!;
    const { x, y } = at(stone);
    expect(layer('cenario').some((o) => o.type === 'veu' && Math.hypot(at(o).x - x, at(o).y - y) < 0.01)).toBe(true);
    expect(reachNear(x, y, 2.6)).toBe(true);
    expect(layer('cenario').filter((o) => o.type === 'veu').length).toBe(4); // círculo, figueira, lago e a pedra
  });

  it('as criaturas (saguis encantados e jararacas) moram em lugar alcançável, fora das zonas seguras', () => {
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'capao');
    const zones = layer('monstros');
    expect(zones.map((z) => [z.name, prop(z, 'quantidade')])).toEqual([
      ['sagui', 4],
      ['jararaca', 3],
    ]);
    for (const z of zones) {
      const [x0, y0, x1, y1] = [z.x / M, z.y / M, (z.x + z.width) / M, (z.y + z.height) / M];
      expect(x1 <= 48, z.name).toBe(true); // dentro do parque
      for (const s of layer('seguro')) {
        const [sx0, sy0, sx1, sy1] = [s.x / M, s.y / M, (s.x + s.width) / M, (s.y + s.height) / M];
        expect(x0 < sx1 && x1 > sx0 && y0 < sy1 && y1 > sy0, `${z.name} encosta em ${s.name}`).toBe(false);
      }
      let tiles = 0;
      for (let y = Math.ceil(y0); y < y1; y++) for (let x = Math.ceil(x0); x < x1; x++) if (game.isReachable(x, y)) tiles++;
      expect(tiles, z.name).toBeGreaterThan(40);
    }
  });

  it('a mata profunda (noroeste e sudoeste) está marcada com neblina, e o lago tem o nome dele', () => {
    const names = layer('areas').map((a) => a.name);
    expect(names).toEqual(expect.arrayContaining(['Clareira dos Despertos', 'Mata do Parque Santo Dias', 'Lago do Parque', 'Mata Profunda', 'Vila do Capão']));
    const deep = layer('areas').filter((a) => a.name === 'Mata Profunda');
    expect(deep).toHaveLength(2);
    for (const d of deep) expect(Number(prop(d, 'neblina'))).toBeGreaterThan(0);
  });
});
