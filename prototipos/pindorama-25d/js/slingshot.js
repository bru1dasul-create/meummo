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
  // a Flecha Ancestral na mão (armada com o R): a mesma flecha de luz que voa depois (spiritArt.ts, no jogo)
  const spiritShaft = { base: '#d4ffe9', shade: '#62c493', light: '#ffffff' };
  const spiritFeather = { base: '#8cffbe', shade: '#2f8f5f', light: '#e8fff4' };
  const spiritPoint = { base: '#f4fff9', shade: '#7fd9aa', light: '#ffffff' };
  const MINT = '140, 255, 190', PALE = '228, 255, 240';
  PD.equipment.define({ id: 'arco', nome: 'Arco de Bambu', slot: 'maoE', ocupa: ['maoE', 'maoD'], material: bamboo,
    pecas: [{ osso: 'mao', lado: 'E', esferas: [{ a: 6, d: 0, s: 0, r: 1.6 }] }] });
  const BOW_RULES = Object.freeze({ ...RULES, maxCharge: 1.5, minDraw: 0.3, snap: 0.06, recover: 0.42 });
  // A POSE DE ARQUEIRO (redesenho de 16/11, depois de três consertos que não resolveram: "o braço direito está aparecendo
  // nas costas do personagem; quando ele puxa de frente o braço direito some e vai pra trás", dono). Medido antes de
  // mexer: a mão da corda parava NA FRENTE DO OMBRO ESQUERDO (25 cm à frente do meio do peito), longe demais do ombro
  // direito. Com o braço cruzando o peito, o cotovelo só tinha três lugares para ir, todos ruins: para cima (passava da
  // cabeça), para trás do pescoço (19 cm atrás das costas) ou para a frente. Mexer no "para onde o cotovelo aponta" não
  // resolvia: o defeito era o lugar da MÃO.
  // Agora a conta é a do arqueiro de verdade, feita na base da MIRA (a = para onde a flecha vai, r = a direita dela):
  //  - a linha da flecha passa rente à bochecha direita, por fora da cabeça (`side`, `up`);
  //  - na carga cheia os dedos da corda param nessa linha, logo à frente do ombro direito (`ahead`: atrás da mandíbula).
  //    Com a mão perto do ombro, o cotovelo cabe onde tem de ficar: para trás, na linha da flecha;
  //  - a mão do arco fica na mesma linha, com o braço quase esticado (`reach`);
  //  - o peito fica menos de lado (50°, eram 75°): a puxada dá ~72 cm, a de gente de verdade, e o ombro direito chega
  //    perto da linha. E o peito nunca torce mais que `twist` em relação ao quadril (andando com o alvo à direita o giro
  //    chegava a 140°: o tronco virava ao contrário).
  // (Sem congelar: a ferramenta ferramentas/arco-medida.cjs troca estes números para comparar duas afinações.)
  const BOW_POSE = {
    turn: 50 * M.DEG, // o peito, em relação à flecha
    hips: 22 * M.DEG, // a parte do giro que vem do quadril (parado)
    twist: 70 * M.DEG, // o máximo que o peito torce em relação ao quadril
    side: 15.5, // a linha da flecha: à direita do meio do peito (cm)...
    up: 21, // ... e acima dele (a altura da mandíbula)
    reach: 66, // do ombro do arco à empunhadura (cm): o braço quase esticado (o cabo passa no vão do punho, ~11 cm depois
    // do punho; eram 61 com o cabo a 6 cm, e o punho fica no mesmo lugar)
    ahead: 10, // carga cheia: os dedos da corda ficam isto à frente do ombro direito...
    jaw: 3, // ... e nunca passam da mandíbula (cm à frente do meio do peito)
    arrow: 82, // o comprimento da flecha (a puxada cheia não passa dele menos 5)
    out: 0.2, // o cotovelo da corda: para trás e um tiquinho para fora
    outCam: 1.1, // mirando na linha da câmera (indo ou vindo), mais para fora: o braço aparece ao lado da cabeça
    down: 0.3, // ... e um tiquinho para baixo (no começo da puxada ele não sobe como asa)
    openFrom: 0.55, // (quanto da linha da câmera até o cotovelo começar a abrir: 0 = a flecha de lado, 1 = bem na linha)
    backCam: 0.85, // (na linha da câmera, quase nada para trás: para trás ele ficaria escondido pela cabeça, ou em cima dela)
    downCam: 0.15, // (... e mais um tiquinho para baixo)
    away: 14, // mirando para longe da câmera, a mão do arco desce isto (cm): senão ela aparece acima da cabeça
    // andando, o corpo segue as pernas e só o tronco vira para a mira. O arco está na mão esquerda: para a esquerda o
    // arqueiro alcança até quase atrás (o "tiro parta", por cima do ombro); para a direita, só até onde o peito vira
    aimLeft: 150 * M.DEG,
    aimRight: 65 * M.DEG,
  };
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

  /**
   * Até onde a pose consegue mirar, em relação a para onde o corpo está virado (`rel`, em radianos, + = direita). O
   * estilingue: 65° para cada lado. O arco: BOW_POSE.aimLeft para a esquerda e aimRight para a direita; o que cai no
   * canto morto (atrás, à direita) fica com a ponta mais próxima — a troca de lado acontece no meio dele, e não bem
   * atrás do herói (onde o alvo de quem foge fica o tempo todo).
   */
  function poseAimOf(character, rel) {
    if (!isBow(character)) return M.clamp(rel, -65 * M.DEG, 65 * M.DEG);
    const P = BOW_POSE;
    const flip = (P.aimRight + (M.TAU - P.aimLeft)) / 2;
    return M.clamp(rel > flip ? rel - M.TAU : rel, -P.aimLeft, P.aimRight);
  }

  function start(character, direction, input = {}) {
    const controlled = typeof input.attackHeld === 'boolean';
    character.attack = { kind: 'slingshot', stage: 'charging', age: 0, t: 0, heldFor: 0, power: 0,
      dir: direction, aimYaw: direction, hand: 0, lead: 0, hit: false, controlled,
      targetLock: input.attackTarget || null,
      poseAim: poseAimOf(character, M.angleDiff(character.yaw, direction)),
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
    // (a diferença é reta, sem dar a volta: de um lado para o outro a mira passa pela frente, nunca por trás das costas)
    const wantedAim = poseAimOf(character, M.angleDiff(character.yaw, a.aimYaw));
    a.poseAim += M.clamp(wantedAim - a.poseAim, -720 * M.DEG * dt, 720 * M.DEG * dt);
    if (a.stage === 'charging') {
      if (Number.isFinite(input.attackDir) && !a.releaseRequested) a.dir = input.attackDir;
      a.aimYaw = M.dampAngle(a.aimYaw, a.dir, 12, dt);
      if (a.controlled && (input.attackReleased || input.attackHeld === false)) a.releaseRequested = true;
      // a Chuva de Flechas segura a mira para o alto um instante antes de soltar
      if (a.volley && a.age >= 0.32) a.releaseRequested = true;
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

  /**
   * O vão do punho fechado, onde passa o cabo do arco: o meio do laço que os dedos fazem (as mesmas contas dos dedos
   * em renderer.js), em cm na base da mão — `a` ao longo da mão e `d` para as costas dela (negativo = para a palma).
   * `HM` = a mão do modelo (MODEL.HAND), `fist` = quanto ela fecha.
   */
  function fistHole(HM, fist) {
    const hk = HM.size || 1;
    let sa = 0, sd = 0;
    HM.fingers.forEach((fg, j) => {
      const c = M.clamp01(fist + (HM.curl ? HM.curl[j] : 0) * (1 - fist) * 0.7);
      sa += fg.base + M.lerp(fg.base + fg.len * 0.55, fg.base + 1.6, c) + M.lerp(fg.base + fg.len, fg.base - 0.2, c);
      sd += 0.3 + M.lerp(-0.3, -1.9, c) + M.lerp(-1.15, -3, c);
    });
    const n = HM.fingers.length * 3;
    return { a: (sa / n) * hk, d: (sd / n) * hk };
  }

  /** O eixo do arco puxado: quase em pé, um pouco deitado para longe do rosto (mais na linha da câmera: `cant`). */
  function bowAxis(u, shot, cant) {
    return M.norm(M.add(M.scale(u, 0.97), M.scale(M.norm(M.cross(u, shot)), 0.16 + 0.6 * M.clamp01(cant || 0))));
  }

  /**
   * Os braços do arqueiro (veja BOW_POSE): vira o tronco, põe a mão do arco na linha da flecha e devolve onde ficam os
   * dedos da corda (`pinch`) e para onde o cotovelo dela aponta (`elbowGuide`). `rig` = o esqueleto de prova (peito e
   * ombros de verdade, já com o giro).
   */
  function bowArms(character, parts, o) {
    const P = BOW_POSE, B = PD.BODY;
    const { aim, blend, charging, draw, up, direction, probe } = o;
    // de lado para o alvo: o quadril vira um pouco, o peito mais (a cabeça volta para olhar ao longo da flecha:
    // animator.js lê `look.bowHead`). Andando, o quadril acompanha as pernas e o giro fica todo no peito
    const hips = P.hips * (1 - M.smoothstep(30, 140, character.speed || 0));
    parts.pelvis.yaw += hips * blend;
    parts.spine.yaw += M.clamp(aim + P.turn - hips, -P.twist, P.twist) * blend;
    // a Chuva de Flechas (`volley`, da view) mira para o alto: o tronco deita para trás
    parts.spine.pitch += (2 - 30 * up) * M.DEG * blend;
    character.look.bowHead = { yaw: aim, k: blend };
    // a câmera olha de cima, do lado de +x +y. Na linha dela (a flecha indo ou vindo) o arco em pé, visto de quina,
    // virava um risco (então ele deita de lado) e o braço da corda sumia atrás da cabeça (então o cotovelo abre)
    const camK = up ? 0 : (Math.cos(direction) + Math.sin(direction)) * Math.SQRT1_2;
    const along = M.smoothstep(P.openFrom, 0.95, Math.abs(camK));
    const away = M.smoothstep(0.15, 0.95, -camK);
    character.look.bowCant = M.smoothstep(0.35, 0.95, Math.abs(camK)) * blend;
    const rig = probe(parts.hands);
    const chest = rig.chest, L = rig.shoulder[0], R = rig.shoulder[1];
    const av = { x: Math.cos(direction), y: Math.sin(direction), z: 0 }, rv = M.rightOf(av);
    // a linha da flecha: rente à bochecha direita. Na carga cheia os dedos param nela, logo à frente do ombro direito
    const ref = M.add(chest.o, M.add(M.scale(rv, P.side), M.scale(chest.u, P.up)));
    const anchor = M.add(ref, M.scale(av, Math.min(M.dot(M.sub(R, ref), av) + P.ahead, P.jaw)));
    // para onde a flecha aponta: para o alto na Chuva; para longe da câmera a ponta desce um pouco (a mão do arco fica
    // uns 60 cm à frente da outra: descer `away` cm lá é inclinar a flecha away/60)
    const dir = M.norm({ x: av.x, y: av.y, z: 1.1 * up - (P.away * away) / 60 });
    character.look.bowDir = dir;
    // a empunhadura: na linha, ao alcance do braço do arco (a flecha passa por cima do punho, no eixo do arco: `rest`)
    const axis = bowAxis(chest.u, dir, character.look.bowCant);
    const q = M.sub(M.sub(anchor, M.scale(axis, BOW.rest)), L);
    const qd = M.dot(q, dir);
    const toRest = -qd + Math.sqrt(Math.max(0, qd * qd - M.dot(q, q) + P.reach * P.reach));
    const rest = M.add(anchor, M.scale(dir, toRest));
    const grip = M.sub(rest, M.scale(axis, BOW.rest));
    // a puxada cheia: do arco até a âncora (sem passar do comprimento da flecha: a ponta não entra no arco)
    const full = Math.min(toRest, P.arrow - 5);
    // o punho do arco: o vão do punho fica na empunhadura, com as costas da mão para fora da linha da flecha (antes: o
    // punho 6 cm antes dela, e o cabo passava torto, colado por fora dos dedos). Duas voltas bastam
    const hole = fistHole(PD.MODEL.HAND, 0.88);
    // (o punho dobra de lado até a mão ficar reta no eixo: a mão segue a direção do antebraço sem o que ela tem do eixo)
    const wristOf = (a) => {
      const along = M.norm(M.sub(a, M.scale(axis, M.dot(a, axis))));
      return M.sub(M.sub(grip, M.scale(along, hole.a)), M.scale(M.norm(M.cross(a, axis)), hole.d));
    };
    const poleL = M.add(M.scale(M.UP, -0.8), M.scale(rv, -0.6));
    let wristL = wristOf(M.norm(M.sub(grip, L)));
    for (let i = 0; i < 2; i++) {
      const arm = PD.rig.solveTwoBone(L, wristL, B.upperArm, B.forearm, poleL);
      wristL = wristOf(M.norm(M.sub(arm.end, arm.mid)));
    }
    const dL = M.sub(wristL, L);
    const left = parts.hands[0], right = parts.hands[1];
    left.local = M.lerp3(left.local, { x: -M.dot(dL, chest.r), y: M.dot(dL, chest.f), z: M.dot(dL, chest.u) }, blend);
    const poleLocalL = [M.dot(poleL, chest.f), -M.dot(poleL, chest.r), M.dot(poleL, chest.u)];
    left.poleLocal = left.poleLocal.map((v, j) => M.lerp(v, poleLocalL[j], blend));
    left.fist = M.lerp(left.fist, 0.88, blend);
    left.flex = M.lerp(left.flex || 0, 0, blend);
    // a mão gira até o vão do punho ficar no eixo do arco (era um giro fixo: o arco passava até 64° torto pelo punho)
    const thumbL = { x: -M.dot(axis, chest.r), y: M.dot(axis, chest.f), z: M.dot(axis, chest.u) };
    left.thumb = left.thumb && left.thumbK > 0 ? M.lerp3(M.scale(left.thumb, left.thumbK), thumbL, blend) : thumbL;
    left.thumbK = M.lerp(left.thumbK || 0, 1, blend);
    left.thumbBend = M.lerp(left.thumbBend || 0, 1, blend);
    right.fist = M.lerp(right.fist, charging ? 0.88 : 0.18, blend);
    right.flex = M.lerp(right.flex || 0, 0, blend);
    right.twist = M.lerp(right.twist || 0, -0.5, blend);
    // os dedos da corda: do começo da puxada (perto do arco) até a âncora, pela linha da flecha
    const pinch = M.add(rest, M.scale(dir, -full * draw));
    // o cotovelo da corda: para trás, na linha da flecha, um tiquinho para fora e para baixo. No começo da puxada (a
    // mão ainda longe, à frente) isso dá o cotovelo para fora; conforme a mão chega, ele vai para trás sozinho
    const elbowGuide = M.add(M.scale(av, -(1 - P.backCam * along)), M.add(M.scale(rv, P.out + P.outCam * along), M.scale(M.UP, -(P.down + P.downCam * along))));
    return { rig, pinch, elbowGuide };
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
      character.look.bowCant = 0;
      character.look.bowHead = null;
      character.look.bowDir = null;
      return 0;
    }
    const charging = a.stage === 'charging';
    const blend = smoother(a.age / RULES.minDraw) * (charging ? 1 : 1 - smoother((a.t - 0.11) / (RULES.recover - 0.11)));
    const up = a.volley ? 1 : 0;
    // (a Chuva de Flechas solta em 0,32 s: a pose dela já é a da puxada cheia, mirando para o alto)
    const draw = up && bow ? 1 : M.lerp(0.45, 1, a.power || 0);
    const aim = a.poseAim;
    const baseRight = { ...parts.hands[1].local };
    const basePole = parts.hands[1].poleLocal.slice();
    const root = { x: character.pos.x, y: character.pos.y, z: character.groundZ + character.pos.z };
    const body = M.frameYaw(root, character.yaw), direction = character.yaw + aim;
    /** Esqueleto de prova (sem cabeça nem passo): onde ficam o peito, os ombros e as mãos com esta pose. */
    const probe = (hands) => PD.rig.buildRig({ root, yaw: character.yaw, pelvis: parts.pelvis, spine: parts.spine, hands,
      head: { yaw: 0, pitch: 0, roll: 0 }, shoulderFwd: parts.shoulderFwd,
      feet: [-1, 1].map(side => ({ pos: M.at(body, side * PD.BODY.footSide, 0, PD.BODY.ankleHeight), yaw: character.yaw, pitch: 0 })) });
    let rig, pinch, elbowGuide;
    if (bow) ({ rig, pinch, elbowGuide } = bowArms(character, parts, { aim, blend, charging, draw, up, direction, probe }));
    else {
      // o estilingue: de frente para o alvo, a forquilha à frente do peito e a outra mão puxa o elástico
      parts.spine.yaw += aim * blend;
      character.look.bowHead = null;
      character.look.bowCant = 0;
      parts.spine.pitch += (2 - 30 * up) * M.DEG * blend;
      const targets = [{ x: -24, y: 44, z: -4 + 44 * up }, { x: -8, y: M.lerp(39, 14, draw), z: 8 }];
      for (let i = 0; i < 2; i++) {
        const h = parts.hands[i];
        h.local = M.lerp3(h.local, targets[i], blend);
        h.fist = M.lerp(h.fist, i ? (charging ? 0.88 : 0.18) : 0.88, blend);
        h.flex = M.lerp(h.flex || 0, 0, blend);
        h.twist = M.lerp(h.twist || 0, i ? -0.5 : 0.25, blend);
        const pole = i ? [-0.9, 1.1, -0.65] : [-0.45, 0.5, -0.65];
        h.poleLocal = h.poleLocal.map((v, j) => M.lerp(v, pole[j], blend));
      }
      // O ponto pinçado fica atrás do garfo na linha da mira. Resolve o punho
      // a partir dos dedos, em vez de enfiar a mão no centro do peito.
      const forward = M.norm({ x: Math.cos(direction), y: Math.sin(direction), z: 1.1 * up });
      rig = probe([{ ...parts.hands[0], local: targets[0], twist: 0.25, flex: 0, poleLocal: [-0.45, 0.5, -0.65] }, parts.hands[1]]);
      pinch = M.add(geometry(rig).center, M.scale(forward, -(17 + 17 * draw)));
      // o cotovelo da mão que puxa: para baixo e para fora
      elbowGuide = M.add(rig.chest.r, M.add(M.scale(rig.chest.f, 0.2), M.scale(rig.chest.u, -0.3)));
    }
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
  // (rest = onde a flecha passa, no eixo do arco a partir do meio do cabo: por cima do punho, do lado do polegar)
  const BOW = { limb: 56, grip: 10, rest: 4.2 };
  function bowGeometry(rig, look = {}, HM) {
    const h = rig.hand[0];
    // o cabo passa pelo vão do punho fechado (antes ficava 6 cm à frente do punho, no meio da mão: o couro aparecia
    // colado por cima dos dedos e, correndo, por fora do punho)
    const hole = fistHole(HM || PD.MODEL.HAND, h.fist);
    const grip = M.add(h.o, M.add(M.scale(h.a, hole.a), M.scale(h.d, hole.d)));
    const f = rig.chest.f, u = rig.chest.u;
    const aimK = M.clamp01(look.bowAim || 0);
    // puxando, o arco fica quase em pé, um pouco deitado para longe do rosto (a direção da flecha vem da pose). Solto na
    // mão, ele segue o punho: o eixo é o do vão (a ponta de cima para o lado do polegar), como um cabo segurado de verdade
    const shot = look.bowDir && aimK > 0 ? M.norm(M.lerp3(f, look.bowDir, aimK)) : f;
    const drawAxis = bowAxis(u, shot, look.bowCant);
    const axis = M.norm(M.lerp3(h.s, drawAxis, aimK));
    // a barriga do arco olha para onde a flecha vai (sem o que o eixo já tem dela); solto, para as costas da mão — a
    // corda fica do lado da palma, e não atravessando os dedos
    const towards = M.lerp3(h.d, shot, aimK);
    const front = M.norm(M.sub(towards, M.scale(axis, M.dot(towards, axis))));
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
    const rest = M.add(grip, M.scale(axis, BOW.rest));
    const slack = M.lerp3(tips[0], tips[1], 0.5);
    const pulled = M.add(rig.hand[1].o, M.scale(rig.hand[1].a, 7));
    const nock = M.lerp3(slack, pulled, M.clamp01(look.slingBand || 0) * aimK);
    if (look.restGround !== undefined) for (const p of [...lower, ...upper, rest, nock]) p.z = Math.max(look.restGround + 2.2, p.z);
    return { grip, axis, front, lower, upper, tips, rest, nock };
  }

  function drawBow(renderer, rig, look, host) {
    const g = bowGeometry(rig, look, renderer.model && renderer.model.HAND), items = [];
    const key = (host ? host.key : renderer.keyOf(g.grip)) + 0.08;
    // o que fica atrás do punho (visto da câmera) vai por baixo da mão; o resto, por cima dela
    const toCam = renderer.toCam;
    const behind = (p) => !!toCam && M.dot(M.sub(p, g.grip), toCam) < 0;
    const segment = (a, b, ra, rb, material, name, k = 0.28, under = false) => {
      const circles = [renderer.circle(a, ra), renderer.circle(b, rb)];
      items.push({ name: 'arco:' + name, key, host, under, segs: [{ poly: renderer.hull(circles), circles, mat: material, k }] });
    };
    // a corda primeiro (fininha, atrás dos braços), depois os dois braços de bambu afinando para a ponta, com os nós
    const cordUnder = behind(g.nock);
    segment(g.tips[0], g.nock, 0.42, 0.42, cord, 'corda0', 0.2, cordUnder);
    segment(g.nock, g.tips[1], 0.42, 0.42, cord, 'corda1', 0.2, cordUnder);
    for (const [pts, side] of [[g.lower, 'baixo'], [g.upper, 'cima']]) {
      const under = behind(pts[0]);
      for (let i = 0; i < pts.length - 1; i++) {
        const ra = M.lerp(2.1, 0.9, i / 6), rb = M.lerp(2.1, 0.9, (i + 1) / 6);
        segment(pts[i], pts[i + 1], ra, rb, bamboo, side + i, 0.28, under);
        if (i === 2 || i === 4) segment(pts[i], pts[i], ra + 0.35, ra + 0.35, { ...bamboo, base: bamboo.shade }, 'no-' + side + i, 0.2, under);
      }
      // a ponta com o entalhe da corda (escura, de amarração)
      segment(pts[6], pts[6], 1.15, 1.15, leather, 'ponta-' + side, 0.28, under);
    }
    // a empunhadura de couro com a amarração: dentro do punho, os dedos fecham por cima dela (aparecem só as pontas,
    // acima e abaixo da mão)
    segment(M.add(g.grip, M.scale(g.axis, -BOW.grip / 2 - 1)), M.add(g.grip, M.scale(g.axis, BOW.grip / 2 + 1)), 1.9, 1.9, leather, 'empunhadura', 0.28, true);
    const spirit = look.arrowKind === 'ancestral';
    if (look.slingLoaded && (look.bowAim || 0) > 0.2) {
      // a flecha encaixada: do entalhe da corda para a frente, passando rente à empunhadura
      const dir = M.norm(M.sub(g.rest, g.nock));
      const len = BOW_POSE.arrow;
      const tip = M.add(g.nock, M.scale(dir, len));
      segment(g.nock, tip, 0.65, 0.65, spirit ? spiritShaft : shaft, 'flecha');
      const side = M.norm(M.cross ? M.cross(dir, g.axis) : g.axis);
      for (const [o, mat] of [[1, feather], [-1, featherW]]) {
        const a0 = M.add(g.nock, M.scale(dir, 3));
        const a1 = M.add(g.nock, M.scale(dir, 13));
        segment(M.add(a0, M.scale(side, o * 1.6)), M.add(a1, M.scale(side, o * 2.4)), 0.5, 1.4, spirit ? spiritFeather : mat, 'pena' + o, 0.22);
      }
      const point0 = M.add(tip, M.scale(dir, 5));
      segment(tip, point0, 1.5, 0.25, spirit ? spiritPoint : point, 'ponta-flecha');
      if (spirit) items.push({ name: 'arco:espirito', key, host, draw: () => spiritArrowGlow(renderer, g.nock, point0, look) });
    } else if (spirit) items.push({ name: 'arco:espirito', key, host, draw: () => spiritBowGlow(renderer, g) });
    return items;
  }

  /** Um número "sorteado" fixo para cada `i` (as luzinhas não tremem de um quadro para o outro). */
  const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  /** Estrelinha de 4 pontas (as luzinhas do espírito, as mesmas do spiritArt.ts). */
  function star(ctx, x, y, size, rot) {
    const t = size * 0.26;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(t, -t, size, 0); ctx.quadraticCurveTo(t, t, 0, size);
    ctx.quadraticCurveTo(-t, t, -size, 0); ctx.quadraticCurveTo(-t, -t, 0, -size);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function glowDot(ctx, x, y, r, rgb, alpha) {
    if (r <= 0.5 || alpha <= 0.003) return;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb}, ${alpha})`); gr.addColorStop(0.4, `rgba(${rgb}, ${alpha * 0.45})`); gr.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  /**
   * A Flecha Ancestral na puxada (luz somada por cima da flecha verde-clara): a luz em volta da haste, o clarão na ponta
   * com a estrelinha girando e as luzinhas que sobem dela — cresce com a puxada, como a que sai voando.
   */
  function spiritArrowGlow(renderer, tail3, tip3, look) {
    const ctx = renderer.ctx, z = renderer.zoom, now = clock();
    const tail = renderer.P(tail3), tip = renderer.P(tip3);
    const k = 0.6 + 0.4 * M.clamp01(look.slingDraw || 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const [w, rgb, alpha] of [[7.5, MINT, 0.22], [3.2, MINT, 0.45], [1.3, PALE, 0.8]]) {
      ctx.strokeStyle = `rgba(${rgb}, ${alpha * k})`; ctx.lineWidth = Math.max(1, w * z);
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    }
    const pulse = 1 + 0.15 * Math.sin(now / 120);
    glowDot(ctx, tip.x, tip.y, 11 * z * pulse * k, PALE, 0.75);
    glowDot(ctx, tail.x, tail.y, 6 * z * k, MINT, 0.45);
    // as luzinhas: nascem ao longo da haste, sobem um pouco e apagam
    for (let j = 0; j < 7; j++) {
      const cycle = now / 760 + j / 7, u = cycle % 1, seed = Math.floor(cycle) * 7 + j;
      const f = hash(seed), x = tail.x + (tip.x - tail.x) * f, y = tail.y + (tip.y - tail.y) * f;
      ctx.fillStyle = `rgba(${PALE}, ${((1 - u) * 0.9 * k).toFixed(3)})`;
      star(ctx, x + (hash(seed + 5) - 0.5) * 6 * z, y - u * 16 * z, Math.max(1.4, 2.4 * z * (1 - u * 0.5)), hash(seed + 3) * 1.5);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    star(ctx, tip.x, tip.y, Math.max(3, 5.5 * z * k), now / 260);
    ctx.restore();
  }

  /**
   * Com a Flecha Ancestral armada e o arco solto na mão: o bambu e a corda acesos de verde, o punho com uma poça de luz
   * e luzinhas subindo do arco (no tamanho do jogo tem de dar para ver que a próxima flecha é a especial).
   */
  function spiritBowGlow(renderer, g) {
    const ctx = renderer.ctx, z = renderer.zoom, now = clock();
    const P = (p) => renderer.P(p);
    const grip = P(g.grip), nk = P(g.nock);
    const bow = [...g.lower].reverse().concat(g.upper).map(P);
    const breathe = 0.78 + 0.22 * Math.sin(now / 320);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const path = (pts) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); };
    for (const [w, rgb, alpha] of [[7, MINT, 0.2], [2.6, MINT, 0.42], [1, PALE, 0.55]]) {
      ctx.strokeStyle = `rgba(${rgb}, ${(alpha * breathe).toFixed(3)})`; ctx.lineWidth = Math.max(1, w * z);
      path(bow);
    }
    ctx.strokeStyle = `rgba(${MINT}, ${(0.45 * breathe).toFixed(3)})`; ctx.lineWidth = Math.max(1, 2.2 * z);
    path([bow[0], nk, bow[bow.length - 1]]);
    glowDot(ctx, grip.x, grip.y, 16 * z, MINT, 0.55 * breathe);
    for (let j = 0; j < 9; j++) {
      const cycle = now / 900 + j / 9, u = cycle % 1, seed = Math.floor(cycle) * 9 + j;
      const q = bow[Math.min(bow.length - 1, Math.floor(hash(seed) * bow.length))];
      ctx.fillStyle = `rgba(${PALE}, ${((1 - u) * 0.9).toFixed(3)})`;
      star(ctx, q.x + (hash(seed + 5) - 0.5) * 5 * z, q.y - u * 16 * z, Math.max(1.4, 2.3 * z * (1 - u * 0.5)), hash(seed + 3) * 1.5);
    }
    ctx.restore();
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

  PD.slingshot = { RULES, BOW_RULES, BOW_POSE, poseAimOf, rulesOf, isBow, isEquipped, powerOf, strength, start, update, cancel, geometry, bowGeometry, applyPose, drawItems, drawCharge, drawImpact, actor };
})(window.PD = window.PD || {});
