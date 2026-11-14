// Ícones pintados da interface do jogo 2.5D, no traço da HUD de referência do dono (13/11): o desenho em cor viva,
// com halo de luz e contorno escuro, e (nas habilidades) um fundo escuro com brilho colorido no meio, como os
// quadrados da barra de habilidades da imagem. Tudo desenhado por código num canvas de 128 px (a tela reduz).
//
// Habilidades: paintedActionIcon('shot' | 'skill0' | 'skill1' | 'dash' | 'guard').
// Itens: paintedItemIcon(icone de data/items.json) para os que já ganharam pintura (os outros continuam em pixel art).

export const PAINT_PX = 128;

interface Theme {
  /** Fundo: meio e borda. */
  bg0: string;
  bg1: string;
  /** Halo em volta do desenho. */
  glow: string;
  /** Degradê do desenho: claro, meio e escuro. */
  light: string;
  mid: string;
  dark: string;
  /** Contorno. */
  ink: string;
}

const THEMES = {
  verde: { bg0: '#2d5c18', bg1: '#050d06', glow: '#b8ff48', light: '#f7ffc8', mid: '#a6e83c', dark: '#3c8212', ink: '#0f2108' },
  fogo: { bg0: '#5e260a', bg1: '#110503', glow: '#ff9a2c', light: '#fff4c4', mid: '#ffb23e', dark: '#c64e0e', ink: '#2a0c03' },
  agua: { bg0: '#0f4652', bg1: '#030d0e', glow: '#72f3ff', light: '#ecffff', mid: '#6adcf2', dark: '#1b8bae', ink: '#05202a' },
  ceu: { bg0: '#163f70', bg1: '#030813', glow: '#64c6ff', light: '#f0f9ff', mid: '#78c4ff', dark: '#2a68c8', ink: '#061329' },
} satisfies Record<string, Theme>;

type Box = readonly [number, number, number, number];

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Sorteio repetível (o mesmo ícone sai igual toda vez). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function newCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = PAINT_PX;
  canvas.height = PAINT_PX;
  return [canvas, canvas.getContext('2d')!];
}

function gradient(ctx: CanvasRenderingContext2D, box: Box, t: Theme): CanvasGradient {
  const g = ctx.createLinearGradient(box[0], box[1], box[2], box[3]);
  g.addColorStop(0, t.light);
  g.addColorStop(0.45, t.mid);
  g.addColorStop(1, t.dark);
  return g;
}

/** Fundo do quadrado da habilidade: brilho redondo no meio, fumaça leve e cantos escuros. */
function slotBackground(ctx: CanvasRenderingContext2D, t: Theme, seed: number): void {
  const S = PAINT_PX;
  const g = ctx.createRadialGradient(S * 0.5, S * 0.45, S * 0.04, S * 0.5, S * 0.5, S * 0.74);
  g.addColorStop(0, t.bg0);
  g.addColorStop(1, t.bg1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const r = rng(seed);
  for (let i = 0; i < 10; i++) {
    const x = S * (0.12 + r() * 0.76);
    const y = S * (0.12 + r() * 0.76);
    const rad = S * (0.1 + r() * 0.2);
    const m = ctx.createRadialGradient(x, y, 0, x, y, rad);
    m.addColorStop(0, rgba(t.bg0, 0.32));
    m.addColorStop(1, rgba(t.bg0, 0));
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, S, S);
  }
  const v = ctx.createRadialGradient(S / 2, S / 2, S * 0.34, S / 2, S / 2, S * 0.76);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, S, S);
}

/** Forma cheia: halo, contorno escuro por fora, degradê e um brilho no alto. */
function glowFill(ctx: CanvasRenderingContext2D, path: Path2D, t: Theme, box: Box, blur = 18, ink = 2.4): void {
  ctx.save();
  ctx.shadowColor = t.glow;
  ctx.shadowBlur = blur;
  ctx.fillStyle = rgba(t.glow, 0.85);
  ctx.fill(path);
  ctx.fill(path);
  ctx.restore();
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = ink * 2;
  ctx.strokeStyle = rgba(t.ink, 0.9);
  ctx.stroke(path);
  ctx.fillStyle = gradient(ctx, box, t);
  ctx.fill(path);
  ctx.restore();
}

/** Traço: halo, contorno escuro, o traço com degradê e um fio claro por cima. */
function glowStroke(ctx: CanvasRenderingContext2D, path: Path2D, width: number, t: Theme, box: Box, blur = 16): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = t.glow;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = rgba(t.glow, 0.85);
  ctx.lineWidth = width + 2;
  ctx.stroke(path);
  ctx.stroke(path);
  ctx.restore();
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(t.ink, 0.92);
  ctx.lineWidth = width + 4;
  ctx.stroke(path);
  ctx.strokeStyle = gradient(ctx, box, t);
  ctx.lineWidth = width;
  ctx.stroke(path);
  if (width >= 6) {
    ctx.strokeStyle = rgba(t.light, 0.55);
    ctx.lineWidth = Math.max(1.2, width * 0.22);
    ctx.translate(-width * 0.18, -width * 0.18);
    ctx.stroke(path);
  }
  ctx.restore();
}

