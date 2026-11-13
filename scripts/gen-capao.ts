// Gera o Mapa 01 do mundo novo (2.5D isométrico) em public/assets/maps-iso/capao.tmj:
// o Parque Santo Dias e a Vila do Capão (Capão Redondo, zona sul de São Paulo).
//
// Formato combinado com a [estrutura] (roteiro, "🗺️ Mundo novo"): Tiled ortogonal, 1 tile = 1 metro (tile de 32 px,
// só como grade); tudo em camadas de objetos, sem tiles:
// - "chao": as áreas do chão, de baixo para cima (mata, grama, terra, calçada, asfalto, faixa de pedestre, praça,
//   trilha, o círculo ancestral);
// - "cenario": as coisas com altura (árvores, gradil, portão, pilares, arbustos, pedras, postes e fiação, o brilho do
//   Véu e, na vila, as casas, a Budega, bancos, mesas, fogueira, orelhão, lixeira e o carro largado);
// - "colisao": retângulos onde o pé bate, tirados do cenário por este gerador (desenho e colisão nunca desencontram);
//   `bloqueiaTiro` false onde a pedrinha passa (gradil e portão de grade);
// - "seguro": retângulos de zona segura (monstro não entra, não nota e não acerta quem está dentro);
// - "areas": retângulos com nome, para a faixa com o nome do lugar;
// - "pontos": o nascimento ("spawn") e, depois, as chegadas.
// O servidor lê os mapas desta pasta (maps-iso) e manda para eles quem entra pelo jogo novo (/?novo).
//
// Escopo aprovado pelo dono, uma etapa por vez: 3) só a Clareira dos Despertos (um anel de arbustos a cercava);
// 4a) a mata do parque abre: trilha em volta do lago, o lago, a mata profunda (noroeste e sudoeste), os saguis
// encantados e as jararacas; 4b) o Portão I abre para a Vila do Capão; 4c) campinho, viaduto e saídas. As medidas vêm
// da planta aprovada (12/11). A mudança de uma etapa para a outra é a constante STAGE.
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
/** Etapa do escopo aprovado: '3' só a clareira; '4a' a mata e o lago; '4b' o portão e a vila; '4c' o resto. */
const STAGES = ['3', '4a', '4b', '4c'] as const;
const STAGE: (typeof STAGES)[number] = '4b';
const reached = (stage: (typeof STAGES)[number]) => STAGES.indexOf(STAGE) >= STAGES.indexOf(stage);
/**
 * As criaturas da mata (saguis encantados e jararacas). Ficaram desligadas até o jogo novo ter combate (escolha do dono
 * em 12/11: sem ele, o jogador apanhava sem ver o golpe); o combate, passo 1, chegou em 13/11 e elas voltaram.
 */
const CREATURES = true;
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
/** A trilha que dá a volta no lago (até a etapa 3, fechada pelo anel de arbustos). */
const TRAIL_LOOP: [number, number][] = [
  [37, 43], [31, 32], [27, 14], [16, 9], [6, 16], [5, 34], [12, 46], [22, 58], [31, 52], [37, 43],
];
/** Lugar do lago, sem árvores (a água em si é um pouco menor: sobra a beira). */
const LAKE = { x: 16, y: 23, rx: 10.5, ry: 8.5 };
/** A água do lago (raios) e a beira de lama em volta. */
const WATER = { rx: 8.4, ry: 6.4 };
/** Mata profunda (neblina, alto risco): noroeste e sudoeste do parque. */
const DEEP = [
  { x: 11, y: 9, rx: 12, ry: 9 },
  { x: 12, y: 66, rx: 12, ry: 13 },
];
/** Pedra ancestral na mata profunda (com o brilho do Véu). */
const ANCESTRAL = { x: 7.5, y: 9.5, raio: 1.2 };
/** Anel de mata fechada que cercava a clareira na etapa 3. */
const RING = { inner: 12.6, outer: 14.4 };
/** Distância mínima entre troncos (borda a borda), para o pé de 0,6 × 0,4 passar. */
const TRUNK_GAP = 1.2;

