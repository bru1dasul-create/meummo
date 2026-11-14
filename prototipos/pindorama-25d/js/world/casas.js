// Casas com interior (planta aprovada pelo dono em 13/11: docs/referencias/casas-interior-planta.jpg; os alvos
// casa-amarela-dentro.jpg, casa-rosa-dentro.jpg e casa-abandonada-dentro.jpg dão o clima). Como na Budega: com o
// herói dentro, o telhado e a frente saem e aparece o que tem lá dentro.
//  - móveis (só aparecem com a casa cortada; world.js): pia, fogão com a panela, filtro de barro no banquinho, mesa da
//    cozinha (toalha xadrez), estante com a TV de tubo, sofá (de costas, de lado, com crochê, rasgado com mato),
//    cristaleira, mesa redonda (toalha de crochê), máquina de costura, cama com colcha de retalhos, vasos
//    (espada-de-são-jorge e samambaia), o entulho com a cadeira caída e a geladeira de casa (a da Budega é a de bebidas);
//  - chão (visto de cima, em cm): cerâmica, taco, cimento rachado com folhas e as raízes da árvore, o tapete e o
//    colchão velho (a espessura dele é desenhada no próprio chão, como o meio-fio);
//  - as paredes de dentro de cada morador: a família (azulejo verde na cozinha, janela, santinho, relógio, calendário e
//    fotos), a vó (oratório com vela, fotos antigas, janela com cortina de renda) e ninguém (tijolo, reboco caindo, cipó).
//   PD.city.small[tipo] = { height, blocks, lift, box, shadow, paint, live }   (props.js, como as plantas)
//   PD.street.texture[tipo](ctx, forma, caixa, semente, chão) → o chão (ground.js)
//   PD.casas.innerWall(ctx, b, parede, comprimento, altura) → uma parede de dentro (props.js, HouseBack)
(function (PD) {
  'use strict';
  const M = PD.math;
  const H = PD.props.help;
  const { INK } = H;
  const poly = PD.props.poly;
  const small = PD.city.small;
  const G = PD.groundHelp;
  const texture = PD.street.texture;
  const DEG = Math.PI / 180;

  // ------------------------------------------------------------------ ajudantes
  const seeded = (x, y, k) => M.rng((Math.round(x * 3.7) * 73856093) ^ (Math.round(y * 5.3) * 19349663) ^ (k * 83492791));
  /** As três faces de uma cor (frente, lado mais escuro, topo mais claro). */
  const tone = (c, k = 1) => ({ front: c, side: M.shade(c, -0.2 * k), top: M.shade(c, 0.13 * k) });
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
  function volBox(cam, x0, x1, y0, y1, za, zb, pad = 16) {
    const pts = [];
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) pts.push(cam.p({ x, y, z: za }), cam.p({ x, y, z: zb }));
    return bboxOf(pts, pad * cam.zoom);
  }
  /** A caixa na tela de um móvel retangular (com folga em volta e em cima). */
  const boxOf = (top = 0, grow = 0) => (cam, d, z0, h) => volBox(cam, d.x0 - grow, d.x1 + grow, d.y0 - grow, d.y1 + grow, z0, z0 + h + top);
  const shadowOf = (k = 0.45) => (path, cam, d, h) => H.boxShadow(path, cam, d.x0, d.x1, d.y0, d.y1, h * k);
  /** Pinta num plano deitado na altura z (o chão, um tampo, a cama): dá para desenhar direto em cm do mundo. */
  function onFloor(ctx, cam, z, fn) {
    const o = cam.p({ x: 0, y: 0, z });
    const ex = cam.pDir({ x: 1, y: 0, z: 0 });
    const ey = cam.pDir({ x: 0, y: 1, z: 0 });
    ctx.save();
    ctx.transform(ex.x, ex.y, ey.x, ey.y, o.x, o.y);
    fn();
    ctx.restore();
  }
  /** Um círculo deitado de raio r (cm) vira na tela uma elipse rx × ry. */
  const ellR = (cam, r) => ({ rx: r * cam.zoom, ry: r * cam.zoom * cam.sinP });
  /** Cilindro em pé (vaso, panela, filtro): corpo com a luz à esquerda, contorno e a tampa de cima. */
  function cyl(ctx, cam, x, y, r, z0, z1, c, ink, opt = {}) {
    const { rx, ry } = ellR(cam, r);
    const b = cam.p({ x, y, z: z0 });
    const t = cam.p({ x, y, z: z1 });
    const rt = opt.top != null ? opt.top / r : 1; // boca mais larga ou mais estreita que o pé
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(t.x - rx * rt, t.y);
    ctx.ellipse(t.x, t.y, rx * rt, ry * rt, 0, Math.PI, 0, true);
    ctx.closePath();
    const g = ctx.createLinearGradient(t.x - rx, 0, t.x + rx, 0);
    g.addColorStop(0, c.front[0] === '#' ? M.shade(c.front, 0.12) : c.front);
    g.addColorStop(0.45, c.front);
    g.addColorStop(1, c.side);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 1.8;
    ctx.stroke();
    if (opt.open) return { b, t, rx: rx * rt, ry: ry * rt };
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, rx * rt, ry * rt, 0, 0, M.TAU);
    ctx.fillStyle = c.top;
    ctx.fill();
    ctx.lineWidth = ink * 1.1;
    ctx.stroke();
    return { b, t, rx: rx * rt, ry: ry * rt };
  }
  /** Caixa de móvel (para juntar várias e desenhar da mais longe para a mais perto: a câmera olha de +x+y). */
  const bx = (x0, x1, y0, y1, z0, z1, c, k = 1) => ({ x0, x1, y0, y1, z0, z1, c, k });
  function boxes(ctx, cam, list, ink) {
    list.sort((a, b) => a.x0 + a.x1 + a.y0 + a.y1 - (b.x0 + b.x1 + b.y0 + b.y1) || a.z0 - b.z0);
    for (const q of list) H.box(ctx, cam, q.x0, q.x1, q.y0, q.y1, q.z0, q.z1, q.c, ink * q.k);
  }
  /**
   * O referencial de um móvel: `u` ao longo da frente, `v` do encosto/fundo (0) para a frente. `olhando` 90 = sul
   * (o padrão, a frente que a câmera vê), 0 = leste (a câmera também vê), 270 = norte e 180 = oeste (de costas).
   */
  function frame(d) {
    const a = ((((d.angle ?? 90) % 360) + 360) % 360);
    const alongX = a === 90 || a === 270;
    const len = alongX ? d.x1 - d.x0 : d.y1 - d.y0;
    const depth = alongX ? d.y1 - d.y0 : d.x1 - d.x0;
    const at = (u0, u1, v0, v1) => {
      if (a === 90) return { x0: d.x0 + u0, x1: d.x0 + u1, y0: d.y0 + v0, y1: d.y0 + v1 };
      if (a === 270) return { x0: d.x0 + u0, x1: d.x0 + u1, y0: d.y1 - v1, y1: d.y1 - v0 };
      if (a === 0) return { x0: d.x0 + v0, x1: d.x0 + v1, y0: d.y0 + u0, y1: d.y0 + u1 };
      return { x0: d.x1 - v1, x1: d.x1 - v0, y0: d.y0 + u0, y1: d.y0 + u1 };
    };
    // a face que a câmera vê do móvel inteiro: a frente (sul/leste) ou as costas (norte/oeste)
    const side = alongX ? 'y' : 'x';
    return { a, alongX, len, depth, at, side, frontSeen: a === 90 || a === 0 };
  }
  /** Pinta na face +y ('y') ou +x ('x') de uma caixa (topo em zTop): o desenho recebe o comprimento da face, em cm. */
  function face(ctx, cam, r, side, zTop, fn) {
    if (side === 'y') H.onWall(ctx, cam, { x: r.x0, y: r.y1 + 0.4, z: zTop }, { x: 1, y: 0 }, () => fn(r.x1 - r.x0));
    else H.onWall(ctx, cam, { x: r.x1 + 0.4, y: r.y1, z: zTop }, { x: 0, y: -1 }, () => fn(r.y1 - r.y0));
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }
  function knob(ctx, x, y, r, c = '#c9a227') {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, M.TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  const grass = (ctx, cam, x, y, z, size, rnd, ink) => PD.city.grass && PD.city.grass(ctx, cam.p({ x, y, z }), size * cam.zoom, rnd, ink);

  // ------------------------------------------------------------------ cadeira, toalhas
  /**
   * Cadeira de madeira (assento a 44 cm, encosto de travessas), virada para `dir` (graus: 0 = leste, 90 = sul,
   * 180 = oeste, 270 = norte). Devolve as caixas: quem chama junta com as dele e desenha na ordem certa.
   */
  function chairBoxes(cx, cy, dir, z0, wood) {
    const s = 19, leg = 3.5;
    const legC = tone(M.shade(wood, -0.12)), seatC = tone(wood), backC = tone(M.shade(wood, 0.06));
    const out = [];
    for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lx = cx + ax * (s - leg), ly = cy + ay * (s - leg);
      out.push(bx(lx - leg / 2, lx + leg / 2, ly - leg / 2, ly + leg / 2, z0, z0 + 42, legC, 0.6));
    }
    out.push(bx(cx - s, cx + s, cy - s, cy + s, z0 + 42, z0 + 46, seatC, 0.8));
    const ux = Math.round(Math.cos(dir * DEG)), uy = Math.round(Math.sin(dir * DEG));
    const back = (t0, t1, za, zb) => {
      if (ux !== 0) {
        const x = cx - ux * (s - 1.5);
        return bx(x - 1.5, x + 1.5, cy + t0, cy + t1, za, zb, backC, 0.7);
      }
      const y = cy - uy * (s - 1.5);
      return bx(cx + t0, cx + t1, y - 1.5, y + 1.5, za, zb, backC, 0.7);
    };
    out.push(back(-s, -s + 4, z0 + 46, z0 + 96), back(s - 4, s, z0 + 46, z0 + 96), back(-s, s, z0 + 86, z0 + 96), back(-s, s, z0 + 66, z0 + 71));
    return out;
  }
  /** O padrão de um pano (em cm, num retângulo x, y, w, h): xadrez vermelho, crochê branco ou colcha de retalhos. */
  function clothPattern(ctx, kind, x, y, w, h, seed) {
    if (kind === 'xadrez') {
      const S = 9;
      ctx.fillStyle = '#fbf6ee';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(196, 38, 38, 0.5)';
      for (let i = Math.floor(x / S); i * S < x + w; i++) if (i % 2 === 0) ctx.fillRect(i * S, y, S, h);
      for (let j = Math.floor(y / S); j * S < y + h; j++) if (j % 2 === 0) ctx.fillRect(x, j * S, w, S);
      return;
    }
    if (kind === 'retalhos') {
      const S = 22;
      const C = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2e86c1', '#8e44ad', '#e84393', '#16a085', '#d35400', '#7f8c8d', '#f5cba7', '#a3cb38'];
      for (let i = Math.floor(x / S); i * S < x + w; i++) {
        for (let j = Math.floor(y / S); j * S < y + h; j++) {
          const r = M.rng(i * 7919 + j * 104729 + seed);
          const c = C[Math.floor(r() * C.length)];
          ctx.fillStyle = c;
          ctx.fillRect(i * S, j * S, S, S);
          const kindOf = r();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          if (kindOf < 0.25) {
            // bolinhas
            for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) ctx.fillRect(i * S + 4 + a * 6, j * S + 4 + b * 6, 2.4, 2.4);
          } else if (kindOf < 0.45) {
            // listras
            for (let a = 0; a < 4; a++) ctx.fillRect(i * S, j * S + 2 + a * 5.5, S, 2);
          } else if (kindOf < 0.6) {
            // xadrezinho
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            for (let a = 0; a < 4; a++) {
              ctx.fillRect(i * S + a * 5.5, j * S, 2.6, S);
              ctx.fillRect(i * S, j * S + a * 5.5, S, 2.6);
            }
          }
        }
      }
      // as costuras
      ctx.strokeStyle = 'rgba(60, 40, 30, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = Math.floor(x / S); i * S <= x + w; i++) {
        ctx.moveTo(i * S, y);
        ctx.lineTo(i * S, y + h);
      }
      for (let j = Math.floor(y / S); j * S <= y + h; j++) {
        ctx.moveTo(x, j * S);
        ctx.lineTo(x + w, j * S);
      }
      ctx.stroke();
      return;
    }
    // crochê: branco-creme com os furinhos em fileiras e uns pontos em flor
    ctx.fillStyle = '#f6f0e1';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(150, 132, 104, 0.42)';
    const S = 5;
    for (let i = Math.floor(x / S); i * S < x + w; i++) {
      for (let j = Math.floor(y / S); j * S < y + h; j++) {
        if ((i + j) % 2) continue;
        ctx.beginPath();
        ctx.arc(i * S + 2.5, j * S + 2.5, 1.1, 0, M.TAU);
        ctx.fill();
      }
    }
  }
  /** Toalha (ou colcha) sobre um tampo: o de cima e a barra caindo nos lados que a câmera vê, com a bainha. */
  function clothBox(ctx, cam, x0, x1, y0, y1, zt, drop, kind, ink, seed = 1) {
    const P = (x, y, z) => cam.p({ x, y, z });
    const zb = zt - drop;
    poly(ctx, [P(x0, y1, zb), P(x1, y1, zb), P(x1, y0, zb), P(x1, y0, zt), P(x0, y0, zt), P(x0, y1, zt)], null, INK, ink * 2.3);
    onFloor(ctx, cam, zt, () => {
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.clip();
      clothPattern(ctx, kind, x0, y0, x1 - x0, y1 - y0, seed);
    });
    const hem = (len) => {
      // a dobra de cima mais clara e a sombra embaixo; no crochê, a bainha de bicos
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(0, 0, len, 3);
      ctx.fillStyle = 'rgba(40, 20, 10, 0.16)';
      ctx.fillRect(0, drop - 4, len, 4);
    };
    face(ctx, cam, { x0, x1, y0, y1 }, 'y', zt, (len) => {
      ctx.beginPath();
      ctx.rect(0, 0, len, drop);
      ctx.clip();
      clothPattern(ctx, kind, 0, 0, len, drop, seed + 3);
      hem(len);
    });
    face(ctx, cam, { x0, x1, y0, y1 }, 'x', zt, (len) => {
      ctx.beginPath();
      ctx.rect(0, 0, len, drop);
      ctx.clip();
      clothPattern(ctx, kind, 0, 0, len, drop, seed + 5);
      hem(len);
      ctx.fillStyle = 'rgba(30, 20, 20, 0.18)';
      ctx.fillRect(0, 0, len, drop);
    });
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 0.8;
    ctx.beginPath();
    const a = P(x0, y1, zt), b = P(x1, y1, zt), c = P(x1, y0, zt);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.moveTo(b.x, b.y);
    const bb = P(x1, y1, zb);
    ctx.lineTo(bb.x, bb.y);
    ctx.stroke();
  }
  /** Toalha redonda (a da vó: crochê, com a barra de bicos caindo em volta). */
  function roundCloth(ctx, cam, x, y, r, zt, drop, kind, ink) {
    const { rx, ry } = ellR(cam, r);
    const t = cam.p({ x, y, z: zt });
    const b = cam.p({ x, y, z: zt - drop });
    // a barra: a metade da frente do cilindro, com a bainha de bicos
    ctx.beginPath();
    ctx.moveTo(t.x - rx, t.y);
    ctx.lineTo(b.x - rx, b.y);
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const a = Math.PI - (i / N) * Math.PI;
      const dip = i % 2 ? 0 : 3.5 * cam.zoom;
      ctx.lineTo(b.x + Math.cos(a) * rx, b.y + Math.sin(a) * ry + dip);
    }
    ctx.lineTo(t.x + rx, t.y);
    ctx.ellipse(t.x, t.y, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    const g = ctx.createLinearGradient(t.x - rx, 0, t.x + rx, 0);
    g.addColorStop(0, '#fbf7ec');
    g.addColorStop(0.6, '#efe6d2');
    g.addColorStop(1, '#d9ccb2');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 1.8;
    ctx.stroke();
    // furinhos da barra
    ctx.fillStyle = 'rgba(140, 120, 92, 0.5)';
    for (let i = 1; i < N; i++) {
      const a = Math.PI - (i / N) * Math.PI;
      const px = t.x + Math.cos(a) * rx * 0.97;
      for (let k = 1; k < 3; k++) {
        const py = t.y + Math.sin(a) * ry + ((b.y - t.y) * k) / 3;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.8, 1.3 * cam.zoom), 0, M.TAU);
        ctx.fill();
      }
    }
    // o tampo: o padrão em anéis
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, rx, ry, 0, 0, M.TAU);
    ctx.clip();
    ctx.fillStyle = '#f7f1e3';
    ctx.fillRect(t.x - rx, t.y - ry, rx * 2, ry * 2);
    ctx.strokeStyle = 'rgba(150, 132, 104, 0.5)';
    ctx.lineWidth = Math.max(0.8, 1.2 * cam.zoom);
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, (rx * k) / 4.4, (ry * k) / 4.4, 0, 0, M.TAU);
      ctx.setLineDash([2 * cam.zoom, 2.4 * cam.zoom]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, rx, ry, 0, 0, M.TAU);
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 1.1;
    ctx.stroke();
    void kind;
  }

  // ------------------------------------------------------------------ cozinha (casa amarela)
  small.pia = {
    height: (d) => (d.h || 90) + 30,
    blocks: 0,
    box: boxOf(40),
    shadow: shadowOf(0.5),
    paint(ctx, cam, d, z0, ink) {
      const F = frame(d);
      const h = d.h || 90;
      const kick = F.at(4, F.len - 4, 0, F.depth - 9);
      H.box(ctx, cam, kick.x0, kick.x1, kick.y0, kick.y1, z0, z0 + 9, tone('#3a2618'), ink);
      const body = F.at(2, F.len - 2, 0, F.depth - 4);
      H.box(ctx, cam, body.x0, body.x1, body.y0, body.y1, z0 + 9, z0 + h - 4, tone('#a0703f'), ink);
      face(ctx, cam, body, 'y', z0 + h - 4, (L) => {
        const hh = h - 13;
        ctx.strokeStyle = 'rgba(52, 28, 12, 0.8)';
        ctx.lineWidth = 2.2;
        // três gavetas à esquerda e duas portas
        const dw = L * 0.34;
        for (let k = 0; k < 3; k++) {
          rrect(ctx, 4, 4 + (k * hh) / 3, dw - 7, hh / 3 - 6, 2);
          ctx.stroke();
          knob(ctx, dw / 2 - 1.5, 4 + (k * hh) / 3 + hh / 6 - 3, 2.6, '#d8d2c4');
        }
        const pw = (L - dw - 6) / 2;
        for (let k = 0; k < 2; k++) {
          rrect(ctx, dw + 2 + k * (pw + 2), 4, pw - 2, hh - 6, 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.fillRect(dw + 6 + k * (pw + 2), 8, pw - 10, hh * 0.3);
          knob(ctx, dw + 2 + k * (pw + 2) + (k ? 6 : pw - 8), hh * 0.32, 2.6, '#d8d2c4');
        }
      });
      // o tampo de inox, com a cuba funda e a torneira de bica alta
      const top = F.at(0, F.len, 0, F.depth);
      H.box(ctx, cam, top.x0, top.x1, top.y0, top.y1, z0 + h - 4, z0 + h, { front: '#b9c0c6', side: '#98a0a7', top: '#dce1e4' }, ink);
      const sink = F.at(F.len * 0.4, F.len * 0.86, 10, F.depth - 9);
      const P = (x, y, z) => cam.p({ x, y, z });
      const zt = z0 + h;
      poly(ctx, [P(sink.x0, sink.y0, zt), P(sink.x1, sink.y0, zt), P(sink.x1, sink.y1, zt), P(sink.x0, sink.y1, zt)], '#7d868d', INK, ink * 1.2);
      // a parede de dentro da cuba (as do fundo, mais claras) e o ralo
      poly(ctx, [P(sink.x0, sink.y0, zt), P(sink.x1, sink.y0, zt), P(sink.x1 - 3, sink.y0 + 3, zt - 14), P(sink.x0 + 3, sink.y0 + 3, zt - 14)], '#a9b1b7');
      poly(ctx, [P(sink.x0, sink.y0, zt), P(sink.x0 + 3, sink.y0 + 3, zt - 14), P(sink.x0 + 3, sink.y1 - 3, zt - 14), P(sink.x0, sink.y1, zt)], '#c4cbd0');
      const dr = P((sink.x0 + sink.x1) / 2, (sink.y0 + sink.y1) / 2 + 2, zt - 14);
      ctx.fillStyle = '#3d4246';
      ctx.beginPath();
      ctx.ellipse(dr.x, dr.y, 2.4 * cam.zoom, 1.4 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
      const tapX = (sink.x0 + sink.x1) / 2, tapY = top.y0 + 5;
      const a = P(tapX, tapY, zt), b = P(tapX, tapY, zt + 26), c = P(tapX, tapY + 12, zt + 24);
      ctx.lineCap = 'round';
      for (const [w, col] of [[ink * 4.4, INK], [ink * 2.4, '#d6dbde']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.quadraticCurveTo(b.x + (c.x - b.x) * 0.2, b.y - 6 * cam.zoom, c.x, c.y);
        ctx.stroke();
      }
      // uma esponja e um copo do lado
      const sp = F.at(F.len * 0.12, F.len * 0.12 + 10, 12, 18);
      H.box(ctx, cam, sp.x0, sp.x1, sp.y0, sp.y1, zt, zt + 3, { front: '#f2d23c', side: '#cdb12f', top: '#7cc35a' }, ink * 0.6);
      cyl(ctx, cam, top.x0 + F.len * 0.25, (top.y0 + top.y1) / 2 - 4, 3.5, zt, zt + 10, { front: '#d9eef5', side: '#a9cbd6', top: '#eef8fb' }, ink * 0.7);
    },
  };
  small.fogao = {
    height: (d) => (d.h || 90) + 40,
    blocks: 0,
    box: boxOf(50),
    shadow: shadowOf(0.5),
    paint(ctx, cam, d, z0, ink) {
      const F = frame(d);
      const h = d.h || 90;
      const P = (x, y, z) => cam.p({ x, y, z });
      // pezinhos, o corpo esmaltado e o espelho de trás
      for (const [u, v] of [[4, 4], [F.len - 8, 4], [4, F.depth - 8], [F.len - 8, F.depth - 8]]) {
        const q = F.at(u, u + 4, v, v + 4);
        H.box(ctx, cam, q.x0, q.x1, q.y0, q.y1, z0, z0 + 6, tone('#2a2a2a'), ink * 0.6);
      }
      const body = F.at(0, F.len, 2, F.depth);
      H.box(ctx, cam, body.x0, body.x1, body.y0, body.y1, z0 + 6, z0 + h - 2, { front: '#eef0ee', side: '#c9cdca', top: '#f7f8f6' }, ink);
      face(ctx, cam, body, 'y', z0 + h - 2, (L) => {
        const hh = h - 8;
        // os botões em cima, a porta do forno com o vidro e o puxador, e a gaveta
        ctx.fillStyle = '#d9dcda';
        ctx.fillRect(0, 0, L, 13);
        for (let k = 0; k < 4; k++) knob(ctx, L * (0.16 + k * 0.17), 6.5, 3.6, '#2b2b2b');
        rrect(ctx, 5, 17, L - 10, hh * 0.58, 3);
        ctx.fillStyle = '#e4e7e5';
        ctx.fill();
        ctx.strokeStyle = '#8f9693';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        rrect(ctx, 11, 28, L - 22, hh * 0.38, 3);
        ctx.fillStyle = '#2d3236';
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(14, 31, (L - 28) * 0.3, hh * 0.3);
        ctx.fillStyle = '#9aa1a5';
        ctx.fillRect(10, 20, L - 20, 3.5);
        rrect(ctx, 5, 21 + hh * 0.6, L - 10, hh * 0.24, 2);
        ctx.strokeStyle = '#8f9693';
        ctx.stroke();
      });
      const back = F.at(0, F.len, 0, 3);
      H.box(ctx, cam, back.x0, back.x1, back.y0, back.y1, z0 + h - 2, z0 + h + 12, { front: '#e2e5e3', side: '#c0c4c1', top: '#f1f2f0' }, ink);
      // a mesa com as quatro bocas (grelha preta) e a panela numa delas
      const zt = z0 + h - 2;
      const burners = [[0.27, 0.36], [0.73, 0.36], [0.27, 0.74], [0.73, 0.74]];
      for (const [fu, fv] of burners) {
        const q = F.at(F.len * fu, F.len * fu + 1, F.depth * fv, F.depth * fv + 1);
        const c = P(q.x0, q.y0, zt + 0.5);
        const { rx, ry } = ellR(cam, 10);
        ctx.fillStyle = '#3a3d3f';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, rx, ry, 0, 0, M.TAU);
        ctx.fill();
        ctx.strokeStyle = '#151515';
        ctx.lineWidth = Math.max(1, 2 * cam.zoom);
        ctx.beginPath();
        ctx.moveTo(c.x - rx, c.y);
        ctx.lineTo(c.x + rx, c.y);
        ctx.moveTo(c.x, c.y - ry);
        ctx.lineTo(c.x, c.y + ry);
        ctx.stroke();
        ctx.fillStyle = '#6f7477';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, rx * 0.35, ry * 0.35, 0, 0, M.TAU);
        ctx.fill();
      }
      if (d.pot) {
        // a panela de alumínio com a tampa (a do feijão), as alças e uma frigideira na boca da frente
        const q = F.at(F.len * 0.27, F.len * 0.27 + 1, F.depth * 0.36, F.depth * 0.36 + 1);
        const pot = cyl(ctx, cam, q.x0, q.y0, 12, zt + 1, zt + 17, { front: '#c3c8cc', side: '#8e959a', top: '#d6dadd' }, ink);
        ctx.strokeStyle = INK;
        ctx.lineWidth = ink * 2.2;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(pot.t.x + s * pot.rx, pot.t.y + 3 * cam.zoom);
          ctx.lineTo(pot.t.x + s * (pot.rx + 4 * cam.zoom), pot.t.y + 2 * cam.zoom);
          ctx.stroke();
        }
        cyl(ctx, cam, q.x0, q.y0, 11, zt + 17, zt + 19, { front: '#b4babe', side: '#8e959a', top: '#dfe3e5' }, ink * 0.8);
        cyl(ctx, cam, q.x0, q.y0, 2, zt + 19, zt + 22, { front: '#2b2b2b', side: '#1b1b1b', top: '#444' }, ink * 0.6);
        const f = F.at(F.len * 0.73, F.len * 0.73 + 1, F.depth * 0.74, F.depth * 0.74 + 1);
        const pan = cyl(ctx, cam, f.x0, f.y0, 10, zt + 1, zt + 5, { front: '#3b3f42', side: '#25282a', top: '#4c5155' }, ink * 0.8);
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(2, 3.6 * cam.zoom);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pan.t.x + pan.rx * 0.9, pan.t.y + 1);
        ctx.lineTo(pan.t.x + pan.rx * 0.9 + 14 * cam.zoom, pan.t.y + 6 * cam.zoom);
        ctx.stroke();
      }
    },
  };
  small.filtro = {
    height: () => 125,
    blocks: 0,
    box: boxOf(10, 4),
    shadow: (path, cam, d, h) => H.circleShadow(path, cam, (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, 16, h * 0.6),
    paint(ctx, cam, d, z0, ink) {
      // o banquinho de madeira e o filtro de barro em cima (duas talhas, a tampa e a torneirinha)
      const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
      const legs = [];
      for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) legs.push(bx(cx + ax * 12 - 2, cx + ax * 12 + 2, cy + ay * 12 - 2, cy + ay * 12 + 2, z0, z0 + 52, tone('#7a4a2a'), 0.6));
      legs.push(bx(cx - 13, cx + 13, cy - 13, cy - 11, z0 + 22, z0 + 25, tone('#7a4a2a'), 0.5));
      boxes(ctx, cam, legs, ink);
      cyl(ctx, cam, cx, cy, 18, z0 + 52, z0 + 57, tone('#9a6a3e'), ink);
      const clay = { front: '#b8613a', side: '#8c4526', top: '#c97b52' };
      cyl(ctx, cam, cx, cy, 14, z0 + 57, z0 + 86, clay, ink, { top: 15 });
      // a faixa de baixo-relevo
      const band = cam.p({ x: cx, y: cy, z: z0 + 75 });
      const { rx, ry } = ellR(cam, 14.6);
      ctx.strokeStyle = 'rgba(70, 30, 14, 0.6)';
      ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
      ctx.beginPath();
      ctx.ellipse(band.x, band.y, rx, ry, 0, 0.1, Math.PI - 0.1);
      ctx.stroke();
      cyl(ctx, cam, cx, cy, 15, z0 + 86, z0 + 110, clay, ink, { top: 13 });
      cyl(ctx, cam, cx, cy, 13.5, z0 + 110, z0 + 114, { front: '#a85532', side: '#7e3c20', top: '#c77650' }, ink);
      cyl(ctx, cam, cx, cy, 3, z0 + 114, z0 + 119, { front: '#a85532', side: '#7e3c20', top: '#c77650' }, ink * 0.8);
      // a torneirinha (branca, de plástico) virada para a sala
      const t0 = cam.p({ x: cx + 9, y: cy + 11, z: z0 + 66 });
      const t1 = cam.p({ x: cx + 13, y: cy + 16, z: z0 + 64 });
      ctx.lineCap = 'round';
      for (const [w, c] of [[ink * 5, INK], [ink * 3, '#f2f2ec']]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(t0.x, t0.y);
        ctx.lineTo(t1.x, t1.y);
        ctx.lineTo(t1.x, t1.y + 4 * cam.zoom);
        ctx.stroke();
      }
      // a canequinha no banco
      cyl(ctx, cam, cx - 9, cy + 8, 3.6, z0 + 57, z0 + 64, { front: '#e9e4d6', side: '#c4bead', top: '#f3efe4' }, ink * 0.7);
    },
  };
  /** A geladeira de casa (branca, de duas portas, com ímãs e um vasinho em cima): a da Budega é a de bebidas (city.js). */
  function homeFridge(ctx, cam, d, z0, ink) {
    const F = frame(d);
    const h = d.h || 170;
    const body = F.at(0, F.len, 0, F.depth);
    H.box(ctx, cam, body.x0, body.x1, body.y0, body.y1, z0 + 4, z0 + h, { front: '#f1f2ee', side: '#cfd3cf', top: '#fafbf8' }, ink);
    face(ctx, cam, body, F.side, z0 + h, (L) => {
      const hh = h - 4;
      const split = hh * 0.32;
      // a divisão do congelador, os puxadores e os ímãs coloridos
      ctx.strokeStyle = '#9da39f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(2, split);
      ctx.lineTo(L - 2, split);
      ctx.stroke();
      ctx.fillStyle = '#b9bfbb';
      ctx.fillRect(6, split - 22, 4, 16);
      ctx.fillRect(6, split + 8, 4, 40);
      const r = seeded(d.x0, d.y0, 1501);
      const MAG = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#e67e22', '#9b59b6'];
      for (let k = 0; k < 7; k++) {
        ctx.fillStyle = MAG[Math.floor(r() * MAG.length)];
        const mx = 18 + r() * (L - 30), my = split + 14 + r() * hh * 0.4;
        if (r() < 0.5) {
          ctx.beginPath();
          ctx.arc(mx, my, 3.4, 0, M.TAU);
          ctx.fill();
        } else ctx.fillRect(mx - 3.5, my - 3.5, 7, 7);
      }
      // um papel preso (a lista do mercado) e um desenho de criança
      ctx.fillStyle = '#fbf8ee';
      ctx.fillRect(L * 0.45, split + 18, 14, 18);
      ctx.fillStyle = 'rgba(40, 60, 120, 0.6)';
      for (let k = 0; k < 4; k++) ctx.fillRect(L * 0.45 + 2, split + 22 + k * 3.5, 10 - (k % 2) * 4, 1);
      ctx.fillStyle = '#fbf8ee';
      ctx.fillRect(L * 0.18, split + 44, 18, 14);
      ctx.strokeStyle = '#e67e22';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(L * 0.18 + 9, split + 51, 3.6, 0, M.TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(L - 10, 6, 4, hh - 12);
    });
    // o vasinho de planta em cima, com folhas caindo
    const cx = (body.x0 + body.x1) / 2, cy = (body.y0 + body.y1) / 2;
    cyl(ctx, cam, cx, cy, 7, z0 + h, z0 + h + 11, { front: '#b8613a', side: '#8c4526', top: '#5a3a24' }, ink * 0.8);
    const r = seeded(cx, cy, 1503);
    for (let k = 0; k < 7; k++) {
      const a = r() * M.TAU;
      const p0 = cam.p({ x: cx, y: cy, z: z0 + h + 11 });
      const p1 = cam.p({ x: cx + Math.cos(a) * 16, y: cy + Math.sin(a) * 16, z: z0 + h + 4 - r() * 26 });
      ctx.strokeStyle = '#2f6a2e';
      ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(p1.x, p0.y - 4 * cam.zoom, p1.x, p1.y);
      ctx.stroke();
      ctx.fillStyle = k % 2 ? '#4f9a44' : '#3d7f37';
      ctx.beginPath();
      ctx.ellipse(p1.x, p1.y, 3.4 * cam.zoom, 2.2 * cam.zoom, a, 0, M.TAU);
      ctx.fill();
    }
  }
  // a geladeira da Budega fica; a de casa (o mapa diz `home` em tmj.js) é a branca
  if (small.geladeira) {
    const shop = small.geladeira.paint;
    small.geladeira.paint = function (ctx, cam, d, z0, ink) {
      if (d.home) return homeFridge(ctx, cam, d, z0, ink);
      return shop.call(this, ctx, cam, d, z0, ink);
    };
    const shopBox = small.geladeira.box;
    small.geladeira.box = (cam, d, z0, h) => (d.home ? boxOf(40)(cam, d, z0, h) : shopBox(cam, d, z0, h));
  }
  small['mesa-cozinha'] = {
    height: (d) => (d.h || 80) + 16,
    blocks: 0,
    box: (cam, d, z0) => volBox(cam, d.x0 - 46, d.x1 + 8, d.y0 - 8, d.y1 + 8, z0, z0 + 100),
    shadow: shadowOf(0.7),
    paint(ctx, cam, d, z0, ink) {
      const h = d.h || 80;
      const list = [];
      for (const [ax, ay] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const lx = ax ? d.x1 - 9 : d.x0 + 5, ly = ay ? d.y1 - 9 : d.y0 + 5;
        list.push(bx(lx, lx + 4, ly, ly + 4, z0, z0 + h - 3, tone('#6d4628'), 0.7));
      }
      // as cadeiras do lado oeste, viradas para a mesa (a planta)
      const n = d.chairs || 0;
      for (let k = 0; k < n; k++) list.push(...chairBoxes(d.x0 - 8, d.y0 + ((d.y1 - d.y0) * (k + 1)) / (n + 1), 0, z0, '#8a5a34'));
      boxes(ctx, cam, list, ink);
      clothBox(ctx, cam, d.x0 - 4, d.x1 + 4, d.y0 - 4, d.y1 + 4, z0 + h, 24, d.cloth || 'xadrez', ink, Math.round(d.x0));
      // uma fruteira com banana e laranja, e o pote de açúcar
      const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
      const bowl = cyl(ctx, cam, cx, cy - 12, 12, z0 + h, z0 + h + 6, { front: '#d9d2bf', side: '#b1a993', top: '#8a6a3e' }, ink * 0.8, { top: 14 });
      const fruit = [['#f2c230', 0, -3, 4.5], ['#f08a24', 4, 2, 4], ['#f08a24', -5, 3, 4], ['#c0392b', 1, 5, 3.6]];
      for (const [c, ox, oy, r] of fruit) {
        ctx.fillStyle = c;
        ctx.strokeStyle = INK;
        ctx.lineWidth = ink * 0.8;
        ctx.beginPath();
        ctx.arc(bowl.t.x + ox * cam.zoom, bowl.t.y + oy * cam.zoom * 0.6 - 3 * cam.zoom, r * cam.zoom, 0, M.TAU);
        ctx.fill();
        ctx.stroke();
      }
      cyl(ctx, cam, cx + 14, cy + 18, 5, z0 + h, z0 + h + 12, { front: '#e7e1d1', side: '#bfb8a6', top: '#c0392b' }, ink * 0.7);
    },
  };
  small.estante = {
    height: (d) => d.h || 140,
    blocks: 0,
    box: boxOf(30),
    shadow: shadowOf(0.4),
    paint(ctx, cam, d, z0, ink) {
      const F = frame(d);
      const wood = tone('#7a5232');
      const rackH = 58;
      // o rack: tampo, laterais, prateleira do meio e as coisas dentro (o aparelho de DVD, revistas, um porta-retrato)
      const back = F.at(0, F.len, 0, 3);
      H.box(ctx, cam, back.x0, back.x1, back.y0, back.y1, z0, z0 + rackH, tone('#4a3220'), ink);
      const shelf = F.at(0, F.len, 3, F.depth);
      H.box(ctx, cam, shelf.x0, shelf.x1, shelf.y0, shelf.y1, z0 + 26, z0 + 29, wood, ink * 0.8);
      const dvd = F.at(F.len * 0.55, F.len * 0.55 + 42, 8, F.depth - 6);
      H.box(ctx, cam, dvd.x0, dvd.x1, dvd.y0, dvd.y1, z0 + 29, z0 + 37, { front: '#2c2f33', side: '#1f2225', top: '#3a3e43' }, ink * 0.8);
      face(ctx, cam, dvd, 'y', z0 + 37, (L) => {
        ctx.fillStyle = '#58e07a';
        ctx.fillRect(L * 0.7, 3, 8, 2.4);
        ctx.fillStyle = '#4a4f55';
        ctx.fillRect(4, 3, L * 0.45, 2);
      });
      const r = seeded(d.x0, d.y0, 1511);
      let a = 8;
      while (a < F.len * 0.45) {
        const w = 3 + r() * 3, hh = 16 + r() * 8;
        const q = F.at(a, a + w, 8, F.depth - 8);
        H.box(ctx, cam, q.x0, q.x1, q.y0, q.y1, z0 + 29, z0 + 29 + hh, tone(['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#ecf0f1'][Math.floor(r() * 5)]), ink * 0.5);
        a += w + 0.6;
      }
      const mags = F.at(10, 60, 6, F.depth - 4);
      H.box(ctx, cam, mags.x0, mags.x1, mags.y0, mags.y1, z0 + 3, z0 + 9, { front: '#d9d2c2', side: '#b5ad9c', top: '#e05b4b' }, ink * 0.6);
      const legL = F.at(0, 3, 3, F.depth), legR = F.at(F.len - 3, F.len, 3, F.depth);
      H.box(ctx, cam, legL.x0, legL.x1, legL.y0, legL.y1, z0, z0 + rackH, wood, ink);
      const top = F.at(-2, F.len + 2, 0, F.depth + 2);
      H.box(ctx, cam, top.x0, top.x1, top.y0, top.y1, z0 + rackH - 4, z0 + rackH, wood, ink);
      H.box(ctx, cam, legR.x0, legR.x1, legR.y0, legR.y1, z0, z0 + rackH - 4, wood, ink);
      if (!d.tv) return;
      // a TV de tubo (caixa funda, cinza) com a antena de duas varetas
      const zt = z0 + rackH;
      const tw = 62;
      const tvBack = F.at(F.len * 0.3 + 8, F.len * 0.3 + tw - 8, 2, 20);
      H.box(ctx, cam, tvBack.x0, tvBack.x1, tvBack.y0, tvBack.y1, zt + 4, zt + 40, { front: '#4f4a45', side: '#3d3935', top: '#5f5a54' }, ink);
      const tv = F.at(F.len * 0.3, F.len * 0.3 + tw, 18, F.depth - 1);
      H.box(ctx, cam, tv.x0, tv.x1, tv.y0, tv.y1, zt, zt + 48, { front: '#5b5550', side: '#47423e', top: '#6b655f' }, ink);
      face(ctx, cam, tv, 'y', zt + 48, (L) => {
        // a tela abaulada, apagada (com o reflexo) e os botões do lado
        rrect(ctx, 5, 5, L * 0.74, 38, 7);
        ctx.fillStyle = '#1f2a30';
        ctx.fill();
        ctx.strokeStyle = '#2b2622';
        ctx.lineWidth = 2;
        ctx.stroke();
        const g = ctx.createLinearGradient(5, 5, L * 0.6, 40);
        g.addColorStop(0, 'rgba(160, 200, 220, 0.42)');
        g.addColorStop(0.5, 'rgba(160, 200, 220, 0.05)');
        g.addColorStop(1, 'rgba(160, 200, 220, 0.18)');
        ctx.fillStyle = g;
        rrect(ctx, 5, 5, L * 0.74, 38, 7);
        ctx.fill();
        for (let k = 0; k < 3; k++) knob(ctx, L * 0.87, 11 + k * 9, 2.4, '#2b2b2b');
        ctx.fillStyle = '#3a3531';
        for (let k = 0; k < 5; k++) ctx.fillRect(L * 0.82, 36 + k * 1.8, L * 0.12, 0.9);
      });
      const base = cam.p({ x: (tv.x0 + tv.x1) / 2 - 4, y: (tv.y0 + tv.y1) / 2 - 6, z: zt + 48 });
      for (const [ox, oy, oz] of [[-30, -6, 34], [26, 4, 40]]) {
        const tip = cam.p({ x: (tv.x0 + tv.x1) / 2 - 4 + ox, y: (tv.y0 + tv.y1) / 2 - 6 + oy, z: zt + 48 + oz });
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(1.2, 2.2 * cam.zoom);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        ctx.strokeStyle = '#c9ccce';
        ctx.lineWidth = Math.max(0.8, 1.1 * cam.zoom);
        ctx.stroke();
        ctx.fillStyle = '#c9ccce';
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, Math.max(1.2, 1.8 * cam.zoom), 0, M.TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, 5 * cam.zoom, 2.6 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
    },
  };

  // ------------------------------------------------------------------ sofá (família, vó e o da casa abandonada)
  small.sofa = {
    height: (d) => (d.h || 90) + 10,
    blocks: 0,
    box: boxOf(30, 6),
    shadow: shadowOf(0.45),
    paint(ctx, cam, d, z0, ink) {
      const F = frame(d);
      const h = d.h || 90;
      const base = d.color || '#7c5a3a';
      const fabric = tone(base, 1.1);
      const dark = tone(M.shade(base, -0.18), 1.1);
      const arm = 17, back = 20, seatZ = z0 + 42;
      const list = [];
      // pés, a base, as almofadas do assento, o encosto e os dois braços
      for (const [u, v] of [[3, 3], [F.len - 7, 3], [3, F.depth - 7], [F.len - 7, F.depth - 7]]) {
        const q = F.at(u, u + 4, v, v + 4);
        list.push(bx(q.x0, q.x1, q.y0, q.y1, z0, z0 + 8, tone('#2a1a10'), 0.6));
      }
      const baseB = F.at(0, F.len, 2, F.depth);
      list.push(bx(baseB.x0, baseB.x1, baseB.y0, baseB.y1, z0 + 8, seatZ - 8, dark, 1));
      const nC = F.len > 160 ? 3 : 2;
      const cw = (F.len - arm * 2) / nC;
      for (let k = 0; k < nC; k++) {
        const q = F.at(arm + k * cw + 0.8, arm + (k + 1) * cw - 0.8, back - 2, F.depth - 1);
        list.push(bx(q.x0, q.x1, q.y0, q.y1, seatZ - 8, seatZ + 4, fabric, 0.8));
      }
      const backB = F.at(0, F.len, 0, back);
      list.push(bx(backB.x0, backB.x1, backB.y0, backB.y1, seatZ - 8, z0 + h, fabric, 1));
      const armL = F.at(0, arm, 0, F.depth), armR = F.at(F.len - arm, F.len, 0, F.depth);
      list.push(bx(armL.x0, armL.x1, armL.y0, armL.y1, seatZ - 8, z0 + h - 26, fabric, 1));
      list.push(bx(armR.x0, armR.x1, armR.y0, armR.y1, seatZ - 8, z0 + h - 26, fabric, 1));
      boxes(ctx, cam, list, ink);
      // as costuras das almofadas do encosto (na face que a câmera vê) e a luz no alto do encosto
      face(ctx, cam, backB, F.side, z0 + h, (L) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(0, 0, L, 6);
        ctx.strokeStyle = 'rgba(30, 16, 8, 0.35)';
        ctx.lineWidth = 1.6;
        if (F.frontSeen) {
          for (let k = 1; k < nC; k++) {
            ctx.beginPath();
            ctx.moveTo(arm + k * cw, 4);
            ctx.lineTo(arm + k * cw, h - 46);
            ctx.stroke();
          }
        }
      });
      const P = (x, y, z) => cam.p({ x, y, z });
      if (d.doily) {
        // os paninhos de crochê no encosto e nos braços (a casa da vó)
        const spots = [F.at(F.len * 0.22, F.len * 0.22 + 30, 0, back), F.at(F.len * 0.62, F.len * 0.62 + 30, 0, back), F.at(1, arm - 1, F.depth * 0.25, F.depth * 0.25 + 26), F.at(F.len - arm + 1, F.len - 1, F.depth * 0.25, F.depth * 0.25 + 26)];
        spots.forEach((q, i) => {
          const z = i < 2 ? z0 + h + 0.5 : z0 + h - 25.5;
          const cx = (q.x0 + q.x1) / 2, cy = (q.y0 + q.y1) / 2;
          onFloor(ctx, cam, z, () => {
            const rx = (q.x1 - q.x0) / 2 + 2, ry = (q.y1 - q.y0) / 2 + 2;
            ctx.beginPath();
            const N = 18;
            for (let k = 0; k <= N; k++) {
              const a = (k / N) * M.TAU;
              const rr = 1 + (k % 2 ? 0.08 : -0.02);
              const px = cx + Math.cos(a) * rx * rr, py = cy + Math.sin(a) * ry * rr;
              if (k) ctx.lineTo(px, py);
              else ctx.moveTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = '#f7f1e3';
            ctx.fill();
            ctx.strokeStyle = 'rgba(120, 100, 70, 0.7)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.fillStyle = 'rgba(150, 130, 100, 0.45)';
            for (let k = 0; k < 10; k++) {
              const a = (k / 10) * M.TAU;
              ctx.beginPath();
              ctx.arc(cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.55, 1.2, 0, M.TAU);
              ctx.fill();
            }
          });
          // a barra caindo pela frente do encosto (os bicos)
          if (i < 2 && F.frontSeen) {
            face(ctx, cam, q, F.side, z0 + h, (L) => {
              ctx.fillStyle = '#f2ead8';
              ctx.beginPath();
              ctx.moveTo(0, 0);
              for (let k = 0; k <= 8; k++) ctx.lineTo((L * k) / 8, 9 + (k % 2) * 4);
              ctx.lineTo(L, 0);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = 'rgba(120, 100, 70, 0.7)';
              ctx.lineWidth = 1;
              ctx.stroke();
            });
          }
        });
      }
      if (d.torn) {
        // rasgado: manchas, a espuma amarela aparecendo, uma mola e o mato nascendo nas almofadas
        const r = seeded(d.x0, d.y0, 1521);
        for (let k = 0; k < nC; k++) {
          const q = F.at(arm + k * cw + 4, arm + (k + 1) * cw - 4, back + 2, F.depth - 4);
          onFloor(ctx, cam, seatZ + 4.2, () => {
            ctx.fillStyle = 'rgba(40, 30, 20, 0.35)';
            ctx.beginPath();
            ctx.ellipse(q.x0 + (q.x1 - q.x0) * r(), q.y0 + (q.y1 - q.y0) * r(), 9 + r() * 8, 6 + r() * 6, r() * 3, 0, M.TAU);
            ctx.fill();
            if (r() < 0.7) {
              ctx.fillStyle = '#e9cf7a';
              ctx.strokeStyle = 'rgba(40, 24, 10, 0.8)';
              ctx.lineWidth = 1.4;
              const ex = q.x0 + (q.x1 - q.x0) * (0.3 + r() * 0.4), ey = q.y0 + (q.y1 - q.y0) * (0.3 + r() * 0.4);
              ctx.beginPath();
              for (let i = 0; i < 9; i++) {
                const a = (i / 9) * M.TAU;
                const rr = (6 + r() * 6) * (i % 2 ? 0.6 : 1);
                if (i) ctx.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
                else ctx.moveTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
              }
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }
          });
        }
        const s0 = F.at(F.len * 0.5, F.len * 0.5 + 1, back + 10, back + 11);
        const sp = P(s0.x0, s0.y0, seatZ + 4);
        ctx.strokeStyle = '#8b8f92';
        ctx.lineWidth = Math.max(1, 1.5 * cam.zoom);
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const a = k * 1.2;
          const px = sp.x + Math.cos(a) * 3 * cam.zoom, py = sp.y - k * 1.1 * cam.zoom + Math.sin(a) * 1.4 * cam.zoom;
          if (k) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.stroke();
        // o braço rasgado e a mancha de bolor na face que a câmera vê
        face(ctx, cam, backB, F.side, z0 + h, (L) => {
          ctx.fillStyle = 'rgba(70, 90, 40, 0.35)';
          for (let k = 0; k < 5; k++) {
            ctx.beginPath();
            ctx.ellipse(r() * L, 10 + r() * (h - 50), 8 + r() * 10, 5 + r() * 8, 0, 0, M.TAU);
            ctx.fill();
          }
          ctx.strokeStyle = 'rgba(20, 10, 4, 0.8)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(L * 0.3, 12);
          ctx.lineTo(L * 0.36, 26);
          ctx.lineTo(L * 0.31, 38);
          ctx.stroke();
        });
      }
      if (d.weeds) {
        const r = seeded(d.x0, d.y0, 1523);
        for (let k = 0; k < 6; k++) {
          const q = F.at(arm + r() * (F.len - arm * 2), arm + 1, back + r() * (F.depth - back - 6), back + 1);
          grass(ctx, cam, q.x0, q.y0, seatZ + 4, 10 + r() * 9, r, ink);
        }
        const q = F.at(F.len - arm / 2, F.len - arm / 2 + 1, F.depth * 0.5, F.depth * 0.5 + 1);
        grass(ctx, cam, q.x0, q.y0, z0 + h - 26, 9, r, ink);
      }
    },
  };

  // ------------------------------------------------------------------ a casa da vó
  small.cristaleira = {
    height: (d) => d.h || 190,
    blocks: 0,
    box: boxOf(20),
    shadow: shadowOf(0.4),
    paint(ctx, cam, d, z0, ink) {
      const F = frame(d);
      const h = d.h || 190;
      const wood = tone('#5a3220', 1.1);
      const low = 84;
      // os pés torneados, o móvel de baixo (duas portas de almofada e a gaveta) e o de cima (vidro), um pouco mais raso
      for (const u of [3, F.len - 9]) {
        const q = F.at(u, u + 6, F.depth - 9, F.depth - 3);
        H.box(ctx, cam, q.x0, q.x1, q.y0, q.y1, z0, z0 + 7, tone('#3e2216'), ink * 0.7);
      }
      const lowB = F.at(0, F.len, 0, F.depth);
      H.box(ctx, cam, lowB.x0, lowB.x1, lowB.y0, lowB.y1, z0 + 7, z0 + low, wood, ink);
      face(ctx, cam, lowB, 'y', z0 + low, (L) => {
        const hh = low - 7;
        ctx.strokeStyle = 'rgba(20, 8, 2, 0.7)';
        ctx.lineWidth = 2;
        rrect(ctx, 5, 5, L - 10, 13, 2);
        ctx.stroke();
        knob(ctx, L / 2, 11.5, 2.4, '#caa45a');
        for (let k = 0; k < 2; k++) {
          const x = 5 + k * ((L - 10) / 2 + 1);
          const w = (L - 10) / 2 - 1;
          rrect(ctx, x, 22, w, hh - 28, 3);
          ctx.stroke();
          rrect(ctx, x + 7, 29, w - 14, hh - 42, 6);
          ctx.fillStyle = 'rgba(255, 220, 180, 0.07)';
          ctx.fill();
          ctx.stroke();
          knob(ctx, k ? x + 6 : x + w - 6, 22 + (hh - 28) / 2, 2.4, '#caa45a');
        }
      });
      const topZ = z0 + h - 10;
      const up = F.at(3, F.len - 3, 0, F.depth - 9);
      H.box(ctx, cam, up.x0, up.x1, up.y0, up.y1, z0 + low, topZ, wood, ink);
      face(ctx, cam, up, 'y', topZ, (L) => {
        const hh = topZ - z0 - low;
        // duas portas de vidro: dentro, as prateleiras com a louça (pratos em pé, xícaras, o bule)
        for (let k = 0; k < 2; k++) {
          const x = 5 + k * ((L - 10) / 2 + 1), w = (L - 10) / 2 - 1;
          ctx.fillStyle = '#3a2418';
          ctx.fillRect(x, 5, w, hh - 9);
          const g = ctx.createLinearGradient(x, 5, x + w, hh);
          g.addColorStop(0, '#b9d6dd');
          g.addColorStop(1, '#8fb2bc');
          ctx.fillStyle = g;
          ctx.fillRect(x + 4, 9, w - 8, hh - 17);
          const r = seeded(d.x0 + k, d.y0, 1531);
          for (let s = 0; s < 3; s++) {
            const sy = 9 + ((hh - 17) * (s + 1)) / 3;
            ctx.fillStyle = '#6b4a34';
            ctx.fillRect(x + 4, sy - 2, w - 8, 2.5);
            let a = x + 7;
            while (a < x + w - 12) {
              const t = r();
              if (t < 0.4) {
                // prato em pé
                ctx.fillStyle = '#f6f3ec';
                ctx.beginPath();
                ctx.ellipse(a + 5, sy - 9, 5, 8, 0, 0, M.TAU);
                ctx.fill();
                ctx.strokeStyle = '#3a7bd5';
                ctx.lineWidth = 1;
                ctx.stroke();
                a += 9;
              } else if (t < 0.75) {
                // xícara
                ctx.fillStyle = '#f6f3ec';
                ctx.fillRect(a, sy - 8, 7, 6);
                ctx.strokeStyle = '#c0392b';
                ctx.lineWidth = 1;
                ctx.strokeRect(a, sy - 8, 7, 6);
                ctx.beginPath();
                ctx.arc(a + 8, sy - 5, 2, -1.4, 1.4);
                ctx.stroke();
                a += 11;
              } else {
                // o bule
                ctx.fillStyle = '#f6f3ec';
                ctx.beginPath();
                ctx.ellipse(a + 6, sy - 7, 6, 5, 0, 0, M.TAU);
                ctx.fill();
                ctx.fillRect(a + 4, sy - 14, 4, 3);
                ctx.strokeStyle = '#3a7bd5';
                ctx.stroke();
                a += 14;
              }
            }
          }
          // o reflexo do vidro e o puxador
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.beginPath();
          ctx.moveTo(x + w * 0.2, 9);
          ctx.lineTo(x + w * 0.42, 9);
          ctx.lineTo(x + w * 0.14, hh - 8);
          ctx.lineTo(x + 4, hh - 8);
          ctx.lineTo(x + 4, hh * 0.7);
          ctx.closePath();
          ctx.fill();
          knob(ctx, k ? x + 5 : x + w - 5, hh / 2, 2.2, '#caa45a');
        }
      });
      // a cornija de cima com o frontão recortado
      const crown = F.at(0, F.len, 0, F.depth - 6);
      H.box(ctx, cam, crown.x0, crown.x1, crown.y0, crown.y1, topZ, topZ + 5, wood, ink);
      face(ctx, cam, crown, 'y', topZ + 16, (L) => {
        ctx.fillStyle = '#5a3220';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(L * 0.2, 11);
        ctx.quadraticCurveTo(L * 0.3, 2, L * 0.45, 4);
        ctx.quadraticCurveTo(L * 0.5, -2, L * 0.55, 4);
        ctx.quadraticCurveTo(L * 0.7, 2, L * 0.8, 11);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    },
  };
  small['mesa-redonda'] = {
    height: (d) => (d.h || 75) + 30,
    blocks: 0,
    box: (cam, d, z0) => volBox(cam, d.x0 - 50, d.x1 + 50, d.y0 - 14, d.y1 + 14, z0, z0 + 120),
    shadow: (path, cam, d, h) => H.circleShadow(path, cam, (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, (d.x1 - d.x0) / 2, h * 0.7),
    paint(ctx, cam, d, z0, ink) {
      const h = d.h || 75;
      const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2, r = (d.x1 - d.x0) / 2;
      // as cadeiras dos dois lados (a planta): a de trás (oeste) antes da mesa, a da frente (leste) depois
      const chairs = d.chairs || 0;
      const west = chairs >= 1 ? chairBoxes(d.x0 - 16, cy, 0, z0, '#6d4628') : [];
      const east = chairs >= 2 ? chairBoxes(d.x1 + 16, cy, 180, z0, '#6d4628') : [];
      boxes(ctx, cam, west, ink);
      // o pé de coluna com as três patas
      cyl(ctx, cam, cx, cy, 5, z0 + 8, z0 + h - 2, tone('#5a3220'), ink);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * M.TAU + 0.5;
        const p0 = cam.p({ x: cx, y: cy, z: z0 + 12 });
        const p1 = cam.p({ x: cx + Math.cos(a) * 24, y: cy + Math.sin(a) * 24, z: z0 });
        ctx.lineCap = 'round';
        for (const [w, c] of [[6.4, INK], [4, '#5a3220']]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = w * cam.zoom;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.quadraticCurveTo(p1.x, p0.y, p1.x, p1.y);
          ctx.stroke();
        }
      }
      roundCloth(ctx, cam, cx, cy, r + 8, z0 + h, 18, d.cloth || 'croche', ink);
      // o vasinho de vidro com as flores no meio
      const v = cyl(ctx, cam, cx, cy, 4, z0 + h, z0 + h + 13, { front: 'rgba(190, 225, 235, 0.85)', side: 'rgba(140, 185, 200, 0.85)', top: '#9fd0dc' }, ink * 0.7, { top: 3 });
      const FL = ['#e84393', '#f1c40f', '#8e44ad', '#ff7675', '#ffffff'];
      const rr = seeded(cx, cy, 1541);
      for (let k = 0; k < 7; k++) {
        const a = rr() * M.TAU;
        const fx = v.t.x + Math.cos(a) * (3 + rr() * 6) * cam.zoom, fy = v.t.y - (6 + rr() * 10) * cam.zoom;
        ctx.strokeStyle = '#3d7f37';
        ctx.lineWidth = Math.max(0.8, 1.1 * cam.zoom);
        ctx.beginPath();
        ctx.moveTo(v.t.x, v.t.y);
        ctx.lineTo(fx, fy);
        ctx.stroke();
        ctx.fillStyle = FL[k % FL.length];
        ctx.beginPath();
        ctx.arc(fx, fy, Math.max(1.3, 2.4 * cam.zoom), 0, M.TAU);
        ctx.fill();
      }
      boxes(ctx, cam, east, ink);
    },
  };
  small['maquina-costura'] = {
    height: (d) => (d.h || 80) + 36,
    blocks: 0,
    box: boxOf(40),
    shadow: shadowOf(0.5),
    paint(ctx, cam, d, z0, ink) {
      const F = frame(d);
      const h = d.h || 80;
      const P = (x, y, z) => cam.p({ x, y, z });
      // o pé de ferro preto, vazado: em cada lado, as duas pernas, as travessas e os arabescos (num plano de lado);
      // embaixo, o pedal de grade
      const iron = (u) => {
        for (const v of [5, F.depth - 8]) {
          const q = F.at(u, u + 3, v, v + 3);
          H.box(ctx, cam, q.x0, q.x1, q.y0, q.y1, z0, z0 + h - 8, { front: '#26282a', side: '#1b1c1e', top: '#3a3d40' }, ink * 0.7);
        }
        const plane = F.at(u + 1.5, u + 1.5, 5, F.depth - 5);
        const o = F.alongX ? { x: plane.x0, y: plane.y1, z: z0 + h - 8 } : { x: plane.x1, y: plane.y0, z: z0 + h - 8 };
        const dir = F.alongX ? { x: 0, y: -1 } : { x: 1, y: 0 };
        const L = F.depth - 10, hh = h - 8;
        H.onWall(ctx, cam, o, dir, () => {
          ctx.strokeStyle = '#1e1f21';
          ctx.lineCap = 'round';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, 6);
          ctx.lineTo(L, 6);
          ctx.moveTo(0, hh - 12);
          ctx.lineTo(L, hh - 12);
          ctx.stroke();
          ctx.lineWidth = 2;
          for (let k = 0; k < 2; k++) {
            ctx.beginPath();
            ctx.arc(L / 2, 20 + k * 22, 7, 0, M.TAU);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(2, hh - 14);
          ctx.quadraticCurveTo(L / 2, hh - 44, L - 2, hh - 14);
          ctx.moveTo(L / 2, 27);
          ctx.lineTo(L / 2, 35);
          ctx.stroke();
        });
      };
      iron(8);
      const pedal = F.at(14, F.len - 14, 10, F.depth - 8);
      H.box(ctx, cam, pedal.x0, pedal.x1, pedal.y0, pedal.y1, z0 + 6, z0 + 9, { front: '#2b2d2f', side: '#1c1d1f', top: '#3c4044' }, ink * 0.7);
      onFloor(ctx, cam, z0 + 9.2, () => {
        ctx.strokeStyle = '#55595d';
        ctx.lineWidth = 1.4;
        for (let k = 1; k < 8; k++) {
          ctx.beginPath();
          ctx.moveTo(pedal.x0 + ((pedal.x1 - pedal.x0) * k) / 8, pedal.y0 + 2);
          ctx.lineTo(pedal.x0 + ((pedal.x1 - pedal.x0) * k) / 8, pedal.y1 - 2);
          ctx.stroke();
        }
      });
      iron(F.len - 11);
      // o tampo de madeira com a gaveta
      const top = F.at(0, F.len, 0, F.depth);
      H.box(ctx, cam, top.x0, top.x1, top.y0, top.y1, z0 + h - 8, z0 + h, tone('#7a4a2a'), ink);
      face(ctx, cam, top, 'y', z0 + h, (L) => {
        ctx.strokeStyle = 'rgba(30, 14, 4, 0.7)';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(L * 0.38, 2, L * 0.24, 5);
        knob(ctx, L / 2, 4.5, 1.6, '#caa45a');
      });
      // a máquina preta com os enfeites dourados: a base, a coluna, o braço e a cabeça com a agulha, e o volante
      const zt = z0 + h;
      const blk = { front: '#1f2022', side: '#151617', top: '#34373a' };
      const bed = F.at(F.len * 0.22, F.len * 0.78, 10, F.depth - 14);
      H.box(ctx, cam, bed.x0, bed.x1, bed.y0, bed.y1, zt, zt + 4, blk, ink);
      const col = F.at(F.len * 0.64, F.len * 0.76, 12, F.depth - 18);
      H.box(ctx, cam, col.x0, col.x1, col.y0, col.y1, zt + 4, zt + 30, blk, ink);
      const armB = F.at(F.len * 0.26, F.len * 0.76, 13, F.depth - 19);
      H.box(ctx, cam, armB.x0, armB.x1, armB.y0, armB.y1, zt + 22, zt + 31, blk, ink);
      const head = F.at(F.len * 0.24, F.len * 0.34, 12, F.depth - 18);
      H.box(ctx, cam, head.x0, head.x1, head.y0, head.y1, zt + 12, zt + 31, blk, ink);
      face(ctx, cam, armB, 'y', zt + 31, (L) => {
        ctx.strokeStyle = '#d4a93c';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(4, 3);
        ctx.bezierCurveTo(L * 0.3, 8, L * 0.6, -1, L - 4, 4);
        ctx.stroke();
        ctx.fillStyle = '#d4a93c';
        ctx.font = '700 4.5px serif';
        ctx.fillText('SINGELA', L * 0.3, 7.4);
      });
      const needle0 = P((head.x0 + head.x1) / 2, head.y1 - 2, zt + 12);
      const needle1 = P((head.x0 + head.x1) / 2, head.y1 - 2, zt + 5);
      ctx.strokeStyle = '#d6dbde';
      ctx.lineWidth = Math.max(0.8, 1 * cam.zoom);
      ctx.beginPath();
      ctx.moveTo(needle0.x, needle0.y);
      ctx.lineTo(needle1.x, needle1.y);
      ctx.stroke();
      const wheel = F.at(F.len * 0.78, F.len * 0.78 + 3, (F.depth - 14) / 2 + 4, (F.depth - 14) / 2 + 5);
      const wc = P(wheel.x1, wheel.y0, zt + 21);
      ctx.fillStyle = '#26282a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 1.4;
      ctx.beginPath();
      ctx.ellipse(wc.x, wc.y, 4 * cam.zoom, 7.5 * cam.zoom, 0.5, 0, M.TAU);
      ctx.fill();
      ctx.stroke();
      // um carretel de linha vermelha e um pano dobrado do lado
      cyl(ctx, cam, (armB.x0 + armB.x1) / 2, (armB.y0 + armB.y1) / 2, 1.8, zt + 31, zt + 36, { front: '#c0392b', side: '#922b21', top: '#e6b8a2' }, ink * 0.5);
      const cloth = F.at(F.len * 0.04, F.len * 0.2, 8, F.depth - 8);
      H.box(ctx, cam, cloth.x0, cloth.x1, cloth.y0, cloth.y1, zt, zt + 4, tone('#7fb3d5'), ink * 0.6);
    },
  };
  small.cama = {
    height: (d) => (d.h || 60) + 50,
    blocks: 0,
    box: boxOf(60, 6),
    shadow: shadowOf(0.4),
    paint(ctx, cam, d, z0, ink) {
      const h = d.h || 60;
      const wood = tone('#6d4628');
      // a cabeceira fica do lado oeste (o travesseiro na planta): é a coisa mais do fundo, vem primeiro
      const head = { x0: d.x0, x1: d.x0 + 7, y0: d.y0, y1: d.y1 };
      H.box(ctx, cam, head.x0, head.x1, head.y0, head.y1, z0, z0 + h + 40, wood, ink);
      face(ctx, cam, head, 'x', z0 + h + 40, (L) => {
        ctx.strokeStyle = 'rgba(30, 14, 4, 0.55)';
        ctx.lineWidth = 2;
        rrect(ctx, 8, 8, L - 16, 30, 6);
        ctx.stroke();
      });
      // os pés, o estrado e o colchão
      const list = [];
      for (const [x, y] of [[d.x0 + 8, d.y0 + 3], [d.x1 - 7, d.y0 + 3], [d.x0 + 8, d.y1 - 7], [d.x1 - 7, d.y1 - 7]]) list.push(bx(x, x + 4, y, y + 4, z0, z0 + 14, tone('#4a2e1a'), 0.6));
      list.push(bx(d.x0 + 6, d.x1, d.y0 + 2, d.y1 - 2, z0 + 14, z0 + 30, wood, 1));
      boxes(ctx, cam, list, ink);
      H.box(ctx, cam, d.x0 + 8, d.x1 - 1, d.y0 + 4, d.y1 - 4, z0 + 30, z0 + h - 6, { front: '#f3efe6', side: '#d6d0c4', top: '#faf7f1' }, ink);
      // o travesseiro e a colcha de retalhos (dobrada perto do travesseiro, caindo pelos lados)
      const pil = { x0: d.x0 + 12, x1: d.x0 + 48, y0: d.y0 + 12, y1: d.y1 - 12 };
      const P = (x, y, z) => cam.p({ x, y, z });
      const pz = z0 + h - 6;
      ctx.fillStyle = '#fbfaf6';
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 1.6;
      ctx.beginPath();
      const pts = [P(pil.x0, pil.y0, pz), P(pil.x1, pil.y0, pz), P(pil.x1, pil.y1, pz), P(pil.x0, pil.y1, pz)];
      const top = pts.map((q) => ({ x: q.x, y: q.y - 10 * cam.zoom }));
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.quadraticCurveTo((top[0].x + top[1].x) / 2, top[0].y - 2 * cam.zoom, pts[1].x, pts[1].y);
      ctx.quadraticCurveTo(top[1].x + 3 * cam.zoom, (top[1].y + top[2].y) / 2, pts[2].x, pts[2].y);
      ctx.quadraticCurveTo((top[2].x + top[3].x) / 2, top[2].y + 4 * cam.zoom, pts[3].x, pts[3].y);
      ctx.quadraticCurveTo(top[3].x - 3 * cam.zoom, (top[3].y + top[0].y) / 2, pts[0].x, pts[0].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(160, 150, 130, 0.35)';
      ctx.beginPath();
      ctx.ellipse((pts[1].x + pts[2].x) / 2, (pts[1].y + pts[2].y) / 2 - 4 * cam.zoom, 10 * cam.zoom, 3 * cam.zoom, 0.4, 0, M.TAU);
      ctx.fill();
      if (d.quilt) {
        clothBox(ctx, cam, d.x0 + 52, d.x1 + 2, d.y0 + 1, d.y1 + 1, z0 + h - 4, 26, d.quilt === 'retalhos' ? 'retalhos' : 'xadrez', ink, Math.round(d.y0));
        // a dobra branca do lençol aparecendo na beirada da colcha
        H.box(ctx, cam, d.x0 + 48, d.x0 + 56, d.y0 + 2, d.y1, z0 + h - 6, z0 + h - 2, { front: '#f3efe6', side: '#d6d0c4', top: '#fdfbf6' }, ink * 0.8);
      }
    },
  };
  /**
   * Vaso: a espada-de-são-jorge é a de sempre (city.js, a mesma da vila); a samambaia (a da vó) fica num banquinho de
   * três pés, com as folhas compridas caindo para todo lado.
   */
  const vasoRua = small.vaso;
  small.vaso = {
    ...vasoRua,
    height: (d) => (d.plant === 'samambaia' ? 110 : vasoRua.height(d)),
    box: (cam, d, z0, h) => (d.plant === 'samambaia' ? volBox(cam, d.x - 50, d.x + 50, d.y - 50, d.y + 50, z0, z0 + 110) : vasoRua.box(cam, d, z0, h)),
    paint(ctx, cam, d, z0, ink) {
      if (d.plant !== 'samambaia') return vasoRua.paint.call(this, ctx, cam, d, z0, ink);
      const x = d.x, y = d.y;
      const r = seeded(x, y, 1551);
      const clay = { front: '#b8613a', side: '#8c4526', top: '#c97b52' };
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * M.TAU + 0.6;
        const p0 = cam.p({ x: x + Math.cos(a) * 9, y: y + Math.sin(a) * 9, z: z0 + 38 });
        const p1 = cam.p({ x: x + Math.cos(a) * 15, y: y + Math.sin(a) * 15, z: z0 });
        for (const [w, c] of [[4.6, INK], [2.8, '#7a4a2a']]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = w * cam.zoom;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      }
      cyl(ctx, cam, x, y, 17, z0 + 38, z0 + 41, tone('#8a5a34'), ink);
      cyl(ctx, cam, x, y, 12, z0 + 41, z0 + 60, clay, ink, { top: 14 });
      const base = cam.p({ x, y, z: z0 + 60 });
      const fronds = [];
      for (let k = 0; k < 13; k++) {
        const a = (k / 13) * M.TAU + r() * 0.4;
        const len = 34 + r() * 22;
        fronds.push({ a, len, drop: 14 + r() * 26, depth: Math.cos(a) + Math.sin(a) });
      }
      // as de trás primeiro
      fronds.sort((p, q) => p.depth - q.depth);
      fronds.forEach((f, k) => {
        const tip = cam.p({ x: x + Math.cos(f.a) * f.len, y: y + Math.sin(f.a) * f.len, z: z0 + 60 - f.drop });
        const mid = cam.p({ x: x + Math.cos(f.a) * f.len * 0.5, y: y + Math.sin(f.a) * f.len * 0.5, z: z0 + 60 + 12 });
        frond(ctx, base, mid, tip, cam.zoom, k % 2 ? '#4f9a44' : '#3f8a3a', ink);
      });
    },
  };
  /** Folha de samambaia: a nervura curva e os folíolos dos dois lados. */
  function frond(ctx, a, m, t, zoom, color, ink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, ink * 1.4);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(m.x, m.y, t.x, t.y);
    ctx.stroke();
    ctx.fillStyle = color;
    const N = 9;
    for (let i = 1; i <= N; i++) {
      const s = i / (N + 1);
      const px = (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * m.x + s * s * t.x;
      const py = (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * m.y + s * s * t.y;
      const L = (1 - s * 0.7) * 6 * zoom;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(px + sgn * L * 0.5, py + L * 0.2, L * 0.62, L * 0.3, sgn * 0.6, 0, M.TAU);
        ctx.fill();
      }
    }
  }

  // ------------------------------------------------------------------ a casa abandonada
  /** O entulho (tijolos, pedaços de reboco e de laje) com a cadeira caída de lado (as pernas para o leste). */
  small.entulho = {
    height: () => 50,
    blocks: 0,
    box: (cam, d, z0) => volBox(cam, d.x - 60, d.x + 60, d.y - 50, d.y + 50, z0, z0 + 50),
    shadow: () => {},
    paint(ctx, cam, d, z0, ink) {
      const r = seeded(d.x, d.y, 1561);
      const P = (x, y, z) => cam.p({ x, y, z });
      // o monte: pó claro no chão, depois os pedaços (os de trás primeiro)
      onFloor(ctx, cam, z0 + 0.5, () => {
        ctx.fillStyle = 'rgba(190, 178, 160, 0.75)';
        ctx.beginPath();
        ctx.ellipse(d.x - 8, d.y, 46, 34, 0.3, 0, M.TAU);
        ctx.fill();
      });
      const bits = [];
      for (let k = 0; k < 16; k++) {
        const a = r() * M.TAU, rr = r() * 36;
        bits.push({ x: d.x - 10 + Math.cos(a) * rr, y: d.y + Math.sin(a) * rr * 0.8, brick: r() < 0.6, s: 6 + r() * 7, z: r() < 0.3 ? 6 : 0, rot: r() });
      }
      bits.sort((p, q) => p.x + p.y - (q.x + q.y));
      for (const q of bits) {
        const c = q.brick ? tone(['#a8583a', '#b8693f', '#94482e'][Math.floor(q.rot * 3)]) : tone('#b8b0a2');
        const w = q.brick ? q.s * 1.6 : q.s, dd = q.brick ? q.s * 0.8 : q.s * 0.9;
        H.box(ctx, cam, q.x - w / 2, q.x + w / 2, q.y - dd / 2, q.y + dd / 2, z0 + q.z, z0 + q.z + q.s * 0.55, c, ink * 0.7);
      }
      if (!d.chair) return;
      // a cadeira caída: o assento em pé (de lado), o encosto deitado no chão e as pernas apontando para o leste
      const cx = d.x + 18, cy = d.y + 6;
      const wood = tone('#7a4a2a');
      const list = [];
      list.push(bx(cx - 22, cx + 22, cy - 3, cy + 3, z0, z0 + 7, tone('#6b4024'), 0.7)); // encosto no chão (de lado)
      list.push(bx(cx - 6, cx - 2, cy - 18, cy + 18, z0, z0 + 40, wood, 0.8)); // o assento, de pé
      for (const oy of [-15, 13]) for (const oz of [4, 34]) list.push(bx(cx - 2, cx + 38, cy + oy, cy + oy + 3, z0 + oz, z0 + oz + 3, tone('#6b4024'), 0.6));
      boxes(ctx, cam, list, ink);
      // uma perna quebrada, solta do lado
      const a = P(cx + 30, cy + 26, z0 + 1), b = P(cx + 52, cy + 30, z0 + 1);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(2, 4.4 * cam.zoom);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = '#7a4a2a';
      ctx.lineWidth = Math.max(1, 2.6 * cam.zoom);
      ctx.stroke();
    },
  };

  /**
   * O Joaquim, o gato da vó (o desenho fica em creatures/gato.js): desenhado a cada quadro, porque respira. Fica em
   * cima do sofá (`perch`, tmj.js): na ordem de desenho, depois dele.
   */
  small.gato = {
    height: (d) => (d.perch || 0) + 40,
    blocks: 0,
    lift: () => 1,
    box: (cam, d, z0) => volBox(cam, d.x - 30, d.x + 30, d.y - 30, d.y + 30, z0, z0 + (d.perch || 0) + 70),
    shadow: () => {},
    paint() {},
    live(ctx, cam, d, z0, time) {
      if (!PD.gato) return;
      PD.gato.draw(ctx, cam, { x: d.x, y: d.y, z: z0 + (d.perch || 0), yaw: d.yaw ?? 1.15, pose: d.pose || 'dormindo', t: time || 0, name: d.name, body: d.color, marks: d.marks, size: d.size });
    },
  };

  // ------------------------------------------------------------------ chão de dentro
  const liftOf = (cam, h) => (h * cam.cosP) / (2 * PD.ISO_K * cam.sinP);
  function clip(a, b) {
    const x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1), y0 = Math.max(a.y0, b.y0), y1 = Math.min(a.y1, b.y1);
    return x1 > x0 && y1 > y0 ? { x0, x1, y0, y1 } : null;
  }
  function crack(ctx, x, y, a, len, r, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    let px = x, py = y;
    const n = 5 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      a += (r() - 0.5) * 0.9;
      px += Math.cos(a) * (len / n);
      py += Math.sin(a) * (len / n);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  const floor = {};
  /** Cerâmica bege de 40 cm (a casa da família): rejunte, uma ou outra peça de outro lote e umas trincas. */
  floor.ceramica = (ctx, sh, box) => {
    const b = clip(G.shapeBox(sh), box);
    if (!b) return true;
    ctx.save();
    G.shapePath(ctx, sh);
    ctx.clip();
    const S = 40;
    ctx.fillStyle = '#c9b996';
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    const TONE = ['#e6d8b8', '#e1d2b0', '#eadcbe', '#dccba6'];
    for (let i = Math.floor(b.x0 / S); i * S < b.x1; i++) {
      for (let j = Math.floor(b.y0 / S); j * S < b.y1; j++) {
        const r = G.cellRng(i, j, 1601);
        ctx.fillStyle = TONE[Math.floor(r() * TONE.length)];
        ctx.fillRect(i * S + 1, j * S + 1, S - 2, S - 2);
        // o brilho do esmalte e as manchinhas
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(i * S + 3, j * S + 3, S * 0.4, 3);
        if (r() < 0.25) {
          ctx.fillStyle = 'rgba(120, 100, 70, 0.12)';
          ctx.beginPath();
          ctx.ellipse(i * S + r() * S, j * S + r() * S, 5 + r() * 6, 3 + r() * 4, r() * 3, 0, M.TAU);
          ctx.fill();
        }
        if (r() < 0.06) crack(ctx, i * S + r() * S, j * S + r() * S, r() * M.TAU, S * 0.7, r, 0.9, 'rgba(70, 56, 40, 0.55)');
      }
    }
    ctx.restore();
    return true;
  };
  /** Taco de madeira (a casa da vó): blocos de três tacos que trocam de direção, em tons de mel e de café. */
  floor.taco = (ctx, sh, box) => {
    const b = clip(G.shapeBox(sh), box);
    if (!b) return true;
    ctx.save();
    G.shapePath(ctx, sh);
    ctx.clip();
    const S = 30;
    const WOOD = ['#a8723f', '#9a6535', '#b57d46', '#8f5c30', '#a46d3b'];
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    for (let i = Math.floor(b.x0 / S); i * S < b.x1; i++) {
      for (let j = Math.floor(b.y0 / S); j * S < b.y1; j++) {
        const r = G.cellRng(i, j, 1611);
        const across = (i + j) % 2 === 0;
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = WOOD[Math.floor(r() * WOOD.length)];
          if (across) ctx.fillRect(i * S + 0.6, j * S + k * 10 + 0.6, S - 1.2, 8.8);
          else ctx.fillRect(i * S + k * 10 + 0.6, j * S + 0.6, 8.8, S - 1.2);
          // o veio da madeira
          ctx.strokeStyle = 'rgba(60, 34, 14, 0.22)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          if (across) {
            const yy = j * S + k * 10 + 3 + r() * 4;
            ctx.moveTo(i * S + 2, yy);
            ctx.lineTo(i * S + S - 2, yy + (r() - 0.5) * 2);
          } else {
            const xx = i * S + k * 10 + 3 + r() * 4;
            ctx.moveTo(xx, j * S + 2);
            ctx.lineTo(xx + (r() - 0.5) * 2, j * S + S - 2);
          }
          ctx.stroke();
        }
        // a cera brilhando
        if (r() < 0.3) {
          ctx.fillStyle = 'rgba(255, 230, 190, 0.12)';
          ctx.fillRect(i * S, j * S, S, S);
        }
      }
    }
    ctx.restore();
    return true;
  };
  /**
   * Cimento queimado velho (a casa abandonada): manchas, rachaduras, folhas secas e musgo na beirada. As raízes da
   * árvore que nasceu aqui são as da Figueira da Esquina (street.js, `breaks`), pintadas por cima.
   */
  floor.cimento = (ctx, sh, box) => {
    const sb = G.shapeBox(sh);
    const b = clip(sb, box);
    if (!b) return true;
    ctx.save();
    G.shapePath(ctx, sh);
    ctx.clip();
    ctx.fillStyle = '#8f8b83';
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    const S = 60;
    for (let i = Math.floor(b.x0 / S); i * S < b.x1; i++) {
      for (let j = Math.floor(b.y0 / S); j * S < b.y1; j++) {
        const r = G.cellRng(i, j, 1621);
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = r() < 0.5 ? 'rgba(60, 56, 50, 0.16)' : 'rgba(200, 196, 186, 0.14)';
          ctx.beginPath();
          ctx.ellipse(i * S + r() * S, j * S + r() * S, 8 + r() * 18, 6 + r() * 12, r() * 3, 0, M.TAU);
          ctx.fill();
        }
      }
    }
    // rachaduras compridas (a semente é a da casa: o desenho não muda de um pedaço de chão para o outro)
    const rr = seeded(sb.x0, sb.y0, 1623);
    for (let k = 0; k < 7; k++) crack(ctx, sb.x0 + rr() * (sb.x1 - sb.x0), sb.y0 + rr() * (sb.y1 - sb.y0), rr() * M.TAU, 80 + rr() * 140, rr, 1.6, 'rgba(40, 36, 30, 0.7)');
    // musgo e terra nas beiradas (perto das paredes)
    ctx.fillStyle = 'rgba(78, 104, 52, 0.5)';
    for (let k = 0; k < 22; k++) {
      const side = Math.floor(rr() * 4);
      const t = rr();
      const x = side < 2 ? sb.x0 + t * (sb.x1 - sb.x0) : side === 2 ? sb.x0 + rr() * 14 : sb.x1 - rr() * 14;
      const y = side >= 2 ? sb.y0 + t * (sb.y1 - sb.y0) : side === 0 ? sb.y0 + rr() * 14 : sb.y1 - rr() * 14;
      ctx.beginPath();
      ctx.ellipse(x, y, 6 + rr() * 12, 4 + rr() * 6, rr() * 3, 0, M.TAU);
      ctx.fill();
    }
    // folhas secas espalhadas (por cima das raízes também)
    const LEAF = ['#c8963c', '#a8692c', '#d9b25a', '#8a5a2a', '#b98a3a'];
    for (let k = 0; k < 60; k++) {
      const x = sb.x0 + rr() * (sb.x1 - sb.x0), y = sb.y0 + rr() * (sb.y1 - sb.y0);
      ctx.fillStyle = LEAF[Math.floor(rr() * LEAF.length)];
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + rr() * 2.5, 1.6 + rr() * 1.2, rr() * 3, 0, M.TAU);
      ctx.fill();
    }
    ctx.restore();
    return true;
  };
  // o piso escolhe o desenho pelo `desenho` do mapa; sem ele, o ladrilho hidráulico da Budega (street.js)
  const ladrilho = texture.piso;
  texture.piso = (ctx, sh, box, seed, ground, map) => (sh.pattern && floor[sh.pattern] ? floor[sh.pattern](ctx, sh, box, seed, ground) : ladrilho(ctx, sh, box, seed, ground, map));
  /** O tapete da sala: vermelho, com a barra e os losangos, e a franja nas duas pontas. */
  texture.tapete = (ctx, sh) => {
    if (sh.kind !== 'rect') return false;
    const { x0, x1, y0, y1 } = sh;
    const base = sh.color || '#b5503c';
    ctx.fillStyle = M.shade(base, -0.25);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = base;
    ctx.fillRect(x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16);
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 13, y0 + 13, x1 - x0 - 26, y1 - y0 - 26);
    ctx.fillStyle = 'rgba(233, 196, 106, 0.7)';
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (const [ox, oy, s] of [[0, 0, 26], [-44, 0, 12], [44, 0, 12], [0, -44, 12], [0, 44, 12]]) {
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy + oy - s);
      ctx.lineTo(cx + ox + s, cy + oy);
      ctx.lineTo(cx + ox, cy + oy + s);
      ctx.lineTo(cx + ox - s, cy + oy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = M.shade(base, -0.3);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx + 12, cy);
    ctx.lineTo(cx, cy + 12);
    ctx.lineTo(cx - 12, cy);
    ctx.closePath();
    ctx.fill();
    // a franja nas pontas menores
    ctx.strokeStyle = '#f1e7d0';
    ctx.lineWidth = 1.2;
    const along = x1 - x0 >= y1 - y0;
    ctx.beginPath();
    if (along) {
      for (let y = y0 + 3; y < y1; y += 4) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 - 7, y);
        ctx.moveTo(x1, y);
        ctx.lineTo(x1 + 7, y);
      }
    } else {
      for (let x = x0 + 3; x < x1; x += 4) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y0 - 7);
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y1 + 7);
      }
    }
    ctx.stroke();
    return true;
  };
  /** O colchão velho no chão: a espessura desenhada no chão (como o meio-fio), manchas, botões e um canto rasgado. */
  texture.colchao = (ctx, sh, box, seed, ground) => {
    if (sh.kind !== 'rect') return false;
    const cam = ground.cam;
    const l = liftOf(cam, 16);
    const { x0, x1, y0, y1 } = sh;
    const r = seeded(x0, y0, 1641);
    // a sombra, os dois lados que a câmera vê (+y e +x) e o tampo, levantado
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(x0 + 3, y0 + 3, x1 - x0, y1 - y0);
    ctx.strokeStyle = '#1b100d';
    ctx.lineWidth = 2.4;
    ctx.fillStyle = '#b9ad8c';
    ctx.beginPath();
    ctx.moveTo(x0, y1);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - l, y1 - l);
    ctx.lineTo(x0 - l, y1 - l);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#a4987a';
    ctx.beginPath();
    ctx.moveTo(x1, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - l, y1 - l);
    ctx.lineTo(x1 - l, y0 - l);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const tx0 = x0 - l, ty0 = y0 - l, tx1 = x1 - l, ty1 = y1 - l;
    ctx.fillStyle = '#ddd2b4';
    ctx.fillRect(tx0, ty0, tx1 - tx0, ty1 - ty0);
    // a listra do tecido de colchão
    ctx.fillStyle = 'rgba(120, 140, 170, 0.25)';
    for (let x = tx0 + 6; x < tx1; x += 14) ctx.fillRect(x, ty0, 5, ty1 - ty0);
    // as manchas
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = k % 3 ? 'rgba(140, 110, 60, 0.35)' : 'rgba(90, 80, 50, 0.3)';
      ctx.beginPath();
      ctx.ellipse(tx0 + r() * (tx1 - tx0), ty0 + r() * (ty1 - ty0), 6 + r() * 14, 5 + r() * 10, r() * 3, 0, M.TAU);
      ctx.fill();
    }
    // os botões do estofado
    ctx.fillStyle = 'rgba(80, 66, 44, 0.6)';
    for (let i = 1; i < 4; i++) for (let j = 1; j < 6; j++) {
      ctx.beginPath();
      ctx.arc(tx0 + ((tx1 - tx0) * i) / 4, ty0 + ((ty1 - ty0) * j) / 6, 1.6, 0, M.TAU);
      ctx.fill();
    }
    // o canto rasgado com a espuma aparecendo
    ctx.fillStyle = '#e9cf7a';
    ctx.beginPath();
    ctx.moveTo(tx1 - 2, ty1 - 30);
    ctx.lineTo(tx1 - 18, ty1 - 22);
    ctx.lineTo(tx1 - 10, ty1 - 10);
    ctx.lineTo(tx1 - 24, ty1 - 3);
    ctx.lineTo(tx1 - 2, ty1 - 2);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.strokeRect(tx0, ty0, tx1 - tx0, ty1 - ty0);
    return true;
  };

  // ------------------------------------------------------------------ paredes de dentro (HouseBack)
  /** Quadro na parede (em cm da parede): moldura, o "retrato" e o vidro. */
  function frameOnWall(ctx, x, y, w, h, kind, r) {
    ctx.fillStyle = '#1b100d';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = kind === 'antiga' ? '#8a6a3a' : '#6b4a2a';
    ctx.fillRect(x, y, w, h);
    const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
    ctx.fillStyle = kind === 'antiga' ? '#d8c39a' : '#cfe0e8';
    ctx.fillRect(ix, iy, iw, ih);
    // as pessoas da foto (silhuetas simples: cabeça e ombros)
    const n = 1 + Math.floor(r() * 3);
    ctx.fillStyle = kind === 'antiga' ? 'rgba(80, 56, 30, 0.75)' : ['#c0392b', '#2e86c1', '#27ae60', '#8e44ad'][Math.floor(r() * 4)];
    for (let k = 0; k < n; k++) {
      const px = ix + (iw * (k + 1)) / (n + 1);
      ctx.beginPath();
      ctx.arc(px, iy + ih * 0.42, Math.min(iw / (n * 2.6), ih * 0.17), 0, M.TAU);
      ctx.fill();
      ctx.fillRect(px - Math.min(iw / (n * 2), ih * 0.3), iy + ih * 0.6, Math.min(iw / n, ih * 0.6), ih * 0.4);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ix + iw * 0.4, iy);
    ctx.lineTo(ix, iy + ih * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  /** Santinho (a santa de manto azul com a auréola), em moldura dourada. */
  function saint(ctx, x, y, w, h) {
    ctx.fillStyle = '#1b100d';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#f3e7c4';
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.3, w * 0.24, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.3, w * 0.12, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#2e5fa8';
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.22);
    ctx.lineTo(x + w * 0.82, y + h - 5);
    ctx.lineTo(x + w * 0.18, y + h - 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f7f2e4';
    ctx.fillRect(x + w * 0.44, y + h * 0.46, w * 0.12, h * 0.3);
  }
  function clock(ctx, cx, cy, R) {
    ctx.fillStyle = '#fbf8f0';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, M.TAU);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * M.TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78);
      ctx.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - R * 0.62);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * 0.45, cy + R * 0.18);
    ctx.stroke();
  }
  function calendar(ctx, x, y) {
    ctx.fillStyle = '#f7f2e4';
    ctx.fillRect(x, y, 30, 40);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x, y, 30, 9);
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
    ctx.lineWidth = 0.8;
    for (let r0 = 0; r0 < 4; r0++) for (let c = 0; c < 5; c++) ctx.strokeRect(x + 2 + c * 5.3, y + 13 + r0 * 6, 5, 5);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x + 2 + 2 * 5.3, y + 13 + 6, 5, 5);
    ctx.fillStyle = '#1b100d';
    ctx.fillRect(x + 13, y - 3, 4, 4);
  }
  /** Janela vista de dentro: a moldura, o vidro com a mata lá fora e (na da vó) a cortina de renda. */
  function windowIn(ctx, x, y, w, h, lace, r) {
    ctx.fillStyle = '#1b100d';
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#bfe0e8');
    g.addColorStop(1, '#8ec3a0');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // a mata lá fora: folhas grandes encostando no vidro
    for (let k = 0; k < 7; k++) {
      ctx.fillStyle = k % 2 ? '#3f8a3a' : '#2f6a2e';
      ctx.beginPath();
      ctx.ellipse(x + r() * w, y + h * (0.35 + r() * 0.65), 8 + r() * 10, 5 + r() * 6, r() * 3, 0, M.TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(x + w / 2 - 1.5, y, 3, h);
    ctx.fillRect(x, y + h * 0.45 - 1.5, w, 3);
    // o parapeito
    ctx.fillStyle = '#d8d2c2';
    ctx.fillRect(x - 8, y + h + 2, w + 16, 6);
    if (!lace) return;
    // a cortina de renda branca, presa no varão, aberta nos dois lados
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(x - 16, y - 12, w + 32, 3.5);
    for (const sgn of [-1, 1]) {
      const cx = sgn < 0 ? x - 12 : x + w + 12;
      ctx.fillStyle = 'rgba(250, 247, 238, 0.92)';
      ctx.beginPath();
      ctx.moveTo(cx, y - 10);
      ctx.lineTo(cx - sgn * (w * 0.32), y - 10);
      ctx.quadraticCurveTo(cx - sgn * (w * 0.12), y + h * 0.55, cx - sgn * (w * 0.22), y + h + 18);
      ctx.lineTo(cx, y + h + 18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(170, 150, 120, 0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // as dobras e os furinhos da renda
      ctx.strokeStyle = 'rgba(190, 175, 150, 0.6)';
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(cx - sgn * (w * 0.08 * k), y - 8);
        ctx.quadraticCurveTo(cx - sgn * (w * 0.05 * k), y + h * 0.5, cx - sgn * (w * 0.06 * k), y + h + 16);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(170, 150, 120, 0.45)';
      for (let k = 0; k < 18; k++) {
        ctx.beginPath();
        ctx.arc(cx - sgn * r() * w * 0.24, y + r() * (h + 20), 1.2, 0, M.TAU);
        ctx.fill();
      }
    }
  }
  /** O oratório da vó: a casinha de madeira com os santos e a vela acesa na frente. */
  function oratorio(ctx, x, y) {
    const w = 46, h = 50;
    ctx.fillStyle = '#1b100d';
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 14);
    ctx.lineTo(x + w / 2, y - 6);
    ctx.lineTo(x + w + 3, y + 14);
    ctx.lineTo(x + w + 3, y + h + 3);
    ctx.lineTo(x - 3, y + h + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a4a2a';
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x + w / 2, y - 3);
    ctx.lineTo(x + w, y + 14);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e9d9b8';
    ctx.fillRect(x + 5, y + 15, w - 10, h - 20);
    // três santinhos (manto azul, marrom e branco, com a auréola)
    const robes = ['#2e5fa8', '#7a4a2a', '#f3efe4'];
    for (let k = 0; k < 3; k++) {
      const sx = x + 11 + k * 12, sy = y + 22 + (k === 1 ? -3 : 0);
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.6, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#e8c9a8';
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = robes[k];
      ctx.beginPath();
      ctx.moveTo(sx, sy + 1.5);
      ctx.lineTo(sx + 4.5, sy + 20);
      ctx.lineTo(sx - 4.5, sy + 20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(27, 16, 13, 0.6)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    // a prateleirinha com a vela acesa e a luz dela na parede
    ctx.fillStyle = '#5a3220';
    ctx.fillRect(x - 6, y + h + 3, w + 12, 5);
    const vx = x + w / 2, vy = y + h + 3;
    const glow = ctx.createRadialGradient(vx, vy - 14, 1, vx, vy - 14, 40);
    glow.addColorStop(0, 'rgba(255, 210, 120, 0.55)');
    glow.addColorStop(1, 'rgba(255, 210, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(vx - 40, vy - 54, 80, 80);
    ctx.fillStyle = '#f7f2e4';
    ctx.fillRect(vx - 3, vy - 12, 6, 12);
    ctx.strokeStyle = 'rgba(27, 16, 13, 0.6)';
    ctx.strokeRect(vx - 3, vy - 12, 6, 12);
    ctx.fillStyle = '#ffb63b';
    ctx.beginPath();
    ctx.moveTo(vx, vy - 22);
    ctx.quadraticCurveTo(vx + 3.6, vy - 15, vx, vy - 12.5);
    ctx.quadraticCurveTo(vx - 3.6, vy - 15, vx, vy - 22);
    ctx.fill();
    ctx.fillStyle = '#fff4c2';
    ctx.beginPath();
    ctx.ellipse(vx, vy - 15, 1.2, 2.4, 0, 0, M.TAU);
    ctx.fill();
  }
  /** Pintura de parede, com o rodapé; a parede de lado (a da esquerda, vista de frente para +x) mais escura. */
  function paintWall(ctx, len, Hh, color, dark, skirt) {
    ctx.fillStyle = dark ? M.shade(color, -0.14) : color;
    ctx.fillRect(0, 0, len, Hh);
    ctx.fillStyle = dark ? M.shade(skirt, -0.14) : skirt;
    ctx.fillRect(0, Hh - 10, len, 10);
    ctx.fillStyle = 'rgba(80, 64, 44, 0.08)';
    ctx.fillRect(0, Hh - 24, len, 14);
  }
  const WALLS = {
    /** A família (casa amarela): cozinha no fundo com o azulejo verde, a janela da pia, o santinho, o calendário e o relógio. */
    familia(ctx, b, wall, len, Hh, dark) {
      const r = seeded(b.x0, b.y0, wall === 'fundo' ? 1701 : 1703);
      paintWall(ctx, len, Hh, '#f1e6cc', dark, '#c9b48e');
      // manchas de umidade perto do chão e do teto (a casa é velha, mas cuidada)
      ctx.fillStyle = 'rgba(120, 100, 60, 0.08)';
      for (let k = 0; k < 4; k++) ctx.fillRect(r() * len, 0, 20 + r() * 40, 18 + r() * 20);
      if (wall === 'fundo') {
        const u = (x) => x - (b.x0 + 15);
        const kitchenEnd = Math.min(len, u(b.x0 + 15 + 300));
        // a faixa de azulejo verde atrás da pia, do fogão e do filtro (de 90 a 160 cm do chão)
        const t0 = Hh - 160, t1 = Hh - 90;
        ctx.fillStyle = dark ? '#7fae8a' : '#93c4a0';
        ctx.fillRect(0, t0, kitchenEnd, t1 - t0);
        ctx.strokeStyle = 'rgba(70, 110, 80, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 15; x < kitchenEnd; x += 15) {
          ctx.moveTo(x, t0);
          ctx.lineTo(x, t1);
        }
        for (let y = t0 + 14; y < t1; y += 14) {
          ctx.moveTo(0, y);
          ctx.lineTo(kitchenEnd, y);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(0, t0, kitchenEnd, 3);
        // a janela em cima da pia, o santinho, o calendário e o relógio perto da geladeira
        windowIn(ctx, Math.max(10, u(b.x0 + 15 + 45)), Hh - 255, 74, 70, false, r);
        saint(ctx, u(b.x0 + 15 + 210), Hh - 235, 22, 30);
        calendar(ctx, u(b.x0 + 15 + 330) - 15, Hh - 200);
        clock(ctx, u(b.x0 + 15 + 330), Hh - 240, 15);
        return;
      }
      // a parede da esquerda: as fotos da família (perto da sala) e uma folhinha de parede
      const u = (y) => b.y1 - y;
      const fx = Math.min(len - 90, u(b.y0 + 15 + 400));
      const spots = [[0, 0, 30, 24], [36, -6, 22, 30], [-4, 32, 24, 20], [28, 30, 30, 22]];
      for (const [ox, oy, w, h] of spots) frameOnWall(ctx, fx + ox, Hh - 210 + oy, w, h, 'cor', r);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(len - 26, Hh - 52, 9, 13);
      ctx.strokeStyle = 'rgba(80, 80, 80, 0.5)';
      ctx.strokeRect(len - 26, Hh - 52, 9, 13);
    },
    /** A vó (casa rosa): papel de parede de florzinhas, o oratório com a vela, as fotos antigas e a janela com renda. */
    vo(ctx, b, wall, len, Hh, dark) {
      const r = seeded(b.x0, b.y0, wall === 'fundo' ? 1711 : 1713);
      paintWall(ctx, len, Hh, '#f4e4d4', dark, '#8a5a34');
      // as florzinhas do papel de parede
      for (let y = 14; y < Hh - 30; y += 22) {
        for (let x = ((y / 22) % 2) * 11 + 6; x < len; x += 22) {
          ctx.fillStyle = dark ? 'rgba(190, 110, 120, 0.35)' : 'rgba(210, 120, 130, 0.38)';
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.arc(x + Math.cos((k * Math.PI) / 2) * 2.2, y + Math.sin((k * Math.PI) / 2) * 2.2, 1.6, 0, M.TAU);
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(120, 160, 90, 0.35)';
          ctx.fillRect(x + 2.5, y + 2.5, 3, 1.2);
        }
      }
      // o lambri de madeira embaixo
      ctx.fillStyle = dark ? '#7a4f2e' : '#8f5f37';
      ctx.fillRect(0, Hh - 90, len, 80);
      ctx.strokeStyle = 'rgba(40, 20, 8, 0.4)';
      ctx.lineWidth = 1;
      for (let x = 12; x < len; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, Hh - 90);
        ctx.lineTo(x, Hh - 10);
        ctx.stroke();
      }
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(0, Hh - 94, len, 5);
      if (wall === 'fundo') {
        const u = (x) => x - (b.x0 + 15);
        oratorio(ctx, u(b.x0 + 15 + 225), Hh - 205);
        frameOval(ctx, u(b.x0 + 15 + 300), Hh - 215, 18, 24);
        frameOval(ctx, u(b.x0 + 15 + 330), Hh - 200, 14, 19);
        // o crucifixo em cima da cama
        const cx = u(b.x0 + 15 + 560);
        ctx.fillStyle = '#5a3220';
        ctx.fillRect(cx - 2, Hh - 170, 4, 30);
        ctx.fillRect(cx - 10, Hh - 162, 20, 4);
        return;
      }
      const u = (y) => b.y1 - y;
      // a janela com a cortina de renda em cima do sofá e uma foto antiga perto da porta
      windowIn(ctx, u(b.y0 + 15 + 420) - 20, Hh - 215, 100, 90, true, r);
      frameOval(ctx, u(b.y0 + 15 + 520), Hh - 200, 16, 22);
    },
    /** Ninguém (a casa abandonada): tijolo à mostra, o reboco caindo em placas, rachaduras, manchas e o cipó entrando. */
    ninguem(ctx, b, wall, len, Hh, dark) {
      const r = seeded(b.x0, b.y0, wall === 'fundo' ? 1721 : 1723);
      ctx.fillStyle = dark ? '#8a4a30' : '#a35a3a';
      ctx.fillRect(0, 0, len, Hh);
      ctx.strokeStyle = 'rgba(210, 190, 160, 0.55)';
      ctx.lineWidth = 1.4;
      for (let y = Hh, row = 0; y > 0; y -= 8, row++) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(len, y);
        ctx.stroke();
        for (let x = (row % 2) * 11; x < len; x += 22) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - 8);
          ctx.stroke();
        }
      }
      // tijolos de tons diferentes
      ctx.fillStyle = 'rgba(60, 20, 10, 0.18)';
      for (let k = 0; k < len / 6; k++) ctx.fillRect(Math.floor(r() * (len / 22)) * 22 + 1, Math.floor(r() * (Hh / 8)) * 8 + 1, 20, 6);
      // as placas de reboco que ainda ficaram (claras, com a borda quebrada)
      for (let k = 0; k < 5; k++) {
        const px = r() * len, py = r() * (Hh - 60);
        const pw = 40 + r() * 80, ph = 30 + r() * 60;
        ctx.fillStyle = dark ? '#b9ab94' : '#cbbda4';
        ctx.strokeStyle = 'rgba(40, 26, 16, 0.7)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * M.TAU;
          const k2 = 0.7 + r() * 0.3;
          const qx = px + Math.cos(a) * pw * 0.5 * k2, qy = py + Math.sin(a) * ph * 0.5 * k2;
          if (i) ctx.lineTo(qx, qy);
          else ctx.moveTo(qx, qy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // escorridos de chuva do teto, rachaduras e o musgo no rodapé
      ctx.fillStyle = 'rgba(30, 24, 16, 0.18)';
      for (let k = 0; k < 6; k++) ctx.fillRect(r() * len, 0, 8 + r() * 16, 40 + r() * (Hh * 0.6));
      for (let k = 0; k < 3; k++) crack(ctx, r() * len, r() * 40, Math.PI / 2 + (r() - 0.5) * 0.8, 60 + r() * 90, r, 1.6, 'rgba(20, 12, 8, 0.8)');
      ctx.fillStyle = 'rgba(70, 100, 46, 0.55)';
      for (let k = 0; k < 10; k++) {
        ctx.beginPath();
        ctx.ellipse(r() * len, Hh - r() * 18, 8 + r() * 14, 4 + r() * 6, 0, 0, M.TAU);
        ctx.fill();
      }
      // o cipó descendo da beirada de cima
      if (PD.city.vine) {
        for (let k = 0; k < 4; k++) {
          const x = r() * len;
          const pts = [];
          const L = 60 + r() * (Hh * 0.6);
          for (let s = 0; s <= 6; s++) pts.push({ x: x + Math.sin(s * 1.3 + k) * 6, y: (L * s) / 6 });
          PD.city.vine(ctx, pts, r, 1.4, 1.6);
        }
      }
    },
  };
  /** Foto antiga em moldura oval (a casa da vó). */
  function frameOval(ctx, cx, cy, rx, ry) {
    ctx.fillStyle = '#1b100d';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 3, ry + 3, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#b08a4a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 1.5, ry + 1.5, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#d9c39a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 1.5, ry - 1.5, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(80, 56, 30, 0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy - ry * 0.2, rx * 0.36, 0, M.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.55, rx * 0.62, ry * 0.4, 0, Math.PI, 0);
    ctx.fill();
  }

  PD.casas = {
    floor,
    /** Uma parede de dentro da casa com `morador` ('oeste' = a da esquerda, 'fundo' = a de trás), em cm da parede. */
    innerWall(ctx, b, wall, len, Hh) {
      (WALLS[b.resident] || WALLS.familia)(ctx, b, wall, len, Hh, wall === 'oeste');
    },
  };
})(window.PD = window.PD || {});
