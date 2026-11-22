// Gera o Mapa 02 do mundo novo (2.5D isométrico) em public/assets/maps-iso/guarapiranga.tmj:
// a Represa de Guarapiranga, com o Refúgio (a segunda vila, sobre palafitas na água).
//
// Formato combinado com a [estrutura] (docs/ARQUITETURA.md, "Mapas do mundo novo"); peças comuns em scripts/iso-map.ts.
// 22/11: o mapa MAIOR, no escopo do dono (400 × 320 m, os 13 lugares; planta em docs/referencias/mapa-02-400-planta.jpg).
// Ele escolheu "mapa inteiro primeiro": tudo aberto de uma vez, para andar e conferir o tamanho e os caminhos, com o chão
// pintado, a água e a mata de sempre; os prédios especiais (clube, barragem, coreto, caverna, mirante) começam simples.
// O que já existia fica no lugar (a origem não muda: a chegada, o Refúgio, a Dona Iracema e o Barqueiro); o mapa cresceu
// para a direita e para baixo. Os lugares, com os números do escopo do dono:
//   1 Chegada (Estrada do M'Boi Mirim)   2 Mirante (no parque)        3 O Refúgio (palafitas)
//   4 Brejo Maior (a praça da comunidade) 5 Campinho                   6 Praça em Ruínas (coreto e cachoeira)
//   7 Clube Náutico em Ruínas            8 Ilha do Véu (de barco)     9 Barragem de 1909 (a saída, fechada por ora)
//  10 A comporta (o muro da barragem)    11 Trilha da Margem Sul      12 Caverna Sagrada      13 Várzea de Caça
// Dá para dar a volta inteira na represa a pé: a estrada pelo norte e pelo leste, a barragem no sul e a trilha da margem
// sul pelo oeste.
//
// Uso: npm run gen:guarapiranga (não sobrescreve o mapa existente sem --force; para comparar, use --out outro.tmj)

