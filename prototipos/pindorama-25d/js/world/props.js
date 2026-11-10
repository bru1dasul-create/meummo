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
  class TreeTrunk extends Prop {
    constructor(world, t) {
      super(world, { x0: t.x - 22, x1: t.x + 22, y0: t.y - 22, y1: t.y + 22 }, { fades: false });
      this.t = t;
      this.collider = { type: 'circle', x: t.x, y: t.y, r: 26 };
    }
    screenBox() {
      const t = this.t;
      return bbox([this.P(t.x, t.y, this.z0), this.P(t.x, t.y, this.z0 + t.h * 0.72)], 40 * this.cam.zoom);
    }
    shadow(path) {
      const t = this.t;
      lineShadow(path, this.cam, t.x, t.y, t.h * 0.6, 16);
      circleShadow(path, this.cam, t.x, t.y, t.r * 0.95, t.h * 0.72);
    }
    paint(ctx) {
      const cam = this.cam;
      const t = this.t;
      const z0 = this.z0;
      const ink = this.ink;
      const top = t.h * 0.68;
      const pts = [];
      const r0 = 17;
      const r1 = 9;
      const N = 6;
      const lean = (k) => Math.sin(k * 1.3 + t.x) * 6;
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
      poly(ctx, shape, '#7a5537');
      // lado da sombra
      const shadeSide = pts.map((p) => ({ x: p.c.x + p.r * 0.2, y: p.c.y })).concat(right);
      poly(ctx, shadeSide, '#5a3b25');
      // caiação (barra branca do tronco)
      const wz = Math.round((N * 75) / top);
      const wl = left.slice(0, wz + 1);
      const wr = pts.slice(0, wz + 1).map((p) => ({ x: p.c.x + p.r, y: p.c.y })).reverse();
      poly(ctx, wl.concat(wr), '#efe9dc');
      poly(ctx, pts.slice(0, wz + 1).map((p) => ({ x: p.c.x + p.r * 0.2, y: p.c.y })).concat(wr), '#cfc6b4');
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

  class TreeCanopy extends Prop {
    constructor(world, t) {
      super(world, { x0: t.x - t.r, x1: t.x + t.r, y0: t.y - t.r, y1: t.y + t.r }, { overhead: true });
      this.t = t;
      const ipe = t.kind === 'ipe';
      this.colors = ipe
        ? { base: '#f2c21c', shade: '#cf8f0f', light: '#ffe46b', under: '#5d7f34' }
        : { base: '#5f9a3e', shade: '#3f7130', light: '#86bf55', under: '#355f2a' };
      this.sway = 0;
    }
    get center() {
      const t = this.t;
      return { x: t.x, y: t.y, z: this.z0 + t.h * 0.78 };
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
      const n = 13;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * M.TAU + r() * 0.5;
        const d = (k === 0 ? 0 : 0.35 + r() * 0.5) * t.r * 0.62;
        const z = (r() - 0.35) * t.r * 0.45;
        const p = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, z: c.z + z };
        blobs.push({ p, r: t.r * (0.34 + r() * 0.16), depth: cam.depth(p) + z * 0.3 });
      }
      blobs.push({ p: { x: c.x, y: c.y, z: c.z + t.r * 0.32 }, r: t.r * 0.46, depth: cam.depth({ x: c.x, y: c.y, z: c.z + t.r * 0.32 }) + 40 });
      blobs.sort((a, b) => a.depth - b.depth);
      const circles = blobs.map((b) => {
        const q = cam.p(b.p);
        return { x: q.x, y: q.y, r: b.r * cam.zoom };
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
        const back = k < circles.length * 0.4;
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
          ctx.fillStyle = this.colors.light;
          ctx.beginPath();
          ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
          ctx.arc(ci.x - L.x * ci.r * 0.25, ci.y - L.y * ci.r * 0.25, ci.r, 0, M.TAU, true);
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
  class Small extends Prop {
    constructor(world, d) {
      const fp = d.x0 !== undefined ? { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 } : { x0: d.x - (d.r || 30), x1: d.x + (d.r || 30), y0: d.y - (d.r || 30), y1: d.y + (d.r || 30) };
      super(world, fp, { fades: d.kind === 'banca' });
      this.d = d;
      const r = d.r || 30;
      this.collider = d.x0 !== undefined ? { type: 'box', ...fp } : { type: 'circle', x: d.x, y: d.y, r: d.kind === 'arbusto' ? r * 0.8 : d.kind === 'pedra' ? r : d.kind === 'mesa' ? 60 : 22 };
      this.height = { banca: 250, orelhao: 230, lixeira: 95, hidrante: 70, mesa: 80, banco: 50, arbusto: (d.r || 60) * 1.1, pedra: (d.r || 40) * 0.8, 'poste-praca': 380 }[d.kind] || 80;
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
      else if (d.kind === 'banca' || d.kind === 'banco') boxShadow(path, this.cam, f.x0, f.x1, f.y0, f.y1, this.height);
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
          blobCluster(ctx, circles, { base: '#5a9440', shade: '#3c6d2f', light: '#80b955' }, ink, cam.lightScreen);
          break;
        }
        case 'pedra': {
          const c = P(d.x, d.y, z0 + d.r * 0.35);
          const circles = [{ x: c.x, y: c.y, r: d.r * cam.zoom }, { x: c.x + d.r * 0.5 * cam.zoom, y: c.y + d.r * 0.2 * cam.zoom, r: d.r * 0.7 * cam.zoom }];
          blobCluster(ctx, circles, { base: '#9a948a', shade: '#6f6a62', light: '#c2bcb0' }, ink, cam.lightScreen);
          break;
        }
        case 'poste-praca': {
          const base = P(d.x, d.y, z0);
          const top = P(d.x, d.y, z0 + 340);
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
          ctx.fillStyle = '#ffe9a6';
          ctx.fillRect(top.x - w, top.y - 44 * cam.zoom, 2 * w, 44 * cam.zoom);
          ctx.fillStyle = '#2f4a3a';
          ctx.fillRect(top.x - w * 1.4, top.y - 52 * cam.zoom, w * 2.8, 9 * cam.zoom);
          break;
        }
      }
    }
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

  PD.props = { Prop, Building, TreeTrunk, TreeCanopy, Pole, Wall, Small, TrafficLight, bbox, poly };
})(window.PD = window.PD || {});
