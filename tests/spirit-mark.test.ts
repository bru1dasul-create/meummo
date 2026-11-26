// A runa da Flecha Ancestral em cima do bicho marcado (src/client/novo/spiritArt.ts, da [arte], 26/11): a 2,02 m fixos,
// ela caía na cara da Cuca chefe (2,16 m de alto, conferido no jogo). Agora vai na altura que o motor manda, logo acima
// da barra de vida de quem foi marcado (`barra + MARK_OVER_BAR`); sem ela, a de sempre.

import { describe, expect, it } from 'vitest';
import { MARK_OVER_BAR, paintSpiritMark } from '../src/client/novo/spiritArt';

/** Um canvas de mentira: aceita qualquer desenho. */
function fakeCtx(): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const gradient = { addColorStop: () => undefined };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('a runa da Flecha Ancestral', () => {
  /** As alturas (m) que o desenho pediu à câmera. */
  const heights = (z?: number): number[] => {
    const asked: number[] = [];
    const screen = (x: number, y: number, h = 0) => {
      asked.push(h);
      return { x: x * 50, y: y * 30 - h * 60 };
    };
    paintSpiritMark(fakeCtx(), { x: 3, y: 4 }, 5000, 1000, screen, () => 50, z);
    return asked;
  };

  it('vai na altura que o motor manda: logo acima da barra de quem foi marcado', () => {
    const bar = 2.54; // a barra da Cuca chefe, acima do nome
    const asked = heights(bar + MARK_OVER_BAR);
    expect(asked).toContain(bar + MARK_OVER_BAR);
    expect(asked).not.toContain(2.02);
  });

  it('sem a altura do motor, fica na de sempre (acima da barra a 1,72 m)', () => {
    expect(heights()).toContain(2.02);
    expect(1.72 + MARK_OVER_BAR).toBeCloseTo(2.02);
  });
});
