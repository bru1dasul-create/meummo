// Monta o personagem camada por camada ("boneco de papel"): pernas, quadril, tronco, braços, cabeça,
// cabelo e cada equipamento, em todos os quadros de todas as animações. A ordem das camadas muda com a
// direção (de costas, a arma fica atrás do corpo e a capa na frente; de lado, o braço de longe fica atrás...).
// O resultado é uma folha só por combinação de aparência + equipamentos (rápido de desenhar no jogo).

import { EQUIP_SLOTS, type EquipSlot } from '../../../shared/items';
import type { GearArt } from '../gearArt';
import { HAIR, type BodyLook, type Clump } from './body';
import { drawBackGear, drawBodyGear, drawHeadGear, drawShield, drawShoulderGear, drawWeapon, type Dress } from './gear';
import { material } from './palette';
import { ANIMS, FRAME_H, FRAME_W, FRAMES_PER_VIEW, HEAD_RX, HEAD_RY, POSES, VIEWS, frameIndex, rigOf, type AnimName, type Rig, type View } from './poses';
import { add, Canvas, cylinder, lerp, type Vec } from './raster';
import { torsoEdges, torsoNormal, torsoShape } from './shapes';
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

function drawFoot(cv: Canvas, r: Rig, d: Dress, i: 0 | 1, bias: number): void {
  const a = r.ankle[i];
  if (r.view === 'side') {
    // bota de lado: calcanhar, peito do pé e bico, com a sola reta no chão
    cv.polygon([add(a, [-1.9, -0.9]), add(a, [1.1, -0.9]), add(a, [3.5, 0.7]), add(a, [3.9, 2.4]), add(a, [-2.1, 2.4])], d.foot, {
      bias,
      normal: (_x, y) => {
        const v = Math.max(-1, Math.min(1, (y - a[1] - 0.5) / 2));
        return [0.2, v, Math.sqrt(Math.max(0, 1 - v * v))];
      },
    });
    cv.line(add(a, [-2, 2.1]), add(a, [3.8, 2.1]), d.foot.ramp[0]);
  } else {
    // de frente/costas: o bico da bota visto de cima, com a sola embaixo
    cv.ellipse(add(a, [0, 0.9]), 2.15, 1.6, d.foot, { bias });
    cv.line(add(a, [-1.7, 2.1]), add(a, [1.7, 2.1]), d.foot.ramp[0]);
  }
}

function drawLeg(cv: Canvas, r: Rig, d: Dress, i: 0 | 1): void {
  const far = r.view === 'side' && i === 1;
  const bias = far ? -0.28 : 0;
  const hip = r.hip[i];
  const knee = r.knee[i];
  const ankle = r.ankle[i];
  const bootTop = lerp(knee, ankle, d.tallBoots ? 0.18 : 0.64);
  cv.part(`leg${i}`);
  cv.capsule(hip, knee, 2.65, 2.0, d.pants, { bias });
  cv.capsule(knee, bootTop, 2.0, 1.75, d.pants, { bias });
  cv.part(`boot${i}`);
  cv.capsule(bootTop, ankle, 1.95, 1.5, d.tallBoots ? d.shin : d.foot, { bias });
  if (d.bootCuff) cv.capsule(add(bootTop, [-1.9, 0.2]), add(bootTop, [1.9, 0.2]), 0.9, 0.9, d.bootCuff, { bias });
  else cv.line(add(bootTop, [-1.5, 0.4]), add(bootTop, [1.5, 0.4]), d.foot.ramp[3]); // dobra do cano
  drawFoot(cv, r, d, i, bias);
}

