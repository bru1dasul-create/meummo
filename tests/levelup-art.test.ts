// Desenho do efeito de subir de nível (prototipos/pindorama-25d/js/levelup.js, da [arte]): as cores de cada caso, os
// anéis passando por fora dos braços do Birim e as três passadas (chão, atrás e na frente do corpo), que somem no fim.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Look = { big: boolean; rgb: number[]; pale: number[] };
type Fx = {
  draw: (ctx: unknown, cam: unknown, foot: { x: number; y: number; z: number }, t: number, look: Look, pass: string) => void;
  look: (what: string, skill?: string) => Look;
  duration: (look: Look) => number;
  light: (look: Look, t: number) => number;
  radiusAt: (h: number) => number;
};

/** Carrega os scripts do protótipo (eles põem tudo no `window.PD`) sem navegador. */
function loadPD(): { fx: Fx; cam: unknown } {
  const sandbox: { window: { PD?: Record<string, unknown> } } = { window: {} };
  for (const file of ['core/math.js', 'core/iso.js', 'levelup.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => { zoom: number };
  const cam = new Camera();
  cam.zoom = 1;
  return { fx: PD.levelUpFx as Fx, cam };
}

/** Um contexto de desenho de mentira: conta os traços e os preenchimentos. */
function fakeCtx(): { ctx: unknown; marks: () => number } {
  let marks = 0;
  const state: Record<string | symbol, unknown> = {};
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      return () => {
        if (prop === 'stroke' || prop === 'fill') marks++;
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx, marks: () => marks };
}

describe('efeito de subir de nível', () => {
  const { fx, cam } = loadPD();
  const foot = { x: 500, y: 300, z: 0 };

  it('nível em dourado e maior; o ponto de cada habilidade na cor dela', () => {
    const level = fx.look('level');
    expect(level.big).toBe(true);
    expect(fx.duration(level)).toBeGreaterThan(fx.duration(fx.look('skill', 'chuva')));
    const flecha = fx.look('skill', 'flecha');
    const chuva = fx.look('skill', 'chuva');
    const olhos = fx.look('skill', 'olhos');
    expect(flecha.big).toBe(false);
    // verde, azul e âmbar: cada uma com a sua cor mais forte
    expect(flecha.rgb[1]).toBeGreaterThan(flecha.rgb[0]);
    expect(chuva.rgb[2]).toBeGreaterThan(chuva.rgb[0]);
    expect(olhos.rgb[0]).toBeGreaterThan(olhos.rgb[2]);
    // a Chuva não pode ficar parecida com o dourado do nível
    expect(chuva.rgb).not.toEqual(level.rgb);
    // uma habilidade sem cor própria ainda tem efeito
    expect(fx.look('skill', 'outra').rgb).toHaveLength(3);
  });

  it('os anéis passam por fora dos braços e só fecham acima dos ombros', () => {
    // medido no Birim (23/11): parado, o braço chega a ~38 cm do meio do corpo; andando, 44
    for (let h = 0; h <= 135; h += 5) expect(fx.radiusAt(h)).toBeGreaterThanOrEqual(54);
    expect(fx.radiusAt(195)).toBeLessThanOrEqual(32);
    for (let h = 0; h < 210; h += 5) expect(fx.radiusAt(h + 5)).toBeLessThanOrEqual(fx.radiusAt(h));
  });

  it('desenha nas três passadas durante o efeito e nada depois', () => {
    for (const look of [fx.look('level'), fx.look('skill', 'olhos')]) {
      for (const pass of ['chao', 'tras', 'frente']) {
        const during = fakeCtx();
        fx.draw(during.ctx, cam, foot, 0.4, look, pass);
        expect(during.marks()).toBeGreaterThan(0);
        const after = fakeCtx();
        fx.draw(after.ctx, cam, foot, fx.duration(look) + 0.05, look, pass);
        expect(after.marks()).toBe(0);
        const before = fakeCtx();
        fx.draw(before.ctx, cam, foot, -0.1, look, pass);
        expect(before.marks()).toBe(0);
      }
    }
  });

  it('acende uma luz na noite só enquanto dura, na cor do efeito', () => {
    for (const look of [fx.look('level'), fx.look('skill', 'chuva')]) {
      expect(fx.light(look, -0.1)).toBe(0);
      expect(fx.light(look, 0.5)).toBeGreaterThan(0.5);
      expect(fx.light(look, fx.duration(look) + 0.05)).toBe(0);
      expect((look as Look & { hex: string }).hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('a estrela em cima da cabeça só no nível', () => {
    const star = (look: Look) => {
      const f = fakeCtx();
      fx.draw(f.ctx, cam, foot, 1.15, look, 'frente');
      return f.marks();
    };
    // no mesmo instante, o nível desenha mais (a estrela e os raios) que um ponto de habilidade parecido
    const level = fx.look('level');
    expect(star(level)).toBeGreaterThan(star({ ...level, big: false }));
  });
});
