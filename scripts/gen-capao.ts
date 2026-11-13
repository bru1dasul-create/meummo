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
// Escopo aprovado pelo dono, uma etapa por vez: 3) só a Clareira dos Despertos; 4a) a mata do parque, o lago e as
// criaturas, refeita em 13/11 a pedido do dono ("mata nova": 50% maior para o sul, bem menos árvores, trilhas sem copa
// por cima, plantas variadas, mais sombria, e a trilha e o lago fora da área que a figueira cobre na tela); 4b) o
// Portão I abre para a Vila do Capão; 4c) campinho, viaduto e saídas. A vila segue a planta aprovada (12/11). A
// mudança de uma etapa para a outra é a constante STAGE.
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
const STAGE: (typeof STAGES)[number] = '4c';
const reached = (stage: (typeof STAGES)[number]) => STAGES.indexOf(STAGE) >= STAGES.indexOf(stage);
/**
 * As criaturas da mata (saguis encantados e jararacas). Ficaram desligadas até o jogo novo ter combate (escolha do dono
 * em 12/11: sem ele, o jogador apanhava sem ver o golpe); o combate, passo 1, chegou em 13/11 e elas voltaram.
 */
const CREATURES = true;
const W = 96;
/** O mapa cresceu para o sul em 13/11 (o dono pediu a mata 50% maior): o parque vai até y = 120 e a vila até y = 80. */
const H = 120;
const VILLAGE_S = 80;
const SEED = 20261113;

// ---------------- medidas do parque (metros) ----------------
/** Centro da clareira e do círculo ancestral (onde se nasce). */
const C = { x: 37, y: 43 };
const CLEARING_R = 9;
const CIRCLE_R = 3;
/**
 * Figueira dos Despertos: colada atrás do círculo, como na arte aprovada. A copa dela é alta e "sobe" na tela,
 * cobrindo uma faixa grande a noroeste: nenhuma trilha e nenhum pedaço do lago fica nessa faixa (escolha do dono).
 */
const FIG = { x: 36.5, y: 38, copa: 5.6, altura: 8.5, tronco: 2 };
/** O gradil do parque e o Portão I. */
const PARK_X = 48;
const GATE = { y0: 41, y1: 47 };
/** Trilha de terra da clareira ao portão (3 m de largura). */
const TRAIL_MAIN: [number, number][] = [
  [C.x, C.y],
  [PARK_X, 44],
];
/**
 * As trilhas da mata (2,2 m). A do norte sai da clareira pelo nordeste (atrás do Curupira), passa pelos saguis e pela
 * mata profunda do noroeste e desce até o lago; a do lago volta para a clareira pelo oeste; a do sul vai até a Clareira
 * das Bananeiras e a mata profunda do sul e, pela pinguela, atravessa o riacho até o recanto do Véu.
 */
const TRAILS: [number, number][][] = [
  [[43.5, 40.5], [44.5, 32], [42.5, 23], [37.5, 14], [29, 8], [18.5, 5.5], [10, 13.5], [5.5, 23], [6.5, 33], [11, 38.5]],
  [[11, 38.5], [18, 38], [24.5, 40.5], [29.5, 46]],
  [[33, 51], [30, 58], [29, 67], [27.5, 75], [27, 80], [28, 88], [26, 97], [21, 104], [16, 107.3], [10, 106], [6.5, 98]],
];
const TRAIL_W = 2.2;
/** O lago (centro e raios da água, com a margem irregular) e o riacho que sai dele para o sul, rumo à Guarapiranga. */
const LAKE = { x: 16, y: 50, rx: 9, ry: 7 };
const LAKE_WOBBLE = 0.16;
const STREAM: [number, number][] = [[15.5, 55], [13, 64], [15, 73], [12.5, 84], [14.5, 95], [13, 106], [14.5, 120]];
const STREAM_W = 1.6;
/** Clareira das Bananeiras: a segunda clareira, no meio do caminho para o sul. */
const BANANA = { x: 27, y: 80, r: 6 };
/** Mata profunda (neblina, escuro, alto risco): noroeste e sul do parque. */
const DEEP = [
  { x: 11, y: 9, rx: 12, ry: 9 },
  { x: 12, y: 100, rx: 11, ry: 13 },
];
/** Pedra ancestral na mata profunda do noroeste (com o brilho do Véu). */
const ANCESTRAL = { x: 7.5, y: 9.5, raio: 1.2 };
/** O recanto do outro lado do riacho, no fim da trilha do sul (com o brilho do Véu). */
const NOOK = { x: 6.5, y: 98 };
/** Áreas das criaturas: em mata mais aberta, para dar para ver e acertar (x0, x1, y0, y1). */
const SAGUI_ZONE = { x0: 32, x1: 46, y0: 6, y1: 24 };
const JARARACA_ZONE = { x0: 16, x1: 26, y0: 92, y1: 112 };
/** Distância mínima entre troncos (borda a borda), para o pé de 0,6 × 0,4 passar. */
const TRUNK_GAP = 1.2;

// ---------------- a Vila do Capão (etapa 4b) ----------------
/** A rua que sai do portão para o leste e a rua para o sul (a saída para Guarapiranga só abre na etapa 4c). */
const STREET = { x0: 56, x1: W, y0: 41, y1: 47 };
const ROAD_S = { x0: 88, x1: 94, y0: 47, y1: VILLAGE_S };
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
// ---------------- etapa 4c: campinho, viaduto e saídas ----------------
/** O campinho de várzea (ambientação, não arena) e o muro com grafite do lado dele (o grafite fica virado para o campo). */
const FIELD = { x0: 60, x1: 85, y0: 63, y1: 78 };
const MURAL = { x0: 57.6, x1: 58.4, y0: 62, y1: 78.3 };
/** O viaduto da Linha 5-Lilás no fundo (lá em cima, a 8 m), quebrado na ponta do parque, com o trem lilás parado. */
const VIADUCT = { x0: PARK_X, x1: W, y0: 2, y1: 6 };
const VIADUCT_PILLARS = [58, 68, 78, 88];
const TRAIN = { x0: 70, x1: 88, y0: 2.8, y1: 5.2 };
/** O ônibus velho, largado perto do viaduto, com mato por cima. */
const BUS = { x0: 70, x1: 86, y0: 12.5, y1: 15.5 };
/**
 * A rua para Guarapiranga continua para o sul, pela mata, até a beira do mapa. Até o Mapa 02 existir, uma barreira com
 * placa fecha a rua perto do fim; a saída leste (Estação Capão Redondo, depois) também fica numa barreira.
 */
