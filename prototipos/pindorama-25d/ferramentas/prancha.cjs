// Print da prancha (prancha.html) com os erros do console.
// Uso: node prancha.cjs [consulta] [saida.png] [escala]   ex.: node prancha.cjs '?zoom=3&ossos' prancha.png 1
const { chromium } = require('playwright');
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname, '..')).href + '/';
(async () => {
  const [,, query = '', out = 'sheet.png', scale = '1'] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 3800, height: 1000 }, deviceScaleFactor: Number(scale) });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + 'prancha.html' + query);
  await page.waitForFunction(() => window.__sheetReady || window.__sheetError, null, { timeout: 60000 }).catch(() => {});
  const err = await page.evaluate(() => window.__sheetError || null);
  if (err) errors.push(err);
  const el = await page.$('#sheet');
  await el.screenshot({ path: out });
  console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'ok', out);
  await browser.close();
})();
