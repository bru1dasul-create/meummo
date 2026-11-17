// Pindorama 2.5D — o CHÃO PINTADO dos mapas do mundo novo (pedido do dono, 17/11: "chão feio"; o alvo aprovado é
// docs/referencias/chao-pintado-alvo.jpg). Antes o chão era uma cor lisa com bolinhas iguais e a trilha tinha um
// contorno escuro, com cara de adesivo. Aqui ficam:
//   PD.chao.natural(tipo)                 → este material é pintado por aqui? (grama, mata, terra, trilha, lama, areia)
//   PD.chao.paintOf(tipo, cor)            → a TINTA do material: a cor de base já com as manchas claras e escuras, como
//                                           aquarela (um padrão de preencher; onde não há tela de verdade, só a cor)
//   PD.chao.marks(ctx, forma, caixa, semente, chão) → folhas, tufos de capim, florzinhas, pedrinhas (no lugar das bolinhas)
//   PD.chao.area(ctx, forma, n, env)      → preenche uma área (a grama da clareira) com a beirada se desmanchando no que
//                                           está em volta: névoa de cor, aguada e a tinta firme de beirada ondulada
//   PD.chao.edgeOver                      → por cima da beirada da área: tufos de capim e pinceladas soltas
//   PD.chao.trailsUnder / trail           → a trilha: sem contorno, beirada ondulada, marcas de uso, tufos e pedrinhas
//   PD.chao.seam(ctx, forma, n, env)      → a emenda da calçada, do asfalto, da praça e do círculo com a terra e o capim
//   PD.chao.covers(forma, caixa)          → esta forma tapa o pedaço inteiro? (o que vem antes dela nem é pintado)
// Tudo é desenhado em cm do chão (o pedaço já está na projeção do chão) e sai igual em qualquer pedaço da tela e em
// qualquer zoom: os sorteios são por posição no mapa. As manchas de cada material são UM ladrilho feito uma vez e
// repetido pelo mapa: pintar uma área é um preenchimento só (medido: três camadas de mancha por cima da cor quase
// dobravam o custo de cada pedaço de chão).
(function (PD) {
  'use strict';
  const M = PD.math;
  const G = PD.groundHelp;

  // ------------------------------------------------------------------ as cores de cada material
  // demão (wash): uma cor por cima da cor de base do mapa, para acertar o tom geral
  // sol / sombra / grão: as manchas (cor, o quanto aparecem, o tamanho de uma repetição em cm e o giro)
  // folhas: as marquinhas soltas; capim: os tufos (traço escuro por baixo, folhas por cima); flores e pedrinhas
  const GREEN = {
    sun: { rgb: [204, 214, 92], a: 0.36, period: 2600, rot: 0.5, blobs: 17, size: [20, 66] },
    shade: { rgb: [16, 54, 44], a: 0.32, period: 2100, rot: -0.9, blobs: 12, size: [20, 62] },
    grain: { rgb: [26, 62, 30], a: 0.14, period: 640, rot: 0.25, blobs: 120, size: [3, 13] },
    leaves: ['#4f8440', '#356330', '#63984a', '#2f5a2c', '#79a851'],
    tuft: { ink: 'rgba(20, 44, 22, 0.72)', blades: ['#5f9441', '#73a84c', '#8ab85a', '#a8c062'] },
    flowers: ['#f0dc78', '#ecaed0', '#f6f2e6'],
  };
  const PAINT = {
    grama: { ...GREEN, n: 2.5, tufts: 0.3, bloom: 0.07, rot: 0.5 },
    clareira: { ...GREEN, n: 2.5, tufts: 0.3, bloom: 0.07, rot: 0.5 },
    mata: {
      rot: -0.7,
      wash: { rgb: [66, 110, 58], a: 0.22 },
      sun: { rgb: [92, 138, 66], a: 0.24, period: 2300, rot: 0.7, blobs: 12, size: [18, 60] },
      shade: { rgb: [5, 14, 13], a: 0.36, period: 1900, rot: -0.6, blobs: 15, size: [20, 64] },
      grain: { rgb: [108, 80, 44], a: 0.16, period: 900, rot: 0.2, blobs: 70, size: [4, 16] },
      leaves: ['#27452b', '#152a1a', '#33532f', '#45392a', '#1d3824', '#3b5a30'],
      tuft: { ink: 'rgba(6, 18, 10, 0.75)', blades: ['#2f5a33', '#3d6b3a', '#4f7d42'] },
      n: 2.3, tufts: 0.14, bloom: 0,
    },
    terra: {
      rot: 0.9,
      wash: { rgb: [196, 156, 104], a: 0.2 },
      sun: { rgb: [216, 180, 126], a: 0.26, period: 2200, rot: 0.4, blobs: 13, size: [18, 60] },
      shade: { rgb: [50, 30, 16], a: 0.3, period: 1700, rot: -0.8, blobs: 14, size: [18, 58] },
      grain: { rgb: [58, 38, 22], a: 0.13, period: 560, rot: 0.3, blobs: 110, size: [3, 12] },
      leaves: ['#5a412b', '#7f6040', '#4d3824', '#8a6a48'],
      pebbles: 0.45, n: 2.2, tufts: 0.03, bloom: 0, cracks: 0.07,
      tuft: { ink: 'rgba(30, 40, 20, 0.7)', blades: ['#6f8a45', '#8a9a52', '#b7a564'] },
    },
  };
  PAINT['mata-profunda'] = { ...PAINT.mata, shade: { ...PAINT.mata.shade, a: 0.5 } };
  PAINT.trilha = { ...PAINT.terra, pebbles: 0.6 };
  PAINT.lama = { ...PAINT.terra, sun: { ...PAINT.terra.sun, rgb: [150, 124, 92], a: 0.2 }, pebbles: 0.3 };
  PAINT.areia = { ...PAINT.terra, sun: { ...PAINT.terra.sun, rgb: [240, 222, 170] }, pebbles: 0.25 };

  /** As superfícies (o que pode estar "por baixo" de um ponto do chão); o resto das formas é detalhe. */
  const SURFACE = new Set(['mata', 'mata-profunda', 'grama', 'clareira', 'terra', 'trilha', 'lama', 'areia', 'agua', 'asfalto', 'rua', 'calcada', 'praca', 'pedra', 'circulo', 'piso', 'campinho', 'faixa']);
  const PLANTED = new Set(['mata', 'mata-profunda', 'grama', 'clareira']);
  const natural = (type) => PAINT[type] || null;

  // ------------------------------------------------------------------ a tinta de cada material (ladrilho que se repete)
  /** O ladrilho tem 512 px e cobre 36 m do chão (7 cm por ponto): não dá para ver a repetição numa tela. */
  const TILE = 512;
  const PERIOD = 3600;
  const hash2 = (i, j, s) => {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const PAINTS = new Map();
  const MEANS = new Map();
  let scratch = null;
  /** Chama `fn(x, y)` no ponto e nas cópias dele do outro lado do ladrilho (a mancha que passa da borda continua lá). */
  function wrapped(cx, cy, reach, fn) {
    for (const ox of [-TILE, 0, TILE]) {
      for (const oy of [-TILE, 0, TILE]) {
        if (cx + ox < -reach || cx + ox > TILE + reach || cy + oy < -reach || cy + oy > TILE + reach) continue;
        fn(cx + ox, cy + oy);
      }
    }
  }
  /**
   * A tinta de um material: a cor de base com as MANCHAS de aquarela por cima — borrões macios (cada um mais forte um
   * pouco antes da borda, como a tinta que seca ali), de tamanhos e direções sorteados: os grandes escuros (sombra),
   * os grandes claros (sol) e os miúdos (grão). `layer.size` e `layer.period` dizem o tamanho de cada borrão em cm
   * (`size` × `period` / 256). Devolve a própria cor quando não dá para fazer o padrão (os testes sem navegador).
   */
  function paintOf(type, color) {
    const P = natural(type);
    const base = color || (G.MAT[type] || G.MAT.terra).base;
    if (!P) return base;
    const key = type + '|' + base;
    if (PAINTS.has(key)) return PAINTS.get(key);
    let paint = base;
    try {
      const c = document.createElement('canvas');
      c.width = c.height = TILE;
      const x = c.getContext('2d');
      x.fillStyle = base;
      x.fillRect(0, 0, TILE, TILE);
      if (P.wash) {
        // a demão: puxa a cor de base do mapa para o tom do alvo (a terra mais clara, a mata menos preta)
        x.fillStyle = `rgba(${P.wash.rgb[0]}, ${P.wash.rgb[1]}, ${P.wash.rgb[2]}, ${P.wash.a})`;
        x.fillRect(0, 0, TILE, TILE);
      }
      const cm = PERIOD / TILE; // cm por ponto do ladrilho
      [P.shade, P.sun, P.grain].forEach((layer, li) => {
        if (!layer) return;
        const r = M.rng(layer.rgb[0] * 131 + layer.rgb[1] * 31 + Math.round(layer.period) + li * 977 + 7);
        const [R, Gc, B] = layer.rgb;
        const unit = layer.period / 256 / cm; // pontos deste ladrilho por unidade de `size`
        const count = Math.round(layer.blobs * Math.pow(PERIOD / layer.period, 2));
        const blot = (cx, cy, rad, a, turn, flat) =>
          wrapped(cx, cy, rad, (px, py) => {
            x.save();
            x.translate(px, py);
            x.rotate(turn);
            x.scale(1, flat);
            const g = x.createRadialGradient(0, 0, 0, 0, 0, rad);
            g.addColorStop(0, `rgba(${R}, ${Gc}, ${B}, ${a * 0.85})`);
            g.addColorStop(0.55, `rgba(${R}, ${Gc}, ${B}, ${a})`);
            g.addColorStop(0.8, `rgba(${R}, ${Gc}, ${B}, ${a * 1.08})`);
            g.addColorStop(1, `rgba(${R}, ${Gc}, ${B}, 0)`);
            x.fillStyle = g;
            x.fillRect(-rad, -rad, rad * 2, rad * 2);
            x.restore();
          });
        const big = layer.size[1] >= 40;
        for (let k = 0; k < count; k++) {
          const rad = (layer.size[0] + r() * r() * (layer.size[1] - layer.size[0])) * unit;
          const cx = r() * TILE, cy = r() * TILE, turn = r() * Math.PI, flat = 0.5 + r() * 0.45;
          const a = layer.a * (0.5 + r() * 0.5);
          if (!big) {
            blot(cx, cy, rad, a, turn, flat);
            continue;
          }
          // a mancha grande é um punhado de borrões que se sobrepõem: sai com a beirada irregular, não um disco
          const parts = 3 + Math.floor(r() * 3);
          for (let q = 0; q < parts; q++) {
            const d = rad * (0.25 + r() * 0.55), t = r() * M.TAU;
            blot(cx + Math.cos(t) * d, cy + Math.sin(t) * d * flat, rad * (0.4 + r() * 0.4), a * 0.62, r() * Math.PI, 0.55 + r() * 0.4);
          }
        }
      });
      // a cor média do ladrilho pronto: é a cor da névoa que vaza pela beirada das áreas
      const px = x.getImageData(0, 0, TILE, TILE).data;
      const sum = [0, 0, 0];
      for (let k = 0; k < px.length; k += 4 * 37) for (let q = 0; q < 3; q++) sum[q] += px[k + q];
      const count = Math.ceil(px.length / (4 * 37));
      MEANS.set(key, sum.map((v) => Math.round(v / count)));
      scratch = scratch || document.createElement('canvas').getContext('2d');
      const pattern = scratch.createPattern(c, 'repeat');
      if (pattern && pattern.setTransform && typeof DOMMatrix !== 'undefined') {
        pattern.setTransform(new DOMMatrix().rotate(((P.rot || 0.5) * 180) / Math.PI).scale(cm, cm));
        paint = pattern;
      }
    } catch (e) {
      paint = base; // (sem tela de verdade: fica só a cor de base)
    }
    PAINTS.set(key, paint);
    return paint;
  }
  /** A cor média da tinta de um material, [r, g, b] (sem tela de verdade: a cor de base). */
  function meanOf(type, color) {
    const base = color || (G.MAT[type] || G.MAT.terra).base;
    paintOf(type, color);
    const m = MEANS.get(type + '|' + base);
    if (m) return m;
    const n = parseInt(String(base).slice(1), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /** A forma tapa o pedaço inteiro com tinta opaca? Então o que foi pintado antes dela, neste pedaço, não aparece. */
  const OPAQUE = new Set(['asfalto', 'rua', 'calcada']);
  const covers = (sh, box) => sh.kind === 'rect' && (!!natural(sh.type) || OPAQUE.has(sh.type)) && sh.x0 <= box.x0 && sh.x1 >= box.x1 && sh.y0 <= box.y0 && sh.y1 >= box.y1;

  // ------------------------------------------------------------------ o que está por baixo de um ponto
  const boxOf = (sh) => sh._box || (sh._box = G.shapeBox(sh));
  /** Só as formas que são superfície (das 342 do Capão, umas 80), com o número de cada uma na lista do mapa. */
  const surfaces = (map) => map._surfaces || (map._surfaces = map.shapes.map((s, i) => ({ s, i, b: boxOf(s) })).filter((e) => e.s.kind !== 'point' && SURFACE.has(e.s.type)));
  /** O material da superfície no ponto, contando só as formas ANTES da de número `upTo` (as que já foram pintadas). */
  function under(map, x, y, upTo) {
    const list = surfaces(map);
    for (let k = list.length - 1; k >= 0; k--) {
      const e = list[k];
      if (e.i >= upTo) continue;
      const b = e.b;
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
      if (G.inside(e.s, x, y)) return e.s.type;
    }
    return 'mata';
  }
  /** Alguma superfície pintada DEPOIS da de número `n` tapa este ponto? (o que for desenhado ali não aparece) */
  function coveredAfter(map, x, y, n, self) {
    const list = surfaces(map);
    for (let k = list.length - 1; k >= 0; k--) {
      const e = list[k];
      if (e.i <= n) break;
      if (e.s === self) continue;
      const b = e.b;
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
      if (G.inside(e.s, x, y)) return true;
    }
    return false;
  }
  /** O ponto cai dentro de outra trilha (ou terra, ou chão de pedra)? Ali a beirada desta não é desenhada: as duas se juntam. */
  function joins(map, x, y, self) {
    for (const e of surfaces(map)) {
      if (e.s === self || PLANTED.has(e.s.type)) continue;
      const b = e.b;
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
      if (G.inside(e.s, x, y)) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ marcas pequenas (em LOTES)
  const liftOf = (cam, h) => (h * cam.cosP) / (2 * PD.ISO_K * cam.sinP);
  /**
   * Um LOTE de marcas: em vez de pintar cada folha, cada pincelada e cada fio de capim na hora (centenas de
   * preenchimentos pequenos por pedaço de chão: era o que mais custava), junta tudo o que tem a mesma tinta num
   * traçado só e pinta de uma vez no `flush`. Primeiro as manchas (na ordem em que as tintas apareceram), depois o
   * capim (o traço escuro de todos os tufos e, por cima, as folhas de cada cor).
   */
  class Batch {
    constructor(ctx) {
      this.ctx = ctx;
      this.fills = new Map();
      this.grass = new Map();
      this.lines = new Map();
    }
    /** O traçado dos riscos desta cor e largura (as trincas da terra seca). */
    line(style, width) {
      const key = style + '|' + width;
      let l = this.lines.get(key);
      if (!l) this.lines.set(key, (l = { style, width, path: new Path2D() }));
      return l.path;
    }
    /** O traçado das manchas desta tinta (cor ou padrão). */
    of(paint) {
      let p = this.fills.get(paint);
      if (!p) this.fills.set(paint, (p = new Path2D()));
      return p;
    }
    /** Uma oval inteira (sem emendar na anterior). */
    oval(paint, x, y, rx, ry, turn) {
      if (Batch.MODE.fills === 'now' || (Batch.MODE.fills === 'paint' && typeof paint === 'string')) {
        const c = this.ctx;
        c.fillStyle = paint;
        c.beginPath();
        c.ellipse(x, y, rx, ry, turn, 0, M.TAU);
        c.fill();
        return;
      }
      const p = this.of(paint);
      p.moveTo(x + rx * Math.cos(turn), y + rx * Math.sin(turn));
      p.ellipse(x, y, rx, ry, turn, 0, M.TAU);
    }
    flush(ctx) {
      for (const [paint, path] of this.fills) {
        ctx.fillStyle = paint;
        ctx.fill(path);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const l of this.lines.values()) {
        ctx.strokeStyle = l.style;
        ctx.lineWidth = l.width;
        ctx.stroke(l.path);
      }
      for (const [look, g] of this.grass) {
        ctx.strokeStyle = look.ink;
        ctx.lineWidth = 2.7;
        ctx.stroke(g.ink);
        ctx.lineWidth = 1.5;
        g.blades.forEach((path, i) => {
          if (!path) return;
          ctx.strokeStyle = look.blades[i];
          ctx.stroke(path);
        });
      }
      this.fills.clear();
      this.grass.clear();
      this.lines.clear();
    }
  }
  Batch.MODE = { fills: 'paint' };
  /** Tufo de capim em pé (as folhas sobem na tela; no chão, isso é andar para -x-y). */
  function tuft(B, x, y, size, rnd, cam, look) {
    const k = liftOf(cam, 1);
    const n = 4 + Math.floor(rnd() * 4);
    let g = B.grass.get(look);
    if (!g) B.grass.set(look, (g = { ink: new Path2D(), blades: [] }));
    for (let i = 0; i < n; i++) {
      const h = size * (0.55 + rnd() * 0.65);
      const lean = (rnd() - 0.5) * size * 0.9;
      const bx = x + (rnd() - 0.5) * size * 0.4;
      const by = y + (rnd() - 0.5) * size * 0.4;
      const tx = bx - k * h + lean * 0.7, ty = by - k * h - lean * 0.7;
      const mx = (bx + tx) / 2 + lean * 0.2, my = (by + ty) / 2 - lean * 0.2;
      const c = Math.floor(rnd() * look.blades.length);
      for (const path of [g.ink, g.blades[c] || (g.blades[c] = new Path2D())]) {
        path.moveTo(bx, by);
        path.quadraticCurveTo(mx, my, tx, ty);
      }
    }
  }
  /** Pedrinha: clara em cima, com a sombra dela embaixo. */
  const STONES = ['#a39c8d', '#8f887a', '#b5ad9c', '#7d766a'];
  function pebble(B, x, y, r, rnd) {
    const a = rnd() * 3;
    B.oval('rgba(40, 28, 18, 0.45)', x + r * 0.25, y + r * 0.25, r * 1.05, r * 0.72, a);
    B.oval(STONES[Math.floor(rnd() * 4)], x, y, r, r * 0.66, a);
  }
  /** Terra rachada: uma trinca que anda em passinhos virando devagar, com um ou dois galhos. */
  function crack(B, x, y, dir, len, r, color = 'rgba(46, 28, 16, 0.5)', depth = 0) {
    const path = B.line(color, depth ? 1.6 : 2.4);
    path.moveTo(x, y);
    const pts = [];
    for (let d = 0; d < len; ) {
      const step = 6 + r() * 7;
      dir += (r() - 0.5) * 0.9;
      x += Math.cos(dir) * step;
      y += Math.sin(dir) * step;
      d += step;
      path.lineTo(x, y);
      pts.push([x, y, dir]);
    }
    if (depth) return;
    for (let k = 0; k < 2 && pts.length > 2; k++) {
      const q = pts[1 + Math.floor(r() * (pts.length - 2))];
      crack(B, q[0], q[1], q[2] + (r() < 0.5 ? 1 : -1) * (0.7 + r() * 0.6), len * (0.3 + r() * 0.3), r, color, 1);
    }
  }
  /** Mais marcas aqui, menos ali: de 0,25 a 1,7, mudando devagar pelo mapa (as marcas saem em grupos). */
  const density = (i, j, seed) => {
    const a = hash2(Math.floor(i / 3), Math.floor(j / 3), seed + 5), b = hash2(Math.floor((i + 1) / 2), Math.floor((j + 2) / 2), seed + 9);
    return 0.25 + (a * 0.65 + b * 0.35) * 1.45;
  };

  /** As marcas de um material natural, no lugar das bolinhas iguais. Devolve se pintou. */
  function marks(ctx, sh, box, seed, g) {
    const P = natural(sh.type);
    if (!P) return false;
    const b = boxOf(sh);
    const map = g.map;
    // (a forma de número n é pintada com a semente n + 1; o fundo, com 0)
    const hidden = map && map.shapes ? (x, y) => coveredAfter(map, x, y, seed - 1, sh) : () => false;
    const i0 = Math.floor(Math.max(b.x0, box.x0) / 100), i1 = Math.floor(Math.min(b.x1, box.x1) / 100);
    const j0 = Math.floor(Math.max(b.y0, box.y0) / 100), j1 = Math.floor(Math.min(b.y1, box.y1) / 100);
    const whole = sh.kind === 'rect' && b.x0 <= box.x0 && b.x1 >= box.x1 && b.y0 <= box.y0 && b.y1 >= box.y1;
    const inside = whole ? () => true : (x, y) => G.inside(sh, x, y);
    const B = new Batch(ctx);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        // o pedaço é um losango no chão: metade dos quadradinhos da caixa dele nem aparece; e o que uma superfície
        // pintada depois vai tapar (a mata debaixo da grama da clareira) não precisa de marcas
        const mx = i * 100 + 50, my = j * 100 + 50;
        if ((box.sees && !box.sees(mx, my, 120)) || hidden(mx, my)) continue;
        const r = G.cellRng(i, j, seed + 7);
        const d = density(i, j, seed);
        // folhas e manchinhas: alongadas, cada uma virada para um lado, em grupos
        const n = Math.round(P.n * d * (0.6 + r() * 0.8));
        for (let k = 0; k < n; k++) {
          const x = (i + r()) * 100, y = (j + r()) * 100;
          const c = P.leaves[Math.floor(r() * P.leaves.length)];
          const w = 5 + r() * 9;
          const turn = r() * 3.14, thin = 0.34 + r() * 0.3;
          if (inside(x, y)) B.oval(c, x, y, w, w * thin, turn);
        }
        if (P.pebbles && r() < P.pebbles * d * 0.6) {
          const x = (i + r()) * 100, y = (j + r()) * 100;
          if (inside(x, y)) {
            pebble(B, x, y, 3 + r() * 4.5, r);
            if (r() < 0.4) pebble(B, x + 9 + r() * 8, y + 4 - r() * 9, 2 + r() * 2.5, r);
          }
        }
        if (P.cracks && r() < P.cracks * (2 - d)) {
          // terra seca rachada (onde há menos folhas e pedrinhas)
          const x = (i + r()) * 100, y = (j + r()) * 100;
          if (inside(x, y)) crack(B, x, y, r() * 6.28, 26 + r() * 44, r);
        }
        if (P.tufts && r() < P.tufts * d) {
          const x = (i + r()) * 100, y = (j + r()) * 100;
          if (inside(x, y)) tuft(B, x, y, 9 + r() * 9, r, g.cam, P.tuft);
        }
        if (P.bloom && r() < P.bloom * d) {
          const x = (i + r()) * 100, y = (j + r()) * 100;
          if (inside(x, y)) {
            const c = P.flowers[Math.floor(r() * P.flowers.length)];
            const many = 3 + Math.floor(r() * 5);
            for (let f = 0; f < many; f++) {
              const q = 2.2 + r() * 1.2;
              B.oval(c, x + (r() - 0.5) * 46, y + (r() - 0.5) * 46, q, q, 0);
            }
          }
        }
      }
    }
    B.flush(ctx);
    return true;
  }

  // ------------------------------------------------------------------ a beirada das áreas
  /**
   * Ondulação macia e IRREGULAR (de −1 a 1) ao longo de uma linha: três tamanhos de altos e baixos sorteados (a cada
   * 2 m, 85 cm e 45 cm), emendados em curva. (Com ondas de seno a beirada saía em gomos iguais, como renda.) Com
   * `per` (o comprimento da volta) os sorteios fecham certinho no fim da volta.
   */
  const SCALES = [[210, 0.55], [85, 0.3], [45, 0.15]];
  function wave(s, seed, per) {
    const sd = Math.floor(seed * 977) | 0;
    let v = 0;
    for (let k = 0; k < 3; k++) {
      const [len, amp] = SCALES[k];
      const cells = per ? Math.max(3, Math.round(per / len)) : 0;
      const t = cells ? (s / per) * cells : s / len;
      const i = Math.floor(t), f = t - i;
      const at = (j) => hash2(cells ? ((j % cells) + cells) % cells : j, k * 31 + 5, sd);
      v += amp * ((at(i) + (at(i + 1) - at(i)) * f * f * (3 - 2 * f)) * 2 - 1);
    }
    return v;
  }
  /** Uma curva macia pelos pontos [x, y] (cada ponto vira o controle de uma curva entre os meios dos trechos). */
  function smooth(path, pts, move) {
    const n = pts.length;
    if (!n) return;
    if (move) path.moveTo(pts[0][0], pts[0][1]);
    else path.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i + 1 < n; i++) path.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    if (n > 1) path.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
  /**
   * Pontos pela beirada da forma, um a cada `step` cm, com a direção para FORA (nx, ny), a distância desde o começo da
   * volta (s) e `c`: 1 no meio de um lado, 0 no canto (ali a beirada volta para a linha exata). Guardados na forma.
   */
  function outline(sh, step = 34) {
    if (sh._outline) return sh._outline;
    const pts = [];
    let s = 0;
    const edge = (a, b, flip) => {
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L < 1) return;
      const n = Math.max(1, Math.round(L / step));
      let nx = (b.y - a.y) / L, ny = -(b.x - a.x) / L;
      if (flip) { nx = -nx; ny = -ny; }
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, nx, ny, s: s + L * t, c: Math.min(1, (Math.min(t, 1 - t) * L) / 70) });
      }
      s += L;
    };
    if (sh.kind === 'ellipse') {
      const n = Math.max(12, Math.round((M.TAU * Math.sqrt((sh.rx * sh.rx + sh.ry * sh.ry) / 2)) / step));
      s = M.TAU * Math.sqrt((sh.rx * sh.rx + sh.ry * sh.ry) / 2);
      for (let k = 0; k < n; k++) {
        const t = (k / n) * M.TAU;
        const c = Math.cos(t), sn = Math.sin(t);
        const l = Math.hypot(c / sh.rx, sn / sh.ry) || 1;
        pts.push({ x: sh.cx + c * sh.rx, y: sh.cy + sn * sh.ry, nx: c / sh.rx / l, ny: sn / sh.ry / l, s: (k / n) * s, c: 1 });
      }
    } else if (sh.kind === 'rect') {
      const p = [{ x: sh.x0, y: sh.y0 }, { x: sh.x1, y: sh.y0 }, { x: sh.x1, y: sh.y1 }, { x: sh.x0, y: sh.y1 }];
      for (let i = 0; i < 4; i++) edge(p[i], p[(i + 1) % 4], false);
    } else if (sh.kind === 'poly') {
      const p = sh.pts;
      let area = 0;
      for (let i = 0; i < p.length; i++) {
        const q = p[(i + 1) % p.length];
        area += p[i].x * q.y - q.x * p[i].y;
      }
      for (let i = 0; i < p.length; i++) edge(p[i], p[(i + 1) % p.length], area < 0);
    }
    sh._outline = { pts, per: s };
    return sh._outline;
  }
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };
  const pointRng = (i, n, s) => M.rng(((Math.imul(i + 1, 2654435761) ^ Math.imul(n + 3, 40503) ^ Math.imul(s, 83492791)) >>> 0) || 1);

  /**
   * Um TUFO DE PINCELADAS: 2 a 4 ovais sobrepostas, de tamanhos e direções diferentes, inteiras (nenhuma cortada).
   * Quebram a linha de uma beirada aqui e ali.
   */
  function clump(B, paint, x, y, size, dir, r) {
    const n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const a = size * (0.45 + r() * 0.75), b = a * (0.38 + r() * 0.4);
      B.oval(paint, x + (r() - 0.5) * size * 1.1, y + (r() - 0.5) * size * 1.1, a, b, dir + (r() - 0.5) * 1.2);
    }
  }
  /** Um borrão macio de uma cor só (forte no meio, sumindo até a borda): a luz da clareira vazando para a mata. */
  function haze(ctx, x, y, rad, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`);
    g.addColorStop(0.4, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a * 0.72})`);
    g.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  /**
   * Quanto a beirada se DESMANCHA neste ponto: 0 quando encosta em pedra, calçada, água ou no mesmo material (ali a
   * beirada é a linha exata); até 1 quando o que está em volta também é terra ou capim. Guardado no ponto.
   */
  function softAt(p, sh, n, map) {
    if (p.soft !== undefined) return p.soft;
    p.out = under(map, p.x + p.nx * 30, p.y + p.ny * 30, n);
    if (p.out === sh.type || !natural(p.out)) return (p.soft = 0);
    // (com pedra ou água a um passo dali, a beirada só ondula um pouco: a névoa de cor cairia em cima da calçada)
    p.haze = !!natural(under(map, p.x + p.nx * 105, p.y + p.ny * 105, n));
    return (p.soft = (p.haze ? 1 : 0.45) * p.c);
  }
  /** Os trechos seguidos da beirada, perto deste pedaço, onde ela se desmancha (a volta pode emendar no começo). */
  function softRuns(sh, n, env, pad) {
    const { pts } = outline(sh);
    const box = env.box, map = env.map;
    const N = pts.length;
    const ok = (p) => p.x > box.x0 - pad && p.x < box.x1 + pad && p.y > box.y0 - pad && p.y < box.y1 + pad && softAt(p, sh, n, map) > 0;
    let from = -1;
    for (let i = 0; i < N; i++) {
      if (!ok(pts[i])) {
        from = i;
        break;
      }
    }
    if (from < 0) return N ? [pts.concat([pts[0]])] : []; // a volta inteira cabe aqui
    const runs = [];
    let cur = null;
    for (let k = 1; k <= N; k++) {
      const p = pts[(from + k) % N];
      if (!ok(p)) {
        cur = null;
        continue;
      }
      if (!cur) runs.push((cur = []));
      cur.push(p);
    }
    return runs.filter((r) => r.length > 1);
  }

  /**
   * Uma ÁREA de material natural (a grama da clareira, a lama da margem, a mata funda): no lugar de preencher a forma
   * exata — que saía recortada, com cara de adesivo —, a beirada se desmancha no que está em volta, em três camadas:
   * (1) a NÉVOA: borrões macios da cor da área caindo para fora (a luz da clareira vazando para a mata);
   * (2) a AGUADA: uma faixa meio transparente da tinta, de beirada ondulada, um pouco mais para fora;
   * (3) a tinta FIRME: a forma, com a beirada ondulada (nunca a linha do compasso).
   * Onde a área encosta em calçada, pedra ou água, a beirada continua exata (a emenda é a deles).
   */
  function area(ctx, sh, n, env) {
    const paint = paintOf(sh.type, sh.color);
    const exact = () => {
      G.shapePath(ctx, sh);
      ctx.fillStyle = paint;
      ctx.fill();
    };
    if (sh.kind === 'point' || sh.kind === 'line') return exact();
    const runs = softRuns(sh, n, env, 250);
    if (!runs.length) return exact();
    const per = outline(sh).per;
    const seed = (n * 7.31) % 23;
    const rgb = meanOf(sh.type, sh.color);
    // (1) a névoa
    for (const run of runs) {
      for (let i = 0; i < run.length; i++) {
        const p = run[i];
        if (!p.haze) continue;
        const k = Math.round(p.s / 34);
        if (k % 3) continue; // um borrão a cada metro
        const r = pointRng(k, n, 53);
        const rad = 95 + r() * 55;
        const d = 6 + r() * 26;
        haze(ctx, p.x + p.nx * d, p.y + p.ny * d, rad, rgb, (0.34 + r() * 0.2) * p.soft);
      }
    }
    // a faixa entre a linha exata e a linha ondulada (afinando nas pontas do trecho)
    const ribbon = (run, lo, hi, sd) => {
      const outer = [];
      const m = run.length;
      for (let i = 0; i < m; i++) {
        const p = run[i];
        const ramp = run[0] === run[m - 1] ? 1 : Math.min(1, (i + 0.5) / 3, (m - i - 0.5) / 3);
        const d = p.soft * ramp * (lo + (hi - lo) * (0.5 + 0.5 * wave(p.s, sd, per)));
        outer.push([p.x + p.nx * d, p.y + p.ny * d]);
      }
      ctx.beginPath();
      // (o lado de dentro entra 8 cm na forma: sem fresta entre a faixa e o preenchimento)
      run.forEach((p, i) => (i ? ctx.lineTo(p.x - p.nx * 8, p.y - p.ny * 8) : ctx.moveTo(p.x - p.nx * 8, p.y - p.ny * 8)));
      smooth(ctx, outer.reverse(), false);
      ctx.closePath();
      ctx.fill();
    };
    // (2) a aguada (meio transparente: a cor média da tinta resolve, e custa muito menos que o padrão)
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.34)`;
    for (const run of runs) ribbon(run, 22, 92, seed + 11.3);
    // (3) a tinta firme
    exact();
    for (const run of runs) ribbon(run, 2, 40, seed);
  }

  /**
   * DEPOIS das marcas da área: em cima da beirada, tufos de capim e umas pinceladas soltas (do que está em volta
   * entrando um pouco, e da área saindo), para a linha ondulada não ficar lisa demais.
   */
  function edgeOver(ctx, sh, n, env) {
    if (sh.kind === 'line' || sh.kind === 'point') return;
    const P = natural(sh.type);
    const paint = paintOf(sh.type, sh.color);
    const B = new Batch(ctx);
    for (const run of softRuns(sh, n, env, 120)) {
      for (const p of run) {
        const k = Math.round(p.s / 34);
        const r = pointRng(k, n, 17);
        const along = Math.atan2(p.ny, p.nx) + Math.PI / 2;
        const roll = r();
        if (roll < 0.13 * p.soft) {
          // o de fora entrando (rente à linha: uma pincelada escura solta no meio do capim claro pareceria um buraco)
          const d = 4 + r() * 16;
          clump(B, paintOf(p.out), p.x - p.nx * d, p.y - p.ny * d, 7 + r() * 9, along, r);
        } else if (roll < 0.3 * p.soft) {
          const d = 26 + r() * r() * 70;
          clump(B, paint, p.x + p.nx * d, p.y + p.ny * d, 6 + r() * 10, along, r);
        }
        if (P && P.tuft && r() < 0.2 * p.soft) tuft(B, p.x + p.nx * (r() * 90 - 20), p.y + p.ny * (r() * 90 - 20), 10 + r() * 9, r, env.g.cam, P.tuft);
      }
    }
    B.flush(ctx);
  }

  /**
   * A EMENDA de um chão de pedra (calçada, asfalto, praça, o círculo) com a terra e o capim em volta: sujeira que
   * passa da linha, musgo entrando pela pedra e tufos de capim rente à beirada — sem isso a calçada parece pousada no
   * capim. Os detalhes maiores (rachadura, raiz, capim alto) continuam sendo os que o [mundo] marca no mapa.
   */
  const PAVED = new Set(['calcada', 'asfalto', 'rua', 'praca', 'circulo', 'pedra']);
  const GRIME = ['rgba(54, 40, 24, 0.28)', 'rgba(40, 52, 26, 0.3)', 'rgba(70, 58, 36, 0.24)'];
  const MOSS = ['rgba(74, 104, 50, 0.5)', 'rgba(92, 122, 58, 0.42)', 'rgba(58, 86, 42, 0.5)'];
  function seam(ctx, sh, n, env) {
    if (!PAVED.has(sh.type) || sh.kind === 'line' || sh.kind === 'point') return;
    const box = env.box, map = env.map;
    const { pts } = outline(sh);
    const B = new Batch(ctx);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < box.x0 - 90 || p.x > box.x1 + 90 || p.y < box.y0 - 90 || p.y > box.y1 + 90) continue;
      const out = p.seam || (p.seam = under(map, p.x + p.nx * 22, p.y + p.ny * 22, n));
      const O = natural(out);
      if (!O) continue; // encostada em outro chão de pedra: a emenda é reta mesmo
      const r = pointRng(i, n, 43);
      const along = Math.atan2(p.ny, p.nx) + Math.PI / 2;
      // sujeira em cima da linha e musgo um pouco para dentro da pedra
      if (r() < 0.31) B.oval(GRIME[Math.floor(r() * 3)], p.x + p.nx * (r() * 14 - 7), p.y + p.ny * (r() * 14 - 7), 14 + r() * 22, 6 + r() * 8, along + (r() - 0.5) * 0.5);
      if (PLANTED.has(out) && r() < 0.21) {
        const d = 4 + r() * r() * 30;
        for (let k = 0; k < 2 + Math.floor(r() * 3); k++) B.oval(MOSS[Math.floor(r() * 3)], p.x - p.nx * d + (r() - 0.5) * 26, p.y - p.ny * d + (r() - 0.5) * 26, 5 + r() * 11, 3 + r() * 6, r() * 3.1);
      }
      if (O.tuft && r() < (PLANTED.has(out) ? 0.25 : 0.09)) tuft(B, p.x + p.nx * (2 + r() * 14), p.y + p.ny * (2 + r() * 14), 8 + r() * 9, r, env.g.cam, O.tuft);
    }
    B.flush(ctx);
  }

  // ------------------------------------------------------------------ a trilha
  /** A linha da trilha amaciada, com um ponto a cada ~35 cm: { x, y, a (direção), s (distância do começo) }. */
  function spine(sh) {
    if (sh._spine) return sh._spine;
    let line = sh.pts;
    for (let it = 0; it < 2 && line.length > 2; it++) {
      const sm = [line[0]];
      for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i], b = line[i + 1];
        sm.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      sm.push(line[line.length - 1]);
      line = sm;
    }
    const out = [];
    let s = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.round(L / 35));
      const dir = Math.atan2(b.y - a.y, b.x - a.x);
      for (let k = 0; k < n; k++) {
        const t = k / n;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: dir, s: s + L * t });
      }
      s += L;
    }
    const z = line[line.length - 1];
    out.push({ x: z.x, y: z.y, a: out.length ? out[out.length - 1].a : 0, s });
    // a direção em cada ponto: a média dos dois trechos (a beirada não quebra nas curvas)
    for (let i = 1; i + 1 < out.length; i++) out[i].a = Math.atan2(out[i + 1].y - out[i - 1].y, out[i + 1].x - out[i - 1].x);
    sh._spine = { pts: out, len: s };
    return sh._spine;
  }
  const nearBox = (p, box, pad) => p.x > box.x0 - pad && p.x < box.x1 + pad && p.y > box.y0 - pad && p.y < box.y1 + pad;
  /** A trilha é pintada por aqui? (as linhas de terra: trilha, lama, areia) */
  const isTrail = (sh) => sh.kind === 'line' && !!natural(sh.type) && !PLANTED.has(sh.type);
  /** As pontas da trilha: `open` = solta no capim (ali ela se desmancha); senão entra em outra trilha, na terra, na rua. */
  function endsOf(sh, map) {
    if (sh._ends) return sh._ends;
    const sp = spine(sh);
    const h = sh.width / 2;
    sh._ends = [sp.pts[0], sp.pts[sp.pts.length - 1]].map((p, k) => {
      const dir = k ? p.a : p.a + Math.PI;
      return { p, dir, open: !joins(map, p.x + Math.cos(dir) * h * 0.6, p.y + Math.sin(dir) * h * 0.6, sh) };
    });
    return sh._ends;
  }
  /**
   * A trilha medida uma vez (guardada na forma): em cada ponto da linha, a meia largura da tinta FIRME de cada lado
   * (l, r: ondulando) e a da AGUADA (bl, br: um pouco mais larga); `jl`/`jr` = desse lado ela encosta em outra trilha,
   * na terra ou na rua (ali não há beirada); `body` = o trecho com os dois lados (antes da ponta). Nas pontas soltas no
   * capim, a ponta ARREDONDADA e irregular (cap: os pontos da volta, da tinta firme e da aguada). E as MARCAS DE USO:
   * riscos compridos e macios, claros onde se pisa (um de cada lado) e escuro no meio, cada um com começo e fim.
   */
  function trailOf(sh, n, map) {
    if (sh._trail) return sh._trail;
    const sp = spine(sh);
    const w = sh.width, h = w / 2;
    const ends = endsOf(sh, map);
    const amp = Math.min(13, w * 0.065);
    const seed = (n * 12.9898) % 17;
    // a ponta solta: a tinta firme acaba um pouco antes do fim da linha, numa ponta redonda de `tip` cm
    const open = (ends[0].open ? 1 : 0) + (ends[1].open ? 1 : 0);
    const fit = open ? Math.min(1, (sp.len * 0.92) / (open * (h * 0.95 + Math.min(60, w * 0.27)))) : 1;
    const short = Math.min(60, w * 0.27) * fit;
    const tip = h * 0.95 * fit;
    const s0 = ends[0].open ? short + tip : 0, s1 = sp.len - (ends[1].open ? short + tip : 0);
    const pts = sp.pts.map((p, i) => {
      const nx = -Math.sin(p.a), ny = Math.cos(p.a);
      const jl = joins(map, p.x + nx * (h + 16), p.y + ny * (h + 16), sh);
      const jr = joins(map, p.x - nx * (h + 16), p.y - ny * (h + 16), sh);
      const breath = h * (1 + 0.05 * Math.sin(p.s / 260 + seed * 3));
      const wl = breath + wave(p.s, seed) * amp, wr = breath + wave(p.s, seed + 7.7) * amp;
      return {
        i, x: p.x, y: p.y, a: p.a, s: p.s, nx, ny, jl, jr, body: p.s >= s0 - 0.5 && p.s <= s1 + 0.5,
        l: jl ? h : wl,
        r: jr ? h : wr,
        bl: jl ? h : wl + Math.max(0, 5 + wave(p.s, seed + 3.1) * 34),
        br: jr ? h : wr + Math.max(0, 5 + wave(p.s, seed + 5.3) * 34),
      };
    });
    let iB0 = pts.findIndex((q) => q.body), iB1 = pts.length - 1;
    while (iB1 > 0 && !pts[iB1].body) iB1--;
    if (iB0 < 0) {
      iB0 = iB1 = Math.floor(pts.length / 2);
      pts[iB0].body = true;
    }
    // a volta da ponta, do lado esquerdo ao direito (ponta do fim) ou do direito ao esquerdo (ponta do começo)
    const cap = (q, sign, L, R, len, sd) => {
      const out = [];
      const dx = Math.cos(q.a) * sign, dy = Math.sin(q.a) * sign;
      const m = 10;
      for (let j = 1; j < m; j++) {
        const f = (Math.PI * j) / m;
        const half = f < Math.PI / 2 ? q[sign > 0 ? L : R] : q[sign > 0 ? R : L];
        const nz = 1 + 0.14 * wave(j * 31 + q.s, sd) * Math.sin(f);
        const lat = Math.cos(f) * half * sign * nz, lon = Math.sin(f) * len * nz;
        out.push([q.x + q.nx * lat + dx * lon, q.y + q.ny * lat + dy * lon]);
      }
      return out;
    };
    const caps = [ends[0].open ? cap(pts[iB0], -1, 'l', 'r', tip, seed + 9) : null, ends[1].open ? cap(pts[iB1], 1, 'l', 'r', tip, seed + 13) : null];
    const bcaps = [ends[0].open ? cap(pts[iB0], -1, 'bl', 'br', tip + 16, seed + 21) : null, ends[1].open ? cap(pts[iB1], 1, 'bl', 'br', tip + 16, seed + 27) : null];
    const r = pointRng(7, n, 61);
    const streaks = [];
    for (const lane of [{ off: -0.21, tone: 0.5, a: 0.34, lw: 0.27 }, { off: 0.2, tone: 0.5, a: 0.32, lw: 0.25 }, { off: 0, tone: -0.34, a: 0.2, lw: 0.15 }]) {
      for (let s = s0 + 10 + r() * 160; s < s1 - 130; ) {
        const L = 480 + r() * 700;
        const k = { s0: s, s1: Math.min(s1 - 10, s + L), off: lane.off * w + (r() - 0.5) * w * 0.08, tone: lane.tone, a: lane.a * (0.6 + r() * 0.55), lw: lane.lw * w * (0.75 + r() * 0.5), seed: r() * 40 };
        s += L + 20 + r() * 180;
        // (um toco curto e largo vira um losango no meio da trilha: a pincelada é sempre comprida e fina)
        if (k.s1 - k.s0 < 380) continue;
        k.lw = Math.min(k.lw, (k.s1 - k.s0) * 0.1);
        k.i0 = pts.findIndex((q) => q.s >= k.s0);
        k.i1 = pts.length - 1;
        while (k.i1 > k.i0 && pts[k.i1].s > k.s1) k.i1--;
        if (k.i0 >= 0 && k.i1 - k.i0 >= 6) streaks.push(k);
      }
    }
    sh._trail = { pts, streaks, ends, caps, bcaps, iB0, iB1, short, tip, len: sp.len };
    return sh._trail;
  }
  /** Os trechos seguidos de pontos da trilha perto do pedaço. */
  function nearRuns(pts, box, pad, keep) {
    const runs = [];
    let cur = null;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (!nearBox(p, box, pad) || (keep && !keep(p))) {
        cur = null;
        continue;
      }
      if (!cur) runs.push((cur = []));
      cur.push(p);
    }
    return runs;
  }
  /** Traços empilhados (do mais largo ao mais estreito, cada um bem fraco): uma faixa de beirada macia, sem degrau. */
  function softStroke(ctx, pts, color, alpha, widths) {
    if (pts.length < 2) return;
    ctx.strokeStyle = rgba(color, alpha / widths.length);
    for (const lw of widths) {
      ctx.beginPath();
      smooth(ctx, pts, true);
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  /**
   * Por baixo de TODAS as trilhas, antes da primeira: o capim ralo e pisado em volta delas (uma faixa macia) e, nas
   * pontas soltas, a terra sumindo no capim (borrões macios). Feito de uma vez para o de uma trilha não cair em cima
   * da outra onde elas se juntam.
   */
  function trailsUnder(ctx, env) {
    const box = env.box;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let n = 0; n < env.map.shapes.length; n++) {
      const sh = env.map.shapes[n];
      if (!isTrail(sh)) continue;
      const b = boxOf(sh);
      if (b.x1 < box.x0 - 220 || b.x0 > box.x1 + 220 || b.y1 < box.y0 - 220 || b.y0 > box.y1 + 220) continue;
      const T = trailOf(sh, n, env.map);
      const w = sh.width;
      const base = sh.color || (G.MAT[sh.type] || G.MAT.terra).base;
      const worn = M.mix(base, '#4a5524', 0.5);
      for (const run of nearRuns(T.pts, box, w / 2 + 160, (p) => p.body)) {
        softStroke(ctx, run.map((p) => [p.x, p.y]), worn, 0.2, [w + 150, w + 112, w + 76, w + 42]);
      }
      const rgb = meanOf(sh.type, sh.color);
      T.ends.forEach((e, k) => {
        if (!e.open || !nearBox(e.p, box, w * 1.6)) return;
        const r = pointRng(k, n, 91);
        const cx = Math.cos(e.dir), cy = Math.sin(e.dir);
        for (const [back, rad, a] of [[T.short + T.tip * 0.5, w * 0.78, 0.42], [T.short * 0.5, w * 0.6, 0.3], [-w * 0.1, w * 0.48, 0.18]]) {
          const side = (r() - 0.5) * w * 0.2;
          haze(ctx, e.p.x - cx * back - cy * side, e.p.y - cy * back + cx * side, rad * (0.9 + r() * 0.25), rgb, a);
        }
      });
    }
  }

  /** A trilha (ou outra linha de terra): devolve se pintou. */
  function trail(ctx, sh, n, env) {
    if (!isTrail(sh)) return false;
    const mat = G.MAT[sh.type] || G.MAT.terra;
    const base = sh.color || mat.base;
    const box = env.box, map = env.map, cam = env.g.cam;
    const T = trailOf(sh, n, map);
    const w = sh.width, h = w / 2;
    const paint = paintOf(sh.type, sh.color);
    const runs = nearRuns(T.pts, box, h + 150, (q) => q.body);
    if (!runs.length) return true;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // a volta do corpo num trecho: o lado esquerdo, a ponta (se o trecho chega nela), o lado direito de volta e a
    // outra ponta. Cada ponto: [x, y, tem beirada?]; `null` = o corte reto de onde o trecho sai de perto do pedaço
    const ring = (run, L, R, caps) => {
      const pts = [];
      for (const q of run) pts.push([q.x + q.nx * q[L], q.y + q.ny * q[L], !q.jl]);
      if (run[run.length - 1].i === T.iB1 && caps[1]) for (const c of caps[1]) pts.push([c[0], c[1], true]);
      else pts.push(null);
      for (let i = run.length - 1; i >= 0; i--) pts.push([run[i].x - run[i].nx * run[i][R], run[i].y - run[i].ny * run[i][R], !run[i].jr]);
      if (run[0].i === T.iB0 && caps[0]) for (const c of caps[0]) pts.push([c[0], c[1], true]);
      else pts.push(null);
      return pts;
    };
    const fillRings = (rings) => {
      ctx.beginPath();
      for (const pts of rings) {
        const closed = pts.filter(Boolean);
        // (a volta fecha em curva: repete o começo no fim)
        smooth(ctx, closed.concat([closed[0], closed[1]]), true);
        ctx.closePath();
      }
      ctx.fill();
    };
    // o corpo: a aguada (meio transparente, um pouco mais larga) e a tinta firme por cima, as duas de beirada ondulada
    const rgb = meanOf(sh.type, sh.color);
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.32)`;
    fillRings(runs.map((run) => ring(run, 'bl', 'br', T.bcaps)));
    ctx.fillStyle = paint;
    const firm = runs.map((run) => ring(run, 'l', 'r', T.caps));
    fillRings(firm);
    // onde ela entra em outra trilha (ou na terra, na rua), a ponta é redonda: as duas se fecham sem fresta
    T.ends.forEach((e) => {
      if (e.open || !nearBox(e.p, box, w)) return;
      ctx.beginPath();
      ctx.arc(e.p.x, e.p.y, h, 0, M.TAU);
      ctx.fill();
    });
    // marcas de uso: pinceladas compridas e macias que afinam nas pontas, claras onde se pisa e escura no meio
    for (const k of T.streaks) {
      let near = false;
      for (let i = k.i0; i <= k.i1 && !near; i += 2) near = nearBox(T.pts[i], box, h);
      if (!near) continue;
      const span = k.i1 - k.i0;
      ctx.fillStyle = rgba(M.shade(base, k.tone), k.a / 4);
      // quatro camadas, cada uma mais estreita e mais curta que a de fora: a pincelada some devagar nas pontas e nos lados
      for (let layer = 0; layer < 4; layer++) {
        const cut = Math.round(span * 0.09 * layer);
        const a = k.i0 + cut, b = k.i1 - cut;
        if (b - a < 2) break;
        const lf = [], rt = [];
        for (let i = a; i <= b; i++) {
          const q = T.pts[i];
          const o = k.off + wave(q.s, k.seed) * w * 0.04;
          const hw = Math.sin((Math.PI * (i - a)) / (b - a)) * k.lw * 0.5 * (1 - layer * 0.2);
          lf.push([q.x + q.nx * (o + hw), q.y + q.ny * (o + hw)]);
          rt.push([q.x + q.nx * (o - hw), q.y + q.ny * (o - hw)]);
        }
        ctx.beginPath();
        smooth(ctx, lf, true);
        smooth(ctx, rt.reverse(), false);
        ctx.closePath();
        ctx.fill();
      }
    }
    // a beira úmida e escura (uma sombra macia em cima da linha da beirada); não onde ela encosta em outra
    const dark = M.shade(base, -0.5);
    for (const pts of firm) {
      let cur = [];
      for (const c of pts.concat([null])) {
        if (c && c[2]) {
          cur.push(c);
          continue;
        }
        softStroke(ctx, cur, dark, 0.3, [46, 35, 25, 16, 8]);
        cur = [];
      }
    }
    // pedrinhas, folhas e trincas; e, pela beirada, capim, pedrinha e pinceladas soltas
    marks(ctx, sh, box, n + 1, env.g);
    const B = new Batch(ctx);
    for (const run of runs) {
      for (const q of run) {
        for (const [J, L, sg, O] of [['jl', 'l', 1, 'ol'], ['jr', 'r', -1, 'or']]) {
          if (q[J]) continue;
          const r = pointRng(q.i * 2 + (sg > 0 ? 1 : 0), n, 29);
          const roll = r();
          if (roll > 0.42) continue;
          const nx = q.nx * sg, ny = q.ny * sg;
          const out = q[O] || (q[O] = under(map, q.x + nx * (h + 34), q.y + ny * (h + 34), n));
          const look = natural(out);
          if (!look) continue;
          const d = q[L] + r() * 26 - 9;
          if (roll < 0.2 && look.tuft) tuft(B, q.x + nx * d, q.y + ny * d, 9 + r() * 10, r, cam, look.tuft);
          else if (roll < 0.26) pebble(B, q.x + nx * (d - 14), q.y + ny * (d - 14), 3 + r() * 4, r);
          else if (roll < 0.35 && PLANTED.has(out)) clump(B, paintOf(out), q.x + nx * (q[L] - 2 - r() * 9), q.y + ny * (q[L] - 2 - r() * 9), 6 + r() * 7, q.a, r);
          else if (roll < 0.42) clump(B, paint, q.x + nx * (q[L] + 6 + r() * 22), q.y + ny * (q[L] + 6 + r() * 22), 5 + r() * 6, q.a, r);
        }
      }
    }
    // o capim que nasce em volta da ponta solta
    T.ends.forEach((e, k) => {
      const c = T.caps[k];
      if (!c || !nearBox(e.p, box, w)) return;
      const r = pointRng(k, n, 73);
      const out = under(map, e.p.x, e.p.y, n);
      const look = natural(out);
      if (!look || !look.tuft) return;
      for (const pt of c) if (r() < 0.5) tuft(B, pt[0] + (r() - 0.5) * 30, pt[1] + (r() - 0.5) * 30, 9 + r() * 10, r, cam, look.tuft);
    });
    B.flush(ctx);
    return true;
  }

  PD.chao = { natural, paintOf, meanOf, covers, marks, area, edgeOver, seam, trailsUnder, trail, under, tuft, pebble, PAINT, Batch };
})(window.PD = window.PD || {});
