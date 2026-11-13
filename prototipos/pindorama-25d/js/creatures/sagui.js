// Sagui Travesso (o sagui-de-tufo-branco encantado da mata do parque): cinza-amarronzado, rosto escuro com a mancha
// branca na testa, os tufos brancos dos lados da cabeça, olhos amarelos acesos (o encanto) e o rabo comprido de anéis.
// Parado, senta nas patas de trás e olha em volta; andando, corre de quatro aos saltos; no golpe, senta, ergue a
// fruta atrás da cabeça ('windup') e arremessa ('shoot'). Do servidor vêm só a casa, o lado e o golpe.
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  const { tube } = C;

  /** Tamanho: o sagui de verdade tem uns 20 cm de corpo; no jogo ele é maior (sentado, uns 65 cm), para ler bem no
   *  celular, onde o herói tem uns 80 px de altura. */
  const S = 1.35;
  const COL = {
    fur: { base: '#8c7d6c', shade: '#5f5448', light: '#b5a790' },
    back: { base: '#7a6c5c', shade: '#544a3f', light: '#a0927e' },
    belly: { base: '#a39581', shade: '#776a5a', light: '#c4b8a4' },
    dark: { base: '#3d322b', shade: '#2a221d', light: '#5a4b40' },
    white: { base: '#f4f1ea', shade: '#cdc5b6', light: '#ffffff' },
    ringD: { base: '#4d4338', shade: '#362e26', light: '#685b4c' },
    ringL: { base: '#b8aa97', shade: '#8f8270', light: '#d6cbb9' },
    fruit: { base: '#c9e265', shade: '#7f9a2a', light: '#ecf7b4' },
  };
  const FACE = '#3d322b';
  const EYE = '#f2d27a';
  const EYE_GLOW = 'rgba(255, 214, 110, 0.7)';
  const MOTE = '#cfb3ff';

  /** Joelho ou cotovelo entre a raiz e a ponta, com os ossos `l1` e `l2`, dobrando para o lado de `hint`. */
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

  class Sagui extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 20 * S;
      this.up = 1;
      this.run = 0;
      /** Braço do arremesso: 'raise' (preparo, fruta atrás da cabeça) ou 'throw'; `armK` 0..1 do repouso até lá. */
      this.armMode = 'raise';
      this.armK = 0;
      this.thr = 0;
      this.top = 62 * S;
      this.acts = { windup: { dur: 0.3, hold: 0.9 }, shoot: { dur: 0.3, hold: 0.22 } };
    }

    animate(dt) {
      this.run = M.smoothstep(30, 150, this.speed);
      const act = this.act;
      const busy = act && (act.kind === 'windup' || act.kind === 'shoot');
      this.up = M.damp(this.up, busy ? 1 : 1 - this.run, busy ? 14 : 7, dt);
      if (act && act.kind === 'windup') {
        this.armMode = 'raise';
        this.armK = M.damp(this.armK, 1, 16, dt);
      } else if (act && act.kind === 'shoot') {
        this.armMode = 'throw';
        this.armK = 1;
        this.thr = M.clamp01(act.t / act.dur);
      } else this.armK = M.damp(this.armK, 0, 7, dt); // volta ao repouso de onde estiver
      // passada de quatro aos saltos: uns 70 cm por ciclo
      this.phase = (this.phase + (this.speed * dt) / (70 * S)) % 1;
      this.label = busy ? 'jogando' : this.run > 0.5 ? 'correndo' : 'parado';
    }

    /** As bolas do corpo nesta pose. */
    parts(cam) {
      const t = this.time;
      const up = M.smoothstep(0, 1, this.up);
      const run = this.run;
      const ph = this.phase * M.TAU;
      const act = this.act;
      const armK = this.armK;
      const throwing = this.armMode === 'throw';
      const wind = throwing ? 0 : armK; // preparo (para o outro braço e a cabeça)
      const thr = this.thr;
      const hurt = this.hurtT < 0.35 ? 1 - this.hurtT / 0.35 : 0;
      const L = (a, b) => M.lerp(a, b, up); // de quatro → sentado
      const bounce = 3.5 * Math.max(0, Math.sin(ph)) * run * (1 - up);
      // para trás no susto e no preparo; para a frente no arremesso
      const lean = -4 * hurt + (throwing ? (act ? 6 * Math.sin(thr * Math.PI) : 0) : -3 * armK);
      const breath = Math.sin(t * 2.4 + this.seed * 6) * 0.6 * (1 - run);
      const at = (a, s, z) => this.at(a * S, s * S, z * S);

      // espinha: quadril → peito
      const hip = at(L(-9, -2) + lean * 0.3, 0, L(19, 12) + bounce - hurt * 2);
      const chest = at(L(7, 1) + lean, 0, L(18, 30) + bounce + breath - hurt * 3);
      const flex = 1 + 0.12 * Math.cos(ph) * run * (1 - up);
      const mid = M.lerp3(hip, chest, 0.5);
      const hipF = M.add(mid, M.scale(M.sub(hip, mid), flex));
      const chestF = M.add(mid, M.scale(M.sub(chest, mid), flex));

      // cabeça: olha em volta quando está sentado e parado
      const look = (M.noise1(t * 0.35 + this.seed * 20) - 0.5) * 1.3 * up * (1 - wind) * (1 - run);
      const hy = this.yaw + look;
      const headC = at(L(17, 3) + lean * 1.2, 0, L(27, 44) + bounce + breath * 1.4 - hurt * 4);
      const rh = 10.5 * S;
      const fwd = { x: Math.cos(hy), y: Math.sin(hy), z: 0 };
      const side = { x: -Math.sin(hy), y: Math.cos(hy), z: 0 };
      const upV = { x: 0, y: 0, z: 1 };
      const onHead = (f, s, u) => M.add(headC, M.add(M.scale(fwd, f * rh), M.add(M.scale(side, s * rh), M.scale(upV, u * rh))));

      const groups = [];
      // corpo: bolas do quadril ao peito (barriga mais clara embaixo fica por conta da sombra)
      const torso = [];
      tube(hipF, chestF, 11 * S, 9.5 * S, COL.fur, torso);
      torso.splice(Math.floor(torso.length / 2), 0, { c: M.lerp3(hipF, chestF, 0.45), r: 11.6 * S, col: COL.fur });
      const decals = this._stripes(hipF, chestF, up);
      if (up > 0.5) {
        const f = this._fwd();
        const bc = M.add(M.lerp3(hipF, chestF, 0.45), M.scale(f, 9.6 * S));
        decals.push({ c: bc, n: f, u: this._side(), v: M.norm(M.sub(chestF, hipF)), ru: 6.2 * S, rv: 8.5 * S, color: COL.belly.base, minFacing: 0.1 });
      }
      groups.push({ balls: torso, ref: M.lerp3(hipF, chestF, 0.5), body: true, decals });

      // rabo de anéis: deitado atrás correndo; sentado, desce até o chão e enrola do lado
      const tail = [];
      const n = 18;
      const sway = Math.sin(t * 1.4 + this.seed * 9);
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        const wave = Math.sin(u * 3 - ph * (run > 0.2 ? 1 : 0) - t * 1.2) * 4 * u;
        const runA = -9 - 40 * u;
        const runZ = 17 + bounce - 7 * u + 7 * u * u * u;
        const sitA = -6 - 15 * u + 6 * Math.max(0, u - 0.7);
        const sitZ = u < 0.32 ? 11 - 25 * u : u < 0.78 ? 3 : 3 + (u - 0.78) * 46;
        const sitS = 20 * u * u + sway * 3 * u;
        const c = at(L(runA, sitA), L(wave, sitS), L(runZ, sitZ));
        const ring = Math.floor(u * 11) % 2 === 0 || u > 0.94 ? COL.ringD : COL.ringL;
        tail.push({ c, r: (4.6 - 2 * u) * S, col: ring });
      }
      groups.push({ balls: tail, ref: tail[Math.floor(n * 0.45)].c, bias: -1 });

      // pernas de trás: coxa grossa, joelho para a frente; sentado, os joelhos ficam erguidos na frente
      for (const sg of [-1, 1]) {
        const pf = ph + Math.PI + (sg > 0 ? 0.35 : 0);
        const footRun = [-12 - 7 * Math.cos(pf) * run, 6.5 * sg, Math.max(0, Math.sin(pf)) * 6 * run];
        const footSit = [10, 7 * sg, 1];
        const hipJ = M.add(hipF, M.scale(this._side(), 6 * S * sg));
        const foot = at(L(footRun[0], footSit[0]), L(footRun[1], footSit[1]), L(footRun[2], footSit[2]));
        const bone = M.lerp(11, 8.5, up) * S;
        const knee = bend(hipJ, foot, bone, bone, M.add(M.scale(this._fwd(), 1), { x: 0, y: 0, z: 0.5 }));
        const leg = [];
        tube(hipJ, knee, 6 * S, 4.4 * S, COL.fur, leg);
        tube(knee, foot, 4.2 * S, 3 * S, COL.fur, leg);
        leg.push({ c: foot, r: 3 * S, col: COL.dark }, { c: M.add(foot, M.scale(this._fwd(), 3.5 * S)), r: 2.6 * S, col: COL.dark });
        groups.push({ balls: leg, ref: knee });
      }

      // braços: de quatro, as mãos no chão; sentado, na frente da barriga; no golpe, o direito ergue a fruta
      let fruitAt = null;
      for (const sg of [-1, 1]) {
        const pf = ph + (sg > 0 ? 0.3 : 0);
        const handRun = [11 - 6 * Math.cos(pf) * run, 5 * sg, Math.max(0, Math.sin(pf)) * 5 * run];
        const fid = Math.sin(t * 3 + sg) * 0.8;
        let handSit = [8 + fid, 4.5 * sg, 20 + breath];
        const thrower = sg > 0;
        if (thrower && armK > 0.001) {
          // preparo: atrás da cabeça; arremesso: passa por cima e termina na frente; depois volta para a barriga
          const back = [-4, 7, 54];
          const over = [3, 6, 60];
          const front = [17, 3, 33];
          let p = back;
          if (throwing) {
            const k = M.easeOut(thr);
            const a = k < 0.5 ? back : over;
            const b = k < 0.5 ? over : front;
            const kk = k < 0.5 ? k * 2 : (k - 0.5) * 2;
            p = [a[0] + (b[0] - a[0]) * kk, a[1] + (b[1] - a[1]) * kk, a[2] + (b[2] - a[2]) * kk];
          }
          handSit = handSit.map((v, i) => v + (p[i] - v) * armK);
        } else if (!thrower && wind > 0) {
          handSit = [handSit[0] + 3 * wind, -6, handSit[2] + 6 * wind]; // o outro braço vai para a frente, de mira
        }
        const sh = M.add(chestF, M.add(M.scale(this._side(), 5.5 * S * sg), { x: 0, y: 0, z: -1.5 * S }));
        const hand = at(L(handRun[0], handSit[0]) + lean * up, L(handRun[1], handSit[1]), L(handRun[2], handSit[2]) - hurt * 2);
        const elbow = bend(sh, hand, 8.5 * S, 8.5 * S, M.add(M.scale(this._fwd(), -1), M.add(M.scale(this._side(), 0.7 * sg), { x: 0, y: 0, z: -0.4 })));
        const arm = [];
        tube(sh, elbow, 3.9 * S, 3.3 * S, COL.fur, arm);
        tube(elbow, hand, 3.3 * S, 2.8 * S, COL.fur, arm);
        arm.push({ c: hand, r: 2.7 * S, col: COL.dark });
        groups.push({ balls: arm, ref: M.lerp3(elbow, hand, 0.6), bias: sg === this._nearSide(cam) ? 1.5 : 0 });
        if (thrower && act && (act.kind === 'windup' || (act.kind === 'shoot' && act.t < 0.07))) fruitAt = hand;
      }

      // tufos brancos dos lados da cabeça (atrás dela) e a cabeça com o rosto
      const twitch = 1 + 0.07 * Math.max(0, Math.sin(t * 7 + this.seed * 30)) * (M.noise1(t * 0.8 + this.seed) > 0.65 ? 1 : 0);
      const tufts = [];
      for (const sg of [-1, 1]) {
        tufts.push({ c: onHead(-0.1, 0.85 * sg, 0.25), r: 0.6 * rh, col: COL.white });
        tufts.push({ c: onHead(-0.18, 1.32 * twitch * sg, 0.42), r: 0.5 * rh, col: COL.white });
        tufts.push({ c: onHead(-0.24, 1.72 * twitch * sg, 0.55), r: 0.36 * rh, col: COL.white });
      }
      groups.push({ balls: tufts, ref: headC, bias: -0.6 });
      groups.push({ balls: [{ c: headC, r: rh, col: COL.fur }], ref: headC, bias: 0.8, body: true, decals: this._face(headC, rh, fwd, side, upV) });
      // focinho curto e escuro (grupo à parte: de costas, fica escondido atrás da cabeça)
      const muzzle = onHead(0.8, 0, -0.1);
      groups.push({ balls: [{ c: muzzle, r: 0.28 * rh, col: COL.dark }], ref: muzzle, bias: 0.8 });

      if (fruitAt) {
        const fz = M.add(fruitAt, { x: 0, y: 0, z: 3 * S });
        groups.push({ balls: [{ c: fz, r: 3.6 * S, col: COL.fruit }], ref: fz, bias: 3, noShadow: true });
      }

      // o encanto: dois pontinhos lilás rodando em volta da cabeça
      const after = (ctx) => {
        const z = cam.zoom;
        for (let k = 0; k < 2; k++) {
          const a = t * 1.7 + k * Math.PI + this.seed * 7;
          const p = cam.p(M.add(headC, { x: Math.cos(a) * 16 * S, y: Math.sin(a) * 16 * S, z: 6 * S + Math.sin(t * 2.3 + k * 2) * 4 * S }));
          const s = (2.2 + Math.sin(t * 5 + k * 3)) * z;
          ctx.save();
          ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * 4 + k * 2.4);
          ctx.fillStyle = MOTE;
          ctx.shadowColor = MOTE;
          ctx.shadowBlur = 5 * z;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - s * 1.6);
          ctx.lineTo(p.x + s * 0.45, p.y - s * 0.45);
          ctx.lineTo(p.x + s * 1.6, p.y);
          ctx.lineTo(p.x + s * 0.45, p.y + s * 0.45);
          ctx.lineTo(p.x, p.y + s * 1.6);
          ctx.lineTo(p.x - s * 0.45, p.y + s * 0.45);
          ctx.lineTo(p.x - s * 1.6, p.y);
          ctx.lineTo(p.x - s * 0.45, p.y - s * 0.45);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      };
      this.top = (headC.z - this.groundZ) + rh + 6 * S;
      return { groups, after };
    }

    _fwd() {
      return { x: Math.cos(this.yaw), y: Math.sin(this.yaw), z: 0 };
    }
    _side() {
      return { x: -Math.sin(this.yaw), y: Math.cos(this.yaw), z: 0 };
    }
    /** Qual lado do corpo (+1 direita, -1 esquerda) está virado para a câmera. */
    _nearSide(cam) {
      const s = this._side();
      return s.x * cam.toCamera.x + s.y * cam.toCamera.y >= 0 ? 1 : -1;
    }

    /** Rosto: máscara escura, a mancha branca da testa e os olhos amarelos acesos. */
    _face(headC, rh, fwd, side, upV) {
      const on = (f, s, u, k = 1) => {
        const n = M.norm(M.add(M.scale(fwd, f), M.add(M.scale(side, s), M.scale(upV, u))));
        return { c: M.add(headC, M.scale(n, rh * k)), n };
      };
      const tangent = (n) => {
        const u = M.norm(M.sub(side, M.scale(n, M.dot(side, n))));
        const v = M.norm(M.cross(u, n));
        return { u, v: v.z < 0 ? M.scale(v, -1) : v };
      };
      const out = [];
      // a câmera olha de cima: o rosto fica alto na cabeça, senão o focinho esconde os olhos
      const mask = on(0.9, 0, 0.14, 0.82);
      out.push({ ...mask, ...tangent(mask.n), ru: 0.62 * rh, rv: 0.6 * rh, color: FACE, minFacing: -0.1 });
      const blaze = on(0.55, 0, 0.84, 0.96);
      out.push({ ...blaze, ...tangent(blaze.n), ru: 0.27 * rh, rv: 0.2 * rh, color: '#f4f1ea' });
      // olhos amarelos acesos (o encanto) com a pupila em fenda e um pontinho de luz
      for (const sg of [-1, 1]) {
        const eye = on(0.86, 0.38 * sg, 0.42, 0.98);
        const tg = tangent(eye.n);
        out.push({ ...eye, ...tg, ru: 0.2 * rh, rv: 0.2 * rh, color: EYE, glow: EYE_GLOW });
        out.push({ ...eye, ...tg, c: M.add(eye.c, M.scale(eye.n, 0.01 * rh)), ru: 0.05 * rh, rv: 0.15 * rh, color: '#1b100d' });
        out.push({ ...eye, ...tg, c: M.add(eye.c, M.add(M.scale(tg.u, -0.07 * rh), M.scale(tg.v, 0.08 * rh))), ru: 0.045 * rh, rv: 0.045 * rh, color: '#fffbe8' });
      }
      return out;
    }

    /** Listras escuras e finas atravessando o lombo (o sagui tem o dorso rajado). */
    _stripes(hip, chest, up) {
      const out = [];
      const d = M.norm(M.sub(chest, hip));
      const s = this._side();
      const f = this._fwd();
      // o lombo olha para cima de quatro e para trás sentado
      const n = M.norm({ x: -f.x * up, y: -f.y * up, z: 1 - up });
      for (let k = 0; k < 3; k++) {
        const c0 = M.lerp3(hip, chest, 0.25 + k * 0.22);
        const c = M.add(c0, M.scale(n, 10.4 * S));
        out.push({ c, n, u: s, v: d, ru: 6.5 * S, rv: 1.1 * S, color: '#5a4e42', minFacing: 0.15 });
      }
      return out;
    }
  }

  C.define('sagui', Sagui);
  PD.Sagui = Sagui;
})(window.PD = window.PD || {});
