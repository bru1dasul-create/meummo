// O corpo de base do personagem (sem equipamento) e as cores que vêm do "look" (semente tirada do nome).
// As cores de pele, cabelo, roupa e calça são as mesmas de antes da arte nova, então cada personagem
// continua reconhecível; o penteado e a cor dos olhos também saem do nome.

import { hslToHex } from './palette';
import type { Vec } from './raster';

const SKINS = ['#f6d5b5', '#ecc39d', '#d49d6e', '#ad7449', '#7c4d2e', '#5b3820'];
const HAIRS = ['#2a1c14', '#4b2f1e', '#7b4a25', '#b5803c', '#e2c372', '#dcdcdc', '#9b2f22', '#3b4486', '#2f6a42', '#7d2f72'];
const PANTS = ['#3b3b58', '#4c3a2a', '#2f4a3a', '#5a4632', '#2c2c2c'];
const EYES = ['#5a3a22', '#3a5a8c', '#2f6a42', '#7a5a2a', '#3b3550'];

export type HairStyle = 'curto' | 'longo' | 'espetado' | 'tranca';
const HAIR_STYLES: HairStyle[] = ['curto', 'longo', 'espetado', 'tranca'];

export interface BodyLook {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  belt: string;
  buckle: string;
  eyes: string;
  hairStyle: HairStyle;
}

export function bodyLook(look: number): BodyLook {
  const hue = (look >>> 8) % 360;
  return {
    skin: SKINS[look % SKINS.length]!,
    hair: HAIRS[(look >>> 4) % HAIRS.length]!,
    shirt: hslToHex(hue, 0.55, 0.46),
    pants: PANTS[(look >>> 17) % PANTS.length]!,
    shoes: '#5b3a22',
    belt: '#5a3a1e',
    buckle: '#d8b050',
    eyes: EYES[(look >>> 12) % EYES.length]!,
    hairStyle: HAIR_STYLES[(look >>> 24) % HAIR_STYLES.length]!,
  };
}

// ---------- penteados: "mechas" (elipses com volume) em volta do centro da cabeça ----------
// [x, y, raio x, raio y] relativos ao centro da cabeça (a cabeça tem raio 6,5 x 7).
// `back` vai atrás da cabeça e do corpo (cabelo comprido caindo nas costas, visto de frente).
// `low` = mechas que continuam aparecendo debaixo de capacete e chapéu.

export interface Clump {
  at: Vec;
  r: Vec;
  /** Fica atrás do corpo. */
  back?: boolean;
  /** Aparece mesmo com capacete. */
  low?: boolean;
  /** Mecha alongada: vai de `at` até `to` (cápsula). */
  to?: Vec;
}

type HairViews = Record<'down' | 'up' | 'side', Clump[]>;

const FRONT_TOP: Clump[] = [
  { at: [0, -4.4], r: [7.3, 3.9] },
  { at: [-6.1, -1.2], r: [1.7, 3.8], low: true },
  { at: [6.1, -1.2], r: [1.7, 3.8], low: true },
  { at: [-3.6, -3.9], r: [2.7, 2.2] },
  { at: [0, -4.2], r: [2.8, 2.2] },
  { at: [3.6, -3.8], r: [2.6, 2.2] },
];
const BACK_TOP: Clump[] = [
  { at: [0, -2.2], r: [7.3, 6] },
  { at: [0, 2.6], r: [6.4, 4.2], low: true },
  { at: [-4.6, 1.2], r: [2.6, 4.2], low: true },
  { at: [4.6, 1.2], r: [2.6, 4.2], low: true },
];
const SIDE_TOP: Clump[] = [
  { at: [-1, -4], r: [6.9, 4.4] },
  { at: [-3.8, 0.8], r: [3.3, 4.6], low: true },
  { at: [3.6, -3.9], r: [2.5, 2.1] },
  { at: [0.2, -1], r: [1.3, 2.6], low: true },
];

export const HAIR: Record<HairStyle, HairViews> = {
  curto: { down: FRONT_TOP, up: BACK_TOP, side: SIDE_TOP },
  longo: {
    down: [
      { at: [-5.4, 5.5], r: [3.6, 7.2], back: true, low: true },
      { at: [5.4, 5.5], r: [3.6, 7.2], back: true, low: true },
      ...FRONT_TOP,
      { at: [-6, 3], to: [-6.6, 10.5], r: [2.2, 2.2], low: true },
      { at: [6, 3], to: [6.6, 10.5], r: [2.2, 2.2], low: true },
    ],
    up: [...BACK_TOP, { at: [0, 6], to: [0, 13], r: [6.2, 6.2], low: true }, { at: [-4.5, 9], to: [-4.2, 15], r: [2.6, 2.6], low: true }, { at: [4.5, 9], to: [4.2, 15], r: [2.6, 2.6], low: true }],
    side: [...SIDE_TOP, { at: [-4, 3], to: [-4.6, 12.5], r: [3.2, 3.2], low: true }],
  },
  espetado: {
    down: [
      ...FRONT_TOP,
      { at: [-4.5, -5], to: [-7.5, -9.5], r: [2.2, 2.2] },
      { at: [-1.5, -6], to: [-2, -11.5], r: [2.2, 2.2] },
      { at: [1.8, -6], to: [2.6, -11.2], r: [2.2, 2.2] },
      { at: [4.6, -5], to: [7.8, -9], r: [2.1, 2.1] },
    ],
    up: [
      ...BACK_TOP,
      { at: [-4, -5], to: [-7, -9.5], r: [2.2, 2.2] },
      { at: [-1, -6], to: [-1.5, -11.5], r: [2.2, 2.2] },
      { at: [2.2, -6], to: [3, -11], r: [2.2, 2.2] },
      { at: [5, -4.5], to: [8, -8.5], r: [2.1, 2.1] },
    ],
    side: [
      ...SIDE_TOP,
      { at: [-4, -4], to: [-9, -8], r: [2.2, 2.2] },
      { at: [-1, -6], to: [-4, -11], r: [2.2, 2.2] },
      { at: [2, -6], to: [2, -11], r: [2.1, 2.1] },
    ],
  },
  tranca: {
    down: [
      ...FRONT_TOP,
      { at: [5.6, 4], r: [1.9, 1.7], low: true },
      { at: [6.1, 7.2], r: [1.8, 1.7], low: true },
      { at: [6.4, 10.4], r: [1.7, 1.6], low: true },
      { at: [6.5, 13.2], r: [1.3, 1.4], low: true },
    ],
    up: [
      ...BACK_TOP,
      { at: [0, 8], r: [2.1, 1.8], low: true },
      { at: [0, 11.2], r: [2, 1.8], low: true },
      { at: [0, 14.4], r: [1.9, 1.7], low: true },
      { at: [0, 17.6], r: [1.8, 1.7], low: true },
      { at: [0, 20.4], r: [1.3, 1.4], low: true },
    ],
    side: [
      ...SIDE_TOP,
      { at: [-5.5, 4.5], r: [2, 1.8], low: true },
      { at: [-6, 7.7], r: [1.9, 1.8], low: true },
      { at: [-6.2, 10.9], r: [1.8, 1.7], low: true },
      { at: [-6.3, 13.8], r: [1.3, 1.4], low: true },
    ],
  },
};
