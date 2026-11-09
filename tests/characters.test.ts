// Desenho dos personagens (feito por código, em camadas): todo equipamento aparece no corpo, cada quadro
// tem personagem, o equipamento acompanha as animações, e as animações/expressões trocam na hora certa.

import { describe, expect, it } from 'vitest';
import { CharacterAnimator } from '../src/client/game/animator';
import { hasGearArt, lookOf, resolveGear } from '../src/client/game/characters';
import { bodyLook, type BodyLook } from '../src/client/game/doll/body';
import { buildDollSheet, drawDollFrame, SHEET_COLUMNS, type DollGear } from '../src/client/game/doll/compose';
import { gearIcon } from '../src/client/game/doll/gearIcon';
import { ANIMS, FRAME_H, FRAME_W, faceOrigin, frameIndex, FRAMES_PER_VIEW, VIEWS, type AnimName, type View } from '../src/client/game/doll/poses';
import { Sheet } from '../src/client/game/doll/sheet';
import { GEAR_ART } from '../src/client/game/gearArt';
import { loadItemDefs } from '../src/server/items';
import { DOWN, LEFT, RIGHT, UP } from '../src/shared/dir';

describe('equipamento no corpo', () => {
  it('todo equipamento de data/items.json tem desenho no personagem, na parte certa', () => {
    const missing = [...loadItemDefs().values()]
      .filter((def) => def.kind === 'equipment' && def.slot && !hasGearArt(def.slot, def.icon))
      .map((def) => `${def.id} (ícone "${def.icon}")`);
    expect(missing, 'crie o visual em src/client/game/gearArt.ts com o mesmo nome do ícone (ou use o ícone de um que já existe)').toEqual([]);
  });

  it('peça sem desenho (ou de outra parte do corpo) é só ignorada', () => {
    expect(hasGearArt('head', 'gorro')).toBe(true);
    expect(hasGearArt('head', 'faca')).toBe(false);
    expect(hasGearArt('weapon', 'toString')).toBe(false);
    expect(resolveGear({ head: 'faca', weapon: 'nao_existe', body: 'gibao' }).key).toBe('body:gibao');
  });
});


const allFrames = (fn: (view: View, anim: AnimName, frame: number) => void) => {
  for (const view of VIEWS) for (const anim of Object.keys(ANIMS) as AnimName[]) for (let f = 0; f < ANIMS[anim]; f++) fn(view, anim, f);
};
const frame = (look: number, gear: DollGear, view: View, anim: AnimName, f: number): Sheet => {
  const sheet = new Sheet(FRAME_W, FRAME_H);
  drawDollFrame(sheet, 0, 0, bodyLook(look), gear, view, anim, f);
  return sheet;
};
const pixels = (sheet: Sheet) => {
  let n = 0;
  for (let i = 3; i < sheet.data.length; i += 4) if (sheet.data[i]! > 0) n++;
  return n;
};
/** Caixa [x0, y0, x1, y1] dos pixels que mudaram entre dois desenhos (ou null se nada mudou). */
const diffBox = (a: Sheet, b: Sheet): [number, number, number, number] | null => {
  let box: [number, number, number, number] | null = null;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      if (a.data[i] === b.data[i] && a.data[i + 1] === b.data[i + 1] && a.data[i + 2] === b.data[i + 2] && a.data[i + 3] === b.data[i + 3]) continue;
      box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y];
    }
  }
  return box;
};
/** Linha mais alta com algum pixel. */
const topRow = (sheet: Sheet) => {
  for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) if (sheet.solid(x, y)) return y;
  return -1;
};
/** Um look com o penteado espetado (o penteado vem do byte de cima do look). */
const SPIKY = 2 << 24;

