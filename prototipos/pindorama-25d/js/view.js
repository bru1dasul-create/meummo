// PD.View: o desenho 2.5D do jogo de verdade (Etapa 3 do Mapa 01). A [arte] desenha; o motor da [estrutura]
// (src/client/novo/engine.ts, página /?novo) conecta ao servidor, lê os controles e chama esta peça pela interface
// `WorldView` (src/client/novo/view.ts):
//   new PD.View(container, tmj)        container = a caixa da página (ou um <canvas> pronto); tmj = o JSON do mapa
//   addActor(id, { kind, type, name, look, x, y, angle, me })  kind: 'player' | 'npc' | 'monster'
//   moveActor(id, x, y, angle, { durationMs, dash })           a posição nova do pé, a cada ~50–120 ms
//   removeActor(id) · say(id, texto) · follow(id) · frame(agora) · destroy()
//   toWorld(xTela, yTela) → { x, y } · toScreen(x, y, z) → { x, y } · groundDirOfScreen(dx, dy) → { x, y }
//   actorPosition(id) → { x, y } (onde o pé está desenhado agora; o combate põe a barra de vida ali)
//   action(id, tipo, angulo)  golpes e reações (gente: tiro, defesa, 'dash' = rola, 'jump' = pula, 'volley' = atira para o
//                             alto, a Chuva de Flechas, 'hawk' = os olhos acendem; criaturas: os delas)
//   gear(id, gear)            o que o jogador tem equipado (o ícone de cada parte): o arco (`weapon: 'arco'`) fica na mão
//   canDraw(kind, tipo)       desenha este bicho? (kind 'pet': o Joaquim, 'joaquim'; ações wake, sleep, meow, purr, dash)
//   focus(ponto | null)       conversa: a câmera vai até quem fala (metros, o pé), um pouco acima do meio da tela
//   talk(id, ms)              quem fala mexe a boca (e a sobrancelha) por `ms`, sem balão; 0 para
//   levelUp(id, o que, hab.)  subiu de nível ('level') ou ganhou ponto numa habilidade ('skill'): anéis de luz subindo
//   consume(id, item)         bebeu ou comeu (a chave do item): a garrafada estourando em folhas, o benzimento da
//                             arruda ou as faíscas da comida (js/consume.js)
//   perch(id, galho)          o bicho no galho (o Sagui pendurado pelo rabo): galho = { altura (cm), direcao (graus,
//                             do tronco para a ponta do galho) } ou null (no chão); a view anima a subida e a descida.
//                             No `addActor`, `galho` = já aparece pendurado (sem animar)
// Posições em METROS, no pé, x para o leste e y para o sul (como o servidor e o Tiled; por dentro, centímetros).
// `angle` é para onde olha, em graus no chão (0 = leste/+x, 90 = sul/+y), como o pedido `walk` do servidor.
// A view não decide nada do jogo: anima o andar até a posição que recebe (perna pela distância, sem escorregar) e
// escolhe parado, andando ou correndo pela velocidade de verdade. Desenha também o nome em cima de cada um (o seu em
// dourado, NPC em verde-água, como no jogo de hoje) e os balões de fala.
(function (PD) {
  'use strict';
  const M = PD.math;

  /** O galho que o motor manda ({ altura: cm, direcao: graus }) → o da criatura ({ z: cm, yaw: rad }); null = no chão. */
  function perchOf(galho) {
    if (!galho || !Number.isFinite(galho.altura) || galho.altura <= 0) return null;
    return { z: galho.altura, yaw: Number.isFinite(galho.direcao) ? (galho.direcao * Math.PI) / 180 : undefined };
  }

  // câmera: "médio" (padrão) = 1, "longe" = 0,7 (mínimo). Aproximar além do médio e o celular em pé ainda vão
  // ser combinados com o dono: por enquanto, até "perto" (1,4) e uns 9 m de largura com o celular em pé
  // `talk`: até onde a câmera chega na conversa com um NPC. Quem manda nesse zoom é o motor (hoje 1,25); a view só
  // precisa saber para ADIANTAR o desenho daquele zoom (World.setAhead) e aprende o valor de verdade na 1ª conversa
  const ZOOM = { min: 0.7, max: 1.4, portraitMeters: 9, talk: 1.25 };
  /** Até que distância de um NPC (cm) o desenho do zoom da conversa vai sendo adiantado. */
  const AHEAD_REACH = 400;

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
      // Olhos de Gavião: o quanto a câmera afasta (setVision) e os bichos destacados (highlight)
      this.visionWant = 0;
      this.visionK = 1;
      this._highlights = null;
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
        // o bicho que já aparece dormindo (o Joaquim no sofá) ou pendurado no galho (o Sagui)
        if (a.asleep && creature.setAsleep) creature.setAsleep(true);
        if (a.galho && creature.setPerch) creature.setPerch(perchOf(a.galho), true);
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

    /**
     * O bicho no galho (o Sagui pendurado pelo rabo; opção 3 do dono, 23/11): `galho` = { altura: cm, direcao: graus
     * (para onde o galho aponta, do tronco para a ponta, como o `angle`) } ou null (no chão). Quem decide é o servidor;
     * a view anima a subida (pula, agarra o galho com o rabo e dá uma cambalhota de lado, 0,72 s) e a descida (desvira
     * soltando o rabo e cai de pé, 0,56 s).
     */
    perch(id, galho) {
      const a = this.actors.get(id);
      if (!a || !a.creature || !a.creature.setPerch) return;
      a.creature.setPerch(perchOf(galho), false);
    }

    /** Golpe ou reação (veja WorldView.action): as criaturas animam; o corpo de gente ainda não. */
    action(id, kind, angle) {
      const a = this.actors.get(id);
      if (!a) return;
      if (kind === 'hawk') {
        // os Olhos de Gavião (o seu ou o de outro jogador): os olhos acendem dourados por um instante
        // (no relógio dos quadros, o mesmo com que o `frame` mede o brilho)
        if (!a.creature) a.hawkAt = this.last || (typeof performance !== 'undefined' ? performance.now() : Date.now());
        return;
      }
      const yaw = Number.isFinite(angle) ? rad(angle) : undefined;
      if (a.creature) a.creature.action(kind, yaw);
      else this._personAction(a, kind, yaw);
    }

    /**
     * Subiu de nível (`what` = 'level') ou pôs um ponto numa habilidade ('skill', com `skill` = 'chuva', 'flecha' ou
     * 'olhos', para a cor): o círculo de luz que acende no chão e os anéis subindo pelo corpo (js/levelup.js). Você ou
     * outro jogador perto. No relógio dos quadros (`this.last`), como o brilho dos Olhos de Gavião.
     */
    levelUp(id, what, skill) {
      const a = this.actors.get(id);
      if (!a || a.creature || !PD.levelUpFx) return;
      a.levelFx = { at: this.last || (typeof performance !== 'undefined' ? performance.now() : Date.now()), look: PD.levelUpFx.look(what, skill) };
    }

    /**
     * Alguém usou um consumível (`item`: a chave em data/items.json): nas garrafadas, ela sobe girando, estoura em cima
     * da cabeça e as folhas descem em espiral; no Ramo de Arruda, o benzimento (o redemoinho de folhas subindo); na
     * comida, faíscas na cor dela (js/consume.js). Você ou outro jogador perto. Beber de novo recomeça o efeito.
     */
    consume(id, item) {
      const a = this.actors.get(id);
      if (!a || a.creature || !PD.consumeFx) return;
      const look = PD.consumeFx.look(item);
      a.consumeFx = { at: this.last || (typeof performance !== 'undefined' ? performance.now() : Date.now()), look };
      // o corpo: joga a garrafada para cima, come a banana, bebe a água de coco (no relógio do personagem)
      const ch = a.ch;
      if (ch && look.anim && !ch.death) ch.consumeAnim = { kind: look.anim, item, start: ch.time };
    }

    /**
     * Olhos de Gavião: quanto mais longe enxerga (o `visaoPorcento` do ponto, de 50 a 100; 0 = normal). A câmera
     * afasta com suavidade (passando do limite do zoom do jogador) e volta quando chega o 0.
     */
    setVision(percent) {
      const v = Number.isFinite(percent) ? M.clamp(percent, 0, 200) / 100 : 0;
      this.visionWant = v;
    }

    /**
     * Olhos de Gavião: os bichos destacados agora (o motor manda a cada quadro; lista vazia = nenhum), cada um com a
     * cor do perigo e o nível. O contorno e o selo do nível ficam por cima de tudo (das copas e do escuro).
     */
    highlight(list) {
      if (!list || !list.length) {
        this._highlights = null;
        return;
      }
      const next = new Map();
      for (const h of list) if (h && Number.isFinite(h.id)) next.set(h.id, { color: h.color || '#f2c14e', level: h.level | 0 });
      this._highlights = next;
    }

    /**
     * Gente (o herói e os outros jogadores): o estilingue e a defesa da revisão 17 do protótipo (o dono trouxe do
     * ChatGPT; js/slingshot.js e js/guard.js). O motor manda as ações; quem decide carga, defesa e dano é o servidor.
     * A forquilha do estilingue só aparece na mão enquanto ele puxa e solta (escolha do dono: no resto do tempo, mãos
     * livres — a regra "sem arma no personagem").
     */
    /**
     * O que o jogador tem equipado (o motor manda o `gear` dele: o ícone de cada parte). O Arco de Bambu fica sempre com
     * ele (pedido do dono, 13/11: "o arco deve permanecer na mão, como um item / arma"; desde 21/11 nas costas, e na mão
     * para atirar: slingshot.js); o resto não aparece no corpo.
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

    /**
     * A flecha especial entrou no arco do jogador (ou saiu: null) — 'ancestral' = a Flecha Ancestral. O arco brilha com o
     * espírito e a flecha da puxada sai verde-clara, a mesma que voa depois (pedido do dono, 19/11: "o efeito pegando na
     * flecha do arco e ela acompanhando"). Quando ela sai (null), a flecha da mão segura o brilho um instante, até o tiro
     * deixar o arco (slingshot.js desenha).
     */
    armed(id, kind, rank, level) {
      const a = this.actors.get(id);
      if (!a || !a.ch || a.creature) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const look = a.ch.look;
      if (kind) {
        // (22/11: 'ancestral' ou 'chuva', os pontos da habilidade e, puxando, o degrau — 1 fraco, 2 médio, 3 forte. O
        // brilho da flecha cresce a cada degrau e dá um clarão quando ele sobe: slingshot.js lê `arrowLevel`/`arrowLevelAt`)
        look.arrowKind = kind;
        if (rank >= 1) look.arrowRank = rank;
        const lv = level >= 1 ? Math.min(3, Math.round(level)) : 0;
        if (lv > (look.arrowLevel || 0)) look.arrowLevelAt = now;
        look.arrowLevel = lv;
        a.armedOff = 0;
        // (o fim do brilho é conferido no `frame` com o relógio do jogo, que fica para trás depois da câmera lenta do F1:
        // marcar com o mesmo relógio — 22/11, o dono: "depois de usar o R, o arco fica com o efeito do R". O clarão do
        // degrau, `arrowLevelAt`, fica no relógio da página: o slingshot.js lê com ele)
      } else if (look.arrowKind) a.armedOff = (this.last || now) + 250;
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
          // com a Chuva no arco, a puxada já mira para o alto (22/11; antes só virava na hora de soltar)
          if (ch.look.arrowKind === 'chuva') ch.attack.volleyAim = true;
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
          at.poseAim = S.poseAimOf(ch, M.angleDiff(ch.yaw, dir));
          at.releaseRequested = true;
          ch.faceYaw = dir;
          ch._pose = null;
          return;
        }
        case 'volley': {
          // a Chuva de Flechas: puxa mirando para o alto e solta (a pose de `volley` é do slingshot.js)
          if (!S) return;
          const dir = yaw ?? ch.yaw;
          if (ch.guard && ch.guard.active) G.release(ch, true);
          arm();
          if (slinging() && ch.attack.stage === 'charging') {
            // (22/11: a Chuva agora vai no arco, como a Flecha Ancestral — o motor manda a puxada de sempre e o 'volley'
            // na hora de soltar. Antes a puxada recomeçava aqui e ele soltava 0,32 s depois das flechas subirem: agora
            // solta já, mirando para o alto)
            const at = ch.attack;
            at.volley = true;
            at.dir = dir;
            at.aimYaw = dir;
            at.poseAim = S.poseAimOf(ch, M.angleDiff(ch.yaw, dir));
            at.releaseRequested = true;
            ch.faceYaw = dir;
            ch._pose = null;
            return;
          }
          S.start(ch, dir, { attackHeld: true });
          ch.attack.volley = true; // (solta sozinha depois de 0,32 s: slingshot.js)
          ch.faceYaw = dir;
          ch._pose = null;
          return;
        }
        case 'sling-cancel':
          if (S && slinging()) S.cancel(ch);
          return;
        case 'jump':
          // o pulo (Espaço; por enquanto só enfeite: o servidor não muda o lugar): o animador pula no próximo quadro
          a.jumpPulse = true;
          return;
        case 'dash': {
          // a esquiva: rola no chão até onde o servidor já pôs o herói (antes ele aparecia lá de uma vez, 3 m adiante)
          const T = a.target;
          const dx = T.x - ch.pos.x, dy = T.y - ch.pos.y, dist = Math.hypot(dx, dy);
          if (dist < 20 || !ch.startRoll) return;
          if (slinging() && S) S.cancel(ch);
          // (no ar ele não rola: aí vale o jeito antigo, aparecer lá)
          if (ch.startRoll(Math.atan2(dy, dx), dist)) a.dash = false;
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
      const had = !!this.focusPoint;
      this.focusPoint = point && Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x * 100, y: point.y * 100 } : null;
      // (a conversa acabou agora: a câmera ainda vai voltar — veja `camHeld` no `frame`)
      // (no relógio dos quadros: `last` é a hora do último `frame`)
      if (had && !this.focusPoint) this._focusEndAt = this.last || 0;
      // (o zoom com que a conversa começou: se o motor mexer nele, o de chegada é o "zoom da conversa" — veja `_ahead`)
      this._focusZoom = this.focusPoint ? this.zoomUser : null;
    }

    /**
     * Para qual zoom a câmera deve ir em seguida, e olhando para onde (World.setAhead)? Na conversa o motor aproxima a
     * câmera em 0,45 s; quando ela chegava, o jogo refazia de uma vez as imagens de tudo o que aparece (e o chão) no
     * zoom novo: o "tranco" do zoom da conversa (dono, 15/11). Agora, com o herói perto de um NPC (4 m), o desenho
     * daquele zoom vai sendo adiantado aos poucos, com o tempo que sobra de cada quadro.
     */
    _ahead(hero) {
      // aprende o zoom da conversa: o motor mexeu no zoom com a conversa aberta e ele já parou
      if (this.focusPoint && this._focusZoom !== null && Math.abs(this.zoomUser - this._focusZoom) > 0.01 && !this.world.zoomSettling()) this._talkZoom = this.zoomUser;
      const talk = this._talkZoom || ZOOM.talk;
      // (com a conversa já aberta não adianta mais nada: a câmera está saindo, e o que faltar é feito na chegada, do
      // meio da tela para fora — medido: adiantar aqui punha uma imagem pesada bem no quadro em que o zoom começa)
      if (!this.world.keepLevels || !(talk > this.zoomUser + 0.01) || !hero || this.focusPoint) return null;
      let point = null;
      let best = AHEAD_REACH;
      for (const a of this.actors.values()) {
        if (a.kind !== 'npc') continue;
        const pos = a.ch ? a.ch.pos : a.creature ? a.creature.pos : null;
        if (!pos) continue;
        const d = Math.hypot(pos.x - hero.ch.pos.x, pos.y - hero.ch.pos.y);
        if (d < best) {
          best = d;
          point = pos;
        }
      }
      if (!point) return null;
      const cam = this.cam;
      const zoom = this._baseZoom(cam.viewW, cam.viewH) * talk * (this.visionK || 1);
      // o ponto do chão que a câmera mira na conversa (a mesma conta do `frame`, no zoom de lá)
      const portrait = cam.viewH > cam.viewW * 1.15;
      const d = (cam.viewH * (portrait ? 0.2 : 0.16)) / (2 * PD.ISO_K * cam.sinP * zoom);
      // (`still`: o herói parado — só aí saem as imagens pesadas: World._buildAhead)
      const still = Math.hypot(hero.ch.vel.x, hero.ch.vel.y) < 20;
      return { zoom, x: point.x + d, y: point.y + d, still };
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
      // a esquiva "dava uma travada no final" (dono, 15/11): o rolamento anda até 0,4 s mas dura 0,5 s, e quem continua
      // andando já está mais à frente. Se o alvo seguiu adiante, o fim do rolamento emenda direto na corrida
      if (rolling && ch.dodge.timing && ch.dodge.t >= ch.dodge.timing.moveEnd && d > 30 && ch._finishDodge) {
        ch._finishDodge({ velocity: { x: (dx / d) * S.run, y: (dy / d) * S.run }, speed: S.run, run: true });
      }
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
      if (a.jumpPulse) {
        input.jump = true;
        a.jumpPulse = false;
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
      const z = this._baseZoom(w, h) * this.zoomUser * (this.visionK || 1);
      // guardar o desenho de dois zooms (o do jogador e o da conversa) e adiantar o da conversa gasta memória (medido a
      // 1600 × 900: uns 50 MB a mais ao lado de um NPC e na conversa). Em tela de 2 pixels por ponto (celular, tablet:
      // as imagens já têm 4× os pixels) e em aparelho de até 4 GB fica como era, um zoom por vez
      if (this.world) this.world.keepLevels = !(dpr >= 2 || (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 4));
      if (Math.abs(z - cam.zoom) > 1e-4 || (this.world && this.world._dpr !== dpr)) {
        cam.zoom = z;
        if (this.world) {
          this.world.invalidate();
          this.world._dpr = dpr;
        }
      }
    }

    /** Zoom do jogador: 1 = "médio", 0,7 = "longe". */
    /**
     * O vento (a [estrutura] manda, do servidor): `strength` de 0 (parado) a 1 (forte); `angle` (opcional), para onde
     * ele sopra, em graus no chão (0 = leste, 90 = sul). As copas balançam e as pétalas voam com ele.
     */
    setWind(strength, angle) {
      if (this.world && this.world.setWind) this.world.setWind(strength, angle);
    }

    /**
     * Dia e noite (o motor manda a cada mudança): `light` de 1 (dia) a 0 (noite fechada), com o anoitecer e o amanhecer
     * suaves; `night` = é noite (os bichos ficam mais fortes: os olhos deles ficam vermelhos). O escuro azul, o tom
     * laranja do pôr do sol e as luzes acesas (postes, fogueiras, as portas das casas com gente, o boitatá) ficam no
     * `_drawAtmosphere`.
     */
    setTimeOfDay(time) {
      this.daylight = M.clamp(time && typeof time.light === 'number' ? time.light : 1, 0, 1);
      this.isNight = !!(time && time.night);
      // (a água usa a luz do dia para os brilhos do sol: agua.js)
      if (this.world) this.world.daylight = this.daylight;
      if (PD.creatures && PD.creatures.eyes) PD.creatures.eyes.night = this.isNight;
    }

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
      // Olhos de Gavião: a câmera afasta até 1/(1 + 0,35 × visão) e volta (uns 0,6 s)
      // (em 0,4 s certinhos: cada quadro com o zoom mudando custa caro, então nada de cauda comprida)
      const visionGoal = 1 / (1 + 0.35 * (this.visionWant || 0));
      const vt = this._visionTween;
      if (!vt || vt.to !== visionGoal) this._visionTween = { from: this.visionK, to: visionGoal, t: 0 };
      const tw = this._visionTween;
      if (tw.t < 1) {
        tw.t = Math.min(1, tw.t + dt / 0.4);
        this.visionK = tw.from + (tw.to - tw.from) * M.smoothstep(0, 1, tw.t);
      }
      this._resize();
      for (const a of this.actors.values()) this._drive(a, dt);
      // o brilho dourado nos olhos de quem usou os Olhos de Gavião (e, fraco, nos seus enquanto valem)
      for (const a of this.actors.values()) {
        if (a.creature) continue;
        let glow = 0;
        if (a.hawkAt) {
          const s = (t - a.hawkAt) / 1000;
          glow = s < 0 ? 0 : s < 0.15 ? s / 0.15 : s < 1.2 ? 1 : Math.max(0, 1 - (s - 1.2) / 0.5);
          if (s > 1.8) a.hawkAt = 0;
        }
        if (a.id === this.followId && this.visionWant > 0) glow = Math.max(glow, 0.45);
        a.eyeGlow = glow;
        // o efeito de subir de nível (ou o de beber) acabou
        if (a.levelFx && (t - a.levelFx.at) / 1000 > PD.levelUpFx.duration(a.levelFx.look)) a.levelFx = null;
        if (a.consumeFx && (t - a.consumeFx.at) / 1000 > PD.consumeFx.duration(a.consumeFx.look)) a.consumeFx = null;
        if (a.armedOff && t >= a.armedOff) {
          a.armedOff = 0;
          if (a.ch) {
            a.ch.look.arrowKind = null;
            a.ch.look.arrowLevel = 0;
          }
        }
      }
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
        // (a câmera parada na conversa — e nos 0,7 s seguintes, enquanto o zoom volta: o mundo não adianta nem solta
        // imagem de quem está fora da tela; medido: no quadro em que a conversa fechava, ainda no zoom de perto, ele
        // fazia a imagem inteira de um prédio fora da tela)
        this.world.camHeld = !!this.focusPoint || t - (this._focusEndAt || -1e9) < 700;
        if (this.world.setAhead) this.world.setAhead(this._ahead(hero));
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
      // (quem está fora da tela continua na lista — conta para a ordem e para as copas que ficam transparentes —, mas não
      // é pintado: antes cada um custava o desenho inteiro à toa, ~2,4 ms o Curupira longe da Budega. 22/11, "deixa os
      // personagens mais leves")
      const seen = this._onScreen();
      const actors = [...this.actors.values()].map((a) => {
        const d = this._actorDrawable(a);
        if (d && (a.levelFx || a.consumeFx)) this._withFx(d, a);
        else if (d && d.bounds && !seen(d.bounds)) {
          d.draw = () => {};
          d.drawShadow = () => {};
        }
        return d;
      });
      this.world.draw(ctx, actors);
      this._drawAtmosphere(ctx);
      this._drawVeilMotes(ctx);
      this._drawHawk(ctx);
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
      // a noite (setTimeOfDay): o quanto escureceu, suave mesmo quando vira de uma vez (o menu ADM)
      const nightWant = this.daylight == null ? 0 : 1 - this.daylight;
      atm.night = M.damp(atm.night ?? nightWant, nightWant, 1.6, dt);
      // o pôr do sol (e o nascer): um tom laranja quente no meio do caminho entre o dia e a noite
      const dusk = this.daylight == null ? 0 : Math.max(0, 1 - Math.abs(1 - atm.night - 0.55) / 0.32);
      if (atm.dark < 0.01 && atm.fog < 0.01 && atm.night < 0.01 && dusk < 0.01) return;
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
      if (dusk >= 0.01) {
        fl.fillStyle = `rgba(255, 126, 54, ${(0.11 * dusk).toFixed(3)})`;
        fl.fillRect(0, 0, lw, lh);
      }
      if (atm.night >= 0.01) {
        // a noite: azul frio por cima de tudo, mais fraco em volta do herói (dá para ver quem chega)
        const a = Math.min(0.78, atm.night * 0.78);
        const g = fl.createRadialGradient(c.x / Q, c.y / Q, (pxm * 1.6) / Q, c.x / Q, c.y / Q, (pxm * 8.5) / Q);
        g.addColorStop(0, `rgba(6, 12, 34, ${a * 0.5})`);
        g.addColorStop(1, `rgba(6, 12, 34, ${a})`);
        fl.fillStyle = g;
        fl.fillRect(0, 0, lw, lh);
      }
      this._drawGlows(fl, Q, W, H, pxm, Math.max(atm.dark, atm.fog * 0.6, atm.night));
      if (atm.night >= 0.05) this._drawNightLights(fl, Q, W, H, pxm, atm.night);
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

    /**
     * As luzes acesas à noite (na mesma camada do escuro, como os brilhos da mata): o poste aceso faz uma poça de luz
     * no chão e um halo na lâmpada (os `apagado` ficam apagados); a fogueira tremula; as casas com gente (e a Budega)
     * deixam a luz quente sair pela porta; o filhote de boitatá ilumina em volta dele. Cada uma abre o escuro e tinge
     * o ar da cor dela.
     */
    /**
     * A janela (x, na parede da frente de `b`, a `z` cm do chão) fica atrás de outra casa, na tela? Outra casa que fica
     * para o lado da câmera (mais ao sul) e cuja silhueta (a caixa vista de cima e do lado) cobre o ponto da janela.
     */
    _windowHidden(b, x, z) {
      const P = this.toScreen(x / 100, b.y1 / 100, z / 100);
      for (const o of this.map.houses || []) {
        if (o === b || o.y0 < b.y1 - 1 || o.x1 < b.x0 - 1500 || o.x0 > b.x1 + 1500) continue;
        const h = o.h || 300;
        const pts = [];
        for (const xx of [o.x0, o.x1]) for (const yy of [o.y0, o.y1]) for (const zz of [0, h]) pts.push(this.toScreen(xx / 100, yy / 100, zz / 100));
        // o contorno (convexo) dos oito cantos na tela
        const s = pts.sort((p, q) => p.x - q.x || p.y - q.y);
        const cross = (o0, a, c) => (a.x - o0.x) * (c.y - o0.y) - (a.y - o0.y) * (c.x - o0.x);
        const half = (list) => {
          const out = [];
          for (const q of list) {
            while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
            out.push(q);
          }
          return out;
        };
        const lo = half(s), hi = half(s.slice().reverse());
        const hull = lo.slice(0, -1).concat(hi.slice(0, -1));
        let inside = true;
        for (let i = 0; i < hull.length && inside; i++) if (cross(hull[i], hull[(i + 1) % hull.length], P) < 0) inside = false;
        if (inside) return true;
      }
      return false;
    }

    _nightSources() {
      if (this._nightList) return this._nightList;
      const out = [];
      const map = this.map;
      for (const p of map.poles || []) if (p.lamp) out.push({ x: p.x, y: p.y, z: 0, r: 260, color: p.light || '#ffe9a6', k: 0.75, head: p.h });
      for (const p of map.props || []) {
        if (p.kind === 'poste-praca' && !p.off) out.push({ x: p.x, y: p.y, z: 0, r: 220, color: p.light || '#ffe9a6', k: 0.7, head: p.h });
        if (p.kind === 'fogueira') out.push({ x: p.x, y: p.y, z: 0, r: 240, color: p.light || '#ffb347', k: 0.9, flicker: true });
        // o lampião do Refúgio (a lanterna fica na ponta do braço, 38 cm para o leste)
        if (p.kind === 'lampiao') out.push({ x: p.x + 38, y: p.y, z: 0, r: 200, color: p.light || '#ffd36b', k: 0.7, head: (p.h || 280) - 40, flicker: true });
      }
      for (const b of map.houses || []) {
        if (!(b.resident || b.shop || b.interior) || b.abandoned) continue;
        const dx = b.door ? (b.door.from + b.door.to) / 2 : (b.x0 + b.x1) / 2;
        out.push({ x: dx, y: b.y1 + 50, z: 0, r: 150, color: '#ffd58a', k: 0.45 });
        // as casas de tábua do Refúgio: a luz de dentro saindo pelas janelas abertas
        if (b.material === 'tabua' && PD.refugio) for (const w of PD.refugio.windows(b)) out.push({ x: b.x0 + w.x + w.w / 2, y: b.y1 + 8, z: (w.z0 + w.z1) / 2, r: 80, color: '#ffcf7a', k: 0.55 });
        // as casas de alvenaria com gente (a comunidade da represa): umas janelas acesas, andar por andar, nos mesmos
        // lugares das janelas da frente (props.js: 110 cm de largura, espalhadas; no térreo, do outro lado da porta). A
        // luz é o vidro aceso (`pane`, o retângulo da janela na parede), não uma bola de luz: a bola vazava para cima da
        // laje; e janela que outra casa tampa na tela fica apagada (a camada da noite fica por cima de tudo)
        if (b.material !== 'tabua' && b.resident && !b.door && !b.interior && !b.garage && !b.facade && !b.abandoned) {
          const W = b.x1 - b.x0, Hh = b.h || 300, floors = Math.max(1, b.floors || 1), fh = Hh / floors;
          const r = M.rng(Math.round(b.x0 * 13 + b.y1 * 7));
          for (let f = b.shop ? 1 : 0; f < floors; f++) {
            const doorW = f === 0 ? 92 : 0, doorX = f === 0 ? Math.min(W - doorW - 50, W * 0.18) : 0;
            const room = f === 0 ? W - (doorX + doorW) - 60 : W - 80;
            const n = room > 120 ? Math.max(1, Math.floor(room / 190)) : 0;
            for (let k = 0; k < n; k++) {
              if (r() < 0.4) continue; // (nem toda janela está acesa)
              const wx = (f === 0 ? doorX + doorW + 40 : 40) + (room / n) * (k + 0.5) - 55;
              const wy = Hh - (f + 1) * fh + Math.max(40, fh * 0.28), wh = Math.min(100, fh * 0.36);
              const pane = [b.x0 + wx + 12, b.x0 + wx + 98, Hh - wy - wh + 10, Hh - wy - 10];
              if (this._windowHidden(b, (pane[0] + pane[1]) / 2, (pane[2] + pane[3]) / 2)) continue;
              out.push({ pane, x: (pane[0] + pane[1]) / 2, y: b.y1, z: (pane[2] + pane[3]) / 2, r: 0, color: '#ffd27a', k: 0.85 });
            }
          }
        }
        // a Budega maior: o LED branco contornando a frente (luzinhas na beirada de cima) e a vitrine amarela acesa
        if (b.led) {
          for (let x = b.x0 + 40; x <= b.x1 - 40; x += 110) {
            out.push({ x, y: b.y1 + 6, z: (b.h || 300) - 8, r: 60, color: '#f4f7ff', k: 0.6 });
            out.push({ x, y: b.y1 + 6, z: (b.h || 300) - 118, r: 55, color: '#f4f7ff', k: 0.5 });
          }
        }
        if (b.facade === 'preta') {
          // a vitrine e a porta acesas (a loja brilha de noite) e a luz que elas jogam na calçada
          const vx = (b.x0 + (b.door ? b.door.from : b.x1)) / 2;
          out.push({ x: vx, y: b.y1 + 10, z: 140, r: 240, color: '#ffe27a', k: 0.7 });
          if (b.door) out.push({ x: (b.door.from + b.door.to) / 2, y: b.y1 + 10, z: 120, r: 170, color: '#f4f2e6', k: 0.6 });
          out.push({ x: vx, y: b.y1 + 70, z: 0, r: 210, color: '#ffd84a', k: 0.5 });
        }
      }
      this._nightList = out;
      return out;
    }

    _drawNightLights(fl, Q, W, H, pxm, k) {
      const list = this._nightSources().slice();
      // quem tem luz própria e anda: o filhote de boitatá (aceso)
      for (const a of this.actors.values()) {
        if (a.type !== 'filhote_boitata' || !a.creature || a.creature.dying !== null) continue;
        const lit = a.creature._lit ? a.creature._lit() : 1;
        if (lit > 0.05) list.push({ x: a.creature.pos.x, y: a.creature.pos.y, z: 0, r: 240, color: '#ff9a3a', k: 0.85 * lit, flicker: true });
      }
      // quem está subindo de nível ou bebendo: a luz do efeito abre o escuro em volta dele, no chão e no corpo
      // (js/levelup.js, js/consume.js)
      for (const a of this.actors.values()) {
        if (!a.ch) continue;
        for (const [fx, lib] of [
          [a.levelFx, PD.levelUpFx],
          [a.consumeFx, PD.consumeFx],
        ]) {
          if (!fx || !lib) continue;
          const lit = lib.light(fx.look, (this.last - fx.at) / 1000);
          if (lit < 0.02) continue;
          list.push({ x: a.ch.pos.x, y: a.ch.pos.y, z: 0, r: 230, color: fx.look.hex, k: 0.8 * lit });
          list.push({ x: a.ch.pos.x, y: a.ch.pos.y, z: 120, r: 150, color: fx.look.hex, k: 0.7 * lit });
        }
      }
      // os vaga-lumes acesos (vida.js)
      if (PD.vida) for (const g of PD.vida.glows(this.world)) list.push(g);
      if (!list.length) return;
      const sprites = this._glowSprites || (this._glowSprites = new Map());
      const sprite = (color) => {
        let sp = sprites.get(color);
        if (sp) return sp;
        sp = document.createElement('canvas');
        sp.width = sp.height = 64;
        const g = sp.getContext('2d');
        const n = parseInt(color.slice(1), 16);
        const rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, `rgba(${rgb}, 1)`);
        gr.addColorStop(0.4, `rgba(${rgb}, 0.5)`);
        gr.addColorStop(1, `rgba(${rgb}, 0)`);
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        sprites.set(color, sp);
        return sp;
      };
      const t = this.world.time || 0;
      const sinP = this.cam.sinP || 0.6;
      const put = (x, y, z, r, color, kk) => {
        const p = this.toScreen(x / 100, y / 100, z / 100);
        const rx = (r / 100) * pxm;
        const ry = rx * Math.max(0.55, sinP);
        if (p.x < -rx || p.x > W + rx || p.y < -ry || p.y > H + ry) return;
        const bx = (p.x - rx) / Q, by = (p.y - ry) / Q, bw = (2 * rx) / Q, bh = (2 * ry) / Q;
        // abre o escuro só em parte (a poça de luz não vira dia) e tinge com a cor da luz
        fl.globalCompositeOperation = 'destination-out';
        fl.globalAlpha = Math.min(0.85, kk * 0.9);
        fl.drawImage(sprite('#ffffff'), bx, by, bw, bh);
        fl.globalCompositeOperation = 'source-over';
        fl.globalAlpha = Math.min(1, kk * 0.55);
        fl.drawImage(sprite(color), bx, by, bw, bh);
      };
      // o vidro da janela aceso: o retângulo dela na parede (abre o escuro e pinta com a cor da luz de dentro)
      const pane = (L, kk) => {
        const [x0, x1, z0, z1] = L.pane;
        const pts = [[x0, z1], [x1, z1], [x1, z0], [x0, z0]].map(([x, z]) => this.toScreen(x / 100, L.y / 100, z / 100));
        if (pts.every((p) => p.x < -10) || pts.every((p) => p.x > W + 10) || pts.every((p) => p.y < -10) || pts.every((p) => p.y > H + 10)) return;
        fl.beginPath();
        pts.forEach((p, i) => (i ? fl.lineTo(p.x / Q, p.y / Q) : fl.moveTo(p.x / Q, p.y / Q)));
        fl.closePath();
        fl.globalCompositeOperation = 'destination-out';
        fl.globalAlpha = Math.min(0.9, kk);
        fl.fill();
        fl.globalCompositeOperation = 'source-over';
        fl.globalAlpha = Math.min(0.75, kk * 0.8);
        fl.fillStyle = L.color;
        fl.fill();
      };
      for (const L of list) {
        if (L.pane) {
          pane(L, L.k * k);
          continue;
        }
        const flick = L.flicker ? 0.85 + 0.15 * Math.sin(t * 9 + L.x * 0.01) * Math.sin(t * 5.3 + L.y * 0.02) : 1;
        put(L.x, L.y, L.z, L.r * flick, L.color, L.k * k * flick);
        // o halo da lâmpada lá em cima
        if (L.head) put(L.x, L.y, L.head, 70, '#fff3c8', 0.9 * k);
      }
      // o reflexo das luzes na água (agua.js): a faixa comprida e tremida embaixo de cada luz alta, só onde é água
      if (PD.agua && PD.agua.screenWater) this._drawLightReflections(fl, Q, W, H, pxm, k, list, sprite, t);
      fl.globalCompositeOperation = 'source-over';
      fl.globalAlpha = 1;
    }

    /**
     * O reflexo das luzes da noite na água: cada luz alta (lampião, poste, janela) deixa uma faixa comprida e tremida
     * no ponto espelhado dela (a mesma posição com a altura para baixo). As faixas são montadas numa tela à parte,
     * recortadas na água, e o que fica na frente da água na tela (o deque, as casas, os barcos, as árvores) apaga a
     * faixa com a própria imagem: a camada da noite fica por cima de tudo e, sem isso, a luz passava por cima do deque.
     */
    _drawLightReflections(fl, Q, W, H, pxm, k, list, sprite, t) {
      // as faixas (na tela, px): só as das luzes altas cujo ponto espelhado cai na tela
      const boxes = [];
      for (const L of list) {
        const zh = L.head || L.z;
        // (o vidro aceso da janela de alvenaria não faz faixa na água)
        if (!(zh > 60) || L.pane) continue;
        const p = this.toScreen(L.x / 100, L.y / 100, -zh / 100);
        const rx = 0.32 * pxm * (0.9 + 0.1 * Math.sin(t * 2.3 + L.x * 0.03)) * (1 + 0.12 * Math.sin(t * 3.1 + L.y * 0.05));
        const ry = 0.32 * pxm * 3.2;
        if (p.x < -rx || p.x > W + rx || p.y < -ry || p.y > H + ry) continue;
        boxes.push({ x0: p.x - rx, x1: p.x + rx, y0: p.y - ry, y1: p.y + ry, L });
      }
      if (!boxes.length) return;
      const water = PD.agua.screenWater(this.world, (x, y) => this.toScreen(x / 100, y / 100, 0), Q);
      if (!water) return;
      const lw = fl.canvas.width, lh = fl.canvas.height;
      let rc = this._reflLayer;
      if (!rc || rc.width !== lw || rc.height !== lh) {
        rc = this._reflLayer = document.createElement('canvas');
        rc.width = lw;
        rc.height = lh;
      }
      // tudo acontece só no retângulo que junta as faixas (na camada, que é Q vezes menor que a tela)
      const U = {
        x0: Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.x0)) / Q) - 1), y0: Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.y0)) / Q) - 1),
        x1: Math.min(lw, Math.ceil(Math.max(...boxes.map((b) => b.x1)) / Q) + 1), y1: Math.min(lh, Math.ceil(Math.max(...boxes.map((b) => b.y1)) / Q) + 1),
      };
      if (U.x1 <= U.x0 || U.y1 <= U.y0) return;
      const uw = U.x1 - U.x0, uh = U.y1 - U.y0;
      const r = rc.getContext('2d');
      r.setTransform(1, 0, 0, 1, 0, 0);
      r.globalCompositeOperation = 'source-over';
      r.globalAlpha = 1;
      r.clearRect(U.x0, U.y0, uw, uh);
      r.save();
      r.clip(water);
      for (const b of boxes) {
        r.globalAlpha = Math.min(1, (b.L.k || 0.6) * 1.1);
        r.drawImage(sprite(b.L.color || '#ffd36b'), b.x0 / Q, b.y0 / Q, (b.x1 - b.x0) / Q, (b.y1 - b.y0) / Q);
      }
      r.restore();
      // o que está na frente da água apaga a faixa: de cada imagem pronta, só o pedaço que cai em cima de uma faixa
      r.globalCompositeOperation = 'destination-out';
      r.globalAlpha = 1;
      const vx = this.cam.viewX, vy = this.cam.viewY;
      // (as coisas que podem aparecer na tela, que o mundo separou neste quadro; sem elas, todas)
      const seen = this.world.visible || this.world.props || [];
      const occluders = this.world.flats ? this.world.flats.concat(seen) : seen;
      for (const o of occluders) {
        const sp = o.sprite;
        if (o.house || !sp || !sp.c || !o._zoomKey || o.spriteKey !== o._zoomKey()) continue;
        const ox0 = sp.x - vx, oy0 = sp.y - vy, ox1 = ox0 + sp.w, oy1 = oy0 + sp.h;
        const fx = sp.c.width / sp.w, fy = sp.c.height / sp.h;
        for (const b of boxes) {
          const ix0 = Math.max(ox0, b.x0), iy0 = Math.max(oy0, b.y0), ix1 = Math.min(ox1, b.x1), iy1 = Math.min(oy1, b.y1);
          if (ix1 <= ix0 || iy1 <= iy0) continue;
          r.drawImage(sp.c, (ix0 - ox0) * fx, (iy0 - oy0) * fy, (ix1 - ix0) * fx, (iy1 - iy0) * fy, ix0 / Q, iy0 / Q, (ix1 - ix0) / Q, (iy1 - iy0) / Q);
        }
      }
      r.globalCompositeOperation = 'source-over';
      // abre o escuro onde a faixa ficou e tinge com a cor da luz
      fl.globalCompositeOperation = 'destination-out';
      fl.globalAlpha = Math.min(0.85, 0.75 * k);
      fl.drawImage(rc, U.x0, U.y0, uw, uh, U.x0, U.y0, uw, uh);
      fl.globalCompositeOperation = 'source-over';
      fl.globalAlpha = Math.min(1, 0.7 * k);
      fl.drawImage(rc, U.x0, U.y0, uw, uh, U.x0, U.y0, uw, uh);
      fl.globalAlpha = 1;
    }

    /** Uma tela de rascunho do destaque (a silhueta e o contorno), do tamanho pedido (só cresce). */
    _hawkCanvas(i, w, h) {
      const list = this._hawkCanvases || (this._hawkCanvases = []);
      let c = list[i];
      if (!c) c = list[i] = document.createElement('canvas');
      if (c.width < w || c.height < h) {
        c.width = Math.max(c.width, Math.ceil(w));
        c.height = Math.max(c.height, Math.ceil(h));
      }
      return c;
    }

    /**
     * Olhos de Gavião (highlight): cada bicho destacado ganha, por cima de tudo, o contorno na cor do perigo (com
     * brilho), o corpo meio transparente na mesma cor (aparece atrás da árvore e no escuro) e o selo do nível em cima.
     * A silhueta sai do próprio desenho do bicho: ele é pintado numa tela de rascunho, vira uma cor só, é engordado em
     * 8 direções e tem o miolo tirado (sobra a borda). Isso é caro (o dono sentiu o "lagzinho": com 15 bichos o quadro
     * ia de 13 para 76 ms), então o destaque pronto de cada bicho fica guardado e é refeito só a cada 5 quadros (um
     * bicho por vez, em quadros diferentes); nos outros quadros a imagem guardada acompanha o pé dele.
     */
    _drawHawk(ctx) {
      const list = this._highlights;
      const cache = this._hawkCache || (this._hawkCache = new Map());
      if (!list || !list.size) {
        if (cache.size) cache.clear();
        return;
      }
      const cam = this.cam;
      const dpr = cam.dpr;
      const t = this.world.time || 0;
      const tick = (this._hawkTick = (this._hawkTick || 0) + 1);
      const vx0 = cam.viewX, vy0 = cam.viewY, vx1 = vx0 + cam.viewW, vy1 = vy0 + cam.viewH;
      const margin = 320 * cam.zoom;
      for (const id of cache.keys()) if (!list.has(id)) cache.delete(id);
      for (const [id, h] of list) {
        const a = this.actors.get(id);
        if (!a || !a.ch || (a.creature && a.creature.dying !== null)) {
          cache.delete(id);
          continue;
        }
        // o motor manda todos os bichos que conhece: os longe da tela nem montam o desenho
        const foot = cam.p({ x: a.ch.pos.x, y: a.ch.pos.y, z: 0 });
        if (foot.x < vx0 - margin || foot.x > vx1 + margin || foot.y < vy0 - margin || foot.y > vy1 + margin * 2) continue;
        let e = cache.get(id);
        const stale = !e || e.color !== h.color || e.zoom !== cam.zoom || e.dpr !== dpr || (tick + id) % 5 === 0;
        if (stale) {
          const d = this._actorDrawable(a);
          const b = d.bounds;
          if (!b || !(b.x1 > b.x0) || !(b.y1 > b.y0)) continue;
          const P = 14; // a folga em volta (a borda engordada e o brilho)
          const x = Math.floor(b.x0 - P), y = Math.floor(b.y0 - P);
          const w = Math.ceil(b.x1 - b.x0 + 2 * P), hh = Math.ceil(b.y1 - b.y0 + 2 * P);
          if (w > 900 || hh > 900) continue;
          const W = Math.ceil(w * dpr), H = Math.ceil(hh * dpr);
          // a silhueta, numa cor só
          const sil = this._hawkCanvas(0, W, H);
          const sc = sil.getContext('2d');
          sc.setTransform(1, 0, 0, 1, 0, 0);
          sc.globalCompositeOperation = 'source-over';
          sc.globalAlpha = 1;
          sc.clearRect(0, 0, sil.width, sil.height);
          sc.setTransform(dpr, 0, 0, dpr, -x * dpr, -y * dpr);
          d.draw(sc);
          sc.setTransform(1, 0, 0, 1, 0, 0);
          sc.globalCompositeOperation = 'source-in';
          sc.fillStyle = h.color;
          sc.fillRect(0, 0, W, H);
          sc.globalCompositeOperation = 'source-over';
          // a borda: a silhueta engordada em 8 direções, menos ela mesma
          const rim = this._hawkCanvas(1, W, H);
          const rc = rim.getContext('2d');
          rc.setTransform(1, 0, 0, 1, 0, 0);
          rc.globalCompositeOperation = 'source-over';
          rc.clearRect(0, 0, rim.width, rim.height);
          const R = 2.4 * dpr;
          for (let k = 0; k < 8; k++) {
            const ang = (k * Math.PI) / 4;
            rc.drawImage(sil, 0, 0, W, H, Math.cos(ang) * R, Math.sin(ang) * R, W, H);
          }
          rc.globalCompositeOperation = 'destination-out';
          rc.drawImage(sil, 0, 0, W, H, 0, 0, W, H);
          rc.globalCompositeOperation = 'source-over';
          // o destaque pronto (o corpo a 10%, o brilho e a borda), guardado na tela do próprio bicho
          if (!e) e = { cv: document.createElement('canvas') };
          if (e.cv.width !== W || e.cv.height !== H) {
            e.cv.width = W;
            e.cv.height = H;
          }
          const oc = e.cv.getContext('2d');
          oc.setTransform(1, 0, 0, 1, 0, 0);
          oc.clearRect(0, 0, W, H);
          oc.globalAlpha = 0.1;
          oc.drawImage(sil, 0, 0, W, H, 0, 0, W, H);
          oc.globalAlpha = 1;
          oc.shadowColor = h.color;
          oc.shadowBlur = 10 * dpr;
          oc.drawImage(rim, 0, 0, W, H, 0, 0, W, H);
          oc.shadowBlur = 0;
          oc.drawImage(rim, 0, 0, W, H, 0, 0, W, H);
          Object.assign(e, { color: h.color, zoom: cam.zoom, dpr, ox: x - foot.x, oy: y - foot.y, w, h: hh, top: b.y0 - foot.y });
          cache.set(id, e);
        }
        if (foot.x + e.ox + e.w < vx0 || foot.x + e.ox > vx1 || foot.y + e.oy + e.h < vy0 || foot.y + e.oy > vy1) continue;
        // na tela: a imagem guardada no pé do bicho, pulsando devagar
        ctx.save();
        ctx.globalAlpha = 0.82 + 0.18 * Math.sin(t * 4.5 + id);
        ctx.drawImage(e.cv, foot.x + e.ox, foot.y + e.oy, e.w, e.h);
        ctx.restore();
        this._hawkBadge(ctx, a, h, { y0: foot.y + e.top });
      }
    }

    /** O selo do nível em cima do bicho destacado: "Nv 3" na cor do perigo, numa plaquinha escura com borda acesa. */
    _hawkBadge(ctx, a, h, b) {
      const q = this._overHead(a);
      const top = Math.min(q.y, b.y0);
      const label = 'Nv ' + h.level;
      ctx.save();
      ctx.font = '800 11px ' + UI_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width;
      const bw = tw + 12, bh = 16;
      const cx = q.x, cy = top - 14 - (a.name ? 14 : 0);
      const r = bh / 2;
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2 + r, cy - r);
      ctx.lineTo(cx + bw / 2 - r, cy - r);
      ctx.arc(cx + bw / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(cx + 4, cy + r);
      ctx.lineTo(cx, cy + r + 5);
      ctx.lineTo(cx - 4, cy + r);
      ctx.lineTo(cx - bw / 2 + r, cy + r);
      ctx.arc(cx - bw / 2 + r, cy, r, Math.PI / 2, (Math.PI * 3) / 2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(14, 11, 7, 0.88)';
      ctx.shadowColor = h.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = h.color;
      ctx.stroke();
      ctx.fillStyle = h.color;
      ctx.fillText(label, cx, cy + 0.5);
      ctx.restore();
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

    /**
     * Os efeitos em volta de quem desenha `d` (o de subir de nível, js/levelup.js, e o de beber ou comer,
     * js/consume.js; os dois juntos, se for o caso): a parte do chão junto com as sombras (embaixo de tudo), a de trás
     * antes do corpo e a da frente depois. Ficam fora da imagem guardada do personagem (drawCached): são desenhados à
     * parte, então quem está parado continua leve.
     */
    _withFx(d, a) {
      const ch = a.ch;
      const cam = this.cam;
      const foot = { x: ch.pos.x, y: ch.pos.y, z: ch.groundZ || 0 };
      const list = [];
      if (a.levelFx && PD.levelUpFx) list.push([PD.levelUpFx, a.levelFx]);
      if (a.consumeFx && PD.consumeFx) list.push([PD.consumeFx, a.consumeFx]);
      // (o de beber também recebe o esqueleto e o personagem: desenha o item na mão e a garrafada sai dela)
      const who = (fx) => ({ rig: a.rig, ch, fx });
      const pass = (c, name) => {
        for (const [lib, fx] of list) lib.draw(c, cam, foot, (this.last - fx.at) / 1000, fx.look, name, who(fx));
      };
      const draw = d.draw;
      const shadow = d.drawShadow;
      d.drawShadow = (c) => {
        shadow(c);
        pass(c, 'chao');
      };
      d.draw = (c) => {
        pass(c, 'tras');
        draw(c);
        pass(c, 'frente');
      };
    }

    /** A caixa (px do mundo) aparece na tela? Com folga de ~2 m (o arco nas costas, o brilho, o contorno). */
    _onScreen() {
      const cam = this.cam;
      const m = 200 * cam.zoom;
      const x0 = cam.viewX - m, y0 = cam.viewY - m, x1 = cam.viewX + cam.viewW + m, y1 = cam.viewY + cam.viewH + m;
      return (b) => b.x1 >= x0 && b.x0 <= x1 && b.y1 >= y0 && b.y0 <= y1;
    }

    _actorDrawable(a) {
      if (a.creature) return a.creature.drawable(this.cam, a.id === this.followId);
      const ch = a.ch;
      const r = ch.radius || 30;
      const rig = a.rig;
      const painter = a.renderer;
      const cam = this.cam;
      const alpha = this._conversationAlpha(a);
      const paint = (c) => {
        if (ch.look) ch.look.eyeGlow = a.eyeGlow || 0;
        const app = a.appearance || (PD.classes.playerAppearance || PD.classes.appearanceOf)(ch);
        // quem está parado reaproveita a imagem pronta (CharacterRenderer.drawCached, 22/11: "deixa os personagens mais
        // leves"); ao vivo sempre: a flecha especial no arco e os olhos do Gavião (animam com o relógio) e a transparência
        // da conversa
        const live = alpha <= 0.98 || !!(ch.look && (ch.look.arrowKind || (ch.look.eyeGlow || 0) > 0.01));
        // (`PD.characterCacheOff = true` no console desliga a imagem guardada: para comparar)
        if (painter.drawCached && !PD.characterCacheOff) painter.drawCached(c, rig, ch.look, ch.equipped, app, live);
        else painter.draw(c, rig, ch.look, ch.equipped, app);
      };
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