/** Brilho de quatro pontas (estrelinha). */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: Theme): void {
  const p = new Path2D();
  p.moveTo(x, y - r);
  p.quadraticCurveTo(x + r * 0.14, y - r * 0.14, x + r, y);
  p.quadraticCurveTo(x + r * 0.14, y + r * 0.14, x, y + r);
  p.quadraticCurveTo(x - r * 0.14, y + r * 0.14, x - r, y);
  p.quadraticCurveTo(x - r * 0.14, y - r * 0.14, x, y - r);
  ctx.save();
  ctx.shadowColor = t.glow;
  ctx.shadowBlur = 10;
  ctx.fillStyle = t.light;
  ctx.fill(p);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ habilidades

/** Estilingue: forquilha de madeira com o elástico puxado e a pedra carregada. */
function paintShot(ctx: CanvasRenderingContext2D): void {
  const t = THEMES.verde;
  slotBackground(ctx, t, 11);
  const handle = new Path2D();
  handle.moveTo(64, 117);
  handle.lineTo(64, 78);
  glowStroke(ctx, handle, 12, t, [56, 72, 74, 118]);
  const fork = new Path2D();
  fork.moveTo(64, 82);
  fork.bezierCurveTo(63, 62, 40, 60, 35, 30);
  fork.moveTo(64, 82);
  fork.bezierCurveTo(65, 62, 88, 60, 93, 30);
  glowStroke(ctx, fork, 10, t, [34, 26, 94, 84]);
  // pontas da forquilha
  const tips = new Path2D();
  tips.arc(35, 29, 6.5, 0, Math.PI * 2);
  tips.moveTo(99.5, 29);
  tips.arc(93, 29, 6.5, 0, Math.PI * 2);
  glowFill(ctx, tips, t, [28, 22, 100, 36], 10, 2);
  // elástico: das pontas até a pedra, puxado para trás
  const band = new Path2D();
  band.moveTo(36, 31);
  band.quadraticCurveTo(46, 54, 64, 59);
  band.quadraticCurveTo(82, 54, 92, 31);
  glowStroke(ctx, band, 3.4, THEMES.fogo, [36, 30, 92, 60], 10);
  // a pedra
  const stone = new Path2D();
  stone.arc(64, 58, 9.5, 0, Math.PI * 2);
  glowFill(ctx, stone, t, [56, 49, 72, 68], 22, 2.2);
  sparkle(ctx, 70, 52, 5, t);
}

/**
 * Atirar com o Arco de Bambu na mão (o botão do estilingue troca para este, ActionBar.setLook): o arco curvado com a
 * barriga para cima e para a direita, a corda puxada para trás e a flecha encaixada apontando para o alvo.
 */
function paintBow(ctx: CanvasRenderingContext2D): void {
  const t = THEMES.verde;
  slotBackground(ctx, t, 13);
  const T1 = [16, 52] as const;
  const T2 = [76, 112] as const;
  const C = [96, 32] as const;
  const N = [34, 94] as const;
  // a corda: das pontas até o entalhe da flecha, puxada para trás
  const string = new Path2D();
  string.moveTo(T1[0], T1[1]);
  string.lineTo(N[0], N[1]);
  string.lineTo(T2[0], T2[1]);
  glowStroke(ctx, string, 2.6, THEMES.fogo, [16, 52, 76, 112], 8);
  // o arco
  const bow = new Path2D();
  bow.moveTo(T1[0], T1[1]);
  bow.quadraticCurveTo(C[0], C[1], T2[0], T2[1]);
  glowStroke(ctx, bow, 9, t, [16, 32, 96, 112]);
  const tips = new Path2D();
  tips.arc(T1[0], T1[1], 5.5, 0, Math.PI * 2);
  tips.moveTo(T2[0] + 5.5, T2[1]);
  tips.arc(T2[0], T2[1], 5.5, 0, Math.PI * 2);
  glowFill(ctx, tips, t, [10, 46, 82, 118], 8, 2);
  // a flecha: a haste do entalhe até a ponta, as penas atrás e a ponta de pedra
  const ux = Math.SQRT1_2;
  const uy = -Math.SQRT1_2;
  const tip = [N[0] + ux * 82, N[1] + uy * 82] as const;
  const shaft = new Path2D();
  shaft.moveTo(N[0], N[1]);
  shaft.lineTo(tip[0] - ux * 10, tip[1] - uy * 10);
  glowStroke(ctx, shaft, 4.2, t, [N[0], tip[1], tip[0], N[1]], 10);
  const fl = new Path2D();
  for (const s of [-1, 1]) {
    const a0 = [N[0] + ux * 5, N[1] + uy * 5];
    const a1 = [N[0] + ux * 20, N[1] + uy * 20];
    fl.moveTo(a0[0]!, a0[1]!);
    fl.lineTo(a0[0]! - uy * s * 8, a0[1]! + ux * s * 8);
    fl.lineTo(a1[0]! - uy * s * 3, a1[1]! + ux * s * 3);
    fl.lineTo(a1[0]!, a1[1]!);
    fl.closePath();
  }
  glowFill(ctx, fl, THEMES.fogo, [N[0] - 8, N[1] - 28, N[0] + 28, N[1] + 8], 10, 1.8);
  const head = new Path2D();
  head.moveTo(tip[0], tip[1]);
  head.lineTo(tip[0] - ux * 14 - uy * 7, tip[1] - uy * 14 + ux * 7);
  head.lineTo(tip[0] - ux * 10, tip[1] - uy * 10);
  head.lineTo(tip[0] - ux * 14 + uy * 7, tip[1] - uy * 14 - ux * 7);
  head.closePath();
  glowFill(ctx, head, t, [tip[0] - 20, tip[1] - 6, tip[0] + 6, tip[1] + 20], 18, 2.2);
  sparkle(ctx, tip[0] - 2, tip[1] + 2, 5, t);
}

/** Bordunada: a borduna (clava) girando, com o rastro do golpe. */
function paintClub(ctx: CanvasRenderingContext2D): void {
  const t = THEMES.fogo;
  slotBackground(ctx, t, 23);
  // rastro do golpe (atrás da clava)
  for (const [r, w, a] of [
    [50, 5, 0.9],
    [40, 3.5, 0.7],
  ] as const) {
    const arc = new Path2D();
    arc.arc(58, 74, r, -2.65, -1.05);
    ctx.save();
    ctx.globalAlpha = a;
    glowStroke(ctx, arc, w, t, [10, 20, 90, 70], 14);
    ctx.restore();
  }
  // a clava: cabo fino embaixo à esquerda, cabeça grossa em cima à direita
  const ax = 30;
  const ay = 106;
  const bx = 96;
  const by = 32;
  const len = Math.hypot(bx - ax, by - ay);
  const dx = (bx - ax) / len;
  const dy = (by - ay) / len;
  const nx = -dy;
  const ny = dx;
  const half = (u: number) => (u < 0.42 ? 4.6 : u < 0.9 ? 4.6 + (13.5 - 4.6) * Math.sin(((u - 0.42) / 0.48) * (Math.PI / 2)) : 13.5);
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const u = (i / 40) * 0.9;
    const w = half(u);
    const cx = ax + dx * len * u;
    const cy = ay + dy * len * u;
    left.push([cx + nx * w, cy + ny * w]);
    right.push([cx - nx * w, cy - ny * w]);
  }
  const club = new Path2D();
  club.moveTo(left[0]![0], left[0]![1]);
  for (const [x, y] of left) club.lineTo(x, y);
  // ponta redonda
  const ex = ax + dx * len * 0.9;
  const ey = ay + dy * len * 0.9;
  const base = Math.atan2(ny, nx);
  club.arc(ex, ey, 13.5, base, base - Math.PI, true);
  for (let i = right.length - 1; i >= 0; i--) club.lineTo(right[i]![0], right[i]![1]);
  club.arc(ax, ay, 4.6, base + Math.PI, base, true);
  club.closePath();
  glowFill(ctx, club, t, [40, 30, 96, 100], 18, 2.4);
  // amarração do cabo
  ctx.save();
  ctx.strokeStyle = rgba(t.ink, 0.8);
  ctx.lineWidth = 2.2;
  for (const u of [0.1, 0.17, 0.24]) {
    const cx = ax + dx * len * u;
    const cy = ay + dy * len * u;
    ctx.beginPath();
    ctx.moveTo(cx + nx * 5.5, cy + ny * 5.5);
    ctx.lineTo(cx - nx * 5.5, cy - ny * 5.5);
    ctx.stroke();
  }
  ctx.restore();
  sparkle(ctx, 104, 22, 6, t);
  sparkle(ctx, 22, 44, 4, t);
}

