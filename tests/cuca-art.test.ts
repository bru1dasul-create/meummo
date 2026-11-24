// A Cuca desenhada (prototipos/pindorama-25d/js/creatures/cuca.js, da [arte], 24/11): a vovó bruxa com cabeça de
// jacaré-de-papo-amarelo. Pintada de todos os lados e em todos os momentos; virada para o caldeirão do mapa quando ele
// está perto (a view passa: `setCauldron`), mexendo com a colher dentro do caldo; sem caldeirão, a colher em pé; olhando
// o herói; falando (a colher sai do caldo e a boca mexe); a cabeça de pé (o "para cima" da cabeça apontava para baixo).

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Vec = { x: number; y: number; z: number };
type Rig = {
  side: number;
  s: Vec;
  hf: Vec;
  hu: Vec;
  headC: Vec;
  handL: Vec;
  bowl: Vec;
  jaw: number;
  stirK: number;
};
type Cuca = {
  pos: { x: number; y: number };
  yaw: number;
  seed: number;
  time: number;
  label: string;
  groundZ: number;
  cauldron: { x: number; y: number; r: number; d: number } | null;
  update: (dt: number, near: { hero: { x: number; y: number } } | null) => void;
  moveTo: (x: number, y: number, yaw: number, ms: number, dash?: boolean) => void;
  talk: () => void;
  setCauldron: (c: { x: number; y: number; r?: number } | null) => void;
  parts: (cam: unknown) => { paint?: (ctx: unknown, flash: number) => void };
  drawable: (cam: unknown, primary: boolean) => { draw: (ctx: unknown) => void; drawShadow: (ctx: unknown) => void };
  light: () => { x: number; y: number; z: number; r: number; color: string; k: number };
  _rig: (cam?: unknown) => Rig;
};

/** Um caminho de mentira (o Path2D do navegador): aceita qualquer traço. */
class FakePath {
  constructor() {
    return new Proxy(this, { get: (target, prop) => (prop in target ? (target as Record<string | symbol, unknown>)[prop] : () => undefined) });
  }
}

