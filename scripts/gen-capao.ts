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
import { writeMapImage } from './mapa-de-cima';
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
/**
 * O padrão novo (13/11, pedido do dono): a floresta reinando sobre a vila. Liga o meio-fio, a faixa apagada, os remendos,
 * as rachaduras com mato, os bueiros, a Figueira da Esquina, as raízes, o cipó nas casas, nos postes e nos fios, o prédio
 * do conjunto no fundo e a vida na rua (moto, placa de rua, cadeiras, vasos, lixo, bandeirinhas).
 */
const FLORESTA = true;
const W = 96;
/**
 * O mapa cresceu para o sul em 13/11 (o dono pediu a mata 50% maior: o parque foi até y = 120 e a vila até y = 80) e de
 * novo em 14/11 (a floresta maior, planta aprovada): mais 60 m para o sul, sem mudar nada de lugar. Tudo o que é sorteado
 * até y = H0 usa H0 (sai igual a antes); a faixa nova (y de H0 a H) tem sorteios próprios.
 */
const H = 180;
const H0 = 120;
/** Liga a faixa nova da floresta maior (o parque ao sul, a mata da estrada, o posto e as árvores novas da vila). */
const FLORESTA_MAIOR = true;
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

// ---------------- a floresta maior (14/11): o parque ao sul ----------------
/** A Clareira da Paineira (o parquinho antigo engolido pela mata, debaixo da paineira). */
const PAINEIRA_C = { x: 32, y: 150, r: 6.5 };
/** O poço da Cachoeirinha: o riacho cai das pedras do norte, enche o poço e sai pelo sul. */
const POOL = { x: 14.3, y: 159.5, rx: 3.8, ry: 3.2 };
/** O riacho continua do fim antigo (14,5; 120) até a beira nova do mapa, passando pelo poço. */
const STREAM_SOUTH: [number, number][] = [[14.5, H0], [12, 131], [15.5, 142], [13.5, 153], [14.3, 159.5], [15.5, 171], [13.5, H]];
/** A mata profunda do sul (neblina, escuro, os bichos mais fortes) e o recanto do Véu no fim da trilha dela. */
const DEEP_SOUTH = { x: 11, y: 169, rx: 10.5, ry: 9 };
const RECANTO = { x: 6.5, y: 173, r: 3.5 };
/**
 * As trilhas novas: da trilha do sul (no meio do trecho que desce para a pinguela) até a paineira; da paineira ao poço;
 * do poço, pelas pedras do riacho, ao recanto; e da paineira ao buraco no gradil. A primeira passa pela mata antiga: só
 * três árvores saem do caminho (o traçado que menos tira).
 */
const SOUTH_TRAILS: { pts: [number, number][]; largura: number }[] = [
  { pts: [[22.25, 102.25], [25, 108], [30.5, 116], [29.5, 124], [31, 133], [31.6, 143.6]], largura: TRAIL_W },
  { pts: [[26, 152.6], [21.5, 155.5], [18.6, 158.6]], largura: TRAIL_W },
  { pts: [[18.6, 160.6], [17.6, 163.4], [16.6, 165], [13.1, 165], [10.5, 168.5], [8.6, 170.8]], largura: 1.6 },
  { pts: [[38.2, 152.4], [43, 157.5], [48, 161.2]], largura: TRAIL_W },
];
/** As árvores da mata antiga que saem do caminho da trilha nova (x, y do tronco). */
const SOUTH_TRAIL_CLEARED: [number, number][] = [[26.9, 107.3], [23.9, 105.2], [35.0, 117.2]];
/** O buraco no gradil: a passagem do parque para a mata da estrada (com um pedaço de gradil torto em cada ponta). */
const FENCE_HOLE = { y0: 160, y1: 162.4 };
/** Áreas dos bichos novos (quati, tatu-bola, marimbondos e o filhote de boitatá), com a mata mais aberta. */
const NEW_ZONES = {
  meio: { x0: 20, x1: 38, y0: 112, y1: 140 },
  chefe: { x0: 2, x1: 12, y0: 167, y1: 178 },
  estradaNorte: { x0: 52, x1: 86, y0: 92, y1: 136 },
  estradaSul: { x0: 52, x1: 86, y0: 154, y1: 177 },
};
// ---------------- a floresta maior: a mata da estrada e o posto ----------------
/** O posto abandonado na beira da estrada: o pátio de concreto, a cobertura das bombas e a lojinha. */
const POSTO = { x0: 73, x1: 88, y0: 139, y1: 150 };
const POSTO_ROOF = { x0: 79.4, x1: 86.6, y0: 140.6, y1: 147.4 };
const POSTO_SHOP = { x0: 73.6, x1: 78, y0: 139.6, y1: 144.2 };
/** A trilha do buraco no gradil até o fundo do posto, pela mata da estrada. */
const EAST_TRAIL: [number, number][] = [[48, 161.2], [53, 161], [60, 158.5], [66, 153], [71.4, 148.4], [73.4, 147.6]];

// ---------------- a Vila do Capão (etapa 4b) ----------------
/** A rua que sai do portão para o leste e a rua para o sul (a saída para Guarapiranga só abre na etapa 4c). */
const STREET = { x0: 56, x1: W, y0: 41, y1: 47 };
const ROAD_S = { x0: 88, x1: 94, y0: 47, y1: VILLAGE_S };
/** A praça (pedra portuguesa) e a Budega, a vendinha da praça (o negócio do dono; nada de tabaco). */
const SQUARE = { x0: 61, x1: 79, y0: 48.5, y1: 59 };
/**
 * A Budega maior, igual à de verdade (15/11, pedido do dono, com as fotos dele): 8 × 5,5 m (antes 5 × 3), no mesmo
 * canto da praça. Fachada preta com o escudo dourado e moldura amarela; a vitrine grande à esquerda e a porta de enrolar
 * larga à direita (como na loja dele); por dentro, piso branco, prateleiras pretas e amarelas, a parede de grama com o
 * escudo aceso e as flores, e a floresta entrando (sem "tabacaria", sem narguilé e sem marcas).
 */
const BUDEGA = { x0: 60.5, x1: 68.5, y0: 48.9, y1: 54.4 };
/** A porta de enrolar (3 m), na frente, do lado direito; a vitrine fica do lado esquerdo. */
const BUDEGA_DOOR = { x0: 65, x1: 68 };
/** A frente da porta da Budega, do lado da praça: fica livre (nada da praça encosta aqui). */
const BUDEGA_FRONT = { x: 66.5, y: 55.2 };
/**
 * A Budega por dentro (padrão novo; pedido do dono, como no HumanitZ: com o herói lá dentro, o telhado e a frente
 * somem). Paredes de 15 cm; a porta é o vão da porta de enrolar (a frente toda, menos 34 cm de cada ponta). A Xiovanna
 * fica atrás do balcão (o lugar dela é da [estrutura], em data/npcs.json); quem compra fica na frente do balcão.
 */
const BUDEGA_WALL = 0.15;
const BUDEGA_DOOR_SIDE = 0.34;
/** As prateleiras ficam coladas na parede do fundo: na colisão, a parede do fundo vai até a frente delas. */
const BUDEGA_SHELF = 0.35;
const BUDEGA_INSIDE = { x0: BUDEGA.x0 + BUDEGA_WALL, x1: BUDEGA.x1 - BUDEGA_WALL, y0: BUDEGA.y0 + BUDEGA_WALL, y1: BUDEGA.y1 - BUDEGA_WALL };
/**
 * O pé da Xiovanna, atrás do caixa, na frente da parede de grama com o escudo aceso (o mesmo número vai para o
 * data/npcs.json, pela [estrutura]). Quem compra fica do outro lado do caixa, 1 m ao sul dela.
 */
const XIOVANNA = { x: 66.6, y: 50.55 };
/**
 * A fogueira da praça, com bancos em volta (a oeste da árvore, para a copa não cobrir o fogo). Com a Budega maior ela
 * andou 2 m para a direita (antes em 69,5; 56); mais para lá a copa da árvore da praça cobre o fogo na tela.
 */
const FIRE = { x: 71.5, y: 56 };
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
const POSTS: [number, number][] = FLORESTA
  ? // pedido do dono (13/11): na rua do portão, os postes ficam na calçada das casas, que para a câmera fica atrás de
    // quem anda na rua (antes ficavam na calçada da praça, na frente do personagem e das fachadas)
    // (o da esquina com a rua de baixo também vem para cá: na calçada da praça ele ficava na frente de quem anda)
    // (o da casa rosa fica em 71,2, na divisa com a casa azul: a Figueira da Esquina está na frente da casa rosa)
    [[50.5, 40], [61.5, 40.86], [71.2, 40.86], [80, 40.86], [90.5, 40.86], [87.6, 63], [87.6, 76]]
  : [[50.5, 40], [60, 47.8], [70, 47.8], [80, 47.8], [87.6, 47.6], [87.6, 63], [87.6, 76]];
/** A fiação: cada linha liga os postes de uma rua (no padrão novo, nenhum fio atravessa a rua do portão). */
const WIRES: [number, number][][] = FLORESTA
  ? [
      [[50.5, 40], [61.5, 40.86], [71.2, 40.86], [80, 40.86], [90.5, 40.86]],
      [[87.6, 63], [87.6, 76]],
    ]
  : [POSTS];
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
/** A barreira com a placa: na floresta maior ela desceu para o fim novo da rua (antes ficava em SOUTH_BARRIER_Y0). */
const SOUTH_BARRIER_Y0 = 114.5;
/** (na mesma linha de um arbusto das paredes da rua, que vão de 1,1 em 1,1 m: assim a barreira encosta nos dois lados) */
/**
 * O Mapa 02 (Guarapiranga) está no jogo (19/11): a barreira sai, a placa vai para um poste na beira oeste da rua e a
 * beira do mapa, no fim da rua, vira a saída para lá; quem volta de lá aparece na rua, 3,5 m antes da beira.
 */
const GUARA_LINK = true;
const SOUTH_BARRIER_Y = FLORESTA_MAIOR ? Math.round((VILLAGE_S + 0.6 + 1.1 * Math.round((H - 5.5 - VILLAGE_S - 0.6) / 1.1) - 0.25) * 100) / 100 : SOUTH_BARRIER_Y0;

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
/** Saídas para outros mapas (camada "saidas"): `mapa` é o arquivo de lá e `chegada` o ponto onde se aparece. */
const saidas: Shape[] = [];

const rect = (type: string, x0: number, x1: number, y0: number, y1: number, props?: Props, name?: string): Shape => ({ type, name, x: x0, y: y0, w: x1 - x0, h: y1 - y0, props });
const ellipse = (type: string, cx: number, cy: number, r: number, props?: Props): Shape => ({ type, x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, ellipse: true, props });
const point = (type: string, x: number, y: number, props?: Props, name?: string): Shape => ({ type, name, x, y, point: true, props });
/** Quadrado de colisão centrado em (x, y). */
const block = (type: string, x: number, y: number, side: number, props?: Props): Shape => rect(type, x - side / 2, x + side / 2, y - side / 2, y + side / 2, props);
/**
 * A colisão da moita fechada (redonda, de raio `r`): um octógono de três caixas — a cruz, que vai a 0,9 × r para os quatro
 * lados (como o quadrado de antes), e o quadrado do meio, de 1,4 × r (as quinas na beira das folhas). As pontas do
 * quadrado de antes passavam ~30 cm das folhas e travavam o pé no nada.
 */
/** De qual moita é cada caixa (o octógono pode voltar a ser o quadrado: veja a conferência dos vãos da vila). */
const BUSH_OF = new Map<Shape, { x: number; y: number; r: number; boxes: Shape[] }>();
const bushBoxes = (x: number, y: number, r: number): Shape[] => {
  const [a, b] = [round(r * 0.9), round(r * 0.5)];
  const c = round(r * 0.7);
  return [
    rect('mata-fechada', round(x - a), round(x + a), round(y - b), round(y + b)),
    rect('mata-fechada', round(x - b), round(x + b), round(y - a), round(y + a)),
    rect('mata-fechada', round(x - c), round(x + c), round(y - c), round(y + c)),
  ];
};

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
/** As pedras de atravessar o riacho, logo abaixo do poço da cachoeirinha (onde a trilha do recanto cruza o riacho). */
const [stonesX, stonesY] = crossing(SOUTH_TRAILS[2]!.pts, STREAM_SOUTH);
const PEDRAS = { x0: round(stonesX - 1.7), x1: round(stonesX + 1.7), y0: round(stonesY - 0.7), y1: round(stonesY + 0.7) };
/** O contorno da água do poço. */
const POOL_PTS = blob(POOL.x, POOL.y, POOL.rx, POOL.ry, 0.12, 28);
/**
 * Os riachos e poços que a mata já conhece. Começa só com o riacho antigo: o da floresta maior entra depois que a mata
 * antiga foi sorteada (a distância até a água decide onde nasce cada planta, e a mata antiga tem de sair igual).
 */
