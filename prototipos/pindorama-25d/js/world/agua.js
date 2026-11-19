// A água mexendo (pedido do dono, 17/11: "água não tem movimentação"; desenho do [mundo] desde 19/11). O chão da água
// (o fundo, a margem e as marolas paradas) sai pintado uma vez só, em pedaços (ground.js); por cima dele, a cada quadro:
//  - as ondinhas: arcos finos e claros que aparecem, andam um pouco no sentido do vento e somem, cada uma no seu tempo;
//  - os brilhos do sol: estrelinhas que piscam de vez em quando (de dia; à noite, bem fracos, a luz da lua);
//  - a espuma da margem respirando: a beira clara indo e voltando devagar.
// Os pontos são sorteados uma vez, numa grade dentro de cada água do mapa (`agua` no chão: polígono, retângulo,
// elipse ou linha com largura), e só os que estão na tela são desenhados.
//   PD.agua.prepare(world)          monta os pontos (World, ao ler o mapa)
//   PD.agua.live(ctx, world, t)     desenha (World.draw, logo depois do chão e antes do deque)
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
    ctx.save();
    ctx.lineCap = 'round';
    // as ondinhas
    for (const s of W.seeds) {
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

  PD.agua = { prepare, live };
})(window.PD = window.PD || {});
