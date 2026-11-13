// Gera o Mapa 02 do mundo novo (2.5D isométrico) em public/assets/maps-iso/guarapiranga.tmj:
// a Represa de Guarapiranga, com o Refúgio (a segunda vila, sobre palafitas na água).
//
// Formato combinado com a [estrutura] (docs/ARQUITETURA.md, "Mapas do mundo novo"); peças comuns em scripts/iso-map.ts.
// Escopo aprovado pelo dono (13/11, a planta em docs/referencias/mapa-02-planta.jpg), em pedaços, cada um com a
// aprovação dele: a) a chegada pela Estrada do M'Boi Mirim e o Refúgio; b) o Parque Ecológico do Guarapiranga (com a
// Caipora) e o brejo (jararacas); c) a orla, o clube náutico em ruínas (Corpo-Seco), a praça do Saci e a barragem de
// 1909 (a saída para Santo Amaro). O pedaço é a constante STAGE: o que ainda não foi feito fica fechado pela mata.
//
// Uso: npm run gen:guarapiranga (não sobrescreve o mapa existente sem --force; para comparar, use --out outro.tmj)

import { mulberry32 } from './pixels';
import {
  area,
  block,
  blob,
  box,
  boxCovers,
  checkWedges,
  covers,
  dist,
  distToPath,
  inRect,
  inside,
  line,
  outputPath,
  pathPoints,
  point,
  rect,
  rectGap,
  rectOf,
  rectPoints,
  round,
  smooth,
  waterStrips,
  writeTmj,
  type Pt,
  type Rect,
  type Shape,
} from './iso-map';

const OUT = outputPath('public/assets/maps-iso/guarapiranga.tmj', 'gen:guarapiranga');
const STAGES = ['a', 'b', 'c'] as const;
const STAGE: (typeof STAGES)[number] = 'a';
const reached = (stage: (typeof STAGES)[number]) => STAGES.indexOf(STAGE) >= STAGES.indexOf(stage);
const W = 120;
const H = 100;
const SEED = 20261114;
/** Duas coisas sólidas de frente uma para a outra ficam coladas ou a pelo menos isto (num vão menor o pé entala). */
const MIN_GAP = 1.2;
/** Distância mínima entre troncos (borda a borda), para o pé de 0,6 × 0,4 passar. */
const TRUNK_GAP = 1.2;

// ---------------- o desenho do mapa (metros) ----------------
/**
 * A margem da represa, de leste (na barragem) para oeste pela orla e depois para o sul pela margem oeste. A água fica ao
 * sul e a leste dela, até as beiradas do mapa.
 */
const SHORE_CTRL: Pt[] = [
  [122, 37.5], [118, 36.6], [113, 35.8], [107, 36.2], [101, 34.2], [95, 33], [88, 31.6], [81, 31.2], [74, 32.3], [67, 33],
  [60, 31.8], [53, 32], [47, 33.5], [42.6, 37], [41.2, 40.5], [40.5, 45.5], [40.7, 51], [41.3, 57], [41.6, 63], [40.4, 70],
  [38.8, 78], [39.6, 86], [37.8, 94], [38.2, 102],
];
const SHORE = smooth(SHORE_CTRL, 1.2, false, 0.3);
const WATER: Pt[] = [...SHORE, [122, 102]];
/** A Estrada do M'Boi Mirim: chega do Capão pela beira de cima e vira a rua da orla, até a barragem (no leste). */
const ROAD = smooth([[19.2, -1], [19.8, 7], [22.6, 13.6], [28.6, 19.4], [37, 23.4], [47, 25.4], [60, 25.6], [74, 25], [88, 25.6], [101, 27.6], [112, 29.6], [122, 31]], 1.5);
const ROAD_W = 6;
/** A calçada (com mato) dos dois lados do asfalto. */
const SIDEWALK = 1.5;
const ROAD_HALF = ROAD_W / 2 + SIDEWALK;
/** O Caminho da Represa: desce da estrada pela margem oeste até o píer do Refúgio. */
const PATH = smooth([[38.6, 26.6], [37.7, 33], [36.8, 40], [36.6, 46], [37.5, 51.4], [39.4, 54.8], [41, 56]], 1);
const PATH_W = 3;
/** Na etapa a, a estrada para o leste (orla, clube, barragem) está fechada por uma árvore caída. */
const ROAD_BLOCK_X = 49;