function drawHips(cv: Canvas, r: Rig, d: Dress): void {
  cv.part('hips');
  const p = r.pelvis;
  const build = d.look.build;
  if (r.view === 'side') {
    cv.ellipse(add(p, [-0.2, 0.8]), 3.6, 2.8, d.pants);
  } else {
    const [l, rr] = torsoEdges(r, build, p[1]);
    cv.polygon(
      [
        [l, p[1] - 1],
        [rr, p[1] - 1],
        [rr - 0.3, p[1] + 2.3],
        [p[0] + 0.8, p[1] + 3.4],
        [p[0] - 0.8, p[1] + 3.4],
        [l + 0.3, p[1] + 2.3],
      ],
      d.pants,
      { normal: (x, y) => cylinder((x - p[0]) / (rr - p[0] + 0.6), (y - p[1]) / 10) },
    );
  }
  if (d.skirt) {
    // saia da túnica, da cintura até o meio da coxa, com a barra mais escura
    cv.part('skirt');
    const top = r.waist[1] + 1;
    const hem = p[1] + 6.5;
    const [l, rr] = torsoEdges(r, build, top);
    const flare = r.view === 'side' ? 1.2 : 1.6;
    cv.polygon(
      [
        [l, top],
        [rr, top],
        [rr + flare, hem],
        [l - flare, hem],
      ],
      d.shirt,
      { pattern: (x, y, t) => (y > hem - 1.2 ? t - 1 : Math.sin(x * 1.3) > 0.7 ? t - 1 : t) },
    );
  }
}

function drawTorso(cv: Canvas, r: Rig, d: Dress): void {
  const build = d.look.build;
  cv.part('torso');
  cv.polygon(torsoShape(r, build), d.shirt, { normal: torsoNormal(r, build) });
  const plain = d.shirt === d.sleeve && d.shortSleeves; // camisa (não armadura)
  if (!plain) return;
  const top = r.neck[1] + 1.2;
  const cx = r.chest[0];
  const fold = d.shirt.ramp[1];
  if (r.view === 'down') {
    // decote em V com a gola
    cv.polygon(
      [
        [cx - 1.9, top - 0.3],
        [cx + 1.9, top - 0.3],
        [cx, top + 3.2],
      ],
      d.skin,
      { bias: -0.2 },
    );
    cv.line([cx - 2.3, top], [cx - 0.3, top + 3.4], d.shirt.ramp[0]);
    cv.line([cx + 2.3, top], [cx + 0.3, top + 3.4], d.shirt.ramp[0]);
    // dobrinhas do pano perto da cintura e debaixo do braço
    cv.line([cx - 3.6, r.waist[1] - 3], [cx - 2.4, r.waist[1] - 1], fold);
    cv.line([cx + 3.4, r.waist[1] - 2.6], [cx + 2.4, r.waist[1] - 0.8], fold);
    const [l, rr] = torsoEdges(r, build, r.chest[1] + 1);
    cv.line([l + 1.2, r.chest[1]], [l + 2, r.chest[1] + 2.4], fold);
    cv.line([rr - 1.2, r.chest[1]], [rr - 2, r.chest[1] + 2.4], fold);
  } else if (r.view === 'side') {
    cv.line([cx + 1.4, top], [cx + 2.6, top + 2], d.shirt.ramp[0]); // gola
    cv.line([cx + 0.5, r.waist[1] - 2.5], [cx + 1.8, r.waist[1] - 0.8], fold);
  } else {
    cv.line([cx - 2.4, top + 0.4], [cx + 2.4, top + 0.4], d.shirt.ramp[0]); // gola de costas
    cv.line([cx - 0.5, r.waist[1] - 4], [cx - 0.5, r.waist[1] - 1], fold);
  }
}

