// O zoom da CONVERSA medido no jogo de verdade: o herói chega perto de um NPC, clica nele (o motor aproxima a câmera
// em 0,45 s), espera e fecha (a câmera volta). Por fase — antes do clique, aproximando, assentando, voltando,
// assentando de novo — sai: o tempo de cada quadro (média, p95, pior, quantos acima de 60 e de 80 ms), quanto disso é o
// jogo (view.frame, desenho) e quais imagens e pedaços de chão foram feitos: quantos, quanto custaram, se estavam NA
// TELA ou fora e se foram ADIANTADOS (feitos antes de a câmera chegar).
// Uso: node zoom-perfil.cjs [url] [npc: budega | curupira | ...] [largura,altura] [espera antes do clique, em ms]
//   ANDAR=x,y   o herói começa ali e vem ANDANDO até perto do NPC (como no jogo); sem isso, é levado direto
//   PERTO=x,y   onde ele para (o padrão é 2 m ao sul do NPC)
//   DPR=2       tela de celular (mais pixels por ponto: aí o jogo guarda um zoom só — World.keepLevels)
//   JSON_OUT=arquivo   guarda o resumo (o zoom-comparar.cjs usa)
// Precisa do jogo ligado (`npm run build && npm start`) no mesmo computador (usa o painel do administrador).
// Sem placa de vídeo os números são altos (aqui, ~35 ms por quadro parado): valem para comparar antes e depois.
const { chromium } = require('playwright');
const { NOME, entrar, levar, cenaLimpa, acharNpc, ROTULO } = require('./zoom-comum.cjs');
(async () => {
  const [, , base = 'http://localhost:3000', tipo = 'budega', tela = '1600,900', waitArg = '3500'] = process.argv;
  const [W, H] = tela.split(',').map(Number);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.DPR || 1) });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 2).join(' | ')));
  const id = await entrar(p, base);
  await levar(base, id, 37, 35);
  await p.waitForTimeout(2500);
  await cenaLimpa(p);
  const npc = await acharNpc(p, tipo);
  if (!npc) throw new Error('nenhum NPC neste mapa');
  console.log('alvo:', JSON.stringify(npc), '| herói:', NOME, '| guarda dois zooms:', await p.evaluate(() => window.PD.view.world.keepLevels));
  // a instrumentação entra ANTES de chegar perto (para ver o que é adiantado)
  await p.evaluate((rotulo) => {
    const v = window.PD.view;
    const w = v.world;
    const rec = (window.__rec = { frames: [], builds: [], chunks: [], rafs: [], on: true });
    const label = new Function('return ' + rotulo)();
    const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const screen = (cam) => ({ x0: cam.viewX, y0: cam.viewY, x1: cam.viewX + cam.viewW, y1: cam.viewY + cam.viewH });
    for (const o of w.props.concat(w.flats || [])) {
      if (!o._makeSprite) {
        // (versão de antes de 17/11: a imagem era feita dentro do _ensureSprite)
        if (!o._ensureSprite) continue;
        const ens = o._ensureSprite.bind(o);
        o._ensureSprite = function () {
          const had = this.spriteKey;
          const t0 = performance.now();
          const r = ens();
          const ms = performance.now() - t0;
          if (this.spriteKey !== had && rec.on) rec.builds.push({ at: t0, ms, w: this.sprite ? this.sprite.c.width : 0, h: this.sprite ? this.sprite.c.height : 0, zoom: +this.cam.zoom.toFixed(3), tela: overlap(this.bounds, screen(this.cam)), adiantada: false, o: label(this) });
          return r;
        };
        continue;
      }
      const mk = o._makeSprite.bind(o);
      o._makeSprite = function (key) {
        const cam = this.cam;
        const t0 = performance.now();
        const s = mk(key);
        const ms = performance.now() - t0;
        let view = screen(cam);
        const a = w.ahead;
        const adiantada = !!rec.inAlt;
        if (adiantada && a) {
          // a tela de lá, no zoom de lá (a mesma conta do World._buildAhead)
          const K = Math.SQRT1_2;
          const vx = (a.x - a.y) * K * a.zoom - cam.viewW / 2, vy = (a.x + a.y) * K * cam.sinP * a.zoom - cam.viewH * 0.56;
          view = { x0: vx, y0: vy, x1: vx + cam.viewW, y1: vy + cam.viewH };
        }
        if (rec.on) rec.builds.push({ at: t0, ms, w: s.c.width, h: s.c.height, zoom: +cam.zoom.toFixed(3), tela: overlap(this.bounds, view), adiantada, o: label(this) });
        return s;
      };
      if (o._ensureAlt) {
        const alt = o._ensureAlt.bind(o);
        o._ensureAlt = function (z) { rec.inAlt = true; try { return alt(z); } finally { rec.inAlt = false; } };
      }
    }
    // tudo o que roda por quadro (o motor inteiro, não só o desenho do mundo)
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { const t0 = performance.now(); try { return cb(t); } finally { if (rec.on) rec.rafs.push({ at: t0, ms: performance.now() - t0 }); } });
    const proto = Object.getPrototypeOf(w.ground);
    const render = proto._render;
    proto._render = function (...a) { const t0 = performance.now(); const r = render.apply(this, a); rec.chunks.push({ at: t0, ms: performance.now() - t0 }); return r; };
    const draw = v._draw.bind(v);
    let drawMs = 0;
    v._draw = function () { const t0 = performance.now(); const r = draw(); drawMs = performance.now() - t0; return r; };
    const frame = v.frame.bind(v);
    v.frame = function (now) {
      const t0 = performance.now();
      const r = frame(now);
      if (rec.on) rec.frames.push({ at: t0, frame: performance.now() - t0, draw: drawMs, zoom: v.cam.zoom });
      return r;
    };
  }, ROTULO);
  // o custo de recalcular a caixa na tela de todos os objetos (acontece a cada passo do zoom)
  const boxes = await p.evaluate(() => {
    const w = window.PD.view.world;
    const cam = w.cam;
    const z = cam.zoom;
    const out = [];
    for (let k = 0; k < 5; k++) {
      cam.zoom = z * (1 + 0.01 * (k + 1));
      const t0 = performance.now();
      for (const o of w.props) void o.bounds;
      for (const o of w.flats || []) void o.bounds;
      out.push(+(performance.now() - t0).toFixed(2));
    }
    cam.zoom = z;
    for (const o of w.props) void o.bounds;
    for (const o of w.flats || []) void o.bounds;
    return out;
  });
  console.log('recalcular a caixa de todos os objetos, por passo do zoom (ms, 5 vezes):', boxes.join(' '));
  const near = process.env.PERTO ? process.env.PERTO.split(',').map(Number) : [Math.round(npc.x), Math.round(npc.y) + 2];
  let t0;
  if (process.env.ANDAR) {
    // como no jogo de verdade: o herói vem ANDANDO de longe (tudo do zoom normal já pronto) e clica assim que chega
    const from = process.env.ANDAR.split(',').map(Number);
    console.log('levar para longe:', await levar(base, id, from[0], from[1]));
    await p.waitForTimeout(5000);
    t0 = (await p.evaluate(() => performance.now())) - 600;
    await p.evaluate(([x, y]) => window.__mundoNovo.walkTo(x, y), near);
    await p.waitForFunction(() => !window.__mundoNovo.walking(), null, { timeout: 15000 });
    const me = await p.evaluate(() => window.__mundoNovo.me);
    console.log('chegou andando em', me.x.toFixed(1), me.y.toFixed(1), 'depois de', Math.round((await p.evaluate(() => performance.now())) - t0 - 600), 'ms');
  } else {
    t0 = await p.evaluate(() => performance.now());
    console.log('levar:', await levar(base, id, near[0], near[1]));
  }
  await p.waitForTimeout(+waitArg);
  const s = await p.evaluate(([x, y]) => window.__mundoNovo.screenOf(x, y), [npc.x, npc.y]);
  const t1 = await p.evaluate(() => performance.now());
  await p.mouse.click(s.x, s.y - 30);
  await p.waitForTimeout(2600);
  const open = await p.evaluate(() => window.PD.view.zoomUser);
  const t2 = await p.evaluate(() => performance.now());
  await p.keyboard.press('Escape');
  await p.waitForTimeout(2600);
  const t3 = await p.evaluate(() => performance.now());
  const rec = await p.evaluate(() => { window.__rec.on = false; return window.__rec; });
  console.log('zoom do jogador na conversa:', open, open > 1.2 ? '' : '(a conversa NÃO abriu: o clique não achou o NPC?)');
  const phases = [['antes do clique (perto do NPC)', t0 + 600, t1], ['aproximando', t1, t1 + 500], ['assentando', t1 + 500, t2], ['voltando', t2, t2 + 500], ['assentando de novo', t2 + 500, t3]];
  const summary = {};
  for (const [name, from, to] of phases) {
    const f = rec.frames.filter((x) => x.at >= from && x.at < to);
    const gaps = f.slice(1).map((x, i) => x.at - f[i].at);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const bs = rec.builds.filter((x) => x.at >= from && x.at < to);
    const cs = rec.chunks.filter((x) => x.at >= from && x.at < to);
    const on = bs.filter((x) => x.tela), off = bs.filter((x) => !x.tela);
    const sum = (a) => a.reduce((n, x) => n + x.ms, 0).toFixed(0);
    const js = rec.rafs.filter((x) => x.at >= from && x.at < to).reduce((n, x) => n + x.ms, 0) / Math.max(1, f.length);
    const sorted = gaps.slice().sort((x, y) => x - y);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    console.log(`\n== ${name}: ${f.length} quadros | quadro médio ${avg(gaps).toFixed(1)} ms, p95 ${p95.toFixed(0)}, pior ${Math.max(0, ...gaps).toFixed(0)}, acima de 60 ms: ${gaps.filter((g) => g > 60).length} | o jogo inteiro por quadro ${js.toFixed(1)} ms = view.frame ${avg(f.map((x) => x.frame)).toFixed(1)} (desenho ${avg(f.map((x) => x.draw)).toFixed(1)}) + resto do motor ${(js - avg(f.map((x) => x.frame))).toFixed(1)}`);
    console.log(`   imagens: ${bs.length} (${sum(bs)} ms) → na tela ${on.length} (${sum(on)} ms), fora da tela ${off.length} (${sum(off)} ms) | chão: ${cs.length} pedaços (${sum(cs)} ms)`);
    summary[name] = { quadros: f.length, media: avg(gaps), p95, pior: Math.max(0, ...gaps), acima60: gaps.filter((g) => g > 60).length, acima80: gaps.filter((g) => g > 80).length, js, imagens: bs.length, imagensMs: +sum(bs), naTela: on.length, chao: cs.length, chaoMs: +sum(cs) };
    const heavy = bs.filter((x) => x.ms > 10).sort((a, b) => b.ms - a.ms).slice(0, 10);
    if (heavy.length) console.log('   pesadas: ' + heavy.map((x) => `${x.o} ${x.ms.toFixed(0)} ms ${x.w}x${x.h} z${x.zoom} ${x.adiantada ? 'adiantada, ' : ''}${x.tela ? 'NA TELA' : 'fora'} aos ${Math.round(x.at - t1)}`).join('; '));
    const worst = f.slice(1).map((x, i) => ({ gap: x.at - f[i].at, ...f[i] })).sort((a, b) => b.gap - a.gap).slice(0, 4);
    console.log('   piores: ' + worst.map((x) => `${x.gap.toFixed(0)} ms (view.frame ${x.frame.toFixed(0)}, desenho ${x.draw.toFixed(0)}, zoom ${x.zoom.toFixed(2)}) aos ${Math.round(x.at - t1)}`).join('; '));
  }
  if (process.env.JSON_OUT) require('fs').writeFileSync(process.env.JSON_OUT, JSON.stringify({ summary, boxes, errors }));
  console.log(errors.length ? 'ERROS: ' + errors.join(' || ') : '\nsem erros');
  await b.close();
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
