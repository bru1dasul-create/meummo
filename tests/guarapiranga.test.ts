// Mapa 02 do mundo novo (Represa de Guarapiranga), no formato combinado com a [estrutura]: tudo em camadas de objetos,
// 1 tile = 1 metro, colisão tirada do cenário. 400 × 320 m (22/11, o escopo do dono): a represa no meio, com a Ilha do
// Véu; a chegada pela Estrada do M'Boi Mirim e o Refúgio, sobre palafitas, no canto de cima à esquerda (no mesmo lugar de
// antes); a estrada contorna a represa pelo norte e pelo leste (a comunidade, o campinho, a praça, o clube, a barragem de
// 1909) até a saída para Santo Amaro, ainda fechada; a trilha da margem sul desce pelo oeste (o mirante, o brejo, a
// caverna) até o muro da barragem, que fecha a volta; ao sul do muro, a várzea de caça.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GameMap, type TiledMap } from '../src/shared/map';
import { TRADE_RANGE } from '../src/shared/constants';
import { bodyFits, cornerAtFeet } from '../src/shared/movement';

interface TiledObject {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  polygon?: { x: number; y: number }[];
  polyline?: { x: number; y: number }[];
  properties?: { name: string; value: string | number | boolean }[];
}
interface Layer {
  name: string;
  type: string;
  objects: TiledObject[];
}
const FILE = 'public/assets/maps-iso/guarapiranga.tmj';
const map = JSON.parse(readFileSync(FILE, 'utf8')) as {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: Layer[];
  properties?: { name: string; value: unknown }[];
};
const M = map.tilewidth; // pixels por metro
const layer = (name: string) => map.layers.find((l) => l.name === name)?.objects ?? [];
const prop = (o: TiledObject, name: string) => o.properties?.find((p) => p.name === name)?.value;
const at = (o: TiledObject) => (o.point ? { x: o.x / M, y: o.y / M } : { x: (o.x + o.width / 2) / M, y: (o.y + o.height / 2) / M });
const named = (layerName: string, name: string) => layer(layerName).find((o) => o.name === name)!;
const ptsOf = (o: TiledObject) => (o.polyline ?? o.polygon)!.map((p) => [(o.x + p.x) / M, (o.y + p.y) / M] as [number, number]);