const ROAD_GUARA = { x0: ROAD_S.x0, x1: ROAD_S.x1, y0: VILLAGE_S, y1: H };
const SOUTH_BARRIER_Y = 114.5;

/**
 * Entre duas coisas sólidas da vila o vão é zero (encostadas) ou de pelo menos este tanto: num vão menor que isso o
 * pé de 0,6 m entra de lado e entala (aconteceu entre um orelhão e um poste, num vão de 40 cm).
 */
const MIN_GAP = 1.2;
/** Mato tomando conta da vila (bem selvagem), longe das ruas: centro e raios. */
const VILLAGE_GRASS: [number, number, number, number][] = [[64.5, 19, 5.5, 4], [76, 12, 9, 4], [90, 21, 4.5, 5], [60, 61.5, 2.4, 3], [70, 79.5, 12, 2.5]];
/** Árvores no terreno dos fundos (a mata voltando para a vila). */
const VILLAGE_TREES: [number, number, string][] = [[59, 11, 'mata'], [69.5, 24.5, 'mata'], [84, 21, 'mata'], [91.5, 11, 'mata'], [77, 10.5, 'mata']];

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
/** A água do lago (a margem é irregular, com enseadas). */
const WATER_PTS = blob(LAKE.x, LAKE.y, LAKE.rx, LAKE.ry, LAKE_WOBBLE);
const inRect = (x: number, y: number, r: { x0: number; x1: number; y0: number; y1: number }) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
/** O deque: sai da margem leste do lago para dentro da água, onde chega uma trilha curta da clareira. */
const DECK_Y = 48.8;
let shoreX = LAKE.x + LAKE.rx * 1.5;
while (shoreX > LAKE.x && !inside(shoreX, DECK_Y, WATER_PTS)) shoreX -= 0.05;
const DECK = { x0: round(shoreX - 3.6), x1: round(shoreX + 0.6), y0: DECK_Y - 0.7, y1: DECK_Y + 0.7 };
const DECK_SPUR: [number, number][] = [
  [29.2, 47.4],
  [round(shoreX + 0.6), DECK_Y],
];
/** Onde a trilha do sul cruza o riacho: ali vai a pinguela (um tronco-ponte de 3,4 m). */
function crossing(a: [number, number][], b: [number, number][]): [number, number] {
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      const [p, p2, q, q2] = [a[i]!, a[i + 1]!, b[j]!, b[j + 1]!];
      const [rx, ry, sx, sy] = [p2[0] - p[0], p2[1] - p[1], q2[0] - q[0], q2[1] - q[1]];
      const den = rx * sy - ry * sx;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((q[0] - p[0]) * sy - (q[1] - p[1]) * sx) / den;
      const u = ((q[0] - p[0]) * ry - (q[1] - p[1]) * rx) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return [p[0] + t * rx, p[1] + t * ry];
    }
  }
  throw new Error('A trilha do sul não cruza o riacho.');
}
const [bridgeX, bridgeY] = crossing(TRAILS[2]!, STREAM);
const PINGUELA = { x0: round(bridgeX - 1.7), x1: round(bridgeX + 1.7), y0: round(bridgeY - 0.7), y1: round(bridgeY + 0.7) };
/** Água de verdade (onde o pé não entra): o lago e o riacho, menos o deque e a pinguela. */
const isWater = (x: number, y: number) =>
  (inside(x, y, WATER_PTS) || distToPath(x, y, STREAM) <= STREAM_W / 2) && !inRect(x, y, DECK) && !inRect(x, y, PINGUELA);

chao.push(rect('mata', 0, PARK_X, 0, H));
chao.push(rect('terra', PARK_X, W, 0, VILLAGE_S)); // a vila
chao.push(rect('mata', PARK_X, W, VILLAGE_S, H)); // a mata fechada ao sul da vila (a rua para Guarapiranga passa na 4c)
chao.push(rect('asfalto', 49.5, 56, 0, VILLAGE_S, { nome: 'Travessa Jasmim da Beirada' }));
for (const d of DEEP) chao.push({ type: 'mata-profunda', x: 0, y: 0, polygon: blob(d.x, d.y, d.rx, d.ry, 0.12) });
chao.push({ type: 'lama', x: 0, y: 0, polygon: blob(LAKE.x, LAKE.y, LAKE.rx + 1.3, LAKE.ry + 1.2, LAKE_WOBBLE) });
chao.push({ type: 'lama', x: 0, y: 0, polyline: STREAM, props: { largura: STREAM_W + 1.4 } }); // a beira do riacho
chao.push({ type: 'agua', x: 0, y: 0, polygon: WATER_PTS, props: { cor: '#2f6f6a' } });
chao.push({ type: 'agua', x: 0, y: 0, polyline: STREAM, props: { cor: '#2f6f6a', largura: STREAM_W } });
chao.push(ellipse('grama', C.x, C.y, CLEARING_R));
chao.push(ellipse('grama', BANANA.x, BANANA.y, BANANA.r));
for (const t of TRAILS) chao.push({ type: 'trilha', x: 0, y: 0, polyline: t, props: { largura: TRAIL_W } });
chao.push({ type: 'trilha', x: 0, y: 0, polyline: DECK_SPUR, props: { largura: 1.8 } });
chao.push({ type: 'trilha', x: 0, y: 0, polyline: TRAIL_MAIN, props: { largura: 3 } });
chao.push(ellipse('circulo', C.x, C.y, CIRCLE_R, { brilho: '#3fd6c8' }));
if (reached('4b')) {
  // a vila: mato tomando conta, calçadas estreitas de periferia, as ruas e a praça de pedra portuguesa
  for (const [cx, cy, rx, ry] of VILLAGE_GRASS) chao.push({ type: 'grama', x: 0, y: 0, polygon: blob(cx, cy, rx, ry, 0.18) });
  chao.push(rect('calcada', 48.2, 49.5, 0, VILLAGE_S)); // a do parque, junto do gradil
  chao.push(rect('calcada', 56, 57.5, 0, STREET.y0)); // Travessa, lado leste, ao norte da rua
  chao.push(rect('calcada', 56, 57.5, STREET.y1, VILLAGE_S)); // Travessa, lado leste, ao sul da rua
  chao.push(rect('calcada', 57.5, W, 39.5, STREET.y0)); // a das casas
  chao.push(rect('calcada', 57.5, ROAD_S.x0, STREET.y1, SQUARE.y0)); // a da praça
  chao.push(rect('calcada', ROAD_S.x0 - 1, ROAD_S.x0, SQUARE.y0, VILLAGE_S)); // rua de baixo, lado oeste
  chao.push(rect('calcada', ROAD_S.x1, W, STREET.y1, VILLAGE_S)); // rua de baixo, lado leste
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
/** Os troncos já plantados (para a folga entre eles) e as moitas que bloqueiam (bambu e mata fechada). */
const trees: Tree[] = [{ x: FIG.x, y: FIG.y, tronco: FIG.tronco }];
const clumps: { x: number; y: number; r: number }[] = [];
cenario.push(point('arvore', FIG.x, FIG.y, { especie: 'figueira', copa: FIG.copa, altura: FIG.altura, tronco: FIG.tronco }, 'Figueira dos Despertos'));
cenario.push(point('veu', FIG.x, FIG.y, { raio: 1.5 }));
cenario.push(point('veu', C.x, C.y, { raio: CIRCLE_R }));

/** Posição na tela (em metros da tela) de um ponto a uma altura z, na câmera isométrica do jogo (30° de inclinação). */
const screen = (x: number, y: number, z = 0) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2 * 0.5 - z * 0.866] as const;
/** Pontos de uma trilha a cada `step` metros: no meio e nas duas beiradas. */
function pathPoints(pts: [number, number][], largura: number, step = 1): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [[ax, ay], [bx, by]] = [pts[i]!, pts[i + 1]!];
    const len = Math.hypot(bx - ax, by - ay);
    const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
    for (let d = 0; d <= len; d += step) {
      const [x, y] = [ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len];
      for (const o of [0, largura / 2, -largura / 2]) out.push([x + nx * o, y + ny * o]);
    }
  }
  return out;
}
/**
 * Pontos que a câmera precisa ver livres: as duas clareiras, todas as trilhas (o dono pediu "o caminho sem árvore"),
 * o lago, o deque e a pinguela. A câmera olha do sudeste (x e y grandes ficam embaixo na tela), então uma copa alta
 * mais ao sul ou a leste "sobe" na tela e cobre o que está atrás dela.
 */
