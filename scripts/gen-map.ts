// Gera o mapa da zona inicial — o Refúgio de Guarapiranga — em public/assets/maps/refugio.tmj.
//
// Pindorama: Selva de Pedra. Muito tempo depois do fim, a floresta tomou São Paulo.
// A represa de Guarapiranga virou um lago sagrado, com uma vila flutuante de madeira e restos de barcos.
// Em volta: mata com ipês (norte), brejo que leva à Billings (sul) e a avenida antiga em ruínas (leste),
// caminho para Santo Amaro.
//
// Depois de gerado, o mapa deve ser editado no Tiled — por isso este script NÃO sobrescreve
// um mapa existente, a não ser que você peça: npm run gen:map -- --force
// (ou gere em outro arquivo para comparar: npm run gen:map -- --out outro.tmj)

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GameMap, type TiledMap } from '../src/shared/map';
import { findPath } from '../src/shared/pathfind';
import { DepthLayers, depthTileLayers, shuffled, softenEdges, type BigTree } from './map-depth';
import { mulberry32 } from './pixels';
import { gid, TILES, tiledTileset } from './tileset';

const outIndex = process.argv.indexOf('--out');
const OUT = path.resolve(outIndex !== -1 && process.argv[outIndex + 1] ? process.argv[outIndex + 1]! : 'public/assets/maps/refugio.tmj');
const W = 96;
const H = 72;
const ZONE_NAME = 'Refúgio de Guarapiranga';
const SPAWN = { x: 42, y: 29 };
/** Saída no fim da avenida (leste) para as Ruínas de Santo Amaro, e onde chega quem volta de lá. */
const EAST_EXIT = { x: W - 1, y: 22, w: 1, h: 9 };
const EAST_ARRIVAL = { x: W - 4, y: 26 };

/** Áreas onde nascem monstros (em tiles). O nome é o id em data/monsters.json. */
const MONSTER_ZONES = [
  { monster: 'sagui', x: 27, y: 5, w: 11, h: 7, count: 4 }, // mata ao norte
  { monster: 'sagui', x: 50, y: 5, w: 11, h: 7, count: 4 },
  { monster: 'jararaca', x: 22, y: 57, w: 13, h: 7, count: 3 }, // brejo ao sul
  { monster: 'jararaca', x: 49, y: 57, w: 13, h: 7, count: 3 },
  { monster: 'saci', x: 79, y: 34, w: 9, h: 6, count: 1 }, // praça em ruínas na avenida antiga
];

if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`O mapa ${path.relative(process.cwd(), OUT)} já existe (e pode ter edições feitas no Tiled).`);
  console.error('Para gerar de novo e PERDER essas edições, rode: npm run gen:map -- --force');
  process.exit(1);
}

const rng = mulberry32(20261110);
const ground = new Array<number>(W * H).fill(0);
const decor = new Array<number>(W * H).fill(0);
/** Camadas "acima" (copas e alto dos postes, por cima dos personagens) e "sombras". */
const depth = new DepthLayers(W, H, decor);
/** Lugares onde não pode nascer nada aleatório (água, vila, caminhos, ruínas...). */
const reserved = new Uint8Array(W * H);
/** Lugares que podem ter flores e capim, mas nada que bloqueie a passagem. */
const keepClear = new Uint8Array(W * H);

const idx = (x: number, y: number) => y * W + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
const pick = <T>(list: T[]): T => list[Math.floor(rng() * list.length)]!;
function setGround(x: number, y: number, key: string, reserve = true) {
  if (!inside(x, y)) return;
  ground[idx(x, y)] = gid(key);
  if (reserve) reserved[idx(x, y)] = 1;
}
function setDecor(x: number, y: number, key: string) {
  if (inside(x, y)) decor[idx(x, y)] = gid(key);
}
function groundIs(x: number, y: number, ...keys: string[]): boolean {
  return inside(x, y) && keys.some((k) => ground[idx(x, y)] === gid(k));
}
function fillRect(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) fn(x, y);
}
const WATERS = ['water', 'water_sparkle', 'dark_water'];
const isWater = (x: number, y: number) => groundIs(x, y, ...WATERS);

