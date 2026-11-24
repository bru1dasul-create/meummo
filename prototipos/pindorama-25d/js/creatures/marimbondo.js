// Marimbondos (o enxame da mata do sul do Capão; regras da [estrutura], 15/11): 5 vespas voando em volta de um centro
// (o ponto do bicho no servidor), cada uma no seu giro e na sua altura.
// Redesenho (24/11, a etapa 5 dos inimigos; o dono: "segue para os Marimbondos"): sem as bolinhas — cada vespa pintada
// como o Birim e os outros bichos (o contorno de tinta mais grosso do lado da sombra, a meia-lua de sombra e o brilho):
// a cabeça escura com a cara amarela, os olhos grandes e as antenas, o tórax com as manchinhas, a **cintura fina** e o
// abdômen comprido de listras amarelas e pretas terminando no ferrão; as asas transparentes batendo (borradas) e as
// perninhas penduradas.
// No aviso ('windup', 0,6 s) o enxame se fecha numa bola que zune, as vespas viram o ferrão para fora (o abdômen
// curvado) e aparecem os riscos do zumbido; na ferroada ('spin', a área em volta) elas mergulham num anel largo, de
// ferrão para baixo, com o rastro do giro, e voltam. 'dodge': a pedra passou pelo meio (se espalham um instante).
// Apanhando, o enxame dá um tranco para longe de quem bateu; caindo, as vespas despencam no chão e o encanto sai em
// faíscas roxas. As bolas ficam só para a caixa do desenho.
//   PD.creatures.create('marimbondo', xCm, yCm, yaw)
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  if (!C) return;
  const P = C.paint;
  const INK = C.INK;

  /** As vespas: maiores que as de verdade, para ler com a câmera longe. */
  const S = 3.6;
  const N = 5;
  const LOOK = {
    dark: { base: '#3a2716', shade: 'rgba(20, 10, 4, 0.5)', light: 'rgba(255, 236, 190, 0.3)' },
    yellow: { base: '#f2c21c', shade: 'rgba(110, 60, 0, 0.42)', light: 'rgba(255, 252, 214, 0.45)' },
  };
  const BAND = '#2a1a0c'; // as listras pretas do abdômen
  const FACE = '#f6d24a'; // a cara amarela
  const EYE = '#1a120a';
  const LEG = '#6b4a22';
  const WING = 'rgba(232, 244, 255, 0.5)';
  const WING_EDGE = 'rgba(40, 52, 66, 0.55)';
  const SPARK = '#b58cff';

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

  class Marimbondo extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 34;
      this.top = 95;
      this.ownDeath = true;
      this.acts = { windup: { dur: 0.6, hold: 0.4 }, spin: { dur: 0.55, hold: 0.25 } };
      /** Cada vespa: o raio do giro, a altura, a velocidade (e o lado), a fase. */
      this.wasps = [];
      for (let i = 0; i < N; i++) {
        this.wasps.push({ rad: 14 + ((i * 37) % 17), z: 48 + ((i * 23) % 30), w: (2.2 + ((i * 13) % 10) / 6) * (i % 2 ? -1 : 1), ph: (i / N) * M.TAU });
      }
      /** Segundos desde a pedra passar pelo meio ('dodge'). */
      this.dodgeT = 9;
      /** Para onde vai o tranco do golpe levado (no chão, unitário): para longe do herói, ou para trás. */
      this.recoilDir = { x: -Math.cos(yaw), y: -Math.sin(yaw) };
    }

    action(kind, yaw) {
      if (this.dying !== null) return;
      if (kind === 'dodge') {
        this.dodgeT = 0;
        return;
      }
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
      this.dodgeT += dt;
      const act = this.act;
      this.label = this.dying !== null ? 'caindo' : act ? (act.kind === 'windup' ? 'zunindo' : 'ferroando') : 'voando';
    }

    /** O momento (o aviso, o giro, o tranco, a queda...), em números de 0 a 1. */
    _moment() {
      const act = this.act;
      let tight = 0, ring = 0, dive = 0;
      if (act && act.kind === 'windup') tight = M.easeOut(M.clamp01(act.t / 0.35));
      else if (act && act.kind === 'spin') {
        const k = act.t / (act.dur + act.hold);
        ring = Math.sin(Math.min(1, k) * Math.PI);
        dive = M.smoothstep(0, 0.15, act.t) * (1 - M.smoothstep(0.45, 0.8, act.t));
      }
      return {
        t: this.time,
        act,
        tight,
        ring,
        dive,
        scatter: this.dodgeT < 0.7 ? Math.sin((this.dodgeT / 0.7) * Math.PI) : 0,
        rec: this.recoil(),
        dying: this.dying,
      };
    }

    /** Onde está cada vespa: o meio (o tórax), para onde voa, o quanto o abdômen curva, a queda e as asas. */
    _swarm(st) {
      const { t, tight, ring, dive, scatter, rec, dying } = st;
      const rd = this.recoilDir;
      const out = [];
      this.wasps.forEach((w, i) => {
        const fk = dying === null ? 0 : M.clamp01((dying - i * 0.025) / 0.28);
        const speed = (1 + tight * 0.9 + ring * 2.4) * (1 - fk);
        const a = w.ph + this.seed * 6 + t * w.w * speed;
        const jitter = 1 + tight * 2.2;
        const rad = (w.rad * (1 - tight * 0.5) + ring * 78 + scatter * (30 + i * 6)) * (1 + fk * 0.25);
        const dx = Math.cos(a) * rad + M.noise1(t * 3 + i * 7) * 5 * jitter + rd.x * rec * 26;
        const dy = Math.sin(a) * rad + M.noise1(t * 3 + i * 7 + 40) * 5 * jitter + rd.y * rec * 26;
        const z0 = w.z + Math.sin(t * 5 + i) * 6 + tight * 8 - dive * 30 + rec * 8;
        const z = M.lerp(z0, 1.4 * S, fk * fk);
        const c = { x: this.pos.x + dx, y: this.pos.y + dy, z: this.groundZ + z };
        // para onde a vespa olha: no voo, a tangente do giro; no aviso, para fora (o ferrão para fora é o abdômen
        // curvado para a frente: a vespa de lado, de cara para o giro, dobra o ferrão para o lado de fora)
        const dir = Math.sign(w.w) * speed;
        let fa = a + (dir >= 0 ? Math.PI / 2 : -Math.PI / 2) + fk * (2.4 + i);
        if (tight > 0) fa = M.lerp(fa, a + M.wrapAngle(fa - a) * 0.4, tight);
        const pitch = -0.5 * dive + 0.25 * fk;
        const f = M.norm({ x: Math.cos(fa) * Math.cos(pitch), y: Math.sin(fa) * Math.cos(pitch), z: Math.sin(pitch) });
        out.push({ i, c, f, curl: Math.max(tight * 0.9, dive), flap: 1 - fk * 0.9, fk, a, rad });
      });
      return out;
    }

    parts(cam) {
      const st = this._moment();
      const sw = this._swarm(st);
      const z = cam.zoom;
      const ink = Math.max(1, 0.9 * z);
      const small = z < 0.85;
      const self = this;
      const groups = sw.map((w) => ({
        balls: [{ c: w.c, r: 2.4 * S }],
        ref: w.c,
        bias: 0,
        body: true,
        noShadow: true,
        paint(ctx, flash) {
          self._paintWasp(ctx, cam, w, st, ink, flash, small);
        },
      }));
      const fallK = st.dying === null ? 0 : M.clamp01(st.dying / 0.38);
      const paint = (ctx, flash) => {
        ctx.save();
        // a sombra do enxame: uma só, macia, no chão embaixo do centro
        if (fallK < 1) {
          const c = cam.p({ x: this.pos.x, y: this.pos.y, z: this.groundZ });
          const rad = (26 + st.ring * 58) * z;
          const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rad);
          g.addColorStop(0, `rgba(20, 14, 26, ${(0.22 * (1 - fallK)).toFixed(3)})`);
          g.addColorStop(1, 'rgba(20, 14, 26, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, rad, rad * 0.5, 0, 0, M.TAU);
          ctx.fill();
        }
        for (const g of C.byDepth(cam, groups)) g.paint(ctx, flash);
        ctx.restore();
      };
      const heart = { x: this.pos.x, y: this.pos.y, z: this.groundZ + 30 };
      const after = (ctx) => {
        if (st.tight > 0.05 && st.act) this._paintBuzz(ctx, cam, st);
        if (st.ring > 0.05) this._paintTrails(ctx, cam, sw, st);
        if (st.dying !== null) this._release(ctx, cam, heart, st.dying);
      };
      return { groups, after, paint };
    }

    /**
     * Uma vespa: as asas de trás, o abdômen de listras com o ferrão (curva para a frente no aviso e no mergulho), a
     * cintura fina, o tórax e a cabeça (cara amarela, olhos e antenas), as perninhas e as asas da frente por cima.
     */
    _paintWasp(ctx, cam, w, st, ink, flash, small) {
      const z = cam.zoom;
      const { c, f } = w;
      const up0 = { x: 0, y: 0, z: 1 };
      const side = M.norm(M.cross(up0, f), { x: -f.y, y: f.x, z: 0 });
      const up = M.cross(f, side);
      const at = (a, s, u) => M.add(c, M.add(M.scale(f, a * S), M.add(M.scale(side, s * S), M.scale(up, u * S))));
      const sp = (p) => cam.p(p);
      // o abdômen: sai da cintura para trás e, curvando, desce e vem para a frente (o ferrão apontado)
      const cu = w.curl;
      const abd = [];
      const rads = [];
      const AB = [[0, 0.32], [0.18, 1.05], [0.42, 1.28], [0.66, 1.08], [0.86, 0.62], [1, 0.16]];
      // (um arco: começa para trás e vai curvando para baixo — enrolado, chega a apontar para a frente)
      const bend = 0.35 + 1.9 * cu, LA = 3.9, rho = LA / bend;
      for (const [k, r] of AB) {
        const phi = k * bend;
        abd.push(sp(at(-1.0 - rho * Math.sin(phi), 0, -rho * (1 - Math.cos(phi)))));
        rads.push(r * S * z);
      }
      const flap = w.flap;
      const beat = Math.abs(Math.sin(st.t * 62 + w.i * 1.7));
      // as asas: borradas, saindo do alto do tórax para trás
      const wing = (sg, back) => {
        const root = sp(at(0.2, sg * 0.5, 0.9));
        const tipA = sp(at(-3.2, sg * (1.5 + 1.6 * beat * flap), 1.1 + 2.2 * beat * flap));
        const tipB = sp(at(-2.6, sg * (0.9 + 0.8 * beat * flap), 0.8 + 1.2 * beat * flap));
        const tip = back ? tipB : tipA;
        const dx = tip.x - root.x, dy = tip.y - root.y;
        const l = Math.hypot(dx, dy) || 1;
        const wdt = (back ? 0.75 : 1.05) * S * z;
        ctx.beginPath();
        ctx.ellipse((root.x + tip.x) / 2, (root.y + tip.y) / 2, l / 2 + wdt * 0.3, wdt, Math.atan2(dy, dx), 0, M.TAU);
        ctx.fillStyle = WING;
        ctx.fill();
        if (!small) {
          ctx.strokeStyle = WING_EDGE;
          ctx.lineWidth = Math.max(0.6, 0.5 * z);
          ctx.stroke();
        }
      };
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * (0.35 + 0.5 * flap);
      wing(-1, true);
      wing(1, true);
      ctx.globalAlpha = a0;
      // o abdômen (amarelo) com as listras por dentro
      const ab = P.limbShape(abd, rads, true);
      P.paintLit(ctx, cam, (dx, dy, p) => P.limbPath(ab, dx, dy, p), LOOK.yellow, small ? 0 : 1.6 * z, ink, flash, {
        stroke: (dx, dy, p) => P.limbPath(ab, dx, dy, p),
        inside: (cx) => {
          cx.strokeStyle = C.tint(BAND, flash);
          cx.lineCap = 'butt';
          // três listras pretas e a ponta escura (o ferrão)
          for (const k of [1.5, 2.6, 3.6]) {
            const i = Math.min(abd.length - 2, Math.max(1, Math.round(k)));
            const p = abd[i], q = abd[i + 1] || abd[i];
            const dx = q.x - p.x, dy = q.y - p.y;
            const l = Math.hypot(dx, dy) || 1;
            const nx = -dy / l, ny = dx / l, r = rads[i] * 1.4;
            cx.lineWidth = Math.max(1, rads[i] * 0.55);
            cx.beginPath();
            cx.moveTo(p.x + nx * r, p.y + ny * r);
            cx.lineTo(p.x - nx * r, p.y - ny * r);
            cx.stroke();
          }
          cx.fillStyle = C.tint(BAND, flash);
          const e = abd[abd.length - 1];
          cx.beginPath();
          cx.arc(e.x, e.y, rads[abd.length - 2] * 1.1, 0, M.TAU);
          cx.fill();
        },
      });
      // o ferrão: um risquinho escuro saindo da ponta
      const tip = abd[abd.length - 1], pre = abd[abd.length - 2];
      const tl = Math.hypot(tip.x - pre.x, tip.y - pre.y) || 1;
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, 0.45 * S * z);
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x + ((tip.x - pre.x) / tl) * 1.1 * S * z, tip.y + ((tip.y - pre.y) / tl) * 1.1 * S * z);
      ctx.stroke();
      // as perninhas penduradas (amareladas, dobradas)
      if (!small) {
        ctx.strokeStyle = C.tint(LEG, flash);
        ctx.lineWidth = Math.max(0.8, 0.32 * S * z);
        ctx.beginPath();
        for (const [a, sg] of [[0.6, -1], [0.6, 1], [-0.2, -1], [-0.2, 1]]) {
          const h = sp(at(a, sg * 0.5, -0.6)), k = sp(at(a - 0.4, sg * 1.1, -1.5)), e2 = sp(at(a - 1.1, sg * 1.0, -2.3));
          ctx.moveTo(h.x, h.y);
          ctx.lineTo(k.x, k.y);
          ctx.lineTo(e2.x, e2.y);
        }
        ctx.stroke();
      }
      // o tórax e a cabeça (escuros): a cintura fina atrás
      const front = [sp(at(-0.95, 0, 0)), sp(at(-0.2, 0, 0.1)), sp(at(0.6, 0, 0.15)), sp(at(1.4, 0, 0.1)), sp(at(2.05, 0, 0))];
      const fr = [0.34, 1.05, 1.08, 0.86, 0.95].map((r) => r * S * z);
      const th = P.limbShape(front, fr, true);
      P.paintLit(ctx, cam, (dx, dy, p) => P.limbPath(th, dx, dy, p), LOOK.dark, small ? 0 : 1.4 * z, ink, flash, {
        stroke: (dx, dy, p) => P.limbPath(th, dx, dy, p),
        inside: (cx) => {
          // as manchinhas amarelas do tórax e a cara amarela na frente da cabeça
          cx.fillStyle = C.tint(FACE, flash);
          for (const sg of [-1, 1]) {
            const m = sp(at(0.4, sg * 0.55, 0.85));
            cx.beginPath();
            cx.arc(m.x, m.y, 0.36 * S * z, 0, M.TAU);
            cx.fill();
          }
          const face = sp(at(2.5, 0, -0.1));
          cx.beginPath();
          cx.arc(face.x, face.y, 0.62 * S * z, 0, M.TAU);
          cx.fill();
        },
        after: (cx) => {
          // os olhos grandes dos lados da cabeça (de noite, vermelhos)
          for (const sg of [-1, 1]) {
            const n = M.norm(M.add(M.scale(side, sg), M.scale(f, 0.5)));
            if (M.dot(n, cam.toCamera) < -0.1) continue;
            const e = sp(at(2.15, sg * 0.62, 0.3));
            cx.fillStyle = C.eyeColor(EYE);
            const g0 = cx.shadowBlur, gc = cx.shadowColor;
            if (C.eyes.night) {
              cx.shadowColor = C.eyeGlow('rgba(0,0,0,0)');
              cx.shadowBlur = 3 * z;
            }
            cx.beginPath();
            cx.ellipse(e.x, e.y, 0.5 * S * z, 0.66 * S * z, 0, 0, M.TAU);
            cx.fill();
            cx.shadowBlur = g0;
            cx.shadowColor = gc;
          }
        },
      });
      // as antenas
      if (!small) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(0.7, 0.28 * S * z);
        ctx.beginPath();
        for (const sg of [-1, 1]) {
          const b = sp(at(2.5, sg * 0.3, 0.6)), m = sp(at(3.2, sg * 0.75, 1.5)), e = sp(at(3.9, sg * 1.0, 1.2));
          ctx.moveTo(b.x, b.y);
          ctx.quadraticCurveTo(m.x, m.y, e.x, e.y);
        }
        ctx.stroke();
      }
      // as asas da frente, por cima
      ctx.globalAlpha = a0 * (0.4 + 0.5 * flap);
      wing(-1, false);
      wing(1, false);
      ctx.globalAlpha = a0;
    }

    /** O aviso: os riscos do zumbido em volta do enxame fechado. */
    _paintBuzz(ctx, cam, st) {
      const z = cam.zoom;
      const c = cam.p({ x: this.pos.x, y: this.pos.y, z: this.groundZ + 62 });
      const k = st.tight;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255, 236, 140, ${(0.75 * k).toFixed(3)})`;
      ctx.lineWidth = 1.6 * z;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * M.TAU + st.t * 2.2;
        const r0 = (30 + 4 * Math.sin(st.t * 40 + i)) * z, r1 = r0 + 9 * z;
        // um zigue-zague curtinho (o "zzz")
        const x0 = c.x + Math.cos(a) * r0, y0 = c.y + Math.sin(a) * r0 * 0.7;
        const x1 = c.x + Math.cos(a) * r1, y1 = c.y + Math.sin(a) * r1 * 0.7;
        const nx = -Math.sin(a) * 2.5 * z, ny = Math.cos(a) * 2.5 * z * 0.7;
        ctx.moveTo(x0, y0);
        ctx.lineTo((x0 * 2 + x1) / 3 + nx, (y0 * 2 + y1) / 3 + ny);
        ctx.lineTo((x0 + x1 * 2) / 3 - nx, (y0 + y1 * 2) / 3 - ny);
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();
      ctx.restore();
    }

    /** A ferroada: o rastro do giro atrás de cada vespa. */
    _paintTrails(ctx, cam, sw, st) {
      const z = cam.zoom;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255, 244, 200, ${(0.6 * st.ring).toFixed(3)})`;
      ctx.lineWidth = 2 * z;
      for (const w of sw) {
        const dir = Math.sign(this.wasps[w.i].w) || 1;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const a = w.a - dir * k * 0.12;
          const p = cam.p({ x: this.pos.x + Math.cos(a) * w.rad, y: this.pos.y + Math.sin(a) * w.rad, z: w.c.z });
          if (k) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    /**
     * Caídos: o encanto sai do enxame — um clarão lilás e as faíscas roxas que se espalham e sobem, sumindo (o motor
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

  C.define('marimbondo', Marimbondo);
})(window.PD = window.PD || {});
