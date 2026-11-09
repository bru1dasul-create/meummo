// Gera o mapa da Represa Billings em public/assets/maps/billings.tmj.
//
// Ao sul do brejo do Refúgio, a Billings virou um labirinto de canais de água verde e ilhas de mato de brejo:
// passarelas de madeira ligando as ilhas, aguapés cobrindo a água, buritis, casas afundadas com o telhado de
// fora, a usina velha e, no meio do lago, a ponte da rodovia antiga, quebrada. No sul fica o lago aberto, com
// uma prainha de frente para a pedra onde a Iara vai cantar. Clima: neblina, vaga-lumes e um pouco escuro.
//
// Criaturas: o Jacaré Mutante nos canais do oeste e o Boto Encantado no lago das casas afundadas; e as de fora
// (jararacas nas ilhas perto da entrada, Corpo-Seco perto da usina e das casas afundadas, Capelobo nas matas da
// beira do lago). A área da Iara fica marcada na camada "lendas" (o servidor ignora; vira área de monstro quando
// ela existir).
//
// Como os outros geradores, este script NÃO sobrescreve um mapa existente sem --force
// (para comparar: npm run gen:billings -- --out outro.tmj)

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GameMap, type TiledMap } from '../src/shared/map';
import { DX, DY } from '../src/shared/dir';
import { findPath } from '../src/shared/pathfind';
import { MapBuilder, type AreaObject } from './map-builder';
import { shuffled, softenEdges, type BigTree } from './map-depth';
import { TILES } from './tileset';

const outIndex = process.argv.indexOf('--out');
const OUT = path.resolve(outIndex !== -1 && process.argv[outIndex + 1] ? process.argv[outIndex + 1]! : 'public/assets/maps/billings.tmj');
if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`O mapa ${path.relative(process.cwd(), OUT)} já existe (e pode ter edições feitas no Tiled).`);
  console.error('Para gerar de novo e PERDER essas edições, rode: npm run gen:billings -- --force');
  process.exit(1);
}

const W = 88;
const H = 64;
const ZONE_NAME = 'Represa Billings';
/** Quem chega do Refúgio (pela trilha do brejo) aparece aqui; a saída de volta fica na borda de cima. */
const ARRIVAL = { x: 44, y: 3 };
const NORTH_EXIT = { x: 41, y: 0, w: 7, h: 1 };
/** O lago (a represa aberta), no sul. */
const LAKE = { x: 44, y: 50, rx: 34, ry: 10.5 };
/** A pedra da Iara, no lago, de frente para a prainha. */
const ROCK = { x: 44, y: 43 };
/** A ponte da rodovia antiga atravessa o lago (2 faixas, com mureta dos dois lados) e caiu no meio. */
const HIGHWAY_Y = 51;
const HIGHWAY_GAP = { x0: 37, x1: 51 };

const m = new MapBuilder(W, H, 20261120);
const noiseShore = m.noise(7);
const noiseBig = m.noise(10);
const noiseWidth = m.noise(5);
const WATER = ['swamp_water', 'swamp_deep'] as const;
const isWater = (x: number, y: number) => m.groundIs(x, y, ...WATER);
const nearArrival = (x: number, y: number) => Math.abs(x - ARRIVAL.x) <= 5 && y <= ARRIVAL.y + 4;

// 1. Chão: mato de brejo, com manchas de lama
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  const r = m.rng();
  m.setGround(x, y, noiseBig(x, y) > 0.7 ? 'mud' : r < 0.75 ? 'swamp_grass' : 'swamp_grass_b', false);
});

// 2. O lago, no sul, com a margem irregular
const lakeDistance = (x: number, y: number) =>
  (((x + 0.5 - LAKE.x) / LAKE.rx) ** 2 + ((y + 0.5 - LAKE.y) / LAKE.ry) ** 2) * (0.75 + 0.5 * noiseShore(x, y));
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (lakeDistance(x, y) <= 1) m.setGround(x, y, 'swamp_water');
});

