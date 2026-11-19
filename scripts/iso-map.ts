// Peças comuns dos geradores de mapa do mundo novo (2.5D isométrico), no formato combinado com a [estrutura]
// (docs/ARQUITETURA.md, "Mapas do mundo novo"): Tiled ortogonal, 1 tile = 1 metro (tile de 32 px, só como grade),
// tudo em camadas de objetos. Medidas sempre em metros; x cresce para o leste e y para o sul.
//
// Usado pelo Mapa 02 (gen-guarapiranga.ts). O Mapa 01 (gen-capao.ts) ainda tem as próprias cópias destas peças (o mapa
// dele já está aprovado; a troca fica para quando os ramos dele chegarem na main).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Pixels por metro no Tiled (o tile de 32 px é só a grade: 1 tile = 1 metro). */
export const PX = 32;

export type Pt = [number, number];
export type Props = Record<string, string | number | boolean>;
export interface Shape {
  type: string;
  name?: string;
  /** Retângulo (x, y = canto de cima à esquerda) ou ponto (x, y). Em metros. */
  x: number;
  y: number;
  w?: number;
  h?: number;
  point?: boolean;
  ellipse?: boolean;
  polyline?: Pt[];
  polygon?: Pt[];
  props?: Props;
}
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export const round = (v: number) => Math.round(v * 100) / 100;
export const rect = (type: string, x0: number, x1: number, y0: number, y1: number, props?: Props, name?: string): Shape => ({
  type,
  name,
  x: round(x0),
  y: round(y0),
  w: round(x1 - x0),
  h: round(y1 - y0),
  props,
});
export const box = (type: string, r: Rect, props?: Props, name?: string): Shape => rect(type, r.x0, r.x1, r.y0, r.y1, props, name);
export const ellipse = (type: string, cx: number, cy: number, r: number, props?: Props): Shape => ({ type, x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, ellipse: true, props });
export const point = (type: string, x: number, y: number, props?: Props, name?: string): Shape => ({ type, name, x: round(x), y: round(y), point: true, props });
export const line = (type: string, pts: Pt[], props?: Props, name?: string): Shape => ({ type, name, x: 0, y: 0, polyline: pts.map(([x, y]) => [round(x), round(y)]), props });
export const area = (type: string, pts: Pt[], props?: Props, name?: string): Shape => ({ type, name, x: 0, y: 0, polygon: pts.map(([x, y]) => [round(x), round(y)]), props });
/** Quadrado de colisão centrado em (x, y). */
export const block = (type: string, x: number, y: number, side: number, props?: Props): Shape => rect(type, x - side / 2, x + side / 2, y - side / 2, y + side / 2, props);
export const rectOf = (s: Shape): Rect => ({ x0: s.x, x1: s.x + (s.w ?? 0), y0: s.y, y1: s.y + (s.h ?? 0) });

// ---------------- geometria ----------------
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export const inRect = (x: number, y: number, r: Rect, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad;
/** Distância de (x, y) até o retângulo (0 dentro). */
export const rectGap = (x: number, y: number, r: Rect) => Math.hypot(Math.max(0, r.x0 - x, x - r.x1), Math.max(0, r.y0 - y, y - r.y1));
/** O ponto está dentro do polígono? */
export function inside(x: number, y: number, pts: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function distToPath(x: number, y: number, pts: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i]!;
    const [bx, by] = pts[i + 1]!;
    const [dx, dy] = [bx - ax, by - ay];
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, dist(x, y, ax + t * dx, ay + t * dy));
  }
  return best;
}
/** Contorno irregular (sem sorteio: o mesmo sempre) em volta de (cx, cy). */
export function blob(cx: number, cy: number, rx: number, ry: number, wobble: number, n = 32): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wobble * (0.6 * Math.sin(a * 3 + 1.3) + 0.4 * Math.cos(a * 5 + 0.4));
    return [round(cx + Math.cos(a) * rx * k), round(cy + Math.sin(a) * ry * k)] as Pt;
  });
}
/**
 * Curva suave (Catmull-Rom) passando pelos pontos, um ponto a cada ~`step` metros. Com `closed`, fecha o contorno.
 * `wobble` (metros) mexe um pouco a beirada, sempre igual (para a margem da água não parecer feita a régua).
 */
