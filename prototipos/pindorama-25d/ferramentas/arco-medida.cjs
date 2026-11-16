// A pose do arco MEDIDA, fora do jogo: prancha grande (direções da tela × casos) com as juntas do braço direito marcadas
// (ombro vermelho, cotovelo verde, punho azul, dedos da corda branco; o ombro e o punho do arco em laranja e amarelo) e
// os números de cada caso (na base da mira: para a frente, para a direita, para cima, em cm a partir do meio do peito).
// Foi com ela que o defeito do braço direito apareceu (16/11): veja "O braço do arco, redesenhado" em docs/ARTE.md.
// Uso: node arco-medida.cjs <saida.png> [casos] [json] [zoom] [quantas direções]
//   casos: lista separada por vírgula de  nome:segundos:andar:soltar
//     segundos = quanto tempo puxando (a carga cheia do arco leva 1,5 s)
//     andar    = graus em relação à mira (0 = para o alvo, 180 = fugindo), "-" parado, "v" = a Chuva (mira para o alto)
//     soltar   = (opcional) segundos depois de soltar
//   ex.: "min:0.35:-,meio:0.9:-,cheia:1.9:-"   "frente:1.9:0,dir:1.9:90,tras:1.9:180,esq:1.9:-90"   "s:1.9:-:0.12"
//   variáveis: NUMEROS=1 imprime as medidas (também vão para <saida>.json); SEM_MARCAS=1 tira as juntas;
//              DIRS=0,4 só essas direções (índices); SLING=<arquivo> usa outro slingshot.js (comparar antes e depois)
// Precisa do Playwright com o Chromium (o mesmo das conferências do jogo).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..') + '/';
(async () => {
  const [, , out, casesArg = 'cheia:1.9:-', tuneArg = '{}', zoomArg = '1.9', dirsArg = '8'] = process.argv;
  const list = JSON.parse(fs.readFileSync(ROOT + 'view-scripts.json', 'utf8')).scripts;
  const tags = list.map((s) => `<script src="file://${process.env.SLING && /slingshot\.js$/.test(s) ? process.env.SLING : ROOT + s}"></script>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222"><canvas id="c"></canvas>${tags}<script>
window.__go = (casesArg, tune, zoom, ND, marks, only) => {
  const M = PD.math;
  const cases = casesArg.split(',').map((s) => { const [name, secs, walk, rel] = s.split(':'); return { name, secs: +secs, walk: walk === undefined || walk === '-' ? null : walk, release: rel === undefined ? null : +rel }; });
  if (PD.slingshot.BOW_POSE) Object.assign(PD.slingshot.BOW_POSE, tune);
  const cv = document.getElementById('c'); const CW = Math.round(165 * zoom), CH = Math.round(215 * zoom);
  const KS = only && only.length ? only : Array.from({ length: ND }, (_, i) => i);
  cv.width = CW * KS.length; cv.height = CH * cases.length; const ctx = cv.getContext('2d');
  ctx.fillStyle = '#3d5a34'; ctx.fillRect(0, 0, cv.width, cv.height);
  const errs = [], rows = [];
  for (let row = 0; row < cases.length; row++) for (let ki = 0; ki < KS.length; ki++) {
    const k = KS[ki];
    const cs = cases[row];
    try {
      const cam = new PD.IsoCamera(); cam.zoom = zoom;
      // direção na TELA: k*45° (0 = direita, 90 = para baixo/câmera)
      const scr = (k / ND) * Math.PI * 2;
      const g = cam.groundDir(Math.cos(scr), Math.sin(scr));
      const dir = Math.atan2(g.y, g.x);
      const ch = new PD.Character(0, 0, dir);
      ch.equip('maoE', 'arco');
      const volley = cs.walk === 'v';
      const rel = cs.walk !== null && !volley ? +cs.walk * M.DEG : null;
      const move = rel === null ? null : { x: Math.cos(dir + rel) * 0.9, y: Math.sin(dir + rel) * 0.9 };
      // já andando (o corpo virado para onde anda) antes de puxar
      for (let t = 0; t < 0.9; t += 1 / 60) ch.update(1 / 60, move ? { move } : {}, null);
      PD.slingshot.start(ch, dir, { attackHeld: true });
      if (volley) ch.attack.volley = true;
      const hold = volley ? Math.min(cs.secs, 0.3) : cs.secs;
      for (let t = 0; t < hold; t += 1 / 60) { ch.attack && (ch.attack.dir = dir); ch.update(1 / 60, { ...(move ? { move } : {}) }, null); }
      if (cs.release !== null && ch.attack) {
        // solta (como a view: 'shoot') e deixa passar o tempo pedido
        ch.attack.dir = dir; ch.attack.aimYaw = dir; ch.attack.releaseRequested = true;
        for (let t = 0; t < cs.release + 1e-6; t += 1 / 60) ch.update(1 / 60, { ...(move ? { move } : {}) }, null);
      }
      const pose = ch.pose();
      const rig = PD.rig.buildRig(pose);
      const r = new PD.CharacterRenderer(cam);
      const p = cam.p({ x: ch.pos.x, y: ch.pos.y, z: 0 });
      const ox = ki * CW + CW / 2 - p.x, oy = row * CH + CH * 0.86 - p.y;
      ctx.save(); ctx.beginPath(); ctx.rect(ki * CW, row * CH, CW, CH); ctx.clip();
      ctx.translate(ox, oy);
      r.draw(ctx, rig, ch.look, ch.equipped, PD.classes.appearanceOf(ch));
      const S = rig.shoulder[1], E = rig.elbow[1], W = rig.wrist[1];
      const pin = M.add(W, M.scale(rig.hand[1].a, 7));
      if (marks) {
        const dot = (pt, color, rad = 3) => { const q = cam.p(pt); ctx.fillStyle = color; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, 7); ctx.fill(); ctx.stroke(); };
        const seg = (a, b, color) => { const qa = cam.p(a), qb = cam.p(b); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(qa.x, qa.y); ctx.lineTo(qb.x, qb.y); ctx.stroke(); };
        seg(S, E, '#ff3b3b'); seg(E, W, '#35d0ff');
        dot(S, '#ff3b3b'); dot(E, '#55ff55'); dot(W, '#35d0ff'); dot(pin, '#ffffff', 2.4);
        dot(rig.shoulder[0], '#ff9a3b', 2.2); dot(rig.wrist[0], '#ffd23b', 2.2);
      }
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = '12px system-ui';
      ctx.fillText(cs.name + ' · tela ' + Math.round(k * 360 / ND) + '°', ki * CW + 6, row * CH + 14);
      // ---- números ----
      const av = { x: Math.cos(dir), y: Math.sin(dir), z: 0 }, rv = M.rightOf(av);
      const O = rig.chest.o;
      const inAim = (pt) => { const d = M.sub(pt, O); return [M.dot(d, av), M.dot(d, rv), d.z].map((v) => Math.round(v * 10) / 10); };
      const dE = M.sub(E, S);
      const chestE = [M.dot(dE, rig.chest.r), M.dot(dE, rig.chest.f), M.dot(dE, rig.chest.u)].map((v) => Math.round(v * 10) / 10);
      const g2 = PD.slingshot.bowGeometry(rig, ch.look);
      const arrow = M.norm(M.sub(g2.rest, g2.nock));
      const qa = cam.pDir(arrow), qf = cam.pDir(M.sub(pin, E));
      const angOn = (v) => Math.atan2(v.y, v.x);
      const slope = Math.round(M.angleDiff(angOn(qa), angOn(qf)) / M.DEG);
      const elbowAngle = Math.round(Math.acos(M.clamp(M.dot(M.norm(M.sub(S, E)), M.norm(M.sub(W, E))), -1, 1)) / M.DEG);
      const lElbow = Math.round(Math.acos(M.clamp(M.dot(M.norm(M.sub(rig.shoulder[0], rig.elbow[0])), M.norm(M.sub(rig.wrist[0], rig.elbow[0]))), -1, 1)) / M.DEG);
      const off = Math.round(Math.acos(M.clamp(M.dot(arrow, av), -1, 1)) / M.DEG);
      const drawLen = Math.round(M.len(M.sub(g2.rest, g2.nock)));
      rows.push({ caso: cs.name, tela: Math.round(k * 360 / ND), ombro: inAim(S), cotovelo: inAim(E), dedos: inAim(pin), cotNoPeito: chestE, dobra: elbowAngle, dobraArco: lElbow,
        antebracoXflecha: slope, flechaXmira: off, puxada: drawLen, giroPeito: Math.round((pose.spine.yaw) / M.DEG), giroQuadril: Math.round(pose.pelvis.yaw / M.DEG), errIK: rig.ik.arm.map((x) => Math.round(x.err * 10) / 10) });
    } catch (e) { errs.push(cs.name + ' ' + k + ': ' + String(e.stack || e).split('\\n').slice(0, 3).join(' | ')); }
  }
  return { errs, rows };
};</script>`;
  const tmp = path.join(path.dirname(path.resolve(out)), path.basename(out, '.png') + '.html');
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 2600, height: 1400 } });
  const pe = []; p.on('pageerror', (e) => pe.push(String(e).slice(0, 300)));
  await p.goto('file://' + tmp);
  const res = await p.evaluate(([c, t, z, n, m, o]) => window.__go(c, t, z, n, m, o), [casesArg, JSON.parse(tuneArg), +zoomArg, +dirsArg, !process.env.SEM_MARCAS, (process.env.DIRS || '').split(',').filter(Boolean).map(Number)]);
  await (await p.$('#c')).screenshot({ path: out });
  const errs = res.errs.concat(pe);
  console.log(errs.length ? 'ERROS: ' + errs.slice(0, 4).join(' || ') : 'sem erros');
  if (process.env.NUMEROS) for (const r of res.rows) console.log(JSON.stringify(r));
  fs.writeFileSync(out.replace(/\.png$/, '.json'), JSON.stringify(res.rows, null, 1));
  await b.close();
})();
