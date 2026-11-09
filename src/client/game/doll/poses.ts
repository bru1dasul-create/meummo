// O "esqueleto" do personagem: para cada animação e cada direção, onde ficam a cabeça, as mãos, os pés,
// para onde a arma aponta e quanto a capa balança. Cotovelos e joelhos são calculados (cinemática
// inversa), então o corpo dobra direitinho em qualquer pose — e os equipamentos, presos aos ossos,
// acompanham cada quadro (o chapéu sobe e desce com a respiração, a espada vai junto com a mão...).
//
// Coordenadas em pixels do quadro (64x64, o dobro da resolução do mapa: o personagem aparece com
// metade do tamanho e por isso tem mais detalhe; a sobra dos lados é para armas e golpes). O meio do
// quadro é x = 32 e os pés ficam na linha FEET_Y.
// As mãos são dadas em relação ao ombro (o braço tem ~16 px); os pés, em relação ao pé parado.
// Ângulo das armas em graus: 0 = para cima, 90 = para a direita (para a frente, de lado), 180 = para baixo.

import { add, joint, lerp, type Vec } from './raster';

export const FRAME_W = 64;
export const FRAME_H = 64;
/** Linha da sola dos pés; o ponto de apoio da textura fica logo abaixo. */
export const FEET_Y = 60;
/** Quantos pixels do quadro cabem em 1 pixel do mapa. */
export const DENSITY = 2;
/** Tamanho da cabeça (raios da elipse): os chapéus e capacetes usam isto. */
export const HEAD_RX = 5.6;
export const HEAD_RY = 6;

/** As três vistas desenhadas (a esquerda é a direita espelhada). */
export type View = 'down' | 'up' | 'side';
export const VIEWS: readonly View[] = ['down', 'up', 'side'];

export type AnimName = 'idle' | 'walk' | 'run' | 'shoot' | 'swing' | 'hurt' | 'ko';

/** Quadros de cada animação, na ordem em que ficam na textura. */
export const ANIMS: Record<AnimName, number> = { idle: 4, walk: 6, run: 4, shoot: 3, swing: 4, hurt: 1, ko: 1 };
const ORDER: AnimName[] = ['idle', 'walk', 'run', 'shoot', 'swing', 'hurt', 'ko'];
export const FRAMES_PER_VIEW = ORDER.reduce((n, a) => n + ANIMS[a], 0);

/** Número do quadro na textura (linha = vista, coluna = animação + quadro). */
export function frameIndex(view: View, anim: AnimName, frame: number): number {
  let column = 0;
  for (const a of ORDER) {
    if (a === anim) break;
    column += ANIMS[a];
  }
  return VIEWS.indexOf(view) * FRAMES_PER_VIEW + column + Math.min(frame, ANIMS[anim] - 1);
}

export interface Pose {
  /** Corpo para baixo (+) ou para cima (−): respiração, passo, agachar. */
  bob: number;
  /** Tronco inclinado para a frente (+) ou para trás (−). */
  lean: number;
  /** Deslocamento extra da cabeça. */
  head: Vec;
  /** Mão da arma (direita do personagem) e mão do escudo, em relação ao ombro de cada uma. */
  main: Vec;
  off: Vec;
  /** Pés: [para a frente/lado, levantado] em relação ao pé parado. [perna da esquerda da tela, da direita]; de lado: [perto, longe]. */
  feet: [Vec, Vec];
  /** Para onde apontam espada, machado, estilingue... */
  blade: number;
  /** Para onde o arco mira (o arco fica em pé, de través). */
  bow: number;
  /** Quanto a corda do arco/estilingue está puxada (0 a 1): ela vai até a outra mão. */
  draw: number;
  /** Capa voando para trás (px). */
  cape: number;
  /** Rastro do golpe: arco de ângulo `from` até `to` em volta do ombro. */
  smear?: [number, number];
  /** Cotovelo da mão da arma dobra para o outro lado (braço levantado). */
  flipElbow?: boolean;
}

const pose = (p: Partial<Pose> & Pick<Pose, 'main' | 'off'>): Pose => ({
  bob: 0,
  lean: 0,
  head: [0, 0],
  feet: [
    [0, 0],
    [0, 0],
  ],
  blade: 200,
  bow: 270,
  draw: 0,
  cape: 0,
  ...p,
});

// ======================= de frente (olhando para baixo) =======================
// A mão da arma (direita do personagem) fica do lado ESQUERDO da tela.
const D_MAIN: Vec = [-1, 15];
const D_OFF: Vec = [1, 15];
const down = (p: Partial<Pose>): Pose => pose({ main: D_MAIN, off: D_OFF, blade: 200, bow: 270, ...p });

