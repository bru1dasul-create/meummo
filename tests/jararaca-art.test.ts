// A Jararaca redesenhada (prototipos/pindorama-25d/js/creatures/jararaca.js, da [arte]; a etapa 4 dos inimigos, 24/11):
// pintada como o Birim, o sagui, o quati e o tatu (sem as bolinhas), o corpo em trechos que entram na sua vez pela
// distância da câmera, a rodilha com o pescoço armando no aviso, o bote que dispara a cabeça ~1,4 m de boca aberta e
// volta, o tranco para longe de quem bateu e o desmaio de barriga para cima com as faíscas roxas.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Vec = { x: number; y: number; z: number };
type Group = { balls: { c: Vec; r: number }[]; ref?: Vec };
type Parts = { groups: Group[]; paint?: (ctx: unknown, flash: number) => void; after?: (ctx: unknown) => void };
type Body = { pts: Vec[]; U: Vec[]; head: { c: Vec; f: Vec }; st: { open: number; strike: number } };
type Snake = {
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
  parts: (cam: unknown) => Parts;
  drawable: (cam: unknown, primary: boolean) => { draw: (ctx: unknown) => void; drawShadow: (ctx: unknown) => void };
  recoil: () => number;
  flash: () => number;
  _moment: () => { open: number; strike: number; coil: number };
  _body: (cam: unknown, st: unknown) => Body;
  _runs: (B: Body, small: boolean) => { a: number; b: number; folded: boolean }[];
};

/** Um caminho de mentira (o Path2D do navegador): aceita qualquer traço. */
class FakePath {
  constructor() {
    return new Proxy(this, { get: (target, prop) => (prop in target ? (target as Record<string | symbol, unknown>)[prop] : () => undefined) });
  }
}

