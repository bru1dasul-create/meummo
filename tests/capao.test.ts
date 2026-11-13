// Mapa 01 do mundo novo (Parque Santo Dias e Vila do Capão), no formato combinado com a [estrutura]: tudo em
// camadas de objetos, 1 tile = 1 metro, colisão tirada do cenário. A mata nova do parque (13/11: 48 × 120 m, menos
// árvores, trilhas sem copa por cima, plantas variadas, mais sombria) e o Portão I aberto para a Vila do Capão (4b).

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
  polyline?: { x: number; y: number }[];
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

  it('tem 96 × 120 metros (o parque cresceu para o sul), tile de 32 px e as camadas combinadas', () => {
    expect([map.width, map.height, map.tilewidth, map.tileheight]).toEqual([96, 120, 32, 32]);
    // a camada "monstros" só aparece quando as criaturas estão ligadas no gerador (CREATURES)
    expect(map.layers.map((l) => l.name).filter((n) => n !== 'monstros')).toEqual(['chao', 'cenario', 'colisao', 'seguro', 'areas', 'pontos', 'saidas']);
    expect(map.layers.every((l) => l.type === 'objectgroup')).toBe(true);
  });

  it('cada coisa sólida do cenário tem a sua colisão (tronco, poste, pedra, gradil, pilar, mata fechada, casa, banco...)', () => {
    const covered = (x: number, y: number) => boxes.some((b) => x >= b.x0 - 1e-6 && x <= b.x1 + 1e-6 && y >= b.y0 - 1e-6 && y <= b.y1 + 1e-6);
    const SOLID = ['arvore', 'bambu', 'poste', 'pedra', 'gradil', 'pilar', 'tronco-caido', 'casa', 'carro', 'banco', 'mesa', 'fogueira', 'lixeira', 'orelhao', 'poste-praca', 'predio', 'moto', 'placa-rua', 'cadeira', 'vaso', 'lixo'];
    for (const o of layer('cenario')) {
      const { x, y } = at(o);
      const solid = SOLID.includes(o.type) || (o.type === 'portao' && prop(o, 'aberto') !== true) || (o.type === 'arbusto' && prop(o, 'fechado') === true);
      if (solid) expect(covered(x, y), `${o.type} em (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
      // capivara e aguapé são só enfeite: não seguram ninguém
      if (o.type === 'capivara') expect(boxes.some((b) => b.type !== 'agua' && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1)).toBe(false);
    }
    // o tronco tem o tamanho do tronco, não o da copa
    const fig = layer('cenario').find((o) => prop(o, 'especie') === 'figueira')!;
    const figBox = boxes.find((b) => b.type === 'tronco' && Math.abs((b.x0 + b.x1) / 2 - fig.x / M) < 0.01)!;
    expect(figBox.x1 - figBox.x0).toBeCloseTo(Number(prop(fig, 'tronco')));
    // a pedrinha passa pela grade do gradil e do portão, por cima da água e do que é baixo ou fino na praça
    const LOW = ['gradil', 'portao', 'agua', 'banco', 'mesa', 'fogueira', 'lixeira', 'orelhao'];
    for (const o of layer('colisao').filter((c) => LOW.includes(c.type))) expect(prop(o, 'bloqueiaTiro'), o.type).toBe(false);
    // casa e carro seguram a pedrinha (sem `bloqueiaTiro`, vale o padrão: bloqueia)
    for (const o of layer('colisao').filter((c) => c.type === 'casa' || c.type === 'carro')) expect(prop(o, 'bloqueiaTiro'), o.type).toBeUndefined();
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

  it('o caminho do círculo até a vila (trilha, Portão I e faixa da Travessa) tem pelo menos 1,5 m livre de largura', () => {
    for (let x = SPAWN.x; x <= 56; x += 0.25) {
      const y = x < 48 ? SPAWN.y + ((x - SPAWN.x) / (48 - SPAWN.x)) * (44 - SPAWN.y) : 44;
      for (const off of [-0.75 + FOOT.h / 2, 0, 0.75 - FOOT.h / 2]) expect(footFree(x, y + off), `(${x}, ${y + off})`).toBe(true);
    }
  });
});

describe('Mapa 01 (Capão): a mata nova (pedido do dono, 13/11)', () => {
  const cenario = layer('cenario');
  const inPark = (o: TiledObject) => o.x / M < 48;
  const pts = (o: TiledObject) => (o.polyline ?? o.polygon)!.map((p) => [(o.x + p.x) / M, (o.y + p.y) / M] as [number, number]);
  const segDist = (x: number, y: number, [ax, ay]: [number, number], [bx, by]: [number, number]) => {
    const [dx, dy] = [bx - ax, by - ay];
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  };
  const pathDist = (x: number, y: number, p: [number, number][]) => Math.min(...p.slice(1).map((b, i) => segDist(x, y, p[i]!, b)));
  const trails = layer('chao').filter((o) => o.type === 'trilha' && o.polyline);
  const lake = layer('chao').find((o) => o.type === 'agua' && o.polygon)!;
  const stream = layer('chao').find((o) => o.type === 'agua' && o.polyline)!;
  /** Os pontos que a câmera precisa ver: todas as trilhas (meio e beiradas, a cada metro) e o lago. */
  const keys: [number, number][] = [];
  for (const t of trails) {
    const p = pts(t);
    const half = Number(prop(t, 'largura')) / 2;
    for (let i = 0; i + 1 < p.length; i++) {
      const [[ax, ay], [bx, by]] = [p[i]!, p[i + 1]!];
      const len = Math.hypot(bx - ax, by - ay);
      const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
      for (let d = 0; d <= len; d += 1) for (const o of [0, half, -half]) keys.push([ax + ((bx - ax) * d) / len + nx * o, ay + ((by - ay) * d) / len + ny * o]);
    }
  }
  for (let x = 0; x < 48; x += 1) for (let y = 0; y < map.height; y += 1) if (inPolygon(x, y, lake)) keys.push([x, y]);

  it('o parque cresceu para o sul (48 × 120 m) e o pedaço ao sul da vila é mata fechada, onde ninguém chega', () => {
    expect(map.height).toBe(120);
    expect(reachNear(30, 112, 2)).toBe(true); // o fundo do parque
    expect(reach(70, 100)).toBe(false); // a mata fechada ao sul da vila
  });

  it('dá para andar por todas as trilhas, mas não entrar no lago nem no riacho', () => {
    for (const t of trails) for (const [x, y] of pts(t)) expect(reachNear(x, y, 0.6), `trilha em (${x}, ${y})`).toBe(true);
    const lp = pts(lake);
    expect(reach(lp.reduce((a, p) => a + p[0], 0) / lp.length, lp.reduce((a, p) => a + p[1], 0) / lp.length)).toBe(false); // meio do lago
    for (const [x, y] of pts(stream).slice(1, -1)) expect(reach(x, y), `riacho em (${x}, ${y})`).toBe(false);
  });

  it('nenhuma copa tampa as trilhas ou o lago, nem vista da câmera nem de cima (a figueira só cobre a clareira dela)', () => {
    const screen = (x: number, y: number, z = 0) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2 * 0.5 - z * 0.866] as const;
    const tall = cenario.filter((o) => inPark(o) && (o.type === 'arvore' || o.type === 'bambu'));
    const bad: string[] = [];
    for (const o of tall) {
      const { x, y } = at(o);
      const fig = prop(o, 'especie') === 'figueira';
      const copa = o.type === 'bambu' ? Number(prop(o, 'raio')) * 1.3 : Number(prop(o, 'copa'));
      const [cx, cy] = screen(x, y, Number(prop(o, 'altura')));
      for (const [kx, ky] of keys) {
        if ((fig && Math.hypot(kx - 37, ky - 43) <= 9.01) || kx + ky >= x + y) continue; // só cobre o que está atrás dela
        const [sx, sy] = screen(kx, ky);
        if (Math.hypot(sx - cx, sy - cy) < copa * 1.05) bad.push(`${o.type} ${prop(o, 'especie') ?? ''} em (${x}, ${y}) tampa (${kx.toFixed(1)}, ${ky.toFixed(1)})`);
      }
      // de cima: a copa não fica por cima da trilha (a figueira, colada no círculo, é a exceção)
      if (o.type === 'arvore' && !fig) {
        const gap = Math.min(...trails.map((t) => pathDist(x, y, pts(t)) - Number(prop(t, 'largura')) / 2));
        if (gap < copa - 0.05) bad.push(`copa de ${prop(o, 'especie')} em (${x}, ${y}) por cima da trilha`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('a mata ficou mais aberta: no parque, no máximo uma árvore grande a cada 40 m²', () => {
    const big = cenario.filter((o) => inPark(o) && o.type === 'arvore' && Number(prop(o, 'copa')) >= 1.7 && prop(o, 'especie') !== 'figueira');
    expect(big.length).toBeLessThanOrEqual((48 * 120) / 40);
  });

  it('as plantas novas estão lá, os ipês de cor forte saíram, e a mata é mais sombria (mais ainda na mata profunda)', () => {
    const species = (s: string) => cenario.filter((o) => o.type === 'arvore' && prop(o, 'especie') === s).length;
    for (const s of ['jeriva', 'embauba', 'xaxim', 'bananeira', 'seca']) expect(species(s), s).toBeGreaterThan(3);
    const plants = (t: string) => cenario.filter((o) => o.type === 'planta' && prop(o, 'tipo') === t).length;
    for (const t of ['samambaia', 'heliconia', 'taboa', 'cogumelo']) expect(plants(t), t).toBeGreaterThan(5);
    expect(cenario.filter((o) => o.type === 'bambu').length).toBeGreaterThan(5);
    expect(species('ipe-amarelo') + species('ipe-roxo')).toBe(0);
    const park = layer('areas').find((a) => a.name === 'Mata do Parque Santo Dias')!;
    expect(Number(prop(park, 'escuro'))).toBeGreaterThan(0);
    for (const d of layer('areas').filter((a) => a.name === 'Mata Profunda')) expect(Number(prop(d, 'escuro'))).toBeGreaterThan(Number(prop(park, 'escuro')));
  });

  it('o lago: água em faixas que o pé não atravessa, aguapés e taboas na água, capivaras na beira e nada plantado dentro', () => {
    expect(lake.polygon!.length).toBeGreaterThan(10);
    expect(boxes.filter((b) => b.type === 'agua').length).toBeGreaterThan(20);
    const nearWater = (x: number, y: number) => boxes.some((b) => b.type === 'agua' && x >= b.x0 - 0.3 && x <= b.x1 + 0.3 && y >= b.y0 - 0.3 && y <= b.y1 + 0.3);
    for (const o of cenario) {
      const { x, y } = at(o);
      if (o.type === 'aguape') expect(inPolygon(x, y, lake), `aguapé em (${x}, ${y})`).toBe(true);
      else if (o.type === 'planta' && prop(o, 'tipo') === 'taboa') expect(nearWater(x, y), `taboa em (${x}, ${y})`).toBe(true);
      else if (['arvore', 'bambu', 'arbusto', 'pedra', 'tronco-caido', 'capivara'].includes(o.type)) expect(inPolygon(x, y, lake), `${o.type} em (${x}, ${y})`).toBe(false);
    }
    expect(cenario.filter((o) => o.type === 'aguape').length).toBeGreaterThanOrEqual(8);
    expect(cenario.filter((o) => o.type === 'capivara' && inPark(o)).length).toBe(3); // as do lago (as outras pastam no campinho)
  });

  it('o deque e a pinguela: dá para andar até a ponta do deque, em cima da água, e atravessar o riacho', () => {
    const deck = cenario.find((o) => o.type === 'deque')!;
    const [dx, dy] = [deck.x / M + 0.4, (deck.y + deck.height / 2) / M];
    expect(inPolygon(dx, dy, lake)).toBe(true);
    expect(reach(dx, dy)).toBe(true);
    const bridge = cenario.find((o) => o.type === 'pinguela')!;
    const [bx, by] = [(bridge.x + bridge.width / 2) / M, (bridge.y + bridge.height / 2) / M];
    expect(pathDist(bx, by, pts(stream))).toBeLessThan(0.5); // a pinguela está em cima do riacho
    expect(reach(bx, by)).toBe(true);
    for (const side of [-2.5, 2.5]) {
      // logo acima e logo abaixo da pinguela é água
      const sp = pts(stream);
      const y = by + side;
      const i = sp.findIndex((p, k) => k + 1 < sp.length && (p[1] - y) * (sp[k + 1]![1] - y) <= 0);
      const [[ax, ay], [cx, cy]] = [sp[i]!, sp[i + 1]!];
      expect(reach(ax + ((cx - ax) * (y - ay)) / (cy - ay), y)).toBe(false);
    }
  });

  it('o círculo, a figueira, a Pedra do Véu, a ponta do deque e o recanto do outro lado do riacho têm o brilho do Véu, e dá para chegar perto', () => {
    const veus = cenario.filter((o) => o.type === 'veu');
    expect(veus).toHaveLength(5);
    for (const v of veus) expect(reachNear(at(v).x, at(v).y, 3), `véu em (${at(v).x}, ${at(v).y})`).toBe(true);
    const stone = cenario.find((o) => o.type === 'pedra' && prop(o, 'ancestral') === true)!;
    expect(veus.some((v) => Math.hypot(at(v).x - at(stone).x, at(v).y - at(stone).y) < 0.01)).toBe(true);
  });

  it.runIf(map.layers.some((l) => l.name === 'monstros'))('as criaturas (saguis encantados e jararacas) moram em lugar alcançável, fora das zonas seguras', () => {
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

  it('as áreas têm nome (a mata profunda com neblina) e as duas clareiras são mais claras que a mata', () => {
    const names = layer('areas').map((a) => a.name);
    expect(names).toEqual(expect.arrayContaining(['Clareira dos Despertos', 'Mata do Parque Santo Dias', 'Lago do Parque', 'Clareira das Bananeiras', 'Mata Profunda', 'Vila do Capão']));
    const deep = layer('areas').filter((a) => a.name === 'Mata Profunda');
    expect(deep).toHaveLength(2);
    for (const d of deep) expect(Number(prop(d, 'neblina'))).toBeGreaterThan(0);
    const dark = (name: string) => Number(prop(layer('areas').find((a) => a.name === name)!, 'escuro'));
    for (const c of ['Clareira dos Despertos', 'Clareira das Bananeiras']) expect(dark(c)).toBeLessThan(dark('Mata do Parque Santo Dias'));
  });
});

describe('Mapa 01 (Capão), etapa 4b: o portão e a vila', () => {
  const cenario = layer('cenario');
  const houses = cenario.filter((o) => o.type === 'casa');
  const budega = houses.find((o) => o.name === 'Budega')!;
  /** O balcão da Budega, do lado da praça: onde a [estrutura] põe quem atende (data/npcs.json). */
  const COUNTER = { x: 64.5, y: 53.3 };

  it('o Portão I está aberto e dá para ir da clareira até a Travessa, a rua, a praça, a viela e a rua de baixo', () => {
    const gate = cenario.find((o) => o.type === 'portao')!;
    expect(prop(gate, 'aberto')).toBe(true);
    expect(boxes.some((b) => b.type === 'portao')).toBe(false);
    const places: [string, number, number][] = [
      ['Travessa, em frente ao portão', 52.75, 44],
      ['Travessa, lá no norte', 52.75, 3],
      ['Travessa, lá no sul', 52.75, 77],
      ['rua da vila', 70, 44],
      ['fim da rua da vila', 93, 44],
      ['praça', 70, 51],
      ['viela entre as casas', 80, 35],
      ['terreno dos fundos', 72, 22],
      ['rua de baixo', 91, 70],
    ];
    for (const [name, x, y] of places) expect(reachNear(x, y, 0.5), name).toBe(true);
  });

  it('a vila termina no mato (beiradas fechadas) e ninguém entra nas casas', () => {
    for (let x = 49; x <= 95; x += 0.5) {
      expect(reach(x, 0.75), `beira norte em x = ${x}`).toBe(false);
      // a vila vai até y = 80; ao sul dela é mata fechada, menos a rua para Guarapiranga (x 88 a 94, a partir da 4c)
      if (x < 87.5 || x > 94.5) expect(reach(x, 80 - 0.75), `beira sul em x = ${x}`).toBe(false);
    }
    for (let y = 1; y <= 80 - 1; y += 0.5) expect(reach(map.width - 0.75, y), `beira leste em y = ${y}`).toBe(false);
    expect(houses.length).toBe(8); // 7 casas e a Budega
    for (const h of houses) {
      const [x0, y0, x1, y1] = [h.x / M, h.y / M, (h.x + h.width) / M, (h.y + h.height) / M];
      for (let x = x0 + 0.5; x < x1; x += 1) for (let y = y0 + 0.5; y < y1; y += 1) expect(reach(x, y), `${h.name || 'casa'} em (${x}, ${y})`).toBe(false);
    }
  });

  it('a rua da vila e a Travessa (dos dois lados do carro largado) têm pelo menos 1,5 m livres', () => {
    for (let x = 56; x <= 93; x += 0.25) for (const y of [43.25, 44, 44.75]) expect(footFree(x, y), `rua em (${x}, ${y})`).toBe(true);
    const car = cenario.find((o) => o.type === 'carro')!;
    const [cx0, cy0, cx1, cy1] = [car.x / M, car.y / M, (car.x + car.width) / M, (car.y + car.height) / M];
    for (let y = cy0; y <= cy1; y += 0.25) {
      for (const x of [cx0 - 1.5 + FOOT.w / 2, cx0 - 0.75, cx0 - FOOT.w / 2]) expect(footFree(x, y), `oeste do carro (${x}, ${y})`).toBe(true);
      for (const x of [cx1 + FOOT.w / 2, cx1 + 0.75, cx1 + 1.5 - FOOT.w / 2]) expect(footFree(x, y), `leste do carro (${x}, ${y})`).toBe(true);
    }
  });

  it('a Budega: letreiro "BUDEGA DISTRIBUIDORA" (escolha do dono), vendinha, sem nada de tabaco, e o balcão livre, alcançável e na zona segura', () => {
    expect(prop(budega, 'letreiro')).toBe('BUDEGA DISTRIBUIDORA');
    expect(prop(budega, 'logo')).toBe('budega'); // o escudo dourado do dono na fachada (pedido dele, 13/11)
    expect(prop(budega, 'comercio')).toBe('vendinha');
    expect(JSON.stringify(budega).toLowerCase()).not.toMatch(/tabac|cigarr|fumo/);
    const [x0, x1, y1] = [budega.x / M, (budega.x + budega.width) / M, (budega.y + budega.height) / M];
    expect(COUNTER.x > x0 && COUNTER.x < x1 && COUNTER.y > y1 && COUNTER.y - y1 < 1).toBe(true); // na frente do balcão
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'capao');
    const corner = cornerAtFeet(COUNTER.x, COUNTER.y);
    expect(bodyFits(game, corner.x, corner.y)).toBe(true);
    expect(game.isReachable(Math.floor(COUNTER.x), Math.floor(COUNTER.y))).toBe(true);
    expect(reach(COUNTER.x, COUNTER.y)).toBe(true);
    const safe = layer('seguro').some((o) => COUNTER.x >= o.x / M && COUNTER.x <= (o.x + o.width) / M && COUNTER.y >= o.y / M && COUNTER.y <= (o.y + o.height) / M);
    expect(safe).toBe(true);
  });

  it('na vila não há vão de entalar: duas coisas sólidas de frente uma para a outra ficam coladas ou a 1,2 m', () => {
    // (um orelhão a 40 cm de um poste prendeu o personagem no "andar até"; canto com canto, na diagonal, tem saída)
    const village = boxes.filter((b) => b.x1 > 48.5 && b.y0 < 80);
    for (let i = 0; i < village.length; i++) {
      for (let j = i + 1; j < village.length; j++) {
        const [a, b] = [village[i]!, village[j]!];
        if (a.type === 'mata-fechada' && b.type === 'mata-fechada') continue;
        const [dx, dy] = [Math.max(0, b.x0 - a.x1, a.x0 - b.x1), Math.max(0, b.y0 - a.y1, a.y0 - b.y1)];
        if (dx > 0 && dy > 0) continue;
        const gap = dx + dy;
        expect(gap <= 0.3 || gap >= 1.2, `vão de ${gap.toFixed(2)} m entre ${a.type} (${a.x0}, ${a.y0}) e ${b.type} (${b.x0}, ${b.y0})`).toBe(true);
      }
    }
  });

  it('a praça: fogueira com 4 bancos virados para ela, a árvore da praça, mesas, orelhão e a fiação ligando os postes', () => {
    const fire = cenario.find((o) => o.type === 'fogueira')!;
    const benches = cenario.filter((o) => o.type === 'banco' && Math.hypot(at(o).x - fire.x / M, at(o).y - fire.y / M) < 4);
    expect(benches).toHaveLength(4);
    for (const b of benches) {
      const { x, y } = at(b);
      const facing = (Number(prop(b, 'olhando')) * Math.PI) / 180;
      const [dx, dy] = [fire.x / M - x, fire.y / M - y];
      expect(Math.cos(facing) * dx + Math.sin(facing) * dy, 'banco virado para a fogueira').toBeGreaterThan(0);
    }
    expect(cenario.some((o) => o.type === 'arvore' && o.name === 'Árvore da Praça')).toBe(true);
    expect(cenario.filter((o) => o.type === 'mesa')).toHaveLength(2);
    expect(cenario.filter((o) => o.type === 'orelhao')).toHaveLength(1);
    // cada fio liga postes de verdade, e todo poste tem fio
    const wires = cenario.filter((o) => o.type === 'fiacao') as (TiledObject & { polyline: { x: number; y: number }[] })[];
    const posts = cenario.filter((o) => o.type === 'poste').map(at);
    expect(wires.length).toBeGreaterThan(0);
    for (const wire of wires) for (const p of wire.polyline) expect(posts.some((q) => Math.hypot(q.x - p.x / M, q.y - p.y / M) < 0.01), `fio em (${p.x / M}, ${p.y / M})`).toBe(true);
    for (const q of posts) expect(wires.some((w) => w.polyline.some((p) => Math.hypot(q.x - p.x / M, q.y - p.y / M) < 0.01)), `poste em (${q.x}, ${q.y})`).toBe(true);
  });
});

describe('Mapa 01 (Capão): a rua e a praça da Budega no padrão novo (a floresta reinando, aprovado em 13/11)', () => {
  const cenario = layer('cenario');
  const chao = layer('chao');
  const of = (type: string) => chao.filter((o) => o.type === type);
  const ptsOf = (o: TiledObject) => (o.polyline ?? o.polygon)!.map((p) => [(o.x + p.x) / M, (o.y + p.y) / M] as [number, number]);
  const asphalt = chao.filter((o) => o.type === 'asfalto' && !o.polyline && !o.polygon);
  const onAsphalt = (x: number, y: number) => asphalt.some((a) => x >= a.x / M && x <= (a.x + a.width) / M && y >= a.y / M && y <= (a.y + a.height) / M);

  it('a rua parece rua: meio-fio em toda beira, faixa apagada no meio, remendos, buracos, rachaduras, bueiros e tampas no asfalto', () => {
    expect(of('meio-fio').length).toBeGreaterThanOrEqual(4);
    for (const c of of('meio-fio')) expect(Number(prop(c, 'altura'))).toBeCloseTo(0.15);
    // o meio-fio passa na beira de cada calçada que encosta no asfalto da rua do portão (y = 41 e y = 47)
    const curbY = (y: number) => of('meio-fio').some((c) => ptsOf(c).some(([, py], i, all) => py === y && all[i + 1]?.[1] === y));
    expect(curbY(41) && curbY(47)).toBe(true);
    expect(of('faixa-rua').length).toBeGreaterThanOrEqual(3);
    for (const type of ['remendo', 'buraco', 'rachadura', 'bueiro', 'tampa']) expect(of(type).length, type).toBeGreaterThan(2);
    for (const o of [...of('buraco'), ...of('bueiro'), ...of('tampa')]) expect(onAsphalt(o.x / M, o.y / M), `${o.type} em (${o.x / M}, ${o.y / M})`).toBe(true);
    for (const r of of('rachadura')) for (const [x, y] of ptsOf(r)) expect(onAsphalt(x, y), `rachadura em (${x}, ${y})`).toBe(true);
    // a calçada é de placas de cimento e a praça tem musgo
    for (const c of of('calcada')) expect(prop(c, 'desenho')).toBe('placas');
    expect(prop(of('praca')[0]!, 'musgo')).toBe(true);
    // nada disso segura o pé
    expect(boxes.some((b) => ['meio-fio', 'faixa-rua', 'remendo', 'buraco', 'rachadura', 'bueiro', 'tampa', 'raiz', 'poca'].includes(b.type))).toBe(false);
  });

  it('a Figueira da Esquina rompe a calçada na esquina do portão sem fechar a passagem, e as raízes passam por cima da rua', () => {
    const fig = cenario.find((o) => o.name === 'Figueira da Esquina')!;
    expect(prop(fig, 'especie')).toBe('figueira');
    expect(prop(fig, 'rompendo')).toBe(true);
    const { x, y } = at(fig);
    expect(Math.hypot(x - 57, y - 38.6)).toBeLessThan(0.01);
    // do portão até a rua continua livre, e a faixa de pedestre também
    for (const [px, py] of [[49, 44], [52.75, 44], [56.5, 42], [60, 44]] as const) expect(reach(px, py), `(${px}, ${py})`).toBe(true);
    expect(of('raiz').length).toBeGreaterThanOrEqual(4);
    expect(reachNear(58.2, 41.4, 0.3)).toBe(true); // em cima de uma raiz, na rua
  });

  it('a mata tomando a vila: cipó nos postes, nos fios e nas casas, plantas nas lajes, e o prédio do conjunto no fundo', () => {
    for (const o of cenario.filter((c) => c.type === 'poste' || c.type === 'fiacao')) expect(prop(o, 'cipo'), `${o.type} em (${o.x / M}, ${o.y / M})`).toBe(true);
    const houses = cenario.filter((c) => c.type === 'casa');
    expect(houses.filter((h) => prop(h, 'plantas') === true).length).toBe(houses.length);
    expect(houses.filter((h) => Number(prop(h, 'cipo') ?? 0) > 0).length).toBeGreaterThanOrEqual(6);
    // árvore na laje só nas casas ao norte da rua (atrás dela: não tampam a rua)
    for (const h of houses.filter((c) => prop(c, 'arvoreNaLaje') === true)) expect((h.y + h.height) / M).toBeLessThanOrEqual(41);
    const predio = cenario.find((o) => o.type === 'predio')!;
    expect(Number(prop(predio, 'andares'))).toBe(5);
    expect((predio.y + predio.height) / M).toBeLessThan(29); // no fundo, atrás das casas da rua
    expect(reach(at(predio).x, at(predio).y)).toBe(false);
  });

  it('na rua do portão, os postes e os fios ficam na calçada das casas (atrás de quem anda na rua, para a câmera), nunca na da praça nem atravessando a rua', () => {
    // pedido do dono (13/11): "os postes era pra pôr nessa rua que não fica na frente do personagem"
    const W_MAP = map.width;
    const between = (x: number) => x > 56.5 && x < W_MAP;
    for (const o of cenario.filter((c) => c.type === 'poste' && between(at(c).x) && at(c).y < 50)) expect(at(o).y, `poste em (${at(o).x}, ${at(o).y})`).toBeLessThan(41.1);
    for (const w of cenario.filter((c) => c.type === 'fiacao')) {
      const pts = w.polyline!.map((p) => [(w.x + p.x) / M, (w.y + p.y) / M] as const);
      for (let i = 0; i + 1 < pts.length; i++) {
        for (let k = 0; k <= 20; k++) {
          const [x, y] = [pts[i]![0] + ((pts[i + 1]![0] - pts[i]![0]) * k) / 20, pts[i]![1] + ((pts[i + 1]![1] - pts[i]![1]) * k) / 20];
          if (between(x) && y < 50) expect(y, `fio em (${x.toFixed(1)}, ${y.toFixed(1)})`).toBeLessThan(41.1);
        }
      }
    }
    // e a calçada das casas continua passando entre o poste e a parede
    for (const x of [61.5, 70, 80, 90.5]) expect(reachNear(x, 40.1, 0.2), `calçada no poste de x = ${x}`).toBe(true);
  });

  it('a vida na rua: moto, placa de rua, cadeiras, vasos, lixo e bandeirinhas, sem fechar a calçada da casa amarela nem a roda da fogueira', () => {
    for (const type of ['moto', 'placa-rua', 'cadeira', 'vaso', 'lixo', 'bandeirinhas']) expect(cenario.some((o) => o.type === type), type).toBe(true);
    const sign = cenario.find((o) => o.type === 'placa-rua')!;
    expect([prop(sign, 'texto'), prop(sign, 'texto2')]).toEqual(['R. SANTO DIAS', 'TV. JASMIM DA BEIRADA']);
    expect(reachNear(84.2, 40.6, 0.4)).toBe(true); // entre as cadeiras e a moto, na calçada
    // as cadeiras da casa amarela ficam ao lado da porta (a porta é na ponta oeste da fachada, x 81,9 a 82,8), não na frente
    for (const c of cenario.filter((o) => o.type === 'cadeira' && at(o).y < 41)) expect(at(c).x - 0.25).toBeGreaterThan(82.8);
    expect(reachNear(82.35, 40.3, 0.3)).toBe(true); // a frente da porta, livre
    for (const [x, y] of [[69.5, 52.9], [69.5, 59.1], [66.2, 56], [72.8, 56]] as const) expect(reachNear(x, y, 0.5), `roda da fogueira (${x}, ${y})`).toBe(true);
  });
});

describe('Mapa 01 (Capão), etapa 4c: campinho, viaduto e saídas', () => {
  const cenario = layer('cenario');

  it('o campinho de várzea: dá para andar no campo, as traves só seguram nos postes e o muro com grafite fica virado para o campo', () => {
    const field = layer('chao').find((o) => o.type === 'campinho')!;
    const [x0, y0, x1, y1] = [field.x / M, field.y / M, (field.x + field.width) / M, (field.y + field.height) / M];
    expect(reach((x0 + x1) / 2, (y0 + y1) / 2)).toBe(true);
    expect(cenario.filter((o) => o.type === 'trave')).toHaveLength(2);
    expect(boxes.filter((b) => b.type === 'trave')).toHaveLength(4); // dois postes por trave
    const muro = cenario.find((o) => o.type === 'muro')!;
    expect(prop(muro, 'grafite')).toBeTruthy();
    expect((muro.x + muro.width) / M).toBeLessThanOrEqual(x0); // o muro fica a oeste do campo...
    expect(prop(muro, 'lado')).toBe('leste'); // ...com a pintura virada para ele (o lado que a câmera vê)
  });

  it('o viaduto da Linha 5-Lilás: o tabuleiro e o trem lá em cima não seguram ninguém; os pilares e o ônibus seguram', () => {
    expect(boxes.some((b) => b.type === 'viaduto' || b.type === 'trem' || b.type === 'cipo')).toBe(false);
    expect(boxes.filter((b) => b.type === 'pilar-viaduto')).toHaveLength(4);
    expect(boxes.filter((b) => b.type === 'onibus')).toHaveLength(1);
    expect(reachNear(63, 4, 0.5)).toBe(true); // embaixo do viaduto, entre dois pilares
    expect(prop(cenario.find((o) => o.type === 'trem')!, 'cor')).toBe('#7d5ca8'); // lilás
  });

  it('a rua para Guarapiranga atravessa a mata até a saída para o Mapa 02, com placa; a mata dos lados continua fechada; a rua leste termina no mato com a placa da estação', () => {
    for (let y = 81; y <= 119; y += 2) expect(reach(91, y), `rua em y = ${y}`).toBe(true);
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'capao');
    expect(game.exits.map((e) => ({ to: e.to, arrival: e.arrival, y: e.y }))).toEqual([{ to: 'guarapiranga', arrival: 'chegada-capao', y: 119 }]);
    const arrival = layer('pontos').find((o) => o.name === 'chegada-guarapiranga')!;
    expect(reach(arrival.x / M, arrival.y / M)).toBe(true); // quem volta de lá aparece na rua, fora da saída
    expect(game.exitAt(arrival.x / M, arrival.y / M)).toBeNull();
    expect(cenario.some((o) => o.type === 'barreira')).toBe(false);
    expect(reach(84, 100)).toBe(false); // a mata ao sul da vila
    const placas = cenario.filter((o) => o.type === 'placa').map((o) => prop(o, 'texto'));
    expect(placas).toEqual(expect.arrayContaining(['GUARAPIRANGA', 'ESTAÇÃO CAPÃO REDONDO']));
    expect(reach(95.25, 44)).toBe(false); // o fim da rua da vila (a estação fica para depois)
  });
});

describe('Mapa 01 (Capão): o resto do Capão (4c) no padrão novo (aprovado pelo dono em 13/11)', () => {
  const cenario = layer('cenario');
  const chao = layer('chao');
  const one = (type: string) => cenario.find((o) => o.type === type)!;

  it('o viaduto, os pilares e o trem tomados pela mata; o ônibus virou a horta; a casa abandonada fica inteira, com uma árvore pelo telhado', () => {
    expect(prop(one('viaduto'), 'arvoresNoTopo')).toBe(true);
    expect(Number(prop(one('viaduto'), 'cipo'))).toBeGreaterThan(0);
    for (const p of cenario.filter((o) => o.type === 'pilar-viaduto')) expect([prop(p, 'pixo'), prop(p, 'musgo')]).toEqual([true, true]);
    expect([prop(one('trem'), 'cipo'), prop(one('trem'), 'plantas')]).toEqual([true, true]);
    expect(prop(one('onibus'), 'horta')).toBe(true);
    const abandoned = cenario.find((o) => o.type === 'casa' && prop(o, 'abandonada') === true)!;
    expect(prop(abandoned, 'arvoreDentro')).toBe(true);
    expect(reach(at(abandoned).x, at(abandoned).y)).toBe(false); // continua uma casa (não dá para entrar)
    expect(cenario.filter((o) => o.type === 'cipo').length).toBeGreaterThan(8);
  });

  it('um caminho de terra liga a viela ao vão embaixo do viaduto, e dá para andar por ele', () => {
    const path = chao.find((o) => o.type === 'trilha' && o.polyline && Math.abs(o.polyline[0]!.x / M + o.x / M - 80) < 0.01)!;
    expect(path).toBeDefined();
    for (const p of path.polyline!) expect(reachNear((path.x + p.x) / M, (path.y + p.y) / M, 0.6), `caminho em (${(path.x + p.x) / M}, ${(path.y + p.y) / M})`).toBe(true);
  });

  it('o campinho com o mato entrando, traves enferrujadas com a rede rasgada, o muro com cipó e cadeiras para quem assiste', () => {
    for (const t of cenario.filter((o) => o.type === 'trave')) expect([prop(t, 'ferrugem'), prop(t, 'cipo'), prop(t, 'rede')]).toEqual([true, true, 'rasgada']);
    expect(Number(prop(one('muro'), 'cipo'))).toBeGreaterThan(0);
    const chairs = cenario.filter((o) => o.type === 'cadeira' && at(o).y > 61 && at(o).y < 62);
    expect(chairs).toHaveLength(4);
    // as cadeiras não fecham a passagem entre a praça e o campinho
    for (const x of [67.5, 72, 77.5]) expect(reachNear(x, 61.6, 0.4), `beira do campinho em x = ${x}`).toBe(true);
  });

  it('a rua para Guarapiranga: faixa apagada, rachaduras, buracos e raízes, sem fechar a rua', () => {
    const onRoad = (x: number, y: number) => x > 88 && x < 94 && y > 80 && y < 114.5;
    expect(chao.some((o) => o.type === 'faixa-rua' && o.polyline!.every((p) => Math.abs((o.x + p.x) / M - 91) < 0.01))).toBe(true);
    expect(chao.filter((o) => o.type === 'rachadura' && o.polyline!.every((p) => onRoad((o.x + p.x) / M, (o.y + p.y) / M))).length).toBeGreaterThan(4);
    expect(chao.filter((o) => o.type === 'buraco' && onRoad(o.x / M, o.y / M)).length).toBeGreaterThanOrEqual(2);
    for (let y = 81; y <= 113; y += 2) expect(reach(91, y), `rua em y = ${y}`).toBe(true);
  });

  it('a Figueira do Viaduto fica na beira do parque, perto da ponta quebrada, sem tampar trilha nem fechar o caminho dos saguis', () => {
    const fig = cenario.find((o) => o.name === 'Figueira do Viaduto')!;
    expect(prop(fig, 'especie')).toBe('figueira');
    expect(Number(prop(fig, 'altura'))).toBeGreaterThan(10);
    const { x, y } = at(fig);
    expect(x).toBeLessThan(48); // no parque
    expect(y).toBeLessThan(10); // perto do viaduto (y 2 a 6)
    expect(reachNear(x, y + 2.5, 0.5)).toBe(true); // dá para chegar perto do tronco
  });
});
