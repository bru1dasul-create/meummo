// Busca de caminho A* em grade, em 8 direções (retas e diagonais). Usada no "clique para andar"
// e pelos monstros para perseguir jogadores. Diagonais custam √2 (≈ 14 contra 10 da reta) e
// seguem a mesma regra do movimento: não dá para cortar quinas.

import { ALL_DIRS, DX, DY, isDiagonal, type Dir } from './dir';
import type { Walkable } from './map';
import { canStep } from './movement';

const STRAIGHT_COST = 10;
const DIAGONAL_COST = 14;

/**
 * Encontra o caminho mais curto de (sx, sy) até (gx, gy).
 * Retorna a lista de direções a seguir, ou null se não existir caminho
 * (ou se a busca ficar grande demais: `maxNodes` limita o trabalho).
 */
export function findPath(map: Walkable, sx: number, sy: number, gx: number, gy: number, maxNodes = 4096): Dir[] | null {
  if (sx === gx && sy === gy) return [];
  if (!map.isWalkable(gx, gy)) return null;

  const width = map.width;
  const size = width * map.height;
  const cost = new Int32Array(size).fill(-1);
  const cameFrom = new Int32Array(size).fill(-1);
  const cameDir = new Uint8Array(size);
  const closed = new Uint8Array(size);
  const start = sy * width + sx;
  const goal = gy * width + gx;
  const open = new MinHeap();

  cost[start] = 0;
  open.push(start, octile(sx, sy, gx, gy));
  let expanded = 0;

  while (open.size > 0) {
    const current = open.pop();
    if (current === goal) break;
    if (closed[current]) continue;
    closed[current] = 1;
    if (++expanded > maxNodes) return null;

    const cx = current % width;
    const cy = (current - cx) / width;
    for (const d of ALL_DIRS) {
      if (!canStep(map, cx, cy, d)) continue;
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      const next = ny * width + nx;
      if (closed[next]) continue;
      const nextCost = cost[current]! + (isDiagonal(d) ? DIAGONAL_COST : STRAIGHT_COST);
      if (cost[next] === -1 || nextCost < cost[next]!) {
        cost[next] = nextCost;
        cameFrom[next] = current;
        cameDir[next] = d;
        open.push(next, nextCost + octile(nx, ny, gx, gy));
      }
    }
  }

  if (cost[goal] === -1) return null;
  const path: Dir[] = [];
  for (let node = goal; node !== start; node = cameFrom[node]!) path.push(cameDir[node] as Dir);
  return path.reverse();
}

/** Distância estimada em grade com diagonais (nunca exagera, então o A* acha o menor caminho). */
function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return STRAIGHT_COST * (dx + dy) + (DIAGONAL_COST - 2 * STRAIGHT_COST) * Math.min(dx, dy);
}

/** Fila de prioridade mínima (heap binário) — devolve sempre o item de menor prioridade. */
class MinHeap {
  private items: number[] = [];
  private priorities: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    const { items, priorities } = this;
    let i = items.length;
    items.push(item);
    priorities.push(priority);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (priorities[parent]! <= priority) break;
      items[i] = items[parent]!;
      priorities[i] = priorities[parent]!;
      i = parent;
    }
    items[i] = item;
    priorities[i] = priority;
  }

  pop(): number {
    const { items, priorities } = this;
    const top = items[0]!;
    const lastItem = items.pop()!;
    const lastPriority = priorities.pop()!;
    const n = items.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        if (left >= n) break;
        const right = left + 1;
        const child = right < n && priorities[right]! < priorities[left]! ? right : left;
        if (priorities[child]! >= lastPriority) break;
        items[i] = items[child]!;
        priorities[i] = priorities[child]!;
        i = child;
      }
      items[i] = lastItem;
      priorities[i] = lastPriority;
    }
    return top;
  }
}
