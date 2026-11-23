// O mapa visto de cima (norte para cima), para a janela do mapa (tecla M) e o mini mapa do jogo 2.5D.
//
// Lê um mapa do formato novo (public/assets/maps-iso/<id>.tmj) e escreve, ao lado dele:
// - <id>-mapa.png: o chão, as trilhas, a água, as ruas, as casas e as copas, sem texto e sem perspectiva;
// - <id>-mapa.json: { escala, largura, altura, nomes: [{ nome, x, y, tipo }] } (escala = pixels por metro; largura e
//   altura em metros; x e y em metros, no mesmo sistema do .tmj e do servidor). Os nomes ficam fora da imagem para a
//   [arte] escrever com a fonte do jogo, de pé e nítidos em qualquer zoom (combinado com a [estrutura] em 14/11).
//
// Uso: npx tsx scripts/mapa-de-cima.ts public/assets/maps-iso/capao.tmj [--escala 8] [--saida pasta]

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

interface TObj {
  type?: string;
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  point?: boolean;
  ellipse?: boolean;
  polygon?: { x: number; y: number }[];
  polyline?: { x: number; y: number }[];
  properties?: { name: string; value: unknown }[];
}
interface TLayer {
  name: string;
  type: string;
  objects?: TObj[];
}
interface TMap {
  width: number;
  height: number;
  tilewidth: number;
  layers: TLayer[];
}

type RGB = readonly [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Uma imagem RGBA simples, com mistura por transparência. */
class Canvas {
  readonly data: Uint8Array;
  /** O tipo do chão de cada pixel (-1: nenhum), para a textura; `tag` é o que se marca enquanto se pinta. */
  readonly tags: Int8Array;
  tag = -1;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8Array(w * h * 4);
    this.tags = new Int8Array(w * h).fill(-1);
  }
  plot(x: number, y: number, c: RGB, a = 1): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (this.tag >= 0 && a >= 0.5) this.tags[y * this.w + x] = this.tag;
    const i = (y * this.w + x) * 4;
    const k = Math.max(0, Math.min(1, a));
    for (let j = 0; j < 3; j++) this.data[i + j] = Math.round(this.data[i + j]! * (1 - k) + c[j]! * k);
    this.data[i + 3] = 255;
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 1): void {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.w, Math.ceil(x1)); x++) this.plot(x, y, c, a);
    }
  }
  /** Polígono (regra par/ímpar), pelo centro de cada pixel. */
  polygon(pts: [number, number][], c: RGB, a = 1): void {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(this.h, Math.ceil(Math.max(...ys))); y++) {
      const cy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]!;
        const [bx, by] = pts[(i + 1) % pts.length]!;
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.max(0, Math.round(xs[k]!)); x < Math.min(this.w, Math.round(xs[k + 1]!)); x++) this.plot(x, y, c, a);
      }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(this.h, Math.ceil(cy + ry)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(this.w, Math.ceil(cx + rx)); x++) {
        const [dx, dy] = [(x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry];
        if (dx * dx + dy * dy <= 1) this.plot(x, y, c, a);
      }
    }
  }
  /** Linha grossa (caminho de pontos), pela distância de cada pixel ao segmento mais perto. */
  line(pts: [number, number][], width: number, c: RGB, a = 1): void {
    const r = width / 2;
    const done = new Set<number>();
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[i + 1]!;
      const [dx, dy] = [bx - ax, by - ay];
      const len2 = dx * dx + dy * dy || 1;
      for (let y = Math.max(0, Math.floor(Math.min(ay, by) - r)); y < Math.min(this.h, Math.ceil(Math.max(ay, by) + r)); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - r)); x < Math.min(this.w, Math.ceil(Math.max(ax, bx) + r)); x++) {
          const key = y * this.w + x;
          if (done.has(key)) continue;
          const t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / len2));
          const [px, py] = [ax + t * dx, ay + t * dy];
          if ((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 <= r * r) {
            done.add(key);
            this.plot(x, y, c, a);
          }
        }
      }
    }
  }
}

const prop = (o: TObj, name: string): unknown => o.properties?.find((p) => p.name === name)?.value;
const num = (o: TObj, name: string, fallback: number): number => {
  const v = Number(prop(o, name));
  return Number.isFinite(v) ? v : fallback;
};
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k].map((v) => Math.max(0, Math.min(255, Math.round(v)))) as unknown as RGB;

/** As cores do chão e das coisas (do mapa, não do desenho do jogo): fáceis de ler pequenas. */
const C = {
  fundo: hex('#1d2a22'),
  mata: hex('#2f4b2c'),
  mataProfunda: hex('#203628'),
  grama: hex('#5b8a43'),
  circulo: hex('#9fd9d0'),
  terra: hex('#8a6e4b'),
  campinho: hex('#b08a58'),
  praca: hex('#e3dccb'),
  calcada: hex('#a39f95'),
  asfalto: hex('#3b3d41'),
  faixaRua: hex('#d9b84a'),
  agua: hex('#3d7f8c'),
  lama: hex('#5a4a34'),
  trilha: hex('#b08d5d'),
  madeira: hex('#8a6640'),
  copa: hex('#3d6b35'),
  mataFechada: hex('#1f3a1f'),
  bambu: hex('#8fb54a'),
  pedra: hex('#9a9a92'),
  contorno: hex('#2a2420'),
  predio: hex('#9a9790'),
  muro: hex('#c9c2b4'),
  ferro: hex('#22301f'),
  concreto: hex('#8c8a84'),
  trem: hex('#7d5ca8'),
  onibus: hex('#e0b443'),
  carro: hex('#a33a2a'),
  branco: hex('#f2f0ea'),
  ferrugem: hex('#9a5a36'),
  bomba: hex('#c0392b'),
  pneu: hex('#26262a'),
  flor: hex('#e58fb0'),
};

