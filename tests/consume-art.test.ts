// Desenho do efeito de usar um consumível (prototipos/pindorama-25d/js/consume.js, da [arte]; a escolha do dono, 23/11:
// o estouro nas garrafadas, o benzimento no Ramo de Arruda e o efeito pequeno na comida): o estilo e a cor de cada item,
// as três passadas (chão, atrás e na frente do corpo), que somem no fim, e a luz da noite.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Look = { kind: string; style: string; big?: boolean; rgb: number[]; pale: number[]; hex: string };
type Vec = { x: number; y: number; z: number };
type Hand = { local: Vec; poleLocal: number[]; fist: number; flex: number; twist: number };
type Parts = { pelvis: Record<string, number>; spine: Record<string, number>; hands: Hand[]; shoulderFwd: number[] };
type Char = {
  time: number;
  consumeAnim: { kind: string; item: string; start: number } | null;
  look: { heldItem?: { kind: string } | null; consumeHead?: number; consumeMouth?: number };
  attack?: unknown;
  dodge?: unknown;
  death?: unknown;
};
type Fx = {
  draw: (ctx: unknown, cam: unknown, foot: Vec, t: number, look: Look & { anim?: string }, pass: string) => void;
  look: (item: string, style?: string) => Look & { anim?: string };
  duration: (look: Look) => number;
  light: (look: Look, t: number) => number;
  applyPose: (ch: Char, parts: Parts) => number;
  T_REL: number;
};

/** Um caminho de mentira (o Path2D do navegador): aceita qualquer traço. */
class FakePath {
  constructor() {
    return new Proxy(this, { get: (target, prop) => (prop in target ? (target as Record<string | symbol, unknown>)[prop] : () => undefined) });
  }
}

