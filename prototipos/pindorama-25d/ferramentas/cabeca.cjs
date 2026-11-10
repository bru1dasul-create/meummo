// Cabeça girando 360° (de 7,5° em 7,5°), de perto: serve para ver se o cabelo cobre o rosto ou pula de uma vez para
// a frente ou para trás em algum ângulo. Entre dois quadros vizinhos nada pode mudar de repente.
// Uso: node cabeca.cjs [saida.png] [zoom]
const { chromium } = require('playwright');
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname, '..')).href + '/';
(async () => {
  const [, , out = 'cabeca.png', zoomArg = '3'] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2400, height: 1600 } });
  await page.goto(BASE + 'prancha.html?linhas=0');
  await page.waitForFunction(() => window.__sheetReady);
  await page.evaluate((zoom) => {
    const M = PD.math;
    const cam = new PD.IsoCamera();
    cam.zoom = zoom;
    cam.dpr = 1;
    const r = new PD.CharacterRenderer(cam);
    const N = 48;
    const cols = 12;
    const cw = Math.round(46 * zoom);
    const chh = Math.round(52 * zoom);
    const c = document.createElement('canvas');
    c.id = 'cab';
    c.width = cols * cw;
    c.height = Math.ceil(N / cols) * chh;
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d9d4c7';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let k = 0; k < N; k++) {
      const yaw = (k * 360) / N;
      const ch = new PD.Character(0, 0, yaw * M.DEG);
      ch.time = 5; // sem o "olhar em volta" do começo variar de quadro para quadro
      PD.sheet.simulate(ch, 0.25, {});
      ch.yaw = yaw * M.DEG;
      ch._pose = null;
      const rig = PD.rig.buildRig(ch.pose());
      const x0 = (k % cols) * cw;
      const y0 = Math.floor(k / cols) * chh;
      ctx.fillStyle = k % 2 ? '#cfc9bb' : '#d6d0c2';
      ctx.fillRect(x0, y0, cw, chh);
      const hp = cam.p(rig.head.o);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, cw, chh);
      ctx.clip();
      ctx.translate(x0 + cw / 2 - hp.x, y0 + chh * 0.55 - hp.y);
      r.draw(ctx, rig, ch.look);
      ctx.restore();
      ctx.fillStyle = '#3b302a';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(yaw.toFixed(1) + '°', x0 + 4, y0 + chh - 5);
    }
  }, Number(zoomArg));
  await (await page.$('#cab')).screenshot({ path: out });
  console.log('ok', out);
  await browser.close();
})();
