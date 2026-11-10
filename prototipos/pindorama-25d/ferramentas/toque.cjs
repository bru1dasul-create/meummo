// Celular (Pixel 7): joystick e botões de toque. Uso: node toque.cjs [saida.png]
const { chromium, devices } = require('playwright');
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname, '..')).href + '/';
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + 'index.html');
  await page.waitForFunction(() => window.__pdReady);
  await page.waitForTimeout(600);
  const r = {};
  r.modo = await page.evaluate(() => document.body.className);
  const before = await page.evaluate(() => ({ x: __pd.hero.pos.x, y: __pd.hero.pos.y }));
  // arrasta o joystick para a direita da tela por 0,8 s
  await page.evaluate(() => {
    const c = document.getElementById('game');
    const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true }));
    ev('pointerdown', 90, 700);
    ev('pointermove', 150, 700);
    window.__endStick = () => ev('pointerup', 150, 700);
  });
  await page.waitForTimeout(800);
  const mid = await page.evaluate(() => ({ x: __pd.hero.pos.x, y: __pd.hero.pos.y, label: __pd.hero.label, stick: !document.getElementById('stick-base').hidden }));
  await page.screenshot({ path: process.argv[2] || 'toque.png' });
  await page.evaluate(() => window.__endStick());
  await page.waitForTimeout(300);
  r.joystick = { andou: Math.round(Math.hypot(mid.x - before.x, mid.y - before.y)), estado: mid.label, joystickNaTela: mid.stick, direcaoTela: Math.round(((mid.x - before.x) - (mid.y - before.y)) * 0.707) + ' px p/ direita' };
  // botões
  await page.evaluate(() => document.getElementById('t-jump').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, pointerType: 'touch', bubbles: true, cancelable: true })));
  await page.waitForTimeout(250);
  r.pular = await page.evaluate(() => __pd.hero.label + ' z=' + Math.round(__pd.hero.pos.z));
  await page.waitForTimeout(900);
  await page.evaluate(() => document.getElementById('t-attack').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true })));
  await page.waitForTimeout(120);
  r.soco = await page.evaluate(() => __pd.hero.label);
  await page.waitForTimeout(900);
  await page.evaluate(() => document.getElementById('t-crouch').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10, pointerType: 'touch', bubbles: true, cancelable: true })));
  await page.waitForTimeout(600);
  r.agachar = await page.evaluate(() => __pd.hero.label);
  await page.evaluate(() => document.getElementById('t-run').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 11, pointerType: 'touch', bubbles: true, cancelable: true })));
  r.correrLigado = await page.evaluate(() => document.getElementById('t-run').classList.contains('on'));
  console.log(JSON.stringify(r, null, 1));
  console.log(errors.length ? errors.join('\n') : 'sem erros');
  await browser.close();
})();
