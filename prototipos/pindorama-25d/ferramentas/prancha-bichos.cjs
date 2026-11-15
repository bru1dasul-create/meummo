// Prancha dos bichos da mata do sul (quati, tatu-bola, marimbondos e filhote de boitatá), sem precisar entrar no jogo:
//   node ferramentas/prancha-bichos.cjs saida.png [escala]   (escala 2 = o dobro de pixels, para ver de perto)
// Uma linha por bicho, com as poses (parado, andando, o aviso, o golpe e as reações de cada um) e duas direções; a
// última coluna é à noite (os olhos vermelhos). Embaixo, os quatro no tamanho do jogo (zoom 1,14 do PC).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..') + '/';
(async () => {
  const [, , out = 'prancha-bichos.png', scale = '1'] = process.argv;
  const list = JSON.parse(fs.readFileSync(ROOT + 'view-scripts.json', 'utf8')).scripts;
  const tags = list.map((s) => `<script src="file://${ROOT}${s}"></script>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#2b2420">
<canvas id="c"></canvas>${tags}
<script>
window.__prancha = () => {
  const W = 1500;
  const sim = (c, secs, step) => { for (let t = 0; t < secs; t += 1 / 60) { if (step) step(t); c.update(1 / 60, null); } };
  const walk = (c, yaw, secs, step, dur) => {
    let last = -1;
    sim(c, secs, (t) => {
      const k = Math.floor(t / (dur / 1000));
      if (k !== last) { last = k; c.moveTo(c.pos.x + Math.cos(yaw) * step, c.pos.y + Math.sin(yaw) * step, yaw, dur, false); }
    });
  };
  // cada pose: [rótulo, função que prepara a criatura]
  const POSES = {
    quati: [
      ['parado', (c) => sim(c, 0.5)],
      ['trotando', (c, y) => walk(c, y, 1.2, 14, 230)],
      ['farejando', (c) => { c.seed = 0.83; sim(c, 3.5); }],
      ['aviso', (c, y) => { sim(c, 0.3); c.action('windup', y); sim(c, 0.4); }],
      ['mordida', (c, y) => { sim(c, 0.3); c.action('bite', y); sim(c, 0.1); }],
      ['de costas', (c) => sim(c, 0.5), -2.4],
    ],
    tatu_bola: [
      ['parado', (c) => sim(c, 0.5)],
      ['andando', (c, y) => walk(c, y, 1.2, 12, 380)],
      ['fechando', (c, y) => { sim(c, 0.3); c.action('windup', y); sim(c, 0.35); }],
      ['rolando', (c, y) => { sim(c, 0.3); c.action('windup', y); sim(c, 0.9); c.action('charge', y); walk(c, y, 0.5, 40, 120); }],
      ['tlinc', (c) => { sim(c, 0.3); c.action('block'); sim(c, 0.08); }],
      ['tonto', (c) => { sim(c, 0.3); c.action('dizzy'); sim(c, 0.5); }],
    ],
    marimbondo: [
      ['voando', (c) => sim(c, 0.7)],
      ['zunindo', (c, y) => { sim(c, 0.3); c.action('windup', y); sim(c, 0.5); }],
      ['ferroada', (c, y) => { sim(c, 0.3); c.action('spin', y); sim(c, 0.35); }],
      ['pedra passou', (c) => { sim(c, 0.3); c.action('dodge'); sim(c, 0.3); }],
      ['caindo', (c) => { sim(c, 0.3); c.action('die'); sim(c, 0.3); }],
      ['outro lado', (c) => sim(c, 1.9), -2.4],
    ],
    filhote_boitata: [
      ['parado', (c) => sim(c, 0.6)],
      ['rastejando', (c, y) => walk(c, y, 1.4, 14, 300)],
      ['aviso', (c, y) => { sim(c, 0.3); c.action('windup', y); sim(c, 0.6); }],
      ['investida', (c, y) => { sim(c, 0.3); c.action('charge', y); walk(c, y, 0.4, 40, 100); }],
      ['apagando', (c) => { sim(c, 0.5); c.action('vanish'); sim(c, 0.3); }],
      ['de costas', (c, y) => walk(c, y, 1.4, 14, 300), -2.4],
    ],
  };
  const types = Object.keys(POSES);
  const rows = types.map((type) => ({ zoom: 1.7, h: 170, type, cells: POSES[type].map(([l, f, yaw]) => ({ l, f, yaw: yaw ?? 0.55 })).concat([{ l: 'à noite', f: (c) => sim(c, 0.5), yaw: 0.55, night: true }]) }));
  rows.push({ zoom: 1.14, h: 100, cells: types.map((type) => ({ type, l: type, f: (c) => sim(c, 0.6), yaw: 0.55 })).concat(types.map((type) => ({ type, l: type + ' (noite)', f: (c) => sim(c, 0.6), yaw: -1.2, night: true }))) });
  const H = rows.reduce((a, r) => a + r.h + 22, 10);
  const cv = document.getElementById('c');
  cv.width = W * 2; cv.height = H * 2; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#4f6a34'; ctx.fillRect(0, 0, W, H);
  const errors = [];
  let y0 = 10;
  for (const row of rows) {
    const cam = new PD.IsoCamera();
    cam.zoom = row.zoom;
    const cw = W / row.cells.length;
    row.cells.forEach((cell, i) => {
      const type = cell.type || row.type;
      const cx = cw * i + cw / 2, cy = y0 + row.h * 0.8;
      ctx.save();
      ctx.fillStyle = cell.night ? 'rgba(8, 14, 38, 0.55)' : i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(cw * i, y0, cw, row.h + 18);
      try {
        PD.creatures.eyes.night = !!cell.night;
        const c = PD.creatures.create(type, 0, 0, cell.yaw);
        c.time = 2.1;
        c.seed = c.seed || 0.37;
        cell.f(c, cell.yaw);
        const p = cam.p({ x: c.pos.x, y: c.pos.y, z: 0 });
        ctx.translate(cx - p.x, cy - p.y);
        const d = c.drawable(cam, false);
        d.drawShadow(ctx);
        d.draw(ctx);
        cell.l = cell.l + ' · ' + c.label;
      } catch (e) {
        errors.push(type + ' ' + cell.l + ': ' + String(e.stack || e).split('\\n').slice(0, 2).join(' | '));
      }
      PD.creatures.eyes.night = false;
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '11px system-ui';
      ctx.fillText(cell.l, cw * i + 6, y0 + row.h + 12);
    });
    y0 += row.h + 22;
  }
  return errors;
};
</script>`;
  const tmp = path.join(path.dirname(path.resolve(out)), 'prancha-bichos.html');
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: Number(scale) || 1 });
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
