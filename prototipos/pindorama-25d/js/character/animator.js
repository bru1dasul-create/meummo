// O personagem que se mexe: física simples (andar, correr, pular), estados (agachado, atacando) e o
// animador procedural, que transforma tudo isso numa pose para o esqueleto a cada quadro.
//
// Nada de quadros desenhados: a passada é calculada pela distância andada. O pé que pisa fica preso no chão e
// rola do calcanhar para a ponta (o tornozelo gira em volta do ponto que encosta, então nada escorrega); a pelve
// sobe no meio do apoio e desce quando os dois pés estão no chão; braços e cabeça têm "peso" (molas fazem eles
// atrasarem um pouco em relação ao corpo, como gente de verdade). As transições (parar, agachar, pular, socar)
// são misturas suaves entre poses.
(function (PD) {
  'use strict';
  const M = PD.math;
  const B = PD.BODY;
  const { clamp, clamp01, lerp, smoothstep, easeInOut, easeOut, damp, dampAngle, angleDiff, DEG, TAU } = M;

  const SPEED = { walk: 160, run: 440, crouch: 82 };
  const ACCEL = { ground: 2400, brake: 3000, air: 520 };
  const GRAVITY = 1550;
  const RADIUS = 22; // corpo no chão (colisão)
  // giro máximo do corpo, em graus por segundo: vira rápido, mas sem pular de pose de um quadro para o outro
  const TURN = { still: 480, run: 420, attack: 720 };
  // Agilidade apenas na inversão sobre a base de apoio; a marcha mantém seu ritmo.
  // turnAccel: o giro do pivô acelera até `turn` (graus/s²); começar já no máximo dava um tranco no corpo todo
  const PIVOT = { turn: 600, turnAccel: 15000, footTurn: 7.2, step: 0.14, release: 50 };
  // Virada ágil (escolha do dono para o jogo, 12/11): quem a PD.View move vira mais depressa. É a mesma coreografia
  // (freia, gira sobre os pés com passinhos, sai correndo), com mais aceleração, giro e pivô mais rápidos e passos do
  // pivô mais curtos; o pivô só começa abaixo de `pivotSpeed` (cm/s): parar de girar ainda correndo dava solavanco no
  // joelho. Só com `input.agile`: o jogo do protótipo não muda. Medido em ferramentas/seguir.cjs.
  const AGILE = { accel: 1.8, turn: 1.6, pivot: 1.8, step: 0.85, release: 75, pivotSpeed: 150 };
  const DODGE = { total: 0.4, distance: 100, moveStart: 0.018, moveEnd: 0.245, cooldown: 0.2 };
  // O rolamento da esquiva do jogo (3 m, o servidor já pôs o herói lá): encolhe, rola uma volta no chão e levanta
  const ROLL = { total: 0.5, moveStart: 0.04, moveEnd: 0.4, cooldown: 0.05 };
  const DEATH = { total: 1.35, impact: 0.64 };
  const HIT = { total: 0.64, lock: 0.22 };
  // para onde o cotovelo aponta (frente, fora, cima, no espaço do peito)
  const POLE = {
    solto: [-0.95, 0.32, -0.15],
    correndo: [-0.5, 0.6, -0.6],
    ar: [-0.85, 0.35, -0.4],
    golpe: [-0.35, 0.75, -0.6],
    armado: [-0.55, 0.22, -0.85], // armando: cotovelo para baixo e para trás, junto ao corpo (nada de "asa")
    guarda: [-0.6, 0.55, -0.55],
  };

  // fases do soco: preparar (guarda), armar, golpe, segurar, recolher, voltar
  const PUNCH = [
    ['guarda', 0.07],
    ['armar', 0.085],
    ['golpe', 0.085],
    ['impacto', 0.06],
    ['recolher', 0.16],
    ['voltar', 0.24],
  ];
  const PUNCH_AT = {};
  {
    let t = 0;
    for (const [name, d] of PUNCH) {
      PUNCH_AT[name] = [t, t + d];
      t += d;
    }
    PUNCH_AT.total = t;
  }

  // golpe: acelera em um ou dois quadros e chega rápido no alvo (sem sair do zero para 26 cm num quadro)
  const strikeEase = (k) => 1 - Math.pow(1 - Math.pow(clamp01(k), 1.6), 2.2);
  const smoother = (x) => {
    const t = clamp01(x);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const fallEase = (x) => {
    const u = clamp01(x);
    if (u <= 0.78) return u * u * (2 - u);
    const v = (u - 0.78) / 0.22, v2 = v * v, v3 = v2 * v;
    return (2 * v3 - 3 * v2 + 1) * 0.742248 + (v3 - 2 * v2 + v) * 0.284856 - 2 * v3 + 3 * v2;
  };
  const mixV = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  const mixPole = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const copyHand = (h) => ({ local: { x: h.local.x, y: h.local.y, z: h.local.z }, twist: h.twist, poleLocal: h.poleLocal.slice(), fist: h.fist, flex: h.flex || 0 });
  // pose do soco como lista de números (para a emenda do combo somar posição e velocidade)
  const packPB = (b) => [b.chest, b.hips, b.push[0], b.push[1], b.dz, b.dy, b.pitch, b.heel];
  const unpackPB = (a) => ({ chest: a[0], hips: a[1], push: [a[2], a[3]], dz: a[4], dy: a[5], pitch: a[6], heel: a[7] });
  const packHand = (h) => [h.local.x, h.local.y, h.local.z, h.twist, h.poleLocal[0], h.poleLocal[1], h.poleLocal[2], h.fist, h.flex || 0];
  const unpackHand = (a) => ({ local: { x: a[0], y: a[1], z: a[2] }, twist: a[3], poleLocal: [a[4], a[5], a[6]], fist: a[7], flex: a[8] });
  const BLEND_W = 28; // rapidez com que a diferença da emenda some (1/s)

  /**
   * Pé que rola. Com o calcanhar no chão (`deg` > 0: ponta para cima) o pé gira em volta do calcanhar; com a ponta no
   * chão (`deg` < 0: calcanhar para cima) gira em volta da base dos dedos. Devolve quanto o tornozelo anda (para a
   * frente do pé e para cima) em relação ao pé chato: assim o ponto que encosta no chão fica parado.
   */
  function rocker(deg) {
    const a = Math.abs(deg) * DEG;
    const h = B.ankleHeight;
    const c = Math.cos(a);
    const s = Math.sin(a);
    if (deg < 0) {
      const b = B.ballFwd;
      return { f: b - b * c + h * s, u: b * s + h * c - h };
    }
    const k = B.heelBack;
    return { f: k * c - k - h * s, u: k * s + h * c - h };
  }
  /** Tornozelo a partir do "pé chato" (`ref`), do ângulo do pé (graus) e da direção dele. */
  function ankleOf(ref, deg, yaw) {
    const o = rocker(deg);
    return { x: ref.x + Math.cos(yaw) * o.f, y: ref.y + Math.sin(yaw) * o.f, z: ref.z + o.u };
  }
  /** O contrário: o "pé chato" que corresponde a um tornozelo. */
  function refOf(ankle, deg, yaw) {
    const o = rocker(deg);
    return { x: ankle.x - Math.cos(yaw) * o.f, y: ankle.y - Math.sin(yaw) * o.f, z: ankle.z - o.u };
  }

  /**
   * Braço por ângulos (alvo do punho em relação ao ombro): `lift` = braço para a frente, `bend` = cotovelo, `abd` =
   * braço aberto para o lado (rad); `out` = para fora (cm).
   */
  function armFK(lift, bend, out, abd = 0) {
    const y = B.upperArm * Math.sin(lift) + B.forearm * Math.sin(lift + bend);
    const z = -B.upperArm * Math.cos(lift) - B.forearm * Math.cos(lift + bend);
    return { x: out - z * Math.sin(abd), y, z: z * Math.cos(abd) };
  }
  // mãos no pulo (alvo do punho a partir do ombro, no espaço do peito: x = para fora, y = frente, z = cima). Os dois
  // braços fazem o mesmo: para trás no preparo, um balanço para a frente no impulso (cotovelo dobrado, punho na
  // altura do peito) e, no ar, soltos, um pouco abertos e para a frente. Antes os braços ficavam esticados para a
  // frente o voo inteiro (cara de zumbi) e depois abriam em "asa de avião"
  const JUMP_HANDS = { tras: { x: 6, y: -16, z: -46 }, impulso: { x: 8, y: 26, z: -16 }, ar: { x: 14, y: 10, z: -36 } };

  /**
   * Alcance suave (o "soft IK" dos animadores): perto do comprimento total da perna, a distância cresce cada vez mais
   * devagar e nunca passa dele. Assim o joelho estica aos poucos (sem estalar) e o pé nunca fica longe do alvo.
   */
  function softReach(d, L, soft) {
    const d0 = L - soft;
    if (d <= d0) return d;
    return d0 + soft * (1 - Math.exp(-(d - d0) / soft));
  }

  /** Pelve montada igual ao esqueleto (para conferir o alcance das pernas antes de montar). */
  function pelvisFrame(body, pv) {
    const f = M.moved(body, M.at(body, pv.dx, pv.dy, B.hipStand + B.pelvisUp + pv.dz));
    return M.roll(M.pitch(M.yawBy(f, pv.yaw), pv.pitch), pv.roll);
  }

  class Character {
    /** `opcoes.classe`: id de uma classe de js/character/classes.js (sem nada: 'semClasse', o personagem base). */
    constructor(x, y, yaw = Math.PI / 4, opcoes = {}) {
      this.classe = opcoes.classe || 'semClasse';
      this.pos = { x, y, z: 0 }; // z = altura do pulo (acima do chão)
      this.groundZ = 0; // altura do chão embaixo (calçada 14 cm, rua 0)
      this.vel = { x: 0, y: 0 };
      this.vz = 0;
      this.yaw = yaw;
      this.yawRate = 0;
      this.turnLead = 0; // quanto a cabeça vai na frente numa curva (rad)
      this.faceYaw = null; // para onde o jogador mandou virar por último
      this._attackRate = 1; // ritmo do relógio do soco (mais lento enquanto o corpo ainda vira para o alvo)
      this.speed = 0;
      this.phase = 0;
      this.gait = 0;
      this.runBlend = 0;
      this._runRequest = false;
      this._strideTransitionUntil = 0;
      this.dodge = null;
      this.death = null;
      this.hurt = null;
      this.dodgeCooldown = 0;
      this._recoverPose = null;
      this.crouch = 0;
      this.crouchWanted = false;
      this.jump = { state: 'chao', t: 0, impact: 0, crouch: 0, air: 0, running: 0, lead: 0 };
      this.attack = null;
      this.nextHand = 1; // começa com a direita
      this.lastLead = 0; // pé da frente da última guarda
      this.time = 0;
      this.blinkIn = 2.2;
      this.blinkT = -1;
      this.accel = { x: 0, y: 0 };
      this.leanPitch = 0;
      this.leanRoll = 0;
      this.events = [];
      this.label = 'Parado';
      this.stanceLead = 0; // pés em posição de luta (0..1)
      this.footAir = [0, 0];
      this.stepCooldown = 0;
      this.hipDrop = 0; // quanto a pelve desce para a perna de apoio alcançar o pé
      this.airArm = 0; // braços no jeito do pulo (0..1)
      this.armFirm = 0; // firmeza da mola dos braços (0 no chão, 1 no pulo)
      // molas do movimento secundário (cabelo, penas, colar, cordão, brinco)
      const z0 = { x: 0, y: 0, z: 0 };
      this.springs = {
        hair: new M.Spring3(z0),
        feathers: [0, 1, 2, 3, 4].map(() => new M.Spring3(z0)),
        pendant: new M.Spring3(z0),
        tassel: new M.Spring3(z0),
        earring: new M.Spring3(z0),
        flaps: [new M.Spring3(z0), new M.Spring3(z0)], // abas da tanga (frente, trás)
      };
      this.prevPelvis = null;
      this.pelvisVel = { x: 0, y: 0, z: 0 };
      this.armSprings = [null, null]; // o braço é um pêndulo com peso
      this.headSpring = null; // a cabeça também: segue o peito com um atraso pequeno
      this.prevHead = null;
      this.headVel = { x: 0, y: 0, z: 0 };
      this.look = { blink: 0, hairWind: z0, featherSwing: [z0, z0, z0, z0, z0], pendantSwing: z0, tasselSwing: z0, earringSwing: z0, flapSwing: [z0, z0], gazeX: 0, gazeY: 0, mouthOpen: 0, browRaise: 0 };
      this.radius = RADIUS;
      this.equipped = {}; // encaixe → id do item (vazio: o personagem começa sem nada)
      // trava dos pés: o pé que pisa fica preso no chão até o próximo passo (nada de escorregar).
      // x, y = "pé chato" (onde o pé fica sem rolar); o tornozelo sai daí girando em volta do calcanhar ou da ponta.
      this.footLock = [0, 1].map(() => ({ planted: false, x: 0, y: 0, yaw: 0, step: null, lastX: null, lastY: null }));
      this._dt = 1 / 60;
      this._pose = null;
      this._punchOut = null; // a última pose do soco (o combo começa dela)
      this._punchPrev = null; // a do quadro anterior (para a velocidade na emenda)
      // equipamento inicial da classe (se ela tiver)
      const cls = PD.classes && PD.classes.get(this.classe);
      if (cls) for (const [slot, id] of Object.entries(cls.equipamentoInicial || {})) this.equip(slot, id);
    }

    // ------------------------------------------------------------------ lógica (por quadro)
    /** `input`: { move: {x, y}, run, crouchToggle, jump, attack, attackDir, dodge, die, hit }. Ações são pulsos. */
    update(dt, input = {}, world) {
      if (!(dt > 0)) return;
      const count = Math.max(1, Math.ceil(dt * 120 - 1e-8));
      const h = dt / count;
      for (let k = 0; k < count; k++) {
        const frameInput = k ? { ...input, jump: false, attack: false, attackReleased: false, attackCancel: false, crouchToggle: false, dodge: false, die: false, hit: false } : input;
        this._updateStep(h, frameInput, world);
        this.pose();
      }
    }

    _updateStep(dt, input, world) {
      this.time += dt;
      this._dt = dt;
      this.stepCooldown = Math.max(0, this.stepCooldown - dt);
      this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
      const t = this.time;

      // Morte tem prioridade; os outros comandos ficam bloqueados até recomeçar.
      if (input.die) this.die();
      if (input.hit) this.reactToHit(input.hit === true ? {} : input.hit);
      if (input.attackCancel && PD.slingshot) { PD.slingshot.cancel(this); input = { ...input, attack: false }; }
      if (!this.death && input.dodge) this._startDodge(input.move, world);
      if (PD.guard) input = PD.guard.update(this, dt, input);
      if (this.death || this.dodge) {
        this._updateAction(dt, world, input);
        this.label = this._label();
        if (this.death || this.dodge) this._pose = null;
        return;
      }
      if (this.hurt) {
        this.hurt.t += dt;
        if (this.hurt.t >= HIT.total - 1e-8) this.hurt = null;
        else {
          // O salto já iniciado continua na física normal. Bloqueia apenas novos comandos.
          input = { ...input, attack: false, jump: false, crouchToggle: false, crouchSet: undefined };
          if (this.hurt.t < HIT.lock) input = { ...input, move: null, run: false };
        }
      }
      if (this._lastPushVelocity) {
        this.vel.x -= this._lastPushVelocity.x; this.vel.y -= this._lastPushVelocity.y;
        this._lastPushVelocity = null;
      }

      // agachar (liga/desliga) — no ar não agacha
      if (input.crouchToggle && this.jump.state === 'chao') this.crouchWanted = !this.crouchWanted;
      if (input.crouchSet !== undefined && this.jump.state === 'chao') this.crouchWanted = input.crouchSet;

      // pular (do chão; agachado, levanta e pula)
      if (input.jump && (this.jump.state === 'chao' || (this.jump.state === 'pouso' && this.jump.t > 0.12)) && !this.attackBusy()) {
        this.crouchWanted = false;
        this.jump.state = 'preparo';
        this.jump.t = 0;
        this.jump.running = clamp01((this.speed - SPEED.walk) / (SPEED.run - SPEED.walk));
        this.jump.lead = this.phase % 1 < 0.5 ? 0 : 1;
        this.jump.prepFrom = this.jump.crouch;
        for (const st of this.footLock) { st.air = null; st.pushX = undefined; }
      }

      // soco (com combinação: clicar de novo no fim do golpe emenda o próximo com a outra mão)
      if (input.attack) {
        const move = input.move;
        const dir = input.attackDir != null ? input.attackDir : move && Math.hypot(move.x, move.y) > 0.08 ? Math.atan2(move.y, move.x) : this.yaw;
        if (!this.attack) this._startAttack(dir, false, input);
        else if (this.attack.kind !== 'slingshot' && !this.attack.queued) {
          this.attack.queued = true;
          this.attack.queuedDir = dir;
        }
      }

      // Inverter a direção começa por frear e virar sobre a base de apoio.
      // Continuar prevendo uma passada na direção antiga fazia as pernas cruzarem.
      // movimento desejado
      const mv = input.move || { x: 0, y: 0 };
      const mag = clamp01(Math.hypot(mv.x, mv.y));
      const ag = (this._ag = input.agile ? AGILE : null);
      if (mag > 0.02) this.faceYaw = Math.atan2(mv.y, mv.x);
      let maxSpeed = this.crouchWanted ? SPEED.crouch : input.run ? SPEED.run : SPEED.walk;
      // quem anima pela posição do servidor (PD.View) pode pedir um pouco mais de velocidade para não ficar para trás
      if (input.speedScale > 1) maxSpeed *= Math.min(input.speedScale, 1.35);
      // pediu para ir muito para o lado ou para trás de onde está virado: anda no máximo a 45° da própria frente, e
      // mais devagar, enquanto vira (faz a curva em vez de andar de lado com as pernas cruzando)
      let moveDir = mag > 0.02 ? this.faceYaw : null;
      if (moveDir !== null && this.jump.state === 'chao') {
        const angle = Math.abs(angleDiff(this.yaw, moveDir));
        if (angle > 100 * DEG && (!ag || this.speed < ag.pivotSpeed)) this.turnInPlace = true;
        if (angle < (ag ? ag.release : PIVOT.release) * DEG && this.turnInPlace) {
          this.turnInPlace = false;
          // A saída da freada começa em apoio duplo, não no meio de um balanço antigo.
          this.phase = 0;
        }
      } else if (this.jump.state !== 'chao') this.turnInPlace = false;
      if (moveDir !== null) {
        const off = angleDiff(this.yaw, moveDir);
        if (Math.abs(off) > 45 * DEG) {
          moveDir = this.yaw + Math.sign(off) * 45 * DEG;
          maxSpeed *= lerp(1, 0.15, smoothstep(45 * DEG, 120 * DEG, Math.abs(off)));
        }
      }
      if (this.turnInPlace) maxSpeed = 0;
      if (this.guard?.blend) maxSpeed *= 1 - (1 - PD.guard.RULES.walkFactor) * this.guard.blend;
      if (this.hurt) maxSpeed *= smoothstep(HIT.lock, 0.42, this.hurt.t);
      if (this.attack) {
        const at = this.attack.t;
        const brace = this.attack.kind === 'slingshot'
          ? smoothstep(0, 0.12, this.attack.age) * (this.attack.stage === 'charging' ? 1 : 1 - smoothstep(0.1, PD.slingshot.RULES.recover, at))
          : smoothstep(0, 0.09, at) * (1 - smoothstep(PUNCH_AT.recolher[0], PUNCH_AT.total, at));
        maxSpeed *= 1 - (this.attack.kind === 'slingshot' ? 0.12 : 0.35) * brace;
      }
      if (this.jump.state === 'preparo') maxSpeed *= 0.55;
      if (this.jump.state === 'pouso') maxSpeed *= 0.6 + 0.4 * clamp01(this.jump.t / 0.22);
      const want = moveDir !== null ? { x: Math.cos(moveDir) * maxSpeed * mag, y: Math.sin(moveDir) * maxSpeed * mag } : { x: 0, y: 0 };
      this._moveTarget = want;
      this._world = world;
      const onGround = this.jump.state !== 'ar';
      const prevVel = { x: this.vel.x, y: this.vel.y };
      {
        const dx = want.x - this.vel.x;
        const dy = want.y - this.vel.y;
        const d = Math.hypot(dx, dy);
        const braking = Math.hypot(want.x, want.y) < Math.hypot(this.vel.x, this.vel.y);
        // ágil: acelera e freia mais forte, menos na freada do pivô (parar de uma vez com os pés no chão dava um
        // solavanco no joelho)
        const agA = ag && !(braking && this.turnInPlace) ? ag.accel : 1;
        const a = (onGround ? (braking ? ACCEL.brake : ACCEL.ground) * agA : ACCEL.air) * dt;
        if (d <= a) {
          this.vel.x = want.x;
          this.vel.y = want.y;
        } else {
          this.vel.x += (dx / d) * a;
          this.vel.y += (dy / d) * a;
        }
      }
      // anda e bate nas coisas (o mundo corrige a posição)
      const before = { x: this.pos.x, y: this.pos.y };
      let nx = this.pos.x + this.vel.x * dt;
      let ny = this.pos.y + this.vel.y * dt;
      // investida do soco: o corpo avança ~7 cm no golpe (deslocamento, não velocidade: não vira "dash" e não
      // depende dos quadros por segundo); no ar não tem investida
      let lx = 0;
      let ly = 0;
      if (this.attack && this.attack.kind !== 'slingshot' && onGround) {
        const P = PUNCH_AT;
        const a0 = this.attack.t;
        const a1 = a0 + dt * this._attackRate;
        const lunge = (x) => 7 * smoothstep(P.golpe[0], P.impacto[1], x) * (1 - this.gait * 0.6);
        const d = lunge(a1) - lunge(a0);
        lx = Math.cos(this.attack.dir) * d;
        ly = Math.sin(this.attack.dir) * d;
        nx += lx;
        ny += ly;
      }
      if (world) {
        const fixed = world.collide(nx, ny, RADIUS);
        nx = fixed.x;
        ny = fixed.y;
        if (lx || ly) {
          // Só desconta a parte da investida que ocorreu. Quando o rival/parede segura
          // o soco, descontar a intenção criava velocidade para trás e passos no lugar.
          const withoutLunge = world.collide(before.x + this.vel.x * dt, before.y + this.vel.y * dt, RADIUS);
          lx = nx - withoutLunge.x;
          ly = ny - withoutLunge.y;
        }
      }
      let pushX = 0, pushY = 0;
      if (this._knockback) {
        const push = this._knockback, beforeT = push.t;
        push.t = Math.min(push.duration, push.t + dt);
        const curve = t => 1 - Math.pow(1 - clamp01(t / push.duration), 3);
        const travel = push.distance * (curve(push.t) - curve(beforeT));
        const fixed = world ? world.collide(nx + Math.cos(push.direction) * travel, ny + Math.sin(push.direction) * travel, RADIUS)
          : { x: nx + Math.cos(push.direction) * travel, y: ny + Math.sin(push.direction) * travel };
        pushX = fixed.x - nx; pushY = fixed.y - ny; nx = fixed.x; ny = fixed.y;
        this._lastPushVelocity = { x: pushX / dt, y: pushY / dt };
        if (push.t >= push.duration - 1e-8) this._knockback = null;
      }
      this.pos.x = nx;
      this.pos.y = ny;
      // sobe e desce o meio-fio suave
      if (world) this.groundZ = damp(this.groundZ, world.heightAt(nx, ny), 22, dt);
      // a investida do soco move o corpo mas não é "andar": fica fora da passada e da velocidade
      const moved = Math.hypot(nx - before.x - lx, ny - before.y - ly);
      const realSpeed = dt > 0 ? moved / dt : 0;
      // velocidade "de verdade" (parede segura o personagem: não fica andando no lugar)
      if (dt > 0) {
        this.vel.x = (nx - before.x - lx) / dt;
        this.vel.y = (ny - before.y - ly) / dt;
      }
      this.speed = damp(this.speed, realSpeed, 18, dt);
      this.accel = { x: (this.vel.x - pushX / dt - prevVel.x) / Math.max(dt, 1e-3), y: (this.vel.y - pushY / dt - prevVel.y) / Math.max(dt, 1e-3) };

      // virar para onde anda (no soco, para onde bate): suave e com velocidade máxima (nada de pular de pose)
      const prevYaw = this.yaw;
      let wantYaw = null;
      if (this.turnInPlace && this.faceYaw !== null) wantYaw = this.faceYaw;
      else if (this.speed > 60 && mag > 0.02) wantYaw = Math.atan2(this.vel.y - pushY / dt, this.vel.x - pushX / dt);
      else if (mag > 0.02) wantYaw = this.faceYaw;
      else if (this.attack) wantYaw = this.attack.dir;
      else if (this.faceYaw !== null) wantYaw = this.faceYaw; // devagar ou parado: vira para onde mandou (e termina)
      if (wantYaw !== null) {
        const fast = clamp01(this.speed / SPEED.run);
        const agT = this._ag && !this.attack ? this._ag : null;
        const lambda = this.attack ? 18 : lerp(14, 9, fast) * (agT ? agT.turn : 1);
        const maxStep = (this.attack ? TURN.attack : this.turnInPlace ? PIVOT.turn * (agT ? agT.pivot : 1) : lerp(TURN.still, TURN.run, fast) * (agT ? agT.turn : 1)) * DEG * dt;
        const next = dampAngle(this.yaw, wantYaw, lambda, dt);
        let d = clamp(angleDiff(this.yaw, next), -maxStep, maxStep);
        // na inversão (pivô), o giro parte da velocidade que o corpo já tinha e acelera até o máximo em ~0,04 s (antes
        // ia de 0 a 600°/s num quadro: o punho dava um tranco de 14 cm/quadro² no começo da virada). Só a subida é
        // limitada: frear continua na hora (o limite dos pés logo abaixo manda parar). Fora do pivô, ou socando, fica
        // como estava: uma rampa ali atrasava a troca de lado e as pernas cruzavam (testes lateral e refino do movimento)
        if (this.turnInPlace && !this.attack && dt > 0) {
          const w0 = (this._yawStep || 0) / (this._yawStepDt || dt);
          const w = d / dt;
          const acc = PIVOT.turnAccel * (agT ? agT.pivot : 1) * DEG * dt;
          if (Math.abs(w) > Math.abs(w0) + acc) d = Math.sign(w) * (Math.abs(w0) * (Math.sign(w) === Math.sign(w0) ? 1 : 0) + acc) * dt;
        }
        // o corpo não passa de ~55° na frente dos pés apoiados (senão as pernas cruzam): numa virada fechada ele
        // espera o próximo passo e a virada se divide em passos, como gente fazendo a curva
        if (onGround) {
          let sx = 0;
          let sy = 0;
          for (let i = 0; i < 2; i++) {
            const st = this.footLock[i];
            if (!st.planted || st.step) continue;
            const fyaw = st.yaw - (i === 0 ? -1 : 1) * B.toeOut * DEG;
            sx += Math.cos(fyaw);
            sy += Math.sin(fyaw);
          }
          if (sx || sy) {
            const feet = Math.atan2(sy, sx);
            const lim = 55 * DEG;
            const cur = angleDiff(feet, this.yaw);
            const nxt = cur + d;
            if (Math.abs(nxt) > lim && Math.abs(nxt) > Math.abs(cur)) d = Math.abs(cur) >= lim ? 0 : Math.sign(nxt) * lim - cur;
          }
        }
        // A orientação dos dedos não basta: com um pé à frente do outro,
        // girar o tronco pode inverter a ordem lateral das pernas.
        const left = this.footLock[0], right = this.footLock[1];
        if (onGround && left.lastX !== null && right.lastX !== null) {
          const lp = left.drawnAnkle || { x: left.lastX, y: left.lastY };
          const rp = right.drawnAnkle || { x: right.lastX, y: right.lastY };
          const dx = rp.x - lp.x, dy = rp.y - lp.y;
          const gap = (a) => -Math.sin(a) * dx + Math.cos(a) * dy;
          const before = gap(this.yaw), after = gap(this.yaw + d);
          if (after < 12 && after < before) {
            let lo = 0, hi = 1;
            for (let k = 0; k < 12; k++) {
              const mid = (lo + hi) / 2;
              if (gap(this.yaw + d * mid) >= Math.min(12, before)) lo = mid;
              else hi = mid;
            }
            d *= lo;
          }
        }
        this.yaw += d;
        this._yawStep = d;
        this._yawStepDt = dt;
      } else {
        this._yawStep = 0;
      }
      this.yawRate = damp(this.yawRate, dt > 0 ? angleDiff(prevYaw, this.yaw) / dt : 0, 10, dt);
      // a cabeça vai na frente nas curvas: olha para onde o corpo vai virar
      const aim = this.attack ? this.attack.dir : mag > 0.02 ? Math.atan2(mv.y, mv.x) : this.yaw;
      this.turnLead = damp(this.turnLead, clamp(angleDiff(this.yaw, aim) * 0.6, -0.45, 0.45), 10, dt);

      // passada: avança pela distância (o pé no chão não escorrega)
      const step = this._stepLength(this.speed);
      if (onGround) this.phase = (this.phase + moved / (2 * step)) % 1;
      // o pivô desliga a passada aos poucos (uma mola a mais na frente do amortecimento): antes a passada caía 21% já
      // no primeiro quadro da virada, e braços e pernas trocavam de velocidade de uma vez
      this.pivotK = damp(this.pivotK || 0, this.turnInPlace ? 1 : 0, 20, dt);
      const gaitWant = smoothstep(5, 70, this.speed) * (1 - this.pivotK) * (onGround ? 1 : 0.4);
      this.gait = damp(this.gait, gaitWant, gaitWant < this.gait ? 14 : 9, dt);
      const runT = this.speed > SPEED.walk * 1.12 ? smoothstep(SPEED.walk * 1.1, SPEED.run * 0.85, this.speed) : 0;
      const runRequest = !!input.run;
      if (runRequest !== this._runRequest && this.gait > 0.8 && this.speed > 120 &&
          this.jump.state === 'chao' && !this.turnInPlace && !this.crouchWanted && !this.attack) {
        this._strideTransitionUntil = this.time + 0.85;
        const duty = lerp(0.6, 0.3, this.runBlend);
        for (const st of this.footLock) {
          if (st.gaitPhase >= duty && st.swingDuty == null) st.swingDuty = duty;
        }
      }
      this._runRequest = runRequest;
      // Ao apertar Shift durante a marcha, a passada acompanha a aceleração antes de ficar longa demais.
      const rhythmRate = this.time < this._strideTransitionUntil && runRequest ? 12 : 6;
      this.runBlend = damp(this.runBlend, runT, rhythmRate, dt);

      // agachar suave: mola sem balanço (sai do lugar e chega com velocidade zero). Antes era um "damp", que começava
      // com a velocidade cheia no quadro em que se apertava o botão — um tranco no joelho em cada transição
      if (!this.crouchSpring) this.crouchSpring = new M.Spring(this.crouch);
      this.crouch = clamp01(this.crouchSpring.step(this.crouchWanted ? 1 : 0, 1.9, 1, dt));

      // O relógio do salto tem trajetória analítica; a altura não depende do FPS.
      const J = this.jump;
      J.t += dt;
      const jumpScale = 27 * B.legScale;
      if (J.state === 'preparo') {
        const peak = Math.max(0.72, J.prepFrom || 0);
        const speed = 440 + 50 * J.running;
        const end = 0.34, extension = 0.1;
        const power = speed * extension / (jumpScale * (peak - end));
        J.crouch = J.t <= 0.12 ? lerp(J.prepFrom || 0, peak, smoother(J.t / 0.12)) : peak - (peak - end) * Math.pow(clamp01((J.t - 0.12) / extension), power);
        J.air = 0;
        if (J.t >= 0.22 - 1e-8) {
          J.state = 'ar'; J.t = Math.max(0, J.t - 0.22);
          J.launchSpeed = speed; J.flightDuration = 2 * speed / GRAVITY;
          this.vz = speed - GRAVITY * J.t; this.pos.z = speed * J.t - 0.5 * GRAVITY * J.t * J.t; J.crouch = end;
          this.events.push({ type: 'poeira', x: this.pos.x, y: this.pos.y, strength: 0.7 });
        }
      } else if (J.state === 'ar') {
        const elapsed = Math.min(J.t, J.flightDuration);
        this.vz = J.launchSpeed - GRAVITY * elapsed;
        this.pos.z = Math.max(0, J.launchSpeed * elapsed - 0.5 * GRAVITY * elapsed * elapsed);
        J.crouch = 0.34 * (1 - smoother((elapsed - 0.025) / 0.18)) + 0.42 * smoother((elapsed - (J.flightDuration - 0.14)) / 0.14);
        J.air = smoother(elapsed / 0.12);
        if (J.t >= J.flightDuration - 1e-8) {
          J.crouch0 = J.crouch; J.impact = clamp(J.launchSpeed / 620, 0.45, 1);
          J.state = 'pouso'; J.t = Math.max(0, J.t - J.flightDuration);
          this.pos.z = 0; this.vz = 0; J.air = 0;
          this.events.push({ type: 'poeira', x: this.pos.x, y: this.pos.y, strength: J.impact });
        }
      } else if (J.state === 'pouso') {
        const down = 0.1, start = J.crouch0 || 0;
        const peak = start + J.launchSpeed * down / (2.5 * jumpScale);
        const u = clamp01(J.t / down);
        const absorb = 2.5 * u - 5 * u ** 3 + 5 * u ** 4 - 1.5 * u ** 5;
        J.crouch = J.t < down ? lerp(start, peak, absorb) : peak * (1 - smoother((J.t - down) / 0.3));
        if (J.t >= 0.4) { J.state = 'chao'; J.crouch = 0; }
      } else J.crouch = damp(J.crouch, 0, 12, dt);

      // soco (no "armar", se o corpo ainda não virou para o alvo, o golpe espera um pouco)
      this._attackRate = 1;
      if (this.attack && this.attack.kind === 'slingshot') {
        PD.slingshot.update(this, dt, input);
      } else if (this.attack) {
        const A = this.attack;
        let rateWant = 1;
        if (mag < 0.02 && this.speed < 30 && A.t > PUNCH_AT.armar[0] && A.t < PUNCH_AT.armar[1]) {
          const off = Math.abs(angleDiff(this.yaw, A.dir));
          rateWant = lerp(1, 0.12, smoothstep(4 * DEG, 25 * DEG, off));
          if (this.footLock[0].step || this.footLock[1].step) rateWant = Math.min(rateWant, 0.3);
        }
        // o relógio do soco desacelera em poucos quadros (antes caía de 1 para 0,12 de uma vez e o braço, que vinha
        // rápido na preparação, parava no ar: cotovelo com tranco de ~20 cm/quadro² no soco para o lado)
        A.rate = damp(A.rate ?? 1, rateWant, 25, dt);
        this._attackRate = A.rate;
        A.t += dt * this._attackRate;
        if (!A.hit && A.t >= PUNCH_AT.golpe[1]) {
          A.hit = true;
          this.events.push({ type: 'impacto', hand: A.hand });
        }
        if (A.queued && A.t >= PUNCH_AT.recolher[0] + 0.05) {
          this._startAttack(A.queuedDir, true);
        } else if (A.t >= PUNCH_AT.total) {
          this.attack = null;
          this._punchOut = null;
          this._punchPrev = null;
        }
      }
      const braced = this.attack && (this.attack.kind === 'slingshot' ? this.attack.stage === 'charging' || this.attack.t < 0.11 : this.attack.t < PUNCH_AT.voltar[0]);
      this.stanceLead = damp(this.stanceLead, braced ? 1 : 0, 10, dt);

      // inclinação de aceleração e de curva
      const fwd = { x: Math.cos(this.yaw), y: Math.sin(this.yaw) };
      const aF = this.accel.x * fwd.x + this.accel.y * fwd.y;
      const aS = -this.accel.x * fwd.y + this.accel.y * fwd.x;
      this.leanPitch = damp(this.leanPitch, onGround ? clamp(aF * 0.00006, -0.1, 0.12) : 0, 6, dt);
      this.leanRoll = damp(this.leanRoll, onGround ? clamp(this.yawRate * this.speed * 0.00009 + aS * 0.00002, -0.16, 0.16) : 0, 7, dt);

      // piscar
      this.blinkIn -= dt;
      if (this.blinkIn <= 0 && this.blinkT < 0) {
        this.blinkT = 0;
        this.blinkIn = 2.4 + Math.abs(M.noise1(t * 3.7)) * 3.2;
      }
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        if (this.blinkT > 0.15) this.blinkT = -1;
      }

      this.label = this._label();
      this._pose = null;
    }

    /**
     * Veste um item num encaixe (veja js/character/equipment.js). Confere encaixe, classe e itens que ocupam mais de um
     * encaixe (ex.: uma arma de duas mãos tira o que estava nas duas). Devolve os ids que saíram.
     */
    equip(slot, id) {
      if (!PD.equipment) throw new Error('sistema de equipamentos não carregado');
      const ok = PD.equipment.canEquip(this, slot, id);
      if (!ok.ok) throw new Error('não dá para vestir: ' + ok.motivo);
      const item = PD.equipment.catalog.get(id);
      const removed = [];
      for (const s of item.ocupa || [slot]) {
        const prev = this.equipped[s];
        if (prev && !removed.includes(prev)) removed.push(prev);
        // um item que ocupava vários encaixes sai de todos
        const prevItem = prev && PD.equipment.catalog.get(prev);
        if (prevItem && prevItem.ocupa) for (const o of prevItem.ocupa) if (this.equipped[o] === prev) delete this.equipped[o];
        delete this.equipped[s];
      }
      for (const s of item.ocupa || [slot]) this.equipped[s] = id;
      return removed;
    }
    unequip(slot) {
      if (!PD.equipment.SLOTS.includes(slot)) throw new Error(`encaixe "${slot}" não existe`);
      const id = this.equipped[slot];
      const item = id && PD.equipment.catalog.get(id);
      for (const s of (item && item.ocupa) || [slot]) if (this.equipped[s] === id) delete this.equipped[s];
      return id || null;
    }

    applyKnockback(direction, distance, duration = 0.22) {
      if (this.death || !Number.isFinite(direction) || !Number.isFinite(distance) || distance <= 0) return false;
      this._knockback = { direction, distance: Math.min(distance, 60), duration: Math.max(0.12, duration), t: 0 };
      return true;
    }

    attackBusy() {
      return !!(this.attack && (this.attack.kind === 'slingshot' || this.attack.t < PUNCH_AT.recolher[1]));
    }

    /** Reação visual; direction indica para onde o tronco cede, em radianos no mundo. */
    reactToHit(options = {}) {
      if (this.death || this.hurt) return false;
      if (!options || typeof options !== 'object') return false;
      const { direction = this.yaw + Math.PI, strength = 1 } = options;
      if (!Number.isFinite(direction) || !Number.isFinite(strength) || strength <= 0) return false;
      if (this.dodge && !options.interruptDodge) return false;
      const from = JSON.parse(JSON.stringify(this.pose()));
      if (this.dodge) this._finishDodge();
      PD.guard?.release(this, true);
      this.hurt = { t: 0, from, direction, strength: clamp(strength, 0.15, 1) };
      this.attack = null; this._punchOut = null; this._punchPrev = null;
      this.turnInPlace = false; this.faceYaw = this.yaw;
      this._recoverPose = null;
      this._pose = null;
      this.label = 'Recebendo impacto';
      return true;
    }

    /** Pode ser chamado pelo combate; o botão de demonstração usa a mesma entrada. */
    die(options = {}) {
      if (this.death) return false;
      const from = JSON.parse(JSON.stringify(this.pose()));
      const h = this.pos.z, vz = this.vz;
      const airDuration = h > 0 ? (vz + Math.sqrt(vz * vz + 2 * GRAVITY * h)) / GRAVITY : 0;
      const impulse = options.impulse || { x: 0, y: 0 };
      this.death = { t: 0, from, start: { ...this.pos }, velocity: { x: this.vel.x + (Number.isFinite(impulse.x) ? impulse.x : 0), y: this.vel.y + (Number.isFinite(impulse.y) ? impulse.y : 0) }, height: h, vz,
        airDuration, fallDelay: Math.max(0, airDuration - 0.25), hit: false,
        forward: Number.isFinite(options.direction) && Math.cos(options.direction - this.yaw) > 0.15 };
      this.dodge = null;
      this.hurt = null;
      this._recoverPose = null;
      this._cancelActionInputs();
      return true;
    }

    _startDodge(move, world) {
      if (this.dodge || this.death || this.hurt || this.dodgeCooldown > 0 || this.jump.state !== 'chao' || this.attackBusy() && this.attack.kind !== 'slingshot') return false;
      const mag = move ? Math.hypot(move.x, move.y) : 0;
      const direction = mag > 0.08 ? { x: move.x / mag, y: move.y / mag } : { x: Math.cos(this.yaw), y: Math.sin(this.yaw) };
      const from = JSON.parse(JSON.stringify(this.pose())), body = M.frameYaw(from.root, this.yaw);
      const lateral = direction.x * body.r.x + direction.y * body.r.y;
      const frontal = direction.x * body.f.x + direction.y * body.f.y;
      let lead = Math.abs(lateral) > 0.05 ? (lateral > 0 ? 1 : 0) : (frontal >= 0 ? 1 : 0);
      if (this.speed > 50 && Math.abs(lateral) < 0.5) {
        const along = from.feet.map(ft => ft.pos.x * direction.x + ft.pos.y * direction.y);
        // Quem ficou atrás precisa sair primeiro; uma ordem fixa prende esse
        // pé no passo anterior e acaba puxando o quadril para dentro do chão.
        if (Math.abs(along[0] - along[1]) > 8) lead = along[0] < along[1] ? 0 : 1;
      }
      let distance = DODGE.distance;
      if (world) {
        // Mede o caminho em trechos curtos: um ponto final do outro lado de uma parede não basta.
        for (let s = 6; s <= DODGE.distance + 6; s += 6) {
          const along = Math.min(s, DODGE.distance);
          const wanted = { x: this.pos.x + direction.x * along, y: this.pos.y + direction.y * along };
          const allowed = world.collide(wanted.x, wanted.y, this.radius);
          if (Math.hypot(allowed.x - wanted.x, allowed.y - wanted.y) > 0.01) {
            distance = clamp((allowed.x - this.pos.x) * direction.x + (allowed.y - this.pos.y) * direction.y, 0, along);
            break;
          }
        }
      }
      this.dodge = { t: 0, from, start: { ...this.pos }, direction, lead, distance, entrySpeed: this.speed, carry: { x: 0, y: 0 }, footProgress: [0, 0] };
      this._recoverPose = null;
      this._cancelActionInputs();
      this.events.push({ type: 'poeira', x: this.pos.x, y: this.pos.y, strength: 0.35 });
      return true;
    }

    /**
     * Esquiva do jogo (pedido do dono, 14/11: "está feia demais"; ela era um pulo de 3 m sem movimento nenhum): vira
     * para onde vai, abaixa e se encolhe como uma bola, rola uma volta inteira no chão e levanta. `distance` em cm (o
     * que o servidor andou); a vista não tem paredes, o caminho já vem livre.
     */
    startRoll(direction, distance) {
      if (this.death) return false;
      this._cancelActionInputs();
      this.yaw = this.faceYaw = direction;
      const from = JSON.parse(JSON.stringify(this.pose()));
      const dir = { x: Math.cos(direction), y: Math.sin(direction) };
      this.dodge = { t: 0, from, start: { ...this.pos }, direction: dir, lead: 0, distance, entrySpeed: this.speed,
        carry: { x: 0, y: 0 }, footProgress: [0, 0], roll: true, timing: ROLL, dustEnd: false };
      this._recoverPose = null;
      this.events.push({ type: 'poeira', x: this.pos.x, y: this.pos.y, strength: 0.45 });
      return true;
    }

    _cancelActionInputs() {
      PD.guard?.release(this, true);
      this._knockback = null; this._lastPushVelocity = null;
      this.attack = null; this._punchOut = null; this._punchPrev = null;
      this.turnInPlace = false; this.faceYaw = this.yaw;
      this._strideTransitionUntil = 0;
      this.crouchWanted = false;
      this.jump = { ...this.jump, state: 'chao', t: 0, crouch: 0, air: 0 };
      for (const st of this.footLock) { st.planted = false; st.step = null; st.swingDuty = null; st.air = null; }
    }

    _dodgeResume(input, a, world) {
      const move = input.move || { x: 0, y: 0 }, mag = clamp01(Math.hypot(move.x, move.y));
      if (mag < 0.08) return null;
      const dir = Math.atan2(move.y, move.x);
      // Uma inversão ainda precisa da virada sobre os apoios; a emenda direta
      // serve para quem mantém o avanço, sem introduzir uma troca brusca de base.
      if (Math.abs(angleDiff(this.yaw, dir)) > 75 * DEG || Math.abs(angleDiff(Math.atan2(a.direction.y, a.direction.x), dir)) > 30 * DEG) return null;
      const speed = (input.run ? SPEED.run : SPEED.walk) * mag;
      const velocity = { x: Math.cos(dir) * speed, y: Math.sin(dir) * speed };
      if (world) {
        const wanted = { x: this.pos.x + velocity.x * 0.06, y: this.pos.y + velocity.y * 0.06 };
        const allowed = world.collide(wanted.x, wanted.y, this.radius);
        if (Math.hypot(allowed.x - wanted.x, allowed.y - wanted.y) > 2) return null;
      }
      return { speed, velocity, run: !!input.run,
        aligned: Math.abs(angleDiff(Math.atan2(a.direction.y, a.direction.x), dir)) <= 30 * DEG };
    }

    _updateAction(dt, world, input = {}) {
      const a = this.death || this.dodge, before = { x: this.pos.x, y: this.pos.y }, was = a.t;
      const previous = this._pose;
      a.t += dt;
      let dx, dy;
      if (this.death) {
        const coast = was >= a.fallDelay + DEATH.total ? 0 : (Math.exp(-14 * was) - Math.exp(-14 * a.t)) / 14;
        dx = a.velocity.x * coast; dy = a.velocity.y * coast;
        this.pos.z = a.t < a.airDuration ? Math.max(0, a.height + a.vz * a.t - 0.5 * GRAVITY * a.t * a.t) : 0;
        this.vz = a.t < a.airDuration ? a.vz - GRAVITY * a.t : 0;
        if (!a.hit && a.t - a.fallDelay >= DEATH.impact) {
          a.hit = true;
          this.events.push({ type: 'poeira', x: this.pos.x, y: this.pos.y, strength: 0.65 });
        }
      } else {
        const T = a.timing || DODGE;
        const travel = (smoother((a.t - T.moveStart) / (T.moveEnd - T.moveStart)) -
          smoother((was - T.moveStart) / (T.moveEnd - T.moveStart))) * a.distance;
        // a poeira de quando levanta do rolamento
        if (a.roll && !a.dustEnd && a.t >= T.moveEnd) {
          a.dustEnd = true;
          this.events.push({ type: 'poeira', x: this.pos.x, y: this.pos.y, strength: 0.35 });
        }
        dx = a.direction.x * travel; dy = a.direction.y * travel;
        a.resume = this._dodgeResume(input, a, world);
        if (a.resume && a.resume.aligned && a.entrySpeed > 50) {
          // Mantém o movimento de quem já estava correndo na entrada e na cauda da esquiva.
          const extra = Math.max(0, a.resume.speed * dt - travel);
          dx += a.direction.x * extra; dy += a.direction.y * extra;
          a.carry.x += a.direction.x * extra; a.carry.y += a.direction.y * extra;
        }
      }
      const next = world ? world.collide(this.pos.x + dx, this.pos.y + dy, this.radius) : { x: this.pos.x + dx, y: this.pos.y + dy };
      this.pos.x = next.x; this.pos.y = next.y;
      if (world) this.groundZ = damp(this.groundZ, world.heightAt(next.x, next.y), 22, dt);
      this.vel = { x: (next.x - before.x) / dt, y: (next.y - before.y) / dt };
      this.speed = 0; this.gait = 0; this.runBlend = 0; this.crouch = 0;
      this.stanceLead = 0; this.leanPitch = 0; this.leanRoll = 0;
      this._pose = null;
      const T = (this.dodge && this.dodge.timing) || DODGE;
      if (this.dodge && a.resume && !a.roll && a.t >= T.moveEnd - 1e-8) this._finishDodge(a.resume, previous);
      else if (this.dodge && a.t >= T.total - 1e-8) this._finishDodge();
    }

    _finishDodge(resume = null, previous = null) {
      const a = this.dodge;
      const last = this._actionPose();
      const grounded = this.footLock.map(st => st.planted && !st.step);
      this.dodge = null; this.dodgeCooldown = (a.timing || DODGE).cooldown;
      this._recoverPose = { from: last, start: this.time, duration: 0.18 };
      // A altura da esquiva já está em recoverPose. Reaplicá-la como correção de
      // alcance abaixava o quadril uma segunda vez por alguns quadros.
      this.phase = 0; this.vel = { x: 0, y: 0 }; this.hipDrop = 0;
      this.footAir = grounded.map(value => value ? 0 : 0.05);
      if (resume) {
        this._dodgeArmUntil = this.time + 0.7;
        this.vel = { ...resume.velocity }; this.speed = resume.speed;
        this.gait = smoothstep(5, 70, resume.speed);
        this.runBlend = smoothstep(SPEED.walk * 1.1, SPEED.run * 0.85, resume.speed);
        this._runRequest = resume.run;
        this.faceYaw = Math.atan2(this.vel.y, this.vel.x);
        const stancePhase = lerp(0.4, 0.42, this.runBlend) * lerp(0.6, 0.3, this.runBlend);
        this.phase = (stancePhase + (a.lead ? 0.5 : 0)) % 1;
      }
      this.crouchSpring = new M.Spring(0);
      this.armSprings = last.hands.map(h => new M.Spring3(h.local));
      this.headSpring = new M.Spring3({ x: last.head.yaw + last.pelvis.yaw + last.spine.yaw,
        y: last.head.pitch + last.pelvis.pitch + last.spine.pitch, z: last.head.roll + last.pelvis.roll + last.spine.roll });
      this.footLock = last.feet.map((ft, i) => {
        const ref = refOf(ft.pos, ft.pitch / DEG, ft.yaw);
        const planted = resume ? grounded[i] : true;
        const oldRef = previous && refOf(previous.feet[i].pos, previous.feet[i].pitch / DEG, previous.feet[i].yaw);
        return { planted, x: ref.x, y: ref.y, yaw: ft.yaw, step: null, lastX: ref.x, lastY: ref.y, z: ref.z,
          ...(!planted ? { resumeHeight: Math.max(0, ref.z - this.groundZ - B.ankleHeight), resumeVelocity: oldRef ? clamp((ref.z - oldRef.z) / this._dt, -160, 160) : 0 } : {}),
          outPitch: ft.pitch / DEG, lastDrawnRef: ref, drawnAnkle: { ...ft.pos },
          refVelocity: oldRef ? M.scale(M.sub(ref, oldRef), 1 / this._dt) : { x: 0, y: 0, z: 0 } };
      });
      // O quadro que termina a ação ainda é sua última pose. A marcha passa a
      // calcular os apoios no próximo passo de física, sem recalcular o mesmo pé duas vezes.
      this._pose = last;
    }

    /**
     * O rolamento: a pose encolhida (agachado bem baixo, as costas curvas, o queixo no peito, as mãos nas canelas) e o
     * giro da queda do rig (`fall`: gira o corpo todo em volta do pé e encosta no chão). O pé da pose anda para trás
     * conforme gira, para o meio da bola seguir reto pelo caminho (sem ir e voltar).
     */
    _rollPose() {
      const a = this.dodge, from = a.from, T = a.timing;
      this.look.slingDraw = 0;
      this.look.slingBand = 0; this.look.slingLoaded = false;
      const t = Math.min(T.total, a.t), u = t / T.total;
      const tuck = smoothstep(0, 0.17, u) * (1 - smoothstep(0.6, 0.92, u));
      const spin = smoother(clamp01((u - 0.08) / 0.6));
      const theta = spin * TAU;
      const enter = smoother(a.t / 0.06);
      const ground = { x: this.pos.x, y: this.pos.y, z: this.groundZ + this.pos.z };
      const body = M.frameYaw(ground, this.yaw);
      const hipZ = lerp(B.hipStand, 42, tuck);
      // o meio do corpo encolhido fica a ~0,8 da altura do quadril: o pé da pose recua para ele girar no lugar certo
      const h = hipZ * 0.8;
      const root = M.add(ground, M.scale(body.f, -h * Math.sin(theta)));
      const mixObject = (old, target) => Object.fromEntries(Object.keys(target).map(key => [key, lerp(old[key] || 0, target[key], enter)]));
      const pelvis = mixObject(from.pelvis, { dx: 0, dy: 0, dz: (hipZ - B.hipStand), yaw: 0, pitch: 28 * DEG * tuck, roll: 0 });
      const spine = mixObject(from.spine, { yaw: 0, pitch: 52 * DEG * tuck, roll: 0 });
      const head = mixObject(from.head, { yaw: 0, pitch: 38 * DEG * tuck, roll: 0 });
      const hands = from.hands.map((hd, i) => {
        // as mãos abraçam as canelas (na frente dos joelhos)
        const target = mixV({ x: 4.6, y: 5, z: -51 }, { x: 4, y: 30, z: -26 - i * 2 }, tuck);
        return { local: mixV(hd.local, target, enter), twist: lerp(hd.twist || 0, -0.4, enter),
          poleLocal: mixPole(hd.poleLocal || POLE.solto, POLE.guarda, enter), fist: lerp(hd.fist, 0.6, enter), flex: lerp(hd.flex || 0, 0.1, enter) };
      });
      const rootFrame = M.frameYaw(root, this.yaw);
      const feet = from.feet.map((ft, i) => {
        const side = i ? 1 : -1;
        const target = M.at(rootFrame, side * lerp(B.footSide, 10, tuck), lerp(0, 12, tuck), B.ankleHeight);
        const start = M.add(root, M.sub(ft.pos, from.root));
        return { pos: mixV(start, target, enter), pitch: lerp(ft.pitch, 0, enter), yaw: this.yaw + side * B.toeOut * DEG, toeBend: 0 };
      });
      for (const st of this.footLock) st.planted = false;
      this.look.blink = 0;
      this.look.restGround = undefined;
      this.look.gazeX = 0; this.look.gazeY = 0; this.look.mouthOpen = 0.1 * tuck; this.look.browRaise = -0.3 * tuck;
      return { root, yaw: this.yaw, pelvis, spine, head, hands, feet,
        shrug: [0, 0], shoulderFwd: [0, 0],
        fall: { pitch: theta, roll: 0, groundZ: this.groundZ } };
    }

    _actionPose() {
      if (this.dodge && this.dodge.roll) return this._rollPose();
      const a = this.death || this.dodge, from = a.from;
      this.look.slingDraw = 0;
      this.look.slingBand = 0; this.look.slingLoaded = false;
      const root = { x: this.pos.x, y: this.pos.y, z: this.groundZ + this.pos.z };
      const body = M.frameYaw(root, this.yaw), dead = !!this.death;
      const prone = dead && a.forward;
      const t = dead ? Math.min(DEATH.total, Math.max(0, a.t - a.fallDelay)) : Math.min(DODGE.total, a.t);
      const enter = smoother(a.t / (dead ? 0.12 : 0.085));
      const dodgePhase = dead ? 0 : t / DODGE.total;
      const dodgeK = dead ? 0 : smoothstep(0, 0.22, dodgePhase) * (1 - smoother((dodgePhase - 0.54) / 0.46));
      const collapse = dead ? smoother(t / 0.4) : 0;
      const fallU = clamp01((t - 0.04) / 0.6);
      // A queda ganha velocidade antes do contato, em vez de frear durante todo o arco.
      const rawFall = fallEase(fallU);
      const tilt = dead ? rawFall : 0;
      const settle = dead ? smoother((t - 0.64) / 0.71) : 0;
      const brace = dead ? 0.25 * smoothstep(0.04, 0.16, t) * (1 - smoother((t - 0.23) / 0.29)) : 0;
      const deathSink = dead ? Math.min(-22, from.pelvis.dz - 6) : 0;
      const lateral = dead ? 0 : M.dot({ ...a.direction, z: 0 }, body.r);
      const forward = dead ? 0 : M.dot({ ...a.direction, z: 0 }, body.f);
      const mixObject = (old, target) => Object.fromEntries(Object.keys(target).map(key => [key, lerp(old[key] || 0, target[key], enter)]));
      const pelvis = mixObject(from.pelvis, { dx: dead ? -2 * collapse * (1 - settle) : 3 * lateral * dodgeK, dy: dead ? (prone ? 4 : -6) * collapse : -2 * dodgeK,
        dz: dead ? lerp(from.pelvis.dz, deathSink, collapse) : -2 - 27 * dodgeK, yaw: dead ? 4 * DEG * collapse : -5 * DEG * lateral * dodgeK,
        pitch: dead ? (prone ? -3 + 2 * settle : 8 - 5 * settle) * DEG * collapse : (12 + 8 * forward) * DEG * dodgeK, roll: dead ? 0 : 8 * DEG * lateral * dodgeK });
      const spine = mixObject(from.spine, { yaw: dead ? -8 * DEG * collapse : 10 * DEG * lateral * dodgeK,
        pitch: dead ? (prone ? 6 * tilt - 3 * settle : -5 * tilt + 2 * settle) * DEG : 12 * DEG * dodgeK, roll: dead ? 3 * DEG * tilt : 10 * DEG * lateral * dodgeK });
      const head = mixObject(from.head, { yaw: dead ? (-9 * tilt - 16 * settle) * DEG : -3 * DEG * lateral * dodgeK,
        pitch: dead ? (prone ? -10 * tilt + 6 * settle : 6 * tilt + 5 * settle) * DEG : -12 * DEG * dodgeK, roll: dead ? 7 * DEG * tilt : -5 * DEG * lateral * dodgeK });
      const hands = from.hands.map((h, i) => {
        const armRest = dead ? smoother((t - (i ? 0.62 : 0.7)) / (i ? 0.68 : 0.6)) : 0;
        const target = prone ? mixV(mixV({ x: 10 + i * 3, y: 8, z: -47 },
          { x: 19 + i * 2, y: 27 - i * 3, z: -9 - i * 4 }, smoothstep(0.08, 0.34, t)),
          { x: i ? 25 : 22, y: i ? 3 : 5, z: i ? -37 : -39 }, armRest) : dead ? mixV(mixV({ x: 8 + i * 2, y: -1, z: -51 }, { x: 5 + i * 2, y: 20 - i * 5, z: -14 - i * 5 }, brace * (i ? 0.85 : 1)),
          { x: i ? 24 : 18, y: i ? 5 : 4, z: i ? -47 : -51 }, armRest) : mixV({ x: 4.6, y: 5, z: -51 }, { x: -4, y: 25 - i * 6, z: -9 - i * 5 }, dodgeK);
        return { local: mixV(h.local, target, enter), twist: lerp(h.twist || 0, dead ? -0.15 : -0.5 * dodgeK, enter),
          poleLocal: mixPole(h.poleLocal || POLE.solto, prone ? [-0.35, 1, -0.2] : dead ? [0.08, 1, -0.1] : POLE.guarda, enter),
          fist: lerp(h.fist, dead ? 0.05 + 0.45 * brace : 0.15 + 0.7 * dodgeK, enter), flex: lerp(h.flex || 0, 0.08, enter) };
      });
      const feet = from.feet.map((ft, i) => {
        const side = i ? 1 : -1;
        if (dead) {
          const target = M.at(body, side * (B.footSide + 2), lerp(i ? -3 : 9, i ? -16 : -19, settle), B.ankleHeight);
          const offset = M.sub(ft.pos, from.root), start = M.add(root, offset);
          return { pos: mixV(start, target, enter), pitch: lerp(ft.pitch, -5 * DEG * collapse, enter),
            yaw: this.yaw + side * (B.toeOut + 8 * collapse) * DEG, toeBend: 0 };
        }
        const lead = i === a.lead, startAt = (lead ? 0.046 : 0.259) * DODGE.total, endAt = (lead ? 0.435 : 0.759) * DODGE.total;
        let u = Math.max(a.footProgress[i], clamp01((t - startAt) / (endAt - startAt)));
        // A previsão é limitada pelo deslocamento que a colisão realmente permite.
        const planned = smoother((t - DODGE.moveStart) / (DODGE.moveEnd - DODGE.moveStart)) * a.distance;
        const actual = M.sub(this.pos, a.start);
        const remain = Math.max(0, a.distance - planned);
        const endRoot = { x: this.pos.x + a.direction.x * remain, y: this.pos.y + a.direction.y * remain, z: this.groundZ };
        const blocked = Math.hypot(actual.x - a.direction.x * planned - (a.carry?.x || 0), actual.y - a.direction.y * planned - (a.carry?.y || 0)) > 3;
        if (blocked) { endRoot.x = this.pos.x; endRoot.y = this.pos.y; }
        const target = M.at(M.frameYaw(endRoot, this.yaw), side * B.footSide, 0, B.ankleHeight);
        const ankleAt = progress => {
          const p = mixV(ft.pos, target, smoother(progress));
          p.z = lerp(ft.pos.z, this.groundZ + B.ankleHeight, smoother(progress)) + 10 * Math.pow(Math.sin(Math.PI * progress), 2);
          return p;
        };
        // Na aceleração, os dois pés podem entrar atrás da raiz. Esperar o relógio fixo
        // do segundo pé abaixava o quadril até atravessar o chão. Antecipa esse balanço
        // quando ele sai do alcance da perna, sem recuar a fase caso haja uma colisão.
        const safeHip = M.at(pelvisFrame(body, pelvis), side * B.hipHalf, 0, -B.pelvisUp);
        safeHip.z -= Math.min(12, Math.max(0, pelvis.dz + 42));
        const safeReach = B.legLength * 0.985;
        if (M.dist(safeHip, ankleAt(u)) > safeReach) {
          for (let sample = 1; sample <= 24; sample++) {
            const nextU = lerp(u, 1, sample / 24);
            if (M.dist(safeHip, ankleAt(nextU)) > safeReach) continue;
            let lo = u, hi = nextU;
            for (let search = 0; search < 16; search++) {
              const mid = (lo + hi) / 2;
              if (M.dist(safeHip, ankleAt(mid)) > safeReach) lo = mid; else hi = mid;
            }
            u = hi;
            break;
          }
        }
        a.footProgress[i] = u;
        const pos = ankleAt(u);
        const pitch = lerp(ft.pitch, 0, smoother(Math.min(1, t / 0.075)));
        const yaw = ft.yaw + angleDiff(ft.yaw, this.yaw + side * B.toeOut * DEG) * smoother(u);
        const footFrame = M.pitch(M.frameYaw(pos, yaw), -pitch);
        const toeFrame = M.moved(footFrame, M.at(footFrame, 0, B.ballFwd, -B.ankleHeight));
        const floor = Math.min(...PD.MODEL.FOOT.map(s => M.at(footFrame, -side * s.s, s.f, s.u).z - s.r),
          ...PD.MODEL.TOES.big.concat(PD.MODEL.TOES.small).map(s => M.at(toeFrame, -side * s.s, s.f, s.u).z - s.r));
        pos.z += Math.max(0, this.groundZ - floor);
        const st = this.footLock[i];
        st.planted = (u < 1e-8 && t < startAt && ft.pos.z < this.groundZ + B.ankleHeight + 0.1 || u >= 1) && Math.abs(pitch) < 0.001;
        return { pos, pitch, yaw, toeBend: 0 };
      });
      // Ajusta apenas esta pose de ação para alcançar o apoio sem esticar ossos.
      const pf = pelvisFrame(body, pelvis), reach = B.legLength * 0.985;
      let lower = 0;
      for (let i = 0; i < 2; i++) {
        const hip = M.at(pf, (i ? 1 : -1) * B.hipHalf, 0, -B.pelvisUp), ft = feet[i].pos;
        const h = Math.hypot(hip.x - ft.x, hip.y - ft.y);
        lower = Math.max(lower, hip.z - ft.z - Math.sqrt(Math.max(1, reach * reach - h * h)));
      }
      pelvis.dz -= Math.max(0, lower);
      const adjusted = pelvisFrame(body, pelvis);
      for (let i = 0; i < 2; i++) {
        const hip = M.at(adjusted, (i ? 1 : -1) * B.hipHalf, 0, -B.pelvisUp), d = M.dist(hip, feet[i].pos);
        if (d > reach) feet[i].pos = M.add(hip, M.scale(M.sub(feet[i].pos, hip), reach / d));
      }
      this.look.blink = dead ? smoothstep(0.08, 0.28, a.t) : 0;
      this.look.restGround = dead ? this.groundZ : undefined;
      this.look.gazeX = 0; this.look.gazeY = 0; this.look.mouthOpen = dead ? 0 : 0.12 * dodgeK; this.look.browRaise = dead ? 0 : -0.35 * dodgeK;
      const groundFeet = dead ? from.feet.map((ft, i) => {
        const side = i ? 1 : -1;
        const start = M.add(root, M.sub(ft.pos, from.root));
        const relax = smoother((t - (i ? 0.74 : 0.64)) / (i ? 0.6 : 0.62));
        const target = M.at(body, side * lerp(B.footSide + 2, B.footSide + (i ? 3.5 : 2.5), relax),
          prone ? lerp(i ? 1 : -3, i ? -9 : -13, relax) : lerp(i ? -10 : -6, i ? 14 : 18, relax), B.ankleHeight);
        const pos = mixV(start, target, smoother(a.t / 0.28));
        return { pos, relax, prone, yaw: ft.yaw + angleDiff(ft.yaw, this.yaw + side * 9 * DEG) * enter,
          pitch: lerp(ft.pitch, (prone ? -30 - i * 4 : 58 + i * 6) * DEG * settle, enter) };
      }) : null;
      return { root, yaw: this.yaw, pelvis, spine, head, hands, feet,
        shrug: (from.shrug || [0, 0]).map(v => lerp(v, 0, enter)), shoulderFwd: (from.shoulderFwd || [0, 0]).map(v => lerp(v, 0, enter)),
        ...(dead ? { fall: { pitch: (prone ? 88 : -88) * DEG * tilt, side: (prone ? 8 : -14) * DEG * smoother((t - 0.24) / 0.6), groundZ: this.groundZ, groundFeet } } : {}) };
    }

    /** O golpe do botão de ataque vem da classe (hoje todas socam; um golpe novo entra aqui e em PD.classes.GOLPES). */
    _startAttack(dir, combo, input = {}) {
      if (PD.slingshot && PD.slingshot.isEquipped(this)) {
        PD.slingshot.start(this, dir, input);
        return;
      }
      const g = (PD.classes && PD.classes.get(this.classe).golpes.ataque) || 'soco';
      switch (g) {
        case 'soco':
        default:
          return this._startPunch(dir, combo);
      }
    }

    _startPunch(dir, combo) {
      const hand = this.nextHand;
      this.nextHand = 1 - hand;
      // base dos pés sempre a mesma (pé esquerdo na frente): a direita é a mão de trás (direto, gira mais) e a
      // esquerda, a da frente (jab, gira menos). Nada de os pés trocarem de lugar a cada soco
      const lead = 0;
      this.lastLead = lead;
      this.faceYaw = dir; // depois do soco ele continua virado para onde bateu
      // combo: começa de onde o corpo está — a diferença para o soco novo some aos poucos (sem parar o punho)
      const from = combo && this._punchOut ? { now: this._punchOut, before: this._punchPrev, dt: this._dt || 1 / 60 } : null;
      this.attack = { t: combo ? PUNCH_AT.armar[0] : 0, hand, dir, queued: false, hit: false, combo, lead, from, offset: null };
    }

    _stepLength(speed) {
      // perna mais longa = passo mais longo (a cadência cai): 160 cm/s → passo de ~66 cm (~145 passos por minuto)
      const k = B.legScale;
      const walk = (0.25 * speed + 24) * k;
      const run = (0.2 * speed + 32) * k; // 440 cm/s → passo de ~125 cm
      const crouch = (0.25 * speed + 14) * k;
      const s = lerp(walk, run, this.runBlend);
      return lerp(s, crouch, this.crouch);
    }

    _label() {
      if (this.death) return this.death.t - this.death.fallDelay >= DEATH.total ? 'Morto' : 'Morrendo';
      if (this.dodge) return 'Esquivando';
      if (this.hurt) return 'Recebendo impacto';
      if (this.guard?.active) return 'Defendendo';
      if (this.attack) return this.attack.kind === 'slingshot' ? (this.attack.stage === 'charging' ? 'Carregando estilingue' : 'Disparando pedra') : 'Atacando';
      if (this.jump.state === 'preparo' || this.jump.state === 'ar') return 'Pulando';
      if (this.crouch > 0.5) return this.speed > 20 ? 'Andando agachado' : 'Agachado';
      if (this.speed > SPEED.walk * 1.2) return 'Correndo';
      if (this.speed > 18) return 'Andando';
      return 'Parado';
    }

    // ------------------------------------------------------------------ pose
    /** Posição prevista da raiz, com a aceleração usada pelo controle do jogo. */
    _predictRoot(seconds, airborne = false) {
      const velocity = this._lastPushVelocity ? { x: this.vel.x - this._lastPushVelocity.x, y: this.vel.y - this._lastPushVelocity.y } : this.vel;
      const want = this._moveTarget || velocity;
      const dv = { x: want.x - velocity.x, y: want.y - velocity.y };
      const braking = Math.hypot(want.x, want.y) < Math.hypot(velocity.x, velocity.y);
      const acceleration = airborne ? ACCEL.air : (braking ? ACCEL.brake : ACCEL.ground) * (this._ag && !(braking && this.turnInPlace) ? this._ag.accel : 1);
      const reach = Math.hypot(dv.x, dv.y) / acceleration;
      const ramp = Math.min(seconds, reach);
      const result = { x: this.pos.x, y: this.pos.y, z: this.groundZ };
      for (const axis of ['x', 'y']) {
        result[axis] += velocity[axis] * ramp + (reach > 0 ? dv[axis] * ramp * ramp / (2 * reach) : 0) + want[axis] * (seconds - ramp);
      }
      if (this._knockback) {
        const k = this._knockback, curve = t => 1 - Math.pow(1 - clamp01(t / k.duration), 3);
        const travel = k.distance * (curve(k.t + seconds) - curve(k.t));
        result.x += Math.cos(k.direction) * travel; result.y += Math.sin(k.direction) * travel;
      }
      if (this._world) Object.assign(result, this._world.collide(result.x, result.y, RADIUS));
      return result;
    }

    /** Passada por distância, com o desenho e a cadência originais. */
    _feet(pelvis, { g, run, crouch, idle, weight, heelUp, lead }) {
      const t = this.time, dt = this._dt, J = this.jump, ph = this.phase, A = this.attack;
      const speedK = clamp01(this.speed / SPEED.walk);
      const ankleFloor = this.groundZ + B.ankleHeight;
      const S = lerp(0.6, 0.3, run);
      const step = this._stepLength(this.speed);
      const sweep = S * 2 * step * g;
      const front = lerp(0.4, 0.42, run);
      const lift = lerp(lerp(4.5, 6.8, speedK), 23, run) * (1 - 0.45 * crouch) * B.legScale;
      const heelStrike = lerp(13, 6, run) * (1 - 0.5 * crouch);
      const toeOff = lerp(44, 42, run) * (1 - 0.4 * crouch);
      const heelFrom = lerp(0.55, 0.4, run);
      // ---- pés: o animador diz onde o pé "quer" estar; a trava prende no chão o pé que pisou
      const body = M.frameYaw({ x: this.pos.x, y: this.pos.y, z: this.groundZ }, this.yaw);
      const feet = [];
      const grounded = [false, false];
      const hipZ = B.hipStand + pelvis.dz;
      const inAir = J.state === 'ar' || J.state === 'pouso' && this.footLock.some(st => st.air);
      const turningInPlace = this.turnInPlace || !A && this.faceYaw !== null && this.speed < 60 && Math.abs(angleDiff(this.yaw, this.faceYaw)) > 1.0;
      const walkFeet = g > 0.08 && !turningInPlace && !this.turnInPlace && !(J.state === 'pouso' && J.t < 0.055);
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const p = (ph + (i === 0 ? 0 : 0.5)) % 1;
        const st = this.footLock[i];
        // A troca de ritmo não volta um pé em balanço para o meio do apoio.
        // Cada pé termina o balanço que começou; a amplitude continua seguindo a velocidade atual.
        if (p < (st.gaitPhase ?? 0) || !walkFeet || J.state !== 'chao' || crouch > 0.05) st.swingDuty = null;
        if (this.time < this._strideTransitionUntil && walkFeet && J.state === 'chao' &&
            crouch <= 0.05 && st.swingDuty == null && p >= S) st.swingDuty = S;
        st.gaitPhase = p;
        const duty = st.swingDuty ?? S;
        let y = 0;
        let up = 0;
        let pitch = 0; // graus: + = ponta do pé para cima (calcanhar no chão), - = calcanhar para cima
        let bend = 0; // graus: dedos dobrados (ficam deitados no chão quando o calcanhar sobe)
        let swingS = -1; // fração do balanço (-1 = pé apoiado)
        if (g > 0.001) {
          if (p < duty) {
            // apoio: pisa com o calcanhar, fica chato, e o calcanhar sobe até sair pela ponta
            const s = p / duty;
            y = lerp(front * sweep, (front - 1) * sweep, s);
            const rise = clamp01((s - heelFrom) / (1 - heelFrom));
            // o calcanhar sobe devagar no começo e chega na ponta sem pressa: na saída do chão o pé não pode estar
            // girando no máximo (antes, r^1,7, girava mais rápido justo no último instante e o balanço começava parado:
            // o tornozelo trocava de velocidade de uma vez e o joelho, quase esticado, dava um tranco)
            pitch = heelStrike * (1 - smoothstep(0, 0.16, s)) - toeOff * Math.pow(smoothstep(0, 1, rise), 1.15);
          } else {
            // balanço: o pé sai do chão parado e pousa parado (no chão, não em relação ao corpo): enquanto o corpo
            // anda `travel`, ele vai de trás para a frente numa curva suave; o calcanhar sobe para trás no começo
            // (o joelho dobra) e o pé passa baixo na frente
            const s = (p - duty) / (1 - duty);
            swingS = s;
            const y0 = (front - 1) * sweep;
            const travel = (1 - duty) * 2 * step * g;
            // andando, a curva é simétrica; correndo, o pé vem para a frente mais cedo (o joelho dobra e o
            // calcanhar sobe perto do bumbum, em vez de a perna esticar para trás)
            const b = lerp(2, 2.2, run);
            const ease = 1 - Math.pow(1 - s, b) * (1 + b * s);
            y = y0 + (travel + front * sweep - y0) * ease - s * travel;
            // subida do pé no balanço: o pico vem cedo (o joelho dobra logo) e a curva começa com velocidade zero (antes
            // s^0,65 começava "infinita": o pé dava um pulo de 2 cm no primeiro quadro fora do chão)
            const upWalk = Math.pow(Math.sin(Math.PI * (1 - Math.pow(1 - s, 1.55))), 1.2);
            const upRun = Math.pow(Math.sin(Math.PI * (1 - Math.pow(1 - s, 1.3))), 1.1);
            up = lift * lerp(upWalk, upRun, run) * (1 + 0.09 * M.noise1(t * 0.41 + i * 5.7)); // cada passo um pouco diferente
            up += run * 17 * B.legScale * Math.pow(Math.sin(Math.PI * clamp01((s - 0.05) / 0.5)), 1.2);
            pitch = lerp(-toeOff, heelStrike, smoothstep(0, 0.85, s));
            bend = toeOff * (1 - smoothstep(0, 0.3, s));
          }
          pitch *= g;
          bend *= g;
        }
        // pé parado: um pouco à frente o esquerdo (postura natural); em guarda, pé da frente
        const fightY = this.stanceLead * (i === lead ? 6 : -4) * (1 - g * 0.8);
        y += (i === 0 ? 2.5 : -2) * idle + fightY;
        // perna livre (sem peso): pé um pouco à frente e para fora, joelho solto
        const free = i === 0 ? Math.max(0, weight) : Math.max(0, -weight);
        y += free * 4;
        const xSide = side * (lerp(B.footSide - 1.4, B.footSide - 3.2, run) * g + B.footSide * idle + 6 * crouch + 2.5 * J.crouch + this.stanceLead * 2 * (1 - g));
        const ref = M.at(body, xSide, y, B.ankleHeight + up); // "pé chato": o tornozelo sai daqui, rolando o pé
        let yawAbs = this.yaw + pelvis.yaw * 0.3 + side * B.toeOut * DEG + this.stanceLead * (i === lead ? -0.15 : 0.35) * side;
        let pos;
        const wasPitch = st.outPitch || 0;
        if (inAir) {
          const total = J.flightDuration;
          const elapsed = J.state === 'ar' ? J.t : total;
          const s = clamp01(elapsed / total), remain = Math.max(0, total - elapsed);
          const target = M.at(body, xSide, J.running * (i === J.lead ? 10 : -10) * Math.sin(Math.PI * s), B.ankleHeight);
          const groundMix = smoother(remain / 0.14);
          target.z += this.pos.z * groundMix + lerp(18, 25, J.running) * Math.pow(Math.sin(Math.PI * s), 2);
          const desiredPitch = -28 * Math.sin(Math.PI * s) + lerp(8, 4, J.running) * smoother((s - 0.8) / 0.2);
          if (!st.air) {
            const old = { x: st.lastX, y: st.lastY, z: st.z ?? ankleFloor };
            st.air = { correction: M.sub(old, target), velocity: M.sub(st.refVelocity || { x: 0, y: 0, z: 0 }, { x: this.vel.x, y: this.vel.y, z: J.launchSpeed }), pitch: wasPitch, pitchV: st.pitchV || 0 };
          }
          const takeoff = st.air;
          const horizontal = 1 - smoother(elapsed / 0.2);
          const vertical = 1 - smoother(elapsed / 0.075);
          const correction = M.add(takeoff.correction, M.scale(takeoff.velocity, elapsed));
          Object.assign(ref, { x: target.x + correction.x * horizontal, y: target.y + correction.y * horizontal, z: target.z + correction.z * vertical });
          pitch = desiredPitch + (takeoff.pitch + (takeoff.pitchV + 28 * Math.PI / total) * elapsed) * (1 - smoother(elapsed / 0.12));
          const future = M.frameYaw(this._predictRoot(remain, true), this.yaw);
          const goal = M.at(future, xSide, Math.min(18, this.speed * 0.035) + J.running * (i === J.lead ? 7 : -7), B.ankleHeight);
          if (!takeoff.land || remain > 0.14) {
            takeoff.land = takeoff.land ? M.damp3(takeoff.land, goal, 14, dt) : goal;
            takeoff.landYaw = (this.yaw + side * B.toeOut * DEG);
          }
          const k = smoother((elapsed - (total - 0.2)) / 0.2);
          ref.x = lerp(ref.x, takeoff.land.x, k);
          ref.y = lerp(ref.y, takeoff.land.y, k);
          yawAbs = st.yaw + angleDiff(st.yaw, (this.yaw + side * B.toeOut * DEG)) * smoother(elapsed / 0.18);
          yawAbs += angleDiff(yawAbs, takeoff.landYaw) * k;
          ref.z = Math.max(ankleFloor, ref.z);
          st.planted = false;
          st.step = null;
          if (J.state === 'pouso') {
            ref.z = ankleFloor;
            Object.assign(st, { x: ref.x, y: ref.y, yaw: yawAbs, planted: true, air: null, age: 0 });
            st.landPitch = pitch; st.resumeFromJump = true;
          }
          grounded[i] = st.planted;
          bend = Math.max(0, -pitch);
          pos = ankleOf(ref, pitch, yawAbs);
        } else {
          if (i !== lead) pitch -= heelUp;
          const other = this.footLock[1 - i];
          if (!st.step) {
            if (walkFeet) {
              if (swingS < 0) {
                // apoio: o pé fica preso onde pisou (pousando de um pulo: onde tocou o chão)
                if (!st.planted) {
                  const landing = J.state === 'pouso' && st.lastX !== null;
                  st.planted = true;
                  const correction = st.latFix || 0;
                  st.x = landing ? st.lastX : ref.x - Math.sin(this.yaw) * correction;
                  st.y = landing ? st.lastY : ref.y + Math.cos(this.yaw) * correction;
                  st.yaw = yawAbs;
                } else if (!other.step && J.state === 'chao' && Math.abs(angleDiff(st.yaw, yawAbs)) > 0.7) {
                  // virada fechada andando devagar: o corpo girou por cima do pé; ele dá um passo de virada
                  st.step = { t: 0, dur: 0.15, fx: st.x, fy: st.y, fyaw: st.yaw, p0: st.outPitch };
                  st.planted = false;
                }
              } else {
                // balanço: sai de onde estava; a diferença para o caminho da passada some aos poucos (ela anda
                // junto com o corpo, então o pé não fica para trás)
                if (st.planted || st.fx === undefined) {
                  st.planted = false;
                  st.fx = (st.lastX ?? ref.x) - ref.x;
                  st.fy = (st.lastY ?? ref.y) - ref.y;
                  st.fyaw = st.yaw;
                  st.swingBirth = swingS;
                  if (st.resumeFromJump) {
                    st.rejoin = { t: 0, offset: -up, velocity: clamp(-(up - (st.prevUp ?? up)) / dt, -160, 0) };
                    st.resumeFromJump = false;
                  }
                  if (st.resumeHeight !== undefined) {
                    st.rejoin = { t: 0, height: st.resumeHeight, velocity: st.resumeVelocity || 0, duration: 0.14 };
                    delete st.resumeHeight; delete st.resumeVelocity;
                  }
                }
                const birth = st.swingBirth || 0;
                const k = smoothstep(birth, Math.min(1, Math.max(0.6, birth + 0.3)), swingS);
                ref.x += st.fx * (1 - k);
                ref.y += st.fy * (1 - k);
                yawAbs = st.fyaw + angleDiff(st.fyaw, yawAbs) * smoothstep(0, 0.9, swingS);
              }
            } else {
              // parado (ou quase): o pé fica no chão; se o lugar certo ficou longe, dá um passinho
              if (!st.planted) {
                const landing = J.state === 'pouso' || J.state === 'preparo';
                if (!landing && st.lastX !== null && Math.hypot(ref.x - st.lastX, ref.y - st.lastY) > 2) {
                  st.step = { t: 0, dur: this.turnInPlace ? PIVOT.step * (this._ag ? this._ag.step : 1) : 0.18, fx: st.lastX, fy: st.lastY, fyaw: st.yaw, p0: st.outPitch };
                } else {
                  // pousando: o pé fica onde tocou o chão (ajeita depois, se precisar)
                  st.planted = true;
                  st.x = landing && st.lastX !== null ? st.lastX : ref.x;
                  st.y = landing && st.lastY !== null ? st.lastY : ref.y;
                  st.yaw = landing ? st.yaw : yawAbs;
                }
              }
              if (!st.step && st.planted) {
                // virada pequena: o pé gira em volta do ponto que encosta no chão — a base dos dedos (pé chato ou com
                // o calcanhar para cima) ou o calcanhar (pisando com a ponta para cima). Antes girava sempre na base
                // dos dedos, e numa virada logo depois de pisar o calcanhar riscava o chão a 80 cm/s
                const yawErr = angleDiff(st.yaw, yawAbs);
                if (Math.abs(yawErr) > 0.01 && J.state === 'chao') {
                  const footTurn = A ? 11 : this.turnInPlace ? PIVOT.footTurn * (this._ag ? this._ag.pivot : 1) : 6;
                  const turn = clamp(yawErr, -footTurn * dt, footTurn * dt);
                  // ponto de giro, à frente do tornozelo. `pitch` já vem multiplicado pela passada: antes multiplicava de
                  // novo e, com a passada pela metade (pivô), girava na ponta com o calcanhar no chão (ele riscava)
                  const pv = pitch > 2 ? -B.heelBack : B.ballFwd;
                  const bx = st.x + Math.cos(st.yaw) * pv;
                  const by = st.y + Math.sin(st.yaw) * pv;
                  st.yaw += turn;
                  st.x = bx - Math.cos(st.yaw) * pv;
                  st.y = by - Math.sin(st.yaw) * pv;
                }
                const striking = A && A.t > PUNCH_AT.golpe[0] - 0.02 && A.t < PUNCH_AT.recolher[1];
                // no soco os pés só giram na ponta até ~70° e aguentam a base mais aberta (sem passinhos à toa)
                const far = Math.hypot(ref.x - st.x, ref.y - st.y) > (A ? 14 : 9) || Math.abs(angleDiff(st.yaw, yawAbs)) > (A ? 1.2 : 0.75);
                if (far && !other.step && !striking && J.state === 'chao' && (this.stepCooldown <= 0 || A)) {
                  st.step = { t: 0, dur: A ? 0.11 : this.turnInPlace ? PIVOT.step * (this._ag ? this._ag.step : 1) : turningInPlace ? 0.15 : 0.2, fx: st.x, fy: st.y, fyaw: st.yaw, p0: st.outPitch };
                  st.planted = false;
                  this.stepCooldown = turningInPlace ? 0.03 : 0.08;
                }
              }
            }
          }
          if (st.step) {
            // passo: levanta, vai até onde o pé quer estar agora e pisa
            if (st.step.fz === undefined) {
              st.step.fz = st.lastDrawnRef ? st.lastDrawnRef.z : this.groundZ + B.ankleHeight;
              st.step.vz = st.refVelocity ? clamp(st.refVelocity.z, -160, 160) : 0;
              // o passo também herda a velocidade de lado do pé (até 9 m/s): um pé que vinha no balanço da corrida
              // (inversão, freada) não para de uma vez — antes o tornozelo dava um tranco de ~14 cm/quadro²
              const v = st.refVelocity || { x: 0, y: 0 };
              const m = Math.hypot(v.x, v.y);
              const s = m > 900 ? 900 / m : 1;
              st.step.vx = v.x * s;
              st.step.vy = v.y * s;
            }
            st.step.t += dt / st.step.dur;
            const k = clamp01(st.step.t);
            const e = easeInOut(k);
            const carry = st.step.dur * k * Math.pow(1 - k, 3); // sai com a velocidade herdada e chega parado
            ref.x = lerp(st.step.fx, ref.x, e) + st.step.vx * carry;
            ref.y = lerp(st.step.fy, ref.y, e) + st.step.vy * carry;
            ref.z = Math.max(this.groundZ + B.ankleHeight,
              lerp(st.step.fz, this.groundZ + B.ankleHeight, smoother(k)) + st.step.vz * st.step.dur * k * Math.pow(1 - k, 3) + 7 * Math.pow(Math.sin(Math.PI * k), 2));
            pitch += -10 * Math.sin(Math.PI * k);
            // começa do ângulo em que o pé estava (um calcanhar levantado não volta de uma vez)
            if (st.step.p0 !== undefined) pitch = lerp(st.step.p0, pitch, smoothstep(0, 0.4, k));
            yawAbs = st.step.fyaw + angleDiff(st.step.fyaw, yawAbs) * e;
            bend = 0;
            if (k >= 1) {
              st.step = null;
              st.planted = true;
              const correction = st.latFix || 0;
              ref.x -= Math.sin(this.yaw) * correction;
              ref.y += Math.cos(this.yaw) * correction;
              st.x = ref.x;
              st.y = ref.y;
              st.yaw = yawAbs;
              st.rejoin = { t: 0, offset: -up, velocity: clamp(-(up - (st.prevUp ?? up)) / dt, -160, 0) };
            }
          } else if (st.planted) {
            ref.x = st.x;
            ref.y = st.y;
            yawAbs = st.yaw;
            ref.z = this.groundZ + B.ankleHeight;
          }
          if (st.rejoin && !st.step && !st.planted) {
            st.rejoin.t += dt;
            const r = st.rejoin;
            if (r.height !== undefined) ref.z = this.groundZ + B.ankleHeight + Math.max(0, lerp(r.height + r.velocity * r.t, up, smoother(r.t / r.duration)));
            else ref.z = Math.max(this.groundZ + B.ankleHeight, ref.z + (r.offset + r.velocity * r.t) * (1 - smoother(r.t / 0.18)));
            if (r.t >= (r.duration || 0.18)) st.rejoin = null;
          }
          // o pé no ar nunca cruza para o lado do pé apoiado (pernas em X): fica do seu lado, com 10 cm de folga
          const o = this.footLock[1 - i];
          if (st.planted && !st.step) {
            st.latFix = 0; // pisou: a correção já ficou no lugar onde ele pisou
          } else {
            const rx = -Math.sin(this.yaw);
            const ry = Math.cos(this.yaw);
            let want = 0;
            if (o.planted && !o.step) {
              const lat = (ref.x - o.x) * rx + (ref.y - o.y) * ry;
              const fix = side * 10 - lat;
              if (side * fix > 0) want = fix;
            }
            st.latFix = damp(st.latFix || 0, want, 30, dt); // entra e sai suave (sem o pé pular de lado)
            ref.x += rx * st.latFix;
            ref.y += ry * st.latFix;
            if (o.planted && !o.step) {
              const gap = side * ((ref.x - o.x) * rx + (ref.y - o.y) * ry);
              if (gap < 12) {
                const correction = side * (12 - gap);
                ref.x += rx * correction;
                ref.y += ry * correction;
                st.latFix += correction;
              }
            }
          }
          if (J.state === 'pouso' && st.landPitch !== undefined) pitch = lerp(st.landPitch, pitch, smoother(J.t / 0.16));
          if (st.planted && !st.step && swingS < 0) st.rejoin = null;
          grounded[i] = !st.step && st.planted;
          if (grounded[i]) bend = Math.max(0, -pitch);
          pos = ankleOf(ref, pitch, yawAbs);
          st.lastX = ref.x;
          st.lastY = ref.y;
        }
        if (!inAir && this.pos.z > 0) pos.z += this.pos.z;
        {
          const pr = pitch * DEG;
          const ballZ = pos.z + B.ballFwd * Math.sin(pr) - B.ankleHeight * Math.cos(pr);
          const need = Math.asin(clamp((this.groundZ - ballZ) / 4.4, -1, 1)) / DEG - pitch; // dedão: 4,4 cm
          if (need > bend) bend = Math.min(need, 75);
        }
        st.prevUp = up;
        feet.push({ pos, pitch: pitch * DEG, yaw: yawAbs, toeBend: bend * DEG, land: !inAir && swingS > 0 && walkFeet ? smoothstep(0.72, 1, swingS) : 0 });
      }

      // ---- a perna nunca estica além da conta: se o pé apoiado ficou longe, a pelve desce um pouco. Longe demais
      // (curva muito fechada, começo da caminhada), o pé dá um passo rápido em vez de a pelve afundar
      if (!inAir) {
        const pf = pelvisFrame(body, pelvis);
        const L = B.legLength * 0.985;
        let need = 0;
        let worst = -1;
        for (let i = 0; i < 2; i++) {
          const w = grounded[i] ? 1 : feet[i].land;
          if (w <= 0) continue;
          const hip = M.at(pf, (i === 0 ? -1 : 1) * B.hipHalf, 0, -B.pelvisUp);
          const a = feet[i].pos;
          const horiz = Math.hypot(hip.x - a.x, hip.y - a.y);
          const n = (hip.z - a.z - Math.sqrt(Math.max(0, L * L - horiz * horiz))) * w;
          if (n > need) {
            need = n;
            worst = grounded[i] ? i : -1;
          }
        }
        const cap = lerp(4.25, 6.75, smoothstep(0.3, 0.9, g));
        const urgentStep = need > cap + 4 && this.speed > 60 && J.state === 'chao';
        if (need > cap + 0.4 && (walkFeet || urgentStep) && worst >= 0) {
          const st = this.footLock[worst];
          if ((!this.footLock[1 - worst].step || urgentStep) && !st.step) {
            st.step = { t: 0, dur: urgentStep ? 0.12 : 0.16, fx: st.x, fy: st.y, fyaw: st.yaw, p0: st.outPitch };
            st.planted = false;
            grounded[worst] = false; // já saiu do chão neste quadro (o alcance abaixo trata como pé no ar)
          }
        }
        need = clamp(need, 0, cap);
        this.hipDrop = need >= this.hipDrop ? need : damp(this.hipDrop, need, 9, dt);
      } else {
        this.hipDrop = damp(this.hipDrop, 0, 9, dt);
      }
      pelvis.dz -= this.hipDrop;

      // ---- alcance: nenhum alvo de pé fica longe demais da perna. Antes o esqueleto esticava a perna até o limite e
      // o pé ficava até 26 cm longe de onde o animador queria — no impulso do pulo o alvo ficava preso no chão
      // enquanto o corpo já tinha subido. Agora: pé apoiado longe demais levanta o calcanhar (gira na base dos dedos,
      // a ponta fica parada); pé no ar (balanço, impulso, voo) chega no limite por uma curva suave (o joelho estica
      // aos poucos) — no impulso, o pé sai do chão quando a perna termina de esticar, como na vida real
      {
        // a pelve de verdade (o esqueleto monta o corpo na altura do pulo, não na do chão)
        const pf = pelvisFrame(M.frameYaw({ x: this.pos.x, y: this.pos.y, z: this.groundZ + this.pos.z }, this.yaw), pelvis);
        const L = B.legLength;
        const Lr = L * 0.999;
        for (let i = 0; i < 2; i++) {
          const ft = feet[i];
          const hip = M.at(pf, (i === 0 ? -1 : 1) * B.hipHalf, 0, -B.pelvisUp);
          let d = M.dist(hip, ft.pos);
          // pé apoiado longe: o pé gira no ponto que está no chão, o tanto exato para a perna alcançar. Pé atrás do
          // quadril: o calcanhar sobe (gira na base dos dedos). Pé na frente: a ponta sobe (gira no calcanhar) — antes
          // ele também levantava o calcanhar, e o pé que pousava esticado chegava no chão de ponta e pulava. É contínuo:
          // antes ia de 2 em 2 graus e o joelho, quase esticado, aumentava cada pulinho
          if (grounded[i] && d > Lr) {
            const p0 = ft.pitch / DEG;
            const ref = refOf(ft.pos, p0, ft.yaw);
            const dAt = (p) => M.dist(hip, ankleOf(ref, p, ft.yaw));
            const lim = dAt(p0 - 0.5) < dAt(p0 + 0.5) ? -58 : 35;
            let p = lim;
            if (dAt(lim) <= Lr) {
              let a = p0; // perna longe
              let b = lim; // perna alcança
              for (let k = 0; k < 22; k++) {
                const mid = (a + b) / 2;
                if (dAt(mid) > Lr) a = mid;
                else b = mid;
              }
              p = b;
            }
            ft.pos = ankleOf(ref, p, ft.yaw);
            ft.pitch = p * DEG;
            if (p < 0) ft.toeBend = Math.max(ft.toeBend, -p * DEG);
            d = M.dist(hip, ft.pos);
          }
          // pé no ar chega no limite por uma curva suave. A suavidade cresce aos poucos depois que o pé sai do chão: antes
          // ela trocava de 0,5 para 5,5 cm de um quadro para o outro e o tornozelo pulava 2 cm para perto do quadril (o
          // joelho, quase esticado no fim do apoio, dava um tranco ao tirar o pé do chão)
          // (no pulo continua de uma vez: a perna termina de esticar no impulso e o pé sai do chão)
          this.footAir[i] = grounded[i] ? 0 : inAir ? 1 : Math.min(1, this.footAir[i] + dt / 0.3);
          const soft = J.state === 'ar' ? lerp(1.5, 8, smoother(J.t / 0.025)) : lerp(1.5, 5.5, smoothstep(0, 1, this.footAir[i]));
          if (!grounded[i]) {
            const dd = softReach(d, Lr, soft);
            if (dd < d) ft.pos = M.add(hip, M.scale(M.sub(ft.pos, hip), dd / d));
          }
        }
      }

      // Pé apoiado não é puxado para o quadril: a pelve satisfaz o alcance.
      {
        const frame = M.frameYaw({ x: this.pos.x, y: this.pos.y, z: this.groundZ + this.pos.z }, this.yaw);
        const pf = pelvisFrame(frame, pelvis), reach = B.legLength * 0.985;
        let extra = 0;
        for (let i = 0; i < 2; i++) if (grounded[i]) {
          const hip = M.at(pf, (i ? 1 : -1) * B.hipHalf, 0, -B.pelvisUp), foot = feet[i].pos;
          const horizontal = Math.hypot(hip.x - foot.x, hip.y - foot.y);
          extra = Math.max(extra, hip.z - foot.z - Math.sqrt(Math.max(0, reach * reach - horizontal * horizontal)));
        }
        if (extra > 0) { pelvis.dz -= extra; this.hipDrop += extra; }
      }
      for (let i = 0; i < 2; i++) {
        const st = this.footLock[i], foot = feet[i];
        const ref = refOf(foot.pos, foot.pitch / DEG, foot.yaw);
        const old = st.lastDrawnRef;
        st.refVelocity = old ? M.scale(M.sub(ref, old), 1 / dt) : { x: 0, y: 0, z: 0 };
        st.pitchV = (foot.pitch / DEG - (st.outPitch || 0)) / dt;
        st.outPitch = foot.pitch / DEG;
        st.lastDrawnRef = ref;
        st.lastX = ref.x; st.lastY = ref.y; st.z = ref.z;
        st.drawnAnkle = { ...foot.pos };
      }

      return feet;
    }

    /** Pose para o esqueleto (ver `PD.rig.buildRig`). Chamada uma vez por quadro, depois de `update`. */
    pose() {
      if (this._pose) return this._pose;
      if (this.death || this.dodge) return this._pose = this._actionPose();
      const t = this.time;
      const dt = this._dt || 1 / 60;
      const g = this.gait;
      const run = this.runBlend;
      const J = this.jump;
      const crouch = clamp01(this.crouch);
      const ph = this.phase;
      const c2 = Math.cos(TAU * ph);
      const s2 = Math.sin(TAU * (ph - 0.05));
      const breath = Math.sin(t * TAU * 0.27); // respiração (~3,7 s)
      const idle = 1 - g;
      const speedK = clamp01(this.speed / SPEED.walk); // 0 parado, 1 andando no normal (ou mais rápido)

      // ---- parâmetros da passada (andar ↔ correr)
      const S = lerp(0.6, 0.3, run); // parte do ciclo com o pé no chão

      // ---- pelve: alta no meio do apoio (perna quase esticada), baixa quando os dois pés estão no chão
      const mid = Math.cos(4 * Math.PI * (ph - S / 2)); // +1 no meio do apoio, -1 no apoio duplo (ou no voo)
      const bobWalk = -3 * Math.pow((1 - mid) / 2, 1.4) * lerp(0.35, 1, speedK); // e a pelve desce o resto se precisar
      const bobRun = -2 * mid - 5; // correndo: mais baixo no meio do apoio (o joelho amortece), alto no voo
      const bob = lerp(bobWalk, bobRun, run) * g * (1 - 0.6 * crouch);
      const idleSway = M.noise1(t * 0.23) * 1.1 * idle;
      // parado: o peso fica mais numa perna (troca devagar) — quadril de um lado, ombros do outro
      const weight = clamp(0.55 + 0.6 * M.noise1(t * 0.07 + 1.7), -1, 1) * idle * (1 - crouch);
      // agachado, o quadril vai para trás enquanto desce (o peso fica em cima do meio dos pés, como gente de verdade);
      // antes ele descia reto, o tronco inclinava 44° e o centro de massa ficava na ponta dos pés (~11 cm à frente)
      const sitBack = (14 * crouch + 6 * J.crouch) * B.legScale;
      const pelvis = {
        dx: -lerp(2.6, 0.9, run) * s2 * g + idleSway + weight * 2.6,
        dy: 3 * run * g + this.leanPitch * 20 - sitBack,
        dz: bob - (35 * crouch + 27 * J.crouch) * B.legScale + breath * 0.25 * idle,
        yaw: lerp(6.2, 10, run) * DEG * c2 * g,
        pitch: (lerp(2, 10, run) * g + 21 * crouch + 14 * J.crouch) * DEG + this.leanPitch * 0.5,
        roll: lerp(2.7, 2.2, run) * DEG * s2 * g + idleSway * 0.012 - weight * 3.4 * DEG,
      };
      // ---- coluna (peito em relação à pelve): gira ao contrário da pelve, um pouco atrasado
      const chestYawAbs = lerp(-5, -11, run) * DEG * Math.cos(TAU * (ph - 0.035)) * g;
      const settle = (1 - Math.cos(4 * Math.PI * (ph - S / 2 - 0.05))) / 2; // o tronco "assenta" logo depois de pisar
      const spine = {
        pitch: (lerp(4, 12, run) * g + 15 * crouch + 8 * J.crouch) * DEG + this.leanPitch - breath * 0.6 * DEG * idle + settle * 1.1 * DEG * g * (1 - run),
        yaw: chestYawAbs - pelvis.yaw,
        roll: -pelvis.roll * 0.75 - lerp(1.2, 0.8, run) * DEG * Math.sin(TAU * (ph - 0.11)) * g - this.leanRoll + weight * 2.2 * DEG,
      };

      // ---- braços (alvo do punho em relação ao ombro, no espaço do peito: x = para fora, y = frente, z = cima)
      const hands = [];
      const shoulderFwd = [0, 0];
      const runPole = smoothstep(0.15, 0.65, run * g);
      this.airArm = damp(this.airArm, J.state === 'ar' ? 1 : 0, 14, dt);
      for (let i = 0; i < 2; i++) {
        // cada braço balança um pouco diferente do outro e varia devagar de um passo para o outro (gente não é
        // simétrica nem repete o mesmo movimento): ±7% de amplitude e um tiquinho de atraso. Antes os dois braços eram
        // espelhos perfeitos e cada passo, cópia do anterior — o que dava o ar mecânico
        const armVar = 1 + 0.07 * M.noise1(t * 0.37 + i * 7.3);
        const armLag = (i === 0 ? 0.012 : -0.008) + 0.01 * M.noise1(t * 0.29 + i * 3.1);
        const w = (i === 1 ? Math.cos(TAU * (ph - armLag)) : -Math.cos(TAU * (ph - armLag))) * armVar; // +1 = braço na frente
        const fw = (w + 1) / 2;
        // parado: braço solto ao lado do corpo, cotovelo pouco dobrado
        // os braços ficam um pouco afastados do corpo (as costas são largas): antes entravam 3-4 cm no tronco
        const idleArm = armFK((2.5 + breath * 0.4) * DEG, (20 + M.noise1(t * 0.3 + i * 5) * 3) * DEG, 4.6 + breath * 0.3, 4 * DEG);
        // andando: pêndulo a partir do ombro; na frente o cotovelo dobra mais e a mão passa um pouco para dentro
        const swing = lerp(9, 18, speedK);
        const walkArm = armFK((2 + w * swing) * DEG, (17 + 12 * Math.pow(Math.max(0, w), 1.3) + 3 * (1 - Math.abs(w))) * DEG, lerp(4.4, 2.2, fw), 3 * DEG);
        // correndo: cotovelo perto de 90°, o punho sobe na frente; atrás o cotovelo não abre ("asa de galinha")
        const runArm = armFK((3 + w * 36) * DEG, (80 + 20 * Math.max(0, w)) * DEG, lerp(3, -0.5, fw));
        let a = mixV(walkArm, runArm, run);
        a = mixV(idleArm, a, g);
        // agachado: mãos para a frente, perto dos joelhos
        a = mixV(a, { x: 3, y: 25, z: -41 }, crouch * 0.9);
        let fist = lerp(lerp(0.15, 0.25, g), 0.7, run * g);
        fist = lerp(fist, 0.3, crouch);
        // pulo: braços para trás no preparo, sobem no impulso (acima da cabeça), abrem para equilibrar
        if (J.state === 'preparo') a = mixV(a, JUMP_HANDS.tras, smoothstep(0, 0.12, J.t));
        if (J.state === 'ar') {
          // braços: de trás jogam para a frente no impulso e depois ficam soltos, equilibrando
          const tA = J.t;
          a = tA < 0.1 ? mixV(JUMP_HANDS.tras, JUMP_HANDS.impulso, smoothstep(0, 0.1, tA)) : mixV(JUMP_HANDS.impulso, JUMP_HANDS.ar, smoothstep(0.1, 0.3, tA));
        }
        if (J.state === 'pouso') {
          // pousa com os braços de equilíbrio e volta aos poucos para o braço de andar/correr (sem salto de pose)
          a = mixV(JUMP_HANDS.ar, a, smoothstep(0.04, 0.36, J.t));
          a = mixV(a, { x: 8, y: 16, z: -42 }, clamp01(J.crouch / 0.85) * 0.7);
        }
        fist = lerp(fist, 0.35, this.airArm);
        const poleLocal = mixPole(mixPole(POLE.solto, POLE.correndo, runPole), POLE.ar, this.airArm);
        // mola: o braço é um pêndulo com peso — atrasa um pouco em relação ao corpo e assenta sozinho quando para. No
        // pulo a mola é bem mais firme: o pulo inteiro dura meio segundo, e com a mola mole os braços nunca chegavam às
        // poses (ficavam um na frente e o outro atrás, ainda no balanço da caminhada)
        if (!this.armSprings[i]) this.armSprings[i] = new M.Spring3(a);
        // a firmeza da mola entra e sai aos poucos (trocar de uma vez dava um tranco no punho ao apertar o pulo)
        if (i === 0) this.armFirm = damp(this.armFirm, J.state === 'preparo' || J.state === 'ar' ? 1 : J.state === 'pouso' ? 0.5 : 0, 14, dt);
        a = this.armSprings[i].step(a, lerp(3.6, 11, this.armFirm), lerp(0.72, 0.85, this.armFirm), dt);
        if (this.time < this._dodgeArmUntil) {
          // A mola sai da guarda da esquiva com outra amplitude. Absorve o
          // excesso antes do limite do braço, sem alterar a marcha aprovada.
          const d = Math.hypot(a.x, a.y, a.z), limit = B.upperArm + B.forearm - 0.2;
          const reach = softReach(d, limit, 2);
          if (reach < d) a = M.scale(a, reach / d);
        }
        // punho: a mão solta dobra um pouco para a palma e atrasa no balanço (vai para a frente → a mão fica para trás,
        // e vice-versa); fechada correndo, quase não dobra. Antes a mão ficava travada reta no antebraço
        const vy = this.armSprings[i].y.v;
        const flexWant = (0.16 + M.noise1(t * 0.21 + i * 3) * 0.05) * (1 - 0.6 * run * g) - clamp(vy * 0.0016, -0.32, 0.32) * (1 - 0.6 * run * g);
        if (!this._flex) this._flex = [flexWant, flexWant];
        this._flex[i] = damp(this._flex[i], flexWant, 12, dt);
        hands.push({ local: a, twist: lerp(0, -0.35, run * g), poleLocal, fist, flex: this._flex[i] });
        shoulderFwd[i] = lerp(1.2, 2.4, run) * w * g; // o ombro acompanha o braço
      }

      // ---- soco: guarda, armar, golpe, segurar, recolher, voltar (por cima dos braços; gira o tronco em cadeia)
      let mouthOpen = 0;
      let browRaise = 0;
      let guardK = 0;
      let heelUp = 0; // graus: calcanhar de trás no golpe
      const A = this.attack;
      if (A && A.kind !== 'slingshot') {
        const P = PUNCH_AT;
        const tt = A.t;
        const ph2 = (name) => clamp01((tt - P[name][0]) / (P[name][1] - P[name][0]));
        const h = A.hand;
        const other = 1 - h;
        const sideH = h === 0 ? -1 : 1;
        const rear = h !== A.lead; // mão de trás (direto): gira mais; mão da frente (jab): gira menos
        const baseH = hands[h];
        const baseO = hands[other];
        // guarda na frente do peito (punho de trás perto do queixo). Antes os punhos ficavam 7 a 8 cm dentro do peito
        // (e, com a ordem de desenho pela superfície, sumiam atrás dele)
        const guardFront = { x: -8.5, y: 22, z: -9 };
        const guardRear = { x: -9, y: 17, z: -3 };
        // armar: o direto recolhe o punho até o lado do queixo; o jab sai quase da guarda
        const wound = rear ? { x: -7.5, y: 14, z: 1 } : { x: -8, y: 18, z: -8 };
        const backMid = { x: 2.5, y: 8, z: -40 }; // volta pela lateral da coxa, não pela barriga
        const wIn = A.combo ? 1 : smoothstep(0, P.guarda[1], tt);
        const wOut = tt > P.voltar[0] ? 1 - easeInOut(ph2('voltar')) : 1;
        const wArm = Math.min(wIn, wOut);
        // giro do tronco: +1 = armado (para o lado da mão que bate), -1 = golpe. O quadril sai primeiro, o peito
        // logo atrás e o ombro por último; o giro do golpe dura mais que o voo do punho (nada de girar num quadro)
        const turnAt = (x) => {
          const a0 = P.armar[0];
          const a1 = P.armar[1] - 0.025;
          const b1 = P.impacto[0] + 0.045;
          if (x <= a0) return 0;
          if (x < a1) return easeInOut((x - a0) / (a1 - a0));
          if (x < b1) return 1 - 2 * smoother((x - a1) / (b1 - a1));
          if (x < P.recolher[0]) return -1;
          if (x < P.recolher[1]) return -1 + easeInOut((x - P.recolher[0]) / (P.recolher[1] - P.recolher[0]));
          return 0;
        };
        const pushAt = (x) => {
          if (x < P.golpe[0]) return 0;
          if (x < P.golpe[1]) return easeOut((x - P.golpe[0]) / (P.golpe[1] - P.golpe[0]));
          if (x < P.recolher[0]) return 1;
          return 1 - easeInOut((x - P.recolher[0]) / (P.recolher[1] - P.recolher[0]));
        };
        const wind = rear ? 30 : 20;
        const hit = rear ? 35 : 24;
        const turnDeg = (k) => (k > 0 ? k * wind : k * hit) * DEG * sideH * wArm;
        const push = pushAt(tt - 0.012) * wArm;
        const sink = smoothstep(P.armar[0], P.armar[0] + 0.07, tt) * (1 - smoothstep(P.recolher[0], P.recolher[1], tt));
        let pb = {
          chest: turnDeg(turnAt(tt)),
          hips: turnDeg(turnAt(tt + 0.02)),
          push: h === 0 ? [push, 0] : [0, push],
          dz: -wArm * (1.4 + 1.6 * sink) - 3 * push, // armando o peso vai para trás; no golpe o joelho da frente dobra
          dy: push * 6 - Math.max(0, turnAt(tt)) * 4 * wArm,
          pitch: 6 * DEG * Math.max(0, -turnAt(tt)) * wArm,
          // no golpe, o calcanhar de trás sobe (o peso vai para a frente)
          heel: 25 * this.stanceLead * smoothstep(P.golpe[0] - 0.03, P.golpe[0] + 0.04, tt) * (1 - smoothstep(P.recolher[0], P.recolher[1], tt)),
        };
        // combo: no primeiro quadro, o corpo continua o movimento em que estava (posição + velocidade × tempo); a
        // diferença para o soco novo some como uma mola amortecida que começa com aquela velocidade (nada de o punho
        // ou o tronco pararem um quadro e recomeçarem)
        const blend = (raw, key, pack, unpack) => {
          const F = A.from;
          if (!F) return raw;
          const cur = pack(raw);
          if (!A.offset[key]) {
            const now = pack(key === 'pb' ? F.now.pb : F.now.hands[+key.slice(1)]);
            const before = F.before ? pack(key === 'pb' ? F.before.pb : F.before.hands[+key.slice(1)]) : now;
            const vel = now.map((v, j) => (v - before[j]) / F.dt);
            A.offset[key] = { o: now.map((v, j) => v + vel[j] * dt - cur[j]), v: vel, t0: tt };
          }
          const O = A.offset[key];
          const tau = Math.max(0, tt - O.t0);
          const e = Math.exp(-BLEND_W * tau);
          const kp = (1 + BLEND_W * tau) * e;
          const kv = tau * e;
          return unpack(cur.map((v, j) => v + O.o[j] * kp + O.v[j] * kv));
        };
        if (A.from && !A.offset) A.offset = {};
        pb = blend(pb, 'pb', packPB, unpackPB);
        // A base acompanha o deslocamento. O golpe e a mira ficam no tronco;
        // não torcem a passada nem prendem os pés na direção antiga.
        const moving = smoothstep(15, 90, this.speed);
        const hipWeight = 1 - 0.85 * moving;
        const aimOffset = clamp(angleDiff(this.yaw, A.dir), -65 * DEG, 65 * DEG);
        heelUp = pb.heel * (1 - moving);
        spine.yaw += pb.chest * 1.05 - pb.hips * 0.35 * hipWeight + aimOffset * wArm;
        pelvis.yaw += pb.hips * 0.35 * hipWeight;
        spine.pitch += pb.pitch;
        pelvis.dz += pb.dz * (1 - 0.55 * moving);
        pelvis.dy += pb.dy * (1 - 0.65 * moving);
        shoulderFwd[0] += 5 * pb.push[0];
        shoulderFwd[1] += 5 * pb.push[1];

        // alvo do golpe: na linha da mira (um pouco para o lado da mão), com o braço quase todo esticado a partir
        // do ombro. Calculado no espaço do corpo e levado para o do peito girado: o punho vai reto para o alvo
        // enquanto o tronco gira (sem varrer para o lado)
        const cy = pelvis.yaw + spine.yaw;
        const cp = pelvis.pitch + spine.pitch; // inclinação do peito para a frente
        const lean = Math.sin(pelvis.pitch) * B.waistUp + Math.sin(cp) * B.chestUp;
        const sb = B.shoulderBack + shoulderFwd[h];
        const shR = pelvis.dx + Math.cos(cy) * sideH * B.shoulderHalf + Math.sin(cy) * sb;
        const shF = pelvis.dy + lean - Math.sin(cy) * sideH * B.shoulderHalf + Math.cos(cy) * sb;
        const reachTo = (ext, z) => {
          const ca = Math.cos(aimOffset), sa = Math.sin(aimOffset);
          const lat = sideH * 2.5 - (shR * ca - shF * sa);
          const df = Math.sqrt(Math.max(1, ext * ext - lat * lat - z * z)); // para a frente, a partir do ombro
          const dr = lat * ca + df * sa, forward = -lat * sa + df * ca;
          // no espaço do peito: tira o giro (cy) e a inclinação (cp)
          const fy = dr * Math.sin(cy) + forward * Math.cos(cy);
          return { x: sideH * (dr * Math.cos(cy) - forward * Math.sin(cy)), y: fy * Math.cos(cp) - z * Math.sin(cp), z: fy * Math.sin(cp) + z * Math.cos(cp) };
        };
        // golpe com o braço quase todo esticado (96% do comprimento) e um tiquinho além no impacto (98,5%), sem travar
        const strike = reachTo(B.armLength * 0.958, -1.5);
        const over = reachTo(B.armLength * 0.985, -1.2);
        let fistL;
        if (tt < P.guarda[1]) fistL = mixV(baseH.local, guardFront, smoothstep(0, 1, ph2('guarda')));
        else if (tt < P.armar[1]) fistL = mixV(guardFront, wound, easeInOut(ph2('armar')));
        else if (tt < P.golpe[1]) fistL = mixV(wound, strike, strikeEase(ph2('golpe')));
        else if (tt < P.impacto[1]) fistL = mixV(strike, over, Math.sin(Math.PI * ph2('impacto')));
        else if (tt < P.recolher[1]) fistL = mixV(strike, guardFront, easeInOut(ph2('recolher')));
        else {
          const k = easeInOut(ph2('voltar'));
          fistL = k < 0.5 ? mixV(guardFront, backMid, k * 2) : mixV(backMid, baseH.local, (k - 0.5) * 2);
        }
        const pronate = wArm * smoothstep(P.armar[1], P.golpe[1], tt) * (tt < P.recolher[1] ? 1 : wOut);
        const hs = [null, null];
        hs[h] = {
          local: tt >= P.voltar[0] ? fistL : mixV(baseH.local, fistL, wArm),
          flex: lerp(baseH.flex || 0, 0, wArm),
          twist: lerp(baseH.twist, -1.45, pronate),
          poleLocal: mixPole(baseH.poleLocal, mixPole(POLE.armado, POLE.golpe, smoothstep(P.golpe[0], P.golpe[1], tt) * (1 - smoothstep(P.recolher[0], P.recolher[1], tt))), wArm),
          fist: lerp(baseH.fist, 1, wArm),
        };
        hs[other] = {
          local: mixV(baseO.local, guardRear, wArm),
          flex: lerp(baseO.flex || 0, 0.05, wArm),
          twist: lerp(baseO.twist, -0.4, wArm),
          poleLocal: mixPole(baseO.poleLocal, POLE.guarda, wArm),
          fist: lerp(baseO.fist, 1, wArm),
        };
        hs[0] = blend(hs[0], 'h0', packHand, unpackHand);
        hs[1] = blend(hs[1], 'h1', packHand, unpackHand);
        hands[0] = hs[0];
        hands[1] = hs[1];
        this._punchPrev = this._punchOut;
        this._punchOut = { pb: { ...pb, push: pb.push.slice() }, hands: hs.map(copyHand) };
        mouthOpen = 0.55 * smoothstep(P.golpe[0] - 0.02, P.golpe[0] + 0.02, tt) * (1 - smoothstep(P.impacto[1] - 0.02, P.impacto[1] + 0.05, tt));
        browRaise = -0.6 * wArm;
        guardK = wArm;
      }

      this.look.slingDraw = 0;
      this.look.slingBand = 0; this.look.slingLoaded = false;
      if (PD.slingshot) guardK = Math.max(guardK, PD.slingshot.applyPose(this, { pelvis, spine, hands, shoulderFwd }));
      const hit = this.hurt;
      let hitEntry = 1, recoil = 0, balance = 0, hitGuard = 0, hitForward = 0, hitSide = 0;
      if (hit) {
        const age = hit.t, strength = hit.strength;
        hitEntry = smoother(age / 0.1);
        recoil = smoother(age / 0.065) * (1 - smoother((age - 0.08) / 0.25)) * strength;
        balance = smoothstep(0.1, 0.23, age) * (1 - smoother((age - 0.23) / 0.33)) * strength;
        hitGuard = smoother(age / 0.085) * (1 - smoother((age - 0.13) / 0.48)) * strength;
        hitForward = Math.cos(hit.direction - this.yaw);
        hitSide = Math.sin(hit.direction - this.yaw);
        pelvis.dx += 3 * hitSide * recoil;
        pelvis.dy += 5 * hitForward * recoil;
        pelvis.dz -= 7 * recoil + 4 * balance;
        pelvis.pitch += 4 * DEG * hitForward * recoil;
        pelvis.roll += 3 * DEG * hitSide * recoil;
        spine.pitch += (14 * hitForward * recoil + 5 * balance) * DEG;
        spine.roll += 12 * DEG * hitSide * recoil;
        spine.yaw += 5 * DEG * hitSide * recoil;
        for (const [part, now] of [['pelvis', pelvis], ['spine', spine]]) {
          for (const key of Object.keys(now)) now[key] = lerp(hit.from[part][key], now[key], hitEntry);
        }
        for (let i = 0; i < 2; i++) {
          const target = { x: i ? -3 : -6, y: i ? 18 : 23, z: i ? -6 : -12 };
          const h = hands[i], old = hit.from.hands[i];
          h.local = mixV(old.local, mixV(h.local, target, hitGuard), hitEntry);
          h.poleLocal = mixPole(old.poleLocal, mixPole(h.poleLocal, POLE.guarda, hitGuard), hitEntry);
          h.fist = lerp(old.fist, lerp(h.fist, 0.7, hitGuard), hitEntry);
          h.twist = lerp(old.twist, lerp(h.twist, -0.4, hitGuard), hitEntry);
          h.flex = lerp(old.flex || 0, h.flex || 0, hitEntry);
          shoulderFwd[i] += 1.5 * hitGuard;
        }
      }

      const recovery = this._recoverPose;
      const recoveryK = recovery ? smoother((this.time - recovery.start) / (recovery.duration || 0.18)) : 1;
      if (recovery) {
        for (const [part, now] of [['pelvis', pelvis], ['spine', spine]]) {
          if (part === 'pelvis' && recovery.upperOnly) continue;
          for (const key of Object.keys(now)) now[key] = lerp(recovery.from[part][key], now[key], recoveryK);
        }
        for (let i = 0; i < 2; i++) {
          hands[i].local = mixV(recovery.from.hands[i].local, hands[i].local, recoveryK);
          hands[i].poleLocal = mixPole(recovery.from.hands[i].poleLocal, hands[i].poleLocal, recoveryK);
        }
      }
      if (PD.guard) guardK = Math.max(guardK, PD.guard.applyPose(this, { pelvis, spine, hands, shoulderFwd }));
      const feet = this._feet(pelvis, { g, run, crouch, idle, weight, heelUp, lead: A ? A.lead : this.lastLead });

      // ---- cabeça: segue o peito (segura só uma parte do giro, como quem olha para a frente) com uma mola — a
      // cabeça tem peso e chega um pouquinho depois —, vai na frente nas curvas e, no soco, baixa o queixo
      const cYaw = pelvis.yaw + spine.yaw;
      const cPitch = pelvis.pitch + spine.pitch;
      const cRoll = pelvis.roll + spine.roll;
      // olha em volta parado; andando, olhadinhas de leve (a cabeça não fica travada para a frente)
      const lookYaw = M.noise1(t * 0.13 + 7) * (7 * idle + 3.5 * g * (1 - run)) * DEG * (A ? 0 : 1);
      const lookPitch = M.noise1(t * 0.11 + 3) * (3 * idle + 1.5 * g * (1 - run)) * DEG * (A ? 0 : 1);
      const nod = settle * 0.9 * DEG * g * (1 - run);
      const hTarget = {
        x: cYaw * lerp(lerp(0.62, 0.5, run * g), 0.4, guardK) + lookYaw + this.turnLead,
        y: cPitch * 0.32 + lookPitch + (2 * run * g + 4) * DEG + nod + 4 * DEG * guardK,
        z: cRoll * 0.5 - weight * 0.8 * DEG,
      };
      // puxando o arco (de lado para o alvo), a cabeça olha ao longo da flecha (slingshot.js: `look.bowHead`)
      const bowHead = this.look.bowHead;
      if (bowHead && bowHead.k > 0) hTarget.x = lerp(hTarget.x, bowHead.yaw, bowHead.k);
      if (!this.headSpring) this.headSpring = new M.Spring3(hTarget);
      const hv = this.headSpring.step(hTarget, lerp(3.4, 6.5, guardK), 0.82, dt);
      const head = { yaw: hv.x - cYaw, pitch: hv.y - cPitch, roll: hv.z - cRoll };
      if (hit) {
        head.pitch += (8 * hitForward * recoil + 3 * balance) * DEG;
        head.roll += 4 * hitSide * recoil * DEG;
        head.yaw -= 4 * hitSide * recoil * DEG;
        for (const key of Object.keys(head)) head[key] = lerp(hit.from.head[key], head[key], hitEntry);
      }
      if (recovery) {
        for (const key of Object.keys(head)) head[key] = lerp(recovery.from.head[key], head[key], recoveryK);
        if (recoveryK >= 1) this._recoverPose = null;
      }

      // ---- respiração e ombros
      const shrug = [breath * 0.35 * idle, breath * 0.35 * idle];
      if (hit) for (let i = 0; i < 2; i++) {
        shrug[i] = lerp(hit.from.shrug[i], shrug[i] + 2.2 * hitGuard, hitEntry);
        shoulderFwd[i] = lerp(hit.from.shoulderFwd[i], shoulderFwd[i], hitEntry);
      }

      // ---- rosto (no soco, os olhos ficam no alvo mesmo com a cabeça um pouco virada)
      this.look.blink = this.blinkT >= 0 ? Math.sin((this.blinkT / 0.15) * Math.PI) : 0;
      this.look.gazeX = A ? clamp((angleDiff(this.yaw, A.dir) - hv.x) / (30 * DEG), -1, 1) * 0.9 * guardK : M.noise1(t * 0.4 + 11) * 0.8 * idle;
      this.look.gazeY = A ? 0 : M.noise1(t * 0.31 + 2) * 0.4 * idle;
      this.look.mouthOpen = Math.max(mouthOpen, J.state === 'preparo' ? 0.25 : 0, this.runBlend * g * 0.25);
      this.look.browRaise = browRaise;
      if (hit) {
        const blink = smoothstep(0.01, 0.05, hit.t) * (1 - smoother((hit.t - 0.09) / 0.15));
        this.look.blink = Math.max(this.look.blink, blink);
        this.look.browRaise = Math.min(this.look.browRaise, -0.6 * hitGuard);
        this.look.mouthOpen = Math.max(this.look.mouthOpen, 0.28 * recoil);
        this.look.gazeX *= 1 - hitGuard; this.look.gazeY *= 1 - hitGuard;
      }

      this._pose = {
        root: { x: this.pos.x, y: this.pos.y, z: this.groundZ + this.pos.z },
        yaw: this.yaw,
        pelvis,
        spine,
        head,
        shrug,
        shoulderFwd,
        feet,
        hands,
      };
      return this._pose;
    }

    // ------------------------------------------------------------------ movimento secundário
    /** Depois de montar o esqueleto: molas do cabelo, penas, colar e cordão reagem ao vento e ao corpo. */
    secondary(rig, dt) {
      if (dt <= 0) return;
      const t = this.time;
      const head = rig.head.o;
      if (!this.prevHead) this.prevHead = head;
      const hv = { x: (head.x - this.prevHead.x) / dt, y: (head.y - this.prevHead.y) / dt, z: (head.z - this.prevHead.z) / dt };
      const ha = { x: (hv.x - this.headVel.x) / dt, y: (hv.y - this.headVel.y) / dt, z: (hv.z - this.headVel.z) / dt };
      this.headVel = hv;
      this.prevHead = head;
      const clampV = (v, m) => {
        const l = Math.hypot(v.x, v.y, v.z);
        return l > m ? { x: (v.x / l) * m, y: (v.y / l) * m, z: (v.z / l) * m } : v;
      };
      const acc = clampV(ha, 4000);
      // vento: brisa da tarde (sopra de leve, com rajadas)
      const life = this.death ? 1 - smoothstep(0.2, 1.3, this.death.t) : 1;
      const gust = (0.55 + 0.45 * M.noise1(t * 0.35) + 0.3 * Math.max(0, M.noise1(t * 1.3 + 4))) * life;
      const wind = { x: 0.8 * gust, y: -0.45 * gust, z: 0.1 * Math.sin(t * 2.1) * life };
      const rel = { x: -hv.x, y: -hv.y, z: -hv.z * 0.3 }; // vento de quem corre
      const S = this.springs;
      const L = this.look;
      const target = (kw, kr, ka, maxLen) =>
        clampV({ x: wind.x * kw + rel.x * kr - acc.x * ka, y: wind.y * kw + rel.y * kr - acc.y * ka, z: wind.z * kw + rel.z * kr - acc.z * ka }, maxLen);
      L.hairWind = S.hair.step(target(1.6, 0.0075, 0.0011, 5), 1.7, 0.42, dt);
      L.featherSwing = S.feathers.map((sp, j) => sp.step(target(0.16 + j * 0.02, 0.0009, 0.00016, 0.65), 2.1 + j * 0.25, 0.3, dt));
      L.pendantSwing = S.pendant.step(target(0.05, 0.0004, 0.00012, 0.6), 2.4, 0.25, dt);
      L.tasselSwing = S.tassel.step(target(0.6, 0.004, 0.0009, 4), 2.2, 0.28, dt);
      L.earringSwing = S.earring.step(target(0.5, 0.002, 0.0006, 2.5), 2.6, 0.25, dt);
      // abas da tanga: o pano fica para trás quando o quadril anda e balança com o passo (cm na ponta da aba)
      const pp = rig.pelvis.o;
      if (!this.prevPelvis) this.prevPelvis = pp;
      const pvv = { x: (pp.x - this.prevPelvis.x) / dt, y: (pp.y - this.prevPelvis.y) / dt, z: (pp.z - this.prevPelvis.z) / dt };
      const pva = clampV({ x: (pvv.x - this.pelvisVel.x) / dt, y: (pvv.y - this.pelvisVel.y) / dt, z: (pvv.z - this.pelvisVel.z) / dt }, 3000);
      this.pelvisVel = pvv;
      this.prevPelvis = pp;
      const flapT = clampV({ x: wind.x * 0.8 - pvv.x * 0.012 - pva.x * 0.0016, y: wind.y * 0.8 - pvv.y * 0.012 - pva.y * 0.0016, z: -Math.abs(pvv.z) * 0.002 - pva.z * 0.0012 }, 7);
      L.flapSwing = S.flaps.map((sp) => sp.step(flapT, 2.3, 0.34, dt));
    }
  }

  PD.Character = Character;
  PD.SPEED = SPEED;
  PD.AGILE = AGILE; // para os testes da virada ágil
  PD.PUNCH_AT = PUNCH_AT;
  PD.DODGE = DODGE;
  PD.DEATH = DEATH;
  PD.HIT = HIT;
  PD.footRocker = rocker; // para os testes (ponto do pé que encosta no chão)
})(window.PD = window.PD || {});
