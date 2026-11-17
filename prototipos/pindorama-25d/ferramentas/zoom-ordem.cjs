// A ORDEM de desenho guardada serve em outro zoom? (O `World.invalidate` não refaz mais a ordem quando o zoom muda:
// era 21 ms por quadro com os 2 mil objetos do Capão.) Compara a ordem que o jogo está usando (feita no zoom em que o
// mapa abriu) com a recalculada do zero em outros zooms: para cada par de objetos que se COBREM na tela (as caixas de
// verdade, sem a folga), quem vem antes tem de ser o mesmo nas duas. Sobra um ou outro par de copas emboladas, em que
// a ordem é um ciclo (A antes de B antes de C antes de A) e nenhuma das duas é "a certa".
// Uso: node zoom-ordem.cjs [url]      (precisa do jogo ligado: `npm run build && npm start`)
const { chromium } = require('playwright');
const { entrar } = require('./zoom-comum.cjs');
(async () => {
  const [, , base = 'http://localhost:3000'] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await entrar(p, base);
  await p.waitForTimeout(1500);
  const res = await p.evaluate(() => {
    const w = window.PD.view.world;
    const cam = w.cam;
    const z0 = cam.zoom;
    const kept = w._staticOrder().slice();
    const pos = new Map(kept.map((o, i) => [o, i]));
    const lab = (o) => { const d = o.t || o.b || o.d || o.p || o.w || o.f || {}; return (d.kind || d.type || d.id || '?') + (o.overhead ? '↑' : ''); };
    const out = [];
    for (const z of [z0, (z0 * 1.25) / 0.7, (z0 * 1.4) / 0.7, z0 * 0.74]) {
      cam.zoom = z;
      // as caixas exatas neste zoom, sem a folga de 6 px
      const boxes = kept.map((o) => { o._bb = null; o._bbExact = null; const e = o._exactBounds ? o._exactBounds() : o.bounds; return { x0: e.x0 + 6, y0: e.y0 + 6, x1: e.x1 - 6, y1: e.y1 - 6 }; });
      w.order = null;
      const fresh = w._staticOrder();
      const fpos = new Map(fresh.map((o, i) => [o, i]));
      let pairs = 0, differ = 0;
      const examples = [];
      for (let i = 0; i < kept.length; i++) {
        const A = boxes[i];
        for (let j = i + 1; j < kept.length; j++) {
          const B = boxes[j];
          if (!(A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1)) continue;
          pairs++;
          if ((pos.get(kept[i]) < pos.get(kept[j])) !== (fpos.get(kept[i]) < fpos.get(kept[j]))) { differ++; if (examples.length < 5) examples.push(lab(kept[i]) + ' × ' + lab(kept[j])); }
        }
      }
      out.push({ zoom: +z.toFixed(3), objetos: kept.length, paresQueSeCobrem: pairs, ordemDiferente: differ, exemplos: examples });
    }
    // devolve tudo ao normal
    cam.zoom = z0;
    for (const o of kept) { o._bb = null; o._bbExact = null; }
    w.order = kept;
    return out;
  });
  for (const r of res) console.log(JSON.stringify(r));
  await b.close();
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