const STREAMS: [number, number][][] = [STREAM];
const PONDS: [number, number][][] = [];
/** Água de verdade (onde o pé não entra): o lago, o riacho e o poço, menos o deque, a pinguela e as pedras. */
const isWater = (x: number, y: number) =>
  (inside(x, y, WATER_PTS) || PONDS.some((p) => inside(x, y, p)) || STREAMS.some((s) => distToPath(x, y, s) <= STREAM_W / 2)) &&
  !inRect(x, y, DECK) &&
  !inRect(x, y, PINGUELA) &&
  !inRect(x, y, PEDRAS);

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
  // faixa de pedestre atravessando a Travessa (listras compridas no sentido da rua, y). No padrão novo ela fica na
  // esquina, logo ao sul do cruzamento, e não no meio dele (pedido do dono, 13/11)
  const cw = FLORESTA ? { y0: 47.8, y1: 50.6 } : { y0: 42.5, y1: 45.5 };
  chao.push(rect('faixa', 49.5, 56, cw.y0, cw.y1, { listras: 'y' }));
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
/** Quanto falta até a água (o lago, os riachos e os poços que a mata já conhece); negativo dentro do lago ou do poço. */
const waterGap = (x: number, y: number) =>
  Math.min(
    lakeGap(x, y),
    ...STREAMS.map((s) => distToPath(x, y, s) - STREAM_W / 2),
    ...PONDS.map((p) => (inside(x, y, p) ? -1 : 1) * distToPath(x, y, [...p, p[0]!])),
  );
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
// o lugar das capivaras na margem oeste do lago. Até 14/11 eram três de enfeite, paradas; agora elas andam em bando (a
// [estrutura], em data/bichos.json) e aqui fica só o lugar delas (a área e onde descansam, na camada `pontos`). Os
// lugares continuam guardados (nada nasce em cima) e a mata em volta sai igual
const shoreK = (a: number) => 1 + LAKE_WOBBLE * (0.6 * Math.sin(a * 3 + 1.3) + 0.4 * Math.cos(a * 5 + 0.4));
const LAKE_CAPYS: [number, number][] = [];
for (const a of [2.5, 2.85, 3.5]) {
  const k = shoreK(a);
  const [x, y] = [round(LAKE.x + Math.cos(a) * (LAKE.rx * k + 1.3)), round(LAKE.y + Math.sin(a) * (LAKE.ry * k + 1.2))];
  reserved.push({ x, y, r: 1.2 });
  LAKE_CAPYS.push([x, y]);
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
  const y = 2 + rng() * (H0 - 4);
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
  const [x, y] = [2 + rng() * (PARK_X - 4), 2 + rng() * (H0 - 4)];
  if (!DEEP.some((d) => inEllipse(x, y, d)) && plant(x, y, 'seca', SPECIES.seca!, TRUNK_GAP + 1.5)) n++;
}
// xaxins na beira da água, onde é úmido
for (let i = 0, n = 0; i < 4000 && n < 18; i++) {
  const [x, y] = [2 + rng() * (PARK_X - 4), 30 + rng() * (H0 - 32)];
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
for (let y = 0.6; y < H0; y += 1.1) edge.push([0.6, y]);
for (let x = 1.7; x < PARK_X - 0.6; x += 1.1) edge.push([x, 0.6], [x, H0 - 0.6]);
for (const [x, y] of edge) {
  const raio = round(0.9 + rng() * 0.25); // sorteado sempre, na mesma ordem (o resto da mata não muda)
  // na floresta maior a beira sul antiga sai: o parque continua para o sul (a beira nova fica no fim do mapa)
  if (!(FLORESTA_MAIOR && y > H0 - 1)) cenario.push(point('arbusto', round(x), round(y), { raio, fechado: true }));
}

// ----- o chão da mata (não bloqueia): samambaias, helicônias, taboas, aguapés e cogumelos que brilham -----
const lowFits = (x: number, y: number, raio: number) =>
  trailGap(x, y) >= raio + 0.2 &&
  dist(x, y, C.x, C.y) >= CLEARING_R - 1 &&
  dist(x, y, BANANA.x, BANANA.y) >= BANANA.r - 1 &&
  trees.every((t) => dist(x, y, t.x, t.y) > t.tronco / 2 + raio * 0.6) &&
  clumps.every((c) => dist(x, y, c.x, c.y) > c.r + raio * 0.5);
for (let i = 0, n = 0; i < 4000 && n < 130; i++) {
  const [x, y, raio] = [2 + rng() * (PARK_X - 4), 2 + rng() * (H0 - 4), round(0.5 + rng() * 0.4)];
  if (waterGap(x, y) < raio || !lowFits(x, y, raio)) continue;
  cenario.push(point('planta', round(x), round(y), { tipo: 'samambaia', raio }));
  n++;
}
for (let i = 0, n = 0; i < 4000 && n < 24; i++) {
  const [x, y, raio] = [2 + rng() * (PARK_X - 4), 30 + rng() * (H0 - 32), round(0.5 + rng() * 0.3)];
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
  if (y < H0 - 3 && isWater(x, y) && trailGap(x, y) > 1.5) {
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
  if (x > 2 && y > 2 && y < H0 - 2 && inEllipse(x, y, spot) && waterGap(x, y) > 0.5 && lowFits(x, y, 0.3) && free(x, y, 0.2)) {
    cenario.push(point('planta', round(x), round(y), { tipo: 'cogumelo', raio: round(0.25 + rng() * 0.15), brilho: '#3fd6c8' }));
    n++;
  }
}

// o gradil do parque (ferro velho com cipó, até o fim do parque, lá no sul) e o Portão I, que abre na etapa 4b
cenario.push(rect('gradil', PARK_X - 0.1, PARK_X + 0.1, 0, GATE.y0 - 0.3, { altura: 1.8, estado: 'inteiro' }));
if (FLORESTA_MAIOR) {
  // na floresta maior o gradil vai até o fim novo do parque, com o buraco que dá para a mata da estrada (um pedaço torto
  // em cada ponta do buraco)
  const [a, b] = [FENCE_HOLE.y0, FENCE_HOLE.y1];
  for (const [y0, y1, estado] of [[GATE.y1 + 0.3, a - 1.6, 'inteiro'], [a - 1.6, a, 'quebrado'], [b, b + 1.6, 'quebrado'], [b + 1.6, H, 'inteiro']] as const) {
    cenario.push(rect('gradil', PARK_X - 0.1, PARK_X + 0.1, y0, y1, { altura: 1.8, estado }));
  }
} else cenario.push(rect('gradil', PARK_X - 0.1, PARK_X + 0.1, GATE.y1 + 0.3, H, { altura: 1.8, estado: 'inteiro' }));
cenario.push(rect('portao', PARK_X - 0.1, PARK_X + 0.1, GATE.y0 + 0.3, GATE.y1 - 0.3, { aberto: reached('4b') }, 'Portão I'));
for (const y of [GATE.y0, GATE.y1]) cenario.push(rect('pilar', PARK_X - 0.3, PARK_X + 0.3, y - 0.3, y + 0.3, { altura: 2.6 }));
// poste com luz quente do lado de fora do portão (aparece entre as grades)
cenario.push(point('poste', POSTS[0]![0], POSTS[0]![1], { altura: reached('4b') ? 7 : 4.2, luz: '#ffd36b' }));

// ---------------- padrão novo no parque (13/11): o Parque Santo Dias de antes, engolido pela floresta ----------------
// A cidade tomada pela mata também dentro do parque: a placa da entrada, bancos de concreto, postes de parque apagados e
// tortos, lixeiras, um bebedouro, pedaços da pista de caminhada de cimento e a academia ao ar livre enferrujada na
// Clareira das Bananeiras. Tudo fora das trilhas e sem vão de entalar (sorteio SEED + 13: a mata não muda).
if (FLORESTA) {
  /** As caixas sólidas do parque que já existem (troncos, pedras, moitas, gradil, pilares), para não encostar errado. */
  const solids: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const sq = (x: number, y: number, side: number) => ({ x0: x - side / 2, x1: x + side / 2, y0: y - side / 2, y1: y + side / 2 });
  for (const s of cenario) {
    const p = s.props ?? {};
    if (s.type === 'arvore') solids.push(sq(s.x, s.y, Number(p.tronco)));
    else if (s.type === 'pedra') solids.push(sq(s.x, s.y, round(Number(p.raio) * 1.5)));
    else if (s.type === 'arbusto' && p.fechado) solids.push(sq(s.x, s.y, round(Number(p.raio) * 1.8)));
    else if (s.type === 'bambu') solids.push(sq(s.x, s.y, round(Number(p.raio) * 1.6)));
    else if (s.type === 'poste') solids.push(sq(s.x, s.y, 0.3));
    else if (['tronco-caido', 'gradil', 'pilar', 'portao'].includes(s.type)) solids.push({ x0: s.x, x1: s.x + s.w!, y0: s.y, y1: s.y + s.h! });
  }
  /** Cabe aqui sem encostar errado: longe da trilha e da água, e nenhum vão de 0 a 1,2 m de frente para outra coisa sólida. */
  const fits = (r: { x0: number; x1: number; y0: number; y1: number }, trailMargin: number) => {
    const [cx, cy] = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
    const half = Math.max(r.x1 - r.x0, r.y1 - r.y0) / 2;
    if (trailGap(cx, cy) < half + trailMargin || waterGap(cx, cy) < half + 0.6) return false;
    return solids.every((s) => {
      const dx = Math.max(0, s.x0 - r.x1, r.x0 - s.x1);
      const dy = Math.max(0, s.y0 - r.y1, r.y0 - s.y1);
      return (dx > 0 && dy > 0) || dx + dy >= MIN_GAP;
    });
  };
  /** Procura, perto de (x, y), o primeiro lugar onde a caixa cabe (anda em espiral, de 0,25 em 0,25 m). */
  function near(x: number, y: number, w: number, h: number, trailMargin: number): [number, number] {
    for (let d = 0; d <= 3; d += 0.25) {
      for (let k = 0; k < (d === 0 ? 1 : 16); k++) {
        const [px, py] = [round(x + Math.cos((k / 16) * Math.PI * 2) * d), round(y + Math.sin((k / 16) * Math.PI * 2) * d)];
        const r = { x0: px - w / 2, x1: px + w / 2, y0: py - h / 2, y1: py + h / 2 };
        if (fits(r, trailMargin)) {
          solids.push(r);
          return [px, py];
        }
      }
    }
    throw new Error(`Não achei lugar para uma coisa do parque antigo perto de (${x}, ${y}).`);
  }
  // a placa da entrada, do lado de fora do portão, logo ao sul do pilar e encostada no gradil, virada para a rua (como
  // na imagem aprovada). Dentro do parque, atrás do pilar norte, o pilar ficava na frente dela na tela e ela tinha de
  // subir acima dele (o dono achou errado). Aqui ela fica na frente do gradil e do pilar, na altura dos olhos.
  cenario.push(point('placa', 48.2, 48.6, { texto: 'PARQUE SANTO DIAS', poste: true, tamanho: 'grande', mato: true, olhando: 0 }));
  // o bebedouro, perto do portão
  {
    const [x, y] = near(45.3, 46.8, 0.5, 0.5, 0.4);
    cenario.push(point('bebedouro', x, y, { quebrado: true, musgo: true }));
  }
  // bancos de concreto com mato na beira das trilhas (virados para a trilha), cada um com a sua lixeira encostada
  for (const [tx, ty, olhando] of [[40.8, 17.2, 180], [21.4, 36.6, 90], [31.7, 62.5, 180]] as [number, number, number][]) {
    const along = olhando === 90 || olhando === 270; // o banco é comprido no sentido da trilha
    const [w, h] = along ? [1.6, 0.5] : [0.5, 1.6];
    const [x, y] = near(tx, ty, w + (along ? 0.5 : 0), h + (along ? 0 : 0.5), 0.35); // (com o lugar da lixeira)
    const bench = along ? { x0: x - 1.05, x1: x + 0.55, y0: y - 0.25, y1: y + 0.25 } : { x0: x - 0.25, x1: x + 0.25, y0: y - 1.05, y1: y + 0.55 };
    cenario.push(rect('banco', bench.x0, bench.x1, bench.y0, bench.y1, { olhando, material: 'concreto', mato: true }));
    const bin = along ? [x + 0.8, y] : [x, y + 0.8];
    cenario.push(point('lixeira', bin[0]!, bin[1]!, { mato: true }));
  }
  // postes de parque apagados, tortos e com cipó, na beira das trilhas
  // (o da entrada fica um pouco ao norte e a leste: em 45,8; 35,5 ele ficava, na tela, na mesma linha do poste de
  // concreto do portão, e os dois se confundiam)
  for (const [tx, ty] of [[46.2, 34.6], [26, 37.6], [31.8, 55.2]] as const) {
    const [x, y] = near(tx, ty, 0.25, 0.25, 0.35);
    cenario.push(point('poste-praca', x, y, { altura: 3.2, apagado: true, torto: true, cipo: true }));
  }
  // a academia ao ar livre enferrujada, no lado leste da Clareira das Bananeiras (fora da trilha)
  for (const [tx, ty, aparelho] of [[30.4, 77.2, 'simulador-caminhada'], [31.2, 80.2, 'barra'], [30.4, 83.2, 'remada']] as const) {
    const [x, y] = near(tx, ty, 1.2, 0.8, 0.5);
    cenario.push(rect('academia', x - 0.6, x + 0.6, y - 0.4, y + 0.4, { aparelho, ferrugem: true, cipo: true, altura: 1.6 }));
  }
  // pedaços da pista de caminhada de cimento, rachados, na beira da trilha do portão e no começo da trilha do norte
  const prng = mulberry32(SEED + 13);
  for (const [cx, cy] of [[40, 45.2], [43.2, 42.9], [45.6, 44.9], [43.9, 38], [44.3, 33.5]] as const) {
    const pts: [number, number][] = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + prng() * 0.4;
      const r = 0.6 + prng() * 0.5;
      return [round(cx + Math.cos(a) * r * 1.3), round(cy + Math.sin(a) * r * 0.9)];
    });
    chao.push({ type: 'calcada', x: 0, y: 0, polygon: pts, props: { desenho: 'placas', quebrada: true, cor: '#8f8c82' } });
  }
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
  VILLAGE_KEYS.push([BUDEGA_FRONT.x, BUDEGA_FRONT.y, 0], [FIRE.x, FIRE.y, 0]);
  for (let x = BUDEGA.x0 + 0.5; x <= BUDEGA.x1 - 0.5; x += 1) VILLAGE_KEYS.push([x, BUDEGA.y1 + 0.05, 2.2]); // o letreiro

  // as casas e a Budega (uma casa com comércio: letreiro e toldo na frente, que dá para a praça)
  for (const h of HOUSES) cenario.push(rect('casa', h.x0, h.x1, h.y0, h.y1, { altura: h.altura, andares: h.andares, cor: h.cor, caixaDagua: true, ...h.extra }));
  // o logo da Budega (o escudo dourado do dono, sem tabacaria e sem narguilé) vai na fachada; o letreiro fica de reserva
  // (como a loja de verdade: a fachada preta brilhante, a moldura amarela em volta da vitrine e da porta, a faixa de
  // LED contornando a frente à noite; a vitrine com o fundo amarelo fica do lado esquerdo da porta)
  cenario.push(rect('casa', BUDEGA.x0, BUDEGA.x1, BUDEGA.y0, BUDEGA.y1, { altura: 3.4, andares: 1, cor: '#1c1c1f', fachada: 'preta', moldura: '#e8c020', led: true, caixaDagua: true, comercio: 'vendinha', letreiro: 'BUDEGA DISTRIBUIDORA', logo: 'budega', ...(FLORESTA ? { interior: true, portaDe: BUDEGA_DOOR.x0, portaAte: BUDEGA_DOOR.x1 } : {}) }, 'Budega'));

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
  // (com a Budega maior, as mesas desceram um pouco: antes em 62,6; 55,4 e 63,8; 57,8)
  for (const [x, y] of [[62.4, 56.9], [64.6, 58.3]] as const) {
    cenario.push(point('mesa', x, y, { cadeiras: 2 }));
    furniture.push({ x, y, r: 0.9 });
  }
  // (o terceiro, entre a praça e o campinho, segura o varal de bandeirinhas no meio: com a Budega maior, a porta foi
  // para a direita e o varal reto passava, na tela, por cima de quem está na porta)
  for (const [x, y] of [[78.3, 49.3], [61.7, 58.3], [71, 61.5]] as const) {
    cenario.push(point('poste-praca', x, y, { altura: 3.2, luz: '#ffd36b' }));
    furniture.push({ x, y, r: 0.3 });
  }
  // (nos cantos da frente da Budega, que a câmera vê: a parede oeste fica de costas para ela; o orelhão fica fora do toldo)
  // (no padrão novo, o orelhão sai da quina da frente da Budega, onde ficava colado, e vai para o canto da praça, no poste
  // de luz: pedido do dono, 14/11, "arrumar a entrada da Budega")
  if (FLORESTA) cenario.push(point('orelhao', 61.7, 57.92, { olhando: 90, poste: true }));
  else cenario.push(point('orelhao', BUDEGA.x0 - 0.25, BUDEGA.y1 + 0.25, { olhando: 90 }));
  // (a lixeira fica encostada na parede oeste da Budega, longe da porta e da vitrine)
  cenario.push(point('lixeira', BUDEGA.x0 - 0.3, BUDEGA.y1 - 0.4));
  furniture.push({ x: BUDEGA_FRONT.x, y: BUDEGA_FRONT.y, r: 1.5 });
  // ----- a Budega por dentro: ladrilho, prateleiras no fundo, a geladeira e o balcão com o caixa, e engradados nos
  // cantos da porta. Atrás do balcão fica fechado (só a Xiovanna passa), e nenhum vão é de entalar: tudo fica colado
  // (até 0,3 m) ou com 1,2 m livre -----
  if (FLORESTA) {
    // ----- a Budega maior por dentro (15/11), igual às imagens que o dono aprovou (docs/referencias/budega-maior-*.jpg;
    // ele pediu de novo: "era pra ser parecido") e à loja de verdade: piso branco; prateleiras pretas com nichos amarelos
    // na parede do fundo (até a frente delas é parede, na colisão) e na da esquerda; a geladeira de bebidas de duas
    // portas no canto do fundo; o ventilador na parede; a parede de grama com o escudo aceso e as flores atrás do caixa
    // preto e amarelo (em L: só a Xiovanna passa), com a dracena no canto; o balcão de vidro dos doces no meio; o freezer
    // solto na frente das prateleiras da esquerda; e a vitrine de fundo amarelo atrás do vidro da frente. Nenhum vão é de
    // entalar: tudo colado (até 0,3 m) ou com 1,2 m livre -----
    const { x0, x1, y0, y1 } = BUDEGA_INSIDE;
    const shelf = y0 + BUDEGA_SHELF;
    chao.push(rect('piso', x0, x1, y0, y1, { desenho: 'porcelanato', cor: '#efeee9', folhas: true }));
    // (a floresta entrando, pedido do dono, 15/11: "interior com infestação da floresta"): cipó subindo pelas prateleiras e
    // pela geladeira, folhas secas no piso, além da raiz, do mato, da samambaia, do musgo e do cipó das paredes (lá embaixo)
    const PRETO = { cor: '#26262a', nichos: '#e8c020', cipo: true };
    cenario.push(rect('prateleira', x0, 64.8, y0, shelf, { altura: 2.1, olhando: 90, ...PRETO }));
    cenario.push(rect('prateleira', x0, x0 + 0.35, 51.2, 53.65, { altura: 2.1, olhando: 0, ...PRETO }));
    cenario.push(rect('geladeira', x0, x0 + 0.7, shelf, 51.2, { altura: 2, olhando: 0, portas: 2, vidro: true, cipo: true }));
    // (`olhando`: para onde a frente dá, 90 = sul: a vitrine mostra os produtos para a praça, com o fundo amarelo atrás.
    // Ela é parte da frente: com o herói lá dentro, sai junto com a parede da frente, para não tampar a loja na tela)
    cenario.push(rect('vitrine', x0, BUDEGA_DOOR.x0 - BUDEGA_WALL, 53.65, y1, { altura: 2.2, olhando: 90, fundo: '#f2c84b', frente: true }));
    // o ventilador de parede, no alto, entre as prateleiras e a parede de grama (só desenho)
    cenario.push(point('ventilador', 64.55, shelf, { altura: 2.5, olhando: 90, parede: true, dentro: true }));
    // o balcão de vidro dos doces no meio da loja (1,25 m livres da prateleira do fundo, da geladeira e do caixa)
    cenario.push(rect('balcao-vidro', 62.6, 64.2, 50.65, 51.3, { altura: 1, doces: true }));
    // a parede de grama com o escudo aceso e as flores amarelas, na parede do fundo atrás do caixa (a câmera vê a do fundo)
    cenario.push(rect('parede-verde', 64.8, x1, y0, shelf, { logo: 'budega', neon: true, flores: 'amarelas' }));
    // o caixa em L: a frente para o freguês (50 cm de fundo: quem vai comprar para 1 m ao sul do pé dela, e o pé cabe
    // ali) e a volta até a parede do fundo; a dracena no vaso fecha o canto do lado da parede da direita
    const CAIXA = { cor: '#26262a', faixa: '#e8c020' };
    cenario.push(rect('balcao', 65.45, 67.75, 50.6, 51.1, { altura: 1, olhando: 90, caixa: true, ...CAIXA }));
    cenario.push(rect('balcao', 65.45, 65.95, shelf, 50.6, { altura: 1, olhando: 180, ...CAIXA }));
    cenario.push(point('vaso', 68.05, 50.85, { planta: 'dracena', dentro: true }));
    // o freezer de gelo solto na frente das prateleiras da esquerda, como na loja (25 cm da vitrine e 1,2 m livres em volta)
    cenario.push(rect('freezer', 62.25, 63.85, 52.6, 53.4, { altura: 0.9, olhando: 90 }));
    // ----- a entrada (aprovada pelo dono em 15/11, como na imagem da fachada): o degrau de cimento com o capacho de palha
    // na porta, o vaso de dracena do lado esquerdo da porta, a lousinha do lado direito e dois caixotes de fruta na
    // frente da vitrine (tudo encostado na fachada, sem vão de entalar) -----
    chao.push(rect('degrau', BUDEGA_DOOR.x0, BUDEGA_DOOR.x1, BUDEGA.y1, BUDEGA.y1 + 0.35, { altura: 0.12, capacho: true }));
    cenario.push(point('vaso', 64.7, BUDEGA.y1 + 0.35, { planta: 'dracena' }));
    cenario.push(point('lousa', BUDEGA.x1 - 0.2, BUDEGA.y1 + 0.35, { olhando: 90, cavalete: true }));
    cenario.push(rect('caixote', 61.1, 62.1, BUDEGA.y1 + 0.05, BUDEGA.y1 + 0.55, { altura: 0.5, fruta: 'banana' }));
    cenario.push(rect('caixote', 62.25, 63.25, BUDEGA.y1 + 0.05, BUDEGA.y1 + 0.55, { altura: 0.5, fruta: 'laranja' }));
  }
  // a árvore da praça: o lugar mais perto do da planta (70, 54) que não tampa a rua, o balcão, o letreiro nem a fogueira
  const SQ_TREE = { especie: 'sibipiruna', copa: 3.6, altura: 6.5, tronco: 0.7 };
  // (o lugar aprovado, 77; 58, vale primeiro: com a Budega maior e a fogueira no lugar novo ela não sai de lá)
  const APPROVED_TREE = { x: 77, y: 58 };
  let spot: { x: number; y: number } | undefined =
    !furniture.some((f) => dist(APPROVED_TREE.x, APPROVED_TREE.y, f.x, f.y) < f.r + SQ_TREE.tronco / 2 + 1.5) && !canopyHides(APPROVED_TREE.x, APPROVED_TREE.y, SQ_TREE.copa, SQ_TREE.altura) ? APPROVED_TREE : undefined;
  for (let x = SQUARE.x0 + 1; x <= SQUARE.x1 - 1; x += 0.5) {
    for (let y = SQUARE.y0 + 1; y <= SQUARE.y1 - 1; y += 0.5) {
      if (x < BUDEGA.x1 + 1.5 && y < BUDEGA.y1 + 1.5) continue;
      if (furniture.some((f) => dist(x, y, f.x, f.y) < f.r + SQ_TREE.tronco / 2 + 1.5)) continue;
      if (canopyHides(x, y, SQ_TREE.copa, SQ_TREE.altura)) continue;
      if (spot === APPROVED_TREE) continue;
      if (!spot || dist(x, y, 70, 54) < dist(spot.x, spot.y, 70, 54)) spot = { x, y };
    }
  }
  if (!spot) throw new Error('Não achei lugar para a árvore da praça que não tampe a rua, o balcão, o letreiro ou a fogueira.');
  trees.push({ x: spot.x, y: spot.y, tronco: SQ_TREE.tronco });
  cenario.push(point('arvore', spot.x, spot.y, SQ_TREE, 'Árvore da Praça'));

  // postes da rua (o do portão já existe) e a fiação passando de um para o outro
  for (const [x, y] of POSTS.slice(1)) cenario.push(point('poste', x, y, { altura: 7, luz: '#ffd36b' }));
  for (const wire of WIRES) cenario.push({ type: 'fiacao', x: 0, y: 0, polyline: wire, props: { altura: 6.6 } });
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
  // (as capivaras do campinho andam em bando, como as do lago: o lugar delas fica na camada `pontos`)
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
  if (GUARA_LINK) {
    // a rua segue até a beira do mapa (a saída para o Mapa 02); a placa fica num poste na beira oeste, colada na mata
    cenario.push(point('placa', ROAD_GUARA.x0 + 0.35, SOUTH_BARRIER_Y - 4.5, { texto: 'GUARAPIRANGA', seta: 'sul', poste: true }));
    pontos.push(point('ponto', (ROAD_GUARA.x0 + ROAD_GUARA.x1) / 2, H - 3.5, undefined, 'chegada-guarapiranga'));
    saidas.push(rect('saida', ROAD_GUARA.x0, ROAD_GUARA.x1, H - 0.6, H, { mapa: 'guarapiranga', chegada: 'chegada-capao' }, "Estrada do M'Boi Mirim"));
  } else {
    cenario.push(rect('barreira', ROAD_GUARA.x0, ROAD_GUARA.x1, SOUTH_BARRIER_Y, SOUTH_BARRIER_Y + 0.5, { altura: 1.1 }));
    cenario.push(point('placa', (ROAD_GUARA.x0 + ROAD_GUARA.x1) / 2, SOUTH_BARRIER_Y - 0.3, { texto: 'GUARAPIRANGA', seta: 'sul' }));
    // (o ponto onde chega quem vier do Mapa 02: o servidor confere que ele existe)
    pontos.push(point('ponto', (ROAD_GUARA.x0 + ROAD_GUARA.x1) / 2, SOUTH_BARRIER_Y - 3, undefined, 'chegada-guarapiranga'));
  }
  // paredes de mata dos dois lados da rua: a mata ao sul da vila continua só de enfeite
  // (na floresta maior as paredes descem até o fim novo do mapa, e a do oeste abre na frente do posto abandonado; o
  // tamanho de cada arbusto é sorteado sempre, na mesma ordem)
  for (let y = VILLAGE_S + 0.6; y < H; y += 1.1) {
    for (const x of [ROAD_GUARA.x0 - 0.7, ROAD_GUARA.x1 + 0.7]) {
      const raio = round(0.9 + crng() * 0.25);
      const postoOpen = FLORESTA_MAIOR && x < ROAD_GUARA.x0 && y > POSTO.y0 - 1.1 && y < POSTO.y1 + 1.1;
      if (!postoOpen) cenario.push(point('arbusto', round(x), round(y), { raio, fechado: true }));
    }
  }
  for (let x = ROAD_GUARA.x0 + 1; x <= ROAD_GUARA.x1 - 1; x += 1) for (let y = VILLAGE_S; y < (GUARA_LINK ? H : SOUTH_BARRIER_Y); y += 2) VILLAGE_KEYS.push([x, y, 0]);
  // a saída leste (Estação Capão Redondo) fica para depois: a rua da vila termina no mato, com uma placa num poste na
  // beira norte da rua (longe o bastante do mato e da casa para não ficar vão de entalar)
  cenario.push(point('placa', 92.9, STREET.y0 + 0.3, { texto: 'ESTAÇÃO CAPÃO REDONDO', seta: 'leste', poste: true }));
}

