// A Cuca (a bruxa da Toca, na Caverna Sagrada; regras da [estrutura], 24/11: "bruxa e depois chefe"). Desenho
// próprio, do folclore (a velha com cara de jacaré), nada da Cuca da TV: uma vovó ranzinza e corcunda com a **cabeça de
// jacaré-de-papo-amarelo** (o focinho largo e chato, os dentinhos pela beirada da boca, o papo amarelo, os olhos de
// fenda em cima de dois calombos e as sobrancelhas brancas e bravas), o cabelo branco desgrenhado num coque com
// gravetos e ervas, o xale de crochê mostarda remendado e com franja, o vestido roxo-escuro com o avental manchado, o
// colar de sementes com um vidrinho, os pés de garra e a colher de pau comprida. Pintada como o Birim e os bichos novos
// (o contorno, a meia-lua de sombra e o brilho).
// Parada, mexe o caldeirão do mapa (o da Toca: raio de 70 cm e a boca a 92 cm do chão) com a colher na mão do lado da
// câmera (NPC não vira: a mão não troca), o corpo indo e voltando junto, e a outra mão nas costas; olha o herói quando
// ele chega perto; falando (`talk`), a bocarra mexe e a colher sai do caldo pingando e sacode para ele; de vez em quando
// dá a risadinha (os ombros sacudindo, a cabeça para trás, a boca aberta). A view passa o caldeirão que estiver perto
// (`setCauldron`): até `REACH` do meio dele, ela fica virada para ele e mexe (a colher some no caldo); sem caldeirão
// perto, segura a colher em pé, como cetro. Na caverna escura, a luz própria (o verde batendo nela). Os golpes de chefe
// (a cantiga de ninar e o caldo jogado) vêm na etapa 2.
//   PD.creatures.create('cuca', xCm, yCm, yaw); cuca.setCauldron({ x, y, r })   (cm)
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  if (!C) return;
  const P = C.paint;
  const SH = PD.shapes;
  const UP = M.UP;

  const LOOK = {
    skin: { base: '#74833f', shade: 'rgba(24, 34, 8, 0.45)', light: 'rgba(240, 255, 200, 0.32)' },
    throat: { base: '#ddc978', shade: 'rgba(90, 70, 10, 0.35)', light: 'rgba(255, 250, 210, 0.4)' },
    shawl: { base: '#b8892f', shade: 'rgba(60, 34, 4, 0.45)', light: 'rgba(255, 240, 190, 0.32)' },
    dress: { base: '#4f3956', shade: 'rgba(20, 8, 24, 0.5)', light: 'rgba(240, 220, 255, 0.2)' },
    hair: { base: '#dcd7ca', shade: 'rgba(70, 64, 56, 0.4)', light: 'rgba(255, 255, 250, 0.45)' },
    wood: { base: '#8a5a2e', shade: 'rgba(40, 20, 6, 0.45)', light: 'rgba(255, 230, 190, 0.3)' },
  };
  const APRON = '#cdbd8c';
  const STAIN = 'rgba(70, 100, 30, 0.45)';
  const PATCH = '#7a2e3a';
  const STITCH = '#2a1208';
  const CROCHET = 'rgba(80, 48, 8, 0.55)';
  const FRINGE = '#8f6420';
  const CLAW = '#ece4c4';
  const EYE = '#f3c83a';
  const DARK = '#140c06';
  const MOUTH = '#5a1a14';
  const TONGUE = '#c46a6a';
  const TOOTH = '#fbf6e6';
  const SEED = '#6a3a1c';
  const VIAL = '#c98a2e';
  const LEAF = '#5f9a2c';
  const BREW_C = '#6fd14e';

  /** O tamanho dela: os números do corpo são de uma velhinha de 1,30 m; com a corcunda e o coque ela fica com ~1,55 m. */
  const S = 1.15;
  /** Até onde do meio do caldeirão (cm) ela mexe; a boca dele (a do sul.js, do [mundo]) e a altura do caldo. */
  const REACH = 150;
  const RIM = 92;
  const BREW = 88;
  /** A colher: o tanto do cabo que passa da mão (cm). */
  const TAIL = 22;

  /** Ponto no quadro dela (cm): `a` para a frente, `s` para a direita, `z` para cima. */
  function local(fr, a, s, z) {
    return { x: fr.o.x + fr.f.x * a + fr.s.x * s, y: fr.o.y + fr.f.y * a + fr.s.y * s, z: fr.o.z + z };
  }

  /** O cotovelo entre o ombro e a mão (braço de 24 + 22 cm, no tamanho dela), dobrando para o lado de `pole`. */
  function elbowOf(sh, hand, pole) {
    const A = 24 * S;
    const B = 22 * S;
    const d = M.sub(hand, sh);
    const L = Math.max(1e-3, M.len(d));
    const dd = Math.min(L, A + B - 0.5);
    const x = (A * A - B * B + dd * dd) / (2 * dd);
    const h = Math.sqrt(Math.max(0, A * A - x * x));
    const u = M.scale(d, 1 / L);
    const pn = M.norm(M.sub(pole, M.scale(u, M.dot(pole, u))));
    return M.add(sh, M.add(M.scale(u, x), M.scale(pn, h)));
  }

  /** Os pontos de uma bola (cm), para o casco: `n` em volta, em três alturas, e os polos. */
  function ballPts(out, c, r, n = 10) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * M.TAU;
      for (const zz of [-0.6, 0, 0.6]) {
        const w = Math.sqrt(1 - zz * zz);
        out.push({ x: c.x + Math.cos(a) * r * w, y: c.y + Math.sin(a) * r * w, z: c.z + zz * r });
      }
    }
    out.push({ x: c.x, y: c.y, z: c.z + r }, { x: c.x, y: c.y, z: c.z - r });
    return out;
  }

  class Cuca extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 32;
      this.top = 160;
      /** O caldeirão que ela mexe ({ x, y, r, d } em cm) ou null. */
      this.cauldron = null;
      /** Segundos desde começar a falar (o balão); 9 = calada. */
      this.talkT = 9;
      /** A cabeça olhando (rad, em volta do pescoço) e quanto ela olha o herói (0..1), suavizados. */
      this.lookYaw = 0;
      this.lookK = 0;
    }

    talk() {
      this.talkT = 0;
    }

    /** O caldeirão do mapa perto dela ({ x, y, r } em cm; a view passa). Longe demais (ou nenhum): a colher em pé. */
    setCauldron(c) {
      const d = c ? Math.hypot(c.x - this.pos.x, c.y - this.pos.y) : Infinity;
      this.cauldron = d <= REACH && d > 1 ? { x: c.x, y: c.y, r: c.r || 70, d } : null;
      if (this.cauldron) this.yaw = this.yawTarget = this.faceYaw = Math.atan2(c.y - this.pos.y, c.x - this.pos.x);
    }

    animate(dt) {
      this.talkT += dt;
      // virada para o caldeirão (o servidor manda os NPCs olhando para baixo)
      const cv = this.cauldron;
      if (cv) {
        this.yaw = this.yawTarget = this.faceYaw = Math.atan2(cv.y - this.pos.y, cv.x - this.pos.x);
        cv.d = Math.hypot(cv.x - this.pos.x, cv.y - this.pos.y);
      }
      // olha o herói quando ele chega perto (só o pescoço: o corpo fica no caldeirão)
      let want = M.noise1(this.time * 0.25 + this.seed * 9) * 0.3;
      let looking = 0;
      const h = this.near && this.near.hero;
      if (h) {
        const d = Math.hypot(h.x - this.pos.x, h.y - this.pos.y);
        if (d < 500) {
          want = M.clamp(M.angleDiff(this.yaw, Math.atan2(h.y - this.pos.y, h.x - this.pos.x)), -1.1, 1.1);
          looking = 1;
        }
      }
      if (this.talkT < 2.4) looking = 1;
      this.lookYaw = M.dampAngle(this.lookYaw, want, 4, dt);
      this.lookK = M.damp(this.lookK, looking, 3, dt);
      this.label = this.talkT < 2.4 ? 'falando' : this._cackle() > 0.2 ? 'rindo' : 'mexendo o caldeirão';
    }

    /** A risadinha (0..1): sozinha de vez em quando e logo depois de falar. */
    _cackle() {
      const t = this.time + this.seed * 7;
      const k1 = ((t % 11) - 8.5) / 1.3;
      const after = (this.talkT - 2.2) / 1.2;
      const bump = (k) => (k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0);
      return Math.max(bump(k1), bump(after));
    }

    /**
     * A pose (pontos 3D em cm). `cam`: a colher fica na mão do lado da câmera (sem câmera, na esquerda). Os pontos do
     * corpo vêm do tamanho de 1,30 m vezes `S`; os da colher mexendo, do caldeirão (sem `S`).
     */
    _rig(cam) {
      const t = this.time;
      const talking = this.talkT < 2.4 ? 1 - M.smoothstep(2.0, 2.4, this.talkT) : 0;
      const cackle = this._cackle();
      const cv = this.cauldron;
      // mexendo (ou com a colher em pé): sai disso falando e, em parte, rindo
      const busy = 1 - Math.max(talking, cackle * 0.6);
      const f = { x: Math.cos(this.yaw), y: Math.sin(this.yaw), z: 0 };
      const s = { x: -f.y, y: f.x, z: 0 };
      // o lado da colher (1 = direita, -1 = esquerda): o da câmera
      const side = cam && M.dot(s, cam.toCamera) > 0 ? 1 : -1;
      // a volta da colher; o corpo vai para a frente quando ela está longe e volta quando está perto
      const ph = t * 2.6 + this.seed * 5;
      const ca = Math.cos(ph);
      const sa = Math.sin(ph);
      const stirK = cv ? busy : 0;
      const lean = (2.2 + 2.6 * ca) * stirK + 1 * (1 - stirK);
      const sway = 1.8 * sa * stirK * side;
      const breath = Math.sin(t * 1.7) * 0.8;
      const shake = cackle * Math.sin(t * 46) * 1.5;
      const fr = { o: { x: this.pos.x, y: this.pos.y, z: this.groundZ }, f, s };
      const W3 = (a, sd, z) => local(fr, a, sd, z);
      const P3 = (a, sd, z) => local(fr, a * S, sd * S, z * S);
      const up = breath + shake;
      // o tronco curvado (a corcunda é o ponto mais alto das costas) e os ombros caídos para a frente
      const waist = P3(0, 0, 70);
      const belly = P3(7 + lean * 0.2, sway * 0.2, 81);
      const chest = P3(11 + lean * 0.5, sway * 0.5, 95 + breath);
      const hump = P3(-5 + lean * 0.6, sway * 0.6, 106 + up);
      const shLadle = P3(9 + lean * 0.7, side * 15 + sway * 0.7, 105 + up);
      const shBack = P3(9 + lean * 0.7, -side * 15 + sway * 0.7, 105 + up);
      const neck = P3(18 + lean * 0.8, sway * 0.8, 112 + up);
      // a cabeça: na frente da corcunda, olhando o caldo (para baixo) ou o herói; rindo, vai para trás
      const lk = this.lookYaw * (0.35 + 0.65 * this.lookK);
      const tilt = cackle * 0.5 - 0.32 * stirK * (1 - this.lookK) - 0.06 * this.lookK;
      const ya = this.yaw + lk;
      const hf = M.norm({ x: Math.cos(ya) * Math.cos(tilt), y: Math.sin(ya) * Math.cos(tilt), z: Math.sin(tilt) });
      const hs = M.norm({ x: -hf.y, y: hf.x, z: 0 });
      const hu = M.norm(M.cross(hs, hf));
      const headC = M.add(neck, M.add(M.scale(hf, 9 * S), M.scale(UP, 5 * S)));
      // a boca: fala (abre e fecha) e a risada (bem aberta)
      const jaw = Math.max(talking * Math.abs(Math.sin(t * 9)) * 0.42, cackle * (0.38 + 0.18 * Math.abs(Math.sin(t * 23))));
      // a colher: mexendo em roda por cima da beirada (o caldo a `d` cm), ou em pé como cetro (sem caldeirão);
      // falando, sai do caldo e sacode para quem fala com ela
      const wag = Math.sin(t * 7);
      let handBase;
      let bowlBase;
      if (cv) {
        handBase = W3(44 + ca * 6, side * (10 + sa * 6), 112);
        bowlBase = W3(cv.d - 33 + ca * 16, side * (4 + sa * 16), RIM - 14);
      } else {
        handBase = P3(24, side * 12, 84 + breath * 0.4);
        bowlBase = P3(28, side * 15, 122 + breath * 0.4);
      }
      const handTalk = P3(28, side * 17, 104 + wag * 3);
      const bowlTalk = P3(52, side * 28, 116 + wag * 6);
      const handL = M.lerp3(handTalk, handBase, busy);
      const bowl = M.lerp3(bowlTalk, bowlBase, busy);
      // a outra mão nas costas (a velha curvada), sacudindo junto na risada
      const handR = P3(-14 + lean * 0.4, -side * 8, 84 + breath * 0.5 + shake * 0.5);
      const elL = elbowOf(shLadle, handL, M.add(M.scale(s, side), { x: 0, y: 0, z: -0.8 }));
      const elR = elbowOf(shBack, handR, M.add(M.add(M.scale(s, -side), M.scale(f, -0.6)), { x: 0, y: 0, z: -0.3 }));
      const blink = (t + this.seed * 3) % 4.3 < 0.12 ? 1 : 0;
      return {
        fr, f, s, P3, side, waist, belly, chest, hump, sh: [shLadle, shBack], neck, headC, hf, hs, hu, jaw,
        handL, handR, elL, elR, bowl, cackle, talking, busy, stirK, blink,
      };
    }

    parts(cam) {
      const R = this._rig(cam);
      const z = cam.zoom;
      const ink = Math.max(1, 1.1 * z);
      const small = z < 0.85;
      const self = this;
      const toCam = cam.toCamera;
      // a mão da colher é a do lado da câmera: o braço de lá (a mão nas costas) vai antes do tronco; o de cá vai por
      // cima do vestido e por baixo do xale (o braço) e por cima de tudo (o antebraço, a mão e a colher)
      const front = M.dot(R.hf, toCam) > -0.15;
      const g = (balls, ref, bias, paint) => ({ balls, ref, bias, body: true, paint });
      const groups = [
        g([{ c: R.P3(4, 0, 30), r: 26 * S }], R.P3(0, 0, 40), 0, (ctx, fl) => self._paintSkirt(ctx, cam, R, ink, fl, small)),
        g([], R.sh[1], -14, (ctx, fl) => {
          self._paintUpper(ctx, cam, R.sh[1], R.elR, ink, fl, small);
          self._paintFore(ctx, cam, R.elR, R.handR, false, ink, fl, small);
        }),
        g([{ c: R.chest, r: 18 * S }, { c: R.hump, r: 16 * S }], R.chest, 6, (ctx, fl) => {
          self._paintBodice(ctx, cam, R, ink, fl, small);
          self._paintUpper(ctx, cam, R.sh[0], R.elL, ink, fl, small);
          self._paintShawl(ctx, cam, R, ink, fl, small);
        }),
        g([{ c: R.handL, r: 6 }], R.handL, 9, (ctx, fl) => {
          self._paintLadle(ctx, cam, R, ink, fl);
          self._paintFore(ctx, cam, R.elL, R.handL, true, ink, fl, small);
        }),
        g([{ c: R.headC, r: 15 * S }], R.headC, front ? 22 : 8, (ctx, fl) => self._paintHead(ctx, cam, R, ink, fl, small)),
      ];
      const paint = (ctx, flash) => {
        ctx.save();
        for (const gr of C.byDepth(cam, groups)) gr.paint(ctx, flash);
        ctx.restore();
      };
      return { groups, paint };
    }

    /** Na caverna escura: o verde do caldeirão batendo nela (a view abre a escuridão em volta). */
    light() {
      const lit = this.dying === null ? 1 : 1 - M.smoothstep(0.05, 0.45, this.dying);
      return { x: this.pos.x, y: this.pos.y, z: this.groundZ + 115, r: 150, color: '#a6e07a', k: 0.35 * lit };
    }

    /** Um volume pintado (o casco dos pontos na tela), com o contorno, a sombra e o brilho. */
    _blob(ctx, cam, pts3, look, k, ink, flash, opts = {}) {
      const flat = [];
      for (const p of pts3) {
        const q = cam.p(p);
        flat.push(q.x, q.y);
      }
      const hull = SH.convexHull(flat);
      P.paintLit(ctx, cam, (dx, dy, p) => SH.fillPath(hull, dx, dy, p), look, k, ink, flash, { stroke: (dx, dy, p) => SH.polyPath(hull, dx, dy, p), ...opts });
      return hull;
    }

    /** Um polígono plano (pontos 3D) pintado de uma cor. */
    _flat(ctx, cam, pts3, color) {
      const q = pts3.map((p) => cam.p(p));
      ctx.beginPath();
      ctx.moveTo(q[0].x, q[0].y);
      for (const p of q.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    /** Os pés de garra e a saia comprida com o avental, o remendo, a barra e as dobras. */
    _paintSkirt(ctx, cam, R, ink, flash, small) {
      const z = cam.zoom;
      const { P3, fr } = R;
      const toCam = cam.toCamera;
      // os pés (a ponta aparece na barra da saia) com as garras claras
      for (const sd of [-9, 9]) {
        const pts = [];
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * M.TAU;
          pts.push(P3(12 + Math.cos(a) * 8, sd + Math.sin(a) * 4.5, 1.5 + Math.max(0, Math.sin(a)) * 2.5));
        }
        this._blob(ctx, cam, pts, LOOK.skin, 0, ink, flash, {
          after: (c) => {
            c.strokeStyle = C.tint(CLAW, flash);
            c.lineWidth = Math.max(1, 1.2 * z);
            c.beginPath();
            for (const o of [-2.6, 0, 2.6]) {
              const a1 = cam.p(P3(18, sd + o, 2)), b1 = cam.p(P3(21.5, sd + o * 1.25, 0.3));
              c.moveTo(a1.x, a1.y);
              c.lineTo(b1.x, b1.y);
            }
            c.stroke();
          },
        });
      }
      // a saia: da cintura (estreita) à barra (larga), um pouco levantada na frente
      const ring = (zc, rf, rs, n, frontA) => {
        const out = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * M.TAU;
          out.push(P3(Math.cos(a) * rf + (Math.cos(a) > 0 ? frontA : 0), Math.sin(a) * rs, zc));
        }
        return out;
      };
      const pts = ring(5, 23, 26, 18, 2).concat(ring(72, 14, 16, 14, 1));
      const seen = (a) => M.dot({ x: fr.f.x * Math.cos(a) + fr.s.x * Math.sin(a), y: fr.f.y * Math.cos(a) + fr.s.y * Math.sin(a), z: 0 }, toCam);
      this._blob(ctx, cam, pts, LOOK.dress, small ? 0 : 5 * z, ink, flash, {
        inside: (c) => {
          // as dobras: riscos escuros da cintura à barra, só do lado que a câmera vê
          c.strokeStyle = 'rgba(16, 6, 20, 0.55)';
          c.lineWidth = Math.max(1, 1.2 * z);
          c.beginPath();
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * M.TAU + 0.3;
            if (seen(a) < 0.15) continue;
            const a1 = cam.p(P3(Math.cos(a) * 15, Math.sin(a) * 17, 64)), b1 = cam.p(P3(Math.cos(a) * 24, Math.sin(a) * 27, 7));
            c.moveTo(a1.x, a1.y);
            c.quadraticCurveTo((a1.x + b1.x) / 2 + 2 * z, (a1.y + b1.y) / 2, b1.x, b1.y);
          }
          c.stroke();
          // a barra (uma faixa mais escura em volta, do lado de cá)
          c.strokeStyle = 'rgba(16, 6, 20, 0.5)';
          c.lineWidth = Math.max(1.5, 3 * z);
          c.beginPath();
          let on = false;
          for (let k = 0; k <= 24; k++) {
            const a = (k / 24) * M.TAU;
            if (seen(a) < -0.05) {
              on = false;
              continue;
            }
            const q = cam.p(P3(Math.cos(a) * 23.5 + (Math.cos(a) > 0 ? 2 : 0), Math.sin(a) * 26.5, 10));
            if (on) c.lineTo(q.x, q.y);
            else c.moveTo(q.x, q.y);
            on = true;
          }
          c.stroke();
          // o avental (na frente) com as manchas de erva e o cordão na cintura
          if (M.dot(fr.f, toCam) > -0.25) {
            this._flat(c, cam, [P3(16, -11, 70), P3(16, 11, 70), P3(26, 16, 16), P3(26, -16, 16)], C.tint(APRON, flash));
            c.fillStyle = STAIN;
            for (const [a, sd, zz, r] of [[21, -4, 46, 4.5], [24, 7, 28, 3.2], [18, 3, 59, 2.6], [25, -9, 22, 2]]) {
              const q = cam.p(P3(a, sd, zz));
              c.beginPath();
              c.arc(q.x, q.y, r * z, 0, M.TAU);
              c.fill();
            }
            c.strokeStyle = C.tint('#e3d6aa', flash);
            c.lineWidth = Math.max(1, 1.6 * z);
            c.beginPath();
            const w0 = cam.p(P3(15, -14, 71)), w1 = cam.p(P3(16.5, 0, 72)), w2 = cam.p(P3(15, 14, 71));
            c.moveTo(w0.x, w0.y);
            c.quadraticCurveTo(w1.x, w1.y + 1 * z, w2.x, w2.y);
            c.stroke();
          }
          // o remendo na barra, com os pontos da costura
          if (seen(Math.PI / 2) > 0.1) {
            this._flat(c, cam, [P3(-6, 24, 24), P3(6, 25, 24), P3(7, 27.5, 9), P3(-6, 26.5, 9)], C.tint(PATCH, flash));
            c.strokeStyle = STITCH;
            c.setLineDash([2 * z, 2 * z]);
            c.lineWidth = Math.max(0.8, 0.8 * z);
            c.stroke();
            c.setLineDash([]);
          }
        },
      });
    }

    /** O vestido de cima: a cintura, a barriga, o peito, a corcunda e os ombros. */
    _paintBodice(ctx, cam, R, ink, flash, small) {
      const z = cam.zoom;
      const pts = [];
      for (const [c0, r] of [[R.waist, 15], [R.belly, 15], [R.chest, 13], [R.hump, 15], [R.sh[0], 8], [R.sh[1], 8]]) ballPts(pts, c0, r * S);
      this._blob(ctx, cam, pts, LOOK.dress, small ? 0 : 5 * z, ink, flash);
    }

    /**
     * O xale de crochê em volta dos ombros e da corcunda: a beirada de baixo desce nas costas (o bico) e sobe na frente
     * (o nó no peito), as carreiras do crochê, o remendo, a franja e o colar de sementes com o vidrinho.
     */
    _paintShawl(ctx, cam, R, ink, flash, small) {
      const z = cam.zoom;
      const { fr } = R;
      const toCam = cam.toCamera;
      const hc = R.hump;
      // a beirada de baixo: alta na frente (no peito), baixa atrás (o bico nas costas); acompanha a corcunda
      const lift = hc.z - fr.o.z - 106 * S;
      const edge = (a, grow = 0) => {
        const along = (7 + Math.cos(a) * ((Math.cos(a) > 0 ? 20 : 19) + grow)) * S;
        const side = Math.sin(a) * (21 + grow) * S;
        const ez = (89 + 8 * Math.cos(a) - 4 * Math.max(0, -Math.cos(a)) ** 4) * S;
        return { x: hc.x + fr.f.x * along + fr.s.x * side, y: hc.y + fr.f.y * along + fr.s.y * side, z: fr.o.z + ez + lift };
      };
      const pts = [];
      for (let k = 0; k < 16; k++) pts.push(edge((k / 16) * M.TAU));
      ballPts(pts, M.add(hc, { x: 0, y: 0, z: 1.5 * S }), 16 * S, 12);
      for (const c0 of R.sh) ballPts(pts, c0, 9.5 * S, 8);
      // o alto, em volta do pescoço (mais baixo que a cabeça: ela aparece inteira)
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * M.TAU;
        const fa = (Math.cos(a) * 8 - 6) * S, sd = Math.sin(a) * 10 * S;
        pts.push(M.add(R.neck, { x: fr.f.x * fa + fr.s.x * sd, y: fr.f.y * fa + fr.s.y * sd, z: -2 * S }));
      }
      const seen = (a) => M.dot({ x: fr.f.x * Math.cos(a) + fr.s.x * Math.sin(a), y: fr.f.y * Math.cos(a) + fr.s.y * Math.sin(a), z: 0 }, toCam);
      const frontSeen = M.dot(fr.f, toCam) > 0;
      this._blob(ctx, cam, pts, LOOK.shawl, small ? 0 : 5 * z, ink, flash, {
        inside: (c) => {
          // as carreiras do crochê (pontilhadas, paralelas à beirada) do lado que a câmera vê
          if (!small) {
            c.strokeStyle = CROCHET;
            c.lineWidth = Math.max(1, 1.3 * z);
            c.setLineDash([1.6 * z, 2.2 * z]);
            for (const [up0, shrink] of [[5, 2.5], [10, 5], [15, 8]]) {
              const up = up0 * S;
              c.beginPath();
              let on = false;
              for (let k = 0; k <= 24; k++) {
                const a = (k / 24) * M.TAU;
                if (seen(a) < 0.05) {
                  on = false;
                  continue;
                }
                const e = edge(a, -shrink);
                const q = cam.p({ x: e.x, y: e.y, z: e.z + up });
                if (on) c.lineTo(q.x, q.y);
                else c.moveTo(q.x, q.y);
                on = true;
              }
              c.stroke();
            }
            c.setLineDash([]);
          }
          // o remendo vinho com a costura (nas costas, ou no ombro de cá quando ela está de frente)
          const pc = frontSeen ? M.add(R.sh[0], { x: 0, y: 0, z: 2 * S }) : M.add(hc, M.add(M.scale(fr.f, -12 * S), { x: 0, y: 0, z: -4 * S }));
          const q = cam.p(pc);
          c.fillStyle = C.tint(PATCH, flash);
          c.fillRect(q.x - 4.5 * z, q.y - 3.5 * z, 9 * z, 7 * z);
          c.strokeStyle = STITCH;
          c.setLineDash([1.8 * z, 1.8 * z]);
          c.lineWidth = Math.max(0.8, 0.8 * z);
          c.strokeRect(q.x - 4.5 * z, q.y - 3.5 * z, 9 * z, 7 * z);
          c.setLineDash([]);
        },
      });
      // a franja: fiapos caindo da beirada (do lado de cá), por cima do vestido
      ctx.strokeStyle = C.tint(FRINGE, flash);
      ctx.lineWidth = Math.max(1, 1.3 * z);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * M.TAU;
        if (seen(a) < 0.1) continue;
        const e = edge(a, 0.5);
        const p0 = cam.p(e), p1 = cam.p({ x: e.x, y: e.y, z: e.z - (k % 2 ? 5 : 7) * S });
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x + ((k % 3) - 1) * 0.6 * z, p1.y);
      }
      ctx.stroke();
      if (M.dot(fr.f, toCam) < -0.3) return;
      // o nó do xale no peito, com as duas pontas caindo
      const kc = M.add(R.chest, M.add(M.scale(fr.f, 10 * S), { x: 0, y: 0, z: 3 * S }));
      for (const sd of [-1, 1]) {
        const tip = M.add(kc, M.add(M.scale(fr.s, sd * 3.5 * S), { x: fr.f.x * 1.5 * S, y: fr.f.y * 1.5 * S, z: -11 * S }));
        const a0 = cam.p(M.add(kc, M.scale(fr.s, sd * 1.5 * S))), b0 = cam.p(tip);
        ctx.strokeStyle = C.INK;
        ctx.lineWidth = 5.4 * z;
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(b0.x, b0.y);
        ctx.stroke();
        ctx.strokeStyle = C.tint(LOOK.shawl.base, flash);
        ctx.lineWidth = 3.4 * z;
        ctx.stroke();
      }
      const kq = cam.p(kc);
      ctx.fillStyle = C.tint(LOOK.shawl.base, flash);
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = Math.max(1, 1.1 * z);
      ctx.beginPath();
      ctx.ellipse(kq.x, kq.y, 3.6 * z, 3 * z, 0, 0, M.TAU);
      ctx.fill();
      ctx.stroke();
      // o colar de sementes (pendurado no pescoço, por cima do xale) com o vidrinho de poção
      if (M.dot(fr.f, toCam) < -0.1) return;
      ctx.fillStyle = C.tint(SEED, flash);
      for (let k = 0; k <= 8; k++) {
        const a = -1 + (k / 8) * 2;
        const p = cam.p(M.add(R.neck, M.add(M.scale(fr.f, (3 + Math.cos(a) * 5) * S), M.add(M.scale(fr.s, Math.sin(a) * 9 * S), { x: 0, y: 0, z: (-4 - Math.cos(a) * 6) * S }))));
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4 * z, 0, M.TAU);
        ctx.fill();
      }
      const vp = cam.p(M.add(R.neck, M.add(M.scale(fr.f, 9 * S), M.add(M.scale(fr.s, 3.5 * S), { x: 0, y: 0, z: -12 * S }))));
      ctx.fillStyle = C.tint(VIAL, flash);
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = Math.max(0.8, 0.9 * z);
      ctx.beginPath();
      ctx.ellipse(vp.x, vp.y, 2.2 * z, 2.8 * z, 0, 0, M.TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.tint('#7a5230', flash);
      ctx.fillRect(vp.x - 1 * z, vp.y - 4.4 * z, 2 * z, 1.8 * z);
      ctx.fillStyle = 'rgba(255, 250, 220, 0.6)';
      ctx.beginPath();
      ctx.arc(vp.x - 0.8 * z, vp.y - 0.8 * z, 0.7 * z, 0, M.TAU);
      ctx.fill();
    }

    /** O braço (a manga do vestido), do ombro ao cotovelo. */
    _paintUpper(ctx, cam, sh, el, ink, flash, small) {
      const z = cam.zoom;
      const shape = P.limbShape([cam.p(sh), cam.p(el)], [7.4 * S * z, 6.2 * S * z], true);
      P.paintLit(ctx, cam, (dx, dy, p) => P.limbPath(shape, dx, dy, p), LOOK.dress, small ? 0 : 3 * z, ink, flash, {
        stroke: (dx, dy, p) => P.limbStrokePath(shape, dx, dy, p),
      });
    }

    /** O antebraço (a manga até o punho, com o punho da manga) e a mão verde de garra; `grip`: segurando a colher. */
    _paintFore(ctx, cam, el, hand, grip, ink, flash, small) {
      const z = cam.zoom;
      const wrist = M.lerp3(el, hand, 0.82);
      const shape = P.limbShape([cam.p(el), cam.p(wrist)], [6.2 * S * z, 5.2 * S * z], false);
      P.paintLit(ctx, cam, (dx, dy, p) => P.limbPath(shape, dx, dy, p), LOOK.dress, small ? 0 : 3 * z, ink, flash, {
        stroke: (dx, dy, p) => P.limbStrokePath(shape, dx, dy, p),
        after: (c) => {
          // o punho da manga (uma faixa clara)
          const a = cam.p(M.lerp3(el, wrist, 0.86));
          const dq = cam.pDir(M.norm(M.sub(wrist, el)));
          const ang = Math.atan2(dq.y, dq.x) + Math.PI / 2;
          c.strokeStyle = 'rgba(255, 235, 250, 0.28)';
          c.lineWidth = 2.2 * z;
          c.beginPath();
          c.moveTo(a.x + Math.cos(ang) * 6 * z, a.y + Math.sin(ang) * 6 * z);
          c.lineTo(a.x - Math.cos(ang) * 6 * z, a.y - Math.sin(ang) * 6 * z);
          c.stroke();
        },
      });
      // a mão (escamas verdes) e os dedos de garra
      const hq = cam.p(hand);
      const handPts = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * M.TAU;
        handPts.push({ x: hand.x + Math.cos(a) * 4.3 * S, y: hand.y + Math.sin(a) * 4.3 * S, z: hand.z + Math.sin(a * 2) * 1.6 * S });
      }
      this._blob(ctx, cam, handPts, LOOK.skin, 0, ink, flash);
      if (small) return;
      ctx.strokeStyle = C.tint(CLAW, flash);
      ctx.lineWidth = Math.max(1, 1 * z);
      ctx.beginPath();
      const dq = cam.pDir(M.norm(M.sub(hand, el)));
      const L = Math.hypot(dq.x, dq.y) || 1;
      const ux = dq.x / L, uy = dq.y / L;
      for (const o of [-1, 0, 1]) {
        const bx = hq.x + ux * 3 * z - uy * o * 2.2 * z, by = hq.y + uy * 3 * z + ux * o * 2.2 * z;
        const len = grip ? 1.8 : 2.8;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + ux * len * z + (grip ? -uy * 1.5 * z : 0), by + uy * len * z + (grip ? ux * 1.5 * z : 0));
      }
      ctx.stroke();
    }

    /**
     * A colher de pau comprida: o cabo da mão até o caldo (o que está dentro do caldo não aparece) e, fora do caldo, a
     * concha pingando.
     */
    _paintLadle(ctx, cam, R, ink, flash) {
      const z = cam.zoom;
      const dir = M.norm(M.sub(R.handL, R.bowl));
      const top = M.add(R.handL, M.scale(dir, 20));
      const base = R.fr.o.z + BREW;
      let end = R.bowl;
      const inBrew = R.bowl.z < base - 1;
      if (inBrew && top.z > base) end = M.lerp3(top, R.bowl, (top.z - base) / (top.z - R.bowl.z));
      const a = cam.p(top), b = cam.p(end);
      ctx.lineCap = 'round';
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = 5 * z;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = C.tint(LOOK.wood.base, flash);
      ctx.lineWidth = 2.8 * z;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 230, 190, 0.35)';
      ctx.lineWidth = 0.9 * z;
      ctx.beginPath();
      ctx.moveTo(a.x - 0.6 * z, a.y - 0.6 * z);
      ctx.lineTo(b.x - 0.6 * z, b.y - 0.6 * z);
      ctx.stroke();
      if (inBrew) {
        // onde o cabo entra no caldo: o caldo sobe um pouquinho em volta
        ctx.strokeStyle = C.tint(BREW_C, flash);
        ctx.lineWidth = Math.max(1, 1.4 * z);
        ctx.beginPath();
        ctx.ellipse(b.x, b.y + 0.5 * z, 4.5 * z, 2 * z, 0, 0, M.TAU);
        ctx.stroke();
        return;
      }
      // a concha fora do caldo, com o caldo verde dentro e os pingos caindo
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.fillStyle = C.tint('#6e4421', flash);
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = Math.max(1, 1.1 * z);
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 6.4 * z, 4 * z, ang, 0, M.TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.tint(BREW_C, flash);
      ctx.beginPath();
      ctx.ellipse(b.x - Math.cos(ang) * 0.6 * z, b.y - Math.sin(ang) * 0.6 * z - 0.5 * z, 4.4 * z, 2.4 * z, ang, 0, M.TAU);
      ctx.fill();
      for (let k = 0; k < 2; k++) {
        const ph = (this.time * 1.6 + k * 0.5) % 1;
        const q = cam.p({ x: R.bowl.x, y: R.bowl.y, z: R.bowl.z - 3 - ph * 40 });
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath();
        ctx.ellipse(q.x + (k ? 1.5 : -1) * z, q.y, 1.1 * z, 1.6 * z, 0, 0, M.TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /**
     * A cabeça de jacaré-de-papo-amarelo: o cabelo branco atrás e o coque com gravetos e ervas; o queixo amarelo (a
     * boca abre: o queixo desce, o vermelho de dentro, a língua e os dentes de baixo); o crânio e o focinho largo e chato,
     * com os dentinhos pela beirada; os calombos dos olhos (amarelos de fenda) com as sobrancelhas brancas e bravas; a
     * ponta do focinho com as narinas.
     */
    _paintHead(ctx, cam, R, ink, flash, small) {
      const z = cam.zoom;
      const { headC: c0, hf, hs, hu, jaw } = R;
      // (os números da cabeça em cm de 1,30 m: vezes S)
      const H = (a0, s0, u0) => {
        const a = a0 * S, s = s0 * S, u = u0 * S;
        return { x: c0.x + hf.x * a + hs.x * s + hu.x * u, y: c0.y + hf.y * a + hs.y * s + hu.y * u, z: c0.z + hf.z * a + hs.z * s + hu.z * u };
      };
      const toCam = cam.toCamera;
      const front = M.dot(hf, toCam) > -0.15;
      // o queixo gira em volta da dobradiça (a = -3, u = -2) para baixo
      const ca = Math.cos(jaw), sa = Math.sin(jaw);
      const J = (a, s, u) => {
        const ra = a + 3, ru = u + 2;
        return H(-3 + ra * ca + ru * sa, s, -2 - ra * sa + ru * ca);
      };
      const open = jaw > 0.05;
      // o focinho, em fatias: [a, meia largura, cima, baixo]
      const SL = [[-8, 6.5, 4, -3.5], [-4, 8.5, 5, -3], [2, 9, 4.6, -2], [8, 8.6, 3.8, -1.8], [16, 7.9, 3.1, -1.6], [24, 7.2, 2.7, -1.5], [28.5, 6, 2.5, -1.4], [31, 3.8, 2.3, -1.3]];
      const halfW = (a) => {
        for (let i = 1; i < SL.length; i++) if (a <= SL[i][0]) return M.lerp(SL[i - 1][1], SL[i][1], (a - SL[i - 1][0]) / (SL[i][0] - SL[i - 1][0]));
        return SL[SL.length - 1][1];
      };
      const furBlob = (pts3, spikes, len, seed, pad) => {
        const flat = [];
        for (const p of pts3) {
          const q = cam.p(p);
          flat.push(q.x, q.y);
        }
        const hull = SH.convexHull(flat);
        const fur = P.furOutline(hull, spikes, len * z, seed, 0.35, null, 0.45);
        if (fur) {
          P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.hair, small ? 0 : 3 * z, ink, flash, {
            light: (dx, dy, p) => SH.fillPath(P.grow(hull, pad * z), dx, dy, p),
            lightPad: pad * z,
          });
        }
      };
      const hair = () => {
        const hp = [H(-10.5, 0, 3), H(-10, -6, 0.5), H(-10, 6, 0.5), H(-9, -8, 5), H(-9, 8, 5), H(-3, -6.5, 9), H(-3, 6.5, 9), H(-1, 0, 9.5), H(-6, 0, 11), H(-6, -5, 10.5), H(-6, 5, 10.5), H(-4.5, -8.6, 3), H(-4.5, 8.6, 3), H(-7, -8.4, 0), H(-7, 8.4, 0)];
        furBlob(hp, small ? 16 : 26, 3.2, this.seed * 5 + 1, 4.5);
      };
      const bun = () => {
        furBlob(ballPts([], H(-5, 0, 14.5), 5.6 * S, 10), small ? 10 : 16, 2.2, this.seed * 7 + 3, 3);
        // os gravetos espetados no coque e as folhinhas
        ctx.lineCap = 'round';
        for (const [a, s, u, da, ds, du] of [[-5, -3, 13, -5, -10, 9], [-4, 4, 14, 5, 9, 9]]) {
          const p0 = cam.p(H(a, s, u)), p1 = cam.p(H(a + da, s + ds, u + du));
          ctx.strokeStyle = C.INK;
          ctx.lineWidth = 3.2 * z;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
          ctx.strokeStyle = C.tint('#7a5230', flash);
          ctx.lineWidth = 1.6 * z;
          ctx.stroke();
        }
        ctx.fillStyle = C.tint(LEAF, flash);
        ctx.strokeStyle = 'rgba(20, 40, 10, 0.8)';
        ctx.lineWidth = Math.max(0.7, 0.7 * z);
        for (const [a, s, u, r] of [[-1, 6, 16, 0.4], [-8, -7, 15, -0.5], [-3, 1, 19.5, 0.1]]) {
          const q = cam.p(H(a, s, u));
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, 3.2 * z, 1.6 * z, r, 0, M.TAU);
          ctx.fill();
          ctx.stroke();
        }
      };
      const tooth = (p, tip, w) => {
        ctx.beginPath();
        ctx.moveTo(p.x - w * z, p.y);
        ctx.lineTo(p.x + w * z, p.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.closePath();
        ctx.fill();
      };
      // de frente: o cabelo de trás vai antes (a cabeça cobre); de costas, por cima da cabeça
      if (front) hair();
      // o queixo (amarelo: o papo) e, de boca aberta, o vermelho de dentro, a língua e os dentes de baixo
      const lowPts = [];
      for (const [a, w, , b] of SL.slice(1)) {
        const ww = w * 0.92;
        lowPts.push(J(a, -ww, -1.6), J(a, ww, -1.6), J(a, -ww * 0.8, b - 2.8 + a * 0.03), J(a, ww * 0.8, b - 2.8 + a * 0.03));
      }
      lowPts.push(J(-6, 0, -4.5), J(-6, -6, -3), J(-6, 6, -3));
      if (open) this._flat(ctx, cam, [H(-2, -7, -1.8), H(27, -4, -1.6), H(27, 4, -1.6), H(-2, 7, -1.8), J(-2, 7, -1.8), J(26, 3.5, -1.8), J(26, -3.5, -1.8), J(-2, -7, -1.8)], C.tint(MOUTH, flash));
      this._blob(ctx, cam, lowPts, LOOK.throat, small ? 0 : 2.6 * z, ink, flash, {
        inside: (c) => {
          if (!open) return;
          const tq = cam.p(J(12, 0, -1.6));
          c.fillStyle = C.tint(TONGUE, flash);
          c.beginPath();
          c.ellipse(tq.x, tq.y, 6 * S * z, 3 * S * z, 0, 0, M.TAU);
          c.fill();
        },
      });
      if (open) {
        ctx.fillStyle = C.tint(TOOTH, flash);
        for (const sg of [-1, 1]) for (const a of [8, 15, 22]) tooth(cam.p(J(a, sg * halfW(a) * 0.86, -1.6)), cam.p(J(a, sg * halfW(a) * 0.86, 0.8)), 1.2);
      }
      // o crânio e o focinho de cima (um volume só)
      const headPts = [];
      for (const [a, w, top, bot] of SL) {
        const mid = (top + bot) / 2, hh = (top - bot) / 2;
        for (let k = 0; k < 8; k++) {
          const ph = (k / 8) * M.TAU;
          headPts.push(H(a, Math.cos(ph) * w, mid + Math.sin(ph) * hh));
        }
      }
      this._blob(ctx, cam, headPts, LOOK.skin, small ? 0 : 3.6 * z, ink, flash, {
        inside: (cx) => {
          // as escamas: fileiras de risquinhos de lado no focinho
          if (!small) {
            cx.strokeStyle = 'rgba(30, 44, 10, 0.45)';
            cx.lineWidth = Math.max(0.8, 0.9 * z);
            cx.beginPath();
            for (const sg of [-1, 1]) {
              for (const a of [10, 15, 20, 25]) {
                const w = halfW(a);
                const p0 = cam.p(H(a, sg * w * 0.98, 0.6)), p1 = cam.p(H(a + 2.5, sg * w * 0.92, 1.6));
                cx.moveTo(p0.x, p0.y);
                cx.lineTo(p1.x, p1.y);
              }
            }
            cx.stroke();
          }
          // de boca fechada: a linha da boca (desce no canto: a cara de brava) do lado que a câmera vê, com os
          // dentinhos de cima
          if (open) return;
          for (const sg of [-1, 1]) {
            const n = M.add(M.scale(hs, sg), M.scale(hu, -0.2));
            if (M.dot(n, toCam) < -0.1) continue;
            cx.strokeStyle = C.INK;
            cx.lineWidth = Math.max(1, 1.1 * z);
            cx.beginPath();
            const line = [[-3, -3.2], [1, -2.2], [6, -1.7], [12, -1.5], [18, -1.4], [24, -1.3], [29, -1.2]].map(([a, u]) => cam.p(H(a, sg * halfW(a) * 0.99, u)));
            cx.moveTo(line[0].x, line[0].y);
            for (const p of line.slice(1)) cx.lineTo(p.x, p.y);
            cx.stroke();
            cx.fillStyle = C.tint(TOOTH, flash);
            for (const a of [8, 13, 18, 23]) tooth(cam.p(H(a, sg * halfW(a) * 0.99, -1.4)), cam.p(H(a, sg * halfW(a) * 0.99, -3.6)), 1.2);
          }
        },
      });
      if (open) {
        // os dentes de cima (para baixo), pela beirada do focinho
        ctx.fillStyle = C.tint(TOOTH, flash);
        for (const sg of [-1, 1]) for (const a of [6, 11, 16, 21, 26]) tooth(cam.p(H(a, sg * halfW(a) * 0.9, -1.6)), cam.p(H(a, sg * halfW(a) * 0.9, -4.2)), 1.3);
      }
      // a ponta do focinho (o calombo das narinas)
      this._blob(ctx, cam, ballPts([], H(28.5, 0, 2.5), 2.6 * S, 8), LOOK.skin, 0, ink, flash, {
        after: (c) => {
          if (small) return;
          c.fillStyle = DARK;
          for (const sg of [-1, 1]) {
            const q = cam.p(H(29.5, sg * 1.2, 4.4));
            c.beginPath();
            c.ellipse(q.x, q.y, 0.9 * z, 0.7 * z, 0, 0, M.TAU);
            c.fill();
          }
        },
      });
      // os calombos dos olhos (o de lá primeiro), cada um com o olho de fenda e a sobrancelha brava
      const bumps = [-1, 1].map((sg) => ({ sg, c: H(2, sg * 5.4, 5.9), n: M.norm(M.add(M.add(M.scale(hu, 0.55), M.scale(hs, sg * 0.7)), M.scale(hf, 0.45))) }));
      bumps.sort((p, q) => M.dot(p.c, toCam) - M.dot(q.c, toCam));
      for (const b of bumps) {
        const facing = M.dot(b.n, toCam);
        this._blob(ctx, cam, ballPts([], b.c, 3.3 * S, 8), LOOK.skin, small ? 0 : 1.6 * z, ink, flash, {
          after: (cx) => {
            if (facing < -0.2) return;
            const e = cam.p(M.add(b.c, M.scale(b.n, 2.6 * S)));
            const er = 2.3 * S * z;
            if (R.blink) {
              cx.strokeStyle = DARK;
              cx.lineWidth = Math.max(1, 1.2 * z);
              cx.beginPath();
              cx.moveTo(e.x - er, e.y);
              cx.lineTo(e.x + er, e.y);
              cx.stroke();
              return;
            }
            const b0 = cx.shadowBlur, s0 = cx.shadowColor;
            cx.fillStyle = EYE;
            cx.shadowColor = 'rgba(255, 220, 90, 0.55)';
            cx.shadowBlur = 3 * z;
            cx.beginPath();
            cx.ellipse(e.x, e.y, er, er * 0.85, 0, 0, M.TAU);
            cx.fill();
            cx.shadowBlur = b0;
            cx.shadowColor = s0;
            cx.fillStyle = DARK;
            cx.beginPath();
            cx.ellipse(e.x, e.y, er * 0.26, er * 0.82, 0, 0, M.TAU);
            cx.fill();
            cx.fillStyle = 'rgba(255, 255, 240, 0.85)';
            cx.beginPath();
            cx.arc(e.x - er * 0.35, e.y - er * 0.35, er * 0.22, 0, M.TAU);
            cx.fill();
          },
        });
        // a sobrancelha (a cara de ranzinza: grossa, branca, descendo para o meio), no alto do calombo
        const brow0 = cam.p(H(0.5, b.sg * 8.6, 9.2)), brow1 = cam.p(H(4.8, b.sg * 2.6, 9.4 - R.talking * 0.8));
        ctx.lineCap = 'round';
        ctx.strokeStyle = C.INK;
        ctx.lineWidth = 3.6 * z;
        ctx.beginPath();
        ctx.moveTo(brow0.x, brow0.y);
        ctx.lineTo(brow1.x, brow1.y);
        ctx.stroke();
        ctx.strokeStyle = C.tint(LOOK.hair.base, flash);
        ctx.lineWidth = 2 * z;
        ctx.stroke();
      }
      if (!front) hair();
      bun();
    }
  }

  C.define('cuca', Cuca);
})(window.PD = window.PD || {});