// ---------------- a Vila do Capão (etapa 4b) ----------------
/** A rua que sai do portão para o leste e a rua para o sul (a saída para Guarapiranga só abre na etapa 4c). */
const STREET = { x0: 56, x1: W, y0: 41, y1: 47 };
const ROAD_S = { x0: 88, x1: 94, y0: 47, y1: H };
/** A praça (pedra portuguesa) e a Budega, a vendinha da praça (o negócio do dono; nada de tabaco). */
const SQUARE = { x0: 61, x1: 79, y0: 48.5, y1: 59 };
const BUDEGA = { x0: 62, x1: 67, y0: 49.5, y1: 52.5 };
/** Onde fica quem atende na Budega: no balcão, do lado da praça (o NPC é da [estrutura], em data/npcs.json). */
const BUDEGA_COUNTER = { x: 64.5, y: 53.3 };
/** A fogueira da praça, com bancos em volta (a oeste da árvore, para a copa não cobrir o fogo). */
const FIRE = { x: 69.5, y: 56 };
interface House {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  altura: number;
  andares: number;
  cor: string;
  extra?: Props;
}
/**
 * Casas de bloco com laje e caixa d'água, de cores vivas. A frente (porta e janelas) é o lado sul, o que a câmera vê.
 * As do lado norte da rua são coladas umas nas outras, com uma viela de 2 m (x 79 a 81) para o terreno dos fundos.
 */
const HOUSES: House[] = [
  { x0: 58, x1: 64, y0: 31, y1: 39.5, altura: 5.8, andares: 2, cor: '#c9774a' },
  { x0: 64, x1: 71, y0: 33, y1: 39.5, altura: 3.2, andares: 1, cor: '#e2a3b8', extra: { pixo: true } },
  { x0: 71, x1: 79, y0: 30, y1: 39.5, altura: 6.2, andares: 2, cor: '#79a9d1' },
  { x0: 81, x1: 86, y0: 32, y1: 39.5, altura: 3.4, andares: 1, cor: '#e8c75a' },
  { x0: 86, x1: 94.4, y0: 29, y1: 39.5, altura: 6.4, andares: 2, cor: '#b9673f', extra: { bloco: true } },
  // ao sul da rua, do lado da praça (baixa, para não tampar a rua)
  { x0: 81, x1: 87, y0: 49, y1: 58, altura: 3.3, andares: 1, cor: '#8fc08a' },
  // sozinha no terreno dos fundos, tomada pelo mato
  { x0: 62, x1: 67, y0: 13, y1: 20, altura: 3.2, andares: 1, cor: '#c27a4e', extra: { abandonada: true, caixaDagua: false } },
];
/** Postes de concreto com luz quente, ligados pela fiação (o primeiro é o do portão, que já existia). */
const POSTS: [number, number][] = [[50.5, 40], [60, 47.8], [70, 47.8], [80, 47.8], [87.6, 47.6], [87.6, 63], [87.6, 76]];
/**
 * Entre duas coisas sólidas da vila o vão é zero (encostadas) ou de pelo menos este tanto: num vão menor que isso o
 * pé de 0,6 m entra de lado e entala (aconteceu entre um orelhão e um poste, num vão de 40 cm).
 */