/** Fôlego: o sopro em espiral com uma folha na ponta (cura). */
function paintBreath(ctx: CanvasRenderingContext2D): void {
  const t = THEMES.verde;
  slotBackground(ctx, t, 37);
  const cx = 62;
  const cy = 66;
  const turns = 2.15;
  const end = turns * Math.PI * 2;
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * end;
    const r = 3 + a * 3.55;
    const w = 1.2 + (a / end) * 5.2;
    const ang = a - Math.PI / 2;
    outer.push([cx + Math.cos(ang) * (r + w), cy + Math.sin(ang) * (r + w)]);
    inner.push([cx + Math.cos(ang) * (r - w), cy + Math.sin(ang) * (r - w)]);
  }
  const spiral = new Path2D();
  spiral.moveTo(outer[0]![0], outer[0]![1]);
  for (const [x, y] of outer) spiral.lineTo(x, y);
  for (let i = inner.length - 1; i >= 0; i--) spiral.lineTo(inner[i]![0], inner[i]![1]);
  spiral.closePath();
  glowFill(ctx, spiral, t, [20, 20, 104, 112], 18, 2);
  // folha na ponta de fora, seguindo o sopro
  const a = end;
  const r = 3 + a * 3.55;
  const ang = a - Math.PI / 2;
  const lx = cx + Math.cos(ang) * r;
  const ly = cy + Math.sin(ang) * r;
  const dir = ang + Math.PI / 2; // tangente
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(dir);
  const leaf = new Path2D();
  leaf.moveTo(0, 0);
  leaf.quadraticCurveTo(10, -13, 28, -2);
  leaf.quadraticCurveTo(12, 10, 0, 0);
  glowFill(ctx, leaf, t, [0, -12, 28, 8], 12, 1.8);
  ctx.strokeStyle = rgba(t.ink, 0.7);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.quadraticCurveTo(12, -3, 24, -2);
  ctx.stroke();
  ctx.restore();
  sparkle(ctx, 100, 26, 7, t);
  sparkle(ctx, 88, 14, 3.5, t);
}

