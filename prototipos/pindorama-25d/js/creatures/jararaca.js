// Jararaca (a víbora da Mata Atlântica; regras da [estrutura]): marrom-oliva com as manchas escuras em "V" nos flancos
// (a ponta virada para o lombo, com a beirada clara), a barriga creme, a cabeça em ponta de lança bem mais larga que o
// pescoço (as bochechas do veneno), o olho amarelo de pupila em fenda debaixo da "sobrancelha" de escama, a risca escura
// do olho até o canto da boca e o lábio claro; a língua vermelha bifurcada entra e sai.
// Parada, fica em S no chão com a cabeça um pouco erguida, olhando em volta. Andando, rasteja: o corpo segue o caminho
// da cabeça e a onda em S fica parada no chão enquanto ela avança.
// Redesenho (24/11, a etapa 4 dos inimigos; o dono: "segue para a Jararaca"): sem as bolinhas — pintada como o Birim,
// o sagui, o quati e o tatu (o contorno de tinta mais grosso do lado da sombra, a meia-lua de sombra e a faixa de
// brilho). O corpo vai em pedaços curtos, cada um na sua vez pela distância da câmera (as voltas da rodilha passam uma
// na frente da outra), sem risco nas emendas e com a sombra, o brilho e as manchas seguindo o corpo inteiro.
// No aviso ('windup', 0,65 s) ela se enrola numa rodilha, ergue o pescoço num S apertado, incha e puxa a cabeça para
// trás; a língua não para, a ponta do rabo treme e a boca começa a abrir. No bote ('strike' ou 'bite') o S desenrola e
// a cabeça dispara uns 1,4 m para a frente de boca escancarada (as presas à mostra), morde e volta para a rodilha.
// Apanhando, dá um tranco para longe de quem bateu (a cabeça recua e o S aperta); caindo, vira de barriga para cima
// numa torção da cabeça ao rabo e o encanto sai do corpo em faíscas roxas. As bolas ficam só para a sombra no chão e a
// caixa do desenho.
//   PD.creatures.create('jararaca', xCm, yCm, yaw)
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  if (!C) return;
  const P = C.paint;
  const SH = PD.shapes;
  const INK = C.INK;
  const UP = M.UP;
  const DEG = Math.PI / 180;

  /** Tamanho de jogo: um pouco mais grossa e comprida que a de verdade, para ler com a câmera longe. */
  const S = 1.15;
  const LEN = 170 * S; // comprimento (cm)
  const R = 6.2 * S; // raio no meio do corpo (cm)
  const STEP = 3; // distância entre os pontos do rastro (cm)
  const WAVE = 78 * S; // comprimento da onda do S
  /** O meio do corpo: um ponto a cada DS cm, da cabeça (0) à ponta do rabo. */
  const DS = 3;
  const NP = Math.floor(LEN / DS) + 1;
  const LOOK = {
    body: { base: '#8c6d43', shade: 'rgba(46, 28, 12, 0.5)', light: 'rgba(255, 238, 200, 0.34)' },
    head: { base: '#84653e', shade: 'rgba(46, 28, 12, 0.46)', light: 'rgba(255, 238, 200, 0.36)' },
    jaw: { base: '#dcc794', shade: 'rgba(80, 52, 26, 0.4)', light: 'rgba(255, 250, 230, 0.4)' },
  };
  const MARK = '#3d2914'; // as manchas em "V"
  const MARK_RIM = '#c4a46e'; // a beirada clara delas
  const BELLY = '#dac48f'; // a barriga e os lábios
  const BELLY_SPOT = '#7a6448';
  const STRIPE = '#36240f'; // a risca do olho até a boca
  const EYE = '#f2c63c';
  const DARK = '#140c06';
  const TONGUE = '#d63a3a';
  const MOUTH = '#e58e9a'; // a boca por dentro
  const THROAT = '#8f3e4b';
  const FANG = '#fffaf0';
  const SPARK = '#b58cff';
  /** Até onde o desenho na superfície do corpo vai, a partir do lado que olha para a câmera (rad; 90° é a beirada). */
  const LIM = 83 * DEG;

  /** Espessura ao longo do corpo (u = 0 na cabeça, 1 na ponta do rabo), em fração de R. */
  function thickness(u) {
    if (u < 0.08) return 0.56 + (u / 0.08) * 0.26; // pescoço fino (a cabeça fica bem mais larga)
    if (u < 0.25) return 0.82 + ((u - 0.08) / 0.17) * 0.18;
    if (u < 0.6) return 1;
    return Math.max(0.15, 1 - Math.pow((u - 0.6) / 0.4, 1.25) * 0.87); // afina até a ponta
  }
  const RADS = Array.from({ length: NP }, (_, i) => R * thickness(Math.min(1, (i * DS) / LEN)));

  /**
   * As manchas em "V" (alternando os lados): onde ficam no corpo (cm da cabeça) e o lado (+1 / -1). O desenho de cada
   * uma vai em [ao longo (meia largura), ângulo no corte do corpo (graus a partir do lombo)]: a base larga embaixo, no
   * flanco, e a ponta lá em cima, quase no lombo; a beirada clara é a mesma forma, maior.
   */
  const MARKS = [];
  for (let s = 14 * S; s < LEN * 0.88; s += 17 * S) {
    MARKS.push({ s, sg: 1 });
    MARKS.push({ s: s + 8.5 * S, sg: -1 });
  }
  const MARK_SHAPE = [[-1, 100], [-0.5, 56], [0, 13], [0.5, 56], [1, 100], [0, 106]];
  const RIM_SHAPE = [[-1.3, 108], [-0.65, 52], [0, 4], [0.65, 52], [1.3, 108], [0, 114]];
  const MARK_MID = 57 * DEG;

  /**
   * A cabeça vista de cima (metade; cm antes do S, em volta do meio dela: x para a frente, y para o lado): larga atrás
   * (as bochechas do veneno), afinando até a ponta redonda do focinho.
   */
  const PLAN = [[-6.6, 4.0], [-6.1, 6.4], [-4.3, 7.7], [-1.5, 7.5], [1.6, 6.6], [4.6, 5.1], [7.0, 3.5], [8.8, 2.0], [9.8, 0.7]];
  const SNOUT = 10.1;
  /** A dobradiça da boca (cm antes do S), a linha da boca e a altura do meio da lateral. */
  const HX = -5.4, HZ = -1.0;
  const LIP = -1.0;
  const MIDZ = 0.3;
  /** O alto e o baixo da cabeça: a testa chata descendo até o focinho, o queixo subindo. */
  const topZ = (x) => 3.0 - 1.4 * M.smoothstep(-2, SNOUT, x);
  const botZ = (x) => -2.7 + 1.3 * M.smoothstep(-2, SNOUT, x);
  /**
   * O corte da cabeça (de cima para baixo): [altura entre o meio e o alto (+) ou o baixo (-), largura]: arredondado,
   * a testa e o queixo mais estreitos que as bochechas.
   */
  const RINGS = [[1, 0.55], [0.6, 0.9], [0, 1], [-0.55, 0.96], [-1, 0.7]];
  const ringZ = (x, k) => (k >= 0 ? MIDZ + (topZ(x) - MIDZ) * k : MIDZ + (MIDZ - botZ(x)) * k);
  /** Meia largura da cabeça na altura x (cm antes do S). */
  function halfW(x) {
    if (x <= PLAN[0][0]) return PLAN[0][1];
    for (let i = 1; i < PLAN.length; i++) {
      if (x <= PLAN[i][0]) {
        const k = (x - PLAN[i - 1][0]) / (PLAN[i][0] - PLAN[i - 1][0]);
        return PLAN[i - 1][1] + (PLAN[i][1] - PLAN[i - 1][1]) * k;
      }
    }
    const last = PLAN[PLAN.length - 1];
    return Math.max(0, last[1] * (1 - (x - last[0]) / (SNOUT - last[0])));
  }
  /** A lateral da cabeça na altura z (entre os anéis do corte). */
  function sideY(x, z) {
    const w = halfW(x);
    for (let i = 1; i < RINGS.length; i++) {
      const z0 = ringZ(x, RINGS[i - 1][0]), z1 = ringZ(x, RINGS[i][0]);
      if (z >= z1 || i === RINGS.length - 1) {
        const k = M.clamp01((z0 - z) / (z0 - z1 || 1));
        return w * M.lerp(RINGS[i - 1][1], RINGS[i][1], k);
      }
    }
    return w;
  }
  /** Ponto da cabeça (cm antes do S, em volta do meio dela) num quadro { o: a dobradiça, f, s, u }. */
  function hp(fr, x, y, z) {
    const a = (x - HX) * S, b = y * S, c = (z - HZ) * S;
    return {
      x: fr.o.x + fr.f.x * a + fr.s.x * b + fr.u.x * c,
      y: fr.o.y + fr.f.y * a + fr.s.y * b + fr.u.y * c,
      z: fr.o.z + fr.f.z * a + fr.s.z * b + fr.u.z * c,
    };
  }

  /** Bézier cúbica entre quatro pontos 3D. */
  function bez(a, b, c, d, t) {
    const s = 1 - t;
    const k0 = s * s * s, k1 = 3 * s * s * t, k2 = 3 * s * t * t, k3 = t * t * t;
    return { x: a.x * k0 + b.x * k1 + c.x * k2 + d.x * k3, y: a.y * k0 + b.y * k1 + c.y * k2 + d.y * k3, z: a.z * k0 + b.z * k1 + c.z * k2 + d.z * k3 };
  }
  /** Uma linha de pontos 3D com o comprimento acumulado (para andar nela por centímetro). */
  function polyline(pts) {
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + M.dist(pts[i - 1], pts[i]));
    return { pts, acc, len: acc[acc.length - 1] };
  }
  /** O ponto da curva a `d` cm do começo. */
  function along(sp, d) {
    const { pts, acc } = sp;
    if (d <= 0) return pts[0];
    if (d >= sp.len) return pts[pts.length - 1];
    let lo = 0, hi = acc.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (acc[mid] < d) lo = mid;
      else hi = mid;
    }
    return M.lerp3(pts[lo], pts[hi], (d - acc[lo]) / (acc[hi] - acc[lo] || 1));
  }

  /**
   * Um ângulo do corte do corpo levado para o lado que a câmera vê: `ref` é o meio do desenho (a mancha, a barriga),
   * `pc` o ângulo da câmera ali. O que passa da beirada fica espremido nela (some, como na vida).
   */
  function visAngle(phi, ref, pc) {
    const d = M.wrapAngle(ref - pc) + (phi - ref);
    return pc + (d < -LIM ? -LIM : d > LIM ? LIM : d);
  }

  /** Estrelinha de 4 pontas (as faíscas do encanto), em px de tela. */
  function star4(ctx, x, y, s) {
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

  /** Caminho fechado por pontos de tela [{x, y}]. */
  function loop(pts, path = new Path2D()) {
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
    path.closePath();
    return path;
  }

  class Jararaca extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 40 * S;
      this.top = 24 * S;
      this.ownDeath = true;
      this.acts = { windup: { dur: 0.65, hold: 0.9 }, bite: { dur: 0.42, hold: 0.5 }, strike: { dur: 0.42, hold: 0.5 } };
      /** 0 = esticada em S no chão, 1 = enrolada na rodilha com o pescoço erguido. */
      this.coil = 0;
      /** Para onde a rodilha está virada (rad): depois de formada fica quase parada, e só a cabeça mira. */
      this.coilYaw = yaw;
      /** Hora do último golpe: fica enrolada um tempo depois, se não sair andando. */
      this.lastAct = -9;
      /** Quanto andou (cm): a onda do corpo fica parada no chão enquanto ela avança. */
      this.dist = this.seed * 300;
      /** Para onde vai o tranco do golpe levado (no chão, unitário): para longe do herói, ou para trás. */
      this.recoilDir = { x: -Math.cos(yaw), y: -Math.sin(yaw) };
      this._resetTrail();
    }

    /** Para que lado ela se enrola (+1 ou -1, do sorteio): a rodilha, o S do pescoço e o giro do desmaio. */
    get hand() {
      return this.seed < 0.5 ? 1 : -1;
    }

    action(kind, yaw) {
      if (this.dying !== null) return;
      if (kind === 'hurt') {
        // o golpe quase sempre vem do herói (o servidor não diz de onde): o tranco vai para longe dele
        this.recoilDir = this._fromHero() || { x: -Math.cos(this.yaw), y: -Math.sin(this.yaw) };
      }
      super.action(kind, yaw);
    }

    /** Para longe do herói (unitário, no chão), se ele estiver perto. */
    _fromHero() {
      const h = this.near && this.near.hero;
      if (!h) return null;
      const ax = this.pos.x - h.x, ay = this.pos.y - h.y;
      const l = Math.hypot(ax, ay);
      return l > 1 && l < 600 ? { x: ax / l, y: ay / l } : null;
    }

    /** O clarão do golpe: curto e fraco (o tranco é que mostra a pancada). */
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

    /** Rastro reto atrás da cabeça (nasceu ou apareceu longe). */
    _resetTrail() {
      const fx = Math.cos(this.yaw), fy = Math.sin(this.yaw);
      this.trail = [];
      for (let s = STEP; s <= LEN + 40; s += STEP) this.trail.push({ x: this.pos.x - fx * s, y: this.pos.y - fy * s });
    }

    animate(dt) {
      const h = this.pos;
      const t0 = this.trail[0];
      const d = Math.hypot(h.x - t0.x, h.y - t0.y);
      if (d > 120) this._resetTrail();
      else if (d >= STEP * 2) {
        // o caminho da cabeça vira rastro, de STEP em STEP: o corpo passa por onde ela passou
        const n = Math.floor(d / STEP) - 1;
        const ux = (h.x - t0.x) / d, uy = (h.y - t0.y) / d;
        const add = [];
        for (let k = n; k >= 1; k--) add.push({ x: t0.x + ux * STEP * k, y: t0.y + uy * STEP * k });
        this.trail.unshift(...add);
        this.dist += n * STEP;
        const keep = Math.ceil((LEN + 40) / STEP) + 2;
        if (this.trail.length > keep) this.trail.length = keep;
      }
      const act = this.act;
      if (act) this.lastAct = this.time;
      const want = this.dying === null && (act || (this.time - this.lastAct < 1.6 && this.speed < 40)) ? 1 : 0;
      this.coil = M.damp(this.coil, want, want ? 10 : 4, dt);
      // a rodilha só vira enquanto se forma: depois fica (quase) parada e é o pescoço que mira
      if (this.coil < 0.35) this.coilYaw = this.yaw;
      else this.coilYaw = M.dampAngle(this.coilYaw, this.yaw, 1.5, dt);
      this.label = this.dying !== null ? 'caída' : act ? (act.kind === 'windup' ? 'preparando' : 'bote') : this.speed > 40 ? 'rastejando' : 'parada';
    }

    /** Ponto do rastro a `s` cm da cabeça (no chão). */
    _trailAt(s) {
      const tr = this.trail;
      const h = this.pos;
      const d0 = Math.hypot(h.x - tr[0].x, h.y - tr[0].y);
      if (s <= d0) {
        const k = d0 > 0 ? s / d0 : 0;
        return { x: h.x + (tr[0].x - h.x) * k, y: h.y + (tr[0].y - h.y) * k };
      }
      const r = (s - d0) / STEP;
      const i = Math.floor(r);
      if (i + 1 < tr.length) {
        const k = r - i;
        return { x: tr[i].x + (tr[i + 1].x - tr[i].x) * k, y: tr[i].y + (tr[i + 1].y - tr[i].y) * k };
      }
      const a = tr[tr.length - 2], b = tr[tr.length - 1];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ex = s - d0 - (tr.length - 1) * STEP;
      return { x: b.x + ((b.x - a.x) / l) * ex, y: b.y + ((b.y - a.y) / l) * ex };
    }

    /** O momento (o aviso, o bote, o tranco, o desmaio...), em números de 0 a 1. */
    _moment() {
      const act = this.act;
      const t = this.time;
      const dying = this.dying;
      const winding = act && act.kind === 'windup' ? act : null;
      const striking = act && (act.kind === 'strike' || act.kind === 'bite') ? act : null;
      let strike = 0, open = 0, pull = 0, tense = 0;
      if (striking) {
        // sai rápido (0,09 s), morde (fecha a boca) e volta para a rodilha
        const k = striking.t;
        strike = k < 0.09 ? M.easeOut(k / 0.09) : k < 0.16 ? 1 : 1 - M.easeInOut((k - 0.16) / 0.26);
        open = k < 0.06 ? 0.35 + 0.65 * M.smoothstep(0, 0.06, k) : 1 - M.smoothstep(0.11, 0.17, k);
        pull = 1 - M.clamp01(k / 0.07);
      } else if (winding) {
        // o aviso: puxa a cabeça para trás, treme de tensão e a boca começa a abrir
        pull = M.easeOut(M.clamp01(winding.t / 0.4));
        tense = M.smoothstep(0.2, 0.55, winding.t);
        open = 0.32 * M.smoothstep(0.42, 0.65, winding.t);
      }
      if (dying !== null) open = 0.28 * M.smoothstep(0.1, 0.3, dying);
      const relax = dying === null ? 0 : M.smoothstep(0, 0.5, dying);
      return {
        t,
        act,
        winding,
        striking,
        strike,
        open,
        pull,
        tense,
        coil: M.smoothstep(0, 1, this.coil) * (1 - relax),
        rec: this.recoil(),
        dying,
        relax,
        walk: M.clamp01(this.speed / 60),
        // inchada no aviso (as víboras fazem isso)
        puff: 1 + 0.08 * pull * (1 - strike),
      };
    }

    /** Parada: a cabeça olha em volta e às vezes ergue um pouco (`still`: 0 andando, enrolada ou caída). */
    _look(t, still) {
      return {
        yaw: M.noise1(t * 0.35 + this.seed * 9) * 0.5 * still,
        lift: Math.max(0, M.noise1(t * 0.23 + this.seed * 5 + 7)) * still,
      };
    }

    /**
     * Enrolada: a rodilha (uma espiral no chão, atrás do pé, de dentro para fora: a ponta do rabo fica do lado de fora)
     * e o pescoço subindo do meio dela num gancho até a cabeça, erguida em cima da beirada da frente. No bote, o pescoço
     * puxa corpo da rodilha (ela encolhe por fora) e ela escorrega para a frente. Devolve os pontos do meio do corpo e
     * para onde a cabeça olha.
     */
    _coiled(st) {
      const { t, strike, pull, tense, rec, winding } = st;
      const g = this.groundZ;
      const hand = this.hand;
      const f = { x: Math.cos(this.yaw), y: Math.sin(this.yaw), z: 0 };
      const side = { x: -f.y, y: f.x, z: 0 };
      const cy = this.coilYaw;
      const cf = { x: Math.cos(cy), y: Math.sin(cy), z: 0 };
      const back = (-24 + 16 * strike) * S;
      const cc = { x: this.pos.x + cf.x * back, y: this.pos.y + cf.y * back };
      // o começo da rodilha: perto do meio, na frente, por cima da primeira volta
      const RIN = 7 * S;
      const B0 = 2.2 * S;
      const thE = cy;
      const E = { x: cc.x + Math.cos(thE) * RIN, y: cc.y + Math.sin(thE) * RIN, z: g + R * 1.9 };
      const TE = M.norm({ x: -hand * Math.sin(thE) * RIN + B0 * Math.cos(thE), y: hand * Math.cos(thE) * RIN + B0 * Math.sin(thE), z: 0 });
      // a cabeça: em guarda, erguida em cima da beirada da frente; no aviso, puxada para trás e tremendo; no bote, longe
      const tremble = winding ? Math.sin(t * 47) * 0.9 * S * tense : 0;
      const ahead = M.lerp((-4 - 10 * pull) * S, 118 * S, strike);
      const high = M.lerp((30 + 3 * pull) * S, 9 * S, strike);
      const H = { x: this.pos.x + f.x * ahead + side.x * tremble, y: this.pos.y + f.y * ahead + side.y * tremble, z: g + high };
      const fh = M.norm({ x: f.x, y: f.y, z: -0.28 - 0.22 * strike + 0.12 * pull });
      // o pescoço: sai da cabeça para trás, faz a curva (a parte de trás do gancho, do lado de onde vem a rodilha) e desce
      // até o meio dela, entrando de lado. No aviso, o gancho puxa mais para trás (a mola armando); no bote, estica reto.
      const Ab = (7 + 5 * pull + 3 * rec) * S * (1 - strike);
      const Bl = (4 + 3 * pull) * S * (1 - strike) * hand;
      const mid0 = M.lerp3(H, E, 0.45);
      const Mid = { x: mid0.x - f.x * Ab - side.x * Bl, y: mid0.y - f.y * Ab - side.y * Bl, z: mid0.z + 2 * S * (1 - strike) };
      const Tm = M.norm(M.add(M.sub(E, H), M.scale(f, M.dist(E, H) * 0.1)));
      const k1 = M.dist(H, Mid) * 0.5, k2 = M.dist(Mid, E) * 0.5;
      const neck = [H];
      const seg = (a, b, c, d, n) => {
        for (let k = 1; k <= n; k++) neck.push(bez(a, b, c, d, k / n));
      };
      seg(H, M.sub(H, M.scale(f, k1)), M.sub(Mid, M.scale(Tm, k1 * 0.9)), Mid, 10);
      seg(Mid, M.add(Mid, M.scale(Tm, k2)), M.sub(E, M.scale(TE, k2)), E, 10);
      const sp = polyline(neck);
      const Ln = sp.len;
      // a espiral (de Arquimedes, do meio para fora): desce da primeira volta para o chão; a ponta do rabo, por fora,
      // treme no aviso (a jararaca faz isso quando se sente ameaçada)
      const rattle = winding ? Math.sin(t * 70) * 1.8 * S : 0;
      const pts = new Array(NP);
      for (let i = 0; i < NP; i++) {
        const s = i * DS;
        if (s <= Ln) {
          pts[i] = along(sp, s);
          continue;
        }
        const sg = s - Ln;
        const th = (-RIN + Math.sqrt(RIN * RIN + 2 * B0 * sg)) / B0;
        const rho = RIN + B0 * th + rattle * M.smoothstep(LEN * 0.84, LEN, s);
        const ang = thE + hand * th;
        const zz = RADS[i] * 0.92 + (E.z - g - RADS[i] * 0.92) * (1 - M.smoothstep(0, 22 * S, sg));
        pts[i] = { x: cc.x + Math.cos(ang) * rho, y: cc.y + Math.sin(ang) * rho, z: g + zz };
      }
      return { pts, fh };
    }

    /**
     * O corpo neste quadro: o meio (pontos 3D da cabeça ao rabo), em cada ponto o corte (`U` para o lombo, `SD` para o
     * lado, já girados no desmaio) e o ângulo da câmera nele, a cabeça ({ c, f, s, u }), os pontos de tela e as manchas.
     */
    _body(cam, st) {
      const { t, coil, rec, dying, relax, walk } = st;
      const g = this.groundZ;
      const f = { x: Math.cos(this.yaw), y: Math.sin(this.yaw), z: 0 };
      const look = this._look(t, (1 - walk) * (1 - coil) * (dying === null ? 1 : 0));
      // ---- esticada no chão: o rastro com a onda em S (a cabeça fica no meio, a onda cresce para trás)
      const amp = 12 * S * (1 + 0.6 * rec) * (1 - 0.5 * relax);
      const lift = (5 + 5 * look.lift) * S * (1 - relax);
      const coiled = coil > 0.001 ? this._coiled(st) : null;
      const pts = new Array(NP);
      for (let i = 0; i < NP; i++) {
        const s = i * DS;
        const p = this._trailAt(s);
        const q = this._trailAt(s + 2);
        let tx = p.x - q.x, ty = p.y - q.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const env = M.smoothstep(0, 22 * S, s) * (1 - 0.35 * M.smoothstep(LEN * 0.7, LEN, s));
        const off = amp * Math.sin((M.TAU * (this.dist - s)) / WAVE) * env;
        const a = { x: p.x - ty * off, y: p.y + tx * off, z: g + RADS[i] * 0.92 + lift * Math.max(0, 1 - s / (18 * S)) };
        pts[i] = coiled ? M.lerp3(a, coiled.pts[i], coil) : a;
      }
      // ---- a frente da cabeça: esticada, segue o pescoço (olhando em volta); enrolada, mira (no bote, para baixo)
      const t0 = M.norm({ x: pts[0].x - pts[2].x, y: pts[0].y - pts[2].y, z: 0 }, f);
      const cl = Math.cos(look.yaw), sl = Math.sin(look.yaw);
      const fFlat = M.norm({ x: t0.x * cl - t0.y * sl, y: t0.x * sl + t0.y * cl, z: (0.12 + 0.12 * look.lift) * (1 - relax) - 0.08 * relax });
      let fh = coiled ? M.norm(M.lerp3(fFlat, coiled.fh, coil), fFlat) : fFlat;
      // ---- o tranco: o corpo vai para longe de quem bateu (a cabeça mais) e a cabeça recua e sobe
      if (rec > 0.001) {
        const rd = this.recoilDir;
        for (let i = 0; i < NP; i++) {
          const s = i * DS;
          const w = 12 * S * rec * (1 - 0.6 * (s / LEN));
          const k = Math.max(0, 1 - s / (36 * S));
          const fl = k * k * rec;
          pts[i] = { x: pts[i].x + rd.x * w - fh.x * 7 * S * fl, y: pts[i].y + rd.y * w - fh.y * 7 * S * fl, z: pts[i].z + 6 * S * fl };
        }
        fh = M.norm(M.add(fh, { x: 0, y: 0, z: 0.55 * rec }));
      }
      // ---- o corte do corpo em cada ponto e o ângulo da câmera nele (o desmaio gira da cabeça para o rabo)
      const tc = cam.toCamera;
      const U = new Array(NP), SD = new Array(NP), PC = new Array(NP), WV = new Array(NP);
      const spin = (s) => (dying === null ? 0 : this.hand * Math.PI * M.smoothstep(0, 0.3, dying - 0.12 * (s / LEN)));
      // o lombo (U) vem do rabo para a cabeça, girando junto com o corpo: no chão é para cima, e onde o pescoço fica em
      // pé ele não vira de repente (o "para cima" de cada ponto virava, e as manchas e a barriga pulavam de lado)
      const TG = new Array(NP);
      for (let i = 0; i < NP; i++) TG[i] = M.norm(M.sub(pts[Math.min(NP - 1, i + 1)], pts[Math.max(0, i - 1)]), M.scale(fh, -1));
      let ref = UP;
      for (let i = NP - 1; i >= 0; i--) {
        const tg = TG[i];
        let u = M.sub(ref, M.scale(tg, M.dot(ref, tg)));
        const ul = M.len(u);
        u = ul > 0.05 ? M.scale(u, 1 / ul) : ref;
        ref = u;
        let sd = M.cross(tg, u);
        const ang = spin(i * DS);
        if (ang) {
          const c = Math.cos(ang), sn = Math.sin(ang);
          const u2 = M.add(M.scale(u, c), M.scale(sd, sn));
          sd = M.sub(M.scale(sd, c), M.scale(u, sn));
          u = u2;
        }
        U[i] = u;
        SD[i] = sd;
        const cx = M.dot(tc, u), cy = M.dot(tc, sd);
        PC[i] = Math.atan2(cy, cx);
        WV[i] = Math.hypot(cx, cy);
      }
      // ---- a cabeça: o mesmo giro do pescoço
      let hu = M.norm({ x: -fh.x * fh.z, y: -fh.y * fh.z, z: 1 - fh.z * fh.z });
      let hsd = M.cross(M.scale(fh, -1), hu);
      const a0 = spin(0);
      if (a0) {
        const c = Math.cos(a0), sn = Math.sin(a0);
        const u2 = M.add(M.scale(hu, c), M.scale(hsd, sn));
        hsd = M.sub(M.scale(hsd, c), M.scale(hu, sn));
        hu = u2;
      }
      const head = { c: pts[0], f: fh, s: M.scale(hsd, -1), u: hu };
      // ---- na tela
      const z = cam.zoom;
      const puff = st.puff;
      const q = pts.map((p) => cam.p(p));
      const rz = RADS.map((r) => r * z * puff);
      const B = { pts, U, SD, PC, WV, head, q, rz, puff, st, z };
      B.marks = this._markShapes(cam, B);
      return B;
    }

    /** O corte do corpo a `s` cm da cabeça (entre dois pontos do meio): o ponto, o lombo, o lado, o raio e a câmera. */
    _frameAt(B, s) {
      const x = M.clamp(s / DS, 0, NP - 1.001);
      const i = Math.floor(x), k = x - i;
      const p = M.lerp3(B.pts[i], B.pts[i + 1], k);
      const u = M.lerp3(B.U[i], B.U[i + 1], k);
      const sd = M.lerp3(B.SD[i], B.SD[i + 1], k);
      const r = (RADS[i] + (RADS[i + 1] - RADS[i]) * k) * B.puff;
      return { p, u, sd, r, pc: B.PC[i] + M.wrapAngle(B.PC[i + 1] - B.PC[i]) * k, wv: B.WV[i] + (B.WV[i + 1] - B.WV[i]) * k };
    }

    /** O ponto da superfície do corpo no corte `F`, no ângulo `phi` (a partir do lombo), na tela. */
    _surf(cam, F, phi) {
      const c = Math.cos(phi) * F.r, s = Math.sin(phi) * F.r;
      return cam.p({ x: F.p.x + F.u.x * c + F.sd.x * s, y: F.p.y + F.u.y * c + F.sd.y * s, z: F.p.z + F.u.z * c + F.sd.z * s });
    }

    /**
     * As manchas em "V" deste quadro, na tela: cada ponto da forma vai para a superfície do corpo, no lado que a câmera
     * vê (o que passa da beirada fica espremido nela). As do lado de trás não entram.
     */
    _markShapes(cam, B) {
      const out = [];
      const tc = cam.toCamera;
      const small = B.z < 0.85;
      for (const m of MARKS) {
        const F = this._frameAt(B, m.s);
        if (F.wv < 0.12) continue;
        const ref = m.sg * MARK_MID;
        const facing = M.dot(tc, F.u) * Math.cos(ref) + M.dot(tc, F.sd) * Math.sin(ref);
        if (facing < -0.3) continue;
        const w = 6.2 * S * (F.r / (R * B.puff));
        const shape = (list) =>
          list.map(([k, deg]) => {
            const G = k ? this._frameAt(B, m.s + k * w) : F;
            return this._surf(cam, G, visAngle(m.sg * deg * DEG, ref, G.pc));
          });
        out.push({ s: m.s, dark: shape(MARK_SHAPE), rim: small ? null : shape(RIM_SHAPE) });
      }
      return out;
    }

    parts(cam) {
      const st = this._moment();
      const B = this._body(cam, st);
      const z = cam.zoom;
      const ink = Math.max(1, 1.1 * z);
      const small = z < 0.85;
      const groups = [];
      const self = this;
      const headBalls = [
        { c: B.head.c, r: 7.5 * S },
        { c: M.add(B.head.c, M.scale(B.head.f, 6 * S)), r: 4.5 * S },
      ];
      const runs = this._runs(B, small);
      for (const run of runs) {
        const balls = [];
        for (let i = run.a; i <= run.b; i += 2) balls.push({ c: B.pts[i], r: RADS[i] });
        const head = run.a === 0;
        groups.push({
          balls: head ? balls.concat(headBalls) : balls,
          ref: B.pts[Math.round((run.a + run.b) / 2)],
          bias: 0,
          body: true,
          paint(ctx, flash) {
            self._paintTube(ctx, cam, B, run, ink, flash, small);
            // a cabeça vem logo depois do pescoço (cobre a ponta dele)
            if (head) self._paintHead(ctx, cam, B, ink, flash, small);
          },
        });
      }
      // ---- por cima: o risco do bote, a ponta do rabo tremendo e, desmaiada, o encanto saindo
      const heart = B.pts[Math.round(NP * 0.4)];
      const after = (ctx) => {
        if (st.striking && st.striking.t < 0.22) this._paintLunge(ctx, cam, B);
        if (st.winding) this._paintRattle(ctx, cam, B);
        if (st.dying !== null) this._release(ctx, cam, heart, st.dying);
      };
      // o nome: em cima da cabeça (enrolada, ela fica erguida)
      this.top = Math.max(B.head.c.z + 8 * S, this.groundZ + 18 * S) - this.groundZ + 12 * S;
      const paint = (ctx, flash) => {
        ctx.save();
        for (const g of C.byDepth(cam, groups)) g.paint(ctx, flash);
        ctx.restore();
      };
      return { groups, after, paint };
    }

    /**
     * O corpo em trechos: pedaços de 16 cm (no celular, 24) vão juntos enquanto não passam por cima de outra parte do
     * mesmo trecho na tela nem dobram (a curva mais fechada que o raio, nas pontas das voltas vistas desta câmera baixa).
     * A cobra esticada vira um trecho só; enrolada, vários, e cada um entra na sua vez pela distância da câmera. Pintar
     * os 13 pedaços sempre custava o dobro de um sagui.
     */
    _runs(B, small) {
      const q = B.q, rz = B.rz;
      const CH = small ? 24 : 16;
      const n = Math.ceil(LEN / CH);
      const idx = (s) => Math.max(0, Math.min(NP - 1, Math.round(s / DS)));
      // a curva na tela mais fechada que o raio (medida em 4 pontos: um só dava ruído); as curvas do S deitado, não
      const tight = (i) => {
        const i0 = Math.max(0, i - 2), i1 = Math.min(NP - 1, i + 2);
        const ax = q[i].x - q[i0].x, ay = q[i].y - q[i0].y, bx = q[i1].x - q[i].x, by = q[i1].y - q[i].y;
        const turn = Math.atan2(Math.abs(ax * by - ay * bx), ax * bx + ay * by);
        return turn > 0.08 && (Math.hypot(ax, ay) + Math.hypot(bx, by)) / 2 / turn < rz[i] * 0.9;
      };
      const hits = (a, b, c, d) => {
        for (let i = a; i <= b; i++) {
          for (let j = c; j <= d; j++) {
            const dx = q[i].x - q[j].x, dy = q[i].y - q[j].y, rr = (rz[i] + rz[j]) * 0.9;
            if (dx * dx + dy * dy < rr * rr) return true;
          }
        }
        return false;
      };
      // (o que fica a menos de 28 cm pelo corpo não conta: deitado no sentido da câmera, o corpo encolhe pela metade)
      const GAP = Math.ceil(28 / DS);
      const runs = [];
      let cur = null;
      for (let k = 0; k < n; k++) {
        const a = idx(k * CH), b = idx(Math.min(LEN, (k + 1) * CH));
        let folded = false;
        for (let i = Math.max(1, a); i <= Math.min(NP - 2, b) && !folded; i++) folded = tight(i);
        if (cur && !folded && !cur.folded && !(a - GAP >= cur.a && hits(a, b, cur.a, a - GAP))) {
          cur.b = b;
          continue;
        }
        cur = { a, b, folded };
        runs.push(cur);
      }
      // a pintura vai 3 cm além das emendas (os vizinhos se cobrem) e a sombra, 12 cm
      for (const r of runs) {
        r.s0 = r.a * DS;
        r.s1 = r.b * DS;
        r.a = Math.max(0, r.a - 1);
        r.b = Math.min(NP - 1, r.b + 1);
        r.aL = Math.max(0, r.a - 4);
        r.bL = Math.min(NP - 1, r.b + 4);
        r.cap = r.b === NP - 1;
      }
      return runs;
    }

    /**
     * Um trecho do corpo, pintado como o Birim: o contorno de tinta só nos lados (as emendas não), a cor, a barriga
     * creme e as manchas, e então a meia-lua de sombra e a faixa de brilho de um trecho mais comprido (a sombra corre
     * contínua de um trecho para o outro) — a largura delas acompanha o raio (o rabo fino não fica todo escuro).
     * O trecho que dobra na tela vira a soma de discos e trechos retos (todos no mesmo sentido: pintada, é a união deles,
     * por mais que dobre), e a sombra dele vai por camadas (uma fita dobrada se cruzaria: riscos e listras).
     */
    _paintTube(ctx, cam, B, ch, ink, flash, small) {
      const { a, b, aL, bL, cap, folded } = ch;
      const L = cam.lightScreen;
      const q = B.q, rz = B.rz;
      // as pontas: um disco da cor do corpo (dentro do tubo não muda nada; onde o corpo dobra ou afunda na tela bem na
      // emenda, ele arredonda o corte). Só aí a ponta vira beirada e ganha o risco.
      const ends = [];
      if (a > 0) ends.push([a, Math.max(0, a - 3), Math.min(b, a + 3)]);
      if (!cap) ends.push([b, Math.min(NP - 1, b + 3), Math.max(a, b - 3)]);
      const rims = [];
      for (const [i, out, inn] of ends) {
        const ox = q[out].x - q[i].x, oy = q[out].y - q[i].y, ix = q[i].x - q[inn].x, iy = q[i].y - q[inn].y;
        const lo = Math.hypot(ox, oy), li = Math.hypot(ix, iy);
        const back = lo > 0.3 && li > 0.3 ? (ox * ix + oy * iy) / (lo * li) : 1;
        if (lo < 0.35 * Math.abs(out - i) * DS * B.z || back < -0.2) rims.push({ i, ang: Math.atan2(iy, ix) });
      }
      let body;
      ctx.fillStyle = INK;
      ctx.strokeStyle = INK;
      if (folded) {
        const inner = [];
        for (let i = a + 1; i < b; i++) inner.push(i);
        const inkDiscs = inner.concat(rims.map((r) => r.i));
        if (cap) inkDiscs.push(b);
        const ip = this._tubePath(q, rz, a, b, ink, 0, 0, inkDiscs, new Path2D());
        this._tubePath(q, rz, a, b, ink, -L.x * ink * 0.5, -L.y * ink * 0.5, inkDiscs, ip);
        ctx.fill(ip);
        const discs = inner.concat(ends.map((e) => e[0]));
        if (cap) discs.push(b);
        body = this._tubePath(q, rz, a, b, 0, 0, 0, discs, new Path2D());
      } else {
        const shape = P.limbShape(q.slice(a, b + 1), rz.slice(a, b + 1), cap);
        const line = (dx, dy) => {
          const path = P.limbStrokePath(shape, dx, dy);
          for (const { i, ang } of rims) {
            path.moveTo(q[i].x + dx + Math.cos(ang - Math.PI / 2) * rz[i], q[i].y + dy + Math.sin(ang - Math.PI / 2) * rz[i]);
            path.arc(q[i].x + dx, q[i].y + dy, rz[i], ang - Math.PI / 2, ang + Math.PI / 2);
          }
          return path;
        };
        ctx.lineJoin = 'round';
        // (a ponta do risco fica reta: a redonda passava da emenda e riscava o trecho vizinho)
        ctx.lineCap = 'butt';
        ctx.lineWidth = ink * 2;
        ctx.stroke(line(0, 0));
        ctx.stroke(line(-L.x * ink * 0.5, -L.y * ink * 0.5));
        body = P.limbPath(shape);
        // (os discos no mesmo sentido do contorno: no sentido contrário, o "não zero" abria um buraco onde se cruzam)
        const poly = shape.poly;
        let area = 0;
        for (let i = 0, n = poly.length; i < n; i += 2) {
          const j = (i + 2) % n;
          area += poly[i] * poly[j + 1] - poly[j] * poly[i + 1];
        }
        for (const [i] of ends) {
          body.moveTo(q[i].x + rz[i], q[i].y);
          body.arc(q[i].x, q[i].y, rz[i], 0, M.TAU, area < 0);
        }
      }
      ctx.fillStyle = C.tint(LOOK.body.base, flash);
      ctx.fill(body);
      ctx.save();
      ctx.clip(body);
      // o trecho da sombra e do brilho vai além das emendas, mas para onde o corpo vira de repente na tela
      const reach = (from, to, step) => {
        let i = from;
        const d0x = q[from].x - q[from - step].x, d0y = q[from].y - q[from - step].y;
        const l0 = Math.hypot(d0x, d0y);
        while (i !== to) {
          const j = i + step;
          const dx = q[j].x - q[i].x, dy = q[j].y - q[i].y;
          const l = Math.hypot(dx, dy);
          if (l > 0.3 && l0 > 0.3 && (dx * d0x + dy * d0y) / (l * l0) < 0.5) break;
          i = j;
        }
        return i;
      };
      const a2 = a > aL && b > a ? reach(a, aL, -1) : aL;
      const b2 = bL > b && b > a ? reach(b, bL, 1) : bL;
      if (folded) {
        // a sombra por camadas: o trecho todo na cor da sombra e o lado da luz de volta na cor do corpo
        ctx.fillStyle = LOOK.body.shade;
        ctx.fill(body);
        ctx.fillStyle = C.tint(LOOK.body.base, flash);
        ctx.fill(this._tubePath(q, rz, a2, b2, 0, 0, 0, null, new Path2D(), L, 0.5));
      }
      this._paintBelly(ctx, cam, B, Math.max(0, a - 2), Math.min(NP - 1, b + 2), flash, small);
      this._paintMarks(ctx, B, ch, flash);
      if (!folded) {
        const qL = q.slice(a2, b2 + 1), rL = rz.slice(a2, b2 + 1);
        const lit = P.limbShape(qL, rL, cap);
        const moved = (k) => P.limbShape(qL.map((p, i) => ({ x: p.x + L.x * rL[i] * k, y: p.y + L.y * rL[i] * k })), rL, cap);
        const sh = P.limbPath(lit);
        P.limbPath(moved(0.5), 0, 0, sh);
        ctx.fillStyle = LOOK.body.shade;
        ctx.fill(sh, 'evenodd');
        if (!small) {
          const hl = P.limbPath(lit);
          P.limbPath(moved(-0.24), 0, 0, hl);
          ctx.fillStyle = LOOK.body.light;
          ctx.fill(hl, 'evenodd');
        }
      }
      ctx.restore();
    }

    /**
     * O tubo de q[a..b] (raio rz + `pad` px, deslocado de dx, dy) como soma de trechos retos e discos (`discs`: em quais
     * pontos; null = todos), todos no mesmo sentido: pintado, é a união deles, por mais que dobre. `L`, `k`: cada ponto
     * vai para o lado da luz k vezes o raio (o lado iluminado da sombra por camadas).
     */
    _tubePath(q, rz, a, b, pad, dx, dy, discs, path, L = null, k = 0) {
      const at = (i) => (L ? { x: q[i].x + L.x * rz[i] * k + dx, y: q[i].y + L.y * rz[i] * k + dy } : { x: q[i].x + dx, y: q[i].y + dy });
      let p0 = at(a);
      for (let i = a; i < b; i++) {
        const p1 = at(i + 1);
        let tx = p1.x - p0.x, ty = p1.y - p0.y;
        const l = Math.hypot(tx, ty);
        if (l > 1e-3) {
          tx /= l;
          ty /= l;
          const r0 = rz[i] + pad, r1 = rz[i + 1] + pad;
          path.moveTo(p0.x - ty * r0, p0.y + tx * r0);
          path.lineTo(p1.x - ty * r1, p1.y + tx * r1);
          path.lineTo(p1.x + ty * r1, p1.y - tx * r1);
          path.lineTo(p0.x + ty * r0, p0.y - tx * r0);
          path.closePath();
        }
        p0 = p1;
      }
      const list = discs || Array.from({ length: b - a + 1 }, (_, j) => a + j);
      for (const i of list) {
        const c = at(i);
        const r = rz[i] + pad;
        path.moveTo(c.x + r, c.y);
        path.arc(c.x, c.y, r, 0, M.TAU, true);
      }
      return path;
    }

    /** A barriga creme: aparece na beirada de baixo do flanco que olha para a câmera (e inteira, de barriga para cima). */
    _paintBelly(ctx, cam, B, a, b, flash, small) {
      ctx.fillStyle = C.tint(BELLY, flash);
      for (const sg of [-1, 1]) {
        const ref = sg * 142 * DEG;
        const top = [], bot = [];
        let open = 0;
        for (let i = a; i <= b; i++) {
          const F = { p: B.pts[i], u: B.U[i], sd: B.SD[i], r: RADS[i] * B.puff };
          const p1 = visAngle(sg * 104 * DEG, ref, B.PC[i]), p2 = visAngle(sg * 180 * DEG, ref, B.PC[i]);
          open = Math.max(open, Math.abs(p2 - p1));
          top.push(this._surf(cam, F, p1));
          bot.push(this._surf(cam, F, p2));
        }
        if (open < 0.06) continue;
        ctx.fill(loop(top.concat(bot.reverse())));
      }
      // de barriga para cima: as pintinhas escuras da barriga
      if (B.st.dying !== null && B.st.dying > 0.15 && !small) {
        ctx.fillStyle = C.tint(BELLY_SPOT, flash);
        ctx.beginPath();
        for (let i = a + ((3 - (a % 3)) % 3); i <= b; i += 3) {
          if (i < 4 || i > NP - 6) continue;
          const sg = i % 2 ? 1 : -1;
          const phi = Math.PI + sg * 0.35;
          const F = { p: B.pts[i], u: B.U[i], sd: B.SD[i], r: RADS[i] * B.puff };
          if (Math.abs(M.wrapAngle(phi - B.PC[i])) > 1.2) continue;
          const q = this._surf(cam, F, phi);
          const rr = RADS[i] * 0.16 * B.z;
          ctx.moveTo(q.x + rr, q.y);
          ctx.arc(q.x, q.y, rr, 0, M.TAU);
        }
        ctx.fill();
      }
    }

    /** As manchas em "V" deste pedaço (as que encostam nele): a beirada clara e a mancha escura. */
    _paintMarks(ctx, B, ch, flash) {
      const s0 = ch.s0 - 9 * S, s1 = ch.s1 + 9 * S;
      let rim = null, dark = null;
      for (const m of B.marks) {
        if (m.s < s0 || m.s > s1) continue;
        if (m.rim) loop(m.rim, rim || (rim = new Path2D()));
        loop(m.dark, dark || (dark = new Path2D()));
      }
      if (rim) {
        ctx.fillStyle = C.tint(MARK_RIM, flash);
        ctx.fill(rim);
      }
      if (dark) {
        ctx.fillStyle = C.tint(MARK, flash);
        ctx.fill(dark);
      }
    }

    /**
     * A cabeça em ponta de lança (a de cima e, de boca aberta, o queixo), pintada como o corpo: por dentro, o lábio
     * claro, a risca do olho até a boca e a linha da boca; por cima da luz, o olho de fenda debaixo da "sobrancelha".
     * De boca aberta (aviso e bote), o queixo desce, aparece o rosa de dentro e as duas presas.
     */
    _paintHead(ctx, cam, B, ink, flash, small) {
      const st = B.st;
      const H = B.head;
      const z = cam.zoom;
      const tc = cam.toCamera;
      const alpha = st.open * 1.45; // a boca aberta (rad)
      const kOpen = M.smoothstep(0, 0.12, alpha);
      const hinge = M.add(H.c, M.add(M.scale(H.f, HX * S), M.scale(H.u, HZ * S)));
      const ua = alpha * 0.42, la = alpha * 0.58;
      const UF = {
        o: hinge,
        f: M.add(M.scale(H.f, Math.cos(ua)), M.scale(H.u, Math.sin(ua))),
        s: H.s,
        u: M.sub(M.scale(H.u, Math.cos(ua)), M.scale(H.f, Math.sin(ua))),
      };
      const LF = {
        o: hinge,
        f: M.sub(M.scale(H.f, Math.cos(la)), M.scale(H.u, Math.sin(la))),
        s: H.s,
        u: M.add(M.scale(H.u, Math.cos(la)), M.scale(H.f, Math.sin(la))),
      };
      const sp = (p) => cam.p(p);
      // a língua: sai do focinho de boca fechada (atrás da cabeça se ela olha para longe da câmera)
      const tongueFirst = M.dot(H.f, tc) < -0.25;
      if (tongueFirst) this._paintTongue(ctx, cam, B, UF);
      // ---- de boca aberta: o queixo, o rosa de dentro e as presas (a cabeça de cima vem depois, por cima)
      if (kOpen > 0.02) {
        const jaw = [];
        for (const [x, w] of PLAN) {
          if (x > 9) continue;
          for (const sg of [-1, 1]) {
            const a = sp(hp(LF, x, sg * w * 0.86, LIP)), b = sp(hp(LF, x, sg * w * 0.78, botZ(x)));
            jaw.push(a.x, a.y, b.x, b.y);
          }
        }
        const chin = sp(hp(LF, 9.3, 0, -1.4));
        jaw.push(chin.x, chin.y);
        const jh = SH.convexHull(jaw);
        P.paintLit(ctx, cam, (dx, dy, p) => SH.fillPath(jh, dx, dy, p), LOOK.jaw, 2.2 * z, ink, flash, {
          stroke: (dx, dy, p) => SH.polyPath(jh, dx, dy, p),
          heavy: false,
        });
        // o rosa de dentro: entre a beirada de cima e a de baixo
        const lipLine = (fr) => {
          const right = [], left = [];
          for (let x = -4.8; x <= 9.4; x += 1.6) {
            const w = halfW(x) * 0.8;
            right.push(sp(hp(fr, x, w, LIP)));
            left.push(sp(hp(fr, x, -w, LIP)));
          }
          return right.concat(left.reverse());
        };
        const mouth = lipLine(UF).concat(lipLine(LF).reverse());
        ctx.fillStyle = C.tint(MOUTH, flash);
        ctx.fill(loop(mouth));
        const t0 = sp(hp(UF, -4.2, 0, LIP)), t1 = sp(hp(LF, -4.2, 0, LIP));
        const rr = Math.max(1, Math.hypot(t1.x - t0.x, t1.y - t0.y) * 0.45);
        ctx.fillStyle = C.tint(THROAT, flash);
        ctx.beginPath();
        ctx.ellipse((t0.x + t1.x) / 2, (t0.y + t1.y) / 2, rr * 1.25, rr, 0, 0, M.TAU);
        ctx.fill();
        // as presas: penduradas na frente da boca de cima (só quando dá para ver dentro da boca)
        if (kOpen > 0.3 && M.dot(UF.f, tc) > -0.45) {
          ctx.lineCap = 'round';
          for (const w of [ink * 2.2, Math.max(1, 1.25 * z)]) {
            ctx.strokeStyle = w > ink * 2 ? INK : FANG;
            ctx.lineWidth = w;
            ctx.beginPath();
            for (const sg of [-1, 1]) {
              const a = sp(hp(UF, 7.1, sg * 2.6, LIP + 0.2)), m = sp(hp(UF, 6.9, sg * 2.55, LIP - 1.7)), b = sp(hp(UF, 6.0, sg * 2.4, LIP - 3.1 * kOpen));
              ctx.moveTo(a.x, a.y);
              ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
            }
            ctx.stroke();
          }
        }
      }
      // ---- a cabeça de cima: o casco dos anéis (de cima, do meio e de baixo; de boca aberta, o de baixo sobe até a boca)
      const pts = [];
      const push = (p) => {
        const q = sp(p);
        pts.push(q.x, q.y);
      };
      for (const [x, w] of PLAN) {
        for (const [k, wk] of RINGS) {
          const zz = k >= 0 ? ringZ(x, k) : Math.max(ringZ(x, k), M.lerp(ringZ(x, k), LIP, kOpen));
          push(hp(UF, x, w * wk, zz));
          push(hp(UF, x, -w * wk, zz));
        }
      }
      push(hp(UF, SNOUT, 0, MIDZ + 0.1));
      push(hp(UF, SNOUT - 0.4, 0, topZ(SNOUT) - 0.15));
      push(hp(UF, SNOUT - 0.4, 0, M.lerp(botZ(SNOUT), LIP, kOpen) + 0.15));
      const hull = SH.convexHull(pts);
      P.paintLit(ctx, cam, (dx, dy, p) => SH.fillPath(hull, dx, dy, p), LOOK.head, 2.6 * z, ink, flash, {
        stroke: (dx, dy, p) => SH.polyPath(hull, dx, dy, p),
        inside: (c) => this._headMarks(c, cam, B, UF, kOpen, flash, small),
        after: (c) => this._eyes(c, cam, B, UF, ink, flash, small),
      });
      if (!tongueFirst) this._paintTongue(ctx, cam, B, UF);
    }

    /** Por dentro da cabeça (debaixo da luz): o lábio claro, a risca do olho até o canto da boca e a linha da boca. */
    _headMarks(ctx, cam, B, UF, kOpen, flash, small) {
      const tc = cam.toCamera;
      const sp = (p) => cam.p(p);
      for (const sg of [-1, 1]) {
        const n = M.norm(M.add(M.scale(UF.s, sg * 0.94), M.scale(UF.u, 0.12)));
        if (M.dot(n, tc) < 0) continue;
        // o lábio (creme): a metade de baixo da lateral, do canto da boca ao focinho
        const up = [], low = [];
        for (let x = -5.8; x <= 9.6; x += 1.4) {
          const zt = -0.5;
          const zb = M.lerp(botZ(x), LIP, kOpen) - 0.2;
          up.push(sp(hp(UF, x, sg * sideY(x, zt) * 1.02, zt)));
          low.push(sp(hp(UF, x, sg * sideY(x, zb) * 1.02, zb)));
        }
        ctx.fillStyle = C.tint(BELLY, flash);
        ctx.fill(loop(up.concat(low.reverse())));
        // a risca escura: do olho até o canto da boca
        const stripe = [[1.4, 0.9], [1.7, -0.15], [-5.9, -2.0], [-6.4, -0.8]].map(([x, zz]) => sp(hp(UF, x, sg * sideY(x, zz) * 1.03, zz)));
        ctx.fillStyle = C.tint(STRIPE, flash);
        ctx.fill(loop(stripe));
      }
    }

    /** O olho amarelo de fenda (fechado, desmaiada), a "sobrancelha" de escama por cima, a fosseta e a narina. */
    _eyes(ctx, cam, B, UF, ink, flash, small) {
      const st = B.st;
      const tc = cam.toCamera;
      const sp = (p) => cam.p(p);
      for (const sg of [-1, 1]) {
        const n = M.norm(M.add(M.scale(UF.s, sg * 0.8), M.add(M.scale(UF.u, 0.52), M.scale(UF.f, 0.3))));
        const facing = M.dot(n, tc);
        if (facing < 0.04) continue;
        const c = hp(UF, 3.0, sg * sideY(3.0, 1.2) * 1.05, 1.2);
        let v = M.norm(M.cross(n, UF.f));
        if (M.dot(v, UF.u) < 0) v = M.scale(v, -1);
        if (st.dying !== null) {
          P.decal(ctx, cam, { c, n, u: UF.f, v, ru: 1.7 * S, rv: 0.3 * S, color: DARK, minFacing: 0.04 }, 0);
        } else {
          P.decal(ctx, cam, { c, n, u: UF.f, v, ru: 1.75 * S, rv: 1.4 * S, color: C.eyeColor(EYE), glow: C.eyeGlow('rgba(255, 214, 80, 0.55)'), minFacing: 0.04 }, flash);
          P.decal(ctx, cam, { c: M.add(c, M.scale(n, 0.05)), n, u: UF.f, v, ru: 0.38 * S, rv: 1.25 * S, color: DARK, minFacing: 0.04 }, 0);
          if (!small) P.decal(ctx, cam, { c: M.add(M.add(c, M.scale(UF.f, 0.6 * S)), M.add(M.scale(v, 0.55 * S), M.scale(n, 0.1))), n, u: UF.f, v, ru: 0.36 * S, rv: 0.36 * S, color: '#fffbe8', minFacing: 0.04 }, 0);
        }
        // a "sobrancelha": a escama na quina de cima, por cima do olho (no aviso e no bote, mais baixa na frente: brava)
        const angry = Math.max(st.tense, st.strike);
        const brow = [[0.9, 0], [3.0, 0.1], [5.0, -0.55 * angry]].map(([x, dz]) => {
          const zz = ringZ(x, 0.6) + 0.15 + dz;
          return sp(hp(UF, x, sg * sideY(x, zz) * 1.05, zz));
        });
        ctx.strokeStyle = INK;
        ctx.lineCap = 'round';
        ctx.lineWidth = ink * 1.15;
        ctx.beginPath();
        ctx.moveTo(brow[0].x, brow[0].y);
        ctx.quadraticCurveTo(brow[1].x, brow[1].y, brow[2].x, brow[2].y);
        ctx.stroke();
        // a narina, na ponta do focinho (só de perto e virada para a câmera)
        const ns = M.norm(M.add(M.scale(UF.s, sg * 0.7), M.scale(UF.f, 0.7)));
        if (!small && M.dot(ns, tc) > 0.25) {
          const q = sp(hp(UF, 8.9, sg * sideY(8.9, 1.0) * 1.05, 1.0));
          const rr = Math.max(0.7, 0.42 * S * cam.zoom);
          ctx.fillStyle = DARK;
          ctx.beginPath();
          ctx.arc(q.x, q.y, rr, 0, M.TAU);
          ctx.fill();
        }
      }
    }

    /** A língua bifurcada: entra e sai de vez em quando (sem parar no aviso); desmaiada, fica de fora, mole. */
    _paintTongue(ctx, cam, B, UF) {
      const st = B.st;
      const t = st.t;
      let ext = 0;
      if (st.dying !== null) ext = 0.55;
      else if (st.striking || st.open > 0.15) ext = 0;
      else if (st.winding) ext = Math.max(0, Math.sin(((t * 6) % 1) * Math.PI));
      else {
        const ph = ((t + this.seed * 3) % 1.9) / 0.34;
        ext = ph < 1 ? Math.sin(ph * Math.PI) : 0;
      }
      if (ext < 0.05) return;
      const z = cam.zoom;
      const droop = st.dying !== null ? -2.6 * S : Math.sin(t * 55) * 1.1 * S * ext;
      const base = hp(UF, SNOUT - 0.4, 0, -0.6);
      const mid = M.add(M.add(base, M.scale(UF.f, 7 * S * ext)), M.scale(UF.u, droop * 0.5));
      const tips = [-1, 1].map((sg) => M.add(M.add(mid, M.scale(UF.f, 2.8 * S * ext)), M.add(M.scale(UF.s, sg * 1.7 * S * ext), M.scale(UF.u, droop))));
      const a = cam.p(base), b = cam.p(mid);
      ctx.save();
      ctx.strokeStyle = TONGUE;
      ctx.lineWidth = Math.max(1, 1.5 * z);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      for (const tp of tips) {
        const q = cam.p(tp);
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    /** O bote: três riscos de vento atrás da cabeça, sumindo. */
    _paintLunge(ctx, cam, B) {
      const st = B.st;
      const k = st.striking.t / 0.22;
      const H = B.head;
      const z = cam.zoom;
      const back = { x: -H.f.x, y: -H.f.y, z: 0 };
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255, 248, 226, ${(0.85 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 1.6 * z;
      ctx.beginPath();
      for (const o of [-1, 0, 1]) {
        const p0 = M.add(H.c, M.add(M.scale(back, (13 + 5 * Math.abs(o)) * S), M.scale(H.s, o * 6.5 * S)));
        const p1 = M.add(p0, M.scale(back, (40 - 12 * Math.abs(o)) * S * (0.35 + 0.65 * st.strike)));
        const a = cam.p(p0), b = cam.p(p1);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    /** No aviso: a ponta do rabo tremendo (os risquinhos dos dois lados). */
    _paintRattle(ctx, cam, B) {
      const st = B.st;
      const k = M.smoothstep(0.1, 0.3, st.winding.t);
      if (k <= 0) return;
      const z = cam.zoom;
      const tip = cam.p(B.pts[NP - 1]), prev = cam.p(B.pts[NP - 5]);
      const a = Math.atan2(tip.y - prev.y, tip.x - prev.x) + Math.PI / 2;
      const pulse = 0.55 + 0.45 * Math.sin(st.t * 38);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255, 246, 220, ${(0.8 * k * pulse).toFixed(3)})`;
      ctx.lineWidth = 1.3 * z;
      ctx.beginPath();
      for (const r of [5, 8.5]) {
        for (const side of [0, Math.PI]) {
          const c = a + side;
          ctx.moveTo(tip.x + Math.cos(c - 0.55) * r * z, tip.y + Math.sin(c - 0.55) * r * z);
          ctx.arc(tip.x, tip.y, r * z, c - 0.55, c + 0.55);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    /**
     * Desmaiada: o encanto sai do corpo — um clarão lilás e as faíscas roxas que se espalham e sobem, sumindo (o motor
     * tira o desenho 0,7 s depois da queda; o corpo apaga de 0,4 a 0,7 s). O mesmo do sagui, do quati e do tatu.
     */
    _release(ctx, cam, heart, d) {
      const z = cam.zoom;
      const q = cam.p(heart);
      if (d < 0.5) {
        const k = d / 0.5;
        const rr = (12 + 24 * M.easeOut(k)) * S * z;
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr);
        g.addColorStop(0, `rgba(214, 178, 255, ${0.55 * (1 - k)})`);
        g.addColorStop(1, 'rgba(180, 140, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rr, 0, M.TAU);
        ctx.fill();
      }
      const N = 14;
      ctx.save();
      const base = ctx.globalAlpha;
      for (let i = 0; i < N; i++) {
        const r1 = C.hash01(i * 3.1 + this.seed * 50), r2 = C.hash01(i * 7.7 + 1.3), r3 = C.hash01(i * 1.9 + 4.2);
        const t0 = 0.04 + r3 * 0.14;
        const k = (d - t0) / 0.5;
        if (k <= 0 || k >= 1) continue;
        const a = (i / N) * M.TAU + r1 * 0.7;
        const dist = (8 + 20 * r2) * S * M.easeOut(k);
        const rise = (10 + 40 * r1) * S * k;
        const p = cam.p({ x: heart.x + Math.cos(a) * dist, y: heart.y + Math.sin(a) * dist, z: heart.z + rise });
        const s = (2.2 + 1.8 * r2) * z * (1 - 0.55 * k);
        ctx.globalAlpha = base * (k < 0.12 ? k / 0.12 : 1 - M.smoothstep(0.5, 1, k));
        ctx.fillStyle = 'rgba(181, 140, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 2.2, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = SPARK;
        star4(ctx, p.x, p.y, s);
        ctx.fill();
        ctx.fillStyle = '#f4ecff';
        star4(ctx, p.x, p.y, s * 0.45);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  C.define('jararaca', Jararaca);
  PD.Jararaca = Jararaca;
})(window.PD = window.PD || {});
