// Quanta MEMÓRIA as imagens prontas ocupam (MB, 4 bytes por pixel): as dos objetos (a de agora e a guardada de outro
// zoom), a casa cortada e o chão (o de agora e os guardados), ao longo de: parado no zoom longe; a roda até o zoom
// perto; a roda de volta; 49 s depois (as guardadas vencem 20 s depois da última mudança de zoom); andando 11 m; e uma
// conversa com o Curupira (parado ao lado dele, com o zoom de perto adiantado; na conversa; e 25 s depois, longe).
// Uso: node zoom-memoria.cjs [url]      (precisa do jogo ligado: `npm run build && npm start`)
const { chromium } = require('playwright');
const { entrar, levar, acharNpc } = require('./zoom-comum.cjs');
(async () => {
  const [, , base = 'http://localhost:3000'] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const id = await entrar(p, base);
  await levar(base, id, 37, 35);
  await p.waitForTimeout(2500);
  await p.mouse.move(800, 300);
  const wheel = async (dy, n) => { for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy); await p.waitForTimeout(60); } };
  await wheel(100, 10);
  const mem = (label) => p.evaluate((label) => {
    const w = window.PD.view.world;
    const all = w.props.concat(w.flats || []);
    const px = (s) => (s ? s.c.width * s.c.height : 0);
    const mb = (n) => Math.round((n * 4) / 1e6);
    const cur = all.reduce((n, o) => n + px(o.sprite), 0), alt = all.reduce((n, o) => n + px(o.spriteAlt), 0);
    const cut = all.reduce((n, o) => n + px(o._cut) + px(o._cutAlt), 0);
    const g = w.ground;
    const chunk = (m) => [...m.values()].reduce((n, c) => n + c.width * c.height, 0);
    const kept = g.kept ? [...g.kept.values()].reduce((n, l) => n + chunk(l.cache), 0) : 0;
    return `${label}: zoom ${w.cam.zoom.toFixed(2)} | objetos ${mb(cur)} MB (${all.filter((o) => o.sprite).length}) + guardadas ${mb(alt)} MB (${all.filter((o) => o.spriteAlt).length}) + casa cortada ${mb(cut)} | chão ${mb(chunk(g.cache))} MB (${g.cache.size}) + guardado ${mb(kept)} MB | TOTAL ${mb(cur + alt + cut + chunk(g.cache) + kept)} MB`;
  }, label);
  await p.waitForTimeout(7000);
  console.log(await mem('longe, parado      '));
  await wheel(-100, 8);
  await p.waitForTimeout(9000);
  console.log(await mem('perto (roda), 9 s  '));
  await wheel(100, 8);
  await p.waitForTimeout(9000);
  console.log(await mem('longe de novo, 9 s '));
  await p.waitForTimeout(40000);
  console.log(await mem('longe de novo, 49 s'));
  await p.evaluate(() => window.__mundoNovo.walkTo(37, 46));
  await p.waitForFunction(() => !window.__mundoNovo.walking(), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(3000);
  console.log(await mem('andou 11 m         '));
  const npc = await acharNpc(p, process.env.NPC || 'curupira');
  if (npc) {
    await levar(base, id, Math.round(npc.x), Math.round(npc.y) + 2);
    await p.waitForTimeout(9000);
    console.log(await mem('ao lado do NPC, 9 s'));
    const s = await p.evaluate(([x, y]) => window.__mundoNovo.screenOf(x, y), [npc.x, npc.y]);
    await p.mouse.click(s.x, s.y - 30);
    await p.waitForTimeout(4000);
    console.log(await mem('na conversa        '));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(3000);
    console.log(await mem('conversa fechada   '));
    await p.evaluate(([x, y]) => window.__mundoNovo.walkTo(x, y), [npc.x, npc.y + 9]);
    await p.waitForFunction(() => !window.__mundoNovo.walking(), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(25000);
    console.log(await mem('longe dele, 25 s   '));
  }
  await b.close();
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
