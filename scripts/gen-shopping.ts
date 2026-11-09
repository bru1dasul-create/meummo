// Gera o mapa do Shopping do Largo Treze em public/assets/maps/shopping-largo-treze.tmj.
//
// O shopping do lado do largo de Santo Amaro, anos depois do fim. A claraboia do átrio caiu e a mata entrou: dois
// ipês e uma árvore grande cresceram no jardim do meio, a chuva enche o chafariz e o sol entra pelo buraco (é o
// único lugar claro). Em volta, corredores escuros com lojas de porta de aço, vitrines quebradas (com os manequins lá
// dentro) e quiosques; ao norte, o supermercado (gôndolas, carrinhos e caixas), o cinema (poltronas e a tela rasgada)
// e a praça de alimentação (mesas e lanchonetes, e um acampamento com tambor de fogo). Entra-se pelas portas de vidro
// do sul, que dão para a avenida de Santo Amaro. Criaturas (as que já existem): Corpo-Seco no supermercado e na ala
// leste, Capelobo no cinema e na ala oeste e o Saci na praça de alimentação.
//
// A planta (paredes, lojas e frentes) sai das constantes abaixo; o resto (piso gasto, entulho, carrinhos, mesas
// viradas) é sorteado, sempre sem fechar caminho. Como os outros geradores, este script NÃO sobrescreve um mapa
// existente sem --force (para comparar: npm run gen:shopping -- --out outro.tmj)

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GameMap, type TiledMap } from '../src/shared/map';
import { findPath } from '../src/shared/pathfind';
import { MapBuilder, type AreaObject } from './map-builder';
import { shuffled, type BigTree } from './map-depth';
import { gid, TILES } from './tileset';

const outIndex = process.argv.indexOf('--out');
const OUT = path.resolve(outIndex !== -1 && process.argv[outIndex + 1] ? process.argv[outIndex + 1]! : 'public/assets/maps/shopping-largo-treze.tmj');
if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`O mapa ${path.relative(process.cwd(), OUT)} já existe (e pode ter edições feitas no Tiled).`);
  console.error('Para gerar de novo e PERDER essas edições, rode: npm run gen:shopping -- --force');
  process.exit(1);
}

const W = 64;
const H = 44;
const ZONE_NAME = 'Shopping do Largo Treze';
/** As portas de vidro do sul (a saída para Santo Amaro) e onde aparece quem chega. */
const ENTRANCE = { x: 30, y: H - 1, w: 4, h: 1 };
const ARRIVAL = { x: 31, y: H - 3 };
/** Os três corredores de ponta a ponta (linha de cima e de baixo). */
const CORRIDORS = [
  [14, 17],
  [26, 30],
  [39, 42],
] as const;
/** O átrio: o vão do meio, embaixo da claraboia que caiu (o jardim, o chafariz e as escadas rolantes). */
const ATRIUM = { x0: 24, x1: 39, y0: 18, y1: 38 };
const SKYLIGHT = { x: 31.5, y: 27, r: 7.5 };
const GARDEN = { x: 31.5, y: 25, rx: 4.6, ry: 3.6 };
/** No norte: o supermercado, o cinema (a tela fica na parede de cima) e a praça de alimentação. */
const SUPERMARKET = { x0: 1, x1: 20, y0: 2, y1: 11 };
const CINEMA = { x0: 22, x1: 41, y0: 3, y1: 11 };
const FOOD_COURT = { x0: 43, x1: 62, y0: 4, y1: 13 };
/** A linha do letreiro do supermercado e do cinema (a frente fica logo embaixo). */
const NORTH_SIGN_Y = 12;
/** As duas fileiras de lojas: a parede do fundo, a loja, o letreiro e a frente (de cara para o corredor de baixo). */
const BANDS = [
  { top: 18, sign: 24, front: 25 },
  { top: 31, sign: 37, front: 38 },
];
type StoreKind = 'roupas' | 'farmacia' | 'eletronicos' | 'calcados' | 'vazia';
/** As lojas de cada fileira. A frente: S = porta de aço, V = vitrine quebrada, D = entrada. */
const STORES: { x0: number; front: string; sign: 'a' | 'b' | 'c'; kind: StoreKind }[][] = [
  [
    { x0: 1, front: 'VVDDVVV', sign: 'a', kind: 'roupas' },
    { x0: 9, front: 'SSDDSSS', sign: 'c', kind: 'farmacia' },
    { x0: 17, front: 'VSDDSV', sign: 'b', kind: 'eletronicos' },
    { x0: 41, front: 'SSDDSS', sign: 'a', kind: 'vazia' },
    { x0: 48, front: 'VVVDDVV', sign: 'b', kind: 'roupas' },
    { x0: 56, front: 'SSDDVVV', sign: 'c', kind: 'calcados' },
  ],
  [
    { x0: 1, front: 'SVDDVSS', sign: 'b', kind: 'eletronicos' },
    { x0: 9, front: 'VVVDDVV', sign: 'a', kind: 'roupas' },
    { x0: 17, front: 'SSDDSS', sign: 'c', kind: 'farmacia' },
    { x0: 41, front: 'VVDDVV', sign: 'c', kind: 'roupas' },
    { x0: 48, front: 'SSSDDSS', sign: 'a', kind: 'vazia' },
    { x0: 56, front: 'VSDDSSV', sign: 'b', kind: 'eletronicos' },
  ],
];

