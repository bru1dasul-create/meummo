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
//   gear(id, gear)            o que o jogador tem equipado (o ícone de cada parte): o arco (`weapon: 'arco'`) fica na mão
//   canDraw(kind, tipo)       desenha este bicho? (kind 'pet': o Joaquim, 'joaquim'; ações wake, sleep, meow, purr, dash)
//   focus(ponto | null)       conversa: a câmera vai até quem fala (metros, o pé), um pouco acima do meio da tela
//   talk(id, ms)              quem fala mexe a boca (e a sobrancelha) por `ms`, sem balão; 0 para
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
  const NAME_COLOR = { me: '#ffe08a', player: '#ffffff', npc: '#8fe3c8', pet: '#8fe3c8', monster: '#f1e4c8' };
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
      this.focusPoint = null;
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
      // monstro, NPC ou bicho com corpo próprio (sagui, jararaca, a Xiovanna da Budega, o Joaquim...): a criatura no lugar
      // do corpo de gente
      const own = (a.kind === 'monster' || a.kind === 'npc' || a.kind === 'pet') && PD.creatures && PD.creatures.has(a.type);
      const creature = own ? PD.creatures.create(a.type, a.x * 100, a.y * 100, yaw) : null;
      if (creature) {
        // o bicho que já aparece dormindo (o Joaquim no sofá)
        if (a.asleep && creature.setAsleep) creature.setAsleep(true);
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

    /**
     * A view sabe desenhar este tipo? (o motor pergunta para os bichos, kind 'pet': sem desenho, ele desenha um
     * provisório por cima). Hoje: o Joaquim, o gato da vó (js/creatures/gato.js).
     */
    canDraw(kind, type) {
      return kind === 'pet' && !!(PD.creatures && PD.creatures.has(type));
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
      if (!a) return;
      const yaw = Number.isFinite(angle) ? rad(angle) : undefined;
      if (a.creature) a.creature.action(kind, yaw);
      else this._personAction(a, kind, yaw);
    }

    /**
     * Gente (o herói e os outros jogadores): o estilingue e a defesa da revisão 17 do protótipo (o dono trouxe do
     * ChatGPT; js/slingshot.js e js/guard.js). O motor manda as ações; quem decide carga, defesa e dano é o servidor.
     * A forquilha do estilingue só aparece na mão enquanto ele puxa e solta (escolha do dono: no resto do tempo, mãos
     * livres — a regra "sem arma no personagem").
     */
    /**
     * O que o jogador tem equipado (o motor manda o `gear` dele: o ícone de cada parte). O Arco de Bambu fica sempre na
     * mão (pedido do dono, 13/11: "o arco deve permanecer na mão, como um item / arma"); o resto não aparece no corpo.
     */
    gear(id, gear) {
      const a = this.actors.get(id);
      if (!a || !a.ch || a.creature) return;
      a.weapon = gear && gear.weapon ? gear.weapon : null;
      const ch = a.ch;
      const busy = ch.attack && ch.attack.kind === 'slingshot';
      if (a.weapon === 'arco') {
        if (ch.equipped.maoE !== 'arco' && !busy) ch.equip('maoE', 'arco');
      } else if (ch.equipped.maoE === 'arco' && !busy) ch.unequip('maoE');
      ch._pose = null;
    }

    _personAction(a, kind, yaw) {
      const ch = a.ch;
      const S = PD.slingshot;
      const G = PD.guard;
      if (!ch || ch.death) return;
      const slinging = () => ch.attack && ch.attack.kind === 'slingshot';
      // parado (ou quase): o tranco do golpe trava as pernas por 0,22 s. Andando, o servidor não para o jogador, então o
      // desenho também não para (se parasse, ele ficaria para trás e depois correria para alcançar)
      const still = () => Math.hypot(a.target.x - ch.pos.x, a.target.y - ch.pos.y) < 45 && ch.speed < 80;
      // com o arco na mão (o `gear` do jogador), é ele que atira; senão, a forquilha aparece só para o tiro
      const arm = () => {
        if (a.weapon === 'arco') {
          if (ch.equipped.maoE !== 'arco') ch.equip('maoE', 'arco');
        } else if (ch.equipped.maoE !== 'estilingue') ch.equip('maoE', 'estilingue');
        a.sling = true;
      };
      switch (kind) {
        case 'sling-pull': {
          // segurar: começa a puxar o elástico para a mira (sem ângulo, para onde ele olha; o tiro corrige ao soltar).
          // Mandado de novo durante a puxada, com o ângulo, só vira a mira e o corpo
          if (!S) return;
          if (slinging() && ch.attack.stage === 'charging') {
            if (yaw !== undefined) {
              ch.attack.dir = yaw;
              ch.faceYaw = yaw;
            }
            return;
          }
          if (ch.guard && ch.guard.active) G.release(ch, true);
          arm();
          S.start(ch, yaw ?? ch.yaw, { attackHeld: true });
          if (yaw !== undefined) ch.faceYaw = yaw;
          ch._pose = null;
          return;
        }
        case 'shoot': {
          if (!S) return;
          const dir = yaw ?? ch.yaw;
          arm();
          if (!(slinging() && ch.attack.stage === 'charging')) {
            // tiro rápido (toque no monstro) ou o tiro de outro jogador: a puxada começa já no ponto de soltar
            S.start(ch, dir, { attackHeld: true });
            ch.attack.age = (S.rulesOf ? S.rulesOf(ch) : S.RULES).minDraw;
          }
          const at = ch.attack;
          at.dir = dir;
          at.aimYaw = dir;
          at.poseAim = M.clamp(M.angleDiff(ch.yaw, dir), -65 * M.DEG, 65 * M.DEG);
          at.releaseRequested = true;
          ch.faceYaw = dir;
          ch._pose = null;
          return;
        }
        case 'sling-cancel':
          if (S && slinging()) S.cancel(ch);
          return;
        case 'dash': {
          // a esquiva: rola no chão até onde o servidor já pôs o herói (antes ele aparecia lá de uma vez, 3 m adiante)
          const T = a.target;
          const dx = T.x - ch.pos.x, dy = T.y - ch.pos.y, dist = Math.hypot(dx, dy);
          if (dist < 20 || !ch.startRoll) return;
          if (slinging() && S) S.cancel(ch);
          ch.startRoll(Math.atan2(dy, dx), dist);
          a.dash = false;
          return;
        }
        case 'guard':
          // defesa levantada (o motor manda de novo quando a mira da defesa muda)
          a.guardHeld = true;
          if (yaw !== undefined) a.guardDir = yaw;
          return;
        case 'guard-end':
          a.guardHeld = false;
          return;
        case 'guard-break':
          // a energia acabou: os braços caem e só levantam de novo soltando e apertando outra vez
          a.guardHeld = false;
          if (G) G.breakGuard(ch);
          if (still()) ch.reactToHit({ strength: 0.55 });
          return;
        case 'block':
          // a defesa segurou o golpe: os braços cedem um pouco e voltam
          if (G) G.ensure(ch).recoil = 0.2;
          return;
        case 'hurt':
          // golpe que passou: o tronco cede (a defesa e a pedra puxada caem, como no servidor)
          if (still()) ch.reactToHit({ strength: 0.45 });
          else if (S && slinging()) S.cancel(ch);
          return;
      }
    }

    /**
     * Conversa com NPC (WorldView.focus): a câmera vai, com suavidade, olhar para este ponto do chão (metros; o pé de
     * quem fala), que fica um pouco acima do meio da tela: a fala aparece embaixo, por cima da cena. null volta a
     * seguir o seu personagem. O zoom é do motor (setZoom).
     */
    focus(point) {
      this.focusPoint = point && Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x * 100, y: point.y * 100 } : null;
    }

    /** `id` fala por `ms` (WorldView.talk): a boca abre e fecha, a sobrancelha acompanha; sem balão. 0 para. */
    talk(id, ms) {
      const a = this.actors.get(id);
      if (!a) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      a.talkUntil = ms > 0 ? now + ms : 0;
      if (a.creature) a.creature.talk(Math.max(0, ms || 0));
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
      const rolling = !!(ch.dodge && ch.dodge.roll);
      if ((d > 300 && !rolling) || a.dash) {
        // teleporte (ou esquiva sem o rolamento): sem andar o caminho; a esquiva rola (view.action 'dash')
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
      // defesa (revisão 17): os braços sobem e viram para onde o motor mandou. A energia de verdade é a do servidor:
      // aqui ela fica sempre cheia, e a defesa só quebra quando o motor manda 'guard-break'
      if (PD.guard) {
        if (ch.guard) ch.guard.energy = PD.guard.RULES.maxEnergy;
        input.guardHeld = !!a.guardHeld;
        if (a.guardDir !== undefined) input.guardDir = a.guardDir;
      }
      ch.update(dt, input, null);
      // a forquilha sai da mão quando o tiro (ou a puxada cancelada) termina
      if (a.sling && !(ch.attack && ch.attack.kind === 'slingshot')) {
        if (ch.equipped.maoE === 'estilingue') ch.unequip('maoE');
        a.sling = false;
        // o equipamento pode ter mudado no meio do tiro: o arco volta (ou sai) agora
        if (a.weapon === 'arco' && ch.equipped.maoE !== 'arco') ch.equip('maoE', 'arco');
        else if (a.weapon !== 'arco' && ch.equipped.maoE === 'arco') ch.unequip('maoE');
      }
      // parado: vira para o ângulo que veio
      if (d <= 3 && a.angle !== undefined) ch.faceYaw = a.angle;
      // conversa: o NPC com quem você fala vira para você
      const fp = this.focusPoint;
      if (fp && a.kind === 'npc' && d <= 3 && Math.hypot(ch.pos.x - fp.x, ch.pos.y - fp.y) < 80) {
        const me = this.actors.get(this.followId);
        if (me && me !== a) ch.faceYaw = Math.atan2(me.ch.pos.y - ch.pos.y, me.ch.pos.x - ch.pos.x);
      }
      // falando: a boca abre e fecha em sílabas (ritmo que muda um pouco), a sobrancelha sobe de vez em quando
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (a.talkUntil && now < a.talkUntil && ch.look) {
        const t = now / 1000;
        const syl = Math.abs(Math.sin(t * 13.5 + a.id)) * (0.6 + 0.4 * Math.sin(t * 3.1 + a.id * 1.7));
        ch.look.mouthOpen = Math.max(ch.look.mouthOpen || 0, 0.1 + 0.55 * Math.max(0, syl));
        ch.look.browRaise = Math.max(ch.look.browRaise || 0, 0.3 * Math.max(0, Math.sin(t * 2.2 + a.id)));
      }
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
        let goal = { x: ch.pos.x + ch.vel.x * 0.22, y: ch.pos.y + ch.vel.y * 0.22, z: 0 };
        if (this.focusPoint) {
          // conversa: quem fala fica um pouco acima do meio da tela (a fala aparece embaixo); a câmera mira um ponto
          // mais perto dela no chão (andar d em x e em y desce 2·d·K·sinP na tela)
          const cam = this.cam;
          const portrait = cam.viewH > cam.viewW * 1.15;
          const d = (cam.viewH * (portrait ? 0.2 : 0.16)) / (2 * PD.ISO_K * cam.sinP * cam.zoom);
          goal = { x: this.focusPoint.x + d, y: this.focusPoint.y + d, z: 0 };
        }
        // dentro de uma casa (o telhado sai): a câmera vai para o meio dela, para a casa toda ficar no centro da tela
        // (saindo, a câmera volta para o herói junto com o telhado: a casa ainda em foco é a `focusHouse`)
        const home = this.world.insideHouse || this.world.focusHouse;
        if (home && !this.focusPoint) {
          const hb = home.b;
          const k = 0.7 * (home.cutK || 0);
          goal = { x: goal.x + ((hb.x0 + hb.x1) / 2 - goal.x) * k, y: goal.y + ((hb.y0 + hb.y1) / 2 - goal.y) * k, z: 0 };
        }
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
      this._drawAtmosphere(ctx);
      this._drawVeilMotes(ctx);
      this._drawNames(ctx);
      this._drawSpeech(ctx);
    }

    /**
     * Clima da área onde o herói está (mata sombria, pedido do dono): `escuro` escurece a tela em volta dele (perto
     * fica claro, para ler o combate) e `neblina` passa uma névoa fria que se arrasta devagar. Os valores vêm das
     * áreas do mapa (a menor que contém o herói vale) e mudam suave ao trocar de área.
     */
    _drawAtmosphere(ctx) {
      const hero = this.actors.get(this.followId);
      const cam = this.cam;
      const dt = this.world._dt || 1 / 60;
      let want = { dark: 0, fog: 0 };
      if (hero) {
        const x = hero.ch.pos.x, y = hero.ch.pos.y;
        let best = null;
        for (const a of this.map.areas || []) {
          if (a.dark === null && a.fog === null) continue;
          if (x < a.x0 || x > a.x1 || y < a.y0 || y > a.y1) continue;
          const size = (a.x1 - a.x0) * (a.y1 - a.y0);
          if (!best || size < best.size) best = { a, size };
        }
        if (best) want = { dark: best.a.dark || 0, fog: best.a.fog || 0 };
      }
      const atm = this.atm || (this.atm = { ...want });
      atm.dark = M.damp(atm.dark, want.dark, 1.2, dt);
      atm.fog = M.damp(atm.fog, want.fog, 1.2, dt);
      if (atm.dark < 0.01 && atm.fog < 0.01) return;
      const W = cam.viewW, H = cam.viewH;
      const pxm = 100 * cam.zoom; // px por metro (no chão, de lado)
      const c = hero ? this.toScreen(hero.ch.pos.x / 100, hero.ch.pos.y / 100, 1) : { x: W / 2, y: H / 2 };
      // tudo numa camada 4× menor, esticada uma vez só no fim (escuro e neblina são borrados mesmo): três passadas na
      // tela inteira (escuro, véu e bancos de neblina) pesavam no celular
      const Q = 4;
      const lw = Math.ceil(W / Q), lh = Math.ceil(H / Q);
      if (!this._atmLayer || this._atmLayer.width !== lw || this._atmLayer.height !== lh) {
        this._atmLayer = document.createElement('canvas');
        this._atmLayer.width = lw;
        this._atmLayer.height = lh;
      }
      const fl = this._atmLayer.getContext('2d');
      fl.globalAlpha = 1;
      fl.clearRect(0, 0, lw, lh);
      if (atm.dark >= 0.01) {
        // escuro frio em volta (verde-azulado bem fundo), mais fraco perto do herói
        const a = Math.min(0.7, atm.dark * 1.15);
        const g = fl.createRadialGradient(c.x / Q, c.y / Q, (pxm * 2.2) / Q, c.x / Q, c.y / Q, (pxm * 9.5) / Q);
        g.addColorStop(0, `rgba(4, 14, 18, ${a * 0.18})`);
        g.addColorStop(1, `rgba(4, 14, 18, ${a})`);
        fl.fillStyle = g;
        fl.fillRect(0, 0, lw, lh);
      }
      if (atm.fog >= 0.01) {
        // véu de névoa no todo e bancos de neblina que se arrastam (presos ao chão: passam quando você anda)
        fl.fillStyle = `rgba(150, 178, 172, ${atm.fog * 0.08})`;
        fl.fillRect(0, 0, lw, lh);
        if (!this._fogSprite) {
          const fc = document.createElement('canvas');
          fc.width = fc.height = 64;
          const fx = fc.getContext('2d');
          const fg = fx.createRadialGradient(32, 32, 0, 32, 32, 32);
          fg.addColorStop(0, 'rgba(196, 220, 214, 1)');
          fg.addColorStop(0.55, 'rgba(196, 220, 214, 0.45)');
          fg.addColorStop(1, 'rgba(196, 220, 214, 0)');
          fx.fillStyle = fg;
          fx.fillRect(0, 0, 64, 64);
          this._fogSprite = fc;
        }
        const t = this.world.time || 0;
        const cell = 9; // um banco de neblina a cada ~9 m
        const w = this.toWorld(W / 2, H / 2);
        const span = Math.ceil(Math.max(W, H) / pxm / cell) + 2;
        const gx = Math.floor(w.x / cell), gy = Math.floor(w.y / cell);
        for (let i = gx - span; i <= gx + span; i++) {
          for (let j = gy - span; j <= gy + span; j++) {
            const h = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
            const r1 = h - Math.floor(h);
            const fx = (i + r1) * cell + Math.sin(t * 0.05 + r1 * 6) * 3;
            const fy = (j + ((r1 * 7.3) % 1)) * cell + Math.cos(t * 0.04 + r1 * 4) * 2;
            const p = this.toScreen(fx, fy, 0.6);
            if (p.x < -pxm * 6 || p.x > W + pxm * 6 || p.y < -pxm * 4 || p.y > H + pxm * 4) continue;
            const rad = pxm * (3.5 + r1 * 3);
            fl.globalAlpha = Math.min(1, atm.fog * (0.4 + r1 * 0.3));
            fl.drawImage(this._fogSprite, (p.x - rad * 1.8) / Q, (p.y - rad * 0.55) / Q, (rad * 3.6) / Q, (rad * 1.1) / Q);
          }
        }
        fl.globalAlpha = 1;
      }
      this._drawGlows(fl, Q, W, H, pxm, Math.max(atm.dark, atm.fog * 0.6));
      const dpr = cam.dpr;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(this._atmLayer, 0, 0, W, H);
      ctx.restore();
    }

    /**
     * Véus (pedido do [mundo], 13/11): luzinhas que sobem devagar, como vaga-lumes espirituais (3 a 6 por véu, mais
     * no maior), e uma cortina de luz quase invisível que pulsa a cada ~4 s. Ficam por cima do escuro (são luz), mas
     * fracas e pequenas: não atrapalham ver quem está ali. O tamanho do véu (`raio`) dá a força: o círculo (3 m) é o
     * mais forte e a ponta do deque (1 m) a mais discreta. `coluna` (no mapa, em metros) deixa a coluna mais alta,
     * para chamar a atenção de longe (a Ilha do Véu).
     */
    _drawVeilMotes(ctx) {
      const veils = this.map.veils || [];
      if (!veils.length) return;
      const cam = this.cam;
      const t = this.world.time || 0;
      const z = cam.zoom;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      veils.forEach((v, i) => {
        const s = M.clamp(v.r / 300, 0.35, 1);
        const H = v.h || 140 + v.r * 0.5;
        const base = cam.p({ x: v.x, y: v.y, z: 0 });
        const top = cam.p({ x: v.x, y: v.y, z: H });
        const m = v.r * z * 1.5;
        if (base.x < cam.viewX - m || base.x > cam.viewX + cam.viewW + m || top.y > cam.viewY + cam.viewH + m || base.y < cam.viewY - m) return;
        // cortina: faixas finas de luz subindo do chão, balançando e pulsando devagar
        const pulse = 0.5 + 0.5 * Math.sin((t * M.TAU) / 4 + i * 1.7);
        for (let k = 0; k < 3; k++) {
          const off = (k - 1) * v.r * 0.35 + Math.sin(t * 0.6 + k * 2.1 + i) * v.r * 0.08;
          const a = cam.p({ x: v.x + off * 0.7, y: v.y - off * 0.7, z: 0 });
          const b = cam.p({ x: v.x + off * 0.7, y: v.y - off * 0.7, z: H * 0.9 });
          const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          g.addColorStop(0, `rgba(63, 214, 200, ${(0.05 + 0.06 * pulse) * s})`);
          g.addColorStop(1, 'rgba(63, 214, 200, 0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = Math.max(2, v.r * 0.22 * z);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        // luzinhas: cada uma sobe do chão, acende no meio do caminho e some no alto
        const n = Math.round(3 + 3 * s);
        for (let k = 0; k < n; k++) {
          const h1 = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
          const r1 = h1 - Math.floor(h1);
          const period = 4.5 + r1 * 2.5;
          const u = ((t + r1 * period) / period) % 1;
          const ang = r1 * M.TAU * 3 + k;
          const rr = v.r * 0.6 * Math.sqrt((r1 * 7.31) % 1);
          const sway = Math.sin(t * 0.9 + k * 1.3 + i) * 12;
          const p = cam.p({ x: v.x + Math.cos(ang) * rr + sway, y: v.y + Math.sin(ang) * rr, z: 20 + u * H });
          const alpha = Math.sin(Math.PI * u) * (0.35 + 0.45 * s);
          const R = (2.2 + 1.6 * s) * Math.max(0.6, z) * 3;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
          g.addColorStop(0, `rgba(220, 255, 250, ${alpha})`);
          g.addColorStop(0.3, `rgba(63, 214, 200, ${alpha * 0.7})`);
          g.addColorStop(1, 'rgba(63, 214, 200, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, R, 0, M.TAU);
          ctx.fill();
        }
      });
      ctx.restore();
    }

    /**
     * O que brilha na mata (cogumelos e véus, de PD.flora.glows): na mesma camada do escuro, abre um buraco no escuro
     * em volta de cada um e tinge o ar de verde-água, respirando devagar. Assim o brilho vence o escuro sem mais uma
     * passada na tela inteira.
     */
    _drawGlows(fl, Q, W, H, pxm, k) {
      if (k < 0.01) return;
      const glows = this._glows || (this._glows = PD.flora && PD.flora.glows ? PD.flora.glows(this.map) : []);
      if (!glows.length) return;
      const sprites = this._glowSprites || (this._glowSprites = new Map());
      const sprite = (color) => {
        let s = sprites.get(color);
        if (s) return s;
        s = document.createElement('canvas');
        s.width = s.height = 64;
        const g = s.getContext('2d');
        const n = parseInt(color.slice(1), 16);
        const rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, `rgba(${rgb}, 1)`);
        gr.addColorStop(0.4, `rgba(${rgb}, 0.5)`);
        gr.addColorStop(1, `rgba(${rgb}, 0)`);
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        sprites.set(color, s);
        return s;
      };
      const t = this.world.time || 0;
      const sinP = this.cam.sinP || 0.6;
      for (const g of glows) {
        const p = this.toScreen(g.x / 100, g.y / 100, g.z / 100);
        const breathe = 1 + 0.12 * Math.sin(t * 1.2 + g.x * 0.013 + g.y * 0.007);
        const rx = (g.r / 100) * pxm * breathe;
        const ry = rx * Math.max(0.55, sinP);
        if (p.x < -rx || p.x > W + rx || p.y < -ry || p.y > H + ry) continue;
        const x = (p.x - rx) / Q, y = (p.y - ry) / Q, w = (2 * rx) / Q, h = (2 * ry) / Q;
        // abre o escuro…
        fl.globalCompositeOperation = 'destination-out';
        fl.globalAlpha = Math.min(1, g.k * 1.4);
        fl.drawImage(sprite('#ffffff'), x, y, w, h);
        // …e acende a cor
        fl.globalCompositeOperation = 'source-over';
        fl.globalAlpha = Math.min(1, g.k * k * breathe * 1.1);
        fl.drawImage(sprite(g.color), x, y, w, h);
      }
      fl.globalCompositeOperation = 'source-over';
      fl.globalAlpha = 1;
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
      // dentro de uma casa, só os nomes de quem está nela (lá fora fica escuro)
      const home = this.world.insideHouse && this.world.insideHouse.cutK > 0.5 ? this.world.insideHouse.b : null;
      for (const a of this.actors.values()) {
        if (!a.name || (a.creature && a.creature.dying !== null)) continue; // caído: o nome sai junto
        if (home) {
          const p = a.creature ? a.creature.overHead() : a.ch.pos;
          if (!(p.x > home.x0 && p.x < home.x1 && p.y > home.y0 && p.y < home.y1)) continue;
        }
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

    /**
     * Na conversa, o seu personagem parado na frente de quem fala (entre ele e a câmera, que não gira) fica
     * transparente, com suavidade, para a pessoa aparecer falando.
     */
    _conversationAlpha(a) {
      const fp = this.focusPoint;
      let want = 1;
      if (fp && a.id === this.followId) {
        const cam = this.cam;
        const q = cam.p({ x: a.ch.pos.x, y: a.ch.pos.y, z: 0 });
        const n = cam.p({ x: fp.x, y: fp.y, z: 0 });
        const dy = q.y - n.y;
        if (dy > 0 && dy < 210 * cam.zoom && Math.abs(q.x - n.x) < 75 * cam.zoom) want = 0.32;
      }
      a.convAlpha = a.convAlpha === undefined ? want : a.convAlpha + (want - a.convAlpha) * 0.18;
      return a.convAlpha;
    }

    _actorDrawable(a) {
      if (a.creature) return a.creature.drawable(this.cam, a.id === this.followId);
      const ch = a.ch;
      const r = ch.radius || 30;
      const rig = a.rig;
      const painter = a.renderer;
      const cam = this.cam;
      const alpha = this._conversationAlpha(a);
      const paint = (c) => painter.draw(c, rig, ch.look, ch.equipped, a.appearance || PD.classes.appearanceOf(ch));
      return {
        entity: ch,
        primary: a.id === this.followId,
        fp: { x0: ch.pos.x - r, x1: ch.pos.x + r, y0: ch.pos.y - r, y1: ch.pos.y + r },
        bounds: painter.bounds(rig),
        body: painter.bounds(rig, 0.35),
        drawShadow: (c) => painter.drawShadow(c, rig, ch.groundZ),
        draw: (c) => {
          if (alpha > 0.98) return paint(c);
          c.save();
          c.globalAlpha *= alpha;
          paint(c);
          c.restore();
        },
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
