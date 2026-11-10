// O personagem que se mexe: física simples (andar, correr, pular), estados (agachado, atacando) e o
// animador procedural, que transforma tudo isso numa pose para o esqueleto a cada quadro.
//
// Nada de quadros desenhados: a passada é calculada pela distância andada (o pé de apoio fica parado no
// chão), e as transições (parar, agachar, pular, socar) são misturas suaves entre poses.
(function (PD) {
  'use strict';
  const M = PD.math;
  const B = PD.BODY;
  const { clamp, clamp01, lerp, smoothstep, easeInOut, easeOut, easeOutBack, damp, dampAngle, angleDiff, DEG, TAU } = M;

  const SPEED = { walk: 160, run: 440, crouch: 82 };
  const ACCEL = { ground: 2400, brake: 3000, air: 520 };
  const GRAVITY = 1550;
  const RADIUS = 22; // corpo no chão (colisão)

  // fases do soco: preparar (guarda), armar, golpe, segurar, recolher, voltar
  const PUNCH = [
    ['guarda', 0.09],
    ['armar', 0.09],
    ['golpe', 0.075],
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

  class Character {
    constructor(x, y, yaw = Math.PI / 4) {
      this.pos = { x, y, z: 0 }; // z = altura do pulo (acima do chão)
      this.groundZ = 0; // altura do chão embaixo (calçada 14 cm, rua 0)
      this.vel = { x: 0, y: 0 };
      this.vz = 0;
      this.yaw = yaw;
      this.yawRate = 0;
      this.speed = 0;
      this.phase = 0;
      this.gait = 0;
      this.runBlend = 0;
      this.crouch = 0;
      this.crouchWanted = false;
      this.jump = { state: 'chao', t: 0, impact: 0, crouch: 0, air: 0, running: 0, lead: 0 };
      this.attack = null;
      this.nextHand = 1; // começa com a direita
      this.time = 0;
      this.blinkIn = 2.2;
      this.blinkT = -1;
      this.accel = { x: 0, y: 0 };
      this.leanPitch = 0;
      this.leanRoll = 0;
      this.events = [];
      this.label = 'Parado';
      this.stanceLead = 0; // pés em posição de luta (0..1)
      // molas do movimento secundário (cabelo, penas, colar, cordão, brinco)
      const z0 = { x: 0, y: 0, z: 0 };
      this.springs = {
        hair: new M.Spring3(z0),
        feathers: [0, 1, 2, 3].map(() => new M.Spring3(z0)),
        pendant: new M.Spring3(z0),
        tassel: new M.Spring3(z0),
        earring: new M.Spring3(z0),
      };
      this.prevHead = null;
      this.headVel = { x: 0, y: 0, z: 0 };
      this.look = { blink: 0, hairWind: z0, featherSwing: [z0, z0, z0, z0], pendantSwing: z0, tasselSwing: z0, earringSwing: z0, gazeX: 0, gazeY: 0, mouthOpen: 0, browRaise: 0 };
      this.radius = RADIUS;
      this.equipped = {}; // encaixe → id do item (vazio: o personagem começa sem nada)
      // trava dos pés: o pé que pisa fica preso no chão até o próximo passo (nada de escorregar)
      this.footLock = [0, 1].map(() => ({ planted: false, x: 0, y: 0, yaw: 0, step: null, lastX: null, lastY: null }));
      this.stepCooldown = 0;
      this._dt = 1 / 60;
      this._pose = null;
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
        else if (this.attack.t > PUNCH_AT.golpe[0]) {
          this.attack.queued = true;
          this.attack.queuedDir = dir;
        }
      }

      // movimento desejado
      const mv = input.move || { x: 0, y: 0 };
      const mag = clamp01(Math.hypot(mv.x, mv.y));
      let maxSpeed = this.crouchWanted ? SPEED.crouch : input.run ? SPEED.run : SPEED.walk;
      if (this.attack) {
        const at = this.attack.t;
        if (at > PUNCH_AT.armar[0] && at < PUNCH_AT.recolher[1]) maxSpeed *= 0.3;
        else maxSpeed *= 0.7;
      }
      if (this.jump.state === 'preparo') maxSpeed *= 0.55;
      if (this.jump.state === 'pouso') maxSpeed *= 0.6 + 0.4 * clamp01(this.jump.t / 0.22);
      const want = mag > 0.02 ? { x: (mv.x / mag) * maxSpeed * mag, y: (mv.y / mag) * maxSpeed * mag } : { x: 0, y: 0 };
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
      // investida do soco (um passinho para a frente no golpe)
      if (this.attack) {
        const at = this.attack.t;
        if (at > PUNCH_AT.golpe[0] && at < PUNCH_AT.impacto[1]) {
          this.vel.x += Math.cos(this.attack.dir) * 260 * dt * 8 * (1 - this.gait * 0.6);
          this.vel.y += Math.sin(this.attack.dir) * 260 * dt * 8 * (1 - this.gait * 0.6);
        }
      }

      // anda e bate nas coisas (o mundo corrige a posição)
      const before = { x: this.pos.x, y: this.pos.y };
      let nx = this.pos.x + this.vel.x * dt;
      let ny = this.pos.y + this.vel.y * dt;
      if (world) {
        const fixed = world.collide(nx, ny, RADIUS);
        nx = fixed.x;
        ny = fixed.y;
      }
      this.pos.x = nx;
      this.pos.y = ny;
      // sobe e desce o meio-fio suave
      if (world) this.groundZ = damp(this.groundZ, world.heightAt(nx, ny), 22, dt);
      const moved = Math.hypot(nx - before.x, ny - before.y);
      const realSpeed = dt > 0 ? moved / dt : 0;
      // velocidade "de verdade" (parede segura o personagem: não fica andando no lugar)
      if (dt > 0) {
        this.vel.x = (nx - before.x) / dt;
        this.vel.y = (ny - before.y) / dt;
      }
      this.speed = damp(this.speed, realSpeed, 18, dt);
      this.accel = { x: (this.vel.x - prevVel.x) / Math.max(dt, 1e-3), y: (this.vel.y - prevVel.y) / Math.max(dt, 1e-3) };

      // virar para onde anda (no soco, para onde bate)
      const prevYaw = this.yaw;
      if (this.attack) this.yaw = dampAngle(this.yaw, this.attack.dir, 22, dt);
      else if (this.speed > 10 && mag > 0.02) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.y, this.vel.x), lerp(13, 9, this.runBlend), dt);
      this.yawRate = damp(this.yawRate, dt > 0 ? angleDiff(prevYaw, this.yaw) / dt : 0, 10, dt);

      // passada: avança pela distância (o pé no chão não escorrega)
      const step = this._stepLength(this.speed);
      if (onGround) this.phase = (this.phase + moved / (2 * step)) % 1;
      this.gait = damp(this.gait, smoothstep(5, 70, this.speed) * (onGround ? 1 : 0.4), 9, dt);
      const runT = this.speed > SPEED.walk * 1.12 ? smoothstep(SPEED.walk * 1.1, SPEED.run * 0.85, this.speed) : 0;
      this.runBlend = damp(this.runBlend, runT, 6, dt);

      // agachar suave
      this.crouch = damp(this.crouch, this.crouchWanted ? 1 : 0, 9, dt);

      // pulo
      const J = this.jump;
      J.t += dt;
      if (J.state === 'preparo') {
        J.crouch = 0.62 * easeOut(J.t / 0.13);
        J.air = 0;
        if (J.t >= 0.13) {
          J.state = 'ar';
          J.t = 0;
          this.vz = 440 + 50 * J.running;
          this.events.push({ type: 'poeira', x: this.pos.x, y: this.pos.y, strength: 0.7 });
        }
      } else if (J.state === 'ar') {
        this.vz -= GRAVITY * dt;
        this.pos.z += this.vz * dt;
        J.crouch = damp(J.crouch, 0, 14, dt);
        J.air = damp(J.air, 1, 16, dt);
        if (this.pos.z <= 0 && this.vz < 0) {
          J.impact = clamp(-this.vz / 620, 0.45, 1);
          this.pos.z = 0;
          this.vz = 0;
          J.state = 'pouso';
          J.t = 0;
          J.air = 0;
          this.events.push({ type: 'poeira', x: this.pos.x, y: this.pos.y, strength: J.impact });
        }
      } else if (J.state === 'pouso') {
        const k = J.t / 0.42;
        J.crouch = J.impact * 0.85 * (k < 0.22 ? easeOut(k / 0.22) : 1 - easeInOut((k - 0.22) / 0.78));
        if (J.t >= 0.42) {
          J.state = 'chao';
          J.crouch = 0;
        }
      } else {
        J.crouch = damp(J.crouch, 0, 12, dt);
      }

      // soco
      if (this.attack) {
        const A = this.attack;
        A.t += dt;
        if (!A.hit && A.t >= PUNCH_AT.golpe[1]) {
          A.hit = true;
          this.events.push({ type: 'impacto', hand: A.hand });
        }
        if (A.queued && A.t >= PUNCH_AT.recolher[0] + 0.05) {
          this._startPunch(A.queuedDir, true);
        } else if (A.t >= PUNCH_AT.total) {
          this.attack = null;
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
      this.attack = { t: combo ? PUNCH_AT.armar[0] : 0, hand, dir, queued: false, hit: false, combo };
    }

    _stepLength(speed) {
      const walk = 0.2 * speed + 22;
      const run = 0.16 * speed + 38;
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
    /** Pose para o esqueleto (ver `PD.rig.buildRig`). */
    pose() {
      if (this._pose) return this._pose;
      const t = this.time;
      const g = this.gait;
      const run = this.runBlend;
      const J = this.jump;
      const crouch = clamp01(this.crouch);
      const bend = clamp01(crouch + J.crouch); // agachar + preparo/pouso do pulo
      const ph = this.phase;
      const c2 = Math.cos(TAU * ph);
      const s2 = Math.sin(TAU * (ph - 0.05));

      // ---- parâmetros da passada (andar ↔ correr)
      const stance = lerp(0.6, 0.34, run);
      const step = this._stepLength(this.speed);
      const sweep = stance * 2 * step * g;
      const frontFrac = lerp(0.52, 0.42, run);
      const lift = lerp(8.5, 23, run) * (1 - 0.45 * crouch);
      const breath = Math.sin(t * TAU * 0.27); // respiração (~3,7 s)
      const idle = 1 - g;

      // ---- pelve
      const bobWalk = 1.5 * Math.cos(4 * Math.PI * (ph - 0.3));
      const bobRun = -3.2 * Math.cos(4 * Math.PI * (ph - 0.17));
      const bob = lerp(bobWalk, bobRun, run) * g;
      const idleSway = M.noise1(t * 0.23) * 1.1 * idle;
      // parado: o peso fica mais numa perna (troca devagar) — quadril de um lado, ombros do outro
      const weight = clamp(0.55 + 0.6 * M.noise1(t * 0.07 + 1.7), -1, 1) * idle * (1 - crouch);
      const pelvis = {
        dx: -lerp(1.7, 0.8, run) * s2 * g + idleSway + weight * 2.6,
        dy: 3 * run * g + this.leanPitch * 20,
        dz: -lerp(3.4, 5.6, run) * g - 35 * crouch - 27 * J.crouch + bob + breath * 0.25 * idle - 0.4 * idle,
        yaw: lerp(6, 11, run) * DEG * c2 * g,
        pitch: (lerp(2, 10, run) * g + 24 * crouch + 16 * J.crouch) * DEG + this.leanPitch * 0.5,
        roll: lerp(3.2, 2.2, run) * DEG * s2 * g + idleSway * 0.012 - weight * 3.4 * DEG,
      };
      // ---- coluna (peito em relação à pelve)
      const chestYawAbs = lerp(-9, -14, run) * DEG * c2 * g;
      const spine = {
        pitch: (lerp(2.5, 12, run) * g + 20 * crouch + 10 * J.crouch) * DEG + this.leanPitch - breath * 0.6 * DEG * idle,
        yaw: chestYawAbs - pelvis.yaw,
        roll: -pelvis.roll * 0.6 - this.leanRoll + weight * 2.2 * DEG,
      };
      // ---- cabeça: segura o olhar para a frente
      const lookYaw = M.noise1(t * 0.13 + 7) * 7 * DEG * idle;
      const lookPitch = M.noise1(t * 0.11 + 3) * 3 * DEG * idle;
      const head = {
        yaw: -chestYawAbs * 0.85 + lookYaw,
        pitch: -(spine.pitch + pelvis.pitch) * 0.72 + lookPitch + 2 * DEG * run * g + 4 * DEG,
        roll: -spine.roll * 0.6 - pelvis.roll * 0.4 + this.leanRoll * 0.4 - weight * 1.5 * DEG,
      };

      // ---- pés: o animador diz onde o pé "quer" estar; a trava prende no chão o pé que pisou
      const body = M.frameYaw({ x: this.pos.x, y: this.pos.y, z: this.groundZ }, this.yaw);
      const feet = [];
      const hipZ = B.hipStand + pelvis.dz;
      const lead = this.attack ? (this.attack.hand === 1 ? 0 : 1) : 0;
      const dt = this._dt || 1 / 60;
      const inAir = J.state === 'ar' || J.air > 0.02;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const p = (ph + (i === 0 ? 0 : 0.5)) % 1;
        let y = 0;
        let up = 0;
        let pitch = 0;
        let swingS = -1; // fração do balanço (-1 = pé apoiado)
        if (g > 0.001) {
          if (p < stance) {
            const s = p / stance;
            y = lerp(frontFrac * sweep, (frontFrac - 1) * sweep, s);
            pitch = (s < 0.2 ? lerp(15, 0, s / 0.2) : 0) * (1 - run * 0.7) - (s > 0.62 ? Math.pow((s - 0.62) / 0.38, 2) * lerp(28, 38, run) : 0);
          } else {
            const s = (p - stance) / (1 - stance);
            swingS = s;
            y = lerp((frontFrac - 1) * sweep, frontFrac * sweep, easeInOut(s)) - Math.sin(Math.PI * s) * sweep * 0.06 * run;
            up = lift * Math.pow(Math.sin(Math.PI * Math.pow(s, lerp(1, 0.55, run))), 0.85);
            // correndo: o calcanhar sobe para trás logo depois de empurrar o chão (sem arrastar o joelho)
            up += run * 20 * Math.sin(Math.PI * Math.min(1, s / 0.55)) * (s < 0.55 ? 1 : 0);
            pitch = lerp(-lerp(30, 40, run), 12, smoothstep(0, 0.85, s));
          }
          pitch *= g;
        }
        // pé parado: um pouco à frente o esquerdo (postura natural); em guarda, pé da frente
        const fightY = this.stanceLead * (i === lead ? 9 : -7) * (1 - g * 0.8);
        y += (i === 0 ? 2.5 : -2) * idle + fightY;
        // perna livre (sem peso): pé um pouco à frente e para fora, joelho solto
        const free = i === 0 ? Math.max(0, weight) : Math.max(0, -weight);
        y += free * 4;
        const xSide = side * (lerp(B.footSide - 1.4, B.footSide - 3.2, run) * g + B.footSide * idle + 6 * crouch + 2.5 * J.crouch + this.stanceLead * 2 * (1 - g));
        // tornozelo sobe quando o pé gira na ponta ou no calcanhar
        const rollUp = pitch < 0 ? 12 * Math.sin(-pitch * DEG) : 4 * Math.sin(pitch * DEG);
        let pos = M.at(body, xSide, y, B.ankleHeight + up + rollUp);
        let yawAbs = this.yaw + pelvis.yaw * 0.3 + side * B.toeOut * DEG + this.stanceLead * (i === lead ? -0.15 : 0.35) * side;
        const st = this.footLock[i];
        if (inAir) {
          // no ar: impulso com a perna esticada e a ponta do pé (~80 ms), encolhe subindo, estica descendo
          st.planted = false;
          st.step = null;
          const tA = J.state === 'ar' ? J.t : 1;
          const rising = clamp01(this.vz / 300);
          const fall = clamp01(-this.vz / 300);
          const ext = J.state === 'ar' && tA < 0.08;
          const tuck = ext ? 0.995 : lerp(0.84, 0.6, rising) + 0.18 * fall;
          const split = J.running * (i === J.lead ? 1 : -1);
          const ay = split * 20 + (i === 0 ? 5 : -1) + (ext ? 0 : 12 * rising);
          const air = M.at(body, side * (B.footSide - 1), ay, this.pos.z + hipZ - B.legLength * tuck - split * 6);
          pos = M.lerp3(pos, air, ext ? 1 : J.air);
          pitch = ext ? -48 : lerp(pitch, lerp(-30, -12, fall), J.air);
        } else {
          const hip = M.at(body, side * B.hipHalf + pelvis.dx, pelvis.dy, hipZ);
          const other = this.footLock[1 - i];
          if (!st.step) {
            if (g > 0.08) {
              if (swingS < 0) {
                // apoio: o pé fica preso onde pisou
                if (!st.planted) {
                  st.planted = true;
                  st.x = pos.x;
                  st.y = pos.y;
                  st.yaw = yawAbs;
                }
                // longe demais do quadril (curva fechada, começo da caminhada): passo rápido em vez de arrastar
                const dz = hip.z - pos.z;
                const reach = Math.sqrt(Math.max(0, (B.legLength * 0.985) ** 2 - dz * dz));
                if (Math.hypot(st.x - hip.x, st.y - hip.y) > reach && !other.step) {
                  st.step = { t: 0, dur: 0.16, fx: st.x, fy: st.y, fyaw: st.yaw };
                  st.planted = false;
                }
              } else {
                // balanço: sai de onde estava e vai para onde o passo quer pisar
                if (st.planted || st.fx === undefined) {
                  st.planted = false;
                  st.fx = st.lastX ?? pos.x;
                  st.fy = st.lastY ?? pos.y;
                  st.fyaw = st.yaw;
                }
                const k = smoothstep(0, 0.9, swingS);
                pos.x = lerp(st.fx, pos.x, k);
                pos.y = lerp(st.fy, pos.y, k);
                yawAbs = st.fyaw + angleDiff(st.fyaw, yawAbs) * k;
              }
            } else {
              // parado (ou quase): o pé fica no chão; se o lugar certo ficou longe, dá um passinho
              if (!st.planted) {
                if (st.lastX !== null && Math.hypot(pos.x - st.lastX, pos.y - st.lastY) > 2) {
                  st.step = { t: 0, dur: 0.18, fx: st.lastX, fy: st.lastY, fyaw: st.yaw };
                } else {
                  st.planted = true;
                  st.x = pos.x;
                  st.y = pos.y;
                  st.yaw = yawAbs;
                }
              }
              if (!st.step && st.planted) {
                const far = Math.hypot(pos.x - st.x, pos.y - st.y) > 9 || Math.abs(angleDiff(st.yaw, yawAbs)) > 0.42;
                if (far && !other.step && this.stepCooldown <= 0) {
                  st.step = { t: 0, dur: 0.2, fx: st.x, fy: st.y, fyaw: st.yaw };
                  st.planted = false;
                  this.stepCooldown = 0.08;
                }
              }
            }
          }
          if (st.step) {
            // passo: levanta, vai até onde o pé quer estar agora e pisa
            st.step.t += dt / st.step.dur;
            const k = clamp01(st.step.t);
            const e = easeInOut(k);
            pos.x = lerp(st.step.fx, pos.x, e);
            pos.y = lerp(st.step.fy, pos.y, e);
            pos.z += 7 * Math.sin(Math.PI * k);
            pitch += -10 * Math.sin(Math.PI * k);
            yawAbs = st.step.fyaw + angleDiff(st.step.fyaw, yawAbs) * e;
            if (k >= 1) {
              st.step = null;
              st.planted = true;
              st.x = pos.x;
              st.y = pos.y;
              st.yaw = yawAbs;
            }
          } else if (st.planted) {
            pos.x = st.x;
            pos.y = st.y;
            yawAbs = st.yaw;
          }
        }
        if (!inAir && this.pos.z > 0) pos.z += this.pos.z;
        st.lastX = pos.x;
        st.lastY = pos.y;
        // no golpe, o calcanhar de trás sobe (o peso vai para a frente)
        const rearHeel = this.attack && i !== lead && this.attack.t > PUNCH_AT.golpe[0] && this.attack.t < PUNCH_AT.recolher[1] ? -25 * this.stanceLead : 0;
        if (rearHeel) pos.z += 12 * Math.sin(-rearHeel * DEG);
        feet.push({ pos, pitch: (pitch + rearHeel) * DEG, yaw: yawAbs });
      }

      // ---- braços (alvo do punho relativo ao ombro, no espaço do peito: x = para fora)
      const hands = [];
      const shoulderFwd = [0, 0];
      for (let i = 0; i < 2; i++) {
        const w = i === 1 ? c2 : -c2; // -1 atrás, +1 na frente
        const idleArm = { x: 2.8 + breath * 0.3, y: 3.5 + M.noise1(t * 0.3 + i * 5) * 1.2, z: -50.2 + breath * 0.35 };
        // andando: braço balança ±22 cm e o cotovelo dobra quando vai para a frente
        const walkArm = { x: 4.4 + 1.6 * (1 - Math.abs(w)), y: 4 + 22 * w, z: -47.5 + 9 * Math.max(0, w) + 2 * Math.max(0, -w) };
        // correndo: na frente o punho sobe; atrás o cotovelo fica baixo (nada de "asa de galinha")
        const runArm = w >= 0 ? { x: 1.5, y: 4 + 22 * w, z: -31 + 8 * w } : { x: 1.5 + 3 * -w, y: 4 + 14 * w, z: -31 - 6 * -w };
        let a = mixV(walkArm, runArm, run);
        a = mixV(idleArm, a, g);
        // agachado: mãos para a frente, perto dos joelhos
        a = mixV(a, { x: 3, y: 25, z: -41 }, crouch * 0.9);
        const twist = lerp(0, -0.35, run * g);
        let poleLocal = run * g > 0.3 ? [-0.5, 0.6, -0.6] : null;
        let fist = lerp(lerp(0.15, 0.25, g), 0.7, run * g);
        fist = lerp(fist, 0.3, crouch);
        // pulo: braços para trás no preparo, sobem no impulso (acima da cabeça), abrem para equilibrar
        if (J.state === 'preparo') a = mixV(a, { x: 6, y: -18, z: -42 }, easeOut(J.t / 0.13));
        if (J.state === 'ar') {
          const tA = J.t;
          const back = { x: 6, y: -18, z: -42 };
          const upHigh = { x: 7, y: 9, z: 8 };
          const out = { x: 21, y: 5, z: -22 };
          const falling = clamp01(-this.vz / 300);
          a = tA < 0.16 ? mixV(back, upHigh, easeOut(tA / 0.16)) : mixV(upHigh, out, clamp01(smoothstep(0.16, 0.45, tA) * 0.6 + falling * 0.4));
          poleLocal = [-0.7, 0.6, -0.3];
          fist = 0.35;
        }
        if (J.state === 'pouso') a = mixV(a, { x: 8, y: 16, z: -42 }, clamp01(J.crouch / 0.85));
        hands.push({ local: a, twist, poleLocal, fist });
      }

      // ---- soco: guarda, armar, golpe, segurar, recolher, voltar (sobrepõe os braços e gira o tronco)
      let mouthOpen = 0;
      let browRaise = 0;
      if (this.attack) {
        const A = this.attack;
        const tt = A.t;
        const ph2 = (name) => clamp01((tt - PUNCH_AT[name][0]) / (PUNCH_AT[name][1] - PUNCH_AT[name][0]));
        const h = A.hand;
        const sideH = h === 0 ? -1 : 1;
        const idleLocal = hands[h].local;
        const guardFront = { x: -7.5, y: 15, z: -13 };
        const guardRear = { x: -6.5, y: 11, z: -8 };
        const wound = { x: -1, y: 0, z: -11 }; // punho bem recolhido: armar de verdade
        const strike = { x: -10, y: 50, z: -1.5 }; // braço quase todo esticado
        const over = { x: -10.5, y: 52.5, z: -1.2 }; // passa um tiquinho no impacto
        const backMid = { x: 2.5, y: 8, z: -40 }; // volta pela lateral da coxa, não pela barriga
        let strikeHand;
        let twistT = 0; // giro do tronco: + = armar (para o lado da mão que bate), - = golpe
        let push = 0; // ombro avança no golpe
        if (tt < PUNCH_AT.guarda[1]) {
          strikeHand = mixV(idleLocal, guardFront, easeOut(ph2('guarda')));
        } else if (tt < PUNCH_AT.armar[1]) {
          strikeHand = mixV(guardFront, wound, easeInOut(ph2('armar')));
          twistT = easeInOut(ph2('armar'));
        } else if (tt < PUNCH_AT.golpe[1]) {
          const k = ph2('golpe');
          strikeHand = mixV(wound, strike, easeOutBack(k, 1.2));
          twistT = lerp(1, -1, easeOut(k));
          push = easeOut(k);
          mouthOpen = 0.6;
        } else if (tt < PUNCH_AT.impacto[1]) {
          strikeHand = mixV(strike, over, Math.sin(Math.PI * ph2('impacto')));
          twistT = -1;
          push = 1;
          mouthOpen = 0.5;
        } else if (tt < PUNCH_AT.recolher[1]) {
          const k = easeInOut(ph2('recolher'));
          strikeHand = mixV(strike, guardFront, k);
          twistT = lerp(-1, 0, k);
          push = 1 - k;
        } else {
          const k = easeInOut(ph2('voltar'));
          strikeHand = k < 0.5 ? mixV(guardFront, backMid, k * 2) : mixV(backMid, idleLocal, (k - 0.5) * 2);
        }
        const wIn = easeOut(clamp01(tt / PUNCH_AT.guarda[1]));
        const wOut = tt > PUNCH_AT.voltar[0] ? 1 - easeInOut(ph2('voltar')) : 1;
        const wArm = A.combo ? wOut : Math.min(wIn, wOut);
        const other = 1 - h;
        const pronate = wArm * smoothstep(PUNCH_AT.armar[1], PUNCH_AT.golpe[1], tt) * (tt < PUNCH_AT.recolher[1] ? 1 : wOut);
        hands[h] = { local: tt >= PUNCH_AT.voltar[0] ? strikeHand : mixV(idleLocal, strikeHand, wArm), twist: lerp(0, -1.45, pronate), poleLocal: [-0.35, 0.75, -0.6], fist: lerp(hands[h].fist, 1, Math.max(wArm, 0.2)) };
        hands[other] = { local: mixV(hands[other].local, guardRear, wArm), twist: -0.4 * wArm, poleLocal: [-0.6, 0.55, -0.55], fist: lerp(hands[other].fist, 1, wArm) };
        shoulderFwd[h] = 5 * push * wArm;
        // giro: arma +35°, golpe -40°
        const twistDeg = twistT > 0 ? twistT * 35 : twistT * 40;
        const twist = twistDeg * DEG * sideH * wArm;
        spine.yaw += twist * 0.75;
        pelvis.yaw += twist * 0.32;
        head.yaw -= twist * 1.05;
        spine.pitch += 6 * DEG * wArm * (twistT < 0 ? -twistT : 0);
        // armando: peso para trás; golpe: joelho da frente dobra e o corpo avança
        pelvis.dz -= wArm * (tt > PUNCH_AT.armar[0] && tt < PUNCH_AT.recolher[1] ? 3 + 3 * push : 1.4);
        pelvis.dy += push * 6 * wArm - (twistT > 0 ? twistT : 0) * 4 * wArm;
        browRaise = -0.6 * wArm;
      }

      // ---- respiração e ombros
      const shrug = [breath * 0.35 * idle, breath * 0.35 * idle];

      // ---- rosto
      this.look.blink = this.blinkT >= 0 ? Math.sin((this.blinkT / 0.15) * Math.PI) : 0;
      this.look.gazeX = this.attack ? 0 : M.noise1(t * 0.4 + 11) * 0.8 * idle;
      this.look.gazeY = this.attack ? 0 : M.noise1(t * 0.31 + 2) * 0.4 * idle;
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

  function mixV(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  }

  PD.Character = Character;
  PD.SPEED = SPEED;
  PD.PUNCH_AT = PUNCH_AT;
})(window.PD = window.PD || {});
