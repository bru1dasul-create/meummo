// Flora da mata nova (Mapa 01, etapa "mata nova", pedidos do dono via [mundo]): as espécies que não são árvore de
// copa (jerivá, embaúba, xaxim e bananeira), o bambu, as plantas baixas (samambaia, helicônia, taboa e o cogumelo que
// brilha), o arbusto (antes uma fila de bolas) e o que fica rente ao chão (deque e pinguela). Mesmo traço do resto do
// cenário: contorno de tinta, lado da sombra mais escuro, luz do alto à esquerda. Cada planta sai diferente (sorteio
// pela posição) e cada uma tem um "plano" (onde fica cada folha) usado tanto no desenho quanto na caixa justa da imagem
// (o jogo guarda uma imagem de cada planta do mapa: caixa folgada pesa na memória do celular).
// O props.js chama daqui:
//   PD.flora.tree[especie]  = { trunk, trunkBox, crown, crownBox }   (tronco e copa, como as árvores de copa)
//   PD.flora.small[tipo]    = { height, blocks, fades, box, shadow, paint }
//   PD.flora.glows(map)     → luzes que acendem por cima do escuro (cogumelos e véus)
(function (PD) {
  'use strict';
  const M = PD.math;
  const H = PD.props.help;
  const { INK, CANOPY_INK } = H;
  const UP = { x: 0, y: 0, z: 1 };

  // ------------------------------------------------------------------ ajudantes
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const sc = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
  const lerp3 = M.lerp3;
  const seedOf = (x, y, k = 0) => M.rng(Math.round(Math.abs(x * 7 + y * 13) + k * 101 + 3));
  function polyPath(pts) {
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
  /** Linha grossa com contorno de tinta (talo, colmo, cabo). */
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
  function line(ctx, pts, color, w) {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  function dot(ctx, q, r, color, ink) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r + ink, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, M.TAU);
    ctx.fill();
  }
  /** Caixa na tela de uma lista de pontos 3D (cada um com folga `r` cm). */
  function boxOf(cam, pts, pad = 10) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      const q = cam.p(p);
      const r = (p.r || 0) * cam.zoom;
      x0 = Math.min(x0, q.x - r);
      x1 = Math.max(x1, q.x + r);
      y0 = Math.min(y0, q.y - r);
      y1 = Math.max(y1, q.y + r);
    }
    const pd = pad * cam.zoom;
    return { x0: x0 - pd, y0: y0 - pd, x1: x1 + pd, y1: y1 + pd };
  }
  /** Nervura de uma folha comprida em arco: sai de `base` na direção `az`, sobe (`lift`) e cai (`droop`). */
  function ribOf(base, az, len, lift, droop, n = 20) {
    const c = Math.cos(az), s = Math.sin(az);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push({ x: base.x + c * len * u, y: base.y + s * len * u, z: base.z + len * (lift * u - droop * u * u), u });
    }
    return pts;
  }
  /** Pontos da folha para a caixa (a nervura com a folga da largura). */
  const ribBox = (rib, w) => rib.filter((p, i) => i % 4 === 0 || i === rib.length - 1).map((p) => ({ ...p, r: w }));
  /** Perto da câmera = maior (para desenhar as de trás primeiro). */
  const nearness = (az) => Math.cos(az) + Math.sin(az);
  const backFirst = (list) => list.sort((a, b) => nearness(a.az) - nearness(b.az));
  /** Deslocamento do topo do tronco (o mesmo cálculo do desenho do tronco). */
  const leanOf = (t, lean) => Math.sin(2.4 + t.x * 0.01) * lean;

  /** Tronco reto e afinando (tela), com anéis ou fibras; desenha do chão até `top` cm. */
  function trunk(ctx, cam, t, z0, ink, top, r0, r1, colors, opt = {}) {
    const N = 8;
    const lean = opt.lean || 0;
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      const off = Math.sin(u * 2.4 + t.x * 0.01) * lean * u;
      pts.push({ c: cam.p({ x: t.x + off, y: t.y, z: z0 + top * u }), r: (r0 + (r1 - r0) * u) * cam.zoom });
    }
    const left = pts.map((p) => ({ x: p.c.x - p.r, y: p.c.y }));
    const right = pts.map((p) => ({ x: p.c.x + p.r, y: p.c.y })).reverse();
    const shape = polyPath(left.concat(right));
    inkFill(ctx, shape, colors[0], ink, 2.4);
    ctx.save();
    ctx.clip(shape);
    ctx.fillStyle = colors[1];
    ctx.fill(polyPath(pts.map((p) => ({ x: p.c.x + p.r * 0.25, y: p.c.y })).concat(right)));
    if (opt.rings) {
      // anéis (cicatrizes das folhas que caíram)
      ctx.strokeStyle = opt.rings;
      ctx.lineWidth = Math.max(1, 1.5 * cam.zoom);
      for (let z = 16; z < top - 6; z += opt.ringGap || 26) {
        const k = z / top;
        const p = cam.p({ x: t.x + Math.sin(k * 2.4 + t.x * 0.01) * lean * k, y: t.y, z: z0 + z });
        const r = (r0 + (r1 - r0) * k) * cam.zoom;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r * 0.35, 0, 0.15, Math.PI - 0.15);
        ctx.stroke();
      }
    }
    if (opt.fibers) {
      // fibras (raízes aéreas do xaxim): riscos verticais escuros
      ctx.strokeStyle = opt.fibers;
      ctx.lineWidth = Math.max(1, 1.3 * cam.zoom);
      const rnd = seedOf(t.x, t.y, 5);
      for (let k = 0; k < 18; k++) {
        const s = (rnd() - 0.5) * 1.8;
        const za = rnd() * top * 0.85;
        const zb = Math.min(top, za + 20 + rnd() * 45);
        const a = cam.p({ x: t.x + s * r0 * 0.5, y: t.y - s * r0 * 0.5, z: z0 + za });
        const b = cam.p({ x: t.x + s * r0 * 0.5, y: t.y - s * r0 * 0.5, z: z0 + zb });
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x + (rnd() - 0.5) * 3 * cam.zoom, b.y);
        ctx.stroke();
      }
    }
    ctx.restore();
    return pts[N].c;
  }

  /**
   * Folha pinada (palmeira, xaxim, samambaia): nervura em arco e os folíolos dos dois lados, pendendo um pouco
   * (`hang`); a borda recortada (`notch` = fundo do recorte) dá o jeito de pena. A metade do lado da sombra sai mais
   * escura e cada folíolo ganha um risquinho.
   */
  function pinnate(ctx, cam, rib, az, width, col, ink, o = {}) {
    const notch = o.notch ?? 0.5;
    const hang = o.hang ?? 0.4;
    const taper = o.taper ?? 0.35;
    const side = { x: -Math.sin(az), y: Math.cos(az), z: 0 };
    const L = [];
    const R = [];
    const mid = [];
    for (let i = 0; i < rib.length; i++) {
      const p = rib[i];
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + p.u * 0.98)), 0.55) * (1 - taper * p.u);
      const w = width * env * (i % 2 ? notch : 1);
      L.push(cam.p({ x: p.x + side.x * w, y: p.y + side.y * w, z: p.z - hang * w }));
      R.push(cam.p({ x: p.x - side.x * w, y: p.y - side.y * w, z: p.z - hang * w }));
      mid.push(cam.p(p));
    }
    const shape = polyPath(L.concat(R.slice().reverse()));
    inkFill(ctx, shape, col.base, ink, 1.7);
    const litLeft = side.x * cam.light.x + side.y * cam.light.y > 0;
    ctx.save();
    ctx.clip(shape);
    ctx.fillStyle = col.shade;
    ctx.fill(polyPath(mid.concat((litLeft ? R : L).slice().reverse())));
    // risquinho de cada folíolo
    ctx.strokeStyle = col.vein || col.shade;
    ctx.lineWidth = Math.max(0.8, 0.9 * cam.zoom);
    ctx.beginPath();
    for (let i = 2; i < rib.length; i += 2) {
      ctx.moveTo(mid[i].x, mid[i].y);
      ctx.lineTo(L[i].x, L[i].y);
      ctx.moveTo(mid[i].x, mid[i].y);
      ctx.lineTo(R[i].x, R[i].y);
    }
    ctx.stroke();
    ctx.restore();
    line(ctx, mid, col.light, Math.max(1, 1.4 * cam.zoom));
  }

  /**
   * Folha larga em remo (bananeira, helicônia): talo e a lâmina comprida, com a nervura do meio, as nervuras finas
   * de lado e (na bananeira) os rasgos que o vento faz da beirada até a nervura.
   */
  function paddle(ctx, cam, rib, az, width, col, ink, o = {}) {
    const side = { x: -Math.sin(az), y: Math.cos(az), z: 0 };
    const u0 = o.stalk ?? 0.2;
    const L = [];
    const R = [];
    const mid = [];
    for (const p of rib) {
      const b = p.u <= u0 ? 0 : Math.pow(Math.sin((Math.PI * (p.u - u0)) / (1 - u0)), o.round ?? 0.45);
      const w = width * b;
      L.push(cam.p({ x: p.x + side.x * w, y: p.y + side.y * w, z: p.z + 0.12 * w }));
      R.push(cam.p({ x: p.x - side.x * w, y: p.y - side.y * w, z: p.z - 0.12 * w }));
      mid.push(cam.p(p));
    }
    const i0 = Math.max(1, rib.findIndex((p) => p.u > u0) - 1);
    inkLine(ctx, mid.slice(0, i0 + 1), col.stem || col.shade, (o.stalkW || 3.5) * cam.zoom, ink);
    const Lb = L.slice(i0);
    const Rb = R.slice(i0);
    const Mb = mid.slice(i0);
    const blade = polyPath(Lb.concat(Rb.slice().reverse()));
    inkFill(ctx, blade, col.base, ink, 1.9);
    ctx.save();
    ctx.clip(blade);
    ctx.fillStyle = col.shade;
    ctx.fill(polyPath(Mb.concat(Rb.slice().reverse())));
    if (o.veins) {
      // nervuras finas, em diagonal da nervura do meio para a beirada
      ctx.strokeStyle = col.vein || col.light;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = Math.max(0.7, 0.8 * cam.zoom);
      ctx.beginPath();
      for (let i = 1; i < Mb.length - 1; i++) {
        ctx.moveTo(Mb[i].x, Mb[i].y);
        ctx.lineTo(Lb[i + 1].x, Lb[i + 1].y);
        ctx.moveTo(Mb[i].x, Mb[i].y);
        ctx.lineTo(Rb[i + 1].x, Rb[i + 1].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (o.tears && o.rnd) {
      // rasgos: cortes da beirada até perto da nervura, na direção das nervuras (a folha vira tiras)
      ctx.strokeStyle = CANOPY_INK;
      ctx.lineWidth = Math.max(1, 1.5 * cam.zoom);
      ctx.beginPath();
      for (let k = 0; k < o.tears; k++) {
        const i = 2 + Math.floor(o.rnd() * (Mb.length - 4));
        const edge = o.rnd() < 0.5 ? Lb[i + 1] : Rb[i + 1];
        const m = Mb[i];
        ctx.moveTo(edge.x, edge.y);
        ctx.lineTo(edge.x + (m.x - edge.x) * 0.85, edge.y + (m.y - edge.y) * 0.85);
      }
      ctx.stroke();
    }
    ctx.restore();
    line(ctx, Mb, col.light, Math.max(1, 1.8 * cam.zoom));
  }

  // ------------------------------------------------------------------ espécies (tronco + copa)
  const tree = {};

  // Jerivá: palmeira fina de tronco cinza com anéis; coroa de folhas em pena que sobem e caem nas pontas, uma folha
  // seca pendurada e o cacho de coquinhos laranja embaixo da coroa
  const JERIVA = { base: '#4a8a40', shade: '#2e6230', light: '#7ab35c', vein: '#2a5a2c' };
  const JERIVA_DRY = { base: '#8e6c3e', shade: '#6a4e2c', light: '#ad8c5a', vein: '#5a4024' };
  tree.jeriva = {
    plan(t, z0) {
      const rnd = seedOf(t.x, t.y);
      const top = { x: t.x + leanOf(t, 14), y: t.y, z: z0 + t.h * 0.84 };
      const fronds = [];
      const n = 11;
      for (let k = 0; k < n; k++) {
        const young = k < 2;
        const az = (k / n) * M.TAU + rnd() * 0.45;
        const len = t.r * (young ? 0.7 : 1.0 + rnd() * 0.22);
        const lift = young ? 1.5 : 0.85 + rnd() * 0.3;
        const droop = young ? 0.8 : 1.2 + rnd() * 0.35;
        fronds.push({ az, len, rib: ribOf(top, az, len, lift, droop, 30), w: len * 0.17 });
      }
      const dAz = rnd() * M.TAU;
      const dry = { az: dAz, rib: ribOf({ ...top, z: top.z - 12 }, dAz, t.r * 0.32, 0.4, 2.6, 16), w: t.r * 0.1 };
      return { top, fronds, dry, bunchAz: rnd() * M.TAU, rnd };
    },
    trunk(ctx, cam, t, z0, ink) {
      const r = t.trunk || 15;
      const top = t.h * 0.84;
      trunk(ctx, cam, t, z0, ink, top, r, r * 0.85, H.BARK.jeriva, { lean: 14, rings: '#6f675b', ringGap: 22 });
      // a "bota": bases das folhas velhas em volta do alto do tronco
      const rnd = seedOf(t.x, t.y, 3);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * M.TAU + rnd() * 0.5;
        const z = z0 + top - 8 - rnd() * 22;
        const lx = t.x + Math.sin(((z - z0) / top) * 2.4 + t.x * 0.01) * 14 * ((z - z0) / top);
        const b = cam.p({ x: lx + Math.cos(a) * r * 0.6, y: t.y + Math.sin(a) * r * 0.6, z });
        const e = cam.p({ x: lx + Math.cos(a) * r * 1.5, y: t.y + Math.sin(a) * r * 1.5, z: z - 14 });
        inkLine(ctx, [b, e], k % 2 ? '#6a5236' : '#7c6242', 5 * cam.zoom, ink);
      }
    },
    trunkBox: (cam, t, z0) => boxOf(cam, [{ x: t.x, y: t.y, z: z0, r: 30 }, { x: t.x + leanOf(t, 14), y: t.y, z: z0 + t.h * 0.86, r: 40 }]),
    crown(ctx, cam, t, z0, ink) {
      const { top, fronds, dry, bunchAz, rnd } = this.plan(t, z0);
      pinnate(ctx, cam, dry.rib, dry.az, dry.w, JERIVA_DRY, ink, { notch: 0.35, hang: 0.2 });
      const bunchFront = nearness(bunchAz) > 0;
      if (!bunchFront) this._bunch(ctx, cam, top, bunchAz, ink, rnd);
      for (const f of backFirst(fronds)) pinnate(ctx, cam, f.rib, f.az, f.w, JERIVA, ink, { notch: 0.3, hang: 0.55 });
      if (bunchFront) this._bunch(ctx, cam, top, bunchAz, ink, rnd);
    },
    /** Cacho de coquinhos: o cabo sai de baixo da coroa e os frutos pendem num cacho comprido. */
    _bunch(ctx, cam, top, az, ink, rnd) {
      const a = { x: top.x + Math.cos(az) * 12, y: top.y + Math.sin(az) * 12, z: top.z - 14 };
      const b = { x: top.x + Math.cos(az) * 38, y: top.y + Math.sin(az) * 38, z: top.z - 70 };
      inkLine(ctx, [cam.p(a), cam.p({ ...lerp3(a, b, 0.5), z: a.z - 18 }), cam.p(b)], '#a0823c', 2.6 * cam.zoom, ink);
      const fruits = [];
      for (let k = 0; k < 24; k++) {
        const u = 0.3 + 0.7 * rnd();
        const p = lerp3(a, b, u);
        const s = 5 + 11 * u;
        fruits.push({ x: p.x + (rnd() - 0.5) * s * 2, y: p.y + (rnd() - 0.5) * s * 2, z: p.z - u * 10 + (rnd() - 0.5) * 8, c: rnd() });
      }
      fruits.sort((p, q) => cam.depth(p) - cam.depth(q));
      for (const f of fruits) dot(ctx, cam.p(f), 3.8 * cam.zoom, f.c < 0.3 ? '#f4b04a' : f.c < 0.75 ? '#e8892c' : '#c96a22', ink * 0.8);
    },
    crownBox(cam, t, z0) {
      const { top, fronds, dry } = this.plan(t, z0);
      const pts = [{ ...top, r: 30 }, { ...top, z: top.z - 80, r: 60 }];
      for (const f of fronds) pts.push(...ribBox(f.rib, f.w * 1.3));
      pts.push(...ribBox(dry.rib, dry.w * 1.3));
      return boxOf(cam, pts);
    },
  };

  // Xaxim: samambaia em forma de árvore; tronco grosso e fibroso, coroa de folhas rendadas em chafariz, a saia de
  // folhas secas embaixo e os brotos enrolados (báculos) no meio
  const XAXIM = { base: '#69a64e', shade: '#457a36', light: '#9ccd72', vein: '#3c7030' };
  const XAXIM_DRY = { base: '#7a5a34', shade: '#5a4026', light: '#9a7a4c', vein: '#4a3420' };
  tree.xaxim = {
    plan(t, z0) {
      const rnd = seedOf(t.x, t.y);
      const top = { x: t.x + leanOf(t, 4), y: t.y, z: z0 + t.h * 0.82 };
      const fronds = [];
      const n = 13;
      for (let k = 0; k < n; k++) {
        const az = (k / n) * M.TAU + rnd() * 0.4;
        const len = t.r * (1.0 + rnd() * 0.3);
        fronds.push({ az, len, rib: ribOf(top, az, len, 0.8 + rnd() * 0.25, 1.3 + rnd() * 0.3, 30), w: len * 0.2 });
      }
      const skirt = [];
      for (let k = 0; k < 4; k++) {
        const az = (k / 4) * M.TAU + rnd() * 0.8;
        skirt.push({ az, rib: ribOf({ ...top, z: top.z - 10 }, az, t.r * 0.32, 0.3, 2.4, 14), w: t.r * 0.12 });
      }
      const buds = [];
      for (let k = 0; k < 3; k++) {
        const a = rnd() * M.TAU;
        buds.push({ x: top.x + Math.cos(a) * 8, y: top.y + Math.sin(a) * 8, z: top.z + 12 + rnd() * 10 });
      }
      return { top, fronds, skirt, buds };
    },
    trunk(ctx, cam, t, z0, ink) {
      const r = (t.trunk || 15) * 1.35;
      trunk(ctx, cam, t, z0, ink, t.h * 0.82, r * 1.1, r * 0.9, H.BARK.xaxim, { lean: 4, fibers: '#21160e' });
    },
    trunkBox: (cam, t, z0) => boxOf(cam, [{ x: t.x, y: t.y, z: z0, r: 40 }, { x: t.x, y: t.y, z: z0 + t.h * 0.84, r: 40 }]),
    crown(ctx, cam, t, z0, ink) {
      const { fronds, skirt, buds } = this.plan(t, z0);
      for (const f of backFirst(skirt)) pinnate(ctx, cam, f.rib, f.az, f.w, XAXIM_DRY, ink, { notch: 0.45, hang: 0.2 });
      for (const f of backFirst(fronds)) pinnate(ctx, cam, f.rib, f.az, f.w, XAXIM, ink, { notch: 0.62, hang: 0.35, taper: 0.5 });
      // báculos: as folhas novas ainda enroladas
      for (const b of buds) {
        const q = cam.p(b);
        const r = 5 * cam.zoom;
        ctx.lineCap = 'round';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.4 * cam.zoom + ink * 1.6;
        ctx.beginPath();
        ctx.arc(q.x, q.y - r, r, Math.PI * 0.5, Math.PI * 2.3);
        ctx.stroke();
        ctx.strokeStyle = '#a4b46a';
        ctx.lineWidth = 3.4 * cam.zoom;
        ctx.stroke();
      }
    },
    crownBox(cam, t, z0) {
      const { top, fronds, skirt } = this.plan(t, z0);
      const pts = [{ ...top, z: top.z + 30, r: 20 }];
      for (const f of fronds.concat(skirt)) pts.push(...ribBox(f.rib, f.w * 1.2));
      return boxOf(cam, pts);
    },
  };

  // Bananeira: o tronco é verde (folhas enroladas), com bainhas secas descascando; as folhas largas em remo sobem e
  // abrem em leque, rasgadas pelo vento, as velhas amarelando e caindo; o cacho de banana pende com o coração roxo na
  // ponta; filhotes nascendo no pé
  const BANANA = { base: '#5c9c42', shade: '#407a30', light: '#a8d070', stem: '#6f9440', vein: '#84b85a' };
  const BANANA_OLD = { base: '#a08c48', shade: '#7a6a38', light: '#c8b678', stem: '#7f6c38', vein: '#b8a466' };
  tree.bananeira = {
    plan(t, z0) {
      const rnd = seedOf(t.x, t.y);
      const top = { x: t.x + leanOf(t, 5), y: t.y, z: z0 + t.h * 0.6 };
      const n = 7 + Math.floor(rnd() * 2);
      const leaves = [];
      for (let k = 0; k < n; k++) {
        // a primeira é a folha velha: seca, rasgada e pendurada rente ao tronco
        const old = k === 0;
        const az = (k / n) * M.TAU + rnd() * 0.5;
        const len = t.r * (old ? 0.9 : 1.0 + rnd() * 0.3);
        const rib = old ? ribOf({ ...top, z: top.z - 6 }, az, len * 0.4, 0.3, 2.2, 18) : ribOf(top, az, len, 1.25 + rnd() * 0.5, 0.95 + rnd() * 0.3, 18);
        leaves.push({ az, len, old, rib, w: len * (old ? 0.13 : 0.2) });
      }
      const suckers = [];
      const m = 1 + Math.floor(rnd() * 2);
      for (let k = 0; k < m; k++) {
        const a = rnd() * M.TAU;
        const base = { x: t.x + Math.cos(a) * 40, y: t.y + Math.sin(a) * 40, z: z0 };
        const az = a + (rnd() - 0.5) * 0.8;
        suckers.push({ base, az, rib: ribOf({ ...base, z: z0 + 30 }, az, 55, 1.6, 0.9, 12), w: 12 });
      }
      const bunchAz = rnd() * M.TAU;
      return { top, leaves, suckers, bunchAz, rnd };
    },
    trunk(ctx, cam, t, z0, ink) {
      const { suckers } = this.plan(t, z0);
      const back = suckers.filter((s) => s.base.x + s.base.y <= t.x + t.y);
      const drawSucker = (s) => {
        inkLine(ctx, [cam.p(s.base), cam.p({ ...s.base, z: s.base.z + 30 })], '#6f9440', 6 * cam.zoom, ink);
        paddle(ctx, cam, s.rib, s.az, s.w, BANANA, ink, { stalk: 0.1 });
      };
      back.forEach(drawSucker);
      const r = t.trunk || 17;
      const top = t.h * 0.6;
      trunk(ctx, cam, t, z0, ink, top, r * 1.1, r * 0.8, H.BARK.bananeira, { lean: 5 });
      // bainhas secas descascando (tiras marrons) e manchas escuras
      const rnd = seedOf(t.x, t.y, 2);
      for (let k = 0; k < 2; k++) {
        const s = k ? 0.55 : -0.7;
        const z1 = top * (0.35 + rnd() * 0.3);
        const pts = [];
        for (let i = 0; i <= 6; i++) {
          const z = (z1 * i) / 6;
          const off = Math.sin((z / top) * 2.4 + t.x * 0.01) * 5 * (z / top);
          const q = cam.p({ x: t.x + off, y: t.y, z: z0 + z });
          pts.push({ x: q.x + s * r * cam.zoom * (1 + 0.25 * (i / 6)), y: q.y });
        }
        inkLine(ctx, pts, '#8a7444', 4 * cam.zoom, ink * 0.8);
      }
      ctx.fillStyle = 'rgba(40, 50, 20, 0.35)';
      for (let k = 0; k < 4; k++) {
        const q = cam.p({ x: t.x, y: t.y, z: z0 + top * (0.1 + rnd() * 0.8) });
        ctx.beginPath();
        ctx.ellipse(q.x + (rnd() - 0.5) * r * cam.zoom, q.y, 3 * cam.zoom, 6 * cam.zoom, 0, 0, M.TAU);
        ctx.fill();
      }
      suckers.filter((s) => !back.includes(s)).forEach(drawSucker);
    },
    trunkBox(cam, t, z0) {
      const { suckers } = this.plan(t, z0);
      const pts = [{ x: t.x, y: t.y, z: z0, r: 40 }, { x: t.x, y: t.y, z: z0 + t.h * 0.62, r: 40 }];
      for (const s of suckers) pts.push(...ribBox(s.rib, s.w * 1.3), { ...s.base, r: 15 });
      return boxOf(cam, pts);
    },
    crown(ctx, cam, t, z0, ink) {
      const { top, leaves, bunchAz, rnd } = this.plan(t, z0);
      const bunchFront = nearness(bunchAz) > 0;
      if (!bunchFront) this._bunch(ctx, cam, top, bunchAz, ink);
      for (const l of backFirst(leaves)) {
        paddle(ctx, cam, l.rib, l.az, l.w, l.old ? BANANA_OLD : BANANA, ink, { stalk: l.old ? 0.08 : 0.16, veins: true, tears: l.old ? 8 : 3, rnd, stalkW: 4.5 });
      }
      if (bunchFront) this._bunch(ctx, cam, top, bunchAz, ink);
    },
    /** O cacho: o cabo sai do alto e se curva para baixo; pencas de banana (que crescem para cima) e o coração. */
    _bunch(ctx, cam, top, az, ink) {
      const c = Math.cos(az), s = Math.sin(az);
      const a = { x: top.x + c * 8, y: top.y + s * 8, z: top.z + 4 };
      const m = { x: top.x + c * 42, y: top.y + s * 42, z: top.z - 6 };
      const b = { x: top.x + c * 54, y: top.y + s * 54, z: top.z - 78 };
      const P = (u) => {
        const v = 1 - u;
        return { x: a.x * v * v + 2 * m.x * u * v + b.x * u * u, y: a.y * v * v + 2 * m.y * u * v + b.y * u * u, z: a.z * v * v + 2 * m.z * u * v + b.z * u * u };
      };
      const stalk = [];
      for (let i = 0; i <= 10; i++) stalk.push(cam.p(P(i / 10)));
      inkLine(ctx, stalk, '#7a8a3c', 3.6 * cam.zoom, ink);
      // pencas: anéis de bananas ao longo do cabo, cada banana apontando para cima e para fora
      for (let r = 0; r < 5; r++) {
        const u = 0.42 + r * 0.1;
        const p = P(u);
        const fingers = [];
        for (let i = 0; i < 7; i++) {
          const ang = (i / 7) * M.TAU + r * 0.4;
          fingers.push({ ang, base: { x: p.x + Math.cos(ang) * 6, y: p.y + Math.sin(ang) * 6, z: p.z } });
        }
        fingers.sort((f, g) => nearness(f.ang) - nearness(g.ang));
        for (const f of fingers) {
          const tip = { x: f.base.x + Math.cos(f.ang) * 9, y: f.base.y + Math.sin(f.ang) * 9, z: f.base.z + 14 };
          inkLine(ctx, [cam.p(f.base), cam.p(tip)], r % 2 ? '#b6c85a' : '#c8d86a', 4.6 * cam.zoom, ink);
        }
      }
      // o coração roxo na ponta
      const h = cam.p({ ...b, z: b.z - 10 });
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, 6.5 * cam.zoom + ink, 12 * cam.zoom + ink, 0.15, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#6b2c4a';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, 6.5 * cam.zoom, 12 * cam.zoom, 0.15, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#93466c';
      ctx.beginPath();
      ctx.ellipse(h.x - 2 * cam.zoom, h.y - 3 * cam.zoom, 2.4 * cam.zoom, 6 * cam.zoom, 0.15, 0, M.TAU);
      ctx.fill();
    },
    crownBox(cam, t, z0) {
      const { top, leaves, bunchAz } = this.plan(t, z0);
      const pts = [{ ...top, r: 30 }, { x: top.x + Math.cos(bunchAz) * 54, y: top.y + Math.sin(bunchAz) * 54, z: top.z - 95, r: 25 }];
      for (const l of leaves) pts.push(...ribBox(l.rib, l.w * 1.2));
      return boxOf(cam, pts);
    },
  };

  // Embaúba: tronco claro com anéis que sobe até o alto; os galhos saem de lado em candelabro e sobem, e cada ponta
  // abre um guarda-chuva de folhas grandes em mão (palmadas), verde-prateadas em cima e quase brancas embaixo
  const EMB = { top: '#93ad8e', topVein: '#5f7a5c', under: '#dfe7da', underVein: '#a9b8a6', stem: '#b9b29a' };
  /** Folha em mão: lóbulos compridos de ponta redonda no plano da folha (normal `n`). */
  function palmLeaf(ctx, cam, c, n, R, ink, rnd) {
    const tc = cam.toCamera;
    const under = n.x * tc.x + n.y * tc.y + n.z * tc.z < 0;
    const u = M.norm(M.cross(n, Math.abs(n.z) > 0.95 ? { x: 1, y: 0, z: 0 } : UP));
    const v = M.cross(n, u);
    const P = (ang, r) => cam.p(add(c, add(sc(u, Math.cos(ang) * r), sc(v, Math.sin(ang) * r))));
    const lobes = 9;
    const step = M.TAU / lobes;
    const rot = rnd() * M.TAU;
    const path = new Path2D();
    const s0 = P(rot - step / 2, R * 0.3);
    path.moveTo(s0.x, s0.y);
    const tips = [];
    for (let i = 0; i < lobes; i++) {
      const a = rot + i * step;
      const L = R * (0.8 + rnd() * 0.3);
      const c1 = P(a - step * 0.42, L * 1.05);
      const c2 = P(a + step * 0.42, L * 1.05);
      const nt = P(a + step / 2, R * 0.3);
      path.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, nt.x, nt.y);
      tips.push(P(a, L * 0.75));
    }
    path.closePath();
    inkFill(ctx, path, under ? EMB.under : EMB.top, ink, 1.6);
    const q0 = cam.p(c);
    ctx.strokeStyle = under ? EMB.underVein : EMB.topVein;
    ctx.lineWidth = Math.max(0.8, 1 * cam.zoom);
    ctx.beginPath();
    for (const tp of tips) {
      ctx.moveTo(q0.x, q0.y);
      ctx.lineTo(tp.x, tp.y);
    }
    ctx.stroke();
  }
  tree.embauba = {
    plan(t, z0) {
      const rnd = seedOf(t.x, t.y);
      const base = { x: t.x + leanOf(t, 6), y: t.y, z: z0 + t.h * 0.56 };
      const lead = { x: base.x + 6, y: base.y - 6, z: z0 + t.h * 0.95 };
      const n = 3 + Math.floor(rnd() * 2);
      const a0 = rnd() * M.TAU;
      const limbs = [];
      for (let k = 0; k < n; k++) {
        const a = a0 + (k / n) * M.TAU + (rnd() - 0.5) * 0.7;
        const f = 0.05 + (0.5 * k) / n;
        const start = lerp3(base, lead, f);
        const d = t.r * (0.6 + rnd() * 0.3);
        const tip = { x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d, z: start.z + t.h * (0.1 + rnd() * 0.1) };
        limbs.push({ start, tip, a });
      }
      const R0 = Math.max(32, t.r * 0.2);
      const leaves = [];
      for (const ro of limbs.map((l) => l.tip).concat([lead])) {
        const m = 6 + Math.floor(rnd() * 3);
        for (let j = 0; j < m; j++) {
          const a = (j / m) * M.TAU + rnd() * 0.5;
          const R = R0 * (0.85 + rnd() * 0.35);
          const tilt = 0.45 + rnd() * 0.55;
          const c = { x: ro.x + Math.cos(a) * R * 1.05, y: ro.y + Math.sin(a) * R * 1.05, z: ro.z - Math.sin(tilt) * R * 0.6 };
          leaves.push({ c, n: { x: Math.cos(a) * Math.sin(tilt), y: Math.sin(a) * Math.sin(tilt), z: Math.cos(tilt) }, R, stem: ro });
        }
      }
      return { base, lead, limbs, leaves, R0, rnd };
    },
    trunk(ctx, cam, t, z0, ink) {
      const r = t.trunk || 17;
      trunk(ctx, cam, t, z0, ink, t.h * 0.56, r, r * 0.82, H.BARK.embauba, { lean: 6, rings: '#a39c8c', ringGap: 30 });
    },
    trunkBox: (cam, t, z0) => boxOf(cam, [{ x: t.x, y: t.y, z: z0, r: 30 }, { x: t.x + leanOf(t, 6), y: t.y, z: z0 + t.h * 0.58, r: 30 }]),
    crown(ctx, cam, t, z0, ink) {
      const { base, lead, limbs, leaves, rnd } = this.plan(t, z0);
      const w = (t.trunk || 17) * 0.82;
      const polys = [H.limbPoly(cam, base, lead, w, w * 0.45, 0)];
      // candelabro: o galho sai quase de lado e depois sobe (a curva cai no meio)
      for (const l of limbs) polys.push(H.limbPoly(cam, l.start, l.tip, w * 0.6, w * 0.32, -(l.tip.z - l.start.z) * 0.7));
      for (const p of polys) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = ink * 2.2;
        ctx.stroke(polyPath(p));
      }
      for (const p of polys) {
        ctx.fillStyle = H.BARK.embauba[0];
        ctx.fill(polyPath(p));
      }
      leaves.sort((a, b) => cam.depth(a.c) - cam.depth(b.c));
      for (const l of leaves) {
        line(ctx, [cam.p(l.stem), cam.p(l.c)], EMB.stem, Math.max(1, 1.6 * cam.zoom));
        palmLeaf(ctx, cam, l.c, l.n, l.R, ink, rnd);
      }
    },
    crownBox(cam, t, z0) {
      const { base, lead, limbs, R0 } = this.plan(t, z0);
      return boxOf(cam, [{ ...base, r: 30 }, { ...lead, r: R0 * 2.3 }, ...limbs.map((l) => ({ ...l.tip, r: R0 * 2.3 }))]);
    },
  };

  // ------------------------------------------------------------------ plantas e moitas (objetos pequenos)
  const small = {};
  const circleShadowOf = (k) => (path, cam, d, h) => H.circleShadow(path, cam, d.x, d.y, d.r * k, h * 0.5);

  // Arbusto: tufos de folhas de contorno recortado em alturas diferentes (o mesmo traço das copas), com galhinhos no
  // pé. Na mata é mais escuro; o da mata fechada (que segura o jogador) mais ainda
  const BUSH = {
    dense: { base: '#26492d', shade: '#173220', light: '#386a3e', under: '#10251a' },
    wild: { base: '#2f6236', shade: '#1e4426', light: '#468a4a', under: '#163220' },
    town: { base: '#4f8a3c', shade: '#3a6a2e', light: '#77ad55', under: '#2b5223' },
  };
  small.arbusto = {
    height: (d) => (d.r || 60) * 1.15,
    blocks: 0.8,
    shadow: circleShadowOf(0.9),
    plan(d, z0) {
      const rnd = seedOf(d.x, d.y, 7);
      const n = (d.dense ? 5 : 4) + Math.floor(rnd() * 3);
      const tufts = [];
      for (let k = 0; k < n; k++) {
        const a = rnd() * M.TAU;
        const dd = d.r * (k === 0 ? 0.05 : 0.32 + rnd() * 0.3);
        const w = { x: d.x + Math.cos(a) * dd, y: d.y + Math.sin(a) * dd, z: z0 + d.r * (k === 0 ? 0.78 : 0.38 + rnd() * 0.35) };
        const lobes = [];
        const N = 8 + Math.floor(rnd() * 3);
        for (let i = 0; i < N; i++) lobes.push(0.84 + rnd() * 0.28);
        tufts.push({ w, R: d.r * (k === 0 ? 0.52 : 0.38 + rnd() * 0.16), lobes, phase: rnd() * M.TAU });
      }
      return { tufts, rnd };
    },
    box(cam, d, z0) {
      const { tufts } = this.plan(d, z0);
      return boxOf(cam, tufts.map((t) => ({ ...t.w, r: t.R * 1.3 })).concat([{ x: d.x, y: d.y, z: z0, r: d.r * 0.7 }]), 4);
    },
    paint(ctx, cam, d, z0, ink) {
      const { tufts, rnd } = this.plan(d, z0);
      const col = d.wild ? (d.dense ? BUSH.dense : BUSH.wild) : BUSH.town;
      const L = cam.lightScreen;
      // galhinhos no pé
      ctx.strokeStyle = '#3a2a1c';
      ctx.lineWidth = Math.max(1, 2.2 * cam.zoom);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = rnd() * M.TAU;
        const b = cam.p({ x: d.x + Math.cos(a) * d.r * 0.15, y: d.y + Math.sin(a) * d.r * 0.15, z: z0 });
        const e = cam.p({ x: d.x + Math.cos(a) * d.r * 0.5, y: d.y + Math.sin(a) * d.r * 0.5, z: z0 + d.r * 0.45 });
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(e.x, e.y);
      }
      ctx.stroke();
      const list = tufts.map((t) => {
        const q = cam.p(t.w);
        return { x: q.x, y: q.y, R: t.R * cam.zoom, sq: 0.82, lobes: t.lobes, phase: t.phase, depth: cam.depth(t.w) };
      });
      list.sort((a, b) => a.depth - b.depth);
      for (const o of list) {
        const out = H.tuftPath(o);
        ctx.strokeStyle = CANOPY_INK;
        ctx.lineWidth = ink * 2.3;
        ctx.stroke(out);
        ctx.fillStyle = col.under;
        ctx.fill(out);
        ctx.save();
        ctx.clip(out);
        ctx.fillStyle = col.base;
        ctx.fill(H.tuftPath(o, 0.84, L.x * o.R * 0.14, L.y * o.R * 0.14 - o.R * 0.04));
        ctx.fillStyle = col.light;
        ctx.fill(H.tuftPath(o, 0.46, L.x * o.R * 0.34, L.y * o.R * 0.34 - o.R * 0.06));
        // folhinhas soltas no lado da luz
        ctx.fillStyle = M.shade(col.light, 0.18);
        for (let k = 0; k < 5; k++) {
          const a = Math.atan2(L.y, L.x) + (rnd() - 0.5) * 2;
          const r = o.R * (0.15 + rnd() * 0.5);
          ctx.beginPath();
          ctx.ellipse(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r * o.sq, o.R * 0.1, o.R * 0.045, rnd() * Math.PI, 0, M.TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    },
  };

  // Bambu: moita de colmos verdes com nós que sobem e se curvam para fora, com os raminhos de folha fina pendendo do
  // terço de cima (bloqueia a passagem; fica transparente se esconder o personagem)
  const CULM = ['#6f9a3a', '#5f8a30', '#a8cc66'];
  small.bambu = {
    height: (d) => d.h || 700,
    blocks: 0.85,
    fades: true,
    shadow: (path, cam, d, h) => H.lineShadow(path, cam, d.x, d.y, h * 0.8, d.r * 0.9),
    plan(d, z0) {
      const rnd = seedOf(d.x, d.y, 9);
      const h = d.h || 700;
      const culms = [];
      const n = 16 + Math.floor(rnd() * 5);
      for (let k = 0; k < n; k++) {
        const a = rnd() * M.TAU;
        const r0 = Math.sqrt(rnd()) * d.r * 0.5;
        const base = { x: d.x + Math.cos(a) * r0, y: d.y + Math.sin(a) * r0, z: z0 };
        const out = d.r * (0.6 + rnd() * 1.1) * (0.6 + r0 / d.r);
        const hh = h * (0.68 + rnd() * 0.32);
        const top = { x: base.x + Math.cos(a) * out, y: base.y + Math.sin(a) * out, z: z0 + hh * 0.93 };
        const ctrl = { x: base.x + Math.cos(a) * out * 0.08, y: base.y + Math.sin(a) * out * 0.08, z: z0 + hh * 0.86 };
        culms.push({ base, ctrl, top, w: 3.6 + rnd() * 2, a });
      }
      return { culms, rnd };
    },
    box(cam, d, z0) {
      const { culms } = this.plan(d, z0);
      const pts = [];
      for (const c of culms) pts.push({ ...c.base, r: 12 }, { ...c.top, r: 42 }, { ...lerp3(c.base, c.top, 0.6), z: c.base.z + (c.top.z - c.base.z) * 0.55, r: 40 });
      return boxOf(cam, pts, 6);
    },
    paint(ctx, cam, d, z0, ink) {
      const { culms, rnd } = this.plan(d, z0);
      const at = (c, u) => {
        const v = 1 - u;
        return { x: c.base.x * v * v + 2 * c.ctrl.x * u * v + c.top.x * u * u, y: c.base.y * v * v + 2 * c.ctrl.y * u * v + c.top.y * u * u, z: c.base.z * v * v + 2 * c.ctrl.z * u * v + c.top.z * u * u };
      };
      culms.sort((p, q) => cam.depth(p.base) - cam.depth(q.base));
      for (const c of culms) {
        const pts = [];
        for (let i = 0; i <= 10; i++) pts.push(cam.p(at(c, i / 10)));
        inkLine(ctx, pts, CULM[c.w > 4.6 ? 0 : 1], c.w * cam.zoom, ink * 0.9);
        // nós claros
        ctx.strokeStyle = CULM[2];
        ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
        ctx.beginPath();
        for (let u = 0.07; u < 0.97; u += 0.07) {
          const p = cam.p(at(c, u));
          const w = c.w * cam.zoom * 0.95;
          ctx.moveTo(p.x - w, p.y);
          ctx.lineTo(p.x + w, p.y);
        }
        ctx.stroke();
        // raminhos de folha no terço de cima: folhas finas pendendo para fora
        const sx = Math.cos(c.a) - Math.sin(c.a);
        const outA = Math.atan2(0.9, sx >= 0 ? 1 : -1);
        for (let k = 0; k < 7; k++) {
          const u = 0.45 + rnd() * 0.55;
          const q = cam.p(at(c, u));
          const len = (13 + rnd() * 8) * cam.zoom;
          for (let j = 0; j < 5; j++) {
            const ang = outA + (j - 2) * 0.32 + (rnd() - 0.5) * 0.4 + (rnd() < 0.5 ? 0 : Math.PI - 2 * outA);
            const ex = q.x + Math.cos(ang) * len;
            const ey = q.y + Math.sin(ang) * len;
            const mx = (q.x + ex) / 2, my = (q.y + ey) / 2;
            ctx.fillStyle = CANOPY_INK;
            ctx.beginPath();
            ctx.ellipse(mx, my, len * 0.55 + ink * 0.8, len * 0.13 + ink * 0.8, ang, 0, M.TAU);
            ctx.fill();
            ctx.fillStyle = j % 2 ? '#5f8f34' : '#7cae46';
            ctx.beginPath();
            ctx.ellipse(mx, my, len * 0.55, len * 0.13, ang, 0, M.TAU);
            ctx.fill();
          }
        }
      }
    },
  };

  // Samambaia: tufo de folhas rendadas em chafariz
  const FERN = { base: '#4f8f3c', shade: '#356a2b', light: '#7ab45a', vein: '#2f5f27' };
  small['planta-samambaia'] = {
    height: (d) => (d.r || 50) * 1.1,
    blocks: 0,
    shadow: circleShadowOf(0.8),
    plan(d, z0) {
      const rnd = seedOf(d.x, d.y, 11);
      const base = { x: d.x, y: d.y, z: z0 + 4 };
      const fronds = [];
      const n = 10 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const az = (k / n) * M.TAU + rnd() * 0.5;
        const len = d.r * (1.0 + rnd() * 0.4);
        fronds.push({ az, rib: ribOf(base, az, len, 1.35 + rnd() * 0.5, 1.6 + rnd() * 0.5, 16), w: len * 0.18 });
      }
      return { fronds };
    },
    box(cam, d, z0) {
      const { fronds } = this.plan(d, z0);
      const pts = [{ x: d.x, y: d.y, z: z0, r: 10 }];
      for (const f of fronds) pts.push(...ribBox(f.rib, f.w * 1.2));
      return boxOf(cam, pts, 4);
    },
    paint(ctx, cam, d, z0, ink) {
      for (const f of backFirst(this.plan(d, z0).fronds)) pinnate(ctx, cam, f.rib, f.az, f.w, FERN, ink, { notch: 0.45, hang: 0.3 });
    },
  };

  // Helicônia: folhas em remo em pé e as flores em zigue-zague, vermelhas com a ponta amarela
  const HELI = { base: '#3f8a3e', shade: '#2c6a2e', light: '#7ab45a', stem: '#3a6a2e', vein: '#62a052' };
  small['planta-heliconia'] = {
    height: () => 150,
    blocks: 0,
    shadow: circleShadowOf(0.7),
    plan(d, z0) {
      const rnd = seedOf(d.x, d.y, 13);
      const base = { x: d.x, y: d.y, z: z0 };
      const leaves = [];
      const n = 4 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const az = (k / n) * M.TAU + rnd() * 0.6;
        const len = 80 + rnd() * 30;
        leaves.push({ az, rib: ribOf(base, az, len, 2.1 + rnd() * 0.4, 1.0 + rnd() * 0.3, 14), w: 15 });
      }
      const flowers = [];
      const m = 1 + Math.floor(rnd() * 2);
      for (let k = 0; k < m; k++) {
        const az = rnd() * M.TAU;
        flowers.push({ x: d.x + Math.cos(az) * 14, y: d.y + Math.sin(az) * 14, h: 115 + rnd() * 30, az });
      }
      return { leaves, flowers };
    },
    box(cam, d, z0) {
      const { leaves, flowers } = this.plan(d, z0);
      const pts = [{ x: d.x, y: d.y, z: z0, r: 10 }];
      for (const l of leaves) pts.push(...ribBox(l.rib, l.w * 1.2));
      for (const f of flowers) pts.push({ x: f.x, y: f.y, z: z0 + f.h + 8, r: 30 });
      return boxOf(cam, pts, 4);
    },
    paint(ctx, cam, d, z0, ink) {
      const { leaves, flowers } = this.plan(d, z0);
      const drawFlower = (f) => {
        inkLine(ctx, [cam.p({ x: f.x, y: f.y, z: z0 }), cam.p({ x: f.x, y: f.y, z: z0 + f.h })], HELI.stem, 3.2 * cam.zoom, ink);
        // brácteas em zigue-zague descendo do alto (barquinhos vermelhos com a ponta amarela)
        for (let i = 0; i < 7; i++) {
          const side = i % 2 ? 1 : -1;
          const c = cam.p({ x: f.x, y: f.y, z: z0 + f.h - i * 14 });
          const w = (19 - i * 1.1) * cam.zoom;
          const tip = { x: c.x + side * w * 1.5, y: c.y - w * 0.35 };
          const path = new Path2D();
          path.moveTo(c.x, c.y - w * 0.15);
          path.quadraticCurveTo(c.x + side * w * 0.9, c.y - w * 0.15, tip.x, tip.y);
          path.quadraticCurveTo(c.x + side * w * 0.9, c.y + w * 0.75, c.x, c.y + w * 0.55);
          path.closePath();
          inkFill(ctx, path, '#d83e2c', ink, 1.6);
          ctx.fillStyle = '#a82a22';
          ctx.beginPath();
          ctx.ellipse(c.x + side * w * 0.5, c.y + w * 0.3, w * 0.45, w * 0.14, side * -0.3, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#f4cc4c';
          ctx.beginPath();
          ctx.arc(tip.x - side * w * 0.12, tip.y + w * 0.05, w * 0.2, 0, M.TAU);
          ctx.fill();
        }
      };
      const back = flowers.filter((f) => nearness(f.az) < 0);
      back.forEach(drawFlower);
      for (const l of backFirst(leaves)) paddle(ctx, cam, l.rib, l.az, l.w, HELI, ink, { stalk: 0.25, round: 0.6, veins: true });
      flowers.filter((f) => !back.includes(f)).forEach(drawFlower);
    },
  };

  // Taboa: folhas finas e retas na beira da água e as espigas marrons
  small['planta-taboa'] = {
    height: () => 170,
    blocks: 0,
    shadow: circleShadowOf(0.6),
    plan(d, z0) {
      const rnd = seedOf(d.x, d.y, 17);
      const blades = [];
      const n = 13 + Math.floor(rnd() * 6);
      for (let k = 0; k < n; k++) {
        const a = rnd() * M.TAU;
        const r = Math.sqrt(rnd()) * d.r * 0.6;
        const b = { x: d.x + Math.cos(a) * r, y: d.y + Math.sin(a) * r, z: z0 };
        const lean = 12 + rnd() * 28;
        const tp = { x: b.x + Math.cos(a) * lean, y: b.y + Math.sin(a) * lean, z: z0 + 115 + rnd() * 60 };
        blades.push({ b, tp, spike: k < 3, bend: (rnd() - 0.5) * 8 });
      }
      return { blades };
    },
    box(cam, d, z0) {
      const { blades } = this.plan(d, z0);
      return boxOf(cam, blades.flatMap((bl) => [{ ...bl.b, r: 8 }, { ...bl.tp, r: 14 }]), 4);
    },
    paint(ctx, cam, d, z0, ink) {
      const { blades } = this.plan(d, z0);
      blades.sort((p, q) => cam.depth(p.b) - cam.depth(q.b));
      for (const bl of blades) {
        const b = cam.p(bl.b);
        const t = cam.p(bl.tp);
        const m = { x: (b.x + t.x) / 2 + bl.bend * cam.zoom, y: (b.y + t.y) / 2 };
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.quadraticCurveTo(m.x, m.y, t.x, t.y);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.6 * cam.zoom + ink * 1.4;
        ctx.stroke();
        ctx.strokeStyle = bl.spike ? '#7a8a4a' : '#86ad55';
        ctx.lineWidth = 3.6 * cam.zoom;
        ctx.stroke();
        if (bl.spike) {
          // a espiga marrom perto da ponta
          const sx = b.x + (t.x - b.x) * 0.76, sy = b.y + (t.y - b.y) * 0.76;
          const ang = Math.atan2(t.y - b.y, t.x - b.x);
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.ellipse(sx, sy, 12 * cam.zoom + ink, 4.8 * cam.zoom + ink, ang, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#6b4626';
          ctx.beginPath();
          ctx.ellipse(sx, sy, 12 * cam.zoom, 4.8 * cam.zoom, ang, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#8a5e36';
          ctx.beginPath();
          ctx.ellipse(sx - 2 * cam.zoom, sy - 1.5 * cam.zoom, 6 * cam.zoom, 1.6 * cam.zoom, ang, 0, M.TAU);
          ctx.fill();
        }
      }
    },
  };

  // Cogumelo que brilha: pés claros e chapéus acesos (verde-água por padrão; o brilho por cima do escuro sai em glows)
  small['planta-cogumelo'] = {
    height: () => 30,
    blocks: 0,
    shadow: null,
    plan(d, z0) {
      const rnd = seedOf(d.x, d.y, 19);
      const caps = [];
      const n = 4 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const a = rnd() * M.TAU;
        const r = Math.sqrt(rnd()) * d.r * 0.75;
        const h = 8 + rnd() * 18;
        caps.push({ x: d.x + Math.cos(a) * r, y: d.y + Math.sin(a) * r, z: z0, h, s: 5 + h * 0.42 + rnd() * 2.5, tilt: (rnd() - 0.5) * 0.4 });
      }
      return { caps, rnd };
    },
    box(cam, d, z0) {
      return boxOf(cam, this.plan(d, z0).caps.flatMap((c) => [{ ...c, r: c.s + 4 }, { ...c, z: c.z + c.h, r: c.s + 4 }]), 4);
    },
    paint(ctx, cam, d, z0, ink) {
      const { caps, rnd } = this.plan(d, z0);
      const glow = d.glow || '#3fd6c8';
      caps.sort((p, q) => cam.depth(p) - cam.depth(q));
      for (const c of caps) {
        const b = cam.p(c);
        const t = cam.p({ ...c, z: c.z + c.h });
        inkLine(ctx, [b, t], '#e9e4d0', 3 * cam.zoom, ink * 0.8);
        const w = c.s * cam.zoom;
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(c.tilt);
        // chapéu: meia elipse com a borda de baixo (as lamelas escuras)
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(0, 0, w + ink, w * 0.62 + ink, 0, Math.PI, 0);
        ctx.ellipse(0, 0, w + ink, w * 0.2 + ink, 0, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = M.shade(glow, -0.45);
        ctx.beginPath();
        ctx.ellipse(0, 0, w, w * 0.2, 0, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(0, 0, w, w * 0.62, 0, Math.PI, 0);
        ctx.fill();
        // pintas e o reflexo de cima
        ctx.fillStyle = M.shade(glow, 0.55);
        ctx.beginPath();
        ctx.ellipse(-w * 0.3, -w * 0.34, w * 0.26, w * 0.12, 0, 0, M.TAU);
        ctx.fill();
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.arc((rnd() - 0.5) * w * 1.1, -w * (0.12 + rnd() * 0.3), w * 0.08, 0, M.TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    },
  };

  // ------------------------------------------------------------------ rentes ao chão: deque e pinguela
  // O chão do mapa novo não tem altura: o tampo fica rente ao chão e a estrutura desce para dentro da água, então o
  // herói anda por cima sem afundar.
  small.deque = {
    height: () => 10,
    blocks: 0,
    shadow: null,
    box: (cam, d, z0) => boxOf(cam, [{ x: d.x0, y: d.y0, z: z0 + 6 }, { x: d.x1, y: d.y1, z: z0 - 60 }, { x: d.x0, y: d.y1, z: z0 - 60 }, { x: d.x1, y: d.y0, z: z0 - 60 }], 16),
    paint(ctx, cam, d, z0, ink) {
      const P = (x, y, z) => cam.p({ x, y, z });
      const zt = z0 + 4;
      const zb = z0 - 10;
      const along = d.x1 - d.x0 >= d.y1 - d.y0 ? 'x' : 'y';
      // vão escuro embaixo do tampo (a sombra do deque na água)
      ctx.fillStyle = 'rgba(10, 30, 32, 0.45)';
      ctx.fill(polyPath([P(d.x0, d.y1, zb), P(d.x1, d.y1, zb), P(d.x1, d.y0, zb), P(d.x1 + 10, d.y0 + 25, zb - 30), P(d.x1 + 10, d.y1 + 25, zb - 30), P(d.x0 + 10, d.y1 + 25, zb - 30)]));
      // estacas da frente entrando na água, com a roda d'água em volta
      const posts = along === 'x'
        ? [[d.x0 + 18, d.y1 - 6], [(d.x0 + d.x1) / 2, d.y1 - 6], [d.x1 - 18, d.y1 - 6], [d.x1 - 6, d.y0 + 18]]
        : [[d.x1 - 6, d.y0 + 18], [d.x1 - 6, (d.y0 + d.y1) / 2], [d.x1 - 6, d.y1 - 18], [d.x0 + 18, d.y1 - 6]];
      for (const [x, y] of posts) {
        inkLine(ctx, [P(x, y, zb), P(x, y, zb - 34)], '#4e3822', 9 * cam.zoom, ink);
        const w = P(x, y, zb - 34);
        ctx.strokeStyle = 'rgba(210, 236, 232, 0.55)';
        ctx.lineWidth = Math.max(1, 1.3 * cam.zoom);
        ctx.beginPath();
        ctx.ellipse(w.x, w.y, 10 * cam.zoom, 4 * cam.zoom, 0, 0, M.TAU);
        ctx.stroke();
      }
      // a borda da frente (sul e leste) e o tampo de tábuas
      const front = polyPath([P(d.x0, d.y1, zt), P(d.x1, d.y1, zt), P(d.x1, d.y1, zb), P(d.x0, d.y1, zb)]);
      const side = polyPath([P(d.x1, d.y1, zt), P(d.x1, d.y0, zt), P(d.x1, d.y0, zb), P(d.x1, d.y1, zb)]);
      inkFill(ctx, front, '#6f5233', ink);
      inkFill(ctx, side, '#5a4128', ink);
      const top = polyPath([P(d.x0, d.y0, zt), P(d.x1, d.y0, zt), P(d.x1, d.y1, zt), P(d.x0, d.y1, zt)]);
      inkFill(ctx, top, '#9a7a52', ink);
      ctx.save();
      ctx.clip(top);
      const rnd = seedOf(d.x0, d.y0, 23);
      // tábuas atravessadas (uma de cada tom) e as frestas
      const gap = 22;
      if (along === 'x') {
        for (let x = d.x0, i = 0; x < d.x1; x += gap, i++) {
          ctx.fillStyle = ['#9a7a52', '#8d6f49', '#a5855c'][i % 3];
          ctx.fill(polyPath([P(x, d.y0, zt), P(x + gap, d.y0, zt), P(x + gap, d.y1, zt), P(x, d.y1, zt)]));
          line(ctx, [P(x, d.y0, zt), P(x, d.y1, zt)], '#5e4630', Math.max(1, 1.8 * cam.zoom));
        }
      } else {
        for (let y = d.y0, i = 0; y < d.y1; y += gap, i++) {
          ctx.fillStyle = ['#9a7a52', '#8d6f49', '#a5855c'][i % 3];
          ctx.fill(polyPath([P(d.x0, y, zt), P(d.x1, y, zt), P(d.x1, y + gap, zt), P(d.x0, y + gap, zt)]));
          line(ctx, [P(d.x0, y, zt), P(d.x1, y, zt)], '#5e4630', Math.max(1, 1.8 * cam.zoom));
        }
      }
      // manchas de tábua velha
      ctx.fillStyle = 'rgba(60, 42, 26, 0.35)';
      for (let k = 0; k < 7; k++) {
        const q = P(d.x0 + rnd() * (d.x1 - d.x0), d.y0 + rnd() * (d.y1 - d.y0), zt);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, 9 * cam.zoom, 3.5 * cam.zoom, 0.5, 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
    },
  };
  small.pinguela = {
    height: () => 10,
    blocks: 0,
    shadow: null,
    box: (cam, d, z0) => boxOf(cam, [{ x: d.x0 - 10, y: d.y0 - 10, z: z0 + 10, r: 30 }, { x: d.x1 + 10, y: d.y1 + 10, z: z0 - 40, r: 30 }, { x: d.x0 - 10, y: d.y1 + 10, z: z0 - 40, r: 30 }, { x: d.x1 + 10, y: d.y0 - 10, z: z0 + 10, r: 30 }], 10),
    paint(ctx, cam, d, z0, ink) {
      // tronco deitado de margem a margem (cilindro): a parte de baixo dentro da água e o topo rente ao chão
      const along = d.x1 - d.x0 >= d.y1 - d.y0 ? 'x' : 'y';
      const r = Math.max(16, Math.min(28, (along === 'x' ? d.y1 - d.y0 : d.x1 - d.x0) * 0.4));
      const zc = z0 + 4 - r * 0.8;
      const A = along === 'x' ? { x: d.x0 - 10, y: (d.y0 + d.y1) / 2, z: zc } : { x: (d.x0 + d.x1) / 2, y: d.y0 - 10, z: zc };
      const B = along === 'x' ? { x: d.x1 + 10, y: (d.y0 + d.y1) / 2, z: zc } : { x: (d.x0 + d.x1) / 2, y: d.y1 + 10, z: zc };
      const a = cam.p(A), b = cam.p(B);
      let nx = -(b.y - a.y), ny = b.x - a.x;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      if (ny > 0) { nx = -nx; ny = -ny; } // n aponta para cima na tela
      const rr = r * cam.zoom;
      const axis = Math.atan2(b.y - a.y, b.x - a.x);
      const N = 12;
      const top = [];
      const bot = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const bump = 1 + 0.05 * Math.sin(u * 11 + d.x0 * 0.01);
        const c = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
        top.push({ x: c.x + nx * rr * bump, y: c.y + ny * rr * bump });
        bot.push({ x: c.x - nx * rr * bump, y: c.y - ny * rr * bump });
      }
      const body = polyPath(top.concat(bot.slice().reverse()));
      inkFill(ctx, body, '#6e5034', ink, 2.4);
      ctx.save();
      ctx.clip(body);
      // luz em cima, sombra embaixo, riscos da casca ao comprido e musgo no alto
      ctx.fillStyle = '#86643f';
      ctx.fill(polyPath(top.concat(top.map((q) => ({ x: q.x - nx * rr * 0.7, y: q.y - ny * rr * 0.7 })).reverse())));
      ctx.fillStyle = '#4c3622';
      ctx.fill(polyPath(bot.concat(bot.map((q) => ({ x: q.x + nx * rr * 0.55, y: q.y + ny * rr * 0.55 })).reverse())));
      ctx.strokeStyle = '#4a3420';
      ctx.lineWidth = Math.max(1, 1.3 * cam.zoom);
      ctx.beginPath();
      for (let k = 1; k < 4; k++) {
        const f = k * 0.45;
        top.forEach((q, i) => {
          const x = q.x - nx * rr * f + Math.sin(i * 1.7 + k) * 1.5 * cam.zoom;
          const y = q.y - ny * rr * f;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
      }
      ctx.stroke();
      ctx.fillStyle = '#4f7a3a';
      for (let i = 1; i < N; i += 2) {
        ctx.beginPath();
        ctx.ellipse(top[i].x - nx * rr * 0.25, top[i].y - ny * rr * 0.25, 8 * cam.zoom, 3 * cam.zoom, axis, 0, M.TAU);
        ctx.fill();
      }
      // a linha da água: a parte de baixo do tronco fica mais escura e molhada
      ctx.fillStyle = 'rgba(20, 50, 52, 0.35)';
      ctx.fill(polyPath(bot.concat(bot.map((q) => ({ x: q.x + nx * rr * 0.6, y: q.y + ny * rr * 0.6 })).reverse())));
      ctx.restore();
      // a ponta cortada do lado da câmera (os anéis da madeira)
      const near = a.y > b.y ? a : b;
      ctx.save();
      ctx.translate(near.x, near.y);
      ctx.rotate(Math.atan2(ny, nx));
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr + ink, rr * 0.45 + ink, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#c9a676';
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, rr * 0.45, 0, 0, M.TAU);
      ctx.fill();
      ctx.strokeStyle = '#8a6a44';
      ctx.lineWidth = Math.max(1, cam.zoom);
      for (let k = 1; k <= 2; k++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, (rr * k) / 3, (rr * 0.45 * k) / 3, 0, 0, M.TAU);
        ctx.stroke();
      }
      ctx.restore();
      // a água mexendo na beirada de baixo do tronco
      ctx.strokeStyle = 'rgba(210, 236, 232, 0.5)';
      ctx.lineWidth = Math.max(1, 1.3 * cam.zoom);
      for (const u of [0.25, 0.5, 0.75]) {
        const c = { x: a.x + (b.x - a.x) * u - nx * rr * 1.05, y: a.y + (b.y - a.y) * u - ny * rr * 1.05 };
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 12 * cam.zoom, 3 * cam.zoom, axis, 0, Math.PI);
        ctx.stroke();
      }
    },
  };

  // ------------------------------------------------------------------ luzes por cima do escuro
  /** O que brilha na mata (cogumelos e véus): pontos com cor, raio (cm) e força, para acender depois do escuro. */
  function glows(map) {
    const out = [];
    for (const p of map.props || []) if (p.kind === 'planta-cogumelo') out.push({ x: p.x, y: p.y, z: 10, r: Math.max(90, (p.r || 35) * 3.6), color: p.glow || '#3fd6c8', k: 0.65 });
    for (const v of map.veils || []) out.push({ x: v.x, y: v.y, z: 0, r: v.r * 1.15, color: '#3fd6c8', k: 0.45 });
    return out;
  }

  PD.flora = { tree, small, glows };
})(window.PD = window.PD || {});