const m = new MapBuilder(W, H, 20261213);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// 1. A planta: tudo começa parede (#) e o gerador "escava" corredores, átrio, lojas e salões.
//    . piso do shopping, m piso do supermercado, c carpete do cinema, E portas de vidro (a saída)
//    = letreiro (camada "acima"; embaixo bloqueia, menos em cima das entradas), e a frente embaixo dele:
//    | pilar, S porta de aço, V vitrine, G vitrine do supermercado, D entrada, P/Q cartazes do cinema;
//    W tela do cinema; M/K lanchonete (cardápio e balcão)
const plan: string[][] = Array.from({ length: H }, () => new Array<string>(W).fill('#'));
const signAt = new Map<number, string>();
const carve = (x0: number, y0: number, x1: number, y1: number, ch: string) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) plan[y]![x] = ch;
};
/** A frente de uma loja (ou do supermercado, ou do cinema): o letreiro em `signY` e a frente logo embaixo. */
const storefront = (x0: number, signY: number, front: string, sign: string) => {
  [...front].forEach((ch, i) => {
    plan[signY]![x0 + i] = '=';
    signAt.set(signY * W + x0 + i, ch === '|' ? 'store_sign_none' : sign);
    plan[signY + 1]![x0 + i] = ch;
  });
};
for (const [y0, y1] of CORRIDORS) carve(1, y0, W - 2, y1, '.');
carve(ATRIUM.x0, ATRIUM.y0, ATRIUM.x1, ATRIUM.y1, '.');
carve(SUPERMARKET.x0, SUPERMARKET.y0, SUPERMARKET.x1, SUPERMARKET.y1, 'm');
storefront(SUPERMARKET.x0, NORTH_SIGN_Y, 'GGGDDGGG|GG|GGGDDGGG', 'store_sign_b');
storefront(SUPERMARKET.x1 + 1, NORTH_SIGN_Y, '|', 'store_sign_none');
carve(CINEMA.x0, 1, CINEMA.x1, 2, 'W');
carve(CINEMA.x0, CINEMA.y0, CINEMA.x1, CINEMA.y1, 'c');
storefront(CINEMA.x0, NORTH_SIGN_Y, '|PQP|QPQ|DD|PQP|QPQ|', 'store_sign_none');
for (let i = 0; i < 4; i++) signAt.set(NORTH_SIGN_Y * W + 30 + i, `cinema_sign_${i + 1}`);
storefront(CINEMA.x1 + 1, NORTH_SIGN_Y, '|', 'store_sign_none');
carve(FOOD_COURT.x0, FOOD_COURT.y0, FOOD_COURT.x1, FOOD_COURT.y1, '.');
for (const x0 of [44, 50, 56]) {
  carve(x0, 2, x0 + 4, 2, 'M'); // o cardápio
  carve(x0, 3, x0 + 4, 3, 'K'); // o balcão
}
BANDS.forEach((band, b) => {
  for (const store of STORES[b]!) {
    const x1 = store.x0 + store.front.length - 1;
    carve(store.x0, band.top + 1, x1, band.sign - 1, '.');
    storefront(store.x0, band.sign, store.front, `store_sign_${store.sign}`);
    for (const x of [store.x0 - 1, x1 + 1]) if (plan[band.sign]![x] === '#') storefront(x, band.sign, '|', 'store_sign_none');
  }
});
carve(ENTRANCE.x, ENTRANCE.y, ENTRANCE.x + ENTRANCE.w - 1, ENTRANCE.y, 'E');

