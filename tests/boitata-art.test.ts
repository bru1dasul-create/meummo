// O Filhote de Boitatá redesenhado (prototipos/pindorama-25d/js/creatures/boitata.js, da [arte]; a etapa 6 dos
// inimigos, 24/11): o corpo de chama pintado (sem as bolinhas), o aviso com a cabeça erguida e o fogo dobrando, a
// investida correndo de verdade pelo caminho (antes pulava os 6 m de uma vez), o tranco para longe de quem bateu, o
// desmaio apagando com as faíscas roxas e o amanhecer só apagando.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Vec = { x: number; y: number; z: number };
type Body = { pts: (Vec & { r: number })[]; blaze: number; lit: number };
type Fire = {
  pos: { x: number; y: number };
  yaw: number;
  seed: number;
  time: number;
  label: string;
  coil: number;
  recoilDir: { x: number; y: number };
  update: (dt: number, near: { hero: { x: number; y: number } } | null) => void;
  action: (kind: string, yaw?: number) => void;
  moveTo: (x: number, y: number, yaw: number, ms: number, dash?: boolean) => void;
  parts: (cam: unknown) => { paint?: (ctx: unknown, flash: number) => void; after?: (ctx: unknown) => void };
  drawable: (cam: unknown, primary: boolean) => { draw: (ctx: unknown) => void; drawShadow: (ctx: unknown) => void };
  recoil: () => number;
  flash: () => number;
  _body: () => Body;
};

class FakePath {
  constructor() {
    return new Proxy(this, { get: (target, prop) => (prop in target ? (target as Record<string | symbol, unknown>)[prop] : () => undefined) });
  }
}

function loadPD(): { create: (yaw: number) => Fire; cam: unknown } {
  const sandbox: { window: { PD?: Record<string, unknown> }; Path2D: typeof FakePath } = { window: {}, Path2D: FakePath };
  for (const file of ['core/math.js', 'core/iso.js', 'core/shapes.js', 'creatures/creature.js', 'creatures/boitata.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => { zoom: number };
  const cam = new Camera();
  cam.zoom = 1;
  const C = PD.creatures as { create: (type: string, x: number, y: number, yaw: number) => Fire };
  return {
    create: (yaw) => {
      const t = C.create('filhote_boitata', 0, 0, yaw);
      t.seed = 0.37;
      t.time = 3.1;
      return t;
    },
    cam,
  };
}

function fakeCtx(): { ctx: unknown; fills: () => number; colors: string[] } {
  let fills = 0;
  const colors: string[] = [];
  const state: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      return () => {
        if (prop === 'fill' || prop === 'fillRect') fills++;
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      if (prop === 'fillStyle' || prop === 'strokeStyle') colors.push(String(value));
      return true;
    },
  });
  return { ctx, fills: () => fills, colors };
}

const DEG = Math.PI / 180;
const HERO_FAR = { hero: { x: 5000, y: 5000 } };

function step(t: Fire, secs: number, near: { hero: { x: number; y: number } } | null = HERO_FAR): void {
  for (let s = 0; s < secs - 1e-9; s += 1 / 60) t.update(1 / 60, near);
}

/** A investida como o servidor manda: o golpe e o pé 6 m adiante de uma vez. */
function charge(t: Fire): { x: number; y: number } {
  const end = { x: t.pos.x + 600 * Math.cos(t.yaw), y: t.pos.y + 600 * Math.sin(t.yaw) };
  t.action('charge', t.yaw);
  t.moveTo(end.x, end.y, t.yaw, 140, true);
  return end;
}

