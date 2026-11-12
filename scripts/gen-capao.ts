// Gera o Mapa 01 do mundo novo (2.5D isométrico) em public/assets/maps-iso/capao.tmj:
// o Parque Santo Dias e a Vila do Capão (Capão Redondo, zona sul de São Paulo).
//
// Formato combinado com a [estrutura] (roteiro, "🗺️ Mundo novo"): Tiled ortogonal, 1 tile = 1 metro (tile de 32 px,
// só como grade); tudo em camadas de objetos, sem tiles:
// - "chao": as áreas do chão, de baixo para cima (mata, grama, terra, asfalto, trilha, o círculo ancestral);
// - "cenario": as coisas com altura (árvores, gradil, portão, pilares, arbustos, pedras, postes, o brilho do Véu);
// - "colisao": retângulos onde o pé bate, tirados do cenário por este gerador (desenho e colisão nunca desencontram);
//   `bloqueiaTiro` false onde a pedrinha passa (gradil e portão de grade);
// - "seguro": retângulos de zona segura (monstro não entra, não nota e não acerta quem está dentro);
// - "areas": retângulos com nome, para a faixa com o nome do lugar;
// - "pontos": o nascimento ("spawn") e, depois, as chegadas.
// O servidor de hoje ainda não lê esse formato (exige tile de 16 px), por isso o arquivo fica fora de
// public/assets/maps até a [estrutura] ligar a leitura.
//
// Etapa 3 do escopo aprovado pelo dono: só a Clareira dos Despertos é andável (o círculo, a figueira, a trilha até o
// Portão I e um anel de mata em volta). Uma mata fechada de arbustos cerca a clareira e o portão fica fechado; a
// vila, o lago, as trilhas da mata e as criaturas entram na etapa 4. As medidas vêm da planta aprovada (12/11).
//
// Uso: npm run gen:capao (não sobrescreve o mapa existente sem --force; para comparar, use --out outro.tmj)

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { mulberry32 } from './pixels';

const outIndex = process.argv.indexOf('--out');
const OUT = path.resolve(outIndex !== -1 && process.argv[outIndex + 1] ? process.argv[outIndex + 1]! : 'public/assets/maps-iso/capao.tmj');
if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`O mapa ${path.relative(process.cwd(), OUT)} já existe (e pode ter edições feitas no Tiled).`);
  console.error('Para gerar de novo e PERDER essas edições, rode: npm run gen:capao -- --force');
  process.exit(1);
}

/** Pixels por metro no Tiled (o tile de 32 px é só a grade: 1 tile = 1 metro). */
const PX = 32;
/** Etapa do escopo aprovado (3 = só a clareira andável; na 4 entram a vila, o lago, as trilhas e as criaturas). */
const ETAPA = 3;
const W = 96;
const H = 80;
const SEED = 20261113;

// ---------------- medidas da planta aprovada (metros) ----------------
/** Centro da clareira e do círculo ancestral (onde se nasce). */
const C = { x: 37, y: 43 };
const CLEARING_R = 9;
const CIRCLE_R = 3;
/** Figueira dos Despertos: colada atrás do círculo. */
const FIG = { x: 36.5, y: 38, copa: 5.6, altura: 8.5, tronco: 2 };
/** O gradil do parque e o Portão I (fechado nesta etapa). */
const PARK_X = 48;
const GATE = { y0: 41, y1: 47 };
/** Trilha de terra da clareira ao portão (3 m de largura). */
const TRAIL_MAIN: [number, number][] = [
  [C.x, C.y],
  [PARK_X, 44],
];
/** A volta do lago (etapa 4); desenhada já, mas fechada por arbustos nesta etapa. */
const TRAIL_LOOP: [number, number][] = [
  [37, 43], [31, 32], [27, 14], [16, 9], [6, 16], [5, 34], [12, 46], [22, 58], [31, 52], [37, 43],
];
/** Lago (etapa 4): só reserva o lugar, sem árvores. */
const LAKE = { x: 16, y: 23, rx: 10.5, ry: 8.5 };
/** Anel de mata fechada que cerca a área andável nesta etapa. */
const RING = { inner: 12.6, outer: 14.4 };
/** Distância mínima entre troncos (borda a borda), para o pé de 0,6 × 0,4 passar. */
const TRUNK_GAP = 1.2;