export function smooth(pts: Pt[], step = 1, closed = false, wobble = 0): Pt[] {
  const n = pts.length;
  const get = (i: number) => (closed ? pts[((i % n) + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  const out: Pt[] = [];
  const segs = closed ? n : n - 1;
  let travelled = 0;
  for (let i = 0; i < segs; i++) {
    const [p0, p1, p2, p3] = [get(i - 1), get(i), get(i + 1), get(i + 2)];
    const len = dist(p1[0], p1[1], p2[0], p2[1]);
    const k = Math.max(1, Math.round(len / step));
    for (let s = 0; s < k; s++) {
      const t = s / k;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      let [x, y] = [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
      if (wobble > 0) {
        // empurra para o lado (na normal do trecho), com ondas de tamanhos diferentes
        const [dx, dy] = [p2[0] - p1[0], p2[1] - p1[1]];
        const l = Math.hypot(dx, dy) || 1;
        const w = wobble * (0.6 * Math.sin(travelled * 0.9 + 1.7) + 0.4 * Math.sin(travelled * 2.3 + 0.4));
        x += (-dy / l) * w;
        y += (dx / l) * w;
      }
      out.push([round(x), round(y)]);
      travelled += len / k;
    }
  }
  if (!closed) out.push([round(pts[n - 1]![0]), round(pts[n - 1]![1])]);
  return out;
}
/** Pontos de um caminho a cada `step` metros: no meio e nas duas beiradas. */
export function pathPoints(pts: Pt[], largura: number, step = 1): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [[ax, ay], [bx, by]] = [pts[i]!, pts[i + 1]!];
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
    for (let d = 0; d <= len; d += step) {
      const [x, y] = [ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len];
      for (const o of [0, largura / 2, -largura / 2]) out.push([x + nx * o, y + ny * o]);
    }
  }
  return out;
}
/** Os pontos de um retângulo a cada `step` metros (para conferir a vista). */
export function rectPoints(r: Rect, step = 1): Pt[] {
  const out: Pt[] = [];
  for (let x = r.x0; x <= r.x1 + 1e-9; x += step) for (let y = r.y0; y <= r.y1 + 1e-9; y += step) out.push([x, y]);
  return out;
}

// ---------------- a câmera do jogo ----------------
/** Posição na tela (em metros da tela) de um ponto a uma altura z, na câmera isométrica do jogo (30° de inclinação). */
export const screen = (x: number, y: number, z = 0) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2 * 0.5 - z * 0.866] as const;
/**
 * A copa (raio) de uma planta em (x, y), nesta altura, cobre na tela o ponto (kx, ky, kz)? A câmera olha do sudeste:
 * uma copa alta mais ao sul ou a leste "sobe" na tela e cobre o que está atrás dela.
 */
export function covers(x: number, y: number, copa: number, altura: number, kx: number, ky: number, kz = 0, margin = 1.15): boolean {
  if (kx + ky >= x + y) return false; // só cobre o que está atrás dela
  const [cx, cy] = screen(x, y, altura);
  const [sx, sy] = screen(kx, ky, kz);
  return Math.hypot(sx - cx, sy - cy) < copa * margin;
}
/** Contorno convexo (na tela) de um monte de pontos. */
export function hull(pts: (readonly [number, number])[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: readonly [number, number], a: readonly [number, number], b: readonly [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: (readonly [number, number])[]) => {
    const out: (readonly [number, number])[] = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, q) <= 0) out.pop();
      out.push(q);
    }
    return out.slice(0, -1);
  };
  return [...half(p), ...half([...p].reverse())].map(([x, y]) => [x, y] as Pt);
}
/**
 * Esta caixa (casa, barco...) de pé no chão, com esta altura, tampa na tela o meio do corpo (0,9 m) de quem está no
 * ponto (kx, ky)? Só tampa o que está atrás dela (ao norte ou a oeste).
 */
