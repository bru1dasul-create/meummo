// Os Marimbondos redesenhados (prototipos/pindorama-25d/js/creatures/marimbondo.js, da [arte]; a etapa 5 dos inimigos,
// 24/11): cada vespa pintada como o Birim e os outros bichos (sem as bolinhas), o enxame que se fecha no aviso com os
// ferrões para fora, o giro da ferroada mergulhando num anel largo, a pedra que passa pelo meio, o tranco para longe de
// quem bateu e as vespas caindo com as faíscas roxas.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Vec = { x: number; y: number; z: number };
type Wasp = { c: Vec; f: Vec; curl: number; fk: number };
type Parts = { groups: { balls: { c: Vec; r: number }[] }[]; paint?: (ctx: unknown, flash: number) => void; after?: (ctx: unknown) => void };
type Swarm = {
  pos: { x: number; y: number };
  seed: number;
  time: number;
  label: string;
  groundZ: number;
  recoilDir: { x: number; y: number };
  update: (dt: number, near: { hero: { x: number; y: number } } | null) => void;
  action: (kind: string, yaw?: number) => void;
  parts: (cam: unknown) => Parts;
  drawable: (cam: unknown, primary: boolean) => { draw: (ctx: unknown) => void; drawShadow: (ctx: unknown) => void };
  recoil: () => number;
  flash: () => number;
  _moment: () => unknown;
  _swarm: (st: unknown) => Wasp[];
};

/** Um caminho de mentira (o Path2D do navegador): aceita qualquer traço. */
class FakePath {
  constructor() {
    return new Proxy(this, { get: (target, prop) => (prop in target ? (target as Record<string | symbol, unknown>)[prop] : () => undefined) });
  }
}

function loadPD(): { create: (yaw: number) => Swarm; cam: unknown } {
  const sandbox: { window: { PD?: Record<string, unknown> }; Path2D: typeof FakePath } = { window: {}, Path2D: FakePath };
  for (const file of ['core/math.js', 'core/iso.js', 'core/shapes.js', 'creatures/creature.js', 'creatures/marimbondo.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => { zoom: number };
  const cam = new Camera();
  cam.zoom = 1;
  const C = PD.creatures as { create: (type: string, x: number, y: number, yaw: number) => Swarm };
  return {
    create: (yaw) => {
      const t = C.create('marimbondo', 0, 0, yaw);
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

function step(t: Swarm, secs: number, near: { hero: { x: number; y: number } } | null = HERO_FAR): void {
  for (let s = 0; s < secs - 1e-9; s += 1 / 60) t.update(1 / 60, near);
}

/** Quão longe do meio do enxame as vespas estão (cm, no chão): a média. */
function spread(t: Swarm): number {
  const ws = t._swarm(t._moment());
  return ws.reduce((s, w) => s + Math.hypot(w.c.x - t.pos.x, w.c.y - t.pos.y), 0) / ws.length;
}

describe('os Marimbondos redesenhados', () => {
  const { create, cam } = loadPD();

  it('são pintados (sem as bolinhas) em todos os lados e momentos, sem cor quebrada', () => {
    const moments: [string, (t: Swarm) => void][] = [
      ['voando', (t) => step(t, 1)],
      ['aviso', (t) => { t.action('windup', 0); step(t, 0.5); }],
      ['giro', (t) => { t.action('windup', 0); step(t, 0.6); t.action('spin', 0); step(t, 0.2); }],
      ['passou', (t) => { t.action('dodge'); step(t, 0.3); }],
      ['apanhou', (t) => { t.action('hurt'); step(t, 0.05); }],
      ['caídos', (t) => { t.action('die'); step(t, 0.5); }],
    ];
    for (const yaw of [0, 90, 180, 270]) {
      for (const [name, set] of moments) {
        const t = create(yaw * DEG);
        set(t);
        expect(t.parts(cam).paint, name).toBeTypeOf('function');
        const { ctx, fills, colors } = fakeCtx();
        const d = t.drawable(cam, false);
        d.drawShadow(ctx);
        d.draw(ctx);
        expect(fills(), `${name} ${yaw}°`).toBeGreaterThan(10);
        expect(colors.filter((c) => /NaN|undefined/.test(c)), `${name} ${yaw}°`).toEqual([]);
      }
    }
  });

  it('o aviso: o enxame se fecha, zune e as vespas curvam o ferrão; o giro: mergulham num anel largo e voltam', () => {
    const t = create(0);
    step(t, 1);
    const calm = spread(t);
    t.action('windup', 0);
    step(t, 0.5);
    expect(spread(t)).toBeLessThan(calm * 0.75);
    expect(t.label).toBe('zunindo');
    expect(Math.min(...t._swarm(t._moment()).map((w) => w.curl))).toBeGreaterThan(0.8);
    const high = Math.min(...t._swarm(t._moment()).map((w) => w.c.z));
    t.action('spin', 0);
    step(t, 0.3);
    expect(t.label).toBe('ferroando');
    expect(spread(t)).toBeGreaterThan(60); // o anel cobre a área em volta
    expect(Math.min(...t._swarm(t._moment()).map((w) => w.c.z))).toBeLessThan(high - 10); // mergulhando
    step(t, 1);
    expect(spread(t)).toBeLessThan(40); // voltaram
  });

  it('apanhando, o enxame dá um tranco para longe do herói e volta; a pedra que passa espalha as vespas', () => {
    for (const heroSide of [1, -1]) {
      const t = create(0);
      const near = { hero: { x: 300 * heroSide, y: 0 } };
      step(t, 0.5, near);
      t.action('hurt');
      expect(t.recoilDir.x).toBeCloseTo(-heroSide, 5);
      step(t, 0.06, near);
      expect(t.recoil()).toBeGreaterThan(0.9);
      expect(t.flash()).toBeLessThan(0.35);
      const ws = t._swarm(t._moment());
      const cx = ws.reduce((s, w) => s + w.c.x, 0) / ws.length;
      expect(cx * -heroSide).toBeGreaterThan(10);
      step(t, 0.6, near);
      expect(t.recoil()).toBe(0);
    }
    const d = create(0);
    step(d, 1);
    const before = spread(d);
    d.action('dodge');
    step(d, 0.35);
    expect(spread(d)).toBeGreaterThan(before + 15);
  });

  it('caídos: as vespas chegam no chão e o encanto sai em faíscas (por cima); voando, nada por cima', () => {
    const t = create(0);
    step(t, 0.5);
    t.action('die');
    step(t, 0.45);
    expect(t.label).toBe('caindo');
    for (const w of t._swarm(t._moment())) expect(w.c.z - t.groundZ).toBeLessThan(8);
    const { ctx, fills } = fakeCtx();
    t.parts(cam).after!(ctx);
    expect(fills()).toBeGreaterThan(10);
    const calm = create(0);
    step(calm, 0.5);
    const c = fakeCtx();
    calm.parts(cam).after!(c.ctx);
    expect(c.fills()).toBe(0);
  });
});
