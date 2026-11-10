// Abre o jogo, faz uma cena por roteiro e tira print.
// Uso: node jogo.cjs <cena> <saida.png> [celular]   cenas: inicio, andar, correr, rua, esquina, atras, equip, perto, soco, pulo, agachar
const { chromium, devices } = require('playwright');
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname, '..')).href + '/';
(async () => {
  const [,, scene = 'inicio', out = 'g.png', mobile] = process.argv;
  const browser = await chromium.launch();
  const ctxOpts = mobile ? { ...devices['Pixel 7'] } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e)));
  await page.goto(BASE + 'index.html?fps');
  await page.waitForFunction(() => window.__pdReady, null, { timeout: 30000 }).catch(() => errors.push('nao ficou pronto'));
  await page.waitForTimeout(1200);
  const key = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
  if (scene === 'andar') { await page.keyboard.down('KeyD'); await page.waitForTimeout(700); }
  if (scene === 'correr') { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); }
  if (scene === 'rua') { await page.evaluate(() => __pd.teleport(1700, 1250)); await page.waitForTimeout(900); }
  if (scene === 'esquina') { await page.evaluate(() => __pd.teleport(2450, 1700)); await page.waitForTimeout(900); }
  if (scene === 'atras') { await page.evaluate(() => __pd.teleport(2050, 1180)); await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW'); await page.waitForTimeout(600); }
  if (scene === 'equip') { await page.evaluate(() => { __pd.setZoom(1.6); __pd.provarEquipamento(); }); await page.keyboard.down('KeyD'); await page.waitForTimeout(650); }
  if (scene === 'perto') { await page.evaluate(() => __pd.setZoom(1.7)); await page.waitForTimeout(400); }
  if (scene === 'soco') { await page.mouse.click(900, 500); await page.waitForTimeout(240); }
  if (scene === 'pulo') { await key('Space', 50); await page.waitForTimeout(330); }
  if (scene === 'agachar') { await key('ControlLeft', 50); await page.waitForTimeout(700); }
  const info = await page.evaluate(() => ({ label: __pd.hero.label, pos: [Math.round(__pd.hero.pos.x), Math.round(__pd.hero.pos.y), Math.round(__pd.hero.groundZ)], stats: __pd.stats, zoom: __pd.cam.zoom.toFixed(2) }));
  await page.screenshot({ path: out });
  console.log(JSON.stringify(info));
  console.log(errors.length ? errors.join('\n') : 'sem erros');
  await browser.close();
})();
