// A fumaça de virar da Cuca (prototipos/pindorama-25d/js/smoke.js, da [arte]; "uma luta por noite", 25/11): ao anoitecer
// a bruxa vira a chefe e ao amanhecer a chefe vira a bruxa, numa nuvem roxa e verde que sobe girando. As três passadas
// (o chão, a de trás e a da frente), cheia já no primeiro quadro (cobre a troca de desenho), abrindo e sumindo no fim;
// a luz roxa no escuro; a caixa na tela; cada fumaça diferente pela semente, e a mesma semente sempre igual.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Vec = { x: number; y: number; z: number };
type Box = { x0: number; x1: number; y0: number; y1: number };
type Smoke = {
  DURATION: number;
  draw: (ctx: unknown, cam: unknown, foot: Vec, t: number, seed: number, layer: string) => void;
  bounds: (cam: unknown, foot: Vec) => Box;
  light: (t: number) => number;
  puffsOf: (seed: number) => { a0: number; z0: number }[];
};
type Cam = { zoom: number; p: (pt: Vec) => { x: number; y: number } };

function loadPD(): { fx: Smoke; cam: Cam } {
  const sandbox: { window: { PD?: Record<string, unknown> } } = { window: {} };
  for (const file of ['core/math.js', 'core/iso.js', 'smoke.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => Cam;
  const cam = new Camera();
  cam.zoom = 1;
  return { fx: PD.smokeFx as Smoke, cam };
}

/** Um contexto de desenho de mentira: conta os preenchimentos e os traços e guarda as cores e a transparência. */
function fakeCtx(): { ctx: unknown; marks: () => number; colors: string[]; alphas: number[] } {
  let marks = 0;
  const colors: string[] = [];
  const alphas: number[] = [];
  const state: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const gradient = {
    addColorStop: (_at: number, c: string) => {
      colors.push(c);
    },
  };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      return () => {
        if (prop === 'stroke' || prop === 'fill' || prop === 'drawImage') marks++;
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      if (prop === 'fillStyle' || prop === 'strokeStyle') colors.push(String(value));
      if (prop === 'globalAlpha') alphas.push(Number(value));
      return true;
    },
  });
  return { ctx, marks: () => marks, colors, alphas };
}

describe('a fumaça de virar (a Cuca)', () => {
  const { fx, cam } = loadPD();
  const foot = { x: 500, y: 300, z: 0 };

  it('desenha nas três passadas enquanto dura e some no fim, sem cor quebrada', () => {
    for (const t of [0.02, 0.2, 0.5, 0.9]) {
      for (const layer of ['chao', 'tras', 'frente']) {
        const { ctx, marks, colors } = fakeCtx();
        fx.draw(ctx, cam, foot, t, 0.42, layer);
        if (layer !== 'chao' || t < 0.6) expect(marks(), `${layer} ${t}`).toBeGreaterThan(0);
        expect(colors.filter((c) => /NaN|undefined/.test(c)), `${layer} ${t}`).toEqual([]);
      }
    }
    for (const t of [-0.1, fx.DURATION + 0.01, 5]) {
      const { ctx, marks } = fakeCtx();
      for (const layer of ['chao', 'tras', 'frente']) fx.draw(ctx, cam, foot, t, 0.42, layer);
      expect(marks(), `${t}`).toBe(0);
    }
  });

  it('cheia no primeiro quadro (cobre a troca de desenho) e rala depois de meio segundo', () => {
    const strongest = (t: number): number => {
      const { ctx, alphas } = fakeCtx();
      fx.draw(ctx, cam, foot, t, 0.42, 'frente');
      return Math.max(0, ...alphas.filter((a) => a < 1));
    };
    expect(strongest(1 / 60)).toBeGreaterThan(0.9);
    expect(strongest(0.8)).toBeLessThan(0.5);
  });

  it('os tufos dos dois lados do corpo (uns atrás, outros na frente) e cada fumaça diferente', () => {
    const puffs = fx.puffsOf(0.42);
    const front = puffs.filter((p) => Math.cos(p.a0) + Math.sin(p.a0) > 0).length;
    expect(front).toBeGreaterThan(3);
    expect(puffs.length - front).toBeGreaterThan(3);
    expect(fx.puffsOf(0.42)).toEqual(puffs);
    expect(fx.puffsOf(0.77)).not.toEqual(puffs);
    expect(new Set(puffs.map((p) => Math.round(p.z0))).size).toBeGreaterThan(10); // do pé até acima da cabeça
  });

  it('a luz roxa acende rápido e apaga junto; a caixa cobre do chão até bem acima da cabeça', () => {
    expect(fx.light(0.05)).toBeGreaterThan(0.5);
    expect(fx.light(0.12)).toBeGreaterThan(0.9);
    expect(fx.light(1.2)).toBe(0);
    expect(fx.light(-1)).toBe(0);
    const b = fx.bounds(cam, foot);
    const lo = cam.p(foot);
    const hi = cam.p({ ...foot, z: 220 });
    expect(b.x0).toBeLessThan(lo.x - 100);
    expect(b.x1).toBeGreaterThan(lo.x + 100);
    expect(b.y0).toBeLessThan(hi.y);
    expect(b.y1).toBeGreaterThan(lo.y);
  });
});
