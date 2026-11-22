// ARQUIVO DA [ARTE]: o desenho da Chuva de Flechas no jogo 2.5D — a mira (segurando o Q), o círculo no chão, as
// flechas (ou as pedras, com o estilingue) subindo, caindo e cravadas — com uma cara para cada ponto da habilidade
// (22/11, o dono: "nível 1 é feio e fraco, nível 2 melhora, nível 3 muda e por aí vai" e "sensação de impactos também
// por nível" — o impacto cresce com os pontos e com o degrau da puxada):
//   1 = madeira crua (galho mal lascado, ponta de pedra bruta, penas sem cor; um pouco de poeira)
//   2 = madeira      (haste lixada, ponta de pedra polida, penas brancas com a ponta vermelha; poeira e lascas)
//   3 = ouro         (dourada e brilhando, com rastro; faíscas no impacto)
//   4 = brasa        (dourada em brasa, rastro de fogo soltando brasas, o círculo do chão em brasa; fogo e chão
//                     queimado no impacto)
//   5 = espírito     (verde-clara de luz, rastro comprido; clarão, anel largo e luzinhas subindo)
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
  /** O degrau da puxada (1 fraco, 2 médio, 3 forte): o rastro e o impacto crescem com ele. Sem ele, o completo. */
  level?: number;
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
export const RAIN_LINGER_MS = 2200;
/** Quanto tempo cada flecha leva caindo lá de cima. */
const RAIN_FALL_MS = 240;
/** A altura de onde caem (m). */
const RAIN_HEIGHT = 7;
/** Quanto dura o impacto no chão. */
const IMPACT_MS = 560;
/**
 * De onde saem e para onde vão (22/11, o dono: "o boneco não consegue mirar mais alto, acaba saindo as flechas da
 * cabeça do personagem; acerta para sair do arco"): medido na pose da Chuva no protótipo (slingshot.js, puxada cheia
 * mirando para o alto), em metros a partir do pé — à frente (para o alvo), de lado e a altura — da ponta da flecha no
 * arco e do garfo do estilingue. Os dois apontam uns 50° para o alto, para o lado do alvo.
 */
const LAUNCH = { flecha: { ahead: 0.49, side: -0.01, z: 2.19 }, pedra: { ahead: -0.05, side: 0.07, z: 2.0 } };
const LAUNCH_PITCH = (50 * Math.PI) / 180;
/** Quanto andam subindo até sumir lá no alto (m). */
const LAUNCH_TRAVEL = 8.5;
/** O comprimento da flecha voando (m). */
const ARROW_LEN = 0.8;

type RGB = readonly [number, number, number];