// ---------------- padrão novo na 4c (13/11): a floresta reinando sobre o resto do Capão ----------------
// O mesmo padrão da rua da Budega (docs/referencias/padrao-cidade-floresta.jpg): o viaduto e o trem tomados pelo cipó,
// árvores no tabuleiro, o ônibus virando horta, o campinho com o mato entrando, a rua para Guarapiranga rachada com
// raízes, e a Figueira do Viaduto segurando a ponta quebrada. Nada da 4c aprovada muda de lugar (sorteio SEED + 12).
if (reached('4c') && FLORESTA) {
  const grng = mulberry32(SEED + 12);
  const find = (type: string) => cenario.filter((o) => o.type === type);
  // ----- o viaduto e o trem: cipó, árvores no tabuleiro, pichação e musgo nos pilares -----
  for (const o of find('viaduto')) o.props = { ...o.props, cipo: 0.7, arvoresNoTopo: true };
  for (const o of find('pilar-viaduto')) o.props = { ...o.props, pixo: true, musgo: true, cipo: 0.5 };
  for (const o of find('trem')) o.props = { ...o.props, cipo: true, plantas: true, janelasQuebradas: true };
  // mais cortinas de cipó descendo do tabuleiro (as de antes ficam)
  const hanging = new Set(find('cipo').map((o) => o.x));
  for (let x = VIADUCT.x0 + 2.5; x < VIADUCT.x1 - 1; x += 3.5 + grng() * 1.5) {
    if ([...hanging].some((h) => Math.abs(h - x) < 1.5)) continue;
    cenario.push(point('cipo', round(x), VIADUCT.y1 + 0.05, { comprimento: round(2 + grng() * 4), base: 8 }));
  }
  // ----- o ônibus virou a horta da vila, e a casa abandonada tem uma árvore saindo pelo telhado -----
  for (const o of find('onibus')) o.props = { ...o.props, horta: true };
  for (const o of find('casa').filter((c) => c.props?.abandonada === true)) o.props = { ...o.props, arvoreDentro: true };
  // um caminho de terra da viela até embaixo do viaduto (por fora do ônibus e da casa abandonada)
  const BACK_PATH: [number, number][] = [[80, 29.6], [80.4, 22], [78.5, 17.6], [72, 17.4], [69.2, 14], [68.5, 8.5]];
  chao.push({ type: 'trilha', x: 0, y: 0, polyline: BACK_PATH, props: { largura: 1.6 } });

  // ----- o campinho: o mato entrando pelos cantos, traves enferrujadas com cipó e rede rasgada, cadeiras de quem assiste -----
  for (const [cx, cy, rx, ry] of [[61, 64, 1.8, 1.2], [84, 77, 2, 1.3], [61.4, 77, 1.5, 1], [83.6, 64.2, 1.4, 1]] as const) {
    chao.push({ type: 'grama', x: 0, y: 0, polygon: blob(cx, cy, rx, ry, 0.25) });
  }
  for (const o of find('trave')) o.props = { ...o.props, ferrugem: true, cipo: true, rede: 'rasgada' };
  for (const o of find('muro')) o.props = { ...o.props, cipo: 0.4, musgo: true };
  for (const [x, olhando] of [[68.3, 90], [68.8, 90], [75.9, 90], [76.4, 90]] as const) cenario.push(point('cadeira', x, 61.6, { olhando, cor: '#f2f2ee' }));

  // ----- a rua para Guarapiranga: faixa apagada, rachaduras com mato, buracos com água, raízes saindo da mata, capim -----
  chao.push({ type: 'faixa-rua', x: 0, y: 0, polyline: [[91, VILLAGE_S + 0.5], [91, SOUTH_BARRIER_Y - 1]], props: { cor: '#c9a640', largura: 0.12, tracejada: true, apagada: true } });
  // (as rachaduras de antes ficam iguais: elas param onde ficava a barreira antes da floresta maior)
  const onRoad = (x: number, y: number) => x > ROAD_GUARA.x0 + 0.3 && x < ROAD_GUARA.x1 - 0.3 && y > VILLAGE_S + 0.5 && y < SOUTH_BARRIER_Y0 - 0.5;
  for (let i = 0, n = 0; i < 300 && n < 9; i++) {
    let [x, y]: [number, number] = [ROAD_GUARA.x0 + 0.5 + grng() * 5, VILLAGE_S + 1 + grng() * 32];
    if (!onRoad(x, y)) continue;
    const pts: [number, number][] = [[round(x), round(y)]];
    let a = grng() * Math.PI * 2;
    for (let k = 0; k < 3 + Math.floor(grng() * 3); k++) {
      a += (grng() - 0.5) * 1.6;
      const l = 0.5 + grng() * 0.9;
      const [nx, ny] = [x + Math.cos(a) * l, y + Math.sin(a) * l];
      if (!onRoad(nx, ny)) break;
      [x, y] = [nx, ny];
      pts.push([round(x), round(y)]);
    }
    if (pts.length < 3) continue;
    chao.push({ type: 'rachadura', x: 0, y: 0, polyline: pts, props: { largura: 0.06, cor: '#1e2022', mato: grng() < 0.7 } });
    n++;
  }
  for (const [x, y, raio] of [[89.6, 89.5, 0.5], [92.4, 103, 0.45]] as const) chao.push(point('buraco', x, y, { raio, agua: true }));
  // raízes das árvores da mata entrando na rua (baixas: o pé passa por cima)
  const ROAD_ROOTS: [number, number][][] = [
    [[87.2, 92], [88.4, 92.6], [89.8, 92.4], [90.9, 93.2]],
    [[94.8, 99], [93.6, 99.6], [92.5, 99.3]],
    [[87.2, 108], [88.5, 107.4], [89.6, 107.9]],
  ];
  for (const pts of ROAD_ROOTS) chao.push({ type: 'raiz', x: 0, y: 0, polyline: pts, props: { largura: 0.3, altura: 0.2, cor: '#6b4a2e' } });
  for (const x of [ROAD_GUARA.x0 + 0.25, ROAD_GUARA.x1 - 0.25]) {
    // (até onde ficava a barreira antes da floresta maior; o trecho novo ganha o seu capim lá na floresta maior)
    for (let y = VILLAGE_S + 1 + grng() * 2; y < SOUTH_BARRIER_Y0 - 1; y += 1.5 + grng() * 3) chao.push(point('planta', x, round(y), { tipo: 'capim', raio: round(0.2 + grng() * 0.15) }));
  }
  // o fim da rua da vila, no leste, engolido pelo mato
  for (const [cx, cy, rx, ry] of [[95.2, 42.6, 1.1, 1.4], [94.8, 45.9, 0.9, 0.8]] as const) chao.push({ type: 'grama', x: 0, y: 0, polygon: blob(cx, cy, rx, ry, 0.25) });

  // ----- a Figueira do Viaduto: na beira do parque, segurando a ponta quebrada do viaduto (a mais alta do mapa) -----
  const FIG_V = { especie: 'figueira', copa: 6.5, altura: 12, tronco: 2.2 };
  let figSpot: [number, number] | undefined;
  for (const [x, y] of [[45, 5.5], [44.5, 6.5], [45.5, 7], [44, 5]] as const) {
    if (plantFits(x, y, FIG_V.tronco, FIG_V.copa, TRUNK_GAP + 1) && !hidesView(x, y, FIG_V.copa, FIG_V.altura) && !canopyHides(x, y, FIG_V.copa, FIG_V.altura)) {
      figSpot = [x, y];
      break;
    }
  }
  if (!figSpot) throw new Error('Não achei lugar para a Figueira do Viaduto na beira do parque.');
  trees.push({ x: figSpot[0], y: figSpot[1], tronco: FIG_V.tronco });
  cenario.push(point('arvore', figSpot[0], figSpot[1], { ...FIG_V, abraca: 'viaduto' }, 'Figueira do Viaduto'));
}

// a mata fechada ao sul da vila: só enfeite (ninguém chega lá). A partir da 4c a rua para Guarapiranga passa por ela,
// e nenhuma copa tampa a rua nem o campinho
{
  const srng = mulberry32(SEED + 7);
  const south: Tree[] = [];
  const nearRoad = (x: number, r: number) => reached('4c') && x + r > ROAD_GUARA.x0 - 2.2 && x - r < ROAD_GUARA.x1 + 2.2;
  const southFits = (x: number, y: number, r: number) => !nearRoad(x, r) && south.every((t) => dist(x, y, t.x, t.y) - t.tronco / 2 - r >= TRUNK_GAP + 1.4);
  for (let i = 0, n = 0; i < 3000 && n < 45; i++) {
    const [x, y] = [PARK_X + 1.5 + srng() * (W - PARK_X - 3), VILLAGE_S + 3 + srng() * (H0 - VILLAGE_S - 4.5)];
    const k = srng();
    const especie = k < 0.15 ? 'jeriva' : k < 0.3 ? 'embauba' : 'mata';
    const d = SPECIES[especie] ?? { tronco: round(0.4 + srng() * 0.25), copa: round(1.7 + srng() * 1.2), altura: round(5 + srng() * 3.5) };
    if (!southFits(x, y, d.tronco / 2) || canopyHides(x, y, d.copa, d.altura)) continue;
    south.push({ x, y, tronco: d.tronco });
    cenario.push(point('arvore', round(x), round(y), { especie, ...d }));
    n++;
  }
  for (let i = 0, n = 0; i < 2000 && n < 14; i++) {
    const [x, y, r] = [PARK_X + 2 + srng() * (W - PARK_X - 4), VILLAGE_S + 3 + srng() * (H0 - VILLAGE_S - 5), round(1 + srng() * 0.4)];
    if (!southFits(x, y, r) || canopyHides(x, y, r * 1.3, 7)) continue;
    south.push({ x, y, tronco: r * 2 });
    cenario.push(point('bambu', round(x), round(y), { raio: r, altura: 7 }));
    n++;
  }
  for (let i = 0, n = 0; i < 2000 && n < 10; i++) {
    const [x, y] = [PARK_X + 2 + srng() * (W - PARK_X - 4), VILLAGE_S + 3 + srng() * (H0 - VILLAGE_S - 5)];
    if (!southFits(x, y, 0.2) || canopyHides(x, y, SPECIES.bananeira!.copa, SPECIES.bananeira!.altura)) continue;
    south.push({ x, y, tronco: 0.35 });
    cenario.push(point('arvore', round(x), round(y), { especie: 'bananeira', ...SPECIES.bananeira! }));
    n++;
  }
}

