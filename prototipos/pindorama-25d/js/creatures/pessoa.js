// O MOLDE DE GENTE dos NPCs do 2.5D (15/11, pedido do dono: "já deixa para usar para futuros npc, só trocar cabelo,
// etc."). O corpo de gente do protótipo (character/) é o modelo único do herói; os NPCs usam este molde: um corpo
// desenhado como gente (tronco com cintura e ombros, braços com cotovelo, mãos com dedos, pernas e pés, no traço do
// herói: contorno de tinta, cor chapada, sombra de um lado e luz do outro) que muda com a APARÊNCIA.
//
// Para criar um NPC novo (a chave é a da NPC em data/npcs.json):
//   PD.creatures.definePerson('chave', {
//     pele: '#9a6345',
//     cabelo: { tipo: 'afro' | 'curto' | 'coque' | 'longo' | 'careca', cor: '#2b1e19', flor: '#c8323a' (ou nada) },
//     rosto: { olhos: '#4a2c1a', delineado: true, labios: '#a84f5a', blush: true, barba: false, brincos: '#e2b04a' },
//     cima: { tipo: 'jaqueta' | 'camiseta', cor: '#23232a', ziper: true, capuz: true, escudo: '#e2b04a', emblema: '#e2b04a' },
//     baixo: { tipo: 'calca' | 'bermuda' | 'saia', cor: '#2f3c58' },
//     pes: { tipo: 'tenis' | 'chinelo', cor: '#ece7dd', sola: '#5a5048' },
//     corpo: { altura: 1, largura: 1, feminino: true },
//     gestos: { aceno: true, cabelo: true },
//   });
// Tudo é opcional (o que faltar vem do PADRAO). Todo NPC do molde respira, muda o peso de perna, pisca, fica virado
// para onde o servidor manda (não segue quem passa: pedido do dono), anda com passo de verdade quando o servidor o
// move (`moveTo`) e, quando fala (`view.say`/`talk`), acena, olha para quem fala com ele e gesticula. `PD.creatures.Person` é a
// classe (para um NPC com gestos próprios, estenda e registre com `PD.creatures.define`).
// As bolas do `parts` servem só para a sombra no chão e para a caixa do desenho; quem desenha é o `_paint`.
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  const { tube } = C;
  const UP = { x: 0, y: 0, z: 1 };

  const PADRAO = {
    pele: '#9a6345',
    cabelo: { tipo: 'curto', cor: '#2b1e19', flor: null },
    rosto: { olhos: '#4a2c1a', delineado: false, labios: '#9a5a52', blush: false, barba: false, brincos: null },
    cima: { tipo: 'camiseta', cor: '#3f6f8f', ziper: false, capuz: false, escudo: null, emblema: null },
    baixo: { tipo: 'calca', cor: '#2f3c58' },
    pes: { tipo: 'tenis', cor: '#ece7dd', sola: '#5a5048' },
    corpo: { altura: 1, largura: 1, feminino: false },
    gestos: { aceno: true, cabelo: false },
  };

  /** Uma cor em três tons (a sombra, a cor e a luz), como as criaturas usam. */
  function tones(hex) {
    if (hex && typeof hex === 'object') return hex;
    const n = parseInt(String(hex).replace('#', ''), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const mix = (to, k) => '#' + c.map((v) => Math.round(v + (to - v) * k).toString(16).padStart(2, '0')).join('');
    return { base: mix(0, 0), shade: mix(0, 0.36), light: mix(255, 0.24) };
  }

  function lookOf(look) {
    const L = {};
    for (const k of Object.keys(PADRAO)) L[k] = typeof PADRAO[k] === 'object' ? { ...PADRAO[k], ...((look && look[k]) || {}) } : (look && look[k]) ?? PADRAO[k];
    return L;
  }

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

  /** Pontos numa casca (distribuição de Fibonacci), sorteados uma vez: o cabelo não muda de quadro a quadro. */
  function shell(n, seed) {
    const rnd = M.rng(seed);
    const out = [];
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      out.push({ f: Math.cos(th) * r, s: Math.sin(th) * r, u: y, k: 0.82 + rnd() * 0.3, j: rnd() });
    }
    return out;
  }
  const AFRO = shell(96, 7);
  const CAP = shell(70, 11);

  /**
   * Os cachos (ou mechas) de cada tipo de cabelo, em volta da cabeça: bolas { f, s, u, r } nos eixos da cabeça (frente,
   * lado, cima), em raios da cabeça. O rosto (a frente de baixo) fica sempre livre.
   */
  const HAIR = {
    careca: () => [],
    /** Black power: a nuvem grande de cachos, com a linha do cabelo irregular na testa. */
    afro() {
      const out = [{ f: -1.38, s: 0, u: 1.02, r: 0.9 }];
      for (const p of AFRO) {
        if (p.f > 0 && Math.abs(p.s) < 0.62 && p.u < 0.88) continue; // a coluna da frente (testa, olhos, boca)
        if (p.f > 0.4 && p.u < 0.5) continue; // frente de baixo (rosto e queixo)
        if (p.u < -0.42 && p.f > -0.35) continue; // embaixo do queixo
        out.push({ f: -0.28 + p.f * 1.95, s: p.s * 2.25, u: 0.42 + p.u * 1.85, r: 0.5 * p.k });
      }
      // a linha do cabelo: cachinhos de tamanhos diferentes na testa e no alto (sem eles a testa ficava careca)
      const rnd = M.rng(23);
      for (let k = -4; k <= 4; k++) {
        const a = Math.abs(k);
        out.push({ f: 0.52 - a * 0.055 + (rnd() - 0.5) * 0.06, s: k * 0.17 + (rnd() - 0.5) * 0.05, u: 0.8 - a * 0.028 + (rnd() - 0.5) * 0.07, r: 0.2 + rnd() * 0.12 });
      }
      for (let k = -3; k <= 3; k++) out.push({ f: 0.2 + (rnd() - 0.5) * 0.1, s: k * 0.26, u: 1.02 + (rnd() - 0.5) * 0.06, r: 0.32 + rnd() * 0.1 });
      return out;
    },
    /** Curto: uma touca de cabelo rente à cabeça. */
    curto() {
      const out = [];
      for (const p of CAP) {
        if (p.u < -0.25 && p.f > -0.55) continue; // abaixo das orelhas só na nuca
        if (p.f > 0.3 && p.u < 0.62) continue; // o rosto
        if (p.u < -0.62) continue;
        out.push({ f: p.f * 0.84 - 0.04, s: p.s * 0.88, u: p.u * 0.84 + 0.06, r: 0.24 + p.j * 0.05 });
      }
      return out;
    },
    /** Coque: o curto com um coque no alto, atrás. */
    coque() {
      return HAIR.curto().concat([{ f: -0.62, s: 0, u: 1.06, r: 0.5 }, { f: -0.46, s: 0, u: 0.78, r: 0.34 }]);
    },
    /** Longo: o curto com as mechas descendo pelas costas e pelos lados, até o meio das costas. */
    longo() {
      const out = HAIR.curto();
      for (let k = -3; k <= 3; k++) {
        const s = k * 0.3;
        const back = -0.78 * Math.sqrt(Math.max(0.05, 1 - (s / 1.15) ** 2));
        for (let u = 0.25; u > -2.5; u -= 0.34) out.push({ f: back - (u < -0.9 ? 0.12 : 0), s: s * (1 + Math.max(0, -u) * 0.06), u, r: 0.33 - Math.max(0, -u - 1.6) * 0.1 });
      }
      for (const sg of [-1, 1]) for (let u = 0.2; u > -1.5; u -= 0.34) out.push({ f: -0.2, s: sg * 0.98, u, r: 0.28 });
      return out;
    },
  };
  const hairCache = new Map();
  const hairOf = (tipo) => {
    if (!hairCache.has(tipo)) hairCache.set(tipo, (HAIR[tipo] || HAIR.curto)());
    return hairCache.get(tipo);
  };

  // As fatias do tronco: [altura, meia largura de lado, meia largura de frente], de baixo para cima.
  const TORSO = {
    f: [[90, 14.4, 10.4], [95, 14, 10.2], [101, 12.2, 9.2], [106, 11.2, 8.8], [112, 12, 9.6], [119, 13.4, 11], [125, 14.4, 10.2], [130, 15.2, 9], [134, 13, 7.6], [137.5, 7.5, 6.4]],
    m: [[90, 14, 10.6], [96, 13.8, 10.4], [103, 13.4, 10], [110, 14, 10.2], [118, 15.6, 10.8], [125, 17, 10.4], [130, 17.6, 9.2], [134, 15, 7.8], [137.5, 8, 6.6]],
  };
  const PELVIS = {
    f: [[76, 12.4, 9.4], [82, 14.2, 10.2], [88, 14.8, 10.6], [94, 13.4, 9.8]],
    m: [[76, 12, 9.4], [82, 13.4, 10], [88, 13.8, 10.4], [94, 13.4, 10]],
  };
  const SKIRT = [[58, 17.5, 13.5], [66, 16.6, 12.6], [76, 15.4, 11.4], [86, 14.8, 10.6], [94, 13.4, 9.8]];

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

  class Person extends C.Creature {
    constructor(x, y, yaw, look) {
      super(x, y, yaw);
      this.setLook(look || this.constructor.look);
      this.radius = 24;
      this.baseYaw = yaw;
      /** Gestos (0..1, suaves): aceno, mão no cabelo, fala; para onde a cabeça olha (rad, além do corpo); a piscada. */
      this.wave = 0;
      this.hair = 0;
      this.speak = 0;
      this.look = 0;
      this.blink = 0;
      this._waveUntil = 0;
      this._hairAt = 6 + this.seed * 6;
      this._hairUntil = 0;
      this._talkUntil = 0;
      this._blinkAt = 1 + this.seed * 3;
      this._lastTalk = -99;
      /** O andar: 0 parado .. 1 andando, e a fase do passo (rad). */
      this.walk = 0;
      this.stride = 0;
      /** Para a prancha: força um gesto ({ wave, hair, speak, look, blink }). */
      this.force = null;
    }

    /** Troca a aparência (o que faltar vem do padrão). */
    setLook(look) {
      const L = (this.app = lookOf(look));
      const S = (this.S = L.corpo.altura || 1);
      this.top = 190 * S;
      this.COL = {
        skin: tones(L.pele),
        hair: tones(L.cabelo.cor),
        top: tones(L.cima.cor),
        bottom: tones(L.baixo.cor),
        shoe: tones(L.pes.cor),
        sole: tones(L.pes.sola),
        petal: tones(L.cabelo.flor || '#c8323a'),
        stamen: tones('#f2c84b'),
      };
    }

    talk(ms) {
      // começou uma conversa (não a cada fala dela): acena
      if (ms > 0 && this.time - this._lastTalk > 8 && this.app.gestos.aceno) this._waveUntil = this.time + 1.4;
      if (ms > 0) this._lastTalk = this.time + ms / 1000;
      this._talkUntil = this.time + ms / 1000;
    }

    /** O servidor mandou andar (ou virar): o corpo fica virado para esse lado. */
    moveTo(x, y, yaw, durationMs, dash) {
      super.moveTo(x, y, yaw, durationMs, dash);
      if (Number.isFinite(yaw)) this.baseYaw = yaw;
    }

    animate(dt) {
      const t = this.time;
      const G = this.app.gestos;
      // o passo: anda quando o servidor a move
      const moving = this.speed > 8;
      this.walk = M.damp(this.walk, moving ? 1 : 0, 9, dt);
      if (this.walk > 0.02) this.stride += (this.speed * dt * M.TAU) / 112;
      // a cabeça passeia devagar; falando, olha para quem fala com ela (o corpo fica onde o servidor mandou)
      let lookTarget = moving ? 0 : (M.noise1(t * 0.25 + this.seed * 9) - 0.5) * 0.7;
      const hero = this.near && this.near.hero;
      if (hero && t < this._talkUntil + 1.5) {
        const dx = hero.x - this.pos.x, dy = hero.y - this.pos.y;
        if (Math.hypot(dx, dy) < 600) lookTarget = M.clamp(M.angleDiff(this.baseYaw, Math.atan2(dy, dx)), -1, 1);
      }
      this.yawTarget = this.baseYaw;
      // mão no cabelo de vez em quando (não no meio de outro gesto)
      if (G.cabelo && !moving && t > this._hairAt && t > this._waveUntil && t > this._talkUntil) {
        this._hairUntil = t + 2.2;
        this._hairAt = t + 9 + ((this.seed * 7 + t) % 6);
      }
      // pisca a cada 3 a 6 segundos
      if (t > this._blinkAt + 0.14) this._blinkAt = t + 3 + ((this.seed * 13 + t * 3.7) % 3);
      const f = this.force || {};
      this.wave = f.wave ?? M.damp(this.wave, t < this._waveUntil ? 1 : 0, 7, dt);
      this.hair = f.hair ?? M.damp(this.hair, t < this._hairUntil && t >= this._waveUntil ? 1 : 0, 5, dt);
      this.speak = f.speak ?? M.damp(this.speak, t < this._talkUntil ? 1 : 0, 6, dt);
      this.look = f.look ?? M.damp(this.look, lookTarget, 5, dt);
      this.blink = f.blink ?? (t >= this._blinkAt && t < this._blinkAt + 0.14 ? 1 : 0);
      this.label = this.walk > 0.5 ? 'andando' : this.wave > 0.5 ? 'acenando' : this.hair > 0.5 ? 'mão no cabelo' : this.speak > 0.5 ? 'falando' : 'parada';
    }

    /** Ponto em volta do pé, já no tamanho da pessoa (`altura`). */
    _at(a, sd, zz) {
      const S = this.S;
      return this.at(a * S, sd * S, zz * S);
    }

    /** As juntas do quadro (para o `_paint`) e as bolas da sombra e da caixa do desenho. */
    parts(cam) {
      const t = this.time;
      const S = this.S;
      const W = this.app.corpo.largura || 1;
      const fem = !!this.app.corpo.feminino;
      const yaw = this.yaw;
      const fwd = { x: Math.cos(yaw), y: Math.sin(yaw), z: 0 };
      const side = { x: -fwd.y, y: fwd.x, z: 0 };
      // andando: o corpo sobe e desce um pouco a cada passo (do quadril para cima)
      const wk = this.walk;
      const bob = wk * Math.abs(Math.cos(this.stride)) * 1.6;
      const at = (a, s, z) => this._at(a, s, z > 40 ? z + bob : z);
      const COL = this.COL;
      // peso de uma perna para a outra (parado) e a respiração
      const sway = Math.sin(t * 0.55 + this.seed * 4) * 1.6 * (1 - wk);
      const breath = Math.sin(t * 2.2 + this.seed * 3) * 0.5;
      const nod = this.speak * Math.sin(t * 7) * 0.06;
      const J = (this._j = { t, yaw, fwd, side, sway, breath, bob, legs: [], arms: [] });
      const groups = [];
      const g = (balls, ref, extra) => groups.push({ balls, ref, ...(extra || {}) });

      // pernas
      const hipW = (fem ? 8 : 8.6) * W;
      for (const sg of [-1, 1]) {
        const hip = at(0, hipW * sg + sway, 80);
        // o passo: o pé vai e volta, e sobe quando vem para a frente
        const ph = this.stride + (sg > 0 ? 0 : Math.PI);
        const ankle = at(19 * wk * Math.sin(ph), (hipW + 0.6) * sg, 8 + wk * Math.max(0, Math.cos(ph)) * 7);
        const knee = bend(hip, ankle, 37 * S, 36 * S, M.add(fwd, { x: 0, y: 0, z: 0.1 }));
        J.legs.push({ sg, hip, knee, ankle });
        const leg = [];
        tube(hip, knee, 7 * S, 5.6 * S, COL.bottom, leg);
        tube(knee, ankle, 5.5 * S, 4.3 * S, COL.bottom, leg);
        g(leg, knee);
        g([{ c: M.add(ankle, M.scale(fwd, 3 * S)), r: 4.6 * S, col: COL.shoe }], ankle);
      }
      // tronco
      const waist = at(0.5, sway * 0.3, 103);
      const chest = at(1, 0, 120 + breath);
      const torso = [{ c: at(0.5, sway * 0.5, 90), r: 13.4 * S * W, col: COL.top }];
      tube(waist, chest, 11.5 * S * W, 13.6 * S * W, COL.top, torso);
      g(torso, M.lerp3(waist, chest, 0.5), { body: true });
      // pescoço e cabeça (olhando para quem está perto)
      const neckBase = at(0, 0, 134 + breath);
      const neckTop = at(1, 0, 143 + breath);
      const hy = yaw + this.look;
      const fh = M.norm({ x: Math.cos(hy), y: Math.sin(hy), z: -nod });
      const sh = { x: -Math.sin(hy), y: Math.cos(hy), z: 0 };
      const uh = M.norm(M.cross(fh, sh));
      const rh = 12 * S;
      const hc = at(1.5, 0, 154 + breath);
      const H = (f, s, u) => M.add(hc, M.add(M.scale(fh, f * rh), M.add(M.scale(sh, s * rh), M.scale(uh, u * rh))));
      g([{ c: hc, r: rh, col: COL.skin }], hc, { body: true });
      // cabelo: o que fica atrás da cabeça (pela câmera) é desenhado antes dela; o resto (lados, em cima), depois
      const hair = hairOf(this.app.cabelo.tipo).map((b) => ({ c: H(b.f, b.s, b.u), r: b.r * rh, col: COL.hair }));
      const cut = cam.depth(hc) - 0.4 * rh;
      const hairBack = hair.filter((b) => cam.depth(b.c) < cut);
      const hairFront = hair.filter((b) => cam.depth(b.c) >= cut);
      if (hair.length) g(hair, hc);
      let top = 154 * S + rh + 4;
      for (const b of hair) top = Math.max(top, b.c.z - this.groundZ + b.r + 3);
      this.top = top;
      Object.assign(J, { neckBase, neckTop, hc, rh, fh, sh, uh, H, hairBack, hairFront });
      // a flor no cabelo, do lado direito
      if (this.app.cabelo.flor) {
        let far = null;
        for (const b of hair) {
          const s = M.dot(M.sub(b.c, hc), sh) + M.dot(M.sub(b.c, hc), fh) * 0.4 - Math.abs(M.dot(M.sub(b.c, hc), uh) - 0.6 * rh) * 0.5;
          if (!far || s > far.s) far = { s, b };
        }
        const base = far ? far.b.c : H(0.2, 1, 0.3);
        const fn = M.norm(M.sub(base, hc));
        const fc = M.add(base, M.scale(fn, (far ? far.b.r : 0) * 0.7));
        const fu = M.norm(M.cross(fn, UP), sh);
        const fv = M.norm(M.cross(fu, fn));
        const petals = [];
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * M.TAU + 0.3;
          petals.push({ c: M.add(fc, M.add(M.scale(fu, Math.cos(a) * 3.4 * S), M.add(M.scale(fv, Math.sin(a) * 3.4 * S), M.scale(fn, S)))), r: 2.9 * S, col: COL.petal });
        }
        petals.push({ c: M.add(fc, M.scale(fn, 2.6 * S)), r: 1.3 * S, col: COL.stamen });
        J.petals = petals;
        J.flowerSeen = fn.x * cam.toCamera.x + fn.y * cam.toCamera.y + fn.z * cam.toCamera.z > 0.02;
      }
      // braços: acena com a esquerda, leva a direita ao cabelo, gesticula falando
      const shW = (fem ? 13.3 : 15.4) * W;
      for (const sg of [-1, 1]) {
        const sh0 = at(-0.5, shW * sg, 126.8 + breath);
        // (andando, o braço balança ao contrário da perna do mesmo lado)
        const swing = wk * Math.sin(this.stride + (sg > 0 ? Math.PI : 0));
        let hand = at(4 + 13 * swing, (shW + 2.4) * sg + sway * 0.3, 84 + 3 * Math.abs(swing));
        let hint = M.add(M.scale(fwd, -0.6), M.add(M.scale(side, 0.6 * sg), { x: 0, y: 0, z: -0.2 }));
        if (sg < 0 && this.wave > 0.001) {
          const wv = at(5, -25 + Math.sin(t * 9) * 6, 160);
          hand = M.lerp3(hand, wv, M.smoothstep(0, 1, this.wave));
          hint = M.lerp3(hint, M.add(M.scale(side, -1), { x: 0, y: 0, z: -0.5 }), this.wave);
        }
        if (sg > 0 && this.hair > 0.001) {
          const hp = H(-0.3, 1.5, 0.5);
          hand = M.lerp3(hand, hp, M.smoothstep(0, 1, this.hair));
          hint = M.lerp3(hint, M.add(M.scale(side, 1), { x: 0, y: 0, z: 0.7 }), this.hair);
        }
        if (sg > 0 && this.speak > 0.001 && this.hair < 0.5) {
          const sp = at(19, 12, 108 + Math.sin(t * 6) * 3);
          hand = M.lerp3(hand, sp, this.speak * (1 - this.hair));
        }
        const elbow = bend(sh0, hand, 25 * S, 23 * S, hint);
        J.arms.push({ sg, sh0, elbow, hand, open: sg < 0 ? this.wave : 0 });
        const arm = [];
        tube(sh0, elbow, 5 * S, 4.6 * S, COL.top, arm);
        tube(elbow, hand, 4.6 * S, 3.9 * S, COL.top, arm);
        g(arm, M.lerp3(elbow, hand, 0.4));
      }
      return { groups };
    }

    /** A peça para a PD.World: a sombra e as caixas das bolas (como as criaturas), o desenho de gente por cima. */
    drawable(cam, primary) {
      const d = super.drawable(cam, primary);
      // parada (no balcão, respirando): reaproveita a imagem pronta — PD.DrawCache (character/renderer.js), 22/11, "deixa
      // os personagens mais leves". Falando, a boca anima com o relógio: ao vivo
      d.draw = (ctx) => {
        if (!PD.DrawCache || PD.characterCacheOff) return this._paint(ctx, cam);
        const C = this._drawCache || (this._drawCache = new PD.DrawCache());
        const live = this.speak > 0.01 || this.dying !== null;
        C.draw(ctx, cam, live ? null : this._drawState(cam), live, (c) => this._paint(c, cam), () => ({ box: d.bounds, pad: 10, paint: (g) => this._paint(g, cam) }));
      };
      return d;
    }

    /**
     * O retrato do quadro para a imagem guardada: as juntas (`_j`, em cm; o giro e as direções medidos numa ponta), a
     * piscada e a aparência. O relógio (`t`) fica de fora: parada, só a pose muda o desenho.
     */
    _drawState(cam) {
      const R = PD.DrawCache.state(cam);
      R.other.push(this.app, this.S);
      R.num.push(this.blink || 0, this.wave || 0);
      R.tol.push(0.03, 0.03);
      const walk = (v, tol) => {
        if (typeof v === 'function') return; // (o `_j` guarda funções feitas a cada quadro: não são o desenho)
        if (v === null || v === undefined) return R.other.push(0);
        if (typeof v === 'number') {
          R.num.push(v);
          R.tol.push(tol);
          return;
        }
        if (typeof v !== 'object') return R.other.push(v);
        if (Array.isArray(v)) {
          R.other.push(v.length);
          for (const e of v) walk(e, tol);
          return;
        }
        for (const k in v) {
          if (k === 't') continue;
          if (k === 'sg') R.other.push(v[k]);
          else walk(v[k], k === 'yaw' || k === 'fwd' || k === 'side' ? R.axisTol : k === 'open' ? 0.03 : tol);
        }
      };
      walk(this._j || {}, R.posTol);
      return R;
    }

    /**
     * O corpo de gente: cada parte é um conjunto de formas (cápsulas e contornos) com a cor dela; as partes são
     * desenhadas de trás para a frente (pela profundidade da câmera), cada uma com o contorno de tinta em volta do
     * conjunto todo, a sombra de um lado, a luz do outro e os detalhes por cima.
     */
    _paint(ctx, cam) {
      const J = this._j;
      if (!J) return;
      const L = this.app;
      const COL = this.COL;
      const S = this.S;
      const W = L.corpo.largura || 1;
      const fem = !!L.corpo.feminino;
      const z = cam.zoom;
      const zs = z * S;
      const iw = Math.max(1, 1.05 * z);
      const P = (p) => cam.p(p);
      const { fwd, side, sway, breath } = J;
      const at = (a, sd, zz) => this._at(a, sd, zz > 40 ? zz + J.bob : zz);
      const TC = cam.toCamera;
      const facing = (n) => n.x * TC.x + n.y * TC.y + n.z * TC.z;
      const parts = [];
      const part = (ref, bias, shapes, after) => parts.push({ key: cam.depth(ref) + bias * 6 * S, shapes, after });
      const cap = (a, b, ra, rb, col) => ({ path: capsule(P(a), P(b), ra * zs, rb * zs), col, r: Math.max(ra, rb) * zs });
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
      const lw = (k) => Math.max(0.8, k * zs);
      /** Desenha em centímetros num plano do corpo: `c` o meio, `u` para a direita e `v` para cima (vetores do mundo). */
      const onPlane = (c, u, v, fn) => {
        const o = P(c);
        const pu = P(M.add(c, M.scale(u, S)));
        const pv = P(M.add(c, M.scale(v, S)));
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
        const A = a * W * S * psd.x, B = b * S * pfw.x;
        const R = Math.hypot(A, B) || 1e-3;
        const yo = (a * W * S * psd.y * A + b * S * pfw.y * B) / R;
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
      const BODY = TORSO[fem ? 'f' : 'm'];
      /** A meia largura de lado e de frente do tronco numa altura (para pôr os detalhes em cima do pano). */
      const girth = (zz) => {
        let i = 0;
        while (i < BODY.length - 2 && BODY[i + 1][0] < zz) i++;
        const [z0, a0, b0] = BODY[i], [z1, a1, b1] = BODY[i + 1];
        const k = M.clamp((zz - z0) / (z1 - z0), 0, 1);
        return { a: (a0 + (a1 - a0) * k) * W, b: b0 + (b1 - b0) * k };
      };
      /** Um ponto na frente da roupa de cima: `sd` para o lado (cm) e a altura. */
      const front = (sd, zz, out = 0.3) => {
        const gi = girth(zz);
        const k = Math.sqrt(Math.max(0, 1 - (sd / gi.a) ** 2));
        return at(0.5 + gi.b * k + out, sideOff(zz) + sd, zz + lift(zz));
      };
      const frontSeen = facing(fwd);
      const fade = M.clamp((frontSeen + 0.25) / 0.3, 0, 1);
      const jacket = L.cima.tipo === 'jaqueta';

      // ---- pernas e pés
      const skirt = L.baixo.tipo === 'saia';
      const shorts = L.baixo.tipo === 'bermuda';
      for (const leg of J.legs) {
        const { hip, knee, ankle, sg } = leg;
        const shoe = (a, zz) => M.add(ankle, M.add(M.scale(fwd, a * S), { x: 0, y: 0, z: (zz - 8) * S }));
        if (L.pes.tipo === 'chinelo') {
          part(shoe(3, 1), -0.4, [cap(shoe(-3.8, 1), shoe(9.6, 1), 4.3, 3.6, COL.sole)]);
          part(shoe(3, 3.4), 0, [cap(shoe(-3, 3.6), shoe(8.4, 3), 3.9, 3.1, COL.skin)], () => {
            line([M.add(shoe(1, 6.6), M.scale(side, -3.4 * S)), shoe(6.4, 5), M.add(shoe(1, 6.6), M.scale(side, 3.4 * S))], COL.shoe.base, lw(1.5));
          });
        } else {
          part(shoe(3, 2), -0.4, [cap(shoe(-3.6, 2.1), shoe(9.4, 1.9), 4.5, 3.7, COL.sole)]);
          part(shoe(3, 5), 0, [cap(shoe(-3.4, 5), shoe(8.8, 4.2), 4.5, 3.5, COL.shoe)], () => {
            // a lingueta e os cadarços
            if (frontSeen > -0.2) for (const a of [2.5, 4.6, 6.6]) line([M.add(shoe(a, 8.2 - a * 0.42), M.scale(side, -2 * S)), M.add(shoe(a, 8.2 - a * 0.42), M.scale(side, 2 * S))], COL.shoe.shade, lw(0.7));
          });
        }
        if (skirt || shorts) {
          // a perna de fora (pele): a canela e, de saia, a coxa também
          part(knee, -0.3, [cap(hip, knee, 6.8, 5.6, COL.skin), cap(knee, ankle, 5.3, 4, COL.skin)]);
          if (shorts) {
            const cut = M.lerp3(hip, knee, 0.86);
            part(M.lerp3(hip, knee, 0.4), -0.2, [cap(hip, cut, 7.8, 6.8, COL.bottom)], () => {
              const across = M.norm(M.cross(M.norm(M.sub(knee, hip)), TC));
              line([M.add(cut, M.scale(across, -6.2 * S)), M.add(cut, M.scale(across, 6.2 * S))], COL.bottom.light, lw(1.3), 0.9);
            });
          }
        } else {
          part(knee, -0.2, [cap(hip, knee, 7.6, 6, COL.bottom), cap(knee, ankle, 5.9, 4.3, COL.bottom)], () => {
            // a barra dobrada, a costura de fora e a dobra do joelho
            const hem = M.lerp3(knee, ankle, 0.93);
            line([M.add(hem, M.scale(side, -4 * S)), M.add(hem, M.scale(side, 4 * S))], COL.bottom.light, lw(1.5), 0.9);
            line([M.add(hip, M.scale(side, 6.6 * sg * S)), M.add(knee, M.scale(side, 5.2 * sg * S)), M.add(ankle, M.scale(side, 3.8 * sg * S))], COL.bottom.shade, lw(0.6), 0.7);
            if (frontSeen > 0) line([M.add(knee, M.add(M.scale(fwd, 5.4 * S), M.scale(side, -2.6 * S))), M.add(knee, M.add(M.scale(fwd, 5.8 * S), M.scale(side, 2.4 * S)))], COL.bottom.shade, lw(0.8), 0.7);
          });
        }
      }

      // ---- o quadril e a roupa de cima
      part(at(0, 0, 86), -0.1, [{ path: outline(skirt ? SKIRT : PELVIS[fem ? 'f' : 'm']), col: COL.bottom, r: 13 * zs }], () => {
        if (skirt) return;
        // os bolsos da calça e o botão
        if (frontSeen > 0.05) for (const sg of [-1, 1]) line([front(4.5 * sg, 90, 0.5), at(9.6, 9.5 * sg + sideOff(86), 85), at(9, 11.8 * sg + sideOff(84), 83)], COL.bottom.shade, lw(0.7), 0.8 * fade);
      });
      // (o ombro de gente fica um pouco para dentro da junta)
      const shoulders = J.arms.map((a) => ball(a.sh0, 5.2 * S, COL.top));
      part(at(0.5, 0, 112), 0, [{ path: outline(BODY), col: COL.top, r: 13 * zs }, ...shoulders], () => {
        if (frontSeen <= -0.25) return;
        // a gola: aberta em V na jaqueta (a pele do colo), redonda na camiseta
        ctx.save();
        ctx.globalAlpha *= fade;
        const o = P(front(0, jacket ? 126.5 : 131.5, 0.4)), l = P(front(-4.8, 136, 0.2)), r = P(front(4.8, 136, 0.2));
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        if (jacket) ctx.lineTo(o.x, o.y);
        else ctx.quadraticCurveTo(o.x, o.y + (o.y - l.y) * 0.5, r.x, r.y);
        ctx.lineTo(r.x, r.y);
        ctx.closePath();
        ctx.fillStyle = COL.skin.shade;
        ctx.fill();
        ctx.strokeStyle = COL.top.light;
        ctx.lineWidth = lw(1.7);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        if (jacket) ctx.lineTo(o.x, o.y);
        else ctx.quadraticCurveTo(o.x, o.y + (o.y - l.y) * 0.5, r.x, r.y);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();
        ctx.restore();
        if (L.cima.ziper) {
          // o zíper, do colo até a barra, com o puxador
          const zip = [];
          for (let zz = 126; zz >= 91; zz -= 5) zip.push(front(0, zz, 0.4));
          line(zip, '#9c9ca8', lw(0.9), fade);
          line([front(0, 126, 0.5), front(0.3, 123.4, 0.6)], '#d9d9e2', lw(1.5), fade);
        }
        if (fem) {
          // a curva do busto
          line([front(-9.5, 117.5), front(-5, 114.6), front(-1.2, 115.6)], COL.top.shade, lw(1.1), 0.9 * fade);
          line([front(9.5, 117.5), front(5, 114.6), front(1.2, 115.6)], COL.top.shade, lw(1.1), 0.9 * fade);
        } else line([front(-8, 120.5), front(0, 119.4), front(8, 120.5)], COL.top.shade, lw(0.9), 0.6 * fade);
        if (jacket) for (const sg of [-1, 1]) line([front(5.5 * sg, 101), front(9.2 * sg, 96.5)], COL.top.light, lw(0.9), 0.8 * fade);
        line([front(-12, 92.2), front(-6, 91.6), front(0, 91.5), front(6, 91.6), front(12, 92.2)], COL.top.light, lw(0.9), 0.6 * fade);
        if (L.cima.escudo) {
          // o escudo no peito (lado esquerdo da pessoa)
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
              ctx.fillStyle = L.cima.escudo;
              ctx.fill(shield);
              ctx.lineWidth = 0.5;
              ctx.strokeStyle = 'rgba(40, 26, 6, 0.8)';
              ctx.stroke(shield);
              ctx.fillStyle = 'rgba(40, 26, 6, 0.8)';
              ctx.fillRect(-2, -1.6, 4, 0.9);
              ctx.fillRect(-1.4, 0.4, 2.8, 0.7);
            });
          }
        }
      });
      if (L.cima.capuz) {
        // o capuz, caído atrás do pescoço
        part(at(-9, 0, 137), -1, [ball(at(-7.2, 5, 135.5 + breath), 6.4 * S, COL.top), ball(at(-7.2, -5, 135.5 + breath), 6.4 * S, COL.top), ball(at(-8.8, 0, 138 + breath), 7 * S, COL.top)], () => {
          if (frontSeen < 0.1) line([at(-13.5, -5, 139 + breath), at(-15, 0, 137 + breath), at(-13.5, 5, 139 + breath)], COL.top.light, lw(0.9), 0.7);
        });
      }

      // ---- o pescoço
      part(J.neckBase, -0.5, [cap(J.neckBase, J.neckTop, 5, 4.6, COL.skin)]);

      // ---- os braços (a manga) e as mãos
      for (const arm of J.arms) {
        const { sh0, elbow, hand, sg, open } = arm;
        const dirF = M.norm(M.sub(hand, elbow));
        const wrist = M.add(hand, M.scale(dirF, -1.5 * S));
        // a mão: a palma e os dedos (abertos no aceno, juntos no resto), no plano da palma
        let lat = M.cross(dirF, open > 0.3 ? fwd : M.scale(side, sg));
        lat = M.len(lat) > 0.2 ? M.norm(lat) : fwd;
        const knuckle = M.add(hand, M.scale(dirF, 4.6 * S));
        const spread = 0.07 + 0.2 * open;
        const reach = (5.4 + 1.2 * open) * S;
        const shapes = [cap(wrist, knuckle, 3, 3.5, COL.skin)];
        for (let k = 0; k < 4; k++) {
          const off = k - 1.5;
          const base = M.add(knuckle, M.scale(lat, off * 1.7 * S));
          const dir = M.norm(M.add(dirF, M.scale(lat, off * spread)));
          shapes.push(cap(base, M.add(base, M.scale(dir, reach * (k === 0 || k === 3 ? 0.84 : 1))), 1.25, 1.05, COL.skin));
        }
        const thumbBase = M.add(hand, M.add(M.scale(dirF, 1.6 * S), M.scale(lat, -3.2 * S)));
        shapes.push(cap(thumbBase, M.add(thumbBase, M.scale(M.norm(M.add(dirF, M.scale(lat, -0.9 - 0.4 * open))), 4.4 * S)), 1.45, 1.2, COL.skin));
        const mid = M.lerp3(elbow, hand, 0.4);
        const near = sg === nearSide(cam, side) ? 1 : -1;
        part(M.add(hand, M.scale(dirF, 4 * S)), 1.5 * near + 0.2, shapes);
        const across = M.norm(M.cross(dirF, TC));
        if (jacket) {
          part(mid, 1.5 * near, [cap(sh0, elbow, 5, 4.6, COL.top), cap(elbow, wrist, 4.7, 3.9, COL.top)], () => {
            // o punho de malha e a dobra do cotovelo
            const cuff = M.lerp3(elbow, wrist, 0.86);
            line([M.add(cuff, M.scale(across, -3.6 * S)), M.add(cuff, M.scale(across, 3.6 * S))], COL.top.light, lw(1.2), 0.9);
            const el = M.norm(M.cross(M.norm(M.sub(elbow, sh0)), TC));
            line([M.add(elbow, M.scale(el, -3.4 * S)), M.add(M.lerp3(elbow, sh0, 0.08), M.scale(el, 0.5 * S))], COL.top.shade, lw(0.9), 0.9);
            if (L.cima.emblema && sg > 0 && facing(side) > 0.15) {
              // o emblema na manga direita
              onPlane(M.add(M.lerp3(sh0, elbow, 0.42), M.scale(side, 5.2 * S)), fwd, UP, () => {
                ctx.fillStyle = L.cima.emblema;
                ctx.beginPath();
                ctx.arc(0, 0, 2.2, 0, M.TAU);
                ctx.fill();
                ctx.lineWidth = 0.45;
                ctx.strokeStyle = 'rgba(40, 26, 6, 0.8)';
                ctx.stroke();
              });
            }
          });
        } else {
          // camiseta: o braço de fora (pele) e a manga curta por cima
          const sleeve = M.lerp3(sh0, elbow, 0.56);
          part(mid, 1.5 * near, [cap(sh0, elbow, 4.4, 4, COL.skin), cap(elbow, wrist, 4, 3.3, COL.skin)]);
          part(M.lerp3(sh0, elbow, 0.3), 1.5 * near + 0.1, [cap(sh0, sleeve, 4.9, 5.1, COL.top)], () => {
            const up = M.norm(M.cross(M.norm(M.sub(elbow, sh0)), TC));
            line([M.add(sleeve, M.scale(up, -5 * S)), M.add(sleeve, M.scale(up, 5 * S))], COL.top.light, lw(1.1), 0.9);
          });
        }
      }

      // ---- a cabeça: o crânio e o queixo, as orelhas, o rosto
      const { hc, rh, fh, sh, uh, H } = J;
      const headShapes = [ball(hc, rh, COL.skin), ball(H(0.2, 0, -0.44), 0.78 * rh, COL.skin)];
      for (const sg of [-1, 1]) headShapes.push(ball(H(-0.05, 0.97 * sg, -0.12), 0.2 * rh, COL.skin));
      part(hc, 0, headShapes, () => {
        if (L.rosto.barba && facing(fh) > -0.15) {
          // a barba cheia: a parte de baixo do rosto (do nariz para baixo) na cor do cabelo
          const cut = P(H(0.95, 0, -0.26)).y;
          const c0 = P(hc);
          ctx.save();
          const both = new Path2D();
          both.addPath(headShapes[0].path);
          both.addPath(headShapes[1].path);
          ctx.clip(both);
          ctx.globalAlpha *= M.clamp((facing(fh) + 0.15) / 0.3, 0, 1);
          ctx.fillStyle = COL.hair.base;
          ctx.fillRect(c0.x - rh * z * 2, cut, rh * z * 4, rh * z * 3);
          ctx.fillStyle = COL.hair.shade;
          ctx.fillRect(c0.x + rh * z * 0.35, cut, rh * z * 2, rh * z * 3);
          ctx.restore();
        }
        if (L.rosto.brincos) {
          for (const sg of [-1, 1]) {
            if (facing(M.scale(sh, sg)) < 0.05) continue;
            const e = P(H(-0.02, 1.08 * sg, -0.42));
            ctx.strokeStyle = L.rosto.brincos;
            ctx.lineWidth = lw(0.9);
            ctx.beginPath();
            ctx.arc(e.x, e.y, 2 * zs, 0, M.TAU);
            ctx.stroke();
          }
        }
        for (const d of this._face(hc, rh, fh, sh, uh)) {
          const f = facing(d.n);
          if (f < 0.06) continue;
          ctx.save();
          ctx.globalAlpha *= M.clamp((f - 0.06) / 0.2, 0, 1) * (d.alpha ?? 1);
          const o = P(d.c), pu = P(M.add(d.c, d.u)), pv = P(M.add(d.c, d.v));
          ctx.transform(pu.x - o.x, pu.y - o.y, -(pv.x - o.x), -(pv.y - o.y), o.x, o.y);
          if (d.rot) ctx.rotate(-d.rot);
          if (d.lid) {
            // a pálpebra de cima: um arco grosso (com o gatinho do delineado, se tiver)
            ctx.strokeStyle = d.color;
            ctx.lineWidth = d.rv * (d.liner ? 0.42 : 0.26);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.ellipse(0, 0, d.ru, d.rv, 0, Math.PI * 1.02, Math.PI * 1.98);
            ctx.stroke();
            if (d.liner) {
              ctx.beginPath();
              ctx.moveTo(d.lid * d.ru * 0.96, -d.rv * 0.2);
              ctx.lineTo(d.lid * d.ru * 1.34, -d.rv * 0.75);
              ctx.stroke();
            }
          } else {
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, d.ru, d.rv, 0, 0, M.TAU);
            ctx.fill();
          }
          ctx.restore();
        }
      });

      // ---- o cabelo (atrás e na frente da cabeça) e a flor
      const curls = (list) => list.map((b) => ball(b.c, b.r, COL.hair));
      const sheen = (list) => () => {
        ctx.save();
        ctx.strokeStyle = COL.hair.light;
        ctx.lineCap = 'round';
        ctx.lineWidth = lw(0.9);
        list.forEach((b, i) => {
          if (i % 2 || b.r < 0.26 * rh) return;
          const q = P(b.c);
          const r = b.r * z * 0.55;
          ctx.globalAlpha = 0.5 + (0.3 * ((i * 7) % 3)) / 2;
          ctx.beginPath();
          ctx.arc(q.x - r * 0.25, q.y - r * 0.3, r, Math.PI * 1.05, Math.PI * 1.6);
          ctx.stroke();
        });
        ctx.restore();
      };
      if (J.hairBack.length) part(hc, -2, curls(J.hairBack), sheen(J.hairBack));
      if (J.hairFront.length) part(hc, 2, curls(J.hairFront), sheen(J.hairFront));
      if (J.petals) part(hc, J.flowerSeen ? 3 : -4, J.petals.map((b) => ball(b.c, b.r, b.col)));

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

    /** O rosto, em decalques na cabeça: olhos (que piscam), sobrancelhas, nariz, boca (que abre ao falar) e a barba. */
    _face(hc, rh, fh, sh, uh) {
      const R = this.app.rosto;
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
      const hair = this.COL.hair;
      const out = [];
      // (a barba cheia é pintada no `_paint`, por baixo destes decalques; aqui só o bigode)
      if (R.barba) out.push(d(on(0.93, 0, -0.31, 1), { ru: 0.24 * rh, rv: 0.065 * rh, color: hair.base }));
      const open = 1 - this.blink;
      for (const sg of [-1, 1]) {
        if (open > 0.5) {
          out.push(d(on(0.84, 0.37 * sg, 0.1, 0.985), { ru: 0.2 * rh, rv: 0.15 * rh, color: '#f7f1e8' }));
          out.push(d(on(0.86, 0.36 * sg, 0.1, 0.99), { ru: 0.125 * rh, rv: 0.135 * rh, color: R.olhos }));
          out.push(d(on(0.87, 0.36 * sg, 0.1, 0.995), { ru: 0.065 * rh, rv: 0.07 * rh, color: '#120a07' }));
          out.push(d(on(0.87, 0.33 * sg, 0.15, 1), { ru: 0.036 * rh, rv: 0.036 * rh, color: '#fff8ee' }));
          out.push(d(on(0.84, 0.37 * sg, 0.1, 0.992), { ru: 0.215 * rh, rv: 0.165 * rh, color: '#1b100d', lid: sg, liner: !!R.delineado }));
        } else out.push(d(on(0.85, 0.37 * sg, 0.07, 0.99), { ru: 0.2 * rh, rv: 0.03 * rh, color: '#1b100d' }));
        out.push(d(on(0.78, 0.37 * sg, 0.43, 0.99), { ru: 0.2 * rh, rv: (R.delineado ? 0.042 : 0.055) * rh, rot: -0.14 * sg, color: hair.shade }));
        if (R.blush) out.push(d(on(0.78, 0.56 * sg, -0.2, 0.99), { ru: 0.17 * rh, rv: 0.1 * rh, color: '#c0604a', alpha: 0.3 }));
      }
      out.push(d(on(0.97, 0, -0.14, 1.0), { ru: 0.07 * rh, rv: 0.085 * rh, color: this.COL.skin.shade }));
      out.push(d(on(0.97, 0.02, -0.09, 1.01), { ru: 0.028 * rh, rv: 0.05 * rh, color: this.COL.skin.light }));
      const lips = tones(R.labios);
      const mouth = this.speak * Math.abs(Math.sin(this.time * 9));
      out.push(d(on(0.9, 0, -0.4, 0.99), { ru: 0.18 * rh, rv: 0.06 * rh, color: lips.shade }));
      out.push(d(on(0.88, 0, -0.5, 0.985), { ru: 0.16 * rh, rv: (0.075 + 0.03 * mouth) * rh, color: lips.base }));
      out.push(d(on(0.9, 0, -0.445, 0.995), { ru: 0.16 * rh, rv: (0.014 + 0.05 * mouth) * rh, color: '#3e1c20' }));
      out.push(d(on(0.88, -0.05, -0.52, 0.99), { ru: 0.05 * rh, rv: 0.022 * rh, color: lips.light, alpha: 0.75 }));
      return out;
    }
  }

  C.Person = Person;
  /** Registra um NPC do molde de gente: `PD.creatures.definePerson('chave', aparência)`. */
  C.definePerson = (type, look) => {
    const cls = class extends Person {};
    cls.look = look || {};
    C.define(type, cls);
    return cls;
  };
  PD.Person = Person;
})(window.PD = window.PD || {});
