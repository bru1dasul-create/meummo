// Gera o mapa do Terminal Santo Amaro em public/assets/maps/terminal-santo-amaro.tmj.
//
// O terminal de ônibus de Santo Amaro, anos depois do fim: as plataformas cobertas (A, B, C e D) continuam de pé,
// com a cobertura de concreto furada e cheia de cipó; nas pistas entre elas, ônibus enferrujados que nunca mais
// saíram. Na entrada, a calçada larga com canteiros, as catracas e a bilheteria; no fundo, a parte que desabou e
// virou mato, onde alguém ainda acende fogo nos tambores. Chega-se pela rua do meio de Santo Amaro, descendo
// para o sul. Criaturas (as que já existem): Corpo-Seco nas plataformas e Capelobo no fundo.
//
// Como os outros geradores, este script NÃO sobrescreve um mapa existente sem --force
// (para comparar: npm run gen:terminal -- --out outro.tmj)

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GameMap, type TiledMap } from '../src/shared/map';
import { findPath } from '../src/shared/pathfind';
import { MapBuilder, type AreaObject } from './map-builder';
import { gid, TILES } from './tileset';

const outIndex = process.argv.indexOf('--out');
const OUT = path.resolve(outIndex !== -1 && process.argv[outIndex + 1] ? process.argv[outIndex + 1]! : 'public/assets/maps/terminal-santo-amaro.tmj');
if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`O mapa ${path.relative(process.cwd(), OUT)} já existe (e pode ter edições feitas no Tiled).`);
  console.error('Para gerar de novo e PERDER essas edições, rode: npm run gen:terminal -- --force');
  process.exit(1);
}

const W = 64;
const H = 48;
const ZONE_NAME = 'Terminal Santo Amaro';
/** Quem desce de Santo Amaro aparece aqui; a saída de volta fica na borda de cima. */
const ARRIVAL = { x: 32, y: 2 };
const NORTH_EXIT = { x: 30, y: 0, w: 5, h: 1 };
/**
 * As plataformas: cada uma tem 4 fileiras — a de trás fica embaixo da cobertura (camada "acima"), depois os pilares
 * que seguram a cobertura e os bancos, a passagem e a beirada com a faixa amarela — e uma pista de 4 embaixo.
 */
const PLATFORMS = [
  { y: 11, letter: 'a' },
  { y: 19, letter: 'b' },
  { y: 27, letter: 'c' },
  { y: 35, letter: 'd' },
];
const PX0 = 6;
const PX1 = 57;
/** As faixas de pedestre atravessando as pistas (aí não para ônibus). */
const CROSSWALKS = [20, 21, 42, 43];
const WALL_Y = 9;
/** Ruas dos lados, ligando todas as pistas. */
const SIDE_ROADS = [
  [2, 4],
  [59, 61],
] as const;

const m = new MapBuilder(W, H, 20261130);
const growth = m.noise(6);
const asphalt = () => (m.rng() < 0.4 ? 'asphalt_cracked' : 'asphalt');
const inSideRoad = (x: number) => SIDE_ROADS.some(([a, b]) => x >= a && x <= b);

// 1. Chão: mato escuro em volta; a rua que vem de Santo Amaro; a calçada larga da entrada (com canteiros)
m.fill(0, 0, W - 1, H - 1, (x, y) => m.setGround(x, y, m.rng() < 0.75 ? 'grass_gloom' : 'grass_dark', false));
m.fill(NORTH_EXIT.x - 1, 0, NORTH_EXIT.x + NORTH_EXIT.w, 4, (x, y) => m.setGround(x, y, asphalt()));
m.fill(3, 4, W - 4, WALL_Y - 1, (x, y) => {
  if (x >= NORTH_EXIT.x - 1 && x <= NORTH_EXIT.x + NORTH_EXIT.w && y <= 4) return;
  m.setGround(x, y, m.rng() < 0.2 ? 'concrete_cracked' : m.rng() < 0.2 ? 'concrete_moss' : 'concrete');
});

// 2. O muro da entrada, com as catracas no meio e dois buracos nos lados; a bilheteria do lado das catracas
m.fill(3, WALL_Y, W - 4, WALL_Y, (x, y) => {
  m.setGround(x, y, 'concrete');
  const turnstiles = x >= 28 && x <= 36;
  const broken = (x >= 10 && x <= 11) || (x >= 52 && x <= 53);
  if (turnstiles) {
    if (x % 2 === 0) m.setDecor(x, y, 'turnstile'); // passa-se entre uma catraca e outra
  } else if (!broken) {
    m.setDecor(x, y, m.rng() < 0.2 ? 'ruin_wall_graffiti' : 'ruin_wall');
  }
  m.reserve(x, y);
});
m.setDecor(24, WALL_Y - 1, 'ticket_booth_left');
m.setDecor(25, WALL_Y - 1, 'ticket_booth_right');
m.depth.shadeBlock(24, WALL_Y - 1, 25, WALL_Y - 1, (x, y) => !m.hasDecor(x, y));

