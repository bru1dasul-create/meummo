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
   * lado de `pole`. Devolve { mid, end, stretch } (stretch < 1 quando o alvo está longe demais).
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
    return { mid, end, stretch: raw > 0 ? dl / raw : 1 };
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

    const rig = { body, pelvis, waist, chest, neckBase, head, headBase, hip: [], knee: [], ankle: [], foot: [], shoulder: [], elbow: [], wrist: [], hand: [], thigh: [], shin: [], upperArm: [], forearm: [] };

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const out = scale(pelvis.r, side);
      // ---- perna ----
      const hip = at(pelvis, side * B.hipHalf, 0, -B.pelvisUp);
      const ft = pose.feet[i];
      // o pé pode vir com o ângulo travado no chão (ft.yaw); senão segue o corpo
      const footYaw = ft.yaw !== undefined ? ft.yaw : pose.yaw + pv.yaw * 0.3 + side * B.toeOut * M.DEG + (ft.yawOff || 0);
      const footF = { x: Math.cos(footYaw), y: Math.sin(footYaw), z: 0 };
      const kneePole = norm(add(add(footF, scale(out, 0.06)), scale(pelvis.f, 0.4)));
      const leg = solveTwoBone(hip, ft.pos, B.thigh, B.shin, kneePole);
      rig.hip.push(hip);
      rig.knee.push(leg.mid);
      rig.ankle.push(leg.end);
      rig.thigh.push(limbFrame(hip, leg.mid, kneePole, out, B.thigh));
      rig.shin.push(limbFrame(leg.mid, leg.end, kneePole, out, B.shin));
      // pé: frente inclinada (calcanhar ou ponta) em volta do tornozelo
      let foot = M.frameFrom(leg.end, footF);
      foot = M.pitch(foot, -(ft.pitch || 0));
      rig.foot.push(foot);

      // ---- braço ----
      const shoulder = at(chest, side * B.shoulderHalf, B.shoulderBack + (pose.shoulderFwd ? pose.shoulderFwd[i] : 0), B.shoulderUp + (pose.shrug ? pose.shrug[i] : 0));
      const hd = pose.hands[i];
      const armOut = scale(chest.r, side);
      // alvo do punho: no mundo (`pos`) ou relativo ao ombro, no espaço do peito (`local`: x = para fora)
      const target = hd.pos || add(shoulder, dirIn(chest, side * hd.local.x, hd.local.y, hd.local.z));
      const pl = hd.poleLocal || [-0.95, 0.32, -0.15]; // [frente, fora, cima]: cotovelo para trás, um pouco para fora
      const elbowPole = norm(dirIn(chest, side * pl[1], pl[0], pl[2]));
      const arm = solveTwoBone(shoulder, target, B.upperArm, B.forearm, elbowPole);
      rig.shoulder.push(shoulder);
      rig.elbow.push(arm.mid);
      rig.wrist.push(arm.end);
      // o lado do bíceps olha para o antebraço
      const foreDir = sub(arm.end, arm.mid);
      const ua = limbFrame(shoulder, arm.mid, add(foreDir, scale(chest.f, 0.05)), armOut, B.upperArm);
      rig.upperArm.push(ua);
      const fa = limbFrame(arm.mid, arm.end, add(scale(ua.f, 0.6), scale(chest.f, 0.4)), armOut, B.forearm);
      rig.forearm.push(fa);
      // mão (punho): eixo = antebraço; "costas da mão" gira com `twist`
      const ref = fa.out;
      const dorsal = M.rotate(ref, fa.a, side * (hd.twist || 0));
      const thumb = scale(norm(cross(fa.a, dorsal)), side);
      rig.hand.push({ o: arm.end, a: fa.a, d: dorsal, s: thumb, fist: hd.fist ?? 1 });
    }
    return rig;
  }

  PD.rig = { buildRig, solveTwoBone, limbFrame, limbAt, dirIn };
})(window.PD = window.PD || {});
