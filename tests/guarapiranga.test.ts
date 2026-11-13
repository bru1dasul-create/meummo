// Mapa 02 do mundo novo (Represa de Guarapiranga), no formato combinado com a [estrutura]: tudo em camadas de objetos,
// 1 tile = 1 metro, colisão tirada do cenário. Pedaço (a): a chegada pela Estrada do M'Boi Mirim, o Caminho da Represa
// e o Refúgio, a segunda vila, sobre palafitas na água. O parque, o brejo e a orla ficam fechados até os pedaços b e c.

import { readFileSync } from 'node:fs';
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
const ARRIVAL = at(named('pontos', 'chegada-capao'));
const SPAWN = at(named('pontos', 'spawn'));
/** Por onde o pé consegue ir a partir da chegada do Capão (grade de 0,25 m no mapa inteiro). */
const STEP = 0.25;
const reached = (() => {
  const cols = Math.round(map.width / STEP);
  const rows = Math.round(map.height / STEP);
  const seen = new Uint8Array(cols * rows);
  const start = Math.round(ARRIVAL.y / STEP) * cols + Math.round(ARRIVAL.x / STEP);
  const queue: number[] = [start];
  seen[start] = 1;
  while (queue.length > 0) {
    const cell = queue.pop()!;
    const [i, j] = [cell % cols, Math.floor(cell / cols)];
    for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as const) {
      // a beira de cima é a saída para o Capão: dá para chegar até ela (as outras beiras não)
      if (ni < 2 || nj < 1 || ni >= cols - 2 || nj >= rows - 2) continue;
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
const reachedArea = () => {
  let n = 0;
  for (const v of reached.seen) n += v;
  return n * STEP * STEP;
};
const decks = layer('cenario').filter((o) => o.type === 'deque').map((o) => rectOf(o));
const onDeck = (x: number, y: number) => decks.some((d) => x >= d.x0 && x <= d.x1 && y >= d.y0 && y <= d.y1);

describe('Mapa 02 (Guarapiranga): formato do mapa novo', () => {
  it('tem 120 × 100 metros, tile de 32 px, só camadas de objetos, e não é onde o jogo começa', () => {
    expect([map.width, map.height, map.tilewidth, map.tileheight]).toEqual([120, 100, 32, 32]);
    expect(map.layers.map((l) => l.name)).toEqual(['chao', 'cenario', 'colisao', 'seguro', 'areas', 'pontos', 'saidas']);
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
    // e no Capão, a estrada do sul leva para cá
    const capao = JSON.parse(readFileSync('public/assets/maps-iso/capao.tmj', 'utf8')) as TiledMap;
    const back = GameMap.fromTiled(capao, 'capao');
    expect(back.exits.map((e) => [e.to, e.arrival])).toContainEqual(['guarapiranga', 'chegada-capao']);
    expect(back.spots.has('chegada-guarapiranga')).toBe(true);
  });

  it('cada coisa sólida do cenário tem a sua colisão (tronco, poste, casa, banco, barril, ponto de ônibus...)', () => {
    const covered = (x: number, y: number) => boxes.some((b) => b.type !== 'agua' && x >= b.x0 - 1e-6 && x <= b.x1 + 1e-6 && y >= b.y0 - 1e-6 && y <= b.y1 + 1e-6);
    const SOLID = ['arvore', 'poste', 'pedra', 'tronco-caido', 'casa', 'banco', 'fogueira', 'poste-praca', 'barril', 'caixote', 'ponto-onibus'];
    for (const o of layer('cenario')) {
      const { x, y } = at(o);
      const solid = SOLID.includes(o.type) || (o.type === 'arbusto' && prop(o, 'fechado') === true) || (o.type === 'placa' && prop(o, 'poste') === true);
      if (solid) expect(covered(x, y), `${o.type} em (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
    }
  });
});

describe('Mapa 02 (a): a chegada e o Refúgio', () => {
  it('quem chega do Capão desce a estrada e o caminho até o Refúgio: o píer, a praça, a fogueira, a quitanda e o atracadouro', () => {
    expect(reachNear(SPAWN.x, SPAWN.y, 0.3)).toBe(true);
    for (const [x, y, what] of [
      [43.5, 56, 'píer'],
      [57, 52, 'praça (entre a quitanda e a fogueira)'],
      [57.5, 50.6, 'balcão da quitanda'],
      [49.6, 62.4, 'atracadouro'],
      [66.5, 58.5, 'frente da casa amarela'],
      [62, 65.2, 'frente da casa rosa'],
      [44, 30, 'margem perto da árvore caída'],
    ] as const) {
      expect(reachNear(x, y, 0.5), what).toBe(true);
    }
    for (const o of layer('cenario').filter((c) => c.type === 'fogueira')) expect(reachNear(at(o).x, at(o).y, 3.2)).toBe(true);
  });

  it('o resto fica fechado nesta etapa: a mata do parque, a do norte, a orla depois da árvore caída, a ilha e a água', () => {
    for (const [x, y, what] of [
      [20, 45, 'parque'],
      [30, 8, 'mata do norte'],
      [5, 10, 'mata do oeste'],
      [70, 20, 'orla depois da árvore caída'],
      [60, 27, 'estrada depois da árvore caída'],
      [92, 72, 'ilha'],
      [80, 60, 'represa'],
      [20, 88, 'brejo'],
    ] as const) {
      expect(reachNear(x, y, 1.5), what).toBe(false);
    }
    // a parte aberta é a estrada até a árvore, o caminho, a margem e o Refúgio (uns 770 m², de 12 mil)
    expect(reachedArea()).toBeGreaterThan(600);
    expect(reachedArea()).toBeLessThan(2000);
  });

  it('o deque e o píer são chão (dá para andar em cima da água) e as casas não deixam entrar', () => {
    const water = layer('chao').find((o) => o.type === 'agua')!;
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

  it('a chegada e o Refúgio são zonas seguras, e quem desmaia aqui acorda no Refúgio', () => {
    const game = GameMap.fromTiled(map as unknown as TiledMap, 'guarapiranga');
    const safe = (x: number, y: number) => game.safeAreas.some((s) => x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1);
    expect(safe(ARRIVAL.x, ARRIVAL.y)).toBe(true);
    expect(safe(SPAWN.x, SPAWN.y)).toBe(true);
    for (const d of decks) for (const [x, y] of [[d.x0, d.y0], [d.x1, d.y1]] as const) expect(safe(x, y)).toBe(true);
    expect(onDeck(SPAWN.x, SPAWN.y)).toBe(true);
    const corner = cornerAtFeet(SPAWN.x, SPAWN.y);
    expect(bodyFits(game, corner.x, corner.y)).toBe(true);
  });

  it('nenhuma copa tampa a estrada aberta, o caminho, o píer ou o deque (vista da câmera)', () => {
    const screen = (x: number, y: number, z = 0) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2 * 0.5 - z * 0.866] as const;
    const keys: [number, number][] = [];
    const road = ptsOf(layer('chao').find((o) => o.type === 'asfalto')!).filter(([x]) => x <= 50);
    const path = ptsOf(layer('chao').find((o) => o.type === 'trilha')!);
    for (const p of [...road, ...path]) keys.push(p);
    for (const d of decks) for (let x = d.x0; x <= d.x1; x += 1) for (let y = d.y0; y <= d.y1; y += 1) keys.push([x, y]);
    const bad: string[] = [];
    for (const o of layer('cenario').filter((c) => c.type === 'arvore')) {
      const { x, y } = at(o);
      const [cx, cy] = screen(x, y, Number(prop(o, 'altura')));
      const copa = Number(prop(o, 'copa'));
      for (const [kx, ky] of keys) {
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

  it('as áreas têm nome e o Refúgio é o lugar mais claro (sem escuro); a estrada para o leste está fechada por uma árvore caída', () => {
    const names = layer('areas').map((a) => a.name);
    expect(names).toEqual(expect.arrayContaining(['O Refúgio', 'Margem da Represa', "Estrada do M'Boi Mirim", 'Represa de Guarapiranga']));
    expect(Number(prop(named('areas', 'O Refúgio'), 'escuro'))).toBe(0);
    const fallen = named('cenario', 'Árvore caída');
    const road = ptsOf(layer('chao').find((o) => o.type === 'asfalto')!);
    const r = rectOf(fallen);
    // a árvore atravessa a estrada inteira (6 m de asfalto e as calçadas): o meio da estrada onde ela cai
    const xm = (r.x0 + r.x1) / 2;
    const i = road.findIndex(([x], k) => k + 1 < road.length && x <= xm && road[k + 1]![0] >= xm);
    expect(i).toBeGreaterThanOrEqual(0);
    const [[ax, ay], [bx, by]] = [road[i]!, road[i + 1]!];
    const y = ay + ((by - ay) * (xm - ax)) / (bx - ax);
    expect(r.y0 <= y - 4.5 && r.y1 >= y + 4.5).toBe(true);
    expect(reach(xm - 2, y)).toBe(true);
    expect(reach(xm + 2, y)).toBe(false);
  });
});
