// Monta o personagem camada por camada ("boneco de papel"): pernas, quadril, tronco, braços, cabeça,
// cabelo e cada equipamento, em todos os quadros de todas as animações. A ordem das camadas muda com a
// direção (de costas, a arma fica atrás do corpo e a capa na frente; de lado, o braço de longe fica atrás...).
// O resultado é uma folha só por combinação de aparência + equipamentos (rápido de desenhar no jogo).

import { EQUIP_SLOTS, type EquipSlot } from '../../../shared/items';
import type { GearArt } from '../gearArt';
import { HAIR, type BodyLook, type Clump } from './body';
import { drawBackGear, drawBodyGear, drawHeadGear, drawShield, drawShoulderGear, drawWeapon, type Dress } from './gear';
import { material } from './palette';
import { ANIMS, FRAME_H, FRAME_W, FRAMES_PER_VIEW, POSES, VIEWS, frameIndex, rigOf, type AnimName, type Rig, type View } from './poses';
import { add, Canvas, cylinder, lerp, type Vec } from './raster';
import { torsoNormal, torsoShape } from './shapes';
import { Sheet } from './sheet';

/** O que está vestido, já com o desenho de cada parte. */
export type DollGear = Partial<Record<EquipSlot, GearArt>>;

/** Materiais do corpo, já com o que roupa, luvas e botas trocam. */
export function dressOf(look: BodyLook, gear: DollGear): Dress {
  const skin = material(look.skin, 'skin');
  const shirt = material(look.shirt, 'cloth');
  const d: Dress = {
    gear,
    look,
    skin,
    hair: material(look.hair, 'hair'),
    shirt,
    sleeve: shirt,
    shortSleeves: true,
    forearm: skin,
    hand: skin,
    pants: material(look.pants, 'cloth'),
    shin: material(look.pants, 'cloth'),
    foot: material(look.shoes, 'leather'),
    belt: material(look.belt, 'leather'),
    buckle: material(look.buckle, 'metal'),
    skirt: false,
    tallBoots: false,
  };
  for (const slot of EQUIP_SLOTS) {
    const art = gear[slot];
    if (!art) continue;
    switch (art.kind) {
      case 'clothes':
        d.shirt = d.sleeve = material(art.shirt, 'cloth');
        d.skirt = art.skirt ?? false;
        if (art.belt) d.belt = material(art.belt, 'leather');
        break;
      case 'plate':
        d.shirt = material(art.metal, 'metal');
        d.sleeve = material(art.chain ?? art.metal, 'metal');
        d.shortSleeves = false;
        break;
      case 'gloves': {
        const m = material(art.color, art.metal ? 'metal' : 'leather');
        d.hand = m;
        if (art.long) d.forearm = m;
        d.gloveCuff = art.long ? m : undefined;
        break;
      }
      case 'boots': {
        const m = material(art.color, art.metal ? 'metal' : 'leather');
        d.foot = m;
        d.tallBoots = art.tall ?? false;
        if (art.tall) d.shin = m;
        d.bootCuff = art.cuff ? material(art.cuff, art.metal ? 'metal' : 'leather') : undefined;
        break;
      }
    }
  }
  return d;
}

// ======================= corpo =======================

function drawLeg(cv: Canvas, r: Rig, d: Dress, i: 0 | 1): void {
  const far = r.view === 'side' && i === 1;
  const bias = far ? -0.22 : 0;
  const hip = r.hip[i];
  const knee = r.knee[i];
  const ankle = r.ankle[i];
  cv.part(`leg${i}`);
  cv.capsule(hip, knee, 3.1, 2.7, d.pants, { bias });
  if (d.tallBoots) {
    const top = lerp(knee, ankle, 0.22);
    cv.capsule(knee, top, 2.6, 2.5, d.pants, { bias });
    cv.part(`boot${i}`);
    cv.capsule(top, ankle, 2.7, 2.3, d.shin, { bias });
    if (d.bootCuff) cv.capsule(add(top, [-2.3, 0.3]), add(top, [2.3, 0.3]), 1.1, 1.1, d.bootCuff, { bias });
  } else {
    cv.capsule(knee, ankle, 2.6, 2.1, d.shin, { bias });
    cv.part(`boot${i}`);
  }
  // pé: de frente/costas uma bota vista de cima; de lado, com o bico para a frente
  if (r.view === 'side') cv.capsule(add(ankle, [-1.2, 1.1]), add(ankle, [3.4, 1.5]), 1.9, 1.6, d.foot, { bias });
  else cv.ellipse(add(ankle, [0, 1.3]), 2.9, 1.9, d.foot, { bias: bias + (r.view === 'up' ? -0.1 : 0) });
}

