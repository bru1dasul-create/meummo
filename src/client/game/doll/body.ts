// O corpo de base do personagem (sem equipamento) e as cores que vêm do "look" (semente tirada do nome).
// As cores de pele, cabelo, roupa e calça são as mesmas de antes da arte nova, então cada personagem
// continua reconhecível; o penteado, a cor dos olhos e o tipo de corpo também saem do nome.

import { hslToHex } from './palette';
import type { Vec } from './raster';

const SKINS = ['#f6d5b5', '#ecc39d', '#d49d6e', '#ad7449', '#7c4d2e', '#5b3820'];
const HAIRS = ['#2a1c14', '#4b2f1e', '#7b4a25', '#b5803c', '#e2c372', '#dcdcdc', '#9b2f22', '#3b4486', '#2f6a42', '#7d2f72'];
const PANTS = ['#3b3b58', '#4c3a2a', '#2f4a3a', '#5a4632', '#2c2c2c'];
const EYES = ['#6b4423', '#3f6fb0', '#3d8a52', '#8a6a2a', '#5a4a7a'];

export type HairStyle = 'curto' | 'longo' | 'espetado' | 'tranca' | 'coque';
/** Penteados que saem do nome (o coque é de NPC: veja NPC_LOOKS em characters.ts). */
const HAIR_STYLES: HairStyle[] = ['curto', 'longo', 'espetado', 'tranca'];

/** Silhueta: 'forte' (ombros largos) ou 'esguio' (cintura fina, quadril um pouco mais largo). */
export type Build = 'forte' | 'esguio';

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
  build: Build;
  /** Óculos (cor da armação). */
  glasses?: string;
  /** Sorriso no rosto parado (NPC simpático). */
  smile?: boolean;
}

export function bodyLook(look: number): BodyLook {
  const hue = (look >>> 8) % 360;
  return {
    skin: SKINS[look % SKINS.length]!,
    hair: HAIRS[(look >>> 4) % HAIRS.length]!,
    shirt: hslToHex(hue, 0.52, 0.47),
    pants: PANTS[(look >>> 17) % PANTS.length]!,
    shoes: '#6b4426',
    belt: '#5a3a1e',
    buckle: '#d8b050',
    eyes: EYES[(look >>> 12) % EYES.length]!,
    hairStyle: HAIR_STYLES[(look >>> 24) % HAIR_STYLES.length]!,
    build: (look >>> 28) % 2 === 0 ? 'forte' : 'esguio',
  };
}

/** Meia largura do tronco em cada altura, por tipo de corpo: [ombro, peito, cintura, quadril]. */
export const BUILD_WIDTHS: Record<Build, [number, number, number, number]> = {
  forte: [6.9, 6.8, 5.2, 5.4],
  esguio: [6.3, 6, 4.5, 5.6],
};

// ---------- penteados: "mechas" (elipses com volume) em volta do centro da cabeça ----------
// [x, y, raio x, raio y] relativos ao centro da cabeça (a cabeça tem raio 5,6 x 6).
// A testa fica livre (as sobrancelhas ficam 1 pixel acima do centro).
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
  { at: [0, -4.4], r: [6.4, 3.2] },
  { at: [-5.3, -1.6], r: [1.5, 3.1], low: true },
  { at: [5.3, -1.6], r: [1.5, 3.1], low: true },
  { at: [-3.3, -2.8], r: [2.3, 1.7] },
  { at: [-0.2, -3.1], r: [2.4, 1.7] },
  { at: [3.1, -2.7], r: [2.2, 1.6] },
];
const BACK_TOP: Clump[] = [
  { at: [0, -3.4], r: [6.4, 4.2] },
  { at: [0, 1.4], r: [5.6, 3.8], low: true },
  { at: [-4.2, 0], r: [2.2, 3.6], low: true },
  { at: [4.2, 0], r: [2.2, 3.6], low: true },
];
const SIDE_TOP: Clump[] = [
  { at: [-0.8, -3.9], r: [6, 3.6] },
  { at: [-3.4, 0.4], r: [3, 4.3], low: true },
  { at: [3.1, -2.8], r: [2.2, 1.5] },
  { at: [0.5, -1.4], r: [1.1, 2.2], low: true },
];

