// ARQUIVO DA [ARTE]: o desenho da Flecha Ancestral no jogo 2.5D — o espírito verde-claro, como a fase 5 da Chuva, com
// uma cara para cada ponto da habilidade (22/11, o dono: "nível 1 é feio e fraco, nível 2 melhora, nível 3 muda e por aí
// vai" e "sensação de impactos também por nível" — veja SPIRIT_LOOKS):
//   drawSpiritArrow(ctx, noAr, sombra, aFrente, pxPorMetro, agora)   a flecha voando (o drawProjectile chama daqui):
//                                        a flecha de luz, o rastro, a espiral do espírito enrolando e as luzinhas
//   paintSpiritAim(ctx, mira, agora, tela, pxPorMetro)     a mira (segurando o R): a faixa dourada do chão, do pé até o
//                                        fim do alcance, com as setas andando para a frente e o fio verde no meio
//   paintSpiritEnd(ctx, fim, agora, tela, pxPorMetro)      onde ela parou: o espírito se desfaz em luzinhas subindo; com
//                                        5 pontos (`r` > 0), explode: o clarão, a onda no chão até o raio, os raios, o
//                                        segundo pulso e os fios do espírito subindo. Nos dois casos fica a marca do
//                                        espírito no chão (o anel com a espiral), que apaga devagar
//   paintSpiritMark(ctx, pé, até, agora, tela, pxPorMetro) a runa do espírito em cima do bicho marcado (3 pontos ou
//                                        mais) e o anel no pé dele; pisca no último segundo
//   SPIRIT_END_MS                        quanto o fim fica na tela (o combate guarda até lá)
// O combate (combat.ts, da [estrutura]) guarda os tiros, a mira, os fins e as marcas e chama daqui a cada quadro.
// Posições em metros (as do combate); `tela(x, y, z)` dá o ponto na tela e `pxPorMetro(x, y)` quantos pixels tem 1 m de
// altura ali (o tamanho das coisas acompanha o zoom).

type Point = { x: number; y: number };
type RGB = readonly [number, number, number];
export type Screen = (x: number, y: number, z?: number) => Point;
export type Meter = (x: number, y: number) => number;

/** A mira da Flecha Ancestral: do pé de quem atira até o fim do alcance (x, y); `r` = a largura de cada lado. */
export interface SpiritAimLook {
  from: Point;
  x: number;
  y: number;
  r: number;
}

/** Onde a Flecha Ancestral parou (no fim do alcance ou numa parede) e quando; `r` > 0 = explode nesse raio (m). */
export interface SpiritEndLook {
  x: number;
  y: number;
  r: number;
  start: number;
  /** Os pontos de quem atirou e o degrau da puxada (1 fraco, 2 médio, 3 forte): o fim cresce com eles. */
  rank?: number;
  level?: number;
}

/**
 * O quanto o degrau da puxada acende o efeito (22/11, o dono: "um brilho em cada degrau" e "sensação de impactos também
 * por nível"): fraco ~0,6, médio ~0,8, forte 1. Sem degrau (outro jogador, jeito antigo), o completo.
 */
export function levelPower(level: number | undefined): number {
  return level === 1 ? 0.62 : level === 2 ? 0.82 : 1;
}
/** O mesmo degrau de 0 (fraco) a 1 (forte; ou sem degrau): para o que tem de mudar bem à vista entre um e outro. */
function levelStep(level: number | undefined): number {
  return level === 1 ? 0 : level === 2 ? 0.5 : 1;
}

/** A cara da Flecha Ancestral em cada ponto (veja SPIRIT_LOOKS). */
interface SpiritLook {
  /** A luz: o brilho em volta, o rastro, a poça no chão e o clarão da ponta. */
  glow: number;
  /** O comprimento do rastro. */
  trail: number;
  /** Os fios da espiral do espírito (0 = sem, 2 = a espiral, 4 = a espiral dupla). */
  strands: number;
  /** O tamanho da flecha. */
  size: number;
  /** As luzinhas que ela vai largando (no degrau forte). */
  motes: number;
  /** As luzinhas ficam no caminho (soltam mais para trás e demoram a apagar). */
  path: boolean;
  /** A força da pancada onde ela para (0 a 1). */
  power: number;
  /** As luzinhas do fim (quando se desfaz). */
  endLights: number;
  /** O anel de luz que abre no chão onde ela para. */
  ring: boolean;
  /** O tamanho e a força da marca do espírito no chão. */
  mark: number;
}

/**
 * A Flecha Ancestral em cada ponto (22/11, etapa 3, escopo aprovado pelo dono):
 *   1 = a luz fraca, o rastro curto e poucas luzinhas (no fim também)
 *   2 = mais luz e o rastro maior
 *   3 = a espiral do espírito (a de antes); quem ela atravessa leva a runa (a marca é do servidor)
 *   4 = a espiral dupla, a flecha maior, as luzinhas ficando no caminho e o anel de luz no chão onde ela para
 *   5 = tudo isso e a explosão (o servidor manda o raio)
 * A pancada onde ela para cresce com os pontos (`power`) e com o degrau da puxada.
 */
const SPIRIT_LOOKS: readonly SpiritLook[] = [
  { glow: 0.5, trail: 0.42, strands: 0, size: 0.88, motes: 2, path: false, power: 0.35, endLights: 4, ring: false, mark: 0.55 },
  { glow: 0.75, trail: 0.72, strands: 0, size: 0.94, motes: 4, path: false, power: 0.55, endLights: 7, ring: false, mark: 0.75 },
  { glow: 1, trail: 1, strands: 2, size: 1, motes: 8, path: false, power: 0.75, endLights: 10, ring: false, mark: 1 },
  { glow: 1.12, trail: 1.15, strands: 4, size: 1.16, motes: 12, path: true, power: 0.9, endLights: 14, ring: true, mark: 1.12 },
  { glow: 1.18, trail: 1.2, strands: 4, size: 1.2, motes: 12, path: true, power: 1, endLights: 14, ring: true, mark: 1.12 },
];