// ----- o Refúgio: a vila sobre palafitas -----
/** O deque (de madeira, sobre palafitas): o miolo com a praça, o píer até a margem, o atracadouro do Barqueiro e o deque sudeste. */
const CORE: Rect = { x0: 47, x1: 69, y0: 45, y1: 60 };
const PIER: Rect = { x0: 40.5, x1: 47, y0: 55, y1: 57 };
const LANDING: Rect = { x0: 47, x1: 52.5, y0: 60, y1: 63.5 };
const SE_DECK: Rect = { x0: 60, x1: 69, y0: 60, y1: 66 };
const DECKS: [Rect, string][] = [
  [CORE, 'Praça do Refúgio'],
  [PIER, 'Píer'],
  [LANDING, 'Atracadouro'],
  [SE_DECK, ''],
];
const onDeck = (x: number, y: number) => DECKS.some(([r]) => inRect(x, y, r));
interface House extends Rect {
  name: string;
  cor: string;
  extra?: Record<string, string | number | boolean>;
}
/** As casas de tábua, coloridas (a frente é o lado sul, o que a câmera vê). Coladas na beirada do deque, sem vão. */
const HOUSES: House[] = [
  { name: 'Casa Azul', x0: 47, x1: 52, y0: 45, y1: 49.5, cor: '#3f7fbf' },
  {
    name: 'Quitanda da Dona Iracema',
    x0: 54.5,
    x1: 60.5,
    y0: 45,
    y1: 49.8,
    cor: '#4f9f5f',
    extra: { comercio: 'quitanda', letreiro: 'QUITANDA DONA IRACEMA', toldo: '#e2552f' },
  },
  { name: 'Casa Laranja', x0: 62.5, x1: 67, y0: 45, y1: 49.5, cor: '#c9774a' },
  { name: 'Casa Amarela', x0: 64.5, x1: 69, y0: 52.5, y1: 57, cor: '#e8c75a' },
  { name: 'Casa Rosa', x0: 63.5, x1: 69, y0: 61, y1: 64.5, cor: '#c46aa8' },
];
/** Altura das casas até o beiral, e a do telhado de zinco por cima (para a conta da câmera). */
const HOUSE_H = 3;
const ROOF_H = 1.3;
/** Onde fica a Dona Iracema: no balcão da quitanda, do lado da praça (o NPC é da [estrutura], em data/npcs.json). */
const IRACEMA = { x: 57.5, y: 50.6 };
/** O Barqueiro, no atracadouro, do lado do barco dele. */
const BARQUEIRO = { x: 49.6, y: 62.4 };
/** A fogueira da praça, com bancos em volta. */
const FIRE = { x: 57, y: 55.3 };

// ----- a chegada -----
/** Onde aparece quem chega do Capão, e a saída de volta (a beira de cima, na estrada). */
const ARRIVAL = { x: 19.9, y: 4 };
const EXIT_NORTH: Rect = { x0: 14.5, x1: 25, y0: 0, y1: 0.6 };
/** O ponto de ônibus (o último ponto da linha), do lado oeste da estrada, virado para ela. */
const BUS_STOP: Rect = { x0: 13.2, x1: 14.6, y0: 5, y1: 8.4 };

const chao: Shape[] = [];
const cenario: Shape[] = [];
const colisao: Shape[] = [];
const seguro: Shape[] = [];
const areas: Shape[] = [];
const pontos: Shape[] = [];
const saidas: Shape[] = [];

// ---------------- conferências da água e dos caminhos ----------------
const isWater = (x: number, y: number) => inside(x, y, WATER) && !onDeck(x, y);
/** Quanto falta até a beira da água (negativo dentro dela). */
const shoreGap = (x: number, y: number) => (inside(x, y, WATER) ? -1 : 1) * distToPath(x, y, SHORE);
const roadGap = (x: number, y: number) => distToPath(x, y, ROAD) - ROAD_HALF;
const pathGap = (x: number, y: number) => distToPath(x, y, PATH) - PATH_W / 2;
/** A parte da estrada aberta nesta etapa (até a árvore caída). */
const ROAD_OPEN = ROAD.filter(([x]) => x <= ROAD_BLOCK_X + 1);

