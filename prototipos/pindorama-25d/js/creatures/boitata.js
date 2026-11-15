// Filhote de Boitatá (a cobrinha de fogo da clareira da mata do sul, só de noite; regras da [estrutura], 15/11): o
// corpo é de chama (o miolo claro, amarelo e laranja, a beirada vermelha), sem contorno escuro, com línguas de fogo
// subindo (a base azulada) e o brilho no chão em volta; os olhos acesos. Rasteja seguindo o próprio rastro, em S. No
// aviso ('windup') se encolhe e ergue a cabeça, o fogo cresce; na investida ('charge') estica e dispara (o rastro de
// fogo no chão é o da Mula, do motor). Ao amanhecer ('vanish', 600 ms antes de sumir) e ao cair ('die'), a chama apaga
// e sobra uma fumacinha.
//   PD.creatures.create('filhote_boitata', xCm, yCm, yaw)
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  if (!C) return;

  const LEN = 150; // comprimento (cm)
  const R = 7.5; // raio no meio do corpo (cm)
  const STEP = 4; // distância entre os pontos do rastro (cm)
  const FIRE = {
    core: { base: '#ffcf4a', shade: '#ff8a1e', light: '#fff4c2' },
    mid: { base: '#ff9a2a', shade: '#e0520e', light: '#ffd27a' },
    edge: { base: '#f0621a', shade: '#b8300a', light: '#ffa14a' },
  };

  /** Espessura ao longo do corpo (u = 0 na cabeça, 1 na ponta do rabo). */
  const thick = (u) => (u < 0.1 ? 0.8 + u * 2 : u < 0.55 ? 1 : Math.max(0.15, 1 - Math.pow((u - 0.55) / 0.45, 1.2) * 0.85));

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
      this.dist = this.seed * 200;
      this._resetTrail();
    }

    _resetTrail() {
      const fx = Math.cos(this.yaw), fy = Math.sin(this.yaw);
      this.trail = [];
      for (let s = STEP; s <= LEN + 30; s += STEP) this.trail.push({ x: this.pos.x - fx * s, y: this.pos.y - fy * s });
    }

    action(kind, yaw) {
      if (kind === 'vanish') {
        if (this.vanishT === null) this.vanishT = 0;
        return;
      }
      super.action(kind, yaw);
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
      this.coil = M.damp(this.coil, winding ? 1 : 0, winding ? 8 : 5, dt);
      this.blaze = M.damp(this.blaze, winding || charging ? 1 : 0, 6, dt);
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

    parts(cam) {
      const t = this.time;
      const lit = this._lit();
      const coil = M.smoothstep(0, 1, this.coil);
      const blaze = this.blaze;
      const hurt = this.hurtT < 0.3 ? 1 - this.hurtT / 0.3 : 0;
      const groups = [];
      const pts = [];
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        // encolhido no aviso: o corpo vem mais junto (o rastro mais curto) e o pescoço sobe
        const s = u * LEN * (1 - coil * 0.4);
        const p = this._trailAt(s);
        const q = this._trailAt(s + 3);
        let tx = p.x - q.x, ty = p.y - q.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        // a onda em S (parada no chão enquanto ela avança: depende do caminho, não do tempo)
        const wave = Math.sin((this.dist - s) / 26) * 9 * M.smoothstep(0, 30, s) * (1 - blaze * 0.6);
        const lift = (u < 0.18 ? (1 - u / 0.18) * (10 + coil * 22) : 0) + Math.sin(t * 9 + u * 7) * 1.2;
        pts.push({ x: p.x - ty * wave, y: p.y + tx * wave, z: this.groundZ + R * thick(u) + lift - hurt * 2, r: R * thick(u) * (0.75 + 0.25 * lit) * (1 + blaze * 0.15), u });
      }
      const balls = pts.map((p) => ({ c: p, r: p.r, col: p.u < 0.2 ? FIRE.core : p.u < 0.6 ? FIRE.mid : FIRE.edge, noInk: true }));
      const head = pts[0];
      const nx = pts[0].x - pts[2].x, ny = pts[0].y - pts[2].y;
      const nl = Math.hypot(nx, ny) || 1;
      const f = { x: nx / nl, y: ny / nl, z: 0 };
      const side = { x: -f.y, y: f.x, z: 0 };
      // a cabeça: uma bola maior na frente, os olhos acesos
      balls.unshift({ c: { x: head.x + f.x * 4, y: head.y + f.y * 4, z: head.z + 1 }, r: R * 1.2, col: FIRE.core, noInk: true });
      const decals = [];
      for (const sgn of [-1, 1]) {
        const out = M.norm({ x: side.x * sgn + f.x * 0.5, y: side.y * sgn + f.y * 0.5, z: 0.3 });
        decals.push({ c: { x: head.x + f.x * 6 + side.x * sgn * 5, y: head.y + f.y * 6 + side.y * sgn * 5, z: head.z + 4 }, n: out, u: f, v: { x: 0, y: 0, z: 1 }, ru: 2.4, rv: 2.4, color: C.eyeColor('#fff6c8'), glow: C.eyeGlow('rgba(255, 240, 160, 0.95)'), minFacing: -0.2 });
      }
      // o brilho no chão, embaixo de tudo (no lugar da sombra: fogo ilumina)
      const under = (ctx) => {
        if (lit <= 0.02) return;
        const c = cam.p({ x: pts[Math.floor(n * 0.35)].x, y: pts[Math.floor(n * 0.35)].y, z: this.groundZ });
        const z = cam.zoom;
        const rad = (46 + blaze * 22 + Math.sin(t * 7) * 4) * z;
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rad);
        g.addColorStop(0, `rgba(255, 150, 50, ${(0.3 * lit).toFixed(3)})`);
        g.addColorStop(1, 'rgba(255, 120, 30, 0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, rad, rad * 0.55, 0, 0, M.TAU);
        ctx.fill();
        ctx.restore();
      };
      groups.push({ balls, ref: { x: pts[6].x, y: pts[6].y, z: pts[6].z }, body: true, decals, noShadow: true, matte: false, under });
      // as línguas de fogo subindo do corpo (a base azulada, a ponta laranja) e, apagando, a fumaça
      const after = (ctx) => {
        const z = cam.zoom;
        ctx.save();
        if (lit > 0.02) {
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < pts.length; i += 2) {
            const p = pts[i];
            const flick = M.noise1(t * 6 + i * 3.1);
            const hgt = (8 + flick * 14 + blaze * 10) * (1 - p.u * 0.6) * lit;
            const base = cam.p({ x: p.x, y: p.y, z: p.z + p.r * 0.6 });
            const top = cam.p({ x: p.x + Math.sin(t * 5 + i) * 3, y: p.y, z: p.z + p.r * 0.6 + hgt });
            const w = p.r * 0.7 * z;
            const g = ctx.createLinearGradient(base.x, base.y, top.x, top.y);
            g.addColorStop(0, `rgba(110, 170, 255, ${(0.55 * lit).toFixed(3)})`);
            g.addColorStop(0.35, `rgba(255, 170, 60, ${(0.7 * lit).toFixed(3)})`);
            g.addColorStop(1, 'rgba(255, 90, 20, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(base.x - w, base.y);
            ctx.quadraticCurveTo(base.x - w * 0.6, (base.y + top.y) / 2, top.x, top.y);
            ctx.quadraticCurveTo(base.x + w * 0.6, (base.y + top.y) / 2, base.x + w, base.y);
            ctx.closePath();
            ctx.fill();
          }
        }
        if (lit < 0.98) {
          // a fumaça subindo de onde a chama apagou
          ctx.globalCompositeOperation = 'source-over';
          const k = 1 - lit;
          for (let i = 0; i < pts.length; i += 4) {
            const p = pts[i];
            const c = cam.p({ x: p.x, y: p.y, z: p.z + k * 40 + i });
            ctx.fillStyle = `rgba(90, 90, 96, ${(0.35 * Math.sin(k * Math.PI)).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(c.x, c.y, (6 + k * 10) * z, 0, M.TAU);
            ctx.fill();
          }
        }
        ctx.restore();
      };
      // apagando: o corpo também some
      if (lit < 1) for (const b of balls) b.r *= Math.max(0.05, lit);
      return { groups, after };
    }
  }

  C.define('filhote_boitata', Boitata);
})(window.PD = window.PD || {});