function drawHips(cv: Canvas, r: Rig, d: Dress): void {
  cv.part('hips');
  const c = add(r.pelvis, [0, 0.6]);
  cv.ellipse(c, r.view === 'side' ? 4.7 : 6.4, 3.1, d.pants);
  if (d.skirt) {
    // saia da túnica, do quadril até o meio da coxa
    cv.part('skirt');
    const top = r.pelvis[1] - 3.5;
    const hem = r.pelvis[1] + 6;
    const pts: Vec[] =
      r.view === 'side'
        ? [
            [c[0] - 4.9, top],
            [c[0] + 5.1, top],
            [c[0] + 6.2, hem],
            [c[0] - 5.9, hem],
          ]
        : [
            [c[0] - 6.6, top],
            [c[0] + 6.6, top],
            [c[0] + 7.8, hem],
            [c[0] - 7.8, hem],
          ];
    cv.polygon(pts, d.shirt, { pattern: (_x, y, t) => (y > hem - 1.2 ? t - 1 : t) });
  }
}

function drawTorso(cv: Canvas, r: Rig, d: Dress): void {
  cv.part('torso');
  cv.polygon(torsoShape(r), d.shirt, { normal: torsoNormal(r) });
  const top = r.neck[1] + 1.4;
  if (r.view === 'down' && d.shirt === d.sleeve && d.shortSleeves) {
    // decote em V
    cv.polygon(
      [
        [r.chest[0] - 2.2, top - 0.2],
        [r.chest[0] + 2.2, top - 0.2],
        [r.chest[0], top + 2.8],
      ],
      d.skin,
      { bias: -0.25 },
    );
  }
}

function drawBelt(cv: Canvas, r: Rig, d: Dress): void {
  cv.part('belt');
  const y = r.pelvis[1] - 3.3;
  const half = r.view === 'side' ? 4.5 : 6.6;
  const x = r.view === 'side' ? r.pelvis[0] + 0.2 : r.pelvis[0];
  cv.polygon(
    [
      [x - half, y - 1],
      [x + half, y - 1],
      [x + half, y + 1],
      [x - half, y + 1],
    ],
    d.belt,
    { normal: (px) => cylinder((px - x) / (half + 0.5), -0.1) },
  );
  if (r.view !== 'up') {
    cv.part('buckle');
    const bx = r.view === 'side' ? x + half - 1.6 : x;
    cv.ellipse([bx, y + 0.1], 1.5, 1.3, d.buckle);
  }
}

function drawArm(cv: Canvas, r: Rig, d: Dress, which: 'main' | 'off', far: boolean): void {
  const bias = far ? -0.25 : 0;
  const s = r.shoulder[which];
  const e = r.elbow[which];
  const h = r.hand[which];
  cv.part(`arm_${which}`);
  if (d.shortSleeves) {
    const cut = lerp(s, e, 0.72);
    cv.capsule(cut, e, 2.3, 2.2, d.skin, { bias });
    cv.capsule(e, h, 2.15, 1.85, d.forearm, { bias });
    cv.part(`sleeve_${which}`);
    cv.capsule(s, cut, 2.9, 2.6, d.sleeve, { bias });
  } else {
    cv.capsule(e, h, 2.2, 1.9, d.forearm, { bias });
    cv.capsule(s, e, 2.9, 2.4, d.sleeve, { bias });
  }
  if (d.gloveCuff) {
    cv.part(`cuff_${which}`);
    const c = lerp(e, h, 0.3);
    cv.ellipse(c, 2.7, 2.2, d.gloveCuff, { bias });
  }
  drawHand(cv, r, d, which, far);
}

function drawHand(cv: Canvas, r: Rig, d: Dress, which: 'main' | 'off', far: boolean): void {
  cv.part(`hand_${which}`);
  cv.ellipse(r.hand[which], 2.15, 2.15, d.hand, { bias: far ? -0.25 : 0 });
}

function drawNeck(cv: Canvas, r: Rig, d: Dress): void {
  cv.part('neck');
  cv.capsule(add(r.neck, [0, -2.5]), add(r.neck, [0, 1.6]), 2.4, 2.5, d.skin, { bias: -0.3 });
}