const MIN_GAP = 1.2;
/** Mato tomando conta da vila (bem selvagem), longe das ruas: centro e raios. */
const VILLAGE_GRASS: [number, number, number, number][] = [[64.5, 19, 5.5, 4], [76, 12, 9, 4], [90, 21, 4.5, 5], [60, 61.5, 2.4, 3], [70, 79.5, 12, 2.5]];
/** Árvores no terreno dos fundos (a mata voltando para a vila). */
const VILLAGE_TREES: [number, number, string][] = [[59, 11, 'mata'], [69.5, 24.5, 'ipe-amarelo'], [84, 21, 'mata'], [91.5, 11, 'mata'], [77, 10.5, 'mata']];

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
  polygon?: [number, number][];
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
/** Contorno irregular (sem sorteio: o mesmo sempre) em volta de (cx, cy). */
function blob(cx: number, cy: number, rx: number, ry: number, wobble: number, n = 32): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wobble * (0.6 * Math.sin(a * 3 + 1.3) + 0.4 * Math.cos(a * 5 + 0.4));
    return [round(cx + Math.cos(a) * rx * k), round(cy + Math.sin(a) * ry * k)];
  });
}
/** O ponto está dentro do polígono? */
function inside(x: number, y: number, pts: [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const inEllipse = (x: number, y: number, e: { x: number; y: number; rx: number; ry: number }) => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 < 1;
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
const WATER_PTS = blob(LAKE.x, LAKE.y, WATER.rx, WATER.ry, 0.1);
if (reached('4a')) {
  for (const d of DEEP) chao.push({ type: 'mata-profunda', x: 0, y: 0, polygon: blob(d.x, d.y, d.rx, d.ry, 0.12) });
  chao.push({ type: 'lama', x: 0, y: 0, polygon: blob(LAKE.x, LAKE.y, WATER.rx + 1.1, WATER.ry + 1, 0.1) });
  chao.push({ type: 'agua', x: 0, y: 0, polygon: WATER_PTS, props: { cor: '#2f6f6a' } });
}
chao.push(ellipse('grama', C.x, C.y, CLEARING_R));
chao.push({ type: 'trilha', x: 0, y: 0, polyline: TRAIL_LOOP, props: { largura: 2.2 } });
chao.push({ type: 'trilha', x: 0, y: 0, polyline: TRAIL_MAIN, props: { largura: 3 } });
chao.push(ellipse('circulo', C.x, C.y, CIRCLE_R, { brilho: '#3fd6c8' }));
if (reached('4b')) {
  // a vila: mato tomando conta, calçadas estreitas de periferia, as ruas e a praça de pedra portuguesa
  for (const [cx, cy, rx, ry] of VILLAGE_GRASS) chao.push({ type: 'grama', x: 0, y: 0, polygon: blob(cx, cy, rx, ry, 0.18) });
  chao.push(rect('calcada', 48.2, 49.5, 0, H)); // a do parque, junto do gradil
  chao.push(rect('calcada', 56, 57.5, 0, STREET.y0)); // Travessa, lado leste, ao norte da rua
  chao.push(rect('calcada', 56, 57.5, STREET.y1, H)); // Travessa, lado leste, ao sul da rua
  chao.push(rect('calcada', 57.5, W, 39.5, STREET.y0)); // a das casas
  chao.push(rect('calcada', 57.5, ROAD_S.x0, STREET.y1, SQUARE.y0)); // a da praça
  chao.push(rect('calcada', ROAD_S.x0 - 1, ROAD_S.x0, SQUARE.y0, H)); // rua de baixo, lado oeste
  chao.push(rect('calcada', ROAD_S.x1, W, STREET.y1, H)); // rua de baixo, lado leste
  chao.push(rect('asfalto', STREET.x0, STREET.x1, STREET.y0, STREET.y1));
  chao.push(rect('asfalto', ROAD_S.x0, ROAD_S.x1, ROAD_S.y0, ROAD_S.y1));
  // faixa de pedestre do portão para a vila, atravessando a Travessa (listras compridas no sentido da rua, y)
  chao.push(rect('faixa', 49.5, 56, 42.5, 45.5, { listras: 'y' }));
  chao.push(rect('praca', SQUARE.x0, SQUARE.x1, SQUARE.y0, SQUARE.y1, { desenho: 'ondas' }));
}

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
// a partir da etapa 4a, o lago também aparece inteiro (uma "janela" na mata, olhando de onde a câmera olha)
if (reached('4a')) {
  for (let x = LAKE.x - WATER.rx; x <= LAKE.x + WATER.rx; x += 1.5) {
    for (let y = LAKE.y - WATER.ry; y <= LAKE.y + WATER.ry; y += 1.5) if (inside(x, y, WATER_PTS)) VIEW_KEYS.push([x, y]);
  }
}
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
/** As árvores da mata (entram no cenário depois de abrir lugar para as coisas da etapa 4a). */
const forest: Shape[] = [];
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
  forest.push(point('arvore', round(x), round(y), { especie, copa, altura, tronco }));
}

// o gradil do parque (ferro velho com cipó) e o Portão I, que abre na etapa 4b
cenario.push(rect('gradil', PARK_X - 0.1, PARK_X + 0.1, 0, GATE.y0 - 0.3, { altura: 1.8, estado: 'inteiro' }));
cenario.push(rect('gradil', PARK_X - 0.1, PARK_X + 0.1, GATE.y1 + 0.3, H, { altura: 1.8, estado: 'inteiro' }));
cenario.push(rect('portao', PARK_X - 0.1, PARK_X + 0.1, GATE.y0 + 0.3, GATE.y1 - 0.3, { aberto: reached('4b') }, 'Portão I'));
for (const y of [GATE.y0, GATE.y1]) cenario.push(rect('pilar', PARK_X - 0.3, PARK_X + 0.3, y - 0.3, y + 0.3, { altura: 2.6 }));
// poste com luz quente do lado de fora do portão (aparece entre as grades)
cenario.push(point('poste', POSTS[0]![0], POSTS[0]![1], { altura: reached('4b') ? 7 : 4.2, luz: '#ffd36b' }));

// pedras na beira da clareira, em grupos (uma grande e duas pequenas), para lerem como pedras
const STONES: [number, number, number][] = reached('4a')
  ? [[30.6, 39.6, 0.85], [31.75, 38.85, 0.42], [29.75, 40.75, 0.4], [44.4, 49, 0.8], [45.45, 48.25, 0.4]]
  : [[30.2, 47.5, 0.55], [43.4, 38.6, 0.45], [31, 39.5, 0.4], [44.2, 49.2, 0.6]];
for (const [x, y, raio] of STONES) cenario.push(point('pedra', x, y, { raio }));

// mata fechada em volta da área andável (só até a etapa 3): arbustos colados, sem vão para o pé passar.
// O lado leste fica fechado pelo gradil e pelo portão.
if (!reached('4a')) {
  cenario.push(...forest);
  const r = (RING.inner + RING.outer) / 2;
  const steps = Math.ceil((2 * Math.PI * r) / 1.1);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = C.x + Math.cos(a) * r;
    const y = C.y + Math.sin(a) * r;
    if (x > PARK_X - 0.8) continue;
    cenario.push(point('arbusto', round(x), round(y), { raio: round(0.95 + rng() * 0.3), fechado: true }));
  }
} else {
  // ----- etapa 4a: a mata do parque abre -----
  /** Coisas novas e o espaço que cada uma precisa (centro, raio): árvore em cima delas sai. */
  const reserved: { x: number; y: number; r: number }[] = [];
  const free = (x: number, y: number, r: number) =>
    !reserved.some((q) => dist(x, y, q.x, q.y) < q.r + r) && distToPath(x, y, TRAIL_LOOP) >= 1.1 + r + 0.4 && distToPath(x, y, TRAIL_MAIN) >= 1.5 + r + 0.4;
  // pedra ancestral na mata profunda do noroeste, com o brilho do Véu
  reserved.push({ x: ANCESTRAL.x, y: ANCESTRAL.y, r: ANCESTRAL.raio + 1.4 });
  cenario.push(point('pedra', ANCESTRAL.x, ANCESTRAL.y, { raio: ANCESTRAL.raio, ancestral: true }, 'Pedra do Véu'));
  cenario.push(point('veu', ANCESTRAL.x, ANCESTRAL.y, { raio: 1.4 }));
  // troncos caídos na mata profunda (longe das trilhas)
  for (const [x, y, w, h] of [[14.5, 5.2, 3.6, 0.6], [19.5, 64.5, 0.6, 3.4], [6.2, 71, 3.4, 0.6]] as const) {
    reserved.push({ x, y, r: Math.max(w, h) / 2 + 1.3 });
    cenario.push(rect('tronco-caido', round(x - w / 2), round(x + w / 2), round(y - h / 2), round(y + h / 2), { altura: 0.6 }));
  }
  // capivaras descansando na beira do lago (enfeite: não bloqueiam e não atacam)
  for (const a of [0.15, 0.45, 2.55]) {
    const x = round(LAKE.x + Math.cos(a) * (WATER.rx + 1.4));
    const y = round(LAKE.y + Math.sin(a) * (WATER.ry + 1.3));
    reserved.push({ x, y, r: 1.2 });
    cenario.push(point('capivara', x, y, { olhando: round((a * 180) / Math.PI + 180) }));
  }
  // o Véu Ancestral na beira do lago
  reserved.push({ x: 22.6, y: 29.2, r: 1.2 });
  cenario.push(point('veu', 22.6, 29.2, { raio: 1.2 }));
  // as árvores que sobram
  const keep = (s: Shape) => {
    const r = Number(s.props?.tronco ?? 0.5) / 2;
    return !reserved.some((q) => dist(s.x, s.y, q.x, q.y) < q.r + r);
  };
  const kept = forest.filter(keep);
  trees.splice(1, trees.length - 1, ...kept.map((s) => ({ x: s.x, y: s.y, tronco: Number(s.props!.tronco) })));
  cenario.push(...kept);
  // aguapés na água (a água já bloqueia: só enfeite)
  for (let i = 0; i < 70 && cenario.filter((o) => o.type === 'aguape').length < 14; i++) {
    const a = rng() * Math.PI * 2;
    const k = 0.62 + rng() * 0.3;
    const [x, y] = [round(LAKE.x + Math.cos(a) * WATER.rx * k), round(LAKE.y + Math.sin(a) * WATER.ry * k)];
    if (inside(x, y, WATER_PTS)) cenario.push(point('aguape', x, y, { raio: round(0.5 + rng() * 0.5) }));
  }
  /** Um arbusto cabe aqui sem fechar caminho? (1,2 m livre até troncos e outros arbustos, longe das trilhas.) */
  const bushes: { x: number; y: number; r: number }[] = [];
  const bushFits = (x: number, y: number, r: number) =>
    free(x, y, r + 0.8) &&
    dist(x, y, C.x, C.y) > CLEARING_R + 1.5 &&
    !inEllipse(x, y, LAKE) &&
    trees.every((t) => dist(x, y, t.x, t.y) - t.tronco / 2 - r * 0.9 >= TRUNK_GAP) &&
    bushes.every((b) => dist(x, y, b.x, b.y) - (b.r + r) * 0.9 >= TRUNK_GAP);
  // mata profunda: mais fechada (arbustos que bloqueiam, sempre deixando passagem)
  for (const d of DEEP) {
    for (let i = 0, n = 0; i < 900 && n < 26; i++) {
      const x = d.x + (rng() * 2 - 1) * d.rx;
      const y = d.y + (rng() * 2 - 1) * d.ry;
      const r = round(0.7 + rng() * 0.45);
      if (!inEllipse(x, y, d) || x < 2 || y < 2 || y > H - 2 || !bushFits(x, y, r)) continue;
      bushes.push({ x, y, r });
      cenario.push(point('arbusto', round(x), round(y), { raio: r, fechado: true }));
      n++;
    }
  }
  // a beira do mapa: mata fechada nas pontas do parque (oeste, norte e sul)
  const edge: [number, number][] = [];
  for (let y = 0.6; y < H; y += 1.1) edge.push([0.6, y]);
  for (let x = 1.7; x < PARK_X - 0.6; x += 1.1) edge.push([x, 0.6], [x, H - 0.6]);
  for (const [x, y] of edge) cenario.push(point('arbusto', round(x), round(y), { raio: round(0.9 + rng() * 0.25), fechado: true }));
}

