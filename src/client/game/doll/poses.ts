// O "esqueleto" do personagem: para cada animação e cada direção, onde ficam a cabeça, as mãos, os pés,
// para onde a arma aponta e quanto a capa balança. Cotovelos e joelhos são calculados (cinemática
// inversa), então o corpo dobra direitinho em qualquer pose — e os equipamentos, presos aos ossos,
// acompanham cada quadro (o chapéu sobe e desce com a respiração, a espada vai junto com a mão...).
//
// Coordenadas em pixels do quadro (48x64, o dobro da resolução do mapa: o personagem aparece com
// metade do tamanho, 24x32, e por isso tem mais detalhe). Os pés ficam na linha FEET_Y.
// Ângulo das armas em graus: 0 = para cima, 90 = para a direita (para a frente, de lado), 180 = para baixo.

import { add, joint, lerp, type Vec } from './raster';

export const FRAME_W = 48;
export const FRAME_H = 64;
/** Linha da sola dos pés; o ponto de apoio da textura fica logo abaixo. */
export const FEET_Y = 60;
/** Quantos pixels do quadro cabem em 1 pixel do mapa. */
export const DENSITY = 2;

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
  /** Mão da arma (direita do personagem) e mão do escudo: onde elas ficam (antes do bob). */
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
const D_MAIN: Vec = [14.8, 42.5];
const D_OFF: Vec = [33.2, 42.5];
const down = (p: Partial<Pose>): Pose => pose({ main: D_MAIN, off: D_OFF, blade: 200, bow: 270, ...p });

/** Passo: [pé esquerdo da tela, pé direito] levantados; a mão oposta à perna vai junto. */
const WALK_LIFT_A = [-1, -0.5, 0.5, 1, 2, 2.5];
const WALK_LIFT_B = [1, 2, 2.5, -1, -0.5, 0.5];
const WALK_BOB = [0, 1, -1, 0, 1, -1];

const DOWN: Record<AnimName, Pose[]> = {
  idle: [0, 0, 1, 1].map((bob, i) => down({ bob, main: add(D_MAIN, [0, i > 1 ? 0.5 : 0]), off: add(D_OFF, [0, i > 1 ? 0.5 : 0]) })),
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
      main: add(D_MAIN, [0.5, [2, 0, -2.5, 0][i]!]),
      off: add(D_OFF, [-0.5, [-2.5, 0, 2, 0][i]!]),
      cape: 3,
    }),
  ),
  shoot: [
    down({ main: [21.5, 38], off: [27, 33], blade: 180, bow: 180, draw: 1, bob: -0.5 }),
    down({ main: [21.5, 40], off: [31.5, 36.5], blade: 180, bow: 180, draw: 0 }),
    down({ main: [17, 41.5], off: [32.5, 41], blade: 190, bow: 200 }),
  ],
  swing: [
    down({ main: [11.5, 21], off: [32.5, 38], blade: 300, bob: -1, lean: 0, flipElbow: true }),
    down({ main: [22.5, 40], off: [33.5, 40], blade: 175, bob: 1, smear: [300, 175] }),
    down({ main: [30.5, 42.5], off: [35, 39], blade: 140, bob: 1.5 }),
    down({ main: [16.5, 42.5], off: [33.2, 42], blade: 200, bob: 0.5 }),
  ],
  hurt: [
    down({
      bob: -1,
      head: [0, -1],
      main: [17.5, 33],
      off: [30.5, 33],
      blade: 230,
      feet: [
        [-1, 0],
        [1, 0],
      ],
    }),
  ],
  ko: [
    down({
      bob: 7,
      head: [1, 1.5],
      main: [17, 49],
      off: [31, 49],
      blade: 260,
      feet: [
        [-2, 0],
        [2, 0],
      ],
    }),
  ],
};