/** Esquiva: a pegada correndo, com o vento atrás. */
function paintDodge(ctx: CanvasRenderingContext2D): void {
  const t = THEMES.agua;
  slotBackground(ctx, t, 53);
  for (const [y, x0, x1, w] of [
    [50, 14, 46, 4.2],
    [68, 8, 44, 5],
    [86, 18, 48, 3.6],
  ] as const) {
    const s = new Path2D();
    s.moveTo(x0, y);
    s.lineTo(x1, y);
    glowStroke(ctx, s, w, t, [x0, y - 4, x1, y + 4], 12);
  }
  ctx.save();
  ctx.translate(80, 66);
  ctx.rotate(0.42);
  const foot = new Path2D();
  foot.ellipse(0, -9, 14, 17, 0, 0, Math.PI * 2);
  foot.moveTo(10, 16);
  foot.ellipse(-1, 16, 10.5, 13, 0.08, 0, Math.PI * 2);
  foot.moveTo(9, 2);
  foot.ellipse(-1, 4, 10, 12, 0, 0, Math.PI * 2);
  glowFill(ctx, foot, t, [-14, -26, 14, 30], 18, 2.2);
  const toes = new Path2D();
  for (const [x, y, r] of [
    [-11, -31, 4.6],
    [-3, -35, 4.2],
    [5, -34, 3.8],
    [11.5, -30, 3.3],
    [15.5, -24, 2.8],
  ] as const) {
    toes.moveTo(x + r, y);
    toes.arc(x, y, r, 0, Math.PI * 2);
  }
  glowFill(ctx, toes, t, [-16, -40, 18, -20], 10, 1.8);
  ctx.restore();
}

/** Defesa: o escudo redondo trançado, com o miolo de pedra. */
function paintGuard(ctx: CanvasRenderingContext2D): void {
  const t = THEMES.ceu;
  slotBackground(ctx, t, 71);
  const cx = 64;
  const cy = 64;
  const shield = new Path2D();
  shield.arc(cx, cy, 41, 0, Math.PI * 2);
  glowFill(ctx, shield, t, [30, 24, 100, 108], 20, 2.6);
  ctx.save();
  ctx.strokeStyle = rgba(t.ink, 0.75);
  ctx.lineWidth = 2.4;
  for (const r of [33, 21]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // trançado: dentes entre os dois anéis
  ctx.lineWidth = 2;
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 ? 31 : 23;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  // miolo
  const boss = new Path2D();
  boss.arc(cx, cy, 10, 0, Math.PI * 2);
  glowFill(ctx, boss, t, [56, 56, 72, 74], 10, 1.8);
  // reflexo no alto
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, 36, -2.7, -1.75);
  ctx.stroke();
  ctx.restore();
}