// ---------------- chão ----------------
chao.push(rect('mata', 0, W, 0, H));
// a orla (a parte de cima da represa, do outro lado da estrada): grama alta onde era a avenida da beira
chao.push(area('grama', [[44, 22], [W, 22], [W, 40], [44, 40]]));
// a beira da água: um pouco de lama, por baixo da água
chao.push(line('lama', SHORE.filter(([, y]) => y < H + 1), { largura: 3.2 }));
// o brejo do sul (pedaço b): lama e taboas
chao.push(area('lama', blob(20, 87, 17, 10, 0.12)));
chao.push(area('agua', WATER, { cor: '#2f6f6a' }, 'Represa de Guarapiranga'));
// a Ilha do Véu, no meio da represa (só de barco, depois)
const ISLAND = blob(92, 72, 6, 4.5, 0.15);
chao.push(area('grama', ISLAND, undefined, 'Ilha do Véu'));
// a estrada (asfalto rachado, com a calçada tomada pelo mato) e o caminho de terra até o píer
chao.push(line('calcada', ROAD, { largura: ROAD_W + 2 * SIDEWALK }));
chao.push(line('asfalto', ROAD, { largura: ROAD_W, estado: 'rachado', nome: "Estrada do M'Boi Mirim" }));
chao.push(line('trilha', PATH, { largura: PATH_W, nome: 'Caminho da Represa' }));

// ---------------- a vista da câmera ----------------
/**
 * Pontos que a câmera precisa ver livres: a estrada aberta, o caminho, o píer, o deque inteiro e a água logo em volta do
 * Refúgio. A câmera olha do sudeste: uma copa alta mais ao sul ou a leste "sobe" na tela e cobre o que está atrás dela.
 */
const VIEW_KEYS: Pt[] = [...pathPoints(ROAD_OPEN, ROAD_W + 2 * SIDEWALK), ...pathPoints(PATH, PATH_W)];
for (const [r] of DECKS) VIEW_KEYS.push(...rectPoints(r));
const hidesView = (x: number, y: number, copa: number, altura: number) => VIEW_KEYS.some(([kx, ky]) => covers(x, y, copa, altura, kx, ky));

// ---------------- cenário ----------------
interface Trunk {
  x: number;
  y: number;
  r: number;
}
/** Tudo que tem tronco ou é moita que bloqueia (para a folga entre eles). */
const trunks: Trunk[] = [];
const SPECIES: Record<string, { tronco: number; copa: number; altura: number }> = {
  jeriva: { tronco: 0.3, copa: 2, altura: 7 },
  embauba: { tronco: 0.35, copa: 2.2, altura: 7 },
  seca: { tronco: 0.4, copa: 1.4, altura: 6 },
  xaxim: { tronco: 0.3, copa: 1.2, altura: 2.5 },
  bananeira: { tronco: 0.35, copa: 1.5, altura: 3.5 },
};
const treeDims = (especie: string, rng: () => number) =>
  SPECIES[especie] ?? { tronco: round(0.4 + rng() * 0.25), copa: round(1.7 + rng() * 1.2), altura: round(5 + rng() * 3.5) };
/** Lugares guardados (centro, raio): nada com tronco em cima. */
const reserved: { x: number; y: number; r: number }[] = [];
/** Cabe uma árvore aqui? Fora da água e do deque, longe da estrada e do caminho, com folga dos outros troncos. */
function treeFits(x: number, y: number, tronco: number, copa: number, gap: number): boolean {
  if (x < 1 || x > W - 1 || y < 1 || y > H - 1) return false;
  if (shoreGap(x, y) < tronco / 2 + 0.8 || inside(x, y, WATER)) return false;
  if (roadGap(x, y) < copa * 0.5 + 2.2 || pathGap(x, y) < copa * 0.5 + 2.2) return false;
  if (reserved.some((q) => dist(x, y, q.x, q.y) < q.r + tronco / 2)) return false;
  return trunks.every((t) => dist(x, y, t.x, t.y) - t.r - tronco / 2 >= gap);
}
function plant(x: number, y: number, especie: string, d: { tronco: number; copa: number; altura: number }, gap: number): boolean {
  if (!treeFits(x, y, d.tronco, d.copa, gap) || hidesView(x, y, d.copa, d.altura)) return false;
  trunks.push({ x, y, r: d.tronco / 2 });
  cenario.push(point('arvore', x, y, { especie, ...d }));
  return true;
}
/** Moita de mata fechada (parede), sem conferir folga com as outras moitas. */
const thickets: Trunk[] = [];
function thicket(x: number, y: number, raio: number): void {
  trunks.push({ x, y, r: raio });
  thickets.push({ x, y, r: raio });
  cenario.push(point('arbusto', x, y, { raio, fechado: true }));
}

