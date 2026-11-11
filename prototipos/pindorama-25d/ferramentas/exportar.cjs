// Exporta os sprites padronizados do personagem (js/tools/export.js) para uma pasta: PNGs + manifest.json.
// Uso: node ferramentas/exportar.cjs <pasta de saída> [--animacoes parado,andar] [--direcoes s,n] [--partes]
//        [--partes-de parado,andar] [--escala 2] [--classe semClasse] [--prancha prancha.png]
// Sem opções: todas as animações, nas 8 direções, sem partes, a 2 px por cm.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const url = require('url');

function args(argv) {
  const o = { saida: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--animacoes') o.animacoes = next().split(',');
    else if (a === '--direcoes') o.direcoes = next().split(',');
    else if (a === '--partes') o.partes = true;
    else if (a === '--partes-de') o.partes = next().split(',');
    else if (a === '--escala') o.pxPorCm = parseFloat(next());
    else if (a === '--classe') o.classe = next();
    else if (a === '--prancha') o.prancha = next();
    else if (!o.saida) o.saida = a;
    else throw new Error('opção desconhecida: ' + a);
  }
  if (!o.saida) throw new Error('falta a pasta de saída (veja o começo do arquivo)');
  return o;
}

(async () => {
  const o = args(process.argv.slice(2));
  const out = path.resolve(o.saida);
  fs.mkdirSync(path.join(out, 'sprites'), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url.pathToFileURL(path.join(__dirname, '..', 'exportar.html')).href);
  await page.waitForFunction(() => window.__exportReady);
  const t0 = Date.now();
  const opts = { classe: o.classe, pxPorCm: o.pxPorCm, animacoes: o.animacoes, direcoes: o.direcoes, partes: o.partes };
  const info = await page.evaluate(async (opts) => {
    const r = await PD.exporter.gerar(opts);
    window.__out = r;
    return { manifest: r.manifest, n: r.arquivos.length };
  }, opts);
  for (let i = 0; i < info.n; i += 40) {
    const lote = await page.evaluate(([i, j]) => window.__out.arquivos.slice(i, j).map((f) => ({ nome: f.nome, b64: f.canvas.toDataURL('image/png').split(',')[1] })), [i, i + 40]);
    for (const f of lote) fs.writeFileSync(path.join(out, 'sprites', f.nome), Buffer.from(f.b64, 'base64'));
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(info.manifest, null, 1));
  if (o.prancha) {
    // prancha de conferência: o quadro 0 de cada animação × direção, com a âncora marcada
    const png = await page.evaluate(() => {
      const r = window.__out;
      const m = r.manifest;
      const anims = m.animacoes.map((a) => a.nome);
      const dirs = m.direcoes.map((d) => d.nome);
      const s = 0.5;
      const w = Math.round(m.quadro.largura * s), h = Math.round(m.quadro.altura * s);
      const c = document.createElement('canvas');
      c.width = w * dirs.length + 90;
      c.height = h * anims.length + 20;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#e9e3d6';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#000';
      dirs.forEach((d, j) => ctx.fillText(d, 90 + j * w + w / 2 - 6, 14));
      anims.forEach((a, i) => {
        ctx.fillStyle = '#000';
        ctx.fillText(a, 4, 20 + i * h + h / 2);
        dirs.forEach((d, j) => {
          const q = m.quadros.find((q) => q.animacao === a && q.direcao === d && q.quadro === 0);
          const f = q && r.arquivos.find((f) => f.nome === q.arquivo);
          const x = 90 + j * w, y = 20 + i * h;
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
          if (f) ctx.drawImage(f.canvas, x, y, w, h);
          ctx.strokeStyle = '#d0302a';
          ctx.beginPath();
          ctx.moveTo(x + m.ancora.x * s - 5, y + m.ancora.y * s);
          ctx.lineTo(x + m.ancora.x * s + 5, y + m.ancora.y * s);
          ctx.moveTo(x + m.ancora.x * s, y + m.ancora.y * s - 5);
          ctx.lineTo(x + m.ancora.x * s, y + m.ancora.y * s + 5);
          ctx.stroke();
        });
      });
      return c.toDataURL('image/png').split(',')[1];
    });
    fs.writeFileSync(path.resolve(o.prancha), Buffer.from(png, 'base64'));
  }
  await browser.close();
  const m = info.manifest;
  console.log(`${info.n} imagens em ${path.join(out, 'sprites')} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  console.log(`quadro ${m.quadro.largura}×${m.quadro.altura} px · ${m.pxPorCm} px/cm · âncora (${m.ancora.x}, ${m.ancora.y})`);
  for (const a of m.animacoes) console.log(`  ${a.nome.padEnd(14)} ${String(a.quadros).padStart(2)} quadros · ${a.duracaoSeg.toFixed(2)} s · ${a.fps} qps · ${a.repete ? 'repete' : 'uma vez'} · anda ${a.deslocamentoCm} cm${a.movimentoNoSprite ? ' (desenhado no sprite)' : ` (${a.velocidadeCmPorSeg} cm/s no jogo)`}`);
  console.log(errors.length ? 'ERROS: ' + errors.join('\n') : 'sem erros');
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