/** Passo: pés levantados ([esquerda da tela, direita]); a mão oposta à perna vai junto. */
const WALK_LIFT_A = [-1, -0.5, 0.5, 1, 2, 2.5];
const WALK_LIFT_B = [1, 2, 2.5, -1, -0.5, 0.5];
const WALK_BOB = [0, 1, -1, 0, 1, -1];

const DOWN: Record<AnimName, Pose[]> = {
  idle: [0, 0, 1, 1].map((bob, i) => down({ bob, main: add(D_MAIN, [0, i > 1 ? -0.5 : 0]), off: add(D_OFF, [0, i > 1 ? -0.5 : 0]) })),
  walk: WALK_BOB.map((bob, i) =>
    down({
      bob,
      feet: [
        [0, WALK_LIFT_A[i]!],
        [0, WALK_LIFT_B[i]!],
      ],
      main: add(D_MAIN, [0, -WALK_LIFT_B[i]! * 0.5]),
      off: add(D_OFF, [0, -WALK_LIFT_A[i]! * 0.5]),
      cape: 1,
    }),
  ),
  run: [0, 1, 2, 3].map((i) =>
    down({
      bob: i % 2 === 0 ? 0 : -1.5,
      feet: [
        [0, [-2, 1, 4, 1][i]!],
        [0, [4, 1, -2, 1][i]!],
      ],
      main: add(D_MAIN, [0.5, [2, 0, -2.5, 0][i]! - 1]),
      off: add(D_OFF, [-0.5, [-2.5, 0, 2, 0][i]! - 1]),
      cape: 3,
    }),
  ),
  shoot: [
    down({ main: [5.7, 10.4], off: [-5.2, 5.4], blade: 180, bow: 180, draw: 1, bob: -0.5 }),
    down({ main: [5.7, 12.4], off: [-0.7, 8.9], blade: 180, bow: 180, draw: 0 }),
    down({ main: [1.2, 13.9], off: [0.3, 13.4], blade: 190, bow: 200 }),
  ],
  swing: [
    down({ main: [-4.3, -6.6], off: [0.3, 10.4], blade: 300, bob: -1, flipElbow: true }),
    down({ main: [6.7, 12.4], off: [1.3, 12.4], blade: 175, bob: 1, smear: [300, 175] }),
    down({ main: [14.7, 14.9], off: [2.8, 11.4], blade: 140, bob: 1.5 }),
    down({ main: [0.7, 14.9], off: [1, 14.4], blade: 200, bob: 0.5 }),
  ],
  hurt: [
    down({
      bob: -1,
      head: [0, -1],
      main: [1.7, 5.4],
      off: [-1.7, 5.4],
      blade: 230,
      feet: [
        [-1, 0],
        [1, 0],
      ],
    }),
  ],
  ko: [
    down({
      bob: 8,
      head: [1, 1.5],
      main: [1.2, 19],
      off: [-1.2, 19],
      blade: 260,
      feet: [
        [-2.5, 0],
        [2.5, 0],
      ],
    }),
  ],
};

// ======================= de costas: espelho da frente =======================
const mirrorX = (v: Vec): Vec => [-v[0], v[1]];
const mirror = (p: Pose): Pose => ({
  ...p,
  main: mirrorX(p.main),
  off: mirrorX(p.off),
  feet: [
    [-p.feet[1][0], p.feet[1][1]],
    [-p.feet[0][0], p.feet[0][1]],
  ],
  blade: 360 - p.blade,
  bow: 360 - p.bow,
  smear: p.smear ? [360 - p.smear[0], 360 - p.smear[1]] : undefined,
});
const up = (p: Partial<Pose>): Pose => pose({ main: mirrorX(D_MAIN), off: mirrorX(D_OFF), blade: 160, bow: 90, ...p });
const UP: Record<AnimName, Pose[]> = {
  idle: DOWN.idle.map(mirror),
  walk: DOWN.walk.map(mirror),
  run: DOWN.run.map(mirror),
  shoot: [
    up({ main: [-4.7, -6.1], off: [7.7, 0.4], blade: 0, bow: 0, draw: 1, bob: -0.5 }),
    up({ main: [-4.7, -7.1], off: [3.2, 3.4], blade: 0, bow: 0 }),
    up({ main: [-1.2, 5.4], off: [-0.3, 12.4], blade: 20, bow: 20 }),
  ],
  swing: [
    up({ main: [4.3, -6.6], off: [-0.3, 10.4], blade: 60, bob: -1 }),
    up({ main: [-6.7, -9.1], off: [-1.3, 12.4], blade: 0, smear: [60, 0] }),
    up({ main: [-15.2, -2.6], off: [-2.8, 11.4], blade: 315, bob: 1 }),
    up({ main: [-0.7, 13.4], off: [-1, 14.4], blade: 160, bob: 0.5 }),
  ],
  hurt: DOWN.hurt.map(mirror),
  ko: DOWN.ko.map(mirror),
};