// ----- a chegada: o ponto de ônibus, as placas e os postes da estrada -----
/** O ponto na beira da estrada mais perto de (x, y), a `offset` metros do meio do asfalto, do lado onde (x, y) está. */
function roadside(x: number, y: number, offset: number): Pt {
  let best: { d: number; p: Pt; n: Pt } | undefined;
  for (let i = 0; i + 1 < ROAD.length; i++) {
    const [[ax, ay], [bx, by]] = [ROAD[i]!, ROAD[i + 1]!];
    const [dx, dy] = [bx - ax, by - ay];
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (len * len)));
    const [px, py] = [ax + t * dx, ay + t * dy];
    const d = dist(x, y, px, py);
    if (!best || d < best.d) {
      const side = Math.sign(-dy * (x - px) + dx * (y - py)) || 1;
      best = { d, p: [px, py], n: [(-dy / len) * side, (dx / len) * side] };
    }
  }
  return [round(best!.p[0] + best!.n[0] * offset), round(best!.p[1] + best!.n[1] * offset)];
}
cenario.push(box('ponto-onibus', BUS_STOP, { altura: 2.6, olhando: 0, placa: "M'BOI MIRIM" }, 'Ponto final'));
trunks.push({ x: (BUS_STOP.x0 + BUS_STOP.x1) / 2, y: (BUS_STOP.y0 + BUS_STOP.y1) / 2, r: 0.7 });
// as placas ficam na beira da calçada, coladas na mata (sem vão de entalar)
for (const [tx, ty, texto] of [[25.4, 9.6, 'GUARAPIRANGA'], [34.6, 28.4, 'REFÚGIO']] as const) {
  const [x, y] = roadside(tx, ty, ROAD_HALF + 0.12);
  cenario.push(point('placa', x, y, { texto, seta: 'sul', poste: true }));
  trunks.push({ x, y, r: 0.1 });
}
/** Postes de concreto na beira norte da estrada (a luz já não acende: só os do Refúgio têm luz). */
const POSTS: Pt[] = [[24.6, 4.2], [26.4, 13.4], [33.6, 18.6], [43.2, 21]].map(([x, y]) => roadside(x!, y!, ROAD_HALF + 0.17));
for (const [x, y] of POSTS) {
  cenario.push(point('poste', x, y, { altura: 7, apagado: true }));
  trunks.push({ x, y, r: 0.15 });
}
cenario.push(line('fiacao', POSTS, { altura: 6.6 }));

// ----- a mata fechada: as paredes dos dois lados da estrada (até a árvore caída) e do lado oeste do caminho -----
const erng = mulberry32(SEED + 6);
/**
 * Pontos de uma linha a `offset` metros para um lado do caminho, a cada `step`: positivo é o lado da normal (-dy, dx)
 * (andando para o sul, o oeste; andando para o leste, o sul), negativo é o outro.
 */
function offsetLine(pts: Pt[], offset: number, step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [[ax, ay], [bx, by]] = [pts[i]!, pts[i + 1]!];
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
    for (let d = 0; d < len; d += step) out.push([ax + ((bx - ax) * d) / len + nx * offset, ay + ((by - ay) * d) / len + ny * offset]);
  }
  return out;
}
const WALL_OFFSET = 0.95;
/** Uma moita entra na parede se fica longe o bastante do chão por onde se anda (a estrada aberta, o caminho, o deque). */
const wallOk = (x: number, y: number) =>
  distToPath(x, y, ROAD_OPEN) >= ROAD_HALF + WALL_OFFSET - 0.05 && pathGap(x, y) >= WALL_OFFSET - 0.05 && !inside(x, y, WATER);
