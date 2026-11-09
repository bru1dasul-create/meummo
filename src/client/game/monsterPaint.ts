// Monstros pintados com o mesmo pincel dos personagens (doll/raster.ts): volume, sombra, contorno colorido
// e o dobro de detalhe (aparecem na metade do tamanho, como os personagens). Olham para a direita (o jogo
// espelha para a esquerda). Cada um tem quadros de parado, andando, preparando o golpe e golpeando (e, se
// tiver, um golpe especial: o canto da Iara).
//
// COMO PINTAR UM MONSTRO NOVO
// Escreva a função que desenha o monstro numa pose (veja o jacaré e o boto) e acrescente em PAINTED, com a
// mesma chave do monstro em data/monsters.json. Monstro sem desenho aqui usa o desenho antigo, 16x16, de
// monsterArt.ts. Confira com `npm run render:characters` (os monstros ficam embaixo da prancha).

import { darken, material } from './doll/palette';
import { Canvas, joint, type Vec } from './doll/raster';
import { Sheet } from './doll/sheet';

/** `special`: o golpe especial (o canto da Iara); quem não tem usa o quadro de preparar. */
export type MonsterAnim = 'idle' | 'walk' | 'windup' | 'attack' | 'special';
export const MONSTER_ANIMS: readonly MonsterAnim[] = ['idle', 'walk', 'windup', 'attack', 'special'];

export interface PaintedMonster {
  /** Tamanho de cada quadro (pixels da textura: o dobro dos do mapa). */
  width: number;
  height: number;
  /** Linha logo abaixo dos pés (pixel da textura). */
  feet: number;
  /** Altura do nome acima dos pés (pixels do mapa). */
  top: number;
  /** Largura da sombra no chão (pixels do mapa). */
  shadow: number;
  /** Quantos quadros cada animação tem (o especial pode ter 0). */
  frames: Record<MonsterAnim, number>;
  /** Tempo de cada quadro parado e andando (ms). */
  idleMs: number;
  walkMs: number;
  draw(cv: Canvas, anim: MonsterAnim, frame: number): void;
}

/** Gira o ponto `p` em volta de `c` (graus; positivo = sentido horário na tela). */
function rot(p: Vec, c: Vec, degrees: number): Vec {
  const a = (degrees * Math.PI) / 180;
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
}

const move = (points: readonly Vec[], dx: number, dy = 0): Vec[] => points.map(([x, y]) => [x + dx, y + dy]);

// ======================= Jacaré Mutante =======================
// Jacaré-de-papo-amarelo da Billings: verde-oliva, papo amarelo, placas nas costas e cristas de osso
// (a parte "mutante"), olho aceso de verde-limão. Baixo e comprido: anda devagar e dá o bote de boca aberta.

const CROC = material('#5f6a3c', 'leather');
const CROC_DARK = material('#434b2b', 'leather');
const CROC_BELLY = material('#e0c25e', 'leather');
const CROC_BONE = material('#d9cfa8', 'wood');
const CROC_MOUTH = material('#b24a52', 'skin');
const TOOTH = '#f6f0dc';
const GLOW = '#f2ff7a';
const GLOW_RING = '#9bd12c';
const PUPIL = '#1d2410';

interface CrocPose {
  /** Corpo para a frente (bote) ou para trás (armando). */
  bx: number;
  /** Respiração (0 a 1). */
  breathe: number;
  /** Fase e força do balanço do rabo. */
  tail: number;
  sway: number;
  /** Passo de cada par de patas (traseira perto + dianteira longe, e o outro par) e quanto levantam. */
  step: [number, number];
  lift: [number, number];
  /** Abertura da boca (graus). */
  jaw: number;
  /** Cabeça erguida (graus; negativo = para cima). */
  head: number;
}

function crocPose(anim: MonsterAnim, f: number): CrocPose {
  const base: CrocPose = { bx: 0, breathe: 0, tail: 0, sway: 0.8, step: [0, 0], lift: [0, 0], jaw: 0, head: 0 };
  if (anim === 'idle') return { ...base, breathe: [0, 0.5, 1, 0.5][f]!, tail: (f * Math.PI) / 2 };
  if (anim === 'walk') {
    return {
      ...base,
      tail: (f * Math.PI) / 2,
      sway: 1.6,
      step: [[2, 0, -2, 0][f]!, [-2, 0, 2, 0][f]!],
      lift: [[0, 0, 0, 1.2][f]!, [0, 1.2, 0, 0][f]!],
      breathe: [0, 0.4, 0, 0.4][f]!,
    };
  }
  if (anim === 'windup') return { ...base, bx: -2, jaw: 34, head: -8, tail: Math.PI / 2, sway: 2, breathe: 1 };
  return { ...base, bx: 3, jaw: 7, head: 2, tail: Math.PI, sway: 1.4, step: [1.5, 1.5] };
}

function drawCrocLeg(cv: Canvas, hip: Vec, foot: Vec, r0: number, r1: number, toe: number, far: boolean): void {
  const o = { bias: far ? -0.38 : 0 };
  cv.part(far ? 'farleg' : 'leg');
  cv.capsule(hip, [foot[0] - toe * 0.3, foot[1] - 1.4], r0, r1, CROC, o);
  cv.ellipse([foot[0], foot[1]], toe, 1.35, CROC, { bias: (o.bias ?? 0) - 0.05 });
  // unhas claras na frente da pata
  if (!far) {
    cv.detail('claws');
    for (let i = 0; i < 3; i++) cv.dot(foot[0] + toe - 0.6 - i * 1.3, foot[1] + 0.6, TOOTH);
  }
}