/** Ruído suave (para margens e matas com formato natural, não de régua). */
function makeNoise(cell: number) {
  const gw = Math.ceil(W / cell) + 2;
  const gh = Math.ceil(H / cell) + 2;
  const grid = Array.from({ length: gw * gh }, () => rng());
  return (x: number, y: number) => {
    const gx = x / cell;
    const gy = y / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const sx = (gx - x0) * (gx - x0) * (3 - 2 * (gx - x0));
    const sy = (gy - y0) * (gy - y0) * (3 - 2 * (gy - y0));
    const v = (i: number, j: number) => grid[(y0 + j) * gw + (x0 + i)]!;
    return (v(0, 0) * (1 - sx) + v(1, 0) * sx) * (1 - sy) + (v(0, 1) * (1 - sx) + v(1, 1) * sx) * sy;
  };
}
const noiseBig = makeNoise(9);
const noiseSmall = makeNoise(4);
const noiseShore = makeNoise(7);
const noiseForest = makeNoise(8);

// 1. Grama em todo lugar
for (let i = 0; i < W * H; i++) {
  const r = rng();
  ground[i] = gid(r < 0.76 ? 'grass' : r < 0.9 ? 'grass_tufts' : 'grass_dark');
}

// 2. A represa (com margem irregular), areia na beira e taboas
// a represa é o corpo principal mais três "braços" (como a Guarapiranga de verdade, cheia de enseadas)
const lakeParts = [
  { x: 42, y: 34, rx: 30, ry: 19.5 },
  { x: 20, y: 49, rx: 12, ry: 6 },
  { x: 64, y: 14, rx: 10, ry: 5 },
  { x: 19, y: 18, rx: 9, ry: 5 },
];
const lakeDistance = (x: number, y: number) => {
  let best = Infinity;
  for (const part of lakeParts) {
    const dx = (x + 0.5 - part.x) / part.rx;
    const dy = (y + 0.5 - part.y) / part.ry;
    best = Math.min(best, dx * dx + dy * dy);
  }
  return best * (0.7 + 0.6 * noiseShore(x, y));
};
fillRect(0, 0, W - 1, H - 1, (x, y) => {
  const d = lakeDistance(x, y);
  if (d <= 1) setGround(x, y, rng() < 0.88 ? 'water' : 'water_sparkle');
  else if (d <= 1.22) setGround(x, y, 'sand');
});

// 3. A vila flutuante: decks ligados por píeres
const deckCells = new Set<number>();
function deck(x0: number, y0: number, x1: number, y1: number) {
  fillRect(x0, y0, x1, y1, (x, y) => {
    setGround(x, y, 'deck');
    deckCells.add(idx(x, y));
  });
}
/** Píer de leste a oeste (3 de largura), usando as tábuas de ponte. */
function pierH(x0: number, x1: number, y0: number) {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
    setGround(x, y0, 'bridge_top');
    setGround(x, y0 + 1, 'bridge');
    setGround(x, y0 + 2, 'bridge_bottom');
    for (let k = 0; k < 3; k++) deckCells.add(idx(x, y0 + k));
  }
}
/** Píer de norte a sul (3 de largura). */
function pierV(x0: number, y0: number, y1: number) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    setGround(x0, y, 'pier_left');
    setGround(x0 + 1, y, 'pier_v');
    setGround(x0 + 2, y, 'pier_right');
    for (let k = 0; k < 3; k++) deckCells.add(idx(x0 + k, y));
  }
}
/** Estende um píer sobre a água até chegar em terra. Devolve onde ele encostou. */
function pierUntilLand(dir: 'n' | 's' | 'e' | 'w', start: number, across: number): number {
  let pos = start;
  const step = dir === 'n' || dir === 'w' ? -1 : 1;
  for (;;) {
    const x = dir === 'e' || dir === 'w' ? pos : across + 1;
    const y = dir === 'e' || dir === 'w' ? across + 1 : pos;
    if (!inside(x, y) || !isWater(x, y)) return pos;
    if (dir === 'e' || dir === 'w') pierH(pos, pos, across);
    else pierV(across, pos, pos);
    pos += step;
  }
}

deck(36, 24, 48, 32); // deck central, com a fogueira
deck(26, 22, 32, 27);
deck(52, 22, 58, 27);
deck(33, 36, 39, 41);
deck(45, 36, 51, 41);
pierH(33, 35, 25);
pierH(49, 51, 25);
pierV(35, 33, 35);
pierV(47, 33, 35);
const northLanding = pierUntilLand('n', 23, 41);
const eastLanding = pierUntilLand('e', 59, 25);
const westLanding = pierUntilLand('w', 25, 25);
const southLanding = pierUntilLand('s', 42, 35);