const wallPts: Pt[] = [];
// os dois lados da estrada: o do norte até a árvore caída; o do sul (a mata do parque) só até o Caminho da Represa —
// dali para o leste, entre a estrada e a água, é a margem, aberta
wallPts.push(...offsetLine(ROAD_OPEN, -(ROAD_HALF + WALL_OFFSET), 0.8));
wallPts.push(...offsetLine(ROAD_OPEN, ROAD_HALF + WALL_OFFSET, 0.8).filter(([x]) => x < PATH[0]![0] - 1));
// o lado oeste do caminho (de quem desce, a mata do parque) e o fim do caminho, perto do píer (rumo ao brejo, pedaço b)
wallPts.push(...offsetLine(PATH, PATH_W / 2 + WALL_OFFSET, 0.8)); // (descendo para o sul, a esquerda do caminho é o oeste)
for (let x = 35.4; x <= 41.6; x += 0.8) wallPts.push([x, 59.2]);
// a árvore caída fecha a estrada para o leste (a orla é o pedaço c); moitas da ponta dela até a água
const FALLEN: Rect = { x0: ROAD_BLOCK_X - 0.5, x1: ROAD_BLOCK_X + 0.5, y0: 20.6, y1: 31 };
for (let y = FALLEN.y1 + 0.4; y < 35; y += 0.8) if (!inside(ROAD_BLOCK_X, y + 0.6, WATER)) wallPts.push([ROAD_BLOCK_X, y]);
for (const [x, y] of wallPts) {
  if (x < 0 || y < 0 || x > W || y > H || !wallOk(x, y) || x > ROAD_BLOCK_X + 0.2) continue;
  if (inRect(x, y, BUS_STOP, -0.25) || thickets.some((t) => dist(x, y, t.x, t.y) < 0.55)) continue; // (as moitas cobrem postes e placas)
  // um pouco torta e de tamanhos diferentes, para parecer mato e não cerca viva
  const [jx, jy] = [(erng() - 0.5) * 0.3, (erng() - 0.5) * 0.3];
  const raio = round(0.9 + erng() * 0.35);
  if (wallOk(x + jx, y + jy)) thicket(round(x + jx), round(y + jy), raio);
  else thicket(round(x), round(y), raio);
}
cenario.push(box('tronco-caido', FALLEN, { altura: 1.1, galhos: true }, 'Árvore caída'));
trunks.push({ x: ROAD_BLOCK_X, y: (FALLEN.y0 + FALLEN.y1) / 2, r: 0.5 });

