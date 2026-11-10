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
  const mixV = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  const mixPole = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const copyHand = (h) => ({ local: { x: h.local.x, y: h.local.y, z: h.local.z }, twist: h.twist, poleLocal: h.poleLocal.slice(), fist: h.fist });
  // pose do soco como lista de números (para a emenda do combo somar posição e velocidade)
  const packPB = (b) => [b.chest, b.hips, b.push[0], b.push[1], b.dz, b.dy, b.pitch, b.heel];
  const unpackPB = (a) => ({ chest: a[0], hips: a[1], push: [a[2], a[3]], dz: a[4], dy: a[5], pitch: a[6], heel: a[7] });
  const packHand = (h) => [h.local.x, h.local.y, h.local.z, h.twist, h.poleLocal[0], h.poleLocal[1], h.poleLocal[2], h.fist];
  const unpackHand = (a) => ({ local: { x: a[0], y: a[1], z: a[2] }, twist: a[3], poleLocal: [a[4], a[5], a[6]], fist: a[7] });
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
  // poses do braço no pulo, por ângulos (graus): [braço para a frente, cotovelo, para fora, aberto para o lado]
  const JUMP_ARMS = { tras: [-28, 18, 6, 6], cima: [128, 32, 7, 8], abertos: [22, 28, 3, 55] };
  const jumpArm = (a, b, k) => {
    const m = a.map((v, j) => v + (b[j] - v) * k);
    return armFK(m[0] * DEG, m[1] * DEG, m[2], m[3] * DEG);
  };

  /** Pelve montada igual ao esqueleto (para conferir o alcance das pernas antes de montar). */
  function pelvisFrame(body, pv) {
    const f = M.moved(body, M.at(body, pv.dx, pv.dy, B.hipStand + B.pelvisUp + pv.dz));
    return M.roll(M.pitch(M.yawBy(f, pv.yaw), pv.pitch), pv.roll);
  }

  class Character {
    constructor(x, y, yaw = Math.PI / 4) {
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
      this.hipDrop = 0; // quanto a pelve desce para a perna de apoio alcançar o pé
      this.airArm = 0; // braços no jeito do pulo (0..1)
      // molas do movimento secundário (cabelo, penas, colar, cordão, brinco)
      const z0 = { x: 0, y: 0, z: 0 };
      this.springs = {
        hair: new M.Spring3(z0),
        feathers: [0, 1, 2, 3].map(() => new M.Spring3(z0)),
        pendant: new M.Spring3(z0),
        tassel: new M.Spring3(z0),
        earring: new M.Spring3(z0),
      };
      this.armSprings = [null, null]; // o braço é um pêndulo com peso
      this.headSpring = null; // a cabeça também: segue o peito com um atraso pequeno
      this.prevHead = null;
      this.headVel = { x: 0, y: 0, z: 0 };
      this.look = { blink: 0, hairWind: z0, featherSwing: [z0, z0, z0, z0], pendantSwing: z0, tasselSwing: z0, earringSwing: z0, gazeX: 0, gazeY: 0, mouthOpen: 0, browRaise: 0 };
      this.radius = RADIUS;
      this.equipped = {}; // encaixe → id do item (vazio: o personagem começa sem nada)
      // trava dos pés: o pé que pisa fica preso no chão até o próximo passo (nada de escorregar).
      // x, y = "pé chato" (onde o pé fica sem rolar); o tornozelo sai daí girando em volta do calcanhar ou da ponta.
      this.footLock = [0, 1].map(() => ({ planted: false, x: 0, y: 0, yaw: 0, step: null, lastX: null, lastY: null }));
      this.stepCooldown = 0;
      this._dt = 1 / 60;
      this._pose = null;
      this._punchOut = null; // a última pose do soco (o combo começa dela)
      this._punchPrev = null; // a do quadro anterior (para a velocidade na emenda)
    }

    // ------------------------------------------------------------------ lógica (por quadro)
    /** `input`: { move: {x, y} (direção no chão × força 0..1), run, crouchToggle, jump, attack, attackDir } */
    update(dt, input, world) {
      this.time += dt;
      this._dt = dt;
      this.stepCooldown = Math.max(0, this.stepCooldown - dt);
      const t = this.time;

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
      }

      // soco (com combinação: clicar de novo no fim do golpe emenda o próximo com a outra mão)
      if (input.attack) {
        const dir = input.attackDir != null ? input.attackDir : this.yaw;
        if (!this.attack) this._startPunch(dir, false);
        else if (!this.attack.queued) {
          this.attack.queued = true;
          this.attack.queuedDir = dir;
        }
      }

      // movimento desejado
      const mv = input.move || { x: 0, y: 0 };
      const mag = clamp01(Math.hypot(mv.x, mv.y));
      if (mag > 0.02) this.faceYaw = Math.atan2(mv.y, mv.x);
      let maxSpeed = this.crouchWanted ? SPEED.crouch : input.run ? SPEED.run : SPEED.walk;
      // pediu para ir muito para o lado ou para trás de onde está virado: anda no máximo a 45° da própria frente, e
      // mais devagar, enquanto vira (faz a curva em vez de andar de lado com as pernas cruzando)
      let moveDir = mag > 0.02 ? this.faceYaw : null;
      if (moveDir !== null && !this.attack) {
        const off = angleDiff(this.yaw, moveDir);
        if (Math.abs(off) > 45 * DEG) {
          moveDir = this.yaw + Math.sign(off) * 45 * DEG;
          maxSpeed *= lerp(1, 0.15, smoothstep(45 * DEG, 120 * DEG, Math.abs(off)));
        }
      }
      if (this.attack) {
        const at = this.attack.t;
        if (at > PUNCH_AT.armar[0] && at < PUNCH_AT.recolher[1]) maxSpeed *= 0.3;
        else maxSpeed *= 0.7;
      }
      if (this.jump.state === 'preparo') maxSpeed *= 0.55;
      if (this.jump.state === 'pouso') maxSpeed *= 0.6 + 0.4 * clamp01(this.jump.t / 0.22);
      const want = moveDir !== null ? { x: Math.cos(moveDir) * maxSpeed * mag, y: Math.sin(moveDir) * maxSpeed * mag } : { x: 0, y: 0 };
      const onGround = this.jump.state !== 'ar';
      const prevVel = { x: this.vel.x, y: this.vel.y };
      {
        const dx = want.x - this.vel.x;
        const dy = want.y - this.vel.y;
        const d = Math.hypot(dx, dy);
        const braking = Math.hypot(want.x, want.y) < Math.hypot(this.vel.x, this.vel.y);
        const a = (onGround ? (braking ? ACCEL.brake : ACCEL.ground) : ACCEL.air) * dt;
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
      if (this.attack && onGround) {
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
      this.accel = { x: (this.vel.x - prevVel.x) / Math.max(dt, 1e-3), y: (this.vel.y - prevVel.y) / Math.max(dt, 1e-3) };

      // virar para onde anda (no soco, para onde bate): suave e com velocidade máxima (nada de pular de pose)
      const prevYaw = this.yaw;
      let wantYaw = null;
      if (this.attack) wantYaw = this.attack.dir;
      else if (this.speed > 60 && mag > 0.02) wantYaw = Math.atan2(this.vel.y, this.vel.x);
      else if (this.faceYaw !== null) wantYaw = this.faceYaw; // devagar ou parado: vira para onde mandou (e termina)
      if (wantYaw !== null) {
        const fast = clamp01(this.speed / SPEED.run);
        const lambda = this.attack ? 18 : lerp(14, 9, fast);
        const maxStep = (this.attack ? TURN.attack : lerp(TURN.still, TURN.run, fast)) * DEG * dt;
        const next = dampAngle(this.yaw, wantYaw, lambda, dt);
        let d = clamp(angleDiff(this.yaw, next), -maxStep, maxStep);
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
        this.yaw += d;
      }
      this.yawRate = damp(this.yawRate, dt > 0 ? angleDiff(prevYaw, this.yaw) / dt : 0, 10, dt);
      // a cabeça vai na frente nas curvas: olha para onde o corpo vai virar
      const aim = this.attack ? this.attack.dir : mag > 0.02 ? Math.atan2(mv.y, mv.x) : this.yaw;
      this.turnLead = damp(this.turnLead, clamp(angleDiff(this.yaw, aim) * 0.6, -0.45, 0.45), 10, dt);

      // passada: avança pela distância (o pé no chão não escorrega)
      const step = this._stepLength(this.speed);
      if (onGround) this.phase = (this.phase + moved / (2 * step)) % 1;
      const gaitWant = smoothstep(5, 70, this.speed) * (onGround ? 1 : 0.4);
      this.gait = damp(this.gait, gaitWant, gaitWant < this.gait ? 14 : 9, dt);
      const runT = this.speed > SPEED.walk * 1.12 ? smoothstep(SPEED.walk * 1.1, SPEED.run * 0.85, this.speed) : 0;
      this.runBlend = damp(this.runBlend, runT, 6, dt);

      // agachar suave
      this.crouch = damp(this.crouch, this.crouchWanted ? 1 : 0, 9, dt);

      // pulo
      const J = this.jump;
      J.t += dt;
      if (J.state === 'preparo') {
        // agacha e começa a esticar as pernas antes de sair do chão (o corpo já sobe quando os pés saem)
        J.crouch = J.t < 0.09 ? 0.62 * easeOut(J.t / 0.09) : 0.62 - 0.34 * easeInOut((J.t - 0.09) / 0.06);
        J.air = 0;
        if (J.t >= 0.15) {
          J.state = 'ar';
          J.t = 0;
          this.vz = 440 + 50 * J.running;
          this.events.push({ type: 'poeira', x: this.pos.x, y: this.pos.y, strength: 0.7 });
        }
      } else if (J.state === 'ar') {
        this.vz -= GRAVITY * dt;
        this.pos.z += this.vz * dt;
        // chegando no chão, os joelhos já começam a dobrar para amortecer
        const near = this.vz < 0 ? 1 - smoothstep(0, 30, this.pos.z) : 0;
        J.crouch = damp(J.crouch, 0.17 * near, near > 0 ? 30 : 14, dt);
        J.air = damp(J.air, 1, 16, dt);
        if (this.pos.z <= 0 && this.vz < 0) {
          J.crouch0 = J.crouch;
          J.impact = clamp(-this.vz / 620, 0.45, 1);
          this.pos.z = 0;
          this.vz = 0;
          J.state = 'pouso';
          J.t = 0;
          J.air = 0;
          this.events.push({ type: 'poeira', x: this.pos.x, y: this.pos.y, strength: J.impact });
        }
      } else if (J.state === 'pouso') {
        // amortece na mesma velocidade da queda e depois levanta
        const down = 0.14;
        const peak = Math.max(J.impact * 0.85, J.crouch0 || 0);
        J.crouch = J.t < down ? lerp(J.crouch0 || 0, peak, easeOut(J.t / down)) : peak * (1 - easeInOut((J.t - down) / (0.42 - down)));
        if (J.t >= 0.42) {
          J.state = 'chao';
          J.crouch = 0;
        }
      } else {
        J.crouch = damp(J.crouch, 0, 12, dt);
      }

      // soco (no "armar", se o corpo ainda não virou para o alvo, o golpe espera um pouco)
      this._attackRate = 1;
      if (this.attack) {
        const A = this.attack;
        if (A.t > PUNCH_AT.armar[0] && A.t < PUNCH_AT.armar[1]) {
          const off = Math.abs(angleDiff(this.yaw, A.dir));
          this._attackRate = lerp(1, 0.12, smoothstep(4 * DEG, 25 * DEG, off));
          if (this.footLock[0].step || this.footLock[1].step) this._attackRate = Math.min(this._attackRate, 0.3);
        }
        A.t += dt * this._attackRate;
        if (!A.hit && A.t >= PUNCH_AT.golpe[1]) {
          A.hit = true;
          this.events.push({ type: 'impacto', hand: A.hand });
        }
        if (A.queued && A.t >= PUNCH_AT.recolher[0] + 0.05) {
          this._startPunch(A.queuedDir, true);
        } else if (A.t >= PUNCH_AT.total) {
          this.attack = null;
          this._punchOut = null;
          this._punchPrev = null;
        }
      }
      this.stanceLead = damp(this.stanceLead, this.attack && this.attack.t < PUNCH_AT.voltar[0] ? 1 : 0, 10, dt);

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

    /** Veste um item num encaixe (veja js/character/equipment.js). */
    equip(slot, id) {
      if (!PD.equipment || !PD.equipment.catalog.has(id)) throw new Error('item não existe: ' + id);
      this.equipped[slot] = id;
    }
    unequip(slot) {
      delete this.equipped[slot];
    }

    attackBusy() {
      return !!(this.attack && this.attack.t < PUNCH_AT.recolher[1]);
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
      const walk = 0.25 * speed + 24; // 160 cm/s → passo de 64 cm (~150 passos por minuto)
      const run = 0.2 * speed + 32; // 440 cm/s → passo de 120 cm
      const crouch = 0.25 * speed + 14;
      const s = lerp(walk, run, this.runBlend);
      return lerp(s, crouch, this.crouch);
    }

    _label() {
      if (this.attack) return 'Atacando';
      if (this.jump.state === 'preparo' || this.jump.state === 'ar') return 'Pulando';
      if (this.crouch > 0.5) return this.speed > 20 ? 'Andando agachado' : 'Agachado';
      if (this.speed > SPEED.walk * 1.2) return 'Correndo';
      if (this.speed > 18) return 'Andando';
      return 'Parado';
    }

    // ------------------------------------------------------------------ pose
    /** Pose para o esqueleto (ver `PD.rig.buildRig`). Chamada uma vez por quadro, depois de `update`. */
    pose() {
      if (this._pose) return this._pose;
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
      const step = this._stepLength(this.speed);
      const sweep = S * 2 * step * g; // quanto o pé apoiado "anda para trás" em relação ao corpo
      const front = lerp(0.4, 0.42, run); // parte do apoio que acontece na frente do quadril
      const lift = lerp(lerp(4.5, 7.5, speedK), 23, run) * (1 - 0.45 * crouch);
      const heelStrike = lerp(16, 6, run) * (1 - 0.5 * crouch); // graus: pisa com o calcanhar (ponta para cima)
      const toeOff = lerp(48, 42, run) * (1 - 0.4 * crouch); // graus: sai do chão pela ponta (calcanhar para cima)
      const heelFrom = lerp(0.55, 0.4, run); // quando o calcanhar começa a subir (fração do apoio)

      // ---- pelve: alta no meio do apoio (perna quase esticada), baixa quando os dois pés estão no chão
      const mid = Math.cos(4 * Math.PI * (ph - S / 2)); // +1 no meio do apoio, -1 no apoio duplo (ou no voo)
      const bobWalk = -3 * Math.pow((1 - mid) / 2, 1.4) * lerp(0.35, 1, speedK); // e a pelve desce o resto se precisar
      const bobRun = -2 * mid - 5; // correndo: mais baixo no meio do apoio (o joelho amortece), alto no voo
      const bob = lerp(bobWalk, bobRun, run) * g * (1 - 0.6 * crouch);
      const idleSway = M.noise1(t * 0.23) * 1.1 * idle;
      // parado: o peso fica mais numa perna (troca devagar) — quadril de um lado, ombros do outro
      const weight = clamp(0.55 + 0.6 * M.noise1(t * 0.07 + 1.7), -1, 1) * idle * (1 - crouch);
      const pelvis = {
        dx: -lerp(2, 0.9, run) * s2 * g + idleSway + weight * 2.6,
        dy: 3 * run * g + this.leanPitch * 20,
        dz: bob - 35 * crouch - 27 * J.crouch + breath * 0.25 * idle,
        yaw: lerp(5, 10, run) * DEG * c2 * g,
        pitch: (lerp(2, 10, run) * g + 24 * crouch + 16 * J.crouch) * DEG + this.leanPitch * 0.5,
        roll: lerp(3.4, 2.2, run) * DEG * s2 * g + idleSway * 0.012 - weight * 3.4 * DEG,
      };
      // ---- coluna (peito em relação à pelve): gira ao contrário da pelve, um pouco atrasado
      const chestYawAbs = lerp(-5, -11, run) * DEG * Math.cos(TAU * (ph - 0.035)) * g;
      const settle = (1 - Math.cos(4 * Math.PI * (ph - S / 2 - 0.05))) / 2; // o tronco "assenta" logo depois de pisar
      const spine = {
        pitch: (lerp(4, 12, run) * g + 20 * crouch + 10 * J.crouch) * DEG + this.leanPitch - breath * 0.6 * DEG * idle + settle * 1.1 * DEG * g * (1 - run),
        yaw: chestYawAbs - pelvis.yaw,
        roll: -pelvis.roll * 0.75 - lerp(1.2, 0.8, run) * DEG * Math.sin(TAU * (ph - 0.11)) * g - this.leanRoll + weight * 2.2 * DEG,
      };

      // ---- braços (alvo do punho em relação ao ombro, no espaço do peito: x = para fora, y = frente, z = cima)
      const hands = [];
      const shoulderFwd = [0, 0];
      const runPole = smoothstep(0.15, 0.65, run * g);
      this.airArm = damp(this.airArm, J.state === 'ar' ? 1 : 0, 14, dt);
      for (let i = 0; i < 2; i++) {
        const w = i === 1 ? c2 : -c2; // +1 = braço na frente (vai junto com a perna do outro lado)
        const fw = (w + 1) / 2;
        // parado: braço solto ao lado do corpo, cotovelo pouco dobrado
        const idleArm = armFK((2.5 + breath * 0.4) * DEG, (20 + M.noise1(t * 0.3 + i * 5) * 3) * DEG, 2.8 + breath * 0.3);
        // andando: pêndulo a partir do ombro; na frente o cotovelo dobra mais e a mão passa um pouco para dentro
        const swing = lerp(10, 23, speedK);
        const walkArm = armFK((2 + w * swing) * DEG, (16 + 19 * Math.pow(Math.max(0, w), 1.3) + 3 * (1 - Math.abs(w))) * DEG, lerp(3, 0.8, fw));
        // correndo: cotovelo perto de 90°, o punho sobe na frente; atrás o cotovelo não abre ("asa de galinha")
        const runArm = armFK((3 + w * 36) * DEG, (80 + 20 * Math.max(0, w)) * DEG, lerp(3, -0.5, fw));
        let a = mixV(walkArm, runArm, run);
        a = mixV(idleArm, a, g);
        // agachado: mãos para a frente, perto dos joelhos
        a = mixV(a, { x: 3, y: 25, z: -41 }, crouch * 0.9);
        let fist = lerp(lerp(0.15, 0.25, g), 0.7, run * g);
        fist = lerp(fist, 0.3, crouch);
        // pulo: braços para trás no preparo, sobem no impulso (acima da cabeça), abrem para equilibrar
        if (J.state === 'preparo') a = mixV(a, jumpArm(JUMP_ARMS.tras, JUMP_ARMS.tras, 0), easeOut(J.t / 0.11));
        if (J.state === 'ar') {
          // braços: de trás jogam para cima e para a frente (em arco) e depois abrem para equilibrar a queda
          const tA = J.t;
          const falling = clamp01(-this.vz / 300);
          a = tA < 0.18 ? jumpArm(JUMP_ARMS.tras, JUMP_ARMS.cima, smoothstep(0, 0.18, tA)) : jumpArm(JUMP_ARMS.cima, JUMP_ARMS.abertos, clamp01(smoothstep(0.18, 0.45, tA) * 0.6 + falling * 0.4));
        }
        if (J.state === 'pouso') a = mixV(a, { x: 8, y: 16, z: -42 }, clamp01(J.crouch / 0.85));
        fist = lerp(fist, 0.35, this.airArm);
        const poleLocal = mixPole(mixPole(POLE.solto, POLE.correndo, runPole), POLE.ar, this.airArm);
        // mola: o braço é um pêndulo com peso — atrasa um pouco em relação ao corpo e assenta sozinho quando para
        if (!this.armSprings[i]) this.armSprings[i] = new M.Spring3(a);
        a = this.armSprings[i].step(a, J.state === 'chao' ? 3.6 : 6.5, 0.72, dt);
        hands.push({ local: a, twist: lerp(0, -0.35, run * g), poleLocal, fist });
        shoulderFwd[i] = lerp(1.2, 2.4, run) * w * g; // o ombro acompanha o braço
      }

      // ---- soco: guarda, armar, golpe, segurar, recolher, voltar (por cima dos braços; gira o tronco em cadeia)
      let mouthOpen = 0;
      let browRaise = 0;
      let guardK = 0;
      let heelUp = 0; // graus: calcanhar de trás no golpe
      const A = this.attack;
      if (A) {
        const P = PUNCH_AT;
        const tt = A.t;
        const ph2 = (name) => clamp01((tt - P[name][0]) / (P[name][1] - P[name][0]));
        const h = A.hand;
        const other = 1 - h;
        const sideH = h === 0 ? -1 : 1;
        const rear = h !== A.lead; // mão de trás (direto): gira mais; mão da frente (jab): gira menos
        const baseH = hands[h];
        const baseO = hands[other];
        const guardFront = { x: -7.5, y: 15, z: -13 };
        const guardRear = { x: -6.5, y: 11, z: -8 };
        // armar: o direto recolhe o punho até o queixo; o jab sai quase da guarda
        const wound = rear ? { x: -4.5, y: 4, z: -9.5 } : { x: -6.5, y: 10, z: -11 };
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
        heelUp = pb.heel;
        spine.yaw += pb.chest * 1.05 - pb.hips * 0.35;
        pelvis.yaw += pb.hips * 0.35;
        spine.pitch += pb.pitch;
        pelvis.dz += pb.dz;
        pelvis.dy += pb.dy;
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
          const lat = sideH * 2.5 - shR;
          const df = Math.sqrt(Math.max(1, ext * ext - lat * lat - z * z)); // para a frente, a partir do ombro
          // no espaço do peito: tira o giro (cy) e a inclinação (cp)
          const fy = lat * Math.sin(cy) + df * Math.cos(cy);
          return { x: sideH * (lat * Math.cos(cy) - df * Math.sin(cy)), y: fy * Math.cos(cp) - z * Math.sin(cp), z: fy * Math.sin(cp) + z * Math.cos(cp) };
        };
        const strike = reachTo(50.8, -1.5);
        const over = reachTo(52.2, -1.2); // passa um tiquinho no impacto (sem esticar o cotovelo até travar)
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
          twist: lerp(baseH.twist, -1.45, pronate),
          poleLocal: mixPole(baseH.poleLocal, mixPole(POLE.armado, POLE.golpe, smoothstep(P.golpe[0], P.golpe[1], tt) * (1 - smoothstep(P.recolher[0], P.recolher[1], tt))), wArm),
          fist: lerp(baseH.fist, 1, wArm),
        };
        hs[other] = {
          local: mixV(baseO.local, guardRear, wArm),
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

      // ---- pés: o animador diz onde o pé "quer" estar; a trava prende no chão o pé que pisou
      const body = M.frameYaw({ x: this.pos.x, y: this.pos.y, z: this.groundZ }, this.yaw);
      const feet = [];
      const grounded = [false, false];
      const hipZ = B.hipStand + pelvis.dz;
      const lead = A ? A.lead : this.lastLead;
      const inAir = J.state === 'ar' || J.air > 0.02;
      const turningInPlace = !A && this.faceYaw !== null && this.speed < 60 && Math.abs(angleDiff(this.yaw, this.faceYaw)) > 1.0;
      const walkFeet = g > 0.08 && !turningInPlace;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const p = (ph + (i === 0 ? 0 : 0.5)) % 1;
        let y = 0;
        let up = 0;
        let pitch = 0; // graus: + = ponta do pé para cima (calcanhar no chão), - = calcanhar para cima
        let bend = 0; // graus: dedos dobrados (ficam deitados no chão quando o calcanhar sobe)
        let swingS = -1; // fração do balanço (-1 = pé apoiado)
        if (g > 0.001) {
          if (p < S) {
            // apoio: pisa com o calcanhar, fica chato, e o calcanhar sobe até sair pela ponta
            const s = p / S;
            y = lerp(front * sweep, (front - 1) * sweep, s);
            const rise = clamp01((s - heelFrom) / (1 - heelFrom));
            pitch = heelStrike * (1 - smoothstep(0, 0.16, s)) - toeOff * Math.pow(rise, 1.7);
          } else {
            // balanço: o pé sai do chão parado e pousa parado (no chão, não em relação ao corpo): enquanto o corpo
            // anda `travel`, ele vai de trás para a frente numa curva suave; o calcanhar sobe para trás no começo
            // (o joelho dobra) e o pé passa baixo na frente
            const s = (p - S) / (1 - S);
            swingS = s;
            const y0 = (front - 1) * sweep;
            const travel = (1 - S) * 2 * step * g;
            // andando, a curva é simétrica; correndo, o pé vem para a frente mais cedo (o joelho dobra e o
            // calcanhar sobe perto do bumbum, em vez de a perna esticar para trás)
            const b = lerp(2, 2.2, run);
            const ease = 1 - Math.pow(1 - s, b) * (1 + b * s);
            y = y0 + (travel + front * sweep - y0) * ease - s * travel;
            const upWalk = Math.pow(Math.sin(Math.PI * Math.pow(s, 0.65)), 1.2);
            const upRun = Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.85);
            up = lift * lerp(upWalk, upRun, run);
            up += run * 17 * Math.pow(Math.sin(Math.PI * clamp01((s - 0.05) / 0.5)), 1.2);
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
        const st = this.footLock[i];
        let pos;
        if (inAir) {
          // no ar: o impulso sai do pé que estava no chão (a ponta empurra até a perna esticar), a perna encolhe
          // subindo e estica um pouco (joelho ainda dobrado) para pousar
          if (st.planted || st.step) {
            st.pushX = st.lastX ?? ref.x;
            st.pushY = st.lastY ?? ref.y;
            st.pushYaw = st.yaw;
          }
          st.planted = false;
          st.step = null;
          st.fx = undefined; // o próximo balanço começa de novo (nada de reaproveitar o de antes do pulo)
          const tA = J.state === 'ar' ? J.t : 1;
          const rising = clamp01(this.vz / 300);
          const fall = clamp01(-this.vz / 300);
          const push = J.state === 'ar' ? 1 - smoothstep(0.05, 0.22, tA) : 0; // empurrando o chão com a ponta
          const tuck = lerp(0.84, 0.62, rising) + 0.1 * fall;
          const split = J.running * (i === J.lead ? 1 : -1);
          const ay = split * 20 + (i === 0 ? 5 : -1) + 12 * rising * (1 - push);
          const air = M.at(body, side * (B.footSide - 1), ay, this.pos.z + hipZ - B.legLength * tuck - split * 6);
          air.z = Math.max(air.z, this.groundZ + B.ankleHeight); // o pé nunca entra no chão
          const airPitch = lerp(-30, -12, fall);
          const gaitPos = ankleOf(ref, pitch, yawAbs);
          const gaitPitch = pitch;
          pos = M.lerp3(gaitPos, air, J.air);
          pitch = lerp(pitch, airPitch, J.air);
          // descendo perto do chão: o pé vai para o lugar onde vai pisar
          const landK = J.state === 'ar' ? fall * (1 - smoothstep(0, 24, this.pos.z)) : 0;
          if (landK > 0) {
            pos = M.lerp3(pos, { x: gaitPos.x, y: gaitPos.y, z: Math.max(pos.z, gaitPos.z) }, landK);
            pitch = lerp(pitch, gaitPitch, landK);
          }
          if (push > 0 && st.pushX !== undefined) {
            const pushPos = ankleOf({ x: st.pushX, y: st.pushY, z: this.groundZ + B.ankleHeight }, -48, st.pushYaw);
            pos = M.lerp3(pos, pushPos, push);
            pitch = lerp(pitch, -48, push);
            yawAbs = st.pushYaw + angleDiff(st.pushYaw, yawAbs) * (1 - push);
          }
          bend = 0;
          const r0 = refOf(pos, pitch, yawAbs);
          st.lastX = r0.x;
          st.lastY = r0.y;
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
                  st.x = landing ? st.lastX : ref.x;
                  st.y = landing ? st.lastY : ref.y;
                  st.yaw = yawAbs;
                } else if (!other.step && J.state === 'chao' && Math.abs(angleDiff(st.yaw, yawAbs)) > 0.7) {
                  // virada fechada andando devagar: o corpo girou por cima do pé; ele dá um passo de virada
                  st.step = { t: 0, dur: 0.15, fx: st.x, fy: st.y, fyaw: st.yaw };
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
                }
                const k = smoothstep(0, 0.6, swingS);
                ref.x += st.fx * (1 - k);
                ref.y += st.fy * (1 - k);
                yawAbs = st.fyaw + angleDiff(st.fyaw, yawAbs) * smoothstep(0, 0.9, swingS);
              }
            } else {
              // parado (ou quase): o pé fica no chão; se o lugar certo ficou longe, dá um passinho
              if (!st.planted) {
                const landing = J.state === 'pouso' || J.state === 'preparo';
                if (!landing && st.lastX !== null && Math.hypot(ref.x - st.lastX, ref.y - st.lastY) > 2) {
                  st.step = { t: 0, dur: 0.18, fx: st.lastX, fy: st.lastY, fyaw: st.yaw };
                } else {
                  // pousando: o pé fica onde tocou o chão (ajeita depois, se precisar)
                  st.planted = true;
                  st.x = landing && st.lastX !== null ? st.lastX : ref.x;
                  st.y = landing && st.lastY !== null ? st.lastY : ref.y;
                  st.yaw = landing ? st.yaw : yawAbs;
                }
              }
              if (!st.step && st.planted) {
                // virada pequena: gira o pé sobre a base dos dedos (a ponta fica parada no chão)
                const yawErr = angleDiff(st.yaw, yawAbs);
                if (Math.abs(yawErr) > 0.01 && J.state === 'chao') {
                  const turn = clamp(yawErr, -(A ? 11 : 6) * dt, (A ? 11 : 6) * dt);
                  const bx = st.x + Math.cos(st.yaw) * B.ballFwd;
                  const by = st.y + Math.sin(st.yaw) * B.ballFwd;
                  st.yaw += turn;
                  st.x = bx - Math.cos(st.yaw) * B.ballFwd;
                  st.y = by - Math.sin(st.yaw) * B.ballFwd;
                }
                const striking = A && A.t > PUNCH_AT.golpe[0] - 0.02 && A.t < PUNCH_AT.recolher[1];
                // no soco os pés só giram na ponta até ~70° e aguentam a base mais aberta (sem passinhos à toa)
                const far = Math.hypot(ref.x - st.x, ref.y - st.y) > (A ? 14 : 9) || Math.abs(angleDiff(st.yaw, yawAbs)) > (A ? 1.2 : 0.75);
                if (far && !other.step && !striking && J.state === 'chao' && (this.stepCooldown <= 0 || A)) {
                  st.step = { t: 0, dur: A ? 0.11 : turningInPlace ? 0.15 : 0.2, fx: st.x, fy: st.y, fyaw: st.yaw };
                  st.planted = false;
                  this.stepCooldown = turningInPlace ? 0.03 : 0.08;
                }
              }
            }
          }
          if (st.step) {
            // passo: levanta, vai até onde o pé quer estar agora e pisa
            st.step.t += dt / st.step.dur;
            const k = clamp01(st.step.t);
            const e = easeInOut(k);
            ref.x = lerp(st.step.fx, ref.x, e);
            ref.y = lerp(st.step.fy, ref.y, e);
            ref.z += 7 * Math.sin(Math.PI * k);
            pitch += -10 * Math.sin(Math.PI * k);
            yawAbs = st.step.fyaw + angleDiff(st.step.fyaw, yawAbs) * e;
            bend = 0;
            if (k >= 1) {
              st.step = null;
              st.planted = true;
              st.x = ref.x;
              st.y = ref.y;
              st.yaw = yawAbs;
            }
          } else if (st.planted) {
            ref.x = st.x;
            ref.y = st.y;
            yawAbs = st.yaw;
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
          }
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
          const need = Math.asin(clamp((this.groundZ - ballZ) / 5.2, -1, 1)) / DEG - pitch;
          if (need > bend) bend = Math.min(need, 75);
        }
        feet.push({ pos, pitch: pitch * DEG, yaw: yawAbs, toeBend: bend * DEG });
      }

      // ---- a perna nunca estica além da conta: se o pé apoiado ficou longe, a pelve desce um pouco. Longe demais
      // (curva muito fechada, começo da caminhada), o pé dá um passo rápido em vez de a pelve afundar
      if (!inAir) {
        const pf = pelvisFrame(body, pelvis);
        const L = B.legLength * 0.998;
        let need = 0;
        let worst = -1;
        for (let i = 0; i < 2; i++) {
          if (!grounded[i]) continue;
          const hip = M.at(pf, (i === 0 ? -1 : 1) * B.hipHalf, 0, -B.pelvisUp);
          const a = feet[i].pos;
          const horiz = Math.hypot(hip.x - a.x, hip.y - a.y);
          const n = hip.z - a.z - Math.sqrt(Math.max(0, L * L - horiz * horiz));
          if (n > need) {
            need = n;
            worst = i;
          }
        }
        const cap = lerp(3, 5.5, smoothstep(0.3, 0.9, g));
        if (need > cap + 0.4 && walkFeet) {
          const st = this.footLock[worst];
          if (!this.footLock[1 - worst].step && !st.step) {
            st.step = { t: 0, dur: 0.16, fx: st.x, fy: st.y, fyaw: st.yaw };
            st.planted = false;
          }
        }
        need = clamp(need, 0, cap);
        this.hipDrop = need >= this.hipDrop ? need : damp(this.hipDrop, need, 9, dt);
      } else {
        this.hipDrop = damp(this.hipDrop, 0, 9, dt);
      }
      pelvis.dz -= this.hipDrop;

      // ---- cabeça: segue o peito (segura só uma parte do giro, como quem olha para a frente) com uma mola — a
      // cabeça tem peso e chega um pouquinho depois —, vai na frente nas curvas e, no soco, baixa o queixo
      const cYaw = pelvis.yaw + spine.yaw;
      const cPitch = pelvis.pitch + spine.pitch;
      const cRoll = pelvis.roll + spine.roll;
      const lookYaw = M.noise1(t * 0.13 + 7) * 7 * DEG * idle;
      const lookPitch = M.noise1(t * 0.11 + 3) * 3 * DEG * idle;
      const nod = settle * 0.9 * DEG * g * (1 - run);
      const hTarget = {
        x: cYaw * lerp(lerp(0.62, 0.5, run * g), 0.4, guardK) + lookYaw + this.turnLead,
        y: cPitch * 0.32 + lookPitch + (2 * run * g + 4) * DEG + nod + 4 * DEG * guardK,
        z: cRoll * 0.5 - weight * 0.8 * DEG,
      };
      if (!this.headSpring) this.headSpring = new M.Spring3(hTarget);
      const hv = this.headSpring.step(hTarget, lerp(3.4, 6.5, guardK), 0.82, dt);
      const head = { yaw: hv.x - cYaw, pitch: hv.y - cPitch, roll: hv.z - cRoll };

      // ---- respiração e ombros
      const shrug = [breath * 0.35 * idle, breath * 0.35 * idle];

      // ---- rosto (no soco, os olhos ficam no alvo mesmo com a cabeça um pouco virada)
      this.look.blink = this.blinkT >= 0 ? Math.sin((this.blinkT / 0.15) * Math.PI) : 0;
      this.look.gazeX = A ? clamp((angleDiff(this.yaw, A.dir) - hv.x) / (30 * DEG), -1, 1) * 0.9 * guardK : M.noise1(t * 0.4 + 11) * 0.8 * idle;
      this.look.gazeY = A ? 0 : M.noise1(t * 0.31 + 2) * 0.4 * idle;
      this.look.mouthOpen = Math.max(mouthOpen, J.state === 'preparo' ? 0.25 : 0, this.runBlend * g * 0.25);
      this.look.browRaise = browRaise;

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
      const gust = 0.55 + 0.45 * M.noise1(t * 0.35) + 0.3 * Math.max(0, M.noise1(t * 1.3 + 4));
      const wind = { x: 0.8 * gust, y: -0.45 * gust, z: 0.1 * Math.sin(t * 2.1) };
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
    }
  }

  PD.Character = Character;
  PD.SPEED = SPEED;
  PD.PUNCH_AT = PUNCH_AT;
  PD.footRocker = rocker; // para os testes (ponto do pé que encosta no chão)
})(window.PD = window.PD || {});
