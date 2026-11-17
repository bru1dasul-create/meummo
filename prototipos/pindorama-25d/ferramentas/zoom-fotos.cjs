// Fotos do zoom da conversa e de dentro/fora de casa, para conferir a IMAGEM (nada borrado, nada fora do lugar, sem
// buraco no chão). Em cada parada compara-se com a "referência": a mesma cena depois de jogar fora TODAS as imagens
// guardadas e deixar o jogo refazer tudo do zero (`zoom-fotos-comparar.py`).
// Uso: node zoom-fotos.cjs conversa [url] <pasta de saída> [npc: budega | curupira] [largura,altura]
//        fotos: 1-antes, 2-meio-a, 2-meio-b, 3-chegou, 4-conversa (+ -ref), a volta, 6-voltou, 7-depois (+ -ref)
//        SEM_REF=1: sem as referências e com a VOLTA de 90 em 90 ms (a referência joga fora o que está guardado, e aí
//        a volta não é mais a de verdade). Tela com menos de 950 px de largura = celular (toque, 2 pixels por ponto).
//      node zoom-fotos.cjs casa [url] <pasta de saída>
//        dentro da Budega a roda aproxima; o herói sai andando; a roda afasta e ele entra de novo (4 paradas + -ref)
// Precisa do jogo ligado (`npm run build && npm start`) no mesmo computador.
const { chromium } = require('playwright');
const fs = require('fs');
const { entrar, levar, cenaLimpa, acharNpc } = require('./zoom-comum.cjs');
(async () => {
  const [, , modo = 'conversa', base = 'http://localhost:3000', out = '.', tipo = 'budega', tela = '1600,900'] = process.argv;
  const [W, H] = modo === 'casa' ? [1600, 900] : tela.split(',').map(Number);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const mobile = W < 950;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 2).join(' | ')));
  const id = await entrar(p, base);
  await levar(base, id, 37, 35);
  await p.waitForTimeout(2500);
  if (!mobile) await cenaLimpa(p);
  // sem vento (as copas param): a comparação com a referência fica limpa
  await p.evaluate(() => { const v = window.PD.view; v.setWind(0, 0); v.setWind = () => {}; });
  const state = () => p.evaluate(() => {
    const v = window.PD.view, w = v.world, cam = v.cam;
    const view = { x0: cam.viewX, y0: cam.viewY, x1: cam.viewX + cam.viewW, y1: cam.viewY + cam.viewH };
    const ov = (a, c) => a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1;
    const all = w.props.concat(w.flats || []);
    return { zoom: +cam.zoom.toFixed(3), dentro: !!w.insideHouse, escuro: !!w._dimHome, doisZooms: w.keepLevels, adiantando: w.ahead ? +w.ahead.zoom.toFixed(3) : null,
      velhasQueAparecem: w.props.filter((o) => o.sprite && !o.spriteReady && o.shown !== false && !(w.dimmed && w.dimmed(o)) && ov(o.bounds, view)).length,
      guardadas: all.filter((o) => o.spriteAlt).length, imagens: all.filter((o) => o.sprite).length,
      memMB: Math.round((all.reduce((n, o) => n + (o.sprite ? o.sprite.c.width * o.sprite.c.height : 0) + (o.spriteAlt ? o.spriteAlt.c.width * o.spriteAlt.c.height : 0), 0) * 4) / 1e6),
      chao: w.ground.cache.size, chaoGuardado: w.ground.kept ? [...w.ground.kept.values()].map((k) => k.cache.size) : null };
  });
  // (só o canvas do jogo: a interface por cima atrapalha a comparação)
  const shot = async (name) => { const data = await p.evaluate(() => window.PD.view.canvas.toDataURL('image/png')); fs.writeFileSync(`${out}/${name}.png`, Buffer.from(data.split(',')[1], 'base64')); };
  const reference = async (name) => {
    if (process.env.SEM_REF) return;
    // joga fora tudo o que está guardado (objetos e chão) e deixa refazer do zero, neste zoom
    await p.evaluate(() => { const w = window.PD.view.world; for (const o of w.props.concat(w.flats || [])) { if (o.dropSprite) o.dropSprite(); } const g = w.ground; if (g.kept) g.kept.clear(); g.cache = new Map(); g.old = null; g.pending = true; });
    await p.waitForTimeout(3500);
    await shot(name);
  };
  const stop = async (name) => { console.log(name.padEnd(20), JSON.stringify(await state())); await shot(name); await reference(name + '-ref'); };
  const wheel = async (dy, n) => { for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy); await p.waitForTimeout(60); } };
  const walk = async (x, y) => { await p.evaluate(([a, c]) => window.__mundoNovo.walkTo(a, c), [x, y]); await p.waitForFunction(() => !window.__mundoNovo.walking(), null, { timeout: 15000 }); };
  if (modo === 'casa') {
    await p.mouse.move(800, 300);
    await wheel(100, 10);
    await levar(base, id, 67, 52);
    await p.waitForTimeout(4000);
    await stop('1-dentro');
    await wheel(-100, 3);
    await p.waitForTimeout(2500);
    await stop('2-dentro-zoom');
    // (sem a referência entre um e outro: ele sai com o que ficou guardado de verdade)
    await wheel(100, 3); await p.waitForTimeout(2500);
    await wheel(-100, 3); await p.waitForTimeout(1500);
    await walk(67, 57.5);
    await p.waitForTimeout(2800);
    await stop('3-fora');
    await wheel(100, 3);
    await p.waitForTimeout(2500);
    await walk(67, 52);
    await p.waitForTimeout(2500);
    await stop('4-entrou-de-novo');
  } else {
    const npc = await acharNpc(p, tipo);
    const near = process.env.PERTO ? process.env.PERTO.split(',').map(Number) : [Math.round(npc.x), Math.round(npc.y) + 2];
    console.log('alvo:', JSON.stringify(npc), '| levar:', await levar(base, id, near[0], near[1]));
    await p.waitForTimeout(3500);
    console.log('1-antes'.padEnd(20), JSON.stringify(await state()));
    await shot('1-antes');
    const s = await p.evaluate(([x, y]) => window.__mundoNovo.screenOf(x, y), [npc.x, npc.y]);
    if (mobile) await p.touchscreen.tap(s.x, s.y - 30); else await p.mouse.click(s.x, s.y - 30);
    await p.waitForTimeout(200); await shot('2-meio-a');
    await p.waitForTimeout(150); await shot('2-meio-b');
    await p.waitForTimeout(250); await shot('3-chegou');
    console.log('3-chegou'.padEnd(20), JSON.stringify(await state()));
    await p.waitForTimeout(2400);
    await stop('4-conversa');
    if (mobile) await p.evaluate(() => { const bt = [...document.querySelectorAll('.shop-close')].find((x) => x.offsetParent !== null); if (bt) bt.click(); });
    else await p.keyboard.press('Escape');
    if (process.env.SEM_REF) {
      for (let i = 1; i <= 7; i++) { await p.waitForTimeout(90); await shot('5-volta-' + i); }
      await p.waitForTimeout(70);
    } else {
      await p.waitForTimeout(250); await shot('5-volta-meio');
      await p.waitForTimeout(450);
    }
    await shot('6-voltou');
    console.log('6-voltou'.padEnd(20), JSON.stringify(await state()));
    await p.waitForTimeout(2400);
    await stop('7-depois');
  }
  console.log(errors.length ? 'ERROS: ' + errors.join(' || ') : 'sem erros');
  await b.close();
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