/** A cara pelos pontos (1 a 5); sem os pontos, `fallback` (a de antes = 3; o fim que explode = 5). */
function spiritLook(rank: number | undefined, fallback: number): SpiritLook {
  const r = Number.isFinite(rank) && (rank as number) >= 1 ? Math.min(5, Math.round(rank as number)) : fallback;
  return SPIRIT_LOOKS[r - 1]!;
}

/**
 * Quanto o fim fica na tela: a explosão (BURST_MS) ou o desfazer (FADE_MS) e depois a marca no chão, apagando devagar
 * (o combate guarda o fim até aqui). A explosão era de 720 ms; o dono pediu mais demorada (19/11).
 */
export const SPIRIT_END_MS = 3400;
const BURST_MS = 1300;
const FADE_MS = 640;
/** A marca no chão: acende quando o efeito do fim vai apagando e some nos últimos MARK_OUT_MS. */
const MARK_OUT_MS = 1500;
/** A altura do voo (m): a mesma do combate (SHOT_DRAW_Z), onde o espírito se desfaz. */
const FLIGHT_Z = 0.9;
/** A altura da runa (m): logo acima da barra de vida (BODY_HEIGHT + 0,42). */
const MARK_Z = 2.02;
const TAU = Math.PI * 2;

/** O verde do espírito (o mesmo da Chuva com 5 pontos), o miolo quase branco e o dourado da HUD (a mira). */
const MINT: RGB = [140, 255, 190];
const PALE: RGB = [228, 255, 240];
const HUD: RGB = [255, 210, 62];
const DEEP = 'rgba(24, 92, 60, 0.8)';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function rgba(c: RGB, alpha: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${clamp01(alpha).toFixed(3)})`;
}

/** Sai rápido e chega devagar. */
function easeOut(t: number): number {
  const k = 1 - clamp01(t);
  return 1 - k * k * k;
}

/** Uma bola de luz redonda (degradê do meio para fora). */
function glowCircle(ctx: CanvasRenderingContext2D, p: Point, r: number, c: RGB, alpha: number): void {
  if (alpha <= 0.003 || r <= 0.5) return;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  g.addColorStop(0, rgba(c, alpha));
  g.addColorStop(0.4, rgba(c, alpha * 0.45));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, TAU);
  ctx.fill();
}

/** Uma poça de luz deitada no chão (a elipse da câmera: metade da altura). */
function glowGround(ctx: CanvasRenderingContext2D, p: Point, r: number, c: RGB, alpha: number): void {
  if (alpha <= 0.003 || r <= 0.5) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, 0.5);
  glowCircle(ctx, { x: 0, y: 0 }, r, c, alpha);
  ctx.restore();
}

/** Estrelinha de 4 pontas (as luzinhas do espírito), girada de `rot`. */
function star(ctx: CanvasRenderingContext2D, p: Point, size: number, rot = 0): void {
  const t = size * 0.26;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (rot) ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(t, -t, size, 0);
  ctx.quadraticCurveTo(t, t, 0, size);
  ctx.quadraticCurveTo(-t, t, -size, 0);
  ctx.quadraticCurveTo(-t, -t, 0, -size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** O círculo deitado no chão (o caminho; quem chama pinta). */
function groundPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, screen: Screen, n = 40): void {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const p = screen(x + Math.cos(a) * r, y + Math.sin(a) * r);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/** Um número "sorteado" fixo para cada `i` (as luzinhas não tremem de um quadro para o outro). */
function hash(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ------------------------------------------------------------------------------------------------ a flecha voando

/** O corpo da flecha de luz: a haste clara com o miolo branco, as duas penas verdes e a ponta de cristal. */
function spiritBody(ctx: CanvasRenderingContext2D, tail: Point, tip: Point, m: number): void {
  const dx = tip.x - tail.x;
  const dy = tip.y - tail.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const w = Math.max(1.9, m * 0.03);
  const hl = Math.max(6, w * 4.2);
  const hw = Math.max(2.6, w * 1.9);
  const neck = { x: tip.x - ux * hl * 0.8, y: tip.y - uy * hl * 0.8 };
  ctx.lineCap = 'round';
  // a haste: o contorno verde-escuro, a luz e o miolo branco
  ctx.strokeStyle = DEEP;
  ctx.lineWidth = w + 2;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(neck.x, neck.y);
  ctx.stroke();
  ctx.strokeStyle = '#c9ffe2';
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(0.7, w * 0.4);
  ctx.stroke();
  // as penas: duas folhas de luz abertas para trás, perto da cauda
  const f0 = 0.03 * len;
  const f1 = Math.min(0.3 * len, f0 + w * 10);
  for (const s of [1, -1]) {
    const fw = Math.max(2.6, w * 2.7);
    ctx.fillStyle = '#8cffbe';
    ctx.strokeStyle = DEEP;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tail.x + ux * f0, tail.y + uy * f0);
    ctx.quadraticCurveTo(tail.x + ux * f0 + nx * s * fw * 1.15, tail.y + uy * f0 + ny * s * fw * 1.15, tail.x + ux * f1 + nx * s * fw * 0.3, tail.y + uy * f1 + ny * s * fw * 0.3);
    ctx.lineTo(tail.x + ux * f1, tail.y + uy * f1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // a ponta clarinha da pena
    ctx.fillStyle = '#e8fff4';
    ctx.beginPath();
    ctx.moveTo(tail.x + ux * f0, tail.y + uy * f0);
    ctx.lineTo(tail.x + ux * f0 + nx * s * fw * 0.8, tail.y + uy * f0 + ny * s * fw * 0.8);
    ctx.lineTo(tail.x + ux * (f0 + w * 2.5), tail.y + uy * (f0 + w * 2.5));
    ctx.closePath();
    ctx.fill();
  }
  // a ponta: cristal branco em forma de folha, com o veio verde
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = DEEP;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.quadraticCurveTo(tip.x - ux * hl * 0.45 + nx * hw * 1.1, tip.y - uy * hl * 0.45 + ny * hw * 1.1, tip.x - ux * hl, tip.y - uy * hl);
  ctx.quadraticCurveTo(tip.x - ux * hl * 0.45 - nx * hw * 1.1, tip.y - uy * hl * 0.45 - ny * hw * 1.1, tip.x, tip.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90, 220, 150, 0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tip.x - ux * hl * 0.15, tip.y - uy * hl * 0.15);
  ctx.lineTo(tip.x - ux * hl * 0.85, tip.y - uy * hl * 0.85);
  ctx.stroke();
}

/**
 * A Flecha Ancestral voando. `at` é o ponto do tiro na tela (na altura do voo), `shadow` o pé dele no chão, `ahead` um
 * ponto 0,3 m à frente na direção do voo (dá a direção e quantos px tem cada metro do caminho) e `m` quantos px tem um
 * metro de altura ali.
 */
export function drawSpiritArrow(ctx: CanvasRenderingContext2D, at: Point, shadow: Point, ahead: Point, m: number, now: number, look?: { rank?: number; level?: number }): void {
  // o degrau da puxada: no fraco a flecha sai menor, com o rastro curto e apagado; no forte, completa. Os pontos mudam a
  // cara (SPIRIT_LOOKS)
  const lk = levelPower(look?.level);
  const lt = levelStep(look?.level);
  const S = spiritLook(look?.rank, 3);
  const light = Math.min(1, S.glow);
  const dx = ahead.x - at.x;
  const dy = ahead.y - at.y;
  const d = Math.hypot(dx, dy);
  const ux = d > 0.01 ? dx / d : 1;
  const uy = d > 0.01 ? dy / d : 0;
  const nx = -uy;
  const ny = ux;
  // px por metro do caminho (voando para a câmera, o caminho encurta na tela)
  const per = d > 0.01 ? d / 0.3 : m;
  const L = Math.max(22, m * 1.08) * (0.86 + 0.14 * lk) * S.size;
  const tip = { x: at.x + ux * L * 0.5, y: at.y + uy * L * 0.5 };
  const tail = { x: at.x - ux * L * 0.5, y: at.y - uy * L * 0.5 };
  const w = Math.max(3.5, m * 0.13) * (0.62 + 0.38 * lt) * S.size;
  const a = Math.atan2(uy, ux);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 1) a luz que ela joga no chão, embaixo
  glowGround(ctx, shadow, m * 0.8 * S.size, MINT, 0.26 * lk * S.glow);
  // 2) o rastro: a fita de luz que afina para trás (uns 2,4 m no forte), com o miolo mais claro
  const back = Math.min(per * 2.4, m * 4.2) * (0.32 + 0.68 * lt) * S.trail;
  const end = { x: at.x - ux * back, y: at.y - uy * back };
  for (const [width, c, alpha0] of [
    [w, MINT, 0.5],
    [w * 0.42, PALE, 0.75],
  ] as const) {
    const alpha = alpha0 * (0.42 + 0.58 * lt) * light;
    const g = ctx.createLinearGradient(end.x, end.y, at.x, at.y);
    g.addColorStop(0, rgba(c, 0));
    g.addColorStop(0.65, rgba(c, alpha * 0.45));
    g.addColorStop(1, rgba(c, alpha));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(at.x + nx * width, at.y + ny * width);
    ctx.arc(at.x, at.y, width, a + Math.PI / 2, a - Math.PI / 2, true);
    ctx.closePath();
    ctx.fill();
  }
  // 3) a espiral do espírito (com 3 pontos ou mais): dois fios enrolando no rastro, girando (o que passa na frente brilha
  // mais); com 4, a dupla: mais dois fios por fora, mais abertos, girando ao contrário
  const spiralLen = Math.min(per * 1.8, m * 3.2) * (0.35 + 0.65 * lt) * S.trail;
  ctx.lineCap = 'round';
  for (let strand = 0; strand < Math.min(2, S.strands); strand++) {
    let prev: Point | null = null;
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const s = u * spiralLen;
      const ph = u * 10 - now / 55 + strand * Math.PI;
      const amp = w * (1.25 - 0.6 * u);
      const p = { x: at.x - ux * s + nx * Math.sin(ph) * amp, y: at.y - uy * s + ny * Math.sin(ph) * amp };
      if (prev) {
        const front = Math.cos(ph) > 0;
        ctx.strokeStyle = rgba(front ? PALE : MINT, (1 - u) * (front ? 0.95 : 0.4));
        ctx.lineWidth = Math.max(1, m * (front ? 0.032 : 0.022) * (1 - u * 0.5));
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      prev = p;
    }
  }
  for (let strand = 0; strand < S.strands - 2; strand++) {
    let prev: Point | null = null;
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const s = u * spiralLen * 1.15;
      const ph = u * 7 + now / 70 + strand * Math.PI + 0.8;
      const amp = w * (1.9 - 0.8 * u);
      const p = { x: at.x - ux * s + nx * Math.sin(ph) * amp, y: at.y - uy * s + ny * Math.sin(ph) * amp };
      if (prev) {
        const front = Math.cos(ph) > 0;
        ctx.strokeStyle = rgba(front ? MINT : PALE, (1 - u) * (front ? 0.85 : 0.3));
        ctx.lineWidth = Math.max(1, m * (front ? 0.026 : 0.018) * (1 - u * 0.5));
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      prev = p;
    }
  }
  // 4) as luzinhas que ela vai largando para trás (sobem um pouco e apagam); com 4 pontos ficam no caminho (soltam mais
  // para trás e demoram mais a apagar)
  const shed = Math.min(per * 2.2, m * 3.8) * (0.4 + 0.6 * lt) * (S.path ? 1.9 : 1);
  const motes = Math.max(1, Math.round(((2 + 6 * lt) * S.motes) / 8));
  const period = S.path ? 900 : 460;
  for (let j = 0; j < motes; j++) {
    const cycle = now / period + j / motes;
    const k = cycle % 1;
    const seed = Math.floor(cycle) * motes + j;
    const side = (hash(seed) - 0.5) * 2 * w * (0.6 + k * 1.4);
    const p = { x: at.x - ux * k * shed + nx * side, y: at.y - uy * k * shed + ny * side - k * m * (S.path ? 0.1 : 0.18) };
    ctx.fillStyle = rgba(PALE, (1 - k) * 0.9 * Math.min(1, 0.4 + 0.6 * S.glow));
    star(ctx, p, Math.max(1.6, m * 0.05 * (1 - k * 0.6)), hash(seed + 3) * 1.5);
  }
  // 5) a flecha de luz, com o brilho em volta
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = rgba(MINT, 0.95);
  ctx.shadowBlur = Math.max(4, m * 0.22 * S.glow);
  spiritBody(ctx, tail, tip, m * S.size);
  ctx.shadowBlur = 0;
  // 6) o clarão na ponta, com a estrelinha girando
  ctx.globalCompositeOperation = 'lighter';
  glowCircle(ctx, tip, m * 0.3 * (0.7 + 0.3 * lk) * S.size, PALE, Math.min(1, 0.7 * (0.6 + 0.4 * lk) * S.glow));
  ctx.fillStyle = `rgba(255, 255, 255, ${(0.85 * Math.min(1, 0.45 + 0.55 * S.glow)).toFixed(3)})`;
  star(ctx, tip, Math.max(3, m * 0.15 * (0.75 + 0.25 * lk) * Math.min(1.1, 0.6 + 0.4 * S.glow)), now / 260);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ a mira

/**
 * A mira da Flecha Ancestral (segurando a tecla): a faixa dourada no chão por onde ela vai passar (quem estiver nela
 * leva), com a ponta de seta no fim do alcance, as setas andando para a frente e o fio verde do espírito no meio.
 */
export function paintSpiritAim(ctx: CanvasRenderingContext2D, aim: SpiritAimLook, now: number, screen: Screen, meter: Meter): void {
  const len = Math.hypot(aim.x - aim.from.x, aim.y - aim.from.y);
  if (len < 0.3) return;
  const ux = (aim.x - aim.from.x) / len;
  const uy = (aim.y - aim.from.y) / len;
  const nx = -uy;
  const ny = ux;
  const r = Math.max(0.15, aim.r);
  const m = meter(aim.from.x, aim.from.y);
  const P = (s: number, side: number): Point => screen(aim.from.x + ux * s + nx * side, aim.from.y + uy * s + ny * side);
  // começa um pouco à frente do pé (não cobre o herói) e termina numa ponta de seta
  const s0 = Math.min(0.45, len * 0.2);
  const tipLen = Math.min(r * 1.7, len * 0.3);
  const s1 = len - tipLen;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const outline = (): void => {
    const pts = [P(s0, r), P(s1, r), P(len, 0), P(s1, -r), P(s0, -r)];
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
  };
  // o miolo: mais forte perto do fim
  const g0 = P(s0, 0);
  const g1 = P(len, 0);
  const fill = ctx.createLinearGradient(g0.x, g0.y, g1.x, g1.y);
  fill.addColorStop(0, rgba(HUD, 0.03));
  fill.addColorStop(1, rgba(HUD, 0.16));
  outline();
  ctx.fillStyle = fill;
  ctx.fill();
  // o fio do espírito no meio (luz verde)
  ctx.globalCompositeOperation = 'lighter';
  const mid0 = P(s0 + 0.1, 0);
  const mid1 = P(len - tipLen * 0.55, 0);
  ctx.strokeStyle = rgba(MINT, 0.32 + 0.12 * Math.sin(now / 160));
  ctx.lineWidth = Math.max(2, m * 0.05);
  ctx.beginPath();
  ctx.moveTo(mid0.x, mid0.y);
  ctx.lineTo(mid1.x, mid1.y);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  // a borda: o escuro por baixo e o dourado por cima (como o círculo da Chuva)
  outline();
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = 'rgba(24, 14, 4, 0.55)';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(HUD, 0.95);
  ctx.stroke();
  // as setas andando para a frente, uma a cada 0,9 m (aparecem no começo e somem perto da ponta)
  const gap = 0.9;
  const offset = ((now / 1000) * 2.4) % gap;
  for (let s = s0 + offset; s < s1 - 0.05; s += gap) {
    const fade = clamp01(Math.min((s - s0) / 0.5, (s1 - s) / 0.5));
    if (fade <= 0.02) continue;
    const back = Math.min(r * 0.6, 0.35);
    const pts = [P(s - back, r * 0.62), P(s, 0), P(s - back, -r * 0.62)];
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(24, 14, 4, ${(0.4 * fade).toFixed(3)})`;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(HUD, 0.9 * fade);
    ctx.stroke();
  }
  // o fim do alcance: a estrelinha dourada pulsando na ponta
  const tipP = P(len - tipLen * 0.42, 0);
  const pulse = 0.5 + 0.5 * Math.sin(now / 130);
  ctx.fillStyle = rgba(HUD, 0.95);
  ctx.strokeStyle = 'rgba(40, 22, 4, 0.7)';
  ctx.lineWidth = 1;
  ctx.save();
  ctx.translate(tipP.x, tipP.y);
  ctx.scale(1, 0.75);
  star(ctx, { x: 0, y: 0 }, Math.max(4, m * (0.09 + 0.025 * pulse)));
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ o fim

