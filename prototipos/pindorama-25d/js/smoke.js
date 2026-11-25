// A fumaça de virar (a Cuca, "uma luta por noite", 25/11): ao anoitecer a bruxa vira a chefe e ao amanhecer a chefe
// vira a bruxa, numa nuvem roxa e verde (as cores dela) que sobe girando em volta do corpo, com faíscas. Grossa no
// começo (esconde a troca de desenho: a bruxa sai e a chefe aparece no mesmo instante) e abrindo devagar até sumir em
// `DURATION` s. A view (view.js) guarda a fumaça no lugar: ela continua mesmo depois que o desenho de quem virou sai.
//
// PD.smokeFx.draw(ctx, cam, pe, t, semente, passada): `pe` = o chão embaixo de quem virou (cm do mundo), `t` =
// segundos desde o começo, `semente` = 0..1 (cada fumaça diferente). Em três passadas, para a ordem com o corpo:
// 'chao' (com as sombras: o anel de luz e a sombra da nuvem no chão), 'tras' (antes de quem está ali: os tufos e as
// faíscas do lado de lá) e 'frente' (depois: os do lado de cá, o clarão e o miolo que cobre a troca).
// PD.smokeFx.bounds(cam, pe) = a caixa na tela (px); PD.smokeFx.light(t) = a força da luz roxa que ela acende no escuro.
(function (PD) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const smooth = (e0, e1, x) => {
    const k = clamp01((x - e0) / (e1 - e0));
    return k * k * (3 - 2 * k);
  };
  const hash = (i) => {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /** Quanto dura (s): os tufos somem por volta de 1,2 s; as últimas faíscas, logo depois. */
  const DURATION = 1.3;
  /** Os tufos de fumaça em volta do corpo e as faíscas. */
  const PUFFS = 22;
  const SPARKS = 14;
  /** As cores dos tufos (a sombra embaixo, o meio e o brilho em cima): o roxo do encanto e o verde da pele dela. */
  const TONES = [
    { dark: '#2a1d42', mid: '#6b4d9e', light: '#b79ae6' },
    { dark: '#22301a', mid: '#5c7c36', light: '#a6d278' },
  ];
  const SPARK_COLORS = ['#f2e8ff', '#c9a6ff', '#c8f08a'];

  /** Os tufos de uma fumaça (cm, s), sempre os mesmos para a mesma semente. */
  function puffsOf(seed) {
    const out = [];
    for (let i = 0; i < PUFFS; i++) {
      const r = (k) => hash(seed * 977 + i * 13.1 + k * 3.7);
      const zf = (i + 0.5) / PUFFS;
      out.push({
        a0: i * 2.39996 + seed * TAU,
        z0: 6 + zf * 150,
        zf,
        delay: zf * 0.06 + r(1) * 0.04,
        life: 0.95 + r(2) * 0.3,
        size: 18 + r(3) * 13,
        spin: 2.6 + r(4) * 1.2,
        d0: 10 + r(5) * 12,
        tone: i % 3 === 2 ? 1 : 0,
      });
    }
    return out;
  }

  /** As faíscas: sobem girando para fora (cm, s). */
  function sparksOf(seed) {
    const out = [];
    for (let i = 0; i < SPARKS; i++) {
      const r = (k) => hash(seed * 613 + i * 7.9 + k * 5.3);
      out.push({
        a0: i * 2.4 + seed * 5,
        z0: 10 + r(1) * 110,
        delay: r(2) * 0.35,
        life: 0.7 + r(3) * 0.4,
        size: 2.2 + r(4) * 1.6,
        color: SPARK_COLORS[i % 3],
      });
    }
    return out;
  }

  /**
   * A bolinha macia (64 px, a cor cheia no meio sumindo na beirada), guardada por cor: a de fumaça (o miolo cheio) e a
   * de luz (`glow`: só o centro forte, para o clarão).
   */
  const sprites = new Map();
  const STOPS = { puff: [[0, 1], [0.45, 0.82], [0.78, 0.3], [1, 0]], glow: [[0, 1], [0.22, 0.55], [0.6, 0.14], [1, 0]] };
  function sprite(hex, kind = 'puff') {
    if (typeof document === 'undefined') return null;
    const key = kind + hex;
    let sp = sprites.get(key);
    if (sp) return sp;
    sp = document.createElement('canvas');
    sp.width = sp.height = 64;
    const g = sp.getContext('2d');
    if (!g) return null;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    const rgb = rgbOf(hex);
    for (const [at, a] of STOPS[kind]) gr.addColorStop(at, `rgba(${rgb}, ${a})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    sprites.set(key, sp);
    return sp;
  }
  function rgbOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }

  /** Um tufo (px): a bolinha, ou o gradiente na hora (sem `document`, nos testes). */
  function blob(ctx, x, y, r, hex, a, base, kind = 'puff') {
    if (!(a > 0.003) || !(r > 0.2)) return;
    ctx.globalAlpha = base * Math.min(1, a);
    const sp = sprite(hex, kind);
    if (sp) {
      ctx.drawImage(sp, x - r, y - r, 2 * r, 2 * r);
      return;
    }
    const rgb = rgbOf(hex);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (const [at, al] of STOPS[kind]) g.addColorStop(at, `rgba(${rgb}, ${al})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /** Uma estrelinha de quatro pontas (px). */
  function star4(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.closePath();
    ctx.fill();
  }

  /** Os calombos de cada tufo: [deslocamento x, y (em raios), tamanho]. */
  const LUMPS = [[-0.32, 0.08, 0.68], [0.3, 0.12, 0.62], [0.02, -0.22, 0.72]];

  /**
   * O miolo grosso (0..1): cheio já no primeiro quadro (a troca de desenho acontece no mesmo instante em que a fumaça
   * começa) e abrindo logo depois, para mostrar quem ficou.
   */
  const thick = (t) => 1 - smooth(0.2, 0.55, t);

  function draw(ctx, cam, foot, t, seed, layer) {
    if (!(t >= 0) || t > DURATION) return;
    const z = cam.zoom;
    const sinP = cam.sinP || 0.6;
    const base = ctx.globalAlpha;
    ctx.save();
    if (layer === 'chao') {
      const c = cam.p(foot);
      // a sombra da nuvem no chão e o anel de luz que abre
      const sh = 0.24 * Math.max(thick(t), 1 - smooth(0.2, 1.1, t));
      if (sh > 0.01) {
        ctx.globalAlpha = base * sh;
        ctx.fillStyle = '#140c22';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 62 * z, 62 * sinP * z, 0, 0, TAU);
        ctx.fill();
      }
      if (t < 0.6) {
        const R = 35 + 95 * easeOut(t / 0.55);
        const a = 0.75 * (1 - smooth(0, 0.6, t));
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#c9a6ff';
        for (const [w, k] of [[11, 0.25], [3.2, 1]]) {
          ctx.globalAlpha = base * a * k;
          ctx.lineWidth = w * z;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, R * z, R * sinP * z, 0, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }
    const front = layer === 'frente';
    // os tufos deste lado (de lá ou de cá do corpo), do mais longe para o mais perto
    const list = [];
    for (const p of puffsOf(seed)) {
      const u = (t - p.delay) / p.life;
      if (u <= 0 || u >= 1) continue;
      const e = easeOut(u);
      const ang = p.a0 + p.spin * e;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      if (ca + sa > 0 !== front) continue;
      const d = p.d0 + 66 * e + 10 * p.zf;
      const pt = { x: foot.x + ca * d, y: foot.y + sa * d, z: foot.z + p.z0 + 75 * e };
      const a = smooth(0, 0.05, u) * (1 - smooth(0.2, 0.85, u)) * 0.85;
      list.push({ q: cam.p(pt), r: p.size * (0.8 + 0.65 * e) * z, a, tone: TONES[p.tone], depth: pt.x + pt.y + pt.z * 0.3 });
    }
    list.sort((p, q) => p.depth - q.depth);
    for (const p of list) {
      // cada tufo: três calombos (a beirada de nuvem, não uma bola), com a sombra embaixo e o brilho em cima
      // (a sombra numa bolinha só: no celular, cada bolinha a menos conta)
      const r = p.r;
      blob(ctx, p.q.x, p.q.y + 0.22 * r, r * 0.95, p.tone.dark, p.a * 0.55, base);
      for (const [ox, oy, k] of LUMPS) blob(ctx, p.q.x + ox * r, p.q.y + oy * r, r * k * 0.92, p.tone.mid, p.a * 0.85, base);
      blob(ctx, p.q.x - 0.22 * r, p.q.y - 0.3 * r, r * 0.5, p.tone.light, p.a * 0.6, base);
    }
    if (front) {
      // o miolo grosso por cima do corpo (a troca de desenho acontece aqui dentro)
      const k = thick(t);
      if (k > 0.01) {
        for (const [zz, rr, tone] of [[24, 40, 0], [68, 44, 1], [112, 42, 0], [156, 38, 1]]) {
          const q = cam.p({ x: foot.x, y: foot.y, z: foot.z + zz + 30 * t });
          const r = rr * (0.9 + 0.6 * t) * z;
          blob(ctx, q.x, q.y + 0.18 * r, r, TONES[tone].dark, k * 0.75, base);
          blob(ctx, q.x, q.y, r * 0.92, TONES[tone].mid, k * 0.95, base);
          blob(ctx, q.x - 0.2 * r, q.y - 0.26 * r, r * 0.5, TONES[tone].light, k * 0.6, base);
        }
      }
      // o clarão do encanto (luz somando)
      if (t < 0.32) {
        ctx.globalCompositeOperation = 'lighter';
        const q = cam.p({ x: foot.x, y: foot.y, z: foot.z + 85 });
        blob(ctx, q.x, q.y, 95 * z, '#c9a6ff', 0.5 * (1 - smooth(0, 0.32, t)), base, 'glow');
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // as faíscas subindo em espiral (luz somando)
    ctx.globalCompositeOperation = 'lighter';
    for (const [i, sp] of sparksOf(seed).entries()) {
      const u = (t - sp.delay) / sp.life;
      if (u <= 0 || u >= 1) continue;
      const e = easeOut(u);
      const ang = sp.a0 + 4.5 * e;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      if (ca + sa > 0 !== front) continue;
      const d = 15 + 70 * e;
      const q = cam.p({ x: foot.x + ca * d, y: foot.y + sa * d, z: foot.z + sp.z0 + 100 * e });
      ctx.globalAlpha = base * (1 - u) * (0.6 + 0.4 * Math.sin(t * 30 + i * 1.7));
      ctx.fillStyle = sp.color;
      star4(ctx, q.x, q.y, sp.size * (1 + 0.6 * (1 - u)) * z);
    }
    ctx.restore();
  }

  /** A caixa na tela (px) onde a fumaça pode aparecer. */
  function bounds(cam, foot) {
    const z = cam.zoom;
    const sinP = cam.sinP || 0.6;
    const lo = cam.p(foot);
    const hi = cam.p({ x: foot.x, y: foot.y, z: foot.z + 280 });
    return { x0: lo.x - 170 * z, x1: lo.x + 170 * z, y0: hi.y - 60 * z, y1: lo.y + 140 * sinP * z + 20 * z };
  }

  /** A força (0..1) da luz roxa que a fumaça acende no escuro (a caverna, a noite): acende rápido e apaga junto. */
  const light = (t) => (t >= 0 && t <= DURATION ? clamp01(t / 0.08) * (1 - smooth(0.15, 1.0, t)) : 0);

  PD.smokeFx = { DURATION, draw, bounds, light, puffsOf };
})(window.PD = window.PD || {});