// 2. Chão e paredes. Parede com chão embaixo aparece de frente (reboco, cipó ou propaganda); as outras, de cima.
const FLOOR = '.mcE';
const floorKey = (ch: string | undefined) => (ch === 'm' ? 'market_floor' : ch === 'c' ? 'cinema_carpet' : 'mall_floor');
const growth = m.noise(5);
const gardenEdge = m.noise(2);
const skyDist = (x: number, y: number) => Math.hypot(x - SKYLIGHT.x, (y - SKYLIGHT.y) * 1.1);
/** O jardim (onde o piso afundou e a terra apareceu): uma mancha de beirada torta, embaixo do buraco da claraboia. */
const inGarden = (x: number, y: number) => ((x - GARDEN.x) / GARDEN.rx) ** 2 + ((y - GARDEN.y) / GARDEN.ry) ** 2 <= 0.7 + gardenEdge(x, y) * 0.6;
const FRONT_TILES: Record<string, string> = {
  '|': 'store_pillar',
  S: 'store_shutter',
  V: 'store_window',
  G: 'market_window',
  D: 'store_door',
  P: 'cinema_poster_saci',
  Q: 'cinema_poster_mula',
  M: 'food_menu',
  K: 'food_counter',
};
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const ch = plan[y]![x]!;
    const below = plan[y + 1]?.[x];
    m.setGround(x, y, floorKey(ch === '=' ? plan[y - 1]?.[x] : ch), false);
    if (ch === '#') {
      const r = m.rng();
      const face = below !== undefined && FLOOR.includes(below);
      m.setDecor(x, y, !face ? 'mall_wall_top' : r < 0.16 ? 'mall_wall_vines' : r < 0.26 ? 'mall_wall_ad' : 'mall_wall');
    } else if (ch === '=') {
      m.depth.above[m.idx(x, y)] = gid(signAt.get(m.idx(x, y))!);
      if (below !== 'D') m.setDecor(x, y, 'mall_wall_top'); // em cima da entrada dá para passar (por baixo do letreiro)
    } else if (ch === 'W') {
      m.setDecor(x, y, m.rng() < 0.3 ? 'cinema_screen_torn' : 'cinema_screen');
    } else if (FRONT_TILES[ch]) {
      m.setDecor(x, y, FRONT_TILES[ch]!);
    } else if (ch === 'E') {
      m.setGround(x, y, 'mall_floor_sun', false); // a luz de fora entrando pelas portas
    } else if (ch === '.') {
      // o piso gasto: musgo onde a umidade chega (perto do jardim e em manchas), placas soltas, poças embaixo do buraco
      const r = m.rng();
      const d = skyDist(x, y);
      if (inGarden(x, y)) m.setGround(x, y, (x + y) % 3 ? 'grass' : 'grass_dark', false);
      else if (d < SKYLIGHT.r && r < 0.06) m.setGround(x, y, 'mall_puddle', false);
      else if (d < SKYLIGHT.r && r < 0.2) m.setGround(x, y, 'mall_floor_sun', false); // o sol entrando pelo buraco
      else if (d < SKYLIGHT.r + 1.5 || growth(x, y) > 0.74) m.setGround(x, y, r < 0.65 ? 'mall_floor_moss' : 'mall_floor', false);
      else if (r < 0.1) m.setGround(x, y, 'mall_floor_cracked', false);
    }
  }
}