// 3. As ruas dos lados e as pistas entre as plataformas
for (const [a, b] of SIDE_ROADS) m.fill(a, WALL_Y + 1, b, H - 4, (x, y) => m.setGround(x, y, asphalt()));
m.fill(PX0 - 1, WALL_Y + 1, PX1 + 1, WALL_Y + 1, (x, y) => m.setGround(x, y, 'platform_floor')); // calçada embaixo do muro
for (const { y: py } of PLATFORMS) {
  m.fill(SIDE_ROADS[0][1] + 1, py + 4, SIDE_ROADS[1][0] - 1, py + 7, (x, y) => {
    if (y >= H - 4) return;
    m.setGround(x, y, CROSSWALKS.includes(x) ? 'crosswalk' : asphalt());
  });
}

// 4. As plataformas: piso, beirada com a faixa amarela, pilares e bancos embaixo da cobertura (camada "acima")
for (const [index, { y: py, letter }] of PLATFORMS.entries()) {
  const ruined = index === PLATFORMS.length - 1; // a última plataforma é a que mais sofreu
  m.fill(PX0, py, PX1, py + 3, (x, y) => m.setGround(x, y, y === py + 3 ? 'platform_edge' : 'platform_floor'));
  for (let x = PX0; x <= PX1; x++) {
    const holeChance = ruined ? 0.35 : 0.07;
    if (!(ruined && m.rng() < 0.15)) {
      // cobertura: uma fileira, com a faixa pintada na frente (a letra no começo, no meio e no fim); os furos
      // deixam ver o chão embaixo
      const lettered = x === PX0 + 3 || x === Math.floor((PX0 + PX1) / 2) || x === PX1 - 3;
      const hole = !lettered && m.rng() < holeChance;
      m.depth.above[m.idx(x, py)] = gid(hole ? 'terminal_roof_hole' : lettered ? `terminal_roof_front_${letter}` : 'terminal_roof_front');
    }
    const pillar = (x - PX0) % 6 === 2;
    if (pillar) m.setDecor(x, py + 1, m.rng() < 0.35 ? 'pillar_vines' : 'pillar');
    else if ((x - PX0) % 6 === 4 && !CROSSWALKS.includes(x) && m.rng() < 0.7) m.setDecor(x, py + 1, 'bench');
    if (ruined && !pillar && !m.hasDecor(x, py + 1) && m.rng() < 0.12) m.setDecor(x, py + 2, 'rubble');
  }
}

// 5. Ônibus enferrujados parados nas pistas (nunca em cima das faixas de pedestre)
let buses = 0;
for (const { y: py } of PLATFORMS) {
  const laneY = py + 5 + (m.rng() < 0.5 ? 0 : 1);
  if (laneY >= H - 4) continue;
  for (let tries = 0, parked = 0; tries < 60 && parked < 3; tries++) {
    const x = SIDE_ROADS[0][1] + 2 + Math.floor(m.rng() * (SIDE_ROADS[1][0] - SIDE_ROADS[0][1] - 6));
    const cells = [x, x + 1, x + 2];
    if (cells.some((cx) => CROSSWALKS.includes(cx) || m.hasDecor(cx, laneY) || m.hasDecor(cx - 1, laneY) || m.hasDecor(cx + 1, laneY))) continue;
    m.setDecor(x, laneY, 'bus_left');
    m.setDecor(x + 1, laneY, 'bus_middle');
    m.setDecor(x + 2, laneY, 'bus_right');
    parked++;
    buses++;
  }
}

// 6. O fundo desabou e virou mato: entulho, árvores secas, e um acampamento com tambores de fogo
const backY0 = PLATFORMS[PLATFORMS.length - 1]!.y + 4; // o fundo: da última beirada até a mata da borda
m.fill(SIDE_ROADS[0][1] + 1, backY0, SIDE_ROADS[1][0] - 1, H - 4, (x, y) => {
  if (m.hasDecor(x, y)) return;
  m.setGround(x, y, growth(x, y) > 0.55 ? 'grass_gloom' : m.rng() < 0.4 ? 'concrete_cracked' : 'asphalt_cracked', false);
  const r = m.rng();
  if (r < 0.05) m.setDecor(x, y, 'rubble');
  else if (r < 0.07) m.setDecor(x, y, 'dead_tree');
  else if (r < 0.09) m.setDecor(x, y, 'tires');
  else if (r < 0.14) m.setDecor(x, y, 'tall_grass');
  else if (r < 0.155) m.setDecor(x, y, 'bones');
});
// um ônibus que tombou de lado no fundo, e árvores crescendo onde a laje caiu
m.setDecor(12, backY0 + 3, 'bus_left');
m.setDecor(13, backY0 + 3, 'bus_middle');
m.setDecor(14, backY0 + 3, 'bus_right');
for (const [x, y] of [
  [20, backY0 + 4],
  [44, backY0 + 3],
  [52, backY0 + 5],
] as const) {
  m.depth.plantBigTree(m.rng() < 0.5 ? 'tree_big' : 'dead_tree_big', x, y, () => true);
}
for (const [x, y] of [
  [30, backY0 + 2],
  [34, backY0 + 1],
] as const) {
  m.setDecor(x, y, 'fire_barrel');
}
m.setDecor(32, backY0 + 2, 'embers');

