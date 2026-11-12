// Objetos em pé do cenário (prédios, árvores, postes, muros, banca, orelhão...), no mesmo estilo HQ do
// personagem: contorno de tinta, 2 ou 3 tons, luz do alto à esquerda.
//
// Cada objeto é desenhado UMA vez numa imagem fora da tela (sprite) e depois só copiado. Só o que se mexe
// (copa balançando, semáforo) é tratado a cada quadro, e mesmo assim reaproveitando a imagem pronta.
(function (PD) {
  'use strict';
  const M = PD.math;
  const S = PD.shapes;
  const INK = '#1b100d';
  const FONT_SIGN = '"Bangers", "Impact", "Arial Black", sans-serif';

  // ------------------------------------------------------------------ base
  class Prop {
    constructor(world, fp, opts = {}) {
      this.world = world;
      this.cam = world.cam;
      this.fp = fp; // pé no chão (caixa): x0, x1, y0, y1
      this.z0 = world.ground.heightAt((fp.x0 + fp.x1) / 2, (fp.y0 + fp.y1) / 2);
      this.overhead = !!opts.overhead;
      this.fades = opts.fades !== false; // fica transparente quando esconde o personagem
      this.alpha = 1;
      this.spriteKey = '';
    }
    get ink() {
      return Math.max(1, 1.05 * this.cam.zoom);
    }
    P(x, y, z) {
      return this.cam.p({ x, y, z });
    }
    /** Caixa na tela (px do mundo) que o desenho ocupa — usada para o sprite e para esconder/mostrar. */
    screenBox() {
      return null;
    }
    paint() {}
    _ensureSprite() {
      const cam = this.cam;
      const key = `${cam.zoom.toFixed(4)}|${cam.dpr}`;
      if (this.sprite && this.spriteKey === key) return;
      const b = this.screenBox();
      const pad = 6;
      const x0 = Math.floor(b.x0 - pad), y0 = Math.floor(b.y0 - pad);
      const w = Math.ceil(b.x1 - b.x0 + 2 * pad), h = Math.ceil(b.y1 - b.y0 + 2 * pad);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * cam.dpr));
      c.height = Math.max(1, Math.ceil(h * cam.dpr));
      const ctx = c.getContext('2d');
      ctx.setTransform(cam.dpr, 0, 0, cam.dpr, -x0 * cam.dpr, -y0 * cam.dpr);
      this.paint(ctx);
      this.sprite = { c, x: x0, y: y0, w, h };
      this.spriteKey = key;
    }
    draw(ctx) {
      this._ensureSprite();
      const s = this.sprite;
      if (this.alpha < 0.999) ctx.globalAlpha = this.alpha;
      ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
      ctx.globalAlpha = 1;
    }
    /** Área da tela ocupada (para saber se esconde o personagem). */
    get bounds() {
      this._ensureSprite();
      const s = this.sprite;
      return { x0: s.x, y0: s.y, x1: s.x + s.w, y1: s.y + s.h };
    }
  }

  // ------------------------------------------------------------------ utilidades de desenho
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
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
  /** Desenha em cm numa parede (a = ao longo, b = para baixo a partir do alto `top`). */
  function onWall(ctx, cam, o, dir, fn) {
    ctx.save();
    const m = cam.wallMatrix(o, dir);
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    fn();
    ctx.restore();
  }
  /** Caixa 3D (faces +x, +y e de cima) com contorno de tinta. */
  function box(ctx, cam, x0, x1, y0, y1, z0, z1, colors, ink) {
    const P = (x, y, z) => cam.p({ x, y, z });
    const fy = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)];
    const fx = [P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)];
    const top = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
    const sil = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), P(x0, y1, z1)];
    poly(ctx, sil, null, INK, ink * 2.4);
    poly(ctx, fy, colors.front);
    poly(ctx, fx, colors.side);
    poly(ctx, top, colors.top);
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 0.8;
    ctx.beginPath();
    ctx.moveTo(fy[1].x, fy[1].y);
    ctx.lineTo(fy[2].x, fy[2].y);
    ctx.lineTo(fy[3].x, fy[3].y);
    ctx.moveTo(fy[2].x, fy[2].y);
    ctx.lineTo(fx[2].x, fx[2].y);
    ctx.stroke();
    return { fy, fx, top, sil };
  }
  /** Sombra (no chão) de uma caixa de altura h: casco do pé + topo empurrado pela luz. */
  function boxShadow(path, cam, x0, x1, y0, y1, h) {
    const L = cam.light;
    const dx = (-L.x / L.z) * h;
    const dy = (-L.y / L.z) * h;
    const pts = [];
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) pts.push(x, y, x + dx, y + dy);
    const hull = S.convexHull(pts);
    S.polyPath(hull, 0, 0, path);
  }
  function circleShadow(path, cam, x, y, r, h) {
    const L = cam.light;
    const cx = x - (L.x / L.z) * h;
    const cy = y - (L.y / L.z) * h;
    path.moveTo(cx + r, cy);
    path.ellipse(cx, cy, r * 1.15, r * 0.95, Math.atan2(-L.y, -L.x), 0, M.TAU);
  }
  function lineShadow(path, cam, x, y, h, w) {
    const L = cam.light;
    const ex = x - (L.x / L.z) * h;
    const ey = y - (L.y / L.z) * h;
    const nx = -(ey - y);
    const ny = ex - x;
    const l = Math.hypot(nx, ny) || 1;
    const ox = (nx / l) * w;
    const oy = (ny / l) * w;
    path.moveTo(x + ox, y + oy);
    path.lineTo(ex + ox * 0.6, ey + oy * 0.6);
    path.lineTo(ex - ox * 0.6, ey - oy * 0.6);
    path.lineTo(x - ox, y - oy);
    path.closePath();
  }

  // ------------------------------------------------------------------ prédio
  class Building extends Prop {
    constructor(world, b) {
      super(world, { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
      this.b = b;
      this.collider = { type: 'box', x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 };
    }
    screenBox() {
      const { x0, x1, y0, y1, h } = this.b;
      const z0 = this.z0;
      const pts = [this.P(x0, y1, z0), this.P(x1, y1, z0), this.P(x1, y0, z0), this.P(x0, y0, z0 + h + 220), this.P(x1, y0, z0 + h + 220), this.P(x0, y1 + 160, z0 + h)];
      return bbox(pts, 30 * this.cam.zoom);
    }
    shadow(path) {
      const b = this.b;
      boxShadow(path, this.cam, b.x0, b.x1, b.y0, b.y1, b.h);
    }
    contact(ctx) {
      const b = this.b;
      const g = ctx.createLinearGradient(0, b.y1, 0, b.y1 + 60);
      g.addColorStop(0, 'rgba(20,16,30,0.35)');
      g.addColorStop(1, 'rgba(20,16,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x0, b.y1, b.x1 - b.x0, 60);
      const g2 = ctx.createLinearGradient(b.x1, 0, b.x1 + 60, 0);
      g2.addColorStop(0, 'rgba(20,16,30,0.3)');
      g2.addColorStop(1, 'rgba(20,16,30,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(b.x1, b.y0, 60, b.y1 - b.y0);
    }
    paint(ctx) {
      const cam = this.cam;
      const b = this.b;
      const z0 = this.z0;
      const ink = this.ink;
      const wall = b.wall;
      const side = M.shade(wall, -0.28);
      const top = '#a9a397';
      box(ctx, cam, b.x0, b.x1, b.y0, b.y1, z0, z0 + b.h, { front: wall, side, top }, ink);
      const W = b.x1 - b.x0;
      const D = b.y1 - b.y0;
      // ---- fachada da frente (+y)
      onWall(ctx, cam, { x: b.x0, y: b.y1, z: z0 + b.h }, { x: 1, y: 0 }, () => {
        // manchas de chuva
        const r = M.rng(b.x0 + 3);
        ctx.fillStyle = 'rgba(60, 50, 40, 0.08)';
        for (let i = 0; i < 9; i++) ctx.fillRect(r() * W, 40, 20 + r() * 40, 120 + r() * (b.h - 200));
        // platibanda
        ctx.fillStyle = b.trim;
        ctx.fillRect(0, 0, W, 34);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 34, W, 8);
        // pichação (riscos altos e pontudos, sem palavra de ninguém)
        if (b.pixo) pixo(ctx, W, 60, M.rng(b.x0 + 9));
        // janelas dos andares de cima
        const upper = b.h - 330;
        const rows = Math.max(1, b.floors - 1);
        for (let f = 0; f < rows; f++) {
          const yTop = 70 + f * (upper / rows);
          const n = Math.max(2, Math.floor(W / 175));
          const gap = W / n;
          for (let k = 0; k < n; k++) {
            const wx = k * gap + gap / 2 - 52;
            window_(ctx, wx, yTop, 104, Math.min(130, upper / rows - 40), b, M.rng(b.x0 + f * 13 + k));
            if (b.balconies) balcony(ctx, wx - 18, yTop + Math.min(130, upper / rows - 40) + 2, 140);
            if (b.ac && k === (f + 1) % n && f < b.ac) acBox(ctx, wx + 104 + 6, yTop + 40);
          }
        }
        // térreo: loja
        shopFront(ctx, b, W, b.h - 320, 320);
      });
      // ---- fachada do lado (+x): começa na quina da frente (y1) e vai para o fundo — o texto sai na ordem certa
      onWall(ctx, cam, { x: b.x1, y: b.y1, z: z0 + b.h }, { x: 0, y: -1 }, () => {
        ctx.fillStyle = M.shade(b.trim, -0.25);
        ctx.fillRect(0, 0, D, 34);
        if (b.pixo) pixo(ctx, D, 60, M.rng(b.y0 + 21), 0.85);
        const rows = Math.max(1, b.floors - 1);
        const upper = b.h - 330;
        for (let f = 0; f < rows; f++) {
          const yTop = 70 + f * (upper / rows);
          const n = Math.max(1, Math.floor(D / 260));
          for (let k = 0; k < n; k++) {
            const wx = (k + 0.5) * (D / n) - 45;
            window_(ctx, wx, yTop, 90, Math.min(120, upper / rows - 40), b, M.rng(b.y0 + f * 5 + k), true);
          }
        }
        if (b.side && b.side.sign) {
          const sw = Math.min(D - 120, 420);
          sign(ctx, 60, b.h - 300, sw, 70, b.side.sign, '#2f6d4f', '#fff6dd');
        }
        // porta lateral / grade
        ctx.fillStyle = M.shade(side, -0.25);
        ctx.fillRect(D - 170, b.h - 240, 110, 240);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 5;
        ctx.strokeRect(D - 170, b.h - 240, 110, 240);
      });
      // ---- telhado: caixa d'água, antena, ar-condicionado
      if (b.tank) tank(ctx, cam, b.x0 + W * 0.3, b.y0 + D * 0.45, z0 + b.h, ink);
      if (b.antenna) antenna(ctx, cam, b.x0 + W * 0.75, b.y0 + D * 0.35, z0 + b.h, ink);
      // contorno de cima (platibanda)
      const tpts = [this.P(b.x0, b.y0, z0 + b.h), this.P(b.x1, b.y0, z0 + b.h), this.P(b.x1, b.y1, z0 + b.h), this.P(b.x0, b.y1, z0 + b.h)];
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = ink * 2.2;
      ctx.beginPath();
      ctx.moveTo(tpts[3].x, tpts[3].y + ink * 2);
      ctx.lineTo(tpts[2].x, tpts[2].y + ink * 2);
      ctx.lineTo(tpts[1].x - ink * 2, tpts[1].y);
      ctx.stroke();
      // toldo (sai da parede, em 3D) depois de tudo
      if (b.shop && b.shop.awning) awning(ctx, cam, b, z0, ink);
    }
  }

  function bbox(pts, pad = 0) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }

  function window_(ctx, x, y, w, h, b, r, sideFace) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.fillStyle = b.trim;
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    const lit = r() < 0.25;
    ctx.fillStyle = lit ? '#f3d38a' : sideFace ? '#4f6475' : '#6d8aa0';
    ctx.fillRect(x, y, w, h);
    // reflexo do céu (diagonal clara)
    if (!lit) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.15, y + h);
      ctx.lineTo(x + w * 0.55, y);
      ctx.lineTo(x + w * 0.8, y);
      ctx.lineTo(x + w * 0.4, y + h);
      ctx.fill();
    }
    // cortina ou grade
    const kind = r();
    if (kind < 0.3) {
      ctx.fillStyle = ['#e7b8a6', '#c9d9b8', '#e8dcae'][Math.floor(r() * 3)];
      ctx.fillRect(x, y, w * 0.35, h);
      ctx.fillRect(x + w * 0.65, y, w * 0.35, h);
    } else if (kind < 0.6) {
      ctx.strokeStyle = '#2a2a30';
      ctx.lineWidth = 5;
      for (let k = 1; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(x + (w * k) / 5, y);
        ctx.lineTo(x + (w * k) / 5, y + h);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.stroke();
    // peitoril
    ctx.fillStyle = M.shade(b.trim, -0.12);
    ctx.fillRect(x - 10, y + h + 4, w + 20, 12);
  }
  function balcony(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y, w, 14);
    ctx.strokeStyle = '#2b2b31';
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y - 70, w, 70);
    for (let k = 1; k < 7; k++) {
      ctx.beginPath();
      ctx.moveTo(x + (w * k) / 7, y - 70);
      ctx.lineTo(x + (w * k) / 7, y);
      ctx.stroke();
    }
  }
  function acBox(ctx, x, y) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 4, y - 4, 78, 54);
    ctx.fillStyle = '#d9d8d2';
    ctx.fillRect(x, y, 70, 46);
    ctx.strokeStyle = '#8f8e88';
    ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 8 + k * 8);
      ctx.lineTo(x + 40, y + 8 + k * 8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x + 54, y + 23, 12, 0, M.TAU);
    ctx.stroke();
  }
  function pixo(ctx, W, y, r, alpha = 1) {
    ctx.globalAlpha = 0.82 * alpha;
    ctx.strokeStyle = '#111014';
    ctx.lineWidth = 9;
    ctx.lineCap = 'square';
    let x = 30 + r() * 40;
    while (x < W - 90) {
      const h = 70 + r() * 50;
      const kind = r();
      ctx.beginPath();
      if (kind < 0.35) {
        ctx.moveTo(x, y + h);
        ctx.lineTo(x, y);
        ctx.lineTo(x + 22, y + 18);
        ctx.lineTo(x + 22, y + h);
      } else if (kind < 0.65) {
        ctx.moveTo(x, y + h);
        ctx.lineTo(x + 12, y);
        ctx.lineTo(x + 24, y + h);
        ctx.moveTo(x + 5, y + h * 0.6);
        ctx.lineTo(x + 20, y + h * 0.6);
      } else {
        ctx.moveTo(x + 22, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + 22, y + h);
        ctx.moveTo(x, y + h * 0.5);
        ctx.lineTo(x + 16, y + h * 0.5);
      }
      ctx.stroke();
      x += 38 + r() * 10;
      if (r() < 0.12) x += 50;
    }
    ctx.globalAlpha = 1;
  }
  function sign(ctx, x, y, w, h, text, bg, fg) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, w, h * 0.35);
    ctx.fillStyle = fg;
    ctx.font = `${Math.round(h * 0.78)}px ${FONT_SIGN}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.strokeText(text, x + w / 2, y + h * 0.56);
    ctx.fillText(text, x + w / 2, y + h * 0.56);
  }
  function shopFront(ctx, b, W, y, H) {
    const s = b.shop || {};
    // base do térreo um pouco mais escura
    ctx.fillStyle = M.shade(b.wall, -0.08);
    ctx.fillRect(0, y, W, H);
    const signH = 78;
    if (s.sign) sign(ctx, 40, y + 14, W - 80, signH, s.sign, s.awning ? s.awning[0] : '#444', '#fff8e6');
    const oy = y + 120;
    const oh = H - 120;
    if (s.type === 'bar' || s.type === 'lanches') {
      // porta de aço de enrolar, meio aberta
      const ox = 50;
      const ow = W - 100;
      ctx.fillStyle = INK;
      ctx.fillRect(ox - 6, oy - 6, ow + 12, oh + 6);
      ctx.fillStyle = '#3b2f2a';
      ctx.fillRect(ox, oy, ow, oh);
      ctx.fillStyle = '#f1c86a';
      ctx.globalAlpha = 0.35;
      ctx.fillRect(ox, oy + oh * 0.45, ow, oh * 0.55);
      ctx.globalAlpha = 1;
      const shut = oh * 0.42;
      ctx.fillStyle = '#9da1a6';
      ctx.fillRect(ox, oy, ow, shut);
      ctx.strokeStyle = '#6f7378';
      ctx.lineWidth = 4;
      for (let yy = oy + 10; yy < oy + shut; yy += 14) {
        ctx.beginPath();
        ctx.moveTo(ox, yy);
        ctx.lineTo(ox + ow, yy);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ox, oy + shut);
      ctx.lineTo(ox + ow, oy + shut);
      ctx.stroke();
      // balcão e garrafas lá dentro
      ctx.fillStyle = '#6b3f2a';
      ctx.fillRect(ox + 20, oy + oh - 80, ow - 40, 80);
      const r = M.rng(b.x0);
      for (let k = 0; k < 9; k++) {
        ctx.fillStyle = ['#3d7a4a', '#7a4a2a', '#c9a64a'][k % 3];
        ctx.fillRect(ox + 40 + k * ((ow - 80) / 9), oy + shut + 18 + r() * 8, 14, 40);
      }
    } else if (s.type === 'portaria') {
      // portão de prédio com interfone
      ctx.fillStyle = INK;
      ctx.fillRect(W / 2 - 96, oy - 6, 192, oh + 6);
      ctx.fillStyle = '#2f3438';
      ctx.fillRect(W / 2 - 90, oy, 180, oh);
      ctx.strokeStyle = '#6c757c';
      ctx.lineWidth = 6;
      for (let k = 1; k < 9; k++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 - 90 + k * 20, oy);
        ctx.lineTo(W / 2 - 90 + k * 20, oy + oh);
        ctx.stroke();
      }
      ctx.fillStyle = '#e8e2d2';
      ctx.fillRect(W / 2 + 110, oy + 60, 40, 60);
      // número
      ctx.fillStyle = INK;
      ctx.font = `60px ${FONT_SIGN}`;
      ctx.textAlign = 'center';
      ctx.fillText('1340', W / 2, oy - 24);
    } else {
      // vitrine de vidro com porta
      ctx.fillStyle = INK;
      ctx.fillRect(34, oy - 6, W - 68, oh + 6);
      ctx.fillStyle = '#89a8b8';
      ctx.fillRect(40, oy, W - 80, oh);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(60 + k * (W / 3), oy + oh);
        ctx.lineTo(140 + k * (W / 3), oy);
        ctx.lineTo(180 + k * (W / 3), oy);
        ctx.lineTo(100 + k * (W / 3), oy + oh);
        ctx.fill();
      }
      // prateleiras (pães, frutas)
      const r = M.rng(b.x0 + 2);
      const colors = s.type === 'padaria' ? ['#d99a4e', '#b8743a', '#f0c27a'] : ['#e04a3a', '#f2b632', '#6fae3f', '#f07a2a'];
      for (let row = 0; row < 3; row++) {
        ctx.fillStyle = '#7d5a3c';
        ctx.fillRect(50, oy + 40 + row * 50, W * 0.4, 8);
        for (let k = 0; k < 7; k++) {
          ctx.fillStyle = colors[Math.floor(r() * colors.length)];
          ctx.beginPath();
          ctx.ellipse(62 + k * (W * 0.055), oy + 30 + row * 50, 12, 9, 0, 0, M.TAU);
          ctx.fill();
        }
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.strokeRect(W - 230, oy, 130, oh);
      ctx.beginPath();
      ctx.moveTo(W - 165, oy);
      ctx.lineTo(W - 165, oy + oh);
      ctx.stroke();
    }
  }
  function awning(ctx, cam, b, z0, ink) {
    const P = (x, y, z) => cam.p({ x, y, z });
    const xa = b.x0 + 30;
    const xb = b.x1 - 30;
    const zTop = z0 + 222;
    const zLow = z0 + 175;
    const out = 120;
    const [c1, c2] = b.shop.awning;
    const n = Math.max(4, Math.round((xb - xa) / 55));
    const quads = [];
    for (let k = 0; k < n; k++) {
      const a0 = xa + ((xb - xa) * k) / n;
      const a1 = xa + ((xb - xa) * (k + 1)) / n;
      quads.push({ pts: [P(a0, b.y1, zTop), P(a1, b.y1, zTop), P(a1, b.y1 + out, zLow), P(a0, b.y1 + out, zLow)], c: k % 2 ? c2 : c1 });
    }
    const outline = [P(xa, b.y1, zTop), P(xb, b.y1, zTop), P(xb, b.y1 + out, zLow), P(xb, b.y1 + out, zLow - 30), P(xa, b.y1 + out, zLow - 30), P(xa, b.y1 + out, zLow)];
    poly(ctx, outline, null, INK, ink * 2.4);
    for (const q of quads) poly(ctx, q.pts, q.c);
    // franja (barrado) com ondinhas
    for (let k = 0; k < n; k++) {
      const a0 = xa + ((xb - xa) * k) / n;
      const a1 = xa + ((xb - xa) * (k + 1)) / n;
      const p0 = P(a0, b.y1 + out, zLow);
      const p1 = P(a1, b.y1 + out, zLow);
      const p2 = P(a1, b.y1 + out, zLow - 22);
      const p3 = P((a0 + a1) / 2, b.y1 + out, zLow - 34);
      const p4 = P(a0, b.y1 + out, zLow - 22);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.quadraticCurveTo(p3.x, p3.y, p4.x, p4.y);
      ctx.closePath();
      ctx.fillStyle = k % 2 ? c2 : c1;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 0.7;
      ctx.stroke();
    }
    // sombra embaixo do toldo
    const sh = [P(xa, b.y1, zTop - 8), P(xb, b.y1, zTop - 8), P(xb, b.y1, zTop - 70), P(xa, b.y1, zTop - 70)];
    poly(ctx, sh, 'rgba(20,14,26,0.28)');
  }
  function tank(ctx, cam, x, y, z, ink) {
    // caixa d'água azul (cilindro)
    const r = 70;
    const h = 95;
    const top = cam.p({ x, y, z: z + h });
    const bot = cam.p({ x, y, z: z + 10 });
    const rx = r * cam.zoom;
    const ry = r * cam.zoom * cam.sinP;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(bot.x, bot.y, rx + ink * 1.6, ry + ink * 1.6, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillRect(bot.x - rx - ink * 1.6, top.y, (rx + ink * 1.6) * 2, bot.y - top.y);
    ctx.fillStyle = '#2f73c4';
    ctx.beginPath();
    ctx.ellipse(bot.x, bot.y, rx, ry, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillRect(bot.x - rx, top.y, rx * 2, bot.y - top.y);
    ctx.fillStyle = '#245a9c';
    ctx.fillRect(bot.x + rx * 0.35, top.y, rx * 0.65, bot.y - top.y);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, rx + ink * 1.4, ry + ink * 1.4, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#5a9be0';
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, rx, ry, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#3e83cf';
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, rx * 0.45, ry * 0.45, 0, 0, M.TAU);
    ctx.fill();
  }
  function antenna(ctx, cam, x, y, z, ink) {
    const a = cam.p({ x, y, z });
    const b = cam.p({ x, y, z: z + 260 });
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 1.4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    for (let k = 0; k < 4; k++) {
      const c = cam.p({ x, y, z: z + 150 + k * 30 });
      const w = (40 - k * 8) * cam.zoom;
      ctx.moveTo(c.x - w, c.y + w * 0.3);
      ctx.lineTo(c.x + w, c.y - w * 0.3);
    }
    ctx.stroke();
  }

  // ------------------------------------------------------------------ árvore (tronco + copa que balança)
  // casca por espécie (as árvores da rua têm a barra caiada; as da mata não)
  const BARK = {
    mata: ['#5a4532', '#3c2d21'],
    figueira: ['#7c6a57', '#574838'],
    'ipe-amarelo': ['#6b5541', '#4a3a2b'],
    'ipe-roxo': ['#6b5541', '#4a3a2b'],
  };
  class TreeTrunk extends Prop {
    constructor(world, t) {
      const rr = Math.max(22, t.trunk || 0);
      // a figueira é larga (tronco de 2 m e galhos): fica transparente se esconder o personagem, como a copa
      super(world, { x0: t.x - rr, x1: t.x + rr, y0: t.y - rr, y1: t.y + rr }, { fades: t.kind === 'figueira' });
      this.t = t;
      this.collider = { type: 'circle', x: t.x, y: t.y, r: t.trunk ? t.trunk + 4 : 26 };
    }
    screenBox() {
      const t = this.t;
      const roots = t.kind === 'figueira' ? (t.trunk || 60) * 4.2 : 40;
      return bbox([this.P(t.x, t.y, this.z0), this.P(t.x, t.y, this.z0 + t.h * 0.72)], Math.max(40, roots) * this.cam.zoom);
    }
    shadow(path) {
      const t = this.t;
      lineShadow(path, this.cam, t.x, t.y, t.h * 0.6, t.kind === 'figueira' ? (t.trunk || 60) * 1.6 : 16);
      circleShadow(path, this.cam, t.x, t.y, t.r * 0.95, t.h * 0.72);
    }
    paint(ctx) {
      const cam = this.cam;
      const t = this.t;
      const z0 = this.z0;
      const ink = this.ink;
      const top = t.h * 0.68;
      const pts = [];
      const r0 = t.trunk || 17;
      const r1 = t.trunk ? t.trunk * 0.55 : 9;
      const N = 6;
      const lean = (k) => Math.sin(k * 1.3 + t.x) * (t.trunk ? 3 : 6);
      const bark = BARK[t.kind];
      if (t.kind === 'figueira') {
        this._figPaint(ctx);
        return;
      }
      for (let k = 0; k <= N; k++) {
        const z = z0 + (top * k) / N;
        const r = r0 + (r1 - r0) * (k / N);
        const c = cam.p({ x: t.x + lean(k), y: t.y, z });
        pts.push({ c, r: r * cam.zoom });
      }
      const left = pts.map((p) => ({ x: p.c.x - p.r, y: p.c.y }));
      const right = pts.map((p) => ({ x: p.c.x + p.r, y: p.c.y })).reverse();
      const shape = left.concat(right);
      poly(ctx, shape, null, INK, ink * 2.4);
      poly(ctx, shape, bark ? bark[0] : '#7a5537');
      // lado da sombra
      const shadeSide = pts.map((p) => ({ x: p.c.x + p.r * 0.2, y: p.c.y })).concat(right);
      poly(ctx, shadeSide, bark ? bark[1] : '#5a3b25');
      if (!bark) {
        // caiação (barra branca do tronco), só nas árvores da rua
        const wz = Math.round((N * 75) / top);
        const wl = left.slice(0, wz + 1);
        const wr = pts.slice(0, wz + 1).map((p) => ({ x: p.c.x + p.r, y: p.c.y })).reverse();
        poly(ctx, wl.concat(wr), '#efe9dc');
        poly(ctx, pts.slice(0, wz + 1).map((p) => ({ x: p.c.x + p.r * 0.2, y: p.c.y })).concat(wr), '#cfc6b4');
      }
      if (t.kind === 'figueira') this._figGlyphs(ctx, pts);
      // galhos para dentro da copa
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      const ctop = pts[N].c;
      for (const [dx, dz, w] of [[-55, 60, 6], [60, 75, 5], [10, 95, 5]]) {
        const e = cam.p({ x: t.x + dx, y: t.y - dx * 0.4, z: z0 + top + dz });
        ctx.lineWidth = w * cam.zoom + ink * 2;
        ctx.beginPath();
        ctx.moveTo(ctop.x, ctop.y);
        ctx.quadraticCurveTo((ctop.x + e.x) / 2, (ctop.y + e.y) / 2 - 10 * cam.zoom, e.x, e.y);
        ctx.stroke();
        ctx.strokeStyle = '#6a4a30';
        ctx.lineWidth = w * cam.zoom;
        ctx.stroke();
        ctx.strokeStyle = INK;
      }
    }
  }

  // ------------------------------------------------------------------ Figueira dos Despertos
  // O tronco é um cilindro feito de fatias (cada fatia é um círculo deitado, que a câmera mostra como uma elipse de
  // r × r·sinP): por isso a base é redonda e entra no chão, sem a linha reta de antes. As sapopemas (raízes em aleta)
  // saem do próprio tronco, quatro galhos grossos sobem da forquilha até a copa e soltam raízes aéreas.
  const FIG = { fork: 0.42, bark: { light: '#a48d72', base: '#7c6a57', shade: '#574838', dark: '#3a2e23' } };

  TreeTrunk.prototype._figPaint = function (ctx) {
    const cam = this.cam;
    const t = this.t;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const R = t.trunk || 100;
    const zf = t.h * FIG.fork; // forquilha: onde o tronco vira galhos
    const rnd = M.rng(Math.round(t.x * 7 + t.y * 3));
    const lean = rnd() * M.TAU;
    // perfil: alarga bem na base (as sapopemas fundidas ao tronco) e afina um pouco até a forquilha
    const slices = [];
    const N = 24;
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      const flare = u < 0.32 ? Math.pow(1 - u / 0.32, 2) * 0.55 : 0;
      const r = R * (0.78 + 0.22 * (1 - u) + flare) * (1 + Math.sin(u * 9 + lean) * 0.03);
      const off = Math.sin(u * 2.2 + lean) * R * 0.12 * u;
      const c = cam.p({ x: t.x + Math.cos(lean) * off, y: t.y + Math.sin(lean) * off, z: z0 + zf * u });
      slices.push({ c, r, u });
    }
    const roots = [];
    for (let k = 0, n = 8; k < n; k++) {
      roots.push({ a: (k / n) * M.TAU + (rnd() - 0.5) * 0.55, len: R * (1.6 + rnd() * 1.0), zr: R * (0.28 + rnd() * 0.18), w: R * (0.2 + rnd() * 0.1), wig: rnd() * 6 });
    }
    const limbs = [];
    const turn = rnd() * M.TAU;
    for (let k = 0; k < 4; k++) {
      limbs.push({ a: turn + (k / 4) * M.TAU + (rnd() - 0.5) * 0.7, reach: R * (2.5 + rnd() * 1.2), rise: t.h * (0.2 + rnd() * 0.1), w0: R * (0.5 - k * 0.05), w1: R * 0.15, seed: rnd() * 10, hang: 2 + Math.floor(rnd() * 2) });
    }
    // raízes de trás antes e as da frente depois do tronco; os galhos saem todos do meio do topo do tronco, depois dele:
    // primeiro os de trás, depois os da frente, cada grupo com o contorno de todos antes do recheio (senão a borda de um
    // galho riscava o outro e os dois pareciam cruzar em "X")
    const front = (a) => Math.cos(a) + Math.sin(a) > 0;
    for (const r of roots) if (!front(r.a)) this._figRoot(ctx, r, R);
    this._figTrunkBody(ctx, slices);
    for (const r of roots) if (front(r.a)) this._figRoot(ctx, r, R);
    this._figLimbs(ctx, limbs.filter((l) => !front(l.a)), R, zf, rnd);
    this._figLimbs(ctx, limbs.filter((l) => front(l.a)), R, zf, rnd);
    // símbolos na frente do tronco (na superfície: a frente do cilindro fica r·sinP abaixo do centro da fatia)
    const onFace = (s) => ({ c: { x: s.c.x - s.r * zoom * 0.12, y: s.c.y + s.r * cam.sinP * zoom * 0.95 }, r: 0 });
    this._figGlyphs(ctx, [null, onFace(slices[6]), onFace(slices[11]), onFace(slices[16])]);
  };

  /** Corpo do tronco: fatias em tinta (contorno), depois a casca com luz à esquerda e sulcos que contornam o cilindro. */
  TreeTrunk.prototype._figTrunkBody = function (ctx, slices) {
    const cam = this.cam;
    const zoom = cam.zoom;
    const sinP = cam.sinP;
    const B = FIG.bark;
    const ell = (s, grow) => {
      const rx = s.r * zoom + grow;
      ctx.moveTo(s.c.x + rx, s.c.y);
      ctx.ellipse(s.c.x, s.c.y, rx, s.r * sinP * zoom + grow, 0, 0, M.TAU);
    };
    ctx.fillStyle = INK;
    ctx.beginPath();
    for (const s of slices) ell(s, this.ink * 1.3);
    ctx.fill();
    let x0 = Infinity, x1 = -Infinity;
    for (const s of slices) {
      x0 = Math.min(x0, s.c.x - s.r * zoom);
      x1 = Math.max(x1, s.c.x + s.r * zoom);
    }
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, B.light);
    g.addColorStop(0.3, B.base);
    g.addColorStop(0.7, B.shade);
    g.addColorStop(1, B.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    for (const s of slices) ell(s, 0);
    ctx.fill();
    // sulcos: as raízes fundidas subindo pelo tronco, desenhadas na superfície da frente (x = r·a, y desce r·sinP·√(1−a²))
    const rnd = M.rng(Math.round(this.t.x + this.t.y * 11));
    ctx.lineCap = 'round';
    for (let f = 0; f < 9; f++) {
      const across = -0.86 + (f / 8) * 1.72 + (rnd() - 0.5) * 0.08;
      const lit = across < 0.1;
      const line = (shift) => {
        ctx.beginPath();
        slices.forEach((s, k) => {
          const a = Math.max(-0.98, Math.min(0.98, across + shift + Math.sin(k * 0.7 + f * 1.3) * 0.035));
          const x = s.c.x + s.r * zoom * a;
          const y = s.c.y + s.r * sinP * zoom * Math.sqrt(1 - a * a);
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
      };
      ctx.strokeStyle = lit ? 'rgba(58, 44, 32, 0.5)' : 'rgba(24, 18, 13, 0.55)';
      ctx.lineWidth = Math.max(1, (2 + rnd() * 1.8) * zoom);
      line(0);
      if (lit) {
        ctx.strokeStyle = 'rgba(190, 168, 136, 0.35)';
        ctx.lineWidth = Math.max(0.8, 1.2 * zoom);
        line(-0.05);
      }
    }
  };

  /** Sapopema: raiz grossa que nasce da base alargada do tronco, desce serpenteando e afunda no chão (meio enterrada). */
  TreeTrunk.prototype._figRoot = function (ctx, r, R) {
    const cam = this.cam;
    const t = this.t;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const ink = this.ink;
    const B = FIG.bark;
    const L = cam.lightScreen;
    const S = 12;
    const pts = [];
    for (let s = 0; s <= S; s++) {
      const u = s / S;
      const d = R * 0.85 + (r.len - R * 0.85) * u;
      const a = r.a + Math.sin(u * 3 + r.wig) * 0.12;
      const w = r.w * (1 - 0.85 * Math.pow(u, 0.8));
      const z = z0 + r.zr * Math.pow(1 - u, 2) + w * 0.25;
      pts.push({ p: cam.p({ x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d, z }), r: w * zoom });
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // contorno só a partir de um pouco fora do tronco (a junta com a casca fica sem risco)
    for (const [color, grow, from] of [[INK, ink * 2.2, 2], [B.base, 0, 0]]) {
      ctx.strokeStyle = color;
      for (let s = from; s + 1 < pts.length; s++) {
        ctx.lineWidth = pts[s].r * 2 + grow;
        ctx.beginPath();
        ctx.moveTo(pts[s].p.x, pts[s].p.y);
        ctx.lineTo(pts[s + 1].p.x, pts[s + 1].p.y);
        ctx.stroke();
      }
    }
    for (const [color, side, k] of [[B.shade, -1, 0.5], [B.light, 1, 0.28]]) {
      ctx.strokeStyle = color;
      for (let s = 0; s + 1 < pts.length; s++) {
        const o = pts[s].r * 0.5 * side;
        ctx.lineWidth = Math.max(0.6, pts[s].r * 2 * k);
        ctx.beginPath();
        ctx.moveTo(pts[s].p.x + L.x * o, pts[s].p.y + L.y * o);
        ctx.lineTo(pts[s + 1].p.x + L.x * o, pts[s + 1].p.y + L.y * o);
        ctx.stroke();
      }
    }
  };

  /** Galhos grossos: saem do meio do topo do tronco, abrem para fora subindo até a copa, afinando; soltam raízes aéreas. */
  TreeTrunk.prototype._figLimbs = function (ctx, group, R, zf, rnd) {
    if (!group.length) return;
    const cam = this.cam;
    const t = this.t;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const ink = this.ink;
    const B = FIG.bark;
    const L = cam.lightScreen;
    const S = 14;
    const all = group.map((l) => {
      const pts = [];
      for (let s = 0; s <= S; s++) {
        const u = s / S;
        const d = (l.reach * Math.pow(u, 0.9));
        const a = l.a + Math.sin(u * 2 + l.seed) * 0.15;
        const w = { x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d, z: z0 + zf - R * 0.2 + l.rise * (1 - Math.pow(1 - u, 2)) + R * 0.3 * u };
        pts.push({ w, p: cam.p(w), r: (l.w0 + (l.w1 - l.w0) * Math.pow(u, 0.8)) * zoom });
      }
      // raízes aéreas penduradas: algumas chegam ao chão, outras param no ar
      const hangs = [];
      for (let k = 0; k < l.hang; k++) {
        const s = Math.floor(S * (0.45 + 0.5 * rnd()));
        const reach = rnd() < 0.5 ? 0 : 60 + rnd() * 160;
        hangs.push({ s, end: z0 + reach, sway: (rnd() - 0.5) * 30, w: (2.4 + rnd() * 1.6) * zoom });
      }
      return { pts, hangs };
    });
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const { pts, hangs } of all) {
      for (const h of hangs) {
        const top = pts[h.s];
        const end = cam.p({ x: top.w.x + h.sway, y: top.w.y, z: h.end });
        const mid = cam.p({ x: top.w.x + h.sway * 0.4, y: top.w.y, z: (top.w.z + h.end) / 2 });
        for (const [color, extra] of [[INK, ink * 1.6], [B.shade, 0]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = h.w + extra;
          ctx.beginPath();
          ctx.moveTo(top.p.x, top.p.y);
          ctx.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
          ctx.stroke();
        }
      }
    }
    const pass = (color, grow) => {
      ctx.strokeStyle = color;
      for (const { pts } of all) {
        for (let s = 0; s + 1 < pts.length; s++) {
          ctx.lineWidth = pts[s].r * 2 + grow;
          ctx.beginPath();
          ctx.moveTo(pts[s].p.x, pts[s].p.y);
          ctx.lineTo(pts[s + 1].p.x, pts[s + 1].p.y);
          ctx.stroke();
        }
      }
    };
    pass(INK, ink * 2.4);
    pass(B.base, 0);
    // sombra embaixo e luz em cima de cada galho (começa um pouco depois da junta, para a forquilha não riscar)
    for (const [color, side, k] of [[B.shade, -1, 0.45], [B.light, 1, 0.3]]) {
      ctx.strokeStyle = color;
      for (const { pts } of all) {
        for (let s = 2; s + 1 < pts.length; s++) {
          const o = pts[s].r * 0.55 * side;
          ctx.lineWidth = Math.max(0.6, pts[s].r * 2 * k);
          ctx.beginPath();
          ctx.moveTo(pts[s].p.x + L.x * o, pts[s].p.y + L.y * o);
          ctx.lineTo(pts[s + 1].p.x + L.x * o, pts[s + 1].p.y + L.y * o);
          ctx.stroke();
        }
      }
    }
  };

  /** Símbolos entalhados no tronco da figueira, que brilham em verde-água. */
  TreeTrunk.prototype._figGlyphs = function (ctx, pts) {
    const cam = this.cam;
    const z = cam.zoom;
    ctx.save();
    ctx.shadowColor = '#3fd6c8';
    ctx.shadowBlur = 10 * z;
    ctx.strokeStyle = '#7ff5e6';
    ctx.lineWidth = Math.max(1.2, 3.2 * z);
    ctx.lineCap = 'round';
    for (const [k, s] of [[1, 34], [2, 28], [3, 22]]) {
      const p = pts[k].c;
      const x = p.x - (pts[k].r || 0) * 0.15;
      const y = p.y;
      const r = s * z;
      ctx.beginPath(); // losango com um olho no meio
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.7, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.7, y);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.25, 0, M.TAU);
      ctx.stroke();
    }
    ctx.restore();
  };

  // copa por espécie: verde frio e fundo na mata, ipês floridos, a figueira imensa
  const CANOPY = {
    ipe: { base: '#f2c21c', shade: '#cf8f0f', light: '#ffe46b', under: '#5d7f34' },
    'ipe-amarelo': { base: '#efbd22', shade: '#c88a14', light: '#ffe06a', under: '#4d6d2e' },
    'ipe-roxo': { base: '#b0569f', shade: '#7c3a72', light: '#d88ccb', under: '#3d5f33' },
    mata: { base: '#2f5c33', shade: '#1e4126', light: '#47794a', under: '#16301e' },
    figueira: { base: '#2c6a3b', shade: '#1b4829', light: '#4f9053', under: '#143022' },
  };

  class TreeCanopy extends Prop {
    constructor(world, t) {
      super(world, { x0: t.x - t.r, x1: t.x + t.r, y0: t.y - t.r, y1: t.y + t.r }, { overhead: true });
      this.t = t;
      this.colors = CANOPY[t.kind] || { base: '#5f9a3e', shade: '#3f7130', light: '#86bf55', under: '#355f2a' };
      this.sway = 0;
    }
    get center() {
      const t = this.t;
      return { x: t.x, y: t.y, z: this.z0 + t.h * (t.kind === 'figueira' ? 0.8 : 0.78) };
    }
    screenBox() {
      const t = this.t;
      const c = this.cam.p(this.center);
      const r = t.r * this.cam.zoom * 1.25;
      return { x0: c.x - r, y0: c.y - r * 1.05, x1: c.x + r, y1: c.y + r * 0.85 };
    }
    paint(ctx) {
      const cam = this.cam;
      const t = this.t;
      const ink = this.ink;
      const c = this.center;
      const r = M.rng(Math.round(t.x * 3 + t.y));
      // bolotas numa cúpula achatada; as de trás/baixo escuras, as de cima/frente claras
      const blobs = [];
      if (t.kind === 'figueira') this._figBlobs(blobs, c, r);
      else {
        const n = 13;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * M.TAU + r() * 0.5;
          const d = (k === 0 ? 0 : 0.35 + r() * 0.5) * t.r * 0.62;
          const z = (r() - 0.35) * t.r * 0.45;
          const p = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, z: c.z + z };
          blobs.push({ p, r: t.r * (0.34 + r() * 0.16), depth: cam.depth(p) + z * 0.3 });
        }
        blobs.push({ p: { x: c.x, y: c.y, z: c.z + t.r * 0.32 }, r: t.r * 0.46, depth: cam.depth({ x: c.x, y: c.y, z: c.z + t.r * 0.32 }) + 40 });
      }
      blobs.sort((a, b) => a.depth - b.depth);
      const circles = blobs.map((b) => {
        const q = cam.p(b.p);
        return { x: q.x, y: q.y, r: b.r * cam.zoom, tier: b.tier };
      });
      // contorno da copa toda
      for (const ci of circles) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(ci.x, ci.y, ci.r + ink * 1.4, 0, M.TAU);
        ctx.fill();
      }
      const L = cam.lightScreen;
      circles.forEach((ci, k) => {
        // cachos de baixo/trás escuros; na figueira o tom vem da altura do cacho (tier 0 embaixo, 2 em cima)
        const back = ci.tier !== undefined ? ci.tier === 0 : k < circles.length * 0.4;
        ctx.fillStyle = back ? this.colors.shade : this.colors.base;
        ctx.beginPath();
        ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
        ctx.fill();
        if (k) {
          ctx.strokeStyle = INK;
          ctx.lineWidth = ink * 0.6;
          ctx.stroke();
        }
        // meia-lua de sombra e brilho
        ctx.save();
        ctx.beginPath();
        ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
        ctx.clip();
        ctx.fillStyle = back ? this.colors.under : this.colors.shade;
        ctx.beginPath();
        ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
        ctx.arc(ci.x + L.x * ci.r * 0.42, ci.y + L.y * ci.r * 0.42, ci.r, 0, M.TAU, true);
        ctx.fill('evenodd');
        if (!back) {
          const lift = ci.tier === 2 ? 0.4 : 0.25;
          ctx.fillStyle = this.colors.light;
          ctx.beginPath();
          ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
          ctx.arc(ci.x - L.x * ci.r * lift, ci.y - L.y * ci.r * lift, ci.r, 0, M.TAU, true);
          ctx.fill('evenodd');
        }
        ctx.restore();
      });
      // folhinhas/flores soltas na borda
      ctx.fillStyle = this.colors.light;
      for (let k = 0; k < 26; k++) {
        const ci = circles[Math.floor(r() * circles.length)];
        const a = r() * M.TAU;
        ctx.beginPath();
        ctx.arc(ci.x + Math.cos(a) * ci.r * 0.7, ci.y + Math.sin(a) * ci.r * 0.7, Math.max(1.2, 4 * cam.zoom), 0, M.TAU);
        ctx.fill();
      }
    }
    /**
     * Copa da figueira: muitos cachos menores numa cúpula larga e baixa (mais larga do que alta). Na frente do tronco os
     * cachos sobem até a altura dos galhos, para o tronco e a forquilha aparecerem embaixo da copa (sem o "pirulito").
     */
    _figBlobs(blobs, c, r) {
      const cam = this.cam;
      const t = this.t;
      const R = t.trunk || 100;
      const n = 50;
      const limitY = cam.p({ x: t.x, y: t.y, z: this.z0 + t.h * 0.6 }).y; // a copa não desce na frente do tronco além disto
      const trunkX = cam.p({ x: t.x, y: t.y, z: this.z0 }).x;
      for (let k = 0; k < n; k++) {
        const a = r() * M.TAU;
        const q = k < 4 ? r() * 0.3 : Math.sqrt(0.08 + r() * 0.92);
        const d = q * t.r * 0.95;
        const z = t.r * (0.24 * (1 - q * q) - 0.06) + (r() - 0.5) * t.r * 0.08;
        const p = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, z: c.z + z };
        const br = t.r * (0.14 + r() * 0.08);
        const s = cam.p(p);
        const near = 1 - M.smoothstep(R * 1.3, R * 2.8, Math.abs(s.x - trunkX) / cam.zoom);
        const bottom = s.y + br * cam.zoom;
        if (near > 0 && bottom > limitY) p.z += ((bottom - limitY) / (cam.cosP * cam.zoom)) * near;
        const rel = (p.z - c.z) / t.r;
        blobs.push({ p, r: br, depth: cam.depth(p) + (p.z - c.z) * 0.3, tier: rel < -0.02 ? 0 : rel > 0.13 ? 2 : 1 });
      }
    }
    /** A copa (círculo na tela) cobre a caixa do corpo? */
    cover(box) {
      const c = this.cam.p(this.center);
      const r = this.t.r * this.cam.zoom * 1.05;
      const cx = Math.max(box.x0, Math.min(c.x, box.x1));
      const cy = Math.max(box.y0, Math.min(c.y, box.y1));
      return (cx - c.x) ** 2 + (cy - c.y) ** 2 < r * r;
    }
    draw(ctx, time) {
      this._ensureSprite();
      const s = this.sprite;
      // balanço da copa: desliza a imagem pronta (girar uma imagem grande custa caro a cada quadro);
      // o passo é de meio pixel do aparelho, então o movimento fica suave sem refazer pixel nenhum
      const dpr = this.cam.dpr;
      const amp = (this.t.kind === 'ipe' ? 3.2 : 2.6) * this.cam.zoom;
      const off = Math.round((Math.sin(time * 0.9 + this.t.x * 0.01) * 0.8 + Math.sin(time * 2.3 + this.t.y) * 0.2) * amp * dpr) / dpr;
      if (this.alpha < 0.999) ctx.globalAlpha = this.alpha;
      ctx.drawImage(s.c, s.x + off, s.y, s.w, s.h);
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ poste de concreto
  class Pole extends Prop {
    constructor(world, p) {
      super(world, { x0: p.x - 16, x1: p.x + 16, y0: p.y - 16, y1: p.y + 16 }, { fades: false });
      this.p = p;
      this.h = 880;
      this.collider = { type: 'circle', x: p.x, y: p.y, r: 20 };
    }
    /** Pontas da cruzeta (onde os fios prendem). */
    wireAnchors() {
      const z = this.z0 + this.h - 60;
      return [-1, 0, 1].map((k) => ({ x: this.p.x + k * 60, y: this.p.y - k * 60, z: z + (k === 0 ? 30 : 0) }));
    }
    screenBox() {
      return bbox([this.P(this.p.x, this.p.y, this.z0), this.P(this.p.x, this.p.y, this.z0 + this.h + 40), this.P(this.p.x - 100, this.p.y + 100, this.z0 + this.h), this.P(this.p.x + 100, this.p.y - 100, this.z0 + this.h)], 30 * this.cam.zoom);
    }
    shadow(path) {
      lineShadow(path, this.cam, this.p.x, this.p.y, this.h, 12);
    }
    paint(ctx) {
      const cam = this.cam;
      const p = this.p;
      const z0 = this.z0;
      const ink = this.ink;
      const b = cam.p({ x: p.x, y: p.y, z: z0 });
      const t = cam.p({ x: p.x, y: p.y, z: z0 + this.h });
      const rb = 14 * cam.zoom;
      const rt = 8 * cam.zoom;
      const shape = [{ x: b.x - rb, y: b.y }, { x: t.x - rt, y: t.y }, { x: t.x + rt, y: t.y }, { x: b.x + rb, y: b.y }];
      poly(ctx, shape, null, INK, ink * 2.4);
      poly(ctx, shape, '#c3beb3');
      poly(ctx, [{ x: b.x + rb * 0.2, y: b.y }, { x: t.x + rt * 0.2, y: t.y }, { x: t.x + rt, y: t.y }, { x: b.x + rb, y: b.y }], '#9e998f');
      // furinhos do poste
      ctx.fillStyle = '#7f7a71';
      for (let k = 1; k < 8; k++) {
        const q = cam.p({ x: p.x, y: p.y, z: z0 + k * 95 });
        ctx.fillRect(q.x - 2 * cam.zoom, q.y, 4 * cam.zoom, 4 * cam.zoom);
      }
      // cruzeta com isoladores
      const za = z0 + this.h - 60;
      const a0 = cam.p({ x: p.x - 75, y: p.y + 75, z: za });
      const a1 = cam.p({ x: p.x + 75, y: p.y - 75, z: za });
      ctx.strokeStyle = INK;
      ctx.lineWidth = 9 * cam.zoom + ink * 2;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(a1.x, a1.y);
      ctx.stroke();
      ctx.strokeStyle = '#8a8378';
      ctx.lineWidth = 9 * cam.zoom;
      ctx.stroke();
      for (const an of this.wireAnchors()) {
        const q = cam.p(an);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(q.x, q.y - 6 * cam.zoom, 7 * cam.zoom + ink, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#e9e3d0';
        ctx.beginPath();
        ctx.arc(q.x, q.y - 6 * cam.zoom, 7 * cam.zoom, 0, M.TAU);
        ctx.fill();
      }
      if (p.transformer) {
        const q = cam.p({ x: p.x + 20, y: p.y + 20, z: z0 + this.h - 230 });
        const w = 38 * cam.zoom;
        const h = 90 * cam.zoom;
        ctx.fillStyle = INK;
        ctx.fillRect(q.x - w / 2 - ink * 1.4, q.y - h - ink * 1.4, w + ink * 2.8, h + ink * 2.8);
        ctx.fillStyle = '#8c949b';
        ctx.fillRect(q.x - w / 2, q.y - h, w, h);
        ctx.fillStyle = '#6c737a';
        ctx.fillRect(q.x + w * 0.1, q.y - h, w * 0.4, h);
      }
      if (p.lamp) {
        // braço com a luminária, para o lado da rua
        const s0 = cam.p({ x: p.x, y: p.y, z: z0 + this.h - 120 });
        const s1 = cam.p({ x: p.x, y: p.y + 170, z: z0 + this.h - 80 });
        ctx.strokeStyle = INK;
        ctx.lineWidth = 6 * cam.zoom + ink * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.quadraticCurveTo(s0.x, s1.y - 20 * cam.zoom, s1.x, s1.y);
        ctx.stroke();
        ctx.strokeStyle = '#7d786f';
        ctx.lineWidth = 6 * cam.zoom;
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(s1.x, s1.y + 6 * cam.zoom, 30 * cam.zoom + ink, 12 * cam.zoom + ink, -0.45, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#5b5e63';
        ctx.beginPath();
        ctx.ellipse(s1.x, s1.y + 6 * cam.zoom, 30 * cam.zoom, 12 * cam.zoom, -0.45, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#fff1bf';
        ctx.beginPath();
        ctx.ellipse(s1.x + 2 * cam.zoom, s1.y + 11 * cam.zoom, 18 * cam.zoom, 6 * cam.zoom, -0.45, 0, M.TAU);
        ctx.fill();
      }
    }
  }

  // ------------------------------------------------------------------ muro
  class Wall extends Prop {
    constructor(world, w) {
      super(world, { x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 }, { fades: w.h > 120 });
      this.w = w;
      this.collider = { type: 'box', x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 };
    }
    screenBox() {
      const w = this.w;
      const z = this.z0;
      return bbox([this.P(w.x0, w.y1, z), this.P(w.x1, w.y1, z), this.P(w.x1, w.y0, z), this.P(w.x0, w.y0, z + w.h), this.P(w.x1, w.y0, z + w.h), this.P(w.x0, w.y1, z + w.h)], 20 * this.cam.zoom);
    }
    shadow(path) {
      const w = this.w;
      boxShadow(path, this.cam, w.x0, w.x1, w.y0, w.y1, w.h);
    }
    paint(ctx) {
      const cam = this.cam;
      const w = this.w;
      const z0 = this.z0;
      box(ctx, cam, w.x0, w.x1, w.y0, w.y1, z0, z0 + w.h, { front: w.color, side: M.shade(w.color, -0.25), top: M.shade(w.color, 0.15) }, this.ink);
      if (!w.graffiti) return;
      const along = w.x1 - w.x0 > w.y1 - w.y0;
      const o = along ? { x: w.x0, y: w.y1, z: z0 + w.h } : { x: w.x1, y: w.y1, z: z0 + w.h };
      const dir = along ? { x: 1, y: 0 } : { x: 0, y: -1 };
      const L = along ? w.x1 - w.x0 : w.y1 - w.y0;
      onWall(ctx, cam, o, dir, () => {
        if (w.graffiti === 'cores') graffitiColors(ctx, L, w.h);
        else graffitiLetters(ctx, L, w.h);
      });
    }
  }
  function graffitiColors(ctx, L, H) {
    // mural: sol, ondas e uma arara estilizada (cores fortes, contorno grosso)
    const r = M.rng(55);
    const cols = ['#e8452c', '#f4b81b', '#2f6fd0', '#34a35b', '#e86a9a'];
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = cols[k % cols.length];
      ctx.beginPath();
      const y = 40 + k * 26;
      ctx.moveTo(0, y);
      for (let x = 0; x <= L; x += 20) ctx.lineTo(x, y + Math.sin(x / 50 + k) * 14);
      ctx.lineTo(L, y + 26);
      for (let x = L; x >= 0; x -= 20) ctx.lineTo(x, y + 26 + Math.sin(x / 50 + k + 0.4) * 14);
      ctx.closePath();
      ctx.globalAlpha = 0.85;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f7d23a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(L * 0.25, H * 0.42, 52, 0, M.TAU);
    ctx.fill();
    ctx.stroke();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * M.TAU;
      ctx.beginPath();
      ctx.moveTo(L * 0.25 + Math.cos(a) * 62, H * 0.42 + Math.sin(a) * 62);
      ctx.lineTo(L * 0.25 + Math.cos(a) * 82, H * 0.42 + Math.sin(a) * 82);
      ctx.stroke();
    }
    void r;
  }
  function graffitiLetters(ctx, L, H) {
    // letras de balão: PINDORAMA (o nome do jogo, sem marca de ninguém)
    ctx.save();
    ctx.font = `${Math.round(H * 0.5)}px ${FONT_SIGN}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = 'PINDORAMA';
    const x = L * 0.42;
    const y = H * 0.55;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 26;
    ctx.strokeStyle = INK;
    ctx.strokeText(text, x, y);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#f7f2e4';
    ctx.strokeText(text, x, y);
    const g = ctx.createLinearGradient(0, y - H * 0.25, 0, y + H * 0.25);
    g.addColorStop(0, '#2f8f5a');
    g.addColorStop(0.5, '#f4c21c');
    g.addColorStop(1, '#e0452c');
    ctx.fillStyle = g;
    ctx.fillText(text, x, y);
    ctx.restore();
    // pingos de tinta
    ctx.fillStyle = '#2f8f5a';
    for (let k = 0; k < 8; k++) ctx.fillRect(L * 0.12 + k * L * 0.09, H * 0.78, 6, 18 + (k % 3) * 10);
  }

  // ------------------------------------------------------------------ miudezas
  // pedra: tons da rocha (do lado escuro ao topo iluminado), musgo e a grama que cobre a base
  const ROCK = { dark: [74, 70, 64], light: [206, 200, 186], moss: ['#5d8a3e', '#46733a', '#7aa54d'], grass: ['#4b7c3a', '#3d6a32', '#5b8d43'] };

  class Small extends Prop {
    constructor(world, d) {
      const fp = d.x0 !== undefined ? { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 } : { x0: d.x - (d.r || 30), x1: d.x + (d.r || 30), y0: d.y - (d.r || 30), y1: d.y + (d.r || 30) };
      super(world, fp, { fades: d.kind === 'banca' });
      this.d = d;
      const r = d.r || 30;
      const decor = d.kind === 'aguape' || d.kind === 'capivara'; // enfeites: não seguram ninguém
      this.collider = decor ? null : d.x0 !== undefined ? { type: 'box', ...fp } : { type: 'circle', x: d.x, y: d.y, r: d.kind === 'arbusto' ? r * 0.8 : d.kind === 'pedra' ? r : d.kind === 'mesa' ? 60 : 22 };
      this.height = { banca: 250, orelhao: 230, lixeira: 95, hidrante: 70, mesa: 80, banco: 50, arbusto: (d.r || 60) * 1.1, pedra: (d.r || 40) * 0.8, 'poste-praca': (d.h || 340) + 40, 'tronco-caido': d.h || 60, aguape: 20, capivara: 60 }[d.kind] || 80;
    }
    screenBox() {
      const f = this.fp;
      const z = this.z0;
      const h = this.height + 60;
      return bbox([this.P(f.x0, f.y1, z), this.P(f.x1, f.y0, z), this.P(f.x1, f.y1, z), this.P(f.x0, f.y0, z + h), this.P(f.x1, f.y0, z + h), this.P(f.x0, f.y1, z + h)], 40 * this.cam.zoom);
    }
    shadow(path) {
      const f = this.fp;
      const d = this.d;
      if (d.kind === 'arbusto' || d.kind === 'pedra') circleShadow(path, this.cam, d.x, d.y, d.r * 0.9, this.height * 0.5);
      else if (d.kind === 'aguape') return; // boia na água: sem sombra
      else if (d.kind === 'capivara') circleShadow(path, this.cam, d.x, d.y, 42, 30);
      else if (d.kind === 'banca' || d.kind === 'banco' || d.kind === 'tronco-caido') boxShadow(path, this.cam, f.x0, f.x1, f.y0, f.y1, this.height);
      else if (d.kind === 'mesa') circleShadow(path, this.cam, d.x, d.y, 45, 60);
      else lineShadow(path, this.cam, d.x, d.y, this.height, 12);
    }
    paint(ctx) {
      const cam = this.cam;
      const d = this.d;
      const z0 = this.z0;
      const ink = this.ink;
      const P = (x, y, z) => cam.p({ x, y, z });
      switch (d.kind) {
        case 'banca': {
          const f = this.fp;
          box(ctx, cam, f.x0, f.x1, f.y0, f.y1, z0, z0 + 230, { front: '#2f7a4f', side: '#245d3d', top: '#3c9461' }, ink);
          // revistas penduradas
          onWall(ctx, cam, { x: f.x0, y: f.y1, z: z0 + 230 }, { x: 1, y: 0 }, () => {
            const r = M.rng(8);
            for (let k = 0; k < 8; k++) {
              ctx.fillStyle = ['#e8452c', '#f4c21c', '#2f6fd0', '#f2efe6', '#e86a9a'][Math.floor(r() * 5)];
              ctx.fillRect(14 + k * 28, 70, 24, 34);
              ctx.fillRect(14 + k * 28, 112, 24, 34);
            }
            ctx.fillStyle = '#f7edd4';
            ctx.fillRect(10, 18, (f.x1 - f.x0) - 20, 34);
            ctx.fillStyle = INK;
            ctx.font = `30px ${FONT_SIGN}`;
            ctx.textAlign = 'center';
            ctx.fillText('JORNAIS E REVISTAS', (f.x1 - f.x0) / 2, 46);
          });
          // telhadinho que sai para a frente
          const roof = [P(f.x0 - 20, f.y0 - 10, z0 + 240), P(f.x1 + 30, f.y0 - 10, z0 + 240), P(f.x1 + 30, f.y1 + 50, z0 + 225), P(f.x0 - 20, f.y1 + 50, z0 + 225)];
          poly(ctx, roof, '#3c9461', INK, ink * 1.6);
          break;
        }
        case 'orelhao': {
          // orelhão: poste com a "concha" laranja
          const base = P(d.x, d.y, z0);
          const top = P(d.x, d.y, z0 + 150);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 9 * cam.zoom + ink * 2;
          ctx.beginPath();
          ctx.moveTo(base.x, base.y);
          ctx.lineTo(top.x, top.y);
          ctx.stroke();
          ctx.strokeStyle = '#8a8d93';
          ctx.lineWidth = 9 * cam.zoom;
          ctx.stroke();
          const c = P(d.x, d.y + 8, z0 + 175);
          const rx = 42 * cam.zoom;
          const ry = 58 * cam.zoom;
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, rx + ink * 1.6, ry + ink * 1.6, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#ef7d22';
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, rx, ry, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#c95e16';
          ctx.beginPath();
          ctx.ellipse(c.x + rx * 0.25, c.y + ry * 0.1, rx * 0.72, ry * 0.85, 0, 0, M.TAU);
          ctx.fill();
          // aparelho dentro
          ctx.fillStyle = '#3c3f46';
          ctx.fillRect(c.x - 10 * cam.zoom, c.y - 4 * cam.zoom, 20 * cam.zoom, 30 * cam.zoom);
          ctx.fillStyle = '#ffb35c';
          ctx.beginPath();
          ctx.ellipse(c.x - rx * 0.35, c.y - ry * 0.45, rx * 0.25, ry * 0.18, -0.5, 0, M.TAU);
          ctx.fill();
          break;
        }
        case 'lixeira': {
          const top = P(d.x, d.y, z0 + 95);
          const base = P(d.x, d.y, z0);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 6 * cam.zoom + ink * 2;
          ctx.beginPath();
          ctx.moveTo(base.x, base.y);
          ctx.lineTo(base.x, top.y + 20 * cam.zoom);
          ctx.stroke();
          ctx.strokeStyle = '#6f7378';
          ctx.lineWidth = 6 * cam.zoom;
          ctx.stroke();
          const w = 22 * cam.zoom;
          const h = 42 * cam.zoom;
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.roundRect(top.x - w - ink * 1.5, top.y - ink * 1.5, 2 * w + ink * 3, h + ink * 3, 6 * cam.zoom);
          ctx.fill();
          ctx.fillStyle = '#f07c1c';
          ctx.beginPath();
          ctx.roundRect(top.x - w, top.y, 2 * w, h, 5 * cam.zoom);
          ctx.fill();
          ctx.fillStyle = '#c75f12';
          ctx.fillRect(top.x + w * 0.2, top.y + 3, w * 0.8, h - 6);
          ctx.fillStyle = '#2b2b30';
          ctx.fillRect(top.x - w * 0.7, top.y + 4 * cam.zoom, w * 1.4, 5 * cam.zoom);
          break;
        }
        case 'hidrante': {
          const base = P(d.x, d.y, z0);
          const w = 13 * cam.zoom;
          const h = 62 * cam.zoom;
          ctx.fillStyle = INK;
          ctx.fillRect(base.x - w - ink * 1.5, base.y - h - ink * 1.5, 2 * w + ink * 3, h + ink * 1.5);
          ctx.fillStyle = '#d53a2c';
          ctx.fillRect(base.x - w, base.y - h, 2 * w, h);
          ctx.fillStyle = '#a62a20';
          ctx.fillRect(base.x + w * 0.2, base.y - h, w * 0.8, h);
          ctx.fillStyle = '#f2c230';
          ctx.fillRect(base.x - w, base.y - h, 2 * w, 10 * cam.zoom);
          ctx.fillRect(base.x - w * 1.8, base.y - h * 0.6, w * 3.6, 9 * cam.zoom);
          break;
        }
        case 'mesa': {
          // mesa de plástico com duas cadeiras (sem marca)
          const chair = (cx, cy, col) => {
            const s = P(cx, cy, z0 + 45);
            const w = 20 * cam.zoom;
            ctx.fillStyle = INK;
            ctx.fillRect(s.x - w - ink, s.y - 40 * cam.zoom - ink, 2 * w + 2 * ink, 46 * cam.zoom + 2 * ink);
            ctx.fillStyle = col;
            ctx.fillRect(s.x - w, s.y - 40 * cam.zoom, 2 * w, 18 * cam.zoom);
            ctx.fillRect(s.x - w, s.y - 6 * cam.zoom, 2 * w, 12 * cam.zoom);
            ctx.fillStyle = M.shade(col, -0.25);
            ctx.fillRect(s.x - w, s.y + 6 * cam.zoom, 5 * cam.zoom, 30 * cam.zoom);
            ctx.fillRect(s.x + w - 5 * cam.zoom, s.y + 6 * cam.zoom, 5 * cam.zoom, 30 * cam.zoom);
          };
          chair(d.x - 55, d.y - 10, '#e4b21b');
          const top = P(d.x, d.y, z0 + 72);
          const leg = P(d.x, d.y, z0);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 8 * cam.zoom;
          ctx.beginPath();
          ctx.moveTo(leg.x, leg.y);
          ctx.lineTo(top.x, top.y);
          ctx.stroke();
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.ellipse(top.x, top.y, 46 * cam.zoom + ink, 23 * cam.zoom + ink, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#d6402f';
          ctx.beginPath();
          ctx.ellipse(top.x, top.y, 46 * cam.zoom, 23 * cam.zoom, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#f06a55';
          ctx.beginPath();
          ctx.ellipse(top.x - 8 * cam.zoom, top.y - 4 * cam.zoom, 26 * cam.zoom, 11 * cam.zoom, 0, 0, M.TAU);
          ctx.fill();
          chair(d.x + 40, d.y + 55, '#e4b21b');
          break;
        }
        case 'banco': {
          const f = this.fp;
          box(ctx, cam, f.x0, f.x1, f.y0, f.y1, z0, z0 + 45, { front: '#bfb7a6', side: '#9b9383', top: '#d8d1c1' }, ink);
          break;
        }
        case 'arbusto': {
          const r = M.rng(d.x + d.y);
          const circles = [];
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * M.TAU;
            const p = P(d.x + Math.cos(a) * d.r * 0.45, d.y + Math.sin(a) * d.r * 0.45, z0 + d.r * (0.45 + r() * 0.3));
            circles.push({ x: p.x, y: p.y, r: d.r * (0.42 + r() * 0.15) * cam.zoom });
          }
          const c = P(d.x, d.y, z0 + d.r * 0.8);
          circles.push({ x: c.x, y: c.y, r: d.r * 0.5 * cam.zoom });
          circles.sort((a, b) => a.y - b.y);
          // na mata o arbusto é mais escuro (e o da mata fechada, que segura o jogador, mais ainda)
          const leaf = d.wild ? (d.dense ? { base: '#244a2b', shade: '#16321d', light: '#356a3b' } : { base: '#2f6236', shade: '#1e4426', light: '#468a4a' }) : { base: '#5a9440', shade: '#3c6d2f', light: '#80b955' };
          blobCluster(ctx, circles, leaf, ink, cam.lightScreen);
          break;
        }
        case 'pedra': {
          this._rock(ctx);
          if (d.ancestral) this._rockGlyph(ctx);
          break;
        }
        case 'tronco-caido':
          this._log(ctx);
          break;
        case 'aguape':
          this._hyacinth(ctx);
          break;
        case 'capivara':
          this._capybara(ctx);
          break;
        case 'poste-praca': {
          const base = P(d.x, d.y, z0);
          const top = P(d.x, d.y, z0 + (d.h || 340));
          ctx.strokeStyle = INK;
          ctx.lineWidth = 8 * cam.zoom + ink * 2;
          ctx.beginPath();
          ctx.moveTo(base.x, base.y);
          ctx.lineTo(top.x, top.y);
          ctx.stroke();
          ctx.strokeStyle = '#2f4a3a';
          ctx.lineWidth = 8 * cam.zoom;
          ctx.stroke();
          const w = 18 * cam.zoom;
          ctx.fillStyle = INK;
          ctx.fillRect(top.x - w - ink, top.y - 44 * cam.zoom - ink, 2 * w + 2 * ink, 44 * cam.zoom + 2 * ink);
          ctx.fillStyle = d.light || '#ffe9a6';
          ctx.fillRect(top.x - w, top.y - 44 * cam.zoom, 2 * w, 44 * cam.zoom);
          ctx.fillStyle = '#2f4a3a';
          ctx.fillRect(top.x - w * 1.4, top.y - 52 * cam.zoom, w * 2.8, 9 * cam.zoom);
          break;
        }
      }
    }
  }
  /**
   * Pedra: rocha de contorno irregular e facetada. Um anel de base (enterrado uns centímetros) e um anel de cima menor;
   * as faces que a câmera vê ganham tom pela luz (topo claro, lado longe da luz escuro). Musgo no topo iluminado e
   * fiapos de grama cobrindo a base da frente, para ela parecer meio enterrada. Cada pedra sai diferente (pela posição).
   */
  Small.prototype._rock = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const ink = this.ink;
    const rnd = M.rng(Math.round(d.x * 13 + d.y * 7));
    const R = d.r || 40;
    const H = R * (0.7 + rnd() * 0.35);
    const N = 7;
    const rot = rnd() * M.TAU;
    const lean = { x: (rnd() - 0.5) * R * 0.3, y: (rnd() - 0.5) * R * 0.3 };
    const base = [];
    const top = [];
    for (let k = 0; k < N; k++) {
      const a = rot + (k / N) * M.TAU + (rnd() - 0.5) * 0.45;
      const rb = R * (0.82 + rnd() * 0.22);
      const rt = rb * (0.42 + rnd() * 0.22);
      base.push({ x: d.x + Math.cos(a) * rb, y: d.y + Math.sin(a) * rb, z: z0 - 5 });
      top.push({ x: d.x + lean.x + Math.cos(a + 0.2) * rt, y: d.y + lean.y + Math.sin(a + 0.2) * rt, z: z0 + H * (0.78 + rnd() * 0.22) });
    }
    const crown = { x: d.x + lean.x * 1.2, y: d.y + lean.y * 1.2, z: z0 + H * 1.04 };
    // faces: lados (quadriláteros base→topo) e o topo em leque em volta da coroa
    const faces = [];
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N;
      faces.push([base[k], base[j], top[j], top[k]]);
      faces.push([top[k], top[j], crown]);
    }
    const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
    const center = { x: d.x, y: d.y, z: z0 + H * 0.4 };
    const shaded = [];
    for (const f of faces) {
      let n = cross(sub(f[1], f[0]), sub(f[2], f[0]));
      const c = f.reduce((acc, q) => ({ x: acc.x + q.x / f.length, y: acc.y + q.y / f.length, z: acc.z + q.z / f.length }), { x: 0, y: 0, z: 0 });
      const out = sub(c, center);
      if (n.x * out.x + n.y * out.y + n.z * out.z < 0) n = { x: -n.x, y: -n.y, z: -n.z }; // normal para fora
      const l = Math.hypot(n.x, n.y, n.z) || 1;
      n = { x: n.x / l, y: n.y / l, z: n.z / l };
      if (n.x * cam.toCamera.x + n.y * cam.toCamera.y + n.z * cam.toCamera.z <= 0) continue; // de costas para a câmera
      const lit = M.clamp01(0.5 + 0.6 * (n.x * cam.light.x + n.y * cam.light.y + n.z * cam.light.z));
      const tone = ROCK.dark.map((v, i) => Math.round(v + (ROCK.light[i] - v) * lit));
      shaded.push({ pts: f.map((q) => cam.p(q)), color: `rgb(${tone.join(',')})`, depth: cam.depth(c), up: n.z, lit });
    }
    shaded.sort((a, b) => a.depth - b.depth);
    // contorno: o casco de todos os pontos na tela
    const all = base.concat(top, [crown]).map((q) => cam.p(q));
    const hull = convexHull(all);
    poly(ctx, hull, ROCK_EDGE, INK, ink * 2.4);
    for (const f of shaded) {
      poly(ctx, f.pts, f.color);
      ctx.strokeStyle = 'rgba(27, 16, 13, 0.28)';
      ctx.lineWidth = Math.max(0.6, ink * 0.7);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    // musgo nas faces de cima, do lado da luz
    const tops = shaded.filter((f) => f.up > 0.45 && f.lit > 0.55);
    for (let k = 0; k < Math.min(4, tops.length); k++) {
      const f = tops[Math.floor(rnd() * tops.length)];
      const c = f.pts.reduce((acc, q) => ({ x: acc.x + q.x / f.pts.length, y: acc.y + q.y / f.pts.length }), { x: 0, y: 0 });
      ctx.fillStyle = ROCK.moss[k % ROCK.moss.length];
      ctx.beginPath();
      ctx.ellipse(c.x + (rnd() - 0.5) * R * 0.25 * zoom, c.y + (rnd() - 0.5) * R * 0.12 * zoom, R * (0.12 + rnd() * 0.1) * zoom, R * (0.07 + rnd() * 0.05) * zoom, 0, 0, M.TAU);
      ctx.fill();
    }
    // fiapos de grama na base da frente (a pedra parece meio enterrada)
    ctx.lineCap = 'round';
    const depth0 = cam.depth({ x: d.x, y: d.y, z: z0 });
    for (let k = 0; k < N; k++) {
      const q = base[k];
      if (cam.depth(q) < depth0) continue;
      const j = (k + 1) % N;
      for (let b = 0; b < 3; b++) {
        const u = rnd();
        const g = { x: q.x + (base[j].x - q.x) * u, y: q.y + (base[j].y - q.y) * u, z: z0 };
        const p0 = cam.p(g);
        const hgt = (7 + rnd() * 9) * zoom;
        ctx.strokeStyle = ROCK.grass[b % ROCK.grass.length];
        ctx.lineWidth = Math.max(1, 2.4 * zoom);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y + 1);
        ctx.quadraticCurveTo(p0.x + (rnd() - 0.5) * 4 * zoom, p0.y - hgt * 0.6, p0.x + (rnd() - 0.5) * 7 * zoom, p0.y - hgt);
        ctx.stroke();
      }
    }
  };
  const ROCK_EDGE = '#5f5a52';

  /** Pedra do Véu (pedra ancestral): o mesmo símbolo da figueira, brilhando em verde-água na face da frente. */
  Small.prototype._rockGlyph = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const R = d.r || 120;
    const c = cam.p({ x: d.x + R * 0.45, y: d.y + R * 0.45, z: this.z0 + R * 0.42 });
    const z = cam.zoom;
    const r = R * 0.3 * z;
    ctx.save();
    ctx.shadowColor = '#3fd6c8';
    ctx.shadowBlur = 12 * z;
    ctx.strokeStyle = '#7ff5e6';
    ctx.lineWidth = Math.max(1.2, 3.4 * z);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - r);
    ctx.lineTo(c.x + r * 0.7, c.y);
    ctx.lineTo(c.x, c.y + r);
    ctx.lineTo(c.x - r * 0.7, c.y);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.25, 0, M.TAU);
    ctx.stroke();
    // riscos que saem do símbolo, como rachaduras acesas
    for (const [dx, dy] of [[-1.3, 0.5], [1.2, 0.7], [0.2, -1.4]]) {
      ctx.beginPath();
      ctx.moveTo(c.x + dx * r * 0.55, c.y + dy * r * 0.55);
      ctx.lineTo(c.x + dx * r * 1.05, c.y + dy * r * 1.05);
      ctx.stroke();
    }
    ctx.restore();
  };

  // tronco caído e capivara: tons de casca, madeira cortada e pelo
  const LOG = { base: '#5b4632', shade: '#3c2e21', light: '#7d654a', cut: '#c9a776', ring: '#9a7850', moss: ['#5d8a3e', '#46733a'] };
  const CAPY = { base: '#8a6a45', shade: '#68502f', light: '#a8865b', dark: '#3b2c1c', nose: '#4a3626' };

  /**
   * Tronco caído: um cilindro deitado ao longo do lado comprido da caixa (na tela, um cilindro tem sempre a largura do
   * diâmetro, de qualquer lado que se olhe: um traço grosso resolve o corpo). A ponta que fica virada para a câmera
   * mostra a madeira cortada com os anéis; musgo por cima e um toco de galho.
   */
  Small.prototype._log = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const ink = this.ink;
    const L = cam.lightScreen;
    const rnd = M.rng(Math.round(d.x0 * 5 + d.y0 * 9));
    const alongX = d.x1 - d.x0 >= d.y1 - d.y0;
    const r = Math.min((d.h || 60) / 2, (alongX ? d.y1 - d.y0 : d.x1 - d.x0) / 2);
    const cx = (d.x0 + d.x1) / 2;
    const cy = (d.y0 + d.y1) / 2;
    const half = (alongX ? d.x1 - d.x0 : d.y1 - d.y0) / 2 - r * 0.3;
    const ax = alongX ? 1 : 0;
    const ay = alongX ? 0 : 1;
    // a ponta de trás (longe da câmera) e a da frente; o tronco afina um pouco para a de trás
    const A = { x: cx - ax * half, y: cy - ay * half, z: z0 + r * 0.92 };
    const B = { x: cx + ax * half, y: cy + ay * half, z: z0 + r * 0.92 };
    const S = 10;
    const pts = [];
    for (let k = 0; k <= S; k++) {
      const u = k / S;
      const q = { x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u, z: A.z - r * 0.06 * (1 - u) };
      pts.push({ p: cam.p(q), r: r * (0.88 + 0.12 * u) * zoom });
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pass = (color, grow, off, k) => {
      ctx.strokeStyle = color;
      for (let s = 0; s + 1 < pts.length; s++) {
        const o = pts[s].r * off;
        ctx.lineWidth = Math.max(0.6, pts[s].r * 2 * k + grow);
        ctx.beginPath();
        ctx.moveTo(pts[s].p.x + L.x * o, pts[s].p.y + L.y * o);
        ctx.lineTo(pts[s + 1].p.x + L.x * o, pts[s + 1].p.y + L.y * o);
        ctx.stroke();
      }
    };
    // toco de galho (atrás do corpo, saindo para cima)
    const sb = { x: cx - ax * half * 0.2 - ay * r * 0.6, y: cy - ay * half * 0.2 - ax * r * 0.6, z: z0 + r * 1.3 };
    const se = { x: sb.x - ay * r * 0.9, y: sb.y - ax * r * 0.9, z: sb.z + r * 1.4 };
    const p0 = cam.p(sb), p1 = cam.p(se);
    for (const [color, w] of [[INK, r * 0.5 * zoom + ink * 2], [LOG.base, r * 0.5 * zoom]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    pass(INK, ink * 2.4, 0, 1);
    pass(LOG.base, 0, 0, 1);
    pass(LOG.shade, 0, -0.5, 0.48);
    pass(LOG.light, 0, 0.5, 0.26);
    // estrias da casca ao longo do tronco
    ctx.strokeStyle = 'rgba(30, 22, 15, 0.45)';
    ctx.lineWidth = Math.max(0.8, 1.6 * zoom);
    for (const f of [-0.35, 0.05, 0.4]) {
      ctx.beginPath();
      pts.forEach((q, k) => {
        const x = q.p.x - L.y * q.r * f;
        const y = q.p.y + L.x * q.r * f;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    // musgo por cima
    for (let k = 0; k < 4; k++) {
      const q = pts[1 + Math.floor(rnd() * (S - 2))];
      ctx.fillStyle = LOG.moss[k % 2];
      ctx.beginPath();
      ctx.ellipse(q.p.x + L.x * q.r * 0.45, q.p.y + L.y * q.r * 0.45, q.r * (0.35 + rnd() * 0.25), q.r * (0.18 + rnd() * 0.1), 0, 0, M.TAU);
      ctx.fill();
    }
    // a ponta da frente: a seção do tronco (círculo no plano de pé, perpendicular a ele) com os anéis da madeira
    const ring = (rr) => {
      const out = [];
      for (let k = 0; k < 24; k++) {
        const t = (k / 24) * M.TAU;
        const u = Math.cos(t) * rr;
        const w = Math.sin(t) * rr;
        out.push(cam.p({ x: B.x + (alongX ? 0 : u), y: B.y + (alongX ? u : 0), z: B.z + w }));
      }
      return out;
    };
    poly(ctx, ring(r), LOG.cut, INK, ink * 2.2);
    for (const k of [0.68, 0.42, 0.18]) poly(ctx, ring(r * k), null, LOG.ring, Math.max(0.8, 1.3 * zoom));
  };

  /** Aguapé: um tapete de folhas redondas boiando (círculos deitados na água) com flores lilás no meio. */
  Small.prototype._hyacinth = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0 + 2;
    const zoom = cam.zoom;
    const ink = this.ink;
    const rnd = M.rng(Math.round(d.x * 3 + d.y * 17));
    const R = d.r || 70;
    const leaves = [];
    const n = 5 + Math.floor(R / 14);
    for (let k = 0; k < n; k++) {
      const a = rnd() * M.TAU;
      const dist = Math.sqrt(rnd()) * R * 0.72;
      const q = { x: d.x + Math.cos(a) * dist, y: d.y + Math.sin(a) * dist, z: z0 };
      leaves.push({ q, r: R * (0.2 + rnd() * 0.12), notch: rnd() * M.TAU, depth: cam.depth(q) });
    }
    leaves.sort((p, q) => p.depth - q.depth);
    for (const l of leaves) {
      const c = cam.p(l.q);
      const rx = l.r * zoom;
      const ry = l.r * cam.sinP * zoom;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx + ink * 1.2, ry + ink * 1.2, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#3f7a34';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx, ry, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#5c9a45';
      ctx.beginPath();
      ctx.ellipse(c.x - rx * 0.18, c.y - ry * 0.22, rx * 0.66, ry * 0.6, 0, 0, M.TAU);
      ctx.fill();
      // nervura do centro até a borda
      ctx.strokeStyle = 'rgba(28, 52, 24, 0.7)';
      ctx.lineWidth = Math.max(0.6, 1 * zoom);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(l.notch) * rx, c.y + Math.sin(l.notch) * ry);
      ctx.stroke();
    }
    // flores: cachinhos lilás um pouco acima das folhas
    const flowers = R > 60 ? 2 : 1;
    for (let f = 0; f < flowers; f++) {
      const a = rnd() * M.TAU;
      const base = { x: d.x + Math.cos(a) * R * 0.2, y: d.y + Math.sin(a) * R * 0.2, z: z0 };
      const top = { ...base, z: z0 + 22 + rnd() * 8 };
      const b = cam.p(base), t = cam.p(top);
      ctx.strokeStyle = '#2f5f2a';
      ctx.lineWidth = Math.max(1, 2.2 * zoom);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * M.TAU;
        const px = t.x + Math.cos(ang) * 4.5 * zoom;
        const py = t.y + Math.sin(ang) * 3.2 * zoom - 3 * zoom;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(px, py, 3.4 * zoom + ink * 0.6, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = k % 2 ? '#b892dc' : '#9f74cc';
        ctx.beginPath();
        ctx.arc(px, py, 3.4 * zoom, 0, M.TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#f2d34a';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 3 * zoom, 1.8 * zoom, 0, M.TAU);
      ctx.fill();
    }
  };

  /**
   * Capivara (enfeite): corpo de barril deitado na direção em que olha (bolas ao longo do corpo, que ficam redondas de
   * qualquer lado; contorno de todas antes do recheio), cabeça quadradona mais baixa na frente, focinho escuro, olho e
   * orelhinhas; perninhas curtas.
   */
  Small.prototype._capybara = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const ink = this.ink;
    const a = ((d.angle || 0) * Math.PI) / 180;
    const fx = Math.cos(a);
    const fy = Math.sin(a);
    const sx = -fy; // para o lado
    const sy = fx;
    const at = (along, side, z) => ({ x: d.x + fx * along + sx * side, y: d.y + fy * along + sy * side, z: z0 + z });
    // fatias de pé, perpendiculares ao corpo: [onde, raio, altura do centro]
    const body = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      body.push({ c: at(-48 + u * 78, 0, 32 + Math.sin(u * Math.PI) * 4), r: 26 * Math.pow(Math.sin(Math.PI * (0.12 + 0.82 * u)), 0.6) });
    }
    const head = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      head.push({ c: at(30 + u * 30, 0, 36 - u * 6), r: 16 - u * 4 });
    }

    // perninhas
    ctx.lineCap = 'round';
    for (const [along, side] of [[-34, -12], [-34, 12], [16, -11], [16, 11]]) {
      const top = cam.p(at(along, side, 20));
      const foot = cam.p(at(along, side, 1));
      for (const [color, w] of [[INK, 7 * zoom + ink * 2], [CAPY.dark, 7 * zoom]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(foot.x, foot.y);
        ctx.stroke();
      }
    }
    // a cabeça vai na frente ou atrás do corpo, conforme o lado para onde olha
    const headFront = fx + fy > 0;
    const drawSlices = (list, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const sl of list) {
        const q = cam.p(sl.c);
        const rr = sl.r * zoom + (color === INK ? ink * 1.3 : 0);
        ctx.moveTo(q.x + rr, q.y);
        ctx.arc(q.x, q.y, rr, 0, M.TAU);
      }
      ctx.fill();
    };
    const parts = headFront ? [body, head] : [head, body];
    for (const part of parts) {
      drawSlices(part, INK);
      drawSlices(part, part === head ? CAPY.shade : CAPY.base);
    }
    // luz no lombo
    const L = cam.lightScreen;
    ctx.strokeStyle = CAPY.light;
    ctx.lineWidth = Math.max(1, 9 * zoom);
    ctx.beginPath();
    body.slice(2, 9).forEach((sl, i) => {
      const q = cam.p({ ...sl.c, z: sl.c.z + sl.r * 0.55 });
      i ? ctx.lineTo(q.x + L.x * 3 * zoom, q.y + L.y * 3 * zoom) : ctx.moveTo(q.x + L.x * 3 * zoom, q.y + L.y * 3 * zoom);
    });
    ctx.stroke();
    // focinho, olho e orelhas
    const snout = cam.p(at(61, 0, 30));
    ctx.fillStyle = CAPY.nose;
    ctx.beginPath();
    ctx.ellipse(snout.x, snout.y, 7 * zoom, 5.5 * zoom, 0, 0, M.TAU);
    ctx.fill();
    const side = cam.toCamera.x * sx + cam.toCamera.y * sy > 0 ? 1 : -1; // o lado da cabeça que a câmera vê
    const eye = cam.p(at(46, side * 9, 42));
    ctx.fillStyle = '#120c08';
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, Math.max(1.2, 2.6 * zoom), 0, M.TAU);
    ctx.fill();
    for (const s of [-1, 1]) {
      const ear = cam.p(at(36, s * 9, 52));
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ear.x, ear.y, 4.6 * zoom + ink * 0.8, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = CAPY.dark;
      ctx.beginPath();
      ctx.arc(ear.x, ear.y, 4.6 * zoom, 0, M.TAU);
      ctx.fill();
    }
  };
  /** Casco convexo de pontos na tela (cadeia monótona). */
  function convexHull(points) {
    const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const turn = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const q of p) {
      while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  function blobCluster(ctx, circles, colors, ink, L) {
    for (const ci of circles) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r + ink * 1.3, 0, M.TAU);
      ctx.fill();
    }
    for (const ci of circles) {
      ctx.fillStyle = colors.base;
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
      ctx.clip();
      ctx.fillStyle = colors.shade;
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
      ctx.arc(ci.x + L.x * ci.r * 0.45, ci.y + L.y * ci.r * 0.45, ci.r, 0, M.TAU, true);
      ctx.fill('evenodd');
      ctx.fillStyle = colors.light;
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
      ctx.arc(ci.x - L.x * ci.r * 0.25, ci.y - L.y * ci.r * 0.25, ci.r, 0, M.TAU, true);
      ctx.fill('evenodd');
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 0.6;
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------------ semáforo (a luz troca: desenhado a cada quadro)
  class TrafficLight extends Prop {
    constructor(world, d) {
      super(world, { x0: d.x - 14, x1: d.x + 14, y0: d.y - 14, y1: d.y + 14 }, { fades: false });
      this.d = d;
      this.collider = { type: 'circle', x: d.x, y: d.y, r: 18 };
    }
    screenBox() {
      const d = this.d;
      return bbox([this.P(d.x, d.y, this.z0), this.P(d.x, d.y, this.z0 + 400)], 40 * this.cam.zoom);
    }
    shadow(path) {
      lineShadow(path, this.cam, this.d.x, this.d.y, 400, 10);
    }
    paint(ctx) {
      const cam = this.cam;
      const d = this.d;
      const base = cam.p({ x: d.x, y: d.y, z: this.z0 });
      const top = cam.p({ x: d.x, y: d.y, z: this.z0 + 330 });
      ctx.strokeStyle = INK;
      ctx.lineWidth = 9 * cam.zoom + this.ink * 2;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      ctx.strokeStyle = '#3a3d43';
      ctx.lineWidth = 9 * cam.zoom;
      ctx.stroke();
      const w = 22 * cam.zoom;
      const h = 74 * cam.zoom;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.roundRect(top.x - w - this.ink * 1.5, top.y - h - this.ink * 1.5, 2 * w + this.ink * 3, h + this.ink * 3, 5 * cam.zoom);
      ctx.fill();
      ctx.fillStyle = '#2b2e33';
      ctx.beginPath();
      ctx.roundRect(top.x - w, top.y - h, 2 * w, h, 4 * cam.zoom);
      ctx.fill();
      this.lamps = [0, 1, 2].map((k) => ({ x: top.x, y: top.y - h + (k + 0.5) * (h / 3), r: 8.5 * cam.zoom }));
      for (const l of this.lamps) {
        ctx.fillStyle = '#4a4d52';
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r, 0, M.TAU);
        ctx.fill();
      }
    }
    draw(ctx, time) {
      super.draw(ctx);
      // ciclo: verde 6 s, amarelo 2 s, vermelho 6 s
      const t = time % 14;
      const on = t < 6 ? 2 : t < 8 ? 1 : 0;
      const colors = ['#ff4a3a', '#ffc21f', '#3fe07a'];
      const l = this.lamps[on];
      ctx.fillStyle = colors[on];
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r * 2.2, 0, M.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, M.TAU);
      ctx.fill();
    }
  }

  // ------------------------------------------------------------------ gradil, portão e pilar (mundo novo)
  // Gradil velho de ferro verde, com cipó; o portão é o mesmo gradil com quadro e travessa. Um gradil comprido é
  // dividido em pedaços de até 4 m (sprites menores e a ordem de desenho certa perto do personagem)
  class Fence extends Prop {
    static split(f, max = 400) {
      const alongY = f.y1 - f.y0 >= f.x1 - f.x0;
      const len = alongY ? f.y1 - f.y0 : f.x1 - f.x0;
      const n = Math.max(1, Math.ceil(len / max));
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = (alongY ? f.y0 : f.x0) + (len * i) / n;
        const b = (alongY ? f.y0 : f.x0) + (len * (i + 1)) / n;
        out.push(alongY ? { ...f, y0: a, y1: b, part: i } : { ...f, x0: a, x1: b, part: i });
      }
      return out;
    }
    constructor(world, f) {
      super(world, { x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y1 }, { fades: true });
      this.f = f;
      this.alongY = f.y1 - f.y0 >= f.x1 - f.x0;
    }
    _ends() {
      const f = this.f;
      return this.alongY
        ? [{ x: (f.x0 + f.x1) / 2, y: f.y0 }, { x: (f.x0 + f.x1) / 2, y: f.y1 }]
        : [{ x: f.x0, y: (f.y0 + f.y1) / 2 }, { x: f.x1, y: (f.y0 + f.y1) / 2 }];
    }
    screenBox() {
      const [a, b] = this._ends();
      const h = this.f.h + 30;
      return bbox([this.P(a.x, a.y, this.z0), this.P(b.x, b.y, this.z0), this.P(a.x, a.y, this.z0 + h), this.P(b.x, b.y, this.z0 + h)], 30 * this.cam.zoom);
    }
    shadow(path) {
      const [a, b] = this._ends();
      const L = this.cam.light;
      const h = this.f.h * 0.35;
      const dx = (-L.x / L.z) * h, dy = (-L.y / L.z) * h;
      path.moveTo(a.x, a.y);
      path.lineTo(b.x, b.y);
      path.lineTo(b.x + dx, b.y + dy);
      path.lineTo(a.x + dx, a.y + dy);
      path.closePath();
    }
    paint(ctx) {
      const cam = this.cam;
      const f = this.f;
      const z0 = this.z0;
      const ink = this.ink;
      const [a, b] = this._ends();
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const at = (u, z) => cam.p({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: z0 + z });
      const iron = '#2b4a3a';
      const ironLight = '#44705a';
      const rnd = M.rng(Math.round(a.x * 7 + a.y * 3 + (f.part || 0)));
      const line = (p, q, w, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      };
      ctx.lineCap = 'round';
      const H = f.h;
      const rails = f.gate ? [16, H * 0.5, H - 12] : [16, H - 12];
      const bars = Math.max(2, Math.round(len / 12));
      // contorno de tinta primeiro (tudo), depois o ferro
      for (const pass of [0, 1]) {
        const w = (base) => (pass ? base * cam.zoom : base * cam.zoom + ink * 2);
        const color = pass ? iron : INK;
        for (const z of rails) line(at(0, z), at(1, z), w(4), color);
        for (let i = 0; i <= bars; i++) {
          if (f.broken && rnd() < 0.18) continue;
          const u = i / bars;
          const post = i % 16 === 0 || i === bars;
          line(at(u, 0), at(u, H + (post ? 4 : 10)), w(post ? 7 : 2.6), color);
          if (!post && pass) {
            // ponta de lança
            const tip = at(u, H + 18);
            const base = at(u, H + 8);
            ctx.fillStyle = iron;
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(base.x - 3 * cam.zoom, base.y);
            ctx.lineTo(base.x + 3 * cam.zoom, base.y);
            ctx.closePath();
            ctx.fill();
          }
        }
        if (f.gate) {
          // travessa em diagonal e o quadro do portão
          line(at(0.02, 20), at(0.98, H * 0.5), w(3.4), color);
          line(at(0.02, H * 0.5), at(0.98, H - 14), w(3.4), color);
          line(at(0, 0), at(0, H + 6), w(8), color);
          line(at(1, 0), at(1, H + 6), w(8), color);
        }
      }
      // brilho no corrimão de cima
      line(at(0, H - 14), at(1, H - 14), 1.4 * cam.zoom, ironLight);
      if (f.gate) {
        // fechadura
        const lk = at(0.5, H * 0.5);
        ctx.fillStyle = INK;
        ctx.fillRect(lk.x - 5 * cam.zoom - ink, lk.y - 7 * cam.zoom - ink, 10 * cam.zoom + 2 * ink, 14 * cam.zoom + 2 * ink);
        ctx.fillStyle = '#7a6a3a';
        ctx.fillRect(lk.x - 5 * cam.zoom, lk.y - 7 * cam.zoom, 10 * cam.zoom, 14 * cam.zoom);
      }
      // cipó: tufos de folha subindo pelo gradil
      const tufts = Math.round(len / 70);
      for (let k = 0; k < tufts; k++) {
        if (rnd() < 0.35) continue;
        const u = rnd();
        const top = H * (0.3 + rnd() * 0.75);
        const circles = [];
        for (let j = 0; j < 5; j++) {
          const q = at(Math.min(1, Math.max(0, u + (rnd() - 0.5) * 0.08)), top * (j / 4) * (0.6 + rnd() * 0.5));
          circles.push({ x: q.x, y: q.y, r: (7 + rnd() * 7) * cam.zoom });
        }
        circles.sort((p, q) => p.y - q.y);
        blobCluster(ctx, circles, { base: '#2f6a35', shade: '#1f4a26', light: '#4a8a4a' }, ink, cam.lightScreen);
      }
    }
  }

  /** Pilar do portão: concreto velho com chapéu. */
  class Pillar extends Prop {
    constructor(world, b) {
      super(world, { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }, { fades: false });
      this.b = b;
      this.collider = { type: 'box', x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 };
    }
    screenBox() {
      const b = this.b;
      return bbox([this.P(b.x0, b.y1, this.z0), this.P(b.x1, b.y0, this.z0), this.P(b.x1, b.y1, this.z0), this.P(b.x0, b.y0, this.z0 + b.h + 20)], 24 * this.cam.zoom);
    }
    shadow(path) {
      const b = this.b;
      boxShadow(path, this.cam, b.x0, b.x1, b.y0, b.y1, b.h);
    }
    paint(ctx) {
      const b = this.b;
      const z0 = this.z0;
      box(ctx, this.cam, b.x0, b.x1, b.y0, b.y1, z0, z0 + b.h, { front: '#9a958a', side: '#7a756b', top: '#b4afa3' }, this.ink);
      const c = 6;
      box(ctx, this.cam, b.x0 - c, b.x1 + c, b.y0 - c, b.y1 + c, z0 + b.h, z0 + b.h + 12, { front: '#8a857a', side: '#6c675e', top: '#c2bdb1' }, this.ink);
    }
  }

  PD.props = { Prop, Building, TreeTrunk, TreeCanopy, Pole, Wall, Small, TrafficLight, Fence, Pillar, bbox, poly };
})(window.PD = window.PD || {});
