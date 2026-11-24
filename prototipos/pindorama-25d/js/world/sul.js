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
// Também do Guarapiranga (o [mundo], 23 e 24/11): a cachoeira e a comporta (`cachoeira`, com `estilo: 'comporta'`), o
// coreto da Praça em Ruínas (`coreto`), a Caverna Sagrada (`caverna`, `rocha`, `oferenda`, `brasas`, `esteio`) e o
// mirante (`torre-mirante`, `guarda-corpo`, `luneta`, `painel-mirante`); e a Ilha do Véu (`menir`, `cortina-veu`).
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

  // ------------------------------------------------------------------ cachoeirinha e comporta
  // (23/11, o dono: "efeito da água descendo está feio") A água sai da beirada já andando para a frente e cai como quem
  // foi jogado — a lâmina quase deitada no alto e em pé embaixo —, lisa e verde-água em cima e branca de espuma
  // embaixo, com os fios descendo cada vez mais depressa; no pé, a espuma fervendo, os respingos, a névoa, as ondinhas e
  // a espuma indo embora com a correnteza. As pedras têm lados (eram bolas), ficam escuras de molhadas perto da água e
  // têm musgo em cima. `estilo` 'comporta' (a barragem de 1909): o muro de pedra com a boca em arco, a água correndo
  // lá dentro e saindo num jato, escorrendo pelo muro, e o tanque com as alas de pedra (`tanque`, o comprimento), onde
  // a água ferve. As partes paradas (pedras e muro) viram imagem uma vez por zoom (`baked`); só a água é desenhada a
  // cada quadro.
  const poly = PD.props.poly;
  const BAKED = new WeakMap();
  function baked(ctx, cam, d, name, bounds, draw) {
    let store = BAKED.get(d);
    if (!store) BAKED.set(d, (store = {}));
    const key = `${cam.zoom.toFixed(4)}|${cam.dpr}`;
    let s = store[name];
    const now = performance.now();
    // (com o zoom mudando, a imagem de antes esticada: refeita no máximo a cada 1/4 de segundo)
    if (!s || (s.key !== key && now - s.at > 250)) {
      const b = bounds();
      const x0 = Math.floor(b.x0), y0 = Math.floor(b.y0);
      const w = Math.max(1, Math.ceil(b.x1 - x0)), h = Math.max(1, Math.ceil(b.y1 - y0));
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * cam.dpr);
      c.height = Math.ceil(h * cam.dpr);
      const g = c.getContext('2d');
      g.setTransform(cam.dpr, 0, 0, cam.dpr, -x0 * cam.dpr, -y0 * cam.dpr);
      draw(g);
      s = store[name] = { c, x: x0, y: y0, w, h, zoom: cam.zoom, key, at: now };
    }
    const k = cam.zoom / s.zoom;
    ctx.drawImage(s.c, s.x * k, s.y * k, s.w * k, s.h * k);
  }
  function unionBox(boxes) {
    return {
      x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)),
      x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)),
    };
  }
  function hullOf(pts) {
    const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], up = [];
    for (const q of p) {
      while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
      lo.push(q);
    }
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
      up.push(q);
    }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  const line2 = (ctx, a, b) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  // pedra de rio: cinza frio; escurece e esverdeia onde a água molha
  const RIVER = { dark: [48, 54, 54], light: [184, 182, 170] };
  const MOSS = ['#365c2e', '#4f7d38', '#6e9c47', '#9cc464'];
  /**
   * Pedra de lados: a base irregular no chão, o topo menor (`flat`: quase do tamanho da base e reto — a laje por onde a
   * água passa) e as faces pintadas pela luz do dia. `o`: x, y, z0, rx, ry, h (cm), seed; `wet` (até que altura, a
   * partir do pé, ela está molhada), `moss` (musgo em cima).
   */
  function facetRock(ctx, cam, o, ink) {
    const rnd = M.rng(o.seed);
    const N = 8;
    const rot = rnd() * M.TAU;
    // três voltas (o pé, a barriga e o ombro) e a coroa: a pedra fica arredondada, mais larga que alta
    const RINGS = o.flat ? [[-4, 1], [0.72, 0.99], [1, 0.9]] : [[-4, 1], [0.5, 0.97], [0.84, 0.68]];
    const jit = [];
    for (let k = 0; k < N; k++) jit.push([(rnd() - 0.5) * 0.45, 0.86 + rnd() * 0.2]);
    const rings = RINGS.map(([zk, rk], ri) => jit.map(([da, f], k) => {
      const a = rot + (k / N) * M.TAU + da + ri * 0.07;
      const rr = f * rk * (ri ? 0.94 + rnd() * 0.1 : 1);
      const z = zk < 0 ? o.z0 + zk : o.z0 + o.h * zk * (ri === RINGS.length - 1 && !o.flat ? 0.92 + rnd() * 0.12 : 1);
      return { x: o.x + Math.cos(a) * o.rx * rr, y: o.y + Math.sin(a) * o.ry * rr, z };
    }));
    const crown = { x: o.x + (rnd() - 0.5) * o.rx * 0.25, y: o.y + (rnd() - 0.5) * o.ry * 0.25, z: o.z0 + o.h };
    return ringRock(ctx, cam, o, ink, rings, crown);
  }
  /**
   * Desenha uma pedra dada pelas voltas (`rings`: listas de pontos na mesma ordem, do pé para o alto) e a coroa: as
   * faces que olham para a câmera, pintadas pela luz, o contorno, a beirada clara, o molhado e o musgo. `o`: x, y, z0, h,
   * rx, ry, seed, `wet`, `moss`, `colors` ({ dark, light } em [r, g, b]). Serve para a pedra solta (`facetRock`) e para
   * o morro da caverna. Devolve o casco na tela.
   */
  function ringRock(ctx, cam, o, ink, rings, crown) {
    const N = rings[0].length;
    const top = rings[rings.length - 1];
    const faces = [];
    for (let ri = 0; ri < rings.length - 1; ri++) {
      for (let k = 0; k < N; k++) {
        const j = (k + 1) % N;
        faces.push([rings[ri][k], rings[ri][j], rings[ri + 1][j], rings[ri + 1][k]]);
      }
    }
    for (let k = 0; k < N; k++) faces.push([top[k], top[(k + 1) % N], crown]);
    const center = { x: o.x, y: o.y, z: o.z0 + o.h * 0.35 };
    const shown = [];
    for (const f of faces) {
      const c = { x: 0, y: 0, z: 0 };
      for (const q of f) {
        c.x += q.x / f.length;
        c.y += q.y / f.length;
        c.z += q.z / f.length;
      }
      let n = M.cross(M.sub(f[1], f[0]), M.sub(f[2], f[0]));
      if (M.dot(n, M.sub(c, center)) < 0) n = { x: -n.x, y: -n.y, z: -n.z };
      const l = Math.hypot(n.x, n.y, n.z) || 1;
      n = { x: n.x / l, y: n.y / l, z: n.z / l };
      if (M.dot(n, cam.toCamera) <= 0) continue; // de costas para a câmera
      shown.push({ pts: f.map((q) => cam.p(q)), lit: M.clamp01(0.42 + 0.62 * M.dot(n, cam.light)), up: n.z, depth: cam.depth(c) });
    }
    shown.sort((a, b) => a.depth - b.depth);
    const hull = hullOf([].concat(...rings, [crown]).map((q) => cam.p(q)));
    const hp = pathOf(hull);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 2.3;
    ctx.stroke(hp);
    const art = M.rng(o.seed + 17);
    for (const f of shown) {
      const C = o.colors || RIVER;
      const tone = C.dark.map((v, i) => Math.round(v + (C.light[i] - v) * f.lit));
      const p = pathOf(f.pts);
      ctx.fillStyle = `rgb(${tone.join(',')})`;
      ctx.fill(p);
      // cada face clareia para cima e escurece para baixo, com pintas de pedra
      const ys = f.pts.map((q) => q.y), xs = f.pts.map((q) => q.x);
      const y0 = Math.min(...ys), y1 = Math.max(...ys), x0 = Math.min(...xs), x1 = Math.max(...xs);
      const wash = ctx.createLinearGradient(0, y0, 0, y1);
      wash.addColorStop(0, 'rgba(255, 250, 232, 0.16)');
      wash.addColorStop(1, 'rgba(24, 30, 40, 0.2)');
      ctx.fillStyle = wash;
      ctx.fill(p);
      ctx.strokeStyle = 'rgba(24, 22, 20, 0.32)';
      ctx.lineWidth = Math.max(0.6, ink * 0.7);
      ctx.stroke(p);
      if (o.strata && f.pts.length === 4 && (x1 - x0) * (y1 - y0) > 4000 * cam.zoom * cam.zoom) {
        // (o morro da caverna) as camadas da pedra: riscos paralelos ao pé da face, meio tortos, e umas manchas de líquen
        const [q0, q1, q2, q3] = f.pts;
        ctx.save();
        ctx.clip(p);
        ctx.lineCap = 'round';
        for (let t = 0.14; t < 0.98; t += 0.16 + art() * 0.08) {
          const a = { x: q0.x + (q3.x - q0.x) * t, y: q0.y + (q3.y - q0.y) * t }, b = { x: q1.x + (q2.x - q1.x) * t, y: q1.y + (q2.y - q1.y) * t };
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + (art() - 0.5) * 6 * cam.zoom;
          ctx.strokeStyle = 'rgba(36, 30, 24, 0.24)';
          ctx.lineWidth = Math.max(0.8, 2 * cam.zoom);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(mx, my, b.x, b.y);
          ctx.stroke();
        }
        for (let k = 0; k < 3; k++) {
          const u = art(), v = art();
          const px = q0.x + (q1.x - q0.x) * u + (q3.x - q0.x) * v, py = q0.y + (q1.y - q0.y) * u + (q3.y - q0.y) * v;
          ctx.fillStyle = art() < 0.5 ? 'rgba(120, 140, 80, 0.22)' : 'rgba(210, 206, 160, 0.2)';
          ctx.beginPath();
          ctx.ellipse(px, py, (14 + art() * 26) * cam.zoom, (8 + art() * 12) * cam.zoom, art() * 3, 0, M.TAU);
          ctx.fill();
        }
        ctx.restore();
      }
      if ((x1 - x0) * (y1 - y0) > 300 * cam.zoom * cam.zoom) {
        ctx.save();
        ctx.clip(p);
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = f.up > 0.4 ? 'rgba(244, 240, 226, 0.26)' : 'rgba(30, 30, 30, 0.18)';
          ctx.beginPath();
          ctx.ellipse(x0 + art() * (x1 - x0), y0 + art() * (y1 - y0), (1 + art() * 1.8) * cam.zoom, (0.7 + art()) * cam.zoom, art() * 3, 0, M.TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    // a beirada clara do topo do lado da luz
    ctx.strokeStyle = 'rgba(246, 242, 226, 0.5)';
    ctx.lineWidth = Math.max(0.8, 1.3 * cam.zoom);
    ctx.lineCap = 'round';
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N;
      const mx = (top[k].x + top[j].x) / 2 - o.x, my = (top[k].y + top[j].y) / 2 - o.y;
      if (mx * cam.light.x + my * cam.light.y > 0) line2(ctx, cam.p(top[k]), cam.p(top[j]));
    }
    ctx.save();
    ctx.clip(hp);
    const hy = hull.map((q) => q.y), hx = hull.map((q) => q.x);
    const bot = Math.max(...hy), topY = Math.min(...hy), left = Math.min(...hx), right = Math.max(...hx);
    // molhada perto da água: escura, fria, com o brilho da água escorrendo
    if (o.wet) {
      const wl = cam.p({ x: o.x, y: o.y + o.ry * 0.6, z: o.z0 + o.wet }).y;
      const g = ctx.createLinearGradient(0, wl - 6 * cam.zoom, 0, bot);
      g.addColorStop(0, 'rgba(16, 34, 38, 0)');
      g.addColorStop(0.35, 'rgba(16, 34, 38, 0.38)');
      g.addColorStop(1, 'rgba(10, 26, 30, 0.6)');
      ctx.fillStyle = g;
      ctx.fillRect(left - 2, wl - 6 * cam.zoom, right - left + 4, bot - wl + 8 * cam.zoom);
      ctx.strokeStyle = 'rgba(214, 238, 240, 0.32)';
      ctx.lineWidth = Math.max(0.8, 1.2 * cam.zoom);
      for (let k = 0; k < 3; k++) {
        const sx = left + (0.2 + art() * 0.6) * (right - left), sy = wl + (0.15 + art() * 0.5) * (bot - wl);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + 2 * cam.zoom, sy + 5 * cam.zoom, sx + (art() - 0.5) * 3 * cam.zoom, sy + (6 + art() * 8) * cam.zoom);
        ctx.stroke();
      }
    } else {
      // o pé assentado no chão: mais escuro e esverdeado
      const g = ctx.createLinearGradient(0, topY + (bot - topY) * 0.6, 0, bot);
      g.addColorStop(0, 'rgba(30, 44, 28, 0)');
      g.addColorStop(1, 'rgba(30, 44, 28, 0.42)');
      ctx.fillStyle = g;
      ctx.fillRect(left - 2, topY, right - left + 4, bot - topY + 2);
    }
    // musgo nas faces de cima: tufos irregulares (escuros embaixo, claros em cima), uns escorrendo pela beirada
    if (o.moss) {
      const tops = shown.filter((f) => f.up > 0.62 && f.lit > 0.45);
      for (const f of tops) {
        if (art() < 0.35) continue;
        const c = f.pts.reduce((acc, q) => ({ x: acc.x + q.x / f.pts.length, y: acc.y + q.y / f.pts.length }), { x: 0, y: 0 });
        const r = Math.max(1.5, Math.min(o.rx, o.ry) * 0.09 * cam.zoom);
        for (let layer = 0; layer < 3; layer++) {
          ctx.fillStyle = MOSS[layer + (art() < 0.5 ? 0 : 1)];
          for (let q = 0; q < 5; q++) {
            ctx.beginPath();
            ctx.ellipse(c.x + (art() - 0.5) * r * 3.2, c.y + (art() - 0.5) * r * 1.6 - layer * r * 0.25, r * (0.6 + art() * 0.6) * (1 - layer * 0.25), r * (0.4 + art() * 0.35) * (1 - layer * 0.25), art() * 3, 0, M.TAU);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
    return hull;
  }

  /**
   * A lâmina d'água caindo. `o`: x, y, z da beirada (o meio), half (meia largura), drop (quanto cai), reach (quanto anda
   * para a frente até chegar lá embaixo), spread (quanto abre embaixo), seed. A água vai para +y (o sul do mapa).
   */
  function fallSheet(ctx, cam, o, time) {
    const N = 12;
    const at = (t, s) => {
      const w = o.half * (1 + o.spread * t);
      const wob = Math.sin(time * 5.2 + t * 7 + s * 2) * 2.4 * t;
      return cam.p({ x: o.x + s * w + wob, y: o.y + o.reach * t, z: o.z - o.drop * t * t });
    };
    const L = [], R = [];
    for (let i = 0; i <= N; i++) {
      L.push(at(i / N, -1));
      R.push(at(i / N, 1));
    }
    const sheet = pathOf(L.concat(R.slice().reverse()));
    const a0 = at(0, 0), a1 = at(1, 0);
    // o corpo: verde-água e transparente no alto, branco de espuma embaixo
    const g = ctx.createLinearGradient(a0.x, a0.y, a1.x, a1.y);
    g.addColorStop(0, 'rgba(62, 136, 146, 0.86)');
    g.addColorStop(0.25, 'rgba(96, 168, 178, 0.86)');
    g.addColorStop(0.62, 'rgba(176, 220, 226, 0.92)');
    g.addColorStop(1, 'rgba(240, 250, 250, 0.97)');
    ctx.fillStyle = g;
    ctx.fill(sheet);
    // os fios: cada um desce no seu ritmo (mais depressa embaixo: a água acelera); claros e grossos embaixo, uns
    // escuros no alto (o liso da água)
    const K = Math.max(6, Math.round((o.half * 2) / 11));
    const rnd = M.rng(o.seed);
    ctx.lineCap = 'round';
    for (let k = 0; k < K; k++) {
      const s = 0.92 * (-1 + (2 * (k + 0.2 + rnd() * 0.6)) / K);
      const speed = 0.75 + rnd() * 0.5;
      const ph = rnd();
      const wid = 0.8 + rnd() * 0.9;
      for (let j = 0; j < 3; j++) {
        const u0 = (ph + time * speed + j / 3) % 1;
        const u1 = Math.min(1, u0 + 0.1 + 0.2 * u0);
        const dark = (k + j) % 3 === 0 && u0 < 0.5;
        ctx.strokeStyle = dark ? `rgba(30, 90, 102, ${(0.5 * (1 - u0)).toFixed(3)})` : `rgba(255, 255, 255, ${(0.28 + 0.62 * u0).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, (wid + 1.7 * u0) * cam.zoom);
        line2(ctx, at(u0, s), at(u1, s));
      }
    }
    // a beirada brilhando (a água dobrando por cima da pedra) e a franja branca dos lados
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(238, 252, 252, 0.9)';
    ctx.lineWidth = Math.max(1.2, 2.4 * cam.zoom);
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const q = at(0.03, -1 + i / 4);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(246, 252, 252, 0.75)';
    ctx.lineWidth = Math.max(1, 1.5 * cam.zoom);
    for (const side of [L, R]) {
      ctx.beginPath();
      side.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
    }
  }

  /**
   * O pé da queda, na superfície da água. `o`: x, y, z, half (meia largura da espuma), seed, big (a comporta: mais
   * espuma e mais longe). Em duas vezes: `under` (as ondinhas e a espuma indo embora, por baixo da queda) e `over`
   * (a espuma fervendo, os respingos e a névoa).
   */
  function footUnder(ctx, cam, o, time) {
    const zm = cam.zoom;
    const rnd = M.rng(o.seed + 3);
    const P = (dx, dy, dz = 0) => cam.p({ x: o.x + dx, y: o.y + dy, z: o.z + dz });
    // as ondinhas abrindo em roda
    ctx.lineWidth = Math.max(1, 1.5 * zm);
    for (let k = 0; k < 3; k++) {
      const ph = (time * 0.5 + k / 3) % 1;
      const r = o.half * (1.05 + ph * (o.big ? 1.1 : 1.6));
      ctx.strokeStyle = `rgba(226, 244, 246, ${(0.5 * (1 - ph)).toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * M.TAU;
        const q = P(Math.cos(a) * r, Math.sin(a) * r * 0.75 + r * 0.25);
        if (i) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
      }
      ctx.stroke();
    }
    // a espuma indo embora com a correnteza (para +y): fiapos brancos que se desfazem
    ctx.lineCap = 'round';
    const far = o.big ? 2.2 : 3;
    for (let k = 0; k < (o.big ? 16 : 10); k++) {
      const ph = (time * (0.22 + rnd() * 0.12) + rnd()) % 1;
      const side = (rnd() - 0.5) * o.half * (o.big ? 2.2 : 1.7);
      const dist = o.half * 0.5 + ph * o.half * far;
      const len = 12 + rnd() * 22;
      ctx.strokeStyle = `rgba(242, 250, 250, ${(0.7 * (1 - ph) * Math.min(1, ph * 6)).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, (1.6 + rnd() * 1.4) * zm);
      line2(ctx, P(side, dist), P(side + (rnd() - 0.5) * 8, dist + len));
    }
  }
  let MIST = null;
  /** A névoa: um círculo branco que some para a beira (64 px, feito uma vez). */
  function mistSprite() {
    if (MIST) return MIST;
    MIST = document.createElement('canvas');
    MIST.width = MIST.height = 64;
    const g = MIST.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(240, 250, 252, 1)');
    rg.addColorStop(0.5, 'rgba(240, 250, 252, 0.45)');
    rg.addColorStop(1, 'rgba(240, 250, 252, 0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    return MIST;
  }
  /** Uma mancha de espuma no chão d'água: a beira ondulando com o tempo (`rx`, `ry` em cm). */
  function foamPatch(cam, o, rx, ry, time, ph, dy = 0) {
    const pts = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * M.TAU;
      const k = 1 + 0.13 * Math.sin(a * 3 + time * 2.1 + ph) + 0.08 * Math.sin(a * 7 - time * 3.3 + ph * 2) + 0.05 * Math.sin(a * 11 + time * 5 + ph);
      pts.push(cam.p({ x: o.x + Math.cos(a) * rx * k, y: o.y + dy + Math.sin(a) * ry * k, z: o.z + 1 }));
    }
    return pathOf(pts);
  }
  function footOver(ctx, cam, o, time) {
    const zm = cam.zoom;
    const rnd = M.rng(o.seed + 7);
    const P = (dx, dy, dz = 0) => cam.p({ x: o.x + dx, y: o.y + dy, z: o.z + dz });
    // a espuma: a mancha branca de beira mexendo (com a sombra azulada embaixo) e, em cima, as bolhas fervendo
    const rx = o.half * (o.big ? 1.25 : 1.15), ry = o.half * (o.big ? 0.85 : 0.5);
    ctx.fillStyle = 'rgba(176, 214, 220, 0.7)';
    ctx.fill(foamPatch(cam, o, rx * 1.12, ry * 1.18, time, 1.3, ry * 0.12));
    ctx.fillStyle = 'rgba(244, 251, 251, 0.82)';
    ctx.fill(foamPatch(cam, o, rx, ry, time, 0));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fill(foamPatch(cam, o, rx * 0.62, ry * 0.6, time * 1.4, 2.6, -ry * 0.1));
    const B = [];
    const n = o.big ? 16 : 12;
    for (let k = 0; k < n; k++) {
      const a = rnd() * M.TAU, dist = Math.sqrt(rnd()) * 0.85;
      const bx = Math.cos(a) * rx * dist, by = Math.sin(a) * ry * dist;
      const speed = 1.1 + rnd() * 0.9;
      const ph = (time * speed + rnd()) % 1;
      const r = (3.5 + rnd() * 5) * (o.big ? 1.25 : 1) * (0.4 + 0.6 * Math.sin(ph * Math.PI));
      B.push({ bx, by, r });
    }
    B.sort((a, b) => a.bx + a.by - (b.bx + b.by));
    for (const b of B) {
      const q = P(b.bx, b.by, b.r * 0.3);
      ctx.fillStyle = 'rgba(160, 200, 208, 0.7)';
      ctx.beginPath();
      ctx.ellipse(q.x + 0.8 * zm, q.y + 1.2 * zm, b.r * zm, b.r * zm * 0.7, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, b.r * zm * 0.85, b.r * zm * 0.6, 0, 0, M.TAU);
      ctx.fill();
    }
    // os respingos: gotinhas pulando em arco e caindo de volta
    for (let k = 0; k < (o.big ? 14 : 10); k++) {
      const ph = (time * (0.9 + rnd() * 0.6) + rnd()) % 1;
      const ang = rnd() * M.TAU;
      const sp = o.half * (0.4 + rnd() * 0.9);
      const hgt = (o.big ? 40 : 30) + rnd() * 40;
      const q = P(Math.cos(ang) * sp * ph, Math.sin(ang) * sp * ph * 0.7, hgt * 4 * ph * (1 - ph));
      ctx.fillStyle = `rgba(250, 254, 254, ${(0.9 * (1 - ph)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(0.8, (1.1 + rnd() * 1.5) * zm), 0, M.TAU);
      ctx.fill();
    }
    // a névoa da queda, respirando devagar (o degradê é uma imagem pronta: pintar o degradê a cada quadro pesava)
    const A = ctx.globalAlpha;
    for (const [dx, dz, k] of [[0, 40, 1], [o.half * 0.6, 70, 0.7]]) {
      const m = P(dx, 0, dz);
      const mr = o.half * (o.big ? 1.5 : 1.8) * k * zm;
      ctx.globalAlpha = A * (0.2 + 0.07 * Math.sin(time * 1.3 + dx)) * k;
      ctx.drawImage(mistSprite(), m.x - mr, m.y - mr, mr * 2, mr * 2);
    }
    ctx.globalAlpha = A;
  }

  // ---- a cachoeirinha (pedras)
  function naturalFall(ctx, cam, d, z0, time) {
    const ink = Math.max(1, 1.05 * cam.zoom);
    const W = d.x1 - d.x0, D = d.y1 - d.y0, hh = d.h;
    const xm = d.x0 + W / 2;
    const half = Math.min(75, W * 0.1);
    const seed = Math.round(d.x0 * 7 + d.y0 * 13);
    // a laje do meio, por onde a água passa, e a beirada dela
    const ledge = { x: xm, y: d.y0 + D * 0.52, rx: half + 36, ry: D * 0.34, h: hh * 0.8 };
    const lip = { x: xm, y: ledge.y + ledge.ry * 0.86, z: z0 + ledge.h };
    const reach = 80;
    const foot = { x: xm, y: lip.y + reach, z: z0, half: half * 1.1, seed, big: false };
    // [x, y, rx, ry, altura (do d.h)]: o paredão do fundo, os dois lados do vão e as da beira do poço (os tamanhos
    // são os da cachoeira de 8 m do Guarapiranga; numa menor, como a da mata do Capão, as pedras encolhem junto)
    const ks = M.clamp(W / 800, 0.5, 1), kr = M.clamp(W / 800, 0.72, 1);
    const SPOTS = [
      [d.x0 + W * 0.1, d.y0 + D * 0.32, 120, 96, 1.04], [d.x0 + W * 0.31, d.y0 + D * 0.2, 112, 92, 1.24],
      [d.x0 + W * 0.69, d.y0 + D * 0.22, 116, 94, 1.18], [d.x0 + W * 0.9, d.y0 + D * 0.34, 118, 96, 1.0],
      [xm - half - 92 * ks, d.y0 + D * 0.64, 84, 78, 0.98], [xm + half + 98 * ks, d.y0 + D * 0.6, 90, 84, 0.92],
      [xm - half - 72 * ks, d.y1 + 6, 56, 46, 0.42], [xm + half + 84 * ks, d.y1 + 16, 62, 50, 0.36],
      [d.x0 + W * 0.05, d.y1 - 8, 40, 34, 0.24], [d.x0 + W * 0.96, d.y1 - 14, 42, 36, 0.26],
    ];
    const rocks = SPOTS.map(([x, y, rx, ry, k], i) => ({ x, y, z0, rx: rx * kr, ry: ry * kr, h: hh * k, seed: seed + i * 31, moss: d.moss, wet: y > d.y1 - 40 ? 26 : y > d.y0 + D * 0.55 ? 40 : 0 }));
    const sheetDepth = cam.depth({ x: xm, y: lip.y + reach * 0.5, z: z0 });
    const depthOf = (r) => cam.depth({ x: r.x, y: r.y, z: z0 });
    const back = rocks.filter((r) => depthOf(r) < sheetDepth), front = rocks.filter((r) => depthOf(r) >= sheetDepth);
    const boxOf = (list) => () => unionBox(list.map((r) => volBox(cam, r.x - r.rx, r.x + r.rx, r.y - r.ry, r.y + r.ry, z0 - 8, z0 + r.h + 8, 14)));
    const ledgeRock = { ...ledge, z0, seed: seed + 7, flat: true, wet: ledge.h, moss: false };
    baked(ctx, cam, d, 'fundo', boxOf(back.concat([ledgeRock])), (g) => {
      for (const r of back) facetRock(g, cam, r, ink);
      facetRock(g, cam, ledgeRock, ink);
    });
    // a água chegando pela laje, entre as pedras do fundo
    const P = (x, y, z) => cam.p({ x, y, z });
    const yb = ledge.y - ledge.ry * 0.55;
    const run = pathOf([P(xm - half * 0.62, yb, lip.z + 1), P(xm + half * 0.62, yb, lip.z + 1), P(xm + half, lip.y, lip.z + 1), P(xm - half, lip.y, lip.z + 1)]);
    ctx.fillStyle = 'rgba(56, 124, 132, 0.92)';
    ctx.fill(run);
    ctx.save();
    ctx.clip(run);
    const rr = M.rng(seed + 9);
    ctx.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const s = -0.85 + (1.7 * (k + 0.5)) / 7;
      const ph = rr();
      for (let j = 0; j < 2; j++) {
        const u = (ph + time * 0.55 + j / 2) % 1;
        const w0 = half * (0.62 + 0.38 * u), w1 = half * (0.62 + 0.38 * Math.min(1, u + 0.22));
        const a = P(xm + s * w0, yb + (lip.y - yb) * u, lip.z + 1), b = P(xm + s * w1, yb + (lip.y - yb) * Math.min(1, u + 0.22), lip.z + 1);
        ctx.strokeStyle = `rgba(214, 240, 242, ${(0.55 * Math.sin(u * Math.PI)).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
        line2(ctx, a, b);
      }
    }
    ctx.restore();
    footUnder(ctx, cam, foot, time);
    fallSheet(ctx, cam, { x: xm, y: lip.y, z: lip.z, half, drop: lip.z - z0 + 4, reach, spread: 0.18, seed: seed + 5 }, time);
    footOver(ctx, cam, foot, time);
    baked(ctx, cam, d, 'frente', boxOf(front), (g) => {
      for (const r of front) facetRock(g, cam, r, ink);
    });
  }

  // ---- a comporta da barragem (muro de pedra com a boca em arco)
  const STONE = { face: '#a39e90', side: '#868276', top: '#bdb8a9', capF: '#b8b3a4', capS: '#9a968a', capT: '#cfcabb' };
  /** A boca no muro (pontos no mundo): o peitoril, os lados retos e o arco. */
  function gateMouth(d, z0) {
    const xm = (d.x0 + d.x1) / 2;
    const op = { half: Math.min(96, (d.x1 - d.x0) * 0.16), zs: 38, zt: 92, rise: 26 };
    const pts = [{ x: xm - op.half, y: d.y1, z: z0 + op.zs }, { x: xm + op.half, y: d.y1, z: z0 + op.zs }];
    for (let i = 0; i <= 12; i++) {
      const ang = (i / 12) * Math.PI;
      pts.push({ x: xm + Math.cos(ang) * op.half, y: d.y1, z: z0 + op.zt + Math.sin(ang) * op.rise });
    }
    return { op, pts, xm, zw: z0 + op.zs + 30 };
  }
  /** As fiadas de pedra numa parede (em cm na parede: `a` ao longo, `b` para baixo a partir do alto). */
  function courses(g, W, Hh, rnd, row = 30) {
    g.strokeStyle = 'rgba(50, 46, 40, 0.42)';
    g.lineWidth = 1.6;
    for (let b = row; b < Hh; b += row) {
      g.beginPath();
      g.moveTo(0, b);
      g.lineTo(W, b);
      g.stroke();
    }
    for (let b = 0, r = 0; b < Hh; b += row, r++) {
      let a = r % 2 ? -20 - rnd() * 20 : -rnd() * 30;
      while (a < W) {
        a += 45 + rnd() * 35;
        if (a > 2 && a < W - 2) {
          g.beginPath();
          g.moveTo(a, b);
          g.lineTo(a, Math.min(Hh, b + row));
          g.stroke();
        }
      }
    }
    // pedras de outro tom, aqui e ali
    for (let k = 0; k < Math.round((W * Hh) / 9000); k++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255, 250, 236, 0.12)' : 'rgba(40, 38, 34, 0.1)';
      g.fillRect(rnd() * W, Math.floor((rnd() * Hh) / row) * row + 1, 40 + rnd() * 30, row - 2);
    }
  }
  /** A ala de pedra do tanque: corre para +y, mais alta junto do muro; a face +x e a ponta aparecem. */
  function wing(g, cam, xa, xb, ya, yb, z0, ink, inner) {
    const ha = 64, hb = 34;
    const P = (x, y, z) => cam.p({ x, y, z });
    const side = [P(xb, ya, z0), P(xb, yb, z0), P(xb, yb, z0 + hb), P(xb, ya, z0 + ha)];
    const end = [P(xa, yb, z0), P(xb, yb, z0), P(xb, yb, z0 + hb), P(xa, yb, z0 + hb)];
    const top = [P(xa, ya, z0 + ha), P(xb, ya, z0 + ha), P(xb, yb, z0 + hb), P(xa, yb, z0 + hb)];
    poly(g, hullOf(side.concat(end, top)), null, INK, ink * 2.3);
    poly(g, side, STONE.side);
    poly(g, end, STONE.face);
    poly(g, top, STONE.top);
    const rnd = M.rng(Math.round(xa * 3 + ya));
    g.save();
    g.clip(pathOf(side));
    H.onWall(g, cam, { x: xb, y: ya, z: z0 + ha }, { x: 0, y: 1 }, () => courses(g, yb - ya, ha, rnd, 22));
    // o pé: molhado e com limo do lado da água, com capim do lado de fora
    const bot = Math.max(...side.map((q) => q.y));
    const gr = g.createLinearGradient(0, bot - 26 * cam.zoom, 0, bot);
    gr.addColorStop(0, inner ? 'rgba(30, 56, 40, 0)' : 'rgba(46, 70, 34, 0)');
    gr.addColorStop(1, inner ? 'rgba(24, 50, 40, 0.65)' : 'rgba(46, 70, 34, 0.5)');
    g.fillStyle = gr;
    g.fill(pathOf(side));
    g.restore();
    g.strokeStyle = 'rgba(24, 22, 20, 0.4)';
    g.lineWidth = ink * 0.8;
    g.stroke(pathOf(top));
  }
  function gateWall(g, cam, d, z0, ink) {
    const { x0, x1, y0, y1 } = d;
    const W = x1 - x0, hh = d.h, zt = z0 + hh;
    const B = d.basin || 300;
    const m = gateMouth(d, z0);
    const P = (x, y, z) => cam.p({ x, y, z });
    // a ala do lado de lá (oeste): a face de dentro, virada para o tanque
    wing(g, cam, x0 - 26, x0, y1, y1 + B, z0, ink, true);
    const face = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, zt), P(x0, y1, zt)];
    const side = [P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, zt), P(x1, y1, zt)];
    const mouth = m.pts.map((q) => cam.p(q));
    poly(g, hullOf(face.concat(side, [P(x0, y0, zt)])), null, INK, ink * 2.4);
    const fp = new Path2D();
    fp.addPath(pathOf(face));
    fp.addPath(pathOf(mouth.slice().reverse()));
    g.fillStyle = STONE.face;
    g.fill(fp, 'evenodd');
    poly(g, side, STONE.side);
    const rnd = M.rng(Math.round(x0 * 11 + y0 * 3));
    // as fiadas, as manchas de água escorrida e o limo no pé (recortados fora da boca)
    g.save();
    g.clip(fp, 'evenodd');
    H.onWall(g, cam, { x: x0, y: y1, z: zt }, { x: 1, y: 0 }, () => {
      courses(g, W, hh, rnd);
      for (let k = 0; k < 9; k++) {
        const a = rnd() * W, w = 6 + rnd() * 16, l = 30 + rnd() * 80;
        const gr = g.createLinearGradient(0, 0, 0, l);
        gr.addColorStop(0, 'rgba(46, 50, 40, 0.3)');
        gr.addColorStop(1, 'rgba(46, 50, 40, 0)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(a, 0);
        g.lineTo(a + w, 0);
        g.lineTo(a + w * 0.6, l);
        g.lineTo(a + w * 0.3, l);
        g.closePath();
        g.fill();
      }
      // embaixo da boca: o muro escuro de molhado, com limo
      const am = W / 2;
      const wet = g.createLinearGradient(0, hh - m.op.zs, 0, hh);
      wet.addColorStop(0, 'rgba(22, 40, 36, 0.55)');
      wet.addColorStop(1, 'rgba(30, 58, 36, 0.75)');
      g.fillStyle = wet;
      g.fillRect(am - m.op.half - 10, hh - m.op.zs, m.op.half * 2 + 20, m.op.zs);
      const foot = g.createLinearGradient(0, hh - 30, 0, hh);
      foot.addColorStop(0, 'rgba(40, 70, 36, 0)');
      foot.addColorStop(1, 'rgba(36, 66, 34, 0.6)');
      g.fillStyle = foot;
      g.fillRect(0, hh - 30, W, 30);
      // o arco: as pedras em cunha em volta da boca e a pedra de fecho no alto
      const cb = hh - m.op.zt;
      g.strokeStyle = 'rgba(50, 46, 40, 0.55)';
      g.lineWidth = 1.8;
      g.beginPath();
      g.ellipse(am, cb, m.op.half + 22, m.op.rise + 22, 0, Math.PI, M.TAU);
      g.stroke();
      for (let i = 1; i < 9; i++) {
        const ang = Math.PI + (i / 9) * Math.PI;
        g.beginPath();
        g.moveTo(am + Math.cos(ang) * m.op.half, cb + Math.sin(ang) * m.op.rise);
        g.lineTo(am + Math.cos(ang) * (m.op.half + 22), cb + Math.sin(ang) * (m.op.rise + 22));
        g.stroke();
      }
      g.fillStyle = '#b9b4a5';
      g.fillRect(am - 11, cb - m.op.rise - 26, 22, 28);
      g.strokeRect(am - 11, cb - m.op.rise - 26, 22, 28);
    });
    g.restore();
    // dentro da boca: o escuro do túnel e a parede de lá (oeste), que aparece
    g.save();
    g.clip(pathOf(mouth));
    const mt = Math.min(...mouth.map((q) => q.y)), mb = Math.max(...mouth.map((q) => q.y));
    const dk = g.createLinearGradient(0, mt, 0, mb);
    dk.addColorStop(0, '#0d1315');
    dk.addColorStop(1, '#1a2828');
    g.fillStyle = dk;
    g.fillRect(Math.min(...mouth.map((q) => q.x)) - 2, mt - 2, Math.max(...mouth.map((q) => q.x)) - Math.min(...mouth.map((q) => q.x)) + 4, mb - mt + 4);
    const wx = m.xm - m.op.half;
    const inner = [P(wx, y1, z0 + m.op.zs), P(wx, y1 - 180, z0 + m.op.zs), P(wx, y1 - 180, z0 + m.op.zt + m.op.rise), P(wx, y1, z0 + m.op.zt + m.op.rise)];
    const ig = g.createLinearGradient(inner[0].x, 0, inner[1].x, 0);
    ig.addColorStop(0, 'rgba(92, 92, 84, 0.95)');
    ig.addColorStop(1, 'rgba(20, 26, 26, 0)');
    g.fillStyle = ig;
    g.fill(pathOf(inner));
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = ink * 1.6;
    g.stroke(pathOf(mouth));
    // a laje do alto, com musgo e o cipó descendo pelo muro
    H.box(g, cam, x0 - 8, x1 + 8, y0 - 6, y1 + 8, zt, zt + 14, { front: STONE.capF, side: STONE.capS, top: STONE.capT }, ink);
    if (d.moss) {
      for (const [u, v, n] of [[0.04, 0.2, 9], [0.22, 0.1, 6], [0.5, 0.05, 5], [0.78, 0.15, 8], [0.97, 0.5, 9], [0.4, 0.95, 4]]) {
        const cx = x0 + W * u, cy = y0 - 6 + (y1 - y0 + 14) * v;
        for (let l = 0; l < 3; l++) {
          g.fillStyle = MOSS[l + (l === 2 ? 1 : 0)];
          for (let k = 0; k < n; k++) {
            const q = P(cx + (rnd() - 0.5) * 60, cy + (rnd() - 0.5) * 20, zt + 14);
            const r = (3 + rnd() * 5) * cam.zoom * (1 - l * 0.25);
            g.beginPath();
            g.ellipse(q.x, q.y - l * 1.2 * cam.zoom, r, r * 0.6, 0, 0, M.TAU);
            g.fill();
          }
        }
      }
      for (const u of [0.12, 0.3, 0.83]) {
        const a = P(x0 + W * u, y1 + 8, zt + 6);
        const len = (50 + rnd() * 60) * cam.zoom;
        g.strokeStyle = '#3e6a30';
        g.lineWidth = Math.max(1, 1.6 * cam.zoom);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.bezierCurveTo(a.x + 6 * cam.zoom, a.y + len * 0.3, a.x - 6 * cam.zoom, a.y + len * 0.6, a.x + 3 * cam.zoom, a.y + len);
        g.stroke();
        for (let k = 0; k < 7; k++) {
          const t = k / 7;
          g.fillStyle = MOSS[1 + (k % 3)];
          g.beginPath();
          g.ellipse(a.x + Math.sin(t * 6) * 5 * cam.zoom, a.y + len * t, 4 * cam.zoom, 2.6 * cam.zoom, t * 3, 0, M.TAU);
          g.fill();
        }
      }
    }
  }
  function gateFall(ctx, cam, d, z0, time) {
    const ink = Math.max(1, 1.05 * cam.zoom);
    const B = d.basin || 300;
    const m = gateMouth(d, z0);
    const seed = Math.round(d.x0 * 7 + d.y0 * 13);
    const P = (x, y, z) => cam.p({ x, y, z });
    baked(ctx, cam, d, 'muro', () => volBox(cam, d.x0 - 34, d.x1 + 12, d.y0 - 10, d.y1 + B + 6, z0 - 8, z0 + d.h + 26, 16), (g) => gateWall(g, cam, d, z0, ink));
    // a água correndo dentro do túnel, até a boca
    const mouth = pathOf(m.pts.map((q) => cam.p(q)));
    const hw = m.op.half - 6;
    ctx.save();
    ctx.clip(mouth);
    const ry0 = d.y1 - 200;
    const plane = pathOf([P(m.xm - hw, ry0, m.zw), P(m.xm + hw, ry0, m.zw), P(m.xm + hw, d.y1, m.zw), P(m.xm - hw, d.y1, m.zw)]);
    const pa = P(m.xm, ry0, m.zw), pb = P(m.xm, d.y1, m.zw);
    const wg = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
    wg.addColorStop(0, 'rgba(16, 40, 42, 0.95)');
    wg.addColorStop(1, 'rgba(58, 128, 136, 0.95)');
    ctx.fillStyle = wg;
    ctx.fill(plane);
    const rr = M.rng(seed + 11);
    ctx.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const s = -0.9 + (1.8 * (k + 0.5)) / 9;
      const ph = rr();
      for (let j = 0; j < 2; j++) {
        const u = (ph + time * 0.8 + j / 2) % 1;
        const y = ry0 + 200 * u;
        ctx.strokeStyle = `rgba(210, 238, 240, ${(0.6 * u).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
        line2(ctx, P(m.xm + s * hw, y, m.zw), P(m.xm + s * hw, Math.min(d.y1, y + 50), m.zw));
      }
    }
    ctx.restore();
    // a água escorrendo pelo muro, embaixo da boca (os fiozinhos descendo)
    ctx.lineCap = 'round';
    for (let k = 0; k < 10; k++) {
      const x = m.xm - m.op.half + 8 + rr() * (m.op.half * 2 - 16);
      const ph = (time * (0.9 + rr() * 0.5) + rr()) % 1;
      const zA = z0 + m.op.zs * (1 - ph), zB = Math.max(z0, zA - 12);
      ctx.strokeStyle = `rgba(200, 232, 236, ${(0.55 * (1 - ph * 0.5)).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.8, 1.1 * cam.zoom);
      line2(ctx, P(x, d.y1 + 1, zA), P(x, d.y1 + 1, zB));
    }
    const reach = 125;
    const foot = { x: m.xm, y: d.y1 + reach, z: z0, half: m.op.half * 1.05, seed, big: true };
    footUnder(ctx, cam, foot, time);
    fallSheet(ctx, cam, { x: m.xm, y: d.y1, z: m.zw, half: hw, drop: m.zw - z0 + 4, reach, spread: 0.12, seed: seed + 5 }, time);
    footOver(ctx, cam, foot, time);
    // a ala da frente (leste), por cima da espuma
    baked(ctx, cam, d, 'ala', () => volBox(cam, d.x1 - 2, d.x1 + 30, d.y1, d.y1 + B + 4, z0 - 8, z0 + 72, 14), (g) => wing(g, cam, d.x1, d.x1 + 26, d.y1, d.y1 + B, z0, ink, false));
  }

  small.cachoeira = {
    fades: true,
    height: (d) => d.h + 40,
    blocks: 0,
    shadow: (p, cam, d) => (d.style === 'comporta'
      ? H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, d.h)
      : H.boxShadow(p, cam, d.x0 + 30, d.x1 - 30, d.y0 + 10, d.y1 - 30, d.h * 0.6)),
    box: (cam, d, z0) => (d.style === 'comporta'
      ? volBox(cam, d.x0 - 60, d.x1 + 60, d.y0 - 20, d.y1 + (d.basin || 300) + 60, z0 - 20, z0 + d.h + 60, 24)
      : volBox(cam, d.x0 - 90, d.x1 + 90, d.y0 - 60, d.y1 + 220, z0 - 30, z0 + d.h * 1.3 + 60, 24)),
    paint() {}, // (tudo no `live`: a água mexe; as pedras e o muro viram imagem uma vez por zoom)
    // (só a queda para o sul, por enquanto: a água cai para +y, o lado que a câmera vê)
    live(ctx, cam, d, z0, time) {
      if (d.style === 'comporta') gateFall(ctx, cam, d, z0, time);
      else naturalFall(ctx, cam, d, z0, time);
    },
  };

  // ------------------------------------------------------------------ coreto
  // (24/11, o dono: "pode seguir vestindo o coreto") O coreto octogonal das praças antigas de São Paulo, na Praça em
  // Ruínas do Guarapiranga: a base de alvenaria (reboco creme descascando e mostrando o tijolo, os painéis em relevo, o
  // limo no pé e uma pichação), a escada de quatro degraus do lado sul com o portãozinho de ferro caído, o piso de
  // ladrilho sujo de folhas, o gradil de ferro com os arabescos (um pedaço arrancado), as oito colunas de ferro fundido
  // verdes com as mãos-francesas, o lambrequim de madeira em volta do beiral, o telhado de zinco em sino com as
  // costuras, a ferrugem escorrendo e um buraco, e a lanterninha com o pináculo no alto; o cipó sobe pelas colunas e
  // desce do beiral. Não dá para subir: a base inteira segura o jogador (as caixas de colisão vêm do mapa).
  const COR = {
    plaster: '#e4d6b2', plinth: '#a39b8b', cornice: '#d8d0bd', brick: '#9c5a3e', iron: '#2c3c33', ironHi: '#6d9a7e',
    zinc: '#8e9b95', lamb: '#ebe2cb', tileA: '#c9b996', tileB: '#97604a',
    step: { front: '#bcb4a2', side: '#9f9789', top: '#cdc6b4' },
  };
  const oct = (cx, cy, r, z) => Array.from({ length: 8 }, (_, k) => {
    const a = ((k + 0.5) * Math.PI) / 4;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, z };
  });
  /** A normal de fora do lado k do octógono (o lado entre o vértice k e o k + 1); o lado 1 olha para o sul (+y). */
  const sideNormal = (k) => ({ x: Math.cos(((k + 1) * Math.PI) / 4), y: Math.sin(((k + 1) * Math.PI) / 4), z: 0 });
  const facing = (cam, n) => M.dot(n, cam.toCamera) > 0.02;
  const litOf = (cam, n) => M.clamp01(0.45 + 0.6 * M.dot(n, cam.light));
  function coretoGeom(d, z0) {
    const R = d.r;
    const zf = z0 + d.h + 10; // o piso (a base e a cornija)
    const zc = zf + 300; // o alto das colunas
    const Re = R + 52; // o beiral
    const ze = zc + 12;
    return { R, zf, Rc: R - 20, zc, Re, ze, Rm: Re * 0.5, zm: ze + 125, Rt: 44, zt: ze + 300, stairW: 130, tread: 32 };
  }
  /** Desenha numa face vertical (de `a` até `b`, no alto `top`) em cm: u ao longo, v para baixo. */
  function onFace(ctx, cam, a, b, top, fn) {
    const pa = cam.p({ x: a.x, y: a.y, z: top }), pb = cam.p({ x: b.x, y: b.y, z: top });
    const [A, B] = pa.x <= pb.x ? [a, b] : [b, a];
    const L = Math.hypot(B.x - A.x, B.y - A.y);
    H.onWall(ctx, cam, { x: A.x, y: A.y, z: top }, { x: (B.x - A.x) / L, y: (B.y - A.y) / L }, () => fn(L));
  }
  /** Um remendo de reboco caído (o tijolo aparecendo), em cm na parede. */
  function brickPatch(ctx, x, y, w, h, rnd) {
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * M.TAU;
      const k = 0.75 + rnd() * 0.35;
      pts.push({ x: x + w / 2 + Math.cos(a) * (w / 2) * k, y: y + h / 2 + Math.sin(a) * (h / 2) * k });
    }
    const p = pathOf(pts);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = COR.brick;
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.strokeStyle = 'rgba(214, 200, 176, 0.75)';
    ctx.lineWidth = 1.4;
    for (let r = 0, yy = y - 4; yy < y + h + 4; yy += 7, r++) {
      ctx.beginPath();
      ctx.moveTo(x - 4, yy);
      ctx.lineTo(x + w + 4, yy);
      for (let xx = x - 4 + (r % 2) * 10; xx < x + w + 4; xx += 21) {
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx, yy + 7);
      }
      ctx.stroke();
    }
    ctx.restore();
    // a beira do reboco: a espessura (sombra) e a quina clara
    ctx.strokeStyle = 'rgba(84, 70, 50, 0.7)';
    ctx.lineWidth = 2.4;
    ctx.stroke(p);
    ctx.save();
    ctx.translate(-1.5, -1.5);
    ctx.strokeStyle = 'rgba(255, 250, 236, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke(p);
    ctx.restore();
  }
  function coretoBase(ctx, cam, d, g, z0, rnd, ink) {
    const cx = d.x, cy = d.y;
    const B0 = oct(cx, cy, g.R, z0 - 2), B1 = oct(cx, cy, g.R, g.zf - 10);
    const C0 = oct(cx, cy, g.R + 12, g.zf - 10), C1 = oct(cx, cy, g.R + 12, g.zf);
    const P = (q) => cam.p(q);
    poly(ctx, hullOf(B0.concat(C1).map(P)), null, INK, ink * 2.4);
    const sides = [];
    for (let k = 0; k < 8; k++) {
      const n = sideNormal(k);
      if (facing(cam, n)) sides.push({ k, n, lit: litOf(cam, n), depth: cam.depth({ x: cx + n.x * g.R, y: cy + n.y * g.R, z: z0 }) });
    }
    sides.sort((a, b) => a.depth - b.depth);
    const Hh = g.zf - 10 - (z0 - 2);
    for (const s of sides) {
      const j = (s.k + 1) % 8;
      const face = [B0[s.k], B0[j], B1[j], B1[s.k]].map(P);
      quad(ctx, face, M.shade(COR.plaster, (s.lit - 0.55) * 0.55));
      ctx.save();
      ctx.clip(pathOf(face));
      onFace(ctx, cam, B1[s.k], B1[j], g.zf - 10, (L) => {
        // o rodapé de pedra
        ctx.fillStyle = M.shade(COR.plinth, (s.lit - 0.55) * 0.5);
        ctx.fillRect(0, Hh - 22, L, 22);
        ctx.fillStyle = 'rgba(40, 34, 26, 0.4)';
        ctx.fillRect(0, Hh - 23.5, L, 2);
        // o painel em relevo, com o losango no meio
        const x0 = 28, x1 = L - 28, y0 = 14, y1 = Hh - 36;
        ctx.strokeStyle = 'rgba(80, 64, 42, 0.5)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        ctx.strokeStyle = 'rgba(255, 250, 236, 0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6);
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, rw = Math.min(46, (x1 - x0) * 0.22), rh = (y1 - y0) * 0.32;
        ctx.beginPath();
        ctx.moveTo(mx, my - rh);
        ctx.lineTo(mx + rw, my);
        ctx.lineTo(mx, my + rh);
        ctx.lineTo(mx - rw, my);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(80, 64, 42, 0.45)';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        if (d.ruin) {
          // o reboco caído mostrando o tijolo
          for (let q = 0; q < 2; q++) {
            if (rnd() < 0.3) continue;
            const w = 34 + rnd() * 46, h = 18 + rnd() * 22;
            brickPatch(ctx, 8 + rnd() * (L - w - 16), 6 + rnd() * (Hh - h - 30), w, h, rnd);
          }
          // a pichação (no lado sudeste: o do sul fica atrás da escada)
          if (s.k === 0) {
            ctx.save();
            ctx.translate(0, 16);
            ctx.scale(0.42, 0.42);
            H.pixo(ctx, L / 0.42, 0, rnd, 0.75);
            ctx.restore();
          }
        }
        // a água da chuva escorrendo da cornija e o limo no pé
        for (let q = 0; q < 5; q++) {
          const x = rnd() * L, w = 5 + rnd() * 12, l = 24 + rnd() * 46;
          const gr = ctx.createLinearGradient(0, 0, 0, l);
          gr.addColorStop(0, 'rgba(70, 64, 48, 0.32)');
          gr.addColorStop(1, 'rgba(70, 64, 48, 0)');
          ctx.fillStyle = gr;
          ctx.fillRect(x, 0, w, l);
        }
        const moss = ctx.createLinearGradient(0, Hh - 34, 0, Hh);
        moss.addColorStop(0, 'rgba(58, 86, 40, 0)');
        moss.addColorStop(1, 'rgba(52, 80, 36, 0.55)');
        ctx.fillStyle = moss;
        ctx.fillRect(0, Hh - 34, L, 34);
      });
      ctx.restore();
      // a quina (a linha da aresta)
      ctx.strokeStyle = 'rgba(40, 32, 22, 0.45)';
      ctx.lineWidth = ink * 0.9;
      line2(ctx, P(B0[j]), P(B1[j]));
    }
    // a cornija (a laje do piso, um pouco mais larga) e o piso de ladrilho
    for (const s of sides) {
      const j = (s.k + 1) % 8;
      quad(ctx, [C0[s.k], C0[j], C1[j], C1[s.k]].map(P), M.shade(COR.cornice, (s.lit - 0.55) * 0.5));
    }
    const floor = pathOf(C1.map(P));
    ctx.fillStyle = COR.tileA;
    ctx.fill(floor);
    ctx.save();
    ctx.clip(floor);
    const S = 30;
    const R = g.R + 12;
    for (let i = -Math.ceil(R / S); i < Math.ceil(R / S); i++) {
      for (let j = -Math.ceil(R / S); j < Math.ceil(R / S); j++) {
        const x = cx + i * S, y = cy + j * S;
        const r = seeded(x, y, 3511);
        const dark = (i + j) % 2 !== 0;
        let col = dark ? COR.tileB : COR.tileA;
        if (r() < 0.12) col = M.shade(col, -0.18);
        quad(ctx, [P({ x, y, z: g.zf }), P({ x: x + S, y, z: g.zf }), P({ x: x + S, y: y + S, z: g.zf }), P({ x, y: y + S, z: g.zf })], col);
      }
    }
    // a sombra do telhado no piso (a luz vem do oeste e do sul: o lado leste fica no escuro)
    {
      const Lt = cam.light, dz = g.ze - g.zf;
      const sx = (-Lt.x / Lt.z) * dz, sy = (-Lt.y / Lt.z) * dz;
      ctx.fillStyle = 'rgba(34, 30, 44, 0.42)';
      ctx.fill(pathOf(oct(cx + sx, cy + sy, g.Re, g.zf).map(P)));
      const C = P({ x: cx, y: cy, z: g.zf });
      const rg = ctx.createRadialGradient(C.x, C.y, R * 0.55 * cam.zoom, C.x, C.y, R * 1.05 * cam.zoom);
      rg.addColorStop(0, 'rgba(70, 58, 40, 0)');
      rg.addColorStop(1, 'rgba(70, 58, 40, 0.35)');
      ctx.fillStyle = rg;
      ctx.fill(floor);
    }
    // a sujeira, as folhas secas e o musgo nos cantos
    for (let k = 0; k < 30; k++) {
      const a = rnd() * M.TAU, rr = Math.sqrt(rnd()) * R * 0.95;
      const q = P({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, z: g.zf });
      ctx.fillStyle = k % 3 === 0 ? 'rgba(84, 110, 52, 0.55)' : k % 3 === 1 ? 'rgba(150, 96, 44, 0.75)' : 'rgba(96, 76, 50, 0.35)';
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, (6 + rnd() * 14) * cam.zoom, (3 + rnd() * 6) * cam.zoom, rnd() * 3, 0, M.TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(40, 32, 22, 0.5)';
    ctx.lineWidth = ink * 1.2;
    ctx.stroke(floor);
  }
  /** A escada do lado sul: quatro degraus de pedra gasta e o portãozinho de ferro caído em cima deles. */
  function coretoStairs(ctx, cam, d, g, z0, rnd, ink) {
    const cx = d.x;
    const yS = d.y + g.R * Math.cos(Math.PI / 8);
    const N = 4, hs = (g.zf - z0) / N;
    for (let k = 0; k < N; k++) {
      const y1 = yS + (N - k) * g.tread;
      const za = z0 + k * hs, zb = za + hs;
      H.box(ctx, cam, cx - g.stairW, cx + g.stairW, yS - 4, y1, za, zb, COR.step, ink);
      // a quina gasta e o limo na junta
      const a = cam.p({ x: cx - g.stairW, y: y1, z: zb }), b = cam.p({ x: cx + g.stairW, y: y1, z: zb });
      ctx.strokeStyle = 'rgba(255, 250, 236, 0.4)';
      ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
      line2(ctx, a, b);
      ctx.strokeStyle = 'rgba(70, 96, 48, 0.55)';
      ctx.lineWidth = Math.max(1, 2.4 * cam.zoom);
      const c = cam.p({ x: cx - g.stairW, y: y1, z: za + 1 }), e = cam.p({ x: cx + g.stairW, y: y1, z: za + 1 });
      line2(ctx, c, e);
      // folhas secas nos degraus
      for (let q = 0; q < 4; q++) {
        const p = cam.p({ x: cx - g.stairW + rnd() * g.stairW * 2, y: y1 - rnd() * g.tread, z: zb });
        ctx.fillStyle = q % 2 ? '#a8632e' : '#8a5a2a';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 4 * cam.zoom, 2 * cam.zoom, rnd() * 3, 0, M.TAU);
        ctx.fill();
      }
    }
    if (d.ruin) {
      // o portãozinho caído: deitado torto sobre os degraus de baixo
      const x0 = cx - g.stairW * 0.7, x1 = cx + g.stairW * 0.35;
      const top = { y: yS + 2.2 * g.tread, z: z0 + hs * 2 + 2 }, bot = { y: yS + 4.4 * g.tread, z: z0 + 1 };
      const corners = [{ x: x0, ...top }, { x: x1, ...top }, { x: x1 + 18, ...bot }, { x: x0 + 18, ...bot }];
      pipe(ctx, cam, [corners[0], corners[1], corners[2], corners[3], corners[0]], 2.2, ink, COR.iron);
      for (let t = 0.12; t < 1; t += 0.14) {
        const a = { x: x0 + (x1 - x0) * t, ...top }, b = { x: x0 + 18 + (x1 - x0) * t, ...bot };
        pipe(ctx, cam, [a, b], 1.2, ink * 0.6, COR.iron);
      }
    }
  }
  /** O gradil de um lado (entre as colunas `a` e `b`): corrimão, barras, a faixa de argolas e a barra de baixo. */
  function coretoRail(ctx, cam, d, g, it, rnd, ink) {
    const { a, b, k } = it;
    const H0 = 92;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    const at = (u, z) => ({ x: a.x + ux * u, y: a.y + uy * u, z: g.zf + z });
    // (o lado da escada: só os dois toquinhos perto das colunas; um lado tem um pedaço arrancado)
    const spans = [];
    if (k === 1 && d.stairs) {
      const gap0 = L / 2 - g.stairW - 6, gap1 = L / 2 + g.stairW + 6;
      if (gap0 > 14) spans.push([0, gap0]);
      if (L - gap1 > 14) spans.push([gap1, L]);
    } else if (d.ruin && k === 7) {
      spans.push([0, L * 0.34], [L * 0.62, L]);
    } else spans.push([0, L]);
    for (const [u0, u1] of spans) {
      pipe(ctx, cam, [at(u0, 10), at(u1, 10)], 2.2, ink, COR.iron);
      for (let u = u0 + 11; u < u1 - 4; u += 12) pipe(ctx, cam, [at(u, 10), at(u, H0)], 0.9, ink * 0.5, COR.iron);
      // a faixa de argolas no meio
      ctx.strokeStyle = COR.iron;
      ctx.lineWidth = Math.max(0.8, 1.6 * cam.zoom);
      for (let u = u0 + 12; u < u1 - 10; u += 24) {
        const c = cam.p(at(u + 6, 52));
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 5.5 * cam.zoom, 6 * cam.zoom * cam.cosP, 0, 0, M.TAU);
        ctx.stroke();
      }
      pipe(ctx, cam, [at(u0, H0), at(u1, H0)], 2.8, ink, COR.iron);
      // a ferrugem
      for (let q = 0; q < 3; q++) {
        const c = cam.p(at(u0 + rnd() * (u1 - u0), H0 - rnd() * 60));
        ctx.fillStyle = 'rgba(150, 82, 40, 0.55)';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, (2 + rnd() * 3) * cam.zoom, (1.5 + rnd() * 2) * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
    }
    if (d.ruin && k === 7) {
      // as pontas tortas do pedaço arrancado
      pipe(ctx, cam, [at(L * 0.34, H0), at(L * 0.4, H0 - 24), at(L * 0.43, H0 - 46)], 2.4, ink, COR.iron);
      pipe(ctx, cam, [at(L * 0.62, 10), at(L * 0.57, 4)], 2, ink, COR.iron);
    }
  }
  /** Uma coluna de ferro fundido: o pé, o fuste com a luz de um lado, o capitel e as duas mãos-francesas. */
  function coretoColumn(ctx, cam, d, g, it, rnd, ink) {
    const c = it.c;
    const p0 = cam.p({ x: c.x, y: c.y, z: g.zf }), p1 = cam.p({ x: c.x, y: c.y, z: g.zc });
    const r = 7.5 * cam.zoom;
    // o pé
    const fb = cam.p({ x: c.x, y: c.y, z: g.zf + 20 });
    ctx.fillStyle = INK;
    ctx.fillRect(p0.x - r * 2 - ink, fb.y - ink, r * 4 + 2 * ink, p0.y - fb.y + 2 * ink);
    const gb = ctx.createLinearGradient(p0.x - r * 2, 0, p0.x + r * 2, 0);
    gb.addColorStop(0, COR.ironHi);
    gb.addColorStop(0.45, COR.iron);
    gb.addColorStop(1, '#16201b');
    ctx.fillStyle = gb;
    ctx.fillRect(p0.x - r * 2, fb.y, r * 4, p0.y - fb.y);
    // o fuste
    ctx.fillStyle = INK;
    ctx.fillRect(p0.x - r - ink, p1.y, 2 * (r + ink), fb.y - p1.y);
    const gs = ctx.createLinearGradient(p0.x - r, 0, p0.x + r, 0);
    gs.addColorStop(0, COR.ironHi);
    gs.addColorStop(0.4, '#3f5f4d');
    gs.addColorStop(1, '#17231d');
    ctx.fillStyle = gs;
    ctx.fillRect(p0.x - r, p1.y, 2 * r, fb.y - p1.y);
    // os anéis do fuste e o capitel
    ctx.fillStyle = INK;
    for (const z of [g.zf + 60, g.zc - 60]) {
      const q = cam.p({ x: c.x, y: c.y, z });
      ctx.fillRect(q.x - r * 1.35, q.y - 2 * cam.zoom, r * 2.7, 4 * cam.zoom);
    }
    const cap = cam.p({ x: c.x, y: c.y, z: g.zc - 18 });
    ctx.beginPath();
    ctx.moveTo(cap.x - r, cap.y);
    ctx.lineTo(cap.x + r, cap.y);
    ctx.lineTo(p1.x + r * 2.2, p1.y);
    ctx.lineTo(p1.x - r * 2.2, p1.y);
    ctx.closePath();
    ctx.fillStyle = COR.iron;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink;
    ctx.stroke();
    // a ferrugem descendo
    ctx.fillStyle = 'rgba(146, 80, 40, 0.5)';
    ctx.fillRect(p0.x + r * 0.1, p1.y + (fb.y - p1.y) * (0.2 + rnd() * 0.4), r * 0.5, (fb.y - p1.y) * 0.2);
    // as mãos-francesas: um quarto de círculo da coluna até o beiral, para os dois lados
    const k = it.k;
    for (const nb of [(k + 1) % 8, (k + 7) % 8]) {
      const o = oct(d.x, d.y, g.Rc, 0)[nb];
      const L = Math.hypot(o.x - c.x, o.y - c.y);
      const ux = (o.x - c.x) / L, uy = (o.y - c.y) / L;
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const ph = (i / 8) * (Math.PI / 2);
        const u = 58 - 58 * Math.cos(ph), z = g.zc - 58 + 58 * Math.sin(ph);
        pts.push({ x: c.x + ux * u, y: c.y + uy * u, z });
      }
      pipe(ctx, cam, pts, 1.4, ink * 0.6, COR.iron);
      // o caracol de dentro
      const sp = [];
      for (let i = 0; i <= 10; i++) {
        const ph = (i / 10) * M.TAU * 0.8;
        const rr = 14 * (1 - i / 14);
        sp.push({ x: c.x + ux * (20 + Math.cos(ph) * rr * 0.6), y: c.y + uy * (20 + Math.cos(ph) * rr * 0.6), z: g.zc - 22 + Math.sin(ph) * rr * 0.6 });
      }
      pipe(ctx, cam, sp, 0.9, ink * 0.4, COR.iron);
    }
  }
  /** O telhado de zinco em sino (dois anéis de chapas), o lambrequim do beiral e a lanterninha com o pináculo. */
  function coretoRoof(ctx, cam, d, g, rnd, ink) {
    const cx = d.x, cy = d.y;
    const P = (q) => cam.p(q);
    const E = oct(cx, cy, g.Re, g.ze), Mi = oct(cx, cy, g.Rm, g.zm), T = oct(cx, cy, g.Rt, g.zt);
    const F = oct(cx, cy, g.Re, g.ze - 7);
    const center = { x: cx, y: cy, z: g.ze };
    const facets = [];
    for (let k = 0; k < 8; k++) {
      const j = (k + 1) % 8;
      for (const [ring0, ring1, band] of [[E, Mi, 0], [Mi, T, 1]]) {
        const f = [ring0[k], ring0[j], ring1[j], ring1[k]];
        let n = M.cross(M.sub(f[1], f[0]), M.sub(f[3], f[0]));
        const mid = { x: (f[0].x + f[2].x) / 2, y: (f[0].y + f[2].y) / 2, z: (f[0].z + f[2].z) / 2 };
        if (M.dot(n, M.sub(mid, center)) < 0) n = { x: -n.x, y: -n.y, z: -n.z };
        const l = Math.hypot(n.x, n.y, n.z) || 1;
        n = { x: n.x / l, y: n.y / l, z: n.z / l };
        if (M.dot(n, cam.toCamera) <= 0) continue;
        facets.push({ f, k, band, lit: litOf(cam, n), depth: cam.depth(mid) });
      }
    }
    facets.sort((a, b) => a.depth - b.depth);
    // o contorno de tudo e a beirada (a tábua do beiral)
    poly(ctx, hullOf(E.concat(F, T).map(P)), null, INK, ink * 2.6);
    for (let k = 0; k < 8; k++) {
      const n = sideNormal(k);
      if (!facing(cam, n)) continue;
      const j = (k + 1) % 8;
      quad(ctx, [F[k], F[j], E[j], E[k]].map(P), M.shade('#d7cfbb', (litOf(cam, n) - 0.55) * 0.5));
    }
    for (const fc of facets) {
      const pts = fc.f.map(P);
      const path = pathOf(pts);
      ctx.fillStyle = M.shade(COR.zinc, (fc.lit - 0.55) * 0.7);
      ctx.fill(path);
      ctx.save();
      ctx.clip(path);
      // as costuras das chapas (de baixo até em cima) e a ferrugem escorrendo delas
      const [a0, a1, b1, b0] = fc.f;
      for (let t = 0.125; t < 1; t += 0.125) {
        const lo = { x: a0.x + (a1.x - a0.x) * t, y: a0.y + (a1.y - a0.y) * t, z: a0.z };
        const hi = { x: b0.x + (b1.x - b0.x) * t, y: b0.y + (b1.y - b0.y) * t, z: b0.z };
        ctx.strokeStyle = 'rgba(40, 48, 46, 0.35)';
        ctx.lineWidth = Math.max(0.8, 1.4 * cam.zoom);
        line2(ctx, P(lo), P(hi));
        if (d.ruin && rnd() < 0.3) {
          const s = 0.15 + rnd() * 0.4;
          const m = { x: hi.x + (lo.x - hi.x) * s, y: hi.y + (lo.y - hi.y) * s, z: hi.z + (lo.z - hi.z) * s };
          ctx.strokeStyle = 'rgba(150, 78, 36, 0.55)';
          ctx.lineWidth = Math.max(1, (2 + rnd() * 3) * cam.zoom);
          line2(ctx, P(m), P(lo));
        }
      }
      // o musgo na beirada de baixo
      if (fc.band === 0 && d.ruin) {
        for (let q = 0; q < 2; q++) {
          const t = 0.15 + rnd() * 0.7, s = rnd() * 0.2;
          const lo = { x: a0.x + (a1.x - a0.x) * t, y: a0.y + (a1.y - a0.y) * t, z: a0.z };
          const hi = { x: b0.x + (b1.x - b0.x) * t, y: b0.y + (b1.y - b0.y) * t, z: b0.z };
          const q3 = P({ x: lo.x + (hi.x - lo.x) * s, y: lo.y + (hi.y - lo.y) * s, z: lo.z + (hi.z - lo.z) * s });
          for (let l = 0; l < 3; l++) {
            ctx.fillStyle = MOSS[l];
            for (let e = 0; e < 4; e++) {
              ctx.beginPath();
              ctx.ellipse(q3.x + (rnd() - 0.5) * 22 * cam.zoom, q3.y + (rnd() - 0.5) * 8 * cam.zoom - l * 1.5 * cam.zoom, (3 + rnd() * 5) * cam.zoom * (1 - l * 0.25), (2 + rnd() * 2.5) * cam.zoom * (1 - l * 0.25), 0, 0, M.TAU);
              ctx.fill();
            }
          }
        }
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(30, 36, 34, 0.55)';
      ctx.lineWidth = Math.max(0.8, ink * 0.9);
      ctx.stroke(path);
    }
    // o buraco no telhado (numa chapa de baixo, do lado da câmera): o escuro e os caibros aparecendo
    if (d.ruin) {
      const fc = facets.filter((f) => f.band === 0).sort((a, b) => b.lit - a.lit)[1];
      if (fc) {
        const [a0, a1, b1, b0] = fc.f;
        const at = (t, s) => {
          const lo = { x: a0.x + (a1.x - a0.x) * t, y: a0.y + (a1.y - a0.y) * t, z: a0.z };
          const hi = { x: b0.x + (b1.x - b0.x) * t, y: b0.y + (b1.y - b0.y) * t, z: b0.z };
          return P({ x: lo.x + (hi.x - lo.x) * s, y: lo.y + (hi.y - lo.y) * s, z: lo.z + (hi.z - lo.z) * s });
        };
        const hole = [];
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * M.TAU;
          const rr = 0.75 + rnd() * 0.45;
          hole.push(at(0.55 + Math.cos(ang) * 0.17 * rr, 0.42 + Math.sin(ang) * 0.24 * rr));
        }
        const hp = pathOf(hole);
        ctx.fillStyle = '#1c1915';
        ctx.fill(hp);
        ctx.save();
        ctx.clip(hp);
        ctx.strokeStyle = '#6a4a30';
        ctx.lineWidth = Math.max(1.5, 4 * cam.zoom);
        for (const t of [0.48, 0.62]) line2(ctx, at(t, 0.1), at(t, 0.8));
        ctx.restore();
        ctx.strokeStyle = '#b7c2bd';
        ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
        ctx.stroke(hp);
      }
    }
    // o lambrequim: a franja de madeira recortada pendurada na beirada (os lados que olham para a câmera)
    for (let k = 0; k < 8; k++) {
      const n = sideNormal(k);
      if (!facing(cam, n)) continue;
      const j = (k + 1) % 8;
      const lit = litOf(cam, n);
      const a = F[k], b = F[j];
      const top = g.ze - 7;
      ctx.save();
      onFace(ctx, cam, a, b, top, (L) => {
        const W = 16, Hb = 12;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(L, 0);
        ctx.lineTo(L, Hb);
        const n = Math.max(1, Math.round(L / W));
        const w = L / n;
        for (let i = n - 1; i >= 0; i--) {
          const missing = d.ruin && rnd() < 0.08;
          const x = i * w;
          if (missing) ctx.lineTo(x, Hb);
          else ctx.arc(x + w / 2, Hb, w / 2, 0, Math.PI, false);
        }
        ctx.closePath();
        ctx.fillStyle = M.shade(COR.lamb, (lit - 0.55) * 0.45);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40, 32, 24, 0.7)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        // os furinhos recortados e a tinta descascada
        ctx.fillStyle = 'rgba(40, 32, 24, 0.55)';
        for (let i = 0; i < n; i++) {
          ctx.beginPath();
          ctx.arc(i * w + w / 2, Hb * 0.55, 2.2, 0, M.TAU);
          ctx.fill();
        }
        if (d.ruin) {
          ctx.fillStyle = 'rgba(120, 100, 76, 0.5)';
          for (let q = 0; q < 4; q++) ctx.fillRect(rnd() * L, rnd() * Hb, 6 + rnd() * 14, 3 + rnd() * 4);
        }
      });
      ctx.restore();
    }
    // a lanterninha: o prisma com as janelinhas, o chapeuzinho e o pináculo com a bola
    const L0 = oct(cx, cy, g.Rt, g.zt), L1 = oct(cx, cy, g.Rt, g.zt + 46);
    poly(ctx, hullOf(L0.concat(L1).map(P)), null, INK, ink * 2.2);
    for (let k = 0; k < 8; k++) {
      const n = sideNormal(k);
      if (!facing(cam, n)) continue;
      const j = (k + 1) % 8;
      quad(ctx, [L0[k], L0[j], L1[j], L1[k]].map(P), M.shade('#d9d0b8', (litOf(cam, n) - 0.55) * 0.5));
      const w0 = { x: L0[k].x + (L0[j].x - L0[k].x) * 0.25, y: L0[k].y + (L0[j].y - L0[k].y) * 0.25 };
      const w1 = { x: L0[k].x + (L0[j].x - L0[k].x) * 0.75, y: L0[k].y + (L0[j].y - L0[k].y) * 0.75 };
      quad(ctx, [{ ...w0, z: g.zt + 10 }, { ...w1, z: g.zt + 10 }, { ...w1, z: g.zt + 36 }, { ...w0, z: g.zt + 36 }].map(P), '#2a2e2c');
    }
    const Cap = oct(cx, cy, g.Rt + 12, g.zt + 46);
    const apex = { x: cx, y: cy, z: g.zt + 104 };
    poly(ctx, hullOf(Cap.concat([apex]).map(P)), null, INK, ink * 2.2);
    for (let k = 0; k < 8; k++) {
      const j = (k + 1) % 8;
      const mid = { x: (Cap[k].x + Cap[j].x) / 2 - cx, y: (Cap[k].y + Cap[j].y) / 2 - cy, z: 0 };
      const l = Math.hypot(mid.x, mid.y) || 1;
      const n = { x: (mid.x / l) * 0.8, y: (mid.y / l) * 0.8, z: 0.6 };
      if (M.dot(n, cam.toCamera) <= 0) continue;
      quad(ctx, [Cap[k], Cap[j], apex, apex].map(P), M.shade(COR.zinc, (litOf(cam, n) - 0.55) * 0.7));
    }
    pipe(ctx, cam, [apex, { x: cx, y: cy, z: apex.z + 54 }], 1.6, ink, '#5a5f5c');
    const ball = P({ x: cx, y: cy, z: apex.z + 30 });
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 6.5 * cam.zoom + ink, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#8a7a52';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 6.5 * cam.zoom, 0, M.TAU);
    ctx.fill();
  }
  small.coreto = {
    fades: true,
    height: (d) => coretoGeom(d, 0).zt + 160,
    blocks: 0,
    shadow(p, cam, d) {
      // a base (com a sombra da altura dela) e o telhado, empurrados pela luz
      const g = coretoGeom(d, 0);
      const L = cam.light;
      const sh = (q) => ({ x: q.x - (L.x / L.z) * q.z, y: q.y - (L.y / L.z) * q.z });
      for (const pts of [oct(d.x, d.y, g.R, 0).concat(oct(d.x, d.y, g.R + 12, g.zf).map(sh)), oct(d.x, d.y, g.Re, g.ze).map(sh).concat([sh({ x: d.x, y: d.y, z: g.zt + 100 })])]) {
        const hull = hullOf(pts);
        hull.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
        p.closePath();
      }
    },
    box: (cam, d, z0) => {
      const g = coretoGeom(d, z0);
      return volBox(cam, d.x - g.Re - 30, d.x + g.Re + 30, d.y - g.Re - 30, d.y + g.Re + 4 * g.tread + 40, z0 - 10, g.zt + 170, 24);
    },
    paint(ctx, cam, d, z0, ink) {
      const g = coretoGeom(d, z0);
      const rnd = seeded(d.x, d.y, 3501);
      coretoBase(ctx, cam, d, g, z0, rnd, ink);
      if (d.stairs) coretoStairs(ctx, cam, d, g, z0, rnd, ink);
      // o gradil e as colunas, do fundo para a frente; o cipó subindo por duas colunas da frente
      const Cc = oct(d.x, d.y, g.Rc, g.zf);
      const items = [];
      for (let k = 0; k < 8; k++) {
        const a = Cc[k], b = Cc[(k + 1) % 8];
        items.push({ rail: true, k, a, b, depth: cam.depth({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: g.zf }) });
        items.push({ rail: false, k, c: a, depth: cam.depth(a) + 1 });
      }
      items.sort((a, b) => a.depth - b.depth);
      for (const it of items) {
        if (it.rail) coretoRail(ctx, cam, d, g, it, rnd, ink);
        else {
          coretoColumn(ctx, cam, d, g, it, rnd, ink);
          if (d.vine > 0 && (it.k === 0 || it.k === 2) && rnd() < 0.5 + d.vine) {
            const pts = [];
            for (let i = 0; i <= 10; i++) pts.push({ x: it.c.x + Math.sin(i * 1.7) * 9, y: it.c.y + Math.cos(i * 1.7) * 9, z: g.zf + (i / 10) * (g.zc - g.zf) });
            vine3d(ctx, cam, pts, rnd, ink);
          }
        }
      }
      coretoRoof(ctx, cam, d, g, rnd, ink);
      // o cipó pendurado do beiral, do lado da câmera
      if (d.vine > 0) {
        const F = oct(d.x, d.y, g.Re, g.ze - 30);
        for (const k of [7, 0, 1]) {
          const j = (k + 1) % 8;
          for (let q = 0; q < 2; q++) {
            if (rnd() > d.vine) continue;
            const t = 0.2 + rnd() * 0.6;
            const x = F[k].x + (F[j].x - F[k].x) * t, y = F[k].y + (F[j].y - F[k].y) * t;
            const len = 60 + rnd() * 120;
            const pts = [];
            for (let i = 0; i <= 6; i++) pts.push({ x: x + Math.sin(i) * 4, y, z: g.ze - 30 - (i / 6) * len });
            vine3d(ctx, cam, pts, rnd, ink);
          }
        }
      }
    },
  };

  // ------------------------------------------------------------------ Caverna Sagrada (Guarapiranga)
  // (24/11, o dono: "pode seguir vestindo a caverna") O morro de pedra no meio da mata do sudoeste, com a boca escura
  // virada para o sul (o lado que a câmera vê): lá no fundo, a luz verde-água da energia ancestral respirando e as
  // faíscas subindo (`overlay`, a cada quadro; de noite, mais forte). Na pedra em volta da boca, as itacoatiaras
  // (espiral, círculos, o sol e a cobra, gravados, que brilham fraquinho) e as pinturas de ocre (gente de braços para
  // cima, a capivara, o veado e as mãos). As raízes da mata de cima descendo pela boca, as estalactites, o musgo e a água
  // escorrida na pedra, o capim, as samambaias e a arvorezinha no alto. Na clareira em frente (o mapa): a fogueira, as
  // `oferenda`s (pedra chata com velas acesas, flores, a cabaça e a cuia), os `esteio`s com as fitas no vento e as
  // pedras soltas (`rocha`: a pedra da cachoeira, mais quente). Não dá para entrar (a boca pode virar uma saída depois).
  const CAVE_ROCK = { dark: [58, 52, 46], light: [184, 172, 150] };
  /** A pedra de dentro da caverna (`escura`): quase sem luz, a parede some no escuro. */
  const DARK_ROCK = { dark: [26, 24, 24], light: [104, 98, 92] };
  const OCHRE = '#9b3d24';
  const GLOW_SPRITES = new Map();
  /** Um círculo de luz que some para a beira, de uma cor (64 px, feito uma vez). */
  function glowSprite(color) {
    let c = GLOW_SPRITES.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const n = parseInt(color.slice(1), 16);
    const rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, `rgba(${rgb}, 1)`);
    rg.addColorStop(0.45, `rgba(${rgb}, 0.45)`);
    rg.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    GLOW_SPRITES.set(color, c);
    return c;
  }
  /**
   * O morro: três voltas (o pé, a barriga e o alto), com os mesmos 12 pontos na mesma ordem; os dois primeiros são a
   * frente reta e em pé (a do sul, com a boca), o resto dá a volta, cada vez mais para dentro e mais alto.
   */
  function caveGeom(d, z0) {
    const { x0, x1, y0, y1 } = d, H = d.h;
    const W = x1 - x0, D = y1 - y0;
    const cx = x0 + W / 2, cy = y0 + D / 2;
    const rnd = M.rng(Math.round(x0 * 3 + y0 * 7) + 4111);
    // o contorno do pé (a frente reta de x0 + 60 a x1 - 80; depois, a volta pelo leste, o fundo e o oeste)
    const outline = [[x0 + 60, y1], [x1 - 80, y1], [x1, y1 - 140], [x1 - 10, cy - 20], [x1 - 70, y0 + 150], [x1 - 260, y0 + 10], [cx + 60, y0], [x0 + 330, y0 + 30], [x0 + 80, y0 + 170], [x0, cy - 30], [x0 + 10, y1 - 170], [x0 + 20, y1 - 40]];
    const ring = (k, zk, jz) => outline.map(([x, y], i) => {
      if (i < 2) {
        // a frente: em pé (o mesmo y), só encolhe nas pontas
        const ins = (1 - k) * (i ? 150 : 110);
        return { x: x + (i ? -ins : ins), y: y1, z: z0 + H * zk * (i ? 0.93 : 1) };
      }
      const jx = (rnd() - 0.5) * 30 * (1 - k), jy = (rnd() - 0.5) * 30 * (1 - k);
      return { x: cx + (x - cx) * k + jx, y: cy + (y - cy) * k + jy, z: zk < 0 ? z0 + zk : z0 + H * zk * (1 + (rnd() - 0.5) * jz) };
    });
    const base = ring(1, -4 / H, 0).map((q) => ({ ...q, z: z0 - 4 }));
    const mid = ring(0.92, 0.55, 0.12);
    const top = ring(0.74, 0.88, 0.12);
    const crown = { x: cx + 60, y: cy - 60, z: z0 + H * 1.02 };
    return { base, mid, top, crown, zTop: Math.max(mid[0].z, top[0].z, top[1].z), ox: base[0].x };
  }
  /** O contorno da boca no paredão (pontos no mundo): do pé da esquerda, por cima do arco, até o pé da direita. */
  function caveMouth(d, z0) {
    const m = d.mouth;
    const rnd = M.rng(Math.round(m.x * 7 + d.y1 * 3) + 4127);
    const pts = [];
    const N = 16;
    for (let i = 0; i <= N; i++) {
      const ang = Math.PI * (1 - i / N);
      const s = Math.sin(ang);
      const jx = i === 0 || i === N ? 0 : (rnd() - 0.5) * 16;
      pts.push({ x: m.x + Math.cos(ang) * (m.w / 2) * (1 - 0.08 * s) + jx, y: d.y1 + 1, z: z0 + Math.pow(s, 0.65) * m.hm + (rnd() - 0.5) * 12 * s });
    }
    return pts;
  }
  /** As itacoatiaras (em cm no paredão: `u` ao longo, `v` para baixo a partir do alto `zTop`). */
  function caveGlyphs(d, g, z0) {
    const m = d.mouth;
    const Hf = g.zTop - z0;
    const left = Math.max(70, m.x - m.w / 2 - g.ox - 400), right = m.x + m.w / 2 - g.ox + 40;
    return [
      { type: 'espiral', u: left + 120, v: Hf - 190, r: 30 },
      { type: 'circulos', u: left + 270, v: Hf - 225, r: 24 },
      { type: 'sol', u: left + 220, v: Hf - 120, r: 30 },
      { type: 'cobra', u: left + 40, v: Hf - 70, r: 34 },
      { type: 'espiral', u: right + 150, v: Hf - 300, r: 20 },
    ];
  }
  function glyphPath(ctx, s, dx = 0, dy = 0) {
    ctx.beginPath();
    const u = s.u + dx, v = s.v + dy;
    if (s.type === 'espiral') {
      for (let i = 0; i <= 44; i++) {
        const t = i / 44, a = t * M.TAU * 2.6, rr = s.r * t;
        const x = u + Math.cos(a) * rr, y = v + Math.sin(a) * rr * 0.95;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
    } else if (s.type === 'circulos') {
      for (const k of [1, 0.64, 0.28]) {
        ctx.moveTo(u + s.r * k, v);
        ctx.arc(u, v, s.r * k, 0, M.TAU);
      }
    } else if (s.type === 'sol') {
      ctx.moveTo(u + s.r * 0.48, v);
      ctx.arc(u, v, s.r * 0.48, 0, M.TAU);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * M.TAU;
        ctx.moveTo(u + Math.cos(a) * s.r * 0.68, v + Math.sin(a) * s.r * 0.68);
        ctx.lineTo(u + Math.cos(a) * s.r, v + Math.sin(a) * s.r);
      }
    } else if (s.type === 'cobra') {
      for (let i = 0; i <= 9; i++) {
        const x = u + (i * s.r * 4) / 9, y = v + (i % 2 ? -1 : 1) * s.r * 0.32;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.moveTo(u + s.r * 4 + 7, v - s.r * 0.32);
      ctx.arc(u + s.r * 4, v - s.r * 0.32, 7, 0, M.TAU);
    }
  }
  /** As pinturas de ocre (em cm no paredão): gente de braços para cima, a capivara, o veado e as mãos. */
  function ochre(ctx, d, g, z0, rnd) {
    const m = d.mouth;
    const Hf = g.zTop - z0;
    const u0 = m.x + m.w / 2 - g.ox + 50;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const paint = (a) => {
      ctx.strokeStyle = `rgba(155, 61, 36, ${a})`;
      ctx.fillStyle = `rgba(155, 61, 36, ${a})`;
    };
    // gente dançando, de braços para cima
    for (const [du, dv, s] of [[20, 215, 1], [62, 208, 0.9], [100, 218, 1.05]]) {
      paint(0.62 + rnd() * 0.2);
      const u = u0 + du, v = Hf - dv;
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.arc(u, v, 5.5 * s, 0, M.TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(u, v + 6 * s);
      ctx.lineTo(u, v + 32 * s);
      ctx.moveTo(u - 15 * s, v - 4 * s);
      ctx.lineTo(u - 7 * s, v + 12 * s);
      ctx.lineTo(u + 7 * s, v + 12 * s);
      ctx.lineTo(u + 15 * s, v - 4 * s);
      ctx.moveTo(u - 10 * s, v + 50 * s);
      ctx.lineTo(u, v + 32 * s);
      ctx.lineTo(u + 10 * s, v + 50 * s);
      ctx.stroke();
    }
    // a capivara
    paint(0.7);
    {
      const u = u0 + 70, v = Hf - 120;
      ctx.beginPath();
      ctx.ellipse(u, v, 30, 14, 0, 0, M.TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(u + 31, v - 5, 12, 9, -0.2, 0, M.TAU);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (const du of [-20, -10, 12, 22]) {
        ctx.moveTo(u + du, v + 10);
        ctx.lineTo(u + du, v + 24);
      }
      ctx.stroke();
    }
    // o veado (o corpo, o pescoço, a galhada e as pernas compridas)
    paint(0.55);
    {
      const u = u0 + 200, v = Hf - 235;
      ctx.beginPath();
      ctx.ellipse(u, v, 24, 9, 0, 0, M.TAU);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(u + 18, v - 4);
      ctx.lineTo(u + 30, v - 24);
      for (const du of [-16, -8, 10, 17]) {
        ctx.moveTo(u + du, v + 6);
        ctx.lineTo(u + du + 2, v + 34);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(u + 33, v - 27, 7, 4.5, -0.4, 0, M.TAU);
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(u + 31, v - 31);
      ctx.lineTo(u + 26, v - 48);
      ctx.lineTo(u + 20, v - 54);
      ctx.moveTo(u + 27, v - 44);
      ctx.lineTo(u + 33, v - 52);
      ctx.moveTo(u + 35, v - 31);
      ctx.lineTo(u + 41, v - 46);
      ctx.stroke();
    }
    // as mãos carimbadas
    for (const [du, dv, a] of [[150, 150, 0.7], [178, 128, 0.5], [205, 160, 0.65]]) {
      paint(a);
      const u = u0 + du, v = Hf - dv;
      ctx.beginPath();
      ctx.ellipse(u, v, 7, 8, 0, 0, M.TAU);
      ctx.fill();
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      for (const [fa, fl] of [[-1.15, 9], [-0.4, 13], [0, 14], [0.4, 12], [1.1, 9]]) {
        const ang = -Math.PI / 2 + fa;
        ctx.moveTo(u + Math.cos(ang) * 6, v + Math.sin(ang) * 6);
        ctx.lineTo(u + Math.cos(ang) * (6 + fl), v + Math.sin(ang) * (6 + fl));
      }
      ctx.stroke();
    }
  }
  function cavePaint(ctx, cam, d, z0, ink) {
    const g = caveGeom(d, z0);
    const rnd = seeded(d.x0, d.y0, 4101);
    const P = (q) => cam.p(q);
    const W = d.x1 - d.x0, D = d.y1 - d.y0;
    // 1) o morro: as faces que a câmera vê (o capim e a mata de cima vêm depois)
    ringRock(ctx, cam, { x: d.x0 + W / 2, y: d.y0 + D / 2, z0, h: d.h, rx: W / 2, ry: D / 2, seed: Math.round(d.x0 + d.y0 * 3), colors: CAVE_ROCK, strata: true }, ink, [g.base, g.mid, g.top], g.crown);
    // 2) o paredão da frente: as camadas da pedra, as trincas, a água escorrida, o musgo e as inscrições
    const F = [g.base[0], g.base[1], g.top[1], g.top[0]];
    const front = [g.base[0], g.base[1], g.mid[1], g.top[1], g.top[0], g.mid[0]];
    const Hf = g.zTop - z0;
    // (a beirada de cima do paredão: a do alto, entre as duas pontas)
    const vTopAt = (u) => g.zTop - (g.top[0].z + (g.top[1].z - g.top[0].z) * M.clamp01((u - (g.top[0].x - g.ox)) / (g.top[1].x - g.top[0].x)));
    ctx.save();
    ctx.clip(pathOf(front.map(P)));
    onFace(ctx, cam, F[0], F[1], g.zTop, (L) => {
      ctx.lineCap = 'round';
      // (as camadas da pedra vêm do ringRock, em todas as faces; aqui, as trincas)
      ctx.strokeStyle = 'rgba(28, 22, 18, 0.5)';
      ctx.lineWidth = 2.2;
      for (let k = 0; k < 7; k++) {
        let u = rnd() * L, v = vTopAt(u) + rnd() * 60;
        ctx.beginPath();
        ctx.moveTo(u, v);
        for (let j = 0; j < 5; j++) {
          u += (rnd() - 0.5) * 26;
          v += 18 + rnd() * 26;
          ctx.lineTo(u, v);
        }
        ctx.stroke();
      }
      for (let k = 0; k < 12; k++) {
        const u = rnd() * L, v0 = vTopAt(u), l = 40 + rnd() * 120, w = 6 + rnd() * 16;
        const gr = ctx.createLinearGradient(0, v0, 0, v0 + l);
        gr.addColorStop(0, 'rgba(32, 38, 30, 0.38)');
        gr.addColorStop(1, 'rgba(32, 38, 30, 0)');
        ctx.fillStyle = gr;
        ctx.fillRect(u, v0, w, l);
      }
      // o musgo e o capim da beirada de cima, escorrendo
      for (let u = 0; u < L; u += 22) {
        const v0 = vTopAt(u);
        for (let l = 0; l < 3; l++) {
          ctx.fillStyle = MOSS[l];
          ctx.beginPath();
          ctx.ellipse(u + (rnd() - 0.5) * 16, v0 + 6 + rnd() * (l ? 18 : 34), 12 + rnd() * 10, 6 + rnd() * 7, 0, 0, M.TAU);
          ctx.fill();
        }
      }
      // o pé: o limo e a terra respingada
      const ft = ctx.createLinearGradient(0, Hf - 50, 0, Hf);
      ft.addColorStop(0, 'rgba(40, 52, 30, 0)');
      ft.addColorStop(1, 'rgba(40, 52, 30, 0.55)');
      ctx.fillStyle = ft;
      ctx.fillRect(0, Hf - 50, L, 50);
      // as itacoatiaras gravadas (o sulco escuro e a beirada clara) e as pinturas de ocre
      if (d.glyphs) {
        for (const s of caveGlyphs(d, g, z0)) {
          glyphPath(ctx, s);
          ctx.strokeStyle = 'rgba(30, 24, 20, 0.72)';
          ctx.lineWidth = 4.6;
          ctx.stroke();
          glyphPath(ctx, s, 1.4, 1.8);
          ctx.strokeStyle = 'rgba(255, 244, 222, 0.32)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      if (d.paint) ochre(ctx, d, g, z0, rnd);
    });
    ctx.restore();
    // 3) a boca: o escuro de verdade; por dentro da beirada, a pedra ainda pega um pouco de luz (a parede do oeste mais,
    // ela vira para a câmera) e embaixo o chão some no escuro
    const mouth = caveMouth(d, z0);
    const mpts = mouth.map(P);
    const mp = pathOf(mpts);
    const m = d.mouth;
    ctx.save();
    ctx.clip(mp);
    const xs = mpts.map((q) => q.x), ys = mpts.map((q) => q.y);
    const bx0 = Math.min(...xs), by0 = Math.min(...ys), bw = Math.max(...xs) - bx0, bh = Math.max(...ys) - by0;
    ctx.fillStyle = '#060807';
    ctx.fillRect(bx0 - 2, by0 - 2, bw + 4, bh + 4);
    ctx.lineJoin = 'round';
    for (const [w, a] of [[26, 0.22], [14, 0.3], [6, 0.38]]) {
      ctx.strokeStyle = `rgba(92, 80, 64, ${a})`;
      ctx.lineWidth = w * cam.zoom;
      ctx.stroke(mp);
    }
    const lw = P({ x: m.x - m.w / 2, y: d.y1, z: z0 + m.hm * 0.45 });
    const wg = ctx.createRadialGradient(lw.x, lw.y, 0, lw.x, lw.y, m.w * 0.4 * cam.zoom);
    wg.addColorStop(0, 'rgba(110, 96, 76, 0.55)');
    wg.addColorStop(1, 'rgba(110, 96, 76, 0)');
    ctx.fillStyle = wg;
    ctx.fillRect(bx0 - 2, by0 - 2, bw + 4, bh + 4);
    const fb = P({ x: m.x, y: d.y1, z: z0 });
    const flg = ctx.createRadialGradient(fb.x, fb.y, 0, fb.x, fb.y, m.w * 0.5 * cam.zoom);
    flg.addColorStop(0, 'rgba(70, 58, 44, 0.75)');
    flg.addColorStop(1, 'rgba(70, 58, 44, 0)');
    ctx.fillStyle = flg;
    ctx.fillRect(bx0 - 2, by0 - 2, bw + 4, bh + 4);
    ctx.restore();
    ctx.strokeStyle = 'rgba(214, 202, 178, 0.45)';
    ctx.lineWidth = Math.max(1, 3.4 * cam.zoom);
    ctx.stroke(mp);
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 1.8;
    ctx.stroke(mp);
    // 4) as estalactites no alto da boca e as raízes da mata de cima descendo por ela
    onFace(ctx, cam, F[0], F[1], g.zTop, () => {
      for (let i = 4; i <= 12; i += 1 + Math.floor(rnd() * 2)) {
        const q = mouth[i];
        const u = q.x - g.ox, v = g.zTop - q.z;
        const w = 10 + rnd() * 9, l = 16 + rnd() * 28;
        ctx.beginPath();
        ctx.moveTo(u - w / 2, v - 2);
        ctx.lineTo(u + w / 2, v - 2);
        ctx.lineTo(u + (rnd() - 0.5) * 4, v + l);
        ctx.closePath();
        ctx.fillStyle = '#5e564b';
        ctx.fill();
        ctx.strokeStyle = 'rgba(20, 16, 12, 0.7)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(230, 220, 196, 0.35)';
        ctx.beginPath();
        ctx.moveTo(u - w / 2 + 1.5, v);
        ctx.lineTo(u, v + l * 0.85);
        ctx.stroke();
      }
      if (!d.roots) return;
      const roots = [];
      for (let k = 0; k < 7; k++) {
        const u0 = m.x - g.ox - m.w * 0.46 + (k / 6) * m.w * 0.92 + (rnd() - 0.5) * 24;
        const v0 = vTopAt(u0);
        const len = Hf - m.hm - (v0 - 0) + 20 + rnd() * 100;
        const pts = [];
        for (let j = 0; j <= 9; j++) pts.push([u0 + Math.sin(j * 1.3 + k) * 7 + (rnd() - 0.5) * 4, v0 + (j / 9) * len]);
        roots.push(pts);
      }
      ctx.lineCap = 'round';
      for (const [col, extra] of [['#2e2118', 2.6], ['#6b4d35', 0]]) {
        ctx.strokeStyle = col;
        for (const pts of roots) {
          for (let j = 0; j < pts.length - 1; j++) {
            ctx.lineWidth = Math.max(1.2, 7.5 * Math.pow(0.82, j)) + extra;
            ctx.beginPath();
            ctx.moveTo(pts[j][0], pts[j][1]);
            ctx.lineTo(pts[j + 1][0], pts[j + 1][1]);
            ctx.stroke();
          }
        }
      }
    });
    // o cipó descendo pelo paredão, dos dois lados da boca
    for (const u of [0.12, 0.3, 0.78, 0.9]) {
      const x = F[0].x + (F[1].x - F[0].x) * u;
      const zt = g.top[0].z + (g.top[1].z - g.top[0].z) * u;
      const len = 120 + rnd() * 180;
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push({ x: x + Math.sin(i * 1.1) * 10, y: d.y1 + 3, z: zt - (i / 8) * len });
      vine3d(ctx, cam, pts, rnd, ink);
    }
    for (const i of [2, 3, 4]) {
      const a = g.top[i], b = g.base[i];
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const t = (k / 8) * (0.55 + rnd() * 0.3);
        pts.push({ x: a.x + (b.x - a.x) * t + Math.sin(k * 1.3) * 8, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
      }
      vine3d(ctx, cam, pts, rnd, ink);
    }
    // 5) a mata em cima: o capim e o musgo, o capim pendurado na beirada, as samambaias e a arvorezinha
    ctx.save();
    ctx.clip(pathOf(g.top.map(P)));
    for (let k = 0; k < 16; k++) {
      const cx = d.x0 + 140 + rnd() * (W - 320), cy = d.y0 + 140 + rnd() * (D - 160);
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = k % 5 === 4 && l === 0 ? 'rgba(92, 78, 58, 0.5)' : MOSS[l + (l === 2 ? 1 : 0)];
        for (let e = 0; e < 6 - l; e++) {
          const q = P({ x: cx + (rnd() - 0.5) * 110, y: cy + (rnd() - 0.5) * 70, z: z0 + d.h * 0.93 + l * 3 });
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, (10 + rnd() * 16) * cam.zoom * (1 - l * 0.2), (6 + rnd() * 8) * cam.zoom * (1 - l * 0.2), 0, 0, M.TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
    for (let k = 0; k < 10; k++) {
      const t = rnd();
      grass(ctx, cam, g.top[0].x + (g.top[1].x - g.top[0].x) * t, d.y1 - 10, g.top[0].z + (g.top[1].z - g.top[0].z) * t, 24 + rnd() * 16, rnd, ink);
    }
    // as pedras em cima do morro (do fundo para a frente) e o mato entre elas
    const tops = [[0.3, 0.3, 120, 90, 110], [0.72, 0.28, 140, 100, 90], [0.55, 0.5, 90, 70, 70], [0.12, 0.5, 80, 70, 60]].map(([u, v, rx, ry, h], i) => ({ x: d.x0 + W * u, y: d.y0 + D * v, z0: z0 + d.h * 0.9, rx, ry, h, seed: Math.round(d.x0 + i * 131), moss: true, colors: CAVE_ROCK }));
    tops.sort((a, b) => cam.depth({ x: a.x, y: a.y, z: 0 }) - cam.depth({ x: b.x, y: b.y, z: 0 }));
    for (const t of tops) facetRock(ctx, cam, t, ink);
    const fern = PD.flora && PD.flora.small && PD.flora.small['planta-samambaia'];
    if (fern) for (const [u, v] of [[0.18, 0.62], [0.86, 0.5], [0.45, 0.8], [0.66, 0.66]]) fern.paint(ctx, cam, { kind: 'planta-samambaia', x: d.x0 + W * u, y: d.y0 + D * v, r: 75 }, z0 + d.h * 0.9, ink);
    for (let k = 0; k < 8; k++) grass(ctx, cam, d.x0 + W * (0.15 + rnd() * 0.7), d.y0 + D * (0.3 + rnd() * 0.55), z0 + d.h * 0.9, 26 + rnd() * 14, rnd, ink);
    if (d.tree) H.roofTree(ctx, cam, d.x0 + W * 0.42, d.y0 + D * 0.3, z0 + d.h * 0.95, ink);
  }
  /** O que mexe: a luz respirando lá no fundo, as faíscas subindo e as itacoatiaras brilhando (de noite, mais). */
  function caveOverlay(ctx, cam, d, z0, time) {
    const day = PD.view && PD.view.daylight != null ? PD.view.daylight : 1;
    const night = 1 - day;
    const g = caveGeom(d, z0);
    const P = (q) => cam.p(q);
    const m = d.mouth;
    const A = ctx.globalAlpha;
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.1);
    ctx.save();
    ctx.clip(pathOf(caveMouth(d, z0).map(P)));
    ctx.globalCompositeOperation = 'lighter';
    const c = P({ x: m.x + 20, y: d.y1 - 260, z: z0 + 50 });
    const R = m.w * 0.42 * cam.zoom;
    ctx.globalAlpha = A * (0.22 + 0.18 * pulse) * (0.55 + 0.75 * night);
    ctx.drawImage(glowSprite(d.glow), c.x - R, c.y - R * 0.75, R * 2, R * 1.5);
    const rr = M.rng(4133);
    ctx.fillStyle = d.glow;
    for (let k = 0; k < 12; k++) {
      const ph = (time * (0.1 + rr() * 0.1) + rr()) % 1;
      const q = P({ x: m.x + (rr() - 0.5) * m.w * 0.7, y: d.y1 - 60 - rr() * 180, z: z0 + 15 + ph * m.hm * 0.9 });
      ctx.globalAlpha = A * Math.sin(ph * Math.PI) * (0.55 + 0.45 * night);
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(0.8, 1.7 * cam.zoom), 0, M.TAU);
      ctx.fill();
    }
    ctx.restore();
    if (d.glyphs) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = d.glow;
      onFace(ctx, cam, g.base[0], g.base[1], g.zTop, () => {
        caveGlyphs(d, g, z0).forEach((s, i) => {
          const a = (0.1 + 0.2 * (0.5 + 0.5 * Math.sin(time * 0.9 + i * 1.7))) * (0.45 + 0.9 * night);
          glyphPath(ctx, s);
          ctx.globalAlpha = A * a * 0.45;
          ctx.lineWidth = 11;
          ctx.stroke();
          ctx.globalAlpha = A * a;
          ctx.lineWidth = 3.4;
          ctx.stroke();
        });
      });
      ctx.restore();
    }
    ctx.globalAlpha = A;
  }
  small.caverna = {
    // (as itacoatiaras, para o escuro da noite: cada uma abre um buraquinho verde-água — flora.js, glows)
    glowPoints(d) {
      const g = caveGeom(d, 0);
      return caveGlyphs(d, g, 0).map((s) => ({ x: g.ox + s.u, y: d.y1 + 6, z: g.zTop - s.v, r: 60 + s.r, color: d.glow, k: 0.45 }));
    },
    fades: true,
    height: (d) => d.h + 380,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0 + 60, d.x1 - 60, d.y0 + 60, d.y1, d.h * 0.8),
    box: (cam, d, z0) => volBox(cam, d.x0 - 80, d.x1 + 80, d.y0 - 80, d.y1 + 60, z0 - 10, z0 + d.h + 440, 24),
    paint: cavePaint,
    overlay: caveOverlay,
  };
  /** A pedra solta da caverna (a da cachoeira, com o tom quente do morro): `r`, `h`, `moss`. */
  small.rocha = {
    fades: true,
    height: (d) => d.h,
    blocks: 0,
    shadow: (p, cam, d) => H.circleShadow(p, cam, d.x, d.y, d.r * 0.9, d.h * 0.5),
    box: (cam, d, z0) => volBox(cam, d.x - d.r * 1.15, d.x + d.r * 1.15, d.y - d.r * 1.15, d.y + d.r * 1.15, z0 - 8, z0 + d.h + 14, 16),
    paint(ctx, cam, d, z0, ink) {
      facetRock(ctx, cam, { x: d.x, y: d.y, z0, rx: d.r, ry: d.r * 0.86, h: d.h, seed: Math.round(d.x * 3 + d.y * 7), moss: d.moss, colors: d.dark ? DARK_ROCK : CAVE_ROCK }, ink);
    },
  };
  /** A oferenda: a pedra chata com as velas acesas, a cuia com frutas, a cabaça e as flores. */
  function offerLayout(d, z0) {
    const rnd = seeded(d.x, d.y, 4201);
    const zt = z0 + 13;
    const candles = [];
    const n = d.candles || 4;
    const COLORS = ['#f3efe2', '#e8d36a', '#f3efe2', '#d4513a', '#f3efe2'];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * M.TAU + rnd() * 0.6;
      const rr = 12 + rnd() * 12;
      candles.push({ x: d.x + Math.cos(a) * rr, y: d.y + 6 + Math.sin(a) * rr * 0.6, z: zt, h: 8 + rnd() * 10, color: COLORS[k % COLORS.length] });
    }
    return { zt, candles, rnd };
  }
  small.oferenda = {
    fades: false,
    height: () => 50,
    blocks: 0,
    shadow: (p, cam, d) => H.circleShadow(p, cam, d.x, d.y, 34, 12),
    box: (cam, d, z0) => volBox(cam, d.x - 60, d.x + 60, d.y - 50, d.y + 50, z0 - 6, z0 + 60, 16),
    paint(ctx, cam, d, z0, ink) {
      const L = offerLayout(d, z0);
      const rnd = L.rnd;
      const zm = cam.zoom;
      facetRock(ctx, cam, { x: d.x, y: d.y, z0, rx: 44, ry: 32, h: 13, seed: Math.round(d.x + d.y), flat: true, colors: CAVE_ROCK }, ink);
      // a cuia com as frutas (atrás, à esquerda) e a cabaça (atrás, à direita)
      const cu = cam.p({ x: d.x - 20, y: d.y - 12, z: L.zt });
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(cu.x, cu.y, 12 * zm + ink, 6 * zm + ink, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#7a4e2c';
      ctx.beginPath();
      ctx.ellipse(cu.x, cu.y, 12 * zm, 6 * zm, 0, 0, Math.PI);
      ctx.fill();
      for (const [dx, col] of [[-5, '#d4513a'], [3, '#f2b632'], [-1, '#e2762e'], [6, '#7aa03a']]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cu.x + dx * zm, cu.y - (2 + rnd() * 3) * zm, 4 * zm, 0, M.TAU);
        ctx.fill();
      }
      const cb = cam.p({ x: d.x + 24, y: d.y - 8, z: L.zt });
      for (const [dy, rx, ry] of [[-9, 6.5, 6], [-20, 4.2, 4.2]]) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(cb.x, cb.y + dy * zm, rx * zm + ink, ry * zm + ink, 0, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#c89a4a';
        ctx.beginPath();
        ctx.ellipse(cb.x, cb.y + dy * zm, rx * zm, ry * zm, 0, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 244, 214, 0.45)';
        ctx.beginPath();
        ctx.ellipse(cb.x - rx * 0.35 * zm, cb.y + (dy - ry * 0.3) * zm, rx * 0.3 * zm, ry * 0.3 * zm, 0, 0, M.TAU);
        ctx.fill();
      }
      // as flores na beira da frente
      for (let k = 0; k < 7; k++) {
        const a = (rnd() - 0.5) * 2.4 + Math.PI / 2;
        const q = cam.p({ x: d.x + Math.cos(a) * 34, y: d.y + Math.sin(a) * 26, z: L.zt - 2 });
        const col = ['#f4f1e6', '#f2c230', '#d84a6a'][k % 3];
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * M.TAU;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(q.x + Math.cos(pa) * 2.6 * zm, q.y + Math.sin(pa) * 1.6 * zm, 1.9 * zm, 0, M.TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#c98a2a';
        ctx.beginPath();
        ctx.arc(q.x, q.y, 1.3 * zm, 0, M.TAU);
        ctx.fill();
      }
      // as velas: o corpo (com a luz de um lado), a cera escorrida e o pavio
      const cs = L.candles.slice().sort((a, b) => cam.depth(a) - cam.depth(b));
      for (const c of cs) {
        const b = cam.p(c), t = cam.p({ x: c.x, y: c.y, z: c.z + c.h });
        const w = 2.6 * zm;
        ctx.fillStyle = INK;
        ctx.fillRect(b.x - w - ink * 0.6, t.y - ink * 0.6, 2 * w + ink * 1.2, b.y - t.y + ink * 1.2);
        ctx.fillStyle = c.color;
        ctx.fillRect(b.x - w, t.y, 2 * w, b.y - t.y);
        ctx.fillStyle = 'rgba(40, 30, 20, 0.22)';
        ctx.fillRect(b.x + w * 0.2, t.y, w * 0.8, b.y - t.y);
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, w * 2.2, w * 1.1, 0, 0, M.TAU);
        ctx.fill();
        ctx.strokeStyle = '#2a2018';
        ctx.lineWidth = Math.max(0.8, 0.9 * zm);
        line2(ctx, t, { x: t.x, y: t.y - 2.4 * zm });
      }
    },
    overlay(ctx, cam, d, z0, time) {
      const L = offerLayout(d, z0);
      const A = ctx.globalAlpha;
      const zm = cam.zoom;
      ctx.save();
      L.candles.forEach((c, i) => {
        const tip = cam.p({ x: c.x, y: c.y, z: c.z + c.h + 2.4 });
        const f = 0.82 + 0.18 * Math.sin(time * 11 + i * 2.1) * Math.sin(time * 5.3 + i);
        const sway = Math.sin(time * 3.1 + i * 1.7) * 0.8 * zm;
        ctx.globalCompositeOperation = 'lighter';
        const R = 15 * zm;
        ctx.globalAlpha = A * 0.42 * f;
        ctx.drawImage(glowSprite('#ffb347'), tip.x - R, tip.y - R * 1.3, R * 2, R * 2);
        ctx.globalCompositeOperation = 'source-over';
        const hgt = (7 + 2.5 * f) * zm, w = 2.1 * zm;
        for (const [col, k] of [['#ff9a2e', 1], ['#fff1b8', 0.55]]) {
          ctx.globalAlpha = A;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(tip.x + sway, tip.y - hgt * k);
          ctx.quadraticCurveTo(tip.x + w * 1.7 * k, tip.y - hgt * 0.3 * k, tip.x, tip.y);
          ctx.quadraticCurveTo(tip.x - w * 1.7 * k, tip.y - hgt * 0.3 * k, tip.x + sway, tip.y - hgt * k);
          ctx.fill();
        }
      });
      ctx.restore();
      ctx.globalAlpha = A;
    },
  };
  /**
   * A fogueira apagada da caverna (`brasas`): a roda de pedras, a cinza, os tições cruzados e umas brasas ainda vivas,
   * com o fiozinho de fumaça subindo no vento (`overlay`). Alguém esteve aqui há pouco. (Não é a `fogueira` acesa: essa
   * marca as zonas seguras.)
   */
  function pitLayout(d, z0) {
    const rnd = seeded(d.x, d.y, 4401);
    const stones = [];
    const n = 10;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * M.TAU + rnd() * 0.3;
      stones.push({ x: d.x + Math.cos(a) * d.r, y: d.y + Math.sin(a) * d.r * 0.92, z0, rx: 13 + rnd() * 6, ry: 11 + rnd() * 4, h: 11 + rnd() * 7, seed: Math.round(d.x + k * 97), colors: CAVE_ROCK });
    }
    const embers = [];
    for (let k = 0; k < 9; k++) embers.push({ x: d.x + (rnd() - 0.5) * d.r * 0.9, y: d.y + (rnd() - 0.5) * d.r * 0.7, ph: rnd() * M.TAU });
    return { stones, embers, rnd };
  }
  small.brasas = {
    fades: false,
    height: () => 40,
    blocks: 0,
    shadow: (p, cam, d) => H.circleShadow(p, cam, d.x, d.y, d.r * 0.8, 8),
    box: (cam, d, z0) => volBox(cam, d.x - d.r - 40, d.x + d.r + 60, d.y - d.r - 60, d.y + d.r + 40, z0 - 6, z0 + 230, 16),
    paint(ctx, cam, d, z0, ink) {
      const L = pitLayout(d, z0);
      const rnd = L.rnd;
      const P = (x, y, z = z0) => cam.p({ x, y, z });
      const ring = (r, k) => {
        const pts = [];
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * M.TAU;
          pts.push(P(d.x + Math.cos(a) * r * (1 + (rnd() - 0.5) * 0.12), d.y + Math.sin(a) * r * k));
        }
        return pathOf(pts);
      };
      const c = cam.depth({ x: d.x, y: d.y, z: z0 });
      const back = L.stones.filter((s) => cam.depth({ x: s.x, y: s.y, z: z0 }) < c), front = L.stones.filter((s) => cam.depth({ x: s.x, y: s.y, z: z0 }) >= c);
      for (const s of back) facetRock(ctx, cam, s, ink);
      // a cinza e o chão queimado
      ctx.fillStyle = 'rgba(34, 28, 24, 0.75)';
      ctx.fill(ring(d.r * 0.95, 0.9));
      ctx.fillStyle = '#77736d';
      ctx.fill(ring(d.r * 0.7, 0.85));
      for (let k = 0; k < 14; k++) {
        const q = P(d.x + (rnd() - 0.5) * d.r * 1.1, d.y + (rnd() - 0.5) * d.r * 0.9);
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(200, 196, 188, 0.6)' : 'rgba(40, 34, 30, 0.6)';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, (3 + rnd() * 6) * cam.zoom, (2 + rnd() * 3) * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
      // os tições cruzados (pretos, com a ponta de cinza)
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * M.TAU + 0.4;
        const out = { x: d.x + Math.cos(a) * d.r * 0.9, y: d.y + Math.sin(a) * d.r * 0.8, z: z0 + 4 };
        const inn = { x: d.x + Math.cos(a) * d.r * 0.12, y: d.y + Math.sin(a) * d.r * 0.1, z: z0 + 10 };
        pipe(ctx, cam, [out, inn], 4.2, ink, '#2c231d');
        const tip = cam.p(inn);
        ctx.fillStyle = 'rgba(190, 186, 178, 0.8)';
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 3.2 * cam.zoom, 0, M.TAU);
        ctx.fill();
      }
      for (const s of front) facetRock(ctx, cam, s, ink);
    },
    overlay(ctx, cam, d, z0, time) {
      const L = pitLayout(d, z0);
      const A = ctx.globalAlpha;
      ctx.save();
      // as brasas respirando
      ctx.globalCompositeOperation = 'lighter';
      for (const e of L.embers) {
        const q = cam.p({ x: e.x, y: e.y, z: z0 + 6 });
        const k = 0.35 + 0.35 * Math.sin(time * 1.6 + e.ph) * Math.sin(time * 0.7 + e.ph * 2);
        ctx.globalAlpha = A * Math.max(0.05, k);
        ctx.fillStyle = '#ff7a2a';
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(0.8, 2.2 * cam.zoom), 0, M.TAU);
        ctx.fill();
      }
      // o fiozinho de fumaça subindo e indo com o vento
      ctx.globalCompositeOperation = 'source-over';
      const world = PD.view && PD.view.world;
      const wind = (world && world.wind) || { strength: 0.35, angle: -Math.PI / 4 };
      const wx = Math.cos(wind.angle), wy = Math.sin(wind.angle);
      for (let k = 0; k < 6; k++) {
        const ph = (time * 0.16 + k / 6) % 1;
        const drift = ph * ph * (40 + wind.strength * 90);
        const q = cam.p({ x: d.x + wx * drift + Math.sin(time + k) * 4, y: d.y + wy * drift, z: z0 + 14 + ph * 190 });
        const r = (6 + ph * 26) * cam.zoom;
        ctx.globalAlpha = A * 0.26 * (1 - ph) * Math.min(1, ph * 6);
        ctx.fillStyle = '#c9c8c4';
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = A;
    },
  };
  /** O esteio: o tronco fino fincado, a cabaça pendurada, as penas e as fitas coloridas no vento (`overlay`). */
  const RIBBONS = ['#d23b2f', '#f2c230', '#2f8f4e', '#2f6fb3', '#f4f1e6'];
  small.esteio = {
    fades: true,
    height: (d) => d.h + 20,
    blocks: 0,
    shadow: (p, cam, d) => H.lineShadow(p, cam, d.x, d.y, d.h, 7),
    box: (cam, d, z0) => volBox(cam, d.x - 110, d.x + 110, d.y - 110, d.y + 110, z0 - 6, z0 + d.h + 30, 16),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x, d.y, 4301);
      const zm = cam.zoom;
      const b = cam.p({ x: d.x, y: d.y, z: z0 }), t = cam.p({ x: d.x + 4, y: d.y, z: z0 + d.h });
      const w0 = 7 * zm, w1 = 4.5 * zm;
      const pole = [{ x: b.x - w0, y: b.y }, { x: t.x - w1, y: t.y }, { x: t.x + w1, y: t.y }, { x: b.x + w0, y: b.y }];
      poly(ctx, pole, '#6b4a32', INK, ink * 2);
      ctx.fillStyle = 'rgba(255, 236, 200, 0.22)';
      poly(ctx, [pole[0], pole[1], { x: t.x - w1 * 0.2, y: t.y }, { x: b.x - w0 * 0.2, y: b.y }], 'rgba(255, 236, 200, 0.2)');
      ctx.strokeStyle = 'rgba(30, 20, 14, 0.5)';
      ctx.lineWidth = Math.max(0.8, 1.1 * zm);
      for (let k = 0; k < 6; k++) {
        const y = b.y + (t.y - b.y) * (0.1 + rnd() * 0.8);
        line2(ctx, { x: b.x - w0 * 0.6, y }, { x: b.x + w0 * 0.4, y: y + 2 * zm });
      }
      // a amarração de corda no alto
      const tie = cam.p({ x: d.x + 4, y: d.y, z: z0 + d.h - 14 });
      ctx.strokeStyle = '#c9b07a';
      ctx.lineWidth = Math.max(1, 1.8 * zm);
      for (let k = 0; k < 3; k++) line2(ctx, { x: tie.x - w1 * 1.2, y: tie.y + k * 2.4 * zm }, { x: tie.x + w1 * 1.2, y: tie.y + k * 2.4 * zm - 1.5 * zm });
      // a cabaça pendurada numa cordinha e as penas
      const hang = cam.p({ x: d.x + 14, y: d.y + 6, z: z0 + d.h - 26 });
      const gourd = cam.p({ x: d.x + 14, y: d.y + 6, z: z0 + d.h - 52 });
      ctx.strokeStyle = '#3a2a1c';
      ctx.lineWidth = Math.max(0.8, 0.9 * zm);
      line2(ctx, cam.p({ x: d.x + 4, y: d.y, z: z0 + d.h - 18 }), hang);
      line2(ctx, hang, gourd);
      for (const [dy, rx, ry] of [[8, 6, 5.5], [-1, 3.8, 3.8]]) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(gourd.x, gourd.y + dy * zm, rx * zm + ink, ry * zm + ink, 0, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#b98a3e';
        ctx.beginPath();
        ctx.ellipse(gourd.x, gourd.y + dy * zm, rx * zm, ry * zm, 0, 0, M.TAU);
        ctx.fill();
      }
      for (const [dx, col] of [[-6, '#f4f1e6'], [-2, '#c0392b'], [3, '#1f1a18']]) {
        const a = cam.p({ x: d.x + dx, y: d.y + 4, z: z0 + d.h - 20 });
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1.4, 3 * zm);
        ctx.lineCap = 'round';
        line2(ctx, a, { x: a.x + dx * 0.3 * zm, y: a.y + 16 * zm });
      }
    },
    overlay(ctx, cam, d, z0, time) {
      if (!d.ribbons) return;
      const world = PD.view && PD.view.world;
      const wind = (world && world.wind) || { strength: 0.35, angle: -Math.PI / 4 };
      const wx = Math.cos(wind.angle), wy = Math.sin(wind.angle);
      const top = { x: d.x + 4, y: d.y, z: z0 + d.h - 10 };
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      RIBBONS.forEach((col, i) => {
        const len = 46 + i * 8;
        const pts = [];
        for (let j = 0; j <= 8; j++) {
          const t = j / 8;
          const wave = Math.sin(time * (4 + i * 0.45) - t * 5 + i * 1.3) * 9 * t;
          const blow = (10 + wind.strength * 34) * t * (len / 60);
          pts.push(cam.p({ x: top.x + wx * blow - wy * wave, y: top.y + wy * blow + wx * wave, z: top.z - t * len * (0.9 - wind.strength * 0.35) + Math.sin(time * 3 + t * 4 + i) * 3 * t }));
        }
        for (const [c, w] of [['rgba(28, 20, 16, 0.55)', 4.4], [col, 3]]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = Math.max(1, w * cam.zoom);
          ctx.beginPath();
          pts.forEach((q, j) => (j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
          ctx.stroke();
        }
      });
    },
  };

  // ------------------------------------------------------------------ a Ilha do Véu (Guarapiranga)
  // (24/11, o dono: "pode retomar o Guarapiranga") A roda de pedras em pé (`menir`) e o Véu da ilha (`cortina-veu`, a
  // cortina de raízes que descem da Árvore do Véu e brilham). A árvore é a figueira de sempre, maior; a oferenda, os
  // esteios, as brasas e as pedras da beira são os da caverna.
  const VEIL_GLOW = '#3fd6c8';
  const MENHIR_ROCK = { dark: [54, 57, 58], light: [178, 180, 172] };
  /**
   * A laje em pé: a face larga virada para `face` (graus; na roda, para o meio), meia largura `r`, altura `h` (cm), um
   * pouco torta para o lado e com o alto arredondado. Devolve as voltas (do pé para o alto), a coroa e o lugar da gravura.
   */
  function menhirGeom(d, z0) {
    const rnd = seeded(d.x, d.y, 4411);
    const a = (d.face * Math.PI) / 180;
    const n = { x: Math.cos(a), y: Math.sin(a) }; // para onde olha a face larga
    const t = { x: -n.y, y: n.x }; // ao longo dela
    const half = d.r, thick = d.r * 0.44;
    const lean = (rnd() - 0.5) * 0.12;
    const N = 10;
    const jit = [];
    for (let k = 0; k < N; k++) jit.push([(rnd() - 0.5) * 0.25, 0.9 + rnd() * 0.16]);
    const RINGS = [[-4, 1], [0.4, 0.97], [0.78, 0.84], [0.95, 0.5]];
    const at = (u, v, z) => {
      const s = lean * (z - z0);
      return { x: d.x + t.x * (u + s) + n.x * v, y: d.y + t.y * (u + s) + n.y * v, z };
    };
    const rings = RINGS.map(([zk, rk]) => jit.map(([da, f], k) => {
      const ang = (k / N) * M.TAU + da;
      const z = zk < 0 ? z0 + zk : z0 + d.h * zk;
      return at(Math.cos(ang) * half * rk * f, Math.sin(ang) * thick * rk * f, z);
    }));
    const crown = at((rnd() - 0.5) * half * 0.2, 0, z0 + d.h);
    // a gravura: no meio da face larga, um pouco acima do meio da altura (só a face que a câmera vê tem a dela à vista)
    const zg = z0 + d.h * 0.52;
    return { n, half, thick, rings, crown, at, zg, gs: Math.min(half * 0.5, 30), shown: n.x + n.y > 0.15 };
  }
  /** Desenha na face larga, com a gravura no meio (`fn` recebe a forma dela, em cm na face). */
  function menhirGlyph(ctx, cam, d, geo, fn) {
    const zTop = geo.zg + geo.gs * 1.6;
    const A = geo.at(-geo.half * 0.8, geo.thick * 0.97, zTop), B = geo.at(geo.half * 0.8, geo.thick * 0.97, zTop);
    const type = d.glyph || 'espiral';
    // (a cobra é comprida: menor, e começa antes do meio)
    const r = type === 'cobra' ? geo.gs * 0.55 : geo.gs;
    onFace(ctx, cam, A, B, zTop, (L) => fn({ type, u: type === 'cobra' ? L / 2 - r * 2 : L / 2, v: geo.gs * 1.6, r }));
  }
  small.menir = {
    fades: true,
    height: (d) => d.h,
    blocks: 0,
    shadow: (p, cam, d) => H.circleShadow(p, cam, d.x, d.y, d.r * 0.8, d.h * 0.55),
    box: (cam, d, z0) => volBox(cam, d.x - d.r * 1.4, d.x + d.r * 1.4, d.y - d.r * 1.4, d.y + d.r * 1.4, z0 - 8, z0 + d.h + 16, 16),
    // (de noite, a gravura acende um buraquinho verde-água no escuro — flora.js, glows)
    glowPoints(d) {
      const geo = menhirGeom(d, 0);
      if (!geo.shown) return [];
      const c = geo.at(0, geo.thick + 20, geo.zg);
      return [{ x: c.x, y: c.y, z: geo.zg, r: 80, color: VEIL_GLOW, k: 0.4 }];
    },
    paint(ctx, cam, d, z0, ink) {
      const geo = menhirGeom(d, z0);
      ringRock(ctx, cam, { x: d.x, y: d.y, z0, h: d.h, rx: d.r, ry: geo.thick, seed: Math.round(d.x * 5 + d.y * 11), moss: true, colors: MENHIR_ROCK }, ink, geo.rings, geo.crown);
      // a gravura: o sulco escuro e a beirada clara
      if (geo.shown) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        menhirGlyph(ctx, cam, d, geo, (s) => {
          glyphPath(ctx, s);
          ctx.strokeStyle = 'rgba(32, 28, 24, 0.6)';
          ctx.lineWidth = 5;
          ctx.stroke();
          glyphPath(ctx, s, 1.2, 1.6);
          ctx.strokeStyle = 'rgba(236, 226, 204, 0.38)';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        });
        ctx.restore();
      }
      // o capim no pé
      const rnd = seeded(d.x, d.y, 4421);
      for (let k = 0; k < 3; k++) {
        const a = rnd() * M.TAU;
        grass(ctx, cam, d.x + Math.cos(a) * d.r * 0.9, d.y + Math.sin(a) * d.r * 0.6 + 10, z0, 20 + rnd() * 10, rnd, ink);
      }
    },
    // a gravura brilhando (respira devagar; de noite, mais)
    overlay(ctx, cam, d, z0, time) {
      const geo = menhirGeom(d, z0);
      if (!geo.shown) return;
      const day = PD.view && PD.view.daylight != null ? PD.view.daylight : 1;
      const night = 1 - day;
      const A = ctx.globalAlpha;
      const a = (0.12 + 0.22 * (0.5 + 0.5 * Math.sin(time * 0.8 + d.x * 0.013))) * (0.45 + 0.9 * night);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = VEIL_GLOW;
      menhirGlyph(ctx, cam, d, geo, (s) => {
        glyphPath(ctx, s);
        ctx.globalAlpha = A * a * 0.45;
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.globalAlpha = A * a;
        ctx.lineWidth = 3.2;
        ctx.stroke();
      });
      ctx.restore();
      ctx.globalAlpha = A;
    },
  };
  /**
   * O Véu da ilha: a cortina de raízes finas que descem da copa da Árvore do Véu até perto do chão, de frente para a
   * câmera (ao longo da diagonal da tela), balançando devagar. Cada raiz brilha verde-água, com uma gota de luz descendo;
   * pontinhos sobem entre elas e uma névoa clara respira no meio. De noite, mais forte. Não segura ninguém: dá para passar.
   * `w`: largura, `h`: altura do alto (cm). Tudo mexe: é desenhada a cada quadro (`live`).
   */
  const VEIL_DIR = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
  const VEIL_N = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  function veilStrands(d) {
    const rnd = seeded(d.x, d.y, 4431);
    const out = [];
    const n = Math.max(6, Math.round(d.w / 28));
    for (let k = 0; k < n; k++) {
      out.push({ u: (k / (n - 1) - 0.5) * d.w + (rnd() - 0.5) * 18, v: (rnd() - 0.5) * 50, top: d.h - rnd() * 90, bot: 18 + rnd() * 70, ph: rnd() * M.TAU, w: 1.6 + rnd() * 1.4, glow: rnd() });
    }
    return out;
  }
  function strandPts(cam, d, z0, s, time) {
    const pts = [];
    const sway = Math.sin(time * 0.55 + s.ph) * 9, sway2 = Math.sin(time * 0.9 + s.ph * 1.7) * 4;
    for (let i = 0; i <= 10; i++) {
      const f = i / 10; // 0 no alto, 1 embaixo
      const du = (sway + sway2 * f) * f;
      pts.push(cam.p({ x: d.x + VEIL_DIR.x * (s.u + du) + VEIL_N.x * s.v, y: d.y + VEIL_DIR.y * (s.u + du) + VEIL_N.y * s.v, z: z0 + s.top + (s.bot - s.top) * f }));
    }
    return pts;
  }
  small['cortina-veu'] = {
    fades: false,
    height: (d) => d.h,
    blocks: 0,
    box: (cam, d, z0) => {
      const e = d.w / 2 + 60;
      return volBox(cam, d.x - e, d.x + e, d.y - e, d.y + e, z0 - 10, z0 + d.h + 30, 24);
    },
    glowPoints: (d) => [-0.3, 0, 0.3].map((f) => ({ x: d.x + VEIL_DIR.x * d.w * f, y: d.y + VEIL_DIR.y * d.w * f, z: d.h * 0.4, r: 160, color: VEIL_GLOW, k: 0.35 })),
    paint() {},
    live(ctx, cam, d, z0, time) {
      const day = PD.view && PD.view.daylight != null ? PD.view.daylight : 1;
      const night = 1 - day;
      const A = ctx.globalAlpha;
      const zm = cam.zoom;
      const strands = veilStrands(d).map((s) => ({ s, pts: strandPts(cam, d, z0, s, time) }));
      const trace = (pts) => {
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      };
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // as raízes, finas e escuras
      for (const { s, pts } of strands) {
        trace(pts);
        ctx.strokeStyle = 'rgba(30, 36, 30, 0.85)';
        ctx.lineWidth = Math.max(1, (s.w + 1.4) * zm);
        ctx.stroke();
        ctx.strokeStyle = '#5c6b52';
        ctx.lineWidth = Math.max(0.7, s.w * zm);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      // a névoa clara no meio, respirando
      const c = cam.p({ x: d.x, y: d.y, z: z0 + d.h * 0.35 });
      const R = d.w * 0.55 * zm;
      ctx.globalAlpha = A * (0.12 + 0.08 * Math.sin(time * 0.7)) * (0.6 + 0.9 * night);
      ctx.drawImage(glowSprite(VEIL_GLOW), c.x - R, c.y - R * 0.9, R * 2, R * 1.8);
      // o brilho de cada raiz e a gota de luz descendo por ela
      ctx.strokeStyle = VEIL_GLOW;
      ctx.fillStyle = '#c8fff6';
      for (const { s, pts } of strands) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 1.3 + s.ph);
        trace(pts);
        ctx.globalAlpha = A * (0.1 + 0.16 * pulse) * (0.6 + 0.8 * night) * (0.6 + 0.4 * s.glow);
        ctx.lineWidth = Math.max(2, 7 * zm);
        ctx.stroke();
        ctx.globalAlpha = A * (0.25 + 0.3 * pulse) * (0.55 + 0.6 * night);
        ctx.lineWidth = Math.max(0.8, 1.6 * zm);
        ctx.stroke();
        const ph = (time * (0.12 + s.glow * 0.1) + s.ph) % 1;
        const q = pts[Math.min(10, Math.floor(ph * 10))];
        ctx.globalAlpha = A * Math.sin(ph * Math.PI) * (0.5 + 0.5 * night);
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(0.8, 2.2 * zm), 0, M.TAU);
        ctx.fill();
      }
      // os pontinhos subindo
      const rr = M.rng(4441);
      ctx.fillStyle = '#bdfcf2';
      for (let k = 0; k < 14; k++) {
        const ph = (time * (0.05 + rr() * 0.06) + rr()) % 1;
        const u = (rr() - 0.5) * d.w;
        const p = cam.p({ x: d.x + VEIL_DIR.x * u, y: d.y + VEIL_DIR.y * u, z: z0 + 20 + ph * d.h * 0.8 });
        ctx.globalAlpha = A * Math.sin(ph * Math.PI) * (0.4 + 0.5 * night);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.7, 1.5 * zm), 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = A;
    },
  };

  // ------------------------------------------------------------------ a caverna por dentro (a Toca da Cuca)
  // (24/11, o dono: "pode fazer a caverna por dentro") O caldeirão da Cuca: o tripé de pedras com a lenha e o fogo
  // embaixo, a panela de ferro e a poção verde borbulhando (o fogo, as bolhas e o vapor mexem a cada quadro: `overlay`);
  // e a estante rústica de potes (`estante-potes`): os paus, as tábuas, os potes de barro, as cabaças, os vidros de
  // poção e as ervas secando penduradas.
  const BREW = '#6fd14e';
  /** Uma linha grossa com o contorno de tinta (de `a` a `b`, na tela). */
  function inkLine2(ctx, a, b, color, w, ink) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + ink * 2;
    line2(ctx, a, b);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    line2(ctx, a, b);
  }
  function cauldronGeom(cam, d, z0) {
    const R = d.r;
    const zr = z0 + 92; // a boca da panela
    const c = cam.p({ x: d.x, y: d.y, z: zr });
    return { R, zr, c, rx: R * cam.zoom, ry: R * 0.5 * cam.zoom, deep: 62 * 0.866 * cam.zoom };
  }
  small.caldeirao = {
    fades: false,
    height: () => 120,
    blocks: 0,
    shadow: (p, cam, d) => H.circleShadow(p, cam, d.x, d.y, d.r * 0.95, 40),
    box: (cam, d, z0) => volBox(cam, d.x - d.r - 40, d.x + d.r + 40, d.y - d.r - 40, d.y + d.r + 40, z0 - 6, z0 + 230, 18),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x, d.y, 4611);
      const zm = cam.zoom;
      const g = cauldronGeom(cam, d, z0);
      // as pedras em roda e a lenha (embaixo da panela)
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * M.TAU + rnd() * 0.3;
        facetRock(ctx, cam, { x: d.x + Math.cos(a) * d.r * 0.95, y: d.y + Math.sin(a) * d.r * 0.95, z0, rx: 17, ry: 14, h: 16, seed: Math.round(d.x + k * 13), colors: CAVE_ROCK }, ink);
      }
      for (const [a0, a1] of [[-0.6, 2.4], [0.9, 3.9]]) {
        const p0 = cam.p({ x: d.x + Math.cos(a0) * d.r * 0.7, y: d.y + Math.sin(a0) * d.r * 0.7, z: z0 + 10 });
        const p1 = cam.p({ x: d.x + Math.cos(a1) * d.r * 0.7, y: d.y + Math.sin(a1) * d.r * 0.7, z: z0 + 10 });
        inkLine2(ctx, p0, p1, '#5a3a22', Math.max(2, 7 * zm), ink);
      }
      // as três pernas da panela
      for (const a of [Math.PI * 0.15, Math.PI * 0.85, Math.PI * 1.5]) {
        const top = cam.p({ x: d.x + Math.cos(a) * g.R * 0.62, y: d.y + Math.sin(a) * g.R * 0.62, z: z0 + 34 });
        const foot = cam.p({ x: d.x + Math.cos(a) * g.R * 0.78, y: d.y + Math.sin(a) * g.R * 0.78, z: z0 });
        inkLine2(ctx, foot, top, '#26262b', Math.max(2, 6 * zm), ink);
      }
      // o bojo de ferro (a barriga que desce da boca), com o brilho do lado da luz
      const { c, rx, ry, deep } = g;
      const body = new Path2D();
      body.moveTo(c.x - rx, c.y);
      body.bezierCurveTo(c.x - rx * 1.08, c.y + deep * 0.75, c.x - rx * 0.6, c.y + deep * 1.08, c.x, c.y + deep * 1.08);
      body.bezierCurveTo(c.x + rx * 0.6, c.y + deep * 1.08, c.x + rx * 1.08, c.y + deep * 0.75, c.x + rx, c.y);
      body.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI, false);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 2.4;
      ctx.stroke(body);
      const iron = ctx.createLinearGradient(c.x - rx, 0, c.x + rx, 0);
      iron.addColorStop(0, '#4a4a52');
      iron.addColorStop(0.35, '#2e2e34');
      iron.addColorStop(1, '#1b1b20');
      ctx.fillStyle = iron;
      ctx.fill(body);
      ctx.strokeStyle = 'rgba(220, 220, 235, 0.25)';
      ctx.lineWidth = Math.max(1, 2.2 * zm);
      ctx.beginPath();
      ctx.ellipse(c.x - rx * 0.45, c.y + deep * 0.45, rx * 0.18, deep * 0.32, 0.3, Math.PI * 0.9, Math.PI * 1.6);
      ctx.stroke();
      // a boca: a beirada grossa e a poção verde lá dentro (as bolhas e o vapor vêm no `overlay`)
      ctx.fillStyle = '#17171b';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx, ry, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = BREW;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + ry * 0.12, rx * 0.84, ry * 0.74, 0, 0, M.TAU);
      ctx.fill();
      ctx.strokeStyle = '#3d3d45';
      ctx.lineWidth = Math.max(1.5, 5 * zm);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx * 0.96, ry * 0.94, 0, 0, M.TAU);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 1.6;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx, ry, 0, 0, M.TAU);
      ctx.stroke();
      // a colher de pau encostada na beirada
      const s0 = cam.p({ x: d.x + g.R * 0.3, y: d.y - g.R * 0.2, z: g.zr - 10 }), s1 = cam.p({ x: d.x + g.R * 0.95, y: d.y - g.R * 0.9, z: g.zr + 70 });
      inkLine2(ctx, s0, s1, '#8a5a32', Math.max(1.5, 4 * zm), ink);
    },
    overlay(ctx, cam, d, z0, time) {
      const zm = cam.zoom;
      const A = ctx.globalAlpha;
      const g = cauldronGeom(cam, d, z0);
      ctx.save();
      // o fogo embaixo da panela (labaredas que tremem)
      const base = cam.p({ x: d.x, y: d.y + d.r * 0.35, z: z0 + 6 });
      for (let k = 0; k < 5; k++) {
        const f = 0.5 + 0.5 * Math.sin(time * 9 + k * 2.3);
        const x = base.x + (k - 2) * 7 * zm, h = (16 + 12 * f) * zm, w = (6 + 2 * f) * zm;
        ctx.globalAlpha = A * 0.9;
        ctx.fillStyle = k % 2 ? '#ffb347' : '#ff7a2a';
        ctx.beginPath();
        ctx.moveTo(x - w, base.y);
        ctx.quadraticCurveTo(x - w * 0.4, base.y - h * 0.6, x + Math.sin(time * 7 + k) * 2 * zm, base.y - h);
        ctx.quadraticCurveTo(x + w * 0.4, base.y - h * 0.6, x + w, base.y);
        ctx.closePath();
        ctx.fill();
      }
      // as bolhas da poção (cada uma cresce e estoura)
      const { c, rx, ry } = g;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + ry * 0.12, rx * 0.84, ry * 0.74, 0, 0, M.TAU);
      ctx.clip();
      const rr = M.rng(4621);
      for (let k = 0; k < 7; k++) {
        const ph = (time * (0.6 + rr() * 0.5) + rr()) % 1;
        const bx = c.x + (rr() - 0.5) * rx * 1.3, by = c.y + ry * 0.1 + (rr() - 0.5) * ry * 1.1;
        ctx.globalAlpha = A * (1 - ph) * 0.9;
        ctx.strokeStyle = '#d8ffb8';
        ctx.lineWidth = Math.max(0.8, 1.4 * zm);
        ctx.beginPath();
        ctx.arc(bx, by, (2 + ph * 6) * zm, 0, M.TAU);
        ctx.stroke();
      }
      ctx.restore();
      // o vapor verde subindo e o brilho em cima da boca
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = A * (0.28 + 0.1 * Math.sin(time * 1.7));
      const R = rx * 1.5;
      ctx.drawImage(glowSprite(BREW), c.x - R, c.y - R * 0.8, R * 2, R * 1.4);
      ctx.restore();
      ctx.save();
      const rs = M.rng(4631);
      for (let k = 0; k < 4; k++) {
        const ph = (time * (0.18 + rs() * 0.1) + rs()) % 1;
        const sx = c.x + (rs() - 0.5) * rx * 0.9 + Math.sin(time * 1.3 + k) * 6 * zm;
        const sy = c.y - ph * 110 * zm;
        ctx.globalAlpha = A * Math.sin(ph * Math.PI) * 0.35;
        ctx.fillStyle = '#c9f5b4';
        ctx.beginPath();
        ctx.ellipse(sx, sy, (8 + ph * 14) * zm, (5 + ph * 8) * zm, 0, 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = A;
    },
  };
  small['estante-potes'] = {
    fades: true,
    height: (d) => d.h + 10,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, d.h * 0.8),
    box: (cam, d, z0) => volBox(cam, d.x0 - 20, d.x1 + 20, d.y0 - 20, d.y1 + 30, z0 - 6, z0 + d.h + 20, 16),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 4641);
      const zm = cam.zoom;
      const P = (x, y, z) => cam.p({ x, y, z });
      const WOODS = { front: '#7a5232', side: '#5e3e24', top: '#94683f' };
      // os quatro paus (os de trás primeiro) e as tábuas (de baixo para cima), com o que fica em cima de cada uma
      for (const x of [d.x0 + 4, d.x1 - 10]) H.box(ctx, cam, x, x + 6, d.y0, d.y0 + 6, z0, z0 + d.h, WOODS, ink);
      const levels = [z0 + 26, z0 + 86, z0 + 146];
      const POTS = ['#a8552e', '#c06a38', '#8f4a2a'];
      const GLASS = ['#7be04e', '#b36bff', '#f2b632', '#4fd6c8'];
      for (const [i, zt] of levels.entries()) {
        H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, zt - 6, zt, WOODS, ink);
        const n = Math.max(3, Math.round((d.x1 - d.x0) / 42));
        for (let k = 0; k < n; k++) {
          const x = d.x0 + 18 + ((d.x1 - d.x0 - 36) * (k + 0.5)) / n + (rnd() - 0.5) * 8;
          const q = P(x, d.y1 - 14, zt);
          const kind = rnd();
          if (kind < 0.4) {
            // o pote de barro (barriga redonda, o gargalo e a boca)
            const r = (9 + rnd() * 4) * zm;
            ctx.fillStyle = INK;
            ctx.beginPath();
            ctx.ellipse(q.x, q.y - r, r + ink, r + ink, 0, 0, M.TAU);
            ctx.fill();
            ctx.fillStyle = POTS[Math.floor(rnd() * POTS.length)];
            ctx.beginPath();
            ctx.ellipse(q.x, q.y - r, r, r, 0, 0, M.TAU);
            ctx.fill();
            ctx.fillRect(q.x - r * 0.45, q.y - r * 2.3, r * 0.9, r * 0.5);
            ctx.fillStyle = 'rgba(255, 220, 180, 0.3)';
            ctx.beginPath();
            ctx.ellipse(q.x - r * 0.35, q.y - r * 1.3, r * 0.25, r * 0.4, 0.4, 0, M.TAU);
            ctx.fill();
          } else if (kind < 0.65) {
            // a cabaça (duas bolas, a de baixo maior)
            for (const [dy, rr] of [[0, 9], [-15, 6]]) {
              ctx.fillStyle = INK;
              ctx.beginPath();
              ctx.ellipse(q.x, q.y + (dy - rr) * zm, rr * zm + ink, rr * zm + ink, 0, 0, M.TAU);
              ctx.fill();
              ctx.fillStyle = '#c9a25a';
              ctx.beginPath();
              ctx.ellipse(q.x, q.y + (dy - rr) * zm, rr * zm, rr * zm, 0, 0, M.TAU);
              ctx.fill();
            }
          } else {
            // o vidro de poção (o líquido colorido, a tampa de rolha e o brilho)
            const w = 7 * zm, h = (16 + rnd() * 8) * zm;
            ctx.fillStyle = INK;
            ctx.fillRect(q.x - w - ink, q.y - h - ink, (w + ink) * 2, h + ink);
            ctx.fillStyle = 'rgba(210, 235, 240, 0.85)';
            ctx.fillRect(q.x - w, q.y - h, w * 2, h);
            ctx.fillStyle = GLASS[Math.floor(rnd() * GLASS.length)];
            ctx.fillRect(q.x - w, q.y - h * 0.62, w * 2, h * 0.62);
            ctx.fillStyle = '#8a5a32';
            ctx.fillRect(q.x - w * 0.6, q.y - h - 4 * zm, w * 1.2, 4 * zm);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.fillRect(q.x - w * 0.6, q.y - h * 0.9, 2 * zm, h * 0.6);
          }
        }
        // as ervas secando, penduradas na tábua de cima
        if (i === levels.length - 1) {
          for (let k = 0; k < 4; k++) {
            const x = d.x0 + 20 + ((d.x1 - d.x0 - 40) * k) / 3;
            const top = P(x, d.y1 + 2, zt - 6);
            ctx.strokeStyle = '#3a2a1c';
            ctx.lineWidth = Math.max(0.8, 1 * zm);
            line2(ctx, top, { x: top.x, y: top.y + 10 * zm });
            for (let j = 0; j < 6; j++) {
              ctx.strokeStyle = j % 2 ? '#6f8f3a' : '#8aa84a';
              ctx.lineWidth = Math.max(1, 2 * zm);
              line2(ctx, { x: top.x, y: top.y + 10 * zm }, { x: top.x + (j - 2.5) * 2.4 * zm, y: top.y + (26 + rnd() * 8) * zm });
            }
          }
        }
      }
      // os paus da frente e a tábua de cima
      for (const x of [d.x0 + 4, d.x1 - 10]) H.box(ctx, cam, x, x + 6, d.y1 - 6, d.y1, z0, z0 + d.h, WOODS, ink);
      H.box(ctx, cam, d.x0 - 6, d.x1 + 6, d.y0 - 4, d.y1 + 4, z0 + d.h - 6, z0 + d.h, WOODS, ink);
    },
  };

  // ------------------------------------------------------------------ o campinho (Guarapiranga)
  // (24/11, "pode seguir com os detalhes do Guarapiranga") A bola de futebol esquecida no campo de terra: branca, com os
  // gomos pretos e o brilho do lado da luz. O resto do campinho são peças que já existem (o muro grafitado, o alambrado,
  // a barraca de pastel do Capão, a mesa e as cadeiras do bar, o mastro do clube).
  small.bola = {
    fades: false,
    height: () => 24,
    blocks: 0,
    shadow: (p, cam, d) => H.circleShadow(p, cam, d.x, d.y, 10, 6),
    box: (cam, d, z0) => volBox(cam, d.x - 16, d.x + 16, d.y - 16, d.y + 16, z0 - 4, z0 + 26, 8),
    paint(ctx, cam, d, z0, ink) {
      const zm = cam.zoom;
      const c = cam.p({ x: d.x, y: d.y, z: z0 + 11 });
      const R = 11 * zm;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(c.x, c.y, R + ink, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#f3f1ea';
      ctx.beginPath();
      ctx.arc(c.x, c.y, R, 0, M.TAU);
      ctx.fill();
      // os gomos pretos (o do meio e os da beira, cortados pela borda)
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x, c.y, R, 0, M.TAU);
      ctx.clip();
      ctx.fillStyle = '#2a2a2e';
      const pent = (x, y, r, rot) => {
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = rot + (k / 5) * M.TAU;
          const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
          if (k) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      };
      pent(c.x + R * 0.1, c.y + R * 0.05, R * 0.34, -Math.PI / 2);
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k / 5) * M.TAU + Math.PI / 5;
        pent(c.x + Math.cos(a) * R * 0.95, c.y + Math.sin(a) * R * 0.95, R * 0.3, a);
      }
      // a terra grudada embaixo e o brilho do lado da luz
      ctx.fillStyle = 'rgba(120, 84, 48, 0.35)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + R * 0.75, R * 0.9, R * 0.4, 0, 0, M.TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(c.x - R * 0.38, c.y - R * 0.42, R * 0.26, R * 0.16, -0.5, 0, M.TAU);
      ctx.fill();
    },
  };

  // ------------------------------------------------------------------ o mirante (Guarapiranga)
  // (24/11, o dono: "pode seguir vestindo o mirante") A torre de observação de troncos no canto de trás do deque: os
  // quatro esteios com as escoras em X, o primeiro andar, a escada do lado sul (degraus, banzos e corrimão), o andar de
  // cima com o guarda-corpo e o telhado de sapê em pirâmide (não dá para subir, por enquanto). E o que fica no deque: o
  // guarda-corpo de madeira (`guarda-corpo`), a luneta de moedas (`luneta`, sem marca) virada para a represa e o painel
  // (`painel-mirante`) com o mapa da represa e as aves.
  const WOOD = { front: '#8a6b4c', side: '#6e543b', top: '#a3825f' };
  const LOG = { hi: '#a7865f', mid: '#7a5a3c', lo: '#4a3424' };
  /** Um tronco em pé (de z0 a z1) no ponto (x, y): o contorno, a luz de um lado e os veios da casca. */
  function log(ctx, cam, x, y, z0, z1, r, ink) {
    const a = cam.p({ x, y, z: z0 }), b = cam.p({ x, y, z: z1 });
    const w = r * cam.zoom;
    ctx.fillStyle = INK;
    ctx.fillRect(a.x - w - ink, b.y - ink * 0.5, 2 * (w + ink), a.y - b.y + ink);
    const g = ctx.createLinearGradient(a.x - w, 0, a.x + w, 0);
    g.addColorStop(0, LOG.hi);
    g.addColorStop(0.45, LOG.mid);
    g.addColorStop(1, LOG.lo);
    ctx.fillStyle = g;
    ctx.fillRect(a.x - w, b.y, 2 * w, a.y - b.y);
    ctx.strokeStyle = 'rgba(40, 26, 16, 0.35)';
    ctx.lineWidth = Math.max(0.6, 0.8 * cam.zoom);
    const rnd = seeded(x, y, Math.round(z0) + 4501);
    for (let k = 0; k < 5; k++) {
      const yy = b.y + (a.y - b.y) * rnd();
      line2(ctx, { x: a.x - w * 0.6, y: yy }, { x: a.x - w * 0.1, y: yy + 6 * cam.zoom });
    }
  }
  /** Uma viga (de `p` a `q`, pontos 3D) de seção `r`: a tinta e a madeira com a luz em cima. */
  function beam(ctx, cam, p, q, r, ink, color = WOOD.front) {
    pipe(ctx, cam, [p, q], r, ink * 0.8, color);
  }
  function towerGeom(d, z0) {
    const yb = d.y1 - d.stair; // o fim da torre (a escada fica entre yb e y1)
    const i = 18;
    const posts = [[d.x0 + i, d.y0 + i], [d.x1 - i, d.y0 + i], [d.x1 - i, yb - i], [d.x0 + i, yb - i]];
    // (o jirau do caçador, na várzea: um andar só, baixo — a escada sobe direto do chão para ele)
    return { yb, posts, L1: d.single ? z0 + d.h : z0 + 300, L2: z0 + d.h, R: z0 + d.h + (d.single ? 180 : 220) };
  }
  /** As escoras em X de um lado (entre os esteios `a` e `b`, de za a zb). */
  function xBrace(ctx, cam, a, b, za, zb, ink) {
    beam(ctx, cam, { x: a[0], y: a[1], z: za }, { x: b[0], y: b[1], z: zb }, 3.4, ink);
    beam(ctx, cam, { x: a[0], y: a[1], z: zb }, { x: b[0], y: b[1], z: za }, 3.4, ink);
    beam(ctx, cam, { x: a[0], y: a[1], z: zb - 6 }, { x: b[0], y: b[1], z: zb - 6 }, 4, ink, WOOD.side);
  }
  /** O guarda-corpo de madeira de um lado (entre `a` e `b` no chão z): postes, corrimão e a travessa do meio. */
  function woodRail(ctx, cam, a, b, z, h, ink, step = 110) {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(L / step));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      beam(ctx, cam, { ...p, z }, { ...p, z: z + h }, 3.6, ink, WOOD.side);
    }
    beam(ctx, cam, { x: a.x, y: a.y, z: z + h * 0.5 }, { x: b.x, y: b.y, z: z + h * 0.5 }, 2.6, ink);
    beam(ctx, cam, { x: a.x, y: a.y, z: z + h }, { x: b.x, y: b.y, z: z + h }, 3.8, ink, WOOD.top);
  }
  small['torre-mirante'] = {
    fades: true,
    height: (d) => d.h + 360,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1 - d.stair, d.h + 300),
    box: (cam, d, z0) => volBox(cam, d.x0 - 70, d.x1 + 70, d.y0 - 70, d.y1 + 40, z0 - 10, z0 + d.h + 380, 24),
    paint(ctx, cam, d, z0, ink) {
      const g = towerGeom(d, z0);
      const [NW, NE, SE, SW] = g.posts;
      const rnd = seeded(d.x0, d.y0, 4511);
      const floor = (z) => H.box(ctx, cam, d.x0 - 12, d.x1 + 12, d.y0 - 12, g.yb + 12, z - 14, z, WOOD, ink);
      const planks = (z) => {
        // as tábuas do assoalho (riscos ao longo de x) por cima da caixa
        ctx.strokeStyle = 'rgba(50, 34, 22, 0.4)';
        ctx.lineWidth = Math.max(0.6, 0.9 * cam.zoom);
        for (let y = d.y0; y < g.yb + 12; y += 18) line2(ctx, cam.p({ x: d.x0 - 12, y, z }), cam.p({ x: d.x1 + 12, y, z }));
      };
      // o térreo: as escoras de trás, os esteios e as escoras da frente
      xBrace(ctx, cam, NW, NE, z0 + 30, g.L1 - 14, ink);
      xBrace(ctx, cam, NW, SW, z0 + 30, g.L1 - 14, ink);
      for (const [x, y] of [NW, NE, SW, SE]) log(ctx, cam, x, y, z0 - 10, g.L1, 13, ink);
      xBrace(ctx, cam, SW, SE, z0 + 30, g.L1 - 14, ink);
      xBrace(ctx, cam, NE, SE, z0 + 30, g.L1 - 14, ink);
      if (!d.single) {
        floor(g.L1);
        planks(g.L1);
      }
      // o primeiro andar até o de cima (os esteios afinam; o jirau não tem)
      if (!d.single) {
        xBrace(ctx, cam, NW, NE, g.L1 + 10, g.L2 - 14, ink);
        xBrace(ctx, cam, NW, SW, g.L1 + 10, g.L2 - 14, ink);
        for (const [x, y] of [NW, NE, SW, SE]) log(ctx, cam, x, y, g.L1, g.L2, 11, ink);
        xBrace(ctx, cam, SW, SE, g.L1 + 10, g.L2 - 14, ink);
        xBrace(ctx, cam, NE, SE, g.L1 + 10, g.L2 - 14, ink);
      }
      // a escada do lado sul: sobe do leste (no deque) para o oeste (no primeiro andar)
      const ys = [g.yb + 8, d.y1 - 8];
      const xa = d.x1 - 30, xb = d.x0 + 30;
      for (const y of ys) beam(ctx, cam, { x: xa, y, z: z0 }, { x: xb, y, z: g.L1 }, 4.4, ink, WOOD.side);
      const steps = 14;
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        const x = xa + (xb - xa) * t, z = z0 + (g.L1 - z0) * t;
        H.box(ctx, cam, x - 14, x + 14, ys[0], ys[1], z - 4, z, WOOD, ink * 0.7);
      }
      for (const y of [ys[1]]) {
        beam(ctx, cam, { x: xa, y, z: z0 + 95 }, { x: xb, y, z: g.L1 + 95 }, 3.4, ink, WOOD.top);
        for (let k = 0; k <= 4; k++) {
          const t = k / 4;
          const x = xa + (xb - xa) * t, z = z0 + (g.L1 - z0) * t;
          beam(ctx, cam, { x, y, z }, { x, y, z: z + 95 }, 2.6, ink, WOOD.side);
        }
      }
      // o andar de cima: o assoalho, os esteios do telhado e o guarda-corpo (os lados de trás primeiro)
      floor(g.L2);
      planks(g.L2);
      const top = g.posts.map(([x, y]) => ({ x, y }));
      woodRail(ctx, cam, top[0], top[1], g.L2, 100, ink);
      woodRail(ctx, cam, top[0], top[3], g.L2, 100, ink);
      for (const [x, y] of [NW, NE, SW]) log(ctx, cam, x, y, g.L2, g.R, 9, ink);
      woodRail(ctx, cam, top[3], top[2], g.L2, 100, ink);
      woodRail(ctx, cam, top[1], top[2], g.L2, 100, ink);
      log(ctx, cam, SE[0], SE[1], g.L2, g.R, 9, ink);
      // a plaquinha MIRANTE no guarda-corpo de cima, do lado sul (no jirau, não)
      if (!d.single) H.onWall(ctx, cam, { x: (d.x0 + d.x1) / 2 - 60, y: g.yb - 16, z: g.L2 + 92 }, { x: 1, y: 0 }, () => {
        ctx.fillStyle = INK;
        ctx.fillRect(-3, -3, 126, 34);
        ctx.fillStyle = '#e9dcc0';
        ctx.fillRect(0, 0, 120, 28);
        ctx.fillStyle = '#5a3b22';
        ctx.font = `bold 19px ${H.FONT_SIGN || 'sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MIRANTE', 60, 15);
      });
      // o telhado de sapê em pirâmide: a beirada desfiada, as camadas de palha e o arremate no alto
      const o = 46;
      const E = [{ x: d.x0 - o, y: d.y0 - o }, { x: d.x1 + o, y: d.y0 - o }, { x: d.x1 + o, y: g.yb + o }, { x: d.x0 - o, y: g.yb + o }].map((q) => ({ ...q, z: g.R }));
      const apex = { x: (d.x0 + d.x1) / 2, y: (d.y0 + g.yb) / 2, z: g.R + 150 };
      const P = (q) => cam.p(q);
      poly(ctx, hullOf(E.map(P).concat([P(apex)])), null, INK, ink * 2.4);
      const faces = [[E[3], E[2]], [E[1], E[2]]]; // os lados que a câmera vê: o sul e o leste
      for (const [i, [a, b]] of faces.entries()) {
        const pts = [a, b, apex].map(P);
        const path = pathOf(pts);
        ctx.fillStyle = i ? '#a5843f' : '#bf9b4e';
        ctx.fill(path);
        ctx.save();
        ctx.clip(path);
        // as camadas de palha (riscos curtos do alto para a beirada)
        for (let row = 0; row < 7; row++) {
          const t = row / 7;
          for (let k = 0; k < 26; k++) {
            const u = (k + rnd() * 0.6) / 26;
            const base = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z };
            const p0 = { x: base.x + (apex.x - base.x) * t, y: base.y + (apex.y - base.y) * t, z: base.z + (apex.z - base.z) * t };
            const p1 = { x: base.x + (apex.x - base.x) * (t + 0.11), y: base.y + (apex.y - base.y) * (t + 0.11), z: base.z + (apex.z - base.z) * (t + 0.11) };
            ctx.strokeStyle = rnd() < 0.5 ? 'rgba(120, 88, 40, 0.55)' : 'rgba(232, 206, 140, 0.45)';
            ctx.lineWidth = Math.max(0.7, 1.2 * cam.zoom);
            line2(ctx, P(p0), P(p1));
          }
          const l0 = { x: a.x + (apex.x - a.x) * t, y: a.y + (apex.y - a.y) * t, z: a.z + (apex.z - a.z) * t };
          const l1 = { x: b.x + (apex.x - b.x) * t, y: b.y + (apex.y - b.y) * t, z: b.z + (apex.z - b.z) * t };
          ctx.strokeStyle = 'rgba(80, 58, 26, 0.35)';
          ctx.lineWidth = Math.max(0.8, 1.6 * cam.zoom);
          line2(ctx, P(l0), P(l1));
        }
        ctx.restore();
        // a beirada desfiada (as pontas da palha pendendo)
        ctx.strokeStyle = '#8a6a30';
        ctx.lineWidth = Math.max(0.8, 1.3 * cam.zoom);
        for (let k = 0; k <= 30; k++) {
          const u = k / 30;
          const q = P({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z });
          line2(ctx, q, { x: q.x + (rnd() - 0.5) * 3 * cam.zoom, y: q.y + (5 + rnd() * 7) * cam.zoom });
        }
      }
      // o arremate do alto: a palha amarrada
      const tip = P(apex);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(tip.x, tip.y + 4 * cam.zoom, 11 * cam.zoom + ink, 7 * cam.zoom + ink, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#8a6a30';
      ctx.beginPath();
      ctx.ellipse(tip.x, tip.y + 4 * cam.zoom, 11 * cam.zoom, 7 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
    },
  };
  /** O guarda-corpo do deque: uma caixa fina; os postes de 1,1 em 1,1 m, a travessa do meio e o corrimão. */
  small['guarda-corpo'] = {
    fades: true,
    height: (d) => d.h,
    blocks: 0,
    shadow: (p, cam, d) => {
      const along = d.x1 - d.x0 >= d.y1 - d.y0;
      const m = along ? (d.y0 + d.y1) / 2 : (d.x0 + d.x1) / 2;
      H.boxShadow(p, cam, along ? d.x0 : m - 3, along ? d.x1 : m + 3, along ? m - 3 : d.y0, along ? m + 3 : d.y1, d.h * 0.4);
    },
    box: (cam, d, z0) => volBox(cam, d.x0 - 20, d.x1 + 20, d.y0 - 20, d.y1 + 20, z0 - 6, z0 + d.h + 20, 16),
    paint(ctx, cam, d, z0, ink) {
      const along = d.x1 - d.x0 >= d.y1 - d.y0;
      const m = along ? (d.y0 + d.y1) / 2 : (d.x0 + d.x1) / 2;
      const a = along ? { x: d.x0 + 4, y: m } : { x: m, y: d.y0 + 4 }, b = along ? { x: d.x1 - 4, y: m } : { x: m, y: d.y1 - 4 };
      woodRail(ctx, cam, a, b, z0, d.h, ink);
    },
  };
  /** A luneta de moedas (de parque, sem marca): o cano no chão e a cabeça com os dois olhos, virada para `angle`. */
  small.luneta = {
    fades: true,
    height: () => 150,
    blocks: 0,
    shadow: (p, cam, d) => H.lineShadow(p, cam, d.x, d.y, 140, 9),
    box: (cam, d, z0) => volBox(cam, d.x - 60, d.x + 60, d.y - 60, d.y + 60, z0 - 6, z0 + 160, 16),
    paint(ctx, cam, d, z0, ink) {
      const GREEN = '#2f5d4a', HI = '#4f8a6e', DK = '#1e3a2f', CHROME = '#c9ced0';
      pipe(ctx, cam, [{ x: d.x, y: d.y, z: z0 }, { x: d.x, y: d.y, z: z0 + 105 }], 5, ink, '#5b6266');
      const base = cam.p({ x: d.x, y: d.y, z: z0 });
      ctx.fillStyle = '#4a5054';
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, 14 * cam.zoom, 7 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
      const a = (d.angle * Math.PI) / 180;
      const f = { x: Math.cos(a), y: Math.sin(a) }, s = { x: -Math.sin(a), y: Math.cos(a) };
      const c = { x: d.x, y: d.y, z: z0 + 118 };
      const pt = (u, v, w) => ({ x: c.x + f.x * u + s.x * v, y: c.y + f.y * u + s.y * v, z: c.z + w });
      // a cabeça: uma caixa virada para a frente (os lados que a câmera vê, do fundo para a frente)
      const hl = 22, hw = 17, hh = 13;
      const corners = (u, v, w) => pt(u * hl, v * hw, w * hh);
      const facesDef = [
        { n: f, pts: [corners(1, -1, -1), corners(1, 1, -1), corners(1, 1, 1), corners(1, -1, 1)], c: DK },
        { n: { x: -f.x, y: -f.y }, pts: [corners(-1, 1, -1), corners(-1, -1, -1), corners(-1, -1, 1), corners(-1, 1, 1)], c: GREEN },
        { n: s, pts: [corners(-1, 1, -1), corners(1, 1, -1), corners(1, 1, 1), corners(-1, 1, 1)], c: GREEN },
        { n: { x: -s.x, y: -s.y }, pts: [corners(1, -1, -1), corners(-1, -1, -1), corners(-1, -1, 1), corners(1, -1, 1)], c: GREEN },
      ];
      const vis = facesDef.filter((q) => q.n.x * cam.toCamera.x + q.n.y * cam.toCamera.y > 0);
      const all = facesDef.flatMap((q) => q.pts).map((q) => cam.p(q));
      poly(ctx, hullOf(all), null, INK, ink * 2.2);
      for (const q of vis) poly(ctx, q.pts.map((p) => cam.p(p)), q.c);
      poly(ctx, [corners(-1, -1, 1), corners(1, -1, 1), corners(1, 1, 1), corners(-1, 1, 1)].map((p) => cam.p(p)), HI);
      // os dois olhos (na frente, as lentes; atrás, os visores) e a fenda da moeda no lado
      for (const v of [-0.5, 0.5]) {
        const lens = cam.p(pt(hl + 3, v * hw, 0));
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(lens.x, lens.y, 6.5 * cam.zoom + ink * 0.6, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#8fb7c4';
        ctx.beginPath();
        ctx.arc(lens.x, lens.y, 6.5 * cam.zoom, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(lens.x - 2 * cam.zoom, lens.y - 2 * cam.zoom, 2 * cam.zoom, 0, M.TAU);
        ctx.fill();
        pipe(ctx, cam, [pt(-hl, v * hw, 2), pt(-hl - 10, v * hw, 2)], 3.4, ink * 0.6, '#262a2c');
      }
      const slot = cam.p(pt(0, hw + 1, 4));
      ctx.fillStyle = CHROME;
      ctx.fillRect(slot.x - 4 * cam.zoom, slot.y - 1.2 * cam.zoom, 8 * cam.zoom, 2.4 * cam.zoom);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(slot.x - 2.6 * cam.zoom, slot.y - 0.5 * cam.zoom, 5.2 * cam.zoom, 1 * cam.zoom);
    },
  };
  /** O painel do mirante: os dois postes, o telhadinho e a placa com o mapa da represa e as aves (virado para o sul). */
  small['painel-mirante'] = {
    fades: true,
    height: () => 230,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, 200),
    box: (cam, d, z0) => volBox(cam, d.x0 - 40, d.x1 + 40, d.y0 - 40, d.y1 + 40, z0 - 6, z0 + 240, 16),
    paint(ctx, cam, d, z0, ink) {
      const y = (d.y0 + d.y1) / 2;
      const W = d.x1 - d.x0;
      for (const x of [d.x0 + 8, d.x1 - 8]) log(ctx, cam, x, y, z0 - 6, z0 + 205, 6, ink);
      // a placa
      const top = z0 + 180, Hb = 95;
      H.box(ctx, cam, d.x0 + 4, d.x1 - 4, y - 4, y + 4, top - Hb - 6, top + 4, WOOD, ink);
      H.onWall(ctx, cam, { x: d.x0 + 4, y: y + 4.5, z: top }, { x: 1, y: 0 }, () => {
        const L = W - 8;
        ctx.fillStyle = '#efe3c4';
        ctx.fillRect(6, 6, L - 12, Hb - 12);
        ctx.fillStyle = '#2f5d4a';
        ctx.fillRect(6, 6, L - 12, 14);
        ctx.fillStyle = '#f4ecd8';
        ctx.font = `bold 10px ${H.FONT_SIGN || 'sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('REPRESA GUARAPIRANGA', L / 2, 13.5);
        // o mapa: a represa (azul), a ilha, a barragem no sul e o "você está aqui" no oeste
        const mx = 14, my = 26, mw = L * 0.56, mh = Hb - 40;
        ctx.fillStyle = '#9cc58c';
        ctx.fillRect(mx, my, mw, mh);
        ctx.fillStyle = '#4f8fb0';
        ctx.beginPath();
        const pts = [[0.22, 0.12], [0.6, 0.08], [0.86, 0.22], [0.9, 0.55], [0.8, 0.82], [0.5, 0.88], [0.28, 0.8], [0.12, 0.55], [0.16, 0.3]];
        pts.forEach(([u, v], i) => (i ? ctx.lineTo(mx + u * mw, my + v * mh) : ctx.moveTo(mx + u * mw, my + v * mh)));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#6f9e5c';
        ctx.beginPath();
        ctx.ellipse(mx + mw * 0.52, my + mh * 0.48, mw * 0.08, mh * 0.1, 0.3, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#8a8478';
        ctx.fillRect(mx + mw * 0.34, my + mh * 0.86, mw * 0.4, 3);
        ctx.fillStyle = '#d23b2f';
        ctx.beginPath();
        ctx.arc(mx + mw * 0.1, my + mh * 0.42, 3.4, 0, M.TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40, 30, 20, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx, my, mw, mh);
        // as aves da represa: a garça, o biguá e o martim-pescador
        const bx = mx + mw + 10;
        const bird = (cx, cy, body, head, beak, neck) => {
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 7, 4, -0.2, 0, M.TAU);
          ctx.fill();
          ctx.strokeStyle = body;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx + 5, cy - 2);
          ctx.lineTo(cx + 7, cy - 2 - neck);
          ctx.stroke();
          ctx.fillStyle = head;
          ctx.beginPath();
          ctx.arc(cx + 7.5, cy - 3 - neck, 2.6, 0, M.TAU);
          ctx.fill();
          ctx.strokeStyle = beak;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(cx + 9.5, cy - 3 - neck);
          ctx.lineTo(cx + 14, cy - 2.5 - neck);
          ctx.stroke();
          ctx.strokeStyle = '#4a3a2a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx - 1, cy + 3);
          ctx.lineTo(cx - 1, cy + 9);
          ctx.moveTo(cx + 2, cy + 3);
          ctx.lineTo(cx + 2, cy + 9);
          ctx.stroke();
        };
        bird(bx + 6, my + 14, '#f7f4ec', '#f7f4ec', '#e8b23a', 9);
        bird(bx + 6, my + 36, '#26282a', '#26282a', '#5a5a5a', 4);
        bird(bx + 26, my + 26, '#2f7fb3', '#2f7fb3', '#3a2a1a', 2);
        ctx.fillStyle = '#e07a3a';
        ctx.beginPath();
        ctx.ellipse(bx + 26, my + 28.5, 4.5, 2, -0.2, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60, 44, 28, 0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, L - 8, Hb - 8);
      });
      // o telhadinho (duas tábuas inclinadas)
      const zr = top + 8;
      const roof = [{ x: d.x0 - 10, y: y + 22, z: zr }, { x: d.x1 + 10, y: y + 22, z: zr }, { x: d.x1 + 10, y: y - 8, z: zr + 20 }, { x: d.x0 - 10, y: y - 8, z: zr + 20 }].map((q) => cam.p(q));
      poly(ctx, roof, '#6e543b', INK, ink * 1.8);
      ctx.strokeStyle = 'rgba(30, 20, 12, 0.35)';
      ctx.lineWidth = Math.max(0.6, 0.9 * cam.zoom);
      for (let k = 1; k < 8; k++) {
        const t = k / 8;
        line2(ctx, { x: roof[0].x + (roof[1].x - roof[0].x) * t, y: roof[0].y + (roof[1].y - roof[0].y) * t }, { x: roof[3].x + (roof[2].x - roof[3].x) * t, y: roof[3].y + (roof[2].y - roof[3].y) * t });
      }
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