function drawJacare(cv: Canvas, anim: MonsterAnim, frame: number): void {
  const p = crocPose(anim, frame);
  // tudo um pouco para a direita: sobra lugar para a ponta do rabo e para o bote
  const shift = 3;
  const bx = p.bx + shift;
  const cy = 26 - p.breathe * 0.5;
  const ground = 34.3;

  // patas do outro lado (atrás do corpo, mais escuras)
  drawCrocLeg(cv, [29 + bx, 28.5], [27.5 + bx + p.step[1], ground - p.lift[1]], 3, 2.2, 3, true);
  drawCrocLeg(cv, [45 + bx, 28.5], [46.5 + bx + p.step[0], ground - p.lift[0]], 2.6, 2, 2.6, true);

  // rabo: de grosso a fino, balançando, com faixas escuras e a crista dupla que vira uma só na ponta
  cv.part('tail');
  const tail: Vec[] = [];
  const radius: number[] = [];
  const N = 9;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    tail.push([28 + shift + p.bx * 0.6 - t * 26, cy + 1 - t * 2.5 + Math.sin(t * Math.PI * 1.4 + p.tail) * p.sway * t * 1.6]);
    radius.push(6.3 * (1 - t) + 1.1 * t);
  }
  const bands = (x: number, _y: number, tone: number) => (Math.floor((x - tail[N]![0]) / 4.2) % 2 === 1 && x < 22 + bx ? tone - 1 : tone);
  for (let i = 0; i < N; i++) cv.capsule(tail[i]!, tail[i + 1]!, radius[i]!, radius[i + 1]!, CROC, { pattern: bands });

  // corpo: baixo e comprido, visto um pouco de cima. Nas costas, placas (sulcos mais escuros entre elas)
  cv.part('body');
  const plates = (x: number, y: number, tone: number) => {
    if (y > cy - 0.8) return tone;
    const groove = (((x - bx - 27.5) % 3.6) + 3.6) % 3.6 < 0.9 || Math.abs(y - (cy - 3.6)) < 0.5;
    return groove ? tone - 1 : tone;
  };
  cv.capsule([28 + bx, cy + 0.5], [50 + bx, cy - 0.3], 6.9 + p.breathe * 0.3, 6.3, CROC, { pattern: plates });
  // a barriga amarela só aparece na beirada de baixo
  cv.polygon(
    [
      [33 + bx, cy + 5.6],
      [50 + bx, cy + 4.6],
      [50 + bx, cy + 6.8],
      [33 + bx, cy + 7.6],
    ],
    CROC_BELLY,
    { clip: (x, y) => cv.ownedBy(Math.floor(x), Math.floor(y), 'body'), bias: -0.25 },
  );

  // cristas de osso nas costas (a parte "mutante") e a crista do rabo
  cv.part('spikes');
  for (let i = 0; i < 5; i++) {
    const x = 31 + i * 4 + bx;
    const top = cy - 6.4 + (i === 4 ? 0.4 : 0);
    const h = i === 1 || i === 2 ? 3.6 : 2.6;
    cv.polygon(
      [
        [x - 1.5, top + 1.6],
        [x + 0.4, top - h],
        [x + 1.6, top + 1.6],
      ],
      CROC_BONE,
    );
  }
  for (let i = 1; i < N - 1; i++) {
    const [x, y] = tail[i]!;
    const h = 2 * (1 - i / N) + 0.7;
    cv.polygon(
      [
        [x - 1, y - radius[i]! + 1.2],
        [x - 0.2, y - radius[i]! - h],
        [x + 0.9, y - radius[i]! + 1.2],
      ],
      i < 3 ? CROC_BONE : CROC_DARK,
    );
  }

  // patas deste lado
  drawCrocLeg(cv, [32 + bx, 29.5], [33.5 + bx + p.step[0], ground - p.lift[0]], 3.4, 2.5, 3.5, false);
  drawCrocLeg(cv, [47.5 + bx, 29.5], [49.5 + bx + p.step[1], ground - p.lift[1]], 2.9, 2.1, 3, false);

  // cabeça: crânio, focinho largo (papo-amarelo), mandíbula que abre no bote
  const hinge: Vec = [52 + bx + (anim === 'attack' ? 1.5 : 0), cy + 0.2];
  const turn = (pts: readonly Vec[], deg: number) => pts.map((q) => rot(q, hinge, deg));
  const head = p.head;
  const dx = hinge[0] - 52;
  const dy = hinge[1] - 26.2;
  const upperEdge: Vec[] = move(
    [
      [57, 26.4],
      [62, 26.3],
      [67, 26.1],
      [71.2, 25.9],
    ],
    dx,
    dy,
  );
  const upper = turn(
    move(
      [
        [49.5, 20.6],
        [58, 21.3],
        [66, 22.3],
        [70.5, 23.2],
        [72.3, 24.6],
        [71.2, 26.1],
        [67, 26.2],
        [62, 26.4],
        [57, 26.5],
        [49.5, 26.8],
      ],
      dx,
      dy,
    ),
    head - p.jaw,
  );
  const lowerEdge: Vec[] = move(
    [
      [57, 26.6],
      [62, 26.6],
      [67, 26.4],
      [70.4, 26.3],
    ],
    dx,
    dy,
  );
  const lower = turn(
    move(
      [
        [49.5, 26.8],
        [57, 26.6],
        [62, 26.6],
        [67, 26.4],
        [70.4, 26.3],
        [70.8, 27.4],
        [66, 28.5],
        [58, 29.5],
        [49.5, 30],
      ],
      dx,
      dy,
    ),
    head + p.jaw * 0.35,
  );
  if (p.jaw > 4) {
    // céu da boca e língua (atrás dos dentes)
    cv.part('mouth');
    const roof = turn(upperEdge, head - p.jaw);
    const floor = turn(lowerEdge, head + p.jaw * 0.35);
    cv.polygon([...roof, ...floor.slice().reverse(), rot(hinge, hinge, 0)], CROC_MOUTH, { bias: -0.25 });
  }
  // papo amarelo embaixo da mandíbula (desenhado antes: só a beirada aparece)
  cv.part('jaw');
  cv.ellipse(rot([hinge[0] + 1.5, hinge[1] + 3], hinge, head + p.jaw * 0.35), 5, 2.2, CROC_BELLY, { bias: -0.05 });
  cv.polygon(lower, CROC, { bias: -0.1 });
  cv.part('head');
  cv.ellipse([hinge[0] + 1.5, hinge[1] - 2.6], 5.9, 4.9, CROC);
  cv.polygon(upper, CROC);
  // narinas na ponta do focinho
  const nose = rot([hinge[0] + 18, hinge[1] - 3.6], hinge, head - p.jaw);
  cv.ellipse(nose, 1.7, 1.1, CROC);
  cv.dot(nose[0] + 0.4, nose[1] - 0.3, darken(CROC.ramp[0], 0.7));

  // dentes: em cima apontando para baixo, embaixo apontando para cima (aparecem até de boca fechada)
  cv.detail('teeth');
  for (let i = 0; i < 5; i++) {
    const x = hinge[0] + 6 + i * 3;
    const up = rot([x, hinge[1] + 0.2], hinge, head - p.jaw);
    const down = rot([x + 1.5, hinge[1] + 0.4], hinge, head + p.jaw * 0.35);
    cv.dot(up[0], up[1] + (p.jaw > 4 ? 0.6 : 0.2), TOOTH);
    if (p.jaw > 4) cv.dot(up[0], up[1] + 1.4, TOOTH);
    cv.dot(down[0], down[1] - (p.jaw > 4 ? 0.8 : 0.3), TOOTH);
  }

  // olho aceso em cima da cabeça, com a pálpebra saltada
  cv.part('brow');
  const brow = rot([hinge[0] + 2.6, hinge[1] - 5.8], hinge, head - p.jaw * 0.15);
  cv.ellipse(brow, 2.7, 2.1, CROC);
  cv.detail('eye');
  const ex = Math.round(brow[0]);
  const ey = Math.round(brow[1]);
  cv.dot(ex - 1, ey, GLOW_RING);
  cv.dot(ex, ey, GLOW);
  cv.dot(ex + 1, ey, GLOW);
  cv.dot(ex - 1, ey + 1, GLOW_RING);
  cv.dot(ex, ey + 1, PUPIL);
  cv.dot(ex + 1, ey + 1, GLOW_RING);
}

