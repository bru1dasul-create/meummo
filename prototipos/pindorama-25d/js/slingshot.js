// Estilingue preso à mão: madeira, elástico, puxada e pedras com trajetória no mundo.
(function (PD) {
  'use strict';
  const M = PD.math;
  const RULES = Object.freeze({ damage: 20, maxDamage: 40, speed: 1000, maxSpeed: 1700, gravity: 600,
    range: 650, maxRange: 950, radius: 4.5, maxCharge: 1.1, minDraw: 0.22, snap: 0.075, recover: 0.38 });
  const wood = { base: '#906037', shade: '#51351f', light: '#c29354' };
  const leather = { base: '#694331', shade: '#35241c', light: '#9c7250' };
  const rubber = { base: '#dfb35f', shade: '#95713a', light: '#f5d895' };
  const stone = { base: '#a8aba5', shade: '#636c69', light: '#d4d5c6' };

  // A forma dinâmica usa a mesma ordem e iluminação do equipamento comum.
  PD.equipment.define({ id: 'estilingue', nome: 'Estilingue', slot: 'maoE', ocupa: ['maoE', 'maoD'], material: wood,
    pecas: [{ osso: 'mao', lado: 'E', esferas: [{ a: 6, d: 0, s: 0, r: 1.6 }] }] });
  // O Arco de Bambu (pedido do dono, 13/11: "o arco deve permanecer na mão, como um item / arma"): o mesmo puxar e
  // soltar do estilingue, com a carga do arco (1,5 s, a do servidor) e o desenho dele — bambu curvado no fogo, corda de
  // fibra de tucum, a flecha encaixada com as penas. Fica na mão o tempo todo (view.js liga pelo `gear` do jogador).
  const bamboo = { base: '#c9a24e', shade: '#7f5f22', light: '#ecd38a' };
  const cord = { base: '#e6dabd', shade: '#a39373', light: '#fff7e2' };
  const shaft = { base: '#d6b678', shade: '#8f7040', light: '#f0dcae' };
  const feather = { base: '#c0392b', shade: '#7e2219', light: '#ee8a7a' };
  const featherW = { base: '#efe9dc', shade: '#a49d8c', light: '#ffffff' };
  const point = { base: '#5b605e', shade: '#2c302f', light: '#a6aaa6' };
  PD.equipment.define({ id: 'arco', nome: 'Arco de Bambu', slot: 'maoE', ocupa: ['maoE', 'maoD'], material: bamboo,
    pecas: [{ osso: 'mao', lado: 'E', esferas: [{ a: 6, d: 0, s: 0, r: 1.6 }] }] });
  const BOW_RULES = Object.freeze({ ...RULES, maxCharge: 1.5, minDraw: 0.3, snap: 0.06, recover: 0.42 });
  // Puxando o arco, o herói fica de lado para o alvo, como arqueiro de verdade (pedido do dono, 14/11: "o braço fica
  // feio puxando"; de frente para o alvo, o cotovelo da corda subia e saía de lado, como asa): o quadril vira um pouco,
  // o peito mais, até o ombro do arco apontar para onde a flecha vai; a cabeça volta para olhar ao longo dela.
  const BOW_TURN = 75 * M.DEG; // o peito, em relação à flecha
  const BOW_HIPS = 28 * M.DEG; // a parte do giro que vem do quadril
  const BOW_REACH = 49; // da mão do arco ao ombro (cm): o braço quase esticado
  const isBow = c => c.equipped.maoE === 'arco';
  const isEquipped = c => c.equipped.maoE === 'estilingue' || isBow(c);
  /** As regras de quem atira (o arco puxa mais devagar que o estilingue). */
  const rulesOf = c => (c && isBow(c) ? BOW_RULES : RULES);
  const smoother = value => { const x = M.clamp01(value); return x * x * x * (x * (x * 6 - 15) + 10); };
  const powerOf = (a, rules = RULES) => a ? M.clamp01(a.heldFor / rules.maxCharge) : 0;
  const strength = power => ({ damage: Math.round(M.lerp(RULES.damage, RULES.maxDamage, M.clamp01(power))),
    speed: M.lerp(RULES.speed, RULES.maxSpeed, M.clamp01(power)), range: M.lerp(RULES.range, RULES.maxRange, M.clamp01(power)) });
  function blendDirection(a, b, t) {
    const dot = M.clamp(M.dot(a, b), -1, 1);
    if (dot > 0.999) return M.norm(M.lerp3(a, b, t));
    const angle = Math.acos(dot), sine = Math.sin(angle);
    if (Math.abs(sine) < 1e-5) return M.norm(M.lerp3(a, b, t));
    return M.add(M.scale(a, Math.sin((1 - t) * angle) / sine), M.scale(b, Math.sin(t * angle) / sine));
  }

  function start(character, direction, input = {}) {
    const controlled = typeof input.attackHeld === 'boolean';
    character.attack = { kind: 'slingshot', stage: 'charging', age: 0, t: 0, heldFor: 0, power: 0,
      dir: direction, aimYaw: direction, hand: 0, lead: 0, hit: false, controlled,
      targetLock: input.attackTarget || null,
      poseAim: M.clamp(M.angleDiff(character.yaw, direction), -65 * M.DEG, 65 * M.DEG),
      releaseRequested: !controlled || !!input.attackReleased || input.attackHeld === false };
    character.faceYaw = direction;
  }

  function cancel(character) {
    if (!character.attack || character.attack.kind !== 'slingshot') return false;
    const from = JSON.parse(JSON.stringify(character.pose()));
    character.attack = null;
    character._recoverPose = { from, start: character.time, duration: 0.16, upperOnly: true };
    character._pose = null;
    character.look.slingBand = 0; character.look.slingLoaded = false;
    return true;
  }

  function update(character, dt, input) {
    const a = character.attack;
    if (!a || a.kind !== 'slingshot') return;
    if (input.attackCancel) { cancel(character); return; }
    const RULES = rulesOf(character);
    a.age += dt;
    const wantedAim = M.clamp(M.angleDiff(character.yaw, a.aimYaw), -65 * M.DEG, 65 * M.DEG);
    a.poseAim += M.clamp(M.angleDiff(a.poseAim, wantedAim), -720 * M.DEG * dt, 720 * M.DEG * dt);
    if (a.stage === 'charging') {
      if (Number.isFinite(input.attackDir) && !a.releaseRequested) a.dir = input.attackDir;
      a.aimYaw = M.dampAngle(a.aimYaw, a.dir, 12, dt);
      if (a.controlled && (input.attackReleased || input.attackHeld === false)) a.releaseRequested = true;
      if (!a.releaseRequested) a.heldFor = Math.min(RULES.maxCharge, a.heldFor + dt);
      a.power = powerOf(a, RULES); a.t = a.age;
      if (a.releaseRequested && a.age >= RULES.minDraw - 1e-8) {
        a.stage = 'release'; a.t = 0;
        a.aimYaw = character.yaw + a.poseAim;
        a.dir = a.aimYaw;
      }
    } else {
      a.t += dt;
      if (!a.hit && a.t >= RULES.snap - 1e-8) {
        a.hit = true;
        character.events.push({ type: 'pedra', direction: character.yaw + a.poseAim, power: a.power });
      }
      if (a.t >= RULES.recover - 1e-8) character.attack = null;
    }
  }

  function geometry(rig, look = {}) {
    const grip = M.add(rig.hand[0].o, M.scale(rig.hand[0].a, 6));
    const neck = M.add(grip, M.scale(rig.chest.u, 7));
    const center = M.add(grip, M.scale(rig.chest.u, 18));
    const fork = M.norm(M.add(rig.chest.r, M.scale(rig.chest.f, 0.4)));
    const tips = [-1, 1].map(s => M.add(center, M.scale(fork, s * 7)));
    const pulled = M.add(rig.hand[1].o, M.scale(rig.hand[1].a, 7));
    const pouch = M.lerp3(center, pulled, look.slingBand || 0);
    if (look.restGround !== undefined) for (const p of [grip, neck, center, ...tips, pouch]) p.z = Math.max(look.restGround + 2.2, p.z);
    return { grip, neck, center, tips, pouch, pulled };
  }

  function applyPose(character, parts) {
    if (!isEquipped(character)) return 0;
    const bow = isBow(character);
    const RULES = rulesOf(character);
    parts.hands[0].fist = 0.85;
    parts.hands[0].flex *= 0.3;
    const a = character.attack;
    if (!a || a.kind !== 'slingshot') {
      if (bow) character.look.bowAim = 0;
      character.look.bowHead = null;
      character.look.bowDir = null;
      return 0;
    }
    const charging = a.stage === 'charging';
    const blend = smoother(a.age / RULES.minDraw) * (charging ? 1 : 1 - smoother((a.t - 0.11) / (RULES.recover - 0.11)));
    const draw = M.lerp(0.45, 1, a.power || 0);
    const aim = a.poseAim;
    if (bow) {
      // de lado para o alvo: o quadril e o peito viram para a direita (a cabeça volta: animator.js lê `look.bowHead`)
      // andando, o quadril acompanha as pernas (o giro fica todo no peito, para as pernas não torcerem)
      const hips = BOW_HIPS * (1 - M.smoothstep(30, 140, character.speed || 0));
      parts.pelvis.yaw += hips * blend;
      parts.spine.yaw += (aim + BOW_TURN - hips) * blend;
      character.look.bowHead = { yaw: aim, k: blend };
    } else {
      parts.spine.yaw += aim * blend;
      character.look.bowHead = null;
    }
    parts.spine.pitch += 2 * M.DEG * blend;
    // o arco: o braço dele esticado para o alvo, na altura do ombro (de lado, o alvo fica à esquerda do peito; o x da mão
    // esquerda conta para fora), e a outra mão puxa a corda
    const bowHand = { x: Math.sin(BOW_TURN) * BOW_REACH, y: Math.cos(BOW_TURN) * BOW_REACH, z: 6 };
    const targets = bow ? [bowHand, { x: -6, y: M.lerp(30, 4, draw), z: 4 }] : [{ x: -24, y: 44, z: -4 }, { x: -8, y: M.lerp(39, 14, draw), z: 8 }];
    const baseRight = { ...parts.hands[1].local };
    const basePole = parts.hands[1].poleLocal.slice();
    for (let i = 0; i < 2; i++) {
      const h = parts.hands[i];
      h.local = M.lerp3(h.local, targets[i], blend);
      h.fist = M.lerp(h.fist, i ? (charging ? 0.88 : 0.18) : 0.88, blend);
      h.flex = M.lerp(h.flex || 0, 0, blend);
      h.twist = M.lerp(h.twist || 0, i ? -0.5 : 0.25, blend);
      const pole = i ? [-0.9, 1.1, -0.65] : bow ? [-0.2, 0.15, -0.95] : [-0.45, 0.5, -0.65];
      h.poleLocal = h.poleLocal.map((v, j) => M.lerp(v, pole[j], blend));
    }
    // O ponto pinçado fica atrás do garfo na linha da mira. Resolve o punho
    // a partir dos dedos, em vez de enfiar a mão no centro do peito.
    const root = { x: character.pos.x, y: character.pos.y, z: character.groundZ + character.pos.z };
    const body = M.frameYaw(root, character.yaw), direction = character.yaw + aim;
    const forward = { x: Math.cos(direction), y: Math.sin(direction), z: 0 };
    const goalHands = [{ ...parts.hands[0], local: targets[0], twist: 0.25, flex: 0, poleLocal: bow ? [-0.2, 0.15, -0.95] : [-0.45, 0.5, -0.65] }, parts.hands[1]];
    if (bow) character.look.bowDir = forward;
    const pose = { root, yaw: character.yaw, pelvis: parts.pelvis, spine: parts.spine, hands: goalHands,
      head: { yaw: 0, pitch: 0, roll: 0 }, shoulderFwd: parts.shoulderFwd,
      feet: [-1, 1].map(side => ({ pos: M.at(body, side * PD.BODY.footSide, 0, PD.BODY.ankleHeight), yaw: character.yaw, pitch: 0 })) };
    const rig = PD.rig.buildRig(pose);
    const center = bow ? bowGeometry(rig, { bowAim: 1 }).rest : geometry(rig).center;
    // o ponto pinçado: atrás do garfo (estilingue) ou da empunhadura (arco: a corda vem até perto do queixo)
    const pinch = M.add(center, M.scale(forward, bow ? -(24 + 38 * draw) : -(17 + 17 * draw)));
    // o cotovelo da mão que puxa: para baixo e para fora (estilingue) ou para trás, na linha da flecha, um tiquinho acima
    // dela e para fora das costas (arco, de lado para o alvo)
    const elbowGuide = bow
      ? M.add(M.scale(forward, -1), M.add(M.scale(rig.chest.u, 0.12), M.scale(rig.chest.f, -0.25)))
      : M.add(rig.chest.r, M.add(M.scale(rig.chest.f, 0.2), M.scale(rig.chest.u, -0.3)));
    // A mão prolonga o antebraço em 7 cm até os dedos. Resolver essa extensão
    // diretamente evita trocar o lado do cotovelo por iterações do punho.
    const solved = PD.rig.solveTwoBone(rig.shoulder[1], pinch, PD.BODY.upperArm, PD.BODY.forearm + 7, elbowGuide);
    const wrist = M.lerp3(solved.mid, pinch, PD.BODY.forearm / (PD.BODY.forearm + 7));
    const baseWrist = M.add(rig.shoulder[1], M.dirIn(rig.chest, baseRight.x, baseRight.y, baseRight.z));
    const baseElbow = PD.rig.solveTwoBone(rig.shoulder[1], baseWrist, PD.BODY.upperArm, PD.BODY.forearm,
      M.dirIn(rig.chest, basePole[1], basePole[0], basePole[2])).mid;
    // Mistura as direções dos dois ossos, não uma reta entre punhos que
    // passava pelo ombro e invertia a dobra do cotovelo.
    const upper = blendDirection(M.norm(M.sub(baseElbow, rig.shoulder[1])), M.norm(M.sub(solved.mid, rig.shoulder[1])), blend);
    const lower = blendDirection(M.norm(M.sub(baseWrist, baseElbow)), M.norm(M.sub(wrist, solved.mid)), blend);
    const elbow = M.add(rig.shoulder[1], M.scale(upper, PD.BODY.upperArm));
    const currentWrist = M.add(elbow, M.scale(lower, PD.BODY.forearm));
    const delta = M.sub(currentWrist, rig.shoulder[1]);
    parts.hands[1].local = { x: M.dot(delta, rig.chest.r), y: M.dot(delta, rig.chest.f), z: M.dot(delta, rig.chest.u) };
    const pole = M.norm(M.sub(elbow, rig.shoulder[1]));
    parts.hands[1].poleLocal = [M.dot(pole, rig.chest.f), M.dot(pole, rig.chest.r), M.dot(pole, rig.chest.u)];
    character.look.slingDraw = draw * blend;
    character.look.slingBand = blend * (charging ? 1 : 1 - smoother(a.t / RULES.snap));
    character.look.slingLoaded = !a.hit && a.age > 0.06;
    if (bow) character.look.bowAim = blend;
    return blend;
  }

  /**
   * O arco na mão: a empunhadura no punho; o eixo inclinado para a frente em descanso (a ponta de cima à frente, a de
   * baixo atrás e longe do chão) e quase em pé puxando (um pouco deitado para fora, como o arqueiro segura). Os braços
   * curvam para o lado da corda e curvam mais com a puxada; a corda vai das pontas ao ponto pinçado (`nock`).
   */
  const BOW = { limb: 56, grip: 10 };
  function bowGeometry(rig, look = {}) {
    const grip = M.add(rig.hand[0].o, M.scale(rig.hand[0].a, 6));
    const f = rig.chest.f, u = rig.chest.u, r = rig.chest.r;
    const aimK = M.clamp01(look.bowAim || 0);
    const restAxis = M.norm(M.add(M.scale(f, 0.6), M.scale(u, 0.8)));
    // puxando, o arco fica quase em pé, um pouco deitado para longe do rosto (a direção da flecha vem da pose)
    const shot = look.bowDir && aimK > 0 ? M.norm(M.lerp3(f, look.bowDir, aimK)) : f;
    const drawAxis = M.norm(M.add(M.scale(u, 0.97), M.scale(M.norm(M.cross(u, shot)), 0.16)));
    const axis = M.norm(M.lerp3(restAxis, drawAxis, aimK));
    // a barriga do arco olha para onde a flecha vai (sem o que o eixo já tem dela)
    const front = M.norm(M.sub(shot, M.scale(axis, M.dot(shot, axis))));
    const back = M.scale(front, -1);
    const draw = M.clamp01(look.slingDraw || 0) * aimK;
    const bend = 7 + 12 * draw;
    const limb = (s) => {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        // perfil de arco simples: curva para trás e a pontinha volta um pouco para a frente (o bambu queimado)
        const curve = bend * t * t - 2.2 * Math.pow(t, 6);
        pts.push(M.add(M.add(grip, M.scale(axis, s * (BOW.grip / 2 + BOW.limb * t))), M.scale(back, curve)));
      }
      return pts;
    };
    const lower = limb(-1), upper = limb(1);
    const tips = [lower[6], upper[6]];
    const rest = M.add(grip, M.scale(axis, 2.5));
    const slack = M.lerp3(tips[0], tips[1], 0.5);
    const pulled = M.add(rig.hand[1].o, M.scale(rig.hand[1].a, 7));
    const nock = M.lerp3(slack, pulled, M.clamp01(look.slingBand || 0) * aimK);
    if (look.restGround !== undefined) for (const p of [...lower, ...upper, rest, nock]) p.z = Math.max(look.restGround + 2.2, p.z);
    return { grip, axis, front, lower, upper, tips, rest, nock };
  }

  function drawBow(renderer, rig, look, host) {
    const g = bowGeometry(rig, look), items = [];
    const key = (host ? host.key : renderer.keyOf(g.grip)) + 0.08;
    const segment = (a, b, ra, rb, material, name, k = 0.28) => {
      const circles = [renderer.circle(a, ra), renderer.circle(b, rb)];
      items.push({ name: 'arco:' + name, key, host, segs: [{ poly: renderer.hull(circles), circles, mat: material, k }] });
    };
    // a corda primeiro (fininha, atrás dos braços), depois os dois braços de bambu afinando para a ponta, com os nós
    segment(g.tips[0], g.nock, 0.42, 0.42, cord, 'corda0', 0.2);
    segment(g.nock, g.tips[1], 0.42, 0.42, cord, 'corda1', 0.2);
    for (const [pts, side] of [[g.lower, 'baixo'], [g.upper, 'cima']]) {
      for (let i = 0; i < pts.length - 1; i++) {
        const ra = M.lerp(2.1, 0.9, i / 6), rb = M.lerp(2.1, 0.9, (i + 1) / 6);
        segment(pts[i], pts[i + 1], ra, rb, bamboo, side + i);
        if (i === 2 || i === 4) segment(pts[i], pts[i], ra + 0.35, ra + 0.35, { ...bamboo, base: bamboo.shade }, 'no-' + side + i, 0.2);
      }
      // a ponta com o entalhe da corda (escura, de amarração)
      segment(pts[6], pts[6], 1.15, 1.15, leather, 'ponta-' + side);
    }
    // a empunhadura de couro com a amarração
    segment(M.add(g.grip, M.scale(g.axis, -BOW.grip / 2 - 1)), M.add(g.grip, M.scale(g.axis, BOW.grip / 2 + 1)), 2.5, 2.5, leather, 'empunhadura');
    if (look.slingLoaded && (look.bowAim || 0) > 0.2) {
      // a flecha encaixada: do entalhe da corda para a frente, passando rente à empunhadura
      const dir = M.norm(M.sub(g.rest, g.nock));
      const len = 74;
      const tip = M.add(g.nock, M.scale(dir, len));
      segment(g.nock, tip, 0.65, 0.65, shaft, 'flecha');
      const side = M.norm(M.cross ? M.cross(dir, g.axis) : g.axis);
      for (const [o, mat] of [[1, feather], [-1, featherW]]) {
        const a0 = M.add(g.nock, M.scale(dir, 3));
        const a1 = M.add(g.nock, M.scale(dir, 13));
        segment(M.add(a0, M.scale(side, o * 1.6)), M.add(a1, M.scale(side, o * 2.4)), 0.5, 1.4, mat, 'pena' + o, 0.22);
      }
      segment(tip, M.add(tip, M.scale(dir, 5)), 1.5, 0.25, point, 'ponta-flecha');
    }
    return items;
  }

  function drawItems(renderer, rig, look, host, weapon) {
    if (weapon === 'arco') return drawBow(renderer, rig, look, host);
    const p = geometry(rig, look), items = [];
    const segment = (a, b, radius, material, name) => {
      const circles = [renderer.circle(a, radius), renderer.circle(b, radius)];
      items.push({ name: 'estilingue:' + name, key: (host ? host.key : renderer.keyOf(p.grip)) + 0.08, host,
        segs: [{ poly: renderer.hull(circles), circles, mat: material, k: 0.28 }] });
    };
    segment(p.grip, p.neck, 1.8, wood, 'cabo');
    for (let i = 0; i < 2; i++) { segment(p.neck, p.tips[i], 1.65, wood, 'garfo' + i); segment(p.tips[i], p.pouch, 0.65, rubber, 'elastico' + i); }
    segment(p.grip, M.lerp3(p.grip, p.neck, 0.55), 2.1, leather, 'empunhadura');
    segment(p.pouch, M.add(p.pouch, M.scale(rig.chest.r, 2)), 1.7, leather, 'bolsa');
    if (look.slingLoaded) {
      segment(p.pouch, p.pouch, RULES.radius, stone, 'pedra');
      const facet = M.add(p.pouch, M.add(M.scale(rig.chest.r, -1), M.scale(rig.chest.u, 1.5)));
      segment(facet, facet, 1.3, { ...stone, base: stone.light }, 'faceta');
    }
    return items;
  }

  function drawStone(ctx, point, radius, angle) {
    ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(angle);
    const vertices = [[-0.92, -0.3], [-0.46, -0.87], [0.29, -0.92], [0.93, -0.31], [0.82, 0.48], [0.17, 0.87], [-0.63, 0.66]];
    ctx.fillStyle = stone.base; ctx.strokeStyle = '#252824'; ctx.lineWidth = Math.max(0.8, radius * 0.19);
    ctx.beginPath(); vertices.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x * radius, y * radius)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = stone.light; ctx.beginPath(); ctx.moveTo(-radius * 0.7, -radius * 0.22); ctx.lineTo(-radius * 0.36, -radius * 0.66);
    ctx.lineTo(radius * 0.24, -radius * 0.68); ctx.lineTo(radius * 0.05, -radius * 0.13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = stone.shade; ctx.beginPath(); ctx.moveTo(radius * 0.73, 0); ctx.lineTo(radius * 0.62, radius * 0.41);
    ctx.lineTo(radius * 0.14, radius * 0.64); ctx.lineTo(-radius * 0.33, radius * 0.42); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function drawCharge(ctx, character, rig, cam, reducedMotion) {
    const a = character.attack;
    if (!a || a.kind !== 'slingshot' || a.stage !== 'charging' || a.age < 0.08 || character.death) return;
    const q = cam.p(geometry(rig, character.look).pouch), power = a.power || 0, z = cam.zoom;
    const appear = smoother((a.age - 0.08) / 0.15), full = power >= 1 - 1e-8;
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(a.age * (full ? 15 : 7));
    const radius = (9 + power * 7 + pulse * 1.2) * z;
    ctx.save(); ctx.globalAlpha = appear * (0.3 + power * 0.3);
    const glow = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, radius * 1.6);
    glow.addColorStop(0, full ? '#fff3b4' : '#f5c65b'); glow.addColorStop(1, 'rgba(246,185,58,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(q.x, q.y, radius * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = appear * (full ? 0.85 : 0.55); ctx.strokeStyle = full ? '#fff4bb' : '#efc16c'; ctx.lineWidth = (full ? 1.7 : 1.1) * z;
    const start = reducedMotion ? -Math.PI / 2 : a.age * 1.6;
    ctx.beginPath(); ctx.arc(q.x, q.y, radius, start, start + Math.PI * 2 * Math.max(0.08, power)); ctx.stroke();
    if (!reducedMotion) for (let i = 0; i < 6; i++) {
      const phase = (a.age * 0.9 + i / 6) % 1, angle = i * 2.399 + a.age * 0.35;
      const d = (8 + (1 - phase) * (17 + power * 7)) * z;
      ctx.globalAlpha = Math.sin(phase * Math.PI) * appear * (0.35 + power * 0.55);
      ctx.fillStyle = i % 2 ? '#fff0ad' : '#e8ac46'; ctx.beginPath();
      ctx.arc(q.x + Math.cos(angle) * d, q.y + Math.sin(angle) * d * 0.72, (0.8 + power * 0.6) * z, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawImpact(ctx, effect, cam, reducedMotion) {
    const u = M.clamp01(effect.t / effect.life), zoom = cam.zoom;
    const q = cam.p(effect), radius = (5 + u * (17 + effect.power * 18)) * zoom;
    ctx.save(); ctx.globalAlpha = (1 - u) * 0.7;
    const flash = 1 - M.smoothstep(0.03, 0.18, effect.t);
    if (flash > 0) {
      ctx.globalAlpha = flash * 0.9;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 - 0.3, inner = 5 * zoom, outer = (reducedMotion ? 13 : 11 + u * 20) * zoom;
        ctx.moveTo(q.x + Math.cos(a) * inner, q.y + Math.sin(a) * inner);
        ctx.lineTo(q.x + Math.cos(a) * outer, q.y + Math.sin(a) * outer);
      }
      ctx.strokeStyle = '#716047'; ctx.lineWidth = 3.4 * zoom; ctx.stroke();
      ctx.strokeStyle = '#fff0bd'; ctx.lineWidth = 1.7 * zoom; ctx.stroke();
    }
    ctx.globalAlpha = (1 - u) * 0.7;
    ctx.strokeStyle = effect.material === 'body' ? '#e6cda3' : '#d1c7aa'; ctx.lineWidth = Math.max(1, 2 * zoom * (1 - u));
    ctx.beginPath(); ctx.ellipse(q.x, q.y, radius, radius * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < (reducedMotion ? 4 : 8); i++) {
      const angle = i * 2.399, spread = (reducedMotion ? 0.4 : u) * (14 + i * 2) * zoom;
      const lift = reducedMotion ? 0 : Math.sin(u * Math.PI) * (7 + i % 3 * 3) * zoom;
      ctx.globalAlpha = (1 - u) * 0.75; ctx.fillStyle = i % 2 ? '#b5ac96' : '#e2d7b6';
      ctx.beginPath(); ctx.arc(q.x + Math.cos(angle) * spread, q.y + Math.sin(angle) * spread * 0.45 - lift, (2.2 - u) * zoom, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function actor(projectile, cam) {
    const p = projectile.pos, q = cam.p(p), g = cam.p({ ...p, z: projectile.groundZ });
    const radius = RULES.radius * cam.zoom;
    return { entity: projectile, fp: { x0: p.x - RULES.radius, y0: p.y - RULES.radius, x1: p.x + RULES.radius, y1: p.y + RULES.radius },
      bounds: { x0: q.x - radius, y0: q.y - radius, x1: q.x + radius, y1: q.y + radius },
      drawShadow(ctx) { ctx.save(); ctx.fillStyle = 'rgba(25,20,17,0.17)'; ctx.beginPath(); ctx.ellipse(g.x, g.y, radius * 1.1, radius * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); },
      draw(ctx) { ctx.save();
        if (projectile.origin) {
          const time = Math.min(projectile.age, 0.03), v = projectile.velocity;
          const from = cam.p({ x: p.x - v.x * time, y: p.y - v.y * time, z: p.z - v.z * time });
          ctx.strokeStyle = 'rgba(226,225,205,0.58)'; ctx.lineWidth = Math.max(1, 1.7 * cam.zoom); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
        drawStone(ctx, q, radius, -0.4 + projectile.age * 9); ctx.restore(); },
    };
  }

  PD.slingshot = { RULES, BOW_RULES, rulesOf, isBow, isEquipped, powerOf, strength, start, update, cancel, geometry, bowGeometry, applyPose, drawItems, drawCharge, drawImpact, actor };
})(window.PD = window.PD || {});
