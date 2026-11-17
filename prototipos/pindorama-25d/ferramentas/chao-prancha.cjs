// O CHÃO sem ligar o jogo: carrega os scripts da view (view-scripts.json) e o mapa do Capão numa página, põe o herói
// num ponto e copia a tela — e mede quanto custou pintar cada pedaço de chão. Serve para ir e voltar rápido no desenho.
// Uso: node chao-prancha.cjs <pasta de saída> "nome:x,y,zoom;nome:x,y,zoom" [largura,altura]
//   RAIZ=<pasta do protótipo>  usa outra cópia dos scripts (o "antes": um git worktree da main)
//   NOITE=1  de noite    SEM_HEROI=1  sem o herói    CUSTO=1  só mede o custo dos pedaços (3 vezes cada ponto)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const [, , out = '.', spotsArg = 'clareira:32,47,1', tela = '1600,900'] = process.argv;
  const ROOT = path.resolve(process.env.RAIZ || path.join(__dirname, '..')) + '/';
  const MAPA = process.env.MAPA || path.join(__dirname, '../../../public/assets/maps-iso/capao.tmj');
  const [W, H] = tela.split(',').map(Number);
  fs.mkdirSync(out, { recursive: true });
  const list = JSON.parse(fs.readFileSync(ROOT + 'view-scripts.json', 'utf8')).scripts;
  const tags = list.map((s) => `<script src="file://${ROOT}${s}"></script>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111"><canvas id="tela" style="width:${W}px;height:${H}px;display:block"></canvas>
${tags}
<script>window.__tmj = ${fs.readFileSync(MAPA, 'utf8')};</script>
<script>
window.__erros = [];
addEventListener('error', (e) => window.__erros.push(String(e.message)));
window.__pronto = (() => {
  const view = new PD.View(document.getElementById('tela'), window.__tmj);
  window.view = view;
  if (!${process.env.SEM_HEROI ? 'true' : 'false'}) { view.addActor('heroi', { kind: 'player', name: '', x: 37, y: 43, angle: 45, me: true }); view.follow('heroi'); }
  view.setWind(0, 0);
  if (${process.env.NOITE ? 'true' : 'false'}) view.setTimeOfDay({ light: 0, night: true });
  const g = view.world.ground;
  const proto = Object.getPrototypeOf(g);
  const render = proto._render;
  window.__chunks = [];
  proto._render = function (...a) { const t0 = performance.now(); const r = render.apply(this, a); window.__chunks.push(performance.now() - t0); return r; };
  // SEM=marks,seam,...: desliga um pintor do chão (para medir quanto ele custa de verdade, com a pintura na tela)
  for (const k of ${JSON.stringify((process.env.SEM || '').split(',').filter(Boolean))}) {
    if (k === 'tinta') { const base = (t, c) => c || (PD.groundHelp.MAT[t] || PD.groundHelp.MAT.terra).base; PD.chao.paintOf = base; continue; }
    if (k === 'sombras') { for (const pr of view.world.props || []) pr.shadow = null; continue; }
    if (k === 'area') { PD.chao.area = (ctx, sh) => { PD.groundHelp.shapePath(ctx, sh); ctx.fillStyle = PD.chao.paintOf(sh.type, sh.color); ctx.fill(); }; continue; }
    if (k === 'trail') { PD.chao.trail = (ctx, sh) => sh.kind === 'line' && !!PD.chao.natural(sh.type) && !['mata', 'mata-profunda', 'grama', 'clareira'].includes(sh.type); continue; }
    if (k === 'marks') { PD.chao.marks = (ctx, sh) => !!PD.chao.natural(sh.type); continue; }
    PD.chao[k] = () => {};
  }
  // PERFIL=1: quanto de cada pedaço vai para cada pintor do chão
  window.__perfil = {};
  if (${process.env.PERFIL ? 'true' : 'false'}) {
    const wrap = (obj, name, label) => { const f = obj[name]; if (typeof f !== 'function') return; obj[name] = function (...a) { const t0 = performance.now(); try { return f.apply(this, a); } finally { window.__perfil[label] = (window.__perfil[label] || 0) + performance.now() - t0; } }; };
    for (const k of ['area', 'edgeOver', 'seam', 'trailsUnder', 'trail', 'marks']) if (PD.chao) wrap(PD.chao, k, 'chao.' + k);
    wrap(proto, '_paintShapes', 'paintShapes (tudo do chão do mapa)');
    wrap(proto, '_texture', 'texture (com as marcas)');
    wrap(proto, '_water', 'agua');
    if (PD.street) { for (const k of Object.keys(PD.street.paint)) wrap(PD.street.paint, k, 'rua.detalhes'); for (const k of Object.keys(PD.street.texture)) wrap(PD.street.texture, k, 'rua.textura'); wrap(PD.street, 'breaks', 'rua.figueiras'); }
  }
  let on = true;
  const loop = (t) => { if (!on) return; try { view.frame(t); } catch (e) { window.__erros.push(String(e.stack || e).split('\\n').slice(0, 3).join(' | ')); on = false; } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return true;
})();
window.__ir = (x, y, zoom) => {
  const view = window.view;
  view.setZoom(zoom);
  if (view.actors.has('heroi')) view.moveActor('heroi', x, y, 45, { durationMs: 0 });
  else { view.map.spawn.x = x * 100; view.map.spawn.y = y * 100; }
  view.camTarget = null;
  window.__chunks = [];
};
// EMENDA: os pedaços (3 x 3, pintados um a um) contra a mesma área pintada de uma vez só; o que sair diferente é marca
// cortada na emenda de dois pedaços (ou pulada por engano)
window.__emenda = (n) => {
  const g = window.view.world.ground;
  const keys = [...g.cache.keys()].map((k) => k.split(',').map(Number));
  const cx0 = Math.min(...keys.map((k) => k[0])), cy0 = Math.min(...keys.map((k) => k[1]));
  const S = 512, dpr = g.cam.dpr;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = n * S * dpr; return c; };
  const a = mk(), ax = a.getContext('2d');
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) ax.drawImage(g._render(cx0 + i, cy0 + j), i * S * dpr, j * S * dpr);
  const b = mk(), bx = b.getContext('2d');
  bx.setTransform(dpr, 0, 0, dpr, -cx0 * S * dpr, -cy0 * S * dpr);
  g._paint(bx, { x: cx0 * S, y: cy0 * S, w: n * S, h: n * S });
  const da = ax.getImageData(0, 0, a.width, a.height).data, db = bx.getImageData(0, 0, a.width, a.height).data;
  const d = mk(), dx = d.getContext('2d'), img = dx.createImageData(a.width, a.height);
  let bad = 0, worst = 0;
  for (let k = 0; k < da.length; k += 4) {
    const diff = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2]));
    worst = Math.max(worst, diff);
    if (diff > 10) { bad++; img.data[k] = 255; img.data[k + 1] = 40; img.data[k + 2] = 40; } else { img.data[k] = da[k] * 0.45; img.data[k + 1] = da[k + 1] * 0.45; img.data[k + 2] = da[k + 2] * 0.45; }
    img.data[k + 3] = 255;
  }
  dx.putImageData(img, 0, 0);
  return { bad, worst, total: da.length / 4, url: d.toDataURL('image/png'), pedacos: a.toDataURL('image/png') };
};
window.__assentou = () => { const w = window.view.world, g = w.ground; return !g.pending && !g.old && !w._stale; };
window.__refazer = () => { const g = window.view.world.ground; window.__chunks = []; if (g.kept) g.kept.clear(); g.cache = new Map(); g.old = null; g.pending = true; };
</script>`;
  const tmp = path.join(out, '_pagina.html');
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.DPR || 1) });
  const pe = [];
  p.on('pageerror', (e) => pe.push(String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
  await p.goto('file://' + tmp);
  await p.waitForFunction(() => window.__pronto === true, null, { timeout: 30000 });
  const stats = (t) => { const s = t.slice().sort((a, c) => a - c); const avg = t.reduce((a, c) => a + c, 0) / Math.max(1, t.length); return `${t.length} pedaços, média ${avg.toFixed(1)} ms, mediana ${(s[Math.floor(s.length / 2)] || 0).toFixed(1)}, pior ${(s[s.length - 1] || 0).toFixed(1)}`; };
  const all = [];
  for (const sp of spotsArg.split(';')) {
    const [name, rest] = sp.split(':');
    const [x, y, zoom = 1] = rest.split(',').map(Number);
    await p.evaluate(([a, c, z]) => window.__ir(a, c, z), [x, y, zoom]);
    await p.evaluate(() => { window.__perfil = {}; });
    await p.waitForTimeout(600);
    await p.waitForFunction(() => window.__assentou(), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(900);
    if (process.env.EMENDA) {
      const r = await p.evaluate((n) => window.__emenda(n), +(process.env.EMENDA) || 3);
      fs.writeFileSync(path.join(out, name + '-emenda.png'), Buffer.from(r.url.split(',')[1], 'base64'));
      fs.writeFileSync(path.join(out, name + '-pedacos.png'), Buffer.from(r.pedacos.split(',')[1], 'base64'));
      console.log(`${name.padEnd(10)} zoom ${zoom}: ${r.bad} pontos diferentes de ${r.total} (maior diferença ${r.worst})`);
      continue;
    }
    if (process.env.DIRETO) {
      // repinta os mesmos pedaços (os que estão na tela) várias vezes seguidas, fora do laço do jogo: menos ruído
      const r = await p.evaluate((reps) => {
        const g = window.view.world.ground;
        const keys = [...g.cache.keys()].map((k) => k.split(',').map(Number));
        const per = keys.map(() => []);
        for (let rep = 0; rep < reps; rep++) keys.forEach(([cx, cy], i) => { const t0 = performance.now(); g._render(cx, cy); per[i].push(performance.now() - t0); });
        // de cada pedaço fica a mediana das repetições
        return per.map((t) => t.sort((a, c) => a - c)[Math.floor(t.length / 2)]);
      }, +(process.env.DIRETO) || 9);
      all.push(...r);
      console.log(`${name.padEnd(10)} zoom ${zoom}: ${stats(r)}`);
      continue;
    }
    if (process.env.CUSTO) {
      const times = [];
      for (let rep = 0; rep < 3; rep++) {
        await p.evaluate(() => window.__refazer());
        await p.waitForFunction(() => window.__assentou() && window.__chunks.length > 0, null, { timeout: 30000 }).catch(() => {});
        await p.waitForTimeout(200);
        times.push(...(await p.evaluate(() => window.__chunks.slice())));
      }
      all.push(...times);
      console.log(`${name.padEnd(10)} zoom ${zoom}: ${stats(times)}`);
      if (process.env.PERFIL) {
        const pf = await p.evaluate(() => { const r = window.__perfil; window.__perfil = {}; return r; });
        const total = times.reduce((a, c) => a + c, 0);
        console.log('   ' + Object.entries(pf).sort((a, c) => c[1] - a[1]).map(([k, v]) => `${k} ${(v / times.length).toFixed(2)}`).join(' | ') + ` | (por pedaço, de ${(total / times.length).toFixed(1)} ms)`);
      }
    } else {
      const data = await p.evaluate(() => document.getElementById('tela').toDataURL('image/png'));
      fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
      console.log('foto', name, '|', stats(await p.evaluate(() => window.__chunks.slice())));
    }
  }
  if (process.env.CUSTO || process.env.DIRETO) console.log('GERAL:', stats(all));
  const errs = pe.concat(await p.evaluate(() => window.__erros));
  console.log(errs.length ? 'ERROS: ' + errs.slice(0, 4).join(' || ') : 'sem erros');
  await b.close();
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