/** Retângulos em metros. */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  type: string;
}
const rectOf = (o: TiledObject, type = o.type): Box => ({ x0: o.x / M, y0: o.y / M, x1: (o.x + o.width) / M, y1: (o.y + o.height) / M, type });
const boxes: Box[] = layer('colisao').map((o) => rectOf(o));
const BUCKET = 2;
const bucketKey = (i: number, j: number) => i * 4096 + j;
const buckets = new Map<number, Box[]>();
for (const b of boxes) {
  for (let i = Math.floor(b.x0 / BUCKET); i <= Math.floor(b.x1 / BUCKET); i++) {
    for (let j = Math.floor(b.y0 / BUCKET); j <= Math.floor(b.y1 / BUCKET); j++) {
      const k = bucketKey(i, j);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(b);
    }
  }
}
/** O pé do personagem novo (movimento livre): uma caixa de 0,6 × 0,4 m. */
const FOOT = { w: 0.6, h: 0.4 };
function footFree(x: number, y: number): boolean {
  const [x0, x1, y0, y1] = [x - FOOT.w / 2, x + FOOT.w / 2, y - FOOT.h / 2, y + FOOT.h / 2];
  for (let i = Math.floor(x0 / BUCKET); i <= Math.floor(x1 / BUCKET); i++) {
    for (let j = Math.floor(y0 / BUCKET); j <= Math.floor(y1 / BUCKET); j++) {
      for (const b of buckets.get(bucketKey(i, j)) ?? []) if (x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0) return false;
    }
  }
  return true;
}
const ARRIVAL = at(named('pontos', 'chegada-capao'));
const SPAWN = at(named('pontos', 'spawn'));
/** Grade de 0,25 m no mapa inteiro: onde o pé não cabe (cada caixa de colisão, alargada pela metade do pé). */
const STEP = 0.25;
const COLS = Math.round(map.width / STEP);
const ROWS = Math.round(map.height / STEP);
const blocked = (() => {
  const grid = new Uint8Array(COLS * ROWS);
  const [hw, hh] = [FOOT.w / 2, FOOT.h / 2];
  for (const b of boxes) {
    // (a mesma conta do footFree, casa por casa, para não errar na beirada)
    const [i0, i1] = [Math.max(0, Math.floor((b.x0 - hw) / STEP) - 1), Math.min(COLS - 1, Math.ceil((b.x1 + hw) / STEP) + 1)];
    const [j0, j1] = [Math.max(0, Math.floor((b.y0 - hh) / STEP) - 1), Math.min(ROWS - 1, Math.ceil((b.y1 + hh) / STEP) + 1)];
    for (let j = j0; j <= j1; j++) {
      const y = j * STEP;
      if (!(y - hh < b.y1 && y + hh > b.y0)) continue;
      for (let i = i0; i <= i1; i++) {
        const x = i * STEP;
        if (x - hw < b.x1 && x + hw > b.x0) grid[j * COLS + i] = 1;
      }
    }
  }
  return grid;
})();
/** Por onde o pé consegue ir a partir de (x, y), sem passar onde `cut` diz. */
function flood(sx: number, sy: number, cut?: (x: number, y: number) => boolean): Uint8Array {
  const seen = new Uint8Array(COLS * ROWS);
  const queue = new Int32Array(COLS * ROWS);
  let [head, tail] = [0, 0];
  const start = Math.round(sy / STEP) * COLS + Math.round(sx / STEP);
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const cell = queue[head++]!;
    const i = cell % COLS;
    const j = (cell - i) / COLS;
    for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as const) {
      // a beira de cima é a saída para o Capão: dá para chegar até ela (as outras beiras não)
      if (ni < 2 || nj < 1 || ni >= COLS - 2 || nj >= ROWS - 2) continue;
      const k = nj * COLS + ni;
      if (seen[k] || blocked[k] || (cut && cut(ni * STEP, nj * STEP))) continue;
      seen[k] = 1;
      queue[tail++] = k;
    }
  }
  return seen;
}
/** Por onde o pé consegue ir a partir da chegada do Capão. */
const reached = { seen: flood(ARRIVAL.x, ARRIVAL.y), cols: COLS };
const reach = (x: number, y: number) => reached.seen[Math.round(y / STEP) * reached.cols + Math.round(x / STEP)] === 1;
/** Algum ponto alcançável a até `r` metros de (x, y)? */
const reachNear = (x: number, y: number, r: number) => {
  for (let dx = -r; dx <= r; dx += STEP) for (let dy = -r; dy <= r; dy += STEP) if (Math.hypot(dx, dy) <= r && reach(x + dx, y + dy)) return true;
  return false;
};
const reachedArea = () => {
  let n = 0;
  for (const v of reached.seen) n += v;
  return n * STEP * STEP;
};
const decks = layer('cenario').filter((o) => o.type === 'deque').map((o) => rectOf(o));
const onDeck = (x: number, y: number) => decks.some((d) => x >= d.x0 && x <= d.x1 && y >= d.y0 && y <= d.y1);

