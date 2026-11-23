// O Quati redesenhado (prototipos/pindorama-25d/js/creatures/quati.js, da [arte]; a etapa 2 dos inimigos, 23/11): pintado
// como o Birim e o sagui novo, sem as bolinhas (o pelo na beirada, a luz e a sombra), o focinho comprido que mexe, o
// aviso exagerado (encolhe, arqueia, arrepia e rosna de boca aberta), o bote para a frente com os pés no chão, o tranco
// para longe de quem bateu e o desmaio com as faíscas roxas.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Vec = { x: number; y: number; z: number };
type Ball = { c: Vec; r: number };
type Group = { balls: Ball[]; ref?: Vec; noShadow?: boolean; body?: boolean; paint?: (ctx: unknown, flash: number) => void };
type Parts = { groups: Group[]; paint?: (ctx: unknown, flash: number) => void; after?: (ctx: unknown) => void };
type Quati = {
  pos: { x: number; y: number };
  yaw: number;
  seed: number;
  time: number;
  label: string;
  recoilDir: { x: number; y: number };
  update: (dt: number, near: { hero: { x: number; y: number } } | null) => void;
  action: (kind: string, yaw?: number) => void;
  moveTo: (x: number, y: number, yaw: number, ms: number) => void;
  parts: (cam: unknown) => Parts;
  drawable: (cam: unknown, primary: boolean) => { draw: (ctx: unknown) => void; drawShadow: (ctx: unknown) => void };
  recoil: () => number;
  flash: () => number;
};

/** Um caminho de mentira (o Path2D do navegador): aceita qualquer traço. */
class FakePath {
  constructor() {
    return new Proxy(this, { get: (target, prop) => (prop in target ? (target as Record<string | symbol, unknown>)[prop] : () => undefined) });
  }
}

