// ARQUIVO DA [ARTE]: o desenho da Chuva de Flechas no jogo 2.5D — a mira (segurando o Q), o círculo no chão, as
// flechas (ou as pedras, com o estilingue) subindo, caindo e cravadas — nas três fases de pontos:
//   1 e 2 = madeira  (flecha de madeira com ponta de pedra e penas brancas; poeira no impacto)
//   3 e 4 = ouro     (dourada e brilhando, com rastro; faíscas no impacto)
//   5     = espírito (verde-clara de luz, rastro comprido; clarão, anel largo e luzinhas subindo)
// O combate (combat.ts, da [estrutura]) guarda as chuvas e a mira e chama daqui a cada quadro:
//   drawRainAim(ctx, mira, agora, tela, pxPorMetro)      o círculo da mira e o arco do tiro (do pé até o meio)
//   drawRainGround(ctx, chuva, agora, tela, pxPorMetro)  no chão: o círculo de onde vai cair, o anel que fecha até o
//                                                        meio (quando chega, as flechas caem) e o impacto
//   drawRainAir(ctx, chuva, agora, tela, pxPorMetro)     no ar: subindo de quem atirou, caindo e cravadas no chão
//   RAIN_LINGER_MS                                       quanto tempo ficam cravadas (o combate guarda a chuva até lá)
// Posições em metros (as do combate); `tela(x, y, z)` dá o ponto na tela e `pxPorMetro(x, y)` quantos pixels tem 1 m
// de altura ali (o tamanho das coisas acompanha o zoom).

type Point = { x: number; y: number };
export type Screen = (x: number, y: number, z?: number) => Point;
export type Meter = (x: number, y: number) => number;

/** Uma flecha da chuva: onde cai (em volta do meio), o atraso (ms) e a inclinação. */
export interface RainSpot {
  dx: number;
  dy: number;
  delay: number;
  lean: number;
}

/** Uma Chuva de Flechas: de onde saiu, o círculo, os pontos da habilidade, flecha ou pedra e quando cai. */
export interface RainLook {
  from: Point;
  x: number;
  y: number;
  r: number;
  rank: number;
  kind: string;
  start: number;
  land: number;
  spots: RainSpot[];
}

/** A mira: do pé de quem atira até o círculo (x, y, r). */
export interface RainAimLook {
  from: Point;
  x: number;
  y: number;
  r: number;
}

/** Quanto tempo as flechas ficam cravadas no chão (as pedras quicam e somem no mesmo tempo). */
export const RAIN_LINGER_MS = 900;
/** Quanto tempo cada flecha leva caindo lá de cima. */
const RAIN_FALL_MS = 240;
/** A altura de onde caem (m). */
const RAIN_HEIGHT = 7;
/** Quanto dura o impacto no chão. */
const IMPACT_MS = 420;

type RGB = readonly [number, number, number];

interface Tier {
  /** A cor do círculo, do brilho e do impacto. */
  ring: RGB;
  /** O brilho em volta das flechas (0 = sem). */
  glow: number;
  shaft: string;
  outline: string;
  head: string;
  feather: string;
  featherTip: string;
  stone: string;
  stoneLight: string;
  /** Rastro atrás da flecha voando (0 = sem). */
  trail: number;
}

const WOOD: Tier = {
  ring: [241, 214, 150],
  glow: 0,
  shaft: '#b07a3e',
  outline: 'rgba(52, 30, 10, 0.85)',
  head: '#a3a8ad',
  feather: '#f4efe4',
  featherTip: '#c0392b',
  stone: '#8f8a80',
  stoneLight: '#d2ccbf',
  trail: 0,
};
const GOLD: Tier = {
  ring: [255, 196, 70],
  glow: 7,
  shaft: '#e8b84e',
  outline: 'rgba(90, 52, 8, 0.9)',
  head: '#fff2b0',
  feather: '#ffd23e',
  featherTip: '#fff8dc',
  stone: '#8d8577',
  stoneLight: '#e6dccb',
  trail: 0.45,
};
const SPIRIT: Tier = {
  ring: [140, 255, 190],
  glow: 12,
  shaft: '#dcffec',
  outline: 'rgba(30, 110, 72, 0.75)',
  head: '#ffffff',
  feather: '#8cffbe',
  featherTip: '#e8fff4',
  stone: '#7f8f88',
  stoneLight: '#e4fff2',
  trail: 0.75,
};
/** O dourado da HUD (a mira é igual para todo mundo). */
const HUD: RGB = [255, 210, 62];