// ======================= de costas: espelho da frente =======================
const mirrorVec = (v: Vec): Vec => [48 - v[0], v[1]];
const mirror = (p: Pose): Pose => ({
  ...p,
  main: mirrorVec(p.main),
  off: mirrorVec(p.off),
  feet: [
    [-p.feet[1][0], p.feet[1][1]],
    [-p.feet[0][0], p.feet[0][1]],
  ],
  blade: 360 - p.blade,
  bow: 360 - p.bow,
  smear: p.smear ? [360 - p.smear[0], 360 - p.smear[1]] : undefined,
});
const U_MAIN = mirrorVec(D_MAIN);
const U_OFF = mirrorVec(D_OFF);
const up = (p: Partial<Pose>): Pose => pose({ main: U_MAIN, off: U_OFF, blade: 160, bow: 90, ...p });
const UP: Record<AnimName, Pose[]> = {
  idle: DOWN.idle.map(mirror),
  walk: DOWN.walk.map(mirror),
  run: DOWN.run.map(mirror),
  shoot: [
    up({ main: [27.5, 21.5], off: [23.5, 28], blade: 0, bow: 0, draw: 1, bob: -0.5 }),
    up({ main: [27.5, 20.5], off: [19, 31], blade: 0, bow: 0 }),
    up({ main: [31, 33], off: [15.5, 40], blade: 20, bow: 20 }),
  ],
  swing: [
    up({ main: [36.5, 21], off: [15.5, 38], blade: 60, bob: -1 }),
    up({ main: [25.5, 18.5], off: [14.5, 40], blade: 0, smear: [60, 0] }),
    up({ main: [17, 25], off: [13, 39], blade: 315, bob: 1 }),
    up({ main: [31.5, 41], off: [14.8, 42], blade: 160, bob: 0.5 }),
  ],
  hurt: DOWN.hurt.map(mirror),
  ko: DOWN.ko.map(mirror),
};

// ======================= de lado (olhando para a direita) =======================
// A mão da arma é a de perto (na frente do corpo); a do escudo fica do outro lado.
const S_MAIN: Vec = [25.5, 42.5];
const S_OFF: Vec = [23.5, 42];
const side = (p: Partial<Pose>): Pose => pose({ main: S_MAIN, off: S_OFF, blade: 145, bow: 90, ...p });

const STRIDE = [4, 2.5, 0, -4, -2, 1];
const STRIDE_LIFT = [0, 0, 0, 0.5, 2, 3];
const SIDE: Record<AnimName, Pose[]> = {
  idle: [0, 0, 1, 1].map((bob, i) => side({ bob, main: add(S_MAIN, [0, i > 1 ? 0.5 : 0]), off: add(S_OFF, [0, i > 1 ? 0.5 : 0]) })),
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
      main: add(S_MAIN, [-near[0] * 0.9, -3]),
      off: add(S_OFF, [-far[0] * 0.9, -3]),
      blade: 120,
      cape: 5,
    });
  }),
  shoot: [
    side({ main: [34.5, 33], off: [28, 33.5], blade: 90, bow: 90, draw: 1, feet: [[2, 0], [-2, 0]] }),
    side({ lean: -0.5, main: [35, 34], off: [22.5, 35], blade: 95, bow: 90, feet: [[2, 0], [-2, 0]] }),
    side({ main: [30, 38], off: [23, 40], blade: 120, bow: 100, feet: [[1, 0], [-1, 0]] }),
  ],
  swing: [
    side({ lean: -1.5, main: [17.5, 20], off: [27, 37], blade: 320, bob: -1, flipElbow: true, feet: [[2, 0], [-3, 0]] }),
    side({ lean: 2, main: [34.5, 32], off: [24, 40], blade: 100, smear: [320, 100], feet: [[4, 0], [-4, 0.5]] }),
    side({ lean: 2, bob: 1, main: [32, 41.5], off: [22.5, 40], blade: 150, feet: [[4, 0], [-4, 0.5]] }),
    side({ lean: 0.5, main: [27.5, 42], off: [23.5, 41.5], blade: 145, feet: [[2, 0], [-2, 0]] }),
  ],
  hurt: [side({ lean: -2.5, bob: -1, head: [-1, -0.5], main: [21, 34], off: [26.5, 34], blade: 30, feet: [[-1, 0], [2, 0]] })],
  ko: [side({ bob: 7, lean: 1.5, head: [1.5, 1.5], main: [29, 49], off: [27, 49.5], blade: 100, feet: [[4, 0], [1, 0]] })],
};

