// Formas 2D para o estilo "HQ": casco convexo de círculos (a projeção de um grupo de esferas), caminhos,
// contorno de tinta com espessura variando, sombra em meia-lua e brilho.
//
// Por que esferas: numa câmera ortográfica, uma esfera vira sempre um círculo do mesmo tamanho, e o casco
// de várias esferas vira o casco dos círculos. Então uma coxa feita de 3 esferas tem a silhueta certa de
// qualquer ângulo — é isso que mantém o personagem igual em todas as direções.
(function (PD) {
  'use strict';
  const { TAU, clamp } = PD.math;

  /** Casco convexo de pontos [x0, y0, x1, y1, ...] (cadeia monótona). Devolve no mesmo formato. */
  function convexHull(flat) {
    const n = flat.length / 2;
    if (n < 3) return flat.slice();
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    idx.sort((a, b) => flat[2 * a] - flat[2 * b] || flat[2 * a + 1] - flat[2 * b + 1]);
    const crossO = (o, a, b) =>
      (flat[2 * a] - flat[2 * o]) * (flat[2 * b + 1] - flat[2 * o + 1]) - (flat[2 * a + 1] - flat[2 * o + 1]) * (flat[2 * b] - flat[2 * o]);
    const lower = [];
    for (const i of idx) {
      while (lower.length >= 2 && crossO(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) lower.pop();
      lower.push(i);
    }
    const upper = [];
    for (let k = n - 1; k >= 0; k--) {
      const i = idx[k];
      while (upper.length >= 2 && crossO(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) upper.pop();
      upper.push(i);
    }
    lower.pop();
    upper.pop();
    const out = [];
    for (const i of lower.concat(upper)) out.push(flat[2 * i], flat[2 * i + 1]);
    return out;
  }

  /**
   * Casco de círculos [{x, y, r}] em px. `density` = pontos por px de raio (mais na tela grande).
   * Devolve o polígono [x0, y0, ...].
   */
  function circleHull(circles, density = 0.9) {
    const pts = [];
    for (const c of circles) {
      if (c.r <= 0.05) {
        pts.push(c.x, c.y);
        continue;
      }
      const n = clamp(Math.round(c.r * density * 2), 8, 40);
      const off = (c.x * 0.013 + c.y * 0.007) % 1; // espalha os pontos: o casco não fica "facetado" igual
      for (let i = 0; i < n; i++) {
        const a = ((i + off) / n) * TAU;
        pts.push(c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r);
      }
    }
    return convexHull(pts);
  }

  /** Caminho fechado de um polígono, opcionalmente deslocado. */
  function polyPath(poly, dx = 0, dy = 0, path = new Path2D()) {
    if (poly.length < 6) return path;
    path.moveTo(poly[0] + dx, poly[1] + dy);
    for (let i = 2; i < poly.length; i += 2) path.lineTo(poly[i] + dx, poly[i + 1] + dy);
    path.closePath();
    return path;
  }

  /** Caminho de uma linha (aberta) por pontos [{x, y}]. */
  function linePath(pts) {
    const p = new Path2D();
    if (!pts.length) return p;
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
    return p;
  }

  /** Caminho suave (curvas pelos pontos médios) de uma linha aberta. */
  function smoothLinePath(pts, path = new Path2D()) {
    if (pts.length < 2) return path;
    path.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      path.lineTo(pts[1].x, pts[1].y);
      return path;
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      path.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    path.lineTo(last.x, last.y);
    return path;
  }

  /** Caminho suave e fechado por pontos [{x, y}]. */
  function smoothClosedPath(pts, path = new Path2D()) {
    const n = pts.length;
    if (n < 3) return path;
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const start = mid(pts[n - 1], pts[0]);
    path.moveTo(start.x, start.y);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      path.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    path.closePath();
    return path;
  }

  /** Raio médio aproximado de um polígono (para medir sombras e brilhos). */
  function polyRadius(poly) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < poly.length; i += 2) {
      if (poly[i] < minX) minX = poly[i];
      if (poly[i] > maxX) maxX = poly[i];
      if (poly[i + 1] < minY) minY = poly[i + 1];
      if (poly[i + 1] > maxY) maxY = poly[i + 1];
    }
    return Math.min(maxX - minX, maxY - minY) / 2;
  }

  /** Área com sinal de um polígono [x0, y0, ...] (o sinal diz o sentido dos vértices). */
  function signedArea(p) {
    let a = 0;
    for (let i = 0, n = p.length; i < n; i += 2) {
      const j = (i + 2) % n;
      a += p[i] * p[j + 1] - p[j] * p[i + 1];
    }
    return a / 2;
  }
  /** Recorta o polígono `subject` pelo polígono CONVEXO `clip` (Sutherland–Hodgman). */
  function clipConvex(subject, clip) {
    let out = subject;
    const n = clip.length;
    const sgn = signedArea(clip) >= 0 ? 1 : -1;
    for (let i = 0; i < n && out.length >= 6; i += 2) {
      const ax = clip[i], ay = clip[i + 1];
      const bx = clip[(i + 2) % n], by = clip[(i + 3) % n];
      const ex = bx - ax, ey = by - ay;
      const input = out;
      out = [];
      const m = input.length;
      let px = input[m - 2], py = input[m - 1];
      let pd = sgn * (ex * (py - ay) - ey * (px - ax));
      for (let j = 0; j < m; j += 2) {
        const cx = input[j], cy = input[j + 1];
        const cd = sgn * (ex * (cy - ay) - ey * (cx - ax));
        if ((cd >= 0) !== (pd >= 0)) {
          const t = pd / (pd - cd);
          out.push(px + (cx - px) * t, py + (cy - py) * t);
        }
        if (cd >= 0) out.push(cx, cy);
        px = cx;
        py = cy;
        pd = cd;
      }
    }
    return out;
  }
  /**
   * Polígono convexo "inchado" de w para fora (cada vértice anda pela média das normais das arestas)
   * e deslocado de (dx, dy). Bem mais barato que refazer o casco: serve para os contornos.
   */
  function offsetConvex(p, w, dx = 0, dy = 0) {
    const n = p.length;
    const out = new Array(n);
    const sgn = signedArea(p) >= 0 ? 1 : -1;
    for (let i = 0; i < n; i += 2) {
      const px = p[(i - 2 + n) % n], py = p[(i - 1 + n) % n];
      const cx = p[i], cy = p[i + 1];
      const nx = p[(i + 2) % n], ny = p[(i + 3) % n];
      // normais para fora das duas arestas que chegam neste vértice
      let ax = cy - py, ay = -(cx - px);
      let bx = ny - cy, by = -(nx - cx);
      const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
      ax /= la; ay /= la; bx /= lb; by /= lb;
      let mx = ax + bx, my = ay + by;
      const lm = Math.hypot(mx, my) || 1;
      const k = (w * sgn) / Math.max(0.35, (mx * ax + my * ay) / lm) / lm;
      out[i] = cx - mx * k + dx;
      out[i + 1] = cy - my * k + dy;
    }
    return out;
  }
  const shifted = (p, dx, dy) => {
    const out = new Array(p.length);
    for (let i = 0; i < p.length; i += 2) {
      out[i] = p[i] + dx;
      out[i + 1] = p[i + 1] + dy;
    }
    return out;
  };

  /**
   * Pinta um volume CONVEXO (os cascos de círculos são sempre convexos) sem usar máscara:
   * sombra por baixo de tudo, depois a parte iluminada por cima, depois o miolo na cor base —
   * sobram a meia-lua de sombra (lado contrário à luz) e a faixa de brilho (lado da luz).
   */
  function paintConvex(ctx, poly, mat, light, k, opts = {}) {
    const path = polyPath(poly);
    if (k <= 0.2) {
      ctx.fillStyle = mat.base;
      ctx.fill(path);
      return path;
    }
    const hk = mat.light && opts.highlight !== false ? k * (opts.highlightScale ?? 0.42) : 0;
    ctx.fillStyle = mat.shade;
    ctx.fill(path);
    const lit = clipConvex(poly, shifted(poly, light.x * k, light.y * k));
    if (lit.length >= 6) {
      if (hk > 0) {
        ctx.fillStyle = mat.light;
        ctx.fill(polyPath(lit));
        const core = clipConvex(lit, shifted(poly, -light.x * hk, -light.y * hk));
        if (core.length >= 6) {
          ctx.fillStyle = mat.base;
          ctx.fill(polyPath(core));
        }
      } else {
        ctx.fillStyle = mat.base;
        ctx.fill(polyPath(lit));
      }
    }
    return path;
  }

  /**
   * Pinta um volume no estilo HQ, já com o contorno feito à parte:
   * base, sombra em meia-lua do lado contrário à luz e brilho estreito do lado da luz.
   * `light` = direção da luz na tela (unitária). `k` = largura da sombra em px.
   */
  function paintVolume(ctx, poly, mat, light, k, opts = {}) {
    const path = polyPath(poly);
    ctx.fillStyle = mat.base;
    ctx.fill(path);
    if (k <= 0.2) return path;
    ctx.save();
    ctx.clip(path);
    // sombra: o que sobra do volume quando a cópia deslocada para a luz cobre o lado iluminado
    const shadow = polyPath(poly);
    polyPath(poly, light.x * k, light.y * k, shadow);
    ctx.fillStyle = mat.shade;
    ctx.fill(shadow, 'evenodd');
    // brilho: faixa fina do lado da luz
    if (mat.light && opts.highlight !== false) {
      const hk = k * (opts.highlightScale ?? 0.42);
      const hl = polyPath(poly);
      polyPath(poly, -light.x * hk, -light.y * hk, hl);
      ctx.fillStyle = mat.light;
      ctx.fill(hl, 'evenodd');
    }
    ctx.restore();
    return path;
  }

  /**
   * Contorno de tinta por fora do polígono, mais grosso do lado da sombra (peso de linha de HQ).
   * Desenhe ANTES da pintura: a pintura cobre a metade de dentro do traço.
   */
  function inkOutline(ctx, poly, ink, w, light) {
    const path = polyPath(poly);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = ink;
    ctx.lineWidth = w * 2;
    ctx.stroke(path);
    if (light) {
      const heavy = polyPath(poly, -light.x * w * 0.55, -light.y * w * 0.55);
      ctx.lineWidth = w * 2;
      ctx.stroke(heavy);
    }
    return path;
  }

  /** Testa se o ponto (x, y) está dentro do polígono. */
  function insidePoly(poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
      const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  PD.shapes = { convexHull, circleHull, polyPath, linePath, smoothLinePath, smoothClosedPath, polyRadius, paintVolume, paintConvex, clipConvex, offsetConvex, inkOutline, insidePoly };
})(window.PD = window.PD || {});
