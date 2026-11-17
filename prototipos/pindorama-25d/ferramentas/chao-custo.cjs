// Quanto custa PINTAR o chão: em vários pontos do mapa, joga fora os pedaços prontos e mede cada pedaço refeito
// (512 px de tela), nos zooms longe (0,7), médio (1,0) e o da conversa (1,25).
// Uso: node chao-custo.cjs <url> [saida.json]
const { chromium } = require('playwright');
const { entrar, levar, cenaLimpa } = require('./zoom-comum.cjs');
(async () => {
  const [, , base = 'http://localhost:3000', outJson = ''] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: +(process.env.DPR || 1) });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 2).join(' | ')));
  const id = await entrar(p, base);
  await levar(base, id, 37, 35);
  await p.waitForTimeout(2000);
  await cenaLimpa(p);
  await p.evaluate(() => {
    const g = window.PD.view.world.ground;
    const proto = Object.getPrototypeOf(g);
    const render = proto._render;
    window.__chunks = [];
    proto._render = function (...a) { const t0 = performance.now(); const r = render.apply(this, a); window.__chunks.push(performance.now() - t0); return r; };
  });
  const spots = { clareira: [31.5, 46.5], lago: [22, 50], circulo: [37, 43], mata: [20, 70], rua: [52, 45], vila: [70, 45], budega: [66, 56] };
  const res = {};
  for (const zoom of [0.7, 1.0, 1.25]) {
    await p.evaluate((z) => window.PD.view.setZoom(z), zoom);
    for (const [name, xy] of Object.entries(spots)) {
      await levar(base, id, xy[0], xy[1]);
      await p.waitForTimeout(2500);
      const times = [];
      for (let rep = 0; rep < 3; rep++) {
        await p.evaluate(() => { const g = window.PD.view.world.ground; window.__chunks = []; if (g.kept) g.kept.clear(); g.cache = new Map(); g.old = null; g.pending = true; });
        await p.waitForFunction(() => { const g = window.PD.view.world.ground; return !g.pending && !g.old && window.__chunks.length > 0; }, null, { timeout: 20000 }).catch(() => {});
        await p.waitForTimeout(300);
        times.push(...(await p.evaluate(() => window.__chunks.slice())));
        // (o motor repõe o zoom do jogador a cada quadro? confere)
      }
      const s = times.slice().sort((a, c) => a - c);
      const avg = times.reduce((a, c) => a + c, 0) / Math.max(1, times.length);
      res[`${name}@${zoom}`] = { n: times.length, media: +avg.toFixed(1), mediana: +(s[Math.floor(s.length / 2)] || 0).toFixed(1), pior: +(s[s.length - 1] || 0).toFixed(1) };
      console.log(`${name.padEnd(9)} zoom ${zoom}: ${times.length} pedaços | média ${avg.toFixed(1)} ms | mediana ${(s[Math.floor(s.length / 2)] || 0).toFixed(1)} | pior ${(s[s.length - 1] || 0).toFixed(1)} | zoom da câmera ${await p.evaluate(() => window.PD.view.cam.zoom.toFixed(3))}`);
    }
  }
  const all = Object.values(res);
  console.log('GERAL: média das médias', (all.reduce((a, c) => a + c.media, 0) / all.length).toFixed(1), 'ms | pior', Math.max(...all.map((x) => x.pior)).toFixed(1));
  if (outJson) require('fs').writeFileSync(outJson, JSON.stringify(res));
  console.log(errors.length ? 'ERROS: ' + errors.join(' || ') : 'sem erros');
  await b.close();
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