const JACARE: PaintedMonster = {
  width: 82,
  height: 38,
  feet: 36,
  top: 15,
  shadow: 30,
  frames: { idle: 4, walk: 4, windup: 1, attack: 1, special: 0 },
  idleMs: 420,
  walkMs: 140,
  draw: drawJacare,
};

// ======================= Boto Encantado =======================
// Boto-cor-de-rosa da lenda: de pé na cauda, testa redonda, bico comprido de "sorriso" e o chapéu branco
// que ele nunca tira (esconde o furo de respirar). Pula na cauda para andar e cospe jato d'água.

const PINK = material('#e3929e', 'skin');
const PINK_BELLY = material('#f6c6cc', 'skin');
const HAT = material('#f1ece0', 'cloth');
const HAT_BAND = '#2e2a33';
const FLOWER = '#d8384a';
const FLOWER_MID = '#f2c94c';
const WATER = material('#7cc8f0', 'metal');

interface BotoPose {
  /** Altura do pulo e quanto o corpo encolhe para pegar impulso. */
  lift: number;
  squash: number;
  /** O alto do corpo vai para trás (−) ou para a frente (+). */
  lean: number;
  /** Respiração do alto do corpo. */
  bob: number;
  /** Bico para cima (−) ou para baixo (+), em graus. */
  tilt: number;
  /** Ângulo das nadadeiras. */
  flap: number;
  /** Bochecha cheia d'água. */
  puff: number;
  /** Boca aberta, cuspindo. */
  spit: boolean;
}

function botoPose(anim: MonsterAnim, f: number): BotoPose {
  const base: BotoPose = { lift: 0, squash: 0, lean: 0, bob: 0, tilt: 0, flap: 0, puff: 0, spit: false };
  if (anim === 'idle') return { ...base, bob: [0, 0.5, 1, 0.5][f]!, flap: [0, 7, 12, 7][f]!, tilt: [0, -1, -2, -1][f]! };
  if (anim === 'walk') return { ...base, lift: [0, 2.5, 4, 1.5][f]!, squash: [1, 0, 0, 0.4][f]!, flap: [-8, 16, 24, 6][f]!, lean: [0, 1, 1.5, 0.5][f]! };
  if (anim === 'windup') return { ...base, lean: -3, tilt: -16, flap: 22, puff: 1, squash: 0.5 };
  return { ...base, lean: 3, tilt: 6, flap: -10, spit: true };
}