// 3. Os canais: três descendo do norte até o lago e dois atravessando de lado — as ilhas entre eles são o labirinto
const canalsNS = [
  { x: (y: number) => 19 + 4 * Math.sin(y / 6 + 0.3), from: 7, to: 44 },
  { x: (y: number) => 45 + 5 * Math.sin(y / 7 + 1.7), from: 10, to: 42 },
  { x: (y: number) => 68 + 4 * Math.sin(y / 5 + 2.4), from: 7, to: 44 },
];
const canalsEW = [
  { y: (x: number) => 18 + 3 * Math.sin(x / 7 + 0.5), from: 5, to: 82 },
  { y: (x: number) => 31 + 3 * Math.sin(x / 6 + 2.1), from: 9, to: 79 },
];
const halfWidth = (x: number, y: number) => 0.9 + noiseWidth(x, y) * 0.9; // às vezes o canal alarga num poço
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (nearArrival(x, y)) return;
  const ns = canalsNS.some((c) => y >= c.from && y <= c.to && Math.abs(x + 0.5 - c.x(y + 0.5)) < halfWidth(x, y));
  const ew = canalsEW.some((c) => x >= c.from && x <= c.to && Math.abs(y + 0.5 - c.y(x + 0.5)) < halfWidth(x, y));
  if (ns || ew) m.setGround(x, y, 'swamp_water');
});

// 4. A prainha de frente para a pedra da Iara, e a pedra no meio d'água
// (a praia acompanha a beira do lago e vai afinando nas pontas, como uma meia-lua)
m.fill(ROCK.x - 11, ROCK.y - 10, ROCK.x + 11, ROCK.y - 2, (x, y) => {
  if (isWater(x, y)) return;
  let nearest = Infinity;
  m.fill(x - 4, y - 4, x + 4, y + 4, (wx, wy) => {
    if (m.groundIs(wx, wy, 'swamp_water')) nearest = Math.min(nearest, Math.hypot(wx - x, wy - y));
  });
  const reach = 4.2 - Math.abs(x - ROCK.x) / 3 + noiseWidth(x, y);
  if (nearest <= reach) m.setGround(x, y, 'sand');
});
// a ilhota redonda e a pedra grande em cima (2x2 tiles), com taboas e uma pedrinha do lado
m.fill(ROCK.x - 3, ROCK.y - 3, ROCK.x + 3, ROCK.y + 3, (x, y) => {
  if (Math.hypot(x + 0.5 - (ROCK.x + 0.5), y + 0.5 - (ROCK.y + 0.5)) <= 2.4) m.setGround(x, y, 'sand');
});
['boulder_tl', 'boulder_tr', 'boulder_bl', 'boulder_br'].forEach((key, i) => m.setDecor(ROCK.x - 1 + (i % 2), ROCK.y - 1 + (i >> 1), key));
m.setDecor(ROCK.x + 1, ROCK.y - 1, 'reeds');
m.setDecor(ROCK.x - 2, ROCK.y + 1, 'rock');

// 5. A parte funda do lago (longe de qualquer margem)
const land: [number, number][] = [];
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (!isWater(x, y)) land.push([x, y]);
});
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (!isWater(x, y) || lakeDistance(x, y) > 1) return;
  let nearest = Infinity;
  for (const [lx, ly] of land) nearest = Math.min(nearest, (lx - x) ** 2 + (ly - y) ** 2);
  if (Math.sqrt(nearest) >= 3.5 + noiseBig(x, y) * 2) m.setGround(x, y, 'swamp_deep');
});

