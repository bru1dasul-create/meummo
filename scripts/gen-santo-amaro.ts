// Gera o mapa das Ruínas de Santo Amaro em public/assets/maps/santo-amaro.tmj (versão provisória).
//
// O antigo centro comercial virou um labirinto de prédios caídos tomados pela mata: ruas rachadas,
// carros enferrujados, postes tortos e um largo com o chafariz seco no meio. A avenida que vem do
// Refúgio de Guarapiranga entra pelo oeste. Por enquanto sem monstros (eles chegam no passo 3) e com
// os tiles que já existem; o passo 2 traz arte nova (prédios, sucata, fios, lojas).
//
// Como o gerador do Refúgio, este script NÃO sobrescreve um mapa existente sem --force
// (para comparar: npm run gen:santo-amaro -- --out outro.tmj)

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GameMap, type TiledMap } from '../src/shared/map';
import { findPath } from '../src/shared/pathfind';
import { MapBuilder } from './map-builder';
import { TILES } from './tileset';

const outIndex = process.argv.indexOf('--out');
const OUT = path.resolve(outIndex !== -1 && process.argv[outIndex + 1] ? process.argv[outIndex + 1]! : 'public/assets/maps/santo-amaro.tmj');
if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`O mapa ${path.relative(process.cwd(), OUT)} já existe (e pode ter edições feitas no Tiled).`);
  console.error('Para gerar de novo e PERDER essas edições, rode: npm run gen:santo-amaro -- --force');
  process.exit(1);
}

const W = 80;
const H = 60;
const ZONE_NAME = 'Ruínas de Santo Amaro';
/** A avenida que vem do Refúgio (3 tiles de largura). */
const AVENUE_Y = 25;
/** Ruas: começo de cada uma (todas com 3 tiles de largura). */
const STREETS_X = [18, 40, 62];
const STREETS_Y = [10, AVENUE_Y, 42];
/** O largo, com o chafariz seco no meio. */
const PLAZA = { x0: 33, y0: 14, x1: 49, y1: 22 };
const FOUNTAIN = { x: 41, y: 17 };
/** Quem chega do Refúgio aparece aqui; a saída de volta fica na borda oeste. */
const ARRIVAL = { x: 3, y: 26 };
const WEST_EXIT = { x: 0, y: 22, w: 1, h: 9 };

const m = new MapBuilder(W, H, 20261111);
const overgrowth = m.noise(9);
const crack = m.noise(4);
const border = m.noise(6);

const inPlaza = (x: number, y: number) => x >= PLAZA.x0 && x <= PLAZA.x1 && y >= PLAZA.y0 && y <= PLAZA.y1;
const inStreet = (x: number, y: number) =>
  STREETS_X.some((sx) => x >= sx && x <= sx + 2 && y >= 5 && y <= H - 6 && !inPlaza(x, y)) ||
  STREETS_Y.some((sy) => y >= sy && y <= sy + 2 && x >= (sy === AVENUE_Y ? 0 : 4) && x <= W - 5);
const nearStreet = (x: number, y: number) => !inStreet(x, y) && [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => inStreet(x + dx, y + dy)));
const entrance = (x: number, y: number) => x <= 5 && y >= WEST_EXIT.y && y < WEST_EXIT.y + WEST_EXIT.h;

// 1. Chão: mato escuro tomando conta de tudo, com terra e lama onde o asfalto sumiu
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  const n = overgrowth(x, y);
  const r = m.rng();
  let key = n < 0.3 ? (r < 0.55 ? 'dirt' : 'grass_dark') : n < 0.5 ? (r < 0.3 ? 'grass' : r < 0.55 ? 'grass_tufts' : 'grass_dark') : r < 0.8 ? 'grass_dark' : 'grass_tufts';
  if (n < 0.2 && r < 0.12) key = 'mud';
  m.setGround(x, y, key, false);
});

// 2. Ruas rachadas e calçadas de concreto
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (inStreet(x, y)) m.setGround(x, y, crack(x, y) > 0.58 || m.rng() < 0.08 ? 'asphalt_cracked' : 'asphalt');
  else if (nearStreet(x, y)) m.setGround(x, y, 'stone_floor');
});