/** Curva suave passando pelos pontos (Catmull-Rom), com o raio indo de um ponto ao outro. */
function smoothSpine(points: readonly Vec[], radii: readonly number[], per: number): { at: Vec[]; r: number[] } {
  const at: Vec[] = [];
  const r: number[] = [];
  const last = points.length - 1;
  for (let i = 0; i < last; i++) {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const d = points[Math.min(last, i + 2)]!;
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const f = (p0: number, p1: number, p2: number, p3: number) =>
        0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
      at.push([f(a[0], b[0], c[0], d[0]), f(a[1], b[1], c[1], d[1])]);
      r.push(radii[i]! + (radii[i + 1]! - radii[i]!) * t * t * (3 - 2 * t));
    }
  }
  at.push(points[last]!);
  r.push(radii[last]!);
  return { at, r };
}

function drawBoto(cv: Canvas, anim: MonsterAnim, frame: number): void {
  const p = botoPose(anim, frame);
  const ground = 60;
  // coluna em "S": a cauda enrolada para a frente no chão, as costas para trás, o peito e a cabeça para a frente
  const spine: Vec[] = [
    [43, 56.8],
    [36, 56.4],
    [29.5, 52],
    [26.5, 44],
    [27.5, 36],
    [30.5, 29.5],
    [32.5, 25.5],
  ];
  const radii = [1.6, 3.2, 5.6, 7.6, 8.2, 7.4, 6.4];
  const pts: Vec[] = spine.map(([x, y], i) => {
    const k = Math.max(0, (i - 1) / (spine.length - 2));
    const squashed = ground - (ground - y) * (1 - p.squash * 0.08);
    return [x + p.lean * k, squashed - p.lift * (i === 0 ? 0.5 : 1) - p.bob * k];
  });
  const body = smoothSpine(
    pts,
    radii.map((r) => r * (1 + p.squash * 0.07)),
    4,
  );
  const neck = pts[6]!;
  const head: Vec = [neck[0] + 1.6, neck[1] - 6.2];
  const chest = pts[4]!;

  // nadadeira do outro lado (atrás do corpo)
  cv.part('farfin');
  const farRoot: Vec = [chest[0] - 4, chest[1] + 1];
  const paddle = (root: Vec, side: number, angle: number): Vec[] =>
    [
      [0, 0],
      [3 * side, 1.5],
      [8 * side, 6.5],
      [7.5 * side, 9],
      [4.5 * side, 8.5],
      [0.5 * side, 4.5],
    ].map(([x, y]) => rot([root[0] + x!, root[1] + y!], root, angle * side));
  cv.polygon(paddle(farRoot, -1, p.flap), PINK, { bias: -0.45 });

  // corpo liso; a barriga clara é o mesmo corpo, recortado do lado de cá
  cv.part('body');
  for (let i = 0; i < body.at.length - 1; i++) cv.capsule(body.at[i]!, body.at[i + 1]!, body.r[i]!, body.r[i + 1]!, PINK);
  const front = (y: number): number => {
    let best = Infinity;
    let x = Infinity;
    for (let i = 4; i < body.at.length; i++) {
      const d = Math.abs(body.at[i]![1] - y);
      if (d < best) {
        best = d;
        x = body.at[i]![0] + body.r[i]! * 0.15;
      }
    }
    return y > pts[1]![1] - 2 ? Infinity : x;
  };
  for (let i = 4; i < body.at.length - 6; i++) {
    cv.capsule(body.at[i]!, body.at[i + 1]!, body.r[i]!, body.r[i + 1]!, PINK_BELLY, { clip: (x, y) => x > front(y), bias: 0.05 });
  }
  // testa redonda (o "melão" do boto)
  cv.ellipse(head, 8.4, 7.8, PINK);

  // bico comprido e fino, com a linha do "sorriso"
  cv.part('beak');
  const beakA = rot([head[0] + 5.6, head[1] + 3.2], head, p.tilt);
  const beakB = rot([head[0] + 12.5, head[1] + 5.2], head, p.tilt + (p.spit ? 3 : 0));
  const beakC = rot([head[0] + 19.5, head[1] + 6.3], head, p.tilt + (p.spit ? 5 : 0));
  cv.capsule(beakA, beakB, 3, 2.1, PINK);
  cv.capsule(beakB, beakC, 2.1, 1.5, PINK);
  // bochecha mais clara
  cv.ellipse(rot([head[0] + 5, head[1] + 4.6], head, p.tilt), 2.6, 1.8, PINK_BELLY, { bias: 0.1 });
  const smile = darken(PINK.ramp[0], 0.62);
  if (p.spit) {
    // boca aberta: o queixo desce
    cv.part('jaw');
    cv.capsule(rot([head[0] + 6, head[1] + 5.6], head, p.tilt), rot([head[0] + 16.5, head[1] + 9.2], head, p.tilt + 8), 1.8, 1.2, PINK_BELLY, { bias: -0.1 });
  } else {
    cv.detail('smile');
    cv.line(rot([head[0] + 7, head[1] + 5], head, p.tilt), rot([head[0] + 18.6, head[1] + 7], head, p.tilt), smile);
    const corner = rot([head[0] + 6.2, head[1] + 4.2], head, p.tilt);
    cv.dot(corner[0], corner[1], smile);
  }
  // bochecha cheia d'água (preparando o jato)
  if (p.puff > 0) {
    cv.part('puff');
    cv.ellipse(rot([head[0] + 5.5, head[1] + 6], head, p.tilt), 3.8 * p.puff, 3.1 * p.puff, PINK_BELLY);
  }

  // olho pequeno e simpático (com brilho)
  cv.detail('eye');
  const eye = rot([head[0] + 3.2, head[1] + 0.4], head, p.tilt * 0.5);
  const ex = Math.round(eye[0]);
  const ey = Math.round(eye[1]);
  cv.dot(ex, ey, '#ffffff');
  cv.dot(ex + 1, ey, '#2a1a22');
  cv.dot(ex, ey + 1, '#2a1a22');
  cv.dot(ex + 1, ey + 1, '#3d2430');

  // nadadeira deste lado (um remo largo)
  cv.part('fin');
  cv.polygon(paddle([chest[0] + 3, chest[1] + 1.5], 1, p.flap), PINK);

  // cauda deitada no chão, na ponta da curva: duas pontas com o recorte no meio
  cv.part('fluke');
  const tail = pts[0]!;
  cv.ellipse([tail[0] - 1.5, tail[1] + 1.4], 4.4, 1.7, PINK, { bias: -0.1 });
  cv.ellipse([tail[0] + 5, tail[1] + 1], 4.4, 1.7, PINK, { bias: -0.05 });
  cv.detail('notch');
  cv.dot(tail[0] + 1.6, tail[1] + 1.2, darken(PINK.ramp[0], 0.6));

  // o chapéu branco da lenda, meio de lado, com fita escura e uma flor vermelha
  cv.part('hat');
  const tip = p.tilt * 0.35;
  const hc: Vec = [head[0] - 0.5, head[1] - 6];
  const hat = (q: Vec): Vec => rot(q, hc, tip);
  const crown: Vec[] = (
    [
      [hc[0] - 6.2, hc[1] - 0.2],
      [hc[0] - 5.6, hc[1] - 6.2],
      [hc[0] - 2.2, hc[1] - 7.4],
      [hc[0] + 0.3, hc[1] - 6.5],
      [hc[0] + 3, hc[1] - 7.4],
      [hc[0] + 5.8, hc[1] - 6.2],
      [hc[0] + 6.4, hc[1] - 0.2],
    ] as Vec[]
  ).map(hat);
  cv.polygon(crown, HAT);
  // sombra da aba na testa
  cv.shadow(head[0] - 9, hc[1] + 1, head[0] + 9, hc[1] + 3.2, (x, y) => cv.ownedBy(Math.floor(x), Math.floor(y), 'body'), 0.78);
  cv.ellipse(hat([hc[0], hc[1] + 0.4]), 10.6, 2.6, HAT);
  // fita e flor
  cv.detail('band');
  for (let x = Math.floor(hc[0] - 6); x <= Math.ceil(hc[0] + 6); x++) {
    for (const yy of [hc[1] - 2.4, hc[1] - 1.4]) {
      const [qx, qy] = hat([x + 0.5, yy]);
      if (cv.ownedBy(Math.floor(qx), Math.floor(qy), 'hat')) cv.dot(qx, qy, HAT_BAND);
    }
  }
  const fl = hat([hc[0] + 4.2, hc[1] - 2]);
  cv.dot(fl[0], fl[1] - 1, FLOWER);
  cv.dot(fl[0] - 1, fl[1], FLOWER);
  cv.dot(fl[0] + 1, fl[1], FLOWER);
  cv.dot(fl[0], fl[1] + 1, FLOWER);
  cv.dot(fl[0], fl[1], FLOWER_MID);

  // jato saindo do bico
  if (p.spit) {
    cv.part('water');
    const mouth = rot([head[0] + 20, head[1] + 7.6], head, p.tilt + 4);
    cv.ellipse([mouth[0] + 1.5, mouth[1]], 2, 1.6, WATER);
    cv.ellipse([mouth[0] + 4.5, mouth[1] - 1], 1.4, 1.2, WATER);
    cv.ellipse([mouth[0] + 3.5, mouth[1] + 2], 1, 1, WATER);
  }
}