export function boxCovers(b: Rect, altura: number, kx: number, ky: number): boolean {
  if (!(kx < b.x0 || ky < b.y0) || inRect(kx, ky, b)) return false;
  const outline = hull(([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]] as const).flatMap(([x, y]) => [screen(x, y, 0), screen(x, y, altura)]));
  return inside(...screen(kx, ky, 0.9), outline);
}

// ---------------- conferências ----------------
/**
 * Nenhum vão estreito entre duas coisas sólidas de frente uma para a outra: abaixo de 0,3 m o pé nem entra; de 0,3 a
 * `minGap` ele entra de lado e entala. Canto com canto (na diagonal) sempre tem por onde sair, mata fechada com mata
 * fechada é parede, e um vão já tapado por outra coisa sólida não conta. Lança erro com o primeiro vão achado.
 */
export function checkWedges(solids: Shape[], minGap: number, skip: (a: Shape, b: Shape) => boolean = () => false): void {
  const list = solids.map((s) => ({ s, r: rectOf(s) }));
  /**
   * O vão (retângulo) está tapado por outras coisas sólidas? Sobra de menos de 0,3 m não conta: ali o pé (0,6 × 0,4)
   * não entra. Confere a cada 5 cm.
   */
  const filled = (g: Rect, a: Shape, b: Shape) => {
    const others = list.filter((o) => o.s !== a && o.s !== b && o.r.x1 > g.x0 - 0.15 && o.r.x0 < g.x1 + 0.15 && o.r.y1 > g.y0 - 0.15 && o.r.y0 < g.y1 + 0.15);
    for (let x = g.x0 + 0.025; x < g.x1; x += 0.05) {
      for (let y = g.y0 + 0.025; y < g.y1; y += 0.05) if (!others.some((o) => inRect(x, y, o.r, 0.15))) return false;
    }
    return true;
  };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [a, b] = [list[i]!, list[j]!];
      const dx = Math.max(0, b.r.x0 - a.r.x1, a.r.x0 - b.r.x1);
      const dy = Math.max(0, b.r.y0 - a.r.y1, a.r.y0 - b.r.y1);
      if ((dx > 0 && dy > 0) || dx + dy >= minGap || dx + dy <= 0.3 || skip(a.s, b.s)) continue;
      // o vão entre as duas, de frente uma para a outra
      const gap: Rect =
        dx > 0
          ? { x0: Math.min(a.r.x1, b.r.x1), x1: Math.max(a.r.x0, b.r.x0), y0: Math.max(a.r.y0, b.r.y0), y1: Math.min(a.r.y1, b.r.y1) }
          : { x0: Math.max(a.r.x0, b.r.x0), x1: Math.min(a.r.x1, b.r.x1), y0: Math.min(a.r.y1, b.r.y1), y1: Math.max(a.r.y0, b.r.y0) };
      if (filled(gap, a.s, b.s)) continue;
      throw new Error(`Vão de ${(dx + dy).toFixed(2)} m entre ${a.s.type} (${a.s.x}, ${a.s.y}) e ${b.s.type} (${b.s.x}, ${b.s.y}): o pé entala.`);
    }
  }
}
/**
 * A água vira faixas de 0,5 m de altura (o pé não entra e a pedrinha passa por cima), lidas da função `wet`, de x0 a x1 e
 * de y0 a y1. Faixas iguais seguidas viram um retângulo só.
 */
