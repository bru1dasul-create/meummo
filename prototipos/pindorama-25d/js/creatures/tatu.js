// Tatu-bola (o tatu de três faixas da mata do sul do Capão; regras da [estrutura], 15/11): a carapaça em abóbada cor de
// ocre (o escudo da frente e o de trás cheios de plaquinhas e as três cintas que dobram no meio), a beirada em
// plaquinhas, a cabecinha pontuda com o escudo em cima, as orelhinhas redondas, o rabo curto de casca e as patas curtas
// com unhas (as da frente, compridas). Anda de passinho ligeiro, balançando a casca.
// Redesenho (24/11, a etapa 3 dos inimigos, aprovada pelo dono: "pode seguir para o Tatu-bola"): sem as bolinhas —
// pintado como o Birim, o sagui e o quati (o contorno de tinta mais grosso do lado da sombra, a meia-lua de sombra e a
// faixa de brilho). No aviso ('windup', 0,9 s) se fecha numa bola e gira no lugar, cada vez mais rápido, levantando
// poeira para trás (o "vou te atropelar"); na investida ('charge') ele rola de verdade pelo caminho (o servidor põe o pé
// no fim de uma vez) e, parando, se abre tonto ('dizzy': 2 s cambaleando, olhos de espiral e as estrelinhas). 'block':
// a casca segurou um golpe de frente (a faísca no casco e a cabeça encolhendo). Apanhando, dá um tranco para longe de
// quem bateu; caindo, vira de barriga para cima, as patinhas para o ar, e o encanto sai do corpo em faíscas roxas.
// As bolas ficam só para a sombra no chão e a caixa do desenho.
//   PD.creatures.create('tatu_bola', xCm, yCm, yaw)
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  if (!C) return;
  const P = C.paint;
  const SH = PD.shapes;

  /** Tamanho de jogo: maior que o de verdade (uns 25 cm), para ler com a câmera longe. */
  const S = 1.7;
  const LOOK = {
    shell: { base: '#b8925a', shade: 'rgba(60, 36, 18, 0.45)', light: 'rgba(255, 238, 200, 0.4)' },
    skin: { base: '#b98f7d', shade: 'rgba(70, 34, 30, 0.42)', light: 'rgba(255, 232, 220, 0.35)' },
    leg: { base: '#9b7464', shade: 'rgba(50, 24, 20, 0.42)', light: 'rgba(255, 230, 214, 0.25)' },
    belly: { base: '#dfbfae', shade: 'rgba(90, 50, 44, 0.35)', light: 'rgba(255, 244, 236, 0.4)' },
    claw: { base: '#3b2a22' },
    nose: { base: '#5a3230' },
  };
  const GROOVE = '#5a3d22'; // as dobras das cintas
  const GROOVE_LIGHT = 'rgba(255, 232, 188, 0.55)'; // a beirada da cinta, pegando luz
  const SCUTE = 'rgba(92, 60, 30, 0.42)'; // as plaquinhas dos escudos
  const RIM = '#7a5630'; // a beirada da carapaça
  const EAR_IN = '#7e5248';
  const EYE = '#120a06';
  const LID = '#e8cdbd'; // olho fechado ou apertado: o risco claro
  const SPARK = '#b58cff';
  /** A bola fechada (cm, antes do S): o raio e onde fica o meio dela (para a frente do pé). */
  const BALL_R = 15.5;
  const BALL_A = -1;
  /** A carapaça aberta: a abóbada (meio comprimento, meia largura e altura acima do meio) e o meio (cm, antes do S). */
  const DOME = { a: 21.5, b: 16, h: 18, along: -1, z: 8 };
  /** Até onde vai a carapaça (rad): para a frente e para trás (`th`) e para os lados (`ph`); fechada, quase a volta toda. */
  const OPEN_TH = 1.3, BALL_TH = 3.05, OPEN_PH = 1.72, BALL_PH = Math.PI / 2;
  /** As dobras das três cintas, na parte do comprimento (`th` / `th0`). */
  const GROOVES = [-0.27, -0.09, 0.09, 0.27];
  /** O giro do aviso (rad/s): a bola gira no lugar cada vez mais rápido. */
  const REV = 18;

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

  /** Pequeno na tela (o zoom do celular, 0,7): sem as plaquinhas e as patas sem a sombra pintada (mais leve). */
  const small = (z) => z < 0.85;

  /** Estrelinha de 4 pontas (as faíscas do encanto), em px de tela. */
  function star4(ctx, x, y, s) {
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

  /** Estrelinha amarela de cinco pontas (o tonto). */
  function star5(ctx, x, y, r, z) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * M.TAU;
      const rr = i % 2 ? r * 0.45 : r;
      if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffe14a';
    ctx.strokeStyle = '#5a3c08';
    ctx.lineWidth = Math.max(1, 0.9 * z);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Um ponto da carapaça (`th` ao longo, `ph` de lado a lado), no esqueleto `F` (já girado: o rolar e o desmaio).
   * Aberta (`F.k` 0), a abóbada: as cintas atravessam o lombo de um lado ao outro. Fechada (`F.k` 1), a bola enrolada
   * em volta do lado do corpo: a espinha vira um círculo e as cintas viram gomos que se juntam nos dois lados da bola
   * (como no tatu-bola fechado de verdade). No meio, a mistura das duas.
   */
  function shellPt(F, th, ph) {
    const k = F.k;
    const st = Math.sin(th), ct = Math.cos(th), sp = Math.sin(ph), cp = Math.cos(ph);
    const fC = F.a * st * (1 - k + k * cp);
    const sC = F.b * sp * ((1 - k) * ct + k);
    const uC = F.h * ct * cp;
    return M.add(F.c, M.add(M.scale(F.f, fC), M.add(M.scale(F.s, sC), M.scale(F.u, uC))));
  }
  /** A direção para fora da carapaça nesse ponto (a das duas formas, misturada: só para saber o lado que aparece). */
  function shellN(F, th, ph) {
    const k = F.k;
    const st = Math.sin(th), ct = Math.cos(th), sp = Math.sin(ph), cp = Math.cos(ph);
    return M.norm(M.add(M.scale(F.f, (st * (1 - k + k * cp)) / F.a), M.add(M.scale(F.s, (sp * ((1 - k) * ct + k)) / F.b), M.scale(F.u, (ct * cp) / F.h))), F.u);
  }
  /**
   * Uma linha na carapaça (de `fn(0)` a `fn(1)`, os pares [th, ph]), só os pedaços do lado que a câmera vê, no caminho
   * `path` (em px de tela).
   */
  function shellLine(path, cam, F, fn, n, minFace = 0.04) {
    const tc = cam.toCamera;
    let pen = false;
    for (let k = 0; k <= n; k++) {
      const [th, ph] = fn(k / n);
      if (M.dot(shellN(F, th, ph), tc) < minFace) {
        pen = false;
        continue;
      }
      const q = cam.p(shellPt(F, th, ph));
      if (pen) path.lineTo(q.x, q.y);
      else path.moveTo(q.x, q.y);
      pen = true;
    }
  }

  class Tatu extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 26 * S;
      this.top = 36 * S;
      this.acts = { windup: { dur: 0.9, hold: 0.45 }, charge: { dur: 0.45, hold: 0 } };
      /** Aberto (0) a fechado na bola (1). */
      this.curl = 0;
      /** O giro da bola (rad; + = rolando para a frente) e a velocidade dele. Só abre com o giro "em pé" (volta inteira). */
      this.spin = 0;
      this.spinV = 0;
      /** Rolando na investida: { x0, y0, x1, y1, t, dur, s0, s1 } (o servidor manda o pé do fim de uma vez). */
      this.roll = null;
      /** Segundos desde parar de rolar (o quique), desde a casca segurar um golpe ('block') e desde abrir tonto. */
      this.stopT = 9;
      this.blockT = 9;
      this.dizzyT = 9;
      /** O tonto chegou antes de terminar de rolar (o servidor manda tudo junto): começa quando ele parar. */
      this.dizzyLater = false;
      /** Parado (0) a andando (1). */
      this.walk = 0;
      /** A poeira levantada (no aviso e rolando): { x, y, t, vx, vy, s } em cm. */
      this.dust = [];
      /** Caiu: vira de barriga para cima (pose própria, sem tombar de lado). */
      this.ownDeath = true;
      /** Para onde vai o tranco do golpe levado (no chão, unitário): para longe do herói, ou para trás. */
      this.recoilDir = { x: -Math.cos(yaw), y: -Math.sin(yaw) };
    }

    action(kind, yaw) {
      if (this.dying !== null) return;
      if (kind === 'block') {
        // a casca segurou: a faísca do lado de quem bateu e a cabeça encolhendo (não interrompe o resto)
        this.blockT = 0;
        return;
      }
      if (kind === 'dizzy') {
        // o servidor manda o tonto junto com a investida: espera ele terminar de rolar
        if (this.roll || (this.act && this.act.kind === 'charge')) this.dizzyLater = true;
        else {
          this.dizzyT = 0;
          this.act = null;
        }
        return;
      }
      if (kind === 'hurt') {
        // o golpe quase sempre vem do herói (o servidor não diz de onde): o tranco vai para longe dele
        const d = this._fromHero();
        this.recoilDir = d || { x: -Math.cos(this.yaw), y: -Math.sin(this.yaw) };
      }
      if (kind === 'die') {
        this.roll = null;
        this.dizzyLater = false;
      }
      super.action(kind, yaw);
    }

    /** Para longe do herói (unitário, no chão), se ele estiver perto. */
    _fromHero() {
      const h = this.near && this.near.hero;
      if (!h) return null;
      const ax = this.pos.x - h.x, ay = this.pos.y - h.y;
      const d = Math.hypot(ax, ay);
      return d > 1 && d < 2500 ? { x: ax / d, y: ay / d } : null;
    }

    /**
     * Novo ponto do pé. Na investida (fechado, o servidor põe o pé no fim da linha de uma vez, `dash`), ele rola até lá:
     * rápido no começo e freando, girando uma volta inteira a mais ou a menos (para abrir de pé).
     */
    moveTo(x, y, yaw, durationMs, dash) {
      if (this.dying !== null) return;
      const charging = this.act && this.act.kind === 'charge';
      if (dash && (charging || this.curl > 0.5)) {
        const d = Math.hypot(x - this.pos.x, y - this.pos.y);
        if (d > 1 && d < 1500) {
          const R = BALL_R * S;
          this.roll = {
            x0: this.pos.x,
            y0: this.pos.y,
            x1: x,
            y1: y,
            t: 0,
            dur: M.clamp(d / 1500, 0.2, 0.55),
            s0: this.spin,
            s1: Math.ceil((this.spin + d / R) / M.TAU - 1e-6) * M.TAU,
          };
          this._from = { x, y };
          this._to = { x, y };
          this._t = this._dur = 1;
          if (Number.isFinite(yaw)) this.yawTarget = yaw;
          return;
        }
      }
      if (this.roll) this._endRoll();
      super.moveTo(x, y, yaw, durationMs, dash);
    }

    _endRoll() {
      const r = this.roll;
      this.pos.x = r.x1;
      this.pos.y = r.y1;
      this.spin = r.s1;
      this.spinV = 0;
      this.roll = null;
      this.stopT = 0;
      // parou de rolar: a investida acabou (não fica girando no lugar até o fim do golpe)
      if (this.act && this.act.kind === 'charge') this.act = null;
      if (this.dizzyLater) {
        this.dizzyLater = false;
        this.dizzyT = 0;
        this.act = null;
      }
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
      this.blockT += dt;
      this.dizzyT += dt;
      this.stopT += dt;
      const dying = this.dying !== null;
      // rolando a investida: o pé vai do começo ao fim (freando) e a bola gira junto
      if (this.roll && !dying) {
        const r = this.roll;
        r.t += dt;
        const k = M.clamp01(r.t / r.dur);
        const e = 1 - (1 - k) * (1 - k);
        this.pos.x = M.lerp(r.x0, r.x1, e);
        this.pos.y = M.lerp(r.y0, r.y1, e);
        this.spin = M.lerp(r.s0, r.s1, e);
        this.spinV = ((r.s1 - r.s0) * 2 * (1 - k)) / r.dur;
        // a poeira: atrás da bola, por onde passa
        if (Math.random() < dt * 45) this._puff(1.2);
        if (k >= 1) this._endRoll();
      }
      // (lido depois de rolar: parando, a investida acaba no mesmo quadro)
      const act = this.act;
      const winding = !dying && act && act.kind === 'windup';
      const charging = !dying && act && act.kind === 'charge';
      const revving = winding && act.t > 0.3;
      if (!this.roll) {
        if (revving || charging) {
          // o aviso: gira no lugar, cada vez mais rápido (e na investida sem caminho, gira um pouco antes de abrir)
          this.spinV = M.damp(this.spinV, REV, revving ? 3.2 : 6, dt);
          this.spin += this.spinV * dt;
          if (revving && Math.random() < dt * 22 * M.clamp01(this.spinV / REV)) this._puff(0.8);
        } else {
          // parando: termina a volta (abre de pé)
          const goal = Math.ceil(this.spin / M.TAU - 1e-6) * M.TAU;
          if (this.spin < goal) {
            this.spinV = Math.max(5, M.damp(this.spinV, 0, 2.5, dt));
            this.spin = Math.min(goal, this.spin + this.spinV * dt);
          } else this.spinV = 0;
        }
      }
      const aligned = Math.abs(this.spin - Math.round(this.spin / M.TAU) * M.TAU) < 1e-6;
      const closed = !dying && (winding || charging || !!this.roll || !aligned);
      this.curl = M.damp(this.curl, closed ? 1 : 0, closed ? 11 : 7, dt);
      if (this.curl < 0.002 && !closed) this.curl = 0;
      // a investida que não andou (sem caminho): o tonto vem quando o golpe termina
      if (this.dizzyLater && !this.roll && !charging) {
        this.dizzyLater = false;
        this.dizzyT = 0;
      }
      this.walk = dying ? 0 : M.smoothstep(4, 40, this.speed) * (1 - this.curl);
      // passada curta e ligeira: uns 44 cm por ciclo
      this.phase = (this.phase + (this.speed * dt) / (26 * S)) % 1;
      // a poeira envelhece e some
      for (const d of this.dust) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vx *= Math.exp(-3 * dt);
        d.vy *= Math.exp(-3 * dt);
      }
      this.dust = this.dust.filter((d) => this.time - d.t < 0.6);
      this.label = dying ? 'caído' : this.dizzyT < 2 ? 'tonto' : this.roll ? 'rolando' : winding ? 'fechando' : this.curl > 0.5 ? 'abrindo' : this.walk > 0.5 ? 'andando' : 'parado';
    }

    /** Uma nuvenzinha de poeira atrás da bola (onde ela encosta no chão), jogada para trás. */
    _puff(power) {
      if (this.dust.length > 24) return;
      const f = { x: Math.cos(this.yaw), y: Math.sin(this.yaw) };
      const back = BALL_R * S * 0.7;
      const j = (Math.random() - 0.5) * 14 * S;
      const sp = (60 + 90 * Math.random()) * power;
      this.dust.push({
        x: this.pos.x - f.x * back - f.y * j,
        y: this.pos.y - f.y * back + f.x * j,
        t: this.time,
        vx: -f.x * sp + (Math.random() - 0.5) * 40,
        vy: -f.y * sp + (Math.random() - 0.5) * 40,
        s: 0.7 + 0.6 * Math.random(),
      });
    }

    /** O momento (o golpe, o tranco, o tonto, o desmaio...), em números de 0 a 1. */
    _moment() {
      const act = this.act;
      const t = this.time;
      const dying = this.dying;
      const winding = act && act.kind === 'windup';
      const rd = this.recoilDir;
      const dizzy = this.dizzyT < 2 ? 1 - M.smoothstep(1.6, 2, this.dizzyT) : 0;
      return {
        t,
        act,
        curl: M.smoothstep(0, 1, this.curl),
        spin: this.spin,
        // o giro no lugar do aviso (0..1) e o "segurando" no fim (treme)
        rev: winding ? M.clamp01(this.spinV / REV) * M.smoothstep(0.25, 0.45, act.t) : this.roll ? 1 : 0,
        hold: winding && act.hold > 0 ? M.clamp01((act.t - act.dur) / act.hold) : 0,
        rolling: !!this.roll,
        // o quique ao parar de rolar
        stop: this.stopT < 0.28 ? Math.sin((this.stopT / 0.28) * Math.PI) : 0,
        rec: this.recoil(),
        hop: this.hurtT < 0.3 ? Math.sin((this.hurtT / 0.3) * Math.PI) : 0,
        // a casca segurou: a cabeça encolhe e o corpo recua um tiquinho
        block: this.blockT < 0.3 ? Math.sin(Math.min(1, this.blockT / 0.3) * Math.PI) : 0,
        dizzy,
        dying,
        // desmaio: vira de barriga para cima em 0,3 s e quica
        flip: dying === null ? 0 : M.easeInOut(M.clamp01(dying / 0.3)),
        land: dying === null ? 0 : Math.max(0, Math.sin(M.clamp01((dying - 0.3) / 0.16) * Math.PI)) * 2,
        walk: this.walk,
        push: rd.x * Math.cos(this.yaw) + rd.y * Math.sin(this.yaw),
      };
    }

    _fwd() {
      return { x: Math.cos(this.yaw), y: Math.sin(this.yaw), z: 0 };
    }
    _side() {
      return { x: -Math.sin(this.yaw), y: Math.cos(this.yaw), z: 0 };
    }

    /** A pose (pontos 3D) e as partes pintadas, cada uma com as bolas da sombra e o seu desenho. */
    parts(cam) {
      const st = this._moment();
      return this._build(cam, this._rig(st), st);
    }

    /** O esqueleto (pontos 3D em cm): a carapaça, a cabeça, as orelhas, as patas e o rabo. */
    _rig(st) {
      const { t, curl, rev, hold, stop, rec, hop, block, dizzy, flip, land, walk, push } = st;
      const ph = this.phase * M.TAU;
      const fwd = this._fwd();
      const side = this._side();
      const UP = { x: 0, y: 0, z: 1 };
      // o corpo: o tranco (para longe de quem bateu), o pulinho, o recuo da casca, o balanço andando e o cambalear tonto
      const rd = this.recoilDir;
      const rx = rd.x * 10 * S * rec, ry = rd.y * 10 * S * rec;
      const shake = hold > 0.6 ? Math.sin(t * 70) * 0.8 * (hold - 0.6) / 0.4 : 0;
      const lean = -3 * rev * (1 - st.rolling); // girando no lugar, a bola recua um pouco (tomando impulso)
      const breath = Math.sin(t * 2.2 + this.seed * 6) * 0.35 * (1 - walk) * (1 - curl);
      const bob = Math.abs(Math.sin(ph * 2)) * 1.1 * walk;
      const sway = Math.sin(ph * 2) * 0.05 * walk + Math.sin(t * 5.2) * 0.16 * dizzy;
      const base = (a, s, z) => {
        const p = this.at((a + lean - 2.5 * block) * S, (s + shake) * S, (z + hop * 2.5 + stop * 4 + land) * S);
        return { x: p.x + rx, y: p.y + ry, z: p.z };
      };
      // o desmaio vira o corpo de barriga para cima, em volta do comprimento (o casco desce até o chão); o tonto e o
      // passo balançam em volta do mesmo eixo
      const roll = flip * Math.PI * (1 + 0.06 * Math.sin(flip * Math.PI)) + sway;
      const O = base(DOME.along, 0, 13.5);
      const R = (v) => M.rotate(v, fwd, roll);
      const W = (a, s, z) => {
        const p = base(a, s, z);
        return M.add(O, R(M.sub(p, O)));
      };

      // a carapaça: a abóbada aberta vira a bola fechada (e gira com o rolar)
      const sa = M.lerp(DOME.along, BALL_A, curl);
      const sz = M.lerp(DOME.z, BALL_R + 0.4, curl) + breath * 0.5 + bob * 0.6;
      const spinR = (v) => M.rotate(v, side, st.spin);
      const shell = {
        c: W(sa, 0, sz),
        f: R(spinR(fwd)),
        s: R(side),
        u: R(spinR(UP)),
        a: M.lerp(DOME.a, BALL_R, curl) * S,
        b: M.lerp(DOME.b, BALL_R, curl) * S,
        h: M.lerp(DOME.h, BALL_R, curl) * S,
        th0: M.lerp(OPEN_TH, BALL_TH, curl),
        ph0: M.lerp(OPEN_PH, BALL_PH, curl),
        k: curl,
      };
      // (sem o giro: para a barriga e as partes que entram na bola)
      const body = { f: R(fwd), s: R(side), u: R(UP) };

      // a cabeça: sai de baixo do escudo da frente, pontuda; olha em volta parado; tonto, balança; fechando, entra na
      // bola; a casca segurando um golpe, encolhe
      const tuck = Math.max(curl, 0.55 * block);
      const look = (M.noise1(t * 0.45 + this.seed * 11) - 0.5) * 0.9 * (1 - walk) * (1 - curl) * (1 - dizzy) * (st.act ? 0 : 1) + Math.sin(t * 6.3) * 0.4 * dizzy;
      const hy = this.yaw + look;
      const sniff = Math.sin(t * 9 + this.seed * 4) * 0.04 * (1 - walk) * (1 - dizzy);
      const pitch = 0.28 + sniff - 0.1 * rec + 0.15 * dizzy * Math.sin(t * 3.1);
      const flatH = { x: Math.cos(hy), y: Math.sin(hy), z: 0 };
      const hf = R(M.norm(M.add(M.scale(flatH, Math.cos(pitch)), { x: 0, y: 0, z: -Math.sin(pitch) })));
      const hs = R({ x: -flatH.y, y: flatH.x, z: 0 });
      const hu = M.norm(M.cross(hf, hs));
      const neck = W(M.lerp(17, BALL_A + 6, tuck), 0, M.lerp(9.6 + bob * 0.8 + breath, BALL_R - 2, tuck));
      const hk = 1 - 0.75 * tuck; // a cabeça diminui entrando na bola
      const head = [neck];
      const segs = [5.2, 4.4, 4, 3.2];
      for (let i = 0; i < segs.length; i++) head.push(M.add(head[i], M.scale(hf, segs[i] * S * hk)));
      const headR = [4.4, 5.1, 4.2, 2.9, 1.5].map((r) => r * S * hk);

      // as orelhinhas: atrás do escudo da cabeça, para cima e para fora; deitam no tranco e somem na bola
      const flat = Math.min(1, 0.8 * rec + 0.6 * block + flip);
      const ears = [-1, 1].map((sg) => ({
        sg,
        c: M.add(head[1], M.add(M.scale(hu, (4.3 - 1.4 * flat) * S * hk), M.add(M.scale(hs, 2.6 * sg * S * hk), M.scale(hf, (-1.2 - 1.5 * flat) * S * hk)))),
        r: 2.1 * S * hk,
      }));

      // as patas curtas: trote em diagonal; as da frente andam na ponta das unhas; fechando, entram na bola; tonto,
      // abertas e moles; desmaiado, para o ar
      const legs = [];
      for (const [front, sg, off] of [[true, -1, 0], [true, 1, 0.5], [false, -1, 0.5], [false, 1, 0]]) {
        const q = ph + off * M.TAU;
        const swing = Math.sin(q) * 5 * walk;
        const lift = Math.max(0, Math.cos(q)) * 3 * walk;
        const splay = 2.5 * dizzy + 2 * flip;
        const ra = front ? 12.5 : -12;
        const fa = front ? 15 : -13;
        const root = W(ra, (7.5 + 0.5 * (front ? 0 : 1)) * sg, 8.5 + bob * 0.5);
        let foot = W(fa + swing + splay * (front ? 0.6 : -0.6), (9 + splay) * sg, lift + (front ? 0.6 : 0) + 2.5 * flip);
        // fechando, o pé vai para dentro da bola
        const inside = W(BALL_A + (front ? 4 : -4), 6 * sg, BALL_R - 1);
        foot = M.lerp3(foot, inside, curl);
        const l1 = (front ? 5.4 : 5.8) * S * (1 - 0.4 * curl);
        const l2 = (front ? 4.8 : 5.2) * S * (1 - 0.4 * curl);
        const knee = bend(root, foot, l1, l2, front ? M.scale(body.f, -1) : body.f);
        const toe = M.add(foot, M.scale(body.f, (front ? 3.2 : 2.6) * S * (1 - curl)));
        legs.push({ front, sg, pts: [root, M.lerp3(root, knee, 0.5), knee, M.lerp3(knee, foot, 0.5), foot], knee, foot, toe });
      }

      // o rabo curto de casca: para trás e para baixo; fechando, encaixa na bola
      const tail = [];
      const wag = Math.sin(t * 2.4 + this.seed * 5) * 0.8 * (1 - walk) + Math.sin(ph * 2) * 1.2 * walk;
      for (let k = 0; k <= 3; k++) {
        const u = k / 3;
        const a = M.lerp(-21 - u * 8.5, BALL_A - BALL_R * 0.4, curl);
        const s = wag * u * u * (1 - curl);
        const zz = M.lerp(7.5 - u * 4.5 + bob * 0.5, BALL_R - 4, curl);
        tail.push({ c: W(a, s, zz), r: (3.6 - u * 2.2) * S * (1 - 0.6 * curl) });
      }

      return { shell, body, fwd, side, head, headR, hf, hs, hu, ears, legs, tail, tuck, flip };
    }

    /** As partes pintadas, cada uma com as bolas da sombra e o seu desenho, na ordem da câmera. */
    _build(cam, rig, st) {
      const z = cam.zoom;
      const ink = Math.max(1, 1.1 * z);
      const groups = [];
      const self = this;
      const F = rig.shell;

      // ---- a carapaça (as bolas: só a sombra e a caixa)
      const balls = [];
      for (const k of [-0.75, -0.38, 0, 0.38, 0.75]) {
        const p = M.add(F.c, M.add(M.scale(rig.body.f, F.a * k * 0.95), M.scale(rig.body.u, F.h * 0.3)));
        balls.push({ c: p, r: Math.min(F.b, F.h) * (1 - 0.35 * Math.abs(k)) });
      }
      groups.push({
        balls,
        ref: F.c,
        body: true,
        paint(ctx, flash) {
          self._paintShell(ctx, cam, rig, st, ink, flash);
        },
      });

      // ---- a barriga (desmaiado, de barriga para cima)
      if (st.flip > 0.25) {
        groups.push({
          balls: [],
          ref: M.add(F.c, M.scale(rig.body.u, -F.h * 0.4)),
          bias: 0.6,
          paint(ctx, flash) {
            self._paintBelly(ctx, cam, rig, ink, flash);
          },
        });
      }

      // ---- as patas (somem dentro da bola)
      if (st.curl < 0.82) {
        for (const L of rig.legs) {
          groups.push({
            balls: [{ c: L.knee, r: 3 * S }, { c: L.foot, r: 2.4 * S }],
            ref: L.knee,
            bias: st.flip > 0.5 ? 0.7 : 0,
            paint(ctx, flash) {
              self._paintLeg(ctx, cam, L, st, ink, flash);
            },
          });
        }
      }

      // ---- o rabo de casca
      if (st.curl < 0.85) {
        groups.push({
          balls: rig.tail,
          ref: rig.tail[1].c,
          bias: -0.4,
          paint(ctx, flash) {
            self._paintTail(ctx, cam, rig, ink, flash);
          },
        });
      }

      // ---- a cabeça (com o escudo, os olhos e o focinho) e as orelhas (somem dentro da bola)
      if (rig.tuck < 0.8) {
        groups.push({
          balls: [{ c: rig.head[1], r: rig.headR[1] }, { c: rig.head[3], r: rig.headR[3] }],
          ref: rig.head[1],
          bias: 0.5,
          body: true,
          paint(ctx, flash) {
            self._paintHead(ctx, cam, rig, st, ink, flash);
          },
        });
        for (const e of rig.ears) {
          const near = M.dot(M.scale(rig.hs, e.sg), cam.toCamera) > 0.1;
          groups.push({
            balls: [{ c: e.c, r: e.r }],
            ref: rig.head[1],
            bias: near ? 0.62 : 0.38,
            noShadow: true,
            paint(ctx, flash) {
              self._paintEar(ctx, cam, e, rig, ink, flash);
            },
          });
        }
      }

      // ---- por cima: a poeira, a faísca da casca, as estrelinhas do tonto e, desmaiado, o encanto saindo
      const heart = M.add(F.c, M.scale(rig.body.u, F.h * 0.2));
      const after = (ctx) => {
        this._paintDust(ctx, cam);
        if (this.blockT < 0.35) this._paintSpark(ctx, cam, rig);
        if (st.dizzy > 0.02 && st.dying === null) this._paintStars(ctx, cam, rig, st);
        if (st.dying !== null) this._release(ctx, cam, heart, st.dying);
      };
      // o nome: em cima da casca
      this.top = Math.max(F.c.z + F.h, rig.head[1].z + rig.headR[1]) - this.groundZ + 9 * S;
      const paint = (ctx, flash) => {
        ctx.save();
        for (const g of C.byDepth(cam, groups)) if (g.paint) g.paint(ctx, flash);
        ctx.restore();
      };
      return { groups, after, paint };
    }

    /**
     * A carapaça: a abóbada (ou a bola) com a beirada em plaquinhas, pintada como o Birim; por dentro (por baixo da luz
     * e da sombra), as plaquinhas dos dois escudos, as três cintas com as dobras escuras e a beirada mais escura.
     */
    _paintShell(ctx, cam, rig, st, ink, flash) {
      const F = rig.shell;
      const z = cam.zoom;
      // o contorno: o casco dos pontos da abóbada na tela (ela é convexa)
      const pts = [];
      const NT = 10, NP = 10;
      for (let i = 0; i <= NT; i++) {
        const th = -F.th0 + (2 * F.th0 * i) / NT;
        for (let j = 0; j <= NP; j++) {
          const q = cam.p(shellPt(F, th, -F.ph0 + (2 * F.ph0 * j) / NP));
          pts.push(q.x, q.y);
        }
      }
      const hull = SH.convexHull(pts);
      // a beirada em plaquinhas: ondinhas curtas e redondas (sem pontas)
      const len = 2.6 * z;
      const bumps = P.furOutline(hull, small(z) ? 26 : 40, len, this.seed * 7 + 3, 0, null, 0);
      if (!bumps) return;
      const pad = len * 1.5 + 1 * z;
      // (a forma lisa da sombra e do brilho: o mesmo casco, um pouco maior que as plaquinhas)
      const grown = P.grow(hull, pad);
      P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(bumps, dx, dy, p), LOOK.shell, 7 * z, ink, flash, {
        light: (dx, dy, p) => SH.fillPath(grown, dx, dy, p),
        lightPad: pad,
        inside: (c) => this._shellMarks(c, cam, F, z, flash),
      });
    }

    /** Por dentro da carapaça: as plaquinhas, as dobras das cintas (com a beirada clara) e a beirada escura. */
    _shellMarks(ctx, cam, F, z, flash) {
      const th0 = F.th0, ph0 = F.ph0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // as plaquinhas dos escudos (de perto): as fileiras e as colunas, um quadriculado curvo
      if (!small(z)) {
        const grid = new Path2D();
        const ROWS = 4;
        for (const sg of [-1, 1]) {
          // as fileiras de plaquinhas dos escudos (da cinta para a ponta) e, entre uma fileira e outra, os risquinhos
          // desencontrados (como tijolinhos): cada plaquinha fica do seu tamanho, sem virar um quadriculado
          const rowAt = (r) => sg * th0 * (0.27 + (r / (ROWS + 0.6)) * 0.73);
          for (let r = 1; r <= ROWS; r++) shellLine(grid, cam, F, (k) => [rowAt(r), -ph0 + 2 * ph0 * k], 14);
          for (let r = 0; r <= ROWS; r++) {
            const cols = 9 - r;
            for (let c = 0; c < cols; c++) {
              const ph = ((c + (r % 2 ? 0.5 : 0) + 0.5) / cols - 0.5) * 2 * ph0 * 0.96;
              shellLine(grid, cam, F, (k) => [M.lerp(rowAt(r), rowAt(r + 1), 0.12 + 0.76 * k), ph], 1);
            }
          }
        }
        // nas cintas: um risquinho entre cada plaquinha comprida
        for (let b = 0; b < 3; b++) {
          const ta = GROOVES[b] * th0, tb = GROOVES[b + 1] * th0;
          for (let c = -6; c <= 6; c++) {
            const ph = ((c + (b % 2 ? 0.5 : 0)) / 6.5) * ph0;
            shellLine(grid, cam, F, (k) => [M.lerp(ta, tb, 0.2 + 0.6 * k), ph], 1);
          }
        }
        ctx.strokeStyle = SCUTE;
        ctx.lineWidth = Math.max(0.7, 0.7 * z);
        ctx.stroke(grid);
      }
      // as dobras das três cintas: o risco escuro e, logo atrás, a beirada clara da cinta de cima
      const dark = new Path2D(), lit = new Path2D();
      for (const g of GROOVES) {
        shellLine(dark, cam, F, (k) => [g * th0, -ph0 + 2 * ph0 * k], 16);
        shellLine(lit, cam, F, (k) => [g * th0 + 0.05, -ph0 + 2 * ph0 * k], 16);
      }
      ctx.strokeStyle = C.tint(GROOVE, flash);
      ctx.lineWidth = Math.max(1.2, 2.4 * z);
      ctx.stroke(dark);
      ctx.strokeStyle = GROOVE_LIGHT;
      ctx.lineWidth = Math.max(0.8, 1.1 * z);
      ctx.stroke(lit);
      // a beirada (a saia e as duas bocas, da cabeça e do rabo): mais escura
      const rim = new Path2D();
      if (F.k < 0.6) {
        shellLine(rim, cam, F, (k) => [-th0 + 2 * th0 * k, ph0 * 0.985], 18, -0.2);
        shellLine(rim, cam, F, (k) => [-th0 + 2 * th0 * k, -ph0 * 0.985], 18, -0.2);
      }
      shellLine(rim, cam, F, (k) => [th0 * 0.985, -ph0 + 2 * ph0 * k], 10, -0.2);
      shellLine(rim, cam, F, (k) => [-th0 * 0.985, -ph0 + 2 * ph0 * k], 10, -0.2);
      ctx.strokeStyle = C.tint(RIM, flash);
      ctx.lineWidth = Math.max(1.2, 3 * z);
      ctx.stroke(rim);
      // fechado na bola: o escudo da cabeça (com as orelhinhas) e o do rabo, encaixados no fundo da bola — aparecem
      // rolando (o jeito do tatu-bola fechado)
      if (F.th0 > 2.6) {
        const gp = shellPt(F, Math.PI, 0);
        if (M.dot(shellN(F, Math.PI, 0), cam.toCamera) > 0.05) {
          const R = Math.min(F.a, F.b);
          const back = M.scale(F.f, -1);
          const P3 = (x, y) => cam.p(M.add(gp, M.add(M.scale(back, x * R), M.scale(F.s, y * R))));
          // cada escudo: um triângulo de cantos redondos (a curva passa pelo meio de cada lado)
          const plate = (xy, fill) => {
            const q = xy.map(([x, y]) => P3(x, y));
            const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            ctx.beginPath();
            const m0 = mid(q[0], q[1]);
            ctx.moveTo(m0.x, m0.y);
            for (let i = 1; i <= 3; i++) {
              const c = q[i % 3], m = mid(q[i % 3], q[(i + 1) % 3]);
              ctx.quadraticCurveTo(c.x, c.y, m.x, m.y);
            }
            ctx.closePath();
            ctx.fillStyle = C.tint(fill, flash);
            ctx.fill();
            ctx.strokeStyle = C.tint(GROOVE, flash);
            ctx.lineWidth = Math.max(0.8, 1.2 * z);
            ctx.stroke();
          };
          ctx.fillStyle = C.tint(LOOK.skin.base, flash);
          for (const y of [-0.3, 0.3]) {
            const q = P3(-0.55, y);
            ctx.beginPath();
            ctx.arc(q.x, q.y, 0.1 * R * z, 0, M.TAU);
            ctx.fill();
          }
          plate([[-0.5, -0.34], [-0.5, 0.34], [0.06, 0]], '#a7804d');
          plate([[0.46, -0.2], [0.46, 0.2], [0.02, 0]], '#9c7646');
        }
      }
    }

    /** A barriga (desmaiado, para cima): a pele clara e peluda entre as patas. */
    _paintBelly(ctx, cam, rig, ink, flash) {
      const F = rig.shell;
      const n = M.scale(rig.body.u, -1);
      if (M.dot(n, cam.toCamera) < 0.05) return;
      const c = M.add(F.c, M.scale(rig.body.u, -F.h * 0.12));
      const q = cam.p(c);
      const a = cam.pDir(rig.body.f), b = cam.pDir(rig.body.s);
      const ru = F.a * 0.82, rv = F.b * 0.8;
      const trace = (dx, dy, p) => {
        const N = 20;
        for (let i = 0; i <= N; i++) {
          const t = (i / N) * M.TAU;
          const x = q.x + dx + a.x * Math.cos(t) * ru + b.x * Math.sin(t) * rv;
          const y = q.y + dy + a.y * Math.cos(t) * ru + b.y * Math.sin(t) * rv;
          if (i) p.lineTo(x, y);
          else p.moveTo(x, y);
        }
        return p;
      };
      P.paintLit(ctx, cam, trace, LOOK.belly, 0, ink, flash, { heavy: false });
      // os pelinhos
      if (small(cam.zoom)) return;
      ctx.strokeStyle = 'rgba(120, 84, 74, 0.55)';
      ctx.lineWidth = Math.max(0.6, 0.5 * cam.zoom);
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const u = C.hash01(i * 3.3 + 1) * 1.6 - 0.8, v = C.hash01(i * 7.1 + 2) * 1.4 - 0.7;
        const x = q.x + a.x * u * ru + b.x * v * rv, y = q.y + a.y * u * ru + b.y * v * rv;
        ctx.moveTo(x, y);
        ctx.lineTo(x + a.x * 2.2 * S, y + a.y * 2.2 * S + 0.6);
      }
      ctx.stroke();
    }

    /** Uma pata curta: a perna de pele grossa e as unhas (as da frente, compridas e curvas). */
    _paintLeg(ctx, cam, L, st, ink, flash) {
      const z = cam.zoom;
      const pts = L.pts.map((p) => cam.p(p));
      const rads = [3.0, 2.6, 2.2, 1.9, 1.7].map((r) => r * S * z * (1 - 0.4 * st.curl));
      const shape = P.limbShape(pts, rads);
      P.paintLit(ctx, cam, (dx, dy, p) => P.limbPath(shape, dx, dy, p), LOOK.leg, small(z) ? 0 : rads[1] * 0.55, ink, flash, {
        stroke: (dx, dy, p) => P.limbStrokePath(shape, dx, dy, p),
        heavy: false,
        highlight: 0,
      });
      // as unhas: da ponta do pé para a frente (as da frente, compridas, curvas para baixo)
      const f = cam.p(L.foot), tq = cam.p(L.toe);
      const dx = tq.x - f.x, dy = tq.y - f.y;
      const dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl, uy = dy / dl;
      const nx = -uy, ny = ux;
      const n = L.front ? 3 : 4;
      const w = rads[4];
      ctx.fillStyle = C.tint(LOOK.claw.base, flash);
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = Math.max(0.6, 0.5 * z);
      for (let i = 0; i < n; i++) {
        const o = n === 1 ? 0 : (i / (n - 1) - 0.5) * 1.2 * w;
        const bx = f.x + nx * o + ux * w * 0.4, by = f.y + ny * o + uy * w * 0.4;
        const lenC = (L.front ? 2.4 : 1.1) * S * z * (1 - st.curl);
        if (lenC < 0.6) continue;
        ctx.beginPath();
        ctx.moveTo(bx + nx * w * 0.22, by + ny * w * 0.22);
        ctx.quadraticCurveTo(bx + ux * lenC * 0.7, by + uy * lenC * 0.7 + lenC * 0.1, bx + ux * lenC, by + uy * lenC + lenC * 0.35);
        ctx.lineTo(bx - nx * w * 0.22, by - ny * w * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    /** O rabo curto: um cone de casca com os anéis escuros. */
    _paintTail(ctx, cam, rig, ink, flash) {
      const z = cam.zoom;
      const pts = rig.tail.map((b) => cam.p(b.c));
      const rads = rig.tail.map((b) => b.r * z);
      const shape = P.limbShape(pts, rads);
      P.paintLit(ctx, cam, (dx, dy, p) => P.limbPath(shape, dx, dy, p), LOOK.shell, small(z) ? 0 : rads[0] * 0.5, ink, flash, {
        heavy: false,
        inside: (c) => {
          // os anéis: riscos atravessando o rabo, contados pelo comprimento na tela (o rabo vindo para a câmera fica
          // com menos pontos)
          const sp = shape.pts;
          if (sp.length < 2) return;
          const acc = [0];
          for (let i = 1; i < sp.length; i++) acc.push(acc[i - 1] + Math.hypot(sp[i].x - sp[i - 1].x, sp[i].y - sp[i - 1].y));
          const total = acc[acc.length - 1];
          if (total < 2) return;
          c.strokeStyle = C.tint(GROOVE, flash);
          c.lineWidth = Math.max(0.8, 1.1 * z);
          c.beginPath();
          for (const k of [0.28, 0.52, 0.74]) {
            const s = k * total;
            let i = 1;
            while (i < sp.length - 1 && acc[i] < s) i++;
            const a = sp[i - 1], b = sp[i];
            const f = (s - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
            const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
            const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l;
            const w = (shape.rads[i - 1] + (shape.rads[i] - shape.rads[i - 1]) * f) * 1.2;
            c.moveTo(x - nx * w, y - ny * w);
            c.lineTo(x + nx * w, y + ny * w);
          }
          c.stroke();
        },
      });
    }

    /**
     * A cabeça pontuda: a pele (do pescoço ao focinho), o escudo de casca em cima (de onde as orelhas saem), os
     * olhinhos pretos (tonto: espirais; apertados no tranco; fechados desmaiado) e a pontinha do nariz.
     */
    _paintHead(ctx, cam, rig, st, ink, flash) {
      const z = cam.zoom;
      const H = rig.head;
      const pts = H.map((p) => cam.p(p));
      const rads = rig.headR.map((r) => r * z);
      const shape = P.limbShape(pts, rads);
      P.paintLit(ctx, cam, (dx, dy, p) => P.limbPath(shape, dx, dy, p), LOOK.skin, small(z) ? 0 : rads[1] * 0.5, ink, flash, {
        heavy: false,
        highlight: 0.3,
      });
      const { hf, hs, hu } = rig;
      const tc = cam.toCamera;
      // o escudo da cabeça: uma placa de casca em cima, do alto da nuca até perto do focinho
      if (M.dot(hu, tc) > -0.25) {
        const left = [], right = [];
        for (let i = 1; i <= 3; i++) {
          const r = rig.headR[i];
          const top = M.add(H[i], M.scale(hu, r * 0.55));
          left.push(cam.p(M.add(top, M.scale(hs, -r * 0.78))));
          right.push(cam.p(M.add(top, M.scale(hs, r * 0.78))));
        }
        const tip = cam.p(M.add(H[3], M.add(M.scale(hu, rig.headR[3] * 0.8), M.scale(hf, rig.headR[3] * 0.5))));
        const back = cam.p(M.add(H[1], M.add(M.scale(hu, rig.headR[1] * 0.9), M.scale(hf, -rig.headR[1] * 0.75))));
        const plate = (dx, dy, p) => {
          p.moveTo(back.x + dx, back.y + dy);
          p.quadraticCurveTo(left[0].x + dx, left[0].y + dy, left[1].x + dx, left[1].y + dy);
          p.quadraticCurveTo(left[2].x + dx, left[2].y + dy, tip.x + dx, tip.y + dy);
          p.quadraticCurveTo(right[2].x + dx, right[2].y + dy, right[1].x + dx, right[1].y + dy);
          p.quadraticCurveTo(right[0].x + dx, right[0].y + dy, back.x + dx, back.y + dy);
          p.closePath();
          return p;
        };
        P.paintLit(ctx, cam, plate, LOOK.shell, 0, ink, flash, { heavy: false });
        if (!small(z)) {
          // as plaquinhas do escudo
          ctx.strokeStyle = SCUTE;
          ctx.lineWidth = Math.max(0.6, 0.6 * z);
          ctx.beginPath();
          ctx.moveTo((left[0].x + back.x) / 2, (left[0].y + back.y) / 2);
          ctx.lineTo((right[0].x + back.x) / 2, (right[0].y + back.y) / 2);
          ctx.moveTo(left[1].x, left[1].y);
          ctx.lineTo(right[1].x, right[1].y);
          ctx.stroke();
        }
      }
      // os olhos: dos lados, logo embaixo do escudo
      const color = C.eyeColor ? C.eyeColor(EYE) : EYE;
      const glow = C.eyeGlow ? C.eyeGlow(null) : null;
      for (const sg of [-1, 1]) {
        const out = M.scale(hs, sg);
        if (M.dot(out, tc) < -0.1) continue;
        const r = rig.headR[2];
        const c = cam.p(M.add(H[2], M.add(M.scale(out, r * 0.86), M.add(M.scale(hu, r * 0.18), M.scale(hf, -r * 0.1)))));
        const er = Math.max(1.3, 1.2 * S * z);
        ctx.lineCap = 'round';
        if (st.dying !== null) {
          ctx.strokeStyle = C.INK;
          ctx.lineWidth = Math.max(0.8, 0.5 * z);
          ctx.beginPath();
          ctx.moveTo(c.x - er, c.y - er);
          ctx.lineTo(c.x + er, c.y + er);
          ctx.moveTo(c.x + er, c.y - er);
          ctx.lineTo(c.x - er, c.y + er);
          ctx.stroke();
          continue;
        }
        if (st.rec > 0.3 || st.block > 0.4) {
          ctx.strokeStyle = C.INK;
          ctx.lineWidth = Math.max(0.8, 0.55 * z);
          ctx.beginPath();
          ctx.moveTo(c.x - er * 1.1, c.y);
          ctx.lineTo(c.x + er * 1.1, c.y - er * 0.3);
          ctx.stroke();
          continue;
        }
        if (st.dizzy > 0.2) {
          // tonto: a espiral girando
          ctx.strokeStyle = C.INK;
          ctx.lineWidth = Math.max(0.7, 0.45 * z);
          ctx.beginPath();
          const spin = st.t * 9 * sg;
          for (let k = 0; k <= 14; k++) {
            const a = spin + (k / 14) * 3 * Math.PI;
            const rr = er * 1.25 * (k / 14);
            if (k) ctx.lineTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
            else ctx.moveTo(c.x, c.y);
          }
          ctx.stroke();
          continue;
        }
        if (glow) {
          ctx.fillStyle = glow;
          ctx.globalAlpha *= 0.45;
          ctx.beginPath();
          ctx.arc(c.x, c.y, er * 2.4, 0, M.TAU);
          ctx.fill();
          ctx.globalAlpha /= 0.45;
        }
        ctx.fillStyle = C.tint(color, flash);
        ctx.beginPath();
        ctx.arc(c.x, c.y, er, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(c.x - er * 0.35, c.y - er * 0.35, Math.max(0.5, er * 0.36), 0, M.TAU);
        ctx.fill();
      }
      // a pontinha do nariz
      const tipQ = pts[pts.length - 1];
      const nr = Math.max(1, rads[rads.length - 1] * 0.95);
      P.paintLit(ctx, cam, (dx, dy, p) => {
        p.moveTo(tipQ.x + dx + nr, tipQ.y + dy);
        p.arc(tipQ.x + dx, tipQ.y + dy, nr, 0, M.TAU);
        return p;
      }, LOOK.nose, 0, ink, flash, { heavy: false });
    }

    /** Uma orelhinha redonda, em pé atrás do escudo da cabeça, com o miolo mais escuro. */
    _paintEar(ctx, cam, e, rig, ink, flash) {
      const z = cam.zoom;
      const q = cam.p(e.c);
      const r = e.r * z;
      const up = cam.pDir(rig.hu);
      const ang = Math.atan2(up.y, up.x) + Math.PI / 2 + 0.35 * e.sg;
      P.paintLit(ctx, cam, (dx, dy, p) => {
        p.moveTo(q.x + dx + Math.cos(ang) * r * 0.78, q.y + dy + Math.sin(ang) * r * 0.78);
        p.ellipse(q.x + dx, q.y + dy, r * 0.78, r, ang, 0, M.TAU);
        return p;
      }, LOOK.skin, 0, ink, flash, { heavy: false });
      // o miolo (a parte de dentro, virada para a frente): só com a cara para a câmera
      if (M.dot(rig.hf, cam.toCamera) < -0.3) return;
      ctx.fillStyle = C.tint(EAR_IN, flash);
      ctx.beginPath();
      ctx.ellipse(q.x, q.y + r * 0.08, r * 0.42, r * 0.6, ang, 0, M.TAU);
      ctx.fill();
    }

    /** A poeira levantada: nuvenzinhas cor de terra que crescem e somem. */
    _paintDust(ctx, cam) {
      if (!this.dust.length) return;
      const z = cam.zoom;
      const a0 = ctx.globalAlpha;
      for (const d of this.dust) {
        const age = (this.time - d.t) / 0.6;
        if (age < 0 || age >= 1) continue;
        const q = cam.p({ x: d.x, y: d.y, z: this.groundZ + (2 + 10 * age) * S });
        const r = (3 + 7 * age) * S * z * d.s;
        ctx.globalAlpha = a0 * 0.5 * (1 - age) * Math.min(1, age * 8);
        ctx.fillStyle = 'rgb(186, 160, 120)';
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, M.TAU);
        ctx.fill();
      }
      ctx.globalAlpha = a0;
    }

    /** A casca segurou: a faísca branca do lado de quem bateu (o "tlinc"). */
    _paintSpark(ctx, cam, rig) {
      const F = rig.shell;
      const k = this.blockT / 0.35;
      const away = this._fromHero();
      const dir = away ? { x: -away.x, y: -away.y, z: 0.35 } : M.add(rig.body.f, { x: 0, y: 0, z: 0.35 });
      const p = cam.p(M.add(F.c, M.scale(M.norm(dir), Math.max(F.a, F.b) * 0.8)));
      const z = cam.zoom;
      ctx.save();
      ctx.globalAlpha *= 1 - k;
      ctx.strokeStyle = '#fff8d8';
      ctx.lineWidth = 2.2 * z;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * M.TAU + 0.3;
        const r0 = (4 + k * 6) * z, r1 = (11 + k * 15) * z;
        ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0 * 0.8);
        ctx.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1 * 0.8);
      }
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, (4.5 - k * 2.5) * z, 0, M.TAU);
      ctx.fill();
      ctx.restore();
    }

    /** Tonto: as estrelinhas girando em cima da cabeça. */
    _paintStars(ctx, cam, rig, st) {
      const z = cam.zoom;
      const top = cam.p(M.add(rig.head[1], { x: 0, y: 0, z: 12 * S }));
      ctx.save();
      ctx.globalAlpha *= Math.min(1, st.dizzy * 1.5);
      for (let i = 0; i < 3; i++) {
        const a = st.t * 4 + (i / 3) * M.TAU;
        star5(ctx, top.x + Math.cos(a) * 12 * z, top.y + Math.sin(a) * 4.5 * z, 3.8 * z, z);
      }
      ctx.restore();
    }

    /**
     * Desmaiado: o encanto sai do corpo — um clarão lilás e as faíscas roxas que se espalham e sobem, sumindo (o motor
     * tira o desenho 0,7 s depois da queda; o corpo apaga de 0,4 a 0,7 s). O mesmo do sagui e do quati.
     */
    _release(ctx, cam, heart, d) {
      const z = cam.zoom;
      const q = cam.p(heart);
      if (d < 0.5) {
        const k = d / 0.5;
        const rr = (12 + 24 * M.easeOut(k)) * S * z;
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr);
        g.addColorStop(0, `rgba(214, 178, 255, ${0.55 * (1 - k)})`);
        g.addColorStop(1, 'rgba(180, 140, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rr, 0, M.TAU);
        ctx.fill();
      }
      const N = 14;
      ctx.save();
      const base = ctx.globalAlpha;
      for (let i = 0; i < N; i++) {
        const r1 = C.hash01(i * 3.1 + this.seed * 50), r2 = C.hash01(i * 7.7 + 1.3), r3 = C.hash01(i * 1.9 + 4.2);
        const t0 = 0.04 + r3 * 0.14;
        const k = (d - t0) / 0.5;
        if (k <= 0 || k >= 1) continue;
        const a = (i / N) * M.TAU + r1 * 0.7;
        const dist = (8 + 20 * r2) * S * M.easeOut(k);
        const rise = (10 + 40 * r1) * S * k;
        const p = cam.p({ x: heart.x + Math.cos(a) * dist, y: heart.y + Math.sin(a) * dist, z: heart.z + rise });
        const s = (2.2 + 1.8 * r2) * z * (1 - 0.55 * k);
        ctx.globalAlpha = base * (k < 0.12 ? k / 0.12 : 1 - M.smoothstep(0.5, 1, k));
        ctx.fillStyle = 'rgba(181, 140, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 2.2, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = SPARK;
        star4(ctx, p.x, p.y, s);
        ctx.fill();
        ctx.fillStyle = '#f4ecff';
        star4(ctx, p.x, p.y, s * 0.45);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  C.define('tatu_bola', Tatu);
})(window.PD = window.PD || {});
