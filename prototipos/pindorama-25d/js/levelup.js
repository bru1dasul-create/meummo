// O efeito de subir de nível (pedido do dono, 23/11: "cada nível que o personagem upar quero um efeito no personagem
// vindo do chão, mesma coisa quando upar uma habilidade"; a prévia aprovada: "gostei, só afasta mais o círculo, está
// pegando nos braços"). Um círculo de luz acende no chão, nos pés; anéis de luz sobem pelo corpo (passam por fora dos
// braços e só fecham acima dos ombros, em volta da cabeça), com uma coluna de luz fraquinha e faíscas subindo em
// espiral; no nível, uma estrela estoura em cima da cabeça. O ponto de habilidade é o mesmo efeito, mais curto, com
// 2 anéis, sem a estrela, na cor da habilidade.
//
// PD.levelUpFx.draw(ctx, cam, pe, t, aparencia, passada): `pe` = o chão embaixo do personagem (cm do mundo), `t` =
// segundos desde o começo, `aparencia` = PD.levelUpFx.look(o que, habilidade). Em três passadas, para a ordem com o
// corpo: 'chao' (com as sombras, embaixo de tudo), 'tras' (antes do personagem: a metade de trás dos anéis, a coluna)
// e 'frente' (depois dele: a metade da frente e a estrela). A view (view.js, levelUp) chama.
(function (PD) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const smooth = (t) => {
    const k = clamp01(t);
    return k * k * (3 - 2 * k);
  };
  const mix = (a, b, k) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
  const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${clamp01(a).toFixed(3)})`;
  const hash = (i) => {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // As cores: o nível em dourado; o ponto de cada habilidade na cor do ícone dela (a Chuva em azul, para não confundir
  // com o dourado do nível). `big`: o efeito do nível (mais alto, 3 anéis e a estrela).
  // (`hex`: a cor da luz que o efeito acende no escuro da noite, view.js)
  const LOOKS = {
    level: { big: true, rgb: [255, 200, 80], pale: [255, 246, 205], hex: '#ffd36a' },
    flecha: { big: false, rgb: [110, 255, 185], pale: [225, 255, 240], hex: '#8dffc8' },
    chuva: { big: false, rgb: [120, 195, 255], pale: [225, 242, 255], hex: '#9fd4ff' },
    olhos: { big: false, rgb: [255, 140, 45], pale: [255, 222, 185], hex: '#ffa04a' },
    // uma habilidade que ainda não tem cor própria (outra classe, no futuro)
    skill: { big: false, rgb: [255, 225, 150], pale: [255, 248, 225], hex: '#ffe9a0' },
  };
  function look(what, skill) {
    if (what === 'level') return LOOKS.level;
    return LOOKS[skill] || LOOKS.skill;
  }
  /** Quanto dura (s). */
  const duration = (o) => (o.big ? 1.7 : 1.15);
  /** O quanto o efeito some no fim (1 → 0 nos últimos 38%). */
  const fadeAt = (o, t) => 1 - clamp01((t - duration(o) * 0.62) / (duration(o) * 0.38));
  /** A força da luz que o efeito acende na noite (0 a 1): acende rápido e apaga junto com o efeito. */
  function light(o, t) {
    if (!(t >= 0 && t <= duration(o))) return 0;
    return clamp01(t / 0.2) * fadeAt(o, t);
  }

  // Os anéis em volta do corpo (cm). Medido (23/11): parado, os braços do Birim chegam a ~38 cm do meio do corpo
  // (com a grossura do braço; andando, 44): o anel passa a 56 cm, por fora, e só fecha acima dos ombros (~135 cm),
  // até 30 cm em volta da cabeça. Correndo, o braço balança até ~60 cm e ainda pode encostar num instante.
  const R_BODY = 56;
  const R_HEAD = 30;
  const SHOULDER = 135;
  const HEAD_TOP = 195;
  const radiusAt = (h) => R_BODY + (R_HEAD - R_BODY) * smooth((h - SHOULDER) / (HEAD_TOP - SHOULDER));

  function star(ctx, x, y, size, rot) {
    const t = size * 0.26;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(t, -t, size, 0);
    ctx.quadraticCurveTo(t, t, 0, size);
    ctx.quadraticCurveTo(-t, t, -size, 0);
    ctx.quadraticCurveTo(-t, -t, 0, -size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function glow(ctx, x, y, r, c, a) {
    if (r <= 0.5 || a <= 0.003) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a));
    g.addColorStop(0.4, rgba(c, a * 0.45));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  /** O caminho de uma volta de raio `r` na altura `h` (`half`: só a metade de trás, 'tras', ou da frente, 'frente'). */
  function hoop(ctx, W, toCam, r, h, half) {
    ctx.beginPath();
    let on = false;
    for (let s = 0; s <= 56; s++) {
      const ang = (s / 56) * TAU;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      if (half) {
        const far = dx * toCam.x + dy * toCam.y < 0;
        if (far !== (half === 'tras')) {
          on = false;
          continue;
        }
      }
      const q = W(dx * r, dy * r, h);
      if (on) ctx.lineTo(q.x, q.y);
      else {
        ctx.moveTo(q.x, q.y);
        on = true;
      }
    }
  }

  function draw(ctx, cam, foot, t, o, pass) {
    const big = !!o.big;
    const DUR = duration(o);
    if (!(t >= 0 && t <= DUR)) return;
    const C = o.rgb;
    const P = o.pale;
    const CORE = mix(C, P, 0.45);
    const z = cam.zoom;
    const toCam = cam.toCamera;
    const W = (x, y, h) => cam.p({ x: foot.x + x, y: foot.y + y, z: foot.z + h });
    const fade = fadeAt(o, t);
    const TOP = big ? 210 : 185;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // o traço do meio dos anéis na cor de verdade, por cima (somando luz com o chão, de tarde e na calçada clara tudo
    // virava amarelo-claro e a cor de cada habilidade se perdia); os brilhos em volta continuam somando luz
    const core = (color, alpha, width) => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
    };
    if (pass === 'chao') {
      // 1) o círculo no chão: abre do pé, a borda acesa, um anel fino por dentro e as marquinhas girando devagar
      const k = fade * (1 - 0.35 * clamp01((t - 0.3) / 0.5));
      const r = R_BODY * easeOut(t / 0.25);
      const c0 = W(0, 0, 0);
      ctx.save();
      ctx.translate(c0.x, c0.y);
      ctx.scale(1, cam.sinP);
      glow(ctx, 0, 0, r * 1.15 * z, C, 0.3 * k);
      ctx.restore();
      hoop(ctx, W, toCam, r, 0);
      ctx.strokeStyle = rgba(C, 0.35 * k);
      ctx.lineWidth = Math.max(1, 6 * z);
      ctx.stroke();
      core(CORE, 0.9 * k, Math.max(1, 2 * z));
      hoop(ctx, W, toCam, r * 0.8, 0);
      ctx.strokeStyle = rgba(C, 0.4 * k);
      ctx.lineWidth = Math.max(1, 1.2 * z);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rgba(CORE, 0.85 * k);
      for (let m = 0; m < 8; m++) {
        const a = (m / 8) * TAU + t * 0.8;
        const q = W(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, 0);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.scale(1, cam.sinP);
        star(ctx, 0, 0, Math.max(1.5, (m % 2 ? 2.6 : 4) * z), Math.PI / 4);
        ctx.restore();
      }
      ctx.restore();
      return;
    }
    // 2) a coluna de luz: sobe do círculo, macia nas beiradas (atrás do corpo mais forte; na frente, um véu fraco)
    {
      const k = clamp01(t / 0.25) * fade;
      const top = TOP * 1.12 * easeOut(t / 0.5);
      const b0 = W(0, 0, 0);
      const b1 = W(0, 0, top);
      const base = pass === 'tras' ? 0.048 : 0.018;
      for (const s of [1, 0.8, 0.6, 0.42, 0.25]) {
        const wBot = R_BODY * 0.85 * s * z;
        const wTop = R_HEAD * 0.9 * s * z;
        const g = ctx.createLinearGradient(b0.x, b0.y, b1.x, b1.y);
        g.addColorStop(0, rgba(P, base * k));
        g.addColorStop(0.55, rgba(C, base * 0.7 * k));
        g.addColorStop(1, rgba(C, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(b0.x - wBot, b0.y);
        ctx.lineTo(b1.x - wTop, b1.y);
        ctx.lineTo(b1.x + wTop, b1.y);
        ctx.lineTo(b0.x + wBot, b0.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // 3) os anéis subindo em volta do corpo: cada um sai do chão, sobe (com o rastro embaixo), fecha em volta da
    // cabeça e some no alto
    const rings = big ? 3 : 2;
    for (let i = 0; i < rings; i++) {
      const t0 = 0.1 + i * (big ? 0.2 : 0.17);
      const u = (t - t0) / (big ? 0.95 : 0.72);
      if (u <= 0 || u >= 1) continue;
      const e = easeOut(u);
      const h = TOP * e;
      const a = Math.min(1, u / 0.1) * (1 - clamp01((u - 0.6) / 0.4));
      for (const [back, ka] of [
        [16, 0.18],
        [8, 0.4],
      ]) {
        const hb = Math.max(0, h - back * (1 - e * 0.6));
        hoop(ctx, W, toCam, radiusAt(hb), hb, pass);
        ctx.strokeStyle = rgba(C, ka * a);
        ctx.lineWidth = Math.max(1, 3 * z);
        ctx.stroke();
      }
      hoop(ctx, W, toCam, radiusAt(h), h, pass);
      ctx.strokeStyle = rgba(C, 0.4 * a);
      ctx.lineWidth = Math.max(2, 7 * z);
      ctx.stroke();
      core(CORE, 0.95 * a, Math.max(1.2, 2.4 * z));
    }
    // 4) as faíscas subindo em espiral, por fora dos braços (as de trás passam atrás do corpo)
    const N = big ? 20 : 11;
    for (let j = 0; j < N; j++) {
      const u = (t - 0.1 - hash(j) * 0.55) / 0.85;
      if (u <= 0 || u >= 1) continue;
      const ang = hash(j + 7) * TAU + u * TAU * 0.85;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const far = dx * toCam.x + dy * toCam.y < 0;
      if (far !== (pass === 'tras')) continue;
      const h = 8 + u * (TOP + 30);
      const rr = radiusAt(h) * (0.88 + 0.12 * hash(j + 11));
      const q = W(dx * rr, dy * rr, h);
      const tw = 0.6 + 0.4 * Math.sin(t * 18 + j * 2.1);
      ctx.fillStyle = rgba(P, (1 - u) * tw);
      star(ctx, q.x, q.y, Math.max(1.6, (2.8 + 2 * hash(j + 3)) * z * (1 - u * 0.4)), hash(j + 5) * 1.5 + t * 2);
    }
    // 5) no nível: o estouro em cima da cabeça (a estrela, os raios e o anel abrindo), acima do nome dele (o nome
    // fica a ~2,07 m; em 2,18 m a estrela caía em cima das letras)
    if (big && pass === 'frente') {
      const u = (t - 0.95) / 0.6;
      if (u > 0 && u < 1) {
        const q = W(0, 0, TOP + 42);
        const k = 1 - u;
        glow(ctx, q.x, q.y, (28 + 40 * u) * z, C, 0.7 * k);
        const ring = (12 + 55 * easeOut(u)) * z;
        ctx.strokeStyle = rgba(C, 0.75 * k);
        ctx.lineWidth = Math.max(1.2, 2.4 * z * k);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, ring, ring * 0.55, 0, 0, TAU);
        ctx.stroke();
        // (a estrela e os raios somando luz: por cima, apagando, ficavam cinza no chão escuro)
        ctx.strokeStyle = rgba(CORE, 0.85 * k);
        ctx.lineWidth = Math.max(1, 2 * z * k);
        for (let m = 0; m < 8; m++) {
          const a = (m / 8) * TAU + Math.PI / 8;
          const r0 = (10 + 22 * u) * z;
          const r1 = r0 + (16 + 26 * u) * z * (m % 2 ? 0.6 : 1);
          ctx.beginPath();
          ctx.moveTo(q.x + Math.cos(a) * r0, q.y + Math.sin(a) * r0);
          ctx.lineTo(q.x + Math.cos(a) * r1, q.y + Math.sin(a) * r1);
          ctx.stroke();
        }
        ctx.fillStyle = rgba(P, 0.95 * k);
        star(ctx, q.x, q.y, (11 + 6 * Math.sin(u * Math.PI)) * z, u * 1.5);
      }
    }
    ctx.restore();
  }

  PD.levelUpFx = { draw, look, duration, light, radiusAt, R_BODY };
})(window.PD = window.PD || {});