// ----- o Refúgio -----
const vrng = mulberry32(SEED + 5);
for (const [r, name] of DECKS) cenario.push(box('deque', r, { altura: 0.6, palafitas: true }, name));
for (const h of HOUSES) {
  cenario.push(box('casa', h, { altura: HOUSE_H, andares: 1, cor: h.cor, material: 'tabua', telhado: 'zinco', palafita: true, ...h.extra }, h.name));
}
// a fogueira da praça, com os bancos em volta virados para o fogo
cenario.push(point('fogueira', FIRE.x, FIRE.y, { raio: 0.6, luz: '#ffb347' }));
const BENCHES: [number, number, number, number, number][] = [
  [FIRE.x - 0.8, FIRE.x + 0.8, FIRE.y - 2.85, FIRE.y - 2.35, 90],
  [FIRE.x - 0.8, FIRE.x + 0.8, FIRE.y + 2.35, FIRE.y + 2.85, 270],
  [FIRE.x - 2.85, FIRE.x - 2.35, FIRE.y - 0.8, FIRE.y + 0.8, 0],
  [FIRE.x + 2.35, FIRE.x + 2.85, FIRE.y - 0.8, FIRE.y + 0.8, 180],
];
for (const [x0, x1, y0, y1, olhando] of BENCHES) cenario.push(rect('banco', x0, x1, y0, y1, { olhando, material: 'tabua' }));
// lampiões nas beiradas do deque (luz quente) e as bandeirinhas cruzando a praça
const LAMPS: Pt[] = [[47.15, 52.6], [68.85, 50.9], [52.35, 63.35], [60.15, 65.85], [61.6, 59.85]];
for (const [x, y] of LAMPS) cenario.push(point('poste-praca', x, y, { altura: 3.2, luz: '#ffd36b', estilo: 'lampiao' }));
cenario.push(line('bandeirinhas', [[47.15, 52.6], [57, 54.2], [64.5, 57]], { altura: 3.1 }));
cenario.push(line('bandeirinhas', [[52, 49.5], [56.6, 56.6], [61.6, 59.85]], { altura: 3.1 }));
cenario.push(line('bandeirinhas', [[60.5, 49.8], [64.5, 52.5]], { altura: 3 }));
// caixotes e barris encostados nas paredes e na beira do deque (sem vão para o pé entalar)
const CARGO: [string, number, number, number, number][] = [
  ['caixote', 53.8, 54.5, 48.4, 49.1], // a mercadoria da quitanda, colada na parede
  ['caixote', 53.9, 54.5, 47.6, 48.3],
  ['barril', 60.5, 61.1, 45, 45.6], // entre a quitanda e a casa laranja, encostado nas duas
  ['barril', 47, 47.6, 62.2, 62.8], // no canto do atracadouro, um colado no outro e na beira
  ['caixote', 47, 47.7, 62.8, 63.5],
  ['barril', 68.4, 69, 57, 57.6], // na frente da casa amarela, colado nela e na beira leste
];
for (const [type, x0, x1, y0, y1] of CARGO) cenario.push(rect(type, x0, x1, y0, y1, { altura: type === 'barril' ? 0.9 : 0.7 }));
// os barcos atracados (o do Barqueiro é a voadeira), e uns afundados na represa
const BOATS: [number, number, number, number, Record<string, string | number | boolean>][] = [
  [47.6, 52.2, 63.8, 65.3, { tipo: 'voadeira', cor: '#d9d2c3', olhando: 0 }],
  [69.4, 70.6, 45.4, 49.4, { tipo: 'canoa', cor: '#3f7fbf', olhando: 90 }],
  [53.6, 57.6, 60.5, 61.6, { tipo: 'canoa', cor: '#c9774a', olhando: 180 }],
  [69.4, 70.6, 60.6, 64.6, { tipo: 'canoa', cor: '#4f9f5f', olhando: 270 }],
  [79, 83, 47.5, 48.9, { tipo: 'canoa', afundado: true }],
  [97, 101.5, 61, 62.6, { tipo: 'voadeira', afundado: true }],
  [72, 76, 83, 84.4, { tipo: 'canoa', afundado: true }],
];
for (const [x0, x1, y0, y1, props] of BOATS) cenario.push(rect('barco', x0, x1, y0, y1, props));
// taboas e aguapés na água rasa, longe do píer e do deque
for (let i = 0, n = 0; i < 600 && n < 16; i++) {
  const s = Math.floor(vrng() * (SHORE.length - 1));
  const [x, y] = SHORE[s]!;
  const [dx, dy] = [SHORE[s + 1]![0] - x, SHORE[s + 1]![1] - y];
  const l = Math.hypot(dx, dy) || 1;
  const off = 0.5 + vrng() * 0.8;
  const [px, py] = [x + (-dy / l) * off, y + (dx / l) * off];
  if (!isWater(px, py) || DECKS.some(([r]) => rectGap(px, py, r) < 2.5) || px > ROAD_BLOCK_X + 30) continue;
  cenario.push(point('planta', px, py, { tipo: 'taboa', raio: round(0.4 + vrng() * 0.2) }));
  n++;
}
for (let i = 0, n = 0; i < 400 && n < 14; i++) {
  const [x, y] = [42 + vrng() * 40, 34 + vrng() * 50];
  if (!isWater(x, y) || DECKS.some(([r]) => rectGap(x, y, r) < 2) || shoreGap(x, y) > -1.5) continue;
  cenario.push(point('aguape', x, y, { raio: round(0.5 + vrng() * 0.5) }));
  n++;
}

