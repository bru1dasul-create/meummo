// O Joaquim, o gato da vó (pedido do dono, com as fotos do gato dele: docs/referencias/joaquim-1.jpg e joaquim-2.jpg).
// Bem pequeno, todo branco-creme, com os detalhes laranja-claros de um flame point: a máscara na testa (com
// listrinhas) e em volta do focinho, as orelhas rosadas com a ponta laranja e o rabo laranja claro com anéis; olhos
// azuis e nariz rosa. Dormindo, fica enrolado (respira, mexe uma orelha, dá umas batidinhas com a ponta do rabo e
// solta uns "z"); acordado, é a criatura `joaquim` lá embaixo (anda, senta, se espreguiça, pula do sofá, mia e
// ronrona), pintada do mesmo jeito, que usa este mesmo desenho quando dorme.
//   PD.gato.draw(ctx, cam, { x, y, z, yaw, pose, t, name, body, marks, size })   (o gato enrolado, a cada quadro)
//   PD.creatures.create('joaquim', xCm, yCm, yaw)                                  (o que a PD.View usa no jogo)
(function (PD) {
  'use strict';
  const M = PD.math;
  const INK = '#1b100d';

  /** As cores do gato: o corpo (o "branco" do mapa vira creme, como nas fotos) e as pontas laranja-claras. */
  function colorsOf(s) {
    const marks = s.marks || '#e8893a';
    return {
      body: s.body && s.body.toLowerCase() !== '#ffffff' ? s.body : '#fbf5ea',
      shade: '#e4d6c2',
      point: M.mix ? M.mix(marks, '#fbf5ea', 0.42) : '#efb27e',
      stripe: M.shade(marks, -0.05),
      ear: '#f2b8b8',
      nose: '#e9a0a0',
      eye: '#8db8e8',
    };
  }

  /** Fecho convexo (para o contorno do corpo enrolado, que é uma "almofada" vista de cima e de lado). */
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const q of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }
  function path(ctx, pts, close = true) {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    if (close) ctx.closePath();
  }

  /** Dormindo enrolado: o corpo (uma almofada redonda), o rabo dando a volta, a cabeça deitada nas patinhas. */
  function sleeping(ctx, cam, s, C) {
    const k = s.size === 'pequeno' ? 0.82 : 1;
    const t = s.t || 0;
    const zoom = cam.zoom;
    const yaw = s.yaw ?? 1.2;
    const ax = Math.cos(yaw), ay = Math.sin(yaw); // para onde a cabeça aponta
    const bx = -ay, by = ax; // de lado
    const breath = Math.sin((t * M.TAU) / 3.2);
    const A = 17 * k, B = 12.5 * k * (1 + 0.02 * breath), Hb = 12 * k * (1 + 0.05 * breath);
    const P = (x, y, z) => cam.p({ x, y, z });
    const at = (u, v, z) => P(s.x + ax * u + bx * v, s.y + ay * u + by * v, s.z + z);
    // a sombra na almofada
    const sh = P(s.x, s.y, s.z + 0.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y + 1 * zoom, (A + 3) * zoom, (B + 3) * zoom * cam.sinP, 0, 0, M.TAU);
    ctx.fill();
    // de que lado a câmera vê (a câmera olha de +x+y): o rabo passa pela frente do corpo, do lado de lá da cabeça
    const nearSide = bx + by >= 0 ? 1 : -1;
    const headNear = ax + ay >= 0;
    const head = at(A * 0.6, nearSide * B * 0.3, Hb * 0.5);
    const hr = 6.6 * k * zoom;
    // o corpo
    const pts = [];
    for (let i = 0; i < 28; i++) {
      const q = (i / 28) * M.TAU;
      const u = Math.cos(q) * A, v = Math.sin(q) * B;
      pts.push(at(u, v, 1), at(u * 0.74, v * 0.74, Hb));
    }
    const body = hull(pts);
    const drawBody = () => {
      path(ctx, body);
      const top = at(0, 0, Hb), bot = at(0, 0, 0);
      const g = ctx.createLinearGradient(0, top.y - Hb * zoom, 0, bot.y + 6 * zoom);
      g.addColorStop(0, M.shade(C.body, 0.04));
      g.addColorStop(0.55, C.body);
      g.addColorStop(1, C.shade);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, 1.5 * zoom);
      ctx.stroke();
      // o pelo: um tufinho de luz no alto e a dobra das costas
      ctx.strokeStyle = 'rgba(190, 168, 140, 0.55)';
      ctx.lineWidth = Math.max(0.8, 1 * zoom);
      const c0 = at(-A * 0.5, -nearSide * B * 0.2, Hb * 0.95), c1 = at(A * 0.1, -nearSide * B * 0.45, Hb * 0.85);
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      ctx.quadraticCurveTo((c0.x + c1.x) / 2, (c0.y + c1.y) / 2 - 2 * zoom, c1.x, c1.y);
      ctx.stroke();
    };
    // o rabo: dá a volta pelo lado de cá, do traseiro até perto do focinho; a ponta bate de vez em quando
    const flickPhase = (t % 9.5) / 9.5;
    const flick = flickPhase > 0.9 ? Math.sin(((flickPhase - 0.9) / 0.1) * Math.PI) : 0;
    const tail = [];
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const q = Math.PI + nearSide * f * Math.PI * 0.85;
      const lift = f > 0.75 ? flick * 4 * k * ((f - 0.75) / 0.25) : 0;
      tail.push(at(Math.cos(q) * A * 1.04, Math.sin(q) * B * 1.12, 2.6 * k + lift));
    }
    const drawTail = () => {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      path(ctx, tail, false);
      ctx.strokeStyle = INK;
      ctx.lineWidth = (4.8 * k + 1.6) * zoom;
      ctx.stroke();
      path(ctx, tail, false);
      ctx.strokeStyle = C.point;
      ctx.lineWidth = 4.8 * k * zoom;
      ctx.stroke();
      // os anéis mais escuros
      ctx.strokeStyle = C.stripe;
      ctx.lineWidth = Math.max(0.8, 1.3 * zoom);
      for (let i = 3; i < N; i += 2) {
        const a = tail[i - 1], b = tail[i + 1] || tail[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const nx = (-dy / d) * 2.2 * k * zoom, ny = (dx / d) * 2.2 * k * zoom;
        ctx.beginPath();
        ctx.moveTo(tail[i].x - nx, tail[i].y - ny);
        ctx.lineTo(tail[i].x + nx, tail[i].y + ny);
        ctx.stroke();
      }
    };
    // a orelha que mexe de vez em quando (uma tremidinha rápida)
    const twPhase = ((t + 2.3) % 7.3) / 7.3;
    const twitch = twPhase > 0.94 ? Math.sin(((twPhase - 0.94) / 0.06) * Math.PI * 2) * 0.35 : 0;
    const drawHead = () => {
      // as patinhas da frente, onde a cabeça descansa
      for (const sgn of [-1, 1]) {
        ctx.fillStyle = C.body;
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(0.8, 1.1 * zoom);
        ctx.beginPath();
        ctx.ellipse(head.x + sgn * hr * 0.45, head.y + hr * 0.92, hr * 0.36, hr * 0.24, 0, 0, M.TAU);
        ctx.fill();
        ctx.stroke();
      }
      // as orelhas (rosadas por dentro, a ponta laranja)
      for (const sgn of [-1, 1]) {
        const base = sgn < 0 ? -2.2 : -0.95;
        const rot = sgn < 0 ? twitch : 0;
        const e0 = { x: head.x + Math.cos(base - 0.42) * hr * 0.98, y: head.y + Math.sin(base - 0.42) * hr * 0.98 };
        const e1 = { x: head.x + Math.cos(base + 0.42) * hr * 0.98, y: head.y + Math.sin(base + 0.42) * hr * 0.98 };
        const ang = base + rot;
        const tip = { x: head.x + Math.cos(ang) * hr * 1.75, y: head.y + Math.sin(ang) * hr * 1.75 };
        path(ctx, [e0, tip, e1]);
        ctx.fillStyle = C.body;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(0.9, 1.2 * zoom);
        ctx.stroke();
        const m = { x: (e0.x + e1.x) / 2, y: (e0.y + e1.y) / 2 };
        path(ctx, [{ x: m.x + (e0.x - m.x) * 0.55, y: m.y + (e0.y - m.y) * 0.55 }, { x: m.x + (tip.x - m.x) * 0.82, y: m.y + (tip.y - m.y) * 0.82 }, { x: m.x + (e1.x - m.x) * 0.55, y: m.y + (e1.y - m.y) * 0.55 }]);
        ctx.fillStyle = C.ear;
        ctx.fill();
        path(ctx, [{ x: tip.x + (e0.x - tip.x) * 0.32, y: tip.y + (e0.y - tip.y) * 0.32 }, tip, { x: tip.x + (e1.x - tip.x) * 0.32, y: tip.y + (e1.y - tip.y) * 0.32 }]);
        ctx.fillStyle = C.point;
        ctx.fill();
      }
      // a cabeça (um pouco mais larga que alta, com as bochechas)
      ctx.beginPath();
      ctx.ellipse(head.x, head.y, hr * 1.1, hr * 0.94, 0, 0, M.TAU);
      ctx.fillStyle = C.body;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, 1.4 * zoom);
      ctx.stroke();
      // a máscara laranja-clara: a testa com as listrinhas e o focinho
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(head.x, head.y, hr * 1.08, hr * 0.92, 0, 0, M.TAU);
      ctx.clip();
      const g = ctx.createRadialGradient(head.x, head.y - hr * 0.55, hr * 0.1, head.x, head.y - hr * 0.4, hr * 0.85);
      g.addColorStop(0, C.point);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(head.x - hr * 1.2, head.y - hr * 1.2, hr * 2.4, hr * 1.6);
      ctx.fillStyle = C.point;
      ctx.beginPath();
      ctx.ellipse(head.x, head.y + hr * 0.12, hr * 0.2, hr * 0.38, 0, 0, M.TAU);
      ctx.fill();
      ctx.strokeStyle = C.stripe;
      ctx.lineWidth = Math.max(0.6, 0.8 * zoom);
      for (const ox of [-0.22, 0, 0.22]) {
        ctx.beginPath();
        ctx.moveTo(head.x + ox * hr, head.y - hr * 0.85);
        ctx.lineTo(head.x + ox * hr * 0.7, head.y - hr * 0.45);
        ctx.stroke();
      }
      ctx.restore();
      // os olhos fechados (dormindo), o nariz rosa e a boquinha
      ctx.strokeStyle = '#4a3a30';
      ctx.lineWidth = Math.max(0.8, 1.1 * zoom);
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(head.x + sgn * hr * 0.4, head.y - hr * 0.08, hr * 0.2, 0.25, Math.PI - 0.25);
        ctx.stroke();
      }
      ctx.fillStyle = C.nose;
      path(ctx, [{ x: head.x - hr * 0.13, y: head.y + hr * 0.2 }, { x: head.x + hr * 0.13, y: head.y + hr * 0.2 }, { x: head.x, y: head.y + hr * 0.34 }]);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(head.x, head.y + hr * 0.34);
      ctx.quadraticCurveTo(head.x - hr * 0.1, head.y + hr * 0.48, head.x - hr * 0.2, head.y + hr * 0.4);
      ctx.moveTo(head.x, head.y + hr * 0.34);
      ctx.quadraticCurveTo(head.x + hr * 0.1, head.y + hr * 0.48, head.x + hr * 0.2, head.y + hr * 0.4);
      ctx.stroke();
      // os bigodes, bem clarinhos
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = Math.max(0.5, 0.6 * zoom);
      for (const sgn of [-1, 1]) {
        for (const dy of [0.28, 0.4]) {
          ctx.beginPath();
          ctx.moveTo(head.x + sgn * hr * 0.35, head.y + hr * dy);
          ctx.lineTo(head.x + sgn * hr * 1.45, head.y + hr * (dy - 0.12 + dy * 0.2));
          ctx.stroke();
        }
      }
    };
    if (headNear) {
      drawBody();
      drawTail();
      drawHead();
    } else {
      drawHead();
      drawBody();
      drawTail();
    }
    // os "z" de quem está dormindo, subindo e sumindo
    const period = 2.6;
    for (let n = 0; n < 2; n++) {
      const age = ((t + n * period * 0.5) % period) / period;
      const zx = head.x + (6 + age * 10) * zoom + Math.sin(age * 6) * 2 * zoom;
      const zy = head.y - hr * 1.6 - age * 22 * zoom;
      const size = Math.max(7, Math.min(13, (7 + age * 5) * zoom * 1.4));
      ctx.globalAlpha *= 1;
      const a = age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85;
      ctx.save();
      ctx.globalAlpha *= Math.max(0, a) * 0.9;
      ctx.font = `800 ${size.toFixed(1)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = 'rgba(27, 16, 13, 0.7)';
      ctx.strokeText('z', zx, zy);
      ctx.fillStyle = '#eef4ff';
      ctx.fillText('z', zx, zy);
      ctx.restore();
    }
    return { top: Math.min(head.y - hr * 1.8, at(0, 0, Hb).y) };
  }

  /** O nome em cima (como o dos NPCs: verde-água, com a sombra preta). */
  function nameTag(ctx, x, y, name) {
    ctx.save();
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText(name, x, y);
    ctx.fillStyle = '#8fe3c8';
    ctx.fillText(name, x, y);
    ctx.restore();
  }

  function draw(ctx, cam, s) {
    const C = colorsOf(s);
    const r = sleeping(ctx, cam, s, C);
    if (s.name) {
      const p = cam.p({ x: s.x, y: s.y, z: s.z });
      nameTag(ctx, p.x, Math.min(r.top, p.y - 30 * cam.zoom) - 6, s.name);
    }
  }

  PD.gato = { draw, colorsOf, nameTag };

  // ------------------------------------------------------------------ o Joaquim que anda (criatura da PD.View)
  // A [estrutura] fez o comportamento (o bicho `pet` 'joaquim', 14/11): dorme no sofá da vó, acorda e se espreguiça
  // ('wake', 1,6 s), pula para o chão (`dash`), passeia, mia para quem chega ('meow', com o ângulo), ronrona no carinho
  // ('purr': o coração; dormindo, continua dormindo) e volta a deitar no sofá ('sleep').
  // Acordado, ele é PINTADO como o gato enrolado (um contorno liso em cada parte, degradê, o rosto desenhado), em cima de
  // um esqueleto 3D: cada pose (em pé, sentado, espreguiçando, no pulo, enrolado) é um jogo de pontos e o desenho passa
  // de uma para a outra; as pernas dobram sozinhas (IK) e andam no passo de gato. Dormindo, é o desenho aprovado do gato
  // enrolado (o `sleeping` daqui de cima). As bolas da criatura servem só para a sombra no chão e para a caixa.
  if (!PD.creatures) return;
  const C = PD.creatures;
  const S = 1.1;
  /** Altura do assento do sofá, onde ele dorme (o ponto de dormir do mapa fica em cima do sofá). */
  const PERCH = 46;
  /** Quanto o corpo anda (cm, antes da escala) a cada passada completa das quatro patas. */
  const STRIDE = 30;
  /** Altura (cm, antes da escala) do tornozelo: a patinha fica embaixo dele, no chão. */
  const ANKLE = 1.6;
  // as cores das fotos do Joaquim: creme quente, as pontas laranja-claras de flame point, rosa nas orelhas e no nariz
  const FUR = { light: '#fffaf3', base: '#f6ede0', shade: '#e2d0b8', far: '#dcc8ad' };
  const POINT = { light: '#f5c79e', base: '#eca873', ring: 'rgba(212, 128, 66, 0.6)' };
  const EYE = { light: '#c4def6', iris: '#8cb8e6', rim: '#557fae', pupil: '#1d1612' };
  const LINE = '#3a2a22';
  const SLEEP_COLORS = colorsOf({});

  /** Joelho entre a raiz e a ponta (ossos l1 e l2), dobrando para o lado de `hint`. */
  function bend(a, b, l1, l2, hint) {
    const d = M.sub(b, a);
    let dl = M.len(d) || 1e-3;
    const dir = M.scale(d, 1 / dl);
    dl = Math.min(dl, l1 + l2 - 0.01);
    const along = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl);
    const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const p = M.sub(hint, M.scale(dir, M.dot(hint, dir)));
    const pl = M.len(p) || 1;
    return M.add(M.add(a, M.scale(dir, along)), M.scale(p, h / pl));
  }
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

  // as poses: [frente, lado, altura] em cm (antes da escala); o pé das patas é rente ao chão. Proporção de gatinho:
  // cabeça grande, perna curta, corpo redondo
  const STAND = {
    hip: [-7.5, 0, 13], chest: [6.5, 0, 12.5], head: [13.5, 0, 21],
    rear: [[-8, -3.1, 0], [-8, 3.1, 0]], front: [[7.5, -2.7, 0], [7.5, 2.7, 0]],
    // o rabo em pé, com a ponta virando (o "ponto de interrogação" do gato contente)
    tail: [[-12.5, 0, 14.5], [-17.5, 0, 17.5], [-20, 0.8, 22], [-19.5, 3.5, 26.5], [-16.5, 7, 28.5]],
  };
  const SIT = {
    hip: [-4.5, 0, 7.5], chest: [2.5, 0, 14], head: [5, 0, 24],
    rear: [[0.5, -4.6, 0], [0.5, 4.6, 0]], front: [[5.5, -2.3, 0], [5.5, 2.3, 0]],
    // sentado, o rabo dá a volta no chão e encosta nas patas da frente
    tail: [[-9.5, 0, 2.5], [-9.5, 5, 1.5], [-5, 8.5, 1.5], [1, 9, 1.5], [6, 6.8, 1.5]],
  };
  const CURL = {
    hip: [-6, -1.5, 7.5], chest: [5, 1.5, 7.5], head: [10, 3.5, 7],
    rear: [[-4, -3, 1], [-4, 3, 1]], front: [[11, 1, 1.5], [11, 5, 1.5]],
    tail: [[-12, 0, 3], [-10, 7, 2.5], [-2, 11, 2.5], [6, 10.5, 2.5], [11, 7.5, 3]],
  };
  // espreguiçando (o 'wake'): as patas da frente esticadas, o peito baixo e o traseiro alto
  const STRETCH = {
    hip: [-8.5, 0, 15], chest: [7, 0, 7.5], head: [14, 0, 10],
    rear: [[-9, -3.1, 0], [-9, 3.1, 0]], front: [[19, -2.7, 0], [19, 2.7, 0]],
    tail: [[-13.5, 0, 16], [-17, 0, 22], [-17, 1, 28], [-15, 3, 32], [-12, 4.5, 34]],
  };
  // no pulo: o corpo esticado, as patas da frente buscando o chão lá na frente e as de trás empurrando para trás
  const LEAP = {
    hip: [-9.5, 0, 13], chest: [8.5, 0, 14.5], head: [15.5, 0, 20.5],
    rear: [[-19, -3, 7], [-19, 3, 7]], front: [[17, -3, 6], [17, 3, 6]],
    tail: [[-14, 0, 14.5], [-20, 0, 16], [-26, 0, 18], [-31, 1, 20.5], [-34, 2, 22.5]],
  };
  function blendPose(a, b, k) {
    if (k <= 0) return a;
    if (k >= 1) return b;
    return {
      hip: mix(a.hip, b.hip, k), chest: mix(a.chest, b.chest, k), head: mix(a.head, b.head, k),
      rear: a.rear.map((p, i) => mix(p, b.rear[i], k)), front: a.front.map((p, i) => mix(p, b.front[i], k)),
      tail: a.tail.map((p, i) => mix(p, b.tail[i], k)),
    };
  }

  /** Curva suave (Catmull-Rom) pelos pontos 3D, com `n` pontos por trecho. */
  function spline(pts, n) {
    const out = [];
    const f = (a, b, c, d, t) => {
      const t2 = t * t, t3 = t2 * t;
      return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
    };
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < n; k++) {
        const t = k / n;
        out.push({ x: f(p0.x, p1.x, p2.x, p3.x, t), y: f(p0.y, p1.y, p2.y, p3.y, t), z: f(p0.z, p1.z, p2.z, p3.z, t) });
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /** Contorno liso em volta de círculos de tela ({ x, y, r }): o fecho convexo deles (o corpo e a cabeça, num risco só). */
  function blob(circles, n = 20) {
    const pts = [];
    for (const c of circles) for (let i = 0; i < n; i++) {
      const a = (i / n) * M.TAU;
      pts.push({ x: c.x + Math.cos(a) * c.r, y: c.y + Math.sin(a) * c.r });
    }
    return hull(pts);
  }

  /**
   * Caminho de um membro que afina (perna, rabo), em px de tela: os pontos do meio, o raio em cada um e a ponta
   * redonda no fim. O começo fica aberto (emenda no corpo): pintar fecha sozinho; riscar não risca o começo.
   */
  function limbPath(ctx, ptsIn, radsIn) {
    // pontos quase em cima um do outro na tela (o rabo vindo na direção de quem olha) torciam a ponta: saem antes
    const pts = [ptsIn[0]], rads = [radsIn[0]];
    for (let i = 1; i < ptsIn.length; i++) {
      const last = pts[pts.length - 1];
      const end = i === ptsIn.length - 1;
      if (Math.hypot(ptsIn[i].x - last.x, ptsIn[i].y - last.y) < Math.max(0.6, radsIn[i] * 0.45)) {
        if (end && pts.length > 1) {
          pts[pts.length - 1] = ptsIn[i];
          rads[rads.length - 1] = radsIn[i];
        }
        continue;
      }
      pts.push(ptsIn[i]);
      rads.push(radsIn[i]);
    }
    const n = pts.length;
    const Ls = [], Rs = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      Ls.push({ x: pts[i].x - dy * rads[i], y: pts[i].y + dx * rads[i] });
      Rs.push({ x: pts[i].x + dy * rads[i], y: pts[i].y - dx * rads[i] });
    }
    const e = pts[n - 1], prev = pts[Math.max(0, n - 3)];
    const ang = Math.atan2(e.y - prev.y, e.x - prev.x);
    ctx.beginPath();
    ctx.moveTo(Ls[0].x, Ls[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(Ls[i].x, Ls[i].y);
    ctx.arc(e.x, e.y, rads[n - 1], ang + Math.PI / 2, ang - Math.PI / 2, true);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rs[i].x, Rs[i].y);
  }

  /** Triângulo de orelha com os lados um pouco abaulados (a, b: a base; q: a ponta), em px de tela. */
  function earPath(ctx, a, q, b, bulge = 0.12) {
    const c1 = { x: (a.x + q.x) / 2 - (q.y - a.y) * bulge, y: (a.y + q.y) / 2 + (q.x - a.x) * bulge };
    const c2 = { x: (q.x + b.x) / 2 - (b.y - q.y) * bulge, y: (q.y + b.y) / 2 + (b.x - q.x) * bulge };
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(c1.x, c1.y, q.x, q.y);
    ctx.quadraticCurveTo(c2.x, c2.y, b.x, b.y);
    ctx.closePath();
  }

  // ------------------------------------------------------------------ o desenho pintado (acordado)
  function drawLeg(ctx, cam, L, inkW, inFront) {
    const z = cam.zoom;
    const pts = L.pts.map((p) => cam.p(p));
    const rads = L.rads.map((r) => r * z);
    const fill = L.near ? FUR.base : FUR.far;
    limbPath(ctx, pts, rads);
    if (inFront) {
      // na frente da barriga, a perna nasce do peito: o começo dela some no pelo (sem retângulo chapado)
      const g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[2].x, pts[2].y);
      g.addColorStop(0, 'rgba(246, 237, 224, 0)');
      g.addColorStop(0.55, fill);
      g.addColorStop(1, fill);
      ctx.fillStyle = g;
    } else ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = fill;
    // na frente da barriga (sentado), o risco começa no meio da coxa: a perna sai do peito, sem emenda riscada
    const from = inFront ? 1 : 0;
    limbPath(ctx, pts.slice(from), rads.slice(from));
    ctx.strokeStyle = C.INK;
    ctx.lineWidth = inkW;
    ctx.stroke();
    // a patinha: um ovinho no chão, um pouco para a frente do tornozelo
    const q = cam.p(L.paw);
    const rx = L.pawR * z;
    ctx.beginPath();
    ctx.ellipse(q.x, q.y, rx, rx * 0.62, 0, 0, M.TAU);
    ctx.fill();
    ctx.stroke();
    if (z >= 1.6 && L.near) {
      // os dedinhos
      ctx.strokeStyle = 'rgba(120, 92, 70, 0.55)';
      ctx.lineWidth = Math.max(0.7, 0.45 * z);
      for (const k of [-0.32, 0.32]) {
        ctx.beginPath();
        ctx.moveTo(q.x + rx * k, q.y + rx * 0.08);
        ctx.lineTo(q.x + rx * k * 0.9, q.y + rx * 0.5);
        ctx.stroke();
      }
    }
  }

  function drawTail(ctx, cam, R, inkW) {
    const z = cam.zoom;
    const pts = R.tail.map((p) => cam.p(p));
    const rads = R.tailR.map((r) => r * z);
    const a = pts[0], b = pts[pts.length - 1];
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, FUR.base);
    g.addColorStop(0.3, POINT.light);
    g.addColorStop(1, POINT.base);
    limbPath(ctx, pts, rads);
    ctx.fillStyle = g;
    ctx.fill();
    // os aneizinhos mais escuros, de través
    ctx.save();
    limbPath(ctx, pts, rads);
    ctx.clip();
    ctx.strokeStyle = POINT.ring;
    ctx.lineWidth = Math.max(1, 1.05 * z);
    for (const f of [0.45, 0.6, 0.75, 0.9]) {
      const i = Math.min(pts.length - 2, Math.max(1, Math.round(f * (pts.length - 1))));
      const p = pts[i], pa = pts[i - 1], pb = pts[i + 1];
      const dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 1;
      const nx = (-dy / d) * rads[i] * 1.3, ny = (dx / d) * rads[i] * 1.3;
      ctx.beginPath();
      ctx.moveTo(p.x - nx, p.y - ny);
      ctx.quadraticCurveTo(p.x + (dx / d) * rads[i] * 0.5, p.y + (dy / d) * rads[i] * 0.5, p.x + nx, p.y + ny);
      ctx.stroke();
    }
    ctx.restore();
    limbPath(ctx, pts, rads);
    ctx.strokeStyle = C.INK;
    ctx.lineWidth = inkW;
    ctx.stroke();
  }

  function drawBody(ctx, cam, R, inkW) {
    const z = cam.zoom;
    const shapes = R.bodyParts.map((part) => blob(part.map((b) => { const q = cam.p(b.c); return { x: q.x, y: q.y, r: b.r * z }; })));
    const union = () => {
      ctx.beginPath();
      for (const sh of shapes) {
        sh.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
      }
    };
    let y0 = Infinity, y1 = -Infinity;
    for (const sh of shapes) for (const p of sh) {
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
    // o contorno: cada parte riscada com o dobro da tinta; o recheio por cima apaga o risco de dentro (sobra só a
    // borda de fora das duas juntas)
    ctx.strokeStyle = C.INK;
    ctx.lineWidth = inkW * 2;
    for (const sh of shapes) {
      path(ctx, sh);
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, FUR.light);
    g.addColorStop(0.5, FUR.base);
    g.addColorStop(1, FUR.shade);
    union();
    ctx.fillStyle = g;
    ctx.fill();
    // a coxa do lado de cá (a frente dela, um risco suave): de lado, é ela que faz o corpo virar corpo de gato
    if (R.haunch && R.haunch.alpha > 0.02) {
      const hp = R.haunch.pts.map((p) => cam.p(p));
      ctx.save();
      union();
      ctx.clip();
      ctx.globalAlpha *= R.haunch.alpha;
      ctx.strokeStyle = 'rgba(150, 116, 84, 0.6)';
      ctx.lineWidth = Math.max(1, 1 * z);
      path(ctx, hp, false);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEar(ctx, cam, e, inkW, over) {
    const a = cam.p(e.pIn), b = cam.p(e.pOut), q = cam.p(e.tip);
    const shape = hull([a, b, cam.p(e.pBack), q]);
    const cx = shape.reduce((s, p) => s + p.x, 0) / shape.length;
    const cy = shape.reduce((s, p) => s + p.y, 0) / shape.length;
    // os lados que tocam a ponta saem abaulados; a base (o resto) é reta e fica dentro da cabeça
    const i = shape.indexOf(q);
    const edge = (p0, p1, moveFirst) => {
      if (moveFirst) ctx.moveTo(p0.x, p0.y);
      if (p0 !== q && p1 !== q) return ctx.lineTo(p1.x, p1.y);
      const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
      let nx = -(p1.y - p0.y), ny = p1.x - p0.x;
      if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
      ctx.quadraticCurveTo(mx + nx * 0.12, my + ny * 0.12, p1.x, p1.y);
    };
    ctx.beginPath();
    for (let k = 0; k < shape.length; k++) edge(shape[k], shape[(k + 1) % shape.length], k === 0);
    ctx.closePath();
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const g = ctx.createLinearGradient(m.x, m.y, q.x, q.y);
    g.addColorStop(0, FUR.base);
    g.addColorStop(0.62, FUR.base);
    g.addColorStop(1, POINT.light);
    ctx.fillStyle = g;
    ctx.fill();
    if (e.inside) {
      // por dentro, rosada (só quando a abertura está virada para quem olha), mais clara na ponta
      const k = (p, f) => ({ x: m.x + (p.x - m.x) * f, y: m.y + (p.y - m.y) * f });
      const gi = ctx.createLinearGradient(m.x, m.y, q.x, q.y);
      gi.addColorStop(0, '#e79f9a');
      gi.addColorStop(1, '#f7cfc6');
      earPath(ctx, k(a, 0.68), k(q, 0.82), k(b, 0.68), 0.05);
      ctx.fillStyle = gi;
      ctx.fill();
    }
    ctx.strokeStyle = C.INK;
    ctx.lineWidth = inkW;
    ctx.beginPath();
    if (over && i >= 0) {
      // na frente da cabeça: só os dois lados da ponta (a base emenda na cabeça, sem risco)
      const p0 = shape[(i - 1 + shape.length) % shape.length], p1 = shape[(i + 1) % shape.length];
      edge(p0, q, true);
      edge(q, p1, false);
    } else {
      for (let k = 0; k < shape.length; k++) edge(shape[k], shape[(k + 1) % shape.length], k === 0);
      ctx.closePath();
    }
    ctx.stroke();
  }

  /** O rosto, pintado na frente da cabeça: cada detalhe no plano que encosta nela (encurta quando ela vira). */
  function drawFace(ctx, cam, R) {
    const h = R.head, F = R.face;
    const z = cam.zoom;
    const r = h.r;
    const tc = cam.toCamera;
    const thin = (px) => px / z; // grossura em px de tela → unidades do plano do rosto (cm)
    const spot = (f, s, u) => {
      const n = M.norm({ x: h.f.x * f + h.s.x * s + h.u.x * u, y: h.f.y * f + h.s.y * s + h.u.y * u, z: h.f.z * f + h.s.z * s + h.u.z * u });
      return { c: M.add(h.c, M.scale(n, r)), n };
    };
    const local = (sp, mirror, draw, minFacing = 0.06) => {
      if (M.dot(sp.n, tc) < minFacing) return;
      const u = M.norm(M.sub(h.s, M.scale(sp.n, M.dot(h.s, sp.n))));
      let v = M.norm(M.cross(u, sp.n));
      if (M.dot(v, h.u) < 0) v = M.scale(v, -1);
      const a = cam.pDir(u), b = cam.pDir(v), q = cam.p(sp.c);
      ctx.save();
      // x para o lado de fora (espelhado do outro lado), y para cima
      ctx.transform(a.x * mirror, a.y * mirror, b.x, b.y, q.x, q.y);
      draw();
      ctx.restore();
    };
    // a máscara laranja-clara na testa (esfumada) e as listrinhas
    local(spot(0.5, 0, 0.75), 1, () => {
      const g = ctx.createRadialGradient(0, -0.15 * r, 0, 0, -0.1 * r, 0.72 * r);
      g.addColorStop(0, 'rgba(245, 199, 158, 0.95)');
      g.addColorStop(0.6, 'rgba(245, 199, 158, 0.55)');
      g.addColorStop(1, 'rgba(245, 199, 158, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, 2 * r, 2 * r);
      if (z >= 0.95) {
        ctx.strokeStyle = 'rgba(214, 136, 76, 0.75)';
        ctx.lineWidth = Math.max(thin(0.9), 0.24);
        ctx.lineCap = 'round';
        for (const x of [-0.2, 0, 0.2]) {
          ctx.beginPath();
          ctx.moveTo(x * r * 1.1, -0.32 * r);
          ctx.quadraticCurveTo(x * r * 1.05, 0.02 * r, x * r * 0.7, 0.3 * r);
          ctx.stroke();
        }
      }
    }, -0.05);
    // a faixa laranja do nariz (entre os olhos até a ponta)
    local(spot(0.93, 0, 0.06), 1, () => {
      ctx.save();
      ctx.scale(0.32, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.5 * r);
      g.addColorStop(0, 'rgba(236, 168, 115, 0.9)');
      g.addColorStop(1, 'rgba(236, 168, 115, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, 2 * r, 2 * r);
      ctx.restore();
    });
    // os olhos: amêndoas grandes, azuis, com a pupila e o brilho; fechados, um risquinho curvo (como dormindo)
    const ew = 0.27 * r, eh = 0.215 * r;
    for (const sg of [-1, 1]) {
      local(spot(0.8, 0.43 * sg, 0.1), sg, () => {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (F.closed) {
          ctx.strokeStyle = LINE;
          ctx.lineWidth = Math.max(thin(1), 0.3);
          ctx.beginPath();
          ctx.moveTo(-ew, 0.05 * eh);
          ctx.quadraticCurveTo(0, -0.75 * eh, ew, 0.15 * eh);
          ctx.stroke();
          return;
        }
        const lid = () => {
          ctx.beginPath();
          ctx.moveTo(-ew, -0.05 * eh);
          ctx.bezierCurveTo(-0.62 * ew, 1.08 * eh, 0.55 * ew, 1.12 * eh, ew, 0.28 * eh);
          ctx.bezierCurveTo(0.62 * ew, -0.92 * eh, -0.55 * ew, -0.98 * eh, -ew, -0.05 * eh);
          ctx.closePath();
        };
        lid();
        const g = ctx.createRadialGradient(0.05 * ew, -0.25 * eh, 0.1 * eh, 0, 0.1 * eh, 1.15 * ew);
        g.addColorStop(0, EYE.light);
        g.addColorStop(0.55, EYE.iris);
        g.addColorStop(1, EYE.rim);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.save();
        lid();
        ctx.clip();
        // a pupila (olha um tiquinho para a frente) e o brilho
        ctx.fillStyle = EYE.pupil;
        ctx.beginPath();
        ctx.ellipse(-0.05 * ew, 0.05 * eh, 0.34 * ew, 0.8 * eh, 0, 0, M.TAU);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-0.28 * ew, 0.42 * eh, 0.2 * ew, 0, M.TAU);
        ctx.fill();
        // o contorno, mais grosso em cima (a pálpebra)
        lid();
        ctx.strokeStyle = LINE;
        ctx.lineWidth = Math.max(thin(0.8), 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-ew, -0.05 * eh);
        ctx.bezierCurveTo(-0.62 * ew, 1.08 * eh, 0.55 * ew, 1.12 * eh, ew, 0.28 * eh);
        ctx.lineWidth = Math.max(thin(1.3), 0.34);
        ctx.stroke();
      });
    }
    // o nariz rosa (triângulo de pontas redondas), a boca em "w"; miando, a boca aberta
    local(spot(0.97, 0, -0.17), 1, () => {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-0.13 * r, 0.05 * r);
      ctx.quadraticCurveTo(0, 0.1 * r, 0.13 * r, 0.05 * r);
      ctx.quadraticCurveTo(0.03 * r, -0.08 * r, 0, -0.09 * r);
      ctx.quadraticCurveTo(-0.03 * r, -0.08 * r, -0.13 * r, 0.05 * r);
      ctx.fillStyle = '#e8a19b';
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 60, 52, 0.8)';
      ctx.lineWidth = Math.max(thin(0.6), 0.14);
      ctx.stroke();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = Math.max(thin(0.85), 0.2);
      if (F.meow > 0.15) {
        const m = F.meow;
        ctx.beginPath();
        ctx.ellipse(0, -0.24 * r, 0.12 * r * (0.6 + 0.4 * m), 0.13 * r * m + 0.02 * r, 0, 0, M.TAU);
        ctx.fillStyle = '#5c2622';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, -0.31 * r * (0.7 + 0.3 * m), 0.07 * r, 0.04 * r * m, 0, 0, M.TAU);
        ctx.fillStyle = '#e88b8b';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -0.09 * r);
        ctx.lineTo(0, -0.17 * r);
        ctx.quadraticCurveTo(-0.04 * r, -0.25 * r, -0.14 * r, -0.2 * r);
        ctx.moveTo(0, -0.17 * r);
        ctx.quadraticCurveTo(0.04 * r, -0.25 * r, 0.14 * r, -0.2 * r);
        ctx.stroke();
      }
    });
  }

  /** Os bigodes: brancos, saindo do focinho por cima do contorno (só de perto, senão viram sujeira). */
  function drawWhiskers(ctx, cam, R) {
    const h = R.head, z = cam.zoom, r = h.r;
    if (z < 1) return;
    for (const sg of [-1, 1]) {
      const n = M.norm({ x: h.f.x * 0.9 + h.s.x * 0.32 * sg - h.u.x * 0.28, y: h.f.y * 0.9 + h.s.y * 0.32 * sg - h.u.y * 0.28, z: h.f.z * 0.9 + h.s.z * 0.32 * sg - h.u.z * 0.28 });
      if (M.dot(n, cam.toCamera) < 0.1) continue;
      const base = cam.p(M.add(h.c, M.scale(n, r * 0.98)));
      // para fora do focinho, quase deitado na tela (de lado, o "para fora" da cabeça cai para baixo na tela)
      const d = cam.pDir(M.add(M.scale(h.s, sg), M.scale(h.f, 0.7)));
      let dx = d.x, dy = d.y * 0.3;
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const len = 0.8 * r * z;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = Math.max(0.6, 0.32 * z);
      ctx.lineCap = 'round';
      for (const tilt of [-0.16, 0.12]) {
        const ex = dx * Math.cos(tilt) - dy * Math.sin(tilt), ey = dx * Math.sin(tilt) + dy * Math.cos(tilt);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y + tilt * 6 * z);
        ctx.quadraticCurveTo(base.x + ex * len * 0.55, base.y + ey * len * 0.55 + tilt * 6 * z - 0.6 * z, base.x + ex * len, base.y + ey * len + tilt * 10 * z);
        ctx.stroke();
      }
    }
  }

  function drawHead(ctx, cam, R, inkW) {
    const z = cam.zoom;
    const h = R.head;
    const H = (f, s, u) => ({
      x: h.c.x + (h.f.x * f + h.s.x * s + h.u.x * u) * h.r,
      y: h.c.y + (h.f.y * f + h.s.y * s + h.u.y * u) * h.r,
      z: h.c.z + (h.f.z * f + h.s.z * s + h.u.z * u) * h.r,
    });
    // a cabeça de gato: o crânio redondo, as bochechas (mais larga embaixo) e o focinho curto, num contorno só
    const circles = [[h.c, 1], [H(0.12, -0.48, -0.26), 0.58], [H(0.12, 0.48, -0.26), 0.58], [H(0.64, 0, -0.33), 0.4]].map(([c, k]) => {
      const q = cam.p(c);
      return { x: q.x, y: q.y, r: k * h.r * z };
    });
    const shape = blob(circles);
    for (const e of R.ears) if (!e.front) drawEar(ctx, cam, e, inkW, false);
    const q0 = circles[0];
    const Lt = cam.lightScreen;
    const g = ctx.createRadialGradient(q0.x + Lt.x * q0.r * 0.45, q0.y + Lt.y * q0.r * 0.45, q0.r * 0.1, q0.x, q0.y, q0.r * 1.35);
    g.addColorStop(0, FUR.light);
    g.addColorStop(0.55, FUR.base);
    g.addColorStop(1, FUR.shade);
    path(ctx, shape);
    ctx.fillStyle = g;
    ctx.fill();
    if (R.face.show) {
      ctx.save();
      path(ctx, shape);
      ctx.clip();
      drawFace(ctx, cam, R);
      ctx.restore();
    }
    path(ctx, shape);
    ctx.strokeStyle = C.INK;
    ctx.lineWidth = inkW;
    ctx.stroke();
    if (R.face.show) drawWhiskers(ctx, cam, R);
    for (const e of R.ears) if (e.front) drawEar(ctx, cam, e, inkW, true);
  }

  /** O Joaquim acordado, de trás para a frente: pernas (atrás do corpo), rabo e cabeça na ordem de quem está mais perto. */
  function paintAwake(ctx, cam, R) {
    const z = cam.zoom;
    const inkW = Math.max(1, 1.2 * z);
    const near = (v) => v.x * R.toCamH.x + v.y * R.toCamH.y;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const legs = R.legs.slice().sort((a, b) => near(a.paw) - near(b.paw));
    const bodyNear = near(R.mid);
    const tailFront = near(R.tail[Math.floor(R.tail.length / 2)]) > bodyNear + 1;
    const headFront = near(R.head.c) + 2.5 > bodyNear;
    for (const L of legs) if (!L.inFront) drawLeg(ctx, cam, L, inkW, false);
    if (!tailFront) drawTail(ctx, cam, R, inkW);
    if (!headFront) drawHead(ctx, cam, R, inkW);
    drawBody(ctx, cam, R, inkW);
    for (const L of legs) if (L.inFront) drawLeg(ctx, cam, L, inkW, true);
    if (tailFront) drawTail(ctx, cam, R, inkW);
    if (headFront) drawHead(ctx, cam, R, inkW);
    ctx.restore();
  }

  class Joaquim extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 14 * S;
      this.top = 34 * S;
      this.asleep = false;
      this.curl = 0;
      this.sit = 0;
      this.still = 0;
      this.walk = 0;
      /** Altura (cm) do que está embaixo dele: o assento do sofá, ou 0 no chão. */
      this.perch = 0;
      this.jump = null;
      /** A cabeça virada em relação ao corpo (radianos): parado, ele olha para quem está perto. */
      this.look = 0;
      /** Piscar: segundos desde a última piscada e quando vem a próxima. */
      this.blinkT = 0;
      this.blinkNext = 2 + Math.random() * 3;
      this.acts = { wake: { dur: 1.6 }, sleep: { dur: 0.6 }, meow: { dur: 1.2 }, purr: { dur: 1.9 }, dash: { dur: 0.45 } };
      this.ownDeath = true;
      /** O esqueleto do último quadro (o desenho), as bolas (a sombra) e o que vai por cima (coração, miado). */
      this._rig = null;
      this._groups = null;
      this._overlay = null;
    }

    /** Já está dormindo quando aparece (o `asleep` do motor): enrolado em cima do sofá. */
    setAsleep(v) {
      this.asleep = !!v;
      this.curl = v ? 1 : 0;
      this.perch = v ? PERCH : 0;
    }

    at(along, side, z, yaw = this.yaw) {
      return super.at(along, side, z + this.perch, yaw);
    }

    /** O pulo do sofá (e de volta): um arco, não um teletransporte. Do sofá para o chão e do chão para o sofá. */
    moveTo(x, y, yaw, durationMs, dash) {
      if (!dash) return super.moveTo(x, y, yaw, durationMs, false);
      const up = this.perch < PERCH / 2;
      this.jump = { from: { x: this.pos.x, y: this.pos.y, z: this.perch }, to: { x, y, z: up ? PERCH : 0 }, t: 0, dur: 0.42 };
      const dx = x - this.pos.x, dy = y - this.pos.y;
      // vira para onde pula (o ângulo do servidor é para onde ele olha depois)
      this.yawTarget = Math.hypot(dx, dy) > 5 ? Math.atan2(dy, dx) : Number.isFinite(yaw) ? yaw : this.yawTarget;
    }

    action(kind, yaw) {
      if (kind === 'sleep') this.asleep = true;
      if (kind === 'wake') this.asleep = false;
      // miando ou recebendo carinho acordado, vira para quem chegou; dormindo, não se mexe
      if ((kind === 'meow' || kind === 'purr') && this.asleep) yaw = undefined;
      super.action(kind, yaw);
    }

    update(dt, near) {
      const j = this.jump;
      if (j) {
        j.t = Math.min(j.dur, j.t + dt);
        const k = j.t / j.dur;
        this.pos.x = M.lerp(j.from.x, j.to.x, k);
        this.pos.y = M.lerp(j.from.y, j.to.y, k);
        this.perch = M.lerp(j.from.z, j.to.z, k) + 28 * 4 * k * (1 - k);
        this._from = { x: this.pos.x, y: this.pos.y };
        this._to = { x: this.pos.x, y: this.pos.y };
        this._t = this._dur = 1;
        if (k >= 1) {
          this.perch = j.to.z;
          this.jump = null;
        }
      }
      super.update(dt, near);
    }

    animate(dt) {
      const act = this.act;
      const moving = this.speed > 10 && !this.jump;
      this.still = moving ? 0 : this.still + dt;
      this.curl = M.damp(this.curl, this.asleep ? 1 : 0, this.asleep ? 5 : 8, dt);
      const waking = act && act.kind === 'wake';
      const wantSit = !this.asleep && !this.jump && !waking && this.still > 1.1;
      this.sit = M.damp(this.sit, wantSit ? 1 : 0, wantSit ? 3 : 9, dt);
      this.walk = M.damp(this.walk, moving ? 1 : 0, 8, dt);
      this.phase = (this.phase + (this.speed * dt) / (STRIDE * S)) % 1;
      // parado e acordado, a cabeça segue quem está perto (até uns 60° para cada lado)
      let look = 0;
      const hero = this.near && this.near.hero;
      if (hero && !this.asleep && !moving && !this.jump && !waking) {
        const dx = hero.x - this.pos.x, dy = hero.y - this.pos.y;
        if (Math.hypot(dx, dy) < 350) look = M.clamp(M.angleDiff(this.yaw, Math.atan2(dy, dx)), -1.05, 1.05);
      }
      this.look = M.damp(this.look, look, 5, dt);
      // piscar de vez em quando
      this.blinkT += dt;
      if (this.blinkT > this.blinkNext) {
        this.blinkT = 0;
        this.blinkNext = 2.2 + Math.random() * 3.5;
      }
      this.label = this.asleep ? 'dormindo' : this.jump ? 'pulando' : moving ? 'andando' : this.sit > 0.5 ? 'sentado' : 'parado';
    }

    /** Quanto do desenho de dormir (o gato enrolado aprovado) aparece: 0 acordado, 1 dormindo. */
    sleepLook() {
      return M.smoothstep(0.72, 0.9, this.curl);
    }

    drawable(cam, primary) {
      const d = super.drawable(cam, primary);
      const w = this.sleepLook();
      // em cima do sofá: na ordem de desenho, depois dele (o pé dele fica dentro do pé do sofá)
      d.lift = this.perch > 10 ? 1 : 0;
      const seat = this.perch > 10 && !this.jump;
      const groups = this._groups;
      const rig = this._rig;
      const z0 = this.groundZ;
      const perch = this.perch;
      const rigShadow = d.drawShadow;
      if (w > 0.5) this.top = perch + 30;
      // a sombra do chão (antes de tudo o que está em pé); em cima do sofá ela vai no assento, junto com o desenho
      d.drawShadow = (ctx) => {
        if (perch > 10 || w >= 1) return;
        if (w <= 0) return rigShadow(ctx);
        ctx.save();
        ctx.globalAlpha *= 1 - w;
        rigShadow(ctx);
        ctx.restore();
      };
      d.draw = (ctx) => {
        if (w < 1 && rig) {
          ctx.save();
          if (w > 0) ctx.globalAlpha *= 1 - w;
          if (seat && groups) C.drawShadow(ctx, cam, groups, z0 + perch);
          paintAwake(ctx, cam, rig);
          ctx.restore();
        }
        if (w > 0) {
          ctx.save();
          ctx.globalAlpha *= w;
          sleeping(ctx, cam, { x: this.pos.x, y: this.pos.y, z: z0 + perch, yaw: this.yaw, t: this.time }, SLEEP_COLORS);
          ctx.restore();
        }
        if (this._overlay) this._overlay(ctx);
      };
      return d;
    }

    parts(cam) {
      const t = this.time;
      const act = this.act;
      // a pose: em pé → sentado → enrolado; espreguiçando e no pulo, por cima
      const sitK = M.smoothstep(0, 1, this.sit);
      let pose = blendPose(STAND, SIT, sitK);
      pose = blendPose(pose, CURL, M.smoothstep(0, 1, this.curl));
      if (act && act.kind === 'wake') {
        const u = act.t / act.dur;
        const k = u < 0.2 ? M.smoothstep(0, 0.2, u) : u > 0.75 ? 1 - M.smoothstep(0.75, 1, u) : 1;
        pose = blendPose(pose, STRETCH, k);
      }
      const jumpK = this.jump ? Math.sin((this.jump.t / this.jump.dur) * Math.PI) : 0;
      if (jumpK > 0) pose = blendPose(pose, LEAP, M.smoothstep(0, 0.55, jumpK));
      const breath = Math.sin(t * (this.asleep ? 1.9 : 3.2)) * (this.asleep ? 0.7 : 0.35);
      const ph = this.phase * M.TAU;
      const walk = this.walk * (1 - this.curl) * (1 - jumpK);
      // andando, o corpo sobe um tiquinho a cada pata que apoia
      const bob = walk * 0.5 * Math.abs(Math.sin(ph * 2));
      const at = (p, dz = 0) => this.at(p[0] * S, p[1] * S, (p[2] + dz) * S);
      const hip = at(pose.hip, breath * 0.5 + bob * 0.7);
      const chest = at(pose.chest, breath + bob);
      const fwd = { x: Math.cos(this.yaw), y: Math.sin(this.yaw), z: 0 };
      const side = { x: -Math.sin(this.yaw), y: Math.cos(this.yaw), z: 0 };
      const toCamH = M.norm({ x: cam.toCamera.x, y: cam.toCamera.y, z: 0 });
      const near = (v) => v.x * toCamH.x + v.y * toCamH.y;

      // a cabeça: vira para quem está perto e sobe no miado
      const meow = act && act.kind === 'meow' ? Math.sin(Math.min(1, act.t / 0.5) * Math.PI) : 0;
      const purr = !!(act && act.kind === 'purr');
      const headBob = walk * 0.4 * Math.sin(ph * 2 + 0.6);
      const headC = at(pose.head, breath * 0.6 + bob + headBob);
      const rh = 6.6 * S;
      const hy = this.yaw + this.look;
      const flat = { x: Math.cos(hy), y: Math.sin(hy), z: 0 };
      const hf = M.norm(M.add(flat, { x: 0, y: 0, z: meow * 0.35 + sitK * 0.12 - this.curl * 0.25 - jumpK * 0.1 }));
      const hs = { x: -flat.y, y: flat.x, z: 0 };
      // "para cima" da cabeça: frente × lado (assim as orelhas e a testa ficam em cima, não embaixo do queixo)
      const hu = M.norm(M.cross(hf, hs));
      const H = (f, s, u) => M.add(headC, M.add(M.scale(hf, f * rh), M.add(M.scale(hs, s * rh), M.scale(hu, u * rh))));

      // o corpo: o quadril, o peito, a barriga e o pescoço (enrolado, uma almofada redonda)
      const rH = M.lerp(M.lerp(6.4, 7.6, sitK), 8.6, this.curl) * S;
      const rC = M.lerp(6.8, 8.6, this.curl) * S;
      const mid = M.lerp3(hip, chest, 0.45);
      // o corpo em duas partes, o traseiro e o peito, com um contorno só em volta das duas: fica a cintura e as costas
      // descem do quadril para o ombro (de lado, deixa de ser uma salsicha); o peito é fundo e a barriga, recolhida
      const lift3 = (p, dz) => ({ x: p.x, y: p.y, z: p.z + dz });
      const rear = [
        { c: hip, r: rH },
        { c: lift3(M.lerp3(hip, chest, 0.38), 0.3 * S), r: rH * 0.9 },
      ];
      const fore = [
        { c: chest, r: rC },
        { c: lift3(M.lerp3(hip, chest, 0.6), 0.6 * S), r: rC * 0.88 },
        { c: M.add(chest, M.add(M.scale(fwd, 0.6 * S), { x: 0, y: 0, z: -2.2 * S * (1 - this.curl) })), r: rC * 0.84 },
        { c: M.lerp3(chest, headC, 0.42), r: M.lerp(4.6, 6, this.curl) * S },
      ];
      const body = rear.concat(fore);

      // as pernas: no passo do gato (a de trás, depois a da frente do mesmo lado), a pata no chão indo para trás
      const amp = walk * 6;
      const lift = walk * 2.6;
      const shrink = M.lerp(1, 0.7, this.curl);
      const legs = [];
      for (const front of [false, true]) {
        (front ? pose.front : pose.rear).forEach((p, i) => {
          const sg = i ? 1 : -1;
          const pf = ph + (i ? Math.PI : 0) - (front ? Math.PI / 2 : 0);
          const step = -amp * Math.cos(pf);
          const up = lift * Math.max(0, Math.sin(pf));
          const foot = at([p[0] + step, p[1], p[2] + ANKLE + up]);
          const root = front ? chest : hip;
          const joint = M.add(root, M.add(M.scale(side, (front ? 2.9 : 3.2) * S * sg), M.add(M.scale(fwd, (front ? 1.2 : -0.6) * S), { x: 0, y: 0, z: (front ? -2 : -1) * S })));
          const l1 = (front ? 5.4 : 6.3) * S, l2 = (front ? 5.6 : 6.3) * S;
          const knee = bend(joint, foot, l1, l2, M.add(M.scale(fwd, -1), { x: 0, y: 0, z: front ? -0.3 : 0.15 }));
          const r0 = (front ? 2.3 : 2.9) * S * shrink, r1 = (front ? 1.8 : 1.9) * S * shrink, r2 = 1.5 * S * shrink;
          legs.push({
            front, sg,
            near: M.dot(M.scale(side, sg), toCamH) > 0,
            pts: [joint, M.lerp3(joint, knee, 0.5), knee, M.lerp3(knee, foot, 0.5), foot],
            rads: [r0, (r0 + r1) / 2, r1, (r1 + r2) / 2, r2],
            paw: M.add(foot, M.add(M.scale(fwd, 0.7 * S), { x: 0, y: 0, z: -ANKLE * 0.3 * S })),
            pawR: 2.05 * S * shrink,
            inFront: false,
          });
        });
      }
      // sentado, as patas da frente ficam na frente da barriga (desenhadas depois do corpo)
      if (sitK > 0.4) for (const L of legs) if (L.front && near(L.paw) > near(hip) + 2) L.inFront = true;

      // o rabo laranja claro com os aneizinhos: balança devagar, acompanha o passo e treme no carinho
      const sway = (purr ? Math.sin(t * 9) * 0.45 : Math.sin(t * 1.6)) * (1 - this.curl);
      const wag = walk * Math.sin(ph) * 0.9;
      const tail = spline(pose.tail.map((p, i) => at([p[0], p[1] + (sway + wag) * i * 0.8, p[2]])), 4);
      const tailR = tail.map((_, i) => M.lerp(2.1, 1.2, i / (tail.length - 1)) * S);

      // as orelhas grandes (como as do Joaquim das fotos): uma concha (a frente aberta e um ponto atrás da base)
      const twPhase = ((t + 2.3) % 7.3) / 7.3;
      const twitch = twPhase > 0.94 ? Math.sin(((twPhase - 0.94) / 0.06) * Math.PI * 2) * 0.35 : 0;
      const ears = [-1, 1].map((sg) => {
        const tw = sg < 0 ? twitch : 0;
        const pIn = H(0.1, 0.16 * sg, 0.92);
        const pOut = H(-0.1, 0.84 * sg, 0.55);
        const pBack = H(-0.5, 0.48 * sg, 0.78);
        const tip = H(-0.18 + tw * 0.4, (0.66 + tw * 0.2) * sg, 1.85 - Math.abs(tw) * 0.3);
        const center = M.scale(M.add(M.add(pIn, pOut), M.add(pBack, tip)), 1 / 4);
        const open = M.norm(M.add(M.scale(hf, 0.8), M.scale(hs, 0.6 * sg)));
        return { pIn, pOut, pBack, tip, front: M.dot(M.sub(center, headC), toCamH) > 0, inside: M.dot(open, cam.toCamera) > 0.05 };
      });

      // a coxa do lado de cá, quando ele está de lado para quem olha
      const sideK = Math.abs(M.dot(side, toCamH));
      let haunch = null;
      if (sideK > 0.3 && this.curl < 0.5) {
        const sgN = M.dot(side, toCamH) > 0 ? 1 : -1;
        const c0 = M.add(hip, M.add(M.scale(side, sgN * rH * 0.55), M.add(M.scale(fwd, -0.4 * S), { x: 0, y: 0, z: -0.9 * S })));
        const rr = rH * 0.74;
        const pts = [];
        for (let k = 0; k <= 10; k++) {
          const a = M.lerp(-1.3, 1.0, k / 10);
          pts.push(M.add(c0, M.add(M.scale(fwd, Math.cos(a) * rr), { x: 0, y: 0, z: Math.sin(a) * rr })));
        }
        haunch = { pts, alpha: M.smoothstep(0.3, 0.75, sideK) * (1 - this.curl * 2) };
      }

      const face = { show: M.dot(hf, cam.toCamera) > -0.2, closed: this.asleep || purr || this.blinkT < 0.13, meow };
      this._rig = { mid, body, bodyParts: [rear, fore], legs, tail, tailR, head: { c: headC, f: hf, s: hs, u: hu, r: rh }, ears, face, haunch, toCamH };

      // por cima de tudo: o "miau!" e o coração do carinho (também dormindo, no desenho enrolado). Saem do lado da
      // cabeça, abaixo do nome (que fica centrado em cima dele), para um não esconder o outro
      const ear = cam.p(M.add(headC, { x: 0, y: 0, z: rh * 1.3 }));
      const sleepEar = cam.p({ x: this.pos.x, y: this.pos.y, z: this.groundZ + this.perch + 14 });
      this._overlay = (ctx) => {
        const z = cam.zoom;
        if (act && act.kind === 'meow') {
          const u = act.t / act.dur;
          ctx.save();
          ctx.globalAlpha *= u < 0.15 ? u / 0.15 : 1 - M.smoothstep(0.6, 1, u);
          ctx.font = `800 ${Math.max(10, 12 * z).toFixed(1)}px system-ui, sans-serif`;
          ctx.textAlign = 'left';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(27, 16, 13, 0.85)';
          const x = ear.x + 13 * z + u * 4 * z;
          const y = ear.y - u * 8 * z;
          ctx.strokeText('miau!', x, y);
          ctx.fillStyle = '#fff6e0';
          ctx.fillText('miau!', x, y);
          ctx.restore();
        }
        if (purr) {
          const u = act.t / act.dur;
          const at0 = this.sleepLook() > 0.5 ? sleepEar : ear;
          const s = Math.max(5, 7 * z) * (u < 0.2 ? M.easeOutBack(u / 0.2) : 1);
          const hx = at0.x + 17 * z + u * 6 * z + Math.sin(u * 6) * 2 * z;
          const hy2 = at0.y - u * 16 * z;
          ctx.save();
          ctx.globalAlpha *= 1 - M.smoothstep(0.65, 1, u);
          ctx.fillStyle = '#ff5a7a';
          ctx.strokeStyle = 'rgba(27, 16, 13, 0.85)';
          ctx.lineWidth = Math.max(1, 1.2 * z);
          ctx.beginPath();
          ctx.moveTo(hx, hy2 + s * 0.9);
          ctx.bezierCurveTo(hx - s * 1.6, hy2 - s * 0.1, hx - s * 0.7, hy2 - s * 1.2, hx, hy2 - s * 0.35);
          ctx.bezierCurveTo(hx + s * 0.7, hy2 - s * 1.2, hx + s * 1.6, hy2 - s * 0.1, hx, hy2 + s * 0.9);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      };
      this.top = headC.z - this.groundZ + rh * 2.3;

      // as bolas: só para a sombra no chão (e no assento do sofá) e para a caixa do desenho
      const groups = [
        { balls: body.map((b) => ({ c: b.c, r: b.r })), ref: mid, body: true },
        { balls: [{ c: headC, r: rh }], ref: headC, body: true },
        { balls: legs.map((L) => ({ c: L.paw, r: L.pawR })), ref: mid },
        { balls: ears.map((e) => ({ c: e.tip, r: 1 })), ref: headC, noShadow: true },
      ];
      this._groups = groups;
      return { groups };
    }
  }

  C.define('joaquim', Joaquim);
  PD.Joaquim = Joaquim;
})(window.PD = window.PD || {});
