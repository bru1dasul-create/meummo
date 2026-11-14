// O Joaquim, o gato da vó (pedido do dono, com as fotos do gato dele: docs/referencias/joaquim-1.jpg e joaquim-2.jpg).
// Bem pequeno, todo branco-creme, com os detalhes laranja-claros de um flame point: a máscara na testa (com
// listrinhas) e em volta do focinho, as orelhas rosadas com a ponta laranja e o rabo laranja claro com anéis; olhos
// azuis e nariz rosa. Hoje ele dorme enrolado no sofá da vó: respira, mexe uma orelha, dá umas batidinhas com a ponta
// do rabo e solta uns "z". Acordar, andar, miar e receber carinho vêm quando a [estrutura] fizer o comportamento.
//   PD.gato.draw(ctx, cam, { x, y, z, yaw, pose, t, name, body, marks, size })   (desenhado a cada quadro)
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

  PD.gato = { draw, colorsOf };
})(window.PD = window.PD || {});