function drawBelt(cv: Canvas, r: Rig, d: Dress): void {
  const build = d.look.build;
  const y = r.waist[1] + 2.6;
  const [l, rr] = torsoEdges(r, build, y);
  cv.part('belt');
  cv.polygon(
    [
      [l - 0.3, y - 1],
      [rr + 0.3, y - 1],
      [rr + 0.3, y + 1],
      [l - 0.3, y + 1],
    ],
    d.belt,
    { normal: (px) => cylinder((px - (l + rr) / 2) / ((rr - l) / 2 + 0.8), -0.1) },
  );
  // bolsinha de couro presa no cinto (do lado da mão do escudo)
  cv.part('pouch');
  const pouch = material(d.look.belt, 'leather');
  const px = r.view === 'side' ? l + 0.8 : r.view === 'down' ? rr - 1.6 : l + 1.6;
  cv.ellipse([px, y + 2], 1.7, 1.9, pouch, { bias: 0.1 });
  cv.line([px - 1.5, y + 1.2], [px + 1.5, y + 1.2], pouch.ramp[0]);
  if (r.view !== 'up') {
    cv.part('buckle');
    const bx = r.view === 'side' ? rr - 1.2 : (l + rr) / 2;
    cv.polygon(
      [
        [bx - 1.5, y - 1.1],
        [bx + 1.5, y - 1.1],
        [bx + 1.5, y + 1.1],
        [bx - 1.5, y + 1.1],
      ],
      d.buckle,
      { normal: (x2, y2) => [(x2 - bx) / 2.5, (y2 - y) / 2.5, 0.8] },
    );
    cv.dot(bx, y, d.belt.ramp[0]);
  }
}

function drawArm(cv: Canvas, r: Rig, d: Dress, which: 'main' | 'off', far: boolean): void {
  const bias = far ? -0.28 : 0;
  const s = r.shoulder[which];
  const e = r.elbow[which];
  const h = r.hand[which];
  cv.part(`arm_${which}`);
  cv.capsule(e, lerp(e, h, 0.85), 1.6, 1.2, d.forearm, { bias });
  if (d.shortSleeves) {
    const cut = lerp(s, e, 0.6);
    cv.capsule(cut, e, 1.8, 1.6, d.skin, { bias });
    cv.part(`sleeve_${which}`);
    cv.capsule(s, cut, 2.3, 2.1, d.sleeve, { bias });
    // barra da manga
    const dx = e[0] - s[0];
    const dy = e[1] - s[1];
    const n = Math.hypot(dx, dy) || 1;
    const p: Vec = [-dy / n, dx / n];
    cv.line(add(cut, [p[0] * -1.9, p[1] * -1.9]), add(cut, [p[0] * 1.9, p[1] * 1.9]), d.sleeve.ramp[0]);
  } else {
    cv.capsule(s, e, 2.25, 1.8, d.sleeve, { bias });
  }
  if (d.gloveCuff) {
    cv.part(`cuff_${which}`);
    cv.ellipse(lerp(e, h, 0.4), 2, 1.7, d.gloveCuff, { bias });
  }
  drawHand(cv, r, d, which, far);
}

function drawHand(cv: Canvas, r: Rig, d: Dress, which: 'main' | 'off', far: boolean): void {
  const bias = far ? -0.28 : 0;
  const h = r.hand[which];
  cv.part(`hand_${which}`);
  cv.ellipse(h, 1.75, 1.85, d.hand, { bias });
  // polegar, do lado de dentro (de frente/costas) ou da frente (de lado)
  const thumb = r.view === 'side' ? 1.4 : (which === 'main') === (r.view === 'down') ? 1.3 : -1.3;
  cv.ellipse(add(h, [thumb, -0.9]), 0.85, 0.85, d.hand, { bias });
}

function drawNeck(cv: Canvas, r: Rig, d: Dress): void {
  cv.part('neck');
  cv.capsule(add(r.neck, [0, -2.4]), add(r.neck, [0, 1.4]), 1.7, 1.9, d.skin, { bias: -0.2 });
}

/** Contorno da cabeça: oval com o queixo mais fino. */
function headShape(r: Rig): Vec[] {
  const pts: Vec[] = [];
  const side = r.view === 'side';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const down = Math.max(0, Math.sin(a));
    const rx = HEAD_RX * (1 - 0.26 * down * down);
    pts.push([r.head[0] + Math.cos(a) * rx + (side ? down * 0.6 : 0), r.head[1] + Math.sin(a) * HEAD_RY]);
  }
  return pts;
}

