// Exporta a FICHA COMPLETA de um personagem (js/tools/ficha.js) para uma pasta: as 8 direções na pose A (PNG de fundo
// transparente, mesma escala e mesmo ponto dos pés), o corpo-base, cada peça de roupa isolada, as pranchas de
// conferência e as medidas do modelo.
// Uso: node ferramentas/ficha-exportar.cjs <pasta> [--modelo birim] [--tamanho 2048] [--escala 8] [--inclinacao 0]
//   <pasta>/TURNAROUND/01_frente.png ... 08_diagonal_esquerda.png        (câmera reta, na altura dele: `--inclinacao`, padrão 0°;
//                                                                         assim a altura de cada junta é a mesma nas 8 direções)
//   <pasta>/CAMERA_DO_JOGO/01_frente.png ...                             (a câmera do jogo, 30°)
//   <pasta>/MODELO_BASE/corpo_base/...   e   MODELO_BASE/pecas/<peça>/...
//   <pasta>/DOCUMENTACAO/prancha_8_direcoes.png, prancha_camera_do_jogo.png, teste_de_equipamento.png, medidas.json
// Escala 8 px/cm num quadro de 2048: sobra espaço em volta para as animações (braços abertos e erguidos cabem).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..') + '/';
const SCRIPTS = ['js/core/math.js', 'js/core/iso.js', 'js/core/shapes.js', 'js/character/body.js', 'js/character/rig.js', 'js/character/animator.js', 'js/character/renderer.js',
  'js/character/equipment.js', 'js/character/classes.js', 'js/character/birim.js', 'js/tools/ficha.js'];