describe('Mapa 02 (Guarapiranga): formato do mapa novo', () => {
  it('tem 400 × 320 metros, tile de 32 px, só camadas de objetos, e não é onde o jogo começa', () => {
    expect([map.width, map.height, map.tilewidth, map.tileheight]).toEqual([400, 320, 32, 32]);
    expect(map.layers.map((l) => l.name)).toEqual(['chao', 'cenario', 'colisao', 'seguro', 'areas', 'pontos', 'saidas', 'monstros']);
    expect(map.layers.every((l) => l.type === 'objectgroup')).toBe(true);
    const props = Object.fromEntries((map.properties ?? []).map((p) => [p.name, p.value]));
    expect(props).toMatchObject({ nome: 'Guarapiranga', seguro: false });
    expect(props.inicial).toBeUndefined();
  });

  it('o servidor lê o mapa: a saída da beira de cima leva ao Capão, e quem chega de lá aparece na estrada, fora da saída', () => {
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'guarapiranga');
    expect(game.metric).toBe(true);
    expect(game.exits).toHaveLength(1);
    expect(game.exits[0]).toMatchObject({ to: 'capao', arrival: 'chegada-guarapiranga', y: 0 });
    expect(game.exitAt(ARRIVAL.x, ARRIVAL.y)).toBeNull();
    expect(game.exitAt(ARRIVAL.x, 0.3)).not.toBeNull(); // andando para o norte pela estrada
    expect(reach(ARRIVAL.x, 0.4)).toBe(true);
  });

  // (a barreira do sul do Capão só abre quando o Mapa 02 entrar na main: até lá o Capão não tem a saída, e este teste
  // espera por ela)
  const capao = JSON.parse(readFileSync('public/assets/maps-iso/capao.tmj', 'utf8')) as TiledMap;
  it.runIf(capao.layers.some((l) => l.name === 'saidas'))('no Capão, a estrada do sul leva para cá', () => {
    const back = GameMap.fromTiled(capao, 'capao');
    expect(back.exits.map((e) => [e.to, e.arrival])).toContainEqual(['guarapiranga', 'chegada-capao']);
    expect(back.spots.has('chegada-guarapiranga')).toBe(true);
  });

  it('cada coisa sólida do cenário tem a sua colisão (tronco, poste, casa, banco, muro, cachoeira, trave, pilar do coreto...)', () => {
    const covered = (x: number, y: number) => {
      const [i, j] = [Math.floor(x / BUCKET), Math.floor(y / BUCKET)];
      for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1], [1, 1], [1, -1], [-1, 1]] as const) {
        for (const b of buckets.get(bucketKey(i + di, j + dj)) ?? []) if (b.type !== 'agua' && x >= b.x0 - 1e-6 && x <= b.x1 + 1e-6 && y >= b.y0 - 1e-6 && y <= b.y1 + 1e-6) return true;
      }
      return false;
    };
    const SOLID = ['arvore', 'poste', 'pedra', 'tronco-caido', 'casa', 'banco', 'fogueira', 'poste-praca', 'barril', 'caixote', 'ponto-onibus', 'muro', 'cachoeira', 'barreira'];
    for (const o of layer('cenario')) {
      const { x, y } = at(o);
      const solid = SOLID.includes(o.type) || (o.type === 'arbusto' && prop(o, 'fechado') === true) || (o.type === 'placa' && prop(o, 'poste') === true);
      if (solid) expect(covered(x, y), `${o.type} em (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
      const r = rectOf(o);
      // a trave do campinho: os dois paus; o coreto: os quatro pilares (o meio é livre)
      if (o.type === 'trave') for (const ty of [r.y0, r.y1]) expect(covered((r.x0 + r.x1) / 2, ty), `trave em (${x}, ${ty})`).toBe(true);
      if (o.type === 'cobertura') {
        for (const [px, py] of [[r.x0 + 0.6, r.y0 + 0.6], [r.x1 - 0.6, r.y0 + 0.6], [r.x0 + 0.6, r.y1 - 0.6], [r.x1 - 0.6, r.y1 - 0.6]] as const) expect(covered(px, py), `pilar em (${px}, ${py})`).toBe(true);
        expect(covered(x, y), 'meio do coreto').toBe(false);
      }
    }
  });
});

describe('Mapa 02: a chegada e o Refúgio (no mesmo lugar de antes)', () => {
  it('quem chega do Capão não fica, na tela, atrás de poste, placa ou tronco (a câmera olha do sudeste)', () => {
    // (19/11: a placa GUARAPIRANGA ficava bem na frente de quem chegava)
    const sx = (x: number, y: number) => (x - y) * Math.SQRT1_2;
    const tall = layer('cenario').filter((o) => ['poste', 'poste-praca', 'arvore'].includes(o.type) || (o.type === 'placa' && prop(o, 'poste') === true));
    for (const o of tall) {
      const { x, y } = at(o);
      const ahead = x + y - (ARRIVAL.x + ARRIVAL.y);
      const h = Number(prop(o, 'altura') ?? 2.4);
      const sameColumn = Math.abs(sx(x, y) - sx(ARRIVAL.x, ARRIVAL.y)) < 0.9;
      // na frente (mais perto da câmera) e alto o bastante para passar por cima do pé de quem chega, na tela
      expect(ahead > 0 && sameColumn && ahead * Math.SQRT1_2 * 0.5 < h * 0.866, `${o.type} em (${x}, ${y}) na frente da chegada`).toBe(false);
    }
  });

  it('quem chega do Capão desce a estrada e o caminho até o Refúgio: o píer, a praça, a fogueira, a quitanda e o atracadouro', () => {
    expect(reachNear(SPAWN.x, SPAWN.y, 0.3)).toBe(true);
    for (const [x, y, what] of [
      [43.5, 56, 'píer'],
      [57, 52, 'praça (entre a quitanda e a fogueira)'],
      [57.5, 51.35, 'frente da banca da quitanda'],
      [49.6, 62.4, 'atracadouro'],
      [66.5, 58.5, 'frente da casa amarela'],
      [62, 65.2, 'frente da casa rosa'],
      [44, 30, 'margem perto da estrada'],
    ] as const) {
      expect(reachNear(x, y, 0.5), what).toBe(true);
    }
    for (const o of layer('cenario').filter((c) => c.type === 'fogueira')) expect(reachNear(at(o).x, at(o).y, 3.2)).toBe(true);
  });

  it('o deque e o píer são chão (dá para andar em cima da água) e as casas não deixam entrar', () => {
    const water = named('chao', 'Represa de Guarapiranga');
    const inWater = (x: number, y: number) => {
      const pts = ptsOf(water);
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!;
        const [xj, yj] = pts[j]!;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    expect(inWater(45, 56) && reach(45, 56)).toBe(true); // o píer passa por cima da água
    expect(inWater(60, 55) && onDeck(60, 55)).toBe(true);
    for (const o of layer('cenario').filter((c) => c.type === 'casa')) {
      const { x, y } = at(o);
      expect(reach(x, y), o.name).toBe(false);
    }
    // as casas do Refúgio são de tábua, em cima do deque
    for (const o of layer('cenario').filter((c) => c.type === 'casa' && at(c).x < 75 && at(c).y < 75)) {
      const r = rectOf(o);
      expect(decks.some((d) => r.x0 >= d.x0 - 1e-6 && r.x1 <= d.x1 + 1e-6 && r.y0 >= d.y0 - 1e-6 && r.y1 <= d.y1 + 1e-6), `${o.name} em cima do deque`).toBe(true);
      expect(prop(o, 'material')).toBe('tabua');
    }
  });

  it('a quitanda da Dona Iracema tem letreiro e toldo, sem marca de verdade', () => {
    const shop = named('cenario', 'Quitanda da Dona Iracema');
    expect(prop(shop, 'comercio')).toBe('quitanda');
    expect(prop(shop, 'letreiro')).toBe('QUITANDA DONA IRACEMA');
    expect(prop(shop, 'toldo')).toBeTypeOf('string');
  });

  it('a Dona Iracema fica atrás da banca de frutas (em U, colada na quitanda): ninguém entra lá, o corpo dela cabe e dá para comprar de frente', () => {
    // (19/11: no print, a [estrutura] viu a Dona Iracema em pé na frente da vitrine, parecendo freguesa)
    const npcs = JSON.parse(readFileSync('data/npcs.json', 'utf8')) as Record<string, { nome: string; mapa: string; x: number; y: number }>;
    const iracema = Object.values(npcs).find((n) => n.mapa === 'guarapiranga' && n.nome === 'Dona Iracema')!;
    const banca = layer('cenario').find((o) => o.type === 'banca-frutas')!;
    const b = rectOf(banca);
    const [f, l] = [Number(prop(banca, 'frente')), Number(prop(banca, 'lados'))];
    expect(b.y0).toBeCloseTo(rectOf(named('cenario', 'Quitanda da Dona Iracema')).y1, 6);
    // o pé dela no miolo, entre os dois lados e atrás da frente (o corpo tem 0,6 × 0,4)
    expect(iracema.x - 0.3 >= b.x0 + l && iracema.x + 0.3 <= b.x1 - l && iracema.y <= b.y1 - f && iracema.y - 0.4 >= b.y0).toBe(true);
    const corner = cornerAtFeet(iracema.x, iracema.y);
    expect(bodyFits(GameMap.fromTiled(map as unknown as TiledMap, 'guarapiranga'), corner.x, corner.y)).toBe(true);
    // a frente e os dois lados seguram o pé, e o miolo é fechado: ninguém chega lá (por isso não tem como entalar)
    for (const [x, y] of [[iracema.x, b.y1 - f / 2], [b.x0 + l / 2, b.y0 + 0.3], [b.x1 - l / 2, b.y0 + 0.3]] as const) expect(footFree(x, y), `banca em (${x}, ${y})`).toBe(false);
    for (let x = b.x0 + l + 0.35; x <= b.x1 - l - 0.35; x += 0.25) expect(reach(x, b.y0 + 0.35), `miolo em x = ${x}`).toBe(false);
    // quem vai comprar para na frente da banca, a pouco mais de 1 m dela (o jogo leva o herói para o lugar livre mais perto)
    expect(reachNear(iracema.x, b.y1 + 0.25, 0.25)).toBe(true);
    expect(b.y1 + 0.45 - iracema.y).toBeLessThan(TRADE_RANGE);
  });

  it('a chegada e o Refúgio são zonas seguras, e quem desmaia aqui acorda no Refúgio', () => {
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'guarapiranga');
    const safe = (x: number, y: number) => game.safeAreas.some((s) => x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1);
    expect(safe(ARRIVAL.x, ARRIVAL.y)).toBe(true);
    expect(safe(SPAWN.x, SPAWN.y)).toBe(true);
    // (os deques do Refúgio; o do mirante e os píeres do clube ficam fora)
    for (const d of decks.filter((d) => d.x0 >= 35 && d.x1 <= 75)) for (const [x, y] of [[d.x0, d.y0], [d.x1, d.y1]] as const) expect(safe(x, y)).toBe(true);
    expect(onDeck(SPAWN.x, SPAWN.y)).toBe(true);
    const corner = cornerAtFeet(SPAWN.x, SPAWN.y);
    expect(bodyFits(game, corner.x, corner.y)).toBe(true);
  });

  it('nenhuma copa tampa a estrada, o caminho, as trilhas, os píeres ou os deques (vista da câmera)', () => {
    const screen = (x: number, y: number, z = 0) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2 * 0.5 - z * 0.866] as const;
    const keys: [number, number][] = [];
    const road = ptsOf(layer('chao').find((o) => o.type === 'asfalto')!);
    const trails = layer('chao').filter((o) => o.type === 'trilha').flatMap(ptsOf);
    for (const p of [...road, ...trails]) keys.push(p);
    for (const d of decks) for (let x = d.x0; x <= d.x1; x += 1) for (let y = d.y0; y <= d.y1; y += 1) keys.push([x, y]);
    // (os pontos numa grade de 8 m: cada árvore só olha os de perto)
    const grid = new Map<number, [number, number][]>();
    for (const k of keys) {
      const c = bucketKey(Math.floor(k[0] / 8), Math.floor(k[1] / 8));
      if (!grid.has(c)) grid.set(c, []);
      grid.get(c)!.push(k);
    }
    const bad: string[] = [];
    for (const o of layer('cenario').filter((c) => c.type === 'arvore')) {
      const { x, y } = at(o);
      const [cx, cy] = screen(x, y, Number(prop(o, 'altura')));
      const copa = Number(prop(o, 'copa'));
      const near: [number, number][] = [];
      const span = Number(prop(o, 'altura')) + copa + 2;
      for (let i = Math.floor((x - span) / 8); i <= Math.floor((x + copa + 2) / 8); i++) for (let j = Math.floor((y - span) / 8); j <= Math.floor((y + copa + 2) / 8); j++) near.push(...(grid.get(bucketKey(i, j)) ?? []));
      for (const [kx, ky] of near) {
        if (kx + ky >= x + y) continue;
        const [sx, sy] = screen(kx, ky);
        if (Math.hypot(sx - cx, sy - cy) < copa * 1.05) bad.push(`${prop(o, 'especie')} em (${x}, ${y}) tampa (${kx.toFixed(1)}, ${ky.toFixed(1)})`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('no Refúgio e na beira do caminho, nenhum vão de entalar entre duas coisas sólidas (a água conta)', () => {
    // perto de onde se anda: o deque e uma faixa de 2 m em volta do que é alcançável
    const near = (b: Box) => {
      for (let x = b.x0 - 1.5; x <= b.x1 + 1.5; x += 0.5) for (let y = b.y0 - 1.5; y <= b.y1 + 1.5; y += 0.5) if (reach(x, y)) return true;
      return false;
    };
    const list = boxes.filter(near);
    const bad: string[] = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i]!, list[j]!];
        if ((a.type === 'mata-fechada' || a.type === 'agua') && (b.type === 'mata-fechada' || b.type === 'agua')) continue;
        // o miolo da banca da Dona Iracema, entre a frente dela e a parede da quitanda, é fechado pelos lados: ninguém
        // entra (o teste da banca confere), então não entala
        if ([a.type, b.type].includes('banca') && [a.type, b.type].includes('casa')) continue;
        const dx = Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
        const dy = Math.max(0, b.y0 - a.y1, a.y0 - b.y1);
        if ((dx > 0 && dy > 0) || dx + dy <= 0.3 || dx + dy >= 1.2) continue;
        // o vão está tapado por uma terceira coisa? (sobra de menos de 0,3 m não conta)
        const g =
          dx > 0
            ? { x0: Math.min(a.x1, b.x1), x1: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), y1: Math.min(a.y1, b.y1) }
            : { x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), y0: Math.min(a.y1, b.y1), y1: Math.max(a.y0, b.y0) };
        let open = false;
        for (let x = g.x0 + 0.025; x < g.x1 && !open; x += 0.05) {
          for (let y = g.y0 + 0.025; y < g.y1 && !open; y += 0.05) {
            if (!list.some((c) => c !== a && c !== b && x >= c.x0 - 0.15 && x <= c.x1 + 0.15 && y >= c.y0 - 0.15 && y <= c.y1 + 0.15)) open = true;
          }
        }
        if (open) bad.push(`${(dx + dy).toFixed(2)} m entre ${a.type} (${a.x0}, ${a.y0}, ${a.x1}, ${a.y1}) e ${b.type} (${b.x0}, ${b.y0}, ${b.x1}, ${b.y1})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('as áreas têm nome; o Refúgio e a comunidade são os lugares mais claros (sem escuro) e a caverna o mais escuro', () => {
    const names = layer('areas').map((a) => a.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'O Refúgio', 'Margem da Represa', "Estrada do M'Boi Mirim", 'Represa de Guarapiranga', 'Parque Ecológico do Guarapiranga', 'Mirante',
        'Comunidade da Represa', 'Brejo Maior', 'Campinho', 'Praça em Ruínas', 'Clube Náutico em Ruínas', 'Ilha do Véu', 'Barragem de 1909',
        'A Barragem', 'Trilha da Margem Sul', 'Caverna Sagrada', 'Várzea de Caça', 'Mata do Leste', 'Brejo do Sul',
      ]),
    );
    expect(Number(prop(named('areas', 'O Refúgio'), 'escuro'))).toBe(0);
    expect(Number(prop(named('areas', 'Comunidade da Represa'), 'escuro'))).toBe(0);
    const darkest = Math.max(...layer('areas').map((a) => Number(prop(a, 'escuro') ?? 0)));
    expect(Number(prop(named('areas', 'Caverna Sagrada'), 'escuro'))).toBe(darkest);
  });
});

