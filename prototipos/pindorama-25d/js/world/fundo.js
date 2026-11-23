// O fundo do Capão (etapa 4c, aprovada pelo dono em 13/11; referências docs/referencias/capao-fundo-aprovado.jpg e
// capao-campinho-aprovado.jpg): o campinho de várzea com as traves de rede rasgada e o muro grafitado; o viaduto da
// linha lilás quebrado na ponta, com mato em cima, pilares pichados e cipó pendurado; o trem lilás parado lá em cima,
// com plantas no teto; o ônibus velho que virou horta; a barreira da rua fechada e as placas de direção. E, do Capão
// maior (23/11), a Estação Capão Redondo (`estacao`): o prédio de baixo do viaduto e a plataforma com a cobertura; a
// fachada da escola estadual (`PD.city.facades.escola`, para a casa com `estilo: 'escola'`) e o alambrado da quadra;
// a feira livre: as lonas das bancas, a banca de pastel com caldo de cana e o carrinho de feira; a ponte (as muretas e
// a lateral descendo até a água), a sucata do ferro-velho, o corrimão do escadão e os "gatos" (a fiação das vielas).
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
        if (painted && d.graffiti) mural(ctx, L, d.h, r, d.text);
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
  function mural(ctx, L, Hh, r, word) {
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
    // (a palavra do muro: `texto` no mapa; sem ela, a do muro do campinho do Capão)
    const text = word || 'CAPÃO';
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
      // (embaixo da cobertura da estação, não nasce árvore no leito)
      if (d.trees && !d.train && !d.station) {
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
    fades: true, // a grande (3,3 m) fica transparente quando o herói passa atrás dela
    height: (d) => (d.big ? 225 : d.pole ? 300 : 140),
    blocks: 0,
    shadow(p, cam, d) {
      if (d.big) {
        for (const dy of [-95, 95]) H.lineShadow(p, cam, d.x, d.y + dy, 212, 7);
        return;
      }
      H.lineShadow(p, cam, d.x, d.y, d.pole ? 300 : 120, 5);
    },
    box(cam, d, z0) {
      if (d.big) return volBox(cam, d.x - 20, d.x + 30, d.y - 128, d.y + 128, z0, z0 + 235, 20);
      if (d.crooked) return volBox(cam, d.x - 90, d.x + 140, d.y - 30, d.y + 40, z0, z0 + 340, 20);
      const pl = plateOf(d);
      const zt = z0 + (d.pole ? 300 : 140);
      return volBox(cam, d.x - pl.W / 2 - 10, d.x + pl.W / 2 + 10, d.y - 10, d.y + 10, z0, zt + 10, 16);
    },
    paint(ctx, cam, d, z0, ink) {
      if (d.big) return bigSign(ctx, cam, d, z0, ink);
      if (d.crooked) return crookedSign(ctx, cam, d, z0, ink);
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
  /**
   * A placa velha do posto abandonado (`torta`, floresta maior): o poste inclinado e a chapa em branco (o nome do posto
   * sumiu: nada de marca), a tinta branca descascando, ferrugem nas beiradas, um canto amassado e dois parafusos.
   */
  function crookedSign(ctx, cam, d, z0, ink) {
    const rnd = seeded(d.x, d.y, 2271);
    const lean = { x: 62, y: 10 };
    const zt = z0 + 286;
    const base = { x: d.x, y: d.y, z: z0 };
    const top = { x: d.x + lean.x, y: d.y + lean.y, z: zt };
    grass(ctx, cam, d.x - 8, d.y + 6, z0, 26, rnd, ink);
    inkLine(ctx, [cam.p(base), cam.p(top)], '#7d756a', Math.max(2, 6 * cam.zoom), ink);
    // ferrugem no pé do poste
    const rb = cam.p({ x: d.x + lean.x * 0.08, y: d.y + lean.y * 0.08, z: z0 + 24 });
    ctx.fillStyle = 'rgba(140, 74, 36, 0.8)';
    ctx.beginPath();
    ctx.ellipse(rb.x, rb.y, 3.4 * cam.zoom, 9 * cam.zoom, 0.2, 0, M.TAU);
    ctx.fill();
    // a chapa, de frente para o sul (+y), inclinada junto com o poste
    const W = 118, Hh = 74;
    const tilt = -Math.atan2(lean.x, zt - z0) * 0.9;
    H.onWall(ctx, cam, { x: top.x - 10, y: top.y + 4, z: zt + 6 }, { x: 1, y: 0 }, () => {
      ctx.rotate(tilt);
      ctx.translate(-W / 2, 0);
      ctx.fillStyle = INK;
      ctx.fillRect(-4, -4, W + 8, Hh + 8);
      ctx.fillStyle = '#e4dece';
      ctx.fillRect(0, 0, W, Hh);
      // a tinta descascando (manchas cinza) e a ferrugem nas beiradas e escorrendo
      for (let k = 0; k < 9; k++) {
        ctx.fillStyle = k % 2 ? 'rgba(150, 146, 136, 0.55)' : 'rgba(184, 178, 166, 0.6)';
        ctx.beginPath();
        ctx.ellipse(rnd() * W, rnd() * Hh, 5 + rnd() * 12, 3 + rnd() * 7, rnd() * 3, 0, M.TAU);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(146, 70, 30, 0.85)';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, Hh - 6);
      ctx.fillStyle = 'rgba(146, 70, 30, 0.6)';
      for (let k = 0; k < 5; k++) ctx.fillRect(8 + rnd() * (W - 20), Hh - 6, 4 + rnd() * 4, -(6 + rnd() * 22));
      // o canto de baixo amassado (dobrado para dentro) e os parafusos
      ctx.fillStyle = '#a49e90';
      ctx.beginPath();
      ctx.moveTo(W, Hh - 22);
      ctx.lineTo(W, Hh);
      ctx.lineTo(W - 24, Hh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5d5a54';
      for (const bx of [W * 0.3, W * 0.7]) {
        ctx.beginPath();
        ctx.arc(bx, Hh / 2, 3.2, 0, M.TAU);
        ctx.fill();
      }
    });
  }
  /**
   * A placa grande da entrada do parque: tábua de madeira escura em dois postes, na altura dos olhos (1,2 a 2 m),
   * virada para a rua (o leste, +x), com o nome em letras claras em duas linhas; `mato`: musgo em cima, cipó só nos
   * postes e nas pontas da tábua (o nome tem que dar para ler: pedido do dono, 13/11) e capim nos pés.
   */
  function bigSign(ctx, cam, d, z0, ink) {
    const rnd = seeded(d.x, d.y, 2251);
    const WOOD = { front: '#6b4a2e', side: '#553a24', top: '#7c5836' };
    const POST = { front: '#5a3d26', side: '#47301e', top: '#6b4a2e' };
    const y0 = d.y - 118, y1 = d.y + 118;
    const zb = z0 + 120, zt = z0 + 202;
    const postTop = z0 + 212;
    if (d.weeds) for (const dy of [-95, 95]) grass(ctx, cam, d.x - 10, d.y + dy - 10, z0, 22, rnd, ink);
    // os postes (atrás da tábua)
    for (const dy of [-95, 95]) H.box(ctx, cam, d.x - 7, d.x + 7, d.y + dy - 7, d.y + dy + 7, z0, postTop, POST, ink);
    // cipó subindo os postes, só até a tábua (depois dela, de novo em cima: nunca por cima das letras)
    if (d.weeds) {
      for (const [dy, k] of [[95, 0], [-95, 1]]) {
        const climb = [];
        for (let j = 0; j <= 7; j++) climb.push({ x: d.x + 8, y: d.y + dy + Math.sin(j * 1.5 + k) * 5, z: z0 + ((zb - z0 - 6) * j) / 7 });
        vine3d(ctx, cam, climb, rnd, ink);
      }
    }
    // a tábua, na frente dos postes
    const bx0 = d.x + 8, bx1 = d.x + 15;
    const board = H.box(ctx, cam, bx0, bx1, y0, y1, zb, zt, WOOD, ink);
    H.onWall(ctx, cam, { x: bx1, y: y1, z: zt }, { x: 0, y: -1 }, () => {
      const W = y1 - y0, Hh = zt - zb;
      // tábuas (três faixas), a moldura mais clara e o desgaste
      ctx.strokeStyle = 'rgba(40, 26, 14, 0.55)';
      ctx.lineWidth = 2;
      for (let k = 1; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(0, (Hh * k) / 3);
        ctx.lineTo(W, (Hh * k) / 3 + (rnd() - 0.5) * 3);
        ctx.stroke();
      }
      ctx.strokeStyle = '#8f6a44';
      ctx.lineWidth = 5;
      ctx.strokeRect(6, 6, W - 12, Hh - 12);
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(40, 26, 14, 0.3)' : 'rgba(150, 110, 70, 0.25)';
        ctx.fillRect(rnd() * W, rnd() * Hh, 8 + rnd() * 20, 1.5 + rnd() * 2);
      }
      // o nome: primeira palavra numa linha, o resto na outra
      const words = (d.text || '').split(' ');
      const lines = words.length > 1 ? [words[0], words.slice(1).join(' ')] : [d.text || ''];
      const FONT = H.FONT_SIGN || '"Impact", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      lines.forEach((line, i) => {
        const size = lines.length > 1 ? 29 : 36;
        ctx.font = `${size}px ${FONT}`;
        const y = lines.length > 1 ? Hh * (0.31 + i * 0.4) : Hh / 2;
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#2a1a0c';
        ctx.strokeText(line, W / 2, y);
        ctx.fillStyle = '#f2e6c4';
        ctx.fillText(line, W / 2, y);
      });
    });
    if (!d.weeds) return;
    // musgo em cima da tábua
    const top = board.top;
    for (let k = 0; k < 8; k++) {
      const u = rnd();
      const x = top[0].x + (top[1].x - top[0].x) * 0.5 + (top[3].x - top[0].x) * u;
      const y = top[0].y + (top[1].y - top[0].y) * 0.5 + (top[3].y - top[0].y) * u;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(86, 128, 58, 0.9)' : 'rgba(64, 104, 48, 0.85)';
      ctx.beginPath();
      ctx.ellipse(x, y, (6 + rnd() * 8) * cam.zoom, (3 + rnd() * 3) * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
    }
    // cipó curto nas duas pontas da tábua (fora do nome) e no alto dos postes
    for (const [ya, k] of [[y0 + 6, 0], [y1 - 6, 1]]) {
      const pts = [];
      for (let j = 0; j <= 4; j++) pts.push({ x: bx1 + 2, y: ya + Math.sin(j + k) * 3, z: zt + 4 - j * 16 });
      vine3d(ctx, cam, pts, rnd, ink);
    }
  }
  // ------------------------------------------------------------------ a Estação Capão Redondo (Capão maior, 23/11)
  // O prédio da estação embaixo do viaduto, abandonado e tomado pela mata. Dois blocos: o da entrada (`hf` de altura),
  // com a fachada de concreto, a faixa lilás da linha com o nome em letras brancas, a marquise sobre as três portas de
  // aço baixadas e pichadas e as vidraças dos dois lados (muitas quebradas); e, atrás dele, o da plataforma (`back` de
  // fundura, na altura do viaduto, `h`), com a faixa amarela da beira, os bancos, o guarda-corpo de vidro e, em cima dos
  // trilhos, a cobertura curva de metal nas colunas de aço, com buracos, ferrugem, mato e cipó pendurado. Sem marca.
  const ST = {
    face: '#b9b4a8', side: '#9b968a', top: '#c6c1b4', joint: 'rgba(84, 78, 70, 0.32)', floor: '#cdc8bb',
    glass: '#34444d', glassHi: 'rgba(170, 205, 215, 0.32)', hole: '#161b1e', frame: '#4c5257',
    gate: '#8e9296', gateDark: '#6f7377', steel: '#596067', roof: '#c3c8cb', roofDark: '#9ea4a8', yellow: '#e2b51e',
  };
  const ST_FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
  /** As medidas da estação (cm): o bloco da entrada, o da plataforma, a cobertura e a marquise. */
  function stationGeom(d) {
    const yF = d.y0 + (d.back || 360);
    const W = d.x1 - d.x0;
    const ent = { u0: W / 2 - 370, u1: W / 2 + 370 };
    return {
      yF,
      hf: d.hf || 650,
      hb: d.h || 800,
      W,
      ent,
      // a cobertura: de um pouco ao norte dos trilhos até a beira da plataforma
      roof: { x0: d.x0 + 110, x1: d.x1 - 110, yN: d.y0 - 470, yS: yF - 25, z: (d.h || 800) + 340, rise: 120 },
      // a marquise da entrada (no alto das portas, saindo da fachada)
      marq: { x0: d.x0 + ent.u0 - 60, x1: d.x0 + ent.u1 + 60, y0: d.y1, y1: d.y1 + 150, z: 330, t: 28 },
    };
  }
  /** As portas de aço (de enrolar), em cm da parede: `x` e `w` do vão, `y0` o alto, `y1` o chão. */
  function steelGate(ctx, x, w, y0, y1, r) {
    ctx.fillStyle = ST.gate;
    ctx.fillRect(x, y0, w, y1 - y0);
    // as ondas do aço (listras de luz e sombra)
    for (let y = y0 + 6; y < y1; y += 11) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = 'rgba(30, 32, 36, 0.22)';
      ctx.fillRect(x, y + 5, w, 3);
    }
    // ferrugem escorrida e o pé amassado
    for (let k = 0; k < 4; k++) {
      const rx = x + 10 + r() * (w - 20);
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(140, 70, 30, 0)');
      g.addColorStop(0.55 + r() * 0.3, 'rgba(140, 70, 30, 0.45)');
      g.addColorStop(1, 'rgba(110, 54, 24, 0.6)');
      ctx.fillStyle = g;
      ctx.fillRect(rx, y0 + 20, 6 + r() * 12, y1 - y0 - 20);
    }
    ctx.fillStyle = ST.gateDark;
    ctx.fillRect(x, y1 - 14, w, 14);
    // a guia de cada lado e o cadeado no pé
    ctx.fillStyle = ST.frame;
    ctx.fillRect(x - 5, y0, 7, y1 - y0);
    ctx.fillRect(x + w - 2, y0, 7, y1 - y0);
    ctx.fillStyle = '#2b2d30';
    ctx.fillRect(x + w / 2 - 7, y1 - 24, 14, 12);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y0, w, y1 - y0);
  }
  /** Uma vidraça (em cm da parede): o vidro escuro com o reflexo, ou o buraco do vidro quebrado com os cacos. */
  function stationPane(ctx, x, y, w, h, r, broken) {
    if (!broken) {
      ctx.fillStyle = ST.glass;
      ctx.fillRect(x, y, w, h);
      // o reflexo do céu, em diagonal
      ctx.fillStyle = ST.glassHi;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, y);
      ctx.lineTo(x + w * 0.42, y);
      ctx.lineTo(x + w * 0.1, y + h);
      ctx.lineTo(x - w * 0.14 > x ? x - w * 0.14 : x, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(x + w * 0.62, y, w * 0.08, h);
      return;
    }
    // quebrado: o escuro de dentro, com os cacos presos na moldura
    ctx.fillStyle = ST.hole;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(80, 110, 70, 0.35)'; // o mato que cresceu lá dentro
    ctx.beginPath();
    ctx.ellipse(x + w * (0.3 + r() * 0.4), y + h, w * 0.4, h * 0.22, 0, Math.PI, M.TAU);
    ctx.fill();
    ctx.fillStyle = ST.glass;
    const shard = (pts) => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
    };
    shard([[x, y], [x + w * (0.3 + r() * 0.3), y], [x, y + h * (0.25 + r() * 0.3)]]);
    shard([[x + w, y + h], [x + w * (0.55 + r() * 0.3), y + h], [x + w, y + h * (0.5 + r() * 0.3)]]);
    if (r() < 0.6) shard([[x + w, y], [x + w, y + h * (0.2 + r() * 0.2)], [x + w * (0.7 + r() * 0.2), y]]);
  }
  /** A fachada do bloco da entrada (em cm da parede: `W` de largura, `Hh` de altura, o alto em 0). */
  function stationFront(ctx, d, g, r) {
    const { W, ent } = g;
    const Hh = g.hf;
    // as juntas das placas de concreto e as manchas de chuva
    ctx.fillStyle = ST.joint;
    for (let u = 300; u < W; u += 300) ctx.fillRect(u - 2, 140, 4, Hh - 140);
    ctx.fillRect(0, 170, W, 4);
    for (let k = 0; k < 14; k++) {
      const u = r() * W, run = 60 + r() * 200;
      const gr = ctx.createLinearGradient(0, 140, 0, 140 + run);
      gr.addColorStop(0, 'rgba(60, 56, 50, 0.3)');
      gr.addColorStop(1, 'rgba(60, 56, 50, 0)');
      ctx.fillStyle = gr;
      ctx.fillRect(u, 140, 10 + r() * 22, run);
    }
    // a faixa lilás da linha com o nome (as letras brancas, encardidas)
    const line = d.line || '#8a63b8';
    ctx.fillStyle = line;
    ctx.fillRect(0, 22, W, 112);
    ctx.fillStyle = M.shade(line, -0.25);
    ctx.fillRect(0, 122, W, 12);
    if (d.sign) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = 84;
      ctx.font = `${size}px ${ST_FONT}`;
      while (ctx.measureText(d.sign).width > W - 260 && size > 40) ctx.font = `${--size}px ${ST_FONT}`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(40, 24, 60, 0.7)';
      ctx.strokeText(d.sign, W / 2, 80);
      ctx.fillStyle = '#f3f1ea';
      ctx.fillText(d.sign, W / 2, 80);
      ctx.restore();
      // a sujeira escorrendo das letras
      for (let k = 0; k < 10; k++) {
        ctx.fillStyle = 'rgba(70, 60, 80, 0.25)';
        ctx.fillRect(130 + r() * (W - 260), 100 + r() * 20, 4 + r() * 5, 14 + r() * 30);
      }
    }
    // as vidraças dos dois lados da entrada (do chão até perto da faixa), umas inteiras e outras quebradas
    const gy0 = 205, gy1 = Hh - 16;
    for (const [a, b] of [[110, ent.u0 - 70], [ent.u1 + 70, W - 110]]) {
      const n = Math.max(2, Math.round((b - a) / 150));
      const pw = (b - a) / n;
      for (let i = 0; i < n; i++) {
        const px = a + i * pw;
        // a travessa do meio (a bandeira de cima e o vidro grande de baixo)
        stationPane(ctx, px + 6, gy0 + 6, pw - 12, 108, r, r() < 0.3);
        stationPane(ctx, px + 6, gy0 + 126, pw - 12, gy1 - gy0 - 132, r, r() < 0.42);
      }
      ctx.strokeStyle = ST.frame;
      ctx.lineWidth = 12;
      ctx.strokeRect(a, gy0, b - a, gy1 - gy0);
      ctx.lineWidth = 8;
      for (let i = 1; i < n; i++) {
        ctx.beginPath();
        ctx.moveTo(a + i * pw, gy0);
        ctx.lineTo(a + i * pw, gy1);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(a, gy0 + 120);
      ctx.lineTo(b, gy0 + 120);
      ctx.stroke();
    }
    // a entrada: o vão de concreto mais escuro e as três portas de aço baixadas, pichadas
    ctx.fillStyle = M.shade(ST.face, -0.16);
    ctx.fillRect(ent.u0 - 30, 185, ent.u1 - ent.u0 + 60, Hh - 185);
    const gw = (ent.u1 - ent.u0 - 4 * 20) / 3;
    for (let i = 0; i < 3; i++) steelGate(ctx, ent.u0 + 20 + i * (gw + 20), gw, 300, Hh - 6, r);
    H.pixo(ctx, ent.u1 - ent.u0 + 40, 420, M.rng(Math.round(d.x0) + 31), 0.95);
    // a bilheteria, do lado direito da entrada (o guichê fechado com a grade e a plaquinha)
    const bx = ent.u1 + 90;
    ctx.fillStyle = '#2a3035';
    ctx.fillRect(bx, 330, 120, 90);
    ctx.strokeStyle = '#8b9197';
    ctx.lineWidth = 4;
    for (let u = bx + 10; u < bx + 120; u += 14) {
      ctx.beginPath();
      ctx.moveTo(u, 330);
      ctx.lineTo(u, 420);
      ctx.stroke();
    }
    ctx.fillStyle = line;
    ctx.fillRect(bx, 300, 120, 26);
    ctx.fillStyle = '#f3f1ea';
    ctx.font = `18px ${ST_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BILHETERIA', bx + 60, 314);
    // pichação no concreto e o musgo e o cipó tomando a frente (a entrada fica mais livre)
    if (d.pixo) {
      ctx.save();
      ctx.translate(0, 0);
      H.pixo(ctx, ent.u0 - 120, 150, M.rng(Math.round(d.x0) + 7), 0.7);
      ctx.restore();
    }
    if (d.moss && H.mossWall) H.mossWall(ctx, W, Hh, r);
    if (d.vine && H.overgrowth) H.overgrowth(ctx, W, Hh, r, d.vine, [ent.u0 - 40, ent.u1 + 40]);
  }
  /** O lado (+x) dos dois blocos: o concreto, a faixa lilás, a porta de serviço e o cipó. */
  function stationSide(ctx, d, len, Hh, band, r, door) {
    ctx.fillStyle = ST.joint;
    for (let u = 180; u < len; u += 180) ctx.fillRect(u - 2, band + 120, 4, Hh - band - 120);
    ctx.fillStyle = M.shade(d.line || '#8a63b8', -0.18);
    ctx.fillRect(0, band + 22, len, 112);
    if (door) {
      ctx.fillStyle = '#5c6166';
      ctx.fillRect(len * 0.45, Hh - 230, 100, 224);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.strokeRect(len * 0.45, Hh - 230, 100, 224);
      ctx.fillStyle = '#2b2d30';
      ctx.fillRect(len * 0.45 + 80, Hh - 120, 10, 16);
    }
    // a grelha de ventilação no alto
    ctx.fillStyle = '#6d7277';
    ctx.fillRect(len * 0.15, band + 160, 90, 60);
    ctx.strokeStyle = '#3e4246';
    ctx.lineWidth = 3;
    for (let v = band + 170; v < band + 220; v += 9) {
      ctx.beginPath();
      ctx.moveTo(len * 0.15 + 6, v);
      ctx.lineTo(len * 0.15 + 84, v);
      ctx.stroke();
    }
    if (d.moss && H.mossWall) H.mossWall(ctx, len, Hh, r);
    if (d.vine && H.overgrowth) H.overgrowth(ctx, len, Hh, r, d.vine * 0.85);
  }
  /** A altura (cm) da cobertura curva em `y`. */
  const roofZ = (R, y) => R.z + R.rise * Math.sin(Math.PI * M.clamp((y - R.yN) / (R.yS - R.yN), 0, 1));
  small.estacao = {
    fades: true, // fica transparente quando esconde o personagem atrás (embaixo do viaduto)
    height: (d) => (d.h || 800) + 480,
    blocks: 0,
    shadow(p, cam, d) {
      const g = stationGeom(d);
      H.boxShadow(p, cam, d.x0, d.x1, d.y0, g.yF, g.hb);
      H.boxShadow(p, cam, d.x0, d.x1, g.yF, d.y1, g.hf);
      slabShadow(p, cam, g.roof.x0, g.roof.x1, g.roof.yN, g.roof.yS, g.roof.z, g.roof.z + g.roof.rise);
    },
    box(cam, d, z0) {
      const g = stationGeom(d);
      return volBox(cam, d.x0 - 60, d.x1 + 60, g.roof.yN - 40, g.marq.y1 + 30, z0, z0 + g.roof.z + g.roof.rise + 160, 30);
    },
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const g = stationGeom(d);
      const R = g.roof;
      const rnd = seeded(d.x0, d.y0, 3301);
      const zp = z0 + g.hb; // o chão da plataforma (a altura do viaduto)
      const colX = [];
      for (let x = R.x0 + 120; x <= R.x1 - 110; x += 600) colX.push(x);
      // 1) as colunas do lado dos trilhos (em cima do viaduto, atrás de tudo)
      const column = (x, y) => {
        const zt = z0 + roofZ(R, y) - 6;
        H.box(ctx, cam, x - 11, x + 11, y - 11, y + 11, zp, zt, { front: ST.steel, side: M.shade(ST.steel, -0.25), top: ST.steel }, ink);
      };
      for (const x of colX) column(x, d.y0 - 330);
      // 2) o bloco da plataforma: a caixa, o chão (faixa amarela na beira dos trilhos, piso tátil e os bancos)
      H.box(ctx, cam, d.x0, d.x1, d.y0, g.yF, z0, zp, { front: ST.face, side: ST.side, top: ST.floor }, ink);
      H.onWall(ctx, cam, { x: d.x1, y: g.yF, z: zp }, { x: 0, y: -1 }, () => stationSide(ctx, d, g.yF - d.y0, g.hb, 0, seeded(d.x1, d.y0, 3307), false));
      fill(ctx, [P(d.x0, d.y0 + 18, zp + 1), P(d.x1, d.y0 + 18, zp + 1), P(d.x1, d.y0 + 52, zp + 1), P(d.x0, d.y0 + 52, zp + 1)], ST.yellow);
      fill(ctx, [P(d.x0, d.y0 + 58, zp + 1), P(d.x1, d.y0 + 58, zp + 1), P(d.x1, d.y0 + 90, zp + 1), P(d.x0, d.y0 + 90, zp + 1)], '#b3ac97');
      // as manchas e o mato no chão da plataforma
      for (let k = 0; k < 9; k++) {
        const q = P(d.x0 + 60 + rnd() * (g.W - 120), d.y0 + 110 + rnd() * (g.yF - d.y0 - 160), zp + 1);
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(96, 120, 64, 0.5)' : 'rgba(70, 66, 58, 0.25)';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, (18 + rnd() * 30) * cam.zoom, (8 + rnd() * 10) * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
      for (let x = d.x0 + 420; x < d.x1 - 300; x += 900) {
        // banco de metal da plataforma (o assento e as pernas)
        H.box(ctx, cam, x, x + 180, d.y0 + 190, d.y0 + 230, zp, zp + 44, { front: '#7d848a', side: '#61686d', top: '#9aa1a6' }, ink);
      }
      for (let k = 0; k < 5; k++) grass(ctx, cam, d.x0 + 100 + rnd() * (g.W - 200), d.y0 + 120 + rnd() * (g.yF - d.y0 - 180), zp, 22 + rnd() * 10, rnd, ink);
      // 3) as colunas do lado da plataforma e a cobertura curva em cima (de trás para a frente, em faixas)
      for (const x of colX) column(x, g.yF - 70);
      // o guarda-corpo de vidro na beira da plataforma, por cima do bloco da entrada
      const gz = zp + 105;
      fill(ctx, [P(d.x0 + 40, g.yF - 6, zp), P(d.x1 - 40, g.yF - 6, zp), P(d.x1 - 40, g.yF - 6, gz), P(d.x0 + 40, g.yF - 6, gz)], 'rgba(150, 190, 200, 0.28)');
      edge(ctx, P(d.x0 + 40, g.yF - 6, gz), P(d.x1 - 40, g.yF - 6, gz), ink, 2.2);
      ctx.strokeStyle = ST.steel;
      ctx.lineWidth = Math.max(1, 3 * cam.zoom);
      ctx.beginPath();
      for (let x = d.x0 + 40; x <= d.x1 - 40; x += 150) {
        const a = P(x, g.yF - 6, zp), b = P(x, g.yF - 6, gz);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      const N = 14;
      const ys = [];
      for (let i = 0; i <= N; i++) ys.push(R.yN + ((R.yS - R.yN) * i) / N);
      const holes = [];
      for (let k = 0; k < 4; k++) holes.push({ x: R.x0 + 200 + rnd() * (R.x1 - R.x0 - 400), i: 2 + Math.floor(rnd() * (N - 4)), w: 120 + rnd() * 180 });
      for (let i = 0; i < N; i++) {
        const [ya, yb] = [ys[i], ys[i + 1]];
        const [za, zb] = [z0 + roofZ(R, ya), z0 + roofZ(R, yb)];
        // a faixa virada para o sul (a câmera e o sol) mais clara; a do norte, mais escura
        const t = (zb - za) / (yb - ya);
        const col = M.mix ? M.mix(ST.roof, ST.roofDark, M.clamp(0.5 + t * 2.2, 0, 1)) : t > 0 ? ST.roofDark : ST.roof;
        const strip = [P(R.x0, ya, za), P(R.x1, ya, za), P(R.x1, yb, zb), P(R.x0, yb, zb)];
        fill(ctx, strip, col);
        // as telhas onduladas (as linhas no sentido da curva) e os buracos das que caíram
        ctx.strokeStyle = 'rgba(90, 96, 100, 0.35)';
        ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
        ctx.beginPath();
        for (let x = R.x0 + 40; x < R.x1; x += 40) {
          const a = P(x, ya, za), b = P(x, yb, zb);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
        for (const h of holes) {
          if (h.i !== i && h.i !== i - 1) continue;
          fill(ctx, [P(h.x, ya, za), P(h.x + h.w, ya, za), P(h.x + h.w, yb, zb), P(h.x, yb, zb)], 'rgba(24, 28, 30, 0.85)');
        }
      }
      // ferrugem e musgo na cobertura, e mato nascendo nas emendas
      for (let k = 0; k < 16; k++) {
        const y = R.yN + rnd() * (R.yS - R.yN);
        const q = P(R.x0 + rnd() * (R.x1 - R.x0), y, z0 + roofZ(R, y) + 1);
        ctx.fillStyle = rnd() < 0.55 ? 'rgba(150, 80, 36, 0.4)' : 'rgba(86, 118, 58, 0.55)';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, (20 + rnd() * 40) * cam.zoom, (7 + rnd() * 10) * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
      for (let k = 0; k < 3; k++) {
        const y = R.yN + 150 + rnd() * (R.yS - R.yN - 300);
        bush(ctx, cam, R.x0 + 200 + rnd() * (R.x1 - R.x0 - 400), y, z0 + roofZ(R, y), 40 + rnd() * 26, ink);
      }
      // o contorno da cobertura: a beira de cima (a curva nas pontas) e a de baixo, na frente
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 2;
      ctx.lineJoin = 'round';
      for (const x of [R.x0, R.x1]) {
        ctx.beginPath();
        ys.forEach((y, i) => {
          const q = P(x, y, z0 + roofZ(R, y));
          if (i) ctx.lineTo(q.x, q.y);
          else ctx.moveTo(q.x, q.y);
        });
        ctx.stroke();
      }
      // a beirada da frente (a calha lilás) e o arco de aço na ponta que a câmera vê
      inkPoly(ctx, [P(R.x0, R.yS, z0 + R.z - 30), P(R.x1, R.yS, z0 + R.z - 30), P(R.x1, R.yS, z0 + R.z), P(R.x0, R.yS, z0 + R.z)], d.line || '#8a63b8', ink, 1.6);
      edge(ctx, P(R.x0, R.yN, z0 + R.z), P(R.x1, R.yN, z0 + R.z), ink, 1.6);
      // o cipó pendurado da beirada da frente
      for (let x = R.x0 + 150 + rnd() * 200; x < R.x1 - 100; x += 260 + rnd() * 360) {
        const pts = [];
        const len = 120 + rnd() * 240;
        for (let j = 0; j <= 6; j++) pts.push({ x: x + Math.sin(j * 0.9 + x) * 10, y: R.yS + 4, z: z0 + R.z - 30 - (len * j) / 6 });
        vine3d(ctx, cam, pts, rnd, ink);
      }
      // 4) o bloco da entrada: a caixa, a fachada (a faixa com o nome, as vidraças e as portas), o lado e a laje
      H.box(ctx, cam, d.x0, d.x1, g.yF, d.y1, z0, z0 + g.hf, { front: ST.face, side: ST.side, top: ST.top }, ink);
      H.onWall(ctx, cam, { x: d.x0, y: d.y1, z: z0 + g.hf }, { x: 1, y: 0 }, () => stationFront(ctx, d, g, seeded(d.x0, d.y1, 3311)));
      H.onWall(ctx, cam, { x: d.x1, y: d.y1, z: z0 + g.hf }, { x: 0, y: -1 }, () => stationSide(ctx, d, d.y1 - g.yF, g.hf, 0, seeded(d.x1, d.y1, 3313), true));
      // a laje do bloco da entrada: a mureta de volta, as caixas do ar e o mato
      const zt = z0 + g.hf;
      for (let x = d.x0 + 300; x < d.x1 - 300; x += 700 + rnd() * 400) H.box(ctx, cam, x, x + 110, g.yF + 80, g.yF + 170, zt, zt + 70, { front: '#a9aca8', side: '#8c8f8b', top: '#c1c3bf' }, ink);
      for (let k = 0; k < 5; k++) {
        const x = d.x0 + 150 + rnd() * (g.W - 300), y = g.yF + 60 + rnd() * (d.y1 - g.yF - 120);
        if (rnd() < 0.4) fern(ctx, cam, x, y, zt, 36 + rnd() * 16, ink);
        else bush(ctx, cam, x, y, zt, 34 + rnd() * 22, ink);
      }
      if (d.vine > 0.3) H.roofTree(ctx, cam, d.x0 + g.W * 0.82, g.yF + (d.y1 - g.yF) * 0.45, zt, ink);
      // 5) a marquise da entrada (a laje fina saindo da fachada, no alto das portas), com mato em cima
      const m = g.marq;
      H.box(ctx, cam, m.x0, m.x1, m.y0, m.y1, z0 + m.z, z0 + m.z + m.t, { front: M.shade(ST.face, 0.04), side: ST.side, top: ST.top }, ink);
      for (let k = 0; k < 3; k++) grass(ctx, cam, m.x0 + 60 + rnd() * (m.x1 - m.x0 - 120), m.y0 + 40 + rnd() * 80, z0 + m.z + m.t, 20 + rnd() * 8, rnd, ink);
      const vpts = [];
      for (let j = 0; j <= 4; j++) vpts.push({ x: m.x0 + 30 + j * 4, y: m.y1 + 2, z: z0 + m.z - j * 30 });
      vine3d(ctx, cam, vpts, rnd, ink);
    },
  };
  // ------------------------------------------------------------------ a Escola Estadual (Capão maior, 23/11)
  // A fachada do prédio da escola (a casa com `estilo: 'escola'`; o props.js chama `PD.city.facades.escola`): o concreto
  // claro com as faixas da `faixa` (no alto e em cada laje), os pilares aparentes de 5 em 5 m, as janelas basculantes em
  // fita (vidros quebrados, uns abertos), a entrada com a placa do nome e o portão de grade, e o mural que os alunos
  // pintaram. Em cm da parede (`len` de comprimento, `H` de altura, o alto em 0).
  const SCHOOL = { band: '#3a6ea5', frame: '#4b535a', pane: '#6d8c98', paneHi: 'rgba(220, 240, 245, 0.35)', hole: '#1b2226' };
  /** Uma janela basculante em fita (em cm da parede): os módulos de 3 vidros de altura, com a moldura de ferro. */
  function ribbonWindow(ctx, x, y, w, h, r, grade) {
    ctx.fillStyle = SCHOOL.frame;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    const n = Math.max(1, Math.round(w / 105));
    const uw = w / n;
    const rows = 3;
    const rh = h / rows;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < rows; j++) {
        const px = x + i * uw + 5, py = y + j * rh + 4, pw = uw - 10, ph = rh - 8;
        const k = r();
        if (k < 0.22) {
          // quebrado: o escuro de dentro
          ctx.fillStyle = SCHOOL.hole;
          ctx.fillRect(px, py, pw, ph);
        } else if (k < 0.34) {
          // o basculante aberto: o vidro virado (mais claro e mais baixo) e o vão escuro em cima
          ctx.fillStyle = SCHOOL.hole;
          ctx.fillRect(px, py, pw, ph * 0.45);
          ctx.fillStyle = M.shade(SCHOOL.pane, 0.18);
          ctx.fillRect(px, py + ph * 0.45, pw, ph * 0.55);
        } else {
          ctx.fillStyle = SCHOOL.pane;
          ctx.fillRect(px, py, pw, ph);
          ctx.fillStyle = SCHOOL.paneHi;
          ctx.fillRect(px + pw * 0.12, py, pw * 0.16, ph);
        }
      }
    }
    // a grade do térreo (barras de ferro na frente do vidro)
    if (grade) {
      ctx.strokeStyle = 'rgba(40, 44, 48, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let u = x + 14; u < x + w; u += 22) {
        ctx.moveTo(u, y - 4);
        ctx.lineTo(u, y + h + 4);
      }
      ctx.stroke();
    }
  }
  /** O mural pintado pelos alunos (desbotado): o céu, o sol, os morros, a árvore e as mãozinhas coloridas. */
  function schoolMural(ctx, x, y, w, h, r) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#7fb7d8';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#f2c84b';
    ctx.beginPath();
    ctx.arc(x + w * 0.78, y + h * 0.28, h * 0.16, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#5c9a4a';
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.quadraticCurveTo(x + w * 0.25, y + h * 0.35, x + w * 0.55, y + h * 0.8);
    ctx.quadraticCurveTo(x + w * 0.75, y + h * 0.5, x + w, y + h * 0.75);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6a4a2e';
    ctx.fillRect(x + w * 0.3 - 8, y + h * 0.42, 16, h * 0.45);
    ctx.fillStyle = '#3f7f3a';
    ctx.beginPath();
    ctx.arc(x + w * 0.3, y + h * 0.4, h * 0.2, 0, M.TAU);
    ctx.fill();
    const HANDS = ['#e2552f', '#e8c020', '#2f6fb0', '#c4508a', '#f07a2a', '#4f9f5f'];
    for (let k = 0; k < 9; k++) {
      const hx = x + 30 + r() * (w - 60), hy = y + h * 0.55 + r() * h * 0.35;
      ctx.fillStyle = HANDS[Math.floor(r() * HANDS.length)];
      ctx.beginPath();
      ctx.ellipse(hx, hy, 14, 17, 0, 0, M.TAU);
      ctx.fill();
      for (let f = 0; f < 4; f++) ctx.fillRect(hx - 12 + f * 7, hy - 30, 5, 16);
    }
    ctx.restore();
    // desbotado e descascando
    ctx.fillStyle = 'rgba(230, 226, 214, 0.3)';
    for (let k = 0; k < 7; k++) ctx.fillRect(x + r() * w, y + r() * h, 20 + r() * 50, 8 + r() * 20);
    ctx.strokeStyle = 'rgba(60, 56, 50, 0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }
  /** A entrada: a placa com o nome (letras azuis no branco) e o portão de grade de duas folhas, fechado com corrente. */
  function schoolEntrance(ctx, b, x, w, top, H, band, r) {
    const bw = w - 20;
    ctx.fillStyle = '#ece8dc';
    ctx.fillRect(x + 10, top + 24, bw, 84);
    ctx.strokeStyle = band;
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 10, top + 24, bw, 84);
    if (b.paint) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = 46;
      ctx.font = `${size}px ${ST_FONT}`;
      while (ctx.measureText(b.paint).width > bw - 30 && size > 18) ctx.font = `${--size}px ${ST_FONT}`;
      ctx.fillStyle = band;
      ctx.fillText(b.paint, x + w / 2, top + 67);
      ctx.restore();
    }
    // o portão: a moldura, as barras e a corrente com o cadeado no meio
    const gy = top + 128, gh = H - gy;
    ctx.fillStyle = 'rgba(30, 34, 38, 0.85)';
    ctx.fillRect(x + 30, gy, w - 60, gh);
    ctx.strokeStyle = '#5d646b';
    ctx.lineWidth = 7;
    ctx.strokeRect(x + 30, gy, w - 60, gh);
    ctx.beginPath();
    ctx.moveTo(x + w / 2, gy);
    ctx.lineTo(x + w / 2, H);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let u = x + 50; u < x + w - 40; u += 18) {
      ctx.moveTo(u, gy + 6);
      ctx.lineTo(u, H - 4);
    }
    ctx.moveTo(x + 30, gy + gh * 0.45);
    ctx.lineTo(x + w - 30, gy + gh * 0.45);
    ctx.stroke();
    ctx.strokeStyle = '#9a8a5a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x + w / 2, gy + gh * 0.45, 22, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.fillStyle = '#c9a640';
    ctx.fillRect(x + w / 2 - 9, gy + gh * 0.45 + 18, 18, 16);
  }
  /** Os andares da escola numa parede (a frente ou o lado). */
  function schoolWall(ctx, b, len, H, fh, floors, r, side) {
    const band = b.band || SCHOOL.band;
    ctx.fillStyle = band;
    ctx.fillRect(0, 18, len, 42);
    for (let f = 1; f < floors; f++) {
      ctx.fillStyle = band;
      ctx.fillRect(0, H - f * fh - 28, len, 28);
    }
    const bays = Math.max(1, Math.round((len - 60) / 500));
    const bw = (len - 60) / bays;
    // os pilares de concreto aparente (mais claros, com a sombra de um lado)
    for (let i = 0; i <= bays; i++) {
      const px = 30 + i * bw;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.fillRect(px - 16, 60, 32, H - 60);
      ctx.fillStyle = 'rgba(70, 64, 56, 0.2)';
      ctx.fillRect(px + 16, 60, 5, H - 60);
    }
    const mid = Math.floor(bays / 2);
    for (let f = 0; f < floors; f++) {
      const top = H - (f + 1) * fh;
      for (let i = 0; i < bays; i++) {
        const x0 = 30 + i * bw + 26, w = bw - 52;
        if (!side && f === 0 && i === mid) {
          schoolEntrance(ctx, b, x0, w, top, H, band, r);
          continue;
        }
        if (!side && f === 0 && i === mid + 1) {
          schoolMural(ctx, x0, top + fh * 0.2, w, fh * 0.68, r);
          continue;
        }
        ribbonWindow(ctx, x0, top + fh * 0.24, w, fh * 0.4, r, f === 0);
      }
    }
  }
  PD.city.facades = PD.city.facades || {};
  PD.city.facades.escola = {
    front: (ctx, b, W, H, fh, floors, r) => schoolWall(ctx, b, W, H, fh, floors, r, false),
    side: (ctx, b, D, H, fh, floors, r) => schoolWall(ctx, b, D, H, fh, floors, r, true),
  };

  // ------------------------------------------------------------------ o alambrado (a tela de arame da quadra)
  // Os postes de cano galvanizado de 2,5 em 2,5 m, o cano de cima e a tela em losangos (dá para ver através dela),
  // com um rasgo aqui e ali (`torn`) e o cipó subindo. Em pedaços (tmj.js): cada pedaço desenha a sua parte.
  small.alambrado = {
    fades: false,
    height: (d) => d.h + 20,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, d.h * 0.25),
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + d.h + 10, 20),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const alongY = d.whole.y1 - d.whole.y0 > d.whole.x1 - d.whole.x0;
      const rnd = seeded(d.x0, d.y0, 3401);
      const zt = z0 + d.h;
      // a reta do alambrado (no meio da caixa fina) e os postes
      const a = alongY ? { x: (d.x0 + d.x1) / 2, y: d.y1 } : { x: d.x0, y: (d.y0 + d.y1) / 2 };
      const L = alongY ? d.y1 - d.y0 : d.x1 - d.x0;
      const at = (u) => (alongY ? { x: a.x, y: a.y - u } : { x: a.x + u, y: a.y });
      // a tela: losangos de arame, transparentes
      H.onWall(ctx, cam, { ...at(0), z: zt }, alongY ? { x: 0, y: -1 } : { x: 1, y: 0 }, () => {
        const hole = d.torn || rnd() < 0.3 ? { u: 40 + rnd() * (L - 120), v: d.h * (0.35 + rnd() * 0.4), r: 30 + rnd() * 40 } : null;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 6, L, d.h - 6);
        if (hole) ctx.ellipse(hole.u, hole.v, hole.r * 1.3, hole.r, 0.4, 0, M.TAU);
        ctx.clip('evenodd');
        ctx.strokeStyle = 'rgba(150, 156, 160, 0.55)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        const s = 16;
        for (let k = -d.h; k < L + d.h; k += s) {
          ctx.moveTo(k, 6);
          ctx.lineTo(k + d.h, d.h);
          ctx.moveTo(k + d.h, 6);
          ctx.lineTo(k, d.h);
        }
        ctx.stroke();
        ctx.restore();
        // a beirada torta da tela em volta do rasgo
        if (hole) {
          ctx.strokeStyle = 'rgba(120, 126, 130, 0.8)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(hole.u, hole.v, hole.r * 1.3, hole.r, 0.4, 0, M.TAU);
          ctx.stroke();
        }
        // o cipó subindo pela tela
        if (d.vine > 0) {
          for (let k = 0; k < Math.round(d.vine * L / 120); k++) {
            const u = rnd() * L, top = d.h * (0.2 + rnd() * 0.6);
            ctx.strokeStyle = 'rgba(64, 98, 44, 0.9)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(u, d.h);
            ctx.bezierCurveTo(u + 20, d.h * 0.8, u - 20, top + 40, u + 6, top);
            ctx.stroke();
            for (let j = 0; j < 6; j++) {
              ctx.fillStyle = j % 2 ? '#4e8a3a' : '#3d7330';
              ctx.beginPath();
              ctx.ellipse(u + (rnd() - 0.5) * 30, top + (d.h - top) * (j / 6), 9, 6, rnd() * 3, 0, M.TAU);
              ctx.fill();
            }
          }
        }
      });
      // o cano de cima e os postes (de 2,5 em 2,5 m, mais um nas pontas do alambrado inteiro)
      const pipe = '#8e969c';
      inkLine(ctx, [P(at(0).x, at(0).y, zt), P(at(L).x, at(L).y, zt)], pipe, Math.max(1, 3 * cam.zoom), ink);
      const post = (u) => {
        const q = at(u);
        inkLine(ctx, [P(q.x, q.y, z0), P(q.x, q.y, zt + 6)], pipe, Math.max(1.2, 4.5 * cam.zoom), ink);
      };
      // (contados do começo do alambrado inteiro: o desenho continua de um pedaço para o outro)
      const g0 = alongY ? d.whole.y1 - d.y1 : d.x0 - d.whole.x0;
      for (let gu = Math.ceil(g0 / 250 - 1e-6) * 250; gu < g0 + L - 1; gu += 250) post(gu - g0);
      if (d.piece === d.pieces - 1) post(L);
    },
  };
  // ------------------------------------------------------------------ a feira livre (Capão maior, 23/11)
  // As lonas (`lona`): uma por fileira de bancas, cada banca com a lona listrada da cor do pano dela, inclinada para a
  // frente (a câmera vê o tampo), com o babado na beira e os canos de ferro; fica por cima de quem passa embaixo dela
  // (como a copa das árvores). A banca de pastel com caldo de cana (`banca-pastel`) e o carrinho de feira de quem compra
  // (`carrinho-feira`). Feira viva: colorida, sem cipó.
  const TARP = ['#2f6fb0', '#e8c020', '#e2552f', '#4f9f5f', '#f07a2a', '#c4508a'];
  small.lona = {
    overhead: true,
    fades: true,
    height: (d) => (d.h || 260) + 30,
    blocks: 0,
    shadow(p, cam, d) {
      const L = cam.light;
      const h = d.hf || 235;
      const dx = (-L.x / L.z) * h, dy = (-L.y / L.z) * h;
      p.moveTo(d.x0 + dx, d.y0 + dy);
      p.lineTo(d.x1 + dx, d.y0 + dy);
      p.lineTo(d.x1 + dx, d.y1 + dy);
      p.lineTo(d.x0 + dx, d.y1 + dy);
      p.closePath();
    },
    box: (cam, d, z0) => volBox(cam, d.x0 - 20, d.x1 + 20, d.y0 - 20, d.y1 + 20, z0 + 80, z0 + (d.h || 260) + 20, 20),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const zb = z0 + (d.h || 260), zf = z0 + (d.hf || 235);
      const n = Math.max(1, d.stalls || Math.round((d.x1 - d.x0) / 260));
      const sw = (d.x1 - d.x0) / n;
      const pole = '#7d858b';
      const poleAt = (x, y, za, zt) => inkLine(ctx, [P(x, y, za), P(x, y, zt)], pole, Math.max(1, 2.6 * cam.zoom), ink);
      // os canos de trás (atrás das bancas)
      for (let i = 0; i <= n; i++) poleAt(d.x0 + i * sw, d.y0 + 6, z0, zb);
      for (let i = 0; i < n; i++) {
        const xa = d.x0 + i * sw, xb = xa + sw;
        const col = (d.colors && d.colors[i]) || TARP[(i + Math.round(d.x0 / 100)) % TARP.length];
        // o pano: listras no sentido da descida (cor e branco), com a barriga de leve no meio
        const strips = 8;
        for (let k = 0; k < strips; k++) {
          const u0 = xa + (sw * k) / strips, u1 = xa + (sw * (k + 1)) / strips;
          const sag = (u) => 10 * Math.sin((Math.PI * (u - xa)) / sw);
          fill(ctx, [P(u0, d.y0, zb - sag(u0)), P(u1, d.y0, zb - sag(u1)), P(u1, d.y1, zf - sag(u1)), P(u0, d.y1, zf - sag(u0))], k % 2 ? '#f4f1e8' : col);
        }
        edge(ctx, P(xa, d.y0, zb), P(xb, d.y0, zb), ink, 1.2);
        // o babado da beira da frente (os dentinhos)
        const vh = 22;
        for (let k = 0; k < 6; k++) {
          const u0 = xa + (sw * k) / 6, u1 = xa + (sw * (k + 1)) / 6, um = (u0 + u1) / 2;
          inkPoly(ctx, [P(u0, d.y1, zf), P(u1, d.y1, zf), P(u1, d.y1, zf - vh * 0.55), P(um, d.y1, zf - vh), P(u0, d.y1, zf - vh * 0.55)], k % 2 ? '#f4f1e8' : M.shade(col, -0.08), ink, 1);
        }
      }
      // os canos da frente (só a parte de cima da banca para cima: o pé fica atrás do balcão)
      for (let i = 0; i <= n; i++) poleAt(d.x0 + i * sw, d.y1, z0 + 92, zf);
    },
  };
  // a banca de pastel com o caldo de cana: o balcão de azulejo, a estufa de vidro com os pastéis, o tacho de óleo no
  // fogareiro, o botijão, a moenda de cana com o feixe de cana do lado e a plaquinha pendurada
  small['banca-pastel'] = {
    height: (d) => (d.h || 90) + 140,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, (d.h || 90) * 0.9),
    box: (cam, d, z0) => volBox(cam, d.x0 - 30, d.x1 + 30, d.y0 - 20, d.y1 + 20, z0, z0 + 230, 16),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const rnd = seeded(d.x0, d.y0, 3501);
      const h = d.h || 90;
      const zt = z0 + h;
      // o botijão e o fogareiro com o tacho (no fundo), e a moenda de cana (no canto de trás à direita)
      const bx = d.x0 + 28, by = d.y0 + 30;
      H.box(ctx, cam, bx - 16, bx + 16, by - 16, by + 16, z0, z0 + 62, { front: '#d9772e', side: '#b25f22', top: '#e8925a' }, ink);
      H.box(ctx, cam, d.x0 + 70, d.x0 + 150, d.y0 + 12, d.y0 + 62, z0, z0 + 78, { front: '#3c3f43', side: '#2c2f33', top: '#4a4e53' }, ink);
      const tc = P(d.x0 + 110, d.y0 + 37, z0 + 86);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(tc.x, tc.y, 36 * cam.zoom, 17 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#c9932e';
      ctx.beginPath();
      ctx.ellipse(tc.x, tc.y, 31 * cam.zoom, 14 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
      for (let k = 0; k < 3; k++) {
        // dois pastéis fritando e o vapor subindo
        const q = P(d.x0 + 96 + k * 14, d.y0 + 32 + k * 4, z0 + 87);
        ctx.fillStyle = '#e9b04c';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, 9 * cam.zoom, 5 * cam.zoom, 0.3, Math.PI, M.TAU);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = Math.max(1, 2.4 * cam.zoom);
      for (let k = 0; k < 2; k++) {
        const a = P(d.x0 + 100 + k * 20, d.y0 + 37, z0 + 95), b = P(d.x0 + 108 + k * 20, d.y0 + 37, z0 + 150);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(a.x + 8 * cam.zoom, (a.y + b.y) / 2, b.x, b.y);
        ctx.stroke();
      }
      const mx0 = d.x1 - 78, my0 = d.y0 + 10;
      H.box(ctx, cam, mx0, mx0 + 62, my0, my0 + 50, z0, z0 + 104, { front: '#c23b2e', side: '#962a20', top: '#d65a4c' }, ink);
      const wheel = P(mx0 + 62, my0 + 25, z0 + 82);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, 3.4 * cam.zoom);
      ctx.beginPath();
      ctx.ellipse(wheel.x, wheel.y, 10 * cam.zoom, 22 * cam.zoom, 0, 0, M.TAU);
      ctx.stroke();
      // o feixe de cana encostado na moenda
      for (let k = 0; k < 7; k++) {
        const x = d.x1 - 14 + (rnd() - 0.5) * 16, y = d.y0 + 20 + k * 6;
        inkLine(ctx, [P(x, y, z0), P(x - 6 + rnd() * 12, y - 4, z0 + 190 + rnd() * 30)], k % 2 ? '#c9b25a' : '#8fae4a', Math.max(1, 3 * cam.zoom), ink * 0.6);
      }
      // o balcão de azulejo branco com a faixa vermelha, o tampo de inox e a estufa com os pastéis
      const yb = d.y1 - 60;
      H.box(ctx, cam, d.x0, d.x1, yb, d.y1, z0, zt, { front: '#f1efe8', side: '#d3d0c6', top: '#c9ccd0' }, ink);
      H.onWall(ctx, cam, { x: d.x0, y: d.y1, z: zt }, { x: 1, y: 0 }, () => {
        const W = d.x1 - d.x0;
        ctx.strokeStyle = 'rgba(120, 120, 120, 0.35)';
        ctx.lineWidth = 2;
        for (let u = 15; u < W; u += 15) {
          ctx.beginPath();
          ctx.moveTo(u, 0);
          ctx.lineTo(u, h);
          ctx.stroke();
        }
        for (let v = 15; v < h; v += 15) {
          ctx.beginPath();
          ctx.moveTo(0, v);
          ctx.lineTo(W, v);
          ctx.stroke();
        }
        ctx.fillStyle = '#c8442d';
        ctx.fillRect(0, h * 0.35, W, 16);
      });
      const ex0 = d.x0 + 40, ex1 = d.x0 + 150;
      H.box(ctx, cam, ex0, ex1, yb + 8, d.y1 - 8, zt, zt + 40, { front: 'rgba(200, 230, 240, 0.45)', side: 'rgba(170, 205, 220, 0.45)', top: 'rgba(220, 240, 245, 0.5)' }, ink);
      for (let k = 0; k < 5; k++) {
        const q = P(ex0 + 16 + k * 20, yb + 30, zt + 10);
        ctx.fillStyle = '#e3a443';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, 9 * cam.zoom, 6 * cam.zoom, 0, Math.PI, M.TAU);
        ctx.fill();
        ctx.strokeStyle = '#a8701f';
        ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
        ctx.stroke();
      }
      // os copos de caldo de cana em cima do balcão
      for (let k = 0; k < 3; k++) {
        const x = d.x0 + 180 + k * 18;
        H.box(ctx, cam, x - 5, x + 5, yb + 25, yb + 35, zt, zt + 16, { front: '#c9d36a', side: '#aab450', top: '#e4ec9a' }, ink * 0.6);
      }
      // a plaquinha pendurada na frente (debaixo da lona)
      // (duas linhas, cabendo na placa: o PASTEL grande e o CALDO DE CANA embaixo)
      H.onWall(ctx, cam, { x: d.x0 + 40, y: d.y1 - 30, z: z0 + 208 }, { x: 1, y: 0 }, () => {
        const W = d.x1 - d.x0 - 80;
        ctx.fillStyle = '#f2c84b';
        ctx.fillRect(0, 0, W, 50);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, W, 50);
        ctx.fillStyle = '#8a2a1e';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fit = (text, size) => {
          ctx.font = `${size}px ${ST_FONT}`;
          while (ctx.measureText(text).width > W - 16 && size > 8) ctx.font = `${--size}px ${ST_FONT}`;
        };
        fit('PASTEL', 26);
        ctx.fillText('PASTEL', W / 2, 18);
        fit('CALDO DE CANA', 15);
        ctx.fillText('CALDO DE CANA', W / 2, 39);
      });
    },
  };
  // o carrinho de feira de quem compra: as duas rodinhas, o cano dobrado e a sacola xadrez com verdura saindo
  small['carrinho-feira'] = {
    height: () => 110,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x - 18, d.x + 18, d.y - 14, d.y + 14, 60),
    box: (cam, d, z0) => volBox(cam, d.x - 40, d.x + 40, d.y - 40, d.y + 40, z0, z0 + 130, 12),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const rnd = seeded(d.x, d.y, 3601);
      const a = ((d.angle || 0) * Math.PI) / 180;
      const [ux, uy] = [Math.cos(a), Math.sin(a)];
      const at = (s, t, z) => P(d.x + ux * s - uy * t, d.y + uy * s + ux * t, z0 + z);
      const bag = d.color || '#b8323a';
      // a sacola (uma caixa inclinada para trás) com o xadrez
      const corners = (z) => [at(-14, -12, z), at(14, -12, z), at(14, 12, z), at(-14, 12, z)];
      const lo = corners(14), hi = corners(78).map((q) => ({ x: q.x - 4 * cam.zoom, y: q.y }));
      inkPoly(ctx, [lo[0], lo[1], lo[2], hi[2], hi[1], hi[0]], bag, ink, 1.6);
      inkPoly(ctx, [lo[1], lo[2], hi[2], hi[1]], M.shade(bag, -0.2), ink, 1);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = Math.max(1, 2 * cam.zoom);
      for (let k = 1; k < 4; k++) {
        const t = k / 4;
        const l = { x: lo[0].x + (lo[1].x - lo[0].x) * t, y: lo[0].y + (lo[1].y - lo[0].y) * t };
        const h2 = { x: hi[0].x + (hi[1].x - hi[0].x) * t, y: hi[0].y + (hi[1].y - hi[0].y) * t };
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(h2.x, h2.y);
        ctx.stroke();
      }
      // a verdura saindo de cima (alface, salsinha) e o cano do carrinho com as rodinhas
      for (let k = 0; k < 4; k++) {
        const q = at(-8 + k * 6, -4 + rnd() * 8, 84 + rnd() * 10);
        ctx.fillStyle = k % 2 ? '#6ea84a' : '#4f8f3a';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, 9 * cam.zoom, 6 * cam.zoom, rnd() * 3, 0, M.TAU);
        ctx.fill();
      }
      inkLine(ctx, [at(-16, 0, 6), at(-18, 0, 100), at(-12, 0, 106)], '#8e969c', Math.max(1, 2.4 * cam.zoom), ink);
      for (const t of [-12, 12]) {
        const w = at(-16, t, 7);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(w.x, w.y, 6 * cam.zoom, 7 * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
    },
  };
  // ------------------------------------------------------------------ a ponte, o ferro-velho e o morro (Capão maior)
  // A ponte da Rua do Córrego (`ponte`): cada mureta de concreto é um objeto (a caixa fina dela, para quem anda na ponte
  // ficar entre as duas no desenho), com os furinhos de escoar, musgo e pichação; a do leste (`lado: 'leste'`) desenha
  // também a lateral da laje descendo até a água (abaixo do chão: a água parece passar lá embaixo, na sombra da ponte).
  small.ponte = {
    height: (d) => d.h || 105,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, d.h || 105),
    box: (cam, d, z0) => volBox(cam, d.x0 - 20, d.x1 + (d.side === 'leste' ? 280 : 20), d.y0 - 20, d.y1 + 20, z0 - (d.drop || 150) - 50, z0 + (d.h || 105) + 20, 20),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const rnd = seeded(d.x0, d.y0, 3701);
      const drop = d.drop || 150, wh = d.h || 105;
      const C = { front: '#a9a497', side: '#8f8a7e', top: '#bbb6a9' };
      if (d.side === 'leste') {
        // a lateral da laje que a câmera vê (a de +x), descendo até a água, e a sombra embaixo da ponte
        const ya = d.y0 + 30, yb = d.y1 - 30;
        fill(ctx, [P(d.x1, ya, z0 - drop - 40), P(d.x1 + 260, ya, z0 - drop - 40), P(d.x1 + 260, yb, z0 - drop - 40), P(d.x1, yb, z0 - drop - 40)], 'rgba(10, 24, 26, 0.28)');
        inkPoly(ctx, [P(d.x1, ya, z0), P(d.x1, yb, z0), P(d.x1, yb, z0 - drop), P(d.x1, ya, z0 - drop)], C.side, ink, 1.8);
        H.onWall(ctx, cam, { x: d.x1, y: yb, z: z0 }, { x: 0, y: -1 }, () => {
          const L = yb - ya;
          // a viga da beirada, as manchas de água escorrida, o cano e o musgo perto da água
          ctx.fillStyle = 'rgba(60, 56, 50, 0.3)';
          ctx.fillRect(0, 0, L, 18);
          for (let k = 0; k < 8; k++) {
            ctx.fillStyle = 'rgba(54, 50, 44, 0.25)';
            ctx.fillRect(rnd() * L, 18, 8 + rnd() * 14, drop * (0.4 + rnd() * 0.6));
          }
          ctx.fillStyle = '#6b7075';
          ctx.fillRect(0, 34, L, 14);
          ctx.fillStyle = 'rgba(78, 116, 56, 0.55)';
          for (let k = 0; k < 10; k++) {
            ctx.beginPath();
            ctx.ellipse(rnd() * L, drop - rnd() * 30, 14 + rnd() * 20, 8 + rnd() * 10, 0, 0, M.TAU);
            ctx.fill();
          }
        });
      }
      // a mureta, com os furinhos de escoar no pé, o musgo e a pichação no lado que a câmera vê (o de +x)
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + wh, C, ink);
      H.onWall(ctx, cam, { x: d.x1, y: d.y1, z: z0 + wh }, { x: 0, y: -1 }, () => {
        const L = d.y1 - d.y0;
        ctx.fillStyle = '#4c4a44';
        for (let u = 60; u < L - 40; u += 180) ctx.fillRect(u, wh - 22, 26, 14);
        ctx.fillStyle = 'rgba(86, 118, 52, 0.5)';
        for (let k = 0; k < 6; k++) {
          ctx.beginPath();
          ctx.ellipse(rnd() * L, wh - 6, 16 + rnd() * 18, 10, 0, 0, M.TAU);
          ctx.fill();
        }
        // (a pichação em tamanho de mureta: a metade da de parede)
        if (d.pixo) {
          ctx.save();
          ctx.scale(0.45, 0.45);
          H.pixo(ctx, L / 0.45, 30, seeded(d.x1, d.y0, 3711), 0.8);
          ctx.restore();
        }
      });
    },
  };
  // a pilha de sucata do ferro-velho (`sucata`): geladeira deitada, máquina de lavar, bicicleta torta, canos, chapas
  // e calotas enferrujadas, amontoadas num monte com mato nascendo
  small.sucata = {
    height: (d) => (d.r || 100) * 1.2,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x - d.r * 0.8, d.x + d.r * 0.8, d.y - d.r * 0.7, d.y + d.r * 0.7, d.r * 0.6),
    box: (cam, d, z0) => volBox(cam, d.x - d.r - 30, d.x + d.r + 30, d.y - d.r - 30, d.y + d.r + 30, z0, z0 + d.r * 1.4 + 40, 16),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const rnd = seeded(d.x, d.y, 3801);
      const r = d.r || 100;
      const RUST = ['#8a4a2a', '#a35a32', '#6e3d24', '#7a7d80', '#5e6265', '#b9b4a8', '#3e6f9a', '#c8442d'];
      // o monte (a ferrugem amontoada, mais alto no meio) e as peças por cima dele, de trás para a frente
      const top = r * 0.72;
      const ring = [];
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * M.TAU;
        ring.push({ x: d.x + Math.cos(a) * r * (0.92 + rnd() * 0.12), y: d.y + Math.sin(a) * r * 0.82 * (0.92 + rnd() * 0.12) });
      }
      const hullPts = ring.map((q) => P(q.x, q.y, z0)).concat([P(d.x, d.y, z0 + top)]);
      const S = PD.shapes;
      const flat = [];
      for (const q of hullPts) flat.push(q.x, q.y);
      const hull = S && S.convexHull ? S.convexHull(flat) : flat;
      const outline = [];
      for (let i = 0; i < hull.length; i += 2) outline.push({ x: hull[i], y: hull[i + 1] });
      inkPoly(ctx, outline, '#5b3a26', ink, 1.6);
      // a luz de um lado do monte e a sombra do outro
      const lit = [P(d.x - r * 0.9, d.y, z0), P(d.x, d.y - r * 0.8, z0), P(d.x, d.y, z0 + top)];
      fill(ctx, lit, 'rgba(160, 96, 56, 0.35)');
      const items = [];
      for (let k = 0; k < 22; k++) {
        const a = rnd() * M.TAU, rr = Math.sqrt(rnd()) * r * 0.8;
        const f = rr / r;
        items.push({ x: d.x + Math.cos(a) * rr, y: d.y + Math.sin(a) * rr * 0.82, z: (1 - f * f) * top * 0.92, k: Math.floor(rnd() * 4), c: RUST[Math.floor(rnd() * RUST.length)], s: 16 + rnd() * 22 });
      }
      items.sort((a, b) => a.x + a.y + a.z * 0.2 - (b.x + b.y + b.z * 0.2));
      for (const it of items) {
        const zb = z0 + it.z;
        if (it.k === 0) {
          // um eletrodoméstico (geladeira ou máquina) tombado
          H.box(ctx, cam, it.x - it.s, it.x + it.s, it.y - it.s * 0.6, it.y + it.s * 0.6, zb, zb + it.s * 0.9, { front: it.c, side: M.shade(it.c, -0.25), top: M.shade(it.c, 0.12) }, ink);
        } else if (it.k === 1) {
          // chapa torta
          inkPoly(ctx, [P(it.x - it.s, it.y - 10, zb), P(it.x + it.s, it.y - 4, zb + 8), P(it.x + it.s * 0.8, it.y + 12, zb + it.s * 0.7), P(it.x - it.s * 0.9, it.y + 6, zb + it.s * 0.5)], it.c, ink, 1.2);
        } else if (it.k === 2) {
          // canos
          for (let j = 0; j < 3; j++) inkLine(ctx, [P(it.x - it.s, it.y + j * 8, zb + 6 + j * 4), P(it.x + it.s, it.y + j * 8 - 10, zb + 10 + j * 4)], '#8e969c', Math.max(1, 3 * cam.zoom), ink * 0.6);
        } else {
          // a roda de bicicleta / a calota
          const q = P(it.x, it.y, zb + it.s * 0.6);
          ctx.strokeStyle = INK;
          ctx.lineWidth = Math.max(1, 3 * cam.zoom);
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, it.s * 0.7 * cam.zoom, it.s * 0.55 * cam.zoom, 0.4, 0, M.TAU);
          ctx.stroke();
          ctx.strokeStyle = '#9aa0a4';
          ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
          ctx.stroke();
        }
      }
      // o mato tomando o monte
      for (let k = 0; k < 4; k++) grass(ctx, cam, d.x + (rnd() - 0.5) * r * 1.4, d.y + (rnd() - 0.3) * r, z0, 22 + rnd() * 10, rnd, ink);
    },
  };
  // o corrimão do escadão (`corrimao`): o cano de ferro nos postinhos, de uma ponta à outra da caixa fina
  small.corrimao = {
    height: () => 100,
    blocks: 0,
    shadow: () => {},
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + 100, 12),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const alongY = d.y1 - d.y0 >= d.x1 - d.x0;
      const a = alongY ? { x: (d.x0 + d.x1) / 2, y: d.y0 } : { x: d.x0, y: (d.y0 + d.y1) / 2 };
      const L = alongY ? d.y1 - d.y0 : d.x1 - d.x0;
      const at = (u) => (alongY ? { x: a.x, y: a.y + u } : { x: a.x + u, y: a.y });
      const col = '#6d7378';
      for (let u = 0; u <= L + 1; u += Math.max(120, L / Math.max(1, Math.round(L / 160)))) {
        const q = at(Math.min(u, L));
        inkLine(ctx, [P(q.x, q.y, z0), P(q.x, q.y, z0 + 92)], col, Math.max(1, 2.6 * cam.zoom), ink * 0.8);
      }
      inkLine(ctx, [P(at(0).x, at(0).y, z0 + 90), P(at(L).x, at(L).y, z0 + 90)], col, Math.max(1, 3 * cam.zoom), ink * 0.8);
    },
  };
  // os "gatos" (`gatos`): a fiação puxada de casa em casa por cima das vielas, três ou quatro fios caindo em barriga, com
  // a pipa enroscada num deles. Fica por cima de quem passa embaixo
  small.gatos = {
    overhead: true,
    height: (d) => d.h + 40,
    blocks: 0,
    shadow: () => {},
    box: (cam, d, z0) => volBox(cam, d.x0 - 40, d.x1 + 40, d.y0 - 40, d.y1 + 40, z0 + d.h - 160, z0 + d.h + 60, 16),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const rnd = seeded(d.x0, d.y0, 3901);
      const pts = d.pts || [];
      for (let i = 0; i + 1 < pts.length; i++) {
        const [a, b] = [pts[i], pts[i + 1]];
        const strands = 3 + Math.floor(rnd() * 2);
        for (let s = 0; s < strands; s++) {
          const za = z0 + d.h + s * 10 - 10, sag = 40 + rnd() * 60;
          const q0 = P(a.x, a.y, za), q1 = P(b.x, b.y, za - rnd() * 15);
          const mid = P((a.x + b.x) / 2, (a.y + b.y) / 2, za - sag);
          ctx.strokeStyle = 'rgba(24, 22, 26, 0.85)';
          ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
          ctx.beginPath();
          ctx.moveTo(q0.x, q0.y);
          ctx.quadraticCurveTo(2 * mid.x - (q0.x + q1.x) / 2, 2 * mid.y - (q0.y + q1.y) / 2, q1.x, q1.y);
          ctx.stroke();
        }
        // a pipa enroscada (losango colorido com a rabiola pendurada)
        if (d.kite && i === Math.floor((pts.length - 1) / 2)) {
          const k = P((a.x + b.x) / 2, (a.y + b.y) / 2, z0 + d.h - 50);
          const s = 16 * cam.zoom;
          ctx.fillStyle = d.kite;
          ctx.strokeStyle = INK;
          ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
          ctx.beginPath();
          ctx.moveTo(k.x, k.y - s);
          ctx.lineTo(k.x + s * 0.8, k.y);
          ctx.lineTo(k.x, k.y + s * 1.2);
          ctx.lineTo(k.x - s * 0.8, k.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = d.kite;
          ctx.beginPath();
          ctx.moveTo(k.x, k.y + s * 1.2);
          ctx.quadraticCurveTo(k.x + s, k.y + s * 2.4, k.x - s * 0.4, k.y + s * 3.4);
          ctx.stroke();
        }
      }
    },
  };
})(window.PD = window.PD || {});
