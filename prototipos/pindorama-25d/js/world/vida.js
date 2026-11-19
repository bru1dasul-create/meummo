// A vida no ar (passo 3 do chão, 19/11; o dono, em 17/11: "ambiente com movimentação pífia"; desenho do [mundo]):
//  - as folhas caindo das árvores de copa (girando, levadas pelo vento; ficam um pouco no chão e somem);
//  - de dia, as borboletas na grama e nas clareiras (azul-morfo, amarela, laranja e branca) e a poeira de luz no ar;
//  - de noite, os vaga-lumes na mata e no brejo (piscam e acendem o escuro em volta: luzes da noite, view.js);
//  - na água: as libélulas de dia, um peixe pulando de vez em quando (com o respingo e a ondinha) e a folha que cai
//    na água fica boiando, levada pelo vento.
// Tudo leve: poucas coisas, só perto da tela; nada disso segura ninguém (só desenho).
//   PD.vida.update(world, dt, t)    (World.update, a cada quadro)
//   PD.vida.ground(ctx, world, t)   (World.draw, logo depois da água: o peixe e as folhas no chão e boiando)
//   PD.vida.live(ctx, world, t)     (World.draw, por cima de tudo, junto das pétalas: o que voa)
//   PD.vida.glows(world)            (as luzinhas dos vaga-lumes para o escuro da noite: [{ x, y, z, r, color, k }])
(function (PD) {
  'use strict';
  const M = PD.math;
  const K = PD.ISO_K;
  // árvore de copa solta folha; palmeira, bananeira e samambaia não
  const NO_LEAVES = new Set(['jeriva', 'bananeira', 'xaxim']);
  // (folha que cai é folha seca: amarela, laranja e marrom, umas poucas verdes; a verde some em cima da grama e das copas)
  const LEAF_COLORS = ['#d8b13e', '#c98a34', '#b5763a', '#e0c25a', '#a0683a', '#8fa046'];
  const DRY_COLORS = ['#a8783e', '#8a5e30', '#c4954e'];
  const BUTTERFLIES = [
    { wing: '#3f86e0', edge: '#0f2a52', spot: '#bfe2ff' }, // azul-morfo
    { wing: '#f2c63a', edge: '#5a3a0a', spot: '#fff2b8' }, // amarela
    { wing: '#ec8a2c', edge: '#2a160a', spot: '#ffe0b0' }, // laranja de veias pretas
    { wing: '#f4f1e6', edge: '#7a7466', spot: '#ffffff' }, // branquinha
  ];
  const FLY_GROUND = new Set(['grama', 'clareira', 'mata', 'campinho']);
  const MOTE_GROUND = new Set(['grama', 'clareira', 'mata', 'mata-profunda', 'trilha', 'terra']);
  const BUG_GROUND = new Set(['mata', 'mata-profunda', 'lama', 'grama', 'clareira', 'trilha']);

  /** O pedaço do chão que está na tela (um losango): a caixa dele e um ponto qualquer dentro dele. */
  function viewOf(world, pad) {
    const cam = world.cam;
    const kx = K * cam.zoom, ky = K * cam.sinP * cam.zoom;
    const inv = (sx, sy) => {
      const a = sx / kx, b = sy / ky;
      return { x: (a + b) / 2, y: (b - a) / 2 };
    };
    const c = [inv(cam.viewX, cam.viewY), inv(cam.viewX + cam.viewW, cam.viewY), inv(cam.viewX, cam.viewY + cam.viewH), inv(cam.viewX + cam.viewW, cam.viewY + cam.viewH)];
    return {
      x0: Math.min(...c.map((q) => q.x)) - pad, x1: Math.max(...c.map((q) => q.x)) + pad,
      y0: Math.min(...c.map((q) => q.y)) - pad, y1: Math.max(...c.map((q) => q.y)) + pad,
      any: () => inv(cam.viewX + Math.random() * cam.viewW, cam.viewY + Math.random() * cam.viewH),
      sees: (x, y, z, m) => {
        const q = cam.p({ x, y, z });
        return q.x > cam.viewX - m && q.x < cam.viewX + cam.viewW + m && q.y > cam.viewY - m && q.y < cam.viewY + cam.viewH + m;
      },
    };
  }
  const groundAt = (world, x, y) => (PD.chao && PD.chao.under ? PD.chao.under(world.map, x, y, Infinity) : 'mata');
  const inWater = (world, x, y) => groundAt(world, x, y) === 'agua';
  /** Em cima (ou perto) de um deque ou píer? (lá não pula peixe nem boia folha) */
  const onDeck = (world, x, y) => (world.map.flats || []).some((f) => f.kind === 'deque' && x > f.x0 - 60 && x < f.x1 + 60 && y > f.y0 - 60 && y < f.y1 + 60);
  /** Água aberta: é água e não tem deque em cima nem a beira logo ali (a 1,2 m para os quatro lados também é água). */
  const openWater = (world, x, y) => inWater(world, x, y) && !onDeck(world, x, y) && [[120, 0], [-120, 0], [0, 120], [0, -120]].every(([a, b]) => inWater(world, x + a, y + b));

  function state(world) {
    if (!world._vida) world._vida = { leaves: [], flies: [], motes: [], bugs: [], seen: [], darts: [], jumps: [], nextJump: 2 };
    return world._vida;
  }

  function update(world, dt, t) {
    if (!world.map || world.map.kind !== 'tmj') return;
    const V = state(world);
    const day = world.daylight == null ? 1 : world.daylight;
    const wind = world.wind || { strength: 0.35, angle: -Math.PI / 4 };
    const wx = Math.cos(wind.angle), wy = Math.sin(wind.angle);
    const view = viewOf(world, 400);
    // ---- as folhas: de uma árvore de copa na tela, de vez em quando
    if (Math.random() < dt * 2) {
      V.seen = (world.map.trees || []).filter((tr) => !tr.inside && !NO_LEAVES.has(tr.kind) && tr.r > 70 && tr.x > view.x0 && tr.x < view.x1 && tr.y > view.y0 && tr.y < view.y1);
    }
    if (V.seen.length && V.leaves.length < 36 && Math.random() < dt * Math.min(4, 0.5 + V.seen.length * 0.25)) {
      const tr = V.seen[Math.floor(Math.random() * V.seen.length)];
      const a = Math.random() * M.TAU, d = Math.sqrt(Math.random()) * tr.r * 0.75;
      const dry = tr.kind === 'seca';
      const colors = dry ? DRY_COLORS : LEAF_COLORS;
      V.leaves.push({ x: tr.x + Math.cos(a) * d, y: tr.y + Math.sin(a) * d, z: tr.h * (0.62 + Math.random() * 0.3), spin: Math.random() * M.TAU, seed: Math.random() * 9, color: colors[Math.floor(Math.random() * colors.length)], size: 12 + Math.random() * 6, rest: 0 });
    }
    const pull = 25 + wind.strength * 110;
    for (const L of V.leaves) {
      if (L.z > 0) {
        // cai devagar, balançando de um lado para o outro (a folha desce em zigue-zague) e o vento leva
        L.z -= (32 + 12 * Math.sin(t * 2.1 + L.seed)) * dt;
        L.x += (wx * pull + Math.sin(t * 1.7 + L.seed) * 55) * dt;
        L.y += (wy * pull + Math.cos(t * 1.3 + L.seed) * 35) * dt;
        L.spin += dt * (2.2 + wind.strength * 3);
        if (L.z <= 0) {
          L.z = 0;
          // na água, a folha boia e vai embora mais depressa
          L.floats = inWater(world, L.x, L.y) && !onDeck(world, L.x, L.y);
          L.rest = L.floats ? 9 + Math.random() * 5 : 4 + Math.random() * 3;
          L.left = L.rest;
        }
      } else {
        L.left -= dt;
        if (L.floats) {
          // boiando: vai devagar com o vento, girando um pouco
          L.x += wx * (6 + wind.strength * 22) * dt;
          L.y += wy * (6 + wind.strength * 22) * dt;
          L.spin += dt * 0.4;
        }
      }
    }
    V.leaves = V.leaves.filter((L) => (L.z > 0 || L.left > 0) && L.x > view.x0 - 800 && L.x < view.x1 + 800 && L.y > view.y0 - 800 && L.y < view.y1 + 800);
    // ---- as borboletas (de dia): umas poucas na grama perto da tela
    const flyWant = day > 0.35 ? 5 : 0;
    if (V.flies.length < flyWant && Math.random() < dt * 1.5) {
      const q = view.any();
      if (FLY_GROUND.has(groundAt(world, q.x, q.y))) {
        V.flies.push({ x: q.x, y: q.y, z: 50 + Math.random() * 90, head: Math.random() * M.TAU, turn: 0, flap: Math.random() * M.TAU, look: BUTTERFLIES[Math.floor(Math.random() * BUTTERFLIES.length)], rest: 0, seed: Math.random() * 9, born: t });
      }
    }
    for (const B of V.flies) {
      if (B.rest > 0) {
        // pousada no chão: as asas abrem e fecham devagar
        B.rest -= dt;
        B.flap += dt * 3;
        if (B.rest <= 0) B.z = 5;
        continue;
      }
      B.turn = M.lerp(B.turn, Math.sin(t * 0.9 + B.seed * 3) * 1.6 + Math.sin(t * 2.3 + B.seed) * 0.8, Math.min(1, dt * 2));
      B.head += B.turn * dt;
      const sp = 55 + 25 * Math.sin(t * 1.1 + B.seed);
      B.x += (Math.cos(B.head) * sp + wx * wind.strength * 20) * dt;
      B.y += (Math.sin(B.head) * sp + wy * wind.strength * 20) * dt;
      B.z = Math.max(8, B.z + Math.sin(t * 3.1 + B.seed) * 40 * dt);
      B.flap += dt * 19;
      // de vez em quando, pousa na grama (nunca na água)
      if (Math.random() < dt * 0.08 && t - B.born > 4 && !inWater(world, B.x, B.y)) {
        B.z = 0;
        B.rest = 1.5 + Math.random() * 2.5;
      }
    }
    V.flies = V.flies.filter((B) => view.sees(B.x, B.y, B.z, 120) && (day > 0.3 || Math.random() > dt));
    // ---- as libélulas (de dia): em cima da água, paradas no ar e de repente uma corrida curta
    const dartWant = day > 0.4 ? 3 : 0;
    if (V.darts.length < dartWant && Math.random() < dt * 0.8) {
      const q = view.any();
      if (openWater(world, q.x, q.y)) V.darts.push({ x: q.x, y: q.y, z: 45 + Math.random() * 50, vx: 0, vy: 0, hold: 0.5 + Math.random(), seed: Math.random() * 9, red: Math.random() < 0.4 });
    }
    for (const D of V.darts) {
      D.hold -= dt;
      if (D.hold <= 0) {
        // a corrida: para um lado qualquer (sem sair de cima da água)
        const a = Math.random() * M.TAU, sp = 180 + Math.random() * 160;
        const nx = D.x + Math.cos(a) * sp * 0.5, ny = D.y + Math.sin(a) * sp * 0.5;
        if (openWater(world, nx, ny)) {
          D.vx = Math.cos(a) * sp;
          D.vy = Math.sin(a) * sp;
        }
        D.hold = 0.6 + Math.random() * 1.8;
      }
      D.x += D.vx * dt;
      D.y += D.vy * dt;
      D.vx *= Math.pow(0.04, dt);
      D.vy *= Math.pow(0.04, dt);
      D.z += Math.sin(t * 7 + D.seed) * 10 * dt;
    }
    V.darts = V.darts.filter((D) => view.sees(D.x, D.y, D.z, 100) && (day > 0.35 || Math.random() > dt));
    // ---- o peixe pulando: de vez em quando, num lugar de água aberta na tela
    V.nextJump -= dt;
    if (V.nextJump <= 0) {
      V.nextJump = 2.5 + Math.random() * 4.5;
      for (let k = 0; k < 6; k++) {
        const q = view.any();
        if (!openWater(world, q.x, q.y)) continue;
        const a = Math.random() * M.TAU;
        V.jumps.push({ x: q.x, y: q.y, dx: Math.cos(a), dy: Math.sin(a), t: 0, size: 0.8 + Math.random() * 0.5 });
        break;
      }
    }
    for (const J of V.jumps) J.t += dt;
    V.jumps = V.jumps.filter((J) => J.t < 2.6);
    // ---- a poeira de luz (de dia): pontinhos claros boiando no ar, nos lugares de mata e de grama
    const moteWant = Math.round(26 * M.clamp((day - 0.3) / 0.5, 0, 1));
    if (V.motes.length < moteWant && Math.random() < dt * 12) {
      const q = view.any();
      if (MOTE_GROUND.has(groundAt(world, q.x, q.y))) V.motes.push({ x: q.x, y: q.y, z: 40 + Math.random() * 200, ph: Math.random() * M.TAU, per: 2.5 + Math.random() * 3, t: 0, life: 6 + Math.random() * 6 });
    }
    for (const P of V.motes) {
      P.t += dt;
      P.x += (wx * (8 + wind.strength * 30) + Math.sin(t * 0.7 + P.ph) * 6) * dt;
      P.y += (wy * (8 + wind.strength * 30) + Math.cos(t * 0.5 + P.ph) * 5) * dt;
      P.z += Math.sin(t * 0.6 + P.ph) * 6 * dt;
    }
    V.motes = V.motes.filter((P) => P.t < P.life && P.z > 0 && view.sees(P.x, P.y, P.z, 60) && V.motes.length <= moteWant + 4);
    // ---- os vaga-lumes (de noite): na mata, no brejo e na grama perto da tela
    const bugWant = day < 0.4 ? 34 : 0;
    if (V.bugs.length < bugWant && Math.random() < dt * 14) {
      const q = view.any();
      if (BUG_GROUND.has(groundAt(world, q.x, q.y))) V.bugs.push({ x: q.x, y: q.y, z: 30 + Math.random() * 130, ph: Math.random() * M.TAU, seed: Math.random() * 9, t: 0, life: 10 + Math.random() * 14, blink: Math.random() * 3 });
    }
    for (const F of V.bugs) {
      F.t += dt;
      F.x += Math.sin(t * 0.8 + F.seed) * 22 * dt;
      F.y += Math.cos(t * 0.6 + F.seed * 2) * 18 * dt;
      F.z = Math.max(15, F.z + Math.sin(t * 1.4 + F.ph) * 14 * dt);
      F.blink -= dt;
      if (F.blink < -0.45) F.blink = 1 + Math.random() * 2.4; // acende por ~0,45 s, apaga de 1 a 3 s
    }
    V.bugs = V.bugs.filter((F) => F.t < F.life && view.sees(F.x, F.y, F.z, 80) && (day < 0.5 || Math.random() > dt * 2));
  }

  /** O quanto o vaga-lume está aceso agora (0 a 1): acende e apaga macio. */
  const lit = (F) => (F.blink < 0 ? Math.sin((-F.blink / 0.45) * Math.PI) : 0);

  function leaf(ctx, cam, L) {
    const q = cam.p(L);
    const s = L.size * cam.zoom;
    const flat = 0.35 + 0.65 * Math.abs(Math.cos(L.spin));
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(L.spin * 0.6);
    ctx.globalAlpha = L.z > 0 ? 1 : Math.max(0, Math.min(1, L.left / 1.5));
    ctx.fillStyle = L.color;
    ctx.strokeStyle = 'rgba(27, 16, 13, 0.85)';
    ctx.lineWidth = Math.max(0.6, 0.7 * cam.zoom);
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.quadraticCurveTo(0, -s * 0.55 * flat, s, 0);
    ctx.quadraticCurveTo(0, s * 0.55 * flat, -s, 0);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40, 30, 10, 0.45)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, 0);
    ctx.lineTo(s * 0.8, 0);
    ctx.stroke();
    ctx.restore();
  }

  function butterfly(ctx, cam, B) {
    const q = cam.p(B);
    const z = cam.zoom;
    // a sombrinha no chão (dá a altura)
    if (B.z > 2) {
      const g = cam.p({ x: B.x, y: B.y, z: 0 });
      ctx.fillStyle = 'rgba(10, 20, 10, 0.18)';
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, 11 * z, 4.5 * z, 0, 0, M.TAU);
      ctx.fill();
    }
    const open = 0.25 + 0.75 * Math.abs(Math.sin(B.flap));
    const L = B.look;
    // (maior que a de verdade: na tela do jogo, a borboleta de 8 cm nem aparece)
    const w = 17 * z, h = 13 * z;
    ctx.save();
    ctx.translate(q.x, q.y);
    // (a cabeça aponta para onde ela vai, na tela)
    const dir = cam.p({ x: B.x + Math.cos(B.head) * 10, y: B.y + Math.sin(B.head) * 10, z: B.z });
    ctx.rotate(Math.atan2(dir.y - q.y, dir.x - q.x) + Math.PI / 2);
    ctx.lineWidth = Math.max(0.7, 0.8 * z);
    for (const sg of [-1, 1]) {
      ctx.save();
      ctx.scale(sg * open, 1);
      // as asas de cima (maiores) e as de baixo
      ctx.fillStyle = L.wing;
      ctx.strokeStyle = L.edge;
      ctx.beginPath();
      ctx.ellipse(w * 0.55, -h * 0.25, w * 0.6, h * 0.55, -0.5, 0, M.TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(w * 0.4, h * 0.42, w * 0.38, h * 0.36, 0.5, 0, M.TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = L.spot;
      ctx.beginPath();
      ctx.arc(w * 0.75, -h * 0.35, Math.max(0.8, w * 0.13), 0, M.TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#1b100d';
    ctx.lineWidth = Math.max(1, 1.6 * z);
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.6);
    ctx.lineTo(0, h * 0.7);
    ctx.stroke();
    ctx.restore();
  }

  /** A libélula: o corpo comprido e as quatro asas de vidro, tremendo. */
  function dragonfly(ctx, cam, D, t) {
    const q = cam.p(D);
    // (maior que a de verdade, como a borboleta: senão nem aparece)
    const z = cam.zoom * 1.7;
    const g = cam.p({ x: D.x, y: D.y, z: 0 });
    ctx.fillStyle = 'rgba(10, 30, 40, 0.16)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, 9 * z, 3 * z, 0, 0, M.TAU);
    ctx.fill();
    const ang = Math.hypot(D.vx, D.vy) > 20 ? Math.atan2(cam.p({ x: D.x + D.vx, y: D.y + D.vy, z: D.z }).y - q.y, cam.p({ x: D.x + D.vx, y: D.y + D.vy, z: D.z }).x - q.x) : 0.3 + Math.sin(D.seed) * 0.5;
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(ang);
    const shake = Math.sin(t * 60 + D.seed) * 0.25;
    ctx.fillStyle = 'rgba(220, 240, 255, 0.55)';
    ctx.strokeStyle = 'rgba(40, 60, 70, 0.6)';
    ctx.lineWidth = Math.max(0.5, 0.6 * z);
    for (const [ox, sg] of [[3, -1], [3, 1], [-1, -1], [-1, 1]]) {
      ctx.beginPath();
      ctx.ellipse(ox * z, sg * 7 * z, 2.4 * z, 7 * z, sg * (0.25 + shake), 0, M.TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = '#1b100d';
    ctx.lineWidth = Math.max(1.6, 3.4 * z);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14 * z, 0);
    ctx.lineTo(8 * z, 0);
    ctx.stroke();
    ctx.strokeStyle = D.red ? '#d8452e' : '#2bb3a8';
    ctx.lineWidth = Math.max(1, 2.2 * z);
    ctx.stroke();
    ctx.restore();
  }
  /** O peixe pulando: sai da água num arco, mergulha, e as ondinhas abrem nos dois lugares. */
  function jump(ctx, cam, J) {
    const z = cam.zoom;
    const ring = (x, y, k) => {
      if (k <= 0 || k >= 1) return;
      const q = cam.p({ x, y, z: 0 });
      ctx.strokeStyle = `rgba(226, 250, 244, ${(0.7 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, 2.4 * z * (1 - k * 0.6));
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, (10 + 70 * k) * z * J.size, (4 + 30 * k) * z * J.size, 0, 0, M.TAU);
      ctx.stroke();
    };
    const L = 70 * J.size; // o salto, em cm
    const x1 = J.x + J.dx * L, y1 = J.y + J.dy * L;
    ring(J.x, J.y, J.t / 1.4);
    ring(J.x, J.y, (J.t - 0.25) / 1.4);
    ring(x1, y1, (J.t - 0.55) / 1.6);
    ring(x1, y1, (J.t - 0.8) / 1.6);
    const f = J.t / 0.55;
    if (f > 0 && f < 1) {
      // o peixinho prateado no ar (e as gotas)
      const px = J.x + J.dx * L * f, py = J.y + J.dy * L * f, pz = Math.sin(f * Math.PI) * 55 * J.size;
      const q = cam.p({ x: px, y: py, z: pz });
      const ahead = cam.p({ x: px + J.dx * 10, y: py + J.dy * 10, z: pz + Math.cos(f * Math.PI) * 18 });
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(Math.atan2(ahead.y - q.y, ahead.x - q.x));
      const s = 9 * z * J.size;
      ctx.fillStyle = '#c9d6d8';
      ctx.strokeStyle = '#1b100d';
      ctx.lineWidth = Math.max(0.7, 0.9 * z);
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * 0.38, 0, 0, M.TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, 0);
      ctx.lineTo(-s * 1.5, -s * 0.45);
      ctx.lineTo(-s * 1.5, s * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(235, 250, 250, 0.8)';
      for (let k = 0; k < 4; k++) {
        const d = cam.p({ x: J.x + J.dx * L * f * 0.6 + (k - 1.5) * 6, y: J.y + J.dy * L * f * 0.6, z: pz * 0.5 * (1 - k * 0.15) });
        ctx.beginPath();
        ctx.arc(d.x, d.y, Math.max(0.8, 1.6 * z), 0, M.TAU);
        ctx.fill();
      }
    }
  }

  /** O que fica no nível do chão e da água (antes de quem fica em pé): o peixe pulando e as folhas caídas e boiando. */
  function ground(ctx, world, t) {
    const V = world._vida;
    if (!V) return;
    const cam = world.cam;
    for (const J of V.jumps) jump(ctx, cam, J);
    for (const L of V.leaves) {
      if (L.z > 0) continue;
      // a folha boiando ganha a ondinha em volta, de vez em quando
      if (L.floats) {
        const k = ((t * 0.5 + L.seed) % 1);
        const q = cam.p({ x: L.x, y: L.y, z: 0 });
        ctx.strokeStyle = `rgba(226, 250, 244, ${(0.35 * (1 - k)).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, (12 + 26 * k) * cam.zoom, (5 + 11 * k) * cam.zoom, 0, 0, M.TAU);
        ctx.stroke();
      }
      leaf(ctx, cam, L);
    }
  }

  /** O que voa (por cima de tudo): as folhas caindo, as borboletas, as libélulas, a poeira de luz e os vaga-lumes. */
  function live(ctx, world, t) {
    const V = world._vida;
    if (!V) return;
    const cam = world.cam;
    for (const L of V.leaves) if (L.z > 0) leaf(ctx, cam, L);
    for (const D of V.darts) dragonfly(ctx, cam, D, t);
    for (const B of V.flies) butterfly(ctx, cam, B);
    const day = world.daylight == null ? 1 : world.daylight;
    if (V.motes.length) {
      // a poeira de luz: brilho somado (mais forte no sol do meio do dia), piscando devagar
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const P of V.motes) {
        const q = cam.p(P);
        const fade = Math.min(1, P.t / 1.2, (P.life - P.t) / 1.2);
        const a = fade * day * (0.32 + 0.28 * Math.sin((t / P.per) * M.TAU + P.ph));
        if (a <= 0.01) continue;
        const r = (3.4 + Math.sin(P.ph) * 1.1) * cam.zoom;
        ctx.fillStyle = `rgba(255, 244, 196, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * 2.4, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 252, 230, ${Math.min(1, a * 2).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * 0.8, 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    if (V.bugs.length) {
      // o corpinho do vaga-lume aceso (a luz em volta dele é do escuro da noite: glows)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const F of V.bugs) {
        const k = lit(F) * Math.min(1, F.t / 1.5, (F.life - F.t) / 1.5);
        if (k <= 0.02) continue;
        const q = cam.p(F);
        ctx.fillStyle = `rgba(214, 255, 106, ${(0.9 * k).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(1.8, 3.6 * cam.zoom), 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(214, 255, 106, ${(0.25 * k).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(4, 12 * cam.zoom), 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** As luzinhas dos vaga-lumes acesos, para abrir o escuro da noite em volta deles (view.js). */
  function glows(world) {
    const V = world && world._vida;
    if (!V || !V.bugs.length) return [];
    const out = [];
    for (const F of V.bugs) {
      const k = lit(F) * Math.min(1, F.t / 1.5, (F.life - F.t) / 1.5);
      if (k > 0.05) out.push({ x: F.x, y: F.y, z: F.z, r: 75, color: '#d6ff6a', k: 0.95 * k });
    }
    return out;
  }

  PD.vida = { update, ground, live, glows };
})(window.PD = window.PD || {});
