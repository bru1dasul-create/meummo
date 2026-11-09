/** Direções: 0 = cima, 1 = direita, 2 = baixo, 3 = esquerda. */
export type Dir = 0 | 1 | 2 | 3;

export const UP: Dir = 0;
export const RIGHT: Dir = 1;
export const DOWN: Dir = 2;
export const LEFT: Dir = 3;

/** Quanto x e y mudam ao andar em cada direção. */
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

export function isDir(value: unknown): value is Dir {
  return value === 0 || value === 1 || value === 2 || value === 3;
}