const BOTO: PaintedMonster = {
  width: 64,
  height: 64,
  feet: 61,
  top: 29,
  shadow: 14,
  frames: { idle: 4, walk: 4, windup: 1, attack: 1, special: 0 },
  idleMs: 300,
  walkMs: 90,
  draw: drawBoto,
};


// ======================= Iara =======================
// A mãe-d'água, chefe da Billings: moça de cabelo preto comprido (com brilho verde de água), vitória-régia no
// cabelo, conchas no peito e cauda de peixe verde-água com escamas. Maior que um jogador. Prepara uma bola
// d'água na mão e atira; no canto, junta as mãos no peito, levanta o rosto e abre a boca (as notas são efeito).

const IARA_SKIN = material('#b07850', 'skin');
const IARA_HAIR = material('#22332e', 'hair');
const IARA_TAIL = material('#3a9a8a', 'leaf');
const IARA_FIN = material('#86d8c8', 'cloth');
const IARA_SHELL = material('#f6ead8', 'cloth');
const IARA_WEED = material('#4e8a3a', 'leaf');
const IARA_LILY = '#f7c9da';
const IARA_LILY_DARK = '#d98aa8';
const IARA_LILY_MID = '#f2c94c';
const IARA_EYE = '#1d1418';
const IARA_LIP = '#c0505a';