(async () => {
  const argv = process.argv.slice(2);
  const o = { saida: null, modelo: 'birim', tamanho: 2048, escala: 8, inclinacao: 0, ancora: 0.88 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--modelo') o.modelo = argv[++i];
    else if (a === '--tamanho') o.tamanho = parseInt(argv[++i], 10);
    else if (a === '--escala') o.escala = parseFloat(argv[++i]);
    else if (a === '--inclinacao') o.inclinacao = parseFloat(argv[++i]);
    else if (a === '--ancora') o.ancora = parseFloat(argv[++i]);
    else if (!o.saida) o.saida = a;
    else throw new Error('opção desconhecida: ' + a);
  }
  if (!o.saida) throw new Error('falta a pasta de saída');
  const out = path.resolve(o.saida);
  const tags = SCRIPTS.map((s) => `<script src="file://${ROOT}${s}"></script>`).join('\n');
  const tmp = path.join(require('os').tmpdir(), `ficha-exportar-${process.pid}.html`);
  fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222">${tags}`);
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 4).join(' | ')));
  await page.goto('file://' + tmp);
  await page.waitForFunction(() => window.PD && window.PD.ficha, null, { timeout: 30000 });
  const info = await page.evaluate((o) => ({ dirs: PD.ficha.DIRECOES, pecas: PD.ficha.PECAS, resumo: PD.ficha.resumo(o.modelo), medidas: PD.ficha.medidas({ inclinacao: o.inclinacao, pxPorCm: o.escala }) }), o);
  const b64 = (u) => Buffer.from(u.split(',')[1], 'base64');
  const draw = (graus, extra) => page.evaluate(([o, graus, extra]) => {
    const c = document.createElement('canvas');
    c.width = c.height = o.tamanho;
    PD.ficha.desenhar(c, { modelo: o.modelo, graus, inclinacao: o.inclinacao, pxPorCm: o.escala, ancora: { x: o.tamanho / 2, y: o.tamanho * o.ancora }, ...extra });
    return c.toDataURL('image/png');
  }, [o, graus, extra || {}]);
  const save = async (dir, extra) => {
    fs.mkdirSync(path.join(out, dir), { recursive: true });
    for (const d of info.dirs) fs.writeFileSync(path.join(out, dir, d.arquivo + '.png'), b64(await draw(d.graus, extra)));
    console.log('  ', dir, '—', info.dirs.length, 'arquivos');
  };
  await save('TURNAROUND');
  await save('CAMERA_DO_JOGO', { inclinacao: 30 });
  const todas = Object.values(info.pecas).map((p) => p.sem);
  await save('MODELO_BASE/corpo_base', { sem: todas });
  for (const [nome, p] of Object.entries(info.pecas)) await save('MODELO_BASE/pecas/' + nome, { so: p.nomes });
  // pranchas de conferência (as 8 direções lado a lado, com o nome de cada uma)
  fs.mkdirSync(path.join(out, 'DOCUMENTACAO'), { recursive: true });
  for (const [nome, incl, titulo] of [['prancha_8_direcoes', o.inclinacao, o.inclinacao ? `câmera a ${o.inclinacao}°` : 'câmera reta (0°)'], ['prancha_camera_do_jogo', 30, 'câmera do jogo (30°)']]) {
    const url = await page.evaluate(([o, incl, titulo]) => {
      const W = 640, H = 900, cols = 4, pad = 54;
      const chao = incl > 15 ? 0.87 : 0.93; // (com a câmera de cima, o pé de cá desce na imagem: o chão fica mais alto no quadro)
      const sheet = document.createElement('canvas');
      sheet.width = cols * W;
      sheet.height = 2 * (H + pad) + 70;
      const x = sheet.getContext('2d');
      x.fillStyle = '#2b2b2e';
      x.fillRect(0, 0, sheet.width, sheet.height);
      x.fillStyle = '#f2e9d8';
      x.font = 'bold 30px sans-serif';
      x.fillText(`${o.modelo.toUpperCase()} — 8 direções do mesmo modelo, ${titulo}, mesma escala e mesmo ponto dos pés`, 24, 46);
      PD.ficha.DIRECOES.forEach((d, k) => {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        PD.ficha.desenhar(c, { modelo: o.modelo, graus: d.graus, inclinacao: incl, pxPorCm: 4.6, ancora: { x: W / 2, y: H * chao } });
        const ox = (k % cols) * W, oy = 70 + Math.floor(k / cols) * (H + pad);
        x.fillStyle = k % 2 ? '#47474b' : '#4f4f53';
        x.fillRect(ox, oy, W, H);
        x.drawImage(c, ox, oy);
        // a linha do chão (o ponto dos pés é o mesmo em todas)
        x.fillStyle = 'rgba(255, 255, 255, 0.35)';
        x.fillRect(ox, oy + Math.round(H * chao), W, 1);
        x.fillStyle = '#f2e9d8';
        x.font = '24px sans-serif';
        x.fillText(`${d.arquivo.replace(/_/g, ' ')} · ${d.graus}°`, ox + 16, oy + H + 36);
      });
      return sheet.toDataURL('image/png');
    }, [o, incl, titulo]);
    fs.writeFileSync(path.join(out, 'DOCUMENTACAO', nome + '.png'), b64(url));
  }
  // o teste de equipamento: peças de teste nos quatro encaixes de roupa (o boné, a bermuda e os chinelos dele saem)
  {
    const url = await page.evaluate(([o]) => {
      const W = 640, H = 900, pad = 54;
      const views = [[0, 'sem equipamento', null], [0, 'com as peças de teste', 1], [45, 'com as peças de teste', 1], [180, 'com as peças de teste', 1]];
      const sheet = document.createElement('canvas');
      sheet.width = views.length * W;
      sheet.height = H + pad + 70;
      const x = sheet.getContext('2d');
      x.fillStyle = '#2b2b2e';
      x.fillRect(0, 0, sheet.width, sheet.height);
      x.fillStyle = '#f2e9d8';
      x.font = 'bold 30px sans-serif';
      x.fillText(`${o.modelo.toUpperCase()} — teste dos encaixes: capacete, camiseta, calça e bota DE TESTE (não são peças do jogo)`, 24, 46);
      const gear = PD.ficha.pecasDeTeste(o.modelo);
      views.forEach(([graus, texto, vestir], k) => {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        PD.ficha.desenhar(c, { modelo: o.modelo, graus, inclinacao: 0, pxPorCm: 4.6, ancora: { x: W / 2, y: H * 0.93 }, equipado: vestir ? gear : undefined });
        x.fillStyle = k % 2 ? '#47474b' : '#4f4f53';
        x.fillRect(k * W, 70, W, H);
        x.drawImage(c, k * W, 70);
        x.fillStyle = '#f2e9d8';
        x.font = '24px sans-serif';
        x.fillText(`${graus}° · ${texto}`, k * W + 16, 70 + H + 36);
      });
      return sheet.toDataURL('image/png');
    }, [o]);
    fs.writeFileSync(path.join(out, 'DOCUMENTACAO', 'teste_de_equipamento.png'), b64(url));
  }
  fs.writeFileSync(path.join(out, 'DOCUMENTACAO', 'medidas.json'), JSON.stringify({ exportacao: { modelo: o.modelo, tamanhoPx: o.tamanho, pxPorCm: o.escala, inclinacaoGraus: o.inclinacao, ancora: { x: o.tamanho / 2, y: Math.round(o.tamanho * o.ancora) } }, ...info.resumo, esqueletoNaTelaPorDirecao: info.medidas }, null, 2));
  console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'sem erros');
  await browser.close();
  fs.unlinkSync(tmp);
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