type Props = Record<string, string | number | boolean>;
interface Shape {
  type: string;
  name?: string;
  /** Retângulo (x, y = canto de cima à esquerda) ou ponto (x, y). Em metros. */
  x: number;
  y: number;
  w?: number;
  h?: number;
  point?: boolean;
  ellipse?: boolean;
  polyline?: [number, number][];
  props?: Props;
}

const chao: Shape[] = [];
const cenario: Shape[] = [];
const colisao: Shape[] = [];
const seguro: Shape[] = [];
const areas: Shape[] = [];
const pontos: Shape[] = [];

const rect = (type: string, x0: number, x1: number, y0: number, y1: number, props?: Props, name?: string): Shape => ({ type, name, x: x0, y: y0, w: x1 - x0, h: y1 - y0, props });
const ellipse = (type: string, cx: number, cy: number, r: number, props?: Props): Shape => ({ type, x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, ellipse: true, props });
const point = (type: string, x: number, y: number, props?: Props, name?: string): Shape => ({ type, name, x, y, point: true, props });
/** Quadrado de colisão centrado em (x, y). */
const block = (type: string, x: number, y: number, side: number, props?: Props): Shape => rect(type, x - side / 2, x + side / 2, y - side / 2, y + side / 2, props);

const round = (v: number) => Math.round(v * 100) / 100;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
function distToPath(x: number, y: number, pts: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i]!;
    const [bx, by] = pts[i + 1]!;
    const [dx, dy] = [bx - ax, by - ay];
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, dist(x, y, ax + t * dx, ay + t * dy));
  }
  return best;
}

// ---------------- chão ----------------
chao.push(rect('mata', 0, PARK_X, 0, H));
chao.push(rect('terra', PARK_X, W, 0, H)); // a vila entra na etapa 4
chao.push(rect('asfalto', 49.5, 56, 0, H, { nome: 'Travessa Jasmim da Beirada' }));
chao.push(ellipse('grama', C.x, C.y, CLEARING_R));
chao.push({ type: 'trilha', x: 0, y: 0, polyline: TRAIL_LOOP, props: { largura: 2.2 } });
chao.push({ type: 'trilha', x: 0, y: 0, polyline: TRAIL_MAIN, props: { largura: 3 } });
chao.push(ellipse('circulo', C.x, C.y, CIRCLE_R, { brilho: '#3fd6c8' }));

// ---------------- cenário ----------------
const rng = mulberry32(SEED);
interface Tree {
  x: number;
  y: number;
  tronco: number;
}
const trees: Tree[] = [{ x: FIG.x, y: FIG.y, tronco: FIG.tronco }];
cenario.push(point('arvore', FIG.x, FIG.y, { especie: 'figueira', copa: FIG.copa, altura: FIG.altura, tronco: FIG.tronco }, 'Figueira dos Despertos'));
cenario.push(point('veu', FIG.x, FIG.y, { raio: 1.5 }));
cenario.push(point('veu', C.x, C.y, { raio: CIRCLE_R }));

/**
 * Pontos que a câmera precisa ver livres: o círculo, a clareira e a trilha até o portão. A câmera olha do sudeste
 * (x e y grandes ficam embaixo na tela), então uma árvore alta mais ao sul ou a leste "sobe" na tela e cobre o que
 * está atrás dela. Na primeira tela o círculo e a figueira aparecem inteiros (como na arte aprovada).
 */
