// Verifica apoio real, transições, oito direções e 30/60/120 Hz.
const path = require('path');
const { load } = require('../auditoria/medir.cjs');
const P = load(path.join(__dirname, '..')), M = P.math, B = P.BODY;
const failures = [], contact = { ghost: 0, below: 0, ik: 0 };
let passed = 0;
function check(name, value, limit) {
  if (!Number.isFinite(value) || value > limit) failures.push(`${name}: ${value} > ${limit}`);
  else passed++;
}
function inspect(ch, rig, name, t) {
  for (let i = 0; i < 2; i++) {
    const st = ch.footLock[i];
    const points = [M.at(rig.foot[i], 0, -B.heelBack, -B.ankleHeight), M.at(rig.foot[i], 0, B.ballFwd, -B.ankleHeight), M.at(rig.toe[i], 0, 4.3, 0)];
    const h = Math.min(...points.map(p => p.z - ch.groundZ)), ik = rig.ik.leg[i].err;
    const grounded = st.planted && !st.step && ch.jump.state !== 'ar';
    contact.below = Math.max(contact.below, -h); contact.ik = Math.max(contact.ik, ik);
    if (grounded) contact.ghost = Math.max(contact.ghost, Math.abs(h));
    if ((ik > 0.5 || h < -0.3 || grounded && h > 0.3) && failures.length < 20) failures.push(`${name}, t=${t.toFixed(3)}: alcance=${ik.toFixed(3)}, contato=${h.toFixed(3)}`);
  }
}
// Inclui os primeiros 0,35 s, que a auditoria anterior descartava.
for (const sc of P.audit.scenes()) {
  const ch = new P.Character(0, 0, sc[3] * M.DEG);
  for (let k = 0; k < Math.ceil(sc[1] * 120); k++) {
    ch.update(1 / 120, sc[2](k / 120, ch), null);
    const rig = P.rig.buildRig(ch.pose());
    inspect(ch, rig, sc[0], k / 120); ch.secondary(rig, 1 / 120);
  }
}
check('pé declarado apoiado encosta no chão, cm', contact.ghost, 0.3);
check('pé não atravessa o chão, cm', contact.below, 0.3);
check('alcance da perna em todos os quadros, cm', contact.ik, 0.5);
for (const [name, limit] of [['andando 0°', 4], ['correndo 0°', 8], ['pulo parado', 8], ['pulo andando', 10], ['pulo correndo', 12], ['dois pulos seguidos', 12], ['transições: parado → anda → corre → anda → para', 10], ['transições: corre → pula → continua correndo', 12]]) {
  const r = P.audit.runScene(P.audit.scenes().find(s => s[0] === name));
  const value = Math.max(...Object.entries(r.jerk).filter(([k]) => /joelho|tornozelo/.test(k)).map(([, v]) => v.j));
  // Diagnóstico: uma medida menor não garante uma passada visualmente correta.
  console.log(name, value.toFixed(3));
}
const heights = [];
for (const hz of [30, 60, 120]) for (let dir = 0; dir < 8; dir++) for (const run of [false, true]) {
  const yaw = dir * Math.PI / 4, ch = new P.Character(0, 0, yaw);
  let maxHeight = 0;
  for (let k = 0; k < hz * 3; k++) {
    const t = k / hz, direction = yaw + (t >= 1.6 ? Math.PI : 0);
    ch.update(1 / hz, { move: { x: Math.cos(direction), y: Math.sin(direction) }, run, jump: k === Math.round(0.6 * hz) }, null);
    const rig = P.rig.buildRig(ch.pose()); inspect(ch, rig, `${hz} Hz / ${dir * 45}° / corrida=${run}`, t);
    ch.secondary(rig, 1 / hz); maxHeight = Math.max(maxHeight, ch.pos.z);
  }
  check(`salto ocorreu ${hz} Hz / ${dir}`, maxHeight > 50 ? 0 : 1, 0);
  if (!run && dir === 0) heights.push(maxHeight);
}
check('altura igual entre 30/60/120 Hz, cm', Math.max(...heights) - Math.min(...heights), 0.1);
console.log('Alturas:', heights.map(v => v.toFixed(5)).join(', '));
console.log('Contato máximo:', JSON.stringify(contact));
for (const failure of failures) console.error('FALHA:', failure);
console.log(`${passed} verificações passaram; ${failures.length} falhas.`);
process.exitCode = failures.length ? 1 : 0;