// ---------------- padrão novo (13/11): a floresta reinando sobre a vila ----------------
// O dono pediu para caprichar antes de avançar: a rua tem que parecer rua e a calçada, calçada, com a cidade tomada pela
// floresta (pós-apocalíptico brasileiro, sem barraco destruído). Referência aprovada: docs/referencias/padrao-rua-floresta.jpg.
// Nada do que já foi aprovado muda de lugar: só entram coisas novas (no chão e em cima dele) e propriedades novas nas
// casas, nos postes e na fiação. Sorteio próprio (SEED + 11): o resto do mapa não muda.
if (reached('4b') && FLORESTA) {
  const frng = mulberry32(SEED + 11);
  // ----- o chão da rua: meio-fio, faixa apagada, remendos, buracos com água, poças, rachaduras com mato, bueiros, tampas -----
  // a calçada é de placas de cimento (com juntas); a praça de pedra portuguesa ganha musgo nas frestas
  for (const c of chao.filter((o) => o.type === 'calcada')) c.props = { ...c.props, desenho: 'placas' };
  for (const c of chao.filter((o) => o.type === 'praca')) c.props = { ...c.props, musgo: true };
  // (as linhas e manchas novas levam `largura` e `cor`: um desenho que ainda não conhece o tipo mostra só um traço fino
  // na cor certa, e não uma faixa larga de terra)
  /** O meio-fio (com a sarjeta do lado do asfalto) em toda beira de calçada com asfalto. */
  const CURBS: [number, number][][] = [
    [[49.5, 0], [49.5, VILLAGE_S]],
    [[56, 0], [56, STREET.y0], [W, STREET.y0]],
    [[56, VILLAGE_S], [56, STREET.y1], [ROAD_S.x0, STREET.y1], [ROAD_S.x0, VILLAGE_S]],
    [[W, STREET.y1], [ROAD_S.x1, STREET.y1], [ROAD_S.x1, VILLAGE_S]],
  ];
  for (const pts of CURBS) chao.push({ type: 'meio-fio', x: 0, y: 0, polyline: pts, props: { altura: 0.15, largura: 0.2, sarjeta: true, cor: '#bdb6a8' } });
  // a faixa amarela do meio, tracejada e apagada (na Travessa, parando antes do cruzamento e da faixa de pedestre)
  const CENTER_LINES: [number, number][][] = [
    [[57.5, 44], [W - 0.5, 44]],
    [[91, STREET.y1 + 0.5], [91, VILLAGE_S]],
    [[52.75, 0.5], [52.75, STREET.y0 - 0.5]],
    [[52.75, 51.1], [52.75, VILLAGE_S - 0.5]],
  ];
  for (const pts of CENTER_LINES) chao.push({ type: 'faixa-rua', x: 0, y: 0, polyline: pts, props: { cor: '#c9a640', largura: 0.12, tracejada: true, apagada: true } });
  // remendos de asfalto (mais escuros), buracos com água e poças na beira da sarjeta
  const PATCHES: [number, number][][] = [
    [[59.5, 42.2], [62.8, 42], [63.1, 43.9], [59.8, 44.1]],
    [[74.8, 44.6], [78.4, 44.3], [78.6, 46.4], [75, 46.6]],
    [[89.6, 55.2], [91.4, 55], [91.6, 58.6], [89.8, 58.8]],
    [[51.2, 19.4], [54.4, 19.2], [54.6, 21.6], [51.4, 21.8]],
  ];
  for (const pts of PATCHES) chao.push({ type: 'remendo', x: 0, y: 0, polygon: pts, props: { cor: '#2c2f33' } });
  for (const [x, y, raio] of [[66.6, 45.7, 0.45], [81.4, 42.3, 0.55], [91.9, 66.5, 0.5], [52.5, 52, 0.45]] as const) {
    chao.push(point('buraco', x, y, { raio, agua: true }));
  }
  for (const [x, y, rx, ry] of [[72.5, 46.5, 1.1, 0.35], [52.9, 34.5, 0.8, 0.5], [88.6, 64, 0.35, 1]] as const) {
    chao.push({ type: 'poca', x: x - rx, y: y - ry, w: 2 * rx, h: 2 * ry, ellipse: true, props: { cor: '#56788c' } });
  }
  /** Onde é asfalto (para as rachaduras não saírem dele nem entrarem na faixa de pedestre). */
  const onAsphalt = (x: number, y: number) =>
    !(x > 49.5 && x < 56 && y > 42.3 && y < 45.7) &&
    ((x > 49.7 && x < 55.8 && y > 0.5 && y < VILLAGE_S - 0.5) ||
      (x > 56 && x < W - 0.3 && y > STREET.y0 + 0.2 && y < STREET.y1 - 0.2) ||
      (x > ROAD_S.x0 + 0.2 && x < ROAD_S.x1 - 0.2 && y > STREET.y1 && y < VILLAGE_S));
  for (let i = 0, n = 0; i < 400 && n < 18; i++) {
    const zone = i % 3;
    let [x, y]: [number, number] =
      zone === 0 ? [57 + frng() * 38, 41.5 + frng() * 5] : zone === 1 ? [88.5 + frng() * 5, 48 + frng() * 31] : [50 + frng() * 5.6, 1 + frng() * 78];
    if (!onAsphalt(x, y)) continue;
    const pts: [number, number][] = [[round(x), round(y)]];
    let a = frng() * Math.PI * 2;
    for (let k = 0; k < 3 + Math.floor(frng() * 3); k++) {
      a += (frng() - 0.5) * 1.6;
      const l = 0.5 + frng() * 0.9;
      const [nx, ny] = [x + Math.cos(a) * l, y + Math.sin(a) * l];
      if (!onAsphalt(nx, ny)) break;
      [x, y] = [nx, ny];
      pts.push([round(x), round(y)]);
    }
    if (pts.length < 3) continue;
    chao.push({ type: 'rachadura', x: 0, y: 0, polyline: pts, props: { largura: 0.06, cor: '#1e2022', mato: frng() < 0.6 } });
    n++;
  }
  // bueiros na sarjeta e tampas no meio da rua (enfeite: o pé passa por cima)
  for (const [x, y, olhando] of [
    [63, 41.3, 0], [76.5, 41.3, 0], [90.5, 41.3, 0], [59, 46.7, 0], [73.5, 46.7, 0], [85.5, 46.7, 0],
    [88.3, 60, 90], [88.3, 72, 90], [55.7, 28, 90], [55.7, 62, 90], [49.8, 15, 90], [49.8, 55, 90],
  ] as const) {
    chao.push(point('bueiro', x, y, { olhando }));
  }
  for (const [x, y] of [[69, 43.6], [86.2, 44.6], [91.2, 54], [52.6, 30], [52.9, 58]] as const) chao.push(point('tampa', x, y, { raio: 0.35 }));
  // capim na sarjeta e nas frestas (não segura o pé)
  for (const pts of CURBS) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [[ax, ay], [bx, by]] = [pts[i]!, pts[i + 1]!];
      const len = Math.hypot(bx - ax, by - ay);
      for (let d = 1 + frng() * 2; d < len - 0.5; d += 1.5 + frng() * 3.5) {
        const side = frng() < 0.5 ? -0.25 : 0.25;
        const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
        const [x, y] = [ax + ((bx - ax) * d) / len + nx * side, ay + ((by - ay) * d) / len + ny * side];
        chao.push(point('planta', x, y, { tipo: 'capim', raio: round(0.2 + frng() * 0.15) }));
      }
    }
  }

  // ----- a Figueira da Esquina: rompeu a calçada e o asfalto logo depois da esquina do portão (a primeira coisa que se
  // vê da rua). Fica na frente da casa rosa: mais perto da esquina, a copa alta "subia" na tela e tampava a trilha do
  // norte do parque, bem onde andam os saguis (o dono pediu "o caminho sem árvore") -----
  const BIG_FIG = { x: 68, y: 40.25, copa: 6, altura: 10, tronco: 1.8 };
  if (canopyHides(BIG_FIG.x, BIG_FIG.y, BIG_FIG.copa, BIG_FIG.altura)) throw new Error('A Figueira da Esquina tampa a rua ou o portão.');
  if (hidesView(BIG_FIG.x, BIG_FIG.y, BIG_FIG.copa, BIG_FIG.altura)) throw new Error('A Figueira da Esquina tampa uma trilha do parque.');
  trees.push({ x: BIG_FIG.x, y: BIG_FIG.y, tronco: BIG_FIG.tronco });
  cenario.push(point('arvore', BIG_FIG.x, BIG_FIG.y, { especie: 'figueira', copa: BIG_FIG.copa, altura: BIG_FIG.altura, tronco: BIG_FIG.tronco, rompendo: true }, 'Figueira da Esquina'));
  /** Raízes (baixas: o pé passa por cima) que levantam a calçada e racham o asfalto. */
  const ROOTS: [number, number][][] = [
    [[67.2, 40.85], [66.3, 41.6], [64.9, 42.3], [63.3, 42.4]],
    [[68.6, 41], [69.6, 42.1], [71, 43.2], [72.8, 43.6]],
    [[68.95, 39.95], [70.3, 40.15], [72.4, 40.05]],
    [[68.05, 41.2], [67.8, 42.5], [68.3, 43.9]],
    // as da árvore da praça, levantando a pedra portuguesa
    [[76.4, 58.4], [75.2, 58.9], [73.8, 58.7]],
    [[77.6, 58.5], [78.4, 59.6]],
  ];
  for (const pts of ROOTS) chao.push({ type: 'raiz', x: 0, y: 0, polyline: pts, props: { largura: 0.35, altura: 0.2, cor: '#6b4a2e' } });

  // ----- a mata tomando as casas, os postes e os fios -----
  /** Cipó na fachada (0 a 1), plantas na laje, árvore na laje (só nas casas do norte: atrás da rua, não tampam nada) e varal. */
  const HOUSE_GREEN: [number, number, Props][] = [
    [58, 31, { cipo: 0.35, plantas: true, arvoreNaLaje: true, varal: true, musgo: true, grade: true }],
    [64, 33, { cipo: 0.5, plantas: true, musgo: true, grade: true }],
    [71, 30, { cipo: 0.25, plantas: true, arvoreNaLaje: true, musgo: true, grade: true }],
    [81, 32, { cipo: 0.6, plantas: true, musgo: true, grade: true }],
    [86, 29, { cipo: 0.3, plantas: true, varal: true, musgo: true, grade: true, portao: true }],
    [81, 49, { cipo: 0.4, plantas: true, musgo: true, grade: true }],
    [62, 13, { cipo: 0.9, plantas: true, musgo: true }],
  ];
  for (const [x0, y0, extra] of HOUSE_GREEN) {
    const house = cenario.find((o) => o.type === 'casa' && o.x === x0 && o.y === y0);
    if (!house) throw new Error(`Casa em (${x0}, ${y0}) não achada.`);
    house.props = { ...house.props, ...extra };
  }
  const budega = cenario.find((o) => o.type === 'casa' && o.name === 'Budega')!;
  budega.props = { ...budega.props, plantas: true, musgo: true };
  for (const o of cenario.filter((c) => c.type === 'poste' || c.type === 'fiacao')) o.props = { ...o.props, cipo: true };
  // o carro largado na Travessa tem uma árvore nascendo de dentro
  const car = cenario.find((o) => o.type === 'carro')!;
  car.props = { ...car.props, arvore: true };
  // o prédio do conjunto habitacional no fundo (5 andares, com árvore na laje e cortina de cipó): longe do ônibus, do
  // pilar do viaduto e das árvores (sem vão de entalar), atrás das casas (não tampa a rua)
  const PREDIO = { x0: 88, x1: 94.4, y0: 13, y1: 22 };
  cenario.push(rect('predio', PREDIO.x0, PREDIO.x1, PREDIO.y0, PREDIO.y1, { andares: 5, altura: 14, cor: '#b8b2a6', cipo: 0.6, arvoreNaLaje: true, varandas: true, caixaDagua: true }, 'Bloco B'));
  {
    const hidden = boxHides(PREDIO, 14);
    if (hidden) throw new Error(`O prédio tampa o ponto (${hidden.join(', ')}) da vila.`);
  }

  // ----- a vida na rua: moto com mato, placa de rua, cadeiras, vasos, lixo e as bandeirinhas da praça -----
  cenario.push(rect('moto', 83.2, 85.2, 41.3, 42.1, { altura: 1.1, cor: '#8a3a2a', mato: true, olhando: 0 }));
  cenario.push(point('placa-rua', 56.3, 47.3, { texto: 'R. SANTO DIAS', texto2: 'TV. JASMIM DA BEIRADA' }));
  // o semáforo quebrado, soltando faísca, na esquina da figueira (pedido do dono, 13/11): na calçada das casas, que para
  // a câmera fica atrás de quem anda na rua; a 1,27 m do tronco, para a calçada passar entre os dois
  cenario.push(point('semaforo', 57, 40.9, { altura: 4.6, olhando: 0, quebrado: true, faiscas: true }, 'Semáforo'));
  // cadeiras de plástico: dois vizinhos na porta da casa amarela e duas na roda da fogueira (na diagonal dos bancos)
  // (as da casa amarela ficam ao lado da porta, não na frente dela: pedido do dono, 13/11)
  for (const [x, y, olhando] of [[83.65, 39.75, 90], [84.15, 39.75, 90], [FIRE.x + 1.9, FIRE.y - 1.9, 135], [FIRE.x - 1.9, FIRE.y + 1.9, 315]] as const) {
    cenario.push(point('cadeira', x, y, { olhando, cor: '#f2f2ee' }));
  }
  for (const [x, y] of [[60.4, 39.75], [73.2, 39.75], [88.6, 39.75]] as const) cenario.push(point('vaso', x, y, { planta: 'espada-de-sao-jorge' }));
  cenario.push(rect('lixo', 80.15, 80.75, 47.55, 48.15, { altura: 0.6 }));
  // (por cima da praça, entre os postes de luz e a árvore: antes um varal passava na frente da porta da Budega, na altura
  // da cabeça, e o dono achou a entrada péssima. As bandeirinhas são desenhadas por cima de tudo: por isso o varal do
  // sul desce até o poste do campinho e, na tela, passa abaixo de quem está na porta da Budega maior)
  cenario.push({ type: 'bandeirinhas', x: 0, y: 0, polyline: [[61.7, 58.3], [71, 61.5], [76.6, 58.2]], props: { altura: 3.2 } });
  cenario.push({ type: 'bandeirinhas', x: 0, y: 0, polyline: [[78.3, 49.3], [76.4, 53.2], [77.2, 57.6]], props: { altura: 3 } });
  // o mato invadindo os cantos da praça
  for (const [cx, cy, rx, ry] of [[61.9, 58.2, 1.4, 0.9], [78.1, 49.6, 1.2, 0.9]] as const) chao.push({ type: 'grama', x: 0, y: 0, polygon: blob(cx, cy, rx, ry, 0.25) });
}

// ---------------- a floresta maior (14/11, pedido do dono: "aumentar a floresta"; planta aprovada) ----------------
// O parque cresce mais 60 m para o sul: a Clareira da Paineira com o parquinho antigo, a Cachoeirinha (o riacho caindo
// das pedras num poço), a mata profunda do sul com o recanto do Véu e o buraco no gradil. A mata ao sul da vila, que era
// só enfeite, vira mata de andar (a mata da estrada), com o posto abandonado na beira da rua para Guarapiranga, que desce
// até o fim novo do mapa. A vila ganha árvores novas. Nada do que já existia muda de lugar: saem só as três árvores do
// caminho da trilha nova e as árvores da mata ao sul da vila que ficariam num vão de entalar. Sorteios próprios:
// SEED + 14 (o parque), SEED + 15 (a mata da estrada).
/** O que é sólido na mata da estrada, para conferir os vãos de entalar enquanto planta (x0, x1, y0, y1). */
interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
const boxGapOk = (a: Box, b: Box) => {
  const dx = Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
  const dy = Math.max(0, b.y0 - a.y1, a.y0 - b.y1);
  return (dx > 0 && dy > 0) || dx + dy <= 0.3 || dx + dy >= MIN_GAP;
};
const squareBox = (x: number, y: number, side: number): Box => ({ x0: x - side / 2, x1: x + side / 2, y0: y - side / 2, y1: y + side / 2 });
/** A caixa do pé de uma coisa do cenário que segura o pé (a mesma conta da colisão, para as que importam aqui). */
function footBox(s: Shape): Box | null {
  const p = s.props ?? {};
  if (s.type === 'arvore') return squareBox(s.x, s.y, Number(p.tronco));
  if (s.type === 'bambu') return squareBox(s.x, s.y, round(Number(p.raio) * 1.6));
  if (s.type === 'arbusto' && p.fechado) return squareBox(s.x, s.y, round(Number(p.raio) * 1.8));
  if (s.type === 'pedra') return squareBox(s.x, s.y, round(Number(p.raio) * 1.5));
  if (s.type === 'poste-praca') return squareBox(s.x, s.y, 0.25);
  if (s.type === 'lixeira') return squareBox(s.x, s.y, 0.5);
  if (s.type === 'placa' && p.poste) return squareBox(s.x, s.y, 0.2);
  if (s.type === 'pneus') return squareBox(s.x, s.y, round(Number(p.raio) * 1.8));
  if (s.point) return null;
  if (['gradil', 'tronco-caido', 'casa', 'barreira', 'bomba', 'banco', 'cachoeira'].includes(s.type)) return { x0: s.x, x1: s.x + s.w!, y0: s.y, y1: s.y + s.h! };
  return null;
}
/** As caixas que seguram o pé (a cobertura do posto só nos quatro pilares; o balanço só nos dois pés de ferro). */
function boxesOf(s: Shape): Box[] {
  const p = s.props ?? {};
  if (s.type === 'cobertura') {
    const [i, side] = [0.6, Number(p.pilares)];
    return [[s.x + i, s.y + i], [s.x + s.w! - i, s.y + i], [s.x + i, s.y + s.h! - i], [s.x + s.w! - i, s.y + s.h! - i]].map(([x, y]) => squareBox(x!, y!, side));
  }
  if (s.type === 'parquinho' && p.brinquedo === 'balanco') {
    const along = s.w! >= s.h!;
    const ends = along ? [[s.x + 0.125, s.y + s.h! / 2], [s.x + s.w! - 0.125, s.y + s.h! / 2]] : [[s.x + s.w! / 2, s.y + 0.125], [s.x + s.w! / 2, s.y + s.h! - 0.125]];
    return ends.map(([x, y]) => squareBox(x!, y!, 0.25));
  }
  if (s.type === 'parquinho' && p.brinquedo === 'escorregador') return [{ x0: s.x, x1: s.x + s.w!, y0: s.y, y1: s.y + s.h! }];
  if (s.type === 'parquinho') return [squareBox(s.x, s.y, round(Number(p.raio) * 1.75))];
  const b = footBox(s);
  return b ? [b] : [];
}
/**
 * Cabe no vão entre a e b (de frente um para o outro) um quadrado de 0,3 m fora das outras caixas? É onde o pé de
 * 0,6 × 0,4 começa a entrar de lado e entala (como entre o orelhão e o poste). Quando outras coisas enchem o vão e só
 * sobra uma fresta mais fina que isso (os arbustos da parede se encostam e, quando um é menor que o vizinho, sobra um
 * dente), o pé não entra.
 */
function pocketOpen(a: Box, b: Box, all: Box[]): boolean {
  const inX = a.x1 <= b.x0 || b.x1 <= a.x0; // separados no x: o vão corre no y
  const [g0, g1] = inX ? (a.x1 <= b.x0 ? [a.x1, b.x0] : [b.x1, a.x0]) : a.y1 <= b.y0 ? [a.y1, b.y0] : [b.y1, a.y0];
  const [m0, m1] = inX ? [Math.max(a.y0, b.y0), Math.min(a.y1, b.y1)] : [Math.max(a.x0, b.x0), Math.min(a.x1, b.x1)];
  const r = inX ? { x0: g0, x1: g1, y0: m0, y1: m1 } : { x0: m0, x1: m1, y0: g0, y1: g1 };
  const STEP = 0.05;
  const N = Math.round(0.3 / STEP);
  const [cols, rows] = [Math.round((r.x1 - r.x0) / STEP), Math.round((r.y1 - r.y0) / STEP)];
  if (cols < N || rows < N) return false;
  const others = all.filter((c) => c !== a && c !== b && c.x1 > r.x0 && c.x0 < r.x1 && c.y1 > r.y0 && c.y0 < r.y1);
  // soma acumulada das células ocupadas, para achar um quadrado N × N todo livre
  const W1 = cols + 1;
  const sum = new Float64Array((rows + 1) * W1);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const [cx, cy] = [r.x0 + (j + 0.5) * STEP, r.y0 + (i + 0.5) * STEP];
      const taken = others.some((o) => cx > o.x0 && cx < o.x1 && cy > o.y0 && cy < o.y1) ? 1 : 0;
      sum[(i + 1) * W1 + j + 1] = taken + sum[i * W1 + j + 1]! + sum[(i + 1) * W1 + j]! - sum[i * W1 + j]!;
    }
  }
  for (let i = N; i <= rows; i++) {
    for (let j = N; j <= cols; j++) if (sum[i * W1 + j]! - sum[(i - N) * W1 + j]! - sum[i * W1 + j - N]! + sum[(i - N) * W1 + j - N]! === 0) return true;
  }
  return false;
}
/**
 * Tira do cenário as plantas sorteadas (`prunable`) que ficaram num vão de entalar (0,3 a MIN_GAP, de frente) com outra
 * coisa sólida da região. Se o vão for entre duas coisas postas à mão, para tudo: é preciso mudar o lugar de uma delas.
 */