/** Carrega os scripts do protótipo (eles põem tudo no `window.PD`) sem navegador. */
function loadPD(): { create: (yaw: number) => Snake; cam: unknown } {
  const sandbox: { window: { PD?: Record<string, unknown> }; Path2D: typeof FakePath } = { window: {}, Path2D: FakePath };
  for (const file of ['core/math.js', 'core/iso.js', 'core/shapes.js', 'creatures/creature.js', 'creatures/jararaca.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => { zoom: number };
  const cam = new Camera();
  cam.zoom = 1;
  const C = PD.creatures as { create: (type: string, x: number, y: number, yaw: number) => Snake };
  return {
    create: (yaw) => {
      const t = C.create('jararaca', 0, 0, yaw);
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
/** O comprimento do corpo (cm): 170 × o tamanho de jogo (1,15). */
const LEN = 170 * 1.15;

/** Anda o relógio da cobra (60 quadros por segundo). */
function step(t: Snake, secs: number, near: { hero: { x: number; y: number } } | null = HERO_FAR): void {
  for (let s = 0; s < secs - 1e-9; s += 1 / 60) t.update(1 / 60, near);
}

/** O bote como o servidor manda: o aviso (0,65 s) e, no fim dele, o 'strike'. */
function strike(t: Snake): void {
  t.action('windup', t.yaw);
  step(t, 0.65);
  t.action('strike', t.yaw);
}

/** O comprimento do meio do corpo (cm), somando os pedacinhos. */
function length(pts: Vec[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
  return l;
}

describe('a Jararaca redesenhada', () => {
  const { create, cam } = loadPD();
  const body = (t: Snake): Body => t._body(cam, t._moment());

  it('é pintada (sem as bolinhas) em todos os lados e momentos, sem cor nem ponto quebrado', () => {
    const moments: [string, (t: Snake) => void][] = [
      ['parada', (t) => step(t, 1)],
      ['rastejando', (t) => {
        for (let k = 0; k < 4; k++) {
          t.moveTo(t.pos.x + 100 * Math.cos(t.yaw), t.pos.y + 100 * Math.sin(t.yaw), t.yaw, 400);
          step(t, 0.4);
        }
      }],
      ['enrolando', (t) => { t.action('windup', t.yaw); step(t, 0.08); }],
      ['aviso', (t) => { t.action('windup', t.yaw); step(t, 0.6); }],
      ['bote', (t) => { strike(t); step(t, 0.06); }],
      ['voltando', (t) => { strike(t); step(t, 0.3); }],
      ['apanhou', (t) => { t.action('hurt'); step(t, 0.05); }],
      ['caindo', (t) => { t.action('die'); step(t, 0.15); }],
      ['caída', (t) => { t.action('die'); step(t, 0.5); }],
    ];
    for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
      for (const [name, set] of moments) {
        const t = create(yaw * DEG);
        step(t, 0.3);
        set(t);
        const parts = t.parts(cam);
        expect(parts.paint, name).toBeTypeOf('function');
        const pts = body(t).pts;
        expect(pts.every((p) => Number.isFinite(p.x + p.y + p.z)), `${name} ${yaw}°`).toBe(true);
        const { ctx, fills, colors } = fakeCtx();
        const d = t.drawable(cam, false);
        d.drawShadow(ctx);
        d.draw(ctx);
        expect(fills(), `${name} ${yaw}°`).toBeGreaterThan(4);
        expect(colors.filter((c) => /NaN|undefined/.test(c)), `${name} ${yaw}°`).toEqual([]);
      }
    }
  });

  it('o corpo não estica nem encolhe à toa: enrolada e no bote tem o comprimento dela (esticada, a onda do S soma uns 18%)', () => {
    const t = create(30 * DEG);
    step(t, 0.5);
    const flat = length(body(t).pts);
    expect(flat).toBeGreaterThan(LEN);
    expect(flat).toBeLessThan(LEN * 1.25);
    t.action('windup', t.yaw);
    step(t, 0.6);
    expect(Math.abs(length(body(t).pts) - LEN)).toBeLessThan(LEN * 0.08);
    t.action('strike', t.yaw);
    step(t, 0.1);
    expect(Math.abs(length(body(t).pts) - LEN)).toBeLessThan(LEN * 0.08);
  });

  it('o aviso: se enrola no lugar, ergue a cabeça e a ponta do rabo treme', () => {
    const t = create(30 * DEG);
    step(t, 0.5);
    t.action('windup', t.yaw);
    step(t, 0.5);
    expect(t.coil).toBeGreaterThan(0.95);
    expect(t.label).toBe('preparando');
    expect(Math.hypot(t.pos.x, t.pos.y)).toBeLessThan(1); // no lugar
    const b = body(t);
    expect(b.head.c.z).toBeGreaterThan(30); // a cabeça erguida em cima da rodilha
    // a rodilha: o corpo todo perto do pé (cabe num círculo de ~35 cm)
    expect(Math.max(...b.pts.map((p) => Math.hypot(p.x, p.y)))).toBeLessThan(60);
    // o rabo treme (em 6 quadros ele vai e volta uns centímetros) e o meio do corpo fica parado
    const tail0 = b.pts[b.pts.length - 1], mid0 = b.pts[30];
    let tailMove = 0, midMove = 0;
    for (let k = 0; k < 6; k++) {
      step(t, 1 / 60);
      const b2 = body(t);
      const tail1 = b2.pts[b2.pts.length - 1], mid1 = b2.pts[30];
      tailMove = Math.max(tailMove, Math.hypot(tail1.x - tail0.x, tail1.y - tail0.y));
      midMove = Math.max(midMove, Math.hypot(mid1.x - mid0.x, mid1.y - mid0.y));
    }
    expect(tailMove).toBeGreaterThan(1.5);
    expect(midMove).toBeLessThan(0.3);
  });

  it('o bote: a cabeça dispara ~1,4 m para a frente de boca aberta e volta para a rodilha', () => {
    for (const yaw of [0, 120, 250]) {
      const t = create(yaw * DEG);
      step(t, 0.5);
      strike(t);
      const f = { x: Math.cos(yaw * DEG), y: Math.sin(yaw * DEG) };
      const ahead = () => {
        const h = body(t).head.c;
        return h.x * f.x + h.y * f.y;
      };
      expect(ahead()).toBeLessThan(10); // armada, atrás do pé
      step(t, 0.06);
      expect(t._moment().open).toBeGreaterThan(0.9); // boca escancarada
      step(t, 0.05);
      expect(ahead()).toBeGreaterThan(120); // lá na frente
      expect(t.label).toBe('bote');
      step(t, 0.5);
      expect(ahead()).toBeLessThan(10); // voltou
      expect(t._moment().open).toBeLessThan(0.05);
      expect(t.coil).toBeGreaterThan(0.9); // ainda enrolada (fica um tempo depois do golpe)
    }
  });

  it('o lombo segue o corpo sem virar de repente (no pescoço erguido também) e, no chão, fica para cima', () => {
    const check = (t: Snake) => {
      const { U, pts } = body(t);
      for (let i = 1; i < U.length; i++) {
        const d = U[i].x * U[i - 1].x + U[i].y * U[i - 1].y + U[i].z * U[i - 1].z;
        expect(d, `ponto ${i}`).toBeGreaterThan(0.75);
      }
      // a ponta do rabo está no chão: o lombo dela é para cima
      expect(U[U.length - 1].z).toBeGreaterThan(0.95);
      expect(pts.length).toBe(U.length);
    };
    for (const yaw of [10, 100, 200, 290]) {
      const t = create(yaw * DEG);
      step(t, 0.5);
      check(t);
      t.action('windup', t.yaw);
      step(t, 0.6);
      check(t);
      t.action('strike', t.yaw);
      step(t, 0.08);
      check(t);
    }
  });

  it('esticada de lado na tela é um trecho só (leve); enrolada, as voltas viram trechos que entram na sua vez', () => {
    // (deitada no sentido da câmera, as curvas do S dobram na tela e ela também vira trechos)
    for (const yaw of [100, 130, 290, 320]) {
      const t = create(yaw * DEG);
      step(t, 0.5);
      expect(t._runs(body(t), false).length, `${yaw}°`).toBe(1);
    }
    for (const yaw of [0, 60, 120, 180, 240, 300]) {
      const t = create(yaw * DEG);
      step(t, 0.5);
      t.action('windup', t.yaw);
      step(t, 0.6);
      expect(t._runs(body(t), false).length, `${yaw}°`).toBeGreaterThanOrEqual(3);
    }
  });

  it('rastejando, o corpo passa por onde a cabeça passou', () => {
    const t = create(0);
    step(t, 0.3);
    for (let k = 0; k < 6; k++) {
      t.moveTo(t.pos.x + 100, t.pos.y, 0, 400);
      step(t, 0.4);
    }
    expect(t.label).toBe('rastejando');
    const pts = body(t).pts;
    // o rabo ficou para trás no caminho (y perto de 0, x uns LEN atrás da cabeça)
    const tail = pts[pts.length - 1];
    expect(Math.abs(tail.y)).toBeLessThan(25);
    expect(t.pos.x - tail.x).toBeGreaterThan(LEN * 0.8);
  });

  it('apanhando, dá um tranco para longe do herói (a cabeça mais) e volta, com o clarão fraco', () => {
    for (const heroSide of [1, -1]) {
      const t = create(90 * DEG);
      const near = { hero: { x: 300 * heroSide, y: 0 } };
      step(t, 0.5, near);
      const h0 = body(t).head.c;
      t.action('hurt');
      expect(t.recoilDir.x).toBeCloseTo(-heroSide, 5);
      step(t, 0.06, near);
      expect(t.recoil()).toBeGreaterThan(0.9);
      expect(t.flash()).toBeLessThan(0.35);
      const h1 = body(t).head.c;
      expect((h1.x - h0.x) * -heroSide).toBeGreaterThan(8);
      step(t, 0.6, near);
      expect(t.recoil()).toBe(0);
    }
  });

  it('desmaiada: vira de barriga para cima e o encanto sai em faíscas (por cima); de pé, nada por cima', () => {
    const t = create(0);
    step(t, 0.5);
    expect(body(t).U[30].z).toBeGreaterThan(0.9); // o lombo para cima
    t.action('die');
    step(t, 0.5);
    expect(t.label).toBe('caída');
    expect(body(t).U[30].z).toBeLessThan(-0.9); // de barriga para cima
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