// 3. Sem fechar caminho: tudo o que bloqueia só entra se todo o chão continuar alcançável a pé a partir da entrada.
const solid = new Set(TILES.flatMap((t, i) => (t.collides ? [i + 1] : [])));
const free = (x: number, y: number) => m.inside(x, y) && !solid.has(m.decor[m.idx(x, y)]!);
function countReachable(): number {
  const seen = new Uint8Array(W * H);
  const queue = [m.idx(ARRIVAL.x, ARRIVAL.y)];
  seen[queue[0]!] = 1;
  for (let i = 0; i < queue.length; i++) {
    const x = queue[i]! % W;
    const y = Math.floor(queue[i]! / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!free(x + dx, y + dy) || seen[m.idx(x + dx, y + dy)]) continue;
      seen[m.idx(x + dx, y + dy)] = 1;
      queue.push(m.idx(x + dx, y + dy));
    }
  }
  return queue.length;
}
let freeCells = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (free(x, y)) freeCells++;
let reachable = countReachable();
if (reachable !== freeCells) {
  console.error(`ERRO na planta: ${freeCells - reachable} tiles de chão sem caminho até a entrada`);
  process.exit(1);
}
/** Põe um objeto (de um ou mais tiles); se ele fechar algum caminho, desiste e devolve false. */
function place(cells: [number, number, string][]): boolean {
  for (const [x, y] of cells) if (!free(x, y) || m.hasDecor(x, y) || m.isReserved(x, y)) return false;
  for (const [x, y, key] of cells) m.setDecor(x, y, key);
  const blocking = cells.filter(([, , key]) => solid.has(gid(key))).length;
  if (blocking === 0) return true;
  const now = countReachable();
  if (now !== reachable - blocking) {
    for (const [x, y] of cells) m.setDecor(x, y, null);
    return false;
  }
  reachable = now;
  return true;
}
function plantTree(kind: BigTree, x: number, y: number): boolean {
  if (!free(x, y) || !free(x + 1, y) || m.isReserved(x, y) || m.isReserved(x + 1, y)) return false;
  if (!m.depth.plantBigTree(kind, x, y, () => true)) return false;
  const now = countReachable();
  if (now === reachable - 2) {
    reachable = now;
    return true;
  }
  m.depth.clearArea(x, y, x + 1, y);
  return false;
}
// a frente de cada entrada fica livre (do lado de fora e do lado de dentro), e a chegada também
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (plan[y]![x] !== 'D') continue;
    for (const dy of [1, -1, -2]) m.reserve(x, y + dy);
  }
}
for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) m.reserve(ARRIVAL.x + dx, ARRIVAL.y + dy);
for (const x of range(ENTRANCE.x, ENTRANCE.x + ENTRANCE.w - 1)) m.reserve(x, ENTRANCE.y - 1);
const cellsOf = (x0: number, y0: number, x1: number, y1: number) => range(y0, y1).flatMap((y) => range(x0, x1).map((x) => [x, y] as const));
const scatter = (cells: readonly (readonly [number, number])[], count: number, key: string | (() => string)) => {
  let placed = 0;
  for (const [x, y] of shuffled(cells, m.rng)) {
    if (placed >= count) break;
    if (place([[x, y, typeof key === 'string' ? key : key()]])) placed++;
  }
};