/** Pular: o pé subindo (o mesmo da esquiva, de pé), os riscos do impulso embaixo dele e o chão com a poeirinha. */
function paintJump(ctx: CanvasRenderingContext2D): void {
  const t = THEMES.ceu;
  slotBackground(ctx, t, 61);
  // o chão e a poeira do impulso
  const ground = new Path2D();
  ground.moveTo(22, 106);
  ground.lineTo(106, 106);
  glowStroke(ctx, ground, 3.4, t, [22, 102, 106, 110], 10);
  const dust = new Path2D();
  for (const [x, y, r] of [
    [34, 100, 4.2],
    [27, 103, 3],
    [94, 100, 4.2],
    [101, 103, 3],
  ] as const) {
    dust.moveTo(x + r, y);
    dust.arc(x, y, r, 0, Math.PI * 2);
  }
  glowFill(ctx, dust, t, [22, 95, 106, 107], 8, 1.4);
  // os riscos de subida, embaixo do pé
  for (const [x, y0, y1, w] of [
    [48, 96, 74, 3.6],
    [64, 99, 70, 4.4],
    [80, 96, 75, 3.2],
  ] as const) {
    const s = new Path2D();
    s.moveTo(x, y0);
    s.lineTo(x, y1);
    glowStroke(ctx, s, w, t, [x - 3, y1, x + 3, y0], 12);
  }
  // o pé subindo, com os dedos para cima
  ctx.save();
  ctx.translate(64, 44);
  ctx.rotate(-0.1);
  ctx.scale(0.92, 0.92);
  const foot = new Path2D();
  foot.ellipse(0, -9, 14, 17, 0, 0, Math.PI * 2);
  foot.moveTo(10, 16);
  foot.ellipse(-1, 16, 10.5, 13, 0.08, 0, Math.PI * 2);
  foot.moveTo(9, 2);
  foot.ellipse(-1, 4, 10, 12, 0, 0, Math.PI * 2);
  glowFill(ctx, foot, t, [-14, -26, 14, 30], 18, 2.2);
  const toes = new Path2D();
  for (const [x, y, r] of [
    [-11, -31, 4.6],
    [-3, -35, 4.2],
    [5, -34, 3.8],
    [11.5, -30, 3.3],
    [15.5, -24, 2.8],
  ] as const) {
    toes.moveTo(x + r, y);
    toes.arc(x, y, r, 0, Math.PI * 2);
  }
  glowFill(ctx, toes, t, [-16, -40, 18, -20], 10, 1.8);
  ctx.restore();
}

export type PaintedAction = 'shot' | 'skill0' | 'skill1' | 'dash' | 'jump' | 'guard' | 'bow';

const ACTION_PAINTERS: Record<PaintedAction, (ctx: CanvasRenderingContext2D) => void> = {
  shot: paintShot,
  bow: paintBow,
  skill0: paintClub,
  skill1: paintBreath,
  dash: paintDodge,
  jump: paintJump,
  guard: paintGuard,
};

const actionUrls = new Map<PaintedAction, string>();

/** O ícone pintado da habilidade (com o fundo do quadrado), como URL para o HTML. */
export function paintedActionIcon(slot: PaintedAction): string {
  let url = actionUrls.get(slot);
  if (!url) {
    const [canvas, ctx] = newCanvas();
    ACTION_PAINTERS[slot](ctx);
    url = canvas.toDataURL();
    actionUrls.set(slot, url);
  }
  return url;
}

// ------------------------------------------------------------------------------------------------ itens

/** Sombra macia embaixo do item (ele "pousa" no anel ou no quadrado da mochila). */
function itemShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Corpo pintado: contorno escuro, degradê de luz (de cima à esquerda) e um reflexo. */
function body(ctx: CanvasRenderingContext2D, path: Path2D, light: string, mid: string, dark: string, box: Box, ink = '#24150a', inkW = 2.6): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = inkW * 2;
  ctx.strokeStyle = ink;
  ctx.stroke(path);
  const g = ctx.createLinearGradient(box[0], box[1], box[2], box[3]);
  g.addColorStop(0, light);
  g.addColorStop(0.5, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.restore();
}

function shine(ctx: CanvasRenderingContext2D, path: Path2D, alpha = 0.7): void {
  ctx.save();
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.fill(path);
  ctx.restore();
}

/**
 * O Arco de Bambu (o item, na mochila e na loja): bambu do brejo curvado no fogo, com os nós, a empunhadura de couro com
 * uma pena vermelha amarrada e a corda de fibra de tucum.
 */
