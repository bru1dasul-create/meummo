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
/** A largura do mapa antes do Capão maior (23/11): o que conta as coisas da parte antiga olha só para cá. */
const OLD_W = 96;
const old = (o: TiledObject) => o.x / M < OLD_W;

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

  it('tem 192 × 180 metros (o parque cresceu duas vezes para o sul e o Capão maior dobrou a largura), tile de 32 px e as camadas combinadas', () => {
    expect([map.width, map.height, map.tilewidth, map.tileheight]).toEqual([192, 180, 32, 32]);
    // a camada "monstros" só aparece quando as criaturas estão ligadas no gerador (CREATURES)
    // (com o Mapa 02 no jogo, 19/11, a camada `saidas`: o fim da rua do sul leva para Guarapiranga)
    expect(map.layers.map((l) => l.name).filter((n) => n !== 'monstros')).toEqual(['chao', 'cenario', 'colisao', 'seguro', 'areas', 'pontos', 'saidas']);
    expect(map.layers.every((l) => l.type === 'objectgroup')).toBe(true);
  });

  it('cada coisa sólida do cenário tem a sua colisão (tronco, poste, pedra, gradil, pilar, mata fechada, casa, banco...)', () => {
    const covered = (x: number, y: number) => boxes.some((b) => x >= b.x0 - 1e-6 && x <= b.x1 + 1e-6 && y >= b.y0 - 1e-6 && y <= b.y1 + 1e-6);
    const SOLID = ['arvore', 'bambu', 'poste', 'pedra', 'gradil', 'pilar', 'tronco-caido', 'casa', 'carro', 'banco', 'mesa', 'fogueira', 'lixeira', 'orelhao', 'poste-praca', 'predio', 'moto', 'placa-rua', 'cadeira', 'vaso', 'lixo', 'semaforo', 'prateleira', 'geladeira', 'balcao', 'engradado', 'vitrine', 'balcao-vidro', 'freezer', 'caixote', 'lousa'];
    for (const o of layer('cenario')) {
      const { x, y } = at(o);
      // (a casa com interior, a Budega, tem só as paredes: o meio dela é o chão de dentro)
      const hollow = o.type === 'casa' && prop(o, 'interior') === true;
      const solid = (SOLID.includes(o.type) && !hollow) || (o.type === 'portao' && prop(o, 'aberto') !== true) || (o.type === 'arbusto' && prop(o, 'fechado') === true);
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

describe('Mapa 01 (Capão): os galhos dos saguis (pedido da [arte] com o ok do dono, 23/11)', () => {
  it('de 4 a 6 galhos na área dos saguis, com altura e direção; o chão embaixo é andável e longe do tronco', () => {
    const area = layer('monstros').find((o) => o.name === 'sagui')!;
    const [ax0, ay0] = [area.x / M, area.y / M];
    const [ax1, ay1] = [ax0 + area.width / M, ay0 + area.height / M];
    const perches = layer('pontos').filter((o) => o.type === 'galho-sagui');
    expect(perches.length).toBeGreaterThanOrEqual(4);
    expect(perches.length).toBeLessThanOrEqual(6);
    const trunks = layer('cenario').filter((o) => o.type === 'arvore').map((o) => ({ ...at(o), r: Number(prop(o, 'tronco')) / 2 }));
    const boxes = layer('colisao').map((o) => ({ x0: o.x / M, y0: o.y / M, x1: (o.x + o.width) / M, y1: (o.y + o.height) / M }));
    for (const o of perches) {
      const { x, y } = at(o);
      expect(x >= ax0 && x <= ax1 && y >= ay0 && y <= ay1, `galho em (${x}, ${y}) fora da área`).toBe(true);
      const h = Number(prop(o, 'altura')), dir = Number(prop(o, 'direcao'));
      expect(h).toBeGreaterThanOrEqual(2);
      expect(h).toBeLessThanOrEqual(2.4);
      expect(Number.isFinite(dir)).toBe(true);
      const near = Math.min(...trunks.map((t) => Math.hypot(t.x - x, t.y - y) - t.r));
      expect(near, `galho em (${x}, ${y}) colado no tronco`).toBeGreaterThanOrEqual(0.7);
      const hit = boxes.find((b) => x + 0.35 > b.x0 && x - 0.35 < b.x1 && y + 0.35 > b.y0 && y - 0.35 < b.y1);
      expect(hit, `o chão embaixo do galho em (${x}, ${y}) não é andável`).toBeUndefined();
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

  it('o parque cresceu para o sul (48 × 180 m na floresta maior) e a mata ao sul da vila virou mata de andar', () => {
    expect(map.height).toBe(180);
    expect(reachNear(30, 112, 2)).toBe(true); // o fundo do parque de antes
    expect(reachNear(30, 170, 2)).toBe(true); // o fundo novo
    expect(reachNear(70, 100, 2)).toBe(true); // a mata da estrada, ao sul da vila (antes, mata fechada)
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
      const paineira = prop(o, 'especie') === 'paineira';
      const copa = o.type === 'bambu' ? Number(prop(o, 'raio')) * 1.3 : Number(prop(o, 'copa'));
      const [cx, cy] = screen(x, y, Number(prop(o, 'altura')));
      for (const [kx, ky] of keys) {
        if ((fig && Math.hypot(kx - 37, ky - 43) <= 9.01) || kx + ky >= x + y) continue; // só cobre o que está atrás dela
        if (paineira && Math.hypot(kx - 32, ky - 150) <= 6.51) continue; // a paineira cobre a clareira dela
        const [sx, sy] = screen(kx, ky);
        if (Math.hypot(sx - cx, sy - cy) < copa * 1.05) bad.push(`${o.type} ${prop(o, 'especie') ?? ''} em (${x}, ${y}) tampa (${kx.toFixed(1)}, ${ky.toFixed(1)})`);
      }
      // de cima: a copa não fica por cima da trilha (a figueira, colada no círculo, e a paineira, na beira da clareira
      // dela, são as exceções: as trilhas chegam embaixo delas)
      if (o.type === 'arvore' && !fig && !paineira) {
        const gap = Math.min(...trails.map((t) => pathDist(x, y, pts(t)) - Number(prop(t, 'largura')) / 2));
        if (gap < copa - 0.05) bad.push(`copa de ${prop(o, 'especie')} em (${x}, ${y}) por cima da trilha`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('nenhuma árvore da vila tampa as trilhas do parque vista da câmera (a copa da Figueira da Esquina não cai em cima dos saguis)', () => {
    const screen = (x: number, y: number, z = 0) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2 * 0.5 - z * 0.866] as const;
    const bad: string[] = [];
    for (const o of cenario.filter((c) => !inPark(c) && c.type === 'arvore')) {
      const { x, y } = at(o);
      const [cx, cy] = screen(x, y, Number(prop(o, 'altura')));
      for (const [kx, ky] of keys) {
        if (kx >= 48 || kx + ky >= x + y) continue; // só as do parque, e só o que está atrás da árvore
        const [sx, sy] = screen(kx, ky);
        if (Math.hypot(sx - cx, sy - cy) < Number(prop(o, 'copa')) * 1.05) bad.push(`${prop(o, 'especie')} em (${x}, ${y}) tampa (${kx.toFixed(1)}, ${ky.toFixed(1)})`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('a mata ficou mais aberta: no parque, no máximo uma árvore grande a cada 40 m²', () => {
    const big = cenario.filter((o) => inPark(o) && o.type === 'arvore' && Number(prop(o, 'copa')) >= 1.7 && prop(o, 'especie') !== 'figueira');
    expect(big.length).toBeLessThanOrEqual((48 * map.height) / 40);
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
    const LAKE_WEST_SHORE = Math.min(...pts(lake).map(([x]) => x));
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
    // as capivaras andam em bando desde 14/11 (a [estrutura], data/bichos.json): no mapa fica o lugar delas na margem
    // oeste do lago (a área onde andam encosta na água; o ponto onde deitam fica em terra, fora do lago, e dá para chegar)
    expect(cenario.filter((o) => o.type === 'capivara')).toHaveLength(0); // as de enfeite, paradas, saíram
    const pontos = layer('pontos');
    const area = pontos.find((o) => o.name === 'capivaras-lago')!;
    const bed = pontos.find((o) => o.name === 'capivaras-lago-descanso')!;
    const [bx, by] = [bed.x / M, bed.y / M];
    expect(bx >= area.x / M && bx <= (area.x + area.width) / M && by >= area.y / M && by <= (area.y + area.height) / M).toBe(true);
    expect(inPolygon(bx, by, lake)).toBe(false);
    expect(reachNear(bx, by, 1)).toBe(true);
    expect(area.x / M).toBeLessThan(LAKE_WEST_SHORE); // a área chega na beira oeste do lago
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

  it('o círculo, a figueira, a Pedra do Véu, a ponta do deque, o recanto do outro lado do riacho e o recanto da mata profunda do sul têm o brilho do Véu, e dá para chegar perto', () => {
    const veus = cenario.filter((o) => o.type === 'veu');
    expect(veus).toHaveLength(6);
    for (const v of veus) expect(reachNear(at(v).x, at(v).y, 3), `véu em (${at(v).x}, ${at(v).y})`).toBe(true);
    const stone = cenario.find((o) => o.type === 'pedra' && prop(o, 'ancestral') === true)!;
    expect(veus.some((v) => Math.hypot(at(v).x - at(stone).x, at(v).y - at(stone).y) < 0.01)).toBe(true);
  });

  it.runIf(map.layers.some((l) => l.name === 'monstros'))('as criaturas (saguis encantados e jararacas) moram em lugar alcançável, fora das zonas seguras', () => {
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'capao');
    const zones = layer('monstros');
    expect(zones.map((z) => [z.name, prop(z, 'quantidade')])).toEqual([
      // (16/11, pedido do dono: mais bichos para caçar, 40 no total)
      ['sagui', 8],
      ['jararaca', 6],
      // os bichos novos da floresta maior (escolhidos pelo dono em 14/11)
      ['quati', 10],
      ['tatu_bola', 8],
      ['marimbondo', 6],
      ['filhote_boitata', 2],
      // a Mata do Córrego (Capão maior, 23/11): os bichos que já existem, 25 a mais
      ['quati', 8],
      ['tatu_bola', 6],
      ['marimbondo', 6],
      ['jararaca', 5],
    ]);
    for (const z of zones) {
      const [x0, y0, x1, y1] = [z.x / M, z.y / M, (z.x + z.width) / M, (z.y + z.height) / M];
      expect(x1 <= 48 || (x0 >= 48 && x1 <= 88 && y0 >= 80) || (x0 >= OLD_W && y0 >= 90), z.name).toBe(true); // no parque, na mata da estrada ou na Mata do Córrego
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
    expect(deep).toHaveLength(3); // a do noroeste, a do sul de antes e a do sul novo (floresta maior)
    for (const d of deep) expect(Number(prop(d, 'neblina'))).toBeGreaterThan(0);
    const dark = (name: string) => Number(prop(layer('areas').find((a) => a.name === name)!, 'escuro'));
    for (const c of ['Clareira dos Despertos', 'Clareira das Bananeiras', 'Clareira da Paineira']) expect(dark(c)).toBeLessThan(dark('Mata do Parque Santo Dias'));
  });
});

describe('Mapa 01 (Capão), etapa 4b: o portão e a vila', () => {
  const cenario = layer('cenario');
  const houses = cenario.filter((o) => o.type === 'casa');
  const budega = houses.find((o) => o.name === 'Budega')!;
  /** A frente da porta de enrolar da Budega, do lado da praça: fica livre. */
  const COUNTER = { x: 66.5, y: 55.2 };
  /** O pé da Xiovanna, atrás do caixa (a [estrutura] põe o mesmo número no data/npcs.json). */
  const XIOVANNA = { x: 66.6, y: 50.55 };
  /** Onde o pé do herói para quando ele toca nela (o jogo leva o pé até 1 m ao sul do pé do NPC): na frente do caixa. */
  const CUSTOMER = { x: XIOVANNA.x, y: XIOVANNA.y + 1 };

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
      // (a leste da rua de baixo, desde o Capão maior, a calçada leva para a parte nova)
      if (x < 87.5) expect(reach(x, 80 - 0.75), `beira sul em x = ${x}`).toBe(false);
    }
    for (let y = 1; y <= 80 - 1; y += 0.5) expect(reach(map.width - 0.75, y), `beira leste em y = ${y}`).toBe(false);
    expect(houses.filter((h) => h.y / M < 80 && old(h)).length).toBe(8); // 7 casas e a Budega (a lojinha do posto fica na mata da estrada)
    for (const h of houses.filter((c) => prop(c, 'interior') !== true)) {
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

  it('a Budega: letreiro "BUDEGA DISTRIBUIDORA" (escolha do dono), vendinha, sem nada de tabaco, e a frente da porta livre, alcançável e na zona segura', () => {
    expect(prop(budega, 'letreiro')).toBe('BUDEGA DISTRIBUIDORA');
    expect(prop(budega, 'logo')).toBe('budega'); // o escudo dourado do dono na fachada (pedido dele, 13/11)
    expect(prop(budega, 'comercio')).toBe('vendinha');
    expect(JSON.stringify(budega).toLowerCase()).not.toMatch(/tabac|cigarr|fumo/);
    const [x0, x1, y1] = [budega.x / M, (budega.x + budega.width) / M, (budega.y + budega.height) / M];
    expect(COUNTER.x > x0 && COUNTER.x < x1 && COUNTER.y > y1 && COUNTER.y - y1 < 1).toBe(true); // na frente da porta
    expect(COUNTER.x > Number(prop(budega, 'portaDe')) && COUNTER.x < Number(prop(budega, 'portaAte'))).toBe(true);
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'capao');
    const corner = cornerAtFeet(COUNTER.x, COUNTER.y);
    expect(bodyFits(game, corner.x, corner.y)).toBe(true);
    expect(game.isReachable(Math.floor(COUNTER.x), Math.floor(COUNTER.y))).toBe(true);
    expect(reach(COUNTER.x, COUNTER.y)).toBe(true);
    const safe = layer('seguro').some((o) => COUNTER.x >= o.x / M && COUNTER.x <= (o.x + o.width) / M && COUNTER.y >= o.y / M && COUNTER.y <= (o.y + o.height) / M);
    expect(safe).toBe(true);
  });

  it('a entrada da Budega (pedido do dono, 14/11: "está péssimo"; maior e igual à de verdade em 15/11): a porta de enrolar de 3 m do lado direito, sem varal de bandeirinhas na frente e sem orelhão colado na quina', () => {
    const [x0, x1, y1] = [budega.x / M, (budega.x + budega.width) / M, (budega.y + budega.height) / M];
    expect([x1 - x0, y1 - budega.y / M].map((v) => +v.toFixed(2))).toEqual([8, 5.5]); // de 5 × 3 m para 8 × 5,5 m
    expect(Number(prop(budega, 'portaDe'))).toBeCloseTo(65);
    expect(Number(prop(budega, 'portaAte'))).toBeCloseTo(68);
    // como a loja de verdade: fachada preta com a moldura amarela e a faixa de luz; sem toldo (a vitrine fica à mostra)
    expect([prop(budega, 'fachada'), prop(budega, 'moldura'), prop(budega, 'led'), prop(budega, 'toldo')]).toEqual(['preta', '#e8c020', true, undefined]);
    // as bandeirinhas são desenhadas por cima de tudo: na tela, nenhum varal passa por cima da fachada da Budega nem de
    // quem passa pela porta (o pé de x 65,3 a 67,7, da porta até 1,8 m na frente; o corpo com 1,8 m de altura)
    const screen = (x: number, y: number, z = 0) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2 * 0.5 - z * 0.866] as const;
    const [fa, fb] = [screen(x0, y1), screen(x1, y1)];
    const H = Number(prop(budega, 'altura'));
    const covers = (sx: number, sy: number) => {
      const m = 0.25;
      if (sx >= fa[0] - m && sx <= fb[0] + m) {
        const bottom = fa[1] + ((fb[1] - fa[1]) * (sx - fa[0])) / (fb[0] - fa[0]);
        if (sy >= bottom - H * 0.866 - m && sy <= bottom + m) return 'a fachada';
      }
      for (let x = 65.3; x <= 67.71; x += 0.1) {
        for (let y = y1 - 0.3; y <= y1 + 1.81; y += 0.1) {
          const [fx, fy] = screen(x, y);
          if (Math.abs(sx - fx) <= 0.3 + m && sy >= screen(x, y, 1.8)[1] - m && sy <= fy + m) return `quem está em (${x.toFixed(1)}, ${y.toFixed(1)})`;
        }
      }
      return '';
    };
    for (const b of cenario.filter((o) => o.type === 'bandeirinhas')) {
      const p = b.polyline!.map((q) => [(b.x + q.x) / M, (b.y + q.y) / M] as const);
      const h = Number(prop(b, 'altura'));
      for (let i = 0; i + 1 < p.length; i++) {
        const [[ax, ay], [bx, by]] = [p[i]!, p[i + 1]!];
        const sag = Math.min(0.7, Math.hypot(bx - ax, by - ay) * 0.07); // o cordão cai no meio (como no desenho dele)
        for (let u = 0; u <= 1.001; u += 0.02) {
          const [x, y, z] = [ax + (bx - ax) * u, ay + (by - ay) * u, h - Math.sin(u * Math.PI) * sag];
          const [sx, sy] = screen(x, y, z);
          expect(covers(sx, sy), `varal em (${x.toFixed(1)}, ${y.toFixed(1)}) por cima de`).toBe('');
        }
      }
    }
    const orelhao = cenario.find((o) => o.type === 'orelhao')!;
    expect(Math.hypot(at(orelhao).x - x0, at(orelhao).y - y1)).toBeGreaterThan(3);
  });

  it('na frente da Budega (aprovado pelo dono, 15/11): o degrau com capacho na porta, a lousinha, o vaso de dracena e dois caixotes de fruta, encostados na fachada e sem fechar a porta', () => {
    const y1 = (budega.y + budega.height) / M;
    const chao = layer('chao');
    const degrau = chao.find((o) => o.type === 'degrau')!;
    expect(prop(degrau, 'capacho')).toBe(true);
    expect([degrau.x / M, (degrau.x + degrau.width) / M, degrau.y / M].map((v) => +v.toFixed(2))).toEqual([65, 68, +y1.toFixed(2)]);
    expect(boxes.some((b) => b.type === 'degrau')).toBe(false); // o degrau é chão: o pé sobe
    const near = (o: TiledObject) => at(o).x > budega.x / M - 0.5 && at(o).x < (budega.x + budega.width) / M + 0.5 && at(o).y > y1 && at(o).y < y1 + 1;
    const lousa = cenario.filter((o) => o.type === 'lousa' && near(o));
    const vaso = cenario.filter((o) => o.type === 'vaso' && near(o));
    const caixotes = cenario.filter((o) => o.type === 'caixote' && near(o));
    expect([lousa.length, vaso.length, caixotes.length]).toEqual([1, 1, 2]);
    expect(prop(vaso[0]!, 'planta')).toBe('dracena');
    expect(caixotes.map((c) => prop(c, 'fruta')).sort()).toEqual(['banana', 'laranja']);
    // tudo encostado na fachada (até 30 cm: nada de vão de entalar) e fora do vão da porta
    for (const o of [...lousa, ...vaso, ...caixotes]) {
      const b = boxes.find((q) => q.type === o.type && at(o).x >= q.x0 && at(o).x <= q.x1 && at(o).y >= q.y0 && at(o).y <= q.y1)!;
      expect(b.y0 - y1, `${o.type} encostado`).toBeLessThanOrEqual(0.3);
      expect(b.x1 <= 65 || b.x0 >= 68, `${o.type} fora da porta`).toBe(true);
    }
    // a porta inteira fica livre, do degrau até a praça
    for (let x = 65.35; x <= 67.66; x += 0.1) for (const y of [y1 - 0.1, y1 + 0.2, y1 + 0.6]) expect(footFree(x, y), `porta em (${x.toFixed(2)}, ${y})`).toBe(true);
  });

  it('a Budega por dentro (pedido do dono, como no HumanitZ; maior e igual à de verdade em 15/11): entra pela porta de enrolar, compra na frente do caixa e atrás dele só fica a Xiovanna', () => {
    expect(prop(budega, 'interior')).toBe(true);
    const [bx0, bx1, by0, by1] = [budega.x / M, (budega.x + budega.width) / M, budega.y / M, (budega.y + budega.height) / M];
    const inside = { x0: 60.65, x1: 68.35, y0: 49.05, y1: 54.25 };
    expect([bx0 + 0.15, bx1 - 0.15, by0 + 0.15, by1 - 0.15].map((v) => +v.toFixed(2))).toEqual([inside.x0, inside.x1, inside.y0, inside.y1]);
    const box = (o: TiledObject) => [o.x / M, (o.x + o.width) / M, o.y / M, (o.y + o.height) / M].map((v) => +v.toFixed(2));
    // o piso branco cobre o lado de dentro, e os móveis estão lá dentro
    const piso = layer('chao').find((o) => o.type === 'piso')!;
    expect(box(piso)).toEqual([inside.x0, inside.x1, inside.y0, inside.y1]);
    expect(prop(piso, 'desenho')).toBe('porcelanato');
    const of = (t: string) => cenario.filter((o) => o.type === t);
    const inBudega = (o: TiledObject) => {
      const [x0, x1, y0, y1] = box(o);
      return x0 >= inside.x0 && x1 <= inside.x1 && y0 >= inside.y0 && y1 <= inside.y1;
    };
    // (igual às imagens que o dono aprovou, docs/referencias/budega-maior-*.jpg: ele pediu de novo, "era pra ser parecido")
    const FURNITURE = ['prateleira', 'geladeira', 'vitrine', 'balcao-vidro', 'balcao', 'freezer', 'parede-verde', 'ventilador', 'vaso'];
    expect(FURNITURE.map((t) => of(t).filter(inBudega).length)).toEqual([2, 1, 1, 1, 2, 1, 1, 1, 1]);
    expect(of('engradado').filter(inBudega)).toHaveLength(0);
    // o caixa em L (a frente com a registradora e a volta até a parede do fundo) e a dracena no canto dele
    expect(of('balcao').filter(inBudega).map((o) => prop(o, 'caixa') === true)).toEqual([true, false]);
    expect(prop(of('vaso').find(inBudega)!, 'planta')).toBe('dracena');
    // o freezer fica solto na frente das prateleiras da esquerda (como na imagem e na loja), não colado no caixa
    const freezer = box(of('freezer').find(inBudega)!);
    expect(freezer[1] < 64.85 && freezer[2] > 52).toBe(true);
    // a vitrine é parte da frente (com o herói lá dentro, sai junto com a parede da frente)
    expect(prop(of('vitrine').find(inBudega)!, 'frente')).toBe(true);
    const verde = of('parede-verde').find(inBudega)!;
    expect([prop(verde, 'logo'), prop(verde, 'neon'), prop(verde, 'flores')]).toEqual(['budega', true, 'amarelas']);
    expect(JSON.stringify(cenario.filter(inBudega)).toLowerCase()).not.toMatch(/tabac|cigarr|fumo|narguil/);
    // a frente de cada coisa (`olhando`: 90 = sul, 0 = leste) dá para quem compra e para a câmera, que olha do sudeste:
    // a vitrine mostra os produtos para a praça; o caixa e o freezer, para o freguês; o que fica na parede da esquerda,
    // para o leste; e a lousinha da calçada, para a praça
    const facing = (t: string) => of(t).filter(inBudega).map((o) => prop(o, 'olhando'));
    expect([facing('vitrine'), facing('balcao'), facing('freezer'), facing('geladeira')]).toEqual([[90], [90, 180], [90], [0]]);
    expect(prop(cenario.find((o) => o.type === 'lousa' && at(o).x > 60 && at(o).x < 69 && at(o).y > 54 && at(o).y < 56)!, 'olhando')).toBe(90);
    // as paredes têm 15 cm (a do fundo vai até a frente das prateleiras), e a frente é parede do lado da vitrine
    for (const x of [bx0 + 0.075, bx1 - 0.075]) for (let y = by0 + 0.5; y <= by1 - 0.25; y += 0.25) expect(footFree(x, y), `parede em (${x}, ${y})`).toBe(false);
    for (let x = bx0 + 0.5; x <= 64.6; x += 0.25) expect(footFree(x, by1 - 0.075), `frente em x = ${x}`).toBe(false);
    // da praça dá para entrar: a porta, o meio da loja, o corredor da esquerda, a frente da vitrine e o corredor do fundo
    for (const [x, y] of [[66.5, 54.3], [66.5, 53.3], [61.65, 52.5], [64.3, 53.2], [63.4, 51.95], [62.75, 50.25], [64.85, 51]] as const) expect(reach(x, y), `(${x}, ${y})`).toBe(true);
    // quem vai comprar para na frente do caixa, a 1 m dela: o pé cabe ali e dá para chegar
    expect(footFree(CUSTOMER.x, CUSTOMER.y - FOOT.h / 2)).toBe(true);
    expect(reachNear(CUSTOMER.x, CUSTOMER.y - FOOT.h / 2, 0.25)).toBe(true);
    // atrás do caixa ninguém passa (fechado pelo caixa em L, pela dracena e pelas paredes), mas é chão livre, e a
    // Xiovanna cabe lá
    for (const [x, y] of [[66.3, 50], [67, 49.9], [67.9, 50.1]] as const) {
      expect(footFree(x, y), `chão atrás do caixa (${x}, ${y})`).toBe(true);
      expect(reach(x, y), `atrás do caixa (${x}, ${y})`).toBe(false);
    }
    expect(footFree(XIOVANNA.x, XIOVANNA.y - FOOT.h / 2)).toBe(true);
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'capao');
    for (const p of [XIOVANNA, CUSTOMER]) {
      const corner = cornerAtFeet(p.x, p.y);
      expect(bodyFits(game, corner.x, corner.y), `o corpo cabe em (${p.x}, ${p.y})`).toBe(true);
    }
    const safe = layer('seguro').some((o) => XIOVANNA.x >= o.x / M && XIOVANNA.x <= (o.x + o.width) / M && XIOVANNA.y >= o.y / M && XIOVANNA.y <= (o.y + o.height) / M);
    expect(safe).toBe(true);
    // (com o herói lá dentro, o jogo mostra só a casa: a copa da árvore da praça, que na tela fica por cima do telhado do
    // lado do caixa, não entra no desenho de dentro. De fora, a porta e quem está na frente dela ficam à vista)
    const screen = (x: number, y: number, z = 0) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2 * 0.5 - z * 0.866] as const;
    for (const t of cenario.filter((o) => o.type === 'arvore' && o.x / M > 48)) {
      const { x, y } = at(t);
      const [cx, cy] = screen(x, y, Number(prop(t, 'altura')));
      for (const [kx, ky, kz] of [[COUNTER.x, COUNTER.y, 0], [COUNTER.x, COUNTER.y, 1.8], [65, by1, 2.6], [68, by1, 2.6]] as const) {
        if (kx + ky >= x + y) continue;
        const [sx, sy] = screen(kx, ky, kz);
        expect(Math.hypot(sx - cx, sy - cy), `${prop(t, 'especie')} em (${x}, ${y}) tampa (${kx}, ${ky}, ${kz})`).toBeGreaterThanOrEqual(Number(prop(t, 'copa')) * 1.05);
      }
    }
  });

  it('a floresta entrando na Budega (pedido do dono, 15/11: "interior com infestação da floresta"): raiz levantando o piso, mato nas frestas, samambaia, cipó e musgo, sem fechar o caminho', () => {
    const inside = { x0: 60.65, x1: 68.35, y0: 49.05, y1: 54.25 };
    const within = (x: number, y: number) => x > inside.x0 && x < inside.x1 && y > inside.y0 && y < inside.y1;
    expect(Number(prop(budega, 'cipoDentro'))).toBeGreaterThanOrEqual(0.6); // o cipó nas paredes de dentro
    expect(prop(budega, 'musgoDentro')).toBe(true);
    const chao = layer('chao');
    const roots = chao.filter((o) => o.type === 'raiz' && prop(o, 'dentro') === true && o.polyline!.some((q) => within((o.x + q.x) / M, (o.y + q.y) / M)));
    expect(roots.length).toBeGreaterThanOrEqual(5);
    const plants = [...chao, ...cenario].filter((o) => o.type === 'planta' && within(at(o).x, at(o).y));
    expect(plants.filter((o) => prop(o, 'tipo') === 'capim').length).toBeGreaterThanOrEqual(6);
    expect(plants.filter((o) => prop(o, 'tipo') === 'samambaia').length).toBeGreaterThanOrEqual(2);
    // o cipó subindo pelas prateleiras e pela geladeira grande, e as folhas secas no piso
    const tall = cenario.filter((o) => ['prateleira', 'geladeira'].includes(o.type) && Number(prop(o, 'altura')) >= 2 && within(at(o).x, at(o).y));
    expect(tall.length).toBe(3);
    for (const o of tall) expect(prop(o, 'cipo'), o.type).toBe(true);
    expect(prop(chao.find((o) => o.type === 'piso')!, 'folhas')).toBe(true);
    // nada disso segura o pé: o caminho de dentro continua livre
    expect(boxes.some((b) => ['raiz', 'planta'].includes(b.type))).toBe(false);
  });

  it('na vila não há vão de entalar: duas coisas sólidas de frente uma para a outra ficam coladas ou a 1,2 m', () => {
    // (um orelhão a 40 cm de um poste prendeu o personagem no "andar até"; canto com canto, na diagonal, tem saída)
    const village = boxes.filter((b) => b.x1 > 48.5 && b.y0 < 80);
    // (se outra coisa fecha o vão de ponta a ponta, como a parede de uma casa com um dentro e o outro fora, ou o fogão
    // entre a pia e o filtro, o vão vira dois e cada um é conferido no seu par)
    const blockedBetween = (a: Box, b: Box) => {
      const inX = a.x1 <= b.x0 || b.x1 <= a.x0;
      const [gx0, gx1] = a.x1 <= b.x0 ? [a.x1, b.x0] : b.x1 <= a.x0 ? [b.x1, a.x0] : [Math.max(a.x0, b.x0), Math.min(a.x1, b.x1)];
      const [gy0, gy1] = a.y1 <= b.y0 ? [a.y1, b.y0] : b.y1 <= a.y0 ? [b.y1, a.y0] : [Math.max(a.y0, b.y0), Math.min(a.y1, b.y1)];
      const e = 1e-6;
      return village.some((c) => c !== a && c !== b && (inX ? c.x0 < gx1 && c.x1 > gx0 && c.y0 <= gy0 + e && c.y1 >= gy1 - e : c.y0 < gy1 && c.y1 > gy0 && c.x0 <= gx0 + e && c.x1 >= gx1 - e));
    };
    for (let i = 0; i < village.length; i++) {
      for (let j = i + 1; j < village.length; j++) {
        const [a, b] = [village[i]!, village[j]!];
        if (a.type === 'mata-fechada' && b.type === 'mata-fechada') continue;
        const [dx, dy] = [Math.max(0, b.x0 - a.x1, a.x0 - b.x1), Math.max(0, b.y0 - a.y1, a.y0 - b.y1)];
        if (dx > 0 && dy > 0) continue;
        const gap = dx + dy;
        if (gap > 0.3 && gap < 1.2 && blockedBetween(a, b)) continue;
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
    // (as do pátio de concreto do posto abandonado, na floresta maior, ficam no concreto dele)
    const posto = chao.find((o) => o.type === 'calcada' && prop(o, 'estado') === 'rachado');
    const onPosto = (x: number, y: number) => !!posto && x >= posto.x / M && x <= (posto.x + posto.width) / M && y >= posto.y / M && y <= (posto.y + posto.height) / M;
    for (const r of of('rachadura')) for (const [x, y] of ptsOf(r)) expect(onAsphalt(x, y) || onPosto(x, y), `rachadura em (${x}, ${y})`).toBe(true);
    // a calçada é de placas de cimento e a praça tem musgo
    for (const c of of('calcada')) expect(prop(c, 'desenho')).toBe('placas');
    expect(prop(of('praca')[0]!, 'musgo')).toBe(true);
    // nada disso segura o pé
    expect(boxes.some((b) => ['meio-fio', 'faixa-rua', 'remendo', 'buraco', 'rachadura', 'bueiro', 'tampa', 'raiz', 'poca'].includes(b.type))).toBe(false);
  });

  it('a Figueira da Esquina rompe a calçada na frente da casa rosa sem fechar a passagem, e as raízes passam por cima da rua', () => {
    const fig = cenario.find((o) => o.name === 'Figueira da Esquina')!;
    expect(prop(fig, 'especie')).toBe('figueira');
    expect(prop(fig, 'rompendo')).toBe(true);
    const { x, y } = at(fig);
    // logo depois da esquina do portão: na esquina, a copa tampava a trilha dos saguis no parque
    expect(Math.hypot(x - 68, y - 40.25)).toBeLessThan(0.01);
    // do portão até a rua continua livre, e a faixa de pedestre também
    for (const [px, py] of [[49, 44], [52.75, 44], [56.5, 42], [60, 44], [68, 43], [72, 42]] as const) expect(reach(px, py), `(${px}, ${py})`).toBe(true);
    expect(of('raiz').length).toBeGreaterThanOrEqual(4);
    expect(reachNear(69.6, 42.1, 0.3)).toBe(true); // em cima de uma raiz, na rua
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

  it('a faixa de pedestre fica na esquina, fora do cruzamento, e o semáforo quebrado solta faísca na esquina da figueira', () => {
    // pedido do dono (13/11): "faixa de pedestre deve ser na esquina da rua, não no meio do cruzamento"
    const faixa = chao.find((o) => o.type === 'faixa')!;
    const r = { x0: faixa.x / M, x1: (faixa.x + faixa.width) / M, y0: faixa.y / M, y1: (faixa.y + faixa.height) / M };
    expect(r.x0 <= 49.5 && r.x1 >= 56).toBe(true); // atravessa a Travessa inteira
    expect(r.y0).toBeGreaterThanOrEqual(47); // ao sul do cruzamento (a rua do portão vai de y 41 a 47)
    expect(r.y0).toBeLessThan(48.5); // colada na esquina
    for (const [x, y] of [[50, (r.y0 + r.y1) / 2], [55.5, (r.y0 + r.y1) / 2]] as const) expect(reach(x, y), `faixa em (${x}, ${y})`).toBe(true);
    const sem = cenario.find((o) => o.type === 'semaforo')!;
    expect([prop(sem, 'quebrado'), prop(sem, 'faiscas')]).toEqual([true, true]);
    expect(at(sem).y).toBeLessThan(41.1); // na calçada das casas, atrás de quem anda na rua
    expect(Math.hypot(at(sem).x - 56, at(sem).y - 41)).toBeLessThan(1.5); // na esquina
    expect(reachNear(57, 40.1, 0.2)).toBe(true); // a calçada passa entre o semáforo e a figueira
  });

  it('a vida na rua: moto, placa de rua, cadeiras, vasos, lixo e bandeirinhas, sem fechar a calçada da casa amarela nem a roda da fogueira', () => {
    for (const type of ['moto', 'placa-rua', 'cadeira', 'vaso', 'lixo', 'bandeirinhas']) expect(cenario.some((o) => o.type === type), type).toBe(true);
    const sign = cenario.find((o) => o.type === 'placa-rua')!;
    expect([prop(sign, 'texto'), prop(sign, 'texto2')]).toEqual(['R. SANTO DIAS', 'TV. JASMIM DA BEIRADA']);
    expect(reachNear(84.2, 40.6, 0.4)).toBe(true); // entre as cadeiras e a moto, na calçada
    // as cadeiras da casa amarela ficam ao lado da porta (a porta é na ponta oeste da fachada, x 81,9 a 82,8), não na frente
    for (const c of cenario.filter((o) => o.type === 'cadeira' && at(o).y < 41)) expect(at(c).x - 0.25).toBeGreaterThan(82.8);
    expect(reachNear(82.35, 40.3, 0.3)).toBe(true); // a frente da porta, livre
    const fire = at(cenario.find((o) => o.type === 'fogueira')!);
    for (const [dx, dy] of [[0, -3.1], [0, 3.1], [-3.3, 0], [3.3, 0]] as const) {
      expect(reachNear(fire.x + dx, fire.y + dy, 0.5), `roda da fogueira (${fire.x + dx}, ${fire.y + dy})`).toBe(true);
    }
  });
});

describe('Mapa 01 (Capão), etapa 4c: campinho, viaduto e saídas', () => {
  const cenario = layer('cenario');

  it('o campinho de várzea: dá para andar no campo, as traves só seguram nos postes e o muro com grafite fica virado para o campo', () => {
    const field = layer('chao').find((o) => o.type === 'campinho')!;
    const [x0, y0, x1, y1] = [field.x / M, field.y / M, (field.x + field.width) / M, (field.y + field.height) / M];
    expect(reach((x0 + x1) / 2, (y0 + y1) / 2)).toBe(true);
    expect(cenario.filter((o) => o.type === 'trave' && old(o))).toHaveLength(2);
    expect(boxes.filter((b) => b.type === 'trave' && b.x0 < OLD_W)).toHaveLength(4); // dois postes por trave
    const muro = cenario.find((o) => o.type === 'muro')!;
    expect(prop(muro, 'grafite')).toBeTruthy();
    expect((muro.x + muro.width) / M).toBeLessThanOrEqual(x0); // o muro fica a oeste do campo...
    expect(prop(muro, 'lado')).toBe('leste'); // ...com a pintura virada para ele (o lado que a câmera vê)
  });

  it('o viaduto da Linha 5-Lilás: o tabuleiro e o trem lá em cima não seguram ninguém; os pilares e o ônibus seguram', () => {
    expect(boxes.some((b) => b.type === 'viaduto' || b.type === 'trem' || b.type === 'cipo')).toBe(false);
    expect(boxes.filter((b) => b.type === 'pilar-viaduto' && b.x0 < OLD_W)).toHaveLength(4);
    // (no Capão maior o tabuleiro segue até a beira nova, com mais pilares, de 10 em 10 m)
    const deck = cenario.find((o) => o.type === 'viaduto')!;
    expect((deck.x + deck.width) / M).toBe(map.width);
    expect(boxes.filter((b) => b.type === 'pilar-viaduto' && b.x0 >= OLD_W).length).toBeGreaterThanOrEqual(9);
    expect(boxes.filter((b) => b.type === 'onibus' && b.x0 < OLD_W)).toHaveLength(1);
    expect(reachNear(63, 4, 0.5)).toBe(true); // embaixo do viaduto, entre dois pilares
    expect(prop(cenario.find((o) => o.type === 'trem')!, 'cor')).toBe('#7d5ca8'); // lilás
  });

  it('a rua para Guarapiranga atravessa a mata até a beira do mapa, que é a saída para o Mapa 02; a mata dos lados continua fechada; a rua leste tem a placa da estação e segue para o Capão maior', () => {
    // (com o Mapa 02 no jogo, 19/11, a barreira saiu: a placa ficou num poste na beira da rua)
    expect(cenario.some((o) => o.type === 'barreira' && old(o))).toBe(false);
    for (let y = 81; y <= map.height - 1; y += 2) expect(reach(91, y), `rua em y = ${y}`).toBe(true);
    const exits = map.layers.find((l) => l.name === 'saidas')!.objects;
    expect(exits).toHaveLength(1);
    const exit = exits[0]!;
    expect([prop(exit, 'mapa'), prop(exit, 'chegada')]).toEqual(['guarapiranga', 'chegada-capao']);
    expect((exit.y + exit.height) / M).toBeCloseTo(map.height);
    const arrival = layer('pontos').find((o) => o.name === 'chegada-guarapiranga')!;
    expect(reach(at(arrival).x, at(arrival).y)).toBe(true);
    expect(at(arrival).y < exit.y / M - 2).toBe(true); // quem chega não cai de volta na saída
    const placa = cenario.find((o) => o.type === 'placa' && prop(o, 'texto') === 'GUARAPIRANGA')!;
    expect(prop(placa, 'poste')).toBe(true);
    const placas = cenario.filter((o) => o.type === 'placa').map((o) => prop(o, 'texto'));
    expect(placas).toEqual(expect.arrayContaining(['GUARAPIRANGA', 'ESTAÇÃO CAPÃO REDONDO']));
    // (desde o Capão maior, 23/11, a rua da vila segue para a direita até a beira nova, que fecha no mato)
    expect(reach(95.25, 44)).toBe(true);
    expect(reach(map.width - 0.75, 44)).toBe(false);
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
    // continua uma casa inteira; desde 13/11 dá para entrar (pedido do dono: a árvore nasce lá dentro)
    expect(prop(abandoned, 'interior')).toBe(true);
    const inside = (o: TiledObject) => o.x >= abandoned.x && o.x <= abandoned.x + abandoned.width && o.y >= abandoned.y && o.y <= abandoned.y + abandoned.height;
    expect(cenario.some((o) => o.type === 'arvore' && prop(o, 'dentroDaCasa') === true && inside(o))).toBe(true);
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

describe('Mapa 01 (Capão): o Parque Santo Dias de antes, engolido pela floresta (aprovado pelo dono em 13/11)', () => {
  const cenario = layer('cenario');
  const of = (t: string) => cenario.filter((o) => o.type === t);

  it('a placa PARQUE SANTO DIAS fica do lado de fora do portão, na frente do gradil e dos pilares (na tela), virada para a rua, sem fechar a calçada', () => {
    // (dentro do parque, atrás do pilar norte, o pilar ficava na frente dela e ela subia acima dele: o dono achou errado)
    const placa = of('placa').find((o) => prop(o, 'texto') === 'PARQUE SANTO DIAS')!;
    const { x, y } = at(placa);
    expect(x).toBeGreaterThan(48); // fora do gradil
    for (const p of of('pilar').filter((o) => Math.abs(o.x / M - 48) < 1)) expect(x + y, 'na frente do pilar, na tela').toBeGreaterThan((p.x + p.width + p.y + p.height) / M);
    expect(prop(placa, 'olhando')).toBe(0); // virada para a rua (leste)
    for (let yy = y - 1; yy <= y + 1; yy += 0.25) expect(footFree(49.1, yy), `calçada em y = ${yy}`).toBe(true);
  });

  it('as coisas do parque antigo estão lá: bebedouro, bancos de concreto, postes apagados, a academia e a pista de cimento', () => {
    expect(of('bebedouro').length).toBe(1);
    // (os da floresta maior ficam na Clareira da Paineira, mais ao sul)
    const old = (o: TiledObject) => o.y / M < 120;
    expect(of('banco').filter((o) => old(o) && prop(o, 'material') === 'concreto').length).toBe(3);
    expect(of('poste-praca').filter((o) => old(o) && prop(o, 'apagado') === true).length).toBe(3);
    expect(of('academia').map((o) => String(prop(o, 'aparelho'))).sort()).toEqual(['barra', 'remada', 'simulador-caminhada']);
    expect(layer('chao').filter((o) => o.type === 'calcada' && prop(o, 'quebrada') === true).length).toBeGreaterThanOrEqual(5);
  });

  it('o poste do parque da entrada não fica, na tela, na mesma linha do poste de concreto do portão (os dois se confundiam)', () => {
    const sx = (x: number, y: number) => (x - y) * Math.SQRT1_2;
    const gate = of('poste').find((o) => Math.abs(at(o).x - 50.5) < 0.01 && Math.abs(at(o).y - 40) < 0.01)!;
    for (const p of of('poste-praca').filter((o) => prop(o, 'apagado') === true)) {
      expect(Math.abs(sx(at(p).x, at(p).y) - sx(at(gate).x, at(gate).y))).toBeGreaterThan(0.5);
    }
  });
});

describe('Mapa 01 (Capão): casas com interior (pedido do dono em 13/11: "dar vida para alguns interiores de casa")', () => {
  const cenario = layer('cenario');
  const chao = layer('chao');
  const casa = (x0: number, y0: number) => cenario.find((o) => o.type === 'casa' && o.x / M === x0 && o.y / M === y0)!;
  const HOUSES = [
    { nome: 'amarela', casa: casa(81, 32), morador: 'familia', dentro: [83, 37] as const, moveis: ['pia', 'fogao', 'filtro', 'geladeira', 'mesa-cozinha', 'estante', 'sofa'] },
    { nome: 'rosa', casa: casa(64, 33), morador: 'vo', dentro: [66, 37.5] as const, moveis: ['cristaleira', 'sofa', 'mesa-redonda', 'maquina-costura', 'cama', 'vaso'] },
    { nome: 'abandonada', casa: casa(62, 13), morador: 'ninguem', dentro: [63.5, 17.5] as const, moveis: ['arvore', 'sofa'] },
  ];
  const inside = (o: TiledObject, h: TiledObject) => o.x >= h.x - 1e-6 && o.x + (o.width ?? 0) <= h.x + h.width + 1e-6 && o.y >= h.y - 1e-6 && o.y + (o.height ?? 0) <= h.y + h.height + 1e-6;

  it('cada uma tem interior, piso, uma porta de 1,2 m na frente por onde dá para entrar, e paredes no resto', () => {
    for (const { nome, casa: h, morador, dentro } of HOUSES) {
      expect(prop(h, 'interior'), nome).toBe(true);
      expect(prop(h, 'morador'), nome).toBe(morador);
      const [d0, d1] = [Number(prop(h, 'portaDe')), Number(prop(h, 'portaAte'))];
      expect(d1 - d0, `porta da ${nome}`).toBeCloseTo(1.2);
      expect(chao.some((o) => o.type === 'piso' && inside(o, h)), `piso da ${nome}`).toBe(true);
      const [x0, x1, y0, y1] = [h.x / M, (h.x + h.width) / M, h.y / M, (h.y + h.height) / M];
      expect(reach((d0 + d1) / 2, y1 + 0.5), `na frente da porta da ${nome}`).toBe(true);
      expect(reach((d0 + d1) / 2, y1 - 0.5), `logo depois da porta da ${nome}`).toBe(true);
      expect(reach(dentro[0], dentro[1]), `lá dentro da ${nome}`).toBe(true);
      // fora da porta, a frente é parede; os lados e o fundo também
      for (let x = x0 + 0.2; x <= x1 - 0.2; x += 0.25) if (x < d0 - 0.35 || x > d1 + 0.35) expect(footFree(x, y1 - 0.05), `frente da ${nome} em x = ${x}`).toBe(false);
      for (let y = y0 + 0.3; y <= y1 - 0.3; y += 0.5) for (const x of [x0 + 0.05, x1 - 0.05]) expect(footFree(x, y), `parede da ${nome} em (${x}, ${y})`).toBe(false);
    }
  });

  it('os móveis de cada casa ficam lá dentro: a cozinha e a sala da família, a casa da vó e a árvore que nasceu na casa abandonada', () => {
    for (const { nome, casa: h, moveis } of HOUSES) {
      for (const t of moveis) expect(cenario.some((o) => o.type === t && inside(o, h)), `${t} na ${nome}`).toBe(true);
    }
    const [amarela, rosa, abandonada] = HOUSES.map((h) => h.casa);
    expect(prop(cenario.find((o) => o.type === 'estante' && inside(o, amarela!))!, 'tv')).toBe(true);
    expect(prop(cenario.find((o) => o.type === 'mesa-cozinha' && inside(o, amarela!))!, 'toalha')).toBe('xadrez');
    expect(prop(cenario.find((o) => o.type === 'sofa' && inside(o, rosa!))!, 'croche')).toBe(true);
    // o Joaquim (o gato da vó, com vida, da [estrutura]): dorme em cima do sofá e anda pelo lado de dentro da casa
    const pontos = layer('pontos');
    const sono = pontos.find((o) => o.name === 'joaquim')!;
    const casaJ = pontos.find((o) => o.name === 'joaquim-casa')!;
    expect(inside(sono, rosa!) && inside(casaJ, rosa!)).toBe(true);
    expect(boxes.some((b) => b.type === 'sofa' && sono.x / M >= b.x0 && sono.x / M <= b.x1 && sono.y / M >= b.y0 && sono.y / M <= b.y1)).toBe(true);
    expect(cenario.some((o) => o.type === 'gato')).toBe(false); // o gatinho parado do sofá saiu quando ele ganhou vida
    expect(prop(cenario.find((o) => o.type === 'cama' && inside(o, rosa!))!, 'colcha')).toBe('retalhos');
    const tree = cenario.find((o) => o.type === 'arvore' && inside(o, abandonada!))!;
    expect(prop(tree, 'dentroDaCasa')).toBe(true);
    expect(boxes.some((b) => b.type === 'tronco' && Math.abs((b.x0 + b.x1) / 2 - at(tree).x) < 0.01)).toBe(true);
    expect(prop(cenario.find((o) => o.type === 'sofa' && inside(o, abandonada!))!, 'rasgado')).toBe(true);
    expect(chao.some((o) => o.type === 'colchao' && inside(o, abandonada!))).toBe(true);
  });
});

describe('Mapa 01 (Capão): a floresta maior (pedido do dono em 14/11, "aumentar a floresta"; planta aprovada)', () => {
  const cenario = layer('cenario');
  const chao = layer('chao');
  const of = (type: string) => cenario.filter((o) => o.type === type);
  const inRect = (x: number, y: number, o: TiledObject, pad = 0) => x >= o.x / M - pad && x <= (o.x + o.width) / M + pad && y >= o.y / M - pad && y <= (o.y + o.height) / M + pad;
  const screen = (x: number, y: number, z = 0) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2 * 0.5 - z * 0.866] as const;
  /** Por onde o pé vai a partir do nascimento, com caixas a mais fechando passagens (para provar que há duas). */
  const floodWith = (extra: Box[]) => {
    const cols = Math.round(map.width / STEP);
    const rows = Math.round(map.height / STEP);
    const seen = new Uint8Array(cols * rows);
    const free = (x: number, y: number) =>
      footFree(x, y) && !extra.some((b) => x - FOOT.w / 2 < b.x1 && x + FOOT.w / 2 > b.x0 && y - FOOT.h / 2 < b.y1 && y + FOOT.h / 2 > b.y0);
    const queue = [Math.round(SPAWN.y / STEP) * cols + Math.round(SPAWN.x / STEP)];
    seen[queue[0]!] = 1;
    while (queue.length > 0) {
      const cell = queue.pop()!;
      const [i, j] = [cell % cols, Math.floor(cell / cols)];
      for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as const) {
        if (ni < 2 || nj < 2 || ni >= cols - 2 || nj >= rows - 2) continue;
        const k = nj * cols + ni;
        if (seen[k] || !free(ni * STEP, nj * STEP)) continue;
        seen[k] = 1;
        queue.push(k);
      }
    }
    return (x: number, y: number) => seen[Math.round(y / STEP) * cols + Math.round(x / STEP)] === 1;
  };

  it('o parque ao sul: a Clareira da Paineira com o parquinho antigo, a Cachoeirinha, as pedras do riacho e o recanto do Véu', () => {
    const paineira = cenario.find((o) => o.type === 'arvore' && prop(o, 'especie') === 'paineira')!;
    expect(paineira.name).toBe('Paineira');
    expect(Math.hypot(at(paineira).x - 32, at(paineira).y - 150)).toBeLessThan(8);
    expect(reachNear(32, 150, 1)).toBe(true); // a clareira
    expect(of('parquinho').filter(old).map((o) => String(prop(o, 'brinquedo'))).sort()).toEqual(['balanco', 'escorregador', 'gira-gira']);
    for (const o of of('parquinho').filter(old)) expect(Math.hypot(at(o).x - 32, at(o).y - 150), String(prop(o, 'brinquedo'))).toBeLessThan(6.5);
    // a cachoeirinha: as pedras de onde o riacho cai, na ponta norte do poço
    const fall = of('cachoeira')[0]!;
    expect(fall.name).toBe('Cachoeirinha');
    const pool = chao.find((o) => o.type === 'agua' && o.polygon && inPolygon(14.3, 159.5, o))!;
    expect(pool).toBeDefined();
    expect(inPolygon(at(fall).x, at(fall).y + 1, pool)).toBe(true);
    expect(reach(14.3, 159.5)).toBe(false); // ninguém anda dentro do poço
    // as pedras de atravessar o riacho: dá para andar em cima, e logo acima e abaixo delas é água
    const stones = of('pinguela').find((o) => prop(o, 'pedras') === true)!;
    const [sx, sy] = [at(stones).x, at(stones).y];
    expect(reach(sx, sy)).toBe(true);
    for (const dy of [-2, 2]) expect(footFree(sx, sy + dy), `riacho em y = ${sy + dy}`).toBe(false);
    // o recanto do Véu no fim da trilha da mata profunda do sul, do outro lado do riacho
    const veu = of('veu').find((v) => at(v).y > 160)!;
    expect(at(veu).x).toBeLessThan(sx);
    expect(reachNear(at(veu).x, at(veu).y, 2)).toBe(true);
    const names = layer('areas').map((a) => a.name);
    expect(names).toEqual(expect.arrayContaining(['Clareira da Paineira', 'Cachoeirinha', 'Mata da Estrada', 'Posto Abandonado', 'Estrada para Guarapiranga']));
    expect(prop(layer('areas').find((a) => a.name === 'Cachoeirinha')!, 'som')).toBe('agua');
  });

  it('dá para dar a volta inteira sem voltar pelo mesmo caminho: parque, buraco no gradil, mata da estrada, posto e rua', () => {
    // o gradil só abre no Portão I e no buraco
    const gradis = of('gradil');
    const hole = { y0: 160, y1: 162.4 };
    for (let y = 48; y < 179.5; y += 0.5) if (y < hole.y0 - 0.25 || y > hole.y1 + 0.25) expect(footFree(48, y), `gradil em y = ${y}`).toBe(false);
    expect(footFree(48, (hole.y0 + hole.y1) / 2)).toBe(true);
    expect(gradis.filter((g) => prop(g, 'estado') === 'quebrado' && old(g))).toHaveLength(2); // um pedaço torto em cada ponta do buraco
    // a parede de mata da rua só abre na boca do posto
    const posto = chao.find((o) => o.type === 'calcada' && prop(o, 'estado') === 'rachado')!;
    const [py0, py1] = [posto.y / M, (posto.y + posto.height) / M];
    // (os arbustos da parede ficam de 1,1 em 1,1 m: a boca passa até um arbusto da beira do pátio)
    for (let y = 82; y < 173; y += 0.5) if (y < py0 - 1.2 || y > py1 + 1.2) expect(footFree(87.3, y), `parede da rua em y = ${y}`).toBe(false);
    // duas passagens para a mata da estrada: fechando o buraco, ainda se chega no posto pela rua; fechando a boca do posto,
    // ainda se chega nele pelo parque (então dá para ir por um lado e voltar pelo outro)
    const noHole = floodWith([{ x0: 47.5, x1: 48.5, y0: hole.y0, y1: hole.y1, type: 'teste' }]);
    const noMouth = floodWith([{ x0: 86, x1: 88.5, y0: py0 - 1, y1: py1 + 1, type: 'teste' }]);
    for (const go of [noHole, noMouth]) {
      expect(go(76, 146)).toBe(true); // o pátio do posto, entre a lojinha e a árvore que rompeu o concreto
      expect(go(91, 160)).toBe(true); // a rua
      expect(go(55, 160.5)).toBe(true); // a trilha da mata da estrada
    }
  });

  it('o posto abandonado: a cobertura (só os pilares seguram o pé) com duas bombas, a lojinha, os pneus e a placa em branco, sem marca nenhuma', () => {
    const roof = of('cobertura')[0]!;
    expect(Number(prop(roof, 'altura'))).toBeGreaterThan(3.5);
    const pillars = boxes.filter((b) => b.type === 'pilar-cobertura');
    expect(pillars).toHaveLength(4);
    for (const p of pillars) expect(inRect((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, roof)).toBe(true);
    expect(footFree(at(roof).x, at(roof).y - 2.4)).toBe(true); // embaixo da cobertura dá para andar
    const pumps = of('bomba');
    expect(pumps).toHaveLength(2);
    for (const b of pumps) expect(inRect(at(b).x, at(b).y, roof)).toBe(true);
    const shop = of('casa').find((o) => prop(o, 'posto') === true)!;
    expect(inRect(at(shop).x, at(shop).y, chao.find((o) => o.type === 'calcada' && prop(o, 'estado') === 'rachado')!)).toBe(true);
    expect(of('pneus').filter(old)).toHaveLength(1);
    const sign = of('placa').find((o) => inRect(at(o).x, at(o).y, chao.find((c) => c.type === 'calcada' && prop(c, 'estado') === 'rachado')!))!;
    expect(prop(sign, 'texto')).toBe(''); // em branco: lugar real sim, marca não
    // tudo que é novo tem a sua colisão; a pedrinha passa pelo que é baixo ou fino
    for (const o of [...pumps, shop, ...of('pneus').filter(old), ...of('cachoeira'), ...of('parquinho').filter((p) => prop(p, 'brinquedo') !== 'balanco' && old(p))]) {
      expect(boxes.some((b) => at(o).x >= b.x0 - 1e-6 && at(o).x <= b.x1 + 1e-6 && at(o).y >= b.y0 - 1e-6 && at(o).y <= b.y1 + 1e-6), `${o.type} em (${at(o).x}, ${at(o).y})`).toBe(true);
    }
    const swing = of('parquinho').find((p) => prop(p, 'brinquedo') === 'balanco' && old(p))!;
    expect(boxes.filter((b) => b.type === 'parquinho' && inRect((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, swing))).toHaveLength(2); // só os pés de ferro
    expect(footFree(at(swing).x, at(swing).y)).toBe(true);
    for (const o of layer('colisao').filter((c) => ['pilar-cobertura', 'pneus', 'parquinho'].includes(c.type))) expect(prop(o, 'bloqueiaTiro'), o.type).toBe(false);
  });

  it('na mata da estrada e na faixa nova do parque não há vão de entalar (onde o pé de 0,6 × 0,4 começaria a entrar)', () => {
    const region = boxes.filter((b) => b.type !== 'agua' && ((b.x1 > 47.8 && b.y1 > 78) || (b.y1 > 117 && b.x0 < 48.3)));
    /** Cabe um quadrado de 0,3 m no vão, fora das outras caixas? (os arbustos da parede se encostam e deixam só dentes) */
    const pocket = (a: Box, b: Box) => {
      const inX = a.x1 <= b.x0 || b.x1 <= a.x0;
      const [g0, g1] = inX ? (a.x1 <= b.x0 ? [a.x1, b.x0] : [b.x1, a.x0]) : a.y1 <= b.y0 ? [a.y1, b.y0] : [b.y1, a.y0];
      const [m0, m1] = inX ? [Math.max(a.y0, b.y0), Math.min(a.y1, b.y1)] : [Math.max(a.x0, b.x0), Math.min(a.x1, b.x1)];
      const r = inX ? { x0: g0!, x1: g1!, y0: m0, y1: m1 } : { x0: m0, x1: m1, y0: g0!, y1: g1! };
      const others = region.filter((c) => c !== a && c !== b && c.x1 > r.x0 && c.x0 < r.x1 && c.y1 > r.y0 && c.y0 < r.y1);
      for (let x = r.x0; x + 0.3 <= r.x1 + 1e-6; x += 0.05) {
        for (let y = r.y0; y + 0.3 <= r.y1 + 1e-6; y += 0.05) if (!others.some((c) => x < c.x1 && x + 0.3 > c.x0 && y < c.y1 && y + 0.3 > c.y0)) return true;
      }
      return false;
    };
    const bad: string[] = [];
    for (let i = 0; i < region.length; i++) {
      for (let j = i + 1; j < region.length; j++) {
        const [a, b] = [region[i]!, region[j]!];
        if (a.type === 'mata-fechada' && b.type === 'mata-fechada') continue;
        const [dx, dy] = [Math.max(0, b.x0 - a.x1, a.x0 - b.x1), Math.max(0, b.y0 - a.y1, a.y0 - b.y1)];
        if ((dx > 0 && dy > 0) || dx + dy <= 0.3 || dx + dy >= 1.2) continue;
        if (pocket(a, b)) bad.push(`vão de ${(dx + dy).toFixed(2)} m entre ${a.type} (${a.x0.toFixed(2)}, ${a.y0.toFixed(2)}) e ${b.type} (${b.x0.toFixed(2)}, ${b.y0.toFixed(2)})`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('as árvores da mata da estrada não tampam, vistas da câmera, a rua, a trilha do gradil nem o pátio do posto', () => {
    const keys: [number, number][] = [];
    const trail = chao.find((o) => o.type === 'trilha' && o.polyline && Math.abs(o.x / M + o.polyline[0]!.x / M - 48) < 0.01)!;
    const tp = trail.polyline!.map((p) => [(trail.x + p.x) / M, (trail.y + p.y) / M] as [number, number]);
    for (let i = 0; i + 1 < tp.length; i++) {
      const [[ax, ay], [bx, by]] = [tp[i]!, tp[i + 1]!];
      const len = Math.hypot(bx - ax, by - ay);
      for (let d = 0; d <= len; d += 1) keys.push([ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len]);
    }
    // (a rua desce até a beira do mapa, a saída para o Mapa 02)
    for (let x = 89; x <= 93; x += 1) for (let y = 80; y < map.height; y += 2) keys.push([x, y]);
    const posto = chao.find((o) => o.type === 'calcada' && prop(o, 'estado') === 'rachado')!;
    const shop = of('casa').find((o) => prop(o, 'posto') === true)!;
    for (let x = posto.x / M + 1; x < (posto.x + posto.width) / M; x += 2) for (let y = posto.y / M + 1; y < (posto.y + posto.height) / M; y += 2) if (!inRect(x, y, shop)) keys.push([x, y]);
    const bad: string[] = [];
    for (const o of cenario.filter((c) => (c.type === 'arvore' || c.type === 'bambu') && at(c).x > 48 && at(c).y > 80)) {
      const { x, y } = at(o);
      const copa = o.type === 'bambu' ? Number(prop(o, 'raio')) * 1.3 : Number(prop(o, 'copa'));
      const [cx, cy] = screen(x, y, Number(prop(o, 'altura')));
      for (const [kx, ky] of keys) {
        if (kx + ky >= x + y) continue;
        const [sx, sy] = screen(kx, ky);
        if (Math.hypot(sx - cx, sy - cy) < copa * 1.05) {
          bad.push(`${o.type} em (${x}, ${y}) tampa (${kx.toFixed(1)}, ${ky.toFixed(1)})`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('os bichos novos moram nas áreas deles (e existem nos dados) e as capivaras têm onde andar e onde descansar', () => {
    const monsters = JSON.parse(readFileSync('data/monsters.json', 'utf8')) as Record<string, unknown>;
    const zones = layer('monstros').filter((z) => ['quati', 'tatu_bola', 'marimbondo', 'filhote_boitata'].includes(String(z.name)) && old(z));
    expect(zones.map((z) => z.name)).toEqual(['quati', 'tatu_bola', 'marimbondo', 'filhote_boitata']);
    for (const z of zones) expect(Object.keys(monsters), String(z.name)).toContain(z.name);
    const chefe = zones.find((z) => z.name === 'filhote_boitata')!;
    expect(prop(chefe, 'quantidade')).toBe(2); // os mais fortes são poucos, no recanto do Véu
    const veu = of('veu').find((v) => at(v).y > 160)!;
    expect(inRect(at(veu).x, at(veu).y, chefe)).toBe(true);
    const pontos = layer('pontos');
    for (const lugar of ['lago', 'campinho']) {
      const area = pontos.find((o) => o.name === `capivaras-${lugar}`)!;
      const rest = pontos.find((o) => o.name === `capivaras-${lugar}-descanso`)!;
      expect(area.width, lugar).toBeGreaterThan(0);
      expect(inRect(rest.x / M, rest.y / M, area), lugar).toBe(true);
      expect(reachNear(rest.x / M, rest.y / M, 1.5), lugar).toBe(true);
    }
  });

  it('a vila ganhou árvores no terreno dos fundos e na beira do campinho, sem nenhuma em rua, calçada, praça ou campinho', () => {
    const back = cenario.filter((o) => o.type === 'arvore' && at(o).x > 57 && at(o).x < 95 && at(o).y > 7 && at(o).y < 30);
    expect(back.length).toBeGreaterThanOrEqual(15); // as 5 de antes e as 10 novas (fora a da casa abandonada)
    const paved = chao.filter((o) => ['asfalto', 'calcada', 'praca', 'campinho', 'faixa'].includes(o.type) && !o.polygon && !o.polyline && o.y / M < 80);
    // (a Árvore da Praça e a Figueira da Esquina, com nome, ficam na praça e na calçada de propósito)
    for (const t of cenario.filter((o) => o.type === 'arvore' && !o.name && at(o).x > 57 && at(o).y < 80 && prop(o, 'rompendo') !== true && prop(o, 'dentroDaCasa') !== true)) {
      expect(paved.some((p) => inRect(at(t).x, at(t).y, p)), `árvore em (${at(t).x}, ${at(t).y})`).toBe(false);
    }
  });
});

describe('Mapa 01 (Capão): o Capão maior (23/11, planta aprovada pelo dono: o mapa cresce para a direita)', () => {
  const cenario = layer('cenario');
  const chao = layer('chao');
  const isNew = (o: TiledObject) => o.x / M >= OLD_W;
  const inRect = (x: number, y: number, o: TiledObject) => x >= o.x / M && x <= (o.x + o.width) / M && y >= o.y / M && y <= (o.y + o.height) / M;
  const named = (name: string) => cenario.find((o) => o.name === name)!;
  const screen = (x: number, y: number, z = 0) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2 * 0.5 - z * 0.866] as const;
  /** Por onde o pé vai a partir do nascimento, com caixas a mais fechando passagens (para provar que uma é a única). */
  const floodWith = (extra: Box[]) => {
    const cols = Math.round(map.width / STEP);
    const rows = Math.round(map.height / STEP);
    const seen = new Uint8Array(cols * rows);
    const free = (x: number, y: number) =>
      footFree(x, y) && !extra.some((b) => x - FOOT.w / 2 < b.x1 && x + FOOT.w / 2 > b.x0 && y - FOOT.h / 2 < b.y1 && y + FOOT.h / 2 > b.y0);
    const queue = [Math.round(SPAWN.y / STEP) * cols + Math.round(SPAWN.x / STEP)];
    seen[queue[0]!] = 1;
    while (queue.length > 0) {
      const cell = queue.pop()!;
      const [i, j] = [cell % cols, Math.floor(cell / cols)];
      for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as const) {
        if (ni < 2 || nj < 2 || ni >= cols - 2 || nj >= rows - 2) continue;
        const k = nj * cols + ni;
        if (seen[k] || !free(ni * STEP, nj * STEP)) continue;
        seen[k] = 1;
        queue.push(k);
      }
    }
    return (x: number, y: number) => seen[Math.round(y / STEP) * cols + Math.round(x / STEP)] === 1;
  };
  const boxOf = (o: TiledObject, type = 'teste'): Box => ({ x0: o.x / M, y0: o.y / M, x1: (o.x + o.width) / M, y1: (o.y + o.height) / M, type });

  it('a rua da vila segue até a beira nova (1,5 m livres o caminho todo) e as ruas novas levam ao viaduto, à estação e à mata', () => {
    for (let x = OLD_W - 2; x <= map.width - 3; x += 0.25) for (const y of [43.25, 44, 44.75]) expect(footFree(x, y), `rua em (${x}, ${y})`).toBe(true);
    const places: [string, number, number][] = [
      ['Rua Nova, no norte', 125, 12],
      ['o caminho embaixo do viaduto', 110, 9.25],
      ['o quintal dos fundos do comércio', 108, 27],
      ['a viela entre as casas', 109.25, 57.25],
      ['a Rua Dois', 110, 68.75],
      ['Rua da Feira, no sul', 125, 88],
      ['Rua do Córrego, na estação', 151, 12],
      ['a ponte do córrego', 151, 137],
      ['a Rua do Córrego antes da barreira', 151, 174],
      ['a trilha do ferro-velho', 118.5, 100],
      ['a prainha do córrego', 121.8, 160],
      ['o largo da estação', 172, 14.5],
      ['a pracinha', 165, 22],
    ];
    for (const [name, x, y] of places) expect(reachNear(x, y, 0.5), name).toBe(true);
    // a beira nova (leste e sul) fecha no mato, como a de antes
    for (let y = 2; y <= map.height - 2; y += 0.5) expect(reach(map.width - 0.75, y), `beira leste em y = ${y}`).toBe(false);
    for (let x = OLD_W + 1; x <= map.width - 2; x += 0.5) expect(reach(x, map.height - 0.75), `beira sul em x = ${x}`).toBe(false);
  });

  it('o comércio fica de frente para a rua (padaria, bar, salão e açougue), com letreiro e sem marca nenhuma', () => {
    const shops = cenario.filter((o) => o.type === 'casa' && isNew(o) && prop(o, 'comercio'));
    expect(shops.map((o) => String(prop(o, 'letreiro')))).toEqual(['PADARIA', 'BAR DO TIÃO', 'SALÃO DA CIDA', 'AÇOUGUE']);
    for (const o of shops) {
      expect((o.y + o.height) / M, String(o.name)).toBeCloseTo(39.5); // a frente na calçada da rua (o lado que a câmera vê)
      expect(prop(o, 'toldo'), String(o.name)).toBeTruthy();
    }
    // a vila nova: casas de laje com planta, e ninguém entra nelas
    const houses = cenario.filter((o) => o.type === 'casa' && isNew(o));
    expect(houses.length).toBeGreaterThanOrEqual(30);
    for (const h of houses) expect(reach(at(h).x, at(h).y), String(h.name || `casa em (${at(h).x}, ${at(h).y})`)).toBe(false);
  });

  it('a feira livre: 15 bancas em três fileiras viradas para o sul, com corredores de 3 m, e a pedrinha passa por cima delas', () => {
    const stalls = cenario.filter((o) => o.type === 'banca-frutas' && isNew(o));
    expect(stalls).toHaveLength(15);
    expect(new Set(stalls.map((o) => o.y)).size).toBe(3);
    const area = layer('areas').find((o) => o.name === 'Feira Livre')!;
    for (const o of stalls) {
      expect(inRect(at(o).x, at(o).y, area)).toBe(true);
      expect(footFree(at(o).x, at(o).y)).toBe(false);
    }
    for (const y of [53.75, 58, 62.6]) expect(reachNear(138, y, 0.5), `corredor em y = ${y}`).toBe(true);
    for (const o of layer('colisao').filter((c) => c.type === 'banca' && c.x / M >= OLD_W)) expect(prop(o, 'bloqueiaTiro')).toBe(false);
  });

  it('a escola estadual abandonada: o prédio, a quadra com traves e o portão aberto, a única entrada (gradil e muro no resto)', () => {
    const escola = named('Escola Estadual');
    expect([prop(escola, 'abandonada'), prop(escola, 'pintura')]).toEqual([true, 'ESCOLA ESTADUAL']);
    const quadra = chao.find((o) => o.type === 'campinho' && isNew(o))!;
    expect(reach(at(quadra).x, at(quadra).y)).toBe(true);
    expect(cenario.filter((o) => o.type === 'trave' && isNew(o))).toHaveLength(2);
    const gate = named('Portão da Escola');
    expect(prop(gate, 'aberto')).toBe(true);
    const closed = floodWith([boxOf(gate)]);
    expect(closed(at(quadra).x, at(quadra).y)).toBe(false);
  });

  it('a Estação Capão Redondo fica fechada (a barreira na porta e a placa), com o largo e a pracinha na frente', () => {
    const estacao = named('Estação Capão Redondo');
    expect(prop(estacao, 'pintura')).toBe('ESTAÇÃO CAPÃO REDONDO');
    expect(reach(at(estacao).x, at(estacao).y)).toBe(false);
    const barrier = cenario.find((o) => o.type === 'barreira' && isNew(o) && o.y / M < 20)!;
    expect(at(barrier).x).toBeGreaterThan(estacao.x / M);
    expect(at(barrier).x).toBeLessThan((estacao.x + estacao.width) / M);
    expect(cenario.some((o) => o.type === 'placa' && prop(o, 'texto') === 'ESTAÇÃO FECHADA')).toBe(true);
    expect(layer('saidas')).toHaveLength(1); // a saída para o leste fica para depois
    const pracinha = chao.find((o) => o.type === 'praca' && isNew(o))!;
    expect(reach(at(pracinha).x - 6, at(pracinha).y)).toBe(true);
    expect(cenario.filter((o) => o.type === 'parquinho' && isNew(o)).map((o) => String(prop(o, 'brinquedo'))).sort()).toEqual(['balanco', 'escorregador', 'gira-gira']);
  });

  it('o córrego: ninguém entra na água, menos na ponte da Rua do Córrego (com guarda-corpo dos dois lados)', () => {
    const water = chao.find((o) => o.type === 'agua' && o.polyline && isNew({ ...o, x: o.x + o.polyline[0]!.x }))!;
    const pts = water.polyline!.map((p) => [(water.x + p.x) / M, (water.y + p.y) / M] as [number, number]);
    let bridge = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [[ax, ay], [bx, by]] = [pts[i]!, pts[i + 1]!];
      for (let t = 0; t <= 1; t += 0.1) {
        const [x, y] = [ax + (bx - ax) * t, ay + (by - ay) * t];
        if (x < OLD_W + 1 || x > map.width - 1 || y > map.height - 1) continue;
        const onRoad = x > 148.3 && x < 153.7;
        if (onRoad) bridge++;
        expect(footFree(x, y), `córrego em (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(onRoad);
      }
    }
    expect(bridge).toBeGreaterThan(0);
    const rails = cenario.filter((o) => o.type === 'gradil' && isNew(o) && o.y / M > 100);
    expect(rails.map((o) => o.x / M).sort((a, b) => a - b)).toEqual([148, 153.8]);
    for (const r of rails) expect(footFree(at(r).x, at(r).y)).toBe(false);
  });

  it('o ferro-velho é murado (só se entra pelo portão), com o escritório, os carros velhos, o ônibus e os pneus', () => {
    const area = layer('areas').find((o) => o.name === 'Ferro-Velho')!;
    const inside = (o: TiledObject) => inRect(at(o).x, at(o).y, area);
    expect(cenario.filter((o) => o.type === 'carro' && inside(o)).length).toBeGreaterThanOrEqual(6);
    expect(cenario.filter((o) => o.type === 'onibus' && inside(o))).toHaveLength(1);
    expect(cenario.filter((o) => o.type === 'pneus' && inside(o)).length).toBeGreaterThanOrEqual(3);
    const yard = [114, 109.5] as const; // entre o escritório e os carros
    expect(reachNear(yard[0], yard[1], 0.5)).toBe(true);
    const gate = named('Portão do Ferro-Velho');
    expect(prop(gate, 'aberto')).toBe(true);
    expect(floodWith([boxOf(gate)])(yard[0], yard[1])).toBe(false);
  });

  it('o morro: as casas dos dois lados do escadão, e dá para subir do pé dele até o alto', () => {
    const area = layer('areas').find((o) => o.name === 'Morro do Escadão')!;
    expect(cenario.filter((o) => o.type === 'casa' && inRect(at(o).x, at(o).y, area)).length).toBeGreaterThanOrEqual(10);
    for (let y = 148; y <= 173; y += 1) expect(reachNear(174.5, y, 0.5), `escadão em y = ${y}`).toBe(true);
  });

  it('a vila nova é zona segura; os bichos da Mata do Córrego moram fora dela, em lugar alcançável', () => {
    const safe = (x: number, y: number) => layer('seguro').some((o) => inRect(x, y, o));
    for (const [x, y] of [[110, 44], [171, 27], [138, 58], [172, 75], [110, 85]] as const) expect(safe(x, y), `(${x}, ${y})`).toBe(true);
    for (const [x, y] of [[130, 120], [172, 160]] as const) expect(safe(x, y), `(${x}, ${y})`).toBe(false);
    const zones = layer('monstros').filter(isNew);
    expect(zones.map((z) => z.name)).toEqual(['quati', 'tatu_bola', 'marimbondo', 'jararaca']);
    for (const z of zones) expect(reachNear(at(z).x, at(z).y, 4), String(z.name)).toBe(true);
  });

  it('nenhuma árvore da parte nova tampa, vista da câmera, as ruas, a feira, a quadra ou as trilhas da mata', () => {
    const keys: [number, number][] = [];
    for (let x = OLD_W; x <= map.width - 2; x += 1) keys.push([x, 44]);
    for (let y = 11; y < 41; y += 1) keys.push([125, y], [151, y]);
    for (let y = 47; y < 90; y += 1) keys.push([125, y]);
    for (let y = 47; y < 175; y += 1) keys.push([151, y]);
    for (const y of [53.75, 58, 62.6]) for (let x = 130; x < 146.5; x += 1) keys.push([x, y]);
    const quadra = chao.find((o) => o.type === 'campinho' && isNew(o))!;
    for (let x = quadra.x / M + 1; x < (quadra.x + quadra.width) / M; x += 2) for (let y = quadra.y / M + 1; y < (quadra.y + quadra.height) / M; y += 2) keys.push([x, y]);
    for (const t of chao.filter((o) => o.type === 'trilha' && o.polyline && isNew({ ...o, x: o.x + o.polyline[0]!.x }))) {
      for (const p of t.polyline!) keys.push([(t.x + p.x) / M, (t.y + p.y) / M]);
    }
    const bad: string[] = [];
    for (const o of cenario.filter((c) => (c.type === 'arvore' || c.type === 'bambu') && isNew(c))) {
      const { x, y } = at(o);
      const copa = o.type === 'bambu' ? Number(prop(o, 'raio')) * 1.3 : Number(prop(o, 'copa'));
      const [cx, cy] = screen(x, y, Number(prop(o, 'altura')));
      for (const [kx, ky] of keys) {
        if (kx + ky >= x + y) continue;
        const [sx, sy] = screen(kx, ky);
        if (Math.hypot(sx - cx, sy - cy) < copa * 1.05) {
          bad.push(`${o.type} em (${x}, ${y}) tampa (${kx.toFixed(1)}, ${ky.toFixed(1)})`);
          break;
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe('Mapa 01 (Capão): o mapa visto de cima, para a tecla M e o mini mapa (formato combinado com a [estrutura])', () => {
  it('a imagem e a lista de nomes existem ao lado do mapa e têm o tamanho dele', () => {
    const json = JSON.parse(readFileSync('public/assets/maps-iso/capao-mapa.json', 'utf8')) as {
      escala: number;
      largura: number;
      altura: number;
      nomes: { nome: string; x: number; y: number; tipo: string }[];
    };
    expect([json.largura, json.altura]).toEqual([map.width, map.height]);
    // o PNG: a largura e a altura ficam nos bytes 16 a 23 do cabeçalho
    const png = readFileSync('public/assets/maps-iso/capao-mapa.png');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([map.width * json.escala, map.height * json.escala]);
    // os nomes são os das áreas e os dos lugares com nome, dentro do mapa
    for (const a of layer('areas').filter((o) => o.name)) expect(json.nomes.some((n) => n.nome === a.name), a.name).toBe(true);
    for (const n of json.nomes) expect(n.x >= 0 && n.x <= map.width && n.y >= 0 && n.y <= map.height, n.nome).toBe(true);
    expect(json.nomes.find((n) => n.nome === 'Vila do Capão')!.tipo).toBe('vila');
  });
});

describe('Mapa 01 (Capão): as capivaras andando (pedido do dono em 14/11; o formato é da [estrutura])', () => {
  it('cada bando tem a área onde anda e o ponto onde deita (dentro da área, em lugar livre e alcançável)', () => {
    const pontos = layer('pontos');
    const bichos = JSON.parse(readFileSync('data/bichos.json', 'utf8')) as Record<string, { area?: string; dorme?: string; mapa?: string }>;
    const bandos = Object.values(bichos).filter((b) => b.mapa === 'capao' && b.area?.startsWith('capivaras-'));
    expect(bandos.length).toBeGreaterThanOrEqual(2); // o do lago e o do campinho
    for (const b of bandos) {
      const area = pontos.find((o) => o.name === b.area)!;
      expect(area, b.area).toBeDefined();
      const bed = pontos.find((o) => o.name === (b.dorme ?? `${b.area}-descanso`))!;
      expect(bed, `${b.area}-descanso`).toBeDefined();
      const [x, y] = [bed.x / M, bed.y / M];
      expect(x >= area.x / M && x <= (area.x + area.width) / M && y >= area.y / M && y <= (area.y + area.height) / M, b.area).toBe(true);
      expect(footFree(x, y), b.area).toBe(true);
      expect(reachNear(x, y, 1), b.area).toBe(true);
    }
  });
});