// ---------------- etapa 4b: o Portão I abre para a Vila do Capão ----------------
/**
 * Pontos da vila que a câmera precisa ver (x, y, altura): o portão, a Travessa, a rua, o balcão e o letreiro da Budega
 * e a fogueira da praça.
 * Uma copa alta "sobe" na tela e cobre o que está uns 8 m atrás dela (ao norte e a oeste): por isso a árvore da praça
 * fica no canto sudeste da praça, com a fogueira a oeste dela.
 */
const VILLAGE_KEYS: [number, number, number][] = [];
/** A copa desta árvore da vila tampa algum desses pontos? (só tampa o que está atrás dela) */
function canopyHides(x: number, y: number, copa: number, altura: number): boolean {
  const [cx, cy] = screen(x, y, altura);
  return VILLAGE_KEYS.some(([kx, ky, kz]) => {
    if (kx + ky >= x + y) return false;
    const [sx, sy] = screen(kx, ky, kz);
    return Math.hypot(sx - cx, sy - cy) < copa * 1.05;
  });
}
/** Contorno convexo (na tela) de um monte de pontos. */
function hull(pts: (readonly [number, number])[]): [number, number][] {
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
  return [...half(p), ...half([...p].reverse())].map(([x, y]) => [x, y]);
}
/** Que ponto da vila esta caixa (casa, carro) tampa? Vale o meio do corpo de quem está atrás dela (ao norte ou a oeste). */
function boxHides(b: { x0: number; x1: number; y0: number; y1: number }, altura: number): [number, number, number] | undefined {
  const outline = hull(([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]] as const).flatMap(([x, y]) => [screen(x, y, 0), screen(x, y, altura)]));
  return VILLAGE_KEYS.find(([kx, ky, kz]) => kz === 0 && (kx < b.x0 || ky < b.y0) && inside(...screen(kx, ky, 0.9), outline));
}
if (reached('4b')) {
  const vrng = mulberry32(SEED + 4); // sorteio só da vila: a mata do parque continua igual
  for (let y = GATE.y0 + 0.5; y <= GATE.y1 - 0.5; y += 1) VILLAGE_KEYS.push([PARK_X, y, 0]);
  for (let y = 38; y <= 50; y += 1) VILLAGE_KEYS.push([52.75, y, 0]);
  for (let x = STREET.x0; x <= W - 2; x += 1) VILLAGE_KEYS.push([x, 44, 0]);
  VILLAGE_KEYS.push([BUDEGA_COUNTER.x, BUDEGA_COUNTER.y, 0], [FIRE.x, FIRE.y, 0]);
  for (let x = BUDEGA.x0 + 0.5; x <= BUDEGA.x1 - 0.5; x += 1) VILLAGE_KEYS.push([x, BUDEGA.y1 + 0.05, 2.2]); // o letreiro

  // as casas e a Budega (uma casa com comércio: letreiro e toldo na frente, que dá para a praça)
  for (const h of HOUSES) cenario.push(rect('casa', h.x0, h.x1, h.y0, h.y1, { altura: h.altura, andares: h.andares, cor: h.cor, caixaDagua: true, ...h.extra }));
  cenario.push(rect('casa', BUDEGA.x0, BUDEGA.x1, BUDEGA.y0, BUDEGA.y1, { altura: 2.6, andares: 1, cor: '#d4553a', caixaDagua: true, comercio: 'vendinha', letreiro: 'BUDEGA DISTRIBUIDORA', toldo: '#f1c84a' }, 'Budega'));

  // a praça: fogueira com bancos em volta (virados para o fogo), mesas ao lado da Budega (sem fechar o caminho até o
  // balcão) e luz quente; o orelhão e a lixeira ficam encostados nas paredes da Budega (sem vão para o pé entalar)
  cenario.push(point('fogueira', FIRE.x, FIRE.y, { raio: 0.6, luz: '#ffb347' }));
  // bancos de 1,6 m a 2,6 m do fogo: as quatro entradas da roda ficam com mais de 1,5 m
  const benches: [number, number, number, number, number][] = [
    [FIRE.x - 0.8, FIRE.x + 0.8, FIRE.y - 2.85, FIRE.y - 2.35, 90],
    [FIRE.x - 0.8, FIRE.x + 0.8, FIRE.y + 2.35, FIRE.y + 2.85, 270],
    [FIRE.x - 2.85, FIRE.x - 2.35, FIRE.y - 0.8, FIRE.y + 0.8, 0],
    [FIRE.x + 2.35, FIRE.x + 2.85, FIRE.y - 0.8, FIRE.y + 0.8, 180],
  ];
  for (const [x0, x1, y0, y1, olhando] of benches) cenario.push(rect('banco', round(x0), round(x1), round(y0), round(y1), { olhando }));
  const furniture: { x: number; y: number; r: number }[] = [{ x: FIRE.x, y: FIRE.y, r: 3.1 }];
  for (const [x, y] of [[62.6, 55.4], [63.8, 57.8]] as const) {
    cenario.push(point('mesa', x, y, { cadeiras: 2 }));
    furniture.push({ x, y, r: 0.9 });
  }
  for (const [x, y] of [[78.3, 49.3], [61.7, 58.3]] as const) {
    cenario.push(point('poste-praca', x, y, { altura: 3.2, luz: '#ffd36b' }));
    furniture.push({ x, y, r: 0.3 });
  }
  // (nos cantos da frente da Budega, que a câmera vê: a parede oeste fica de costas para ela; o orelhão fica fora do toldo)
  cenario.push(point('orelhao', BUDEGA.x0 - 0.25, BUDEGA.y1 + 0.25, { olhando: 90 }));
  cenario.push(point('lixeira', BUDEGA.x1 - 0.25, BUDEGA.y1 + 0.25));
  furniture.push({ x: BUDEGA_COUNTER.x, y: BUDEGA_COUNTER.y, r: 1.5 });
  // a árvore da praça: o lugar mais perto do da planta (70, 54) que não tampa a rua, o balcão, o letreiro nem a fogueira
  const SQ_TREE = { especie: 'sibipiruna', copa: 3.6, altura: 6.5, tronco: 0.7 };
  let spot: { x: number; y: number } | undefined;
  for (let x = SQUARE.x0 + 1; x <= SQUARE.x1 - 1; x += 0.5) {
    for (let y = SQUARE.y0 + 1; y <= SQUARE.y1 - 1; y += 0.5) {
      if (x < BUDEGA.x1 + 1.5 && y < BUDEGA.y1 + 1.5) continue;
      if (furniture.some((f) => dist(x, y, f.x, f.y) < f.r + SQ_TREE.tronco / 2 + 1.5)) continue;
      if (canopyHides(x, y, SQ_TREE.copa, SQ_TREE.altura)) continue;
      if (!spot || dist(x, y, 70, 54) < dist(spot.x, spot.y, 70, 54)) spot = { x, y };
    }
  }
  if (!spot) throw new Error('Não achei lugar para a árvore da praça que não tampe a rua, o balcão, o letreiro ou a fogueira.');
  trees.push({ x: spot.x, y: spot.y, tronco: SQ_TREE.tronco });
  cenario.push(point('arvore', spot.x, spot.y, SQ_TREE, 'Árvore da Praça'));

  // postes da rua (o do portão já existe) e a fiação passando de um para o outro
  for (const [x, y] of POSTS.slice(1)) cenario.push(point('poste', x, y, { altura: 7, luz: '#ffd36b' }));
  cenario.push({ type: 'fiacao', x: 0, y: 0, polyline: POSTS, props: { altura: 6.6 } });
  // carro largado na Travessa, com mato por cima (dá para passar dos dois lados)
  cenario.push(rect('carro', 50.5, 54.5, 22, 24.2, { altura: 1.4, cor: '#a8473e', mato: true }));
  // a mata voltando: árvores no terreno dos fundos
  for (const [x, y, especie] of VILLAGE_TREES) {
    const ipe = especie !== 'mata';
    trees.push({ x, y, tronco: ipe ? 0.45 : 0.5 });
    cenario.push(point('arvore', x, y, { especie, copa: ipe ? 2.3 : 2.4, altura: 6, tronco: ipe ? 0.45 : 0.5 }));
  }
  // a beira da vila: mata fechada (a ponta da Travessa, a rua do leste e a rua de baixo terminam no mato; a saída
  // para Guarapiranga abre na etapa 4c)
  const villageEdge: [number, number][] = [];
  for (let x = PARK_X + 0.6; x < W - 1; x += 1.1) villageEdge.push([x, 0.6], [x, H - 0.6]);
  for (let y = 0.6; y < H; y += 1.1) villageEdge.push([W - 0.6, y]);
  for (const [x, y] of villageEdge) cenario.push(point('arbusto', round(x), round(y), { raio: round(0.9 + vrng() * 0.25), fechado: true }));

  // nada alto ao sul da rua pode tampar o portão, a rua ou o balcão
  for (const o of cenario.filter((c) => c.type === 'casa' || c.type === 'carro')) {
    const hidden = boxHides({ x0: o.x, x1: o.x + o.w!, y0: o.y, y1: o.y + o.h! }, Number(o.props!.altura));
    if (hidden) throw new Error(`${o.name || o.type} em (${o.x}, ${o.y}) tampa o ponto (${hidden.join(', ')}) da vila.`);
  }
}