const VIEW_KEYS: [number, number][] = [];
for (let x = C.x - CLEARING_R; x <= C.x + CLEARING_R; x += 1) {
  for (let y = C.y - CLEARING_R; y <= C.y + CLEARING_R; y += 1) if (dist(x, y, C.x, C.y) <= CLEARING_R) VIEW_KEYS.push([x, y]);
}
for (let t = 0; t <= 1; t += 0.05) VIEW_KEYS.push([TRAIL_MAIN[0]![0] + (TRAIL_MAIN[1]![0] - TRAIL_MAIN[0]![0]) * t, TRAIL_MAIN[0]![1] + (TRAIL_MAIN[1]![1] - TRAIL_MAIN[0]![1]) * t]);
/** Posição na tela (em metros da tela) de um ponto a uma altura z, na câmera isométrica do jogo (30° de inclinação). */
const screen = (x: number, y: number, z = 0) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2 * 0.5 - z * 0.866] as const;
/** A copa desta árvore tampa algum ponto que precisa ficar à vista? */
function hidesView(x: number, y: number, copa: number, altura: number): boolean {
  const [cx, cy] = screen(x, y, altura);
  return VIEW_KEYS.some(([kx, ky]) => {
    if (kx + ky >= x + y) return false; // só tampa o que está atrás dela
    const [sx, sy] = screen(kx, ky);
    return Math.hypot(sx - cx, sy - cy) < copa * 1.05;
  });
}

/** Cabe uma árvore aqui? (longe da clareira, da figueira, das trilhas, do lago e com folga entre troncos). */
function treeFits(x: number, y: number, tronco: number): boolean {
  if (dist(x, y, C.x, C.y) < CLEARING_R + 0.6 || dist(x, y, FIG.x, FIG.y) < 6.5) return false;
  if (distToPath(x, y, TRAIL_MAIN) < 2.4 || distToPath(x, y, TRAIL_LOOP) < 2) return false;
  if (((x - LAKE.x) / LAKE.rx) ** 2 + ((y - LAKE.y) / LAKE.ry) ** 2 < 1) return false;
  // folga de 1,2 m entre troncos (o pé passa) e mais um pouco, para a mata não ficar pesada de desenhar
  return trees.every((t) => dist(x, y, t.x, t.y) - (t.tronco + tronco) / 2 >= TRUNK_GAP + 1);
}
for (let tries = 0; tries < 6000; tries++) {
  const x = 1 + rng() * (PARK_X - 2.5);
  const y = 1 + rng() * (H - 2);
  const kind = rng();
  const especie = kind < 0.06 ? 'ipe-amarelo' : kind < 0.11 ? 'ipe-roxo' : 'mata';
  const tronco = round(especie === 'mata' ? 0.4 + rng() * 0.25 : 0.45);
  if (!treeFits(x, y, tronco)) continue;
  const copa = round(especie === 'mata' ? 1.7 + rng() * 1.2 : 2.3);
  const altura = round(especie === 'mata' ? 5 + rng() * 3.5 : 6);
  if (hidesView(x, y, copa, altura)) continue;
  trees.push({ x, y, tronco });
  cenario.push(point('arvore', round(x), round(y), { especie, copa, altura, tronco }));
}

// o gradil do parque (ferro velho com cipó) e o Portão I, fechado nesta etapa
cenario.push(rect('gradil', PARK_X - 0.1, PARK_X + 0.1, 0, GATE.y0 - 0.3, { altura: 1.8, estado: 'inteiro' }));
cenario.push(rect('gradil', PARK_X - 0.1, PARK_X + 0.1, GATE.y1 + 0.3, H, { altura: 1.8, estado: 'inteiro' }));
cenario.push(rect('portao', PARK_X - 0.1, PARK_X + 0.1, GATE.y0 + 0.3, GATE.y1 - 0.3, { aberto: false }, 'Portão I'));
for (const y of [GATE.y0, GATE.y1]) cenario.push(rect('pilar', PARK_X - 0.3, PARK_X + 0.3, y - 0.3, y + 0.3, { altura: 2.6 }));
// poste com luz quente do lado de fora do portão (aparece entre as grades)
cenario.push(point('poste', 50.5, 40, { altura: 4.2, luz: '#ffd36b' }));

