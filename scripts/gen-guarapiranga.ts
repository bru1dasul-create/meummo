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
  ellipse,
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
/**
 * A Ilha do Véu vestida (24/11, o dono: "pode retomar o Guarapiranga"). No meio, a Árvore do Véu, a maior do jogo; na
 * frente do tronco, o Véu (a cortina de raízes que brilham e o brilho no chão), com a pedra antiga do lado e a oferenda do
 * outro. No leste, a roda de pedras em pé (as itacoatiaras viradas para o meio), com a oferenda no meio; no oeste, virado
 * para o Refúgio (de onde o Barqueiro vem), o atracadouro com a canoa amarrada. A Trilha do Véu liga os três.
 */
const ISLAND_FIG = { x: 194, y: 145.5, copa: 11, altura: 18, tronco: 2.4 };
const ISLAND_VEIL = { x: 195.8, y: 148.6 };
const ISLAND_RING = { x: 211.5, y: 147.5, r: 4.4 };
/** O atracadouro: entra 6,4 m na água e sobe 1 m na areia (a beira oeste da ilha fica em x ≈ 172,9). */
const ISLAND_PIER: Rect = { x0: 166.5, x1: 174, y0: 147, y1: 149 };
/** A areia da beira, em volta do atracadouro. */
const ISLAND_SAND = { x: 176.2, y: 148, r: 3.2 };
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
const TRAIL_FIELD = smooth([[233, 38.5], [233.5, 48], [234, 56.5]], 1);
const TRAIL_SQUARE = smooth([[327, 46.5], [327.5, 56], [328.5, 70]], 1);
const TRAIL_DAM_EAST = smooth([[338.5, 251.7], [352, 245], [362, 237], [370, 231]], 1);
/** Da praça em ruínas até a beira do poço da cachoeira (o riacho fica ao sul dela). */
const TRAIL_FALL = smooth([[346.5, 27], [358, 26.2], [370, 24.8], [383.6, 23.2]], 1);
/** A Trilha do Véu, na ilha: do atracadouro, passa na frente do Véu e entra na roda de pedras pelo vão do oeste. */
const TRAIL_ISLAND = smooth([[174, 148], [179, 149.2], [184, 151.2], [189.5, 152.5], [195.5, 152.8], [201, 151.6], [205.2, 149.6], [207.6, 148.1]], 1);
const TRAILS: [Pt[], number, string][] = [
  [TRAIL_PARK, 2.6, 'Trilha do Mirante'],
  [TRAIL_SOUTH, 3, 'Trilha da Margem Sul'],
  [TRAIL_CAVE, 2.6, 'Trilha da Caverna'],
  [TRAIL_FIELD, 3, ''],
  [TRAIL_SQUARE, 3, ''],
  [TRAIL_DAM_EAST, 3, ''],
  [TRAIL_FALL, 2.4, 'Trilha da Cachoeira'],
  [TRAIL_ISLAND, 1.8, 'Trilha do Véu'],
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
/**
 * O mirante (24/11): o deque de madeira de 8 m no parque, com a torre de observação (e a escada, do lado sul) no canto de
 * trás e o guarda-corpo em volta — a entrada é o vão do lado leste, onde chega a trilha. Para o leste, a mata aberta até
 * a margem (`LOOKOUT_VIEW`: só o gramado; de lá se vê a represa).
 */
const LOOKOUT: Rect = { x0: 12, x1: 20, y0: 46, y1: 54 };
const LOOKOUT_TOWER: Rect = { x0: 12.15, x1: 15.75, y0: 46.15, y1: 50.75 };
const LOOKOUT_RAILS: Rect[] = [
  { x0: 12, x1: 20, y0: 53.85, y1: 54 },
  { x0: 12, x1: 12.15, y0: 50.75, y1: 53.85 },
  { x0: 15.75, x1: 20, y0: 46, y1: 46.15 },
  { x0: 19.85, x1: 20, y0: 50.5, y1: 53.85 },
];
const LOOKOUT_VIEW: Rect = { x0: 20.5, x1: 34, y0: 48.6, y1: 56 };
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
/**
 * As ruelas de cimento da comunidade (22/11, "vestir a comunidade"): a de cima, entre a fileira do fundo e a do meio;
 * a do meio, que desce da de cima até a praça e da praça até a estrada; uma de cada lado; e as duas que passam na frente
 * das fileiras do meio, uma de cada lado da praça. Casas coladas umas nas outras, com as ruelas de 2,5 a 3 m.
 */
const ALLEYS: Rect[] = [
  { x0: 125, x1: 206, y0: 12.5, y1: 15.5 },
  { x0: 156.5, x1: 159.5, y0: 15.5, y1: 25 },
  { x0: 156.5, x1: 159.5, y0: 41, y1: 50 },
  { x0: 137, x1: 139.5, y0: 15.5, y1: 41 },
  { x0: 180.5, x1: 183, y0: 15.5, y1: 42.5 },
  { x0: 125, x1: 146, y0: 23.5, y1: 26 },
  { x0: 170, x1: 206, y0: 23.5, y1: 26 },
];
/** O chão de cimento da praça (o Brejo Maior), da frente das lojas até a beira de baixo. */
const PLAZA_FLOOR: Rect = { x0: 146, x1: 170, y0: 23.5, y1: 41 };
/** 5 · O campinho de terra. */
const FIELD: Rect = { x0: 214, x1: 252, y0: 12, y1: 38 };
/** A arquibancada de cimento do campinho (três degraus atrás do campo, virados para ele), o muro do time atrás do gol do
 * oeste, o alambrado atrás do gol do leste e a barraca de pastel na beira do gramado (24/11). */
const FIELD_STANDS: Rect = { x0: 219, x1: 247, y0: 9.2, y1: 11.3 };
const FIELD_WALL: Rect = { x0: 212.3, x1: 212.7, y0: 19, y1: 31 };
const FIELD_FENCE: Rect = { x0: 253.3, x1: 253.4, y0: 19, y1: 31 };
const FIELD_STAND: Rect = { x0: 240.6, x1: 243.2, y0: 40.4, y1: 41.65 };
/** 6 · A praça em ruínas, com o coreto. */
const SQUARE: Rect = { x0: 308, x1: 346, y0: 14, y1: 46 };
const CORETO: Rect = { x0: 321, x1: 333, y0: 24, y1: 36 };
const FALL: Rect = { x0: 388, x1: 396, y0: 17, y1: 23 };
/** O poço ao pé da cachoeira: a beira de cima encosta na pedra inteira (sem fresta de entalar); dele sai o riacho. */
const FALL_POOL: Pt[] = [[388, 23], [396, 23], [396.6, 24.2], [396.2, 25.6], [394.8, 26.8], [392.6, 27.4], [390.4, 27], [388.8, 25.9], [388, 24.5]];
/** 7 · O clube náutico: o pátio de cimento, os prédios e a piscina. */
const CLUB: Rect = { x0: 272, x1: 318, y0: 72, y1: 94 };
/** 9 · O prédio da Barragem de 1909 e 10 · o caminho de pedra em cima do muro da barragem (a comporta no meio). */
const DAM_HOUSE: Rect = { x0: 328, x1: 344, y0: 231, y1: 242 };
/** A torre do relógio, colada no lado leste do prédio, e a praça de paralelepípedo entre o prédio e o muro. */
const DAM_TOWER: Rect = { x0: 344, x1: 347.6, y0: 233, y1: 236.6 };
const DAM_PLAZA: Rect = { x0: 327, x1: 345, y0: 242, y1: 250 };
const DAM_WALK: Rect = { x0: 146, x1: 340, y0: DAM.y, y1: DAM.y + 3.4 };
const GATES = [218, 242];
/**
 * A comporta (23/11, o dono achou a queda feia): o muro de pedra de 6 m com a boca em arco (60 cm de fundo, encostado
 * na barragem), o jato saindo dela e o tanque de pedra (3 m) onde a água ferve antes de seguir pelo canal; as alas de
 * pedra dos dois lados do tanque também seguram o jogador.
 */
const GATE_W = 3;
const GATE_BASIN = 3;
const GATE_WING = 0.26;
// (a beira de cima do tanque cai na linha das faixas de água, de 0,5 em 0,5 m: o tanque encosta no muro sem sobra)
const GATE_Y1 = Math.ceil((DAM_WALK.y1 + 0.5) * 2) / 2;
const GATE_POOLS: Pt[][] = GATES.map((gx) => [[gx - GATE_W, GATE_Y1], [gx + GATE_W, GATE_Y1], [gx + GATE_W, GATE_Y1 + GATE_BASIN], [gx - GATE_W, GATE_Y1 + GATE_BASIN]]);
/** 12 · A Caverna Sagrada: a clareira em frente da boca e o morro de pedra com a boca virada para o sul. */
const CAVE = { x: 34, y: 269 };
const CAVE_HILL: Rect = { x0: 27, x1: 41, y0: 257, y1: 265 };
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
for (const r of ALLEYS) chao.push(rect('calcada', r.x0, r.x1, r.y0, r.y1, { estado: 'rachado' }));
chao.push(rect('calcada', PLAZA_FLOOR.x0, PLAZA_FLOOR.x1, PLAZA_FLOOR.y0, PLAZA_FLOOR.y1, { estado: 'rachado', musgo: true }, 'Brejo Maior'));
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
// o gramado aberto do mirante até a margem (de lá se vê a represa)
chao.push(area('grama', blob((LOOKOUT_VIEW.x0 + LOOKOUT_VIEW.x1) / 2, (LOOKOUT_VIEW.y0 + LOOKOUT_VIEW.y1) / 2, (LOOKOUT_VIEW.x1 - LOOKOUT_VIEW.x0) / 2, (LOOKOUT_VIEW.y1 - LOOKOUT_VIEW.y0) / 2, 0.15)));
chao.push(area('grama', ISLAND_SMALL, undefined, 'Ilhota'));
chao.push(area('grama', ISLAND, undefined, 'Ilha do Véu'));
// (na ilha: a areia da beira em volta do atracadouro e o chão batido da roda de pedras, antes da trilha que passa neles)
chao.push(ellipse('areia', ISLAND_SAND.x, ISLAND_SAND.y, ISLAND_SAND.r));
chao.push(ellipse('terra', ISLAND_RING.x, ISLAND_RING.y, ISLAND_RING.r + 1.4));
chao.push(line('agua', CREEK, { largura: CREEK_W, cor: '#2f6f6a' }));
for (const c of CHANNELS) chao.push(line('agua', c, { largura: CHANNEL_W, cor: '#2f6f6a' }));
for (const p of PONDS) chao.push(area('agua', p, { cor: '#35706a' }));
for (const p of BREJO_POOLS) chao.push(area('agua', p, { cor: '#3a6a58' }));
chao.push(area('agua', FALL_POOL, { cor: '#2f6f6a' }));
for (const p of GATE_POOLS) chao.push(area('agua', p, { cor: '#2f6f6a' }));
// (a beira de azulejo da piscina do clube vem antes da água: a água fica por cima dela)
chao.push(rect('piso', POOL.x0 - 0.6, POOL.x1 + 0.6, POOL.y0 - 0.6, POOL.y1 + 0.6, { desenho: 'azulejo' }));
chao.push(area('agua', POOL_PTS, { cor: '#4f7f5a' }));
// a estrada (asfalto rachado, com a calçada tomada pelo mato), o caminho de terra até o píer e as trilhas novas
chao.push(line('calcada', ROAD, { largura: ROAD_W + 2 * SIDEWALK }));
chao.push(line('asfalto', ROAD, { largura: ROAD_W, estado: 'rachado', nome: "Estrada do M'Boi Mirim" }));
chao.push(line('trilha', PATH, { largura: PATH_W, nome: 'Caminho da Represa' }));
for (const [t, w, nome] of TRAILS) chao.push(line('trilha', t, { largura: w, ...(nome ? { nome } : {}) }));
// o caminho de pedra em cima da barragem: lajes de pedra (depois das trilhas: a ponta delas fica embaixo das lajes, em
// vez da língua de terra por cima do caminho que o dono achou feia em 23/11)
chao.push(rect('calcada', DAM_WALK.x0, DAM_WALK.x1, DAM_WALK.y0, DAM_WALK.y1, { estado: 'rachado', musgo: true, desenho: 'placas' }, 'A Barragem'));
// a clareira de pedra em frente da caverna e o chão escuro na boca
chao.push(area('pedra', blob(CAVE.x, CAVE.y + 0.4, 7.6, 4.4, 0.12)));
chao.push(area('terra', blob(CAVE.x, CAVE_HILL.y1 + 0.7, 2.3, 0.9, 0.1), { cor: '#211812' }));
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
  roadDetails(ROAD_OLD, srng, 8);
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
  roadDetails(ROAD_NEW, nrng, 28);
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
for (const r of [PLAZA, FIELD, SQUARE, CLUB, DAM_WALK, DAM_PLAZA, LOOKOUT, ...ALLEYS]) VIEW_KEYS.push(...rectPoints(r, 2));
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
  (x, y) => inRect(x, y, CAVE_HILL, 1.5),
  (x, y) => inRect(x, y, FIELD, 3),
  (x, y) => inRect(x, y, SQUARE, 3),
  (x, y) => inRect(x, y, CLUB, 2.5),
  (x, y) => inRect(x, y, DAM_WALK, 3),
  (x, y) => inRect(x, y, DAM_HOUSE, 4) || inRect(x, y, DAM_TOWER, 4) || inRect(x, y, DAM_PLAZA, 3),
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
function plantHere(x: number, y: number, d: { tronco: number; copa: number; altura: number }, especie = 'mata'): boolean {
  if (nearTrunks(x, y, 6).some((t) => dist(x, y, t.x, t.y) - t.r - d.tronco / 2 < TRUNK_GAP + 1)) return false;
  if (hidesView(x, y, d.copa, d.altura)) return false;
  addTrunk({ x, y, r: d.tronco / 2 });
  cenario.push(point('arvore', x, y, { especie, ...d }));
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

// ----- 2 · o mirante -----
// (24/11, o dono: "pode seguir vestindo o mirante") O deque com a torre de observação de troncos (a escada, os dois
// andares e o telhado de sapê; não dá para subir), o guarda-corpo com a entrada para a trilha, a luneta de moedas virada
// para a represa, o painel com o mapa da represa e as aves, o banco e os lampiões; em volta, helicônias.
cenario.push(box('deque', LOOKOUT, { altura: 0.6, palafitas: true }, 'Mirante'));
cenario.push(box('torre-mirante', LOOKOUT_TOWER, { altura: 6.2, escada: 1 }, 'Torre do Mirante'));
addTrunk({ x: (LOOKOUT_TOWER.x0 + LOOKOUT_TOWER.x1) / 2, y: (LOOKOUT_TOWER.y0 + LOOKOUT_TOWER.y1) / 2, r: 2.4 });
for (const r of LOOKOUT_RAILS) cenario.push(rect('guarda-corpo', r.x0, r.x1, r.y0, r.y1, { altura: 0.95 }));
cenario.push(point('luneta', 19.55, 51.6, { olhando: 0 }));
cenario.push(rect('painel-mirante', 17.2, 18.8, 46.4, 46.7, {}, 'Painel da Represa'));
cenario.push(rect('banco', 15.2, 16.8, 53.2, 53.6, { olhando: 270 }));
for (const [x, y] of [[LOOKOUT.x0 + 0.3, LOOKOUT.y1 - 0.4], [LOOKOUT.x1 - 0.3, LOOKOUT.y1 - 0.4]] as const) cenario.push(point('poste-praca', x, y, { altura: 3, luz: '#ffd36b', estilo: 'lampiao' }));
for (const [x, y] of [[13.4, 55.2], [17.6, 55.4], [21, 53.2], [11, 51.8], [21.2, 45.2]] as const) cenario.push(point('planta', x, y, { tipo: 'heliconia', raio: 0.55 }));
cenario.push(point('placa', LOOKOUT.x1 + 0.6, LOOKOUT.y0 + 0.6, { texto: 'MIRANTE', seta: 'leste', poste: true }));
addTrunk({ x: LOOKOUT.x1 + 0.6, y: LOOKOUT.y0 + 0.6, r: 0.1 });

// ----- 4 · a comunidade da represa: as casas coladas, as ruelas, a praça do Brejo Maior e o comércio dela -----
// (22/11, o dono: "pode seguir vestindo a comunidade primeiro"). Fileiras de casas coladas umas nas outras, de 1 a 3
// andares (as altas no fundo, as baixas na frente: a câmera olha do sudeste), de tijolo baiano sem reboco, rebocadas e
// pintadas, ou só com o térreo pintado e o puxadinho no tijolo; laje com caixa d'água, ferro espetado esperando o
// próximo andar, varal e plantas. Na praça: o bar, a peixaria, o salão e o mercadinho de frente para ela; a fogueira,
// as bancas (frutas, peixe e artesanato), as mesas do bar, o muro grafitado e os postes com a fiação cheia de pipas.
{
  const hrng = mulberry32(SEED + 23);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(hrng() * list.length)]!;
  const CORES = ['#e8c75a', '#79a9d1', '#e2a3b8', '#8fc08a', '#c46aa8', '#f0a050', '#e6e0d2', '#6fc0c0', '#d86a5a'];
  /** Uma casa da comunidade: o jeito dela sorteado (o andar de cima sem reboco só em casa de 2 ou 3 andares). */
  const house = (h: Rect, andares: number, extra: Record<string, string | number | boolean> = {}, name?: string) => {
    const k = hrng();
    const tijolo = k < 0.38 ? true : k < 0.68 && andares > 1 ? 'cima' : false;
    const props: Record<string, string | number | boolean> = {
      altura: round(andares * 2.6 + 0.6),
      andares,
      cor: pick(CORES),
      caixaDagua: hrng() < 0.85,
      cipo: round(hrng() * 0.22),
      morador: 'familia',
      grade: hrng() < 0.6,
      ...(tijolo ? { tijolo } : {}),
      ...(hrng() < (tijolo ? 0.55 : 0.3) ? { vergalhao: true } : {}),
      ...(hrng() < 0.3 ? { varal: true } : {}),
      ...(hrng() < 0.2 ? { plantas: true } : {}),
      ...(!tijolo && hrng() < 0.3 ? { pixo: true } : {}),
      ...extra,
    };
    cenario.push(rect('casa', h.x0, h.x1, round(h.y0), h.y1, props, name));
  };
  /** Uma fileira de casas coladas de x0 a x1 (a frente em y1); o fundo varia um pouco. */
  const row = (x0: number, x1: number, y0: number, y1: number, floors: () => number, deep = 0) => {
    for (let x = x0; x < x1 - 0.01; ) {
      let w = round(4.6 + hrng() * 2.4);
      // (o que sobra no fim da fileira não vira casinha de menos de 4 m: entra na última, ou divide em duas)
      if (x1 - (x + w) < 4) w = x1 - x >= 9.2 ? round((x1 - x) / 2) : round(x1 - x);
      house({ x0: round(x), x1: round(x + w), y0: round(y0 + hrng() * deep), y1 }, floors());
      x = round(x + w);
    }
  };
  // a fileira do fundo (2 e 3 andares) e as do meio (as lojas de frente para a praça ficam à parte)
  row(125, 206, 4, 12.5, () => (hrng() < 0.4 ? 3 : 2), 1);
  row(125, 137, 15.5, 23.5, () => (hrng() < 0.5 ? 2 : 1));
  row(139.5, 146, 15.5, 23.5, () => 2);
  row(170.5, 180.5, 15.5, 23.5, () => (hrng() < 0.5 ? 2 : 1));
  row(183, 206, 15.5, 23.5, () => (hrng() < 0.5 ? 2 : 1));
  // o comércio de frente para a praça (o letreiro e o toldo; o andar de cima é a casa de quem tem a loja)
  const SHOPS: [number, number, number, Record<string, string | number | boolean>, string][] = [
    [146, 151.2, 2, { comercio: 'bar', letreiro: 'LEMOS BAR', toldo: '#2f6fb0', cor: '#79a9d1', tijolo: 'cima', vergalhao: true }, 'Lemos Bar'],
    [151.2, 156.5, 1, { comercio: 'lanches', letreiro: 'PEIXARIA', toldo: '#2a8a9a', cor: '#6fc0c0' }, 'Peixaria'],
    [159.5, 165, 2, { comercio: 'lanches', letreiro: 'SALÃO DA NEIDE', toldo: '#c4508a', cor: '#e2a3b8', varal: true }, 'Salão da Neide'],
    [165, 170.5, 2, { comercio: 'vendinha', letreiro: 'MERCADINHO', toldo: '#d8902a', cor: '#e8c75a', tijolo: 'cima', vergalhao: true }, 'Mercadinho'],
  ];
  for (const [x0, x1, andares, extra, name] of SHOPS) house({ x0, x1, y0: 15.5, y1: 23.5 }, andares, { grade: false, pixo: false, ...extra }, name);
  // as fileiras dos lados da praça e as de baixo (baixas: ficam na frente da praça, na tela)
  row(125, 137, 26, 32.5, () => (hrng() < 0.3 ? 2 : 1));
  row(139.5, 143.5, 26, 32.5, () => 1);
  row(172, 180.5, 26, 33, () => (hrng() < 0.4 ? 2 : 1));
  row(183, 206, 26, 33, () => (hrng() < 0.4 ? 2 : 1));
  row(161.5, 180.5, 42.5, 48, () => 1);
  row(183, 199, 42.5, 47.5, () => 1);

  // a praça do Brejo Maior: a fogueira com os bancos, as mesas do bar, as bancas e o muro grafitado
  benchesAround(PLAZA_FIRE.x, PLAZA_FIRE.y);
  for (const x of [148.3, 151.3]) cenario.push(point('mesa', x, 27.2, { cadeiras: 4 }));
  for (const [x0, mercadoria, pano] of [[147.5, 'frutas', '#4f9f5f'], [151.4, 'peixe', '#3f7fbf'], [162.2, 'artesanato', '#e8c75a']] as const) {
    cenario.push(box('banca-frutas', { x0, x1: x0 + 2.6, y0: 37.5, y1: 38.75 }, { altura: 0.9, frente: 0.5, lados: 0.3, pano, mercadoria }));
  }
  cenario.push(rect('muro', 145.5, 145.9, 27, 37, { altura: 2.5, cor: '#d8d2c4', grafite: 'cores', texto: 'BREJO', lado: 'leste', cipo: 0.08 }, 'Muro grafitado'));
  // os postes de luz nos cantos da praça e a fiação cruzando por cima, com as pipas que enroscaram
  const POLES: Pt[] = [[146.6, 25.6], [169.4, 25.6], [146.6, 40.4], [169.4, 40.4]];
  for (const [x, y] of POLES) {
    cenario.push(point('poste', x, y, { altura: 7, luz: '#ffe9a6' }));
    addTrunk({ x, y, r: 0.15 });
  }
  const [NW, NE, SW, SE] = POLES as [Pt, Pt, Pt, Pt];
  cenario.push(line('fiacao', [NW, NE], { pipa: '#e0452c' }));
  cenario.push(line('fiacao', [SW, SE]));
  cenario.push(line('fiacao', [NW, SW]));
  cenario.push(line('fiacao', [NE, SE], { pipa: '#f2b632' }));
  cenario.push(line('fiacao', [NW, SE], { pipa: '#2f7fd0' }));
  cenario.push(line('bandeirinhas', [NW, [PLAZA_FIRE.x, PLAZA_FIRE.y - 1], NE], { altura: 4.2 }));
  cenario.push(line('bandeirinhas', [SW, [PLAZA_FIRE.x, PLAZA_FIRE.y + 2], SE], { altura: 4.2 }));
  // as bandeirinhas da ruela de cima, de uma laje à outra
  for (const x of [142, 170, 194]) cenario.push(line('bandeirinhas', [[x, 12.6], [x + 6, 15.4]], { altura: 4.8 }));

  // a vida das ruelas: vasos e barris encostados nas casas, a moto velha, as lixeiras, os pneus
  for (let x = 126; x < 205; x += 5 + hrng() * 4) {
    if (ALLEYS.some((a) => a !== ALLEYS[0] && x > a.x0 - 1 && x < a.x1 + 1)) continue;
    if (hrng() < 0.5) cenario.push(point('vaso', round(x), 12.85, { planta: pick(['espada-de-sao-jorge', 'samambaia', 'costela-de-adao']) }));
    else cenario.push(rect('barril', round(x), round(x + 0.6), 12.55, 13.15, { altura: 0.9, cor: '#2f6fb0' }));
  }
  cenario.push(rect('moto', 186, 188, 23.6, 24.4, { altura: 1.1, cor: '#8a3a2a', olhando: 0 }));
  for (const [x, y] of [[136.6, 15.85], [183.4, 15.85]] as const) cenario.push(point('lixeira', x, y, { olhando: 90 }));
  cenario.push(point('pneus', 150.5, 43.2, { raio: 0.45, pilha: 3 }));
  // os quintais do sudeste: bananeiras, varal e o brejinho de taboas
  for (const [x0, x1, y] of [[186, 190, 35.6], [196, 200, 36.2]] as const) cenario.push(rect('varal', x0, x1, y, round(y + 0.2), { altura: 1.8 }));
  for (const [x, y] of [[176.5, 37.5], [192.5, 39.5], [203, 37], [149, 45]] as const) plantHere(x, y, treeDims('bananeira', hrng), 'bananeira');
  for (let i = 0, n = 0; i < 200 && n < 6; i++) {
    const [x, y] = [180 + hrng() * 14, 33 + hrng() * 9];
    if (inside(x, y, blob(186, 37, 9, 5.5, 0.15)) && !ALLEYS.some((a) => inRect(x, y, a, 0.6))) {
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
  // (24/11, o dono: "pode seguir com os detalhes do Guarapiranga") O campinho de várzea da comunidade: a arquibancada
  // de cimento atrás do campo (o lado de trás na tela: ela não tampa o jogo), o muro grafitado do time atrás do gol do
  // oeste (a pintura na face do leste, a que a câmera vê), o alambrado rasgado atrás do gol do leste, a barraca de pastel
  // e caldo de cana com a mesa e as cadeiras na beira do gramado, o mastro com a bandeira e a bola esquecida no campo
  for (const [k, altura] of [[0, 0.45], [1, 0.9], [2, 1.35]] as const) {
    const y1 = round(FIELD_STANDS.y1 - k * 0.7);
    cenario.push(rect('muro', FIELD_STANDS.x0, FIELD_STANDS.x1, round(y1 - 0.7), y1, { altura, cor: '#bdb7a8', musgo: true, cipo: 0.08 }));
  }
  cenario.push(box('muro', FIELD_WALL, { altura: 2.4, cor: '#d8d2c4', grafite: 'cores', texto: 'BREJO FC', lado: 'leste', cipo: 0.12 }, 'Muro do Brejo FC'));
  cenario.push(box('alambrado', FIELD_FENCE, { altura: 3, cipo: 0.3, estado: 'rasgado' }));
  cenario.push(box('banca-pastel', FIELD_STAND, { altura: 0.9 }, 'Pastel e Caldo de Cana'));
  const table = { x: 244.8, y: 43.6 };
  cenario.push(point('mesa', table.x, table.y));
  for (const dx of [-0.75, 0.75]) cenario.push(point('cadeira', round(table.x + dx), table.y));
  cenario.push(point('mastro', 216.2, 10.4, { altura: 6.5, cor: '#2f8f4a' }));
  cenario.push(point('bola', 238.6, 27.4));
}

// ----- 6 · a praça em ruínas: o coreto, os postes antigos, os bancos, a cachoeira e o riacho -----
// (24/11, o dono: "pode seguir vestindo o coreto") O coreto octogonal de ferro, com a base de alvenaria e a escada do
// lado sul (não dá para subir: a base inteira segura); os quatro postes de ferro em volta (um apagado, um torto) e as
// moitas e samambaias tomando o pé da base.
const CORETO_R = 4.4;
cenario.push(box('coreto', CORETO, { altura: 0.95, raio: CORETO_R, ruina: true, cipo: 0.6 }, 'Coreto'));
{
  const cx = (CORETO.x0 + CORETO.x1) / 2, cy = (CORETO.y0 + CORETO.y1) / 2;
  const D = 5.1;
  for (const [sx, sy, extra] of [[-1, -1, {}], [1, -1, { apagado: true }], [-1, 1, { cipo: true }], [1, 1, { torto: true, cipo: true }]] as const) {
    cenario.push(point('poste-praca', round(cx + sx * D), round(cy + sy * D), { altura: 3.6, luz: '#ffe9a6', ...extra }));
  }
  // as moitas no pé dos lados de 45° (enfeite: não seguram) e as samambaias nas quinas
  for (const [a, raio] of [[45, 0.75], [135, 0.6], [225, 0.7], [315, 0.55]] as const) {
    const t = (a * Math.PI) / 180;
    cenario.push(point('arbusto', round(cx + Math.cos(t) * 4.7), round(cy + Math.sin(t) * 4.7), { raio }));
  }
  for (const a of [0, 90, 180, 270]) {
    const t = ((a + 22.5) * Math.PI) / 180;
    cenario.push(point('planta', round(cx + Math.cos(t) * 4.75), round(cy + Math.sin(t) * 4.75), { tipo: 'samambaia', raio: 0.45 }));
  }
}
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

// ----- 7 · o clube náutico em ruínas (24/11, o dono: "pode seguir vestindo o clube náutico") -----
// A sede de dois andares com o letreiro pintado e a árvore crescendo na laje, a varanda na frente, o vestiário; a
// garagem dos barcos na beira da água, com as canoas amarradas; a piscina verde com a beira de azulejo, o trampolim, a
// escadinha e as cadeiras; a arquibancada de cimento virada para a represa (as regatas); o mastro com a bandeira
// rasgada; o píer quebrado e, perto dele, um veleiro afundado com o mastro fora d'água. O mato tomando o pátio.
{
  const crng = mulberry32(SEED + 27);
  const dry = (r: Rect, what: string) => {
    for (const [x, y] of [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1], [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]] as const) {
      if (isWater(x, y)) throw new Error(`${what} caiu na água em (${x}, ${y}).`);
    }
  };
  const B1: Rect = { x0: 276, x1: 291, y0: 74, y1: 83 };
  const B2: Rect = { x0: 293, x1: 302, y0: 74, y1: 81 };
  cenario.push(box('casa', B1, { altura: 5.8, andares: 2, cor: '#e8e2d2', abandonada: true, caixaDagua: false, cipo: 0.65, pixo: true, arvoreNaLaje: true, pintura: 'CLUBE NÁUTICO' }, 'Clube Náutico'));
  cenario.push(box('casa', B2, { altura: 3.2, andares: 1, cor: '#d6cfbd', abandonada: true, caixaDagua: false, cipo: 0.5, pixo: true, pintura: 'VESTIÁRIO' }, 'Vestiário'));
  // a varanda coberta na frente da sede (os pilares de trás encostam na parede) e a garagem dos barcos na beira
  const VERANDA: Rect = { x0: 276, x1: 285, y0: 82.65, y1: 86.8 };
  const BOATHOUSE: Rect = { x0: 286, x1: 294, y0: 85.5, y1: 90.5 };
  dry(VERANDA, 'A varanda');
  dry(BOATHOUSE, 'A garagem dos barcos');
  cenario.push(box('cobertura', VERANDA, { altura: 2.9, pilares: 0.45, mato: true, cipo: 0.5, faixa: '#3f6fa8' }));
  cenario.push(box('cobertura', BOATHOUSE, { altura: 3.4, pilares: 0.45, mato: true, cipo: 0.35, faixa: '#3f6fa8' }, 'Garagem dos barcos'));
  for (const [x0, y0, cor] of [[285.8, 93, '#3f7fbf'], [289.8, 94.6, '#c9774a']] as const) cenario.push(rect('barco', x0, round(x0 + 3.6), y0, y0 + 1, { tipo: 'canoa', cor, olhando: 180 }));
  // o píer quebrado (os dois pedaços) e o veleiro afundado ao lado dele
  for (const [r, name] of DECKS.slice(4)) cenario.push(box('deque', r, { altura: 0.6, palafitas: true }, name));
  cenario.push(rect('barco', 304.5, 309.5, 107, 108.6, { tipo: 'veleiro', afundado: true, olhando: 0 }, 'Veleiro afundado'));
  // a piscina: a beira de azulejo, o trampolim (a base encosta na água), a escadinha e as cadeiras de plástico
  cenario.push(rect('trampolim', POOL.x1 - 1.8, POOL.x1 + 0.7, 81.1, 81.9, { lado: 'oeste' }));
  cenario.push(point('escada-piscina', 310, POOL.y0, { olhando: 90 }));
  for (const x of [306.5, 309, 311.5]) cenario.push(point('cadeira', x, 88.6, { olhando: 270, cor: crng() < 0.5 ? '#f2f2ee' : '#e9d9a8' }));
  // a arquibancada de cimento, três degraus virados para a represa
  for (const [y0, altura] of [[90.5, 1.35], [91.3, 0.9], [92.1, 0.45]] as const) cenario.push(rect('muro', 304.5, 316, y0, round(y0 + 0.8), { altura, cor: '#bdb7a8', musgo: true, cipo: 0.1 }));
  // o mastro com a bandeira, encostado no vestiário
  cenario.push(point('mastro', round(B2.x1 + 0.25), 79, { altura: 7.6, cor: '#3f6fa8' }));
  // o mato tomando o pátio: manchas de grama, capim nas rachaduras e umas moitas
  for (const [x, y, rx, ry] of [[297.5, 86.5, 2.6, 1.6], [312, 74, 3.2, 1.2], [279.5, 87.8, 2.2, 1.0], [317, 90.5, 1.4, 2.4]] as const) chao.push(area('grama', blob(x, y, rx, ry, 0.2)));
  for (let i = 0, n = 0; i < 400 && n < 26; i++) {
    const [x, y] = [CLUB.x0 + crng() * (CLUB.x1 - CLUB.x0), CLUB.y0 + crng() * (CLUB.y1 - CLUB.y0)];
    if (isWater(x, y) || inRect(x, y, B1, 0.3) || inRect(x, y, B2, 0.3) || inRect(x, y, POOL, 0.8) || inRect(x, y, { x0: 304.5, x1: 316, y0: 88.2, y1: 92.9 }, 0.3)) continue;
    chao.push(point('planta', round(x), round(y), { tipo: crng() < 0.7 ? 'capim' : 'samambaia', raio: round(0.25 + crng() * 0.25) }));
    n++;
  }
}

// ----- 8 · a Ilha do Véu (vestida em 24/11): a Árvore do Véu, o Véu, a roda de pedras, o atracadouro e a beira; e a ilhota
// de antes, com as árvores dela (iguais: o sorteio dela vem antes) -----
{
  const FIG = ISLAND_FIG;
  cenario.push(point('arvore', FIG.x, FIG.y, { especie: 'figueira', copa: FIG.copa, altura: FIG.altura, tronco: FIG.tronco }, 'Árvore do Véu'));
  addTrunk({ x: FIG.x, y: FIG.y, r: FIG.tronco / 2 });
  // o Véu, na frente do tronco: o brilho no chão (a menos de 4 m do tronco, a figueira acende os símbolos dela) e a cortina
  // de raízes que brilham, de frente para a câmera; a pedra antiga de um lado e a oferenda do outro
  // (`coluna`: a luz sobe alta, para a ilha chamar a atenção de longe, da beira da represa)
  cenario.push(point('veu', ISLAND_VEIL.x, ISLAND_VEIL.y, { raio: 1.4, coluna: 12 }, 'Véu da Ilha'));
  cenario.push(point('cortina-veu', ISLAND_VEIL.x, ISLAND_VEIL.y, { largura: 4.2, altura: 6.5 }));
  const STONE = { x: 199.6, y: 149.3 };
  cenario.push(point('pedra', STONE.x, STONE.y, { raio: 1, ancestral: true }, 'Pedra da Ilha'));
  addTrunk({ x: STONE.x, y: STONE.y, r: 0.75 });
  const FIG_OFFER = { x: 191.6, y: 150.4 };
  cenario.push(point('oferenda', FIG_OFFER.x, FIG_OFFER.y, { velas: 5 }));
  addTrunk({ x: FIG_OFFER.x, y: FIG_OFFER.y, r: 0.3 });
  // a roda de pedras em pé: 9 pedras, uma a cada 40° (a trilha entra pelo vão do oeste), a face das itacoatiaras virada
  // para o meio, onde fica a oferenda
  const GLYPHS = ['espiral', 'sol', 'circulos', 'cobra'];
  const HEIGHTS = [2.4, 1.9, 2.2, 2.6, 2.0, 2.3, 1.8, 2.5, 2.1];
  const ringStones: Pt[] = [];
  for (let k = 0; k < 9; k++) {
    const a = (k * 40 * Math.PI) / 180;
    const [x, y] = [round(ISLAND_RING.x + Math.cos(a) * ISLAND_RING.r), round(ISLAND_RING.y + Math.sin(a) * ISLAND_RING.r)];
    cenario.push(point('menir', x, y, { altura: HEIGHTS[k]!, largura: 0.95, olhando: (k * 40 + 180) % 360, glifo: GLYPHS[k % GLYPHS.length]! }));
    addTrunk({ x, y, r: 0.45 });
    ringStones.push([x, y]);
  }
  cenario.push(point('oferenda', ISLAND_RING.x, ISLAND_RING.y, { velas: 7 }, 'Roda das Pedras'));
  addTrunk({ x: ISLAND_RING.x, y: ISLAND_RING.y, r: 0.3 });
  // o atracadouro, virado para o Refúgio: o deque, a canoa amarrada, os esteios com as fitas e a fogueira apagada
  cenario.push(box('deque', ISLAND_PIER, { altura: 0.6, palafitas: true }, 'Atracadouro da Ilha'));
  cenario.push(rect('barco', 167.4, 171.4, 149.35, 150.45, { tipo: 'canoa', cor: '#8a5a3a', olhando: 180 }));
  for (const y of [146.2, 149.9]) {
    cenario.push(point('esteio', 175.3, y, { altura: 2.2 }));
    addTrunk({ x: 175.3, y, r: 0.15 });
  }
  cenario.push(point('brasas', 178.6, 145.6, { raio: 0.6 }));
  addTrunk({ x: 178.6, y: 145.6, r: 0.6 });
  // a beira: pedras com musgo (no norte e no leste), taboas na água rasa e aguapés, longe do atracadouro
  const ICX = 196, ICY = 148;
  const islandEdge = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    let d = 0;
    while (inside(ICX + Math.cos(a) * d, ICY + Math.sin(a) * d, ISLAND)) d += 0.05;
    return { d, ux: Math.cos(a), uy: Math.sin(a) };
  };
  const nearPier = (x: number, y: number) => rectGap(x, y, ISLAND_PIER) < 4.5;
  for (const [deg, raio, altura] of [[252, 0.9, 1.1], [286, 1.1, 1.4], [318, 0.8, 1], [12, 1, 1.2], [58, 0.75, 0.9]] as const) {
    // (dentro da água rasa, encostada na beira: a caixa dela fica toda na água, sem vão de entalar com a beira)
    const e = islandEdge(deg);
    const out = raio * 0.75 + 0.25;
    const [x, y] = [round(ICX + e.ux * (e.d + out)), round(ICY + e.uy * (e.d + out))];
    cenario.push(point('rocha', x, y, { raio, altura, musgo: true }));
    addTrunk({ x, y, r: raio * 0.75 });
  }
  const brng = mulberry32(SEED + 50);
  for (let deg = 0; deg < 360; deg += 7) {
    const e = islandEdge(deg);
    const off = 0.5 + brng() * 0.6;
    const [x, y] = [round(ICX + e.ux * (e.d + off)), round(ICY + e.uy * (e.d + off))];
    // (no norte, de costas para a câmera, a taboa ficaria escondida atrás da beira: só no sul, no leste e no oeste)
    if (nearPier(x, y) || !isWater(x, y) || (deg > 250 && deg < 350)) continue;
    cenario.push(point('planta', x, y, { tipo: 'taboa', raio: round(0.35 + brng() * 0.25) }));
  }
  for (let deg = 18; deg < 360; deg += 41) {
    const e = islandEdge(deg);
    const off = 1.6 + brng() * 2.4;
    const [x, y] = [round(ICX + e.ux * (e.d + off)), round(ICY + e.uy * (e.d + off))];
    if (nearPier(x, y) || !isWater(x, y)) continue;
    cenario.push(point('aguape', x, y, { raio: round(0.5 + brng() * 0.5) }));
  }
  // os cogumelos que brilham, no pé da árvore grande e entre as pedras da roda
  const shrooms: Pt[] = [[189.4, 147.6], [190.6, 143.2], [197.8, 144.6], [192.4, 141.4], [198.9, 147.1], [205.8, 144.3], [208.2, 152.6], [215.2, 151.6], [214.1, 142.4]];
  for (const [x, y] of shrooms) cenario.push(point('planta', x, y, { tipo: 'cogumelo', brilho: '#3fd6c8', raio: 0.35 }));
  // as árvores sorteadas: longe da árvore grande, do Véu, da roda, do atracadouro, da trilha e da beira, e nenhuma tampa
  // na tela a trilha (ela está na vista do mapa), o atracadouro, o Véu ou a roda
  const ISLAND_KEYS: Pt[] = [...rectPoints(ISLAND_PIER), [ISLAND_VEIL.x, ISLAND_VEIL.y], [STONE.x, STONE.y], [FIG_OFFER.x, FIG_OFFER.y], [ISLAND_RING.x, ISLAND_RING.y], ...ringStones];
  const hidesIsland = (x: number, y: number, copa: number, altura: number) => ISLAND_KEYS.some(([kx, ky]) => covers(x, y, copa, altura, kx, ky));
  const shore: Pt[] = [...ISLAND, ISLAND[0]!];
  const irng = mulberry32(SEED + 4);
  for (const [cx, cy, rx, ry, count, isle] of [[92, 72, 6, 4, 6, ISLAND_SMALL], [196, 148, 22, 15, 14, ISLAND]] as const) {
    for (let i = 0, n = 0; i < 600 && n < count; i++) {
      const [x, y] = [cx - rx + irng() * rx * 2, cy - ry + irng() * ry * 2];
      if (!inside(x, y, isle) || dist(x, y, FIG.x, FIG.y) < FIG.copa + 1) continue;
      const big = isle === ISLAND;
      if (big && (distToPath(x, y, shore) < 2.2 || dist(x, y, ISLAND_RING.x, ISLAND_RING.y) < ISLAND_RING.r + 3 || distToPath(x, y, TRAIL_ISLAND) < 3.4 || rectGap(x, y, ISLAND_PIER) < 5 || dist(x, y, ISLAND_VEIL.x, ISLAND_VEIL.y) < 4 || dist(x, y, STONE.x, STONE.y) < 4.5 || dist(x, y, FIG_OFFER.x, FIG_OFFER.y) < 3.5)) continue;
      const especie = big ? (irng() < 0.45 ? 'jeriva' : irng() < 0.45 ? 'embauba' : 'mata') : irng() < 0.5 ? 'jeriva' : 'mata';
      const d = treeDims(especie, irng);
      if (nearTrunks(x, y, 4).some((t) => dist(x, y, t.x, t.y) < 2.6)) continue;
      if (big && (hidesView(x, y, d.copa, d.altura) || hidesIsland(x, y, d.copa, d.altura))) continue;
      addTrunk({ x, y, r: d.tronco / 2 });
      cenario.push(point('arvore', round(x), round(y), { especie, ...d }));
      n++;
    }
  }
}

// ----- 9 e 10 · a barragem de 1909 (24/11, o dono: "pode seguir vestindo a barragem de 1909") -----
// O prédio de comando da barragem, de 1909: tijolo antigo, janelas altas em arco, a cornija, o frontão com o ano e a
// árvore crescendo na laje; colada nele, a torre do relógio parado. Na frente, a praça de paralelepípedo com a grade de
// ferro e o portão de pilares, os postes antigos, a placa e a engrenagem velha largada. No muro da barragem: o
// parapeito, os postes de ferro e, em cima de cada comporta, o guincho (os pilares, a viga e o volante).
{
  cenario.push(box('casa', DAM_HOUSE, { altura: 7.4, andares: 2, estilo: 'historico', ano: '1909', abandonada: true, caixaDagua: false, cipo: 0.45, musgo: true, arvoreNaLaje: true }, 'Barragem de 1909'));
  cenario.push(box('casa', DAM_TOWER, { altura: 11, andares: 3, estilo: 'historico', relogio: true, abandonada: true, caixaDagua: false, cipo: 0.3 }, 'Torre do relógio'));
  chao.push(rect('piso', DAM_PLAZA.x0, DAM_PLAZA.x1, DAM_PLAZA.y0, DAM_PLAZA.y1, { desenho: 'paralelepipedo' }));
  // a grade de ferro com o portão (dois pilares de tijolo e o vão aberto no meio)
  const GATE = { x0: 333.2, x1: 338.8 };
  for (const [x0, x1] of [[DAM_PLAZA.x0, GATE.x0], [GATE.x1, DAM_PLAZA.x1]] as const) cenario.push(rect('gradil', x0, x1, 246, 246.1, { altura: 1.6 }));
  for (const x0 of [GATE.x0, GATE.x1 - 0.6]) cenario.push(rect('pilar', x0, round(x0 + 0.6), 245.75, 246.35, { altura: 2.1 }));
  cenario.push(point('placa', 330, 247.6, { texto: 'BARRAGEM DE 1909', poste: true }));
  addTrunk({ x: 330, y: 247.6, r: 0.1 });
  for (const x of [DAM_PLAZA.x0 + 0.6, DAM_PLAZA.x1 - 0.6]) cenario.push(point('poste-praca', x, 249.2, { altura: 3.6, luz: '#ffe9a6' }));
  cenario.push(point('engrenagem', 324.4, 247.2, { raio: 0.9 }));
  // o parapeito do muro, os postes de ferro ao longo dele e o guincho de cada comporta
  for (let x = DAM.x0; x < DAM.x1 - 0.5; x += 20) {
    cenario.push(rect('muro', round(x), round(Math.min(x + 20, DAM.x1)), DAM.y, round(DAM.y + 0.35), { altura: 0.9, cor: '#a8a296', musgo: true, cipo: 0.3 }));
  }
  for (const x of [160, 184, 204, 230, 256, 280, 300]) cenario.push(point('poste-praca', x, round(DAM.y + 0.55), { altura: 3.8, luz: '#ffe9a6', torto: x === 256 }));
  for (const gx of GATES) cenario.push(rect('guincho-comporta', gx - 2.6, gx + 2.6, DAM.y + 0.35, round(DAM.y + 0.85), { altura: 3.2 }));
  for (const gx of GATES) cenario.push(rect('cachoeira', gx - GATE_W, gx + GATE_W, DAM_WALK.y1, GATE_Y1, { altura: 1.5, queda: 'sul', musgo: true, estilo: 'comporta', tanque: GATE_BASIN }, 'Comporta'));
}

// ----- 12 · a Caverna Sagrada -----
// (24/11, o dono: "pode seguir vestindo a caverna") O morro de pedra com a boca virada para o sul (as itacoatiaras e as
// pinturas de ocre em volta dela, a luz verde-água lá no fundo); na clareira de pedra em frente, a fogueira, as duas
// oferendas encostadas no paredão, a pedra ancestral, as pedras soltas dos dois lados e os esteios com as fitas na
// entrada da trilha. Não dá para entrar na caverna (a boca pode virar uma saída para dentro, depois).
{
  cenario.push(box('caverna', CAVE_HILL, { altura: 5.4, boca: 3.2, bocaAltura: 2.5, bocaX: CAVE.x }, 'Caverna Sagrada'));
  addTrunk({ x: (CAVE_HILL.x0 + CAVE_HILL.x1) / 2, y: (CAVE_HILL.y0 + CAVE_HILL.y1) / 2, r: 7 });
  for (const [x, y, raio, altura] of [[29.1, 265.95, 1, 1.5], [27.5, 264.7, 0.9, 1.2], [39.1, 266, 1.1, 1.7], [41.2, 264.4, 0.85, 1.1]] as const) {
    cenario.push(point('rocha', x, y, { raio, altura }));
    addTrunk({ x, y, r: raio });
  }
  for (const x of [CAVE.x - 2.4, CAVE.x + 2.4]) cenario.push(point('oferenda', x, round(CAVE_HILL.y1 + 0.35), { velas: 4 }));
  // (a fogueira apagada, com brasas: a acesa marca as zonas seguras, e a caverna não é uma)
  cenario.push(point('brasas', CAVE.x, 270, { raio: 0.7 }));
  cenario.push(point('pedra', 40.6, 269.2, { raio: 0.7, ancestral: true }));
  addTrunk({ x: 40.6, y: 269.2, r: 0.7 });
  // os esteios com as fitas, um de cada lado da trilha, na entrada da clareira
  for (const [x, y] of [[29, 268.8], [26, 270.7]] as const) {
    cenario.push(point('esteio', x, y, { altura: 2.2 }));
    addTrunk({ x, y, r: 0.15 });
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
    const tipo = wet ? 'taboa' : prng() < 0.75 ? 'samambaia' : 'capim';
    // (o sorteio do tipo vem antes: tirar estas não mexe nas plantas do resto do mapa)
    if (inRect(x, y, LOOKOUT, 0.6) || dist(x, y, CAVE.x, CAVE.y) < 8) continue;
    cenario.push(point('planta', round(x), round(y), { tipo, raio }));
    n++;
  }
}

// ---------------- os detalhes (24/11, "pode seguir com os detalhes do Guarapiranga"), parte 2 ----------------
// A várzea de caça (o jirau do caçador, as pinguelas de tábua nos dois canais, as árvores secas e o acampamento de caça)
// e as placas de madeira da trilha da margem sul. Tudo depois do sorteio das árvores e das plantas: nada aqui mexe no
// resto do mapa. Cada coisa procura um lugar livre perto do pedido (sem água, trilha nem tronco por perto).
/** Pedaços de chão de andar por cima da água (o atracadouro da ilha e as pinguelas): a colisão da água fica de fora. */
const WALKWAYS: Rect[] = [ISLAND_PIER];
/** O que entrou nesta parte, para tirar as plantas de enfeite que ficaram por baixo. */
const LATE_SOLIDS: Rect[] = [];
function freeSpot(x: number, y: number, hw: number, hh = hw): Pt {
  for (let r = 0; r <= 10; r += 0.5) {
    const n = Math.max(1, Math.round(r * 6));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const [px, py] = [round(x + Math.cos(a) * r), round(y + Math.sin(a) * r)];
      const corners: Pt[] = [[px - hw, py - hh], [px + hw, py - hh], [px - hw, py + hh], [px + hw, py + hh], [px, py]];
      if (corners.some(([cx, cy]) => waterGap(cx, cy) < 1.4 || trailGap(cx, cy) < 0.6 || roadGap(cx, cy) < 1)) continue;
      if (nearTrunks(px, py, hw + hh + 4).some((t) => rectGap(t.x, t.y, { x0: px - hw, x1: px + hw, y0: py - hh, y1: py + hh }) - t.r < 1.4)) continue;
      return [px, py];
    }
  }
  throw new Error(`Não achei lugar livre perto de (${x}, ${y}).`);
}
const lateRect = (r: Rect) => {
  LATE_SOLIDS.push(r);
  addTrunk({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, r: Math.hypot(r.x1 - r.x0, r.y1 - r.y0) / 2 });
};
{
  // o jirau do caçador: a torre baixa de troncos, com o telhado de sapê, no leste da várzea (longe da barragem: não
  // tampa o caminho dela na tela)
  const [jx, jy] = freeSpot(316, 288, 1.5, 1.9);
  const J: Rect = { x0: round(jx - 1.5), x1: round(jx + 1.5), y0: round(jy - 1.9), y1: round(jy + 1.9) };
  cenario.push(box('torre-mirante', J, { altura: 2.4, escada: 1, jirau: true }, 'Jirau do caçador'));
  lateRect(J);
  // as pinguelas de tábua por cima dos dois canais da comporta (1,5 m de largura, na grade das faixas de água)
  for (const c of CHANNELS) {
    const y = 272;
    let cx = c[0]![0];
    for (let i = 0; i + 1 < c.length; i++) {
      const [[ax, ay], [bx, by]] = [c[i]!, c[i + 1]!];
      if ((ay - y) * (by - y) <= 0 && ay !== by) cx = ax + ((y - ay) / (by - ay)) * (bx - ax);
    }
    const P: Rect = { x0: round(cx - 2.5), x1: round(cx + 2.5), y0: 271, y1: 272.5 };
    cenario.push(box('pinguela', P, { altura: 0.4 }));
    WALKWAYS.push(P);
  }
  // as árvores secas no meio da lama (sem folha: não tampam nada na tela)
  for (const [tx, ty] of [[188, 268], [234, 304], [284, 262]] as const) {
    const [x, y] = freeSpot(tx, ty, 0.6);
    const d = SPECIES.seca!;
    addTrunk({ x, y, r: d.tronco / 2 });
    cenario.push(point('arvore', x, y, { especie: 'seca', ...d }));
  }
  // o acampamento de caça, perto do fim da trilha da margem sul: a fogueira apagada, o tronco de sentar, os caixotes e
  // a rede de pesca secando nos dois paus (os vãos entre eles: mais de 1,2 m, ou colados)
  const [cx, cy] = freeSpot(152, 268, 3.4, 2.6);
  cenario.push(point('brasas', cx, cy, { raio: 0.6 }));
  lateRect({ x0: cx - 0.6, x1: cx + 0.6, y0: cy - 0.6, y1: cy + 0.6 });
  const log: Rect = { x0: round(cx - 0.9), x1: round(cx + 0.9), y0: round(cy + 1.9), y1: round(cy + 2.35) };
  cenario.push(box('tronco-caido', log, { altura: 0.45 }));
  lateRect(log);
  for (const dy of [-0.9, -0.3]) {
    const b: Rect = { x0: round(cx + 2.1), x1: round(cx + 2.7), y0: round(cy + dy), y1: round(cy + dy + 0.6) };
    cenario.push(box('caixote', b, { altura: 0.5 }));
    lateRect(b);
  }
  const net: Rect = { x0: round(cx - 3.2), x1: round(cx - 0.8), y0: round(cy - 2.2), y1: round(cy - 2) };
  cenario.push(box('rede', net, { altura: 1.6 }));
  lateRect(net);
}
{
  // as placas de madeira da trilha: nos cruzamentos e nas pontas, o esteio com uma tábua por destino, a seta do jeito
  // que aparece na tela; a placa fica do lado de trás da trilha (na tela, ela não tampa a trilha)
  const arrowTo = (fx: number, fy: number, tx: number, ty: number) => {
    const [dx, dy] = [tx - fx, ty - fy];
    const a = (Math.atan2((dx + dy) * 0.3536, (dx - dy) * 0.7071) * 180) / Math.PI;
    return ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][((Math.round(a / 45) % 8) + 8) % 8]!;
  };
  /** O ponto da trilha mais perto de (x, y) e a direção dela ali. */
  const along = (t: Pt[], x: number, y: number) => {
    let best = { d: Infinity, i: 0 };
    t.forEach(([px, py], i) => {
      const d = dist(px, py, x, y);
      if (d < best.d) best = { d, i };
    });
    const [a, b] = [t[Math.max(0, best.i - 1)]!, t[Math.min(t.length - 1, best.i + 1)]!];
    const l = dist(a[0], a[1], b[0], b[1]) || 1;
    return { p: t[best.i]!, ux: (b[0] - a[0]) / l, uy: (b[1] - a[1]) / l };
  };
  const signs: [Pt[], number, number, number, [string, number, number][]][] = [
    // (a trilha, o ponto, a distância do meio dela, os destinos com o ponto para onde a seta aponta)
    [TRAIL_SOUTH, 34, 64, 2.4, [['CAVERNA', 28, 76], ['BARRAGEM', 28, 76], ['REFÚGIO', 39.4, 56.6]]],
    [TRAIL_SOUTH, 27.5, 142, 2.6, [['CAVERNA', 21, 168], ['BARRAGEM', 32.5, 162], ['REFÚGIO', 23.5, 122]]],
    [TRAIL_SOUTH, 140, 250, 2.4, [['BARRAGEM', 160, 252], ['VÁRZEA DE CAÇA', 150, 266], ['REFÚGIO', 122, 246]]],
  ];
  for (const [t, x, y, off, dests] of signs) {
    const { p, ux, uy } = along(t, x, y);
    // a normal do lado de trás (para onde x + y diminui)
    let [nx, ny] = [-uy, ux];
    if (nx + ny > 0) [nx, ny] = [-nx, -ny];
    const [sx, sy] = [round(p[0] + nx * off), round(p[1] + ny * off)];
    const texto = dests.map(([name, tx, ty]) => `${name} ${arrowTo(p[0], p[1], tx, ty)}`).join('|');
    cenario.push(point('placa', sx, sy, { texto, madeira: true, poste: true }));
    addTrunk({ x: sx, y: sy, r: 0.1 });
  }
}
{
  // a estrada fechada para Santo Amaro: a placa pintada à mão antes da barreira, a árvore caída atravessada depois dela
  // e o carro abandonado, tomado pelo mato, na pista de baixo (a chegada de quem vier de Santo Amaro, em (380, 230),
  // fica livre; os vãos com a barreira passam de 1,2 m)
  cenario.push(point('placa', 391.6, 228, { texto: 'ESTRADA FECHADA', madeira: true, poste: true }));
  addTrunk({ x: 391.6, y: 228, r: 0.1 });
  const trunk: Rect = { x0: 396, x1: 396.8, y0: 223, y1: 237 };
  cenario.push(box('tronco-caido', trunk, { altura: 0.8 }));
  lateRect(trunk);
  const car: Rect = { x0: 384, x1: 388, y0: 231.4, y1: 233.6 };
  cenario.push(box('carro', car, { altura: 1.4, cor: '#5d7f9a', mato: true }));
  lateRect(car);
}
// (as plantas de enfeite que ficaram por baixo das coisas novas saem; tirar não mexe no sorteio)
for (let i = cenario.length - 1; i >= 0; i--) {
  const o = cenario[i]!;
  if (o.type === 'planta' && LATE_SOLIDS.some((r) => inRect(o.x, o.y, r, 0.4))) cenario.splice(i, 1);
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
  if (s.type === 'mesa') return [block('mesa', s.x, s.y, 0.8, { bloqueiaTiro: false, altura: 0.75 })];
  if (s.type === 'cadeira') return [block('cadeira', s.x, s.y, 0.5, { bloqueiaTiro: false, altura: 0.8 })];
  if (s.type === 'gradil') return [box('gradil', r, { bloqueiaTiro: false, altura: Number(p.altura) || 1.6 })];
  if (s.type === 'pilar') return [box('pilar', r, { altura: Number(p.altura) || 2 })];
  if (s.type === 'engrenagem') return [block('engrenagem', s.x, s.y, round(Number(p.raio) * 1.4), { altura: Number(p.raio) * 1.6 })];
  if (s.type === 'guincho-comporta') return [box('pilar', { x0: r.x0, x1: round(r.x0 + 0.5), y0: r.y0, y1: r.y1 }, { altura: Number(p.altura) }), box('pilar', { x0: round(r.x1 - 0.5), x1: r.x1, y0: r.y0, y1: r.y1 }, { altura: Number(p.altura) })];
  if (s.type === 'mastro') return [block('mastro', s.x, s.y, 0.3, { altura: Number(p.altura) })];
  // (o trampolim: só a base de cimento, na beira da piscina; a prancha fica por cima da água)
  if (s.type === 'trampolim') return [box('trampolim', { x0: round(r.x1 - 0.7), x1: r.x1, y0: r.y0, y1: r.y1 }, { bloqueiaTiro: false, altura: 0.5 })];
  if (s.type === 'vaso' || s.type === 'lixeira') return [block(s.type, s.x, s.y, 0.5, { bloqueiaTiro: false, altura: 0.8 })];
  if (s.type === 'moto') return [box('moto', r, { bloqueiaTiro: false, altura: Number(p.altura) })];
  if (s.type === 'carro') return [box('carro', r, { altura: Number(p.altura) })];
  if (s.type === 'pneus') return [block('pneus', s.x, s.y, round(Number(p.raio) * 1.8), { bloqueiaTiro: false, altura: 0.9 })];
  if (s.type === 'rede' || s.type === 'varal') return [box(s.type, r, { bloqueiaTiro: false, altura: Number(p.altura) })];
  if (s.type === 'muro') return [box('muro', r, { altura: Number(p.altura) })];
  if (s.type === 'barreira') return [box('barreira', r, { bloqueiaTiro: false, altura: Number(p.altura) })];
  if (s.type === 'torre-mirante') return [box('torre-mirante', r, { altura: Number(p.altura) })];
  if (s.type === 'guarda-corpo') return [box('guarda-corpo', r, { bloqueiaTiro: false, altura: Number(p.altura) })];
  if (s.type === 'luneta') return [block('luneta', s.x, s.y, 0.4, { bloqueiaTiro: false, altura: 1.4 })];
  if (s.type === 'painel-mirante') return [box('painel-mirante', r, { bloqueiaTiro: false, altura: 2 })];
  if (s.type === 'caverna') {
    // o morro: o corpo (a frente reta, onde fica a boca) e o fundo mais estreito (as quinas de trás são chanfradas)
    return [
      box('caverna', { x0: round(r.x0 + 0.3), x1: round(r.x1 - 0.2), y0: round(r.y0 + 1.2), y1: r.y1 }, { altura: Number(p.altura) }),
      box('caverna', { x0: round(r.x0 + 1.5), x1: round(r.x1 - 1.5), y0: round(r.y0 + 0.3), y1: round(r.y0 + 1.3) }, { altura: Number(p.altura) }),
    ];
  }
  if (s.type === 'rocha') return [block('pedra', s.x, s.y, round(Number(p.raio) * 1.5))];
  if (s.type === 'alambrado') return [box('alambrado', r, { bloqueiaTiro: false, altura: Number(p.altura) })];
  if (s.type === 'banca-pastel') return [box('banca', r, { bloqueiaTiro: false, altura: Number(p.altura) })];
  // (a pedra em pé da roda da ilha: um quadrado do tamanho da laje de pedra)
  if (s.type === 'menir') return [block('pedra', s.x, s.y, 0.8, { altura: Number(p.altura) })];
  if (s.type === 'oferenda') return [block('oferenda', s.x, s.y, 0.6, { bloqueiaTiro: false, altura: 0.5 })];
  if (s.type === 'brasas') return [block('brasas', s.x, s.y, 1.2, { bloqueiaTiro: false, altura: 0.3 })];
  if (s.type === 'esteio') return [block('poste', s.x, s.y, 0.3, { altura: Number(p.altura) })];
  if (s.type === 'coreto') {
    // a base octogonal (seis caixas por dentro do octógono, escalonadas nos lados de 45°) e a escada do lado sul
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    const R = Number(p.raio), f = R * Math.cos(Math.PI / 8), v = R * Math.sin(Math.PI / 8);
    const out: Shape[] = [];
    for (let i = 0; i <= 5; i++) {
      const hx = f + ((v - f) * i) / 5, hy = v + ((f - v) * i) / 5;
      out.push(box('coreto', { x0: round(cx - hx), x1: round(cx + hx), y0: round(cy - hy), y1: round(cy + hy) }, { altura: 1.05 }));
    }
    out.push(box('coreto', { x0: round(cx - 1.3), x1: round(cx + 1.3), y0: round(cy + f - 0.1), y1: round(cy + f + 1.28) }, { bloqueiaTiro: false, altura: 1 }));
    return out;
  }
  if (s.type === 'cachoeira') {
    const out = [box('cachoeira', r, { bloqueiaTiro: false, altura: Number(p.altura) })];
    // (a comporta: as alas de pedra dos dois lados do tanque)
    if (p.estilo === 'comporta') {
      const y1 = r.y1 + Number(p.tanque);
      out.push(box('muro', { x0: round(r.x0 - GATE_WING), x1: r.x0, y0: r.y1, y1 }, { bloqueiaTiro: false, altura: 0.6 }));
      out.push(box('muro', { x0: r.x1, x1: round(r.x1 + GATE_WING), y0: r.y1, y1 }, { bloqueiaTiro: false, altura: 0.6 }));
    }
    return out;
  }
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
// (o atracadouro da ilha é chão de andar; ele fica fora do `isWater` de cima, que decide o sorteio das plantas da água)
const waterBoxes = waterStrips((x, y) => !WALKWAYS.some((r) => inRect(x, y, r)) && isWater(x, y), 0, W, 0, H);
/**
 * Nenhum vão de entalar (0,3 a 1,2 m entre duas coisas sólidas de frente uma para a outra, sem nada no meio) em lugar
 * nenhum: o mapa é todo aberto. As árvores sorteadas que ficam num vão desses saem (uma de cada vez, até não sobrar vão);
 * se o vão for entre duas coisas postas à mão, o gerador para com erro.
 */
// o mirante: a mata aberta para o leste, até a margem (só sai árvore sorteada, depois de todas postas: tirar antes
// mexeria no sorteio do resto do mapa)
for (let i = cenario.length - 1; i >= 0; i--) {
  const o = cenario[i]!;
  if (o.type === 'arvore' && o.name === undefined && inRect(o.x, o.y, LOOKOUT_VIEW)) cenario.splice(i, 1);
}
// o campinho (24/11): sai a árvore sorteada colada na arquibancada, no muro do time ou no alambrado (pelo mesmo motivo)
for (let i = cenario.length - 1; i >= 0; i--) {
  const o = cenario[i]!;
  if (o.type === 'arvore' && o.name === undefined && [FIELD_STANDS, FIELD_WALL, FIELD_FENCE].some((r) => inRect(o.x, o.y, r, 1.6 + Number(o.props?.tronco ?? 0) / 2))) cenario.splice(i, 1);
}
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
// a chegada de barco na Ilha do Véu, na ponta de terra do atracadouro (a viagem com o Barqueiro é da [estrutura], depois)
pontos.push(point('ponto', 172.4, 148, undefined, 'chegada-ilha-do-veu'));
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