function drawHead(cv: Canvas, r: Rig, d: Dress): void {
  const h = r.head;
  if (r.view === 'down') {
    cv.part('ear');
    cv.ellipse(add(h, [-6.1, 1.2]), 1.4, 2, d.skin, { bias: -0.1 });
    cv.ellipse(add(h, [6.1, 1.2]), 1.4, 2, d.skin, { bias: -0.1 });
  }
  cv.part('head');
  cv.ellipse(h, 6.5, 7, d.skin);
  if (r.view === 'side') {
    cv.ellipse(add(h, [6.2, 1.8]), 1.25, 1.2, d.skin); // nariz
    cv.part('ear');
    cv.ellipse(add(h, [-1.6, 1.3]), 1.4, 2, d.skin, { bias: -0.1 });
  }
}

/** Cabelo: as mechas do penteado. `back` = só as que ficam atrás do corpo; `covered` = com capacete/chapéu. */
function drawHair(cv: Canvas, r: Rig, d: Dress, layer: 'back' | 'front', covered: boolean): void {
  const clumps: Clump[] = HAIR[d.look.hairStyle][r.view];
  cv.part('hair');
  for (const c of clumps) {
    if ((c.back ?? false) !== (layer === 'back')) continue;
    if (covered && !c.low) continue;
    const at = add(r.head, c.at);
    if (c.to) cv.capsule(at, add(r.head, c.to), c.r[0], c.r[0] * 0.75, d.hair);
    else cv.ellipse(at, c.r[0], c.r[1], d.hair);
  }
}

// ======================= um quadro =======================

function drawFrame(cv: Canvas, r: Rig, d: Dress): void {
  const head = d.gear.head;
  const covered = head !== undefined && (head.kind === 'helmet' || head.kind === 'cap' || head.kind === 'hat');
  switch (r.view) {
    case 'down':
      drawBackGear(cv, r, d, 'behind');
      drawHair(cv, r, d, 'back', covered);
      drawLeg(cv, r, d, 0);
      drawLeg(cv, r, d, 1);
      drawHips(cv, r, d);
      drawNeck(cv, r, d);
      drawTorso(cv, r, d);
      drawBodyGear(cv, r, d, 'torso');
      drawBelt(cv, r, d);
      drawBodyGear(cv, r, d, 'hips');
      drawArm(cv, r, d, 'main', false);
      drawArm(cv, r, d, 'off', false);
      drawShoulderGear(cv, r, d);
      drawBodyGear(cv, r, d, 'neck');
      drawHead(cv, r, d);
      drawHair(cv, r, d, 'front', covered);
      drawHeadGear(cv, r, d);
      drawShield(cv, r, d);
      drawWeapon(cv, r, d);
      drawHand(cv, r, d, 'main', false);
      break;
    case 'up':
      drawWeapon(cv, r, d);
      drawLeg(cv, r, d, 0);
      drawLeg(cv, r, d, 1);
      drawHips(cv, r, d);
      drawNeck(cv, r, d);
      drawTorso(cv, r, d);
      drawBodyGear(cv, r, d, 'torso');
      drawBelt(cv, r, d);
      drawArm(cv, r, d, 'main', false);
      drawArm(cv, r, d, 'off', false);
      drawShoulderGear(cv, r, d);
      drawBackGear(cv, r, d, 'over');
      drawHead(cv, r, d);
      drawHair(cv, r, d, 'front', covered);
      drawHeadGear(cv, r, d);
      drawShield(cv, r, d);
      break;
    case 'side':
      drawBackGear(cv, r, d, 'behind');
      drawArm(cv, r, d, 'off', true);
      drawLeg(cv, r, d, 1);
      drawLeg(cv, r, d, 0);
      drawHips(cv, r, d);
      drawNeck(cv, r, d);
      drawTorso(cv, r, d);
      drawBodyGear(cv, r, d, 'torso');
      drawBelt(cv, r, d);
      drawBodyGear(cv, r, d, 'hips');
      drawBodyGear(cv, r, d, 'neck');
      drawShield(cv, r, d);
      drawHead(cv, r, d);
      drawHair(cv, r, d, 'front', covered);
      drawHeadGear(cv, r, d);
      drawArm(cv, r, d, 'main', false);
      drawShoulderGear(cv, r, d);
      drawWeapon(cv, r, d);
      drawHand(cv, r, d, 'main', false);
      break;
  }
}