describe('Mapa 02: o mapa inteiro aberto (400 × 320)', () => {
  it('dá para ir a pé da chegada até cada lugar do mapa', () => {
    for (const [x, y, r, what] of [
      [16, 50, 0.5, 'Mirante'],
      [18, 104, 3, 'Brejo do Sul'],
      [30, 200, 1, 'Trilha da Margem Sul'],
      [34, 270, 1.5, 'boca da Caverna Sagrada'],
      [158, 33, 3.2, 'fogueira da praça do Brejo Maior'],
      [233, 25, 0.5, 'meio do campinho'],
      [327, 30, 0.5, 'dentro do coreto'],
      [392, 29, 1.5, 'frente da cachoeira'],
      [383, 23.2, 0.5, 'fim da Trilha da Cachoeira (a beira do poço)'],
      [296, 89, 0.5, 'pátio do clube'],
      [302, 104, 0.5, 'píer do clube (até o buraco)'],
      [380, 140, 2, 'Mata do Leste'],
      [336, 245.5, 0.5, 'frente da Barragem de 1909'],
      [150, 251.7, 0.5, 'ponta oeste do muro da barragem'],
      [230, 251.7, 0.5, 'meio do muro da barragem'],
      [180, 300, 2, 'várzea'],
      [386, 230, 0.5, 'estrada perto da saída para Santo Amaro'],
    ] as const) {
      expect(reachNear(x, y, r), what).toBe(true);
    }
    // quase todo o chão de fora da água é de andar (uns 60 mil m², de 128 mil)
    expect(reachedArea()).toBeGreaterThan(45000);
  });

  it('a represa, as ilhas e o riacho não: a Ilha do Véu (e a ilhota) só de barco, mais tarde', () => {
    for (const [x, y, r, what] of [
      [196, 148, 4, 'Ilha do Véu'],
      [92, 72, 1.5, 'ilhota'],
      [120, 150, 2, 'represa (oeste)'],
      [250, 200, 2, 'represa (sul)'],
      [300, 140, 2, 'represa (leste)'],
      [366, 50, 0.6, 'riacho'],
      [302, 114, 1, 'ponta do píer quebrado do clube'],
    ] as const) {
      expect(reachNear(x, y, r), what).toBe(false);
    }
  });

  it('dá a volta na represa: tanto a trilha do oeste quanto a estrada do leste chegam, sozinhas, ao muro da barragem', () => {
    // sem o lado leste (x > 300), só pela trilha da margem sul; sem o lado oeste (ao sul do Refúgio), só pela estrada
    const viaWest = flood(ARRIVAL.x, ARRIVAL.y, (x) => x > 300);
    const viaEast = flood(ARRIVAL.x, ARRIVAL.y, (x, y) => x < 140 && y > 75);
    const cell = (x: number, y: number) => Math.round(y / STEP) * COLS + Math.round(x / STEP);
    for (const [x, y] of [[230, 251.7], [180, 300]] as const) {
      expect(viaWest[cell(x, y)], `pelo oeste até (${x}, ${y})`).toBe(1);
      expect(viaEast[cell(x, y)], `pelo leste até (${x}, ${y})`).toBe(1);
    }
  });

  it('a estrada vai até a beira do leste, onde uma barreira fecha a passagem para Santo Amaro (até o mapa de lá ficar pronto)', () => {
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'guarapiranga');
    expect(game.exits.map((e) => e.to)).toEqual(['capao']);
    const barrier = rectOf(named('cenario', 'Saída para Santo Amaro (fechada)'));
    const road = ptsOf(layer('chao').find((o) => o.type === 'asfalto')!);
    const end = road[road.length - 1]!;
    expect(end[0]).toBeGreaterThanOrEqual(map.width);
    // a barreira atravessa a estrada inteira (o asfalto e as calçadas)
    expect(barrier.y0 <= end[1] - 4.5 && barrier.y1 >= end[1] + 4.5).toBe(true);
    // quem vier de lá (quando a saída abrir) chega na estrada, antes da barreira
    const arrival = at(named('pontos', 'chegada-santo-amaro'));
    expect(game.spots.has('chegada-santo-amaro')).toBe(true);
    expect(arrival.x).toBeGreaterThan(370);
    expect(arrival.x).toBeLessThan(barrier.x0);
    expect(reach(arrival.x, arrival.y)).toBe(true);
  });

  it('as zonas seguras: a chegada, o Refúgio e a comunidade (com a fogueira da praça); os bichos ficam fora delas', () => {
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'guarapiranga');
    expect(layer('seguro').map((s) => s.name)).toEqual(['Chegada', 'O Refúgio', 'Comunidade da Represa']);
    const safe = (x: number, y: number) => game.safeAreas.some((s) => x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1);
    for (const o of layer('cenario').filter((c) => c.type === 'fogueira')) expect(safe(at(o).x, at(o).y)).toBe(true);
    for (const a of layer('monstros')) {
      const r = rectOf(a);
      for (const s of layer('seguro').map((o) => rectOf(o))) expect(r.x0 < s.x1 && r.x1 > s.x0 && r.y0 < s.y1 && r.y1 > s.y0, `${a.name} dentro de zona segura`).toBe(false);
    }
  });

  it('as áreas de caça: cada uma é de uma criatura que existe, com quantidade, e tem chão de andar dentro', () => {
    const monsters = JSON.parse(readFileSync('data/monsters.json', 'utf8')) as Record<string, unknown>;
    expect(layer('monstros').length).toBeGreaterThanOrEqual(8);
    for (const a of layer('monstros')) {
      expect(monsters[a.name], a.name).toBeDefined();
      expect(Number(prop(a, 'quantidade')), a.name).toBeGreaterThan(0);
      const r = rectOf(a);
      let [open, all] = [0, 0];
      for (let x = r.x0 + 1; x < r.x1; x += 2) {
        for (let y = r.y0 + 1; y < r.y1; y += 2) {
          all++;
          if (reach(x, y)) open++;
        }
      }
      // (pelo menos um terço do retângulo é chão de andar: o resto é água, tronco, casa)
      expect(open / all, `${a.name} em (${r.x0}, ${r.y0})`).toBeGreaterThan(1 / 3);
    }
  });

  it('as capivaras da várzea: a área delas e o lugar de descanso (dentro dela, de andar)', () => {
    const area = rectOf(named('pontos', 'capivaras-varzea'));
    const rest = at(named('pontos', 'capivaras-varzea-descanso'));
    expect(rest.x > area.x0 && rest.x < area.x1 && rest.y > area.y0 && rest.y < area.y1).toBe(true);
    expect(reachNear(rest.x, rest.y, 1)).toBe(true);
  });
});