function paintBowItem(ctx: CanvasRenderingContext2D): void {
  itemShadow(ctx, 62, 112, 42);
  const A = [40, 12] as const;
  const B = [38, 116] as const;
  const C = [116, 62] as const;
  const at = (u: number): [number, number] => [
    (1 - u) * (1 - u) * A[0] + 2 * (1 - u) * u * C[0] + u * u * B[0],
    (1 - u) * (1 - u) * A[1] + 2 * (1 - u) * u * C[1] + u * u * B[1],
  ];
  const tangent = (u: number): [number, number] => {
    const dx = 2 * (1 - u) * (C[0] - A[0]) + 2 * u * (B[0] - C[0]);
    const dy = 2 * (1 - u) * (C[1] - A[1]) + 2 * u * (B[1] - C[1]);
    const d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
  };
  // a corda (atrás do bambu)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#24150a';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(A[0] + 2, A[1] + 3);
  ctx.lineTo(B[0] + 2, B[1] - 3);
  ctx.stroke();
  ctx.strokeStyle = '#efe6cc';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // o bambu: contorno, o corpo com a luz e os nós
  const limb = new Path2D();
  limb.moveTo(A[0], A[1]);
  limb.quadraticCurveTo(C[0], C[1], B[0], B[1]);
  ctx.strokeStyle = '#24150a';
  ctx.lineWidth = 14;
  ctx.stroke(limb);
  const g = ctx.createLinearGradient(40, 0, 100, 0);
  g.addColorStop(0, '#f2dc98');
  g.addColorStop(0.5, '#c9a24e');
  g.addColorStop(1, '#8a6a2a');
  ctx.strokeStyle = g;
  ctx.lineWidth = 8.6;
  ctx.stroke(limb);
  ctx.strokeStyle = 'rgba(255, 248, 220, 0.55)';
  ctx.lineWidth = 2.2;
  ctx.save();
  ctx.translate(-2, 0);
  ctx.stroke(limb);
  ctx.restore();
  for (const u of [0.14, 0.3, 0.7, 0.86]) {
    const [x, y] = at(u);
    const [tx, ty] = tangent(u);
    ctx.strokeStyle = '#6b4f1c';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x - ty * 6, y + tx * 6);
    ctx.lineTo(x + ty * 6, y - tx * 6);
    ctx.stroke();
  }
  // as pontas (amarração escura onde a corda prende)
  for (const [x, y] of [A, B]) {
    ctx.fillStyle = '#3e2a14';
    ctx.strokeStyle = '#24150a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // a empunhadura de couro (no meio do arco) e a pena vermelha pendurada nela
  const [gx, gy] = at(0.5);
  const [tx, ty] = tangent(0.5);
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(Math.atan2(ty, tx));
  ctx.fillStyle = '#6b4024';
  ctx.strokeStyle = '#24150a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-12, -7.5, 24, 15, 4);
  else ctx.rect(-12, -7.5, 24, 15);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30, 16, 6, 0.6)';
  ctx.lineWidth = 1.6;
  for (let k = -8; k <= 8; k += 4) {
    ctx.beginPath();
    ctx.moveTo(k - 2, -7);
    ctx.lineTo(k + 2, 7);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#24150a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(gx + 2, gy + 6);
  ctx.quadraticCurveTo(gx + 8, gy + 18, gx + 4, gy + 26);
  ctx.stroke();
  const f = new Path2D();
  f.moveTo(gx + 4, gy + 25);
  f.bezierCurveTo(gx + 14, gy + 30, gx + 16, gy + 46, gx + 9, gy + 54);
  f.bezierCurveTo(gx + 2, gy + 46, gx - 2, gy + 32, gx + 4, gy + 25);
  f.closePath();
  body(ctx, f, '#ff8a6a', '#d83a22', '#8a1e10', [gx, gy + 25, gx + 16, gy + 54], '#24150a', 1.8);
  ctx.strokeStyle = 'rgba(80, 10, 4, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(gx + 5, gy + 27);
  ctx.quadraticCurveTo(gx + 10, gy + 40, gx + 9, gy + 52);
  ctx.stroke();
  ctx.restore();
}

function paintBanana(ctx: CanvasRenderingContext2D): void {
  itemShadow(ctx, 62, 108, 40);
  // meia-lua gorda: o lado de dentro (côncavo) em cima à esquerda, o de fora embaixo à direita
  const b = new Path2D();
  b.moveTo(20, 84);
  b.bezierCurveTo(46, 86, 82, 66, 90, 26);
  b.lineTo(101, 22);
  b.bezierCurveTo(116, 60, 86, 108, 22, 100);
  b.bezierCurveTo(15, 98, 14, 87, 20, 84);
  b.closePath();
  body(ctx, b, '#fff3a0', '#f2c72e', '#b9800e', [50, 40, 96, 106]);
  // quina da casca
  ctx.save();
  ctx.strokeStyle = 'rgba(150, 100, 10, 0.55)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(28, 93);
  ctx.bezierCurveTo(62, 96, 92, 72, 97, 32);
  ctx.stroke();
  ctx.restore();
  const s = new Path2D();
  s.moveTo(34, 88);
  s.bezierCurveTo(56, 88, 78, 74, 86, 48);
  s.bezierCurveTo(82, 72, 60, 86, 34, 88);
  shine(ctx, s, 0.6);
  // cabinho e pontinha
  const stem = new Path2D();
  stem.moveTo(90, 26);
  stem.lineTo(92, 12);
  stem.lineTo(101, 12);
  stem.lineTo(101, 23);
  stem.closePath();
  body(ctx, stem, '#a07a3c', '#6b4a1e', '#3e2a10', [90, 12, 102, 26]);
  const tip = new Path2D();
  tip.arc(19, 91, 5, 0, Math.PI * 2);
  body(ctx, tip, '#5a3d1a', '#3e2a10', '#2a1a08', [14, 86, 24, 96], '#1a0e04', 1.6);
}