export function waterStrips(wet: (x: number, y: number) => boolean, x0: number, x1: number, y0: number, y1: number, step = 0.5): Shape[] {
  const rows: { y: number; runs: [number, number][] }[] = [];
  for (let y = y0; y < y1 - 1e-9; y += step) {
    const row = y + step / 2;
    const runs: [number, number][] = [];
    let start: number | null = null;
    for (let x = x0; x <= x1 + 1e-9; x += step / 4) {
      const isWet = x < x1 - 1e-9 && wet(x + step / 8, row);
      if (isWet && start === null) start = x;
      if (!isWet && start !== null) {
        runs.push([round(start), round(x)]);
        start = null;
      }
    }
    rows.push({ y: round(y), runs });
  }
  // junta as faixas iguais de linhas seguidas
  const out: Shape[] = [];
  const open = new Map<string, { x0: number; x1: number; y0: number; y1: number }>();
  for (const { y, runs } of rows) {
    const keys = new Set(runs.map(([a, b]) => `${a}:${b}`));
    for (const [k, r] of [...open]) {
      if (!keys.has(k)) {
        out.push({ ...rect('agua', r.x0, r.x1, r.y0, r.y1), props: { bloqueiaTiro: false } });
        open.delete(k);
      }
    }
    for (const [a, b] of runs) {
      const k = `${a}:${b}`;
      const r = open.get(k);
      if (r) r.y1 = round(y + step);
      else open.set(k, { x0: a, x1: b, y0: y, y1: round(y + step) });
    }
  }
  for (const r of open.values()) out.push({ ...rect('agua', r.x0, r.x1, r.y0, r.y1), props: { bloqueiaTiro: false } });
  return out;
}

// ---------------- arquivo ----------------
/** Lê `--out` e `--force` da linha de comando: não sobrescreve o mapa existente (pode ter edições do Tiled) sem `--force`. */
export function outputPath(defaultFile: string, command: string): string {
  const i = process.argv.indexOf('--out');
  const out = path.resolve(i !== -1 && process.argv[i + 1] ? process.argv[i + 1]! : defaultFile);
  if (existsSync(out) && !process.argv.includes('--force')) {
    console.error(`O mapa ${path.relative(process.cwd(), out)} já existe (e pode ter edições feitas no Tiled).`);
    console.error(`Para gerar de novo e PERDER essas edições, rode: npm run ${command} -- --force`);
    process.exit(1);
  }
  return out;
}
function propsOf(props?: Props) {
  if (!props) return undefined;
  return Object.entries(props).map(([name, value]) => ({
    name,
    type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : 'string',
    value,
  }));
}
/** Escreve o .tmj: camadas de objetos na ordem dada (as vazias ficam de fora) e as propriedades do mapa. */
export function writeTmj(out: string, width: number, height: number, layers: [string, Shape[]][], properties: Props): void {
  let nextId = 1;
  const toTiled = (s: Shape) => {
    const base = {
      id: nextId++,
      name: s.name ?? '',
      type: s.type,
      x: round(s.x * PX),
      y: round(s.y * PX),
      width: round((s.w ?? 0) * PX),
      height: round((s.h ?? 0) * PX),
      rotation: 0,
      visible: true,
      ...(s.point ? { point: true } : {}),
      ...(s.ellipse ? { ellipse: true } : {}),
      ...(s.polyline ? { polyline: s.polyline.map(([x, y]) => ({ x: round(x * PX), y: round(y * PX) })) } : {}),
      ...(s.polygon ? { polygon: s.polygon.map(([x, y]) => ({ x: round(x * PX), y: round(y * PX) })) } : {}),
    };
    const props = propsOf(s.props);
    return props ? { ...base, properties: props } : base;
  };
  const tiledLayers = layers
    .filter(([, shapes]) => shapes.length > 0)
    .map(([name, shapes], i) => ({ id: i + 1, name, type: 'objectgroup', draworder: 'index', opacity: 1, visible: true, x: 0, y: 0, objects: shapes.map(toTiled) }));
  const map = {
    type: 'map',
    version: '1.10',
    tiledversion: '1.11.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width,
    height,
    tilewidth: PX,
    tileheight: PX,
    infinite: false,
    nextlayerid: tiledLayers.length + 1,
    nextobjectid: nextId,
    properties: propsOf(properties),
    tilesets: [],
    layers: tiledLayers,
  };
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(map));
}