describe('Mapa 02: a Comunidade da Represa (vestida em 22/11)', () => {
  const COMMUNITY_BOX = { x0: 124, x1: 208, y0: 2, y1: 51 };
  const inCommunity = (r: Box) => r.x0 >= COMMUNITY_BOX.x0 && r.x1 <= COMMUNITY_BOX.x1 && r.y0 >= COMMUNITY_BOX.y0 && r.y1 <= COMMUNITY_BOX.y1;

  it('as ruelas de cimento ficam abertas: dá para andar por todas elas, de ponta a ponta', () => {
    const alleys = layer('chao').filter((o) => o.type === 'calcada' && !o.polyline && !o.polygon && inCommunity(rectOf(o)) && o.name !== 'Brejo Maior');
    expect(alleys.length).toBeGreaterThanOrEqual(6);
    for (const o of alleys) {
      const r = rectOf(o);
      const alongX = r.x1 - r.x0 >= r.y1 - r.y0;
      const [cx, cy] = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
      for (let t = 1; t < (alongX ? r.x1 - r.x0 : r.y1 - r.y0) - 1; t += 1.5) {
        const [x, y] = alongX ? [r.x0 + t, cy] : [cx, r.y0 + t];
        expect(reachNear(x, y, 1), `ruela em (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
      }
    }
  });

  it('as casas ficam coladas em fileiras (a comunidade cheia) e não deixam entrar', () => {
    const houses = layer('cenario').filter((o) => o.type === 'casa' && inCommunity(rectOf(o)));
    expect(houses.length).toBeGreaterThanOrEqual(35);
    // casas coladas: a maioria encosta numa vizinha (a parede de uma é a da outra)
    const touching = houses.filter((a) => houses.some((b) => b !== a && (Math.abs(rectOf(a).x1 - rectOf(b).x0) < 1e-6 || Math.abs(rectOf(b).x1 - rectOf(a).x0) < 1e-6)));
    expect(touching.length / houses.length).toBeGreaterThan(0.8);
    for (const o of houses) expect(reach(at(o).x, at(o).y), `casa em (${at(o).x}, ${at(o).y})`).toBe(false);
    // tijolo à mostra, rebocada e pintada, ou só o andar de cima no tijolo: tem dos três jeitos
    const kinds = new Set(houses.map((o) => String(prop(o, 'tijolo') ?? 'reboco')));
    expect([...kinds].sort()).toEqual(['cima', 'reboco', 'true']);
  });

  it('o comércio da praça (bar, peixaria, salão e mercadinho) tem letreiro, sem marca de verdade, e a frente dá para a praça', () => {
    for (const name of ['Lemos Bar', 'Peixaria', 'Salão da Neide', 'Mercadinho']) {
      const shop = named('cenario', name);
      expect(prop(shop, 'comercio'), name).toBeTypeOf('string');
      expect(String(prop(shop, 'letreiro')).length, name).toBeGreaterThan(3);
      const r = rectOf(shop);
      expect(r.y1, `${name} de frente para a praça`).toBeCloseTo(23.5, 6);
      expect(reachNear((r.x0 + r.x1) / 2, r.y1 + 0.8, 0.6), `frente de ${name}`).toBe(true);
    }
  });

  it('a praça do Brejo Maior: a fogueira, as bancas de frutas, peixe e artesanato, as mesas do bar, o muro grafitado e as pipas na fiação', () => {
    const plaza = layer('cenario').filter((o) => at(o).x > 145 && at(o).x < 171 && at(o).y > 23 && at(o).y < 42);
    expect(plaza.filter((o) => o.type === 'fogueira')).toHaveLength(1);
    expect(plaza.filter((o) => o.type === 'banca-frutas').map((o) => prop(o, 'mercadoria')).sort()).toEqual(['artesanato', 'frutas', 'peixe']);
    for (const o of plaza.filter((c) => c.type === 'banca-frutas')) expect(reachNear(at(o).x, rectOf(o).y1 + 0.5, 0.4), 'frente da banca').toBe(true);
    expect(plaza.filter((o) => o.type === 'mesa').length).toBeGreaterThanOrEqual(2);
    expect(prop(named('cenario', 'Muro grafitado'), 'texto')).toBe('BREJO');
    expect(layer('cenario').filter((o) => o.type === 'fiacao' && prop(o, 'pipa')).length).toBeGreaterThanOrEqual(2);
  });
});