interface Tier {
  /** A cor do círculo, do brilho e do impacto. */
  ring: RGB;
  /** A força do impacto (o clarão, as ondas e os riscos da pancada), de 0 (a crua) a 1 (o espírito). */
  power: number;
  /** O que sobe de onde cada flecha crava. */
  hit: 'poeira' | 'lascas' | 'faiscas' | 'brasas' | 'luz';
  /** A grossura da borda do círculo no chão (px). */
  edge: number;
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

const RAW: Tier = {
  ring: [206, 190, 158],
  power: 0,
  hit: 'poeira',
  edge: 1.8,
  glow: 0,
  shaft: '#97805f',
  outline: 'rgba(48, 34, 20, 0.85)',
  head: '#6e6a63',
  feather: '#a89a84',
  featherTip: '#8f8169',
  stone: '#837d73',
  stoneLight: '#b5ad9f',
  trail: 0,
};
const WOOD: Tier = {
  ring: [241, 214, 150],
  power: 0.32,
  hit: 'lascas',
  edge: 2.5,
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
  power: 0.6,
  hit: 'faiscas',
  edge: 3,
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
const EMBER: Tier = {
  ring: [255, 136, 44],
  power: 0.8,
  hit: 'brasas',
  edge: 3.2,
  glow: 10,
  shaft: '#f2a444',
  outline: 'rgba(104, 34, 6, 0.9)',
  head: '#fff1c4',
  feather: '#ff7426',
  featherTip: '#ffe27a',
  stone: '#7b6a5b',
  stoneLight: '#ffc58a',
  trail: 0.62,
};
const SPIRIT: Tier = {
  ring: [140, 255, 190],
  power: 1,
  hit: 'luz',
  edge: 4,
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

/** O quanto o degrau da puxada acende a chuva (fraco ~0,6, médio ~0,8, forte 1; sem degrau, o completo). */
function levelPower(level: number | undefined): number {
  return level === 1 ? 0.62 : level === 2 ? 0.82 : 1;
}

const TIERS: readonly Tier[] = [RAW, RAW, WOOD, GOLD, EMBER, SPIRIT];
const TIER_NAMES = ['crua', 'crua', 'madeira', 'ouro', 'brasa', 'espirito'] as const;

/** A cara da chuva pelos pontos da habilidade (1 a 5). */
export function rainTier(rank: number): (typeof TIER_NAMES)[number] {
  return TIER_NAMES[rankOf(rank)]!;
}

function rankOf(rank: number): number {
  return Math.max(1, Math.min(5, Math.round(rank) || 1));
}

function tierOf(rank: number): Tier {
  return TIERS[rankOf(rank)]!;
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
  // o arco do tiro: sai da ponta da flecha no arco (onde as flechas saem — antes saía da barriga) e cai no meio do
  // círculo (os pontinhos andam para lá); começa subindo uns 50°, como o arco aponta
  const dist = Math.hypot(aim.x - aim.from.x, aim.y - aim.from.y);
  const ax = dist > 0.01 ? (aim.x - aim.from.x) / dist : 1;
  const ay = dist > 0.01 ? (aim.y - aim.from.y) / dist : 0;
  const L = LAUNCH.flecha;
  const sx = aim.from.x + ax * L.ahead - ay * L.side;
  const sy = aim.from.y + ay * L.ahead + ax * L.side;
  const peak = 1 + dist * 0.18;
  const n = Math.max(8, Math.min(30, Math.round(dist * 2.2)));
  const dot = Math.max(2, m * 0.04);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(40, 22, 4, 0.6)';
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const z = L.z * (1 - t) + 4 * peak * t * (1 - t);
    const p = screen(sx + (aim.x - sx) * t, sy + (aim.y - sy) * t, z);
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
    ctx.lineWidth = tier.edge;
    ctx.strokeStyle = rgba(tier.ring, (0.6 + 0.4 * progress) * fade);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // com 4 pontos: a borda em brasa (pontinhos de fogo piscando em volta do círculo)
    if (tier.hit === 'brasas') {
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2 + k * 0.53;
        const flick = 0.5 + 0.5 * Math.sin(now / (70 + (k % 5) * 23) + k * 1.7);
        const p = screen(rain.x + Math.cos(a) * rain.r, rain.y + Math.sin(a) * rain.r, 0.04 + 0.12 * flick * progress);
        const r = Math.max(1.4, m * (0.022 + 0.02 * flick));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.6);
        g.addColorStop(0, `rgba(255, 236, 170, ${(0.95 * fade * (0.5 + 0.5 * flick)).toFixed(3)})`);
        g.addColorStop(0.4, rgba(tier.ring, 0.6 * fade * flick));
        g.addColorStop(1, rgba(tier.ring, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // o anel que fecha até o meio: quando chega, as flechas caem
    if (now < rain.land) {
      groundPath(ctx, rain.x, rain.y, rain.r * (1 - progress), screen);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(tier.ring, 0.25 + 0.5 * progress);
      ctx.stroke();
    }
    // com 5 pontos: as marcas do espírito girando na borda
    if (tier.hit === 'luz') {
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
  // o impacto (22/11, o dono: "sensação de impactos também por nível" — no fraco ele é menor e mais apagado, no forte
  // vem a pancada: o clarão no meio, a onda de choque rápida e a terra espirrando)
  const since = now - rain.land;
  const lk = levelPower(rain.level);
  if (since >= 0 && since < IMPACT_MS) {
    const k = since / IMPACT_MS;
    const out = (1 - k) * (0.45 + 0.55 * (lk - 0.62) / 0.38);
    const grow = (0.12 + 0.32 * tier.power) * (0.7 + 0.3 * lk);
    // mais ênfase (pedido do dono, 15/11): o clarão no chão em todas as fases (mais forte no espírito), os riscos da
    // pancada saindo do meio e uma segunda onda, mais larga, logo atrás da primeira
    groundPath(ctx, rain.x, rain.y, rain.r * (1 + k * grow), screen);
    ctx.fillStyle = rgba(tier.ring, (0.12 + 0.28 * tier.power) * out * out);
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, m * 0.035);
    const rays = Math.round((4 + 10 * tier.power) * (0.6 + 0.4 * lk));
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + i * 0.37;
      const r0 = rain.r * (0.25 + 0.75 * k);
      const r1 = rain.r * (0.5 + 0.8 * k);
      const p0 = screen(rain.x + Math.cos(a) * r0, rain.y + Math.sin(a) * r0);
      const p1 = screen(rain.x + Math.cos(a) * r1, rain.y + Math.sin(a) * r1);
      ctx.strokeStyle = rgba(tier.ring, 0.7 * out);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    if (k > 0.12 && lk > 0.7 && tier.power > 0.25) {
      const k2 = (k - 0.12) / 0.88;
      groundPath(ctx, rain.x, rain.y, rain.r * (1 + k2 * grow * 2.1), screen);
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(tier.ring, 0.5 * (1 - k2));
      ctx.stroke();
    }
    groundPath(ctx, rain.x, rain.y, rain.r * (1 + k * grow), screen);
    if (tier.glow > 0) {
      ctx.shadowColor = rgba(tier.ring, 0.9);
      ctx.shadowBlur = tier.glow;
    }
    ctx.lineWidth = tier.edge + 0.5;
    ctx.strokeStyle = rgba(tier.ring, 0.85 * out);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (lk >= 1) slam(ctx, rain, since, tier, screen, m);
    // com 4 pontos, o chão pega fogo onde a chuva caiu: um anel de chamas baixas abrindo
    if (tier.hit === 'brasas') flameRing(ctx, rain, since, tier, screen, m, lk);
    const shown = Math.min(rain.spots.length, 14);
    for (let i = 0; i < shown; i++) {
      const spot = rain.spots[i]!;
      const local = clamp01((since - spot.delay) / IMPACT_MS);
      if (local <= 0 || local >= 1) continue;
      const lo = 1 - local;
      const gx = rain.x + spot.dx;
      const gy = rain.y + spot.dy;
      if (tier.hit === 'luz') {
        // luzinhas do espírito subindo de onde cravou
        const p = screen(gx + spot.lean * 0.2 * local, gy, 0.15 + local * 1.3);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, m * 0.12);
        g.addColorStop(0, `rgba(235, 255, 245, ${(0.9 * lo).toFixed(3)})`);
        g.addColorStop(1, rgba(tier.ring, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, m * 0.12, 0, Math.PI * 2);
        ctx.fill();
      } else if (tier.hit === 'faiscas') {
        // faíscas douradas
        const p = screen(gx, gy, 0.12 + local * 0.35);
        sparkle(ctx, p, Math.max(3, m * 0.09) * Math.sin(local * Math.PI));
        ctx.fillStyle = `rgba(255, 246, 200, ${(0.95 * lo).toFixed(3)})`;
        ctx.fill();
      } else if (tier.hit === 'brasas') {
        // a chaminha onde cravou e as brasas subindo, piscando
        const flame = Math.sin(Math.PI * clamp01(local * 1.6));
        if (flame > 0.02) {
          const b = screen(gx, gy, 0);
          const h = m * (0.22 + 0.08 * Math.sin(now / 45 + i)) * flame;
          const w = m * 0.07 * flame;
          const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y - h);
          g.addColorStop(0, `rgba(255, 120, 30, ${(0.9 * lo).toFixed(3)})`);
          g.addColorStop(0.6, `rgba(255, 200, 70, ${(0.8 * lo).toFixed(3)})`);
          g.addColorStop(1, 'rgba(255, 240, 180, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(b.x - w, b.y);
          ctx.quadraticCurveTo(b.x - w * 0.9, b.y - h * 0.55, b.x, b.y - h);
          ctx.quadraticCurveTo(b.x + w * 0.9, b.y - h * 0.55, b.x + w, b.y);
          ctx.closePath();
          ctx.fill();
        }
        for (let e = 0; e < 3; e++) {
          const u = clamp01(local * 1.2 - e * 0.12);
          if (u <= 0 || u >= 1) continue;
          const p = screen(gx + Math.sin(i * 3.1 + e * 2.3) * 0.12 * u, gy + Math.cos(i * 1.7 + e) * 0.08 * u, 0.05 + u * (0.5 + 0.2 * e));
          ctx.fillStyle = `rgba(255, ${Math.round(170 + 70 * (1 - u))}, 60, ${(0.95 * (1 - u) * (0.6 + 0.4 * Math.sin(now / 40 + e * 2 + i))).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1.2, m * 0.022 * (1 - u * 0.4)), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // poeira de terra (com 1 ponto, uma nuvenzinha fraca; com 2, duas e as lascas da madeira voando)
        const puffs = tier.hit === 'lascas' ? [-1, 1] : [1];
        for (const side of puffs) {
          const p = screen(gx + side * 0.08 * local, gy - side * 0.05 * local, 0.06 + local * 0.18);
          ctx.fillStyle = `rgba(168, 138, 96, ${((tier.hit === 'lascas' ? 0.55 : 0.4) * lo).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, m * (0.07 + (tier.hit === 'lascas' ? 0.2 : 0.12) * local), m * (0.045 + 0.1 * local), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (tier.hit === 'lascas') {
          ctx.strokeStyle = `rgba(150, 102, 52, ${(0.9 * lo).toFixed(3)})`;
          ctx.lineWidth = Math.max(1.2, m * 0.018);
          for (let c = 0; c < 3; c++) {
            const a = i * 2.1 + c * 2.09;
            const d = 0.08 + 0.3 * local;
            const h = Math.sin(Math.PI * local) * (0.18 + 0.06 * c);
            const p = screen(gx + Math.cos(a) * d, gy + Math.sin(a) * d * 0.7, h);
            const r = a + local * 9;
            ctx.beginPath();
            ctx.moveTo(p.x - Math.cos(r) * m * 0.035, p.y - Math.sin(r) * m * 0.035);
            ctx.lineTo(p.x + Math.cos(r) * m * 0.035, p.y + Math.sin(r) * m * 0.035);
            ctx.stroke();
          }
        }
      }
    }
  }
  ctx.restore();
}

/** A pancada da chuva no degrau forte: o clarão no meio, uma onda de choque rápida além do círculo e terra espirrando. */
function slam(ctx: CanvasRenderingContext2D, rain: RainLook, since: number, tier: Tier, screen: Screen, m: number): void {
  const HIT_MS = 260 + 160 * tier.power;
  if (since >= HIT_MS) return;
  const k = since / HIT_MS;
  const c = screen(rain.x, rain.y, 0.3 * (1 - k));
  const flash = (1 - clamp01(since / 150)) * (0.3 + 0.7 * tier.power);
  if (flash > 0) {
    const r = m * (0.6 + rain.r * 0.45) * (0.5 + 0.5 * tier.power) * (0.8 + 0.4 * (1 - flash));
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    g.addColorStop(0, `rgba(255, 252, 238, ${(0.85 * flash).toFixed(3)})`);
    g.addColorStop(0.45, rgba(tier.ring, 0.45 * flash));
    g.addColorStop(1, rgba(tier.ring, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const ease = 1 - Math.pow(1 - k, 3);
  groundPath(ctx, rain.x, rain.y, rain.r * (1 + (0.25 + 0.75 * tier.power) * ease), screen);
  ctx.strokeStyle = `rgba(255, 250, 230, ${(0.75 * (1 - k) * (0.4 + 0.6 * tier.power)).toFixed(3)})`;
  ctx.lineWidth = Math.max(1.5, m * 0.06 * (1 - k) * (0.5 + 0.5 * tier.power));
  ctx.stroke();
  const chunks = Math.round(4 + 8 * tier.power);
  for (let i = 0; i < chunks; i++) {
    const a = (i / chunks) * Math.PI * 2 + i * 0.61;
    const d = rain.r * (0.55 + 0.7 * (((i * 7919) % 13) / 13)) * ease;
    const h = Math.sin(Math.PI * clamp01(k * 1.15)) * (0.12 + 0.03 * (i % 4));
    const p = screen(rain.x + Math.cos(a) * d, rain.y + Math.sin(a) * d, h);
    ctx.fillStyle = `rgba(96, 72, 44, ${(0.8 * (1 - k)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.2, m * 0.026 * (1 - k * 0.5)), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Com 4 pontos: o chão pega fogo onde a chuva caiu — chamas baixas num anel que abre, e o chão queimado por dentro. */
function flameRing(ctx: CanvasRenderingContext2D, rain: RainLook, since: number, tier: Tier, screen: Screen, m: number, lk: number): void {
  const FIRE_MS = 900;
  if (since >= FIRE_MS) return;
  const k = since / FIRE_MS;
  const out = 1 - k;
  const reach = rain.r * (0.6 + 0.55 * (1 - Math.pow(1 - Math.min(1, k * 1.6), 2)));
  // o chão queimado (escuro, por baixo das chamas)
  groundPath(ctx, rain.x, rain.y, reach * 0.9, screen);
  ctx.fillStyle = `rgba(40, 20, 8, ${(0.28 * out).toFixed(3)})`;
  ctx.fill();
  const n = Math.round(14 + 10 * lk);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + i * 0.37;
    const b = screen(rain.x + Math.cos(a) * reach, rain.y + Math.sin(a) * reach, 0);
    const flick = 0.7 + 0.3 * Math.sin(since / 35 + i * 2.3);
    const h = m * (0.18 + 0.16 * lk) * flick * Math.sin(Math.PI * Math.min(1, k * 1.25 + 0.05));
    if (h <= 1) continue;
    const w = m * 0.06;
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y - h);
    g.addColorStop(0, `rgba(255, 96, 24, ${(0.85 * out).toFixed(3)})`);
    g.addColorStop(0.55, rgba(tier.ring, 0.75 * out));
    g.addColorStop(1, 'rgba(255, 236, 170, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x - w, b.y);
    ctx.quadraticCurveTo(b.x - w * 0.8, b.y - h * 0.5, b.x, b.y - h);
    ctx.quadraticCurveTo(b.x + w * 0.8, b.y - h * 0.5, b.x + w, b.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** As brasas que soltam do rastro de fogo (com 4 pontos), entre `from` (longe) e `to` (a flecha), piscando. */
function embers(ctx: CanvasRenderingContext2D, from: Point, to: Point, seed: number, alpha: number, m: number, now: number): void {
  for (let e = 0; e < 4; e++) {
    const u = ((now / 300 + e / 4 + seed * 0.37) % 1 + 1) % 1;
    const x = to.x + (from.x - to.x) * u + Math.sin(seed * 5.1 + e * 2.7 + now / 90) * m * 0.04;
    const y = to.y + (from.y - to.y) * u + Math.cos(seed * 3.3 + e * 1.9 + now / 110) * m * 0.03;
    ctx.fillStyle = `rgba(255, ${Math.round(150 + 90 * (1 - u))}, 50, ${(alpha * (1 - u) * 0.95).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.1, m * 0.02 * (1 - u * 0.5)), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** No ar: subindo de quem atirou, caindo no círculo (com a sombra crescendo no chão) e cravadas no chão. */
export function drawRainAir(ctx: CanvasRenderingContext2D, rain: RainLook, now: number, screen: Screen, meter: Meter): void {
  const tier = tierOf(rain.rank);
  const lk = levelPower(rain.level);
  const total = Math.max(1, rain.land - rain.start);
  const rise = Math.max(160, total * 0.5);
  const isStone = rain.kind === 'pedra';
  const m = meter(rain.x, rain.y);
  const width = Math.max(1.8, m * 0.04);
  const stoneSize = Math.max(4.5, m * 0.1);
  ctx.save();
  // a saída: a ponta da flecha no arco (ou o garfo do estilingue), virada para o alvo
  const dist = Math.hypot(rain.x - rain.from.x, rain.y - rain.from.y);
  const ax = dist > 0.01 ? (rain.x - rain.from.x) / dist : 1;
  const ay = dist > 0.01 ? (rain.y - rain.from.y) / dist : 0;
  const launch = isStone ? LAUNCH.pedra : LAUNCH.flecha;
  const ox = rain.from.x + ax * launch.ahead - ay * launch.side;
  const oy = rain.from.y + ay * launch.ahead + ax * launch.side;
  const spread = Math.max(0.5, rain.r);
  rain.spots.forEach((spot, i) => {
    // subindo: saem uma atrás da outra do arco, na direção em que ele aponta (uns 50° para o alto, para o alvo), abrindo
    // um pouco em leque para os lados do círculo
    const k = (now - rain.start - i * 14) / rise;
    if (k >= 0 && k <= 1) {
      const lateral = (spot.dy * ax - spot.dx * ay) / spread;
      const yaw = Math.max(-1, Math.min(1, lateral)) * 0.2;
      const hx = ax * Math.cos(yaw) - ay * Math.sin(yaw);
      const hy = ay * Math.cos(yaw) + ax * Math.sin(yaw);
      const pitch = LAUNCH_PITCH + (((i * 37) % 7) - 3) * 0.018;
      const ux = hx * Math.cos(pitch);
      const uy = hy * Math.cos(pitch);
      const uz = Math.sin(pitch);
      // (cada uma num ritmo um pouco diferente, para não subirem num bloco só)
      const s = k * LAUNCH_TRAVEL * (0.92 + 0.16 * (((i * 53) % 11) / 10));
      const at = (back: number) => screen(ox + ux * (s - back), oy + uy * (s - back), launch.z + uz * (s - back));
      ctx.globalAlpha = 1 - k * 0.35;
      if (isStone) {
        streak(ctx, at(Math.min(1.2, s)), at(0), tier, stoneSize * 1.3, 1);
        stone(ctx, at(0), stoneSize, tier);
      } else {
        // a ponta sai de onde estava a ponta no arco; o rastro não passa para trás do arco
        const tail = at(ARROW_LEN);
        const from = at(ARROW_LEN + Math.min(1.4, s));
        trail(ctx, from, tail, tier, width, lk * clamp01(s / 0.6));
        if (tier.hit === 'brasas') embers(ctx, from, tail, i, lk * clamp01(s / 0.6), m, now);
        arrow(ctx, tail, at(0), tier, width);
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
        trail(ctx, screen(tailX + spot.lean * 0.3, gy, z + 0.85 + 1.6), screen(tailX, gy, z + 0.85), tier, width, fall * lk);
        if (tier.hit === 'brasas') embers(ctx, screen(tailX + spot.lean * 0.3, gy, z + 0.85 + 1.6), screen(tailX, gy, z + 0.85), i, fall * lk, m, now);
        arrow(ctx, screen(tailX, gy, z + 0.85), screen(gx, gy, z), tier, width);
      }
    } else if (now >= landAt && now < landAt + RAIN_LINGER_MS) {
      const life = 1 - (now - landAt) / RAIN_LINGER_MS;
      // ficam inteiras cravadas e somem só no último meio segundo (antes iam sumindo desde a batida)
      ctx.globalAlpha = clamp01((life * RAIN_LINGER_MS) / 500);
      if (isStone) {
        const p = screen(gx, gy, Math.max(0, 0.25 * Math.sin(Math.min(1, (now - landAt) / 250) * Math.PI)));
        stone(ctx, p, stoneSize * 0.9, tier);
      } else {
        // cravada: o montinho de terra na base e a flecha inclinada (com 4 pontos, o chão queimado e uma brasa na base
        // apagando devagar)
        const base = screen(gx, gy, 0);
        const burnt = tier.hit === 'brasas';
        ctx.fillStyle = burnt ? 'rgba(34, 18, 8, 0.6)' : 'rgba(70, 48, 26, 0.55)';
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, m * (burnt ? 0.12 : tier.hit === 'poeira' ? 0.055 : 0.07), m * (burnt ? 0.05 : 0.03), 0, 0, Math.PI * 2);
        ctx.fill();
        if (burnt) {
          const glow = life * (0.6 + 0.4 * Math.sin(now / 80 + i * 1.3));
          const g = ctx.createRadialGradient(base.x, base.y, 0, base.x, base.y, m * 0.08);
          g.addColorStop(0, `rgba(255, 170, 60, ${(0.8 * glow).toFixed(3)})`);
          g.addColorStop(1, 'rgba(255, 110, 30, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(base.x, base.y, m * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
        arrow(ctx, screen(gx + spot.lean * 0.18, gy, 0.42), screen(gx, gy, 0.02), tier, width);
      }
      ctx.globalAlpha = 1;
    }
  });
  ctx.restore();
}