import { mulberry32 } from './pixels';
import { writeMapImage } from './mapa-de-cima';
import {
  area,
  block,
  bushBoxes,
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
const W = 400;
const H = 320;
const SEED = 20261114;
/** Duas coisas sólidas de frente uma para a outra ficam coladas ou a pelo menos isto (num vão menor o pé entala). */
const MIN_GAP = 1.2;
/** Distância mínima entre troncos (borda a borda), para o pé de 0,6 × 0,4 passar. */
const TRUNK_GAP = 1.2;

// ---------------- o desenho do mapa (metros) ----------------
/**
 * A margem da represa de antes (o canto de cima à esquerda): de leste para oeste pela orla e depois para o sul pela
 * margem oeste. Fica igual: o Refúgio, o píer e os barcos estão nela.
 */
const SHORE_CTRL: Pt[] = [
  [122, 37.5], [118, 36.6], [113, 35.8], [107, 36.2], [101, 34.2], [95, 33], [88, 31.6], [81, 31.2], [74, 32.3], [67, 33],
  [60, 31.8], [53, 32], [47, 33.5], [42.6, 37], [41.2, 40.5], [40.5, 45.5], [40.7, 51], [41.3, 57], [41.6, 63], [40.4, 70],
  [38.8, 78], [39.6, 86], [37.8, 94], [38.2, 102],
];
const SHORE_OLD = smooth(SHORE_CTRL, 1.2, false, 0.3);
/** A barragem fecha a represa no sul: a beira da água ali é o muro, reto, de x 148 a 308. */
const DAM = { x0: 148, x1: 308, y: 250 };
/** A margem nova: a sudoeste até a barragem e, depois dela, a leste e a norte de volta até a de antes. */
const SHORE_SW = smooth([[38.2, 102], [39.6, 116], [40.2, 130], [42.5, 148], [46.5, 166], [54.5, 188], [69, 211], [92, 231], [118, 243.5], [DAM.x0, DAM.y]], 1.2, false, 0.3);
const DAM_EDGE: Pt[] = [];
for (let x = DAM.x0; x < DAM.x1; x += 1.2) DAM_EDGE.push([round(x), DAM.y]);
DAM_EDGE.push([DAM.x1, DAM.y]);
const SHORE_E = smooth(
  [[DAM.x1, DAM.y], [318, 236], [326, 214], [332, 186], [334, 158], [331, 132], [322, 114], [304, 100], [282, 90], [258, 84], [232, 80], [206, 81], [180, 77], [160, 70], [146, 58], [134, 46], [122, 37.5]],
  1.2,
  false,
  0.3,
);
/** A beira da represa inteira, em volta (fechada). A água fica dentro. */
const SHORE: Pt[] = [...SHORE_OLD, ...SHORE_SW.slice(1), ...DAM_EDGE.slice(1), ...SHORE_E.slice(1)];
const WATER: Pt[] = SHORE;
/** A ilhota de antes e a Ilha do Véu (grande, no meio): dá para pisar, mas só de barco (depois, com o Barqueiro). */
const ISLAND_SMALL = blob(92, 72, 6, 4.5, 0.15);
const ISLAND = blob(196, 148, 26, 18, 0.12);
/** O riacho que desce da cachoeira, no nordeste, até a represa (passa por baixo da estrada). */
const CREEK = smooth([[393, 23], [380, 36], [366, 50], [352, 64], [342, 80], [333, 96], [325, 112], [320, 120]], 1);
const CREEK_W = 3;
/** Os dois canais que saem da comporta para a várzea, cada um terminando numa lagoa. */
const CHANNELS = [smooth([[218, 256], [214, 266], [208, 278], [203, 289]], 1), smooth([[242, 256], [246, 266], [254, 278], [259, 289]], 1)];
const CHANNEL_W = 2.4;
const PONDS = [blob(200, 294, 12, 7, 0.15), blob(262, 294, 11, 7, 0.15)];
/** As poças do brejo do sudoeste (fora da trilha). */
const BREJO_POOLS = [blob(11, 96, 4.5, 3, 0.15), blob(12, 121, 4, 2.8, 0.15)];
/** A piscina vazia do clube (só água de chuva, verde). */
const POOL: Rect = { x0: 304.5, x1: 316, y0: 77, y1: 86 };
const POOL_PTS: Pt[] = [[POOL.x0, POOL.y0], [POOL.x1, POOL.y0], [POOL.x1, POOL.y1], [POOL.x0, POOL.y1]];

/** A Estrada do M'Boi Mirim: chega do Capão pela beira de cima, vira a rua da orla e desce pelo leste até a saída. */
const ROAD = smooth(
  [[19.2, -1], [19.8, 7], [22.6, 13.6], [28.6, 19.4], [37, 23.4], [47, 25.4], [60, 25.6], [74, 25], [88, 25.6], [101, 27.6], [112, 29.6], [122, 31], [136, 39], [152, 50], [172, 57], [200, 60], [230, 61], [262, 61], [296, 64], [326, 72], [348, 88], [360, 112], [363, 145], [362, 180], [362, 212], [370, 226], [386, 230], [401, 230]],
  1.5,
);
const ROAD_W = 6;
/** A calçada (com mato) dos dois lados do asfalto. */
const SIDEWALK = 1.5;
const ROAD_HALF = ROAD_W / 2 + SIDEWALK;
/** O trecho de antes (até a árvore caída, que saiu): os detalhes do asfalto de lá ficam iguais. */
const ROAD_OLD = ROAD.filter(([x]) => x <= 50);
/** O Caminho da Represa: desce da estrada pela margem oeste até o píer do Refúgio. */
const PATH = smooth([[38.6, 26.6], [37.7, 33], [36.8, 40], [36.6, 46], [37.5, 51.4], [39.4, 54.8], [41, 56]], 1);
const PATH_W = 3;
/** As trilhas de terra novas. */
const TRAIL_PARK = smooth([[36.4, 45], [30, 44], [24.5, 45.5], [20.5, 48.5]], 1); // até o mirante
const TRAIL_SOUTH = smooth([[39.4, 56.6], [34, 64], [28, 76], [23, 90], [21, 105], [23.5, 122], [27.5, 142], [32.5, 162], [41, 184], [55, 205], [74, 222], [98, 236], [122, 246], [145, 252]], 1);
const TRAIL_CAVE = smooth([[27.5, 142], [21, 168], [18, 198], [19, 228], [21, 252], [25, 266], [30, 273.5]], 1);
const TRAIL_COMMUNITY = smooth([[158, 43], [159.5, 47], [161, 50]], 1);
const TRAIL_FIELD = smooth([[233, 38.5], [233.5, 48], [234, 56.5]], 1);
const TRAIL_SQUARE = smooth([[327, 46.5], [327.5, 56], [328.5, 70]], 1);
const TRAIL_DAM_EAST = smooth([[340, 251.5], [352, 245], [362, 237], [370, 231]], 1);
/** Da praça em ruínas até a beira do poço da cachoeira (o riacho fica ao sul dela). */
const TRAIL_FALL = smooth([[346.5, 27], [358, 26.2], [370, 24.8], [383.6, 23.2]], 1);
const TRAILS: [Pt[], number, string][] = [
  [TRAIL_PARK, 2.6, 'Trilha do Mirante'],
  [TRAIL_SOUTH, 3, 'Trilha da Margem Sul'],
  [TRAIL_CAVE, 2.6, 'Trilha da Caverna'],
  [TRAIL_COMMUNITY, 3, ''],
  [TRAIL_FIELD, 3, ''],
  [TRAIL_SQUARE, 3, ''],
  [TRAIL_DAM_EAST, 3, ''],
  [TRAIL_FALL, 2.4, 'Trilha da Cachoeira'],
];

// ----- o Refúgio: a vila sobre palafitas (igual) -----
/** O deque (de madeira, sobre palafitas): o miolo com a praça, o píer até a margem, o atracadouro do Barqueiro e o deque sudeste. */
const CORE: Rect = { x0: 47, x1: 69, y0: 45, y1: 60 };
const PIER: Rect = { x0: 40.5, x1: 47, y0: 55, y1: 57 };
const LANDING: Rect = { x0: 47, x1: 52.5, y0: 60, y1: 63.5 };
const SE_DECK: Rect = { x0: 60, x1: 69, y0: 60, y1: 66 };
/** O píer quebrado do clube náutico: um pedaço na margem e o outro sozinho na água, depois do buraco. */
const CLUB_PIER: Rect = { x0: 300.5, x1: 303.5, y0: 93, y1: 106 };
const CLUB_PIER_END: Rect = { x0: 300.5, x1: 303.5, y0: 109, y1: 118 };
/** O mirante: a plataforma de madeira na beira do parque (a torre vem depois). */
const LOOKOUT: Rect = { x0: 13, x1: 19, y0: 47, y1: 53 };
const DECKS: [Rect, string][] = [
  [CORE, 'Praça do Refúgio'],
  [PIER, 'Píer'],
  [LANDING, 'Atracadouro'],
  [SE_DECK, ''],
  [CLUB_PIER, ''],
  [CLUB_PIER_END, ''],
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
/** Onde fica a Dona Iracema: atrás da banca de frutas, na frente da quitanda (o pé dela no data/npcs.json da [estrutura]). */
const IRACEMA = { x: 57.5, y: 50.35 };
/**
 * A banca de frutas dela, em U, encostada na parede da quitanda (19/11: no print, a [estrutura] viu a Dona Iracema em pé
 * na frente da vitrine, parecendo freguesa): a frente de 0,5 m para quem compra e os dois lados de 0,3 m até a parede.
 * O miolo (2 × 0,75 m) é dela: fechado, ninguém entra. Da frente até o banco da fogueira ficam 1,4 m livres.
 */
const BANCA = { x0: 56.2, x1: 58.8, y0: 49.8, y1: 51.05, frente: 0.5, lados: 0.3 };
/** O Barqueiro, no atracadouro, do lado do barco dele. */
const BARQUEIRO = { x: 49.6, y: 62.4 };
/** A fogueira da praça, com bancos em volta. */
const FIRE = { x: 57, y: 55.3 };

// ----- a chegada (igual) -----
/** Onde aparece quem chega do Capão, e a saída de volta (a beira de cima, na estrada). */
// (um pouco a oeste do meio da estrada: os postes da beira leste não ficam, na tela, na frente de quem chega)
const ARRIVAL = { x: 18.6, y: 4.8 };
const EXIT_NORTH: Rect = { x0: 14.5, x1: 25, y0: 0, y1: 0.6 };
/** O ponto de ônibus (o último ponto da linha), do lado oeste da estrada, virado para ela. */
const BUS_STOP: Rect = { x0: 13.2, x1: 14.6, y0: 5, y1: 8.4 };

// ----- os lugares novos -----
/** 4 · A comunidade da represa (o chão de terra) e a praça do Brejo Maior no meio dela. */
const COMMUNITY: Pt[] = [[124, 3], [206, 3], [208, 46], [186, 51], [160, 49.5], [138, 42], [124, 34]];
const PLAZA: Rect = { x0: 146, x1: 170, y0: 25, y1: 41 };
const PLAZA_FIRE = { x: 158, y: 33 };
/** 5 · O campinho de terra. */
const FIELD: Rect = { x0: 214, x1: 252, y0: 12, y1: 38 };
/** 6 · A praça em ruínas, com o coreto. */
const SQUARE: Rect = { x0: 308, x1: 346, y0: 14, y1: 46 };
const CORETO: Rect = { x0: 321, x1: 333, y0: 24, y1: 36 };
const FALL: Rect = { x0: 388, x1: 396, y0: 17, y1: 23 };
/** O poço ao pé da cachoeira: a beira de cima encosta na pedra inteira (sem fresta de entalar); dele sai o riacho. */
const FALL_POOL: Pt[] = [[388, 23], [396, 23], [396.6, 24.2], [396.2, 25.6], [394.8, 26.8], [392.6, 27.4], [390.4, 27], [388.8, 25.9], [388, 24.5]];
/** 7 · O clube náutico: o pátio de cimento, os prédios e a piscina. */
const CLUB: Rect = { x0: 272, x1: 318, y0: 72, y1: 94 };
/** 9 · O prédio da Barragem de 1909 e 10 · o caminho de pedra em cima do muro da barragem (a comporta no meio). */
const DAM_HOUSE: Rect = { x0: 326, x1: 346, y0: 226, y1: 244 };
const DAM_WALK: Rect = { x0: 146, x1: 340, y0: DAM.y, y1: DAM.y + 3.4 };
const GATES = [218, 242];
/** A comporta: a queda d'água que sai do muro (6 m de largura, 2,4 m de fundo) e o poço onde ela cai (encosta na queda inteira). */
const GATE_W = 3;
// (a beira de baixo cai na linha das faixas de água, de 0,5 em 0,5 m: o poço encosta na queda sem sobra)
const GATE_Y1 = Math.ceil((DAM_WALK.y1 + 2.4) * 2) / 2;
const GATE_POOLS: Pt[][] = GATES.map((gx) => [[gx - GATE_W, GATE_Y1], [gx + GATE_W, GATE_Y1], [gx + 3.4, GATE_Y1 + 1.2], [gx + 2.6, GATE_Y1 + 2.4], [gx + 0.8, GATE_Y1 + 3], [gx - 1, GATE_Y1 + 2.9], [gx - 2.7, GATE_Y1 + 2.2], [gx - 3.3, GATE_Y1 + 1.1]]);
/** 12 · A Caverna Sagrada (a boca, no meio das pedras). */
const CAVE = { x: 34, y: 269 };
/** 13 · A várzea (o alagado embaixo da barragem). */
const VARZEA = smooth([[140, 256], [200, 255], [260, 256], [318, 258], [338, 272], [334, 300], [312, 316], [250, 317], [180, 316], [142, 304], [134, 280]], 2, true, 0.6);
/** O brejo do sudoeste (o de antes, maior). */
const BREJO = blob(18, 104, 15, 24, 0.12);
/** A barreira da saída para Santo Amaro (fechada até o Mapa 03 existir). */
const EAST_GATE: Rect = { x0: 393, x1: 393.6, y0: 225, y1: 235 };

const chao: Shape[] = [];
const cenario: Shape[] = [];
const colisao: Shape[] = [];
const seguro: Shape[] = [];
const areas: Shape[] = [];
const pontos: Shape[] = [];
const saidas: Shape[] = [];
const monstros: Shape[] = [];

// ---------------- conferências da água e dos caminhos ----------------
// (num mapa deste tamanho, as contas de "é água?" e "quão longe da estrada?" rodam milhões de vezes: o polígono da
// represa fica em faixas de 1 m de altura e as linhas compridas numa grade de 4 m, para olhar só o que está perto)
/** Ponto dentro de um polígono grande, rápido: cada faixa de 1 m de altura guarda só as arestas que passam por ela. */
function fastInside(pts: Pt[]): (x: number, y: number) => boolean {
  const n = pts.length;
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1])));
  const y1 = Math.floor(Math.max(...pts.map((p) => p[1])));
  const bands: number[][] = Array.from({ length: y1 - y0 + 1 }, () => []);
  for (let i = 0; i < n; i++) {
    const [a, b] = [pts[i]!, pts[(i + n - 1) % n]!];
    for (let k = Math.floor(Math.min(a[1], b[1])) - y0; k <= Math.floor(Math.max(a[1], b[1])) - y0; k++) bands[k]!.push(i);
  }
  return (x, y) => {
    const band = bands[Math.floor(y) - y0];
    if (!band) return false;
    let c = false;
    for (const i of band) {
      const [a, b] = [pts[i]!, pts[(i + n - 1) % n]!];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
}
/** A menor distância até uma linha comprida, rápida: só os trechos da grade em volta (até `max`; mais longe, `max`). */
function fastDist(pts: Pt[], closed: boolean): (x: number, y: number, max?: number) => number {
  const CELL = 4;
  const grid = new Map<string, number[]>();
  const n = pts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const [a, b] = [pts[i]!, pts[(i + 1) % n]!];
    for (let gx = Math.floor(Math.min(a[0], b[0]) / CELL); gx <= Math.floor(Math.max(a[0], b[0]) / CELL); gx++) {
      for (let gy = Math.floor(Math.min(a[1], b[1]) / CELL); gy <= Math.floor(Math.max(a[1], b[1]) / CELL); gy++) {
        const k = `${gx},${gy}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push(i);
      }
    }
  }
  return (x, y, max = 12) => {
    let best = max;
    for (let gx = Math.floor((x - max) / CELL); gx <= Math.floor((x + max) / CELL); gx++) {
      for (let gy = Math.floor((y - max) / CELL); gy <= Math.floor((y + max) / CELL); gy++) {
        for (const i of grid.get(`${gx},${gy}`) ?? []) {
          const [a, b] = [pts[i]!, pts[(i + 1) % n]!];
          const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
          const L = dx * dx + dy * dy;
          const t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0;
          best = Math.min(best, Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t)));
        }
      }
    }
    return best;
  };
}
const boxOfPts = (pts: Pt[], pad: number): Rect => ({
  x0: Math.min(...pts.map((p) => p[0])) - pad,
  x1: Math.max(...pts.map((p) => p[0])) + pad,
  y0: Math.min(...pts.map((p) => p[1])) - pad,
  y1: Math.max(...pts.map((p) => p[1])) + pad,
});
const inWaterPoly = fastInside(WATER);
const shoreDist = fastDist(SHORE, true);
const roadDist = fastDist(ROAD, false);
const trailDists: [(x: number, y: number, max?: number) => number, number][] = [[fastDist(PATH, false), PATH_W], ...TRAILS.map(([t, w]) => [fastDist(t, false), w] as [(x: number, y: number, max?: number) => number, number])];
const ISLANDS: [Pt[], Rect][] = [ISLAND, ISLAND_SMALL].map((p) => [p, boxOfPts(p, 0)]);
const onIsland = (x: number, y: number) => ISLANDS.some(([p, b]) => inRect(x, y, b) && inside(x, y, p));
const CREEK_BOX = boxOfPts(CREEK, CREEK_W);
const CHANNEL_BOXES: [Pt[], Rect][] = CHANNELS.map((c) => [c, boxOfPts(c, CHANNEL_W)]);
const SMALL_WATERS: [Pt[], Rect][] = [...PONDS, ...BREJO_POOLS, FALL_POOL, ...GATE_POOLS].map((p) => [p, boxOfPts(p, 0)]);
/** Água de verdade (o pé não entra): a represa (menos as ilhas e os deques), o riacho, os canais, as lagoas e as poças. */
function isWater(x: number, y: number): boolean {
  if (onDeck(x, y)) return false;
  if (inWaterPoly(x, y)) return !onIsland(x, y);
  // (o riacho passa por baixo da estrada)
  if (inRect(x, y, CREEK_BOX) && distToPath(x, y, CREEK) < CREEK_W / 2 && roadDist(x, y) > ROAD_HALF + 0.2) return true;
  if (CHANNEL_BOXES.some(([c, b]) => inRect(x, y, b) && distToPath(x, y, c) < CHANNEL_W / 2)) return true;
  if (SMALL_WATERS.some(([p, b]) => inRect(x, y, b) && inside(x, y, p))) return true;
  return inRect(x, y, POOL);
}
/** Quanto falta até a beira da represa (negativo dentro dela; até 12 m). */
const shoreGap = (x: number, y: number) => (inWaterPoly(x, y) ? -1 : 1) * shoreDist(x, y);
const CLOSED_SMALL = SMALL_WATERS.map(([p, b]) => [[...p, p[0]!], b] as [Pt[], Rect]);
/** Quanto falta até a água mais perto (qualquer uma), aproximado: a da represa pela beira; as outras pela linha. */
function waterGap(x: number, y: number): number {
  let g = shoreGap(x, y);
  if (inRect(x, y, CREEK_BOX, 12)) g = Math.min(g, distToPath(x, y, CREEK) - CREEK_W / 2);
  for (const [c, b] of CHANNEL_BOXES) if (inRect(x, y, b, 12)) g = Math.min(g, distToPath(x, y, c) - CHANNEL_W / 2);
  for (const [p, b] of CLOSED_SMALL) if (inRect(x, y, b, 12)) g = Math.min(g, inside(x, y, p) ? -1 : distToPath(x, y, p));
  return Math.min(g, inRect(x, y, POOL) ? -1 : rectGap(x, y, POOL));
}
const roadGap = (x: number, y: number) => roadDist(x, y, 20) - ROAD_HALF;
const pathGap = (x: number, y: number) => trailDists[0]![0](x, y, 20) - PATH_W / 2;
const trailGap = (x: number, y: number) => {
  let g = 20;
  for (const [d, w] of trailDists) g = Math.min(g, d(x, y, 20) - w / 2);
  return g;
};
const inVarzea = fastInside(VARZEA);

// ---------------- chão ----------------
chao.push(rect('mata', 0, W, 0, H));
// a orla de antes (a parte de cima da represa, do outro lado da estrada): grama alta onde era a avenida da beira
chao.push(area('grama', [[44, 22], [122, 22], [122, 40], [44, 40]]));
// a beira da água: um pouco de lama, por baixo da água
chao.push(line('lama', SHORE, { largura: 3.2 }));
// o brejo de antes e o do sudoeste, maior, com as poças
chao.push(area('lama', blob(20, 87, 17, 10, 0.12)));
chao.push(area('lama', BREJO, undefined, 'Brejo do Sul'));
// a comunidade (terra batida) e a praça do Brejo Maior; o campinho; a praça em ruínas; o pátio do clube
chao.push(area('terra', COMMUNITY, undefined, 'Comunidade da Represa'));
chao.push(rect('praca', PLAZA.x0, PLAZA.x1, PLAZA.y0, PLAZA.y1, { desenho: 'ondas', musgo: true }, 'Brejo Maior'));
chao.push(area('lama', blob(186, 37, 9, 5.5, 0.15)));
chao.push(rect('campinho', FIELD.x0, FIELD.x1, FIELD.y0, FIELD.y1, { linhas: true }, 'Campinho'));
chao.push(rect('praca', SQUARE.x0, SQUARE.x1, SQUARE.y0, SQUARE.y1, { desenho: 'ondas', musgo: true }, 'Praça em Ruínas'));
chao.push(rect('calcada', CLUB.x0, CLUB.x1, CLUB.y0, CLUB.y1, { estado: 'rachado', musgo: true }, 'Clube Náutico'));
// a várzea: o alagado (lama) com manchas de grama alta
chao.push(area('lama', VARZEA, undefined, 'Várzea de Caça'));
{
  const grng = mulberry32(SEED + 21);
  for (let i = 0; i < 9; i++) {
    const [x, y] = [150 + grng() * 175, 262 + grng() * 48];
    if (!inVarzea(x, y)) continue;
    chao.push(area('grama', blob(round(x), round(y), round(5 + grng() * 7), round(3 + grng() * 4), 0.18)));
  }
}
// a água: a represa, as ilhas, o riacho, os canais, as lagoas, as poças e a piscina
chao.push(area('agua', WATER, { cor: '#2f6f6a' }, 'Represa de Guarapiranga'));
chao.push(area('grama', ISLAND_SMALL, undefined, 'Ilhota'));
chao.push(area('grama', ISLAND, undefined, 'Ilha do Véu'));
chao.push(line('agua', CREEK, { largura: CREEK_W, cor: '#2f6f6a' }));
for (const c of CHANNELS) chao.push(line('agua', c, { largura: CHANNEL_W, cor: '#2f6f6a' }));
for (const p of PONDS) chao.push(area('agua', p, { cor: '#35706a' }));
for (const p of BREJO_POOLS) chao.push(area('agua', p, { cor: '#3a6a58' }));
chao.push(area('agua', FALL_POOL, { cor: '#2f6f6a' }));
for (const p of GATE_POOLS) chao.push(area('agua', p, { cor: '#2f6f6a' }));
chao.push(area('agua', POOL_PTS, { cor: '#4f7f5a' }));
// o caminho de pedra em cima da barragem
chao.push(rect('calcada', DAM_WALK.x0, DAM_WALK.x1, DAM_WALK.y0, DAM_WALK.y1, { estado: 'rachado', musgo: true }, 'A Barragem'));
// a estrada (asfalto rachado, com a calçada tomada pelo mato), o caminho de terra até o píer e as trilhas novas
chao.push(line('calcada', ROAD, { largura: ROAD_W + 2 * SIDEWALK }));
chao.push(line('asfalto', ROAD, { largura: ROAD_W, estado: 'rachado', nome: "Estrada do M'Boi Mirim" }));
chao.push(line('trilha', PATH, { largura: PATH_W, nome: 'Caminho da Represa' }));
for (const [t, w, nome] of TRAILS) chao.push(line('trilha', t, { largura: w, ...(nome ? { nome } : {}) }));
// a boca da caverna: o chão escuro entre as pedras
chao.push(area('terra', blob(CAVE.x, CAVE.y + 1, 5, 3, 0.1), { cor: '#211812' }));
{
  // o trecho de antes: os mesmos detalhes do asfalto (o mesmo sorteio)
  const srng = mulberry32(SEED + 9);
  const roadDetails = (part: Pt[], rng: () => number, cracks: number) => {
    const onAsphalt = (x: number, y: number) => distToPath(x, y, part) < ROAD_W / 2 - 0.3;
    for (let i = 0, n = 0; i < cracks * 40 && n < cracks; i++) {
      const k = Math.floor(rng() * (part.length - 1));
      const [ax, ay] = part[k]!;
      let [x, y] = [ax + (rng() - 0.5) * ROAD_W, ay + (rng() - 0.5) * ROAD_W];
      if (!onAsphalt(x, y)) continue;
      const pts: Pt[] = [[x, y]];
      let a = rng() * Math.PI * 2;
      for (let j = 0; j < 3 + Math.floor(rng() * 4); j++) {
        a += (rng() - 0.5) * 1.6;
        const l = 0.5 + rng() * 1;
        const [nx, ny] = [x + Math.cos(a) * l, y + Math.sin(a) * l];
        if (!onAsphalt(nx, ny)) break;
        [x, y] = [nx, ny];
        pts.push([x, y]);
      }
      if (pts.length < 3) continue;
      chao.push(line('rachadura', pts, { largura: 0.06, cor: '#1e2022', mato: rng() < 0.7 }));
      n++;
    }
  };
  // a faixa amarela do meio, tracejada e quase apagada (na estrada inteira)
  chao.push(line('faixa-rua', ROAD, { cor: '#c9a640', largura: 0.12, tracejada: true, apagada: true }));
  roadDetails(ROAD_OLD, srng, 16);
  // os buracos com água de chuva e o capim nas frestas e na beira do asfalto
  for (const [x, y, raio] of [[21.2, 10.6, 0.5], [31.8, 20.6, 0.42], [41.6, 24.4, 0.55]] as const) chao.push(point('buraco', x, y, { raio, agua: true }));
  const grassAlong = (part: Pt[], rng: () => number, count: number) => {
    for (let i = 0, n = 0; i < count * 10 && n < count; i++) {
      const k = Math.floor(rng() * (part.length - 1));
      const [ax, ay] = part[k]!;
      const [x, y] = [ax + (rng() - 0.5) * (ROAD_W + 1.6), ay + (rng() - 0.5) * (ROAD_W + 1.6)];
      if (distToPath(x, y, part) > ROAD_HALF - 0.2) continue;
      chao.push(point('planta', x, y, { tipo: 'capim', raio: round(0.18 + rng() * 0.18) }));
      n++;
    }
  };
  grassAlong(ROAD_OLD, srng, 40);
  // as raízes das árvores da beira entrando no asfalto (baixas: o pé passa por cima)
  for (const [x0, y0, x1, y1] of [[17.6, 6.2, 19.4, 7.4], [24.6, 15.2, 26.4, 14.2], [36.2, 25.6, 37.6, 24.2], [44.4, 22.2, 45.6, 23.8]] as const) {
    chao.push(line('raiz', [[x0, y0], [(x0 + x1) / 2 + 0.2, (y0 + y1) / 2 - 0.15], [x1, y1]], { largura: 0.22, altura: 0.12, cor: '#6b4a2e' }));
  }
  // o trecho novo (da orla até a saída): rachaduras, buracos e capim, com outro sorteio
  const nrng = mulberry32(SEED + 19);
  const ROAD_NEW = ROAD.filter(([x]) => x > 48);
  roadDetails(ROAD_NEW, nrng, 70);
  grassAlong(ROAD_NEW, nrng, 160);
  for (let i = 0, n = 0; i < 400 && n < 12; i++) {
    const k = Math.floor(nrng() * (ROAD_NEW.length - 1));
    const [ax, ay] = ROAD_NEW[k]!;
    const [x, y] = [ax + (nrng() - 0.5) * (ROAD_W - 1.4), ay + (nrng() - 0.5) * (ROAD_W - 1.4)];
    if (distToPath(x, y, ROAD_NEW) > ROAD_W / 2 - 0.8) continue;
    chao.push(point('buraco', round(x), round(y), { raio: round(0.4 + nrng() * 0.2), agua: nrng() < 0.6 }));
    n++;
  }
}

// ---------------- a vista da câmera ----------------
/**
 * Pontos que a câmera precisa ver livres: a estrada, os caminhos, os deques e os lugares (as praças, o campinho, o
 * clube, a barragem, o mirante, a boca da caverna). A câmera olha do sudeste: uma copa alta mais ao sul ou a leste
 * "sobe" na tela e cobre o que está atrás dela. (Num mapa deste tamanho, os pontos ficam numa grade, por perto.)
 */
const VIEW_KEYS: Pt[] = [...pathPoints(ROAD, ROAD_W + 2 * SIDEWALK, 2), ...pathPoints(PATH, PATH_W)];
for (const [t, w] of TRAILS) VIEW_KEYS.push(...pathPoints(t, w, 1.5));
for (const [r] of DECKS) VIEW_KEYS.push(...rectPoints(r));
for (const r of [PLAZA, FIELD, SQUARE, CLUB, DAM_WALK, LOOKOUT]) VIEW_KEYS.push(...rectPoints(r, 2));
VIEW_KEYS.push(...rectPoints({ x0: CAVE.x - 4, x1: CAVE.x + 4, y0: CAVE.y - 2, y1: CAVE.y + 4 }));
// a cachoeira e o poço dela aparecem inteiros
VIEW_KEYS.push(...rectPoints({ x0: FALL.x0, x1: FALL.x1, y0: FALL.y0, y1: FALL.y1 + 4 }, 1.5));
const KEY_CELL = 8;
const keyGrid = new Map<string, Pt[]>();
for (const k of VIEW_KEYS) {
  const c = `${Math.floor(k[0] / KEY_CELL)},${Math.floor(k[1] / KEY_CELL)}`;
  if (!keyGrid.has(c)) keyGrid.set(c, []);
  keyGrid.get(c)!.push(k);
}
/** Uma copa neste lugar (raio, altura) tampa na tela algum ponto que precisa aparecer? (só olha os pontos por perto) */
function hidesView(x: number, y: number, copa: number, altura: number): boolean {
  const reach = altura + copa + 2;
  for (let i = Math.floor((x - reach) / KEY_CELL); i <= Math.floor((x + copa + 2) / KEY_CELL); i++) {
    for (let j = Math.floor((y - reach) / KEY_CELL); j <= Math.floor((y + copa + 2) / KEY_CELL); j++) {
      for (const [kx, ky] of keyGrid.get(`${i},${j}`) ?? []) if (covers(x, y, copa, altura, kx, ky)) return true;
    }
  }
  return false;
}

// ---------------- cenário ----------------
interface Trunk {
  x: number;
  y: number;
  r: number;
}
/** Tudo que tem tronco (ou é sólido e redondo), numa grade, para a folga entre eles. */
const TRUNK_CELL = 6;
const trunkGrid = new Map<string, Trunk[]>();
const trunks: Trunk[] = [];
function addTrunk(t: Trunk): void {
  trunks.push(t);
  const c = `${Math.floor(t.x / TRUNK_CELL)},${Math.floor(t.y / TRUNK_CELL)}`;
  if (!trunkGrid.has(c)) trunkGrid.set(c, []);
  trunkGrid.get(c)!.push(t);
}
function nearTrunks(x: number, y: number, reach: number): Trunk[] {
  const out: Trunk[] = [];
  for (let i = Math.floor((x - reach) / TRUNK_CELL); i <= Math.floor((x + reach) / TRUNK_CELL); i++) {
    for (let j = Math.floor((y - reach) / TRUNK_CELL); j <= Math.floor((y + reach) / TRUNK_CELL); j++) out.push(...(trunkGrid.get(`${i},${j}`) ?? []));
  }
  return out;
}
const SPECIES: Record<string, { tronco: number; copa: number; altura: number }> = {
  jeriva: { tronco: 0.3, copa: 2, altura: 7 },
  embauba: { tronco: 0.35, copa: 2.2, altura: 7 },
  seca: { tronco: 0.4, copa: 1.4, altura: 6 },
  xaxim: { tronco: 0.3, copa: 1.2, altura: 2.5 },
  bananeira: { tronco: 0.35, copa: 1.5, altura: 3.5 },
};
const treeDims = (especie: string, rng: () => number) =>
  SPECIES[especie] ?? { tronco: round(0.4 + rng() * 0.25), copa: round(1.7 + rng() * 1.2), altura: round(5 + rng() * 3.5) };
/** As clareiras: lugares sem árvore sorteada (as praças, o campinho, o clube, a barragem, a várzea, o mirante...). */
const CLEARINGS: ((x: number, y: number) => boolean)[] = [
  (x, y) => inside(x, y, COMMUNITY),
  (x, y) => inRect(x, y, FIELD, 3),
  (x, y) => inRect(x, y, SQUARE, 3),
  (x, y) => inRect(x, y, CLUB, 2.5),
  (x, y) => inRect(x, y, DAM_WALK, 3),
  (x, y) => inRect(x, y, DAM_HOUSE, 4),
  (x, y) => inVarzea(x, y),
  (x, y) => dist(x, y, (LOOKOUT.x0 + LOOKOUT.x1) / 2, (LOOKOUT.y0 + LOOKOUT.y1) / 2) < 7,
  (x, y) => dist(x, y, CAVE.x, CAVE.y) < 11,
  (x, y) => inRect(x, y, FALL, 3),
  // (a frente da cachoeira, do lado da câmera: árvore ali tampava a queda)
  (x, y) => x > FALL.x0 - 6 && x < FALL.x1 + 6 && y > FALL.y0 && y < FALL.y1 + 12,
  (x, y) => inRect(x, y, EAST_GATE, 6),
  (x, y) => inRect(x, y, BUS_STOP, 1.5),
  (x, y) => onIsland(x, y),
];
/** Cabe uma árvore aqui? Longe da água, da estrada, das trilhas e das clareiras, com folga dos outros troncos. */
function treeFits(x: number, y: number, tronco: number, copa: number, gap: number, nearWater = false): boolean {
  if (x < 1 || x > W - 1 || y < 1 || y > H - 1) return false;
  const wg = waterGap(x, y);
  // (a borda do tronco a mais de 1,6 m da beira: com as faixas de água de 0,5 m, o vão nunca fica de 0,3 a 1,2 m)
  if (wg < tronco / 2 + 1.6 || (!nearWater && wg < tronco / 2 + 2.2)) return false;
  if (roadGap(x, y) < copa * 0.5 + 2.2 || trailGap(x, y) < copa * 0.5 + 1.6) return false;
  if (CLEARINGS.some((f) => f(x, y))) return false;
  return nearTrunks(x, y, gap + 2).every((t) => dist(x, y, t.x, t.y) - t.r - tronco / 2 >= gap);
}
function plant(x: number, y: number, especie: string, d: { tronco: number; copa: number; altura: number }, gap: number, nearWater = false): boolean {
  if (!treeFits(x, y, d.tronco, d.copa, gap, nearWater) || hidesView(x, y, d.copa, d.altura)) return false;
  addTrunk({ x, y, r: d.tronco / 2 });
  cenario.push(point('arvore', x, y, { especie, ...d }));
  return true;
}
/** Uma árvore posta à mão numa clareira (a sombra da praça): confere a folga dos troncos e a vista. */
function plantHere(x: number, y: number, d: { tronco: number; copa: number; altura: number }): boolean {
  if (nearTrunks(x, y, 6).some((t) => dist(x, y, t.x, t.y) - t.r - d.tronco / 2 < TRUNK_GAP + 1)) return false;
  if (hidesView(x, y, d.copa, d.altura)) return false;
  addTrunk({ x, y, r: d.tronco / 2 });
  cenario.push(point('arvore', x, y, { especie: 'mata', ...d }));
  return true;
}

// ----- a chegada: o ponto de ônibus, as placas e os postes da estrada (iguais) -----
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
addTrunk({ x: (BUS_STOP.x0 + BUS_STOP.x1) / 2, y: (BUS_STOP.y0 + BUS_STOP.y1) / 2, r: 0.7 });
// as placas ficam na beira da calçada
// (a do GUARAPIRANGA fica mais para o sul: perto da chegada, na tela ela ficava na frente de quem chega do Capão)
const SIGNS: Pt[] = [];
for (const [tx, ty, texto, seta] of [[23.6, 16.4, 'GUARAPIRANGA', 'sul'], [34.6, 28.4, 'REFÚGIO', 'sul'], [228, 56, 'CAMPINHO', 'norte'], [332, 67.5, 'PRAÇA', 'norte'], [292, 68.2, 'CLUBE NÁUTICO', 'sul'], [388, 224.6, 'SANTO AMARO', 'leste']] as const) {
  const [x, y] = roadside(tx, ty, ROAD_HALF + 0.12);
  cenario.push(point('placa', x, y, { texto, seta, poste: true }));
  addTrunk({ x, y, r: 0.1 });
  SIGNS.push([x, y]);
}
/** Postes de concreto na beira norte da estrada (a luz já não acende: só os do Refúgio e da comunidade têm luz). */
const POSTS: Pt[] = [[24.6, 4.2], [26.4, 13.4], [33.6, 18.6], [43.2, 21]].map(([x, y]) => roadside(x!, y!, ROAD_HALF + 0.17));
for (const [x, y] of POSTS) {
  cenario.push(point('poste', x, y, { altura: 7, apagado: true, cipo: true }));
  addTrunk({ x, y, r: 0.15 });
}
cenario.push(line('fiacao', POSTS, { altura: 6.6, cipo: true }));
{
  // a fiação continua pela orla, do lado de fora da curva (o norte e o leste), com um poste a cada ~28 m
  const posts: Pt[] = [];
  for (const [x, y] of [[126, 26], [146, 38], [170, 48], [196, 52], [222, 53], [250, 53], [276, 54], [304, 57], [334, 64], [358, 82], [372, 108], [373, 136], [372, 164], [372, 192]] as const) {
    const [px, py] = roadside(x, y, ROAD_HALF + 0.17);
    if (posts.some(([qx, qy]) => dist(px, py, qx, qy) < 12) || SIGNS.some(([qx, qy]) => dist(px, py, qx, qy) < 3)) continue;
    posts.push([px, py]);
    cenario.push(point('poste', px, py, { altura: 7, apagado: true, cipo: true }));
    addTrunk({ x: px, y: py, r: 0.15 });
  }
  cenario.push(line('fiacao', posts, { altura: 6.6, cipo: true }));
}
// a saída para Santo Amaro, fechada até o Mapa 03 existir: a barreira de concreto atravessada na estrada
cenario.push(box('barreira', EAST_GATE, { altura: 1.1 }, 'Saída para Santo Amaro (fechada)'));

// ----- o Refúgio (igual) -----
const vrng = mulberry32(SEED + 5);
for (const [r, name] of DECKS.slice(0, 4)) cenario.push(box('deque', r, { altura: 0.6, palafitas: true }, name));
for (const h of HOUSES) {
  // (com gente morando: de noite a luz sai pela porta e pelas janelas abertas; o cipó sobe pelas quinas)
  const gente: Record<string, string> = h.extra && h.extra.comercio ? {} : { morador: 'familia' };
  cenario.push(box('casa', h, { altura: HOUSE_H, andares: 1, cor: h.cor, material: 'tabua', telhado: 'zinco', palafita: true, cipo: 0.3, ...gente, ...h.extra }, h.name));
}
// as redes de pesca secando e os varais de roupa, na beirada do deque (de costas para a água, sem fechar caminho)
const LINES: [string, number, number, number, number][] = [
  ['rede', 52.2, 54.3, 45.0, 45.25], // no beco entre a casa azul e a quitanda, encostada na beirada do fundo
  ['rede', 60.3, 63.2, 65.6, 65.85], // na beirada sul do deque sudeste, do lado da casa rosa
  ['varal', 47.3, 50.4, 59.6, 59.85], // na beirada sul da praça, entre o píer e o atracadouro
  ['varal', 60.0, 60.25, 61.2, 64.3], // na beirada oeste do deque sudeste, de frente para a casa rosa
];
for (const [type, x0, x1, y0, y1] of LINES) cenario.push(rect(type, x0, x1, y0, y1, { altura: type === 'rede' ? 1.8 : 1.9 }));
// a fogueira da praça, com os bancos em volta virados para o fogo
const benchesAround = (fx: number, fy: number) => {
  cenario.push(point('fogueira', fx, fy, { raio: 0.6, luz: '#ffb347' }));
  const B: [number, number, number, number, number][] = [
    [fx - 0.8, fx + 0.8, fy - 2.85, fy - 2.35, 90],
    [fx - 0.8, fx + 0.8, fy + 2.35, fy + 2.85, 270],
    [fx - 2.85, fx - 2.35, fy - 0.8, fy + 0.8, 0],
    [fx + 2.35, fx + 2.85, fy - 0.8, fy + 0.8, 180],
  ];
  for (const [x0, x1, y0, y1, olhando] of B) cenario.push(rect('banco', x0, x1, y0, y1, { olhando, material: 'tabua' }));
};
benchesAround(FIRE.x, FIRE.y);
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
// a banca de frutas da Dona Iracema, colada na parede da quitanda, com ela no miolo (o corpo dela, 0,6 × 0,4, cabe lá)
{
  const shop = HOUSES.find((h) => h.extra && h.extra.comercio === 'quitanda')!;
  const [ix0, ix1] = [BANCA.x0 + BANCA.lados, BANCA.x1 - BANCA.lados];
  if (Math.abs(BANCA.y0 - shop.y1) > 1e-9 || BANCA.x0 < shop.x0 || BANCA.x1 > shop.x1) throw new Error('A banca da Dona Iracema tem que ficar colada na frente da quitanda.');
  if (IRACEMA.x - 0.3 < ix0 || IRACEMA.x + 0.3 > ix1 || IRACEMA.y - 0.4 < BANCA.y0 || IRACEMA.y > BANCA.y1 - BANCA.frente) throw new Error('A Dona Iracema não cabe no miolo da banca.');
  // (sem nome: o nome vira rótulo na janela do M, e lá já tem o da quitanda)
  cenario.push(box('banca-frutas', BANCA, { altura: 0.9, frente: BANCA.frente, lados: BANCA.lados, pano: '#e2552f' }));
}
// os barcos atracados (o do Barqueiro é a voadeira), e uns afundados na represa
const BOATS: [number, number, number, number, Record<string, string | number | boolean>][] = [
  [47.6, 52.2, 63.8, 65.3, { tipo: 'voadeira', cor: '#d9d2c3', olhando: 0 }],
  [69.4, 70.6, 45.4, 49.4, { tipo: 'canoa', cor: '#3f7fbf', olhando: 90 }],
  [53.6, 57.6, 60.5, 61.6, { tipo: 'canoa', cor: '#c9774a', olhando: 180 }],
  [69.4, 70.6, 60.6, 64.6, { tipo: 'canoa', cor: '#4f9f5f', olhando: 270 }],
  [79, 83, 47.5, 48.9, { tipo: 'canoa', afundado: true }],
  [97, 101.5, 61, 62.6, { tipo: 'voadeira', afundado: true }],
  [72, 76, 83, 84.4, { tipo: 'canoa', afundado: true }],
  // os novos: perto do clube e no meio da represa
  [306, 310.5, 110, 111.6, { tipo: 'voadeira', afundado: true }],
  [140, 144, 120, 121.4, { tipo: 'canoa', afundado: true }],
  [250, 254, 200, 201.4, { tipo: 'canoa', afundado: true }],
];
for (const [x0, x1, y0, y1, props] of BOATS) cenario.push(rect('barco', x0, x1, y0, y1, props));
// taboas e aguapés na água rasa, longe do píer e do deque (os de antes, com o mesmo sorteio, e os da represa nova)
for (let i = 0, n = 0; i < 600 && n < 16; i++) {
  const s = Math.floor(vrng() * (SHORE_OLD.length - 1));
  const [x, y] = SHORE_OLD[s]!;
  const [dx, dy] = [SHORE_OLD[s + 1]![0] - x, SHORE_OLD[s + 1]![1] - y];
  const l = Math.hypot(dx, dy) || 1;
  const off = 0.5 + vrng() * 0.8;
  const [px, py] = [x + (-dy / l) * off, y + (dx / l) * off];
  if (!isWater(px, py) || DECKS.some(([r]) => rectGap(px, py, r) < 2.5) || px > 79) continue;
  cenario.push(point('planta', px, py, { tipo: 'taboa', raio: round(0.4 + vrng() * 0.2) }));
  n++;
}
for (let i = 0, n = 0; i < 400 && n < 14; i++) {
  const [x, y] = [42 + vrng() * 40, 34 + vrng() * 50];
  if (!isWater(x, y) || DECKS.some(([r]) => rectGap(x, y, r) < 2) || shoreGap(x, y) > -1.5) continue;
  cenario.push(point('aguape', x, y, { raio: round(0.5 + vrng() * 0.5) }));
  n++;
}
{
  const wrng = mulberry32(SEED + 22);
  const NEW_SHORE = [...SHORE_SW, ...SHORE_E];
  for (let i = 0, n = 0; i < 3000 && n < 60; i++) {
    const s = Math.floor(wrng() * (NEW_SHORE.length - 1));
    const [x, y] = NEW_SHORE[s]!;
    const [px, py] = [x + (wrng() - 0.5) * 6, y + (wrng() - 0.5) * 6];
    if (!isWater(px, py) || shoreGap(px, py) > -0.6 || shoreGap(px, py) < -4 || DECKS.some(([r]) => rectGap(px, py, r) < 3)) continue;
    cenario.push(point('planta', round(px), round(py), { tipo: 'taboa', raio: round(0.4 + wrng() * 0.25) }));
    n++;
  }
  for (let i = 0, n = 0; i < 3000 && n < 50; i++) {
    const [x, y] = [60 + wrng() * 270, 40 + wrng() * 205];
    if (!isWater(x, y) || shoreGap(x, y) > -2 || DECKS.some(([r]) => rectGap(x, y, r) < 3)) continue;
    cenario.push(point('aguape', round(x), round(y), { raio: round(0.5 + wrng() * 0.6) }));
    n++;
  }
  // nas lagoas da várzea e nas poças do brejo
  for (const p of [...PONDS, ...BREJO_POOLS]) {
    for (let k = 0; k < 7; k++) {
      const q = p[Math.floor(wrng() * p.length)]!;
      const c = p.reduce((a, b) => [a[0] + b[0] / p.length, a[1] + b[1] / p.length] as Pt, [0, 0] as Pt);
      const f = 0.55 + wrng() * 0.35;
      const [x, y] = [c[0] + (q[0] - c[0]) * f, c[1] + (q[1] - c[1]) * f];
      cenario.push(point(wrng() < 0.5 ? 'aguape' : 'planta', round(x), round(y), wrng() < 0.5 ? { raio: round(0.5 + wrng() * 0.4) } : { tipo: 'taboa', raio: round(0.4 + wrng() * 0.2) }));
    }
  }
}

// ----- 2 · o mirante: a plataforma de madeira na beira do parque -----
cenario.push(box('deque', LOOKOUT, { altura: 0.6, palafitas: true }, 'Mirante'));
for (const [x, y] of [[LOOKOUT.x0 + 0.3, LOOKOUT.y1 - 0.3], [LOOKOUT.x1 - 0.3, LOOKOUT.y1 - 0.3]] as const) cenario.push(point('poste-praca', x, y, { altura: 3, luz: '#ffd36b', estilo: 'lampiao' }));
cenario.push(point('placa', LOOKOUT.x1 + 0.6, LOOKOUT.y0 + 0.6, { texto: 'MIRANTE', seta: 'leste', poste: true }));
addTrunk({ x: LOOKOUT.x1 + 0.6, y: LOOKOUT.y0 + 0.6, r: 0.1 });

// ----- 4 · a comunidade da represa: as casas de bloco e a praça do Brejo Maior -----
{
  const hrng = mulberry32(SEED + 23);
  const CORES = ['#c9774a', '#e2a3b8', '#79a9d1', '#e8c75a', '#b9673f', '#8fc08a', '#c46aa8', '#d8d2c4'];
  const houses: Rect[] = [];
  // a fileira de cima (a frente para o sul, para a rua de terra) e umas casas soltas mais embaixo
  for (let x0 = 127; x0 + 6.5 <= 205; ) {
    const w = round(6 + hrng() * 1.6);
    houses.push({ x0, x1: round(x0 + w), y0: round(4.5 + hrng() * 1.5), y1: 12.5 });
    x0 = round(x0 + w + (hrng() < 0.3 ? 2.2 : 0));
  }
  for (const [x0, y0] of [[180, 20], [188, 20], [196, 20], [128, 20]] as const) houses.push({ x0, x1: x0 + 6.5, y0, y1: y0 + 6.5 });
  for (const h of houses) {
    const andares = hrng() < 0.4 ? 2 : 1;
    cenario.push(rect('casa', h.x0, h.x1, h.y0, h.y1, { altura: andares === 2 ? 5.8 : 3.2, andares, cor: CORES[Math.floor(hrng() * CORES.length)]!, caixaDagua: true, cipo: round(0.2 + hrng() * 0.4), morador: 'familia' }));
  }
  // a praça do Brejo Maior: a fogueira com os bancos, as barracas (as bancas dos artesãos e dos pescadores), os lampiões
  // e as bandeirinhas
  benchesAround(PLAZA_FIRE.x, PLAZA_FIRE.y);
  for (const [x0, pano] of [[148.5, '#3f7fbf'], [156.7, '#e8c75a'], [164.9, '#4f9f5f']] as const) {
    cenario.push(box('banca-frutas', { x0, x1: x0 + 2.6, y0: 26.5, y1: 27.75 }, { altura: 0.9, frente: 0.5, lados: 0.3, pano }));
  }
  const corners: Pt[] = [[PLAZA.x0 + 0.6, PLAZA.y0 + 0.6], [PLAZA.x1 - 0.6, PLAZA.y0 + 0.6], [PLAZA.x1 - 0.6, PLAZA.y1 - 0.6], [PLAZA.x0 + 0.6, PLAZA.y1 - 0.6]];
  for (const [x, y] of corners) cenario.push(point('poste-praca', x, y, { altura: 3.2, luz: '#ffd36b', estilo: 'lampiao' }));
  cenario.push(line('bandeirinhas', [corners[0]!, [PLAZA_FIRE.x, PLAZA_FIRE.y - 1], corners[1]!], { altura: 3.1 }));
  cenario.push(line('bandeirinhas', [corners[3]!, [PLAZA_FIRE.x, PLAZA_FIRE.y + 2], corners[2]!], { altura: 3.1 }));
  // (três árvores de sombra em volta da praça, nos primeiros lugares da lista que não tampam a vista)
  let shade = 0;
  for (const [x, y] of [[142, 24], [174, 30], [143, 44], [172, 23], [146, 21.5], [176, 38], [140, 32]] as const) {
    if (shade < 3 && plantHere(x, y, { tronco: 0.5, copa: 2.6, altura: 7 })) shade++;
  }
  if (shade < 2) throw new Error('Sem sombra na praça do Brejo Maior.');
  for (let i = 0, n = 0; i < 200 && n < 6; i++) {
    const [x, y] = [180 + hrng() * 14, 33 + hrng() * 9];
    if (inside(x, y, blob(186, 37, 9, 5.5, 0.15))) {
      chao.push(point('planta', round(x), round(y), { tipo: 'taboa', raio: round(0.4 + hrng() * 0.2) }));
      n++;
    }
  }
}

// ----- 5 · o campinho, com as traves enferrujadas -----
{
  const midY = (FIELD.y0 + FIELD.y1) / 2;
  const TRAVE = { altura: 2, ferrugem: true, cipo: true, rede: 'rasgada' };
  cenario.push(rect('trave', FIELD.x0 + 0.2, FIELD.x0 + 0.4, midY - 1.5, midY + 1.5, { ...TRAVE, olhando: 0 }));
  cenario.push(rect('trave', FIELD.x1 - 0.4, FIELD.x1 - 0.2, midY - 1.5, midY + 1.5, { ...TRAVE, olhando: 180 }));
  for (const x0 of [220, 236]) cenario.push(rect('banco', x0, x0 + 1.6, FIELD.y1 + 1.2, FIELD.y1 + 1.7, { olhando: 270 }));
}

// ----- 6 · a praça em ruínas: o coreto (por ora, a cobertura de pilares), os bancos, a cachoeira e o riacho -----
cenario.push(box('cobertura', CORETO, { altura: 3.6, pilares: 0.45, mato: true, cipo: 0.7 }, 'Coreto'));
for (const [x0, x1, y0, y1, olhando] of [[311, 312.6, 30, 30.5, 0], [342, 343.6, 30, 30.5, 180], [326, 327.6, 17, 17.5, 90], [326, 327.6, 42.5, 43, 270]] as const) {
  cenario.push(rect('banco', x0, x1, y0, y1, { olhando }));
}
{
  // (as árvores dos cantos da praça, menos as que tampariam a praça na tela)
  let shade = 0;
  for (const [x, y] of [[311.5, 17], [342.5, 17], [311.5, 43], [342.5, 43]] as const) if (plantHere(x, y, { tronco: 0.55, copa: 2.8, altura: 7.5 })) shade++;
  if (shade < 2) throw new Error('Sem sombra na praça em ruínas.');
}
cenario.push(box('cachoeira', FALL, { altura: 1.8, queda: 'sul', musgo: true }, 'Cachoeira'));

// ----- 7 · o clube náutico em ruínas -----
{
  const B1: Rect = { x0: 276, x1: 291, y0: 74, y1: 83 };
  const B2: Rect = { x0: 293, x1: 302, y0: 74, y1: 81 };
  cenario.push(box('casa', B1, { altura: 5.8, andares: 2, cor: '#e4dccb', abandonada: true, caixaDagua: false, cipo: 0.7 }, 'Clube Náutico'));
  cenario.push(box('casa', B2, { altura: 3.2, andares: 1, cor: '#cfc7b5', abandonada: true, caixaDagua: false, cipo: 0.6 }, 'Vestiário'));
  for (const [r, name] of DECKS.slice(4)) cenario.push(box('deque', r, { altura: 0.6, palafitas: true }, name));
  cenario.push(rect('banco', 306, 307.6, 89, 89.5, { olhando: 270 }));
}

// ----- 8 · a Ilha do Véu: a árvore enorme, o Véu e a pedra antiga; e a ilhota de antes, com as árvores dela -----
{
  const FIG = { x: 194, y: 145.5, copa: 8, altura: 12, tronco: 2.2 };
  cenario.push(point('arvore', FIG.x, FIG.y, { especie: 'figueira', copa: FIG.copa, altura: FIG.altura, tronco: FIG.tronco }, 'Árvore do Véu'));
  addTrunk({ x: FIG.x, y: FIG.y, r: FIG.tronco / 2 });
  cenario.push(point('veu', 205, 153.5, { raio: 2.2 }, 'Véu da Ilha'));
  cenario.push(point('pedra', 206.4, 152.6, { raio: 1, ancestral: true }, 'Pedra da Ilha'));
  const irng = mulberry32(SEED + 4);
  for (const [cx, cy, rx, ry, count, isle] of [[92, 72, 6, 4, 6, ISLAND_SMALL], [196, 148, 22, 15, 14, ISLAND]] as const) {
    for (let i = 0, n = 0; i < 600 && n < count; i++) {
      const [x, y] = [cx - rx + irng() * rx * 2, cy - ry + irng() * ry * 2];
      if (!inside(x, y, isle) || dist(x, y, FIG.x, FIG.y) < FIG.copa + 1 || dist(x, y, 205, 153.5) < 3) continue;
      const especie = irng() < 0.5 ? 'jeriva' : 'mata';
      const d = treeDims(especie, irng);
      if (nearTrunks(x, y, 4).some((t) => dist(x, y, t.x, t.y) < 2.6)) continue;
      addTrunk({ x, y, r: d.tronco / 2 });
      cenario.push(point('arvore', round(x), round(y), { especie, ...d }));
      n++;
    }
  }
}

// ----- 9 e 10 · a barragem: o prédio de 1909, o parapeito do muro e a comporta jogando água na várzea -----
cenario.push(box('casa', DAM_HOUSE, { altura: 6.2, andares: 2, cor: '#9a948a', caixaDagua: false, cipo: 0.5 }, 'Barragem de 1909'));
for (let x = DAM.x0; x < DAM.x1 - 0.5; x += 20) {
  cenario.push(rect('muro', round(x), round(Math.min(x + 20, DAM.x1)), DAM.y, round(DAM.y + 0.35), { altura: 0.9, cor: '#a8a296', musgo: true, cipo: 0.3 }));
}
for (const gx of GATES) cenario.push(rect('cachoeira', gx - GATE_W, gx + GATE_W, DAM_WALK.y1, GATE_Y1, { altura: 1.6, queda: 'sul', musgo: true }, 'Comporta'));

// ----- 12 · a Caverna Sagrada: as pedras grandes em arco em volta da boca -----
{
  const crng = mulberry32(SEED + 24);
  for (let k = 0; k < 12; k++) {
    // (o arco fica atrás da boca, do lado de cima; a frente, para o sul, é a entrada. As pedras se encostam: entre duas
    // delas não sobra fresta de entalar)
    const a = Math.PI + (k / 11) * Math.PI;
    // (o arco é regular e as pedras quase do mesmo tamanho: cada pedra tapa a fresta entre as duas vizinhas)
    const r = 5;
    const [x, y] = [CAVE.x + Math.cos(a) * r * 1.25, CAVE.y + Math.sin(a) * r];
    const raio = round(1.75 + crng() * 0.05);
    cenario.push(point('pedra', round(x), round(y), { raio, ancestral: k === 6 }));
    addTrunk({ x, y, r: raio });
  }
  cenario.push(point('placa', CAVE.x - 7.5, CAVE.y + 3.5, { texto: 'CAVERNA SAGRADA', seta: 'leste', poste: true }));
  addTrunk({ x: CAVE.x - 7.5, y: CAVE.y + 3.5, r: 0.1 });
}

// ----- as árvores: a mata em volta de tudo -----
{
  const trng = mulberry32(SEED + 1);
  const mixed = (k: number) => (k < 0.1 ? 'jeriva' : k < 0.22 ? 'embauba' : k < 0.27 ? 'seca' : 'mata');
  // (a mata é aberta como a do Capão: dá para andar entre as árvores; mais fechada perto das beiradas do mapa)
  for (let tries = 0; tries < 60000; tries++) {
    const [x, y] = [round(1 + trng() * (W - 2)), round(1 + trng() * (H - 2))];
    const edge = Math.min(x, y, W - x, H - y);
    const k = trng();
    const especie = k < 0.06 ? 'bananeira' : mixed((k - 0.06) / 0.94);
    const d = treeDims(especie, trng);
    plant(x, y, especie, d, TRUNK_GAP + (edge < 8 ? 1 : especie === 'mata' ? 3.4 : 2.4));
  }
  // xaxins e palmeiras na beira da água, onde é úmido; jerivás espalhados na várzea
  for (let i = 0, n = 0; i < 20000 && n < 70; i++) {
    const [x, y] = [round(1 + trng() * (W - 2)), round(1 + trng() * (H - 2))];
    const g = waterGap(x, y);
    if (g > 1.6 && g < 6 && plant(x, y, 'xaxim', SPECIES.xaxim!, TRUNK_GAP + 0.8, true)) n++;
  }
  for (let i = 0, n = 0; i < 4000 && n < 26; i++) {
    const [x, y] = [round(136 + trng() * 200), round(256 + trng() * 60)];
    if (!inVarzea(x, y)) continue;
    const d = SPECIES.jeriva!;
    if (waterGap(x, y) < 2.4 || nearTrunks(x, y, 8).some((t) => dist(x, y, t.x, t.y) < 6) || hidesView(x, y, d.copa, d.altura)) continue;
    addTrunk({ x, y, r: d.tronco / 2 });
    cenario.push(point('arvore', x, y, { especie: 'jeriva', ...d }));
    n++;
  }
}
// o chão da mata (não bloqueia): samambaias, capim e, no brejo e na várzea, taboas
{
  const prng = mulberry32(SEED + 7);
  for (let i = 0, n = 0; i < 20000 && n < 700; i++) {
    const [x, y, raio] = [1 + prng() * (W - 2), 1 + prng() * (H - 2), round(0.5 + prng() * 0.4)];
    if (isWater(x, y) || roadGap(x, y) < raio + 0.3 || trailGap(x, y) < raio + 0.3 || inRect(x, y, DAM_WALK, 0.5)) continue;
    if (inside(x, y, COMMUNITY) || inRect(x, y, FIELD, 1) || inRect(x, y, SQUARE, 1) || inRect(x, y, CLUB, 1) || onIsland(x, y)) continue;
    if (nearTrunks(x, y, 3).some((t) => dist(x, y, t.x, t.y) < t.r + raio * 0.6)) continue;
    const wet = inside(x, y, BREJO) || inVarzea(x, y) || inside(x, y, blob(20, 87, 17, 10, 0.12));
    cenario.push(point('planta', round(x), round(y), { tipo: wet ? 'taboa' : prng() < 0.75 ? 'samambaia' : 'capim', raio }));
    n++;
  }
}

// ---------------- a vista: nada alto tampa o caminho, o deque, a fogueira, os balcões ----------------
/** Pontos da vila que precisam aparecer (o corpo de quem está lá): a fogueira, a Dona Iracema, o Barqueiro, o píer. */
const VILLAGE_KEYS: Pt[] = [[FIRE.x, FIRE.y], [IRACEMA.x, IRACEMA.y], [BARQUEIRO.x, BARQUEIRO.y], [44, 56], [49, 56]];
for (const o of cenario.filter((c) => c.type === 'casa' && c.props?.material === 'tabua')) {
  const hidden = VILLAGE_KEYS.find(([kx, ky]) => boxCovers(rectOf(o), HOUSE_H + ROOF_H, kx, ky));
  if (hidden) throw new Error(`${o.name} tampa o ponto (${hidden.join(', ')}) do Refúgio.`);
}
// a fogueira e a praça do Brejo Maior também aparecem (as casas da comunidade ficam atrás delas)
for (const o of cenario.filter((c) => c.type === 'casa' && !c.props?.material)) {
  if (boxCovers(rectOf(o), Number(o.props?.altura) + 1.2, PLAZA_FIRE.x, PLAZA_FIRE.y)) throw new Error(`Uma casa tampa a fogueira do Brejo Maior.`);
}

// ---------------- colisão (tirada do cenário) ----------------
/** De qual árvore sorteada é cada caixa de tronco (as que dá para tirar, se ficarem num vão de entalar). */
const TREE_OF = new Map<Shape, Shape>();
function collide(s: Shape): Shape[] {
  const p = s.props ?? {};
  const r = rectOf(s);
  if (s.type === 'arvore') return [block('tronco', s.x, s.y, Number(p.tronco))];
  if (s.type === 'poste') return [block('poste', s.x, s.y, 0.3, { altura: Number(p.altura) })];
  if (s.type === 'pedra') return [block('pedra', s.x, s.y, round(Number(p.raio) * 1.5))];
  // (a moita é redonda: um octógono de três caixas, a mesma largura para os quatro lados e as quinas na beira das folhas)
  if (s.type === 'arbusto' && p.fechado) return bushBoxes(s.x, s.y, Number(p.raio));
  if (s.type === 'tronco-caido') return [box('tronco-caido', r, { altura: Number(p.altura) })];
  if (s.type === 'casa') return [box('casa', r, { altura: Number(p.altura) || HOUSE_H })];
  if (s.type === 'ponto-onibus') return [box('ponto-onibus', r, { altura: Number(p.altura) })];
  if (s.type === 'banco') return [box('banco', r, { bloqueiaTiro: false, altura: 0.5 })];
  if (s.type === 'fogueira') return [block('fogueira', s.x, s.y, 1.2, { bloqueiaTiro: false, altura: 0.4 })];
  if (s.type === 'poste-praca') return [block('poste-praca', s.x, s.y, 0.25, { altura: Number(p.altura) })];
  if (s.type === 'placa' && p.poste) return [block('placa', s.x, s.y, 0.2, { bloqueiaTiro: false, altura: 2.2 })];
  if (s.type === 'barril' || s.type === 'caixote') return [box(s.type, r, { bloqueiaTiro: false, altura: Number(p.altura) })];
  if (s.type === 'rede' || s.type === 'varal') return [box(s.type, r, { bloqueiaTiro: false, altura: Number(p.altura) })];
  if (s.type === 'muro') return [box('muro', r, { altura: Number(p.altura) })];
  if (s.type === 'barreira') return [box('barreira', r, { bloqueiaTiro: false, altura: Number(p.altura) })];
  if (s.type === 'cachoeira') return [box('cachoeira', r, { bloqueiaTiro: false, altura: Number(p.altura) })];
  if (s.type === 'trave') return [s.y, s.y + s.h!].map((y) => block('trave', s.x + s.w! / 2, y, 0.2, { bloqueiaTiro: false, altura: 2 }));
  if (s.type === 'cobertura') {
    // (só os quatro pilares seguram, a 0,6 m das beiradas)
    const [i, side] = [0.6, Number(p.pilares)];
    return [[r.x0 + i, r.y0 + i], [r.x1 - i, r.y0 + i], [r.x0 + i, r.y1 - i], [r.x1 - i, r.y1 - i]].map(([x, y]) => block('pilar', x!, y!, side, { altura: Number(p.altura) }));
  }
  if (s.type === 'banca-frutas') {
    // em U: a frente e os dois lados (o miolo, onde fica quem vende, é chão livre)
    const [f, l, alto] = [Number(p.frente), Number(p.lados), { bloqueiaTiro: false, altura: Number(p.altura) }];
    const yb = round(r.y1 - f);
    return [
      box('banca', { x0: r.x0, x1: r.x1, y0: yb, y1: r.y1 }, alto),
      box('banca', { x0: r.x0, x1: round(r.x0 + l), y0: r.y0, y1: yb }, alto),
      box('banca', { x0: round(r.x1 - l), x1: r.x1, y0: r.y0, y1: yb }, alto),
    ];
  }
  return [];
}
// a água: faixas que o pé não atravessa (os deques ficam de fora; as ilhas também)
const waterBoxes = waterStrips(isWater, 0, W, 0, H);
/**
 * Nenhum vão de entalar (0,3 a 1,2 m entre duas coisas sólidas de frente uma para a outra, sem nada no meio) em lugar
 * nenhum: o mapa é todo aberto. As árvores sorteadas que ficam num vão desses saem (uma de cada vez, até não sobrar vão);
 * se o vão for entre duas coisas postas à mão, o gerador para com erro.
 */
{
  const SOLID_CELL = 4;
  const rebuild = () => {
    const list: { s: Shape; r: Rect }[] = [];
    TREE_OF.clear();
    for (const o of cenario) {
      for (const c of collide(o)) {
        list.push({ s: c, r: rectOf(c) });
        if (o.type === 'arvore' && o.name === undefined) TREE_OF.set(c, o);
      }
    }
    for (const c of waterBoxes) list.push({ s: c, r: rectOf(c) });
    return list;
  };
  for (let pass = 0; pass < 40; pass++) {
    const list = rebuild();
    const grid = new Map<string, number[]>();
    list.forEach((it, i) => {
      for (let gx = Math.floor(it.r.x0 / SOLID_CELL); gx <= Math.floor(it.r.x1 / SOLID_CELL); gx++) {
        for (let gy = Math.floor(it.r.y0 / SOLID_CELL); gy <= Math.floor(it.r.y1 / SOLID_CELL); gy++) {
          const k = `${gx},${gy}`;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k)!.push(i);
        }
      }
    });
    const near = (r: Rect, pad: number) => {
      const out = new Set<number>();
      for (let gx = Math.floor((r.x0 - pad) / SOLID_CELL); gx <= Math.floor((r.x1 + pad) / SOLID_CELL); gx++) {
        for (let gy = Math.floor((r.y0 - pad) / SOLID_CELL); gy <= Math.floor((r.y1 + pad) / SOLID_CELL); gy++) for (const j of grid.get(`${gx},${gy}`) ?? []) out.add(j);
      }
      return out;
    };
    const culprits = new Set<Shape>();
    let fixedError = '';
    list.forEach((a, i) => {
      for (const j of near(a.r, MIN_GAP)) {
        if (j <= i) continue;
        const b = list[j]!;
        if (a.s.type === 'agua' && b.s.type === 'agua') continue;
        if ([a.s.type, b.s.type].includes('banca') && [a.s.type, b.s.type].includes('casa')) continue;
        const dx = Math.max(0, b.r.x0 - a.r.x1, a.r.x0 - b.r.x1);
        const dy = Math.max(0, b.r.y0 - a.r.y1, a.r.y0 - b.r.y1);
        if ((dx > 0 && dy > 0) || dx + dy >= MIN_GAP || dx + dy <= 0.3) continue;
        // o vão está tapado por uma terceira coisa? (sobra de menos de 0,3 m não conta)
        const g: Rect =
          dx > 0
            ? { x0: Math.min(a.r.x1, b.r.x1), x1: Math.max(a.r.x0, b.r.x0), y0: Math.max(a.r.y0, b.r.y0), y1: Math.min(a.r.y1, b.r.y1) }
            : { x0: Math.max(a.r.x0, b.r.x0), x1: Math.min(a.r.x1, b.r.x1), y0: Math.min(a.r.y1, b.r.y1), y1: Math.max(a.r.y0, b.r.y0) };
        const others = [...near(g, 0.2)].filter((k) => k !== i && k !== j).map((k) => list[k]!.r);
        let open = false;
        for (let x = g.x0 + 0.025; x < g.x1 && !open; x += 0.05) {
          for (let y = g.y0 + 0.025; y < g.y1 && !open; y += 0.05) if (!others.some((o) => inRect(x, y, o, 0.15))) open = true;
        }
        if (!open) continue;
        const ta = TREE_OF.get(a.s), tb = TREE_OF.get(b.s);
        if (tb) culprits.add(tb);
        else if (ta) culprits.add(ta);
        else fixedError ||= `Vão de ${(dx + dy).toFixed(2)} m entre ${a.s.type} (${a.s.x}, ${a.s.y}) e ${b.s.type} (${b.s.x}, ${b.s.y}): o pé entala.`;
      }
    });
    if (fixedError) throw new Error(fixedError);
    if (!culprits.size) break;
    for (const t of culprits) cenario.splice(cenario.indexOf(t), 1);
    if (pass === 39) throw new Error('Os vãos de entalar não acabaram.');
  }
}
for (const s of cenario) colisao.push(...collide(s));
colisao.push(...waterBoxes);
// (a conferência de sempre, nos lugares por onde mais se anda: a estrada, os caminhos e o Refúgio)
{
  const playable = (s: Shape) => {
    const r = rectOf(s);
    const [cx, cy] = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
    const reach = Math.max(r.x1 - r.x0, r.y1 - r.y0) / 2 + MIN_GAP + 0.5;
    return roadGap(cx, cy) < reach || trailGap(cx, cy) < reach || DECKS.some(([d]) => rectGap(cx, cy, d) < reach);
  };
  checkWedges(
    colisao.filter(playable),
    MIN_GAP,
    (a, b) =>
      ((a.type === 'mata-fechada' || a.type === 'agua') && (b.type === 'mata-fechada' || b.type === 'agua')) ||
      // o miolo das bancas (a da Dona Iracema, entre a frente dela e a parede da quitanda): os lados fecham
      ([a.type, b.type].includes('banca') && [a.type, b.type].includes('casa')),
  );
}

// ---------------- zonas, áreas, pontos, saídas e bichos ----------------
seguro.push(rect('seguro', 13, 27, 0, 10, undefined, 'Chegada'));
seguro.push(rect('seguro', 39, 74, 43, 68, undefined, 'O Refúgio'));
seguro.push(rect('seguro', 124, 208, 2, 50, undefined, 'Comunidade da Represa'));
// as áreas com nome (a faixa no alto da tela) e o clima de cada uma (`escuro` e `neblina`, de 0 a 1; vale a menor)
const AREAS: [number, number, number, number, number, number, string][] = [
  [39, 74, 43, 68, 0, 0.05, 'O Refúgio'],
  [30, 47, 26, 62, 0.1, 0.15, 'Margem da Represa'],
  [6, 50, 0, 30, 0.1, 0.05, "Estrada do M'Boi Mirim"],
  [0, 38, 18, 80, 0.3, 0.12, 'Parque Ecológico do Guarapiranga'],
  [7, 25, 41, 59, 0.15, 0.08, 'Mirante'],
  [0, 40, 78, 132, 0.25, 0.3, 'Brejo do Sul'],
  [0, 150, 132, 262, 0.3, 0.15, 'Trilha da Margem Sul'],
  [10, 58, 250, 290, 0.45, 0.2, 'Caverna Sagrada'],
  [124, 208, 2, 50, 0, 0.05, 'Comunidade da Represa'],
  [144, 172, 22, 44, 0, 0.05, 'Brejo Maior'],
  [210, 256, 8, 42, 0.05, 0.05, 'Campinho'],
  [304, 350, 10, 50, 0.2, 0.1, 'Praça em Ruínas'],
  [268, 324, 66, 100, 0.25, 0.15, 'Clube Náutico em Ruínas'],
  [122, 360, 42, 76, 0.1, 0.1, 'Orla da Represa'],
  [340, 400, 60, 260, 0.25, 0.1, 'Mata do Leste'],
  [140, 348, 244, 256, 0.05, 0.2, 'A Barragem'],
  [322, 350, 222, 248, 0.1, 0.1, 'Barragem de 1909'],
  [132, 340, 256, 320, 0.05, 0.25, 'Várzea de Caça'],
  [168, 224, 128, 168, 0.1, 0.25, 'Ilha do Véu'],
  [40, 334, 30, 250, 0.1, 0.3, 'Represa de Guarapiranga'],
];
for (const [x0, x1, y0, y1, escuro, neblina, nome] of AREAS) areas.push(rect('area', x0, x1, y0, y1, { escuro, neblina }, nome));
pontos.push(point('ponto', 54.6, 58.8, undefined, 'spawn')); // quem desmaia aqui acorda no Refúgio, perto da fogueira
pontos.push(point('ponto', ARRIVAL.x, ARRIVAL.y, undefined, 'chegada-capao'));
// (para quando o Mapa 03 existir: quem chega de Santo Amaro aparece na estrada, antes da barreira)
pontos.push(point('ponto', 380, 230, undefined, 'chegada-santo-amaro'));
// o lugar das capivaras na várzea (o bando é da [estrutura], em data/bichos.json): onde andam e onde deitam
pontos.push(rect('area', 280, 330, 264, 312, undefined, 'capivaras-varzea'));
pontos.push(point('ponto', 300, 300, undefined, 'capivaras-varzea-descanso'));
saidas.push(box('saida', EXIT_NORTH, { mapa: 'capao', chegada: 'chegada-guarapiranga' }, 'Capão Redondo'));
// os bichos (os que já existem no jogo; os de cada lugar do escopo — a Caipora, o Corpo-Seco, o Saci — vêm com a [estrutura])
const BICHOS: [number, number, number, number, number, string][] = [
  [4, 34, 22, 40, 6, 'sagui'], // o parque, no norte do mirante
  [2, 38, 84, 140, 6, 'jararaca'], // o brejo do sul
  [4, 40, 150, 240, 6, 'quati'], // a mata da trilha da margem sul
  [150, 330, 260, 314, 8, 'quati'], // a várzea de caça
  [150, 330, 260, 314, 5, 'tatu_bola'],
  [150, 280, 260, 314, 4, 'sagui'],
  [272, 318, 72, 94, 6, 'marimbondo'], // o clube náutico (alto risco)
  [304, 350, 10, 50, 4, 'tatu_bola'], // a praça em ruínas
  [370, 398, 70, 210, 2, 'filhote_boitata'], // a mata do leste (de noite)
];
for (const [x0, x1, y0, y1, quantidade, nome] of BICHOS) monstros.push(rect('area', x0, x1, y0, y1, { quantidade }, nome));

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
    ['monstros', monstros],
  ],
  { nome: 'Guarapiranga', seguro: false },
);
const count = (type: string) => cenario.filter((s) => s.type === type).length;
console.log(`Mapa gerado em ${OUT}: ${W}x${H} m, ${count('arvore')} árvores, ${count('casa')} casas, ${colisao.length} retângulos de colisão, ${cenario.length} coisas no cenário.`);
// a imagem vista de cima (a tecla M e o mini mapa), ao lado do mapa (4 px por metro: o mapa é grande)
const mapImage = writeMapImage(OUT, 4);
console.log(`Mapa visto de cima (tecla M): ${mapImage.png} e ${mapImage.json.split('/').pop()}.`);
