// A RODA do mouse (o zoom do jogador) e os Olhos de Gavião: os quadros enquanto o zoom muda e QUANTO TEMPO a imagem
// leva para ficar nítida de novo (nenhuma imagem velha esticada na tela e o chão inteiro refeito).
// Uso: node zoom-roda.cjs [url] [largura,altura] [x,y do herói] [saída.json]
//   SEM_GAVIAO=1  pula os Olhos de Gavião (o herói de teste precisa ser Caçador com a habilidade: NOME e SENHA
//                 escolhem outro personagem — veja o zoom-comum.cjs)
// Precisa do jogo ligado (`npm run build && npm start`) no mesmo computador.
const { chromium } = require('playwright');
const { entrar, levar, cenaLimpa } = require('./zoom-comum.cjs');
(async () => {
  const [, , base = 'http://localhost:3000', tela = '1600,900', posArg = '37,35', outJson = ''] = process.argv;
  const [W, H] = tela.split(',').map(Number);
  const pos = posArg.split(',').map(Number);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 2).join(' | ')));
  const id = await entrar(p, base);
  await levar(base, id, pos[0], pos[1]);
  await p.waitForTimeout(2500);
  await cenaLimpa(p);
  await p.mouse.move(W / 2, H / 2 - 120);
  // começa sempre do zoom "longe" (0,7)
  for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 100); await p.waitForTimeout(40); }
  await p.waitForTimeout(6000);
  await p.evaluate(() => {
    const v = window.PD.view;
    const w = v.world;
    const rec = (window.__rec = { frames: [] });
    const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const frame = v.frame.bind(v);
    v.frame = function (now) {
      const t0 = performance.now();
      const r = frame(now);
      const cam = v.cam;
      const view = { x0: cam.viewX, y0: cam.viewY, x1: cam.viewX + cam.viewW, y1: cam.viewY + cam.viewH };
      // imagem velha (esticada) de quem aparece de verdade: fora os móveis de casa fechada e o que está no escuro
      let velhas = 0;
      for (const o of w.props) if (o.sprite && !o.spriteReady && o.shown !== false && !(w.dimmed && w.dimmed(o)) && !(o.house && !((o.house.cutK || 0) > 0)) && overlap(o.bounds, view)) velhas++;
      const g = w.ground;
      rec.frames.push({ at: t0, zoom: cam.zoom, velhas, chao: !!(g.pending || g.old), built: w._built || 0, buildMs: w._buildMs || 0 });
      return r;
    };
  });
  const phase = async (name, act, waitMs) => {
    await p.evaluate(() => { window.__rec.frames = []; });
    await p.waitForTimeout(600);
    const t1 = await p.evaluate(() => performance.now());
    await act();
    await p.waitForTimeout(waitMs);
    const t3 = await p.evaluate(() => performance.now());
    const frames = await p.evaluate(() => window.__rec.frames.slice());
    const st = (from, to) => {
      const f = frames.filter((x) => x.at >= from && x.at < to);
      const gaps = f.slice(1).map((x, i) => x.at - f[i].at);
      const s = gaps.slice().sort((a, c) => a - c);
      const avg = gaps.length ? gaps.reduce((a, c) => a + c, 0) / gaps.length : 0;
      return { quadros: f.length, media: +avg.toFixed(1), p95: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(0), pior: +(s[s.length - 1] || 0).toFixed(0), acima60: gaps.filter((g) => g > 60).length, acima80: gaps.filter((g) => g > 80).length };
    };
    // nítido: o primeiro quadro, depois da última mudança de zoom, sem imagem velha na tela e com o chão inteiro
    let lastChange = t1;
    for (let i = 1; i < frames.length; i++) if (Math.abs(frames[i].zoom - frames[i - 1].zoom) > 1e-5) lastChange = frames[i].at;
    const sharp = frames.find((x) => x.at > lastChange && x.velhas === 0 && !x.chao);
    const res = { nome: name, mudando: st(t1, lastChange + 1), assentando: st(lastChange + 1, sharp ? sharp.at + 1 : t3), nitidoMs: sharp ? Math.round(sharp.at - lastChange) : null, zoom: +frames[frames.length - 1].zoom.toFixed(3), imagens: frames.reduce((n, x) => n + x.built, 0), imagensMs: Math.round(frames.reduce((n, x) => n + x.buildMs, 0)) };
    console.log(`${name}: zoom da câmera no fim ${res.zoom} | mudando: ${JSON.stringify(res.mudando)} | até ficar nítido: ${res.nitidoMs === null ? 'NÃO ficou em ' + waitMs + ' ms' : res.nitidoMs + ' ms'} ${JSON.stringify(res.assentando)} | imagens ${res.imagens} (${res.imagensMs} ms)`);
    return res;
  };
  const wheel = (dy, n) => async () => { for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy); await p.waitForTimeout(60); } };
  const out = [];
  out.push(await phase('roda aproximando (0,7 → 1,4)', wheel(-100, 8), 7000));
  out.push(await phase('roda afastando (1,4 → 0,7)', wheel(100, 8), 7000));
  out.push(await phase('roda aproximando de novo', wheel(-100, 8), 7000));
  out.push(await phase('roda afastando de novo', wheel(100, 8), 7000));
  // Olhos de Gavião (T): a câmera afasta por uns segundos e volta
  const hawk = await p.evaluate(() => { const h = window.__mundoNovo.hero && window.__mundoNovo.hero(); return !!(h && h.skills && h.skills.olhos_de_gaviao); });
  if (process.env.SEM_GAVIAO || !hawk) console.log('Olhos de Gavião: pulado' + (hawk ? '' : ' (este herói não tem a habilidade)'));
  else {
    out.push(await phase('Olhos de Gavião (T): afasta', async () => { await p.keyboard.press('t'); await p.waitForTimeout(700); }, 3000));
    out.push(await phase('Olhos de Gavião: acaba e volta', async () => { await p.waitForTimeout(100); }, 12000));
  }
  if (outJson) require('fs').writeFileSync(outJson, JSON.stringify({ out, errors }));
  console.log(errors.length ? 'ERROS: ' + errors.join(' || ') : 'sem erros');
  await b.close();
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
