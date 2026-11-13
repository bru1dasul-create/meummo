// A cidade tomada pela mata, os objetos em pé (planta da rua da Budega aprovada pelo dono em 13/11,
// docs/referencias/rua-budega-planta.jpg): a placa azul de rua (as de São Paulo), a moto enferrujada com mato, a cadeira
// de plástico, o vaso de espada-de-são-jorge, os sacos de lixo, as bandeirinhas da praça e o cipó subindo pelos postes e
// pendurado nos fios. Mesmo traço do resto do cenário (contorno de tinta, lado da sombra mais escuro).
//   PD.city.small[tipo]           = { height, blocks, box, shadow, paint }   (o props.js usa como as plantas)
//   PD.city.bunting(ctx, cam, b, t) → um cordão de bandeirinhas (a cada quadro: elas balançam)
//   PD.city.wireVines(ctx, cam, pts, seed, t) → cipó pendurado num fio
//   PD.city.poleVine(ctx, cam, p, z0, h, ink) → cipó subindo pelo poste
(function (PD) {
  'use strict';
  const M = PD.math;
  const H = PD.props.help;
  const { INK } = H;

  const seeded = (x, y, k) => M.rng((Math.round(x * 3.7) * 73856093) ^ (Math.round(y * 5.3) * 19349663) ^ (k * 83492791));
  function poly(ctx, pts) {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
  }
  function inkPoly(ctx, pts, color, ink, w = 2.2) {
    poly(ctx, pts);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * w;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function inkLine(ctx, pts, color, w, ink) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + ink * 2;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  /** Referencial do objeto: f = para a frente (`olhando`), s = para o lado, z = para cima. */
  function frame(x, y, deg) {
    const a = ((deg || 0) * Math.PI) / 180;
    const c = Math.cos(a), s = Math.sin(a);
    return (f, sd, z) => ({ x: x + c * f - s * sd, y: y + s * f + c * sd, z });
  }
  /** Caixa girada (as faces viradas para a câmera, a de cima por último). */
  function obox(ctx, cam, L, f0, f1, s0, s1, z0, z1, col, ink) {
    const P = (f, s, z) => cam.p(L(f, s, z));
    const tc = cam.toCamera;
    const o = L(0, 0, 0);
    const dir = (f, s) => {
      const p = L(f, s, 0);
      return { x: p.x - o.x, y: p.y - o.y };
    };
    const faces = [];
    const fF = dir(1, 0), fS = dir(0, 1);
    if (fF.x * tc.x + fF.y * tc.y > 0) faces.push([[f1, s0], [f1, s1]]);
    else faces.push([[f0, s1], [f0, s0]]);
    if (fS.x * tc.x + fS.y * tc.y > 0) faces.push([[f1, s1], [f0, s1]]);
    else faces.push([[f0, s0], [f1, s0]]);
    faces.forEach(([[fa, sa], [fb, sb]], i) => {
      inkPoly(ctx, [P(fa, sa, z0), P(fb, sb, z0), P(fb, sb, z1), P(fa, sa, z1)], i === 0 ? col.front : col.side, ink);
    });
    inkPoly(ctx, [P(f0, s0, z1), P(f1, s0, z1), P(f1, s1, z1), P(f0, s1, z1)], col.top, ink);
  }
  /** Roda em pé no plano (frente, cima): pneu escuro e aro. */
  function wheel(ctx, cam, L, fc, s, r, ink) {
    const out = [], rim = [];
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * M.TAU;
      out.push(cam.p(L(fc + Math.cos(t) * r, s, r + Math.sin(t) * r)));
      rim.push(cam.p(L(fc + Math.cos(t) * r * 0.62, s, r + Math.sin(t) * r * 0.62)));
    }
    inkPoly(ctx, out, '#262421', ink, 2);
    poly(ctx, rim);
    ctx.fillStyle = '#6d625a';
    ctx.fill();
    ctx.strokeStyle = '#3a332e';
    ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
    const c = cam.p(L(fc, s, r));
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(rim[k * 4].x, rim[k * 4].y);
    }
    ctx.stroke();
  }
  /** Tufo de capim em pé (na tela). */
  function grassTuft(ctx, q, size, rnd, ink) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const h = size * (0.6 + rnd() * 0.6);
      const lean = (rnd() - 0.5) * size * 0.9;
      const bx = q.x + (rnd() - 0.5) * size * 0.5;
      ctx.beginPath();
      ctx.moveTo(bx, q.y);
      ctx.quadraticCurveTo(bx + lean * 0.3, q.y - h * 0.6, bx + lean, q.y - h);
      ctx.strokeStyle = 'rgba(24, 38, 20, 0.8)';
      ctx.lineWidth = Math.max(1.6, size * 0.16) + ink * 0.4;
      ctx.stroke();
      ctx.strokeStyle = ['#6f9a45', '#5d8a3a', '#86ad55', '#a3b25a'][Math.floor(rnd() * 4)];
      ctx.lineWidth = Math.max(1, size * 0.09);
      ctx.stroke();
    }
  }
  /** Ramo de cipó: um fio verde e folhinhas em volta (pontos na tela). */
  function vineStrand(ctx, pts, rnd, zoom, ink) {
    if (pts.length < 2) return;
    inkLine(ctx, pts, '#3d6a32', Math.max(1.4, 2.4 * zoom), ink * 0.6);
    for (let i = 1; i < pts.length; i++) {
      if (rnd() > 0.75) continue;
      const q = pts[i];
      const a = rnd() * M.TAU;
      const w = (6 + rnd() * 5) * zoom;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(q.x + Math.cos(a) * w * 0.6, q.y + Math.sin(a) * w * 0.6, w + ink * 0.6, w * 0.55 + ink * 0.6, a, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = rnd() < 0.5 ? '#4f8a3c' : '#3c7232';
      ctx.beginPath();
      ctx.ellipse(q.x + Math.cos(a) * w * 0.6, q.y + Math.sin(a) * w * 0.6, w, w * 0.55, a, 0, M.TAU);
      ctx.fill();
    }
  }

  const small = {};

  // ------------------------------------------------------------------ placa azul de rua (as de São Paulo)
  // poste fino e duas placas cruzadas no alto: a de cima ao longo de x (texto), a de baixo ao longo de y (texto2)
  small['placa-rua'] = {
    height: () => 270,
    blocks: 0.2,
    shadow: (path, cam, d) => H.lineShadow(path, cam, d.x, d.y, 260, 5),
    plates(d) {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = '700 12px system-ui, sans-serif';
      const w = (t) => Math.max(64, Math.ceil(ctx.measureText(t || '').width) + 18);
      return [{ text: d.text || '', w: w(d.text) }, { text: d.text2 || '', w: w(d.text2) }];
    },
    paint(ctx, cam, d, z0, ink) {
      const [a, b] = this.plates(d);
      const base = cam.p({ x: d.x, y: d.y, z: z0 });
      const top = cam.p({ x: d.x, y: d.y, z: z0 + 270 });
      inkLine(ctx, [base, top], '#4a4f55', 5 * cam.zoom, ink);
      const plate = (o, dir, p) => {
        ctx.save();
        const m = cam.wallMatrix(o, dir);
        ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        const W = p.w, Hh = 24;
        ctx.fillStyle = INK;
        ctx.fillRect(-1.5, -1.5, W + 3, Hh + 3);
        ctx.fillStyle = '#1f4e9a';
        ctx.fillRect(0, 0, W, Hh);
        ctx.strokeStyle = '#f2f0e8';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(2.5, 2.5, W - 5, Hh - 5);
        ctx.fillStyle = '#f7f5ee';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, W / 2, Hh / 2 + 0.5);
        // ferrugem nos parafusos
        ctx.fillStyle = 'rgba(150, 90, 50, 0.55)';
        ctx.fillRect(4, Hh - 6, 3, 3);
        ctx.fillRect(W - 7, Hh - 6, 3, 3);
        ctx.restore();
      };
      // a de baixo (ao longo de y, virada para +x) e a de cima (ao longo de x, virada para +y)
      plate({ x: d.x + 3, y: d.y + b.w / 2, z: z0 + 246 }, { x: 0, y: -1 }, b);
      plate({ x: d.x - a.w / 2, y: d.y + 3, z: z0 + 274 }, { x: 1, y: 0 }, a);
    },
  };

  // ------------------------------------------------------------------ moto enferrujada com mato
  small.moto = {
    height: (d) => d.h || 110,
    blocks: 0,
    shadow: (path, cam, d) => H.circleShadow(path, cam, (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, 70, 50),
    box(cam, d, z0) {
      const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
      const pts = [];
      for (const [x, y] of [[-110, -60], [110, -60], [110, 60], [-110, 60]]) pts.push(cam.p({ x: cx + x, y: cy + y, z: z0 }), cam.p({ x: cx + x, y: cy + y, z: z0 + 130 }));
      return bboxOf(pts, 14 * cam.zoom);
    },
    paint(ctx, cam, d, z0, ink) {
      const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
      const L0 = frame(cx, cy, d.angle);
      // apoiada no descanso: o corpo inclina um pouco para o lado
      const lean = 0.18;
      const L = (f, s, z) => L0(f, s + z * lean, z0 + z);
      const rnd = seeded(cx, cy, 901);
      const col = d.color || '#8a3a2a';
      const P = (f, s, z) => cam.p(L(f, s, z));
      // capim em volta das rodas (atrás)
      for (const f of [-62, 64]) grassTuft(ctx, P(f, -14, 0), 22 * cam.zoom, rnd, ink);
      wheel(ctx, cam, L, -62, 0, 29, ink);
      // escapamento, motor e quadro
      inkLine(ctx, [P(-20, 12, 30), P(-80, 14, 38)], '#6a5f55', 6 * cam.zoom, ink);
      obox(ctx, cam, L, -18, 20, -12, 12, 26, 58, { front: '#3b332d', side: '#2b2622', top: '#4a413a' }, ink);
      inkLine(ctx, [P(-60, 0, 32), P(-20, 0, 70), P(40, 0, 72)], M.shade(col, -0.25), 7 * cam.zoom, ink);
      // tanque e banco
      obox(ctx, cam, L, 0, 38, -13, 13, 64, 86, { front: col, side: M.shade(col, -0.25), top: M.shade(col, 0.15) }, ink);
      obox(ctx, cam, L, -52, 2, -11, 11, 70, 80, { front: '#2a2420', side: '#1e1a17', top: '#3a332d' }, ink);
      // ferrugem no tanque e o mato que subiu
      ctx.fillStyle = 'rgba(154, 90, 50, 0.6)';
      for (let k = 0; k < 4; k++) {
        const q = P(4 + rnd() * 30, 13, 66 + rnd() * 18);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, (3 + rnd() * 5) * cam.zoom, (2 + rnd() * 3) * cam.zoom, rnd() * 3, 0, M.TAU);
        ctx.fill();
      }
      // garfo, guidão e farol
      inkLine(ctx, [P(64, 0, 30), P(50, 0, 98)], '#8d8780', 4 * cam.zoom, ink);
      inkLine(ctx, [P(50, -34, 104), P(50, 34, 104)], '#3a3532', 4 * cam.zoom, ink);
      const hl = P(60, 0, 92);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(hl.x, hl.y, 7 * cam.zoom + ink, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#c9c2a2';
      ctx.beginPath();
      ctx.arc(hl.x, hl.y, 7 * cam.zoom, 0, M.TAU);
      ctx.fill();
      wheel(ctx, cam, L, 64, 0, 29, ink);
      if (d.weeds) {
        // cipó por cima do tanque e do banco, e capim na frente
        const pts = [];
        for (let k = 0; k <= 8; k++) pts.push(P(-56 + k * 14, 6 + Math.sin(k) * 6, 82 + Math.sin(k * 1.7) * 8));
        vineStrand(ctx, pts, rnd, cam.zoom, ink);
        for (const f of [-40, 20, 70]) grassTuft(ctx, P(f, 18, 0), 26 * cam.zoom, rnd, ink);
      }
    },
  };

  // ------------------------------------------------------------------ cadeira de plástico (as brancas de bar)
  small.cadeira = {
    height: () => 85,
    blocks: 0,
    shadow: (path, cam, d) => H.circleShadow(path, cam, d.x, d.y, 26, 40),
    box: (cam, d, z0) => bboxOf([cam.p({ x: d.x - 40, y: d.y + 40, z: z0 }), cam.p({ x: d.x + 40, y: d.y - 40, z: z0 }), cam.p({ x: d.x - 40, y: d.y - 40, z: z0 + 95 }), cam.p({ x: d.x + 40, y: d.y + 40, z: z0 + 95 })], 10 * cam.zoom),
    paint(ctx, cam, d, z0, ink) {
      const L0 = frame(d.x, d.y, d.angle);
      const L = (f, s, z) => L0(f, s, z0 + z);
      const P = (f, s, z) => cam.p(L(f, s, z));
      const c = d.color || '#f2f2ee';
      const sh = M.shade(c, -0.18);
      const tc = cam.toCamera;
      const o = L(0, 0, 0), fwd = L(1, 0, 0);
      const facing = (fwd.x - o.x) * tc.x + (fwd.y - o.y) * tc.y > 0; // a frente da cadeira virada para a câmera?
      const legs = [[16, -17], [16, 17], [-16, -17], [-16, 17]];
      const leg = ([f, s]) => inkLine(ctx, [P(f * 1.15, s * 1.15, 0), P(f, s, 40)], sh, 3.2 * cam.zoom, ink * 0.8);
      const back = () => {
        // encosto com as frestas
        const pts = [P(-18, -19, 42), P(-18, 19, 42), P(-24, 19, 82), P(-24, -19, 82)];
        inkPoly(ctx, pts, facing ? c : sh, ink);
        ctx.strokeStyle = facing ? sh : M.shade(sh, -0.15);
        ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
        ctx.beginPath();
        for (const s of [-8, 0, 8]) {
          const a = P(-19.5, s, 52), b = P(-23, s, 76);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      };
      for (const l of legs.filter(([f]) => (facing ? f < 0 : f > 0))) leg(l);
      if (!facing) back();
      inkPoly(ctx, [P(18, -19, 42), P(18, 19, 42), P(-18, 19, 42), P(-18, -19, 42)], c, ink);
      inkPoly(ctx, [P(18, -19, 42), P(18, 19, 42), P(18, 19, 38), P(18, -19, 38)], sh, ink * 0.8);
      for (const l of legs.filter(([f]) => (facing ? f > 0 : f < 0))) leg(l);
      if (facing) back();
    },
  };

  // ------------------------------------------------------------------ vaso de espada-de-são-jorge
  small.vaso = {
    height: () => 90,
    blocks: 0,
    shadow: (path, cam, d) => H.circleShadow(path, cam, d.x, d.y, 22, 30),
    box: (cam, d, z0) => bboxOf([cam.p({ x: d.x - 30, y: d.y + 30, z: z0 }), cam.p({ x: d.x + 30, y: d.y - 30, z: z0 }), cam.p({ x: d.x, y: d.y, z: z0 + 105 })], 30 * cam.zoom),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x, d.y, 911);
      const r = 18, h = 30;
      const b = cam.p({ x: d.x, y: d.y, z: z0 });
      const t = cam.p({ x: d.x, y: d.y, z: z0 + h });
      const rx = r * cam.zoom, ry = rx * cam.sinP;
      // vaso de barro (cilindro que abre um pouco)
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, rx * 0.8 + ink, ry * 0.8 + ink, 0, 0, M.TAU);
      ctx.fillStyle = INK;
      ctx.fill();
      inkPoly(ctx, [{ x: b.x - rx * 0.8, y: b.y }, { x: t.x - rx, y: t.y }, { x: t.x + rx, y: t.y }, { x: b.x + rx * 0.8, y: b.y }], '#b5653a', ink);
      ctx.fillStyle = '#8f4c2a';
      poly(ctx, [{ x: b.x + rx * 0.2, y: b.y }, { x: t.x + rx * 0.3, y: t.y }, { x: t.x + rx, y: t.y }, { x: b.x + rx * 0.8, y: b.y }]);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, rx + ink, ry + ink, 0, 0, M.TAU);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, rx, ry, 0, 0, M.TAU);
      ctx.fillStyle = '#4a3424';
      ctx.fill();
      // as folhas: espadas em pé, verde-escuro com faixas claras e a borda amarela
      const leaves = [];
      const n = 8 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const a = rnd() * M.TAU;
        const rr = rnd() * r * 0.6;
        const base = { x: d.x + Math.cos(a) * rr, y: d.y + Math.sin(a) * rr, z: z0 + h - 2 };
        leaves.push({ base, h: 45 + rnd() * 35, lean: (rnd() - 0.5) * 16, w: 4 + rnd() * 2.5, depth: cam.depth(base), tw: rnd() });
      }
      leaves.sort((p, q) => p.depth - q.depth);
      for (const l of leaves) {
        const q0 = cam.p(l.base);
        const q1 = cam.p({ x: l.base.x + l.lean, y: l.base.y - l.lean * 0.3, z: l.base.z + l.h });
        const nx = -(q1.y - q0.y), ny = q1.x - q0.x;
        const nl = Math.hypot(nx, ny) || 1;
        const w = l.w * cam.zoom;
        const mid = { x: (q0.x + q1.x) / 2, y: (q0.y + q1.y) / 2 };
        const pts = [
          { x: q0.x + (nx / nl) * w * 0.7, y: q0.y + (ny / nl) * w * 0.7 },
          { x: mid.x + (nx / nl) * w, y: mid.y + (ny / nl) * w },
          q1,
          { x: mid.x - (nx / nl) * w, y: mid.y - (ny / nl) * w },
          { x: q0.x - (nx / nl) * w * 0.7, y: q0.y - (ny / nl) * w * 0.7 },
        ];
        inkPoly(ctx, pts, '#d9c45a', ink * 0.8, 1.8);
        const inner = [pts[0], { x: mid.x + (nx / nl) * w * 0.6, y: mid.y + (ny / nl) * w * 0.6 }, q1, { x: mid.x - (nx / nl) * w * 0.6, y: mid.y - (ny / nl) * w * 0.6 }, pts[4]];
        poly(ctx, inner);
        ctx.fillStyle = l.tw < 0.5 ? '#2f5a2c' : '#3a6a33';
        ctx.fill();
        // faixas claras atravessadas
        ctx.strokeStyle = 'rgba(160, 196, 120, 0.45)';
        ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
        ctx.beginPath();
        for (let k = 1; k < 5; k++) {
          const u = k / 5;
          const x = q0.x + (q1.x - q0.x) * u, y = q0.y + (q1.y - q0.y) * u;
          ctx.moveTo(x - (nx / nl) * w * 0.5, y - (ny / nl) * w * 0.5 + 2 * cam.zoom);
          ctx.lineTo(x + (nx / nl) * w * 0.5, y + (ny / nl) * w * 0.5 - 2 * cam.zoom);
        }
        ctx.stroke();
      }
    },
  };

  // ------------------------------------------------------------------ sacos de lixo
  small.lixo = {
    height: (d) => d.h || 60,
    blocks: 0,
    shadow: (path, cam, d) => H.circleShadow(path, cam, (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, 34, 30),
    box: (cam, d, z0) => bboxOf([cam.p({ x: d.x0 - 15, y: d.y1 + 15, z: z0 }), cam.p({ x: d.x1 + 15, y: d.y0 - 15, z: z0 }), cam.p({ x: d.x0, y: d.y0, z: z0 + (d.h || 60) + 20 }), cam.p({ x: d.x1, y: d.y1, z: z0 })], 12 * cam.zoom),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 921);
      const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
      const h = d.h || 60;
      const bags = [];
      const n = 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < n; k++) {
        const p = { x: cx + (rnd() - 0.5) * 34, y: cy + (rnd() - 0.5) * 34, z: z0 };
        bags.push({ p, r: 18 + rnd() * 8, h: h * (0.7 + rnd() * 0.3), depth: cam.depth(p) });
      }
      bags.sort((a, b) => a.depth - b.depth);
      for (const g of bags) {
        const b = cam.p(g.p);
        const t = cam.p({ ...g.p, z: g.p.z + g.h });
        const rx = g.r * cam.zoom;
        const midY = (b.y + t.y) / 2 + (t.y - b.y) * 0.08;
        // o saco: um corpo redondo que afina até o nó
        const path = new Path2D();
        path.moveTo(t.x - rx * 0.18, t.y + rx * 0.3);
        path.bezierCurveTo(t.x - rx * 1.2, midY - rx * 0.4, b.x - rx * 1.25, b.y - rx * 0.1, b.x, b.y + rx * 0.35);
        path.bezierCurveTo(b.x + rx * 1.25, b.y - rx * 0.1, t.x + rx * 1.2, midY - rx * 0.4, t.x + rx * 0.18, t.y + rx * 0.3);
        path.closePath();
        ctx.strokeStyle = INK;
        ctx.lineWidth = ink * 2.2;
        ctx.stroke(path);
        ctx.fillStyle = '#1f2023';
        ctx.fill(path);
        // brilho do plástico e as dobras
        ctx.save();
        ctx.clip(path);
        ctx.fillStyle = 'rgba(120, 128, 140, 0.45)';
        ctx.beginPath();
        ctx.ellipse(b.x - rx * 0.4, midY, rx * 0.22, rx * 0.5, 0.3, 0, M.TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(70, 74, 82, 0.8)';
        ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
        ctx.beginPath();
        ctx.moveTo(t.x, t.y + rx * 0.4);
        ctx.quadraticCurveTo(b.x + rx * 0.3, midY, b.x + rx * 0.5, b.y - rx * 0.2);
        ctx.stroke();
        ctx.restore();
        // o nó com as orelhinhas
        for (const s of [-1, 1]) inkLine(ctx, [{ x: t.x, y: t.y + rx * 0.2 }, { x: t.x + s * rx * 0.45, y: t.y - rx * 0.2 }], '#26272b', 3.5 * cam.zoom, ink * 0.7);
      }
    },
  };

  /** Caixa de pontos já na tela. */
  function bboxOf(pts, pad) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pts) {
      x0 = Math.min(x0, q.x);
      y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x);
      y1 = Math.max(y1, q.y);
    }
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }
  // a caixa da placa (as duas plaquinhas no alto e o pé do poste)
  small['placa-rua'].box = function (cam, d, z0) {
    const [a, b] = this.plates(d);
    return bboxOf(
      [
        cam.p({ x: d.x - a.w / 2, y: d.y, z: z0 + 278 }),
        cam.p({ x: d.x + a.w / 2, y: d.y, z: z0 + 278 }),
        cam.p({ x: d.x, y: d.y + b.w / 2, z: z0 + 250 }),
        cam.p({ x: d.x, y: d.y - b.w / 2, z: z0 + 220 }),
        cam.p({ x: d.x, y: d.y, z: z0 }),
      ],
      14 * cam.zoom,
    );
  };

  // ------------------------------------------------------------------ bandeirinhas (a cada quadro: balançam)
  const FLAGS = ['#e8452c', '#f4c21c', '#2f6fd0', '#3f9a4a', '#e86a9a', '#f2efe6', '#f08a24'];
  function bunting(ctx, cam, b, t) {
    const h = b.h || 300;
    let n = 0;
    for (let i = 0; i + 1 < b.pts.length; i++) {
      const A = b.pts[i], B = b.pts[i + 1];
      const L = Math.hypot(B.x - A.x, B.y - A.y);
      if (L < 10) continue;
      const sag = Math.min(70, L * 0.07);
      const at = (u) => ({ x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u, z: h - Math.sin(u * Math.PI) * sag });
      // o cordão
      const line = [];
      for (let s = 0; s <= 16; s++) line.push(cam.p(at(s / 16)));
      ctx.strokeStyle = 'rgba(40, 32, 26, 0.85)';
      ctx.lineWidth = Math.max(1, 1.3 * cam.zoom);
      ctx.beginPath();
      line.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      // as bandeirinhas, a cada ~38 cm, penduradas no cordão e balançando com o vento
      const m = Math.floor(L / 38);
      for (let k = 0; k < m; k++) {
        const u0 = (k + 0.15) / m, u1 = (k + 0.75) / m;
        const p0 = at(u0), p1 = at(u1);
        const sw = Math.sin(t * 3.1 + n * 0.9) * 5;
        const tip = { x: (p0.x + p1.x) / 2 + sw * 0.6, y: (p0.y + p1.y) / 2 + sw * 0.6, z: (p0.z + p1.z) / 2 - 26 };
        const q = [cam.p(p0), cam.p(p1), cam.p(tip)];
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        ctx.lineTo(q[1].x, q[1].y);
        ctx.lineTo(q[2].x, q[2].y);
        ctx.closePath();
        ctx.fillStyle = FLAGS[n % FLAGS.length];
        ctx.fill();
        ctx.strokeStyle = 'rgba(27, 16, 13, 0.55)';
        ctx.lineWidth = Math.max(0.8, 0.9 * cam.zoom);
        ctx.stroke();
        n++;
      }
    }
  }

  // ------------------------------------------------------------------ cipó nos fios e nos postes
  /** Cipó num fio: enrolado nele e pendurado em fiapos com folhas (pts = o fio, já na tela, de ponta a ponta). */
  function wireVines(ctx, cam, pts3, seed, t) {
    const rnd = M.rng(seed);
    const n = pts3.length;
    // folhas enroladas no fio
    const along = [];
    for (let i = 1; i < n - 1; i++) along.push(cam.p(pts3[i]));
    vineStrand(ctx, along, rnd, cam.zoom, 0.6);
    // fiapos pendurados (balançam devagar)
    for (let i = 2; i < n - 2; i += 2) {
      if (rnd() < 0.4) continue;
      const p = pts3[i];
      const len = 40 + rnd() * 110;
      const sw = Math.sin(t * 0.8 + i + seed) * 6;
      const strand = [];
      for (let s = 0; s <= 6; s++) strand.push(cam.p({ x: p.x + sw * (s / 6), y: p.y, z: p.z - (len * s) / 6 }));
      vineStrand(ctx, strand, rnd, cam.zoom, 0.5);
    }
  }
  /** Cipó subindo pelo poste em espiral, com folhas, e uns fiapos caindo da cruzeta. */
  function poleVine(ctx, cam, p, z0, h, ink) {
    const rnd = seeded(p.x, p.y, 931);
    const top = h * (0.7 + rnd() * 0.2);
    const pts = [];
    for (let z = 0; z <= top; z += 14) {
      const a = z * 0.045 + rnd() * 0.2;
      pts.push(cam.p({ x: p.x + Math.cos(a) * 15, y: p.y + Math.sin(a) * 15, z: z0 + z }));
    }
    vineStrand(ctx, pts, rnd, cam.zoom, ink);
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * 55;
      const len = 60 + rnd() * 120;
      const strand = [];
      for (let s = 0; s <= 6; s++) strand.push(cam.p({ x: p.x + off, y: p.y - off, z: z0 + h - 60 - (len * s) / 6 }));
      vineStrand(ctx, strand, rnd, cam.zoom, ink);
    }
  }

  PD.city = { small, bunting, wireVines, poleVine };
})(window.PD = window.PD || {});
