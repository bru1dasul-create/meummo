// Gera o mapa das Ruínas de Santo Amaro em public/assets/maps/santo-amaro.tmj.
//
// O antigo centro comercial virou um labirinto de prédios caídos tomados pela mata. Quarteirões de
// prédios mortos (lajes rachadas, janelas quebradas, portas de aço de lojas que fecharam para sempre),
// prédios que desabaram e viraram clareiras de entulho, sucata e ervas de cura, ruas rachadas com
// carros e um ônibus enferrujados, postes com fios caídos, poças de óleo. No meio, o largo com o
// chafariz seco e os ipês — a única cor forte do lugar. A avenida do Refúgio entra pelo oeste.
// Por enquanto sem monstros: eles chegam no passo 3 (os prédios desabados são bons lugares para eles).
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

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const m = new MapBuilder(W, H, 20261112);
const overgrowth = m.noise(9);
const crack = m.noise(4);
const border = m.noise(6);

const inPlaza = (x: number, y: number) => x >= PLAZA.x0 && x <= PLAZA.x1 && y >= PLAZA.y0 && y <= PLAZA.y1;
const inStreet = (x: number, y: number) =>
  STREETS_X.some((sx) => x >= sx && x <= sx + 2 && y >= 5 && y <= H - 6 && !inPlaza(x, y)) ||
  STREETS_Y.some((sy) => y >= sy && y <= sy + 2 && x >= (sy === AVENUE_Y ? 0 : 4) && x <= W - 5);
const nearStreet = (x: number, y: number) => !inStreet(x, y) && [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => inStreet(x + dx, y + dy)));
const entrance = (x: number, y: number) => x <= 5 && y >= WEST_EXIT.y && y < WEST_EXIT.y + WEST_EXIT.h;
const edgeDistance = (x: number, y: number) => Math.min(x, y, W - 1 - x, H - 1 - y);

// 1. Chão: concreto velho e mato escuro (onde a cidade sumiu de vez, perto da borda, é só mato)
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  const n = overgrowth(x, y);
  const r = m.rng();
  const wild = edgeDistance(x, y) < 6 || n > 0.68;
  let key: string;
  if (wild) key = r < 0.7 ? 'grass_gloom' : r < 0.85 ? 'grass_dark' : 'dirt';
  else key = n > 0.5 ? (r < 0.5 ? 'concrete_moss' : r < 0.6 ? 'concrete_cracked' : 'grass_gloom') : r < 0.7 ? 'concrete' : r < 0.84 ? 'concrete_moss' : r < 0.95 ? 'concrete_cracked' : 'dirt';
  if (n < 0.2 && r < 0.06) key = 'mud';
  m.setGround(x, y, key, false);
});

// 2. Ruas bem rachadas (com bueiros) e calçadas de concreto (com poças de óleo velho)
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (inStreet(x, y)) {
    const r = m.rng();
    m.setGround(x, y, crack(x, y) > 0.5 || r < 0.15 ? 'asphalt_cracked' : r < 0.17 ? 'manhole' : 'asphalt');
  } else if (nearStreet(x, y)) {
    const r = m.rng();
    m.setGround(x, y, r < 0.2 ? 'concrete_moss' : r < 0.3 ? 'concrete_cracked' : r < 0.33 ? 'oil_puddle' : 'concrete');
  }
});