function pruneWedges(region: (o: Shape) => boolean, prunable: (o: Shape) => boolean): number {
  let removed = 0;
  for (;;) {
    const items = cenario.filter(region).flatMap((o) => boxesOf(o).map((b) => ({ o, b })));
    let culprit: Shape | undefined;
    for (let i = 0; i < items.length && !culprit; i++) {
      for (let j = i + 1; j < items.length && !culprit; j++) {
        const [a, b] = [items[i]!, items[j]!];
        if (a.o === b.o || (a.o.type === 'arbusto' && b.o.type === 'arbusto')) continue; // a mata fechada é parede
        const dx = Math.max(0, b.b.x0 - a.b.x1, a.b.x0 - b.b.x1);
        const dy = Math.max(0, b.b.y0 - a.b.y1, a.b.y0 - b.b.y1);
        if ((dx > 0 && dy > 0) || dx + dy <= 0.3 || dx + dy >= MIN_GAP) continue;
        if (!pocketOpen(a.b, b.b, items.map((i) => i.b))) continue;
        culprit = prunable(b.o) ? b.o : prunable(a.o) ? a.o : undefined;
        if (!culprit) throw new Error(`Vão de entalar (${(dx + dy).toFixed(2)} m) entre ${a.o.type} (${a.o.x}, ${a.o.y}) e ${b.o.type} (${b.o.x}, ${b.o.y}).`);
      }
    }
    if (!culprit) return removed;
    cenario.splice(cenario.indexOf(culprit), 1);
    removed++;
  }
}
if (FLORESTA_MAIOR) {
  const prng2 = mulberry32(SEED + 14);
  // ----- o riacho novo e o poço passam a existir para a mata (a mata antiga já foi sorteada) -----
  STREAMS.push(STREAM_SOUTH);
  PONDS.push(POOL_PTS);
  // ----- o chão: a mata profunda, a lama e a água entram junto das do mesmo tipo (por baixo das trilhas); as clareiras e
  // as trilhas novas por cima de tudo -----
  const after = (type: string, ...items: Shape[]) => chao.splice(chao.map((c) => c.type).lastIndexOf(type) + 1, 0, ...items);
  after('mata-profunda', { type: 'mata-profunda', x: 0, y: 0, polygon: blob(DEEP_SOUTH.x, DEEP_SOUTH.y, DEEP_SOUTH.rx, DEEP_SOUTH.ry, 0.12) });
  after(
    'lama',
    { type: 'lama', x: 0, y: 0, polygon: blob(POOL.x, POOL.y, POOL.rx + 1.2, POOL.ry + 1.1, 0.12, 28) },
    { type: 'lama', x: 0, y: 0, polyline: STREAM_SOUTH, props: { largura: STREAM_W + 1.4 } },
  );
  // (o riacho primeiro e o poço por cima: senão a faixa do riacho aparece atravessando o poço)
  after(
    'agua',
    { type: 'agua', x: 0, y: 0, polyline: STREAM_SOUTH, props: { cor: '#2f6f6a', largura: STREAM_W } },
    { type: 'agua', x: 0, y: 0, polygon: POOL_PTS, props: { cor: '#2f7a73' } },
  );
  chao.push(ellipse('grama', PAINEIRA_C.x, PAINEIRA_C.y, PAINEIRA_C.r));
  chao.push(ellipse('grama', RECANTO.x, RECANTO.y, RECANTO.r));
  for (const t of SOUTH_TRAILS) chao.push({ type: 'trilha', x: 0, y: 0, polyline: t.pts, props: { largura: t.largura } });

  // ----- o que a câmera precisa ver livre (as trilhas, as clareiras, o poço e as pedras) e por onde nada alto nasce -----
  for (const t of SOUTH_TRAILS) {
    ALL_TRAILS.push({ pts: t.pts, half: t.largura / 2 });
    VIEW_KEYS.push(...pathPoints(t.pts, t.largura));
  }
  for (const c of [PAINEIRA_C, RECANTO]) {
    for (let x = c.x - c.r; x <= c.x + c.r; x += 1) for (let y = c.y - c.r; y <= c.y + c.r; y += 1) if (dist(x, y, c.x, c.y) <= c.r) VIEW_KEYS.push([x, y]);
  }
  for (let x = POOL.x - POOL.rx; x <= POOL.x + POOL.rx; x += 1) for (let y = POOL.y - POOL.ry; y <= POOL.y + POOL.ry; y += 1) if (inside(x, y, POOL_PTS)) VIEW_KEYS.push([x, y]);
  VIEW_KEYS.push([PEDRAS.x0, PEDRAS.y0], [PEDRAS.x1, PEDRAS.y0], [PEDRAS.x0, PEDRAS.y1], [PEDRAS.x1, PEDRAS.y1], [stonesX, stonesY]);

  // ----- a mata antiga abre caminho para a trilha nova: saem três árvores e as plantas baixas que ficavam nela -----
  for (const [x, y] of SOUTH_TRAIL_CLEARED) {
    const i = cenario.findIndex((o) => o.type === 'arvore' && Math.abs(o.x - x) < 0.06 && Math.abs(o.y - y) < 0.06);
    if (i === -1) throw new Error(`A árvore (${x}, ${y}) do caminho da trilha nova não está mais lá: confira o traçado.`);
    const [o] = cenario.splice(i, 1);
    trees.splice(trees.findIndex((t) => Math.abs(t.x - o!.x) < 0.01 && Math.abs(t.y - o!.y) < 0.01), 1);
  }
  for (let i = cenario.length - 1; i >= 0; i--) {
    const o = cenario[i]!;
    if (o.type !== 'planta' || o.y > H0) continue;
    if (SOUTH_TRAILS.some((t) => distToPath(o.x, o.y, t.pts) < t.largura / 2 + Number(o.props?.raio ?? 0.4) + 0.2)) cenario.splice(i, 1);
  }
  // nada da mata antiga em cima da trilha nova, nem copa tampando ela na tela (as mesmas regras de quando a mata nasceu)
  {
    const t = SOUTH_TRAILS[0]!;
    const keys = pathPoints(t.pts, t.largura);
    const hides = (o: Shape, copa: number, altura: number) => keys.some(([kx, ky]) => covers(o.x, o.y, copa, altura, kx, ky));
    for (const o of cenario) {
      if (o.x > PARK_X || o.y > H0 + 1) continue;
      const p = o.props ?? {};
      const gap = distToPath(o.x, o.y, t.pts) - t.largura / 2;
      const bad =
        (o.type === 'arvore' && (gap < Number(p.copa) + 0.3 || hides(o, Number(p.copa), Number(p.altura)))) ||
        (o.type === 'bambu' && (gap < Number(p.raio) + 0.8 || hides(o, Number(p.raio) * 1.3, Number(p.altura)))) ||
        (o.type === 'arbusto' && p.fechado === true && gap < Number(p.raio) + 0.8) ||
        (o.type === 'pedra' && gap < Number(p.raio) + 0.3);
      if (bad) throw new Error(`${o.type} em (${o.x}, ${o.y}) fica em cima da trilha nova ou tampa ela: tire do caminho (SOUTH_TRAIL_CLEARED).`);
    }
  }

  // ----- a cachoeirinha: as pedras de onde o riacho cai no poço (na ponta norte dele), uma pedra de cada lado, e as
  // pedras de atravessar o riacho logo abaixo do poço (dá para andar em cima, como na pinguela) -----
  const fallY = round(POOL.y - POOL.ry - 0.25);
  const fallX = round(13.5 + ((14.3 - 13.5) * (fallY - 153)) / (159.5 - 153)); // onde o riacho chega no poço
  const FALL = { x0: round(fallX - 1.7), x1: round(fallX + 1.7), y0: round(fallY - 0.7), y1: round(fallY + 0.7) };
  cenario.push(rect('cachoeira', FALL.x0, FALL.x1, FALL.y0, FALL.y1, { altura: 1.6, queda: 'sul', musgo: true }, 'Cachoeirinha'));
  reserved.push({ x: fallX, y: fallY, r: 3.2 });
  for (const [dx, raio] of [[-2.3, 0.6], [2.25, 0.55]] as const) cenario.push(point('pedra', round(fallX + dx), round(fallY + 0.2), { raio, musgo: true }));
  cenario.push(rect('pinguela', PEDRAS.x0, PEDRAS.x1, PEDRAS.y0, PEDRAS.y1, { altura: 0.2, pedras: true }));
  reserved.push({ x: stonesX, y: stonesY, r: 2.4 });
  // o recanto do Véu, no fim da trilha da mata profunda do sul (a clareira pequena onde vai morar o bicho mais forte)
  reserved.push({ x: RECANTO.x, y: RECANTO.y, r: RECANTO.r + 0.5 });
  cenario.push(point('veu', RECANTO.x, RECANTO.y, { raio: 1.4 }));
  // troncos caídos na mata profunda do sul e na beira da mata (longe das trilhas)
  for (const [x, y, w, h] of [[19.5, 176, 3.4, 0.6], [3.4, 152, 0.6, 3.2], [40.5, 172.5, 3.6, 0.6]] as const) {
    if (trailGap(x, y) < Math.max(w, h) / 2 + 1 || waterGap(x, y) < Math.max(w, h) / 2 + 0.8) throw new Error(`O tronco caído em (${x}, ${y}) fica perto da trilha ou da água.`);
    reserved.push({ x, y, r: Math.max(w, h) / 2 + 1.3 });
    cenario.push(rect('tronco-caido', round(x - w / 2), round(x + w / 2), round(y - h / 2), round(y + h / 2), { altura: 0.6 }));
  }

  // ----- a paineira: na beirada da clareira, onde o tronco não pisa em trilha e a copa alta não tampa nenhuma trilha,
  // o poço nem as pedras (só a própria clareira, como a Figueira dos Despertos). De preferência ao noroeste: a copa
  // "sobe" na tela para trás da clareira e deixa o parquinho à vista -----
  const PAINEIRA = { especie: 'paineira', copa: 5, altura: 9, tronco: 1.6 };
  let pSpot: [number, number] | undefined;
  let pScore = Infinity;
  for (const d of [PAINEIRA_C.r - 0.5, PAINEIRA_C.r, PAINEIRA_C.r + 0.8]) {
    for (let a = 0; a < 360; a += 5) {
      const [x, y] = [round(PAINEIRA_C.x + Math.cos((a * Math.PI) / 180) * d), round(PAINEIRA_C.y + Math.sin((a * Math.PI) / 180) * d)];
      if (trailGap(x, y) < PAINEIRA.tronco / 2 + 1 || waterGap(x, y) < 3 || !free(x, y, PAINEIRA.tronco / 2 + 1)) continue;
      if (!trees.every((t) => dist(x, y, t.x, t.y) - (t.tronco + PAINEIRA.tronco) / 2 >= TRUNK_GAP + 1.5)) continue;
      const hides = VIEW_KEYS.some(([kx, ky]) => dist(kx, ky, PAINEIRA_C.x, PAINEIRA_C.y) > PAINEIRA_C.r + 0.01 && covers(x, y, PAINEIRA.copa, PAINEIRA.altura, kx, ky));
      if (hides) continue;
      const score = Math.abs(((a - 225 + 540) % 360) - 180); // longe do noroeste (225°, com y para baixo) é pior
      if (score < pScore) [pSpot, pScore] = [[x, y], score];
    }
  }
  if (!pSpot) throw new Error('Não achei lugar para a paineira na beira da clareira sem tampar trilha, poço ou pedras.');
  trees.push({ x: pSpot[0], y: pSpot[1], tronco: PAINEIRA.tronco });
  reserved.push({ x: pSpot[0], y: pSpot[1], r: PAINEIRA.tronco / 2 + 0.6 });
  cenario.push(point('arvore', pSpot[0], pSpot[1], { ...PAINEIRA, flores: '#e58fb0' }, 'Paineira'));

  // ----- o parquinho antigo, enferrujado e com cipó: balanço, escorregador e gira-gira; um banco de concreto com a
  // lixeira e um poste de parque apagado. Tudo fora das trilhas e sem vão de entalar (como o parque antigo) -----
  /** As caixas sólidas da clareira e em volta, para nada encostar errado. */
  const parkSolids: Box[] = [];
  for (const o of cenario) {
    if (dist(o.x, o.y, PAINEIRA_C.x, PAINEIRA_C.y) > PAINEIRA_C.r + 8) continue;
    const b = footBox(o);
    if (b) parkSolids.push(b);
  }
  const fitsPark = (b: Box, trailMargin: number) => {
    const [cx, cy] = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
    const half = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2;
    if (trailGap(cx, cy) < half + trailMargin || waterGap(cx, cy) < half + 0.6) return false;
    return parkSolids.every((s) => boxGapOk(b, s));
  };
  /** O lugar mais perto de (x, y) onde a caixa w × h cabe (anda em espiral, de 0,25 em 0,25 m). */
  const nearPark = (x: number, y: number, w: number, h: number, trailMargin: number): [number, number] => {
    for (let d = 0; d <= 3; d += 0.25) {
      for (let k = 0; k < (d === 0 ? 1 : 16); k++) {
        const [px, py] = [round(x + Math.cos((k / 16) * Math.PI * 2) * d), round(y + Math.sin((k / 16) * Math.PI * 2) * d)];
        const b = { x0: px - w / 2, x1: px + w / 2, y0: py - h / 2, y1: py + h / 2 };
        if (fitsPark(b, trailMargin)) {
          parkSolids.push(b);
          reserved.push({ x: px, y: py, r: Math.max(w, h) / 2 + 0.4 });
          return [px, py];
        }
      }
    }
    throw new Error(`Não achei lugar para uma coisa do parquinho perto de (${x}, ${y}).`);
  };
  {
    // o balanço (só os dois pés de ferro seguram o pé), comprido no sentido leste-oeste
    const [x, y] = nearPark(PAINEIRA_C.x + 0.2, PAINEIRA_C.y - 2.4, 3, 0.6, 0.8);
    cenario.push(rect('parquinho', round(x - 1.5), round(x + 1.5), round(y - 0.3), round(y + 0.3), { brinquedo: 'balanco', altura: 2.2, ferrugem: true, cipo: true, quebrado: true }));
  }
  {
    // o escorregador, comprido no sentido norte-sul (a escada no norte, a rampa descendo para o sul)
    const [x, y] = nearPark(PAINEIRA_C.x + 3.6, PAINEIRA_C.y + 0.2, 0.7, 2.6, 0.8);
    cenario.push(rect('parquinho', round(x - 0.35), round(x + 0.35), round(y - 1.3), round(y + 1.3), { brinquedo: 'escorregador', altura: 1.8, ferrugem: true, cipo: true, olhando: 90 }));
  }
  {
    // o gira-gira, com samambaia nascendo no meio
    const [x, y] = nearPark(PAINEIRA_C.x - 0.6, PAINEIRA_C.y + 2.6, 1.6, 1.6, 0.8);
    cenario.push(point('parquinho', x, y, { brinquedo: 'gira-gira', raio: 0.8, altura: 0.6, ferrugem: true, plantas: true }));
  }
  {
    // o banco de concreto na beira da clareira, virado para o parquinho, com a lixeira encostada
    const [x, y] = nearPark(PAINEIRA_C.x - 3.6, PAINEIRA_C.y + 4.6, 2.1, 0.5, 0.5);
    cenario.push(rect('banco', round(x - 1.05), round(x + 0.55), round(y - 0.25), round(y + 0.25), { olhando: 270, material: 'concreto', mato: true }));
    cenario.push(point('lixeira', round(x + 0.8), y, { mato: true }));
  }
  {
    const [x, y] = nearPark(PAINEIRA_C.x + 5, PAINEIRA_C.y - 4.4, 0.25, 0.25, 0.4);
    cenario.push(point('poste-praca', x, y, { altura: 3.2, apagado: true, torto: true, cipo: true }));
  }

  reserved.push({ x: PAINEIRA_C.x, y: PAINEIRA_C.y, r: PAINEIRA_C.r + 0.5 });

  // ----- as árvores da faixa nova (do mesmo jeito da mata antiga; mais espaçadas onde vão viver os bichos novos) -----
  const inNewZone = (x: number, y: number) => [NEW_ZONES.meio, NEW_ZONES.chefe].some((z) => inRect(x, y, z));
  const southY = (pad = 0) => H0 - 2 + prng2() * (H - H0 - pad);
  for (let tries = 0; tries < 6000; tries++) {
    const x = 2 + prng2() * (PARK_X - 4);
    const y = southY();
    const k = prng2();
    const especie = k < 0.1 ? 'jeriva' : k < 0.22 ? 'embauba' : 'mata';
    const d = SPECIES[especie] ?? { tronco: round(0.4 + prng2() * 0.25), copa: round(1.7 + prng2() * 1.2), altura: round(5 + prng2() * 3.5) };
    plant(x, y, especie, d, TRUNK_GAP + (inNewZone(x, y) ? 5 : 2.6));
  }
  // árvores secas: mais na mata profunda do sul
  for (let i = 0, n = 0; i < 800 && n < 6; i++) {
    const [x, y] = [DEEP_SOUTH.x + (prng2() * 2 - 1) * DEEP_SOUTH.rx, DEEP_SOUTH.y + (prng2() * 2 - 1) * DEEP_SOUTH.ry];
    if (inEllipse(x, y, DEEP_SOUTH) && plant(x, y, 'seca', SPECIES.seca!, TRUNK_GAP + 1.5)) n++;
  }
  for (let i = 0, n = 0; i < 1000 && n < 3; i++) {
    const [x, y] = [2 + prng2() * (PARK_X - 4), southY()];
    if (!inEllipse(x, y, DEEP_SOUTH) && plant(x, y, 'seca', SPECIES.seca!, TRUNK_GAP + 1.5)) n++;
  }
  // xaxins na beira do riacho e do poço; bananeiras em volta da clareira da paineira
  for (let i = 0, n = 0; i < 3000 && n < 9; i++) {
    const [x, y] = [2 + prng2() * (PARK_X - 4), southY()];
    const g = waterGap(x, y);
    if (g > 1 && g < 6 && plant(x, y, 'xaxim', SPECIES.xaxim!, TRUNK_GAP + 0.6)) n++;
  }
  for (let i = 0, n = 0; i < 3000 && n < 7; i++) {
    const a = prng2() * Math.PI * 2;
    const rr = PAINEIRA_C.r + 1.5 + prng2() * 4;
    if (plant(PAINEIRA_C.x + Math.cos(a) * rr, PAINEIRA_C.y + Math.sin(a) * rr, 'bananeira', SPECIES.bananeira!, TRUNK_GAP + 0.8)) n++;
  }
  // moitas de bambu e de mata fechada: paredes na mata profunda do sul e na faixa oeste, do outro lado do riacho
  for (let i = 0, nb = 0, na = 0; i < 1500 && (nb < 8 || na < 6); i++) {
    const [x, y] = [DEEP_SOUTH.x + (prng2() * 2 - 1) * DEEP_SOUTH.rx, DEEP_SOUTH.y + (prng2() * 2 - 1) * DEEP_SOUTH.ry];
    if (!inEllipse(x, y, DEEP_SOUTH)) continue;
    const bamboo = nb < 8 && (na >= 6 || prng2() < 0.55);
    const r = round(bamboo ? 1 + prng2() * 0.4 : 0.7 + prng2() * 0.45);
    if (plantClump(x, y, r, bamboo ? 'bambu' : 'arbusto', bamboo ? 7 : 1.2)) bamboo ? nb++ : na++;
  }
  for (let i = 0, n = 0; i < 1500 && n < 5; i++) {
    const [x, y] = [2.5 + prng2() * 7, H0 + prng2() * 38];
    if (STREAMS.every((s) => distToPath(x, y, s) > 2.5) && plantClump(x, y, round(1 + prng2() * 0.4), 'bambu', 7)) n++;
  }
  // a beira nova do parque: mata fechada no oeste e no sul (a beira sul antiga saiu)
  for (let y = 0.6 + 1.1 * Math.ceil((H0 - 0.6) / 1.1); y < H; y += 1.1) cenario.push(point('arbusto', 0.6, round(y), { raio: round(0.9 + prng2() * 0.25), fechado: true }));
  for (let x = 1.7; x < PARK_X - 0.6; x += 1.1) cenario.push(point('arbusto', round(x), H - 0.6, { raio: round(0.9 + prng2() * 0.25), fechado: true }));
  // pedras em grupos na beira do poço e do riacho
  for (const [x, y, raio] of [[18.9, 157.2, 0.7], [19.7, 157.9, 0.35], [10.1, 162.6, 0.65], [9.4, 161.7, 0.35], [17.1, 146.8, 0.55], [11.2, 138.6, 0.5]] as const) {
    if (trailGap(x, y) < raio + 0.3 || waterGap(x, y) < 0.1 || !free(x, y, raio)) continue;
    reserved.push({ x, y, r: raio + 0.4 });
    cenario.push(point('pedra', x, y, { raio }));
  }

  // ----- o chão da mata nova (não bloqueia): samambaias, helicônias, taboas no poço e cogumelos que brilham -----
  const lowFitsSouth = (x: number, y: number, raio: number) =>
    lowFits(x, y, raio) && dist(x, y, PAINEIRA_C.x, PAINEIRA_C.y) >= PAINEIRA_C.r - 1 && dist(x, y, RECANTO.x, RECANTO.y) >= RECANTO.r - 1 && free(x, y, raio * 0.5);
  for (let i = 0, n = 0; i < 3000 && n < 70; i++) {
    const [x, y, raio] = [2 + prng2() * (PARK_X - 4), southY(), round(0.5 + prng2() * 0.4)];
    if (y > H - 2 || waterGap(x, y) < raio || !lowFitsSouth(x, y, raio)) continue;
    cenario.push(point('planta', round(x), round(y), { tipo: 'samambaia', raio }));
    n++;
  }
  for (let i = 0, n = 0; i < 3000 && n < 14; i++) {
    const [x, y, raio] = [2 + prng2() * (PARK_X - 4), southY(), round(0.5 + prng2() * 0.3)];
    const g = waterGap(x, y);
    const byClearing = Math.abs(dist(x, y, PAINEIRA_C.x, PAINEIRA_C.y) - PAINEIRA_C.r - 1.2) < 1;
    if (y < H - 2 && ((g > raio && g < 3.5) || byClearing) && lowFitsSouth(x, y, raio)) {
      cenario.push(point('planta', round(x), round(y), { tipo: 'heliconia', raio }));
      n++;
    }
  }
  for (let i = 0, n = 0; i < 400 && n < 6; i++) {
    const a = 1.2 + prng2() * 3.2; // a margem oeste e sul do poço, longe da queda d'água
    const k = 0.72 + prng2() * 0.16;
    const [x, y] = [round(POOL.x + Math.cos(a) * POOL.rx * k), round(POOL.y + Math.sin(a) * POOL.ry * k)];
    if (isWater(x, y) && dist(x, y, fallX, fallY) > 2) {
      cenario.push(point('planta', x, y, { tipo: 'taboa', raio: round(0.4 + prng2() * 0.2) }));
      n++;
    }
  }
  for (let i = 0, n = 0; i < 3000 && n < 16; i++) {
    const spot = [DEEP_SOUTH, { x: RECANTO.x, y: RECANTO.y, rx: RECANTO.r + 2, ry: RECANTO.r + 2 }][i % 2]!;
    const [x, y] = [spot.x + (prng2() * 2 - 1) * spot.rx, spot.y + (prng2() * 2 - 1) * spot.ry];
    if (x > 2 && y < H - 2 && inEllipse(x, y, spot) && waterGap(x, y) > 0.5 && lowFits(x, y, 0.3) && free(x, y, 0.2)) {
      cenario.push(point('planta', round(x), round(y), { tipo: 'cogumelo', raio: round(0.25 + prng2() * 0.15), brilho: '#3fd6c8' }));
      n++;
    }
  }

  // ---------------- a mata da estrada e o posto abandonado ----------------
  const erng = mulberry32(SEED + 15);
  const inEast = (o: Shape) => o.x > PARK_X - 0.3 && o.y > VILLAGE_S - 2;
  // a trilha do buraco no gradil até o fundo do posto
  chao.push({ type: 'trilha', x: 0, y: 0, polyline: EAST_TRAIL, props: { largura: 1.8 } });
  VILLAGE_KEYS.push(...pathPoints(EAST_TRAIL, 1.8).map(([x, y]) => [x, y, 0] as [number, number, number]));
  for (let x = POSTO.x0 + 1; x < POSTO.x1; x += 2) for (let y = POSTO.y0 + 1; y < POSTO.y1; y += 2) if (!inRect(x, y, POSTO_SHOP)) VILLAGE_KEYS.push([x, y, 0]);

  // ----- o posto: o pátio de concreto rachado, a cobertura das bombas (só os quatro pilares seguram o pé), duas bombas
  // enferrujadas, a lojinha de vidro quebrado, a pilha de pneus e a placa em branco (sem marca nenhuma) -----
  chao.push(rect('calcada', POSTO.x0, POSTO.x1, POSTO.y0, POSTO.y1, { desenho: 'placas', estado: 'rachado', cor: '#8f8c82' }));
  cenario.push(rect('cobertura', POSTO_ROOF.x0, POSTO_ROOF.x1, POSTO_ROOF.y0, POSTO_ROOF.y1, { altura: 4.2, pilares: 0.4, mato: true, cipo: 0.6, arvoresNoTopo: true }));
  for (const [x0, x1] of [[81.8, 82.3], [83.6, 84.1]] as const) {
    cenario.push(rect('bomba', x0, x1, 143.4, 144.6, { altura: 1.6, ferrugem: true, plantas: true, olhando: 0 }));
  }
  cenario.push(rect('casa', POSTO_SHOP.x0, POSTO_SHOP.x1, POSTO_SHOP.y0, POSTO_SHOP.y1, { altura: 3, andares: 1, cor: '#d8d2c4', caixaDagua: false, posto: true, vitrineQuebrada: true, cipo: 0.7, plantas: true, musgo: true }));
  cenario.push(point('pneus', 77.6, 148.3, { raio: 0.55, pilha: 4 }));
  cenario.push(point('placa', 87.1, 149.4, { texto: '', poste: true, torta: true }));
  // uma árvore rompeu o pátio, no canto do fundo (a copa por cima do concreto)
  {
    const d = { tronco: 0.5, copa: 2.6, altura: 6.5 };
    if (canopyHides(74.6, 148.2, d.copa, d.altura)) throw new Error('A árvore do pátio do posto tampa a estrada, a trilha ou o pátio.');
    cenario.push(point('arvore', 74.6, 148.2, { especie: 'mata', ...d, rompendo: true }));
  }
  // o mato tomando o pátio: rachaduras com capim, moitas de grama nos cantos e raízes saindo da mata
  for (const [cx, cy, rx, ry] of [[73.9, 145.8, 0.9, 1.6], [87.2, 139.6, 0.8, 0.6], [79.4, 149.4, 1.4, 0.6]] as const) chao.push({ type: 'grama', x: 0, y: 0, polygon: blob(cx, cy, rx, ry, 0.25) });
  for (let i = 0, n = 0; i < 200 && n < 7; i++) {
    let [x, y]: [number, number] = [POSTO.x0 + 0.6 + erng() * (POSTO.x1 - POSTO.x0 - 1.2), POSTO.y0 + 0.6 + erng() * (POSTO.y1 - POSTO.y0 - 1.2)];
    const pts: [number, number][] = [[round(x), round(y)]];
    let a = erng() * Math.PI * 2;
    for (let k = 0; k < 3 + Math.floor(erng() * 3); k++) {
      a += (erng() - 0.5) * 1.6;
      const l = 0.5 + erng() * 0.9;
      const [nx, ny] = [x + Math.cos(a) * l, y + Math.sin(a) * l];
      if (!inRect(nx, ny, { x0: POSTO.x0 + 0.3, x1: POSTO.x1 - 0.3, y0: POSTO.y0 + 0.3, y1: POSTO.y1 - 0.3 }) || inRect(nx, ny, POSTO_SHOP)) break;
      [x, y] = [nx, ny];
      pts.push([round(x), round(y)]);
    }
    if (pts.length < 3 || inRect(pts[0]![0], pts[0]![1], POSTO_SHOP)) continue;
    chao.push({ type: 'rachadura', x: 0, y: 0, polyline: pts, props: { largura: 0.06, cor: '#3a3a36', mato: true } });
    n++;
  }
  for (const pts of [[[74.6, 148.6], [75.9, 149.3], [77, 149.1]], [[74.2, 147.9], [73.5, 146.8]]] as [number, number][][]) {
    chao.push({ type: 'raiz', x: 0, y: 0, polyline: pts, props: { largura: 0.3, altura: 0.2, cor: '#6b4a2e' } });
  }
  // ----- a rua para Guarapiranga no trecho novo: a faixa já desce até a barreira; rachaduras, um buraco com água e o
  // capim nas beiradas (o trecho de antes fica igual) -----
  const onNewRoad = (x: number, y: number) => x > ROAD_GUARA.x0 + 0.3 && x < ROAD_GUARA.x1 - 0.3 && y > SOUTH_BARRIER_Y0 && y < SOUTH_BARRIER_Y - 0.5;
  for (let i = 0, n = 0; i < 300 && n < 12; i++) {
    let [x, y]: [number, number] = [ROAD_GUARA.x0 + 0.5 + erng() * 5, SOUTH_BARRIER_Y0 + 1 + erng() * (SOUTH_BARRIER_Y - SOUTH_BARRIER_Y0 - 2)];
    if (!onNewRoad(x, y)) continue;
    const pts: [number, number][] = [[round(x), round(y)]];
    let a = erng() * Math.PI * 2;
    for (let k = 0; k < 3 + Math.floor(erng() * 3); k++) {
      a += (erng() - 0.5) * 1.6;
      const l = 0.5 + erng() * 0.9;
      const [nx, ny] = [x + Math.cos(a) * l, y + Math.sin(a) * l];
      if (!onNewRoad(nx, ny)) break;
      [x, y] = [nx, ny];
      pts.push([round(x), round(y)]);
    }
    if (pts.length < 3) continue;
    chao.push({ type: 'rachadura', x: 0, y: 0, polyline: pts, props: { largura: 0.06, cor: '#1e2022', mato: erng() < 0.7 } });
    n++;
  }
  chao.push(point('buraco', 90.4, 131.5, { raio: 0.5, agua: true }), point('buraco', 92.2, 158.6, { raio: 0.45, agua: true }));
  for (const [cx, cy, rx, ry] of [[89.4, 126, 1.2, 3], [92.8, 164, 1.1, 2.6]] as const) chao.push({ type: 'grama', x: 0, y: 0, polygon: blob(cx, cy, rx, ry, 0.2) });
  for (const x of [ROAD_GUARA.x0 + 0.25, ROAD_GUARA.x1 - 0.25]) {
    for (let y = SOUTH_BARRIER_Y0 + erng() * 2; y < SOUTH_BARRIER_Y - 1; y += 1.5 + erng() * 3) {
      if (x < ROAD_GUARA.x0 + 1 && y > POSTO.y0 && y < POSTO.y1) continue; // na boca do posto, não
      chao.push(point('planta', x, round(y), { tipo: 'capim', raio: round(0.2 + erng() * 0.15) }));
    }
  }

  // ----- as árvores da mata da estrada (como as de antes: troncos bem espaçados; mais ainda onde vão viver os bichos
  // novos), longe da rua, do pátio e da trilha, sem tampar a rua, a trilha nem o posto e sem vão de entalar -----
  const eastBoxes: Box[] = cenario.filter((o) => inEast(o) || o.type === 'gradil').flatMap(boxesOf);
  const eastTrees: Tree[] = cenario.filter((o) => inEast(o) && o.y > VILLAGE_S && (o.type === 'arvore' || o.type === 'bambu')).map((o) => ({ x: o.x, y: o.y, tronco: o.type === 'bambu' ? Number(o.props!.raio) * 2 : Number(o.props!.tronco) }));
  const inEastZone = (x: number, y: number) => inRect(x, y, NEW_ZONES.estradaSul);
  const eastFits = (x: number, y: number, tronco: number, copa: number, altura: number, side: number) => {
    if (x < PARK_X + 1.4 || x > ROAD_GUARA.x0 - 2.2 - tronco / 2 || y < H0 - 1 || y > H - 2.2) return false;
    if (inRect(x, y, { x0: POSTO.x0 - 1.5, x1: POSTO.x1, y0: POSTO.y0 - 1.5, y1: POSTO.y1 + 1.5 })) return false;
    if (distToPath(x, y, EAST_TRAIL) - 0.9 < copa + 0.3) return false;
    if (!eastTrees.every((t) => dist(x, y, t.x, t.y) - (t.tronco + tronco) / 2 >= TRUNK_GAP + (inEastZone(x, y) ? 3.5 : 1.4))) return false;
    if (canopyHides(x, y, copa, altura) || hidesView(x, y, copa, altura)) return false; // nem a rua e o posto, nem as trilhas do parque
    return eastBoxes.every((b) => boxGapOk(squareBox(x, y, side), b));
  };
  const plantEast = (x: number, y: number, s: Shape, tronco: number, side: number) => {
    eastTrees.push({ x, y, tronco });
    eastBoxes.push(squareBox(x, y, side));
    cenario.push(s);
  };
  for (let i = 0, n = 0; i < 4000 && n < 62; i++) {
    const [x, y] = [PARK_X + 1.5 + erng() * (ROAD_GUARA.x0 - PARK_X - 3.5), H0 - 1 + erng() * (H - H0 - 1)];
    const k = erng();
    const especie = k < 0.15 ? 'jeriva' : k < 0.3 ? 'embauba' : 'mata';
    const d = SPECIES[especie] ?? { tronco: round(0.4 + erng() * 0.25), copa: round(1.7 + erng() * 1.2), altura: round(5 + erng() * 3.5) };
    if (!eastFits(x, y, d.tronco, d.copa, d.altura, d.tronco)) continue;
    plantEast(x, y, point('arvore', round(x), round(y), { especie, ...d }), d.tronco, d.tronco);
    n++;
  }
  for (let i = 0, n = 0; i < 2000 && n < 14; i++) {
    const [x, y, r] = [PARK_X + 2 + erng() * (ROAD_GUARA.x0 - PARK_X - 4), H0 + erng() * (H - H0 - 2), round(1 + erng() * 0.4)];
    if (!eastFits(x, y, r * 2, r * 1.3, 7, round(r * 1.6))) continue;
    plantEast(x, y, point('bambu', round(x), round(y), { raio: r, altura: 7 }), r * 2, round(r * 1.6));
    n++;
  }
  for (let i = 0, n = 0; i < 2000 && n < 12; i++) {
    const [x, y] = [PARK_X + 2 + erng() * (ROAD_GUARA.x0 - PARK_X - 4), H0 + erng() * (H - H0 - 2)];
    const b = SPECIES.bananeira!;
    if (!eastFits(x, y, b.tronco, b.copa, b.altura, b.tronco)) continue;
    plantEast(x, y, point('arvore', round(x), round(y), { especie: 'bananeira', ...b }), b.tronco, b.tronco);
    n++;
  }
  // a beira sul da mata da estrada (mata fechada até a parede da rua)
  for (let x = PARK_X + 0.7; x < ROAD_GUARA.x0 - 1.6; x += 1.1) {
    const s = point('arbusto', round(x), H - 0.6, { raio: round(0.9 + erng() * 0.25), fechado: true });
    const b = footBox(s)!;
    // (sem vão de entalar com uma árvore perto da beira: aí o arbusto não entra e a árvore fecha o canto)
    if (eastBoxes.every((o) => boxGapOk(b, o) || (o.y1 > b.y0 - 0.01 && o.y0 < b.y1 && o.x1 > b.x0 && o.x0 < b.x1))) {
      eastBoxes.push(b);
      cenario.push(s);
    }
  }
  // o chão da mata da estrada (agora dá para andar): samambaias e capim (não bloqueiam)
  for (let i = 0, n = 0; i < 3000 && n < 70; i++) {
    const [x, y, raio] = [PARK_X + 1 + erng() * (ROAD_GUARA.x0 - PARK_X - 3), VILLAGE_S + 1 + erng() * (H - VILLAGE_S - 2), round(0.45 + erng() * 0.4)];
    if (inRect(x, y, POSTO) || distToPath(x, y, EAST_TRAIL) < 0.9 + raio) continue;
    if (!eastTrees.every((t) => dist(x, y, t.x, t.y) > t.tronco / 2 + raio * 0.6)) continue;
    cenario.push(point('planta', round(x), round(y), { tipo: erng() < 0.75 ? 'samambaia' : 'capim', raio }));
    n++;
  }
  // ----- sem vão de entalar na faixa nova do parque e na mata da estrada: o que foi sorteado e ficou num vão sai -----
  const randomPlant = (o: Shape) => (o.type === 'arvore' && !o.name && !o.props?.rompendo) || o.type === 'bambu';
  const prunedPark = pruneWedges((o) => (o.y > H0 - 3 && o.x < PARK_X + 0.3) || o.type === 'gradil', randomPlant);
  const prunedEast = pruneWedges((o) => (o.x > PARK_X - 0.3 && o.y > VILLAGE_S - 2) || o.type === 'gradil', randomPlant);
  console.log(`Floresta maior: saíram ${prunedPark} plantas da faixa nova do parque e ${prunedEast} da mata da estrada que ficavam num vão de entalar.`);

  // ---------------- a vila mais tomada pela mata: árvores novas no terreno dos fundos e na beira do campinho ----------------
  // (lugares conferidos: fora de rua, calçada, praça, campinho e trilha; longe das casas; a copa não tampa a rua, as portas
  // nem o campinho). Cada uma ganha samambaia no pé.
  const VILLAGE_TREES_2: [number, number, string][] = [
    [59.5, 17.5, 'embauba'], [85.5, 17.5, 'mata'], [69, 18, 'jeriva'], [75, 19, 'mata'], [63.5, 22.5, 'mata'], [92, 24, 'embauba'],
    [85, 25, 'jeriva'], [78, 26, 'mata'], [60.5, 28.5, 'mata'], [66.5, 29.5, 'embauba'], [83.5, 60.5, 'mata'], [63.5, 61.5, 'bananeira'], [86, 66, 'mata'],
  ];
  for (const [x, y, especie] of VILLAGE_TREES_2) {
    const d = SPECIES[especie] ?? { tronco: 0.5, copa: 2.4, altura: 6 };
    if (canopyHides(x, y, d.copa, d.altura) || hidesView(x, y, d.copa, d.altura)) throw new Error(`A árvore nova da vila em (${x}, ${y}) tampa a rua, uma porta, o campinho ou uma trilha do parque.`);
    trees.push({ x, y, tronco: d.tronco });
    cenario.push(point('arvore', x, y, { especie, ...d }));
    for (const [dx, dy] of [[0.9, 0.5], [-0.7, 0.8]] as const) cenario.push(point('planta', round(x + dx), round(y + dy), { tipo: 'samambaia', raio: 0.45 }));
  }
}