// 6. A ponte da rodovia: asfalto por cima do lago, mureta nos dois lados, e o vão onde ela caiu
for (let x = 0; x < W; x++) {
  if (x >= HIGHWAY_GAP.x0 && x <= HIGHWAY_GAP.x1) continue;
  const overLake = [HIGHWAY_Y, HIGHWAY_Y + 1, HIGHWAY_Y + 2, HIGHWAY_Y + 3].some((y) => isWater(x, y));
  if (!overLake) continue;
  for (let y = HIGHWAY_Y; y <= HIGHWAY_Y + 3; y++) m.setGround(x, y, m.rng() < 0.45 ? 'asphalt_cracked' : 'asphalt');
  m.setDecor(x, HIGHWAY_Y, 'ruin_wall');
  m.setDecor(x, HIGHWAY_Y + 3, m.rng() < 0.25 ? 'ruin_wall_graffiti' : 'ruin_wall');
  m.depth.shadeBlock(x, HIGHWAY_Y, x, HIGHWAY_Y + 3, (sx, sy) => isWater(sx, sy));
}
// as pontas quebradas: entulho na beirada do vão, e um carro que ficou para trás
for (const x of [HIGHWAY_GAP.x0 - 1, HIGHWAY_GAP.x1 + 1]) {
  if (m.groundIs(x, HIGHWAY_Y + 1, 'asphalt', 'asphalt_cracked')) m.setDecor(x, HIGHWAY_Y + 2, 'rubble');
}
m.setDecor(HIGHWAY_GAP.x1 + 5, HIGHWAY_Y + 1, 'car_left');
m.setDecor(HIGHWAY_GAP.x1 + 6, HIGHWAY_Y + 1, 'car_right');
m.fill(0, HIGHWAY_Y, W - 1, HIGHWAY_Y + 3, (x, y) => {
  if (m.groundIs(x, y, 'asphalt', 'asphalt_cracked')) m.reserve(x, y);
});