// ---------------- colisão (tirada do cenário) ----------------
for (const s of cenario) {
  const p = s.props ?? {};
  if (s.type === 'arvore') colisao.push(block('tronco', s.x, s.y, Number(p.tronco)));
  else if (s.type === 'poste') colisao.push(block('poste', s.x, s.y, 0.3));
  else if (s.type === 'pedra') colisao.push(block('pedra', s.x, s.y, round(Number(p.raio) * 1.5)));
  else if (s.type === 'arbusto' && p.fechado) colisao.push(block('mata-fechada', s.x, s.y, round(Number(p.raio) * 1.8)));
  else if (s.type === 'gradil' || (s.type === 'portao' && !p.aberto)) colisao.push({ ...rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!), props: { bloqueiaTiro: false } });
  else if (s.type === 'pilar' || s.type === 'tronco-caido') colisao.push(rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!));
  // a vila: casa e carro seguram a pedrinha; o que é baixo ou fino (banco, mesa, fogueira, lixeira, orelhão) deixa passar.
  // A altura vai junto, para o desenho provisório levantar a caixa certa.
  else if (s.type === 'casa' || s.type === 'carro') colisao.push(rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!, { altura: Number(p.altura) }));
  else if (s.type === 'banco') colisao.push(rect('banco', s.x, s.x + s.w!, s.y, s.y + s.h!, { bloqueiaTiro: false, altura: 0.5 }));
  else if (s.type === 'mesa') colisao.push(block('mesa', s.x, s.y, 0.8, { bloqueiaTiro: false, altura: 0.75 }));
  else if (s.type === 'fogueira') colisao.push(block('fogueira', s.x, s.y, 1.2, { bloqueiaTiro: false, altura: 0.4 }));
  else if (s.type === 'lixeira') colisao.push(block('lixeira', s.x, s.y, 0.5, { bloqueiaTiro: false, altura: 0.9 }));
  else if (s.type === 'orelhao') colisao.push(block('orelhao', s.x, s.y, 0.5, { bloqueiaTiro: false, altura: 2.2 }));
  else if (s.type === 'poste-praca') colisao.push(block('poste-praca', s.x, s.y, 0.25, { altura: 3.2 }));
}
// na vila, nenhum vão estreito entre duas coisas sólidas de frente uma para a outra: abaixo de 0,3 m o pé nem entra; de
// 0,3 a MIN_GAP ele entra de lado e entala. (Na diagonal, canto com canto, sempre há por onde sair.)
if (reached('4b')) {
  const village = colisao.filter((c) => c.x + c.w! > PARK_X + 0.5);
  for (let i = 0; i < village.length; i++) {
    for (let j = i + 1; j < village.length; j++) {
      const [a, b] = [village[i]!, village[j]!];
      const [dx, dy] = [Math.max(0, b.x - (a.x + a.w!), a.x - (b.x + b.w!)), Math.max(0, b.y - (a.y + a.h!), a.y - (b.y + b.h!))];
      if ((dx > 0 && dy > 0) || (a.type === 'mata-fechada' && b.type === 'mata-fechada')) continue; // canto com canto; a mata é parede
      const gap = dx + dy;
      if (gap > 0.3 && gap < MIN_GAP) throw new Error(`Vão de ${gap.toFixed(2)} m entre ${a.type} (${a.x}, ${a.y}) e ${b.type} (${b.x}, ${b.y}): o pé entala.`);
    }
  }
}
// a água do lago vira faixas de 0,5 m de altura (o pé não entra, a pedrinha passa por cima)
if (reached('4a')) {
  const STEP = 0.5;
  const ys = WATER_PTS.map(([, y]) => y);
  for (let y = Math.floor(Math.min(...ys) / STEP) * STEP; y < Math.max(...ys); y += STEP) {
    const row = y + STEP / 2;
    let start: number | null = null;
    for (let x = LAKE.x - LAKE.rx; x <= LAKE.x + LAKE.rx + STEP; x += STEP / 2) {
      const wet = inside(x + STEP / 4, row, WATER_PTS);
      if (wet && start === null) start = x;
      if (!wet && start !== null) {
        colisao.push({ ...rect('agua', round(start), round(x), round(y), round(y + STEP)), props: { bloqueiaTiro: false } });
        start = null;
      }
    }
  }
}

