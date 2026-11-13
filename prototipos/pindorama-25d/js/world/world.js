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
    /** `map`: o mapa já pronto (PD.MAP, a esquina de São Paulo, ou um mapa do mundo novo lido por PD.tmj.toMap). */
    constructor(cam, map) {
      this.cam = cam;
      this.map = map || PD.MAP;
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
      for (const b of m.buildings || []) add(new P.Building(this, b));
      for (const h of m.houses || []) add(new P.House(this, h));
      for (const w of m.walls || []) add(new P.Wall(this, w));
      for (const t of m.trees || []) {
        add(new P.TreeTrunk(this, t));
        add(new P.TreeCanopy(this, t));
      }
      this.poles = (m.poles || []).map((p) => add(new P.Pole(this, p)));
      if (m.trafficLight) add(new P.TrafficLight(this, m.trafficLight));
      for (const d of m.props || []) add(new P.Small(this, d));
      for (const f of m.fences || []) for (const part of P.Fence.split(f)) add(new P.Fence(this, part));
      for (const b of m.pillars || []) add(new P.Pillar(this, b));
      // no mundo novo, a colisão é a do próprio mapa (as mesmas caixas que o servidor usa)
      this.colliders = m.colliders && m.colliders.length ? m.colliders : this.props.filter((p) => p.collider).map((p) => p.collider);
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

    update(dt, hero, others = []) {
      this.time += dt;
      const t = this.time;
      // eventos do personagem: poeira e soco
      for (const character of [hero, ...others]) {
        for (const ev of character.events) {
          if (ev.type === 'poeira') this._dust(ev.x, ev.y, character.groundZ || 0, ev.strength);
          if (ev.type === 'impacto') this._impact(character, ev.hand, ev);
        }
        character.events.length = 0;
      }
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
      for (const tr of this.map.trees || []) {
        if (tr.kind !== 'ipe' && tr.kind !== 'ipe-amarelo' && tr.kind !== 'ipe-roxo') continue;
        if (this.map.kind === 'tmj' && Math.random() > 0.15) continue; // muitas árvores: poucas soltam pétala
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
      if (aw && Math.random() < dt * 9 && this.sparks.length < 60) {
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

    _impact(hero, hand, event = {}) {
      const pose = hero.pose();
      const rig = PD.rig.buildRig(pose);
      const h = rig.hand[hand];
      const p = event.contact || M.add(h.o, M.scale(h.a, 8));
      // soco para longe da câmera (de costas): o punho fica atrás do corpo na tela, então o efeito é desenhado antes do
      // personagem e o corpo passa na frente dele (antes a estrela, por cima de tudo, cobria o corpo inteiro)
      const behind = M.dot(M.sub(p, rig.chest.o), this.cam.toCamera) < -3;
      // estrela pequena (uns 30 cm) e um anel que abre e some; poucos riscos, curtos
      const hit = !event.combatResult || event.combatResult === 'hit';
      if (hit) this.particles.push({ kind: 'pow', x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, t: 0, life: 0.22, r: 15, rot: Math.random() * 6, behind, owner: hero });
      for (let i = 0; i < 4; i++) {
        const a = hero.yaw + (Math.random() - 0.5) * 1.3;
        this.particles.push({ kind: 'risco', x: p.x, y: p.y, z: p.z + (Math.random() - 0.5) * 12, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, vz: (Math.random() - 0.5) * 80, t: 0, life: 0.12 + Math.random() * 0.06, r: 2, behind, owner: hero });
      }
      if (hit) this.shake = 0.08;
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
      for (const o of order) { o.hideTarget = 1; o.hideWindow = null; o.hideWindows = null; }
      // encaixa cada personagem na ordem: depois de tudo que está atrás dele
      for (const a of actors) {
        let idx = 0;
        let beforeActor = order.length;
        for (let i = 0; i < order.length; i++) {
          const o = order[i];
          if (o.actor) {
            // Um corpo rente ao chão fica sob quem está de pé na mesma região da imagem.
            const sameImage = overlap(o.actor.bounds, a.bounds);
            const below = sameImage && !!o.actor.groundedCorpse !== !!a.groundedCorpse
              ? !!o.actor.groundedCorpse : behind(o, a);
            if (below) idx = i + 1;
            else if (sameImage) beforeActor = Math.min(beforeActor, i);
            continue;
          }
          if (!overlap(o.bounds, a.bounds)) continue;
          if (behind(o, a)) idx = i + 1;
        }
        idx = Math.min(idx, beforeActor);
        order.splice(idx, 0, { actor: a, fp: a.fp });
        const bb = a.body || a.bounds;
        const window = { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2, r: Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) * 0.62 };
        if (a.primary || a === actors[0]) this._window = window;
        // quem vem depois e cobre o personagem fica transparente (testa o corpo, não a caixa folgada)
        const body = a.body || a.bounds;
        for (let i = idx + 1; i < order.length; i++) {
          const o = order[i];
          if (o.actor || !o.fades) continue;
          let hide = overlap(o.bounds, body);
          if (hide && o.overhead && o.cover) hide = o.cover(body);
          if (hide) {
            o.hideTarget = Math.min(o.hideTarget, o.overhead ? 0.42 : 0.5);
            if (!o.hideWindow || a.primary) o.hideWindow = o._lastHideWindow = window;
            // uma janela para cada um que esta copa (ou casa) cobre: o herói e também o monstro do lado dele
            // (até 6 por objeto, com o herói sempre entre elas: cada janela desenha o objeto mais duas vezes)
            const list = o.hideWindows || (o.hideWindows = []);
            if (a.primary) list.unshift(window);
            else if (list.length < 6) list.push(window);
          }
        }
      }
      let actorMs = 0;
      for (const o of order) {
        if (o.actor) {
          // efeitos que ficam atrás do personagem (soco para longe da câmera)
          for (const p of this.particles) if (p.behind && p.kind !== 'poeira' && (!o.actor.entity || !p.owner || p.owner === o.actor.entity)) this._drawParticle(ctx, p);
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
        // janelas: fora dos círculos em volta de quem está coberto, inteiro; dentro, bem transparente (borda em 2
        // degraus). Uma janela por personagem coberto (antes só a do herói: o sagui embaixo da mesma copa sumia)
        const Ws = o.hideWindows && o.hideWindows.length ? o.hideWindows : [o.hideWindow || o._lastHideWindow || this._window];
        const outside = (W) => {
          const p = new Path2D();
          p.rect(-1e6, -1e6, 2e6, 2e6);
          p.moveTo(W.x + W.r, W.y);
          p.arc(W.x, W.y, W.r, 0, M.TAU);
          return p;
        };
        ctx.save();
        for (const W of Ws) ctx.clip(outside(W), 'evenodd');
        o.alpha = 1;
        o.draw(ctx, t);
        ctx.restore();
        Ws.forEach((W, k) => {
          for (const [rOut, rIn, a] of [[W.r, W.r * 0.8, 0.45], [W.r * 0.8, 0, 0.78]]) {
            ctx.save();
            // onde uma janela já desenhou, a próxima não desenha de novo (senão a transparência somava)
            for (let j = 0; j < k; j++) ctx.clip(outside(Ws[j]), 'evenodd');
            const ring = new Path2D();
            ring.moveTo(W.x + rOut, W.y);
            ring.arc(W.x, W.y, rOut, 0, M.TAU);
            if (rIn) {
              ring.moveTo(W.x + rIn, W.y);
              ring.arc(W.x, W.y, rIn, 0, M.TAU);
            }
            ctx.clip(ring, 'evenodd');
            o.alpha = 1 - o.fade * a;
            o.draw(ctx, t);
            ctx.restore();
          }
        });
        o.alpha = 1;
      }
      mark('objetos');
      T.objetos -= actorMs * 0.05;
      T.personagem = T.personagem * 0.95 + actorMs * 0.05;
      this._drawWires(ctx);
      // por cima de tudo: soco (o que não ficou atrás do personagem), riscos, faíscas e pétalas
      for (const p of this.particles) if (p.kind !== 'poeira' && !p.behind) this._drawParticle(ctx, p);
      this._drawPetals(ctx);
      mark('cima');
    }

    _drawAwakening(ctx) {
      const cam = this.cam;
      const aw = this.map.awakening;
      if (!aw) return;
      const t = this.time;
      const z = this.map.curb || 0;
      ctx.save();
      ctx.translate(0, -z * cam.cosP * cam.zoom);
      ctx.transform(...cam.groundMatrix());
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
      const g = ctx.createRadialGradient(aw.x, aw.y, aw.r * 0.2, aw.x, aw.y, aw.r * 1.05);
      if (aw.color) {
        // mundo novo: brilho espiritual verde-água (o entalhe da estrela acende junto)
        const [r, gg, b] = [1, 3, 5].map((i) => parseInt(aw.color.slice(i, i + 2), 16));
        g.addColorStop(0, `rgba(${r}, ${gg}, ${b}, ${0.2 + pulse * 0.1})`);
        g.addColorStop(0.75, `rgba(${r}, ${gg}, ${b}, ${0.12 + pulse * 0.06})`);
        g.addColorStop(1, `rgba(${r}, ${gg}, ${b}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(aw.x, aw.y, aw.r * 1.05, 0, M.TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${r}, ${gg}, ${b}, ${0.35 + pulse * 0.4})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (let k = 0; k <= 16; k++) {
          const a = (k / 16) * M.TAU;
          const rr = (k % 2 ? 0.2 : 0.42) * aw.r;
          k ? ctx.lineTo(aw.x + Math.cos(a) * rr, aw.y + Math.sin(a) * rr) : ctx.moveTo(aw.x + Math.cos(a) * rr, aw.y + Math.sin(a) * rr);
        }
        ctx.stroke();
        ctx.strokeStyle = `rgba(${r}, ${gg}, ${b}, ${0.3 + pulse * 0.3})`;
        ctx.lineWidth = 6;
        ctx.setLineDash([26, 18]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.arc(aw.x, aw.y, aw.r * 0.64, 0, M.TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        this._drawVeils(ctx);
        return;
      }
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

    /** Pontos do Véu Ancestral: um brilho verde-água que respira no chão (a figueira, o círculo...). */
    _drawVeils(ctx) {
      const veils = this.map.veils || [];
      if (!veils.length) return;
      const cam = this.cam;
      const t = this.time;
      ctx.save();
      ctx.transform(...cam.groundMatrix());
      ctx.globalCompositeOperation = 'lighter';
      veils.forEach((v, i) => {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 1.9);
        const g = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, v.r);
        g.addColorStop(0, `rgba(63, 214, 200, ${0.16 + pulse * 0.1})`);
        g.addColorStop(1, 'rgba(63, 214, 200, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.r, 0, M.TAU);
        ctx.fill();
      });
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
      // o "gato": emaranhado de fios num poste (típico da cidade); mapas sem postes de fiação não têm
      if (!this.poles[1]) return;
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
        // estrela de HQ pequena no ponto do soco, com um anel que abre e some
        const s = (0.55 + M.easeOutBack(Math.min(1, k * 2.8)) * 0.6) * p.r * cam.zoom;
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.strokeStyle = '#fff7d6';
        ctx.lineWidth = Math.max(1.2, 1.8 * cam.zoom * (1 - k));
        ctx.beginPath();
        ctx.arc(q.x, q.y, p.r * cam.zoom * (0.7 + k * 1.4), 0, M.TAU);
        ctx.stroke();
        ctx.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
        const star = (rad, inner) => {
          ctx.beginPath();
          for (let i = 0; i < 16; i++) {
            const a = p.rot + (i / 16) * M.TAU;
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