// 7. Passarelas de madeira ligando as ilhas: cada pedaço de terra alcança a entrada (o caminho é o labirinto)
const walkableLand = (x: number, y: number) => m.inside(x, y) && !isWater(x, y) && !m.hasDecor(x, y);
function landRegions(): Int32Array {
  const label = new Int32Array(W * H).fill(-1);
  let next = 0;
  for (let start = 0; start < W * H; start++) {
    const sx = start % W;
    const sy = Math.floor(start / W);
    if (label[start]! >= 0 || !walkableLand(sx, sy)) continue;
    const stack = [start];
    label[start] = next;
    while (stack.length > 0) {
      const cell = stack.pop()!;
      const cx = cell % W;
      const cy = Math.floor(cell / W);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (walkableLand(nx, ny) && label[m.idx(nx, ny)]! < 0) {
          label[m.idx(nx, ny)] = next;
          stack.push(m.idx(nx, ny));
        }
      }
    }
    next++;
  }
  return label;
}
interface Crossing {
  cells: [number, number][];
  a: number;
  b: number;
  horizontal: boolean;
}
/** Travessias retas de até 5 tiles de água, de uma margem a outra (em canais, não no meio do lago). */
function crossings(label: Int32Array): Crossing[] {
  const found: Crossing[] = [];
  for (const horizontal of [true, false]) {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const [dx, dy] = horizontal ? [1, 0] : [0, 1];
        const a = label[m.idx(x - dx, y - dy)]!;
        if (a < 0 || !isWater(x, y)) continue;
        const cells: [number, number][] = [];
        let cx = x;
        let cy = y;
        while (m.inside(cx, cy) && isWater(cx, cy) && cells.length <= 5) {
          cells.push([cx, cy]);
          cx += dx;
          cy += dy;
        }
        if (cells.length > 5 || !m.inside(cx, cy)) continue;
        const b = label[m.idx(cx, cy)]!;
        if (b < 0 || b === a || cells.some(([wx, wy]) => lakeDistance(wx, wy) <= 0.85 || m.groundIs(wx, wy, 'swamp_deep'))) continue;
        found.push({ cells, a, b, horizontal });
      }
    }
  }
  return found;
}
function buildBridge(crossing: Crossing): void {
  for (const [x, y] of crossing.cells) {
    m.setGround(x, y, crossing.horizontal ? 'bridge' : 'pier_v');
    if (crossing.horizontal) m.depth.shadeBlock(x, y, x, y, (sx, sy) => isWater(sx, sy));
  }
  const [fx, fy] = crossing.cells[0]!;
  const [lx, ly] = crossing.cells[crossing.cells.length - 1]!;
  const [dx, dy] = crossing.horizontal ? [1, 0] : [0, 1];
  m.reserve(fx - dx, fy - dy); // as cabeceiras ficam livres (nada de árvore tapando a passarela)
  m.reserve(lx + dx, ly + dy);
}
{
  const label = landRegions();
  const size = new Map<number, number>();
  for (const l of label) if (l >= 0) size.set(l, (size.get(l) ?? 0) + 1);
  const linked = new Set([label[m.idx(ARRIVAL.x, ARRIVAL.y)]!]);
  const all = crossings(label);
  for (;;) {
    const options = all.filter((c) => linked.has(c.a) !== linked.has(c.b) && (size.get(linked.has(c.a) ? c.b : c.a) ?? 0) >= 6);
    if (options.length === 0) break;
    const shortest = Math.min(...options.map((c) => c.cells.length));
    const pick = m.pick(options.filter((c) => c.cells.length === shortest));
    buildBridge(pick);
    linked.add(pick.a);
    linked.add(pick.b);
  }
  // umas passarelas a mais (caminhos alternativos), longe umas das outras
  const extra = shuffled(
    all.filter((c) => c.cells.length <= 3),
    m.rng,
  );
  let built = 0;
  for (const c of extra) {
    if (built >= 5) break;
    const [x, y] = c.cells[0]!;
    let clear = true;
    m.fill(x - 6, y - 6, x + 6, y + 6, (bx, by) => {
      if (m.groundIs(bx, by, 'bridge', 'pier_v')) clear = false;
    });
    if (!clear || c.cells.some(([cx, cy]) => !isWater(cx, cy))) continue;
    buildBridge(c);
    built++;
  }
}

// 8. Casas afundadas (só o telhado de fora), a usina velha numa ilha do leste
let roofs = 0;
for (let tries = 0; tries < 3000 && roofs < 5; tries++) {
  const x = 4 + Math.floor(m.rng() * (W - 9));
  const y = 30 + Math.floor(m.rng() * (H - 34));
  const spot = [
    [x, y],
    [x + 1, y],
    [x - 1, y],
    [x + 2, y],
    [x, y + 1],
    [x + 1, y + 1],
  ].every(([sx, sy]) => m.groundIs(sx!, sy!, 'swamp_water') && !m.hasDecor(sx!, sy!));
  if (!spot || Math.abs(y - HIGHWAY_Y - 1) < 4) continue;
  m.setDecor(x, y, 'sunken_roof_left');
  m.setDecor(x + 1, y, 'sunken_roof_right');
  roofs++;
}
/** A usina velha: um prédio de concreto de 6 de largura (laje, dois andares de fachada), no lugar seco que achar. */
function placeUsina(): { x: number; y: number } | null {
  for (let y = 8; y < 34; y++) {
    for (let x = W - 20; x < W - 9; x++) {
      let ok = true;
      m.fill(x - 1, y - 1, x + 6, y + 5, (sx, sy) => {
        if (!walkableLand(sx, sy) || m.isReserved(sx, sy)) ok = false;
      });
      if (!ok) continue;
      m.fill(x, y, x + 5, y + 3, (sx, sy) => {
        m.setGround(sx, sy, 'concrete');
        const row = sy - y;
        m.setDecor(sx, sy, row < 2 ? (m.rng() < 0.2 ? 'building_top_broken' : 'building_top') : row === 2 ? 'facade_up_windows' : sx === x + 2 ? 'facade_low_door' : 'facade_low_vines');
        m.reserve(sx, sy);
      });
      m.depth.shadeBlock(x, y, x + 5, y + 3, (sx, sy) => !m.hasDecor(sx, sy));
      for (const [sx, sy, key] of [
        [x - 1, y + 4, 'scrap'],
        [x + 6, y + 2, 'rubble'],
        [x + 3, y + 5, 'tires'],
      ] as const) {
        if (walkableLand(sx, sy)) m.setDecor(sx, sy, key);
      }
      return { x, y };
    }
  }
  return null;
}
const usina = placeUsina();

