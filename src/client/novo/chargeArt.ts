// ARQUIVO DA [ARTE]: o desenho do anel da carga no pé de quem puxa o estilingue ou o arco (pedido do dono, 15/11:
// "melhora esse círculo quando carrega, coloca algum efeito e não deixa passar por cima da perna do personagem").
//   paintChargeRing(ctx, pé, progresso, agora, tela, pxPorMetro)
// O combate (combat.ts, da [estrutura]) sabe quem puxa e há quanto tempo e chama daqui a cada quadro: `progresso` de 0
// a 1 (1 = carga cheia). O anel enche como um relógio (começa no ponto mais alto da tela e vai para a direita), com uma
// faísca na ponta; cheio, fica dourado, pulsa, solta uma onda para fora e luzinhas sobem.
// A camada do combate fica por cima do personagem, então a parte de TRÁS do anel (a que passaria por cima das pernas)
// some no trecho atrás delas: o anel parece dar a volta por trás do corpo.
// Com a Chuva ou a Flecha Ancestral no arco vem também o degrau da puxada (`level`: 1 fraco, 2 médio, 3 forte — os
// degraus caem na metade e na carga cheia): duas marcas mostram onde eles ficam, o arco que enche pega a cor do degrau
// (branco, dourado, verde do espírito) e, quando o degrau sobe, sai um pulso de luz do anel (22/11, o dono: "um brilho
// em cada degrau"). Sem habilidade no arco (`level` ausente), o anel de sempre.

type Point = { x: number; y: number };
export type Screen = (x: number, y: number, z?: number) => Point;
export type Meter = (x: number, y: number) => number;

/** Raio do anel (m): o mesmo do combate. */
const RADIUS = 0.6;
/** A cor de cada degrau da puxada com uma habilidade no arco. */
const LEVEL_RGB: Record<number, string> = { 1: '236, 242, 250', 2: '255, 200, 70', 3: '140, 255, 190' };
/** Quanto dura o pulso de luz quando o degrau sobe (ms). */
const LEVEL_PULSE_MS = 420;
// o degrau da última vez e quando subiu (só um anel na tela de cada vez: o de quem joga)
let lastLevel = 0;
let levelAt = -1e9;
let lastProgress = 0;
const TAU = Math.PI * 2;
const STEPS = 64;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * O anel da carga em volta do pé (`feet`, em metros). `progress` de 0 a 1.
 */
// (o degrau vem como argumento a mais: o combate passa `level` depois dos de sempre — `extra[0]`)
export function paintChargeRing(ctx: CanvasRenderingContext2D, feet: Point, progress: number, now: number, screen: Screen, meter: Meter, ...extra: (number | undefined)[]): void {
  const level = extra[0];
  const k = clamp01(progress);
  const full = k >= 1;
  const lv = level !== undefined && level >= 1 ? Math.min(3, Math.round(level)) : 0;
  if (lv) {
    // puxada nova (o anel voltou a encher do começo): o degrau recomeça
    if (k < lastProgress - 0.2) lastLevel = 0;
    if (lv > lastLevel) levelAt = now;
    lastLevel = lv;
  } else lastLevel = 0;
  lastProgress = k;
  const tint = lv ? LEVEL_RGB[lv] : null;
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
  const since = now - levelAt;
  const burst = lv && since >= 0 && since < LEVEL_PULSE_MS ? 1 - since / LEVEL_PULSE_MS : 0;
  const light = (full ? 0.3 + 0.12 * pulse : 0.06 + 0.16 * k) + 0.25 * burst;
  const groundRgb = tint || '255, 214, 110';
  glow.addColorStop(0, `rgba(${groundRgb}, 0)`);
  glow.addColorStop(0.72, `rgba(${groundRgb}, ${Math.min(0.7, light).toFixed(3)})`);
  glow.addColorStop(1, `rgba(${groundRgb}, 0)`);
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
  if (lv) {
    // os degraus: uma marca em losango na metade e outra no fim (acesa quando o degrau já chegou)
    for (const [u, step] of [[0.5, 2], [1, 3]] as const) {
      const a = top + turn * TAU * (u >= 1 ? 0.999 : u);
      const p = at(a);
      const s = seen(p);
      if (s < 0.05) continue;
      const on = lv >= step;
      const size = Math.max(3.2, m * 0.075) * (on ? 1 + 0.35 * (lv === step ? burst : 0) : 0.8);
      ctx.fillStyle = on ? `rgba(${LEVEL_RGB[step]}, ${(0.95 * s).toFixed(3)})` : `rgba(255, 236, 190, ${(0.4 * s).toFixed(3)})`;
      ctx.strokeStyle = `rgba(20, 12, 6, ${(0.6 * s).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, m * 0.014);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - size);
      ctx.lineTo(p.x + size * 0.7, p.y);
      ctx.lineTo(p.x, p.y + size);
      ctx.lineTo(p.x - size * 0.7, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  if (k > 0.005) {
    const tone = tint ? tint : full ? `255, ${Math.round(196 + 30 * pulse)}, 70` : `255, ${Math.round(240 - 30 * k)}, ${Math.round(200 - 110 * k)}`;
    ctx.shadowColor = tint ? `rgba(${tint}, ${0.6 + 0.35 * Math.max(burst, full ? 1 : k)})` : `rgba(255, 190, 60, ${full ? 0.95 : 0.55 + 0.3 * k})`;
    ctx.shadowBlur = (full ? 10 + 6 * pulse : 4 + 5 * k) + 10 * burst;
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
  if (burst > 0) {
    // o degrau subiu: um anel de luz na cor dele sai do anel e some (mais forte quanto maior o degrau)
    const t = 1 - burst;
    const grow = 1 + (0.45 + 0.2 * lv) * (1 - Math.pow(1 - t, 2));
    arc(0, 1, Math.max(2, m * (0.05 + 0.02 * lv) * burst), (a) => `rgba(${tint}, ${(0.9 * burst * a).toFixed(3)})`, RADIUS * grow);
  }
  if (full) {
    // cheio: uma onda que sai do anel de tempos em tempos e luzinhas subindo em volta
    const wave = (now % 900) / 900;
    const waveRgb = tint || '255, 214, 110';
    arc(0, 1, Math.max(1.5, m * 0.03 * (1 - wave)), (a) => `rgba(${waveRgb}, ${(0.6 * (1 - wave) * a).toFixed(3)})`, RADIUS * (1 + 0.35 * wave));
    for (let i = 0; i < 6; i++) {
      const u = ((now / 700 + i / 6) % 1 + 1) % 1;
      const a = top + (TAU * i) / 6 + 0.4;
      const p = screen(feet.x + Math.cos(a) * RADIUS, feet.y + Math.sin(a) * RADIUS, u * 0.55);
      const base = at(a);
      const s = base.y >= c.y ? 1 : clamp01((Math.abs(base.x - c.x) - legs) / (legs * 0.5));
      if (s < 0.05) continue;
      const size = Math.max(1.6, m * 0.04) * (1 - u * 0.5);
      ctx.fillStyle = tint ? `rgba(${lv === 3 ? '228, 255, 240' : tint}, ${((1 - u) * 0.95 * s).toFixed(3)})` : `rgba(255, 244, 190, ${((1 - u) * 0.95 * s).toFixed(3)})`;
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
