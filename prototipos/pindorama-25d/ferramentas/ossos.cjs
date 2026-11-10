// Comprimento dos ossos em 1.200 quadros de animação misturada (tem que variar 0,0000). Uso: node ossos.cjs
const { chromium } = require('playwright');
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname, '..')).href + '/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE + 'prancha.html?linhas=0');
  await page.waitForFunction(() => window.__sheetReady);
  const out = await page.evaluate(() => {
    const M = PD.math;
    const ch = new PD.Character(0, 0, 0);
    const stats = {};
    const track = (k, v) => {
      const s = stats[k] || (stats[k] = { min: Infinity, max: -Infinity });
      s.min = Math.min(s.min, v);
      s.max = Math.max(s.max, v);
    };
    const dt = 1 / 60;
    let frames = 0;
    for (let t = 0; t < 20; t += dt) {
      const phase = Math.floor(t / 2) % 10;
      const ang = t * 1.3;
      const inp = { move: phase === 0 ? null : { x: Math.cos(ang), y: Math.sin(ang) }, run: phase % 3 === 1, crouchToggle: Math.abs(t % 4 - 3) < dt / 2, jump: Math.abs(t % 3 - 1.5) < dt / 2, attack: Math.abs(t % 1.1 - 0.5) < dt / 2, attackDir: ang };
      ch.update(dt, inp, null);
      const rig = PD.rig.buildRig(ch.pose());
      ch.secondary(rig, dt);
      frames++;
      for (let i = 0; i < 2; i++) {
        track('coxa', M.dist(rig.hip[i], rig.knee[i]));
        track('canela', M.dist(rig.knee[i], rig.ankle[i]));
        track('braco', M.dist(rig.shoulder[i], rig.elbow[i]));
        track('antebraco', M.dist(rig.elbow[i], rig.wrist[i]));
        track('ombro ao peito', M.dist(rig.shoulder[i], rig.chest.o));
        track('quadril a pelve', M.dist(rig.hip[i], rig.pelvis.o));
      }
      track('pescoco (base a cabeça)', M.dist(rig.neckBase, rig.head.o));
      track('cintura a peito', M.dist(rig.waist, rig.chest.o));
      track('eixos da cabeça (escala)', M.len(rig.head.r) + M.len(rig.head.f) + M.len(rig.head.u));
    }
    const rows = Object.entries(stats).map(([k, s]) => `${k.padEnd(26)} min ${s.min.toFixed(3).padStart(7)}  max ${s.max.toFixed(3).padStart(7)}  variação ${(s.max - s.min).toFixed(4)}`);
    return `quadros simulados: ${frames}\n` + rows.join('\n');
  });
  console.log(out);
  await browser.close();
})();
