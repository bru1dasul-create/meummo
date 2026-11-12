// Esqueleto 3D invisível: recebe a pose (ângulos e alvos que o animador calculou) e devolve onde fica cada
// articulação no mundo. Braços e pernas usam cinemática inversa de dois ossos (IK): o animador diz onde o
// pé ou o punho deve estar, e o IK acha o joelho ou o cotovelo — o comprimento dos ossos nunca muda.
(function (PD) {
  'use strict';
  const M = PD.math;
  const { add, sub, scale, dot, cross, norm, len, at, dirIn, clamp } = M;
  const B = PD.BODY;

  /**
   * IK de dois ossos: da raiz `a` até o alvo, com ossos `l1` e `l2`; a articulação do meio dobra para o
   * lado de `pole`. Devolve { mid, end, stretch, err }: `stretch` < 1 quando o alvo está longe demais e `err` = quanto
   * a ponta ficou longe do alvo (cm). O animador garante o alcance antes (veja `softReach` em animator.js); `err` fica
   * guardado no esqueleto (`rig.ik`) para os testes e para a vista de ossos mostrarem qualquer alvo fora do alcance.
   */
  function solveTwoBone(a, target, l1, l2, pole) {
    const d = sub(target, a);
    const raw = len(d);
    const dir = norm(d, { x: 0, y: 0, z: -1 });
    const reach = l1 + l2;
    const dl = clamp(raw, Math.abs(l1 - l2) + 0.5, reach * 0.9995);
    const cosA = clamp((l1 * l1 + dl * dl - l2 * l2) / (2 * l1 * dl), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    let pp = sub(pole, scale(dir, dot(pole, dir)));
    if (len(pp) < 1e-4) pp = Math.abs(dir.z) < 0.9 ? cross(dir, { x: 0, y: 0, z: 1 }) : cross(dir, { x: 1, y: 0, z: 0 });
    pp = norm(pp);
    const mid = add(a, add(scale(dir, l1 * cosA), scale(pp, l1 * sinA)));
    const end = add(a, scale(dir, dl));
    return { mid, end, stretch: raw > 0 ? dl / raw : 1, err: Math.abs(raw - dl), target };
  }

  /** Base de um osso de membro: eixo ao longo do osso, "frente" do lado da dobra e "fora" do corpo. */
  function limbFrame(o, end, frontHint, outHint, length) {
    const a = norm(sub(end, o), { x: 0, y: 0, z: -1 });
    let f = sub(frontHint, scale(a, dot(frontHint, a)));
    if (len(f) < 1e-4) f = sub(outHint, scale(a, dot(outHint, a)));
    f = norm(f);
    let out = sub(outHint, scale(a, dot(outHint, a)));
    out = sub(out, scale(f, dot(out, f)));
    out = norm(out, cross(a, f));
    return { o, a, f, out, len: length };
  }
  /** Ponto num osso de membro: fração t do comprimento + deslocamentos para a frente e para fora. */
  function limbAt(lf, t, f, o) {
    return {
      x: lf.o.x + lf.a.x * lf.len * t + lf.f.x * f + lf.out.x * o,
      y: lf.o.y + lf.a.y * lf.len * t + lf.f.y * f + lf.out.y * o,
      z: lf.o.z + lf.a.z * lf.len * t + lf.f.z * f + lf.out.z * o,
    };
  }

  /** Monta o esqueleto de uma pose. Índice 0 = esquerda, 1 = direita. */
  function buildRig(pose) {
    const body = M.frameYaw(pose.root, pose.yaw);
    // pelve
    const pv = pose.pelvis;
    let pelvis = M.moved(body, at(body, pv.dx, pv.dy, B.hipStand + B.pelvisUp + pv.dz));
    pelvis = M.roll(M.pitch(M.yawBy(pelvis, pv.yaw), pv.pitch), pv.roll);
    // coluna: o peito gira em volta da cintura
    const waist = at(pelvis, 0, 0, B.waistUp);
    let chest = M.roll(M.pitch(M.yawBy(pelvis, pose.spine.yaw), pose.spine.pitch), pose.spine.roll);
    chest = M.moved(chest, add(waist, scale(chest.u, B.chestUp)));
    // cabeça: gira em volta da base do pescoço
    const neckBase = at(chest, 0, -0.5, B.neckBaseUp);
    let head = M.roll(M.pitch(M.yawBy(chest, pose.head.yaw), pose.head.pitch), pose.head.roll);
    head = M.moved(head, add(neckBase, add(scale(head.u, B.neck * 0.93), scale(head.f, B.headForward))));
    const headBase = at(head, ...PD.MODEL.HEAD.neckBase);

    const rig = { body, pelvis, waist, chest, neckBase, head, headBase, hip: [], knee: [], ankle: [], foot: [], toe: [], shoulder: [], elbow: [], wrist: [], hand: [], thigh: [], shin: [], upperArm: [], forearm: [], ik: { leg: [], arm: [] } };

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const out = scale(pelvis.r, side);
      // ---- perna ----
      const hip = at(pelvis, side * B.hipHalf, 0, -B.pelvisUp);
      const ft = pose.feet[i];
      // o pé pode vir com o ângulo travado no chão (ft.yaw); senão segue o corpo
      const footYaw = ft.yaw !== undefined ? ft.yaw : pose.yaw + pv.yaw * 0.3 + side * B.toeOut * M.DEG + (ft.yawOff || 0);
      const footF = { x: Math.cos(footYaw), y: Math.sin(footYaw), z: 0 };
      const kneePole = norm(add(add(footF, scale(out, 0.06)), scale(pelvis.f, 1.2)));
      const leg = solveTwoBone(hip, ft.pos, B.thigh, B.shin, kneePole);
      rig.ik.leg.push({ err: leg.err, target: ft.pos });
      rig.hip.push(hip);
      rig.knee.push(leg.mid);
      rig.ankle.push(leg.end);
      rig.thigh.push(limbFrame(hip, leg.mid, kneePole, out, B.thigh));
      rig.shin.push(limbFrame(leg.mid, leg.end, kneePole, out, B.shin));
      // pé: frente inclinada (calcanhar ou ponta) em volta do tornozelo
      let foot = M.frameFrom(leg.end, footF);
      foot = M.pitch(foot, -(ft.pitch || 0));
      rig.foot.push(foot);
      // dedos: com o calcanhar subindo e a ponta no chão, eles dobram na base e ficam deitados
      const toe = M.pitch(foot, -(ft.toeBend || 0));
      rig.toe.push(M.moved(toe, at(foot, 0, B.ballFwd, -B.ankleHeight)));

      // ---- braço ----
      const shoulder = at(chest, side * B.shoulderHalf, B.shoulderBack + (pose.shoulderFwd ? pose.shoulderFwd[i] : 0), B.shoulderUp + (pose.shrug ? pose.shrug[i] : 0));
      const hd = pose.hands[i];
      const armOut = scale(chest.r, side);
      // alvo do punho: no mundo (`pos`) ou relativo ao ombro, no espaço do peito (`local`: x = para fora)
      const target = hd.pos || add(shoulder, dirIn(chest, side * hd.local.x, hd.local.y, hd.local.z));
      const pl = hd.poleLocal || [-0.95, 0.32, -0.15]; // [frente, fora, cima]: cotovelo para trás, um pouco para fora
      const elbowPole = norm(dirIn(chest, side * pl[1], pl[0], pl[2]));
      const arm = solveTwoBone(shoulder, target, B.upperArm, B.forearm, elbowPole);
      rig.ik.arm.push({ err: arm.err, target });
      rig.shoulder.push(shoulder);
      rig.elbow.push(arm.mid);
      rig.wrist.push(arm.end);
      // o lado do bíceps olha para o antebraço
      const foreDir = sub(arm.end, arm.mid);
      const ua = limbFrame(shoulder, arm.mid, add(foreDir, scale(chest.f, 0.05)), armOut, B.upperArm);
      rig.upperArm.push(ua);
      const fa = limbFrame(arm.mid, arm.end, add(scale(ua.f, 0.6), scale(chest.f, 0.4)), armOut, B.forearm);
      rig.forearm.push(fa);
      // mão (punho): eixo = antebraço; "costas da mão" gira com `twist`; o punho dobra com `flex` (rad, + = para o
      // lado da palma): a mão não fica mais travada reta no antebraço
      const ref = fa.out;
      let dorsal = M.rotate(ref, fa.a, side * (hd.twist || 0));
      const thumb = scale(norm(cross(fa.a, dorsal)), side);
      let along = fa.a;
      const fl = hd.flex || 0;
      if (fl) {
        const c = Math.cos(fl);
        const sn = Math.sin(fl);
        along = norm(add(scale(fa.a, c), scale(dorsal, -sn)));
        dorsal = norm(add(scale(dorsal, c), scale(fa.a, sn)));
      }
      rig.hand.push({ o: arm.end, a: along, d: dorsal, s: thumb, fist: hd.fist ?? 1, flex: fl });
    }
    // A queda gira o corpo e os encaixes. Quando há apoio no chão, resolve as pernas
    // novamente a partir do quadril girado; os comprimentos dos ossos continuam fixos.
    if (pose.fall) {
      const base = M.frameYaw(pose.root, pose.yaw);
      const tilted = pose.fall.side !== undefined ? M.pitch(M.roll(base, pose.fall.side), pose.fall.pitch) : M.roll(M.pitch(base, pose.fall.pitch), pose.fall.roll || 0);
      const vector = (v) => dirIn(tilted, dot(v, base.r), dot(v, base.f), v.z);
      const point = (p) => add(base.o, vector(sub(p, base.o)));
      mapRig(rig, point, vector);
      const low = Math.min(...supportSpheres(rig, !pose.fall.groundFeet).map(s => s.p.z - s.r));
      const lift = Math.max(0, pose.fall.groundZ - low);
      if (lift) mapRig(rig, p => ({ x: p.x, y: p.y, z: p.z + lift }), v => v);
      if (pose.fall.groundFeet) {
        // Os pés continuam no espaço do chão enquanto o tronco perde o equilíbrio.
        for (let pass = 0; pass < 3; pass++) {
          fallingFeet(rig, pose.fall.groundFeet, pose.fall.groundZ);
          const min = Math.min(...supportSpheres(rig).map(s => s.p.z - s.r));
          const correction = Math.max(0, pose.fall.groundZ - min);
          if (correction < 1e-5) break;
          mapRig(rig, p => ({ x: p.x, y: p.y, z: p.z + correction }), v => v);
        }
      }
    }
    return rig;
  }

  function mapRig(rig, point, vector) {
    const frame = (fr) => {
      const out = { ...fr, o: point(fr.o) };
      for (const key of ['r', 'f', 'u', 'a', 'out', 'd', 's']) if (fr[key]) out[key] = vector(fr[key]);
      return out;
    };
    for (const key of ['body', 'pelvis', 'chest', 'head']) rig[key] = frame(rig[key]);
    for (const key of ['waist', 'neckBase', 'headBase']) rig[key] = point(rig[key]);
    for (const key of ['hip', 'knee', 'ankle', 'shoulder', 'elbow', 'wrist']) rig[key] = rig[key].map(point);
    for (const key of ['foot', 'toe', 'thigh', 'shin', 'upperArm', 'forearm', 'hand']) rig[key] = rig[key].map(frame);
    for (const key of ['leg', 'arm']) rig.ik[key] = rig.ik[key].map(it => ({ ...it, target: point(it.target) }));
  }

  /** Volumes de apoio da queda: pele, pés, mãos e a massa do cabelo. */
  function supportSpheres(rig, includeLegs = true) {
    const mod = PD.MODEL, spheres = [], hs = B.headScale;
    const addSphere = (p, r) => spheres.push({ p, r });
    for (const s of mod.HEAD.spheres.concat(mod.HAIR.mass)) addSphere(at(rig.head, ...s.p.map(v => v * hs)), s.r * hs);
    for (const [frame, model] of [[rig.chest, mod.CHEST], [rig.pelvis, mod.PELVIS]]) {
      for (const s of model) addSphere(at(frame, ...s.p), s.r);
    }
    addSphere(rig.neckBase, mod.NECK.r0); addSphere(rig.headBase, mod.NECK.r1);
    for (let i = 0; i < 2; i++) {
      const limbs = [[rig.upperArm[i], mod.UPPER_ARM], [rig.forearm[i], mod.FOREARM]];
      if (includeLegs) limbs.push([rig.thigh[i], mod.THIGH], [rig.shin[i], mod.SHIN]);
      for (const [frame, model] of limbs) {
        for (const s of model) addSphere(limbAt(frame, s.t, s.f, s.o), s.r);
      }
      const side = i ? 1 : -1;
      if (includeLegs) {
        for (const s of mod.FOOT) addSphere(at(rig.foot[i], -side * s.s, s.f, s.u), s.r);
        for (const s of mod.TOES.big.concat(mod.TOES.small)) addSphere(at(rig.toe[i], -side * s.s, s.f, s.u), s.r);
      }
      const h = rig.hand[i], size = mod.HAND.size;
      const handPoint = (a, d, s) => add(h.o, add(scale(h.a, a * size), add(scale(h.d, d * size), scale(h.s, s * size))));
      for (const s of mod.HAND.palm) addSphere(handPoint(s.a, s.d, s.s), s.r * size * 0.95);
      for (const [j, finger] of mod.HAND.fingers.entries()) {
        const curl = clamp(h.fist + mod.HAND.curl[j] * (1 - h.fist) * 0.7, 0, 1);
        addSphere(handPoint(finger.base, 0.3, finger.s), finger.r * size);
        addSphere(M.lerp3(handPoint(finger.base + finger.len * 0.55, -0.3, finger.s * 1.03), handPoint(finger.base + 1.6, -1.9, finger.s), curl), finger.r * size * 0.95);
        addSphere(M.lerp3(handPoint(finger.base + finger.len, -1.15, finger.s * 1.06), handPoint(finger.base - 0.2, -3, finger.s * 0.95), curl), finger.r * size * 0.95 * 0.86);
      }
    }
    return spheres;
  }

  function fallingFeet(rig, goals, groundZ) {
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, goal = goals[i], hip = rig.hip[i];
      const legYaw = Math.atan2(goal.pos.y - hip.y, goal.pos.x - hip.x);
      const footYaw = goal.yaw + M.angleDiff(goal.yaw, legYaw) * (goal.relax || 0);
      const foot = M.pitch(M.frameYaw({ ...goal.pos }, footYaw), -goal.pitch);
      const toe = M.moved(foot, at(foot, 0, B.ballFwd, -B.ankleHeight));
      const min = Math.min(...PD.MODEL.FOOT.map(s => at(foot, -side * s.s, s.f, s.u).z - s.r),
        ...PD.MODEL.TOES.big.concat(PD.MODEL.TOES.small).map(s => at(toe, -side * s.s, s.f, s.u).z - s.r));
      const target = { ...goal.pos, z: goal.pos.z + Math.max(0, groundZ - min) };
      const dz = hip.z - target.z, reach = B.legLength * 0.985;
      const maxH = Math.sqrt(Math.max(1, reach * reach - dz * dz));
      const dx = target.x - hip.x, dy = target.y - hip.y, h = Math.hypot(dx, dy);
      if (h > maxH) { target.x = hip.x + dx * maxH / h; target.y = hip.y + dy * maxH / h; }
      const out = scale(rig.pelvis.r, side);
      const bracePole = norm(add(scale(rig.pelvis.f, 1.2), { x: Math.cos(footYaw), y: Math.sin(footYaw), z: 0 }));
      // Joelho e pé compartilham o plano de flexão. Abrir a dobra inteira
      // para o lado, com o pé ainda à frente, torcia a leitura da perna.
      const restPole = norm({ x: Math.cos(footYaw) + rig.pelvis.r.x * side * 0.08,
        y: Math.sin(footYaw) + rig.pelvis.r.y * side * 0.08, z: goal.prone ? -1.2 : 1.2 });
      const pole = norm(M.lerp3(bracePole, restPole, goal.relax || 0));
      const leg = solveTwoBone(hip, target, B.thigh, B.shin, pole);
      rig.knee[i] = leg.mid; rig.ankle[i] = leg.end;
      rig.thigh[i] = limbFrame(hip, leg.mid, pole, out, B.thigh);
      rig.shin[i] = limbFrame(leg.mid, leg.end, pole, out, B.shin);
      rig.foot[i] = M.moved(foot, leg.end);
      rig.toe[i] = M.moved(toe, at(rig.foot[i], 0, B.ballFwd, -B.ankleHeight));
      rig.ik.leg[i] = { err: leg.err, target };
    }
  }

  PD.rig = { buildRig, solveTwoBone, limbFrame, limbAt, dirIn, supportSpheres };
})(window.PD = window.PD || {});
