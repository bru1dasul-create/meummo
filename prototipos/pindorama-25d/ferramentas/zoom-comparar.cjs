// ANTES × DEPOIS do zoom da conversa: roda o zoom-perfil.cjs várias vezes em DUAS versões do jogo ligadas ao mesmo
// tempo (cada uma num servidor, numa porta) e nos quatro casos combinados (a Xiovanna de dentro da Budega e o Curupira
// ao ar livre; o herói parado ao lado deles e chegando andando), e imprime a média de cada fase lado a lado.
// Uso: node zoom-comparar.cjs <pasta de saída> [repetições] [casos separados por vírgula]
//   ANTES=http://localhost:3001  DEPOIS=http://localhost:3000   (os endereços das duas versões)
//   TELA=844,390 DPR=2           (tela de celular)
// As duas versões: `git worktree add <pasta> <commit>`, um atalho para o node_modules, `npm run build` e
// `PORT=3001 MEUMMO_SAVE=<cópia do save de teste> npm start` na pasta da versão antiga.
const { execFileSync } = require('child_process');
const fs = require('fs');
const [, , out = '.', repsArg = '3', onlyArg = ''] = process.argv;
fs.mkdirSync(out, { recursive: true });
const CASES = {
  'budega-parado': { npc: 'budega', wait: '3500', env: {} },
  'curupira-parado': { npc: 'curupira', wait: '3500', env: {} },
  'curupira-andando': { npc: 'curupira', wait: '150', env: { ANDAR: '43,53', PERTO: '43,46.5' } },
  'budega-andando': { npc: 'budega', wait: '150', env: { ANDAR: '67,58', PERTO: '67,52' } },
};
const VERSIONS = { antes: process.env.ANTES || 'http://localhost:3001', depois: process.env.DEPOIS || 'http://localhost:3000' };
const cases = onlyArg ? onlyArg.split(',') : Object.keys(CASES);
const res = {};
for (const c of cases) {
  // (as duas versões se revezam a cada rodada: se o computador ficar mais lento no meio, pega as duas igual)
  for (let r = 0; r < +repsArg; r++) {
    for (const v of Object.keys(VERSIONS)) {
      const file = `${out}/${c}-${v}-${r}.json`;
      try {
        execFileSync('node', [__dirname + '/zoom-perfil.cjs', VERSIONS[v], CASES[c].npc, process.env.TELA || '1600,900', CASES[c].wait], { env: { ...process.env, ...CASES[c].env, JSON_OUT: file }, timeout: 200000, stdio: ['ignore', 'ignore', 'inherit'] });
        const j = JSON.parse(fs.readFileSync(file, 'utf8'));
        ((res[c] = res[c] || {})[v] = res[c][v] || []).push(j);
        if (j.errors.length) console.log(c, v, 'ERROS', j.errors.join(' || '));
      } catch (e) { console.log(c, v, r, 'falhou:', String(e.message).slice(0, 200)); }
    }
  }
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '-');
for (const c of cases) {
  console.log(`\n=== ${c}`);
  const first = ((res[c] || {}).depois || (res[c] || {}).antes || [{ summary: {} }])[0];
  for (const ph of Object.keys(first.summary)) {
    const row = (v) => {
      const runs = ((res[c] || {})[v] || []).map((j) => j.summary[ph]).filter(Boolean);
      return `quadro ${f(mean(runs.map((x) => x.media)), 1)} ms (p95 ${f(mean(runs.map((x) => x.p95)))}, pior ${f(Math.max(...runs.map((x) => x.pior)))}; >60 ms: ${f(mean(runs.map((x) => x.acima60)), 1)}, >80 ms: ${f(mean(runs.map((x) => x.acima80)), 1)}) | imagens ${f(mean(runs.map((x) => x.imagens)))} (${f(mean(runs.map((x) => x.imagensMs)))} ms) | chão ${f(mean(runs.map((x) => x.chao)))} (${f(mean(runs.map((x) => x.chaoMs)))} ms)`;
    };
    console.log(`  ${ph}\n     antes : ${row('antes')}\n     depois: ${row('depois')}`);
  }
}
fs.writeFileSync(`${out}/resumo.json`, JSON.stringify(res));
