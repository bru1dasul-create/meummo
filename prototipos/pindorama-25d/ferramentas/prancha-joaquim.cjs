// Prancha do Joaquim (o gato da vó, js/creatures/gato.js), sem precisar entrar no jogo:
//   node ferramentas/prancha-joaquim.cjs saida.png poses [detalhe|jogo|tudo]
//     cada pose (dormindo, espreguiçando, parado, andando, sentado, miando, carinho, pulando) em 4 direções e nos
//     tamanhos do jogo (zoom 2,6 de perto; 1,14 do PC; 0,5 do celular deitado); "estatico" é o desenho de dormir aprovado
//   node ferramentas/prancha-joaquim.cjs saida.png tiras [zoom]
//     o movimento em quadros: o passo (de lado e de frente), o pulo do sofá, o acordar e o deitar
// Serve de modelo para conferir outra criatura de bolas (creature.js): troque o 'joaquim' e as poses.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..') + '/';
(async () => {
  const [, , out = 'prancha-joaquim.png', mode = 'poses', arg] = process.argv;
  const list = JSON.parse(fs.readFileSync(ROOT + 'view-scripts.json', 'utf8')).scripts;
  const tags = list.map((s) => `<script src="file://${ROOT}${s}"></script>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#2b2420">
<canvas id="c"></canvas>${tags}
<script>
window.__poses = (which) => {
  const W = 1500;
  const rowsSpec = [];
  const states = ['dormindo','espreguicando','parado','andando','andando2','sentado','miando','carinho','pulando'];
  const yaws = [0.45, 2.0, -2.6, -1.1];
  if (which !== 'jogo') rowsSpec.push({ zoom: 2.6, h: 190, cells: states.map((s) => ({ s, yaw: 0.45 })) });
  if (which !== 'jogo') rowsSpec.push({ zoom: 2.6, h: 190, cells: yaws.flatMap((y) => [{ s: 'andando', yaw: y }, { s: 'sentado', yaw: y }]).concat([{ s: 'estatico', yaw: 1.2 }]) });
  if (which !== 'detalhe') rowsSpec.push({ zoom: 1.14, h: 110, cells: states.concat(['andando']).map((s, i) => ({ s, yaw: i === 9 ? 2.0 : 0.45 })).concat([{ s: 'estatico', yaw: 1.2 }]), heroAt: 9 });
  if (which !== 'detalhe') rowsSpec.push({ zoom: 0.5, h: 70, cells: states.concat(['andando']).map((s, i) => ({ s, yaw: i === 9 ? 2.0 : 0.45 })).concat([{ s: 'estatico', yaw: 1.2 }]) });
  const H = rowsSpec.reduce((a, r) => a + r.h + 22, 10);
  const cv = document.getElementById('c');
  cv.width = W * 2; cv.height = H * 2; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#6f4f35'; ctx.fillRect(0, 0, W, H);
  const errors = [];
  const sim = (c, secs, step) => { for (let t = 0; t < secs; t += 1 / 60) { if (step) step(t); c.update(1 / 60, null); } };
  function make(s, yaw) {
    const c = PD.creatures.create('joaquim', 0, 0, yaw);
    c.time = 1.3;
    const walkBy = (secs, phase) => {
      let last = -1;
      sim(c, secs + phase, (t) => {
        const k = Math.floor(t / 0.25);
        if (k !== last) { last = k; c.moveTo(c.pos.x + Math.cos(yaw) * 16, c.pos.y + Math.sin(yaw) * 16, yaw, 250, false); }
      });
    };
    if (s === 'dormindo') { c.setAsleep(true); c.perch = 0; sim(c, 1.2); }
    else if (s === 'espreguicando') { c.setAsleep(true); c.perch = 0; sim(c, 0.3); c.action('wake'); sim(c, 0.75); }
    else if (s === 'parado') sim(c, 0.6);
    else if (s === 'andando') walkBy(1.2, 0);
    else if (s === 'andando2') walkBy(1.2, 0.13);
    else if (s === 'sentado') sim(c, 3);
    else if (s === 'miando') { sim(c, 0.6); c.action('meow', yaw); sim(c, 0.35); }
    else if (s === 'carinho') { sim(c, 0.6); c.action('purr', yaw); sim(c, 0.45); }
    else if (s === 'pulando') { c.setAsleep(false); c.perch = 46; sim(c, 0.3); c.moveTo(c.pos.x + Math.cos(yaw) * 60, c.pos.y + Math.sin(yaw) * 60, yaw, 0, true); sim(c, 0.2); }
    return c;
  }
  let y0 = 10;
  for (const row of rowsSpec) {
    const cam = new PD.IsoCamera();
    cam.zoom = row.zoom;
    const cw = W / row.cells.length;
    row.cells.forEach((cell, i) => {
      const cx = cw * i + cw / 2, cy = y0 + row.h * 0.78;
      ctx.save();
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(cw * i, y0, cw, row.h + 18);
      try {
        if (cell.s === 'estatico') {
          const p = cam.p({ x: 0, y: 0, z: 0 });
          ctx.translate(cx - p.x, cy - p.y);
          PD.gato.draw(ctx, cam, { x: 0, y: 0, z: 0, yaw: cell.yaw, t: 1.3, name: null });
        } else {
          const c = make(cell.s, cell.yaw);
          const p = cam.p({ x: c.pos.x, y: c.pos.y, z: 0 });
          ctx.translate(cx - p.x, cy - p.y);
          const d = c.drawable(cam, false);
          d.drawShadow(ctx);
          d.draw(ctx);
          cell.label = c.label;
        }
      } catch (e) { errors.push(cell.s + ': ' + (e.stack || e)); }
      ctx.restore();
      ctx.fillStyle = '#f3e6cf'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(cell.s + ' ' + cell.yaw, cx, y0 + row.h + 14);
    });
    y0 += row.h + 22;
  }
  return { errors, W, H };
};
window.__tiras = (Z) => {
  const W = 1500, ROWH = 175, N = 8;
  const rows = [
    { name: 'passo de lado', kind: 'walk', yaw: -0.785 },
    { name: 'passo de frente', kind: 'walk', yaw: 0.785 },
    { name: 'pulo do sofa', kind: 'jump', yaw: 0.3 },
    { name: 'acordar', kind: 'wake', yaw: 1.2 },
    { name: 'deitar', kind: 'sleep', yaw: 1.2 },
  ];
  const H = rows.length * ROWH + 10;
  const cv = document.getElementById('c');
  cv.width = W * 2; cv.height = H * 2; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(2, 2);
  ctx.fillStyle = '#6f4f35'; ctx.fillRect(0, 0, W, H);
  const cam = new PD.IsoCamera(); cam.zoom = Z;
  const dt = 1 / 60;
  const errors = [];
  rows.forEach((row, r) => {
    const y0 = 10 + r * ROWH;
    for (let f = 0; f < N; f++) {
      const c = PD.creatures.create('joaquim', 0, 0, row.yaw);
      c.time = 1.3;
      let note = '';
      try {
        if (row.kind === 'walk') {
          // anda até o passo ficar regular; cada quadro avança 1/8 de passada (26*1,1 cm)
          const speed = 60, stride = 26 * 1.1;
          const total = 1.5 + (f / N) * (stride / speed);
          let last = -1;
          for (let t = 0; t < total; t += dt) {
            const k = Math.floor(t / 0.25);
            if (k !== last) { last = k; c.moveTo(c.pos.x + Math.cos(row.yaw) * speed * 0.25, c.pos.y + Math.sin(row.yaw) * speed * 0.25, row.yaw, 250, false); }
            c.update(dt, null);
          }
          note = 'fase ' + c.phase.toFixed(2);
        } else if (row.kind === 'jump') {
          c.perch = 46;
          for (let t = 0; t < 0.3; t += dt) c.update(dt, null);
          c.moveTo(c.pos.x + Math.cos(row.yaw) * 70, c.pos.y + Math.sin(row.yaw) * 70, row.yaw, 0, true);
          const tt = (f / (N - 1)) * 0.5;
          for (let t = 0; t < tt; t += dt) c.update(dt, null);
          note = 'perch ' + Math.round(c.perch);
        } else if (row.kind === 'wake') {
          c.setAsleep(true); c.perch = 0;
          for (let t = 0; t < 0.5; t += dt) c.update(dt, null);
          c.action('wake');
          const tt = [0, 0.05, 0.1, 0.16, 0.25, 0.5, 1.0, 1.7][f];
          for (let t = 0; t < tt; t += dt) c.update(dt, null);
          note = 't ' + tt + ' curl ' + c.curl.toFixed(2);
        } else if (row.kind === 'sleep') {
          for (let t = 0; t < 2.5; t += dt) c.update(dt, null);
          c.action('sleep');
          const tt = [0, 0.08, 0.16, 0.25, 0.35, 0.5, 0.8, 1.5][f];
          for (let t = 0; t < tt; t += dt) c.update(dt, null);
          note = 't ' + tt + ' curl ' + c.curl.toFixed(2);
        }
        const cx = (W / N) * f + W / N / 2, cy = y0 + ROWH * 0.8;
        // o quadro centrado no pé (no pulo, na altura do arco, para o gato aparecer)
        const zc = row.kind === 'jump' ? c.perch * 0.8 : 0;
        const p = cam.p({ x: c.pos.x, y: c.pos.y, z: zc });
        ctx.save();
        ctx.fillStyle = f % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect((W / N) * f, y0, W / N, ROWH);
        ctx.translate(cx - p.x, cy - p.y);
        // um "chão" de referência no pé (para ver se a pata escorrega)
        const g = cam.p({ x: c.pos.x, y: c.pos.y, z: 0 });
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(g.x - 60, g.y); ctx.lineTo(g.x + 60, g.y); ctx.stroke();
        const d = c.drawable(cam, false);
        d.drawShadow(ctx); d.draw(ctx);
        ctx.restore();
        ctx.fillStyle = '#f3e6cf'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(row.name + ' · ' + note + ' · ' + c.label, cx, y0 + ROWH - 4);
      } catch (e) { errors.push(row.name + ': ' + (e.stack || e)); }
    }
  });
  return { errors, W, H };
};
</script>`;
  const tmp = path.join(path.dirname(path.resolve(out)), '_prancha-joaquim.html');
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + tmp);
  await p.waitForFunction(() => window.PD && PD.creatures && PD.creatures.has('joaquim'), null, { timeout: 15000 });
  const r = mode === 'tiras'
    ? await p.evaluate((z) => window.__tiras(z), Number(arg || '2.4'))
    : await p.evaluate((w) => window.__poses(w), arg || 'tudo');
  await p.setViewportSize({ width: r.W, height: Math.ceil(r.H) });
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: r.W, height: Math.ceil(r.H) } });
  fs.unlinkSync(tmp);
  const errors = r.errors.concat(errs);
  console.log(errors.length ? 'ERROS: ' + errors.slice(0, 5).join(' | ') : 'ok: ' + out);
  await b.close();
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
