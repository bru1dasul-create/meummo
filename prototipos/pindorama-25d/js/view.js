// PD.View: o desenho 2.5D do jogo de verdade (Etapa 3 do Mapa 01). A [arte] desenha; o motor da [estrutura]
// (src/client/novo/engine.ts, página /?novo) conecta ao servidor, lê os controles e chama esta peça pela interface
// `WorldView` (src/client/novo/view.ts):
//   new PD.View(container, tmj)        container = a caixa da página (ou um <canvas> pronto); tmj = o JSON do mapa
//   addActor(id, { kind, type, name, look, x, y, angle, me })  kind: 'player' | 'npc' | 'monster'
//   moveActor(id, x, y, angle, { durationMs, dash })           a posição nova do pé, a cada ~50–120 ms
//   removeActor(id) · say(id, texto) · follow(id) · frame(agora) · destroy()
//   toWorld(xTela, yTela) → { x, y } · toScreen(x, y, z) → { x, y } · groundDirOfScreen(dx, dy) → { x, y }
//   actorPosition(id) → { x, y } (onde o pé está desenhado agora; o combate põe a barra de vida ali)
//   action(id, tipo, angulo)  golpes e reações; por enquanto só nas criaturas (js/creatures: o sagui)
// Posições em METROS, no pé, x para o leste e y para o sul (como o servidor e o Tiled; por dentro, centímetros).
// `angle` é para onde olha, em graus no chão (0 = leste/+x, 90 = sul/+y), como o pedido `walk` do servidor.
// A view não decide nada do jogo: anima o andar até a posição que recebe (perna pela distância, sem escorregar) e
// escolhe parado, andando ou correndo pela velocidade de verdade. Desenha também o nome em cima de cada um (o seu em
// dourado, NPC em verde-água, como no jogo de hoje) e os balões de fala.
(function (PD) {
  'use strict';
  const M = PD.math;

  // câmera: "médio" (padrão) = 1, "longe" = 0,7 (mínimo). Aproximar além do médio e o celular em pé ainda vão
  // ser combinados com o dono: por enquanto, até "perto" (1,4) e uns 9 m de largura com o celular em pé
  const ZOOM = { min: 0.7, max: 1.4, portraitMeters: 9 };

  // cor do nome em cima da cabeça (as mesmas do jogo de hoje, src/client/style.css)
  const NAME_COLOR = { me: '#ffe08a', player: '#ffffff', npc: '#8fe3c8', monster: '#f1e4c8' };
  const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const rad = (deg) => (deg * Math.PI) / 180;

  class View {
    constructor(container, tmj, opts = {}) {
      let canvas = container;
      if (!(typeof HTMLCanvasElement !== 'undefined' && container instanceof HTMLCanvasElement)) {
        // o motor dá a caixa da página: a tela é nossa (e sai no destroy)
        canvas = document.createElement('canvas');
        canvas.className = 'mundo-novo';
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none;';
        container.append(canvas);
        this._ownCanvas = true;
      }
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
      PD.view = this; // a view em uso, para os testes automáticos (só leitura)
    }

    /** Ponto de nascimento do mapa (metros). */
    get spawn() {
      return { x: this.map.spawn.x / 100, y: this.map.spawn.y / 100 };
    }

    // ------------------------------------------------------------ personagens
    addActor(id, a) {
      if (this.actors.has(id)) this.removeActor(id);
      const yaw = Number.isFinite(a.angle) ? rad(a.angle) : Math.PI / 4;
      // monstro ou NPC com corpo próprio (sagui, jararaca, a Xiovanna da Budega...): a criatura no lugar do corpo de gente
      const own = (a.kind === 'monster' || a.kind === 'npc') && PD.creatures && PD.creatures.has(a.type);
      const creature = own ? PD.creatures.create(a.type, a.x * 100, a.y * 100, yaw) : null;
      if (creature) {
        const actor = { id, kind: a.kind, type: a.type, name: a.name || '', me: false, creature, ch: creature, rig: null, speech: '', speechUntil: 0 };
        this.actors.set(id, actor);
        if (this.followId === null && a.me) this.follow(id);
        return actor;
      }
      const ch = new PD.Character(a.x * 100, a.y * 100, yaw);
      ch.faceYaw = yaw;
      const actor = {
        id,
        kind: a.kind || 'player',
        type: a.type || '',
        name: a.name || '',
        me: !!a.me,
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
      actor.speech = '';
      actor.speechUntil = 0;
      this.actors.set(id, actor);
      if (a.me || this.followId === null) this.follow(id);
      return actor;
    }

    /** Nova posição do pé (metros) e para onde olha (graus). `durationMs` não é usado: anda pela velocidade. */
    moveActor(id, x, y, angle, opts = {}) {
      const a = this.actors.get(id);
      if (!a) return;
      if (a.creature) {
        a.creature.moveTo(x * 100, y * 100, Number.isFinite(angle) ? rad(angle) : undefined, opts && opts.durationMs, !!(opts && opts.dash));
        return;
      }
      a.target = { x: x * 100, y: y * 100 };
      if (Number.isFinite(angle)) a.angle = rad(angle);
      a.dash = !!(opts && opts.dash);
    }

    removeActor(id) {
      this.actors.delete(id);
      if (this.followId === id) this.followId = null;
    }

    /** Golpe ou reação (veja WorldView.action): as criaturas animam; o corpo de gente ainda não. */
    action(id, kind, angle) {
      const a = this.actors.get(id);
      if (a && a.creature) a.creature.action(kind, Number.isFinite(angle) ? rad(angle) : undefined);
    }

    /** Fala curta em cima do personagem. */
    say(id, text) {
      const a = this.actors.get(id);
      if (!a) return;
      a.speech = String(text || '');
      a.speechUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 2500 + a.speech.length * 60;
      if (a.creature) a.creature.talk(2500 + a.speech.length * 60);
    }

    /** Uma direção na tela (ex.: "para cima") vira qual direção no chão, nesta câmera. */
    groundDirOfScreen(dx, dy) {
      const cam = this.cam;
      const K = PD.ISO_K;
      const u = dx / K;
      const v = dy / (K * cam.sinP);
      const x = (u + v) / 2;
      const y = (v - u) / 2;
      const l = Math.hypot(x, y) || 1;
      return { x: x / l, y: y / l };
    }

    destroy() {
      if (PD.view === this) PD.view = null;
      if (this._ro) this._ro.disconnect();
      this.actors.clear();
      if (this._ownCanvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    }

    follow(id) {
      this.followId = id;
      this.camTarget = null;
    }

    /** Leva o personagem até a posição que chegou: anda (ou corre) até lá; longe demais, aparece lá. */
    _drive(a, dt) {
      if (a.creature) {
        // a criatura enxerga o personagem que a câmera segue (NPC olha para ele e acena)
        const me = this.actors.get(this.followId);
        a.creature.update(dt, me && !me.creature ? { hero: { x: me.ch.pos.x, y: me.ch.pos.y } } : null);
        return;
      }
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
      // velocidade para alcançar o alvo em ~0,12 s (o servidor manda posição a cada 50 ms). O jogo corre a 4,5 m/s
      // (um pouco mais que a corrida do protótipo) e, atrasado numa virada (ele gira plantando os pés, o servidor
      // inverte na hora), precisa recuperar: até 35% mais rápido, sem escorregar o pé. O passo (andar ou correr) sai
      // da velocidade de verdade: a 2 m/s (Shift) ele anda.
      const want = Math.min(d / 0.12, S.run * 1.35);
      // virada ágil (escolha do dono): o servidor muda de direção na hora, o desenho vira mais depressa que no protótipo
      const agile = this.agile !== false;
      let input = { agile };
      if (d > 3) {
        const run = want > S.walk * 1.05;
        const top = run ? S.run : S.walk;
        const mag = Math.min(1, want / top);
        input = { move: { x: (dx / d) * mag, y: (dy / d) * mag }, run, speedScale: Math.max(1, want / top), agile };
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
      // quem a câmera segue é sempre gente (a PD.World lê o passo e o pulo dele)
      let hero = this.actors.get(this.followId);
      if (!hero || hero.creature) hero = [...this.actors.values()].find((a) => !a.creature);
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
      this._drawNames(ctx);
      this._drawSpeech(ctx);
    }

    /** Ponto da tela logo acima da cabeça (penas incluídas): onde ficam o nome e o balão. Segue o agachar e o pulo. */
    _overHead(a) {
      if (a.creature) {
        const h = a.creature.overHead();
        return this.cam.p({ x: h.x, y: h.y, z: h.z + 10 });
      }
      const h = a.rig && a.rig.head ? a.rig.head.o : { x: a.ch.pos.x, y: a.ch.pos.y, z: 172 };
      return this.cam.p({ x: h.x, y: h.y, z: h.z + 46 });
    }

    /** Nomes em cima da cabeça (por cima de tudo, como as etiquetas do jogo de hoje). */
    _drawNames(ctx) {
      this._nameRects = [];
      ctx.save();
      ctx.font = '700 13px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(8, 12, 10, 0.85)';
      for (const a of this.actors.values()) {
        if (!a.name || (a.creature && a.creature.dying !== null)) continue; // caído: o nome sai junto
        const q = this._overHead(a);
        ctx.strokeText(a.name, q.x, q.y);
        ctx.fillStyle = a.me ? NAME_COLOR.me : NAME_COLOR[a.kind] || NAME_COLOR.player;
        ctx.fillText(a.name, q.x, q.y);
        const half = ctx.measureText(a.name).width / 2 + 3;
        this._nameRects.push({ id: a.id, x0: q.x - half, x1: q.x + half, y0: q.y - 15, y1: q.y + 4 });
      }
      ctx.restore();
    }

    /**
     * Balões de fala (por cima de tudo). O bico aponta para quem fala, logo acima do nome; perto da beirada, o balão
     * chega para dentro da tela. Um balão não cobre o nome de ninguém nem outro balão: quem está mais à frente fica
     * com o balão no lugar, o dos outros sobe (e o bico estica).
     */
    _drawSpeech(ctx) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const talking = [...this.actors.values()].filter((a) => a.speech && now <= a.speechUntil);
      if (!talking.length) return;
      ctx.save();
      ctx.font = '600 14px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cam = this.cam;
      const left = cam.viewX + 8, right = cam.viewX + cam.viewW - 8, top = cam.viewY + 8;
      const taken = (this._nameRects || []).slice();
      const items = talking.map((a) => ({ a, q: this._overHead(a) })).sort((p, r) => r.q.y - p.q.y);
      const placed = [];
      for (const { a, q } of items) {
        const tip = q.y - (a.name ? 17 : 2);
        const lines = wrap(ctx, a.speech, 220, 6);
        const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20;
        const h = lines.length * 18 + 12;
        let x = Math.max(left, Math.min(right - w, q.x - w / 2));
        const y0 = tip - 9 - h;
        const hits = (bx, by) => taken.find((r) => r.id !== a.id && bx < r.x1 && bx + w > r.x0 && by < r.y1 && by + h > r.y0);
        let y = y0;
        for (let i = 0; i < 8; i++) {
          const hit = hits(x, y);
          if (!hit) break;
          y = hit.y0 - h - 6;
        }
        if (y < top) {
          // não cabe empilhado (tela baixa, celular deitado): tenta ao lado do que atrapalha, na altura de sempre
          const hit = hits(x, Math.max(top, y0));
          const yy = Math.max(top, y0);
          const sides = hit ? [hit.x1 + 6, hit.x0 - 6 - w].filter((bx) => bx >= left && bx + w <= right && !hits(bx, yy)) : [];
          if (sides.length) {
            x = sides.reduce((b, c) => (Math.abs(c + w / 2 - q.x) < Math.abs(b + w / 2 - q.x) ? c : b));
            y = yy;
          } else y = Math.max(top, y);
        }
        taken.push({ id: a.id, x0: x - 3, y0: y - 3, x1: x + w + 3, y1: y + h + 3 });
        placed.push({ q, tip, lines, x, y, w, h });
      }
      // os que subiram (de trás) primeiro: o bico comprido passa por baixo do balão da frente, não por cima do texto
      for (let i = placed.length - 1; i >= 0; i--) {
        const { q, tip, lines, x, y, w, h } = placed[i];
        const tx = Math.max(x + 14, Math.min(x + w - 14, q.x));
        ctx.fillStyle = 'rgba(250, 244, 228, 0.96)';
        ctx.strokeStyle = '#1b100d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 9);
        ctx.moveTo(tx - 7, y + h);
        ctx.lineTo(q.x, Math.max(y + h + 9, tip));
        ctx.lineTo(tx + 7, y + h);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#2a1d16';
        lines.forEach((l, k) => ctx.fillText(l, x + w / 2, y + 6 + 9 + k * 18));
      }
      ctx.restore();
    }

    _actorDrawable(a) {
      if (a.creature) return a.creature.drawable(this.cam, a.id === this.followId);
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

    /** Onde o pé de alguém está DESENHADO agora (metros): o motor põe a barra de vida e o dano em cima do desenho. */
    actorPosition(id) {
      const a = this.actors.get(id);
      return a ? { x: a.ch.pos.x / 100, y: a.ch.pos.y / 100 } : null;
    }

    /** Para o motor saber o que está acontecendo (testes): posição de cada personagem em metros. */
    debug() {
      return [...this.actors.values()].map((a) => ({ id: a.id, x: a.ch.pos.x / 100, y: a.ch.pos.y / 100, speed: a.ch.speed / 100, label: a.ch.label }));
    }
  }

  /** Quebra o texto em linhas de até `max` px; passou de `maxLines`, a última termina em "…". */
  function wrap(ctx, text, max, maxLines = 4) {
    const words = text.split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > max && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) lines.push(cur);
    if (lines.length <= maxLines) return lines;
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > max) last = last.slice(0, -1);
    cut[maxLines - 1] = last.replace(/[\s,.;:]+$/, '') + '…';
    return cut;
  }

  PD.View = View;
  PD.VIEW_ZOOM = ZOOM;
})(window.PD = window.PD || {});
