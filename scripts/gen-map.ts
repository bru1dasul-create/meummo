// Gera o mapa inicial (uma vila no meio da floresta) em public/assets/maps/world.tmj.
// Depois de gerado, o mapa deve ser editado no Tiled — por isso este script NÃO sobrescreve
// um mapa existente, a não ser que você peça: npm run gen:map -- --force

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GameMap, type TiledMap } from '../src/shared/map';
import { findPath } from '../src/shared/pathfind';
import { mulberry32 } from './pixels';
import { gid, TILES, tiledTileset } from './tileset';

const OUT = path.resolve('public/assets/maps/world.tmj');
const W = 80;
const H = 60;
const SPAWN = { x: 40, y: 31 };

if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`O mapa ${path.relative(process.cwd(), OUT)} já existe (e pode ter edições feitas no Tiled).`);
  console.error('Para gerar de novo e PERDER essas edições, rode: npm run gen:map -- --force');
  process.exit(1);
}

const rng = mulberry32(20261109);
const ground = new Array<number>(W * H).fill(0);
const decor = new Array<number>(W * H).fill(0);
/** Lugares onde não pode nascer árvore/pedra aleatória (caminhos, casas, água...). */
const reserved = new Uint8Array(W * H);
/** Lugares que podem ter flores, mas nada que bloqueie a passagem. */
const keepClear = new Uint8Array(W * H);

const idx = (x: number, y: number) => y * W + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
function setGround(x: number, y: number, key: string, reserve = true) {
  if (!inside(x, y)) return;
  ground[idx(x, y)] = gid(key);
  if (reserve) reserved[idx(x, y)] = 1;
}
function setDecor(x: number, y: number, key: string) {
  if (inside(x, y)) decor[idx(x, y)] = gid(key);
}
function reserveRect(x0: number, y0: number, x1: number, y1: number, mask = reserved) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) mask[idx(x, y)] = 1;
}

// 1. Grama em todo lugar
for (let i = 0; i < W * H; i++) {
  const r = rng();
  ground[i] = gid(r < 0.78 ? 'grass' : r < 0.92 ? 'grass_tufts' : 'grass_dark');
}

// 2. Praça de pedra no centro, com um poço
for (let y = 25; y <= 35; y++) for (let x = 34; x <= 46; x++) setGround(x, y, 'stone_floor');
setDecor(40, 28, 'well');
reserveRect(30, 21, 50, 39, keepClear);

// 3. Caminhos de terra (3 tiles de largura) saindo da praça
const pathCells: [number, number][] = [];
function path3(x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setGround(x, y, 'dirt');
      pathCells.push([x, y]);
    }
  }
}
path3(39, 2, 41, 24); // norte
path3(39, 36, 41, 57); // sul
path3(2, 29, 33, 31); // oeste
path3(47, 29, 77, 31); // leste
// bordas irregulares para não parecer régua
for (const [x, y] of [...pathCells]) {
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (inside(nx, ny) && !reserved[idx(nx, ny)] && rng() < 0.12) setGround(nx, ny, 'dirt');
  }
}

// 4. Casas (5 de largura x 3 de altura: 2 fileiras de telhado + parede com porta)
function house(x0: number, y0: number) {
  for (let y = y0; y < y0 + 2; y++) for (let x = x0; x < x0 + 5; x++) setDecor(x, y, 'roof');
  const front = ['wall', 'wall_window', 'door', 'wall_window', 'wall'];
  front.forEach((key, i) => setDecor(x0 + i, y0 + 2, key));
  reserveRect(x0 - 1, y0 - 1, x0 + 5, y0 + 3);
  // trilha da porta até o caminho/praça mais próximo
  const doorX = x0 + 2;
  for (let y = y0 + 3; y < H; y++) {
    const key = ground[idx(doorX, y)];
    if (key === gid('dirt') || key === gid('stone_floor')) break;
    setGround(doorX, y, 'dirt');
  }
}
house(20, 22);
house(27, 22);
house(48, 22);
house(32, 18);
house(43, 18);

// 5. Jardim florido (sudoeste da praça) e plantação (sudeste), com cercas
for (let y = 34; y <= 38; y++) {
  for (let x = 26; x <= 32; x++) {
    reserved[idx(x, y)] = 1;
    if (rng() < 0.6) setDecor(x, y, ['flowers_red', 'flowers_yellow', 'flowers_white'][Math.floor(rng() * 3)]!);
  }
}
for (let x = 26; x <= 32; x++) {
  setDecor(x, 33, 'fence');
  setDecor(x, 39, 'fence');
}
for (let y = 34; y <= 40; y++) {
  for (let x = 48; x <= 56; x++) {
    reserved[idx(x, y)] = 1;
    if (y % 2 === 0) setDecor(x, y, 'tall_grass');
  }
}
for (let x = 48; x <= 56; x++) setDecor(x, 41, 'fence');
reserveRect(25, 33, 33, 40);
reserveRect(47, 33, 57, 42);

