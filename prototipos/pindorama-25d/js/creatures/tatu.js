// Tatu-bola (o tatu de três faixas da mata do sul do Capão; regras da [estrutura], 15/11): a carapaça em gomos
// (escudo da frente, as três faixas que dobram no meio e o escudo de trás), a cabecinha pontuda com o escudo em cima,
// as orelhinhas, o rabo curto de casca e as patas curtas com unhas. Anda de passinho, balançando a casca. No aviso
// ('windup', 0,9 s) se fecha numa bola; na investida ('charge') rola em linha, com as faixas girando, e abre no fim.
// 'block': a casca segurou um golpe de frente (o "tlinc": a faísca na casca). 'dizzy': abriu tonto depois da investida
// (2 s parado, com as estrelinhas girando em cima da cabeça). Ao cair ('die'), tomba de lado.
//   PD.creatures.create('tatu_bola', xCm, yCm, yaw)
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  if (!C) return;
  const { tube } = C;

  /** Tamanho de jogo: maior que o de verdade (uns 25 cm), para ler com a câmera longe. */
  const S = 1.7;
  const COL = {
    shell: { base: '#9a8566', shade: '#6d5c43', light: '#c4ad88' },
    band: { base: '#7e6a4e', shade: '#564733', light: '#a48d6b' },
    head: { base: '#8a7558', shade: '#5e4e39', light: '#ad9675' },
    skin: { base: '#b39a86', shade: '#86705f', light: '#d3bba7' },
  };
  const EYE = '#140c06';
  /** O raio da bola fechada (cm, antes do S) e onde fica o meio dela. */
  const BALL_R = 15;
  const BALL_A = -3;

  class Tatu extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 26 * S;
      this.top = 36 * S;
      this.acts = { windup: { dur: 0.9, hold: 0.4 }, charge: { dur: 1.1, hold: 0.3 } };
      /** Aberto (0) a fechado na bola (1). */
      this.curl = 0;
      /** Quanto rolou (radianos): as faixas giram com a distância. */
      this.roll = 0;
      /** Segundos desde a casca segurar um golpe ('block') e desde abrir tonto ('dizzy'). */
      this.blockT = 9;
      this.dizzyT = 9;
      this.walk = 0;
    }

    action(kind, yaw) {
      // a faísca e o tonto não interrompem o resto
      if (kind === 'block') {
        this.blockT = 0;
        return;
      }
      if (kind === 'dizzy') {
        this.dizzyT = 0;
        this.act = null;
        return;
      }
      super.action(kind, yaw);
    }

    animate(dt) {
      this.blockT += dt;
      this.dizzyT += dt;
      const act = this.act;
      const closed = this.dying === null && !!act && (act.kind === 'windup' || act.kind === 'charge');
      this.curl = M.damp(this.curl, closed ? 1 : 0, closed ? 7 : 5, dt);
      this.walk = M.smoothstep(4, 40, this.speed) * (1 - this.curl);
      // rolando: a bola gira com a distância que anda
      this.roll += (this.speed * dt) / (BALL_R * S);
      this.phase = (this.phase + (this.speed * dt) / (26 * S)) % 1;
      this.label = this.dying !== null ? 'caído' : this.dizzyT < 2 ? 'tonto' : closed ? (act.kind === 'windup' ? 'fechando' : 'rolando') : this.walk > 0.5 ? 'andando' : 'parado';
    }

    parts(cam) {
      const t = this.time;
      const curl = M.smoothstep(0, 1, this.curl);
      const walk = this.walk;
      const ph = this.phase * M.TAU;
      const hurt = this.hurtT < 0.3 ? 1 - this.hurtT / 0.3 : 0;
      const dizzy = this.dizzyT < 2 ? 1 - M.smoothstep(1.6, 2, this.dizzyT) : 0;
      // balanço da casca andando (de um lado para o outro) e tonto (cambaleando)
      const rock = Math.sin(ph * 2) * 1.2 * walk + Math.sin(t * 5) * 2.2 * dizzy;
      const at = (a, s, z) => this.at(a * S, (s + rock * (z / 30)) * S, z * S);
      const ball = { a: BALL_A, z: BALL_R + 1 };
      const groups = [];

      // a carapaça: fatias de pé ao longo do corpo; fechando, cada uma vai para a bola
      const shell = [];
      const decals = [];
      const n = 9;
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        const a = -24 + u * 42;
        const r = 14.5 * Math.pow(Math.sin(Math.PI * (0.1 + 0.8 * u)), 0.45);
        const z = 13 + Math.sin(u * Math.PI) * 2 - hurt;
        // na bola: as fatias se juntam no meio, todas do tamanho da bola
        const ang = (u - 0.5) * Math.PI * 0.9;
        const ba = ball.a + Math.sin(ang) * BALL_R * 0.55;
        const bz = ball.z + Math.cos(ang) * BALL_R * 0.1;
        const band = k >= 3 && k <= 6 ? (k % 2 ? COL.band : COL.shell) : COL.shell;
        shell.push({ c: at(M.lerp(a, ba, curl), 0, M.lerp(z, bz, curl)), r: M.lerp(r, BALL_R * 0.92, curl) * S, col: band });
      }
      // as linhas das faixas (aberto) e, na bola, as faixas girando com o rolar
      const fwd = { x: Math.cos(this.yaw), y: Math.sin(this.yaw), z: 0 };
      const side = { x: -fwd.y, y: fwd.x, z: 0 };
      const center = at(ball.a, 0, ball.z);
      if (curl > 0.6) {
        for (let i = 0; i < 6; i++) {
          const ang = this.roll + (i / 6) * M.TAU;
          const n3 = { x: fwd.x * Math.sin(ang), y: fwd.y * Math.sin(ang), z: Math.cos(ang) };
          decals.push({ c: M.add(center, M.scale(n3, BALL_R * S * 0.98)), n: n3, u: side, v: M.norm({ x: fwd.x * Math.cos(ang), y: fwd.y * Math.cos(ang), z: -Math.sin(ang) }), ru: BALL_R * S * 0.72, rv: 1.1 * S, color: 'rgba(60, 46, 30, 0.75)', minFacing: 0.15 });
        }
      } else {
        for (const k of [3, 4, 5, 6, 7]) {
          const sl = shell[k];
          const top = { x: sl.c.x, y: sl.c.y, z: sl.c.z + sl.r * 0.96 };
          decals.push({ c: top, n: { x: 0, y: 0, z: 1 }, u: side, v: fwd, ru: sl.r * 0.62, rv: 0.9 * S, color: 'rgba(60, 46, 30, 0.7)', minFacing: -1 });
        }
      }
      groups.push({ balls: shell, ref: at(-3, 0, 14), body: true, decals });

      // patas curtas com unhas (somem dentro da bola)
      if (curl < 0.85) {
        for (const [a, s, off] of [[-14, -8, 0], [-14, 8, 0.5], [9, -7.5, 0.5], [9, 7.5, 0]]) {
          const q = ph + off * M.TAU;
          const hip = at(a, s * 0.8, 9);
          const foot = at(a + Math.sin(q) * 5 * walk, s, 1.2 + Math.max(0, Math.cos(q)) * 2.5 * walk);
          const tuck = M.lerp3(foot, hip, curl);
          groups.push({ balls: tube(hip, tuck, 3.2 * S, 2.6 * S, COL.skin), ref: tuck });
        }
      }

      // o rabo curto de casca (entra na bola)
      const tail = [];
      for (let k = 0; k <= 3; k++) {
        const u = k / 3;
        const a = M.lerp(-25 - u * 9, ball.a - BALL_R * 0.4, curl);
        const z = M.lerp(9 - u * 5, ball.z - BALL_R * 0.5, curl);
        tail.push({ c: at(a, 0, z), r: (4 - u * 2.2) * S * (1 - curl * 0.5), col: COL.band });
      }
      groups.push({ balls: tail, ref: at(-28, 0, 7) });

      // a cabeça pontuda com o escudo, as orelhas e os olhos (entra na bola; tonto, balança)
      const wob = Math.sin(t * 6) * 0.35 * dizzy;
      const hy = this.yaw + wob;
      const hf = { x: Math.cos(hy), y: Math.sin(hy), z: 0 };
      const hs = { x: -hf.y, y: hf.x, z: 0 };
      const neck = at(M.lerp(17, ball.a + BALL_R * 0.55, curl), 0, M.lerp(10, ball.z - 2, curl));
      const onHead = (da, ds, dz) => M.add(neck, M.add(M.scale(hf, da * S * (1 - curl * 0.7)), M.add(M.scale(hs, ds * S), { x: 0, y: 0, z: dz * S })));
      const head = [];
      for (let k = 0; k <= 4; k++) {
        const u = k / 4;
        head.push({ c: onHead(u * 11, 0, 1 - u * 3), r: (5.6 - u * 3.4) * S * (1 - curl * 0.6), col: k < 2 ? COL.head : COL.skin });
      }
      const hdecals = [];
      if (curl < 0.6) {
        for (const sgn of [-1, 1]) {
          const out = M.scale(hs, sgn);
          hdecals.push({ c: M.add(onHead(4, 0, 2), M.scale(out, 4.4 * S)), n: out, u: hf, v: { x: 0, y: 0, z: 1 }, ru: 1.2 * S, rv: 1.2 * S, color: C.eyeColor(EYE), glow: C.eyeGlow(undefined), minFacing: 0.12 });
        }
      }
      groups.push({ balls: head, ref: onHead(5, 0, 0), decals: hdecals });
      if (curl < 0.6) groups.push({ balls: [-1, 1].map((sgn) => ({ c: onHead(0, sgn * 4, 5.5), r: 2.4 * S, col: COL.skin })), ref: onHead(0, 0, 6), noShadow: true });

      // por cima: a faísca da casca ('block') e as estrelinhas do tonto
      const blockT = this.blockT;
      const after = (ctx) => {
        if (blockT < 0.35) {
          const k = blockT / 0.35;
          const p = cam.p(M.add(center, M.add(M.scale(fwd, BALL_R * S * 0.9), { x: 0, y: 0, z: 4 * S })));
          const z = cam.zoom;
          ctx.save();
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = '#fff8d8';
          ctx.lineWidth = 2.2 * z;
          ctx.lineCap = 'round';
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * M.TAU + 0.3;
            const r0 = (4 + k * 6) * z;
            const r1 = (10 + k * 14) * z;
            ctx.beginPath();
            ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0 * 0.8);
            ctx.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1 * 0.8);
            ctx.stroke();
          }
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, (4 - k * 2) * z, 0, M.TAU);
          ctx.fill();
          ctx.restore();
        }
        if (dizzy > 0.02) {
          const top = cam.p(onHead(3, 0, 14));
          const z = cam.zoom;
          ctx.save();
          ctx.globalAlpha = Math.min(1, dizzy * 1.5);
          for (let i = 0; i < 3; i++) {
            const a = t * 4 + (i / 3) * M.TAU;
            const x = top.x + Math.cos(a) * 11 * z;
            const y = top.y + Math.sin(a) * 4 * z;
            star(ctx, x, y, 3.6 * z);
          }
          ctx.restore();
        }
      };
      return { groups, after };
    }
  }

  /** Estrelinha amarela de cinco pontas (o tonto). */
  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * M.TAU;
      const rr = i % 2 ? r * 0.45 : r;
      i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffe14a';
    ctx.strokeStyle = '#5a3c08';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
  }

  C.define('tatu_bola', Tatu);
})(window.PD = window.PD || {});
