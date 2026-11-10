// Uso: node escorregao.cjs   (pé apoiado tem que ficar em 0,0 cm/s em todos os casos)
// Mede o escorregão: velocidade horizontal do tornozelo enquanto o pé está apoiado (preso no chão).
const { chromium } = require('playwright');
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname, '..')).href + '/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE + 'prancha.html?linhas=0');
  await page.waitForFunction(() => window.__sheetReady);
  const out = await page.evaluate(() => {
    const M = PD.math;
    const run = (name, secs, input, setup) => {
      const ch = new PD.Character(0, 0, 0);
      if (setup) setup(ch);
      const dt = 1 / 120;
      let prev = [null, null];
      let max = 0, sum = 0, n = 0;
      for (let t = 0; t < secs; t += dt) {
        ch.update(dt, typeof input === 'function' ? input(t, ch) : input, null);
        const rig = PD.rig.buildRig(ch.pose());
        ch.secondary(rig, dt);
        for (let i = 0; i < 2; i++) {
          const a = rig.ankle[i];
          const st = ch.footLock[i];
          const planted = st.planted && !st.step && ch.jump.state !== 'ar';
          if (planted && prev[i] && t > 0.3) {
            const v = Math.hypot(a.x - prev[i].x, a.y - prev[i].y) / dt;
            max = Math.max(max, v);
            sum += v;
            n++;
          }
          prev[i] = planted ? { x: a.x, y: a.y } : null;
        }
      }
      return `${name.padEnd(34)} pé apoiado: máx ${max.toFixed(1).padStart(6)} cm/s · média ${(n ? sum / n : 0).toFixed(1).padStart(5)} cm/s`;
    };
    const dir = (deg, m = 1) => ({ x: Math.cos(deg * M.DEG) * m, y: Math.sin(deg * M.DEG) * m });
    return [
      run('andando reto', 3, { move: dir(0) }),
      run('curva de 90° andando', 3, (t) => ({ move: dir(t < 1.5 ? 0 : 90) })),
      run('andando devagar (analógico 30%)', 3, { move: dir(0, 0.3) }),
      run('correndo', 3, { move: dir(0), run: true }),
      run('parado (troca de peso)', 12, {}),
      run('virando no lugar 180°', 3, (t, ch) => ({ move: t > 1 && t < 1.15 ? dir(180, 0.05) : null })),
      run('entrando na guarda do soco', 2, (t) => ({ attack: Math.abs(t - 0.5) < 0.005, attackDir: 0 })),
    ].join('\n');
  });
  console.log(out);
  await browser.close();
})();