// 7. O mato voltando: tufos e ervas nas rachaduras, cipó, fios e sucata; a borda do mapa é mata fechada
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (m.hasDecor(x, y) || m.isReserved(x, y)) return;
  const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
  const entry = x >= NORTH_EXIT.x - 1 && x <= NORTH_EXIT.x + NORTH_EXIT.w && y <= 4;
  if (edge < 2 && !entry) {
    m.setDecor(x, y, m.rng() < 0.6 ? 'thicket' : 'bush');
    return;
  }
  const r = m.rng();
  const onFloor = m.groundIs(x, y, 'platform_floor', 'asphalt', 'asphalt_cracked', 'concrete', 'concrete_cracked', 'concrete_moss');
  if (onFloor && growth(x, y) > 0.62 && r < 0.25) m.setDecor(x, y, r < 0.12 ? 'tall_grass' : 'herbs');
  else if (onFloor && r < 0.012) m.setDecor(x, y, m.pick(['wires', 'scrap', 'rubble']));
  else if (!onFloor && !m.groundIs(x, y, 'crosswalk', 'platform_edge') && r < 0.06) m.setDecor(x, y, 'tall_grass');
});
// árvores no mato em volta da calçada da entrada (de cada lado da rua que vem de Santo Amaro)
for (const [x, y] of [
  [6, 6],
  [12, 5],
  [18, 6],
  [44, 6],
  [50, 5],
  [56, 6],
] as const) {
  m.depth.plantBigTree(m.rng() < 0.5 ? 'tree_big' : 'dead_tree_big', x, y, () => true);
}
for (const [x, y] of [
  [14, 7],
  [48, 7],
] as const) {
  if (!m.hasDecor(x, y)) m.setDecor(x, y, 'fire_barrel');
}

// 8. Áreas das criaturas (as que já existem): Corpo-Seco nas plataformas, Capelobo no fundo
const areas: AreaObject[] = [
  { name: 'corpo_seco', x: 8, y: 19, w: 20, h: 8, properties: [{ name: 'quantidade', type: 'int', value: 3 }] },
  { name: 'corpo_seco', x: 36, y: 27, w: 20, h: 8, properties: [{ name: 'quantidade', type: 'int', value: 3 }] },
  { name: 'capelobo', x: 8, y: backY0, w: 18, h: H - 4 - backY0, properties: [{ name: 'quantidade', type: 'int', value: 2 }] },
  { name: 'capelobo', x: 38, y: backY0, w: 18, h: H - 4 - backY0, properties: [{ name: 'quantidade', type: 'int', value: 2 }] },
];

const map = m.toTiled({
  properties: [
    { name: 'nome', type: 'string', value: ZONE_NAME },
    { name: 'seguro', type: 'bool', value: false },
    { name: 'renascerEm', type: 'string', value: 'refugio' },
    { name: 'neblina', type: 'float', value: 0.18 },
    { name: 'escuro', type: 'float', value: 0.12 },
  ],
  points: [
    { name: 'spawn', ...ARRIVAL },
    { name: 'norte', ...ARRIVAL },
  ],
  monsters: areas,
  exits: [
    {
      name: 'Ruínas de Santo Amaro',
      ...NORTH_EXIT,
      properties: [
        { name: 'mapa', type: 'string', value: 'santo-amaro' },
        { name: 'chegada', type: 'string', value: 'sul' },
      ],
    },
  ],
});

// 9. Confere se dá para chegar a pé nos lugares importantes
const game = GameMap.fromTiled(map as unknown as TiledMap, 'terminal-santo-amaro');
const checkpoints: Record<string, { x: number; y: number }> = { 'saída para Santo Amaro': { x: ARRIVAL.x, y: 0 } };
for (const { y, letter } of PLATFORMS) checkpoints[`plataforma ${letter.toUpperCase()}`] = { x: 30, y: y + 2 };
checkpoints['o fundo (acampamento)'] = game.nearestWalkable(32, backY0 + 3, 3) ?? { x: 32, y: backY0 + 3 };
for (const area of areas) {
  checkpoints[`área ${area.name} (${area.x},${area.y})`] = game.nearestWalkable(area.x + (area.w >> 1), area.y + (area.h >> 1), 4) ?? area;
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
const used = new Set([...m.ground, ...m.decor, ...m.depth.above, ...m.depth.shade].filter(Boolean));
console.log(
  `mapa "${ZONE_NAME}" salvo em ${path.relative(process.cwd(), OUT)} (${W}x${H}, ${PLATFORMS.length} plataformas, ${buses} ônibus; ` +
    `${used.size} de ${TILES.length} tiles usados)`,
);
