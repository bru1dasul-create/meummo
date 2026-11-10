// Números da passada, andando e correndo reto: passos por minuto, tamanho do passo, dobra do joelho e do cotovelo,
// quanto o punho vai para a frente e para trás, sobe-desce da cabeça, giro do peito e da pelve e quantos
// "passos rápidos de correção" o pé deu (pé que caiu longe demais do quadril e foi puxado: o ideal é 0).
// Uso: node passada.cjs
const { chromium } = require('playwright');
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname, '..')).href + '/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE + 'prancha.html?linhas=0');
  await page.waitForFunction(() => window.__sheetReady);
  const out = await page.evaluate(() => {
    const M = PD.math;
    const yawDeg = (fr) => Math.atan2(fr.f.y, fr.f.x) / M.DEG;
    const angAt = (a, mid, b) => 180 - Math.acos(M.dot(M.sub(a, mid), M.sub(b, mid)) / (M.dist(a, mid) * M.dist(b, mid))) / M.DEG;
    const res = [];
    for (const [name, inp] of [['andando', { move: { x: 1, y: 0 } }], ['correndo', { move: { x: 1, y: 0 }, run: true }]]) {
      const ch = new PD.Character(0, 0, 0);
      const dt = 1 / 120;
      const secs = 3;
      let cycles = 0, prevPh = 0, quick = 0, x0 = null, top = 0;
      const prevStep = [null, null];
      const range = {};
      const track = (k, v) => {
        const r = range[k] || (range[k] = [Infinity, -Infinity]);
        r[0] = Math.min(r[0], v);
        r[1] = Math.max(r[1], v);
      };
      for (let t = 0; t < 1 + secs; t += dt) {
        ch.update(dt, inp, null);
        const rig = PD.rig.buildRig(ch.pose());
        if (t < 1) {
          prevPh = ch.phase;
          continue;
        }
        if (x0 === null) x0 = ch.pos.x;
        cycles += (ch.phase - prevPh + 1) % 1; // fase andada (sem arredondar)
        prevPh = ch.phase;
        for (let i = 0; i < 2; i++) {
          const st = ch.footLock[i];
          if (st.step && !prevStep[i]) quick++;
          prevStep[i] = st.step;
          track('joelho', angAt(rig.hip[i], rig.knee[i], rig.ankle[i]));
          track('cotovelo', angAt(rig.shoulder[i], rig.elbow[i], rig.wrist[i]));
        }
        track('punho', rig.wrist[1].x - ch.pos.x);
        track('cabeça', rig.head.o.z);
        track('peito', yawDeg(rig.chest));
        track('pelve', yawDeg(rig.pelvis));
        top = Math.max(top, rig.head.o.z + 17);
      }
      const dist = ch.pos.x - x0;
      const spm = (cycles * 2 * 60) / secs;
      const w = (k) => (range[k][1] - range[k][0]).toFixed(0);
      res.push(
        `${name}: ${(dist / secs).toFixed(0)} cm/s · ~${spm.toFixed(0)} passos/min · passo ~${((dist / secs) / (spm / 60)).toFixed(0)} cm · ` +
          `${quick} passos rápidos de correção em ${secs} s\n   joelho ${range.joelho[0].toFixed(0)}°–${range.joelho[1].toFixed(0)}° · cotovelo ${range.cotovelo[0].toFixed(0)}°–${range.cotovelo[1].toFixed(0)}° · ` +
          `punho vai e volta ${w('punho')} cm · cabeça sobe e desce ${(range['cabeça'][1] - range['cabeça'][0]).toFixed(1)} cm · giro do peito ${w('peito')}° · da pelve ${w('pelve')}° · altura ~${top.toFixed(0)} cm`,
      );
    }
    return res.join('\n');
  });
  console.log(out);
  await browser.close();
})();