// 3. O largo: concreto, ipês nos cantos (a cor forte do lugar), ervas de cura em volta do chafariz seco
m.fill(PLAZA.x0, PLAZA.y0, PLAZA.x1, PLAZA.y1, (x, y) => {
  if (!inStreet(x, y)) m.setGround(x, y, m.rng() < 0.15 ? 'concrete_moss' : m.rng() < 0.12 ? 'concrete_cracked' : 'concrete');
});
m.setDecor(FOUNTAIN.x, FOUNTAIN.y, 'well');
for (const [x, y] of [
  [PLAZA.x0 + 1, PLAZA.y0 + 1],
  [PLAZA.x1 - 1, PLAZA.y0 + 1],
  [PLAZA.x0 + 1, PLAZA.y1 - 2],
  [PLAZA.x1 - 1, PLAZA.y1 - 2],
  [PLAZA.x0 + 4, PLAZA.y1 - 1],
  [PLAZA.x1 - 4, PLAZA.y0 + 1],
] as const) {
  m.setDecor(x, y, m.rng() < 0.5 ? 'ipe_yellow' : 'ipe_pink');
}
for (const [x, y] of [
  [PLAZA.x0 + 6, PLAZA.y0 + 2],
  [PLAZA.x1 - 6, PLAZA.y1 - 2],
] as const) {
  m.setDecor(x, y, 'dead_tree');
}
m.fill(PLAZA.x0 + 2, PLAZA.y0 + 2, PLAZA.x1 - 2, PLAZA.y1 - 2, (x, y) => {
  const d = Math.abs(x - FOUNTAIN.x) + Math.abs(y - FOUNTAIN.y);
  if (d >= 2 && d <= 3 && m.rng() < 0.55) m.setDecor(x, y, m.rng() < 0.7 ? 'herbs' : 'flowers_yellow');
});
m.fill(PLAZA.x0, PLAZA.y0, PLAZA.x1, PLAZA.y1, (x, y) => m.reserve(x, y));

// 4. Os quarteirões: prédios mortos (laje + fachada com janelas e lojas) e prédios que desabaram
const blockXs = [4, ...STREETS_X.map((x) => x + 4)];
const blockXe = [...STREETS_X.map((x) => x - 2), W - 6];
const blockYs = [6, ...STREETS_Y.map((y) => y + 4)];
const blockYe = [...STREETS_Y.map((y) => y - 2), H - 7];
const standing: Rect[] = [];
const collapsed: Rect[] = [];

/** Divide o quarteirão em lotes (com becos de 2 tiles entre eles), sem pegar o largo. */
function lots(block: Rect): Rect[] {
  const pieces: Rect[] = [];
  const width = block.x1 - block.x0 + 1;
  if (width >= 15) {
    const split = block.x0 + 5 + Math.floor(m.rng() * (width - 12));
    pieces.push({ ...block, x1: split - 1 }, { ...block, x0: split + 2 });
  } else {
    pieces.push(block);
  }
  return pieces.filter((r) => r.x1 - r.x0 >= 4 && !(r.x0 <= PLAZA.x1 && r.x1 >= PLAZA.x0 && r.y0 <= PLAZA.y1 && r.y1 >= PLAZA.y0));
}

for (let bx = 0; bx < blockXs.length; bx++) {
  for (let by = 0; by < blockYs.length; by++) {
    let block: Rect = { x0: blockXs[bx]!, y0: blockYs[by]!, x1: blockXe[bx]!, y1: blockYe[by]! };
    // o largo come um pedaço dos quarteirões do meio: o que sobra vira prédio
    if (block.x0 <= PLAZA.x1 && block.x1 >= PLAZA.x0 && block.y0 <= PLAZA.y1 && block.y1 >= PLAZA.y0) {
      block = block.x0 < PLAZA.x0 ? { ...block, x1: PLAZA.x0 - 2 } : { ...block, x0: PLAZA.x1 + 2 };
    }
    for (const lot of lots(block)) {
      const height = lot.y1 - lot.y0 + 1;
      if (height < 3) continue;
      // às vezes sobra um quintal de mato em cima ou embaixo do prédio
      const yard = height >= 7 && m.rng() < 0.5 ? 1 + Math.floor(m.rng() * 2) : 0;
      const rect = m.rng() < 0.5 ? { ...lot, y0: lot.y0 + yard } : { ...lot, y1: lot.y1 - yard };
      (m.rng() < 0.3 && rect.y1 - rect.y0 >= 3 ? collapsed : standing).push(rect);
    }
  }
}