// estacas na água embaixo das bordas dos decks e píeres
for (const cell of [...deckCells]) {
  const x = cell % W;
  const y = Math.floor(cell / W);
  if (isWater(x, y + 1) && !deckCells.has(idx(x, y + 1))) setGround(x, y + 1, 'water_posts');
}

// água funda (escura): o que fica longe de qualquer margem ou deck. Mede a distância em linha reta até a
// terra mais próxima (contar passos na grade deixava a parte funda em forma de losango).
const nearVillage = (x: number, y: number) => {
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (deckCells.has(idx(x + dx, y + dy))) return true;
  return false;
};
const landCells: [number, number][] = [];
fillRect(0, 0, W - 1, H - 1, (x, y) => {
  if (!isWater(x, y) || groundIs(x, y, 'water_posts')) landCells.push([x, y]);
});
const deep = new Uint8Array(W * H);
fillRect(0, 0, W - 1, H - 1, (x, y) => {
  if (!groundIs(x, y, 'water', 'water_sparkle')) return;
  let nearest = Infinity;
  for (const [lx, ly] of landCells) nearest = Math.min(nearest, (lx - x) ** 2 + (ly - y) ** 2);
  if (Math.sqrt(nearest) >= 4 + noiseBig(x, y) * 2.5) deep[idx(x, y)] = 1;
});
// pedacinhos soltos de água funda (menos de 12 tiles) parecem defeito no desenho: esses ficam claros
const deepSeen = new Uint8Array(W * H);
for (let start = 0; start < W * H; start++) {
  if (!deep[start] || deepSeen[start]) continue;
  const region = [start];
  deepSeen[start] = 1;
  for (let head = 0; head < region.length; head++) {
    const cx = region[head]! % W;
    const cy = Math.floor(region[head]! / W);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      if (inside(cx + dx, cy + dy) && deep[idx(cx + dx, cy + dy)] && !deepSeen[idx(cx + dx, cy + dy)]) {
        deepSeen[idx(cx + dx, cy + dy)] = 1;
        region.push(idx(cx + dx, cy + dy));
      }
    }
  }
  if (region.length >= 12) for (const cell of region) setGround(cell % W, Math.floor(cell / W), 'dark_water');
}

// casas de tábua pintada (palafitas coloridas) com telhado de lata, em cima dos decks: 5 de largura, 4 de altura
// (2 de telhado e 2 de parede, com a porta no meio e uma janela acesa de cada lado)
const HOUSE_COLORS = ['azul', 'verde', 'terracota', 'amarelo', 'verde', 'azul'] as const;
let houses = 0;
function house(x0: number, y0: number) {
  const color = HOUSE_COLORS[houses++ % HOUSE_COLORS.length];
  for (let i = 0; i < 5; i++) {
    const side = i === 0 ? 'l' : i === 4 ? 'r' : (x0 + i) % 3 === 0 ? 'm2' : 'm';
    setDecor(x0 + i, y0, `roof_top_${side}`);
    setDecor(x0 + i, y0 + 1, `roof_eave_${side}`);
  }
  ['wall', 'window', 'door_top', 'window', 'wall'].forEach((part, i) => setDecor(x0 + i, y0 + 2, `house_${color}_${part}`));
  ['base', 'base', 'door', 'base', 'base'].forEach((part, i) => setDecor(x0 + i, y0 + 3, `house_${color}_${part}`));
  depth.shadeBlock(x0, y0, x0 + 4, y0 + 3, (x, y) => !decor[idx(x, y)]);
}
house(36, 24);
house(44, 24);
house(27, 22);
house(53, 22);
house(34, 37);
house(46, 37);
setDecor(42, 27, 'campfire');