// 9. Na água: aguapés (mais nos canais), e taboas na beirada
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (!m.groundIs(x, y, 'swamp_water') || m.hasDecor(x, y)) return;
  const canal = lakeDistance(x, y) > 1;
  if (m.rng() < (canal ? 0.2 : 0.05)) m.setDecor(x, y, m.rng() < 0.3 ? 'aguape_flower' : 'aguape');
});
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (!walkableLand(x, y) || m.isReserved(x, y) || m.groundIs(x, y, 'sand', 'bridge', 'pier_v')) return;
  const shore = isWater(x + 1, y) || isWater(x - 1, y) || isWater(x, y + 1) || isWater(x, y - 1);
  if (shore && m.rng() < 0.22) m.setDecor(x, y, 'reeds');
});

// 10. A mata: borda fechada em volta do mapa e árvores grandes pelas ilhas (buritis na beira d'água)
m.fill(ARRIVAL.x - 4, 0, ARRIVAL.x + 4, ARRIVAL.y + 3, (x, y) => m.reserve(x, y)); // a chegada fica aberta
// os caminhos da chegada até os lugares importantes ficam livres (nenhuma árvore fecha a passagem)
{
  const before = GameMap.fromTiled(
    m.toTiled({ properties: [], points: [{ name: 'spawn', ...ARRIVAL }], monsters: [], exits: [] }) as unknown as TiledMap,
    'billings',
  );
  const goals = [
    before.nearestWalkable(ROCK.x, ROCK.y - 5, 3),
    { x: HIGHWAY_GAP.x0 - 2, y: HIGHWAY_Y + 1 },
    { x: HIGHWAY_GAP.x1 + 2, y: HIGHWAY_Y + 2 },
    usina ? before.nearestWalkable(usina.x + 2, usina.y + 5, 3) : null,
  ];
  for (const goal of goals) {
    if (!goal) continue;
    const steps = findPath(before, ARRIVAL.x, ARRIVAL.y, goal.x, goal.y, W * H * 2);
    if (!steps) continue; // quem confere no fim é o passo 14
    let x = ARRIVAL.x;
    let y = ARRIVAL.y;
    for (const dir of steps) {
      x += DX[dir];
      y += DY[dir];
      m.reserve(x, y);
    }
  }
}
const edgeDistance = (x: number, y: number) => Math.min(x, y, W - 1 - x, H - 1 - y);
const border = m.noise(6);
const thickness = (x: number, y: number) => 2 + Math.round(border(x, y) * 2);
const canGrow = (x: number, y: number) => walkableLand(x, y) && !m.isReserved(x, y) && m.groundIs(x, y, 'swamp_grass', 'swamp_grass_b', 'mud');
const canCover = (x: number, y: number) => !nearArrival(x, y) && !m.groundIs(x, y, 'bridge', 'pier_v', 'asphalt', 'asphalt_cracked');
const treeKind = (x: number, y: number): BigTree => {
  const r = m.rng();
  const wet = isWater(x, y + 1) || isWater(x + 1, y + 1) || isWater(x - 1, y) || isWater(x + 2, y);
  if (wet) return r < 0.75 ? 'buriti_big' : 'dead_tree_big';
  return r < 0.4 ? 'buriti_big' : r < 0.8 ? 'tree_big' : 'dead_tree_big';
};
for (const i of shuffled([...Array(W * H).keys()], m.rng)) {
  const x = i % W;
  const y = Math.floor(i / W);
  if (!canGrow(x, y) || !canGrow(x + 1, y)) continue;
  const inBorder = Math.min(edgeDistance(x, y), edgeDistance(x + 1, y)) < thickness(x, y);
  if (m.rng() < (inBorder ? 1 : 0.1)) m.depth.plantBigTree(treeKind(x, y), x, y, canCover);
}
m.fill(0, 0, W - 1, H - 1, (x, y) => {
  if (!canGrow(x, y)) return;
  const r = m.rng();
  if (edgeDistance(x, y) < thickness(x, y)) m.setDecor(x, y, m.depth.covered(x, y) || r < 0.35 ? 'thicket' : r < 0.85 ? 'bush' : 'dead_tree');
  else if (r < 0.05) m.setDecor(x, y, 'tall_grass');
  else if (r < 0.065) m.setDecor(x, y, m.rng() < 0.5 ? 'flowers_white' : 'bush');
});