const VIEW_KEYS: [number, number][] = [];
for (const [cx, cy, r] of [[C.x, C.y, CLEARING_R], [BANANA.x, BANANA.y, BANANA.r]] as const) {
  for (let x = cx - r; x <= cx + r; x += 1) for (let y = cy - r; y <= cy + r; y += 1) if (dist(x, y, cx, cy) <= r) VIEW_KEYS.push([x, y]);
}
VIEW_KEYS.push(...pathPoints(TRAIL_MAIN, 3), ...pathPoints(DECK_SPUR, 1.8));
for (const t of TRAILS) VIEW_KEYS.push(...pathPoints(t, TRAIL_W));
for (let x = LAKE.x - LAKE.rx * 1.3; x <= LAKE.x + LAKE.rx * 1.3; x += 1) {
  for (let y = LAKE.y - LAKE.ry * 1.3; y <= LAKE.y + LAKE.ry * 1.3; y += 1) if (inside(x, y, WATER_PTS)) VIEW_KEYS.push([x, y]);
}
for (const r of [DECK, PINGUELA]) VIEW_KEYS.push([r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1], [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]);
/** A copa (raio) de uma planta em (x, y), nesta altura, cobre na tela o ponto (kx, ky) do chão? */
function covers(x: number, y: number, copa: number, altura: number, kx: number, ky: number): boolean {
  if (kx + ky >= x + y) return false; // só cobre o que está atrás dela
  const [cx, cy] = screen(x, y, altura);
  const [sx, sy] = screen(kx, ky);
  return Math.hypot(sx - cx, sy - cy) < copa * 1.15;
}
const hidesView = (x: number, y: number, copa: number, altura: number) => VIEW_KEYS.some(([kx, ky]) => covers(x, y, copa, altura, kx, ky));
// a figueira fica onde a arte aprovada pôs (a clareira atrás dela é a cena); confere que ela não tampa o resto
{
  const hidden = VIEW_KEYS.find(([kx, ky]) => dist(kx, ky, C.x, C.y) > CLEARING_R + 0.01 && covers(FIG.x, FIG.y, FIG.copa, FIG.altura, kx, ky));
  if (hidden) throw new Error(`A figueira tampa o ponto (${hidden.map(round).join(', ')}): mude a trilha ou o lago.`);
}

