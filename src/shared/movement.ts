import { DX, DY, type Dir } from './dir';
import type { Walkable } from './map';

export interface Pose {
  x: number;
  y: number;
  dir: Dir;
}

/**
 * Aplica um passo: anda se o tile de destino estiver livre; senão só vira para aquela direção.
 * O cliente (para prever) e o servidor (para decidir) usam exatamente esta mesma função.
 */
export function applyStep(map: Walkable, from: Pose, dir: Dir): Pose & { moved: boolean } {
  const x = from.x + DX[dir];
  const y = from.y + DY[dir];
  if (map.isWalkable(x, y)) return { x, y, dir, moved: true };
  return { x: from.x, y: from.y, dir, moved: false };
}

/** Esquiva (rolamento): anda até `tiles` tiles em linha reta, parando antes de qualquer obstáculo. */
export function applyDash(map: Walkable, from: Pose, dir: Dir, tiles: number): Pose & { moved: boolean } {
  let x = from.x;
  let y = from.y;
  for (let i = 0; i < tiles && map.isWalkable(x + DX[dir], y + DY[dir]); i++) {
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
