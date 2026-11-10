// O mundo: junta o chão, os objetos e os personagens; decide quem é desenhado na frente de quem (ordem
// isométrica pelo pé de cada coisa), cuida da colisão e dos efeitos (poeira, soco, pétalas, o círculo do
// despertar). O que esconde o personagem fica meio transparente.
(function (PD) {
  'use strict';
  const M = PD.math;
  const P = PD.props;

  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) {
      this.rect(x, y, w, h);
    };
  }

  /** `a` deve ser desenhado antes de `b`? (pela caixa do pé no chão) */
  function behind(a, b) {
    const A = a.fp;
    const B = b.fp;
    if (A.x1 <= B.x0 + 0.5 || A.y1 <= B.y0 + 0.5) return true;
    if (B.x1 <= A.x0 + 0.5 || B.y1 <= A.y0 + 0.5) return false;
    // pés se cruzam: copa de árvore fica por cima de quem está embaixo dela
    if (!!a.overhead !== !!b.overhead) return !a.overhead;
    return A.x0 + A.x1 + A.y0 + A.y1 < B.x0 + B.x1 + B.y0 + B.y1;
  }
  const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

  class World {
    constructor(cam) {
      this.cam = cam;
      this.map = PD.MAP;
      this.time = 0;
      this.props = [];
      this.ground = new PD.Ground(cam, this.map, this.props);
      this._build();
      this.particles = [];
      this.petals = [];
      this.sparks = [];
      this.order = null;
    }

    _build() {
      const m = this.map;
      const add = (p) => (this.props.push(p), p);
      for (const b of m.buildings) add(new P.Building(this, b));
      for (const w of m.walls) add(new P.Wall(this, w));
      for (const t of m.trees) {
        add(new P.TreeTrunk(this, t));
        add(new P.TreeCanopy(this, t));
      }
      this.poles = m.poles.map((p) => add(new P.Pole(this, p)));
      add(new P.TrafficLight(this, m.trafficLight));
      for (const d of m.props) add(new P.Small(this, d));
      this.colliders = this.props.filter((p) => p.collider).map((p) => p.collider);
    }

    heightAt(x, y) {
      return this.ground.heightAt(x, y);
    }

    /** Empurra um círculo (x, y, r) para fora das paredes e objetos; desliza encostado. */
    collide(x, y, r) {
      const m = this.map;
      for (let pass = 0; pass < 3; pass++) {
        for (const c of this.colliders) {
          if (c.type === 'box') {
            const cx = M.clamp(x, c.x0, c.x1);
            const cy = M.clamp(y, c.y0, c.y1);
            const dx = x - cx;
            const dy = y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 >= r * r) continue;
            if (d2 > 1e-6) {
              const d = Math.sqrt(d2);
              x = cx + (dx / d) * r;
              y = cy + (dy / d) * r;
            } else {
              // centro dentro da caixa: sai pelo lado mais perto
              const opts = [[x - c.x0, -1, 0], [c.x1 - x, 1, 0], [y - c.y0, 0, -1], [c.y1 - y, 0, 1]].sort((a, b) => a[0] - b[0]);
              const [, sx, sy] = opts[0];
              if (sx) x = sx < 0 ? c.x0 - r : c.x1 + r;
              if (sy) y = sy < 0 ? c.y0 - r : c.y1 + r;
            }
          } else {
            const dx = x - c.x;
            const dy = y - c.y;
            const min = r + c.r;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 < 1e-6) continue;
            const d = Math.sqrt(d2);
            x = c.x + (dx / d) * min;
            y = c.y + (dy / d) * min;
          }
        }
      }
      // limites do mapa
      x = M.clamp(x, r + 10, m.w - r - 10);
      y = M.clamp(y, r + 10, m.h - r - 10);
      return { x, y };
    }

    _staticOrder() {
      if (this.order) return this.order;
      const items = this.props.slice();
      const n = items.length;
      const boxes = items.map((p) => p.bounds);
      const before = items.map(() => []);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (!overlap(boxes[i], boxes[j])) continue;
          if (behind(items[i], items[j])) before[j].push(i);
          else before[i].push(j);
        }
      }
      const out = [];
      const state = new Array(n).fill(0);
      const visit = (i) => {
        if (state[i] === 2) return;
        if (state[i] === 1) return; // ciclo raro: ignora
        state[i] = 1;
        for (const k of before[i]) visit(k);
        state[i] = 2;
        out.push(items[i]);
      };
      // começa pelos de trás (menor x+y), para empates ficarem estáveis
      const idx = items.map((p, i) => i).sort((a, b) => items[a].fp.x0 + items[a].fp.y0 - (items[b].fp.x0 + items[b].fp.y0));
      for (const i of idx) visit(i);
      this.order = out;
      return out;
    }

    /** Recalcula imagens prontas (mudou o zoom ou a tela). */
    invalidate() {
      this.order = null;
      for (const p of this.props) p.spriteKey = '';
    }

    update(dt, hero) {
      this.time += dt;
      const t = this.time;
      // eventos do personagem: poeira e soco
      for (const ev of hero.events) {
        if (ev.type === 'poeira') this._dust(ev.x, ev.y, hero.groundZ || 0, ev.strength);
        if (ev.type === 'impacto') this._impact(hero, ev.hand);
      }
      hero.events.length = 0;
      // poeira de quem corre
      if (hero.runBlend > 0.6 && hero.jump.state === 'chao') {
        const k = Math.floor(hero.phase * 2);
        if (k !== this._lastStep) {
          this._lastStep = k;
          this._dust(hero.pos.x - Math.cos(hero.yaw) * 20, hero.pos.y - Math.sin(hero.yaw) * 20, hero.groundZ || 0, 0.35);
        }
      }
      // partículas
      for (const p of this.particles) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vz -= (p.g || 0) * dt;
      }
      this.particles = this.particles.filter((p) => p.t < p.life);
      // pétalas do ipê caindo (com o vento)
      for (const tr of this.map.trees) {
        if (tr.kind !== 'ipe') continue;
        if (Math.random() < dt * 1.6 && this.petals.length < 70) {
          const a = Math.random() * M.TAU;
          const d = Math.random() * tr.r * 0.8;
          this.petals.push({ x: tr.x + Math.cos(a) * d, y: tr.y + Math.sin(a) * d, z: tr.h * 0.8 + Math.random() * 60, t: 0, spin: Math.random() * M.TAU, seed: Math.random() * 10 });
        }
      }
      for (const p of this.petals) {
        p.t += dt;
        p.z -= 38 * dt;
        p.x += (60 + Math.sin(t * 1.3 + p.seed) * 40) * dt;
        p.y += (-25 + Math.cos(t * 1.7 + p.seed) * 30) * dt;
        p.spin += dt * 3;
      }
      this.petals = this.petals.filter((p) => p.z > 14);
      // faíscas do círculo do despertar
      const aw = this.map.awakening;
      if (Math.random() < dt * 9 && this.sparks.length < 60) {
        const a = Math.random() * M.TAU;
        const d = Math.sqrt(Math.random()) * aw.r;
        this.sparks.push({ x: aw.x + Math.cos(a) * d, y: aw.y + Math.sin(a) * d, z: 16, t: 0, life: 1.6 + Math.random() * 1.6, hue: Math.random() });
      }
      for (const s of this.sparks) {
        s.t += dt;
        s.z += 55 * dt;
        s.x += Math.sin(t * 2 + s.hue * 9) * 12 * dt;
      }
      this.sparks = this.sparks.filter((s) => s.t < s.life);
    }

    _dust(x, y, z, strength) {
      const n = Math.round(4 + strength * 6);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * M.TAU + Math.random() * 0.4;
        const sp = 60 + Math.random() * 90 * strength;
        this.particles.push({ kind: 'poeira', x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, z: z + 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 30 + Math.random() * 40, t: 0, life: 0.45 + Math.random() * 0.25, r: 9 + strength * 9 });
      }
    }

    _impact(hero, hand) {
      const pose = hero.pose();
      const rig = PD.rig.buildRig(pose);
      const h = rig.hand[hand];
      const p = M.add(h.o, M.scale(h.a, 9));
      this.particles.push({ kind: 'pow', x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, t: 0, life: 0.26, r: 34, rot: Math.random() * 6 });
      for (let i = 0; i < 6; i++) {
        const a = hero.yaw + (Math.random() - 0.5) * 1.6;
        this.particles.push({ kind: 'risco', x: p.x, y: p.y, z: p.z + (Math.random() - 0.5) * 20, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, vz: (Math.random() - 0.5) * 120, t: 0, life: 0.16 + Math.random() * 0.08, r: 3 });
      }
      this.shake = 0.12;
    }

    // ---------------------------------------------------------------- desenho
    /**
     * Desenha tudo. `actors`: [{ fp, bounds, draw(ctx), drawShadow(ctx) }] (o personagem).
     * O ctx já está em px de tela do mundo (com a câmera aplicada).
     */
    draw(ctx, actors) {
      const t = this.time;
      const T = this.timing || (this.timing = { chao: 0, sombra: 0, objetos: 0, personagem: 0, cima: 0 });
      const now = () => performance.now();
      let t0 = now();
      const mark = (k) => {
        if (this.forceFlush) ctx.getImageData(0, 0, 1, 1); // só nos testes: termina o desenho para medir certo
        const t1 = now();
        T[k] = T[k] * 0.95 + (t1 - t0) * 0.05;
        t0 = t1;
      };
      this.ground.draw(ctx);
      mark('chao');
      this._drawAwakening(ctx);
      for (const a of actors) a.drawShadow(ctx);
      // poeira no chão (antes do que está em pé)
      for (const p of this.particles) if (p.kind === 'poeira') this._drawParticle(ctx, p);
      this._drawSparks(ctx);
      mark('sombra');

      const order = this._staticOrder().slice();
      // encaixa cada personagem na ordem: depois de tudo que está atrás dele
      for (const a of actors) {
        let idx = 0;
        for (let i = 0; i < order.length; i++) {
          const o = order[i];
          if (o.actor) continue;
          if (!overlap(o.bounds, a.bounds)) continue;
          if (behind(o, a)) idx = i + 1;
        }
        order.splice(idx, 0, { actor: a, fp: a.fp });
        const bb = a.body || a.bounds;
        this._window = { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2, r: Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) * 0.62 };
        // quem vem depois e cobre o personagem fica transparente (testa o corpo, não a caixa folgada)
        const body = a.body || a.bounds;
        for (let i = idx + 1; i < order.length; i++) {
          const o = order[i];
          if (o.actor || !o.fades) continue;
          let hide = overlap(o.bounds, body);
          if (hide && o.overhead && o.cover) hide = o.cover(body);
          o.hideTarget = hide ? (o.overhead ? 0.42 : 0.5) : 1;
        }
      }
      let actorMs = 0;
      for (const o of order) {
        if (o.actor) {
          if (this.forceFlush) ctx.getImageData(0, 0, 1, 1);
          const a0 = now();
          o.actor.draw(ctx);
          if (this.forceFlush) ctx.getImageData(0, 0, 1, 1);
          actorMs += now() - a0;
          continue;
        }
        const target = o.hideTarget ?? 1;
        o.fade = M.damp(o.fade ?? 0, target < 1 ? 1 : 0, 10, this._dt || 1 / 60);
        o.hideTarget = 1;
        if (o.fade < 0.02 || !this._window) {
          o.alpha = 1;
          o.draw(ctx, t);
          continue;
        }
        // janela: fora do círculo em volta do personagem, inteiro; dentro, bem transparente (borda em 2 degraus)
        const W = this._window;
        const big = new Path2D();
        big.rect(-1e6, -1e6, 2e6, 2e6);
        big.moveTo(W.x + W.r, W.y);
        big.arc(W.x, W.y, W.r, 0, M.TAU);
        ctx.save();
        ctx.clip(big, 'evenodd');
        o.alpha = 1;
        o.draw(ctx, t);
        ctx.restore();
        const ring = new Path2D();
        ring.moveTo(W.x + W.r, W.y);
        ring.arc(W.x, W.y, W.r, 0, M.TAU);
        ring.moveTo(W.x + W.r * 0.8, W.y);
        ring.arc(W.x, W.y, W.r * 0.8, 0, M.TAU);
        ctx.save();
        ctx.clip(ring, 'evenodd');
        o.alpha = 1 - o.fade * 0.45;
        o.draw(ctx, t);
        ctx.restore();
        const inner = new Path2D();
        inner.arc(W.x, W.y, W.r * 0.8, 0, M.TAU);
        ctx.save();
        ctx.clip(inner);
        o.alpha = 1 - o.fade * 0.78;
        o.draw(ctx, t);
        ctx.restore();
        o.alpha = 1;
      }
      mark('objetos');
      T.objetos -= actorMs * 0.05;
      T.personagem = T.personagem * 0.95 + actorMs * 0.05;
      this._drawWires(ctx);
      // por cima de tudo: soco, riscos, faíscas e pétalas
      for (const p of this.particles) if (p.kind !== 'poeira') this._drawParticle(ctx, p);
      this._drawPetals(ctx);
      mark('cima');
    }

    _drawAwakening(ctx) {
      const cam = this.cam;
      const aw = this.map.awakening;
      const t = this.time;
      const z = this.map.curb;
      ctx.save();
      ctx.translate(0, -z * cam.cosP * cam.zoom);
      ctx.transform(...cam.groundMatrix());
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
      const g = ctx.createRadialGradient(aw.x, aw.y, aw.r * 0.2, aw.x, aw.y, aw.r * 1.05);
      g.addColorStop(0, `rgba(255, 236, 150, ${0.22 + pulse * 0.1})`);
      g.addColorStop(0.7, `rgba(120, 230, 200, ${0.16 + pulse * 0.08})`);
      g.addColorStop(1, 'rgba(120, 230, 200, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(aw.x, aw.y, aw.r * 1.05, 0, M.TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(150, 255, 220, ${0.45 + pulse * 0.35})`;
      ctx.lineWidth = 7;
      ctx.setLineDash([26, 18]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath();
      ctx.arc(aw.x, aw.y, aw.r * 0.82, 0, M.TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    _drawWires(ctx) {
      const cam = this.cam;
      ctx.strokeStyle = 'rgba(22, 18, 22, 0.9)';
      ctx.lineCap = 'round';
      for (const [a, b] of this.map.wires) {
        const A = this.poles[a].wireAnchors();
        const B = this.poles[b].wireAnchors();
        for (let k = 0; k < 3; k++) {
          const p0 = A[k];
          const p1 = B[2 - k] || B[k];
          const sag = 70 + k * 18;
          const pts = [];
          for (let s = 0; s <= 12; s++) {
            const u = s / 12;
            const p = M.lerp3(p0, p1, u);
            p.z -= Math.sin(u * Math.PI) * sag;
            pts.push(cam.p(p));
          }
          ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
          ctx.beginPath();
          pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
          ctx.stroke();
        }
      }
      // o "gato": emaranhado de fios num poste (típico da cidade)
      const p = this.poles[1].p;
      const z0 = this.poles[1].z0 + 640;
      ctx.lineWidth = Math.max(1, 1.4 * cam.zoom);
      const r = M.rng(3);
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        for (let s = 0; s <= 16; s++) {
          const a = s * 0.9 + k;
          const q = cam.p({ x: p.x + Math.cos(a) * (26 + r() * 12), y: p.y + Math.sin(a) * (26 + r() * 12), z: z0 + Math.sin(a * 1.7) * 18 });
          if (s) ctx.lineTo(q.x, q.y);
          else ctx.moveTo(q.x, q.y);
        }
        ctx.stroke();
      }
    }

    _drawParticle(ctx, p) {
      const cam = this.cam;
      const q = cam.p(p);
      const k = p.t / p.life;
      if (p.kind === 'poeira') {
        // nuvenzinha de poeira: três bolinhas claras, sem contorno, que crescem e somem
        const r = p.r * (0.5 + k * 1.3) * cam.zoom;
        ctx.globalAlpha = (1 - k) * (1 - k) * 0.55;
        ctx.fillStyle = '#e9dfcb';
        for (let j = 0; j < 3; j++) {
          const a = j * 2.1 + p.vx * 0.01;
          ctx.beginPath();
          ctx.arc(q.x + Math.cos(a) * r * 0.45, q.y + Math.sin(a) * r * 0.25, r * (0.75 - j * 0.12), 0, M.TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (p.kind === 'pow') {
        // estrela de HQ no ponto do soco
        const s = (0.5 + M.easeOutBack(Math.min(1, k * 2.5)) * 0.7) * p.r * cam.zoom;
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        const star = (rad, inner) => {
          ctx.beginPath();
          for (let i = 0; i < 20; i++) {
            const a = p.rot + (i / 20) * M.TAU;
            const r = i % 2 ? rad * inner : rad;
            const x = q.x + Math.cos(a) * r;
            const y = q.y + Math.sin(a) * r;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.closePath();
        };
        star(s * 1.12, 0.5);
        ctx.fillStyle = '#1b100d';
        ctx.fill();
        star(s, 0.5);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
        star(s * 0.6, 0.55);
        ctx.fillStyle = '#fff7d6';
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'risco') {
        const back = cam.p({ x: p.x - p.vx * 0.04, y: p.y - p.vy * 0.04, z: p.z - p.vz * 0.04 });
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#fff3c4';
        ctx.lineWidth = Math.max(1.5, 2.2 * cam.zoom);
        ctx.beginPath();
        ctx.moveTo(back.x, back.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    _drawSparks(ctx) {
      const cam = this.cam;
      for (const s of this.sparks) {
        const k = s.t / s.life;
        const q = cam.p(s);
        const a = Math.sin(k * Math.PI);
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = s.hue < 0.5 ? '#fff2a8' : '#9cffe0';
        const r = (2 + a * 2.5) * cam.zoom;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y - r * 2);
        ctx.lineTo(q.x + r * 0.6, q.y);
        ctx.lineTo(q.x, q.y + r * 2);
        ctx.lineTo(q.x - r * 0.6, q.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    _drawPetals(ctx) {
      const cam = this.cam;
      for (const p of this.petals) {
        const q = cam.p(p);
        ctx.fillStyle = '#f6c51f';
        ctx.strokeStyle = '#1b100d';
        ctx.lineWidth = Math.max(0.6, 0.6 * cam.zoom);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, 5 * cam.zoom, 2.6 * cam.zoom * Math.abs(Math.cos(p.spin)) + 0.8, p.spin * 0.5, 0, M.TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  PD.World = World;
  PD.isoBehind = behind;
})(window.PD = window.PD || {});
