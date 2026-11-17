// Fotos do CHÃO no jogo de verdade: leva o herói a um ponto, espera tudo ficar pronto e copia o canvas do jogo.
// Uso: node chao-foto.cjs <url> <saida.png> [x,y] [zoom do jogador] [largura,altura] [noite]
//   VARIOS="nome:x,y;nome:x,y"  várias fotos de uma vez (saida vira pasta)
const { chromium } = require('playwright');
const fs = require('fs');
const { entrar, levar, cenaLimpa } = require('./zoom-comum.cjs');
(async () => {
  const [, , base = 'http://localhost:3000', out = 'chao.png', posArg = '31.5,46.5', zoomArg = '1', tela = '1600,900', noite = ''] = process.argv;
  const [W, H] = tela.split(',').map(Number);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.DPR || 1) });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 2).join(' | ')));
  const id = await entrar(p, base);
  await levar(base, id, 37, 35);
  await p.waitForTimeout(2000);
  if (!noite) await cenaLimpa(p);
  else { await p.keyboard.press('g'); await p.waitForTimeout(300); await p.evaluate(() => { for (const t of ['Virar noite', 'Derrubar monstros perto']) { const bt = [...document.querySelectorAll('#gm-panel button')].find((x) => x.textContent.trim() === t); if (bt) bt.click(); } }); await p.keyboard.press('g'); }
  await p.evaluate((z) => { const v = window.PD.view; v.setWind(0, 0); v.setWind = () => {}; }, 0);
  // o zoom do jogador pela roda (o motor guarda): vai ao mais longe e aproxima até passar do pedido
  await p.mouse.move(W / 2, H / 2 - 150);
  for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 100); await p.waitForTimeout(40); }
  for (let i = 0; i < 12; i++) { const z = await p.evaluate(() => window.PD.view.zoomUser); if (z >= +zoomArg - 0.02) break; await p.mouse.wheel(0, -100); await p.waitForTimeout(60); }
  const spots = process.env.VARIOS ? process.env.VARIOS.split(';').map((s) => { const [n, xy] = s.split(':'); return { n, xy: xy.split(',').map(Number) }; }) : [{ n: '', xy: posArg.split(',').map(Number) }];
  if (process.env.VARIOS) fs.mkdirSync(out, { recursive: true });
  for (const s of spots) {
    console.log('levar:', await levar(base, id, s.xy[0], s.xy[1]));
    await p.waitForTimeout(1500);
    // espera o chão e as imagens ficarem prontos
    await p.waitForFunction(() => { const w = window.PD.view.world; const g = w.ground; return !g.pending && !g.old && !w._stale; }, null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const data = await p.evaluate(() => window.PD.view.canvas.toDataURL('image/png'));
    const file = process.env.VARIOS ? `${out}/${s.n}.png` : out;
    fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log('foto', file, '| zoom do jogador', await p.evaluate(() => window.PD.view.zoomUser), '| herói', JSON.stringify(await p.evaluate(() => ({ x: +window.__mundoNovo.me.x.toFixed(1), y: +window.__mundoNovo.me.y.toFixed(1) }))));
  }
  console.log(errors.length ? 'ERROS: ' + errors.join(' || ') : 'sem erros');
  await b.close();
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