// enfeites da vila: lamparinas (com bandeirinhas de festa junina em volta da fogueira), varais, rede de pesca,
// caixotes, barris e cestos de peixe — sempre deixando livres as passagens entre os decks e os píeres
function lantern(x: number, y: number, flags: 'none' | 'left' | 'right' = 'none') {
  setDecor(x, y, 'lantern_base');
  depth.above[idx(x, y - 1)] = gid(flags === 'right' ? 'lantern_flags_r_top' : flags === 'left' ? 'lantern_flags_l_top' : 'lantern_top');
}
lantern(37, 30, 'right');
lantern(47, 30, 'left');
for (let x = 38; x <= 46; x++) depth.above[idx(x, 29)] = gid(['flags_a', 'flags_b', 'flags_c'][x % 3]!);
function clothesline(x0: number, y: number) {
  ['bl', 'bm', 'br'].forEach((part, i) => setDecor(x0 + i, y, `clothesline_${part}`));
  ['tl', 'tm', 'tr'].forEach((part, i) => (depth.above[idx(x0 + i, y - 1)] = gid(`clothesline_${part}`)));
}
clothesline(28, 27);
clothesline(54, 27);
// lamparinas ao longo dos píeres compridos, no corrimão (o pier tem 3 de largura: sempre sobram 2 para passar)
for (let x = westLanding + 3; x <= 24; x += 7) lantern(x, 25);
for (let x = 62; x < eastLanding - 1; x += 7) lantern(x, 25);
for (let y = northLanding + 3; y <= 22; y += 7) lantern(41, y);
setDecor(39, 32, 'fishing_net_left');
setDecor(40, 32, 'fishing_net_right');
for (const [x, y, key] of [
  [36, 28, 'crate'],
  [48, 28, 'barrel'],
  [44, 32, 'fish_basket'],
  [45, 32, 'crate'],
  [33, 41, 'barrel'],
  [39, 41, 'crate'],
  [45, 41, 'fish_basket'],
  [51, 41, 'barrel'],
  [26, 22, 'barrel'],
  [58, 22, 'crate'],
] as const) {
  setDecor(x, y, key);
}

// barcos amarrados perto da vila e destroços nas beiradas
const waterNextToVillage: number[] = [];
fillRect(0, 0, W - 2, H - 1, (x, y) => {
  if (!groundIs(x, y, 'water', 'water_sparkle') || !groundIs(x + 1, y, 'water', 'water_sparkle')) return;
  const touches = [idx(x, y - 1), idx(x + 1, y - 1), idx(x, y + 1), idx(x + 1, y + 1), idx(x - 1, y), idx(x + 2, y)].some((c) => deckCells.has(c));
  if (touches) waterNextToVillage.push(idx(x, y));
});
const boats: number[] = [];
for (let tries = 0; tries < 400 && boats.length < 7; tries++) {
  const cell = pick(waterNextToVillage);
  const x = cell % W;
  const y = Math.floor(cell / W);
  if (boats.every((b) => Math.abs((b % W) - x) + Math.abs(Math.floor(b / W) - y) > 6)) {
    boats.push(cell);
    setDecor(x, y, 'boat_left');
    setDecor(x + 1, y, 'boat_right');
  }
}
let wrecks = 0;
for (let tries = 0; tries < 2000 && wrecks < 6; tries++) {
  const x = Math.floor(rng() * W);
  const y = Math.floor(rng() * H);
  const d = lakeDistance(x, y);
  if (groundIs(x, y, 'water', 'water_sparkle') && d > 0.75 && d < 0.97 && !decor[idx(x, y)] && !nearVillage(x, y)) {
    setDecor(x, y, 'boat_wreck');
    wrecks++;
  }
}
// taboas na areia encostada na água
fillRect(0, 0, W - 1, H - 1, (x, y) => {
  if (!groundIs(x, y, 'sand') || decor[idx(x, y)]) return;
  const nearWater = isWater(x + 1, y) || isWater(x - 1, y) || isWater(x, y + 1) || isWater(x, y - 1);
  if (nearWater && rng() < 0.3) setDecor(x, y, 'reeds');
});

