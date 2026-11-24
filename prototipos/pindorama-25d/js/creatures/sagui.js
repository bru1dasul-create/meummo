// Sagui Travesso (o sagui-de-tufo-branco encantado da mata do parque): cinza-amarronzado, o lombo com faixas, o rosto
// escuro com a mancha branca na testa, os tufos brancos em leque dos lados da cabeça, olhos amarelos acesos (o encanto)
// e o rabo comprido e peludo de anéis. Parado, senta nas patas de trás e olha em volta; andando, corre de quatro aos
// saltos; no golpe, se estica, ergue a fruta atrás da cabeça com um sorriso travesso ('windup') e arremessa ('shoot').
// Do servidor vêm só a casa, o lado e o golpe.
// Redesenho (23/11, aprovado pelo dono, um bicho por etapa): sem as bolinhas — o corpo é pintado como o Birim (o
// contorno de tinta mais grosso do lado da sombra, a meia-lua de sombra e a faixa de brilho), com a beirada em mechas
// de pelo (PD.creatures.paint). Apanhando, dá um tranco para trás (para longe de quem bateu); caindo, desmaia de
// bruços e o encanto sai do corpo em faíscas roxas. As bolas ficam só para a sombra no chão e a caixa do desenho.
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  const P = C.paint;
  const SH = PD.shapes;
  const { tube } = C;

  /** Tamanho: o sagui de verdade tem uns 20 cm de corpo; no jogo ele é bem maior (sentado, uns 75 cm, quase metade do
   *  herói), para ler no celular com a câmera longe (zoom 0,7), onde o herói tem uns 55 px de altura. No jogo antigo
   *  o monstro tinha o tamanho do personagem. */
  const S = 1.6;
  // as cores: a cor de cada parte e a sombra e o brilho transparentes por cima (escurecem e clareiam os detalhes juntos)
  const SHADE = 'rgba(48, 30, 42, 0.42)';
  const LIGHT = 'rgba(255, 243, 222, 0.32)';
  const LOOK = {
    fur: { base: '#8e7f6e', shade: SHADE, light: LIGHT },
    limb: { base: '#83735f', shade: SHADE, light: LIGHT },
    head: { base: '#7f6d5b', shade: SHADE, light: LIGHT },
    tuft: { base: '#f7f3ea', shade: 'rgba(92, 80, 112, 0.32)', light: 'rgba(255, 255, 255, 0.7)' },
    tail: { base: '#b9ab96', shade: SHADE, light: LIGHT },
    hand: { base: '#3a2f29', shade: 'rgba(16, 10, 14, 0.45)', light: 'rgba(255, 238, 214, 0.25)' },
    fruit: { base: '#c6e061', shade: 'rgba(46, 72, 8, 0.45)', light: 'rgba(250, 255, 214, 0.75)' },
  };
  const BAND = '#4c4137'; // as faixas do lombo
  const RING = '#3b3129'; // os anéis escuros do rabo
  const BELLY = '#bfa682';
  const FACE = '#2a211c';
  const MUZZLE = '#3b2f28';
  const BLAZE = '#f7f4ec';
  const LID = '#c9b49b'; // olho fechado: o risco claro na cara escura
  const EYE = '#ffd45c';
  const EYE_GLOW = 'rgba(255, 204, 84, 0.5)';
  const MOTE = '#cfb3ff';
  const SPARK = '#b58cff';

  /** Joelho ou cotovelo entre a raiz e a ponta, com os ossos `l1` e `l2`, dobrando para o lado de `hint`. */
  function bend(a, b, l1, l2, hint) {
    const d = M.sub(b, a);
    let dl = M.len(d) || 1e-3;
    const dir = M.scale(d, 1 / dl);
    dl = Math.min(dl, l1 + l2 - 0.01);
    const along = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl);
    const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const p = M.sub(hint, M.scale(dir, M.dot(hint, dir)));
    const pl = M.len(p) || 1;
    return M.add(M.add(a, M.scale(dir, along)), M.scale(p, h / pl));
  }

  /**
   * A forma lisa da sombra e do brilho: o casco dos mesmos círculos de tela com o raio `px` maior. A folga cobre as
   * mechas inteiras (o comprimento e o quanto deitam, ~1,5 × o comprimento): ponta de mecha para fora dela, do lado da
   * luz, saía escura. (Engordar o casco pronto quebrava nas pontas finas dos tufos.)
   */
  function padHull(disks, px) {
    return SH.circleHull(disks.map((d) => ({ x: d.x, y: d.y, r: d.r + px })), 0.35);
  }

  /**
   * Pequeno na tela (o zoom do celular, 0,7): menos mechas, e braços, pernas e tufos sem a sombra pintada — nesse
   * tamanho não aparece, e o desenho fica bem mais leve.
   */
  const small = (z) => z < 0.85;

  /**
   * O galho: subindo, ele pula (a primeira parte, até lá em cima esticado, com a ponta do rabo chegando no galho) e dá
   * uma cambalhota de lado até ficar de cabeça para baixo; descendo, desvira (soltando o rabo) e cai de pé. Em segundos
   * e na parte de cada pedaço.
   */
  const UP_DUR = 0.72;
  const UP_LEAP = 0.4;
  const DOWN_DUR = 0.56;
  const DOWN_FLIP = 0.42;
  const WORLD_UP = Object.freeze({ x: 0, y: 0, z: 1 });
  const PACIFY_RUN_AT = 0.43;
  const PACIFY_END = 1.28;

  /** Estrelinha de 4 pontas (o encanto), em px de tela. */
  function star(ctx, x, y, s) {
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

  class Sagui extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 20 * S;
      this.up = 1;
      this.run = 0;
      /** Braço do arremesso: 'raise' (preparo, fruta atrás da cabeça) ou 'throw'; `armK` 0..1 do repouso até lá. */
      this.armMode = 'raise';
      this.armK = 0;
      this.thr = 0;
      this.top = 66 * S;
      this.acts = { windup: { dur: 0.3, hold: 0.9 }, shoot: { dur: 0.3, hold: 0.22 } };
      /** Caiu: desmaia de bruços (pose própria, sem tombar de lado). */
      this.ownDeath = true;
      /** Para onde vai o tranco do golpe levado (no chão, unitário): para longe do herói, ou para trás. */
      this.recoilDir = { x: -Math.cos(yaw), y: -Math.sin(yaw) };
      /** No galho, pendurado pelo rabo: { z: a altura (cm), yaw: para onde o galho aponta } ou null (veja `setPerch`). */
      this.perch = null;
      /** A passagem entre o chão e o galho: { kind: 'subir' | 'descer', t, dur, x, y, z, yaw } (de onde saiu). */
      this.trans = null;
      /** O balanço pendurado (rad; + = a cabeça para a frente) e a velocidade dele. */
      this.swing = 0;
      this.swingV = 0;
      /** Desmaiou no galho: de que altura cai (cm). */
      this.fallFrom = 0;
      /** No Capão, a quebra do encanto: segundos desde o clarão e destino da corrida, em cm. */
      this.freed = null;
      /** Pendurado: de que lado do galho o rabo vem (+1 / -1; 0 = ainda não escolhido; veja `_hangRig`). */
      this.tailSide = 0;
    }

    /**
     * No galho (pendurado pelo rabo): `perch` = { z: a altura do galho (cm), yaw: para onde o galho aponta (rad) } ou
     * null (no chão). Quem manda é o servidor (pela view: `view.perch`); `instant` (o bicho que já aparece no galho)
     * pula a animação. Do chão para o galho (0,72 s), ele pula, agarra o galho com o rabo e dá uma cambalhota de lado
     * até ficar de cabeça para baixo ('subir'); do galho para o chão (0,56 s), desvira soltando o rabo e cai de pé
     * ('descer').
     */
    setPerch(perch, instant) {
      if (this.dying !== null) return;
      const next = perch && Number.isFinite(perch.z) && perch.z > 30 ? { z: perch.z, yaw: Number.isFinite(perch.yaw) ? perch.yaw : this.yaw + Math.PI / 2 } : null;
      if (instant) {
        this.perch = next;
        this.trans = null;
        this.swing = 0;
        this.swingV = 0;
        return;
      }
      if (next && !this.perch) this.trans = { kind: 'subir', t: 0, dur: UP_DUR, x: this.pos.x, y: this.pos.y, z: next.z, yaw: next.yaw };
      else if (!next && this.perch) this.trans = { kind: 'descer', t: 0, dur: DOWN_DUR, x: this.pos.x, y: this.pos.y, z: this.perch.z, yaw: this.perch.yaw };
      this.perch = next;
    }

    /** A altura do galho agora (cm; 0 = no chão), contando a subida e a descida. */
    perchHeight() {
      const tr = this.trans;
      if (tr && tr.kind === 'descer') return tr.z * (1 - M.clamp01(tr.t / tr.dur));
      if (tr && tr.kind === 'subir') return tr.z * M.clamp01(tr.t / tr.dur);
      return this.perch ? this.perch.z : 0;
    }

    /** O encanto se quebra. Se estava no galho, solta o rabo, cai e recupera as patas antes de sair correndo. */
    pacify(x, y) {
      if (this.freed || this.dying !== null) return;
      this.fallFrom = this.perchHeight();
      this.perch = null;
      this.trans = null;
      this.act = null;
      this.armK = 0;
      this.moveTo(this.pos.x, this.pos.y, this.yaw, 60);
      this.freed = { t: 0, x, y, origin: null };
    }

    get pacifyFinished() {
      return this.freed !== null && this.freed.t >= PACIFY_END;
    }

    action(kind, yaw) {
      if (kind === 'die' && this.dying === null) {
        // desmaiou no galho (ou descendo): cai lá de cima
        this.fallFrom = this.perchHeight();
        this.perch = null;
        this.trans = null;
      }
      if (kind === 'hurt' && this.dying === null) {
        // o golpe quase sempre vem do herói (o servidor não diz de onde): o tranco vai para longe dele
        let dx = -Math.cos(this.yaw), dy = -Math.sin(this.yaw);
        const h = this.near && this.near.hero;
        if (h) {
          const ax = this.pos.x - h.x, ay = this.pos.y - h.y;
          const d = Math.hypot(ax, ay);
          if (d > 1 && d < 2500) {
            dx = ax / d;
            dy = ay / d;
          }
        }
        this.recoilDir = { x: dx, y: dy };
        // pendurado, o golpe empurra o balanço (para longe de quem bateu)
        if (this.perch) this.swingV += 6 * (dx * Math.cos(this.yaw) + dy * Math.sin(this.yaw));
      }
      super.action(kind, yaw);
    }

    /** O clarão do golpe, fraquinho: quem mostra que apanhou é o tranco. */
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
      const freed = this.freed;
      if (freed) {
        const before = freed.t;
        freed.t += dt;
        if (before < PACIFY_RUN_AT && freed.t >= PACIFY_RUN_AT) {
          const dx = freed.x - this.pos.x, dy = freed.y - this.pos.y;
          const yaw = dx !== 0 || dy !== 0 ? Math.atan2(dy, dx) : this.yaw;
          this.moveTo(freed.x, freed.y, yaw, (PACIFY_END - freed.t) * 1000);
        }
      }
      const tr = this.trans;
      if (tr) {
        tr.t += dt;
        if (tr.t >= tr.dur) this.trans = null;
      }
      // o balanço pendurado (+ = a cabeça para a frente): uma mola em volta do alvo — parado, um vaivém preguiçoso; no
      // preparo, bem para trás (o aviso); no arremesso, para a frente
      if (this.perch && this.dying === null) {
        const act = this.act;
        let target = Math.sin(this.time * 1.7 + this.seed * 5) * 0.12;
        if (act && act.kind === 'windup') target = -0.6 - 0.18 * M.clamp01((act.t - act.dur) / Math.max(0.01, act.hold));
        else if (act && act.kind === 'shoot') target = act.t < act.dur ? 0.55 : 0.1;
        this.swingV += (-(this.swing - target) * 32 - this.swingV * 3.4) * dt;
        this.swing += this.swingV * dt;
      } else if (!this.trans) {
        this.swing = 0;
        this.swingV = 0;
      }
      if (this.dying !== null) {
        this.run = 0;
        this.up = M.damp(this.up, 0, 12, dt);
        this.armK = M.damp(this.armK, 0, 12, dt);
        this.label = 'caído';
        return;
      }
      this.run = this.perch ? 0 : M.smoothstep(30, 150, this.speed);
      const act = this.act;
      const busy = act && (act.kind === 'windup' || act.kind === 'shoot');
      this.up = M.damp(this.up, busy ? 1 : 1 - this.run, busy ? 14 : 7, dt);
      if (act && act.kind === 'windup') {
        this.armMode = 'raise';
        this.armK = M.damp(this.armK, 1, 16, dt);
      } else if (act && act.kind === 'shoot') {
        this.armMode = 'throw';
        this.armK = 1;
        this.thr = M.clamp01(act.t / act.dur);
      } else this.armK = M.damp(this.armK, 0, 7, dt); // volta ao repouso de onde estiver
      // passada de quatro aos saltos: uns 70 cm por ciclo
      this.phase = (this.phase + (this.speed * dt) / (70 * S)) % 1;
      this.label = this.perch ? (busy ? 'jogando do galho' : 'no galho') : busy ? 'jogando' : this.run > 0.5 ? 'correndo' : 'parado';
    }

    /** O momento (o golpe, o tranco, o desmaio...): os mesmos números para o chão e para o galho. */
    _moment() {
      const act = this.act;
      const throwing = this.armMode === 'throw';
      const armK = this.armK;
      const dying = this.dying;
      const freeing = this.freed?.t ?? null;
      const down = freeing ?? dying;
      const stand = freeing === null ? 0 : M.smoothstep(0.24, PACIFY_RUN_AT, freeing);
      const rd = this.recoilDir;
      return {
        t: this.time,
        act,
        armK,
        throwing,
        wind: throwing ? 0 : armK, // preparo (para o outro braço, a cabeça e o rabo)
        // segurando o preparo (0..1): o corpo vai mais para trás, a fruta brilha e treme no fim
        hold: act && act.kind === 'windup' && act.hold > 0 ? M.clamp01((act.t - act.dur) / act.hold) : 0,
        thr: this.thr,
        rec: this.recoil(),
        hop: this.hurtT < 0.3 ? Math.sin((this.hurtT / 0.3) * Math.PI) : 0,
        down,
        // desmaio: despenca de bruços em 0,26 s, quica de leve no chão, braços para a frente e o rabo largado
        slump: down === null ? 0 : M.easeIn(M.clamp01(down / 0.26)) * (1 - stand),
        land: down === null ? 0 : Math.max(0, Math.sin(M.clamp01((down - 0.26) / 0.16) * Math.PI)) * 2.5,
        // o tranco empurra para o lado do `recoilDir`: de frente para quem bateu, o corpo verga para trás
        push: rd.x * Math.cos(this.yaw) + rd.y * Math.sin(this.yaw),
      };
    }

    /** A pose (pontos 3D) e as partes pintadas, cada uma com a bola da sombra e o seu desenho. */
    parts(cam) {
      const st = this._moment();
      const tr = this.trans;
      const k = tr ? M.clamp01(tr.t / tr.dur) : 1;
      let rig;
      if (tr && tr.kind === 'subir' && this.perch) {
        // o pulo, e depois a cambalhota até ficar pendurado
        rig = k < UP_LEAP ? this._groundRig(st) : this._flipRig(st, this.perch.z, this.perch.yaw, (k - UP_LEAP) / (1 - UP_LEAP), 0, null);
      } else if (tr && tr.kind === 'descer' && k < DOWN_FLIP) {
        // desvira soltando o rabo, lá no galho de onde saiu (o pé de agora pode já estar em outra casa)
        rig = this._flipRig(st, tr.z, tr.yaw, 1 - k / DOWN_FLIP, k / DOWN_FLIP, tr, 0.45);
      } else if (this.perch) rig = this._hangRig(st, this.perch.z, this.perch.yaw);
      else rig = this._groundRig(st);
      return this._build(cam, rig, st);
    }

    /**
     * O corpo no chão: sentado, correndo de quatro, no golpe, no tranco e desmaiado. No ar (subindo para o galho,
     * descendo dele ou caindo desmaiado lá de cima), o mesmo corpo levantado do chão.
     */
    _groundRig(st) {
      const { t, act, armK, throwing, wind, hold, thr, rec, hop, slump, land, push } = st;
      // no ar: de onde saiu (o galho ou o chão) até o pé de agora, num arco
      let airX = 0, airY = 0, airZ = 0, leap = 0;
      const tr = this.trans;
      if (tr && tr.kind === 'subir') {
        // chega lá em cima esticado, de braços e rabo para cima (é aí que a cambalhota emenda)
        const u = M.clamp01(tr.t / tr.dur / UP_LEAP);
        leap = Math.sin((u * Math.PI) / 2);
        airZ = (tr.z - 62 * S) * u * (2 - u); // a parábola do pulo (sai rápido e para lá em cima)
        airX = (tr.x - this.pos.x) * (1 - u);
        airY = (tr.y - this.pos.y) * (1 - u);
      } else if (tr && tr.kind === 'descer') {
        const u = M.clamp01((tr.t / tr.dur - DOWN_FLIP) / (1 - DOWN_FLIP));
        leap = 1 - u;
        airZ = Math.max(0, tr.z - 62 * S) * (1 - u * u);
        airX = (tr.x - this.pos.x) * (1 - u);
        airY = (tr.y - this.pos.y) * (1 - u);
      } else if (this.fallFrom > 0 && st.down !== null) {
        const u = M.clamp01(st.down / 0.24);
        airZ = Math.max(0, this.fallFrom - 62 * S) * (1 - u * u);
      }
      const up = M.lerp(M.smoothstep(0, 1, this.up), 0.55, leap);
      const run = this.run * (1 - leap);
      const ph = this.phase * M.TAU;
      const D = (v, lying) => M.lerp(v, lying, slump);
      const L = (a, b) => M.lerp(a, b, up); // de quatro → sentado
      const bounce = 5 * Math.max(0, Math.sin(ph)) * run * (1 - up);
      const lean = 9 * rec * push + (throwing ? (act ? 9 * Math.sin(thr * Math.PI) : 0) : -6 * wind - 3 * hold);
      const rise = 5 * wind + 2 * hold + 6 * leap; // no preparo e no pulo, estica o corpo para cima
      const shake = hold > 0.72 ? Math.sin(t * 70) * 0.8 * (hold - 0.72) / 0.28 : 0; // a tremidinha antes de jogar
      const breath = Math.sin(t * 2.4 + this.seed * 6) * 0.6 * (1 - run);
      const rd = this.recoilDir;
      const offX = rd.x * 10 * S * rec + airX, offY = rd.y * 10 * S * rec + airY, offZ = 3 * S * hop + airZ;
      const at = (a, s, z) => {
        const p = this.at(a * S, (s + shake) * S, z * S);
        return { x: p.x + offX, y: p.y + offY, z: p.z + offZ };
      };
      const fwd = this._fwd();
      const side = this._side();

      // espinha: quadril → peito
      const hip = at(L(-9, -2) + lean * 0.3, 0, D(L(19, 12) + bounce - rec * 1.5, 8.5 + land));
      const chest = at(L(7, 1) + lean, 0, D(L(18, 30) + rise + bounce + breath - rec * 2.5, 8.5 + land));
      const flex = 1 + 0.16 * Math.cos(ph) * run * (1 - up);
      const mid = M.lerp3(hip, chest, 0.5);
      const hipF = M.add(mid, M.scale(M.sub(hip, mid), flex));
      const chestF = M.add(mid, M.scale(M.sub(chest, mid), flex));

      // cabeça: olha em volta quando está sentado e parado; no tranco e no preparo, um pouco para cima
      const look = (M.noise1(t * 0.35 + this.seed * 20) - 0.5) * 1.3 * up * (1 - wind) * (1 - run) * (1 - rec) * (1 - leap);
      const hy = this.yaw + look;
      const headC = at(D(L(17, 3) + lean * 1.25, 19), 0, D(L(27, 45) + rise * 1.25 + bounce + breath * 1.4 - rec * 3, 10 + land));
      const rh = 11.6 * S;
      const flat = { x: Math.cos(hy), y: Math.sin(hy), z: 0 };
      const hf = M.norm(M.add(flat, { x: 0, y: 0, z: 0.3 * rec + 0.14 * wind + 0.25 * leap - 0.45 * slump }));
      const hs = { x: -flat.y, y: flat.x, z: 0 };
      const hu = M.norm(M.cross(hf, hs));

      // o rabo de anéis: deitado atrás correndo; sentado, desce até o chão e enrola do lado; no preparo, sobe em S
      // atrás do corpo; no tranco, arrepia
      const tail = [];
      const n = 18;
      const sway = Math.sin(t * 1.4 + this.seed * 9);
      const puff = 1 + 0.22 * rec + 0.12 * wind;
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        const wave = Math.sin(u * 3 - ph * (run > 0.2 ? 1 : 0) - t * 1.2) * 5 * u;
        const runA = -9 - 42 * u;
        const runZ = D(17 + bounce - 6 * u + 9 * u * u * u, 3.2);
        const sitA = -6 - 15 * u + 6 * Math.max(0, u - 0.7);
        const sitZ = u < 0.32 ? 11 - 25 * u : u < 0.78 ? 3 : 3 + (u - 0.78) * 46;
        const sitS = 20 * u * u + sway * 3 * u;
        // em pé no preparo: sobe atrás do corpo e a ponta enrola
        const upA = -10 - 12 * u + 10 * u * u;
        const upZ = 12 + 46 * u - 10 * u * u;
        const upS = 8 * Math.sin(u * 3.4) + 3 * Math.sin(t * 9) * u * hold;
        const raise = Math.max(M.smoothstep(0, 1, wind) * 0.85, leap * 0.7) * (1 - slump);
        let a = L(runA, sitA), s = L(wave, sitS), zz = L(runZ, sitZ);
        a = M.lerp(a, upA, raise);
        s = M.lerp(s, upS, raise);
        zz = M.lerp(zz, upZ, raise);
        tail.push({ c: at(a, s, Math.max(2.6, zz)), r: (4.5 - 1.5 * u - (u > 0.9 ? (u - 0.9) * 14 : 0)) * S * puff });
      }

      // pernas de trás: coxa grossa, joelho para a frente; sentado, os joelhos ficam erguidos na frente
      const legs = [];
      for (const sg of [-1, 1]) {
        const pf = ph + Math.PI + (sg > 0 ? 0.35 : 0);
        const footRun = [D(-12 - 8 * Math.cos(pf) * run, -18), D(6.5, 9) * sg, D(Math.max(0, Math.sin(pf)) * 7 * run, 1)];
        const footSit = [10 - 2 * rec - 14 * leap, 7 * sg, 1 + 2 * rec + 4 * leap];
        const hipJ = M.add(hipF, M.scale(side, 6 * S * sg));
        const foot = at(L(footRun[0], footSit[0]), L(footRun[1], footSit[1]), L(footRun[2], footSit[2]));
        const bone = M.lerp(11, 8.5, up) * S;
        const knee = bend(hipJ, foot, bone, bone, M.add(fwd, { x: 0, y: 0, z: 0.5 }));
        const toe = M.add(foot, M.add(M.scale(fwd, 3.6 * S), { x: 0, y: 0, z: -0.6 * S }));
        legs.push({ pts: [hipJ, M.lerp3(hipJ, knee, 0.5), knee, M.lerp3(knee, foot, 0.55), foot], knee, foot, toe });
      }

      // braços: de quatro, as mãos no chão; sentado, na frente da barriga; no golpe, o direito ergue a fruta
      const arms = [];
      let fruitAt = null;
      for (const sg of [-1, 1]) {
        const pf = ph + (sg > 0 ? 0.3 : 0);
        const handRun = [D(11 - 7 * Math.cos(pf) * run, 20), D(5, 9) * sg, D(Math.max(0, Math.sin(pf)) * 6 * run, 1.5)];
        const fid = Math.sin(t * 3 + sg) * 0.8;
        let handSit = [8 + fid, 4.5 * sg, 20 + breath];
        const thrower = sg > 0;
        if (thrower && armK > 0.001) {
          // preparo: bem alto, por cima do ombro, do lado da cabeça (de frente, a fruta aparece: é o aviso); arremesso:
          // passa por cima e termina na frente; depois volta para a barriga
          const back = [-6, 15, 62];
          const over = [4, 8, 66];
          const front = [21, 3, 32];
          let p = back;
          if (throwing) {
            const k = M.easeOut(thr);
            const a = k < 0.5 ? back : over;
            const b = k < 0.5 ? over : front;
            const kk = k < 0.5 ? k * 2 : (k - 0.5) * 2;
            p = [a[0] + (b[0] - a[0]) * kk, a[1] + (b[1] - a[1]) * kk, a[2] + (b[2] - a[2]) * kk];
          } else p = [back[0] - 2 * hold, back[1], back[2] + 2 * hold];
          handSit = handSit.map((v, i) => v + (p[i] - v) * armK);
        } else if (!thrower && wind > 0) {
          // o outro braço aponta para a frente, de mira
          handSit = [handSit[0] + 11 * wind, -5 - 1 * wind, handSit[2] + 13 * wind];
        }
        if (rec > 0) handSit = [handSit[0] - 3 * rec, handSit[1] + 2 * sg * rec, handSit[2] + 9 * rec]; // as mãos sobem no susto
        if (leap > 0) handSit = [handSit[0] + 6 * leap, handSit[1] + 3 * sg * leap, handSit[2] + 26 * leap]; // no pulo, as mãos para cima
        const sh = M.add(chestF, M.add(M.scale(side, 5.5 * S * sg), { x: 0, y: 0, z: -1.5 * S }));
        const hand = at(L(handRun[0], handSit[0]) + lean * up, L(handRun[1], handSit[1]), L(handRun[2], handSit[2]) - rec * 0.5);
        const elbow = bend(sh, hand, 8.6 * S, 8.6 * S, M.add(M.scale(fwd, -1), M.add(M.scale(side, 0.7 * sg), { x: 0, y: 0, z: -0.4 })));
        arms.push({ sg, pts: [sh, M.lerp3(sh, elbow, 0.5), elbow, M.lerp3(elbow, hand, 0.5), hand], elbow, hand });
        if (thrower && act && (act.kind === 'windup' || (act.kind === 'shoot' && act.t < 0.07))) fruitAt = hand;
      }
      return { hipF, chestF, headC, rh, hf, hs, hu, tail, tailHidden: null, legs, arms, fruitAt, fwd, side, upV: WORLD_UP, belly: up, puff, branch: null };
    }

    /**
     * Pendurado no galho, de cabeça para baixo: o rabo dá uma volta no galho (a parte de trás do galho não é
     * desenhada — o galho do [mundo] aparece ali), as pernas ficam soltas dos lados, o corpo balança como um pêndulo e
     * a cabeça, embaixo, olha para quem ela vê. No preparo, balança para trás com a fruta; no arremesso, vem para a
     * frente jogando. `release` (0..1): soltando o rabo para descer; `at` ({x, y}): o pé embaixo do galho, quando não é
     * o de agora (descendo, o servidor já pode ter posto o pé em outra casa).
     */
    _hangRig(st, h, byaw, release = 0, at = null) {
      const { t, act, armK, throwing, wind, hold, thr, rec } = st;
      const fwd = this._fwd();
      const side = this._side();
      // + = a cabeça para a frente (o `M.rotate` em volta do lado gira para trás com o ângulo positivo)
      const sw = this.swing + M.easeIn(release) * 0.9;
      const rot = (v) => M.rotate(v, side, -sw);
      const dn = rot({ x: 0, y: 0, z: -1 });
      const fw = rot(fwd);
      // de cabeça para baixo o corpo rolou meia volta em volta da frente: a direita dele fica do outro lado
      const sd = M.scale(side, -1);
      const shake = hold > 0.72 ? Math.sin(t * 70) * 0.8 * (hold - 0.72) / 0.28 : 0;
      const G = { x: at ? at.x : this.pos.x, y: at ? at.y : this.pos.y, z: this.groundZ + h };
      const P = (a, s, d) => M.add(G, M.add(M.scale(fw, a * S), M.add(M.scale(sd, (s + shake) * S), M.scale(dn, d * S))));
      const breath = Math.sin(t * 2.4 + this.seed * 6) * 0.6;
      // o corpo fica uns 35 cm abaixo do galho: o rabo aparece subindo até ele e dando a volta
      const hipF = P(-1.5, 0, 22);
      const chestF = P(1, 0, 39 + breath * 0.5);
      const headC = P(4 + 3 * rec, 0, 54 + breath * 0.7);
      const rh = 11.6 * S;
      // a cabeça olha para a frente e um pouco para o chão (para quem está embaixo), virando de leve
      const look = (M.noise1(t * 0.35 + this.seed * 20) - 0.5) * 1.0 * (1 - wind) * (1 - rec);
      const flatF = rot({ x: Math.cos(this.yaw + look), y: Math.sin(this.yaw + look), z: 0 });
      const hf = M.norm(M.add(flatF, M.scale(dn, 0.35 - 0.25 * rec)));
      const hu = M.norm(M.sub(dn, M.scale(hf, M.dot(dn, hf))));
      const hs = M.cross(hu, hf);

      // o rabo: sobe do quadril até o galho, dá uma volta nele e a ponta fica pendurada do outro lado
      const bd = { x: Math.cos(byaw), y: Math.sin(byaw), z: 0 };
      // o lado do galho de onde o rabo vem: o de trás do corpo (o rabo sai das costas). Pela frente de verdade (sem o
      // balanço) e com folga, guardada: pelo quadril de agora, o vaivém fazia a volta do rabo pular de lado no galho
      const perp = { x: -bd.y, y: bd.x, z: 0 };
      const behind = -M.dot(perp, fwd);
      if (behind > 0.25 || (!this.tailSide && behind >= 0)) this.tailSide = 1;
      else if (behind < -0.25 || !this.tailSide) this.tailSide = -1;
      const across = M.scale(perp, this.tailSide);
      const R = 9; // cm: o raio da volta (o galho, uns 5 cm, mais a grossura do rabo)
      const puff = 1 + 0.22 * rec + 0.12 * wind;
      const tail = [];
      const hidden = [];
      const base = P(-4, 0, 17);
      const n = 18;
      const unravel = M.easeIn(release); // soltando: a volta abre
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        let c;
        if (k <= 4) {
          // do quadril até a beira do galho (do lado do corpo, embaixo)
          const g0 = M.add(G, M.add(M.scale(across, R * 0.7), { x: 0, y: 0, z: -R * 0.7 }));
          c = M.lerp3(base, g0, k / 4);
        } else if (k <= 13) {
          // a volta no galho: por baixo, pelo lado de lá, por cima e de volta para cá, andando um pouco no galho
          const v = (k - 4) / 9;
          const a = -Math.PI * 0.75 + v * M.TAU * (1 - 0.7 * unravel);
          const r = R * (1 + 1.5 * unravel * v);
          c = M.add(G, M.add(M.scale(across, Math.cos(a) * r), M.add({ x: 0, y: 0, z: Math.sin(a) * r }, M.scale(bd, (v - 0.5) * 12))));
        } else {
          // a ponta: pendura do galho e enrola
          const v = (k - 13) / 5;
          const swayT = Math.sin(t * 1.6 + this.seed * 4) * 3;
          c = M.add(G, M.add(M.scale(across, -R * 0.8 + swayT * v), M.add({ x: 0, y: 0, z: -R * 0.4 - 26 * v + 10 * v * v }, M.scale(bd, 6 + 4 * v))));
        }
        tail.push({ c, r: (4.2 - 1.2 * u - (u > 0.9 ? (u - 0.9) * 14 : 0)) * S * 0.86 * puff });
        hidden.push(k > 4 && k <= 13 ? 'loop' : null);
      }

      // as pernas: soltas dos lados do corpo, dobradas (quem segura é o rabo), mexendo um pouco no balanço
      const legs = [];
      for (const sg of [-1, 1]) {
        const hipJ = M.add(hipF, M.scale(sd, 6 * S * sg));
        const kick = Math.sin(t * 2.1 + sg + this.seed * 3) * 1.5;
        const foot = P(2 + kick, (12 + 4 * rec) * sg, 33 - 2 * release);
        const bone = 8.5 * S;
        const knee = bend(hipJ, foot, bone, bone, M.add(M.scale(sd, 0.8 * sg), M.add(M.scale(fw, 0.4), M.scale(dn, -0.5))));
        const toe = M.add(foot, M.scale(dn, 3 * S));
        legs.push({ pts: [hipJ, M.lerp3(hipJ, knee, 0.5), knee, M.lerp3(knee, foot, 0.55), foot], knee, foot, toe });
      }

      // os braços: soltos para baixo, balançando; no preparo, o da fruta vai para trás e o outro aponta; no
      // arremesso, o da fruta vem por baixo e solta na frente; no susto, abrem
      const arms = [];
      let fruitAt = null;
      for (const sg of [-1, 1]) {
        const thrower = sg > 0;
        const dangle = Math.sin(t * 1.7 + this.seed * 5 + sg) * 2;
        let p = [3 + dangle - 6 * this.swing, 11 * sg, 64];
        if (thrower && armK > 0.001) {
          // preparo: a fruta para o lado e para trás (de frente, ela aparece do lado do corpo); arremesso: passa por
          // baixo e solta na frente, junto com o balanço
          const back = [-7, 18, 52];
          const low = [3, 10, 70];
          const front = [22, 4, 60];
          let q = [back[0] - 3 * hold, back[1], back[2] - 2 * hold];
          if (throwing) {
            const k = M.easeOut(thr);
            const a = k < 0.5 ? back : low;
            const b = k < 0.5 ? low : front;
            const kk = k < 0.5 ? k * 2 : (k - 0.5) * 2;
            q = [a[0] + (b[0] - a[0]) * kk, a[1] + (b[1] - a[1]) * kk, a[2] + (b[2] - a[2]) * kk];
          }
          p = p.map((v, i) => v + (q[i] - v) * armK);
        } else if (!thrower && wind > 0) {
          p = [p[0] + 12 * wind, p[1] - 2 * wind, p[2] - 5 * wind]; // aponta para a frente, de mira
        }
        if (rec > 0) p = [p[0] - 4 * rec, p[1] + 7 * sg * rec, p[2] - 14 * rec]; // abre os braços no susto
        if (release > 0) p = [p[0] + 6 * release, p[1] + 4 * sg * release, p[2] - 8 * release];
        const sh = M.add(chestF, M.add(M.scale(sd, 5.5 * S * sg), M.scale(dn, 1.5 * S)));
        const hand = P(p[0], p[1], p[2]);
        const elbow = bend(sh, hand, 8.6 * S, 8.6 * S, M.add(M.scale(fw, -1), M.scale(sd, 0.7 * sg)));
        arms.push({ sg, pts: [sh, M.lerp3(sh, elbow, 0.5), elbow, M.lerp3(elbow, hand, 0.5), hand], elbow, hand });
        if (thrower && act && (act.kind === 'windup' || (act.kind === 'shoot' && act.t < 0.07))) fruitAt = hand;
      }
      // (`upV`: o "para cima" do corpo — o do chão, que rolou meia volta)
      return { hipF, chestF, headC, rh, hf, hs, hu, tail, tailHidden: hidden, legs, arms, fruitAt, fwd: fw, side: sd, upV: dn, belly: 1, puff, branch: { G, bd, across, R } };
    }

    /**
     * A cambalhota entre o pulo e o galho (`v`: 0 = de pé, lá no alto do pulo; 1 = pendurado de cabeça para baixo). O
     * corpo pendurado gira meia volta de lado, em volta da frente (continua olhando para o mesmo lado), com a cabeça
     * passando pelo lado de fora do galho (longe do tronco), um pouco além do ponto e voltando (o peso). No começo, ele
     * se mistura com a pose do fim do pulo (até `v` = `blend`); o rabo já está preso no galho, saindo do quadril.
     * Subindo, `v` vai de 0 a 1; descendo, de 1 a 0 (mais depressa: a mistura fica mais longa), com `release` soltando
     * o rabo.
     */
    _flipRig(st, h, byaw, v, release, at, blend = 0.3) {
      const H = this._hangRig(st, h, byaw, release, at);
      const A = this._groundRig(st);
      const axis = this._fwd();
      const way = M.dot(this._side(), H.branch.bd) >= 0 ? -1 : 1;
      const c = M.lerp3(H.hipF, H.chestF, 0.5);
      // de pé, o corpo fica um pouco mais baixo (a cabeça embaixo do galho, não atravessando ele)
      const drop = { x: 0, y: 0, z: -9 * S };
      const B = this._turnRig(H, axis, c, Math.PI, drop);
      const w = M.smoothstep(0, blend, v);
      const U = this._mixRig(A, B, w);
      const s = v < 0.75 ? 1.1 * M.easeInOut(v / 0.75) : 1.1 - 0.1 * M.easeInOut((v - 0.75) / 0.25);
      const pivot = M.add(c, drop);
      const ang = way * s * Math.PI;
      const lift = M.scale(drop, -Math.min(1, s));
      const R = this._turnRig(U, axis, pivot, ang, lift);
      // o rabo: do pulo (erguido atrás do corpo, girando junto) para o preso no galho (do quadril até a volta)
      const turn = (p) => M.add(M.add(pivot, M.rotate(M.sub(p, pivot), axis, ang)), lift);
      const base = R.tail[0].c;
      const g0 = H.tail[4].c;
      R.tail = H.tail.map((b, k) => {
        const held = k <= 4 ? M.lerp3(base, g0, k / 4) : b.c;
        return { c: M.lerp3(turn(A.tail[k].c), held, w), r: M.lerp(A.tail[k].r, b.r, w) };
      });
      R.tailHidden = w > 0.85 ? H.tailHidden : null;
      R.branch = H.branch;
      return R;
    }

    /** O esqueleto inteiro (pontos e direções) girado em volta de `axis` passando por `pivot`, e depois arrastado. */
    _turnRig(rig, axis, pivot, a, move) {
      const D = (d) => M.rotate(d, axis, a);
      const Q = (p) => M.add(M.add(pivot, D(M.sub(p, pivot))), move);
      return {
        ...rig,
        hipF: Q(rig.hipF),
        chestF: Q(rig.chestF),
        headC: Q(rig.headC),
        hf: D(rig.hf),
        hs: D(rig.hs),
        hu: D(rig.hu),
        fwd: D(rig.fwd),
        side: D(rig.side),
        upV: D(rig.upV),
        tail: rig.tail.map((b) => ({ c: Q(b.c), r: b.r })),
        legs: rig.legs.map((l) => ({ pts: l.pts.map(Q), knee: Q(l.knee), foot: Q(l.foot), toe: Q(l.toe) })),
        arms: rig.arms.map((l) => ({ sg: l.sg, pts: l.pts.map(Q), elbow: Q(l.elbow), hand: Q(l.hand) })),
        fruitAt: rig.fruitAt ? Q(rig.fruitAt) : null,
      };
    }

    /** A mistura de dois esqueletos do mesmo jeito (`w` 0 = o primeiro, 1 = o segundo), as direções renormalizadas. */
    _mixRig(a, b, w) {
      if (w <= 0) return a;
      if (w >= 1) return b;
      const L = (p, q) => M.lerp3(p, q, w);
      const N = (p, q) => M.norm(L(p, q), q);
      const pts = (pa, pb) => pa.map((p, i) => L(p, pb[i]));
      return {
        ...b,
        hipF: L(a.hipF, b.hipF),
        chestF: L(a.chestF, b.chestF),
        headC: L(a.headC, b.headC),
        rh: M.lerp(a.rh, b.rh, w),
        hf: N(a.hf, b.hf),
        hs: N(a.hs, b.hs),
        hu: N(a.hu, b.hu),
        fwd: N(a.fwd, b.fwd),
        side: N(a.side, b.side),
        upV: N(a.upV, b.upV),
        tail: a.tail.map((t, i) => ({ c: L(t.c, b.tail[i].c), r: M.lerp(t.r, b.tail[i].r, w) })),
        legs: a.legs.map((l, j) => {
          const m = b.legs[j];
          return { pts: pts(l.pts, m.pts), knee: L(l.knee, m.knee), foot: L(l.foot, m.foot), toe: L(l.toe, m.toe) };
        }),
        arms: a.arms.map((l, j) => {
          const m = b.arms[j];
          return { sg: l.sg, pts: pts(l.pts, m.pts), elbow: L(l.elbow, m.elbow), hand: L(l.hand, m.hand) };
        }),
        fruitAt: a.fruitAt && b.fruitAt ? L(a.fruitAt, b.fruitAt) : w < 0.5 ? a.fruitAt : b.fruitAt,
        belly: M.lerp(a.belly, b.belly, w),
        puff: M.lerp(a.puff, b.puff, w),
      };
    }

    /** As partes pintadas de um esqueleto (do chão ou do galho), cada uma com as bolas da sombra e o seu desenho. */
    _build(cam, rig, st) {
      const { t, wind, hold, rec, slump, throwing, thr, down } = st;
      const { hipF, chestF, headC, rh, hf, hs, hu } = rig;
      const z = cam.zoom;
      const ink = Math.max(1, 1.1 * z);
      const toCamH = M.norm({ x: cam.toCamera.x, y: cam.toCamera.y, z: 0 });
      const head = { c: headC, f: hf, s: hs, u: hu, r: rh };
      const H = (f, s, u) => M.add(headC, M.add(M.scale(hf, f * rh), M.add(M.scale(hs, s * rh), M.scale(hu, u * rh))));
      const groups = [];
      const self = this;

      // ---- o corpo: o casco das bolas do tronco com a beirada de pelo, a barriga e as faixas do lombo
      const torso = [];
      tube(hipF, chestF, 11 * S, 9.6 * S, null, torso);
      torso.push({ c: M.lerp3(hipF, chestF, 0.45), r: 11.6 * S });
      torso.push({ c: M.lerp3(chestF, headC, 0.32), r: 7.4 * S });
      groups.push({
        balls: torso,
        ref: M.lerp3(hipF, chestF, 0.5),
        body: true,
        paint(ctx, flash) {
          const disks = torso.map((b) => {
            const q = cam.p(b.c);
            return { x: q.x, y: q.y, r: b.r * z };
          });
          const hull = SH.circleHull(disks, 0.5);
          // o pelo penteado do peito para o quadril
          const fl = cam.pDir(M.sub(hipF, chestF));
          const fk = Math.hypot(fl.x, fl.y) || 1;
          const fur = P.furOutline(hull, small(z) ? 20 : 30, 4.2 * z, self.seed * 7, 0.5, { x: fl.x / fk, y: fl.y / fk });
          if (!fur) return;
          const smooth = padHull(disks, 6.8 * z);
          P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.fur, 5.5 * z, ink, flash, {
            inside: (c) => self._bodyMarks(c, cam, hipF, chestF, rig.belly, rig.fwd, rig.side, rig.upV, flash),
            light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
            lightPad: 6.8 * z,
          });
        },
      });

      // ---- o rabo de anéis
      const n = rig.tail.length - 1;
      groups.push({
        balls: rig.tail,
        ref: rig.branch ? rig.tail[4].c : rig.tail[Math.floor(n * 0.45)].c,
        bias: -1,
        paint(ctx, flash) {
          self._paintTail(ctx, cam, rig.tail, ink, flash, rig.tailHidden && rig.branch ? self._tailBehind(cam, rig) : null);
        },
      });

      // ---- as pernas de trás
      for (const L of rig.legs) {
        const rads = [5.6, 5.4, 3.6, 2.6, 2.2].map((r) => r * S);
        groups.push({
          balls: [{ c: L.knee, r: 4.4 * S }, { c: L.foot, r: 3 * S }, { c: L.toe, r: 2.6 * S }],
          ref: L.knee,
          paint(ctx, flash) {
            self._paintLimb(ctx, cam, L.pts, rads, [L.foot, L.toe], 2.5 * S, ink, flash);
          },
        });
      }

      // ---- os braços (o do lado da câmera, por cima)
      const nearSide = M.dot(rig.side, cam.toCamera) >= 0 ? 1 : -1;
      for (const A of rig.arms) {
        const rads = [3.4, 3.0, 2.5, 2.2, 2.0].map((r) => r * S);
        groups.push({
          balls: [{ c: A.elbow, r: 3.3 * S }, { c: A.hand, r: 2.7 * S }],
          ref: M.lerp3(A.elbow, A.hand, 0.6),
          bias: A.sg === nearSide ? 1.5 : 0,
          paint(ctx, flash) {
            self._paintLimb(ctx, cam, A.pts, rads, [A.hand], 2.3 * S, ink, flash);
          },
        });
      }

      // ---- a cabeça (com o rosto) e os tufos brancos dos lados: o de lá atrás dela; o de cá, de perfil, na frente
      const twitch = 1 + 0.08 * Math.max(0, Math.sin(t * 7 + this.seed * 30)) * (M.noise1(t * 0.8 + this.seed) > 0.65 ? 1 : 0);
      for (const sg of [-1, 1]) {
        const facing = M.dot(M.scale(hs, sg), toCamH);
        const front = facing > 0.3;
        groups.push({
          balls: [{ c: H(-0.25, 1.15 * sg, 0.45), r: 0.55 * rh }],
          ref: headC,
          bias: front ? 1.0 : 0.6,
          paint(ctx, flash) {
            self._paintTuft(ctx, cam, head, sg, twitch, rec, wind, slump, ink, flash);
          },
        });
      }
      groups.push({
        balls: [{ c: headC, r: rh }, { c: H(0.6, 0, -0.34), r: 0.42 * rh }],
        ref: headC,
        bias: 0.8,
        body: true,
        paint(ctx, flash) {
          self._paintHead(ctx, cam, head, H, { wind, hold, rec, slump, throwing, thr }, ink, flash);
        },
      });

      // ---- a fruta verde (a mesma cor da fruta que voa), brilhando cada vez mais enquanto ele segura
      if (rig.fruitAt) {
        // (de cabeça para baixo, ela fica embaixo da mão)
        const fz = M.add(rig.fruitAt, { x: 0, y: 0, z: (rig.branch ? -3.2 : 3.2) * S });
        groups.push({
          balls: [{ c: fz, r: 3.8 * S }],
          ref: fz,
          bias: 3,
          noShadow: true,
          paint(ctx, flash) {
            self._paintFruit(ctx, cam, fz, hold, ink, flash);
          },
        });
      }

      // ---- o encanto: os pontinhos da cabeça viram faíscas. No Capão, o brilho fica para trás quando o sagui corre.
      const heart = M.lerp3(chestF, headC, 0.55);
      const freed = this.freed;
      if (freed) freed.origin ??= heart;
      const after = (ctx) => {
        if (down === null) this._motes(ctx, cam, headC);
        else if (down < 0.7) this._release(ctx, cam, freed?.origin ?? heart, down);
      };
      // o nome: em cima da cabeça (no chão) ou do galho (pendurado)
      this.top = rig.branch ? rig.branch.G.z - this.groundZ + 14 * S : headC.z - this.groundZ + rh + 8 * S;
      const paint = (ctx, flash) => {
        ctx.save();
        for (const g of C.byDepth(cam, groups)) if (g.paint) g.paint(ctx, flash);
        ctx.restore();
      };
      const alpha = freed ? 1 - M.smoothstep(0.99, PACIFY_END, freed.t) : undefined;
      return { groups, after, paint, alpha };
    }

    /** Pendurado: os pontos do rabo que ficam atrás do galho (para quem olha) não são desenhados (o galho aparece). */
    _tailBehind(cam, rig) {
      const { G, bd } = rig.branch;
      const tc = cam.toCamera;
      return rig.tail.map((b, i) => {
        if (rig.tailHidden[i] !== 'loop') return false;
        // a distância até o eixo do galho, do lado de lá (contra a câmera)
        const d = M.sub(b.c, G);
        const onAxis = M.scale(bd, M.dot(d, bd));
        const radial = M.sub(d, onAxis);
        return M.dot(radial, tc) < -2;
      });
    }

    _fwd() {
      return { x: Math.cos(this.yaw), y: Math.sin(this.yaw), z: 0 };
    }
    _side() {
      return { x: -Math.sin(this.yaw), y: Math.cos(this.yaw), z: 0 };
    }
    /** Qual lado do corpo (+1 direita, -1 esquerda) está virado para a câmera. */
    _nearSide(cam) {
      const s = this._side();
      return s.x * cam.toCamera.x + s.y * cam.toCamera.y >= 0 ? 1 : -1;
    }

    /**
     * No corpo: a barriga cor de palha (sentado ou pendurado, de frente) e as faixas escuras atravessando o lombo.
     * `f`, `s` e `u`: a frente, o lado e o "para cima" do corpo (pendurado ou na cambalhota, eles giram junto).
     */
    _bodyMarks(ctx, cam, hip, chest, up, f, s, u, flash) {
      const d = M.norm(M.sub(chest, hip));
      if (up > 0.35) {
        const bc = M.add(M.lerp3(hip, chest, 0.42), M.scale(f, 9.8 * S));
        P.decal(ctx, cam, { c: bc, n: f, u: s, v: d, ru: 7.2 * S, rv: 10.5 * S, color: BELLY, minFacing: -0.05 }, flash);
      }
      // o lombo olha para cima de quatro e para trás sentado
      const n = M.norm(M.add(M.scale(f, -up), M.scale(u, 1 - up)), M.scale(f, -1));
      for (let k = 0; k < 5; k++) {
        const c0 = M.lerp3(hip, chest, 0.08 + k * 0.15);
        const c = M.add(c0, M.scale(n, 10.6 * S));
        P.decal(ctx, cam, { c, n, u: s, v: d, ru: 8.6 * S, rv: (1.7 - k * 0.15) * S, color: BAND, minFacing: 0.1 }, flash);
      }
    }

    /**
     * Um braço ou perna: o membro peludo que afina, da cor do corpo (sem risco na emenda com ele), e a mão ou o pé
     * escuro na ponta (`ends`: o pé vai do calcanhar aos dedos; a mão é uma bolinha).
     */
    _paintLimb(ctx, cam, pts3, rads3, ends, endR, ink, flash) {
      const z = cam.zoom;
      const pts = pts3.map((p) => cam.p(p));
      const shape = P.limbShape(pts, rads3.map((r) => r * z));
      // o número de mechas vem do comprimento de verdade (fixo), não do que aparece na tela
      let len3 = 0;
      for (let i = 1; i < pts3.length; i++) len3 += M.dist(pts3[i - 1], pts3[i]);
      const count = Math.max(4, Math.round((len3 * 2.2) / (6 * S)));
      const a = pts[0], b = pts[pts.length - 1];
      const fl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const fur = P.furOutline(shape.poly, count, 2.8 * z, this.seed * 9 + count, 0.5, { x: (b.x - a.x) / fl, y: (b.y - a.y) / fl }, 0.3, true);
      if (fur) {
        // (peça fina: só a sombra, sem o brilho e sem o risco dobrado — o desenho fica bem mais leve)
        const smooth = P.limbShape(pts, rads3.map((r) => r * z + 4.7 * z)).poly;
        P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.limb, small(z) ? 0 : rads3[1] * z * 0.6, ink, flash, {
          stroke: (dx, dy, p) => P.furTrace(fur, dx, dy, p, false),
          heavy: false,
          highlight: 0,
          light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
          lightPad: 4.7 * z,
        });
      }
      // a mão ou o pé: escuro
      const qs = ends.map((c) => cam.p(c));
      const r = endR * z;
      const trace = (dx, dy, p) => {
        if (qs.length > 1) {
          // o pé: um oval do calcanhar aos dedos
          const [h, t] = qs;
          const cx = (h.x + t.x) / 2 + dx, cy = (h.y + t.y) / 2 + dy;
          const ang = Math.atan2(t.y - h.y, t.x - h.x);
          const rx = Math.hypot(t.x - h.x, t.y - h.y) / 2 + r * 0.9;
          p.moveTo(cx + Math.cos(ang) * rx, cy + Math.sin(ang) * rx);
          p.ellipse(cx, cy, rx, r * 0.8, ang, 0, M.TAU);
          return p;
        }
        p.moveTo(qs[0].x + r + dx, qs[0].y + dy);
        p.arc(qs[0].x + dx, qs[0].y + dy, r, 0, M.TAU);
        return p;
      };
      P.paintLit(ctx, cam, trace, LOOK.hand, 0, ink, flash, { heavy: false });
    }

    /** O rabo: comprido, peludo, de anéis claros e escuros, afinando numa ponta de pincel. */
    _paintTail(ctx, cam, tail, ink, flash, behind = null) {
      const z = cam.zoom;
      const all = tail.map((b) => cam.p(b.c));
      // o comprimento ao longo do rabo inteiro (na tela), para os anéis ficarem no mesmo lugar em cada pedaço
      const accAll = [0];
      for (let i = 1; i < all.length; i++) accAll.push(accAll[i - 1] + Math.hypot(all[i].x - all[i - 1].x, all[i].y - all[i - 1].y));
      const totalAll = accAll[accAll.length - 1] || 1;
      // pendurado: os pedaços do rabo que passam atrás do galho não são desenhados (o galho aparece ali)
      const runs = [];
      if (!behind) runs.push([0, tail.length - 1]);
      else {
        let i0 = -1;
        for (let i = 0; i <= tail.length; i++) {
          const vis = i < tail.length && !behind[i];
          if (vis && i0 < 0) i0 = i;
          if (!vis && i0 >= 0) {
            if (i - 1 > i0) runs.push([i0, i - 1]);
            i0 = -1;
          }
        }
      }
      for (const [i0, i1] of runs) {
        const piece = tail.slice(i0, i1 + 1);
        const tip = i1 === tail.length - 1; // a ponta de verdade é redonda; o corte no galho, não
        const shape = P.limbShape(piece.map((b, k) => all[i0 + k]), piece.map((b) => b.r * z), tip);
        // penteado da base para a ponta
        const e0 = shape.pts[0], e1 = shape.pts[shape.pts.length - 1];
        const fl = Math.hypot(e1.x - e0.x, e1.y - e0.y) || 1;
        const share = (accAll[i1] - accAll[i0]) / totalAll; // as mechas, na proporção do pedaço
        const count = Math.max(6, Math.round((small(z) ? 22 : 32) * (runs.length > 1 ? share : 1)));
        const fur = P.furOutline(shape.poly, count, 3.4 * z, this.seed * 3 + 1 + i0, 0.55, { x: (e1.x - e0.x) / fl, y: (e1.y - e0.y) / fl }, 0.45);
        if (!fur) continue;
        const smooth = P.limbShape(shape.pts, shape.rads.map((r) => r + 5.8 * z), tip).poly;
        // os anéis, contados no pedaço (os pontos dele na tela); com o rabo em pedaços, a partir do começo do rabo
        // inteiro, para cada anel ficar no mesmo lugar
        const pts = shape.pts;
        const acc = [0];
        for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
        const local = acc[acc.length - 1] || 1;
        const total = runs.length === 1 ? local : totalAll;
        const from = runs.length === 1 ? 0 : accAll[i0];
        const RINGS = 13;
        const rings = (c) => {
          // cada anel escuro é um risco grosso atravessando o rabo, da largura do anel
          c.strokeStyle = C.tint(RING, flash);
          c.lineCap = 'butt';
          c.lineWidth = total / RINGS + 0.6;
          c.beginPath();
          for (let k = 1; k < RINGS; k += 2) {
            const sAt = ((k + 0.5) / RINGS) * total - from;
            if (sAt < -total / RINGS || sAt > local + total / RINGS) continue;
            let i = 1;
            while (i < pts.length - 1 && acc[i] < sAt) i++;
            const a = pts[i - 1], b = pts[i];
            const f = (sAt - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
            const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
            const dl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const nx = -(b.y - a.y) / dl, ny = (b.x - a.x) / dl;
            const w = (shape.rads[i] + 4 * z) * 1.4;
            c.moveTo(x - nx * w, y - ny * w);
            c.lineTo(x + nx * w, y + ny * w);
          }
          c.stroke();
          if (tip) {
            // a ponta escura
            const e = pts[pts.length - 1];
            c.fillStyle = C.tint(RING, flash);
            c.beginPath();
            c.arc(e.x, e.y, shape.rads[shape.rads.length - 1] + 3 * z, 0, M.TAU);
            c.fill();
          }
        };
        P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.tail, tail[3].r * z * 0.5, ink, flash, {
          inside: rings,
          light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
          lightPad: 5.8 * z,
        });
      }
    }

    /**
     * Um tufo branco em leque, saindo de perto da orelha para fora, para cima e para trás: as mechas pontudas num
     * contorno só (a cor cobre os riscos de dentro) e uns fios cinza no meio de cada uma.
     */
    _paintTuft(ctx, cam, head, sg, twitch, rec, wind, slump, ink, flash) {
      const { f, u, r } = head;
      const z = cam.zoom;
      const out = M.scale(head.s, sg);
      const back = M.scale(f, -1);
      // a orelha: do lado da cabeça, um pouco para trás e para cima
      const B = M.add(head.c, M.add(M.scale(f, -0.3 * r), M.add(M.scale(out, 0.74 * r), M.scale(u, 0.22 * r))));
      const puff = (1 + 0.25 * rec + 0.12 * wind - 0.15 * slump) * twitch;
      // os fios saem em cone em volta do "para fora", deitados para trás (desmaiado, caem); para a frente (o rosto), não
      const axis = M.norm(M.add(M.add(out, M.scale(back, 0.75)), M.scale(u, 0.22 - 0.7 * slump)));
      const e1 = M.norm(M.sub(u, M.scale(axis, M.dot(u, axis))));
      const e2 = M.norm(M.sub(back, M.add(M.scale(axis, M.dot(back, axis)), M.scale(e1, M.dot(back, e1)))));
      const circles = [{ c: B, r: 0.32 * r }];
      const N = 10;
      for (let i = 0; i < N; i++) {
        const phi = M.lerp(-0.9, 4.0, i / (N - 1)); // 0 = para cima, pi/2 = para trás, pi = para baixo
        const ring = M.add(M.scale(e1, Math.cos(phi)), M.scale(e2, Math.sin(phi)));
        const dir = M.norm(M.add(M.scale(axis, 0.62), M.scale(ring, 0.78)));
        const len = (0.5 + 0.24 * Math.max(0, Math.cos(phi - 0.9))) * r * puff; // mais compridos para cima e para trás
        circles.push({ c: M.add(B, M.scale(dir, len)), r: 0.08 * r });
      }
      circles.push({ c: M.add(B, M.scale(axis, 0.7 * r * puff)), r: 0.12 * r });
      const disks = circles.map((cc) => {
        const q = cam.p(cc.c);
        return { x: q.x, y: q.y, r: cc.r * z };
      });
      const hull = SH.circleHull(disks, 0.6);
      const b = cam.p(B);
      const flowP = cam.pDir(axis);
      const fl = Math.hypot(flowP.x, flowP.y) || 1;
      // a beirada: mechas compridas, a maioria pontuda, penteadas para fora e para trás (o tufo arrepiado)
      const fur = P.furOutline(hull, 11, 0.3 * r * z * puff, this.seed * 11 + sg, 0.55, { x: flowP.x / fl, y: flowP.y / fl }, 0.6);
      if (!fur) return;
      const pad = 0.47 * r * z * puff + 0.5 * z;
      const smooth = padHull(disks, pad);
      const tips = fur.T.filter((t) => t.sharp);
      const trace = (dx, dy, p) => P.furTrace(fur, dx, dy, p);
      P.paintLit(ctx, cam, trace, LOOK.tuft, small(z) ? 0 : 0.2 * r * z, ink, flash, {
        heavy: false,
        light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
        lightPad: pad,
        inside: (c) => {
          // os fios: do miolo para a ponta de cada mecha, cinza clarinho (só de perto)
          if (z < 1.2) return;
          c.strokeStyle = 'rgba(150, 140, 156, 0.55)';
          c.lineWidth = Math.max(0.6, 0.5 * z);
          c.lineCap = 'round';
          c.beginPath();
          for (const q of tips) {
            c.moveTo(b.x + (q.x - b.x) * 0.35, b.y + (q.y - b.y) * 0.35);
            c.quadraticCurveTo(b.x + (q.x - b.x) * 0.6 + (q.y - b.y) * 0.06, b.y + (q.y - b.y) * 0.6 - (q.x - b.x) * 0.06, b.x + (q.x - b.x) * 0.84, b.y + (q.y - b.y) * 0.84);
          }
          c.stroke();
        },
      });
    }

    /** A cabeça: o crânio, as bochechas e o focinho curto num contorno só, de pelo curto, e o rosto. */
    _paintHead(ctx, cam, head, H, st, ink, flash) {
      const z = cam.zoom;
      const r = head.r;
      const circles = [[head.c, 1], [H(0.16, -0.52, -0.3), 0.62], [H(0.16, 0.52, -0.3), 0.62], [H(0.6, 0, -0.34), 0.42]].map(([c, k]) => {
        const q = cam.p(c);
        return { x: q.x, y: q.y, r: k * r * z };
      });
      const hull = SH.circleHull(circles, 0.5);
      // o pelo da cabeça, curto, penteado do rosto para a nuca
      const fl = cam.pDir(M.scale(head.f, -1));
      const fk = Math.hypot(fl.x, fl.y);
      const fur = P.furOutline(hull, small(z) ? 16 : 22, 2.8 * z, this.seed * 5 + 2, 0.45, fk > 0.05 ? { x: fl.x / fk, y: fl.y / fk } : null, 0.3);
      if (!fur) return;
      const smooth = padHull(circles, 4.6 * z);
      const showFace = M.dot(head.f, cam.toCamera) > -0.35;
      P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.head, 0.3 * r * z, ink, flash, {
        light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
        lightPad: 4.6 * z,
        inside: (c) => {
          if (showFace) this._faceSkin(c, cam, head, st, flash);
        },
        after: (c) => {
          if (showFace) this._faceEyes(c, cam, head, st, flash);
        },
      });
    }

    /**
     * O rosto, por baixo da luz e da sombra: a máscara escura (em volta dos olhos e o focinho), a mancha branca da testa
     * e a boca (travessa: o sorriso de canto; no preparo, o sorrisão com os dentinhos).
     */
    _faceSkin(ctx, cam, head, st, flash) {
      const r = head.r;
      const on = (f, s, u, mirror, draw, minF) => P.onSurface(ctx, cam, head, f, s, u, mirror, draw, minF);
      const dark = C.tint(FACE, flash);
      // a máscara: um oval em volta de cada olho e a ponte entre eles
      for (const sg of [-1, 1]) {
        on(0.8, 0.36 * sg, 0.12, sg, () => {
          ctx.fillStyle = dark;
          ctx.beginPath();
          ctx.ellipse(0.02 * r, -0.02 * r, 0.4 * r, 0.36 * r, 0, 0, M.TAU);
          ctx.fill();
        }, -0.15);
      }
      on(0.9, 0, 0.02, 1, () => {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.3 * r, 0.34 * r, 0, 0, M.TAU);
        ctx.fill();
      }, -0.15);
      // o focinho (um tom acima, para a boca e o nariz lerem)
      on(0.88, 0, -0.36, 1, () => {
        ctx.fillStyle = C.tint(MUZZLE, flash);
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.36 * r, 0.27 * r, 0, 0, M.TAU);
        ctx.fill();
      }, -0.15);
      // a mancha branca da testa (o "brasão" do sagui-de-tufo-branco), logo acima dos olhos
      on(0.7, 0, 0.62, 1, () => {
        ctx.fillStyle = C.tint(BLAZE, flash);
        ctx.beginPath();
        ctx.moveTo(-0.2 * r, 0.12 * r);
        ctx.quadraticCurveTo(0, 0.22 * r, 0.2 * r, 0.12 * r);
        ctx.quadraticCurveTo(0.1 * r, -0.1 * r, 0, -0.2 * r);
        ctx.quadraticCurveTo(-0.1 * r, -0.1 * r, -0.2 * r, 0.12 * r);
        ctx.fill();
      }, -0.1);
      // a boca
      const z = cam.zoom;
      const thin = (px) => px / z;
      on(0.93, 0, -0.44, 1, () => {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (this.dying !== null || st.slump > 0.68) {
          // desmaiado: a boquinha mole, ondulada
          ctx.strokeStyle = LID;
          ctx.lineWidth = Math.max(thin(0.9), 0.04 * r);
          ctx.beginPath();
          ctx.moveTo(-0.14 * r, 0);
          ctx.quadraticCurveTo(-0.07 * r, 0.05 * r, 0, 0);
          ctx.quadraticCurveTo(0.07 * r, -0.05 * r, 0.14 * r, 0);
          ctx.stroke();
          return;
        }
        if (st.rec > 0.25) {
          // o "ui!": a boquinha redonda
          ctx.fillStyle = '#120a08';
          ctx.beginPath();
          ctx.ellipse(0, -0.02 * r, 0.08 * r, 0.1 * r, 0, 0, M.TAU);
          ctx.fill();
          return;
        }
        const grin = M.clamp01(st.wind * 1.2 + (st.throwing ? 1 - st.thr : 0));
        if (grin > 0.15) {
          // o sorrisão travesso, com os dentinhos
          const w = 0.2 * r + 0.06 * r * grin;
          ctx.fillStyle = '#4a1612';
          ctx.beginPath();
          ctx.moveTo(-w, 0.06 * r);
          ctx.quadraticCurveTo(0, 0.02 * r, w, 0.08 * r);
          ctx.quadraticCurveTo(0.02 * r, -0.2 * r * grin, -w, 0.06 * r);
          ctx.fill();
          ctx.fillStyle = '#fbf6ea';
          ctx.beginPath();
          ctx.moveTo(-w * 0.8, 0.055 * r);
          ctx.quadraticCurveTo(0, 0.025 * r, w * 0.8, 0.075 * r);
          ctx.lineTo(w * 0.7, 0.02 * r);
          ctx.quadraticCurveTo(0, -0.01 * r, -w * 0.7, 0.01 * r);
          ctx.closePath();
          ctx.fill();
          return;
        }
        // o sorriso de canto (travesso), um risco claro na cara escura
        ctx.strokeStyle = 'rgba(212, 186, 160, 0.85)';
        ctx.lineWidth = Math.max(thin(0.8), 0.035 * r);
        ctx.beginPath();
        ctx.moveTo(-0.15 * r, 0.01 * r);
        ctx.quadraticCurveTo(0.02 * r, -0.06 * r, 0.16 * r, 0.06 * r);
        ctx.stroke();
      }, -0.1);
      // o nariz: duas narinas claras (só de perto)
      if (z >= 1.15) {
        on(0.97, 0, -0.2, 1, () => {
          ctx.fillStyle = 'rgba(150, 120, 104, 0.9)';
          for (const x of [-0.06, 0.06]) {
            ctx.beginPath();
            ctx.ellipse(x * r, 0, 0.03 * r, 0.022 * r, 0, 0, M.TAU);
            ctx.fill();
          }
        }, 0);
      }
    }

    /**
     * Os olhos, por cima da luz: amarelos acesos (o encanto; de noite, vermelhos), redondos e grandes, com a pupila em
     * fenda e o pontinho de luz. No preparo, meio fechados e com a sobrancelha de quem apronta; no tranco, apertados
     * (">" "<"); desmaiado, fechados.
     */
    _faceEyes(ctx, cam, head, st, flash) {
      const r = head.r;
      const z = cam.zoom;
      const thin = (px) => px / z;
      const ew = 0.27 * r, eh = 0.26 * r;
      const color = this.freed ? '#735340' : (C.eyeColor?.(EYE) ?? EYE);
      const glow = C.eyeGlow ? C.eyeGlow(EYE_GLOW) : EYE_GLOW;
      const sly = M.clamp01(st.wind * 1.4); // o olhar travesso do preparo
      for (const sg of [-1, 1]) {
        P.onSurface(ctx, cam, head, 0.82, 0.36 * sg, 0.14, sg, () => {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (this.dying !== null || st.slump > 0.68) {
            ctx.strokeStyle = LID;
            ctx.lineWidth = Math.max(thin(1.1), 0.05 * r);
            ctx.beginPath();
            ctx.moveTo(-ew * 0.85, 0.05 * eh);
            ctx.quadraticCurveTo(0, -0.7 * eh, ew * 0.85, 0.05 * eh);
            ctx.stroke();
            return;
          }
          if (st.rec > 0.3) {
            // apertados: um ">" de cada lado, a ponta para o meio
            ctx.strokeStyle = LID;
            ctx.lineWidth = Math.max(thin(1.1), 0.055 * r);
            ctx.beginPath();
            ctx.moveTo(ew * 0.75, 0.5 * eh);
            ctx.lineTo(-ew * 0.55, 0);
            ctx.lineTo(ew * 0.75, -0.5 * eh);
            ctx.stroke();
            return;
          }
          // o brilho em volta (o encanto): duas rodelas transparentes (degradê a cada quadro pesava)
          if (!this.freed) {
            ctx.fillStyle = glow;
            ctx.globalAlpha *= 0.45;
            ctx.beginPath();
            ctx.arc(0, 0, ew * 1.75, 0, M.TAU);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, ew * 1.35, 0, M.TAU);
            ctx.fill();
            ctx.globalAlpha /= 0.45;
          }
          // a íris acesa: a cor, a borda mais escura e o miolo claro do lado da luz
          ctx.fillStyle = C.tint(M.shade(color, -0.3), flash);
          ctx.beginPath();
          ctx.ellipse(0, 0, ew, eh, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = C.tint(color, flash);
          ctx.beginPath();
          ctx.ellipse(-0.06 * ew, 0.06 * eh, ew * 0.8, eh * 0.8, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 249, 214, 0.75)';
          ctx.beginPath();
          ctx.ellipse(-0.22 * ew, 0.26 * eh, ew * 0.38, eh * 0.32, 0, 0, M.TAU);
          ctx.fill();
          // a pupila redonda (de macaco; a fenda era de gato), olhando um tiquinho para dentro
          ctx.fillStyle = '#1b100d';
          ctx.beginPath();
          ctx.arc(0.1 * ew, -0.04 * eh, 0.4 * ew, 0, M.TAU);
          ctx.fill();
          // a pálpebra de cima, descendo no olhar travesso (o pedaço de cima do olho, até uma corda inclinada)
          if (sly > 0.02) {
            const yIn = eh * (1 - 1.25 * sly), yOut = eh * (1 - 0.6 * sly); // o canto de dentro desce mais
            const xAt = (y) => ew * Math.sqrt(Math.max(0, 1 - (y / eh) * (y / eh)));
            ctx.fillStyle = FACE;
            ctx.beginPath();
            ctx.moveTo(-xAt(yIn), yIn);
            for (let k = 1; k < 8; k++) {
              const a = Math.PI - (k / 8) * Math.PI;
              ctx.lineTo(ew * 1.02 * Math.cos(a), eh * 1.02 * Math.sin(a));
            }
            ctx.lineTo(xAt(yOut), yOut);
            ctx.closePath();
            ctx.fill();
          }
          // o pontinho de luz (do lado da luz)
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-0.34 * ew * sg, 0.36 * eh, 0.2 * ew, 0, M.TAU);
          ctx.fill();
          // a borda escura e, no preparo, a sobrancelha de quem apronta (a ponta de dentro para baixo)
          ctx.strokeStyle = '#140c09';
          ctx.lineWidth = Math.max(thin(0.8), 0.04 * r);
          ctx.beginPath();
          ctx.ellipse(0, 0, ew, eh, 0, 0, M.TAU);
          ctx.stroke();
          if (sly > 0.05) {
            ctx.strokeStyle = 'rgba(214, 190, 160, 0.95)';
            ctx.lineWidth = Math.max(thin(1), 0.06 * r);
            ctx.beginPath();
            ctx.moveTo(ew * 0.95, eh * (1.25 + 0.15 * sly));
            ctx.lineTo(-ew * 0.9, eh * (1.25 - 0.4 * sly));
            ctx.stroke();
          }
        }, 0.02);
      }
    }

    /** A fruta: verde-clara, com o cabinho e a folha; segurando o golpe, brilha (pulsando) cada vez mais. */
    _paintFruit(ctx, cam, c, hold, ink, flash) {
      const z = cam.zoom;
      const q = cam.p(c);
      const r = 3.8 * S * z;
      if (hold > 0) {
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 14);
        const g = ctx.createRadialGradient(q.x, q.y, r * 0.5, q.x, q.y, r * (1.8 + 1.2 * hold));
        g.addColorStop(0, `rgba(220, 255, 140, ${(0.35 + 0.4 * hold) * pulse})`);
        g.addColorStop(1, 'rgba(220, 255, 140, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * (1.8 + 1.2 * hold), 0, M.TAU);
        ctx.fill();
      }
      P.paintLit(ctx, cam, (dx, dy, p) => {
        p.moveTo(q.x + r + dx, q.y + dy);
        p.arc(q.x + dx, q.y + dy, r, 0, M.TAU);
        return p;
      }, LOOK.fruit, r * 0.45, ink, flash, { heavy: false });
      // o cabinho e a folha
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = Math.max(1, 0.9 * z);
      ctx.beginPath();
      ctx.moveTo(q.x, q.y - r * 0.85);
      ctx.lineTo(q.x + r * 0.15, q.y - r * 1.35);
      ctx.stroke();
      ctx.fillStyle = '#5f9a2c';
      ctx.beginPath();
      ctx.moveTo(q.x + r * 0.12, q.y - r * 1.2);
      ctx.quadraticCurveTo(q.x + r * 0.75, q.y - r * 1.6, q.x + r * 0.95, q.y - r * 1.05);
      ctx.quadraticCurveTo(q.x + r * 0.5, q.y - r * 0.95, q.x + r * 0.12, q.y - r * 1.2);
      ctx.fill();
      ctx.stroke();
    }

    /** O encanto, de pé: dois pontinhos lilás rodando em volta da cabeça. */
    _motes(ctx, cam, headC) {
      const t = this.time;
      const z = cam.zoom;
      for (let k = 0; k < 2; k++) {
        const a = t * 1.7 + k * Math.PI + this.seed * 7;
        const rr = 17 * S;
        const p = cam.p(M.add(headC, { x: Math.cos(a) * rr, y: Math.sin(a) * rr, z: 6 * S + Math.sin(t * 2.3 + k * 2) * 4 * S }));
        const s = (2.2 + Math.sin(t * 5 + k * 3)) * z;
        ctx.save();
        ctx.globalAlpha *= 0.45 + 0.35 * Math.sin(t * 4 + k * 2.4);
        // o brilho: uma estrela maior transparente por trás (o desfoque da sombra pesava)
        ctx.fillStyle = 'rgba(207, 179, 255, 0.35)';
        star(ctx, p.x, p.y, s * 1.7);
        ctx.fill();
        ctx.fillStyle = MOTE;
        star(ctx, p.x, p.y, s);
        ctx.fill();
        ctx.restore();
      }
    }

    /**
     * O encanto sai do corpo: um clarão lilás e faíscas roxas que se espalham, sobem e somem em até 0,7 s.
     */
    _release(ctx, cam, heart, d) {
      const z = cam.zoom;
      const q = cam.p(heart);
      // o clarão
      if (d < 0.5) {
        const k = d / 0.5;
        const rr = (12 + 26 * M.easeOut(k)) * S * z;
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr);
        g.addColorStop(0, `rgba(214, 178, 255, ${0.55 * (1 - k)})`);
        g.addColorStop(1, 'rgba(180, 140, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rr, 0, M.TAU);
        ctx.fill();
      }
      // as faíscas
      const N = 14;
      ctx.save();
      const base = ctx.globalAlpha; // (o corpo já vem apagando: as faíscas apagam junto)
      for (let i = 0; i < N; i++) {
        const r1 = C.hash01(i * 3.1 + this.seed * 50), r2 = C.hash01(i * 7.7 + 1.3), r3 = C.hash01(i * 1.9 + 4.2);
        const t0 = 0.04 + r3 * 0.14;
        const k = (d - t0) / 0.5;
        if (k <= 0 || k >= 1) continue;
        const a = (i / N) * M.TAU + r1 * 0.7;
        const dist = (8 + 22 * r2) * S * M.easeOut(k);
        const rise = (10 + 42 * r1) * S * k;
        const p = cam.p({ x: heart.x + Math.cos(a) * dist, y: heart.y + Math.sin(a) * dist, z: heart.z + rise });
        const s = (2.2 + 1.8 * r2) * z * (1 - 0.55 * k);
        const alpha = k < 0.12 ? k / 0.12 : 1 - M.smoothstep(0.5, 1, k);
        ctx.globalAlpha = base * alpha;
        ctx.fillStyle = 'rgba(181, 140, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 2.2, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = SPARK;
        star(ctx, p.x, p.y, s);
        ctx.fill();
        ctx.fillStyle = '#f4ecff';
        star(ctx, p.x, p.y, s * 0.45);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  C.define('sagui', Sagui);
  PD.Sagui = Sagui;
})(window.PD = window.PD || {});