/** Todas as trilhas, com a meia largura de cada uma. */
const ALL_TRAILS: { pts: [number, number][]; half: number }[] = [
  { pts: TRAIL_MAIN, half: 1.5 },
  { pts: DECK_SPUR, half: 0.9 },
  ...TRAILS.map((pts) => ({ pts, half: TRAIL_W / 2 })),
];
/** Quanto falta (em metros) até a beirada da trilha mais perto. */
const trailGap = (x: number, y: number) => Math.min(...ALL_TRAILS.map((t) => distToPath(x, y, t.pts) - t.half));
/** Quanto falta até a água (o lago ou o riacho); negativo dentro do lago. */
const SHORE = [...WATER_PTS, WATER_PTS[0]!];
const lakeGap = (x: number, y: number) => (inside(x, y, WATER_PTS) ? -1 : 1) * distToPath(x, y, SHORE);
const waterGap = (x: number, y: number) => Math.min(lakeGap(x, y), distToPath(x, y, STREAM) - STREAM_W / 2);
/** Lugares guardados (centro, raio): nada alto em cima. */
const reserved: { x: number; y: number; r: number }[] = [];
const free = (x: number, y: number, r: number) => !reserved.some((q) => dist(x, y, q.x, q.y) < q.r + r);
const inZone = (x: number, y: number) => [SAGUI_ZONE, JARARACA_ZONE].some((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1);
/** Cabe uma planta com tronco aqui? (fora das clareiras e da água, a copa longe das trilhas, folga entre troncos e moitas) */
function plantFits(x: number, y: number, tronco: number, copa: number, gap: number): boolean {
  if (x < 2 || x > PARK_X - 1.8 || y < 2 || y > H - 2) return false;
  if (dist(x, y, C.x, C.y) < CLEARING_R + copa * 0.6 || dist(x, y, BANANA.x, BANANA.y) < BANANA.r + copa * 0.6) return false;
  if (dist(x, y, FIG.x, FIG.y) < 6.5) return false;
  if (trailGap(x, y) < copa + 0.3) return false; // a copa nunca fica por cima da trilha
  if (waterGap(x, y) < tronco / 2 + 0.8 || !free(x, y, tronco / 2)) return false;
  if (!trees.every((t) => dist(x, y, t.x, t.y) - (t.tronco + tronco) / 2 >= gap)) return false;
  return clumps.every((c) => dist(x, y, c.x, c.y) - c.r - tronco / 2 >= TRUNK_GAP);
}
/** Planta com tronco: confere o lugar e a vista e, cabendo, planta. */
function plant(x: number, y: number, especie: string, d: { tronco: number; copa: number; altura: number }, gap: number): boolean {
  if (!plantFits(x, y, d.tronco, d.copa, gap) || hidesView(x, y, d.copa, d.altura)) return false;
  trees.push({ x, y, tronco: d.tronco });
  cenario.push(point('arvore', round(x), round(y), { especie, ...d }));
  return true;
}
/** Moita que bloqueia (bambu ou mata fechada), sempre deixando 1,2 m de passagem até troncos e outras moitas. */
function plantClump(x: number, y: number, r: number, type: 'bambu' | 'arbusto', altura: number): boolean {
  if (x < 2 || x > PARK_X - 2 || y < 2 || y > H - 2 || trailGap(x, y) < r + 0.8 || waterGap(x, y) < r + 0.4 || !free(x, y, r)) return false;
  if (dist(x, y, C.x, C.y) < CLEARING_R + r + 1 || dist(x, y, BANANA.x, BANANA.y) < BANANA.r + r + 1) return false;
  if (!trees.every((t) => dist(x, y, t.x, t.y) - t.tronco / 2 - r >= TRUNK_GAP)) return false;
  if (!clumps.every((c) => dist(x, y, c.x, c.y) - c.r - r >= TRUNK_GAP) || hidesView(x, y, r * 1.3, altura)) return false;
  clumps.push({ x, y, r });
  cenario.push(type === 'bambu' ? point('bambu', round(x), round(y), { raio: r, altura }) : point('arbusto', round(x), round(y), { raio: r, fechado: true }));
  return true;
}

// ----- os lugares marcados -----
// a Pedra do Véu, na mata profunda do noroeste
reserved.push({ x: ANCESTRAL.x, y: ANCESTRAL.y, r: ANCESTRAL.raio + 1.4 });
cenario.push(point('pedra', ANCESTRAL.x, ANCESTRAL.y, { raio: ANCESTRAL.raio, ancestral: true }, 'Pedra do Véu'));
cenario.push(point('veu', ANCESTRAL.x, ANCESTRAL.y, { raio: 1.4 }));
// o recanto do outro lado do riacho, com o Véu
reserved.push({ x: NOOK.x, y: NOOK.y, r: 3 });
cenario.push(point('veu', NOOK.x, NOOK.y, { raio: 1.4 }));
// o deque (de madeira, dá para andar em cima) com o Véu na ponta, e a pinguela sobre o riacho
cenario.push(rect('deque', DECK.x0, DECK.x1, DECK.y0, DECK.y1, { altura: 0.4 }));
cenario.push(point('veu', round(DECK.x0 + 0.6), DECK_Y, { raio: 1 }));
cenario.push(rect('pinguela', PINGUELA.x0, PINGUELA.x1, PINGUELA.y0, PINGUELA.y1, { altura: 0.4 }));
reserved.push({ x: (DECK.x0 + DECK.x1) / 2, y: DECK_Y, r: 2.6 }, { x: bridgeX, y: bridgeY, r: 2.4 });
// troncos caídos na mata profunda (longe das trilhas)
for (const [x, y, w, h] of [[12.5, 4.5, 3.6, 0.6], [34, 92, 3.4, 0.6], [6.5, 112, 3.4, 0.6]] as const) {
  reserved.push({ x, y, r: Math.max(w, h) / 2 + 1.3 });
  cenario.push(rect('tronco-caido', round(x - w / 2), round(x + w / 2), round(y - h / 2), round(y + h / 2), { altura: 0.6 }));
}
// capivaras descansando na margem oeste do lago (enfeite: não bloqueiam e não atacam)
const shoreK = (a: number) => 1 + LAKE_WOBBLE * (0.6 * Math.sin(a * 3 + 1.3) + 0.4 * Math.cos(a * 5 + 0.4));
for (const a of [2.5, 2.85, 3.5]) {
  const k = shoreK(a);
  const [x, y] = [round(LAKE.x + Math.cos(a) * (LAKE.rx * k + 1.3)), round(LAKE.y + Math.sin(a) * (LAKE.ry * k + 1.2))];
  reserved.push({ x, y, r: 1.2 });
  cenario.push(point('capivara', x, y, { olhando: round((a * 180) / Math.PI + 180) }));
}
// pedras, em grupos (uma grande e uma ou duas pequenas): na beira da clareira, do lago, do riacho e no recanto
const STONES: [number, number, number][] = [
  [30.6, 39.6, 0.85], [31.75, 38.85, 0.42], [29.75, 40.75, 0.4], [44.4, 49, 0.8], [45.45, 48.25, 0.4],
  [14.3, 84.5, 0.6], [11.4, 89.2, 0.45], [4.6, 96.2, 0.7], [8.4, 96, 0.45], [4.3, 99.4, 0.4],
];
for (const a of [4.4, 1.1]) {
  const k = shoreK(a);
  const [x, y] = [LAKE.x + Math.cos(a) * (LAKE.rx * k + 1.1), LAKE.y + Math.sin(a) * (LAKE.ry * k + 1)];
  STONES.push([round(x), round(y), 0.75], [round(x + 1), round(y + 0.6), 0.4]);
}
for (const [x, y, raio] of STONES) {
  if (trailGap(x, y) < raio + 0.3 || waterGap(x, y) < 0.1) continue;
  reserved.push({ x, y, r: raio + 0.4 });
  cenario.push(point('pedra', x, y, { raio }));
}

// ----- as árvores: bem menos que antes (pedido do dono, 13/11), e mais espaçadas onde vivem as criaturas -----
const SPECIES: Record<string, { tronco: number; copa: number; altura: number }> = {
  jeriva: { tronco: 0.3, copa: 2, altura: 7 },
  embauba: { tronco: 0.35, copa: 2.2, altura: 7 },
  seca: { tronco: 0.4, copa: 1.4, altura: 6 },
  xaxim: { tronco: 0.3, copa: 1.2, altura: 2.5 },
  bananeira: { tronco: 0.35, copa: 1.5, altura: 3.5 },
};
for (let tries = 0; tries < 9000; tries++) {
  const x = 2 + rng() * (PARK_X - 4);
  const y = 2 + rng() * (H - 4);
  const k = rng();
  const especie = k < 0.1 ? 'jeriva' : k < 0.22 ? 'embauba' : 'mata';
  const d = SPECIES[especie] ?? { tronco: round(0.4 + rng() * 0.25), copa: round(1.7 + rng() * 1.2), altura: round(5 + rng() * 3.5) };
  plant(x, y, especie, d, TRUNK_GAP + (inZone(x, y) ? 5 : 2.6));
}
// árvores secas (a mata mais sombria: galhos sem folha; o dono pediu, 13/11): mais na mata profunda, algumas no resto
for (const d of DEEP) {
  for (let i = 0, n = 0; i < 800 && n < 6; i++) {
    const [x, y] = [d.x + (rng() * 2 - 1) * d.rx, d.y + (rng() * 2 - 1) * d.ry];
    if (inEllipse(x, y, d) && plant(x, y, 'seca', SPECIES.seca!, TRUNK_GAP + 1.5)) n++;
  }
}
for (let i = 0, n = 0; i < 1500 && n < 8; i++) {
  const [x, y] = [2 + rng() * (PARK_X - 4), 2 + rng() * (H - 4)];
  if (!DEEP.some((d) => inEllipse(x, y, d)) && plant(x, y, 'seca', SPECIES.seca!, TRUNK_GAP + 1.5)) n++;
}
// xaxins na beira da água, onde é úmido
for (let i = 0, n = 0; i < 4000 && n < 18; i++) {
  const [x, y] = [2 + rng() * (PARK_X - 4), 30 + rng() * (H - 32)];
  const g = waterGap(x, y);
  if (g > 1 && g < 6 && plant(x, y, 'xaxim', SPECIES.xaxim!, TRUNK_GAP + 0.6)) n++;
}
// bananeiras em volta da Clareira das Bananeiras e no sudeste do parque
for (let i = 0, n = 0; i < 4000 && n < 14; i++) {
  const a = rng() * Math.PI * 2;
  const rr = 7 + rng() * 4;
  const [x, y] = i % 2 === 0 ? [BANANA.x + Math.cos(a) * rr, BANANA.y + Math.sin(a) * rr] : [34 + rng() * 12, 60 + rng() * 56];
  if (plant(x, y, 'bananeira', SPECIES.bananeira!, TRUNK_GAP + 0.8)) n++;
}
// moitas de bambu e mata fechada: paredes na mata profunda e na faixa oeste, do outro lado do riacho (sempre com passagem)
for (const d of DEEP) {
  for (let i = 0, nb = 0, na = 0; i < 1500 && (nb < 10 || na < 8); i++) {
    const [x, y] = [d.x + (rng() * 2 - 1) * d.rx, d.y + (rng() * 2 - 1) * d.ry];
    if (!inEllipse(x, y, d)) continue;
    const bamboo = nb < 10 && (na >= 8 || rng() < 0.55);
    const r = round(bamboo ? 1 + rng() * 0.4 : 0.7 + rng() * 0.45);
    if (plantClump(x, y, r, bamboo ? 'bambu' : 'arbusto', bamboo ? 7 : 1.2)) bamboo ? nb++ : na++;
  }
}
for (let i = 0, n = 0; i < 1500 && n < 8; i++) {
  const [x, y] = [2.5 + rng() * 7, 60 + rng() * 56];
  if (distToPath(x, y, STREAM) > 2.5 && plantClump(x, y, round(1 + rng() * 0.4), 'bambu', 7)) n++;
}
// a beira do mapa: mata fechada nas pontas do parque (oeste, norte e sul)
const edge: [number, number][] = [];
for (let y = 0.6; y < H; y += 1.1) edge.push([0.6, y]);
for (let x = 1.7; x < PARK_X - 0.6; x += 1.1) edge.push([x, 0.6], [x, H - 0.6]);
for (const [x, y] of edge) cenario.push(point('arbusto', round(x), round(y), { raio: round(0.9 + rng() * 0.25), fechado: true }));

// ----- o chão da mata (não bloqueia): samambaias, helicônias, taboas, aguapés e cogumelos que brilham -----
const lowFits = (x: number, y: number, raio: number) =>
  trailGap(x, y) >= raio + 0.2 &&
  dist(x, y, C.x, C.y) >= CLEARING_R - 1 &&
  dist(x, y, BANANA.x, BANANA.y) >= BANANA.r - 1 &&
  trees.every((t) => dist(x, y, t.x, t.y) > t.tronco / 2 + raio * 0.6) &&
  clumps.every((c) => dist(x, y, c.x, c.y) > c.r + raio * 0.5);
for (let i = 0, n = 0; i < 4000 && n < 130; i++) {
  const [x, y, raio] = [2 + rng() * (PARK_X - 4), 2 + rng() * (H - 4), round(0.5 + rng() * 0.4)];
  if (waterGap(x, y) < raio || !lowFits(x, y, raio)) continue;
  cenario.push(point('planta', round(x), round(y), { tipo: 'samambaia', raio }));
  n++;
}
for (let i = 0, n = 0; i < 4000 && n < 24; i++) {
  const [x, y, raio] = [2 + rng() * (PARK_X - 4), 30 + rng() * (H - 32), round(0.5 + rng() * 0.3)];
  const g = waterGap(x, y);
  const byClearing = Math.abs(dist(x, y, BANANA.x, BANANA.y) - BANANA.r - 1.2) < 1;
  if (((g > raio && g < 3.5) || byClearing) && lowFits(x, y, raio)) {
    cenario.push(point('planta', round(x), round(y), { tipo: 'heliconia', raio }));
    n++;
  }
}
// taboas na água rasa: na margem sul e oeste do lago e no riacho
for (let i = 0, n = 0; i < 400 && n < 10; i++) {
  const a = 1.6 + rng() * 2.4;
  const k = shoreK(a) * (0.84 + rng() * 0.1);
  const [x, y] = [round(LAKE.x + Math.cos(a) * LAKE.rx * k), round(LAKE.y + Math.sin(a) * LAKE.ry * k)];
  if (isWater(x, y)) {
    cenario.push(point('planta', x, y, { tipo: 'taboa', raio: round(0.4 + rng() * 0.2) }));
    n++;
  }
}
for (let i = 0, n = 0; i < 400 && n < 6; i++) {
  const s = Math.floor(rng() * (STREAM.length - 1));
  const t = rng();
  const [x, y] = [STREAM[s]![0] + (STREAM[s + 1]![0] - STREAM[s]![0]) * t + (rng() < 0.5 ? -0.45 : 0.45), STREAM[s]![1] + (STREAM[s + 1]![1] - STREAM[s]![1]) * t];
  if (y < H - 3 && isWater(x, y) && trailGap(x, y) > 1.5) {
    cenario.push(point('planta', round(x), round(y), { tipo: 'taboa', raio: 0.4 }));
    n++;
  }
}
for (let i = 0; i < 80 && cenario.filter((o) => o.type === 'aguape').length < 14; i++) {
  const a = rng() * Math.PI * 2;
  const k = 0.55 + rng() * 0.3;
  const [x, y] = [round(LAKE.x + Math.cos(a) * LAKE.rx * k), round(LAKE.y + Math.sin(a) * LAKE.ry * k)];
  if (isWater(x, y)) cenario.push(point('aguape', x, y, { raio: round(0.5 + rng() * 0.5) }));
}
// nenhum aguapé encostado no deque ou na pinguela (a folha boiando ficava desenhada por cima das tábuas): empurra para
// a água livre mais perto, sem sortear nada (o resto da mata não muda); se não couber, tira
for (const o of cenario.filter((c) => c.type === 'aguape')) {
  const raio = Number(o.props!.raio);
  const clear = (x: number, y: number) =>
    isWater(x, y) && [DECK, PINGUELA].every((r) => Math.hypot(Math.max(0, r.x0 - x, x - r.x1), Math.max(0, r.y0 - y, y - r.y1)) >= raio + 0.3);
  if (clear(o.x, o.y)) continue;
  let best: [number, number] | undefined;
  for (let d = 0.25; d <= 2.5 && !best; d += 0.25) {
    for (let k = 0; k < 16 && !best; k++) {
      const [x, y] = [round(o.x + Math.cos((k / 16) * Math.PI * 2) * d), round(o.y + Math.sin((k / 16) * Math.PI * 2) * d)];
      if (clear(x, y)) best = [x, y];
    }
  }
  if (best) [o.x, o.y] = best;
  else cenario.splice(cenario.indexOf(o), 1);
}
for (let i = 0, n = 0; i < 3000 && n < 24; i++) {
  const spot = [...DEEP, { x: NOOK.x, y: NOOK.y, rx: 4, ry: 4 }, { x: ANCESTRAL.x, y: ANCESTRAL.y, rx: 4, ry: 4 }][i % 4]!;
  const [x, y] = [spot.x + (rng() * 2 - 1) * spot.rx, spot.y + (rng() * 2 - 1) * spot.ry];
  if (x > 2 && y > 2 && y < H - 2 && inEllipse(x, y, spot) && waterGap(x, y) > 0.5 && lowFits(x, y, 0.3) && free(x, y, 0.2)) {
    cenario.push(point('planta', round(x), round(y), { tipo: 'cogumelo', raio: round(0.25 + rng() * 0.15), brilho: '#3fd6c8' }));
    n++;
  }
}

// o gradil do parque (ferro velho com cipó, até o fim do parque, lá no sul) e o Portão I, que abre na etapa 4b
cenario.push(rect('gradil', PARK_X - 0.1, PARK_X + 0.1, 0, GATE.y0 - 0.3, { altura: 1.8, estado: 'inteiro' }));
cenario.push(rect('gradil', PARK_X - 0.1, PARK_X + 0.1, GATE.y1 + 0.3, H, { altura: 1.8, estado: 'inteiro' }));
cenario.push(rect('portao', PARK_X - 0.1, PARK_X + 0.1, GATE.y0 + 0.3, GATE.y1 - 0.3, { aberto: reached('4b') }, 'Portão I'));
for (const y of [GATE.y0, GATE.y1]) cenario.push(rect('pilar', PARK_X - 0.3, PARK_X + 0.3, y - 0.3, y + 0.3, { altura: 2.6 }));
// poste com luz quente do lado de fora do portão (aparece entre as grades)
cenario.push(point('poste', POSTS[0]![0], POSTS[0]![1], { altura: reached('4b') ? 7 : 4.2, luz: '#ffd36b' }));

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
  // o logo da Budega (o escudo dourado do dono, sem tabacaria e sem narguilé) vai na fachada; o letreiro fica de reserva
  cenario.push(rect('casa', BUDEGA.x0, BUDEGA.x1, BUDEGA.y0, BUDEGA.y1, { altura: 2.6, andares: 1, cor: '#d4553a', caixaDagua: true, comercio: 'vendinha', letreiro: 'BUDEGA DISTRIBUIDORA', logo: 'budega', toldo: '#f1c84a' }, 'Budega'));

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
  // a beira da vila: mata fechada (a ponta da Travessa e a rua do leste terminam no mato; a partir da 4c a rua de baixo
  // segue para o sul, rumo a Guarapiranga)
  const villageEdge: [number, number][] = [];
  for (let x = PARK_X + 0.6; x < W - 1; x += 1.1) villageEdge.push([x, 0.6], [x, VILLAGE_S - 0.6]);
  for (let y = 0.6; y < VILLAGE_S; y += 1.1) villageEdge.push([W - 0.6, y]);
  // o tamanho de cada arbusto é sorteado sempre na mesma ordem (a vila aprovada não muda); a partir da 4c a beira sul abre
  // onde a rua de baixo segue para o sul
  const roadOpen = (x: number, y: number) => reached('4c') && y > VILLAGE_S - 1 && x > ROAD_GUARA.x0 - 1 && x < ROAD_GUARA.x1 + 1;
  for (const [x, y] of villageEdge) {
    const raio = round(0.9 + vrng() * 0.25);
    if (!roadOpen(x, y)) cenario.push(point('arbusto', round(x), round(y), { raio, fechado: true }));
  }

  // nada alto ao sul da rua pode tampar o portão, a rua ou o balcão
  for (const o of cenario.filter((c) => c.type === 'casa' || c.type === 'carro')) {
    const hidden = boxHides({ x0: o.x, x1: o.x + o.w!, y0: o.y, y1: o.y + o.h! }, Number(o.props!.altura));
    if (hidden) throw new Error(`${o.name || o.type} em (${o.x}, ${o.y}) tampa o ponto (${hidden.join(', ')}) da vila.`);
  }
}