// 4. O átrio: o jardim com as árvores (embaixo do buraco da claraboia), o chafariz, as escadas rolantes e floreiras
plantTree('ipe_yellow_big', 29, 27);
plantTree('tree_big', 33, 26);
plantTree('ipe_pink_big', 31, 24);
for (const [x, y] of shuffled(cellsOf(ATRIUM.x0, ATRIUM.y0, ATRIUM.x1, ATRIUM.y1), m.rng)) {
  if (!inGarden(x, y) || m.hasDecor(x, y)) continue;
  const r = m.rng();
  if (r < 0.12) place([[x, y, 'bush']]);
  else if (r < 0.3) place([[x, y, 'tall_grass']]);
  else if (r < 0.4) place([[x, y, 'herbs']]);
  else if (r < 0.48) place([[x, y, 'flowers_yellow']]);
}
place([[31, 30, 'mall_fountain_tl'], [32, 30, 'mall_fountain_tr'], [31, 31, 'mall_fountain_bl'], [32, 31, 'mall_fountain_br']]);
for (const x of [25, 37]) place([[x, 19, 'escalator_tl'], [x + 1, 19, 'escalator_tr'], [x, 20, 'escalator_bl'], [x + 1, 20, 'escalator_br']]);
for (const [x, y] of [[24, 22], [39, 22], [24, 34], [39, 34], [28, 42], [35, 42]] as const) place([[x, y, 'planter']]);
for (const [x, y] of [[28, 33], [35, 33], [26, 29], [37, 29]] as const) place([[x, y, 'bench']]);
place([[27, 40, 'mall_directory']]);
// a beirada do jardim: o mato passando por cima do piso
for (const [x, y] of cellsOf(ATRIUM.x0, ATRIUM.y0, ATRIUM.x1, ATRIUM.y1)) {
  if (inGarden(x, y) || m.hasDecor(x, y)) continue;
  const nextToGarden = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inGarden(x + dx!, y + dy!));
  if (nextToGarden && m.rng() < 0.55) place([[x, y, m.rng() < 0.7 ? 'tall_grass' : 'herbs']]);
}
// o que caiu da claraboia: pedaços da estrutura de metal, fios, cacos de vidro; e as flores do ipê pelo chão
const underSkylight = cellsOf(ATRIUM.x0, ATRIUM.y0, ATRIUM.x1, ATRIUM.y1).filter(([x, y]) => skyDist(x, y) < SKYLIGHT.r + 1 && !inGarden(x, y));
scatter(underSkylight, 3, 'scrap');
scatter(underSkylight, 2, 'wires');
for (const [x, y] of cellsOf(ATRIUM.x0, ATRIUM.y0, ATRIUM.x1, ATRIUM.y1)) {
  if (m.hasDecor(x, y) || inGarden(x, y)) continue;
  const d = skyDist(x, y);
  if (d < SKYLIGHT.r && m.rng() < 0.16) place([[x, y, 'glass_shards']]);
  else if (Math.hypot(x - 30, y - 27) < 4 && m.rng() < 0.4) place([[x, y, 'ipe_petals']]);
}

// 5. O supermercado: duas fileiras de gôndolas (com um corredor no meio), os caixas e carrinhos largados
for (const y of [3, 6]) {
  for (const x of range(3, 18)) {
    if (x === 10 || x === 11) continue;
    const r = m.rng();
    if (r < 0.05) continue; // gôndola tombada: sobrou o buraco
    place([[x, y, r < 0.35 ? 'shelf_empty' : 'shelf']]);
  }
}
for (const x of [3, 6, 9, 12, 15, 18]) place([[x, 9, 'checkout']]);
scatter(cellsOf(SUPERMARKET.x0, SUPERMARKET.y0, SUPERMARKET.x1, SUPERMARKET.y1), 6, 'cart');
scatter(cellsOf(SUPERMARKET.x0, SUPERMARKET.y0, SUPERMARKET.x1, SUPERMARKET.y1), 3, 'scrap');

// 6. O cinema: três fileiras de poltronas (com o corredor do meio), o carrinho de pipoca e a bomboniere
for (const y of [4, 6, 8]) {
  for (const x of [...range(24, 29), ...range(34, 39)]) {
    const r = m.rng();
    if (r < 0.08) continue; // poltrona arrancada
    place([[x, y, r < 0.14 ? 'rubble' : 'cinema_seats']]);
  }
}
place([[25, 10, 'popcorn_cart']]);
place([[36, 10, 'food_counter'], [37, 10, 'food_counter'], [38, 10, 'food_counter']]);

