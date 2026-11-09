// Formas do corpo usadas pelo corpo (compose.ts) e pelos equipamentos (gear.ts): o colete e a
// armadura seguem exatamente o contorno do tronco.

import type { Rig } from './poses';
import { cylinder, type Vec } from './raster';

/** Contorno do tronco (de frente/costas ou de lado), entre o pescoço e o quadril. */
export function torsoShape(r: Rig): Vec[] {
  const c = r.chest;
  const p = r.pelvis;
  const top = r.neck[1] + 1.4;
  if (r.view === 'side') {
    return [
      [c[0] - 3.7, top],
      [c[0] + 3.3, top],
      [c[0] + 5.1, top + 4],
      [c[0] + 4.3, p[1] - 4.5],
      [p[0] + 4.5, p[1] - 0.4],
      [p[0] - 4.1, p[1] - 0.4],
      [c[0] - 4.4, p[1] - 5],
      [c[0] - 4.8, top + 3],
    ];
  }
  return [
    [c[0] - 6.7, top],
    [c[0] + 6.7, top],
    [c[0] + 7.9, top + 3.2],
    [c[0] + 6.5, p[1] - 4.5],
    [p[0] + 6.4, p[1] - 0.4],
    [p[0] - 6.4, p[1] - 0.4],
    [c[0] - 6.5, p[1] - 4.5],
    [c[0] - 7.9, top + 3.2],
  ];
}

/** Normal do tronco: um cilindro em pé, um pouco virado para cima no peito. */
export function torsoNormal(r: Rig): (x: number, y: number) => [number, number, number] {
  const half = r.view === 'side' ? 4.8 : 7.6;
  const axis = r.view === 'side' ? r.chest[0] + 0.3 : r.chest[0];
  return (x, y) => cylinder((x - axis) / half, (y - r.chest[1]) / 26 - 0.12);
}