// ---------------- etapa 4c: campinho, viaduto e saídas ----------------
if (reached('4c')) {
  const crng = mulberry32(SEED + 9); // sorteio só da 4c: o resto do mapa não muda
  // o campinho de várzea: terra batida com as linhas, as traves (só os postes seguram o pé), capivaras pastando e bancos
  // para quem assiste; o muro com grafite do lado oeste, com a pintura virada para o campo (o lado que a câmera vê)
  chao.push(rect('campinho', FIELD.x0, FIELD.x1, FIELD.y0, FIELD.y1, { linhas: true }));
  const midY = (FIELD.y0 + FIELD.y1) / 2;
  cenario.push(rect('trave', FIELD.x0 + 0.2, FIELD.x0 + 0.4, midY - 1.5, midY + 1.5, { altura: 2, olhando: 0 }));
  cenario.push(rect('trave', FIELD.x1 - 0.4, FIELD.x1 - 0.2, midY - 1.5, midY + 1.5, { altura: 2, olhando: 180 }));
  cenario.push(point('capivara', 72, 70.5, { olhando: 200 }), point('capivara', 74.6, 72.3, { olhando: 30 }));
  for (const x of [66, 79]) cenario.push(rect('banco', x - 0.8, x + 0.8, 61.35, 61.85, { olhando: 90 }));
  cenario.push(rect('muro', MURAL.x0, MURAL.x1, MURAL.y0, MURAL.y1, { altura: 2.4, cor: '#c9c2b6', grafite: 'cores', lado: 'leste' }));
  for (let x = FIELD.x0; x <= FIELD.x1; x += 1) for (let y = FIELD.y0; y <= FIELD.y1; y += 1) VILLAGE_KEYS.push([x, y, 0]);

  // o viaduto da Linha 5-Lilás: o tabuleiro lá em cima (não segura o pé), os pilares, o trem parado e os cipós
  cenario.push(rect('viaduto', VIADUCT.x0, VIADUCT.x1, VIADUCT.y0, VIADUCT.y1, { altura: 8, espessura: 1.4, mato: true, quebrado: 'oeste' }));
  for (const x of VIADUCT_PILLARS) cenario.push(rect('pilar-viaduto', x - 0.8, x + 0.8, 3.2, 4.8, { altura: 8 }));
  cenario.push(rect('trem', TRAIN.x0, TRAIN.x1, TRAIN.y0, TRAIN.y1, { altura: 2.6, base: 9.4, cor: '#7d5ca8', vagoes: 3 }));
  for (const x of [51, 63, 74, 84, 93]) cenario.push(point('cipo', x, VIADUCT.y1 + 0.05, { comprimento: round(3 + crng() * 2.5), base: 8 }));
  cenario.push(rect('onibus', BUS.x0, BUS.x1, BUS.y0, BUS.y1, { altura: 3, cor: '#d7b14a', mato: true }));

  // a rua para Guarapiranga pela mata (rachada, com mato), fechada por uma barreira com placa perto do fim
  chao.push(rect('asfalto', ROAD_GUARA.x0, ROAD_GUARA.x1, ROAD_GUARA.y0, ROAD_GUARA.y1, { estado: 'rachado' }));
  for (const [cx, cy, rx, ry] of [[90, 95, 1.6, 4], [92.6, 106, 1.3, 3], [89.6, 86, 1.2, 2.5]] as const) chao.push({ type: 'grama', x: 0, y: 0, polygon: blob(cx, cy, rx, ry, 0.2) });
  cenario.push(rect('barreira', ROAD_GUARA.x0, ROAD_GUARA.x1, SOUTH_BARRIER_Y, SOUTH_BARRIER_Y + 0.5, { altura: 1.1 }));
  cenario.push(point('placa', (ROAD_GUARA.x0 + ROAD_GUARA.x1) / 2, SOUTH_BARRIER_Y - 0.3, { texto: 'GUARAPIRANGA', seta: 'sul' }));
  // paredes de mata dos dois lados da rua: a mata ao sul da vila continua só de enfeite
  for (let y = VILLAGE_S + 0.6; y < H; y += 1.1) {
    for (const x of [ROAD_GUARA.x0 - 0.7, ROAD_GUARA.x1 + 0.7]) cenario.push(point('arbusto', round(x), round(y), { raio: round(0.9 + crng() * 0.25), fechado: true }));
  }
  for (let x = ROAD_GUARA.x0 + 1; x <= ROAD_GUARA.x1 - 1; x += 1) for (let y = VILLAGE_S; y < SOUTH_BARRIER_Y; y += 2) VILLAGE_KEYS.push([x, y, 0]);
  // a saída leste (Estação Capão Redondo) fica para depois: a rua da vila termina no mato, com uma placa num poste na
  // beira norte da rua (longe o bastante do mato e da casa para não ficar vão de entalar)
  cenario.push(point('placa', 92.9, STREET.y0 + 0.3, { texto: 'ESTAÇÃO CAPÃO REDONDO', seta: 'leste', poste: true }));
}

