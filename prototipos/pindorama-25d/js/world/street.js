// A rua no padrão novo ("a floresta reinando sobre a cidade", referências aprovadas pelo dono em 13/11:
// docs/referencias/padrao-rua-floresta.jpg, rua-budega-aprovada.jpg e a planta rua-budega-planta.jpg): asfalto de
// verdade (grão, manchas e trincas), calçada de placas de cimento (juntas, trincas, placas levantadas e mato nas
// frestas), meio-fio com sarjeta, faixa amarela apagada, remendos, buracos com água, poças, rachaduras com mato,
// bueiros, tampas de esgoto, raízes que levantam o chão, capim, musgo na praça, o campinho de terra e o chão quebrado
// em volta da figueira que rompeu a esquina.
// Tudo é pintado no chão (ground.js), em cm do chão, uma vez por pedaço da tela; quanto mais detalhe, mais demora para
// fazer um pedaço, então cada coisa é barata. Os sorteios vêm da posição: o mesmo detalhe sai igual em qualquer pedaço.
//   PD.street.paint[tipo](ctx, forma, env)      → formas que são só detalhe (meio-fio, faixa-rua, bueiro...)
//   PD.street.texture[tipo](ctx, forma, box, seed, ground) → textura de superfície (true = já pintou)
//   PD.street.breaks(ctx, árvore, env)          → o chão quebrado em volta da árvore com `rompendo`
(function (PD) {
  'use strict';
  const M = PD.math;
  const G = PD.groundHelp;

  // ------------------------------------------------------------------ ajudantes
  /** Quanto o chão anda (em x e em y) para subir `h` cm na tela (a câmera olha de +x+y). */
  const liftOf = (cam, h) => (h * cam.cosP) / (2 * PD.ISO_K * cam.sinP);
  const seeded = (x, y, k) => M.rng((Math.round(x * 3.7) * 73856093) ^ (Math.round(y * 5.3) * 19349663) ^ (k * 83492791));
  function clipBox(a, b) {
    const x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1), y0 = Math.max(a.y0, b.y0), y1 = Math.min(a.y1, b.y1);
    return x1 > x0 && y1 > y0 ? { x0, x1, y0, y1 } : null;
  }
  function poly(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
  /** Contorno irregular em volta de (x, y): raio rx × ry, girado de `a`, com tremida `jit`. */
  function blob(x, y, rx, ry, a, n, jit, rnd) {
    const pts = [];
    const c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * M.TAU;
      const k = 1 - jit / 2 + rnd() * jit;
      const lx = Math.cos(t) * rx * k, ly = Math.sin(t) * ry * k;
      pts.push({ x: x + lx * c - ly * s, y: y + lx * s + ly * c });
    }
    return pts;
  }
  const scalePts = (pts, cx, cy, k) => pts.map((p) => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k }));
  /** Contorno fechado e macio pelos pontos (curvas pelos meios). */
  function smooth(ctx, pts) {
    const n = pts.length;
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    ctx.beginPath();
    const m0 = mid(pts[n - 1], pts[0]);
    ctx.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    ctx.closePath();
  }

  /** Trinca: anda em passinhos virando devagar; galhos menores saem dela. */
  function crack(ctx, x, y, a, len, rnd, w, color, branches) {
    const pts = [];
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let d = 0; d < len; ) {
      const s = 7 + rnd() * 7;
      a += (rnd() - 0.5) * 0.8;
      x += Math.cos(a) * s;
      y += Math.sin(a) * s;
      d += s;
      ctx.lineTo(x, y);
      pts.push([x, y, a]);
    }
    ctx.stroke();
    for (let k = 0; k < branches && pts.length > 2; k++) {
      const p = pts[1 + Math.floor(rnd() * (pts.length - 2))];
      crack(ctx, p[0], p[1], p[2] + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.7), len * (0.2 + rnd() * 0.3), rnd, w * 0.7, color, 0);
    }
    return pts;
  }

  /** Tufo de capim em pé (as folhas sobem na tela; no chão, isso é andar para -x-y). */
  const GRASS = ['#6f9a45', '#5d8a3a', '#86ad55', '#a3b25a'];
  function tuft(ctx, x, y, size, rnd, cam, dry) {
    const k = liftOf(cam, 1);
    const n = 4 + Math.floor(rnd() * 4);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const h = size * (0.55 + rnd() * 0.65);
      const lean = (rnd() - 0.5) * size * 0.9;
      const bx = x + (rnd() - 0.5) * size * 0.35;
      const by = y + (rnd() - 0.5) * size * 0.35;
      const tx = bx - k * h + lean * 0.7, ty = by - k * h - lean * 0.7;
      const mx = (bx + tx) / 2 + lean * 0.2, my = (by + ty) / 2 - lean * 0.2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(mx, my, tx, ty);
      ctx.strokeStyle = 'rgba(24, 38, 20, 0.75)';
      ctx.lineWidth = Math.max(2.2, size * 0.15);
      ctx.stroke();
      ctx.strokeStyle = dry && rnd() < 0.4 ? '#b7a564' : GRASS[Math.floor(rnd() * GRASS.length)];
      ctx.lineWidth = Math.max(1.2, size * 0.08);
      ctx.stroke();
    }
  }
  /** Para cada célula de `step` cm dentro do pedaço (e da forma), chama fn(rng, x0, y0). */
  function eachCell(sh, box, step, seed, fn) {
    const b = clipBox(G.shapeBox(sh), box);
    if (!b) return;
    for (let i = Math.floor(b.x0 / step); i <= Math.floor(b.x1 / step); i++) {
      for (let j = Math.floor(b.y0 / step); j <= Math.floor(b.y1 / step); j++) fn(G.cellRng(i, j, seed), i * step, j * step);
    }
  }
  /** Pontos de uma polilinha a cada `step` cm, com a direção. */
  function walk(pts, step) {
    const out = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.round(L / step));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: Math.atan2(b.y - a.y, b.x - a.x) });
      }
    }
    const z = pts[pts.length - 1];
    if (z && out.length) out.push({ x: z.x, y: z.y, a: out[out.length - 1].a });
    return out;
  }

  const paint = {};
  const texture = {};

  // ------------------------------------------------------------------ asfalto
  // grão miúdo claro e escuro, manchas grandes de tom (sol, óleo, conserto velho) e trincas finas espalhadas
  // (mais no `estado` 'rachado')
  function asphalt(ctx, sh, box, seed, cam, cracked) {
    ctx.save();
    G.shapePath(ctx, sh);
    ctx.clip();
    eachCell(sh, box, 300, seed + 101, (r, x0, y0) => {
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = r() < 0.5 ? 'rgba(255, 255, 255, 0.014)' : 'rgba(0, 0, 0, 0.035)';
        ctx.beginPath();
        ctx.ellipse(x0 + r() * 300, y0 + r() * 300, 70 + r() * 150, 40 + r() * 90, r() * 3, 0, M.TAU);
        ctx.fill();
      }
      // mancha de óleo, às vezes
      if (r() < 0.12) {
        ctx.fillStyle = 'rgba(18, 18, 22, 0.22)';
        ctx.beginPath();
        ctx.ellipse(x0 + r() * 300, y0 + r() * 300, 25 + r() * 40, 15 + r() * 25, r() * 3, 0, M.TAU);
        ctx.fill();
      }
    });
    const GRAIN = ['#575a61', '#4d5056', '#2f3236', '#34373c', '#62656b'];
    eachCell(sh, box, 100, seed + 103, (r, x0, y0) => {
      for (let k = 0; k < 16; k++) {
        ctx.fillStyle = GRAIN[Math.floor(r() * GRAIN.length)];
        const s = 1.6 + r() * 2.6;
        ctx.fillRect(x0 + r() * 100, y0 + r() * 100, s, s * (0.6 + r() * 0.6));
      }
    });
    eachCell(sh, box, 200, seed + 107, (r, x0, y0) => {
      if (r() > (cracked ? 0.6 : 0.2)) return;
      crack(ctx, x0 + r() * 200, y0 + r() * 200, r() * M.TAU, 50 + r() * 110, r, 1.6 + r() * 1.2, '#24262a', cracked ? 3 : 1);
      // couro de jacaré (asfalto cansado): uma malha de trincas curtas
      if (cracked && r() < 0.35) {
        const cx = x0 + r() * 200, cy = y0 + r() * 200;
        for (let k = 0; k < 6; k++) crack(ctx, cx + (r() - 0.5) * 60, cy + (r() - 0.5) * 60, r() * M.TAU, 18 + r() * 22, r, 1.3, '#26282c', 0);
      }
    });
    ctx.restore();
    void cam;
  }
  texture.asfalto = (ctx, sh, box, seed, g) => {
    asphalt(ctx, sh, box, seed, g.cam, sh.state === 'rachado');
    return true;
  };
  texture.rua = texture.asfalto;

  // ------------------------------------------------------------------ calçada de placas de cimento
  // placas de ~1 m ao longo da calçada, cada uma de um tom; juntas escuras; umas trincadas, umas com mancha de musgo;
  // perto de raiz (ou ao acaso, poucas) a placa levanta (borda escura do lado da câmera); mato nas frestas
  texture.calcada = (ctx, sh, box, seed, g, map) => {
    if (sh.pattern !== 'placas' || sh.kind !== 'rect') return false;
    const b = sh;
    const cb = clipBox(b, box);
    if (!cb) return true;
    const roots = map ? map._roots || (map._roots = map.shapes.filter((s) => s.type === 'raiz').map((s) => ({ kind: 'line', pts: s.pts, width: (s.width || 35) + 150 }))) : [];
    const alongY = b.y1 - b.y0 >= b.x1 - b.x0;
    const L = alongY ? b.y1 - b.y0 : b.x1 - b.x0;
    const Wd = alongY ? b.x1 - b.x0 : b.y1 - b.y0;
    const nAcross = Math.max(1, Math.round(Wd / 70));
    const sw = Wd / nAcross;
    const sl = L / Math.max(1, Math.round(L / 72));
    const base = '#aaa597';
    const k = liftOf(g.cam, 1);
    ctx.save();
    G.shapePath(ctx, sh);
    ctx.clip();
    ctx.fillStyle = '#6c685e'; // juntas
    ctx.fillRect(cb.x0, cb.y0, cb.x1 - cb.x0, cb.y1 - cb.y0);
    // índices das placas que caem no pedaço
    const a0 = alongY ? b.y0 : b.x0;
    const c0 = alongY ? b.x0 : b.y0;
    const ia = Math.max(0, Math.floor(((alongY ? cb.y0 : cb.x0) - a0) / sl));
    const ib = Math.min(Math.ceil(L / sl), Math.ceil(((alongY ? cb.y1 : cb.x1) - a0) / sl));
    const tufts = [];
    for (let i = ia; i < ib; i++) {
      for (let j = 0; j < nAcross; j++) {
        const u0 = a0 + i * sl, v0 = c0 + j * sw;
        const r = seeded(u0, v0, 211);
        const x = alongY ? v0 : u0, y = alongY ? u0 : v0;
        const w = alongY ? sw : sl, h = alongY ? sl : sw;
        const cx = x + w / 2, cy = y + h / 2;
        const lifted = roots.some((rt) => G.inside(rt, cx, cy)) ? r() < 0.75 : r() < 0.05;
        const tone = M.shade(base, (r() - 0.5) * 0.1 + (lifted ? 0.05 : 0));
        const j1 = 2; // meia junta
        if (lifted) {
          // a placa levantada: a borda do lado da câmera aparece (escura) embaixo do tampo
          const d = k * (4 + r() * 5);
          ctx.fillStyle = '#5f5b52';
          poly(ctx, [{ x: x + w - j1, y: y + j1 }, { x: x + w - j1 + d, y: y + j1 + d }, { x: x + w - j1 + d, y: y + h - j1 + d }, { x: x + j1 + d, y: y + h - j1 + d }, { x: x + j1, y: y + h - j1 }, { x: x + w - j1, y: y + h - j1 }]);
          ctx.fill();
        }
        ctx.fillStyle = tone;
        ctx.fillRect(x + j1, y + j1, w - 2 * j1, h - 2 * j1);
        // desgaste: pintinhas e uma mancha de musgo ou sujeira na beira
        ctx.fillStyle = 'rgba(90, 86, 76, 0.25)';
        for (let q = 0; q < 6; q++) ctx.fillRect(x + r() * w, y + r() * h, 2 + r() * 2, 2 + r() * 2);
        if (r() < 0.3) {
          ctx.fillStyle = r() < 0.6 ? 'rgba(78, 104, 58, 0.28)' : 'rgba(70, 60, 44, 0.2)';
          ctx.beginPath();
          ctx.ellipse(x + (r() < 0.5 ? 8 : w - 8), y + r() * h, 10 + r() * 22, 6 + r() * 14, r() * 3, 0, M.TAU);
          ctx.fill();
        }
        if (r() < (lifted ? 0.6 : 0.2)) crack(ctx, x + r() * w, y + r() * h, r() * M.TAU, Math.min(w, h) * (0.5 + r() * 0.6), r, 1.3, '#625e55', 1);
        // mato na fresta (num canto da placa)
        if (r() < 0.42) tufts.push([x + (r() < 0.5 ? 0 : w), y + (r() < 0.5 ? 0 : h), 12 + r() * 13, r]);
      }
    }
    for (const [x, y, s, r] of tufts) tuft(ctx, x, y, s, r, g.cam, false);
    ctx.restore();
    return true;
  };

  // ------------------------------------------------------------------ meio-fio com sarjeta
  // a pedra do meio-fio (o tampo claro, com as juntas), a sarjeta do lado da rua (cimento sujo, folha e terra) e, quando
  // a rua fica do lado da câmera, a face do meio-fio descendo até a sarjeta: assim a rua parece mais baixa que a calçada
  paint['meio-fio'] = (ctx, sh, env) => {
    const { map, g } = env;
    const asph = map._asph || (map._asph = map.shapes.filter((s) => s.type === 'asfalto' || s.type === 'rua'));
    const w = sh.width || 20;
    const D = liftOf(g.cam, sh.height || 15);
    const gw = sh.gutter ? 32 : 0;
    // o tampo bem mais claro que a calçada (a pedra do meio-fio se destaca, como na referência)
    const top = M.shade(sh.color || '#bdb6a8', 0.28);
    ctx.lineCap = 'butt';
    for (let i = 0; i + 1 < sh.pts.length; i++) {
      const A = sh.pts[i], B = sh.pts[i + 1];
      const L = Math.hypot(B.x - A.x, B.y - A.y);
      if (L < 1) continue;
      const dx = (B.x - A.x) / L, dy = (B.y - A.y) / L;
      const nx = -dy, ny = dx;
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const side = asph.some((s) => G.inside(s, mx + nx * 45, my + ny * 45)) ? 1 : asph.some((s) => G.inside(s, mx - nx * 45, my - ny * 45)) ? -1 : 0;
      const sx = nx * side, sy = ny * side;
      // os pedaços se cruzam nas esquinas (a pedra de um entra na do outro)
      const ax = A.x - dx * w * 0.5, ay = A.y - dy * w * 0.5, bx = B.x + dx * w * 0.5, by = B.y + dy * w * 0.5;
      const at = (t, o) => ({ x: ax + (bx - ax) * t + sx * o, y: ay + (by - ay) * t + sy * o });
      if (side && gw) {
        // sarjeta
        ctx.fillStyle = '#6e6a62';
        poly(ctx, [at(0, w / 2), at(1, w / 2), at(1, w / 2 + gw), at(0, w / 2 + gw)]);
        ctx.fill();
        const r = seeded(ax, ay, 307);
        const n = Math.round(L / 25);
        for (let q = 0; q < n; q++) {
          const p = at(r(), w / 2 + r() * gw);
          ctx.fillStyle = ['rgba(92, 70, 44, 0.55)', 'rgba(70, 96, 50, 0.5)', 'rgba(40, 38, 34, 0.4)', 'rgba(120, 92, 52, 0.45)'][Math.floor(r() * 4)];
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 3 + r() * 6, 2 + r() * 3, r() * 3, 0, M.TAU);
          ctx.fill();
        }
        // a beira da sarjeta com o asfalto
        ctx.strokeStyle = 'rgba(30, 31, 34, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const e0 = at(0, w / 2 + gw), e1 = at(1, w / 2 + gw);
        ctx.moveTo(e0.x, e0.y);
        ctx.lineTo(e1.x, e1.y);
        ctx.stroke();
      }
      if (side && sx + sy > 0.05) {
        // a face do meio-fio virada para a câmera
        const e0 = at(0, w / 2), e1 = at(1, w / 2);
        ctx.fillStyle = '#a19b8e';
        poly(ctx, [e0, e1, { x: e1.x + D, y: e1.y + D }, { x: e0.x + D, y: e0.y + D }]);
        ctx.fill();
        ctx.strokeStyle = '#2d2c29';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(e0.x + D, e0.y + D);
        ctx.lineTo(e1.x + D, e1.y + D);
        ctx.stroke();
      }
      // o tampo do meio-fio e a junta com a calçada
      ctx.fillStyle = top;
      poly(ctx, [at(0, -w / 2), at(1, -w / 2), at(1, w / 2), at(0, w / 2)]);
      ctx.fill();
      if (side) {
        const j0 = at(0, -w / 2), j1 = at(1, -w / 2);
        ctx.strokeStyle = 'rgba(78, 74, 66, 0.8)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(j0.x, j0.y);
        ctx.lineTo(j1.x, j1.y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(70, 66, 58, 0.55)';
      ctx.lineWidth = 1.4;
      const nj = Math.floor(L / 100);
      ctx.beginPath();
      for (let q = 1; q <= nj; q++) {
        const p0 = at(q / (nj + 1), -w / 2), p1 = at(q / (nj + 1), w / 2);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
      ctx.stroke();
      // quina viva do lado da rua (clara) e, se a rua fica do outro lado, a sombra do degrau
      if (side) {
        const e0 = at(0, w / 2), e1 = at(1, w / 2);
        ctx.strokeStyle = sx + sy > 0.05 ? 'rgba(236, 230, 216, 0.7)' : 'rgba(25, 25, 28, 0.6)';
        ctx.lineWidth = sx + sy > 0.05 ? 1.6 : 3;
        ctx.beginPath();
        ctx.moveTo(e0.x, e0.y);
        ctx.lineTo(e1.x, e1.y);
        ctx.stroke();
      }
    }
  };

  // ------------------------------------------------------------------ faixa amarela apagada
  paint['faixa-rua'] = (ctx, sh) => {
    const w = sh.width || 12;
    const color = sh.color || '#c9a640';
    // traço de ~1,2 m e vão de ~1 m (a lista do [mundo])
    const dash = sh.dashed ? 120 : 1e9;
    const gap = 100;
    let phase = 0;
    ctx.lineCap = 'butt';
    for (let i = 0; i + 1 < sh.pts.length; i++) {
      const A = sh.pts[i], B = sh.pts[i + 1];
      const L = Math.hypot(B.x - A.x, B.y - A.y);
      const dx = (B.x - A.x) / (L || 1), dy = (B.y - A.y) / (L || 1);
      let d = 0;
      while (d < L) {
        const inDash = phase < dash;
        const left = inDash ? dash - phase : dash + gap - phase;
        const step = Math.min(left, L - d);
        if (inDash && step > 2) {
          const x0 = A.x + dx * d, y0 = A.y + dy * d;
          const r = seeded(x0, y0, 401);
          // tinta gasta: umas somem em parte, outras estão mais fracas
          let s0 = 0, s1 = step;
          if (sh.faded && r() < 0.3) {
            if (r() < 0.5) s0 = step * (0.3 + r() * 0.4);
            else s1 = step * (0.3 + r() * 0.4);
          }
          ctx.globalAlpha = sh.faded ? 0.5 + r() * 0.3 : 0.9;
          ctx.strokeStyle = color;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(x0 + dx * s0, y0 + dy * s0);
          ctx.lineTo(x0 + dx * s1, y0 + dy * s1);
          ctx.stroke();
          ctx.globalAlpha = 1;
          if (sh.faded) {
            ctx.fillStyle = 'rgba(52, 54, 58, 0.7)';
            for (let q = 0; q < 5; q++) {
              const t = s0 + r() * (s1 - s0);
              ctx.beginPath();
              ctx.ellipse(x0 + dx * t + (r() - 0.5) * w, y0 + dy * t + (r() - 0.5) * w, 2 + r() * 4, 1.5 + r() * 2.5, r() * 3, 0, M.TAU);
              ctx.fill();
            }
          }
        }
        d += step;
        phase = (phase + step) % (dash + gap);
      }
    }
  };

  // ------------------------------------------------------------------ remendo
  paint.remendo = (ctx, sh, env) => {
    ctx.save();
    G.shapePath(ctx, sh);
    ctx.fillStyle = sh.color || '#2c2f33';
    ctx.fill();
    ctx.clip();
    eachCell(sh, env.box, 100, 503, (r, x0, y0) => {
      for (let k = 0; k < 9; k++) {
        ctx.fillStyle = r() < 0.5 ? '#3a3d42' : '#222427';
        const s = 1.5 + r() * 2;
        ctx.fillRect(x0 + r() * 100, y0 + r() * 100, s, s);
      }
    });
    ctx.restore();
    // a emenda: borda clara de piche e uma linha escura por dentro
    G.shapePath(ctx, sh);
    ctx.strokeStyle = 'rgba(112, 114, 118, 0.6)';
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(16, 17, 19, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };

  // ------------------------------------------------------------------ buraco (com água, se `agua`)
  paint.buraco = (ctx, sh) => {
    const r0 = sh.r || 45;
    const rnd = seeded(sh.x, sh.y, 509);
    const a = rnd() * M.TAU;
    const out = blob(sh.x, sh.y, r0, r0 * (0.7 + rnd() * 0.25), a, 14, 0.35, rnd);
    // trincas saindo da beira
    for (let k = 0; k < 4; k++) {
      const t = rnd() * M.TAU;
      crack(ctx, sh.x + Math.cos(t) * r0 * 0.9, sh.y + Math.sin(t) * r0 * 0.9, t, r0 * (0.5 + rnd() * 0.8), rnd, 1.6, '#232528', 1);
    }
    // a beira quebrada (asfalto solto, mais claro) e o fundo
    ctx.fillStyle = '#57595f';
    poly(ctx, scalePts(out, sh.x, sh.y, 1.16));
    ctx.fill();
    ctx.fillStyle = '#1b1c1f';
    poly(ctx, out);
    ctx.fill();
    if (sh.water) {
      const w = scalePts(out, sh.x, sh.y, 0.8);
      ctx.fillStyle = '#34505c';
      smooth(ctx, w);
      ctx.fill();
      ctx.save();
      smooth(ctx, w);
      ctx.clip();
      ctx.fillStyle = 'rgba(170, 198, 210, 0.38)';
      ctx.beginPath();
      ctx.ellipse(sh.x - r0 * 0.25, sh.y - r0 * 0.25, r0 * 0.5, r0 * 0.16, -0.78, 0, M.TAU);
      ctx.fill();
      ctx.restore();
    }
    // pedrinhas soltas em volta
    for (let k = 0; k < 9; k++) {
      const t = rnd() * M.TAU;
      const d = r0 * (1.1 + rnd() * 0.45);
      ctx.fillStyle = rnd() < 0.5 ? '#66696f' : '#45484d';
      ctx.fillRect(sh.x + Math.cos(t) * d, sh.y + Math.sin(t) * d, 3 + rnd() * 4, 2 + rnd() * 3);
    }
  };

  // ------------------------------------------------------------------ poça
  paint.poca = (ctx, sh) => {
    const rx = sh.rx || 60, ry = sh.ry || 40;
    const rnd = seeded(sh.cx, sh.cy, 521);
    const out = blob(sh.cx, sh.cy, rx, ry, 0, 14, 0.18, rnd);
    // asfalto molhado em volta, a água (escura, refletindo o céu) e a beira clara
    ctx.fillStyle = 'rgba(16, 18, 22, 0.3)';
    smooth(ctx, scalePts(out, sh.cx, sh.cy, 1.16));
    ctx.fill();
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = M.shade(sh.color || '#56788c', -0.3);
    smooth(ctx, out);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    smooth(ctx, out);
    ctx.clip();
    ctx.fillStyle = 'rgba(176, 202, 214, 0.26)';
    ctx.beginPath();
    ctx.ellipse(sh.cx - rx * 0.3, sh.cy - ry * 0.3, rx * 0.7, ry * 0.3, -0.5, 0, M.TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 244, 248, 0.45)';
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 2; k++) {
      const x = sh.cx + (rnd() - 0.6) * rx, y = sh.cy + (rnd() - 0.5) * ry;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rx * 0.3, y - ry * 0.1);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(200, 222, 230, 0.3)';
    ctx.lineWidth = 1.8;
    smooth(ctx, out);
    ctx.stroke();
  };

  // ------------------------------------------------------------------ rachadura (com mato, se `mato`)
  paint.rachadura = (ctx, sh, env) => {
    const p0 = sh.pts[0];
    const rnd = seeded(p0.x, p0.y, 531);
    const w = sh.width || 6;
    const color = sh.color || '#1e2022';
    // o traço tremido passando pelos pontos
    const jag = [];
    for (let i = 0; i + 1 < sh.pts.length; i++) {
      const A = sh.pts[i], B = sh.pts[i + 1];
      const L = Math.hypot(B.x - A.x, B.y - A.y);
      const n = Math.max(1, Math.round(L / 10));
      const nx = -(B.y - A.y) / (L || 1), ny = (B.x - A.x) / (L || 1);
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const j = k === 0 ? 0 : (rnd() - 0.5) * 6;
        jag.push({ x: A.x + (B.x - A.x) * t + nx * j, y: A.y + (B.y - A.y) * t + ny * j });
      }
    }
    jag.push(sh.pts[sh.pts.length - 1]);
    // a beira quebrada pega luz (clara, um pouco para cima) e o vão escuro
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    jag.forEach((p, i) => (i ? ctx.lineTo(p.x - 1.5, p.y - 1.5) : ctx.moveTo(p.x - 1.5, p.y - 1.5)));
    ctx.strokeStyle = 'rgba(118, 122, 128, 0.35)';
    ctx.lineWidth = w + 2;
    ctx.stroke();
    ctx.beginPath();
    jag.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    // galhinhos
    for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) {
      const p = jag[Math.floor(rnd() * jag.length)];
      crack(ctx, p.x, p.y, rnd() * M.TAU, 25 + rnd() * 45, rnd, Math.max(1.2, w * 0.4), color, 0);
    }
    if (sh.weeds) {
      for (const p of walk(sh.pts, 36)) if (rnd() < 0.55) tuft(ctx, p.x + (rnd() - 0.5) * 6, p.y + (rnd() - 0.5) * 6, 12 + rnd() * 12, rnd, env.g.cam, rnd() < 0.3);
    }
  };

  // ------------------------------------------------------------------ bueiro (grade na sarjeta)
  paint.bueiro = (ctx, sh) => {
    // grade de 0,9 × 0,4 m colada no meio-fio: `olhando` 0 = o meio-fio vai de leste a oeste (a grade comprida deitada
    // em x); 90 = de norte a sul
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.rotate(((sh.angle || 0) * Math.PI) / 180);
    const L = 90, W = 40; // L ao longo do meio-fio (x local), W para dentro da rua
    ctx.fillStyle = 'rgba(14, 15, 17, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.68, W * 0.95, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#3b3936';
    ctx.fillRect(-L / 2, -W / 2, L, W);
    ctx.fillStyle = '#0c0c0d';
    ctx.fillRect(-L / 2 + 4, -W / 2 + 4, L - 8, W - 8);
    ctx.fillStyle = '#5a5650';
    for (let x = -L / 2 + 8; x < L / 2 - 6; x += 9) ctx.fillRect(x, -W / 2 + 4, 3.6, W - 8);
    ctx.fillStyle = 'rgba(122, 78, 42, 0.3)'; // ferrugem
    ctx.fillRect(L / 6, -W / 2 + 6, L / 4, W - 12);
    ctx.strokeStyle = 'rgba(200, 196, 186, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-L / 2, -W / 2, L, W);
    ctx.restore();
  };

  // ------------------------------------------------------------------ tampa de esgoto
  paint.tampa = (ctx, sh) => {
    const r = sh.r || 35;
    const rnd = seeded(sh.x, sh.y, 541);
    ctx.fillStyle = 'rgba(14, 15, 17, 0.35)';
    ctx.beginPath();
    ctx.arc(sh.x + 2, sh.y + 2, r + 4, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#4b4640';
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, r, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#5f574d';
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, r - 4.5, 0, M.TAU);
    ctx.fill();
    // desenho de ferro fundido: anel, raios e a grade do meio
    ctx.strokeStyle = '#433c35';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, r * 0.62, 0, M.TAU);
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const t = (k / 10) * M.TAU;
      ctx.moveTo(sh.x + Math.cos(t) * r * 0.62, sh.y + Math.sin(t) * r * 0.62);
      ctx.lineTo(sh.x + Math.cos(t) * (r - 6), sh.y + Math.sin(t) * (r - 6));
    }
    for (let g = -2; g <= 2; g++) {
      const o = g * r * 0.2;
      const h = Math.sqrt(Math.max(0, (r * 0.55) ** 2 - o * o));
      ctx.moveTo(sh.x + o, sh.y - h);
      ctx.lineTo(sh.x + o, sh.y + h);
      ctx.moveTo(sh.x - h, sh.y + o);
      ctx.lineTo(sh.x + h, sh.y + o);
    }
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = 'rgba(128, 78, 40, 0.38)';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(sh.x + (rnd() - 0.5) * r, sh.y + (rnd() - 0.5) * r, 5 + rnd() * 8, 3 + rnd() * 5, rnd() * 3, 0, M.TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(232, 226, 214, 0.25)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, r - 1, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();
  };

  // ------------------------------------------------------------------ raízes (figueira da rua e outras árvores)
  // Referência do dono (13/11, mandada no chat): o tronco abre em muitas raízes redondas que serpenteiam pela calçada e
  // pelo asfalto, se dividem, entram no chão e saem adiante, com musgo; em volta, placas de calçada quebradas e
  // levantadas, asfalto partido e folhas secas. O que o dono achou feio antes: um "cano" grosso por igual; galhinhos
  // que pareciam gravetos; "garras" enroladas no pé; a base lisa como uma saia; pontas de tora cortada.
  // Na figueira da rua (`rompendo`), o pé do tronco (props.js, _figButtress) e o chão (aqui) desenham as mesmas
  // raízes: os caminhos saem de figRootPaths, iguais para os dois, e a largura de rootWidth.
  const ROOT = { edge: '#2e241b', groove: 'rgba(40, 30, 22, 0.4)', ramp: ['#2f251c', '#4a3c2f', '#665443', '#857160', '#a58f76'] };
  const ARC = 6;
  const rootTone = (v) => {
    const f = M.clamp(v, 0, 0.999) * (ROOT.ramp.length - 1);
    const i = Math.floor(f);
    return M.mix(ROOT.ramp[i], ROOT.ramp[i + 1], f - i);
  };
  const MOSS = ['rgba(74, 104, 46, 0.85)', 'rgba(92, 124, 54, 0.82)'];
  // lascas do chão levantadas pela raiz, da cor do chão em que ela passa (a de cima de todas as formas no ponto)
  const CHIP = { asfalto: ['#45484e', '#5a5d63'], faixa: ['#45484e', '#5a5d63'], calcada: ['#8f8b81', '#aaa69b'], praca: ['#cbc4b4', '#e0dacb'], terra: ['#5a4632', '#6c5640'], campinho: ['#7a5c3c', '#8c6d4a'] };
  function groundAt(map, x, y) {
    const list = (map && map.shapes) || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (CHIP[s.type] && s.kind !== 'line' && s.kind !== 'point' && G.inside(s, x, y)) return s.type;
    }
    return 'terra';
  }
  function chaikin(pts, times) {
    let line = pts;
    for (let it = 0; it < times; it++) {
      const sm = [line[0]];
      for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i], b = line[i + 1];
        sm.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      sm.push(line[line.length - 1]);
      line = sm;
    }
    return line;
  }
  const lengthOf = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
  // 1 até `a`, cai macio até 0 em `b`
  const fadeOut = (u, a, b) => {
    const t = M.clamp((u - a) / (b - a), 0, 1);
    return 1 - t * t * (3 - 2 * t);
  };
  /** O ponto a `d` cm do começo do caminho (e a direção ali). */
  function along(pts, d) {
    let acc = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      if (acc + l >= d || i + 2 === pts.length) {
        const t = l ? M.clamp((d - acc) / l, 0, 1) : 0;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: Math.atan2(b.y - a.y, b.x - a.x) };
      }
      acc += l;
    }
    const p = pts[0];
    return { x: p.x, y: p.y, a: 0 };
  }
  /** Largura da raiz no chão a `s` cm do começo de um caminho de `len` cm (o pé do tronco usa a mesma conta). */
  const rootWidth = (wa, s, len) => wa * (1 - 0.5 * Math.pow(M.clamp(s / len, 0, 1), 1.1));
  const inHouse = (map, x, y) => (map.houses || []).some((h) => x > h.x0 - 15 && x < h.x1 + 15 && y > h.y0 - 15 && y < h.y1 + 15);
  // raiz não passa por dentro de casa, por baixo do pé de poste ou de semáforo, nem entra no círculo do despertar
  const blocked = (map, x, y) =>
    inHouse(map, x, y) ||
    (map.poles || []).concat(map.trafficLights || []).some((p) => Math.hypot(p.x - x, p.y - y) < 45) ||
    (!!map.awakening && Math.hypot(map.awakening.x - x, map.awakening.y - y) < map.awakening.r + 30);

  /**
   * Caminhos das raízes da figueira da rua, do centro do tronco para fora: as do mapa (`raiz`, do [mundo]) e, nos vãos
   * grandes entre elas, raízes a mais, mais finas (nenhuma entra numa casa). Guardados no mapa: o tronco e o chão
   * pedem os mesmos.
   */
  function figRootPaths(t, map) {
    const cache = map._figPaths || (map._figPaths = new Map());
    if (cache.has(t)) return cache.get(t);
    const R = t.trunk || 90;
    const rnd = seeded(t.x, t.y, 977);
    const out = [];
    for (const s of map.shapes || []) {
      if (s.type !== 'raiz' || !s.pts || !s.pts.length) continue;
      if (Math.hypot(s.pts[0].x - t.x, s.pts[0].y - t.y) > R * 2.5) continue;
      const pts = chaikin([{ x: t.x, y: t.y }].concat(s.pts), 2);
      const end = along(pts, R * 2.3);
      out.push({ shape: s, pts, len: lengthOf(pts), wa: R * 0.8, h0: R * 0.75, a: Math.atan2(end.y - t.y, end.x - t.x) });
    }
    const seeds = out.length ? out.slice().sort((p, q) => p.a - q.a) : [{ a: rnd() * M.TAU, ghost: true }];
    seeds.forEach((r, i) => {
      const next = seeds[(i + 1) % seeds.length];
      const gap = seeds.length === 1 ? M.TAU : (next.a - r.a + M.TAU) % M.TAU;
      const n = Math.floor(gap / 0.85);
      for (let k = 1; k <= n; k++) {
        const a = r.a + (gap * k) / (n + 1) + (rnd() - 0.5) * 0.2;
        const len = R * 1.45 + (t.breaks ? 150 + rnd() * 160 : 110 + rnd() * 90);
        const pts = [{ x: t.x, y: t.y }];
        let x = t.x, y = t.y, ang = a;
        for (let d = 0; d < len; d += 30) {
          if (d > R * 1.8) ang += (rnd() - 0.5) * 0.45 + (a - ang) * 0.12;
          x += Math.cos(ang) * 30;
          y += Math.sin(ang) * 30;
          if (blocked(map, x, y)) break;
          pts.push({ x, y });
        }
        const wa = R * (0.48 + rnd() * 0.14);
        if (lengthOf(pts) < R * (t.breaks ? 2.9 : 2.5)) continue;
        const sm = chaikin(pts, 2);
        out.push({ shape: null, pts: sm, len: lengthOf(sm), wa, h0: R * (0.5 + rnd() * 0.12), a });
      }
    });
    cache.set(t, out);
    return out;
  }

  /**
   * Geometria de uma raiz: para cada ponto, a largura `w`, quanto está fora do chão `k` (1 = lombo inteiro, 0 =
   * enterrada), as beiradas e o corte em meia elipse (lombo redondo). A ponta afunda no fim; num trecho `cut`
   * (opcional) a raiz passa por baixo do chão.
   */
  function rootShape(cam, line, wa, cut, rnd) {
    const pts = walk(line, 6);
    const n = pts.length;
    const len = lengthOf(line);
    const L = cam.light;
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const u = i / Math.max(1, n - 1);
      const w = rootWidth(wa, u * len, len) * (1 + 0.06 * Math.sin(i * 0.55));
      let k = fadeOut(u, 0.8, 1);
      if (cut) {
        const d = i < cut[0] ? cut[0] - i : i > cut[1] ? i - cut[1] : 0;
        k = Math.min(k, M.clamp(d / 4, 0, 1));
      }
      // afundando, a raiz fica rente ao chão e mais estreita, sem contorno: some na terra escura
      const half = (w / 2) * (0.3 + 0.7 * Math.sqrt(k));
      const h = w * 0.26 * k;
      const nx = -Math.sin(p.a), ny = Math.cos(p.a);
      const sx = (-L.x / L.z) * h * 0.5, sy = (-L.y / L.z) * h * 0.5;
      const soil = half + 2.5 + w * 0.16 * (0.5 + rnd() * 0.9) * (0.4 + 0.6 * k);
      const arc = [];
      for (let j = 0; j <= ARC; j++) {
        const th = (j / ARC) * Math.PI;
        const s = Math.cos(th) * half;
        const lz = liftOf(cam, Math.sin(th) * h);
        arc.push({ x: p.x + nx * s - lz, y: p.y + ny * s - lz });
      }
      out.push({
        p, w, k, half, h, nx, ny, arc,
        soilL: { x: p.x + nx * soil, y: p.y + ny * soil },
        soilR: { x: p.x - nx * soil, y: p.y - ny * soil },
        seamL: { x: p.x + nx * (half + 2.5), y: p.y + ny * (half + 2.5) },
        seamR: { x: p.x - nx * (half + 2.5), y: p.y - ny * (half + 2.5) },
        SL: { x: p.x + nx * half * 1.05 + sx, y: p.y + ny * half * 1.05 + sy },
        SR: { x: p.x - nx * half * 1.05 + sx, y: p.y - ny * half * 1.05 + sy },
      });
    }
    return out;
  }
  /** Trechos seguidos em que a raiz está fora do chão (k > 0). */
  function aboveGround(g) {
    const runs = [];
    let run = null;
    g.forEach((q, i) => {
      if (q.k > 0.02) {
        if (!run) {
          run = [];
          run.emerges = i > 0;
        }
        run.push(q);
      } else if (run) {
        runs.push(run);
        run = null;
      }
    });
    if (run) runs.push(run);
    return runs.filter((r) => r.length > 1);
  }
  /**
   * Faixa entre as beiradas `a` e `b` de um trecho, com a ponta arredondada onde a raiz afunda (e no começo, quando ela
   * sai do chão de novo; o começo de verdade fica embaixo do tronco ou da raiz-mãe).
   */
  function band(ctx, run, a, b, capStart) {
    const pts = run.map((q) => q[a]);
    const cap = (q, back) => {
      const A = q[a], B = q[b];
      const cx = (A.x + B.x) / 2, cy = (A.y + B.y) / 2;
      const r = Math.hypot(A.x - B.x, A.y - B.y) / 2 || 1;
      const nx = (A.x - B.x) / (2 * r), ny = (A.y - B.y) / (2 * r);
      const fx = back ? -ny : ny, fy = back ? nx : -nx;
      const out = [];
      for (let s = 1; s < 6; s++) {
        const t = (s / 6) * Math.PI;
        const c = back ? -Math.cos(t) : Math.cos(t);
        out.push({ x: cx + nx * r * c + fx * r * Math.sin(t) * 0.85, y: cy + ny * r * c + fy * r * Math.sin(t) * 0.85 });
      }
      return out;
    };
    pts.push(...cap(run[run.length - 1], false));
    pts.push(...run.map((q) => q[b]).reverse());
    if (capStart) pts.push(...cap(run[0], true));
    poly(ctx, pts);
  }

  /**
   * Uma raiz e seus galhos, pintada no chão. `main` é o caminho (do tronco para fora), `wa` a largura no começo dele.
   * `from`: os galhos e os mergulhos só começam depois desses cm (antes, a raiz está embaixo do pé do tronco).
   */
  function rootNetwork(ctx, cam, map, main, wa, rnd, from, plain) {
    const roots = [];
    const grow = (line, w, depth) => {
      roots.push({ line, wa: w, depth });
      // raiz fina (de árvore pequena, ou já galho) não se divide: os galhinhos pareciam gravetos secos
      if (depth >= (plain ? 1 : 2) || w < 30) return;
      const len = lengthOf(line);
      if (len < 120) return;
      const pts = walk(line, 10);
      const n = depth === 0 ? 1 + (rnd() < 0.6 ? 1 : 0) : rnd() < 0.5 ? 1 : 0;
      let side = rnd() < 0.5 ? 1 : -1;
      const u0 = depth ? 0.2 : Math.max(0.12, Math.min(0.5, from / len));
      for (let k = 0; k < n; k++) {
        const u = u0 + rnd() * (depth ? 0.4 : 0.45);
        if (u > 0.75) continue;
        const at = pts[Math.min(pts.length - 1, Math.floor(u * pts.length))];
        const dir = at.a + side * (0.45 + rnd() * 0.4);
        let a = dir + side * 0.12;
        side = -side;
        const blen = len * (1 - u) * (0.45 + rnd() * 0.35) + 30;
        const bw = rootWidth(w, u * len, len) * 0.55;
        const bend = (rnd() - 0.5) * 0.08;
        const child = [{ x: at.x, y: at.y }];
        let x = at.x, y = at.y;
        for (let d = 0; d < blen; d += 16) {
          a += bend + (dir - a) * 0.06 + (rnd() - 0.5) * 0.18;
          x += Math.cos(a) * 16;
          y += Math.sin(a) * 16;
          if (blocked(map, x, y)) break;
          child.push({ x, y });
        }
        if (lengthOf(child) > bw * 4) grow(chaikin(child, 2), bw, depth + 1);
      }
    };
    grow(main, wa, 0);
    // a geometria de todas (os sorteios sempre na mesma ordem: sai igual em qualquer pedaço da tela)
    const shapes = roots.map((r) => {
      const n = Math.round(lengthOf(r.line) / 6);
      let cut = null;
      const first = r.depth ? 6 : Math.ceil(from / 6) + 6;
      if (r.depth < 2 && n > first + 30 && rnd() < 0.5) {
        const g0 = first + Math.floor((n - first) * (0.15 + rnd() * 0.3));
        cut = [g0, g0 + 6 + Math.floor(rnd() * 5)];
      }
      return { depth: r.depth, g: rootShape(cam, r.line, r.wa, cut, rnd), cut };
    });
    // o chão trincado em volta da principal (na mata, não)
    const mp = walk(main, 8);
    for (let i = 4; i < mp.length; i += 4) {
      if (rnd() < 0.6 || i * 8 < from || plain) continue;
      const p = mp[i];
      const t = p.a + (rnd() < 0.5 ? 1 : -1) * (Math.PI / 2 + (rnd() - 0.5) * 0.8);
      crack(ctx, p.x + Math.cos(t) * wa * 0.4, p.y + Math.sin(t) * wa * 0.4, t, 18 + rnd() * 36, rnd, 1.5, '#232528', 1);
    }
    // 1) o chão rompido: terra escura em volta e a fresta mais escura colada na raiz (todas antes dos corpos, para os
    //    galhos saírem da principal sem uma faixa de terra no meio)
    ctx.fillStyle = plain ? 'rgba(34, 40, 22, 0.35)' : 'rgba(48, 38, 28, 0.45)';
    for (const s of shapes) {
      smooth(ctx, s.g.map((q) => q.soilL).concat(s.g.map((q) => q.soilR).reverse()));
      ctx.fill();
    }
    ctx.fillStyle = plain ? 'rgba(18, 20, 10, 0.4)' : 'rgba(18, 14, 10, 0.55)';
    for (const s of shapes) for (const run of aboveGround(s.g)) {
      band(ctx, run, 'seamL', 'seamR', run.emerges);
      ctx.fill();
    }
    // onde a raiz entra no chão (e onde sai): terra escura embaixo da ponta, que some nela, e lascas do chão adiante
    const dive = (q, back) => {
      const f = back ? -1 : 1;
      const fx = Math.cos(q.p.a) * f, fy = Math.sin(q.p.a) * f;
      const w = Math.max(q.half * 2, 10);
      ctx.fillStyle = 'rgba(26, 20, 15, 0.55)';
      smooth(ctx, blob(q.p.x + fx * w * 0.3, q.p.y + fy * w * 0.3, w * 0.55 + 4, w * 0.5 + 3, q.p.a, 9, 0.4, rnd));
      ctx.fill();
      for (let c = 0; c < (plain ? 0 : 2); c++) {
        const t = q.p.a + (back ? Math.PI : 0) + (rnd() - 0.5) * 1.6;
        const d = w * 0.75 + 6 + rnd() * 6;
        const x = q.p.x + Math.cos(t) * d, y = q.p.y + Math.sin(t) * d;
        const col = CHIP[groundAt(map, x, y)] || CHIP.terra;
        const pts = blob(x, y, 3 + rnd() * 4, 2 + rnd() * 3, t, 5, 0.6, rnd);
        poly(ctx, pts);
        ctx.fillStyle = col[0];
        ctx.fill();
        ctx.strokeStyle = col[1];
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    };
    for (const s of shapes) for (const run of aboveGround(s.g)) {
      dive(run[run.length - 1], false);
      if (run.emerges) dive(run[0], true);
    }
    // 2) lascas do chão levantadas nas beiradas, onde a raiz rompeu
    for (const s of shapes) {
      s.g.forEach((q, i) => {
        if (plain || q.k < 0.35 || q.w < 9 || rnd() > 0.14 || i * 6 < (s.depth ? 0 : from)) return;
        const sideK = rnd() < 0.5 ? 1 : -1;
        const nx = -Math.sin(q.p.a) * sideK, ny = Math.cos(q.p.a) * sideK;
        const d = q.half + 3 + rnd() * q.w * 0.12;
        const cx = q.p.x + nx * d, cy = q.p.y + ny * d;
        const col = CHIP[groundAt(map, cx, cy)] || CHIP.terra;
        const s1 = 3 + rnd() * Math.min(9, q.w * 0.18);
        const pts = blob(cx, cy, s1 * 1.3, s1 * 0.8, q.p.a + (rnd() - 0.5) * 0.8, 5, 0.6, rnd);
        poly(ctx, pts);
        ctx.fillStyle = col[0];
        ctx.fill();
        ctx.strokeStyle = col[1];
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.lineTo(pts[3].x, pts[3].y);
        ctx.stroke();
      });
    }
    // 3) os corpos: a sombra; em pedaços curtos (a raiz faz curva e a luz muda), as faixas do lombo de trás para a
    //    frente, cada uma com a cor da luz que recebe; antes, o contorno de todas onde a raiz está bem fora do chão
    const runs = [];
    shapes.slice().sort((a, b) => b.depth - a.depth).forEach((s) => runs.push(...aboveGround(s.g)));
    ctx.fillStyle = 'rgba(10, 10, 12, 0.24)';
    for (const run of runs) {
      band(ctx, run, 'SL', 'SR', run.emerges);
      ctx.fill();
    }
    const L3 = cam.light;
    const tc = cam.toCamera;
    const pieces = [];
    for (const run of runs) {
      for (let i0 = 0; i0 < run.length - 1; i0 += 8) {
        const seg = run.slice(i0, Math.min(run.length, i0 + 9));
        const m = seg[Math.floor(seg.length / 2)];
        const faces = [];
        for (let j = 0; j < ARC; j++) {
          const th = ((j + 0.5) / ARC) * Math.PI;
          const ns = Math.cos(th) * Math.max(m.h, 0.5), nz = Math.sin(th) * Math.max(m.half, 1);
          const nl = Math.hypot(ns, nz) || 1;
          const N3 = { x: (m.nx * ns) / nl, y: (m.ny * ns) / nl, z: nz / nl };
          faces.push({ j, color: rootTone(0.2 + (N3.x * L3.x + N3.y * L3.y + N3.z * L3.z) * 0.78), face: N3.x * tc.x + N3.y * tc.y + N3.z * tc.z });
        }
        faces.sort((a, b) => a.face - b.face);
        pieces.push({ seg, faces });
      }
    }
    const facePts = (seg, j) => seg.map((q) => q.arc[j]).concat(seg.map((q) => q.arc[j + 1]).reverse());
    ctx.strokeStyle = ROOT.edge;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    for (const pc of pieces) {
      const seg = pc.seg.filter((q) => q.k > 0.5);
      if (seg.length < 2) continue;
      for (let j = 0; j < ARC; j++) {
        poly(ctx, facePts(seg, j));
        ctx.stroke();
      }
    }
    for (const pc of pieces) {
      for (const f of pc.faces) {
        poly(ctx, facePts(pc.seg, f.j));
        ctx.fillStyle = f.color;
        ctx.fill();
        // a mesma cor no risco fino tapa a fresta entre as faixas
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
    // sulco da casca no alto do lombo e musgo aqui e ali
    ctx.lineCap = 'round';
    ctx.strokeStyle = ROOT.groove;
    for (const run of runs) {
      for (let i = 0; i + 1 < run.length; i++) {
        if (run[i].half < 6 || run[i].k < 0.6) continue;
        const a = run[i].arc[ARC / 2 - 1], b = run[i + 1].arc[ARC / 2 - 1];
        ctx.lineWidth = Math.max(0.8, run[i].half * 0.1);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    for (const run of runs) {
      run.forEach((q) => {
        if (q.k < 0.75 || q.half < 7 || rnd() > 0.07) return;
        const top = q.arc[ARC / 2];
        ctx.fillStyle = MOSS[rnd() < 0.5 ? 0 : 1];
        smooth(ctx, blob(top.x, top.y, q.half * (0.6 + rnd() * 0.5), q.half * (0.3 + rnd() * 0.2), q.p.a, 11, 0.8, rnd));
        ctx.fill();
        ctx.fillStyle = 'rgba(160, 182, 92, 0.85)';
        for (let d = 0; d < 3; d++) {
          ctx.beginPath();
          ctx.arc(top.x + (rnd() - 0.5) * q.half * 0.8, top.y + (rnd() - 0.5) * q.half * 0.5, 1.2 + rnd() * 1.4, 0, M.TAU);
          ctx.fill();
        }
      });
    }
    // 4) onde a raiz passa por baixo, o chão só estufa e trinca por cima; depois da ponta, a trinca continua
    for (const s of shapes) {
      if (s.cut && !plain) {
        const seg = s.g.slice(Math.max(0, s.cut[0] - 2), Math.min(s.g.length, s.cut[1] + 3));
        ctx.strokeStyle = '#232528';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        seg.forEach((q, i) => {
          const j = (rnd() - 0.5) * 4;
          const x = q.p.x - Math.sin(q.p.a) * j, y = q.p.y + Math.cos(q.p.a) * j;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
      }
      const tip = s.g[s.g.length - 1];
      if (tip && !plain) crack(ctx, tip.p.x, tip.p.y, tip.p.a, 26 + rnd() * 50, rnd, 1.6, '#232528', s.depth ? 0 : 1);
    }
  }

  paint.raiz = (ctx, sh, env) => {
    const cam = env.g.cam;
    const map = env.map;
    const p0 = sh.pts[0];
    const rnd = seeded(p0.x, p0.y, 551);
    // a árvore em que a raiz começa: a figueira da rua dá o caminho (o mesmo do pé do tronco); as outras, a largura
    let tree = null;
    let best = 400;
    for (const t of (map && map.trees) || []) {
      const d = Math.hypot(t.x - p0.x, t.y - p0.y);
      if (d < best) {
        best = d;
        tree = t;
      }
    }
    const fig = tree && (tree.breaks || tree.kind === 'figueira') ? figRootPaths(tree, map).find((r) => r.shape === sh) : null;
    const base = sh.width || 35;
    const wa = fig ? fig.wa : tree ? M.clamp(tree.trunk * 2 * 0.36, base * 0.8, base * 2) : base;
    const from = fig ? (tree.trunk || 90) * 2.2 : 0;
    // o caminho, macio, serpenteando um pouco longe do tronco (perto dele, igual ao pé do tronco)
    const ph = rnd() * M.TAU;
    const raw = walk(fig ? fig.pts : chaikin(sh.pts, 2), 12);
    const total = Math.max(1, raw.length - 1);
    const wav = raw.map((p, i) => {
      const s = (i / total) * lengthOf(raw);
      const ramp = fig ? M.clamp((s - from - 40) / 100, 0, 1) : Math.min(1, (i / total) * 3);
      const off = wa * 0.3 * Math.sin((i / total) * 6 + ph) * ramp;
      return { x: p.x - Math.sin(p.a) * off, y: p.y + Math.cos(p.a) * off };
    });
    rootNetwork(ctx, cam, map, chaikin(wav, 1), wa, rnd, from);
  };
  // até onde os galhos das raízes podem ir além da linha do mapa (para o chão pintar o pedaço da tela em que caem)
  const reach = { raiz: 260 };

  // ------------------------------------------------------------------ capim (planta `capim` na camada do chão)
  paint.planta = (ctx, sh, env) => {
    if (sh.plant && sh.plant !== 'capim') return;
    const r = sh.r || 26;
    const rnd = seeded(sh.x, sh.y, 561);
    const n = 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k++) tuft(ctx, sh.x + (rnd() - 0.5) * r, sh.y + (rnd() - 0.5) * r, r * (0.7 + rnd() * 0.5), rnd, env.g.cam, rnd() < 0.35);
  };

  // ------------------------------------------------------------------ musgo na praça
  function moss(ctx, sh, box, seed, g) {
    ctx.save();
    G.shapePath(ctx, sh);
    ctx.clip();
    const MOSS = ['rgba(77, 106, 52, 0.62)', 'rgba(92, 123, 60, 0.55)', 'rgba(63, 90, 43, 0.6)'];
    eachCell(sh, box, 150, seed + 601, (r, x0, y0) => {
      // mais musgo perto da beira da praça (a mata entra pelas bordas)
      const edge = Math.min(x0 - sh.x0, sh.x1 - x0 - 150, y0 - sh.y0, sh.y1 - y0 - 150) < 160;
      if (r() < (edge ? 0.85 : 0.55)) {
        const cx = x0 + r() * 150, cy = y0 + r() * 150;
        for (let k = 0; k < 8 + Math.floor(r() * 7); k++) {
          ctx.fillStyle = MOSS[Math.floor(r() * MOSS.length)];
          ctx.beginPath();
          ctx.ellipse(cx + (r() - 0.5) * 90, cy + (r() - 0.5) * 60, 10 + r() * 26, 7 + r() * 16, r() * 3, 0, M.TAU);
          ctx.fill();
        }
      }
      if (r() < 0.32) tuft(ctx, x0 + r() * 150, y0 + r() * 150, 13 + r() * 12, r, g.cam, r() < 0.3);
      if (edge && r() < 0.4) tuft(ctx, x0 + r() * 150, y0 + r() * 150, 15 + r() * 12, r, g.cam, false);
    });
    ctx.restore();
  }

  // ------------------------------------------------------------------ campinho de terra
  texture.campinho = (ctx, sh, box, seed, g) => {
    if (sh.kind !== 'rect') return false;
    const b = sh;
    ctx.save();
    G.shapePath(ctx, sh);
    ctx.clip();
    ctx.fillStyle = '#8c6b47';
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    // terra batida: manchas mais claras no meio (onde mais se joga) e mais escuras na beira, pedrinhas
    eachCell(sh, box, 200, seed + 701, (r, x0, y0) => {
      if (r() < 0.45) {
        ctx.fillStyle = r() < 0.5 ? 'rgba(180, 146, 104, 0.08)' : 'rgba(70, 50, 30, 0.06)';
        ctx.beginPath();
        ctx.ellipse(x0 + r() * 200, y0 + r() * 200, 40 + r() * 90, 25 + r() * 50, r() * 3, 0, M.TAU);
        ctx.fill();
      }
      for (let k = 0; k < 10; k++) {
        ctx.fillStyle = r() < 0.5 ? '#6f5236' : '#a7896a';
        ctx.fillRect(x0 + r() * 200, y0 + r() * 200, 2 + r() * 3, 2 + r() * 2);
      }
    });
    // grama tomando as beiradas
    ctx.fillStyle = 'rgba(78, 118, 52, 0.55)';
    const r = seeded(b.x0, b.y0, 709);
    const edge = (x, y) => {
      ctx.beginPath();
      ctx.ellipse(x, y, 30 + r() * 60, 18 + r() * 30, r() * 3, 0, M.TAU);
      ctx.fill();
    };
    for (let x = b.x0; x < b.x1; x += 70) {
      if (r() < 0.6) edge(x, b.y0 + r() * 30);
      if (r() < 0.6) edge(x, b.y1 - r() * 30);
    }
    for (let y = b.y0; y < b.y1; y += 70) {
      if (r() < 0.6) edge(b.x0 + r() * 30, y);
      if (r() < 0.6) edge(b.x1 - r() * 30, y);
    }
    if (sh.lines) {
      // as linhas de cal, gastas
      const along = b.x1 - b.x0 >= b.y1 - b.y0;
      const m = 60;
      const X0 = b.x0 + m, X1 = b.x1 - m, Y0 = b.y0 + m, Y1 = b.y1 - m;
      ctx.strokeStyle = 'rgba(236, 230, 214, 0.62)';
      ctx.lineWidth = 8;
      ctx.setLineDash([210, 14, 90, 10]);
      ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
      const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
      ctx.beginPath();
      if (along) {
        ctx.moveTo(cx, Y0);
        ctx.lineTo(cx, Y1);
      } else {
        ctx.moveTo(X0, cy);
        ctx.lineTo(X1, cy);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(X1 - X0, Y1 - Y0) * 0.17, 0, M.TAU);
      ctx.stroke();
      // as áreas do gol, uma em cada ponta
      const ga = Math.min(X1 - X0, Y1 - Y0) * 0.4;
      const gd = Math.min(X1 - X0, Y1 - Y0) * 0.16;
      if (along) {
        ctx.strokeRect(X0, cy - ga / 2, gd, ga);
        ctx.strokeRect(X1 - gd, cy - ga / 2, gd, ga);
      } else {
        ctx.strokeRect(cx - ga / 2, Y0, ga, gd);
        ctx.strokeRect(cx - ga / 2, Y1 - gd, ga, gd);
      }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(236, 230, 214, 0.7)';
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, M.TAU);
      ctx.fill();
    }
    ctx.restore();
    void g;
    return true;
  };

  // ------------------------------------------------------------------ o chão no pé das figueiras
  // A da esquina (`rompendo`) quebrou a rua; a da mata só tem a terra e as raízes.
  function breaks(ctx, t, env) {
    const { map } = env;
    const cam = env.g.cam;
    const R = Math.max(60, t.trunk || 60);
    if (!t.breaks) {
      // figueira da mata (a dos Despertos): só a terra escura no pé e as raízes, sem placas nem folhas da rua
      const rs = seeded(t.x, t.y, 813);
      ctx.fillStyle = 'rgba(52, 38, 26, 0.75)';
      smooth(ctx, blob(t.x, t.y, R * 1.9, R * 1.7, rs() * 3, 14, 0.3, rs));
      ctx.fill();
      for (const r of figRootPaths(t, map)) {
        if (r.shape) continue;
        const end = r.pts[r.pts.length - 1];
        rootNetwork(ctx, cam, map, r.pts, r.wa, seeded(end.x, end.y, 553), R * 2.2, true);
      }
      return;
    }
    const rnd = seeded(t.x, t.y, 811);
    // terra escura aparecendo em volta do tronco, com manchas
    ctx.fillStyle = '#3f2f21';
    smooth(ctx, blob(t.x, t.y, R * 2.0, R * 1.8, rnd() * 3, 16, 0.3, rnd));
    ctx.fill();
    for (let k = 0; k < 14; k++) {
      const a = rnd() * M.TAU, d = rnd() * R * 1.8;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(30, 22, 15, 0.5)' : 'rgba(92, 72, 50, 0.4)';
      smooth(ctx, blob(t.x + Math.cos(a) * d, t.y + Math.sin(a) * d, 10 + rnd() * 22, 7 + rnd() * 14, rnd() * 3, 7, 0.5, rnd));
      ctx.fill();
    }
    // placas do chão quebradas e levantadas pelas raízes (como na referência do dono): a fresta escura, o lado que
    // aparece onde a placa subiu e o topo da cor do chão do lugar (calçada clara, asfalto escuro), com beirada clara
    const L = cam.light;
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 13 : 9;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * M.TAU + rnd() * 0.45 + ring * 0.31;
        const d = R * (ring ? 2.75 + rnd() * 0.9 : 1.95 + rnd() * 0.45);
        const size = (ring ? 34 : 28) + rnd() * 30;
        const lift = 2 + rnd() * (ring ? 6 : 10);
        const skip = rnd() < 0.18;
        const x = t.x + Math.cos(a) * d, y = t.y + Math.sin(a) * d;
        const ta = a + Math.PI / 2;
        const ca = Math.cos(ta), sa = Math.sin(ta), cr = Math.cos(a), sr = Math.sin(a);
        const lx = size * (0.8 + rnd() * 0.5), ly = size * (0.55 + rnd() * 0.35);
        const quad = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
          const ju = u * lx * (0.8 + rnd() * 0.35), jv = v * ly * (0.8 + rnd() * 0.35);
          return { x: x + ca * ju + cr * jv, y: y + sa * ju + sr * jv };
        });
        const cracked = rnd() < 0.5;
        const weed = rnd() < 0.35;
        if (skip || inHouse(map, x, y)) continue;
        const kind = groundAt(map, x, y);
        const slab = kind === 'calcada' || kind === 'praca';
        const col = slab ? ['#a29d90', '#6f6b62', '#c4bfb1'] : kind === 'terra' ? ['#5a4632', '#3e3022', '#6c5640'] : ['#474a50', '#2a2c30', '#5e6168'];
        if (!slab) for (const p of quad) {
          p.x = x + (p.x - x) * 0.62;
          p.y = y + (p.y - y) * 0.62;
        }
        const up = liftOf(cam, slab ? lift : 1 + lift * 0.2);
        const top = quad.map((p) => ({ x: p.x - up, y: p.y - up }));
        ctx.fillStyle = 'rgba(20, 16, 12, 0.8)';
        poly(ctx, scalePts(quad, x, y, 1.12));
        ctx.fill();
        ctx.fillStyle = col[1];
        for (let i = 0; i < 4; i++) {
          poly(ctx, [quad[i], quad[(i + 1) % 4], top[(i + 1) % 4], top[i]]);
          ctx.fill();
        }
        ctx.fillStyle = col[0];
        poly(ctx, top);
        ctx.fill();
        ctx.strokeStyle = 'rgba(20, 16, 12, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // beirada clara nos lados que olham para a luz
        ctx.strokeStyle = col[2];
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const p = top[i], q = top[(i + 1) % 4];
          const mx = (p.x + q.x) / 2 - (x - up), my = (p.y + q.y) / 2 - (y - up);
          if (mx * L.x + my * L.y > 0) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
        if (cracked) crack(ctx, x - up, y - up, a + (rnd() - 0.5), size * 0.8, rnd, 1.3, 'rgba(30, 28, 26, 0.75)', 0);
        if (weed) tuft(ctx, quad[2].x, quad[2].y, 12 + rnd() * 8, rnd, cam, rnd() < 0.3);
      }
    }
    // trincas saindo para todo lado
    for (let k = 0; k < 9; k++) {
      const a = rnd() * M.TAU;
      crack(ctx, t.x + Math.cos(a) * R * 1.9, t.y + Math.sin(a) * R * 1.9, a, R * (1.2 + rnd() * 2.2), rnd, 2.2, '#222428', 2);
    }
    // folhas secas pelo chão
    const LEAF = ['#b5652e', '#8f4a22', '#c98a3a', '#7a4a26', '#a8743a'];
    for (let k = 0; k < 70; k++) {
      const a = rnd() * M.TAU, d = R * (1.2 + rnd() * 3.6);
      const x = t.x + Math.cos(a) * d, y = t.y + Math.sin(a) * d;
      const rot = rnd() * M.TAU, l = 5 + rnd() * 4, w = l * (0.4 + rnd() * 0.15);
      const c = LEAF[Math.floor(rnd() * LEAF.length)];
      if (inHouse(map, x, y)) continue;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x, y, l, w, rot, 0, M.TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60, 34, 18, 0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(rot) * l, y - Math.sin(rot) * l);
      ctx.lineTo(x + Math.cos(rot) * l, y + Math.sin(rot) * l);
      ctx.stroke();
    }
    // as raízes a mais (as dos vãos entre as do mapa): as do mapa são pintadas por paint.raiz, por cima destas
    for (const r of figRootPaths(t, map)) {
      if (r.shape) continue;
      const end = r.pts[r.pts.length - 1];
      rootNetwork(ctx, cam, map, r.pts, r.wa, seeded(end.x, end.y, 553), R * 2.2);
    }
  }

  PD.street = { paint, texture, moss, breaks, reach, figRootPaths, rootWidth, along };
})(window.PD = window.PD || {});