// 3. O largo: concreto, ipês nos cantos, flores e o chafariz seco
m.fill(PLAZA.x0, PLAZA.y0, PLAZA.x1, PLAZA.y1, (x, y) => {
  if (!inStreet(x, y)) m.setGround(x, y, 'stone_floor');
});
m.setDecor(FOUNTAIN.x, FOUNTAIN.y, 'well');
for (const [x, y] of [
  [PLAZA.x0 + 1, PLAZA.y0 + 1],
  [PLAZA.x1 - 1, PLAZA.y0 + 1],
  [PLAZA.x0 + 1, PLAZA.y1 - 2],
  [PLAZA.x1 - 1, PLAZA.y1 - 2],
] as const) {
  m.setDecor(x, y, m.rng() < 0.5 ? 'ipe_yellow' : 'ipe_pink');
}
m.fill(PLAZA.x0 + 2, PLAZA.y0 + 2, PLAZA.x1 - 2, PLAZA.y1 - 2, (x, y) => {
  const d = Math.abs(x - FOUNTAIN.x) + Math.abs(y - FOUNTAIN.y);
  if (d >= 3 && d <= 4 && m.rng() < 0.45) m.setDecor(x, y, m.pick(['flowers_red', 'flowers_yellow', 'flowers_white']));
});

// 4. Prédios caídos em cada quarteirão: paredes quebradas (algumas pichadas), entulho e mato por dentro
const blockXs = [4, ...STREETS_X.map((x) => x + 4)];
const blockXe = [...STREETS_X.map((x) => x - 2), W - 6];
const blockYs = [6, ...STREETS_Y.map((y) => y + 4)];
const blockYe = [...STREETS_Y.map((y) => y - 2), H - 7];
const buildings: { x0: number; y0: number; x1: number; y1: number }[] = [];
for (let bx = 0; bx < blockXs.length; bx++) {
  for (let by = 0; by < blockYs.length; by++) {
    const area = { x0: blockXs[bx]!, y0: blockYs[by]!, x1: blockXe[bx]!, y1: blockYe[by]! };
    const overlapsPlaza = area.x0 <= PLAZA.x1 && area.x1 >= PLAZA.x0 && area.y0 <= PLAZA.y1 && area.y1 >= PLAZA.y0;
    if (overlapsPlaza || area.x1 - area.x0 < 6 || area.y1 - area.y0 < 4) continue;
    for (let attempt = 0, placed = 0; attempt < 12 && placed < 3; attempt++) {
      const w = 5 + Math.floor(m.rng() * Math.min(8, area.x1 - area.x0 - 3));
      const h = 4 + Math.floor(m.rng() * Math.min(5, area.y1 - area.y0 - 2));
      const x0 = area.x0 + Math.floor(m.rng() * Math.max(1, area.x1 - area.x0 - w + 1));
      const y0 = area.y0 + Math.floor(m.rng() * Math.max(1, area.y1 - area.y0 - h + 1));
      const b = { x0, y0, x1: Math.min(area.x1, x0 + w - 1), y1: Math.min(area.y1, y0 + h - 1) };
      if (b.x1 - b.x0 < 4 || b.y1 - b.y0 < 3) continue;
      if (buildings.some((o) => b.x0 - 1 <= o.x1 && b.x1 + 1 >= o.x0 && b.y0 - 1 <= o.y1 && b.y1 + 1 >= o.y0)) continue;
      buildings.push(b);
      placed++;
    }
  }
}
for (const b of buildings) {
  // porta garantida: um buraco de 2 tiles no meio de um lado (sorteado)
  const side = Math.floor(m.rng() * 4);
  const midX = (b.x0 + b.x1) >> 1;
  const midY = (b.y0 + b.y1) >> 1;
  const door = (x: number, y: number) =>
    (side === 0 && y === b.y0 && (x === midX || x === midX + 1)) ||
    (side === 1 && y === b.y1 && (x === midX || x === midX + 1)) ||
    (side === 2 && x === b.x0 && (y === midY || y === midY + 1)) ||
    (side === 3 && x === b.x1 && (y === midY || y === midY + 1));
  m.fill(b.x0, b.y0, b.x1, b.y1, (x, y) => {
    m.setGround(x, y, 'stone_floor');
    const wall = x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1;
    if (wall) {
      if (!door(x, y) && m.rng() > 0.2) m.setDecor(x, y, m.rng() < 0.25 ? 'ruin_wall_graffiti' : 'ruin_wall');
      return;
    }
    const r = m.rng();
    if (r < 0.07) m.setDecor(x, y, 'rock');
    else if (r < 0.08) m.setDecor(x, y, 'bones');
    else if (r < 0.13) m.setDecor(x, y, m.pick(['bush', 'tree']));
    else if (r < 0.25) m.setDecor(x, y, 'tall_grass');
  });
}

