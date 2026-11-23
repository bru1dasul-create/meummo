// Quati (o bicho da mata do sul do Capão, em bando de 4; a [estrutura] fez as regras em 15/11): o corpo comprido e
// baixo, marrom-alaranjado, com o lombo mais escuro e a barriga cor de creme; as patas escuras; o focinho comprido,
// virado para cima na ponta e sempre mexendo (farejando); a máscara no rosto (a cara escura com as marcas brancas em
// cima e embaixo dos olhos e dos lados do focinho); as orelhinhas redondas de borda branca e o rabo comprido em pé,
// peludo, com os anéis claros e escuros. Anda num trotezinho (as patas em diagonal) e, parado, fareja o ar ou abaixa o
// focinho no chão.
// Redesenho (23/11, a etapa 2 dos inimigos, aprovada pelo dono: "pode seguir para o Quati"): sem as bolinhas — pintado
// como o Birim e o sagui novo (o contorno de tinta mais grosso do lado da sombra, a meia-lua de sombra e a faixa de
// brilho), com a beirada em mechas de pelo (PD.creatures.paint). No aviso ('windup') se encolhe nas patas de trás,
// arqueia o lombo, arrepia o pelo e o rabo, abaixa as orelhas e rosna mostrando os dentes; na mordida ('bite') dá o
// bote para a frente, escancara a boca e fecha. Apanhando, dá um tranco para longe de quem bateu; caindo, desmaia de
// bruços e o encanto sai do corpo em faíscas roxas. As bolas ficam só para a sombra no chão e a caixa do desenho.
//   PD.creatures.create('quati', xCm, yCm, yaw)
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  if (!C) return;
  const P = C.paint;
  const SH = PD.shapes;
  const { tube } = C;

  /** Tamanho de jogo: maior que o de verdade (uns 45 cm de corpo), para ler com a câmera longe. */
  const S = 1.35;
  // as cores: a cor de cada parte e a sombra e o brilho transparentes por cima (escurecem e clareiam os detalhes juntos)
  const SHADE = 'rgba(48, 30, 42, 0.42)';
  const LIGHT = 'rgba(255, 243, 222, 0.32)';
  const LOOK = {
    fur: { base: '#b0662e', shade: SHADE, light: LIGHT },
    head: { base: '#a95f2a', shade: SHADE, light: LIGHT },
    leg: { base: '#4c3020', shade: 'rgba(22, 10, 8, 0.42)', light: 'rgba(255, 232, 200, 0.22)' },
    foot: { base: '#2a1a11', shade: SHADE, light: LIGHT },
    snout: { base: '#5c3620', shade: 'rgba(20, 10, 8, 0.4)', light: 'rgba(255, 236, 210, 0.3)' },
    chin: { base: '#d8bf98', shade: SHADE, light: LIGHT },
    tail: { base: '#d59e5f', shade: SHADE, light: LIGHT },
    ear: { base: '#5c3925', shade: SHADE, light: LIGHT },
  };
  const BACK = '#86491f'; // o lombo mais escuro
  const BELLY = '#e8c088'; // a barriga, o peito e a garganta cor de creme
  const RING = '#4f301d'; // os anéis escuros do rabo
  const MASK = '#36231a'; // a máscara escura em volta dos olhos
  const SPOT = '#f6ecd6'; // as marcas brancas do rosto e a borda das orelhas
  const NOSE = '#140b08';
  const EYE = '#1a0f08';
  const MOUTH = '#5e1b17';
  const TOOTH = '#fbf6ea';
  const LID = '#d2b08c'; // olho fechado ou apertado: o risco claro na cara escura
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

  /** A forma lisa da sombra e do brilho: o casco dos mesmos círculos de tela com o raio `px` maior (cobre as mechas). */
  function padHull(disks, px) {
    return SH.circleHull(disks.map((d) => ({ x: d.x, y: d.y, r: d.r + px })), 0.35);
  }

  /** Pequeno na tela (o zoom do celular, 0,7): menos mechas e as patas sem a sombra pintada (mais leve). */
  const small = (z) => z < 0.85;

  /** Estrelinha de 4 pontas (as faíscas do encanto), em px de tela. */
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

  /** Círculos de tela (x, y, r em px) das bolas 3D, para o casco. */
  function disksOf(cam, balls) {
    const z = cam.zoom;
    return balls.map((b) => {
      const q = cam.p(b.c);
      return { x: q.x, y: q.y, r: b.r * z };
    });
  }

  class Quati extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 30 * S;
      this.top = 56 * S;
      this.acts = { windup: { dur: 0.45, hold: 0.4 }, bite: { dur: 0.32, hold: 0.25 } };
      /** Parado (0) a trotando (1). */
      this.trot = 0;
      /** Focinho baixo farejando o chão (0 a 1). */
      this.sniff = 0;
      /** Encolhido no aviso (0 a 1): vai junto com o preparo e solta rápido no bote. */
      this.wind = 0;
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
      this.trot = this.dying !== null ? 0 : M.smoothstep(6, 60, this.speed);
      const act = this.act;
      const want = this.dying === null && !act && this.trot < 0.2 && M.noise1(this.time * 0.2 + this.seed * 40) > 0.45;
      this.sniff = M.damp(this.sniff, want ? 1 : 0, want ? 3 : 6, dt);
      // o aviso encolhe junto com o preparo; no bote (e depois), solta rápido
      const winding = act && act.kind === 'windup';
      this.wind = M.damp(this.wind, winding ? M.easeOut(M.clamp01(act.t / act.dur)) : 0, winding ? 30 : act ? 16 : 7, dt);
      // passada curta e rápida: uns 38 cm por ciclo
      this.phase = (this.phase + (this.speed * dt) / (38 * S)) % 1;
      this.label = this.dying !== null ? 'caído' : act ? (act.kind === 'windup' ? 'preparando' : 'mordendo') : this.trot > 0.5 ? 'trotando' : this.sniff > 0.5 ? 'farejando' : 'parado';
    }

    /** O momento (o golpe, o tranco, o desmaio...), em números de 0 a 1. */
    _moment() {
      const act = this.act;
      const t = this.time;
      const dying = this.dying;
      let lunge = 0;
      let open = 0;
      if (act && act.kind === 'bite') {
        const k = act.t;
        // o bote: vai rápido (0,07 s), segura e volta
        lunge = k < 0.07 ? M.easeOut(k / 0.07) : k < 0.14 ? 1 : 1 - M.easeInOut(M.clamp01((k - 0.14) / 0.3));
        // a boca escancara no bote e fecha com tudo (o "nhac")
        open = k < 0.05 ? M.easeOut(k / 0.05) : k < 0.1 ? 1 - M.easeIn((k - 0.05) / 0.05) : 0;
      }
      const wind = this.wind;
      // segurando o preparo (0..1): no fim, o corpo treme
      const hold = act && act.kind === 'windup' && act.hold > 0 ? M.clamp01((act.t - act.dur) / act.hold) : 0;
      // no aviso, a boca vai abrindo no rosnado (mostra os dentes), tremendo
      if (dying === null) open = Math.max(open, wind * (0.62 + 0.08 * Math.sin(t * 23) + 0.2 * hold));
      const rd = this.recoilDir;
      return {
        t,
        act,
        wind,
        hold,
        lunge,
        open,
        rec: this.recoil(),
        hop: this.hurtT < 0.3 ? Math.sin((this.hurtT / 0.3) * Math.PI) : 0,
        dying,
        // desmaio: despenca de bruços em 0,26 s e quica de leve; as patas abrem e o rabo deita
        slump: dying === null ? 0 : M.easeIn(M.clamp01(dying / 0.26)),
        land: dying === null ? 0 : Math.max(0, Math.sin(M.clamp01((dying - 0.26) / 0.16) * Math.PI)) * 2.2,
        trot: this.trot,
        sniff: M.smoothstep(0, 1, this.sniff),
        // o tranco empurra para o lado do `recoilDir`: de frente para quem bateu, o corpo verga para trás
        push: rd.x * Math.cos(this.yaw) + rd.y * Math.sin(this.yaw),
      };
    }

    _fwd() {
      return { x: Math.cos(this.yaw), y: Math.sin(this.yaw), z: 0 };
    }
    _side() {
      return { x: -Math.sin(this.yaw), y: Math.cos(this.yaw), z: 0 };
    }

    /** A pose (pontos 3D) e as partes pintadas, cada uma com as bolas da sombra e o seu desenho. */
    parts(cam) {
      const st = this._moment();
      return this._build(cam, this._rig(st), st);
    }

    /** O esqueleto (pontos 3D em cm): o lombo, a cabeça e o focinho, o queixo, as orelhas, as patas e o rabo. */
    _rig(st) {
      const { t, wind, hold, lunge, open, rec, hop, slump, land, trot, sniff, push } = st;
      const ph = this.phase * M.TAU;
      const D = (v, lying) => M.lerp(v, lying, slump);
      const bob = Math.sin(ph * 2) * 1.4 * trot;
      const shake = hold > 0.7 ? (Math.sin(t * 70) * 0.7 * (hold - 0.7)) / 0.3 : 0; // a tremidinha antes do bote
      const breath = Math.sin(t * 2.6 + this.seed * 6) * 0.5 * (1 - trot);
      const rd = this.recoilDir;
      const fwd = this._fwd();
      const side = this._side();
      // o corpo: o tranco (para longe de quem bateu), o pulinho, o bote (para a frente) e o encolhido (para trás)
      const surge = (16 * lunge - 6 * wind) * S;
      const rx = rd.x * 11 * S * rec, ry = rd.y * 11 * S * rec, rz = 3 * S * hop;
      const at = (a, s, z) => {
        const p = this.at(a * S, (s + shake) * S, z * S);
        return { x: p.x + rx + fwd.x * surge, y: p.y + ry + fwd.y * surge, z: p.z + rz };
      };
      // os pés ficam plantados no bote e no encolhido (só o tranco e o pulinho levam junto)
      const atFoot = (a, s, z) => {
        const p = this.at(a * S, s * S, z * S);
        return { x: p.x + rx, y: p.y + ry, z: p.z + rz * 0.6 };
      };
      const puff = 1 + 0.1 * wind + 0.12 * rec; // o pelo arrepiado

      // o lombo: no aviso arqueia (o meio sobe) e desce para trás nas patas de trás; no tranco, verga
      const lean = 4 * rec * push;
      const arch = 3.2 * wind + 1.4 * rec;
      const hip = at(D(-15 + lean * 0.3, -14), 0, D(19 + bob - 2.5 * wind, 7.5 + land));
      const mid = at(D(-2 + lean * 0.6, -1), 0, D(20.5 + bob + arch + breath, 8.2 + land));
      const chest = at(D(11 + 2 * lunge + lean, 10), 0, D(18.5 + bob - 1.5 * wind + 1.5 * lunge + breath * 0.5, 7.2 + land));
      const hipR = 9.4 * S * puff, midR = 10.2 * S * puff, chestR = 8.8 * S * puff;

      // a cabeça: à frente do peito, olhando em volta parado; farejando, abaixa até o chão; no aviso, baixa e estica
      const look = (M.noise1(t * 0.4 + this.seed * 11) - 0.5) * 0.9 * (1 - trot) * (1 - sniff) * (1 - wind) * (1 - rec) * (st.act ? 0 : 1);
      const hy = this.yaw + look;
      const flat = { x: Math.cos(hy), y: Math.sin(hy), z: 0 };
      const hs = { x: -flat.y, y: flat.x, z: 0 };
      const headC = at(
        D(20 + 3 * lunge + 2 * wind + lean * 1.2, 21),
        0,
        D(23 + bob * 0.6 - 9 * sniff - 4 * wind + lunge + breath * 0.6 + 2 * rec, 6.6 + land),
      );
      // inclinação (+ = o focinho para baixo): farejando o chão, bem para baixo; no tranco, para cima
      const pitch = 0.72 * sniff + 0.06 * wind - 0.12 * lunge + 0.25 * slump - 0.22 * rec + Math.sin(t * 9) * 0.04 * sniff;
      const hf = M.norm(M.add(M.scale(flat, Math.cos(pitch)), { x: 0, y: 0, z: -Math.sin(pitch) }));
      const hu = M.norm(M.cross(hf, hs));
      const rh = 7.2 * S;

      // o focinho: sai da frente da cabeça, comprido, afinando, virado para cima na ponta e sempre mexendo (farejando;
      // mais farejando o chão, parado no bote e no rosnado, quando sobe mostrando os dentes)
      const calm = (1 - wind) * (1 - slump) * (1 - lunge) * (1 - rec);
      const amp = (0.07 + 0.13 * sniff) * calm;
      const wigY = (Math.sin(t * 11 + this.seed * 9) * 0.6 + Math.sin(t * 17.3 + 2) * 0.4) * amp;
      const wigP = (Math.sin(t * 13.7 + 1.3) * 0.7 + (M.noise1(t * 3 + this.seed * 5) - 0.5)) * amp;
      const snarl = 0.2 * wind + 0.1 * open;
      const base = M.add(headC, M.add(M.scale(hf, 0.55 * rh), M.scale(hu, -0.2 * rh)));
      const snout = [base];
      let dir = hf;
      const segs = [6.2, 5.2, 4.2];
      // (o começo, fino, fica dentro da cara: a emenda com a cabeça não aparece como um corte reto)
      const root = M.add(base, M.scale(hf, -3.2 * S));
      for (let i = 0; i < 3; i++) {
        // cada pedaço dobra um pouco mais (a ponta mexe mais) e a ponta vira para cima
        dir = M.rotate(dir, hu, wigY * (0.6 + 0.4 * i));
        dir = M.rotate(dir, hs, -(wigP * (0.6 + 0.4 * i) + (i === 2 ? 0.3 : 0.05) + snarl * (i === 0 ? 1 : 0.25)));
        snout.push(M.add(snout[i], M.scale(dir, segs[i] * S)));
      }
      const snoutR = [4.6, 3.3, 2.4, 1.7].map((r) => r * S);
      // o queixo: embaixo do focinho; abre no rosnado e no bote (gira para baixo)
      const jawDir = M.rotate(M.norm(M.sub(snout[2], snout[0])), hs, 0.14 + 0.64 * open);
      const jaw0 = M.add(base, M.add(M.scale(hu, -2.2 * S), M.scale(hf, -0.6 * S)));
      const jaw = [jaw0, M.add(jaw0, M.scale(jawDir, 5 * S)), M.add(jaw0, M.scale(jawDir, 9.2 * S))];

      // as orelhinhas: em cima, dos lados; no aviso, no tranco e desmaiado, deitam para trás
      const flatten = Math.min(1, 0.7 * wind + 0.8 * rec + 0.6 * slump);
      const ears = [-1, 1].map((sg) => ({
        sg,
        c: M.add(headC, M.add(M.scale(hf, (-0.36 - 0.3 * flatten) * rh), M.add(M.scale(hs, 0.46 * sg * rh), M.scale(hu, (0.92 - 0.32 * flatten) * rh)))),
        r: 0.32 * rh * (1 - 0.2 * flatten),
      }));

      // as patas (escuras): trote em diagonal (a da frente de um lado com a de trás do outro); no aviso, as da frente
      // firmes e abertas; no bote, esticadas para a frente; desmaiado, abertas para os lados
      const legs = [];
      for (const [front, sg, off] of [[true, -1, 0], [true, 1, 0.5], [false, -1, 0.5], [false, 1, 0]]) {
        const q = ph + off * M.TAU;
        const swing = Math.sin(q) * 8 * trot;
        const lift = Math.max(0, Math.cos(q)) * trot;
        let root, foot, hint, l1, l2;
        if (front) {
          root = M.add(chest, M.add(M.scale(side, 4.4 * S * sg), { x: 0, y: 0, z: -4.5 * S }));
          foot = atFoot(D(13 + swing + 2.5 * wind + 10 * lunge, 20), D(5 + 1.6 * wind, 10.5) * sg, D(0.6 + 4.5 * lift, 1.4));
          hint = M.add(M.scale(fwd, -1), { x: 0, y: 0, z: 0.2 }); // o cotovelo para trás
          l1 = 6.8 * S;
          l2 = 6.2 * S;
        } else {
          root = M.add(hip, M.add(M.scale(side, 5 * S * sg), { x: 0, y: 0, z: -4 * S }));
          foot = atFoot(D(-14 + swing - 2 * wind, -20), D(5.8, 11.5) * sg, D(0.6 + 4 * lift, 1.4));
          hint = M.add(fwd, { x: 0, y: 0, z: 0.25 }); // o joelho para a frente
          l1 = 7.4 * S;
          l2 = 6.8 * S;
        }
        const knee = bend(root, foot, l1, l2, hint);
        const toe = M.add(foot, M.add(M.scale(fwd, 3.2 * S), { x: 0, y: 0, z: -0.3 * S }));
        legs.push({ front, sg, pts: [root, M.lerp3(root, knee, 0.5), knee, M.lerp3(knee, foot, 0.5), foot], knee, foot, toe });
      }

      // o rabo em pé (o jeito do quati): sobe de trás do quadril inclinado para trás e a ponta curva para a frente;
      // balança andando; no aviso fica duro e arrepiado; desmaiado, deita no chão para o lado
      const tail = [];
      const n = 16;
      const sway = (Math.sin(t * 1.9 + this.seed * 7) * (0.35 + 0.25 * trot) + Math.sin(ph) * 0.2 * trot) * (1 - wind);
      const puffT = 1 + 0.3 * wind + 0.22 * rec;
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        const upA = -19 - 8 * u - 3 * u * u + 5 * u * u * u * (1 - wind);
        const upZ = 20 + 34 * u - 4 * u * u * u + bob * (1 - u);
        const upS = sway * 12 * u * u;
        const a = D(upA + lean * 0.3 * (1 - u), -20 - 30 * u);
        const zz = D(upZ, 3.2);
        const s = D(upS, 13 * u * u);
        tail.push({ c: at(a, s, Math.max(2.4, zz)), r: (3.9 - 1.3 * u - (u > 0.88 ? (u - 0.88) * 12 : 0)) * S * puffT });
      }

      return { hip, mid, chest, hipR, midR, chestR, headC, rh, hf, hs, hu, snout, snoutR, snoutRoot: root, jaw, ears, legs, tail, fwd, side, puff };
    }

    /** As partes pintadas, cada uma com as bolas da sombra e o seu desenho, na ordem da câmera. */
    _build(cam, rig, st) {
      const { wind, rec, slump, open, dying } = st;
      const z = cam.zoom;
      const ink = Math.max(1, 1.1 * z);
      const head = { c: rig.headC, f: rig.hf, s: rig.hs, u: rig.hu, r: rig.rh };
      const groups = [];
      const self = this;
      const bristle = Math.max(wind, rec * 0.8);

      // ---- o corpo: o casco das bolas do lombo com a beirada de pelo, o lombo mais escuro e a barriga clara
      const torso = [];
      tube(rig.hip, rig.mid, rig.hipR, rig.midR, null, torso);
      tube(rig.mid, rig.chest, rig.midR, rig.chestR, null, torso);
      torso.push({ c: M.lerp3(rig.chest, rig.headC, 0.45), r: 6.2 * S * rig.puff });
      groups.push({
        balls: torso,
        ref: rig.mid,
        body: true,
        paint(ctx, flash) {
          const disks = disksOf(cam, torso);
          const hull = SH.circleHull(disks, 0.5);
          // o pelo penteado do peito para o quadril; arrepiado no aviso
          const fl = cam.pDir(M.sub(rig.hip, rig.chest));
          const fk = Math.hypot(fl.x, fl.y) || 1;
          const len = 4 * z * (1 + 0.55 * bristle);
          const fur = P.furOutline(hull, small(z) ? 22 : 32, len, self.seed * 7, 0.5 + 0.2 * bristle, { x: fl.x / fk, y: fl.y / fk }, 0.38 + 0.2 * bristle);
          if (!fur) return;
          const pad = len * 1.5 + 1 * z;
          const smooth = padHull(disks, pad);
          P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.fur, 5 * z, ink, flash, {
            inside: (c) => self._bodyMarks(c, disks, flash),
            light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
            lightPad: pad,
          });
        },
      });

      // ---- o rabo de anéis, em pé
      groups.push({
        balls: rig.tail,
        ref: rig.tail[3].c,
        paint(ctx, flash) {
          self._paintTail(ctx, cam, rig.tail, ink, flash, bristle);
        },
      });

      // ---- as patas (escuras), com o pé e as unhas
      for (const L of rig.legs) {
        groups.push({
          balls: [{ c: L.knee, r: 3.4 * S }, { c: L.foot, r: 2.6 * S }, { c: L.toe, r: 2.2 * S }],
          ref: L.knee,
          paint(ctx, flash) {
            self._paintLeg(ctx, cam, L, ink, flash);
          },
        });
      }

      // ---- a cabeça (com a máscara e os olhos), o focinho, o queixo (aberto) e as orelhas
      groups.push({
        balls: [{ c: rig.headC, r: rig.rh }],
        ref: rig.headC,
        bias: 0.6,
        body: true,
        paint(ctx, flash) {
          self._paintHead(ctx, cam, head, st, ink, flash);
        },
      });
      const snoutBalls = rig.snout.map((c, i) => ({ c, r: rig.snoutR[i] }));
      groups.push({
        balls: snoutBalls,
        ref: rig.snout[2],
        bias: 0.5,
        paint(ctx, flash) {
          self._paintSnout(ctx, cam, rig, st, ink, flash);
        },
      });
      if (open > 0.04) {
        groups.push({
          balls: [{ c: rig.jaw[1], r: 2.2 * S }],
          ref: rig.jaw[1],
          bias: 0.45,
          noShadow: true,
          paint(ctx, flash) {
            self._paintJaw(ctx, cam, rig, st, ink, flash);
          },
        });
      }
      // (atrás da cabeça: ela cobre a metade de baixo e as orelhinhas aparecem em cima)
      for (const e of rig.ears) {
        groups.push({
          balls: [{ c: e.c, r: e.r }],
          ref: rig.headC,
          bias: 0.3,
          noShadow: true,
          paint(ctx, flash) {
            self._paintEar(ctx, cam, e, rig, ink, flash);
          },
        });
      }

      // ---- desmaiado: o encanto sai do corpo em faíscas roxas
      const heart = M.lerp3(rig.mid, rig.chest, 0.4);
      const after = (ctx) => {
        if (dying !== null) this._release(ctx, cam, heart, dying);
      };
      const paint = (ctx, flash) => {
        ctx.save();
        for (const g of C.byDepth(cam, groups)) if (g.paint) g.paint(ctx, flash);
        ctx.restore();
      };
      return { groups, after, paint };
    }

    /**
     * No corpo (já recortado nele): o lombo mais escuro em cima e a barriga cor de creme embaixo — as mesmas bolas do
     * corpo, menores e puxadas para cima ou para baixo na tela (vale de qualquer lado).
     */
    _bodyMarks(ctx, disks, flash) {
      ctx.fillStyle = C.tint(BACK, flash);
      ctx.beginPath();
      for (const d of disks) {
        ctx.moveTo(d.x + d.r * 0.55, d.y - d.r * 0.92);
        ctx.arc(d.x, d.y - d.r * 0.92, d.r * 0.55, 0, M.TAU);
      }
      ctx.fill();
      ctx.fillStyle = C.tint(BELLY, flash);
      ctx.beginPath();
      for (const d of disks) {
        ctx.moveTo(d.x + d.r * 0.62, d.y + d.r * 1.0);
        ctx.arc(d.x, d.y + d.r * 1.0, d.r * 0.62, 0, M.TAU);
      }
      ctx.fill();
    }

    /** Uma pata: o membro escuro e peludo que afina (sem risco na emenda com o corpo) e o pé com as unhas. */
    _paintLeg(ctx, cam, L, ink, flash) {
      const z = cam.zoom;
      const pts = L.pts.map((p) => cam.p(p));
      const rads = [4.2, 3.5, 2.7, 2.3, 2.1].map((r) => r * S * z);
      const shape = P.limbShape(pts, rads);
      let len3 = 0;
      for (let i = 1; i < L.pts.length; i++) len3 += M.dist(L.pts[i - 1], L.pts[i]);
      const count = Math.max(4, Math.round((len3 * 2.2) / (6 * S)));
      const a = pts[0], b = pts[pts.length - 1];
      const fl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const fur = P.furOutline(shape.poly, count, 2.4 * z, this.seed * 9 + count + (L.front ? 0 : 5) + L.sg, 0.5, { x: (b.x - a.x) / fl, y: (b.y - a.y) / fl }, 0.3, true);
      if (fur) {
        const smooth = P.limbShape(pts, rads.map((r) => r + 4 * z)).poly;
        P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.leg, small(z) ? 0 : rads[1] * 0.6, ink, flash, {
          stroke: (dx, dy, p) => P.furTrace(fur, dx, dy, p, false),
          heavy: false,
          highlight: 0,
          light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
          lightPad: 4 * z,
        });
      }
      // o pé: um oval do calcanhar aos dedos, bem escuro
      const h = cam.p(L.foot), tq = cam.p(L.toe);
      const r = 2.1 * S * z;
      const cx = (h.x + tq.x) / 2, cy = (h.y + tq.y) / 2;
      const ang = Math.atan2(tq.y - h.y, tq.x - h.x);
      const rx = Math.hypot(tq.x - h.x, tq.y - h.y) / 2 + r * 0.9;
      P.paintLit(ctx, cam, (dx, dy, p) => {
        p.moveTo(cx + dx + Math.cos(ang) * rx, cy + dy + Math.sin(ang) * rx);
        p.ellipse(cx + dx, cy + dy, rx, r * 0.8, ang, 0, M.TAU);
        return p;
      }, LOOK.foot, 0, ink, flash, { heavy: false });
      // as unhas compridas das patas da frente (de cavar), só de perto
      if (L.front && z >= 1.1) {
        ctx.strokeStyle = 'rgba(232, 220, 196, 0.85)';
        ctx.lineWidth = Math.max(0.7, 0.45 * z);
        ctx.lineCap = 'round';
        ctx.beginPath();
        const tipX = cx + Math.cos(ang) * rx, tipY = cy + Math.sin(ang) * rx;
        for (const off of [-0.5, 0, 0.5]) {
          const ox = -Math.sin(ang) * off * r * 0.8, oy = Math.cos(ang) * off * r * 0.8;
          ctx.moveTo(tipX + ox - Math.cos(ang) * r * 0.2, tipY + oy - Math.sin(ang) * r * 0.2);
          ctx.lineTo(tipX + ox + Math.cos(ang) * r * 0.55, tipY + oy + Math.sin(ang) * r * 0.55 + 0.3 * z);
        }
        ctx.stroke();
      }
    }

    /** O rabo: comprido e peludo, os anéis claros e escuros atravessando, e a ponta escura; arrepia no aviso. */
    _paintTail(ctx, cam, tail, ink, flash, bristle) {
      const z = cam.zoom;
      const pts = tail.map((b) => cam.p(b.c));
      const shape = P.limbShape(pts, tail.map((b) => b.r * z));
      const e0 = shape.pts[0], e1 = shape.pts[shape.pts.length - 1];
      const fl = Math.hypot(e1.x - e0.x, e1.y - e0.y) || 1;
      const len = 3.4 * z * (1 + 0.7 * bristle);
      const fur = P.furOutline(shape.poly, small(z) ? 22 : 32, len, this.seed * 3 + 1, 0.55, { x: (e1.x - e0.x) / fl, y: (e1.y - e0.y) / fl }, 0.45 + 0.2 * bristle);
      if (!fur) return;
      const pad = len * 1.5 + 1 * z;
      const smooth = P.limbShape(shape.pts, shape.rads.map((r) => r + pad)).poly;
      const sp = shape.pts;
      const acc = [0];
      for (let i = 1; i < sp.length; i++) acc.push(acc[i - 1] + Math.hypot(sp[i].x - sp[i - 1].x, sp[i].y - sp[i - 1].y));
      const total = acc[acc.length - 1] || 1;
      const RINGS = 13;
      const rings = (c) => {
        // cada anel escuro é um risco grosso atravessando o rabo, da largura do anel
        c.strokeStyle = C.tint(RING, flash);
        c.lineCap = 'butt';
        c.lineWidth = total / RINGS + 0.6;
        c.beginPath();
        for (let k = 1; k < RINGS; k += 2) {
          const sAt = ((k + 0.5) / RINGS) * total;
          let i = 1;
          while (i < sp.length - 1 && acc[i] < sAt) i++;
          const a = sp[i - 1], b = sp[i];
          const f = (sAt - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
          const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
          const dl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const nx = -(b.y - a.y) / dl, ny = (b.x - a.x) / dl;
          const w = (shape.rads[i] + pad) * 1.3;
          c.moveTo(x - nx * w, y - ny * w);
          c.lineTo(x + nx * w, y + ny * w);
        }
        c.stroke();
        // a ponta escura
        const e = sp[sp.length - 1];
        c.fillStyle = C.tint(RING, flash);
        c.beginPath();
        c.arc(e.x, e.y, shape.rads[shape.rads.length - 1] + pad, 0, M.TAU);
        c.fill();
      };
      P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.tail, tail[3].r * z * 0.5, ink, flash, {
        inside: rings,
        light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
        lightPad: pad,
      });
    }

    /** A cabeça: o crânio e as bochechas num contorno só, de pelo curto, com a máscara e os olhos. */
    _paintHead(ctx, cam, head, st, ink, flash) {
      const z = cam.zoom;
      const r = head.r;
      const H = (f, s, u) => M.add(head.c, M.add(M.scale(head.f, f * r), M.add(M.scale(head.s, s * r), M.scale(head.u, u * r))));
      const circles = [[head.c, 1], [H(0.32, -0.4, -0.26), 0.64], [H(0.32, 0.4, -0.26), 0.64], [H(0.62, 0, -0.2), 0.62], [H(-0.35, 0, 0.1), 0.86]].map(([c, k]) => {
        const q = cam.p(c);
        return { x: q.x, y: q.y, r: k * r * z };
      });
      const hull = SH.circleHull(circles, 0.5);
      // o pelo da cabeça, curto, penteado do focinho para a nuca
      const fl = cam.pDir(M.scale(head.f, -1));
      const fk = Math.hypot(fl.x, fl.y);
      const fur = P.furOutline(hull, small(z) ? 14 : 20, 2.4 * z, this.seed * 5 + 2, 0.45, fk > 0.05 ? { x: fl.x / fk, y: fl.y / fk } : null, 0.3);
      if (!fur) return;
      const smooth = padHull(circles, 4 * z);
      const showFace = M.dot(head.f, cam.toCamera) > -0.4;
      P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.head, 0.32 * r * z, ink, flash, {
        light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
        lightPad: 4 * z,
        inside: (c) => {
          if (showFace) this._faceMask(c, cam, head, flash);
        },
        after: (c) => {
          if (showFace) this._faceEyes(c, cam, head, st, flash);
        },
      });
    }

    /**
     * A máscara (por baixo da luz e da sombra): a cara escura em volta dos olhos, indo para o focinho, as marcas brancas
     * em cima e embaixo de cada olho, a bochecha branca dos lados do focinho e a garganta clara.
     */
    _faceMask(ctx, cam, head, flash) {
      const r = head.r;
      const on = (f, s, u, mirror, draw, minF) => P.onSurface(ctx, cam, head, f, s, u, mirror, draw, minF);
      const dark = C.tint(MASK, flash);
      const white = C.tint(SPOT, flash);
      // a garganta e o queixo claros
      on(0.45, 0, -0.85, 1, () => {
        ctx.fillStyle = C.tint(BELLY, flash);
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.5 * r, 0.34 * r, 0, 0, M.TAU);
        ctx.fill();
      }, -0.3);
      // a ponte escura do focinho, no meio da cara
      on(0.95, 0, -0.05, 1, () => {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.4 * r, 0.46 * r, 0, 0, M.TAU);
        ctx.fill();
      }, -0.2);
      for (const sg of [-1, 1]) {
        // a máscara em volta do olho, puxada para o focinho
        on(0.66, 0.5 * sg, 0.1, sg, () => {
          ctx.fillStyle = dark;
          ctx.beginPath();
          ctx.ellipse(-0.12 * r, -0.03 * r, 0.5 * r, 0.27 * r, 0.2, 0, M.TAU);
          ctx.fill();
        }, -0.2);
        // a marca branca em cima do olho
        on(0.52, 0.46 * sg, 0.44, sg, () => {
          ctx.fillStyle = white;
          ctx.beginPath();
          ctx.ellipse(0, 0, 0.26 * r, 0.13 * r, 0.15, 0, M.TAU);
          ctx.fill();
        }, -0.15);
        // a meia-lua branca embaixo do olho
        on(0.68, 0.5 * sg, -0.22, sg, () => {
          ctx.fillStyle = white;
          ctx.beginPath();
          ctx.ellipse(0.04 * r, 0, 0.2 * r, 0.085 * r, 0.1, 0, M.TAU);
          ctx.fill();
        }, -0.15);
        // a bochecha branca, dos lados do focinho
        on(0.8, 0.42 * sg, -0.42, sg, () => {
          ctx.fillStyle = white;
          ctx.beginPath();
          ctx.ellipse(0, 0, 0.26 * r, 0.15 * r, -0.2, 0, M.TAU);
          ctx.fill();
        }, -0.15);
      }
    }

    /**
     * Os olhos, por cima da luz: pretos e brilhantes (de noite, vermelhos acesos, como os outros bichos). No aviso,
     * apertados de bravo (a pálpebra de cima reta); no tranco, apertados (">" "<"); desmaiado, fechados.
     */
    _faceEyes(ctx, cam, head, st, flash) {
      const r = head.r;
      const z = cam.zoom;
      const thin = (px) => px / z;
      const ew = 0.17 * r, eh = 0.16 * r;
      const color = C.eyeColor ? C.eyeColor(EYE) : EYE;
      const glow = C.eyeGlow ? C.eyeGlow(null) : null;
      const angry = M.clamp01(st.wind * 1.4);
      for (const sg of [-1, 1]) {
        P.onSurface(ctx, cam, head, 0.66, 0.5 * sg, 0.12, sg, () => {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (this.dying !== null) {
            ctx.strokeStyle = LID;
            ctx.lineWidth = Math.max(thin(1), 0.05 * r);
            ctx.beginPath();
            ctx.moveTo(-ew, 0.1 * eh);
            ctx.quadraticCurveTo(0, -0.8 * eh, ew, 0.1 * eh);
            ctx.stroke();
            return;
          }
          if (st.rec > 0.3) {
            ctx.strokeStyle = LID;
            ctx.lineWidth = Math.max(thin(1), 0.05 * r);
            ctx.beginPath();
            ctx.moveTo(ew * 0.9, 0.7 * eh);
            ctx.lineTo(-ew * 0.6, 0);
            ctx.lineTo(ew * 0.9, -0.7 * eh);
            ctx.stroke();
            return;
          }
          if (glow) {
            // de noite: o brilho vermelho em volta
            ctx.fillStyle = glow;
            ctx.globalAlpha *= 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, ew * 2.2, 0, M.TAU);
            ctx.fill();
            ctx.globalAlpha /= 0.4;
          }
          ctx.fillStyle = C.tint(color, flash);
          ctx.beginPath();
          ctx.ellipse(0, 0, ew, eh, 0, 0, M.TAU);
          ctx.fill();
          // bravo: a pálpebra de cima reta e inclinada (o canto de dentro desce)
          if (angry > 0.05) {
            ctx.fillStyle = MASK;
            ctx.beginPath();
            ctx.moveTo(-ew * 1.3, eh * (1.3 - 1.1 * angry));
            ctx.lineTo(ew * 1.3, eh * (1.3 - 0.35 * angry));
            ctx.lineTo(ew * 1.3, eh * 1.5);
            ctx.lineTo(-ew * 1.3, eh * 1.5);
            ctx.closePath();
            ctx.fill();
          }
          // o pontinho de luz
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.beginPath();
          ctx.arc(-0.3 * ew * sg, 0.35 * eh, Math.max(thin(0.7), 0.32 * ew), 0, M.TAU);
          ctx.fill();
        }, 0.02);
      }
    }

    /**
     * O focinho comprido: escuro, de pelo curtinho, afinando até a ponta virada para cima, com o nariz preto brilhante
     * e o risco da boca embaixo (fechada).
     */
    _paintSnout(ctx, cam, rig, st, ink, flash) {
      const z = cam.zoom;
      const pts = [cam.p(rig.snoutRoot)].concat(rig.snout.map((p) => cam.p(p)));
      const rads = [1.6 * S * z].concat(rig.snoutR.map((r) => r * z));
      const shape = P.limbShape(pts, rads);
      const a = pts[0], b = pts[pts.length - 1];
      const fl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const fur = P.furOutline(shape.poly, small(z) ? 10 : 14, 1.4 * z, this.seed * 13 + 4, 0.4, { x: (b.x - a.x) / fl, y: (b.y - a.y) / fl }, 0.15, true);
      if (!fur) return;
      const smooth = P.limbShape(pts, rads.map((r) => r + 2.2 * z)).poly;
      const p0 = pts[1];
      // o risco da boca: embaixo do focinho (os pontos puxados para baixo da cabeça), da ponta até perto da cara
      const under = rig.snout.slice(1).map((p, i) => cam.p(M.add(p, M.scale(rig.hu, -rig.snoutR[i + 1] * 0.75))));
      P.paintLit(ctx, cam, (dx, dy, p) => P.furTrace(fur, dx, dy, p), LOOK.snout, small(z) ? 0 : rads[1] * 0.55, ink, flash, {
        stroke: (dx, dy, p) => P.furTrace(fur, dx, dy, p, false),
        heavy: false,
        highlight: 0, // (o brilho, no focinho que vem para a câmera, virava uma faixa clara atravessada)
        light: (dx, dy, p) => SH.fillPath(smooth, dx, dy, p),
        lightPad: 2.2 * z,
        inside: (c) => {
          // escurece até a ponta
          const g = c.createLinearGradient(p0.x, p0.y, b.x, b.y);
          g.addColorStop(0, 'rgba(30, 18, 12, 0)');
          g.addColorStop(0.6, 'rgba(30, 18, 12, 0.5)');
          g.addColorStop(1, 'rgba(24, 14, 10, 0.8)');
          c.fillStyle = g;
          c.fill(SH.fillPath(smooth, 0, 0, new Path2D()));
          if (st.open > 0.04 || z < 0.85) return;
          c.strokeStyle = 'rgba(16, 8, 6, 0.75)';
          c.lineWidth = Math.max(0.8, 0.55 * z);
          c.beginPath();
          c.moveTo(under[0].x, under[0].y);
          for (let i = 1; i < under.length; i++) c.lineTo(under[i].x, under[i].y);
          c.stroke();
        },
      });
      // o nariz: a ponta preta e brilhante, um pouco maior que o focinho
      const tip = pts[pts.length - 1];
      const nr = rads[rads.length - 1] * 1.25;
      P.paintLit(ctx, cam, (dx, dy, p) => {
        p.moveTo(tip.x + dx + nr, tip.y + dy);
        p.arc(tip.x + dx, tip.y + dy, nr, 0, M.TAU);
        return p;
      }, { base: NOSE }, 0, ink, flash, { heavy: false });
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(tip.x - nr * 0.3, tip.y - nr * 0.35, Math.max(0.6, nr * 0.32), 0, M.TAU);
      ctx.fill();
    }

    /**
     * A boca aberta (o rosnado e o bote): o céu da boca vermelho-escuro entre o lábio de cima (embaixo do focinho) e o
     * de baixo (em cima do queixo), os dentes (os caninos maiores) e o queixo. A boca é o casco dos dois lábios na tela:
     * de frente, com o focinho vindo para a câmera, ainda aparece embaixo do nariz.
     */
    _paintJaw(ctx, cam, rig, st, ink, flash) {
      const z = cam.zoom;
      const hu = rig.hu;
      const upper = rig.snout.map((p, i) => M.add(p, M.scale(hu, -rig.snoutR[i] * 0.85)));
      const lowerDir = M.norm(M.sub(rig.jaw[2], rig.jaw[0]));
      const jawUp = M.norm(M.cross(rig.hs, lowerDir));
      const jr = [2.9, 2.3, 1.6].map((r) => r * S);
      const lower = rig.jaw.map((p, i) => M.add(p, M.scale(jawUp, jr[i] * 0.9)));
      const hull = SH.convexHull(upper.concat(lower).flatMap((p) => {
        const q = cam.p(p);
        return [q.x, q.y];
      }));
      ctx.fillStyle = C.tint(MOUTH, flash);
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = ink;
      ctx.lineJoin = 'round';
      const mouth = SH.fillPath(hull, 0, 0, new Path2D());
      ctx.fill(mouth);
      ctx.stroke(mouth);
      // os dentes: os caninos perto da ponta (o de cima apontando para o queixo e o de baixo para o focinho) e uns
      // pequenos; crescem com a boca aberta
      const tooth = (p, toward, size) => {
        const q = cam.p(p), t = cam.p(M.add(p, M.scale(toward, size)));
        const dx = t.x - q.x, dy = t.y - q.y;
        const l = Math.hypot(dx, dy) || 1;
        const w = Math.max(0.9, size * 0.42 * z);
        ctx.moveTo(q.x - (dy / l) * w, q.y + (dx / l) * w);
        ctx.lineTo(t.x, t.y);
        ctx.lineTo(q.x + (dy / l) * w, q.y - (dx / l) * w);
        ctx.closePath();
      };
      const open = st.open;
      const front = M.lerp3(upper[2], upper[3], 0.4);
      const tip = M.lerp3(lower[1], lower[2], 0.72);
      const downTo = M.norm(M.sub(tip, front));
      ctx.fillStyle = TOOTH;
      ctx.beginPath();
      tooth(front, downTo, (1.2 + 2.4 * open) * S);
      tooth(M.lerp3(upper[1], upper[2], 0.55), downTo, (0.6 + 1.1 * open) * S);
      tooth(tip, M.scale(downTo, -1), (1 + 1.9 * open) * S);
      ctx.fill();
      // o queixo, claro (o do quati é esbranquiçado: de frente, a boca aberta não parece uma língua)
      const pts = rig.jaw.map((p) => cam.p(p));
      const shape = P.limbShape(pts, jr.map((r) => r * z));
      P.paintLit(ctx, cam, (dx, dy, p) => P.limbPath(shape, dx, dy, p), LOOK.chin, 0, ink, flash, { heavy: false });
    }

    /** Uma orelhinha redonda: escura, com a borda branca em cima. */
    _paintEar(ctx, cam, e, rig, ink, flash) {
      const z = cam.zoom;
      const q = cam.p(e.c);
      const r = e.r * z;
      P.paintLit(ctx, cam, (dx, dy, p) => {
        p.moveTo(q.x + dx + r, q.y + dy);
        p.arc(q.x + dx, q.y + dy, r, 0, M.TAU);
        return p;
      }, LOOK.ear, 0, ink, flash, { heavy: false });
      // a borda branca (a parte de dentro da orelha, virada para a frente): só quando a cara está para a câmera
      if (M.dot(rig.hf, cam.toCamera) < -0.25) return;
      ctx.strokeStyle = C.tint(SPOT, flash);
      ctx.lineWidth = Math.max(1, 0.3 * r);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(q.x, q.y + r * 0.1, r * 0.68, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }

    /**
     * Desmaiado: o encanto sai do corpo — um clarão lilás no peito e as faíscas roxas que se espalham e sobem, sumindo
     * (o motor tira o desenho 0,7 s depois da queda; o corpo apaga de 0,4 a 0,7 s). O mesmo do sagui.
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
        star(ctx, p.x, p.y, s);
        ctx.fill();
        ctx.fillStyle = '#f4ecff';
        star(ctx, p.x, p.y, s * 0.45);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  C.define('quati', Quati);
})(window.PD = window.PD || {});
