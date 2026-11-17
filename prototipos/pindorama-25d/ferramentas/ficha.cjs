// A FICHA de um personagem (js/tools/ficha.js): o mesmo modelo na pose A, visto de uma ou mais direções, em PNG de
// fundo transparente. Serve para conferir o desenho de perto e para exportar as 8 direções.
// Uso: node ferramentas/ficha.cjs <saida.png | pasta> [opções]
//   --modelo birim          o personagem (sem isto: o herói)
//   --graus 0,45,90         as direções (0 = frente; 90 = lado direito dele); sem isto: as oito
//   --inclinacao 0          a câmera: 0 = reta, de frente (ficha clássica); 30 = a câmera do jogo
//   --escala 4              pontos por centímetro (o personagem tem ~173 cm)
//   --tamanho 1024x1280     o tamanho de cada quadro
//   --fundo "#7c8088"       cor de fundo (sem isto: transparente)
//   --pes 23 --braco 32     a abertura da pose A (cm do meio até cada pé; graus do braço)
//   --solto                 em vez de uma prancha, um arquivo por direção, com o nome de cada uma, na pasta dada
//   --medidas               imprime as medidas do esqueleto em cada direção (para conferir que são as mesmas)
//   --vestir-teste cabeca,tronco,pernas,pes   veste as peças de teste nesses encaixes (confere os equipamentos)
//   --sem bone,bermuda      tira peças do próprio modelo (o corpo-base);  --so bermuda,bolsoCargo  desenha só essas
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..') + '/';
const SCRIPTS = ['js/core/math.js', 'js/core/iso.js', 'js/core/shapes.js', 'js/character/body.js', 'js/character/rig.js', 'js/character/animator.js', 'js/character/renderer.js',
  'js/character/equipment.js', 'js/character/classes.js', 'js/character/birim.js', 'js/tools/ficha.js'];

function args(argv) {
  const o = { saida: null, escala: 4, inclinacao: 0, tamanho: [1024, 1280] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--modelo') o.modelo = next();
    else if (a === '--graus') o.graus = next().split(',').map(Number);
    else if (a === '--inclinacao') o.inclinacao = parseFloat(next());
    else if (a === '--escala') o.escala = parseFloat(next());
    else if (a === '--tamanho') o.tamanho = next().split('x').map(Number);
    else if (a === '--fundo') o.fundo = next();
    else if (a === '--pes') o.pes = parseFloat(next());
    else if (a === '--braco') o.braco = parseFloat(next());
    else if (a === '--ancora') o.ancoraY = parseFloat(next());
    else if (a === '--sem') o.sem = next().split(',');
    else if (a === '--so') o.so = next().split(',');
    else if (a === '--torcao') o.torcao = parseFloat(next());
    else if (a === '--traco') o.traco = parseFloat(next());
    else if (a === '--solto') o.solto = true;
    else if (a === '--medidas') o.medidas = true;
    else if (a === '--colunas') o.colunas = parseInt(next(), 10);
    else if (a === '--vestir-teste') o.vestirTeste = next().split(','); // encaixes a vestir com as peças de teste (cabeca,tronco,pernas,pes)
    else if (!o.saida) o.saida = a;
    else throw new Error('opção desconhecida: ' + a);
  }
  if (!o.saida) throw new Error('falta o arquivo (ou a pasta) de saída');
  return o;
}

(async () => {
  const o = args(process.argv.slice(2));
  const tags = SCRIPTS.map((s) => `<script src="file://${ROOT}${s}"></script>`).join('\n');
  const tmp = path.join(require('os').tmpdir(), `ficha-${process.pid}.html`);
  fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222">${tags}`);
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 4).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + tmp);
  await page.waitForFunction(() => window.PD && window.PD.ficha, null, { timeout: 30000 });
  const out = await page.evaluate((o) => {
    const dirs = PD.ficha.DIRECOES.filter((d) => !o.graus || o.graus.includes(d.graus));
    const [W, H] = o.tamanho;
    const frames = [];
    let equipado;
    if (o.vestirTeste) {
      const todas = PD.ficha.pecasDeTeste(o.modelo);
      equipado = Object.fromEntries(o.vestirTeste.filter((k) => todas[k]).map((k) => [k, todas[k]]));
    }
    for (const d of dirs) {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      PD.ficha.desenhar(c, { modelo: o.modelo, graus: d.graus, inclinacao: o.inclinacao, pxPorCm: o.escala, fundo: o.fundo, pes: o.pes, braco: o.braco, torcao: o.torcao, traco: o.traco, sem: o.sem, so: o.so, equipado, ancora: { x: W / 2, y: H * (o.ancoraY || 0.94) } });
      frames.push({ arquivo: d.arquivo, nome: d.nome, canvas: c });
    }
    const res = { medidas: o.medidas ? PD.ficha.medidas({ inclinacao: o.inclinacao, pxPorCm: o.escala, pes: o.pes, braco: o.braco }) : null };
    if (o.solto) res.arquivos = frames.map((f) => ({ arquivo: f.arquivo, url: f.canvas.toDataURL('image/png') }));
    else {
      const cols = o.colunas || Math.min(4, frames.length);
      const rows = Math.ceil(frames.length / cols);
      const sheet = document.createElement('canvas');
      sheet.width = cols * W;
      sheet.height = rows * H;
      const x = sheet.getContext('2d');
      frames.forEach((f, k) => x.drawImage(f.canvas, (k % cols) * W, Math.floor(k / cols) * H));
      res.prancha = sheet.toDataURL('image/png');
    }
    return res;
  }, o);
  const b64 = (u) => Buffer.from(u.split(',')[1], 'base64');
  if (o.solto) {
    fs.mkdirSync(o.saida, { recursive: true });
    for (const f of out.arquivos) fs.writeFileSync(path.join(o.saida, f.arquivo + '.png'), b64(f.url));
    console.log(out.arquivos.length, 'arquivos em', o.saida);
  } else {
    fs.writeFileSync(o.saida, b64(out.prancha));
    console.log('prancha em', o.saida);
  }
  if (out.medidas) {
    const keys = Object.keys(out.medidas[0]).filter((k) => k !== 'direcao');
    console.log(['direção'.padEnd(34)].concat(keys.map((k) => k.padStart(9).slice(-9))).join(' '));
    for (const m of out.medidas) console.log([m.direcao.padEnd(34)].concat(keys.map((k) => m[k].toFixed(2).padStart(9))).join(' '));
  }
  console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'sem erros');
  await browser.close();
  fs.unlinkSync(tmp);
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
