// A água mexendo (pedido do dono, 17/11: "água não tem movimentação"; desenho do [mundo] desde 19/11). O chão da água
// (o fundo, a margem e as marolas paradas) sai pintado uma vez só, em pedaços (ground.js); por cima dele, a cada quadro:
//  - as ondinhas: arcos finos e claros que aparecem, andam um pouco no sentido do vento e somem, cada uma no seu tempo;
//  - os brilhos do sol: estrelinhas que piscam de vez em quando (de dia; à noite, bem fracos, a luz da lua);
//  - a espuma da margem respirando: a beira clara indo e voltando devagar.
// Os pontos são sorteados uma vez, numa grade dentro de cada água do mapa (`agua` no chão: polígono, retângulo,
// elipse ou linha com largura), e só os que estão na tela são desenhados.
// E o REFLEXO (pedido do dono, 20/11: "pode seguir com o reflexo na água"): o que fica perto da água (as árvores da
// margem, as casas, os postes e os lampiões do Refúgio, os barcos) aparece virado de ponta-cabeça na água, mais fraco,
// só onde é água, e as ondinhas passam por cima. É a imagem pronta de cada objeto, virada: a árvore vira no pé do tronco,
// o barco na linha d'água dele e o que é largo (a casa) vira em duas metades, cada uma em torno da sua beira da base
// (a base da casa é diagonal na tela: virada reta de uma vez só, o reflexo descolava nas pontas).
//   PD.agua.prepare(world)          monta os pontos (World, ao ler o mapa)
//   PD.agua.reflect(ctx, world, t)  o reflexo (World.draw, logo depois do chão, antes das ondinhas)
//   PD.agua.live(ctx, world, t)     desenha (World.draw, logo depois do chão e antes do deque)
//   PD.agua.screenWater(world, toScreen, Q)  a água na tela (o reflexo das luzes de noite, em view.js)
(function (PD) {
  'use strict';
  const M = PD.math;
  const STEP = 230; // cm entre um ponto e outro da grade
  const SHORE_STEP = 160;

  function insidePoly(pts, x, y) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  function distToSeg(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / L)) : 0;
    return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
  }
  function insideShape(sh, x, y) {
    if (sh.kind === 'poly') return insidePoly(sh.pts, x, y);
    if (sh.kind === 'rect') return x > sh.x0 && x < sh.x1 && y > sh.y0 && y < sh.y1;
    if (sh.kind === 'ellipse') return ((x - sh.cx) / sh.rx) ** 2 + ((y - sh.cy) / sh.ry) ** 2 < 1;
    if (sh.kind === 'line') {
      for (let i = 0; i + 1 < sh.pts.length; i++) if (distToSeg(x, y, sh.pts[i], sh.pts[i + 1]) < (sh.width || 200) / 2) return true;
    }
    return false;
  }
  /**
   * O retângulo do chão (cm) que aparece na tela, com `pad` cm de folga: as quatro quinas da tela (z = 0) desprojetadas.
   * (Num mapa grande — a represa de 400 × 320 m —, só o que está aqui entra nas contas de cada quadro.)
   */
  function groundView(world, pad) {
    const cam = world.cam;
    const v = world._viewRect(0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [wx, wy] of [[v.x0, v.y0], [v.x1, v.y0], [v.x0, v.y1], [v.x1, v.y1]]) {
      const g = cam.groundAt(wx, wy);
      x0 = Math.min(x0, g.x);
      y0 = Math.min(y0, g.y);
      x1 = Math.max(x1, g.x);
      y1 = Math.max(y1, g.y);
    }
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }
  /** O polígono `pts` cortado pelo retângulo `r` (Sutherland–Hodgman: serve para polígono côncavo também, no recorte). */
  function clipToRect(pts, r) {
    let out = pts;
    const edges = [
      [(q) => q.x >= r.x0, (a, b) => ({ x: r.x0, y: a.y + ((b.y - a.y) * (r.x0 - a.x)) / (b.x - a.x) })],
      [(q) => q.x <= r.x1, (a, b) => ({ x: r.x1, y: a.y + ((b.y - a.y) * (r.x1 - a.x)) / (b.x - a.x) })],
      [(q) => q.y >= r.y0, (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y0 - a.y)) / (b.y - a.y), y: r.y0 })],
      [(q) => q.y <= r.y1, (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y1 - a.y)) / (b.y - a.y), y: r.y1 })],
    ];
    for (const [inside, cross] of edges) {
      if (!out.length) break;
      const src = out;
      out = [];
      for (let i = 0; i < src.length; i++) {
        const a = src[(i + src.length - 1) % src.length], b = src[i];
        const ia = inside(a), ib = inside(b);
        if (ib) {
          if (!ia) out.push(cross(a, b));
          out.push(b);
        } else if (ia) out.push(cross(a, b));
      }
    }
    return out;
  }
  /**
   * A água que aparece na tela, em polígonos do chão (cm): os de fora ficam de fora e os grandes saem cortados no
   * pedaço da tela (o recorte com a represa inteira, de ~1.000 pontos, custava 10 ms por quadro). Guardado enquanto a
   * câmera não mexe.
   */
  function visiblePolys(world, R) {
    const cam = world.cam;
    const key = cam.viewX + '|' + cam.viewY + '|' + cam.zoom + '|' + cam.viewW + '|' + cam.viewH;
    if (R._visKey === key) return R._vis;
    const g = groundView(world, 200);
    const out = [];
    R.polys.forEach((pts, i) => {
      const b = R.boxes[i];
      if (b.x1 < g.x0 || b.x0 > g.x1 || b.y1 < g.y0 || b.y0 > g.y1) return;
      const inside = b.x0 >= g.x0 && b.x1 <= g.x1 && b.y0 >= g.y0 && b.y1 <= g.y1;
      const c = inside ? pts : clipToRect(pts, g);
      if (c.length > 2) out.push(c);
    });
    R._visKey = key;
    R._vis = out;
    return out;
  }
  function boxOf(sh) {
    if (sh.kind === 'rect') return { x0: sh.x0, y0: sh.y0, x1: sh.x1, y1: sh.y1 };
    if (sh.kind === 'ellipse') return { x0: sh.cx - sh.rx, y0: sh.cy - sh.ry, x1: sh.cx + sh.rx, y1: sh.cy + sh.ry };
    const pad = sh.kind === 'line' ? (sh.width || 200) / 2 : 0;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of sh.pts) {
      x0 = Math.min(x0, q.x - pad);
      y0 = Math.min(y0, q.y - pad);
      x1 = Math.max(x1, q.x + pad);
      y1 = Math.max(y1, q.y + pad);
    }
    return { x0, y0, x1, y1 };
  }

  function prepare(world) {
    const map = world.map || {};
    const waters = (map.shapes || []).filter((s) => s.type === 'agua');
    const seeds = [];
    const shore = [];
    // o que fica em cima da água (deque, píer): lá não tem ondinha (o deque é desenhado por cima, mas fica mais limpo)
    const decks = (map.flats || []).filter((f) => f.kind === 'deque');
    const onDeck = (x, y) => decks.some((d) => x > d.x0 - 30 && x < d.x1 + 30 && y > d.y0 - 30 && y < d.y1 + 30);
    for (const sh of waters) {
      const b = boxOf(sh);
      const r = M.rng(Math.round(b.x0 * 7 + b.y0 * 13) + 99);
      for (let x = b.x0 + STEP / 2; x < b.x1; x += STEP) {
        for (let y = b.y0 + STEP / 2; y < b.y1; y += STEP) {
          const px = x + (r() - 0.5) * STEP * 0.8, py = y + (r() - 0.5) * STEP * 0.8;
          if (!insideShape(sh, px, py) || onDeck(px, py)) continue;
          seeds.push({ x: px, y: py, ph: r(), per: 3.2 + r() * 3.4, size: 26 + r() * 30, glint: r() < 0.32, gph: r(), gper: 2 + r() * 3.5, tilt: (r() - 0.5) * 0.5 });
        }
      }
      // a beira (só nos polígonos e nas elipses): pontos ao longo dela para a espuma respirar
      const ring = sh.kind === 'poly' ? sh.pts : sh.kind === 'ellipse' ? Array.from({ length: 48 }, (_, i) => ({ x: sh.cx + Math.cos((i / 48) * M.TAU) * sh.rx, y: sh.cy + Math.sin((i / 48) * M.TAU) * sh.ry })) : null;
      if (ring) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], c = ring[(i + 1) % ring.length];
          const L = Math.hypot(c.x - a.x, c.y - a.y);
          for (let d = 0; d < L; d += SHORE_STEP) {
            const t = d / L;
            const x = a.x + (c.x - a.x) * t, y = a.y + (c.y - a.y) * t;
            // (a beira da água que fica na beirada do mapa não é margem)
            if (x < 20 || y < 20 || x > (map.w || 1e9) - 20 || y > (map.h || 1e9) - 20 || onDeck(x, y)) continue;
            shore.push({ x, y, nx: c.y - a.y, ny: -(c.x - a.x), len: L, ph: r(), per: 4 + r() * 3 });
          }
        }
      }
    }
    for (const s of shore) {
      const n = Math.hypot(s.nx, s.ny) || 1;
      s.nx /= n;
      s.ny /= n;
    }
    world._water = { seeds, shore };
  }

  function star(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x - s * 0.18, y - s * 0.18);
    ctx.lineTo(x, y - s * 0.7);
    ctx.lineTo(x + s * 0.18, y - s * 0.18);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s * 0.18, y + s * 0.18);
    ctx.lineTo(x, y + s * 0.7);
    ctx.lineTo(x - s * 0.18, y + s * 0.18);
    ctx.closePath();
    ctx.fill();
  }

  function live(ctx, world, t) {
    const W = world._water;
    if (!W || (!W.seeds.length && !W.shore.length)) return;
    const cam = world.cam;
    const view = world._viewRect(60);
    const day = world.daylight == null ? 1 : world.daylight;
    const wind = world.wind || { strength: 0.35, angle: -Math.PI / 4 };
    const wx = Math.cos(wind.angle), wy = Math.sin(wind.angle);
    const ws = world.windScreen ? world.windScreen() : { x: 1, y: 0 };
    const face = Math.atan2(ws.y, ws.x);
    const z = cam.zoom;
    const push = 30 + 40 * Math.min(1.2, wind.strength);
    const g = groundView(world, 200);
    ctx.save();
    ctx.lineCap = 'round';
    // as ondinhas
    for (const s of W.seeds) {
      if (s.x < g.x0 || s.x > g.x1 || s.y < g.y0 || s.y > g.y1) continue;
      const ph = (t / s.per + s.ph) % 1;
      const d = (ph - 0.5) * push;
      const q = cam.p({ x: s.x + wx * d, y: s.y + wy * d, z: 0 });
      if (q.x < view.x0 || q.x > view.x1 || q.y < view.y0 || q.y > view.y1) continue;
      const a = Math.sin(Math.PI * ph);
      ctx.strokeStyle = `rgba(214, 246, 238, ${(a * (0.22 + 0.2 * day)).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, 2.6 * z);
      const r = s.size * z * (0.8 + 0.3 * ph);
      ctx.beginPath();
      // (achatada como o chão, curvada para o lado de onde o vento vem)
      ctx.ellipse(q.x, q.y, r, r * 0.45, s.tilt, face + Math.PI - 0.75, face + Math.PI + 0.75);
      ctx.stroke();
      if (s.glint) {
        const g = Math.sin(M.TAU * (t / s.gper + s.gph));
        if (g > 0.9) {
          const k = (g - 0.9) / 0.1;
          ctx.fillStyle = `rgba(255, 255, 248, ${(k * (0.15 + 0.75 * day)).toFixed(3)})`;
          star(ctx, q.x + r * 0.3, q.y - r * 0.1, (5 + 6 * k) * z);
        }
      }
    }
    // a espuma da margem indo e voltando
    for (const s of W.shore) {
      if (s.x < g.x0 || s.x > g.x1 || s.y < g.y0 || s.y > g.y1) continue;
      const ph = (t / s.per + s.ph) % 1;
      const out = Math.sin(M.TAU * ph);
      const q = cam.p({ x: s.x + s.nx * (6 + 10 * out), y: s.y + s.ny * (6 + 10 * out), z: 0 });
      if (q.x < view.x0 || q.x > view.x1 || q.y < view.y0 || q.y > view.y1) continue;
      const a = 0.12 + 0.16 * (0.5 + 0.5 * out);
      ctx.strokeStyle = `rgba(226, 250, 244, ${(a * (0.5 + 0.5 * day)).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, 3.2 * z);
      const e = cam.p({ x: s.x + s.nx * (6 + 10 * out) - s.ny * 70, y: s.y + s.ny * (6 + 10 * out) + s.nx * 70, z: 0 });
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ o reflexo
  /** A água do mapa em polígonos (cm do chão), para recortar o reflexo: a elipse em 40 pontos e a linha com a largura. */
  function waterPolys(map) {
    const out = [];
    for (const sh of (map.shapes || []).filter((x) => x.type === 'agua')) {
      if (sh.kind === 'poly') out.push(sh.pts);
      else if (sh.kind === 'rect') out.push([{ x: sh.x0, y: sh.y0 }, { x: sh.x1, y: sh.y0 }, { x: sh.x1, y: sh.y1 }, { x: sh.x0, y: sh.y1 }]);
      else if (sh.kind === 'ellipse') out.push(Array.from({ length: 40 }, (_, i) => ({ x: sh.cx + Math.cos((i / 40) * M.TAU) * sh.rx, y: sh.cy + Math.sin((i / 40) * M.TAU) * sh.ry })));
      else if (sh.kind === 'line' && sh.pts.length > 1) {
        // a faixa da linha: os dois lados, cada ponto empurrado meia largura para fora (pela média das duas pontas vizinhas)
        const hw = (sh.width || 200) / 2;
        const L = [], R = [];
        sh.pts.forEach((q, i) => {
          const a = sh.pts[Math.max(0, i - 1)], b = sh.pts[Math.min(sh.pts.length - 1, i + 1)];
          const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
          L.push({ x: q.x - (dy / l) * hw, y: q.y + (dx / l) * hw });
          R.push({ x: q.x + (dy / l) * hw, y: q.y - (dx / l) * hw });
        });
        out.push(L.concat(R.reverse()));
      }
    }
    return out;
  }
  /**
   * Quem reflete: o que tem água logo à frente do pé (para o lado da câmera, até ~4 m) ou embaixo dele. Os móveis de
   * dentro de casa não. Água embaixo do deque não conta: o deque é desenhado por cima do reflexo, então o banco, a
   * fogueira e o caixote do meio do deque não refletem (o reflexo deles ia todo para baixo das tábuas); o lampião da
   * beirada reflete na água da frente. Feito uma vez por mapa.
   */
  function reflectables(world) {
    if (world._refl) return world._refl;
    const map = world.map || {};
    const polys = waterPolys(map);
    const R = (world._refl = { props: [], polys, boxes: polys.map((pts) => boxOf({ kind: 'poly', pts })) });
    if (!R.polys.length || !PD.chao || !PD.chao.under) return R;
    const decks = (map.flats || []).filter((f) => f.kind === 'deque');
    const wet = (x, y) => !decks.some((d) => x > d.x0 && x < d.x1 && y > d.y0 && y < d.y1) && PD.chao.under(map, x, y, Infinity) === 'agua';
    for (const o of world.props || []) {
      // (o aguapé boia: o reflexo dele cairia como uma cópia fantasma logo embaixo)
      if (o.house || !o.fp || (o.d && o.d.kind === 'aguape')) continue;
      const t = o.t;
      const f = o.fp;
      const bases = t ? [[t.x, t.y]] : [[f.x1, f.y1], [f.x0, f.y1], [f.x1, f.y0], [(f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2]];
      let near = false;
      for (const [bx, by] of bases) {
        for (const d of [0, 60, 140, 240, 380]) {
          if (wet(bx + d * 0.7, by + d * 0.7) || wet(bx + d, by) || wet(bx, by + d)) {
            near = true;
            break;
          }
        }
        if (near) break;
      }
      if (near) R.props.push(o);
    }
    return R;
  }
  /** A parte da imagem acima da linha `yb` (y da tela), virada para baixo dela. Fatia `[i0, i1)` da largura (0 a 1). */
  function flipSlice(ctx, s, yb, f0, f1) {
    const hp = (yb - s.y) / s.h;
    if (hp <= 0.01) return;
    const k = Math.min(1, hp);
    const sw = s.c.width, sh = s.c.height;
    ctx.save();
    ctx.translate(0, 2 * yb);
    ctx.scale(1, -1);
    ctx.drawImage(s.c, sw * f0, 0, sw * (f1 - f0), sh * k, s.x + s.w * f0, s.y, s.w * (f1 - f0) + 0.6, s.h * k);
    ctx.restore();
  }
  /**
   * A parte `[f0, f1)` da largura da imagem, virada em torno da RETA da tela que passa por P com inclinação `m` (y = P.y
   * + m·(x − P.x)): cada ponto vai para y' = 2·(P.y + m·(x − P.x)) − y. É uma conta só para a fatia inteira (uma
   * transformação do canvas), então a beira da base, que é diagonal, sai certinha, sem degrau.
   */
  function flipAlong(ctx, s, P, m, f0, f1, hk) {
    const sw = s.c.width, sh = s.c.height;
    ctx.save();
    ctx.transform(1, 2 * m, 0, -1, 0, 2 * (P.y - m * P.x));
    ctx.drawImage(s.c, sw * f0, 0, sw * (f1 - f0), sh * hk, s.x + s.w * f0, s.y, s.w * (f1 - f0), s.h * hk);
    ctx.restore();
  }
  function reflectOne(ctx, cam, o) {
    // (só imagem pronta: o reflexo não manda refazer nenhuma)
    const s = o.sprite;
    if (!s || !s.c || o.spriteKey !== o._zoomKey()) return;
    if (o.t) {
      flipSlice(ctx, s, cam.p({ x: o.t.x, y: o.t.y, z: 0 }).y, 0, 1);
      return;
    }
    const f = o.fp;
    const wz = o.d && o.d.kind === 'barco' ? -24 : o.z0 || 0;
    const C = cam.p({ x: f.x1, y: f.y1, z: wz }), B = cam.p({ x: f.x1, y: f.y0, z: wz }), D = cam.p({ x: f.x0, y: f.y1, z: wz });
    // (o que é rente à água — o aguapé, a folha — não tem reflexo que apareça: ele cairia em cima de si mesmo)
    if (C.y - s.y < 26 * cam.zoom) return;
    if (B.x - D.x < 60 * cam.zoom) {
      flipSlice(ctx, s, C.y, 0, 1);
      return;
    }
    // largo (a casa, o barco, o muro): a metade da esquerda vira na beira D→C da base e a da direita na beira C→B
    const hk = Math.min(1, (C.y - s.y) / s.h);
    const fc = M.clamp((C.x - s.x) / s.w, 0, 1);
    if (fc > 0) flipAlong(ctx, s, C, (C.y - D.y) / Math.max(1, C.x - D.x), 0, fc, hk);
    if (fc < 1) flipAlong(ctx, s, C, (B.y - C.y) / Math.max(1, B.x - C.x), fc, 1, hk);
  }
  function reflect(ctx, world, t) {
    const R = reflectables(world);
    if (!R.props.length) return;
    const cam = world.cam;
    const view = world._viewRect(60);
    // quem tem o reflexo na tela (o reflexo ocupa da base para baixo o tanto que o objeto sobe)
    const list = [];
    for (const o of R.props) {
      const b = o.bounds;
      if (!b || b.x1 < view.x0 || b.x0 > view.x1) continue;
      const base = o.t ? cam.p({ x: o.t.x, y: o.t.y, z: 0 }).y : cam.p({ x: o.fp.x1, y: o.fp.y1, z: 0 }).y;
      if (base > view.y1 || base + (base - b.y0) < view.y0) continue;
      list.push(o);
    }
    if (!list.length) return;
    const clip = new Path2D();
    for (const poly of visiblePolys(world, R)) {
      poly.forEach((q, i) => {
        const p = cam.p({ x: q.x, y: q.y, z: 0 });
        if (i) clip.lineTo(p.x, p.y);
        else clip.moveTo(p.x, p.y);
      });
      clip.closePath();
    }
    const day = world.daylight == null ? 1 : world.daylight;
    ctx.save();
    ctx.clip(clip);
    ctx.globalAlpha = 0.24 + 0.08 * day;
    for (const o of list) reflectOne(ctx, cam, o);
    ctx.restore();
  }

  /**
   * A água do mapa como um caminho na tela, já dividido por `Q` (a camada do escuro da noite é menor que a tela: view.js).
   * `toScreen(x, y)`: cm do chão → px da tela. Sem água no mapa, null.
   */
  function screenWater(world, toScreen, Q) {
    const R = reflectables(world);
    if (!R.polys.length) return null;
    const polys = visiblePolys(world, R);
    if (!polys.length) return null;
    const path = new Path2D();
    for (const poly of polys) {
      poly.forEach((q, i) => {
        const p = toScreen(q.x, q.y);
        if (i) path.lineTo(p.x / Q, p.y / Q);
        else path.moveTo(p.x / Q, p.y / Q);
      });
      path.closePath();
    }
    return path;
  }

  PD.agua = { prepare, live, reflect, screenWater };
})(window.PD = window.PD || {});