// ======================= de lado (olhando para a direita) =======================
// A mão da arma é a de perto (na frente do corpo); a do escudo fica do outro lado.
const S_MAIN: Vec = [1.6, 14.8];
const S_OFF: Vec = [-1.2, 14.8];
const side = (p: Partial<Pose>): Pose => pose({ main: S_MAIN, off: S_OFF, blade: 145, bow: 90, ...p });

const STRIDE = [4, 2.5, 0, -4, -2, 1];
const STRIDE_LIFT = [0, 0, 0, 0.5, 2, 3];
const SIDE: Record<AnimName, Pose[]> = {
  idle: [0, 0, 1, 1].map((bob, i) => side({ bob, main: add(S_MAIN, [0, i > 1 ? -0.5 : 0]), off: add(S_OFF, [0, i > 1 ? -0.5 : 0]) })),
  walk: WALK_BOB.map((bob, i) => {
    const j = (i + 3) % 6;
    return side({
      bob,
      feet: [
        [STRIDE[i]!, STRIDE_LIFT[i]!],
        [STRIDE[j]!, STRIDE_LIFT[j]!],
      ],
      // braço de perto vai para trás quando a perna de perto vai para a frente
      main: add(S_MAIN, [-STRIDE[i]! * 0.9, -Math.abs(STRIDE[i]!) * 0.15]),
      off: add(S_OFF, [-STRIDE[j]! * 0.9, -Math.abs(STRIDE[j]!) * 0.15]),
      blade: 145 - STRIDE[i]! * 3,
      cape: 2 + (i % 3) * 0.5,
    });
  }),
  run: [0, 1, 2, 3].map((i) => {
    const near: Vec = [
      [6, 1, -6, -1][i]!,
      [0, 1, 2.5, 4][i]!,
    ];
    const far: Vec = [
      [-6, -1, 6, 1][i]!,
      [2.5, 4, 0, 1][i]!,
    ];
    return side({
      lean: 2,
      bob: i % 2 === 0 ? 0 : -1.5,
      feet: [near, far],
      main: add(S_MAIN, [-near[0] * 0.9, -3.5]),
      off: add(S_OFF, [-far[0] * 0.9, -3.5]),
      blade: 120,
      cape: 5,
    });
  }),
  shoot: [
    side({ main: [10.9, 5.2], off: [3.2, 6.1], blade: 90, bow: 90, draw: 1, feet: [[2, 0], [-2, 0]] }),
    side({ lean: -0.5, main: [11.4, 6.2], off: [-2.3, 7.6], blade: 95, bow: 90, feet: [[2, 0], [-2, 0]] }),
    side({ main: [6.4, 10.2], off: [-1.8, 12.6], blade: 120, bow: 100, feet: [[1, 0], [-1, 0]] }),
  ],
  swing: [
    side({ lean: -1.5, main: [-6.1, -7.8], off: [2.2, 9.6], blade: 320, bob: -1, flipElbow: true, feet: [[2, 0], [-3, 0]] }),
    side({ lean: 2, main: [9.2, 5.2], off: [-0.8, 12.6], smear: [320, 100], blade: 100, feet: [[4, 0], [-4, 0.5]] }),
    side({ lean: 2, bob: 1, main: [8.4, 13.7], off: [-2.3, 12.6], blade: 150, feet: [[4, 0], [-4, 0.5]] }),
    side({ lean: 0.5, main: [3.9, 14.2], off: [-1.3, 14.1], blade: 145, feet: [[2, 0], [-2, 0]] }),
  ],
  hurt: [side({ lean: -2.5, bob: -1, head: [-1, -0.5], main: [-2.6, 6.2], off: [1.7, 6.6], blade: 30, feet: [[-1, 0], [2, 0]] })],
  ko: [side({ bob: 8, lean: 1.5, head: [1.5, 1.5], main: [5.4, 19], off: [2.2, 19.5], blade: 100, feet: [[4.5, 0], [1.5, 0]] })],
};

export const POSES: Record<View, Record<AnimName, Pose[]>> = { down: DOWN, up: UP, side: SIDE };

// ======================= ossos =======================

