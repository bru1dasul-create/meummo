// Ícone de mochila feito automaticamente a partir do visual do equipamento (gearArt.ts): o item é
// desenhado sozinho (ou num "manequim" invisível) com o mesmo pincel do personagem. Assim um item novo
// com visual já ganha ícone, e o ícone sempre combina com o que aparece no corpo.

import type { DollSlot, GearArt } from '../gearArt';
import type { BodyLook } from './body';
import { dressOf, drawIconBody, type DollGear } from './compose';
import { drawBackGear, drawBodyGear, drawHeadGear, drawShield, drawWeapon } from './gear';
import { FRAME_H, FRAME_W, POSES, rigOf, type Pose, type Rig } from './poses';
import { add, Canvas, dirOf, scale, sub, type Vec } from './raster';
import { Sheet } from './sheet';

export const ICON_SIZE = 32;

/** Manequim de cores neutras, para roupas e luvas aparecerem com as cores delas. */
const MANNEQUIN: BodyLook = {
  skin: '#d9a77a',
  hair: '#4b2f1e',
  shirt: '#8d8778',
  pants: '#4c4c5a',
  shoes: '#5b3a22',
  belt: '#5a3a1e',
  buckle: '#d8b050',
  eyes: '#3a5a8c',
  hairStyle: 'curto',
  build: 'forte',
};

const SLOT_OF: Record<GearArt['kind'], DollSlot> = {
  hat: 'head',
  cap: 'head',
  helmet: 'head',
  clothes: 'body',
  vest: 'body',
  plate: 'body',
  gloves: 'hands',
  boots: 'feet',
  cape: 'charm',
  necklace: 'charm',
  blade: 'weapon',
  axe: 'weapon',
  bow: 'weapon',
  sling: 'weapon',
  shield: 'offhand',
};

/** Em que parte do corpo um visual vai (para conferir que o item do items.json usa o tipo certo). */
export function slotOfArt(art: GearArt): DollSlot {
  return SLOT_OF[art.kind];
}

const idle = (patch: Partial<Pose> = {}): Rig => rigOf('down', { ...POSES.down.idle[0]!, ...patch });

function moveRig(r: Rig, patch: Partial<Pick<Rig, 'head' | 'hand'>>): Rig {
  return { ...r, ...patch };
}

/** O ícone (32x32, já com contorno) ou null se o visual não tem nada para mostrar. */
export function gearIcon(art: GearArt): Sheet | null {
  const gear: DollGear = { [SLOT_OF[art.kind]]: art };
  const d = dressOf(MANNEQUIN, gear);
  const cv = new Canvas(FRAME_W, FRAME_H);
  const center: Vec = [24, 32];
  switch (art.kind) {
    case 'blade':
    case 'axe':
    case 'sling':
    case 'bow': {
      // arma deitada na diagonal, como nos ícones de RPG
      const r = idle({ blade: 45, bow: 45, draw: 0, smear: undefined });
      const length = art.kind === 'blade' || art.kind === 'axe' ? art.length : art.kind === 'bow' ? 2 : 4;
      const hand = sub(center, scale(dirOf(45), length / 2 - (art.kind === 'bow' ? 0 : 1)));
      drawWeapon(cv, moveRig(r, { hand: { main: hand, off: add(hand, [-6, 6]) } }), d);
      break;
    }
    case 'shield':
      drawShield(cv, moveRig(idle(), { hand: { main: [10, 40], off: add(center, [-1.2, 1.8]) } }), d);
      break;
    case 'hat':
    case 'cap':
    case 'helmet':
      drawHeadGear(cv, moveRig(idle(), { head: [24, 38] }), d);
      break;
    case 'clothes':
    case 'vest':
    case 'plate':
      drawIconBody(cv, idle(), d, 'torso');
      break;
    case 'gloves': {
      // um par de luvas lado a lado
      const r = idle();
      drawIconBody(cv, { ...r, elbow: { main: [20, 25], off: [28.5, 25] }, hand: { main: [20, 33], off: [28.5, 33] } }, d, 'hands');
      break;
    }
    case 'boots':
      // o par de botas, um pouco afastadas para não virar um bloco só
      drawIconBody(cv, idle({ feet: [[-1.8, 0], [1.8, 0]] }), d, 'feet');
      break;
    case 'cape':
      drawBackGear(cv, rigOf('up', { ...POSES.up.idle[0]! }), d, 'over');
      break;
    case 'necklace':
      drawBodyGear(cv, idle(), d, 'neck');
      break;
  }
  const full = new Sheet(FRAME_W, FRAME_H);
  cv.finish(full, 0, 0);
  return centered(full);
}

/** Recorta o desenho e centraliza num quadrado de 32x32 (desenho pequeno fica no dobro do tamanho). */
function centered(full: Sheet): Sheet | null {
  let x0 = full.width;
  let y0 = full.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < full.height; y++) {
    for (let x = 0; x < full.width; x++) {
      if (!full.solid(x, y)) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const k = w <= ICON_SIZE / 2 && h <= ICON_SIZE / 2 ? 2 : 1;
  const icon = new Sheet(ICON_SIZE, ICON_SIZE);
  const ox = Math.floor((ICON_SIZE - w * k) / 2);
  const oy = Math.floor((ICON_SIZE - h * k) / 2);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * full.width + x) * 4;
      if (!full.data[i + 3]) continue;
      const color = [full.data[i]!, full.data[i + 1]!, full.data[i + 2]!, 255] as const;
      for (let sy = 0; sy < k; sy++) for (let sx = 0; sx < k; sx++) icon.set(ox + (x - x0) * k + sx, oy + (y - y0) * k + sy, color);
    }
  }
  return icon;
}
