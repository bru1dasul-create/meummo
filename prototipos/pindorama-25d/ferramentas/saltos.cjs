// Procura "saltos" (coisa que pula de um quadro para o outro, em vez de se mover suave) no soco, no combo e andando.
// Mede, a 60 quadros por segundo: o maior "tranco" (mudança brusca de velocidade, em cm por quadro²) do punho, do
// cotovelo e da cabeça, o maior giro do peito e da cabeça num quadro e quanto a cabeça fica virada em relação ao peito.
// Movimento suave tem tranco pequeno; um salto aparece como tranco grande (perto do tamanho do próprio pulo).
// Uso: node saltos.cjs
const { chromium } = require('playwright');
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname, '..')).href + '/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE + 'prancha.html?linhas=0');
  await page.waitForFunction(() => window.__sheetReady);
  const out = await page.evaluate(() => {
    const M = PD.math;
    const yawOf = (fr) => Math.atan2(fr.f.y, fr.f.x);
    const run = (name, secs, input) => {
      const ch = new PD.Character(0, 0, 0);
      const dt = 1 / 60;
      const hist = {};
      const worst = {};
      let headVsChest = 0;
      let maxChestTurn = 0;
      let maxHeadTurn = 0;
      let prevYaw = null;
      const track = (k, p, t) => {
        const h = hist[k] || (hist[k] = []);
        h.push(p);
        if (h.length > 3) h.shift();
        if (h.length === 3) {
          const j = Math.hypot(h[2].x - 2 * h[1].x + h[0].x, h[2].y - 2 * h[1].y + h[0].y, h[2].z - 2 * h[1].z + h[0].z);
          if (!worst[k] || j > worst[k].j) worst[k] = { j, t };
        }
      };
      for (let t = 0; t < secs; t += dt) {
        ch.update(dt, input(t), null);
        const rig = PD.rig.buildRig(ch.pose());
        ch.secondary(rig, dt);
        if (t < 0.3) continue;
        for (let i = 0; i < 2; i++) {
          track('punho ' + (i ? 'D' : 'E'), rig.wrist[i], t);
          track('cotovelo ' + (i ? 'D' : 'E'), rig.elbow[i], t);
        }
        track('cabeça', rig.head.o, t);
        const cy = yawOf(rig.chest);
        const hy = yawOf(rig.head);
        if (prevYaw) {
          maxChestTurn = Math.max(maxChestTurn, Math.abs(M.angleDiff(prevYaw.c, cy)) / M.DEG);
          maxHeadTurn = Math.max(maxHeadTurn, Math.abs(M.angleDiff(prevYaw.h, hy)) / M.DEG);
        }
        prevYaw = { c: cy, h: hy };
        headVsChest = Math.max(headVsChest, Math.abs(M.angleDiff(cy, hy)) / M.DEG);
      }
      const parts = Object.entries(worst).map(([k, w]) => `${k} ${w.j.toFixed(1)} (t=${w.t.toFixed(2)})`);
      return `${name}\n   tranco máx (cm/quadro²): ${parts.join(' · ')}\n   giro máx num quadro: peito ${maxChestTurn.toFixed(1)}° · cabeça ${maxHeadTurn.toFixed(1)}° · cabeça virada em relação ao peito: até ${headVsChest.toFixed(1)}°`;
    };
    const click = (t, at) => Math.abs(t - at) < 0.5 / 60;
    const fwd = { x: 1, y: 0 };
    return [
      run('soco parado', 1.8, (t) => ({ attack: click(t, 0.5), attackDir: 0 })),
      run('combo parado (2 cliques)', 2.2, (t) => ({ attack: click(t, 0.5) || click(t, 0.68), attackDir: 0 })),
      run('combo de 4 socos', 3, (t) => ({ attack: [0.5, 0.68, 0.95, 1.22].some((a) => click(t, a)), attackDir: 0 })),
      run('soco andando', 2, (t) => ({ move: fwd, attack: click(t, 0.8), attackDir: 0 })),
      run('soco virando 90° (mouse do lado)', 1.8, (t) => ({ attack: click(t, 0.5), attackDir: Math.PI / 2 })),
      run('andando reto', 3, () => ({ move: fwd })),
      run('correndo', 3, () => ({ move: fwd, run: true })),
      run('andando e parando', 3, (t) => ({ move: t < 1.5 ? fwd : null })),
    ].join('\n');
  });
  console.log(out);
  await browser.close();
})();
