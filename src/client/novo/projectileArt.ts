// ARQUIVO DA [ARTE]: o desenho dos tiros que voam no jogo 2.5D. O combate (combat.ts, da [estrutura]) calcula onde o
// tiro está e chama daqui; o que esta peça não sabe desenhar volta `false` e o combate desenha a bolinha de sempre.
//   drawProjectile(ctx, tipo, noAr, sombra, aFrente, pxPorMetro) → true se desenhou (hoje: a 'flecha' do Arco de Bambu)
//   projectileEnded(tipo, x, y, angulo, agora)  o tiro acabou no fim do alcance sem acertar: a flecha crava no chão
//   drawLanded(ctx, tela, pxPorMetro, agora)    as flechas cravadas (somem depois de um tempo), a cada quadro
//   landedBusy(agora)                           ainda tem flecha cravada à vista (a camada do combate não pode sumir)
// Posições em metros (as do combate); `angulo` em radianos no chão, para onde o tiro ia.

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
export function drawProjectile(ctx: CanvasRenderingContext2D, kind: string, at: Point, shadow: Point, ahead: Point, m: number): boolean {
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

interface Landed {
  x: number;
  y: number;
  a: number;
  t0: number;
}

/** Quanto tempo a flecha fica cravada (e quanto leva para sumir), em ms. */
const STAY_MS = 1600;
const FADE_MS = 450;
const MAX_LANDED = 24;
const landed: Landed[] = [];

/**
 * Ainda tem flecha cravada à vista? (o combate esconde a camada dele quando não tem nada para mostrar: com uma flecha
 * no chão, ela precisa continuar desenhando)
 */
export function landedBusy(now: number): boolean {
  return landed.some((f) => now - f.t0 <= STAY_MS + FADE_MS);
}

/** O tiro acabou no fim do alcance sem acertar: a flecha crava no chão onde caiu. */
export function projectileEnded(kind: string, x: number, y: number, angle: number, now: number): void {
  if (kind !== 'flecha') return;
  landed.push({ x, y, a: angle, t0: now });
  if (landed.length > MAX_LANDED) landed.splice(0, landed.length - MAX_LANDED);
}

/** As flechas cravadas: meio enterradas, inclinadas para trás (de onde vieram), com a poeirinha da batida. */
export function drawLanded(ctx: CanvasRenderingContext2D, screen: (x: number, y: number, z?: number) => Point, meter: (x: number, y: number) => number, now: number): void {
  for (let i = landed.length - 1; i >= 0; i--) {
    const f = landed[i]!;
    // (o relógio do quadro pode vir uns ms antes do momento em que ela cravou: conta como recém-cravada)
    const age = Math.max(0, now - f.t0);
    if (age > STAY_MS + FADE_MS) {
      landed.splice(i, 1);
      continue;
    }
    const alpha = age < STAY_MS ? 1 : 1 - (age - STAY_MS) / FADE_MS;
    const m = meter(f.x, f.y);
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
}