// ----- as árvores: a mata do parque (pedaço b), a mata do norte, a orla e a ilha (só enfeite nesta etapa) -----
// a mata do parque e a do norte da estrada: aberta como a mata nova do Capão (aprovada em 13/11), com palmeiras,
// embaúbas, bananeiras e árvores secas no meio das grandes
const trng = mulberry32(SEED + 1);
const mixed = (k: number) => (k < 0.1 ? 'jeriva' : k < 0.22 ? 'embauba' : k < 0.27 ? 'seca' : 'mata');
for (let tries = 0; tries < 6000; tries++) {
  const [x, y] = [1 + trng() * 48, 1 + trng() * 98];
  const k = trng();
  const especie = k < 0.08 ? 'bananeira' : mixed((k - 0.08) / 0.92);
  const d = treeDims(especie, trng);
  plant(round(x), round(y), especie, d, TRUNK_GAP + (especie === 'mata' ? 3.4 : 2.4));
}
// xaxins na beira da água, onde é úmido
for (let i = 0, n = 0; i < 3000 && n < 10; i++) {
  const [x, y] = [28 + trng() * 14, 30 + trng() * 60];
  const g = shoreGap(x, y);
  if (g > 1.2 && g < 6 && plant(round(x), round(y), 'xaxim', SPECIES.xaxim!, TRUNK_GAP + 0.8)) n++;
}
const orng = mulberry32(SEED + 3);
for (let tries = 0; tries < 2500; tries++) {
  const [x, y] = [50 + orng() * 69, 1 + orng() * 36];
  const especie = orng() < 0.3 ? 'jeriva' : mixed(orng());
  plant(round(x), round(y), especie, treeDims(especie, orng), TRUNK_GAP + 4.5);
}
const irng = mulberry32(SEED + 4);
for (let i = 0, n = 0; i < 400 && n < 6; i++) {
  const [x, y] = [86 + irng() * 12, 68 + irng() * 8];
  if (!inside(x, y, ISLAND) || dist(x, y, 92, 72) < 1.6) continue;
  const especie = irng() < 0.5 ? 'jeriva' : 'mata';
  const d = treeDims(especie, irng);
  if (trunks.some((t) => dist(x, y, t.x, t.y) < 2.6)) continue;
  trunks.push({ x, y, r: d.tronco / 2 });
  cenario.push(point('arvore', round(x), round(y), { especie, ...d }));
  n++;
}
cenario.push(point('veu', 92, 72, { raio: 1.6 }, 'Véu da Ilha'));
cenario.push(point('pedra', 92.6, 71.4, { raio: 0.9, ancestral: true }, 'Pedra da Ilha'));
// o chão da mata (não bloqueia): samambaias e, no brejo, taboas
const prng = mulberry32(SEED + 7);
for (let i = 0, n = 0; i < 3000 && n < 90; i++) {
  const [x, y, raio] = [1 + prng() * 118, 1 + prng() * 98, round(0.5 + prng() * 0.4)];
  if (inside(x, y, WATER) || roadGap(x, y) < raio + 0.3 || pathGap(x, y) < raio + 0.3) continue;
  if (trunks.some((t) => dist(x, y, t.x, t.y) < t.r + raio * 0.6)) continue;
  cenario.push(point('planta', x, y, { tipo: inside(x, y, blob(20, 87, 17, 10, 0.12)) ? 'taboa' : 'samambaia', raio }));
  n++;
}

// ---------------- a vista: nada alto tampa o caminho, o deque, a fogueira, os balcões ----------------
/** Pontos da vila que precisam aparecer (o corpo de quem está lá): a fogueira, a Dona Iracema, o Barqueiro, o píer. */
const VILLAGE_KEYS: Pt[] = [[FIRE.x, FIRE.y], [IRACEMA.x, IRACEMA.y], [BARQUEIRO.x, BARQUEIRO.y], [44, 56], [49, 56]];
for (const o of cenario.filter((c) => c.type === 'casa')) {
  const hidden = VILLAGE_KEYS.find(([kx, ky]) => boxCovers(rectOf(o), HOUSE_H + ROOF_H, kx, ky));
  if (hidden) throw new Error(`${o.name} tampa o ponto (${hidden.join(', ')}) do Refúgio.`);
}