export interface Rig {
  view: View;
  pose: Pose;
  head: Vec;
  neck: Vec;
  chest: Vec;
  /** Cintura (a parte mais fina do tronco). */
  waist: Vec;
  pelvis: Vec;
  shoulder: { main: Vec; off: Vec };
  elbow: { main: Vec; off: Vec };
  hand: { main: Vec; off: Vec };
  /** [esquerda da tela, direita] (de lado: [perto, longe]). */
  hip: [Vec, Vec];
  knee: [Vec, Vec];
  ankle: [Vec, Vec];
}

const UPPER_ARM = 8;
const FOREARM = 7.8;
const THIGH = 9.6;
const SHIN = 9.2;

interface Base {
  head: Vec;
  neck: Vec;
  chest: Vec;
  waist: Vec;
  pelvis: Vec;
  shoulder: { main: Vec; off: Vec };
  hip: [Vec, Vec];
  ankle: [Vec, Vec];
}

const FRONT_BASE: Base = {
  head: [32, 14],
  neck: [32, 21.5],
  chest: [32, 28],
  waist: [32, 34],
  pelvis: [32, 38.5],
  shoulder: { main: [25.6, 24.8], off: [38.4, 24.8] },
  hip: [
    [29.6, 39.6],
    [34.4, 39.6],
  ],
  ankle: [
    [29.4, 57.6],
    [34.6, 57.6],
  ],
};
const mirrorPoint = (v: Vec): Vec => [FRAME_W - v[0], v[1]];
const BASES: Record<View, Base> = {
  down: FRONT_BASE,
  up: {
    ...FRONT_BASE,
    shoulder: { main: mirrorPoint(FRONT_BASE.shoulder.main), off: mirrorPoint(FRONT_BASE.shoulder.off) },
  },
  side: {
    head: [33, 14],
    neck: [32.3, 21.5],
    chest: [32.4, 28],
    waist: [32.2, 34],
    pelvis: [32, 38.5],
    shoulder: { main: [31.7, 25], off: [32.7, 24.6] },
    hip: [
      [31.5, 39.6],
      [32.7, 39.6],
    ],
    ankle: [
      [31.6, 57.6],
      [32.8, 57.6],
    ],
  },
};

/** Calcula todos os ossos de um quadro. */
export function rigOf(view: View, p: Pose): Rig {
  const b = BASES[view];
  const shift = (v: Vec, lean: number): Vec => [v[0] + p.lean * lean, v[1] + p.bob];
  const shoulder = { main: shift(b.shoulder.main, 0.8), off: shift(b.shoulder.off, 0.8) };
  const hand = { main: add(shoulder.main, p.main), off: add(shoulder.off, p.off) };
  const hip: [Vec, Vec] = [shift(b.hip[0], 0.15), shift(b.hip[1], 0.15)];
  const ankle: [Vec, Vec] = [add(b.ankle[0], [p.feet[0][0], -p.feet[0][1]]), add(b.ankle[1], [p.feet[1][0], -p.feet[1][1]])];
  // para que lado dobram cotovelos e joelhos em cada vista
  const elbowBend = view === 'side' ? { main: 1, off: 1 } : view === 'down' ? { main: 1, off: -1 } : { main: -1, off: 1 };
  if (p.flipElbow) elbowBend.main = -elbowBend.main;
  const kneeBend = view === 'side' ? [-1, -1] : [1, -1];
  return {
    view,
    pose: p,
    // a cabeça fica sempre num pixel inteiro: assim o rosto (outra camada) encaixa certinho
    head: [Math.round(b.head[0] + p.lean + p.head[0]), Math.round(b.head[1] + p.bob + p.head[1])],
    neck: shift(b.neck, 0.9),
    chest: shift(b.chest, 0.7),
    waist: shift(b.waist, 0.45),
    pelvis: shift(b.pelvis, 0.15),
    shoulder,
    hand,
    elbow: {
      main: joint(shoulder.main, hand.main, UPPER_ARM, FOREARM, elbowBend.main),
      off: joint(shoulder.off, hand.off, UPPER_ARM, FOREARM, elbowBend.off),
    },
    hip,
    ankle,
    knee: [0, 1].map((i) => {
      const k = joint(hip[i]!, ankle[i]!, THIGH, SHIN, kneeBend[i]!);
      // de frente/costas o joelho dobra para a frente (para a câmera): quase não se vê de lado
      return view === 'side' ? k : lerp(lerp(hip[i]!, ankle[i]!, 0.5), k, 0.3);
    }) as [Vec, Vec],
  };
}

/** Canto da caixa do rosto (12x12) neste quadro: 6 px à esquerda e 6 acima do centro da cabeça. */
export function faceOrigin(view: View, anim: AnimName, frame: number): Vec {
  const head = rigOf(view, POSES[view][anim][Math.min(frame, ANIMS[anim] - 1)]!).head;
  return [head[0] - 6, head[1] - 6];
}
