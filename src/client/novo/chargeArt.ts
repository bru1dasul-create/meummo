// ARQUIVO DA [ARTE]: o desenho do anel da carga no pé de quem puxa o estilingue ou o arco (pedido do dono, 15/11:
// "melhora esse círculo quando carrega, coloca algum efeito e não deixa passar por cima da perna do personagem").
//   paintChargeRing(ctx, pé, progresso, agora, tela, pxPorMetro)
// O combate (combat.ts, da [estrutura]) sabe quem puxa e há quanto tempo e chama daqui a cada quadro: `progresso` de 0
// a 1 (1 = carga cheia). O anel enche como um relógio (começa no ponto mais alto da tela e vai para a direita), com uma
// faísca na ponta; cheio, fica dourado, pulsa, solta uma onda para fora e luzinhas sobem.
// A camada do combate fica por cima do personagem, então a parte de TRÁS do anel (a que passaria por cima das pernas)
// some no trecho atrás delas: o anel parece dar a volta por trás do corpo.

type Point = { x: number; y: number };
export type Screen = (x: number, y: number, z?: number) => Point;
export type Meter = (x: number, y: number) => number;

/** Raio do anel (m): o mesmo do combate. */
const RADIUS = 0.6;
const TAU = Math.PI * 2;
const STEPS = 64;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * O anel da carga em volta do pé (`feet`, em metros). `progress` de 0 a 1.
 */