export const HAIR: Record<HairStyle, HairViews> = {
  curto: { down: FRONT_TOP, up: BACK_TOP, side: SIDE_TOP },
  longo: {
    down: [
      ...FRONT_TOP,
      { at: [-6, 2.4], to: [-6.5, 9.6], r: [1.7, 1.7], low: true },
      { at: [6, 2.4], to: [6.5, 9.6], r: [1.7, 1.7], low: true },
    ],
    up: [...BACK_TOP, { at: [0, 4.5], to: [0, 11.5], r: [5.3, 5.3], low: true }, { at: [-3.9, 8], to: [-3.6, 13.5], r: [2.2, 2.2], low: true }, { at: [3.9, 8], to: [3.6, 13.5], r: [2.2, 2.2], low: true }],
    side: [...SIDE_TOP, { at: [-3.4, 2.5], to: [-4, 10.5], r: [2.7, 2.7], low: true }],
  },
  espetado: {
    down: [
      ...FRONT_TOP,
      { at: [-3.8, -5], to: [-6.5, -8.8], r: [1.9, 1.9] },
      { at: [-1.2, -5.8], to: [-1.7, -10.2], r: [1.9, 1.9] },
      { at: [1.6, -5.8], to: [2.3, -9.9], r: [1.9, 1.9] },
      { at: [4, -4.9], to: [6.7, -8.2], r: [1.8, 1.8] },
    ],
    up: [
      ...BACK_TOP,
      { at: [-3.4, -5], to: [-6, -8.8], r: [1.9, 1.9] },
      { at: [-0.8, -5.8], to: [-1.3, -10.2], r: [1.9, 1.9] },
      { at: [1.9, -5.8], to: [2.6, -9.8], r: [1.9, 1.9] },
      { at: [4.3, -4.6], to: [6.9, -7.8], r: [1.8, 1.8] },
    ],
    side: [
      ...SIDE_TOP,
      { at: [-3.4, -4.2], to: [-7.8, -7.5], r: [1.9, 1.9] },
      { at: [-0.9, -5.6], to: [-3.4, -9.9], r: [1.9, 1.9] },
      { at: [1.7, -5.6], to: [1.7, -9.8], r: [1.8, 1.8] },
    ],
  },
  coque: {
    // cabelo preso: rente na cabeça, com o coque no alto de trás (aparece atrás do chapéu)
    down: [{ at: [0, -4.2], r: [6.3, 3.3] }, { at: [-5.4, -1.2], r: [1.4, 2.8], low: true }, { at: [5.4, -1.2], r: [1.4, 2.8], low: true }, { at: [0, -6.4], r: [2.6, 2], back: true, low: true }],
    up: [{ at: [0, -3.2], r: [6.3, 4.4] }, { at: [0, 1], r: [5.5, 3.6], low: true }, { at: [0, -3], r: [3, 2.6], low: true }],
    side: [{ at: [-0.6, -3.9], r: [5.9, 3.6] }, { at: [-3.2, 0.2], r: [2.9, 4], low: true }, { at: [-4.6, -3.6], r: [2.7, 2.4], low: true }],
  },
  tranca: {
    down: [
      ...FRONT_TOP,
      { at: [4.9, 3.6], r: [1.6, 1.5], low: true },
      { at: [5.3, 6.3], r: [1.5, 1.5], low: true },
      { at: [5.5, 9], r: [1.5, 1.4], low: true },
      { at: [5.6, 11.4], r: [1.1, 1.2], low: true },
    ],
    up: [
      ...BACK_TOP,
      { at: [0, 6.8], r: [1.8, 1.6], low: true },
      { at: [0, 9.6], r: [1.7, 1.6], low: true },
      { at: [0, 12.4], r: [1.6, 1.5], low: true },
      { at: [0, 15.2], r: [1.5, 1.5], low: true },
      { at: [0, 17.6], r: [1.1, 1.2], low: true },
    ],
    side: [
      ...SIDE_TOP,
      { at: [-4.8, 3.9], r: [1.7, 1.6], low: true },
      { at: [-5.2, 6.7], r: [1.6, 1.6], low: true },
      { at: [-5.4, 9.5], r: [1.5, 1.5], low: true },
      { at: [-5.5, 12], r: [1.1, 1.2], low: true },
    ],
  },
};