interface IaraPose {
  /** Pulo na cauda (andando) e quanto encolhe para pegar impulso. */
  lift: number;
  squash: number;
  /** O tronco vai para trás (−) ou para a frente (+). */
  lean: number;
  /** Respiração do tronco. */
  bob: number;
  /** Fase e força do balanço do cabelo e da cauda. */
  sway: number;
  swing: number;
  /** Rosto para cima (−), em graus. */
  tilt: number;
  /** Mão de cá e mão de lá, em relação ao ombro. */
  near: Vec;
  far: Vec;
  /** Bola d'água na mão (raio) e boca aberta (cantando). */
  orb: number;
  sing: boolean;
  /** Cabelo flutuando (cantando). */
  float: number;
}

function iaraPose(anim: MonsterAnim, f: number): IaraPose {
  const base: IaraPose = { lift: 0, squash: 0, lean: 0, bob: 0, sway: 0, swing: 1, tilt: 0, near: [2.5, 13.5], far: [-3, 13.5], orb: 0, sing: false, float: 0 };
  if (anim === 'idle') return { ...base, bob: [0, 0.5, 1, 0.5][f]!, sway: (f * Math.PI) / 2 };
  if (anim === 'walk') {
    return {
      ...base,
      lift: [0, 2, 3, 1][f]!,
      squash: [1, 0, 0, 0.4][f]!,
      lean: [0, 1, 1.5, 0.5][f]!,
      sway: (f * Math.PI) / 2,
      swing: 1.8,
      near: ([[1, 13.5], [-1, 13], [-2, 12.5], [0, 13.5]] as Vec[])[f]!,
      far: ([[-1, 13.5], [1, 13], [2, 12.5], [0, 13.5]] as Vec[])[f]!,
    };
  }
  if (anim === 'windup') return { ...base, lean: -1.5, near: [9, 4.5], far: [-6, 10], orb: 3.2, sway: Math.PI / 2 };
  if (anim === 'attack') return { ...base, lean: 2, near: [13.5, 1.5], far: [-7, 9], orb: 0, sway: Math.PI };
  // cantando: mão de cá no peito, a de lá aberta para trás, rosto para cima e o cabelo flutuando
  return { ...base, tilt: -11, near: [-1.5, 5.5], far: [-11, 2 - f], sing: true, float: 1 + f * 0.6, sway: f * Math.PI, swing: 1.4 };
}

/** Escamas: a borda de baixo de cada uma, mais escura (só onde bate luz), fileiras desencontradas. */
function scales(x: number, y: number, tone: number): number {
  const w = 4.6;
  const h = 3.4;
  const row = Math.floor(y / h);
  const lx = ((((x + (row % 2) * (w / 2)) % w) + w) % w) - w / 2;
  const ly = y - row * h;
  const d = Math.hypot(lx, (ly + 0.6) * 1.1);
  return tone >= 2 && d > w / 2 - 0.2 && d < w / 2 + 0.7 && ly > h * 0.35 ? tone - 1 : tone;
}