describe('boneco de papel', () => {
  const hat: DollGear = { head: GEAR_ART.chapeu_palha! };
  const armed: DollGear = { weapon: GEAR_ART.facao!, offhand: GEAR_ART.escudo_bueiro!, head: GEAR_ART.capacete_sucata!, body: GEAR_ART.armadura!, charm: GEAR_ART.capa! };

  it('todo quadro de toda vista tem personagem, e cabe na folha', () => {
    allFrames((view, anim, f) => {
      expect(pixels(frame(7, armed, view, anim, f)), `${view} ${anim} ${f}`).toBeGreaterThan(500);
    });
    const sheet = buildDollSheet(bodyLook(7), armed);
    expect(sheet.width).toBe(SHEET_COLUMNS * FRAME_W);
    expect(frameIndex('side', 'ko', 0)).toBe(VIEWS.length * FRAMES_PER_VIEW - 1);
  });

  it('o mesmo nome desenha sempre igual; cada equipamento muda só a parte dele', () => {
    const bare = frame(42, {}, 'down', 'idle', 0);
    expect(frame(42, {}, 'down', 'idle', 0).data).toEqual(bare.data);
    const hatBox = diffBox(bare, frame(42, hat, 'down', 'idle', 0))!;
    expect(hatBox[3]).toBeLessThan(24); // o chapéu fica na cabeça
    const bootsBox = diffBox(bare, frame(42, { feet: GEAR_ART.botas! }, 'down', 'idle', 0))!;
    expect(bootsBox[1]).toBeGreaterThan(44); // as botas ficam nas pernas
    const glovesBox = diffBox(bare, frame(42, { hands: GEAR_ART.luvas! }, 'down', 'idle', 0))!;
    expect(glovesBox[1]).toBeGreaterThan(36); // as luvas ficam nas mãos
  });

  it('o chapéu acompanha a cabeça: sobe e desce com a respiração e com o passo', () => {
    const top = (anim: AnimName, f: number) => diffBox(frame(3, {}, 'down', anim, f), frame(3, hat, 'down', anim, f))![1];
    expect(top('idle', 2)).toBe(top('idle', 0) + 1); // respirando: o corpo desce 1 pixel, o chapéu junto
    expect(top('walk', 2)).toBe(top('walk', 0) - 1); // no meio do passo o corpo sobe
    expect(top('ko', 0)).toBeGreaterThan(top('idle', 0) + 5); // desmaiado: sentado no chão
    // e o rosto (outra camada) vai junto com a cabeça
    expect(faceOrigin('down', 'idle', 2)[1]).toBe(faceOrigin('down', 'idle', 0)[1] + 1);
  });

  it('a arma vai junto com a mão no golpe', () => {
    const weapon: DollGear = { weapon: GEAR_ART.facao! };
    const box = (f: number) => diffBox(frame(3, {}, 'side', 'swing', f), frame(3, weapon, 'side', 'swing', f))!;
    expect(box(0)[1]).toBeLessThan(box(2)[1]); // preparando: lá em cima; terminando: lá embaixo
    expect(box(2)[2]).toBeGreaterThan(box(0)[2]); // e para a frente
  });

  it('capacete esconde o cabelo espetado (só aparece o que sai por baixo)', () => {
    expect(topRow(frame(SPIKY, { head: GEAR_ART.capacete_sucata! }, 'down', 'idle', 0))).toBeGreaterThan(topRow(frame(SPIKY, {}, 'down', 'idle', 0)));
  });

  it('todo visual tem ícone de mochila', () => {
    for (const [name, art] of Object.entries(GEAR_ART)) {
      const icon = gearIcon(art);
      expect(icon, name).not.toBeNull();
      expect(pixels(icon!), name).toBeGreaterThan(20);
    }
  });
});