/**
 * Sem explosão: o espírito se desfaz no ar — o clarão, a espiral desenrolando para cima (com 3 pontos ou mais) e as
 * luzinhas abrindo (poucas com 1 ponto, mais a cada ponto).
 */
function dissolve(ctx: CanvasRenderingContext2D, end: SpiritEndLook, k: number, screen: Screen, m: number, S: SpiritLook): void {
  const c = screen(end.x, end.y, FLIGHT_Z);
  const g = screen(end.x, end.y, 0);
  const light = Math.min(1, S.glow);
  glowGround(ctx, g, m * 0.7, MINT, 0.3 * (1 - k) * light);
  glowCircle(ctx, c, m * (0.35 + 0.55 * k) * (0.7 + 0.3 * light), PALE, 0.95 * (1 - k) ** 1.5 * light);
  // a espiral desenrolando e subindo
  ctx.lineCap = 'round';
  let prev: Point | null = null;
  for (let i = 0; i <= 18 && S.strands > 0; i++) {
    const u = i / 18;
    const ang = u * TAU * 1.6 + k * 5;
    const rad = m * (0.06 + u * 0.22) * (0.6 + k * 0.8);
    const p = { x: c.x + Math.cos(ang) * rad, y: c.y + Math.sin(ang) * rad * 0.55 - k * m * 0.55 - u * m * 0.25 };
    if (prev) {
      ctx.strokeStyle = rgba(PALE, (1 - k) * (1 - u * 0.6) * 0.9);
      ctx.lineWidth = Math.max(1, m * 0.03 * (1 - u * 0.5));
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    prev = p;
  }
  // as luzinhas: abrem em volta e sobem
  for (let i = 0; i < S.endLights; i++) {
    const ang = hash(i + end.x * 3.1) * TAU;
    const dist = m * (0.25 + hash(i + 7) * 0.5) * easeOut(k);
    const p = { x: c.x + Math.cos(ang) * dist, y: c.y + Math.sin(ang) * dist * 0.5 - k * m * (0.3 + hash(i + 11) * 0.5) };
    ctx.fillStyle = rgba(PALE, (1 - k) * 0.95);
    star(ctx, p, Math.max(1.5, m * 0.05 * (1 - k * 0.5)), i);
  }
}

/**
 * Com 5 pontos: a explosão (`age` em ms, dura BURST_MS). A onda corre até o raio em ~0,3 s (o golpe continua seco) e
 * o resto demora: o clarão, a coluna de luz, o segundo pulso (o espírito "respira" de novo), os fios do espírito
 * subindo em espiral do meio e as luzinhas — o chão aceso dentro do raio apaga devagar, junto com tudo.
 */
function burst(ctx: CanvasRenderingContext2D, end: SpiritEndLook, age: number, screen: Screen, m: number): void {
  const k = clamp01(age / BURST_MS);
  const fade = 1 - k;
  const c = screen(end.x, end.y, FLIGHT_Z);
  const g = screen(end.x, end.y, 0);
  const grow = easeOut(clamp01(age / 320));
  const R = end.r * grow;
  // o chão aceso dentro do raio
  groundPath(ctx, end.x, end.y, R, screen);
  ctx.fillStyle = rgba(MINT, 0.26 * fade ** 0.8);
  ctx.fill();
  // os raios no chão, do meio para fora (apagam na primeira metade)
  const rays = 1 - clamp01(age / 700);
  ctx.lineCap = 'round';
  if (rays > 0) {
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * TAU + hash(i) * 0.3;
      const reach = R * (0.55 + 0.45 * hash(i + 5));
      const p0 = screen(end.x + Math.cos(ang) * reach * 0.2, end.y + Math.sin(ang) * reach * 0.2);
      const p1 = screen(end.x + Math.cos(ang) * reach, end.y + Math.sin(ang) * reach);
      ctx.strokeStyle = rgba(PALE, 0.7 * rays);
      ctx.lineWidth = Math.max(1.2, m * 0.035 * rays);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }
  // a onda: o anel que corre até o raio e fica lá apagando, e um segundo, menor, logo atrás
  const wave = 1 - clamp01((age - 120) / 950);
  if (wave > 0) {
    groundPath(ctx, end.x, end.y, R, screen);
    ctx.strokeStyle = rgba(PALE, 0.95 * wave);
    ctx.lineWidth = Math.max(2, m * 0.09 * (0.3 + 0.7 * wave));
    ctx.stroke();
  }
  const a2 = age - 140;
  if (a2 > 0 && a2 < 760) {
    const u = a2 / 760;
    groundPath(ctx, end.x, end.y, end.r * 0.72 * easeOut(Math.min(1, a2 / 360)), screen);
    ctx.strokeStyle = rgba(MINT, 0.7 * (1 - u));
    ctx.lineWidth = Math.max(1.5, m * 0.05);
    ctx.stroke();
  }
  // o segundo pulso: de dentro para fora de novo, mais fraco (o espírito respira)
  const a3 = age - 470;
  if (a3 > 0 && a3 < 560) {
    const u = a3 / 560;
    groundPath(ctx, end.x, end.y, end.r * (0.5 + 0.58 * easeOut(u)), screen);
    ctx.strokeStyle = rgba(PALE, 0.6 * (1 - u));
    ctx.lineWidth = Math.max(1.5, m * 0.06 * (1 - u * 0.6));
    ctx.stroke();
    glowGround(ctx, g, m * (0.5 + end.r * 0.5), MINT, 0.22 * Math.sin(Math.PI * u));
  }
  // a coluna de luz subindo do meio (sobe rápido e fica um pouco)
  const col = Math.min(1, age / 180) * (1 - clamp01((age - 320) / 560));
  if (col > 0) {
    const top = { x: g.x, y: g.y - m * 2.6 * Math.min(1, 0.4 + age / 300) };
    const width = m * 0.34 * (0.6 + 0.4 * col);
    const cg = ctx.createLinearGradient(g.x, g.y, top.x, top.y);
    cg.addColorStop(0, rgba(PALE, 0.75 * col));
    cg.addColorStop(1, rgba(MINT, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(g.x - width, g.y);
    ctx.lineTo(top.x - width * 0.3, top.y);
    ctx.lineTo(top.x + width * 0.3, top.y);
    ctx.lineTo(g.x + width, g.y);
    ctx.closePath();
    ctx.fill();
  }
  // os fios do espírito: três espirais subindo do meio e se desfazendo no alto
  const a4 = age - 220;
  if (a4 > 0) {
    const u = clamp01(a4 / (BURST_MS - 220));
    for (let strand = 0; strand < 3; strand++) {
      let prev: Point | null = null;
      for (let i = 0; i <= 16; i++) {
        const v = i / 16;
        const h = (0.2 + v * 2.3) * easeOut(Math.min(1, u * 1.6));
        const ang = strand * (TAU / 3) + v * 5.2 + u * 4;
        const rad = end.r * (0.18 + 0.32 * v) * (0.5 + 0.5 * u);
        const p = screen(end.x + Math.cos(ang) * rad, end.y + Math.sin(ang) * rad, h);
        if (prev) {
          ctx.strokeStyle = rgba(v < 0.5 ? PALE : MINT, (1 - u) * (1 - v * 0.7) * 0.8);
          ctx.lineWidth = Math.max(1, m * 0.035 * (1 - v * 0.6));
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        prev = p;
      }
    }
  }
  // o clarão do meio: forte no começo, depois a luz que fica e apaga devagar
  const flash = Math.min(1, age / 90) * (1 - clamp01((age - 90) / 430));
  glowCircle(ctx, c, m * (0.5 + 0.9 * Math.min(1, age / 520)), PALE, flash);
  glowCircle(ctx, c, m * (0.9 + 0.3 * k), MINT, 0.32 * fade ** 1.5);
  glowGround(ctx, g, m * (0.6 + end.r * 0.6), MINT, 0.45 * fade);
  // as luzinhas subindo de dentro do raio
  for (let i = 0; i < 18; i++) {
    const ang = hash(i * 1.7 + 2) * TAU;
    const rr = end.r * Math.sqrt(hash(i + 31)) * grow;
    const rise = k * (0.6 + hash(i + 13) * 1.6);
    const p = screen(end.x + Math.cos(ang) * rr, end.y + Math.sin(ang) * rr, 0.1 + rise);
    ctx.fillStyle = rgba(PALE, fade * 0.95);
    star(ctx, p, Math.max(1.5, m * 0.055 * (1 - k * 0.5)), i);
  }
}

/**
 * A marca do espírito no chão, onde a Flecha Ancestral parou ou explodiu (pedido do dono, 19/11: "um efeito no chão"):
 * o anel de luz com as pontinhas de runa, o anel de dentro girando devagar e a espiral no meio (o desenho da runa da
 * marca, deitado no chão); umas luzinhas soltando. Acende quando o efeito do fim vai apagando e some devagar até
 * SPIRIT_END_MS. Só luz somada (passa por cima de quem estiver em cima dela sem pintar ninguém).
 */
function groundMark(ctx: CanvasRenderingContext2D, end: SpiritEndLook, age: number, now: number, screen: Screen, m: number, scale = 1): void {
  const boom = end.r > 0;
  const from = boom ? BURST_MS * 0.35 : FADE_MS * 0.3;
  const on = clamp01((age - from) / 320) * clamp01((SPIRIT_END_MS - age) / MARK_OUT_MS);
  if (on <= 0.004) return;
  // (a marca cresce com os pontos: pequena e apagada com 1, um pouco maior com 4)
  const a = on * (0.86 + 0.14 * Math.sin(now / 260)) * Math.min(1, scale);
  const R = boom ? end.r : 0.42 * scale;
  const g = screen(end.x, end.y, 0);
  glowGround(ctx, g, m * R * 1.25, MINT, 0.16 * a);
  ctx.lineCap = 'round';
  // o anel de fora
  groundPath(ctx, end.x, end.y, R * 0.92, screen, 48);
  ctx.strokeStyle = rgba(MINT, 0.6 * a);
  ctx.lineWidth = Math.max(1.2, m * 0.028);
  ctx.stroke();
  // o anel de dentro, tracejado e girando devagar
  ctx.setLineDash([Math.max(2, m * 0.07), Math.max(2, m * 0.05)]);
  ctx.lineDashOffset = -now / 70;
  groundPath(ctx, end.x, end.y, R * 0.7, screen, 40);
  ctx.strokeStyle = rgba(PALE, 0.42 * a);
  ctx.lineWidth = Math.max(1, m * 0.018);
  ctx.stroke();
  ctx.setLineDash([]);
  // as pontinhas de runa entre os dois anéis (compridas e curtas, alternando)
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU + 0.2;
    const r0 = R * 0.75;
    const r1 = R * (i % 2 ? 0.83 : 0.89);
    const p0 = screen(end.x + Math.cos(ang) * r0, end.y + Math.sin(ang) * r0);
    const p1 = screen(end.x + Math.cos(ang) * r1, end.y + Math.sin(ang) * r1);
    ctx.strokeStyle = rgba(PALE, 0.62 * a);
    ctx.lineWidth = Math.max(1.1, m * 0.026);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  // a espiral no meio, deitada no chão (do tamanho da do selo pequeno; no círculo grande, com um anel em volta)
  const sr = boom ? Math.min(0.5, R * 0.2) : R * 0.5;
  if (boom) {
    groundPath(ctx, end.x, end.y, sr * 1.45, screen, 28);
    ctx.strokeStyle = rgba(MINT, 0.5 * a);
    ctx.lineWidth = Math.max(1, m * 0.02);
    ctx.stroke();
  }
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) {
    const u = i / 30;
    const ang = u * TAU * 1.75 + now / 1400;
    const p = screen(end.x + Math.cos(ang) * sr * u, end.y + Math.sin(ang) * sr * u);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = rgba(PALE, 0.75 * a);
  ctx.lineWidth = Math.max(1.3, m * 0.032);
  ctx.stroke();
  // as luzinhas soltando da marca (sobem um pouco e apagam)
  for (let j = 0; j < 5; j++) {
    const cycle = now / 1100 + j / 5;
    const u = cycle % 1;
    const seed = Math.floor(cycle) * 5 + j + end.x * 7.3;
    const ang = hash(seed) * TAU;
    const rr = R * (0.3 + 0.6 * hash(seed + 2));
    const p = screen(end.x + Math.cos(ang) * rr, end.y + Math.sin(ang) * rr, u * 0.7);
    ctx.fillStyle = rgba(PALE, (1 - u) * 0.8 * a);
    star(ctx, p, Math.max(1.3, m * 0.04 * (1 - u * 0.5)), hash(seed + 3) * 1.5);
  }
}

/** Onde a Flecha Ancestral parou: o espírito se desfaz (ou, com `r` > 0, explode). Desenhar enquanto durar. */
export function paintSpiritEnd(ctx: CanvasRenderingContext2D, end: SpiritEndLook, now: number, screen: Screen, meter: Meter): void {
  const age = now - end.start;
  if (age < 0) return;
  const m = meter(end.x, end.y);
  const lk = levelPower(end.level);
  const lt = levelStep(end.level);
  const S = spiritLook(end.rank, end.r > 0 ? 5 : 3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // a marca no chão primeiro (o efeito do fim passa por cima dela)
  groundMark(ctx, end, age, now, screen, m, S.mark);
  ctx.globalAlpha = 0.42 + 0.58 * lt;
  if (end.r > 0) {
    if (age < BURST_MS) burst(ctx, end, age, screen, m);
  } else {
    if (age < FADE_MS) dissolve(ctx, end, age / FADE_MS, screen, m, S);
    // com 4 pontos: o anel de luz que abre no chão onde ela parou
    if (S.ring) lightRing(ctx, end, age, screen, m, lk);
  }
  ctx.globalAlpha = 1;
  impactHit(ctx, end, age, screen, m, lk, S.power);
  ctx.restore();
}

/** Com 4 pontos: o anel de luz que abre no chão onde ela parou (com um segundo, verde, por dentro) e a poça de luz. */
function lightRing(ctx: CanvasRenderingContext2D, end: SpiritEndLook, age: number, screen: Screen, m: number, lk: number): void {
  const RING_MS = 760;
  if (age >= RING_MS) return;
  const k = age / RING_MS;
  const R = (0.3 + 1.25 * easeOut(k)) * (0.75 + 0.25 * lk);
  glowGround(ctx, screen(end.x, end.y, 0), m * (0.5 + R * 0.9), MINT, 0.32 * (1 - k));
  groundPath(ctx, end.x, end.y, R, screen, 40);
  ctx.strokeStyle = rgba(PALE, 0.9 * (1 - k));
  ctx.lineWidth = Math.max(1.5, m * 0.055 * (1 - k * 0.6));
  ctx.stroke();
  groundPath(ctx, end.x, end.y, R * 0.78, screen, 40);
  ctx.strokeStyle = rgba(MINT, 0.65 * (1 - k));
  ctx.lineWidth = Math.max(1, m * 0.03);
  ctx.stroke();
}

/**
 * A pancada de onde ela parou (22/11, o dono: "sensação de impactos também por nível"): nos primeiros instantes, um
 * clarão no meio e uma onda de choque rente ao chão, rápida — maiores e mais fortes quanto maior o degrau (no forte, uma
 * segunda onda e a terra que espirra).
 */
function impactHit(ctx: CanvasRenderingContext2D, end: SpiritEndLook, age: number, screen: Screen, m: number, lk: number, pw = 1): void {
  // (`pw`: a força pelos pontos — com 1 ponto a pancada é pequena; com 5, a inteira)
  const HIT_MS = 220 + 200 * lk * pw;
  if (age >= HIT_MS) return;
  const k = age / HIT_MS;
  const c = screen(end.x, end.y, FLIGHT_Z * (1 - k));
  // o clarão no meio (só no começo)
  const flash = 1 - clamp01(age / (90 + 70 * lk));
  if (flash > 0) glowCircle(ctx, c, m * (0.35 + 0.55 * lk) * (0.55 + 0.45 * pw) * (0.7 + 0.5 * (1 - flash)), PALE, 0.9 * flash * lk * (0.45 + 0.55 * pw));
  // a onda de choque no chão (abre rápido e apaga)
  const reach = (0.7 + 1.1 * lk) * (0.45 + 0.55 * pw) * easeOut(k);
  groundPath(ctx, end.x, end.y, reach, screen, 32);
  ctx.strokeStyle = rgba(PALE, 0.85 * (1 - k) * lk * (0.5 + 0.5 * pw));
  ctx.lineWidth = Math.max(1.5, m * 0.07 * (1 - k) * (0.6 + 0.4 * lk) * (0.6 + 0.4 * pw));
  ctx.stroke();
  if (lk >= 1 && pw >= 0.5) {
    // forte: a segunda onda, logo atrás, e a terra que espirra para os lados
    const k2 = clamp01((age - 70) / (HIT_MS - 70));
    if (k2 > 0 && k2 < 1) {
      groundPath(ctx, end.x, end.y, 1.5 * reach * easeOut(k2), screen, 32);
      ctx.strokeStyle = rgba(MINT, 0.6 * (1 - k2));
      ctx.lineWidth = Math.max(1.2, m * 0.04 * (1 - k2));
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    const dirt = Math.round(3 + 6 * pw);
    for (let i = 0; i < dirt; i++) {
      const ang = (i / dirt) * TAU + hash(i + 11) * 0.6;
      const d = (0.25 + 0.9 * hash(i + 3)) * easeOut(k);
      const h = Math.sin(Math.PI * clamp01(k * 1.2)) * (0.12 + 0.25 * hash(i + 7));
      const p = screen(end.x + Math.cos(ang) * d, end.y + Math.sin(ang) * d, h);
      ctx.fillStyle = `rgba(92, 70, 44, ${(0.8 * (1 - k)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.2, m * 0.028 * (1 - k * 0.5)), 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
  }
}

// ------------------------------------------------------------------------------------------------ a marca

/**
 * A runa do espírito em cima do bicho marcado (leva mais dano de todo mundo até `until`): o losango escuro com a borda
 * de luz e a espiral (o mesmo desenho do enfeite da barra, no verde do espírito), as quatro pontinhas, flutuando; e o
 * anel tracejado girando no pé. Pisca no último segundo.
 */
export function paintSpiritMark(ctx: CanvasRenderingContext2D, feet: Point, until: number, now: number, screen: Screen, meter: Meter): void {
  const left = until - now;
  if (left <= 0) return;
  const m = meter(feet.x, feet.y);
  const alpha = left < 1000 ? 0.4 + 0.5 * Math.abs(Math.sin(now / 90)) : 0.95;
  ctx.save();
  // o anel no pé (aparece até quando a cabeça está atrás de alguma coisa)
  ctx.setLineDash([Math.max(3, m * 0.1), Math.max(3, m * 0.07)]);
  ctx.lineDashOffset = -now / 50;
  groundPath(ctx, feet.x, feet.y, 0.48, screen, 28);
  ctx.lineWidth = Math.max(1.5, m * 0.035);
  ctx.strokeStyle = rgba(MINT, 0.7 * alpha);
  ctx.stroke();
  ctx.setLineDash([]);
  // a runa: flutua e pulsa
  const bob = Math.sin(now / 380) * m * 0.035;
  const p0 = screen(feet.x, feet.y, MARK_Z);
  const p = { x: p0.x, y: p0.y + bob };
  const s = Math.max(10, m * 0.26) * (1 + 0.05 * Math.sin(now / 140));
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  glowCircle(ctx, p, s * 2.1, MINT, 0.55);
  ctx.globalCompositeOperation = 'source-over';
  // o losango
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - s);
  ctx.lineTo(p.x + s * 0.82, p.y);
  ctx.lineTo(p.x, p.y + s);
  ctx.lineTo(p.x - s * 0.82, p.y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10, 38, 26, 0.85)';
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, s * 0.16);
  ctx.strokeStyle = rgba(PALE, 1);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(10, 38, 26, 0.9)';
  ctx.stroke();
  // a espiral de dentro (gira devagar)
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(now / 900);
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) {
    const u = i / 30;
    const ang = u * TAU * 1.75;
    const rad = s * 0.5 * u;
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.4, s * 0.14);
  ctx.strokeStyle = rgba(MINT, 1);
  ctx.shadowColor = rgba(MINT, 0.9);
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.restore();
  // as quatro pontinhas para fora (como as do enfeite da barra)
  ctx.fillStyle = rgba(PALE, 1);
  for (const [dx, dy] of [
    [0, -1.42],
    [1.18, 0],
    [0, 1.42],
    [-1.18, 0],
  ] as const) {
    ctx.beginPath();
    ctx.arc(p.x + dx * s, p.y + dy * s, Math.max(1.2, s * 0.1), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