export interface MapImage {
  png: Buffer;
  json: { escala: number; largura: number; altura: number; nomes: { nome: string; x: number; y: number; tipo: string }[] };
}

/** Um número de 0 a 1 que depende só de (x, y): o mesmo sempre (para a textura e o jeito de cada copa). */
function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Ruído suave (manchas do tamanho `size`, em pixels), de 0 a 1. */
function smoothNoise(x: number, y: number, size: number): number {
  const [gx, gy] = [x / size, y / size];
  const [ix, iy] = [Math.floor(gx), Math.floor(gy)];
  const [fx, fy] = [gx - ix, gy - iy];
  const s = (t: number) => t * t * (3 - 2 * t);
  const [a, b, c, d] = [hash2(ix, iy), hash2(ix + 1, iy), hash2(ix, iy + 1), hash2(ix + 1, iy + 1)];
  return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
}
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as unknown as RGB;

/** Desenha o mapa visto de cima, a `escala` pixels por metro, no jeito do jogo (contornos, luz de noroeste e sombra). */
export function renderMapImage(map: TMap, escala = 8): MapImage {
  const M = map.tilewidth; // pixels do Tiled por metro
  const [largura, altura] = [map.width, map.height];
  const cv = new Canvas(Math.round(largura * escala), Math.round(altura * escala));
  cv.rect(0, 0, cv.w, cv.h, C.fundo);
  const s = (v: number) => (v / M) * escala; // do Tiled para pixels da imagem
  const m = (v: number) => v * escala; // de metros para pixels
  const layer = (name: string) => map.layers.find((l) => l.name === name)?.objects ?? [];
  const pts = (o: TObj, list: { x: number; y: number }[]): [number, number][] => list.map((p) => [s(o.x + p.x), s(o.y + p.y)]);
  const box = (o: TObj) => [s(o.x), s(o.y), s(o.x + (o.width ?? 0)), s(o.y + (o.height ?? 0))] as const;
  const outline = (x0: number, y0: number, x1: number, y1: number, c: RGB, w = 1, a = 0.9) => {
    cv.rect(x0, y0, x1, y0 + w, c, a);
    cv.rect(x0, y1 - w, x1, y1, c, a);
    cv.rect(x0, y0, x0 + w, y1, c, a);
    cv.rect(x1 - w, y0, x1, y1, c, a);
  };

  // ----- o chão, na ordem da camada (o que vem depois fica por cima), marcando o tipo de cada pixel para a textura -----
  const GROUND: Record<string, RGB> = {
    mata: C.mata, 'mata-profunda': C.mataProfunda, grama: C.grama, circulo: C.circulo, terra: C.terra, campinho: C.campinho,
    praca: C.praca, calcada: C.calcada, asfalto: C.asfalto, agua: C.agua, lama: C.lama, trilha: C.trilha, piso: C.calcada,
  };
  const TAGS = Object.keys(GROUND);
  for (const o of layer('chao')) {
    const t = o.type ?? '';
    const c = GROUND[t];
    if (!c) continue;
    cv.tag = TAGS.indexOf(t);
    const alpha = t === 'grama' ? 0.9 : 1;
    if (t === 'trilha' && o.polyline) {
      // a trilha: a beirada mais escura e o meio mais claro (de chão batido)
      const w = Math.max(2, s(num(o, 'largura', 1) * M));
      cv.line(pts(o, o.polyline), w + Math.max(2, escala * 0.25), shade(C.trilha, 0.72), 1);
      cv.line(pts(o, o.polyline), w, c, 1);
      cv.tag = -1;
      cv.line(pts(o, o.polyline), w * 0.45, mix(C.trilha, C.branco, 0.18), 0.35);
      continue;
    }
    if (o.polygon) cv.polygon(pts(o, o.polygon), c, alpha);
    else if (o.polyline) cv.line(pts(o, o.polyline), Math.max(1.5, s(num(o, 'largura', 1) * M)), c, alpha);
    else if (o.ellipse) {
      const [x0, y0, x1, y1] = box(o);
      cv.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, c, alpha);
    } else if (!o.point) {
      const [x0, y0, x1, y1] = box(o);
      cv.rect(x0, y0, x1, y1, c, alpha);
      // a quadra de cimento da escola (o campinho com `desenho: 'quadra'`): o vermelho em volta, o verde do jogo e as linhas
      if (t === 'campinho' && prop(o, 'desenho') === 'quadra') {
        cv.tag = -1;
        cv.rect(x0, y0, x1, y1, hex('#9a5a48'), 1);
        const mm = m(0.9);
        cv.rect(x0 + mm, y0 + mm, x1 - mm, y1 - mm, hex('#4f7d5f'), 1);
        const lw = Math.max(1, m(0.1));
        const white = hex('#eeece4');
        cv.rect(x0 + mm, y0 + mm, x1 - mm, y0 + mm + lw, white, 0.85);
        cv.rect(x0 + mm, y1 - mm - lw, x1 - mm, y1 - mm, white, 0.85);
        cv.rect(x0 + mm, y0 + mm, x0 + mm + lw, y1 - mm, white, 0.85);
        cv.rect(x1 - mm - lw, y0 + mm, x1 - mm, y1 - mm, white, 0.85);
        cv.rect((x0 + x1) / 2 - lw / 2, y0 + mm, (x0 + x1) / 2 + lw / 2, y1 - mm, white, 0.85);
      }
    }
  }
  cv.tag = -1;
  // a textura do chão: manchas suaves (mata, grama, terra), grão no asfalto, placas na calçada e as ondas de pedra
  // portuguesa na praça (preto no branco)
  const tagOf = (t: string) => TAGS.indexOf(t);
  const [T_MATA, T_FUNDA, T_GRAMA, T_TERRA, T_CAMPO, T_PRACA, T_CALC, T_ASF, T_AGUA, T_LAMA, T_TRILHA] =
    ['mata', 'mata-profunda', 'grama', 'terra', 'campinho', 'praca', 'calcada', 'asfalto', 'agua', 'lama', 'trilha'].map(tagOf);
  const k = escala / 8; // as medidas abaixo estão em pixels da escala 8
  for (let y = 0; y < cv.h; y++) {
    for (let x = 0; x < cv.w; x++) {
      const tg = cv.tags[y * cv.w + x];
      if (tg === undefined || tg < 0) continue;
      const i = (y * cv.w + x) * 4;
      const cur: RGB = [cv.data[i]!, cv.data[i + 1]!, cv.data[i + 2]!];
      let f = 1;
      let to: RGB | null = null;
      let ta = 0;
      if (tg === T_MATA || tg === T_FUNDA) {
        f = 0.86 + 0.24 * smoothNoise(x, y, 14 * k);
        if (hash2(x, y) > 0.992) [to, ta] = [shade(C.grama, 0.9), 0.55]; // folhinhas no chão
      } else if (tg === T_GRAMA) {
        f = 0.9 + 0.18 * smoothNoise(x, y, 10 * k);
        if (hash2(x, y) > 0.985) [to, ta] = [mix(C.grama, C.branco, 0.35), 0.6];
      } else if (tg === T_TERRA || tg === T_CAMPO || tg === T_LAMA || tg === T_TRILHA) {
        f = 0.88 + 0.2 * smoothNoise(x, y, 12 * k);
        if (hash2(x, y) > 0.993) [to, ta] = [mix(cur, C.branco, 0.4), 0.7]; // pedrinhas
      } else if (tg === T_ASF) {
        f = 0.92 + 0.14 * smoothNoise(x, y, 6 * k);
      } else if (tg === T_CALC) {
        const step = Math.max(2, Math.round(escala));
        f = x % step === 0 || y % step === 0 ? 0.84 : 0.97 + 0.05 * smoothNoise(x, y, 5 * k);
      } else if (tg === T_PRACA) {
        // as ondas de pedra portuguesa (como no calçadão): faixas pretas finas e onduladas no branco
        const v = Math.sin(y * (0.62 / k) + 1.9 * Math.sin(x * (0.2 / k)));
        if (v > 0.62) [to, ta] = [hex('#2b2b2e'), 0.85];
      } else if (tg === T_AGUA) {
        f = 0.94 + 0.1 * smoothNoise(x, y, 18 * k);
      }
      let c = shade(cur, f);
      if (to) c = mix(c, to, ta);
      cv.data[i] = c[0];
      cv.data[i + 1] = c[1];
      cv.data[i + 2] = c[2];
    }
  }
  // a beira da água (o lago e os poços) mais clara, e a faixa amarela da rua e as listras da faixa de pedestre
  for (const o of layer('chao')) {
    const t = o.type ?? '';
    if (t === 'agua' && o.polygon) {
      const p = pts(o, o.polygon);
      cv.line([...p, p[0]!], Math.max(1.5, escala * 0.3), mix(C.agua, C.branco, 0.45), 0.7);
    }
    if (t === 'faixa-rua' && o.polyline) {
      // a faixa do meio, tracejada
      const p = pts(o, o.polyline);
      for (let j = 0; j + 1 < p.length; j++) {
        const [[ax, ay], [bx, by]] = [p[j]!, p[j + 1]!];
        const len = Math.hypot(bx - ax, by - ay);
        for (let d = 0; d < len; d += escala * 2) {
          const e = Math.min(len, d + escala * 1.1);
          cv.line([[ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len], [ax + ((bx - ax) * e) / len, ay + ((by - ay) * e) / len]], Math.max(1, escala * 0.18), C.faixaRua, 0.9);
        }
      }
    }
    if (t === 'meio-fio' && o.polyline) cv.line(pts(o, o.polyline), Math.max(1, escala * 0.2), hex('#cfc8ba'), 0.85);
    if (t === 'faixa') {
      const [x0, y0, x1, y1] = box(o);
      const along = prop(o, 'listras') === 'y';
      for (let j = 0; ; j++) {
        const a = (along ? y0 : x0) + j * escala * 0.8;
        if (a >= (along ? y1 : x1)) break;
        if (along) cv.rect(x0, a, x1, Math.min(y1, a + escala * 0.45), C.branco, 0.9);
        else cv.rect(a, y0, Math.min(x1, a + escala * 0.45), y1, C.branco, 0.9);
      }
    }
    if (t === 'campinho') {
      const [x0, y0, x1, y1] = box(o);
      const [w, h] = [x1 - x0, y1 - y0];
      cv.line([[x0 + 2, y0 + 2], [x1 - 2, y0 + 2], [x1 - 2, y1 - 2], [x0 + 2, y1 - 2], [x0 + 2, y0 + 2]], Math.max(1, escala * 0.15), C.branco, 0.85);
      cv.line(w > h ? [[(x0 + x1) / 2, y0 + 2], [(x0 + x1) / 2, y1 - 2]] : [[x0 + 2, (y0 + y1) / 2], [x1 - 2, (y0 + y1) / 2]], Math.max(1, escala * 0.15), C.branco, 0.85);
      const r = Math.min(w, h) * 0.16;
      const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
      cv.line(Array.from({ length: 25 }, (_, j) => [cx + Math.cos((j / 24) * Math.PI * 2) * r, cy + Math.sin((j / 24) * Math.PI * 2) * r] as [number, number]), Math.max(1, escala * 0.15), C.branco, 0.85);
    }
  }

  // ----- o que fica no chão: deque, pinguela e as pedras de atravessar -----
  const scen = layer('cenario');
  for (const o of scen) {
    if (o.type !== 'deque' && o.type !== 'pinguela') continue;
    const [x0, y0, x1, y1] = box(o);
    if (prop(o, 'pedras') === true) {
      const along = x1 - x0 >= y1 - y0;
      for (let j = 0; j < 4; j++) {
        const t = (j + 0.5) / 4;
        const [cx, cy] = along ? [x0 + (x1 - x0) * t, (y0 + y1) / 2] : [(x0 + x1) / 2, y0 + (y1 - y0) * t];
        const r = Math.min(x1 - x0, y1 - y0) * 0.38;
        cv.ellipse(cx, cy, r + 1, r + 1, C.contorno, 0.6);
        cv.ellipse(cx, cy, r, r, C.pedra);
      }
    } else {
      cv.rect(x0, y0, x1, y1, C.madeira);
      // as tábuas
      const along = x1 - x0 >= y1 - y0;
      for (let a = along ? x0 : y0; a < (along ? x1 : y1); a += escala * 0.45) {
        if (along) cv.rect(a, y0, a + 1, y1, shade(C.madeira, 0.7), 0.6);
        else cv.rect(x0, a, x1, a + 1, shade(C.madeira, 0.7), 0.6);
      }
      outline(x0, y0, x1, y1, shade(C.madeira, 0.5));
    }
  }

  // ----- as sombras (a luz vem do noroeste, como no jogo): casas, prédios, ônibus, árvores e moitas -----
  const shadowOf = (o: TObj): void => {
    const t = o.type ?? '';
    const [dx, dy] = [m(0.5), m(0.7)];
    if (o.point && (t === 'arvore' || t === 'bambu' || (t === 'arbusto' && prop(o, 'fechado') === true))) {
      if (prop(o, 'dentroDaCasa') === true) return;
      const r = s((t === 'arvore' ? num(o, 'copa', 2) : num(o, 'raio', 1)) * M) * 0.95;
      cv.ellipse(s(o.x) + dx * 0.8, s(o.y) + dy * 0.8, r, r * 0.9, hex('#000000'), t === 'arvore' ? 0.22 : 0.15);
    } else if (!o.point && ['casa', 'predio', 'onibus', 'muro', 'carro', 'cobertura'].includes(t)) {
      const [x0, y0, x1, y1] = box(o);
      cv.rect(x0 + dx, y0 + dy, x1 + dx, y1 + dy, hex('#000000'), t === 'cobertura' ? 0.15 : 0.28);
    }
  };
  for (const o of scen) shadowOf(o);

  // ----- as construções: telhado na cor da casa, com contorno, a beira de noroeste iluminada e a de sudeste no escuro;
  // caixa d'água azul; a Budega com o toldo listrado na frente; o prédio com as janelas; o ônibus virado horta -----
  const roof = (x0: number, y0: number, x1: number, y1: number, c: RGB) => {
    cv.rect(x0, y0, x1, y1, c);
    const e = Math.max(1, escala * 0.25);
    cv.rect(x0, y0, x1, y0 + e, mix(c, C.branco, 0.3), 0.8);
    cv.rect(x0, y0, x0 + e, y1, mix(c, C.branco, 0.2), 0.8);
    cv.rect(x0, y1 - e, x1, y1, shade(c, 0.7), 0.8);
    cv.rect(x1 - e, y0, x1, y1, shade(c, 0.75), 0.8);
    // a cumeeira (o meio do telhado)
    if (x1 - x0 >= y1 - y0) cv.rect(x0 + e, (y0 + y1) / 2 - 0.5, x1 - e, (y0 + y1) / 2 + 0.5, shade(c, 0.82), 0.7);
    else cv.rect((x0 + x1) / 2 - 0.5, y0 + e, (x0 + x1) / 2 + 0.5, y1 - e, shade(c, 0.82), 0.7);
    outline(x0, y0, x1, y1, C.contorno, Math.max(1, Math.round(escala * 0.2)));
  };
  for (const o of scen) {
    const t = o.type ?? '';
    if (o.point) continue;
    if (o.polyline) continue;
    const [x0, y0, x1, y1] = box(o);
    if (t === 'casa') {
      // (a casa de tijolo à mostra, a da comunidade da represa, sai na cor do tijolo)
      const c = hex(prop(o, 'tijolo') === true ? '#b4633b' : String(prop(o, 'cor') ?? '#b07a50'));
      roof(x0, y0, x1, y1, c);
      if (prop(o, 'caixaDagua') === true) {
        const [cx, cy, r] = [x1 - m(1.1), y0 + m(1.1), m(0.6)];
        cv.ellipse(cx, cy, r + 1, r + 1, C.contorno, 0.8);
        cv.ellipse(cx, cy, r, r, hex('#4a86c8'));
        cv.ellipse(cx - r * 0.3, cy - r * 0.3, r * 0.35, r * 0.35, hex('#9cc8f0'), 0.7);
      }
      if (prop(o, 'toldo')) {
        // o toldo listrado na frente (o lado sul)
        const toldo = hex(String(prop(o, 'toldo')));
        for (let x = x0, j = 0; x < x1; x += m(0.45), j++) cv.rect(x, y1, Math.min(x1, x + m(0.45)), y1 + m(0.6), j % 2 ? C.branco : toldo, 0.95);
        outline(x0, y1, x1, y1 + m(0.6), C.contorno, 1, 0.6);
      }
      if (prop(o, 'plantas') === true || prop(o, 'arvoreNaLaje') === true) {
        // vasos e mato na laje
        for (let j = 0; j < 3; j++) {
          const [px, py] = [x0 + (x1 - x0) * (0.25 + 0.25 * j), y0 + (y1 - y0) * (0.3 + 0.2 * ((j * 7) % 3))];
          cv.ellipse(px, py, m(0.35), m(0.35), hex('#4f8a3c'), 0.85);
        }
      }
    } else if (t === 'predio') {
      roof(x0, y0, x1, y1, C.predio);
      for (let y = y0 + m(1); y < y1 - m(0.8); y += m(1.6)) for (let x = x0 + m(0.9); x < x1 - m(0.8); x += m(1.6)) cv.rect(x, y, x + m(0.6), y + m(0.6), shade(C.predio, 0.65), 0.8);
      const [cx, cy, r] = [x1 - m(1.3), y0 + m(1.3), m(0.7)];
      cv.ellipse(cx, cy, r, r, hex('#4a86c8'));
    } else if (t === 'estacao') {
      // a estação do Capão maior: a laje do bloco da entrada, o bloco da plataforma e a cobertura curva em cima dos
      // trilhos (com a beirada lilás da linha)
      const back = m(Number(prop(o, 'plataforma') ?? 3.6));
      roof(x0, y0, x1, y1, C.predio);
      cv.rect(x0 + m(1.1), y0 - m(4.7), x1 - m(1.1), y0 + back - m(0.25), hex('#c3c8cb'), 1);
      for (let x = x0 + m(1.1); x < x1 - m(1.1); x += m(0.8)) cv.rect(x, y0 - m(4.7), x + 1, y0 + back - m(0.25), hex('#9ea4a8'), 0.6);
      cv.rect(x0 + m(1.1), y0 + back - m(0.55), x1 - m(1.1), y0 + back - m(0.25), hex(String(prop(o, 'linha') ?? '#8a63b8')), 1);
      outline(x0 + m(1.1), y0 - m(4.7), x1 - m(1.1), y0 + back - m(0.25), C.contorno, 1, 0.7);
    } else if (t === 'muro') roof(x0, y0, x1, y1, C.muro);
    else if (t === 'gradil' || t === 'portao' || t === 'alambrado') {
      cv.rect(Math.min(x0, x1 - 1.5), Math.min(y0, y1 - 1.5), Math.max(x1, x0 + 1.5), Math.max(y1, y0 + 1.5), C.ferro);
    } else if (t === 'pilar' || t === 'pilar-viaduto') roof(x0, y0, x1, y1, C.concreto);
    else if (t === 'onibus') {
      roof(x0, y0, x1, y1, C.onibus);
      if (prop(o, 'horta') === true) for (let x = x0 + m(0.8); x < x1 - m(0.6); x += m(1.2)) cv.ellipse(x, (y0 + y1) / 2, m(0.45), m(0.45), hex('#5aa04a'), 0.9);
    } else if (t === 'carro' || t === 'moto') roof(x0, y0, x1, y1, hex(String(prop(o, 'cor') ?? '#a33a2a')));
    else if (t === 'trave' || t === 'barreira') {
      cv.rect(x0, y0, x1, y1, C.branco, 0.95);
      outline(x0, y0, x1, y1, C.contorno, 1, 0.6);
    } else if (t === 'tronco-caido') {
      roof(x0, y0, x1, y1, C.madeira);
    } else if (t === 'banco' || t === 'balcao') cv.rect(x0, y0, x1, y1, shade(C.madeira, 0.85), 0.9);
    // a banca de feira (a do Capão maior e a da Dona Iracema): a madeira com o pano colorido na frente
    else if (t === 'banca-frutas') {
      cv.rect(x0, y0, x1, y1, C.madeira, 0.95);
      cv.rect(x0, y1 - Math.max(1, m(0.35)), x1, y1, hex(String(prop(o, 'pano') ?? '#e2552f')), 0.95);
      outline(x0, y0, x1, y1, C.contorno, 1, 0.5);
    }
    else if (t === 'parquinho') roof(x0, y0, x1, y1, C.ferrugem);
    else if (t === 'bomba') roof(x0, y0, x1, y1, C.bomba);
    else if (t === 'cachoeira') {
      roof(x0, y0, x1, y1, C.pedra);
      cv.line([[(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]], Math.max(1, escala * 0.5), C.branco, 0.9);
    } else if (t === 'caverna') {
      // o morro de pedra e a boca escura no lado sul
      const [cx, cy, rx, ry] = [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2];
      cv.ellipse(cx, cy, rx + 1, ry + 1, C.contorno, 0.6);
      cv.ellipse(cx, cy, rx, ry, C.pedra);
      cv.ellipse(cx - rx * 0.2, cy - ry * 0.2, rx * 0.45, ry * 0.4, mix(C.pedra, C.branco, 0.35), 0.7);
      cv.ellipse(s(num(o, 'bocaX', (o.x + (o.width ?? 0) / 2) / M) * M), y1 - m(0.4), m(1.6), m(0.7), hex('#1a1512'), 0.95);
    } else if (t === 'torre-mirante') {
      // o telhado de sapê da torre (visto de cima) e a escada do lado sul
      const yb = y1 - m(num(o, 'escada', 1));
      cv.rect(x0, yb, x1, y1, shade(C.madeira, 0.85), 0.9);
      roof(x0 - m(0.45), y0 - m(0.45), x1 + m(0.45), yb + m(0.45), hex('#bf9b4e'));
    } else if (t === 'guarda-corpo') cv.rect(x0, y0, Math.max(x1, x0 + 1), Math.max(y1, y0 + 1), shade(C.madeira, 0.7), 0.95);
    else if (t === 'painel-mirante') cv.rect(x0, y0 - 1, x1, y1 + 1, hex('#2f5d4a'), 0.95);
    else if (t === 'coreto') {
      // o telhado de zinco redondo (visto de cima) e a lanterninha no meio
      const [cx, cy, r] = [(x0 + x1) / 2, (y0 + y1) / 2, m(num(o, 'raio', 4.4) + 0.5)];
      cv.ellipse(cx, cy, r + 1, r + 1, C.contorno, 0.6);
      cv.ellipse(cx, cy, r, r, hex('#8e9b95'));
      cv.ellipse(cx, cy, r * 0.22, r * 0.22, hex('#d9d0b8'));
    }
  }
  for (const o of scen) {
    if (!o.point) continue;
    const [x, y] = [s(o.x), s(o.y)];
    const t = o.type ?? '';
    if (t === 'pedra' || t === 'rocha') {
      const r = s(num(o, 'raio', 0.5) * M);
      cv.ellipse(x, y, r + 1, r + 1, C.contorno, 0.6);
      cv.ellipse(x, y, r, r, C.pedra);
      cv.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.4, mix(C.pedra, C.branco, 0.5), 0.7);
    } else if (t === 'pneus') cv.ellipse(x, y, s(num(o, 'raio', 0.5) * M), s(num(o, 'raio', 0.5) * M), C.pneu);
    else if (t === 'parquinho') cv.ellipse(x, y, s(num(o, 'raio', 0.8) * M), s(num(o, 'raio', 0.8) * M), C.ferrugem, 0.95);
    else if (t === 'fogueira') {
      cv.ellipse(x, y, m(0.7), m(0.7), C.pedra);
      cv.ellipse(x, y, m(0.45), m(0.45), hex('#f08a2a'));
      cv.ellipse(x, y, m(0.22), m(0.22), hex('#ffd36b'));
    } else if (t === 'mesa') {
      cv.ellipse(x, y, m(0.5) + 1, m(0.5) + 1, C.contorno, 0.6);
      cv.ellipse(x, y, m(0.5), m(0.5), hex('#d84a3a'));
    } else if (t === 'poste' || t === 'poste-praca' || t === 'semaforo' || t === 'esteio') cv.ellipse(x, y, Math.max(1, m(0.2)), Math.max(1, m(0.2)), C.contorno, 0.9);
    else if (t === 'oferenda') cv.ellipse(x, y, m(0.4), m(0.3), hex('#f2c230'), 0.9);
    else if (t === 'luneta') cv.ellipse(x, y, Math.max(1, m(0.25)), Math.max(1, m(0.25)), hex('#2f5d4a'), 0.95);
    else if (t === 'brasas') {
      cv.ellipse(x, y, m(0.8), m(0.8), C.pedra);
      cv.ellipse(x, y, m(0.5), m(0.5), hex('#6d6a66'));
      cv.ellipse(x, y, m(0.15), m(0.15), hex('#e0703a'));
    }
  }

  // ----- as moitas de mata fechada e o bambu -----
  for (const o of scen) {
    if (!o.point) continue;
    const [x, y] = [s(o.x), s(o.y)];
    if (o.type === 'arbusto' && prop(o, 'fechado') === true) {
      const r = s(num(o, 'raio', 1) * M);
      cv.ellipse(x, y, r + 1, r + 1, hex('#0f2414'), 0.85);
      cv.ellipse(x, y, r, r, C.mataFechada);
      cv.ellipse(x - r * 0.25, y - r * 0.25, r * 0.5, r * 0.5, shade(C.mataFechada, 1.35), 0.5);
    } else if (o.type === 'bambu') {
      const r = s(num(o, 'raio', 0.8) * M);
      cv.ellipse(x, y, r + 1, r + 1, hex('#2e4a1c'), 0.85);
      cv.ellipse(x, y, r, r, C.bambu, 0.95);
      for (let j = 0; j < 7; j++) {
        const a = hash2(Math.round(x) + j, Math.round(y)) * Math.PI * 2;
        const d = r * 0.6 * hash2(Math.round(y) + j, Math.round(x));
        cv.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(1, r * 0.14), Math.max(1, r * 0.14), hex('#cfe08a'), 0.9);
      }
    }
  }

  // ----- as árvores: de norte para sul (as de baixo cobrem as de cima), cada espécie com o seu jeito -----
  const trees = scen.filter((o) => o.type === 'arvore' && o.point && prop(o, 'dentroDaCasa') !== true).sort((a, b) => a.y - b.y);
  const LEAF: Record<string, RGB> = {
    mata: hex('#3f7a3a'), embauba: hex('#7aa27a'), figueira: hex('#2f6a35'), sibipiruna: hex('#4f9a3a'), xaxim: hex('#2e5e2e'),
  };
  for (const o of trees) {
    const [x, y] = [s(o.x), s(o.y)];
    const especie = String(prop(o, 'especie') ?? 'mata');
    const r = s(num(o, 'copa', 2) * M) * 0.92;
    const seed = Math.round(o.x * 7 + o.y * 13);
    if (especie === 'jeriva' || especie === 'bananeira' || especie === 'xaxim') {
      // palmeira, bananeira e xaxim: folhas compridas saindo do meio
      const leaf = especie === 'bananeira' ? hex('#7fbf4a') : especie === 'xaxim' ? hex('#3f7a3a') : hex('#5a9a3a');
      const n = especie === 'bananeira' ? 6 : 8;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + hash2(seed, j) * 0.4;
        const end: [number, number] = [x + Math.cos(a) * r, y + Math.sin(a) * r];
        const w = especie === 'bananeira' ? r * 0.38 : r * 0.22;
        cv.line([[x, y], end], w + 1.5, shade(leaf, 0.55), 0.85);
        cv.line([[x, y], end], w, leaf, 1);
      }
      cv.ellipse(x, y, Math.max(1.5, r * 0.15), Math.max(1.5, r * 0.15), hex('#6b4a2e'));
      continue;
    }
    if (especie === 'seca') {
      // a árvore seca: só os galhos
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2 + hash2(seed, j);
        cv.line([[x, y], [x + Math.cos(a) * r, y + Math.sin(a) * r]], Math.max(1, r * 0.1), hex('#8a7a66'), 0.9);
      }
      cv.ellipse(x, y, Math.max(1.5, r * 0.18), Math.max(1.5, r * 0.18), hex('#6b5a46'));
      continue;
    }
    // a copa em nuvenzinhas (como no jogo): contorno escuro, a cor, e a luz no lado noroeste de cada uma
    const flor = prop(o, 'flores');
    const c = typeof flor === 'string' ? hex(flor) : (LEAF[especie] ?? LEAF.mata!);
    const lobes: [number, number, number][] = [[x, y, r * 0.62]];
    const n = 5 + Math.floor(hash2(seed, 99) * 3);
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + hash2(seed, j) * 0.6;
      const d = r * (0.42 + 0.12 * hash2(j, seed));
      lobes.push([x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.46 + 0.1 * hash2(seed + 1, j))]);
    }
    for (const [lx, ly, lr] of lobes) cv.ellipse(lx, ly, lr + Math.max(1, escala * 0.18), lr + Math.max(1, escala * 0.18), shade(c, 0.45), 0.9);
    for (const [lx, ly, lr] of lobes) cv.ellipse(lx, ly, lr, lr, c);
    for (const [lx, ly, lr] of lobes) cv.ellipse(lx - lr * 0.28, ly - lr * 0.28, lr * 0.45, lr * 0.45, mix(c, C.branco, 0.28), 0.55);
  }

  // ----- lá em cima: a cobertura do posto (meio transparente) e o viaduto com o trem -----
  for (const o of scen) {
    const [x0, y0, x1, y1] = box(o);
    if (o.type === 'cobertura') {
      cv.rect(x0, y0, x1, y1, C.concreto, 0.6);
      outline(x0, y0, x1, y1, C.contorno, 1, 0.7);
    } else if (o.type === 'viaduto') {
      roof(x0, y0, x1, y1, C.concreto);
      cv.rect(x0, (y0 + y1) / 2 - m(0.6), x1, (y0 + y1) / 2 - m(0.5), hex('#5a5a5a'), 0.8);
      cv.rect(x0, (y0 + y1) / 2 + m(0.5), x1, (y0 + y1) / 2 + m(0.6), hex('#5a5a5a'), 0.8);
    } else if (o.type === 'trem') {
      const along = x1 - x0 >= y1 - y0;
      const n = Math.max(1, num(o, 'vagoes', 3));
      for (let j = 0; j < n; j++) {
        const [a0, a1] = along ? [x0 + ((x1 - x0) * j) / n, x0 + ((x1 - x0) * (j + 1)) / n] : [y0 + ((y1 - y0) * j) / n, y0 + ((y1 - y0) * (j + 1)) / n];
        if (along) roof(a0 + 1, y0, a1 - 1, y1, C.trem);
        else roof(x0, a0 + 1, x1, a1 - 1, C.trem);
      }
    }
  }

  // ----- os nomes: as áreas (pelo meio) e as coisas com nome (pelo ponto) -----
  /** O tipo do nome (combinado com a [estrutura]: vila, agua, clareira, mata ou lugar). O `som` da área vale primeiro. */
  const tipoDe = (o: TObj, area: boolean) => {
    const nome = o.name ?? '';
    if (!area) return 'lugar';
    if (/vila/i.test(nome)) return 'vila';
    if (prop(o, 'som') === 'agua' || /lago|rio|riacho|represa|cachoeir/i.test(nome)) return 'agua';
    if (/clareira/i.test(nome)) return 'clareira';
    if (/^mata/i.test(nome)) return 'mata';
    return 'lugar'; // o posto, a estrada...
  };
  // a ordem conta: na janela do mapa, quando dois nomes se tocam, quem vem primeiro fica (combinado com a [estrutura]).
  // Primeiro a vila e os lugares de ir (a loja, o portão, o posto, a estrada), depois as clareiras e a água, depois as
  // matas (a do parque inteiro por último) e, no fim, as árvores, pedras e prédios com nome
  const rank: { nome: string; x: number; y: number; tipo: string; ordem: number }[] = [];
  const round = (v: number) => Math.round(v * 100) / 100;
  for (const o of layer('areas')) {
    if (!o.name) continue;
    const tipo = tipoDe(o, true);
    const ordem = tipo === 'vila' ? 0 : tipo === 'lugar' ? 1 : tipo === 'clareira' || tipo === 'agua' ? 2 : /parque/i.test(o.name) ? 4 : 3;
    rank.push({ nome: o.name, x: round((o.x + (o.width ?? 0) / 2) / M), y: round((o.y + (o.height ?? 0) / 2) / M), tipo, ordem });
  }
  // (o semáforo tem nome só para a [arte] achar ele; no mapa não é um lugar)
  const NOT_A_PLACE = new Set(['semaforo']);
  for (const o of scen) {
    if (!o.name || NOT_A_PLACE.has(o.type ?? '') || rank.some((n) => n.nome === o.name)) continue;
    const [cx, cy] = o.point ? [o.x, o.y] : [o.x + (o.width ?? 0) / 2, o.y + (o.height ?? 0) / 2];
    const ordem = o.type === 'casa' || o.type === 'portao' ? 1 : 5; // a loja e o portão são lugares de ir
    rank.push({ nome: o.name, x: round(cx / M), y: round(cy / M), tipo: 'lugar', ordem });
  }
  const nomes: MapImage['json']['nomes'] = rank.sort((a, b) => a.ordem - b.ordem).map(({ nome, x, y, tipo }) => ({ nome, x, y, tipo }));

  const png = new PNG({ width: cv.w, height: cv.h });
  png.data = Buffer.from(cv.data);
  return { png: PNG.sync.write(png), json: { escala, largura, altura, nomes } };
}

