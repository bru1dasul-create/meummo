// O Tatu-bola redesenhado (prototipos/pindorama-25d/js/creatures/tatu.js, da [arte]; a etapa 3 dos inimigos, 24/11):
// pintado como o Birim, o sagui e o quati (sem as bolinhas), a carapaça que fecha numa bola de gomos, o aviso girando
// no lugar, a investida rolando de verdade até o pé que o servidor manda (e abrindo tonto só depois de parar), a casca
// segurando o golpe, o tranco para longe de quem bateu e o desmaio de barriga para cima com as faíscas roxas.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Vec = { x: number; y: number; z: number };
type Group = { balls: { c: Vec; r: number }[]; ref?: Vec };
type Parts = { groups: Group[]; paint?: (ctx: unknown, flash: number) => void; after?: (ctx: unknown) => void };
type Tatu = {
  pos: { x: number; y: number };
  yaw: number;
  seed: number;
  time: number;
  label: string;
  curl: number;
  spin: number;
  roll: unknown;
  dizzyT: number;
  recoilDir: { x: number; y: number };
  update: (dt: number, near: { hero: { x: number; y: number } } | null) => void;
  action: (kind: string, yaw?: number) => void;
  moveTo: (x: number, y: number, yaw: number, ms: number, dash?: boolean) => void;
  parts: (cam: unknown) => Parts;
  drawable: (cam: unknown, primary: boolean) => { draw: (ctx: unknown) => void; drawShadow: (ctx: unknown) => void };
  recoil: () => number;
  flash: () => number;
  _rig: (st: unknown) => { shell: { c: Vec; u: Vec } };
  _moment: () => unknown;
};

/** Um caminho de mentira (o Path2D do navegador): aceita qualquer traço. */
class FakePath {
  constructor() {
    return new Proxy(this, { get: (target, prop) => (prop in target ? (target as Record<string | symbol, unknown>)[prop] : () => undefined) });
  }
}