// a mata fechada ao sul da vila: só enfeite (ninguém chega lá). A partir da 4c a rua para Guarapiranga passa por ela,
// e nenhuma copa tampa a rua nem o campinho
{
  const srng = mulberry32(SEED + 7);
  const south: Tree[] = [];
  const nearRoad = (x: number, r: number) => reached('4c') && x + r > ROAD_GUARA.x0 - 2.2 && x - r < ROAD_GUARA.x1 + 2.2;
  const southFits = (x: number, y: number, r: number) => !nearRoad(x, r) && south.every((t) => dist(x, y, t.x, t.y) - t.tronco / 2 - r >= TRUNK_GAP + 1.4);
  for (let i = 0, n = 0; i < 3000 && n < 45; i++) {
    const [x, y] = [PARK_X + 1.5 + srng() * (W - PARK_X - 3), VILLAGE_S + 3 + srng() * (H - VILLAGE_S - 4.5)];
    const k = srng();
    const especie = k < 0.15 ? 'jeriva' : k < 0.3 ? 'embauba' : 'mata';
    const d = SPECIES[especie] ?? { tronco: round(0.4 + srng() * 0.25), copa: round(1.7 + srng() * 1.2), altura: round(5 + srng() * 3.5) };
    if (!southFits(x, y, d.tronco / 2) || canopyHides(x, y, d.copa, d.altura)) continue;
    south.push({ x, y, tronco: d.tronco });
    cenario.push(point('arvore', round(x), round(y), { especie, ...d }));
    n++;
  }
  for (let i = 0, n = 0; i < 2000 && n < 14; i++) {
    const [x, y, r] = [PARK_X + 2 + srng() * (W - PARK_X - 4), VILLAGE_S + 3 + srng() * (H - VILLAGE_S - 5), round(1 + srng() * 0.4)];
    if (!southFits(x, y, r) || canopyHides(x, y, r * 1.3, 7)) continue;
    south.push({ x, y, tronco: r * 2 });
    cenario.push(point('bambu', round(x), round(y), { raio: r, altura: 7 }));
    n++;
  }
  for (let i = 0, n = 0; i < 2000 && n < 10; i++) {
    const [x, y] = [PARK_X + 2 + srng() * (W - PARK_X - 4), VILLAGE_S + 3 + srng() * (H - VILLAGE_S - 5)];
    if (!southFits(x, y, 0.2) || canopyHides(x, y, SPECIES.bananeira!.copa, SPECIES.bananeira!.altura)) continue;
    south.push({ x, y, tronco: 0.35 });
    cenario.push(point('arvore', round(x), round(y), { especie: 'bananeira', ...SPECIES.bananeira! }));
    n++;
  }
}

