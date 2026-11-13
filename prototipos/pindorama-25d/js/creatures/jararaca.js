// Jararaca (a víbora da Mata Atlântica): marrom-oliva com as manchas escuras em "V" nos flancos, barriga creme,
// cabeça triangular, olhos amarelos de pupila em fenda e a risca escura atrás do olho; a língua vermelha entra e sai.
// Parada, fica em S no chão com a cabeça um pouco erguida. Andando, rasteja: o corpo segue o caminho da cabeça e a
// onda em S fica parada no chão enquanto ela avança. No aviso ('windup', 0,65 s), se enrola, ergue o pescoço em S e
// treme a ponta do rabo; no bote ('bite' ou 'strike'), avança e volta. Ao cair ('die'), vira de barriga para cima.
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;

  /** Tamanho de jogo: um pouco mais grossa e comprida que a de verdade, para ler com a câmera longe. */
  const S = 1.15;
  const LEN = 170 * S; // comprimento (cm)
  const R = 6.2 * S; // raio no meio do corpo (cm)
  const STEP = 3; // distância entre os pontos do rastro (cm)
  const WAVE = 78 * S; // comprimento da onda do S
  const COL = {
    body: { base: '#8e6b3f', shade: '#5e4527', light: '#b08a5a' },
    head: { base: '#7a5b35', shade: '#523b21', light: '#9c7a4c' },
    belly: { base: '#cdb07a', shade: '#a08552', light: '#e6d3a4' },
  };
  const MARK = '#4b3620';
  const EYE = '#f0d24a';
  const TONGUE = '#d63a3a';
  const UP = { x: 0, y: 0, z: 1 };

  /** Espessura ao longo do corpo (u = 0 na cabeça, 1 na ponta do rabo), em fração de R. */
  function thickness(u) {
    if (u < 0.08) return 0.62 + (u / 0.08) * 0.2; // pescoço fino
    if (u < 0.25) return 0.82 + ((u - 0.08) / 0.17) * 0.18;
    if (u < 0.6) return 1;
    return Math.max(0.16, 1 - Math.pow((u - 0.6) / 0.4, 1.25) * 0.86); // afina até a ponta
  }

  /** Bézier cúbica entre quatro pontos 3D. */
  function bez(a, b, c, d, t) {
    const s = 1 - t;
    const k0 = s * s * s, k1 = 3 * s * s * t, k2 = 3 * s * t * t, k3 = t * t * t;
    return { x: a.x * k0 + b.x * k1 + c.x * k2 + d.x * k3, y: a.y * k0 + b.y * k1 + c.y * k2 + d.y * k3, z: a.z * k0 + b.z * k1 + c.z * k2 + d.z * k3 };
  }

  class Jararaca extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 40 * S;
      this.top = 24 * S;
      this.ownDeath = true;
      this.acts = { windup: { dur: 0.65, hold: 0.9 }, bite: { dur: 0.42, hold: 0.5 }, strike: { dur: 0.42, hold: 0.5 } };
      /** 0 = esticada em S no chão, 1 = enrolada com o pescoço erguido. */
      this.coil = 0;
      /** Hora do último golpe: fica enrolada um tempo depois, se não sair andando. */
      this.lastAct = -9;
      /** Quanto andou (cm): a onda do corpo fica parada no chão enquanto ela avança. */
      this.dist = this.seed * 300;
      this._resetTrail();
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

    parts(cam) {
      const t = this.time;
      const act = this.act;
      const dying = this.dying;
      const roll = dying === null ? 0 : M.smoothstep(0, 0.35, dying); // virando de barriga para cima
      const coil = M.smoothstep(0, 1, this.coil) * (1 - roll);
      const hurt = this.hurtT < 0.3 ? 1 - this.hurtT / 0.3 : 0;
      const yaw = this.yaw;
      const f = { x: Math.cos(yaw), y: Math.sin(yaw), z: 0 };
      const side = { x: -f.y, y: f.x, z: 0 };
      const at = (p, along, sd, z) => ({ x: p.x + f.x * along + side.x * sd, y: p.y + f.y * along + side.y * sd, z: this.groundZ + z });

      // bote: sai rápido, segura um instante e volta; preparo: puxa a cabeça para trás
      let strike = 0;
      let pull = 0;
      if (act && (act.kind === 'bite' || act.kind === 'strike')) {
        const k = act.t;
        strike = k < 0.1 ? M.easeOut(k / 0.1) : k < 0.16 ? 1 : 1 - M.easeInOut((k - 0.16) / 0.26);
        pull = 1 - M.clamp01(k / 0.1);
      } else if (act && act.kind === 'windup') pull = M.easeOut(act.t / act.dur);

      // ---- pose esticada: o rastro com a onda em S (a cabeça fica no meio, a onda cresce para trás)
      const amp = 12 * S * (1 - 0.7 * roll);
      const lift = 5 * S * (1 - roll);
      const flat = (s) => {
        const p = this._trailAt(s);
        const q = this._trailAt(s + 2);
        let tx = p.x - q.x, ty = p.y - q.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const env = M.smoothstep(0, 22 * S, s) * (1 - 0.35 * M.smoothstep(LEN * 0.7, LEN, s));
        const off = amp * Math.sin((M.TAU * (this.dist - s)) / WAVE) * env;
        const u = s / LEN;
        const r = R * thickness(u);
        return { x: p.x - ty * off, y: p.y + tx * off, z: this.groundZ + r * 0.92 + lift * Math.max(0, 1 - s / (18 * S)) };
      };

      // ---- pose enrolada: espiral atrás da cabeça e o pescoço erguido em S
      const U0 = 0.3;
      const center = at(this.pos, -24 * S, 0, 0);
      const head = at(this.pos, (-5 - 6 * pull + 52 * strike) * S - hurt * 6 * S, 0, (33 + 4 * pull - 20 * strike + hurt * 5) * S);
      const p0 = at(center, 24 * S, 0, R * 0.95);
      const b1 = { ...p0, x: p0.x - f.x * 6 * S, y: p0.y - f.y * 6 * S, z: p0.z + 20 * S };
      const b2 = { x: head.x - f.x * (16 - 30 * strike) * S, y: head.y - f.y * (16 - 30 * strike) * S, z: head.z - 2 * S };
      const coiled = (s) => {
        const u = s / LEN;
        if (u <= U0) return bez(p0, b1, b2, head, 1 - u / U0);
        const k = (u - U0) / (1 - U0);
        const th = yaw + k * 2.3 * Math.PI;
        const rc = (24 - 13 * k) * S;
        // a ponta do rabo treme no aviso (a jararaca faz isso quando se sente ameaçada)
        const rattle = act && act.kind === 'windup' && k > 0.85 ? Math.sin(t * 70) * 1.6 * S : 0;
        return { x: center.x + Math.cos(th) * (rc + rattle), y: center.y + Math.sin(th) * (rc + rattle), z: this.groundZ + R * thickness(u) * 0.92 };
      };

      // ---- bolas do corpo, mais juntas onde é fino
      const pts = [];
      for (let s = 0; s <= LEN; ) {
        const u = s / LEN;
        const r = R * thickness(u);
        const a = flat(s);
        const p = coil > 0.001 ? M.lerp3(a, coiled(s), coil) : a;
        pts.push({ s, u, r, p });
        s += Math.max(1.1, r * 0.62);
      }
      // tom do corpo: virando, mostra a barriga creme
      const bodyCol = roll > 0 ? { base: M.mix(COL.body.base, COL.belly.base, roll * 0.85), shade: M.mix(COL.body.shade, COL.belly.shade, roll * 0.85), light: M.mix(COL.body.light, COL.belly.light, roll * 0.85) } : COL.body;

      // corpo numa peça só (sem emendas); o pescoço (o que ergue no aviso) é outra, desenhada depois, e na emenda
      // as bolas dele não ganham contorno, para não riscar o corpo
      const groups = [];
      const iNeck = pts.findIndex((q) => q.u > U0);
      const bodyPts = pts.slice(Math.max(1, iNeck - 1));
      const neckPts = pts.slice(1, iNeck + 2);
      const back = { balls: bodyPts.map((q) => ({ c: q.p, r: q.r, col: bodyCol })), ref: bodyPts[Math.floor(bodyPts.length / 2)].p, decals: [], bias: -200 };
      const neck = { balls: neckPts.map((q, k) => ({ c: q.p, r: q.r, col: bodyCol, noInk: k >= neckPts.length - 3 })), ref: neckPts[0].p, decals: [], bias: -100, body: true };
      groups.push(back, neck);
      const segOf = [{ g: neck, s0: 0, s1: pts[iNeck].s }, { g: back, s0: pts[iNeck].s, s1: LEN + 1 }];
      const pointAt = (s) => {
        // o ponto do corpo (já misturado) mais perto de s, e a direção do corpo ali
        let i = 0;
        while (i + 1 < pts.length && pts[i + 1].s < s) i++;
        const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)];
        const k = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
        const p = M.lerp3(a.p, b.p, k);
        const tg = M.norm(M.sub(a.p, b.p), f);
        return { p, tg, r: a.r + (b.r - a.r) * k };
      };
      // manchas em "V" nos flancos, alternando os lados (somem quando ela vira de barriga)
      if (roll < 0.5) {
        for (let s = 16 * S; s < LEN * 0.86; s += 15 * S) {
          for (const sg of [-1, 1]) {
            const ss = s + (sg > 0 ? 7.5 * S : 0);
            const { p, tg, r } = pointAt(ss);
            const sideV = M.norm(M.cross(UP, tg), side);
            const n = M.norm(M.add(M.scale(sideV, sg * 0.85), M.scale(UP, 0.5)));
            let v = M.norm(M.cross(n, tg));
            if (v.z < 0) v = M.scale(v, -1);
            const seg = segOf.find((q) => ss >= q.s0 && ss <= q.s1) || segOf[segOf.length - 1];
            seg.g.decals.push({ c: M.add(p, M.scale(n, r * 0.93)), n, u: tg, v, ru: 3.6 * S * (r / R), rv: r * 0.78, color: MARK, shape: 'tri', minFacing: 0.12 });
          }
        }
      }

      // ---- cabeça triangular (larga atrás, nas bochechas do veneno), olhos e a risca atrás do olho
      const hp = pts[0].p;
      const fh = M.norm({ x: f.x, y: f.y, z: coil * (-0.28 + 0.2 * strike) - 0.1 * roll });
      const sh = M.norm(M.cross(UP, fh), side);
      const uh = M.norm(M.cross(fh, sh));
      const H = (a, b, c) => M.add(hp, M.add(M.scale(fh, a * S), M.add(M.scale(sh, b * S), M.scale(uh, c * S))));
      const headCol = roll > 0 ? { base: M.mix(COL.head.base, COL.belly.base, roll * 0.8), shade: M.mix(COL.head.shade, COL.belly.shade, roll * 0.8), light: COL.head.light } : COL.head;
      const headBalls = [
        { c: H(-1.5, 0, 0), r: 5.2 * S, col: headCol },
        { c: H(-2.2, 3.4, -0.4), r: 4.3 * S, col: headCol },
        { c: H(-2.2, -3.4, -0.4), r: 4.3 * S, col: headCol },
        { c: H(3, 0, -0.2), r: 4.4 * S, col: headCol },
        { c: H(7, 0, -0.7), r: 3.2 * S, col: headCol },
      ];
      const decals = [];
      for (const sg of [-1, 1]) {
        const eyeN = M.norm(M.add(M.scale(sh, sg * 0.9), M.add(M.scale(uh, 0.5), M.scale(fh, 0.25))));
        const eyeC = H(2.4, 3.9 * sg, 1.6);
        let ev = M.norm(M.cross(eyeN, fh));
        if (ev.z < 0) ev = M.scale(ev, -1);
        // risca escura do olho até o canto da boca
        decals.push({ c: H(-1.2, 4.6 * sg, -0.8), n: M.norm(M.add(M.scale(sh, sg), M.scale(uh, 0.2))), u: fh, v: ev, ru: 3.6 * S, rv: 0.9 * S, color: MARK, minFacing: 0.08 });
        if (dying !== null) {
          decals.push({ c: eyeC, n: eyeN, u: fh, v: ev, ru: 1.5 * S, rv: 0.3 * S, color: '#1b100d' });
          continue;
        }
        decals.push({ c: eyeC, n: eyeN, u: fh, v: ev, ru: 1.55 * S, rv: 1.35 * S, color: EYE, glow: 'rgba(255, 220, 90, 0.5)' });
        decals.push({ c: M.add(eyeC, M.scale(eyeN, 0.05)), n: eyeN, u: fh, v: ev, ru: 0.32 * S, rv: 1.1 * S, color: '#1b100d' });
      }
      groups.push({ balls: headBalls, ref: hp, bias: 0, body: true, decals });
      this.top = hp.z - this.groundZ + 14 * S;

      // língua: entra e sai de vez em quando (mais no aviso); caída, fica de fora, mole
      const flick = dying !== null ? 1 : act && act.kind === 'windup' ? (t * 7) % 1 < 0.45 : (t + this.seed * 3) % 1.9 < 0.22;
      const after = (ctx) => {
        if (!flick) return;
        const z = cam.zoom;
        const tip = H(9.6, 0, -1);
        const len = dying !== null ? 3.5 : 6.5;
        const droop = dying !== null ? { x: 0, y: 0, z: -2.5 * S } : { x: 0, y: 0, z: 0 };
        const mid = M.add(M.add(tip, M.scale(fh, len * S)), droop);
        const a = cam.p(tip), b = cam.p(mid);
        const forks = [M.add(mid, M.add(M.scale(fh, 2.6 * S), M.scale(sh, 1.6 * S))), M.add(mid, M.add(M.scale(fh, 2.6 * S), M.scale(sh, -1.6 * S)))].map((q) => cam.p(q));
        ctx.save();
        ctx.strokeStyle = TONGUE;
        ctx.lineWidth = Math.max(1, 1.5 * z);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        for (const q of forks) {
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
        ctx.restore();
      };
      return { groups, after };
    }
  }

  C.define('jararaca', Jararaca);
  PD.Jararaca = Jararaca;
})(window.PD = window.PD || {});
