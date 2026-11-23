// O Sagui redesenhado (prototipos/pindorama-25d/js/creatures/sagui.js, da [arte]; aprovado pelo dono em 23/11, um bicho
// por etapa): pintado como o Birim, sem as bolinhas (o pelo na beirada, a luz e a sombra), o tranco para longe de quem
// bateu, a fruta do aviso visível de frente e o desmaio com as faíscas roxas. E as ferramentas de pintar que os
// próximos bichos vão usar (PD.creatures.paint): o pelo que não pula de lugar e o brilho que o clarão não estraga.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Vec = { x: number; y: number; z: number };
type Ball = { c: Vec; r: number };
type Group = { balls: Ball[]; ref?: Vec; noShadow?: boolean; paint?: (ctx: unknown, flash: number) => void };
type Parts = { groups: Group[]; paint?: (ctx: unknown, flash: number) => void; after?: (ctx: unknown) => void };
type Sagui = {
  pos: { x: number; y: number };
  yaw: number;
  seed: number;
  time: number;
  dying: number | null;
  hurtT: number;
  top: number;
  recoilDir: { x: number; y: number };
  update: (dt: number, near: { hero: { x: number; y: number } } | null) => void;
  action: (kind: string, yaw?: number) => void;
  moveTo: (x: number, y: number, yaw: number, ms: number) => void;
  parts: (cam: unknown) => Parts;
  drawable: (cam: unknown, primary: boolean) => { draw: (ctx: unknown) => void; drawShadow: (ctx: unknown) => void };
  recoil: () => number;
  flash: () => number;
};
type Fur = { V: { x: number; y: number }[]; T: { x: number; y: number; sharp: boolean }[]; n: number };
type Paint = {
  furOutline: (poly: number[], count: number, len: number, seed?: number, comb?: number, flow?: unknown, sharp?: number, open?: boolean) => Fur;
  paintLit: (ctx: unknown, cam: unknown, trace: (dx: number, dy: number, p: unknown) => unknown, look: Record<string, string>, k: number, ink: number, flash: number, opts?: Record<string, unknown>) => void;
};

/** Um caminho de mentira (o Path2D do navegador): aceita qualquer traço. */
class FakePath {
  constructor() {
    return new Proxy(this, { get: (target, prop) => (prop in target ? (target as Record<string | symbol, unknown>)[prop] : () => undefined) });
  }
}