export const POSES: Record<View, Record<AnimName, Pose[]>> = { down: DOWN, up: UP, side: SIDE };

// ======================= ossos =======================

export interface Rig {
  view: View;
  pose: Pose;
  head: Vec;
  neck: Vec;
  chest: Vec;
  pelvis: Vec;
  shoulder: { main: Vec; off: Vec };
  elbow: { main: Vec; off: Vec };
  hand: { main: Vec; off: Vec };
  /** [esquerda da tela, direita] (de lado: [perto, longe]). */
  hip: [Vec, Vec];
  knee: [Vec, Vec];
  ankle: [Vec, Vec];
}

const UPPER_ARM = 7.9;
const FOREARM = 7.6;
const THIGH = 7.7;
const SHIN = 7.5;

interface Base {
  head: Vec;
  neck: Vec;
  chest: Vec;
  pelvis: Vec;
  shoulder: { main: Vec; off: Vec };
  hip: [Vec, Vec];
  ankle: [Vec, Vec];
}

const FRONT_BASE: Base = {
  head: [24, 17],
  neck: [24, 24.5],
  chest: [24, 31],
  pelvis: [24, 42],
  shoulder: { main: [15.8, 27.6], off: [32.2, 27.6] },
  hip: [
    [20.2, 43],
    [27.8, 43],
  ],
  ankle: [
    [20.2, 57.8],
    [27.8, 57.8],
  ],
};
const BASES: Record<View, Base> = {
  down: FRONT_BASE,
  up: {
    ...FRONT_BASE,
    shoulder: { main: mirrorVec(FRONT_BASE.shoulder.main), off: mirrorVec(FRONT_BASE.shoulder.off) },
  },
  side: {
    head: [25, 17],
    neck: [24.2, 24.5],
    chest: [24.2, 31],
    pelvis: [24, 42],
    shoulder: { main: [23.6, 27.8], off: [24.8, 27.4] },
    hip: [
      [23.4, 43],
      [24.8, 43],
    ],
    ankle: [
      [23.6, 57.8],
      [24.8, 57.8],
    ],
  },
};

/** Calcula todos os ossos de um quadro. */
export function rigOf(view: View, p: Pose): Rig {
  const b = BASES[view];
  const shift = (v: Vec, lean: number): Vec => [v[0] + p.lean * lean, v[1] + p.bob];
  const shoulder = { main: shift(b.shoulder.main, 0.8), off: shift(b.shoulder.off, 0.8) };
  const hand = { main: shift(p.main, view === 'side' ? 0.8 : 0), off: shift(p.off, view === 'side' ? 0.8 : 0) };
  const hip: [Vec, Vec] = [shift(b.hip[0], 0.2), shift(b.hip[1], 0.2)];
  const ankle: [Vec, Vec] = [add(b.ankle[0], [p.feet[0][0], -p.feet[0][1]]), add(b.ankle[1], [p.feet[1][0], -p.feet[1][1]])];
  // para que lado dobram cotovelos e joelhos em cada vista
  const elbowBend = view === 'side' ? { main: 1, off: 1 } : view === 'down' ? { main: 1, off: -1 } : { main: -1, off: 1 };
  if (p.flipElbow) elbowBend.main = -elbowBend.main;
  const kneeBend = view === 'side' ? [-1, -1] : view === 'down' ? [1, -1] : [1, -1];
  return {
    view,
    pose: p,
    // a cabeça fica sempre num pixel inteiro: assim o rosto (outra camada) encaixa certinho
    head: [Math.round(b.head[0] + p.lean + p.head[0]), Math.round(b.head[1] + p.bob + p.head[1])],
    neck: shift(b.neck, 0.9),
    chest: shift(b.chest, 0.7),
    pelvis: shift(b.pelvis, 0.2),
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

/** Canto da caixa do rosto (16x14) neste quadro: 8 px à esquerda e 7 acima do centro da cabeça. */
export function faceOrigin(view: View, anim: AnimName, frame: number): Vec {
  const head = rigOf(view, POSES[view][anim][Math.min(frame, ANIMS[anim] - 1)]!).head;
  return [head[0] - 8, head[1] - 7];
}
