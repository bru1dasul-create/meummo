// Formas do corpo usadas pelo corpo (compose.ts) e pelos equipamentos (gear.ts): o colete e a
// armadura seguem exatamente o contorno do tronco.

import { BUILD_WIDTHS, type Build } from './body';
import type { Rig } from './poses';
import { cylinder, type Vec } from './raster';

/** Uma "fatia" do tronco: altura e bordas esquerda/direita. */
interface Row {
  y: number;
  left: number;
  right: number;
}

/** O tronco de cima (pescoço) até o quadril, fatia por fatia. */
function torsoRows(r: Rig, build: Build): Row[] {
  const [shoulder, chest, waist, hip] = BUILD_WIDTHS[build];
  const top = r.neck[1] + 1.2;
  const c = r.chest[0];
  const w = r.waist[0];
  const p = r.pelvis[0];
  const sy = r.shoulder.main[1] - 0.5;
  if (r.view === 'side') {
    const bust = build === 'esguio' ? 0.4 : 0;
    return [
      { y: top, left: c - 2.4, right: c + 2 },
      { y: sy, left: c - 3.4, right: c + 3 },
      { y: r.chest[1], left: c - 3.2, right: c + 3.8 + bust },
      { y: r.chest[1] + 3, left: c - 3, right: c + 3.4 },
      { y: r.waist[1], left: w - 2.9, right: w + 2.8 },
      { y: r.pelvis[1] - 0.5, left: p - 3.6, right: p + 3.1 },
      { y: r.pelvis[1] + 1.6, left: p - 3.4, right: p + 2.9 },
    ];
  }
  return [
    { y: top, left: c - (shoulder - 2.6), right: c + (shoulder - 2.6) },
    { y: sy, left: c - shoulder, right: c + shoulder },
    { y: r.chest[1], left: c - chest, right: c + chest },
    { y: r.chest[1] + 3, left: c - (chest - 0.6), right: c + (chest - 0.6) },
    { y: r.waist[1], left: w - waist, right: w + waist },
    { y: r.pelvis[1] - 0.5, left: p - hip, right: p + hip },
    { y: r.pelvis[1] + 1.6, left: p - (hip - 0.4), right: p + (hip - 0.4) },
  ];
}

/** Contorno do tronco (de frente/costas ou de lado), entre o pescoço e o quadril. */
export function torsoShape(r: Rig, build: Build): Vec[] {
  const rows = torsoRows(r, build);
  return [...rows.map((row): Vec => [row.left, row.y]), ...[...rows].reverse().map((row): Vec => [row.right, row.y])];
}

/** Bordas do tronco na altura y (interpolando as fatias). */
export function torsoEdges(r: Rig, build: Build, y: number): [number, number] {
  const rows = torsoRows(r, build);
  if (y <= rows[0]!.y) return [rows[0]!.left, rows[0]!.right];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!;
    const b = rows[i]!;
    if (y <= b.y) {
      const t = (y - a.y) / Math.max(1e-6, b.y - a.y);
      return [a.left + (b.left - a.left) * t, a.right + (b.right - a.right) * t];
    }
  }
  const last = rows[rows.length - 1]!;
  return [last.left, last.right];
}

/** Normal do tronco: um cilindro em pé que acompanha a largura em cada altura, um pouco virado para cima no peito. */
export function torsoNormal(r: Rig, build: Build): (x: number, y: number) => [number, number, number] {
  return (x, y) => {
    const [left, right] = torsoEdges(r, build, y);
    const mid = (left + right) / 2 + (r.view === 'side' ? 0.4 : 0);
    const half = Math.max(1, (right - left) / 2);
    return cylinder((x - mid) / (half + 0.6), (y - r.chest[1]) / 24 - 0.1);
  };
}
