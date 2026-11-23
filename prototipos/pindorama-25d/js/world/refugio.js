// O Refúgio de Guarapiranga (Mapa 02; desenho do [mundo], que desde 19/11 desenha o mapa inteiro, decisão do dono;
// referência docs/referencias/mapa-02-refugio-conceito.jpg): a vila de pescadores sobre palafitas na represa.
//  - as casas de tábua (`casa` com `material: 'tabua'`): tábuas em pé pintadas e descascando, porta de tábua (ou
//    cortina de pano), janelas com as folhas abertas, umidade e musgo no pé da parede; o telhado de duas águas de
//    zinco (`telhado: 'zinco'`), com as chapas ondulas de tons diferentes, ferrugem escorrendo, pedras e um pneu
//    segurando as chapas e folhas da mata caídas por cima;
//  - a quitanda (`comercio: 'quitanda'`): o balcão aberto com as frutas, as prateleiras lá dentro e a placa pintada;
//  - os barcos (`barco`: `tipo` 'canoa' ou 'voadeira', `cor`, `olhando` = para onde a proa aponta, `afundado`);
//  - os barris (`barril`: bombona azul, tambor de lata ou barril de madeira, sorteado), o ponto de ônibus da
//    chegada (`ponto-onibus`, com `placa`), as redes de pesca secando (`rede`) e o lampião de poste de madeira
//    (`poste-praca` com `estilo: 'lampiao'`, que vira o tipo `lampiao`);
//  - a banca de frutas da Dona Iracema (`banca-frutas`, em U, com ela no miolo): caixotes de fruta e a balança.
//   PD.refugio.front(ctx, b, W, H, r)       a frente (+y) da casa de tábua (props.js, House)
//   PD.refugio.side(ctx, b, D, H, r)        o lado (+x)
//   PD.refugio.roof(ctx, cam, b, z0, ink)   o telhado de zinco (por cima da caixa da casa)
//   PD.refugio.windows(b)                   onde ficam as janelas da frente (para a luz de dentro, de noite: view.js)
//   PD.city.small[tipo]                     barco, barril, ponto-onibus, rede, lampiao, varal, banca-frutas
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
  function pathOf(pts, close = true) {
    const p = new Path2D();
    pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
    if (close) p.closePath();
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
  function inkLine(ctx, pts, color, width, ink) {
    const p = pathOf(pts, false);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = width + ink * 2;
    ctx.stroke(p);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke(p);
  }
  /**
   * Desenha num plano do mundo em cm: o ponto local (s, t) vai para o mundo em o + s·u + t·v (u e v em cm do mundo por
   * cm local). A câmera é ortográfica: a conta vira uma transformação do canvas.
   */
  function onPlane(ctx, cam, o, u, v, fn) {
    const po = cam.p(o);
    const pu = cam.p({ x: o.x + u.x, y: o.y + u.y, z: o.z + u.z });
    const pv = cam.p({ x: o.x + v.x, y: o.y + v.y, z: o.z + v.z });
    ctx.save();
    ctx.transform(pu.x - po.x, pu.y - po.y, pv.x - po.x, pv.y - po.y, po.x, po.y);
    fn();
    ctx.restore();
  }
  function leaf(ctx, x, y, s, a, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.quadraticCurveTo(0, -s * 0.55, s, 0);
    ctx.quadraticCurveTo(0, s * 0.55, -s, 0);
    ctx.fill();
    ctx.restore();
  }
  const LEAVES = ['#5f7f34', '#7a8c3a', '#9a8a3e', '#b07a3a', '#4f6e2e'];

  // ------------------------------------------------------------------ as paredes de tábua
  const RAW = '#8d6b45';
  /**
   * Tábuas em pé numa parede de `len` × `Hh` cm (coordenadas da parede: x ao longo, y para baixo a partir do alto).
   * `color`: a tinta; umas tábuas trocadas (sem tinta ou de outra cor), a tinta descascando, os pregos, a umidade e o
   * musgo no pé da parede.
   */
  function planks(ctx, len, Hh, color, r, top = 0) {
    const others = ['#b9a27a', '#6e8f9e', '#a4573f', '#d7c9a8'];
    for (let x = 0; x < len; ) {
      const w = Math.min(len - x, 15 + r() * 9);
      const roll = r();
      const c = roll < 0.07 ? RAW : roll < 0.11 ? others[Math.floor(r() * others.length)] : M.shade(color, (r() - 0.5) * 0.18);
      ctx.fillStyle = c;
      ctx.fillRect(x, top, w, Hh - top);
      // a luz na beirada esquerda da tábua e a fresta escura na direita
      ctx.fillStyle = 'rgba(255, 246, 225, 0.13)';
      ctx.fillRect(x, top, 2.2, Hh - top);
      ctx.fillStyle = 'rgba(32, 18, 8, 0.55)';
      ctx.fillRect(x + w - 1.8, top, 1.8, Hh - top);
      // a tinta descascando (aparece a madeira)
      if (c !== RAW && r() < 0.55) {
        ctx.fillStyle = 'rgba(141, 107, 69, 0.85)';
        for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
          const py = top + r() * (Hh - top - 30);
          ctx.beginPath();
          ctx.ellipse(x + w * (0.3 + r() * 0.4), py, w * (0.2 + r() * 0.25), 6 + r() * 16, 0, 0, M.TAU);
          ctx.fill();
        }
      }
      // os pregos de cima e de baixo
      ctx.fillStyle = 'rgba(30, 20, 14, 0.75)';
      for (const py of [top + 12, Hh - 22]) {
        ctx.beginPath();
        ctx.arc(x + w * 0.5, py, 1.6, 0, M.TAU);
        ctx.fill();
      }
      x += w;
    }
    // a umidade subindo do pé da parede (a água da represa) e o musgo
    const g = ctx.createLinearGradient(0, Hh - 70, 0, Hh);
    g.addColorStop(0, 'rgba(30, 40, 30, 0)');
    g.addColorStop(1, 'rgba(30, 40, 30, 0.32)');
    ctx.fillStyle = g;
    ctx.fillRect(0, Hh - 70, len, 70);
    for (let k = 0; k < len / 40; k++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(86, 118, 52, 0.55)' : 'rgba(110, 138, 60, 0.45)';
      ctx.beginPath();
      ctx.ellipse(r() * len, Hh - 4 - r() * 18, 8 + r() * 18, 4 + r() * 7, 0, 0, M.TAU);
      ctx.fill();
    }
    // a tábua de cima (o beiral de dentro, embaixo do telhado)
    ctx.fillStyle = M.shade(color, -0.32);
    ctx.fillRect(0, top, len, 12);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, top + 12, len, 5);
  }
  /** A porta de tábua (com a travessa em Z), ou a cortina de pano na porta aberta. */
  function door(ctx, x, y, w, h, color, r) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 6);
    if (r() < 0.4) {
      // a porta aberta com a cortina de pano estampado
      ctx.fillStyle = '#2a1d16';
      ctx.fillRect(x, y, w, h);
      const cloth = ['#d9533e', '#e8b53b', '#3d7bbf', '#7b4a9a'][Math.floor(r() * 4)];
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w * 0.96, y + h * 0.88);
      ctx.quadraticCurveTo(x + w * 0.6, y + h * 0.78, x + w * 0.5, y + h * 0.92);
      ctx.quadraticCurveTo(x + w * 0.35, y + h * 0.8, x + w * 0.05, y + h * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      for (let k = 0; k < 9; k++) {
        ctx.beginPath();
        ctx.arc(x + 8 + r() * (w - 16), y + 10 + r() * h * 0.7, 3 + r() * 3, 0, M.TAU);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 2;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x + (w * k) / 4, y + 4);
        ctx.lineTo(x + (w * k) / 4 + 4, y + h * 0.82);
        ctx.stroke();
      }
    } else {
      const c = M.shade(color, -0.2);
      for (let k = 0, px = x; px < x + w - 1; k++) {
        const bw = Math.min(x + w - px, w / 4);
        ctx.fillStyle = M.shade(c, (k % 2 ? -0.06 : 0.04) + (r() - 0.5) * 0.06);
        ctx.fillRect(px, y, bw, h);
        ctx.fillStyle = 'rgba(30, 18, 8, 0.5)';
        ctx.fillRect(px + bw - 1.5, y, 1.5, h);
        px += bw;
      }
      // as travessas e a diagonal (o Z)
      ctx.fillStyle = M.shade(c, -0.18);
      ctx.fillRect(x + 4, y + h * 0.16, w - 8, 12);
      ctx.fillRect(x + 4, y + h * 0.76, w - 8, 12);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y + h * 0.16 + 12, w, h * 0.6 - 12);
      ctx.clip();
      ctx.strokeStyle = M.shade(c, -0.18);
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + h * 0.76);
      ctx.lineTo(x + w - 6, y + h * 0.16 + 12);
      ctx.stroke();
      ctx.restore();
      // a maçaneta de arame
      ctx.fillStyle = '#3a3430';
      ctx.beginPath();
      ctx.arc(x + w - 14, y + h * 0.52, 3.5, 0, M.TAU);
      ctx.fill();
    }
    // o batente
    ctx.strokeStyle = M.shade(color, -0.4);
    ctx.lineWidth = 5;
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 2);
  }
  /** A janela com as duas folhas abertas para fora (pintadas de outra cor), o escuro de dentro e a lata com planta. */
  function windowOpen(ctx, x, y, w, h, color, r) {
    const shutter = ['#e9e1cc', '#2f6f9f', '#c94f3d', '#e2b13c', '#4f8f5a'][Math.floor(r() * 5)];
    // as folhas abertas, uma de cada lado
    for (const [sx, dir] of [[x - w / 2 - 4, -1], [x + w + 4, 1]]) {
      ctx.fillStyle = INK;
      ctx.fillRect(sx - 3, y - 3, w / 2 + 6, h + 6);
      ctx.fillStyle = shutter;
      ctx.fillRect(sx, y, w / 2, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      for (let k = 1; k < 4; k++) ctx.fillRect(sx, y + (h * k) / 4, w / 2, 2.5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(sx + (dir < 0 ? w / 2 - 4 : 0), y, 4, h);
    }
    // o vão: escuro, com a luz de dentro de leve
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#2b211b');
    g.addColorStop(1, '#4a382a');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // a cortininha de dentro
    ctx.fillStyle = ['#f2e8d0', '#e7a7a0', '#b8d0e6'][Math.floor(r() * 3)];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.3, y);
    ctx.quadraticCurveTo(x + w * 0.18, y + h * 0.5, x, y + h * 0.78);
    ctx.closePath();
    ctx.fill();
    // o peitoril e a lata de tinta velha com planta
    ctx.fillStyle = M.shade(color, -0.35);
    ctx.fillRect(x - 10, y + h, w + 20, 9);
    if (r() < 0.7) {
      const lx = x + w * (0.55 + r() * 0.25);
      ctx.fillStyle = INK;
      ctx.fillRect(lx - 11, y + h - 24, 22, 25);
      ctx.fillStyle = ['#b9bcbe', '#c94f3d', '#e2b13c'][Math.floor(r() * 3)];
      ctx.fillRect(lx - 9, y + h - 22, 18, 22);
      for (let k = 0; k < 7; k++) leaf(ctx, lx + (r() - 0.5) * 16, y + h - 26 - r() * 18, 7 + r() * 5, -Math.PI / 2 + (r() - 0.5) * 2.2, k % 2 ? '#4f8f3a' : '#6aa64a');
    }
    // o batente
    ctx.strokeStyle = M.shade(color, -0.4);
    ctx.lineWidth = 5;
    ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
  }
  /** O cipó subindo pela quina da casa (a mata entrando na vila). */
  function vineUp(ctx, x, Hh, len, r) {
    ctx.strokeStyle = '#3f5a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    let px = x, py = Hh;
    ctx.moveTo(px, py);
    const pts = [];
    for (let k = 0; k < 10; k++) {
      px += (r() - 0.5) * 14;
      py -= len / 10;
      ctx.lineTo(px, py);
      pts.push([px, py]);
    }
    ctx.stroke();
    for (const [lx, ly] of pts) for (let j = 0; j < 2; j++) leaf(ctx, lx + (r() - 0.5) * 12, ly + (r() - 0.5) * 10, 7 + r() * 5, r() * M.TAU, r() < 0.5 ? '#4f7f34' : '#3f6a2c');
  }

  /** As janelas da frente (em cm da quina oeste, e a altura do vão de baixo a partir do chão), sem sorteio. */
  function windows(b) {
    const W = b.x1 - b.x0;
    if (b.shop) return [];
    const doorX = Math.min(W - 160, Math.max(30, W * 0.16));
    const room = W - (doorX + 92) - 50;
    // (cada janela precisa de 180 cm: as folhas abertas ficam dos dois lados dela)
    const n = room > 150 ? Math.max(1, Math.min(2, Math.floor(room / 180))) : 0;
    const out = [];
    for (let k = 0; k < n; k++) out.push({ x: doorX + 92 + 40 + (room / n) * (k + 0.5) - 40, w: 80, z0: 105, z1: 180 });
    return out;
  }

  function front(ctx, b, W, Hh, r) {
    if (b.shop && b.shop.type === 'quitanda') return quitanda(ctx, b, W, Hh, r);
    planks(ctx, W, Hh, b.wall, r);
    const doorX = Math.min(W - 160, Math.max(30, W * 0.16));
    door(ctx, doorX, Hh - 196, 92, 196, b.wall, r);
    // o degrau de tábua na frente da porta
    ctx.fillStyle = M.shade(b.wall, -0.45);
    ctx.fillRect(doorX - 10, Hh - 8, 112, 8);
    for (const w of windows(b)) windowOpen(ctx, w.x, Hh - w.z1, w.w, w.z1 - w.z0, b.wall, r);
    // a lamparina pendurada do lado da porta (acende de noite, view.js) e o número pintado à mão
    ctx.strokeStyle = '#3a3430';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(doorX + 110, Hh - 232);
    ctx.lineTo(doorX + 110, Hh - 214);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(doorX + 101, Hh - 215, 18, 22);
    ctx.fillStyle = '#f2c46a';
    ctx.fillRect(doorX + 104, Hh - 212, 12, 16);
    if (b.vine || r() < 0.6) vineUp(ctx, W - 10 - r() * 20, Hh, Hh * (0.5 + r() * 0.4), r);
  }
  function side(ctx, b, D, Hh, r) {
    planks(ctx, D, Hh, M.shade(b.wall, -0.22), r);
    // uma janelinha (fechada) no lado comprido e a mancha de chuva
    if (D > 320) {
      const wx = D * 0.5 - 30;
      ctx.fillStyle = INK;
      ctx.fillRect(wx - 5, Hh - 185, 70, 70);
      ctx.fillStyle = M.shade(b.wall, -0.5);
      ctx.fillRect(wx, Hh - 180, 60, 60);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(wx + 29, Hh - 180, 2.5, 60);
    }
    if (r() < 0.7) vineUp(ctx, 12 + r() * 20, Hh, Hh * (0.4 + r() * 0.5), r);
  }
  /** A quitanda: o balcão aberto com as frutas, as prateleiras de dentro e a placa pintada à mão. */
  function quitanda(ctx, b, W, Hh, r) {
    planks(ctx, W, Hh, b.wall, r);
    const ox = 34, ow = W - 68;
    const oTop = Hh - 200, oBot = Hh - 92;
    ctx.fillStyle = INK;
    ctx.fillRect(ox - 7, oTop - 7, ow + 14, oBot - oTop + 14);
    const g = ctx.createLinearGradient(0, oTop, 0, oBot);
    g.addColorStop(0, '#3a2b20');
    g.addColorStop(1, '#5c4430');
    ctx.fillStyle = g;
    ctx.fillRect(ox, oTop, ow, oBot - oTop);
    // as prateleiras de dentro (vidros de conserva, pacotes, garrafada) — sem marca
    const goods = ['#d6402f', '#e8b53b', '#3f9a4a', '#e8e2d0', '#a0522d', '#c97a3a', '#7d3fa8'];
    for (const sy of [oTop + 34, oTop + 72]) {
      ctx.fillStyle = '#8a6a45';
      ctx.fillRect(ox + 6, sy, ow - 12, 5);
      for (let x = ox + 12; x < ox + ow - 20; x += 14 + r() * 8) {
        const gh = 14 + r() * 16;
        ctx.fillStyle = goods[Math.floor(r() * goods.length)];
        ctx.fillRect(x, sy - gh, 9 + r() * 6, gh);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(x + 1.5, sy - gh + 2, 2, gh - 4);
      }
    }
    // o cacho de banana e a réstia de alho pendurados
    ctx.fillStyle = '#e8c23a';
    for (let k = 0; k < 7; k++) {
      ctx.beginPath();
      ctx.ellipse(ox + 40 + (k % 3) * 9, oTop + 10 + Math.floor(k / 3) * 11, 4, 10, -0.5 + (k % 3) * 0.4, 0, M.TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#efe6d2';
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(ox + ow - 40, oTop + 8 + k * 9, 5, 0, M.TAU);
      ctx.fill();
    }
    // o balcão de tábua, com as caixas de fruta em cima
    ctx.fillStyle = INK;
    ctx.fillRect(ox - 12, oBot - 4, ow + 24, 16);
    ctx.fillStyle = '#a57b4c';
    ctx.fillRect(ox - 10, oBot - 2, ow + 20, 12);
    const fruits = [
      ['#f08a24', 5.5], // laranja
      ['#e8c23a', 0], // banana
      ['#c9392b', 4.8], // tomate
      ['#6f8f2f', 5.8], // abacate
      ['#e8b53b', 0], // abacaxi
      ['#f2a65a', 6.5], // mamão
    ];
    const n = Math.max(3, Math.floor(ow / 46));
    for (let k = 0; k < n; k++) {
      const cx = ox + (ow / n) * (k + 0.5);
      const [c, fr] = fruits[k % fruits.length];
      // a caixinha de madeira
      ctx.fillStyle = INK;
      ctx.fillRect(cx - 20, oBot - 22, 40, 22);
      ctx.fillStyle = '#c99a62';
      ctx.fillRect(cx - 18, oBot - 20, 36, 18);
      ctx.fillStyle = 'rgba(60, 36, 14, 0.45)';
      ctx.fillRect(cx - 18, oBot - 12, 36, 2.5);
      if (fr) {
        for (let j = 0; j < 7; j++) {
          ctx.fillStyle = INK;
          const fx = cx - 13 + (j % 4) * 8.5 + (j > 3 ? 4 : 0), fy = oBot - 24 - (j > 3 ? 7 : 0);
          ctx.beginPath();
          ctx.arc(fx, fy, fr + 1.2, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(fx, fy, fr, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.beginPath();
          ctx.arc(fx - fr * 0.35, fy - fr * 0.35, fr * 0.35, 0, M.TAU);
          ctx.fill();
        }
      } else if (k % fruits.length === 1) {
        // as pencas de banana
        for (let j = 0; j < 6; j++) {
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.ellipse(cx - 12 + j * 5, oBot - 26, 4.6, 11, -0.4 + j * 0.15, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.ellipse(cx - 12 + j * 5, oBot - 26, 3.4, 10, -0.4 + j * 0.15, 0, M.TAU);
          ctx.fill();
        }
      } else {
        // o abacaxi, de pé, com a coroa
        for (const dx of [-8, 8]) {
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.ellipse(cx + dx, oBot - 30, 8, 12, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.ellipse(cx + dx, oBot - 30, 6.6, 10.6, 0, 0, M.TAU);
          ctx.fill();
          ctx.strokeStyle = 'rgba(120, 80, 20, 0.6)';
          ctx.lineWidth = 1.4;
          for (let j = -2; j <= 2; j++) {
            ctx.beginPath();
            ctx.moveTo(cx + dx - 6, oBot - 30 + j * 4);
            ctx.lineTo(cx + dx + 6, oBot - 30 + j * 4 - 3);
            ctx.stroke();
          }
          for (let j = 0; j < 5; j++) leaf(ctx, cx + dx + (j - 2) * 2.5, oBot - 46, 7, -Math.PI / 2 + (j - 2) * 0.4, '#4f8f3a');
        }
      }
    }
    // a placa pintada à mão, pregada em cima da janela (por cima do toldo)
    const text = (b.shop.sign || 'QUITANDA').toUpperCase();
    // (abaixo da beirada do telhado, que na tela cobre os 30 cm de cima da parede, e acima do toldo: awning)
    const sy = 34, sh = 34;
    ctx.fillStyle = INK;
    ctx.fillRect(ox - 6, sy - 6, ow + 12, sh + 12);
    ctx.fillStyle = '#efe4c8';
    ctx.fillRect(ox, sy, ow, sh);
    ctx.fillStyle = 'rgba(140, 100, 60, 0.25)';
    for (let k = 0; k < 6; k++) ctx.fillRect(ox + r() * ow, sy + r() * sh, 20 + r() * 30, 3);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, sy, ow, sh);
    ctx.clip();
    let fs = 30;
    ctx.font = `${fs}px ${H.FONT_SIGN}`;
    while (ctx.measureText(text).width > ow - 20 && fs > 12) {
      fs -= 1;
      ctx.font = `${fs}px ${H.FONT_SIGN}`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c0392b';
    ctx.fillText(text, ox + ow / 2 + 1.5, sy + sh / 2 + 2);
    ctx.fillStyle = '#1f4f8f';
    ctx.fillText(text, ox + ow / 2, sy + sh / 2);
    ctx.restore();
    if (r() < 0.8) vineUp(ctx, W - 14, Hh, Hh * 0.7, r);
  }

  // ------------------------------------------------------------------ o telhado de zinco
  const ZINC = ['#a7adb0', '#9ca3a6', '#b3b7b8', '#979ea1'];
  const RUST = '#8a5a36';
  function roofGeom(b, z0) {
    const zt = z0 + b.h;
    const RH = b.roofH || 120;
    const ov = 26, so = 18;
    const ym = (b.y0 + b.y1) / 2;
    const half = (b.y1 - b.y0) / 2;
    const drop = (ov * RH) / half;
    return { zt, RH, ov, so, ym, half, drop, x0: b.x0 - so, x1: b.x1 + so, ze: zt - drop, zr: zt + RH, yF: b.y1 + ov, yB: b.y0 - ov };
  }
  /** Uma água do telhado: as chapas onduladas, as emendas, a ferrugem e as folhas, no plano dela (s ao longo, t descendo). */
  function slope(ctx, cam, g, front, r) {
    const Ls = g.x1 - g.x0;
    const yE = front ? g.yF : g.yB;
    const L = Math.hypot(yE - g.ym, g.zr - g.ze);
    const o = { x: g.x0, y: g.ym, z: g.zr };
    const u = { x: 1, y: 0, z: 0 };
    const v = { x: 0, y: (yE - g.ym) / L, z: -(g.zr - g.ze) / L };
    onPlane(ctx, cam, o, u, v, () => {
      // as chapas (duas fileiras, a de cima por cima da de baixo), cada uma de um tom
      let s = 0;
      while (s < Ls) {
        const w = Math.min(Ls - s, 82 + r() * 14);
        for (const [t0, t1] of [[0, L * 0.52], [L * 0.48, L]]) {
          const roll = r();
          const c = roll < 0.12 ? '#6f8796' : roll < 0.2 ? '#9b4b3a' : ZINC[Math.floor(r() * ZINC.length)];
          ctx.fillStyle = front ? c : M.shade(c, 0.12);
          ctx.fillRect(s, t0, w, t1 - t0);
          // as ondas: uma linha clara e uma escura a cada 8 cm
          for (let q = s + 3; q < s + w; q += 8) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.fillRect(q, t0, 2.2, t1 - t0);
            ctx.fillStyle = 'rgba(40, 44, 48, 0.22)';
            ctx.fillRect(q + 4, t0, 2.2, t1 - t0);
          }
          // a ferrugem: escorrendo dos pregos e mais forte na beirada de baixo
          for (let k = 0; k < 3; k++) {
            const rx = s + 6 + r() * (w - 12);
            const g2 = ctx.createLinearGradient(0, t0, 0, t1);
            g2.addColorStop(0, 'rgba(138, 90, 54, 0.0)');
            g2.addColorStop(0.3, 'rgba(138, 90, 54, 0.55)');
            g2.addColorStop(1, 'rgba(138, 90, 54, 0.1)');
            ctx.fillStyle = g2;
            ctx.fillRect(rx, t0 + 4, 3 + r() * 6, (t1 - t0) * (0.4 + r() * 0.5));
          }
          if (r() < 0.45) {
            ctx.fillStyle = 'rgba(138, 90, 54, 0.55)';
            ctx.beginPath();
            ctx.ellipse(s + r() * w, t0 + r() * (t1 - t0), 12 + r() * 22, 6 + r() * 10, 0, 0, M.TAU);
            ctx.fill();
          }
          // os pregos de cima da chapa
          ctx.fillStyle = 'rgba(40, 30, 24, 0.7)';
          for (let q = s + 10; q < s + w - 4; q += 24) {
            ctx.beginPath();
            ctx.arc(q, t0 + 6, 1.6, 0, M.TAU);
            ctx.fill();
          }
        }
        // a emenda entre duas chapas (a de cima por cima)
        ctx.fillStyle = 'rgba(20, 22, 24, 0.45)';
        ctx.fillRect(s + w - 2, 0, 2, L);
        s += w;
      }
      // a sombra da fileira de cima na de baixo
      ctx.fillStyle = 'rgba(20, 22, 24, 0.35)';
      ctx.fillRect(0, L * 0.52, Ls, 3);
      // o musgo e as folhas da mata caídas por cima
      for (let k = 0; k < Ls / 45; k++) {
        ctx.fillStyle = r() < 0.5 ? 'rgba(86, 118, 52, 0.55)' : 'rgba(110, 130, 58, 0.5)';
        ctx.beginPath();
        ctx.ellipse(r() * Ls, L * (0.75 + r() * 0.25), 10 + r() * 22, 4 + r() * 6, 0, 0, M.TAU);
        ctx.fill();
      }
      for (let k = 0; k < Ls / 18; k++) leaf(ctx, r() * Ls, r() * L, 5 + r() * 4, r() * M.TAU, LEAVES[Math.floor(r() * LEAVES.length)]);
    });
  }
  function roof(ctx, cam, b, z0, ink) {
    const g = roofGeom(b, z0);
    const r = seeded(b.x0, b.y0, 7717);
    const P = (x, y, z) => cam.p({ x, y, z });
    // a água de trás (quase toda escondida pela da frente), a empena do lado (tábuas) e a água da frente
    const back = pathOf([P(g.x0, g.ym, g.zr), P(g.x1, g.ym, g.zr), P(g.x1, g.yB, g.ze), P(g.x0, g.yB, g.ze)]);
    inkFill(ctx, back, '#8f9699', ink, 2.4);
    ctx.save();
    ctx.clip(back);
    slope(ctx, cam, g, false, r);
    ctx.restore();
    // a empena (+x): o triângulo de tábuas em cima da parede do lado
    const D = b.y1 - b.y0;
    H.onWall(ctx, cam, { x: b.x1, y: b.y1, z: g.zt }, { x: 0, y: -1 }, () => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(D / 2, -g.RH);
      ctx.lineTo(D, 0);
      ctx.closePath();
      ctx.clip();
      ctx.translate(0, -g.RH);
      planks(ctx, D, g.RH + 2, M.shade(b.wall, -0.3), r);
      ctx.restore();
      // o furo de ventilação no alto da empena
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(D / 2, -g.RH * 0.45, 9, 0, M.TAU);
      ctx.fill();
    });
    const gab = pathOf([P(b.x1, b.y1, g.zt), P(b.x1, g.ym, g.zr), P(b.x1, b.y0, g.zt)]);
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 1.6;
    ctx.stroke(gab);
    const fr = pathOf([P(g.x0, g.ym, g.zr), P(g.x1, g.ym, g.zr), P(g.x1, g.yF, g.ze), P(g.x0, g.yF, g.ze)]);
    inkFill(ctx, fr, ZINC[0], ink, 2.6);
    ctx.save();
    ctx.clip(fr);
    slope(ctx, cam, g, true, r);
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 2.6;
    ctx.stroke(fr);
    // a beirada da chapa (a grossura que aparece na frente) e a cumeeira dobrada em cima
    inkLine(ctx, [P(g.x0, g.yF, g.ze), P(g.x1, g.yF, g.ze)], '#c9cdcf', 3 * cam.zoom, ink);
    inkLine(ctx, [P(g.x1, g.yF, g.ze), P(g.x1, g.ym, g.zr), P(g.x1, g.yB, g.ze)], '#b9bec0', 3 * cam.zoom, ink);
    const capH = 9;
    const cap = pathOf([P(g.x0, g.ym - 12, g.zr - 6), P(g.x1, g.ym - 12, g.zr - 6), P(g.x1, g.ym, g.zr + capH * 0.4), P(g.x1, g.ym + 12, g.zr - 6), P(g.x0, g.ym + 12, g.zr - 6), P(g.x0, g.ym, g.zr + capH * 0.4)]);
    inkFill(ctx, cap, '#8e9598', ink, 1.8);
    // o que segura as chapas: pedras e um pneu velho em cima (e uma garrafa pet esquecida)
    const along = (f) => g.x0 + 30 + f * (g.x1 - g.x0 - 60);
    const onFront = (x, t) => ({ x, y: g.ym + (g.yF - g.ym) * t, z: g.zr - (g.zr - g.ze) * t });
    for (let k = 0; k < 3; k++) {
      const t = onFront(along(0.15 + k * 0.33 + r() * 0.1), 0.62 + r() * 0.2);
      const q = P(t.x, t.y, t.z);
      const rr = (7 + r() * 5) * cam.zoom;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, rr + ink, rr * 0.75 + ink, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = ['#8f8b83', '#a39d92', '#7c776f'][k % 3];
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, rr, rr * 0.75, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.ellipse(q.x - rr * 0.3, q.y - rr * 0.25, rr * 0.4, rr * 0.25, 0, 0, M.TAU);
      ctx.fill();
    }
    if (r() < 0.6) {
      const t = onFront(along(0.5 + (r() - 0.5) * 0.4), 0.45);
      const q = P(t.x, t.y, t.z);
      const rx = 17 * cam.zoom, ry = 9 * cam.zoom;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, rx + ink, ry + ink, -0.1, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#2b2b2d';
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, rx, ry, -0.1, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#111113';
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, rx * 0.45, ry * 0.45, -0.1, 0, M.TAU);
      ctx.fill();
    }
    // a samambaia que nasceu na calha (a mata tomando tudo)
    const fern = PD.flora && PD.flora.small && PD.flora.small['planta-samambaia'];
    if (fern && r() < 0.55) {
      const t = onFront(along(r() < 0.5 ? 0.02 : 0.98), 0.96);
      fern.paint(ctx, cam, { kind: 'planta-samambaia', x: t.x, y: t.y, r: 26 }, t.z - 4, ink);
    }
  }

  // ------------------------------------------------------------------ barcos
  /** A meia-largura do casco em `u` (-1 na popa, +1 na proa). */
  function halfBeam(tipo, u) {
    const a = Math.abs(u);
    if (tipo === 'voadeira') {
      if (u < 0.55) return u < -0.92 ? 0.92 : 1;
      const k = (u - 0.55) / 0.45;
      return Math.max(0.05, 1 - k * k * 0.95);
    }
    return Math.max(0.02, Math.pow(Math.max(0, 1 - Math.pow(a, 2.4)), 0.55));
  }
  const WATER_Z = -24;
  small.barco = {
    height: (d) => (d.boat === 'veleiro' ? 560 : d.sunk ? 30 : 60),
    blocks: 0,
    shadow: null,
    box: (cam, d, z0) => volBox(cam, d.x0 - 40, d.x1 + 40, d.y0 - 40, d.y1 + 40, z0 + WATER_Z - 20, z0 + (d.boat === 'veleiro' ? 620 : 80), 20),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 4111);
      const P = (x, y, z) => cam.p({ x, y, z });
      const tipo = d.boat || 'canoa';
      const alongX = d.x1 - d.x0 >= d.y1 - d.y0;
      const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
      const L = (alongX ? d.x1 - d.x0 : d.y1 - d.y0) / 2;
      const B = (alongX ? d.y1 - d.y0 : d.x1 - d.x0) / 2;
      const ang = ((d.angle || 0) * Math.PI) / 180;
      // para onde a proa aponta: +x, -x, +y ou -y
      const fwd = alongX ? { x: Math.cos(ang) >= 0 ? 1 : -1, y: 0 } : { x: 0, y: Math.sin(ang) >= 0 ? 1 : -1 };
      const side = { x: -fwd.y, y: fwd.x };
      const wz = z0 + WATER_Z;
      const gh = tipo === 'voadeira' ? 36 : 28;
      const at = (u, w, z) => P(cx + fwd.x * u * L + side.x * w * B, cy + fwd.y * u * L + side.y * w * B, z);
      const N = 28;
      // a curva do barco (a beirada sobe nas pontas): a canoa nas duas, a voadeira só na proa
      const sheer = (u, z) => (z > wz + 4 ? (tipo === 'voadeira' ? Math.max(0, u - 0.4) * 18 : u * u * 12) : 0);
      const outline = (k, z, sink = 0) => {
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const u = -1 + (2 * i) / N;
          pts.push(at(u, halfBeam(tipo, u) * k, z + sink * u + sheer(u, z)));
        }
        for (let i = N; i >= 0; i--) {
          const u = -1 + (2 * i) / N;
          pts.push(at(u, -halfBeam(tipo, u) * k, z + sink * u + sheer(u, z)));
        }
        return pts;
      };
      const ripple = (rx, ry, a) => {
        const c = P(cx, cy, wz);
        ctx.strokeStyle = `rgba(215, 238, 232, ${a})`;
        ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, rx * cam.zoom, ry * cam.zoom, 0, 0, M.TAU);
        ctx.stroke();
      };
      // a sombra do barco na água
      ctx.fillStyle = 'rgba(8, 28, 30, 0.35)';
      ctx.fill(pathOf(outline(1.15, wz - 2)));
      if (tipo === 'veleiro') {
        // o veleiro do clube, afundado: o casco escuro embaixo d'água, só o teto da cabine para fora (com limo) e o
        // mastro torto saindo da água, com a retranca caída, a vela rasgada pendurada e os cabos até a água
        ctx.fillStyle = 'rgba(14, 36, 36, 0.55)';
        ctx.fill(pathOf(outline(0.95, wz - 10)));
        const cab = [at(-0.25, 0.42, wz + 4), at(0.25, 0.42, wz + 6), at(0.25, -0.42, wz + 6), at(-0.25, -0.42, wz + 4)];
        inkFill(ctx, pathOf(cab), '#cfcabd', ink, 2);
        ctx.fillStyle = 'rgba(70, 104, 60, 0.6)';
        for (let k = 0; k < 4; k++) {
          const q = at(-0.2 + rnd() * 0.4, (rnd() - 0.5) * 0.7, wz + 6);
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, (5 + rnd() * 6) * cam.zoom, (2 + rnd() * 2) * cam.zoom, 0, 0, M.TAU);
          ctx.fill();
        }
        const lean = { x: side.x * 0.26 - fwd.x * 0.08, y: side.y * 0.26 - fwd.y * 0.08 };
        const foot = { x: cx + fwd.x * L * 0.1, y: cy + fwd.y * L * 0.1, z: wz };
        const topM = { x: foot.x + lean.x * 500, y: foot.y + lean.y * 500, z: wz + 520 };
        const mp = (k) => P(foot.x + (topM.x - foot.x) * k, foot.y + (topM.y - foot.y) * k, foot.z + (topM.z - foot.z) * k);
        // os cabos (estais) do alto do mastro até a proa e a popa, na água
        ctx.strokeStyle = 'rgba(200, 196, 180, 0.7)';
        ctx.lineWidth = Math.max(1, 1 * cam.zoom);
        for (const u of [1, -1]) {
          const e = at(u * 0.95, 0, wz);
          const t0 = mp(0.95);
          ctx.beginPath();
          ctx.moveTo(t0.x, t0.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
        }
        // a vela rasgada, pendurada no mastro (de 0,25 até 0,9 dele), e a retranca caída na água
        const s0 = mp(0.25), s1 = mp(0.9);
        const boomEnd = P(foot.x - fwd.x * L * 0.8 + lean.x * 60, foot.y - fwd.y * L * 0.8 + lean.y * 60, wz + 8);
        const sail = [s1, s0, P(foot.x - fwd.x * L * 0.55 + lean.x * 90, foot.y - fwd.y * L * 0.55 + lean.y * 90, wz + 110), P(foot.x - fwd.x * L * 0.35 + lean.x * 200, foot.y - fwd.y * L * 0.35 + lean.y * 200, wz + 260)];
        ctx.globalAlpha = 0.85;
        inkFill(ctx, pathOf(sail), '#e6dfcc', ink, 1.6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(30, 50, 50, 0.55)';
        for (let k = 0; k < 3; k++) {
          const a = 0.25 + rnd() * 0.5;
          const q = { x: s0.x + (sail[2].x - s0.x) * a + (s1.x - s0.x) * a * 0.5, y: s0.y + (sail[2].y - s0.y) * a + (s1.y - s0.y) * a * 0.5 };
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, (6 + rnd() * 8) * cam.zoom, (3 + rnd() * 6) * cam.zoom, rnd() * 3, 0, M.TAU);
          ctx.fill();
        }
        inkLine(ctx, [s0, boomEnd], '#8a8478', 5 * cam.zoom, ink * 0.6);
        // o mastro (alumínio) e o topo com a luz quebrada
        inkLine(ctx, [mp(0), mp(1)], '#b9bcbd', 7 * cam.zoom, ink * 0.7);
        const tq = mp(1);
        ctx.fillStyle = '#8a8f90';
        ctx.beginPath();
        ctx.arc(tq.x, tq.y, 4 * cam.zoom, 0, M.TAU);
        ctx.fill();
        ripple(L * 0.5, L * 0.22, 0.3);
        const mq = P(foot.x, foot.y, wz);
        ctx.strokeStyle = 'rgba(215, 238, 232, 0.35)';
        ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
        ctx.beginPath();
        ctx.ellipse(mq.x, mq.y, 22 * cam.zoom, 9 * cam.zoom, 0, 0, M.TAU);
        ctx.stroke();
        return;
      }
      if (d.sunk) {
        // afundado: só a proa e a beirada saindo da água, com limo; o resto é escuro por baixo d'água
        ctx.fillStyle = 'rgba(16, 40, 38, 0.55)';
        ctx.fill(pathOf(outline(0.9, wz - 6)));
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const u = 0.15 + (0.85 * i) / N;
          pts.push(at(u, halfBeam(tipo, u), wz - 4 + (u - 0.15) * 34));
        }
        for (let i = N; i >= 0; i--) {
          const u = 0.15 + (0.85 * i) / N;
          pts.push(at(u, -halfBeam(tipo, u), wz - 4 + (u - 0.15) * 34));
        }
        const hull = pathOf(pts);
        inkFill(ctx, hull, M.shade(d.color || '#6f6a5e', -0.35), ink);
        ctx.fillStyle = 'rgba(70, 104, 60, 0.6)';
        for (let k = 0; k < 5; k++) {
          const q = at(0.3 + rnd() * 0.6, (rnd() - 0.5) * 1.4, wz + 4 + rnd() * 10);
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, (6 + rnd() * 8) * cam.zoom, (3 + rnd() * 3) * cam.zoom, 0, 0, M.TAU);
          ctx.fill();
        }
        ripple(L * 0.9, L * 0.45, 0.35);
        return;
      }
      const color = d.color || (tipo === 'voadeira' ? '#d9d2c3' : '#8a6a45');
      // o casco (por fora): o contorno das duas beiradas, a de baixo (na água) e a de cima
      const lowPts = outline(0.86, wz), topPts = outline(1, wz + gh);
      const all = lowPts.concat(topPts);
      // casco convexo na tela: o mais simples que fica certo para barcos
      const hullPts = convexHull(all);
      inkFill(ctx, pathOf(hullPts), M.shade(color, -0.12), ink, 2.4);
      // (23/11, o dono: "os barcos estão feios" — eram um bloco liso. Agora o costado tem as tábuas, a tinta gasta com a
      // madeira aparecendo, a faixa molhada e escura na linha d'água; por dentro, as cavernas; e a voadeira, o motor)
      ctx.save();
      ctx.clip(pathOf(hullPts));
      const plank = (z, a) => {
        ctx.strokeStyle = `rgba(30, 20, 12, ${a})`;
        ctx.lineWidth = Math.max(1, 1.5 * cam.zoom);
        ctx.beginPath();
        outline(0.93 + ((z - wz) / gh) * 0.07, z).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
      };
      if (tipo === 'voadeira') {
        // a chapa de alumínio: as costuras e os rebites
        plank(wz + gh * 0.45, 0.18);
        ctx.fillStyle = 'rgba(60, 64, 70, 0.35)';
        for (let u = -0.9; u < 0.8; u += 0.12) {
          const q = at(u, halfBeam(tipo, u) * 0.96, wz + gh * 0.45);
          ctx.fillRect(q.x - 1, q.y - 1, 2, 2);
        }
      } else {
        plank(wz + gh * 0.36, 0.28);
        plank(wz + gh * 0.68, 0.28);
        // a tinta descascada: a madeira aparecendo em manchas
        for (let k = 0; k < 6; k++) {
          const q = at(-0.8 + rnd() * 1.6, (rnd() < 0.5 ? 1 : -1) * 0.95, wz + gh * (0.2 + rnd() * 0.6));
          ctx.fillStyle = rnd() < 0.6 ? 'rgba(156, 112, 69, 0.75)' : 'rgba(255, 255, 255, 0.12)';
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, (6 + rnd() * 9) * cam.zoom, (2 + rnd() * 2.5) * cam.zoom, 0, 0, M.TAU);
          ctx.fill();
        }
      }
      // a faixa molhada (escura) e o limo na linha d'água
      ctx.strokeStyle = 'rgba(16, 34, 30, 0.45)';
      ctx.lineWidth = 6 * cam.zoom;
      ctx.beginPath();
      outline(0.9, wz + 3).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(70, 104, 60, 0.4)';
      ctx.lineWidth = 2.5 * cam.zoom;
      ctx.beginPath();
      outline(0.92, wz + 7).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      ctx.restore();
      // a faixa pintada embaixo da beirada (do lado que a câmera vê)
      const stripe = tipo === 'voadeira' ? '#2f6f9f' : rnd() < 0.5 ? '#f2ede0' : '#e2b13c';
      ctx.strokeStyle = stripe;
      ctx.lineWidth = 4 * cam.zoom;
      ctx.beginPath();
      outline(0.97, wz + gh - 9).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.save();
      ctx.clip(pathOf(hullPts));
      ctx.stroke();
      ctx.restore();
      // a abertura de cima: por dentro, o fundo e as tábuas
      const open = pathOf(topPts);
      inkFill(ctx, open, tipo === 'voadeira' ? '#8f979b' : M.shade(color, -0.45), ink, 1.6);
      ctx.save();
      ctx.clip(open);
      ctx.fillStyle = tipo === 'voadeira' ? '#a9b0b3' : '#7a5a3a';
      ctx.fill(pathOf(outline(0.72, wz + 8)));
      if (tipo !== 'voadeira') {
        // as cavernas: as costelas de madeira atravessando o fundo, e as tábuas do fundo
        for (let u = -0.75; u <= 0.76; u += 0.25) {
          const hw = halfBeam(tipo, u) * 0.8;
          inkLine(ctx, [at(u, -hw, wz + gh - 8), at(u, -hw * 0.4, wz + 10), at(u, hw * 0.4, wz + 10), at(u, hw, wz + gh - 8)], '#6a4a2c', 3 * cam.zoom, ink * 0.4);
        }
        ctx.strokeStyle = 'rgba(40, 26, 14, 0.4)';
        ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
        for (const w of [-0.25, 0.25]) {
          ctx.beginPath();
          for (let i = 0; i <= 12; i++) {
            const u = -0.8 + (1.6 * i) / 12;
            const q = at(u, w * halfBeam(tipo, u), wz + 9);
            if (i) ctx.lineTo(q.x, q.y);
            else ctx.moveTo(q.x, q.y);
          }
          ctx.stroke();
        }
      }
      // os bancos atravessados
      for (const u of tipo === 'voadeira' ? [-0.55, 0.05] : [-0.5, 0, 0.5]) {
        const hw = halfBeam(tipo, u);
        inkLine(ctx, [at(u, -hw * 0.98, wz + gh - 6), at(u, hw * 0.98, wz + gh - 6)], tipo === 'voadeira' ? '#c9cfd2' : '#a57b4c', 7 * cam.zoom, ink * 0.6);
      }
      ctx.restore();
      // a beirada (a borda de cima), com a luz
      ctx.strokeStyle = tipo === 'voadeira' ? '#e9edef' : M.shade(color, 0.25);
      ctx.lineWidth = 2.4 * cam.zoom;
      ctx.stroke(open);
      // o remo deitado dentro da canoa, e o motor de rabeta na popa da voadeira
      if (tipo === 'voadeira') {
        // o motor de popa: a rabeta descendo na água, a capota (cinza com a faixa vermelha) e o braço do leme
        const mx = cx - fwd.x * (L + 10), my = cy - fwd.y * (L + 10);
        inkLine(ctx, [P(mx, my, wz + gh - 4), P(mx - fwd.x * 6, my - fwd.y * 6, wz - 16)], '#3a3d40', 6 * cam.zoom, ink * 0.6);
        H.box(ctx, cam, mx - 11, mx + 11, my - 9, my + 9, wz + gh - 6, wz + gh + 14, { front: '#2f3236', side: '#222428', top: '#45484c' }, ink);
        H.box(ctx, cam, mx - 13, mx + 13, my - 11, my + 11, wz + gh + 14, wz + gh + 34, { front: '#d9dcde', side: '#b4b8bb', top: '#eceeef' }, ink);
        const band = [P(mx - 13, my + 11, wz + gh + 20), P(mx + 13, my + 11, wz + gh + 20), P(mx + 13, my - 11, wz + gh + 20)];
        inkLine(ctx, band, '#c03a2a', 3 * cam.zoom, 0);
        inkLine(ctx, [P(mx + fwd.x * 6, my + fwd.y * 6, wz + gh + 18), at(-0.82, 0.2, wz + gh + 10)], '#2b2d30', 3.5 * cam.zoom, ink * 0.5);
      } else {
        inkLine(ctx, [at(-0.7, 0.25, wz + gh - 3), at(0.6, -0.15, wz + gh - 3)], '#c99a62', 4.5 * cam.zoom, ink * 0.6);
        const bl = at(0.62, -0.16, wz + gh - 3);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(bl.x, bl.y, 9 * cam.zoom + ink, 4.5 * cam.zoom + ink, 0.4, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#d3a56c';
        ctx.beginPath();
        ctx.ellipse(bl.x, bl.y, 9 * cam.zoom, 4.5 * cam.zoom, 0.4, 0, M.TAU);
        ctx.fill();
        // um pouco de água de chuva no fundo
        const w0 = at(-0.25, 0, wz + 10);
        ctx.fillStyle = 'rgba(60, 120, 120, 0.45)';
        ctx.beginPath();
        ctx.ellipse(w0.x, w0.y, 16 * cam.zoom, 6 * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
      // a corda amarrada na proa, descendo para a água (presa numa estaca do deque)
      const bow = at(1, 0, wz + gh);
      ctx.strokeStyle = '#c8b38a';
      ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
      ctx.beginPath();
      ctx.moveTo(bow.x, bow.y);
      const end = P(cx + fwd.x * (L + 40), cy + fwd.y * (L + 40), wz + 30);
      ctx.quadraticCurveTo((bow.x + end.x) / 2, Math.max(bow.y, end.y) + 8 * cam.zoom, end.x, end.y);
      ctx.stroke();
      ripple(L * 0.95, L * 0.42, 0.32);
    },
  };
  /** Contorno convexo de pontos da tela. */
  function convexHull(pts) {
    const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const q of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  // ------------------------------------------------------------------ barris
  /** Um cilindro em pé (corpo, sombra do lado e tampa), com contorno. Devolve a elipse de cima. */
  function cylinder(ctx, cam, x, y, z0, R, h, color, ink) {
    const top = cam.p({ x, y, z: z0 + h }), bot = cam.p({ x, y, z: z0 });
    const rx = R * cam.zoom, ry = R * cam.zoom * cam.sinP;
    const body = new Path2D();
    body.ellipse(top.x, top.y, rx, ry, 0, Math.PI, 0, true);
    body.lineTo(bot.x + rx, bot.y);
    body.ellipse(bot.x, bot.y, rx, ry, 0, 0, Math.PI);
    body.closePath();
    const g = ctx.createLinearGradient(top.x - rx, 0, top.x + rx, 0);
    g.addColorStop(0, M.shade(color, 0.22));
    g.addColorStop(0.45, color);
    g.addColorStop(1, M.shade(color, -0.35));
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 2.2;
    ctx.stroke(body);
    ctx.fillStyle = g;
    ctx.fill(body);
    return { top, bot, rx, ry };
  }
  small.barril = {
    height: (d) => (d.h || 90) + 10,
    blocks: 0,
    shadow: (p, cam, d) => H.circleShadow(p, cam, (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, Math.min(d.x1 - d.x0, d.y1 - d.y0) * 0.45, (d.h || 90) * 0.8),
    box: (cam, d, z0) => volBox(cam, d.x0 - 10, d.x1 + 10, d.y0 - 10, d.y1 + 10, z0, z0 + (d.h || 90) + 20, 14),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 5233);
      const x = (d.x0 + d.x1) / 2, y = (d.y0 + d.y1) / 2;
      const R = Math.min(d.x1 - d.x0, d.y1 - d.y0) * 0.46;
      const h = d.h || 90;
      const roll = rnd();
      const kind = roll < 0.5 ? 'bombona' : roll < 0.8 ? 'tambor' : 'madeira';
      const color = kind === 'bombona' ? '#2f6fb3' : kind === 'tambor' ? ['#a8473e', '#4f7f5a', '#6f7478'][Math.floor(rnd() * 3)] : '#9a6a3c';
      const c = cylinder(ctx, cam, x, y, z0, R, h, color, ink);
      // os aros (tambor e madeira) ou as nervuras da bombona
      const rings = kind === 'madeira' ? [0.15, 0.5, 0.85] : kind === 'tambor' ? [0.33, 0.66] : [0.2, 0.4, 0.6, 0.8];
      for (const f of rings) {
        const q = cam.p({ x, y, z: z0 + h * f });
        ctx.strokeStyle = kind === 'madeira' ? '#3a3430' : kind === 'tambor' ? 'rgba(20, 16, 14, 0.5)' : 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = (kind === 'madeira' ? 4 : 2.2) * cam.zoom;
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, c.rx, c.ry, 0, 0.05, Math.PI - 0.05);
        ctx.stroke();
      }
      if (kind === 'madeira') {
        ctx.strokeStyle = 'rgba(40, 24, 10, 0.4)';
        ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
        for (let k = 1; k < 6; k++) {
          const a = Math.PI * (k / 6);
          ctx.beginPath();
          ctx.moveTo(c.bot.x - Math.cos(a) * c.rx, c.bot.y + Math.sin(a) * c.ry);
          ctx.lineTo(c.top.x - Math.cos(a) * c.rx, c.top.y + Math.sin(a) * c.ry);
          ctx.stroke();
        }
      }
      if (kind === 'tambor') {
        // a ferrugem escorrendo
        ctx.fillStyle = 'rgba(126, 70, 36, 0.55)';
        for (let k = 0; k < 4; k++) ctx.fillRect(c.top.x - c.rx * 0.8 + rnd() * c.rx * 1.6, c.top.y + 4 * cam.zoom, (3 + rnd() * 4) * cam.zoom, (h * 0.3 + rnd() * h * 0.5) * cam.zoom * cam.cosP);
      }
      // a tampa
      ctx.fillStyle = kind === 'madeira' ? '#b8834c' : M.shade(color, 0.12);
      ctx.beginPath();
      ctx.ellipse(c.top.x, c.top.y, c.rx, c.ry, 0, 0, M.TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 1.4;
      ctx.stroke();
      if (kind === 'bombona') {
        ctx.fillStyle = '#e9edef';
        ctx.beginPath();
        ctx.ellipse(c.top.x + c.rx * 0.35, c.top.y, c.rx * 0.22, c.ry * 0.22, 0, 0, M.TAU);
        ctx.fill();
        ctx.stroke();
      } else if (rnd() < 0.5) {
        // água de chuva parada em cima, com uma folha boiando
        ctx.fillStyle = 'rgba(70, 120, 120, 0.6)';
        ctx.beginPath();
        ctx.ellipse(c.top.x, c.top.y, c.rx * 0.75, c.ry * 0.75, 0, 0, M.TAU);
        ctx.fill();
        leaf(ctx, c.top.x + c.rx * 0.2, c.top.y, 6 * cam.zoom, 0.8, '#9a8a3e');
      }
    },
  };

  // ------------------------------------------------------------------ o ponto de ônibus da chegada
  small['ponto-onibus'] = {
    height: (d) => (d.h || 260) + 40,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, (d.h || 260) * 0.9),
    box: (cam, d, z0) => volBox(cam, d.x0 - 60, d.x1 + 80, d.y0 - 80, d.y1 + 60, z0, z0 + (d.h || 260) + 120, 20),
    // (23/11, o dono: "melhorar ponto de ônibus" — era uma chapa fina em dois arames. Agora é o abrigo de metal verde da
    // cidade, abandonado: colunas de verdade, o telhado com espessura e a ferrugem escorrendo, o mato e a samambaia em
    // cima, o vidro do fundo com um quebrado, o banco de ripas, o painel do lado com o cartaz velho e o totem da placa)
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 6011);
      const P = (x, y, z) => cam.p({ x, y, z });
      const h = d.h || 260;
      const METAL = { front: '#3f5e4b', side: '#2f4739', top: '#4f705b' };
      // de frente para o leste (a rua): as colunas e o vidro do fundo ficam no oeste (x0)
      const bx = d.x0 + 14, fx = d.x1;
      const ys = [d.y0 + 20, d.y1 - 20];
      // a laje de cimento, com as trincas e o capim na beira
      H.box(ctx, cam, d.x0 - 10, d.x1 + 10, d.y0 - 10, d.y1 + 10, z0, z0 + 8, { front: '#a29c8e', side: '#878174', top: '#b8b2a4' }, ink);
      ctx.strokeStyle = 'rgba(70, 66, 58, 0.55)';
      ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
      for (let k = 0; k < 3; k++) {
        const a = P(d.x0 + rnd() * (d.x1 - d.x0), d.y0 + rnd() * (d.y1 - d.y0), z0 + 8);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + (rnd() - 0.5) * 30 * cam.zoom, a.y + (rnd() - 0.5) * 14 * cam.zoom);
        ctx.lineTo(a.x + (rnd() - 0.5) * 50 * cam.zoom, a.y + (rnd() - 0.5) * 20 * cam.zoom);
        ctx.stroke();
      }
      // o vidro do fundo: dois painéis na moldura verde, um deles quebrado (o buraco e as trincas), sujo embaixo
      H.onWall(ctx, cam, { x: bx, y: d.y1 - 10, z: z0 + 214 }, { x: 0, y: -1 }, () => {
        const L = d.y1 - d.y0 - 20;
        ctx.fillStyle = INK;
        ctx.fillRect(-6, -6, L + 12, 186);
        ctx.fillStyle = METAL.front;
        ctx.fillRect(-3, -3, L + 6, 180);
        const pane = (x0, w, broken) => {
          const g = ctx.createLinearGradient(0, 4, 0, 170);
          g.addColorStop(0, 'rgba(170, 206, 214, 0.55)');
          g.addColorStop(0.7, 'rgba(140, 176, 184, 0.5)');
          g.addColorStop(1, 'rgba(110, 120, 100, 0.65)');
          ctx.fillStyle = g;
          ctx.fillRect(x0, 4, w, 166);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.beginPath();
          ctx.moveTo(x0 + w * 0.15, 4);
          ctx.lineTo(x0 + w * 0.32, 4);
          ctx.lineTo(x0 + w * 0.12, 170);
          ctx.lineTo(x0, 170);
          ctx.closePath();
          ctx.fill();
          if (broken) {
            // o buraco (escuro, com as pontas do vidro) e as trincas em estrela
            const cx = x0 + w * 0.55, cy = 70;
            ctx.fillStyle = 'rgba(30, 40, 38, 0.7)';
            ctx.beginPath();
            for (let k = 0; k < 9; k++) {
              const a = (k / 9) * M.TAU, rr = (k % 2 ? 14 : 30) + rnd() * 10;
              if (k) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
              else ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(240, 250, 250, 0.75)';
            ctx.lineWidth = 1.6;
            for (let k = 0; k < 7; k++) {
              const a = rnd() * M.TAU;
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28);
              ctx.lineTo(cx + Math.cos(a) * (55 + rnd() * 40), cy + Math.sin(a) * (55 + rnd() * 40));
              ctx.stroke();
            }
          }
        };
        pane(4, L / 2 - 8, false);
        pane(L / 2 + 4, L / 2 - 8, true);
        // o adesivo velho e a pichação no vidro inteiro
        ctx.fillStyle = 'rgba(224, 214, 190, 0.8)';
        ctx.fillRect(L * 0.12, 96, L * 0.16, 30);
        ctx.strokeStyle = 'rgba(40, 30, 40, 0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(L * 0.08, 150);
        ctx.bezierCurveTo(L * 0.16, 130, L * 0.22, 160, L * 0.32, 140);
        ctx.stroke();
      });
      // o banco de ripas (verde, como o abrigo), com os pés
      for (const y of [d.y0 + 40, d.y1 - 40]) H.box(ctx, cam, bx + 16, bx + 22, y - 3, y + 3, z0 + 8, z0 + 44, METAL, ink);
      for (const [x0, x1] of [[bx + 8, bx + 20], [bx + 22, bx + 34], [bx + 36, bx + 48]]) H.box(ctx, cam, x0, x1, d.y0 + 28, d.y1 - 28, z0 + 44, z0 + 49, { front: '#5b7c66', side: '#46634f', top: '#6c8f77' }, ink);
      // as colunas (perfil de metal) com a ferrugem no pé
      for (const y of ys) {
        H.box(ctx, cam, bx - 5, bx + 5, y - 5, y + 5, z0 + 8, z0 + h, METAL, ink);
        const r0 = P(bx + 5, y + 5, z0 + 8), r1 = P(bx + 5, y + 5, z0 + 40);
        ctx.strokeStyle = 'rgba(140, 74, 36, 0.7)';
        ctx.lineWidth = 3 * cam.zoom;
        ctx.beginPath();
        ctx.moveTo(r0.x - 2 * cam.zoom, r0.y);
        ctx.lineTo(r1.x - 2 * cam.zoom, r1.y);
        ctx.stroke();
        // a viga que segura o telhado, saindo da coluna para a frente
        inkLine(ctx, [P(bx, y, z0 + h - 8), P(fx + 10, y, z0 + h + 12)], METAL.side, 6 * cam.zoom, ink);
      }
      // o telhado: a chapa com espessura (a beira da frente e a do lado), a ferrugem escorrendo e o mato em cima
      const zb = z0 + h - 4, zf = z0 + h + 18, T = 10;
      const A = { x: bx - 22, y: d.y0 - 10 }, B = { x: fx + 28, y: d.y0 - 10 }, C = { x: fx + 28, y: d.y1 + 10 }, D = { x: bx - 22, y: d.y1 + 10 };
      const edgeE = pathOf([P(B.x, B.y, zf), P(C.x, C.y, zf), P(C.x, C.y, zf - T), P(B.x, B.y, zf - T)]);
      const edgeS = pathOf([P(D.x, D.y, zb), P(C.x, C.y, zf), P(C.x, C.y, zf - T), P(D.x, D.y, zb - T)]);
      inkFill(ctx, edgeE, METAL.front, ink, 2.2);
      inkFill(ctx, edgeS, METAL.side, ink, 2.2);
      const roof = pathOf([P(A.x, A.y, zb), P(B.x, B.y, zf), P(C.x, C.y, zf), P(D.x, D.y, zb)]);
      inkFill(ctx, roof, METAL.top, ink, 2.4);
      ctx.save();
      ctx.clip(edgeE);
      ctx.strokeStyle = 'rgba(140, 74, 36, 0.6)';
      ctx.lineWidth = 2 * cam.zoom;
      for (let k = 0; k < 6; k++) {
        const y = B.y + rnd() * (C.y - B.y);
        const q = P(B.x, y, zf);
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x, q.y + (8 + rnd() * 10) * cam.zoom);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.clip(roof);
      ctx.fillStyle = 'rgba(126, 70, 36, 0.4)';
      for (let k = 0; k < 5; k++) {
        const q = P(bx + rnd() * (fx - bx), d.y0 + rnd() * (d.y1 - d.y0), zb + 8);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, (14 + rnd() * 20) * cam.zoom, (5 + rnd() * 6) * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(86, 118, 52, 0.8)';
      for (let k = 0; k < 10; k++) {
        const q = P(bx + rnd() * (fx - bx), d.y0 + rnd() * (d.y1 - d.y0), zb + 10);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, (10 + rnd() * 16) * cam.zoom, (4 + rnd() * 6) * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
      const fern = PD.flora && PD.flora.small && PD.flora.small['planta-samambaia'];
      if (fern) fern.paint(ctx, cam, { kind: 'planta-samambaia', x: (bx + fx) / 2 - 20, y: (d.y0 + d.y1) / 2, r: 38 }, zb + 12, ink);
      // o painel do lado (a ponta sul): a caixa do cartaz, com o cartaz velho e desbotado da represa
      H.onWall(ctx, cam, { x: bx + 6, y: d.y1 - 6, z: z0 + 214 }, { x: 1, y: 0 }, () => {
        const W = Math.min(120, fx - bx - 20);
        ctx.fillStyle = INK;
        ctx.fillRect(-4, -4, W + 8, 190);
        ctx.fillStyle = METAL.front;
        ctx.fillRect(-1, -1, W + 2, 184);
        const g = ctx.createLinearGradient(0, 10, 0, 175);
        g.addColorStop(0, '#9fc3cf');
        g.addColorStop(0.55, '#d8d2b8');
        g.addColorStop(0.56, '#6f9a7a');
        g.addColorStop(1, '#4f7f63');
        ctx.fillStyle = g;
        ctx.fillRect(8, 10, W - 16, 165);
        ctx.fillStyle = 'rgba(242, 196, 70, 0.85)';
        ctx.beginPath();
        ctx.arc(W * 0.7, 50, 16, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(40, 60, 50, 0.8)';
        ctx.font = `20px ${H.FONT_SIGN}`;
        ctx.textAlign = 'center';
        ctx.fillText('REPRESA', W / 2, 128, W - 24);
        // desbotado e rasgado no canto
        ctx.fillStyle = 'rgba(255, 252, 240, 0.32)';
        ctx.fillRect(8, 10, W - 16, 165);
        ctx.fillStyle = METAL.front;
        ctx.beginPath();
        ctx.moveTo(W - 8, 120);
        ctx.lineTo(W - 8, 175);
        ctx.lineTo(W - 40, 175);
        ctx.closePath();
        ctx.fill();
      });
      // o totem do ponto na beira da calçada (a ponta norte): o poste e a placa com o ônibus (sem marca) e o nome
      const sx = fx + 10, sy = d.y0 - 30;
      inkLine(ctx, [P(sx, sy, z0), P(sx, sy, z0 + 270)], '#6f7a72', 8 * cam.zoom, ink);
      H.onWall(ctx, cam, { x: sx + 2, y: sy + 36, z: z0 + 310 }, { x: 0, y: -1 }, () => {
        ctx.fillStyle = INK;
        ctx.fillRect(-5, -5, 82, 70);
        ctx.fillStyle = '#e9e4d6';
        ctx.fillRect(0, 0, 72, 60);
        ctx.fillStyle = METAL.front;
        ctx.fillRect(0, 0, 72, 8);
        ctx.fillStyle = '#2f5f9f';
        ctx.fillRect(14, 14, 44, 22);
        ctx.fillStyle = '#e9e4d6';
        ctx.fillRect(18, 17, 10, 8);
        ctx.fillRect(31, 17, 10, 8);
        ctx.fillRect(44, 17, 10, 8);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(22, 37, 4, 0, M.TAU);
        ctx.arc(50, 37, 4, 0, M.TAU);
        ctx.fill();
        ctx.font = `11px ${H.FONT_SIGN}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1b100d';
        ctx.fillText((d.sign || 'PONTO').toUpperCase(), 36, 55, 66);
      });
      // o cipó subindo pela coluna de trás e o mato no pé
      const vr = seeded(d.x0, d.y1, 6013);
      const pts = [];
      for (let j = 0; j <= 9; j++) pts.push(P(bx + 6 + Math.sin(j * 1.3) * 4, ys[1] + 6, z0 + (h * 0.9 * j) / 9));
      ctx.strokeStyle = '#3f5a2a';
      ctx.lineWidth = Math.max(1, 2 * cam.zoom);
      ctx.stroke(pathOf(pts, false));
      for (const q of pts) for (let j = 0; j < 2; j++) leaf(ctx, q.x + (vr() - 0.5) * 10 * cam.zoom, q.y + (vr() - 0.5) * 8 * cam.zoom, (6 + vr() * 4) * cam.zoom, vr() * M.TAU, vr() < 0.5 ? '#4f7f34' : '#3f6a2c');
      for (let k = 0; k < 6; k++) {
        const q = P(d.x0 - 8 + rnd() * (d.x1 - d.x0 + 16), rnd() < 0.5 ? d.y0 - 10 : d.y1 + 10, z0);
        for (let j = 0; j < 3; j++) leaf(ctx, q.x + (rnd() - 0.5) * 8 * cam.zoom, q.y - j * 3 * cam.zoom, (5 + rnd() * 4) * cam.zoom, -Math.PI / 2 + (rnd() - 0.5) * 1.2, '#5a8a3c');
      }
    },
  };

  // ------------------------------------------------------------------ o clube náutico (24/11, "vestir o clube")
  // O trampolim da piscina: a base de cimento na beira e a prancha de fibra azul, descascada, avançando por cima da água.
  small.trampolim = {
    height: () => 90,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, 45),
    box: (cam, d, z0) => volBox(cam, d.x0 - 20, d.x1 + 20, d.y0 - 20, d.y1 + 20, z0, z0 + 120, 14),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const west = (d.side || 'oeste') === 'oeste';
      const cy = (d.y0 + d.y1) / 2, w = (d.y1 - d.y0) / 2;
      const bx0 = west ? d.x1 - 70 : d.x0, bx1 = west ? d.x1 : d.x0 + 70;
      H.box(ctx, cam, bx0, bx1, cy - w * 0.95, cy + w * 0.95, z0, z0 + 46, { front: '#b8b2a4', side: '#9a9486', top: '#cfc9ba' }, ink);
      const root = west ? bx1 - 15 : bx0 + 15, tip = west ? d.x0 : d.x1;
      // o suporte de ferro embaixo da prancha
      inkLine(ctx, [P(west ? bx0 : bx1, cy, z0 + 46), P(west ? bx0 - 30 : bx1 + 30, cy, z0 + 54)], '#6f7275', 4 * cam.zoom, ink * 0.5);
      const edge = pathOf([P(root, cy + w, z0 + 50), P(tip, cy + w, z0 + 60), P(tip, cy + w, z0 + 54), P(root, cy + w, z0 + 44)]);
      inkFill(ctx, edge, '#2f5f86', ink, 1.8);
      const plank = pathOf([P(root, cy - w, z0 + 50), P(tip, cy - w, z0 + 60), P(tip, cy + w, z0 + 60), P(root, cy + w, z0 + 50)]);
      inkFill(ctx, plank, '#3f7fb0', ink, 2.2);
      // a fibra descascada (o branco aparecendo) e as listras antiderrapantes
      ctx.save();
      ctx.clip(plank);
      ctx.fillStyle = 'rgba(232, 236, 230, 0.55)';
      const r = seeded(d.x0, d.y0, 9101);
      for (let k = 0; k < 4; k++) {
        const u = 0.2 + r() * 0.7;
        const q = P(root + (tip - root) * u, cy + (r() - 0.5) * w * 1.4, z0 + 50 + 10 * u);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, (8 + r() * 10) * cam.zoom, (3 + r() * 3) * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
    },
  };
  // A escadinha de inox da piscina: os dois corrimãos em arco descendo para dentro da água e os degraus.
  small['escada-piscina'] = {
    height: () => 100,
    blocks: 0,
    shadow: null,
    box: (cam, d, z0) => volBox(cam, d.x - 70, d.x + 70, d.y - 70, d.y + 90, z0 - 60, z0 + 110, 14),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const a = ((d.angle ?? 90) * Math.PI) / 180;
      const f = { x: Math.cos(a), y: Math.sin(a) }, s = { x: -f.y, y: f.x };
      const at = (u, v, z) => P(d.x + f.x * u + s.x * v, d.y + f.y * u + s.y * v, z0 + z);
      // os degraus (dentro da água: só a beirada aparece)
      for (const [u, z] of [[30, -18], [36, -42]]) inkLine(ctx, [at(u, -26, z), at(u, 26, z)], '#9aa3a6', 4 * cam.zoom, ink * 0.4);
      for (const v of [-26, 26]) {
        const rail = [at(-22, v, 0), at(-22, v, 62), at(-12, v, 84), at(6, v, 88), at(20, v, 76), at(26, v, 40), at(30, v, -50)];
        inkLine(ctx, rail, '#d4dcdf', 4.5 * cam.zoom, ink * 0.6);
      }
    },
  };
  // O mastro do clube: o poste com a bola no alto, a corda e a bandeira rasgada e desbotada (azul, com a âncora).
  small.mastro = {
    height: (d) => d.h || 760,
    blocks: 0,
    shadow: (p, cam, d) => H.lineShadow && H.lineShadow(p, cam, d.x, d.y, (d.h || 760) * 0.6, 10),
    box: (cam, d, z0) => volBox(cam, d.x - 30, d.x + 200, d.y - 30, d.y + 30, z0, z0 + (d.h || 760) + 30, 14),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const h = d.h || 760;
      const r = seeded(d.x, d.y, 9203);
      H.box(ctx, cam, d.x - 16, d.x + 16, d.y - 16, d.y + 16, z0, z0 + 22, { front: '#b8b2a4', side: '#9a9486', top: '#cfc9ba' }, ink);
      inkLine(ctx, [P(d.x, d.y, z0 + 22), P(d.x, d.y, z0 + h)], '#c9cdcf', 6 * cam.zoom, ink);
      const top = P(d.x, d.y, z0 + h + 6);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(top.x, top.y, 6 * cam.zoom + ink, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#d8b13c';
      ctx.beginPath();
      ctx.arc(top.x, top.y, 6 * cam.zoom, 0, M.TAU);
      ctx.fill();
      // a corda (a adriça) descendo pelo mastro, solta
      ctx.strokeStyle = 'rgba(220, 214, 196, 0.8)';
      ctx.lineWidth = Math.max(1, 1 * cam.zoom);
      const c0 = P(d.x + 6, d.y, z0 + h - 10), c1 = P(d.x + 14, d.y, z0 + 60);
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      ctx.quadraticCurveTo(c0.x + 8 * cam.zoom, (c0.y + c1.y) / 2, c1.x, c1.y);
      ctx.stroke();
      // a bandeira: um retângulo de 1,5 × 1 m preso no mastro, desbotado e rasgado na ponta que voa
      H.onWall(ctx, cam, { x: d.x + 4, y: d.y, z: z0 + h - 14 }, { x: 1, y: 0 }, () => {
        const W = 150, Hh = 96;
        const flag = new Path2D();
        flag.moveTo(0, 0);
        flag.lineTo(W * 0.78, 8);
        // a ponta rasgada: tiras de tamanhos diferentes
        for (let k = 0; k <= 6; k++) {
          const yy = 8 + (k / 6) * (Hh - 8);
          flag.lineTo(W * (0.62 + r() * 0.38), yy - 4);
          flag.lineTo(W * (0.55 + r() * 0.2), yy);
        }
        flag.lineTo(0, Hh);
        flag.closePath();
        ctx.fillStyle = INK;
        ctx.save();
        ctx.lineWidth = 6;
        ctx.strokeStyle = INK;
        ctx.stroke(flag);
        ctx.restore();
        ctx.fillStyle = d.color || '#3f6fa8';
        ctx.fill(flag);
        ctx.save();
        ctx.clip(flag);
        ctx.fillStyle = '#efe9da';
        ctx.fillRect(0, Hh * 0.36, W, Hh * 0.28);
        // a âncora no meio
        ctx.strokeStyle = '#efe9da';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(40, 14);
        ctx.lineTo(40, 80);
        ctx.moveTo(26, 26);
        ctx.lineTo(54, 26);
        ctx.moveTo(20, 66);
        ctx.quadraticCurveTo(40, 92, 60, 66);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 252, 240, 0.28)';
        ctx.fillRect(0, 0, W, Hh);
        ctx.restore();
      });
    },
  };

  // ------------------------------------------------------------------ as redes de pesca secando
  small.rede = {
    height: (d) => (d.h || 180) + 20,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, (d.h || 180) * 0.6),
    box: (cam, d, z0) => volBox(cam, d.x0 - 20, d.x1 + 20, d.y0 - 20, d.y1 + 20, z0, z0 + (d.h || 180) + 30, 16),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 7001);
      const P = (x, y, z) => cam.p({ x, y, z });
      const h = d.h || 180;
      const alongX = d.x1 - d.x0 >= d.y1 - d.y0;
      const a = alongX ? { x: d.x0, y: (d.y0 + d.y1) / 2 } : { x: (d.x0 + d.x1) / 2, y: d.y0 };
      const b = alongX ? { x: d.x1, y: (d.y0 + d.y1) / 2 } : { x: (d.x0 + d.x1) / 2, y: d.y1 };
      const at = (t, z) => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, z);
      const color = d.color || ['#3f8f7f', '#4f7fa8', '#d9d2c3'][Math.floor(rnd() * 3)];
      // a rede: a linha de cima (com as boias) e a barriga de baixo
      const N = 18;
      const topZ = (t) => z0 + h - 12 - Math.sin(t * Math.PI) * 18;
      const botZ = (t) => z0 + 60 + Math.sin(t * Math.PI) * 10 - Math.sin(t * Math.PI * 2) * 4;
      const mesh = new Path2D();
      const T = [], B = [];
      for (let i = 0; i <= N; i++) {
        T.push(at(i / N, topZ(i / N)));
        B.push(at(i / N, botZ(i / N)));
      }
      ctx.fillStyle = 'rgba(30, 60, 60, 0.12)';
      ctx.fill(pathOf(T.concat(B.slice().reverse())));
      // a malha: as diagonais cruzadas
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, 1.1 * cam.zoom);
      for (let i = 0; i < N; i++) {
        for (const [p0, p1] of [[T[i], B[i + 1]], [B[i], T[i + 1]]]) {
          mesh.moveTo(p0.x, p0.y);
          mesh.lineTo(p1.x, p1.y);
        }
      }
      for (let k = 1; k < 4; k++) {
        const row = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          row.push(at(t, topZ(t) + (botZ(t) - topZ(t)) * (k / 4)));
        }
        row.forEach((q, i) => (i ? mesh.lineTo(q.x, q.y) : mesh.moveTo(q.x, q.y)));
      }
      ctx.stroke(mesh);
      // as estacas das pontas e a corda de cima
      for (const t of [0, 1]) inkLine(ctx, [at(t, z0), at(t, z0 + h)], '#6f5233', 7 * cam.zoom, ink);
      inkLine(ctx, T, '#d8c7a0', 2 * cam.zoom, ink * 0.6);
      // as boias (laranja) e uns peixinhos presos
      for (let i = 2; i < N; i += 3) {
        const q = T[i];
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 5 * cam.zoom + ink, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#f08a24';
        ctx.beginPath();
        ctx.arc(q.x, q.y, 5 * cam.zoom, 0, M.TAU);
        ctx.fill();
      }
      for (let k = 0; k < 3; k++) {
        const t = 0.2 + rnd() * 0.6;
        const q = at(t, (topZ(t) + botZ(t)) / 2 + (rnd() - 0.5) * 30);
        ctx.fillStyle = '#c9cfd2';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, 7 * cam.zoom, 3 * cam.zoom, 0.3, 0, M.TAU);
        ctx.fill();
      }
    },
  };

  // ------------------------------------------------------------------ o lampião de poste de madeira
  small.lampiao = {
    height: (d) => (d.h || 280) + 30,
    blocks: 0,
    shadow: (p, cam, d) => H.circleShadow(p, cam, d.x, d.y, 10, (d.h || 280) * 0.6),
    box: (cam, d, z0) => volBox(cam, d.x - 60, d.x + 60, d.y - 60, d.y + 60, z0, z0 + (d.h || 280) + 40, 16),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const h = d.h || 280;
      // o poste (um caibro), o braço e o lampião pendurado
      inkLine(ctx, [P(d.x, d.y, z0), P(d.x, d.y, z0 + h)], '#6f5233', 9 * cam.zoom, ink);
      const arm = { x: d.x + 38, y: d.y + 0, z: z0 + h - 18 };
      inkLine(ctx, [P(d.x, d.y, z0 + h - 18), P(arm.x, arm.y, arm.z)], '#5a4128', 5 * cam.zoom, ink);
      const top = P(arm.x, arm.y, arm.z - 14);
      ctx.strokeStyle = '#3a3430';
      ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
      ctx.beginPath();
      const ha = P(arm.x, arm.y, arm.z);
      ctx.moveTo(ha.x, ha.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      // a lanterna: o chapéu de lata, o vidro com a chama e a base
      const lw = 11 * cam.zoom, lh = 22 * cam.zoom;
      ctx.fillStyle = INK;
      ctx.fillRect(top.x - lw - ink, top.y - ink, 2 * lw + 2 * ink, lh + 2 * ink);
      const g = ctx.createRadialGradient(top.x, top.y + lh * 0.55, 1, top.x, top.y + lh * 0.55, lw * 1.2);
      g.addColorStop(0, '#fff3c0');
      g.addColorStop(0.6, '#f2b84a');
      g.addColorStop(1, '#b8741e');
      ctx.fillStyle = g;
      ctx.fillRect(top.x - lw, top.y, 2 * lw, lh);
      ctx.fillStyle = '#3a3430';
      ctx.beginPath();
      ctx.moveTo(top.x - lw - 4 * cam.zoom, top.y + 2);
      ctx.lineTo(top.x, top.y - 9 * cam.zoom);
      ctx.lineTo(top.x + lw + 4 * cam.zoom, top.y + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(top.x - lw, top.y + lh - 3 * cam.zoom, 2 * lw, 4 * cam.zoom);
      ctx.strokeStyle = 'rgba(60, 40, 20, 0.6)';
      ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(top.x, top.y + lh);
      ctx.stroke();
    },
  };

  // ------------------------------------------------------------------ o toldo da quitanda
  /** O toldo listrado, alto e curto (o balcão com as frutas aparece embaixo dele, na tela). */
  function awning(ctx, cam, b, z0, ink) {
    const P = (x, y, z) => cam.p({ x, y, z });
    const xa = b.x0 + 24, xb = b.x1 - 24;
    const zTop = z0 + 226, zLow = zTop - 24, out = 70;
    const [c1, c2] = b.shop.awning;
    const n = Math.max(4, Math.round((xb - xa) / 50));
    ctx.lineJoin = 'round';
    for (let k = 0; k < n; k++) {
      const a0 = xa + ((xb - xa) * k) / n, a1 = xa + ((xb - xa) * (k + 1)) / n;
      const top = pathOf([P(a0, b.y1, zTop), P(a1, b.y1, zTop), P(a1, b.y1 + out, zLow), P(a0, b.y1 + out, zLow)]);
      ctx.fillStyle = k % 2 ? c2 : c1;
      ctx.fill(top);
      const p0 = P(a0, b.y1 + out, zLow), p1 = P(a1, b.y1 + out, zLow), p2 = P(a1, b.y1 + out, zLow - 16), p3 = P((a0 + a1) / 2, b.y1 + out, zLow - 24), p4 = P(a0, b.y1 + out, zLow - 16);
      const val = new Path2D();
      val.moveTo(p0.x, p0.y);
      val.lineTo(p1.x, p1.y);
      val.lineTo(p2.x, p2.y);
      val.quadraticCurveTo(p3.x, p3.y, p4.x, p4.y);
      val.closePath();
      ctx.fill(val);
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 0.7;
      ctx.stroke(val);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 2.2;
    ctx.stroke(pathOf([P(xa, b.y1, zTop), P(xb, b.y1, zTop), P(xb, b.y1 + out, zLow), P(xa, b.y1 + out, zLow)]));
    // as duas varetas que seguram o toldo
    for (const x of [xa + 6, xb - 6]) inkLine(ctx, [P(x, b.y1, zTop - 70), P(x, b.y1 + out, zLow)], '#6f7478', 2.4 * cam.zoom, ink * 0.6);
  }

  // ------------------------------------------------------------------ o varal de roupa
  small.varal = {
    height: (d) => (d.h || 190) + 20,
    blocks: 0,
    shadow: (p, cam, d) => H.boxShadow(p, cam, d.x0, d.x1, d.y0, d.y1, (d.h || 190) * 0.6),
    box: (cam, d, z0) => volBox(cam, d.x0 - 20, d.x1 + 20, d.y0 - 20, d.y1 + 20, z0, z0 + (d.h || 190) + 30, 16),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 7103);
      const P = (x, y, z) => cam.p({ x, y, z });
      const h = d.h || 190;
      const alongX = d.x1 - d.x0 >= d.y1 - d.y0;
      const a = alongX ? { x: d.x0, y: (d.y0 + d.y1) / 2 } : { x: (d.x0 + d.x1) / 2, y: d.y0 };
      const b = alongX ? { x: d.x1, y: (d.y0 + d.y1) / 2 } : { x: (d.x0 + d.x1) / 2, y: d.y1 };
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const ropeZ = (t) => z0 + h - 8 - Math.sin(t * Math.PI) * 16;
      const at = (t, z) => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, z);
      for (const t of [0, 1]) inkLine(ctx, [at(t, z0), at(t, z0 + h)], '#6f5233', 6 * cam.zoom, ink);
      const rope = [];
      for (let i = 0; i <= 16; i++) rope.push(at(i / 16, ropeZ(i / 16)));
      inkLine(ctx, rope, '#e6dcc4', 1.6 * cam.zoom, ink * 0.5);
      // as roupas penduradas no plano do varal: camiseta, toalha, bermuda, pano de prato
      const colors = ['#d9533e', '#3d7bbf', '#e8b53b', '#f2ede0', '#7b4a9a', '#4f9f5f', '#e7a7a0'];
      const dir = alongX ? { x: 1, y: 0 } : { x: 0, y: 1 };
      let t = 0.08;
      while (t < 0.9) {
        const kind = rnd();
        const w = kind < 0.35 ? 44 : kind < 0.65 ? 52 : 34;
        const wt = w / L;
        if (t + wt > 0.94) break;
        const zz = ropeZ(t + wt / 2);
        const o = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: zz };
        const c = colors[Math.floor(rnd() * colors.length)];
        H.onWall(ctx, cam, o, dir, () => {
          ctx.fillStyle = INK;
          ctx.beginPath();
          if (kind < 0.35) {
            // camiseta
            ctx.moveTo(-2, -2);
            ctx.lineTo(w + 2, -2);
            ctx.lineTo(w + 2, 16);
            ctx.lineTo(w - 8, 14);
            ctx.lineTo(w - 8, 52);
            ctx.lineTo(8, 52);
            ctx.lineTo(8, 14);
            ctx.lineTo(-2, 16);
          } else if (kind < 0.65) {
            ctx.rect(-2, -2, w + 4, 66);
          } else {
            // bermuda
            ctx.moveTo(-2, -2);
            ctx.lineTo(w + 2, -2);
            ctx.lineTo(w + 4, 40);
            ctx.lineTo(w / 2 + 3, 40);
            ctx.lineTo(w / 2, 18);
            ctx.lineTo(w / 2 - 3, 40);
            ctx.lineTo(-4, 40);
          }
          ctx.closePath();
          ctx.fill();
          ctx.save();
          ctx.clip();
          ctx.fillStyle = c;
          ctx.fillRect(-10, 0, w + 20, 70);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
          for (let k = 0; k < 3; k++) ctx.fillRect(-10, 10 + k * 18, w + 20, 4);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
          ctx.fillRect(w * 0.6, 0, w, 70);
          ctx.restore();
          // os prendedores
          ctx.fillStyle = '#c99a62';
          ctx.fillRect(3, -5, 4, 9);
          ctx.fillRect(w - 7, -5, 4, 9);
        });
        t += wt + 0.03 + rnd() * 0.05;
      }
    },
  };

  // ------------------------------------------------------------------ a banca de frutas da Dona Iracema
  // (19/11: no print, a Dona Iracema parecia freguesa, em pé na frente da vitrine; com a banca na frente, ela fica atrás
  // do balcão e o freguês compra do outro lado)
  const FRUIT = {
    laranja: { color: '#f08a24', R: 4.6 },
    tomate: { color: '#c9392b', R: 4.2 },
    limao: { color: '#7fae3a', R: 3.6 },
    maracuja: { color: '#d9b23a', R: 4.8 },
    abacate: { color: '#5f7f2f', R: 5.2 },
  };
  /** Uma fruta redonda com contorno e brilho; (x, y, z) é onde ela encosta embaixo, em cm do mundo. */
  function fruitBall(ctx, cam, x, y, z, R, color, ink) {
    const q = cam.p({ x, y, z: z + R });
    const r = R * cam.zoom;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r + ink * 0.9, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(q.x - r * 0.35, q.y - r * 0.35, r * 0.35, 0, M.TAU);
    ctx.fill();
  }
  /** O caixote de feira (`w` × `dp` cm, centro em cx, cy) em cima da banca, cheio de `kind`. */
  function crate(ctx, cam, cx, cy, z, w, dp, kind, rnd, ink) {
    const P = (x, y, zz) => cam.p({ x, y, z: zz });
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - dp / 2, y1 = cy + dp / 2;
    const hc = 14;
    H.box(ctx, cam, x0, x1, y0, y1, z, z + hc, { front: '#c99a62', side: '#a87c4a', top: '#4a3626' }, ink);
    // a fresta entre as duas tábuas da frente e do lado
    ctx.strokeStyle = 'rgba(60, 36, 14, 0.55)';
    ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
    const a = P(x0, y1, z + hc * 0.5), b = P(x1, y1, z + hc * 0.5), c = P(x1, y0, z + hc * 0.5);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    const top = z + hc;
    if (kind === 'peixe') {
      // o gelo e os peixes deitados (prateados, com o rabo e o olho)
      const ice = [P(x0 + 3, y0 + 3, top), P(x1 - 3, y0 + 3, top), P(x1 - 3, y1 - 3, top), P(x0 + 3, y1 - 3, top)];
      ctx.fillStyle = '#e4f0f0';
      ctx.beginPath();
      ice.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.fill();
      for (const fx of [0.3, 0.7]) {
        const q = P(x0 + w * fx, cy + (rnd() - 0.5) * dp * 0.3, top + 2);
        const L = 10 * cam.zoom, R = 3.4 * cam.zoom;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(-0.4 + rnd() * 0.3);
        const fish = (pad, body, tail) => {
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.ellipse(0, 0, L + pad, R + pad, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = tail;
          ctx.beginPath();
          ctx.moveTo(-L + 1, 0);
          ctx.lineTo(-L - 5 * cam.zoom - pad, -4 * cam.zoom - pad);
          ctx.lineTo(-L - 5 * cam.zoom - pad, 4 * cam.zoom + pad);
          ctx.closePath();
          ctx.fill();
        };
        fish(ink, INK, INK);
        fish(0, '#a9bcc6', '#8ea3ae');
        ctx.fillStyle = 'rgba(70, 92, 110, 0.55)';
        ctx.fillRect(-L * 0.7, -R * 0.75, L * 1.3, R * 0.5);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(L * 0.6, -R * 0.15, 0.9 * cam.zoom, 0, M.TAU);
        ctx.fill();
        ctx.restore();
      }
      return;
    }
    if (kind === 'cesto' || kind === 'pote') {
      // o cesto de palha trançada ou dois potes de barro
      const many = kind === 'pote' ? [0.3, 0.7] : [0.5];
      for (const fx of many) {
        const q = P(x0 + w * fx, cy, top + (kind === 'pote' ? 7 : 5));
        const rx = (kind === 'pote' ? 6 : 12) * cam.zoom, ry = (kind === 'pote' ? 7.5 : 7) * cam.zoom;
        const body = kind === 'pote' ? '#b8643a' : '#c9a25e';
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, rx + ink, ry + ink, 0, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, rx, ry, 0, 0, M.TAU);
        ctx.fill();
        if (kind === 'cesto') {
          ctx.strokeStyle = 'rgba(110, 76, 30, 0.7)';
          ctx.lineWidth = Math.max(1, 1.1 * cam.zoom);
          for (let j = -2; j <= 2; j++) {
            ctx.beginPath();
            ctx.moveTo(q.x - rx * 0.9, q.y + j * ry * 0.3);
            ctx.lineTo(q.x + rx * 0.9, q.y + j * ry * 0.3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(q.x + j * rx * 0.3, q.y - ry * 0.9);
            ctx.lineTo(q.x + j * rx * 0.3, q.y + ry * 0.9);
            ctx.stroke();
          }
          // a boca do cesto, mais escura
          ctx.fillStyle = '#6e4e24';
          ctx.beginPath();
          ctx.ellipse(q.x, q.y - ry * 0.55, rx * 0.8, ry * 0.3, 0, 0, M.TAU);
          ctx.fill();
        } else {
          // o gargalo e o brilho do barro
          ctx.fillStyle = INK;
          ctx.fillRect(q.x - rx * 0.45 - ink, q.y - ry * 1.35 - ink, rx * 0.9 + 2 * ink, ry * 0.55 + ink);
          ctx.fillStyle = '#a3542e';
          ctx.fillRect(q.x - rx * 0.45, q.y - ry * 1.35, rx * 0.9, ry * 0.55);
          ctx.fillStyle = 'rgba(255, 220, 180, 0.35)';
          ctx.beginPath();
          ctx.ellipse(q.x - rx * 0.35, q.y - ry * 0.2, rx * 0.22, ry * 0.4, 0, 0, M.TAU);
          ctx.fill();
        }
      }
      return;
    }
    if (kind === 'colar') {
      // colares de sementes e miçangas, em arcos
      const colors = ['#d8453a', '#f2b632', '#2f7fd0', '#3f9f5f', '#7a3fb0'];
      for (let j = 0; j < 3; j++) {
        const q = P(x0 + w * (0.25 + j * 0.25), cy, top + 1);
        const R = 6 * cam.zoom;
        for (let b = 0; b < 9; b++) {
          const a = Math.PI * 0.1 + (b / 8) * Math.PI * 0.8;
          const bx = q.x + Math.cos(a) * R, by = q.y + Math.sin(a) * R * 0.6 - R * 0.3;
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.arc(bx, by, 1.8 * cam.zoom + ink * 0.5, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = colors[(j + b) % colors.length];
          ctx.beginPath();
          ctx.arc(bx, by, 1.5 * cam.zoom, 0, M.TAU);
          ctx.fill();
        }
      }
      return;
    }
    if (kind === 'banana') {
      // as pencas deitadas: as bananas lado a lado (meias-luas amarelas com a pontinha escura)
      ctx.lineCap = 'round';
      const R = 8.5 * cam.zoom;
      for (let k = 0; k < 2; k++) {
        const q = P(x0 + w * (0.28 + k * 0.44), cy + (rnd() - 0.5) * dp * 0.2, top + 2);
        for (let j = 0; j < 4; j++) {
          const bx = q.x + (j - 1.5) * 4.6 * cam.zoom, by = q.y + Math.abs(j - 1.5) * 1.2 * cam.zoom + R * 0.5;
          const a0 = -2.3 + (j - 1.5) * 0.14 + k * 0.15, a1 = a0 + 1.2;
          ctx.beginPath();
          ctx.arc(bx, by, R, a0, a1);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4.2 * cam.zoom + ink * 1.6;
          ctx.stroke();
          ctx.strokeStyle = j % 2 ? '#e8c23a' : '#f2d553';
          ctx.lineWidth = 4.2 * cam.zoom;
          ctx.stroke();
          ctx.fillStyle = '#4a3a1e';
          for (const a of [a0, a1]) {
            ctx.beginPath();
            ctx.arc(bx + Math.cos(a) * R, by + Math.sin(a) * R, 1.3 * cam.zoom, 0, M.TAU);
            ctx.fill();
          }
        }
      }
      return;
    }
    if (kind === 'abacaxi') {
      // dois abacaxis em pé, com a coroa
      for (const fx of [0.3, 0.7]) {
        const q = P(x0 + w * fx, cy, top + 7);
        const rx = 5.6 * cam.zoom, ry = 8.5 * cam.zoom;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, rx + ink, ry + ink, 0, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#d8a23a';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, rx, ry, 0, 0, M.TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 80, 20, 0.6)';
        ctx.lineWidth = Math.max(1, 1.1 * cam.zoom);
        for (let j = -2; j <= 2; j++) {
          ctx.beginPath();
          ctx.moveTo(q.x - rx * 0.9, q.y + j * ry * 0.32);
          ctx.lineTo(q.x + rx * 0.9, q.y + j * ry * 0.32 - ry * 0.3);
          ctx.stroke();
        }
        for (let j = 0; j < 5; j++) {
          const ang = -Math.PI / 2 + (j - 2) * 0.42;
          const s = 5.5 * cam.zoom;
          leaf(ctx, q.x + Math.cos(ang) * s, q.y - ry * 0.85 + Math.sin(ang) * s, s, ang, j % 2 ? '#4f8f3a' : '#3f7a30');
        }
      }
      return;
    }
    if (kind === 'mamao') {
      // os mamões deitados, amarelo puxando para o verde
      for (const fx of [0.22, 0.5, 0.78]) {
        const q = P(x0 + w * fx, cy + (rnd() - 0.5) * 4, top + 4);
        const rx = 4.6 * cam.zoom, ry = 8.5 * cam.zoom;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(0.5);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx + ink, ry + ink, 0, 0, M.TAU);
        ctx.fill();
        const g = ctx.createLinearGradient(0, -ry, 0, ry);
        g.addColorStop(0, '#9fb04a');
        g.addColorStop(0.45, '#f2b45a');
        g.addColorStop(1, '#e8963a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(-rx * 0.35, -ry * 0.2, rx * 0.25, ry * 0.45, 0, 0, M.TAU);
        ctx.fill();
        ctx.restore();
      }
      return;
    }
    // as frutas redondas: uma camada que enche o caixote e um montinho no meio
    const F = FRUIT[kind] || FRUIT.laranja;
    const R = F.R;
    const nx = Math.max(2, Math.floor((w - 4) / (R * 2.1)));
    const ny = Math.max(2, Math.floor((dp - 4) / (R * 2.1)));
    const pts = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) pts.push([x0 + 2 + (i + 0.5) * ((w - 4) / nx) + (rnd() - 0.5) * 1.5, y0 + 2 + (j + 0.5) * ((dp - 4) / ny) + (rnd() - 0.5) * 1.5, top - R * 0.6]);
    }
    for (let k = 0; k < Math.max(2, Math.floor(nx * ny * 0.3)); k++) pts.push([cx + (rnd() - 0.5) * w * 0.45, cy + (rnd() - 0.5) * dp * 0.35, top + R * 0.5]);
    pts.sort((p, q) => p[0] + p[1] + p[2] * 0.7 - (q[0] + q[1] + q[2] * 0.7));
    for (const [x, y, zz] of pts) fruitBall(ctx, cam, x, y, zz, R, M.shade(F.color, (rnd() - 0.5) * 0.16), ink);
  }
  /** A balança de feira: a caixa vermelha com o mostrador virado para o freguês e o prato de alumínio em cima. */
  function scale(ctx, cam, cx, cy, z, ink) {
    H.box(ctx, cam, cx - 11, cx + 11, cy - 9, cy + 9, z, z + 18, { front: '#c0392b', side: '#9a2e22', top: '#d9584a' }, ink);
    H.onWall(ctx, cam, { x: cx - 11, y: cy + 9, z: z + 18 }, { x: 1, y: 0 }, () => {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(11, 8, 6.8, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#f4f1e6';
      ctx.beginPath();
      ctx.arc(11, 8, 5.6, 0, M.TAU);
      ctx.fill();
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(11, 8);
      ctx.lineTo(14, 4.5);
      ctx.stroke();
    });
    const P = (x, y, zz) => cam.p({ x, y, z: zz });
    const t = P(cx, cy, z + 25);
    inkLine(ctx, [P(cx, cy, z + 18), t], '#9aa0a3', 2.6 * cam.zoom, ink);
    const rx = 13 * cam.zoom, ry = 13 * cam.zoom * cam.sinP;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, rx + ink, ry + ink, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#c3c9cc';
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, rx, ry, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(t.x - rx * 0.3, t.y - ry * 0.25, rx * 0.35, ry * 0.3, 0, 0, M.TAU);
    ctx.fill();
  }
  /** O pano listrado pregado na beirada do tampo (as cores do toldo), com a barra em ondas. Na parede da frente, em cm. */
  function skirt(ctx, L, colors) {
    const drop = 40;
    const path = new Path2D();
    path.moveTo(0, 0);
    path.lineTo(L, 0);
    path.lineTo(L, drop);
    for (let x = L; x > 0.1; x -= 20) path.quadraticCurveTo(x - 10, drop + 8, Math.max(0, x - 20), drop);
    path.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.stroke(path);
    ctx.save();
    ctx.clip(path);
    for (let x = 0, k = 0; x < L; x += 15, k++) {
      ctx.fillStyle = colors[k % 2];
      ctx.fillRect(x, 0, 15, drop + 10);
    }
    // as dobras, a sombra do tampo em cima e a barra encardida
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let x = 7; x < L; x += 30) ctx.fillRect(x, 0, 6, drop + 10);
    const g = ctx.createLinearGradient(0, 0, 0, 14);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, 14);
    ctx.fillStyle = 'rgba(90, 70, 40, 0.18)';
    ctx.fillRect(0, drop - 8, L, 18);
    ctx.restore();
  }
  /**
   * A banca (`banca-frutas`), em U: a frente para o freguês e os dois lados até a parede da quitanda; quem vende fica no
   * miolo. `front` e `side`: a fundura da frente e a largura dos lados (cm); `cloth`: as cores do pano da frente.
   */
  small['banca-frutas'] = {
    height: (d) => (d.h || 90) + 30,
    blocks: 0,
    shadow: (p, cam, d) => {
      const f = d.front || 50, s = d.side || 30, yb = d.y1 - f, h = (d.h || 90) * 0.8;
      H.boxShadow(p, cam, d.x0, d.x1, yb, d.y1, h);
      H.boxShadow(p, cam, d.x0, d.x0 + s, d.y0, yb, h);
      H.boxShadow(p, cam, d.x1 - s, d.x1, d.y0, yb, h);
    },
    box: (cam, d, z0) => volBox(cam, d.x0 - 20, d.x1 + 20, d.y0 - 20, d.y1 + 20, z0, z0 + (d.h || 90) + 50, 14),
    paint(ctx, cam, d, z0, ink) {
      const rnd = seeded(d.x0, d.y0, 7121);
      const h = d.h || 90, f = d.front || 50, s = d.side || 30;
      const yb = d.y1 - f;
      const zt = z0 + h;
      const WOOD = { front: '#9c7045', side: '#7c5634', top: '#bf9360' };
      const SLAB = { front: '#b98a58', side: '#9a7046', top: '#c89c68' };
      // um pedaço: o corpo de tábuas (as faces que a câmera vê) e o tampo com a beirada para fora (menos do lado da parede)
      const piece = (x0, x1, y0, y1, faceY) => {
        H.box(ctx, cam, x0, x1, y0, y1, z0, zt - 6, WOOD, ink);
        if (faceY) {
          H.onWall(ctx, cam, { x: x0, y: y1, z: zt - 6 }, { x: 1, y: 0 }, () => {
            planks(ctx, x1 - x0, h - 6, '#a57b4c', rnd);
            if (d.cloth) skirt(ctx, x1 - x0, d.cloth);
          });
        }
        H.onWall(ctx, cam, { x: x1, y: y1, z: zt - 6 }, { x: 0, y: -1 }, () => planks(ctx, y1 - y0, h - 6, '#8a6440', rnd));
        H.box(ctx, cam, x0 - 3, x1 + 3, y0 <= d.y0 ? y0 : y0 - 3, y1 + 3, zt - 6, zt, SLAB, ink);
      };
      // (a câmera olha do sudeste: o lado de lá, o de cá e, por último, a frente)
      const back = yb - d.y0;
      // a mercadoria: as frutas da quitanda, o peixe dos pescadores ou o artesanato (cestos, potes de barro e colares)
      const goods = d.goods || 'frutas';
      const G = {
        frutas: { left: ['limao', 'maracuja'], right: 'tomate', front: ['laranja', 'banana', 'abacaxi', 'mamao', 'abacate'], scale: true },
        peixe: { left: ['peixe', 'peixe'], right: 'peixe', front: ['peixe', 'peixe', 'peixe'], scale: true },
        artesanato: { left: ['cesto', 'pote'], right: 'colar', front: ['cesto', 'pote', 'colar', 'pote'], scale: false },
      }[goods] || null;
      const g = G || { left: ['limao', 'maracuja'], right: 'tomate', front: ['laranja', 'banana', 'abacaxi', 'mamao', 'abacate'], scale: true };
      piece(d.x0, d.x0 + s, d.y0, yb, false);
      crate(ctx, cam, d.x0 + s / 2, d.y0 + back * 0.3, zt, s - 6, back * 0.4, g.left[0], rnd, ink);
      crate(ctx, cam, d.x0 + s / 2, d.y0 + back * 0.75, zt, s - 6, back * 0.36, g.left[1], rnd, ink);
      piece(d.x1 - s, d.x1, d.y0, yb, false);
      crate(ctx, cam, d.x1 - s / 2, d.y0 + back * 0.3, zt, s - 6, back * 0.4, g.right, rnd, ink);
      if (g.scale) scale(ctx, cam, d.x1 - s / 2, d.y0 + back * 0.74, zt, ink);
      else crate(ctx, cam, d.x1 - s / 2, d.y0 + back * 0.75, zt, s - 6, back * 0.36, 'cesto', rnd, ink);
      piece(d.x0, d.x1, yb, d.y1, true);
      const kinds = g.front;
      const n = Math.max(2, Math.min(5, Math.floor((d.x1 - d.x0 - 20) / 56)));
      const cw = 46, gap = (d.x1 - d.x0 - n * cw) / (n + 1);
      for (let k = 0; k < n; k++) crate(ctx, cam, d.x0 + gap + cw / 2 + k * (cw + gap), yb + f / 2, zt, cw, Math.min(36, f - 10), kinds[k % kinds.length], rnd, ink);
    },
  };

  PD.refugio = { front, side, roof, windows, roofGeom, awning };
})(window.PD = window.PD || {});
