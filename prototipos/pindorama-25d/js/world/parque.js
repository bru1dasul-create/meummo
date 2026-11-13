// O parque antigo (aprovado pelo dono em 13/11; referências docs/referencias/parque-antigo-aprovado.jpg e
// parque-academia-aprovado.jpg): o bebedouro de concreto quebrado e com musgo e a academia ao ar livre (o simulador
// de caminhada, a barra e a remada), de cano azul descascado, com ferrugem e cipó. O banco de concreto, a lixeira
// verde e o poste torto apagado ficam no props.js (são variações dos que a vila já tinha); a placa grande da entrada,
// no fundo.js; a calçada de placas soltas, no street.js.
//   PD.city.small[tipo] = { height, blocks, box, shadow, paint }   (o props.js usa como as plantas)
(function (PD) {
  'use strict';
  const M = PD.math;
  const H = PD.props.help;
  const { INK } = H;
  const small = PD.city.small;

  const seeded = (x, y, k) => M.rng((Math.round(x * 3.7) * 73856093) ^ (Math.round(y * 5.3) * 19349663) ^ (k * 83492791));
  const CONCRETE = { front: '#aea89a', side: '#8f897c', top: '#c4beb0' };
  const PAINT = { tube: '#3f7db6', light: '#79abd9', rust: 'rgba(138, 74, 38, 0.85)' };
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
  function grass(ctx, cam, x, y, z, size, rnd, ink) {
    if (PD.city.grass) PD.city.grass(ctx, cam.p({ x, y, z }), size * cam.zoom, rnd, ink);
  }
  function vine3d(ctx, cam, pts3, rnd, ink) {
    if (PD.city.vine) PD.city.vine(ctx, pts3.map((q) => cam.p(q)), rnd, cam.zoom, ink);
  }
  /** Cano pintado em 3D: contorno, a cor e um fio de luz em cima. */
  function tube(ctx, cam, pts3, w0, ink, color = PAINT.tube) {
    const w = w0 * 1.45;
    const pts = pts3.map((q) => cam.p(q));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.strokeStyle = INK;
    ctx.lineWidth = w * cam.zoom + ink * 2;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w * cam.zoom;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = Math.max(0.8, w * 0.28 * cam.zoom);
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x - w * 0.22 * cam.zoom, q.y - w * 0.22 * cam.zoom) : ctx.moveTo(q.x - w * 0.22 * cam.zoom, q.y - w * 0.22 * cam.zoom)));
    ctx.stroke();
  }
  /** Manchas de ferrugem ao longo de um cano (mais perto do chão). */
  function rust(ctx, cam, a, b, rnd, n) {
    for (let k = 0; k < n; k++) {
      const u = rnd() * rnd();
      const q = cam.p({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u });
      ctx.fillStyle = PAINT.rust;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, (2 + rnd() * 2.6) * cam.zoom, (1.4 + rnd() * 1.8) * cam.zoom, rnd() * 3, 0, M.TAU);
      ctx.fill();
    }
  }
  /** Chapinha de metal no chão, onde o cano é chumbado. */
  function foot(ctx, cam, x, y, z0, ink) {
    H.box(ctx, cam, x - 9, x + 9, y - 9, y + 9, z0, z0 + 3, { front: '#5d6064', side: '#4a4d51', top: '#74777b' }, ink);
  }

  // ------------------------------------------------------------------ bebedouro de concreto
  // Coluna de concreto com a cuba redonda em cima e a torneirinha; `quebrado`: a beira da cuba lascada, a torneira
  // torta e uma trinca descendo; `musgo`: musgo na coluna e na beira. Uma mancha de água velha no chão.
  small.bebedouro = {
    height: () => 100,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x - 16, d.x + 16, d.y - 16, d.y + 16, 90),
    box: (cam, d, z0) => volBox(cam, d.x - 40, d.x + 40, d.y - 40, d.y + 40, z0, z0 + 110, 16),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x, d.y, 2301);
      const P = (x, y, z) => cam.p({ x, y, z });
      // mancha de água velha no chão (na frente)
      const st = P(d.x + 14, d.y + 22, z0);
      ctx.fillStyle = 'rgba(40, 46, 40, 0.35)';
      ctx.beginPath();
      ctx.ellipse(st.x, st.y, 26 * cam.zoom, 11 * cam.zoom, 0.2, 0, M.TAU);
      ctx.fill();
      grass(ctx, cam, d.x - 18, d.y - 16, z0, 20, rnd, ink);
      // a coluna
      const col = H.box(ctx, cam, d.x - 15, d.x + 15, d.y - 15, d.y + 15, z0, z0 + 78, CONCRETE, ink);
      // a cuba: anel de concreto e o fundo escuro
      const zc = z0 + 78;
      const ring = (R, z) => {
        const pts = [];
        for (let i = 0; i < 28; i++) {
          const t = (i / 28) * M.TAU;
          pts.push(P(d.x + Math.cos(t) * R, d.y + Math.sin(t) * R, z));
        }
        return pts;
      };
      const side = ring(27, zc).concat(ring(27, zc + 12).reverse());
      ctx.beginPath();
      side.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 2;
      ctx.stroke();
      ctx.fillStyle = CONCRETE.side;
      ctx.fill();
      const top = ring(27, zc + 12);
      ctx.beginPath();
      top.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.fillStyle = CONCRETE.top;
      ctx.fill();
      ctx.stroke();
      const inner = ring(20, zc + 12);
      ctx.beginPath();
      inner.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.fillStyle = d.broken ? '#5a5144' : '#3c4a48';
      ctx.fill();
      // folhas secas no fundo da cuba
      for (let k = 0; k < 4; k++) {
        const q = P(d.x + (rnd() - 0.5) * 22, d.y + (rnd() - 0.5) * 22, zc + 12);
        ctx.fillStyle = rnd() < 0.5 ? '#8a6a3a' : '#6f5a30';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, 3.4 * cam.zoom, 1.6 * cam.zoom, rnd() * 3, 0, M.TAU);
        ctx.fill();
      }
      if (d.broken) {
        // a beira lascada (um pedaço que falta, do lado da câmera) e a trinca descendo pela coluna
        const a0 = 0.35, a1 = 0.75;
        const notch = [];
        for (let i = 0; i <= 6; i++) {
          const t = a0 + ((a1 - a0) * i) / 6;
          notch.push(P(d.x + Math.cos(t) * 28, d.y + Math.sin(t) * 28, zc + 13));
        }
        for (let i = 6; i >= 0; i--) {
          const t = a0 + ((a1 - a0) * i) / 6;
          notch.push(P(d.x + Math.cos(t) * 21, d.y + Math.sin(t) * 21, zc + 2 + Math.sin((i / 6) * Math.PI) * 4));
        }
        ctx.beginPath();
        notch.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.fillStyle = '#7a7468';
        ctx.fill();
        ctx.strokeStyle = 'rgba(60, 54, 46, 0.75)';
        ctx.lineWidth = Math.max(0.8, 1.3 * cam.zoom);
        ctx.beginPath();
        const c0 = P(d.x + 6, d.y + 15, zc - 2);
        ctx.moveTo(c0.x, c0.y);
        for (let k = 1; k <= 5; k++) {
          const q = P(d.x + 6 + (rnd() - 0.5) * 8, d.y + 15, zc - 2 - k * 13);
          ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
      }
      // a torneirinha (atrás, saindo do fundo da cuba): torta se quebrado
      const tb = { x: d.x - 12, y: d.y - 12, z: zc + 12 };
      const tt = d.broken ? { x: d.x - 4, y: d.y - 20, z: zc + 24 } : { x: d.x - 8, y: d.y - 8, z: zc + 26 };
      tube(ctx, cam, [tb, { x: tb.x, y: tb.y, z: zc + 24 }, tt], 3.2, ink, '#9a9ea2');
      if (d.moss) {
        for (let k = 0; k < 7; k++) {
          const onFront = rnd() < 0.6;
          const q = onFront ? P(d.x - 15 + rnd() * 30, d.y + 15, z0 + rnd() * 60) : P(d.x + 15, d.y - 15 + rnd() * 30, z0 + rnd() * 60);
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(86, 128, 58, 0.85)' : 'rgba(64, 104, 48, 0.8)';
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, (4 + rnd() * 5) * cam.zoom, (6 + rnd() * 8) * cam.zoom, 0, 0, M.TAU);
          ctx.fill();
        }
        for (let k = 0; k < 4; k++) {
          const t = rnd() * M.TAU;
          const q = P(d.x + Math.cos(t) * 24, d.y + Math.sin(t) * 24, zc + 12);
          ctx.fillStyle = 'rgba(86, 128, 58, 0.85)';
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, 5 * cam.zoom, 2.6 * cam.zoom, 0, 0, M.TAU);
          ctx.fill();
        }
      }
      void col;
      grass(ctx, cam, d.x + 18, d.y + 20, z0, 24, rnd, ink);
      grass(ctx, cam, d.x - 20, d.y + 18, z0, 18, rnd, ink);
    },
  };

  // ------------------------------------------------------------------ academia ao ar livre
  // Cano azul pintado, descascado e com ferrugem embaixo; chapinhas no chão; cipó subindo um dos canos e capim nos pés.
  // A caixa do mapa (1,2 × 0,8 m) é o lugar do aparelho; o lado comprido diz a direção dele.
  small.academia = {
    height: (d) => d.h + 10,
    blocks: 0,
    shadow(p, cam, d) {
      const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
      H.lineShadow(p, cam, cx, cy, d.h * 0.8, 10);
    },
    box: (cam, d, z0) => volBox(cam, d.x0 - 20, d.x1 + 20, d.y0 - 20, d.y1 + 20, z0, z0 + d.h + 20, 16),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 2401);
      const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
      const alongX = d.x1 - d.x0 >= d.y1 - d.y0;
      const half = (alongX ? d.x1 - d.x0 : d.y1 - d.y0) / 2;
      // L(a, s, z): a = ao longo do aparelho, s = de lado, z = altura
      const L = (a, s, z) => (alongX ? { x: cx + a, y: cy + s, z: z0 + z } : { x: cx + s, y: cy + a, z: z0 + z });
      const h = d.h;
      const tufts = (pts) => pts.forEach(([a, s]) => {
        const q = L(a, s, 0);
        grass(ctx, cam, q.x, q.y, z0, 18 + rnd() * 8, rnd, ink);
      });
      const vineUp = (a, s, top) => {
        if (!d.vine) return;
        const pts = [];
        for (let j = 0; j <= 9; j++) pts.push(L(a + Math.sin(j * 1.6) * 3, s + 2, (top * j) / 9));
        vine3d(ctx, cam, pts, rnd, ink);
      };
      const rusty = (p, q, n = 3) => d.rust && rust(ctx, cam, L(...p), L(...q), rnd, n);
      if (d.device === 'simulador-caminhada') {
        // simulador de caminhada: o "A" de canos, o guidão em cima e as duas pernas de balanço com os pedais
        const ap = h * 0.92;
        tufts([[-half * 0.8, -10], [half * 0.8, 10]]);
        foot(ctx, cam, L(-half * 0.8, 0, 0).x, L(-half * 0.8, 0, 0).y, z0, ink);
        foot(ctx, cam, L(half * 0.8, 0, 0).x, L(half * 0.8, 0, 0).y, z0, ink);
        // a perna de balanço de trás (longe da câmera) antes do "A"
        const pivot = h * 0.72;
        const legBack = [L(0, -14, pivot), L(-22, -14, 22)];
        tube(ctx, cam, legBack, 3.6, ink);
        tube(ctx, cam, [L(-34, -22, 20), L(-10, -22, 20)], 5, ink, '#8d8f91');
        tube(ctx, cam, [L(-half * 0.8, 0, 0), L(0, 0, ap), L(half * 0.8, 0, 0)], 5.2, ink);
        rusty([-half * 0.8, 0, 0], [0, 0, ap], 4);
        rusty([half * 0.8, 0, 0], [0, 0, ap], 3);
        // guidão: a barra de lado e as duas pegas subindo
        tube(ctx, cam, [L(4, -26, ap + 18), L(0, -26, ap), L(0, 26, ap), L(4, 26, ap + 18)], 3.8, ink);
        // eixo e a perna da frente com o pedal
        tube(ctx, cam, [L(0, -16, pivot), L(0, 16, pivot)], 4.4, ink, '#5d6064');
        tube(ctx, cam, [L(0, 14, pivot), L(24, 14, 22)], 3.6, ink);
        tube(ctx, cam, [L(12, 22, 20), L(36, 22, 20)], 5, ink, '#8d8f91');
        vineUp(-half * 0.8 + 6, 0, ap * 0.8);
        tufts([[0, 18], [half * 0.5, -14]]);
      } else if (d.device === 'remada') {
        // remada: a viga baixa com o banco laranja, o apoio dos pés e as duas alavancas com a pega
        tufts([[-half * 0.85, -8], [half * 0.85, 8]]);
        foot(ctx, cam, L(-half * 0.8, 0, 0).x, L(-half * 0.8, 0, 0).y, z0, ink);
        foot(ctx, cam, L(half * 0.7, 0, 0).x, L(half * 0.7, 0, 0).y, z0, ink);
        // a alavanca de trás (longe) antes da viga
        tube(ctx, cam, [L(half * 0.55, -20, 34), L(half * 0.15, -24, h * 0.66)], 3.6, ink);
        tube(ctx, cam, [L(-half * 0.8, 0, 0), L(-half * 0.8, 0, 32), L(half * 0.7, 0, 32), L(half * 0.7, 0, 0)], 5.2, ink);
        rusty([-half * 0.8, 0, 0], [-half * 0.8, 0, 32], 3);
        rusty([half * 0.7, 0, 0], [half * 0.7, 0, 32], 3);
        // banco (almofada laranja desbotada) e o apoio dos pés
        const s0 = -half * 0.55;
        const seat = (u, v, z) => L(s0 + u, v, z);
        const pad = [seat(-18, -14, 44), seat(18, -14, 44), seat(18, 14, 44), seat(-18, 14, 44)].map((q) => cam.p(q));
        const padSide = [seat(-18, 14, 36), seat(18, 14, 36), seat(18, 14, 44), seat(-18, 14, 44)].map((q) => cam.p(q));
        for (const [pts, col] of [[padSide, '#a85a26'], [pad, '#d77a33']]) {
          ctx.beginPath();
          pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
          ctx.closePath();
          ctx.strokeStyle = INK;
          ctx.lineWidth = ink * 2;
          ctx.stroke();
          ctx.fillStyle = col;
          ctx.fill();
        }
        // rasgo no banco
        const rip = seat(4, 0, 44);
        const rq = cam.p(rip);
        ctx.fillStyle = '#e8d6a8';
        ctx.beginPath();
        ctx.ellipse(rq.x, rq.y, 5 * cam.zoom, 2.4 * cam.zoom, 0.3, 0, M.TAU);
        ctx.fill();
        tube(ctx, cam, [seat(0, 0, 32), seat(0, 0, 36)], 5, ink);
        tube(ctx, cam, [L(half * 0.62, -16, 22), L(half * 0.62, 16, 22)], 4.6, ink, '#8d8f91');
        // a alavanca da frente e a pega
        tube(ctx, cam, [L(half * 0.55, 20, 34), L(half * 0.15, 24, h * 0.66)], 3.6, ink);
        tube(ctx, cam, [L(half * 0.15, -30, h * 0.66), L(half * 0.15, 30, h * 0.66)], 3.4, ink);
        vineUp(half * 0.7, 2, 30);
        tufts([[-half * 0.2, 16], [half * 0.4, -16]]);
      } else {
        // barra: os dois postes, a barra de cima em arco e a barra do meio
        const top = h;
        tufts([[-half * 0.85, -10], [half * 0.85, 10]]);
        foot(ctx, cam, L(-half * 0.85, 0, 0).x, L(-half * 0.85, 0, 0).y, z0, ink);
        foot(ctx, cam, L(half * 0.85, 0, 0).x, L(half * 0.85, 0, 0).y, z0, ink);
        const arc = [L(-half * 0.85, 0, 0), L(-half * 0.85, 0, top - 18)];
        for (let k = 0; k <= 6; k++) {
          const t = Math.PI - (k / 6) * (Math.PI / 2);
          arc.push(L(-half * 0.85 + 18 + Math.cos(t) * 18, 0, top - 18 + Math.sin(t) * 18));
        }
        for (let k = 0; k <= 6; k++) {
          const t = Math.PI / 2 - (k / 6) * (Math.PI / 2);
          arc.push(L(half * 0.85 - 18 + Math.cos(t) * 18, 0, top - 18 + Math.sin(t) * 18));
        }
        arc.push(L(half * 0.85, 0, top - 18), L(half * 0.85, 0, 0));
        tube(ctx, cam, arc, 5.2, ink);
        tube(ctx, cam, [L(-half * 0.85, 0, top * 0.62), L(half * 0.85, 0, top * 0.62)], 4.2, ink);
        rusty([-half * 0.85, 0, 0], [-half * 0.85, 0, top * 0.6], 4);
        rusty([half * 0.85, 0, 0], [half * 0.85, 0, top * 0.6], 4);
        rusty([-half * 0.6, 0, top], [half * 0.6, 0, top], 3);
        vineUp(-half * 0.85, 2, top * 0.95);
        if (d.vine) {
          // um ramo pendurado da barra de cima
          const pts = [];
          for (let j = 0; j <= 5; j++) pts.push(L(-half * 0.2 + Math.sin(j) * 3, 2, top - j * 14));
          vine3d(ctx, cam, pts, rnd, ink);
        }
        tufts([[0, 14]]);
      }
    },
  };
})(window.PD = window.PD || {});