for (const b of standing) {
  m.fill(b.x0, b.y0, b.x1, b.y1, (x, y) => {
    m.setGround(x, y, 'concrete');
    if (y < b.y1) {
      m.setDecor(x, y, m.rng() < 0.13 ? 'building_top_broken' : 'building_top');
      return;
    }
    // a fachada fica embaixo; de frente para a rua, muitas lojas fechadas
    const onStreet = nearStreet(x, y + 1) || inStreet(x, y + 1);
    const r = m.rng();
    m.setDecor(
      x,
      y,
      onStreet ? (r < 0.4 ? 'shop_shutter' : r < 0.75 ? 'building_window' : r < 0.88 ? 'vine_wall' : 'building_wall') : r < 0.5 ? 'building_window' : r < 0.75 ? 'vine_wall' : 'building_wall',
    );
  });
  // um canto desabado: entulho em cima da laje
  if (m.rng() < 0.6) {
    const cx = m.rng() < 0.5 ? b.x0 : b.x1;
    for (const [x, y] of [[cx, b.y0], [cx + (cx === b.x0 ? 1 : -1), b.y0], [cx, b.y0 + 1]] as const) {
      if (y < b.y1) {
        m.setDecor(x, y, 'rubble');
        m.setGround(x, y, 'concrete_moss');
      }
    }
  }
}

for (const b of collapsed) {
  // entrada garantida: um buraco de 2 tiles no meio de um dos lados
  const side = Math.floor(m.rng() * 4);
  const midX = (b.x0 + b.x1) >> 1;
  const midY = (b.y0 + b.y1) >> 1;
  const door = (x: number, y: number) =>
    (side === 0 && y === b.y0 && (x === midX || x === midX + 1)) ||
    (side === 1 && y === b.y1 && (x === midX || x === midX + 1)) ||
    (side === 2 && x === b.x0 && (y === midY || y === midY + 1)) ||
    (side === 3 && x === b.x1 && (y === midY || y === midY + 1));
  m.fill(b.x0, b.y0, b.x1, b.y1, (x, y) => {
    const g = m.rng();
    m.setGround(x, y, g < 0.45 ? 'concrete_moss' : g < 0.7 ? 'concrete_cracked' : g < 0.85 ? 'grass_gloom' : 'concrete');
    const wall = x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1;
    const r = m.rng();
    if (wall) {
      if (!door(x, y) && r < 0.55) m.setDecor(x, y, r < 0.12 ? 'ruin_wall_graffiti' : r < 0.42 ? 'ruin_wall' : 'rubble');
      return;
    }
    if (r < 0.1) m.setDecor(x, y, 'rubble');
    else if (r < 0.14) m.setDecor(x, y, 'scrap');
    else if (r < 0.17) m.setDecor(x, y, 'tires');
    else if (r < 0.24) m.setDecor(x, y, 'herbs');
    else if (r < 0.27) m.setDecor(x, y, 'dead_tree');
    else if (r < 0.3) m.setDecor(x, y, 'tree');
    else if (r < 0.33) m.setDecor(x, y, 'wires');
    else if (r < 0.34) m.setDecor(x, y, 'bones');
    else if (r < 0.44) m.setDecor(x, y, 'tall_grass');
  });
}
for (const b of [...standing, ...collapsed]) m.fill(b.x0, b.y0, b.x1, b.y1, (x, y) => m.reserve(x, y));