// ---------------- colisão (tirada do cenário) ----------------
// ---------------- casas com interior (pedido do dono, 13/11: "dar vida para alguns interiores de casa") ----------------
// Como a Budega: com o herói dentro, o telhado e a frente somem. A porta tem 1,2 m (mais estreita, o pé entala), as
// paredes têm 15 cm, e os móveis ficam colados (até 0,3 m) ou com 1,2 m livres. O que tem frente fica nas paredes do
// fundo (norte) e da esquerda (oeste), virado para a câmera; a frente e a direita são as paredes que somem.
if (reached('4c') && FLORESTA) {
  const house = (x0: number, y0: number) => {
    const h = cenario.find((o) => o.type === 'casa' && o.x === x0 && o.y === y0);
    if (!h) throw new Error(`Casa em (${x0}, ${y0}) não achada.`);
    return h;
  };
  /** Abre a casa: interior, o vão da porta (de portaDe a portaAte, na frente) e o piso de dentro. */
  const open = (h: Shape, door: [number, number], piso: string, morador: string) => {
    h.props = { ...h.props, interior: true, portaDe: door[0], portaAte: door[1], morador };
    const t = BUDEGA_WALL;
    chao.push(rect('piso', h.x + t, h.x + h.w! - t, h.y + t, h.y + h.h! - t, { desenho: piso }));
  };

  // ----- a casa amarela (a das cadeiras na calçada): uma família vive aqui. A cozinha no fundo, a sala na frente -----
  const amarela = house(81, 32);
  open(amarela, [81.75, 82.95], 'ceramica', 'familia');
  cenario.push(rect('pia', 81.15, 82.35, 32.15, 32.75, { altura: 0.9, olhando: 90 }));
  cenario.push(rect('fogao', 82.45, 83.2, 32.15, 32.8, { altura: 0.9, olhando: 90, panela: true }));
  cenario.push(rect('filtro', 83.3, 83.8, 32.15, 32.6, { altura: 1.2 })); // o filtro de barro, num banquinho
  cenario.push(rect('geladeira', 85.15, 85.85, 32.15, 32.85, { altura: 1.7, olhando: 90 }));
  cenario.push(rect('mesa-cozinha', 82.4, 83.4, 34.05, 35.35, { altura: 0.8, cadeiras: 2, toalha: 'xadrez' }));
  // a TV de tubo na estante, de frente para o sofá (e para a câmera); o tapete no meio
  cenario.push(rect('estante', 83.6, 85.6, 36, 36.4, { altura: 1.4, olhando: 90, tv: true }));
  chao.push(rect('tapete', 83.8, 85.4, 36.7, 38.3, { cor: '#b5503c' }));
  cenario.push(rect('sofa', 83.4, 85.85, 38.5, 39.35, { altura: 0.9, olhando: 270, cor: '#7c5a3a' }));

  // ----- a casa rosa (a da figueira na frente): a casa da vó -----
  const rosa = house(64, 33);
  open(rosa, [65, 66.2], 'taco', 'vo');
  cenario.push(rect('cristaleira', 64.4, 65.8, 33.15, 33.6, { altura: 1.9, olhando: 90 }));
  cenario.push(rect('sofa', 64.15, 65, 35.6, 37.4, { altura: 0.9, olhando: 0, cor: '#6f8f5a', croche: true }));
  // o Joaquim, o gato da vó (pedido do dono, 13/11), tem vida própria (a [estrutura], em data/bichos.json): aqui ficam
  // onde ele dorme (em cima do sofá; ele pula para subir e descer) e o chão por onde anda (o lado de dentro da casa da vó;
  // ele desvia dos móveis pelas colisões e não sai pela porta)
  pontos.push(point('ponto', 64.6, 36.4, undefined, 'joaquim'));
  pontos.push(rect('area', BUDEGA_WALL + 64, 71 - BUDEGA_WALL, 33 + BUDEGA_WALL, 39.5 - BUDEGA_WALL, undefined, 'joaquim-casa'));
  cenario.push(rect('mesa-redonda', 66.5, 67.3, 34.8, 35.6, { altura: 0.75, cadeiras: 2, toalha: 'croche' }));
  cenario.push(rect('maquina-costura', 68.25, 69.25, 33.15, 33.65, { altura: 0.8, olhando: 90 }));
  // a cama com a cabeceira na parede do fundo (norte) e os pés para a sala (o dono achou a de antes invertida: a cabeceira
  // ficava no meio do quarto); `olhando` 90 = os pés para o sul
  cenario.push(rect('cama', 69.45, 70.85, 33.15, 35.15, { altura: 0.6, colcha: 'retalhos', olhando: 90 }));
  cenario.push(point('vaso', 64.4, 39.1, { planta: 'espada-de-sao-jorge' }));
  cenario.push(point('vaso', 70.6, 39.1, { planta: 'samambaia' }));

  // ----- a casa abandonada do fundo: a árvore nasceu lá dentro e saiu pelo telhado; o mato entrou junto -----
  const abandonada = house(62, 13);
  open(abandonada, [62.75, 63.95], 'cimento', 'ninguem');
  // (no meio da casa: é onde o desenho da [arte] põe o buraco da laje e o tronco subindo)
  cenario.push(point('arvore', 64.5, 16.5, { especie: 'mata', copa: 3, altura: 7.5, tronco: 0.8, dentroDaCasa: true }));
  cenario.push(rect('sofa', 62.15, 63, 13.15, 14.95, { altura: 0.9, olhando: 0, cor: '#6b5a4a', rasgado: true, mato: true }));
  chao.push(rect('colchao', 62.4, 63.6, 16.2, 18.2, { velho: true }));
  chao.push(point('entulho', 65.9, 17.9, { cadeiraCaida: true }));
  for (const [cx, cy, rx, ry] of [[63, 16.5, 0.7, 0.9], [66.2, 18.9, 0.6, 0.5], [65.6, 13.8, 0.8, 0.5]] as const) {
    chao.push({ type: 'grama', x: 0, y: 0, polygon: blob(cx, cy, rx, ry, 0.25) });
  }

  // ----- a floresta também dentro de casa (pedido do dono, 14/11: "o interior deve ter partes da floresta também, como
  // o mapa em geral"): raiz levantando o piso, mato nas frestas, samambaia nos cantos e cipó nas paredes de dentro
  // (`cipoDentro`, de 0 a 1, desenhado pela [arte]). Nada disso segura o pé: o caminho de dentro continua livre -----
  const budega = cenario.find((o) => o.type === 'casa' && o.name === 'Budega')!;
  const inside: [Shape, number, boolean][] = [[budega, 0.7, true], [amarela, 0.35, false], [rosa, 0.3, false], [abandonada, 0.9, true]];
  for (const [h, cipo, musgo] of inside) h.props = { ...h.props, cipoDentro: cipo, ...(musgo ? { musgoDentro: true } : {}) };
  const ROOTS_INSIDE: [number, number][][] = [
    // a Budega maior: uma raiz sai de baixo da prateleira da esquerda e outra entra por baixo da frente, do lado da porta
    [[61.05, 52.9], [61.45, 52.5], [61.95, 52.35], [62.3, 52.0]],
    [[65.15, 54.2], [65.6, 53.55], [66.4, 53.25], [66.85, 53.4]],
    // (a infestação, 15/11) mais três: pela parede da direita, do lado da porta; pela parede de grama, atrás do caixa; e
    // por baixo da prateleira do fundo, na frente da geladeira
    [[68.3, 52.9], [67.8, 52.6], [67.1, 52.75], [66.6, 52.5]],
    [[67.6, 49.45], [67.3, 49.9], [66.8, 50.1]],
    [[62.4, 49.45], [62.75, 49.85], [63.35, 50.05], [63.8, 50.35]],
    [[85.85, 37.1], [85.1, 37.45], [84.3, 37.35]], // a família: levanta a cerâmica perto do sofá
    [[70.85, 36.3], [70.15, 36.6], [69.4, 36.4]], // a vó: levanta o taco perto da cama
    [[62.15, 18.6], [62.9, 18.3], [63.4, 18.6]], // a abandonada: mais raiz entrando pelas paredes
    [[66.85, 14.2], [66.1, 14.6], [65.6, 14.4]],
  ];
  for (const pts of ROOTS_INSIDE) chao.push({ type: 'raiz', x: 0, y: 0, polyline: pts, props: { largura: 0.22, altura: 0.12, cor: '#6b4a2e', dentro: true } });
  // mato nas frestas do piso (perto das portas e dos cantos) e samambaia nos cantos
  for (const [x, y] of [[61.25, 53.4], [64.5, 49.65], [67.75, 53.95], [64.35, 53.35], [68.1, 52.2], [64.55, 51.6], [65.3, 52.7], [82.2, 38.95], [65.25, 38.95], [62.6, 19.4], [65.9, 19.5], [66.5, 16.2]] as const) chao.push(point('planta', x, y, { tipo: 'capim', raio: 0.22 }));
  for (const [x, y, raio] of [[61.7, 49.85, 0.35], [68.05, 53.9, 0.3], [85.5, 33.3, 0.35], [64.5, 34.6, 0.35], [66.3, 13.7, 0.45], [62.6, 15.6, 0.4]] as const) cenario.push(point('planta', x, y, { tipo: 'samambaia', raio, dentro: true }));
}

