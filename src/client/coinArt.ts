// A moeda de ouro do jogo, desenhada por código com o mesmo pincel dos personagens (volume, brilho,
// contorno). No meio, em relevo, uma flor de ipê-amarelo. Ela aparece em todo lugar que mostra ouro
// (topo da tela, mochila, loja): o CSS usa a imagem pela variável --coin (veja .gold::before em style.css).

import { material } from './game/doll/palette';
import { Canvas } from './game/doll/raster';
import { Sheet } from './game/doll/sheet';

const SIZE = 32;
const GOLD = material('#f0c03c', 'metal');
const RIM = material('#c99227', 'metal');

/**
 * Uma moeda vista de frente, centrada em (cx, cy), raio r: disco chato (não bola), borda chanfrada
 * clara em cima e escura embaixo, reflexo na diagonal e a flor de ipê em relevo no meio.
 */
export function drawCoin(cv: Canvas, cx: number, cy: number, r: number): void {
  cv.part('coin');
  const rim = Math.max(1.6, r * 0.17);
  const flower: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    flower.push([Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36]);
  }
  const petalR = Math.max(1, r * 0.17);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const lit = -(dx + dy) / Math.max(1e-6, d); // 1 = em cima/à esquerda, −1 = embaixo/à direita
      let tone: number;
      if (d > r - rim) {
        tone = lit > 0.35 ? 3 : lit < -0.35 ? 0 : 1; // borda chanfrada
      } else if (d > r - rim - 1) {
        tone = lit > 0.3 ? 1 : lit < -0.3 ? 3 : 2; // degrau para dentro (o contrário da borda)
      } else {
        tone = 2;
        const diag = dx - dy; // reflexo na diagonal
        if (Math.abs(dx + dy + r * 0.45) < 1.1 || Math.abs(dx + dy + r * 0.1) < 0.5) tone = 3;
        if (Math.abs(diag) > r) tone = 2;
        // flor de ipê: pétalas claras (em relevo) e sombrinha embaixo/à direita delas
        for (const [fx, fy] of flower) {
          if (Math.hypot(dx - fx, dy - fy) <= petalR) tone = dx - fx < -petalR * 0.25 && dy - fy < -petalR * 0.25 ? 4 : 3;
          else if (tone === 2 && Math.hypot(dx - fx - 1, dy - fy - 1) <= petalR) tone = 1;
        }
        if (Math.hypot(dx, dy) <= Math.max(0.8, r * 0.1)) tone = 0;
      }
      cv.dot(x, y, (tone >= 3 && d > r - rim ? RIM : GOLD).ramp[tone]!);
    }
  }
}

function toUrl(cv: Canvas, width: number, height: number): string {
  const sheet = new Sheet(width, height);
  cv.finish(sheet, 0, 0);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(sheet.data), width, height), 0, 0);
  return canvas.toDataURL();
}

let coin: string | null = null;
let stack: string | null = null;

/** A moeda (32x32, mostrada pequena). */
export function coinUrl(): string {
  if (!coin) {
    const cv = new Canvas(SIZE, SIZE);
    drawCoin(cv, 16, 16, 13.5);
    coin = toUrl(cv, SIZE, SIZE);
  }
  return coin;
}

/** Um montinho de moedas (o "bolso" da loja). */
export function coinStackUrl(): string {
  if (!stack) {
    const cv = new Canvas(SIZE, SIZE);
    // moedas deitadas (elipses achatadas) empilhadas, e uma em pé na frente
    for (let i = 0; i < 4; i++) {
      cv.part(`stack${i}`);
      cv.ellipse([12, 25 - i * 3], 9, 3.2, RIM);
      cv.ellipse([12, 24.4 - i * 3], 8, 2.4, GOLD, { bias: 0.2 });
    }
    drawCoin(cv, 22, 20, 8.5);
    stack = toUrl(cv, SIZE, SIZE);
  }
  return stack;
}

/** Põe a moeda desenhada no CSS (todo `.gold` passa a mostrá-la). Chame uma vez ao abrir o jogo. */
export function installCoinStyle(): void {
  document.documentElement.style.setProperty('--coin', `url(${coinUrl()})`);
  document.documentElement.style.setProperty('--coin-stack', `url(${coinStackUrl()})`);
}