// 4. A avenida antiga (leste), em ruínas, até a saída para Santo Amaro
const roadStart = eastLanding;
for (let x = roadStart; x < W; x++) {
  for (let y = 25; y <= 27; y++) setGround(x, y, rng() < 0.45 ? 'asphalt_cracked' : 'asphalt');
  if (x % 6 === 0) {
    // postes altos: a luminária quebrada fica na camada "acima" (a do lado de baixo pende sobre a avenida)
    depth.tallPole('lamp_post_tall', x, 24);
    depth.tallPole('lamp_post_tall', x + 3, 28);
  }
}
fillRect(roadStart, 23, W - 1, 24, (x, y) => (reserved[idx(x, y)] = 1));
fillRect(roadStart, 28, W - 1, 29, (x, y) => (reserved[idx(x, y)] = 1));
// pedaços de muro ao longo da avenida (alguns pichados)
for (let x = roadStart + 3; x < W - 3; x += 5 + Math.floor(rng() * 4)) {
  const len = 2 + Math.floor(rng() * 3);
  const y = rng() < 0.5 ? 22 : 30;
  for (let k = 0; k < len; k++) {
    setDecor(x + k, y, rng() < 0.3 ? 'ruin_wall_graffiti' : 'ruin_wall');
    reserved[idx(x + k, y)] = 1;
  }
  depth.shadeBlock(x, y, x + len - 1, y, (sx, sy) => !decor[idx(sx, sy)]);
}
// carros abandonados (deixando sempre uma faixa livre)
for (const [x, y] of [
  [roadStart + 6, 25],
  [roadStart + 15, 27],
] as const) {
  setDecor(x, y, 'car_left');
  setDecor(x + 1, y, 'car_right');
}
// praça em ruínas onde mora o Saci
fillRect(78, 33, 89, 41, (x, y) => {
  if (noiseSmall(x, y) > 0.35) setGround(x, y, rng() < 0.5 ? 'asphalt_cracked' : 'asphalt');
  reserved[idx(x, y)] = 1;
});
for (const [x, y, len] of [
  [78, 33, 4],
  [86, 33, 3],
  [78, 41, 3],
  [85, 41, 5],
] as const) {
  for (let k = 0; k < len; k++) setDecor(x + k, y, k === 1 ? 'ruin_wall_graffiti' : 'ruin_wall');
  depth.shadeBlock(x, y, x + len - 1, y, (sx, sy) => !decor[idx(sx, sy)]);
}
setDecor(83, 38, 'car_left');
setDecor(84, 38, 'car_right');
for (const [x, y] of [
  [80, 36],
  [87, 39],
  [82, 40],
] as const) {
  setDecor(x, y, 'bones');
}
// um caminho de terra liga a avenida à praça
for (let y = 28; y <= 33; y++) for (let x = 82; x <= 84; x++) if (!decor[idx(x, y)]) setGround(x, y, 'asphalt_cracked');

// 5. Trilhas: norte (mata), oeste (mata) e sul (brejo, rumo à Billings)
for (let y = 2; y < northLanding; y++) for (let x = 41; x <= 43; x++) if (!isWater(x, y)) setGround(x, y, 'dirt');
for (let x = 2; x < westLanding; x++) for (let y = 25; y <= 27; y++) if (!isWater(x, y)) setGround(x, y, 'dirt');
for (let y = southLanding + 1; y < H - 1; y++) {
  for (let x = 41; x <= 43; x++) {
    if (isWater(x, y)) continue;
    rng(); // a trilha do sul sorteava lama ou terra; o sorteio fica, para o brejo e as matas não mudarem
    setGround(x, y, 'dirt');
  }
}

// 6. Brejo ao sul: lama, poças, taboas e capim alto
fillRect(0, 48, W - 1, H - 1, (x, y) => {
  if (reserved[idx(x, y)] || isWater(x, y)) return;
  const falloff = 1 - ((x - 42) / 33) ** 2 - ((y - 62) / 12) ** 2;
  if (falloff <= 0) return;
  const n = noiseSmall(x, y) * 0.6 + noiseBig(x, y) * 0.4 + falloff * 0.35;
  if (n > 0.66) {
    setGround(x, y, n > 1.02 && rng() < 0.6 ? 'water' : 'mud', false);
    if (groundIs(x, y, 'mud') && rng() < 0.18) setDecor(x, y, rng() < 0.5 ? 'reeds' : 'tall_grass');
  }
});

// 7. Matas: borda fechada em volta do mapa e bosques com ipês. As árvores são grandes (2x3 tiles): o tronco
// bloqueia e a copa fica na camada "acima" — dá para passar por trás delas, embaixo das folhas.
const exits = (x: number, y: number) => (y >= 24 && y <= 28 && x > W - 6) || (x >= 40 && x <= 44 && (y < 4 || y > H - 5));
const natural = (x: number, y: number) => groundIs(x, y, 'grass', 'grass_tufts', 'grass_dark', 'mud');
const canGrow = (x: number, y: number) =>
  inside(x, y) && !reserved[idx(x, y)] && !decor[idx(x, y)] && !keepClear[idx(x, y)] && !exits(x, y) && natural(x, y);
