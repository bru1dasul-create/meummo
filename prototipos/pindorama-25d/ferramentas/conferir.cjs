// Uso: node conferir.cjs   (colisão, 8 direções, estados e desempenho com a CPU 4x mais lenta)
// Testes do protótipo no navegador: colisão, 8 direções, estados e desempenho (com CPU 4x mais lenta).
const { chromium, devices } = require('playwright');
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname, '..')).href + '/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + 'index.html');
  await page.waitForFunction(() => window.__pdReady);
  await page.waitForTimeout(500);
  const res = {};
  // 1) colisão: anda contra a fachada do prédio (y1 = 1100) por 2 s
  await page.evaluate(() => __pd.teleport(1450, 1200));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyW');
  res.colisao = await page.evaluate(() => ({ y: +__pd.hero.pos.y.toFixed(1), x: +__pd.hero.pos.x.toFixed(1), dentro: __pd.hero.pos.y < 1100 + 21 }));
  // 2) oito direções: a frente do personagem bate com a direção das teclas
  const combos = { W: ['KeyW'], 'W+D': ['KeyW', 'KeyD'], D: ['KeyD'], 'S+D': ['KeyS', 'KeyD'], S: ['KeyS'], 'S+A': ['KeyS', 'KeyA'], A: ['KeyA'], 'W+A': ['KeyW', 'KeyA'] };
  res.direcoes = {};
  for (const [name, keys] of Object.entries(combos)) {
    await page.evaluate(() => __pd.teleport(1180, 2960));
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(450);
    const v = await page.evaluate(() => ({ yaw: Math.round((((__pd.hero.yaw * 180) / Math.PI) % 360 + 360) % 360), speed: Math.round(__pd.hero.speed) }));
    for (const k of keys) await page.keyboard.up(k);
    res.direcoes[name] = v;
    await page.waitForTimeout(150);
  }
  // 3) estados
  const states = [];
  await page.evaluate(() => __pd.teleport(1180, 2960));
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyD'); await page.waitForTimeout(700);
  states.push(await page.evaluate(() => __pd.hero.label));
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyD'); await page.waitForTimeout(500);
  await page.keyboard.press('KeyC'); await page.waitForTimeout(500); states.push(await page.evaluate(() => __pd.hero.label));
  await page.keyboard.press('KeyC'); await page.waitForTimeout(400);
  await page.keyboard.press('Space'); await page.waitForTimeout(250); states.push(await page.evaluate(() => __pd.hero.label + ' z=' + Math.round(__pd.hero.pos.z)));
  await page.waitForTimeout(900);
  await page.mouse.click(700, 420); await page.waitForTimeout(150); states.push(await page.evaluate(() => __pd.hero.label));
  res.estados = states;
  // 4) desempenho com CPU 4x mais lenta, correndo pela rua
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => __pd.teleport(600, 1750));
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyD');
  await page.waitForTimeout(3500);
  res.desempenho_cpu4x = await page.evaluate(() => ({ fps: Math.round(__pd.stats.fps), ms: +__pd.stats.ms.toFixed(1) }));
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyD');
  console.log(JSON.stringify(res, null, 1));
  console.log(errors.length ? 'ERROS: ' + errors.join('\n') : 'sem erros');
  await browser.close();
})();
