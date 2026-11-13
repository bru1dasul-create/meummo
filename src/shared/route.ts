// "Andar até" no movimento livre: o caminho pelo tamanho exato do pé, e não de tile em tile.
//
// A rota de tile em tile ia em linha reta entre um ponto de cada tile. Com coisas pequenas no mapa (poste de 0,3 m,
// banco, orelhão), essa reta raspava nelas e o personagem travava de frente. Aqui:
// 1. Se a reta até o destino está livre (o pé inteiro passa, com uma folga), vai direto.
// 2. Senão, busca o caminho (A*) numa grade fina (PATH_CELL) de lugares onde o pé cabe. Ir de um ponto da grade
//    para o vizinho nunca encosta em nada: o pé é maior que a grade e, na diagonal, os dois vizinhos de lado
//    também precisam estar livres.
// 3. Puxa o fio: troca os pedacinhos por retas conferidas com folga (MARGIN), para o andar ficar natural.
// Quem segue a rota (followRoute) pula para o ponto seguinte assim que ele aparece em linha reta.
// Tudo em posição "de canto" (a do jogador); por dentro, as contas usam o centro da caixa do pé.

import type { SolidRect, Walkable } from './map';
import { BODY_HALF_H, BODY_HALF_W, bodyFits, degreesToward, finalApproach, footCenter, type Pose } from './movement';
import { MinHeap } from './pathfind';

/** Tamanho da grade fina do caminho (metros). */
export const PATH_CELL = 0.2;
/** Folga das retas da rota: o arredondamento do ângulo de cada pedaço não deixa encostar em nada. */
export const ROUTE_MARGIN = 0.08;
/** Destino onde o pé não cabe (tocou numa árvore, numa casa): procura lugar livre até esta distância. */
const NEAR_GOAL = 3;
const DIAGONAL = PATH_CELL * Math.SQRT2;
const NO_RECTS: readonly SolidRect[] = [];

type Point = { x: number; y: number };

const solidTile = (map: Walkable, tx: number, ty: number) => (map.isSolidTile ? map.isSolidTile(tx, ty) : !map.isWalkable(tx, ty));

/** A reta de A até A + D (com t entre 0 e 1) passa por DENTRO da caixa? (Só encostar na borda não conta.) */
function crossesBox(ax: number, ay: number, dx: number, dy: number, x0: number, y0: number, x1: number, y1: number): boolean {
  let t0 = 0;
  let t1 = 1;
  if (Math.abs(dx) < 1e-12) {
    if (ax <= x0 || ax >= x1) return false;
  } else {
    let ta = (x0 - ax) / dx;
    let tb = (x1 - ax) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 >= t1) return false;
  }
  if (Math.abs(dy) < 1e-12) {
    if (ay <= y0 || ay >= y1) return false;
  } else {
    let ta = (y0 - ay) / dy;
    let tb = (y1 - ay) / dy;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
  }
  return t0 < t1;
}

/** A caixa do pé (aumentada em `margin`) indo em linha reta do centro A ao centro B encosta em algo que bloqueia? */
function sweepBlocked(map: Walkable, ax: number, ay: number, bx: number, by: number, margin: number): boolean {
  const hw = BODY_HALF_W + margin;
  const hh = BODY_HALF_H + margin;
  const dx = bx - ax;
  const dy = by - ay;
  const minX = Math.min(ax, bx) - hw;
  const maxX = Math.max(ax, bx) + hw;
  const minY = Math.min(ay, by) - hh;
  const maxY = Math.max(ay, by) + hh;
  for (let ty = Math.floor(minY); ty <= Math.ceil(maxY) - 1; ty++) {
    for (let tx = Math.floor(minX); tx <= Math.ceil(maxX) - 1; tx++) {
      // o tile inteiro (aumentado) nem chega perto da reta: nada dele pode bloquear
      if (!crossesBox(ax, ay, dx, dy, tx - hw, ty - hh, tx + 1 + hw, ty + 1 + hh)) continue;
      if (solidTile(map, tx, ty)) return true;
      for (const r of map.solidsAt?.(tx, ty) ?? NO_RECTS) {
        if (crossesBox(ax, ay, dx, dy, r.x0 - hw, r.y0 - hh, r.x1 + hw, r.y1 + hh)) return true;
      }
    }
  }
  return false;
}

/** O pé vai em linha reta de `from` até `to` (posições "de canto") sem encostar em nada, com folga de `margin`? */
export function lineClear(map: Walkable, from: Point, to: Point, margin = ROUTE_MARGIN): boolean {
  const a = footCenter(from.x, from.y);
  const b = footCenter(to.x, to.y);
  return !sweepBlocked(map, a.x, a.y, b.x, b.y, margin);
}

// ---- grade fina: em cada ponto, o pé cabe? (guardado por mapa: o mapa não muda) ----