function loadPD(): { create: (yaw: number) => Cuca; cam: { toCamera: Vec } } {
  const sandbox: { window: { PD?: Record<string, unknown> }; Path2D: typeof FakePath } = { window: {}, Path2D: FakePath };
  for (const file of ['core/math.js', 'core/iso.js', 'core/shapes.js', 'creatures/creature.js', 'creatures/cuca.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => { zoom: number; toCamera: Vec };
  const cam = new Camera();
  cam.zoom = 1;
  const C = PD.creatures as { create: (type: string, x: number, y: number, yaw: number) => Cuca };
  return {
    create: (yaw) => {
      const t = C.create('cuca', 0, 0, yaw);
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

function step(t: Cuca, secs: number, near: { hero: { x: number; y: number } } | null = HERO_FAR): void {
  for (let s = 0; s < secs - 1e-9; s += 1 / 60) t.update(1 / 60, near);
}

/** O caldeirão do mapa a `d` cm dela, na direção `deg` (o da Toca: raio de 70 cm). */
function cauldronAt(deg: number, d = 114): { x: number; y: number; r: number } {
  return { x: Math.cos(deg * DEG) * d, y: Math.sin(deg * DEG) * d, r: 70 };
}

describe('a Cuca desenhada', () => {
  const { create, cam } = loadPD();

  it('é pintada de todos os lados, mexendo, com a colher em pé, falando e rindo, sem cor quebrada', () => {
    const moments: [string, (t: Cuca) => void][] = [
      ['mexendo', (t) => { t.setCauldron(cauldronAt(t.yaw / DEG)); step(t, 0.7); }],
      ['colher em pé', (t) => step(t, 0.7)],
      ['falando', (t) => { t.setCauldron(cauldronAt(t.yaw / DEG)); step(t, 0.5); t.talk(); step(t, 0.3); }],
      ['rindo', (t) => { step(t, 0.3); t.time = 6.56; step(t, 1 / 60); }],
    ];
    for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
      for (const [name, set] of moments) {
        const t = create(yaw * DEG);
        set(t);
        expect(t.parts(cam).paint, name).toBeTypeOf('function');
        const { ctx, fills, colors } = fakeCtx();
        const d = t.drawable(cam, false);
        d.drawShadow(ctx);
        d.draw(ctx);
        expect(fills(), `${name} ${yaw}°`).toBeGreaterThan(20);
        expect(colors.filter((c) => /NaN|undefined/.test(c)), `${name} ${yaw}°`).toEqual([]);
      }
    }
  });

  it('a cabeça fica de pé (o alto dela para cima) e o queixo desce quando a boca abre', () => {
    for (const yaw of [0, 90, 200, 300]) {
      const t = create(yaw * DEG);
      step(t, 0.5);
      const r = t._rig(cam);
      expect(r.hu.z, `${yaw}°`).toBeGreaterThan(0.8);
    }
    const t = create(0);
    step(t, 0.5);
    t.talk();
    let open = 0;
    for (let i = 0; i < 40; i++) {
      step(t, 1 / 60);
      open = Math.max(open, t._rig(cam).jaw);
    }
    expect(open).toBeGreaterThan(0.25);
  });

  it('com o caldeirão perto, vira para ele e mexe: a mão por cima da beirada e a concha dentro do caldo, dando a volta', () => {
    const t = create(90 * DEG);
    // (longe da risadinha, que solta um pouco a colher: ela vem quando o relógio + seed·7 passa de 8,5 a cada 11 s)
    t.time = 0.2;
    const c = cauldronAt(142);
    t.setCauldron(c);
    expect(t.cauldron).not.toBeNull();
    expect(Math.abs(Math.atan2(Math.sin(t.yaw - 142 * DEG), Math.cos(t.yaw - 142 * DEG)))).toBeLessThan(1e-6);
    // o servidor manda os NPCs olhando para baixo: ela continua virada para o caldeirão
    t.moveTo(0, 0, 90 * DEG, 100);
    step(t, 0.5);
    expect(Math.abs(Math.atan2(Math.sin(t.yaw - 142 * DEG), Math.cos(t.yaw - 142 * DEG)))).toBeLessThan(1e-3);
    expect(t.label).toBe('mexendo o caldeirão');
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 30; i++) {
      step(t, 0.08);
      const r = t._rig(cam);
      expect(r.handL.z).toBeGreaterThan(92 + 5); // a mão por cima da boca do caldeirão
      expect(r.bowl.z).toBeLessThan(88); // a concha dentro do caldo
      expect(Math.hypot(r.bowl.x - c.x, r.bowl.y - c.y)).toBeLessThan(c.r - 10); // dentro da boca
      xs.push(r.bowl.x);
      ys.push(r.bowl.y);
    }
    // dá a volta no caldo (não fica parada)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(15);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(15);
  });

  it('longe do caldeirão (ou sem ele), não vira e segura a colher em pé', () => {
    const t = create(90 * DEG);
    t.setCauldron(cauldronAt(0, 320));
    expect(t.cauldron).toBeNull();
    step(t, 0.6);
    expect(Math.abs(t.yaw - 90 * DEG)).toBeLessThan(1e-6);
    const r = t._rig(cam);
    expect(r.stirK).toBe(0);
    expect(r.bowl.z).toBeGreaterThan(r.handL.z + 20); // a concha para cima
    t.setCauldron(null);
    expect(t.cauldron).toBeNull();
  });

  it('falando, a colher sai do caldo e a boca mexe; depois volta a mexer', () => {
    const t = create(90 * DEG);
    t.setCauldron(cauldronAt(142));
    step(t, 0.6);
    t.talk();
    step(t, 0.5);
    expect(t.label).toBe('falando');
    expect(t._rig(cam).bowl.z).toBeGreaterThan(110);
    step(t, 4);
    expect(t.label).toBe('mexendo o caldeirão');
    expect(t._rig(cam).bowl.z).toBeLessThan(88);
  });

  it('olha o herói quando ele chega perto (só a cabeça: o corpo fica no caldeirão)', () => {
    const t = create(90 * DEG);
    t.setCauldron(cauldronAt(142));
    const hero = { hero: { x: Math.cos(200 * DEG) * 250, y: Math.sin(200 * DEG) * 250 } };
    step(t, 2, hero);
    const r = t._rig(cam);
    const look = Math.atan2(r.hf.y, r.hf.x);
    const want = Math.atan2(hero.hero.y, hero.hero.x);
    expect(Math.abs(Math.atan2(Math.sin(look - want), Math.cos(look - want)))).toBeLessThan(0.3);
    expect(Math.abs(Math.atan2(Math.sin(t.yaw - 142 * DEG), Math.cos(t.yaw - 142 * DEG)))).toBeLessThan(1e-3);
  });

  it('a colher fica na mão do lado da câmera e a luz própria acende a caverna', () => {
    for (const yaw of [0, 90, 142, 200, 300]) {
      const t = create(yaw * DEG);
      step(t, 0.3);
      const r = t._rig(cam);
      const camSide = r.s.x * cam.toCamera.x + r.s.y * cam.toCamera.y > 0 ? 1 : -1;
      expect(r.side, `${yaw}°`).toBe(camSide);
    }
    const t = create(0);
    step(t, 0.3);
    const l = t.light();
    expect(l.k).toBeGreaterThan(0.2);
    expect(l.r).toBeGreaterThan(100);
    expect(l.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