/** Carrega os scripts do protótipo (eles põem tudo no `window.PD`) sem navegador. */
function loadPD(): { create: (yaw: number) => Tatu; cam: unknown } {
  const sandbox: { window: { PD?: Record<string, unknown> }; Path2D: typeof FakePath } = { window: {}, Path2D: FakePath };
  for (const file of ['core/math.js', 'core/iso.js', 'core/shapes.js', 'creatures/creature.js', 'creatures/tatu.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => { zoom: number };
  const cam = new Camera();
  cam.zoom = 1;
  const C = PD.creatures as { create: (type: string, x: number, y: number, yaw: number) => Tatu };
  return {
    create: (yaw) => {
      const t = C.create('tatu_bola', 0, 0, yaw);
      t.seed = 0.37;
      t.time = 3.1;
      return t;
    },
    cam,
  };
}

/** Um contexto de desenho de mentira: conta os preenchimentos e guarda as cores usadas. */
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

/** Anda o relógio do tatu (60 quadros por segundo). */
function step(t: Tatu, secs: number, near: { hero: { x: number; y: number } } | null = HERO_FAR): void {
  for (let s = 0; s < secs - 1e-9; s += 1 / 60) t.update(1 / 60, near);
}

/** A investida como o servidor manda: o golpe, o tonto e o pé no fim da linha, tudo junto (de uma vez). */
function charge(t: Tatu, dist = 500): { x: number; y: number } {
  const end = { x: t.pos.x + dist * Math.cos(t.yaw), y: t.pos.y + dist * Math.sin(t.yaw) };
  t.action('charge', t.yaw);
  t.action('dizzy');
  t.moveTo(end.x, end.y, t.yaw, 140, true);
  return end;
}

describe('o Tatu-bola redesenhado', () => {
  const { create, cam } = loadPD();

  it('é pintado (sem as bolinhas) em todos os lados e momentos, sem cor quebrada', () => {
    const moments: [string, (t: Tatu) => void][] = [
      ['parado', (t) => step(t, 1)],
      ['andando', (t) => {
        for (let k = 0; k < 4; k++) {
          t.moveTo(t.pos.x + 100 * Math.cos(t.yaw), t.pos.y + 100 * Math.sin(t.yaw), t.yaw, 380);
          step(t, 0.38);
        }
      }],
      ['fechando', (t) => { t.action('windup', t.yaw); step(t, 0.15); }],
      ['girando', (t) => { t.action('windup', t.yaw); step(t, 0.8); }],
      ['rolando', (t) => { t.action('windup', t.yaw); step(t, 0.9); charge(t); step(t, 0.12); }],
      ['tonto', (t) => { t.action('dizzy'); step(t, 0.6); }],
      ['segurou', (t) => { t.action('block'); step(t, 0.1); }],
      ['apanhou', (t) => { t.action('hurt'); step(t, 0.05); }],
      ['caído', (t) => { t.action('die'); step(t, 0.5); }],
    ];
    for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
      for (const [name, set] of moments) {
        const t = create(yaw * DEG);
        set(t);
        const parts = t.parts(cam);
        expect(parts.paint, name).toBeTypeOf('function');
        const { ctx, fills, colors } = fakeCtx();
        const d = t.drawable(cam, false);
        d.drawShadow(ctx);
        d.draw(ctx);
        expect(fills(), `${name} ${yaw}°`).toBeGreaterThan(2); // (fechado na bola, são poucas peças)
        expect(colors.filter((c) => /NaN|undefined/.test(c)), `${name} ${yaw}°`).toEqual([]);
      }
    }
  });

  it('o aviso: fecha numa bola e gira no lugar, cada vez mais rápido', () => {
    const t = create(30 * DEG);
    step(t, 0.5);
    t.action('windup', t.yaw);
    step(t, 0.35);
    expect(t.curl).toBeGreaterThan(0.9); // fechou
    const s0 = t.spin;
    step(t, 0.2);
    const s1 = t.spin;
    step(t, 0.2);
    const s2 = t.spin;
    expect(s1 - s0).toBeGreaterThan(0.5); // gira
    expect(s2 - s1).toBeGreaterThan(s1 - s0); // cada vez mais rápido
    expect(Math.hypot(t.pos.x, t.pos.y)).toBeLessThan(1); // no lugar
    expect(t.label).toBe('fechando');
  });

  it('a investida rola até o fim (não pula de uma vez), freando, e abre tonto só depois de parar, de pé', () => {
    const t = create(20 * DEG);
    step(t, 0.5);
    t.action('windup', t.yaw);
    step(t, 1.0);
    const end = charge(t);
    // logo depois do golpe, ainda perto do começo (rolando), fechado e sem o tonto
    step(t, 1 / 60);
    expect(Math.hypot(t.pos.x, t.pos.y)).toBeLessThan(120);
    expect(t.label).toBe('rolando');
    expect(t.dizzyT).toBeGreaterThan(5);
    // anda freando: a primeira metade do tempo leva mais da metade do caminho
    step(t, 0.12);
    const mid = Math.hypot(t.pos.x, t.pos.y);
    expect(mid).toBeGreaterThan(250);
    expect(mid).toBeLessThan(500);
    step(t, 0.3);
    expect(Math.hypot(t.pos.x - end.x, t.pos.y - end.y)).toBeLessThan(0.5); // chegou
    expect(t.roll).toBeNull();
    // parou: a volta da bola é inteira (abre de pé) e o tonto começou
    expect(Math.abs(t.spin - Math.round(t.spin / (2 * Math.PI)) * 2 * Math.PI)).toBeLessThan(1e-6);
    expect(t.dizzyT).toBeLessThan(0.5);
    step(t, 0.4);
    expect(t.curl).toBeLessThan(0.1); // abriu
    expect(t.label).toBe('tonto');
  });

  it('a investida sem caminho (o servidor não mexe o pé) gira um pouco, abre e fica tonto', () => {
    const t = create(0);
    step(t, 0.5);
    t.action('windup', 0);
    step(t, 1.0);
    t.action('charge', 0);
    t.action('dizzy');
    step(t, 1.6);
    expect(t.curl).toBeLessThan(0.1);
    expect(t.dizzyT).toBeLessThan(1.6);
    expect(t.label).toBe('tonto');
  });

  it('a casca segurando um golpe não interrompe o aviso; o tranco do golpe vai para longe do herói e volta', () => {
    const t = create(0);
    step(t, 0.5);
    t.action('windup', 0);
    step(t, 0.4);
    t.action('block');
    step(t, 0.1);
    expect(t.label).toBe('fechando');
    expect(t.curl).toBeGreaterThan(0.9);
    for (const heroSide of [1, -1]) {
      const q = create(0);
      const near = { hero: { x: 300 * heroSide, y: 0 } };
      step(q, 0.5, near);
      q.action('hurt');
      expect(q.recoilDir.x).toBeCloseTo(-heroSide, 5);
      step(q, 0.06, near);
      expect(q.recoil()).toBeGreaterThan(0.9);
      expect(q.flash()).toBeLessThan(0.35);
      step(q, 0.6, near);
      expect(q.recoil()).toBe(0);
    }
  });

  it('desmaiado: vira de barriga para cima e o encanto sai em faíscas (por cima); de pé, nada por cima', () => {
    const t = create(0);
    step(t, 0.5);
    const up = t._rig(t._moment()).shell.u;
    expect(up.z).toBeGreaterThan(0.9); // a carapaça para cima
    t.action('die');
    step(t, 0.4);
    const down = t._rig(t._moment()).shell.u;
    expect(down.z).toBeLessThan(-0.9); // de barriga para cima
    const parts = t.parts(cam);
    const { ctx, fills } = fakeCtx();
    parts.after!(ctx);
    expect(fills()).toBeGreaterThan(10);
    const calm = create(0);
    step(calm, 0.5);
    const c = fakeCtx();
    calm.parts(cam).after!(c.ctx);
    expect(c.fills()).toBe(0);
  });
});