function drawHead(cv: Canvas, r: Rig, d: Dress): void {
  const h = r.head;
  if (r.view !== 'side') {
    cv.part('ear');
    cv.ellipse(add(h, [-(HEAD_RX - 0.3), 0.9]), 1.05, 1.5, d.skin, { bias: -0.15 });
    cv.ellipse(add(h, [HEAD_RX - 0.3, 0.9]), 1.05, 1.5, d.skin, { bias: -0.15 });
  }
  cv.part('head');
  cv.polygon(headShape(r), d.skin, {
    normal: (x, y) => {
      const nx = (x - h[0]) / (HEAD_RX + 0.5);
      const ny = (y - h[1]) / (HEAD_RY + 0.5);
      return [nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))];
    },
  });
  if (r.view === 'side') {
    cv.ellipse(add(h, [HEAD_RX + 0.1, 1.6]), 0.95, 1, d.skin); // nariz
    cv.part('ear');
    cv.ellipse(add(h, [-1.1, 0.9]), 1.05, 1.5, d.skin, { bias: -0.15 });
  }
}

/** Cabelo: as mechas do penteado. `back` = só as que ficam atrás do corpo; `covered` = com capacete/chapéu. */
function drawHair(cv: Canvas, r: Rig, d: Dress, layer: 'back' | 'front', covered: boolean): void {
  const clumps: Clump[] = HAIR[d.look.hairStyle][r.view];
  clumps.forEach((c, k) => {
    if ((c.back ?? false) !== (layer === 'back')) return;
    if (covered && !c.low) return;
    // cada mecha é uma parte: onde uma cobre a outra aparece a linha que separa os fios
    cv.part(`hair${k}`);
    const at = add(r.head, c.at);
    if (c.to) cv.capsule(at, add(r.head, c.to), c.r[0], c.r[0] * 0.7, d.hair);
    else cv.ellipse(at, c.r[0], c.r[1], d.hair);
  });
  if (layer === 'front' && !covered && r.view !== 'up') {
    // brilho do cabelo: um arquinho claro no alto, do lado da luz
    const shine = d.hair.ramp[4];
    for (let i = 0; i <= 4; i++) {
      const a = Math.PI * (1.12 + i * 0.07);
      const x = r.head[0] + (r.view === 'side' ? -1 : -0.5) + Math.cos(a) * 4.2;
      const y = r.head[1] - 3.6 + Math.sin(a) * 2.4;
      if (cv.filled(Math.floor(x), Math.floor(y))) cv.dot(x, y, shine);
    }
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
      cv.capsule(r.shoulder[which], lerp(r.shoulder[which], r.elbow[which], d.shortSleeves ? 0.6 : 1), 2.3, 2.05, d.sleeve);
    }
    drawTorso(cv, r, d);
    drawBodyGear(cv, r, d, 'torso');
    drawBelt(cv, r, d);
    drawBodyGear(cv, r, d, 'hips');
    drawShoulderGear(cv, r, d);
  } else if (what === 'hands') {
    for (const which of ['main', 'off'] as const) {
      cv.part(`arm_${which}`);
      cv.capsule(lerp(r.elbow[which], r.hand[which], d.gloveCuff ? 0.2 : 0.6), r.hand[which], 1.7, 1.3, d.forearm === d.skin ? d.hand : d.forearm);
      if (d.gloveCuff) cv.ellipse(lerp(r.elbow[which], r.hand[which], 0.35), 2, 1.7, d.gloveCuff);
      drawHand(cv, r, d, which, false);
    }
  } else {
    for (const i of [0, 1] as const) {
      cv.part(`boot${i}`);
      const top = lerp(r.knee[i], r.ankle[i], d.tallBoots ? 0.15 : 0.6);
      cv.capsule(top, r.ankle[i], 2, 1.55, d.tallBoots ? d.shin : d.foot);
      if (d.bootCuff) cv.capsule(add(top, [-1.9, 0.2]), add(top, [1.9, 0.2]), 0.9, 0.9, d.bootCuff);
      drawFoot(cv, r, d, i, 0);
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