/** A fase pelos pontos da habilidade. */
export function rainTier(rank: number): 'madeira' | 'ouro' | 'espirito' {
  return rank >= 5 ? 'espirito' : rank >= 3 ? 'ouro' : 'madeira';
}

function tierOf(rank: number): Tier {
  return rank >= 5 ? SPIRIT : rank >= 3 ? GOLD : WOOD;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function rgba(c: RGB, alpha: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${clamp01(alpha).toFixed(3)})`;
}

/** O círculo deitado no chão (o caminho; quem chama pinta). */
function groundPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, screen: Screen, n = 40): void {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = screen(x + Math.cos(a) * r, y + Math.sin(a) * r);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/** Estrelinha de 4 pontas (o meio da mira, as faíscas do ouro). */
function sparkle(ctx: CanvasRenderingContext2D, p: Point, size: number): void {
  const t = size * 0.28;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - size);
  ctx.quadraticCurveTo(p.x + t, p.y - t, p.x + size, p.y);
  ctx.quadraticCurveTo(p.x + t, p.y + t, p.x, p.y + size);
  ctx.quadraticCurveTo(p.x - t, p.y + t, p.x - size, p.y);
  ctx.quadraticCurveTo(p.x - t, p.y - t, p.x, p.y - size);
  ctx.closePath();
}

/** Uma flecha da cauda até a ponta: o contorno, a haste, a ponta e as penas. */
function arrow(ctx: CanvasRenderingContext2D, tail: Point, head: Point, tier: Tier, width: number): void {
  const a = Math.atan2(head.y - tail.y, head.x - tail.x);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  ctx.lineCap = 'round';
  // o contorno escuro por baixo (lê em qualquer chão)
  ctx.strokeStyle = tier.outline;
  ctx.lineWidth = width + 1.6;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();
  // a haste (com brilho no ouro e no espírito)
  if (tier.glow > 0) {
    ctx.shadowColor = rgba(tier.ring, 0.95);
    ctx.shadowBlur = tier.glow;
  }
  ctx.strokeStyle = tier.shaft;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // a ponta
  const size = width * 3.1;
  ctx.fillStyle = tier.head;
  ctx.strokeStyle = tier.outline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(head.x + ux * size * 0.75, head.y + uy * size * 0.75);
  ctx.lineTo(head.x + Math.cos(a + 2.45) * size * 0.62, head.y + Math.sin(a + 2.45) * size * 0.62);
  ctx.lineTo(head.x - ux * size * 0.12, head.y - uy * size * 0.12);
  ctx.lineTo(head.x + Math.cos(a - 2.45) * size * 0.62, head.y + Math.sin(a - 2.45) * size * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // as penas na cauda: duas aletas ao longo da haste, varridas para trás, com a pontinha colorida
  const fl = width * 3.4;
  const nx = -uy;
  const ny = ux;
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = tier.outline;
  for (const side of [-1, 1]) {
    const front = { x: tail.x + ux * fl, y: tail.y + uy * fl };
    const back = { x: tail.x + ux * fl * 0.08, y: tail.y + uy * fl * 0.08 };
    const out = width * 1.7 * side;
    const outFront = { x: front.x - ux * fl * 0.35 + nx * out * 0.7, y: front.y - uy * fl * 0.35 + ny * out * 0.7 };
    const outBack = { x: back.x - ux * width * 0.9 + nx * out, y: back.y - uy * width * 0.9 + ny * out };
    ctx.fillStyle = tier.feather;
    ctx.beginPath();
    ctx.moveTo(front.x, front.y);
    ctx.lineTo(outFront.x, outFront.y);
    ctx.lineTo(outBack.x, outBack.y);
    ctx.lineTo(back.x, back.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // a pontinha (a pena tingida)
    ctx.fillStyle = tier.featherTip;
    ctx.beginPath();
    ctx.moveTo(outBack.x, outBack.y);
    ctx.lineTo(back.x, back.y);
    ctx.lineTo(back.x + ux * fl * 0.3, back.y + uy * fl * 0.3);
    ctx.lineTo(outBack.x + (outFront.x - outBack.x) * 0.3, outBack.y + (outFront.y - outBack.y) * 0.3);
    ctx.closePath();
    ctx.fill();
  }
}

/** O rastro atrás do que voa (ouro e espírito): uma faixa que some, de `from` (longe) até `to`. */
function trail(ctx: CanvasRenderingContext2D, from: Point, to: Point, tier: Tier, width: number, alpha: number): void {
  if (tier.trail <= 0) return;
  const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  g.addColorStop(0, rgba(tier.ring, 0));
  g.addColorStop(1, rgba(tier.ring, tier.trail * alpha));
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.lineWidth = width * 2.2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

/**
 * Uma pedra do estilingue: sempre pedra (cinza, clara em cima, com contorno), para não parecer moeda; a fase aparece no
 * brilho em volta (dourado no ouro, verde no espírito).
 */
function stone(ctx: CanvasRenderingContext2D, p: Point, radius: number, tier: Tier): void {
  if (tier.glow > 0) {
    const halo = ctx.createRadialGradient(p.x, p.y, radius * 0.6, p.x, p.y, radius * 2.3);
    halo.addColorStop(0, rgba(tier.ring, 0.75));
    halo.addColorStop(1, rgba(tier.ring, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(p.x - radius * 0.35, p.y - radius * 0.4, radius * 0.1, p.x, p.y, radius);
  g.addColorStop(0, tier.stoneLight);
  g.addColorStop(1, tier.stone);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, radius, radius * 0.86, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 34, 28, 0.9)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** O risco de velocidade atrás da pedra (em todas as fases; no ouro e no espírito, na cor do brilho). */
function streak(ctx: CanvasRenderingContext2D, from: Point, to: Point, tier: Tier, width: number, alpha: number): void {
  const color: RGB = tier.glow > 0 ? tier.ring : [235, 228, 210];
  const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, 0.55 * alpha));
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

/** A mira da Chuva (segurando o Q): o arco pontilhado do pé até o meio e o círculo dourado da HUD, com os dentes girando. */
export function drawRainAim(ctx: CanvasRenderingContext2D, aim: RainAimLook, now: number, screen: Screen, meter: Meter): void {
  const m = meter(aim.x, aim.y);
  ctx.save();
  // o arco do tiro: sobe do herói e cai no meio do círculo (os pontinhos andam para lá)
  const dist = Math.hypot(aim.x - aim.from.x, aim.y - aim.from.y);
  const peak = 1 + dist * 0.18;
  const n = Math.max(8, Math.min(30, Math.round(dist * 2.2)));
  const dot = Math.max(2, m * 0.04);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(40, 22, 4, 0.6)';
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const z = 1.2 * (1 - t) + 4 * peak * t * (1 - t);
    const p = screen(aim.from.x + (aim.x - aim.from.x) * t, aim.from.y + (aim.y - aim.from.y) * t, z);
    const pulse = 0.5 + 0.5 * Math.sin(t * 14 - now / 110);
    ctx.fillStyle = rgba(HUD, 0.5 + 0.45 * pulse);
    ctx.beginPath();
    ctx.arc(p.x, p.y, dot * (0.75 + 0.35 * pulse), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // o círculo: o miolo claro, o anel escuro por baixo e o dourado por cima
  groundPath(ctx, aim.x, aim.y, aim.r, screen);
  ctx.fillStyle = rgba(HUD, 0.1);
  ctx.fill();
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = 'rgba(24, 14, 4, 0.55)';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(HUD, 0.95);
  ctx.stroke();
  // o anel de dentro, tracejado, girando
  ctx.setLineDash([Math.max(4, m * 0.14), Math.max(4, m * 0.11)]);
  ctx.lineDashOffset = -now / 40;
  groundPath(ctx, aim.x, aim.y, aim.r * 0.66, screen);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(HUD, 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  // os dentes (8, apontando para dentro), girando devagar
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + now / 2600;
    const tip = screen(aim.x + Math.cos(a) * aim.r * 0.84, aim.y + Math.sin(a) * aim.r * 0.84);
    const l = screen(aim.x + Math.cos(a - 0.07) * aim.r, aim.y + Math.sin(a - 0.07) * aim.r);
    const r = screen(aim.x + Math.cos(a + 0.07) * aim.r, aim.y + Math.sin(a + 0.07) * aim.r);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(l.x, l.y);
    ctx.lineTo(r.x, r.y);
    ctx.closePath();
    ctx.fillStyle = rgba(HUD, 0.95);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(40, 22, 4, 0.7)';
    ctx.stroke();
  }
  // o meio: a estrelinha
  const c = screen(aim.x, aim.y);
  sparkle(ctx, c, Math.max(5, m * 0.13));
  ctx.fillStyle = rgba(HUD, 0.95);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(40, 22, 4, 0.7)';
  ctx.stroke();
  ctx.restore();
}

/** No chão: o círculo de onde a chuva vai cair (mais forte até cair), o anel que fecha até o meio e o impacto. */
export function drawRainGround(ctx: CanvasRenderingContext2D, rain: RainLook, now: number, screen: Screen, meter: Meter): void {
  const tier = tierOf(rain.rank);
  const m = meter(rain.x, rain.y);
  const total = Math.max(1, rain.land - rain.start);
  const progress = clamp01((now - rain.start) / total);
  const fade = now > rain.land ? Math.max(0, 1 - (now - rain.land) / 300) : 1;
  ctx.save();
  if (fade > 0) {
    groundPath(ctx, rain.x, rain.y, rain.r, screen);
    ctx.fillStyle = rgba(tier.ring, (0.06 + 0.16 * progress) * fade);
    ctx.fill();
    ctx.lineWidth = 5.5;
    ctx.strokeStyle = `rgba(24, 14, 4, ${(0.4 * fade).toFixed(3)})`;
    ctx.stroke();
    if (tier.glow > 0) {
      ctx.shadowColor = rgba(tier.ring, 0.9);
      ctx.shadowBlur = tier.glow;
    }
    ctx.lineWidth = rain.rank >= 3 ? 3 : 2.5;
    ctx.strokeStyle = rgba(tier.ring, (0.6 + 0.4 * progress) * fade);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // o anel que fecha até o meio: quando chega, as flechas caem
    if (now < rain.land) {
      groundPath(ctx, rain.x, rain.y, rain.r * (1 - progress), screen);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(tier.ring, 0.25 + 0.5 * progress);
      ctx.stroke();
    }
    // com 5 pontos: as marcas do espírito girando na borda
    if (rain.rank >= 5) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(tier.ring, 0.8 * fade);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 - now / 1800;
        const p = screen(rain.x + Math.cos(a) * rain.r * 0.9, rain.y + Math.sin(a) * rain.r * 0.9);
        const q = screen(rain.x + Math.cos(a + 0.12) * rain.r * 0.9, rain.y + Math.sin(a + 0.12) * rain.r * 0.9);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }
  }
  // o impacto
  const since = now - rain.land;
  if (since >= 0 && since < IMPACT_MS) {
    const k = since / IMPACT_MS;
    const out = 1 - k;
    const grow = rain.rank >= 5 ? 0.38 : rain.rank >= 3 ? 0.24 : 0.16;
    if (rain.rank >= 5) {
      // o clarão verde
      groundPath(ctx, rain.x, rain.y, rain.r * (1 + k * grow), screen);
      ctx.fillStyle = rgba(tier.ring, 0.32 * out);
      ctx.fill();
    }
    groundPath(ctx, rain.x, rain.y, rain.r * (1 + k * grow), screen);
    if (tier.glow > 0) {
      ctx.shadowColor = rgba(tier.ring, 0.9);
      ctx.shadowBlur = tier.glow;
    }
    ctx.lineWidth = rain.rank >= 5 ? 4 : rain.rank >= 3 ? 3 : 2.5;
    ctx.strokeStyle = rgba(tier.ring, 0.85 * out);
    ctx.stroke();
    ctx.shadowBlur = 0;
    const shown = Math.min(rain.spots.length, 14);
    for (let i = 0; i < shown; i++) {
      const spot = rain.spots[i]!;
      const local = clamp01((since - spot.delay) / IMPACT_MS);
      if (local <= 0 || local >= 1) continue;
      const lo = 1 - local;
      const gx = rain.x + spot.dx;
      const gy = rain.y + spot.dy;
      if (rain.rank >= 5) {
        // luzinhas do espírito subindo de onde cravou
        const p = screen(gx + spot.lean * 0.2 * local, gy, 0.15 + local * 1.3);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, m * 0.12);
        g.addColorStop(0, `rgba(235, 255, 245, ${(0.9 * lo).toFixed(3)})`);
        g.addColorStop(1, rgba(tier.ring, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, m * 0.12, 0, Math.PI * 2);
        ctx.fill();
      } else if (rain.rank >= 3) {
        // faíscas douradas
        const p = screen(gx, gy, 0.12 + local * 0.35);
        sparkle(ctx, p, Math.max(3, m * 0.09) * Math.sin(local * Math.PI));
        ctx.fillStyle = `rgba(255, 246, 200, ${(0.95 * lo).toFixed(3)})`;
        ctx.fill();
      } else {
        // poeira de terra (duas nuvenzinhas)
        for (const side of [-1, 1]) {
          const p = screen(gx + side * 0.08 * local, gy - side * 0.05 * local, 0.06 + local * 0.18);
          ctx.fillStyle = `rgba(168, 138, 96, ${(0.55 * lo).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, m * (0.08 + 0.2 * local), m * (0.05 + 0.12 * local), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();
}

/** No ar: subindo de quem atirou, caindo no círculo (com a sombra crescendo no chão) e cravadas no chão. */
export function drawRainAir(ctx: CanvasRenderingContext2D, rain: RainLook, now: number, screen: Screen, meter: Meter): void {
  const tier = tierOf(rain.rank);
  const total = Math.max(1, rain.land - rain.start);
  const rise = Math.max(160, total * 0.5);
  const isStone = rain.kind === 'pedra';
  const m = meter(rain.x, rain.y);
  const width = Math.max(1.8, m * 0.04);
  const stoneSize = Math.max(4.5, m * 0.1);
  ctx.save();
  rain.spots.forEach((spot, i) => {
    // subindo: saem uma atrás da outra de quem atirou
    const k = (now - rain.start - i * 14) / rise;
    if (k >= 0 && k <= 1) {
      const sx = rain.from.x + spot.dx * 0.12;
      const sy = rain.from.y + spot.dy * 0.12;
      const z = 1.1 + k * RAIN_HEIGHT;
      ctx.globalAlpha = 1 - k * 0.35;
      if (isStone) {
        streak(ctx, screen(sx, sy, z - 1.2), screen(sx, sy, z), tier, stoneSize * 1.3, 1);
        stone(ctx, screen(sx, sy, z), stoneSize, tier);
      } else {
        trail(ctx, screen(sx, sy, z - 1.4), screen(sx, sy, z), tier, width, 1);
        arrow(ctx, screen(sx, sy, z), screen(sx, sy, z + 0.8), tier, width);
      }
      ctx.globalAlpha = 1;
    }
    // caindo no círculo e, depois, cravadas no chão
    const landAt = rain.land + spot.delay;
    const gx = rain.x + spot.dx;
    const gy = rain.y + spot.dy;
    if (now >= landAt - RAIN_FALL_MS && now < landAt) {
      const fall = 1 - (landAt - now) / RAIN_FALL_MS;
      const z = RAIN_HEIGHT * (1 - fall);
      // a sombra no chão cresce conforme ela chega (mostra onde vai cair)
      const shadow = screen(gx, gy, 0);
      ctx.fillStyle = `rgba(0, 0, 0, ${(0.12 + 0.25 * fall).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, m * (0.06 + 0.08 * fall), m * (0.025 + 0.035 * fall), 0, 0, Math.PI * 2);
      ctx.fill();
      const tailX = gx + spot.lean * 0.25;
      if (isStone) {
        streak(ctx, screen(gx + spot.lean * 0.2, gy, z + 1.5), screen(gx, gy, z), tier, stoneSize * 1.3, 0.6 + 0.4 * fall);
        stone(ctx, screen(gx, gy, z), stoneSize, tier);
      } else {
        trail(ctx, screen(tailX + spot.lean * 0.3, gy, z + 0.85 + 1.6), screen(tailX, gy, z + 0.85), tier, width, fall);
        arrow(ctx, screen(tailX, gy, z + 0.85), screen(gx, gy, z), tier, width);
      }
    } else if (now >= landAt && now < landAt + RAIN_LINGER_MS) {
      const life = 1 - (now - landAt) / RAIN_LINGER_MS;
      ctx.globalAlpha = rain.rank >= 5 ? life * life : life;
      if (isStone) {
        const p = screen(gx, gy, Math.max(0, 0.25 * Math.sin(Math.min(1, (now - landAt) / 250) * Math.PI)));
        stone(ctx, p, stoneSize * 0.9, tier);
      } else {
        // cravada: o montinho de terra na base e a flecha inclinada
        const base = screen(gx, gy, 0);
        ctx.fillStyle = 'rgba(70, 48, 26, 0.55)';
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, m * 0.07, m * 0.03, 0, 0, Math.PI * 2);
        ctx.fill();
        arrow(ctx, screen(gx + spot.lean * 0.18, gy, 0.42), screen(gx, gy, 0.02), tier, width);
      }
      ctx.globalAlpha = 1;
    }
  });
  ctx.restore();
}
