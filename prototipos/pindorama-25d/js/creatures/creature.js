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

    /** `near`: o que a criatura enxerga em volta ({ hero: { x, y } em cm }), para NPC olhar e acenar. */
    update(dt, near) {
      this.near = near || null;
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

    /** Começou a falar (balão): quem tiver gesto de fala usa. */
    talk() {}

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
          // quem tem desenho pintado próprio (`paint`, o sagui novo) usa o seu; as bolas ficam para a sombra e a caixa
          if (parts.paint) parts.paint(ctx, this.flash());
          else paintGroups(ctx, cam, parts.groups, this.flash());
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
  /**
   * Ordem de desenho das partes: pela posição no chão (perto da câmera, depois) e pouco pela altura, como as partes do
   * corpo da gente (renderer.js): o rabo deitado no chão do lado da câmera fica na frente do corpo sentado. `bias`
   * puxa uma parte para a frente (ou para trás, negativo).
   */
  function byDepth(cam, groups) {
    const K = PD.ISO_K * cam.cosP;
    const depth = (p) => (p.x + p.y) * K + p.z * 0.15;
    const sorted = groups.filter((g) => g.balls.length || g.paint).map((g) => ({ g, d: depth(g.ref || g.balls[0].c) + (g.bias || 0) }));
    sorted.sort((a, b) => a.d - b.d);
    return sorted.map((s) => s.g);
  }

  function paintGroups(ctx, cam, groups, flash) {
    const zoom = cam.zoom;
    const ink = Math.max(1, 1.15 * zoom);
    const L = cam.lightScreen;
    for (const g of byDepth(cam, groups)) {
      if (!g.balls.length) continue;
      // `under`/`over`: desenho próprio do grupo, antes (atrás) ou depois (na frente) das bolas (ex.: orelhas do gato)
      if (g.under) g.under(ctx);
      const qs = g.balls.map((b) => ({ q: cam.p(b.c), r: b.r * zoom, col: b.col, noInk: b.noInk }));
      // contorno: um pouco maior que cada bola, tudo junto (`noInk`: a emenda com o grupo de antes, sem risco)
      ctx.fillStyle = INK;
      ctx.beginPath();
      for (const { q, r, noInk } of qs) {
        if (noInk) continue;
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
      if (g.over) g.over(ctx);
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
    let u = dc.u;
    let v = dc.v;
    if (dc.rot) {
      // girado no próprio plano (sobrancelha inclinada, pétala)
      const c = Math.cos(dc.rot), s = Math.sin(dc.rot);
      u = M.add(M.scale(dc.u, c), M.scale(dc.v, s));
      v = M.add(M.scale(dc.v, c), M.scale(dc.u, -s));
    }
    const a = cam.pDir(u);
    const b = cam.pDir(v);
    // (sem save/restore: dentro de um recorte — o corpo pintado do sagui —, cada restore custa caro; só a posição
    // e a sombra do brilho são guardadas e devolvidas)
    const m0 = ctx.getTransform();
    ctx.transform(a.x * dc.ru, a.y * dc.ru, b.x * dc.rv, b.y * dc.rv, q.x, q.y);
    ctx.beginPath();
    if (dc.shape === 'shield') {
      // escudo (o logo da Budega no peito): topo reto com as quinas, laterais e a ponta embaixo
      ctx.moveTo(-0.95, 0.85);
      ctx.lineTo(-0.55, 1);
      ctx.lineTo(0.55, 1);
      ctx.lineTo(0.95, 0.85);
      ctx.lineTo(0.9, -0.15);
      ctx.quadraticCurveTo(0.6, -0.7, 0, -1);
      ctx.quadraticCurveTo(-0.6, -0.7, -0.9, -0.15);
      ctx.closePath();
    } else if (dc.shape === 'tri') {
      // triângulo com a ponta para `v` (a mancha em "V" da jararaca, de pé no flanco)
      ctx.moveTo(-1, -0.85);
      ctx.lineTo(1, -0.85);
      ctx.lineTo(0, 1);
      ctx.closePath();
    } else ctx.arc(0, 0, 1, 0, M.TAU);
    const blur0 = ctx.shadowBlur, color0 = ctx.shadowColor;
    if (dc.glow) {
      ctx.shadowColor = dc.glow;
      ctx.shadowBlur = 3 * cam.zoom;
    }
    ctx.fillStyle = tint(dc.color, flash);
    ctx.fill();
    if (dc.glow) {
      ctx.shadowBlur = blur0;
      ctx.shadowColor = color0;
    }
    ctx.setTransform(m0);
  }

  // ------------------------------------------------------------------ o desenho pintado (pelo, membros)
  // Os bichos redesenhados (o sagui primeiro, 23/11) deixam as bolas e são pintados como o Birim: o contorno de tinta
  // mais grosso do lado da sombra, a meia-lua de sombra do lado contrário à luz e uma faixa fina de brilho do lado
  // dela. O pelo é a beirada em mechas pontudas. As bolas continuam só para a sombra no chão e a caixa do desenho.

  /** Número entre 0 e 1 sorteado de um inteiro (sempre o mesmo para o mesmo número). */
  function hash01(k) {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /** Área com sinal de um polígono [x0, y0, ...] (o sinal diz o sentido dos vértices). */
  function areaOf(p) {
    let a = 0;
    for (let i = 0, n = p.length; i < n; i += 2) {
      const j = (i + 2) % n;
      a += p[i] * p[j + 1] - p[j] * p[i + 1];
    }
    return a / 2;
  }

  /**
   * O polígono convexo `px` px maior (para fora), seja qual for o sentido dos pontos (o `offsetConvex` cresce para um
   * lado e encolhe para o outro: o casco de círculos, com o número positivo, encolhe).
   */
  function grow(poly, px) {
    return PD.shapes.offsetConvex(poly, areaOf(poly) > 0 ? -px : px);
  }

  /**
   * O contorno de pelo em volta de um polígono de tela ([x0, y0, ...], de preferência convexo): `count` mechas de
   * largura igual, a primeira no ponto mais baixo da tela (o pé do corpo, que as patas escondem) — com o número de
   * mechas fixo, elas não pulam de lugar de um quadro para o outro, só esticam junto com o corpo. A maioria é curta e
   * arredondada (o pelo macio); umas poucas, compridas e pontudas (os tufos).
   * `len`: comprimento das mais compridas (px); `seed`: o sorteio de cada uma; `comb`: quanto a ponta deita;
   * `flow` ({ x, y }, unitário): para onde o pelo é penteado (da cabeça para o rabo) — sem ele, deita de lado.
   * Devolve { V, T, n }: as bases (um pouco para dentro) e as pontas, para `furTrace`.
   */
  function furOutline(poly, count, len, seed = 0, comb = 0.3, flow = null, sharpFrac = 0.38, open = false) {
    const n = poly.length / 2;
    if (n < 3) return null;
    const sgn = areaOf(poly) >= 0 ? 1 : -1;
    // `open` (o membro): o pelo vai do primeiro ao último ponto, sem a aresta que fecha (a emenda no corpo)
    let start = 0;
    if (!open) for (let i = 1; i < n; i++) if (poly[i * 2 + 1] > poly[start * 2 + 1]) start = i;
    // as arestas a partir do ponto mais baixo, com o comprimento acumulado
    const ex = [], ey = [], el = [], acc = [0];
    let per = 0;
    for (let k = 0; k < (open ? n - 1 : n); k++) {
      const i = (start + k) % n, j = (i + 1) % n;
      const dx = poly[j * 2] - poly[i * 2], dy = poly[j * 2 + 1] - poly[i * 2 + 1];
      const l = Math.hypot(dx, dy) || 1e-6;
      ex.push(dx / l);
      ey.push(dy / l);
      el.push(l);
      per += l;
      acc.push(per);
    }
    const E = el.length;
    const at = (s) => {
      s = open ? Math.min(Math.max(s, 0), per) : ((s % per) + per) % per;
      let k = 0;
      while (k < E - 1 && acc[k + 1] < s) k++;
      const i = (start + k) % n;
      const f = s - acc[k];
      // normal para fora (média com a aresta vizinha perto das pontas, para não quebrar nas quinas)
      const kn = f < el[k] * 0.5 ? (open ? Math.max(0, k - 1) : (k - 1 + E) % E) : open ? Math.min(E - 1, k + 1) : (k + 1) % E;
      const w = 0.5 - Math.abs(f / el[k] - 0.5);
      const tx = ex[k] * (0.5 + w) + ex[kn] * (0.5 - w), ty = ey[k] * (0.5 + w) + ey[kn] * (0.5 - w);
      const tl = Math.hypot(tx, ty) || 1;
      return { x: poly[i * 2] + ex[k] * f, y: poly[i * 2 + 1] + ey[k] * f, nx: (sgn * ty) / tl, ny: (-sgn * tx) / tl, tx: tx / tl, ty: ty / tl };
    };
    const m = Math.max(open ? 2 : 5, count | 0);
    const st = per / m;
    const V = [], T = [];
    for (let k = 0; k < m; k++) {
      const v = at(k * st);
      const inset = open && k === 0 ? 0 : len * 0.12; // a emenda do membro fica no lugar
      V.push({ x: v.x - v.nx * inset, y: v.y - v.ny * inset });
      const t = at((k + 0.5) * st);
      const h = hash01(k + seed * 97);
      const sharp = h > 1 - sharpFrac;
      const l = len * (sharp ? 0.65 + 0.35 * hash01(k * 3 + seed) : 0.18 + 0.3 * h);
      // penteado: a ponta deita para o lado do `flow` (nunca para dentro do corpo)
      let cx = t.tx, cy = t.ty;
      if (flow) {
        const along = flow.x * t.tx + flow.y * t.ty;
        cx = along >= 0 ? t.tx : -t.tx;
        cy = along >= 0 ? t.ty : -t.ty;
      }
      const c = comb * (sharp ? 1 : 0.5);
      T.push({ x: t.x + t.nx * l + cx * l * c, y: t.y + t.ny * l + cy * l * c, nx: t.nx, ny: t.ny, sharp });
    }
    if (open) {
      const e = at(per);
      V.push({ x: e.x, y: e.y });
    }
    return { V, T, n: m, len, open };
  }

  /**
   * Traça o contorno de pelo (deslocado de dx, dy) no caminho: as mechas curtas viram ondinhas redondas (passam pela
   * ponta) e as compridas, pontas finas.
   */
  function furTrace(fur, dx = 0, dy = 0, path = new Path2D(), close = true) {
    const { V, T, n, len, open } = fur;
    const b = len * 0.18;
    path.moveTo(V[0].x + dx, V[0].y + dy);
    for (let k = 0; k < n; k++) {
      const a = V[k], t = T[k], c = open ? V[k + 1] : V[(k + 1) % n];
      if (t.sharp) {
        path.quadraticCurveTo((a.x + t.x) / 2 + t.nx * b + dx, (a.y + t.y) / 2 + t.ny * b + dy, t.x + dx, t.y + dy);
        path.quadraticCurveTo((t.x + c.x) / 2 + t.nx * b + dx, (t.y + c.y) / 2 + t.ny * b + dy, c.x + dx, c.y + dy);
      } else {
        // a curva que passa pela ponta no meio do caminho: uma ondinha
        path.quadraticCurveTo(2 * t.x - (a.x + c.x) / 2 + dx, 2 * t.y - (a.y + c.y) / 2 + dy, c.x + dx, c.y + dy);
      }
    }
    // `close` falso: só o risco (o membro, sem a emenda com o corpo)
    if (close) path.closePath();
    return path;
  }

  /**
   * Contorno de um membro que afina (perna, braço, rabo), em px de tela: os pontos do meio e o raio em cada um.
   * Devolve { L, R, end, poly }: os dois lados, a ponta redonda e o polígono fechado ([x0, y0, ...], para o pelo).
   */
  function limbShape(ptsIn, radsIn, cap = true) {
    // pontos quase em cima um do outro na tela (o membro vindo na direção de quem olha) torciam a ponta: saem antes
    const pts = [ptsIn[0]], rads = [radsIn[0]];
    for (let i = 1; i < ptsIn.length; i++) {
      const last = pts[pts.length - 1];
      if (Math.hypot(ptsIn[i].x - last.x, ptsIn[i].y - last.y) < Math.max(0.6, radsIn[i] * 0.45)) {
        if (i === ptsIn.length - 1 && pts.length > 1) {
          pts[pts.length - 1] = ptsIn[i];
          rads[rads.length - 1] = radsIn[i];
        }
        continue;
      }
      pts.push(ptsIn[i]);
      rads.push(radsIn[i]);
    }
    const n = pts.length;
    const L = [], R = [];
    let ang = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) {
        dx = 1;
        dy = 0;
      } else {
        dx /= d;
        dy /= d;
      }
      ang = Math.atan2(dy, dx);
      L.push({ x: pts[i].x - dy * rads[i], y: pts[i].y + dx * rads[i] });
      R.push({ x: pts[i].x + dy * rads[i], y: pts[i].y - dx * rads[i] });
    }
    const e = pts[n - 1];
    const end = cap ? { x: e.x, y: e.y, r: rads[n - 1], a0: ang + Math.PI / 2, a1: ang - Math.PI / 2 } : null;
    const poly = [];
    for (const p of L) poly.push(p.x, p.y);
    if (end) for (let k = 1; k < 8; k++) {
      const a = end.a0 - (k / 8) * Math.PI;
      poly.push(end.x + Math.cos(a) * end.r, end.y + Math.sin(a) * end.r);
    }
    for (let i = R.length - 1; i >= 0; i--) poly.push(R[i].x, R[i].y);
    return { L, R, end, poly, pts, rads };
  }

  /** O caminho fechado do membro (deslocado de dx, dy), para pintar e recortar. */
  function limbPath(s, dx = 0, dy = 0, path = new Path2D()) {
    path.moveTo(s.L[0].x + dx, s.L[0].y + dy);
    for (let i = 1; i < s.L.length; i++) path.lineTo(s.L[i].x + dx, s.L[i].y + dy);
    if (s.end) path.arc(s.end.x + dx, s.end.y + dy, s.end.r, s.end.a0, s.end.a1, true);
    for (let i = s.R.length - 1; i >= 0; i--) path.lineTo(s.R[i].x + dx, s.R[i].y + dy);
    path.closePath();
    return path;
  }

  /** O risco do membro: os dois lados e a ponta; o começo (a emenda no corpo) fica sem risco. */
  function limbStrokePath(s, dx = 0, dy = 0, path = new Path2D()) {
    path.moveTo(s.L[0].x + dx, s.L[0].y + dy);
    for (let i = 1; i < s.L.length; i++) path.lineTo(s.L[i].x + dx, s.L[i].y + dy);
    const last = s.R[s.R.length - 1];
    if (s.end) path.arc(s.end.x + dx, s.end.y + dy, s.end.r, s.end.a0, s.end.a1, true);
    else path.moveTo(last.x + dx, last.y + dy);
    for (let i = s.R.length - 1; i >= 0; i--) path.lineTo(s.R[i].x + dx, s.R[i].y + dy);
    return path;
  }

  /**
   * Pinta um volume do jeito do Birim, a partir de uma função que traça a forma (`trace(dx, dy, path)`): o contorno
   * de tinta por fora (mais grosso do lado da sombra; `stroke` pode traçar só uma parte dele), a cor, os detalhes por
   * cima (`inside`, já recortados na forma) e então a meia-lua de sombra e a faixa de brilho, transparentes (escurecem
   * e clareiam o que estiver embaixo, detalhes inclusive). `look`: { base, shade, light } (shade e light em rgba),
   * `k`: a largura da sombra (px), `ink`: a grossura do contorno (px), `flash`: o clarão do golpe.
   */
  function paintLit(ctx, cam, trace, look, k, ink, flash, opts = {}) {
    const L = cam.lightScreen;
    // a forma é traçada uma vez só; as cópias deslocadas (a sombra, o brilho, o risco pesado) vêm dela (addPath)
    const shape = trace(0, 0, new Path2D());
    const moved = (p, dx, dy) => {
      const q = new Path2D();
      q.addPath(p, { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy });
      return q;
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (ink > 0) {
      const line = opts.stroke ? opts.stroke(0, 0, new Path2D()) : shape;
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 2;
      ctx.stroke(line);
      // o risco mais grosso do lado da sombra (as peças pequenas, sem)
      if (opts.heavy !== false) ctx.stroke(moved(line, -L.x * ink * 0.5, -L.y * ink * 0.5));
    }
    ctx.fillStyle = tint(look.base, flash);
    ctx.fill(shape);
    const shade = k > 0.3;
    if (!shade && !opts.inside && !opts.after) return shape;
    ctx.save();
    ctx.clip(shape);
    if (opts.inside) opts.inside(ctx);
    if (shade) {
      // `light`: uma forma lisa (sem as mechas, um pouco maior) só para a meia-lua e o brilho — dentro do recorte do
      // pelo o resultado é o mesmo, e pintar o contorno de pelo mais quatro vezes pesava
      // (a forma lisa cobre o pelo todo, `lightPad` px para fora da beirada: o deslocamento cresce o mesmo tanto)
      const base = opts.light ? opts.light(0, 0, new Path2D()) : shape;
      const pad = opts.light ? opts.lightPad || 0 : 0;
      const sh = new Path2D();
      sh.addPath(base);
      sh.addPath(base, { a: 1, b: 0, c: 0, d: 1, e: L.x * (k + pad), f: L.y * (k + pad) });
      ctx.fillStyle = look.shade;
      ctx.fill(sh, 'evenodd');
      const hk = k * (opts.highlight ?? 0.45);
      if (look.light && hk > 0.3) {
        const hl = new Path2D();
        hl.addPath(base);
        hl.addPath(base, { a: 1, b: 0, c: 0, d: 1, e: -L.x * (hk + pad), f: -L.y * (hk + pad) });
        // (o brilho já é branco transparente: o clarão não mexe nele — clarear uma cor rgba saía cor inválida, e o
        // navegador ficava com a cor da sombra: no golpe, a beirada do lado da luz saía escura)
        ctx.fillStyle = look.light;
        ctx.fill(hl, 'evenodd');
      }
    }
    if (opts.after) opts.after(ctx);
    ctx.restore();
    return shape;
  }

  /**
   * O rosto (e o que mais for pintado na superfície de uma cabeça): roda `draw` num plano que encosta na esfera
   * `head` ({ c, f, s, u, r }: centro, frente, lado, cima e raio) no ponto da direção (f, s, u); x para o lado de fora
   * (`mirror` -1 espelha), y para cima, em cm. Do lado de trás (de costas para a câmera) não desenha.
   */
  function onSurface(ctx, cam, head, f, s, u, mirror, draw, minFacing = 0.06) {
    const h = head;
    const n = M.norm({ x: h.f.x * f + h.s.x * s + h.u.x * u, y: h.f.y * f + h.s.y * s + h.u.y * u, z: h.f.z * f + h.s.z * s + h.u.z * u });
    if (M.dot(n, cam.toCamera) < minFacing) return false;
    const c = M.add(h.c, M.scale(n, h.r));
    const uu = M.norm(M.sub(h.s, M.scale(n, M.dot(h.s, n))));
    let v = M.norm(M.cross(uu, n));
    if (M.dot(v, h.u) < 0) v = M.scale(v, -1);
    const a = cam.pDir(uu), b = cam.pDir(v), q = cam.p(c);
    // (sem save/restore: dentro de um recorte, cada restore obriga o navegador a desenhar o que estava na fila —
    // ~75 vezes mais caro; só a posição é guardada e devolvida)
    const m0 = ctx.getTransform();
    ctx.transform(a.x * mirror, a.y * mirror, b.x, b.y, q.x, q.y);
    draw(M.dot(n, cam.toCamera));
    ctx.setTransform(m0);
    return true;
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

  /**
   * À noite os bichos ficam mais fortes e de olhos vermelhos (todos; a view liga com o setTimeOfDay): os olhos de cada
   * criatura passam por aqui.
   */
  const eyes = { night: false };
  function eyeColor(day) {
    return eyes.night ? '#ff3b26' : day;
  }
  function eyeGlow(dayGlow) {
    return eyes.night ? 'rgba(255, 70, 40, 0.95)' : dayGlow;
  }

  PD.creatures = {
    Creature,
    INK,
    eyes,
    eyeColor,
    eyeGlow,
    tube,
    tint,
    hash01,
    byDepth,
    /** O desenho pintado dos bichos redesenhados (sem bolas): pelo, membros, luz e sombra do Birim e o rosto. */
    paint: { furOutline, furTrace, limbShape, limbPath, limbStrokePath, paintLit, onSurface, decal, grow },
    /** Sombra das bolas projetada num plano de altura `z` (cm): o chão, ou o assento do sofá para o gato. */
    drawShadow,
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