// ----- os galhos dos saguis (23/11, pedido da [arte] com o ok do dono, "a opção 3") -----
// O Sagui Encantado fica pendurado pelo rabo num galho baixo enquanto está calmo e joga a fruta lá de cima; quando o
// herói chega perto ou acerta nele, pula para o chão. O ponto (`galho-sagui`, camada `pontos`, lido pela [estrutura]) é
// o chão embaixo do meio do galho (o pé do sagui, andável), com a `altura` do galho (m) e a `direcao` (graus, do tronco
// para a ponta: 0 = leste, 90 = sul). As direções viram para a câmera (o sagui fica na frente do tronco, e o galho, atrás
// dele). Duas árvores da mata perto da trilha (a seca e uma de copa alta) e três árvores secas novas.
/** As árvores novas: [onde a gente queria, a direção do galho]; vão para o lugar mais perto que cabe, não tampa trilha e
 * deixa o sagui à vista. */
const SAGUI_TREES: [number, number, number][] = [[34, 17.5, 10], [42.5, 14, 100], [38.5, 8.5, 100]];
/** [x e y do tronco, a direção do galho em graus, a altura do galho em m] (as árvores que já existiam) */
const SAGUI_PERCHES: [number, number, number, number][] = [
  [34.4, 8.1, 100, 2.3], // a árvore seca (sem folha: o sagui aparece inteiro)
  [45.6, 17.8, 110, 2.3], // (a copa dela é alta: começa a uns 3,5 m)
];
const PERCH_R = 1;
const perchPoints: { x: number; y: number }[] = [];
/** A copa de outra árvore (com folha) esconde, na tela, o sagui pendurado em (x, y)? (a câmera olha do sudeste) */
const sagHidden = (x: number, y: number, own: { x: number; y: number }) =>
  cenario.some((o) => {
    if (o.type !== 'arvore' || (o.x === own.x && o.y === own.y) || o.props?.especie === 'seca' || x + y >= o.x + o.y) return false;
    const copa = Number(o.props?.copa ?? 2.5), altura = Number(o.props?.altura ?? 5);
    return [0.6, 0.85].some((k) => {
      const [cx, cy] = screen(o.x, o.y, altura * k);
      return [1.3, 2].some((kz) => {
        const [sx, sy] = screen(x, y, kz);
        return Math.hypot(sx - cx, sy - cy) < copa * 1.05;
      });
    });
  });
/** O chão embaixo do galho é livre (longe de tronco, moita e água)? */
const perchFree = (x: number, y: number, own: { x: number; y: number }) =>
  inRect(x, y, SAGUI_ZONE) && free(x, y, 0.35) && waterGap(x, y) > 0.5 &&
  trees.every((t) => (t.x === own.x && t.y === own.y) || dist(x, y, t.x, t.y) > t.tronco / 2 + 0.72) &&
  clumps.every((c) => dist(x, y, c.x, c.y) > c.r + 0.4);
/** A direção pedida ou a mais perto dela (sempre virada para a câmera) em que o chão é livre e o sagui fica à vista. */
function bestPerch(own: { x: number; y: number }, want: number): [number, number, number] | null {
  for (const dd of [0, -25, 25, -50, 50, -75, 75, -100, 100]) {
    const direcao = (((want + dd) % 360) + 360) % 360;
    const a = (direcao * Math.PI) / 180;
    if (Math.cos(a) + Math.sin(a) < 0.2) continue;
    // (o galho pode ser um pouco mais comprido, até 1,3 m, se perto do tronco não couber)
    for (const R of [PERCH_R, PERCH_R + 0.15, PERCH_R + 0.3]) {
      const [x, y] = [round(own.x + Math.cos(a) * R), round(own.y + Math.sin(a) * R)];
      if (perchFree(x, y, own) && !sagHidden(x, y, own)) return [x, y, direcao];
    }
  }
  return null;
}
const addPerch = (p: [number, number, number], altura: number) => {
  perchPoints.push({ x: p[0], y: p[1] });
  pontos.push(point('galho-sagui', p[0], p[1], { altura, direcao: p[2] }));
};
for (const [tx, ty, want, altura] of SAGUI_PERCHES) {
  const tree = cenario.filter((o) => o.type === 'arvore' && dist(o.x, o.y, tx, ty) < 0.5).sort((a, b) => dist(a.x, a.y, tx, ty) - dist(b.x, b.y, tx, ty))[0];
  if (!tree) throw new Error(`Não achei a árvore do sagui perto de (${tx}, ${ty}).`);
  const p = bestPerch(tree, want);
  if (!p) throw new Error(`O galho do sagui da árvore em (${tree.x}, ${tree.y}) não tem direção em que ele fique à vista.`);
  addPerch(p, altura);
}
for (const [tx, ty, want] of SAGUI_TREES) {
  // (árvore seca, como a outra: sem folha, o sagui aparece inteiro, e os galhos pelados não tampam a trilha na tela)
  const d = { tronco: 0.4, copa: 1.4, altura: 6.2 };
  let done = false;
  for (let r = 0; r <= 4 && !done; r += 0.5) {
    const n = Math.max(1, Math.round(r * 8));
    for (let k = 0; k < n && !done; k++) {
      const a = (k / n) * Math.PI * 2;
      const [x, y] = [round(tx + Math.cos(a) * r), round(ty + Math.sin(a) * r)];
      if (!inRect(x, y, SAGUI_ZONE) || !plantFits(x, y, d.tronco, d.copa, 1.25) || hidesView(x, y, d.copa, d.altura)) continue;
      const p = bestPerch({ x, y }, want);
      if (!p) continue;
      trees.push({ x, y, tronco: d.tronco });
      cenario.push(point('arvore', x, y, { especie: 'seca', ...d }));
      addPerch(p, 2.3);
      done = true;
    }
  }
  if (!done) throw new Error(`A árvore do sagui perto de (${tx}, ${ty}) não cabe.`);
}