export function paintChargeRing(ctx: CanvasRenderingContext2D, feet: Point, progress: number, now: number, screen: Screen, meter: Meter): void {
  const k = clamp01(progress);
  const full = k >= 1;
  const m = meter(feet.x, feet.y);
  const c = screen(feet.x, feet.y);
  const at = (a: number, r = RADIUS): Point => screen(feet.x + Math.cos(a) * r, feet.y + Math.sin(a) * r);
  // o ponto mais alto do anel na tela e o sentido que vai para a direita (com qualquer câmera)
  let top = 0;
  let topY = Infinity;
  for (let i = 0; i < 48; i++) {
    const a = (TAU * i) / 48;
    const y = at(a).y;
    if (y < topY) {
      topY = y;
      top = a;
    }
  }
  const turn = at(top + 0.13).x >= at(top - 0.13).x ? 1 : -1;
  // quanto um ponto do anel aparece: some atrás das pernas (a metade de trás, perto do meio)
  const legs = Math.max(9, m * 0.2);
  const seen = (p: Point): number => (p.y >= c.y ? 1 : clamp01((Math.abs(p.x - c.x) - legs) / (legs * 0.5)));
  /** Um arco do anel (do relógio u0 ao u1, de 0 a 1), em pedacinhos, cada um com o quanto aparece. */
  const arc = (u0: number, u1: number, width: number, color: (alpha: number) => string, r = RADIUS): void => {
    ctx.lineWidth = width;
    const n = Math.max(2, Math.ceil(STEPS * (u1 - u0)));
    let prev = at(top + turn * TAU * u0, r);
    for (let i = 1; i <= n; i++) {
      const p = at(top + turn * TAU * (u0 + ((u1 - u0) * i) / n), r);
      const a = Math.min(seen(prev), seen(p));
      if (a > 0.02) {
        ctx.strokeStyle = color(a);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      prev = p;
    }
  };
  const pulse = 0.5 + 0.5 * Math.sin(now / 90);
  ctx.save();
  ctx.lineCap = 'round';
  // a luz no chão, dentro do anel (mais forte conforme enche)
  ctx.save();
  ctx.translate(c.x, c.y);
  const rx = Math.abs(at(top + Math.PI / 2).x - at(top - Math.PI / 2).x) / 2 || m * 0.5;
  const ry = Math.abs(at(top).y - at(top + Math.PI).y) / 2 || rx * 0.5;
  ctx.scale(1, ry / rx);
  const glow = ctx.createRadialGradient(0, 0, rx * 0.35, 0, 0, rx * 1.25);
  const light = full ? 0.3 + 0.12 * pulse : 0.06 + 0.16 * k;
  glow.addColorStop(0, 'rgba(255, 214, 110, 0)');
  glow.addColorStop(0.72, `rgba(255, 214, 110, ${light.toFixed(3)})`);
  glow.addColorStop(1, 'rgba(255, 214, 110, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, rx * 1.25, 0, TAU);
  ctx.fill();
  ctx.restore();
  // o trilho: o anel inteiro, escuro e fino, com 12 marquinhas (o relógio)
  arc(0, 1, Math.max(3, m * 0.06), (a) => `rgba(20, 12, 6, ${(0.42 * a).toFixed(3)})`);
  arc(0, 1, Math.max(1, m * 0.018), (a) => `rgba(255, 236, 190, ${(0.28 * a).toFixed(3)})`);
  ctx.lineWidth = Math.max(1, m * 0.02);
  for (let i = 0; i < 12; i++) {
    const a = top + (TAU * i) / 12;
    const p0 = at(a, RADIUS * 1.06);
    const p1 = at(a, RADIUS * 1.16);
    const s = Math.min(seen(p0), seen(p1));
    if (s < 0.05) continue;
    ctx.strokeStyle = `rgba(255, 236, 190, ${(0.45 * s).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  // a carga: o arco que enche (creme → dourado), com brilho
  if (k > 0.005) {
    const tone = full ? `255, ${Math.round(196 + 30 * pulse)}, 70` : `255, ${Math.round(240 - 30 * k)}, ${Math.round(200 - 110 * k)}`;
    ctx.shadowColor = `rgba(255, 190, 60, ${full ? 0.95 : 0.55 + 0.3 * k})`;
    ctx.shadowBlur = full ? 10 + 6 * pulse : 4 + 5 * k;
    arc(0, k, Math.max(3.5, m * (full ? 0.075 : 0.062)), (a) => `rgba(${tone}, ${(0.96 * a).toFixed(3)})`);
    ctx.shadowBlur = 0;
    arc(0, k, Math.max(1, m * 0.02), (a) => `rgba(255, 255, 240, ${(0.8 * a).toFixed(3)})`);
  }
  if (!full && k > 0.01) {
    // a faísca na ponta do arco (some atrás das pernas, como ele)
    const tip = at(top + turn * TAU * k);
    const s = seen(tip);
    if (s > 0.05) {
      const r = Math.max(5, m * 0.13) * (0.85 + 0.15 * pulse);
      const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, r);
      g.addColorStop(0, `rgba(255, 255, 235, ${(0.95 * s).toFixed(3)})`);
      g.addColorStop(0.4, `rgba(255, 210, 90, ${(0.6 * s).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255, 190, 60, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, r, 0, TAU);
      ctx.fill();
    }
  }
  if (full) {
    // cheio: uma onda que sai do anel de tempos em tempos e luzinhas subindo em volta
    const wave = (now % 900) / 900;
    arc(0, 1, Math.max(1.5, m * 0.03 * (1 - wave)), (a) => `rgba(255, 214, 110, ${(0.6 * (1 - wave) * a).toFixed(3)})`, RADIUS * (1 + 0.35 * wave));
    for (let i = 0; i < 6; i++) {
      const u = ((now / 700 + i / 6) % 1 + 1) % 1;
      const a = top + (TAU * i) / 6 + 0.4;
      const p = screen(feet.x + Math.cos(a) * RADIUS, feet.y + Math.sin(a) * RADIUS, u * 0.55);
      const base = at(a);
      const s = base.y >= c.y ? 1 : clamp01((Math.abs(base.x - c.x) - legs) / (legs * 0.5));
      if (s < 0.05) continue;
      const size = Math.max(1.6, m * 0.04) * (1 - u * 0.5);
      ctx.fillStyle = `rgba(255, 244, 190, ${((1 - u) * 0.95 * s).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - size * 1.6);
      ctx.lineTo(p.x + size * 0.5, p.y);
      ctx.lineTo(p.x, p.y + size * 1.6);
      ctx.lineTo(p.x - size * 0.5, p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}