/** Carrega os scripts do protótipo (eles põem tudo no `window.PD`) sem navegador. */
function loadPD(): { fx: Fx; cam: unknown } {
  const sandbox: { window: { PD?: Record<string, unknown> }; Path2D: typeof FakePath } = { window: {}, Path2D: FakePath };
  for (const file of ['core/math.js', 'core/iso.js', 'consume.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const Camera = PD.IsoCamera as new () => { zoom: number };
  const cam = new Camera();
  cam.zoom = 1;
  return { fx: PD.consumeFx as Fx, cam };
}

/** Um contexto de desenho de mentira: conta os traços e os preenchimentos. */
function fakeCtx(): { ctx: unknown; marks: () => number } {
  let marks = 0;
  const state: Record<string | symbol, unknown> = {};
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      return () => {
        if (prop === 'stroke' || prop === 'fill') marks++;
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx, marks: () => marks };
}

describe('efeito de usar um consumível', () => {
  const { fx, cam } = loadPD();
  const foot = { x: 500, y: 300, z: 0 };

  it('o estouro nas garrafadas, o benzimento na arruda e o efeito pequeno na comida', () => {
    for (const item of ['garrafada_pequena', 'garrafada', 'garrafada_grande']) {
      expect(fx.look(item)).toMatchObject({ kind: 'pocao', style: 'estouro' });
    }
    expect(fx.look('erva_arruda')).toMatchObject({ kind: 'pocao', style: 'benzimento' });
    for (const item of ['banana', 'agua_coco']) expect(fx.look(item).kind).toBe('comida');
    // um consumível novo, sem cor própria, ainda tem efeito
    expect(fx.look('item_que_nao_existe')).toMatchObject({ kind: 'pocao', style: 'estouro' });
    // as pranchas podem forçar o estilo, sem mudar o do jogo
    expect(fx.look('garrafada', 'benzimento').style).toBe('benzimento');
    expect(fx.look('garrafada').style).toBe('estouro');
    // a comida passa mais rápido que a poção
    expect(fx.duration(fx.look('banana'))).toBeLessThan(fx.duration(fx.look('garrafada')));
  });

  it('cada garrafada na cor do seu líquido: Pequena verde, Média âmbar e Grande vermelha', () => {
    const [pequena, media, grande] = ['garrafada_pequena', 'garrafada', 'garrafada_grande'].map((item) => fx.look(item).rgb);
    expect(pequena![1]).toBeGreaterThan(pequena![2]!); // verde-dourado: mais verde que azul
    expect(media![0]).toBeGreaterThan(media![1]!); // âmbar: mais vermelho que verde
    expect(media![1]).toBeGreaterThan(media![2]!);
    expect(grande![0]! - grande![1]!).toBeGreaterThan(media![0]! - media![1]!); // a Grande, mais vermelha que a Média
    expect(fx.look('garrafada_grande').big).toBe(true);
    for (const item of ['garrafada_pequena', 'garrafada', 'garrafada_grande', 'erva_arruda', 'banana', 'agua_coco']) {
      expect(fx.look(item).hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('desenha nas três passadas durante o efeito e nada antes ou depois', () => {
    for (const item of ['garrafada', 'garrafada_grande', 'erva_arruda', 'banana']) {
      const look = fx.look(item);
      // no meio: o estouro já aconteceu e as folhas estão descendo (ou subindo, no benzimento; na comida, as faíscas saem
      // da boca depois que a mão chega, em 0,3 s)
      for (const [pass, t] of [
        ['chao', 0.6],
        ['tras', 0.6],
        ['frente', 0.6],
        ...(item === 'banana' ? [] : ([['frente', 0.15]] as const)), // a garrafada ainda subindo (ou o começo do redemoinho)
      ] as const) {
        const during = fakeCtx();
        fx.draw(during.ctx, cam, foot, t, look, pass);
        expect(during.marks(), `${item} ${pass} ${t}`).toBeGreaterThan(0);
      }
      for (const pass of ['chao', 'tras', 'frente']) {
        const after = fakeCtx();
        fx.draw(after.ctx, cam, foot, fx.duration(look) + 0.05, look, pass);
        expect(after.marks()).toBe(0);
        const before = fakeCtx();
        fx.draw(before.ctx, cam, foot, -0.1, look, pass);
        expect(before.marks()).toBe(0);
      }
    }
  });

  it('cada item com a sua animação: joga a garrafada para cima, come a banana, bebe a água de coco', () => {
    for (const item of ['garrafada_pequena', 'garrafada', 'garrafada_grande']) expect(fx.look(item).anim).toBe('toss');
    expect(fx.look('banana').anim).toBe('eat');
    expect(fx.look('agua_coco').anim).toBe('drink');
    expect(fx.look('erva_arruda').anim).toBeUndefined(); // o benzimento já mexe o bastante
  });

  /** Um personagem parado (a mão direita caída do lado) com a animação `kind` começando no tempo 0. */
  const person = (kind: string): { ch: Char; pose: (t: number) => Parts } => {
    const ch: Char = { time: 0, consumeAnim: { kind, item: 'x', start: 0 }, look: {} };
    const pose = (t: number): Parts => {
      ch.time = t;
      const parts: Parts = {
        pelvis: { pitch: 0 },
        spine: { pitch: 0, yaw: 0, roll: 0 },
        hands: [0, 1].map(() => ({ local: { x: 4, y: 2, z: -55 }, poleLocal: [0, 0.3, -1], fist: 0.3, flex: 0, twist: 0 })),
        shoulderFwd: [0, 0],
      };
      fx.applyPose(ch, parts);
      return parts;
    };
    return { ch, pose };
  };

  it('a garrafada fica na mão até ser solta lá no alto, com os olhos nela', () => {
    const { ch, pose } = person('toss');
    const before = pose(fx.T_REL - 0.02);
    expect(ch.look.heldItem?.kind).toBe('bottle');
    expect(before.hands[1]!.local.z).toBeGreaterThan(30); // a mão subindo, acima do ombro
    pose(fx.T_REL + 0.05);
    expect(ch.look.heldItem).toBeNull(); // soltou: o voo é do efeito
    expect(ch.look.consumeHead!).toBeLessThan(0); // olhando para cima
    expect(pose(0.05).hands[0]!.local).toEqual({ x: 4, y: 2, z: -55 }); // a mão do arco fica como estava
  });

  it('a banana e o coco vão até a boca e voltam; no fim a animação acaba', () => {
    for (const kind of ['eat', 'drink']) {
      const { ch, pose } = person(kind);
      const atMouth = pose(0.5).hands[1]!.local;
      expect(atMouth.z, kind).toBeGreaterThan(5); // acima do ombro, na altura da boca
      expect(atMouth.x, kind).toBeLessThan(0); // para dentro, na frente do rosto
      expect(ch.look.heldItem?.kind).toBe(kind === 'eat' ? 'banana' : 'coco');
      expect(ch.look.consumeHead!).toBeGreaterThan(0); // a cabeça baixa um pouco
      pose(5);
      expect(ch.consumeAnim).toBeNull();
      expect(ch.look.heldItem).toBeNull();
    }
    // na mordida a boca abre
    const { ch, pose } = person('eat');
    pose(0.38);
    expect(ch.look.consumeMouth!).toBeGreaterThan(0.4);
  });

  it('atirando ou rolando, o corpo não faz a animação (o efeito continua)', () => {
    const { ch, pose } = person('eat');
    ch.attack = { kind: 'slingshot' };
    expect(pose(0.5).hands[1]!.local).toEqual({ x: 4, y: 2, z: -55 });
  });

  it('acende uma luz na noite só enquanto dura (na comida, mais fraca)', () => {
    for (const item of ['garrafada', 'erva_arruda', 'banana']) {
      const look = fx.look(item);
      expect(fx.light(look, -0.1)).toBe(0);
      expect(fx.light(look, 0.5)).toBeGreaterThan(0.3);
      expect(fx.light(look, fx.duration(look) + 0.05)).toBe(0);
    }
    expect(fx.light(fx.look('banana'), 0.5)).toBeLessThan(fx.light(fx.look('garrafada'), 0.5));
  });
});
