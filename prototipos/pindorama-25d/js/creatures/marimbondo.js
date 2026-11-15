// Marimbondos (o enxame da mata do sul do Capão; regras da [estrutura], 15/11): 5 vespas amarelas e pretas voando em
// volta de um centro (o ponto do bicho no servidor), cada uma no seu giro e na sua altura, com as asas batendo
// (borradas). No aviso ('windup') o enxame se fecha e zune mais; na ferroada ('spin') as vespas abrem num anel em
// volta, girando depressa, e voltam. 'dodge': uma pedra passou pelo meio sem acertar (as vespas se espalham um
// instante). Ao cair ('die'), as vespas caem no chão e somem.
//   PD.creatures.create('marimbondo', xCm, yCm, yaw)
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  if (!C) return;

  /** As vespas: maiores que as de verdade, para ler com a câmera longe. */
  const S = 3.6;
  const N = 5;
  const COL = {
    head: { base: '#2a1d12', shade: '#170f08', light: '#4a3420' },
    thorax: { base: '#3b2814', shade: '#22170b', light: '#5e4222' },
    yellow: { base: '#f2c21c', shade: '#b8860b', light: '#ffe46a' },
    black: { base: '#241a0e', shade: '#140e07', light: '#3e2e1a' },
  };

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
        this.wasps.push({ rad: 14 + ((i * 37) % 17), z: 48 + ((i * 23) % 30), w: (2.2 + ((i * 13) % 10) / 6) * (i % 2 ? -1 : 1), ph: (i / N) * M.TAU + this.seed * 6, fall: 0 });
      }
      /** Segundos desde a pedra passar pelo meio ('dodge'). */
      this.dodgeT = 9;
    }

    action(kind, yaw) {
      if (kind === 'dodge') {
        this.dodgeT = 0;
        return;
      }
      super.action(kind, yaw);
    }

    animate(dt) {
      this.dodgeT += dt;
      const act = this.act;
      this.label = this.dying !== null ? 'caindo' : act ? (act.kind === 'windup' ? 'zunindo' : 'ferroando') : 'voando';
    }

    parts() {
      const t = this.time;
      const act = this.act;
      const dying = this.dying;
      const hurt = this.hurtT < 0.3 ? 1 - this.hurtT / 0.3 : 0;
      let tight = 0;
      let ring = 0;
      if (act && act.kind === 'windup') tight = M.easeOut(M.clamp01(act.t / act.dur));
      else if (act && act.kind === 'spin') {
        const k = act.t / (act.dur + act.hold);
        ring = Math.sin(Math.min(1, k) * Math.PI);
      }
      const scatter = this.dodgeT < 0.7 ? Math.sin((this.dodgeT / 0.7) * Math.PI) : 0;
      // caindo: cada vespa despenca (umas logo depois das outras) e chega no chão antes do bicho sumir (0,4 a 0,7 s)
      const fallOf = (i) => (dying === null ? 0 : M.clamp01((dying - i * 0.025) / 0.28));
      const fallK = dying === null ? 0 : M.clamp01(dying / 0.38);
      const groups = [];
      const night = C.eyes.night;
      this.wasps.forEach((w, i) => {
        const fk = fallOf(i);
        const speed = (1 + tight * 0.8 + ring * 2.2) * (1 - fk);
        const a = w.ph + t * w.w * speed;
        const jitter = 1 + tight * 1.5;
        const rad = (w.rad * (1 - tight * 0.45) + ring * 70 + scatter * (30 + i * 6) + hurt * 10) * (1 + fk * 0.25);
        const dx = Math.cos(a) * rad + (M.noise1(t * 3 + i * 7) - 0.5) * 10 * jitter;
        const dy = Math.sin(a) * rad + (M.noise1(t * 3 + i * 7 + 40) - 0.5) * 10 * jitter;
        const z0 = w.z + Math.sin(t * 5 + i) * 6 - ring * 18;
        const z = M.lerp(z0, 1.6 * S, fk * fk);
        const c = { x: this.pos.x + dx, y: this.pos.y + dy, z: this.groundZ + z };
        // para onde a vespa voa: a tangente do giro
        const dir = Math.sign(w.w) * speed;
        const fa = a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2) + fk * (2.4 + i);
        const f = { x: Math.cos(fa), y: Math.sin(fa), z: 0 };
        const along = (k) => M.add(c, M.scale(f, k * S));
        const fade = 1 - fk * 0.6; // as asas param de bater ao cair
        const balls = [
          { c: along(1.6), r: 1.25 * S, col: COL.head },
          { c: along(0.2), r: 1.45 * S, col: COL.thorax },
          { c: along(-1.4), r: 1.6 * S, col: COL.yellow },
          { c: along(-2.6), r: 1.45 * S, col: COL.black },
          { c: along(-3.6), r: 1.15 * S, col: COL.yellow },
          { c: along(-4.4), r: 0.6 * S, col: COL.black },
        ];
        const decals = [];
        if (night) {
          const side = { x: -f.y, y: f.x, z: 0 };
          for (const sgn of [-1, 1]) decals.push({ c: M.add(along(1.9), M.scale(side, sgn * 0.8 * S)), n: M.scale(side, sgn), u: f, v: { x: 0, y: 0, z: 1 }, ru: 0.5 * S, rv: 0.5 * S, color: C.eyeColor('#000'), glow: C.eyeGlow(undefined), minFacing: 0 });
        }
        groups.push({ balls, ref: c, decals, wasp: { c, f, fade }, noShadow: true });
      });
      // a sombra do enxame: uma só, macia, no chão embaixo do centro (as de cada vespa ficavam grandes demais)
      const swarmShade = (ctx) => {
        const cam = this._cam;
        if (!cam || fallK >= 1) return;
        const c = cam.p({ x: this.pos.x, y: this.pos.y, z: this.groundZ });
        const z = cam.zoom;
        const rad = (26 + ring * 50) * z;
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rad);
        g.addColorStop(0, `rgba(20, 14, 26, ${(0.22 * (1 - fallK)).toFixed(3)})`);
        g.addColorStop(1, 'rgba(20, 14, 26, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, rad, rad * 0.5, 0, 0, M.TAU);
        ctx.fill();
      };
      if (groups.length) groups[0].under = swarmShade;
      // as asas: borradas, batendo (por cima das vespas), e o zumbido na ferroada
      const wings = groups.map((g) => g.wasp);
      const after = (ctx) => {
        const cam = this._cam;
        if (!cam) return;
        for (const w of wings) {
          const base = cam.p(M.add(w.c, { x: 0, y: 0, z: 1.2 * S }));
          const z = cam.zoom;
          const flap = 0.6 + 0.4 * Math.abs(Math.sin(t * 60 + w.c.x));
          ctx.save();
          ctx.globalAlpha = 0.55 * w.fade;
          ctx.fillStyle = 'rgba(235, 245, 255, 0.85)';
          ctx.strokeStyle = 'rgba(40, 50, 60, 0.45)';
          ctx.lineWidth = 0.8;
          for (const sgn of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(base.x + sgn * 3.2 * S * 0.6 * z, base.y - 2.2 * S * 0.5 * z * flap, 2.6 * S * 0.6 * z, 1.4 * S * 0.6 * z * flap, sgn * 0.5, 0, M.TAU);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }
      };
      return { groups, after };
    }

    drawable(cam, primary) {
      this._cam = cam; // as asas precisam da câmera (o `after` desenha na tela)
      return super.drawable(cam, primary);
    }
  }

  C.define('marimbondo', Marimbondo);
})(window.PD = window.PD || {});