/** Colunas e linhas da folha: uma linha por vista, uma coluna por quadro de animação. */
export const SHEET_COLUMNS = FRAMES_PER_VIEW;
export const SHEET_ROWS = VIEWS.length;

/** Desenha um quadro numa folha qualquer (usado também pela prévia da mochila). */
export function drawDollFrame(sheet: Sheet, ox: number, oy: number, look: BodyLook, gear: DollGear, view: View, anim: AnimName, frame: number, dress = dressOf(look, gear)): void {
  const cv = new Canvas(FRAME_W, FRAME_H);
  drawFrame(cv, rigOf(view, POSES[view][anim][frame]!), dress);
  cv.finish(sheet, ox, oy);
}

/** Todos os quadros de todas as vistas (veja frameIndex para achar um quadro). */
export function buildDollSheet(look: BodyLook, gear: DollGear): Sheet {
  const sheet = new Sheet(SHEET_COLUMNS * FRAME_W, SHEET_ROWS * FRAME_H);
  const dress = dressOf(look, gear);
  for (const view of VIEWS) {
    for (const anim of Object.keys(ANIMS) as AnimName[]) {
      for (let f = 0; f < ANIMS[anim]; f++) {
        const index = frameIndex(view, anim, f);
        drawDollFrame(sheet, (index % SHEET_COLUMNS) * FRAME_W, Math.floor(index / SHEET_COLUMNS) * FRAME_H, look, gear, view, anim, f, dress);
      }
    }
  }
  return sheet;
}

/** Só algumas partes do corpo, sem cabeça nem pernas: o "manequim" dos ícones da mochila. */
export function drawIconBody(cv: Canvas, r: Rig, d: Dress, what: 'torso' | 'hands' | 'feet'): void {
  if (what === 'torso') {
    for (const which of ['main', 'off'] as const) {
      cv.part(`sleeve_${which}`);
      cv.capsule(r.shoulder[which], lerp(r.shoulder[which], r.elbow[which], d.shortSleeves ? 0.75 : 1), 2.9, 2.6, d.sleeve);
    }
    drawTorso(cv, r, d);
    drawBodyGear(cv, r, d, 'torso');
    drawBelt(cv, r, d);
    drawBodyGear(cv, r, d, 'hips');
    drawShoulderGear(cv, r, d);
  } else if (what === 'hands') {
    for (const which of ['main', 'off'] as const) {
      cv.part(`arm_${which}`);
      cv.capsule(lerp(r.elbow[which], r.hand[which], d.gloveCuff ? 0.2 : 0.6), r.hand[which], 2.2, 1.9, d.forearm === d.skin ? d.hand : d.forearm);
      if (d.gloveCuff) cv.ellipse(lerp(r.elbow[which], r.hand[which], 0.3), 2.7, 2.2, d.gloveCuff);
      drawHand(cv, r, d, which, false);
    }
  } else {
    for (const i of [0, 1] as const) {
      cv.part(`boot${i}`);
      const top = lerp(r.knee[i], r.ankle[i], d.tallBoots ? 0.15 : 0.62);
      cv.capsule(top, r.ankle[i], 2.7, 2.3, d.tallBoots ? d.shin : d.foot);
      if (d.bootCuff) cv.capsule(add(top, [-2.3, 0.3]), add(top, [2.3, 0.3]), 1.1, 1.1, d.bootCuff);
      if (r.view === 'side') cv.capsule(add(r.ankle[i], [-1.2, 1.1]), add(r.ankle[i], [3.4, 1.5]), 1.9, 1.6, d.foot);
      else cv.ellipse(add(r.ankle[i], [0, 1.3]), 2.9, 1.9, d.foot);
    }
  }
}

/** Uma linha da folha: todos os quadros de uma vista (para montar a folha aos poucos, sem travar o jogo). */
export function buildDollRow(look: BodyLook, gear: DollGear, view: View, dress = dressOf(look, gear)): Sheet {
  const row = new Sheet(SHEET_COLUMNS * FRAME_W, FRAME_H);
  for (const anim of Object.keys(ANIMS) as AnimName[]) {
    for (let f = 0; f < ANIMS[anim]; f++) {
      drawDollFrame(row, (frameIndex(view, anim, f) % SHEET_COLUMNS) * FRAME_W, 0, look, gear, view, anim, f, dress);
    }
  }
  return row;
}