// 5. Nas ruas: carros e um ônibus enferrujados (sempre sobra uma faixa livre), postes com fios caídos
const busY = AVENUE_Y + 2;
const busX = 48 + Math.floor(m.rng() * 6);
m.setDecor(busX, busY, 'bus_left');
m.setDecor(busX + 1, busY, 'bus_middle');
m.setDecor(busX + 2, busY, 'bus_right');
for (const sy of STREETS_Y) {
  for (let x = 6; x < W - 8; x++) {
    const crossing = STREETS_X.some((sx) => x >= sx - 2 && x <= sx + 4);
    if (crossing || m.rng() > 0.06) continue;
    const y = sy + (m.rng() < 0.5 ? 0 : 2);
    if (m.hasDecor(x, y) || m.hasDecor(x + 1, y) || m.hasDecor(x - 1, y) || m.hasDecor(x + 2, y)) continue;
    m.setDecor(x, y, 'car_left');
    m.setDecor(x + 1, y, 'car_right');
    x += 6;
  }
}
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (entrance(x, y) || m.hasDecor(x, y)) return;
  if (nearStreet(x, y)) {
    if ((x + y * 3) % 8 === 0 && m.rng() < 0.7) m.setDecor(x, y, m.rng() < 0.55 ? 'pole_wires' : 'lamp_post');
    else if (m.rng() < 0.025) m.setDecor(x, y, m.pick(['rubble', 'tires', 'scrap']));
  } else if (inStreet(x, y) && m.rng() < 0.02) {
    m.setDecor(x, y, 'wires');
  }
});

// 6. A mata voltando: quintais e beiradas viram mato, e a borda do mapa é mata fechada (com árvores secas)
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (m.isReserved(x, y) || m.hasDecor(x, y) || entrance(x, y)) return;
  const edge = edgeDistance(x, y);
  const thick = 2 + Math.round(border(x, y) * 3);
  const r = m.rng();
  if (edge < thick) {
    m.setDecor(x, y, r < 0.45 ? 'tree' : r < 0.78 ? 'pine' : r < 0.93 ? 'dead_tree' : 'ipe_yellow');
  } else if (overgrowth(x, y) > 0.64 && r < 0.4) {
    m.setDecor(x, y, r < 0.18 ? 'tree' : r < 0.26 ? 'dead_tree' : r < 0.32 ? 'pine' : 'bush');
  } else if (r < 0.05) {
    m.setDecor(x, y, 'tall_grass');
  } else if (r < 0.07) {
    m.setDecor(x, y, m.rng() < 0.6 ? 'herbs' : 'rock');
  }
});

// 7. A entrada (vindo do Refúgio) fica sempre livre
m.fill(0, WEST_EXIT.y, 5, WEST_EXIT.y + WEST_EXIT.h - 1, (x, y) => {
  m.setDecor(x, y, null);
  if (!inStreet(x, y)) m.setGround(x, y, 'grass_gloom');
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

// 8. Confere se dá para chegar a pé nos lugares importantes (e dentro dos prédios desabados)
const game = GameMap.fromTiled(map as unknown as TiledMap, 'santo-amaro');
const reach = (x: number, y: number) => findPath(game, ARRIVAL.x, ARRIVAL.y, x, y, W * H * 2) !== null;
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
  if (!reach(p.x, p.y)) {
    console.error(`ERRO: não dá para chegar em "${label}" (${p.x}, ${p.y})`);
    ok = false;
  }
}
const openRuins = collapsed.filter((b) => {
  const inside = game.nearestWalkable((b.x0 + b.x1) >> 1, (b.y0 + b.y1) >> 1, 3);
  return inside && reach(inside.x, inside.y);
});
if (openRuins.length < 3) {
  console.error(`ERRO: só ${openRuins.length} prédios desabados dá para entrar (precisa de 3, para os monstros do passo 3)`);
  ok = false;
}
if (!ok) process.exit(1);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(map));
const used = new Set([...m.ground, ...m.decor].filter(Boolean));
console.log(
  `mapa "${ZONE_NAME}" salvo em ${path.relative(process.cwd(), OUT)} (${W}x${H}, ${standing.length} prédios de pé, ` +
    `${collapsed.length} desabados — ${openRuins.length} com entrada; ${used.size} de ${TILES.length} tiles usados)`,
);
console.log('prédios desabados (para as áreas de monstros):', openRuins.map((b) => `${b.x0},${b.y0}-${b.x1},${b.y1}`).join('  '));
