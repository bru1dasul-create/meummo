// A Budega maior (pedido do dono pelo [mundo], 15/11: "melhora isso aí, era pra ser parecido" — os alvos são as duas
// imagens aprovadas, docs/referencias/budega-maior-fachada.jpg e budega-maior-dentro.jpg; nada de tabaco, narguilé nem
// marca: só o nome da loja no escudo):
//  - a fachada preta (`fachada: 'preta'`): o preto brilhante, a faixa de cima com o escudo dourado, a moldura amarela
//    (`moldura`) em volta da vitrine e da porta, a vitrine de fundo amarelo com refrigerante, potes de doce e salgadinho,
//    a porta de enrolar aberta à direita (`portaDe`/`portaAte`) mostrando a loja acesa e o LED branco (`led`);
//  - dentro: o porcelanato branco (com folhas secas perto da porta), as paredes claras com o "FIADO SÓ AMANHÃ" em cima
//    das prateleiras, as prateleiras pretas de nichos amarelos (`nichos`) cheias, a geladeira branca de duas portas de
//    vidro (`portas`, `vidro`), o balcão de vidro com os potes de bala (`balcao-vidro`), o freezer de tampa de vidro, o
//    caixa preto com a faixa amarela (`cor`, `faixa`, `caixa`: a registradora e a maquininha), a parede de grama com o
//    escudo dourado aceso e o arco de flores amarelas (`parede-verde`), o ventilador de parede, e a vitrine que sai junto
//    com a frente (fica só a base);
//  - na calçada: o degrau de cimento com o capacho, a lousinha de cavalete, o vaso de cimento com a dracena e os
//    caixotes de banana e de laranja.
// A mata entrando (as raízes, o capim, a samambaia, o cipó e o musgo de dentro) é a de sempre (street.js e casas.js),
// mais o cipó subindo nas prateleiras e na geladeira (`cipo`).
//   PD.budega.front(ctx, b, W, H, r)               a frente (+y) da casa com `fachada: 'preta'` (props.js)
//   PD.budega.side(ctx, b, D, H, r)                o lado (+x) preto
//   PD.budega.innerWall(ctx, b, parede, len, H)    as paredes de dentro (props.js, HouseBack)
//   PD.city.small[tipo]                             os móveis e as coisas da calçada
//   PD.street.texture.degrau, PD.casas.floor.porcelanato   o chão
(function (PD) {
  'use strict';
  const M = PD.math;
  const H = PD.props.help;
  const { INK } = H;
  const small = PD.city.small;
  const G = PD.groundHelp;
  const texture = PD.street.texture;

  // ------------------------------------------------------------------ ajudantes
  const seeded = (x, y, k) => M.rng((Math.round(x * 3.7) * 73856093) ^ (Math.round(y * 5.3) * 19349663) ^ (k * 83492791));
  const tone = (c, k = 1) => ({ front: c, side: M.shade(c, -0.22 * k), top: M.shade(c, 0.12 * k) });
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
  function quad(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  }
  /** O referencial de um móvel: `len` ao longo da frente, `depth` da parede para a frente; a face da frente (onWall). */
  function frameOf(d) {
    const east = (d.angle ?? 90) === 0;
    const len = east ? d.y1 - d.y0 : d.x1 - d.x0;
    const depth = east ? d.x1 - d.x0 : d.y1 - d.y0;
    const face = (dz, z) => (east ? [{ x: d.x1 + dz, y: d.y1, z }, { x: 0, y: -1 }] : [{ x: d.x0, y: d.y1 + dz, z }, { x: 1, y: 0 }]);
    return { east, len, depth, face };
  }
  const boxFor = (extra = 40) => (cam, d, z0, h) => volBox(cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + (h || 100) + extra, 18);

  // ------------------------------------------------------------------ a mercadoria (desenhos de frente, em cm)
  // Sem marca: garrafa de refrigerante (rótulo de uma cor), água (azul clara), salgadinho (saco de pontas
  // franzidas), caixa de biscoito, chocolate, pote de doce (bolinhas coloridas). Nada de cigarro ou tabaco.
  const SODA = ['#c0392b', '#2f8f4e', '#e67e22', '#8e44ad', '#d35400', '#27ae60', '#7d3c1e'];
  const BAG = ['#e8a33a', '#d6402f', '#f1c84a', '#2f73c4', '#3f9a4a', '#e67e22'];
  const BOXC = ['#f1c84a', '#2f73c4', '#d6402f', '#3f9a4a', '#f2f0e8', '#7a3fa0', '#e8a33a'];
  const CANDY = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#e67e22', '#ff7fb0', '#9b59b6'];
  function bottle(ctx, x, base, w, h, color, water) {
    const neck = h * 0.28;
    ctx.fillStyle = water ? 'rgba(170, 214, 238, 0.95)' : color;
    rrect(ctx, x, base - h + neck, w, h - neck, w * 0.25);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, base - h + neck + 2);
    ctx.quadraticCurveTo(x + w * 0.3, base - h + neck * 0.35, x + w * 0.36, base - h + 3);
    ctx.lineTo(x + w * 0.64, base - h + 3);
    ctx.quadraticCurveTo(x + w * 0.7, base - h + neck * 0.35, x + w * 0.88, base - h + neck + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = water ? '#3a7fc0' : '#f2f0e8';
    ctx.fillRect(x + w * 0.32, base - h, w * 0.36, 3.5);
    // o rótulo (só a cor) e o brilho
    ctx.fillStyle = water ? '#2f73c4' : 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(x, base - h * 0.52, w, h * 0.16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x + w * 0.16, base - h + neck + 3, w * 0.14, h * 0.5);
  }
  function chipsBag(ctx, x, base, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 1, base);
    ctx.lineTo(x, base - h + 4);
    for (let k = 0; k <= 6; k++) ctx.lineTo(x + (w * k) / 6, base - h + (k % 2 ? 0 : 3));
    ctx.lineTo(x + w - 1, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, base - h * 0.5, w * 0.28, h * 0.17, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(x + w * 0.7, base - h + 5, w * 0.3 - 1, h - 6);
  }
  function snackBox(ctx, x, base, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, base - h, w, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(x, base - h, w, Math.max(2, h * 0.14));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fillRect(x + w * 0.72, base - h, w * 0.28, h);
  }
  function candyJar(ctx, x, base, w, h, r, lid) {
    ctx.fillStyle = 'rgba(220, 238, 242, 0.75)';
    rrect(ctx, x, base - h, w, h, w * 0.22);
    ctx.fill();
    for (let k = 0; k < 14; k++) {
      ctx.fillStyle = CANDY[Math.floor(r() * CANDY.length)];
      ctx.beginPath();
      ctx.arc(x + 3 + r() * (w - 6), base - 3 - r() * (h * 0.72), Math.max(1.4, w * 0.09), 0, M.TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(x + w * 0.16, base - h + 4, w * 0.12, h * 0.6);
    ctx.fillStyle = lid || '#c0392b';
    ctx.fillRect(x + w * 0.08, base - h - 4, w * 0.84, 6);
  }
  /** Enche um vão (x, base, largura, altura livre) com um tipo de mercadoria sorteado. */
  function goods(ctx, x, base, w, h, r, kind) {
    const k = kind || ['soda', 'water', 'bags', 'boxes', 'jars', 'soda', 'boxes'][Math.floor(r() * 7)];
    if (k === 'soda' || k === 'water') {
      const bw = Math.min(9, w / 3.4);
      const bh = Math.min(h - 2, bw * 3.4);
      for (let px = x + 1; px + bw < x + w; px += bw + 1.6) bottle(ctx, px, base, bw, bh * (0.92 + r() * 0.08), SODA[Math.floor(r() * SODA.length)], k === 'water');
    } else if (k === 'bags') {
      const bw = Math.min(18, w / 2.1);
      for (let px = x; px + bw <= x + w + 1; px += bw + 2) chipsBag(ctx, px, base, bw, Math.min(h - 2, bw * 1.25), BAG[Math.floor(r() * BAG.length)]);
    } else if (k === 'jars') {
      const bw = Math.min(14, w / 2.2);
      for (let px = x + 1; px + bw <= x + w; px += bw + 3) candyJar(ctx, px, base, bw, Math.min(h - 6, bw * 1.3), r, ['#c0392b', '#2f73c4', '#27ae60'][Math.floor(r() * 3)]);
    } else {
      let px = x;
      while (px < x + w - 6) {
        const bw = 7 + r() * 7;
        if (px + bw > x + w) break;
        snackBox(ctx, px, base, bw, Math.min(h - 2, 10 + r() * 14), BOXC[Math.floor(r() * BOXC.length)]);
        px += bw + 1.2;
      }
    }
  }

  // ------------------------------------------------------------------ o escudo (preto e dourado, ou de neon)
  const GOLD = ['#c98a2c', '#f7e08c', '#e3a840', '#f6d77e', '#d69a38'];
  function shieldPath(X, Y, k) {
    const sx = (x) => X(x * k);
    const sy = (y) => Y(0.53 + (y - 0.53) * k);
    const p = new Path2D();
    p.moveTo(sx(-0.36), sy(0));
    p.lineTo(sx(0.36), sy(0));
    p.lineTo(sx(0.47), sy(0.09));
    p.lineTo(sx(0.43), sy(0.62));
    p.quadraticCurveTo(sx(0.37), sy(0.86), sx(0), sy(1.06));
    p.quadraticCurveTo(sx(-0.37), sy(0.86), sx(-0.43), sy(0.62));
    p.lineTo(sx(-0.47), sy(0.09));
    p.closePath();
    return p;
  }
  /**
   * O escudo da Budega: `dark` = o da fachada (preto por dentro, borda e letras douradas, os arabescos em cima); senão o
   * de neon da parede de grama (o contorno e as letras douradas acesos, sem fundo, com o brilho em volta).
   */
  function shield(ctx, cx, top, w, dark) {
    const X = (x) => cx + x * w;
    const Y = (y) => top + y * w;
    const gold = ctx.createLinearGradient(X(-0.5), Y(0), X(0.5), Y(1));
    GOLD.forEach((c, i) => gold.addColorStop(i / (GOLD.length - 1), c));
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const outer = shieldPath(X, Y, 1);
    if (dark) {
      ctx.lineWidth = w * 0.07;
      ctx.strokeStyle = INK;
      ctx.stroke(outer);
      ctx.fillStyle = '#141416';
      ctx.fill(outer);
      ctx.lineWidth = w * 0.035;
      ctx.strokeStyle = gold;
      ctx.stroke(outer);
      ctx.lineWidth = w * 0.01;
      ctx.stroke(shieldPath(X, Y, 0.86));
    } else {
      // o neon: um fundo escuro de leve (a placa), o brilho largo, depois o tubo dourado e o miolo claro
      ctx.fillStyle = 'rgba(20, 30, 16, 0.45)';
      ctx.fill(outer);
      ctx.shadowColor = 'rgba(255, 190, 60, 1)';
      ctx.shadowBlur = w * 0.22;
      ctx.lineWidth = w * 0.07;
      ctx.strokeStyle = '#ffc94a';
      ctx.stroke(outer);
      ctx.lineWidth = w * 0.03;
      ctx.stroke(shieldPath(X, Y, 0.86));
      ctx.shadowBlur = 0;
      ctx.lineWidth = w * 0.024;
      ctx.strokeStyle = '#fff2c2';
      ctx.stroke(outer);
    }
    // os arabescos e o nome
    ctx.strokeStyle = dark ? gold : '#ffd36a';
    ctx.lineWidth = w * 0.022;
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(X(sg * 0.04), Y(0.17));
      ctx.bezierCurveTo(X(sg * 0.16), Y(0.07), X(sg * 0.3), Y(0.14), X(sg * 0.25), Y(0.2));
      ctx.bezierCurveTo(X(sg * 0.21), Y(0.24), X(sg * 0.15), Y(0.2), X(sg * 0.19), Y(0.17));
      ctx.stroke();
    }
    ctx.font = `800 ${Math.round(w * 0.158)}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!dark) {
      ctx.shadowColor = 'rgba(255, 190, 60, 1)';
      ctx.shadowBlur = w * 0.16;
    }
    ctx.fillStyle = dark ? gold : '#ffd862';
    ctx.fillText('BUDEGA', X(0), Y(0.5));
    if (!dark) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff4cc';
      ctx.fillText('BUDEGA', X(0), Y(0.5));
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ------------------------------------------------------------------ a fachada
  /** A vitrine vista de fora (fundo amarelo, prateleiras pretas de metal e a mercadoria), no retângulo da parede. */
  function vitrineFace(ctx, x, y, w, h, back, r) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, M.shade(back, 0.12));
    g.addColorStop(1, M.shade(back, -0.06));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // as prateleiras: três níveis (o de baixo no chão da vitrine), com os pés pretos
    const levels = [0.36, 0.66, 0.97];
    const plan = [['soda', 'jars'], ['boxes', 'bags'], ['soda', 'bags']];
    ctx.fillStyle = '#1d1d20';
    for (const px of [x + w * 0.05, x + w * 0.5, x + w * 0.93]) ctx.fillRect(px, y + h * 0.12, 4, h * 0.86);
    levels.forEach((lv, i) => {
      const sy = y + h * lv;
      const room = h * (i === 0 ? 0.24 : 0.27);
      const half = w * 0.43;
      goods(ctx, x + w * 0.06, sy - 2, half - 4, room, r, plan[i][0]);
      goods(ctx, x + w * 0.51, sy - 2, half - 4, room, r, plan[i][1]);
      ctx.fillStyle = '#1d1d20';
      ctx.fillRect(x + w * 0.04, sy - 2, w * 0.92, 4);
    });
    // o vidro: um véu azulado de leve e os reflexos em diagonal
    ctx.fillStyle = 'rgba(190, 220, 236, 0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
    for (const [a, b2] of [[0.1, 0.07], [0.22, 0.03], [0.62, 0.09]]) {
      ctx.beginPath();
      ctx.moveTo(x + w * a, y);
      ctx.lineTo(x + w * (a + b2), y);
      ctx.lineTo(x + w * (a + b2 - 0.18), y + h);
      ctx.lineTo(x + w * (a - 0.18), y + h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  /** O que se vê pela porta aberta: a loja acesa (prateleiras de nichos amarelos, a parede de grama, o caixa, o piso). */
  function doorView(ctx, x, y, w, h, r) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#e9e6dc');
    g.addColorStop(1, '#f4f2ec');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    const floorY = y + h * 0.66;
    // a parede do fundo: as prateleiras (esquerda) e a grama com o escudo (direita)
    const sx1 = x + w * 0.52;
    ctx.fillStyle = '#1d1d20';
    ctx.fillRect(x, y + h * 0.04, sx1 - x, floorY - y - h * 0.04);
    const cols = 3, rows = 3;
    const cw = (sx1 - x - 4) / cols, rh = (floorY - y - h * 0.08) / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const nx = x + 3 + i * cw, ny = y + h * 0.06 + j * rh;
        ctx.fillStyle = '#e8c020';
        ctx.fillRect(nx, ny, cw - 3, rh - 3);
        goods(ctx, nx + 2, ny + rh - 4, cw - 7, rh - 8, r);
      }
    }
    ctx.fillStyle = '#2f5a2a';
    ctx.fillRect(sx1, y + h * 0.04, x + w - sx1, floorY - y - h * 0.04);
    for (let k = 0; k < 160; k++) {
      ctx.fillStyle = k % 3 ? 'rgba(96, 150, 70, 0.9)' : 'rgba(40, 84, 36, 0.9)';
      ctx.fillRect(sx1 + r() * (x + w - sx1), y + h * 0.04 + r() * (floorY - y - h * 0.04), 2.2, 2.2);
    }
    // as flores amarelas no alto da grama e o escudo aceso
    for (let k = 0; k < 18; k++) {
      ctx.fillStyle = k % 2 ? '#f6d23a' : '#f2b81e';
      ctx.beginPath();
      ctx.arc(sx1 + r() * (x + w - sx1), y + h * 0.05 + r() * 10, 2.4, 0, M.TAU);
      ctx.fill();
    }
    shield(ctx, sx1 + (x + w - sx1) / 2, y + h * 0.14, Math.min(46, (x + w - sx1) * 0.42), false);
    // o piso branco (placas em perspectiva)
    ctx.fillStyle = '#f2f1ec';
    ctx.fillRect(x, floorY, w, y + h - floorY);
    ctx.strokeStyle = 'rgba(160, 158, 150, 0.6)';
    ctx.lineWidth = 1.2;
    for (let k = 1; k < 4; k++) {
      const fy = floorY + ((y + h - floorY) * k * k) / 16;
      ctx.beginPath();
      ctx.moveTo(x, fy);
      ctx.lineTo(x + w, fy);
      ctx.stroke();
    }
    for (let k = -4; k <= 8; k++) {
      const top = x + w * 0.42 + k * w * 0.08;
      ctx.beginPath();
      ctx.moveTo(top, floorY);
      ctx.lineTo(x + w * 0.42 + k * w * 0.2, y + h);
      ctx.stroke();
    }
    // o caixa preto com a faixa amarela, na frente da grama
    const cx0 = x + w * 0.58, cx1 = x + w * 0.97, ctop = floorY - h * 0.22;
    ctx.fillStyle = INK;
    ctx.fillRect(cx0 - 2, ctop - 2, cx1 - cx0 + 4, floorY - ctop + h * 0.12);
    ctx.fillStyle = '#26262a';
    ctx.fillRect(cx0, ctop, cx1 - cx0, floorY - ctop + h * 0.1);
    ctx.fillStyle = '#e8c020';
    ctx.fillRect(cx0, floorY + h * 0.02, cx1 - cx0, h * 0.05);
    ctx.fillStyle = '#3a3a3f';
    ctx.fillRect(cx0 - 3, ctop - 5, cx1 - cx0 + 6, 6);
    // a luz branca da loja vindo de cima
    const light = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    light.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
    light.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = light;
    ctx.fillRect(x, y, w, h * 0.5);
  }
  /** A frente preta da Budega (+y, em cm da parede: x da quina da esquerda, y do alto para baixo). */
  function front(ctx, b, W, H, r) {
    const frame = b.frame || '#e8c020';
    const door = b.door ? { x0: b.door.from - b.x0, x1: b.door.to - b.x0 } : { x0: W * 0.56, x1: W * 0.94 };
    const fascia = Math.min(118, H * 0.34);
    // o preto brilhante e os reflexos (bem de leve: os fios e as casas da frente)
    const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0, '#2c2c31');
    g.addColorStop(0.5, '#17171a');
    g.addColorStop(1, '#232327');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, fascia * 0.3);
    ctx.quadraticCurveTo(W * 0.5, fascia * 0.55, W, fascia * 0.25);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(W * 0.08, 6, W * 0.16, fascia - 12);
    ctx.fillRect(W * 0.7, 6, W * 0.06, fascia - 12);
    // a vitrine (à esquerda da porta)
    const vx0 = 20, vx1 = door.x0 - 16, vy0 = fascia + 14, vy1 = H - 26;
    vitrineFace(ctx, vx0, vy0, vx1 - vx0, vy1 - vy0, b.vitrineBack || '#f2c84b', r);
    // o peitoril preto embaixo da vitrine
    ctx.fillStyle = '#121214';
    ctx.fillRect(vx0 - 6, vy1, vx1 - vx0 + 12, H - vy1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(vx0 - 6, vy1, vx1 - vx0 + 12, 3);
    // a porta aberta: a loja lá dentro, a porta de aço enrolada na caixa em cima e os trilhos
    const dy0 = fascia + 14;
    doorView(ctx, door.x0, dy0 + 18, door.x1 - door.x0, H - dy0 - 18, r);
    ctx.fillStyle = '#2b2d30';
    ctx.fillRect(door.x0, dy0, door.x1 - door.x0, 20);
    ctx.fillStyle = '#4a4d51';
    ctx.fillRect(door.x0, dy0 + 14, door.x1 - door.x0, 4);
    // a moldura amarela: a viga debaixo da faixa preta e os montantes (esquerda, entre a vitrine e a porta, direita)
    ctx.fillStyle = frame;
    ctx.fillRect(4, fascia, W - 8, 14);
    for (const [px, pw] of [[4, 16], [vx1, door.x0 - vx1], [door.x1, 14]]) ctx.fillRect(px, fascia, pw, H - fascia);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(4, fascia + 11, W - 8, 3);
    for (const [px, pw] of [[4, 16], [vx1, door.x0 - vx1], [door.x1, 14]]) ctx.fillRect(px + pw - 3, fascia + 14, 3, H - fascia - 14);
    // o batente de baixo da porta (soleira)
    ctx.fillStyle = '#b9b2a4';
    ctx.fillRect(door.x0 - 4, H - 8, door.x1 - door.x0 + 8, 8);
    // o escudo dourado na faixa preta, em cima da vitrine
    const sw = Math.min(104, fascia * 0.86);
    shield(ctx, Math.min(vx1 - sw * 0.2, (vx0 + door.x1) / 2), (fascia - sw * 1.06) / 2, sw, true);
    // o LED branco: em volta da frente e embaixo da faixa
    if (b.led) {
      ctx.lineCap = 'round';
      for (const [w, c] of [[7, 'rgba(235, 242, 255, 0.25)'], [2.6, '#f4f7ff']]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(3, H - 4);
        ctx.lineTo(3, 3);
        ctx.lineTo(W - 3, 3);
        ctx.lineTo(W - 3, H - 4);
        ctx.moveTo(3, fascia - 3);
        ctx.lineTo(W - 3, fascia - 3);
        ctx.stroke();
      }
    }
  }
  /** O lado (+x) preto: brilho de leve e a borda de cima (com o LED, se tiver). */
  function side(ctx, b, D, H) {
    const g = ctx.createLinearGradient(0, 0, D, H);
    g.addColorStop(0, '#1b1b1e');
    g.addColorStop(1, '#101012');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, D, H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(D * 0.15, 8, D * 0.12, H - 16);
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(0, 0, D, 14);
    if (b.led) {
      ctx.strokeStyle = '#f4f7ff';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.lineTo(D - 3, 3);
      ctx.stroke();
    }
  }
  /** As paredes de dentro: claras, azulejo branco embaixo com a faixa azul, o "FIADO SÓ AMANHÃ" e a mata entrando. */
  function innerWall(ctx, b, wall, len, Hh) {
    const dark = wall === 'oeste';
    const paint = dark ? '#ddd6c6' : '#f0eadb';
    const tile = dark ? '#dcdad3' : '#f2f0ea';
    const tileH = 96;
    ctx.fillStyle = paint;
    ctx.fillRect(0, 0, len, Hh - tileH);
    ctx.fillStyle = tile;
    ctx.fillRect(0, Hh - tileH, len, tileH);
    ctx.strokeStyle = 'rgba(150, 150, 158, 0.4)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let x = 20; x < len; x += 20) {
      ctx.moveTo(x, Hh - tileH);
      ctx.lineTo(x, Hh);
    }
    for (let y = Hh - tileH + 20; y < Hh; y += 20) {
      ctx.moveTo(0, y);
      ctx.lineTo(len, y);
    }
    ctx.stroke();
    ctx.fillStyle = dark ? '#335c8c' : '#3f6fa8';
    ctx.fillRect(0, Hh - tileH - 5, len, 6);
    ctx.fillStyle = 'rgba(80, 64, 44, 0.1)';
    ctx.fillRect(0, Hh - 12, len, 12);
    if (wall === 'fundo') {
      // a placa de madeira em cima das prateleiras do fundo (o lugar dela antes era onde ficou a parede de grama)
      const pw = 128, px = Math.min(len * 0.22, len - pw - 20);
      ctx.fillStyle = INK;
      ctx.fillRect(px - 3, 13, pw + 6, 38);
      ctx.fillStyle = '#c99a5b';
      ctx.fillRect(px, 16, pw, 32);
      ctx.fillStyle = '#3a2412';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FIADO SÓ AMANHÃ', px + pw / 2, 37);
    }
    if (PD.casas && PD.casas.innerGreen) PD.casas.innerGreen(ctx, b, wall, len, Hh);
  }

  // ------------------------------------------------------------------ os móveis de dentro
  // (os de antes continuam para a loja sem os campos novos)
  const OLD = { prateleira: small.prateleira, geladeira: small.geladeira, balcao: small.balcao, vaso: small.vaso };

  // Prateleira preta de nichos amarelos, cheia (refrigerante, água, salgadinho, biscoito, potes de doce); com `cipo`,
  // o cipó subindo pela lateral e umas folhas dentro de alguns nichos.
  small.prateleira = {
    ...OLD.prateleira,
    paint(ctx, cam, d, z0, ink) {
      if (!d.niches) return OLD.prateleira.paint.call(this, ctx, cam, d, z0, ink);
      const F = frameOf(d);
      const h = d.h || 210;
      const black = d.color || '#26262a';
      const rnd = seeded(d.x0, d.y0, 3601);
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + h, tone(black, 0.8), ink);
      const [o, dir] = F.face(0.6, z0 + h);
      const leafy = [];
      H.onWall(ctx, cam, o, dir, () => {
        const fr = 5;
        const cols = Math.max(1, Math.round(F.len / 46));
        const rows = 4;
        const cw = (F.len - fr) / cols, rh = (h - 8 - fr) / rows;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const x = fr + i * cw, y = fr + j * rh;
            const nw = cw - fr, nh = rh - fr;
            ctx.fillStyle = d.niches;
            ctx.fillRect(x, y, nw, nh);
            // a fundura do nicho: a sombra em cima e do lado
            ctx.fillStyle = 'rgba(40, 26, 0, 0.32)';
            ctx.fillRect(x, y, nw, nh * 0.16);
            ctx.fillRect(x, y, nw * 0.1, nh);
            goods(ctx, x + nw * 0.1 + 1, y + nh - 1, nw * 0.88 - 2, nh * 0.8, rnd);
            if (d.vine && rnd() < 0.18) leafy.push({ x: x + nw * (0.2 + rnd() * 0.6), y: y + nh * (0.3 + rnd() * 0.5) });
          }
        }
        // umas folhas dentro dos nichos (o cipó entrou)
        for (const l of leafy) {
          for (let k = 0; k < 4; k++) {
            ctx.fillStyle = k % 2 ? '#4f8a3c' : '#3c7232';
            ctx.beginPath();
            ctx.ellipse(l.x + (rnd() - 0.5) * 12, l.y + (rnd() - 0.5) * 8, 6, 3.2, rnd() * 3, 0, M.TAU);
            ctx.fill();
          }
        }
        // o brilho da madeira laqueada na beirada de cima
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(0, 0, F.len, 3);
      });
      if (d.vine && PD.city.vine) {
        // o cipó subindo pela ponta da frente (a que fica mais perto da porta)
        const pts = [];
        for (let s = 0; s <= 10; s++) {
          const u = s / 10;
          const p = F.east ? { x: d.x1 + 2, y: d.y1 - 3 - Math.sin(s * 1.3) * 4, z: z0 + h * 0.92 * u } : { x: d.x1 - 3 - Math.sin(s * 1.3) * 4, y: d.y1 + 2, z: z0 + h * 0.92 * u };
          pts.push(cam.p(p));
        }
        PD.city.vine(ctx, pts, rnd, cam.zoom, ink);
      }
    },
  };

  // A geladeira branca de duas portas de vidro (`portas`, `vidro`) com a faixa azul em cima: as bebidas nas prateleiras
  // acesas, os puxadores, a grade embaixo; com `cipo`, o cipó subindo do lado.
  small.geladeira = {
    ...OLD.geladeira,
    paint(ctx, cam, d, z0, ink) {
      if (!d.glass) return OLD.geladeira.paint.call(this, ctx, cam, d, z0, ink);
      const F = frameOf(d);
      const h = d.h || 200;
      const rnd = seeded(d.x0, d.y0, 3611);
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, z0 + 4, z0 + h, { front: '#eef1f3', side: '#c9d0d5', top: '#f7f9fa' }, ink);
      const [o, dir] = F.face(0.6, z0 + h);
      H.onWall(ctx, cam, o, dir, () => {
        const W = F.len, hh = h - 4;
        ctx.fillStyle = '#2f6fbf';
        ctx.fillRect(3, 3, W - 6, 22);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(3, 3, W - 6, 4);
        const n = Math.max(1, d.doors || 1);
        const gap = 4, dw = (W - 10 - gap * (n - 1)) / n;
        for (let i = 0; i < n; i++) {
          const gx = 5 + i * (dw + gap), gy = 30, gh = hh - 52;
          ctx.fillStyle = '#b7bfc4';
          ctx.fillRect(gx, gy, dw, gh);
          const ix = gx + 4, iy = gy + 4, iw = dw - 8, ih = gh - 8;
          const glow = ctx.createLinearGradient(0, iy, 0, iy + ih);
          glow.addColorStop(0, '#e6f6fc');
          glow.addColorStop(1, '#b5ddea');
          ctx.fillStyle = glow;
          ctx.fillRect(ix, iy, iw, ih);
          for (let s = 0; s < 5; s++) {
            const base = iy + ((s + 1) * ih) / 5 - 2;
            ctx.fillStyle = 'rgba(120, 150, 165, 0.6)';
            ctx.fillRect(ix, base, iw, 2);
            const kind = s === 0 ? 'water' : s === 4 ? 'water' : 'soda';
            goods(ctx, ix + 2, base, iw - 4, ih / 5 - 4, rnd, kind);
          }
          // o reflexo no vidro e o puxador (do lado do meio)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.moveTo(ix + iw * 0.2, iy);
          ctx.lineTo(ix + iw * 0.38, iy);
          ctx.lineTo(ix + iw * 0.1, iy + ih);
          ctx.lineTo(ix, iy + ih);
          ctx.lineTo(ix, iy + ih * 0.75);
          ctx.closePath();
          ctx.fill();
          const hx = i % 2 === 0 && n > 1 ? gx + dw - 7 : gx + 3;
          ctx.fillStyle = '#6d757b';
          ctx.fillRect(hx, gy + gh * 0.35, 4, gh * 0.3);
        }
        // a grade de ventilação embaixo
        ctx.fillStyle = '#9aa2a8';
        ctx.fillRect(6, hh - 18, W - 12, 12);
        ctx.strokeStyle = '#6f777d';
        ctx.lineWidth = 1.4;
        for (let x = 10; x < W - 8; x += 6) {
          ctx.beginPath();
          ctx.moveTo(x, hh - 16);
          ctx.lineTo(x, hh - 8);
          ctx.stroke();
        }
      });
      if (d.vine && PD.city.vine) {
        const pts = [];
        for (let s = 0; s <= 10; s++) {
          const u = s / 10;
          const p = F.east ? { x: d.x1 + 2, y: d.y0 + 4 + Math.sin(s * 1.5) * 4, z: z0 + h * 0.85 * u } : { x: d.x0 + 4 + Math.sin(s * 1.5) * 4, y: d.y1 + 2, z: z0 + h * 0.85 * u };
          pts.push(cam.p(p));
        }
        PD.city.vine(ctx, pts, rnd, cam.zoom, ink);
      }
    },
  };

  // O caixa: preto com a faixa amarela (`cor`, `faixa`), o tampo escuro com a beirada clara; com `caixa`, a
  // registradora e a maquininha de cartão. Os dois pedaços do L: a frente (`olhando: 90`) e a volta até a parede do
  // fundo (`olhando: 180`, a câmera vê o lado de trás dele e a ponta).
  small.balcao = {
    ...OLD.balcao,
    paint(ctx, cam, d, z0, ink) {
      if (!d.stripe && !d.color) return OLD.balcao.paint.call(this, ctx, cam, d, z0, ink);
      const h = d.h || 100;
      const black = d.color || '#26262a';
      const stripe = d.stripe || '#e8c020';
      const P = (x, y, z) => cam.p({ x, y, z });
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + h - 6, tone(black, 0.7), ink);
      const band = (pts) => quad(ctx, pts, stripe);
      const zb0 = z0 + 10, zb1 = z0 + 24;
      if ((d.angle ?? 90) === 90) {
        // a faixa amarela na frente e no lado
        band([P(d.x0, d.y1, zb0), P(d.x1, d.y1, zb0), P(d.x1, d.y1, zb1), P(d.x0, d.y1, zb1)]);
        quad(ctx, [P(d.x1, d.y1, zb0), P(d.x1, d.y0, zb0), P(d.x1, d.y0, zb1), P(d.x1, d.y1, zb1)], M.shade(stripe, -0.2));
      } else {
        // a volta do L: a ponta (que dá para o sul) com a faixa; o lado de trás com a prateleira de baixo
        band([P(d.x0, d.y1, zb0), P(d.x1, d.y1, zb0), P(d.x1, d.y1, zb1), P(d.x0, d.y1, zb1)]);
        quad(ctx, [P(d.x1, d.y1 - 10, z0 + 34), P(d.x1, d.y0 + 10, z0 + 34), P(d.x1, d.y0 + 10, z0 + 70), P(d.x1, d.y1 - 10, z0 + 70)], '#141416');
        quad(ctx, [P(d.x1, d.y1 - 12, z0 + 50), P(d.x1, d.y0 + 12, z0 + 50), P(d.x1, d.y0 + 12, z0 + 53), P(d.x1, d.y1 - 12, z0 + 53)], '#3a3a3f');
      }
      // o tampo, um pouco para fora, com a beirada clara
      H.box(ctx, cam, d.x0 - 4, d.x1 + 4, d.y0 - 3, d.y1 + 4, z0 + h - 6, z0 + h, { front: '#3a3a3f', side: '#2c2c30', top: '#1d1d20' }, ink);
      const zt = z0 + h;
      quad(ctx, [P(d.x0 - 4, d.y1 + 4, zt), P(d.x1 + 4, d.y1 + 4, zt), P(d.x1 + 4, d.y1 + 1, zt), P(d.x0 - 4, d.y1 + 1, zt)], 'rgba(255, 255, 255, 0.18)');
      if (d.register) {
        // a registradora (cinza claro, a tela e as teclas) e a maquininha de cartão
        const rx = d.x0 + (d.x1 - d.x0) * 0.42, ry = d.y0 + 6;
        H.box(ctx, cam, rx, rx + 34, ry, ry + 26, zt, zt + 12, { front: '#c9c4b8', side: '#a7a296', top: '#dcd7cb' }, ink);
        H.box(ctx, cam, rx + 4, rx + 30, ry + 2, ry + 10, zt + 12, zt + 26, { front: '#3a3f44', side: '#2c3034', top: '#4a5056' }, ink * 0.8);
        quad(ctx, [P(rx + 7, ry + 10, zt + 24), P(rx + 27, ry + 10, zt + 24), P(rx + 27, ry + 10, zt + 17), P(rx + 7, ry + 10, zt + 17)], '#8fe39a');
        const keys = [P(rx + 6, ry + 14, zt + 12.5), P(rx + 28, ry + 14, zt + 12.5), P(rx + 28, ry + 24, zt + 12.5), P(rx + 6, ry + 24, zt + 12.5)];
        quad(ctx, keys, '#efe9db');
        const mx = d.x0 + (d.x1 - d.x0) * 0.74, my = d.y0 + 16;
        H.box(ctx, cam, mx, mx + 9, my, my + 16, zt, zt + 4, { front: '#1f2a3a', side: '#162030', top: '#2c3a52' }, ink * 0.7);
        quad(ctx, [P(mx + 1.5, my + 2, zt + 4.2), P(mx + 7.5, my + 2, zt + 4.2), P(mx + 7.5, my + 8, zt + 4.2), P(mx + 1.5, my + 8, zt + 4.2)], '#7fc4f0');
      }
    },
  };

  // A vitrine: de fora, ela é parte da fachada (props.js chama a `front`); com o herói dentro, sai junto com a parede da
  // frente e fica só a base preta (com o filete amarelo).
  small.vitrine = {
    height: () => 40,
    blocks: 0,
    shadow: null,
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + 60, 18),
    paint(ctx, cam, d, z0, ink) {
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + 26, tone('#1d1d20', 0.7), ink);
      const P = (x, y, z) => cam.p({ x, y, z });
      quad(ctx, [P(d.x0, d.y1, z0 + 22), P(d.x1, d.y1, z0 + 22), P(d.x1, d.y1, z0 + 26), P(d.x0, d.y1, z0 + 26)], d.back || '#f2c84b');
    },
  };

  // O balcão de vidro dos doces, no meio da loja: a base preta, o vidro com as prateleiras de bala e chocolate, a moldura
  // de alumínio e os três potes de bala em cima (`doces`).
  small['balcao-vidro'] = {
    height: (d) => (d.h || 100) + 34,
    blocks: 0,
    shadow: (path, cam, d, h) => H.boxShadow(path, cam, d.x0, d.x1, d.y0, d.y1, h * 0.5),
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + (d.h || 100) + 50, 18),
    paint(ctx, cam, d, z0, ink) {
      const h = d.h || 100;
      const rnd = seeded(d.x0, d.y0, 3631);
      const P = (x, y, z) => cam.p({ x, y, z });
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + 14, tone('#1d1d20', 0.7), ink);
      const zg = z0 + 14, zt = z0 + h;
      // o fundo do vidro (lado de dentro, mais escuro), as prateleiras com os doces e o vidro da frente por cima
      quad(ctx, [P(d.x0, d.y0, zg), P(d.x1, d.y0, zg), P(d.x1, d.y0, zt), P(d.x0, d.y0, zt)], 'rgba(150, 178, 186, 0.55)');
      for (const lv of [0.05, 0.48]) {
        const z = zg + (zt - zg) * lv;
        quad(ctx, [P(d.x0 + 3, d.y0 + 3, z), P(d.x1 - 3, d.y0 + 3, z), P(d.x1 - 3, d.y1 - 3, z), P(d.x0 + 3, d.y1 - 3, z)], 'rgba(214, 236, 242, 0.85)');
        // os doces em fileiras (pacotinhos coloridos em pé)
        for (let row = 0; row < 3; row++) {
          const yy = d.y0 + 8 + row * ((d.y1 - d.y0 - 16) / 3);
          for (let x = d.x0 + 8; x < d.x1 - 10; x += 10 + rnd() * 4) {
            const c = BOXC[Math.floor(rnd() * BOXC.length)];
            H.box(ctx, cam, x, x + 7, yy, yy + 5, z, z + 10 + rnd() * 8, tone(c), ink * 0.3);
          }
        }
      }
      // o vidro da frente e do lado (claro, com o reflexo) e a moldura de alumínio
      quad(ctx, [P(d.x0, d.y1, zg), P(d.x1, d.y1, zg), P(d.x1, d.y1, zt), P(d.x0, d.y1, zt)], 'rgba(214, 238, 246, 0.32)');
      quad(ctx, [P(d.x1, d.y1, zg), P(d.x1, d.y0, zg), P(d.x1, d.y0, zt), P(d.x1, d.y1, zt)], 'rgba(190, 220, 232, 0.4)');
      quad(ctx, [P(d.x0 + (d.x1 - d.x0) * 0.15, d.y1, zt), P(d.x0 + (d.x1 - d.x0) * 0.28, d.y1, zt), P(d.x0 + (d.x1 - d.x0) * 0.12, d.y1, zg), P(d.x0, d.y1, zg)], 'rgba(255, 255, 255, 0.28)');
      quad(ctx, [P(d.x0, d.y0, zt), P(d.x1, d.y0, zt), P(d.x1, d.y1, zt), P(d.x0, d.y1, zt)], 'rgba(226, 244, 250, 0.4)');
      ctx.strokeStyle = '#a8b0b4';
      ctx.lineWidth = Math.max(1.2, 2.2 * cam.zoom);
      ctx.lineJoin = 'round';
      const edges = [
        [P(d.x0, d.y1, zg), P(d.x1, d.y1, zg)], [P(d.x0, d.y1, zt), P(d.x1, d.y1, zt)], [P(d.x1, d.y1, zt), P(d.x1, d.y0, zt)],
        [P(d.x1, d.y1, zg), P(d.x1, d.y0, zg)], [P(d.x0, d.y0, zt), P(d.x1, d.y0, zt)], [P(d.x0, d.y0, zt), P(d.x0, d.y1, zt)],
        [P(d.x0, d.y1, zg), P(d.x0, d.y1, zt)], [P(d.x1, d.y1, zg), P(d.x1, d.y1, zt)], [P(d.x1, d.y0, zg), P(d.x1, d.y0, zt)],
      ];
      for (const [a, b] of edges) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // os potes de bala em cima
      if (d.sweets !== false) {
        const lids = ['#c0392b', '#2f73c4', '#27ae60'];
        for (let i = 0; i < 3; i++) {
          const cx = d.x0 + (d.x1 - d.x0) * (0.22 + i * 0.26);
          const cy = d.y0 + (d.y1 - d.y0) * 0.45;
          jar3d(ctx, cam, cx, cy, zt, 11, 26, lids[i], rnd, ink);
        }
      }
    },
  };
  /** Pote de bala em 3D (vidro, balas coloridas, a tampa). */
  function jar3d(ctx, cam, x, y, z, r, h, lid, rnd, ink) {
    const jb = cam.p({ x, y, z });
    const jt = cam.p({ x, y, z: z + h });
    const rx = r * cam.zoom, ry = rx * cam.sinP;
    ctx.fillStyle = 'rgba(214, 238, 244, 0.7)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 1.2;
    ctx.beginPath();
    ctx.ellipse(jb.x, jb.y, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(jt.x - rx, jt.y);
    ctx.ellipse(jt.x, jt.y, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let k = 0; k < 16; k++) {
      ctx.fillStyle = CANDY[Math.floor(rnd() * CANDY.length)];
      ctx.beginPath();
      ctx.arc(jb.x + (rnd() - 0.5) * rx * 1.5, jb.y - (jb.y - jt.y) * rnd() * 0.75 - 2 * cam.zoom, Math.max(1, 2.2 * cam.zoom), 0, M.TAU);
      ctx.fill();
    }
    ctx.fillStyle = lid;
    ctx.beginPath();
    ctx.ellipse(jt.x, jt.y, rx * 0.92, ry * 0.92, 0, 0, M.TAU);
    ctx.fill();
    ctx.stroke();
  }

  // O freezer horizontal branco de tampa de vidro (sem marca): os sorvetes lá dentro, as duas tampas de correr, a
  // grade do motor na frente e os pezinhos.
  small.freezer = {
    height: (d) => d.h || 90,
    blocks: 0,
    shadow: (path, cam, d, h) => H.boxShadow(path, cam, d.x0, d.x1, d.y0, d.y1, h * 0.5),
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + (d.h || 90) + 20, 18),
    paint(ctx, cam, d, z0, ink) {
      const h = d.h || 90;
      const rnd = seeded(d.x0, d.y0, 3641);
      const P = (x, y, z) => cam.p({ x, y, z });
      for (const [fx, fy] of [[0.06, 0.1], [0.94, 0.1], [0.06, 0.9], [0.94, 0.9]]) {
        const x = d.x0 + (d.x1 - d.x0) * fx, y = d.y0 + (d.y1 - d.y0) * fy;
        H.box(ctx, cam, x - 3, x + 3, y - 3, y + 3, z0, z0 + 6, tone('#2b2b2e'), ink * 0.6);
      }
      const zt = z0 + h;
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, z0 + 6, zt - 6, { front: '#eef1f2', side: '#cbd2d6', top: '#f7f9f9' }, ink);
      // a borda de cima (branca) com o vão das tampas
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, zt - 6, zt, { front: '#f4f6f6', side: '#d6dcdf', top: '#fbfcfc' }, ink);
      const ix0 = d.x0 + 8, ix1 = d.x1 - 8, iy0 = d.y0 + 8, iy1 = d.y1 - 8;
      quad(ctx, [P(ix0, iy0, zt), P(ix1, iy0, zt), P(ix1, iy1, zt), P(ix0, iy1, zt)], '#9fb6c2');
      // os sorvetes (caixinhas e picolés coloridos) vistos pelo vidro
      for (let k = 0; k < 22; k++) {
        const x = ix0 + 4 + rnd() * (ix1 - ix0 - 14), y = iy0 + 4 + rnd() * (iy1 - iy0 - 10);
        const c = ['#f2f0e8', '#f1c84a', '#e86a8a', '#7fc4f0', '#8e5a2b', '#3f9a4a'][Math.floor(rnd() * 6)];
        H.box(ctx, cam, x, x + 10, y, y + 6, zt - 10, zt - 4, tone(c), ink * 0.3);
      }
      // as duas tampas de vidro (uma um pouco em cima da outra) e o reflexo
      const midX = (ix0 + ix1) / 2;
      for (const [a0, a1, lift] of [[ix0, midX + 6, 0.6], [midX - 6, ix1, 1.6]]) {
        quad(ctx, [P(a0, iy0, zt + lift), P(a1, iy0, zt + lift), P(a1, iy1, zt + lift), P(a0, iy1, zt + lift)], 'rgba(214, 238, 246, 0.42)', '#b9c2c7', Math.max(1, 1.6 * cam.zoom));
      }
      quad(ctx, [P(ix0 + (ix1 - ix0) * 0.08, iy1, zt + 1.7), P(ix0 + (ix1 - ix0) * 0.2, iy1, zt + 1.7), P(ix0 + (ix1 - ix0) * 0.32, iy0, zt + 1.7), P(ix0 + (ix1 - ix0) * 0.2, iy0, zt + 1.7)], 'rgba(255, 255, 255, 0.45)');
      // a grade do motor na frente
      H.onWall(ctx, cam, { x: d.x0, y: d.y1 + 0.5, z: zt - 6 }, { x: 1, y: 0 }, () => {
        const L = d.x1 - d.x0;
        ctx.fillStyle = '#c4cbcf';
        ctx.fillRect(L - 44, h - 34, 34, 16);
        ctx.strokeStyle = '#8e979c';
        ctx.lineWidth = 1.4;
        for (let x = L - 41; x < L - 12; x += 5) {
          ctx.beginPath();
          ctx.moveTo(x, h - 32);
          ctx.lineTo(x, h - 20);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        ctx.fillRect(0, 4, L, 6);
      });
    },
  };

  // A parede de grama (sintética) atrás do caixa: a grama cheia, o escudo dourado aceso (`neon`) e o arco de flores
  // amarelas (`flores`). É só desenho, colado na parede do fundo (a parede é quem segura).
  small['parede-verde'] = {
    height: () => 330,
    blocks: 0,
    shadow: null,
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1, d.y0, d.y0 + 12, z0, z0 + 330, 30),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 3651);
      const top = z0 + 322;
      const L = d.x1 - d.x0;
      const Hh = 322 - 16;
      const P = (x, y, z) => cam.p({ x, y, z });
      // a placa (fininha, 8 cm da parede)
      quad(ctx, [P(d.x0, d.y0 + 8, z0 + 16), P(d.x1, d.y0 + 8, z0 + 16), P(d.x1, d.y0 + 8, top), P(d.x0, d.y0 + 8, top)], null, INK, ink * 2.2);
      H.onWall(ctx, cam, { x: d.x0, y: d.y0 + 8, z: top }, { x: 1, y: 0 }, () => {
        ctx.fillStyle = '#2d5a28';
        ctx.fillRect(0, 0, L, Hh);
        // a grama: muitos tufinhos claros e escuros
        for (let k = 0; k < (L * Hh) / 26; k++) {
          const x = rnd() * L, y = rnd() * Hh;
          ctx.fillStyle = ['#3f7a34', '#4f8f3e', '#2a5224', '#5f9e48', '#376b2f'][Math.floor(rnd() * 5)];
          ctx.beginPath();
          ctx.ellipse(x, y, 2.8 + rnd() * 2, 1.4 + rnd(), rnd() * 3, 0, M.TAU);
          ctx.fill();
        }
        // o arco de flores amarelas (no alto e descendo pelas pontas)
        if (d.flowers) {
          const garland = [];
          for (let k = 0; k <= 40; k++) {
            const t = k / 40;
            const side = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
            garland.push({ x: L * t, y: 14 + (1 - side) * Hh * 0.45 + Math.sin(t * 22) * 5 });
          }
          for (const g of garland) {
            for (let j = 0; j < 3; j++) {
              ctx.fillStyle = '#3c7232';
              ctx.beginPath();
              ctx.ellipse(g.x + (rnd() - 0.5) * 14, g.y + (rnd() - 0.5) * 10, 5, 2.6, rnd() * 3, 0, M.TAU);
              ctx.fill();
            }
            for (let j = 0; j < 3; j++) {
              const fx = g.x + (rnd() - 0.5) * 16, fy = g.y + (rnd() - 0.5) * 12;
              ctx.fillStyle = j % 2 ? '#f6d23a' : '#f2b81e';
              for (let p = 0; p < 5; p++) {
                const a = (p / 5) * M.TAU;
                ctx.beginPath();
                ctx.arc(fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2.1, 0, M.TAU);
                ctx.fill();
              }
              ctx.fillStyle = '#c7781c';
              ctx.beginPath();
              ctx.arc(fx, fy, 1.4, 0, M.TAU);
              ctx.fill();
            }
          }
        }
        // o escudo aceso, no meio
        if (d.logo) {
          const w = Math.min(130, L * 0.42);
          const cy = Hh * 0.3;
          const glow = ctx.createRadialGradient(L / 2, cy + w * 0.55, w * 0.1, L / 2, cy + w * 0.55, w * 1.1);
          glow.addColorStop(0, 'rgba(255, 210, 110, 0.35)');
          glow.addColorStop(1, 'rgba(255, 210, 110, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, L, Hh);
          shield(ctx, L / 2, cy, w, !d.neon);
        }
      });
    },
  };

  // O ventilador de parede: o suporte, o braço e a cabeça redonda (a grade, as pás e o motor atrás), preto.
  small.ventilador = {
    height: (d) => (d.h || 250) + 30,
    blocks: 0,
    shadow: null,
    box: (cam, d, z0) => volBox(cam, d.x - 40, d.x + 40, d.y - 10, d.y + 60, z0 + (d.h || 250) - 50, z0 + (d.h || 250) + 40, 16),
    paint(ctx, cam, d, z0, ink) {
      const zc = z0 + (d.h || 250);
      const wy = d.y + 2;
      // o suporte na parede e o braço
      H.box(ctx, cam, d.x - 6, d.x + 6, wy, wy + 4, zc - 12, zc + 8, tone('#232326'), ink);
      const a = cam.p({ x: d.x, y: wy + 4, z: zc - 2 }), b = cam.p({ x: d.x + 4, y: wy + 24, z: zc - 6 });
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      ctx.lineWidth = 5 * cam.zoom + ink;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = '#2b2b2e';
      ctx.lineWidth = 3.4 * cam.zoom;
      ctx.stroke();
      // o motor (atrás da grade)
      const m = cam.p({ x: d.x + 4, y: wy + 26, z: zc - 6 });
      ctx.fillStyle = '#1f1f22';
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, 9 * cam.zoom, 8 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
      // a cabeça: a grade redonda de frente para a loja, um pouco para baixo
      H.onWall(ctx, cam, { x: d.x - 20, y: wy + 34, z: zc + 14 }, { x: 1, y: 0 }, () => {
        const cx = 24, cy = 20, R = 21;
        ctx.fillStyle = 'rgba(40, 40, 44, 0.35)';
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, M.TAU);
        ctx.fill();
        // as pás (paradas, um pouco borradas)
        ctx.fillStyle = 'rgba(60, 60, 66, 0.75)';
        for (let k = 0; k < 3; k++) {
          const t = (k / 3) * M.TAU + 0.4;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(t) * R * 0.45, cy + Math.sin(t) * R * 0.45, R * 0.42, R * 0.2, t, 0, M.TAU);
          ctx.fill();
        }
        ctx.strokeStyle = '#1c1c1f';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, M.TAU);
        ctx.stroke();
        ctx.lineWidth = 0.9;
        for (const rr of [R * 0.35, R * 0.68]) {
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, M.TAU);
          ctx.stroke();
        }
        for (let k = 0; k < 16; k++) {
          const t = (k / 16) * M.TAU;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(t) * 4, cy + Math.sin(t) * 4);
          ctx.lineTo(cx + Math.cos(t) * R, cy + Math.sin(t) * R);
          ctx.stroke();
        }
        ctx.fillStyle = '#2b2b2e';
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, M.TAU);
        ctx.fill();
      });
    },
  };

  // ------------------------------------------------------------------ a calçada
  // A lousinha de cavalete (`cavalete`): o quadro preto inclinado, a moldura de madeira, os pés de trás e as ofertas
  // escritas a giz colorido (texto genérico, sem marca).
  small.lousa = {
    height: () => 125,
    blocks: 0,
    shadow: (path, cam, d) => H.lineShadow(path, cam, d.x, d.y, 110, 30),
    box: (cam, d, z0) => volBox(cam, d.x - 45, d.x + 45, d.y - 40, d.y + 30, z0, z0 + 130, 16),
    paint(ctx, cam, d, z0, ink) {
      const W = 62, Hh = 92;
      const P = (x, y, z) => cam.p({ x, y, z });
      // os pés de trás (o "A" visto de lado)
      for (const sx of [-W / 2 + 4, W / 2 - 4]) {
        const a = P(d.x + sx, d.y - 4, z0 + 116), b = P(d.x + sx, d.y - 34, z0);
        ctx.strokeStyle = INK;
        ctx.lineCap = 'round';
        ctx.lineWidth = 4.4 * cam.zoom + ink;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = '#8a5a34';
        ctx.lineWidth = 4.4 * cam.zoom;
        ctx.stroke();
      }
      // o quadro: do alto (um pouco para trás) até o chão (um pouco para a frente)
      const tl = P(d.x - W / 2, d.y - 4, z0 + 118), tr = P(d.x + W / 2, d.y - 4, z0 + 118), bl = P(d.x - W / 2, d.y + 18, z0 + 4);
      const ux = (tr.x - tl.x) / W, uy = (tr.y - tl.y) / W;
      const vx = (bl.x - tl.x) / (Hh + 24), vy = (bl.y - tl.y) / (Hh + 24);
      ctx.save();
      ctx.transform(ux, uy, vx, vy, tl.x, tl.y);
      ctx.fillStyle = INK;
      ctx.fillRect(-3, -3, W + 6, Hh + 30);
      ctx.fillStyle = '#9a6a3c';
      ctx.fillRect(0, 0, W, Hh + 24);
      ctx.fillStyle = '#25302b';
      ctx.fillRect(5, 5, W - 10, Hh - 4);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 9px system-ui, sans-serif';
      ctx.fillStyle = '#ffe36a';
      ctx.fillText('OFERTAS', W / 2, 15);
      ctx.font = '700 7px system-ui, sans-serif';
      [['#ff9fc4', 'AÇAÍ  8'], ['#9fe8ff', 'SUCO  5'], ['#b8f08a', 'PÃO DE'], ['#b8f08a', 'QUEIJO  3'], ['#ffd08a', 'PICOLÉ  4']].forEach(([c, t], i) => {
        ctx.fillStyle = c;
        ctx.fillText(t, W / 2, 30 + i * 11);
      });
      // uma estrelinha de giz e o pó embaixo
      ctx.strokeStyle = '#ffe36a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k <= 5; k++) {
        const t = (k * 4 * Math.PI) / 5 - Math.PI / 2;
        const x = W - 12 + Math.cos(t) * 5, y = 13 + Math.sin(t) * 5;
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(235, 235, 225, 0.25)';
      ctx.fillRect(6, Hh - 8, W - 12, 6);
      ctx.restore();
    },
  };

  // Caixote de madeira (`fruta`: 'banana' ou 'laranja'): as ripas com as frestas e as frutas fazendo monte em cima.
  small.caixote = {
    height: (d) => (d.h || 50) + 18,
    blocks: 0,
    shadow: (path, cam, d, h) => H.boxShadow(path, cam, d.x0, d.x1, d.y0, d.y1, h * 0.6),
    box: (cam, d, z0) => volBox(cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + (d.h || 50) + 30, 18),
    paint(ctx, cam, d, z0, ink) {
      const h = d.h || 50;
      const rnd = seeded(d.x0, d.y0, 3661);
      const P = (x, y, z) => cam.p({ x, y, z });
      const WOOD = { front: '#b8834c', side: '#94663a', top: '#cf9c62' };
      H.box(ctx, cam, d.x0, d.x1, d.y0, d.y1, z0, z0 + h, WOOD, ink);
      // as ripas: frestas escuras na frente e no lado
      for (const [o, dir, L] of [[{ x: d.x0, y: d.y1 + 0.5, z: z0 + h }, { x: 1, y: 0 }, d.x1 - d.x0], [{ x: d.x1 + 0.5, y: d.y1, z: z0 + h }, { x: 0, y: -1 }, d.y1 - d.y0]]) {
        H.onWall(ctx, cam, o, dir, () => {
          ctx.fillStyle = 'rgba(40, 24, 10, 0.55)';
          for (const y of [h * 0.3, h * 0.62]) ctx.fillRect(0, y, L, 4);
          ctx.fillStyle = 'rgba(255, 240, 210, 0.18)';
          ctx.fillRect(0, 2, L, 3);
          ctx.fillStyle = 'rgba(60, 36, 16, 0.4)';
          ctx.fillRect(3, 0, 4, h);
          ctx.fillRect(L - 7, 0, 4, h);
        });
      }
      // as frutas: do fundo para a frente, um monte mais alto no meio
      const zt = z0 + h;
      const items = [];
      const banana = d.fruit === 'banana';
      const n = banana ? 9 : 26;
      for (let k = 0; k < n; k++) {
        const x = d.x0 + 8 + rnd() * (d.x1 - d.x0 - 16), y = d.y0 + 6 + rnd() * (d.y1 - d.y0 - 12);
        const mid = 1 - Math.abs((x - (d.x0 + d.x1) / 2) / ((d.x1 - d.x0) / 2));
        items.push({ x, y, z: zt - 4 + mid * (banana ? 10 : 14) + rnd() * 4, rot: rnd() * Math.PI });
      }
      items.sort((p, q) => cam.depth(p) - cam.depth(q));
      for (const it of items) {
        const q = cam.p(it);
        if (banana) {
          // um cacho: três bananas curvas lado a lado
          for (let j = 0; j < 3; j++) {
            const ox = (j - 1) * 4 * cam.zoom;
            ctx.strokeStyle = INK;
            ctx.lineCap = 'round';
            ctx.lineWidth = 6.4 * cam.zoom + ink;
            ctx.beginPath();
            ctx.arc(q.x + ox, q.y + 10 * cam.zoom, 12 * cam.zoom, Math.PI * 1.15 + it.rot * 0.2, Math.PI * 1.85 + it.rot * 0.2);
            ctx.stroke();
            ctx.strokeStyle = j % 2 ? '#f6d23a' : '#f2c21c';
            ctx.lineWidth = 6.4 * cam.zoom;
            ctx.stroke();
          }
          ctx.fillStyle = '#5a6a28';
          ctx.fillRect(q.x - 2 * cam.zoom, q.y - 4 * cam.zoom, 4 * cam.zoom, 4 * cam.zoom);
        } else {
          const R = 6.6 * cam.zoom;
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.arc(q.x, q.y, R + ink * 0.8, 0, M.TAU);
          ctx.fill();
          const og = ctx.createRadialGradient(q.x - R * 0.35, q.y - R * 0.4, R * 0.1, q.x, q.y, R);
          og.addColorStop(0, '#ffc066');
          og.addColorStop(1, '#e8781c');
          ctx.fillStyle = og;
          ctx.beginPath();
          ctx.arc(q.x, q.y, R, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#4f7a2a';
          ctx.fillRect(q.x - 1 * cam.zoom, q.y - R, 2 * cam.zoom, 2.4 * cam.zoom);
        }
      }
      // a borda de cima do caixote, por cima das frutas da frente
      quad(ctx, [P(d.x0, d.y1, zt), P(d.x1, d.y1, zt), P(d.x1, d.y1, zt - 6), P(d.x0, d.y1, zt - 6)], WOOD.front, INK, ink);
      quad(ctx, [P(d.x1, d.y1, zt), P(d.x1, d.y0, zt), P(d.x1, d.y0, zt - 6), P(d.x1, d.y1, zt - 6)], WOOD.side, INK, ink);
    },
  };

  // O vaso com a dracena (`planta: 'dracena'`): na calçada, de cimento; dentro da loja (`dentro`), de barro. Dois ou três
  // caules finos, cada um com o tufo de folhas compridas e estreitas caindo em arco.
  small.vaso = {
    ...OLD.vaso,
    height: (d) => (d.plant === 'dracena' ? 150 : OLD.vaso.height(d)),
    box: (cam, d, z0, h) => (d.plant === 'dracena' ? volBox(cam, d.x - 70, d.x + 70, d.y - 70, d.y + 70, z0, z0 + 160, 16) : OLD.vaso.box(cam, d, z0, h)),
    paint(ctx, cam, d, z0, ink) {
      if (d.plant !== 'dracena') return OLD.vaso.paint.call(this, ctx, cam, d, z0, ink);
      const rnd = seeded(d.x, d.y, 3671);
      const clay = d.inside ? { front: '#a25a35', side: '#7e4226', top: '#b8724a' } : { front: '#a7a296', side: '#87827a', top: '#bdb8ac' };
      // o vaso (quadrado na calçada, redondo de barro dentro)
      const pr = d.inside ? 17 : 20, ph = d.inside ? 40 : 46;
      if (d.inside) {
        const qb = cam.p({ x: d.x, y: d.y, z: z0 }), qt = cam.p({ x: d.x, y: d.y, z: z0 + ph });
        const rx = pr * cam.zoom, ry = rx * cam.sinP;
        ctx.fillStyle = clay.front;
        ctx.strokeStyle = INK;
        ctx.lineWidth = ink * 1.6;
        ctx.beginPath();
        ctx.ellipse(qb.x, qb.y, rx * 0.8, ry * 0.8, 0, 0, Math.PI);
        ctx.lineTo(qt.x - rx, qt.y);
        ctx.ellipse(qt.x, qt.y, rx, ry, 0, Math.PI, 0, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = clay.top;
        ctx.beginPath();
        ctx.ellipse(qt.x, qt.y, rx, ry, 0, 0, M.TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#4a3420';
        ctx.beginPath();
        ctx.ellipse(qt.x, qt.y, rx * 0.8, ry * 0.8, 0, 0, M.TAU);
        ctx.fill();
      } else {
        H.box(ctx, cam, d.x - pr, d.x + pr, d.y - pr, d.y + pr, z0, z0 + ph, clay, ink);
        const top = [cam.p({ x: d.x - pr + 4, y: d.y - pr + 4, z: z0 + ph }), cam.p({ x: d.x + pr - 4, y: d.y - pr + 4, z: z0 + ph }), cam.p({ x: d.x + pr - 4, y: d.y + pr - 4, z: z0 + ph }), cam.p({ x: d.x - pr + 4, y: d.y + pr - 4, z: z0 + ph })];
        quad(ctx, top, '#4a3420');
      }
      // os caules e os tufos
      const stems = [[-5, -3, 92], [6, 2, 118], [1, 6, 70]];
      for (const [sx, sy, sh] of stems) {
        const base = { x: d.x + sx * 0.4, y: d.y + sy * 0.4, z: z0 + ph };
        const top = { x: d.x + sx, y: d.y + sy, z: z0 + ph + sh };
        const a = cam.p(base), b = cam.p(top);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.4 * cam.zoom + ink;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = '#7a6448';
        ctx.lineWidth = 4.4 * cam.zoom;
        ctx.stroke();
        const leaves = [];
        for (let k = 0; k < 14; k++) {
          const t = (k / 14) * M.TAU + rnd() * 0.4;
          leaves.push({ t, len: 26 + rnd() * 18, droop: 0.4 + rnd() * 0.5, depth: Math.cos(t) + Math.sin(t) });
        }
        leaves.sort((p, q) => p.depth - q.depth);
        for (const L of leaves) {
          const tip = cam.p({ x: top.x + Math.cos(L.t) * L.len, y: top.y + Math.sin(L.t) * L.len, z: top.z - L.len * L.droop });
          const mid = cam.p({ x: top.x + Math.cos(L.t) * L.len * 0.5, y: top.y + Math.sin(L.t) * L.len * 0.5, z: top.z + L.len * 0.18 });
          for (const [w, c] of [[4.2 * cam.zoom + ink, INK], [4.2 * cam.zoom, L.depth > 0 ? '#4f8f3e' : '#3c7232'], [1 * cam.zoom, '#9cc46a']]) {
            ctx.strokeStyle = c;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
            ctx.stroke();
          }
        }
      }
    },
  };

  // ------------------------------------------------------------------ o chão
  /** O porcelanato branco (placas de 60 cm, rejunte claro e o brilho); com `folhas`, folhas secas e terra perto da porta. */
  function porcelanato(ctx, sh, box) {
    const sb = G.shapeBox(sh);
    const b = { x0: Math.max(sb.x0, box.x0), y0: Math.max(sb.y0, box.y0), x1: Math.min(sb.x1, box.x1), y1: Math.min(sb.y1, box.y1) };
    if (b.x1 <= b.x0 || b.y1 <= b.y0) return true;
    ctx.save();
    G.shapePath(ctx, sh);
    ctx.clip();
    ctx.fillStyle = sh.color || '#efeee9';
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    const S = 60;
    for (let i = Math.floor(b.x0 / S); i * S < b.x1; i++) {
      for (let j = Math.floor(b.y0 / S); j * S < b.y1; j++) {
        const r = G.cellRng(i, j, 3681);
        ctx.fillStyle = r() < 0.5 ? 'rgba(0, 0, 0, 0.025)' : 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(i * S + 1, j * S + 1, S - 2, S - 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(i * S + 4, j * S + 4, S * 0.5, 2);
      }
    }
    ctx.strokeStyle = 'rgba(170, 168, 160, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = Math.ceil(b.x0 / S) * S; x < b.x1; x += S) {
      ctx.moveTo(x, b.y0);
      ctx.lineTo(x, b.y1);
    }
    for (let y = Math.ceil(b.y0 / S) * S; y < b.y1; y += S) {
      ctx.moveTo(b.x0, y);
      ctx.lineTo(b.x1, y);
    }
    ctx.stroke();
    if (sh.leaves) {
      // folhas secas e um pouco de terra, mais perto da porta (o lado sul) e das paredes
      const rr = seeded(sb.x0, sb.y0, 3683);
      const LEAF = ['#c8963c', '#a8692c', '#d9b25a', '#8a5a2a', '#b98a3a'];
      for (let k = 0; k < 70; k++) {
        const near = rr() < 0.65;
        const x = sb.x0 + rr() * (sb.x1 - sb.x0);
        const y = near ? sb.y1 - rr() * rr() * 150 : sb.y0 + rr() * (sb.y1 - sb.y0);
        ctx.fillStyle = LEAF[Math.floor(rr() * LEAF.length)];
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + rr() * 2.5, 1.6 + rr() * 1.2, rr() * 3, 0, M.TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(120, 96, 60, 0.16)';
      for (let k = 0; k < 10; k++) {
        ctx.beginPath();
        ctx.ellipse(sb.x0 + rr() * (sb.x1 - sb.x0), sb.y1 - rr() * 80, 18 + rr() * 30, 8 + rr() * 12, rr() * 3, 0, M.TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    return true;
  }
  if (PD.casas && PD.casas.floor) PD.casas.floor.porcelanato = porcelanato;

  /** O degrau de cimento da porta (com `capacho`, o capacho de palha em cima). A altura dele é desenhada no chão. */
  texture.degrau = (ctx, sh, box) => {
    if (sh.kind !== 'rect') return false;
    const { x0, x1, y0, y1 } = sh;
    if (x1 < box.x0 || x0 > box.x1 || y1 < box.y0 || y0 > box.y1) return true;
    ctx.fillStyle = '#c9c3b6';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(x0, y0, x1 - x0, 4);
    // a quina da frente (a altura do degrau) mais escura e a sombra no chão
    ctx.fillStyle = '#9d978a';
    ctx.fillRect(x0, y1 - 7, x1 - x0, 7);
    ctx.fillStyle = 'rgba(20, 16, 12, 0.22)';
    ctx.fillRect(x0 - 2, y1, x1 - x0 + 4, 6);
    if (sh.mat) {
      const mw = Math.min(110, (x1 - x0) * 0.5), mh = Math.min(30, (y1 - y0) - 8);
      const mx = (x0 + x1) / 2 - mw / 2, my = y0 + (y1 - y0 - mh) / 2 - 2;
      ctx.fillStyle = '#7a5a32';
      ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
      ctx.fillStyle = '#c9a463';
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeStyle = 'rgba(122, 90, 50, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = mx + 4; x < mx + mw; x += 4) {
        ctx.moveTo(x, my);
        ctx.lineTo(x, my + mh);
      }
      ctx.stroke();
    }
    return true;
  };

  PD.budega = { front, side, innerWall, shield };
})(window.PD = window.PD || {});
