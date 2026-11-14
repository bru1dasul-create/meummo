// Desenho dos tiros que param sem acertar ninguém (projectileArt.ts, da [arte]): a flecha crava no chão, na madeira
// (na altura em que bateu; do lado de lá do tronco, escondida), quica na pedra e mergulha na água; a pedra levanta poeira.
// Cada um some depois do seu tempo, e a camada do combate fica acesa enquanto algum está à vista.

import { describe, expect, it } from 'vitest';
import { drawLanded, landedBusy, projectileEnded } from '../src/client/novo/projectileArt';

/** Um contexto de desenho de mentira: anota o nome de cada chamada (o teste roda sem navegador). */
function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const state: Record<string | symbol, unknown> = { globalAlpha: 1, lineWidth: 1 };
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      return (..._args: unknown[]) => {
        calls.push(String(prop));
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const screen = (x: number, y: number, z = 0) => ({ x: (x - y) * 50, y: (x + y) * 25 - z * 43 });
const meter = () => 70;

/** Desenha um quadro só daqui a `ms` e devolve as chamadas. */
function frameAt(now: number): string[] {
  const { ctx, calls } = fakeCtx();
  drawLanded(ctx, screen, meter, now);
  return calls;
}

/** Limpa o que ficou de outro teste (tudo já sumiu num futuro distante). */
function clear(now: number): void {
  frameAt(now + 1e6);
}

describe('flecha e pedra que param sem acertar ninguém', () => {
  it('crava no chão no fim do alcance e some depois de uns 2 s', () => {
    const t = 1000;
    clear(0);
    projectileEnded('flecha', 10, 10, 0, t);
    expect(landedBusy(t)).toBe(true);
    expect(frameAt(t + 500)).toContain('stroke');
    expect(landedBusy(t + 2100)).toBe(false);
    frameAt(t + 2100);
    expect(landedBusy(t + 1)).toBe(false);
  });

  it('crava no tronco na altura em que bateu; vindo na direção da câmera, o tronco esconde a flecha', () => {
    let t = 1e7;
    clear(t);
    // indo para o oeste (−x): bate no lado do tronco que a câmera vê, a haste aparece
    projectileEnded('flecha', 10, 10, Math.PI, t, { on: 'tronco', z: 0.9 });
    expect(frameAt(t + 500)).toContain('stroke');
    clear(t);
    t = 2e7;
    // indo para +x +y (na direção da câmera): bate no lado de lá; depois das lascas, nada aparece
    projectileEnded('flecha', 10, 10, Math.PI / 4, t, { on: 'tronco', z: 0.9 });
    const later = frameAt(t + 500);
    expect(later).not.toContain('stroke');
    expect(landedBusy(t + 500)).toBe(true);
    clear(t);
  });

  it('quica na pedra e fica deitada no chão', () => {
    const t = 3e7;
    clear(t);
    projectileEnded('flecha', 10, 10, 0, t, { on: 'pedra', z: 0.9 });
    expect(frameAt(t + 100)).toContain('stroke');
    expect(frameAt(t + 600)).toContain('stroke');
    expect(landedBusy(t + 2000)).toBe(true);
    expect(landedBusy(t + 2100)).toBe(false);
    clear(t);
    // do lado de lá da pedra: só a faísca, a flecha caída fica escondida atrás dela
    projectileEnded('flecha', 10, 10, Math.PI / 4, t + 10, { on: 'pedra', z: 0.9 });
    expect(frameAt(t + 600)).not.toContain('stroke');
    clear(t);
  });

  it('cai na água: a flecha mergulha, o esguicho e os anéis, e some em menos de 1 s', () => {
    const t = 4e7;
    clear(t);
    projectileEnded('flecha', 10, 10, 0, t, { on: 'agua', z: 0.9 });
    const start = frameAt(t + 100);
    expect(start).toContain('ellipse'); // os anéis e o esguicho
    expect(start).toContain('clip'); // a flecha entrando, cortada na linha da água
    expect(frameAt(t + 600)).not.toContain('clip'); // já afundou: só os anéis
    expect(landedBusy(t + 850)).toBe(true);
    expect(landedBusy(t + 901)).toBe(false);
    clear(t);
  });

  it('a pedra do estilingue só levanta poeira onde bateu', () => {
    const t = 5e7;
    clear(t);
    projectileEnded('pedra', 10, 10, 0, t, { on: 'tronco', z: 0.9 });
    expect(frameAt(t + 100)).toContain('arc');
    expect(landedBusy(t + 381)).toBe(false);
    projectileEnded('pedra', 10, 10, 0, t + 1000);
    expect(landedBusy(t + 1100)).toBe(true);
    clear(t);
  });
});
