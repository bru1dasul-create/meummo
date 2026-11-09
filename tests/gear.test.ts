// Equipamentos que aparecem no personagem: as 7 partes, arco de duas mãos x escudo, o aviso para quem
// está vendo, o kit de teste e o desenho em camadas (boneco de papel) com as animações.

import { beforeEach, describe, expect, it } from 'vitest';
import { CharacterAnimator } from '../src/client/game/animator';
import { bodyLook } from '../src/client/game/doll/body';
import { buildDollSheet, drawDollFrame, SHEET_COLUMNS, type DollGear } from '../src/client/game/doll/compose';
import { gearIcon, slotOfArt } from '../src/client/game/doll/gearIcon';
import { ANIMS, FRAME_H, FRAME_W, faceOrigin, frameIndex, FRAMES_PER_VIEW, VIEWS, type AnimName, type View } from '../src/client/game/doll/poses';
import { Sheet } from '../src/client/game/doll/sheet';
import { GEAR_ART } from '../src/client/game/gearArt';
import { Inventory } from '../src/server/inventory';
import { loadItemDefs, parseItemDefs } from '../src/server/items';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { DOWN, LEFT, RIGHT, UP } from '../src/shared/dir';
import { BAG_SIZE, EQUIP_SLOTS } from '../src/shared/items';
import { GameMap } from '../src/shared/map';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

const items = parseItemDefs({
  chapeu: { nome: 'Chapéu', tipo: 'equipamento', parte: 'cabeça', vida: 2, icone: 'chapeu_palha' },
  luva: { nome: 'Luva', tipo: 'equipamento', parte: 'luvas', dano: 1, icone: 'luvas' },
  bota: { nome: 'Bota', tipo: 'equipamento', parte: 'pés', defesa: 1, aparencia: 'botas' },
  arco: { nome: 'Arco', tipo: 'equipamento', parte: 'arma', dano: 4, duasMaos: true },
  faca: { nome: 'Faca', tipo: 'equipamento', parte: 'arma', dano: 1, aparencia: 'facao' },
  escudo: { nome: 'Escudo', tipo: 'equipamento', parte: 'escudo', defesa: 2, aparencia: 'escudo_jabuti' },
  capa: { nome: 'Capa', tipo: 'equipamento', parte: 'acessório', vida: 1, aparencia: 'capa' },
  pena: { nome: 'Pena', tipo: 'material' },
});

describe('as 7 partes do corpo', () => {
  it('data/items.json fala português: luvas, botas, escudo, acessório', () => {
    expect(items.get('luva')).toMatchObject({ slot: 'hands', appearance: 'luvas', twoHanded: false });
    expect(items.get('bota')).toMatchObject({ slot: 'feet', appearance: 'botas' });
    expect(items.get('escudo')).toMatchObject({ slot: 'offhand' });
    expect(items.get('capa')).toMatchObject({ slot: 'charm' });
    expect(items.get('arco')).toMatchObject({ slot: 'weapon', twoHanded: true, appearance: 'arco' }); // sem "aparencia": usa o id/ícone
    expect(items.get('pena')).toMatchObject({ appearance: '', twoHanded: false });
    expect(() => parseItemDefs({ x: { nome: 'X', tipo: 'equipamento', parte: 'cabeca', duasMaos: true } })).toThrow(/só vale para armas/);
    expect(() => parseItemDefs({ x: { nome: 'X', tipo: 'equipamento', parte: 'arma', duasMaos: 'sim' } })).toThrow(/true ou false/);
  });

  it('todo equipamento de verdade tem visual no personagem (src/client/game/gearArt.ts)', () => {
    const missing = [...loadItemDefs().values()].filter((def) => def.kind === 'equipment' && !GEAR_ART[def.appearance]);
    // Item novo sem desenho? Use "aparencia" com um visual que já existe ou crie um em gearArt.ts.
    expect(missing.map((def) => `${def.id} (aparencia "${def.appearance}")`), `visuais que existem: ${Object.keys(GEAR_ART).join(', ')}`).toEqual([]);
  });

  it('dá para tirar qualquer parte (e só as que existem)', () => {
    for (const part of EQUIP_SLOTS) expect(parseClientMsg(JSON.stringify({ t: 'unequip', part }))).toEqual({ t: 'unequip', part });
    expect(parseClientMsg(JSON.stringify({ t: 'unequip', part: 'rabo' }))).toBeNull();
  });
});