describe('o Filhote de Boitatá redesenhado', () => {
  const { create, cam } = loadPD();

  it('é pintado (sem as bolinhas) em todos os lados e momentos, sem cor quebrada', () => {
    const moments: [string, (t: Fire) => void][] = [
      ['parado', (t) => step(t, 1)],
      ['aviso', (t) => { t.action('windup', t.yaw); step(t, 0.8); }],
      ['investida', (t) => { t.action('windup', t.yaw); step(t, 0.9); charge(t); step(t, 0.12); }],
      ['apanhou', (t) => { t.action('hurt'); step(t, 0.05); }],
      ['caindo', (t) => { t.action('die'); step(t, 0.3); }],
      ['amanhecendo', (t) => { t.action('vanish'); step(t, 0.3); }],
    ];
    for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
      for (const [name, set] of moments) {
        const t = create(yaw * DEG);
        step(t, 0.3);
        set(t);
        expect(t.parts(cam).paint, name).toBeTypeOf('function');
        const { ctx, fills, colors } = fakeCtx();
        const d = t.drawable(cam, false);
        d.drawShadow(ctx);
        d.draw(ctx);
        expect(fills(), `${name} ${yaw}°`).toBeGreaterThan(8);
        expect(colors.filter((c) => /NaN|undefined/.test(c)), `${name} ${yaw}°`).toEqual([]);
      }
    }
  });

  it('o aviso: encolhe, ergue a cabeça bem alto e o fogo dobra', () => {
    const t = create(30 * DEG);
    step(t, 0.5);
    const rest = t._body().pts[0].z;
    t.action('windup', t.yaw);
    step(t, 0.8);
    expect(t.label).toBe('preparando');
    expect(t.coil).toBeGreaterThan(0.9);
    const b = t._body();
    expect(b.pts[0].z).toBeGreaterThan(rest + 20);
    expect(b.blaze).toBeGreaterThan(0.8);
  });

  it('a investida corre de verdade pelo caminho (não pula os 6 m de uma vez) e o corpo vem atrás', () => {
    const t = create(20 * DEG);
    step(t, 0.5);
    t.action('windup', t.yaw);
    step(t, 0.9);
    const end = charge(t);
    step(t, 1 / 60);
    expect(Math.hypot(t.pos.x, t.pos.y)).toBeLessThan(120); // ainda perto do começo
    expect(t.label).toBe('investindo');
    step(t, 0.15);
    const mid = Math.hypot(t.pos.x, t.pos.y);
    expect(mid).toBeGreaterThan(150);
    expect(mid).toBeLessThan(560);
    step(t, 0.4);
    expect(Math.hypot(t.pos.x - end.x, t.pos.y - end.y)).toBeLessThan(0.5); // chegou
    // o rabo ficou na linha da investida, atrás da cabeça
    const pts = t._body().pts;
    const tail = pts[pts.length - 1];
    const f = { x: Math.cos(20 * DEG), y: Math.sin(20 * DEG) };
    expect(Math.abs((tail.x - t.pos.x) * -f.y + (tail.y - t.pos.y) * f.x)).toBeLessThan(30);
    expect((t.pos.x - tail.x) * f.x + (t.pos.y - tail.y) * f.y).toBeGreaterThan(90);
  });

  it('apanhando, dá um tranco para longe do herói e volta, com o clarão fraco', () => {
    for (const heroSide of [1, -1]) {
      const t = create(90 * DEG);
      const near = { hero: { x: 300 * heroSide, y: 0 } };
      step(t, 0.5, near);
      const h0 = t._body().pts[0];
      t.action('hurt');
      expect(t.recoilDir.x).toBeCloseTo(-heroSide, 5);
      step(t, 0.06, near);
      expect(t.recoil()).toBeGreaterThan(0.9);
      expect(t.flash()).toBeLessThan(0.35);
      const h1 = t._body().pts[0];
      expect((h1.x - h0.x) * -heroSide).toBeGreaterThan(8);
      step(t, 0.6, near);
      expect(t.recoil()).toBe(0);
    }
  });

  it('caindo, apaga e o encanto sai em faíscas roxas; ao amanhecer só apaga (sem as faíscas)', () => {
    const t = create(0);
    step(t, 0.5);
    t.action('die');
    step(t, 0.3);
    expect(t.label).toBe('apagando');
    expect(t._body().lit).toBeLessThan(0.6);
    const a = fakeCtx();
    t.parts(cam).after!(a.ctx);
    expect(a.colors.filter((c) => c === '#b58cff').length).toBeGreaterThan(3);
    const v = create(0);
    step(v, 0.5);
    v.action('vanish');
    step(v, 0.3);
    const b = fakeCtx();
    v.parts(cam).after!(b.ctx);
    expect(b.colors.filter((c) => c === '#b58cff').length).toBe(0);
    expect(b.fills()).toBeGreaterThan(0); // a fumaça
  });
});