// a copa pode cobrir mato, areia e a beira da água, mas não trilhas, decks e a avenida
const canCover = (x: number, y: number) => !exits(x, y) && (natural(x, y) || groundIs(x, y, 'sand', ...WATERS));
/** Quão perto da borda do mapa (com a beirada irregular): até 2 é mata fechada. */
const edgeBand = (x: number, y: number) => Math.min(x, y, W - 1 - x, H - 1 - y) + noiseSmall(x, y) * 2;
function treeChance(x: number, y: number): number {
  const band = edgeBand(x, y);
  let chance = band <= 2 ? 1 : band <= 4 ? 0.65 : Math.min(x, y, W - 1 - x, H - 1 - y) <= 6 ? 0.25 : 0;
  // matas mais fechadas no norte e no oeste, mais abertas no brejo
  const forest = y < 16 || x < 12 || (x > 62 && (y < 22 || y > 44));
  if (forest) chance = Math.max(chance, 0.12 + 0.55 * noiseForest(x, y));
  if (groundIs(x, y, 'mud')) chance *= 0.35;
  for (const z of MONSTER_ZONES) {
    if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) chance *= 0.35; // clareiras para lutar
  }
  return chance;
}
const treeKind = (): BigTree => {
  const r = rng();
  return r < 0.1 ? 'ipe_yellow_big' : r < 0.17 ? 'ipe_pink_big' : r < 0.55 ? 'pine_big' : 'tree_big';
};
// tenta em ordem embaralhada: as árvores se encaixam de um jeito natural, não em fileiras
for (const i of shuffled([...Array(W * H).keys()], rng)) {
  const x = i % W;
  const y = Math.floor(i / W);
  if (!canGrow(x, y) || !canGrow(x + 1, y)) continue;
  if (rng() < Math.min(treeChance(x, y), treeChance(x + 1, y))) depth.plantBigTree(treeKind(), x, y, canCover);
}
// a borda do mapa é fechada: o que ficou livre ali vira mata fechada (embaixo das copas) ou arbusto
fillRect(0, 0, W - 1, H - 1, (x, y) => {
  if (edgeBand(x, y) > 2 || !canGrow(x, y)) return;
  setDecor(x, y, depth.covered(x, y) ? 'thicket' : pick(['bush', 'bush', 'tree', 'pine']));
});

// 8. Detalhes: flores, capim, arbustos e pedras na grama livre
const grassGids = new Set([gid('grass'), gid('grass_tufts'), gid('grass_dark')]);
for (let i = 0; i < W * H; i++) {
  if (reserved[i] || decor[i] || !grassGids.has(ground[i]!)) continue;
  const x = i % W;
  const y = Math.floor(i / W);
  if (exits(x, y)) continue;
  const r = rng();
  if (r < 0.025) setDecor(x, y, pick(['flowers_red', 'flowers_yellow', 'flowers_white']));
  else if (r < 0.06) setDecor(x, y, 'tall_grass');
  else if (r < 0.07) setDecor(x, y, 'bush');
  else if (r < 0.076) setDecor(x, y, 'rock');
}

// 9. Beiradas suaves entre os terrenos (no fim: depois disso, a areia da beira deixa de ser só "areia")
const isGrass = (x: number, y: number) => groundIs(x, y, 'grass', 'grass_tufts', 'grass_dark');
const wet = (x: number, y: number) => groundIs(x, y, ...WATERS, 'water_posts');
softenEdges(ground, W, H, [
  { base: ['sand'], set: 'shore', touches: wet },
  { base: ['sand'], set: 'sand_grass', touches: isGrass },
  { base: ['mud'], set: 'mud_shore', touches: wet },
  { base: ['mud'], set: 'mud_grass', touches: isGrass },
  { base: ['dirt'], set: 'dirt_grass', touches: isGrass },
  { base: ['dirt'], set: 'dirt_mud', touches: (x, y) => groundIs(x, y, 'mud') },
]);
// a parte funda da represa vai escurecendo aos poucos (na camada "sombras", por cima da água que balança)
softenEdges(ground, W, H, [{ base: ['water', 'water_sparkle'], set: 'deep_edge', touches: (x, y) => groundIs(x, y, 'dark_water') }], depth.shade);