// 7. A praça de alimentação: mesas (umas viradas) e, no meio, o acampamento de quem ainda vive aqui
for (const y of [6, 9, 12]) {
  for (const x of [45, 48, 51, 54, 57, 60]) {
    if (x === 51 && y === 9) {
      place([[x, y, 'fire_barrel']]);
      continue;
    }
    const r = m.rng();
    if (r < 0.1) continue;
    place([[x, y, r < 0.32 ? 'food_table_fallen' : 'food_table']]);
  }
}
for (const [x, y, key] of [[50, 8, 'crate'], [52, 10, 'barrel'], [53, 8, 'crate']] as const) place([[x, y, key]]);

// 8. As lojas, cada uma do seu jeito
BANDS.forEach((band, b) => {
  for (const store of STORES[b]!) {
    const x1 = store.x0 + store.front.length - 1;
    const inside = cellsOf(store.x0, band.top + 1, x1, band.sign - 1);
    switch (store.kind) {
      case 'roupas':
        scatter(inside, 3, 'mannequin');
        scatter(inside, 3, 'clothes_rack');
        break;
      case 'farmacia':
        // a farmácia virou horta: as prateleiras no fundo e ervas de cura nascendo no chão
        for (const x of range(store.x0, x1)) if (m.rng() < 0.75) place([[x, band.top + 1, m.rng() < 0.5 ? 'shelf_empty' : 'shelf']]);
        for (const [x, y] of inside) if (!m.hasDecor(x, y) && m.rng() < 0.3) m.setGround(x, y, 'mall_floor_moss', false);
        scatter(inside, 6, 'herbs');
        break;
      case 'eletronicos':
        scatter(inside, 3, 'scrap');
        scatter(inside, 3, 'wires');
        scatter(inside, 2, 'crate');
        break;
      case 'calcados':
        scatter(inside, 4, 'crate');
        scatter(inside, 1, 'clothes_rack');
        scatter(inside, 1, 'mannequin');
        break;
      case 'vazia':
        // quem vive aqui dentro acendeu fogo num tambor
        scatter(inside, 1, 'fire_barrel');
        scatter(inside, 2, 'crate');
        scatter(inside, 2, 'rubble');
        scatter(inside, 4, 'tall_grass');
        scatter(inside, 1, 'bones');
        break;
    }
  }
});

// 9. Nos corredores: quiosques, bancos, floreiras, entulho, cacos na frente das vitrines e um tambor de fogo na entrada
for (const [x, y] of [[9, 16], [53, 15], [11, 28], [51, 28], [8, 41], [55, 40]] as const) place([[x, y, 'kiosk_left'], [x + 1, y, 'kiosk_right']]);
for (const [x, y] of [[5, 30], [19, 30], [45, 30], [59, 30], [3, 17], [60, 17], [14, 42], [49, 42]] as const) place([[x, y, 'bench']]);
for (const [x, y] of [[2, 26], [21, 26], [42, 26], [61, 26], [7, 14], [20, 15], [44, 15], [58, 14]] as const) place([[x, y, 'planter']]);
place([[38, 41, 'fire_barrel']]);
const corridorCells = CORRIDORS.flatMap(([y0, y1]) => cellsOf(1, y0, W - 2, y1));
scatter(corridorCells, 10, () => (m.rng() < 0.6 ? 'rubble' : 'scrap'));
scatter(corridorCells, 6, () => 'tall_grass');
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (plan[y]![x] === 'V' && m.rng() < 0.45) place([[x, y + 1, 'glass_shards']]);
  }
}