describe('arco de duas mãos x escudo', () => {
  it('equipar o arco guarda o escudo; equipar o escudo guarda o arco', () => {
    const bag = new Inventory(items);
    bag.add('escudo', 1);
    bag.add('arco', 1);
    expect(bag.equip(0)).toBe(true);
    expect(bag.equipped.offhand).toBe('escudo');
    expect(bag.equip(1)).toBe(true); // arco: o escudo volta para a mochila
    expect(bag.equipped).toMatchObject({ weapon: 'arco', offhand: null });
    expect(bag.slots[0]).toEqual({ item: 'escudo', n: 1 });
    expect(bag.equip(0)).toBe(true); // escudo de novo: agora é o arco que volta
    expect(bag.equipped).toMatchObject({ weapon: null, offhand: 'escudo' });
    expect(bag.slots.filter(Boolean)).toEqual([{ item: 'arco', n: 1 }]);
  });

  it('trocar faca por arco com escudo: a faca volta para o lugar do arco e o escudo para um espaço livre', () => {
    const bag = new Inventory(items);
    bag.add('faca', 1);
    bag.add('escudo', 1);
    bag.equip(0);
    bag.equip(1);
    bag.add('arco', 1);
    expect(bag.equip(0)).toBe(true);
    expect(bag.equipped).toMatchObject({ weapon: 'arco', offhand: null });
    expect(bag.slots[0]).toEqual({ item: 'faca', n: 1 });
    expect(bag.slots[1]).toEqual({ item: 'escudo', n: 1 });
  });

  it('com a mochila cheia: troca se o arco libera o espaço dele; recusa se a faca ocupa esse espaço', () => {
    const bag = new Inventory(items);
    bag.add('escudo', 1);
    bag.equip(0);
    bag.add('arco', 1);
    while (bag.add('pena', 20) > 0); // enche o resto da mochila
    expect(bag.equip(0)).toBe(true); // mão da arma vazia: o escudo vai para o espaço que era do arco
    expect(bag.equipped).toMatchObject({ weapon: 'arco', offhand: null });
    expect(bag.slots[0]).toEqual({ item: 'escudo', n: 1 });

    const full = new Inventory(items);
    full.add('faca', 1);
    full.add('escudo', 1);
    full.equip(0);
    full.equip(1);
    full.add('arco', 1);
    while (full.add('pena', 20) > 0);
    expect(full.equip(0)).toBe(false); // a faca volta para o lugar do arco e não sobra espaço para o escudo
    expect(full.equipped).toMatchObject({ weapon: 'faca', offhand: 'escudo' }); // nada se perde
    expect(full.slots[0]).toEqual({ item: 'arco', n: 1 });
  });

  it('um save com arco e escudo juntos (de outra versão) devolve o escudo para a mochila', () => {
    const { inventory } = Inventory.fromSaved(items, { slots: [], equipped: { weapon: 'arco', offhand: 'escudo' } });
    expect(inventory.equipped).toMatchObject({ weapon: 'arco', offhand: null });
    expect(inventory.slots[0]).toEqual({ item: 'escudo', n: 1 });
  });
});

describe('o que você veste aparece para os outros', () => {
  let clock: FakeClock;
  beforeEach(() => {
    clock = new FakeClock();
  });
  const world = (testKit = false) =>
    new World(GameMap.fromTiled(tiledFromAscii(['.'.repeat(10), '.'.repeat(10), '.'.repeat(10)], { x: 2, y: 1 })), { now: clock.now, random: () => 0, items, testKit });
  const join = (w: World, name: string): { player: Player; conn: FakeConn } => {
    const conn = new FakeConn();
    const result = w.join(name, conn);
    if (!result.ok) throw new Error(result.reason);
    return { player: result.player, conn };
  };

  it('quem está perto recebe a roupa nova na hora; quem chega depois já vê vestido', () => {
    const w = world();
    const ana = join(w, 'Ana');
    const beto = join(w, 'Beto');
    w.tick();
    ana.player.inventory.add('chapeu', 1);
    ana.player.inventory.add('luva', 1);
    w.itemAction(ana.player, 'equip', 0);
    w.itemAction(ana.player, 'equip', 1);
    w.tick();
    expect(beto.conn.ofType('gear').at(-1)).toEqual({ t: 'gear', id: ana.player.id, gear: { head: 'chapeu', hands: 'luva' } });
    expect(ana.conn.ofType('gear').at(-1)?.gear).toEqual({ head: 'chapeu', hands: 'luva' }); // você também (seu boneco)

    const caio = join(w, 'Caio');
    w.tick();
    const seen = caio.conn.ofType('spawn').find((m) => m.e.id === ana.player.id);
    expect(seen?.e.gear).toEqual({ head: 'chapeu', hands: 'luva' });

    w.unequip(ana.player, 'head');
    w.tick();
    expect(caio.conn.ofType('gear').at(-1)?.gear).toEqual({ hands: 'luva' });
  });

  it('a troca recusada por mochila cheia avisa o jogador', () => {
    const w = world();
    const ana = join(w, 'Ana');
    ana.player.inventory.add('faca', 1);
    ana.player.inventory.add('escudo', 1);
    w.itemAction(ana.player, 'equip', 0);
    w.itemAction(ana.player, 'equip', 1);
    ana.player.inventory.add('arco', 1);
    for (let i = 0; i < BAG_SIZE; i++) ana.player.inventory.add('pena', 20);
    w.itemAction(ana.player, 'equip', 0);
    w.tick();
    expect(ana.conn.ofType('fail').at(-1)).toEqual({ t: 'fail', reason: 'bag_full', item: true });
    expect(ana.player.inventory.equipped.weapon).toBe('faca');
  });

  it('kit de teste (MEUMMO_ITENS_TESTE=1): um de cada equipamento, sem repetir o que já tem', () => {
    const w = world(true);
    const ana = join(w, 'Ana');
    const equipment = [...items.values()].filter((d) => d.kind === 'equipment').map((d) => d.id);
    expect(ana.player.inventory.slots.filter(Boolean).map((s) => s!.item).sort()).toEqual(equipment.sort());
    expect(join(world(false), 'Beto').player.inventory.slots.every((s) => s === null)).toBe(true);
  });
});

// ---------- desenho em camadas ----------

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

  it('todo visual tem ícone de mochila e combina com a parte do item', () => {
    for (const [name, art] of Object.entries(GEAR_ART)) {
      const icon = gearIcon(art);
      expect(icon, name).not.toBeNull();
      expect(pixels(icon!), name).toBeGreaterThan(20);
    }
    for (const def of loadItemDefs().values()) {
      const art = GEAR_ART[def.appearance];
      if (def.kind === 'equipment' && art) expect(slotOfArt(art), `${def.id}: o visual "${def.appearance}" é de outra parte do corpo`).toBe(def.slot);
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
