// Geometria do combate e voo dos projéteis. O servidor usa para decidir quem levou dano;
// o cliente usa as mesmas funções para desenhar os tiros sem esperar a rede.

import { DOWN, DX, DY, LEFT, RIGHT, UP, type Dir } from './dir';
import type { Tile } from './map';

export interface Point {
  x: number;
  y: number;
}

/** Quantos passos (contando diagonais) separam dois tiles. */
export function chebyshev(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Direção (4 lados) mais próxima de um ângulo. */
export function dirFromAngle(angle: number): Dir {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? RIGHT : LEFT;
  return dy >= 0 ? DOWN : UP;
}

/** Ângulo de uma direção (4 lados). */
export function angleOfDir(dir: Dir): number {
  return [-Math.PI / 2, 0, Math.PI / 2, Math.PI][dir]!;
}

/** Direção (4 lados) de `from` para `to`; null se for o mesmo tile. */
export function dirTowards(from: Point, to: Point): Dir | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? RIGHT : LEFT;
  return dy > 0 ? DOWN : UP;
}

/** Ângulo do centro de um tile até o centro de outro. */
export function angleBetween(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

const EIGHT_DIRS: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/** Os 3 tiles à frente, na direção do ângulo (golpe em arco). */
export function arcTiles(x: number, y: number, angle: number): Tile[] {
  const k = (((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8) as number;
  return [k - 1, k, k + 1].map((i) => {
    const [dx, dy] = EIGHT_DIRS[(i + 8) % 8]!;
    return { x: x + dx, y: y + dy };
  });
}

/** O próprio tile mais `length` tiles em linha reta à frente (bote da cobra, mordida). */
export function lineTiles(x: number, y: number, dir: Dir, length: number): Tile[] {
  const tiles: Tile[] = [{ x, y }];
  for (let i = 1; i <= length; i++) tiles.push({ x: x + DX[dir] * i, y: y + DY[dir] * i });
  return tiles;
}

/** O tile e todos os vizinhos até `radius` de distância (giro). */
export function areaTiles(x: number, y: number, radius: number): Tile[] {
  const tiles: Tile[] = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) tiles.push({ x: x + dx, y: y + dy });
  return tiles;
}

export function tileIn(tiles: Tile[], x: number, y: number): boolean {
  return tiles.some((t) => t.x === x && t.y === y);
}

// ---------- projéteis ----------

export interface ShotPath {
  /** Posição em tiles (com fração). O centro do tile (3, 4) é (3.5, 4.5). */
  x: number;
  y: number;
  /** Direção (vetor de tamanho 1). */
  dx: number;
  dy: number;
  /** Tiles por segundo. */
  speed: number;
  /** Distância máxima, em tiles. */
  range: number;
  traveled: number;
}

export interface ShotBlocker {
  blocksShot(x: number, y: number): boolean;
}

export function makeShot(fromTile: Point, angle: number, speed: number, range: number): ShotPath {
  return { x: fromTile.x + 0.5, y: fromTile.y + 0.5, dx: Math.cos(angle), dy: Math.sin(angle), speed, range, traveled: 0 };
}

/**
 * Avança um projétil `dt` segundos, em pedacinhos de no máximo 1/4 de tile (para não atravessar nada).
 * A cada pedacinho chama `hits(x, y)`: se devolver true, o projétil acertou alguém e para.
 */
export function advanceShot(
  shot: ShotPath,
  dtSeconds: number,
  map: ShotBlocker,
  hits?: (x: number, y: number) => boolean,
): 'hit' | 'wall' | 'range' | 'flying' {
  let remaining = shot.speed * dtSeconds;
  while (remaining > 1e-9) {
    const step = Math.min(0.25, remaining, shot.range - shot.traveled);
    if (step <= 1e-9) return 'range';
    shot.x += shot.dx * step;
    shot.y += shot.dy * step;
    shot.traveled += step;
    remaining -= step;
    if (map.blocksShot(Math.floor(shot.x), Math.floor(shot.y))) return 'wall';
    if (hits?.(shot.x, shot.y)) return 'hit';
    if (shot.traveled >= shot.range - 1e-9) return 'range';
  }
  return 'flying';
}

/** O projétil (x, y) está perto o bastante do centro do tile (tx, ty) para acertar? */
export function shotTouches(x: number, y: number, tx: number, ty: number, radius: number): boolean {
  const dx = x - (tx + 0.5);
  const dy = y - (ty + 0.5);
  return dx * dx + dy * dy <= radius * radius;
}
