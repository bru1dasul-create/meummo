// Uso: node perfil.cjs   (funções que mais gastam CPU correndo pela rua)
// Perfil de CPU (2,5 s correndo pela rua) e as funções que mais gastam.
const { chromium } = require('playwright');
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname, '..')).href + '/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(BASE + 'index.html');
  await page.waitForFunction(() => window.__pdReady);
  await page.waitForTimeout(800);
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => __pd.teleport(600, 1750));
  await page.waitForTimeout(600);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyD');
  await page.waitForTimeout(2500);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const counts = new Map();
  for (const s of profile.samples) counts.set(s, (counts.get(s) || 0) + 1);
  let total = 0;
  for (const [id, c] of counts) {
    const n = byId.get(id);
    const name = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-2).join('/')}:${n.callFrame.lineNumber + 1}`;
    self.set(name, (self.get(name) || 0) + c);
    total += c;
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22);
  for (const [k, v] of top) console.log(((v / total) * 100).toFixed(1).padStart(5) + '%  ' + k);
  await browser.close();
})();