interface Grid {
  w: number;
  h: number;
  /** 0 = ainda não sei, 1 = o pé cabe, 2 = não cabe. */
  state: Uint8Array;
  // memória da busca, reaproveitada entre buscas (stamp diz quais valores são desta busca)
  cost: Float64Array;
  from: Int32Array;
  stamp: Uint32Array;
  closed: Uint32Array;
  search: number;
}

const grids = new WeakMap<Walkable, Grid>();

function gridOf(map: Walkable): Grid {
  let grid = grids.get(map);
  if (!grid) {
    const w = Math.floor(map.width / PATH_CELL) + 2;
    const h = Math.floor(map.height / PATH_CELL) + 2;
    const size = w * h;
    grid = { w, h, state: new Uint8Array(size), cost: new Float64Array(size), from: new Int32Array(size), stamp: new Uint32Array(size), closed: new Uint32Array(size), search: 0 };
    grids.set(map, grid);
  }
  return grid;
}

/** O pé cabe com o centro no ponto (i, j) da grade? */
function cellFree(map: Walkable, grid: Grid, i: number, j: number): boolean {
  if (i < 0 || j < 0 || i >= grid.w || j >= grid.h) return false;
  const k = j * grid.w + i;
  let s = grid.state[k]!;
  if (s === 0) {
    const pos = cellPos(i, j);
    s = bodyFits(map, pos.x, pos.y) ? 1 : 2;
    grid.state[k] = s;
  }
  return s === 1;
}

/** Posição "de canto" do ponto (i, j) da grade (o centro do pé fica em i × PATH_CELL, j × PATH_CELL). */
function cellPos(i: number, j: number): Point {
  const center = footCenter(0, 0);
  return { x: i * PATH_CELL - center.x, y: j * PATH_CELL - center.y };
}

/** Pontos da grade em volta de um centro de pé, do mais perto ao mais longe (até `reach` pontos para cada lado). */
function cellsAround(cx: number, cy: number, reach: number): [number, number][] {
  const i0 = Math.floor(cx / PATH_CELL);
  const j0 = Math.floor(cy / PATH_CELL);
  const out: [number, number][] = [];
  for (let j = j0 - reach + 1; j <= j0 + reach; j++) for (let i = i0 - reach + 1; i <= i0 + reach; i++) out.push([i, j]);
  return out.sort((p, q) => Math.hypot(p[0] * PATH_CELL - cx, p[1] * PATH_CELL - cy) - Math.hypot(q[0] * PATH_CELL - cx, q[1] * PATH_CELL - cy));
}

export interface Route {
  /** Pontos a seguir (posições "de canto"); o último é o destino. */
  points: Point[];
  /** Chega no ponto exato pedido (false: o pé não cabia lá e a rota vai até o lugar livre mais perto). */
  exact: boolean;
}

/**
 * Caminho de `from` até `to` (posições "de canto") por onde o pé passa, ou null se não há (lugar fechado, longe
 * demais para a busca). Se o pé não cabe no destino, vai até o lugar livre mais perto dele (até NEAR_GOAL metros).
 */