// 11. Beiradas suaves (no fim: depois disso o chão da beira deixa de ser só "mato" ou "lama")
const swamp = (x: number, y: number) => m.groundIs(x, y, 'swamp_grass', 'swamp_grass_b');
const water = (x: number, y: number) => m.groundIs(x, y, ...WATER);
softenEdges(m.ground, W, H, [
  { base: ['swamp_grass', 'swamp_grass_b'], set: 'swamp_shore', touches: water },
  { base: ['mud'], set: 'mud_swamp_shore', touches: water },
  { base: ['mud'], set: 'mud_swamp', touches: swamp },
  { base: ['sand'], set: 'sand_swamp_shore', touches: water },
  { base: ['sand'], set: 'sand_swamp', touches: swamp },
]);
softenEdges(m.ground, W, H, [{ base: ['swamp_water'], set: 'swamp_deep_edge', touches: (x, y) => m.groundIs(x, y, 'swamp_deep') }], m.depth.shade);

// 12. Áreas das criaturas e da lenda que ainda vai chegar (a Iara)
const game0 = GameMap.fromTiled(
  m.toTiled({ properties: [], points: [{ name: 'spawn', ...ARRIVAL }], monsters: [], exits: [] }) as unknown as TiledMap,
  'billings',
);
const reach = (x: number, y: number) => findPath(game0, ARRIVAL.x, ARRIVAL.y, x, y, W * H * 2) !== null;
const legends: AreaObject[] = [
  { name: 'iara', x: ROCK.x - 9, y: ROCK.y - 9, w: 19, h: 12, properties: [] }, // a prainha e a pedra
];
const areas: AreaObject[] = [];
function placeArea(name: string, count: number, region: { x0: number; y0: number; x1: number; y1: number }, minDistance: number): void {
  for (let tries = 0; tries < 400; tries++) {
    const w = 7 + Math.floor(m.rng() * 3);
    const h = 5 + Math.floor(m.rng() * 2);
    const x = region.x0 + Math.floor(m.rng() * Math.max(1, region.x1 - region.x0 - w));
    const y = region.y0 + Math.floor(m.rng() * Math.max(1, region.y1 - region.y0 - h));
    if (Math.hypot(x + w / 2 - ARRIVAL.x, y + h / 2 - ARRIVAL.y) < minDistance) continue;
    if (areas.some((a) => x < a.x + a.w + 2 && x + w + 2 > a.x && y < a.y + a.h + 2 && y + h + 2 > a.y)) continue;
    if (legends[0] && x < legends[0].x + legends[0].w && x + w > legends[0].x && y < legends[0].y + legends[0].h && y + h > legends[0].y) continue; // a prainha é da Iara
    let free = 0;
    m.fill(x, y, x + w - 1, y + h - 1, (cx, cy) => {
      if (game0.isWalkable(cx, cy)) free++;
    });
    const center = game0.nearestWalkable(x + (w >> 1), y + (h >> 1), 3);
    if (free < w * h * 0.5 || !center || !reach(center.x, center.y)) continue;
    areas.push({ name, x, y, w, h, properties: [{ name: 'quantidade', type: 'int', value: count }] });
    return;
  }
  console.error(`ERRO: não achei lugar para uma área de "${name}"`);
  process.exit(1);
}
for (let k = 0; k < 3; k++) placeArea('jararaca', 3, { x0: 4, y0: 6, x1: W - 4, y1: 34 }, 12);
for (let k = 0; k < 2; k++) placeArea('corpo_seco', 2, { x0: W / 2, y0: 14, x1: W - 4, y1: 44 }, 20);
for (let k = 0; k < 2; k++) placeArea('capelobo', 2, { x0: 4, y0: 30, x1: W - 4, y1: H - 4 }, 26);
// as criaturas de lá (eram marcadas na camada "lendas" até existirem); entram no fim, para não mudar os sorteios acima
areas.push(
  { name: 'jacare', x: 8, y: 8, w: 20, h: 26, properties: [{ name: 'quantidade', type: 'int', value: 3 }] }, // os canais do oeste
  { name: 'boto', x: 50, y: 34, w: 24, h: 10, properties: [{ name: 'quantidade', type: 'int', value: 2 }] }, // o lago das casas afundadas
);