// ---------------- zonas, áreas e pontos ----------------
seguro.push(rect('seguro', 31.5, 44, 39, 48.5, undefined, 'Clareira dos Despertos')); // sem combate onde se nasce
seguro.push(rect('seguro', 49.5, W, 0, H, undefined, 'Vila do Capão'));
areas.push(rect('area', 28, 46, 34, 52, undefined, 'Clareira dos Despertos'));
areas.push(rect('area', 0, PARK_X, 0, H, undefined, 'Mata do Parque Santo Dias'));
if (reached('4a')) {
  areas.push(rect('area', 5, 27, 14, 32, undefined, 'Lago do Parque'));
  for (const d of DEEP) areas.push(rect('area', Math.max(0, d.x - d.rx), d.x + d.rx, Math.max(0, d.y - d.ry), Math.min(H, d.y + d.ry), { neblina: 0.35, escuro: 0.2 }, 'Mata Profunda'));
}
areas.push(rect('area', PARK_X, W, 0, H, undefined, 'Vila do Capão'));
pontos.push(point('ponto', C.x, C.y, undefined, 'spawn'));
/** Áreas de criaturas (camada "monstros"): o nome é o id em data/monsters.json; os saguis são os "encantados". */
const monstros: Shape[] = [];
if (reached('4a') && CREATURES) {
  monstros.push(rect('area', 24, 40, 12, 28, { quantidade: 4 }, 'sagui'));
  monstros.push(rect('area', 6, 22, 56, 74, { quantidade: 3 }, 'jararaca'));
}

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
    ...(s.polygon ? { polygon: s.polygon.map(([x, y]) => ({ x: round(x * PX), y: round(y * PX) })) } : {}),
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
  ...(monstros.length > 0 ? ([['monstros', monstros]] as [string, Shape[]][]) : []),
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