function paintCoconut(ctx: CanvasRenderingContext2D): void {
  itemShadow(ctx, 62, 108, 40);
  // canudo
  const straw = new Path2D();
  straw.moveTo(70, 46);
  straw.lineTo(88, 10);
  straw.lineTo(96, 14);
  straw.lineTo(78, 48);
  straw.closePath();
  body(ctx, straw, '#ffffff', '#f1e6d8', '#c8b8a2', [70, 10, 96, 48], '#3a2a1a', 2);
  ctx.save();
  ctx.strokeStyle = '#d8402e';
  ctx.lineWidth = 3;
  for (const k of [0.25, 0.55]) {
    ctx.beginPath();
    ctx.moveTo(70 + 18 * k + 1, 46 - 36 * k);
    ctx.lineTo(78 + 18 * k - 1, 48 - 36 * k);
    ctx.stroke();
  }
  ctx.restore();
  // o coco verde
  const coco = new Path2D();
  coco.ellipse(62, 72, 38, 34, 0, 0, Math.PI * 2);
  body(ctx, coco, '#b8e870', '#5fa82c', '#2c5e12', [36, 40, 92, 108], '#132a08');
  // a tampa cortada
  const cut = new Path2D();
  cut.ellipse(64, 46, 20, 8, -0.08, 0, Math.PI * 2);
  body(ctx, cut, '#fbf6e2', '#e8dcb4', '#c4b07e', [44, 38, 84, 54], '#3a3010', 2);
  const hole = new Path2D();
  hole.ellipse(66, 46, 9, 3.6, -0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#d9cfa8';
  ctx.fill(hole);
  const s = new Path2D();
  s.ellipse(44, 66, 8, 14, 0.5, 0, Math.PI * 2);
  shine(ctx, s, 0.35);
}

function paintRue(ctx: CanvasRenderingContext2D): void {
  itemShadow(ctx, 60, 110, 30);
  // talos
  ctx.save();
  ctx.strokeStyle = '#24150a';
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  const stems = new Path2D();
  stems.moveTo(58, 110);
  stems.bezierCurveTo(58, 86, 54, 60, 46, 26);
  stems.moveTo(58, 96);
  stems.bezierCurveTo(68, 76, 80, 58, 88, 38);
  stems.moveTo(57, 80);
  stems.bezierCurveTo(46, 70, 36, 64, 28, 58);
  ctx.stroke(stems);
  ctx.strokeStyle = '#4d7a2a';
  ctx.lineWidth = 3;
  ctx.stroke(stems);
  ctx.restore();
  // folhinhas redondas da arruda, verde-azulado
  const r = rng(9);
  const leaves: [number, number, number, number][] = [];
  const along = (pts: [number, number][], n: number) => {
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const j = Math.min(pts.length - 2, Math.floor(k * (pts.length - 1)));
      const f = k * (pts.length - 1) - j;
      const x = pts[j]![0] + (pts[j + 1]![0] - pts[j]![0]) * f;
      const y = pts[j]![1] + (pts[j + 1]![1] - pts[j]![1]) * f;
      const side = i % 2 ? 1 : -1;
      leaves.push([x + side * (7 + r() * 3), y + (r() - 0.5) * 4, 6.5 + r() * 2.5, side * (0.6 + r() * 0.4)]);
    }
  };
  along(
    [
      [58, 100],
      [56, 72],
      [50, 44],
      [46, 26],
    ],
    7,
  );
  along(
    [
      [62, 90],
      [74, 70],
      [86, 44],
    ],
    5,
  );
  along(
    [
      [52, 76],
      [38, 66],
      [28, 58],
    ],
    3,
  );
  for (const [x, y, s, rot] of leaves) {
    const leaf = new Path2D();
    leaf.ellipse(x, y, s * 0.72, s, rot, 0, Math.PI * 2);
    body(ctx, leaf, '#c8f0b8', '#6fb08a', '#2f6a4e', [x - s, y - s, x + s, y + s], '#10261a', 1.6);
  }
  // florzinhas amarelas no alto
  for (const [x, y] of [
    [46, 22],
    [89, 34],
    [27, 54],
  ] as const) {
    const f = new Path2D();
    f.arc(x, y, 4.6, 0, Math.PI * 2);
    body(ctx, f, '#fff7b0', '#f2d23a', '#b8920e', [x - 4, y - 4, x + 4, y + 4], '#3a2a04', 1.4);
  }
}

