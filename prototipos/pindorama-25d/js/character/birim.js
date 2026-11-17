// O BIRIM: outro personagem jogável, montado no MESMO esqueleto do herói (js/character/body.js, rig.js, animator.js).
// Todas as animações e os encaixes de equipamento servem para ele sem mudar nada: aqui ficam só as MEDIDAS dos
// volumes dele, as CORES e os pintores do que é dele — rosto, barba, cabelo curto, boné para trás com os óculos em
// cima, cordão com a coroa, tatuagem do braço esquerdo, relógio, bermuda cargo e chinelos.
// A referência é a ficha aprovada pelo dono (17/11; as imagens ficam fora do repositório).
//
// Como o desenho escolhe o modelo: `appearance.modelo` (veja `PD.models.appearance('birim')` e renderer.js). Um
// modelo é o objeto de medidas (as mesmas chaves de PD.MODEL) mais os ganchos:
//   face(R, esqueleto, look, pedaço)        → o rosto (no lugar do rosto pintado do herói)
//   chestDetail(R, pedaço, esqueleto, look) → detalhes do peito
//   limbDetail(R, esqueleto, lado, parte)   → detalhes na pele de um braço ou de uma perna (a tatuagem)
//   extras(R, esqueleto, look, peças, env)  → peças próprias com lugar pela distância (cabelo, boné, óculos, cordão)
//   wear(R, esqueleto, look, peças, equip)  → roupa presa a uma parte do corpo (a bermuda, o relógio)
//   footUnder / footOver                    → o que vai por baixo e por cima do pé (o chinelo)
// O que é ROUPA sai quando o encaixe correspondente recebe um equipamento (um capacete no lugar do boné, uma calça no
// lugar da bermuda, uma bota no lugar do chinelo); rosto, barba, cabelo e tatuagem são a identidade dele e não saem.
(function (PD) {
  'use strict';
  const M = PD.math;
  const S = PD.shapes;
  const { add, sub, scale, dot, norm, cross, at, dirIn, clamp01, smoothstep } = M;
  const { limbAt } = PD.rig;
  const BASE = PD.MODEL;

  // ------------------------------------------------------------------ cores (tiradas da ficha)
  const PALETTE = {
    ...PD.PALETTE,
    ink: '#1a0e0a',
    inkSoft: '#4f2613',
    skin: { base: '#e2732b', shade: '#a94e1b', light: '#f89248' },
    skinFar: { base: '#cb6424', shade: '#934216', light: '#e1803c' },
    lip: '#a04a26',
    hair: { base: '#261713', shade: '#120a09', light: '#46312a' },
    iris: '#3b2214',
    eyeWhite: '#f6ecdd',
    // roupa e acessórios
    cap: { base: '#241b1a', shade: '#100b0b', light: '#40332f' },
    capLogo: '#f1cfa6',
    lens: ['#ffd84f', '#ff8a1c', '#dc2a16'],
    frame: { base: '#8c9199', shade: '#4a4e55', light: '#d7dbe0' },
    metal: { base: '#cfd4da', shade: '#7c838c', light: '#ffffff' },
    denim: { base: '#1e1d2b', shade: '#0b0b11', light: '#302f44' },
    stitch: '#d98a3c',
    rivet: '#b8733a',
    print: '#f1cfa6',
    tattoo: 'rgba(52, 27, 20, 0.84)',
    sandal: { base: '#1e1c1d', shade: '#0b0a0b', light: '#3c393a' },
    watch: { base: '#1d1d21', shade: '#0a0a0c', light: '#45454d' },
  };

  // ------------------------------------------------------------------ medidas da cabeça
  // crânio mais estreito e rosto mais comprido que o do herói; a mandíbula e o queixo já têm a grossura da barba
  const HEAD = {
    spheres: [
      { name: 'cranio', p: [0, -0.4, 1.8], r: 13 },
      { name: 'cranioTras', p: [0, -3.8, 0.8], r: 12.6 },
      { name: 'testa', p: [0, 6.6, 4.6], r: 8 },
      { name: 'macaE', p: [-6.8, 8.2, -2.6], r: 5.6 },
      { name: 'macaD', p: [6.8, 8.2, -2.6], r: 5.6 },
      { name: 'orbitaE', p: [-4.4, 9.2, -1.2], r: 4.3 }, // onde o olho assenta: olhando para a frente, um tiquinho para fora
      { name: 'orbitaD', p: [4.4, 9.2, -1.2], r: 4.3 },
      { name: 'mandibulaE', p: [-4.8, 5.4, -9.8], r: 4.9 },
      { name: 'mandibulaD', p: [4.8, 5.4, -9.8], r: 4.9 },
      { name: 'boca', p: [0, 10.6, -7.8], r: 5 },
      { name: 'queixo', p: [0, 10.4, -14.2], r: 5 },
      { name: 'queixoE', p: [-2.3, 9.8, -14.5], r: 4.3 },
      { name: 'queixoD', p: [2.3, 9.8, -14.5], r: 4.3 },
      { name: 'nariz', p: [0, 17.2, -3.9], r: 2.2 },
      { name: 'asaE', p: [-2, 14.8, -5], r: 1.8 },
      { name: 'asaD', p: [2, 14.8, -5], r: 1.8 },
      { name: 'ponte', p: [0, 14.4, 0.6], r: 2.1 },
      { name: 'arcoE', p: [-4.7, 12.9, 3], r: 3.1 }, // (o arco fica acima do olho: mais baixo, o olho caía na parte de baixo dele e sumia)
      { name: 'arcoD', p: [4.7, 12.9, 3], r: 3.1 },
    ],
    neckBase: [0, -2.4, -13],
    ear: { top: { p: [11.9, -2.2, -0.6], r: 2.2 }, mid: { p: [12.2, -1.5, -2.7], r: 2.35 }, lobe: { p: [11.8, -0.5, -5.1], r: 1.7 } },
    eye: { x: 4.8, z: -1.3, w: 5.6, h: 2.5, iris: 1.45, lid: 0.5 }, // (`lid`: a grossura da linha da pálpebra, em cm)
    brow: { inner: [1.3, 0.9], outer: [8.9, 0.9], thick: 0 }, // (a sobrancelha em gota do motor fica desligada: a dele é a barra de `browBar`)
    browBar: { x0: 1.9, x1: 9.3, z0: 1.15, z1: 1.75, w: 1.75 },
    mouth: { x: 3.1, z: -9.9 },
  };
  // boné (para trás): uma casca um pouco maior que o crânio. `rim` = a altura da barra em volta da cabeça (mais alta
  // na testa, mais baixa na nuca, onde fica a aba)
  const CAP = { c: [0, -2.2, 1.5], r: 14, rimFront: 6.6, rimBack: -1.8, eps: 1e-6 }; // (`eps`: veja `_capPoly` no renderer)
  {
    // o plano da barra (inclinado: alto na testa, baixo na nuca), para recortar a casca: normal e distância do centro
    const zf = CAP.rimFront - CAP.c[2], zb = CAP.rimBack - CAP.c[2];
    const yf = Math.sqrt(CAP.r * CAP.r - zf * zf), yb = -Math.sqrt(CAP.r * CAP.r - zb * zb);
    const l = Math.hypot(zf - zb, yf - yb);
    CAP.n = [0, -(zf - zb) / l, (yf - yb) / l];
    CAP.d = yf * CAP.n[1] + zf * CAP.n[2];
  }
  const capRimZ = (phi) => {
    // a altura da barra na direção phi: onde o plano inclinado corta a casca (resolvido por aproximações)
    let z = (CAP.rimFront + CAP.rimBack) / 2 + ((CAP.rimFront - CAP.rimBack) / 2) * Math.cos(phi);
    for (let k = 0; k < 6; k++) {
      const zz = z - CAP.c[2];
      const rho = Math.sqrt(Math.max(0, CAP.r * CAP.r - zz * zz));
      z = CAP.c[2] + (CAP.d - rho * Math.cos(phi) * CAP.n[1]) / CAP.n[2];
    }
    return z;
  };
  /** Ponto da casca do boné na direção `phi` (0 = testa, π = nuca) e na altura z. */
  const capPoint = (phi, z, grow = 0) => {
    const rho = Math.sqrt(Math.max(0, (CAP.r + grow) * (CAP.r + grow) - (z - CAP.c[2]) * (z - CAP.c[2])));
    return [CAP.c[0] + rho * Math.sin(phi), CAP.c[1] + rho * Math.cos(phi), z];
  };

  // ------------------------------------------------------------------ o modelo (o que muda do herói)
  const MODEL = {
    ...BASE,
    id: 'birim',
    HEAD,
    headScale: 0.68, // a cabeça dele é menor que a do herói (que é de "cabeça grande de herói"): ~7 cabeças de altura, como na ficha
    headDrop: 0.5, // e fica um pouco mais baixa no pescoço (cm); mais que isto, a barba encosta no peito e o pescoço some
    NECK: { r0: 8.1, r1: 6.9 },
    // corpo de quem treina, mas mais estreito que o do herói (na ficha: peito ~38 cm de largura, cintura ~30)
    CHEST: [
      { p: [0, 0.8, -19.5], r: 12.8 },
      { p: [-7.9, 1, -15], r: 7.7 },
      { p: [7.9, 1, -15], r: 7.7 },
      { p: [0, 4, -10.5], r: 10.4 },
      { p: [-7.9, 5.4, 1.8], r: 9.9 }, // peitorais
      { p: [7.9, 5.4, 1.8], r: 9.9 },
      { p: [-11, -2.8, -2.4], r: 9.2 }, // dorsais
      { p: [11, -2.8, -2.4], r: 9.2 },
      { p: [-6.6, -2.4, 12.3], r: 6.2 }, // trapézio
      { p: [6.6, -2.4, 12.3], r: 6.2 },
      { p: [-10.8, -2.4, 9.4], r: 6.9 },
      { p: [10.8, -2.4, 9.4], r: 6.9 },
      { p: [0, 1.5, 7.4], r: 8.8 },
      { p: [-7, 0.9, -22.5], r: 7.4 }, // a cintura desce reta até o quadril
      { p: [7, 0.9, -22.5], r: 7.4 },
    ],
    PELVIS: BASE.PELVIS.map((s, k) => (k === 1 || k === 2 ? { p: [Math.sign(s.p[0]) * 8, 0.4, 0.8], r: 8 } : s)),
    UPPER_ARM: BASE.UPPER_ARM.map((s) => ({ ...s, r: s.r + (s.t === 1 ? 0.35 : s.part === 'deltoide' ? 0.8 : 1.15) })),
    FOREARM: BASE.FOREARM.map((s, k) => ({ ...s, r: s.r + [0.35, 0.8, 0.5, 0.25][k] })),
    THIGH: BASE.THIGH.map((s, k) => ({ ...s, r: s.r + [0.3, 0.4, 0.4, 0.3, 0.1, 0.1][k] })),
    SHIN: BASE.SHIN.map((s, k) => ({ ...s, r: s.r + [0.2, 0.9, 0.7, 0.3, 0.1, 0.1][k] })),
    // nada disto é dele: cabelo comprido, tranças, faixa e penas; colar de garras; tanga; pinturas de jenipapo; brincos
    HAIR: null,
    FEATHERS: null,
    NECKLACE: null,
    LOINCLOTH: null,
    BODY_PAINT: null,
    EARRINGS: false,
  };

  // ------------------------------------------------------------------ utilidades
  /** Curva por pontos [|x|, z] (linear entre eles). */
  const curve = (pts) => (x) => {
    const a = Math.abs(x);
    if (a <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (a <= pts[i][0]) {
        const t = (a - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
      }
    }
    return pts[pts.length - 1][1];
  };
  /** Polígono plano no espaço (pontos 3D já no mundo) → caminho na tela. */
  const flatPath = (R, pts) => {
    const p = new Path2D();
    pts.forEach((q, i) => {
      const s = R.P(q);
      if (i) p.lineTo(s.x, s.y);
      else p.moveTo(s.x, s.y);
    });
    p.closePath();
    return p;
  };
  /** Traço de tinta por baixo e a cor por cima (um fio grosso com contorno): cordão, haste dos óculos, tira do chinelo. */
  function cord(R, pts, width, color, ink = R.pal.ink, extra = 0.9) {
    const ctx = R.ctx;
    if (pts.length < 2) return;
    const path = S.smoothLinePath(pts.map((q) => R.P(q)));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ink;
    ctx.lineWidth = width * R.zoom + Math.max(1.1, R.inkIn * extra * 2);
    ctx.stroke(path);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.9, width * R.zoom);
    ctx.stroke(path);
  }
  /** A coroa de três pontas (o símbolo dele): pontos em (u, v) de −1 a 1, com a base embaixo. */
  const CROWN = [[-1, -0.78], [-1, 0.42], [-0.52, -0.1], [0, 0.95], [0.52, -0.1], [1, 0.42], [1, -0.78]];

  // ------------------------------------------------------------------ rosto
  function face(R, rig, look) {
    const ctx = R.ctx;
    const head = R.H;
    const PAL = R.pal;
    const z = R.zoom;
    const fFace = R.facing(rig.head.f);

    if (fFace < -0.55) return; // de costas: nada do rosto aparece
    // os lábios (a barba e o bigode são volumes, por cima do rosto: veja `extras`)
    const mo = MODEL.HEAD.mouth;
    R._faceStrip(head, -3.5, 3.5, (x) => mo.z + 0.5 - 0.04 * x * x, (x) => mo.z - 1.9 + 0.12 * x * x, M.mix(PAL.lip, PAL.skin.base, 0.12), 12, 0.12);

    // sombra do boné e dos óculos na testa (o sol vem do alto)
    R._faceStrip(head, -11.5, 11.5, () => 7.6, (x) => 5.2 - 0.012 * x * x, PAL.skin.shade, 20, 0.1);

    // olhos e sobrancelhas (os mesmos do herói, com as medidas dele)
    const turned = R.facing(rig.head.r); // > 0: o lado direito dele olha para a câmera
    for (const sx of [-1, 1]) {
      if (-sx * turned < 0.8 && Math.abs(turned) < 0.86) {
        R._eye(head, sx, look);
        browBar(R, head, sx, look);
      } else if (sx * turned >= 0.86) sideEye(R, rig, head, sx, look); // de perfil: o olho do lado de cá, visto de lado
    }
    // nariz: a linha do lado da sombra e a base
    const nTop = R._faceAt(head, 0.85, -2.3, 0.1);
    const nBot = R._faceAt(head, 1.4, -4.7, 0.1);
    const nL = R._faceAt(head, -2.5, -5.6, 0.1);
    const nR = R._faceAt(head, 2.7, -5.5, 0.1);
    if (nTop && nBot && nL && nR && R.facing(nBot.n) > 0.2) {
      ctx.strokeStyle = PAL.inkSoft;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.6, 0.42 * z);
      ctx.globalAlpha = smoothstep(0.2, 0.5, R.facing(nBot.n)) * smoothstep(0.3, 0.62, fFace);
      const a = R.P(nTop.pt), b = R.P(nBot.pt), c = R.P(nL.pt), d = R.P(nR.pt);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(b.x + (b.x - a.x) * 0.3, b.y, b.x, b.y);
      ctx.moveTo(c.x, c.y);
      ctx.quadraticCurveTo((c.x + d.x) / 2, (c.y + d.y) / 2 + 0.5 * z, d.x, d.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // boca: fechada e séria; abre um pouco no esforço
    const open = clamp01(look.mouthOpen || 0);
    const m0 = R._faceAt(head, -mo.x, mo.z - 0.22, 0.1);
    const m1 = R._faceAt(head, 0, mo.z + 0.05, 0.1);
    const m2 = R._faceAt(head, mo.x, mo.z - 0.22, 0.1);
    const m3 = R._faceAt(head, 0, mo.z - 0.9 - open * 1.8, 0.1);
    if (m0 && m1 && m2 && m3 && R.facing(m1.n) > 0.15) {
      const a = R.P(m0.pt), b = R.P(m1.pt), c = R.P(m2.pt), d = R.P(m3.pt);
      ctx.globalAlpha = smoothstep(0.15, 0.45, R.facing(m1.n));
      if (open > 0.15) {
        ctx.fillStyle = '#4a1a14';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
        ctx.quadraticCurveTo(d.x, d.y, a.x, a.y);
        ctx.fill();
      }
      ctx.strokeStyle = PAL.ink;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.7, 0.46 * z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /** A sobrancelha dele: uma barra grossa e quase reta, logo acima do olho, acompanhando a curva do rosto. */
  function browBar(R, head, sx, look) {
    const B = MODEL.HEAD.browBar;
    const ctx = R.ctx;
    const raise = (look.browRaise || 0) * 0.8;
    const pts = [];
    let fMin = 1;
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const q = R._faceAt(head, sx * (B.x0 + (B.x1 - B.x0) * t), B.z0 + (B.z1 - B.z0) * Math.sin(t * Math.PI * 0.62) + raise * (0.6 + 0.4 * (1 - t)), 0.15);
      if (!q) continue;
      const f = R.facing(q.n);
      if (f < 0.14) continue; // a ponta que já virou para o outro lado do rosto não aparece
      fMin = Math.min(fMin, f);
      pts.push(R.P(q.pt));
    }
    if (pts.length < 2) return;
    ctx.strokeStyle = '#1c1416';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.2, B.w * R.hs * R.zoom);
    ctx.stroke(S.smoothLinePath(pts));
  }

  // ------------------------------------------------------------------ peito
  /** y da frente do peito no ponto (x, z) do peito (o máximo entre as esferas); null fora dele. */
  function chestY(x, z) {
    let best = null;
    for (const s of MODEL.CHEST) {
      const q = s.r * s.r - (x - s.p[0]) * (x - s.p[0]) - (z - s.p[2]) * (z - s.p[2]);
      if (q > 0) best = Math.max(best ?? -1e9, s.p[1] + Math.sqrt(q));
    }
    return best;
  }
  function chestDetail(R, seg, rig) {
    const ctx = R.ctx;
    const ch = rig.chest;
    const PAL = R.pal;
    const z = R.zoom;
    const fine = R.fine;
    /** Ponto na pele da frente do peito em (x, z). */
    const fp = (x, zz, lift = 0.05) => {
      const y = chestY(x, zz);
      return y === null ? null : R.P(at(ch, x, y + lift, zz));
    };
    const facing = (n) => R.facing(norm(dirIn(ch, n[0], n[1], n[2])));
    const line = (pts, n, width, alpha, color = PAL.inkSoft) => {
      const f = facing(n);
      if (f < 0.12 || (!fine && width < 0.5)) return;
      const q = pts.map((p) => (p.length === 2 ? fp(p[0], p[1]) : R.P(at(ch, p[0], p[1], p[2])))).filter(Boolean);
      if (q.length < 2) return;
      ctx.globalAlpha = alpha * smoothstep(0.12, 0.42, f);
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.5, width * z);
      ctx.stroke(S.smoothLinePath(q));
      ctx.globalAlpha = 1;
    };
    const shadeBlob = (pts, n, alpha) => {
      const f = facing(n);
      if (f < 0.12) return;
      const q = pts.map((p) => fp(p[0], p[1])).filter(Boolean);
      if (q.length < 3) return;
      ctx.globalAlpha = alpha * smoothstep(0.12, 0.42, f);
      ctx.fillStyle = PAL.skin.shade;
      ctx.fill(S.smoothClosedPath(q));
      ctx.globalAlpha = 1;
    };
    for (const sx of [-1, 1]) {
      // peitoral: a sombra embaixo dele e a linha
      shadeBlob([[sx * 0.9, -2], [sx * 5.4, -4.9], [sx * 10.6, -4.2], [sx * 14, 0.2], [sx * 13.4, -1.9], [sx * 10.2, -6.5], [sx * 5.2, -7.1], [sx * 1.1, -4.2]], [sx * 0.35, 1, -0.2], 0.42);
      line([[sx * 0.9, -2], [sx * 5.4, -4.9], [sx * 10.6, -4.2], [sx * 14, 0.2]], [sx * 0.35, 1, -0.2], 0.62, 0.85);
      // clavícula
      line([[sx * 2.4, 9.4, 11.2], [sx * 7.2, 8, 12.6], [sx * 12, 4.4, 12.2]], [sx * 0.2, 0.8, 0.6], 0.45, 0.55);
      // gomos da barriga: três de cada lado, cada um com a sombra na beirada de baixo
      for (const [z0, z1] of [[-8.2, -12.2], [-13, -17.2], [-18, -22.4]]) {
        shadeBlob([[sx * 0.9, z1 + 1.1], [sx * 3.2, z1 + 0.5], [sx * 5.6, z1 + 1.5], [sx * 5.9, z1 + 0.5], [sx * 3.2, z1 - 0.5], [sx * 0.8, z1 + 0.1]], [sx * 0.2, 1, -0.1], 0.5);
        line([[sx * 0.8, z1 + 0.3], [sx * 3.3, z1 - 0.1], [sx * 5.7, z1 + 1]], [sx * 0.2, 1, 0], 0.5, 0.7);
        line([[sx * 6, z0 - 0.2], [sx * 6.4, (z0 + z1) / 2], [sx * 5.9, z1 + 0.6]], [sx * 0.5, 0.9, 0], 0.42, 0.55);
      }
      // costelas (serrátil) e o lado da barriga
      for (const zz of [-5.6, -8.6, -11.4]) line([[sx * 11.6, zz + 0.9], [sx * 9.9, zz - 0.5]], [sx * 0.8, 0.6, 0], 0.4, 0.5);
      line([[sx * 8.6, -11.5], [sx * 8.9, -17], [sx * 8, -23]], [sx * 0.6, 0.8, 0], 0.42, 0.5);
      // escápula e dorsal (costas)
      line([[sx * 3.8, -10.6, 6], [sx * 8.4, -10.2, 1], [sx * 7.6, -9.8, -4]], [sx * 0.2, -1, 0.1], 0.5, 0.6);
      line([[sx * 9.6, -8.2, -3], [sx * 7.6, -9.6, -11], [sx * 4.4, -10.4, -18]], [sx * 0.4, -0.9, 0], 0.45, 0.5);
    }
    line([[0, 5.6], [0, -1.8]], [0, 1, 0], 0.5, 0.6); // esterno
    line([[0, -7.4], [0, -15], [0, -23.4]], [0, 1, 0], 0.5, 0.65); // linha do meio da barriga
    line([[0, -11.4, 9], [0, -11.6, 0], [0, -11.2, -11], [0, -10.6, -20]], [0, -1, 0], 0.5, 0.6); // coluna
    const f = facing([0, 1, 0.1]);
    if (f > 0.12) {
      ctx.globalAlpha = smoothstep(0.12, 0.4, f);
      // umbigo
      const nb = fp(0, -24.6);
      if (nb) {
        ctx.fillStyle = PAL.skin.shade;
        ctx.beginPath();
        ctx.ellipse(nb.x, nb.y, 0.8 * z, 0.6 * z, 0, 0, M.TAU);
        ctx.fill();
      }
      // mamilos
      ctx.fillStyle = M.mix(PAL.skin.shade, '#5a2412', 0.45);
      for (const sx of [-1, 1]) {
        const c = fp(sx * 8.6, -0.4), u = fp(sx * 8.6 + 1.2, -0.4), v = fp(sx * 8.6, 0.5);
        if (!c || !u || !v) continue;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, Math.max(0.7, Math.hypot(u.x - c.x, u.y - c.y)), Math.max(0.55, Math.hypot(v.x - c.x, v.y - c.y)), Math.atan2(u.y - c.y, u.x - c.x), 0, M.TAU);
        ctx.fill();
      }
      // pelos no meio do peito (uns risquinhos, só de perto)
      if (fine) {
        ctx.strokeStyle = PAL.skin.shade;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.5, 0.36 * z);
        ctx.globalAlpha *= 0.75;
        ctx.beginPath();
        for (const [x, zz, dx, dz] of [[-1.6, 4.6, -0.5, -1.5], [1.5, 4.9, 0.5, -1.5], [-0.7, 2.6, -0.3, -1.6], [0.8, 2.4, 0.3, -1.6], [-2.4, 1.8, -0.7, -1.3], [2.5, 1.6, 0.7, -1.3], [0, 0.4, 0, -1.6], [-1.3, -0.6, -0.4, -1.4], [1.4, -0.8, 0.4, -1.4]]) {
          const a = fp(x, zz), b = fp(x + dx, zz + dz);
          if (!a || !b) continue;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // sombra dos braços que estão na frente do peito (contato), como no herói
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      if (dot(scale(rig.body.r, side), R.toCam) < -0.2) continue;
      const circles = MODEL.UPPER_ARM.map((s) => R.circle(limbAt(rig.upperArm[i], s.t, s.f, s.o), s.r));
      const k = 2.6 * z;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = PAL.skin.shade;
      ctx.fill(S.polyPath(R.hull(circles), -R.light.x * k, -R.light.y * k));
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ cabelo, boné, óculos, brincos, cordão
  function extras(R, rig, look, items, env) {
    const { head, hs, headKey } = env;
    const PAL = R.pal;
    const hp = (p) => at(head, p[0], p[1], p[2]);
    const sphere = (p, r) => R.circle(hp(p), r * hs);
    const gear = R.equipped || {};
    const off = look.semPecas || {};

    // ---- cabelo curto e crespo: a parte de trás da cabeça (uma touca rente) e os cachos da nuca e de trás das orelhas
    const back = R._capPoly(head, { c: [0, -3.2, 1], r: 13.6, n: [0, -0.8, 0.6], d: 3, eps: 1e-6 });
    if (back) items.push({ name: 'cabeloCurto', key: headKey + 0.3, group: 'cabeloCurto', segs: [{ poly: back.poly, path: back.path, mat: PAL.hair, k: 0.2, isNape: true, concave: true }] });
    const CURLS = [
      [[-8.6, -9, -6.4], 3.1], [[-4.5, -12.2, -8.3], 3.4], [[0, -13.4, -8.9], 3.5], [[4.5, -12.2, -8.3], 3.4], [[8.6, -9, -6.4], 3.1],
      [[-12.3, -5.2, -3.4], 3.2], [[12.3, -5.2, -3.4], 3.2], [[-11.9, -6.6, 1.2], 3.2], [[11.9, -6.6, 1.2], 3.2], [[-11.6, -4.6, -7.2], 2.6], [[11.6, -4.6, -7.2], 2.6],
      [[-6.9, -11.8, -2.6], 3.3], [[6.9, -11.8, -2.6], 3.3], [[0, -14.2, -3.6], 3.4],
    ];
    const curlSegs = CURLS.map(([p, r]) => ({ poly: R.hull([sphere(p, r), sphere([p[0] * 0.92, p[1] * 0.92, p[2] + 1.4], r * 0.8)]), circles: R._last, mat: PAL.hair, k: 0.3, noInner: true }));
    const curlKey = R.keyOf(hp([0, -10.5, -5]));
    items.push({ name: 'cachos', key: curlKey < headKey ? Math.min(curlKey, headKey - 0.25) : curlKey, group: 'cachos', chain: true, segs: curlSegs });

    // ---- barba, bigode e costeletas: volumes rentes ao rosto (aparecem certo de frente, de lado e de três quartos).
    // Cada pedaço só entra se o lado dele olha para a câmera (o de lá fica escondido atrás do rosto)
    {
      const segs = [];
      const awayish = R.facing(rig.head.f) < -0.08; // já de costas (de perfil ainda não)
      // (de costas só fica a costeleta, na frente da orelha: o resto da barba está do lado de lá do rosto)
      const piece = (list, nLocal, minFacing, k = 0, side = false) => {
        if (R.facing(norm(dirIn(rig.head, nLocal[0], nLocal[1], nLocal[2]))) < (awayish ? (side ? 0.06 : 0.3) : minFacing)) return;
        segs.push({ poly: R.hull(list.map(([p, r]) => sphere(p, r))), circles: R._last, mat: PAL.hair, k, noInner: true });
      };
      piece([[[0, 10.8, -15.2], 4.5], [[-2.3, 10, -15.3], 4], [[2.3, 10, -15.3], 4], [[0, 14.2, -13.9], 1.7]], [0, 0.85, -0.5], -0.22, 0.24); // queixo e a mosca (o alto fica abaixo da boca)
      for (const sx of [-1, 1]) {
        piece([[[sx * 11.9, 1, 3.6], 1.2], [[sx * 11.1, 0.7, -3.6], 1.15]], [sx, 0.2, 0], 0.02, 0, true); // cabelo da têmpora, na frente da orelha
        piece([[[sx * 11.1, 0.7, -3.6], 1.15], [[sx * 9.3, 3.4, -8.4], 1.7]], [sx, 0.25, -0.1], 0, 0, true); // costeleta
        piece([[[sx * 9.3, 3.4, -8.4], 1.7], [[sx * 5.9, 7.9, -12.4], 3.1]], [sx * 0.8, 0.5, -0.3], -0.12); // lado da mandíbula
        piece([[[sx * 5.9, 7.9, -12.4], 3.1], [[sx * 2.3, 10, -15.3], 4]], [sx * 0.45, 0.8, -0.35], -0.18); // frente da mandíbula
        piece([[[sx * 0.9, 15.3, -7.6], 1.05], [[sx * 3.9, 13.2, -8.7], 0.85]], [sx * 0.3, 0.9, 0.1], 0.05); // bigode
        piece([[[sx * 3.9, 13.2, -8.7], 0.85], [[sx * 4.9, 11.2, -12.3], 1.5]], [sx * 0.5, 0.85, -0.1], 0.05); // do canto do bigode até a barba do queixo
      }
      if (segs.length) items.push({ name: 'barba', key: headKey + 0.25, group: 'barba', chain: true, segs });
    }

    // ---- sem o boné: o cabelo curto do alto da cabeça (com ele, fica escondido)
    if (off.bone && !gear.cabeca) {
      const top = R._capPoly(head, { c: [0, -1.6, 1.4], r: 13.75, n: [0, -0.38, 0.925], d: 4.2, eps: 1e-6 });
      if (top) items.push({ name: 'cabeloTopo', key: headKey + 0.32, group: 'cabeloTopo', segs: [{ poly: top.poly, path: top.path, mat: PAL.hair, k: 0.2, isCap: true, concave: true }] });
      const TOP = [[0, 3.5, 13.9], [-5.2, 2, 12.6], [5.2, 2, 12.6], [-3, -4, 14.4], [3, -4, 14.4], [0, -9.5, 12.4], [-7.6, -4.5, 10.4], [7.6, -4.5, 10.4], [0, -1, 15]];
      const segs = TOP.map((p) => ({ poly: R.hull([sphere(p, 3.1), sphere([p[0] * 0.9, p[1], p[2] - 1.2], 2.6)]), circles: R._last, mat: PAL.hair, k: 0, noInner: true }));
      items.push({ name: 'cachosTopo', key: headKey + 0.33, group: 'cachosTopo', chain: true, segs });
    }

    // ---- brinco (um ponto de metal em cada orelha), do lado que olha para a câmera
    for (let i = 0; i < 2; i++) {
      const ear = items.find((it) => it.name === 'orelha' && it.group === 'orelha' + i);
      if (!ear) continue;
      const side = i === 0 ? -1 : 1;
      items.push({
        name: 'brincoBirim', key: ear.key + 0.2,
        draw: () => {
          const n = scale(rig.head.r, side);
          if (R.facing(n) < 0.08) return;
          const q = R.P(add(hp([side * 12, -0.2, -5.7]), scale(n, 1.6 * hs)));
          const r = Math.max(0.8, 0.95 * hs * R.zoom);
          const ctx = R.ctx;
          ctx.fillStyle = PAL.ink;
          ctx.beginPath();
          ctx.arc(q.x, q.y, r + Math.max(0.5, R.inkIn * 0.8), 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = PAL.metal.base;
          ctx.beginPath();
          ctx.arc(q.x, q.y, r, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = PAL.metal.light;
          ctx.beginPath();
          ctx.arc(q.x - r * 0.3, q.y - r * 0.3, r * 0.4, 0, M.TAU);
          ctx.fill();
        },
      });
    }

    // ---- boné para trás e os óculos em cima dele (saem se o encaixe da cabeça tiver um capacete)
    if (!gear.cabeca && !off.bone) {
      // a copa: a parte da casca acima da barra que a câmera vê (o mesmo recorte da touca de cabelo do herói; um casco
      // de esferas pintaria por cima do rosto a parte de trás do boné, que fica escondida atrás da cabeça)
      const dome = R._capPoly(head, CAP);
      if (dome) items.push({ name: 'bone', key: headKey + 0.34, group: 'bone', segs: [{ poly: dome.poly, path: dome.path, mat: PAL.cap, k: 0.26, concave: true, decal: () => capDetail(R, rig, head, hs) }] });
      // a aba, na nuca, descendo para trás
      const BRIM = [[-7.9, -14.4, -1.9], [-8.5, -19.4, -4.8], [-6.1, -24, -7.2], [0, -26.2, -7.6], [6.1, -24, -7.2], [8.5, -19.4, -4.8], [7.9, -14.4, -1.9], [0, -15.6, -0.2], [0, -20.4, -2.8]];
      items.push({ name: 'aba', key: R.keyOf(hp([0, -19.5, -4])), group: 'aba', segs: [{ poly: R.hull(BRIM.map((p) => sphere(p, 0.95))), circles: R._last, mat: PAL.cap, k: 0.3 }] });
      // botão do alto
      items.push({ name: 'botaoBone', key: headKey + 0.36, group: 'botaoBone', segs: [{ poly: R.hull([sphere([CAP.c[0], CAP.c[1] - 0.3, CAP.c[2] + CAP.r + 0.5], 1.25)]), circles: R._last, mat: PAL.cap, k: 0.3 }] });
      items.push({ name: 'oculos', key: R.keyOf(hp([0, 13.4, 9.4])) + 0.2, draw: () => glasses(R, rig, head, hs) });
    }

    // ---- cordão com a coroa
    if (!off.cordao) items.push({ name: 'cordao', key: env.chestKey + 0.5, draw: () => chain(R, rig, look) });

    // ---- as solas dos chinelos (saem se o encaixe dos pés tiver um calçado)
    if (!gear.pes && !off.chinelos) for (let i = 0; i < 2; i++) items.push(soleItem(R, rig, i, items));
  }

  /** Costuras do boné e a coroa bordada no painel que fica virado para trás. */
  function capDetail(R, rig, head, hs) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const z = R.zoom;
    const hp = (p) => at(head, p[0], p[1], p[2]);
    const nrm = (phi, zz) => {
      const p = capPoint(phi, zz);
      return norm(dirIn(rig.head, p[0] - CAP.c[0], p[1] - CAP.c[1], p[2] - CAP.c[2]));
    };
    // costuras dos gomos, do botão até a barra
    if (R.fine) {
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.5, 0.4 * z);
      for (let k = 0; k < 6; k++) {
        const phi = (k / 6) * M.TAU + M.TAU / 12;
        if (R.facing(nrm(phi, 9)) < 0.1) continue;
        const pts = [];
        for (let j = 0; j <= 6; j++) {
          const zz = capRimZ(phi) + ((CAP.c[2] + CAP.r - 0.6 - capRimZ(phi)) * j) / 6;
          pts.push(R.P(hp(capPoint(phi, zz, 0.15))));
        }
        ctx.strokeStyle = PAL.cap.shade;
        ctx.globalAlpha = 0.9;
        ctx.stroke(S.smoothLinePath(pts));
      }
      ctx.globalAlpha = 1;
    }
    // a barra (um vinco claro logo acima da borda)
    {
      const pts = [];
      for (let k = 0; k <= 28; k++) {
        const phi = (k / 28) * M.TAU;
        pts.push(R.facing(nrm(phi, capRimZ(phi) + 2)) > 0.05 ? R.P(hp(capPoint(phi, capRimZ(phi) + 2.3, 0.15))) : null);
      }
      ctx.strokeStyle = PAL.cap.light;
      ctx.lineWidth = Math.max(0.5, 0.42 * z);
      ctx.globalAlpha = 0.75;
      let run = [];
      const flush = () => {
        if (run.length > 1) ctx.stroke(S.smoothLinePath(run));
        run = [];
      };
      for (const q of pts) {
        if (q) run.push(q);
        else flush();
      }
      flush();
      ctx.globalAlpha = 1;
    }
    // a coroa: no painel da frente do boné, que com ele para trás fica na nuca
    const n = nrm(Math.PI, 6.2);
    const f = R.facing(n);
    if (f > 0.15) {
      const c = hp(capPoint(Math.PI, 6.4, 0.2));
      const right = norm(cross(rig.head.u, n));
      const up = norm(cross(n, right));
      const w = 3.5 * hs, h = 3 * hs;
      const pts = CROWN.map(([u, v]) => add(add(c, scale(right, u * w)), scale(up, v * h)));
      ctx.globalAlpha = smoothstep(0.15, 0.4, f);
      ctx.strokeStyle = PAL.capLogo;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.9, 0.62 * hs * z);
      ctx.stroke(flatPath(R, pts));
      ctx.globalAlpha = 1;
    }
  }

  /** Óculos de lente laranja, apoiados no boné em cima da testa: duas lentes, a ponte e as hastes. */
  function glasses(R, rig, head, hs) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const z = R.zoom;
    const hp = (p) => at(head, p[0], p[1], p[2]);
    const nLens = norm(dirIn(rig.head, 0, 0.9, 0.44));
    const fl = R.facing(nLens);
    // hastes: da ponta de fora de cada lente até atrás da orelha, por fora do boné
    const lensFacing = (sx) => R.facing(norm(add(nLens, scale(rig.head.r, 0.3 * sx))));
    for (const sx of [-1, 1]) {
      const ns = norm(dirIn(rig.head, sx, 0.25, 0.2));
      if (R.facing(ns) < -0.02) continue;
      // (de costas, a ponta da frente da haste fica escondida atrás do boné: sem isto ela sobrava como uma antena)
      const path = [[sx * 9.4, 10.8, 9.5], [sx * 11.3, 5.4, 8.4], [sx * 13.3, -0.8, 7], [sx * 13.5, -4.8, 6.3]];
      cord(R, (lensFacing(sx) < 0.04 ? path.slice(2) : path).map(hp), 0.6 * hs, PAL.frame.base);
    }
    if (fl < -0.3) return; // de costas, as lentes ficam atrás do boné
    const up = norm(sub(rig.head.u, scale(nLens, dot(rig.head.u, nLens))));
    const LENS = [[-4, 1.8], [-0.4, 2.35], [3.6, 2.05], [4.5, 0.55], [3.7, -1.7], [0.7, -2.35], [-2.8, -1.9], [-4.2, -0.2]];
    const lenses = [];
    for (const sx of [-1, 1]) {
      // cada lente vira um pouco para o lado (os óculos abraçam a cabeça)
      const c = hp([sx * 5.1, 13.6, 9.5]);
      const right = norm(add(scale(rig.head.r, 1), scale(rig.head.f, -0.3 * sx)));
      const pts = LENS.map(([u, v]) => add(add(c, scale(right, sx * u * hs)), scale(up, v * hs)));
      if (lensFacing(sx) >= 0.04) lenses.push({ sx, c, pts, path: flatPath(R, pts) });
    }
    if (!lenses.length) return;
    // ponte
    if (fl > 0.02) cord(R, [hp([-1.3, 14.4, 11]), hp([0, 14.8, 10.5]), hp([1.3, 14.4, 11])], 0.9 * hs, PAL.frame.base);
    for (const L of lenses) {
      // armação (contorno de tinta, depois o metal claro) e a lente em degradê
      ctx.lineJoin = 'round';
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = Math.max(2.2, 1.75 * hs * z);
      ctx.stroke(L.path);
      ctx.strokeStyle = PAL.frame.base;
      ctx.lineWidth = Math.max(1, 0.85 * hs * z);
      ctx.stroke(L.path);
      const a = R.P(L.pts[1]), b = R.P(L.pts[5]);
      const g = ctx.createLinearGradient(a.x - (b.y - a.y) * 0.6, a.y, b.x + (b.y - a.y) * 0.6, b.y);
      g.addColorStop(0, PAL.lens[0]);
      g.addColorStop(0.45, PAL.lens[1]);
      g.addColorStop(1, PAL.lens[2]);
      ctx.fillStyle = g;
      ctx.fill(L.path);
      // reflexo
      ctx.save();
      ctx.clip(L.path);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#fff6c8';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.8, 0.7 * hs * z);
      const s0 = R.P(add(L.c, add(scale(up, 1.2 * hs), scale(rig.head.r, -1.6 * hs)))), s1 = R.P(add(L.c, add(scale(up, -0.2 * hs), scale(rig.head.r, -2.6 * hs))));
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Cordão de elos prateados em volta do pescoço, descendo em V até o meio do peito, com a coroa pendurada. */
  function chain(R, rig, look) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const z = R.zoom;
    const ch = rig.chest;
    const sw = look.pendantSwing || { x: 0, y: 0, z: 0 };
    // o caminho de um lado (o outro é o espelho): nuca → trapézio → clavícula → peito → pingente
    const HALF = [[0, -8.2, 15.4], [4.4, -6.4, 15.6], [7, -1.8, 15.2], [6.9, 4.2, 13.2], [5.2, 9.6, 9.8], [3, 12.9, 5.6], [1.1, 14.6, 1.6]];
    const pend = add(at(ch, 0, 15.1, 0.2), scale(sw, 1.6));
    const sideRun = (sx) => {
      const out = [];
      HALF.forEach((p, k) => {
        const n = norm(dirIn(ch, sx * p[0], p[1], 0.35));
        const q = add(at(ch, sx * p[0], p[1], p[2]), scale(sw, (k / (HALF.length - 1)) * 1.2));
        out.push({ q, vis: R.facing(n) > -0.06 });
      });
      out.push({ q: pend, vis: R.facing(norm(dirIn(ch, 0, 1, 0.2))) > -0.06 });
      return out;
    };
    const w = 0.82;
    for (const sx of [-1, 1]) {
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          cord(R, run, w, PAL.metal.base);
          // elos: tracinhos escuros atravessados, só de perto
          if (R.fine) {
            const pts = run.map((q) => R.P(q));
            ctx.strokeStyle = PAL.metal.shade;
            ctx.lineWidth = Math.max(0.5, 0.3 * z);
            ctx.beginPath();
            for (let k = 0; k + 1 < pts.length; k++) {
              const a = pts[k], b = pts[k + 1];
              const L = Math.hypot(b.x - a.x, b.y - a.y);
              const n = Math.max(1, Math.round(L / (1.5 * z)));
              const nx = -(b.y - a.y) / (L || 1), ny = (b.x - a.x) / (L || 1);
              for (let j = 0; j < n; j++) {
                const t = (j + 0.5) / n;
                const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
                ctx.moveTo(x - nx * w * z * 0.45, y - ny * w * z * 0.45);
                ctx.lineTo(x + nx * w * z * 0.45, y + ny * w * z * 0.45);
              }
            }
            ctx.stroke();
          }
        }
        run = [];
      };
      for (const p of sideRun(sx)) {
        if (p.vis) run.push(p.q);
        else flush();
      }
      flush();
    }
    // a coroa (o pingente), deitada no peito
    const n = norm(dirIn(ch, 0, 1, 0.12));
    const f = R.facing(n);
    if (f < 0.05) return;
    const right = ch.r;
    const up = norm(cross(n, right));
    const c = add(pend, scale(up, -2.3));
    const pts = CROWN.map(([u, v]) => add(add(c, scale(right, u * 2.7)), scale(up, v * 2.35)));
    const path = flatPath(R, pts);
    ctx.globalAlpha = smoothstep(0.05, 0.3, f);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = Math.max(1.8, R.inkIn * 2.2);
    ctx.stroke(path);
    ctx.fillStyle = PAL.metal.base;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = PAL.metal.light;
    ctx.translate(R.light.x * 0.9 * z, R.light.y * 0.9 * z);
    ctx.globalAlpha *= 0.8;
    ctx.fill(path);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ utilidades dos membros
  /** Anel de esferinhas em volta de um osso (em t, com raio `rad`): o casco de dois anéis é um tubo de boca reta. */
  const ringOn = (R, lf, t, rad, n, r, off = 0) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const th = (k / n) * M.TAU;
      out.push(R.circle(limbAt(lf, t, Math.cos(th) * rad, Math.sin(th) * rad + off), r));
    }
    return out;
  };
  /** O ângulo em volta do osso que olha para a câmera (o meio da metade visível). */
  const facingAngle = (R, lf) => Math.atan2(dot(R.toCam, lf.out), dot(R.toCam, lf.f));
  /** Ponto na superfície de um tubo em volta do osso: fração t, ângulo th (0 = frente, π/2 = fora), raio. */
  const tubeAt = (lf, t, th, rad, off = 0) => limbAt(lf, t, Math.cos(th) * rad, Math.sin(th) * rad + off);
  /** Linha em volta do osso (de th0 a th1), só na metade que a câmera vê; devolve os trechos de pontos na tela. */
  function arcRuns(R, lf, t, rad, th0, th1, off = 0, steps = 18) {
    const tc = facingAngle(R, lf);
    const runs = [];
    let cur = null;
    for (let k = 0; k <= steps; k++) {
      const th = th0 + ((th1 - th0) * k) / steps;
      if (Math.cos(th - tc) < 0.03) {
        cur = null;
        continue;
      }
      if (!cur) runs.push((cur = []));
      cur.push(R.P(tubeAt(lf, typeof t === 'function' ? t(th) : t, th, rad, off)));
    }
    return runs.filter((r) => r.length > 1);
  }
  const strokeRuns = (R, runs, color, width, alpha = 1) => {
    const ctx = R.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, width * R.zoom);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;
    for (const run of runs) ctx.stroke(S.smoothLinePath(run));
    ctx.globalAlpha = 1;
  };
  /** Faixa em volta do osso entre t0 e t1 (a metade visível), preenchida: a pulseira do relógio. */
  function bandOn(R, lf, t0, t1, rad, color) {
    const tc = facingAngle(R, lf);
    const a = [], b = [];
    for (let k = 0; k <= 14; k++) {
      const th = tc - Math.PI / 2 + (Math.PI * k) / 14;
      a.push(R.P(tubeAt(lf, t0, th, rad)));
      b.push(R.P(tubeAt(lf, t1, th, rad)));
    }
    const path = new Path2D();
    path.moveTo(a[0].x, a[0].y);
    for (const q of a) path.lineTo(q.x, q.y);
    for (let k = b.length - 1; k >= 0; k--) path.lineTo(b[k].x, b[k].y);
    path.closePath();
    R.ctx.fillStyle = color;
    R.ctx.fill(path);
    return path;
  }
  /** O raio da pele num ponto do osso (a esfera mais de fora naquela direção): para pintar rente à pele. */
  function skinRadius(spheres, len, s, th) {
    const c = Math.cos(th), sn = Math.sin(th);
    let best = -1;
    for (const sp of spheres) {
      const b = sp.f * c + sp.o * sn;
      const c0 = (s - sp.t * len) * (s - sp.t * len) + sp.f * sp.f + sp.o * sp.o - sp.r * sp.r;
      const disc = b * b - c0;
      if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
    }
    return best;
  }
  function skinAt(spheres, len, s, th) {
    let r = skinRadius(spheres, len, s, th);
    if (r > 0) return r;
    // entre duas esferas o casco liga uma na outra: vai pela média das vizinhas
    let a = -1, b = -1;
    for (let d = 1; d < 14 && (a < 0 || b < 0); d++) {
      if (a < 0) a = skinRadius(spheres, len, s - d, th);
      if (b < 0) b = skinRadius(spheres, len, s + d, th);
    }
    return a > 0 && b > 0 ? (a + b) / 2 : Math.max(a, b, 3);
  }

  // ------------------------------------------------------------------ tatuagem (braço esquerdo, do ombro ao punho)
  // Desenho tribal: "lâminas" (riscos grossos que afinam nas pontas) e espirais, marcados na pele desenrolada do braço:
  // cada ponto é [cm ao longo do osso, graus em volta dele] (0° = frente do braço, 90° = lado de fora, 180° = trás).
  const spiral = (s, deg, r0, turns, dir, w, rMean, a0 = 0) => {
    const pts = [];
    const n = Math.round(26 * turns);
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const ang = a0 + dir * turns * M.TAU * u;
      const rad = r0 * (1 - 0.86 * u);
      pts.push([s + rad * Math.cos(ang), deg + ((rad * Math.sin(ang)) / rMean) * (180 / Math.PI)]);
    }
    return { pts, w, tail: 0.25 };
  };
  const TATTOO = {
    braco: [
      spiral(6.8, 96, 5.9, 1.6, 1, 2.1, 7, 2.6),
      { pts: [[1.5, 36], [5.5, 18], [10.5, 30], [14, 58], [15.5, 84]], w: 2.1 },
      spiral(18.6, 86, 4.8, 1.4, -1, 1.9, 6, 0.4),
      { pts: [[2.5, 156], [7.5, 180], [12.5, 158], [16.5, 132], [18.5, 116]], w: 2 },
      { pts: [[19.5, 22], [23, 44], [26.5, 58], [28.8, 50]], w: 1.7 },
      { pts: [[21, 142], [24.5, 120], [28.4, 108]], w: 1.7 },
      { pts: [[9.5, 244], [14, 280], [19, 262], [23.5, 238]], w: 1.5 },
      { pts: [[11.5, 8], [15.5, -12], [20.5, -6], [24, 12]], w: 1.6 },
      { pts: [[0.8, 96], [2, 132], [5, 152], [8.5, 138]], w: 1.6 },
      { pts: [[24, 204], [27, 184], [29.2, 158]], w: 1.4 },
      { pts: [[11.5, 196], [15, 214], [19.5, 204], [22.5, 180]], w: 1.5 },
      { pts: [[1.2, 50], [3.2, 74], [2.6, 100]], w: 1.4 },
    ],
    antebraco: [
      spiral(6.4, 88, 4, 1.45, 1, 1.7, 4.9, 1.2),
      { pts: [[1.2, 24], [5.5, 0], [10.5, 20], [14.5, 56]], w: 1.6 },
      { pts: [[11.5, 114], [15.5, 134], [19.5, 104], [21.4, 82]], w: 1.5 },
      { pts: [[2.2, 170], [7.5, 194], [12.5, 166], [15, 146]], w: 1.5 },
      { pts: [[14, 206], [17.5, 218], [20.8, 190]], w: 1.3 },
      { pts: [[15.5, 10], [19, -12], [21.6, -2]], w: 1.3 },
      { pts: [[2.6, 284], [8, 308], [13.5, 286], [17.5, 262]], w: 1.3 },
      { pts: [[11, 58], [14.5, 78], [18.5, 60], [21, 36]], w: 1.2 },
    ],
  };
  /** Chamas em hélice em volta do braço: riscos em S, inclinados, um depois do outro; `skip(s, graus)` deixa um vão. */
  function flames(len, rows, step, w, skip) {
    const out = [];
    for (let k = 0; k < rows; k++) {
      const base = (k * 360) / rows;
      for (let j = 0, s = 1.6 + (k % 2) * (step / 2); s + step * 0.8 < len; j++, s += step) {
        const d = base + j * 31;
        const dir = (k + j) % 2 ? 1 : -1;
        const pts = [[s, d], [s + step * 0.3, d + dir * 16], [s + step * 0.62, d + dir * 4], [s + step * 0.86, d - dir * 15]];
        const mid = pts[1];
        if (skip && skip(mid[0], ((mid[1] % 360) + 360) % 360)) continue;
        out.push({ pts, w });
      }
    }
    return out;
  }
  TATTOO.braco.push(...flames(30, 7, 7.4, 1.25, (s, d) => (s < 13.5 && d > 40 && d < 165) || (s > 12.5 && s < 24 && d > 40 && d < 130)));
  TATTOO.antebraco.push(...flames(23, 6, 6.6, 1.05, (s, d) => s < 11 && d > 35 && d < 140));

  function tattoo(R, lf, spheres, blades) {
    const ctx = R.ctx;
    const len = lf.len;
    const path = new Path2D();
    for (const bl of blades) {
      // a linha do meio amaciada (pontos a cada ~0,7 cm) e as duas bordas, mais largas no meio
      const mid = [];
      for (let i = 0; i + 1 < bl.pts.length; i++) {
        const p0 = bl.pts[Math.max(0, i - 1)], p1 = bl.pts[i], p2 = bl.pts[i + 1], p3 = bl.pts[Math.min(bl.pts.length - 1, i + 2)];
        const n = bl.tail ? 1 : 6;
        for (let k = 0; k < n; k++) {
          const t = k / n, t2 = t * t, t3 = t2 * t;
          mid.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
        }
      }
      mid.push(bl.pts[bl.pts.length - 1]);
      const N = mid.length - 1;
      const edge = [];
      for (let i = 0; i <= N; i++) {
        const [s, deg] = mid[i];
        const th = deg * M.DEG;
        const rad = skinAt(spheres, len, s, th) + 0.06;
        const a = mid[Math.max(0, i - 1)], b = mid[Math.min(N, i + 1)];
        // direção da linha na pele desenrolada (cm ao longo, cm em volta) e a largura (a espiral afina para o miolo)
        let ds = b[0] - a[0], dv = (b[1] - a[1]) * M.DEG * rad;
        const l = Math.hypot(ds, dv) || 1;
        ds /= l;
        dv /= l;
        const u = i / N;
        const hw = bl.w * (bl.tail ? Math.pow(Math.sin(Math.PI * Math.min(1, u * 2.4 + 0.02)), 0.6) * (1 - 0.72 * u) : Math.pow(Math.sin(Math.PI * u), 0.55));
        const pt = (k) => {
          const s2 = s - dv * hw * k, th2 = th + ((ds * hw * k) / rad);
          return { p: R.P(tubeAt(lf, s2 / len, th2, skinAt(spheres, len, s2, th2) + 0.06)), th: th2 };
        };
        edge.push({ l: pt(1), r: pt(-1), th });
      }
      const tc = facingAngle(R, lf);
      for (let i = 0; i < N; i++) {
        if (Math.cos((edge[i].th + edge[i + 1].th) / 2 - tc) < 0.04) continue; // do lado de lá do braço
        const A = edge[i], B = edge[i + 1];
        path.moveTo(A.l.p.x, A.l.p.y);
        path.lineTo(B.l.p.x, B.l.p.y);
        path.lineTo(B.r.p.x, B.r.p.y);
        path.lineTo(A.r.p.x, A.r.p.y);
        path.closePath();
      }
    }
    ctx.fillStyle = R.pal.tattoo;
    ctx.fill(path);
  }
  function limbDetail(R, rig, i, part) {
    if (i !== 0) return; // só o braço esquerdo
    if (part === 'deltoide' || part === 'braco') tattoo(R, rig.upperArm[0], MODEL.UPPER_ARM, TATTOO.braco);
    else if (part === 'antebraco') tattoo(R, rig.forearm[0], MODEL.FOREARM, TATTOO.antebraco);
  }

  // ------------------------------------------------------------------ bermuda cargo e relógio (presos ao corpo)
  // a bermuda na pelve: a cintura baixa (um anel), o quadril largo e o fundo; e em cada perna um tubo que dobra no joelho
  const SHORTS = {
    waist: { z: 10.2, rx: 13, ry: 10.9, cy: 0.9 },
    mid: { z: 3.5, rx: 16.6, ry: 13, cy: 0.2 },
    hip: { z: -3, rx: 16.4, ry: 13.4, cy: -0.4 },
    low: { z: -20, rx: 9, ry: 11.8, cy: -0.6 },
    leg: { top: -0.16, topR: 10.4, off: 0.3, kneeR: 11.3, hem: 0.18, hemR: 11.4 }, // a barra fica ~7 cm abaixo do joelho (0,18 da canela)
    pocket: { c: 1.28, w: 0.56, t0: 0.6, t1: 1.02, out: 1.5 }, // bolso cargo: no lado de fora da coxa, um pouco para a frente
  };
  const pelvisRing = (pv, g, phi, grow = 0, dz = 0) => at(pv, (g.rx + grow) * Math.sin(phi), g.cy + (g.ry + grow) * Math.cos(phi), g.z + dz);
  /** O anel da bermuda numa altura z da pelve (entre a cintura, o quadril e o fundo). */
  const shortsRingAt = (zz) => {
    const G = SHORTS;
    const [a, b] = zz >= G.mid.z ? [G.mid, G.waist] : zz >= G.hip.z ? [G.hip, G.mid] : [G.low, G.hip];
    const t = clamp01((zz - a.z) / (b.z - a.z));
    return { z: zz, rx: a.rx + (b.rx - a.rx) * t, ry: a.ry + (b.ry - a.ry) * t, cy: a.cy + (b.cy - a.cy) * t };
  };
  const shortsNormal = (pv, phi, zz) => {
    const g = shortsRingAt(zz);
    return norm(dirIn(pv, Math.sin(phi) / g.rx, Math.cos(phi) / g.ry, 0));
  };
  /** Ponto na bermuda (na pelve): direção phi (0 = frente, π = trás) e altura z; `grow` afasta do pano. */
  const shortsAt = (pv, phi, zz, grow = 0.6) => pelvisRing(pv, shortsRingAt(zz), phi, grow);
  /** Linha na bermuda por pontos [phi, z]: só o trecho que a câmera vê. */
  function shortsLine(R, pv, pts, grow = 0.6) {
    const runs = [];
    let cur = null;
    for (const [phi, zz] of pts) {
      if (R.facing(shortsNormal(pv, phi, zz)) < 0.03) {
        cur = null;
        continue;
      }
      if (!cur) runs.push((cur = []));
      cur.push(R.P(shortsAt(pv, phi, zz, grow)));
    }
    return runs.filter((r) => r.length > 1);
  }
  const around = (zz, phi0 = 0, phi1 = M.TAU, n = 36) => {
    const pts = [];
    for (let k = 0; k <= n; k++) pts.push([phi0 + ((phi1 - phi0) * k) / n, zz]);
    return pts;
  };

  function wear(R, rig, look, items, gear) {
    const out = [];
    const PAL = R.pal;
    const hostOf = (name, group) => items.find((b) => b.name === name && b.group === group) || items.find((b) => b.group === group);
    const keyAfter = (host, k) => (host ? host.key : R.keyOf(rig.pelvis.o)) + 0.05 + 0.01 * k;
    const off = look.semPecas || {};

    if (!gear.pernas && !off.bermuda) {
      const G = SHORTS;
      const pv = rig.pelvis;
      // ---- as duas pernas da bermuda (cada uma depois da perna dela)
      for (let i = 0; i < 2; i++) {
        const th = rig.thigh[i], sh = rig.shin[i];
        const L = G.leg;
        const top = ringOn(R, th, L.top, L.topR, 10, 0.9, L.off);
        const knee = ringOn(R, th, 1, L.kneeR, 10, 0.9, 0.3);
        const hem = ringOn(R, sh, L.hem, L.hemR, 10, 0.9, 0.3);
        const host = hostOf('coxa', 'perna' + i);
        let segs;
        if (dot(th.a, sh.a) > 0.94) {
          segs = [{ poly: R.hull(top.concat(knee, hem)), circles: R._last, mat: PAL.denim, k: 0.26, decal: () => { shortsLeg(R, rig, i, 'coxa'); shortsLeg(R, rig, i, 'barra'); } }];
        } else {
          const upper = { poly: R.hull(top.concat(knee)), circles: R._last, mat: PAL.denim, k: 0.26, decal: () => shortsLeg(R, rig, i, 'coxa') };
          const lower = { poly: R.hull(knee.concat(hem)), circles: R._last, mat: PAL.denim, k: 0.26, noInner: true, decal: () => shortsLeg(R, rig, i, 'barra') };
          segs = [upper, lower];
        }
        out.push({ name: 'bermudaPerna', key: keyAfter(host, i), host, group: 'bermudaPerna' + i, chain: true, segs });
        // o bolso cargo: uma caixa de pano por fora da coxa (aparece no contorno da perna), só do lado que a câmera vê
        const P = SHORTS.pocket;
        if (Math.cos(P.c - facingAngle(R, th)) > -0.25) {
          const rr = (t) => L.topR + (L.kneeR - L.topR) * t + P.out;
          const corner = (t, a) => R.circle(tubeAt(th, t, a, rr(t), L.off * (1 - t * 0.7)), 1.25);
          const cs = [corner(P.t0, P.c - P.w), corner(P.t0, P.c), corner(P.t0, P.c + P.w), corner(P.t1, P.c + P.w), corner(P.t1, P.c), corner(P.t1, P.c - P.w)];
          out.push({ name: 'bolsoCargo', key: keyAfter(host, i + 0.5), host, group: 'bolsoCargo' + i, segs: [{ poly: R.hull(cs), circles: R._last, mat: PAL.denim, k: 0.24, decal: () => cargoPocket(R, rig, i) }] });
        }
      }
      // ---- a parte da pelve (por cima das pernas da bermuda e da barriga de baixo)
      const ring = (g, n) => {
        const cs = [];
        for (let k = 0; k < n; k++) cs.push(R.circle(pelvisRing(pv, g, (k / n) * M.TAU), 1));
        return cs;
      };
      const host = hostOf('pelve', 'tronco');
      out.push({ name: 'bermuda', key: keyAfter(host, 3), host, group: 'bermuda', segs: [{ poly: R.hull(ring(G.waist, 12).concat(ring(G.mid, 12), ring(G.hip, 12), ring(G.low, 10))), circles: R._last, mat: PAL.denim, k: 0, noThin: true, decal: () => shortsTop(R, rig) }] });
    }

    // ---- relógio no punho esquerdo: a pulseira (um anel em volta do punho) e a caixa, do lado das costas da mão
    if (!off.relogio) {
      const fa = rig.forearm[0], hd = rig.hand[0];
      const rad = skinAt(MODEL.FOREARM, fa.len, fa.len * 0.9, Math.PI / 2);
      const host = hostOf('antebraco', 'braco0');
      const band = ringOn(R, fa, 0.84, rad + 0.1, 8, 0.55).concat(ringOn(R, fa, 0.955, rad - 0.15, 8, 0.55));
      const segs = [{ poly: R.hull(band), circles: R._last, mat: PAL.watch, k: 0.22 }];
      if (R.facing(hd.d) > -0.15) {
        const c = add(limbAt(fa, 0.9, 0, 0), scale(hd.d, rad + 0.6));
        const side = norm(cross(fa.a, hd.d));
        const corner = (u, v) => R.circle(add(add(c, scale(fa.a, u * 1.75)), scale(side, v * 1.75)), 0.9);
        segs.push({
          poly: R.hull([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]), circles: R._last, mat: PAL.watch, k: 0.3, noInner: true,
          decal: () => {
            // o mostrador
            const o = add(c, scale(hd.d, 0.9));
            const q = R.P(o), u = R.P(add(o, scale(fa.a, 1.6))), v = R.P(add(o, scale(side, 1.6)));
            const ctx = R.ctx;
            ctx.fillStyle = PAL.watch.light;
            ctx.beginPath();
            ctx.ellipse(q.x, q.y, Math.max(0.6, Math.hypot(u.x - q.x, u.y - q.y)), Math.max(0.5, Math.hypot(v.x - q.x, v.y - q.y)), Math.atan2(u.y - q.y, u.x - q.x), 0, M.TAU);
            ctx.fill();
            ctx.strokeStyle = PAL.metal.base;
            ctx.lineCap = 'round';
            ctx.lineWidth = Math.max(0.5, 0.2 * R.zoom);
            ctx.beginPath();
            ctx.moveTo(q.x, q.y);
            ctx.lineTo((q.x + u.x) / 2, (q.y + u.y) / 2);
            ctx.moveTo(q.x, q.y);
            ctx.lineTo(q.x + (v.x - q.x) * 0.7, q.y + (v.y - q.y) * 0.7);
            ctx.stroke();
          },
        });
      }
      out.push({ name: 'relogio', key: keyAfter(host, 5), host, group: 'relogio', chain: true, segs });
    }

    // ---- as tiras dos chinelos, por cima de cada pé
    if (!gear.pes && !off.chinelos) {
      for (let i = 0; i < 2; i++) {
        const host = hostOf('pe', 'perna' + i);
        out.push({ name: 'tiraChinelo', key: keyAfter(host, 8 + i), host, draw: () => sandalStraps(R, rig, i) });
      }
    }
    return out;
  }

  /** Detalhes de uma perna da bermuda: costura laranja do lado, barra pespontada e a coroa estampada (perna direita). */
  function shortsLeg(R, rig, i, part) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const th = rig.thigh[i], sh = rig.shin[i];
    const L = SHORTS.leg;
    const z = R.zoom;
    const seam = Math.PI / 2 - 0.62; // a costura do lado, puxada para a frente
    if (part === 'coxa') {
      const rAt = (t) => L.topR + (L.kneeR - L.topR) * t + 0.15;
      const tc = facingAngle(R, th);
      if (Math.cos(seam - tc) > 0.05) {
        const pts = [];
        for (let k = 0; k <= 8; k++) pts.push(R.P(tubeAt(th, L.top + (1 - L.top) * (k / 8), seam, rAt(k / 8), L.off)));
        strokeRuns(R, [pts], PAL.stitch, 0.24, 0.9);
      }
      // a coroa estampada na perna direita, na frente, na parte de baixo da coxa
      if (i === 1) {
        const c = 0.08, tcen = 0.78, w = 0.5, h = 0.15; // meia largura em radianos em volta e meia altura em fração da coxa
        if (Math.cos(c - tc) > 0.12) {
          const path = new Path2D();
          CROWN.forEach(([u, v], k) => {
            const q = R.P(tubeAt(th, tcen - v * h, c + u * w, rAt(tcen) + 0.1, L.off * 0.4));
            if (k) path.lineTo(q.x, q.y);
            else path.moveTo(q.x, q.y);
          });
          path.closePath();
          ctx.globalAlpha = smoothstep(0.12, 0.4, Math.cos(c - tc)) * 0.95;
          ctx.strokeStyle = PAL.print;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(1, 0.85 * z);
          ctx.stroke(path);
          ctx.globalAlpha = 1;
        }
      }
      return;
    }
    // a parte de baixo: a costura continua até a barra, e dois pespontos laranja em volta dela
    const hemR = L.hemR + 0.2;
    const tc = facingAngle(R, sh);
    if (Math.cos(seam - tc) > 0.05) strokeRuns(R, [[R.P(tubeAt(sh, 0, seam, L.kneeR + 0.15, 0.3)), R.P(tubeAt(sh, L.hem, seam, hemR, 0.3))]], PAL.stitch, 0.24, 0.9);
    strokeRuns(R, arcRuns(R, sh, L.hem - 0.04, hemR, 0, M.TAU, 0.3, 30), PAL.stitch, 0.22, 0.95);
    strokeRuns(R, arcRuns(R, sh, L.hem - 0.075, hemR, 0, M.TAU, 0.3, 30), PAL.stitch, 0.22, 0.95);
  }

  /** O bolso cargo (em cima da caixa dele): a aba com a linha, o pesponto laranja e os dois rebites. */
  function cargoPocket(R, rig, i) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const th = rig.thigh[i];
    const L = SHORTS.leg, P = SHORTS.pocket;
    const z = R.zoom;
    const rr = (t) => L.topR + (L.kneeR - L.topR) * t + P.out + 1.3;
    const pt = (t, a) => R.P(tubeAt(th, t, a, rr(t), L.off * (1 - t * 0.7)));
    const row = (t, inset = 0, n = 6) => { const q = []; for (let k = 0; k <= n; k++) q.push(pt(t, P.c - P.w + inset + ((P.w - inset) * 2 * k) / n)); return q; };
    const flap = P.t0 + (P.t1 - P.t0) * 0.34;
    // a aba: mais clara, com a linha escura embaixo
    const top = row(P.t0 - 0.03), mid = row(flap);
    const fl = new Path2D();
    fl.moveTo(top[0].x, top[0].y);
    for (const q of top) fl.lineTo(q.x, q.y);
    for (let k = mid.length - 1; k >= 0; k--) fl.lineTo(mid[k].x, mid[k].y);
    fl.closePath();
    ctx.fillStyle = M.mix(PAL.denim.base, PAL.denim.light, 0.75);
    ctx.fill(fl);
    strokeRuns(R, [mid], PAL.denim.shade, 0.4, 1);
    // pesponto laranja: embaixo da aba e em volta do bolso
    strokeRuns(R, [row(flap - 0.035, 0.07)], PAL.stitch, 0.2, 0.95);
    strokeRuns(R, [[pt(flap + 0.03, P.c - P.w + 0.08), pt(P.t1 - 0.035, P.c - P.w + 0.08)].concat(row(P.t1 - 0.035, 0.08), [pt(flap + 0.03, P.c + P.w - 0.08)])], PAL.stitch, 0.2, 0.9);
    // rebites nos cantos da aba
    ctx.fillStyle = PAL.rivet;
    for (const a of [P.c - P.w + 0.13, P.c + P.w - 0.13]) {
      const q = pt(flap - 0.075, a);
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(0.8, 0.5 * z), 0, M.TAU);
      ctx.fill();
    }
  }

  /** Detalhes da bermuda na pelve: cós com passantes e botão, braguilha, bocas dos bolsos e os bolsos de trás. */
  function shortsTop(R, rig) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const pv = rig.pelvis;
    const W = SHORTS.waist.z;
    const z = R.zoom;
    // a linha de cima da bermuda (a peça não tem o contorno fino: ele riscaria a emenda com as pernas)
    strokeRuns(R, shortsLine(R, pv, around(W + 0.9), 0.95), PAL.ink, (R.inkIn * 1.7) / z, 1);
    // o cós: uma linha escura embaixo dele e o pesponto
    strokeRuns(R, shortsLine(R, pv, around(W - 3.3)), PAL.denim.shade, 0.45, 0.95);
    strokeRuns(R, shortsLine(R, pv, around(W - 2.5)), PAL.stitch, 0.2, 0.9);
    // passantes
    ctx.lineCap = 'round';
    for (const phi of [0.62, -0.62, 1.75, -1.75, Math.PI]) {
      if (R.facing(shortsNormal(pv, phi, W)) < 0.4) continue;
      const a = R.P(shortsAt(pv, phi, W + 0.6, 0.7)), b = R.P(shortsAt(pv, phi, W - 3.6, 1));
      ctx.strokeStyle = PAL.denim.shade;
      ctx.lineWidth = Math.max(1.4, 1.5 * z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = PAL.denim.light;
      ctx.lineWidth = Math.max(0.8, 0.9 * z);
      ctx.stroke();
    }
    if (R.facing(shortsNormal(pv, 0, W)) > 0.1) {
      // botão
      const q = R.P(shortsAt(pv, 0, W - 1.5, 1));
      ctx.fillStyle = PAL.ink;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(1.1, 0.95 * z), 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = PAL.metal.base;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(0.7, 0.62 * z), 0, M.TAU);
      ctx.fill();
    }
    // braguilha: a costura do meio e o pesponto em curva
    strokeRuns(R, shortsLine(R, pv, [[0, W - 3.4], [0, 0], [0, -8], [0, -17]], 0.7), PAL.denim.shade, 0.32, 0.9);
    strokeRuns(R, shortsLine(R, pv, [[0.17, W - 3.6], [0.2, 0.5], [0.15, -5], [0.03, -8.6]], 0.7), PAL.stitch, 0.2, 0.85);
    // bocas dos bolsos da frente (um arco laranja de cada lado)
    for (const sx of [-1, 1]) strokeRuns(R, shortsLine(R, pv, [[sx * 0.5, W - 3.4], [sx * 0.76, W - 5.4], [sx * 1.02, W - 9.4], [sx * 1.2, W - 14.5]], 0.7), PAL.stitch, 0.22, 0.9);
    // bolsos de trás
    for (const sx of [-1, 1]) {
      const c = Math.PI + sx * 0.6;
      if (R.facing(shortsNormal(pv, c, -2)) < 0.12) continue;
      const pt = (dphi, zz) => R.P(shortsAt(pv, c + dphi, zz, 0.7));
      const pts = [pt(-0.34, 3.6), pt(0.34, 3.6), pt(0.34, -5.4), pt(0, -7.6), pt(-0.34, -5.4)];
      const path = new Path2D();
      pts.forEach((q, k) => (k ? path.lineTo(q.x, q.y) : path.moveTo(q.x, q.y)));
      path.closePath();
      ctx.lineJoin = 'round';
      ctx.fillStyle = M.mix(PAL.denim.base, PAL.denim.light, 0.4);
      ctx.fill(path);
      ctx.strokeStyle = PAL.denim.shade;
      ctx.lineWidth = Math.max(0.8, 0.45 * z);
      ctx.stroke(path);
      ctx.strokeStyle = PAL.stitch;
      ctx.lineWidth = Math.max(0.5, 0.2 * z);
      ctx.globalAlpha = 0.9;
      const s2 = [pt(-0.27, 2.5), pt(0.27, 2.5), pt(0.27, -4.9), pt(0, -6.6), pt(-0.27, -4.9)];
      ctx.beginPath();
      s2.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ chinelos
  // a sola: um pouco maior que o pé, rente ao chão (o pé é pintado por cima; sobra a beirada dela em volta)
  const SOLE = [[0, -7.4], [3.6, -5.6], [4.9, -1], [5.3, 5], [5.6, 10.6], [4.6, 15.6], [1.6, 18.2], [-2.4, 17.4], [-5.2, 13.6], [-5.9, 8], [-5.3, 2], [-4.2, -4.6]];
  const soleSphere = (R, rig, i, s, f, u, r) => {
    const side = i === 0 ? -1 : 1;
    const B = PD.BODY;
    const toe = rig.toe && rig.toe[i];
    // à frente da base dos dedos a sola dobra junto com os dedos (igual ao pé)
    if (toe && f > B.ballFwd + 1) return R.circle(at(toe, -side * s, f - B.ballFwd, u + B.ankleHeight), r);
    return R.circle(at(rig.foot[i], -side * s, f, u), r);
  };
  /** A sola de um pé, como peça própria: entra na ordem logo antes da perna (o pé cobre o miolo; sobra a beirada). */
  function soleItem(R, rig, i, items) {
    const u = -PD.BODY.ankleHeight + 0.75;
    const leg = items.find((it) => it.name === 'coxa' && it.group === 'perna' + i);
    const foot = items.find((it) => it.name === 'pe' && it.group === 'perna' + i);
    const key = Math.min(leg ? leg.key : Infinity, foot ? foot.key : Infinity) - 0.03;
    return { name: 'sola', key, group: 'sola' + i, segs: [{ poly: R.hull(SOLE.map(([s, f]) => soleSphere(R, rig, i, s, f, u, 0.75))), circles: R._last, mat: R.pal.sandal, k: 0.2 }] };
  }
  function sandalStraps(R, rig, i) {
    const side = i === 0 ? -1 : 1;
    const B = PD.BODY;
    const ft = rig.foot[i];
    const toe = rig.toe[i];
    const fp = (s, f, u) => (f > B.ballFwd + 1 ? at(toe, -side * s, f - B.ballFwd, u + B.ankleHeight) : at(ft, -side * s, f, u));
    // a tira em Y: sai do vão do dedão, sobe pelo peito do pé e desce para os dois lados da sola
    const post = fp(1.35, 11.6, -3.4);
    const topIn = fp(1.6, 8.4, -1.2), topOut = fp(-0.6, 8.2, -1.5);
    const cam = R.toCam;
    const sideVec = scale(ft.r, -side); // para o lado de dentro do pé
    const seeIn = dot(sideVec, cam) > -0.35, seeOut = dot(sideVec, cam) < 0.35;
    if (seeIn) cord(R, [post, topIn, fp(3.6, 4.6, -1.9), fp(4.7, 1.4, -5)], 1.5, R.pal.sandal.base, R.pal.ink, 0.6);
    if (seeOut) cord(R, [post, topOut, fp(-3.3, 4.4, -2.9), fp(-4.9, 1.6, -5.2)], 1.5, R.pal.sandal.base, R.pal.ink, 0.6);
  }

  /** O olho de perfil (o desenho do olho de frente some quando a cabeça está de lado): um triângulo com a íris na frente. */
  function sideEye(R, rig, head, sx, look) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const hs = R.hs;
    const c = at(head, sx * 5.9, 12.2, MODEL.HEAD.eye.z + 0.1);
    const F = rig.head.f, U = rig.head.u;
    const pt = (a, b) => R.P(add(add(c, scale(F, a * hs)), scale(U, b * hs)));
    const blink = clamp01(look.blink || 0);
    const h = 1.5 * (1 - blink * 0.9);
    const a = pt(2.5, 0), b = pt(-2.2, h), d = pt(-2.4, -h * 0.8);
    if (blink < 0.85) {
      const eye = new Path2D();
      eye.moveTo(a.x, a.y);
      eye.lineTo(b.x, b.y);
      eye.lineTo(d.x, d.y);
      eye.closePath();
      ctx.fillStyle = PAL.eyeWhite;
      ctx.fill(eye);
      ctx.save();
      ctx.clip(eye);
      const ic = pt(1.1, 0);
      const ir = pt(1.1, 1.6);
      ctx.fillStyle = PAL.iris;
      ctx.beginPath();
      ctx.ellipse(ic.x, ic.y, Math.max(0.5, Math.hypot(ir.x - ic.x, ir.y - ic.y) * 0.62), Math.max(0.5, Math.hypot(ir.x - ic.x, ir.y - ic.y)), 0, 0, M.TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = PAL.ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, MODEL.HEAD.eye.lid * 1.1 * R.zoom);
    ctx.beginPath();
    const tail = pt(-3.3, h + 0.3);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(tail.x, tail.y);
    ctx.stroke();
    // sobrancelha: grossa, descendo para o nariz
    const raise = (look.browRaise || 0) * 0.8;
    const b0 = pt(3.7, 2.5 + raise), b1 = pt(0.3, 3.7 + raise), b2 = pt(-3.3, 3.3 + raise);
    ctx.strokeStyle = '#1c1416';
    ctx.lineWidth = Math.max(1.4, 1.7 * hs * R.zoom);
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.quadraticCurveTo(b1.x, b1.y, b2.x, b2.y);
    ctx.stroke();
  }

  /** Sem a bermuda (o corpo-base das fichas): uma sunga escura pintada na pelve. */
  function pelvisDetail(R, seg, rig, look) {
    const off = look.semPecas || {};
    if (!off.bermuda && !(R.equipped || {}).pernas) return; // com a bermuda por cima, não aparece
    const ctx = R.ctx;
    ctx.fillStyle = R.pal.denim.base;
    ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
    // a pele volta acima do elástico (a barriga de baixo) — a linha fica na altura do cós da bermuda
    const pv = rig.pelvis;
    const top = [];
    for (let k = 0; k <= 30; k++) {
      const phi = (k / 30) * M.TAU;
      top.push(R.P(pelvisRing(pv, { z: 6.6, rx: 30, ry: 30, cy: 0 }, phi)));
    }
    const up = R.P(at(pv, 0, 0, 60));
    const c = R.P(at(pv, 0, 0, 6.6));
    const band = new Path2D();
    top.forEach((q, k) => (k ? band.lineTo(q.x, q.y) : band.moveTo(q.x, q.y)));
    band.closePath();
    const skin = new Path2D(band);
    for (const q of top) skin.rect(q.x - 1, q.y - 1, 0, 0);
    // tudo o que fica acima do plano do elástico (o disco do elástico arrastado para cima)
    ctx.fillStyle = R.pal.skin.base;
    const sweep = new Path2D();
    top.forEach((q, k) => (k ? sweep.lineTo(q.x, q.y) : sweep.moveTo(q.x, q.y)));
    sweep.closePath();
    for (let k = 0; k < top.length; k++) {
      const a = top[k], b = top[(k + 1) % top.length];
      sweep.moveTo(a.x, a.y);
      sweep.lineTo(b.x, b.y);
      sweep.lineTo(b.x + (up.x - c.x), b.y + (up.y - c.y));
      sweep.lineTo(a.x + (up.x - c.x), a.y + (up.y - c.y));
      sweep.closePath();
    }
    ctx.fill(sweep, 'nonzero');
    void skin;
  }

  Object.assign(MODEL, { face, chestDetail, pelvisDetail, extras, limbDetail, wear });

  // ------------------------------------------------------------------ registro
  PD.models = PD.models || {};
  PD.models.birim = { id: 'birim', nome: 'Birim', PALETTE, MODEL, CAP };
  /** A aparência de um modelo, para o desenho: { paleta, modelo }. Sem modelo (ou 'heroi'): null (o herói de sempre). */
  PD.models.appearance = (id) => {
    const m = id && PD.models[id];
    return m && m.MODEL ? { paleta: m.PALETTE, modelo: m.MODEL, id: m.id } : null;
  };
})(window.PD = window.PD || {});