function drawIara(cv: Canvas, anim: MonsterAnim, frame: number): void {
  const p = iaraPose(anim, frame);
  // tudo 3 pixels acima do pé da moldura (a cauda deitada fica na linha do chão)
  const Y = -3;
  const ground = 92 + Y;
  // cauda em "J": a ponta (com a barbatana) deitada no chão para trás, subindo até o quadril
  const spine: Vec[] = [
    [19, 86.5],
    [28, 89.2],
    [39, 89.6],
    [48.5, 86],
    [53.5, 78],
    [52.5, 69.5],
    [49.5, 62],
  ];
  const radii = [2.2, 3.6, 5.2, 6.6, 7.6, 8.1, 8.3];
  const pts: Vec[] = spine.map(([x, y], i) => {
    const k = Math.max(0, (i - 2) / (spine.length - 3));
    const squashed = ground - (ground - y) * (1 - p.squash * 0.06);
    const wave = i < 3 ? Math.sin(p.sway + i) * 0.6 * p.swing * (1 - i / 3) : 0;
    // no pulo, a curva de baixo da cauda quase não sai do chão; o resto do corpo sobe
    return [x + p.lean * k * 0.6, squashed + Y + wave - p.lift * (i < 2 ? 0.4 : i < 4 ? 0.6 : 1) - p.bob * k];
  });
  const tail = smoothSpine(pts, radii.map((r) => r * (1 + p.squash * 0.05)), 4);
  const hip = pts[6]!;
  // tronco: inclina e respira em cima do quadril
  const up = (v: Vec, k = 1): Vec => [v[0] + p.lean * k, v[1] + Y - p.lift - p.bob];
  const shoulderNear = up([52.5, 43]);
  const shoulderFar = up([43.5, 43]);
  const neck = up([48, 39]);
  const head: Vec = up([48.5, 31.5]);

  // ---- cabelo de trás (atrás de tudo): mechas compridas descendo pelas costas ----
  const hairFlow = (k: number, t: number): Vec => {
    const wave = Math.sin(p.sway + t * 3 + k) * (1 + t * 1.6) * p.swing * 0.8;
    const lift = p.float * t * 4;
    return [head[0] - 5 - t * 9 + wave - k * 2.2, head[1] + t * 34 - lift + k * 1.5];
  };
  for (let k = 0; k < 3; k++) {
    cv.part(`hairback${k}`);
    const lock: Vec[] = [0, 0.25, 0.5, 0.75, 1].map((t) => hairFlow(k, t));
    const r = [4.6 - k * 0.6, 4 - k * 0.5, 3.4 - k * 0.4, 2.6 - k * 0.3, 1.4];
    for (let i = 0; i < lock.length - 1; i++) cv.capsule(lock[i]!, lock[i + 1]!, r[i]!, r[i + 1]!, IARA_HAIR, { bias: -0.15 - k * 0.1 });
    // um fio de brilho verde-água descendo pela mecha
    const group = `hairback${k}`;
    for (let i = 0; i < 18; i++) {
      const t = 0.08 + (i / 18) * 0.7;
      const [x, y] = hairFlow(k, t);
      if (cv.ownedBy(Math.floor(x - 1), Math.floor(y), group)) cv.dot(x - 1, y, k === 0 ? '#4f8a76' : '#3f6f60');
    }
  }

  // ---- braço de lá (atrás do corpo) ----
  const arm = (shoulder: Vec, hand: Vec, far: boolean) => {
    const target: Vec = [shoulder[0] + hand[0], shoulder[1] + hand[1]];
    const elbow = joint(shoulder, target, 7.6, 7.2, far ? -1 : 1);
    const o = { bias: far ? -0.4 : 0 };
    cv.part(far ? 'farArm' : 'arm');
    cv.capsule(shoulder, elbow, 2.1, 1.8, IARA_SKIN, o);
    cv.capsule(elbow, target, 1.8, 1.5, IARA_SKIN, o);
    cv.ellipse(target, 1.8, 1.7, IARA_SKIN, o);
    return target;
  };
  arm(shoulderFar, p.far, true);

  // ---- barbatana na ponta da cauda (um leque) ----
  cv.part('fin');
  const tip = pts[0]!;
  const fin: Vec[] = [
    [tip[0] + 1.5, tip[1] - 1.8],
    [tip[0] - 7, tip[1] - 9 + Math.sin(p.sway) * p.swing],
    [tip[0] - 9.5, tip[1] - 5],
    [tip[0] - 6, tip[1] - 0.5],
    [tip[0] - 10, tip[1] + 3.5],
    [tip[0] - 6.5, tip[1] + 6.5 - Math.sin(p.sway) * p.swing * 0.6],
    [tip[0] + 1.5, tip[1] + 1.8],
  ];
  cv.polygon(fin, IARA_FIN, { pattern: (x, y, t) => (Math.abs(((Math.atan2(y - tip[1], x - tip[0]) * 180) / Math.PI) % 18) < 3 ? t - 1 : t) });

  // ---- cauda com escamas (barriga mais clara do lado de cá) ----
  cv.part('tail');
  for (let i = 0; i < tail.at.length - 1; i++) cv.capsule(tail.at[i]!, tail.at[i + 1]!, tail.r[i]!, tail.r[i + 1]!, IARA_TAIL, { pattern: scales });

  // ---- tronco, pescoço, cinto de folhas e conchas ----
  cv.part('body');
  const torso: Vec[] = [
    up([43.6, 62], 0.3),
    up([44, 54], 0.7),
    up([42.8, 47.5]),
    up([42.6, 43]),
    up([53.4, 43]),
    up([54, 47.5]),
    up([52.8, 54], 0.7),
    up([55, 62], 0.3),
  ];
  cv.polygon(torso, IARA_SKIN);
  cv.capsule(neck, up([48.2, 42]), 2.3, 2.6, IARA_SKIN);
  // cintura: onde a pele vira cauda, um cinto de folhas de aguapé
  cv.part('weed');
  for (let i = 0; i < 6; i++) cv.ellipse([hip[0] - 5.5 + i * 2.2, hip[1] + (i % 2) * 0.8], 1.8, 1.4, IARA_WEED, { bias: i % 2 ? -0.1 : 0.05 });
  // top de conchas: uma faixa clara no peito, com as conchinhas em leque (ranhuras)
  cv.part('shells');
  const top: Vec[] = [up([42.6, 43.8]), up([47.5, 43.2]), up([54, 44]), up([54.2, 49]), up([48, 49.6]), up([42.8, 49])];
  cv.polygon(top, IARA_SHELL, { pattern: (x, y, t) => ((((x - y * 0.25) % 2.2) + 2.2) % 2.2 < 0.55 ? t - 1 : t) });
  cv.detail('pearl');
  const pearl = up([48.4, 46.4]);
  cv.dot(pearl[0], pearl[1], '#ffffff');
  cv.dot(pearl[0] + 1, pearl[1], '#e8dff0');

  // ---- cabeça e rosto (de três quartos, olhando para a direita) ----
  cv.part('body');
  cv.ellipse(head, 6.2, 6.6, IARA_SKIN);
  const face = (v: Vec): Vec => rot(v, head, p.tilt);
  cv.detail('face');
  const eye = face([head[0] + 3.2, head[1] - 0.4]);
  const ex = Math.round(eye[0]);
  const ey = Math.round(eye[1]);
  cv.dot(ex - 1, ey - 1, IARA_EYE); // cílios
  cv.dot(ex, ey - 1, IARA_EYE);
  cv.dot(ex + 1, ey - 1, IARA_EYE);
  cv.dot(ex - 1, ey, IARA_EYE);
  cv.dot(ex, ey, '#3d8a6a'); // olho verde-água
  cv.dot(ex + 1, ey, '#ffffff');
  const cheek = face([head[0] + 3, head[1] + 2.6]);
  cv.dot(cheek[0], cheek[1], '#d98a7a');
  const mouth = face([head[0] + 3.6, head[1] + 4.2]);
  if (p.sing) {
    // boca aberta, cantando
    cv.dot(mouth[0], mouth[1], '#5a1e28');
    cv.dot(mouth[0] + 1, mouth[1], '#5a1e28');
    cv.dot(mouth[0], mouth[1] + 1, '#7a2a34');
    cv.dot(mouth[0] + 1, mouth[1] + 1, IARA_LIP);
  } else {
    cv.dot(mouth[0], mouth[1], IARA_LIP);
    cv.dot(mouth[0] + 1, mouth[1], IARA_LIP);
  }

  // ---- cabelo de cima: topo, franja e uma mecha caindo pelo ombro ----
  cv.part('hair');
  cv.ellipse(face([head[0] - 0.8, head[1] - 3.4]), 6.8, 4.6, IARA_HAIR);
  cv.ellipse(face([head[0] - 4.6, head[1] + 0.4]), 3.2, 5.2, IARA_HAIR, { bias: -0.1 });
  cv.ellipse(face([head[0] + 2.6, head[1] - 4.6]), 3.6, 2.1, IARA_HAIR);
  // sobrancelha
  const brow = face([head[0] + 2.6, head[1] - 2.6]);
  cv.detail('brow');
  cv.dot(brow[0], brow[1], IARA_HAIR.ramp[0]);
  cv.dot(brow[0] + 1, brow[1], IARA_HAIR.ramp[0]);
  cv.dot(brow[0] + 2, brow[1] + 0.6, IARA_HAIR.ramp[0]);
  // uma mecha caindo por trás do ombro (o peito fica livre para o top de conchas)
  cv.part('hairFront');
  const lockTop = face([head[0] - 3.4, head[1] + 3.5]);
  const lockEnd: Vec = [shoulderFar[0] - 0.5 + Math.sin(p.sway + 1) * 0.8, shoulderFar[1] + 7 - p.float * 2.5];
  cv.capsule(lockTop, lockEnd, 2.6, 1.2, IARA_HAIR, { bias: -0.05 });
  // brilho verde-água no cabelo (uma faixa de luz)
  cv.detail('sheen');
  for (let i = 0; i < 4; i++) {
    const q = face([head[0] - 3 + i * 1.6, head[1] - 6 + Math.abs(i - 1.5) * 0.5]);
    cv.dot(q[0], q[1], '#5f9a86');
  }

  // vitória-régia no cabelo
  cv.detail('lily');
  const lily = face([head[0] - 4.2, head[1] - 5.2]);
  const lx = Math.round(lily[0]);
  const ly = Math.round(lily[1]);
  for (const [dx, dy] of [[0, -2], [-2, -1], [2, -1], [-2, 1], [2, 1], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    cv.dot(lx + dx, ly + dy, Math.abs(dx) + Math.abs(dy) >= 2 ? IARA_LILY : IARA_LILY_DARK);
  }
  cv.dot(lx, ly, IARA_LILY_MID);

  // ---- braço de cá (na frente) e a bola d'água ----
  const hand = arm(shoulderNear, p.near, false);
  if (p.orb > 0) {
    cv.part('orb');
    cv.ellipse([hand[0] + 2.6, hand[1] - 1.4], p.orb, p.orb, WATER);
    cv.detail('orbShine');
    cv.dot(hand[0] + 1.6, hand[1] - 2.6, '#ffffff');
  }
  if (anim === 'attack') {
    cv.part('splash');
    cv.ellipse([hand[0] + 4.5, hand[1] - 0.5], 2, 1.6, WATER);
    cv.ellipse([hand[0] + 7.5, hand[1] - 2], 1.3, 1.1, WATER);
    cv.ellipse([hand[0] + 7, hand[1] + 1.8], 1, 1, WATER);
  }
}

const IARA: PaintedMonster = {
  width: 84,
  height: 96,
  feet: 93,
  top: 40,
  shadow: 22,
  frames: { idle: 4, walk: 4, windup: 1, attack: 1, special: 2 },
  idleMs: 340,
  walkMs: 110,
  draw: drawIara,
};

/** Monstros pintados, pela chave de data/monsters.json. */
export const PAINTED: Record<string, PaintedMonster> = {
  jacare: JACARE,
  boto: BOTO,
  iara: IARA,
};

/** Índice do quadro na folha: parado, andando, preparando, golpeando e o especial, um depois do outro. */
export function paintedFrame(art: PaintedMonster, anim: MonsterAnim, frame: number): number {
  if (art.frames[anim] === 0) return paintedFrame(art, anim === 'special' ? 'windup' : 'idle', frame);
  let index = 0;
  for (const a of MONSTER_ANIMS) {
    if (a === anim) return index + (frame % art.frames[a]);
    index += art.frames[a];
  }
  return 0;
}

export function paintedFrameCount(art: PaintedMonster): number {
  return MONSTER_ANIMS.reduce((sum, a) => sum + art.frames[a], 0);
}

/** Todos os quadros do monstro lado a lado numa folha (largura × número de quadros). */
export function paintMonster(art: PaintedMonster): Sheet {
  const sheet = new Sheet(art.width * paintedFrameCount(art), art.height);
  for (const anim of MONSTER_ANIMS) {
    for (let f = 0; f < art.frames[anim]; f++) {
      const cv = new Canvas(art.width, art.height);
      art.draw(cv, anim, f);
      cv.finish(sheet, paintedFrame(art, anim, f) * art.width, 0);
    }
  }
  return sheet;
}
