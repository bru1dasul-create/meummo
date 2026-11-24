// As versões raras do Sagui (prototipos/pindorama-25d/js/creatures/sagui.js, da [arte]; a prévia de 24/11, na pegada
// das artes que o dono mandou): o Sagui Corrompido (Elite) e o Sagui Ancestral (Raro). O mesmo esqueleto e os mesmos
// golpes do Comum, com outra paleta e enfeites: as fendas vermelhas, as presas e os cogumelos do Corrompido; as runas
// douradas, o olho de espírito, o colar de sementes e a coroa de runas do Ancestral. Os dois um pouco maiores (o
// desenho cresce em volta do pé, ou do galho quando pendurados). Ainda fora do jogo: as chaves são provisórias.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Vec = { x: number; y: number; z: number };
type Box = { x0: number; y0: number; x1: number; y1: number };
type Group = { balls: { c: Vec; r: number }[]; ref?: Vec };
type Sagui = {
  pos: { x: number; y: number };
  yaw: number;
  seed: number;
  time: number;
  top: number;
  size: number;
  pal: { eye: string; pupil: boolean; fangs: boolean; look: { fur: { base: string } } };
  update: (dt: number, near: { hero: { x: number; y: number } } | null) => void;
  action: (kind: string, yaw?: number) => void;
  moveTo: (x: number, y: number, yaw: number, ms: number) => void;
  parts: (cam: unknown) => { groups: Group[] };
  drawable: (cam: unknown, primary: boolean) => { bounds: Box; draw: (ctx: unknown) => void; drawShadow: (ctx: unknown) => void };
  flash: () => number;
  setPerch: (perch: { z: number; yaw?: number } | null, instant?: boolean) => void;
  light?: () => { x: number; y: number; z: number; r: number; color: string; k: number } | null;
};
type Cam = { zoom: number; p: (v: Vec) => { x: number; y: number } };

/** Um caminho de mentira (o Path2D do navegador): aceita qualquer traço. */
class FakePath {
  constructor() {
    return new Proxy(this, { get: (target, prop) => (prop in target ? (target as Record<string | symbol, unknown>)[prop] : () => undefined) });
  }
}

