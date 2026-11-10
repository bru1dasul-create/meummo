// Tira de filme: o personagem num roteiro (combo, virada, parada...) desenhado quadro a quadro, a cada 1/30 s,
// lado a lado. Serve para ver tranco e pose que pula, coisa que a prancha (quadros soltos) não mostra.
// Uso: node tira.cjs <cena> [saida.png] [zoom] [direção em graus]   cenas: combo, virar, parar, soco-lado, correr-parar, pular
//   direção: -45 = de lado (olhando para a direita da tela), 45 = de frente, 5 = 3/4
const { chromium } = require('playwright');
const BASE = require('url').pathToFileURL(require('path').resolve(__dirname, '..')).href + '/';
(async () => {
  const [, , scene = 'combo', out = 'tira.png', zoomArg = '1.1', yawArg] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2400, height: 1600 } });
  await page.goto(BASE + 'prancha.html?linhas=0');
  await page.waitForFunction(() => window.__sheetReady);
  const ok = await page.evaluate(
    ([scene, zoom, yawDeg]) => {
      const M = PD.math;
      const Y = yawDeg;
      const click = (t, at) => Math.abs(t - at) < 0.5 / 120;
      const dir = (deg, m = 1) => ({ x: Math.cos(deg * M.DEG) * m, y: Math.sin(deg * M.DEG) * m });
      // cada cena: [quanto rodar antes, duração filmada, entrada(t)]
      const SCENES = {
        combo: [0.4, 1.3, (t) => ({ attack: [0.45, 0.66, 0.92, 1.14].some((a) => click(t, a)), attackDir: Y * M.DEG })],
        'soco-lado': [0.4, 0.8, (t) => ({ attack: click(t, 0.45), attackDir: (Y + 90) * M.DEG })],
        virar: [0.2, 1.2, (t) => ({ move: t < 0.9 ? dir(Y) : dir(Y + 180) })],
        parar: [0.2, 1.2, (t) => ({ move: t < 1.0 ? dir(Y) : null })],
        'correr-parar': [0.2, 1.3, (t) => ({ move: t < 1.0 ? dir(Y) : null, run: true })],
        pular: [0.2, 1.1, (t) => ({ jump: click(t, 0.3), move: dir(Y) })],
      };
      const sc = SCENES[scene];
      if (!sc) return false;
      const [pre, dur, input] = sc;
      const cam = new PD.IsoCamera();
      cam.zoom = zoom;
      cam.dpr = 1;
      const r = new PD.CharacterRenderer(cam);
      const ch = new PD.Character(0, 0, Y * M.DEG);
      const dt = 1 / 120;
      const frames = [];
      let t = 0;
      let next = pre;
      while (t < pre + dur) {
        ch.update(dt, input(t), null);
        const rig = PD.rig.buildRig(ch.pose());
        ch.secondary(rig, dt);
        t += dt;
        if (t >= next - 1e-9) {
          frames.push({ rig, look: JSON.parse(JSON.stringify(ch.look)), pos: { x: ch.pos.x, y: ch.pos.y }, label: (t - pre).toFixed(2) + ' s · ' + ch.label });
          next += 1 / 30;
        }
      }
      const cols = 10;
      const cw = Math.round(120 * zoom);
      const chh = Math.round(200 * zoom);
      const rows = Math.ceil(frames.length / cols);
      const c = document.createElement('canvas');
      c.id = 'tira';
      c.width = cols * cw;
      c.height = rows * chh;
      document.body.appendChild(c);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#d9d4c7';
      ctx.fillRect(0, 0, c.width, c.height);
      frames.forEach((f, k) => {
        const x0 = (k % cols) * cw;
        const y0 = Math.floor(k / cols) * chh;
        ctx.fillStyle = k % 2 ? '#cfc9bb' : '#d6d0c2';
        ctx.fillRect(x0, y0, cw, chh);
        // câmera parada (centrada no começo do trecho): dá para ver o personagem andar
        const root = cam.p({ x: f.pos.x, y: f.pos.y, z: 0 });
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, cw, chh);
        ctx.clip();
        ctx.translate(x0 + cw / 2 - root.x, y0 + chh - 24 * zoom - root.y);
        r.drawShadow(ctx, f.rig, 0);
        r.draw(ctx, f.rig, f.look);
        ctx.restore();
        ctx.fillStyle = '#3b302a';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(f.label, x0 + 4, y0 + chh - 6);
      });
      return true;
    },
    [scene, Number(zoomArg), yawArg !== undefined ? Number(yawArg) : scene === 'combo' || scene === 'soco-lado' ? 5 : -45],
  );
  if (!ok) {
    console.log('cena desconhecida:', scene);
  } else {
    const el = await page.$('#tira');
    await el.screenshot({ path: out });
    console.log('ok', out);
  }
  await browser.close();
})();