// ---------------- colisão (tirada do cenário) ----------------
for (const s of cenario) {
  const p = s.props ?? {};
  if (s.type === 'arvore') colisao.push(block('tronco', s.x, s.y, Number(p.tronco)));
  else if (s.type === 'poste') colisao.push(block('poste', s.x, s.y, 0.3));
  else if (s.type === 'pedra') colisao.push(block('pedra', s.x, s.y, round(Number(p.raio) * 1.5)));
  else if (s.type === 'arbusto' && p.fechado) colisao.push(block('mata-fechada', s.x, s.y, round(Number(p.raio) * 1.8)));
  else if (s.type === 'bambu') colisao.push(block('bambu', s.x, s.y, round(Number(p.raio) * 1.6)));
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
  // a 4c: muro, pilares do viaduto e ônibus seguram a pedrinha; a barreira é baixa; da trave, só os dois postes
  else if (s.type === 'muro' || s.type === 'pilar-viaduto' || s.type === 'onibus') colisao.push(rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!, { altura: Number(p.altura) }));
  else if (s.type === 'placa' && p.poste) colisao.push(block('placa', s.x, s.y, 0.2, { bloqueiaTiro: false, altura: 2.2 }));
  else if (s.type === 'barreira') colisao.push(rect('barreira', s.x, s.x + s.w!, s.y, s.y + s.h!, { bloqueiaTiro: false, altura: Number(p.altura) }));
  else if (s.type === 'trave') for (const y of [s.y, s.y + s.h!]) colisao.push(block('trave', s.x + s.w! / 2, y, 0.2, { bloqueiaTiro: false, altura: 2 }));
}
// na vila, nenhum vão estreito entre duas coisas sólidas de frente uma para a outra: abaixo de 0,3 m o pé nem entra; de
// 0,3 a MIN_GAP ele entra de lado e entala. (Na diagonal, canto com canto, sempre há por onde sair.)
if (reached('4b')) {
  const village = colisao.filter((c) => c.x + c.w! > PARK_X + 0.5 && c.y < VILLAGE_S);
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
// a água (o lago e o riacho) vira faixas de 0,5 m de altura: o pé não entra e a pedrinha passa por cima. O deque e a
// pinguela ficam de fora (dá para andar em cima deles).
{
  const STEP = 0.5;
  const top = Math.floor(Math.min(...WATER_PTS.map(([, y]) => y)) / STEP) * STEP;
  for (let y = top; y < H; y += STEP) {
    const row = y + STEP / 2;
    let start: number | null = null;
    for (let x = 0; x <= PARK_X; x += STEP / 4) {
      const wet = x < PARK_X && isWater(x + STEP / 8, row);
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
seguro.push(rect('seguro', 49.5, W, 0, VILLAGE_S, undefined, 'Vila do Capão'));
// as áreas com nome (a faixa no alto da tela) e o clima de cada uma: `escuro` e `neblina`, de 0 a 1. Onde duas se
// cobrem, vale a menor (a mais de perto). O dono pediu a mata mais sombria (13/11): a mata toda é um pouco escura, a
// mata profunda bem mais, e as clareiras ficam claras (o contraste com o brilho do Véu).
areas.push(rect('area', 28, 46, 34, 52, { escuro: 0.05, neblina: 0 }, 'Clareira dos Despertos'));
areas.push(rect('area', 0, PARK_X, 0, H, { escuro: 0.3, neblina: 0.12 }, 'Mata do Parque Santo Dias'));
areas.push(rect('area', LAKE.x - LAKE.rx - 2, LAKE.x + LAKE.rx + 2, LAKE.y - LAKE.ry - 2, LAKE.y + LAKE.ry + 2, { escuro: 0.2, neblina: 0.3 }, 'Lago do Parque'));
areas.push(rect('area', BANANA.x - BANANA.r - 2, BANANA.x + BANANA.r + 2, BANANA.y - BANANA.r - 2, BANANA.y + BANANA.r + 2, { escuro: 0.15, neblina: 0.05 }, 'Clareira das Bananeiras'));
for (const d of DEEP) areas.push(rect('area', Math.max(0, d.x - d.rx), d.x + d.rx, Math.max(0, d.y - d.ry), Math.min(H, d.y + d.ry), { escuro: 0.5, neblina: 0.45 }, 'Mata Profunda'));
areas.push(rect('area', PARK_X, W, 0, VILLAGE_S, undefined, 'Vila do Capão'));
pontos.push(point('ponto', C.x, C.y, undefined, 'spawn'));
/** Áreas de criaturas (camada "monstros"): o nome é o id em data/monsters.json; os saguis são os "encantados". */
const monstros: Shape[] = [];
if (CREATURES) {
  monstros.push(rect('area', SAGUI_ZONE.x0, SAGUI_ZONE.x1, SAGUI_ZONE.y0, SAGUI_ZONE.y1, { quantidade: 4 }, 'sagui'));
  monstros.push(rect('area', JARARACA_ZONE.x0, JARARACA_ZONE.x1, JARARACA_ZONE.y0, JARARACA_ZONE.y1, { quantidade: 3 }, 'jararaca'));
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