// 6. Rio (de norte a sul, a leste da vila) com ponte no caminho
let riverX = 61;
for (let y = 0; y < H; y++) {
  const nearBridge = y >= 25 && y <= 35;
  if (y > 0 && y % 6 === 0 && !nearBridge) riverX = Math.min(64, Math.max(59, riverX + (rng() < 0.5 ? -1 : 1)));
  for (let x = riverX; x < riverX + 3; x++) {
    if (y >= 29 && y <= 31) {
      setGround(x, y, y === 29 ? 'bridge_top' : y === 31 ? 'bridge_bottom' : 'bridge');
    } else {
      setGround(x, y, rng() < 0.85 ? 'water' : 'water_sparkle');
    }
  }
  for (const bx of [riverX - 1, riverX + 3]) {
    if (y >= 29 && y <= 31) continue;
    if (rng() < 0.7) setGround(bx, y, 'sand');
    else reserved[idx(bx, y)] = 1;
  }
}

// 7. Lago a sudoeste, com areia em volta
const lake = { x: 16, y: 46, rx: 7.5, ry: 5.5 };
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - lake.x) / lake.rx;
    const dy = (y + 0.5 - lake.y) / lake.ry;
    const d = dx * dx + dy * dy;
    if (d <= 1) setGround(x, y, rng() < 0.85 ? 'water' : 'water_sparkle');
    else if (d <= 1.45) setGround(x, y, 'sand');
  }
}

// 8. Florestas: uma borda em volta do mapa e alguns bosques
const groves = [
  { x: 12, y: 10, r: 10 },
  { x: 26, y: 8, r: 5 },
  { x: 53, y: 8, r: 5 },
  { x: 70, y: 10, r: 9 },
  { x: 71, y: 47, r: 9 },
  { x: 52, y: 51, r: 6 },
  { x: 30, y: 51, r: 5 },
];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    if (reserved[i] || decor[i]) continue;
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    let chance = edge <= 1 ? 1 : edge === 2 ? 0.7 : edge === 3 ? 0.4 : edge === 4 ? 0.15 : 0;
    for (const g of groves) {
      const dist = Math.hypot(x - g.x, y - g.y);
      chance = Math.max(chance, Math.min(0.85, (1 - dist / g.r) * 1.2));
    }
    if (keepClear[i]) chance = 0;
    if (rng() < chance) setDecor(x, y, rng() < 0.4 ? 'pine' : 'tree');
  }
}

// 9. Detalhes espalhados: flores, capim, arbustos e pedras
const grassGids = new Set([gid('grass'), gid('grass_tufts'), gid('grass_dark')]);
for (let i = 0; i < W * H; i++) {
  if (reserved[i] || decor[i] || !grassGids.has(ground[i]!)) continue;
  const r = rng();
  const x = i % W;
  const y = Math.floor(i / W);
  if (r < 0.02) setDecor(x, y, ['flowers_red', 'flowers_yellow', 'flowers_white'][Math.floor(rng() * 3)]!);
  else if (r < 0.055) setDecor(x, y, 'tall_grass');
  else if (keepClear[i]) continue;
  else if (r < 0.065) setDecor(x, y, 'bush');
  else if (r < 0.071) setDecor(x, y, 'rock');
}

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
  nextlayerid: 4,
  nextobjectid: 2,
  layers: [
    { id: 1, name: 'ground', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: ground },
    { id: 2, name: 'decor', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: decor },
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
        {
          id: 1,
          name: 'spawn',
          type: '',
          point: true,
          x: SPAWN.x * 16 + 8,
          y: SPAWN.y * 16 + 8,
          width: 0,
          height: 0,
          rotation: 0,
          visible: true,
        },
      ],
    },
  ],
  tilesets: [tiledTileset('../tiles.png')],
};

// 11. Confere se dá para chegar a pé em todos os cantos importantes
const game = GameMap.fromTiled(map as unknown as TiledMap);
const checkpoints = {
  'fim do caminho norte': { x: 40, y: 3 },
  'fim do caminho sul': { x: 40, y: 56 },
  'fim do caminho oeste': { x: 3, y: 30 },
  'fim do caminho leste': { x: 76, y: 30 },
  'outro lado da ponte': { x: 70, y: 30 },
};
let ok = true;
for (const [label, p] of Object.entries(checkpoints)) {
  if (!findPath(game, game.spawn.x, game.spawn.y, p.x, p.y, W * H)) {
    console.error(`ERRO: não dá para chegar em "${label}" (${p.x}, ${p.y})`);
    ok = false;
  }
}
if (!ok) process.exit(1);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(map));
const used = new Set([...ground, ...decor].filter(Boolean));
console.log(`mapa salvo em ${path.relative(process.cwd(), OUT)} (${W}x${H}, ${used.size} de ${TILES.length} tiles usados)`);
