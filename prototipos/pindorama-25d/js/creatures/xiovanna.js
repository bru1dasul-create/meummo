// Xiovanna, a vendedora da Budega (NPC "budega" em data/npcs.json; pedido do dono, com fotos de referência que NÃO
// ficam no repositório). Morena, black power grande e cacheado, flor de hibisco vermelha do lado direito, uniforme
// preto da Budega (jaqueta de zíper com capuz, o escudo dourado no peito e um emblema na manga), calça jeans escura e
// tênis branco. O corpo de gente do protótipo é o modelo único do herói, então ela tem o corpo próprio dela (15/11):
// as juntas saem do `parts` (que ainda monta as bolas antigas, usadas só para a sombra e para a caixa do desenho) e o
// `_paint` desenha gente de verdade por cima delas: tronco com cintura e ombros, braços com cotovelo, mãos com dedos,
// pernas e tênis, no traço do herói (contorno de tinta, cor chapada, sombra de um lado e luz do outro).
// Fica no balcão respirando e mudando o peso de perna. Vira para quem chega perto e acena; de vez em quando leva a mão
// ao cabelo; ao falar (balão), mexe a cabeça e a mão.
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  const { tube } = C;

  const COL = {
    skin: { base: '#9a6345', shade: '#6f4330', light: '#b98163' },
    hair: { base: '#2b1e19', shade: '#140d0a', light: '#4d372c' },
    jacket: { base: '#23232a', shade: '#121216', light: '#3d3d48' },
    jeans: { base: '#2f3c58', shade: '#1d263a', light: '#4a5b80' },
    shoe: { base: '#ece7dd', shade: '#bdb6a8', light: '#ffffff' },
    sole: { base: '#5a5048', shade: '#3a332e', light: '#7a6e64' },
    petal: { base: '#c8323a', shade: '#8e1f27', light: '#e8606a' },
    stamen: { base: '#f2c84b', shade: '#c79a22', light: '#fff0a8' },
  };
  const GOLD = '#e2b04a';
  const UP = { x: 0, y: 0, z: 1 };

  /** Cotovelo ou joelho entre a raiz e a ponta, dobrando para o lado de `hint`. */
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

  // pontos do black power numa casca (distribuição de Fibonacci), sorteados uma vez: o cabelo não muda de quadro a quadro
  const AFRO = (() => {
    const rnd = M.rng(7);
    const out = [];
    const n = 96;
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      out.push({ f: Math.cos(th) * r, s: Math.sin(th) * r, u: y, k: 0.82 + rnd() * 0.3 });
    }
    return out;
  })();

  class Xiovanna extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 24;
      this.top = 190;
      this.baseYaw = yaw;
      /** Gestos (0..1, suaves): aceno, mão no cabelo, fala; e para onde a cabeça olha (rad, além do corpo). */
      this.wave = 0;
      this.hair = 0;
      this.speak = 0;
      this.look = 0;
      this._waveUntil = 0;
      this._hairAt = 6 + this.seed * 6;
      this._hairUntil = 0;
      this._talkUntil = 0;
      this._heroWasNear = false;
      /** Para a prancha: força um gesto ({ wave, hair, speak, look }). */
      this.force = null;
    }

    talk(ms) {
      this._talkUntil = this.time + ms / 1000;
    }

    animate(dt) {
      const t = this.time;
      // vira para quem chega perto (o corpo até 45°, a cabeça mais um tanto) e acena na chegada
      let lookTarget = (M.noise1(t * 0.25 + this.seed * 9) - 0.5) * 0.9;
      let bodyTarget = this.baseYaw;
      const hero = this.near && this.near.hero;
      if (hero) {
        const dx = hero.x - this.pos.x, dy = hero.y - this.pos.y;
        const d = Math.hypot(dx, dy);
        if (d < 600) {
          const want = Math.atan2(dy, dx);
          const off = M.angleDiff(this.baseYaw, want);
          bodyTarget = this.baseYaw + M.clamp(off, -0.8, 0.8);
          lookTarget = M.clamp(M.angleDiff(bodyTarget, want), -0.9, 0.9);
        }
        const near = d < 400;
        if (near && !this._heroWasNear) this._waveUntil = t + 1.6;
        if (d > 700) this._heroWasNear = false;
        else if (near) this._heroWasNear = true;
      }
      this.yawTarget = bodyTarget;
      // mão no cabelo de vez em quando (não no meio de outro gesto)
      if (t > this._hairAt && t > this._waveUntil && t > this._talkUntil) {
        this._hairUntil = t + 2.2;
        this._hairAt = t + 9 + ((this.seed * 7 + t) % 6);
      }
      const f = this.force || {};
      this.wave = f.wave ?? M.damp(this.wave, t < this._waveUntil ? 1 : 0, 7, dt);
      this.hair = f.hair ?? M.damp(this.hair, t < this._hairUntil && t >= this._waveUntil ? 1 : 0, 5, dt);
      this.speak = f.speak ?? M.damp(this.speak, t < this._talkUntil ? 1 : 0, 6, dt);
      this.look = f.look ?? M.damp(this.look, lookTarget, 5, dt);
      this.label = this.wave > 0.5 ? 'acenando' : this.hair > 0.5 ? 'mão no cabelo' : this.speak > 0.5 ? 'falando' : 'parada';
    }

    parts(cam) {
      const t = this.time;
      const yaw = this.yaw;
      const fwd = { x: Math.cos(yaw), y: Math.sin(yaw), z: 0 };
      const side = { x: -fwd.y, y: fwd.x, z: 0 };
      const at = (a, s, z) => this.at(a, s, z);
      // peso de uma perna para a outra e a respiração
      const sway = Math.sin(t * 0.55 + this.seed * 4) * 1.6;
      const breath = Math.sin(t * 2.2 + this.seed * 3) * 0.5;
      const nod = this.speak * Math.sin(t * 7) * 0.06;

      /** As juntas deste quadro, para o `_paint` (o corpo de gente). */
      const J = (this._j = { t, yaw, fwd, side, sway, breath, legs: [], arms: [] });
      const groups = [];
      const g = (balls, ref, extra) => {
        const grp = { balls, ref, ...(extra || {}) };
        groups.push(grp);
        return grp;
      };

      // ---- pernas (calça jeans) e tênis
      for (const sg of [-1, 1]) {
        const hip = at(0, 9 * sg + sway, 84);
        const ankle = at(0, 9 * sg, 8);
        const knee = bend(hip, ankle, 39, 38, M.add(fwd, { x: 0, y: 0, z: 0.1 }));
        J.legs.push({ sg, hip, knee, ankle });
        const leg = [];
        tube(hip, knee, 6.8, 5.6, COL.jeans, leg);
        tube(knee, ankle, 5.5, 4.3, COL.jeans, leg);
        g(leg, knee);
        const foot = (a, z, r, col) => ({ c: M.add(ankle, M.add(M.scale(fwd, a), { x: 0, y: 0, z: z - 8 })), r, col });
        g([foot(-2.5, 2.2, 4.9, COL.sole), foot(2.5, 2, 4.7, COL.sole), foot(7.5, 1.9, 4.2, COL.sole)], foot(2, 2, 1, COL.sole).c, { bias: -0.3, matte: true });
        g([foot(-2.5, 4.6, 4.6, COL.shoe), foot(2.5, 4.3, 4.4, COL.shoe), foot(7.5, 3.9, 3.9, COL.shoe)], foot(2, 4, 1, COL.shoe).c);
      }

      // ---- quadril (calça) e tronco (jaqueta), com o capuz atrás do pescoço
      const pelvis = at(0, sway * 0.6, 90);
      g([{ c: at(-1, 6.2 + sway * 0.6, 87.5), r: 11, col: COL.jeans }, { c: at(-1, -6.2 + sway * 0.6, 87.5), r: 11, col: COL.jeans }, { c: at(0.5, sway * 0.6, 90), r: 11.5, col: COL.jeans }], pelvis);
      const waist = at(0.5, sway * 0.3, 103);
      const chest = at(1, 0, 120 + breath);
      const torso = [{ c: at(0.5, sway * 0.5, 94.5), r: 13.6, col: COL.jacket }];
      tube(waist, chest, 12, 14, COL.jacket, torso);
      torso.push({ c: at(5.5, 5.2, 119 + breath), r: 7.2, col: COL.jacket }, { c: at(5.5, -5.2, 119 + breath), r: 7.2, col: COL.jacket });
      const torsoN = fwd;
      const decals = [
        // zíper no meio da frente
        { c: M.add(M.lerp3(waist, chest, 0.5), M.scale(torsoN, 12.6)), n: torsoN, u: side, v: UP, ru: 0.45, rv: 12, color: '#9a9aa6', minFacing: 0.1 },
        // o escudo da Budega no peito (lado esquerdo dela)
        { c: M.add(chest, M.add(M.scale(fwd, 12.2), M.add(M.scale(side, -6), { x: 0, y: 0, z: 2.5 }))), n: M.norm(M.add(fwd, M.scale(side, -0.4))), u: M.norm(M.add(side, M.scale(fwd, 0.4))), v: UP, ru: 3.6, rv: 4.4, color: GOLD, shape: 'shield', minFacing: 0.08 },
      ];
      g(torso, M.lerp3(waist, chest, 0.5), { body: true, decals });
      g([{ c: at(-7, 5, 136), r: 6.6, col: COL.jacket }, { c: at(-7, -5, 136), r: 6.6, col: COL.jacket }, { c: at(-8.5, 0, 138.5), r: 7, col: COL.jacket }], at(-8, 0, 137), { bias: -1 });

      // ---- pescoço e cabeça (olhando para quem está perto)
      const neckBase = at(0, 0, 134 + breath);
      const neckTop = at(1, 0, 143 + breath);
      g(tube(neckBase, neckTop, 5.4, 5, COL.skin), neckBase, { bias: -0.5 });
      const hy = yaw + this.look;
      const fh = M.norm({ x: Math.cos(hy), y: Math.sin(hy), z: -nod });
      const sh = { x: -Math.sin(hy), y: Math.cos(hy), z: 0 };
      const uh = M.norm(M.cross(fh, sh));
      const rh = 12;
      const hc = at(1.5, 0, 154 + breath);
      const H = (f, s, u) => M.add(hc, M.add(M.scale(fh, f * rh), M.add(M.scale(sh, s * rh), M.scale(uh, u * rh))));
      g([{ c: hc, r: rh, col: COL.skin }, { c: H(0.18, 0, -0.42), r: 0.8 * rh, col: COL.skin }], hc, { body: true, decals: this._face(hc, rh, fh, sh, uh) });
      Object.assign(J, { neckBase, neckTop, hc, rh, fh, sh, uh, H });

      // ---- black power: nuvem de cachos em volta da cabeça, com um buraco no rosto (a borda da frente faz a linha do
      // cabelo na testa)
      const ac = H(-0.28, 0, 0.42);
      // enchimento do meio, bem atrás e no alto (mais à frente, visto de cima ele cobria os olhos)
      const afro = [{ c: H(-1.1, 0, 0.6), r: 0.9 * rh, col: COL.hair }];
      for (const p of AFRO) {
        // a câmera olha de cima: o que fica na frente da cabeça cai sobre o rosto. Fica um halo dos lados e em cima
        if (p.f > 0 && Math.abs(p.s) < 0.62 && p.u < 0.88) continue; // a coluna da frente (testa, olhos, boca)
        if (p.f > 0.4 && p.u < 0.5) continue; // frente de baixo (rosto e queixo)
        if (p.u < -0.42 && p.f > -0.35) continue; // embaixo do queixo
        const c = M.add(ac, M.add(M.scale(fh, p.f * 1.95 * rh), M.add(M.scale(sh, p.s * 2.25 * rh), M.scale(uh, p.u * 1.85 * rh))));
        afro.push({ c, r: 0.5 * rh * p.k, col: COL.hair });
      }
      // cachos colados no alto da cabeça (a linha do cabelo, acima das sobrancelhas): sem eles a testa ficava careca
      for (let k = -3; k <= 3; k++) {
        const a = Math.abs(k);
        afro.push({ c: H((0.5 - a * 0.06) * 1.03, k * 0.2 * 1.03, (0.79 - a * 0.03) * 1.03), r: 0.29 * rh, col: COL.hair });
        afro.push({ c: H(0.15 * 1.05, k * 0.25 * 1.05, 0.97 * 1.05), r: 0.36 * rh, col: COL.hair });
      }
      // o que fica atrás da cabeça (pela câmera) vai antes dela; o resto (lados, em cima, nuca de perfil), depois
      const depth = (p) => cam.depth(p);
      const cut = depth(hc) - 0.4 * rh;
      const afroBack = afro.filter((b) => depth(b.c) < cut);
      const afroFront = afro.filter((b) => depth(b.c) >= cut);
      g(afroBack, hc, { bias: -2 });
      g(afroFront, hc, { bias: 2 });
      Object.assign(J, { afroBack, afroFront, ac });
      // flor de hibisco do lado direito dela, presa no cabelo
      const fc = M.add(ac, M.add(M.scale(fh, 0.5 * rh), M.add(M.scale(sh, 2.05 * rh), M.scale(uh, 0.5 * rh))));
      const fn = M.norm(M.sub(fc, ac));
      const flowerSeen = fn.x * cam.toCamera.x + fn.y * cam.toCamera.y + fn.z * cam.toCamera.z > 0.02;
      const fu = M.norm(M.cross(fn, UP), sh);
      const fv = M.norm(M.cross(fu, fn));
      const petals = [];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * M.TAU + 0.3;
        petals.push({ c: M.add(fc, M.add(M.scale(fu, Math.cos(a) * 3.4), M.add(M.scale(fv, Math.sin(a) * 3.4), M.scale(fn, 1)))), r: 2.9, col: COL.petal });
      }
      petals.push({ c: M.add(fc, M.scale(fn, 2.6)), r: 1.3, col: COL.stamen });
      g(petals, hc, { bias: flowerSeen ? 3 : -4, noShadow: true });
      Object.assign(J, { petals, flowerSeen });

      // ---- braços (mangas da jaqueta) e mãos: acena com a esquerda, leva a direita ao cabelo, gesticula falando
      for (const sg of [-1, 1]) {
        const sh0 = at(-0.5, 16.5 * sg, 130 + breath);
        let hand = at(4, 16 * sg + sway * 0.3, 84);
        let hint = M.add(M.scale(fwd, -0.6), M.add(M.scale(side, 0.6 * sg), { x: 0, y: 0, z: -0.2 }));
        if (sg < 0 && this.wave > 0.001) {
          const wv = at(5, -25 + Math.sin(t * 9) * 6, 160);
          hand = M.lerp3(hand, wv, M.smoothstep(0, 1, this.wave));
          hint = M.lerp3(hint, M.add(M.scale(side, -1), { x: 0, y: 0, z: -0.5 }), this.wave);
        }
        if (sg > 0 && this.hair > 0.001) {
          const hp = M.add(ac, M.add(M.scale(sh, 1.75 * rh), M.add(M.scale(uh, 0.05 * rh), M.scale(fh, -0.2 * rh))));
          hand = M.lerp3(hand, hp, M.smoothstep(0, 1, this.hair));
          hint = M.lerp3(hint, M.add(M.scale(side, 1), { x: 0, y: 0, z: 0.7 }), this.hair);
        }
        if (sg > 0 && this.speak > 0.001 && this.hair < 0.5) {
          const sp = at(19, 12, 108 + Math.sin(t * 6) * 3);
          hand = M.lerp3(hand, sp, this.speak * (1 - this.hair));
        }
        const elbow = bend(sh0, hand, 26, 23, hint);
        J.arms.push({ sg, sh0, elbow, hand, open: sg < 0 ? this.wave : 0 });
        const arm = [];
        tube(sh0, elbow, 5.6, 4.7, COL.jacket, arm);
        tube(elbow, hand, 4.6, 3.9, COL.jacket, arm);
        const dirF = M.norm(M.sub(hand, elbow));
        arm.push({ c: M.add(hand, M.scale(dirF, 3.2)), r: 4.2, col: COL.skin });
        const armDecals = [];
        if (sg > 0) {
          // emblema dourado na manga direita
          const mid = M.lerp3(sh0, elbow, 0.45);
          armDecals.push({ c: M.add(mid, M.scale(side, 5.2)), n: side, u: M.norm(M.sub(elbow, sh0)), v: fwd, ru: 2.2, rv: 2.2, color: GOLD, minFacing: 0.1 });
        }
        g(arm, M.lerp3(elbow, hand, 0.4), { decals: armDecals, bias: 1.5 * (sg === nearSide(cam, side) ? 1 : -1) });
      }

      this.top = (ac.z - this.groundZ) + 1.85 * rh + 4;
      return { groups };
    }

    /** A peça para a PD.World: a sombra e as caixas das bolas (como as criaturas), o desenho de gente por cima. */
    drawable(cam, primary) {
      const d = super.drawable(cam, primary);
      d.draw = (ctx) => this._paint(ctx, cam);
      return d;
    }

    /**
     * O corpo de gente: cada parte é um conjunto de formas (cápsulas e contornos) com a cor dela; as partes são
     * desenhadas de trás para a frente (pela profundidade da câmera), cada uma com o contorno de tinta em volta do
     * conjunto todo, a sombra de um lado, a luz do outro e os detalhes por cima.
     */
    _paint(ctx, cam) {
      const J = this._j;
      if (!J) return;
      const z = cam.zoom;
      const iw = Math.max(1, 1.05 * z);
      const P = (p) => cam.p(p);
      const { fwd, side, sway, breath, t } = J;
      const at = (a, sd, zz) => this.at(a, sd, zz);
      const TC = cam.toCamera;
      const facing = (n) => n.x * TC.x + n.y * TC.y + n.z * TC.z;
      const parts = [];
      const part = (ref, bias, shapes, after) => parts.push({ key: cam.depth(ref) + bias * 6, shapes, after });
      const cap = (a, b, ra, rb, col) => ({ path: capsule(P(a), P(b), ra * z, rb * z), col, r: Math.max(ra, rb) * z });
      const ball = (c, r, col) => {
        const q = P(c);
        const path = new Path2D();
        path.arc(q.x, q.y, r * z, 0, M.TAU);
        return { path, col, r: r * z };
      };
      const line = (pts, color, width, alpha = 1) => {
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach((p, i) => {
          const q = P(p);
          if (i === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        });
        ctx.stroke();
        ctx.restore();
      };
      /** Desenha em centímetros num plano do corpo: `c` o meio, `u` para a direita e `v` para cima (vetores do mundo). */
      const onPlane = (c, u, v, fn) => {
        const o = P(c);
        const pu = P(M.add(c, u));
        const pv = P(M.add(c, v));
        ctx.save();
        ctx.transform(pu.x - o.x, pu.y - o.y, -(pv.x - o.x), -(pv.y - o.y), o.x, o.y);
        fn();
        ctx.restore();
      };

      // ---- o tronco: fatias (altura, meia largura de lado, meia largura de frente) ligadas num contorno só
      const sideOff = (zz) => sway * 0.6 * M.clamp((122 - zz) / 36, 0, 1);
      const lift = (zz) => (zz > 108 ? breath * M.clamp((zz - 108) / 14, 0, 1) : 0);
      const psd = cam.p({ x: side.x, y: side.y, z: 0 });
      const pfw = cam.p({ x: fwd.x, y: fwd.y, z: 0 });
      const slice = (zz, a, b) => {
        const c = P(at(0.5, sideOff(zz), zz + lift(zz)));
        const A = a * psd.x, B = b * pfw.x;
        const R = Math.hypot(A, B) || 1e-3;
        const yo = (a * psd.y * A + b * pfw.y * B) / R;
        return { l: { x: c.x - R, y: c.y - yo }, r: { x: c.x + R, y: c.y + yo } };
      };
      const outline = (rows) => {
        const sl = rows.map(([zz, a, b]) => slice(zz, a, b));
        const pts = sl.map((s0) => s0.l).concat(sl.map((s0) => s0.r).reverse());
        const path = new Path2D();
        const n = pts.length;
        const mid = (i) => ({ x: (pts[i % n].x + pts[(i + 1) % n].x) / 2, y: (pts[i % n].y + pts[(i + 1) % n].y) / 2 });
        const m0 = mid(n - 1);
        path.moveTo(m0.x, m0.y);
        for (let i = 0; i < n; i++) {
          const m = mid(i);
          path.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
        }
        path.closePath();
        return path;
      };
      const JACKET = [[90, 14.4, 10.4], [95, 14, 10.2], [101, 12.2, 9.2], [106, 11.2, 8.8], [112, 12, 9.6], [119, 13.4, 11], [125, 14.4, 10.2], [130, 15.2, 9], [134, 13, 7.6], [137.5, 7.5, 6.4]];
      const PELVIS = [[76, 12.4, 9.4], [82, 14.2, 10.2], [88, 14.8, 10.6], [94, 13.4, 9.8]];
      /** A meia largura de lado e de frente do tronco numa altura (para pôr os detalhes em cima do pano). */
      const girth = (zz) => {
        let i = 0;
        while (i < JACKET.length - 2 && JACKET[i + 1][0] < zz) i++;
        const [z0, a0, b0] = JACKET[i], [z1, a1, b1] = JACKET[i + 1];
        const k = M.clamp((zz - z0) / (z1 - z0), 0, 1);
        return { a: a0 + (a1 - a0) * k, b: b0 + (b1 - b0) * k };
      };
      /** Um ponto na frente da jaqueta: `sd` para o lado (cm) e a altura. */
      const front = (sd, zz, out = 0.3) => {
        const gi = girth(zz);
        const k = Math.sqrt(Math.max(0, 1 - (sd / gi.a) ** 2));
        return at(0.5 + gi.b * k + out, sideOff(zz) + sd, zz + lift(zz));
      };
      const frontSeen = facing(fwd);

      // ---- pernas (calça jeans) e tênis
      for (const leg of J.legs) {
        const { hip, knee, ankle, sg } = leg;
        const shoe = (a, zz) => M.add(ankle, M.add(M.scale(fwd, a), { x: 0, y: 0, z: zz - 8 }));
        part(shoe(3, 2), -0.4, [cap(shoe(-3.6, 2.1), shoe(9.4, 1.9), 4.5, 3.7, COL.sole)]);
        part(shoe(3, 5), 0, [cap(shoe(-3.4, 5), shoe(8.8, 4.2), 4.5, 3.5, COL.shoe)], () => {
          // a lingueta e os cadarços
          if (frontSeen > -0.2) for (const a of [2.5, 4.6, 6.6]) line([M.add(shoe(a, 8.2 - a * 0.42), M.scale(side, -2)), M.add(shoe(a, 8.2 - a * 0.42), M.scale(side, 2))], '#8d8678', Math.max(0.8, 0.7 * z));
        });
        part(knee, -0.2, [cap(hip, knee, 7.6, 6, COL.jeans), cap(knee, ankle, 5.9, 4.3, COL.jeans)], () => {
          // a barra dobrada e a costura de fora
          const hem = M.lerp3(knee, ankle, 0.93);
          line([M.add(hem, M.scale(side, -4)), M.add(hem, M.scale(side, 4))], COL.jeans.light, Math.max(1, 1.5 * z), 0.9);
          line([M.add(hip, M.scale(side, 6.6 * sg)), M.add(knee, M.scale(side, 5.2 * sg)), M.add(ankle, M.scale(side, 3.8 * sg))], COL.jeans.shade, Math.max(0.7, 0.6 * z), 0.7);
        });
      }

      // ---- o quadril (calça) e o tronco (a jaqueta do uniforme)
      part(at(0, 0, 86), -0.1, [{ path: outline(PELVIS), col: COL.jeans, r: 13 * z }]);
      // (o ombro de gente fica mais para dentro e mais baixo que a junta das bolas antigas)
      for (const a of J.arms) a.shoulder = M.add(a.sh0, M.add(M.scale(side, -3.2 * a.sg), { x: 0, y: 0, z: -3.2 }));
      const shoulders = J.arms.map((a) => ball(a.shoulder, 5.2, COL.jacket));
      part(at(0.5, 0, 112), 0, [{ path: outline(JACKET), col: COL.jacket, r: 13 * z }, ...shoulders], () => {
        if (frontSeen > -0.25) {
          const fade = M.clamp((frontSeen + 0.25) / 0.3, 0, 1);
          ctx.save();
          ctx.globalAlpha *= fade;
          // a gola aberta (a pele do colo) e as duas abas
          const o = P(front(0, 126.5, 0.4)), l = P(front(-4.6, 136, 0.2)), r = P(front(4.6, 136, 0.2));
          ctx.beginPath();
          ctx.moveTo(l.x, l.y);
          ctx.lineTo(o.x, o.y);
          ctx.lineTo(r.x, r.y);
          ctx.closePath();
          ctx.fillStyle = COL.skin.shade;
          ctx.fill();
          ctx.strokeStyle = COL.jacket.light;
          ctx.lineWidth = Math.max(1.2, 1.7 * z);
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(l.x, l.y);
          ctx.lineTo(o.x, o.y);
          ctx.lineTo(r.x, r.y);
          ctx.stroke();
          ctx.restore();
          // o zíper, do colo até a barra, com o puxador
          const zip = [];
          for (let zz = 126; zz >= 91; zz -= 5) zip.push(front(0, zz, 0.4));
          line(zip, '#9c9ca8', Math.max(0.9, 0.9 * z), fade);
          line([front(0, 126, 0.5), front(0.3, 123.4, 0.6)], '#d9d9e2', Math.max(1.2, 1.5 * z), fade);
          // a curva do busto, a cintura e os bolsos
          line([front(-9.5, 117.5), front(-5, 114.6), front(-1.2, 115.6)], COL.jacket.shade, Math.max(0.9, 1.1 * z), 0.9 * fade);
          line([front(9.5, 117.5), front(5, 114.6), front(1.2, 115.6)], COL.jacket.shade, Math.max(0.9, 1.1 * z), 0.9 * fade);
          for (const sg of [-1, 1]) line([front(5.5 * sg, 101), front(9.2 * sg, 96.5)], COL.jacket.light, Math.max(0.8, 0.9 * z), 0.8 * fade);
          line([front(-12, 92.2), front(-6, 91.6), front(0, 91.5), front(6, 91.6), front(12, 92.2)], COL.jacket.light, Math.max(0.8, 0.9 * z), 0.6 * fade);
          // o escudo dourado da Budega no peito (lado esquerdo dela)
          const sc = front(-6.6, 122.5, 0.5);
          const sn = M.norm(M.add(fwd, M.scale(side, -0.45)));
          if (facing(sn) > 0.08) {
            onPlane(sc, M.norm(M.add(side, M.scale(fwd, 0.45))), UP, () => {
              const shield = new Path2D();
              shield.moveTo(-3.3, -4.2);
              shield.lineTo(3.3, -4.2);
              shield.lineTo(3.3, 0.4);
              shield.quadraticCurveTo(3.1, 3.4, 0, 4.8);
              shield.quadraticCurveTo(-3.1, 3.4, -3.3, 0.4);
              shield.closePath();
              ctx.fillStyle = GOLD;
              ctx.fill(shield);
              ctx.lineWidth = 0.5;
              ctx.strokeStyle = '#5a3d0c';
              ctx.stroke(shield);
              ctx.fillStyle = '#5a3d0c';
              ctx.fillRect(-2, -1.6, 4, 0.9);
              ctx.fillRect(-1.4, 0.4, 2.8, 0.7);
            });
          }
        }
      });
      // o capuz, caído atrás do pescoço
      part(at(-9, 0, 137), -1, [ball(at(-7.2, 5, 135.5 + breath), 6.4, COL.jacket), ball(at(-7.2, -5, 135.5 + breath), 6.4, COL.jacket), ball(at(-8.8, 0, 138 + breath), 7, COL.jacket)], () => {
        if (frontSeen < 0.1) line([at(-13.5, -5, 139 + breath), at(-15, 0, 137 + breath), at(-13.5, 5, 139 + breath)], COL.jacket.light, Math.max(0.8, 0.9 * z), 0.7);
      });

      // ---- o pescoço
      part(J.neckBase, -0.5, [cap(J.neckBase, J.neckTop, 5, 4.6, COL.skin)]);

      // ---- os braços (as mangas da jaqueta) e as mãos
      for (const arm of J.arms) {
        const { elbow, hand, sg, open } = arm;
        const sh0 = arm.shoulder;
        const dirF = M.norm(M.sub(hand, elbow));
        const wrist = M.add(hand, M.scale(dirF, -1.5));
        // a mão: a palma e os dedos (abertos no aceno, juntos no resto), no plano da palma
        let lat = M.cross(dirF, open > 0.3 ? fwd : M.scale(side, sg));
        lat = M.len(lat) > 0.2 ? M.norm(lat) : fwd;
        const knuckle = M.add(hand, M.scale(dirF, 4.6));
        const spread = 0.07 + 0.2 * open;
        const reach = 5.4 + 1.2 * open;
        const shapes = [cap(wrist, knuckle, 3, 3.5, COL.skin)];
        for (let k = 0; k < 4; k++) {
          const off = k - 1.5;
          const base = M.add(knuckle, M.scale(lat, off * 1.7));
          const dir = M.norm(M.add(dirF, M.scale(lat, off * spread)));
          shapes.push(cap(base, M.add(base, M.scale(dir, reach * (k === 0 || k === 3 ? 0.84 : 1))), 1.25, 1.05, COL.skin));
        }
        const thumbBase = M.add(hand, M.add(M.scale(dirF, 1.6), M.scale(lat, -3.2)));
        shapes.push(cap(thumbBase, M.add(thumbBase, M.scale(M.norm(M.add(dirF, M.scale(lat, -0.9 - 0.4 * open))), 4.4)), 1.45, 1.2, COL.skin));
        const mid = M.lerp3(elbow, hand, 0.4);
        const near = sg === nearSide(cam, side) ? 1 : -1;
        part(M.add(hand, M.scale(dirF, 4)), 1.5 * near + 0.2, shapes);
        part(mid, 1.5 * near, [cap(sh0, elbow, 5, 4.6, COL.jacket), cap(elbow, wrist, 4.7, 3.9, COL.jacket)], () => {
          // o punho de malha e as dobras do cotovelo
          const cuff = M.lerp3(elbow, wrist, 0.86);
          const across = M.norm(M.cross(dirF, TC));
          line([M.add(cuff, M.scale(across, -3.6)), M.add(cuff, M.scale(across, 3.6))], COL.jacket.light, Math.max(0.9, 1.2 * z), 0.9);
          const el = M.norm(M.cross(M.norm(M.sub(elbow, sh0)), TC));
          line([M.add(elbow, M.scale(el, -3.4)), M.add(M.lerp3(elbow, sh0, 0.08), M.scale(el, 0.5))], COL.jacket.shade, Math.max(0.8, 0.9 * z), 0.9);
          // o emblema dourado na manga direita
          if (sg > 0 && facing(side) > 0.15) {
            const em = M.add(M.lerp3(sh0, elbow, 0.42), M.scale(side, 5.4));
            onPlane(em, fwd, UP, () => {
              ctx.fillStyle = GOLD;
              ctx.beginPath();
              ctx.arc(0, 0, 2.2, 0, M.TAU);
              ctx.fill();
              ctx.lineWidth = 0.45;
              ctx.strokeStyle = '#5a3d0c';
              ctx.stroke();
            });
          }
        });
      }

      // ---- a cabeça: o crânio e o queixo, as orelhas com a argola, o rosto
      const { hc, rh, fh, sh, uh, H } = J;
      const headShapes = [ball(hc, rh, COL.skin), ball(H(0.2, 0, -0.44), 0.78 * rh, COL.skin)];
      for (const sg of [-1, 1]) headShapes.push(ball(H(-0.05, 0.97 * sg, -0.12), 0.2 * rh, COL.skin));
      part(hc, 0, headShapes, () => {
        for (const sg of [-1, 1]) {
          const n = M.scale(sh, sg);
          if (facing(n) < 0.05) continue;
          const e = P(H(-0.02, 1.08 * sg, -0.42));
          ctx.strokeStyle = GOLD;
          ctx.lineWidth = Math.max(0.9, 0.9 * z);
          ctx.beginPath();
          ctx.arc(e.x, e.y, 2 * z, 0, M.TAU);
          ctx.stroke();
        }
        for (const d of this._face(hc, rh, fh, sh, uh)) {
          const f = facing(d.n);
          if (f < 0.06) continue;
          ctx.save();
          ctx.globalAlpha *= M.clamp((f - 0.06) / 0.2, 0, 1) * (d.alpha ?? 1);
          onPlane(d.c, d.u, d.v, () => {
            if (d.rot) ctx.rotate(-d.rot);
            if (d.lid) {
              // o delineado: um arco grosso em cima do olho, com a ponta puxada para fora (o gatinho)
              ctx.strokeStyle = d.color;
              ctx.lineWidth = d.rv * 0.42;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.ellipse(0, 0, d.ru, d.rv, 0, Math.PI * 1.02, Math.PI * 1.98);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(d.lid * d.ru * 0.96, -d.rv * 0.2);
              ctx.lineTo(d.lid * d.ru * 1.34, -d.rv * 0.75);
              ctx.stroke();
              return;
            }
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, d.ru, d.rv, 0, 0, M.TAU);
            ctx.fill();
          });
          ctx.restore();
        }
      });

      // ---- o black power (atrás e na frente da cabeça) e a flor de hibisco
      const curls = (list) => list.map((b) => ball(b.c, b.r, COL.hair));
      const sheen = (list) => () => {
        ctx.save();
        ctx.strokeStyle = COL.hair.light;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.8, 0.9 * z);
        list.forEach((b, i) => {
          if (i % 2) return;
          const q = P(b.c);
          const r = b.r * z * 0.55;
          ctx.globalAlpha = 0.5 + 0.3 * ((i * 7) % 3) / 2;
          ctx.beginPath();
          ctx.arc(q.x - r * 0.25, q.y - r * 0.3, r, Math.PI * 1.05, Math.PI * 1.6);
          ctx.stroke();
        });
        ctx.restore();
      };
      if (J.afroBack.length) part(hc, -2, curls(J.afroBack), sheen(J.afroBack));
      if (J.afroFront.length) part(hc, 2, curls(J.afroFront), sheen(J.afroFront));
      part(hc, J.flowerSeen ? 3 : -4, J.petals.map((b) => ball(b.c, b.r, b.col)));

      // ---- pinta tudo, de trás para a frente
      parts.sort((a, b) => a.key - b.key);
      ctx.save();
      ctx.lineJoin = 'round';
      for (const pt of parts) {
        ctx.strokeStyle = C.INK;
        ctx.lineWidth = iw * 2;
        for (const s0 of pt.shapes) ctx.stroke(s0.path);
        for (const s0 of pt.shapes) cel(ctx, s0.path, s0.col, s0.r);
        if (pt.after) pt.after();
      }
      ctx.restore();
    }

    /** Rosto: olhos castanhos com o traço de delineado, sobrancelhas arqueadas, nariz e lábios cheios. */
    _face(hc, rh, fh, sh, uh) {
      const on = (f, s, u, k = 1) => {
        const n = M.norm(M.add(M.scale(fh, f), M.add(M.scale(sh, s), M.scale(uh, u))));
        return { c: M.add(hc, M.scale(n, rh * k)), n };
      };
      const tangent = (n) => {
        const u = M.norm(M.sub(sh, M.scale(n, M.dot(sh, n))));
        const v = M.norm(M.cross(u, n));
        return { u, v: v.z < 0 ? M.scale(v, -1) : v };
      };
      const d = (p, extra) => ({ ...p, ...tangent(p.n), ...extra });
      const out = [];
      for (const sg of [-1, 1]) {
        out.push(d(on(0.84, 0.37 * sg, 0.1, 0.985), { ru: 0.2 * rh, rv: 0.15 * rh, color: '#f7f1e8' }));
        out.push(d(on(0.86, 0.36 * sg, 0.1, 0.99), { ru: 0.125 * rh, rv: 0.135 * rh, color: '#4a2c1a' }));
        out.push(d(on(0.87, 0.36 * sg, 0.1, 0.995), { ru: 0.065 * rh, rv: 0.07 * rh, color: '#120a07' }));
        out.push(d(on(0.87, 0.33 * sg, 0.15, 1), { ru: 0.036 * rh, rv: 0.036 * rh, color: '#fff8ee' }));
        out.push(d(on(0.84, 0.37 * sg, 0.1, 0.992), { ru: 0.215 * rh, rv: 0.165 * rh, color: '#1b100d', lid: sg }));
        out.push(d(on(0.78, 0.37 * sg, 0.43, 0.99), { ru: 0.2 * rh, rv: 0.042 * rh, rot: -0.14 * sg, color: '#24170f' }));
        out.push(d(on(0.78, 0.56 * sg, -0.2, 0.99), { ru: 0.17 * rh, rv: 0.1 * rh, color: '#c0604a', alpha: 0.3 }));
      }
      out.push(d(on(0.97, 0, -0.14, 1.0), { ru: 0.07 * rh, rv: 0.085 * rh, color: '#7a4a33' }));
      out.push(d(on(0.97, 0.02, -0.09, 1.01), { ru: 0.028 * rh, rv: 0.05 * rh, color: '#c08a6a' }));
      const open = this.speak * Math.abs(Math.sin(this.time * 9));
      out.push(d(on(0.9, 0, -0.4, 0.99), { ru: 0.18 * rh, rv: 0.06 * rh, color: '#8a3a44' }));
      out.push(d(on(0.88, 0, -0.5, 0.985), { ru: 0.16 * rh, rv: (0.075 + 0.03 * open) * rh, color: '#a84f5a' }));
      out.push(d(on(0.9, 0, -0.445, 0.995), { ru: 0.16 * rh, rv: (0.014 + 0.05 * open) * rh, color: '#3e1c20' }));
      out.push(d(on(0.88, -0.05, -0.52, 0.99), { ru: 0.05 * rh, rv: 0.022 * rh, color: '#e2a9a6', alpha: 0.75 }));
      return out;
    }
  }

  /** Uma cápsula na tela (dois círculos ligados): um pedaço de braço, de perna, um dedo. */
  function capsule(a, b, ra, rb) {
    const path = new Path2D();
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    path.arc(a.x, a.y, ra, ang + Math.PI / 2, ang + (3 * Math.PI) / 2);
    path.arc(b.x, b.y, rb, ang - Math.PI / 2, ang + Math.PI / 2);
    path.closePath();
    return path;
  }

  /** A luz vem do alto à esquerda (na tela). */
  const LIGHT = { x: -0.62, y: -0.78 };
  /** Pinta uma forma no traço do herói: a sombra do lado de lá, a cor no meio e um fio de luz do lado da luz. */
  function cel(ctx, path, col, r) {
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = col.shade;
    ctx.fill(path);
    ctx.translate(LIGHT.x * r * 0.36, LIGHT.y * r * 0.36);
    ctx.fillStyle = col.base;
    ctx.fill(path);
    ctx.translate(LIGHT.x * r * 1.2, LIGHT.y * r * 1.2);
    ctx.globalAlpha *= 0.6;
    ctx.fillStyle = col.light;
    ctx.fill(path);
    ctx.restore();
  }

  /** Qual lado do corpo (+1 direita, -1 esquerda) está virado para a câmera. */
  function nearSide(cam, side) {
    return side.x * cam.toCamera.x + side.y * cam.toCamera.y >= 0 ? 1 : -1;
  }

  C.define('budega', Xiovanna);
  PD.Xiovanna = Xiovanna;
})(window.PD = window.PD || {});