function paintBottle(ctx: CanvasRenderingContext2D): void {
  itemShadow(ctx, 64, 112, 34);
  // vidro (atrás do líquido): o corpo arredondado e o gargalo
  const glass = new Path2D();
  glass.moveTo(54, 30);
  glass.lineTo(54, 50);
  glass.bezierCurveTo(34, 58, 30, 76, 32, 90);
  glass.bezierCurveTo(34, 108, 50, 112, 64, 112);
  glass.bezierCurveTo(78, 112, 94, 108, 96, 90);
  glass.bezierCurveTo(98, 76, 94, 58, 74, 50);
  glass.lineTo(74, 30);
  glass.closePath();
  ctx.save();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#1a1208';
  ctx.stroke(glass);
  ctx.fillStyle = 'rgba(190, 230, 210, 0.35)';
  ctx.fill(glass);
  ctx.restore();
  // a garrafada: líquido âmbar com ervas
  ctx.save();
  ctx.clip(glass);
  const liquid = ctx.createLinearGradient(30, 60, 98, 112);
  liquid.addColorStop(0, '#f2b24a');
  liquid.addColorStop(0.5, '#b8661a');
  liquid.addColorStop(1, '#5e2a08');
  ctx.fillStyle = liquid;
  ctx.beginPath();
  ctx.moveTo(20, 68);
  ctx.quadraticCurveTo(64, 62, 110, 70);
  ctx.lineTo(110, 120);
  ctx.lineTo(20, 120);
  ctx.closePath();
  ctx.fill();
  // raminhos dentro
  ctx.strokeStyle = 'rgba(60, 90, 30, 0.85)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1] of [
    [46, 104, 58, 74],
    [70, 106, 80, 78],
    [58, 108, 66, 84],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + 5, (y0 + y1) / 2, x1, y1);
    ctx.stroke();
  }
  // bolhas
  ctx.fillStyle = 'rgba(255, 236, 190, 0.6)';
  for (const [x, y, r] of [
    [76, 92, 3],
    [52, 88, 2.2],
    [66, 98, 1.8],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // reflexo do vidro
  const s = new Path2D();
  s.moveTo(42, 76);
  s.bezierCurveTo(40, 66, 46, 60, 52, 58);
  s.bezierCurveTo(48, 66, 46, 74, 46, 84);
  s.closePath();
  shine(ctx, s, 0.7);
  // rolha e o cordão no gargalo
  const cork = new Path2D();
  cork.moveTo(51, 16);
  cork.lineTo(77, 16);
  cork.lineTo(75, 32);
  cork.lineTo(53, 32);
  cork.closePath();
  body(ctx, cork, '#e0b884', '#b0804a', '#6e4a22', [51, 16, 77, 32], '#24150a', 2.2);
  ctx.save();
  ctx.strokeStyle = '#24150a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(52, 42);
  ctx.lineTo(76, 42);
  ctx.stroke();
  ctx.strokeStyle = '#c9a060';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(74, 42);
  ctx.quadraticCurveTo(84, 48, 82, 60);
  ctx.strokeStyle = '#24150a';
  ctx.lineWidth = 4.4;
  ctx.stroke();
  ctx.strokeStyle = '#c9a060';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();
}

function paintBag(ctx: CanvasRenderingContext2D): void {
  itemShadow(ctx, 64, 112, 40);
  // alça
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#24150a';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(42, 46);
  ctx.bezierCurveTo(42, 14, 86, 14, 86, 46);
  ctx.stroke();
  ctx.strokeStyle = '#c99a50';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
  // saco de couro
  const sack = new Path2D();
  sack.moveTo(36, 46);
  sack.bezierCurveTo(28, 64, 22, 92, 30, 104);
  sack.bezierCurveTo(44, 114, 84, 114, 98, 104);
  sack.bezierCurveTo(106, 92, 100, 64, 92, 46);
  sack.closePath();
  body(ctx, sack, '#f4d08a', '#d29a46', '#8a5a22', [30, 44, 100, 112]);
  // aba de cima
  const flap = new Path2D();
  flap.moveTo(32, 44);
  flap.bezierCurveTo(44, 36, 84, 36, 96, 44);
  flap.lineTo(92, 64);
  flap.bezierCurveTo(78, 74, 50, 74, 36, 64);
  flap.closePath();
  body(ctx, flap, '#ffe2a4', '#e0aa56', '#9a6428', [32, 36, 96, 74]);
  // fecho
  const clasp = new Path2D();
  clasp.arc(64, 68, 6, 0, Math.PI * 2);
  body(ctx, clasp, '#fff4c8', '#e2b440', '#9a7012', [58, 62, 70, 74], '#2a1a04', 2);
  // costura
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(70, 40, 12, 0.7)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(38, 60);
  ctx.bezierCurveTo(50, 68, 78, 68, 90, 60);
  ctx.stroke();
  ctx.restore();
  const s = new Path2D();
  s.ellipse(44, 84, 5, 13, 0.25, 0, Math.PI * 2);
  shine(ctx, s, 0.3);
}

const ITEM_PAINTERS: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
  arco: paintBowItem,
  banana: paintBanana,
  agua_coco: paintCoconut,
  erva: paintRue,
  garrafada: paintBottle,
  mochila: paintBag,
};

const itemCanvases = new Map<string, HTMLCanvasElement>();

/** O item pintado (fundo transparente), ou null se ele ainda não ganhou pintura. */
export function paintedItemIcon(icon: string): HTMLCanvasElement | null {
  const paint = ITEM_PAINTERS[icon];
  if (!paint) return null;
  let canvas = itemCanvases.get(icon);
  if (!canvas) {
    let ctx: CanvasRenderingContext2D;
    [canvas, ctx] = newCanvas();
    paint(ctx);
    itemCanvases.set(icon, canvas);
  }
  return canvas;
}
