// Treino de combate: vida, um rival, acerto do soco e proteção da esquiva.
// A colisão move apenas o ator que pediu o deslocamento, inclusive junto a um corpo no chão.
(function (PD) {
  'use strict';
  const M = PD.math;
  const RULES = Object.freeze({
    health: 100, rivalHealth: 80, punchDamage: 20, rivalDamage: 14,
    hitGrace: 0.32, dodgeStart: 0.03, dodgeEnd: 0.23,
    windup: 0.42, attackInterval: 1.3, engage: 82, reach: 115, bodyRadius: 26,
  });
  const distance = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);

  function nearestOnSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    const t = len2 > 1e-8 ? M.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1) : 0;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  // Pontos mais próximos entre dois segmentos 3D (braço e volume do tronco).
  function contactBetween(p1, q1, p2, q2) {
    const d1 = M.sub(q1, p1), d2 = M.sub(q2, p2), r = M.sub(p1, p2);
    const a = M.dot(d1, d1), e = M.dot(d2, d2), f = M.dot(d2, r);
    let s = 0, t = 0;
    if (a <= 1e-8 && e <= 1e-8) return { a: p1, b: p2, distance: M.dist(p1, p2) };
    if (a <= 1e-8) t = M.clamp(f / e, 0, 1);
    else {
      const c = M.dot(d1, r);
      if (e <= 1e-8) s = M.clamp(-c / a, 0, 1);
      else {
        const b = M.dot(d1, d2), denom = a * e - b * b;
        if (denom > 1e-8) s = M.clamp((b * f - c * e) / denom, 0, 1);
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = M.clamp(-c / a, 0, 1); }
        else if (t > 1) { t = 1; s = M.clamp((b - c) / a, 0, 1); }
      }
    }
    const A = M.add(p1, M.scale(d1, s)), B = M.add(p2, M.scale(d2, t));
    return { a: A, b: B, distance: M.dist(A, B) };
  }

  class TrainingCombat {
    constructor(hero, world, options = {}) {
      this.world = world;
      this.options = options;
      this.origin = { x: hero.pos.x, y: hero.pos.y };
      this.rivalAppearance = { paleta: { ...PD.PALETTE,
        cloth: { base: '#a83e32', shade: '#63261f', light: '#ce6650' },
        clothBand: { base: '#e1bd68', shade: '#98743e', light: '#f2dca1' },
        paintRed: '#e4b448', bandRed: '#e5b54b',
      } };
      this.reset(hero);
    }

    reset(hero) {
      const spawn = this.options.spawn || this.findRivalSpawn(hero);
      const rival = new PD.Character(spawn.x, spawn.y, Math.atan2(hero.pos.y - spawn.y, hero.pos.x - spawn.x));
      if (this.options.enemyWeapon === 'slingshot' && PD.slingshot) rival.equip('maoE', 'estilingue');
      rival.groundZ = this.world.heightAt(spawn.x, spawn.y);
      this.hero = { id: 'hero', character: hero, hp: RULES.health, maxHp: RULES.health, grace: 0 };
      this.enemy = { id: 'enemy', character: rival, hp: RULES.rivalHealth, maxHp: RULES.rivalHealth, grace: 0 };
      this.phase = 'ready'; this.paused = false; this.hasStarted = false; this.time = 0;
      this.windup = null; this.cooldown = 0.55; this.effects = []; this.projectiles = [];
      this.stats = { hits: 0, received: 0, dodges: 0, shots: 0, enemyShots: 0, blocks: 0, guardBreaks: 0 };
      this.impactSerial = 0;
      if (PD.guard) for (const c of [hero, rival]) {
        PD.guard.release(c, true); Object.assign(PD.guard.ensure(c), { energy: PD.guard.RULES.maxEnergy, broken: 0, exhausted: false, regenWait: 0 });
      }
      this.enemyHoldGoal = 0.55; this.enemyShotCycle = 0;
      this.heroWorld = this.actorWorld(this.hero, this.enemy);
      this.enemyWorld = this.actorWorld(this.enemy, this.hero);
    }

    findRivalSpawn(hero) {
      for (const radius of [300, 240, 180]) for (const angle of [-Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4, 0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
        const wanted = { x: hero.pos.x + Math.cos(angle) * radius, y: hero.pos.y + Math.sin(angle) * radius };
        const p = this.world.collide(wanted.x, wanted.y, hero.radius);
        if (Math.hypot(p.x - wanted.x, p.y - wanted.y) < 2 && this.lineClear(hero.pos, p)) return p;
      }
      return this.world.collide(hero.pos.x + 150, hero.pos.y, hero.radius);
    }

    actorWorld(owner, other) {
      const world = this.world;
      let corpse = null, escapingCorpse = false;
      return {
        heightAt: (x, y) => world.heightAt(x, y),
        collide: (x, y, radius) => {
          const c = owner.character;
          // A queda conserva sua própria física. Um ator vivo nunca empurra a raiz do morto.
          if (c.death) return world.collide(x, y, radius);
          const shapes = this.bodyColliders(other);
          if (!shapes.length) return world.collide(x, y, radius);
          const bodyRadius = radius + RULES.bodyRadius - c.radius;
          if (other.character.death) {
            const overlapsRoot = shapes.some(s => {
              const q = nearestOnSegment(c.pos, s.a, s.b);
              return Math.hypot(c.pos.x - q.x, c.pos.y - q.y) < RULES.bodyRadius + s.radius - 0.01;
            });
            if (corpse !== other.character.death) {
              corpse = other.character.death;
              escapingCorpse = overlapsRoot;
            }
            if (overlapsRoot && corpse.t - corpse.fallDelay < 1.35) escapingCorpse = true;
            // Uma queda pode criar várias cápsulas ao redor de quem já estava ali.
            // Libera esse contato inicial até a raiz sair da união inteira. Previsões
            // dos pés não encerram a saída e o cadáver nunca muda de posição.
            if (escapingCorpse) {
              if (overlapsRoot) return world.collide(x, y, radius);
              escapingCorpse = false;
            }
          }
          const dx = x - c.pos.x, dy = y - c.pos.y;
          const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
          let p = { x: c.pos.x, y: c.pos.y };
          // Percorre o trajeto também nas previsões dos pés e da esquiva. Projetar só o destino
          // permitia sair do outro lado do rival e escolher um apoio impossível.
          for (let k = 0; k < steps; k++) {
            const before = p;
            p = world.collide(p.x + dx / steps, p.y + dy / steps, radius);
            for (let pass = 0; pass < 3; pass++) for (const s of shapes) {
              const q = nearestOnSegment(p, s.a, s.b), min = bodyRadius + s.radius;
              let nx = p.x - q.x, ny = p.y - q.y, d = Math.hypot(nx, ny);
              if (d >= min - 1e-8) continue;
              const oldQ = nearestOnSegment(before, s.a, s.b);
              const oldD = Math.hypot(before.x - oldQ.x, before.y - oldQ.y);
              // Se a queda ocupou o lugar onde o jogador já estava, ele pode sair sem um salto de posição.
              if (oldD < min - 0.01) {
                if (d >= oldD - 1e-8) continue;
                nx = before.x - oldQ.x; ny = before.y - oldQ.y; d = Math.hypot(nx, ny);
                if (d < 1e-6) { p = before; continue; }
                const inward = Math.min(0, ((p.x - before.x) * nx + (p.y - before.y) * ny) / d);
                p = world.collide(p.x - nx / d * inward, p.y - ny / d * inward, radius);
              } else {
                if (d < 1e-6) { nx = before.x - q.x; ny = before.y - q.y; d = Math.hypot(nx, ny) || 1; }
                p = world.collide(q.x + nx / d * (min + 1e-5), q.y + ny / d * (min + 1e-5), radius);
              }
            }
            // Num canto apertado, a parede pode desfazer a correção do ator. Para no último
            // ponto válido em vez de escolher entre atravessar o rival ou atravessar o cenário.
            for (const s of shapes) {
              const oldQ = nearestOnSegment(before, s.a, s.b), q = nearestOnSegment(p, s.a, s.b);
              const allowed = Math.min(bodyRadius + s.radius, Math.hypot(before.x - oldQ.x, before.y - oldQ.y));
              if (Math.hypot(p.x - q.x, p.y - q.y) < allowed - 0.001) { p = before; break; }
            }
          }
          return p;
        },
      };
    }

    bodyColliders(fighter) {
      const c = fighter.character;
      if (!c.death) return [{ a: c.pos, b: c.pos, radius: RULES.bodyRadius }];
      if (c.pos.z > 1 || c.death.t - c.death.fallDelay < 0.64) return [];
      const key = [Math.min(c.death.t - c.death.fallDelay, 1.35), c.pos.x, c.pos.y, c.groundZ].join(':');
      if (fighter.corpseKey !== key) {
        const r = PD.rig.buildRig(c.pose());
        fighter.corpseKey = key;
        fighter.corpseColliders = [
          { a: r.pelvis.o, b: r.neckBase, radius: 18 },
          { a: r.neckBase, b: r.head.o, radius: 13 },
          ...[0, 1].flatMap(i => [
            { a: r.hip[i], b: r.knee[i], radius: 9 },
            { a: r.knee[i], b: r.ankle[i], radius: 7 },
          ]),
        ];
      }
      return fighter.corpseColliders;
    }

    lineClear(a, b) {
      const len = Math.hypot(b.x - a.x, b.y - a.y), count = Math.max(1, Math.ceil(len / 10));
      for (let k = 1; k < count; k++) {
        const x = M.lerp(a.x, b.x, k / count), y = M.lerp(a.y, b.y, k / count);
        const p = this.world.collide(x, y, 4);
        if (Math.hypot(p.x - x, p.y - y) > 0.5) return false;
      }
      return true;
    }

    start() {
      if (this.phase !== 'ready' || this.hero.character.death) return false;
      this.phase = 'active'; this.hasStarted = true; this.cooldown = 0.55;
      return true;
    }

    get weapon() { return PD.slingshot && PD.slingshot.isEquipped(this.hero.character) ? 'slingshot' : 'fists'; }

    selectWeapon(weapon) {
      const c = this.hero.character;
      if (!['fists', 'slingshot'].includes(weapon) || c.death || c.dodge || c.hurt || c.attack || c.guard?.active) return false;
      if (weapon === 'slingshot') {
        if (!PD.slingshot) return false;
        c.equip('maoE', 'estilingue');
      } else if (PD.slingshot && PD.slingshot.isEquipped(c)) c.unequip('maoE');
      c._pose = null;
      return true;
    }

    launchStone(attacker, event) {
      event.combatResolved = true;
      if (!PD.slingshot || attacker.hp <= 0 || attacker.character.death || attacker !== this.hero && this.phase !== 'active') return;
      const c = attacker.character, target = attacker === this.hero ? this.enemy : this.hero;
      const rules = PD.slingshot.RULES, force = PD.slingshot.strength(event.power || 0);
      const r = PD.rig.buildRig(c.pose()), muzzle = PD.slingshot.geometry(r, c.look).pouch;
      if (!this.stonePathClear(c.pos, muzzle)) return;
      const other = PD.rig.buildRig(target.character.pose());
      const aimingAtBody = !!target.character.death && c.attack?.targetLock === 'enemy';
      const aimPoint = aimingAtBody ? other.chest.o : target.character.pos;
      const distance = Math.hypot(aimPoint.x - muzzle.x, aimPoint.y - muzzle.y);
      const freeShot = (!!target.character.death || target.hp <= 0) && !aimingAtBody;
      const flight = freeShot ? force.range * 0.85 / force.speed : M.clamp(distance / force.speed, 0.06, force.range / force.speed);
      const aimZ = freeShot ? this.world.heightAt(muzzle.x + Math.cos(event.direction) * force.speed * flight,
        muzzle.y + Math.sin(event.direction) * force.speed * flight) + rules.radius : other.chest.o.z + 4;
      this.projectiles.push({ owner: attacker, pos: { ...muzzle }, origin: { ...muzzle }, fresh: true, power: event.power || 0,
        speed: force.speed, damage: force.damage, range: force.range, age: 0, distance: 0, groundZ: this.world.heightAt(muzzle.x, muzzle.y),
        velocity: { x: Math.cos(event.direction) * force.speed, y: Math.sin(event.direction) * force.speed,
          z: (aimZ - muzzle.z + 0.5 * rules.gravity * flight * flight) / flight } });
      if (attacker === this.hero) this.stats.shots++;
      else { this.stats.enemyShots++; this.cooldown = 1.3; }
    }

    updateProjectiles(dt) {
      if (!this.projectiles.length) return;
      const rules = PD.slingshot.RULES;
      this.projectiles = this.projectiles.filter(p => {
        if (p.fresh) { p.fresh = false; return true; }
        const before = { ...p.pos };
        const next = { x: before.x + p.velocity.x * dt, y: before.y + p.velocity.y * dt,
          z: before.z + p.velocity.z * dt - 0.5 * rules.gravity * dt * dt };
        p.velocity.z -= rules.gravity * dt; p.age += dt; p.distance += (p.speed || rules.speed) * dt;
        p.groundZ = this.world.heightAt(next.x, next.y);
        const obstacle = this.stoneWorldContact(before, next);
        const end = obstacle ? obstacle.point : next;
        const target = p.owner === this.hero ? this.enemy : this.hero;
        if (!target.character.death && target.hp > 0) {
          const r = PD.rig.buildRig(target.character.pose());
          const contact = contactBetween(before, end, r.pelvis.o, r.neckBase);
          if (contact.distance <= 18 + rules.radius) {
            const direction = Math.atan2(p.velocity.y, p.velocity.x);
            // A pedra pode terminar o arco até o chão depois do alcance útil,
            // mas essa cauda visual não aumenta a distância de dano da arma.
            const inRange = p.distance <= (p.range || rules.range) + rules.radius;
            const result = inRange ? this.damage(p.owner, target, p.damage || rules.damage, contact.b, direction, { kind: 'stone', power: p.power || 0 }) : 'miss';
            if (result !== 'dodge' && result !== 'block' && result !== 'guardBreak') this.stoneImpact(contact.a, 'body', p.power);
            return false;
          }
        } else if (target.character.death) {
          const r = PD.rig.buildRig(target.character.pose());
          const parts = [[r.pelvis.o, r.neckBase, 18], [r.neckBase, r.head.o, 13],
            ...[0, 1].flatMap(i => [[r.hip[i], r.knee[i], 9], [r.knee[i], r.ankle[i], 7]])];
          const hit = parts.map(([a, b, radius]) => ({ ...contactBetween(before, end, a, b), radius }))
            .find(c => c.distance <= c.radius + rules.radius);
          if (hit) { this.stoneImpact(hit.a, 'body', p.power); return false; }
        }
        if (obstacle) { this.stoneImpact(end, obstacle.material, p.power); return false; }
        if (p.distance > (p.range || rules.range) * 1.5 || p.age > 3) return false;
        p.pos = next;
        return true;
      });
    }

    stoneImpact(point, material, power = 0) {
      this.effects.push({ kind: 'stoneImpact', material, power, soundVariant: this.impactSerial++ % 5, ...point, t: 0, life: 0.48 });
    }

    stoneWorldContact(a, b) {
      const radius = PD.slingshot.RULES.radius;
      const count = Math.max(1, Math.ceil(M.dist(a, b) / 4));
      let before = a;
      for (let k = 1; k <= count; k++) {
        const p = M.lerp3(a, b, k / count), ground = this.world.heightAt(p.x, p.y);
        if (p.z <= ground + radius) {
          const u = M.clamp((before.z - ground - radius) / Math.max(1e-6, before.z - p.z), 0, 1);
          return { material: 'ground', point: { ...M.lerp3(before, p, u), z: ground + radius } };
        }
        const allowed = this.world.collide(p.x, p.y, radius);
        if (Math.hypot(allowed.x - p.x, allowed.y - p.y) > 0.1) return { material: 'wall', point: { ...before } };
        before = p;
      }
      return null;
    }

    stonePathClear(a, b) {
      const length = Math.hypot(b.x - a.x, b.y - a.y), count = Math.max(1, Math.ceil(length / 4));
      for (let k = 1; k <= count; k++) {
        const x = M.lerp(a.x, b.x, k / count), y = M.lerp(a.y, b.y, k / count);
        const p = this.world.collide(x, y, PD.slingshot.RULES.radius);
        if (Math.hypot(p.x - x, p.y - y) > 0.1) return false;
      }
      return true;
    }

    setPaused(value) {
      this.paused = !!value;
      if (value && PD.slingshot) for (const f of [this.hero, this.enemy]) PD.slingshot.cancel(f.character);
      if (value && PD.guard) for (const f of [this.hero, this.enemy]) PD.guard.release(f.character);
      if (!value) { this.windup = null; this.cooldown = Math.max(this.cooldown, 0.4); }
    }

    get canReset() {
      for (const f of [this.hero, this.enemy]) if (f.character.death && f.character.label !== 'Morto') return false;
      return true;
    }

    get enemyLabel() {
      if (this.enemy.character.death) return 'Derrotado';
      if (this.paused) return 'Pausado';
      if (this.phase !== 'active') return this.options.enemyWeapon === 'slingshot' ? 'Rival com estilingue' : 'Rival de treino';
      if (this.enemy.character.hurt) return 'Recebendo golpe';
      const a = this.enemy.character.attack;
      if (a && a.kind === 'slingshot') return a.stage === 'charging' ? 'Carregando pedra' : 'Disparando pedra';
      if (this.windup) return 'Preparando golpe';
      if (this.enemy.character.attack) return 'Atacando';
      return this.cooldown > 0 && distance(this.hero.character, this.enemy.character) < 100 ? 'Recuperando' : 'Aproximando';
    }

    get telegraph() {
      if (this.phase !== 'active' || this.paused) return null;
      const shot = this.enemy.character.attack;
      if (shot && shot.kind === 'slingshot' && !shot.hit) return { kind: 'stone', dir: shot.dir,
        progress: shot.stage === 'charging' ? M.clamp01(shot.heldFor / this.enemyHoldGoal) : 1, range: 600 };
      const total = RULES.windup + PD.PUNCH_AT.golpe[1];
      if (this.windup) return { dir: this.windup.dir, progress: this.windup.t / total };
      const a = this.enemy.character.attack;
      return a && !a.hit ? { dir: a.dir, progress: M.clamp01((RULES.windup + a.t) / total) } : null;
    }

    enemyInput(dt) {
      const rival = this.enemy.character, hero = this.hero.character;
      this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.phase !== 'active' || this.options.enemyAI === false || rival.death || hero.death) return {};
      if (rival.hurt) { this.windup = null; this.cooldown = Math.max(this.cooldown, 0.4); return {}; }
      if (PD.slingshot && PD.slingshot.isEquipped(rival)) return this.enemyRangedInput();
      if (rival.attack) return {};
      if (this.windup) {
        const w = this.windup;
        rival.faceYaw = w.dir; w.t += dt;
        if (w.t >= RULES.windup) {
          this.windup = null; this.cooldown = RULES.attackInterval;
          return { attack: true, attackDir: w.dir };
        }
        return {};
      }
      const d = distance(rival, hero), dir = Math.atan2(hero.pos.y - rival.pos.y, hero.pos.x - rival.pos.x);
      rival.faceYaw = dir;
      if (d <= RULES.engage && this.lineClear(rival.pos, hero.pos)) {
        if (this.cooldown <= 0) this.windup = { t: 0, dir };
        return {};
      }
      let best = null;
      for (const turn of [0, 0.55, -0.55, 1.1, -1.1, 1.65, -1.65]) {
        const angle = dir + turn, x = rival.pos.x + Math.cos(angle) * 70, y = rival.pos.y + Math.sin(angle) * 70;
        const allowed = this.enemyWorld.collide(x, y, rival.radius);
        const blocked = Math.hypot(allowed.x - x, allowed.y - y);
        const score = Math.hypot(hero.pos.x - allowed.x, hero.pos.y - allowed.y) + Math.abs(turn) * 18 + blocked * 4;
        if (!best || score < best.score) best = { score, angle };
      }
      return { move: { x: Math.cos(best.angle) * 0.78, y: Math.sin(best.angle) * 0.78 } };
    }

    enemyRangedInput() {
      const rival = this.enemy.character, hero = this.hero.character, a = rival.attack;
      if (a) {
        if (a.stage !== 'charging') return {};
        const release = a.heldFor >= this.enemyHoldGoal - 1e-8;
        return { attackHeld: !release, attackReleased: release, attackDir: a.dir };
      }
      const d = distance(rival, hero), dir = Math.atan2(hero.pos.y - rival.pos.y, hero.pos.x - rival.pos.x);
      rival.faceYaw = dir;
      if (d >= 180 && d <= 560 && this.lineClear(rival.pos, hero.pos)) {
        if (this.cooldown <= 0 && Math.abs(M.angleDiff(rival.yaw, dir)) < 55 * M.DEG) {
          this.enemyHoldGoal = [0.55, 0.75, 0.9][this.enemyShotCycle++ % 3];
          return { attack: true, attackHeld: true, attackDir: dir };
        }
        return {};
      }
      const moveDir = dir + (d < 180 ? Math.PI : 0);
      let best = null;
      for (const turn of [0, 0.55, -0.55, 1.1, -1.1]) {
        const angle = moveDir + turn, x = rival.pos.x + Math.cos(angle) * 60, y = rival.pos.y + Math.sin(angle) * 60;
        const allowed = this.enemyWorld.collide(x, y, rival.radius);
        const blocked = Math.hypot(allowed.x - x, allowed.y - y);
        const score = Math.abs(Math.hypot(hero.pos.x - allowed.x, hero.pos.y - allowed.y) - 320) + blocked * 5 + Math.abs(turn) * 12;
        if (!best || score < best.score) best = { score, angle };
      }
      return { move: { x: Math.cos(best.angle) * 0.7, y: Math.sin(best.angle) * 0.7 } };
    }

    protectedByDodge(character) {
      return !!(character.dodge && character.dodge.t >= RULES.dodgeStart - 1e-8 && character.dodge.t <= RULES.dodgeEnd + 1e-8);
    }

    damage(attacker, target, amount, point, hitDirection, impact = {}) {
      if (this.phase !== 'active' || target.hp <= 0 || target.character.death || !(amount > 0) || !Number.isFinite(amount)) return 'miss';
      const c = target.character;
      point = point || { x: c.pos.x, y: c.pos.y, z: c.groundZ + c.pos.z + 130 };
      if (this.protectedByDodge(c)) {
        if (target === this.hero) this.stats.dodges++;
        this.effects.push({ kind: 'dodge', ...point, t: 0, life: 0.6 });
        return 'dodge';
      }
      if (target.grace > 0) return 'miss';
      const direction = Number.isFinite(hitDirection) ? hitDirection :
        Math.atan2(c.pos.y - attacker.character.pos.y, c.pos.x - attacker.character.pos.x);
      const stone = impact.kind === 'stone', power = M.clamp01(impact.power || 0);
      const block = PD.guard?.tryBlock(c, amount, direction);
      if (block) {
        amount = block.damage;
        const r = PD.rig.buildRig(c.pose()), guardedPoint = M.lerp3(r.wrist[0], r.wrist[1], 0.5);
        this.effects.push({ kind: 'block', ...guardedPoint, power, broke: block.broke, t: 0, life: 0.42, soundVariant: this.impactSerial++ % 5 });
        if (target === this.hero) this.stats.blocks++;
      }
      target.hp = Math.max(0, target.hp - amount); target.grace = RULES.hitGrace;
      this.effects.push({ kind: 'damage', amount, power, blocked: !!block, ...point, t: 0, life: 0.65 });
      if (target === this.hero) this.stats.received++; else this.stats.hits++;
      if (target.hp === 0) {
        const impulse = stone ? M.lerp(8, 18, power) * 14 : 0;
        c.die({ direction, impulse: { x: Math.cos(direction) * impulse, y: Math.sin(direction) * impulse } });
        this.phase = target === this.hero ? 'lost' : 'won';
        this.windup = null;
        if (PD.slingshot) PD.slingshot.cancel(c);
      } else if (!block || block.broke) {
        // Fora da proteção, o impacto acontece agora. Não acumula outra trava para depois da esquiva.
        c.reactToHit({ direction, strength: block ? 0.65 : stone ? M.lerp(0.45, 1, power) : 0.9, interruptDodge: true });
        if (stone) c.applyKnockback(direction, block ? 9 : M.lerp(12, 34, power));
      } else {
        c.applyKnockback(direction, M.lerp(3, 9, power), 0.18);
      }
      return block ? (block.broke ? 'guardBreak' : 'block') : 'hit';
    }

    resolvePunch(attacker, target, event) {
      event.combatResolved = true; event.combatResult = 'miss';
      const a = attacker.character, b = target.character;
      if (this.phase !== 'active' || attacker.hp <= 0 || a.death || target.hp <= 0 || b.death || distance(a, b) > RULES.reach) return;
      const angle = Math.atan2(b.pos.y - a.pos.y, b.pos.x - a.pos.x);
      if (Math.abs(M.angleDiff(a.attack ? a.attack.dir : a.yaw, angle)) > 55 * M.DEG || !this.lineClear(a.pos, b.pos)) return;
      const A = PD.rig.buildRig(a.pose()), B = PD.rig.buildRig(b.pose()), hand = A.hand[event.hand];
      const fist = M.add(hand.o, M.scale(hand.a, 8));
      const contact = contactBetween(A.shoulder[event.hand], fist, B.pelvis.o, B.neckBase);
      if (contact.distance > 26) return;
      event.contact = M.lerp3(contact.a, contact.b, 0.5);
      event.combatResult = this.damage(attacker, target, attacker === this.hero ? RULES.punchDamage : RULES.rivalDamage, event.contact);
    }

    update(dt, input = {}) {
      if (!(dt > 0) || !Number.isFinite(dt) || this.paused) return;
      if (this.phase === 'ready' && input.attack && !input.die && distance(this.hero.character, this.enemy.character) < (this.weapon === 'slingshot' ? PD.slingshot.RULES.range : 150)) this.start();
      const count = Math.max(1, Math.ceil(Math.min(dt, 0.1) * 120 - 1e-8)), h = Math.min(dt, 0.1) / count;
      for (let k = 0; k < count; k++) {
        this.time += h;
        let heroInput = k ? { ...input, jump: false, attack: false, attackReleased: false, attackCancel: false, crouchToggle: false, dodge: false, die: false, hit: false } : { ...input };
        const ranged = this.weapon === 'slingshot';
        if (heroInput.guardHeld && !Number.isFinite(heroInput.guardDir) && Math.hypot(heroInput.move?.x || 0, heroInput.move?.y || 0) < 0.02 && !this.enemy.character.death) {
          heroInput.guardDir = Math.atan2(this.enemy.character.pos.y - this.hero.character.pos.y, this.enemy.character.pos.x - this.hero.character.pos.x);
        }
        const charging = ranged && this.hero.character.attack && this.hero.character.attack.stage === 'charging';
        if ((heroInput.attack || charging) && (heroInput.attackDir == null || charging && this.hero.character.attack.targetLock === 'enemy') && distance(this.hero.character, this.enemy.character) < (ranged ? PD.slingshot.RULES.maxRange : RULES.reach)) {
          const a = this.hero.character, b = this.enemy.character;
          const bodyAim = ranged && b.death && (heroInput.attackTarget === 'enemy' || a.attack?.targetLock === 'enemy');
          const point = bodyAim ? PD.rig.buildRig(b.pose()).chest.o : b.pos;
          const dir = Math.atan2(point.y - a.pos.y, point.x - a.pos.x);
          if ((ranged || Math.abs(M.angleDiff(a.yaw, dir)) < 40 * M.DEG) && (!b.death || bodyAim)) heroInput.attackDir = dir;
        }
        for (const f of [this.hero, this.enemy]) {
          f.grace = Math.max(0, f.grace - h);
        }
        const enemyInput = this.enemyInput(h);
        this.hero.character.update(h, heroInput, this.heroWorld);
        this.enemy.character.update(h, enemyInput, this.enemyWorld);
        if (this.hero.character.death) { this.hero.hp = 0; this.phase = 'lost'; this.windup = null; }
        else if (this.enemy.character.death) { this.enemy.hp = 0; this.phase = 'won'; this.windup = null; }
        if (this.phase === 'lost' && PD.slingshot) PD.slingshot.cancel(this.enemy.character);
        for (const [attacker, target] of [[this.hero, this.enemy], [this.enemy, this.hero]]) {
          for (const ev of attacker.character.events) if (!ev.combatResolved) {
            if (ev.type === 'impacto') this.resolvePunch(attacker, target, ev);
            else if (ev.type === 'pedra') this.launchStone(attacker, ev);
          }
        }
        this.updateProjectiles(h);
        // Um projétil pode esgotar a guarda no último subpasso do quadro.
        // Resolve aqui, antes de o mundo consumir os eventos do personagem.
        for (const f of [this.hero, this.enemy]) for (const ev of f.character.events) {
          if (ev.type !== 'guardaQuebrou' || ev.combatResolved) continue;
          ev.combatResolved = true;
          const c = f.character;
          this.effects.push({ kind: 'guardBreak', x: c.pos.x, y: c.pos.y, z: c.groundZ + c.pos.z + 140, power: 1, t: 0, life: 0.75 });
          if (f === this.hero) this.stats.guardBreaks++;
        }
        for (const e of this.effects) e.t += h;
        this.effects = this.effects.filter(e => e.t < e.life);
      }
    }
  }

  PD.TrainingCombat = TrainingCombat;
  PD.COMBAT = RULES;
})(window.PD = window.PD || {});