// 13. Monta o mapa
const map = m.toTiled({
  properties: [
    { name: 'nome', type: 'string', value: ZONE_NAME },
    { name: 'seguro', type: 'bool', value: false },
    { name: 'renascerEm', type: 'string', value: 'refugio' },
    // clima de brejo: neblina, um pouco escuro e vaga-lumes piscando (0 a 1)
    { name: 'neblina', type: 'float', value: 0.16 },
    { name: 'escuro', type: 'float', value: 0.08 },
    { name: 'vagalumes', type: 'float', value: 0.7 },
  ],
  points: [
    { name: 'spawn', ...ARRIVAL },
    { name: 'norte', ...ARRIVAL },
  ],
  monsters: areas,
  exits: [
    {
      name: 'Refúgio de Guarapiranga',
      ...NORTH_EXIT,
      properties: [
        { name: 'mapa', type: 'string', value: 'refugio' },
        { name: 'chegada', type: 'string', value: 'sul' },
      ],
    },
  ],
  extraGroups: [{ name: 'lendas', areas: legends }],
});

// 14. Confere se dá para chegar a pé nos lugares importantes
const game = GameMap.fromTiled(map as unknown as TiledMap, 'billings');
const checkpoints: Record<string, { x: number; y: number }> = {
  'saída para o Refúgio': { x: ARRIVAL.x, y: 0 },
  'prainha da Iara': game.nearestWalkable(ROCK.x, ROCK.y - 5, 3) ?? ROCK,
  'ponte quebrada (oeste)': { x: HIGHWAY_GAP.x0 - 2, y: HIGHWAY_Y + 1 },
  'ponte quebrada (leste)': { x: HIGHWAY_GAP.x1 + 2, y: HIGHWAY_Y + 2 },
};
if (usina) checkpoints['usina'] = game.nearestWalkable(usina.x + 2, usina.y + 5, 3) ?? usina;
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
  `mapa "${ZONE_NAME}" salvo em ${path.relative(process.cwd(), OUT)} (${W}x${H}, ${roofs} casas afundadas, ` +
    `usina ${usina ? `em (${usina.x}, ${usina.y})` : 'não coube'}; ${used.size} de ${TILES.length} tiles usados)`,
);
console.log('áreas:', areas.map((a) => `${a.name} ${a.x},${a.y} ${a.w}x${a.h}`).join('  '));
