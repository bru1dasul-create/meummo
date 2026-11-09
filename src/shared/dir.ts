/**
 * Direções. As 4 primeiras são as "retas"; as 4 últimas, as diagonais.
 * 0 cima · 1 direita · 2 baixo · 3 esquerda · 4 cima-direita · 5 baixo-direita · 6 baixo-esquerda · 7 cima-esquerda
 */
export type Dir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Só as 4 direções retas (os desenhos dos personagens têm 4 lados). */
export type Facing = 0 | 1 | 2 | 3;

export const UP: Dir = 0;
export const RIGHT: Dir = 1;
export const DOWN: Dir = 2;
export const LEFT: Dir = 3;
export const UP_RIGHT: Dir = 4;
export const DOWN_RIGHT: Dir = 5;
export const DOWN_LEFT: Dir = 6;
export const UP_LEFT: Dir = 7;

/** Quanto x e y mudam ao andar em cada direção. */
export const DX = [0, 1, 0, -1, 1, 1, -1, -1] as const;
export const DY = [-1, 0, 1, 0, -1, 1, 1, -1] as const;

export const ALL_DIRS: Dir[] = [0, 1, 2, 3, 4, 5, 6, 7];

export function isDir(value: unknown): value is Dir {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 7;
}

export function isDiagonal(dir: Dir): boolean {
  return dir >= 4;
}

/** Junta uma direção vertical (cima/baixo) e uma horizontal (esquerda/direita) numa diagonal. */
export function combineDirs(vertical: Dir, horizontal: Dir): Dir {
  if (vertical === UP) return horizontal === RIGHT ? UP_RIGHT : UP_LEFT;
  return horizontal === RIGHT ? DOWN_RIGHT : DOWN_LEFT;
}

/** As duas direções retas que formam uma diagonal: [vertical, horizontal]. */
export function splitDiagonal(dir: Dir): [Dir, Dir] {
  return [DY[dir] < 0 ? UP : DOWN, DX[dir] > 0 ? RIGHT : LEFT];
}

/** Para qual dos 4 lados o desenho olha: nas diagonais vale o lado (esquerda/direita). */
export function facingOf(dir: Dir): Facing {
  if (!isDiagonal(dir)) return dir as Facing;
  return DX[dir] > 0 ? 1 : 3;
}

/** Tempo de um passo: na diagonal anda √2 a mais, então demora √2 a mais (mesma velocidade em tudo). */
export function stepDuration(dir: Dir, stepMs: number): number {
  return isDiagonal(dir) ? Math.round(stepMs * Math.SQRT2) : stepMs;
}
