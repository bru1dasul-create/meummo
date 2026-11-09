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

/**
 * Calcula quando o próximo passo pode acontecer.
 * Se o passo atual saiu só um pouquinho atrasado (até `slackMs`), mantém o ritmo original
 * para o atraso não se acumular; se o personagem estava parado, conta a partir de agora.
 */
export function nextStepTime(now: number, scheduled: number, stepMs: number, slackMs: number): number {
  const base = now - scheduled <= slackMs ? scheduled : now;
  return base + stepMs;
}
