// Xiovanna, a vendedora da Budega (NPC "budega" em data/npcs.json; pedido do dono, com fotos de referência que NÃO
// ficam no repositório). Morena, black power grande e cacheado, flor de hibisco vermelha do lado direito, uniforme
// preto da Budega (jaqueta de zíper com capuz, o escudo dourado no peito e um emblema na manga), calça jeans escura e
// tênis. Feita com bolas, como as criaturas: o corpo de gente do protótipo é o modelo único do herói.
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
        out.push(d(on(0.86, 0.33 * sg, 0.18, 0.985), { ru: 0.17 * rh, rv: 0.11 * rh, color: '#f5efe6' }));
        out.push(d(on(0.88, 0.32 * sg, 0.17, 0.99), { ru: 0.095 * rh, rv: 0.105 * rh, color: '#3a2418' }));
        out.push(d(on(0.89, 0.32 * sg, 0.17, 0.995), { ru: 0.045 * rh, rv: 0.05 * rh, color: '#120a07' }));
        out.push(d(on(0.89, 0.3 * sg, 0.21, 1), { ru: 0.025 * rh, rv: 0.025 * rh, color: '#fff8ee' }));
        out.push(d(on(0.85, 0.35 * sg, 0.27, 0.99), { ru: 0.2 * rh, rv: 0.035 * rh, rot: -0.18 * sg, color: '#1b100d' }));
        out.push(d(on(0.8, 0.33 * sg, 0.46, 0.99), { ru: 0.17 * rh, rv: 0.034 * rh, rot: -0.1 * sg, color: '#24170f' }));
      }
      out.push(d(on(0.97, 0, -0.06, 1.0), { ru: 0.075 * rh, rv: 0.11 * rh, color: '#7a4a33' }));
      out.push(d(on(0.97, 0.02, 0.0, 1.01), { ru: 0.03 * rh, rv: 0.06 * rh, color: '#c08a6a' }));
      out.push(d(on(0.92, 0, -0.3, 0.99), { ru: 0.17 * rh, rv: 0.05 * rh, color: '#7d4440' }));
      out.push(d(on(0.9, 0, -0.38, 0.985), { ru: 0.16 * rh, rv: 0.065 * rh, color: '#955450' }));
      out.push(d(on(0.92, 0, -0.335, 0.995), { ru: 0.15 * rh, rv: 0.012 * rh, color: '#4a2622' }));
      return out;
    }
  }

  /** Qual lado do corpo (+1 direita, -1 esquerda) está virado para a câmera. */
  function nearSide(cam, side) {
    return side.x * cam.toCamera.x + side.y * cam.toCamera.y >= 0 ? 1 : -1;
  }

  C.define('budega', Xiovanna);
  PD.Xiovanna = Xiovanna;
})(window.PD = window.PD || {});
