// ARQUIVO DA [ARTE]: o desenho dos tiros que voam no jogo 2.5D. O combate (combat.ts, da [estrutura]) calcula onde o
// tiro está e chama daqui; o que esta peça não sabe desenhar volta `false` e o combate desenha a bolinha de sempre.
//   drawProjectile(ctx, tipo, noAr, sombra, aFrente, pxPorMetro) → true se desenhou (hoje: a 'flecha' do Arco de Bambu,
//                                               a 'ancestral', a Flecha Ancestral, que vem do spiritArt.ts, e o 'caldo'
//                                               da Cuca: a bola de caldo verde brilhando, pingando)
//   projectileEnded(tipo, x, y, angulo, agora, preso?)  o tiro parou sem acertar ninguém: no fim do alcance a flecha
//                                               crava no chão; com `preso` ({ on, z }: bateu em algo do mapa) crava na
//                                               madeira, quica na pedra ou some na água; a pedra levanta poeira
//   drawLanded(ctx, tela, pxPorMetro, agora)    as flechas paradas, os respingos e a poeira (somem depois), a cada quadro
//   landedBusy(agora)                           ainda tem algo disso à vista (a camada do combate não pode sumir)
// Posições em metros (as do combate); `angulo` em radianos no chão, para onde o tiro ia.

import { drawSpiritArrow } from './spiritArt';

type Point = { x: number; y: number };

const INK = '#1b100d';
const SHAFT = '#d6b678';
const SHAFT_DARK = '#8f7040';
const HEAD = '#5b605e';
const FEATHERS = ['#c0392b', '#efe9dc'];

/**
 * Uma flecha na tela: da cauda até a ponta, com as penas perto da cauda e a ponta de pedra (`head` false: a ponta está
 * enterrada e a haste termina em `tip`).
 */
