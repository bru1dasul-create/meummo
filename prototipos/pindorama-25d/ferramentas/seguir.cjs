// O personagem da PD.View seguindo a posição do servidor (nova a cada 50 ms, como o jogo), com a virada normal (a do
// protótipo) e a ágil (a do jogo, escolha do dono), usando o seguidor de verdade (js/view.js, _drive), sem navegador.
// Por cenário: atraso (pico e tempo para voltar a menos de 70 cm), escorregão do pé apoiado (ponto que encosta no
// chão, como o escorregao.cjs), pernas cruzadas (ordem dos tornozelos no sentido do corpo) e tranco (2ª diferença a
// 60 Hz, como a auditoria) de joelhos, tornozelos e punhos durante a virada.
// Uso: node ferramentas/seguir.cjs
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.resolve(__dirname, '..');
const ctx = { console: { log() {}, warn() {} }, Math, JSON, Map, Set, setTimeout, clearTimeout, performance: { now: () => 0 } };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/core/math.js', 'js/core/iso.js', 'js/core/shapes.js', 'js/character/body.js', 'js/character/rig.js', 'js/character/animator.js', 'js/view.js'])
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
const PD = ctx.PD, M = PD.math;
const CEN = {
  'corre e vira 180°': (t) => [450, t < 1.5 ? 0 : 180],
  'corre e vira 90°': (t) => [450, t < 1.5 ? 0 : 90],
  'zigue-zague correndo': (t) => [450, t < 1.5 ? 0 : Math.floor((t - 1.5) / 0.6) % 2 ? 60 : -60],
  'anda e vira 180°': (t) => [200, t < 1.5 ? 0 : 180],
  'parado, sai para trás': (t) => (t < 1.5 ? null : [450, 180]),
  'corre reto': (t) => [450, 0],
  'corre e vira 135°': (t) => [450, t < 1.5 ? 0 : 135],
  'zigue-zague andando': (t) => [200, t < 1.5 ? 0 : Math.floor((t - 1.5) / 0.5) % 2 ? 70 : -70],
  'corre e para': (t) => (t < 1.5 ? [450, 0] : null),
  'anda e para': (t) => (t < 1.5 ? [200, 0] : null),
};
const out = [];
for (const [cn, f] of Object.entries(CEN)) {
  for (const agile of [false, true]) {
    const ch = new PD.Character(0, 0, 0);
    const a = { ch, target: { x: 0, y: 0 }, angle: 0, dash: false, rig: null };
    const srv = { x: 0, y: 0 };
    const dt = 1 / 120, total = 4;
    let tick = 0, peak = 0, peakT = null, back = null, prev = [null, null], slideMax = 0;
    let crossN = 0, crossMax = 0, n = 0, signRef = null, frame = 0, over = 0;
    const H = {}, jerk = { joelho: 0, tornozelo: 0, punho: 0 };
    const j2 = (k, p) => { const h = H[k] || (H[k] = []); h.push(p); if (h.length > 3) h.shift(); return h.length < 3 ? 0 : Math.hypot(h[2].x - 2 * h[1].x + h[0].x, h[2].y - 2 * h[1].y + h[0].y, h[2].z - 2 * h[1].z + h[0].z); };
    for (let t = 0; t < total; t += dt, frame++) {
      const s = f(t);
      if (s) { srv.x += Math.cos(s[1] * M.DEG) * s[0] * dt; srv.y += Math.sin(s[1] * M.DEG) * s[0] * dt; a.angle = s[1] * M.DEG; }
      if (t >= tick) { tick += 0.05; a.target = { x: srv.x, y: srv.y }; }
      PD.View.prototype._drive.call({ agile }, a, dt);
      const rig = a.rig;
      const lag = Math.hypot(srv.x - ch.pos.x, srv.y - ch.pos.y);
      if (t >= 1.5 && lag > peak) { peak = lag; peakT = t; back = null; }
      if (peakT !== null && back === null && lag < 70) back = t - 1.5;
      if (cn.endsWith(' e para') && t > 1.5) over = Math.max(over, ch.pos.x - srv.x);
      // pé apoiado
      for (let i = 0; i < 2; i++) {
        const pitch = ch.pose().feet[i].pitch;
        const heel = M.at(rig.foot[i], 0, -PD.BODY.heelBack, -PD.BODY.ankleHeight);
        const ball = M.at(rig.foot[i], 0, PD.BODY.ballFwd, -PD.BODY.ankleHeight);
        const st = ch.footLock[i];
        const planted = st.planted && !st.step && ch.jump.state !== 'ar';
        if (planted && prev[i] && t > 0.3) {
          const vh = Math.hypot(heel.x - prev[i].h.x, heel.y - prev[i].h.y) / dt;
          const vb = Math.hypot(ball.x - prev[i].b.x, ball.y - prev[i].b.y) / dt;
          const flat = 2 * M.DEG;
          slideMax = Math.max(slideMax, pitch > flat ? vh : pitch < -flat ? vb : Math.min(vh, vb));
        }
        prev[i] = planted ? { h: heel, b: ball } : null;
      }
      // pernas cruzadas: lado de cada tornozelo no sentido do corpo
      const rx = -Math.sin(ch.yaw), ry = Math.cos(ch.yaw);
      const lat = [0, 1].map((i) => (rig.ankle[i].x - ch.pos.x) * rx + (rig.ankle[i].y - ch.pos.y) * ry);
      const diff = lat[1] - lat[0];
      if (t > 0.6 && t < 1.4 && signRef === null && Math.abs(diff) > 4) signRef = Math.sign(diff);
      if (t >= 1.5 && signRef !== null) {
        n++;
        if (Math.sign(diff) !== signRef && Math.abs(diff) > 2) { crossN++; crossMax = Math.max(crossMax, Math.abs(diff)); }
      }
      // tranco a 60 Hz durante a virada
      if (frame % 2 === 0) {
        const jk = Math.max(...[0, 1].map((i) => j2('k' + i, rig.knee[i])));
        const ja = Math.max(...[0, 1].map((i) => j2('a' + i, rig.ankle[i])));
        const jw = Math.max(...[0, 1].map((i) => j2('w' + i, rig.wrist[i])));
        if (t >= 1.5 && t < 3.5) { jerk.joelho = Math.max(jerk.joelho, jk); jerk.tornozelo = Math.max(jerk.tornozelo, ja); jerk.punho = Math.max(jerk.punho, jw); }
      }
    }
    // "volta em": só quando o atraso passou do normal de correr (~65 cm); senão ele nem ficou para trás
    const volta = peak <= 75 ? '    —' : back === null ? ' >2,5' : back.toFixed(2).padStart(5);
    out.push(`${cn.padEnd(22)} ${agile ? 'ágil  ' : 'normal'} atraso pico ${peak.toFixed(0).padStart(3)} cm, volta em ${volta} s` +
      (cn.endsWith(' e para') ? ` (passa do ponto ${over.toFixed(0)} cm)` : '') +
      ` | pé apoiado ${slideMax.toFixed(1)} cm/s | pernas cruzadas ${((100 * crossN) / Math.max(1, n)).toFixed(1).padStart(4)}% dos quadros (máx ${crossMax.toFixed(0)} cm)` +
      ` | tranco joelho ${jerk.joelho.toFixed(1)} tornozelo ${jerk.tornozelo.toFixed(1)} punho ${jerk.punho.toFixed(1)}`);
  }
}
console.log(out.join('\n'));