// 10. Monta o JSON no formato do Tiled
const map = {
  compressionlevel: -1,
  height: H,
  width: W,
  infinite: false,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.11.0',
  version: '1.10',
  type: 'map',
  tilewidth: 16,
  tileheight: 16,
  nextlayerid: 8,
  nextobjectid: 4 + MONSTER_ZONES.length,
  properties: [
    { name: 'nome', type: 'string', value: ZONE_NAME },
    { name: 'seguro', type: 'bool', value: true },
    { name: 'inicial', type: 'bool', value: true },
  ],
  layers: [
    { id: 1, name: 'ground', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: ground },
    depthTileLayers(depth).shade,
    { id: 2, name: 'decor', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: decor },
    depthTileLayers(depth).above,
    {
      id: 3,
      name: 'objects',
      type: 'objectgroup',
      draworder: 'topdown',
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      objects: [
        { id: 1, name: 'spawn', type: '', point: true, x: SPAWN.x * 16 + 8, y: SPAWN.y * 16 + 8, width: 0, height: 0, rotation: 0, visible: true },
        // quem volta de Santo Amaro aparece aqui, no fim da avenida
        { id: 2 + MONSTER_ZONES.length, name: 'leste', type: '', point: true, x: EAST_ARRIVAL.x * 16 + 8, y: EAST_ARRIVAL.y * 16 + 8, width: 0, height: 0, rotation: 0, visible: true },
      ],
    },
    {
      id: 4,
      name: 'monstros',
      type: 'objectgroup',
      draworder: 'topdown',
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      objects: MONSTER_ZONES.map((zone, i) => ({
        id: 2 + i,
        name: zone.monster,
        type: '',
        x: zone.x * 16,
        y: zone.y * 16,
        width: zone.w * 16,
        height: zone.h * 16,
        rotation: 0,
        visible: true,
        properties: [{ name: 'quantidade', type: 'int', value: zone.count }],
      })),
    },
    {
      id: 5,
      name: 'saidas',
      type: 'objectgroup',
      draworder: 'topdown',
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      objects: [
        {
          id: 3 + MONSTER_ZONES.length,
          name: 'Ruínas de Santo Amaro',
          type: '',
          x: EAST_EXIT.x * 16,
          y: EAST_EXIT.y * 16,
          width: EAST_EXIT.w * 16,
          height: EAST_EXIT.h * 16,
          rotation: 0,
          visible: true,
          properties: [
            { name: 'mapa', type: 'string', value: 'santo-amaro' },
            { name: 'chegada', type: 'string', value: 'oeste' },
          ],
        },
      ],
    },
  ],
  tilesets: [tiledTileset('../tiles.png')],
};

// 11. Confere se dá para chegar a pé em todos os lugares importantes
const game = GameMap.fromTiled(map as unknown as TiledMap);
const checkpoints: Record<string, { x: number; y: number }> = {
  'fim da trilha norte': { x: 42, y: 3 },
  'saída da avenida (Santo Amaro)': { x: W - 2, y: 26 },
  'fim da trilha sul (Billings)': { x: 42, y: H - 2 },
  'fim da trilha oeste': { x: 3, y: 26 },
  'praça do Saci': { x: 83, y: 36 },
};
for (const zone of MONSTER_ZONES) checkpoints[`área ${zone.monster} (${zone.x},${zone.y})`] = game.nearestWalkable(zone.x + (zone.w >> 1), zone.y + (zone.h >> 1)) ?? zone;
let ok = true;
for (const [label, p] of Object.entries(checkpoints)) {
  if (!findPath(game, game.spawn.x, game.spawn.y, p.x, p.y, W * H * 2)) {
    console.error(`ERRO: não dá para chegar em "${label}" (${p.x}, ${p.y})`);
    ok = false;
  }
}
if (!ok) process.exit(1);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(map));
const used = new Set([...ground, ...decor, ...depth.above, ...depth.shade].filter(Boolean));
console.log(`mapa "${ZONE_NAME}" salvo em ${path.relative(process.cwd(), OUT)} (${W}x${H}, ${used.size} de ${TILES.length} tiles usados)`);
