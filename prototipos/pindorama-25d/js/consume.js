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
  // `style`: o estouro nas garrafadas, o benzimento na arruda (a escolha do dono). `anim`: o que o corpo faz (veja
  // "as animações de quem bebe ou come", mais abaixo): 'toss' joga a garrafada para cima, 'eat' come, 'drink' bebe.
  const LOOKS = {
    garrafada_pequena: { kind: 'pocao', style: 'estouro', anim: 'toss', rgb: [196, 232, 86], pale: [240, 255, 205], hex: '#cde85a' },
    garrafada: { kind: 'pocao', style: 'estouro', anim: 'toss', rgb: [255, 172, 64], pale: [255, 236, 190], hex: '#ffb44a' },
    garrafada_grande: { kind: 'pocao', style: 'estouro', anim: 'toss', big: true, rgb: [255, 96, 64], pale: [255, 214, 196], hex: '#ff7a52' },
    erva_arruda: { kind: 'pocao', style: 'benzimento', rgb: [120, 222, 150], pale: [218, 255, 228], hex: '#86e0a0' },
    banana: { kind: 'comida', style: 'estouro', anim: 'eat', rgb: [255, 216, 72], pale: [255, 248, 200], hex: '#ffd84a' },
    agua_coco: { kind: 'comida', style: 'estouro', anim: 'drink', rgb: [128, 208, 255], pale: [222, 245, 255], hex: '#8ed0ff' },
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
    if (o.kind === 'comida') return 1.2;
    return o.style === 'benzimento' ? 1.45 : 1.55;
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

  function drawEstouro(ctx, cam, W, toCam, t, o, pass, who) {
    const DUR = duration(o);
    const C = o.rgb;
    const P = o.pale;
    const z = cam.zoom;
    const fade = fadeAt(o, t);
    const T_UP = T_BURST; // a garrafada sobe até aqui e estoura
    if (pass === 'chao') {
      const k = clamp01((t - T_UP) / 0.3) * fade;
      groundGlow(ctx, cam, W, z, C, P, R_BODY * (0.6 + 0.4 * easeOut((t - T_UP) / 0.6)), k, false);
      return;
    }
    // a luz no corpo, depois do estouro
    column(ctx, W, z, C, P, clamp01((t - T_UP - 0.05) / 0.3) * fade, 215, pass);
    // a garrafada voando e girando até o estouro (na frente de tudo). Com a animação, ela sai da mão na hora de soltar
    // (`fx.grip`, a última posição na mão); sem ela (atirando, rolando), sai do peito, na frente do corpo
    const grip = who && who.fx && who.fx.grip;
    const t0 = grip ? T_REL : 0.12;
    if (pass === 'frente' && t >= t0 && t < T_UP + 0.02) {
      const from = grip || { x: toCam.x * 22, y: toCam.y * 22, z: 118 };
      const to = { x: toCam.x * 10, y: toCam.y * 10, z: BURST_H };
      const at = (u) => {
        const e = easeOut(u);
        return W(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, from.z + (to.z - from.z) * e);
      };
      const u = clamp01((t - t0) / (T_UP - t0));
      const q = at(u);
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
        const p = at(clamp01(u - i * 0.12));
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
      // (pequeno e fraco: fica na frente do rosto)
      const q = W(toCam.x * 22, toCam.y * 22, 162);
      glow(ctx, q.x, q.y, 14 * z, C, 0.32 * clamp01((t - 0.28) / 0.12) * (1 - clamp01((t - 0.45) / 0.5)));
    }
    const n = 12;
    for (let j = 0; j < n; j++) {
      const u = (t - 0.3 - hash(j + 61) * 0.25) / 0.7;
      if (u <= 0 || u >= 1) continue;
      const ang = hash(j + 63) * TAU + (o.style === 'benzimento' ? u * 3 : u * 0.6);
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const far = dx * toCam.x + dy * toCam.y < 0;
      if (far !== (pass === 'tras')) continue;
      const rr = o.style === 'benzimento' ? 44 : 12 + 46 * easeOut(u);
      const h = 150 + 80 * easeOut(u);
      const q = W(dx * rr, dy * rr, h);
      ctx.fillStyle = rgba(P, (1 - u) * (0.75 + 0.25 * Math.sin(t * 15 + j)));
      star(ctx, q.x, q.y, Math.max(1.6, (3 + 1.8 * hash(j + 65)) * z), t * 3 + j);
      glow(ctx, q.x, q.y, 7 * z, C, 0.4 * (1 - u));
    }
    ctx.restore();
  }

  /**
   * `who` (da view, opcional): `{ rig, ch, fx }` — o esqueleto deste quadro, o personagem (a animação dele em
   * `ch.consumeAnim`) e o estado do efeito (`fx`, onde fica guardada a última posição da garrafada na mão). Sem ele (as
   * pranchas e os testes), o efeito sai sem o item na mão.
   */
  function draw(ctx, cam, foot, t, o, pass, who) {
    if (!(t >= 0 && t <= duration(o))) return;
    const W = (x, y, h) => cam.p({ x: foot.x + x, y: foot.y + y, z: foot.z + h });
    const toCam = cam.toCamera;
    ctx.save();
    if (who && pass !== 'chao') drawHeld(ctx, cam, foot, o, pass, who);
    if (o.kind === 'comida') drawComida(ctx, cam, W, toCam, t, o, pass);
    else if (o.style === 'benzimento') drawBenzimento(ctx, cam, W, toCam, t, o, pass);
    else drawEstouro(ctx, cam, W, toCam, t, o, pass, who);
    ctx.restore();
  }

  // ---------------------------------------------------------------- as animações de quem bebe ou come
  // (pedido do dono, 23/11: "faça animação dele jogando a poção para cima" e "comendo a banana e tomando água de coco").
  // A mão direita (a esquerda é a do arco) leva o item, por cima da pose do corpo (o animador chama `applyPose`, como o
  // do estilingue); a view desenha o item na mão (`draw`, com `who`):
  //   'toss'  — desce a garrafinha na frente da barriga, joga para cima e solta acima da cabeça em `T_REL`, olhando a
  //             garrafa subir; o voo e o estouro (em `T_BURST`) continuam no efeito;
  //   'eat'   — leva a banana à boca e dá duas mordidas (ela encurta a cada uma);
  //   'drink' — leva o coco à boca, com o canudinho, e bebe.
  // Os alvos da mão são do punho a partir do ombro direito, no espaço do peito (x = para fora, y = frente, z = cima),
  // como os do slingshot.js; o `pole` é para onde o cotovelo aponta ([frente, fora, cima]).
  const T_REL = 0.3;
  const T_BURST = 0.52;
  const ANIM = {
    toss: {
      dur: 0.8,
      keys: [
        { t: 0, k: 0 },
        { t: 0.13, k: 1, hand: { x: 3, y: 24, z: -30 }, pole: [0.5, 0.6, -0.5], fist: 0.85 },
        { t: T_REL, k: 1, hand: { x: 9, y: 12, z: 47 }, pole: [0.3, 0.9, 0.1], fist: 0.85 },
        { t: 0.4, k: 1, hand: { x: 10, y: 14, z: 44 }, pole: [0.3, 0.9, 0.1], fist: 0.12 },
        { t: 0.8, k: 0 },
      ],
    },
    eat: {
      dur: 1.15,
      keys: [
        { t: 0, k: 0 },
        { t: 0.26, k: 1, hand: { x: -15, y: 17, z: 27 }, pole: [0.1, 0.8, -0.6], fist: 0.8 },
        { t: 0.88, k: 1, hand: { x: -15, y: 17, z: 27 }, pole: [0.1, 0.8, -0.6], fist: 0.8 },
        { t: 1.15, k: 0 },
      ],
      bites: [0.38, 0.66],
    },
    drink: {
      dur: 1.25,
      keys: [
        { t: 0, k: 0 },
        { t: 0.26, k: 1, hand: { x: -12, y: 25, z: 11 }, pole: [0.1, 0.8, -0.6], fist: 0.5 },
        { t: 0.96, k: 1, hand: { x: -12, y: 25, z: 11 }, pole: [0.1, 0.8, -0.6], fist: 0.5 },
        { t: 1.25, k: 0 },
      ],
    },
  };
  const ease = (k) => {
    const v = clamp01(k);
    return v * v * (3 - 2 * v);
  };
  const lerp = (a, b, k) => a + (b - a) * k;
  const vlen = (v) => Math.hypot(v.x, v.y, v.z);
  /**
   * Mistura dois alvos do punho girando em volta do ombro (a direção e a distância), e não em linha reta: a reta entre a
   * mão caída e a boca passa colada no ombro e o cotovelo dobrava para o lado errado.
   */
  function swing(a, b, k) {
    const la = vlen(a) || 1;
    const lb = vlen(b) || 1;
    const ua = { x: a.x / la, y: a.y / la, z: a.z / la };
    const ub = { x: b.x / lb, y: b.y / lb, z: b.z / lb };
    const dot = Math.max(-1, Math.min(1, ua.x * ub.x + ua.y * ub.y + ua.z * ub.z));
    const ang = Math.acos(dot);
    let d;
    if (ang < 1e-3) d = ua;
    else {
      const s0 = Math.sin((1 - k) * ang) / Math.sin(ang);
      const s1 = Math.sin(k * ang) / Math.sin(ang);
      d = { x: ua.x * s0 + ub.x * s1, y: ua.y * s0 + ub.y * s1, z: ua.z * s0 + ub.z * s1 };
    }
    const l = lerp(la, lb, k);
    return { x: d.x * l, y: d.y * l, z: d.z * l };
  }
  /** Onde está a animação no tempo `t`: o alvo da mão (misturado com o da pose de agora, `base`), o cotovelo e o punho. */
  function sample(A, t, base, basePole, baseFist) {
    const keys = A.keys;
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const u = ease((t - a.t) / Math.max(1e-3, b.t - a.t));
    const pick = (key) => ({
      hand: key.k > 0 ? key.hand : base,
      pole: key.k > 0 ? key.pole : basePole,
      fist: key.k > 0 ? key.fist : baseFist,
    });
    const pa = pick(a);
    const pb = pick(b);
    return {
      hand: swing(pa.hand, pb.hand, u),
      pole: pa.pole.map((v, j) => lerp(v, pb.pole[j], u)),
      fist: lerp(pa.fist, pb.fist, u),
      k: lerp(a.k, b.k, u),
    };
  }
  /**
   * Por cima da pose do corpo (o animador chama a cada quadro, depois do estilingue): a mão direita, a cabeça (olha a
   * garrafa subir; baixa um pouco para morder e beber) e a boca. Deixa em `look` o que a view desenha na mão
   * (`heldItem`) e o que o animador usa na cabeça e na boca (`consumeHead`, em radianos, + = para baixo; `consumeMouth`).
   */
  function applyPose(ch, parts) {
    const L = ch.look;
    L.heldItem = null;
    L.consumeHead = 0;
    L.consumeMouth = 0;
    const C = ch.consumeAnim;
    if (!C) return 0;
    const A = ANIM[C.kind];
    const t = ch.time - C.start;
    if (!A || !(t >= 0) || t > A.dur) {
      ch.consumeAnim = null;
      return 0;
    }
    // atirando, rolando ou desmaiado, o corpo tem coisa mais importante para fazer (o efeito continua)
    if ((ch.attack && ch.attack.kind === 'slingshot') || ch.dodge || ch.death) return 0;
    const h = parts.hands[1];
    const s = sample(A, t, { ...h.local }, h.poleLocal.slice(), h.fist ?? 0.3);
    h.local = s.hand;
    h.poleLocal = s.pole;
    h.fist = s.fist;
    h.flex = lerp(h.flex || 0, 0.15, s.k);
    h.twist = lerp(h.twist || 0, C.kind === 'toss' ? 0.2 : -0.35, s.k);
    const DEG = Math.PI / 180;
    if (C.kind === 'toss') {
      // um tiquinho para trás ao jogar, e os olhos na garrafa até o estouro
      parts.spine.pitch -= 6 * DEG * Math.sin(Math.PI * clamp01((t - 0.12) / 0.4));
      L.consumeHead = -28 * DEG * ease((t - 0.2) / 0.15) * (1 - ease((t - 0.62) / 0.18));
      if (t < T_REL) L.heldItem = { kind: 'bottle', item: C.item };
    } else if (C.kind === 'eat') {
      // as mordidas: a cabeça vai de encontro à banana, a boca abre e fecha
      let bite = 0;
      let bitten = 0;
      for (const b of A.bites) {
        const v = (t - (b - 0.08)) / 0.2;
        if (v > 0 && v < 1) bite = Math.max(bite, Math.sin(Math.PI * v));
        if (t > b) bitten++;
      }
      L.consumeHead = (4 + 6 * bite) * DEG * s.k;
      L.consumeMouth = 0.55 * bite + 0.12 * s.k * (1 - bite);
      h.local = { x: h.local.x, y: h.local.y - 2.5 * bite, z: h.local.z + 1 * bite };
      if (t < 1.02) L.heldItem = { kind: 'banana', item: C.item, bitten, fade: 1 - ease((t - 0.9) / 0.12) };
    } else {
      // bebendo: a cabeça baixa um pouco até o canudinho e a boca fica no canudo
      const sip = ease((t - 0.3) / 0.1) * (1 - ease((t - 0.92) / 0.1));
      L.consumeHead = 7 * DEG * sip + 2 * DEG * Math.sin(t * 9) * sip;
      L.consumeMouth = 0.2 * sip;
      if (t < 1.12) L.heldItem = { kind: 'coco', item: C.item, fade: 1 - ease((t - 1.02) / 0.1) };
    }
    return s.k;
  }

  const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const sc3 = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });

  /** O item na mão direita (a garrafinha, a banana ou o coco), na frente ou atrás do corpo, conforme a mão. */
  function drawHeld(ctx, cam, foot, o, pass, who) {
    const ch = who.ch;
    const rig = who.rig;
    const H = ch && ch.look && ch.look.heldItem;
    if (!H || !rig || !rig.hand || !rig.hand[1]) return;
    const hand = rig.hand[1];
    // o meio do punho fechado: um pouco à frente do punho, do lado da palma
    const grip = add3(add3(hand.o, sc3(hand.a, 5.5)), sc3(hand.d, -2.2));
    if (who.fx && H.kind === 'bottle') who.fx.grip = sub3(grip, foot);
    // na frente do corpo se a mão está mais perto da câmera que o meio do peito (ou da cabeça, na boca)
    const ref = H.kind === 'bottle' ? rig.chest.o : rig.head.o;
    const toCam = cam.toCamera;
    const front = (grip.x - ref.x) * toCam.x + (grip.y - ref.y) * toCam.y >= 0;
    if (front !== (pass === 'frente')) return;
    const z = cam.zoom;
    const p = cam.p(grip);
    // o eixo do item na tela: para o lado do polegar (a garrafinha com a rolha para cima, a banana saindo do punho)
    const q = cam.p(add3(grip, sc3(hand.s, 10)));
    let ax = q.x - p.x;
    let ay = q.y - p.y;
    const al = Math.hypot(ax, ay) || 1;
    ax /= al;
    ay /= al;
    if (H.kind === 'bottle') {
      bottle(ctx, p.x, p.y, 1.05 * z, Math.atan2(ax, -ay), o.rgb);
    } else if (H.kind === 'banana') {
      heldBanana(ctx, p.x, p.y, ax, ay, z, H.bitten || 0, H.fade ?? 1);
    } else {
      // o coco na palma (um pouco à frente dela) e o canudinho até a boca
      const ball = add3(grip, add3(sc3(hand.d, -4), sc3(hand.s, 2)));
      const mouth = add3(rig.head.o, add3(sc3(rig.head.f, 9.5), sc3(rig.head.u, -6.5)));
      heldCoconut(ctx, cam.p(ball), cam.p(mouth), z, H.fade ?? 1);
    }
  }

  /** A banana na mão (na tela): descascada em cima, encurtando a cada mordida; `ax, ay` = para onde ela aponta. */
  function heldBanana(ctx, x, y, ax, ay, z, bitten, alpha) {
    if (alpha <= 0.01) return;
    const len = (17 - 4.5 * Math.min(2, bitten)) * z;
    const nx = -ay;
    const ny = ax;
    const N = 12;
    const mid = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const d = -4 * z + (len + 4 * z) * u; // do talo, embaixo do punho, até a ponta
      const bend = Math.sin(Math.PI * u) * 2.6 * z;
      mid.push([x + ax * d + nx * bend, y + ay * d + ny * bend]);
    }
    const width = (u) => Math.max(0.6, 2.7 * z * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.88)), 0.55));
    const body = new Path2D();
    for (let i = 0; i <= N; i++) {
      const w = width(i / N);
      const [px, py] = mid[i];
      if (i === 0) body.moveTo(px + nx * w, py + ny * w);
      else body.lineTo(px + nx * w, py + ny * w);
    }
    for (let i = N; i >= 0; i--) {
      const w = width(i / N);
      const [px, py] = mid[i];
      body.lineTo(px - nx * w, py - ny * w);
    }
    body.closePath();
    ctx.save();
    ctx.globalAlpha = clamp01(alpha);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, 1.1 * z);
    ctx.strokeStyle = '#3a2a08';
    ctx.stroke(body);
    const g = ctx.createLinearGradient(x + nx * 3 * z, y + ny * 3 * z, x - nx * 3 * z, y - ny * 3 * z);
    g.addColorStop(0, '#fff07a');
    g.addColorStop(0.6, '#f2c832');
    g.addColorStop(1, '#b8860e');
    ctx.fillStyle = g;
    ctx.fill(body);
    // a ponta descascada (a polpa clara) e as cascas caindo dos lados
    const peel = Math.floor(N * 0.72);
    const [tx, ty] = mid[N];
    const [px, py] = mid[peel];
    ctx.fillStyle = '#fbf3d2';
    ctx.beginPath();
    ctx.ellipse((tx + px) / 2, (ty + py) / 2, Math.hypot(tx - px, ty - py) / 2 + 0.6 * z, width(0.86) * 0.85, Math.atan2(ty - py, tx - px), 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, 0.9 * z);
    ctx.strokeStyle = '#6a5420';
    ctx.stroke();
    ctx.fillStyle = '#f2c832';
    for (const side of [-1, 1]) {
      const [bx, by] = mid[peel];
      const w = width(peel / N);
      ctx.beginPath();
      ctx.moveTo(bx + nx * w * side, by + ny * w * side);
      ctx.quadraticCurveTo(bx + nx * w * side * 2.4 - ax * 2 * z, by + ny * w * side * 2.4 - ay * 2 * z, bx + nx * w * side * 1.6 - ax * 5 * z, by + ny * w * side * 1.6 - ay * 5 * z);
      ctx.lineTo(bx + nx * w * side * 0.4 - ax * 1.5 * z, by + ny * w * side * 0.4 - ay * 1.5 * z);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // o talo, saindo embaixo do punho
    const [sx, sy] = mid[0];
    ctx.strokeStyle = '#5a3c10';
    ctx.lineWidth = Math.max(1, 1.6 * z);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - ax * 2.2 * z, sy - ay * 2.2 * z);
    ctx.stroke();
    ctx.restore();
  }

  /** O coco verde na mão (na tela), com a tampa cortada e o canudinho listrado saindo dela até a boca. */
  function heldCoconut(ctx, c, mouth, z, alpha) {
    if (alpha <= 0.01) return;
    const r = 8.5 * z;
    ctx.save();
    ctx.globalAlpha = clamp01(alpha);
    // o coco
    ctx.lineWidth = Math.max(1, 1.2 * z);
    ctx.strokeStyle = '#132a08';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r * 0.92, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(c.x - r * 0.35, c.y - r * 0.35, r * 0.1, c.x, c.y, r);
    g.addColorStop(0, '#c4ee80');
    g.addColorStop(0.55, '#5fa82c');
    g.addColorStop(1, '#2c5e12');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
    // a tampa cortada
    const lid = { x: c.x + 1 * z, y: c.y - r * 0.72 };
    ctx.fillStyle = '#f6efd2';
    ctx.beginPath();
    ctx.ellipse(lid.x, lid.y, r * 0.5, r * 0.2, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, 0.8 * z);
    ctx.strokeStyle = '#4a4010';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(c.x - r * 0.42, c.y - r * 0.1, r * 0.18, r * 0.34, 0.5, 0, Math.PI * 2);
    ctx.fill();
    // o canudinho, por cima: sai da tampa e aponta para a boca (até 14 cm; chega nela com o coco embaixo do queixo)
    const dx = mouth.x - lid.x;
    const dy = mouth.y - lid.y;
    const dl = Math.hypot(dx, dy) || 1;
    const reach = Math.min(dl, 14 * z);
    const tip = { x: lid.x + (dx / dl) * reach, y: lid.y + (dy / dl) * reach };
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = Math.max(1.8, 2.8 * z);
    ctx.beginPath();
    ctx.moveTo(lid.x, lid.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 1.6 * z);
    ctx.stroke();
    ctx.strokeStyle = '#d8402e';
    for (const k of [0.3, 0.65]) {
      const mx = lid.x + (tip.x - lid.x) * k;
      const my = lid.y + (tip.y - lid.y) * k;
      ctx.beginPath();
      ctx.moveTo(mx - 0.7 * z, my - 0.7 * z);
      ctx.lineTo(mx + 0.7 * z, my + 0.7 * z);
      ctx.stroke();
    }
    ctx.restore();
  }

  PD.consumeFx = { draw, look, duration, light, applyPose, styles: STYLES, ANIM, T_REL, T_BURST, R_BODY };
})(window.PD || (window.PD = {}));