/** Carrega os scripts do protótipo (eles põem tudo no `window.PD`) sem navegador. */
function loadPD(): { create: (yaw: number) => Quati; cam: unknown } {
  const sandbox: { window: { PD?: Record<string, unknown> }; Path2D: typeof FakePath } = { window: {}, Path2D: FakePath };
  for (const file of ['core/math.js', 'core/iso.js', 'core/shapes.js', 'creatures/creature.js', 'creatures/quati.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => { zoom: number };
  const cam = new Camera();
  cam.zoom = 1;
  const C = PD.creatures as { create: (type: string, x: number, y: number, yaw: number) => Quati };
  return {
    create: (yaw) => {
      const q = C.create('quati', 0, 0, yaw);
      q.seed = 0.37;
      q.time = 3.1;
      return q;
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
const S = 1.35;
const HERO_FAR = { hero: { x: 5000, y: 5000 } };

/** Anda o relógio do quati (60 quadros por segundo). */
function step(q: Quati, secs: number, near: { hero: { x: number; y: number } } | null = HERO_FAR): void {
  for (let t = 0; t < secs - 1e-9; t += 1 / 60) q.update(1 / 60, near);
}

/** As partes que o teste olha: o corpo (o primeiro grupo), a cabeça, o focinho (4 bolas), os pés e o queixo. */
function anatomy(q: Quati, cam: unknown): { body: Vec; head: Vec; snoutTip: Vec; feet: Vec[]; jaw: Group | undefined; tailR: number } {
  const groups = q.parts(cam).groups;
  const head = groups.find((g) => g.balls.length === 1 && Math.abs(g.balls[0].r - 7.2 * S) < 0.01)!;
  const snout = groups.find((g) => g.balls.length === 4)!;
  const legs = groups.filter((g) => g.balls.length === 3 && !g.noShadow);
  const jaw = groups.find((g) => g.noShadow && g.balls.length === 1 && Math.abs(g.balls[0].r - 2.2 * S) < 0.01);
  const tail = groups.find((g) => g.balls.length === 17)!;
  return { body: groups[0].ref as Vec, head: head.balls[0].c, snoutTip: snout.balls[3].c, feet: legs.map((g) => g.balls[1].c), jaw, tailR: tail.balls[0].r };
}

describe('o Quati redesenhado', () => {
  const { create, cam } = loadPD();

  it('é pintado (sem as bolinhas) em todos os lados e momentos, e as bolas ficam só para a sombra', () => {
    for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const moments: [string, (q: Quati) => void][] = [
        ['parado', (q) => step(q, 1)],
        ['trotando', (q) => {
          for (let k = 0; k < 5; k++) {
            q.moveTo(q.pos.x + 100, q.pos.y, 0, 230);
            step(q, 0.23);
          }
        }],
        ['aviso', (q) => { q.action('windup', q.yaw); step(q, 0.5); }],
        ['mordida', (q) => { q.action('windup', q.yaw); step(q, 0.45); q.action('bite', q.yaw); step(q, 0.04); }],
        ['apanhou', (q) => { q.action('hurt'); step(q, 0.05); }],
        ['caído', (q) => { q.action('die'); step(q, 0.5); }],
      ];
      for (const [name, set] of moments) {
        const q = create(yaw * DEG);
        set(q);
        const parts = q.parts(cam);
        expect(parts.paint, name).toBeTypeOf('function');
        expect(parts.groups.some((g) => g.balls.length > 0), name).toBe(true);
        const { ctx, fills, colors } = fakeCtx();
        const d = q.drawable(cam, false);
        d.drawShadow(ctx);
        d.draw(ctx);
        expect(fills(), `${name} ${yaw}°`).toBeGreaterThan(10);
        // nenhuma cor quebrada (o clarão do golpe numa cor transparente dava "#NaN")
        expect(colors.filter((c) => /NaN|undefined/.test(c)), `${name} ${yaw}°`).toEqual([]);
      }
    }
  });

  it('o focinho comprido mexe parado (farejando) e para no aviso', () => {
    const tipTravel = (q: Quati, secs: number): number => {
      let prev = anatomy(q, cam).snoutTip;
      let travel = 0;
      for (let t = 0; t < secs - 1e-9; t += 1 / 60) {
        q.update(1 / 60, HERO_FAR);
        const cur = anatomy(q, cam).snoutTip;
        travel += Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z);
        prev = cur;
      }
      return travel;
    };
    const calm = create(0);
    step(calm, 0.5);
    // parado no lugar, a ponta do focinho anda (a cabeça olhando em volta e o focinho farejando)
    expect(tipTravel(calm, 1)).toBeGreaterThan(8);
    const angry = create(0);
    step(angry, 0.5);
    angry.action('windup', 0);
    step(angry, 0.45);
    // no aviso, firme (só o rosnado tremendo)
    expect(tipTravel(angry, 0.3)).toBeLessThan(tipTravel(create(0), 0.3) + 6);
  });

  it('o aviso: encolhe para trás, abaixa a cabeça, arrepia o rabo e rosna de boca aberta', () => {
    const calm = create(0);
    step(calm, 0.6);
    const a = anatomy(calm, cam);
    expect(a.jaw).toBeUndefined(); // de boca fechada
    const angry = create(0);
    step(angry, 0.6);
    angry.action('windup', 0);
    step(angry, 0.5);
    const b = anatomy(angry, cam);
    expect(angry.label).toBe('preparando');
    expect(b.body.x).toBeLessThan(a.body.x - 4); // o corpo vai para trás (olhando para +x)
    expect(b.head.z).toBeLessThan(a.head.z - 3); // a cabeça baixa
    expect(b.tailR).toBeGreaterThan(a.tailR * 1.2); // o rabo arrepiado
    expect(b.jaw).toBeTruthy(); // a boca aberta (os dentes)
  });

  it('o bote: o corpo vai para a frente com os pés plantados, de boca aberta, e volta', () => {
    const q = create(0);
    step(q, 0.6);
    const before = anatomy(q, cam);
    q.action('windup', 0);
    step(q, 0.45);
    q.action('bite', 0);
    step(q, 0.05);
    const lunge = anatomy(q, cam);
    expect(q.label).toBe('mordendo');
    expect(lunge.body.x).toBeGreaterThan(before.body.x + 8);
    expect(lunge.jaw).toBeTruthy();
    // os pés de trás ficam no lugar (só o corpo estica)
    const hindBefore = before.feet.filter((f) => f.x < 0);
    const hindLunge = lunge.feet.filter((f) => f.x < 0);
    expect(hindLunge.length).toBe(2);
    for (let i = 0; i < 2; i++) expect(Math.abs(hindLunge[i].x - hindBefore[i].x)).toBeLessThan(4);
    step(q, 1);
    const after = anatomy(q, cam);
    expect(Math.abs(after.body.x - before.body.x)).toBeLessThan(2);
    expect(after.jaw).toBeUndefined();
  });

  it('o tranco do golpe vai para longe do herói e volta; o clarão é fraquinho', () => {
    for (const heroSide of [1, -1]) {
      const q = create(0);
      const near = { hero: { x: 300 * heroSide, y: 0 } };
      step(q, 0.5, near);
      const before = q.parts(cam).groups[0].ref as Vec;
      q.action('hurt');
      expect(q.recoilDir.x).toBeCloseTo(-heroSide, 5);
      step(q, 0.06, near);
      const hit = q.parts(cam).groups[0].ref as Vec;
      expect((hit.x - before.x) * -heroSide).toBeGreaterThan(8);
      expect(q.flash()).toBeLessThan(0.35);
      step(q, 0.6, near);
      expect(q.recoil()).toBe(0);
      const after = q.parts(cam).groups[0].ref as Vec;
      expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    }
  });

  it('desmaiado: deita de bruços e o encanto sai em faíscas (desenhadas por cima); de pé, nada por cima', () => {
    const q = create(0);
    step(q, 0.5);
    const standing = anatomy(q, cam).body.z;
    q.action('die');
    step(q, 0.3);
    const parts = q.parts(cam);
    expect((parts.groups[0].ref as Vec).z).toBeLessThan(standing - 10);
    const { ctx, fills } = fakeCtx();
    parts.after!(ctx);
    expect(fills()).toBeGreaterThan(10);
    const up = create(0);
    step(up, 0.5);
    const calm = fakeCtx();
    up.parts(cam).after!(calm.ctx);
    expect(calm.fills()).toBe(0);
  });
});
