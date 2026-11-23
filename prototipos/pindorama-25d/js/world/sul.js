// O sul da floresta maior (pedido do [mundo] de 14/11, com o "pode" do dono; referências
// docs/referencias/floresta-maior-paineira.jpg e floresta-maior-posto.jpg):
//  - a paineira: tronco de garrafa verde com espinhos, a copa cor-de-rosa e as flores caídas no chão (`petalas`);
//  - o parquinho antigo: o balanço (`quebrado`: uma corrente arrebentada e o assento pendurado), o escorregador e o
//    gira-gira (com mato no meio), enferrujados e com cipó;
//  - a cachoeirinha: pedras com musgo e a água caindo no poço, mexendo (desenhada a cada quadro);
//  - o posto abandonado: a cobertura com mato e arvorezinhas em cima (no alto, por cima de quem está embaixo dela, e
//    transparente com o herói embaixo ou atrás), os quatro pilares, as bombas velhas (sem marca) e a pilha de pneus.
// A lojinha do posto (a casa com `posto`) e a placa em branco (`torta`) ficam no props.js e no fundo.js; as pedras de
// atravessar (a pinguela com `pedras`), no flora.js; o gradil quebrado, no props.js.
//   PD.flora.tree.paineira = { trunk, trunkBox, crown, crownBox }
//   PD.city.small[tipo]    = { height, blocks, overhead, fades, box, shadow, paint, live }
(function (PD) {
  'use strict';
  const M = PD.math;
  const H = PD.props.help;
  const { INK } = H;
  const small = PD.city.small;

  // ------------------------------------------------------------------ ajudantes
  const seeded = (x, y, k) => M.rng((Math.round(x * 3.7) * 73856093) ^ (Math.round(y * 5.3) * 19349663) ^ (k * 83492791));
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
  function volBox(cam, x0, x1, y0, y1, za, zb, pad) {
    const pts = [];
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) pts.push(cam.p({ x, y, z: za }), cam.p({ x, y, z: zb }));
    return bboxOf(pts, pad * cam.zoom);
  }
  /** Caixa da imagem em volta de bolas no mundo ({x, y, z, r} em cm). */
  function ballBox(cam, balls, pad = 8) {
    const pts = [];
    for (const b of balls) {
      const q = cam.p(b);
      const r = b.r * cam.zoom;
      pts.push({ x: q.x - r, y: q.y - r }, { x: q.x + r, y: q.y + r });
    }
    return bboxOf(pts, pad * cam.zoom);
  }
  function pathOf(pts) {
    const p = new Path2D();
    pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
    p.closePath();
    return p;
  }
  function inkFill(ctx, path, color, ink, w = 2.2) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * w;
    ctx.stroke(path);
    ctx.fillStyle = color;
    ctx.fill(path);
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
  function grass(ctx, cam, x, y, z, size, rnd, ink) {
    if (PD.city.grass) PD.city.grass(ctx, cam.p({ x, y, z }), size * cam.zoom, rnd, ink);
  }
  function vine3d(ctx, cam, pts3, rnd, ink) {
    if (PD.city.vine) PD.city.vine(ctx, pts3.map((q) => cam.p(q)), rnd, cam.zoom, ink);
  }
  function quad(ctx, pts, color) {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  /** Cano de ferro em 3D (contorno, a cor e um fio de luz em cima), como os da academia do parque. */
  function pipe(ctx, cam, pts3, w0, ink, color = '#7d898e') {
    const w = w0 * 1.45 * cam.zoom;
    const pts = pts3.map((q) => cam.p(q));
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = Math.max(0.8, w * 0.28);
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x - w * 0.22, q.y - w * 0.22) : ctx.moveTo(q.x - w * 0.22, q.y - w * 0.22)));
    ctx.stroke();
  }
  /** Manchas de ferrugem ao longo de um cano (mais perto de `a`, o pé). */
  function rustAlong(ctx, cam, a, b, rnd, n) {
    for (let k = 0; k < n; k++) {
      const u = rnd() * rnd();
      const q = cam.p({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u });
      ctx.fillStyle = k % 3 ? 'rgba(146, 72, 34, 0.85)' : 'rgba(186, 104, 52, 0.8)';
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, (2 + rnd() * 2.6) * cam.zoom, (1.4 + rnd() * 1.8) * cam.zoom, rnd() * 3, 0, M.TAU);
      ctx.fill();
    }
  }
  /** Corrente fina (balanço): o fio cinza e os elos escuros. */
  function chain(ctx, cam, a, b, ink) {
    const p = cam.p(a), q = cam.p(b);
    inkLine(ctx, [p, q], '#9aa2a6', Math.max(1, 1.5 * cam.zoom), ink * 0.5);
    const n = Math.max(3, Math.round(Math.hypot(q.x - p.x, q.y - p.y) / (7 * Math.max(0.6, cam.zoom))));
    ctx.fillStyle = '#5b6266';
    for (let i = 1; i < n; i++) {
      const u = i / n;
      ctx.fillRect(p.x + (q.x - p.x) * u - 0.9 * cam.zoom, p.y + (q.y - p.y) * u - 0.9 * cam.zoom, 1.8 * cam.zoom, 1.8 * cam.zoom);
    }
  }
  /** Florzinha de 5 pétalas (na tela): as da paineira, na copa e caídas no chão. */
  function flower(ctx, x, y, s, rnd, light) {
    const rot = rnd() * M.TAU;
    ctx.fillStyle = light ? '#fbd5e3' : '#f0a3c1';
    for (let k = 0; k < 5; k++) {
      const a = rot + (k / 5) * M.TAU;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.45, s * 0.5, s * 0.32, a, 0, M.TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f6e2a0';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.24, 0, M.TAU);
    ctx.fill();
  }

  // ------------------------------------------------------------------ paineira
  // Tronco de garrafa (barriga embaixo, pescoço fino na forquilha), verde-acinzentado, com espinhos de cone e as raízes
  // de tábua no pé; copa cor-de-rosa (o `crownPaint` das árvores de copa com as cores das flores) com as florzinhas de
  // cinco pétalas por cima e umas folhas verdes aparecendo.
  if (H.BARK) H.BARK.paineira = ['#7a9459', '#55703f'];
  const PINK = { base: '#e58fb0', shade: '#bb6283', light: '#f8bed3', under: '#7d3d5a' };
  const FORK = 0.42; // a forquilha das árvores de copa (o crownPaint do props.js abre os galhos daí)
  // o perfil do tronco: [altura (0 = chão, 1 = forquilha), raio (fração do raio do mapa)]
  const BOTTLE = [[0, 1.2], [0.05, 1.02], [0.22, 1.07], [0.42, 0.98], [0.62, 0.78], [0.82, 0.57], [1, 0.44]];
  function bottleR(u) {
    for (let i = 1; i < BOTTLE.length; i++) {
      const [u0, r0] = BOTTLE[i - 1];
      const [u1, r1] = BOTTLE[i];
      if (u <= u1) {
        const k = (u - u0) / (u1 - u0);
        return r0 + (r1 - r0) * ((1 - Math.cos(k * Math.PI)) / 2);
      }
    }
    return BOTTLE[BOTTLE.length - 1][1];
  }
  /** O plano da copa: a mesma conta do crownPlan do props.js (as flores vão em cima dos tufos que ele pinta). */
  function crownPlan(t, z0) {
    const rnd = M.rng(Math.round(t.x * 13 + t.y * 7 + 5));
    const fork = { x: t.x + Math.sin(6 * 1.3 + t.x) * 3, y: t.y, z: z0 + t.h * FORK };
    const n = 4 + Math.floor(rnd() * 2) + (t.r > 300 ? 1 : 0);
    const a0 = rnd() * M.TAU;
    const tufts = [];
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * M.TAU + (rnd() - 0.5) * 0.9;
      const d = t.r * (0.55 + rnd() * 0.3);
      const z = z0 + t.h * (0.6 + rnd() * 0.28);
      tufts.push({ w: { x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d, z }, R: t.r * (0.36 + rnd() * 0.16) });
    }
    tufts.push({ w: { x: t.x + (rnd() - 0.5) * t.r * 0.3, y: t.y + (rnd() - 0.5) * t.r * 0.3, z: z0 + t.h * 0.92 }, R: t.r * 0.46 });
    return { fork, tufts };
  }
  if (PD.flora && PD.flora.tree) {
    PD.flora.tree.paineira = {
      trunk(ctx, cam, t, z0, ink) {
        const R = t.trunk || 60;
        const top = t.h * FORK;
        const rnd = seeded(t.x, t.y, 3101);
        const bark = H.BARK.paineira;
        const sinP = cam.sinP;
        // as raízes de tábua no pé (as de trás o tronco cobre)
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * M.TAU + rnd() * 0.5;
          const out = R * (1.6 + rnd() * 0.5);
          const from = { x: t.x + Math.cos(a) * R * 0.55, y: t.y + Math.sin(a) * R * 0.55, z: z0 + R * 0.4 };
          const to = { x: t.x + Math.cos(a) * out, y: t.y + Math.sin(a) * out, z: z0 };
          inkFill(ctx, pathOf(H.limbPoly(cam, from, to, R * 0.24, R * 0.05, R * 0.12)), k % 2 ? bark[0] : bark[1], ink, 2.2);
        }
        // a silhueta: os dois lados na tela e o pé arredondado (a frente do círculo do chão)
        const N = 18;
        const ring = [];
        for (let k = 0; k <= N; k++) {
          const u = k / N;
          ring.push({ c: cam.p({ x: t.x, y: t.y, z: z0 + top * u }), r: R * bottleR(u) * cam.zoom });
        }
        const base = ring[0];
        const foot = [];
        for (let j = 1; j < 12; j++) {
          const th = (j / 12) * Math.PI;
          foot.push({ x: base.c.x + Math.cos(th) * base.r, y: base.c.y + Math.sin(th) * base.r * sinP });
        }
        // (a ordem: do alto da esquerda descendo, o pé da esquerda para a direita, subindo pela direita)
        const outline = pathOf(ring.map((q) => ({ x: q.c.x - q.r, y: q.c.y })).reverse().concat(foot.slice().reverse()).concat(ring.map((q) => ({ x: q.c.x + q.r, y: q.c.y }))));
        inkFill(ctx, outline, bark[0], ink, 2.4);
        ctx.save();
        ctx.clip(outline);
        // o lado da sombra (direita) e a faixa de luz (esquerda)
        ctx.fillStyle = bark[1];
        ctx.fill(pathOf(ring.map((q) => ({ x: q.c.x + q.r * 0.28, y: q.c.y + q.r * sinP })).concat(ring.slice().reverse().map((q) => ({ x: q.c.x + q.r * 1.2, y: q.c.y + q.r * sinP })))));
        ctx.fillStyle = 'rgba(196, 220, 150, 0.32)';
        ctx.fill(pathOf(ring.map((q) => ({ x: q.c.x - q.r * 0.78, y: q.c.y })).concat(ring.slice().reverse().map((q) => ({ x: q.c.x - q.r * 0.46, y: q.c.y })))));
        // riscos da casca, de cima para baixo
        ctx.strokeStyle = 'rgba(50, 70, 36, 0.45)';
        ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
        for (let k = 0; k < 10; k++) {
          const s = (rnd() - 0.5) * 1.7;
          const ua = rnd() * 0.75, ub = Math.min(1, ua + 0.12 + rnd() * 0.3);
          ctx.beginPath();
          for (let j = 0; j <= 6; j++) {
            const u = ua + ((ub - ua) * j) / 6;
            const c = cam.p({ x: t.x, y: t.y, z: z0 + top * u });
            const rr = R * bottleR(u) * cam.zoom;
            const x = c.x + s * rr, y = c.y + Math.sqrt(Math.max(0, 1 - s * s)) * rr * sinP;
            if (j) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        ctx.restore();
        // os espinhos (cones curtos), por cima: os da beirada saem do contorno
        for (let k = 0; k < 48; k++) {
          const u = 0.05 + rnd() * 0.9;
          const s = (rnd() * 2 - 1) * 0.98;
          const c = cam.p({ x: t.x, y: t.y, z: z0 + top * u });
          const rr = R * bottleR(u) * cam.zoom;
          const bx = c.x + s * rr, by = c.y + Math.sqrt(Math.max(0, 1 - s * s)) * rr * sinP;
          let dx = s, dy = -0.3;
          const dl = Math.hypot(dx, dy) || 1;
          dx /= dl;
          dy /= dl;
          const len = (4.5 + rnd() * 3) * cam.zoom, w = 2.3 * cam.zoom;
          ctx.beginPath();
          ctx.moveTo(bx - dy * w, by + dx * w);
          ctx.lineTo(bx + dx * len, by + dy * len);
          ctx.lineTo(bx + dy * w, by - dx * w);
          ctx.closePath();
          ctx.fillStyle = '#5f6248';
          ctx.fill();
          ctx.strokeStyle = 'rgba(27, 16, 13, 0.7)';
          ctx.lineWidth = Math.max(0.6, ink * 0.6);
          ctx.stroke();
        }
      },
      trunkBox(cam, t, z0) {
        const R = t.trunk || 60;
        return ballBox(cam, [{ x: t.x, y: t.y, z: z0, r: R * 2.3 }, { x: t.x, y: t.y, z: z0 + t.h * FORK, r: R * 1.2 }], 10);
      },
      crown(ctx, cam, t, z0, ink) {
        // os galhos e os tufos: a copa das árvores de copa, com as cores das flores (os galhos saem mais finos, do
        // pescoço da garrafa)
        H.crownPaint(ctx, cam, { ...t, trunk: (t.trunk || 60) * 0.55 }, z0, ink, PINK, false);
        const { tufts } = crownPlan(t, z0);
        const rnd = seeded(t.x, t.y, 3111);
        const L = cam.lightScreen;
        const toLight = Math.atan2(L.y, L.x);
        tufts.sort((a, b) => cam.depth(a.w) - cam.depth(b.w));
        for (const tf of tufts) {
          const q = cam.p(tf.w);
          const Rp = tf.R * cam.zoom;
          // umas folhas verdes aparecendo embaixo
          for (let k = 0; k < 6; k++) {
            const a = Math.PI * (0.15 + rnd() * 0.7);
            const d = Rp * (0.45 + rnd() * 0.35);
            ctx.fillStyle = rnd() < 0.5 ? '#5f8a44' : '#4a7436';
            ctx.beginPath();
            ctx.ellipse(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d * 0.84, Rp * 0.09, Rp * 0.045, rnd() * Math.PI, 0, M.TAU);
            ctx.fill();
          }
          // as flores, mais do lado da luz
          for (let k = 0; k < 18; k++) {
            const a = toLight + (rnd() - 0.5) * 3.6;
            const d = Rp * Math.sqrt(rnd()) * 0.8;
            flower(ctx, q.x + Math.cos(a) * d, q.y + Math.sin(a) * d * 0.84, (2.4 + rnd() * 1.8) * cam.zoom, rnd, Math.cos(a - toLight) > 0.2);
          }
        }
      },
      crownBox(cam, t, z0) {
        const { fork, tufts } = crownPlan(t, z0);
        return ballBox(cam, [{ ...fork, r: 40 }, ...tufts.map((tf) => ({ ...tf.w, r: tf.R * 1.35 }))], 8);
      },
    };
  }

  // As flores caídas em volta da paineira (rente ao chão: desenhada antes de todo mundo): pétalas soltas, mais perto
  // do tronco, e umas flores inteiras.
  small.petalas = {
    height: () => 4,
    blocks: 0,
    shadow: null,
    box: (cam, d, z0) => volBox(cam, d.x - d.r, d.x + d.r, d.y - d.r, d.y + d.r, z0, z0 + 6, 10),
    paint(ctx, cam, d, z0) {
      const rnd = seeded(d.x, d.y, 3121);
      const base = d.color || '#e58fb0';
      const tones = [base, M.shade(base, 0.22), M.shade(base, -0.12), '#f6d2df'];
      const d0 = (d.trunk || 60) * 1.3;
      for (let k = 0; k < 190; k++) {
        const a = rnd() * M.TAU;
        const dist = d0 + (d.r - d0) * Math.pow(rnd(), 1.15);
        const q = cam.p({ x: d.x + Math.cos(a) * dist, y: d.y + Math.sin(a) * dist, z: z0 + 1 });
        const s = (2.2 + rnd() * 2.2) * cam.zoom;
        ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, s, s * 0.55, rnd() * Math.PI, 0, M.TAU);
        ctx.fill();
      }
      for (let k = 0; k < 16; k++) {
        const a = rnd() * M.TAU;
        const dist = d0 + (d.r * 0.8 - d0) * rnd();
        const q = cam.p({ x: d.x + Math.cos(a) * dist, y: d.y + Math.sin(a) * dist, z: z0 + 1 });
        flower(ctx, q.x, q.y, (3 + rnd() * 1.6) * cam.zoom, rnd, rnd() < 0.5);
      }
    },
  };

  // ------------------------------------------------------------------ parquinho antigo
  // Ferro pintado de cinza-azulado, descascado e enferrujado; capim nos pés e cipó subindo (`cipo`).
  small.parquinho = {
    height: (d) => (d.h || 200) + 40,
    blocks: 0,
    shadow(p, cam, d) {
      if (d.toy === 'gira-gira') return H.circleShadow(p, cam, d.x, d.y, d.r * 0.95, 30);
      if (d.toy === 'escorregador') return H.boxShadow(p, cam, d.x0 + 10, d.x1 - 10, d.y0 + 20, d.y1 - 10, (d.h || 180) * 0.45);
      const cy = (d.y0 + d.y1) / 2;
      for (const x of [d.x0 + 12, d.x1 - 12]) H.lineShadow(p, cam, x, cy, d.h || 220, 8);
    },
    box(cam, d, z0) {
      if (d.toy === 'gira-gira') return volBox(cam, d.x - d.r - 40, d.x + d.r + 40, d.y - d.r - 40, d.y + d.r + 40, z0, z0 + 130, 20);
      return volBox(cam, d.x0 - 40, d.x1 + 40, d.y0 - 60, d.y1 + 60, z0, z0 + (d.h || 200) + 30, 20);
    },
    paint(ctx, cam, d, z0, ink) {
      if (d.toy === 'gira-gira') return merryGoRound(ctx, cam, d, z0, ink);
      if (d.toy === 'escorregador') return slide(ctx, cam, d, z0, ink);
      return swing(ctx, cam, d, z0, ink);
    },
  };
  const PIPE = '#7d898e';

  /** O balanço: dois "A" de cano nas pontas, a trave em cima e os dois assentos (com `quebrado`, um arrebentado). */
  function swing(ctx, cam, d, z0, ink) {
    const rnd = seeded(d.x0, d.y0, 3201);
    const cy = (d.y0 + d.y1) / 2;
    const h = d.h || 220;
    const xa = d.x0 + 12, xb = d.x1 - 12;
    const spread = Math.max(40, (d.y1 - d.y0) * 0.75);
    const P3 = (x, y, z) => ({ x, y, z: z0 + z });
    for (const x of [xa, xb]) for (const s of [-1, 1]) grass(ctx, cam, x, cy + s * spread, z0, 20, rnd, ink);
    // as pernas de trás (longe da câmera) primeiro, depois a trave, os balanços e as pernas da frente
    for (const x of [xa, xb]) pipe(ctx, cam, [P3(x, cy - spread, 0), P3(x, cy, h)], 5.2, ink, PIPE);
    pipe(ctx, cam, [P3(xa - 10, cy, h), P3(xb + 10, cy, h)], 5.8, ink, PIPE);
    if (d.rust) rustAlong(ctx, cam, P3(xb, cy, h), P3(xa, cy, h), rnd, 5);
    const seats = [d.x0 + (d.x1 - d.x0) * 0.32, d.x0 + (d.x1 - d.x0) * 0.68];
    seats.forEach((sx, i) => {
      const sw = 22;
      const wood = { front: '#7a5634', side: '#5f422a', top: '#8e6844' };
      if (d.broken && i === 1) {
        // uma corrente arrebentada (o toco pendurado na trave) e o assento pendurado da outra, quase em pé
        chain(ctx, cam, P3(sx + sw, cy, h), P3(sx + sw - 4, cy + 3, h - 75), ink);
        chain(ctx, cam, P3(sx - sw, cy, h), P3(sx - sw + 2, cy + 2, 58), ink);
        const a = cam.p(P3(sx - sw + 2, cy + 2, 60)), b = cam.p(P3(sx - sw + 16, cy + 12, 14));
        inkLine(ctx, [a, b], '#7a5634', Math.max(3, 8 * cam.zoom), ink);
        return;
      }
      chain(ctx, cam, P3(sx - sw, cy, h), P3(sx - sw + 4, cy + 8, 50), ink);
      chain(ctx, cam, P3(sx + sw, cy, h), P3(sx + sw + 4, cy + 8, 50), ink);
      H.box(ctx, cam, sx - sw - 6 + 4, sx + sw + 6 + 4, cy + 8 - 9, cy + 8 + 9, z0 + 44, z0 + 50, wood, ink);
    });
    for (const x of [xa, xb]) {
      pipe(ctx, cam, [P3(x, cy + spread, 0), P3(x, cy, h)], 5.2, ink, PIPE);
      if (d.rust) rustAlong(ctx, cam, P3(x, cy + spread, 0), P3(x, cy, h), rnd, 4);
    }
    if (d.vine) {
      // cipó subindo a perna da frente da esquerda (e um ramo pendurado da trave)
      const pts = [];
      for (let j = 0; j <= 9; j++) {
        const u = j / 9;
        pts.push(P3(xa + Math.sin(j * 1.7) * 4, cy + spread * (1 - u) + 3, h * u * 0.85));
      }
      vine3d(ctx, cam, pts, rnd, ink);
      const hang = [];
      for (let j = 0; j <= 5; j++) hang.push(P3(xa + 40 + Math.sin(j) * 3, cy + 2, h - j * 16));
      vine3d(ctx, cam, hang, rnd, ink);
    }
  }

  /** O escorregador: a escada atrás, o patamar com o corrimão e a calha descendo para o lado `olhando`. */
  function slide(ctx, cam, d, z0, ink) {
    const rnd = seeded(d.x0, d.y0, 3211);
    const cx = (d.x0 + d.x1) / 2;
    const half = Math.max(22, (d.x1 - d.x0) / 2 - 8);
    const f = d.angle === 270 ? -1 : 1; // 90 = a saída no sul (+y)
    const yBack = f > 0 ? d.y0 : d.y1;
    const len = d.y1 - d.y0;
    const A = (a) => yBack + f * a;
    const top = Math.min((d.h || 180) - 30, 150);
    const P3 = (x, y, z) => ({ x, y, z: z0 + z });
    grass(ctx, cam, cx - half, A(4), z0, 20, rnd, ink);
    grass(ctx, cam, cx + half, A(len - 10), z0, 22, rnd, ink);
    // a escada: dois canos inclinados e os degraus
    const ladderTop = 46;
    for (const s of [-1, 1]) pipe(ctx, cam, [P3(cx + s * half * 0.8, A(0), 0), P3(cx + s * half * 0.8, A(ladderTop), top + 44)], 4.4, ink, PIPE);
    for (let k = 1; k <= 5; k++) {
      const u = k / 6;
      pipe(ctx, cam, [P3(cx - half * 0.8, A(ladderTop * u), top * u), P3(cx + half * 0.8, A(ladderTop * u), top * u)], 3, ink, '#6f7a7e');
    }
    // o patamar
    H.box(ctx, cam, cx - half, cx + half, Math.min(A(ladderTop), A(ladderTop + 34)), Math.max(A(ladderTop), A(ladderTop + 34)), z0 + top - 6, z0 + top, { front: '#8b969a', side: '#717c80', top: '#a3adb0' }, ink);
    // a calha: o fundo e as duas abas, descendo do patamar até perto do chão
    const s0 = ladderTop + 34, s1 = len - 18;
    const zc = (a) => (a <= s0 ? top : a >= s1 ? 26 : top - (top - 26) * Math.pow((a - s0) / (s1 - s0), 0.9));
    const N = 10;
    const rail = (side, lift) => {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const a = s0 + ((len - s0) * i) / N;
        pts.push(cam.p(P3(cx + side * half * 0.9, A(a), zc(a) + lift)));
      }
      return pts;
    };
    const bedL = rail(-1, 0), bedR = rail(1, 0), wallL = rail(-1, 14), wallR = rail(1, 14);
    const metal = '#a9b0b3', metalSide = '#8a9295';
    // a aba de longe (por dentro), o fundo e a aba de perto (por fora)
    const outlinePath = (pts) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
    };
    outlinePath(wallL.concat(bedL.slice().reverse()));
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 2.2;
    ctx.stroke();
    ctx.fillStyle = metalSide;
    ctx.fill();
    outlinePath(bedL.concat(bedR.slice().reverse()));
    ctx.stroke();
    ctx.fillStyle = metal;
    ctx.fill();
    // o brilho do metal gasto no meio da calha e a ferrugem
    ctx.save();
    outlinePath(bedL.concat(bedR.slice().reverse()));
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3 * cam.zoom;
    ctx.beginPath();
    bedL.forEach((q, i) => {
      const r2 = bedR[i];
      const x = q.x * 0.6 + r2.x * 0.4, y = q.y * 0.6 + r2.y * 0.4;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    if (d.rust) {
      for (let k = 0; k < 9; k++) {
        const i = Math.floor(rnd() * N);
        const u = rnd();
        const q = { x: bedL[i].x * u + bedR[i].x * (1 - u), y: bedL[i].y * u + bedR[i].y * (1 - u) };
        ctx.fillStyle = k % 2 ? 'rgba(146, 72, 34, 0.7)' : 'rgba(178, 98, 48, 0.6)';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, (3 + rnd() * 6) * cam.zoom, (2 + rnd() * 3) * cam.zoom, rnd() * 3, 0, M.TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    outlinePath(wallR.concat(bedR.slice().reverse()));
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 2.2;
    ctx.stroke();
    ctx.fillStyle = metalSide;
    ctx.fill();
    // a barra de cima da aba de perto
    inkLine(ctx, wallR, '#b9c0c3', Math.max(1.2, 2.4 * cam.zoom), ink * 0.6);
    // o corrimão do patamar
    for (const s of [-1, 1]) pipe(ctx, cam, [P3(cx + s * half, A(ladderTop), top + 44), P3(cx + s * half, A(ladderTop + 30), top + 44), P3(cx + s * half, A(s0 + 10), top + 6)], 3.6, ink, PIPE);
    // os pés da calha
    pipe(ctx, cam, [P3(cx, A(s0 + (s1 - s0) * 0.55), 0), P3(cx, A(s0 + (s1 - s0) * 0.55), zc(s0 + (s1 - s0) * 0.55) - 2)], 3.6, ink, PIPE);
    if (d.vine) {
      const pts = [];
      for (let j = 0; j <= 9; j++) {
        const u = j / 9;
        pts.push(P3(cx + half * 0.8 + 3, A(ladderTop * u) + Math.sin(j * 1.9) * 4, (top + 30) * u));
      }
      vine3d(ctx, cam, pts, rnd, ink);
      const drape = [];
      for (let j = 0; j <= 6; j++) drape.push(P3(cx + half * 0.9 + 2, A(s0 + j * 18), zc(s0 + j * 18) + 14 - j * 3));
      vine3d(ctx, cam, drape, rnd, ink);
    }
  }

  /** O gira-gira: o disco enferrujado (tinta vermelha descascando), as barras em arco até o meio e o mato no meio. */
  function merryGoRound(ctx, cam, d, z0, ink) {
    const rnd = seeded(d.x, d.y, 3221);
    const r = d.r || 80;
    const zD = z0 + 20;
    const ring = (rad, z, n = 32) => {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * M.TAU;
        pts.push(cam.p({ x: d.x + Math.cos(t) * rad, y: d.y + Math.sin(t) * rad, z }));
      }
      return pts;
    };
    grass(ctx, cam, d.x - r * 0.7, d.y + r * 0.8, z0, 22, rnd, ink);
    grass(ctx, cam, d.x + r * 0.9, d.y - r * 0.2, z0, 20, rnd, ink);
    // o eixo embaixo (aparece na sombra do disco)
    pipe(ctx, cam, [{ x: d.x, y: d.y, z: z0 }, { x: d.x, y: d.y, z: zD - 6 }], 6, ink, '#5b6266');
    // o disco: a borda (lado) e o tampo
    const top = ring(r, zD), bottom = ring(r, zD - 7);
    const side = [];
    // a borda visível: a metade de baixo (perto da câmera) dos dois círculos
    const near = (t) => Math.sin(t + Math.PI / 4) > -0.05;
    const n = top.length;
    const idx = [];
    for (let i = 0; i < n; i++) if (near((i / n) * M.TAU)) idx.push(i);
    for (const i of idx) side.push(top[i]);
    for (const i of idx.slice().reverse()) side.push(bottom[i]);
    const sidePath = pathOf(side);
    inkFill(ctx, pathOf(top), '#a8553a', ink, 2.4);
    ctx.fillStyle = '#7a3b26';
    ctx.fill(sidePath);
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 2;
    ctx.stroke(sidePath);
    const topPath = pathOf(top);
    ctx.fillStyle = '#a8553a';
    ctx.fill(topPath);
    ctx.save();
    ctx.clip(topPath);
    // a tinta descascada (o metal cinza aparecendo), a ferrugem e as chapas
    for (let k = 0; k < 10; k++) {
      const t = rnd() * M.TAU, dd = rnd() * r * 0.85;
      const q = cam.p({ x: d.x + Math.cos(t) * dd, y: d.y + Math.sin(t) * dd, z: zD });
      ctx.fillStyle = k % 3 === 0 ? 'rgba(150, 146, 136, 0.8)' : k % 3 === 1 ? 'rgba(122, 56, 30, 0.85)' : 'rgba(186, 104, 52, 0.7)';
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, (6 + rnd() * 10) * cam.zoom, (3 + rnd() * 5) * cam.zoom, rnd() * 3, 0, M.TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(60, 28, 16, 0.55)';
    ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
    for (let k = 0; k < 4; k++) {
      const t = (k / 4) * M.TAU + Math.PI / 4;
      const a = cam.p({ x: d.x, y: d.y, z: zD }), b = cam.p({ x: d.x + Math.cos(t) * r, y: d.y + Math.sin(t) * r, z: zD });
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
    // as barras: da beirada do disco subindo em arco até o meio (as de trás antes do mato, as da frente depois)
    const bars = [0, 1, 2, 3].map((k) => (k / 4) * M.TAU + Math.PI / 4 + 0.2);
    const barPts = (t) => {
      const pts = [];
      for (let j = 0; j <= 6; j++) {
        const u = j / 6;
        const rad = r * 0.88 * (1 - u);
        pts.push({ x: d.x + Math.cos(t) * rad, y: d.y + Math.sin(t) * rad, z: zD + 4 + Math.sin(u * Math.PI * 0.5) * 46 });
      }
      return pts;
    };
    const isFront = (t) => Math.sin(t + Math.PI / 4) > 0;
    for (const t of bars) if (!isFront(t)) pipe(ctx, cam, barPts(t), 3.4, ink, PIPE);
    if (d.plants) {
      const fern = PD.flora && PD.flora.small && PD.flora.small['planta-samambaia'];
      if (fern) fern.paint(ctx, cam, { kind: 'planta-samambaia', x: d.x, y: d.y, r: r * 0.55 }, zD, ink);
    }
    for (const t of bars) {
      if (!isFront(t)) continue;
      pipe(ctx, cam, barPts(t), 3.4, ink, PIPE);
      if (d.rust) rustAlong(ctx, cam, barPts(t)[0], barPts(t)[6], rnd, 3);
    }
    // o topo das barras
    const c = cam.p({ x: d.x, y: d.y, z: zD + 50 });
    ctx.fillStyle = '#5b6266';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3.4 * cam.zoom, 0, M.TAU);
    ctx.fill();
  }

  // ------------------------------------------------------------------ cachoeirinha
  // Pedras grandes com musgo em cima, um vão no meio por onde a água passa e cai para o lado `queda` (o sul, no
  // mapa), espuma e ondinhas no poço. A água mexe: desenhada a cada quadro (`live`), só ela na tela.
  const ROCK = { base: '#8c8a80', shade: '#6a685f', light: '#aeaca0' };
  function boulder(ctx, cam, x, y, z0, r, h, rnd, ink, moss) {
    const qb = cam.p({ x, y, z: z0 });
    const qt = cam.p({ x, y, z: z0 + h });
    const cx = (qb.x + qt.x) / 2, cy = (qb.y + qt.y) / 2 + r * cam.sinP * cam.zoom * 0.25;
    const rx = r * cam.zoom, ry = (qb.y - qt.y) / 2 + r * cam.sinP * cam.zoom * 0.55;
    const pts = [];
    const ph = rnd() * M.TAU;
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * M.TAU;
      const wob = 1 + 0.07 * Math.sin(t * 3 + ph) + 0.04 * Math.sin(t * 5 + ph * 2);
      pts.push({ x: cx + Math.cos(t) * rx * wob, y: cy + Math.sin(t) * ry * wob * (Math.sin(t) > 0 ? 0.92 : 1) });
    }
    const path = pathOf(pts);
    inkFill(ctx, path, ROCK.base, ink, 2.4);
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = ROCK.shade;
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.45, cy + ry * 0.4, rx * 0.85, ry * 0.8, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = ROCK.light;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.35, cy - ry * 0.45, rx * 0.5, ry * 0.32, -0.2, 0, M.TAU);
    ctx.fill();
    if (moss) {
      // o musgo cobrindo o alto
      ctx.fillStyle = '#5c8a3e';
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.05, cy - ry * 0.72, rx * 0.8, ry * 0.42, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#7aa752';
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.25, cy - ry * 0.82, rx * 0.42, ry * 0.2, 0, 0, M.TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  small.cachoeira = {
    fades: true,
    height: (d) => d.h + 40,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0 + 30, d.x1 - 30, d.y0 + 10, d.y1 - 30, d.h * 0.6),
    box: (cam, d, z0) => volBox(cam, d.x0 - 70, d.x1 + 70, d.y0 - 70, d.y1 + 160, z0 - 30, z0 + d.h + 60, 24),
    paint() {}, // (tudo no `live`: a água mexe)
    live(ctx, cam, d, z0, time) {
      const ink = Math.max(1, 1.05 * cam.zoom);
      const W = d.x1 - d.x0, D = d.y1 - d.y0;
      const xm = d.x0 + W / 2;
      const h = d.h;
      // (só o lado sul, por enquanto: a água cai para +y, que é o lado que a câmera vê)
      const rnd = seeded(d.x0, d.y0, 3301);
      const lip = { z: z0 + h * 0.78, y: d.y1 - 18 };
      const pool = { z: z0 - 6, y: d.y1 + 46 };
      const half = Math.min(48, W * 0.15);
      // as pedras de trás (as maiores), da esquerda para a direita
      const back = [[0.1, 0.42, 70, 0.92], [0.3, 0.3, 82, 1], [0.7, 0.32, 80, 1.02], [0.9, 0.45, 66, 0.86]];
      for (const [u, v, r, k] of back) boulder(ctx, cam, d.x0 + W * u, d.y0 + D * v, z0, r, h * k, rnd, ink, d.moss);
      // o fundo do vão (pedra escura e molhada) por onde a água desce
      boulder(ctx, cam, xm, d.y0 + D * 0.45, z0, half + 18, h * 0.74, rnd, ink, false);
      // a água: uma faixa do alto do vão até o poço, com os riscos descendo
      const N = 8;
      const L = [], R = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const y = lip.y + (pool.y - lip.y) * Math.pow(u, 1.6);
        const z = lip.z + (pool.z - lip.z) * u;
        const w = half * (1 + u * 0.35);
        L.push(cam.p({ x: xm - w, y, z }));
        R.push(cam.p({ x: xm + w, y, z }));
      }
      const sheet = pathOf(L.concat(R.slice().reverse()));
      const top = cam.p({ x: xm, y: lip.y, z: lip.z }), bottom = cam.p({ x: xm, y: pool.y, z: pool.z });
      const g = ctx.createLinearGradient(top.x, top.y, bottom.x, bottom.y);
      g.addColorStop(0, 'rgba(150, 205, 220, 0.95)');
      g.addColorStop(1, 'rgba(225, 245, 248, 0.95)');
      ctx.strokeStyle = 'rgba(20, 50, 60, 0.55)';
      ctx.lineWidth = ink * 1.6;
      ctx.stroke(sheet);
      ctx.fillStyle = g;
      ctx.fill(sheet);
      ctx.save();
      ctx.clip(sheet);
      ctx.lineCap = 'round';
      for (let k = 0; k < 9; k++) {
        const s = (k + 0.5) / 9;
        const off = (time * 1.4 + rnd() * 3) % 1;
        for (let j = 0; j < 3; j++) {
          const u0 = (off + j / 3) % 1;
          const u1 = Math.min(1, u0 + 0.16);
          const at = (u) => {
            const i = Math.min(N - 1, Math.floor(u * N));
            const f = u * N - i;
            const l = { x: L[i].x + (L[i + 1].x - L[i].x) * f, y: L[i].y + (L[i + 1].y - L[i].y) * f };
            const r2 = { x: R[i].x + (R[i + 1].x - R[i].x) * f, y: R[i].y + (R[i + 1].y - R[i].y) * f };
            return { x: l.x + (r2.x - l.x) * s, y: l.y + (r2.y - l.y) * s };
          };
          const a = at(u0), b = at(u1);
          ctx.strokeStyle = j % 2 ? 'rgba(255, 255, 255, 0.75)' : 'rgba(110, 170, 190, 0.6)';
          ctx.lineWidth = Math.max(1, 2.2 * cam.zoom);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.restore();
      // a espuma no pé (as bolhas pulsando) e as ondinhas abrindo no poço
      const foot = cam.p({ x: xm, y: pool.y, z: pool.z + 4 });
      for (let k = 0; k < 3; k++) {
        const ph = (time * 0.7 + k / 3) % 1;
        ctx.strokeStyle = `rgba(235, 248, 250, ${(0.6 * (1 - ph)).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
        ctx.beginPath();
        ctx.ellipse(foot.x, foot.y + 6 * cam.zoom, (half * 1.2 + ph * 90) * cam.zoom, (half * 1.2 + ph * 90) * cam.zoom * cam.sinP, 0, 0, M.TAU);
        ctx.stroke();
      }
      for (let k = 0; k < 9; k++) {
        const t = time * 3 + k * 1.7;
        const ox = Math.sin(t * 1.3 + k) * half * 1.1 * cam.zoom;
        const oy = Math.cos(t + k * 2) * 6 * cam.zoom;
        const s = (6 + 4 * Math.sin(t * 2 + k)) * cam.zoom;
        ctx.fillStyle = 'rgba(245, 252, 253, 0.85)';
        ctx.beginPath();
        ctx.ellipse(foot.x + ox, foot.y + oy, s, s * 0.55, 0, 0, M.TAU);
        ctx.fill();
      }
      // a névoa da queda
      const mist = ctx.createRadialGradient(foot.x, foot.y - 10 * cam.zoom, 0, foot.x, foot.y - 10 * cam.zoom, 90 * cam.zoom);
      mist.addColorStop(0, 'rgba(240, 250, 252, 0.35)');
      mist.addColorStop(1, 'rgba(240, 250, 252, 0)');
      ctx.fillStyle = mist;
      ctx.beginPath();
      ctx.arc(foot.x, foot.y - 10 * cam.zoom, 90 * cam.zoom, 0, M.TAU);
      ctx.fill();
      // as pedras da frente, dos dois lados da queda
      boulder(ctx, cam, xm - half - 52, d.y1 - 8, z0, 54, h * 0.52, rnd, ink, d.moss);
      boulder(ctx, cam, xm + half + 56, d.y1 - 4, z0, 58, h * 0.46, rnd, ink, d.moss);
      boulder(ctx, cam, d.x1 - 26, d.y1 + 8, z0, 34, h * 0.24, rnd, ink, d.moss);
      boulder(ctx, cam, d.x0 + 22, d.y1 + 4, z0, 30, h * 0.2, rnd, ink, d.moss);
    },
  };

  // ------------------------------------------------------------------ posto abandonado
  // A cobertura: a laje no alto (com a faixa laranja desbotada na beirada), terra e mato em cima, arvorezinhas
  // (`arvoresNoTopo`) e o cipó pendurado (`cipo`). Fica por cima de quem está embaixo dela (`overhead`) e transparente
  // com o herói embaixo ou atrás.
  small.cobertura = {
    overhead: true,
    fades: true,
    height: (d) => d.h + 300,
    blocks: 0,
    shadow(p, cam, d) {
      // a sombra da laje, empurrada pela luz
      const L = cam.light;
      const dx = (-L.x / L.z) * d.h, dy = (-L.y / L.z) * d.h;
      p.moveTo(d.x0 + dx, d.y0 + dy);
      p.lineTo(d.x1 + dx, d.y0 + dy);
      p.lineTo(d.x1 + dx, d.y1 + dy);
      p.lineTo(d.x0 + dx, d.y1 + dy);
      p.closePath();
    },
    box: (cam, d, z0) => volBox(cam, d.x0 - 40, d.x1 + 40, d.y0 - 40, d.y1 + 40, z0 + d.h - 190, z0 + d.h + (d.trees ? 560 : 140), 24),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 3401);
      const zt = z0 + d.h, zb = zt - 38;
      const W = d.x1 - d.x0, D = d.y1 - d.y0;
      const P = (x, y, z) => cam.p({ x, y, z });
      const CONC = { front: '#cfc8b8', side: '#ada694', top: '#7d7058' };
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, zb, zt, CONC, ink);
      // a faixa laranja desbotada (frente e lado) e o escorrido de chuva
      quad(ctx, [P(d.x0, d.y1, zb + 9), P(d.x1, d.y1, zb + 9), P(d.x1, d.y1, zb + 21), P(d.x0, d.y1, zb + 21)], 'rgba(190, 96, 52, 0.85)');
      quad(ctx, [P(d.x1, d.y1, zb + 9), P(d.x1, d.y0, zb + 9), P(d.x1, d.y0, zb + 21), P(d.x1, d.y1, zb + 21)], 'rgba(160, 80, 44, 0.85)');
      for (let k = 0; k < 10; k++) {
        const onFront = rnd() < 0.6;
        const u = rnd();
        const a = onFront ? P(d.x0 + W * u, d.y1, zb + 4) : P(d.x1, d.y1 - D * u, zb + 4);
        ctx.fillStyle = 'rgba(70, 64, 50, 0.22)';
        ctx.fillRect(a.x - 2 * cam.zoom, a.y - 30 * cam.zoom, (3 + rnd() * 5) * cam.zoom, (20 + rnd() * 14) * cam.zoom);
      }
      // em cima: terra, mato e as manchas de grama
      const topPath = pathOf([P(d.x0, d.y0, zt), P(d.x1, d.y0, zt), P(d.x1, d.y1, zt), P(d.x0, d.y1, zt)]);
      ctx.save();
      ctx.clip(topPath);
      for (let k = 0; k < 16; k++) {
        const q = P(d.x0 + rnd() * W, d.y0 + rnd() * D, zt);
        ctx.fillStyle = k % 3 === 0 ? '#5b7a3a' : k % 3 === 1 ? '#6f8f45' : '#665a40';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, (24 + rnd() * 40) * cam.zoom, (12 + rnd() * 18) * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
      if (d.weeds) {
        for (let k = 0; k < 9; k++) {
          const edge = rnd() < 0.5;
          grass(ctx, cam, edge ? d.x0 + rnd() * W : d.x1 - 10, edge ? d.y1 - 8 : d.y0 + rnd() * D, zt, 22 + rnd() * 10, rnd, ink);
        }
      }
      if (d.trees) {
        // duas arvorezinhas e uma moita (as raízes agarradas na laje)
        H.roofTree(ctx, cam, d.x0 + W * 0.3, d.y0 + D * 0.32, zt, ink);
        H.roofTree(ctx, cam, d.x0 + W * 0.7, d.y0 + D * 0.62, zt, ink);
        const bush = small.arbusto || (PD.flora && PD.flora.small && PD.flora.small.arbusto);
        if (bush && bush.paint) bush.paint(ctx, cam, { kind: 'arbusto', x: d.x0 + W * 0.24, y: d.y0 + D * 0.78, r: 55 }, zt, ink);
      }
      if (d.vine > 0) {
        // o cipó pendurado da beirada da frente e do lado
        const n = Math.round(6 * d.vine) + 2;
        for (let k = 0; k < n; k++) {
          const onFront = k % 3 !== 2;
          const u = 0.08 + rnd() * 0.84;
          const x = onFront ? d.x0 + W * u : d.x1 + 2;
          const y = onFront ? d.y1 + 2 : d.y1 - D * u;
          const len = 50 + rnd() * 150 * d.vine;
          const pts = [];
          for (let j = 0; j <= 6; j++) pts.push({ x: x + Math.sin(j * 1.3 + k) * 4, y, z: zb + 6 - (len * j) / 6 });
          vine3d(ctx, cam, pts, rnd, ink);
        }
      }
    },
  };
  // Os pilares da cobertura: concreto branco encardido, a barra de baixo pintada de vermelho descascando, ferrugem
  // escorrendo, capim no pé e cipó subindo.
  small['pilar-cobertura'] = {
    height: (d) => d.h,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, d.h - 38),
    box: (cam, d, z0) => volBox(cam, d.x0 - 30, d.x1 + 30, d.y0 - 30, d.y1 + 30, z0, z0 + d.h, 16),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x, d.y, 3411);
      const zt = z0 + d.h - 38;
      const P = (x, y, z) => cam.p({ x, y, z });
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, z0, zt, { front: '#ddd7c9', side: '#b9b2a2', top: '#e6e1d4' }, ink);
      quad(ctx, [P(d.x0, d.y1, z0), P(d.x1, d.y1, z0), P(d.x1, d.y1, z0 + 70), P(d.x0, d.y1, z0 + 70)], d.band || '#a9473a');
      quad(ctx, [P(d.x1, d.y1, z0), P(d.x1, d.y0, z0), P(d.x1, d.y0, z0 + 70), P(d.x1, d.y1, z0 + 70)], d.band ? M.shade(d.band, -0.2) : '#8a382e');
      // a tinta descascando e a ferrugem escorrendo do alto
      for (let k = 0; k < 6; k++) {
        const front = rnd() < 0.6;
        const u = rnd();
        const q = front ? P(d.x0 + (d.x1 - d.x0) * u, d.y1, z0 + 10 + rnd() * 55) : P(d.x1, d.y1 - (d.y1 - d.y0) * u, z0 + 10 + rnd() * 55);
        ctx.fillStyle = 'rgba(214, 206, 190, 0.75)';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, (2 + rnd() * 3) * cam.zoom, (3 + rnd() * 4) * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
      for (let k = 0; k < 3; k++) {
        const q = P(d.x0 + (d.x1 - d.x0) * (0.2 + rnd() * 0.6), d.y1, zt - 6);
        ctx.fillStyle = 'rgba(146, 80, 40, 0.45)';
        ctx.fillRect(q.x, q.y, 2.4 * cam.zoom, (30 + rnd() * 60) * cam.zoom);
      }
      grass(ctx, cam, d.x0 - 6, d.y1 + 8, z0, 22, rnd, ink);
      grass(ctx, cam, d.x1 + 8, d.y0 + 10, z0, 18, rnd, ink);
      if (d.vine > 0 && rnd() < 0.85) {
        const pts = [];
        const top = (d.h - 60) * (0.5 + rnd() * 0.5);
        for (let j = 0; j <= 9; j++) pts.push({ x: d.x0 + (d.x1 - d.x0) * (0.3 + 0.4 * Math.sin(j * 1.2) ** 2), y: d.y1 + 3, z: z0 + (top * j) / 9 });
        vine3d(ctx, cam, pts, rnd, ink);
      }
    },
  };
  // A bomba velha: a ilha de concreto, o corpo de tinta laranja-avermelhada desbotada, a cabeça clara, o visor escuro
  // rachado e o bico com a mangueira do lado de `olhando`; ferrugem, tinta descascando e plantas no pé (`plantas`).
  // Nada de marca.
  small.bomba = {
    height: (d) => d.h + 20,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, d.h),
    box: (cam, d, z0) => volBox(cam, d.x0 - 60, d.x1 + 70, d.y0 - 40, d.y1 + 60, z0, z0 + d.h + 30, 20),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 3421);
      const h = d.h;
      const P = (x, y, z) => cam.p({ x, y, z });
      H.box(ctx, cam, d.x0 - 16, d.x1 + 16, d.y0 - 16, d.y1 + 16, z0, z0 + 14, { front: '#a29c8e', side: '#878174', top: '#b8b2a4' }, ink);
      const zb = z0 + 14;
      const zh = zb + h * 0.84;
      const PAINT = { front: '#b6603e', side: '#97492e', top: '#c8785a' };
      H.box(ctx, cam, d.x0, d.x1, d.y0 + 6, d.y1 - 6, zb, zh, PAINT, ink);
      H.box(ctx, cam, d.x0 - 4, d.x1 + 4, d.y0 + 2, d.y1 - 2, zh - 2, zb + h - 12, { front: '#cfc9ba', side: '#aaa496', top: '#ddd7c8' }, ink);
      // o lado do visor (+x, olhando para o leste; senão a frente, +y)
      const east = Math.cos(((d.angle || 0) * Math.PI) / 180) > 0.5;
      const faceLen = east ? d.y1 - d.y0 - 4 : d.x1 - d.x0 + 8;
      const origin = east ? { x: d.x1 + 4, y: d.y1 - 2, z: zb + h - 12 } : { x: d.x0 - 4, y: d.y1 - 2, z: zb + h - 12 };
      const dir = east ? { x: 0, y: -1 } : { x: 1, y: 0 };
      H.onWall(ctx, cam, origin, dir, () => {
        // o visor escuro, com os números apagados e a rachadura
        const vw = faceLen * 0.66, vx = (faceLen - vw) / 2;
        ctx.fillStyle = INK;
        ctx.fillRect(vx - 3, 10, vw + 6, 36);
        ctx.fillStyle = '#1f2a27';
        ctx.fillRect(vx, 13, vw, 30);
        ctx.fillStyle = 'rgba(140, 170, 150, 0.25)';
        for (let k = 0; k < 4; k++) ctx.fillRect(vx + 6 + k * (vw / 4.4), 19, vw / 6, 18);
        ctx.strokeStyle = 'rgba(220, 235, 230, 0.7)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(vx + vw * 0.2, 13);
        ctx.lineTo(vx + vw * 0.45, 30);
        ctx.lineTo(vx + vw * 0.38, 43);
        ctx.moveTo(vx + vw * 0.45, 30);
        ctx.lineTo(vx + vw * 0.7, 24);
        ctx.stroke();
      });
      H.onWall(ctx, cam, { ...origin, z: zh }, dir, () => {
        // a plaquinha em branco, a tinta descascando, a ferrugem escorrendo e o suporte do bico
        const ph = zh - zb;
        ctx.fillStyle = 'rgba(214, 206, 190, 0.9)';
        ctx.fillRect(faceLen * 0.2, 16, faceLen * 0.6, 22);
        for (let k = 0; k < 8; k++) {
          ctx.fillStyle = k % 2 ? 'rgba(126, 60, 30, 0.75)' : 'rgba(196, 160, 130, 0.6)';
          ctx.fillRect(rnd() * faceLen * 0.9, 40 + rnd() * (ph - 60), 6 + rnd() * 12, 8 + rnd() * 30);
        }
        ctx.fillStyle = INK;
        ctx.fillRect(faceLen * 0.62 - 3, ph * 0.42 - 3, 26, 34);
        ctx.fillStyle = '#4b4f52';
        ctx.fillRect(faceLen * 0.62, ph * 0.42, 20, 28);
      });
      // a mangueira: do suporte, descendo em barriga até perto do chão e voltando para o bico pendurado
      const side = east ? 1 : 0;
      const hx = east ? d.x1 + 6 : d.x0 + (d.x1 - d.x0) * 0.62;
      const hy = east ? d.y1 - 2 - (d.y1 - d.y0 - 4) * 0.66 : d.y1 + 6;
      const hose = [
        { x: hx, y: hy, z: zh - (zh - zb) * 0.42 },
        { x: hx + 10 * side, y: hy + 14 * (1 - side) + 6, z: zb + 26 },
        { x: hx + 24 * side, y: hy + 30 * (1 - side) + 4, z: zb + 10 },
        { x: hx + 30 * side, y: hy + 36 * (1 - side) - 12, z: zb + 36 },
      ];
      pipe(ctx, cam, hose, 3.2, ink, '#26292b');
      const nz = cam.p(hose[3]);
      ctx.fillStyle = INK;
      ctx.fillRect(nz.x - 4 * cam.zoom - ink, nz.y - 7 * cam.zoom - ink, 8 * cam.zoom + 2 * ink, 12 * cam.zoom + 2 * ink);
      ctx.fillStyle = '#7d7f80';
      ctx.fillRect(nz.x - 4 * cam.zoom, nz.y - 7 * cam.zoom, 8 * cam.zoom, 12 * cam.zoom);
      if (d.rust) rustAlong(ctx, cam, { x: d.x1, y: d.y1 - 6, z: zb }, { x: d.x1, y: d.y1 - 6, z: zh }, rnd, 5);
      if (d.plants) {
        const fern = PD.flora && PD.flora.small && PD.flora.small['planta-samambaia'];
        if (fern) fern.paint(ctx, cam, { kind: 'planta-samambaia', x: d.x1 + 14, y: d.y1 + 10, r: 38 }, z0, ink);
        const pts = [];
        for (let j = 0; j <= 7; j++) pts.push({ x: d.x0 + 4 + Math.sin(j * 1.4) * 3, y: d.y1 - 3, z: zb + (h * 0.7 * j) / 7 });
        vine3d(ctx, cam, pts, rnd, ink);
      }
      grass(ctx, cam, d.x0 - 14, d.y1 + 14, z0, 22, rnd, ink);
    },
  };
  // A pilha de pneus velhos: os empilhados (cada um um pouco torto) e um encostado na pilha; mato saindo do buraco.
  function tire(ctx, cam, x, y, z, R, rIn, th, ink) {
    const ct = cam.p({ x, y, z: z + th }), cb = cam.p({ x, y, z });
    const rx = R * cam.zoom, ry = R * cam.zoom * cam.sinP;
    // a banda do lado (o casco entre o círculo de cima e o de baixo)
    ctx.beginPath();
    ctx.ellipse(ct.x, ct.y, rx, ry, 0, Math.PI, 0);
    ctx.lineTo(cb.x + rx, cb.y);
    ctx.ellipse(cb.x, cb.y, rx, ry, 0, 0, Math.PI);
    ctx.closePath();
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 2.2;
    ctx.stroke();
    ctx.fillStyle = '#2b2b2d';
    ctx.fill();
    // os sulcos da banda
    ctx.strokeStyle = '#18181a';
    ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
    for (let k = 1; k < 9; k++) {
      const t = (k / 9) * Math.PI;
      const xx = ct.x + Math.cos(t) * rx, yy = ct.y + Math.sin(t) * ry;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx, yy + (cb.y - ct.y));
      ctx.stroke();
    }
    // o anel de cima e o buraco
    ctx.fillStyle = '#3a3a3d';
    ctx.beginPath();
    ctx.ellipse(ct.x, ct.y, rx, ry, 0, 0, M.TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111113';
    ctx.beginPath();
    ctx.ellipse(ct.x, ct.y, rIn * cam.zoom, rIn * cam.zoom * cam.sinP, 0, 0, M.TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 120, 126, 0.55)';
    ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
    ctx.beginPath();
    ctx.ellipse(ct.x, ct.y, (R + rIn) * 0.5 * cam.zoom, (R + rIn) * 0.5 * cam.zoom * cam.sinP, 0, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
  }
  small.pneus = {
    height: (d) => 22 * Math.max(1, (d.count || 3) - 1) + 40,
    blocks: 0,
    shadow: (p, cam, d) => H.circleShadow(p, cam, d.x, d.y, (d.r || 50) * 0.9, 50),
    box: (cam, d, z0) => volBox(cam, d.x - (d.r || 50) - 70, d.x + (d.r || 50) + 80, d.y - (d.r || 50) - 60, d.y + (d.r || 50) + 80, z0, z0 + 22 * (d.count || 3) + 60, 16),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x, d.y, 3431);
      const R = Math.min(36, (d.r || 50) * 0.66), rIn = R * 0.45, th = 21;
      const stacked = Math.max(1, (d.count || 3) - 1);
      grass(ctx, cam, d.x - R, d.y + R * 0.4, z0, 22, rnd, ink);
      for (let i = 0; i < stacked; i++) tire(ctx, cam, d.x + (rnd() - 0.5) * 9, d.y + (rnd() - 0.5) * 9, z0 + i * th, R, rIn, th, ink);
      // o mato saindo do buraco de cima
      grass(ctx, cam, d.x, d.y, z0 + stacked * th - 4, 24, rnd, ink);
      // o encostado: de pé, inclinado contra a pilha, do lado da frente
      const c = { x: d.x + R * 1.05, y: d.y + R * 1.05, z: z0 + R * 0.9 };
      const q = cam.p(c), qb = cam.p({ x: c.x + 12, y: c.y + 12, z: c.z - 4 });
      const rx = R * cam.zoom * 0.92, ry = R * cam.zoom;
      ctx.lineWidth = ink * 2.2;
      ctx.strokeStyle = INK;
      for (const [p, col] of [[q, '#2b2b2d'], [qb, '#3a3a3d']]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx, ry, -0.25, 0, M.TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#111113';
      ctx.beginPath();
      ctx.ellipse(qb.x, qb.y, rx * 0.45, ry * 0.45, -0.25, 0, M.TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 120, 126, 0.55)';
      ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
      ctx.beginPath();
      ctx.ellipse(qb.x, qb.y, rx * 0.72, ry * 0.72, -0.25, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
      grass(ctx, cam, d.x + R * 1.6, d.y + R * 1.5, z0, 18, rnd, ink);
    },
  };
})(window.PD = window.PD || {});
