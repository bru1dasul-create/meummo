// Desenho dos monstros pintados (monsterPaint.ts): todo quadro tem o monstro inteiro dentro da moldura, com os
// pés no chão, e as animações mudam o desenho (anda, abre a boca para o golpe).

import { describe, expect, it } from 'vitest';
import { MONSTER_ANIMS, PAINTED, paintedFrame, paintedFrameCount, paintMonster, type PaintedMonster } from '../src/client/game/monsterPaint';
import type { Sheet } from '../src/client/game/doll/sheet';

/** Caixa dos pixels desenhados num quadro da folha. */
function box(sheet: Sheet, art: PaintedMonster, index: number) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  let count = 0;
  for (let y = 0; y < art.height; y++) {
    for (let x = 0; x < art.width; x++) {
      if (!sheet.solid(index * art.width + x, y)) continue;
      count++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1, count };
}

/** Quantos pixels mudam de um quadro para o outro. */
function diff(sheet: Sheet, art: PaintedMonster, a: number, b: number): number {
  let n = 0;
  for (let y = 0; y < art.height; y++) {
    for (let x = 0; x < art.width; x++) {
      const i = (y * sheet.width + a * art.width + x) * 4;
      const j = (y * sheet.width + b * art.width + x) * 4;
      if (sheet.data[i] !== sheet.data[j] || sheet.data[i + 1] !== sheet.data[j + 1] || sheet.data[i + 2] !== sheet.data[j + 2] || sheet.data[i + 3] !== sheet.data[j + 3]) n++;
    }
  }
  return n;
}

describe('monstros pintados', () => {
  for (const [type, art] of Object.entries(PAINTED)) {
    const sheet = paintMonster(art);

    it(`${type}: todo quadro tem o monstro inteiro dentro da moldura, com os pés no chão`, () => {
      expect(sheet.width).toBe(art.width * paintedFrameCount(art));
      for (let i = 0; i < paintedFrameCount(art); i++) {
        const b = box(sheet, art, i);
        expect(b.count, `quadro ${i} vazio`).toBeGreaterThan(200);
        // nada encostado na beirada (senão o desenho foi cortado)
        expect(b.x0, `quadro ${i} cortado à esquerda`).toBeGreaterThan(0);
        expect(b.y0, `quadro ${i} cortado em cima`).toBeGreaterThan(0);
        expect(b.x1, `quadro ${i} cortado à direita`).toBeLessThan(art.width - 1);
        expect(b.y1, `quadro ${i} cortado embaixo`).toBeLessThan(art.height);
        // os pés (o contorno de baixo) ficam na linha do chão, mesmo andando
        expect(Math.abs(b.y1 + 1 - art.feet), `quadro ${i}: pés fora do chão`).toBeLessThanOrEqual(2);
      }
    });

    it(`${type}: as animações mudam o desenho`, () => {
      const idle = paintedFrame(art, 'idle', 0);
      const walk = Array.from({ length: art.frames.walk }, (_, f) => paintedFrame(art, 'walk', f));
      for (let f = 1; f < walk.length; f++) expect(diff(sheet, art, walk[0]!, walk[f]!), `andando ${f}`).toBeGreaterThan(20);
      // armando o golpe e golpeando: bem diferente de parado
      expect(diff(sheet, art, idle, paintedFrame(art, 'windup', 0))).toBeGreaterThan(80);
      expect(diff(sheet, art, idle, paintedFrame(art, 'attack', 0))).toBeGreaterThan(80);
    });
  }

  it('cada animação tem o seu pedaço da folha, e o quadro dá a volta', () => {
    const art = PAINTED.jacare!;
    const seen = new Set<number>();
    for (const anim of MONSTER_ANIMS) for (let f = 0; f < art.frames[anim]; f++) seen.add(paintedFrame(art, anim, f));
    expect(seen.size).toBe(paintedFrameCount(art));
    expect(paintedFrame(art, 'walk', art.frames.walk)).toBe(paintedFrame(art, 'walk', 0));
  });
});
