// Simula o "servidor" (posição nova a cada 50 ms, como o jogo) e o personagem da PD.View seguindo essa posição.
// Mede, por cenário: atraso (personagem × posição de verdade), tempo para alcançar depois de virar, passada além do
// ponto quando para, escorregão do pé apoiado (ponto que encosta no chão, como o ferramentas/escorregao.cjs) e o passo
// (mistura de corrida na passada; o rótulo "Correndo" do animador é só velocidade acima de 1,9 m/s).
// Uso: node ferramentas/seguir.cjs   (a PD.View de verdade, js/view.js; o pé apoiado tem que ficar em 0,0 cm/s)
const { chromium } = require('playwright');
const path = require('path');
const url = require('url');
(async () => {
  const dir = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url.pathToFileURL(path.join(dir, 'prancha.html')).href + '?linhas=0');
  await page.waitForFunction(() => window.__sheetReady);
  await page.addScriptTag({ path: path.join(dir, 'js/view.js') });
  const out = await page.evaluate(() => {
    const M = PD.math;
    const S = PD.SPEED;
    const VARIANTES = { 'view.js': 'real' };
    function drive(v, a, dt) {
      return PD.View.prototype._drive.call({}, a, dt);
    }
    // cenários: velocidade (cm/s) e direção (graus) do servidor em cada instante; null = parado
    const CEN = {
      'corre reto': (t) => [450, 0],
      'corre e vira 180°': (t) => [450, t < 1.5 ? 0 : 180],
      'corre e vira 90°': (t) => [450, t < 1.5 ? 0 : 90],
      'anda (Shift, 2 m/s)': (t) => [200, 0],
      'anda e vira 180°': (t) => [200, t < 1.5 ? 0 : 180],
      'corre e para': (t) => (t < 1.5 ? [450, 0] : null),
      'anda e para': (t) => (t < 1.5 ? [200, 0] : null),
      'zigue-zague correndo': (t) => [450, Math.floor(t / 0.6) % 2 ? 60 : -60],
    };
    const linhas = [];
    for (const [cn, f] of Object.entries(CEN)) {
      for (const [vn, v] of Object.entries(VARIANTES)) {
        const ch = new PD.Character(0, 0, 0);
        const a = { ch, target: { x: 0, y: 0 }, angle: 0, dash: false, rig: null };
        const srv = { x: 0, y: 0 };
        const dt = 1 / 120, total = 4;
        let tick = 0, lagMax = 0, lagSteady = [], over = 0, prev = [null, null], slideMax = 0, slideSum = 0, slideN = 0;
        let turnAt = null, caught = null, peakT = null, peak = 0, passos = {}, saltos = 0, lastPos = { x: 0, y: 0 };
        let mistura = 0, misturaN = 0;
        for (let t = 0; t < total; t += dt) {
          const s = f(t);
          if (s) { srv.x += Math.cos(s[1] * M.DEG) * s[0] * dt; srv.y += Math.sin(s[1] * M.DEG) * s[0] * dt; a.angle = s[1] * M.DEG; }
          if (t >= tick) { tick += 0.05; a.target = { x: srv.x, y: srv.y }; }
          drive(v, a, dt);
          if (Math.hypot(ch.pos.x - lastPos.x, ch.pos.y - lastPos.y) > 100) saltos++;
          lastPos = { x: ch.pos.x, y: ch.pos.y };
          const lag = Math.hypot(srv.x - ch.pos.x, srv.y - ch.pos.y);
          if (t > 0.5) lagMax = Math.max(lagMax, lag);
          if (t > 1.0 && t < 1.5) lagSteady.push(lag);
          if (cn.includes('vira') && t >= 1.5 && turnAt === null) turnAt = t;
          if (turnAt !== null && lag > peak) { peak = lag; peakT = t; caught = null; }
          if (peakT !== null && caught === null && lag < 70) caught = t - turnAt;
          if (cn.includes('para') && t > 1.5) over = Math.max(over, ch.pos.x - srv.x); // passou do ponto (andava para +x)
          passos[ch.label] = (passos[ch.label] || 0) + 1;
          if (t > 1.0 && t < 1.5) { mistura += ch.runBlend; misturaN++; }
          // escorregão do pé apoiado (igual ao ferramentas/escorregao.cjs)
          const rig = a.rig;
          for (let i = 0; i < 2; i++) {
            const pitch = ch.pose().feet[i].pitch;
            const heel = M.at(rig.foot[i], 0, -PD.BODY.heelBack, -PD.BODY.ankleHeight);
            const ball = M.at(rig.foot[i], 0, PD.BODY.ballFwd, -PD.BODY.ankleHeight);
            const st = ch.footLock[i];
            const planted = st.planted && !st.step && ch.jump.state !== 'ar';
            if (planted && prev[i] && t > 0.3) {
              const vh = Math.hypot(heel.x - prev[i].h.x, heel.y - prev[i].h.y) / dt;
              const vb = Math.hypot(ball.x - prev[i].b.x, ball.y - prev[i].b.y) / dt;
              const flat = 2 * M.DEG;
              const sp = pitch > flat ? vh : pitch < -flat ? vb : Math.min(vh, vb);
              slideMax = Math.max(slideMax, sp); slideSum += sp; slideN++;
            }
            prev[i] = planted ? { h: heel, b: ball } : null;
          }
        }
        const med = lagSteady.length ? lagSteady.sort((p, q) => p - q)[Math.floor(lagSteady.length / 2)] : 0;
        const top = Object.entries(passos).sort((p, q) => q[1] - p[1]).map(([k, n]) => `${k} ${Math.round((n * 100) / (total * 120))}%`).join(', ');
        linhas.push(`${cn.padEnd(22)} atraso: firme ${med.toFixed(0).padStart(3)} · máx ${lagMax.toFixed(0).padStart(3)} cm` +
          (turnAt !== null ? ` · alcança em ${caught === null ? '  >2,5' : caught.toFixed(2).padStart(5)} s` : '              ') +
          (cn.includes('para') ? ` · passa do ponto ${over.toFixed(0).padStart(3)} cm` : '                    ') +
          ` | pé apoiado: máx ${slideMax.toFixed(1).padStart(5)} · média ${(slideN ? slideSum / slideN : 0).toFixed(2).padStart(5)} cm/s | saltos ${saltos}` +
          ` | passada de corrida ${Math.round((100 * mistura) / Math.max(1, misturaN)).toString().padStart(3)}% (0 = caminhada) | ${top}`);
      }
    }
    return linhas.join('\n');
  });
  console.log(out);
  await browser.close();
})().catch((e) => { console.error('falhou:', e.message); process.exit(1); });
