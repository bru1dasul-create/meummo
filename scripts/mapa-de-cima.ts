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
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8Array(w * h * 4);
  }
  plot(x: number, y: number, c: RGB, a = 1): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
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

/** Desenha o mapa visto de cima, a `escala` pixels por metro. */
export function renderMapImage(map: TMap, escala = 8): MapImage {
  const M = map.tilewidth; // pixels do Tiled por metro
  const [largura, altura] = [map.width, map.height];
  const cv = new Canvas(Math.round(largura * escala), Math.round(altura * escala));
  cv.rect(0, 0, cv.w, cv.h, C.fundo);
  const s = (v: number) => (v / M) * escala; // do Tiled para pixels da imagem
  const layer = (name: string) => map.layers.find((l) => l.name === name)?.objects ?? [];
  const pts = (o: TObj, list: { x: number; y: number }[]): [number, number][] => list.map((p) => [s(o.x + p.x), s(o.y + p.y)]);
  const box = (o: TObj) => [s(o.x), s(o.y), s(o.x + (o.width ?? 0)), s(o.y + (o.height ?? 0))] as const;

  // ----- o chão, na ordem da camada (o que vem depois fica por cima) -----
  const GROUND: Record<string, RGB> = {
    mata: C.mata, 'mata-profunda': C.mataProfunda, grama: C.grama, circulo: C.circulo, terra: C.terra, campinho: C.campinho,
    praca: C.praca, calcada: C.calcada, asfalto: C.asfalto, agua: C.agua, lama: C.lama, trilha: C.trilha,
  };
  for (const o of layer('chao')) {
    const t = o.type ?? '';
    const c = GROUND[t];
    if (t === 'faixa-rua' && o.polyline) cv.line(pts(o, o.polyline), Math.max(1, escala * 0.15), C.faixaRua, 0.9);
    if (t === 'faixa') {
      // a faixa de pedestre: listras brancas no sentido em que se atravessa
      const [x0, y0, x1, y1] = box(o);
      const along = prop(o, 'listras') === 'y';
      for (let k = 0; ; k++) {
        const a = (along ? y0 : x0) + k * escala * 0.8;
        if (a >= (along ? y1 : x1)) break;
        if (along) cv.rect(x0, a, x1, Math.min(y1, a + escala * 0.45), C.branco, 0.85);
        else cv.rect(a, y0, Math.min(x1, a + escala * 0.45), y1, C.branco, 0.85);
      }
      continue;
    }
    if (!c) continue;
    const alpha = t === 'grama' ? 0.85 : 1;
    if (o.polygon) cv.polygon(pts(o, o.polygon), c, alpha);
    else if (o.polyline) cv.line(pts(o, o.polyline), Math.max(1.5, s(num(o, 'largura', 1) * M)), c, alpha);
    else if (o.ellipse) {
      const [x0, y0, x1, y1] = box(o);
      cv.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, c, alpha);
    } else if (!o.point) {
      const [x0, y0, x1, y1] = box(o);
      cv.rect(x0, y0, x1, y1, c, alpha);
      if (t === 'campinho') {
        // as linhas de cal do campinho
        const [w, h] = [x1 - x0, y1 - y0];
        cv.line([[x0 + 2, y0 + 2], [x1 - 2, y0 + 2], [x1 - 2, y1 - 2], [x0 + 2, y1 - 2], [x0 + 2, y0 + 2]], 1, C.branco, 0.8);
        cv.line(w > h ? [[(x0 + x1) / 2, y0 + 2], [(x0 + x1) / 2, y1 - 2]] : [[x0 + 2, (y0 + y1) / 2], [x1 - 2, (y0 + y1) / 2]], 1, C.branco, 0.8);
      }
    }
  }

  // ----- as coisas: primeiro o que fica no chão (deque, pinguela), depois as construções, por fim as copas -----
  const scen = layer('cenario');
  for (const o of scen) {
    if (o.type === 'deque' || o.type === 'pinguela') {
      const [x0, y0, x1, y1] = box(o);
      if (prop(o, 'pedras') === true) {
        // as pedras de atravessar o riacho: uma fileira de pedras
        const along = x1 - x0 >= y1 - y0;
        const n = 4;
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          const [cx, cy] = along ? [x0 + (x1 - x0) * t, (y0 + y1) / 2] : [(x0 + x1) / 2, y0 + (y1 - y0) * t];
          const r = Math.min(x1 - x0, y1 - y0) * 0.38;
          cv.ellipse(cx, cy, r, r, C.pedra);
        }
      } else cv.rect(x0, y0, x1, y1, C.madeira);
    }
  }
  for (const o of scen) {
    const t = o.type ?? '';
    if (o.point) {
      const [x, y] = [s(o.x), s(o.y)];
      if (t === 'pedra') cv.ellipse(x, y, s(num(o, 'raio', 0.5) * M), s(num(o, 'raio', 0.5) * M), C.pedra);
      else if (t === 'pneus') cv.ellipse(x, y, s(num(o, 'raio', 0.5) * M), s(num(o, 'raio', 0.5) * M), C.pneu);
      else if (t === 'parquinho') cv.ellipse(x, y, s(num(o, 'raio', 0.8) * M), s(num(o, 'raio', 0.8) * M), C.ferrugem, 0.9);
      continue;
    }
    if (o.polyline) continue;
    const [x0, y0, x1, y1] = box(o);
    const fill = (c: RGB, a = 1, edge = true) => {
      cv.rect(x0, y0, x1, y1, c, a);
      if (edge) cv.line([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], 1, C.contorno, 0.6);
    };
    if (t === 'casa') fill(shade(hex(String(prop(o, 'cor') ?? '#b07a50')), 0.82));
    else if (t === 'predio') fill(C.predio);
    else if (t === 'muro') fill(C.muro, 1, false);
    else if (t === 'gradil' || t === 'portao') cv.rect(Math.min(x0, x1 - 1), Math.min(y0, y1 - 1), Math.max(x1, x0 + 1), Math.max(y1, y0 + 1), C.ferro);
    else if (t === 'pilar' || t === 'pilar-viaduto') fill(C.concreto, 1, false);
    else if (t === 'trem') fill(C.trem);
    else if (t === 'onibus') fill(C.onibus);
    else if (t === 'carro' || t === 'moto') fill(C.carro, 1, false);
    else if (t === 'trave' || t === 'barreira') fill(C.branco, 0.9, false);
    else if (t === 'tronco-caido') fill(C.madeira, 1, false);
    // a floresta maior: o parquinho enferrujado, as bombas do posto e as pedras da cachoeirinha (com a água caindo)
    else if (t === 'parquinho') fill(C.ferrugem, 0.9, false);
    else if (t === 'bomba') fill(C.bomba, 1, false);
    else if (t === 'cachoeira') {
      fill(C.pedra, 1, false);
      cv.line([[(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]], Math.max(1, escala * 0.5), C.branco, 0.85);
    }
  }
  // a cobertura do posto: o teto meio transparente (as bombas embaixo continuam aparecendo)
  for (const o of scen) {
    if (o.type !== 'cobertura') continue;
    const [x0, y0, x1, y1] = box(o);
    cv.rect(x0, y0, x1, y1, C.concreto, 0.55);
    cv.line([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], 1, C.contorno, 0.6);
  }
  // a mata fechada (as paredes de mato) e o bambu
  for (const o of scen) {
    if (!o.point) continue;
    const [x, y] = [s(o.x), s(o.y)];
    if (o.type === 'arbusto' && prop(o, 'fechado') === true) cv.ellipse(x, y, s(num(o, 'raio', 1) * M), s(num(o, 'raio', 1) * M), C.mataFechada, 0.92);
    else if (o.type === 'bambu') cv.ellipse(x, y, s(num(o, 'raio', 0.8) * M), s(num(o, 'raio', 0.8) * M), C.bambu, 0.9);
  }
  // as copas, meio transparentes (a trilha embaixo continua aparecendo); a de dentro de casa não aparece (o telhado cobre)
  for (const o of scen) {
    if (o.type !== 'arvore' || !o.point || prop(o, 'dentroDaCasa') === true) continue;
    const r = s(num(o, 'copa', 2) * M) * 0.9;
    // a árvore que dá flor (a paineira) aparece com a cor da flor: dá para achar ela no mapa
    const flor = prop(o, 'flores');
    const c = typeof flor === 'string' ? hex(flor) : C.copa;
    cv.ellipse(s(o.x), s(o.y), r, r, c, typeof flor === 'string' ? 0.75 : 0.5);
    cv.ellipse(s(o.x), s(o.y), r * 0.45, r * 0.45, shade(c, 0.8), 0.35);
  }
  // o viaduto passa por cima de tudo (o tabuleiro é alto)
  for (const o of scen) {
    if (o.type !== 'viaduto') continue;
    const [x0, y0, x1, y1] = box(o);
    cv.rect(x0, y0, x1, y1, C.concreto, 0.85);
    cv.line([[x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]], 1, C.trem, 0.6);
  }

  // ----- os nomes: as áreas (pelo meio) e as coisas com nome (pelo ponto) -----
  const tipoDe = (nome: string, area: boolean) => {
    if (!area) return 'lugar';
    if (/vila/i.test(nome)) return 'vila';
    if (/lago|rio|riacho|represa/i.test(nome)) return 'agua';
    if (/clareira/i.test(nome)) return 'clareira';
    return 'mata';
  };
  const nomes: MapImage['json']['nomes'] = [];
  const round = (v: number) => Math.round(v * 100) / 100;
  for (const o of layer('areas')) {
    if (!o.name) continue;
    nomes.push({ nome: o.name, x: round((o.x + (o.width ?? 0) / 2) / M), y: round((o.y + (o.height ?? 0) / 2) / M), tipo: tipoDe(o.name, true) });
  }
  for (const o of scen) {
    if (!o.name || nomes.some((n) => n.nome === o.name)) continue;
    const [cx, cy] = o.point ? [o.x, o.y] : [o.x + (o.width ?? 0) / 2, o.y + (o.height ?? 0) / 2];
    nomes.push({ nome: o.name, x: round(cx / M), y: round(cy / M), tipo: 'lugar' });
  }

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
