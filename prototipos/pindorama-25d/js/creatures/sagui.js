// Sagui Travesso (o sagui-de-tufo-branco encantado da mata do parque): cinza-amarronzado, o lombo com faixas, o rosto
// escuro com a mancha branca na testa, os tufos brancos em leque dos lados da cabeça, olhos amarelos acesos (o encanto)
// e o rabo comprido e peludo de anéis. Parado, senta nas patas de trás e olha em volta; andando, corre de quatro aos
// saltos; no golpe, se estica, ergue a fruta atrás da cabeça com um sorriso travesso ('windup') e arremessa ('shoot').
// Do servidor vêm só a casa, o lado e o golpe.
// Redesenho (23/11, aprovado pelo dono, um bicho por etapa): sem as bolinhas — o corpo é pintado como o Birim (o
// contorno de tinta mais grosso do lado da sombra, a meia-lua de sombra e a faixa de brilho), com a beirada em mechas
// de pelo (PD.creatures.paint). Apanhando, dá um tranco para trás (para longe de quem bateu); caindo, desmaia de
// bruços e o encanto sai do corpo em faíscas roxas. As bolas ficam só para a sombra no chão e a caixa do desenho.
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  const P = C.paint;
  const SH = PD.shapes;
  const { tube } = C;

  /** Tamanho: o sagui de verdade tem uns 20 cm de corpo; no jogo ele é bem maior (sentado, uns 75 cm, quase metade do
   *  herói), para ler no celular com a câmera longe (zoom 0,7), onde o herói tem uns 55 px de altura. No jogo antigo
   *  o monstro tinha o tamanho do personagem. */
  const S = 1.6;
  // as cores: a cor de cada parte e a sombra e o brilho transparentes por cima (escurecem e clareiam os detalhes juntos)
  const SHADE = 'rgba(48, 30, 42, 0.42)';
  const LIGHT = 'rgba(255, 243, 222, 0.32)';
  const LOOK = {
    fur: { base: '#8e7f6e', shade: SHADE, light: LIGHT },
    limb: { base: '#83735f', shade: SHADE, light: LIGHT },
    head: { base: '#7f6d5b', shade: SHADE, light: LIGHT },
    tuft: { base: '#f7f3ea', shade: 'rgba(92, 80, 112, 0.32)', light: 'rgba(255, 255, 255, 0.7)' },
    tail: { base: '#b9ab96', shade: SHADE, light: LIGHT },
    hand: { base: '#3a2f29', shade: 'rgba(16, 10, 14, 0.45)', light: 'rgba(255, 238, 214, 0.25)' },
    fruit: { base: '#c6e061', shade: 'rgba(46, 72, 8, 0.45)', light: 'rgba(250, 255, 214, 0.75)' },
  };
  const BAND = '#4c4137'; // as faixas do lombo
  const RING = '#3b3129'; // os anéis escuros do rabo
  const BELLY = '#bfa682';
  const FACE = '#2a211c';
  const MUZZLE = '#3b2f28';
  const BLAZE = '#f7f4ec';
  const LID = '#c9b49b'; // olho fechado: o risco claro na cara escura
  const EYE = '#ffd45c';
  const EYE_GLOW = 'rgba(255, 204, 84, 0.5)';
  const MOTE = '#cfb3ff';
  const SPARK = '#b58cff';

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

  /**
   * A forma lisa da sombra e do brilho: o casco dos mesmos círculos de tela com o raio `px` maior. A folga cobre as
   * mechas inteiras (o comprimento e o quanto deitam, ~1,5 × o comprimento): ponta de mecha para fora dela, do lado da
   * luz, saía escura. (Engordar o casco pronto quebrava nas pontas finas dos tufos.)
   */
  function padHull(disks, px) {
    return SH.circleHull(disks.map((d) => ({ x: d.x, y: d.y, r: d.r + px })), 0.35);
  }

  /**
   * Pequeno na tela (o zoom do celular, 0,7): menos mechas, e braços, pernas e tufos sem a sombra pintada — nesse
   * tamanho não aparece, e o desenho fica bem mais leve.
   */
  const small = (z) => z < 0.85;

  /** Estrelinha de 4 pontas (o encanto), em px de tela. */
  function star(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.6);
    ctx.lineTo(x + s * 0.45, y - s * 0.45);
    ctx.lineTo(x + s * 1.6, y);
    ctx.lineTo(x + s * 0.45, y + s * 0.45);
    ctx.lineTo(x, y + s * 1.6);
    ctx.lineTo(x - s * 0.45, y + s * 0.45);
    ctx.lineTo(x - s * 1.6, y);
    ctx.lineTo(x - s * 0.45, y - s * 0.45);
    ctx.closePath();
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
      this.top = 66 * S;
      this.acts = { windup: { dur: 0.3, hold: 0.9 }, shoot: { dur: 0.3, hold: 0.22 } };
      /** Caiu: desmaia de bruços (pose própria, sem tombar de lado). */
      this.ownDeath = true;
      /** Para onde vai o tranco do golpe levado (no chão, unitário): para longe do herói, ou para trás. */
      this.recoilDir = { x: -Math.cos(yaw), y: -Math.sin(yaw) };
    }

    action(kind, yaw) {
      if (kind === 'hurt' && this.dying === null) {
        // o golpe quase sempre vem do herói (o servidor não diz de onde): o tranco vai para longe dele
        let dx = -Math.cos(this.yaw), dy = -Math.sin(this.yaw);
        const h = this.near && this.near.hero;
        if (h) {
          const ax = this.pos.x - h.x, ay = this.pos.y - h.y;
          const d = Math.hypot(ax, ay);
          if (d > 1 && d < 2500) {
            dx = ax / d;
            dy = ay / d;
          }
        }
        this.recoilDir = { x: dx, y: dy };
      }
      super.action(kind, yaw);
    }

    /** O clarão do golpe, fraquinho: quem mostra que apanhou é o tranco. */
    flash() {
      return this.hurtT < 0.14 ? 0.3 * (1 - this.hurtT / 0.14) : 0;
    }

    /** O tranco do golpe levado (0..1): vai rápido (0,06 s) e volta devagar (até 0,42 s). */
    recoil() {
      const h = this.hurtT;
      if (h < 0.06) return M.easeOut(h / 0.06);
      if (h < 0.42) return 1 - M.easeInOut((h - 0.06) / 0.36);
      return 0;
    }

    animate(dt) {
      if (this.dying !== null) {
        this.run = 0;
        this.up = M.damp(this.up, 0, 12, dt);
        this.armK = M.damp(this.armK, 0, 12, dt);
        this.label = 'caído';
        return;
      }
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

    /** A pose (pontos 3D) e as partes pintadas, cada uma com a bola da sombra e o seu desenho. */
    parts(cam) {
      const t = this.time;
      const up = M.smoothstep(0, 1, this.up);
      const run = this.run;
      const ph = this.phase * M.TAU;
      const act = this.act;
      const armK = this.armK;
      const throwing = this.armMode === 'throw';
      const wind = throwing ? 0 : armK; // preparo (para o outro braço, a cabeça e o rabo)
      // segurando o preparo (0..1): o corpo vai mais para trás, a fruta brilha e treme no fim
      const hold = act && act.kind === 'windup' && act.hold > 0 ? M.clamp01((act.t - act.dur) / act.hold) : 0;
      const thr = this.thr;
      const rec = this.recoil();
      const hop = this.hurtT < 0.3 ? Math.sin((this.hurtT / 0.3) * Math.PI) : 0;
      const dying = this.dying;
      // desmaio: despenca de bruços em 0,26 s, quica de leve no chão, braços para a frente e o rabo largado
      const slump = dying === null ? 0 : M.easeIn(M.clamp01(dying / 0.26));
      const land = dying === null ? 0 : Math.max(0, Math.sin(M.clamp01((dying - 0.26) / 0.16) * Math.PI)) * 2.5;
      const D = (v, lying) => M.lerp(v, lying, slump);
      const L = (a, b) => M.lerp(a, b, up); // de quatro → sentado
      const bounce = 5 * Math.max(0, Math.sin(ph)) * run * (1 - up);
      // o tranco empurra para o lado do `recoilDir`: de frente para quem bateu, o corpo verga para trás; batido por
      // trás, para a frente
      const rd = this.recoilDir;
      const push = rd.x * Math.cos(this.yaw) + rd.y * Math.sin(this.yaw);
      // para trás no preparo; para a frente no arremesso
      const lean = 9 * rec * push + (throwing ? (act ? 9 * Math.sin(thr * Math.PI) : 0) : -6 * wind - 3 * hold);
      const rise = 5 * wind + 2 * hold; // no preparo, estica o corpo para cima
      const shake = hold > 0.72 ? Math.sin(t * 70) * 0.8 * (hold - 0.72) / 0.28 : 0; // a tremidinha antes de jogar
      const breath = Math.sin(t * 2.4 + this.seed * 6) * 0.6 * (1 - run);
      const offX = rd.x * 10 * S * rec, offY = rd.y * 10 * S * rec, offZ = 3 * S * hop;
      const at = (a, s, z) => {
        const p = this.at(a * S, (s + shake) * S, z * S);
        return { x: p.x + offX, y: p.y + offY, z: p.z + offZ };
      };
      const z = cam.zoom;
      const ink = Math.max(1, 1.1 * z);
      const toCamH = M.norm({ x: cam.toCamera.x, y: cam.toCamera.y, z: 0 });
      const near = (p) => p.x * toCamH.x + p.y * toCamH.y;
      const fwd = this._fwd();
      const side = this._side();

      // espinha: quadril → peito
      const hip = at(L(-9, -2) + lean * 0.3, 0, D(L(19, 12) + bounce - rec * 1.5, 8.5 + land));
      const chest = at(L(7, 1) + lean, 0, D(L(18, 30) + rise + bounce + breath - rec * 2.5, 8.5 + land));
      const flex = 1 + 0.16 * Math.cos(ph) * run * (1 - up);
      const mid = M.lerp3(hip, chest, 0.5);
      const hipF = M.add(mid, M.scale(M.sub(hip, mid), flex));
      const chestF = M.add(mid, M.scale(M.sub(chest, mid), flex));

      // cabeça: olha em volta quando está sentado e parado; no tranco e no preparo, um pouco para cima
      const look = (M.noise1(t * 0.35 + this.seed * 20) - 0.5) * 1.3 * up * (1 - wind) * (1 - run) * (1 - rec);
      const hy = this.yaw + look;
      const headC = at(D(L(17, 3) + lean * 1.25, 19), 0, D(L(27, 45) + rise * 1.25 + bounce + breath * 1.4 - rec * 3, 10 + land));
      const rh = 11.6 * S;
      const flat = { x: Math.cos(hy), y: Math.sin(hy), z: 0 };
      const hf = M.norm(M.add(flat, { x: 0, y: 0, z: 0.3 * rec + 0.14 * wind - 0.45 * slump }));
      const hs = { x: -flat.y, y: flat.x, z: 0 };
      const hu = M.norm(M.cross(hf, hs));
      const head = { c: headC, f: hf, s: hs, u: hu, r: rh };
      const H = (f, s, u) => M.add(headC, M.add(M.scale(hf, f * rh), M.add(M.scale(hs, s * rh), M.scale(hu, u * rh))));

      const groups = [];
      const self = this;

      // ---- o corpo: o casco das bolas do tronco com a beirada de pelo, a barriga e as faixas do lombo
      const torso = [];
      tube(hipF, chestF, 11 * S, 9.6 * S, null, torso);
      torso.push({ c: M.lerp3(hipF, chestF, 0.45), r: 11.6 * S });
      torso.push({ c: M.lerp3(chestF, headC, 0.32), r: 7.4 * S });
      groups.push({
        balls: torso,
        ref: M.lerp3(hipF, chestF, 0.5),
        body: true,
        paint(ctx, flash) {
          const disks = torso.map((b) => {
            const q = cam.p(b.c);
            return { x: q.x, y: q.y, r: b.r * z };
          });
          const hull = SH.circleHull(disks, 0.5);
          // o pelo penteado do peito para o quadril
          const fl = cam.pDir(M.sub(hipF, chestF));
          const fk = Math.hypot(fl.x, fl.y) || 1;
          const fur = P.furOutline(hull, small(z) ? 20 : 30, 4.2 * z, self.seed * 7, 0.5, { x: fl.x / fk, y: fl.y / fk });
          if (!fur) return;
          const smooth = padHull(disks, 6.8 * z);
          P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.fur, 5.5 * z, ink, flash, {
            inside: (c) => self._bodyMarks(c, cam, hipF, chestF, up, flash),
            light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
            lightPad: 6.8 * z,
          });
        },
      });

      // ---- o rabo de anéis: deitado atrás correndo; sentado, desce até o chão e enrola do lado; no preparo, sobe
      // em S atrás do corpo; no tranco, arrepia
      const tail = [];
      const n = 18;
      const sway = Math.sin(t * 1.4 + this.seed * 9);
      const puff = 1 + 0.22 * rec + 0.12 * wind;
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        const wave = Math.sin(u * 3 - ph * (run > 0.2 ? 1 : 0) - t * 1.2) * 5 * u;
        const runA = -9 - 42 * u;
        const runZ = D(17 + bounce - 6 * u + 9 * u * u * u, 3.2);
        const sitA = -6 - 15 * u + 6 * Math.max(0, u - 0.7);
        const sitZ = u < 0.32 ? 11 - 25 * u : u < 0.78 ? 3 : 3 + (u - 0.78) * 46;
        const sitS = 20 * u * u + sway * 3 * u;
        // em pé no preparo: sobe atrás do corpo e a ponta enrola
        const upA = -10 - 12 * u + 10 * u * u;
        const upZ = 12 + 46 * u - 10 * u * u;
        const upS = 8 * Math.sin(u * 3.4) + 3 * Math.sin(t * 9) * u * hold;
        const raise = M.smoothstep(0, 1, wind) * 0.85 * (1 - slump);
        let a = L(runA, sitA), s = L(wave, sitS), zz = L(runZ, sitZ);
        a = M.lerp(a, upA, raise);
        s = M.lerp(s, upS, raise);
        zz = M.lerp(zz, upZ, raise);
        tail.push({ c: at(a, s, Math.max(2.6, zz)), r: (4.5 - 1.5 * u - (u > 0.9 ? (u - 0.9) * 14 : 0)) * S * puff });
      }
      groups.push({
        balls: tail,
        ref: tail[Math.floor(n * 0.45)].c,
        bias: -1,
        paint(ctx, flash) {
          self._paintTail(ctx, cam, tail, ink, flash);
        },
      });

      // ---- pernas de trás: coxa grossa, joelho para a frente; sentado, os joelhos ficam erguidos na frente
      for (const sg of [-1, 1]) {
        const pf = ph + Math.PI + (sg > 0 ? 0.35 : 0);
        const footRun = [D(-12 - 8 * Math.cos(pf) * run, -18), D(6.5, 9) * sg, D(Math.max(0, Math.sin(pf)) * 7 * run, 1)];
        const footSit = [10 - 2 * rec, 7 * sg, 1 + 2 * rec];
        const hipJ = M.add(hipF, M.scale(side, 6 * S * sg));
        const foot = at(L(footRun[0], footSit[0]), L(footRun[1], footSit[1]), L(footRun[2], footSit[2]));
        const bone = M.lerp(11, 8.5, up) * S;
        const knee = bend(hipJ, foot, bone, bone, M.add(fwd, { x: 0, y: 0, z: 0.5 }));
        const toe = M.add(foot, M.add(M.scale(fwd, 3.6 * S), { x: 0, y: 0, z: -0.6 * S }));
        const pts = [hipJ, M.lerp3(hipJ, knee, 0.5), knee, M.lerp3(knee, foot, 0.55), foot];
        const rads = [5.6, 5.4, 3.6, 2.6, 2.2].map((r) => r * S);
        groups.push({
          balls: [{ c: knee, r: 4.4 * S }, { c: foot, r: 3 * S }, { c: toe, r: 2.6 * S }],
          ref: knee,
          paint(ctx, flash) {
            self._paintLimb(ctx, cam, pts, rads, [foot, toe], 2.5 * S, ink, flash);
          },
        });
      }

      // ---- braços: de quatro, as mãos no chão; sentado, na frente da barriga; no golpe, o direito ergue a fruta
      let fruitAt = null;
      for (const sg of [-1, 1]) {
        const pf = ph + (sg > 0 ? 0.3 : 0);
        const handRun = [D(11 - 7 * Math.cos(pf) * run, 20), D(5, 9) * sg, D(Math.max(0, Math.sin(pf)) * 6 * run, 1.5)];
        const fid = Math.sin(t * 3 + sg) * 0.8;
        let handSit = [8 + fid, 4.5 * sg, 20 + breath];
        const thrower = sg > 0;
        if (thrower && armK > 0.001) {
          // preparo: bem alto, por cima do ombro, do lado da cabeça (de frente, a fruta aparece: é o aviso); arremesso:
          // passa por cima e termina na frente; depois volta para a barriga
          const back = [-6, 15, 62];
          const over = [4, 8, 66];
          const front = [21, 3, 32];
          let p = back;
          if (throwing) {
            const k = M.easeOut(thr);
            const a = k < 0.5 ? back : over;
            const b = k < 0.5 ? over : front;
            const kk = k < 0.5 ? k * 2 : (k - 0.5) * 2;
            p = [a[0] + (b[0] - a[0]) * kk, a[1] + (b[1] - a[1]) * kk, a[2] + (b[2] - a[2]) * kk];
          } else p = [back[0] - 2 * hold, back[1], back[2] + 2 * hold];
          handSit = handSit.map((v, i) => v + (p[i] - v) * armK);
        } else if (!thrower && wind > 0) {
          // o outro braço aponta para a frente, de mira
          handSit = [handSit[0] + 11 * wind, -5 - 1 * wind, handSit[2] + 13 * wind];
        }
        if (rec > 0) handSit = [handSit[0] - 3 * rec, handSit[1] + 2 * sg * rec, handSit[2] + 9 * rec]; // as mãos sobem no susto
        const sh = M.add(chestF, M.add(M.scale(side, 5.5 * S * sg), { x: 0, y: 0, z: -1.5 * S }));
        const hand = at(L(handRun[0], handSit[0]) + lean * up, L(handRun[1], handSit[1]), L(handRun[2], handSit[2]) - rec * 0.5);
        const elbow = bend(sh, hand, 8.6 * S, 8.6 * S, M.add(M.scale(fwd, -1), M.add(M.scale(side, 0.7 * sg), { x: 0, y: 0, z: -0.4 })));
        const pts = [sh, M.lerp3(sh, elbow, 0.5), elbow, M.lerp3(elbow, hand, 0.5), hand];
        const rads = [3.4, 3.0, 2.5, 2.2, 2.0].map((r) => r * S);
        groups.push({
          balls: [{ c: elbow, r: 3.3 * S }, { c: hand, r: 2.7 * S }],
          ref: M.lerp3(elbow, hand, 0.6),
          bias: sg === this._nearSide(cam) ? 1.5 : 0,
          paint(ctx, flash) {
            self._paintLimb(ctx, cam, pts, rads, [hand], 2.3 * S, ink, flash);
          },
        });
        if (thrower && act && (act.kind === 'windup' || (act.kind === 'shoot' && act.t < 0.07))) fruitAt = hand;
      }

      // ---- a cabeça (com o rosto) e os tufos brancos dos lados: o de lá atrás dela; o de cá, de perfil, na frente
      const twitch = 1 + 0.08 * Math.max(0, Math.sin(t * 7 + this.seed * 30)) * (M.noise1(t * 0.8 + this.seed) > 0.65 ? 1 : 0);
      for (const sg of [-1, 1]) {
        const facing = M.dot(M.scale(hs, sg), toCamH);
        const front = facing > 0.3;
        groups.push({
          balls: [{ c: H(-0.25, 1.15 * sg, 0.45), r: 0.55 * rh }],
          ref: headC,
          bias: front ? 1.0 : 0.6,
          paint(ctx, flash) {
            self._paintTuft(ctx, cam, head, sg, twitch, rec, wind, slump, ink, flash);
          },
        });
      }
      const headBalls = [{ c: headC, r: rh }, { c: H(0.6, 0, -0.34), r: 0.42 * rh }];
      groups.push({
        balls: headBalls,
        ref: headC,
        bias: 0.8,
        body: true,
        paint(ctx, flash) {
          self._paintHead(ctx, cam, head, H, { wind, hold, rec, slump, throwing, thr }, ink, flash);
        },
      });

      // ---- a fruta verde (a mesma cor da fruta que voa), brilhando cada vez mais enquanto ele segura
      if (fruitAt) {
        const fz = M.add(fruitAt, { x: 0, y: 0, z: 3.2 * S });
        groups.push({
          balls: [{ c: fz, r: 3.8 * S }],
          ref: fz,
          bias: 3,
          noShadow: true,
          paint(ctx, flash) {
            self._paintFruit(ctx, cam, fz, hold, ink, flash);
          },
        });
      }

      // ---- o encanto: dois pontinhos lilás rodando em volta da cabeça; desmaiado, ele sai do corpo em faíscas roxas
      const heart = M.lerp3(chestF, headC, 0.55);
      const after = (ctx) => {
        if (dying === null) this._motes(ctx, cam, headC);
        else this._release(ctx, cam, heart, dying);
      };
      this.top = headC.z - this.groundZ + rh + 8 * S;
      const paint = (ctx, flash) => {
        ctx.save();
        for (const g of C.byDepth(cam, groups)) if (g.paint) g.paint(ctx, flash);
        ctx.restore();
      };
      return { groups, after, paint };
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

    /** No corpo: a barriga cor de palha (sentado, de frente) e as faixas escuras atravessando o lombo. */
    _bodyMarks(ctx, cam, hip, chest, up, flash) {
      const f = this._fwd();
      const s = this._side();
      const d = M.norm(M.sub(chest, hip));
      if (up > 0.35) {
        const bc = M.add(M.lerp3(hip, chest, 0.42), M.scale(f, 9.8 * S));
        P.decal(ctx, cam, { c: bc, n: f, u: s, v: d, ru: 7.2 * S, rv: 10.5 * S, color: BELLY, minFacing: -0.05 }, flash);
      }
      // o lombo olha para cima de quatro e para trás sentado
      const n = M.norm({ x: -f.x * up, y: -f.y * up, z: 1 - up });
      for (let k = 0; k < 5; k++) {
        const c0 = M.lerp3(hip, chest, 0.08 + k * 0.15);
        const c = M.add(c0, M.scale(n, 10.6 * S));
        P.decal(ctx, cam, { c, n, u: s, v: d, ru: 8.6 * S, rv: (1.7 - k * 0.15) * S, color: BAND, minFacing: 0.1 }, flash);
      }
    }

    /**
     * Um braço ou perna: o membro peludo que afina, da cor do corpo (sem risco na emenda com ele), e a mão ou o pé
     * escuro na ponta (`ends`: o pé vai do calcanhar aos dedos; a mão é uma bolinha).
     */
    _paintLimb(ctx, cam, pts3, rads3, ends, endR, ink, flash) {
      const z = cam.zoom;
      const pts = pts3.map((p) => cam.p(p));
      const shape = P.limbShape(pts, rads3.map((r) => r * z));
      // o número de mechas vem do comprimento de verdade (fixo), não do que aparece na tela
      let len3 = 0;
      for (let i = 1; i < pts3.length; i++) len3 += M.dist(pts3[i - 1], pts3[i]);
      const count = Math.max(4, Math.round((len3 * 2.2) / (6 * S)));
      const a = pts[0], b = pts[pts.length - 1];
      const fl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const fur = P.furOutline(shape.poly, count, 2.8 * z, this.seed * 9 + count, 0.5, { x: (b.x - a.x) / fl, y: (b.y - a.y) / fl }, 0.3, true);
      if (fur) {
        // (peça fina: só a sombra, sem o brilho e sem o risco dobrado — o desenho fica bem mais leve)
        const smooth = P.limbShape(pts, rads3.map((r) => r * z + 4.7 * z)).poly;
        P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.limb, small(z) ? 0 : rads3[1] * z * 0.6, ink, flash, {
          stroke: (dx, dy, p) => P.furTrace(fur, dx, dy, p, false),
          heavy: false,
          highlight: 0,
          light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
          lightPad: 4.7 * z,
        });
      }
      // a mão ou o pé: escuro
      const qs = ends.map((c) => cam.p(c));
      const r = endR * z;
      const trace = (dx, dy, p) => {
        if (qs.length > 1) {
          // o pé: um oval do calcanhar aos dedos
          const [h, t] = qs;
          const cx = (h.x + t.x) / 2 + dx, cy = (h.y + t.y) / 2 + dy;
          const ang = Math.atan2(t.y - h.y, t.x - h.x);
          const rx = Math.hypot(t.x - h.x, t.y - h.y) / 2 + r * 0.9;
          p.moveTo(cx + Math.cos(ang) * rx, cy + Math.sin(ang) * rx);
          p.ellipse(cx, cy, rx, r * 0.8, ang, 0, M.TAU);
          return p;
        }
        p.moveTo(qs[0].x + r + dx, qs[0].y + dy);
        p.arc(qs[0].x + dx, qs[0].y + dy, r, 0, M.TAU);
        return p;
      };
      P.paintLit(ctx, cam, trace, LOOK.hand, 0, ink, flash, { heavy: false });
    }

    /** O rabo: comprido, peludo, de anéis claros e escuros, afinando numa ponta de pincel. */
    _paintTail(ctx, cam, tail, ink, flash) {
      const z = cam.zoom;
      const shape = P.limbShape(tail.map((b) => cam.p(b.c)), tail.map((b) => b.r * z));
      // penteado da base para a ponta
      const e0 = shape.pts[0], e1 = shape.pts[shape.pts.length - 1];
      const fl = Math.hypot(e1.x - e0.x, e1.y - e0.y) || 1;
      const fur = P.furOutline(shape.poly, small(z) ? 22 : 32, 3.4 * z, this.seed * 3 + 1, 0.55, { x: (e1.x - e0.x) / fl, y: (e1.y - e0.y) / fl }, 0.45);
      if (!fur) return;
      const smooth = P.limbShape(shape.pts, shape.rads.map((r) => r + 5.8 * z)).poly;
      const pts = shape.pts;
      // o comprimento ao longo do rabo, para os anéis
      const acc = [0];
      for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      const total = acc[acc.length - 1] || 1;
      const RINGS = 13;
      const rings = (c) => {
        // cada anel escuro é um risco grosso atravessando o rabo, da largura do anel
        c.strokeStyle = C.tint(RING, flash);
        c.lineCap = 'butt';
        c.lineWidth = total / RINGS + 0.6;
        c.beginPath();
        for (let k = 1; k < RINGS; k += 2) {
          const s = ((k + 0.5) / RINGS) * total;
          let i = 1;
          while (i < pts.length - 1 && acc[i] < s) i++;
          const a = pts[i - 1], b = pts[i];
          const f = (s - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
          const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
          const dl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const nx = -(b.y - a.y) / dl, ny = (b.x - a.x) / dl;
          const w = (shape.rads[i] + 4 * z) * 1.4;
          c.moveTo(x - nx * w, y - ny * w);
          c.lineTo(x + nx * w, y + ny * w);
        }
        c.stroke();
        // a ponta escura
        const e = pts[pts.length - 1];
        c.fillStyle = C.tint(RING, flash);
        c.beginPath();
        c.arc(e.x, e.y, shape.rads[shape.rads.length - 1] + 3 * z, 0, M.TAU);
        c.fill();
      };
      P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.tail, tail[3].r * z * 0.5, ink, flash, {
        inside: rings,
        light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
        lightPad: 5.8 * z,
      });
    }

    /**
     * Um tufo branco em leque, saindo de perto da orelha para fora, para cima e para trás: as mechas pontudas num
     * contorno só (a cor cobre os riscos de dentro) e uns fios cinza no meio de cada uma.
     */
    _paintTuft(ctx, cam, head, sg, twitch, rec, wind, slump, ink, flash) {
      const { f, u, r } = head;
      const z = cam.zoom;
      const out = M.scale(head.s, sg);
      const back = M.scale(f, -1);
      // a orelha: do lado da cabeça, um pouco para trás e para cima
      const B = M.add(head.c, M.add(M.scale(f, -0.3 * r), M.add(M.scale(out, 0.74 * r), M.scale(u, 0.22 * r))));
      const puff = (1 + 0.25 * rec + 0.12 * wind - 0.15 * slump) * twitch;
      // os fios saem em cone em volta do "para fora", deitados para trás (desmaiado, caem); para a frente (o rosto), não
      const axis = M.norm(M.add(M.add(out, M.scale(back, 0.75)), M.scale(u, 0.22 - 0.7 * slump)));
      const e1 = M.norm(M.sub(u, M.scale(axis, M.dot(u, axis))));
      const e2 = M.norm(M.sub(back, M.add(M.scale(axis, M.dot(back, axis)), M.scale(e1, M.dot(back, e1)))));
      const circles = [{ c: B, r: 0.32 * r }];
      const N = 10;
      for (let i = 0; i < N; i++) {
        const phi = M.lerp(-0.9, 4.0, i / (N - 1)); // 0 = para cima, pi/2 = para trás, pi = para baixo
        const ring = M.add(M.scale(e1, Math.cos(phi)), M.scale(e2, Math.sin(phi)));
        const dir = M.norm(M.add(M.scale(axis, 0.62), M.scale(ring, 0.78)));
        const len = (0.5 + 0.24 * Math.max(0, Math.cos(phi - 0.9))) * r * puff; // mais compridos para cima e para trás
        circles.push({ c: M.add(B, M.scale(dir, len)), r: 0.08 * r });
      }
      circles.push({ c: M.add(B, M.scale(axis, 0.7 * r * puff)), r: 0.12 * r });
      const disks = circles.map((cc) => {
        const q = cam.p(cc.c);
        return { x: q.x, y: q.y, r: cc.r * z };
      });
      const hull = SH.circleHull(disks, 0.6);
      const b = cam.p(B);
      const flowP = cam.pDir(axis);
      const fl = Math.hypot(flowP.x, flowP.y) || 1;
      // a beirada: mechas compridas, a maioria pontuda, penteadas para fora e para trás (o tufo arrepiado)
      const fur = P.furOutline(hull, 11, 0.3 * r * z * puff, this.seed * 11 + sg, 0.55, { x: flowP.x / fl, y: flowP.y / fl }, 0.6);
      if (!fur) return;
      const pad = 0.47 * r * z * puff + 0.5 * z;
      const smooth = padHull(disks, pad);
      const tips = fur.T.filter((t) => t.sharp);
      const trace = (dx, dy, p) => P.furTrace(fur, dx, dy, p);
      P.paintLit(ctx, cam, trace, LOOK.tuft, small(z) ? 0 : 0.2 * r * z, ink, flash, {
        heavy: false,
        light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
        lightPad: pad,
        inside: (c) => {
          // os fios: do miolo para a ponta de cada mecha, cinza clarinho (só de perto)
          if (z < 1.2) return;
          c.strokeStyle = 'rgba(150, 140, 156, 0.55)';
          c.lineWidth = Math.max(0.6, 0.5 * z);
          c.lineCap = 'round';
          c.beginPath();
          for (const q of tips) {
            c.moveTo(b.x + (q.x - b.x) * 0.35, b.y + (q.y - b.y) * 0.35);
            c.quadraticCurveTo(b.x + (q.x - b.x) * 0.6 + (q.y - b.y) * 0.06, b.y + (q.y - b.y) * 0.6 - (q.x - b.x) * 0.06, b.x + (q.x - b.x) * 0.84, b.y + (q.y - b.y) * 0.84);
          }
          c.stroke();
        },
      });
    }

    /** A cabeça: o crânio, as bochechas e o focinho curto num contorno só, de pelo curto, e o rosto. */
    _paintHead(ctx, cam, head, H, st, ink, flash) {
      const z = cam.zoom;
      const r = head.r;
      const circles = [[head.c, 1], [H(0.16, -0.52, -0.3), 0.62], [H(0.16, 0.52, -0.3), 0.62], [H(0.6, 0, -0.34), 0.42]].map(([c, k]) => {
        const q = cam.p(c);
        return { x: q.x, y: q.y, r: k * r * z };
      });
      const hull = SH.circleHull(circles, 0.5);
      // o pelo da cabeça, curto, penteado do rosto para a nuca
      const fl = cam.pDir(M.scale(head.f, -1));
      const fk = Math.hypot(fl.x, fl.y);
      const fur = P.furOutline(hull, small(z) ? 16 : 22, 2.8 * z, this.seed * 5 + 2, 0.45, fk > 0.05 ? { x: fl.x / fk, y: fl.y / fk } : null, 0.3);
      if (!fur) return;
      const smooth = padHull(circles, 4.6 * z);
      const showFace = M.dot(head.f, cam.toCamera) > -0.35;
      P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.head, 0.3 * r * z, ink, flash, {
        light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
        lightPad: 4.6 * z,
        inside: (c) => {
          if (showFace) this._faceSkin(c, cam, head, st, flash);
        },
        after: (c) => {
          if (showFace) this._faceEyes(c, cam, head, st, flash);
        },
      });
    }

    /**
     * O rosto, por baixo da luz e da sombra: a máscara escura (em volta dos olhos e o focinho), a mancha branca da testa
     * e a boca (travessa: o sorriso de canto; no preparo, o sorrisão com os dentinhos).
     */
    _faceSkin(ctx, cam, head, st, flash) {
      const r = head.r;
      const on = (f, s, u, mirror, draw, minF) => P.onSurface(ctx, cam, head, f, s, u, mirror, draw, minF);
      const dark = C.tint(FACE, flash);
      // a máscara: um oval em volta de cada olho e a ponte entre eles
      for (const sg of [-1, 1]) {
        on(0.8, 0.36 * sg, 0.12, sg, () => {
          ctx.fillStyle = dark;
          ctx.beginPath();
          ctx.ellipse(0.02 * r, -0.02 * r, 0.4 * r, 0.36 * r, 0, 0, M.TAU);
          ctx.fill();
        }, -0.15);
      }
      on(0.9, 0, 0.02, 1, () => {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.3 * r, 0.34 * r, 0, 0, M.TAU);
        ctx.fill();
      }, -0.15);
      // o focinho (um tom acima, para a boca e o nariz lerem)
      on(0.88, 0, -0.36, 1, () => {
        ctx.fillStyle = C.tint(MUZZLE, flash);
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.36 * r, 0.27 * r, 0, 0, M.TAU);
        ctx.fill();
      }, -0.15);
      // a mancha branca da testa (o "brasão" do sagui-de-tufo-branco), logo acima dos olhos
      on(0.7, 0, 0.62, 1, () => {
        ctx.fillStyle = C.tint(BLAZE, flash);
        ctx.beginPath();
        ctx.moveTo(-0.2 * r, 0.12 * r);
        ctx.quadraticCurveTo(0, 0.22 * r, 0.2 * r, 0.12 * r);
        ctx.quadraticCurveTo(0.1 * r, -0.1 * r, 0, -0.2 * r);
        ctx.quadraticCurveTo(-0.1 * r, -0.1 * r, -0.2 * r, 0.12 * r);
        ctx.fill();
      }, -0.1);
      // a boca
      const z = cam.zoom;
      const thin = (px) => px / z;
      on(0.93, 0, -0.44, 1, () => {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (this.dying !== null) {
          // desmaiado: a boquinha mole, ondulada
          ctx.strokeStyle = LID;
          ctx.lineWidth = Math.max(thin(0.9), 0.04 * r);
          ctx.beginPath();
          ctx.moveTo(-0.14 * r, 0);
          ctx.quadraticCurveTo(-0.07 * r, 0.05 * r, 0, 0);
          ctx.quadraticCurveTo(0.07 * r, -0.05 * r, 0.14 * r, 0);
          ctx.stroke();
          return;
        }
        if (st.rec > 0.25) {
          // o "ui!": a boquinha redonda
          ctx.fillStyle = '#120a08';
          ctx.beginPath();
          ctx.ellipse(0, -0.02 * r, 0.08 * r, 0.1 * r, 0, 0, M.TAU);
          ctx.fill();
          return;
        }
        const grin = M.clamp01(st.wind * 1.2 + (st.throwing ? 1 - st.thr : 0));
        if (grin > 0.15) {
          // o sorrisão travesso, com os dentinhos
          const w = 0.2 * r + 0.06 * r * grin;
          ctx.fillStyle = '#4a1612';
          ctx.beginPath();
          ctx.moveTo(-w, 0.06 * r);
          ctx.quadraticCurveTo(0, 0.02 * r, w, 0.08 * r);
          ctx.quadraticCurveTo(0.02 * r, -0.2 * r * grin, -w, 0.06 * r);
          ctx.fill();
          ctx.fillStyle = '#fbf6ea';
          ctx.beginPath();
          ctx.moveTo(-w * 0.8, 0.055 * r);
          ctx.quadraticCurveTo(0, 0.025 * r, w * 0.8, 0.075 * r);
          ctx.lineTo(w * 0.7, 0.02 * r);
          ctx.quadraticCurveTo(0, -0.01 * r, -w * 0.7, 0.01 * r);
          ctx.closePath();
          ctx.fill();
          return;
        }
        // o sorriso de canto (travesso), um risco claro na cara escura
        ctx.strokeStyle = 'rgba(212, 186, 160, 0.85)';
        ctx.lineWidth = Math.max(thin(0.8), 0.035 * r);
        ctx.beginPath();
        ctx.moveTo(-0.15 * r, 0.01 * r);
        ctx.quadraticCurveTo(0.02 * r, -0.06 * r, 0.16 * r, 0.06 * r);
        ctx.stroke();
      }, -0.1);
      // o nariz: duas narinas claras (só de perto)
      if (z >= 1.15) {
        on(0.97, 0, -0.2, 1, () => {
          ctx.fillStyle = 'rgba(150, 120, 104, 0.9)';
          for (const x of [-0.06, 0.06]) {
            ctx.beginPath();
            ctx.ellipse(x * r, 0, 0.03 * r, 0.022 * r, 0, 0, M.TAU);
            ctx.fill();
          }
        }, 0);
      }
    }

    /**
     * Os olhos, por cima da luz: amarelos acesos (o encanto; de noite, vermelhos), redondos e grandes, com a pupila em
     * fenda e o pontinho de luz. No preparo, meio fechados e com a sobrancelha de quem apronta; no tranco, apertados
     * (">" "<"); desmaiado, fechados.
     */
    _faceEyes(ctx, cam, head, st, flash) {
      const r = head.r;
      const z = cam.zoom;
      const thin = (px) => px / z;
      const ew = 0.27 * r, eh = 0.26 * r;
      const color = C.eyeColor ? C.eyeColor(EYE) : EYE;
      const glow = C.eyeGlow ? C.eyeGlow(EYE_GLOW) : EYE_GLOW;
      const sly = M.clamp01(st.wind * 1.4); // o olhar travesso do preparo
      for (const sg of [-1, 1]) {
        P.onSurface(ctx, cam, head, 0.82, 0.36 * sg, 0.14, sg, () => {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (this.dying !== null) {
            ctx.strokeStyle = LID;
            ctx.lineWidth = Math.max(thin(1.1), 0.05 * r);
            ctx.beginPath();
            ctx.moveTo(-ew * 0.85, 0.05 * eh);
            ctx.quadraticCurveTo(0, -0.7 * eh, ew * 0.85, 0.05 * eh);
            ctx.stroke();
            return;
          }
          if (st.rec > 0.3) {
            // apertados: um ">" de cada lado, a ponta para o meio
            ctx.strokeStyle = LID;
            ctx.lineWidth = Math.max(thin(1.1), 0.055 * r);
            ctx.beginPath();
            ctx.moveTo(ew * 0.75, 0.5 * eh);
            ctx.lineTo(-ew * 0.55, 0);
            ctx.lineTo(ew * 0.75, -0.5 * eh);
            ctx.stroke();
            return;
          }
          // o brilho em volta (o encanto): duas rodelas transparentes (degradê a cada quadro pesava)
          ctx.fillStyle = glow;
          ctx.globalAlpha *= 0.45;
          ctx.beginPath();
          ctx.arc(0, 0, ew * 1.75, 0, M.TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 0, ew * 1.35, 0, M.TAU);
          ctx.fill();
          ctx.globalAlpha /= 0.45;
          // a íris acesa: a cor, a borda mais escura e o miolo claro do lado da luz
          ctx.fillStyle = C.tint(M.shade(color, -0.3), flash);
          ctx.beginPath();
          ctx.ellipse(0, 0, ew, eh, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = C.tint(color, flash);
          ctx.beginPath();
          ctx.ellipse(-0.06 * ew, 0.06 * eh, ew * 0.8, eh * 0.8, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 249, 214, 0.75)';
          ctx.beginPath();
          ctx.ellipse(-0.22 * ew, 0.26 * eh, ew * 0.38, eh * 0.32, 0, 0, M.TAU);
          ctx.fill();
          // a pupila redonda (de macaco; a fenda era de gato), olhando um tiquinho para dentro
          ctx.fillStyle = '#1b100d';
          ctx.beginPath();
          ctx.arc(0.1 * ew, -0.04 * eh, 0.4 * ew, 0, M.TAU);
          ctx.fill();
          // a pálpebra de cima, descendo no olhar travesso (o pedaço de cima do olho, até uma corda inclinada)
          if (sly > 0.02) {
            const yIn = eh * (1 - 1.25 * sly), yOut = eh * (1 - 0.6 * sly); // o canto de dentro desce mais
            const xAt = (y) => ew * Math.sqrt(Math.max(0, 1 - (y / eh) * (y / eh)));
            ctx.fillStyle = FACE;
            ctx.beginPath();
            ctx.moveTo(-xAt(yIn), yIn);
            for (let k = 1; k < 8; k++) {
              const a = Math.PI - (k / 8) * Math.PI;
              ctx.lineTo(ew * 1.02 * Math.cos(a), eh * 1.02 * Math.sin(a));
            }
            ctx.lineTo(xAt(yOut), yOut);
            ctx.closePath();
            ctx.fill();
          }
          // o pontinho de luz (do lado da luz)
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-0.34 * ew * sg, 0.36 * eh, 0.2 * ew, 0, M.TAU);
          ctx.fill();
          // a borda escura e, no preparo, a sobrancelha de quem apronta (a ponta de dentro para baixo)
          ctx.strokeStyle = '#140c09';
          ctx.lineWidth = Math.max(thin(0.8), 0.04 * r);
          ctx.beginPath();
          ctx.ellipse(0, 0, ew, eh, 0, 0, M.TAU);
          ctx.stroke();
          if (sly > 0.05) {
            ctx.strokeStyle = 'rgba(214, 190, 160, 0.95)';
            ctx.lineWidth = Math.max(thin(1), 0.06 * r);
            ctx.beginPath();
            ctx.moveTo(ew * 0.95, eh * (1.25 + 0.15 * sly));
            ctx.lineTo(-ew * 0.9, eh * (1.25 - 0.4 * sly));
            ctx.stroke();
          }
        }, 0.02);
      }
    }

    /** A fruta: verde-clara, com o cabinho e a folha; segurando o golpe, brilha (pulsando) cada vez mais. */
    _paintFruit(ctx, cam, c, hold, ink, flash) {
      const z = cam.zoom;
      const q = cam.p(c);
      const r = 3.8 * S * z;
      if (hold > 0) {
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 14);
        const g = ctx.createRadialGradient(q.x, q.y, r * 0.5, q.x, q.y, r * (1.8 + 1.2 * hold));
        g.addColorStop(0, `rgba(220, 255, 140, ${(0.35 + 0.4 * hold) * pulse})`);
        g.addColorStop(1, 'rgba(220, 255, 140, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * (1.8 + 1.2 * hold), 0, M.TAU);
        ctx.fill();
      }
      P.paintLit(ctx, cam, (dx, dy, p) => {
        p.moveTo(q.x + r + dx, q.y + dy);
        p.arc(q.x + dx, q.y + dy, r, 0, M.TAU);
        return p;
      }, LOOK.fruit, r * 0.45, ink, flash, { heavy: false });
      // o cabinho e a folha
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = Math.max(1, 0.9 * z);
      ctx.beginPath();
      ctx.moveTo(q.x, q.y - r * 0.85);
      ctx.lineTo(q.x + r * 0.15, q.y - r * 1.35);
      ctx.stroke();
      ctx.fillStyle = '#5f9a2c';
      ctx.beginPath();
      ctx.moveTo(q.x + r * 0.12, q.y - r * 1.2);
      ctx.quadraticCurveTo(q.x + r * 0.75, q.y - r * 1.6, q.x + r * 0.95, q.y - r * 1.05);
      ctx.quadraticCurveTo(q.x + r * 0.5, q.y - r * 0.95, q.x + r * 0.12, q.y - r * 1.2);
      ctx.fill();
      ctx.stroke();
    }

    /** O encanto, de pé: dois pontinhos lilás rodando em volta da cabeça. */
    _motes(ctx, cam, headC) {
      const t = this.time;
      const z = cam.zoom;
      for (let k = 0; k < 2; k++) {
        const a = t * 1.7 + k * Math.PI + this.seed * 7;
        const rr = 17 * S;
        const p = cam.p(M.add(headC, { x: Math.cos(a) * rr, y: Math.sin(a) * rr, z: 6 * S + Math.sin(t * 2.3 + k * 2) * 4 * S }));
        const s = (2.2 + Math.sin(t * 5 + k * 3)) * z;
        ctx.save();
        ctx.globalAlpha *= 0.45 + 0.35 * Math.sin(t * 4 + k * 2.4);
        // o brilho: uma estrela maior transparente por trás (o desfoque da sombra pesava)
        ctx.fillStyle = 'rgba(207, 179, 255, 0.35)';
        star(ctx, p.x, p.y, s * 1.7);
        ctx.fill();
        ctx.fillStyle = MOTE;
        star(ctx, p.x, p.y, s);
        ctx.fill();
        ctx.restore();
      }
    }

    /**
     * Desmaiado: o encanto sai do corpo — um clarão lilás no peito e as faíscas roxas que se espalham e sobem, sumindo
     * (o motor tira o desenho 0,7 s depois da queda; o corpo apaga de 0,4 a 0,7 s).
     */
    _release(ctx, cam, heart, d) {
      const z = cam.zoom;
      const q = cam.p(heart);
      // o clarão
      if (d < 0.5) {
        const k = d / 0.5;
        const rr = (12 + 26 * M.easeOut(k)) * S * z;
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr);
        g.addColorStop(0, `rgba(214, 178, 255, ${0.55 * (1 - k)})`);
        g.addColorStop(1, 'rgba(180, 140, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rr, 0, M.TAU);
        ctx.fill();
      }
      // as faíscas
      const N = 14;
      ctx.save();
      const base = ctx.globalAlpha; // (o corpo já vem apagando: as faíscas apagam junto)
      for (let i = 0; i < N; i++) {
        const r1 = C.hash01(i * 3.1 + this.seed * 50), r2 = C.hash01(i * 7.7 + 1.3), r3 = C.hash01(i * 1.9 + 4.2);
        const t0 = 0.04 + r3 * 0.14;
        const k = (d - t0) / 0.5;
        if (k <= 0 || k >= 1) continue;
        const a = (i / N) * M.TAU + r1 * 0.7;
        const dist = (8 + 22 * r2) * S * M.easeOut(k);
        const rise = (10 + 42 * r1) * S * k;
        const p = cam.p({ x: heart.x + Math.cos(a) * dist, y: heart.y + Math.sin(a) * dist, z: heart.z + rise });
        const s = (2.2 + 1.8 * r2) * z * (1 - 0.55 * k);
        const alpha = k < 0.12 ? k / 0.12 : 1 - M.smoothstep(0.5, 1, k);
        ctx.globalAlpha = base * alpha;
        ctx.fillStyle = 'rgba(181, 140, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 2.2, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = SPARK;
        star(ctx, p.x, p.y, s);
        ctx.fill();
        ctx.fillStyle = '#f4ecff';
        star(ctx, p.x, p.y, s * 0.45);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  C.define('sagui', Sagui);
  PD.Sagui = Sagui;
})(window.PD = window.PD || {});