function arrow(ctx: CanvasRenderingContext2D, tail: Point, tip: Point, px: number, alpha = 1, head = true): void {
  const dx = tip.x - tail.x;
  const dy = tip.y - tail.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const w = Math.max(1.3, px * 0.018);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  // a haste: contorno e a madeira clara com a luz em cima
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 2;
  const end = head ? { x: tip.x - ux * w * 2, y: tip.y - uy * w * 2 } : tip;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.strokeStyle = SHAFT;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 244, 214, 0.6)';
  ctx.lineWidth = Math.max(0.6, w * 0.35);
  ctx.beginPath();
  ctx.moveTo(tail.x - nx * w * 0.2, tail.y - ny * w * 0.2);
  ctx.lineTo(tip.x - ux * w * 3 - nx * w * 0.2, tip.y - uy * w * 3 - ny * w * 0.2);
  ctx.stroke();
  // as penas (uma vermelha, uma branca), coladas perto da cauda
  const f0 = 0.04 * len;
  const f1 = Math.min(0.24 * len, f0 + w * 9);
  FEATHERS.forEach((color, i) => {
    const s = i ? -1 : 1;
    const fw = Math.max(2.2, w * 2.4);
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tail.x + ux * f0, tail.y + uy * f0);
    ctx.lineTo(tail.x + ux * f0 + nx * s * fw, tail.y + uy * f0 + ny * s * fw);
    ctx.lineTo(tail.x + ux * f1 + nx * s * fw * 0.35, tail.y + uy * f1 + ny * s * fw * 0.35);
    ctx.lineTo(tail.x + ux * f1, tail.y + uy * f1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  if (!head) {
    ctx.restore();
    return;
  }
  // a ponta de pedra lascada
  const hl = Math.max(4, w * 3.6);
  const hw = Math.max(2.2, w * 1.6);
  ctx.fillStyle = HEAD;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - ux * hl + nx * hw, tip.y - uy * hl + ny * hw);
  ctx.lineTo(tip.x - ux * hl * 0.75, tip.y - uy * hl * 0.75);
  ctx.lineTo(tip.x - ux * hl - nx * hw, tip.y - uy * hl - ny * hw);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(220, 224, 220, 0.55)';
  ctx.beginPath();
  ctx.moveTo(tip.x - ux * hl * 0.15, tip.y - uy * hl * 0.15);
  ctx.lineTo(tip.x - ux * hl * 0.85 + nx * hw * 0.6, tip.y - uy * hl * 0.85 + ny * hw * 0.6);
  ctx.lineTo(tip.x - ux * hl * 0.7, tip.y - uy * hl * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Um tiro voando. `at` é o ponto do tiro na tela (na altura do voo), `shadow` o pé dele no chão, `ahead` um ponto um
 * pouco à frente na direção do voo (para virar a flecha) e `m` quantos px tem um metro ali.
 */
// (o combate passa, depois dos de sempre, o `look` da habilidade: { rank, level } — os pontos e o degrau da puxada)
export function drawProjectile(ctx: CanvasRenderingContext2D, kind: string, at: Point, shadow: Point, ahead: Point, m: number, ...extra: unknown[]): boolean {
  if (kind === 'caldo') {
    drawBroth(ctx, at, shadow, ahead, m, performance.now());
    return true;
  }
  if (kind === 'ancestral') {
    const look = extra[0] as { rank?: number; level?: number } | undefined;
    drawSpiritArrow(ctx, at, shadow, ahead, m, performance.now(), look);
    return true;
  }
  if (kind !== 'flecha') return false;
  const dx = ahead.x - at.x;
  const dy = ahead.y - at.y;
  const d = Math.hypot(dx, dy);
  // a direção na tela (sem `ahead` útil, a flecha fica deitada para a direita)
  const ux = d > 0.01 ? dx / d : 1;
  const uy = d > 0.01 ? dy / d : 0;
  const L = Math.max(16, m * 0.78);
  const tip = { x: at.x + ux * L * 0.5, y: at.y + uy * L * 0.5 };
  const tail = { x: at.x - ux * L * 0.5, y: at.y - uy * L * 0.5 };
  // a sombra no chão (a flecha fina, embaixo dela)
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, m * 0.03);
  ctx.beginPath();
  ctx.moveTo(shadow.x - ux * L * 0.45, shadow.y - uy * L * 0.45);
  ctx.lineTo(shadow.x + ux * L * 0.45, shadow.y + uy * L * 0.45);
  ctx.stroke();
  // o rastro de vento atrás
  const g = ctx.createLinearGradient(tail.x - ux * L * 0.9, tail.y - uy * L * 0.9, tail.x, tail.y);
  g.addColorStop(0, 'rgba(255, 250, 230, 0)');
  g.addColorStop(1, 'rgba(255, 250, 230, 0.45)');
  ctx.strokeStyle = g;
  ctx.lineWidth = Math.max(1.2, m * 0.025);
  ctx.beginPath();
  ctx.moveTo(tail.x - ux * L * 0.9, tail.y - uy * L * 0.9);
  ctx.lineTo(tail.x, tail.y);
  ctx.stroke();
  ctx.restore();
  arrow(ctx, tail, tip, m);
  return true;
}

/**
 * Onde a flecha parou: no chão, cravada (madeira, mato), quicando (pedra, parede), na água; a pedra só levanta poeira; o
 * caldo da Cuca espirra verde.
 */
type LandMode = 'chao' | 'cravada' | 'quica' | 'agua' | 'poeira' | 'caldo';

interface Landed {
  x: number;
  y: number;
  a: number;
  t0: number;
  mode: LandMode;
  /** Altura (m) onde bateu (cravada, quicando, poeira no alto). */
  z: number;
  /** Bateu do lado de lá (a flecha vinha na direção da câmera): o tronco (ou a pedra) esconde ela. */
  hidden: boolean;
  /** Para onde a flecha que quicou cai (giro em volta da direção do voo). */
  spin: number;
}

/** Quanto tempo a flecha fica (e quanto leva para sumir), em ms; o respingo e a poeira duram menos. */
const STAY_MS = 1600;
const FADE_MS = 450;
const SPLASH_MS = 900;
const DUST_MS = 380;
const BROTH_MS = 520;
const MAX_LANDED = 24;
const landed: Landed[] = [];

/** O que segura a flecha (madeira, mato, estofado): ela crava. O resto (pedra, parede, ferro, carro...) ela quica. */
const HOLDS = new Set(['tronco', 'bambu', 'tronco-caido', 'mata-fechada', 'banco', 'mesa', 'mesa-redonda', 'mesa-cozinha', 'cadeira', 'sofa', 'cama', 'estante', 'cristaleira']);

const lifeOf = (f: Landed): number => (f.mode === 'agua' ? SPLASH_MS : f.mode === 'poeira' ? DUST_MS : f.mode === 'caldo' ? BROTH_MS : STAY_MS + FADE_MS);

/**
 * Ainda tem flecha cravada (ou respingo, poeira) à vista? (o combate esconde a camada dele quando não tem nada para
 * mostrar: com uma flecha no chão, ela precisa continuar desenhando)
 */
export function landedBusy(now: number): boolean {
  return landed.some((f) => now - f.t0 <= lifeOf(f));
}

/**
 * O tiro parou sem acertar ninguém: no fim do alcance (crava no chão) ou em algo do mapa (`stuck.on`, o tipo do objeto
 * da camada `colisao`; `stuck.z`, a altura do voo em metros): crava na madeira, quica na pedra, some na água. A pedra do
 * estilingue (e o que os monstros jogam) levanta só uma poeirinha onde bateu.
 */
export function projectileEnded(kind: string, x: number, y: number, angle: number, now: number, stuck?: { on: string; z: number }): void {
  const on = stuck?.on;
  const z = stuck ? stuck.z : 0;
  let mode: LandMode;
  if (kind === 'caldo') mode = 'caldo';
  else if (kind !== 'flecha') mode = on === 'agua' ? 'agua' : 'poeira';
  else if (!on || on === 'borda') mode = 'chao';
  else if (on === 'agua') mode = 'agua';
  else if (HOLDS.has(on)) mode = 'cravada';
  else mode = 'quica';
  // bateu no lado de lá (a flecha ia na direção da câmera, que fica do lado de +x +y): o tronco (ou a pedra) esconde
  // ela, cravada ou caída atrás dele; só as lascas e a faísca aparecem
  const towardCamera = (Math.cos(angle) + Math.sin(angle)) * Math.SQRT1_2;
  // (só quase de frente para a câmera, até uns 30°: de lado, a maior parte da haste aparece do lado do tronco)
  const behind = (mode === 'cravada' || mode === 'quica') && towardCamera > 0.87;
  landed.push({ x, y, a: angle, t0: now, mode, z, hidden: behind, spin: ((x * 7.13 + y * 3.71) % 1) - 0.5 });
  if (landed.length > MAX_LANDED) landed.splice(0, landed.length - MAX_LANDED);
}

type Screen = (x: number, y: number, z?: number) => Point;

/** Lascas (da casca, da pedra) saindo do ponto da batida e caindo, no começo (`k` de 0 a 1). */
function chips(ctx: CanvasRenderingContext2D, screen: Screen, f: Landed, m: number, k: number, colors: string[], n: number): void {
  const cx = Math.cos(f.a);
  const cy = Math.sin(f.a);
  ctx.save();
  ctx.globalAlpha *= 1 - k;
  for (let i = 0; i < n; i++) {
    // para trás (de onde a flecha veio), abrindo em leque, subindo e caindo
    const spread = (i / (n - 1 || 1) - 0.5) * 2.2;
    const dirX = -cx * Math.cos(spread) + cy * Math.sin(spread);
    const dirY = -cy * Math.cos(spread) - cx * Math.sin(spread);
    const d = 0.08 + k * (0.28 + (i % 3) * 0.06);
    const h = f.z + k * 0.18 - k * k * 0.55;
    const q = screen(f.x + dirX * d, f.y + dirY * d, Math.max(0, h));
    ctx.fillStyle = colors[i % colors.length]!;
    ctx.fillRect(q.x - 1.3, q.y - 1.3, Math.max(2, 0.035 * m), Math.max(2, 0.03 * m));
  }
  ctx.restore();
}

/** As flechas paradas (cravadas no chão ou na madeira, deitadas depois de quicar), os respingos e a poeira. */
export function drawLanded(ctx: CanvasRenderingContext2D, screen: Screen, meter: (x: number, y: number) => number, now: number): void {
  for (let i = landed.length - 1; i >= 0; i--) {
    const f = landed[i]!;
    // (o relógio do quadro pode vir uns ms antes do momento em que ela parou: conta como recém-parada)
    const age = Math.max(0, now - f.t0);
    if (age > lifeOf(f)) {
      landed.splice(i, 1);
      continue;
    }
    const m = meter(f.x, f.y);
    if (f.mode === 'agua') {
      drawSplash(ctx, screen, f, m, age / SPLASH_MS);
      continue;
    }
    if (f.mode === 'poeira') {
      drawDust(ctx, screen, f, m, age / DUST_MS);
      continue;
    }
    if (f.mode === 'caldo') {
      drawBrothSplat(ctx, screen, f, m, age / BROTH_MS);
      continue;
    }
    const alpha = age < STAY_MS ? 1 : 1 - (age - STAY_MS) / FADE_MS;
    if (f.mode === 'cravada') drawStuck(ctx, screen, f, m, age, alpha);
    else if (f.mode === 'quica') drawBounced(ctx, screen, f, m, age, alpha);
    else drawInGround(ctx, screen, f, m, age, alpha);
  }
}

/** Cravada no chão: meio enterrada, inclinada para trás (de onde veio), com a poeirinha da batida. */
function drawInGround(ctx: CanvasRenderingContext2D, screen: Screen, f: Landed, m: number, age: number, alpha: number): void {
  const cx = Math.cos(f.a);
  const cy = Math.sin(f.a);
  // a ponta entrou no chão; o resto sobe para trás, na direção de onde a flecha veio (uns 30° acima do chão)
  const ground = screen(f.x, f.y, 0);
  const out = 0.5;
  const tail = screen(f.x - cx * out * 0.86, f.y - cy * out * 0.86, out * 0.5);
  // poeira da batida (só no começo)
  if (age < 380) {
    const k = age / 380;
    ctx.save();
    ctx.globalAlpha *= (1 - k) * 0.7 * alpha;
    ctx.fillStyle = '#d8ccb0';
    for (let p = 0; p < 6; p++) {
      const ang = (p / 6) * Math.PI * 2;
      const r = (0.08 + k * 0.22) * m;
      ctx.beginPath();
      ctx.arc(ground.x + Math.cos(ang) * r, ground.y + Math.sin(ang) * r * 0.5 - k * 0.1 * m, Math.max(1, 0.035 * m * (1 - k)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // o buraquinho escuro onde entrou
  ctx.save();
  ctx.globalAlpha *= 0.55 * alpha;
  ctx.fillStyle = '#2a2016';
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y, Math.max(1.5, 0.04 * m), Math.max(1, 0.02 * m), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // a parte de fora: da terra até a cauda (a ponta está enterrada) e o montinho de terra em volta da haste
  arrow(ctx, tail, ground, m, alpha, false);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#6a5238';
  ctx.strokeStyle = 'rgba(27, 16, 13, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y, Math.max(2.2, 0.05 * m), Math.max(1.2, 0.024 * m), 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Cravada na madeira (o tronco, o bambu, um banco) na altura em que bateu: a ponta enfiada, a haste deitada na direção
 * do voo, tremendo um tiquinho logo depois da batida, e as lascas da casca. Do lado de lá do tronco, só as lascas.
 */
function drawStuck(ctx: CanvasRenderingContext2D, screen: Screen, f: Landed, m: number, age: number, alpha: number): void {
  const cx = Math.cos(f.a);
  const cy = Math.sin(f.a);
  if (age < 260) chips(ctx, screen, f, m, age / 260, ['#6b4a2e', '#8a6a45', '#3e2a1a', '#a88a5c'], 6);
  if (f.hidden) return;
  // a parte de fora (uns 62 cm; o resto entrou na madeira), quase deitada, a cauda um tiquinho mais alta
  const out = 0.62;
  const tremble = age < 420 ? Math.sin((age / 1000) * Math.PI * 2 * 15) * 0.07 * (1 - age / 420) ** 2 : 0;
  const tip = screen(f.x, f.y, f.z);
  const tail = screen(f.x - cx * out - cy * tremble, f.y - cy * out + cx * tremble, f.z + out * 0.07 + tremble * 0.4);
  // o furinho escuro em volta da ponta
  ctx.save();
  ctx.globalAlpha *= 0.6 * alpha;
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.ellipse(tip.x, tip.y, Math.max(1.4, 0.03 * m), Math.max(1.4, 0.03 * m), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  arrow(ctx, tail, tip, m, alpha, false);
}

/**
 * Quicou (pedra, parede, ferro): a faísca e as lasquinhas na batida, a flecha cai girando para trás e fica deitada no
 * chão, ao pé do que ela bateu.
 */
function drawBounced(ctx: CanvasRenderingContext2D, screen: Screen, f: Landed, m: number, age: number, alpha: number): void {
  const cx = Math.cos(f.a);
  const cy = Math.sin(f.a);
  if (age < 220) {
    const k = age / 220;
    const hit = screen(f.x, f.y, f.z);
    ctx.save();
    ctx.globalAlpha *= 1 - k;
    ctx.strokeStyle = '#fff6d8';
    ctx.lineWidth = Math.max(1, 0.02 * m);
    for (let p = 0; p < 5; p++) {
      const ang = (p / 5) * Math.PI * 2 + 0.4;
      const r0 = 0.04 * m * (1 + k * 2);
      const r1 = r0 + 0.08 * m * (1 - k);
      ctx.beginPath();
      ctx.moveTo(hit.x + Math.cos(ang) * r0, hit.y + Math.sin(ang) * r0);
      ctx.lineTo(hit.x + Math.cos(ang) * r1, hit.y + Math.sin(ang) * r1);
      ctx.stroke();
    }
    ctx.restore();
    chips(ctx, screen, f, m, k, ['#b8b4a8', '#8d8a82'], 4);
  }
  if (f.hidden) return;
  // cai em 0,28 s: volta uns 35 cm, gira e deita no chão
  const fall = Math.min(1, age / 280);
  const e = fall * fall;
  const back = 0.2 + 0.15 * fall;
  const len = 0.74;
  const lie = f.a + Math.PI + f.spin * 1.6 * fall;
  const mx = f.x - cx * back;
  const my = f.y - cy * back;
  const z = (f.z - 0.02) * (1 - e) + 0.02;
  const lx = Math.cos(lie);
  const ly = Math.sin(lie);
  const tilt = (1 - fall) * 0.35;
  const head = screen(mx - lx * len * 0.5, my - ly * len * 0.5, z + tilt * 0.5 * len);
  const tail = screen(mx + lx * len * 0.5, my + ly * len * 0.5, Math.max(0.02, z - tilt * 0.5 * len));
  if (fall >= 1) {
    // a sombrinha embaixo dela, deitada
    const s0 = screen(mx - lx * len * 0.5, my - ly * len * 0.5, 0);
    const s1 = screen(mx + lx * len * 0.5, my + ly * len * 0.5, 0);
    ctx.save();
    ctx.globalAlpha *= 0.25 * alpha;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(1.5, 0.03 * m);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s0.x, s0.y + 1);
    ctx.lineTo(s1.x, s1.y + 1);
    ctx.stroke();
    ctx.restore();
  }
  arrow(ctx, tail, head, m, alpha, true);
}

/**
 * Caiu na água (no fim do alcance, em cima do lago): a flecha mergulha inclinada e afunda com as penas por último, sobe
 * um esguicho no meio e uma coroa de gotas, e três anéis abrem e somem. O branco tem um contorno azul-escuro por baixo
 * para aparecer tanto na água clara quanto na escura (e não se confundir com o brilho do lago).
 */
function drawSplash(ctx: CanvasRenderingContext2D, screen: Screen, f: Landed, m: number, k: number): void {
  const c = screen(f.x, f.y, 0);
  const cx = Math.cos(f.a);
  const cy = Math.sin(f.a);
  ctx.save();
  // os anéis, um depois do outro
  for (const [delay, grow] of [
    [0, 0.62],
    [0.12, 0.46],
    [0.26, 0.32],
  ] as const) {
    const t = (k - delay) / (1 - delay);
    if (t <= 0 || t >= 1) continue;
    const rx = (0.07 + t * grow) * m;
    ctx.globalAlpha = (1 - t) ** 1.2 * 0.95;
    ctx.lineWidth = Math.max(1.6, 0.034 * m * (1 - t * 0.5));
    ctx.strokeStyle = 'rgba(6, 34, 44, 0.5)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 1.2, rx, rx * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#f4fcff';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, rx * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // a flecha mergulhando (uns 55° para baixo, na direção do voo): a parte de baixo d'água é cortada na linha da água
  if (k < 0.5) {
    const t = k / 0.5;
    const len = 0.74;
    const out = 0.5 * (1 - t) ** 1.4; // metros ainda fora d'água
    if (out > 0.015) {
      const h = Math.cos(0.96);
      const v = Math.sin(0.96);
      const tail = screen(f.x - cx * h * out, f.y - cy * h * out, v * out);
      const tip = screen(f.x + cx * h * (len - out), f.y + cy * h * (len - out), -v * (len - out));
      const dx = tip.x - tail.x;
      const dy = tip.y - tail.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      const big = 4 * m + 40;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(c.x - uy * big, c.y + ux * big);
      ctx.lineTo(c.x + uy * big, c.y - ux * big);
      ctx.lineTo(c.x + uy * big - ux * big, c.y - ux * big - uy * big);
      ctx.lineTo(c.x - uy * big - ux * big, c.y + ux * big - uy * big);
      ctx.closePath();
      ctx.clip();
      arrow(ctx, tail, tip, m, 1 - t * 0.35, false);
      ctx.restore();
    }
  }
  // o esguicho do meio: uma gota comprida que sobe e desce
  if (k < 0.42) {
    const t = k / 0.42;
    const hgt = Math.sin(t * Math.PI) * 0.3 * m;
    const w = Math.max(1.6, 0.04 * m * (1 - t * 0.4));
    ctx.globalAlpha = 0.95 * (1 - t * 0.5);
    ctx.fillStyle = '#f4fcff';
    ctx.strokeStyle = 'rgba(6, 34, 44, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - hgt * 0.5, w, Math.max(w, hgt * 0.5), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // a coroa: gotas que sobem em arco e caem de volta, umas mais altas que as outras
  if (k < 0.75) {
    const t = k / 0.75;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(6, 34, 44, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + 0.35;
      const spread = 0.06 + t * (0.2 + (i % 3) * 0.05);
      const up = 4 * (0.16 + (i % 2) * 0.1) * t * (1 - t) * m;
      const r = Math.max(1.3, 0.03 * m * (1 - t * 0.5));
      ctx.globalAlpha = 1 - t * t;
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(ang) * spread * m, c.y + Math.sin(ang) * spread * m * 0.5 - up, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * O caldo da Cuca voando: a bola de caldo verde (balançando, esticada na direção do voo), o brilho em volta, os pingos
 * ficando para trás e a sombra no chão.
 */
function drawBroth(ctx: CanvasRenderingContext2D, at: Point, shadow: Point, ahead: Point, m: number, now: number): void {
  const dx = ahead.x - at.x;
  const dy = ahead.y - at.y;
  const d = Math.hypot(dx, dy);
  const ux = d > 0.01 ? dx / d : 1;
  const uy = d > 0.01 ? dy / d : 0;
  const r = Math.max(4, m * 0.11);
  const wob = Math.sin(now / 45) * 0.12;
  ctx.save();
  // a sombra no chão
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(shadow.x, shadow.y, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  // o brilho em volta (na caverna escura, a bola acende)
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r * 3.2);
  g.addColorStop(0, 'rgba(160, 255, 110, 0.5)');
  g.addColorStop(1, 'rgba(120, 230, 80, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // os pingos ficando para trás
  for (let i = 1; i <= 3; i++) {
    const back = r * (1.3 + i * 0.95);
    const pr = r * (0.42 - i * 0.09);
    ctx.globalAlpha = 1 - i * 0.24;
    ctx.fillStyle = '#7fe05a';
    ctx.beginPath();
    ctx.arc(at.x - ux * back + uy * Math.sin(now / 70 + i) * r * 0.3, at.y - uy * back - ux * Math.sin(now / 70 + i) * r * 0.3 + i * 1.2, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // a bola: esticada na direção do voo, balançando, com o contorno escuro, o miolo claro e o brilhinho
  const ang = Math.atan2(uy, ux);
  ctx.translate(at.x, at.y);
  ctx.rotate(ang);
  ctx.fillStyle = '#1f4a10';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * (1.25 + wob) + 1.4, r * (0.92 - wob) + 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(r * 0.25, -r * 0.3, r * 0.1, 0, 0, r * 1.3);
  body.addColorStop(0, '#d8ff9a');
  body.addColorStop(0.55, '#7fe05a');
  body.addColorStop(1, '#3f9a26');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * (1.25 + wob), r * (0.92 - wob), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(250, 255, 235, 0.85)';
  ctx.beginPath();
  ctx.ellipse(r * 0.35, -r * 0.38, r * 0.32, r * 0.18, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** O caldo que caiu sem acertar ninguém: a mancha que espirra e as gotas verdes voando (a poça vem do servidor). */
function drawBrothSplat(ctx: CanvasRenderingContext2D, screen: Screen, f: Landed, m: number, k: number): void {
  const c = screen(f.x, f.y, 0);
  ctx.save();
  const grow = Math.min(1, k / 0.25);
  ctx.globalAlpha = 1 - k * k;
  ctx.fillStyle = 'rgba(110, 210, 70, 0.75)';
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rr = (0.16 + 0.06 * Math.sin(i * 2.7 + f.spin * 9)) * m * grow;
    const x = c.x + Math.cos(a) * rr;
    const y = c.y + Math.sin(a) * rr * 0.5;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // as gotas: sobem em arco e caem
  ctx.fillStyle = '#9be06a';
  ctx.strokeStyle = 'rgba(20, 60, 10, 0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + f.spin;
    const spread = (0.08 + k * (0.3 + (i % 3) * 0.08)) * m;
    const up = 4 * (0.14 + (i % 2) * 0.08) * k * (1 - k) * m;
    const r = Math.max(1.4, 0.032 * m * (1 - k * 0.5));
    ctx.beginPath();
    ctx.arc(c.x + Math.cos(a) * spread, c.y + Math.sin(a) * spread * 0.5 - up, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** A pedra (ou o que o monstro jogou) bateu: uma poeirinha onde parou (no alto, se bateu em algo) e umas lasquinhas. */
function drawDust(ctx: CanvasRenderingContext2D, screen: Screen, f: Landed, m: number, k: number): void {
  const c = screen(f.x, f.y, f.z);
  ctx.save();
  ctx.globalAlpha *= (1 - k) * 0.75;
  ctx.fillStyle = '#d8ccb0';
  for (let p = 0; p < 7; p++) {
    const ang = (p / 7) * Math.PI * 2;
    const r = (0.05 + k * 0.2) * m;
    ctx.beginPath();
    ctx.arc(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r * 0.6 - k * 0.08 * m, Math.max(1, 0.04 * m * (1 - k)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (f.z > 0.05) chips(ctx, screen, f, m, k, ['#9a948a', '#6b665e'], 4);
}
