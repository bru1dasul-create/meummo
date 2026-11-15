// ARQUIVO DA [ARTE]: o desenho da Flecha Ancestral no jogo 2.5D — o espírito verde-claro, como a fase 5 da Chuva:
//   drawSpiritArrow(ctx, noAr, sombra, aFrente, pxPorMetro, agora)   a flecha voando (o drawProjectile chama daqui):
//                                        a flecha de luz, o rastro, a espiral do espírito enrolando e as luzinhas
//   paintSpiritAim(ctx, mira, agora, tela, pxPorMetro)     a mira (segurando o R): a faixa dourada do chão, do pé até o
//                                        fim do alcance, com as setas andando para a frente e o fio verde no meio
//   paintSpiritEnd(ctx, fim, agora, tela, pxPorMetro)      onde ela parou: o espírito se desfaz em luzinhas subindo; com
//                                        5 pontos (`r` > 0), explode: o clarão, a onda no chão até o raio e os raios
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
}

/** Quanto o fim fica na tela: a explosão (o desfazer sem explosão acaba antes, em FADE_MS). */
export const SPIRIT_END_MS = 720;
const FADE_MS = 560;
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
export function drawSpiritArrow(ctx: CanvasRenderingContext2D, at: Point, shadow: Point, ahead: Point, m: number, now: number): void {
  const dx = ahead.x - at.x;
  const dy = ahead.y - at.y;
  const d = Math.hypot(dx, dy);
  const ux = d > 0.01 ? dx / d : 1;
  const uy = d > 0.01 ? dy / d : 0;
  const nx = -uy;
  const ny = ux;
  // px por metro do caminho (voando para a câmera, o caminho encurta na tela)
  const per = d > 0.01 ? d / 0.3 : m;
  const L = Math.max(22, m * 1.08);
  const tip = { x: at.x + ux * L * 0.5, y: at.y + uy * L * 0.5 };
  const tail = { x: at.x - ux * L * 0.5, y: at.y - uy * L * 0.5 };
  const w = Math.max(3.5, m * 0.13);
  const a = Math.atan2(uy, ux);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 1) a luz que ela joga no chão, embaixo
  glowGround(ctx, shadow, m * 0.8, MINT, 0.26);
  // 2) o rastro: a fita de luz que afina para trás (uns 2,4 m), com o miolo mais claro
  const back = Math.min(per * 2.4, m * 4.2);
  const end = { x: at.x - ux * back, y: at.y - uy * back };
  for (const [width, c, alpha] of [
    [w, MINT, 0.5],
    [w * 0.42, PALE, 0.75],
  ] as const) {
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
  // 3) a espiral do espírito: dois fios enrolando no rastro, girando (o que passa na frente brilha mais)
  const spiralLen = Math.min(per * 1.8, m * 3.2);
  ctx.lineCap = 'round';
  for (let strand = 0; strand < 2; strand++) {
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
  // 4) as luzinhas que ela vai largando para trás (sobem um pouco e apagam)
  const shed = Math.min(per * 2.2, m * 3.8);
  for (let j = 0; j < 8; j++) {
    const cycle = now / 460 + j / 8;
    const k = cycle % 1;
    const seed = Math.floor(cycle) * 8 + j;
    const side = (hash(seed) - 0.5) * 2 * w * (0.6 + k * 1.4);
    const p = { x: at.x - ux * k * shed + nx * side, y: at.y - uy * k * shed + ny * side - k * m * 0.18 };
    ctx.fillStyle = rgba(PALE, (1 - k) * 0.9);
    star(ctx, p, Math.max(1.6, m * 0.05 * (1 - k * 0.6)), hash(seed + 3) * 1.5);
  }
  // 5) a flecha de luz, com o brilho em volta
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = rgba(MINT, 0.95);
  ctx.shadowBlur = Math.max(6, m * 0.22);
  spiritBody(ctx, tail, tip, m);
  ctx.shadowBlur = 0;
  // 6) o clarão na ponta, com a estrelinha girando
  ctx.globalCompositeOperation = 'lighter';
  glowCircle(ctx, tip, m * 0.3, PALE, 0.7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  star(ctx, tip, Math.max(4, m * 0.15), now / 260);
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

/** Sem explosão: o espírito se desfaz no ar — o clarão, a espiral desenrolando para cima e as luzinhas abrindo. */
function dissolve(ctx: CanvasRenderingContext2D, end: SpiritEndLook, k: number, screen: Screen, m: number): void {
  const c = screen(end.x, end.y, FLIGHT_Z);
  const g = screen(end.x, end.y, 0);
  glowGround(ctx, g, m * 0.7, MINT, 0.3 * (1 - k));
  glowCircle(ctx, c, m * (0.35 + 0.55 * k), PALE, 0.95 * (1 - k) ** 1.5);
  // a espiral desenrolando e subindo
  ctx.lineCap = 'round';
  let prev: Point | null = null;
  for (let i = 0; i <= 18; i++) {
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
  for (let i = 0; i < 10; i++) {
    const ang = hash(i + end.x * 3.1) * TAU;
    const dist = m * (0.25 + hash(i + 7) * 0.5) * easeOut(k);
    const p = { x: c.x + Math.cos(ang) * dist, y: c.y + Math.sin(ang) * dist * 0.5 - k * m * (0.3 + hash(i + 11) * 0.5) };
    ctx.fillStyle = rgba(PALE, (1 - k) * 0.95);
    star(ctx, p, Math.max(1.5, m * 0.05 * (1 - k * 0.5)), i);
  }
}

/** Com 5 pontos: a explosão — o clarão, a onda que corre no chão até o raio, os raios, a coluna de luz e as luzinhas. */
function burst(ctx: CanvasRenderingContext2D, end: SpiritEndLook, k: number, screen: Screen, m: number): void {
  const c = screen(end.x, end.y, FLIGHT_Z);
  const g = screen(end.x, end.y, 0);
  const grow = easeOut(Math.min(1, k * 2.4));
  const R = end.r * grow;
  // o chão aceso dentro do raio
  groundPath(ctx, end.x, end.y, R, screen);
  ctx.fillStyle = rgba(MINT, 0.24 * (1 - k));
  ctx.fill();
  // os raios no chão, do meio para fora
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * TAU + hash(i) * 0.3;
    const reach = R * (0.55 + 0.45 * hash(i + 5));
    const p0 = screen(end.x + Math.cos(ang) * reach * 0.2, end.y + Math.sin(ang) * reach * 0.2);
    const p1 = screen(end.x + Math.cos(ang) * reach, end.y + Math.sin(ang) * reach);
    ctx.strokeStyle = rgba(PALE, 0.7 * (1 - k));
    ctx.lineWidth = Math.max(1.2, m * 0.035 * (1 - k));
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  // a onda: o anel que corre até o raio, e um segundo, menor, logo atrás
  groundPath(ctx, end.x, end.y, R, screen);
  ctx.strokeStyle = rgba(PALE, 0.95 * (1 - k));
  ctx.lineWidth = Math.max(2, m * 0.09 * (1 - k * 0.7));
  ctx.stroke();
  const k2 = clamp01((k - 0.14) / 0.86);
  if (k2 > 0) {
    groundPath(ctx, end.x, end.y, end.r * 0.72 * easeOut(Math.min(1, k2 * 2.2)), screen);
    ctx.strokeStyle = rgba(MINT, 0.7 * (1 - k2));
    ctx.lineWidth = Math.max(1.5, m * 0.05);
    ctx.stroke();
  }
  // a coluna de luz subindo do meio (curta, some logo)
  const col = clamp01(1 - k * 1.8);
  if (col > 0) {
    const top = { x: g.x, y: g.y - m * 2.6 };
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
  // o clarão do meio
  glowCircle(ctx, c, m * (0.5 + 0.9 * k), PALE, (1 - k) ** 1.3);
  glowGround(ctx, g, m * (0.6 + end.r * 0.6), MINT, 0.45 * (1 - k));
  // as luzinhas subindo de dentro do raio
  for (let i = 0; i < 16; i++) {
    const ang = hash(i * 1.7 + 2) * TAU;
    const rr = end.r * Math.sqrt(hash(i + 31)) * grow;
    const rise = k * (0.6 + hash(i + 13) * 1.4);
    const p = screen(end.x + Math.cos(ang) * rr, end.y + Math.sin(ang) * rr, 0.1 + rise);
    ctx.fillStyle = rgba(PALE, (1 - k) * 0.95);
    star(ctx, p, Math.max(1.5, m * 0.055 * (1 - k * 0.5)), i);
  }
}

/** Onde a Flecha Ancestral parou: o espírito se desfaz (ou, com `r` > 0, explode). Desenhar enquanto durar. */
export function paintSpiritEnd(ctx: CanvasRenderingContext2D, end: SpiritEndLook, now: number, screen: Screen, meter: Meter): void {
  const age = now - end.start;
  if (age < 0) return;
  const m = meter(end.x, end.y);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (end.r > 0) {
    if (age < SPIRIT_END_MS) burst(ctx, end, age / SPIRIT_END_MS, screen, m);
  } else if (age < FADE_MS) dissolve(ctx, end, age / FADE_MS, screen, m);
  ctx.restore();
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
