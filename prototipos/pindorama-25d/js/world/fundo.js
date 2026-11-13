// O fundo do Capão (etapa 4c, aprovada pelo dono em 13/11; referências docs/referencias/capao-fundo-aprovado.jpg e
// capao-campinho-aprovado.jpg): o campinho de várzea com as traves de rede rasgada e o muro grafitado; o viaduto da
// linha lilás quebrado na ponta, com mato em cima, pilares pichados e cipó pendurado; o trem lilás parado lá em cima,
// com plantas no teto; o ônibus velho que virou horta; a barreira da rua fechada e as placas de direção.
// Mesmo traço do resto do cenário (contorno de tinta, lado da sombra mais escuro). Coisa comprida (muro, viaduto,
// ônibus) vem do mapa em pedaços (tmj.js): cada pedaço desenha a sua parte e o desenho continua de um para o outro.
//   PD.city.small[tipo] = { height, blocks, lift, box, shadow, paint }   (o props.js usa como as plantas)
(function (PD) {
  'use strict';
  const M = PD.math;
  const H = PD.props.help;
  const { INK } = H;
  const small = PD.city.small;

  const seeded = (x, y, k) => M.rng((Math.round(x * 3.7) * 73856093) ^ (Math.round(y * 5.3) * 19349663) ^ (k * 83492791));
  function path(ctx, pts) {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
  }
  function fill(ctx, pts, color) {
    path(ctx, pts);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function inkPoly(ctx, pts, color, ink, w = 2.2) {
    path(ctx, pts);
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
  /** Só o traço de tinta (bordas compridas: a emenda entre dois pedaços fica sem risco). */
  function edge(ctx, a, b, ink, w = 1.6) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
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
  /** Caixa na tela de um volume (x0..x1, y0..y1, za..zb). */
  function volBox(cam, x0, x1, y0, y1, za, zb, pad) {
    const pts = [];
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) pts.push(cam.p({ x, y, z: za }), cam.p({ x, y, z: zb }));
    return bboxOf(pts, pad * cam.zoom);
  }
  /** Sombra no chão de uma laje no alto (de za a zb): o pé dela empurrado pela luz, sem tocar o chão embaixo. */
  function slabShadow(p, cam, x0, x1, y0, y1, za, zb) {
    const L = cam.light;
    const pts = [];
    for (const h of [za, zb]) {
      const dx = (-L.x / L.z) * h, dy = (-L.y / L.z) * h;
      for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) pts.push(x + dx, y + dy);
    }
    const S = PD.shapes;
    if (S && S.convexHull && S.polyPath) S.polyPath(S.convexHull(pts), 0, 0, p);
  }
  /** Fio de cipó em 3D (pontos no mundo), com folhinhas. */
  function vine3d(ctx, cam, pts3, rnd, ink) {
    const pts = pts3.map((q) => cam.p(q));
    if (PD.city.vine) PD.city.vine(ctx, pts, rnd, cam.zoom, ink);
  }
  /** Tufo de capim no chão (em pé na tela). */
  function grass(ctx, cam, x, y, z, size, rnd, ink) {
    if (PD.city.grass) PD.city.grass(ctx, cam.p({ x, y, z }), size * cam.zoom, rnd, ink);
  }
  /** Moita (o arbusto da mata) em qualquer altura. */
  function bush(ctx, cam, x, y, z, r, ink) {
    const fl = PD.flora && PD.flora.small.arbusto;
    if (fl) fl.paint(ctx, cam, { kind: 'arbusto', x, y, r, wild: true }, z, ink);
  }
  function fern(ctx, cam, x, y, z, r, ink) {
    const fl = PD.flora && PD.flora.small['planta-samambaia'];
    if (fl) fl.paint(ctx, cam, { kind: 'planta-samambaia', x, y, r }, z, ink);
  }

  // ------------------------------------------------------------------ trave do campinho
  // Tubos brancos descascados (ferrugem), o travessão, as barras de trás que descem até o chão e a rede; a "rasgada"
  // tem um buraco com fios pendurados. A rede fica atrás da boca do gol (o lado contrário de `olhando`).
  small.trave = {
    height: (d) => d.h + 20,
    blocks: 0,
    shadow(p, cam, d) {
      for (const [x, y] of posts(d)) H.lineShadow(p, cam, x, y, d.h, 4);
    },
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + d.h + 10, 18),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 1201);
      const [A, B] = posts(d);
      const bx = d.back.x * d.depth, by = d.back.y * d.depth;
      const h = d.h;
      const P = (x, y, z) => cam.p({ x, y, z: z0 + z });
      // pontos: frente (no chão e no alto) e trás (no chão)
      const fa0 = [A[0], A[1], 0], fa1 = [A[0], A[1], h], fb0 = [B[0], B[1], 0], fb1 = [B[0], B[1], h];
      const ba = [A[0] + bx, A[1] + by, 0], bb = [B[0] + bx, B[1] + by, 0];
      const lerp3 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
      const Q = (v) => P(v[0], v[1], v[2]);
      const torn = d.net === 'rasgada';
      const netCol = 'rgba(232, 228, 216, 0.55)';
      const netW = Math.max(0.8, 1.1 * cam.zoom);
      // buraco da rede rasgada (no pano de trás, perto do meio)
      const hole = (u, v) => torn && Math.hypot((u - 0.58) / 0.22, (v - 0.45) / 0.3) < 1;
      const meshBack = () => {
        // pano inclinado: do travessão (v = 0) até a barra de trás no chão (v = 1)
        ctx.strokeStyle = netCol;
        ctx.lineWidth = netW;
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          ctx.beginPath();
          let pen = false;
          for (let j = 0; j <= 10; j++) {
            const v = j / 10;
            const top = lerp3(fa1, fb1, u), bot = lerp3(ba, bb, u);
            const q = Q(lerp3(top, bot, v));
            if (hole(u, v)) {
              pen = false;
              continue;
            }
            if (pen) ctx.lineTo(q.x, q.y);
            else ctx.moveTo(q.x, q.y);
            pen = true;
          }
          ctx.stroke();
        }
        for (let j = 0; j <= 10; j++) {
          const v = j / 10;
          ctx.beginPath();
          let pen = false;
          for (let i = 0; i <= 12; i++) {
            const u = i / 12;
            const top = lerp3(fa1, fb1, u), bot = lerp3(ba, bb, u);
            const q = Q(lerp3(top, bot, v));
            if (hole(u, v)) {
              pen = false;
              continue;
            }
            if (pen) ctx.lineTo(q.x, q.y);
            else ctx.moveTo(q.x, q.y);
            pen = true;
          }
          ctx.stroke();
        }
        if (torn) {
          // fios soltos pendurados na beira do buraco
          ctx.strokeStyle = 'rgba(232, 228, 216, 0.7)';
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * M.TAU;
            const u = 0.58 + Math.cos(a) * 0.22, v = 0.45 + Math.sin(a) * 0.3;
            const top = lerp3(fa1, fb1, u), bot = lerp3(ba, bb, u);
            const p0 = lerp3(top, bot, v);
            const q0 = Q(p0), q1 = Q([p0[0], p0[1], Math.max(0, p0[2] - 30 - rnd() * 40)]);
            ctx.beginPath();
            ctx.moveTo(q0.x, q0.y);
            ctx.quadraticCurveTo(q0.x + (rnd() - 0.5) * 8 * cam.zoom, (q0.y + q1.y) / 2, q1.x, q1.y);
            ctx.stroke();
          }
        }
      };
      const meshSide = (f0, f1, b0) => {
        // lateral triangular: poste da frente, barra de trás
        ctx.strokeStyle = netCol;
        ctx.lineWidth = netW;
        for (let i = 1; i < 6; i++) {
          const t = i / 6;
          const q0 = Q(lerp3(f0, f1, t)), q1 = Q(lerp3(b0, f1, t));
          ctx.beginPath();
          ctx.moveTo(q0.x, q0.y);
          ctx.lineTo(q1.x, q1.y);
          ctx.stroke();
          const r0 = Q(lerp3(f0, b0, t)), r1 = Q(lerp3(f1, b0, t));
          ctx.beginPath();
          ctx.moveTo(r0.x, r0.y);
          ctx.lineTo(r1.x, r1.y);
          ctx.stroke();
        }
      };
      const tube = (pts) => inkLine(ctx, pts.map(Q), '#e8e4da', Math.max(2.4, 4.6 * cam.zoom), ink * 0.8);
      const frame = () => {
        tube([fa0, fa1, fb1, fb0]);
        // ferrugem: manchas no branco
        if (d.rust) {
          for (let k = 0; k < 9; k++) {
            const t = rnd();
            const which = rnd();
            const v = which < 0.33 ? lerp3(fa0, fa1, t) : which < 0.66 ? lerp3(fb0, fb1, t) : lerp3(fa1, fb1, t);
            const q = Q(v);
            ctx.fillStyle = rnd() < 0.5 ? 'rgba(150, 82, 40, 0.85)' : 'rgba(110, 60, 30, 0.8)';
            ctx.beginPath();
            ctx.ellipse(q.x, q.y, (1.6 + rnd() * 2.4) * cam.zoom, (1.2 + rnd() * 1.6) * cam.zoom, rnd() * 3, 0, M.TAU);
            ctx.fill();
          }
        }
      };
      const stays = () => {
        tube([fa1, ba]);
        tube([fb1, bb]);
        tube([ba, bb]);
      };
      // o que fica mais longe da câmera primeiro (a câmera olha de +x+y)
      const away = d.back.x + d.back.y < 0;
      // as laterais: a de menor (x+y) é a de trás
      const sideA = () => meshSide(fa0, fa1, ba), sideB = () => meshSide(fb0, fb1, bb);
      const farSide = A[0] + A[1] < B[0] + B[1] ? sideA : sideB;
      const nearSide = farSide === sideA ? sideB : sideA;
      // capim em volta dos pés
      for (const v of [fa0, fb0, ba, bb]) grass(ctx, cam, v[0], v[1] + 6, z0, 20, rnd, ink);
      farSide();
      if (away) {
        meshBack();
        stays();
        frame();
      } else {
        frame();
        stays();
        meshBack();
      }
      nearSide();
      if (d.vine) {
        // cipó subindo um poste e correndo pelo travessão
        const pts = [];
        for (let k = 0; k <= 6; k++) pts.push({ x: A[0] + Math.sin(k * 1.3) * 4, y: A[1] + 3, z: z0 + (h * k) / 6 });
        for (let k = 1; k <= 6; k++) {
          const v = lerp3(fa1, fb1, k / 9);
          pts.push({ x: v[0], y: v[1], z: z0 + h + Math.sin(k) * 5 });
        }
        vine3d(ctx, cam, pts, rnd, ink);
      }
    },
  };
  /** Os dois postes da frente da trave ([x, y] de cada). */
  function posts(d) {
    return d.along ? [[d.post.x, d.post.a], [d.post.x, d.post.b]] : [[d.post.a, d.post.y], [d.post.b, d.post.y]];
  }

  // ------------------------------------------------------------------ muro grafitado
  // Concreto claro com capa no alto; o grafite colorido no lado pedido (letras de balão "CAPÃO", um sol e manchas de
  // cor que escorrem), musgo embaixo e cipó caindo de cima. Cada pedaço desenha a sua parte do mural.
  small.muro = {
    fades: true, // fica transparente quando esconde o personagem atrás
    height: (d) => d.h + 10,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, d.h),
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + d.h + 20, 26),
    paint(ctx, cam, d, z0, ink) {
      const w = d.whole;
      const alongY = w.y1 - w.y0 > w.x1 - w.x0;
      const top = z0 + d.h;
      const col = d.color;
      const P = (x, y, z) => cam.p({ x, y, z });
      const last = d.piece === d.pieces - 1;
      const first = d.piece === 0;
      const o = 2; // sobra para os pedaços se encostarem sem fresta
      // as faces viradas para a câmera: a de +x (muro ao longo de y) ou a de +y (muro ao longo de x)
      let face, cap;
      if (alongY) {
        const ya = d.y0 - (first ? 0 : o), yb = d.y1 + (last ? 0 : o);
        face = [P(d.x1, yb, z0), P(d.x1, ya, z0), P(d.x1, ya, top), P(d.x1, yb, top)];
        cap = [P(d.x0, ya, top), P(d.x1, ya, top), P(d.x1, yb, top), P(d.x0, yb, top)];
      } else {
        const xa = d.x0 - (first ? 0 : o), xb = d.x1 + (last ? 0 : o);
        face = [P(xa, d.y1, z0), P(xb, d.y1, z0), P(xb, d.y1, top), P(xa, d.y1, top)];
        cap = [P(xa, d.y0, top), P(xb, d.y0, top), P(xb, d.y1, top), P(xa, d.y1, top)];
      }
      // ponta da frente (a última, na ponta que a câmera vê)
      if (last) {
        const end = alongY
          ? [P(d.x0, d.y1, z0), P(d.x1, d.y1, z0), P(d.x1, d.y1, top), P(d.x0, d.y1, top)]
          : [P(d.x1, d.y1, z0), P(d.x1, d.y0, z0), P(d.x1, d.y0, top), P(d.x1, d.y1, top)];
        inkPoly(ctx, end, M.shade(col, alongY ? -0.08 : -0.24), ink, 2);
      }
      fill(ctx, face, alongY ? M.shade(col, -0.16) : col);
      // o desenho na face (graffiti, musgo), em cm da parede inteira
      const painted = (alongY && d.side === 'leste') || (!alongY && d.side === 'sul');
      const L = alongY ? w.y1 - w.y0 : w.x1 - w.x0;
      const a0 = alongY ? w.y1 - (d.y1 + (last ? 0 : o)) : d.x0 - (first ? 0 : o) - w.x0;
      const a1 = alongY ? w.y1 - (d.y0 - (first ? 0 : o)) : d.x1 + (last ? 0 : o) - w.x0;
      const origin = alongY ? { x: d.x1, y: w.y1, z: top } : { x: w.x0, y: d.y1, z: top };
      const dir = alongY ? { x: 0, y: -1 } : { x: 1, y: 0 };
      H.onWall(ctx, cam, origin, dir, () => {
        ctx.beginPath();
        ctx.rect(a0, 0, a1 - a0, d.h);
        ctx.clip();
        // manchas de chuva escorrendo
        const r = M.rng(Math.round(w.x0 * 7 + w.y0 * 3) + 5);
        ctx.fillStyle = 'rgba(60, 54, 44, 0.12)';
        for (let i = 0; i < Math.ceil(L / 90); i++) ctx.fillRect(r() * L, 10, 10 + r() * 26, 40 + r() * (d.h * 0.6));
        if (painted && d.graffiti) mural(ctx, L, d.h, r);
        if (d.moss) {
          // musgo na base e subindo pelas manchas
          for (let i = 0; i < Math.ceil(L / 40); i++) {
            const x = r() * L;
            const hh = 18 + r() * 50;
            ctx.fillStyle = r() < 0.5 ? 'rgba(78, 120, 52, 0.75)' : 'rgba(58, 98, 44, 0.7)';
            ctx.beginPath();
            ctx.ellipse(x, d.h - hh * 0.4, 16 + r() * 26, hh * 0.6, 0, 0, M.TAU);
            ctx.fill();
          }
        }
      });
      // capa do muro (concreto, um pouco mais claro) e só os traços compridos (a emenda entre pedaços fica sem risco)
      fill(ctx, cap, M.shade(col, 0.12));
      edge(ctx, cap[0], cap[3], ink, 1.2);
      edge(ctx, cap[1], cap[2], ink, 1.2);
      edge(ctx, face[0], face[1], ink, 2);
      edge(ctx, face[3], face[2], ink, 1.4);
      if (alongY) {
        if (first) edge(ctx, cap[0], cap[1], ink, 1.2);
      } else {
        edge(ctx, cap[0], cap[1], ink, 1.2);
        if (first) edge(ctx, face[0], face[3], ink, 1.6);
      }
      // cipó caindo do alto (`vine` = quanto do muro ele cobre) e capim no pé
      const rnd = seeded(d.x0, d.y0, 1301);
      const len = alongY ? d.y1 - d.y0 : d.x1 - d.x0;
      const strands = Math.round((len / 100) * d.vine * 1.6);
      for (let k = 0; k < strands; k++) {
        const t = rnd();
        const down = 60 + rnd() * (d.h * 0.8);
        const pts = [];
        for (let j = 0; j <= 6; j++) {
          const z = top + 4 - (down * j) / 6;
          const wob = Math.sin(j * 1.4 + t * 9) * 6;
          pts.push(alongY ? { x: d.x1 + 3, y: d.y0 + len * t + wob, z } : { x: d.x0 + len * t + wob, y: d.y1 + 3, z });
        }
        vine3d(ctx, cam, pts, rnd, ink);
      }
      for (let k = 0; k < Math.ceil(len / 120); k++) {
        const t = rnd();
        if (alongY) grass(ctx, cam, d.x1 + 8, d.y0 + len * t, z0, 24, rnd, ink);
        else grass(ctx, cam, d.x0 + len * t, d.y1 + 8, z0, 24, rnd, ink);
      }
    },
  };
  /** O mural do campinho: manchas de cor, um sol, as letras de balão "CAPÃO" e pingos de tinta. */
  function mural(ctx, L, Hh, r) {
    // manchas de fundo (azul, verde e rosa), com a beira ondulada
    const blob = (cx, cy, rx, ry, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * M.TAU;
        const k = 1 + Math.sin(a * 3 + cx) * 0.12;
        const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    };
    blob(L * 0.5, Hh * 0.52, L * 0.26, Hh * 0.4, 'rgba(47, 163, 184, 0.92)');
    blob(L * 0.17, Hh * 0.5, L * 0.1, Hh * 0.36, 'rgba(52, 163, 91, 0.9)');
    blob(L * 0.82, Hh * 0.55, L * 0.11, Hh * 0.34, 'rgba(232, 106, 154, 0.9)');
    // pingos escorrendo das manchas
    for (let k = 0; k < 16; k++) {
      const x = L * (0.1 + r() * 0.8);
      ctx.fillStyle = ['#2fa3b8', '#34a35b', '#e86a9a', '#f4b81b'][k % 4];
      ctx.fillRect(x, Hh * (0.72 + r() * 0.1), 5, 14 + r() * 30);
    }
    // o sol do lado esquerdo
    const sx = L * 0.17, sy = Hh * 0.46, sr = Math.min(Hh * 0.2, 46);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * M.TAU;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * sr * 1.2, sy + Math.sin(a) * sr * 1.2);
      ctx.lineTo(sx + Math.cos(a) * sr * 1.65, sy + Math.sin(a) * sr * 1.65);
      ctx.stroke();
    }
    ctx.fillStyle = '#f7d23a';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, M.TAU);
    ctx.fill();
    ctx.stroke();
    // letras de balão: contorno preto grosso, branco por dentro e o degradê rosa-laranja
    const FONT = H.FONT_SIGN || '"Impact", sans-serif';
    const text = 'CAPÃO';
    const size = Math.round(Hh * 0.56);
    const x0 = L * 0.5 - text.length * size * 0.31;
    ctx.save();
    ctx.font = `${size}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    let x = x0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const w = ctx.measureText(ch).width;
      ctx.save();
      ctx.translate(x + w / 2, Hh * 0.52 + Math.sin(i * 1.7) * 8);
      ctx.rotate((i % 2 ? 1 : -1) * 0.07);
      ctx.lineWidth = 22;
      ctx.strokeStyle = INK;
      ctx.strokeText(ch, -w / 2, 0);
      ctx.lineWidth = 11;
      ctx.strokeStyle = '#fbf6ea';
      ctx.strokeText(ch, -w / 2, 0);
      const g = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
      g.addColorStop(0, '#f472b0');
      g.addColorStop(0.55, '#f08a24');
      g.addColorStop(1, '#f4c21c');
      ctx.fillStyle = g;
      ctx.fillText(ch, -w / 2, 0);
      // brilho de balão em cima de cada letra
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-w * 0.12, -size * 0.24, w * 0.18, size * 0.06, -0.3, 0, M.TAU);
      ctx.fill();
      ctx.restore();
      x += w * 0.86;
    }
    ctx.restore();
    // uma estrela e setas de spray do lado direito
    ctx.strokeStyle = '#1b1720';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    const ax = L * 0.84, ay = Hh * 0.5;
    ctx.beginPath();
    ctx.moveTo(ax - 50, ay + 30);
    ctx.quadraticCurveTo(ax, ay - 40, ax + 50, ay - 10);
    ctx.moveTo(ax + 50, ay - 10);
    ctx.lineTo(ax + 28, ay - 28);
    ctx.moveTo(ax + 50, ay - 10);
    ctx.lineTo(ax + 30, ay + 8);
    ctx.stroke();
  }

  // ------------------------------------------------------------------ viaduto (o tabuleiro, em pedaços de 4 m)
  // Laje de concreto no alto (de `z` a `z + thick`), com a mureta do fundo, o leito do trilho (brita, dormentes e os
  // dois trilhos), mato e arvorezinhas onde o trem não está; a face da frente manchada, com musgo e cipó curto.
  // A ponta `quebrado` termina em pedaços com o ferro aparecendo. A mureta da frente é outro objeto (viaduto-mureta),
  // desenhado depois do trem (ela fica na frente da base dele).
  const CONCRETE = { face: '#a7a296', side: '#8c877c', top: '#bdb8ab', dark: '#7c776d' };
  const TRACK = { ballast: '#8d8578', sleeper: '#5e4a38', rail: '#c9c5bd' };
  small.viaduto = {
    height: (d) => d.z + d.thick + 380,
    blocks: 0,
    lift: () => 1,
    shadow: (p, cam, d) => slabShadow(p, cam, d.x0, d.x1, d.y0, d.y1, d.z, d.z + d.thick + 70),
    box(cam, d, z0) {
      const zb = z0 + d.z;
      const extra = d.hug ? 260 : 0;
      return volBox(cam, d.x0 - extra, d.x1 + (d.extend || 0), d.y0, d.y1 + 60, d.hug ? z0 : zb - 200, zb + d.thick + (d.trees ? 420 : 160), 30);
    },
    paint(ctx, cam, d, z0, ink) {
      const zb = z0 + d.z;
      const zt = zb + d.thick;
      const P = (x, y, z) => cam.p({ x, y, z });
      const rnd = seeded(d.x0, d.y0, 1401);
      const w = d.whole;
      const first = d.piece === 0, last = d.piece === d.pieces - 1;
      const brokenHere = first && d.broken === 'oeste';
      const o = 2;
      // na beira do mapa o tabuleiro segue mata adentro (`extend`), sem a ponta cortada no ar
      const xa = d.x0 - (first ? 0 : o), xb = d.x1 + (last ? d.extend || 0 : o);
      const yN = d.y0, yS = d.y1;
      const wallT = 18, wallH = 70;
      // 1) a mureta do fundo (a face de dentro, virada para a câmera)
      fill(ctx, [P(xa, yN + wallT, zt), P(xb, yN + wallT, zt), P(xb, yN + wallT, zt + wallH), P(xa, yN + wallT, zt + wallH)], CONCRETE.face);
      fill(ctx, [P(xa, yN, zt + wallH), P(xb, yN, zt + wallH), P(xb, yN + wallT, zt + wallH), P(xa, yN + wallT, zt + wallH)], CONCRETE.top);
      edge(ctx, P(xa, yN, zt + wallH), P(xb, yN, zt + wallH), ink, 1.6);
      edge(ctx, P(xa, yN + wallT, zt + wallH), P(xb, yN + wallT, zt + wallH), ink, 1);
      // 2) o leito: brita, dormentes e trilhos
      const bed = [P(xa, yN + wallT, zt), P(xb, yN + wallT, zt), P(xb, yS - wallT, zt), P(xa, yS - wallT, zt)];
      fill(ctx, bed, TRACK.ballast);
      ctx.save();
      path(ctx, bed);
      ctx.clip();
      for (let i = 0; i < 70; i++) {
        const q = P(d.x0 + rnd() * (d.x1 - d.x0), yN + wallT + rnd() * (yS - yN - 2 * wallT), zt);
        ctx.fillStyle = rnd() < 0.5 ? '#6f685e' : '#a39b8d';
        ctx.fillRect(q.x, q.y, 2.2 * cam.zoom, 1.6 * cam.zoom);
      }
      const ym = (yN + yS) / 2;
      const gauge = 72;
      for (let x = Math.ceil(d.x0 / 60) * 60; x < xb; x += 60) {
        fill(ctx, [P(x - 10, ym - 120, zt + 1), P(x + 10, ym - 120, zt + 1), P(x + 10, ym + 120, zt + 1), P(x - 10, ym + 120, zt + 1)], TRACK.sleeper);
      }
      for (const s of [-gauge, gauge]) {
        const a = P(xa, ym + s, zt + 9), b = P(xb, ym + s, zt + 9);
        ctx.strokeStyle = '#3a3630';
        ctx.lineWidth = Math.max(1.4, 3.4 * cam.zoom);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y + 1.5 * cam.zoom);
        ctx.lineTo(b.x, b.y + 1.5 * cam.zoom);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(150, 90, 50, 0.95)';
        ctx.lineWidth = Math.max(1, 2.2 * cam.zoom);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
      // mato tomando o leito, e arvorezinhas onde o trem não está
      if (d.weeds) {
        for (let k = 0; k < 7; k++) grass(ctx, cam, d.x0 + rnd() * (d.x1 - d.x0), yN + wallT + 10 + rnd() * (yS - yN - 2 * wallT - 20), zt, 22 + rnd() * 10, rnd, ink);
        for (let k = 0; k < 2; k++) fern(ctx, cam, d.x0 + rnd() * (d.x1 - d.x0), yN + 40 + rnd() * 60, zt, 34 + rnd() * 14, ink);
      }
      if (d.trees && !d.train) {
        const n = 1 + Math.floor(rnd() * 2);
        for (let k = 0; k < n; k++) bush(ctx, cam, d.x0 + 60 + rnd() * (d.x1 - d.x0 - 120), yN + 90 + rnd() * 150, zt, 48 + rnd() * 30, ink);
        if (rnd() < 0.55) H.roofTree(ctx, cam, d.x0 + 100 + rnd() * (d.x1 - d.x0 - 200), yN + 130 + rnd() * 100, zt, ink);
      }
      // 3) a face da frente do tabuleiro (de zb a zt) com o friso de baixo
      const face = [P(xa, yS, zb), P(xb, yS, zb), P(xb, yS, zt), P(xa, yS, zt)];
      fill(ctx, face, CONCRETE.face);
      H.onWall(ctx, cam, { x: w.x0, y: yS, z: zt }, { x: 1, y: 0 }, () => {
        ctx.beginPath();
        ctx.rect(xa - w.x0, 0, xb - xa, d.thick);
        ctx.clip();
        const r = M.rng(Math.round(d.x0) + 77);
        // friso escuro embaixo e manchas de água escorrendo
        ctx.fillStyle = 'rgba(70, 64, 56, 0.35)';
        ctx.fillRect(xa - w.x0, d.thick - 26, xb - xa, 26);
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = r() < 0.5 ? 'rgba(60, 56, 48, 0.18)' : 'rgba(70, 100, 50, 0.22)';
          ctx.fillRect(d.x0 - w.x0 + r() * (d.x1 - d.x0), 0, 8 + r() * 20, 30 + r() * (d.thick - 20));
        }
        if (r() < 0.35) {
          // pichação comprida na face (riscos pontudos, sem palavra de ninguém)
          ctx.save();
          ctx.translate(d.x0 - w.x0, 0);
          if (H.pixo) H.pixo(ctx, d.x1 - d.x0, 26, r, 0.7);
          ctx.restore();
        }
      });
      edge(ctx, face[0], face[1], ink, 2.2);
      edge(ctx, face[3], face[2], ink, 1.2);
      // ponta do leste (a última, que a câmera vê), se ela não seguir para fora do mapa
      if (last && !brokenHere && !d.extend) {
        inkPoly(ctx, [P(d.x1, yS, zb), P(d.x1, yN, zb), P(d.x1, yN, zt + wallH), P(d.x1, yS, zt + wallH)], CONCRETE.side, ink, 2);
      }
      // cipó curto caindo da beirada de baixo
      const strands = Math.round(((d.x1 - d.x0) / 100) * d.vine * 1.4);
      for (let k = 0; k < strands; k++) {
        const x = d.x0 + rnd() * (d.x1 - d.x0);
        const down = 50 + rnd() * 140;
        const pts = [];
        for (let j = 0; j <= 5; j++) pts.push({ x: x + Math.sin(j * 1.3 + k) * 6, y: yS + 3, z: zt - (d.thick + down) * (j / 5) });
        vine3d(ctx, cam, pts, rnd, ink);
      }
      // o que segue para fora do mapa some aos poucos na mata
      if (last && d.extend) fadeOut(ctx, cam, d.x1 + d.extend * 0.25, d.x1 + d.extend, d.y0 - 40, d.y1 + 40, zb - 400, zt + 600);
      // 4) a ponta quebrada: recorta um contorno irregular, mostra o concreto partido e o ferro torto
      if (brokenHere) brokenEnd(ctx, cam, d, zb, zt, wallH, ink, rnd);
      // 5) a figueira que abraça o viaduto: raízes grossas passando por cima da ponta e descendo pela frente
      if (d.hug) hugRoots(ctx, cam, d, zb, zt, wallH, ink);
    },
  };
  /** Apaga aos poucos (de x0 a x1) o que já foi desenhado: some no escuro em vez de terminar cortado. */
  function fadeOut(ctx, cam, x0, x1, y0, y1, za, zb) {
    const P = (x, y, z) => cam.p({ x, y, z });
    const a = P(x0, (y0 + y1) / 2, (za + zb) / 2), b = P(x1, (y0 + y1) / 2, (za + zb) / 2);
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g;
    const pts = [P(x0, y1, za), P(x1 + 200, y1, za), P(x1 + 200, y0, za), P(x1 + 200, y0, zb), P(x0, y0, zb), P(x0, y1, zb)];
    path(ctx, pts);
    ctx.fill();
    ctx.restore();
  }
  function brokenEnd(ctx, cam, d, zb, zt, wallH, ink, rnd) {
    const P = (x, y, z) => cam.p({ x, y, z });
    // contorno da quebra: x varia com a altura e com a profundidade
    const jag = (t) => d.x0 + 30 + Math.abs(Math.sin(t * 9.1)) * 70 + Math.sin(t * 23) * 18;
    const zs = [zb - 10, zb + 30, zb + 70, zt - 20, zt + 20, zt + wallH + 10];
    // apaga o que passou da quebra (frente e topo)
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const cut = [P(d.x0 - 40, d.y1 + 30, zb - 60)];
    zs.forEach((z, i) => cut.push(P(jag(i * 0.37), d.y1 + 30, z)));
    for (let k = 0; k <= 6; k++) cut.push(P(jag(1 + k * 0.29), d.y1 - ((d.y1 - d.y0) * k) / 6, zt + wallH + 10));
    cut.push(P(d.x0 - 40, d.y0 - 30, zt + wallH + 60));
    path(ctx, cut);
    ctx.fill();
    ctx.restore();
    // concreto partido (mais claro) na beira da quebra, na frente
    const rim = [];
    zs.slice(0, 4).forEach((z, i) => rim.push(P(jag(i * 0.37), d.y1, z)));
    const rim2 = rim.map((q) => ({ x: q.x + 7 * cam.zoom, y: q.y - 2 * cam.zoom }));
    inkPoly(ctx, [...rim, ...rim2.reverse()], '#cfc9bb', ink, 1.2);
    // ferro torto saindo da quebra
    ctx.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const z = zb + 12 + rnd() * (d.thick - 20);
      const y = d.y1 - 10 - rnd() * (d.y1 - d.y0 - 20);
      const p0 = P(jag(rnd()) + 6, y, z);
      const p1 = P(jag(rnd()) - 40 - rnd() * 50, y + (rnd() - 0.5) * 30, z - rnd() * 40);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.4, 3 * cam.zoom);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.strokeStyle = '#8a4a2a';
      ctx.lineWidth = Math.max(0.9, 1.6 * cam.zoom);
      ctx.stroke();
    }
    // pedaços que ficaram pendurados no ferro
    for (let k = 0; k < 3; k++) {
      const x = d.x0 + 10 + rnd() * 50, y = d.y1 - 40 - rnd() * 200, z = zb - 30 - rnd() * 50;
      H.box(ctx, cam, x - 18, x + 18, y - 14, y + 14, z, z + 24, { front: CONCRETE.face, side: CONCRETE.side, top: CONCRETE.top }, ink);
    }
  }
  function hugRoots(ctx, cam, d, zb, zt, wallH, ink) {
    const P = (x, y, z) => cam.p({ x, y, z });
    const rnd = seeded(d.hug.x, d.hug.y, 1501);
    const bark = (H.BARK && H.BARK.figueira) || ['#7c6a57', '#574838'];
    const root = (pts, w) => {
      const q = pts.map((v) => P(v[0], v[1], v[2]));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = INK;
      ctx.lineWidth = (w + 3) * cam.zoom;
      ctx.stroke();
      ctx.strokeStyle = bark[0];
      ctx.lineWidth = w * cam.zoom;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 240, 210, 0.25)';
      ctx.lineWidth = Math.max(1, w * 0.25 * cam.zoom);
      ctx.beginPath();
      q.forEach((p, i) => (i ? ctx.lineTo(p.x - w * 0.2 * cam.zoom, p.y - w * 0.2 * cam.zoom) : ctx.moveTo(p.x - w * 0.2 * cam.zoom, p.y - w * 0.2 * cam.zoom)));
      ctx.stroke();
    };
    const sx = d.hug.x + (d.hug.trunk || 100) * 0.6;
    // três raízes grossas: saem do tronco no alto, passam por cima da ponta e descem pela frente
    for (let k = 0; k < 3; k++) {
      const y = d.y0 + 70 + k * ((d.y1 - d.y0 - 140) / 2);
      const x = d.x0 + 120 + k * 60 + rnd() * 30;
      root([[sx, d.hug.y - 60 - k * 40, zt + 120 + k * 30], [x - 60, y, zt + wallH + 16], [x, y + 40, zt + 8], [x + 20, d.y1 + 6, zt - 10], [x + 30 + rnd() * 20, d.y1 + 10, zb - 60 - rnd() * 120]], 15 - k * 2);
    }
    // duas raízes compridas: abraçam a frente do tabuleiro e descem até o chão (aparecem embaixo da copa)
    const z0 = zb - (d.z || 800);
    for (let k = 0; k < 2; k++) {
      const x = d.x0 + 230 + k * 110;
      const foot = [x + 45 + k * 20, d.y1 + 34, z0];
      root([[sx, d.hug.y - 30, zt + 60], [d.x0 + 40 + k * 40, d.y1 + 8, zt + 10], [x - 60, d.y1 + 12, zb + 30], [x - 20, d.y1 + 16, zb - 120], [x + 30, d.y1 + 20, z0 + 420], [x + 10, d.y1 + 26, z0 + 200], foot], 24 - k * 6);
      // o pé da raiz abre no chão
      for (const [dx, dy] of [[-50, 30], [40, 40], [10, -30]]) root([[foot[0], foot[1], z0 + 40], [foot[0] + dx, foot[1] + dy, z0]], 10 - k * 2);
    }
    // raízes finas penduradas (as aéreas da figueira)
    ctx.strokeStyle = bark[1];
    for (let k = 0; k < 8; k++) {
      const x = d.x0 + 40 + rnd() * 220;
      const a = P(x, d.y1 + 4, zb + 4), b = P(x + (rnd() - 0.5) * 20, d.y1 + 4, zb - 120 - rnd() * 260);
      ctx.lineWidth = Math.max(1, 1.8 * cam.zoom);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(a.x + (rnd() - 0.5) * 10 * cam.zoom, (a.y + b.y) / 2, b.x, b.y);
      ctx.stroke();
    }
  }

  // a mureta da frente do viaduto (desenhada depois do trem: fica na frente da base dele)
  small['viaduto-mureta'] = {
    height: (d) => d.z + d.thick + 100,
    blocks: 0,
    lift: () => 2,
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1 + (d.extend || 0), d.y0, d.y1, z0 + d.z, z0 + d.z + d.thick + 120, 20),
    paint(ctx, cam, d, z0, ink) {
      const zt = z0 + d.z + d.thick;
      const H2 = 70;
      const P = (x, y, z) => cam.p({ x, y, z });
      const first = d.piece === 0, last = d.piece === d.pieces - 1;
      const o = 2;
      const xa = d.x0 - (first ? 0 : o), xb = d.x1 + (last ? d.extend || 0 : o);
      const brokenHere = first && d.broken === 'oeste';
      const x0 = brokenHere ? d.x0 + 110 : xa;
      // face de fora (continua a face do tabuleiro) e o alto
      const face = [P(x0, d.y1, zt - 1), P(xb, d.y1, zt - 1), P(xb, d.y1, zt + H2), P(x0, d.y1, zt + H2)];
      fill(ctx, face, CONCRETE.face);
      const top = [P(x0, d.y0, zt + H2), P(xb, d.y0, zt + H2), P(xb, d.y1, zt + H2), P(x0, d.y1, zt + H2)];
      fill(ctx, top, CONCRETE.top);
      edge(ctx, top[0], top[1], ink, 1);
      edge(ctx, top[3], top[2], ink, 1.6);
      if (last && !d.extend) inkPoly(ctx, [P(d.x1, d.y1, zt), P(d.x1, d.y0, zt), P(d.x1, d.y0, zt + H2), P(d.x1, d.y1, zt + H2)], CONCRETE.side, ink, 1.6);
      if (brokenHere) inkPoly(ctx, [P(x0, d.y1, zt), P(x0, d.y0, zt + 20), P(x0, d.y0, zt + H2), P(x0, d.y1, zt + H2)], '#cfc9bb', ink, 1.2);
      // manchas, musgo e capim em cima
      const rnd = seeded(d.x0, d.y0, 1601);
      H.onWall(ctx, cam, { x: x0, y: d.y1, z: zt + H2 }, { x: 1, y: 0 }, () => {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(60, 56, 48, 0.16)' : 'rgba(70, 110, 50, 0.3)';
          ctx.fillRect(rnd() * (xb - x0), 0, 10 + rnd() * 24, 20 + rnd() * 50);
        }
      });
      if (d.weeds) for (let k = 0; k < 3; k++) grass(ctx, cam, x0 + rnd() * (xb - x0), (d.y0 + d.y1) / 2, zt + H2, 18 + rnd() * 10, rnd, ink);
      if (last && d.extend) fadeOut(ctx, cam, d.x1 + d.extend * 0.25, d.x1 + d.extend, d.y0 - 40, d.y1 + 40, zt - 600, zt + 400);
    },
  };

  // ------------------------------------------------------------------ pilar do viaduto
  small['pilar-viaduto'] = {
    fades: true, // fica transparente quando esconde o personagem atrás
    height: (d) => d.h,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, d.h),
    box: (cam, d, z0) => volBox(cam, d.x0 - 30, d.x1 + 30, d.y0 - 30, d.y1 + 30, z0, z0 + d.h, 20),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const rnd = seeded(d.x0, d.y0, 1701);
      const capH = 60, capOut = 26;
      const zc = z0 + d.h - capH;
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, z0, zc, { front: CONCRETE.face, side: CONCRETE.side, top: CONCRETE.top }, ink);
      H.box(ctx, cam, d.x0 - capOut, d.x1 + capOut, d.y0 - capOut, d.y1 + capOut, zc, z0 + d.h, { front: M.shade(CONCRETE.face, 0.05), side: CONCRETE.side, top: CONCRETE.top }, ink);
      const W = d.x1 - d.x0, D = d.y1 - d.y0;
      const hh = d.h - capH;
      // face da frente (+y): manchas, pichação e musgo
      H.onWall(ctx, cam, { x: d.x0, y: d.y1, z: zc }, { x: 1, y: 0 }, () => {
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = 'rgba(60, 56, 48, 0.16)';
          ctx.fillRect(rnd() * W, 0, 6 + rnd() * 14, 60 + rnd() * hh * 0.6);
        }
        if (d.pixo) tags(ctx, W, hh * 0.55, rnd);
        if (d.moss) moss(ctx, W, hh, rnd);
      });
      H.onWall(ctx, cam, { x: d.x1, y: d.y1, z: zc }, { x: 0, y: -1 }, () => {
        ctx.fillStyle = 'rgba(30, 26, 22, 0.12)';
        ctx.fillRect(0, 0, D, hh);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = 'rgba(60, 56, 48, 0.16)';
          ctx.fillRect(rnd() * D, 0, 6 + rnd() * 14, 60 + rnd() * hh * 0.6);
        }
        if (d.moss) moss(ctx, D, hh, rnd);
      });
      // cipó subindo da base (`vine` = quanto da altura ele alcança)
      const n = 2 + Math.round(d.vine * 2);
      for (let k = 0; k < n; k++) {
        const onFront = k % 2 === 0;
        const t = 0.15 + rnd() * 0.7;
        const up = hh * (0.3 + rnd() * 0.65 * Math.max(0.3, d.vine));
        const pts = [];
        for (let j = 0; j <= 8; j++) {
          const z = z0 + (up * j) / 8;
          const wob = Math.sin(j * 1.1 + k * 2) * 8;
          pts.push(onFront ? { x: d.x0 + W * t + wob, y: d.y1 + 3, z } : { x: d.x1 + 3, y: d.y0 + D * t + wob, z });
        }
        vine3d(ctx, cam, pts, rnd, ink);
      }
      for (let k = 0; k < 3; k++) grass(ctx, cam, d.x0 + rnd() * W, d.y1 + 10, z0, 24, rnd, ink);
      void P;
    },
  };
  /** Pichação: letras altas e pontudas em fila (sem palavra de ninguém), em cm da parede. */
  function tags(ctx, W, y, r) {
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    for (let row = 0; row < 2; row++) {
      ctx.strokeStyle = row ? 'rgba(120, 24, 28, 0.85)' : 'rgba(17, 16, 20, 0.85)';
      ctx.lineWidth = 5;
      let x = 12 + r() * 10;
      const yy = y + row * 64;
      while (x < W - 22) {
        const h = 36 + r() * 18;
        ctx.beginPath();
        const k = r();
        if (k < 0.4) {
          ctx.moveTo(x, yy + h);
          ctx.lineTo(x + 6, yy);
          ctx.lineTo(x + 12, yy + h);
        } else if (k < 0.7) {
          ctx.moveTo(x + 12, yy);
          ctx.lineTo(x, yy);
          ctx.lineTo(x, yy + h);
          ctx.lineTo(x + 12, yy + h);
        } else {
          ctx.moveTo(x, yy + h);
          ctx.lineTo(x, yy);
          ctx.lineTo(x + 12, yy + h * 0.4);
          ctx.lineTo(x + 12, yy + h);
        }
        ctx.stroke();
        x += 18 + r() * 6;
      }
    }
  }
  /** Musgo na base de uma parede (em cm da parede, `Hh` = altura). */
  function moss(ctx, W, Hh, r) {
    for (let i = 0; i < Math.ceil(W / 26); i++) {
      const x = r() * W;
      const hh = 20 + r() * 70;
      ctx.fillStyle = r() < 0.5 ? 'rgba(78, 120, 52, 0.75)' : 'rgba(58, 98, 44, 0.7)';
      ctx.beginPath();
      ctx.ellipse(x, Hh - hh * 0.35, 10 + r() * 16, hh * 0.55, 0, 0, M.TAU);
      ctx.fill();
    }
  }

  // ------------------------------------------------------------------ cipó pendurado do viaduto
  small.cipo = {
    height: (d) => d.top,
    blocks: 0,
    box: (cam, d, z0) => volBox(cam, d.x - 70, d.x + 70, d.y - 10, d.y + 10, z0 + d.top - d.len - 30, z0 + d.top + 10, 16),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x, d.y, 1801);
      const n = 3 + Math.floor(rnd() * 2);
      for (let k = 0; k < n; k++) {
        const ox = (rnd() - 0.5) * 70;
        const down = d.len * (0.55 + rnd() * 0.45);
        const pts = [];
        for (let j = 0; j <= 10; j++) {
          const t = j / 10;
          pts.push({ x: d.x + ox + Math.sin(t * 5 + k) * 10 * t, y: d.y, z: z0 + d.top - down * t });
        }
        vine3d(ctx, cam, pts, rnd, ink);
      }
    },
  };

  // ------------------------------------------------------------------ vagão do trem lilás
  // Caixa lilás com o teto arredondado, faixa clara, janelas (algumas quebradas, com planta saindo), portas, sujeira e
  // cipó caindo do teto; plantas e uma arvorezinha no teto. A cabine (vidro grande, faróis) fica na ponta leste.
  small.vagao = {
    height: (d) => d.base + d.h + 300,
    blocks: 0,
    lift: () => 2,
    shadow: (p, cam, d) => slabShadow(p, cam, d.x0 + 25, d.x1 - 25, d.y0, d.y1, d.base, d.base + d.h),
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1 + 30, d.y0, d.y1, z0 + d.base, z0 + d.base + d.h + (d.plants ? 420 : 40), 24),
    paint(ctx, cam, d, z0, ink) {
      const zb = z0 + d.base + 18;
      const zt = z0 + d.base + d.h;
      const P = (x, y, z) => cam.p({ x, y, z });
      const rnd = seeded(d.x0, d.y0, 1901);
      const cab = d.index === d.count - 1;
      const x0 = d.x0 + 25, x1 = d.x1 - 25;
      const yN = d.y0, yS = d.y1;
      const col = d.color;
      const dark = M.shade(col, -0.35), light = M.shade(col, 0.25);
      const bev = 26; // o arredondado do teto
      // sanfona até o próximo vagão (escura)
      if (!cab) H.box(ctx, cam, x1 - 5, x1 + 30, yN + 40, yS - 40, zb + 10, zt - 30, { front: '#2a2628', side: '#1f1c1e', top: '#3a3436' }, ink);
      // ponta leste (a cabine ou a ponta comum)
      const endFace = [P(x1, yS - 6, zb), P(x1, yN + 6, zb), P(x1, yN + 6, zt - bev), P(x1, yS - 6, zt - bev)];
      inkPoly(ctx, endFace, M.shade(col, -0.22), ink, 2);
      if (cab) {
        // vidro grande, faróis e o letreiro escuro em cima
        H.onWall(ctx, cam, { x: x1, y: yS - 6, z: zt - bev }, { x: 0, y: -1 }, () => {
          const Wd = yS - yN - 12, Hh = zt - bev - zb;
          ctx.fillStyle = INK;
          ctx.fillRect(Wd * 0.12 - 4, Hh * 0.12 - 4, Wd * 0.76 + 8, Hh * 0.42 + 8);
          const g = ctx.createLinearGradient(0, Hh * 0.12, 0, Hh * 0.54);
          g.addColorStop(0, '#5b6f86');
          g.addColorStop(1, '#25303e');
          ctx.fillStyle = g;
          ctx.fillRect(Wd * 0.12, Hh * 0.12, Wd * 0.76, Hh * 0.42);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.beginPath();
          ctx.moveTo(Wd * 0.2, Hh * 0.14);
          ctx.lineTo(Wd * 0.34, Hh * 0.14);
          ctx.lineTo(Wd * 0.22, Hh * 0.5);
          ctx.lineTo(Wd * 0.14, Hh * 0.5);
          ctx.closePath();
          ctx.fill();
          if (d.broken) {
            ctx.strokeStyle = 'rgba(230, 236, 240, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const cx = Wd * 0.62, cy = Hh * 0.3;
            for (let k = 0; k < 6; k++) {
              const a = (k / 6) * M.TAU;
              ctx.moveTo(cx, cy);
              ctx.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 20);
            }
            ctx.stroke();
          }
          ctx.fillStyle = '#1d1a1c';
          ctx.fillRect(Wd * 0.3, Hh * 0.02, Wd * 0.4, Hh * 0.07);
          for (const fx of [0.2, 0.8]) {
            ctx.fillStyle = INK;
            ctx.beginPath();
            ctx.arc(Wd * fx, Hh * 0.72, 11, 0, M.TAU);
            ctx.fill();
            ctx.fillStyle = '#e9e2c4';
            ctx.beginPath();
            ctx.arc(Wd * fx, Hh * 0.72, 7.5, 0, M.TAU);
            ctx.fill();
          }
          ctx.fillStyle = dark;
          ctx.fillRect(0, Hh * 0.84, Wd, Hh * 0.16);
        });
      }
      // lado de fora (+y): o corpo, com a faixa e as janelas
      const side = [P(x0, yS, zb), P(x1, yS, zb), P(x1, yS, zt - bev), P(x0, yS, zt - bev)];
      inkPoly(ctx, side, col, ink, 2.2);
      H.onWall(ctx, cam, { x: x0, y: yS, z: zt - bev }, { x: 1, y: 0 }, () => {
        const L = x1 - x0, Hh = zt - bev - zb;
        // saia escura embaixo e a faixa clara
        ctx.fillStyle = dark;
        ctx.fillRect(0, Hh - 46, L, 46);
        ctx.fillStyle = '#ece8f2';
        ctx.fillRect(0, Hh * 0.62, L, 9);
        // portas (duas folhas) e janelas entre elas
        const doors = [L * 0.2, L * 0.76];
        const doorW = 120;
        for (const dx of doors) {
          ctx.fillStyle = INK;
          ctx.fillRect(dx - doorW / 2 - 3, Hh * 0.08 - 3, doorW + 6, Hh * 0.92);
          ctx.fillStyle = M.shade(col, -0.12);
          ctx.fillRect(dx - doorW / 2, Hh * 0.08, doorW, Hh * 0.9);
          ctx.fillStyle = '#2b3542';
          ctx.fillRect(dx - doorW / 2 + 12, Hh * 0.14, doorW / 2 - 18, Hh * 0.38);
          ctx.fillRect(dx + 6, Hh * 0.14, doorW / 2 - 18, Hh * 0.38);
          ctx.fillStyle = INK;
          ctx.fillRect(dx - 1.5, Hh * 0.08, 3, Hh * 0.9);
        }
        const wins = [];
        for (let k = 0; k < 4; k++) {
          const a = L * 0.2 + doorW / 2 + 20 + k * ((L * 0.56 - doorW - 40) / 4);
          wins.push(a);
        }
        wins.push(12, L - 12 - (L * 0.2 - doorW / 2 - 40));
        const winW = (L * 0.56 - doorW - 40) / 4 - 16;
        for (const wx of wins) {
          const ww = wx === 12 || wx > L * 0.8 ? L * 0.2 - doorW / 2 - 40 : winW;
          ctx.fillStyle = INK;
          ctx.fillRect(wx - 3, Hh * 0.16 - 3, ww + 6, Hh * 0.4 + 6);
          ctx.fillStyle = '#2b3542';
          ctx.fillRect(wx, Hh * 0.16, ww, Hh * 0.4);
          ctx.fillStyle = 'rgba(200, 214, 230, 0.22)';
          ctx.beginPath();
          ctx.moveTo(wx + ww * 0.1, Hh * 0.16);
          ctx.lineTo(wx + ww * 0.3, Hh * 0.16);
          ctx.lineTo(wx + ww * 0.14, Hh * 0.56);
          ctx.lineTo(wx, Hh * 0.56);
          ctx.closePath();
          ctx.fill();
          if (d.broken && rnd() < 0.45) {
            // vidro quebrado: buraco escuro com bico e uma folha saindo
            ctx.fillStyle = '#121418';
            ctx.beginPath();
            const cx = wx + ww * (0.3 + rnd() * 0.4), cy = Hh * (0.26 + rnd() * 0.2);
            for (let k = 0; k < 9; k++) {
              const a = (k / 9) * M.TAU;
              const rr = (k % 2 ? 0.45 : 1) * Math.min(ww, Hh * 0.4) * 0.42;
              const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
              if (k) ctx.lineTo(x, y);
              else ctx.moveTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#4f8a3c';
            ctx.beginPath();
            ctx.ellipse(cx + 6, cy + 4, 14, 6, -0.6, 0, M.TAU);
            ctx.fill();
          }
        }
        // sujeira e ferrugem escorrendo
        for (let k = 0; k < 7; k++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(60, 40, 50, 0.16)' : 'rgba(130, 80, 40, 0.18)';
          ctx.fillRect(rnd() * L, Hh * 0.6, 8 + rnd() * 18, Hh * 0.4);
        }
      });
      // o teto arredondado: a curva (mais clara) e o alto
      const shoulder = [P(x0, yS, zt - bev), P(x1, yS, zt - bev), P(x1, yS - bev, zt), P(x0, yS - bev, zt)];
      inkPoly(ctx, shoulder, light, ink, 1.6);
      const roof = [P(x0, yN + 6, zt), P(x1, yN + 6, zt), P(x1, yS - bev, zt), P(x0, yS - bev, zt)];
      inkPoly(ctx, roof, M.shade(col, 0.1), ink, 1.8);
      // caixas do ar no teto
      H.box(ctx, cam, x0 + 120, x0 + 220, yN + 50, yN + 150, zt, zt + 26, { front: '#b9b4bd', side: '#9a95a0', top: '#d2ced6' }, ink);
      if (d.plants) {
        // terra que juntou no teto, moitas e (em dois vagões) uma arvorezinha
        const soil = [P(x0 + 40, yN + 30, zt + 1), P(x1 - 60, yN + 30, zt + 1), P(x1 - 60, yS - bev - 10, zt + 1), P(x0 + 40, yS - bev - 10, zt + 1)];
        fill(ctx, soil, 'rgba(92, 72, 50, 0.55)');
        const n = 2 + Math.floor(rnd() * 2);
        for (let k = 0; k < n; k++) bush(ctx, cam, x0 + 80 + rnd() * (x1 - x0 - 160), yN + 60 + rnd() * (yS - yN - 130), zt, 40 + rnd() * 22, ink);
        if (d.index !== 1) H.roofTree(ctx, cam, x0 + (x1 - x0) * (0.35 + rnd() * 0.3), (yN + yS) / 2 - 20, zt, ink);
        fern(ctx, cam, x1 - 120, yS - bev - 40, zt, 30, ink);
      }
      if (d.vine) {
        // cipó caindo da beirada do teto
        for (let k = 0; k < 4; k++) {
          const x = x0 + 40 + rnd() * (x1 - x0 - 80);
          const down = 50 + rnd() * (d.h * 0.7);
          const pts = [];
          for (let j = 0; j <= 6; j++) pts.push({ x: x + Math.sin(j + k) * 5, y: yS + 3, z: zt - bev - (down * j) / 6 });
          vine3d(ctx, cam, pts, rnd, ink);
        }
      }
    },
  };

  // ------------------------------------------------------------------ ônibus velho que virou horta (em pedaços)
  // Amarelo desbotado, faixa branca, janelas (algumas quebradas), portas do lado de cá, rodas murchas afundadas no
  // chão com mato; no teto, caixotes de madeira com verdura. A frente (para-brisa, letreiro, faróis) na ponta leste.
  small.onibus = {
    fades: true, // fica transparente quando esconde o personagem atrás
    height: (d) => d.h + 120,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, d.h),
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1, d.y0, d.y1 + 30, z0, z0 + d.h + (d.garden ? 140 : 30), 30),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const w = d.whole;
      const rnd = seeded(d.x0, d.y0, 2001);
      const first = d.piece === 0, last = d.piece === d.pieces - 1;
      const o = 2;
      const xa = d.x0 - (first ? 0 : o), xb = d.x1 + (last ? 0 : o);
      const yN = d.y0, yS = d.y1;
      const zb = z0 + 28, zt = z0 + d.h;
      const col = d.color;
      const L = w.x1 - w.x0;
      // rodas do lado de cá (atrás da lataria: desenhadas antes)
      for (const ax of [w.x0 + 260, w.x1 - 300]) {
        if (ax < d.x0 - 60 || ax > d.x1 + 60) continue;
        const pts = [], rim = [];
        for (let i = 0; i < 20; i++) {
          const t = (i / 20) * M.TAU;
          pts.push(P(ax + Math.cos(t) * 52, yS - 6, z0 + 34 + Math.sin(t) * 48));
          rim.push(P(ax + Math.cos(t) * 26, yS - 4, z0 + 34 + Math.sin(t) * 24));
        }
        inkPoly(ctx, pts, '#252221', ink, 1.8);
        fill(ctx, rim, '#5d5650');
      }
      // lado de fora (+y)
      const side = [P(xa, yS, zb), P(xb, yS, zb), P(xb, yS, zt - 20), P(xa, yS, zt - 20)];
      fill(ctx, side, col);
      H.onWall(ctx, cam, { x: w.x0, y: yS, z: zt - 20 }, { x: 1, y: 0 }, () => {
        ctx.beginPath();
        ctx.rect(xa - w.x0, 0, xb - xa, d.h);
        ctx.clip();
        const Hh = zt - 20 - zb;
        // faixa branca embaixo das janelas e o para-choque escuro
        ctx.fillStyle = '#efe8d6';
        ctx.fillRect(0, Hh * 0.56, L, 16);
        ctx.fillStyle = M.shade(col, -0.3);
        ctx.fillRect(0, Hh - 30, L, 30);
        // janelas em fila (uma ou outra quebrada), e as portas
        const doors = [L - 170, L * 0.52];
        const isDoor = (a) => doors.some((dx) => Math.abs(a - dx) < 80);
        for (let a = 40; a < L - 120; a += 150) {
          if (isDoor(a + 60)) continue;
          ctx.fillStyle = INK;
          ctx.fillRect(a - 3, Hh * 0.12 - 3, 126, Hh * 0.38 + 6);
          ctx.fillStyle = '#2d3640';
          ctx.fillRect(a, Hh * 0.12, 120, Hh * 0.38);
          ctx.fillStyle = 'rgba(200, 214, 230, 0.2)';
          ctx.fillRect(a + 10, Hh * 0.12, 22, Hh * 0.38);
          const rr = M.rng(Math.round(a * 13 + w.x0));
          if (rr() < 0.35) {
            // quebrada, com planta saindo
            ctx.fillStyle = '#121418';
            ctx.beginPath();
            const cx = a + 30 + rr() * 60, cy = Hh * (0.2 + rr() * 0.2);
            for (let k = 0; k < 9; k++) {
              const t = (k / 9) * M.TAU;
              const rad = (k % 2 ? 0.45 : 1) * 34;
              if (k) ctx.lineTo(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad * 0.8);
              else ctx.moveTo(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad * 0.8);
            }
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#4f8a3c';
            ctx.beginPath();
            ctx.ellipse(cx + 8, cy + 6, 18, 7, -0.5, 0, M.TAU);
            ctx.fill();
          }
        }
        for (const dx of doors) {
          ctx.fillStyle = INK;
          ctx.fillRect(dx - 63, Hh * 0.06 - 3, 126, Hh * 0.94);
          ctx.fillStyle = M.shade(col, -0.15);
          ctx.fillRect(dx - 60, Hh * 0.06, 120, Hh * 0.92);
          ctx.fillStyle = '#2d3640';
          ctx.fillRect(dx - 52, Hh * 0.12, 46, Hh * 0.5);
          ctx.fillRect(dx + 6, Hh * 0.12, 46, Hh * 0.5);
        }
        // ferrugem e sujeira subindo do chão
        for (let k = 0; k < Math.ceil(L / 80); k++) {
          const r2 = M.rng(k * 31 + Math.round(w.x0));
          ctx.fillStyle = r2() < 0.5 ? 'rgba(140, 80, 36, 0.28)' : 'rgba(70, 60, 40, 0.22)';
          ctx.fillRect(r2() * L, Hh * (0.55 + r2() * 0.2), 14 + r2() * 30, Hh * 0.5);
        }
      });
      edge(ctx, side[0], side[1], ink, 2);
      edge(ctx, side[3], side[2], ink, 1.2);
      // teto: a curva da beirada e o alto
      const roofEdge = [P(xa, yS, zt - 20), P(xb, yS, zt - 20), P(xb, yS - 24, zt), P(xa, yS - 24, zt)];
      fill(ctx, roofEdge, M.shade(col, 0.18));
      const roof = [P(xa, yN, zt), P(xb, yN, zt), P(xb, yS - 24, zt), P(xa, yS - 24, zt)];
      fill(ctx, roof, M.shade(col, -0.06));
      edge(ctx, roof[0], roof[1], ink, 1.6);
      edge(ctx, roofEdge[0], roofEdge[1], ink, 1);
      // a frente (leste): para-brisa, letreiro e faróis
      if (last) {
        const front = [P(d.x1, yS, zb), P(d.x1, yN, zb), P(d.x1, yN, zt - 20), P(d.x1, yS, zt - 20)];
        inkPoly(ctx, front, M.shade(col, -0.18), ink, 2);
        H.onWall(ctx, cam, { x: d.x1, y: yS, z: zt - 20 }, { x: 0, y: -1 }, () => {
          const Wd = yS - yN, Hh = zt - 20 - zb;
          ctx.fillStyle = '#1d1a1c';
          ctx.fillRect(Wd * 0.12, Hh * 0.02, Wd * 0.76, Hh * 0.1);
          ctx.fillStyle = 'rgba(245, 170, 60, 0.7)';
          ctx.font = '700 22px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('CAPÃO REDONDO', Wd * 0.5, Hh * 0.07);
          ctx.fillStyle = INK;
          ctx.fillRect(Wd * 0.06 - 4, Hh * 0.15 - 4, Wd * 0.88 + 8, Hh * 0.42 + 8);
          ctx.fillStyle = '#3c4b5c';
          ctx.fillRect(Wd * 0.06, Hh * 0.15, Wd * 0.88, Hh * 0.42);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.fillRect(Wd * 0.14, Hh * 0.15, Wd * 0.1, Hh * 0.42);
          ctx.strokeStyle = 'rgba(230, 236, 240, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(Wd * 0.6, Hh * 0.2);
          ctx.lineTo(Wd * 0.7, Hh * 0.38);
          ctx.lineTo(Wd * 0.64, Hh * 0.52);
          ctx.stroke();
          for (const fx of [0.16, 0.84]) {
            ctx.fillStyle = INK;
            ctx.fillRect(Wd * fx - 18, Hh * 0.72, 36, 20);
            ctx.fillStyle = '#e9e2c4';
            ctx.fillRect(Wd * fx - 14, Hh * 0.72 + 4, 28, 12);
          }
          ctx.fillStyle = M.shade(col, -0.32);
          ctx.fillRect(0, Hh - 30, Wd, 30);
        });
      }
      // horta no teto: caixotes de madeira com verdura
      if (d.garden) {
        const pieceL = d.x1 - d.x0;
        const n = Math.max(1, Math.floor(pieceL / 220));
        for (let k = 0; k < n; k++) {
          const cx = d.x0 + (pieceL * (k + 0.5)) / n;
          const bx0 = cx - 85, bx1 = cx + 85, by0 = yN + 50, by1 = yS - 70;
          H.box(ctx, cam, bx0, bx1, by0, by1, zt, zt + 32, { front: '#8a5a32', side: '#6d4526', top: '#5a3e26' }, ink);
          // terra e as verduras (rosetas de folha)
          for (let j = 0; j < 8; j++) {
            const x = bx0 + 22 + ((j % 4) * (bx1 - bx0 - 44)) / 3;
            const y = by0 + 28 + Math.floor(j / 4) * (by1 - by0 - 56);
            const q = P(x, y, zt + 34);
            const r = (20 + rnd() * 8) * cam.zoom;
            for (let leaf = 0; leaf < 5; leaf++) {
              const a = (leaf / 5) * M.TAU + rnd();
              ctx.fillStyle = INK;
              ctx.beginPath();
              ctx.ellipse(q.x + Math.cos(a) * r * 0.55, q.y - r * 0.3 + Math.sin(a) * r * 0.3, r * 0.6 + ink * 0.5, r * 0.4 + ink * 0.5, a, 0, M.TAU);
              ctx.fill();
              ctx.fillStyle = leaf % 2 ? '#6fbf4a' : '#4f9a36';
              ctx.beginPath();
              ctx.ellipse(q.x + Math.cos(a) * r * 0.55, q.y - r * 0.3 + Math.sin(a) * r * 0.3, r * 0.6, r * 0.4, a, 0, M.TAU);
              ctx.fill();
            }
            ctx.fillStyle = '#a8de7c';
            ctx.beginPath();
            ctx.arc(q.x, q.y - r * 0.35, r * 0.22, 0, M.TAU);
            ctx.fill();
          }
        }
        if (rnd() < 0.7) fern(ctx, cam, d.x0 + 60, yS - 50, zt, 34, ink);
      }
      if (d.weeds) {
        for (let k = 0; k < 5; k++) grass(ctx, cam, d.x0 + rnd() * (d.x1 - d.x0), yS + 10 + rnd() * 20, z0, 26 + rnd() * 12, rnd, ink);
        // cipó descendo da horta pela lataria
        for (let k = 0; k < 2; k++) {
          const x = d.x0 + 40 + rnd() * (d.x1 - d.x0 - 80);
          const down = 60 + rnd() * 140;
          const pts = [];
          for (let j = 0; j <= 6; j++) pts.push({ x: x + Math.sin(j + k) * 6, y: yS + 3, z: zt - 18 - (down * j) / 6 });
          vine3d(ctx, cam, pts, rnd, ink);
        }
      }
    },
  };

  // ------------------------------------------------------------------ barreira de rua (concreto, listras desbotadas)
  small.barreira = {
    height: (d) => d.h,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, d.h),
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1, d.y0 - 20, d.y1 + 20, z0, z0 + d.h, 20),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const rnd = seeded(d.x0, d.y0, 2101);
      const alongX = d.x1 - d.x0 >= d.y1 - d.y0;
      const L = alongX ? d.x1 - d.x0 : d.y1 - d.y0;
      const n = Math.max(1, Math.round(L / 200));
      const cy = (d.y0 + d.y1) / 2, cx = (d.x0 + d.x1) / 2;
      for (let i = 0; i < n; i++) {
        // blocos New Jersey (base larga, alto estreito), do fundo para a frente
        const a0 = (alongX ? d.x0 : d.y0) + (L * i) / n + 4, a1 = (alongX ? d.x0 : d.y0) + (L * (i + 1)) / n - 4;
        const prof = [[-32, 0], [-22, 30], [-11, d.h], [11, d.h], [22, 30], [32, 0]];
        const Q = (a, s, z) => (alongX ? P(a, cy + s, z0 + z) : P(cx + s, a, z0 + z));
        // face da frente (o lado + do perfil) e o alto
        const front = [Q(a0, prof[5][0], prof[5][1]), Q(a1, prof[5][0], prof[5][1]), Q(a1, prof[4][0], prof[4][1]), Q(a1, prof[3][0], prof[3][1]), Q(a0, prof[3][0], prof[3][1]), Q(a0, prof[4][0], prof[4][1])];
        inkPoly(ctx, front, '#b9b4a8', ink, 2);
        const top = [Q(a0, prof[2][0], d.h), Q(a1, prof[2][0], d.h), Q(a1, prof[3][0], d.h), Q(a0, prof[3][0], d.h)];
        inkPoly(ctx, top, '#cdc8bc', ink, 1.4);
        // ponta (a que a câmera vê)
        const end = [Q(a1, prof[0][0], 0), Q(a1, prof[5][0], 0), Q(a1, prof[4][0], prof[4][1]), Q(a1, prof[3][0], prof[3][1]), Q(a1, prof[2][0], prof[2][1]), Q(a1, prof[1][0], prof[1][1])];
        inkPoly(ctx, end, '#9c978b', ink, 1.6);
        // listras vermelhas e brancas desbotadas (na face da frente, inclinadas)
        ctx.save();
        path(ctx, front);
        ctx.clip();
        for (let s = 0; s < 6; s++) {
          const t0 = s / 6, t1 = (s + 0.5) / 6;
          const q = [Q(a0 + (a1 - a0) * t0, prof[5][0], 0), Q(a0 + (a1 - a0) * t1, prof[5][0], 0), Q(a0 + (a1 - a0) * (t1 + 0.12), prof[3][0], d.h), Q(a0 + (a1 - a0) * (t0 + 0.12), prof[3][0], d.h)];
          fill(ctx, q, s % 2 ? 'rgba(236, 230, 218, 0.75)' : 'rgba(196, 64, 54, 0.7)');
        }
        // sujeira e musgo embaixo
        for (let k = 0; k < 4; k++) {
          const q = Q(a0 + (a1 - a0) * rnd(), 30, 6 + rnd() * 16);
          ctx.fillStyle = 'rgba(70, 100, 50, 0.45)';
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, (10 + rnd() * 14) * cam.zoom, (5 + rnd() * 6) * cam.zoom, 0, 0, M.TAU);
          ctx.fill();
        }
        ctx.restore();
        for (let k = 0; k < 2; k++) grass(ctx, cam, alongX ? a0 + (a1 - a0) * rnd() : cx + 40, alongX ? cy + 40 : a0 + (a1 - a0) * rnd(), z0, 26, rnd, ink);
      }
    },
  };

  // ------------------------------------------------------------------ placa de direção
  // Verde (estrada) ou azul (na cidade, num poste): letras brancas e a seta. Sem poste, ela fica em dois pés baixos.
  const ARROWS = { norte: '↑', sul: '↓', leste: '→', oeste: '←' };
  function plateOf(d) {
    const words = (d.text || '').split(' ');
    // duas linhas quando o texto é comprido
    let lines = [d.text || ''];
    if ((d.text || '').length > 14 && words.length > 1) {
      const mid = Math.ceil(words.length / 2);
      lines = [words.slice(0, mid - (words.length > 2 ? 1 : 0)).join(' '), words.slice(mid - (words.length > 2 ? 1 : 0)).join(' ')];
    }
    const longest = Math.max(...lines.map((l) => l.length));
    const W = Math.max(120, longest * 15 + (d.arrow ? 70 : 30));
    const Hh = 34 + lines.length * 26;
    return { lines, W, Hh };
  }
  small.placa = {
    height: (d) => (d.pole ? 300 : 140),
    blocks: 0,
    shadow: (p, cam, d) => H.lineShadow(p, cam, d.x, d.y, d.pole ? 300 : 120, 5),
    box(cam, d, z0) {
      const pl = plateOf(d);
      const zt = z0 + (d.pole ? 300 : 140);
      return volBox(cam, d.x - pl.W / 2 - 10, d.x + pl.W / 2 + 10, d.y - 10, d.y + 10, z0, zt + 10, 16);
    },
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const pl = plateOf(d);
      const rnd = seeded(d.x, d.y, 2201);
      const zt = z0 + (d.pole ? 300 : 140);
      const green = !d.pole;
      // poste (ou os dois pés baixos)
      const legs = d.pole ? [d.x] : [d.x - pl.W * 0.3, d.x + pl.W * 0.3];
      for (const lx of legs) inkLine(ctx, [P(lx, d.y, z0), P(lx, d.y, zt - 6)], '#7d8288', Math.max(2, (d.pole ? 6 : 4.5) * cam.zoom), ink);
      if (d.pole) {
        // cipó subindo o poste
        const pts = [];
        for (let j = 0; j <= 8; j++) pts.push({ x: d.x + Math.sin(j * 1.4) * 5, y: d.y + 4, z: z0 + (zt - z0 - pl.Hh) * (j / 8) });
        vine3d(ctx, cam, pts, rnd, ink);
      }
      // a placa, de frente para o sul (+y)
      H.onWall(ctx, cam, { x: d.x - pl.W / 2, y: d.y + 4, z: zt }, { x: 1, y: 0 }, () => {
        ctx.fillStyle = INK;
        ctx.fillRect(-3, -3, pl.W + 6, pl.Hh + 6);
        ctx.fillStyle = green ? '#1f6b45' : '#1f4e9a';
        ctx.fillRect(0, 0, pl.W, pl.Hh);
        ctx.strokeStyle = '#f2f0e8';
        ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, pl.W - 12, pl.Hh - 12);
        ctx.fillStyle = '#f7f5ee';
        ctx.font = '800 22px system-ui, sans-serif';
        ctx.textAlign = d.arrow ? 'left' : 'center';
        ctx.textBaseline = 'middle';
        const tx = d.arrow ? 18 : pl.W / 2;
        pl.lines.forEach((line, i) => ctx.fillText(line, tx, 17 + 13 + i * 26));
        if (d.arrow && ARROWS[d.arrow]) {
          ctx.font = '900 38px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ARROWS[d.arrow], pl.W - 32, pl.Hh / 2 + 2);
        }
        // sujeira e ferrugem
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(60, 50, 40, 0.25)' : 'rgba(150, 90, 50, 0.3)';
          ctx.beginPath();
          ctx.ellipse(rnd() * pl.W, rnd() * pl.Hh, 4 + rnd() * 10, 3 + rnd() * 6, rnd() * 3, 0, M.TAU);
          ctx.fill();
        }
      });
      if (!d.pole) for (let k = 0; k < 2; k++) grass(ctx, cam, d.x + (rnd() - 0.5) * pl.W * 0.8, d.y + 14, z0, 24, rnd, ink);
    },
  };
})(window.PD = window.PD || {});
