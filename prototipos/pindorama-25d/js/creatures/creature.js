// Criaturas do 2.5D: os monstros que não são gente (sagui, jararaca...). Cada uma tem corpo, jeito de andar e golpes
// próprios; o desenho é o da capivara do cenário: bolas com contorno de tinta, o lado da sombra mais escuro e a luz
// vindo do alto à esquerda. A PD.View usa uma criatura no lugar do PD.Character quando o tipo do monstro tem desenho:
//   PD.creatures.has(tipo) · PD.creatures.create(tipo, xCm, yCm, yaw)
// A criatura segue o servidor de casa em casa (`moveTo` com a duração do passo), vira para onde olha e se anima
// sozinha; `action(tipo, yaw)` dispara os golpes ('windup', 'shoot', 'hurt'...). Tudo em centímetros, como o protótipo.
(function (PD) {
  'use strict';
  const M = PD.math;
  const INK = '#1b100d';
  const TYPES = {};

  class Creature {
    constructor(x, y, yaw) {
      this.pos = { x, y };
      this.vel = { x: 0, y: 0 };
      this.yaw = yaw;
      this.yawTarget = yaw;
      this.faceYaw = yaw;
      this.groundZ = 0;
      this.radius = 24;
      /** Velocidade suavizada (cm/s): escolhe o jeito de andar sem tremer entre um passo e outro. */
      this.speed = 0;
      this.phase = 0;
      this.time = Math.random() * 10;
      this.seed = Math.random();
      this.label = 'parado';
      /** A PD.World lê os eventos de cada personagem (poeira, impacto); criatura ainda não solta nenhum. */
      this.events = [];
      this._from = { x, y };
      this._to = { x, y };
      this._t = 1;
      this._dur = 1;
      /** Golpe em andamento: { kind, t, dur, hold } (t em segundos). */
      this.act = null;
      /** Segundos desde o último golpe levado (pisca e encolhe no começo). */
      this.hurtT = 9;
      /** Altura de cima da cabeça (cm), para o nome e o balão. */
      this.top = 50;
      /** Caiu ('die'): segundos desde a queda (null = de pé). O motor tira o desenho 0,7 s depois. */
      this.dying = null;
    }

    /** Novo ponto do pé (cm) vindo do servidor: chega lá no tempo do passo, em linha reta. */
    moveTo(x, y, yaw, durationMs, dash) {
      if (this.dying !== null) return;
      if (dash || Math.hypot(x - this.pos.x, y - this.pos.y) > 300) {
        this.pos.x = x;
        this.pos.y = y;
        this._from = { x, y };
        this._to = { x, y };
        this._t = this._dur = 1;
      } else {
        this._from = { x: this.pos.x, y: this.pos.y };
        this._to = { x, y };
        this._t = 0;
        this._dur = Math.max(0.06, (durationMs || 300) / 1000);
      }
      if (Number.isFinite(yaw)) this.yawTarget = yaw;
    }

    /** Golpe ou reação: cada criatura diz quanto dura cada um em `acts` ({ tipo: { dur, hold } }). */
    action(kind, yaw) {
      if (this.dying !== null) return;
      if (kind === 'die') {
        this.dying = 0;
        this.act = null;
        this._t = this._dur;
        return;
      }
      if (kind === 'hurt') {
        this.hurtT = 0;
        return;
      }
      const spec = this.acts && this.acts[kind];
      if (!spec) return;
      this.act = { kind, t: 0, dur: spec.dur, hold: spec.hold || 0 };
      if (Number.isFinite(yaw)) this.yawTarget = yaw;
    }

    update(dt) {
      this.time += dt;
      this.hurtT += dt;
      if (this.dying !== null) this.dying += dt;
      const px = this.pos.x;
      const py = this.pos.y;
      if (this._t < this._dur) {
        this._t = Math.min(this._dur, this._t + dt);
        const k = this._t / this._dur;
        this.pos.x = M.lerp(this._from.x, this._to.x, k);
        this.pos.y = M.lerp(this._from.y, this._to.y, k);
      }
      const inv = 1 / Math.max(dt, 1e-4);
      this.vel = { x: (this.pos.x - px) * inv, y: (this.pos.y - py) * inv };
      this.speed = M.damp(this.speed, Math.hypot(this.vel.x, this.vel.y), 9, dt);
      this.yaw = M.dampAngle(this.yaw, this.yawTarget, 13, dt);
      this.faceYaw = this.yaw;
      if (this.act) {
        this.act.t += dt;
        if (this.act.t > this.act.dur + this.act.hold) this.act = null;
      }
      this.animate(dt);
    }

    /** Cada criatura: avança o jeito de andar e a pose. */
    animate() {}

    /** Ponto 3D (cm) em volta do pé: `along` para a frente, `side` para a direita, `z` para cima. */
    at(along, side, z, yaw = this.yaw) {
      const fx = Math.cos(yaw);
      const fy = Math.sin(yaw);
      return { x: this.pos.x + fx * along - fy * side, y: this.pos.y + fy * along + fx * side, z: this.groundZ + z };
    }

    /** Peça para a PD.World: ordem de desenho, caixas, sombra e desenho. */
    drawable(cam, primary) {
      // caiu: quem tem pose de desmaio (ownDeath) desenha a sua; as outras tombam de lado
      const parts = this.dying !== null && !this.ownDeath ? this._fall(this.parts(cam)) : this.parts(cam);
      const alpha = this.dying !== null ? 1 - M.smoothstep(0.4, 0.7, this.dying) : 1;
      const faded = (paint) => (ctx) => {
        if (alpha >= 1) return paint(ctx);
        ctx.save();
        ctx.globalAlpha *= alpha;
        paint(ctx);
        ctx.restore();
      };
      const box = boxOf(cam, parts.groups);
      const body = boxOf(cam, parts.groups.filter((g) => g.body));
      const r = this.radius;
      return {
        entity: this,
        primary: !!primary,
        fp: { x0: this.pos.x - r, x1: this.pos.x + r, y0: this.pos.y - r, y1: this.pos.y + r },
        bounds: pad(box, 8 * cam.zoom),
        body: body || box,
        drawShadow: faded((ctx) => drawShadow(ctx, cam, parts.groups, this.groundZ)),
        draw: faded((ctx) => {
          paintGroups(ctx, cam, parts.groups, this.flash());
          if (parts.after) parts.after(ctx);
        }),
        cam,
      };
    }

    /** Caiu: tomba de lado em volta do pé (girando no sentido do corpo) e fica rente ao chão. */
    _fall(parts) {
      const k = M.easeInOut(M.clamp01(this.dying / 0.32));
      if (k <= 0) return parts;
      const f = { x: Math.cos(this.yaw), y: Math.sin(this.yaw), z: 0 };
      const o = { x: this.pos.x, y: this.pos.y, z: this.groundZ };
      const ang = k * 1.42;
      const rot = (p) => M.add(o, M.rotate(M.sub(p, o), f, ang));
      const rotD = (d) => M.rotate(d, f, ang);
      let low = Infinity;
      for (const g of parts.groups) {
        g.balls = g.balls.map((b) => {
          const c = rot(b.c);
          low = Math.min(low, c.z - b.r);
          return { ...b, c };
        });
        if (g.ref) g.ref = rot(g.ref);
        if (g.decals) g.decals = g.decals.map((dc) => ({ ...dc, c: rot(dc.c), n: dc.n && rotD(dc.n), u: rotD(dc.u), v: rotD(dc.v) }));
      }
      // o lado que tomba não entra no chão
      const lift = Math.max(0, this.groundZ - low);
      if (lift > 0) for (const g of parts.groups) g.balls = g.balls.map((b) => ({ ...b, c: { ...b.c, z: b.c.z + lift } }));
      return parts;
    }

    /** Clarão branco logo depois de apanhar (0 = nada). */
    flash() {
      return this.hurtT < 0.22 ? 0.65 * (1 - this.hurtT / 0.22) : 0;
    }

    /** Em cima da cabeça (cm, 3D): o nome fica aqui. */
    overHead() {
      return { x: this.pos.x, y: this.pos.y, z: this.groundZ + this.top };
    }
  }

  // ------------------------------------------------------------------ desenho em bolas
  /** Bolas de um segmento entre dois pontos (raio vai de r0 a r1), sem buracos entre elas. */
  function tube(a, b, r0, r1, col, out = []) {
    const n = Math.max(1, Math.ceil(M.dist(a, b) / (Math.min(r0, r1) * 0.7)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      out.push({ c: M.lerp3(a, b, t), r: r0 + (r1 - r0) * t, col });
    }
    return out;
  }

  /** Cores de uma bola, clareadas no clarão do golpe (guardadas para não recalcular a cada quadro). */
  const tintCache = new Map();
  function tint(color, k) {
    if (!k) return color;
    const q = Math.round(k * 10) / 10;
    const key = color + q;
    let c = tintCache.get(key);
    if (!c) {
      c = M.mix(color, '#ffffff', q);
      tintCache.set(key, c);
    }
    return c;
  }

  /**
   * Desenha grupos de bolas da mais longe para a mais perto (ordem pela câmera; `bias` puxa um grupo para a frente).
   * Cada grupo: contorno de tinta em volta de tudo, o lado da sombra, a cor e o brilho. `chain` (padrão) pinta as
   * bolas juntas, como um corpo só; os detalhes (`decals`) vão por cima, só do lado que a câmera vê.
   */
  function paintGroups(ctx, cam, groups, flash) {
    const zoom = cam.zoom;
    const ink = Math.max(1, 1.15 * zoom);
    const L = cam.lightScreen;
    // ordem entre as partes: pela posição no chão (perto da câmera, depois) e pouco pela altura, como as partes do
    // corpo da gente (renderer.js): o rabo deitado no chão do lado da câmera fica na frente do corpo sentado
    const K = PD.ISO_K * cam.cosP;
    const depth = (p) => (p.x + p.y) * K + p.z * 0.15;
    const sorted = groups.filter((g) => g.balls.length).map((g) => ({ g, d: depth(g.ref || g.balls[0].c) + (g.bias || 0) }));
    sorted.sort((a, b) => a.d - b.d);
    for (const { g } of sorted) {
      const qs = g.balls.map((b) => ({ q: cam.p(b.c), r: b.r * zoom, col: b.col }));
      // contorno: um pouco maior que cada bola, tudo junto
      ctx.fillStyle = INK;
      ctx.beginPath();
      for (const { q, r } of qs) {
        ctx.moveTo(q.x + r + ink, q.y);
        ctx.arc(q.x, q.y, r + ink, 0, M.TAU);
      }
      ctx.fill();
      // sombra (a bola inteira), cor (deslocada para a luz, deixa a meia-lua escura do outro lado) e brilho
      const pass = (key, grow, shift, minR) => {
        let cur = null;
        ctx.beginPath();
        for (const { q, r, col } of qs) {
          if (r < minR) continue;
          const color = tint(col[key] || col.base, flash);
          if (color !== cur) {
            if (cur) ctx.fill();
            ctx.fillStyle = cur = color;
            ctx.beginPath();
          }
          const x = q.x + L.x * r * shift;
          const y = q.y + L.y * r * shift;
          ctx.moveTo(x + r * grow, y);
          ctx.arc(x, y, r * grow, 0, M.TAU);
        }
        if (cur) ctx.fill();
      };
      pass('shade', 1, 0, 0);
      pass('base', 0.84, 0.16, 0);
      if (!g.matte) pass('light', 0.4, 0.42, 2.2);
      if (g.decals) for (const dc of g.decals) decal(ctx, cam, dc, flash);
    }
  }

  /**
   * Um detalhe pintado na superfície (rosto, olho, mancha): elipse no plano que encosta na bola, achatada pela
   * câmera; do outro lado (de costas para a câmera) não aparece.
   */
  function decal(ctx, cam, dc, flash) {
    const tc = cam.toCamera;
    if (dc.n && dc.n.x * tc.x + dc.n.y * tc.y + dc.n.z * tc.z < (dc.minFacing ?? 0.05)) return;
    const q = cam.p(dc.c);
    const a = cam.pDir(dc.u);
    const b = cam.pDir(dc.v);
    ctx.save();
    ctx.transform(a.x * dc.ru, a.y * dc.ru, b.x * dc.rv, b.y * dc.rv, q.x, q.y);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, M.TAU);
    if (dc.glow) {
      ctx.shadowColor = dc.glow;
      ctx.shadowBlur = 3 * cam.zoom;
    }
    ctx.fillStyle = tint(dc.color, flash);
    ctx.fill();
    ctx.restore();
  }

  function boxOf(cam, groups) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const g of groups) {
      for (const b of g.balls) {
        const q = cam.p(b.c);
        const r = b.r * cam.zoom;
        if (q.x - r < x0) x0 = q.x - r;
        if (q.x + r > x1) x1 = q.x + r;
        if (q.y - r < y0) y0 = q.y - r;
        if (q.y + r > y1) y1 = q.y + r;
      }
    }
    return x1 > x0 ? { x0, y0, x1, y1 } : null;
  }
  const pad = (b, p) => (b ? { x0: b.x0 - p, y0: b.y0 - p, x1: b.x1 + p, y1: b.y1 + p } : { x0: 0, y0: 0, x1: 0, y1: 0 });

  /** Sombra no chão: cada bola projetada pela luz (as altas, mais claras e menores). */
  function drawShadow(ctx, cam, groups, groundZ) {
    const L = cam.light;
    const path = new Path2D();
    for (const g of groups) {
      if (g.noShadow) continue;
      for (const b of g.balls) {
        const h = Math.max(0, b.c.z - groundZ);
        const gx = b.c.x - (L.x / L.z) * h;
        const gy = b.c.y - (L.y / L.z) * h;
        const r = b.r * 0.92;
        path.moveTo(gx + r, gy);
        path.arc(gx, gy, r, 0, M.TAU);
      }
    }
    ctx.save();
    ctx.translate(0, -groundZ * cam.cosP * cam.zoom);
    ctx.transform(...cam.groundMatrix());
    ctx.fillStyle = 'rgba(28, 18, 34, 0.3)';
    ctx.fill(path);
    ctx.restore();
  }

  PD.creatures = {
    Creature,
    INK,
    tube,
    tint,
    /** Registra uma criatura: `PD.creatures.define('sagui', ClasseDoSagui)`. */
    define(type, cls) {
      TYPES[type] = cls;
    },
    has(type) {
      return !!TYPES[type];
    },
    create(type, x, y, yaw) {
      const C = TYPES[type];
      return C ? new C(x, y, yaw) : null;
    },
    types: () => Object.keys(TYPES),
  };
})(window.PD = window.PD || {});