// 10. Sombra embaixo das paredes e das frentes (o chão logo abaixo fica mais escuro)
const FACES = new Set(['mall_wall', 'mall_wall_vines', 'mall_wall_ad', 'store_pillar', 'store_shutter', 'store_window', 'food_counter', 'cinema_poster_saci', 'cinema_poster_mula'].map(gid));
for (let y = 1; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (free(x, y) && FACES.has(m.decor[m.idx(x, y - 1)]!)) m.depth.shade[m.idx(x, y)] = gid('shade_s');
  }
}

// 11. Áreas das criaturas (as que já existem)
const quantity = (n: number): AreaObject['properties'] => [{ name: 'quantidade', type: 'int', value: n }];
const areas: AreaObject[] = [
  { name: 'corpo_seco', x: SUPERMARKET.x0, y: SUPERMARKET.y0, w: SUPERMARKET.x1 - SUPERMARKET.x0 + 1, h: SUPERMARKET.y1 - SUPERMARKET.y0 + 1, properties: quantity(3) },
  { name: 'capelobo', x: CINEMA.x0, y: CINEMA.y0, w: CINEMA.x1 - CINEMA.x0 + 1, h: CINEMA.y1 - CINEMA.y0 + 1, properties: quantity(2) },
  { name: 'saci', x: FOOD_COURT.x0, y: FOOD_COURT.y0, w: FOOD_COURT.x1 - FOOD_COURT.x0 + 1, h: FOOD_COURT.y1 - FOOD_COURT.y0, properties: quantity(2) },
  { name: 'capelobo', x: 1, y: 19, w: 22, h: 19, properties: quantity(2) },
  { name: 'corpo_seco', x: 41, y: 19, w: 22, h: 19, properties: quantity(3) },
];

const map = m.toTiled({
  properties: [
    { name: 'nome', type: 'string', value: ZONE_NAME },
    { name: 'seguro', type: 'bool', value: false },
    { name: 'renascerEm', type: 'string', value: 'refugio' },
    // lá dentro é escuro (a luz vem do buraco da claraboia, das portas e dos tambores de fogo) e tem poeira no ar
    { name: 'neblina', type: 'float', value: 0.08 },
    { name: 'escuro', type: 'float', value: 0.26 },
  ],
  points: [
    { name: 'spawn', ...ARRIVAL },
    { name: 'entrada', ...ARRIVAL },
  ],
  monsters: areas,
  exits: [
    {
      name: 'Ruínas de Santo Amaro',
      ...ENTRANCE,
      properties: [
        { name: 'mapa', type: 'string', value: 'santo-amaro' },
        { name: 'chegada', type: 'string', value: 'shopping' },
      ],
    },
  ],
});

// 12. Confere se dá para chegar a pé nos lugares importantes
const game = GameMap.fromTiled(map as unknown as TiledMap, 'shopping-largo-treze');
const checkpoints: Record<string, { x: number; y: number }> = {
  'saída para Santo Amaro': { x: ENTRANCE.x + 1, y: ENTRANCE.y },
  supermercado: { x: 10, y: 4 },
  cinema: { x: 31, y: 5 },
  'praça de alimentação': { x: 52, y: 7 },
  'o jardim do átrio': game.nearestWalkable(31, 25, 3) ?? { x: 31, y: 25 },
};
BANDS.forEach((band, b) => {
  for (const store of STORES[b]!) checkpoints[`loja ${store.kind} (${store.x0},${band.top})`] = { x: store.x0 + store.front.indexOf('D'), y: band.sign - 1 };
});
let ok = true;
for (const [label, p] of Object.entries(checkpoints)) {
  if (!findPath(game, ARRIVAL.x, ARRIVAL.y, p.x, p.y, W * H * 2)) {
    console.error(`ERRO: não dá para chegar em "${label}" (${p.x}, ${p.y})`);
    ok = false;
  }
}
if (!ok) process.exit(1);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(map));
const used = new Set([...m.ground, ...m.decor, ...m.depth.above, ...m.depth.shade].filter(Boolean));
console.log(`mapa "${ZONE_NAME}" salvo em ${path.relative(process.cwd(), OUT)} (${W}x${H}; ${used.size} de ${TILES.length} tiles usados)`);
