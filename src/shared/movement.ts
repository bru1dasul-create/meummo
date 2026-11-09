import { DX, DY, isDiagonal, type Dir } from './dir';
import type { Walkable } from './map';

export interface Pose {
  x: number;
  y: number;
  dir: Dir;
}

/**
 * Dá para sair de (x, y) andando um tile na direção `dir`?
 * Na diagonal, os dois tiles "de lado" também precisam estar livres: ninguém passa espremido
 * entre duas árvores nem corta a quina de uma parede.
 */
export function canStep(map: Walkable, x: number, y: number, dir: Dir): boolean {
  const nx = x + DX[dir];
  const ny = y + DY[dir];
  if (!map.isWalkable(nx, ny)) return false;
  if (isDiagonal(dir) && (!map.isWalkable(nx, y) || !map.isWalkable(x, ny))) return false;
  return true;
}

/**
 * Aplica um passo: anda se der; senão só vira para aquela direção.
 * O cliente (para prever) e o servidor (para decidir) usam exatamente esta mesma função.
 */
export function applyStep(map: Walkable, from: Pose, dir: Dir): Pose & { moved: boolean } {
  if (canStep(map, from.x, from.y, dir)) return { x: from.x + DX[dir], y: from.y + DY[dir], dir, moved: true };
  return { x: from.x, y: from.y, dir, moved: false };
}

/**
 * Esquiva (rolamento): anda até `tiles` tiles em linha reta, parando antes de qualquer obstáculo.
 * Na diagonal rola menos tiles, para cobrir mais ou menos a mesma distância.
 */
export function applyDash(map: Walkable, from: Pose, dir: Dir, tiles: number): Pose & { moved: boolean } {
  const steps = isDiagonal(dir) ? Math.max(1, Math.round(tiles / Math.SQRT2)) : tiles;
  let x = from.x;
  let y = from.y;
  for (let i = 0; i < steps && canStep(map, x, y, dir); i++) {
    x += DX[dir];
    y += DY[dir];
  }
  return { x, y, dir, moved: x !== from.x || y !== from.y };
}

/** Um pedido de movimento do jogador: passo normal ou esquiva. */
export function applyInput(map: Walkable, from: Pose, dir: Dir, dash: boolean, dashTiles: number): Pose & { moved: boolean } {
  return dash ? applyDash(map, from, dir, dashTiles) : applyStep(map, from, dir);
}

/**
 * Calcula quando o próximo passo pode acontecer.
 * Se o passo atual saiu só um pouquinho atrasado (até `slackMs`), mantém o ritmo original
 * para o atraso não se acumular; se o personagem estava parado, conta a partir de agora.
 */
export function nextStepTime(now: number, scheduled: number, stepMs: number, slackMs: number): number {
  const base = now - scheduled <= slackMs ? scheduled : now;
  return base + stepMs;
}