export function findRoute(map: Walkable, from: Point, to: Point, maxNodes = 150_000): Route | null {
  const grid = gridOf(map);
  const { w } = grid;
  const start = footCenter(from.x, from.y);
  let goal = footCenter(to.x, to.y);
  let goalPos: Point = { x: to.x, y: to.y };
  let exact = bodyFits(map, to.x, to.y);
  /** Pontos da grade em volta do destino ligados a ele por reta exata (com a distância até ele). */
  const linksTo = (reach: number) => {
    const links = new Map<number, number>();
    for (const [i, j] of cellsAround(goal.x, goal.y, reach)) {
      if (!cellFree(map, grid, i, j)) continue;
      const d = Math.hypot(i * PATH_CELL - goal.x, j * PATH_CELL - goal.y);
      if (d < 1e-9 || !sweepBlocked(map, i * PATH_CELL, j * PATH_CELL, goal.x, goal.y, 0)) links.set(j * w + i, d);
    }
    return links;
  };
  let goalLinks = exact ? linksTo(2) : new Map<number, number>();
  if (goalLinks.size === 0) {
    // o pé não cabe no destino (ou cabe só num aperto sem ligação): o lugar livre mais perto, até NEAR_GOAL
    const reach = Math.ceil(NEAR_GOAL / PATH_CELL);
    const near = cellsAround(goal.x, goal.y, reach).find(([i, j]) => cellFree(map, grid, i, j) && Math.hypot(i * PATH_CELL - goal.x, j * PATH_CELL - goal.y) <= NEAR_GOAL);
    if (!near) return null;
    exact = false;
    goal = { x: near[0] * PATH_CELL, y: near[1] * PATH_CELL };
    goalPos = cellPos(near[0], near[1]);
    goalLinks = new Map([[near[1] * w + near[0], 0]]);
  }
  // 1. reta livre (com folga): vai direto
  if (!sweepBlocked(map, start.x, start.y, goal.x, goal.y, ROUTE_MARGIN)) return { points: [goalPos], exact };

  // 2. A* na grade fina
  grid.search += 1;
  const search = grid.search;
  const { cost, from: cameFrom, stamp, closed } = grid;
  const open = new MinHeap();
  const GOAL = -1;
  const SEED = -2;
  const known = (k: number) => stamp[k] === search;
  const relax = (k: number, g: number, parent: number, i: number, j: number) => {
    if (closed[k] === search) return;
    if (known(k) && cost[k]! <= g) return;
    stamp[k] = search;
    cost[k] = g;
    cameFrom[k] = parent;
    open.push(k, g + Math.hypot(i * PATH_CELL - goal.x, j * PATH_CELL - goal.y));
  };
  // começo: pontos da grade em volta de onde está, ligados por reta exata (encostado na parede ainda funciona)
  for (const reach of [1, 2, 3]) {
    for (const [i, j] of cellsAround(start.x, start.y, reach)) {
      if (!cellFree(map, grid, i, j)) continue;
      const cx = i * PATH_CELL;
      const cy = j * PATH_CELL;
      if (sweepBlocked(map, start.x, start.y, cx, cy, 0)) continue;
      relax(j * w + i, Math.hypot(cx - start.x, cy - start.y), SEED, i, j);
    }
    if (open.size > 0) break;
  }
  if (open.size === 0) return null;

  let goalCost = Infinity;
  let goalFrom = -1;
  let pops = 0;
  while (open.size > 0) {
    const k = open.pop();
    if (k === GOAL) break;
    if (closed[k] === search) continue;
    closed[k] = search;
    if (++pops > maxNodes) return null;
    const g = cost[k]!;
    if (g >= goalCost) break;
    const link = goalLinks.get(k);
    if (link !== undefined && g + link < goalCost) {
      goalCost = g + link;
      goalFrom = k;
      open.push(GOAL, goalCost);
    }
    const i = k % w;
    const j = (k - i) / w;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue;
        const ni = i + di;
        const nj = j + dj;
        if (!cellFree(map, grid, ni, nj)) continue;
        // diagonal só com os dois vizinhos de lado livres (assim o pé não raspa na quina)
        if (di !== 0 && dj !== 0 && (!cellFree(map, grid, i + di, j) || !cellFree(map, grid, i, j + dj))) continue;
        relax(nj * w + ni, g + (di !== 0 && dj !== 0 ? DIAGONAL : PATH_CELL), k, ni, nj);
      }
    }
  }
  if (goalFrom < 0) return null;

  // os pontos da grade, do começo ao destino (centros do pé)
  const centers: Point[] = [goal];
  for (let k = goalFrom; k !== SEED; k = cameFrom[k]!) {
    const i = k % w;
    centers.push({ x: i * PATH_CELL, y: ((k - i) / w) * PATH_CELL });
  }
  centers.reverse();

  // 3. puxa o fio: de cada ponto, a reta mais longa que passa com folga
  const points: Point[] = [];
  let anchor = start;
  let index = 0;
  while (index < centers.length) {
    let far = index;
    while (far + 1 < centers.length && !sweepBlocked(map, anchor.x, anchor.y, centers[far + 1]!.x, centers[far + 1]!.y, ROUTE_MARGIN)) far += 1;
    anchor = centers[far]!;
    points.push(far === centers.length - 1 ? goalPos : cellPos(Math.round(anchor.x / PATH_CELL), Math.round(anchor.y / PATH_CELL)));
    index = far + 1;
  }
  return { points, exact };
}

/**
 * Seguindo uma rota (de findRoute): para onde dar o próximo pedaço de `distance` metros, em graus, ou null se
 * acabou. Tira da rota os pontos vencidos: o que já alcançou e o que dá para pular (o seguinte já está em linha
 * reta, com folga). No último ponto, para quando nenhum pedaço aproxima mais (não fica indo e voltando).
 */
export function followRoute(map: Walkable, pose: Pose, route: Point[], distance: number): number | null {
  while (route.length > 1 && lineClear(map, pose, route[1]!)) route.shift();
  while (route.length > 0) {
    const next = route[0]!;
    if (route.length === 1) {
      const degrees = finalApproach(map, pose, next, distance);
      if (degrees === null) route.shift();
      return degrees;
    }
    if (Math.hypot(next.x - pose.x, next.y - pose.y) <= distance / 2 + 0.01) {
      route.shift();
      continue;
    }
    return degreesToward(pose.x, pose.y, next.x, next.y);
  }
  return null;
}
