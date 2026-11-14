// O Joaquim, o gato da vó (pedido do dono, com as fotos do gato dele: docs/referencias/joaquim-1.jpg e joaquim-2.jpg).
// Bem pequeno, todo branco-creme, com os detalhes laranja-claros de um flame point: a máscara na testa (com
// listrinhas) e em volta do focinho, as orelhas rosadas com a ponta laranja e o rabo laranja claro com anéis; olhos
// azuis e nariz rosa. Dormindo, fica enrolado (respira, mexe uma orelha, dá umas batidinhas com a ponta do rabo e
// solta uns "z"); acordado, é a criatura `joaquim` lá embaixo (anda, senta, se espreguiça, pula do sofá, mia e
// ronrona), que usa este mesmo desenho quando dorme.
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
  // ('purr': o coração; dormindo, continua dormindo) e volta a deitar no sofá ('sleep'). Acordado, o corpo é de bolas,
  // como as outras criaturas (creature.js): cada pose (em pé, sentado, espreguiçando, no pulo) é um jogo de pontos e o
  // desenho passa de um para o outro. Dormindo, é o desenho aprovado do gato enrolado (o `sleeping` daqui de cima).
  if (!PD.creatures) return;
  const C = PD.creatures;
  const { tube } = C;
  const S = 1.1;
  /** Altura do assento do sofá, onde ele dorme (o ponto de dormir do mapa fica em cima do sofá). */
  const PERCH = 46;
  /** Quanto o corpo anda (cm, antes da escala) a cada passada completa das quatro patas. */
  const STRIDE = 26;
  /** Raio da patinha (cm, antes da escala): o pé das poses é o centro dela, rente ao chão. */
  const PAW = 1.8;
  const COL = {
    fur: { base: '#f8f0e2', shade: '#d9c6aa', light: '#ffffff' },
    point: { base: '#f0b483', shade: '#cf9461', light: '#f9d6b4' },
    ring: { base: '#e39a5c', shade: '#b97a45', light: '#f3bf8e' },
    paw: { base: '#fcf7ef', shade: '#ddd0bc', light: '#ffffff' },
  };
  const EYE = '#8db8e8';
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

  // as poses: [frente, lado, altura] em cm (antes da escala); o pé das patas é rente ao chão (a patinha sobe PAW)
  const STAND = {
    hip: [-9, 0, 14.5], chest: [8, 0, 14], head: [15.5, 0, 22],
    rear: [[-9.5, -3.4, 0], [-9.5, 3.4, 0]], front: [[9.5, -3, 0], [9.5, 3, 0]],
    // o rabo em pé, com a ponta virando (o "ponto de interrogação" do gato contente)
    tail: [[-15, 0, 16.5], [-20.5, 0, 20], [-23, 1, 25.5], [-22.5, 4, 31], [-19.5, 7, 34]],
  };
  const SIT = {
    hip: [-5, 0, 7.5], chest: [2.5, 0, 15], head: [5.5, 0, 25],
    rear: [[0.5, -5, 0], [0.5, 5, 0]], front: [[5.5, -2.6, 0], [5.5, 2.6, 0]],
    // sentado, o rabo dá a volta no chão e encosta nas patas da frente
    tail: [[-10, 0, 2.5], [-10, 5.5, 1.5], [-5, 9, 1.5], [1.5, 9.5, 1.5], [7, 7, 1.5]],
  };
  const CURL = {
    hip: [-6, -1.5, 7.5], chest: [5, 1.5, 7.5], head: [10, 3.5, 6.5],
    rear: [[-4, -3, 1], [-4, 3, 1]], front: [[12, 1, 1.5], [12, 5, 1.5]],
    tail: [[-12, 0, 3], [-10, 7, 2.5], [-2, 11, 2.5], [6, 10.5, 2.5], [11, 7.5, 3]],
  };
  // espreguiçando (o 'wake'): as patas da frente esticadas, o peito baixo e o traseiro alto
  const STRETCH = {
    hip: [-9, 0, 17], chest: [7, 0, 8.5], head: [15, 0, 11],
    rear: [[-9.5, -3.4, 0], [-9.5, 3.4, 0]], front: [[20, -3, 0], [20, 3, 0]],
    tail: [[-15, 0, 18], [-18, 0, 25], [-18, 1, 32], [-15.5, 2.5, 37], [-12, 3.5, 39]],
  };
  // no pulo: o corpo esticado, as patas da frente buscando o chão lá na frente e as de trás empurrando para trás
  const LEAP = {
    hip: [-10, 0, 14], chest: [9, 0, 16], head: [16.5, 0, 22],
    rear: [[-20, -3, 8], [-20, 3, 8]], front: [[18, -3, 7], [18, 3, 7]],
    tail: [[-15, 0, 16], [-21, 0, 18], [-27, 0, 20.5], [-32, 1, 23.5], [-35, 2, 26]],
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

  /** Um triângulo de orelha com os lados um pouco abaulados (a, b: a base; q: a ponta), em px de tela. */
  function earPath(ctx, a, q, b, bulge = 0.12) {
    const c1 = { x: (a.x + q.x) / 2 - (q.y - a.y) * bulge, y: (a.y + q.y) / 2 + (q.x - a.x) * bulge };
    const c2 = { x: (q.x + b.x) / 2 - (b.y - q.y) * bulge, y: (q.y + b.y) / 2 + (b.x - q.x) * bulge };
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(c1.x, c1.y, q.x, q.y);
    ctx.quadraticCurveTo(c2.x, c2.y, b.x, b.y);
    ctx.closePath();
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
      this.acts = { wake: { dur: 1.6 }, sleep: { dur: 0.6 }, meow: { dur: 1.2 }, purr: { dur: 1.9 }, dash: { dur: 0.45 } };
      this.ownDeath = true;
      /** As bolas do último desenho (para a sombra no assento do sofá) e o que vai por cima (coração, miado). */
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
      this.label = this.asleep ? 'dormindo' : this.jump ? 'pulando' : moving ? 'andando' : this.sit > 0.5 ? 'sentado' : 'parado';
    }

    /** Quanto do desenho de dormir (o gato enrolado aprovado) aparece: 0 acordado, 1 dormindo. */
    sleepLook() {
      return M.smoothstep(0.6, 0.93, this.curl);
    }

    drawable(cam, primary) {
      const d = super.drawable(cam, primary);
      const w = this.sleepLook();
      // em cima do sofá: na ordem de desenho, depois dele (o pé dele fica dentro do pé do sofá)
      d.lift = this.perch > 10 ? 1 : 0;
      const seat = this.perch > 10 && !this.jump;
      const groups = this._groups;
      const z0 = this.groundZ;
      const perch = this.perch;
      const rigDraw = d.draw;
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
        if (w < 1) {
          ctx.save();
          if (w > 0) ctx.globalAlpha *= 1 - w;
          if (seat && groups) C.drawShadow(ctx, cam, groups, z0 + perch);
          rigDraw(ctx);
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
      const bob = walk * 0.55 * Math.abs(Math.sin(ph * 2));
      const at = (p, dz = 0) => this.at(p[0] * S, p[1] * S, (p[2] + dz) * S);
      const hip = at(pose.hip, breath * 0.5 + bob * 0.7);
      const chest = at(pose.chest, breath + bob);
      const fwd = { x: Math.cos(this.yaw), y: Math.sin(this.yaw), z: 0 };
      const side = { x: -Math.sin(this.yaw), y: Math.cos(this.yaw), z: 0 };
      const groups = [];

      // a cabeça vem antes (o pescoço do corpo vai até ela); vira para quem está perto e sobe no miado
      const meow = act && act.kind === 'meow' ? Math.sin(Math.min(1, act.t / 0.5) * Math.PI) : 0;
      const purr = act && act.kind === 'purr';
      const headBob = walk * 0.45 * Math.sin(ph * 2 + 0.6);
      const headC = at(pose.head, breath * 0.6 + bob + headBob);
      const rh = 6.7 * S;
      const hy = this.yaw + this.look;
      const flat = { x: Math.cos(hy), y: Math.sin(hy), z: 0 };
      const hf = M.norm(M.add(flat, { x: 0, y: 0, z: meow * 0.35 + sitK * 0.1 - this.curl * 0.25 - jumpK * 0.1 }));
      const hs = { x: -flat.y, y: flat.x, z: 0 };
      // "para cima" da cabeça: frente × lado (assim as orelhas e a testa ficam em cima, não embaixo do queixo)
      const hu = M.norm(M.cross(hf, hs));
      const H = (f, s, u) => M.add(headC, M.add(M.scale(hf, f * rh), M.add(M.scale(hs, s * rh), M.scale(hu, u * rh))));

      // o corpo: do quadril ao peito, a barriga e o pescoço (enrolado, uma almofada redonda)
      const rbH = M.lerp(M.lerp(6.6, 7.8, sitK), 8.6, this.curl) * S;
      const rbC = M.lerp(7, 8.6, this.curl) * S;
      const body = [];
      // bolas bem juntas: as costas do gato saem lisas (com as bolas espaçadas o contorno fica encaroçado, de carneiro)
      const nb = Math.max(2, Math.ceil(M.dist(hip, chest) / (Math.min(rbH, rbC) * 0.28)));
      for (let k = 0; k <= nb; k++) body.push({ c: M.lerp3(hip, chest, k / nb), r: M.lerp(rbH, rbC, k / nb), col: COL.fur });
      const mid = M.lerp3(hip, chest, 0.45);
      body.push({ c: { x: mid.x, y: mid.y, z: mid.z - 0.8 * S }, r: Math.max(rbH, rbC) * 1.02, col: COL.fur });
      body.push({ c: M.lerp3(chest, headC, 0.5), r: M.lerp(4.9, 6, this.curl) * S, col: COL.fur });
      groups.push({ balls: body, ref: mid, body: true });

      // as pernas: de quatro, no passo do gato (a de trás, depois a da frente do mesmo lado); no pulo, esticadas
      const amp = walk * 6.3;
      const lift = walk * 2.8;
      const shrink = M.lerp(1, 0.7, this.curl);
      for (const front of [false, true]) {
        (front ? pose.front : pose.rear).forEach((p, i) => {
          const sg = i ? 1 : -1;
          const pf = ph + (i ? Math.PI : 0) - (front ? Math.PI / 2 : 0);
          const step = -amp * Math.cos(pf);
          const up = lift * Math.max(0, Math.sin(pf));
          const foot = at([p[0] + step, p[1], p[2] + PAW + up]);
          const root = front ? chest : hip;
          const joint = M.add(root, M.add(M.scale(side, (front ? 3 : 3.4) * S * sg), M.add(M.scale(fwd, (front ? 1.5 : -0.5) * S), { x: 0, y: 0, z: (front ? -2.2 : -1.2) * S })));
          // os ossos quase do tamanho da altura do ombro: a perna fica quase reta parada (de lado, sem engatinhar)
          const l1 = (front ? 5.6 : 6.5) * S;
          const l2 = (front ? 5.9 : 6.5) * S;
          const knee = bend(joint, foot, l1, l2, M.add(M.scale(fwd, -1), { x: 0, y: 0, z: front ? -0.3 : 0.15 }));
          const leg = [];
          if (front) {
            tube(joint, knee, 2.2 * S * shrink, 1.8 * S * shrink, COL.fur, leg);
            tube(knee, foot, 1.75 * S * shrink, 1.55 * S * shrink, COL.fur, leg);
          } else {
            tube(joint, knee, 3 * S * shrink, 1.9 * S * shrink, COL.fur, leg);
            tube(knee, foot, 1.8 * S * shrink, 1.55 * S * shrink, COL.fur, leg);
          }
          leg.push({ c: M.add(foot, M.scale(fwd, 0.9 * S)), r: 1.95 * S * shrink, col: COL.paw });
          groups.push({ balls: leg, ref: knee });
        });
      }

      // o rabo laranja claro com os aneizinhos (a base, creme): balança devagar, acompanha o passo e treme no carinho
      const sway = (purr ? Math.sin(t * 9) * 0.45 : Math.sin(t * 1.6)) * (1 - this.curl);
      const wag = walk * Math.sin(ph) * 0.9;
      const tailPts = pose.tail.map((p, i) => at([p[0], p[1] + (sway + wag) * i * 0.8, p[2]]));
      const tail = [];
      for (let i = 0; i < tailPts.length - 1; i++) {
        const col = i === 0 ? COL.fur : i % 2 ? COL.ring : COL.point;
        tube(tailPts[i], tailPts[i + 1], M.lerp(2.5, 1.6, i / 4) * S, M.lerp(2.5, 1.6, (i + 1) / 4) * S, col, tail);
      }
      groups.push({ balls: tail, ref: tailPts[2], bias: -0.5 });

      // a cabeça: redonda, as bochechas (cara de gato é mais larga embaixo) e o focinho curto
      const head = [
        { c: headC, r: rh, col: COL.fur },
        { c: H(0.16, -0.42, -0.24), r: 0.62 * rh, col: COL.fur },
        { c: H(0.16, 0.42, -0.24), r: 0.62 * rh, col: COL.fur },
        { c: H(0.62, 0, -0.3), r: 0.42 * rh, col: COL.fur },
      ];
      // o rosto (pintado na bola da cabeça, só do lado que a câmera vê): a máscara laranja-clara na testa e no nariz,
      // os olhos azuis (fechados dormindo e no carinho), o nariz rosa e a boca aberta no miado
      const on = (f, s, u, k = 1) => {
        const n = M.norm(M.add(M.scale(hf, f), M.add(M.scale(hs, s), M.scale(hu, u))));
        return { c: M.add(headC, M.scale(n, rh * k)), n };
      };
      const decals = [];
      const put = (spot, ru, rv, color, extra = {}) => {
        const u = M.norm(M.sub(hs, M.scale(spot.n, M.dot(hs, spot.n))));
        let v = M.norm(M.cross(u, spot.n));
        if (M.dot(v, hu) < 0) v = M.scale(v, -1);
        decals.push({ c: spot.c, n: spot.n, u, v, ru: ru * S, rv: rv * S, color, minFacing: 0.08, ...extra });
      };
      put(on(0.5, 0, 0.72), 3.4, 2.5, '#f3c393');
      put(on(0.93, 0, 0.12, 1.01), 1.05, 2.3, COL.point.base);
      const closed = this.asleep || purr;
      for (const sg of [-1, 1]) {
        const eye = on(0.8, 0.44 * sg, 0.16, 1.01);
        if (closed) put(eye, 1.3, 0.34, '#5a4636');
        else {
          put(eye, 1.2, 1.15, EYE);
          put(on(0.82, 0.44 * sg, 0.15, 1.03), 0.42, 0.92, '#1b100d');
          put(on(0.8, 0.4 * sg, 0.27, 1.04), 0.3, 0.3, '#ffffff');
        }
      }
      put(on(0.97, 0, -0.2, 1.03), 0.78, 0.62, '#e9a0a0', { shape: 'tri' });
      if (meow > 0.15) put(on(0.93, 0, -0.45, 1.02), 0.95 * meow, 0.75 * meow, '#4a1e1a');

      // as orelhas grandes (como as do Joaquim das fotos): triângulos com contorno, rosados por dentro e com a ponta
      // laranja. A de trás da cabeça (para quem olha) vai antes da cabeça; a da frente, depois
      const twPhase = ((t + 2.3) % 7.3) / 7.3;
      const twitch = twPhase > 0.94 ? Math.sin(((twPhase - 0.94) / 0.06) * Math.PI * 2) * 0.35 : 0;
      const toCamH = M.norm({ x: cam.toCamera.x, y: cam.toCamera.y, z: 0 });
      const showInside = M.dot(hf, cam.toCamera) > -0.05;
      const ears = [-1, 1].map((sg) => {
        const tw = sg < 0 ? twitch : 0;
        // a orelha é uma concha: a frente (aberta, rosada por dentro) e um ponto atrás da base, que dá a largura de lado
        const pIn = H(0.08, 0.14 * sg, 0.95);
        const pOut = H(-0.12, 0.8 * sg, 0.6);
        const pBack = H(-0.52, 0.46 * sg, 0.8);
        const tip = H(-0.2 + tw * 0.4, (0.6 + tw * 0.2) * sg, 2 - Math.abs(tw) * 0.3);
        const center = M.scale(M.add(M.add(pIn, pOut), M.add(pBack, tip)), 1 / 4);
        // para onde a abertura olha: para a frente e um pouco para fora
        const open = M.norm(M.add(M.scale(hf, 0.8), M.scale(hs, 0.6 * sg)));
        return { pIn, pOut, pBack, tip, front: M.dot(M.sub(center, headC), toCamH) > 0, inside: M.dot(open, cam.toCamera) > 0.05 };
      });
      const drawEars = (ctx, front) => {
        const z = cam.zoom;
        for (const e of ears) {
          if (e.front !== front) continue;
          const a = cam.p(e.pIn), b = cam.p(e.pOut), q = cam.p(e.tip);
          const shape = hull([a, b, cam.p(e.pBack), q]);
          path(ctx, shape);
          ctx.fillStyle = COL.fur.base;
          ctx.fill();
          // por dentro, rosada (só quando a abertura está virada para quem olha)
          if (e.inside) {
            const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const k = (p, f) => ({ x: m.x + (p.x - m.x) * f, y: m.y + (p.y - m.y) * f });
            earPath(ctx, k(a, 0.62), k(q, 0.8), k(b, 0.62), 0.06);
            ctx.fillStyle = '#f2b8b8';
            ctx.fill();
          }
          // a pontinha laranja
          ctx.save();
          path(ctx, shape);
          ctx.clip();
          path(ctx, shape.map((p) => ({ x: q.x + (p.x - q.x) * 0.32, y: q.y + (p.y - q.y) * 0.32 })));
          ctx.fillStyle = COL.point.base;
          ctx.fill();
          ctx.restore();
          path(ctx, shape);
          ctx.strokeStyle = C.INK;
          ctx.lineWidth = Math.max(1, 1.15 * z);
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
      };
      groups.push({
        balls: head, ref: headC, bias: 0.9, body: true, decals,
        under: (ctx) => drawEars(ctx, false),
        over: (ctx) => drawEars(ctx, true),
      });

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
          const x = ear.x + 11 * z + u * 4 * z;
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
          const hx = at0.x + 15 * z + u * 6 * z + Math.sin(u * 6) * 2 * z;
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
      this.top = headC.z - this.groundZ + rh * 2.2;
      this._groups = groups;
      return { groups };
    }
  }

  C.define('joaquim', Joaquim);
  PD.Joaquim = Joaquim;
})(window.PD = window.PD || {});