// pedras e moitas baixas na beira da clareira (enfeite que dá para contornar)
for (const [x, y, raio] of [[30.2, 47.5, 0.55], [43.4, 38.6, 0.45], [31, 39.5, 0.4], [44.2, 49.2, 0.6]] as const) {
  cenario.push(point('pedra', x, y, { raio }));
}

// mata fechada em volta da área andável (só até a etapa 3): arbustos colados, sem vão para o pé passar.
// O lado leste fica fechado pelo gradil e pelo portão.
if (ETAPA < 4) {
  const r = (RING.inner + RING.outer) / 2;
  const steps = Math.ceil((2 * Math.PI * r) / 1.1);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = C.x + Math.cos(a) * r;
    const y = C.y + Math.sin(a) * r;
    if (x > PARK_X - 0.8) continue;
    cenario.push(point('arbusto', round(x), round(y), { raio: round(0.95 + rng() * 0.3), fechado: true }));
  }
}

// ---------------- colisão (tirada do cenário) ----------------
for (const s of cenario) {
  const p = s.props ?? {};
  if (s.type === 'arvore') colisao.push(block('tronco', s.x, s.y, Number(p.tronco)));
  else if (s.type === 'poste') colisao.push(block('poste', s.x, s.y, 0.3));
  else if (s.type === 'pedra') colisao.push(block('pedra', s.x, s.y, round(Number(p.raio) * 1.5)));
  else if (s.type === 'arbusto' && p.fechado) colisao.push(block('mata-fechada', s.x, s.y, round(Number(p.raio) * 1.8)));
  else if (s.type === 'gradil' || s.type === 'portao') colisao.push({ ...rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!), props: { bloqueiaTiro: false } });
  else if (s.type === 'pilar') colisao.push(rect('pilar', s.x, s.x + s.w!, s.y, s.y + s.h!));
}

// ---------------- zonas, áreas e pontos ----------------
seguro.push(rect('seguro', 31.5, 44, 39, 48.5, undefined, 'Clareira dos Despertos')); // sem combate onde se nasce
seguro.push(rect('seguro', 49.5, W, 0, H, undefined, 'Vila do Capão'));
areas.push(rect('area', 28, 46, 34, 52, undefined, 'Clareira dos Despertos'));
areas.push(rect('area', 0, PARK_X, 0, H, undefined, 'Mata do Parque Santo Dias'));
areas.push(rect('area', PARK_X, W, 0, H, undefined, 'Vila do Capão'));
pontos.push(point('ponto', C.x, C.y, undefined, 'spawn'));

// ---------------- escreve o .tmj ----------------
let nextId = 1;
function propsOf(props?: Props) {
  if (!props) return undefined;
  return Object.entries(props).map(([name, value]) => ({
    name,
    type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : 'string',
    value,
  }));
}
function toTiled(s: Shape) {
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
  };
  const properties = propsOf(s.props);
  return properties ? { ...base, properties } : base;
}
const LAYERS: [string, Shape[]][] = [
  ['chao', chao],
  ['cenario', cenario],
  ['colisao', colisao],
  ['seguro', seguro],
  ['areas', areas],
  ['pontos', pontos],
];
const layers = LAYERS.map(([name, shapes], i) => ({
  id: i + 1,
  name,
  type: 'objectgroup',
  draworder: 'index',
  opacity: 1,
  visible: true,
  x: 0,
  y: 0,
  objects: shapes.map(toTiled),
}));
const map = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.11.2',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  width: W,
  height: H,
  tilewidth: PX,
  tileheight: PX,
  infinite: false,
  nextlayerid: layers.length + 1,
  nextobjectid: nextId,
  properties: [
    { name: 'nome', type: 'string', value: 'Capão Redondo' },
    { name: 'seguro', type: 'bool', value: false },
  ],
  tilesets: [],
  layers,
};
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(map));
const count = (type: string) => cenario.filter((s) => s.type === type).length;
console.log(
  `Mapa gerado em ${path.relative(process.cwd(), OUT)}: ${W}x${H} m, ${count('arvore')} árvores, ${count('arbusto')} arbustos da mata fechada, ${colisao.length} retângulos de colisão.`,
);
