// O NOSSO rolamento (a esquiva do jogo) medido fora do jogo: onde fica cada junta em cada quadro (o mesmo formato da
// referência lida pelo glb_fk.py) e uma tira do herói de verdade, na câmera do jogo, rolando para a direita da tela.
// Uso: node rolamento-medida.cjs <saida.json> <tira.png> [distância em cm] [quantas poses na tira] [zoom] [json] [tela]
//   json = números de PD.ROLL_SHAPE para trocar (afinar); tela = para onde ele rola na tira, em graus da tela (0 = direita,
//   90 = para a câmera); ANIM=<arquivo> usa outro animator.js (comparar antes e depois).
//   (11 poses e zoom 1.3334 dão células de 200 px, as da folha-rolamento.py). Precisa do Playwright com o Chromium.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..') + '/';
(async () => {
  const [, , outJson, outPng, distArg = '300', nArg = '11', zoomArg = '1.25', tuneArg = '{}', telaArg = '0'] = process.argv;
  const list = JSON.parse(fs.readFileSync(ROOT + 'view-scripts.json', 'utf8')).scripts;
  const tags = list.map((s) => `<script src="file://${process.env.ANIM && /animator\.js$/.test(s) ? process.env.ANIM : ROOT + s}"></script>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222"><canvas id="c"></canvas>${tags}<script>
window.__go = (dist, N, zoom, tune, tela) => {
  const M = PD.math;
  if (PD.ROLL_SHAPE) Object.assign(PD.ROLL_SHAPE, tune);
  // ---- 1) as juntas, quadro a quadro (60 por segundo), com o herói indo para +x ----
  const sample = () => {
    const ch = new PD.Character(0, 0, 0);
    for (let t = 0; t < 0.6; t += 1 / 60) ch.update(1 / 60, {}, null);
    const start = { x: ch.pos.x, y: ch.pos.y };
    ch.startRoll(0, dist);
    const frames = [];
    const grab = (time) => {
      const rig = PD.rig.buildRig(ch.pose());
      const P = (p) => [Math.round((p.y - start.y) * 100) / 100, Math.round((p.x - start.x) * 100) / 100, Math.round((p.z) * 100) / 100]; // direita, frente, cima
      const tip = (i) => M.add(rig.wrist[i], M.scale(rig.hand[i].a, 15));
      const j = { raiz: P({ x: ch.pos.x, y: ch.pos.y, z: 0 }), quadril: P(rig.pelvis.o), peito: P(rig.chest.o), pescoco: P(rig.neckBase), cabeca: P(rig.head.o),
        topo: P(M.add(rig.head.o, M.scale(rig.head.u, 14))),
        ombroE: P(rig.shoulder[0]), ombroD: P(rig.shoulder[1]), cotoveloE: P(rig.elbow[0]), cotoveloD: P(rig.elbow[1]), punhoE: P(rig.wrist[0]), punhoD: P(rig.wrist[1]),
        dedosE: P(tip(0)), dedosD: P(tip(1)), coxaE: P(rig.hip[0]), coxaD: P(rig.hip[1]), joelhoE: P(rig.knee[0]), joelhoD: P(rig.knee[1]),
        tornozeloE: P(rig.ankle[0]), tornozeloD: P(rig.ankle[1]), pontaE: P(rig.toe[0].o), pontaD: P(rig.toe[1].o) };
      frames.push({ t: Math.round(time * 10000) / 10000, juntas: j, rolando: !!(ch.dodge && ch.dodge.roll) });
    };
    grab(0);
    let time = 0;
    for (let k = 0; k < 60; k++) { ch.update(1 / 60, {}, null); time += 1 / 60; grab(time); if (!ch.dodge && time > 0.75) break; }
    return frames;
  };
  const frames = sample();
  const end = frames.findIndex((f) => !f.rolando);
  const total = end > 0 ? frames[end].t : frames[frames.length - 1].t;
  // ---- 2) a tira: o herói de verdade na câmera do jogo, rolando para a direita da tela ----
  const cam = new PD.IsoCamera(); cam.zoom = zoom;
  const g = cam.groundDir(Math.cos(tela * Math.PI / 180), Math.sin(tela * Math.PI / 180)); // para onde ele rola, na TELA (0 = direita, 90 = para a câmera)
  const dir = Math.atan2(g.y, g.x);
  const CW = Math.round(150 * zoom), CH = Math.round(210 * zoom);
  const cv = document.getElementById('c'); cv.width = CW * N; cv.height = CH; const ctx = cv.getContext('2d');
  ctx.fillStyle = '#3d5a34'; ctx.fillRect(0, 0, cv.width, cv.height);
  const errs = [];
  for (let i = 0; i < N; i++) {
    try {
      const want = (total * i) / (N - 1);
      const ch = new PD.Character(0, 0, dir);
      for (let t = 0; t < 0.6; t += 1 / 60) ch.update(1 / 60, {}, null);
      ch.startRoll(dir, dist);
      for (let t = 0; t < want - 1e-6; t += 1 / 120) ch.update(1 / 120, {}, null);
      const rig = PD.rig.buildRig(ch.pose());
      ch.secondary(rig, 1 / 60);
      const r = new PD.CharacterRenderer(cam);
      const p = cam.p({ x: ch.pos.x, y: ch.pos.y, z: 0 });
      ctx.save(); ctx.beginPath(); ctx.rect(i * CW, 0, CW, CH); ctx.clip();
      ctx.translate(i * CW + CW / 2 - p.x, CH * 0.84 - p.y);
      // o chão: uma elipse de sombra
      ctx.fillStyle = 'rgba(20,30,18,0.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 34 * zoom, 13 * zoom, 0, 0, 7); ctx.fill();
      r.draw(ctx, rig, ch.look, ch.equipped, PD.classes.appearanceOf(ch));
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = '12px system-ui';
      ctx.fillText(Math.round((i / (N - 1)) * 100) + '% · ' + want.toFixed(2) + ' s', i * CW + 6, 14);
    } catch (e) { errs.push(String(e.stack || e).split('\\n').slice(0, 3).join(' | ')); }
  }
  return { frames, total, errs };
};</script>`;
  const tmp = outPng.replace(/\.png$/, '.html');
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 2600, height: 900 } });
  const pe = []; p.on('pageerror', (e) => pe.push(String(e).slice(0, 300)));
  await p.goto('file://' + tmp);
  const res = await p.evaluate(([d, n, z, t, a]) => window.__go(d, n, z, t, a), [+distArg, +nArg, +zoomArg, JSON.parse(tuneArg), +telaArg]);
  await (await p.$('#c')).screenshot({ path: outPng });
  fs.writeFileSync(outJson, JSON.stringify({ nome: 'nosso-rolamento', total: res.total, distancia: +distArg, quadros: res.frames }));
  const errs = res.errs.concat(pe);
  console.log(errs.length ? 'ERROS: ' + errs.slice(0, 3).join(' || ') : 'sem erros', '| quadros', res.frames.length, '| dura', res.total, 's');
  await b.close();
})();