for (const s of cenario) {
  const p = s.props ?? {};
  if (s.type === 'arvore') colisao.push(block('tronco', s.x, s.y, Number(p.tronco)));
  else if (s.type === 'poste') colisao.push(block('poste', s.x, s.y, 0.3));
  else if (s.type === 'pedra') colisao.push(block('pedra', s.x, s.y, round(Number(p.raio) * 1.5)));
  // (a moita é redonda: o quadrado de 1,8 × o raio passava ~30 cm das folhas nas pontas e travava o pé no nada — o fim
  // da calçada da rua leste do Capão, print do dono em 19/11, pela [estrutura]. Agora é um octógono de três caixas:
  // a mesma largura de antes para os quatro lados e as quinas na beira das folhas)
  else if (s.type === 'arbusto' && p.fechado) {
    const bush = { x: s.x, y: s.y, r: Number(p.raio), boxes: bushBoxes(s.x, s.y, Number(p.raio)) };
    for (const c of bush.boxes) BUSH_OF.set(c, bush);
    colisao.push(...bush.boxes);
  }
  else if (s.type === 'bambu') colisao.push(block('bambu', s.x, s.y, round(Number(p.raio) * 1.6)));
  else if (s.type === 'gradil' || (s.type === 'portao' && !p.aberto)) colisao.push({ ...rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!), props: { bloqueiaTiro: false } });
  else if (s.type === 'pilar' || s.type === 'tronco-caido') colisao.push(rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!));
  // a vila: casa e carro seguram a pedrinha; o que é baixo ou fino (banco, mesa, fogueira, lixeira, orelhão) deixa passar.
  // A altura vai junto, para o desenho provisório levantar a caixa certa.
  else if (s.type === 'casa' && p.interior) {
    // a casa que tem interior: só as paredes, com o vão da porta na frente. Na vendinha (a Budega) a porta de enrolar
    // é a frente toda, menos 34 cm de cada ponta, e a parede do fundo vai até a frente das prateleiras; na casa, o vão
    // vai de portaDe a portaAte
    const [x0, x1, y0, y1, t, altura] = [s.x, s.x + s.w!, s.y, s.y + s.h!, BUDEGA_WALL, Number(p.altura)];
    const [d0, d1] = p.portaDe !== undefined ? [Number(p.portaDe), Number(p.portaAte)] : [x0 + BUDEGA_DOOR_SIDE, x1 - BUDEGA_DOOR_SIDE];
    colisao.push(rect('parede', x0, x1, y0, y0 + t + (p.comercio ? BUDEGA_SHELF : 0), { altura })); // fundo
    colisao.push(rect('parede', x0, x0 + t, y0, y1, { altura })); // esquerda
    colisao.push(rect('parede', x1 - t, x1, y0, y1, { altura })); // direita
    colisao.push(rect('parede', x0, d0, y1 - t, y1, { altura })); // a frente, dos dois lados da porta
    colisao.push(rect('parede', d1, x1, y1 - t, y1, { altura }));
  } else if (s.type === 'casa' || s.type === 'carro') colisao.push(rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!, { altura: Number(p.altura) }));
  // os móveis da Budega: a geladeira segura a pedrinha; o balcão e os engradados são baixos (as prateleiras já estão
  // na parede do fundo)
  else if (s.type === 'geladeira') colisao.push(rect('geladeira', s.x, s.x + s.w!, s.y, s.y + s.h!, { altura: Number(p.altura) }));
  // a Budega maior: a prateleira e a vitrine seguram a pedrinha; o balcão de vidro, o freezer, os caixotes e a lousa são
  // baixos (a pedrinha passa); a parede de grama é só o desenho da parede do fundo; o degrau é chão
  else if (s.type === 'prateleira' || s.type === 'vitrine') colisao.push(rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!, { altura: Number(p.altura) }));
  else if (s.type === 'balcao-vidro' || s.type === 'freezer' || s.type === 'caixote') {
    colisao.push(rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!, { bloqueiaTiro: false, altura: Number(p.altura) }));
  } else if (s.type === 'lousa') colisao.push(block('lousa', s.x, s.y, 0.45, { bloqueiaTiro: false, altura: 1.2 }));
  // os móveis das casas: o que é alto (estante com TV, cristaleira, filtro) segura a pedrinha; o que é baixo, não
  else if (['pia', 'fogao', 'filtro', 'mesa-cozinha', 'mesa-redonda', 'sofa', 'estante', 'cristaleira', 'maquina-costura', 'cama'].includes(s.type)) {
    colisao.push(rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!, { bloqueiaTiro: Number(p.altura) >= 1.2, altura: Number(p.altura) }));
  }
  else if (s.type === 'balcao') colisao.push(rect('balcao', s.x, s.x + s.w!, s.y, s.y + s.h!, { bloqueiaTiro: false, altura: Number(p.altura) }));
  else if (s.type === 'engradado') colisao.push(rect('engradado', s.x, s.x + s.w!, s.y, s.y + s.h!, { bloqueiaTiro: false, altura: round(0.3 * Number(p.pilha)) }));
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
  // o padrão novo: o prédio segura tudo; moto, placa de rua, cadeira, vaso e lixo são baixos ou finos (a pedrinha passa)
  else if (s.type === 'predio') colisao.push(rect('predio', s.x, s.x + s.w!, s.y, s.y + s.h!, { altura: Number(p.altura) }));
  else if (s.type === 'moto' || s.type === 'lixo') colisao.push(rect(s.type, s.x, s.x + s.w!, s.y, s.y + s.h!, { bloqueiaTiro: false, altura: Number(p.altura) }));
  else if (s.type === 'placa-rua') colisao.push(block('placa-rua', s.x, s.y, 0.2, { bloqueiaTiro: false, altura: 2.6 }));
  else if (s.type === 'semaforo') colisao.push(block('semaforo', s.x, s.y, 0.25, { bloqueiaTiro: false, altura: Number(p.altura) }));
  else if (s.type === 'cadeira') colisao.push(block('cadeira', s.x, s.y, 0.5, { bloqueiaTiro: false, altura: 0.8 }));
  // o parque antigo: a academia ao ar livre e o bebedouro são baixos (a pedrinha passa)
  else if (s.type === 'academia') colisao.push(rect('academia', s.x, s.x + s.w!, s.y, s.y + s.h!, { bloqueiaTiro: false, altura: Number(p.altura) }));
  else if (s.type === 'bebedouro') colisao.push(block('bebedouro', s.x, s.y, 0.5, { bloqueiaTiro: false, altura: 1 }));
  else if (s.type === 'vaso') colisao.push(block('vaso', s.x, s.y, 0.5, { bloqueiaTiro: false, altura: 0.6 }));
  // a floresta maior: a cobertura do posto (só os pilares), as bombas, a pilha de pneus, o parquinho (do balanço, só os
  // pés de ferro) e as pedras da cachoeirinha. As pedras de atravessar o riacho são como a pinguela: dá para andar em cima
  else if (s.type === 'cobertura') for (const b of boxesOf(s)) colisao.push(rect('pilar-cobertura', b.x0, b.x1, b.y0, b.y1, { bloqueiaTiro: false, altura: Number(p.altura) }));
  else if (s.type === 'bomba') colisao.push(rect('bomba', s.x, s.x + s.w!, s.y, s.y + s.h!, { altura: Number(p.altura) }));
  else if (s.type === 'pneus') colisao.push(block('pneus', s.x, s.y, round(Number(p.raio) * 1.8), { bloqueiaTiro: false, altura: 0.9 }));
  else if (s.type === 'parquinho') {
    for (const b of boxesOf(s)) colisao.push(rect('parquinho', b.x0, b.x1, b.y0, b.y1, { bloqueiaTiro: false, altura: Number(p.altura) }));
  } else if (s.type === 'cachoeira') colisao.push(rect('cachoeira', s.x, s.x + s.w!, s.y, s.y + s.h!, { altura: Number(p.altura) }));
}
// o chão embaixo de cada galho dos saguis é andável (o servidor põe o pé do sagui ali)
for (const q of perchPoints) {
  const hit = colisao.find((c) => q.x + 0.35 > c.x && q.x - 0.35 < c.x + c.w! && q.y + 0.35 > c.y && q.y - 0.35 < c.y + c.h!);
  if (hit) throw new Error(`O chão embaixo do galho do sagui em (${q.x}, ${q.y}) não é andável: bate em ${hit.type}.`);
}
// a Xiovanna cabe atrás do balcão da Budega (a caixa do pé dela, 0,6 × 0,4 m, com o pé no meio da beirada de baixo)
if (reached('4b') && FLORESTA) {
  const [x0, x1, y0, y1] = [XIOVANNA.x - 0.3, XIOVANNA.x + 0.3, XIOVANNA.y - 0.4, XIOVANNA.y];
  const hit = colisao.find((c) => x0 < c.x + c.w! && x1 > c.x && y0 < c.y + c.h! && y1 > c.y);
  if (hit) throw new Error(`A Xiovanna não cabe atrás do balcão: bate em ${hit.type} (${hit.x}, ${hit.y}).`);
}
/**
 * Outra coisa sólida fecha o vão entre a e b de ponta a ponta (a parede de uma casa, com um dentro e o outro fora; o
 * fogão entre a pia e o filtro)? Aí o vão vira dois, e cada um é conferido no seu par.
 */
function blockedBetween(a: Shape, b: Shape, all: Shape[]): boolean {
  const [ax1, ay1, bx1, by1] = [a.x + a.w!, a.y + a.h!, b.x + b.w!, b.y + b.h!];
  const inX = ax1 <= b.x || bx1 <= a.x; // separados no x (de frente um para o outro na horizontal)
  // o vão: no eixo em que estão separados, de uma beirada à outra; no outro, a parte em comum
  const [gx0, gx1] = ax1 <= b.x ? [ax1, b.x] : bx1 <= a.x ? [bx1, a.x] : [Math.max(a.x, b.x), Math.min(ax1, bx1)];
  const [gy0, gy1] = ay1 <= b.y ? [ay1, b.y] : by1 <= a.y ? [by1, a.y] : [Math.max(a.y, b.y), Math.min(ay1, by1)];
  const e = 1e-6;
  return all.some((c) => {
    if (c === a || c === b) return false;
    const [cx1, cy1] = [c.x + c.w!, c.y + c.h!];
    return inX ? c.x < gx1 && cx1 > gx0 && c.y <= gy0 + e && cy1 >= gy1 - e : c.y < gy1 && cy1 > gy0 && c.x <= gx0 + e && cx1 >= gx1 - e;
  });
}
// a moita em octógono que abre, com o que está encostado nela, um vão de entalar (a quina do quadrado de antes fechava o
// vão): volta a ser o quadrado de 1,8 × o raio, só ela (são poucas; o resto fica sem a ponta que travava o pé no nada).
// Vale a regra de cada lugar: na vila, qualquer vão de 0,3 a MIN_GAP que nada fecha; no resto, se cabe o pé lá dentro
{
  const inVillage = (c: Shape) => reached('4b') && c.x + c.w! > PARK_X + 0.5 && c.y < VILLAGE_S;
  const boxOf = (c: Shape): Box => ({ x0: c.x, x1: c.x + c.w!, y0: c.y, y1: c.y + c.h! });
  const CELL = 2;
  for (let pass = 0; pass < 12; pass++) {
    const list = colisao.filter((c) => c.type !== 'agua');
    const boxes = list.map(boxOf);
    const village = list.filter(inVillage);
    const grid = new Map<string, number[]>();
    boxes.forEach((b, i) => {
      for (let gx = Math.floor(b.x0 / CELL); gx <= Math.floor(b.x1 / CELL); gx++) {
        for (let gy = Math.floor(b.y0 / CELL); gy <= Math.floor(b.y1 / CELL); gy++) {
          const k = gx + ',' + gy;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k)!.push(i);
        }
      }
    });
    const back = new Set<{ x: number; y: number; r: number; boxes: Shape[] }>();
    list.forEach((a, i) => {
      const bushA = BUSH_OF.get(a);
      const A = boxes[i]!;
      const near = new Set<number>();
      for (let gx = Math.floor((A.x0 - MIN_GAP) / CELL); gx <= Math.floor((A.x1 + MIN_GAP) / CELL); gx++) {
        for (let gy = Math.floor((A.y0 - MIN_GAP) / CELL); gy <= Math.floor((A.y1 + MIN_GAP) / CELL); gy++) for (const j of grid.get(gx + ',' + gy) || []) if (j > i) near.add(j);
      }
      for (const j of near) {
        const b = list[j]!;
        const bush = bushA || BUSH_OF.get(b);
        if (!bush || back.has(bush) || (a.type === 'mata-fechada' && b.type === 'mata-fechada')) continue;
        const B = boxes[j]!;
        const [dx, dy] = [Math.max(0, B.x0 - A.x1, A.x0 - B.x1), Math.max(0, B.y0 - A.y1, A.y0 - B.y1)];
        if (dx > 0 && dy > 0) continue;
        const gap = dx + dy;
        if (gap <= 0.3 || gap >= MIN_GAP) continue;
        const bad = inVillage(a) && inVillage(b) ? !blockedBetween(a, b, village) : pocketOpen(A, B, boxes);
        if (bad) back.add(bush);
      }
    });
    if (!back.size) break;
    for (const bush of back) {
      for (const c of bush.boxes) colisao.splice(colisao.indexOf(c), 1);
      const square = block('mata-fechada', bush.x, bush.y, round(bush.r * 1.8));
      bush.boxes = [square];
      BUSH_OF.set(square, bush);
      colisao.push(square);
    }
  }
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
      if (gap > 0.3 && gap < MIN_GAP && blockedBetween(a, b, village)) continue; // uma parede ou um móvel no meio
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
if (FLORESTA_MAIOR) {
  // os lugares da floresta maior (o som de cada um sai do nome; a cachoeirinha diz que é água)
  areas.push(rect('area', PAINEIRA_C.x - PAINEIRA_C.r - 2, PAINEIRA_C.x + PAINEIRA_C.r + 2, PAINEIRA_C.y - PAINEIRA_C.r - 2, PAINEIRA_C.y + PAINEIRA_C.r + 2, { escuro: 0.1, neblina: 0.05 }, 'Clareira da Paineira'));
  areas.push(rect('area', POOL.x - POOL.rx - 2.5, POOL.x + POOL.rx + 2.5, POOL.y - POOL.ry - 4, POOL.y + POOL.ry + 2, { escuro: 0.2, neblina: 0.3, som: 'agua' }, 'Cachoeirinha'));
  const d = DEEP_SOUTH;
  areas.push(rect('area', Math.max(0, d.x - d.rx), d.x + d.rx, d.y - d.ry, Math.min(H, d.y + d.ry), { escuro: 0.5, neblina: 0.45 }, 'Mata Profunda'));
  areas.push(rect('area', PARK_X, ROAD_GUARA.x0, VILLAGE_S, H, { escuro: 0.25, neblina: 0.1 }, 'Mata da Estrada'));
  areas.push(rect('area', POSTO.x0, POSTO.x1, POSTO.y0, POSTO.y1, { escuro: 0.1, neblina: 0.05 }, 'Posto Abandonado'));
  areas.push(rect('area', ROAD_GUARA.x0, W, VILLAGE_S, H, { escuro: 0.15, neblina: 0.05 }, 'Estrada para Guarapiranga'));
}
pontos.push(point('ponto', C.x, C.y, undefined, 'spawn'));
// as capivaras andando (pedido do dono, 14/11; o formato é da [estrutura]): por bando, o retângulo onde andam
// (`capivaras-<lugar>`) e o ponto onde deitam (`capivaras-<lugar>-descanso`); quantas são fica em data/bichos.json
{
  const xs = LAKE_CAPYS.map(([x]) => x);
  const ys = LAKE_CAPYS.map(([, y]) => y);
  pontos.push(rect('area', round(Math.max(2, Math.min(...xs) - 3)), round(Math.max(...xs) + 2), round(Math.min(...ys) - 3), round(Math.max(...ys) + 3), undefined, 'capivaras-lago'));
  const [mx, my] = LAKE_CAPYS[Math.floor(LAKE_CAPYS.length / 2)]!;
  pontos.push(point('ponto', mx, my, undefined, 'capivaras-lago-descanso'));
  if (reached('4c')) {
    pontos.push(rect('area', FIELD.x0 + 1, FIELD.x1 - 1, FIELD.y0 + 1, FIELD.y1 - 1, undefined, 'capivaras-campinho'));
    pontos.push(point('ponto', 73.3, 71.4, undefined, 'capivaras-campinho-descanso'));
  }
}
/** Áreas de criaturas (camada "monstros"): o nome é o id em data/monsters.json; os saguis são os "encantados". */
const monstros: Shape[] = [];
// (16/11, pedido do dono: "bastante mesmo na floresta": de 18 para 40 bichos, os números combinados com a [estrutura])
if (CREATURES) {
  monstros.push(rect('area', SAGUI_ZONE.x0, SAGUI_ZONE.x1, SAGUI_ZONE.y0, SAGUI_ZONE.y1, { quantidade: 8 }, 'sagui'));
  monstros.push(rect('area', JARARACA_ZONE.x0, JARARACA_ZONE.x1, JARARACA_ZONE.y0, JARARACA_ZONE.y1, { quantidade: 6 }, 'jararaca'));
  if (FLORESTA_MAIOR) {
    // os bichos novos da floresta maior (escolhidos pelo dono em 14/11; regras e dados da [estrutura]): o bando de quatis
    // na mata do meio do parque, os tatus-bola e os marimbondos na mata da estrada, e o filhote de boitatá sozinho no
    // recanto do Véu da mata profunda do sul (só de noite: de dia a área fica vazia)
    const z = NEW_ZONES;
    for (const [zone, quantidade, nome] of [[z.meio, 10, 'quati'], [z.estradaNorte, 8, 'tatu_bola'], [z.estradaSul, 6, 'marimbondo'], [z.chefe, 2, 'filhote_boitata']] as const) {
      monstros.push(rect('area', zone.x0, zone.x1, zone.y0, zone.y1, { quantidade }, nome));
    }
  }
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
  ...(saidas.length > 0 ? ([['saidas', saidas]] as [string, Shape[]][]) : []),
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
// o mapa visto de cima, para a janela do mapa (tecla M) e o mini mapa: <id>-mapa.png e <id>-mapa.json ao lado do .tmj
const mapImage = writeMapImage(OUT);
const count = (type: string) => cenario.filter((s) => s.type === type).length;
console.log(
  `Mapa gerado em ${path.relative(process.cwd(), OUT)}: ${W}x${H} m, ${count('arvore')} árvores, ${count('arbusto')} arbustos da mata fechada, ${colisao.length} retângulos de colisão.`,
);
console.log(`Mapa visto de cima (tecla M): ${path.relative(process.cwd(), mapImage.png)} e ${path.basename(mapImage.json)}.`);
