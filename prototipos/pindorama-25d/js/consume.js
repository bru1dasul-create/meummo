// O efeito de usar um consumível (pedido do dono, 23/11: "o efeito de quando usar a poção na mesma pegada do Priston
// Tale"; ele não achou referência — lembra da poção jogada para cima, estourando —, viu as duas ideias prontas e
// escolheu a sugestão da [arte]: "pode fazer a sua sugestão" = o estouro nas garrafadas e o benzimento no Ramo de
// Arruda, a erva da benzedeira). Dois estilos, na cor do líquido de cada garrafada (Pequena verde, Média âmbar,
// Grande vermelha):
//   'estouro'    — a garrafada sobe girando da mão, estoura em cima da cabeça e solta folhas e gotas que descem em
//                  espiral em volta do corpo; uma luz sobe do chão e faíscas de cura sobem pelo corpo;
//   'benzimento' — um círculo de luz abre no chão e um redemoinho de folhas de arruda sobe em volta do corpo, como a
//                  benzedeira passando o ramo, com o rastro de luz; no alto as folhas se juntam e viram faíscas.
// A comida (Banana, Água de Coco) tem uma versão menor, sem garrafa: faíscas na cor dela subindo do peito.
//
// PD.consumeFx.draw(ctx, cam, pe, t, aparencia, passada): `pe` = o chão embaixo do personagem (cm do mundo), `t` =
// segundos desde o começo, `aparencia` = PD.consumeFx.look(item, estilo). Três passadas, como o subir de nível:
// 'chao' (com as sombras), 'tras' (antes do corpo) e 'frente' (depois dele).
(function (PD) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const easeInOut = (t) => {
    const k = clamp01(t);
    return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  };
  const mix = (a, b, k) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
  const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${clamp01(a).toFixed(3)})`;
  const hash = (i) => {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // As cores: `rgb` = o líquido (a luz do efeito), `pale` = o brilho, `hex` = a luz que acende na noite (view.js).
  // `kind`: 'pocao' (garrafada e erva: o efeito inteiro) ou 'comida' (o pequeno). `big`: a Grande, com mais folhas.
  // `style`: o estouro nas garrafadas, o benzimento na arruda (a escolha do dono).
  const LOOKS = {
    garrafada_pequena: { kind: 'pocao', style: 'estouro', rgb: [196, 232, 86], pale: [240, 255, 205], hex: '#cde85a' },
    garrafada: { kind: 'pocao', style: 'estouro', rgb: [255, 172, 64], pale: [255, 236, 190], hex: '#ffb44a' },
    garrafada_grande: { kind: 'pocao', style: 'estouro', big: true, rgb: [255, 96, 64], pale: [255, 214, 196], hex: '#ff7a52' },
    erva_arruda: { kind: 'pocao', style: 'benzimento', rgb: [120, 222, 150], pale: [218, 255, 228], hex: '#86e0a0' },
    banana: { kind: 'comida', style: 'estouro', rgb: [255, 216, 72], pale: [255, 248, 200], hex: '#ffd84a' },
    agua_coco: { kind: 'comida', style: 'estouro', rgb: [128, 208, 255], pale: [222, 245, 255], hex: '#8ed0ff' },
    // um consumível que ainda não tem cor própria: o verde da cura, no estouro
    outro: { kind: 'pocao', style: 'estouro', rgb: [120, 230, 120], pale: [220, 255, 220], hex: '#80e080' },
  };
  const STYLES = ['estouro', 'benzimento'];
  /** A aparência do efeito de um item (`style`, só para as pranchas: força 'estouro' ou 'benzimento'). */
  function look(item, style) {
    const base = LOOKS[item] || LOOKS.outro;
    return STYLES.includes(style) ? Object.assign({}, base, { style }) : base;
  }
  /** Quanto dura (s). */
  function duration(o) {
    if (o.kind === 'comida') return 0.9;
    return o.style === 'benzimento' ? 1.45 : 1.35;
  }
  const fadeAt = (o, t) => 1 - clamp01((t - duration(o) * 0.7) / (duration(o) * 0.3));
  /** A força da luz que o efeito acende na noite (0 a 1). */
  function light(o, t) {
    if (!(t >= 0 && t <= duration(o))) return 0;
    const k = o.kind === 'comida' ? 0.45 : 1;
    return k * clamp01(t / 0.25) * fadeAt(o, t);
  }

  // Em volta do corpo (cm): por fora dos braços (medido no subir de nível: até ~44 cm andando) e mais fechado na cabeça.
  const R_BODY = 56;
  const R_HEAD = 34;
  const SHOULDER = 135;
  const HEAD_TOP = 195;
  const radiusAt = (h) => {
    const k = clamp01((h - SHOULDER) / (HEAD_TOP - SHOULDER));
    return R_BODY + (R_HEAD - R_BODY) * k * k * (3 - 2 * k);
  };
  /**
   * A altura do estouro da garrafada: acima da cabeça e do nome (que fica a ~2,07 m). Em 2,5 m o anel do estouro caía
   * em cima das letras do nome, no jogo.
   */
  const BURST_H = 272;

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
  /**
   * Uma folha (na tela): `len` de comprimento, virando (`flip` de -1 a 1 achata, como folha caindo), com o talo claro e
   * a beirada escura; `tint` puxa a cor da folha um pouco para a cor do efeito.
   */
  function leaf(ctx, x, y, len, rot, flip, alpha, light, dark) {
    if (alpha <= 0.01 || len < 1) return;
    const w = len * 0.38 * Math.max(0.42, Math.abs(flip));
    ctx.save();
    ctx.globalAlpha = clamp01(alpha);
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.quadraticCurveTo(0, -w, len / 2, 0);
    ctx.quadraticCurveTo(0, w, -len / 2, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -w, 0, w);
    g.addColorStop(0, rgba(light, 1));
    g.addColorStop(1, rgba(dark, 1));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, len * 0.07);
    ctx.strokeStyle = 'rgba(16, 34, 14, 0.75)';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-len * 0.42, 0);
    ctx.lineTo(len * 0.4, 0);
    ctx.strokeStyle = 'rgba(235, 255, 215, 0.55)';
    ctx.lineWidth = Math.max(0.5, len * 0.05);
    ctx.stroke();
    ctx.restore();
  }
  /** A garrafada pequenininha voando (na tela): o vidro com o líquido na cor do efeito, a rolha e um brilho. */
  function bottle(ctx, x, y, s, rot, C) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    const glass = new Path2D();
    glass.moveTo(-2, -8);
    glass.lineTo(-2, -4.5);
    glass.bezierCurveTo(-6.5, -3.2, -7, 0, -6.6, 2.4);
    glass.bezierCurveTo(-6, 6, -3, 7, 0, 7);
    glass.bezierCurveTo(3, 7, 6, 6, 6.6, 2.4);
    glass.bezierCurveTo(7, 0, 6.5, -3.2, 2, -4.5);
    glass.lineTo(2, -8);
    glass.closePath();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#1a1208';
    ctx.stroke(glass);
    ctx.fillStyle = 'rgba(200, 235, 220, 0.55)';
    ctx.fill(glass);
    ctx.save();
    ctx.clip(glass);
    const g = ctx.createLinearGradient(-6, -1, 6, 7);
    g.addColorStop(0, rgba(mix(C, [255, 255, 255], 0.35), 1));
    g.addColorStop(1, rgba(mix(C, [0, 0, 0], 0.45), 1));
    ctx.fillStyle = g;
    ctx.fillRect(-8, -1.2, 16, 9);
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(-3.4, 0.6, 0.9, 2.2, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2.4, -11);
    ctx.lineTo(2.4, -11);
    ctx.lineTo(2.1, -7.6);
    ctx.lineTo(-2.1, -7.6);
    ctx.closePath();
    ctx.fillStyle = '#c0905a';
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = '#24150a';
    ctx.stroke();
    ctx.restore();
  }
  /** Uma gota (na tela), na cor do efeito. */
  function drop(ctx, x, y, r, C, a) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = clamp01(a);
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.9);
    ctx.bezierCurveTo(x + r * 0.45, y - r * 1.1, x + r, y - r * 0.45, x + r, y);
    ctx.arc(x, y, r, 0, Math.PI);
    ctx.bezierCurveTo(x - r, y - r * 0.45, x - r * 0.45, y - r * 1.1, x, y - r * 1.9);
    ctx.closePath();
    ctx.fillStyle = rgba(mix(C, [255, 255, 255], 0.25), 1);
    ctx.fill();
    ctx.lineWidth = Math.max(0.5, r * 0.25);
    ctx.strokeStyle = rgba(mix(C, [0, 0, 0], 0.6), 0.9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.2, r * 0.28, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // As folhas: verdes de mato (estouro) ou o verde-azulado da arruda (benzimento), puxando um pouco para a cor do efeito.
  const MATO = { light: [178, 228, 112], dark: [52, 116, 40] };
  const ARRUDA = { light: [190, 238, 196], dark: [46, 116, 84] };

  /** A coluna de luz no corpo (fraca; atrás do corpo mais forte, na frente um véu). */
  function column(ctx, W, z, C, P, k, top, pass) {
    if (k <= 0.003) return;
    const b0 = W(0, 0, 0);
    const b1 = W(0, 0, top);
    const base = pass === 'tras' ? 0.05 : 0.018;
    for (const s of [1, 0.75, 0.5, 0.28]) {
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
  /** O brilho redondo no chão, nos pés. */
  function groundGlow(ctx, cam, W, z, C, P, r, k, ring) {
    if (k <= 0.003) return;
    const c0 = W(0, 0, 0);
    ctx.save();
    ctx.translate(c0.x, c0.y);
    ctx.scale(1, cam.sinP);
    glow(ctx, 0, 0, r * 1.2 * z, C, 0.32 * k);
    if (ring) {
      ctx.strokeStyle = rgba(P, 0.75 * k);
      ctx.lineWidth = Math.max(1, 2.2 * z);
      ctx.beginPath();
      ctx.arc(0, 0, r * z, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(C, 0.4 * k);
      ctx.lineWidth = Math.max(1, 6 * z);
      ctx.stroke();
    }
    ctx.restore();
  }
  /** Faíscas de cura subindo pelo corpo (as de trás passam atrás dele). */
  function healSparks(ctx, W, toCam, z, P, t, t0, span, n, pass, seed) {
    for (let j = 0; j < n; j++) {
      const u = (t - t0 - hash(j + seed) * span * 0.5) / span;
      if (u <= 0 || u >= 1) continue;
      const ang = hash(j + seed + 7) * TAU + u * 2.2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const far = dx * toCam.x + dy * toCam.y < 0;
      if (far !== (pass === 'tras')) continue;
      const h = 20 + u * 190;
      const rr = radiusAt(h) * (0.7 + 0.3 * hash(j + seed + 11));
      const q = W(dx * rr, dy * rr, h);
      const tw = 0.6 + 0.4 * Math.sin(t * 16 + j * 2.3);
      ctx.fillStyle = rgba(P, (1 - u) * tw);
      star(ctx, q.x, q.y, Math.max(1.5, (2.4 + 1.8 * hash(j + seed + 3)) * z), t * 2 + j);
    }
  }

  function drawEstouro(ctx, cam, W, toCam, t, o, pass) {
    const DUR = duration(o);
    const C = o.rgb;
    const P = o.pale;
    const z = cam.zoom;
    const fade = fadeAt(o, t);
    const T_UP = 0.32; // a garrafada sobe até aqui e estoura
    if (pass === 'chao') {
      const k = clamp01((t - T_UP) / 0.3) * fade;
      groundGlow(ctx, cam, W, z, C, P, R_BODY * (0.6 + 0.4 * easeOut((t - T_UP) / 0.6)), k, false);
      return;
    }
    // a luz no corpo, depois do estouro
    column(ctx, W, z, C, P, clamp01((t - T_UP - 0.05) / 0.3) * fade, 215, pass);
    // a garrafada subindo e girando (na frente de tudo; ela sai do peito, na frente do corpo)
    if (pass === 'frente' && t < T_UP + 0.02) {
      const u = clamp01(t / T_UP);
      const h = 118 + (BURST_H - 118) * easeOut(u);
      const q = W(toCam.x * 22, toCam.y * 22, h);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, q.x, q.y, 18 * z, C, 0.55);
      ctx.restore();
      bottle(ctx, q.x, q.y, 1.05 * z, u * TAU * 1.6, C);
      // um rastrinho de brilho embaixo
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(P, 0.7);
      for (let i = 1; i <= 3; i++) {
        const uu = clamp01(u - i * 0.09);
        const p = W(toCam.x * 22, toCam.y * 22, 118 + (BURST_H - 118) * easeOut(uu));
        star(ctx, p.x + Math.sin(i * 2.4) * 3 * z, p.y, Math.max(1.2, (3 - i * 0.6) * z), t * 4 + i);
      }
      ctx.restore();
    }
    // o estouro: o clarão, o anel abrindo e os cacos de luz
    if (pass === 'frente') {
      const u = (t - T_UP) / 0.42;
      if (u > 0 && u < 1) {
        const q = W(toCam.x * 10, toCam.y * 10, BURST_H);
        const k = 1 - u;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, q.x, q.y, (30 + 46 * easeOut(u)) * z, C, 0.85 * k);
        glow(ctx, q.x, q.y, (12 + 10 * u) * z, P, 0.9 * k);
        const ring = (8 + 38 * easeOut(u)) * z;
        ctx.strokeStyle = rgba(P, 0.8 * k);
        ctx.lineWidth = Math.max(1, 2.4 * z * k);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, ring, ring * 0.55, 0, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = rgba(P, 0.95 * k);
        for (let m = 0; m < 10; m++) {
          const a = (m / 10) * TAU + 0.3;
          const d = (8 + 34 * easeOut(u)) * z;
          star(ctx, q.x + Math.cos(a) * d, q.y + Math.sin(a) * d * 0.62, Math.max(1.2, 3.4 * z * k), a + t * 3);
        }
        ctx.restore();
      }
    }
    // as folhas e as gotas descendo em espiral em volta do corpo (as de trás passam atrás dele)
    const tint = (c) => mix(c, C, 0.22);
    const leafLight = tint(MATO.light);
    const leafDark = tint(MATO.dark);
    const nLeaves = o.big ? 18 : 14;
    for (let j = 0; j < nLeaves; j++) {
      const start = T_UP + 0.02 + hash(j + 31) * 0.1;
      const u = (t - start) / (DUR - start - 0.05);
      if (u <= 0 || u >= 1) continue;
      const ang = hash(j + 3) * TAU + u * (2.4 + hash(j + 5) * 1.4);
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const far = dx * toCam.x + dy * toCam.y < 0;
      if (far !== (pass === 'tras')) continue;
      const h = BURST_H - (BURST_H + 6) * Math.pow(u, 1.25);
      const rr = Math.min(radiusAt(Math.max(0, h)) * 1.05, (14 + 70 * easeOut(u * 1.8)) * (0.85 + 0.3 * hash(j + 9)));
      const q = W(dx * rr, dy * rr, Math.max(2, h));
      const a = Math.min(1, u / 0.08) * (1 - clamp01((u - 0.78) / 0.22));
      const flip = Math.sin(t * 9 + j * 1.7);
      leaf(ctx, q.x, q.y, (15 + 6 * hash(j + 13)) * z, t * 5 + j * 1.3, flip, a, leafLight, leafDark);
    }
    const nDrops = o.big ? 10 : 7;
    for (let j = 0; j < nDrops; j++) {
      const start = T_UP + 0.01 + hash(j + 71) * 0.08;
      const u = (t - start) / 0.62;
      if (u <= 0 || u >= 1) continue;
      const ang = hash(j + 41) * TAU + u * 1.2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const far = dx * toCam.x + dy * toCam.y < 0;
      if (far !== (pass === 'tras')) continue;
      const h = BURST_H - (BURST_H + 4) * Math.pow(u, 1.7);
      const rr = (10 + 52 * easeOut(u * 1.5)) * (0.8 + 0.4 * hash(j + 43));
      const q = W(dx * rr, dy * rr, Math.max(2, h));
      drop(ctx, q.x, q.y, Math.max(1.4, 3.3 * z), C, 1 - clamp01((u - 0.75) / 0.25));
    }
    // a cura subindo pelo corpo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    healSparks(ctx, W, toCam, z, P, t, T_UP + 0.15, 0.8, o.big ? 12 : 9, pass, 101);
    ctx.restore();
  }

  function drawBenzimento(ctx, cam, W, toCam, t, o, pass) {
    const DUR = duration(o);
    const C = o.rgb;
    const P = o.pale;
    const z = cam.zoom;
    const fade = fadeAt(o, t);
    if (pass === 'chao') {
      // o círculo da benzedeira abrindo nos pés
      const k = clamp01(t / 0.15) * fade;
      groundGlow(ctx, cam, W, z, C, P, R_BODY * easeOut(t / 0.3), k, true);
      return;
    }
    column(ctx, W, z, C, P, clamp01((t - 0.1) / 0.3) * fade, 220, pass);
    const RISE = 0.95; // quanto cada folha leva do chão ao alto
    const TOP = 232;
    // o rastro de luz: duas fitas em hélice subindo (o ramo passando)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const off of [0, Math.PI]) {
      const head = clamp01((t - 0.04) / RISE);
      const tail = Math.max(0, head - 0.4);
      const a = (1 - clamp01((t - RISE - 0.04) / 0.35)) * Math.min(1, t / 0.12);
      if (a <= 0.01) continue;
      let prev = null;
      for (let s = 0; s <= 24; s++) {
        const u = tail + ((head - tail) * s) / 24;
        const h = 4 + TOP * easeInOut(u);
        const ang = off + u * TAU * 1.3;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        const far = dx * toCam.x + dy * toCam.y < 0;
        const rr = radiusAt(h);
        const q = W(dx * rr, dy * rr, h);
        if (prev && far === (pass === 'tras')) {
          const k = (s / 24) * a;
          ctx.strokeStyle = rgba(C, 0.22 * k);
          ctx.lineWidth = Math.max(1, 7 * z);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
          ctx.strokeStyle = rgba(P, 0.45 * k);
          ctx.lineWidth = Math.max(0.8, 1.3 * z);
          ctx.stroke();
        }
        prev = q;
      }
    }
    ctx.restore();
    // as folhas de arruda subindo em redemoinho
    const tint = (c) => mix(c, C, 0.18);
    const leafLight = tint(ARRUDA.light);
    const leafDark = tint(ARRUDA.dark);
    const n = o.big ? 22 : 18;
    for (let j = 0; j < n; j++) {
      const delay = (j / n) * 0.34;
      const u = (t - 0.04 - delay) / RISE;
      if (u <= 0 || u >= 1) continue;
      const strand = j % 2 ? Math.PI : 0;
      const ang = strand + u * TAU * 1.3 - (hash(j + 2) - 0.5) * 0.5;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const far = dx * toCam.x + dy * toCam.y < 0;
      if (far !== (pass === 'tras')) continue;
      const h = 4 + TOP * easeInOut(u);
      const rr = radiusAt(h) * (0.92 + 0.14 * hash(j + 17));
      const q = W(dx * rr, dy * rr, h);
      // a folha deitada na direção em que gira (a ponta para a frente do movimento)
      const q2 = W(Math.cos(ang + 0.2) * rr, Math.sin(ang + 0.2) * rr, h + 6);
      const rot = Math.atan2(q2.y - q.y, q2.x - q.x);
      const a = Math.min(1, u / 0.12) * (1 - clamp01((u - 0.8) / 0.2));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, q.x, q.y, 11 * z, C, 0.3 * a);
      ctx.restore();
      leaf(ctx, q.x, q.y, (14 + 5 * hash(j + 19)) * z, rot, 0.6 + 0.4 * Math.sin(t * 7 + j), a, leafLight, leafDark);
    }
    // no alto, as folhas se juntam e viram faíscas (a bênção fechando)
    if (pass === 'frente') {
      const u = (t - RISE - 0.08) / 0.4;
      if (u > 0 && u < 1) {
        const q = W(0, 0, TOP + 8);
        const k = 1 - u;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, q.x, q.y, (22 + 26 * u) * z, C, 0.7 * k);
        ctx.fillStyle = rgba(P, 0.95 * k);
        for (let m = 0; m < 8; m++) {
          const a = (m / 8) * TAU + u * 1.5;
          const d = (6 + 34 * easeOut(u)) * z;
          star(ctx, q.x + Math.cos(a) * d, q.y + Math.sin(a) * d * 0.6, Math.max(1.2, 3.2 * z * k), a);
        }
        ctx.restore();
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    healSparks(ctx, W, toCam, z, P, t, 0.3, 0.9, o.big ? 10 : 7, pass, 201);
    ctx.restore();
  }

  /** A comida: faíscas na cor dela subindo do peito (estouro: espalhando; benzimento: em volta, girando). */
  function drawComida(ctx, cam, W, toCam, t, o, pass) {
    const C = o.rgb;
    const P = o.pale;
    const z = cam.zoom;
    const fade = fadeAt(o, t);
    if (pass === 'chao') {
      groundGlow(ctx, cam, W, z, C, P, R_BODY * 0.7, 0.6 * clamp01(t / 0.2) * fade, false);
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (pass === 'frente') {
      const q = W(toCam.x * 18, toCam.y * 18, 150);
      glow(ctx, q.x, q.y, 30 * z, C, 0.7 * clamp01(t / 0.12) * (1 - clamp01((t - 0.15) / 0.45)));
    }
    const n = 12;
    for (let j = 0; j < n; j++) {
      const u = (t - hash(j + 61) * 0.2) / 0.7;
      if (u <= 0 || u >= 1) continue;
      const ang = hash(j + 63) * TAU + (o.style === 'benzimento' ? u * 3 : u * 0.6);
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const far = dx * toCam.x + dy * toCam.y < 0;
      if (far !== (pass === 'tras')) continue;
      const rr = o.style === 'benzimento' ? 44 : 12 + 46 * easeOut(u);
      const h = 140 + 90 * easeOut(u);
      const q = W(dx * rr, dy * rr, h);
      ctx.fillStyle = rgba(P, (1 - u) * (0.75 + 0.25 * Math.sin(t * 15 + j)));
      star(ctx, q.x, q.y, Math.max(1.6, (3.4 + 2 * hash(j + 65)) * z), t * 3 + j);
      glow(ctx, q.x, q.y, 9 * z, C, 0.55 * (1 - u));
    }
    ctx.restore();
  }

  function draw(ctx, cam, foot, t, o, pass) {
    if (!(t >= 0 && t <= duration(o))) return;
    const W = (x, y, h) => cam.p({ x: foot.x + x, y: foot.y + y, z: foot.z + h });
    const toCam = cam.toCamera;
    ctx.save();
    if (o.kind === 'comida') drawComida(ctx, cam, W, toCam, t, o, pass);
    else if (o.style === 'benzimento') drawBenzimento(ctx, cam, W, toCam, t, o, pass);
    else drawEstouro(ctx, cam, W, toCam, t, o, pass);
    ctx.restore();
  }

  PD.consumeFx = { draw, look, duration, light, styles: STYLES, R_BODY };
})(window.PD || (window.PD = {}));