describe('animações e expressões', () => {
  const base = { dir: DOWN, moving: false, progress: 0, steps: 0, dashing: false, fainted: false };

  it('parado respira; andando alterna as pernas a cada meio passo; esquiva corre', () => {
    const anim = new CharacterAnimator(1);
    const idle = new Set(Array.from({ length: 20 }, (_, i) => anim.pick({ ...base, now: i * 100 }).frame));
    expect(idle).toEqual(new Set([0, 1, 2, 3]));
    const walk = [0, 0.4, 0.8].flatMap((progress) => [0, 1].map((steps) => anim.pick({ ...base, now: 5000, moving: true, progress, steps }).frame));
    expect(new Set(walk)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(anim.pick({ ...base, now: 5000, moving: true, dashing: true }).anim).toBe('run');
  });

  it('o ataque vira o personagem para o alvo e termina sozinho', () => {
    const anim = new CharacterAnimator(1);
    anim.startAttack('swing', 0, 1000); // ângulo 0 = para a direita
    expect(anim.pick({ ...base, now: 1000, dir: UP })).toMatchObject({ anim: 'swing', frame: 0, view: 'side', flip: false });
    expect(anim.pick({ ...base, now: 1100, dir: UP })).toMatchObject({ anim: 'swing', frame: 1 });
    expect(anim.pick({ ...base, now: 1200, dir: UP })).toMatchObject({ anim: 'swing', frame: 2 });
    expect(anim.pick({ ...base, now: 1300, dir: UP })).toMatchObject({ anim: 'swing', frame: 3 });
    expect(anim.pick({ ...base, now: 1450, dir: UP })).toMatchObject({ anim: 'idle', view: 'up' });
    anim.startAttack('shoot', Math.PI, 2000); // para a esquerda: lado espelhado
    expect(anim.pick({ ...base, now: 2000, dir: RIGHT })).toMatchObject({ anim: 'shoot', view: 'side', flip: true });
    expect(anim.pick({ ...base, now: 2000, dir: LEFT, fainted: true })).toMatchObject({ anim: 'ko', expression: 'ko' }); // desmaiado ganha de tudo
  });

  it('careta quando apanha, sorriso quando sobe de nível, boca mexendo quando fala, e pisca de vez em quando', () => {
    const anim = new CharacterAnimator(3);
    anim.hurt(1000);
    expect(anim.pick({ ...base, now: 1050 })).toMatchObject({ anim: 'hurt', expression: 'hurt' });
    expect(anim.pick({ ...base, now: 1300 })).toMatchObject({ anim: 'idle', expression: 'hurt' }); // a careta dura mais que o recuo
    anim.cheer(2000, 1000);
    expect(anim.pick({ ...base, now: 2500 }).expression).toBe('happy');
    anim.talk(4000, 1000);
    const talking = new Set([4000, 4140, 4280, 4420].map((now) => anim.pick({ ...base, now }).expression));
    expect(talking.has('talk')).toBe(true);
    const blinks = Array.from({ length: 1000 }, (_, i) => anim.pick({ ...base, now: 10000 + i * 10 }).expression).filter((e) => e === 'blink');
    expect(blinks.length).toBeGreaterThan(0);
    expect(blinks.length).toBeLessThan(100); // só de vez em quando
  });
});

describe('aparência própria de NPC', () => {
  const draw = (look: BodyLook, view: View, anim: AnimName, f: number): Sheet => {
    const sheet = new Sheet(FRAME_W, FRAME_H);
    drawDollFrame(sheet, 0, 0, look, resolveGear({}, 'curupira').gear, view, anim, f);
    return sheet;
  };
  /** Pixels desenhados nas últimas linhas do quadro (os pés): [mais à esquerda, mais à direita]. */
  const feet = (sheet: Sheet): [number, number] => {
    const xs: number[] = [];
    for (let y = FRAME_H - 8; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) if (sheet.solid(x, y)) xs.push(x);
    return [Math.min(...xs), Math.max(...xs)];
  };

  it('o Curupira tem cabelo de fogo, que tremula e cabe no quadro em todas as animações', () => {
    const look = lookOf(0, 'curupira');
    expect(look.hairStyle).toBe('fogo');
    allFrames((view, anim, f) => {
      const sheet = draw(look, view, anim, f);
      for (let x = 0; x < FRAME_W; x++) expect(sheet.solid(x, 0), `${view} ${anim} ${f}: fogo cortado em cima`).toBe(false);
    });
    // dois quadros parados seguidos: o corpo quase não muda, mas as labaredas sim
    const a = draw(look, 'down', 'idle', 0);
    const b = draw(look, 'down', 'idle', 1);
    let changed = 0;
    for (let y = 0; y < 12; y++) for (let x = 0; x < FRAME_W; x++) if (a.solid(x, y) !== b.solid(x, y)) changed++;
    expect(changed).toBeGreaterThan(0);
  });

  it('o Curupira tem os pés virados para trás (de lado, o bico do pé aponta para as costas)', () => {
    const look = lookOf(0, 'curupira');
    const [backLeft, backRight] = feet(draw(look, 'side', 'idle', 0));
    const [left, right] = feet(draw({ ...look, feetBackward: false }, 'side', 'idle', 0));
    // olhando para a direita: com o pé virado, ele vai mais para a esquerda e menos para a direita
    expect(backLeft).toBeLessThan(left);
    expect(backRight).toBeLessThan(right);
  });
});
