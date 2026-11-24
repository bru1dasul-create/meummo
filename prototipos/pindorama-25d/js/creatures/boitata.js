// Filhote de Boitatá (a cobrinha de fogo da clareira da mata do sul, só de noite; regras da [estrutura], 15/11).
// Redesenho (24/11, a etapa 6 dos inimigos; o dono: "segue para o Filhote de Boitatá"): sem as bolinhas — o corpo de
// chama pintado como o Birim e os outros bichos, só que quente: o contorno vermelho-escuro (não preto), a cor laranja
// com o miolo amarelo-claro no lombo, a meia-lua de sombra vermelha e o brilho claro; as labaredas de verdade subindo
// das costas (a base azulada, a ponta laranja, cada uma no seu tremido) e as fagulhas; a cabeça de filhote, grande e
// redonda, com os **olhões de fogo** (o miolo branco e a fenda); o brilho no chão em volta. Rasteja seguindo o próprio
// rastro, em S.
// No aviso ('windup', 0,9 s) se encolhe, ergue a cabeça bem alto, as labaredas dobram e ficam brancas de quentes e as
// fagulhas giram. Na investida ('charge') o servidor põe o pé 6 m adiante de uma vez: ela **corre de verdade** pelo
// caminho (~0,35 s), esticada, com as labaredas deitando para trás (o rastro de fogo no chão é o do motor). Apanhando,
// dá um tranco para longe de quem bateu e solta fagulhas; caindo ('die'), a chama apaga numa fumacinha e o encanto sai
// em faíscas roxas; ao amanhecer ('vanish', 600 ms antes de sumir) só apaga.
//   PD.creatures.create('filhote_boitata', xCm, yCm, yaw)
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  if (!C) return;
  const P = C.paint;

  const LEN = 150; // comprimento (cm)
  const R = 7.5; // raio no meio do corpo (cm)
  const STEP = 4; // distância entre os pontos do rastro (cm)
  const NB = 26; // pontos do meio do corpo
  const LOOK = {
    body: { base: '#ff8a24', shade: 'rgba(150, 24, 0, 0.5)', light: 'rgba(255, 250, 205, 0.55)' },
    hot: { base: '#ffd65a', shade: 'rgba(200, 60, 0, 0.42)', light: 'rgba(255, 255, 235, 0.6)' },
    head: { base: '#ff9a2e', shade: 'rgba(150, 24, 0, 0.5)', light: 'rgba(255, 250, 205, 0.55)' },
  };
  const INK = '#4a1406'; // o contorno quente
  const CORE = '#ffe68a'; // o miolo claro no lombo
  const EMBER = '#b4300c'; // as escamas de brasa
  const SPARK = '#b58cff';

  /** Espessura ao longo do corpo (u = 0 na cabeça, 1 na ponta do rabo). */
  const thick = (u) => (u < 0.1 ? 0.8 + u * 2 : u < 0.55 ? 1 : Math.max(0.15, 1 - Math.pow((u - 0.55) / 0.45, 1.2) * 0.85));

  /** Estrelinha de 4 pontas (as faíscas do encanto), em px de tela. */
  function star4(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.6);
    ctx.lineTo(x + s * 0.45, y - s * 0.45);
    ctx.lineTo(x + s * 1.6, y);
    ctx.lineTo(x + s * 0.45, y + s * 0.45);
    ctx.lineTo(x, y + s * 1.6);
    ctx.lineTo(x - s * 0.45, y + s * 0.45);
    ctx.lineTo(x - s * 1.6, y);
    ctx.lineTo(x - s * 0.45, y - s * 0.45);
    ctx.closePath();
  }

  class Boitata extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 42;
      this.top = 46;
      this.ownDeath = true;
      this.acts = { windup: { dur: 0.9, hold: 0.4 }, charge: { dur: 0.7, hold: 0.3 } };
      /** Indo embora ao amanhecer ('vanish'): segundos desde o aviso (null = aceso). */
      this.vanishT = null;
      this.coil = 0;
      this.blaze = 0;
      /** Correndo a investida (o servidor manda o pé do fim de uma vez): 0 a 1 enquanto corre. */
      this.dash = 0;
      this.dist = this.seed * 200;
      /** Para onde vai o tranco do golpe levado (no chão, unitário): para longe do herói, ou para trás. */
      this.recoilDir = { x: -Math.cos(yaw), y: -Math.sin(yaw) };
      this._resetTrail();
    }

    _resetTrail() {
      const fx = Math.cos(this.yaw), fy = Math.sin(this.yaw);
      this.trail = [];
      for (let s = STEP; s <= LEN + 30; s += STEP) this.trail.push({ x: this.pos.x - fx * s, y: this.pos.y - fy * s });
    }

    /**
     * Novo ponto do pé. A investida chega de uma vez (`dash`): ela corre até lá (~17 m/s, de 0,2 a 0,45 s) e o corpo
     * passa pelo caminho (o rastro). Antes ela pulava direto para o fim.
     */
    moveTo(x, y, yaw, durationMs, dash) {
      if (dash && this.dying === null) {
        const d = Math.hypot(x - this.pos.x, y - this.pos.y);
        this._from = { x: this.pos.x, y: this.pos.y };
        this._to = { x, y };
        this._t = 0;
        this._dur = M.clamp(d / 1700, 0.2, 0.45);
        if (Number.isFinite(yaw)) this.yawTarget = yaw;
        if (d > 1) {
          // vira na hora para a linha da investida
          this.yaw = this.yawTarget = Math.atan2(y - this.pos.y, x - this.pos.x);
        }
        return;
      }
      super.moveTo(x, y, yaw, durationMs, dash);
    }

    action(kind, yaw) {
      if (kind === 'vanish') {
        if (this.vanishT === null) this.vanishT = 0;
        return;
      }
      if (this.dying !== null) return;
      if (kind === 'hurt') this.recoilDir = this._fromHero() || { x: -Math.cos(this.yaw), y: -Math.sin(this.yaw) };
      super.action(kind, yaw);
    }

    /** Para longe do herói (unitário, no chão), se ele estiver perto. */
    _fromHero() {
      const h = this.near && this.near.hero;
      if (!h) return null;
      const ax = this.pos.x - h.x, ay = this.pos.y - h.y;
      const l = Math.hypot(ax, ay);
      return l > 1 && l < 600 ? { x: ax / l, y: ay / l } : null;
    }

    /** O clarão do golpe: curto e fraco (o tranco é que mostra a pancada). */
    flash() {
      return this.hurtT < 0.14 ? 0.3 * (1 - this.hurtT / 0.14) : 0;
    }

    /** O tranco do golpe levado (0..1): vai rápido (0,06 s) e volta devagar (até 0,42 s). */
    recoil() {
      const h = this.hurtT;
      if (h < 0.06) return M.easeOut(h / 0.06);
      if (h < 0.42) return 1 - M.easeInOut((h - 0.06) / 0.36);
      return 0;
    }

    animate(dt) {
      if (this.vanishT !== null) this.vanishT += dt;
      const h = this.pos;
      const t0 = this.trail[0];
      const d = Math.hypot(h.x - t0.x, h.y - t0.y);
      if (d > 140) this._resetTrail();
      else if (d >= STEP * 2) {
        const n = Math.floor(d / STEP) - 1;
        const ux = (h.x - t0.x) / d, uy = (h.y - t0.y) / d;
        const add = [];
        for (let k = n; k >= 1; k--) add.push({ x: t0.x + ux * STEP * k, y: t0.y + uy * STEP * k });
        this.trail.unshift(...add);
        this.dist += n * STEP;
        const keep = Math.ceil((LEN + 30) / STEP) + 2;
        if (this.trail.length > keep) this.trail.length = keep;
      }
      const act = this.act;
      const winding = !!act && act.kind === 'windup';
      const charging = !!act && act.kind === 'charge';
      const running = this._t < this._dur && this.speed > 300;
      this.coil = M.damp(this.coil, winding ? 1 : 0, winding ? 8 : 6, dt);
      this.blaze = M.damp(this.blaze, winding || charging ? 1 : 0, 6, dt);
      this.dash = M.damp(this.dash, running ? 1 : 0, running ? 30 : 8, dt);
      this.label = this.dying !== null || this.vanishT !== null ? 'apagando' : charging ? 'investindo' : winding ? 'preparando' : this.speed > 30 ? 'rastejando' : 'parado';
    }

    /** Ponto do rastro a `s` cm da cabeça. */
    _trailAt(s) {
      const tr = this.trail;
      const h = this.pos;
      const d0 = Math.hypot(h.x - tr[0].x, h.y - tr[0].y);
      if (s <= d0) {
        const k = d0 > 0 ? s / d0 : 0;
        return { x: h.x + (tr[0].x - h.x) * k, y: h.y + (tr[0].y - h.y) * k };
      }
      const r = (s - d0) / STEP;
      const i = Math.min(tr.length - 2, Math.floor(r));
      const k = Math.min(1, r - i);
      return { x: tr[i].x + (tr[i + 1].x - tr[i].x) * k, y: tr[i].y + (tr[i + 1].y - tr[i].y) * k };
    }

    /** Quanto ainda está aceso (1) até apagado (0): ao amanhecer e ao cair. */
    _lit() {
      const v = this.vanishT !== null ? 1 - M.clamp01(this.vanishT / 0.6) : 1;
      const d = this.dying !== null ? 1 - M.clamp01(this.dying / 0.6) : 1;
      return Math.min(v, d);
    }

    /** O meio do corpo (pontos 3D da cabeça ao rabo) com o raio, a frente da cabeça e o lado. */
    _body() {
      const t = this.time;
      const lit = this._lit();
      const coil = M.smoothstep(0, 1, this.coil);
      const blaze = this.blaze;
      const dash = this.dash;
      const rec = this.recoil();
      const rd = this.recoilDir;
      const pts = [];
      for (let i = 0; i <= NB; i++) {
        const u = i / NB;
        // encolhido no aviso: o corpo vem mais junto (o rastro mais curto) e o pescoço sobe bem alto
        const s = u * LEN * (1 - coil * 0.45);
        const p = this._trailAt(s);
        const q = this._trailAt(s + 3);
        let tx = p.x - q.x, ty = p.y - q.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        // a onda em S (parada no chão enquanto ela avança); esticada correndo e mais apertada no aviso
        const wave = Math.sin((this.dist - s) / 26) * (9 + coil * 5) * M.smoothstep(0, 30, s) * (1 - dash * 0.85) * (1 - blaze * 0.3);
        const lift = (u < 0.2 ? Math.pow(1 - u / 0.2, 1.5) * (10 + coil * 30) : 0) + Math.sin(t * 9 + u * 7) * 1.2 * (1 - dash);
        const r = R * thick(u) * (0.7 + 0.3 * lit) * (1 + blaze * 0.12);
        const push = rec * 14 * (1 - u * 0.6);
        pts.push({ x: p.x - ty * wave + rd.x * push, y: p.y + tx * wave + rd.y * push, z: this.groundZ + r + lift + rec * 4 * (1 - u), r, u });
      }
      const nx = pts[0].x - pts[2].x, ny = pts[0].y - pts[2].y;
      const nl = Math.hypot(nx, ny) || 1;
      const f = { x: nx / nl, y: ny / nl, z: 0 };
      return { pts, f, side: { x: -f.y, y: f.x, z: 0 }, lit, coil, blaze, dash, rec, t };
    }

    parts(cam) {
      const B = this._body();
      const { pts, lit } = B;
      const z = cam.zoom;
      const ink = Math.max(1, 0.95 * z);
      const small = z < 0.85;
      const self = this;
      const balls = pts.filter((p, i) => i % 2 === 0).map((p) => ({ c: p, r: p.r * Math.max(0.05, lit) }));
      const head = pts[0];
      const groups = [
        {
          balls,
          ref: pts[Math.floor(NB * 0.3)],
          bias: 0,
          body: true,
          noShadow: true,
          paint(ctx, flash) {
            self._paintFire(ctx, cam, B, ink, flash, small);
          },
        },
      ];
      const heart = { x: pts[Math.floor(NB * 0.35)].x, y: pts[Math.floor(NB * 0.35)].y, z: this.groundZ + 14 };
      const after = (ctx) => {
        if (lit < 0.98) this._paintSmoke(ctx, cam, B);
        if (this.dying !== null) this._release(ctx, cam, heart, this.dying);
      };
      this.top = head.z - this.groundZ + 22 + B.blaze * 14;
      const paint = (ctx, flash) => {
        ctx.save();
        for (const g of groups) g.paint(ctx, flash);
        ctx.restore();
      };
      return { groups, after, paint };
    }

    /**
     * O fogo inteiro: o brilho no chão, as labaredas de trás, o corpo pintado (o contorno quente, o miolo claro e as
     * escamas de brasa por dentro, a sombra vermelha e o brilho), a cabeça com os olhões, as labaredas da frente e as
     * fagulhas.
     */
    _paintFire(ctx, cam, B, ink, flash, small) {
      const { pts, f, side, lit, blaze, dash, t } = B;
      if (lit <= 0.02) return;
      const z = cam.zoom;
      const sp = (p) => cam.p(p);
      // o brilho no chão (fogo ilumina: no lugar da sombra)
      const mid = pts[Math.floor(NB * 0.35)];
      const c = sp({ x: mid.x, y: mid.y, z: this.groundZ });
      const rad = (50 + blaze * 26 + Math.sin(t * 7) * 4) * z;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rad);
      g.addColorStop(0, `rgba(255, 150, 50, ${(0.32 * lit).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255, 120, 30, 0)');
      const op0 = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rad, rad * 0.55, 0, 0, M.TAU);
      ctx.fill();
      ctx.globalCompositeOperation = op0;
      // as labaredas: as de trás (no lado longe da câmera) antes do corpo
      const flames = this._flames(B, cam);
      const back = flames.filter((fl) => fl.back);
      const front = flames.filter((fl) => !fl.back);
      this._paintFlames(ctx, back, lit, z);
      // o corpo
      const q = pts.map(sp);
      const rz = pts.map((p) => p.r * z);
      const shape = P.limbShape(q, rz, true);
      const bodyLook = { ...LOOK.body, base: M.mix(LOOK.body.base, '#fff4c8', blaze * 0.35) };
      // o contorno quente (o paintLit risca de preto: aqui o risco vem antes, vermelho-escuro)
      this._warmInk(ctx, cam, (dx, dy) => P.limbStrokePath(shape, dx, dy), ink);
      P.paintLit(ctx, cam, (dx, dy, p) => P.limbPath(shape, dx, dy, p), bodyLook, small ? 0 : rz[6] * 0.5, 0, flash, {
        inside: (cx) => {
          // o miolo claro no lombo (um tubo mais fino, puxado para cima)
          const core = P.limbShape(pts.map((p) => sp({ x: p.x, y: p.y, z: p.z + p.r * 0.35 })), rz.map((r, i) => r * (0.42 - 0.12 * pts[i].u)), true);
          cx.fillStyle = C.tint(M.mix(CORE, '#ffffff', blaze * 0.5), flash);
          cx.fill(P.limbPath(core));
          // as escamas de brasa: risquinhos escuros nos flancos, tremendo
          if (!small) {
            cx.strokeStyle = C.tint(EMBER, flash);
            cx.lineWidth = Math.max(1, 0.9 * z);
            cx.lineCap = 'round';
            cx.beginPath();
            for (let i = 3; i < NB - 3; i += 2) {
              const p = pts[i];
              const sg = i % 4 === 1 ? 1 : -1;
              const a = sp({ x: p.x + side.x * sg * p.r * 0.75, y: p.y + side.y * sg * p.r * 0.75, z: p.z - p.r * 0.15 });
              const b = sp({ x: p.x + side.x * sg * p.r * 0.55 - f.x * 2, y: p.y + side.y * sg * p.r * 0.55 - f.y * 2, z: p.z - p.r * 0.45 });
              cx.moveTo(a.x, a.y);
              cx.lineTo(b.x, b.y);
            }
            cx.stroke();
          }
        },
      });
      // a cabeça de filhote: grande e redonda, com os olhões de fogo
      this._paintHead(ctx, cam, B, ink, flash, small);
      this._paintFlames(ctx, front, lit, z);
      // as fagulhas subindo (mais no aviso e correndo)
      ctx.globalCompositeOperation = 'lighter';
      const nE = small ? 5 : 9;
      for (let i = 0; i < nE; i++) {
        const r1 = C.hash01(i * 5.3 + this.seed * 31);
        const life = (t * (0.9 + r1) + r1 * 7) % 1;
        const p = pts[Math.floor(r1 * (NB - 4))];
        const swirl = blaze * Math.sin(t * 6 + i) * 10;
        const e = sp({ x: p.x + Math.cos(i + t) * swirl - f.x * dash * life * 40, y: p.y + Math.sin(i + t) * swirl - f.y * dash * life * 40, z: p.z + p.r + life * (24 + blaze * 30) });
        ctx.globalAlpha = (1 - life) * lit * (0.6 + 0.4 * blaze);
        ctx.fillStyle = life < 0.5 ? '#fff0a0' : '#ff8a2a';
        ctx.beginPath();
        ctx.arc(e.x, e.y, (1.2 + (1 - life) * 1.4) * z, 0, M.TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = op0;
    }

    /** O contorno de tinta quente (vermelho-escuro): mais grosso do lado da sombra, como o do Birim. */
    _warmInk(ctx, cam, line, ink) {
      const L = cam.lightScreen;
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(line(0, 0));
      ctx.stroke(line(-L.x * ink * 0.5, -L.y * ink * 0.5));
    }

    /** As labaredas ao longo das costas: onde nascem, a altura (tremendo), para onde deitam e se ficam atrás do corpo. */
    _flames(B, cam) {
      const { pts, f, side, blaze, dash, t, lit } = B;
      const out = [];
      for (let i = 1; i < NB - 2; i += 2) {
        const p = pts[i];
        const flick = 0.5 + 0.5 * M.noise1(t * 6 + i * 3.1);
        const hgt = (9 + flick * 13 + blaze * 16) * (1 - p.u * 0.55) * lit;
        // de cada lado do lombo, alternando: a do lado longe da câmera fica atrás do corpo
        const sg = (i >> 1) % 2 ? 1 : -1;
        const off = { x: side.x * sg * p.r * 0.45, y: side.y * sg * p.r * 0.45, z: 0 };
        const back = off.x * cam.toCamera.x + off.y * cam.toCamera.y < 0;
        const lean = { x: -f.x * (dash * 1.4 + 0.15) + Math.sin(t * 5 + i) * 0.18, y: -f.y * (dash * 1.4 + 0.15) + Math.cos(t * 4 + i) * 0.12 };
        const base = { x: p.x + off.x, y: p.y + off.y, z: p.z + p.r * 0.55 };
        const top = { x: base.x + lean.x * hgt, y: base.y + lean.y * hgt, z: base.z + hgt * (1 - dash * 0.55) };
        out.push({ base: cam.p(base), top: cam.p(top), w: p.r * (0.62 + blaze * 0.2), hot: blaze, back });
      }
      return out;
    }

    /** Uma labareda: a gota de fora (laranja, a base azulada) e o miolo amarelo, somando luz. */
    _paintFlames(ctx, list, lit, z) {
      const op0 = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      for (const fl of list) {
        const { base, top } = fl;
        const w = fl.w * z;
        const g = ctx.createLinearGradient(base.x, base.y, top.x, top.y);
        g.addColorStop(0, `rgba(120, 175, 255, ${(0.5 * lit).toFixed(3)})`);
        g.addColorStop(0.3, `rgba(255, ${Math.round(150 + 80 * fl.hot)}, 60, ${(0.8 * lit).toFixed(3)})`);
        g.addColorStop(1, 'rgba(255, 80, 20, 0)');
        ctx.fillStyle = g;
        const mx = (base.x + top.x) / 2, my = (base.y + top.y) / 2;
        ctx.beginPath();
        ctx.moveTo(base.x - w, base.y);
        ctx.bezierCurveTo(base.x - w * 1.1, my, mx - w * 0.3, my - (top.y - base.y) * -0.1, top.x, top.y);
        ctx.bezierCurveTo(mx + w * 0.3, my, base.x + w * 1.1, my, base.x + w, base.y);
        ctx.closePath();
        ctx.fill();
        // o miolo
        ctx.fillStyle = `rgba(255, 245, 190, ${(0.55 * lit * (0.6 + 0.4 * fl.hot)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(base.x - w * 0.45, base.y);
        ctx.quadraticCurveTo(base.x, (base.y + my) / 2, (base.x + top.x * 1.4) / 2.4, (base.y + top.y * 1.4) / 2.4);
        ctx.quadraticCurveTo(base.x, (base.y + my) / 2, base.x + w * 0.45, base.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = op0;
    }

    /** A cabeça redonda de filhote e os olhões de fogo (o miolo branco e a fenda), olhando para a frente. */
    _paintHead(ctx, cam, B, ink, flash, small) {
      const { pts, f, side, blaze, lit } = B;
      const z = cam.zoom;
      const h = pts[0];
      const up = { x: 0, y: 0, z: 1 };
      const hc = { x: h.x + f.x * 4, y: h.y + f.y * 4, z: h.z + 1.5 };
      const HR = R * 1.3 * (0.7 + 0.3 * lit);
      // a cabeça: um oval (mais comprido para a frente), pela tela
      const ring = [];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * M.TAU;
        for (const zz of [-0.7, 0, 0.75]) {
          const w = Math.sqrt(1 - zz * zz);
          const p = { x: hc.x + (f.x * Math.cos(a) * 1.25 + side.x * Math.sin(a)) * HR * w, y: hc.y + (f.y * Math.cos(a) * 1.25 + side.y * Math.sin(a)) * HR * w, z: hc.z + zz * HR * 0.85 };
          const q = cam.p(p);
          ring.push(q.x, q.y);
        }
      }
      const hull = PD.shapes.convexHull(ring);
      const look = { ...LOOK.head, base: M.mix(LOOK.head.base, '#fff4c8', blaze * 0.3) };
      this._warmInk(ctx, cam, (dx, dy) => PD.shapes.polyPath(hull, dx, dy), ink);
      P.paintLit(ctx, cam, (dx, dy, p) => PD.shapes.fillPath(hull, dx, dy, p), look, small ? 0 : 3 * z, 0, flash, {
        after: (cx) => {
          // os olhões: do lado que a câmera vê, grandes, brilhando
          for (const sg of [-1, 1]) {
            const n = M.norm(M.add(M.add(M.scale(side, sg * 0.75), M.scale(f, 0.55)), M.scale(up, 0.45)));
            if (M.dot(n, cam.toCamera) < -0.05) continue;
            const e = cam.p(M.add(hc, M.scale(n, HR * 0.92)));
            const er = (2.6 + blaze * 0.8) * z * (0.7 + 0.3 * lit);
            const b0 = cx.shadowBlur, c0 = cx.shadowColor;
            cx.shadowColor = 'rgba(255, 240, 150, 0.95)';
            cx.shadowBlur = 5 * z;
            cx.fillStyle = '#fffbe2';
            cx.beginPath();
            cx.ellipse(e.x, e.y, er, er * 1.15, 0, 0, M.TAU);
            cx.fill();
            cx.shadowBlur = b0;
            cx.shadowColor = c0;
            // a fenda (fina no aviso: a cara de brava)
            cx.fillStyle = '#7a1c04';
            cx.beginPath();
            cx.ellipse(e.x, e.y, er * (0.28 - 0.12 * blaze), er * 0.9, 0, 0, M.TAU);
            cx.fill();
          }
        },
      });
    }

    /** Apagando: a fumaça subindo de onde a chama apagou. */
    _paintSmoke(ctx, cam, B) {
      const z = cam.zoom;
      const k = 1 - B.lit;
      ctx.save();
      for (let i = 0; i < B.pts.length; i += 4) {
        const p = B.pts[i];
        const c = cam.p({ x: p.x, y: p.y, z: p.z + k * 40 + i });
        ctx.fillStyle = `rgba(90, 90, 96, ${(0.35 * Math.sin(k * Math.PI)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, (6 + k * 10) * z, 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    /**
     * Caído: o encanto sai do corpo — um clarão lilás e as faíscas roxas que se espalham e sobem, sumindo (o motor
     * tira o desenho 0,7 s depois da queda). O mesmo dos outros bichos.
     */
    _release(ctx, cam, heart, d) {
      const z = cam.zoom;
      const q = cam.p(heart);
      if (d < 0.5) {
        const k = d / 0.5;
        const rr = (12 + 24 * M.easeOut(k)) * 1.6 * z;
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr);
        g.addColorStop(0, `rgba(214, 178, 255, ${0.55 * (1 - k)})`);
        g.addColorStop(1, 'rgba(180, 140, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rr, 0, M.TAU);
        ctx.fill();
      }
      const NS = 14;
      ctx.save();
      const base = ctx.globalAlpha;
      for (let i = 0; i < NS; i++) {
        const r1 = C.hash01(i * 3.1 + this.seed * 50), r2 = C.hash01(i * 7.7 + 1.3), r3 = C.hash01(i * 1.9 + 4.2);
        const t0 = 0.04 + r3 * 0.14;
        const k = (d - t0) / 0.5;
        if (k <= 0 || k >= 1) continue;
        const a = (i / NS) * M.TAU + r1 * 0.7;
        const dist = (8 + 20 * r2) * 1.6 * M.easeOut(k);
        const rise = (10 + 40 * r1) * 1.6 * k;
        const p = cam.p({ x: heart.x + Math.cos(a) * dist, y: heart.y + Math.sin(a) * dist, z: heart.z + rise });
        const s = (2.2 + 1.8 * r2) * z * (1 - 0.55 * k);
        ctx.globalAlpha = base * (k < 0.12 ? k / 0.12 : 1 - M.smoothstep(0.5, 1, k));
        ctx.fillStyle = 'rgba(181, 140, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 2.2, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = SPARK;
        star4(ctx, p.x, p.y, s);
        ctx.fill();
        ctx.fillStyle = '#f4ecff';
        star4(ctx, p.x, p.y, s * 0.45);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  C.define('filhote_boitata', Boitata);
})(window.PD = window.PD || {});
