// A Cuca desenhada (prototipos/pindorama-25d/js/creatures/cuca.js, da [arte], 24/11): a vovó bruxa com cabeça de
// jacaré-de-papo-amarelo. Pintada de todos os lados e em todos os momentos; virada para o caldeirão do mapa quando ele
// está perto (a view passa: `setCauldron`), mexendo com a colher dentro do caldo; sem caldeirão, a colher em pé; olhando
// o herói; falando (a colher sai do caldo e a boca mexe); a cabeça de pé (o "para cima" da cabeça apontava para baixo).
// De noite, a chefe (etapa 2): o aviso com a colher cheia atrás da cabeça e o arremesso por cima dela, a cantiga (as
// mãos no colo e as notas em volta), o andar, o tranco ao apanhar, o desmaio com as faíscas roxas e os olhos vermelhos.
// Uma luta por noite (25/11): a bruxa vencida caída que fica (sem sumir nem soltar faíscas, respirando, o nome descendo
// junto), o levantar apoiada na colher fincada no chão e o acordar confusa (esfrega o olho, olha em volta) logo depois;
// andando, a confusão passa; e, de volta perto do caldeirão, gira até ele devagar (sem pular) e volta a mexer.
// A chefe maior que a bruxa (o dono, 25/11: "com 1,35"): o desenho, o pé, o alto e a luz crescem; virando ali agora, ela
// cresce aos poucos (dentro da fumaça); vencida, encolhe enquanto cai, para a bruxa caída aparecer do tamanho dela.

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
  hump: Vec;
  handL: Vec;
  handR: Vec;
  bowl: Vec;
  jaw: number;
  stirK: number;
  full: boolean;
  blink: number;
  chest: Vec;
  f: Vec;
  rub: number;
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
  action: (kind: string, yaw?: number) => void;
  recoil: () => number;
  flash: () => number;
  recoilDir: { x: number; y: number };
  walkK: number;
  stepPh: number;
  parts: (cam: unknown) => { paint?: (ctx: unknown, flash: number) => void; after?: (ctx: unknown) => void };
  drawable: (
    cam: unknown,
    primary: boolean,
  ) => { draw: (ctx: unknown) => void; drawShadow: (ctx: unknown) => void; bounds: { x0: number; x1: number; y0: number; y1: number } };
  light: () => { x: number; y: number; z: number; r: number; color: string; k: number };
  _rig: (cam?: unknown) => Rig;
  faintNow: () => void;
  setBoss: (on: boolean, from?: number) => void;
  size: number;
  radius: number;
  top: number;
  overHead: () => Vec;
  dying: number | null;
  lieT: number | null;
  appearT: number | null;
  holdYaw: boolean;
  act: unknown;
};

/** Um caminho de mentira (o Path2D do navegador): aceita qualquer traço. */
class FakePath {
  constructor() {
    return new Proxy(this, { get: (target, prop) => (prop in target ? (target as Record<string | symbol, unknown>)[prop] : () => undefined) });
  }
}

