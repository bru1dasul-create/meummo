// Prancha da capivara que anda (js/creatures/capivara.js), sem precisar entrar no jogo:
//   node ferramentas/prancha-capivara.cjs saida.png
// Linha 1: parada, andando (dois momentos), correndo, pastando, deitando, deitada e contente com o carinho ('purr'),
// de perto (zoom 1,7).
// Linha 2: andando nas 4 direções e pastando nas 4 direções.
// Linha 3: o passo em 8 quadros (de lado).
// Linha 4: no tamanho do jogo (zoom 1,14 do PC), ao lado da capivara do cenário (props.js) para comparar.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..') + '/';
(async () => {
  const [, , out = 'prancha-capivara.png'] = process.argv;
  const list = JSON.parse(fs.readFileSync(ROOT + 'view-scripts.json', 'utf8')).scripts;
  const tags = list.map((s) => `<script src="file://${ROOT}${s}"></script>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#2b2420">
<canvas id="c"></canvas>${tags}
<script>
window.__prancha = () => {
  const W = 1500;
  const sim = (c, secs, step) => { for (let t = 0; t < secs; t += 1 / 60) { if (step) step(t); c.update(1 / 60, null); } };
  function make(s, yaw, extra = 0) {
    const c = PD.creatures.create('capivara', 0, 0, yaw);
    c.time = 2.1;
    c.seed = 0.37;
    const walkBy = (secs, step, dur) => {
      let last = -1;
      sim(c, secs, (t) => {
        const k = Math.floor(t / (dur / 1000));
        if (k !== last) { last = k; c.moveTo(c.pos.x + Math.cos(yaw) * step, c.pos.y + Math.sin(yaw) * step, yaw, dur, false); }
      });
    };
    if (s === 'parada') sim(c, 0.6);
    else if (s === 'andando') walkBy(1.4 + extra, 16, 280);
    else if (s === 'correndo') walkBy(1.2 + extra, 40, 250);
    else if (s === 'pastando') { c.action('eat', yaw); sim(c, 2.5); }
    else if (s === 'deitando') { c.action('sleep', yaw); sim(c, 0.45); }
    else if (s === 'deitada') { c.action('sleep', yaw); sim(c, 3); }
    else if (s === 'olhando') sim(c, 0.9);
    else if (s === 'carinho') { sim(c, 0.6); c.action('purr', yaw); sim(c, 0.6); }
    return c;
  }
  const rows = [
    { zoom: 1.7, h: 200, cells: [['parada', 0.5], ['andando', 0.5], ['andando', 0.5, 0.11], ['correndo', 0.5], ['pastando', 0.5], ['deitando', 0.5], ['deitada', 0.5], ['carinho', 0.5], ['carinho', 2.0]] },
    { zoom: 2.0, h: 170, cells: [['andando', 0.45], ['andando', 2.0], ['andando', -2.6], ['andando', -1.1], ['pastando', 0.45], ['pastando', 2.0], ['pastando', -2.6], ['pastando', -1.1]] },
    { zoom: 2.0, h: 160, cells: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ['andando', -0.78, 1.4 + k * 0.035]) },
    { zoom: 1.14, h: 100, cells: [['parada', 0.5], ['andando', 0.5], ['pastando', 0.5], ['deitada', 0.5], ['cenario', 0.5], ['andando', 2.0], ['pastando', -1.1], ['cenario', -1.1]] },
  ];
  const H = rows.reduce((a, r) => a + r.h + 22, 10);
  const cv = document.getElementById('c');
  cv.width = W * 2; cv.height = H * 2; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#5f7a3c'; ctx.fillRect(0, 0, W, H);
  const errors = [];
  let y0 = 10;
  for (const row of rows) {
    const cam = new PD.IsoCamera();
    cam.zoom = row.zoom;
    const cw = W / row.cells.length;
    row.cells.forEach(([s, yaw, extra], i) => {
      const cx = cw * i + cw / 2, cy = y0 + row.h * 0.78;
      ctx.save();
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(cw * i, y0, cw, row.h + 18);
      let label = s;
      try {
        if (s === 'cenario') {
          // a capivara do cenário (o enfeite do mapa), para comparar o tamanho e o jeito
          const world = { cam, map: { props: [] }, ground: { heightAt: () => 0 }, heightAt: () => 0 };
          const d = { kind: 'capivara', x: 0, y: 0, angle: (yaw * 180) / Math.PI };
          const p = cam.p({ x: 0, y: 0, z: 0 });
          ctx.translate(cx - p.x, cy - p.y);
          const sm = new PD.props.Small(world, d);
          sm.z0 = 0;
          sm.ink = Math.max(1, 1.15 * cam.zoom);
          sm._capybara(ctx);
          label = 'cenário';
        } else {
          const c = make(s, yaw, extra || 0);
          const p = cam.p({ x: c.pos.x, y: c.pos.y, z: 0 });
          ctx.translate(cx - p.x, cy - p.y);
          const d = c.drawable(cam, false);
          d.drawShadow(ctx);
          d.draw(ctx);
          label = c.label;
        }
      } catch (e) {
        errors.push(s + ': ' + String(e.stack || e).split('\\n').slice(0, 2).join(' | '));
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '11px system-ui';
      ctx.fillText(label, cw * i + 6, y0 + row.h + 12);
    });
    y0 += row.h + 22;
  }
  return errors;
};
</script>`;
  const tmp = path.join(path.dirname(path.resolve(out)), 'prancha-capivara.html');
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto('file://' + tmp);
  const errors = await p.evaluate(() => window.__prancha());
  const el = await p.$('#c');
  await el.screenshot({ path: out });
  console.log(errors.length || errs.length ? 'ERROS: ' + errors.concat(errs).join(' || ') : 'sem erros', '→', out);
  await b.close();
  fs.unlinkSync(tmp);
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