// 5. Carros enferrujados nas beiradas das ruas e postes tortos nas calçadas
for (const sy of STREETS_Y) {
  for (let x = 6; x < W - 8; x++) {
    const crossing = STREETS_X.some((sx) => x >= sx - 2 && x <= sx + 4);
    if (crossing || m.rng() > 0.05) continue;
    const y = sy + (m.rng() < 0.5 ? 0 : 2); // nunca no meio: sempre sobra uma faixa livre
    if (m.hasDecor(x, y) || m.hasDecor(x + 1, y)) continue;
    m.setDecor(x, y, 'car_left');
    m.setDecor(x + 1, y, 'car_right');
    x += 6;
  }
}
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (!nearStreet(x, y) || entrance(x, y) || m.hasDecor(x, y)) return;
  if ((x + y * 3) % 9 === 0 && m.rng() < 0.6) m.setDecor(x, y, 'lamp_post');
});

// 6. A mata voltando: quarteirões sem prédio viram bosque, e a borda do mapa é mata fechada
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (m.isReserved(x, y) || m.hasDecor(x, y) || entrance(x, y)) return;
  const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
  const thick = 2 + Math.round(border(x, y) * 3);
  const r = m.rng();
  if (edge < thick) {
    m.setDecor(x, y, r < 0.55 ? 'tree' : r < 0.9 ? 'pine' : 'ipe_yellow');
  } else if (overgrowth(x, y) > 0.66 && r < 0.45) {
    m.setDecor(x, y, r < 0.25 ? 'tree' : r < 0.35 ? 'pine' : 'bush');
  } else if (r < 0.06) {
    m.setDecor(x, y, 'tall_grass');
  } else if (r < 0.075) {
    m.setDecor(x, y, 'rock');
  }
});

// 7. Poças onde o chão afundou
for (let i = 0; i < 6; i++) {
  const x = 6 + Math.floor(m.rng() * (W - 12));
  const y = 6 + Math.floor(m.rng() * (H - 12));
  if (m.isReserved(x, y) || m.isReserved(x + 1, y + 1)) continue;
  m.fill(x, y, x + 1, y + 1, (px, py) => {
    m.setGround(px, py, 'water');
    m.setDecor(px, py, null);
  });
}

// 8. A entrada (vindo do Refúgio) fica sempre livre
m.fill(0, WEST_EXIT.y, 5, WEST_EXIT.y + WEST_EXIT.h - 1, (x, y) => {
  m.setDecor(x, y, null);
  if (!inStreet(x, y)) m.setGround(x, y, 'grass');
});

const map = m.toTiled({
  properties: [
    { name: 'nome', type: 'string', value: ZONE_NAME },
    { name: 'seguro', type: 'bool', value: false },
    { name: 'renascerEm', type: 'string', value: 'refugio' },
  ],
  points: [
    { name: 'spawn', ...ARRIVAL },
    { name: 'oeste', ...ARRIVAL },
  ],
  monsters: [],
  exits: [
    {
      name: 'Refúgio de Guarapiranga',
      ...WEST_EXIT,
      properties: [
        { name: 'mapa', type: 'string', value: 'refugio' },
        { name: 'chegada', type: 'string', value: 'leste' },
      ],
    },
  ],
});

// 9. Confere se dá para chegar a pé nos lugares importantes
const game = GameMap.fromTiled(map as unknown as TiledMap, 'santo-amaro');
const checkpoints: Record<string, { x: number; y: number }> = {
  'saída para o Refúgio': { x: 0, y: AVENUE_Y + 1 },
  'largo do chafariz': { x: FOUNTAIN.x, y: FOUNTAIN.y + 2 },
  'fim da avenida (leste)': { x: W - 6, y: AVENUE_Y + 1 },
};
for (const sx of STREETS_X) {
  checkpoints[`rua x=${sx} (norte)`] = { x: sx + 1, y: 6 };
  checkpoints[`rua x=${sx} (sul)`] = { x: sx + 1, y: H - 7 };
}
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
const used = new Set([...m.ground, ...m.decor].filter(Boolean));
console.log(`mapa "${ZONE_NAME}" salvo em ${path.relative(process.cwd(), OUT)} (${W}x${H}, ${buildings.length} prédios, ${used.size} de ${TILES.length} tiles usados)`);