function loadPD(): { create: (yaw: number) => Cuca; cam: { toCamera: Vec }; eyes: { night: boolean } } {
  const sandbox: { window: { PD?: Record<string, unknown> }; Path2D: typeof FakePath } = { window: {}, Path2D: FakePath };
  for (const file of ['core/math.js', 'core/iso.js', 'core/shapes.js', 'creatures/creature.js', 'creatures/cuca.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => { zoom: number; toCamera: Vec };
  const cam = new Camera();
  cam.zoom = 1;
  const C = PD.creatures as { create: (type: string, x: number, y: number, yaw: number) => Cuca; eyes: { night: boolean } };
  return {
    eyes: C.eyes,
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
  const { create, cam, eyes } = loadPD();

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

  it('a chefe: no aviso, a colher cheia sobe atrás da cabeça; no arremesso, passa por cima e termina na frente, vazia', () => {
    const t = create(0); // de frente para +x
    step(t, 0.5);
    t.action('windup', 0);
    step(t, 0.5);
    let r = t._rig(cam);
    expect(t.label).toBe('enchendo a colher');
    expect(r.full).toBe(true);
    expect(r.bowl.z).toBeGreaterThan(r.headC.z + 10);
    expect(r.bowl.x - t.pos.x).toBeLessThan(0); // atrás dela
    t.action('shoot', 0);
    step(t, 0.12);
    expect(t.label).toBe('jogando o caldo');
    r = t._rig(cam);
    expect(r.bowl.z).toBeGreaterThan(r.headC.z); // passando por cima da cabeça
    step(t, 0.25);
    r = t._rig(cam);
    expect(r.full).toBe(false);
    expect(r.bowl.x - t.pos.x).toBeGreaterThan(40); // na frente
    step(t, 0.6);
    expect(t.label).not.toBe('jogando o caldo');
  });

  it('a cantiga: as duas mãos no colo, ninando a colher, e as notas em volta (por cima de tudo)', () => {
    const t = create(30 * DEG);
    step(t, 0.5);
    t.action('windup', t.yaw);
    t.action('song', t.yaw);
    t.talk();
    step(t, 0.8);
    expect(t.label).toBe('cantando');
    const r = t._rig(cam);
    const f = { x: Math.cos(t.yaw), y: Math.sin(t.yaw) };
    const ahead = (p: Vec) => (p.x - t.pos.x) * f.x + (p.y - t.pos.y) * f.y;
    expect(ahead(r.handL)).toBeGreaterThan(15);
    expect(ahead(r.handR)).toBeGreaterThan(15);
    const parts = t.parts(cam);
    expect(parts.after).toBeTypeOf('function');
    const { ctx, fills } = fakeCtx();
    parts.after!(ctx);
    expect(fills()).toBeGreaterThan(3);
    step(t, 2);
    expect(t.parts(cam).after).toBeUndefined(); // acabou a cantiga: sem notas
  });

  it('andando, a passada arrasta (o desenho continua inteiro)', () => {
    const t = create(45 * DEG);
    step(t, 0.3);
    const ph0 = t.stepPh;
    for (let k = 0; k < 4; k++) {
      t.moveTo(t.pos.x + 100 * Math.cos(t.yaw), t.pos.y + 100 * Math.sin(t.yaw), t.yaw, 420);
      step(t, 0.42);
    }
    expect(t.walkK).toBeGreaterThan(0.5);
    expect(t.label).toBe('andando');
    expect(t.stepPh - ph0).toBeGreaterThan(Math.PI * 4);
    const { ctx, fills } = fakeCtx();
    t.drawable(cam, false).draw(ctx);
    expect(fills()).toBeGreaterThan(20);
  });

  it('apanhando, dá um tranco para longe do herói e volta, com o clarão fraco', () => {
    for (const heroSide of [1, -1]) {
      const t = create(90 * DEG);
      const near = { hero: { x: 300 * heroSide, y: 0 } };
      step(t, 0.5, near);
      const h0 = t._rig(cam).hump;
      t.action('hurt');
      expect(t.recoilDir.x).toBeCloseTo(-heroSide, 5);
      step(t, 0.06, near);
      expect(t.recoil()).toBeGreaterThan(0.9);
      expect(t.flash()).toBeLessThan(0.35);
      const h1 = t._rig(cam).hump;
      expect((h1.x - h0.x) * -heroSide).toBeGreaterThan(6);
      step(t, 0.6, near);
      expect(t.recoil()).toBe(0);
    }
  });

  it('desmaiando: cai sentada (a cabeça desce), a colher no chão e o encanto sai em faíscas roxas', () => {
    const t = create(0);
    step(t, 0.5);
    const h0 = t._rig(cam).headC.z;
    t.action('die');
    step(t, 0.5);
    expect(t.label).toBe('desmaiando');
    const r = t._rig(cam);
    expect(r.headC.z).toBeLessThan(h0 - 30);
    expect(r.bowl.z - t.groundZ).toBeLessThan(10);
    const a = fakeCtx();
    t.parts(cam).after!(a.ctx);
    expect(a.colors.filter((c) => c === '#b58cff').length).toBeGreaterThan(3);
  });

  it('de noite (a chefe), os olhos vermelhos como os dos outros monstros; de dia (a bruxa), amarelos', () => {
    const colorsAt = (night: boolean): string[] => {
      eyes.night = night;
      const t = create(45 * DEG);
      step(t, 0.3);
      const { ctx, colors } = fakeCtx();
      t.drawable(cam, false).draw(ctx);
      return colors;
    };
    try {
      expect(colorsAt(true)).toContain('#ff3b26');
      expect(colorsAt(false)).toContain('#f3c83a');
    } finally {
      eyes.night = false;
    }
  });

  const angle = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

  it('caída que fica (a vencida): já no chão, aparece aos poucos e fica à vista, sem as faíscas, de olhos fechados', () => {
    const standing = create(45 * DEG);
    step(standing, 0.5);
    const top0 = standing.overHead().z;
    const head0 = standing._rig(cam).headC.z;
    for (const yaw of [0, 45, 135, 225, 315]) {
      const t = create(yaw * DEG);
      t.faintNow();
      // aparece aos poucos (a chefe acabou de sumir ali)
      expect(t.appearT).toBe(0);
      step(t, 0.5);
      expect(t.appearT).toBeNull();
      step(t, 30);
      expect(t.label, `${yaw}°`).toBe('caída');
      expect(t.dying).toBeNull(); // não some (o motor só tira o desenho de quem 'die')
      const r = t._rig(cam);
      expect(r.headC.z).toBeLessThan(head0 - 30);
      expect(r.blink).toBe(1);
      expect(r.bowl.z - t.groundZ).toBeLessThan(10); // a colher no chão
      expect(t.parts(cam).after ?? null).toBeNull(); // sem as faíscas da chefe
      const { ctx, fills, colors } = fakeCtx();
      const d = t.drawable(cam, false);
      d.drawShadow(ctx);
      d.draw(ctx);
      expect(fills(), `${yaw}°`).toBeGreaterThan(20);
      expect(colors.filter((c) => /NaN|undefined/.test(c)), `${yaw}°`).toEqual([]);
      // o nome (e o "Zzz") desce para a cabeça caída
      expect(t.overHead().z).toBeLessThan(top0 - 40);
    }
  });

  it('caída: respira devagar; o "faint" de novo não recomeça a queda; golpe não mexe nela', () => {
    const t = create(45 * DEG);
    t.faintNow();
    step(t, 2);
    const zs: number[] = [];
    for (let i = 0; i < 60; i++) {
      step(t, 0.1);
      zs.push(t._rig(cam).chest.z);
    }
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(2);
    const lie = t.lieT!;
    t.action('faint');
    expect(t.lieT).toBe(lie);
    t.action('windup');
    expect(t.act).toBeNull();
  });

  it("de pé, o 'faint' derruba como a chefe (sentada, a colher no chão) e ela fica caída", () => {
    const t = create(90 * DEG);
    step(t, 0.5);
    const h0 = t._rig(cam).headC.z;
    t.action('faint');
    step(t, 0.2);
    const mid = t._rig(cam).headC.z;
    expect(mid).toBeLessThan(h0 - 5);
    step(t, 5);
    expect(t.label).toBe('caída');
    expect(t._rig(cam).headC.z).toBeLessThan(mid - 10);
    expect(t.dying).toBeNull();
  });

  it("de manhã: levanta do chão apoiada na colher fincada (a concha embaixo) e acorda confusa logo depois", () => {
    // o motor tira o desenho caído e põe um de pé no lugar; manda 'revive' e 'wake' juntos
    const t = create(70 * DEG);
    t.time = 0.2; // (longe da risadinha, que vem sozinha a cada 11 s)
    t.action('revive');
    t.action('wake');
    step(t, 1 / 60);
    const r0 = t._rig(cam);
    expect(t.label).toBe('levantando');
    expect(r0.blink).toBe(1); // começa de olhos fechados, no chão
    step(t, 0.35);
    // a colher fincada: a concha no chão e a mão no alto do cabo
    const r1 = t._rig(cam);
    expect(r1.bowl.z - t.groundZ).toBeLessThan(10);
    expect(r1.handL.z - t.groundZ).toBeGreaterThan(35);
    step(t, 0.8);
    // em pé, acordando: a mão livre esfrega o olho (perto da cabeça) de olhos fechados
    expect(t.label).toBe('acordando');
    step(t, 0.3);
    const r2 = t._rig(cam);
    expect(r2.headC.z - t.groundZ).toBeGreaterThan(125);
    expect(r2.rub).toBeGreaterThan(0.8);
    expect(Math.hypot(r2.handR.x - r2.headC.x, r2.handR.y - r2.headC.y, r2.handR.z - r2.headC.z)).toBeLessThan(32);
    expect(r2.blink).toBe(1);
    // e a mão vai por cima da cara (o antebraço desenhado depois da cabeça), sem cor quebrada
    const { ctx, colors } = fakeCtx();
    t.drawable(cam, false).draw(ctx);
    expect(colors.filter((c) => /NaN|undefined/.test(c))).toEqual([]);
    // olha para um lado e para o outro
    let turned = 0;
    for (let i = 0; i < 30; i++) {
      step(t, 1 / 30);
      const r = t._rig(cam);
      turned = Math.max(turned, angle(Math.atan2(r.hf.y, r.hf.x), t.yaw));
    }
    expect(turned).toBeGreaterThan(0.5);
    // acabou (1,1 s + 1,9 s): de pé, parada, solta para virar
    step(t, 1.2);
    expect(t.label).toBe('parada');
    expect(t.holdYaw).toBe(false);
  });

  it("acorda sem levantar quando já está de pé (a chefe que virou de volta numa fumaça), e andando a confusão passa", () => {
    const t = create(30 * DEG);
    step(t, 1);
    t.action('revive'); // (de pé há tempo: não cai para levantar)
    expect(t.label).not.toBe('levantando');
    t.action('wake');
    step(t, 0.2);
    expect(t.label).toBe('acordando');
    for (let k = 0; k < 4; k++) {
      t.moveTo(t.pos.x + 90, t.pos.y, 0, 600);
      step(t, 0.6);
    }
    expect(t.label).toBe('andando');
    expect(t._rig(cam).rub).toBe(0);
  });

  it('acordada perto do caldeirão: gira até ele devagar (sem pular) e volta a mexer', () => {
    const t = create(90 * DEG);
    // (a view: o desenho de pé no lugar do caído fica virado igual e não vira para o caldeirão de cara)
    t.holdYaw = true;
    t.setCauldron(cauldronAt(142));
    expect(angle(t.yaw, 90 * DEG)).toBeLessThan(1e-6);
    t.action('revive');
    t.action('wake');
    step(t, 3.05);
    // acabou de acordar: começa a virar, sem pular
    const a0 = angle(t.yaw, 142 * DEG);
    expect(a0).toBeGreaterThan(0.2);
    step(t, 0.1);
    const a1 = angle(t.yaw, 142 * DEG);
    expect(a1).toBeLessThan(a0);
    expect(a0 - a1).toBeLessThan(0.4);
    step(t, 1.2);
    expect(angle(t.yaw, 142 * DEG)).toBeLessThan(1e-3);
    expect(t.label).toBe('mexendo o caldeirão');
    expect(t._rig(cam).bowl.z).toBeLessThan(88);
  });

  it('andando até o caldeirão, olha para onde vai e só vira para ele quando chega', () => {
    const t = create(180 * DEG);
    t.time = 0.2; // (longe da risadinha)
    step(t, 0.3);
    const c = { x: -150, y: 60, r: 70 };
    for (let k = 1; k <= 3; k++) {
      t.moveTo(-30 * k, 0, 180 * DEG, 500);
      t.setCauldron(c);
      step(t, 0.5);
      expect(angle(t.yaw, 180 * DEG), `passo ${k}`).toBeLessThan(0.05);
    }
    expect(t.cauldron).not.toBeNull();
    step(t, 1.5);
    const want = Math.atan2(c.y - t.pos.y, c.x - t.pos.x);
    expect(angle(t.yaw, want)).toBeLessThan(1e-3);
    expect(t.label).toBe('mexendo o caldeirão');
    // o passinho de ajeitar o lugar (10 cm, o servidor de manhã): continua virada para o caldeirão, mexendo
    t.moveTo(t.pos.x, t.pos.y + 10, 90 * DEG, 100);
    for (let i = 0; i < 30; i++) {
      step(t, 1 / 60);
      expect(angle(t.yaw, Math.atan2(c.y - t.pos.y, c.x - t.pos.x)), `quadro ${i}`).toBeLessThan(1e-3);
    }
    expect(t.label).toBe('mexendo o caldeirão');
  });

  it('a chefe é maior que a bruxa (1,35): o desenho, o pé, o nome e a luz crescem juntos, em volta do pé', () => {
    const witch = create(45 * DEG);
    witch.setBoss(false);
    step(witch, 0.5);
    const boss = create(45 * DEG);
    boss.setBoss(true);
    step(boss, 0.5);
    expect(boss.size).toBeCloseTo(1.35, 5);
    expect(boss.radius).toBeCloseTo(witch.radius * 1.35, 5);
    expect(boss.top).toBeCloseTo(witch.top * 1.35, 5);
    expect(boss.overHead().z).toBeCloseTo(witch.overHead().z * 1.35, 3);
    expect(boss.light().z).toBeGreaterThan(witch.light().z * 1.3);
    const bw = witch.drawable(cam, false).bounds;
    const bb = boss.drawable(cam, false).bounds;
    expect((bb.x1 - bb.x0) / (bw.x1 - bw.x0)).toBeCloseTo(1.35, 1);
    expect((bb.y1 - bb.y0) / (bw.y1 - bw.y0)).toBeCloseTo(1.35, 1);
    // pintada inteira, sem cor quebrada
    const { ctx, fills, colors } = fakeCtx();
    const d = boss.drawable(cam, false);
    d.drawShadow(ctx);
    d.draw(ctx);
    expect(fills()).toBeGreaterThan(20);
    expect(colors.filter((c) => /NaN|undefined/.test(c))).toEqual([]);
  });

  it('virando ali agora, a chefe cresce aos poucos (dentro da fumaça); vencida, encolhe enquanto cai', () => {
    const t = create(90 * DEG);
    t.setBoss(true, 1);
    expect(t.size).toBe(1);
    step(t, 0.25);
    expect(t.size).toBeGreaterThan(1.1);
    expect(t.size).toBeLessThan(1.3);
    step(t, 0.4);
    expect(t.size).toBeCloseTo(1.35, 5);
    t.action('die');
    step(t, 0.3);
    expect(t.size).toBeLessThan(1.3);
    expect(t.size).toBeGreaterThan(1);
    step(t, 0.4);
    expect(t.size).toBeCloseTo(1, 3); // (o motor tira o desenho em 0,7 s: a bruxa caída aparece do mesmo tamanho)
  });
});