// ---------------- colisão (tirada do cenário) ----------------
for (const s of cenario) {
  const p = s.props ?? {};
  const r = rectOf(s);
  if (s.type === 'arvore') colisao.push(block('tronco', s.x, s.y, Number(p.tronco)));
  else if (s.type === 'poste') colisao.push(block('poste', s.x, s.y, 0.3, { altura: Number(p.altura) }));
  else if (s.type === 'pedra') colisao.push(block('pedra', s.x, s.y, round(Number(p.raio) * 1.5)));
  else if (s.type === 'arbusto' && p.fechado) colisao.push(block('mata-fechada', s.x, s.y, round(Number(p.raio) * 1.8)));
  else if (s.type === 'tronco-caido') colisao.push(box('tronco-caido', r, { altura: Number(p.altura) }));
  else if (s.type === 'casa') colisao.push(box('casa', r, { altura: HOUSE_H }));
  else if (s.type === 'ponto-onibus') colisao.push(box('ponto-onibus', r, { altura: Number(p.altura) }));
  else if (s.type === 'banco') colisao.push(box('banco', r, { bloqueiaTiro: false, altura: 0.5 }));
  else if (s.type === 'fogueira') colisao.push(block('fogueira', s.x, s.y, 1.2, { bloqueiaTiro: false, altura: 0.4 }));
  else if (s.type === 'poste-praca') colisao.push(block('poste-praca', s.x, s.y, 0.25, { altura: Number(p.altura) }));
  else if (s.type === 'placa' && p.poste) colisao.push(block('placa', s.x, s.y, 0.2, { bloqueiaTiro: false, altura: 2.2 }));
  else if (s.type === 'barril' || s.type === 'caixote') colisao.push(box(s.type, r, { bloqueiaTiro: false, altura: Number(p.altura) }));
}
// a água: faixas que o pé não atravessa (o deque e o píer ficam de fora)
colisao.push(...waterStrips(isWater, 0, W, 0, H));
// nenhum vão de entalar onde se anda: a beira da estrada aberta, o caminho, a margem e o Refúgio (com a água em volta)
{
  const playable = (s: Shape) => {
    const r = rectOf(s);
    const [cx, cy] = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
    const reach = Math.max(r.x1 - r.x0, r.y1 - r.y0) / 2 + MIN_GAP + 0.5;
    return (
      distToPath(cx, cy, ROAD_OPEN) < ROAD_HALF + reach ||
      pathGap(cx, cy) < reach ||
      DECKS.some(([d]) => rectGap(cx, cy, d) < reach) ||
      (cx > 36 && cx < 50 && cy > 25 && cy < 60 && !inside(cx, cy, WATER))
    );
  };
  checkWedges(
    colisao.filter(playable),
    MIN_GAP,
    (a, b) => (a.type === 'mata-fechada' || a.type === 'agua') && (b.type === 'mata-fechada' || b.type === 'agua'),
  );
}

// ---------------- zonas, áreas, pontos e saídas ----------------
seguro.push(rect('seguro', 13, 27, 0, 10, undefined, 'Chegada'));
seguro.push(rect('seguro', 39, 74, 43, 68, undefined, 'O Refúgio'));
// as áreas com nome (a faixa no alto da tela) e o clima de cada uma (`escuro` e `neblina`, de 0 a 1; vale a menor)
areas.push(rect('area', 39, 74, 43, 68, { escuro: 0, neblina: 0.05 }, 'O Refúgio'));
areas.push(rect('area', 30, 47, 26, 62, { escuro: 0.1, neblina: 0.15 }, 'Margem da Represa'));
areas.push(rect('area', 6, 50, 0, 30, { escuro: 0.1, neblina: 0.05 }, "Estrada do M'Boi Mirim"));
areas.push(rect('area', 0, 36, 18, 78, { escuro: 0.3, neblina: 0.12 }, 'Parque Ecológico do Guarapiranga'));
areas.push(rect('area', 40, W, 30, H, { escuro: 0.1, neblina: 0.3 }, 'Represa de Guarapiranga'));
pontos.push(point('ponto', 54.6, 58.8, undefined, 'spawn')); // quem desmaia aqui acorda no Refúgio, perto da fogueira
pontos.push(point('ponto', ARRIVAL.x, ARRIVAL.y, undefined, 'chegada-capao'));
saidas.push(box('saida', EXIT_NORTH, { mapa: 'capao', chegada: 'chegada-guarapiranga' }, 'Capão Redondo'));

// ---------------- escreve o .tmj ----------------
writeTmj(
  OUT,
  W,
  H,
  [
    ['chao', chao],
    ['cenario', cenario],
    ['colisao', colisao],
    ['seguro', seguro],
    ['areas', areas],
    ['pontos', pontos],
    ['saidas', saidas],
  ],
  { nome: 'Guarapiranga', seguro: false },
);
const count = (type: string) => cenario.filter((s) => s.type === type).length;
console.log(`Mapa gerado em ${OUT}: ${W}x${H} m, etapa ${STAGE}, ${count('arvore')} árvores, ${count('casa')} casas, ${colisao.length} retângulos de colisão.`);