/** Carrega os scripts do protótipo (eles põem tudo no `window.PD`) sem navegador. */
function loadPD(): { create: (type: string, yaw: number) => Sagui; cam: Cam } {
  const sandbox: { window: { PD?: Record<string, unknown> }; Path2D: typeof FakePath } = { window: {}, Path2D: FakePath };
  for (const file of ['core/math.js', 'core/iso.js', 'core/shapes.js', 'creatures/creature.js', 'creatures/sagui.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => Cam;
  const cam = new Camera();
  cam.zoom = 1;
  const C = PD.creatures as { create: (type: string, x: number, y: number, yaw: number) => Sagui };
  return {
    create: (type, yaw) => {
      const s = C.create(type, 0, 0, yaw);
      s.seed = 0.37;
      s.time = 3.1;
      return s;
    },
    cam,
  };
}

/** Um contexto de desenho de mentira: conta os preenchimentos, guarda as cores usadas e as translações. */
function fakeCtx(): { ctx: unknown; fills: () => number; colors: string[]; moves: [number, number][] } {
  let fills = 0;
  const colors: string[] = [];
  const moves: [number, number][] = [];
  const state: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (prop === 'translate') return (x: number, y: number) => moves.push([x, y]);
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
  return { ctx, fills: () => fills, colors, moves };
}

const DEG = Math.PI / 180;
const HERO_FAR = { hero: { x: 5000, y: 5000 } };
const RARE = ['sagui_corrompido', 'sagui_ancestral'];
const BRANCH = 220; // cm

/** Anda o relógio do sagui (60 quadros por segundo). */
function step(s: Sagui, secs: number): void {
  for (let t = 0; t < secs - 1e-9; t += 1 / 60) s.update(1 / 60, HERO_FAR);
}

/** Desenha (a sombra e o corpo) num contexto de mentira. */
function paint(s: Sagui, cam: Cam): ReturnType<typeof fakeCtx> {
  const f = fakeCtx();
  const d = s.drawable(cam, false);
  d.drawShadow(f.ctx);
  d.draw(f.ctx);
  return f;
}

describe('as versões raras do Sagui (prévia)', () => {
  const { create, cam } = loadPD();

  it('são pintadas em todos os lados e momentos (no chão e no galho), sem cor quebrada', () => {
    const moments: [string, (s: Sagui) => void][] = [
      ['parado', (s) => step(s, 1)],
      ['correndo', (s) => {
        for (let k = 0; k < 4; k++) {
          s.moveTo(s.pos.x + 90 * Math.cos(s.yaw), s.pos.y + 90 * Math.sin(s.yaw), s.yaw, 250);
          step(s, 0.25);
        }
      }],
      ['aviso', (s) => { s.action('windup', s.yaw); step(s, 0.5); }],
      ['arremesso', (s) => { s.action('windup', s.yaw); step(s, 0.7); s.action('shoot', s.yaw); step(s, 0.1); }],
      ['apanhou', (s) => { s.action('hurt'); step(s, 0.05); }],
      ['caído', (s) => { s.action('die'); step(s, 0.4); }],
      ['pendurado', (s) => { s.setPerch({ z: BRANCH, yaw: 0 }, true); step(s, 0.6); }],
      ['subindo', (s) => { s.setPerch({ z: BRANCH, yaw: 0 }); step(s, 0.4); }],
    ];
    for (const type of RARE) {
      for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
        for (const [name, set] of moments) {
          const s = create(type, yaw * DEG);
          set(s);
          const { fills, colors } = paint(s, cam);
          expect(fills(), `${type} ${name} ${yaw}°`).toBeGreaterThan(10);
          expect(colors.filter((c) => /NaN|undefined/.test(c)), `${type} ${name} ${yaw}°`).toEqual([]);
        }
      }
    }
  });

  it('andam, golpeiam e penduram com o mesmo esqueleto do Comum (só o desenho muda)', () => {
    for (const type of RARE) {
      for (const set of [
        (s: Sagui) => step(s, 1.2),
        (s: Sagui) => { s.action('windup', s.yaw); step(s, 0.6); },
        (s: Sagui) => { s.setPerch({ z: BRANCH, yaw: 0.4 }, true); step(s, 0.8); },
      ]) {
        const a = create('sagui', 40 * DEG);
        const b = create(type, 40 * DEG);
        set(a);
        set(b);
        // os grupos do Comum, na mesma ordem e no mesmo lugar (as raras só acrescentam os enfeites no fim)
        const ga = a.parts(cam).groups;
        const gb = b.parts(cam).groups;
        expect(gb.length).toBeGreaterThan(ga.length);
        for (let i = 0; i < ga.length; i++) {
          expect(gb[i].balls.length).toBe(ga[i].balls.length);
          for (let j = 0; j < ga[i].balls.length; j++) {
            const p = ga[i].balls[j].c, q = gb[i].balls[j].c;
            expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(1e-9);
          }
        }
      }
    }
  });

  it('o Comum continua o de sempre (as cores, o tamanho, a pupila e sem presas)', () => {
    const s = create('sagui', 0);
    expect(s.size).toBe(1);
    expect(s.pal.eye).toBe('#ffd45c');
    expect(s.pal.look.fur.base).toBe('#8e7f6e');
    expect(s.pal.pupil).toBe(true);
    expect(s.pal.fangs).toBe(false);
  });

  it('maiores: crescem em volta do pé no chão e do galho pendurados, e o nome sobe junto', () => {
    for (const type of RARE) {
      const base = create('sagui', 40 * DEG);
      const rare = create(type, 40 * DEG);
      step(base, 0.6);
      step(rare, 0.6);
      const k = rare.size;
      expect(k).toBeGreaterThan(1.05);
      const hb = base.drawable(cam, false).bounds, hr = rare.drawable(cam, false).bounds;
      expect((hr.y1 - hr.y0) / (hb.y1 - hb.y0)).toBeCloseTo(k, 1);
      expect(rare.top / base.top).toBeCloseTo(k, 5);
      // no chão, o desenho cresce em volta do pé (o pé fica no lugar)
      const foot = cam.p({ x: 0, y: 0, z: 0 });
      const ground = fakeCtx();
      rare.drawable(cam, false).draw(ground.ctx);
      expect(ground.moves[0][0]).toBeCloseTo(foot.x, 6);
      expect(ground.moves[0][1]).toBeCloseTo(foot.y, 6);
      // pendurado, em volta do galho (o rabo continua enrolado nele) e o nome em cima do galho
      const hb2 = create('sagui', 40 * DEG);
      const hr2 = create(type, 40 * DEG);
      for (const s of [hb2, hr2]) {
        s.setPerch({ z: BRANCH, yaw: 0 }, true);
        step(s, 0.6);
      }
      const branch = cam.p({ x: 0, y: 0, z: BRANCH });
      const hung = fakeCtx();
      hr2.drawable(cam, false).draw(hung.ctx);
      expect(hung.moves[0][0]).toBeCloseTo(branch.x, 6);
      expect(hung.moves[0][1]).toBeCloseTo(branch.y, 6);
      hb2.drawable(cam, false);
      expect(hr2.top - BRANCH).toBeCloseTo((hb2.top - BRANCH) * k, 5);
    }
  });

  it('o Corrompido mostra as presas mesmo parado e apanha com o clarão pela metade', () => {
    const teeth = '#fbf6ea';
    const calm = create('sagui', 40 * DEG);
    step(calm, 0.6);
    expect(paint(calm, cam).colors).not.toContain(teeth);
    const evil = create('sagui_corrompido', 40 * DEG);
    step(evil, 0.6);
    expect(paint(evil, cam).colors).toContain(teeth);
    // (no pelo quase preto, o clarão inteiro do Comum deixava o bicho cinza)
    const a = create('sagui', 0);
    const b = create('sagui_corrompido', 0);
    for (const s of [a, b]) {
      step(s, 0.5);
      s.action('hurt');
      step(s, 0.05);
    }
    expect(a.flash()).toBeGreaterThan(0);
    expect(b.flash()).toBeCloseTo(a.flash() / 2, 6);
  });

  it('o Ancestral tem o olho de espírito (o miolo aceso no lugar da pupila) e o colar de sementes', () => {
    const core = '#fffbea';
    const seed = '#b3262b';
    const calm = create('sagui', 40 * DEG);
    step(calm, 0.6);
    const c = paint(calm, cam).colors;
    expect(c).not.toContain(core);
    expect(c).not.toContain(seed);
    const old = create('sagui_ancestral', 40 * DEG);
    step(old, 0.6);
    const o = paint(old, cam).colors;
    expect(o).toContain(core);
    expect(o).toContain(seed);
  });

  it('a luz própria (de noite, no escuro e na neblina): vermelha no Corrompido, dourada no Ancestral, na altura do corpo e apagando no desmaio; o Comum não tem', () => {
    expect(create('sagui', 0).light).toBeUndefined();
    for (const [type, color] of [['sagui_corrompido', '#ff4a2e'], ['sagui_ancestral', '#ffd36a']] as const) {
      const s = create(type, 0);
      step(s, 0.5);
      const L = s.light!()!;
      expect(L.color).toBe(color);
      expect(L.r).toBeGreaterThan(100);
      expect(L.k).toBeGreaterThan(0.4);
      expect(L.x).toBeCloseTo(s.pos.x, 6);
      // no chão: o meio do corpo sentado (uns 50 cm); no galho: embaixo do galho
      expect(L.z).toBeGreaterThan(30);
      expect(L.z).toBeLessThan(90);
      const hung = create(type, 0);
      hung.setPerch({ z: BRANCH, yaw: 0 }, true);
      step(hung, 0.5);
      const H = hung.light!()!;
      expect(H.z).toBeGreaterThan(BRANCH - 110);
      expect(H.z).toBeLessThan(BRANCH);
      // pulsa (junto com as fendas e as runas)
      const ks = [];
      for (let i = 0; i < 30; i++) {
        step(s, 0.05);
        ks.push(s.light!()!.k);
      }
      expect(Math.max(...ks) - Math.min(...ks)).toBeGreaterThan(0.05);
      // desmaiado, apaga
      s.action('die');
      step(s, 0.5);
      expect(s.light!()).toBeNull();
    }
  });
});
