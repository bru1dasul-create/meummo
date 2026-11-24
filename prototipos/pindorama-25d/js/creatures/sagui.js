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
  /**
   * As cores e o jeito de cada versão do sagui. O Comum (o Sagui Travesso de sempre) usa estas; as versões raras (no
   * fim do arquivo: o Corrompido e o Ancestral) trocam a paleta e ganham enfeites próprios. `fur`, `sharp` e `tuft`:
   * o comprimento das mechas do corpo e do rabo (× o de sempre), quantas delas são pontudas e o comprimento dos tufos;
   * `sly` e `grin`: o mínimo da pálpebra baixa (a cara de bravo) e da boca aberta (o rosnado), mesmo parado.
   */
  const COMUM = {
    look: LOOK,
    band: BAND,
    ring: RING,
    belly: BELLY,
    face: FACE,
    muzzle: MUZZLE,
    blaze: BLAZE,
    lid: LID,
    eye: EYE,
    eyeGlow: EYE_GLOW,
    mote: MOTE,
    moteGlow: 'rgba(207, 179, 255, 0.35)',
    spark: SPARK,
    sparkGlow: 'rgba(181, 140, 255, 0.35)',
    sparkCore: '#f4ecff',
    burst: [214, 178, 255],
    burstEnd: 'rgba(180, 140, 255, 0)',
    fruitGlow: [220, 255, 140],
    leaf: '#5f9a2c',
    smile: 'rgba(212, 186, 160, 0.85)',
    brow: 'rgba(214, 190, 160, 0.95)',
    tuftHair: 'rgba(150, 140, 156, 0.55)',
    fur: 1,
    sharp: 0.38,
    tuft: 1,
    sly: 0,
    grin: 0,
    fangs: false,
    pupil: true,
  };

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
      /** As cores e o jeito da versão (veja COMUM) e o tamanho do desenho (× o do Comum; veja `drawable`). */
      this.pal = COMUM;
      this.size = 1;
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

    /**
     * As versões maiores (o Corrompido e o Ancestral): o desenho inteiro cresce `size` vezes em volta de onde o bicho
     * se apoia — o pé no chão ou o galho, pendurado (o rabo continua enrolado nele) —, e a sombra em volta da sombra
     * desse ponto no chão. As caixas (o clique, as copas, o contorno dos Olhos de Gavião) crescem junto.
     */
    drawable(cam, primary) {
      const d = super.drawable(cam, primary);
      const k = this.size;
      if (k === 1) return d;
      const h = this.perchHeight();
      const L = cam.light;
      const a = cam.p({ x: this.pos.x, y: this.pos.y, z: this.groundZ + h });
      const s = cam.p({ x: this.pos.x - (L.x / L.z) * h, y: this.pos.y - (L.y / L.z) * h, z: this.groundZ });
      const grow = (paint, o) => (ctx) => {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.scale(k, k);
        ctx.translate(-o.x, -o.y);
        paint(ctx);
        ctx.restore();
      };
      const box = (b) => (b ? { x0: a.x + (b.x0 - a.x) * k, y0: a.y + (b.y0 - a.y) * k, x1: a.x + (b.x1 - a.x) * k, y1: a.y + (b.y1 - a.y) * k } : b);
      return { ...d, bounds: box(d.bounds), body: box(d.body), draw: grow(d.draw, a), drawShadow: grow(d.drawShadow, s) };
    }

    /** A altura do meio do corpo (cm, do chão): pendurado, embaixo do galho; no chão, sentado (para a luz própria). */
    _bodyZ() {
      const h = this.perchHeight();
      const k = this.size;
      return h > 0 ? Math.max(30, h - 40 * S * k) : 28 * S * k;
    }

    /** Quanto a luz própria ainda acende (1 de pé; desmaiado, apaga antes do corpo sumir). */
    _lightLeft() {
      return this.dying === null ? 1 : 1 - M.smoothstep(0.05, 0.45, this.dying);
    }

    animate(dt) {
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
        dying,
        // desmaio: despenca de bruços em 0,26 s, quica de leve no chão, braços para a frente e o rabo largado
        slump: dying === null ? 0 : M.easeIn(M.clamp01(dying / 0.26)),
        land: dying === null ? 0 : Math.max(0, Math.sin(M.clamp01((dying - 0.26) / 0.16) * Math.PI)) * 2.5,
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
      } else if (this.fallFrom > 0 && st.dying !== null) {
        const u = M.clamp01(st.dying / 0.24);
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
      const { t, wind, hold, rec, slump, throwing, thr, dying } = st;
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
          const pal = self.pal;
          const fur = P.furOutline(hull, small(z) ? 20 : 30, 4.2 * z * pal.fur, self.seed * 7, 0.5, { x: fl.x / fk, y: fl.y / fk }, pal.sharp);
          if (!fur) return;
          const smooth = padHull(disks, 6.8 * z * pal.fur);
          P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), pal.look.fur, 5.5 * z, ink, flash, {
            inside: (c) => {
              self._bodyMarks(c, cam, hipF, chestF, rig.belly, rig.fwd, rig.side, rig.upV, flash);
              // (as versões raras: o que mais fica na pele, por baixo da luz e da sombra — o musgo, o colar)
              if (self._bodyExtra) self._bodyExtra(c, cam, rig, flash);
            },
            light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
            lightPad: 6.8 * z * pal.fur,
            // (e o que brilha por cima da sombra: as fendas, as runas)
            after: self._bodyGlow ? (c) => self._bodyGlow(c, cam, rig, flash) : undefined,
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

      // ---- o encanto: dois pontinhos lilás rodando em volta da cabeça; desmaiado, ele sai do corpo em faíscas roxas
      const heart = M.lerp3(chestF, headC, 0.55);
      const after = (ctx) => {
        if (dying === null) this._motes(ctx, cam, headC, rig);
        else this._release(ctx, cam, heart, dying);
      };
      // o nome: em cima da cabeça (no chão) ou do galho (pendurado)
      this.top = rig.branch ? rig.branch.G.z - this.groundZ + 14 * S : headC.z - this.groundZ + rh + 8 * S;
      if (this.size !== 1) {
        // maior (veja `drawable`): cresce em volta de onde se apoia
        const h0 = this.perchHeight();
        this.top = h0 + (this.top - h0) * this.size;
      }
      const paint = (ctx, flash) => {
        ctx.save();
        for (const g of C.byDepth(cam, groups)) if (g.paint) g.paint(ctx, flash);
        ctx.restore();
      };
      return { groups, after, paint };
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
        P.decal(ctx, cam, { c: bc, n: f, u: s, v: d, ru: 7.2 * S, rv: 10.5 * S, color: this.pal.belly, minFacing: -0.05 }, flash);
      }
      // o lombo olha para cima de quatro e para trás sentado
      const n = M.norm(M.add(M.scale(f, -up), M.scale(u, 1 - up)), M.scale(f, -1));
      for (let k = 0; k < 5; k++) {
        const c0 = M.lerp3(hip, chest, 0.08 + k * 0.15);
        const c = M.add(c0, M.scale(n, 10.6 * S));
        P.decal(ctx, cam, { c, n, u: s, v: d, ru: 8.6 * S, rv: (1.7 - k * 0.15) * S, color: this.pal.band, minFacing: 0.1 }, flash);
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
        P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), this.pal.look.limb, small(z) ? 0 : rads3[1] * z * 0.6, ink, flash, {
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
      P.paintLit(ctx, cam, trace, this.pal.look.hand, 0, ink, flash, { heavy: false });
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
        const furK = this.pal.fur;
        const fur = P.furOutline(shape.poly, count, 3.4 * z * furK, this.seed * 3 + 1 + i0, 0.55, { x: (e1.x - e0.x) / fl, y: (e1.y - e0.y) / fl }, 0.45);
        if (!fur) continue;
        const smooth = P.limbShape(shape.pts, shape.rads.map((r) => r + 5.8 * z * furK), tip).poly;
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
          c.strokeStyle = C.tint(this.pal.ring, flash);
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
            c.fillStyle = C.tint(this.pal.ring, flash);
            c.beginPath();
            c.arc(e.x, e.y, shape.rads[shape.rads.length - 1] + 3 * z, 0, M.TAU);
            c.fill();
          }
        };
        // (as versões raras: o que brilha no rabo, por cima da sombra — a veia vermelha, as faixas douradas)
        const glow = this._tailGlow ? (c) => this._tailGlow(c, { pts, acc, total, from, local, rads: shape.rads, z, tip, rings: RINGS }, flash) : undefined;
        P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), this.pal.look.tail, tail[3].r * z * 0.5, ink, flash, {
          inside: rings,
          light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
          lightPad: 5.8 * z * furK,
          after: glow,
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
      const puff = (1 + 0.25 * rec + 0.12 * wind - 0.15 * slump) * twitch * this.pal.tuft;
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
      P.paintLit(ctx, cam, trace, this.pal.look.tuft, small(z) ? 0 : 0.2 * r * z, ink, flash, {
        heavy: false,
        light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
        lightPad: pad,
        inside: (c) => {
          // os fios: do miolo para a ponta de cada mecha, cinza clarinho (só de perto)
          if (z < 1.2) return;
          c.strokeStyle = this.pal.tuftHair;
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
      P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), this.pal.look.head, 0.3 * r * z, ink, flash, {
        light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
        lightPad: 4.6 * z,
        inside: (c) => {
          if (showFace) this._faceSkin(c, cam, head, st, flash);
        },
        after: (c) => {
          if (showFace) this._faceEyes(c, cam, head, st, flash);
          // (as versões raras: o que brilha no rosto — a fenda da testa, a runa)
          if (showFace && this._faceGlow) this._faceGlow(c, cam, head, st, flash);
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
      const pal = this.pal;
      const dark = C.tint(pal.face, flash);
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
        ctx.fillStyle = C.tint(pal.muzzle, flash);
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.36 * r, 0.27 * r, 0, 0, M.TAU);
        ctx.fill();
      }, -0.15);
      // a mancha branca da testa (o "brasão" do sagui-de-tufo-branco), logo acima dos olhos
      on(0.7, 0, 0.62, 1, () => {
        ctx.fillStyle = C.tint(pal.blaze, flash);
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
        if (this.dying !== null) {
          // desmaiado: a boquinha mole, ondulada
          ctx.strokeStyle = pal.lid;
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
        const grin = Math.max(pal.grin, M.clamp01(st.wind * 1.2 + (st.throwing ? 1 - st.thr : 0)));
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
          if (pal.fangs) {
            // as presas (o Corrompido): duas pontas compridas descendo dos cantos, do lábio de cima
            for (const sx of [-1, 1]) {
              ctx.beginPath();
              ctx.moveTo(sx * w * 0.66, 0.05 * r);
              ctx.lineTo(sx * w * 0.36, 0.035 * r);
              ctx.lineTo(sx * w * 0.52, (-0.06 - 0.1 * grin) * r);
              ctx.closePath();
              ctx.fill();
            }
          }
          return;
        }
        // o sorriso de canto (travesso), um risco claro na cara escura
        ctx.strokeStyle = pal.smile;
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
      const pal = this.pal;
      const color = C.eyeColor ? C.eyeColor(pal.eye) : pal.eye;
      const glow = C.eyeGlow ? C.eyeGlow(pal.eyeGlow) : pal.eyeGlow;
      const sly = Math.max(pal.sly, M.clamp01(st.wind * 1.4)); // o olhar travesso do preparo
      for (const sg of [-1, 1]) {
        P.onSurface(ctx, cam, head, 0.82, 0.36 * sg, 0.14, sg, () => {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (this.dying !== null) {
            ctx.strokeStyle = pal.lid;
            ctx.lineWidth = Math.max(thin(1.1), 0.05 * r);
            ctx.beginPath();
            ctx.moveTo(-ew * 0.85, 0.05 * eh);
            ctx.quadraticCurveTo(0, -0.7 * eh, ew * 0.85, 0.05 * eh);
            ctx.stroke();
            return;
          }
          if (st.rec > 0.3) {
            // apertados: um ">" de cada lado, a ponta para o meio
            ctx.strokeStyle = pal.lid;
            ctx.lineWidth = Math.max(thin(1.1), 0.055 * r);
            ctx.beginPath();
            ctx.moveTo(ew * 0.75, 0.5 * eh);
            ctx.lineTo(-ew * 0.55, 0);
            ctx.lineTo(ew * 0.75, -0.5 * eh);
            ctx.stroke();
            return;
          }
          // o brilho em volta (o encanto): duas rodelas transparentes (degradê a cada quadro pesava)
          ctx.fillStyle = glow;
          ctx.globalAlpha *= 0.45;
          ctx.beginPath();
          ctx.arc(0, 0, ew * 1.75, 0, M.TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 0, ew * 1.35, 0, M.TAU);
          ctx.fill();
          ctx.globalAlpha /= 0.45;
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
          // a pupila redonda (de macaco; a fenda era de gato), olhando um tiquinho para dentro (o Ancestral, de olho
          // de espírito, não tem: o miolo aceso)
          if (pal.pupil) {
            ctx.fillStyle = '#1b100d';
            ctx.beginPath();
            ctx.arc(0.1 * ew, -0.04 * eh, 0.4 * ew, 0, M.TAU);
            ctx.fill();
          } else {
            ctx.fillStyle = '#fffbea';
            ctx.beginPath();
            ctx.arc(0.04 * ew, -0.02 * eh, 0.44 * ew, 0, M.TAU);
            ctx.fill();
          }
          // a pálpebra de cima, descendo no olhar travesso (o pedaço de cima do olho, até uma corda inclinada)
          if (sly > 0.02) {
            const yIn = eh * (1 - 1.25 * sly), yOut = eh * (1 - 0.6 * sly); // o canto de dentro desce mais
            const xAt = (y) => ew * Math.sqrt(Math.max(0, 1 - (y / eh) * (y / eh)));
            ctx.fillStyle = pal.face;
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
            ctx.strokeStyle = pal.brow;
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
        const fg = this.pal.fruitGlow;
        const g = ctx.createRadialGradient(q.x, q.y, r * 0.5, q.x, q.y, r * (1.8 + 1.2 * hold));
        g.addColorStop(0, `rgba(${fg[0]}, ${fg[1]}, ${fg[2]}, ${(0.35 + 0.4 * hold) * pulse})`);
        g.addColorStop(1, `rgba(${fg[0]}, ${fg[1]}, ${fg[2]}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * (1.8 + 1.2 * hold), 0, M.TAU);
        ctx.fill();
      }
      P.paintLit(ctx, cam, (dx, dy, p) => {
        p.moveTo(q.x + r + dx, q.y + dy);
        p.arc(q.x + dx, q.y + dy, r, 0, M.TAU);
        return p;
      }, this.pal.look.fruit, r * 0.45, ink, flash, { heavy: false });
      // o cabinho e a folha
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = Math.max(1, 0.9 * z);
      ctx.beginPath();
      ctx.moveTo(q.x, q.y - r * 0.85);
      ctx.lineTo(q.x + r * 0.15, q.y - r * 1.35);
      ctx.stroke();
      ctx.fillStyle = this.pal.leaf;
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
        ctx.fillStyle = this.pal.moteGlow;
        star(ctx, p.x, p.y, s * 1.7);
        ctx.fill();
        ctx.fillStyle = this.pal.mote;
        star(ctx, p.x, p.y, s);
        ctx.fill();
        ctx.restore();
      }
    }

    /**
     * Desmaiado: o encanto sai do corpo — um clarão lilás no peito e as faíscas roxas que se espalham e sobem, sumindo
     * (o motor tira o desenho 0,7 s depois da queda; o corpo apaga de 0,4 a 0,7 s).
     */
    _release(ctx, cam, heart, d) {
      const z = cam.zoom;
      const q = cam.p(heart);
      const pal = this.pal;
      // o clarão
      if (d < 0.5) {
        const k = d / 0.5;
        const rr = (12 + 26 * M.easeOut(k)) * S * z;
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr);
        const b = pal.burst;
        g.addColorStop(0, `rgba(${b[0]}, ${b[1]}, ${b[2]}, ${0.55 * (1 - k)})`);
        g.addColorStop(1, pal.burstEnd);
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
        ctx.fillStyle = pal.sparkGlow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 2.2, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = pal.spark;
        star(ctx, p.x, p.y, s);
        ctx.fill();
        ctx.fillStyle = pal.sparkCore;
        star(ctx, p.x, p.y, s * 0.45);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ================================================================== as versões raras (prévia de 24/11, para o dono)
  // Na pegada das artes que o dono mandou ("Sagui Corrompido – Elite" e "Sagui Ancestral – Raro"): o mesmo sagui (o
  // corpo, os golpes e o galho são os do Comum), com outra paleta e enfeites. Ainda fora do jogo: o servidor não manda
  // esses tipos (as chaves daqui são provisórias; quem decide as de verdade, e os números, é a [estrutura]).

  /** O tronco por dentro (o mesmo das faixas do lombo): a espinha `d`, o lombo `n`, o lado `s` e um ponto na pele. */
  function torsoFrame(rig) {
    const { hipF, chestF } = rig;
    const up = rig.belly;
    const d = M.norm(M.sub(chestF, hipF));
    let n = M.norm(M.add(M.scale(rig.fwd, -up), M.scale(rig.upV, 1 - up)), M.scale(rig.fwd, -1));
    n = M.norm(M.sub(n, M.scale(d, M.dot(n, d))), n);
    const sd = rig.side;
    const s = M.norm(M.sub(sd, M.add(M.scale(d, M.dot(sd, d)), M.scale(n, M.dot(sd, n)))), sd);
    return {
      d,
      n,
      s,
      /** Na pele: `a` de 0 (o quadril) a 1 (o peito), `th` em volta (0 = o meio do lombo, + para a direita) e `out`
       *  cm para fora; com a direção para fora (`nrm`). */
      at(a, th, out = 0) {
        const c = M.lerp3(hipF, chestF, a);
        const nrm = M.add(M.scale(n, Math.cos(th)), M.scale(s, Math.sin(th)));
        const r = (11 - 1.4 * a + 1.2 * Math.sin(Math.PI * a)) * S + out;
        return { p: M.add(c, M.scale(nrm, r)), nrm };
      },
    };
  }

  /** O ponto a `s` px do começo de uma linha de pontos de tela (com o comprimento acumulado `acc`) e a normal. */
  function along(pts, acc, s) {
    let i = 1;
    while (i < pts.length - 1 && acc[i] < s) i++;
    const a = pts[i - 1], b = pts[i];
    const f = (s - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
    const dl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, nx: -(b.y - a.y) / dl, ny: (b.x - a.x) / dl, i };
  }

  /**
   * O brilho de uma linha (as fendas, as runas): a auréola larga e transparente, o meio aceso e o miolo claro (só de
   * perto, `core`). `w`: a grossura (px por unidade), `k`: o quanto acende (0..1). Sem save/restore (dentro do recorte
   * do corpo pintado custa caro): só a transparência é guardada e devolvida.
   */
  function glowStroke(ctx, path, w, k, g, core) {
    const a0 = ctx.globalAlpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = a0 * k;
    ctx.strokeStyle = g.halo;
    ctx.lineWidth = 4.2 * w;
    ctx.stroke(path);
    ctx.strokeStyle = g.mid;
    ctx.lineWidth = 1.9 * w;
    ctx.stroke(path);
    if (core) {
      ctx.strokeStyle = g.core;
      ctx.lineWidth = 0.75 * w;
      ctx.stroke(path);
    }
    ctx.globalAlpha = a0;
  }

  /** Uma espiral (a runa do Ancestral) no plano de `ex`, `ey` em volta de `c` (3D), na tela. */
  function spiralPath(cam, c, ex, ey, size, turn, path = new Path2D()) {
    const N = 22;
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      const ang = turn * u * 2.4 * Math.PI;
      const rr = size * (0.1 + 0.9 * u);
      const q = cam.p(M.add(c, M.add(M.scale(ex, Math.cos(ang) * rr), M.scale(ey, Math.sin(ang) * rr))));
      if (k === 0) path.moveTo(q.x, q.y);
      else path.lineTo(q.x, q.y);
    }
    return path;
  }

  // ------------------------------------------------------------------ o Sagui Corrompido (Elite)
  // A mata doente tomou o sagui: o pelo quase preto e arrepiado em pontas, fendas vermelhas acesas no corpo, no rabo e
  // na testa, os olhos vermelhos, a cara de bravo com as presas de fora, cogumelos crescendo nas costas, brasas subindo
  // e a fruta podre. Um pouco maior que o Comum.
  const SHADE_C = 'rgba(8, 2, 10, 0.5)';
  const LIGHT_C = 'rgba(255, 214, 214, 0.16)';
  const CORROMPIDO = {
    ...COMUM,
    look: {
      fur: { base: '#3b3238', shade: SHADE_C, light: LIGHT_C },
      limb: { base: '#342b31', shade: SHADE_C, light: LIGHT_C },
      head: { base: '#362d33', shade: SHADE_C, light: LIGHT_C },
      tuft: { base: '#7a6b72', shade: 'rgba(24, 8, 18, 0.42)', light: 'rgba(255, 226, 226, 0.32)' },
      tail: { base: '#4a3e45', shade: SHADE_C, light: LIGHT_C },
      hand: { base: '#1b1317', shade: 'rgba(6, 2, 4, 0.5)', light: 'rgba(255, 220, 220, 0.18)' },
      fruit: { base: '#5a2346', shade: 'rgba(20, 2, 14, 0.5)', light: 'rgba(255, 150, 170, 0.45)' },
    },
    band: '#2a2228',
    ring: '#17111a',
    belly: '#4a3c43',
    face: '#130d11',
    muzzle: '#271d23',
    blaze: '#3d3138',
    lid: '#a07c84',
    eye: '#ff4a2e',
    eyeGlow: 'rgba(255, 52, 28, 0.5)',
    mote: '#ff8a5a',
    moteGlow: 'rgba(255, 60, 30, 0.35)',
    spark: '#ff5a3a',
    sparkGlow: 'rgba(255, 70, 40, 0.38)',
    sparkCore: '#ffe2d2',
    burst: [255, 96, 64],
    burstEnd: 'rgba(200, 30, 20, 0)',
    fruitGlow: [255, 90, 70],
    leaf: '#4a4430',
    smile: 'rgba(196, 120, 120, 0.85)',
    brow: 'rgba(214, 84, 70, 0.95)',
    tuftHair: 'rgba(40, 22, 32, 0.5)',
    fur: 1.22,
    sharp: 0.55,
    tuft: 1.12,
    sly: 0.5,
    grin: 0.55,
    fangs: true,
    glow: { halo: 'rgba(255, 46, 24, 0.3)', mid: 'rgba(255, 92, 52, 0.85)', core: '#ffd6b0' },
  };
  /** As fendas no tronco: linhas quebradas de pontos [a, th] (veja `torsoFrame`); as curtas são os galhos. */
  const CRACKS = [
    [[0.1, 0.55], [0.22, 0.8], [0.31, 0.62], [0.44, 0.95], [0.55, 0.8], [0.68, 1.14], [0.8, 1.0]],
    [[0.31, 0.62], [0.37, 0.38], [0.47, 0.34]],
    [[0.15, -0.7], [0.27, -0.96], [0.4, -0.78], [0.52, -1.12], [0.66, -0.92], [0.82, -1.2]],
    [[0.4, -0.78], [0.47, -0.5], [0.58, -0.46]],
    [[0.58, -0.12], [0.67, 0.08], [0.76, -0.04], [0.88, 0.16]],
    // no peito (para quem olha de frente)
    [[0.28, 2.75], [0.38, 3.0], [0.5, 2.82], [0.62, 3.12], [0.74, 2.95]],
    [[0.5, 2.82], [0.56, 2.55]],
  ];
  /** Os cogumelos nas costas: [a, th, o comprimento do cabo, o raio do chapéu] (cm × S). */
  const SHROOMS = [
    [0.66, 0.42, 4.6, 4.2],
    [0.57, 0.8, 3.4, 3.0],
    [0.77, 0.14, 2.6, 2.3],
  ];
  const SHROOM_CAP = { base: '#6e1f2a', shade: 'rgba(30, 4, 12, 0.5)', light: 'rgba(255, 200, 190, 0.35)' };

  class SaguiCorrompido extends Sagui {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.pal = CORROMPIDO;
      this.size = 1.1;
      this.radius = 20 * S * this.size;
    }

    /** O quanto as fendas acendem agora (pulsando devagar). */
    _pulse() {
      return 0.74 + 0.26 * Math.sin(this.time * 3.1 + this.seed * 9);
    }

    /** O clarão do golpe pela metade: no pelo quase preto, o branco do Comum deixava o bicho inteiro cinza. */
    flash() {
      return super.flash() * 0.5;
    }

    /**
     * A luz própria: de noite, no escuro e na neblina (a Mata Profunda), a view abre um halo vermelho em volta dele,
     * pulsando junto com as fendas (senão a neblina e a noite apagavam o que mostra que ele é Elite).
     */
    light() {
      const lit = this._lightLeft();
      if (lit < 0.02) return null;
      return { x: this.pos.x, y: this.pos.y, z: this._bodyZ(), r: 130, color: '#ff4a2e', k: 0.9 * this._pulse() * lit };
    }

    _build(cam, rig, st) {
      const out = super._build(cam, rig, st);
      // os cogumelos: saem da pele, apontando para fora e um pouco para o alto do corpo
      const F = torsoFrame(rig);
      const shrooms = SHROOMS.map(([a, th, len, rc]) => {
        const { p, nrm } = F.at(a, th, -0.6 * S);
        const dir = M.norm(M.add(nrm, M.scale(rig.upV, 0.5)));
        return { base: p, top: M.add(p, M.scale(dir, len * S)), dir, rc: rc * S };
      });
      const self = this;
      out.groups.push({
        balls: shrooms.map((m) => ({ c: m.top, r: m.rc })),
        ref: shrooms[0].base,
        bias: 0.4,
        noShadow: true,
        paint(ctx, flash) {
          self._paintShrooms(ctx, cam, shrooms, flash);
        },
      });
      return out;
    }

    /** As fendas vermelhas acesas no tronco (só as do lado que a câmera vê). */
    _bodyGlow(ctx, cam, rig) {
      const F = torsoFrame(rig);
      const tc = cam.toCamera;
      const path = new Path2D();
      for (const crack of CRACKS) {
        let pen = false;
        for (const [a, th] of crack) {
          const { p, nrm } = F.at(a, th, 0.5 * S);
          if (M.dot(nrm, tc) < 0.06) {
            pen = false;
            continue;
          }
          const q = cam.p(p);
          if (pen) path.lineTo(q.x, q.y);
          else path.moveTo(q.x, q.y);
          pen = true;
        }
      }
      const z = cam.zoom;
      glowStroke(ctx, path, z, this._pulse(), this.pal.glow, z >= 0.85);
    }

    /** A veia vermelha acesa correndo pelo rabo, em zigue-zague. */
    _tailGlow(ctx, T) {
      const N = 18;
      const path = new Path2D();
      let pen = false;
      for (let k = 2; k <= N - 2; k++) {
        const sAt = (k / N) * T.total - T.from;
        if (sAt < 0 || sAt > T.local) {
          pen = false;
          continue;
        }
        const q = along(T.pts, T.acc, sAt);
        const off = (C.hash01(k * 5.3 + 2) - 0.5) * 1.1 * T.rads[q.i];
        if (pen) path.lineTo(q.x + q.nx * off, q.y + q.ny * off);
        else path.moveTo(q.x + q.nx * off, q.y + q.ny * off);
        pen = true;
      }
      glowStroke(ctx, path, T.z * 0.85, this._pulse(), this.pal.glow, T.z >= 0.85);
    }

    /** A fenda acesa na testa (no lugar da mancha branca do Comum). */
    _faceGlow(ctx, cam, head) {
      const r = head.r;
      const z = cam.zoom;
      const k = this._pulse();
      const g = this.pal.glow;
      P.onSurface(ctx, cam, head, 0.66, 0.05, 0.66, 1, () => {
        const path = new Path2D();
        path.moveTo(-0.05 * r, 0.3 * r);
        path.lineTo(0.04 * r, 0.15 * r);
        path.lineTo(-0.03 * r, 0.03 * r);
        path.lineTo(0.05 * r, -0.1 * r);
        path.moveTo(0.04 * r, 0.15 * r);
        path.lineTo(0.15 * r, 0.21 * r);
        glowStroke(ctx, path, 0.8, k, g, z >= 0.85);
      }, -0.1);
    }

    /** Os cogumelos das costas: o cabo claro e o chapéu vinho com as pintas vermelhas acesas (vendo por baixo, as
     *  lamelas claras). */
    _paintShrooms(ctx, cam, list, flash) {
      const z = cam.zoom;
      const ink = Math.max(1, 1.1 * z);
      const tc = cam.toCamera;
      const k = this._pulse();
      const order = list.slice().sort((a, b) => M.dot(a.top, tc) - M.dot(b.top, tc)); // os de trás primeiro
      for (const m of order) {
        const b = cam.p(m.base), t = cam.p(m.top);
        // o cabo
        ctx.lineCap = 'round';
        ctx.strokeStyle = C.INK;
        ctx.lineWidth = m.rc * 0.42 * z + ink * 2;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.strokeStyle = C.tint('#c9b7bd', flash);
        ctx.lineWidth = m.rc * 0.42 * z;
        ctx.stroke();
        // o chapéu: o casco da aba (o círculo em volta do alto do cabo) e da cúpula
        const e1 = M.norm(M.cross(m.dir, Math.abs(m.dir.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 }));
        const e2 = M.cross(m.dir, e1);
        const ring = (lift, rr) => {
          const out = [];
          for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * M.TAU;
            const q = cam.p(M.add(m.top, M.add(M.scale(m.dir, lift), M.add(M.scale(e1, Math.cos(ang) * rr), M.scale(e2, Math.sin(ang) * rr)))));
            out.push(q.x, q.y);
          }
          return out;
        };
        const rim = ring(0, m.rc);
        const apex = cam.p(M.add(m.top, M.scale(m.dir, m.rc * 0.62)));
        const hull = SH.convexHull(rim.concat(ring(m.rc * 0.45, m.rc * 0.72), [apex.x, apex.y]));
        P.paintLit(ctx, cam, (dx, dy, p) => SH.fillPath(hull, dx, dy, p), SHROOM_CAP, small(z) ? 0 : m.rc * z * 0.35, ink, flash, { heavy: false });
        if (M.dot(m.dir, tc) < -0.12) {
          ctx.fillStyle = C.tint('#d8c3b8', flash);
          ctx.fill(SH.fillPath(SH.convexHull(rim)));
        } else {
          // as pintas acesas na cúpula (as do lado da câmera)
          const a0 = ctx.globalAlpha;
          for (const ang of [0.5, 2.4, 4.3]) {
            const nrm = M.norm(M.add(M.scale(m.dir, 0.7), M.add(M.scale(e1, Math.cos(ang)), M.scale(e2, Math.sin(ang)))));
            if (M.dot(nrm, tc) < 0.1) continue;
            const q = cam.p(M.add(m.top, M.add(M.scale(m.dir, m.rc * 0.38), M.add(M.scale(e1, Math.cos(ang) * m.rc * 0.62), M.scale(e2, Math.sin(ang) * m.rc * 0.62)))));
            const rr = m.rc * 0.17 * z;
            ctx.globalAlpha = a0 * k;
            ctx.fillStyle = this.pal.glow.halo;
            ctx.beginPath();
            ctx.arc(q.x, q.y, rr * 2.4, 0, M.TAU);
            ctx.fill();
            ctx.globalAlpha = a0;
            ctx.fillStyle = '#ff8a5a';
            ctx.beginPath();
            ctx.arc(q.x, q.y, rr, 0, M.TAU);
            ctx.fill();
          }
        }
      }
    }

    /** O encanto corrompido: brasas vermelhas subindo das costas (no lugar dos pontinhos lilás do Comum). */
    _motes(ctx, cam, headC, rig) {
      if (!rig) return;
      const F = torsoFrame(rig);
      const t = this.time, z = cam.zoom;
      const a0 = ctx.globalAlpha;
      for (let i = 0; i < 6; i++) {
        const h1 = C.hash01(i * 4.7 + 1), h2 = C.hash01(i * 2.3 + 7), h3 = C.hash01(i * 9.1 + 3);
        const per = 1.4 + 0.9 * h3;
        const ph = ((((t + this.seed * 7) / per + h1) % 1) + 1) % 1;
        const { p } = F.at(0.2 + 0.62 * h2, (h3 - 0.5) * 2.4, 1.5 * S);
        const q = cam.p({ x: p.x + Math.sin(ph * 6.3 + i) * 3 * S, y: p.y + Math.cos(ph * 5.1 + i) * 3 * S, z: p.z + ph * 30 * S });
        const s = (1.0 + 0.8 * h1) * z * (1 - 0.45 * ph);
        ctx.globalAlpha = a0 * Math.sin(ph * Math.PI);
        ctx.fillStyle = this.pal.moteGlow;
        ctx.beginPath();
        ctx.arc(q.x, q.y, s * 2.6, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = this.pal.mote;
        ctx.beginPath();
        ctx.arc(q.x, q.y, s, 0, M.TAU);
        ctx.fill();
      }
      ctx.globalAlpha = a0;
    }
  }

  // ------------------------------------------------------------------ o Sagui Ancestral (Raro)
  // O espírito antigo da mata num sagui: o pelo castanho quente, espirais douradas acesas no corpo, faixas douradas no
  // rabo, a runa na testa e os riscos dourados no rosto, os olhos de espírito (acesos, sem pupila), o musgo nos ombros,
  // o colar de sementes com o pingente dourado, a coroa de runas girando em cima da cabeça, os vaga-lumes, as folhas
  // caindo e a fruta dourada. O maior dos três.
  const SHADE_A = 'rgba(54, 30, 18, 0.4)';
  const LIGHT_A = 'rgba(255, 238, 196, 0.36)';
  const ANCESTRAL = {
    ...COMUM,
    look: {
      fur: { base: '#86684a', shade: SHADE_A, light: LIGHT_A },
      limb: { base: '#7a5e42', shade: SHADE_A, light: LIGHT_A },
      head: { base: '#7c5f43', shade: SHADE_A, light: LIGHT_A },
      tuft: { base: '#f6e9c8', shade: 'rgba(120, 92, 44, 0.3)', light: 'rgba(255, 252, 232, 0.75)' },
      tail: { base: '#c2a274', shade: SHADE_A, light: LIGHT_A },
      hand: { base: '#3b2b20', shade: 'rgba(18, 10, 6, 0.45)', light: 'rgba(255, 236, 200, 0.25)' },
      fruit: { base: '#f2c14e', shade: 'rgba(110, 64, 6, 0.45)', light: 'rgba(255, 252, 220, 0.8)' },
    },
    band: '#5c4430',
    ring: '#4b3524',
    belly: '#d6b884',
    face: '#2d1f16',
    muzzle: '#3f2d21',
    blaze: '#e8cf8e',
    lid: '#dcc49a',
    eye: '#ffc93c',
    eyeGlow: 'rgba(255, 214, 90, 0.55)',
    mote: '#fff1a8',
    moteGlow: 'rgba(255, 224, 120, 0.35)',
    spark: '#ffd25a',
    sparkGlow: 'rgba(255, 210, 90, 0.38)',
    sparkCore: '#fffbe6',
    burst: [255, 226, 140],
    burstEnd: 'rgba(255, 200, 90, 0)',
    fruitGlow: [255, 226, 120],
    smile: 'rgba(226, 200, 160, 0.85)',
    brow: 'rgba(240, 214, 160, 0.95)',
    tuftHair: 'rgba(176, 150, 100, 0.5)',
    tuft: 1.06,
    pupil: false,
    glow: { halo: 'rgba(255, 206, 84, 0.3)', mid: 'rgba(255, 214, 110, 0.9)', core: '#fff6d2' },
  };
  /** As espirais no tronco: [a, th, o tamanho (cm × S), o giro (+1 / -1)]. */
  const RUNES = [
    [0.42, 0.95, 4.2, 1],
    [0.42, -0.95, 4.2, -1],
    [0.66, 0.0, 3.2, 1],
  ];
  /** O musgo nos ombros: [a, th, os raios (cm × S), a cor]. */
  const MOSS = [
    [0.86, 1.02, 4.4, 3.2, '#566f30'],
    [0.94, 1.32, 3.2, 2.6, '#566f30'],
    [0.79, 0.78, 2.6, 2.1, '#566f30'],
    [0.88, 1.1, 2.4, 1.7, '#7f9b44'],
    [0.86, -1.02, 4.2, 3.0, '#566f30'],
    [0.93, -0.78, 3.0, 2.4, '#566f30'],
    [0.9, -1.06, 2.2, 1.6, '#7f9b44'],
  ];

  /** Uma folhinha caindo (px de tela), girada `rot`. */
  function leafAt(ctx, x, y, s, rot, z) {
    const c = Math.cos(rot), sn = Math.sin(rot);
    const X = (u, v) => x + u * c - v * sn;
    const Y = (u, v) => y + u * sn + v * c;
    ctx.beginPath();
    ctx.moveTo(X(-s, 0), Y(-s, 0));
    ctx.quadraticCurveTo(X(0, -s * 0.8), Y(0, -s * 0.8), X(s, 0), Y(s, 0));
    ctx.quadraticCurveTo(X(0, s * 0.8), Y(0, s * 0.8), X(-s, 0), Y(-s, 0));
    ctx.fillStyle = '#86b14e';
    ctx.fill();
    ctx.strokeStyle = C.INK;
    ctx.lineWidth = Math.max(0.6, 0.6 * z);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40, 70, 20, 0.7)';
    ctx.beginPath();
    ctx.moveTo(X(-s * 0.8, 0), Y(-s * 0.8, 0));
    ctx.lineTo(X(s * 0.7, 0), Y(s * 0.7, 0));
    ctx.stroke();
  }

  class SaguiAncestral extends Sagui {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.pal = ANCESTRAL;
      this.size = 1.18;
      this.radius = 20 * S * this.size;
    }

    /** O quanto as runas acendem agora (respirando devagar). */
    _pulse() {
      return 0.8 + 0.2 * Math.sin(this.time * 2.2 + this.seed * 5);
    }

    /**
     * A luz própria: de noite, no escuro e na neblina, a view abre um halo dourado em volta dele (as runas e a coroa),
     * respirando junto com elas.
     */
    light() {
      const lit = this._lightLeft();
      if (lit < 0.02) return null;
      return { x: this.pos.x, y: this.pos.y, z: this._bodyZ() + 6 * S, r: 160, color: '#ffd36a', k: 0.82 * this._pulse() * lit };
    }

    _build(cam, rig, st) {
      const out = super._build(cam, rig, st);
      // o pingente do colar: pendurado na frente do peito (cai para o chão, como uma gota)
      const neck = this._neck(rig, torsoFrame(rig));
      const front = neck.at(0);
      const pend = { p: M.add(front.p, { x: 0, y: 0, z: -3 * S }), radial: front.radial };
      const self = this;
      out.groups.push({
        balls: [{ c: pend.p, r: 2 * S }],
        ref: pend.p,
        bias: 0.3,
        noShadow: true,
        paint(ctx, flash) {
          self._paintPendant(ctx, cam, pend, flash);
        },
      });
      return out;
    }

    /** O musgo nos ombros e o colar de sementes (na pele: a luz e a sombra passam por cima). */
    _bodyExtra(ctx, cam, rig, flash) {
      const F = torsoFrame(rig);
      for (const [a, th, ru, rv, color] of MOSS) {
        const { p, nrm } = F.at(a, th, -0.3 * S);
        const up = M.norm(M.sub(F.d, M.scale(nrm, M.dot(F.d, nrm))), F.d);
        P.decal(ctx, cam, { c: p, n: nrm, u: M.cross(nrm, up), v: up, ru: ru * S, rv: rv * S, color, minFacing: 0.08 }, flash);
      }
      // o colar: sementes vermelhas de olho preto (o jequiriti) e marrons, em volta do pescoço e caindo na frente
      const neck = this._neck(rig, F);
      const tc = cam.toCamera;
      const z = cam.zoom;
      const N = 14;
      const rb = 1.35 * S * z;
      for (let k = 0; k < N; k++) {
        const { p, radial } = neck.at(((k + 0.5) / N) * M.TAU);
        if (M.dot(radial, tc) < 0.05) continue;
        const q = cam.p(p);
        ctx.fillStyle = C.INK;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rb + Math.max(0.7, 0.7 * z), 0, M.TAU);
        ctx.fill();
        const red = k % 3 !== 0;
        ctx.fillStyle = C.tint(red ? '#b3262b' : '#6e4426', flash);
        ctx.beginPath();
        ctx.arc(q.x, q.y, rb, 0, M.TAU);
        ctx.fill();
        if (red && z >= 0.85) {
          ctx.fillStyle = '#1b100d';
          ctx.beginPath();
          ctx.arc(q.x + rb * 0.35, q.y - rb * 0.2, rb * 0.42, 0, M.TAU);
          ctx.fill();
        }
      }
    }

    /** As espirais douradas acesas nos lados e no lombo (só as do lado que a câmera vê, sumindo de leve na beirada). */
    _bodyGlow(ctx, cam, rig) {
      const F = torsoFrame(rig);
      const tc = cam.toCamera;
      const z = cam.zoom;
      const k = this._pulse();
      for (const [a, th, size, turn] of RUNES) {
        const { p, nrm } = F.at(a, th, 0.4 * S);
        const face = M.dot(nrm, tc);
        if (face < 0.1) continue;
        const up = M.norm(M.sub(F.d, M.scale(nrm, M.dot(F.d, nrm))), F.d);
        const path = spiralPath(cam, p, M.cross(nrm, up), up, size * S, turn);
        glowStroke(ctx, path, z * 0.8, k * M.smoothstep(0.1, 0.4, face), this.pal.glow, z >= 0.85);
      }
    }

    /** O pescoço (para o colar): o eixo e um ponto da volta do colar (`ang` 0 = o meio da frente, que cai um pouco). */
    _neck(rig, F) {
      const axis = M.norm(M.sub(rig.headC, rig.chestF));
      const c0 = M.lerp3(rig.chestF, rig.headC, 0.04);
      const f0 = M.scale(F.n, -1);
      const front = M.norm(M.sub(f0, M.scale(axis, M.dot(f0, axis))), f0);
      const side = M.cross(axis, front);
      const R = 8.6 * S;
      return {
        axis,
        at(ang) {
          const radial = M.add(M.scale(front, Math.cos(ang)), M.scale(side, Math.sin(ang)));
          const dip = Math.max(0, Math.cos(ang)) ** 2 * 3.2 * S;
          return { p: M.add(M.add(c0, M.scale(radial, R)), M.scale(axis, -dip)), radial };
        },
      };
    }

    /** O pingente: uma gota dourada acesa, a ponta para cima (presa no colar). */
    _paintPendant(ctx, cam, pend, flash) {
      const face = M.dot(pend.radial, cam.toCamera);
      if (face < -0.25) return; // atrás do corpo
      const z = cam.zoom;
      const q = cam.p(pend.p);
      const rr = 1.9 * S * z;
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * this._pulse();
      ctx.fillStyle = this.pal.glow.halo;
      ctx.beginPath();
      ctx.arc(q.x, q.y, rr * 2.6, 0, M.TAU);
      ctx.fill();
      ctx.globalAlpha = a0;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y - rr * 1.5);
      ctx.quadraticCurveTo(q.x + rr * 1.15, q.y - rr * 0.3, q.x + rr * 0.95, q.y + rr * 0.5);
      ctx.arc(q.x, q.y + rr * 0.5, rr * 0.95, 0, Math.PI);
      ctx.quadraticCurveTo(q.x - rr * 1.15, q.y - rr * 0.3, q.x, q.y - rr * 1.5);
      ctx.fillStyle = C.tint('#f3c95a', flash);
      ctx.fill();
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = Math.max(0.8, 0.8 * z);
      ctx.stroke();
      ctx.fillStyle = '#fff6d2';
      ctx.beginPath();
      ctx.arc(q.x - rr * 0.3, q.y + rr * 0.25, rr * 0.3, 0, M.TAU);
      ctx.fill();
    }

    /** As faixas douradas acesas no rabo, no meio das claras (entre os anéis escuros). */
    _tailGlow(ctx, T) {
      const path = new Path2D();
      for (let k = 2; k < T.rings - 1; k += 2) {
        const sAt = ((k + 0.5) / T.rings) * T.total - T.from;
        if (sAt < 0 || sAt > T.local) continue;
        const q = along(T.pts, T.acc, sAt);
        const w = T.rads[q.i] * 0.9;
        path.moveTo(q.x - q.nx * w, q.y - q.ny * w);
        path.lineTo(q.x + q.nx * w, q.y + q.ny * w);
      }
      glowStroke(ctx, path, T.z * 0.6, this._pulse(), this.pal.glow, T.z >= 0.85);
    }

    /** A runa dourada na testa (a espiral) e os riscos dourados embaixo dos olhos (a pintura do espírito). */
    _faceGlow(ctx, cam, head) {
      const r = head.r;
      const z = cam.zoom;
      const k = this._pulse();
      const g = this.pal.glow;
      P.onSurface(ctx, cam, head, 0.68, 0, 0.64, 1, () => {
        const path = new Path2D();
        const N = 18;
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const ang = u * 2.3 * Math.PI;
          const rr = 0.19 * r * (0.12 + 0.88 * u);
          if (i === 0) path.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
          else path.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        glowStroke(ctx, path, 0.7, k, g, z >= 0.85);
      }, -0.1);
      for (const sg of [-1, 1]) {
        P.onSurface(ctx, cam, head, 0.8, 0.42 * sg, -0.14, sg, () => {
          const path = new Path2D();
          path.moveTo(-0.1 * r, 0.02 * r);
          path.lineTo(0.12 * r, -0.04 * r);
          glowStroke(ctx, path, 0.6, k, g, z >= 0.85);
        }, 0.02);
      }
    }

    /** O encanto ancestral: a coroa de runas girando em cima da cabeça, os vaga-lumes e as folhas caindo. */
    _motes(ctx, cam, headC, rig) {
      if (!rig) return;
      const t = this.time, z = cam.zoom;
      const a0 = ctx.globalAlpha;
      const g = this.pal.glow;
      const k = this._pulse();
      // a coroa: um anel deitado em cima da cabeça (no "para cima" do corpo), com 5 runinhas rodando
      const up = rig.upV;
      const hc = M.add(headC, M.scale(up, rig.rh + 9 * S));
      const e1 = M.norm(M.sub(rig.fwd, M.scale(up, M.dot(rig.fwd, up))), { x: 1, y: 0, z: 0 });
      const e2 = M.cross(up, e1);
      const R = 9.5 * S;
      const ring = new Path2D();
      for (let i = 0; i <= 28; i++) {
        const a = (i / 28) * M.TAU;
        const q = cam.p(M.add(hc, M.add(M.scale(e1, Math.cos(a) * R), M.scale(e2, Math.sin(a) * R))));
        if (i === 0) ring.moveTo(q.x, q.y);
        else ring.lineTo(q.x, q.y);
      }
      ctx.globalAlpha = a0 * 0.6;
      glowStroke(ctx, ring, z * 0.45, k, g, false);
      for (let i = 0; i < 5; i++) {
        const a = t * 0.7 + (i / 5) * M.TAU;
        const dir = M.add(M.scale(e1, Math.cos(a)), M.scale(e2, Math.sin(a)));
        const q = cam.p(M.add(hc, M.scale(dir, R)));
        const s = 2.4 * z;
        ctx.globalAlpha = a0 * (M.dot(dir, cam.toCamera) > 0 ? 1 : 0.5) * k;
        ctx.fillStyle = g.halo;
        ctx.beginPath();
        ctx.arc(q.x, q.y, s * 1.7, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = g.mid;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y - s * 1.5);
        ctx.lineTo(q.x + s * 0.8, q.y);
        ctx.lineTo(q.x, q.y + s * 1.5);
        ctx.lineTo(q.x - s * 0.8, q.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = g.core;
        ctx.beginPath();
        ctx.arc(q.x, q.y, s * 0.35, 0, M.TAU);
        ctx.fill();
      }
      // os vaga-lumes: rodando devagar em volta do corpo, piscando
      const body = M.lerp3(rig.hipF, rig.chestF, 0.6);
      for (let i = 0; i < 4; i++) {
        const h = C.hash01(i * 3.7 + 2);
        const a = t * (0.5 + 0.3 * h) + i * 1.7 + this.seed * 6;
        const rr = (18 + 8 * h) * S;
        const off = { x: Math.cos(a) * rr, y: Math.sin(a) * rr, z: (6 + 10 * Math.sin(t * 0.9 + i * 2.1)) * S };
        const q = cam.p(M.add(body, off));
        const behind = off.x * cam.toCamera.x + off.y * cam.toCamera.y < 0 ? 0.45 : 1;
        ctx.globalAlpha = a0 * behind * (0.35 + 0.65 * Math.max(0, Math.sin(t * 2.6 + i * 1.9)));
        ctx.fillStyle = this.pal.moteGlow;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 3.2 * z, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = this.pal.mote;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 1.3 * z, 0, M.TAU);
        ctx.fill();
      }
      // as folhas: caem devagar de cima da cabeça, balançando
      for (let i = 0; i < 2; i++) {
        const per = 3.6;
        const ph = (((t + i * per * 0.5 + this.seed * 3) / per) % 1 + 1) % 1;
        const h = C.hash01(i * 5.1 + 1);
        const x0 = headC.x + (h - 0.5) * 30 * S, y0 = headC.y + (0.5 - h) * 20 * S;
        const zz = headC.z + 22 * S - ph * 75 * S;
        if (zz < this.groundZ + 2) continue;
        const q = cam.p({ x: x0 + Math.sin(ph * 7 + i) * 8 * S, y: y0 + Math.cos(ph * 5 + i) * 4 * S, z: zz });
        ctx.globalAlpha = a0 * Math.min(1, ph * 6, (1 - ph) * 4);
        leafAt(ctx, q.x, q.y, 2.6 * S * z * 0.55, ph * 9 + i * 2, z);
      }
      ctx.globalAlpha = a0;
    }
  }

  C.define('sagui', Sagui);
  C.define('sagui_corrompido', SaguiCorrompido);
  C.define('sagui_ancestral', SaguiAncestral);
  PD.Sagui = Sagui;
})(window.PD = window.PD || {});