/** Escreve <id>-mapa.png e <id>-mapa.json ao lado do .tmj (ou na pasta `saida`). */
export function writeMapImage(tmjPath: string, escala = 8, saida?: string): { png: string; json: string } {
  const map = JSON.parse(readFileSync(tmjPath, 'utf8')) as TMap;
  const { png, json } = renderMapImage(map, escala);
  const id = path.basename(tmjPath, '.tmj');
  const dir = saida ?? path.dirname(tmjPath);
  const files = { png: path.join(dir, `${id}-mapa.png`), json: path.join(dir, `${id}-mapa.json`) };
  writeFileSync(files.png, png);
  writeFileSync(files.json, `${JSON.stringify(json, null, 2)}\n`);
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const tmj = process.argv[2];
  if (!tmj) {
    console.error('Uso: npx tsx scripts/mapa-de-cima.ts public/assets/maps-iso/<id>.tmj [--escala 8] [--saida pasta]');
    process.exit(1);
  }
  const at = (flag: string) => (process.argv.indexOf(flag) !== -1 ? process.argv[process.argv.indexOf(flag) + 1] : undefined);
  const files = writeMapImage(tmj, Number(at('--escala') ?? 8), at('--saida'));
  console.log(`Mapa visto de cima em ${path.relative(process.cwd(), files.png)} e ${path.relative(process.cwd(), files.json)}.`);
}