/** Carrega os scripts do protótipo (eles põem tudo no `window.PD`) sem navegador. */
function loadPD(): { create: (yaw: number) => Sagui; cam: { zoom: number; p: (v: Vec) => { x: number; y: number } }; paint: Paint } {
  const sandbox: { window: { PD?: Record<string, unknown> }; Path2D: typeof FakePath } = { window: {}, Path2D: FakePath };
  for (const file of ['core/math.js', 'core/iso.js', 'core/shapes.js', 'creatures/creature.js', 'creatures/sagui.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => { zoom: number; p: (v: Vec) => { x: number; y: number } };
  const cam = new Camera();
  cam.zoom = 1;
  const C = PD.creatures as { create: (type: string, x: number, y: number, yaw: number) => Sagui; paint: Paint };
  return {
    create: (yaw) => {
      const s = C.create('sagui', 0, 0, yaw);
      s.seed = 0.37;
      return s;
    },
    cam,
    paint: C.paint,
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

/** Anda o relógio do sagui (60 quadros por segundo). */
function step(s: Sagui, secs: number, near: { hero: { x: number; y: number } } | null = HERO_FAR): void {
  for (let t = 0; t < secs - 1e-9; t += 1 / 60) s.update(1 / 60, near);
}

describe('o Sagui redesenhado', () => {
  const { create, cam, paint } = loadPD();

  it('é pintado (sem as bolinhas) em todos os lados e momentos, e as bolas ficam só para a sombra', () => {
    for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const moments: [string, (s: Sagui) => void][] = [
        ['parado', (s) => step(s, 1)],
        ['correndo', (s) => {
          for (let k = 0; k < 5; k++) {
            s.moveTo(s.pos.x + 80, s.pos.y, 0, 250);
            step(s, 0.25);
          }
        }],
        ['aviso', (s) => { s.action('windup', s.yaw); step(s, 0.6); }],
        ['arremesso', (s) => { s.action('windup', s.yaw); step(s, 0.7); s.action('shoot', s.yaw); step(s, 0.12); }],
        ['apanhou', (s) => { s.action('hurt'); step(s, 0.05); }],
        ['caído', (s) => { s.action('die'); step(s, 0.5); }],
      ];
      for (const [name, set] of moments) {
        const s = create(yaw * DEG);
        set(s);
        const parts = s.parts(cam);
        expect(parts.paint, name).toBeTypeOf('function');
        // as bolas: a sombra no chão e a caixa do desenho
        expect(parts.groups.some((g) => g.balls.length > 0), name).toBe(true);
        const { ctx, fills, colors } = fakeCtx();
        const d = s.drawable(cam, false);
        d.drawShadow(ctx);
        d.draw(ctx);
        expect(fills(), `${name} ${yaw}°`).toBeGreaterThan(10);
        // nenhuma cor quebrada (o clarão do golpe em cor transparente dava "#NaN")
        expect(colors.filter((c) => /NaN|undefined/.test(c)), `${name} ${yaw}°`).toEqual([]);
      }
    }
  });

  it('o tranco do golpe vai para longe do herói e volta', () => {
    for (const heroSide of [1, -1]) {
      const s = create(0);
      const near = { hero: { x: 300 * heroSide, y: 0 } };
      step(s, 0.5, near);
      const before = s.parts(cam).groups[0].ref as Vec;
      s.action('hurt');
      expect(s.recoilDir.x).toBeCloseTo(-heroSide, 5);
      step(s, 0.06, near);
      const hit = s.parts(cam).groups[0].ref as Vec;
      expect((hit.x - before.x) * -heroSide).toBeGreaterThan(8); // uns 16 cm para trás
      step(s, 0.6, near);
      expect(s.recoil()).toBe(0);
      const after = s.parts(cam).groups[0].ref as Vec;
      expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    }
  });

  it('o clarão do golpe é fraquinho (quem mostra que apanhou é o tranco)', () => {
    const s = create(0);
    step(s, 0.5);
    s.action('hurt');
    step(s, 1 / 60);
    expect(s.flash()).toBeGreaterThan(0);
    expect(s.flash()).toBeLessThan(0.35);
  });

  it('no aviso, a fruta fica ao lado da cabeça, na altura dela (de frente, aparece)', () => {
    const s = create(0);
    s.action('windup', 0);
    step(s, 0.6);
    const parts = s.parts(cam);
    const fruit = parts.groups.find((g) => g.noShadow && g.balls.length === 1);
    expect(fruit).toBeTruthy();
    const f = fruit!.balls[0].c;
    // ao lado (fora da cabeça, que tem uns 18,6 cm de raio) e lá em cima
    expect(Math.abs(f.y)).toBeGreaterThan(18);
    expect(f.z).toBeGreaterThan(80);
  });

  it('desmaiado: o encanto sai do corpo em faíscas (desenhadas por cima) e o sagui apaga até sair', () => {
    const s = create(0);
    step(s, 0.5);
    s.action('die');
    step(s, 0.2);
    const parts = s.parts(cam);
    const { ctx, fills } = fakeCtx();
    parts.after!(ctx);
    expect(fills()).toBeGreaterThan(10); // o clarão e as faíscas
    // de pé, só os dois pontinhos do encanto
    const up = create(0);
    step(up, 0.5);
    const calm = fakeCtx();
    up.parts(cam).after!(calm.ctx);
    expect(calm.fills()).toBeLessThan(6);
  });

  it('o pelo: o número de mechas é o pedido (não pula de um quadro para o outro); no membro, a emenda fica sem pelo', () => {
    const square = [0, 0, 100, 0, 100, 100, 0, 100];
    const fur = paint.furOutline(square, 24, 6, 0.3);
    expect(fur.n).toBe(24);
    expect(fur.V.length).toBe(24);
    // o mesmo polígono um pouco esticado: as mesmas mechas, no mesmo jeito
    const fur2 = paint.furOutline([0, 0, 104, 0, 104, 100, 0, 100], 24, 6, 0.3);
    expect(fur2.T.map((t) => t.sharp)).toEqual(fur.T.map((t) => t.sharp));
    const open = paint.furOutline(square, 10, 6, 0.3, 0.3, null, 0.38, true);
    expect(open.V.length).toBe(11); // do primeiro ponto ao último, sem a aresta que fecha
    expect(open.V[0].x).toBeCloseTo(0, 6);
    expect(open.V[0].y).toBeCloseTo(0, 6);
  });
});
