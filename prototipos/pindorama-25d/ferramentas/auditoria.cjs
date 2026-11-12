// Auditoria com números (veja js/tools/audit.js): IK, escorregão, ossos, trancos, articulações, interseções,
// equilíbrio, trocas de ordem de desenho e silhueta por zoom, em ~45 roteiros.
// Uso: node auditoria.cjs [pasta do protótipo] [saida.json] [filtro]
//   a pasta pode ser uma versão antiga (para comparar): a auditoria é injetada a partir desta pasta.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const url = require('url');
(async () => {
  const [, , dirArg, outArg, filter] = process.argv;
  const dir = path.resolve(dirArg || path.join(__dirname, '..'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url.pathToFileURL(path.join(dir, 'prancha.html')).href + '?linhas=0');
  await page.waitForFunction(() => window.__sheetReady);
  await page.addScriptTag({ path: path.join(__dirname, '..', 'js', 'tools', 'audit.js') });
  const data = await page.evaluate((only) => PD.audit.runAll({ only: only ? only.split(',') : null }), filter || '');
  if (outArg) fs.writeFileSync(outArg, JSON.stringify(data, null, 1));
  const f1 = (v) => (v === undefined ? '—' : v.toFixed(1));
  const rows = [];
  rows.push(['roteiro', 'IK perna', 'IK braço', 'escorr.', 'tranco br.', 'tranco pern.', 'joelho p/trás', 'cotovelo', 'pior interseção', 'equilíbrio', 'pé no chão']);
  for (const r of data.results) {
    const jk = (re) => Math.max(0, ...Object.keys(r.jerk).filter((k) => re.test(k)).map((k) => r.jerk[k].j));
    const pens = Object.entries(r.pen).sort((a, b) => b[1].d - a[1].d);
    const worst = pens[0] && pens[0][1].d > 0.5 ? `${pens[0][0]} ${pens[0][1].d.toFixed(1)}` : 'nenhuma';
    rows.push([
      r.name,
      f1(r.ik.leg),
      f1(r.ik.arm),
      f1(r.slide),
      f1(jk(/punho|cotovelo|cabeça/)),
      f1(jk(/joelho|tornozelo/)),
      String(r.kneeBack),
      String(r.elbowWrong),
      worst,
      f1(r.balance),
      r.belowGround > 0.3 ? r.belowGround.toFixed(1) + ' abaixo' : 'ok',
    ]);
  }
  const w = rows[0].map((_, c) => Math.max(...rows.map((r) => String(r[c]).length)));
  for (const r of rows) console.log(r.map((v, c) => String(v).padEnd(w[c])).join(' | '));
  const bones = Math.max(...data.results.map((r) => Math.max(...Object.values(r.bones))));
  console.log('\nossos: maior variação de comprimento ' + bones.toFixed(4) + ' cm');
  const worstIK = data.results.reduce((a, r) => (r.ik.leg > a.ik.leg ? r : a));
  console.log(`pior erro do IK da perna: ${worstIK.ik.leg.toFixed(1)} cm em "${worstIK.name}" (t=${worstIK.ik.legT.toFixed(2)} s, ${worstIK.ik.legState})`);
  if (data.pops.length) {
    console.log('\ntrocas de ordem de desenho com as partes se cobrindo (>= 15% da área da menor, na tela):');
    for (const p of data.pops) console.log(`  ${p.name.padEnd(30)} ${String(p.pops).padStart(3)} · perna em pedaços em ${String(Math.round(p.legSplit * 100)).padStart(3)}% dos quadros · ${p.worst.map((x) => `${x.par} (${Math.round(x.frac * 100)}%, t=${x.t})`).join(' · ')}`);
  }
  if (data.zoom) {
    console.log('\nsilhueta por zoom (1 = igual à de zoom 2,4):');
    for (const [k, v] of Object.entries(data.zoom)) console.log(`  ${k}: ` + Object.entries(v).map(([z, i]) => `zoom ${z} → ${i}`).join(' · '));
  }
  console.log(errors.length ? 'ERROS: ' + errors.join('\n') : '\nsem erros');
  await browser.close();
})();
