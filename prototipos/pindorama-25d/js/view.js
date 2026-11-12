// PD.View: o desenho 2.5D do jogo de verdade (Etapa 3 do Mapa 01). A [arte] desenha; o motor da [estrutura]
// (src/client/novo/) conecta ao servidor, lê os controles e chama esta peça. Interface combinada em 12/11:
//   const view = new PD.View(canvas, tmj)      tmj = o JSON do mapa (public/assets/maps-iso/capao.tmj)
//   view.addActor(id, { kind, type, name, look, x, y, angle })    kind: 'player' | 'npc' | 'monster'
//   view.moveActor(id, x, y, angle, { dash })   a posição nova (do servidor ou a prevista), a cada ~50 ms
//   view.removeActor(id) · view.follow(id) · view.frame(agora)   (o laço é do motor)
//   view.toWorld(xTela, yTela) → { x, y }   ·   view.toScreen(x, y, z) → { x, y }   (px da tela, para HTML)
//   view.setZoom(f): 1 = "médio" (o padrão do dono), 0,7 = "longe" (o mínimo)
// Posições em METROS, no pé do personagem; ângulos em GRAUS, como o pedido `walk` do servidor (0 = +x/leste,
// 90 = +y/sul). A view não decide nada do jogo: ela anima o andar até a posição que recebe (perna pela distância,
// sem escorregar) e escolhe parado, andando ou correndo pela velocidade de verdade.
(function (PD) {
  'use strict';
  const M = PD.math;

  // câmera: "médio" (padrão) = 1, "longe" = 0,7 (mínimo). Aproximar além do médio e o celular em pé ainda vão
  // ser combinados com o dono: por enquanto, até "perto" (1,4) e uns 9 m de largura com o celular em pé
  const ZOOM = { min: 0.7, max: 1.4, portraitMeters: 9 };

  class View {
    constructor(canvas, tmj, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.cam = new PD.IsoCamera();
      this.map = tmj && tmj.kind === 'tmj' ? tmj : PD.tmj.toMap(tmj);
      this.zoomUser = 1;
      this.actors = new Map();
      this.followId = null;
      this.camTarget = null;
      this.last = 0;
      this.background = opts.background || '#16241a';
      this._resize();
      this.world = new PD.World(this.cam, this.map);
      this.world._dpr = this.cam.dpr;
      if (typeof ResizeObserver !== 'undefined') {
        this._ro = new ResizeObserver(() => this._resize());
        this._ro.observe(canvas);
      }
    }

    /** Ponto de nascimento do mapa (metros). */
    get spawn() {
      return { x: this.map.spawn.x / 100, y: this.map.spawn.y / 100 };
    }

    // ------------------------------------------------------------ personagens
    addActor(id, a) {
      if (this.actors.has(id)) this.removeActor(id);
      const yaw = ((a.angle ?? 45) * Math.PI) / 180;
      const ch = new PD.Character(a.x * 100, a.y * 100, yaw);
      ch.faceYaw = yaw;
      const actor = {
        id,
        kind: a.kind || 'player',
        type: a.type || '',
        name: a.name || '',
        look: a.look || null,
        ch,
        renderer: new PD.CharacterRenderer(this.cam),
        rig: null,
        target: { x: a.x * 100, y: a.y * 100 },
        angle: yaw,
        // aparência: o protagonista; os outros saem com uma roupa diferente até cada um ganhar o seu desenho
        appearance: a.kind === 'player' ? null : { paleta: { ...PD.PALETTE, cloth: { base: '#7c2b22', shade: '#521a14', light: '#9b4334' } } },
      };
      actor.rig = PD.rig.buildRig(ch.pose());
      this.actors.set(id, actor);
      if (this.followId === null) this.follow(id);
      return actor;
    }

    moveActor(id, x, y, angle, opts = {}) {
      const a = this.actors.get(id);
      if (!a) return;
      a.target = { x: x * 100, y: y * 100 };
      if (angle !== undefined && angle !== null) a.angle = (angle * Math.PI) / 180;
      a.dash = !!(opts && opts.dash);
    }

    removeActor(id) {
      this.actors.delete(id);
      if (this.followId === id) this.followId = null;
    }

    follow(id) {
      this.followId = id;
      this.camTarget = null;
    }

    /** Leva o personagem até a posição que chegou: anda (ou corre) até lá; longe demais, aparece lá. */
    _drive(a, dt) {
      const ch = a.ch;
      const T = a.target;
      const dx = T.x - ch.pos.x;
      const dy = T.y - ch.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 300 || a.dash) {
        // teleporte ou esquiva: sem andar o caminho (a esquiva ganha animação própria com view.action)
        ch.pos.x = T.x;
        ch.pos.y = T.y;
        for (const st of ch.footLock) {
          st.planted = false;
          st.step = null;
        }
        a.dash = false;
      }
      const S = PD.SPEED || { walk: 160, run: 440 };
      // velocidade para alcançar o alvo em ~0,12 s (o servidor manda posição a cada 50 ms)
      const want = Math.min(d / 0.12, S.run * 1.15);
      let input = {};
      if (d > 3) {
        const run = want > S.walk * 1.05;
        const mag = Math.min(1, want / (run ? S.run : S.walk));
        input = { move: { x: (dx / d) * mag, y: (dy / d) * mag }, run };
      }
      ch.update(dt, input, null);
      // parado: vira para o ângulo que veio
      if (d <= 3 && a.angle !== undefined) ch.faceYaw = a.angle;
      a.rig = PD.rig.buildRig(ch.pose());
      ch.secondary(a.rig, dt);
    }

    // ------------------------------------------------------------ câmera e tela
    _baseZoom(w, h) {
      // celular em pé: mostra uns 9 m de largura (o "médio" de sempre mostraria só 5,5 m)
      if (h > w * 1.15) return M.clamp(w / (ZOOM.portraitMeters * 100), 0.3, 1.4);
      return M.clamp(Math.min(w * 1.45, h) / 790, 0.5, 1.4);
    }

    _resize() {
      const c = this.canvas;
      const rect = c.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width || c.clientWidth || window.innerWidth));
      const h = Math.max(1, Math.round(rect.height || c.clientHeight || window.innerHeight));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const cam = this.cam;
      cam.dpr = dpr;
      cam.viewW = w;
      cam.viewH = h;
      const z = this._baseZoom(w, h) * this.zoomUser;
      if (Math.abs(z - cam.zoom) > 1e-4 || (this.world && this.world._dpr !== dpr)) {
        cam.zoom = z;
        if (this.world) {
          this.world.invalidate();
          this.world._dpr = dpr;
        }
      }
    }

    /** Zoom do jogador: 1 = "médio", 0,7 = "longe". */
    setZoom(f) {
      this.zoomUser = M.clamp(f, ZOOM.min, ZOOM.max);
      this._resize();
      return this.zoomUser;
    }
    get zoom() {
      return this.zoomUser;
    }

    toWorld(sx, sy) {
      const cam = this.cam;
      const X = sx + cam.viewX;
      const Y = sy + cam.viewY;
      const K = PD.ISO_K;
      const a = X / (K * cam.zoom);
      const b = Y / (K * cam.sinP * cam.zoom);
      return { x: (a + b) / 2 / 100, y: (b - a) / 2 / 100 };
    }

    toScreen(x, y, z = 0) {
      const q = this.cam.p({ x: x * 100, y: y * 100, z: z * 100 });
      return { x: q.x - this.cam.viewX, y: q.y - this.cam.viewY };
    }

    // ------------------------------------------------------------ um quadro
    frame(now) {
      const t = now ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const dt = this.last ? Math.min(0.05, Math.max(0, (t - this.last) / 1000)) : 1 / 60;
      this.last = t;
      this._resize();
      for (const a of this.actors.values()) this._drive(a, dt);
      const hero = this.actors.get(this.followId) || this.actors.values().next().value;
      const others = [...this.actors.values()].filter((a) => a !== hero).map((a) => a.ch);
      if (hero) {
        this.world._dt = dt;
        this.world.update(dt, hero.ch, others);
        // câmera: segue com suavidade, olhando um pouco para onde ele vai
        const ch = hero.ch;
        const goal = { x: ch.pos.x + ch.vel.x * 0.22, y: ch.pos.y + ch.vel.y * 0.22, z: 0 };
        this.camTarget = this.camTarget ? M.damp3(this.camTarget, goal, 5.5, dt) : goal;
        this.cam.follow(this.camTarget);
      } else {
        this.world.time += dt;
        this.cam.follow({ x: this.map.spawn.x, y: this.map.spawn.y, z: 0 });
      }
      this._draw();
    }

    _draw() {
      const cam = this.cam;
      const ctx = this.ctx;
      const dpr = cam.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, cam.viewW, cam.viewH);
      ctx.setTransform(dpr, 0, 0, dpr, -cam.viewX * dpr, -cam.viewY * dpr);
      const actors = [...this.actors.values()].map((a) => this._actorDrawable(a));
      this.world.draw(ctx, actors);
    }

    _actorDrawable(a) {
      const ch = a.ch;
      const r = ch.radius || 30;
      const rig = a.rig;
      const painter = a.renderer;
      const cam = this.cam;
      return {
        entity: ch,
        primary: a.id === this.followId,
        fp: { x0: ch.pos.x - r, x1: ch.pos.x + r, y0: ch.pos.y - r, y1: ch.pos.y + r },
        bounds: painter.bounds(rig),
        body: painter.bounds(rig, 0.35),
        drawShadow: (c) => painter.drawShadow(c, rig, ch.groundZ),
        draw: (c) => painter.draw(c, rig, ch.look, ch.equipped, a.appearance || PD.classes.appearanceOf(ch)),
        cam,
      };
    }

    /** Para o motor saber o que está acontecendo (testes): posição de cada personagem em metros. */
    debug() {
      return [...this.actors.values()].map((a) => ({ id: a.id, x: a.ch.pos.x / 100, y: a.ch.pos.y / 100, speed: a.ch.speed / 100, label: a.ch.label }));
    }
  }

  PD.View = View;
  PD.VIEW_ZOOM = ZOOM;
})(window.PD = window.PD || {});
