// Objetos em pé do cenário (prédios, árvores, postes, muros, banca, orelhão...), no mesmo estilo HQ do
// personagem: contorno de tinta, 2 ou 3 tons, luz do alto à esquerda.
//
// Cada objeto é desenhado UMA vez numa imagem fora da tela (sprite) e depois só copiado. Só o que se mexe
// (copa balançando, semáforo) é tratado a cada quadro, e mesmo assim reaproveitando a imagem pronta.
(function (PD) {
  'use strict';
  const M = PD.math;
  const S = PD.shapes;
  const INK = '#1b100d';
  const FONT_SIGN = '"Bangers", "Impact", "Arial Black", sans-serif';

  // ------------------------------------------------------------------ base
  class Prop {
    constructor(world, fp, opts = {}) {
      this.world = world;
      this.cam = world.cam;
      this.fp = fp; // pé no chão (caixa): x0, x1, y0, y1
      this.z0 = world.ground.heightAt((fp.x0 + fp.x1) / 2, (fp.y0 + fp.y1) / 2);
      this.overhead = !!opts.overhead;
      this.fades = opts.fades !== false; // fica transparente quando esconde o personagem
      this.alpha = 1;
      this.spriteKey = '';
    }
    get ink() {
      return Math.max(1, 1.05 * this.cam.zoom);
    }
    P(x, y, z) {
      return this.cam.p({ x, y, z });
    }
    /** Caixa na tela (px do mundo) que o desenho ocupa — usada para o sprite e para esconder/mostrar. */
    screenBox() {
      return null;
    }
    paint() {}
    /** A imagem e a caixa valem para um zoom e uma densidade de tela. */
    _zoomKey() {
      // o texto é montado uma vez por zoom (na câmera, que é a mesma de todos): a [estrutura] mediu que montá-lo a
      // cada leitura, em ~1000 objetos e várias vezes por quadro, era o que mais gastava no desenho
      const cam = this.cam;
      if (cam._keyZoom !== cam.zoom || cam._keyDpr !== cam.dpr) {
        cam._keyZoom = cam.zoom;
        cam._keyDpr = cam.dpr;
        cam._zoomKey = `${cam.zoom.toFixed(4)}|${cam.dpr}`;
      }
      return cam._zoomKey;
    }
    /**
     * Área da tela ocupada (px do mundo, com a folga da imagem), sem fazer a imagem: a ordem de desenho e o "esconde o
     * personagem" só precisam da caixa. A imagem só é feita quando o objeto chega perto da tela — antes saíam as de
     * todos de uma vez: no mapa da mata nova (mil objetos) o jogo travava 2 s ao entrar e a cada zoom, e as imagens
     * passavam de 200 MB no celular.
     */
    get bounds() {
      const key = this._zoomKey();
      if (!this._bb || this._bbKey !== key) {
        const b = this.screenBox();
        const pad = 6;
        const x0 = Math.floor(b.x0 - pad), y0 = Math.floor(b.y0 - pad);
        const w = Math.ceil(b.x1 - b.x0 + 2 * pad), h = Math.ceil(b.y1 - b.y0 + 2 * pad);
        this._bb = { x0, y0, x1: x0 + w, y1: y0 + h, w, h };
        this._bbKey = key;
      }
      return this._bb;
    }
    /** A imagem já está feita para o zoom de agora? */
    get spriteReady() {
      return !!this.sprite && this.spriteKey === this._zoomKey();
    }
    _ensureSprite() {
      const cam = this.cam;
      const key = this._zoomKey();
      if (this.sprite && this.spriteKey === key) return;
      const t0 = performance.now();
      const b = this.bounds;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(b.w * cam.dpr));
      c.height = Math.max(1, Math.ceil(b.h * cam.dpr));
      const ctx = c.getContext('2d');
      ctx.setTransform(cam.dpr, 0, 0, cam.dpr, -b.x0 * cam.dpr, -b.y0 * cam.dpr);
      this.paint(ctx);
      this.sprite = { c, x: b.x0, y: b.y0, w: b.w, h: b.h, zoom: cam.zoom };
      this.spriteKey = key;
      // o mundo conta quanto tempo do quadro foi gasto fazendo imagens (veja World.buildBusy)
      const w = this.world;
      if (w) {
        w._buildMs = (w._buildMs || 0) + performance.now() - t0;
        w._built = (w._built || 0) + 1;
      }
    }
    /** Solta a imagem (o objeto ficou longe da tela); ela é refeita quando ele voltar. */
    dropSprite() {
      this.sprite = null;
      this.spriteKey = '';
    }
    /**
     * A imagem para desenhar agora: a pronta; ou, logo depois de mudar o zoom, quando o quadro já gastou o tempo de
     * refazer imagens, a antiga esticada para o zoom novo (a tela não trava e fica nítida em poucos quadros). Esticar
     * funciona porque a posição na tela é proporcional ao zoom.
     */
    _spriteNow() {
      const s = this.sprite;
      if (s && this.spriteKey !== this._zoomKey() && this.world.buildBusy && this.world.buildBusy()) {
        const k = this.cam.zoom / s.zoom;
        return { c: s.c, x: s.x * k, y: s.y * k, w: s.w * k, h: s.h * k };
      }
      this._ensureSprite();
      return this.sprite;
    }
    draw(ctx) {
      const s = this._spriteNow();
      if (this.alpha < 0.999) ctx.globalAlpha = this.alpha;
      ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ utilidades de desenho
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  /** Desenha em cm numa parede (a = ao longo, b = para baixo a partir do alto `top`). */
  function onWall(ctx, cam, o, dir, fn) {
    ctx.save();
    const m = cam.wallMatrix(o, dir);
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    fn();
    ctx.restore();
  }
  /** Caixa 3D (faces +x, +y e de cima) com contorno de tinta. */
  function box(ctx, cam, x0, x1, y0, y1, z0, z1, colors, ink) {
    const P = (x, y, z) => cam.p({ x, y, z });
    const fy = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)];
    const fx = [P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)];
    const top = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
    const sil = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), P(x0, y1, z1)];
    poly(ctx, sil, null, INK, ink * 2.4);
    poly(ctx, fy, colors.front);
    poly(ctx, fx, colors.side);
    poly(ctx, top, colors.top);
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 0.8;
    ctx.beginPath();
    ctx.moveTo(fy[1].x, fy[1].y);
    ctx.lineTo(fy[2].x, fy[2].y);
    ctx.lineTo(fy[3].x, fy[3].y);
    ctx.moveTo(fy[2].x, fy[2].y);
    ctx.lineTo(fx[2].x, fx[2].y);
    ctx.stroke();
    return { fy, fx, top, sil };
  }
  /** Sombra (no chão) de uma caixa de altura h: casco do pé + topo empurrado pela luz. */
  function boxShadow(path, cam, x0, x1, y0, y1, h) {
    const L = cam.light;
    const dx = (-L.x / L.z) * h;
    const dy = (-L.y / L.z) * h;
    const pts = [];
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) pts.push(x, y, x + dx, y + dy);
    const hull = S.convexHull(pts);
    S.polyPath(hull, 0, 0, path);
  }
  function circleShadow(path, cam, x, y, r, h) {
    const L = cam.light;
    const cx = x - (L.x / L.z) * h;
    const cy = y - (L.y / L.z) * h;
    path.moveTo(cx + r, cy);
    path.ellipse(cx, cy, r * 1.15, r * 0.95, Math.atan2(-L.y, -L.x), 0, M.TAU);
  }
  function lineShadow(path, cam, x, y, h, w) {
    const L = cam.light;
    const ex = x - (L.x / L.z) * h;
    const ey = y - (L.y / L.z) * h;
    const nx = -(ey - y);
    const ny = ex - x;
    const l = Math.hypot(nx, ny) || 1;
    const ox = (nx / l) * w;
    const oy = (ny / l) * w;
    path.moveTo(x + ox, y + oy);
    path.lineTo(ex + ox * 0.6, ey + oy * 0.6);
    path.lineTo(ex - ox * 0.6, ey - oy * 0.6);
    path.lineTo(x - ox, y - oy);
    path.closePath();
  }

  // ------------------------------------------------------------------ prédio
  class Building extends Prop {
    constructor(world, b) {
      super(world, { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
      this.b = b;
      this.collider = { type: 'box', x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 };
    }
    screenBox() {
      const { x0, x1, y0, y1, h } = this.b;
      const z0 = this.z0;
      const up = this.b.topExtra || 220;
      const pts = [this.P(x0, y1, z0), this.P(x1, y1, z0), this.P(x1, y0, z0), this.P(x0, y0, z0 + h + up), this.P(x1, y0, z0 + h + up), this.P(x0, y1 + 160, z0 + h), this.P(x1, y1, z0 + h + up * 0.6)];
      return bbox(pts, 30 * this.cam.zoom);
    }
    shadow(path) {
      const b = this.b;
      boxShadow(path, this.cam, b.x0, b.x1, b.y0, b.y1, b.h);
    }
    contact(ctx) {
      const b = this.b;
      const g = ctx.createLinearGradient(0, b.y1, 0, b.y1 + 60);
      g.addColorStop(0, 'rgba(20,16,30,0.35)');
      g.addColorStop(1, 'rgba(20,16,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x0, b.y1, b.x1 - b.x0, 60);
      const g2 = ctx.createLinearGradient(b.x1, 0, b.x1 + 60, 0);
      g2.addColorStop(0, 'rgba(20,16,30,0.3)');
      g2.addColorStop(1, 'rgba(20,16,30,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(b.x1, b.y0, 60, b.y1 - b.y0);
    }
    paint(ctx) {
      const cam = this.cam;
      const b = this.b;
      const z0 = this.z0;
      const ink = this.ink;
      const wall = b.wall;
      const side = M.shade(wall, -0.28);
      const top = '#a9a397';
      box(ctx, cam, b.x0, b.x1, b.y0, b.y1, z0, z0 + b.h, { front: wall, side, top }, ink);
      const W = b.x1 - b.x0;
      const D = b.y1 - b.y0;
      // ---- fachada da frente (+y)
      onWall(ctx, cam, { x: b.x0, y: b.y1, z: z0 + b.h }, { x: 1, y: 0 }, () => {
        // manchas de chuva
        const r = M.rng(b.x0 + 3);
        ctx.fillStyle = 'rgba(60, 50, 40, 0.08)';
        for (let i = 0; i < 9; i++) ctx.fillRect(r() * W, 40, 20 + r() * 40, 120 + r() * (b.h - 200));
        // platibanda
        ctx.fillStyle = b.trim;
        ctx.fillRect(0, 0, W, 34);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 34, W, 8);
        // pichação (riscos altos e pontudos, sem palavra de ninguém)
        if (b.pixo) pixo(ctx, W, 60, M.rng(b.x0 + 9));
        // janelas dos andares de cima
        const upper = b.h - 330;
        const rows = Math.max(1, b.floors - 1);
        for (let f = 0; f < rows; f++) {
          const yTop = 70 + f * (upper / rows);
          const n = Math.max(2, Math.floor(W / 175));
          const gap = W / n;
          for (let k = 0; k < n; k++) {
            const wx = k * gap + gap / 2 - 52;
            window_(ctx, wx, yTop, 104, Math.min(130, upper / rows - 40), b, M.rng(b.x0 + f * 13 + k));
            if (b.balconies) balcony(ctx, wx - 18, yTop + Math.min(130, upper / rows - 40) + 2, 140);
            if (b.ac && k === (f + 1) % n && f < b.ac) acBox(ctx, wx + 104 + 6, yTop + 40);
          }
        }
        // térreo: loja
        shopFront(ctx, b, W, b.h - 320, 320);
      });
      // ---- fachada do lado (+x): começa na quina da frente (y1) e vai para o fundo — o texto sai na ordem certa
      onWall(ctx, cam, { x: b.x1, y: b.y1, z: z0 + b.h }, { x: 0, y: -1 }, () => {
        ctx.fillStyle = M.shade(b.trim, -0.25);
        ctx.fillRect(0, 0, D, 34);
        if (b.pixo) pixo(ctx, D, 60, M.rng(b.y0 + 21), 0.85);
        const rows = Math.max(1, b.floors - 1);
        const upper = b.h - 330;
        for (let f = 0; f < rows; f++) {
          const yTop = 70 + f * (upper / rows);
          const n = Math.max(1, Math.floor(D / 260));
          for (let k = 0; k < n; k++) {
            const wx = (k + 0.5) * (D / n) - 45;
            window_(ctx, wx, yTop, 90, Math.min(120, upper / rows - 40), b, M.rng(b.y0 + f * 5 + k), true);
          }
        }
        if (b.side && b.side.sign) {
          const sw = Math.min(D - 120, 420);
          sign(ctx, 60, b.h - 300, sw, 70, b.side.sign, '#2f6d4f', '#fff6dd');
        }
        // porta lateral / grade
        ctx.fillStyle = M.shade(side, -0.25);
        ctx.fillRect(D - 170, b.h - 240, 110, 240);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 5;
        ctx.strokeRect(D - 170, b.h - 240, 110, 240);
      });
      // ---- telhado: caixa d'água, antena, ar-condicionado
      if (b.tank) tank(ctx, cam, b.x0 + W * 0.3, b.y0 + D * 0.45, z0 + b.h, ink);
      if (b.antenna) antenna(ctx, cam, b.x0 + W * 0.75, b.y0 + D * 0.35, z0 + b.h, ink);
      // contorno de cima (platibanda)
      const tpts = [this.P(b.x0, b.y0, z0 + b.h), this.P(b.x1, b.y0, z0 + b.h), this.P(b.x1, b.y1, z0 + b.h), this.P(b.x0, b.y1, z0 + b.h)];
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = ink * 2.2;
      ctx.beginPath();
      ctx.moveTo(tpts[3].x, tpts[3].y + ink * 2);
      ctx.lineTo(tpts[2].x, tpts[2].y + ink * 2);
      ctx.lineTo(tpts[1].x - ink * 2, tpts[1].y);
      ctx.stroke();
      // toldo (sai da parede, em 3D) depois de tudo
      if (b.shop && b.shop.awning) awning(ctx, cam, b, z0, ink);
    }
  }

  const DEG_P = Math.PI / 180;

  // ------------------------------------------------------------------ casa da vila (Mapa 01, etapa 4b)
  // Casa de periferia: caixa de 1 ou 2 andares; a frente (o lado sul, +y, o que a câmera vê) tem porta e janelas de
  // grade; laje com caixa d'água; parede pintada (`cor`) ou bloco aparente sem reboco; pichação. Abandonada: janelas
  // quebradas, porta tapada com tábuas, parede manchada e cipó subindo. A vendinha (a Budega) tem porta de enrolar meio
  // aberta com as prateleiras acesas, letreiro e toldo listrado — e nada de cigarro ou tabaco no desenho.
  const BLOCK = { base: '#a59d90', mortar: '#7f786d', light: '#b9b1a3' };
  class House extends Building {
    constructor(world, b) {
      super(world, b);
      const wall = b.block ? BLOCK.base : b.abandoned ? M.shade(b.wall, -0.2) : b.wall;
      // a laje com árvore ou varal precisa de mais espaço em cima na imagem
      // (com a árvore de dentro de verdade, `innerTree`, a copa é a da própria árvore, desenhada por cima da casa)
      const topExtra = b.treeInside && !b.innerTree ? 980 : b.roofTree ? 640 : b.clothes ? 300 : 220;
      this.b = { ...b, wall, trim: b.block ? '#8a8378' : M.shade(wall, 0.38), topExtra };
      if (b.interior) {
        // casa que dá para entrar (a Budega, pedido do dono: "igual HumanitZ"): na ordem de desenho ela é a parede da
        // frente — quem está dentro fica atrás dela e na frente da parede do fundo (HouseBack). Com o herói dentro, o
        // telhado e as paredes da frente saem com suavidade (`cutK` de 0 a 1) e fica só a base delas.
        this.fp = { x0: b.x0, x1: b.x1, y0: b.y1 - 20, y1: b.y1 };
        this.cutK = 0;
      }
    }
    draw(ctx, t) {
      if (!this.b.interior) return super.draw(ctx, t);
      const w = this.world;
      this.cutK = M.damp(this.cutK, w.insideHouse === this ? 1 : 0, 9, w._dt || 1 / 60);
      if (this.cutK > 0.999) this.cutK = 1;
      if (this.cutK < 0.001) this.cutK = 0;
      // cortada, ela não cobre o herói: sem a "janela" transparente das casas
      this.fades = this.cutK < 0.5;
      const a = this.alpha;
      if (this.cutK < 1) {
        this.alpha = a * (1 - this.cutK);
        super.draw(ctx, t);
        this.alpha = a;
      }
      if (this.cutK > 0) {
        const s = this._cutSprite();
        ctx.globalAlpha = this.cutK * a;
        ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
        ctx.globalAlpha = 1;
      }
    }
    dropSprite() {
      super.dropSprite();
      this._cut = null;
    }
    /** A imagem da casa cortada (feita na hora em que precisar; a mesma caixa da casa inteira). */
    _cutSprite() {
      const cam = this.cam;
      const key = this._zoomKey();
      if (this._cut && this._cutKey === key) return this._cut;
      const b = this.bounds;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(b.w * cam.dpr));
      c.height = Math.max(1, Math.ceil(b.h * cam.dpr));
      const ctx = c.getContext('2d');
      ctx.setTransform(cam.dpr, 0, 0, cam.dpr, -b.x0 * cam.dpr, -b.y0 * cam.dpr);
      this.paintCut(ctx);
      this._cut = { c, x: b.x0, y: b.y0, w: b.w, h: b.h };
      this._cutKey = key;
      return this._cut;
    }
    /**
     * A casa cortada (herói dentro): só a base das paredes da frente (+y) e do lado (+x), com o corte claro em cima, e
     * a soleira na porta. A porta é o vão da porta de enrolar (a frente toda, menos 34 cm de cada ponta).
     */
    paintCut(ctx) {
      const cam = this.cam;
      const b = this.b;
      const z0 = this.z0;
      const ink = this.ink;
      const T = 15;
      const hc = 45;
      const side = M.shade(b.wall, -0.26);
      const cut = { front: b.wall, side, top: '#ddd3c2' };
      const P = (x, y, z) => cam.p({ x, y, z });
      // o vão da porta: o do mapa (`door`, nas casas) ou a frente toda menos as pontas (a porta de enrolar da Budega)
      const d0 = b.door ? b.door.from : b.x0 + 34, d1 = b.door ? b.door.to : b.x1 - 34;
      // a soleira no vão da porta
      poly(ctx, [P(d0, b.y1 - T, z0 + 1), P(d1, b.y1 - T, z0 + 1), P(d1, b.y1, z0 + 1), P(d0, b.y1, z0 + 1)], b.abandoned ? '#8f8b83' : '#b9b2a4', 'rgba(27, 16, 13, 0.5)', ink);
      box(ctx, cam, b.x1 - T, b.x1, b.y0, b.y1, z0, z0 + hc, cut, ink);
      box(ctx, cam, b.x0, d0, b.y1 - T, b.y1, z0, z0 + hc, cut, ink);
      box(ctx, cam, d1, b.x1, b.y1 - T, b.y1, z0, z0 + hc, cut, ink);
      // musgo na base de fora, como na casa inteira
      if (b.moss) {
        const r = M.rng(Math.round(b.x0 * 3 + 5));
        ctx.fillStyle = 'rgba(86, 118, 52, 0.55)';
        for (let k = 0; k < 8; k++) {
          const x = b.x0 + r() * (b.x1 - b.x0);
          const p = P(x, b.y1, z0 + r() * hc * 0.6);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, (6 + r() * 10) * cam.zoom, (3 + r() * 4) * cam.zoom, 0, 0, M.TAU);
          ctx.fill();
        }
      }
    }
    paint(ctx) {
      const cam = this.cam;
      const b = this.b;
      const z0 = this.z0;
      const ink = this.ink;
      const W = b.x1 - b.x0;
      const D = b.y1 - b.y0;
      const H = b.h;
      const side = M.shade(b.wall, -0.26);
      box(ctx, cam, b.x0, b.x1, b.y0, b.y1, z0, z0 + H, { front: b.wall, side, top: '#9d988d' }, ink);
      const floors = Math.max(1, b.floors || 1);
      const fh = H / floors;
      const shop = b.shop && b.shop.type;
      // ---- frente (+y)
      onWall(ctx, cam, { x: b.x0, y: b.y1, z: z0 + H }, { x: 1, y: 0 }, () => {
        const r = M.rng(Math.round(b.x0 * 3 + 11));
        const openings = [];
        wallTexture(ctx, b, W, H, r);
        // a beirada da laje
        ctx.fillStyle = M.shade(b.wall, -0.12);
        ctx.fillRect(0, 0, W, 16);
        if (b.pixo) pixo(ctx, W, H - 150, M.rng(b.x0 + 9), 0.9);
        for (let f = 0; f < floors; f++) {
          const yTop = H - (f + 1) * fh; // topo deste andar (y desce a partir da laje)
          if (f === 0 && shop) {
            vendinha(ctx, b, W, H, r);
            continue;
          }
          if (f === 0 && b.tower) {
            // prédio do conjunto: a entrada no meio, com a placa do bloco
            towerEntrance(ctx, W, H, b);
            continue;
          }
          // a casa que dá para entrar tem a porta onde o mapa diz (`door`, o vão de 1,2 m) e aberta
          const door = f === 0 && b.door ? { x: b.door.from - b.x0, w: b.door.to - b.door.from } : null;
          const doorW = f === 0 ? (door ? door.w : 92) : 0;
          const doorX = f === 0 ? (door ? door.x : Math.min(W - doorW - 50, W * 0.18)) : 0;
          if (f === 0) (door ? openDoor : houseDoor)(ctx, doorX, H - 212, doorW, 212, b, r);
          if (f === 0 && b.treeInside) openings.push({ x: doorX, y: H - 212, w: doorW, h: 212, door: true });
          // portão de garagem de ferro na ponta da frente
          const gw = f === 0 && b.garage ? Math.min(240, W * 0.4) : 0;
          if (gw) garageDoor(ctx, W - gw - 30, H - 230, gw, 230, r);
          // janelas: no térreo, do outro lado da porta; em cima, espalhadas
          const room = f === 0 ? W - (doorX + doorW) - 60 - (gw ? gw + 40 : 0) : W - 80;
          const n = room > 120 ? Math.max(1, Math.floor(room / 190)) : 0;
          for (let k = 0; k < n; k++) {
            const wx = (f === 0 ? doorX + doorW + 40 : 40) + (room / n) * (k + 0.5) - 55;
            const wy = yTop + Math.max(40, fh * 0.28);
            const wh = Math.min(100, fh * 0.36);
            houseWindow(ctx, wx, wy, 110, wh, b, M.rng(b.x0 + f * 17 + k));
            if (b.treeInside) openings.push({ x: wx, y: wy, w: 110, h: wh });
            if (b.balconies && f > 0) balcony(ctx, wx - 15, wy + wh + 6, 140);
          }
        }
        // a árvore que nasceu dentro de casa: galhos e folhas saindo pela porta e pelas janelas, e as trincas que o
        // tronco abriu na parede logo abaixo do buraco da laje
        if (b.treeInside) treeOpenings(ctx, openings, W, H, r, b.innerTree ? b.innerTree.x - b.x0 : W * 0.48);
        if (b.abandoned) vines(ctx, W, H, r);
        // a casa tomada pela mata: musgo e manchas de chuva, e o cipó cobrindo parte da fachada
        if (b.moss) mossWall(ctx, W, H, r);
        if (b.vine) overgrowth(ctx, W, H, r, b.vine, b.tower ? [W / 2 - 170, W / 2 + 170] : null);
      });
      // ---- lado (+x): começa na quina da frente e vai para o fundo
      onWall(ctx, cam, { x: b.x1, y: b.y1, z: z0 + H }, { x: 0, y: -1 }, () => {
        const r = M.rng(Math.round(b.y0 * 5 + 3));
        const sideOpenings = [];
        wallTexture(ctx, b, D, H, r, true);
        ctx.fillStyle = M.shade(b.wall, -0.36);
        ctx.fillRect(0, 0, D, 16);
        for (let f = 0; f < floors; f++) {
          const yTop = H - (f + 1) * fh;
          const n = Math.max(1, Math.floor((D - 80) / 260));
          for (let k = 0; k < n; k++) {
            const wx = 40 + ((D - 80) / n) * (k + 0.5) - 45;
            houseWindow(ctx, wx, yTop + Math.max(40, fh * 0.28), 90, Math.min(90, fh * 0.33), b, M.rng(b.y0 + f * 7 + k), true);
            if (b.treeInside) sideOpenings.push({ x: wx, y: yTop + Math.max(40, fh * 0.28), w: 90, h: Math.min(90, fh * 0.33) });
          }
        }
        if (b.treeInside) treeOpenings(ctx, sideOpenings, D, H, r, b.innerTree ? b.y1 - b.innerTree.y : D * 0.5);
        if (b.abandoned) vines(ctx, D, H, r);
        if (b.moss) mossWall(ctx, D, H, r);
        if (b.vine) overgrowth(ctx, D, H, r, b.vine * 0.8);
      });
      // ---- laje: caixa d'água, plantas, árvore e varal (do fundo para a frente) e, nas de 2 andares, os ferros
      roofItems(ctx, cam, b, z0 + H, ink);
      if (b.logo) onWall(ctx, cam, { x: b.x0, y: b.y1, z: z0 + H }, { x: 1, y: 0 }, () => logoBoard(ctx, b, W));
      if (floors >= 2) {
        ctx.strokeStyle = '#5a4a3e';
        ctx.lineWidth = Math.max(1, 2.4 * cam.zoom);
        for (const [fx, fy] of [[0.06, 0.06], [0.94, 0.06], [0.94, 0.94], [0.06, 0.94]]) {
          for (let k = 0; k < 3; k++) {
            const bx = b.x0 + W * fx + (k - 1) * 8;
            const by = b.y0 + D * fy;
            const p0 = cam.p({ x: bx, y: by, z: z0 + H });
            const p1 = cam.p({ x: bx + 3, y: by, z: z0 + H + 55 + k * 6 });
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
          }
        }
      }
      if (shop && b.shop.awning) houseAwning(ctx, cam, b, z0, ink);
    }
  }

  /**
   * O fundo de dentro da casa que dá para entrar: as paredes do fundo (-y) e da esquerda (-x) vistas por dentro, com
   * reboco claro em cima e azulejo branco embaixo (faixa azul no meio), o relógio, a placa "FIADO SÓ AMANHÃ" e a lousa
   * de preços, e o topo das paredes (sem a laje). Só aparece com a casa cortada (herói dentro).
   */
  class HouseBack extends Prop {
    constructor(world, house) {
      const b = house.b;
      super(world, { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y0 + 15 }, { fades: false });
      this.house = house;
      this.b = b;
    }
    screenBox() {
      const b = this.b;
      const z0 = this.z0;
      const H = b.h;
      const pts = [this.P(b.x0, b.y0, z0), this.P(b.x1, b.y0, z0), this.P(b.x0, b.y1, z0), this.P(b.x0, b.y0, z0 + H), this.P(b.x1, b.y0, z0 + H), this.P(b.x0, b.y1, z0 + H)];
      return bbox(pts, 20 * this.cam.zoom);
    }
    shadow() {}
    draw(ctx) {
      const k = this.house.cutK || 0;
      if (k <= 0) return;
      const s = this._spriteNow();
      ctx.globalAlpha = k * this.alpha;
      ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
      ctx.globalAlpha = 1;
    }
    paint(ctx) {
      const cam = this.cam;
      const b = this.b;
      const z0 = this.z0;
      const ink = this.ink;
      const T = 15;
      const H = b.h;
      const P = (x, y, z) => cam.p({ x, y, z });
      const paint = '#efe3c6';
      const tile = '#f2efe8';
      const band = '#3f6fa8';
      const tileH = 120;
      // reboco em cima, azulejo embaixo (quadrados de 15 cm) e a faixa azul entre os dois; `dark` = a parede de lado
      const face = (len, dark) => {
        ctx.fillStyle = dark ? M.shade(paint, -0.16) : paint;
        ctx.fillRect(0, 0, len, H - tileH);
        ctx.fillStyle = dark ? M.shade(tile, -0.16) : tile;
        ctx.fillRect(0, H - tileH, len, tileH);
        ctx.strokeStyle = dark ? 'rgba(120, 120, 128, 0.45)' : 'rgba(150, 150, 158, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let x = 15; x < len; x += 15) {
          ctx.moveTo(x, H - tileH);
          ctx.lineTo(x, H);
        }
        for (let y = H - tileH + 15; y < H; y += 15) {
          ctx.moveTo(0, y);
          ctx.lineTo(len, y);
        }
        ctx.stroke();
        ctx.fillStyle = dark ? M.shade(band, -0.16) : band;
        ctx.fillRect(0, H - tileH - 6, len, 8);
        // sujeira perto do chão
        ctx.fillStyle = 'rgba(80, 64, 44, 0.12)';
        ctx.fillRect(0, H - 14, len, 14);
      };
      const lenN = b.x1 - b.x0 - T;
      const lenW = b.y1 - b.y0 - T;
      // a parede da esquerda (por dentro, de frente para +x: mais escura) e a do fundo (de frente para +y)
      poly(ctx, [P(b.x0 + T, b.y1, z0), P(b.x0 + T, b.y0 + T, z0), P(b.x0 + T, b.y0 + T, z0 + H), P(b.x0 + T, b.y1, z0 + H)], null, INK, ink * 2.2);
      // as casas com morador (família, vó, a abandonada) têm as paredes delas (casas.js)
      const home = b.resident && PD.casas;
      onWall(ctx, cam, { x: b.x0 + T, y: b.y1, z: z0 + H }, { x: 0, y: -1 }, () => {
        if (home) return PD.casas.innerWall(ctx, b, 'oeste', lenW, H);
        face(lenW, true);
        // lousa de preços (sem marca, nada de tabaco) e um calendário
        const bx = lenW * 0.55, by = 46;
        ctx.fillStyle = '#6a4a2e';
        ctx.fillRect(bx - 6, by - 6, 112, 84);
        ctx.fillStyle = '#2d3a33';
        ctx.fillRect(bx, by, 100, 72);
        ctx.fillStyle = '#e9eee6';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('PREÇOS', bx + 8, by + 15);
        ctx.font = '600 8px system-ui, sans-serif';
        [['ÁGUA DE COCO', '5'], ['GARRAFADA', '12'], ['PÃO DE QUEIJO', '3'], ['AÇAÍ', '8']].forEach(([n, v], i) => {
          ctx.fillText(n, bx + 8, by + 30 + i * 11);
          ctx.fillText(v, bx + 86, by + 30 + i * 11);
        });
        ctx.fillStyle = '#f7f2e4';
        ctx.fillRect(lenW * 0.22, 40, 34, 44);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(lenW * 0.22, 40, 34, 10);
        ctx.strokeStyle = 'rgba(60, 60, 60, 0.5)';
        ctx.lineWidth = 1;
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) ctx.strokeRect(lenW * 0.22 + 3 + c * 7, 54 + r * 7, 6, 6);
      });
      poly(ctx, [P(b.x0 + T, b.y0 + T, z0), P(b.x1, b.y0 + T, z0), P(b.x1, b.y0 + T, z0 + H), P(b.x0 + T, b.y0 + T, z0 + H)], null, INK, ink * 2.2);
      onWall(ctx, cam, { x: b.x0 + T, y: b.y0 + T, z: z0 + H }, { x: 1, y: 0 }, () => {
        if (home) return PD.casas.innerWall(ctx, b, 'fundo', lenN, H);
        face(lenN, false);
        // relógio de parede
        const cx = lenN * 0.18, cy = 32;
        ctx.fillStyle = '#fbf8f0';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 17, 0, M.TAU);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - 11);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 8, cy + 3);
        ctx.stroke();
        // a placa de madeira: "FIADO SÓ AMANHÃ"
        const pw = 128, px = lenN * 0.6 - pw / 2;
        ctx.fillStyle = INK;
        ctx.fillRect(px - 3, 13, pw + 6, 38);
        ctx.fillStyle = '#c99a5b';
        ctx.fillRect(px, 16, pw, 32);
        ctx.fillStyle = '#3a2412';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FIADO SÓ AMANHÃ', px + pw / 2, 37);
      });
      // o fim das paredes (as pontas que dão para a frente e para a direita) e o topo delas (sem a laje)
      const end = M.shade(b.wall, -0.1);
      poly(ctx, [P(b.x0, b.y1, z0), P(b.x0 + T, b.y1, z0), P(b.x0 + T, b.y1, z0 + H), P(b.x0, b.y1, z0 + H)], end, INK, ink * 1.6);
      poly(ctx, [P(b.x1, b.y0, z0), P(b.x1, b.y0 + T, z0), P(b.x1, b.y0 + T, z0 + H), P(b.x1, b.y0, z0 + H)], M.shade(b.wall, -0.26), INK, ink * 1.6);
      const topC = '#ddd3c2';
      poly(ctx, [P(b.x0, b.y0, z0 + H), P(b.x1, b.y0, z0 + H), P(b.x1, b.y0 + T, z0 + H), P(b.x0 + T, b.y0 + T, z0 + H), P(b.x0 + T, b.y1, z0 + H), P(b.x0, b.y1, z0 + H)], topC, INK, ink * 1.6);
    }
  }

  /** Parede: bloco aparente (fiadas com a massa entre os blocos) ou reboco pintado com manchas de chuva. */
  function wallTexture(ctx, b, len, H, r, sideFace) {
    if (b.block) {
      ctx.strokeStyle = BLOCK.mortar;
      ctx.lineWidth = 3;
      for (let y = H, row = 0; y > 16; y -= 20, row++) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(len, y);
        ctx.stroke();
        for (let x = (row % 2) * 20; x < len; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - 20);
          ctx.stroke();
        }
      }
      // blocos um pouco diferentes uns dos outros
      ctx.fillStyle = sideFace ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
      for (let k = 0; k < len / 18; k++) ctx.fillRect(Math.floor(r() * len / 40) * 40 + 2, Math.floor(r() * H / 20) * 20 + 2, 36, 16);
      return;
    }
    // manchas de chuva escorrendo da laje e sujeira de rodapé
    ctx.fillStyle = b.abandoned ? 'rgba(40, 32, 24, 0.16)' : 'rgba(60, 50, 40, 0.08)';
    for (let i = 0; i < Math.max(3, len / 90); i++) ctx.fillRect(r() * len, 16, 14 + r() * 30, 40 + r() * (H * 0.55));
    ctx.fillStyle = 'rgba(70, 52, 36, 0.18)';
    ctx.fillRect(0, H - 26, len, 26);
  }
  /**
   * Porta aberta da casa que dá para entrar (o vão do mapa): o escuro de dentro com o chão aparecendo e a folha aberta
   * para dentro, de quina; na abandonada, arrombada (tábuas quebradas, uma pendurada por um prego).
   */
  function openDoor(ctx, x, y, w, h, b, r) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 7, y - 7, w + 14, h + 7);
    ctx.fillStyle = b.trim;
    ctx.fillRect(x - 4, y - 4, w + 8, h + 4);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#120e0b');
    g.addColorStop(0.75, '#2a211a');
    g.addColorStop(1, b.abandoned ? '#4a463f' : b.resident === 'vo' ? '#5e3e22' : '#6e6450');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    if (b.abandoned) {
      // arrombada: o que sobrou das tábuas (uma em cima, quebrada; uma pendurada; os tocos embaixo) e as farpas
      ctx.fillStyle = '#7a5f42';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      const board = (cx, cy, bw, a) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-bw / 2, -10);
        ctx.lineTo(bw / 2, -10);
        ctx.lineTo(bw / 2 - 6, -2);
        ctx.lineTo(bw / 2, 4);
        ctx.lineTo(bw / 2 - 3, 10);
        ctx.lineTo(-bw / 2, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };
      board(x + w * 0.32, y + 30, w * 0.6, 0.08);
      board(x + w * 0.22, y + 92, w * 0.5, 1.15);
      board(x + w * 0.78, y + h - 40, w * 0.4, -0.12);
      ctx.fillStyle = '#c9c4ba';
      ctx.fillRect(x + w * 0.04, y + 52, 4, 4);
      return;
    }
    // a folha da porta, aberta para dentro, encostada do lado da dobradiça (a madeira e a maçaneta)
    const lw = Math.min(30, w * 0.24);
    ctx.fillStyle = b.resident === 'vo' ? '#8a5a34' : '#7a5a3c';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + lw, y + 10);
    ctx.lineTo(x + lw, y + h - 8);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x + 3, y + 20, lw * 0.35, h - 40);
    ctx.fillStyle = '#d4b65a';
    ctx.beginPath();
    ctx.arc(x + lw - 6, y + h * 0.52, 3.5, 0, M.TAU);
    ctx.fill();
    // o capacho na soleira
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(x + w * 0.2, y + h - 6, w * 0.6, 6);
    void r;
  }
  /** Porta da casa: madeira ou portão de ferro com grade; na abandonada, tapada com tábuas. */
  function houseDoor(ctx, x, y, w, h, b, r) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 7, y - 7, w + 14, h + 7);
    ctx.fillStyle = b.trim;
    ctx.fillRect(x - 4, y - 4, w + 8, h + 4);
    if (b.abandoned) {
      ctx.fillStyle = '#1e1a17';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#7a5f42';
      for (let k = 0; k < 4; k++) {
        ctx.save();
        ctx.translate(x + w / 2, y + 40 + k * 48);
        ctx.rotate((r() - 0.5) * 0.35);
        ctx.fillRect(-w * 0.62, -11, w * 1.24, 22);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.strokeRect(-w * 0.62, -11, w * 1.24, 22);
        ctx.restore();
      }
      return;
    }
    const metal = r() < 0.5;
    ctx.fillStyle = metal ? '#56606a' : '#7a5a3c';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = metal ? '#3c444c' : '#5a4029';
    ctx.lineWidth = 4;
    if (metal) {
      for (let k = 1; k < 6; k++) {
        ctx.beginPath();
        ctx.moveTo(x + (w * k) / 6, y + 10);
        ctx.lineTo(x + (w * k) / 6, y + h * 0.45);
        ctx.stroke();
      }
      ctx.strokeRect(x + 8, y + h * 0.52, w - 16, h * 0.42);
    } else {
      ctx.strokeRect(x + 10, y + 12, w - 20, h * 0.4);
      ctx.strokeRect(x + 10, y + h * 0.5, w - 20, h * 0.42);
    }
    ctx.fillStyle = '#d8c27a';
    ctx.beginPath();
    ctx.arc(x + w - 16, y + h * 0.5, 6, 0, M.TAU);
    ctx.fill();
  }
  /** Janela de casa: grade na frente (como na periferia); na abandonada, vidro quebrado e escuro. */
  function houseWindow(ctx, x, y, w, h, b, r, sideFace) {
    if (!b.abandoned) {
      window_(ctx, x, y, w, h, b, r, sideFace);
      // grade de ferro por fora
      ctx.strokeStyle = '#2e3236';
      ctx.lineWidth = 4;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
      for (let k = 1; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(x + (w * k) / 5, y);
        ctx.lineTo(x + (w * k) / 5, y + h);
        ctx.stroke();
      }
      return;
    }
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.fillStyle = '#16191c';
    ctx.fillRect(x, y, w, h);
    // cacos de vidro nos cantos
    ctx.fillStyle = 'rgba(190, 210, 220, 0.55)';
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1]]) {
      if (r() < 0.3) continue;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + sx * w * (0.25 + r() * 0.3), cy);
      ctx.lineTo(cx + sx * w * 0.1, cy + sy * h * (0.2 + r() * 0.3));
      ctx.lineTo(cx, cy + sy * h * (0.3 + r() * 0.3));
      ctx.closePath();
      ctx.fill();
    }
  }
  /** Cipó subindo pela parede da casa abandonada. */
  function vines(ctx, len, H, r) {
    for (let k = 0; k < Math.max(2, len / 160); k++) {
      const x = r() * len;
      const top = H * (0.25 + r() * 0.5);
      ctx.strokeStyle = '#2f5a2c';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.bezierCurveTo(x + 30, H - top * 0.4, x - 30, H - top * 0.7, x + 10, H - top);
      ctx.stroke();
      for (let j = 0; j < 7; j++) {
        const u = r();
        ctx.fillStyle = r() < 0.5 ? '#3f7a3a' : '#2f5f2e';
        ctx.beginPath();
        ctx.ellipse(x + (r() - 0.5) * 50, H - top * u, 16 + r() * 10, 10 + r() * 6, r() * 3, 0, M.TAU);
        ctx.fill();
      }
    }
  }
  // ---- a casa tomada pela mata (planta da rua da Budega, 13/11)
  const LEAVES = ['#3f7a3a', '#2f5f2e', '#4f8a42', '#356b33'];
  /** Folhas em cacho (na parede, em cm): cada folha com contorno escuro. */
  function leafCluster(ctx, x, y, n, size, r) {
    for (let k = 0; k < n; k++) {
      const lx = x + (r() - 0.5) * size * 2.2, ly = y + (r() - 0.5) * size * 1.6;
      const a = r() * Math.PI;
      ctx.fillStyle = CANOPY_INK;
      ctx.beginPath();
      ctx.ellipse(lx, ly, size * 0.62 + 2, size * 0.36 + 2, a, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = LEAVES[Math.floor(r() * LEAVES.length)];
      ctx.beginPath();
      ctx.ellipse(lx, ly, size * 0.62, size * 0.36, a, 0, M.TAU);
      ctx.fill();
    }
  }
  /** Manchas de chuva escorrendo da laje e musgo no rodapé e na beirada. */
  function mossWall(ctx, len, H, r) {
    ctx.fillStyle = 'rgba(40, 46, 34, 0.15)';
    for (let i = 0; i < Math.max(3, len / 70); i++) {
      const x = r() * len, w = 10 + r() * 26, h = 60 + r() * H * 0.5;
      ctx.fillRect(x, 16, w, h);
      ctx.fillRect(x + w * 0.3, 16 + h, w * 0.4, 20 + r() * 40);
    }
    const MOSS = ['rgba(70, 104, 50, 0.6)', 'rgba(88, 122, 58, 0.55)', 'rgba(56, 86, 42, 0.6)'];
    for (let i = 0; i < len / 20; i++) {
      ctx.fillStyle = MOSS[Math.floor(r() * 3)];
      ctx.beginPath();
      ctx.ellipse(r() * len, H - r() * 36, 10 + r() * 24, 6 + r() * 12, 0, 0, M.TAU);
      ctx.fill();
    }
    for (let i = 0; i < len / 40; i++) {
      ctx.fillStyle = MOSS[Math.floor(r() * 3)];
      ctx.beginPath();
      ctx.ellipse(r() * len, 18 + r() * 22, 8 + r() * 18, 5 + r() * 9, 0, 0, M.TAU);
      ctx.fill();
    }
  }
  /** Cipó tomando a parede: cortinas caindo da laje e ramos subindo do chão; `amount` (0 a 1) = quanto cobre. */
  function overgrowth(ctx, len, H, r, amount, clear) {
    const a = Math.max(0, Math.min(1, amount));
    // `clear` = trecho [x0, x1] da parede que fica livre (a entrada e a placa do prédio)
    const pick = () => {
      let x = r() * len;
      if (clear && x > clear[0] && x < clear[1]) x = x < (clear[0] + clear[1]) / 2 ? clear[0] - 30 - r() * 60 : clear[1] + 30 + r() * 60;
      return x;
    };
    const stem = (pts) => {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = CANOPY_INK;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = '#3d6a32';
      ctx.lineWidth = 4;
      ctx.stroke();
    };
    // cortinas que caem da laje
    const nTop = Math.max(1, Math.round((len / 110) * a));
    for (let k = 0; k < nTop; k++) {
      const x = pick();
      const drop = H * (0.12 + r() * 0.6 * a);
      for (let j = 0; j < 2 + Math.floor(r() * 3); j++) {
        const x0 = x + (r() - 0.5) * 60;
        const pts = [];
        for (let t = 0; t <= 1.001; t += 0.125) pts.push([x0 + Math.sin(t * 5 + j) * 8, 10 + drop * t * (0.6 + r() * 0.4)]);
        stem(pts);
        for (const [px, py] of pts) if (r() < 0.8) leafCluster(ctx, px, py, 2, 13 + r() * 5, r);
      }
      leafCluster(ctx, x, 18, 8, 16, r);
    }
    // ramos subindo do chão
    const nBot = Math.max(1, Math.round((len / 150) * a));
    for (let k = 0; k < nBot; k++) {
      const x = pick();
      const top = H * (0.2 + r() * 0.55 * a);
      const pts = [];
      for (let t = 0; t <= 1.001; t += 0.125) pts.push([x + Math.sin(t * 4 + k) * 22, H - top * t]);
      stem(pts);
      for (const [px, py] of pts) leafCluster(ctx, px, py, 3, 14 + r() * 6, r);
    }
  }
  /** Portão de garagem de ferro: chapa com frisos, ferrugem escorrendo e o trinco. */
  function garageDoor(ctx, x, y, w, h, r) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 6);
    ctx.fillStyle = '#5b6168';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#454a50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let xx = x + 14; xx < x + w - 4; xx += 16) {
      ctx.moveTo(xx, y + 4);
      ctx.lineTo(xx, y + h);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(140, 82, 44, 0.45)';
    for (let k = 0; k < 6; k++) ctx.fillRect(x + r() * (w - 12), y + h * (0.2 + r() * 0.5), 6 + r() * 10, h * (0.15 + r() * 0.3));
    ctx.fillStyle = '#2e3236';
    ctx.fillRect(x + w * 0.48, y + h * 0.55, 10, 24);
  }
  /** Entrada do prédio do conjunto: porta de vidro com grade e a placa do bloco (o nome do prédio no mapa). */
  function towerEntrance(ctx, W, H, b) {
    const dw = 170, dh = 230;
    const dx = W / 2 - dw / 2, dy = H - dh;
    ctx.fillStyle = INK;
    ctx.fillRect(dx - 8, dy - 8, dw + 16, dh + 8);
    ctx.fillStyle = '#2b3036';
    ctx.fillRect(dx, dy, dw, dh);
    ctx.fillStyle = 'rgba(150, 178, 190, 0.35)';
    ctx.fillRect(dx + 10, dy + 10, dw / 2 - 15, dh - 20);
    ctx.fillRect(dx + dw / 2 + 5, dy + 10, dw / 2 - 15, dh - 20);
    ctx.strokeStyle = '#1b1e22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let k = 1; k < 6; k++) {
      ctx.moveTo(dx + (dw * k) / 6, dy + 8);
      ctx.lineTo(dx + (dw * k) / 6, dy + dh);
    }
    ctx.stroke();
    // marquise e a placa do bloco
    ctx.fillStyle = INK;
    ctx.fillRect(dx - 40, dy - 34, dw + 80, 26);
    ctx.fillStyle = '#8f897d';
    ctx.fillRect(dx - 36, dy - 30, dw + 72, 18);
    const label = (b.name || '').toUpperCase();
    if (label) {
      ctx.font = `700 34px ${FONT_SIGN}`;
      const tw = ctx.measureText(label).width + 40;
      ctx.fillStyle = INK;
      ctx.fillRect(W / 2 - tw / 2 - 4, dy - 96, tw + 8, 56);
      ctx.fillStyle = '#e8e2d2';
      ctx.fillRect(W / 2 - tw / 2, dy - 92, tw, 48);
      ctx.fillStyle = '#2f3a46';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, W / 2, dy - 67);
    }
  }
  /** Árvore pequena nascida na laje (raiz no chão da laje, copa de tufos como as da mata). */
  function roofTree(ctx, cam, x, y, z, ink) {
    const t = { x, y, kind: 'mata', r: 125, h: 380, trunk: 7 };
    const fork = { x, y, z: z + t.h * FORK };
    const b0 = cam.p({ x, y, z }), b1 = cam.p(fork);
    const w0 = 9 * cam.zoom, w1 = 5 * cam.zoom;
    const shape = [{ x: b0.x - w0, y: b0.y }, { x: b1.x - w1, y: b1.y }, { x: b1.x + w1, y: b1.y }, { x: b0.x + w0, y: b0.y }];
    poly(ctx, shape, null, INK, ink * 2.2);
    poly(ctx, shape, '#5a4532');
    // raízes agarradas na beirada da laje
    ctx.strokeStyle = '#4a3726';
    ctx.lineWidth = Math.max(1, 3 * cam.zoom);
    for (const [dx, dy] of [[-30, 10], [25, 18], [8, -26]]) {
      const q = cam.p({ x: x + dx, y: y + dy, z });
      ctx.beginPath();
      ctx.moveTo(b0.x, b0.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    crownPaint(ctx, cam, t, z, ink, CANOPY.mata, false);
  }
  /**
   * Árvore que nasceu dentro da casa abandonada (pedido do dono, 13/11: "a árvore deveria sair de dentro da casa, não do
   * telhado"): o tronco sobe lá de dentro e passa por um buraco na laje, de borda quebrada, com uns ferros tortos; nada
   * de raiz nem de placa solta em cima da laje. Desenho: o buraco escuro, a parede de dentro da borda do fundo, o tronco
   * saindo da escuridão (mais escuro embaixo), a borda da frente por cima dele (é ela que mostra que o tronco atravessa)
   * e a copa. Os galhos que saem pela porta e pelas janelas ficam na fachada (treeOpenings).
   */
  function treeThroughRoof(ctx, cam, b, x, y, z, ink) {
    const r = M.rng(Math.round(b.x0 * 3 + b.y0 * 7) + 41);
    const P = (px, py, pz) => cam.p({ x: px, y: py, z: pz });
    const slab = 16; // espessura da laje
    // contorno do buraco (irregular, um pouco maior que o tronco)
    const N = 16;
    const rim = [];
    const inner = b.innerTree;
    const hole = inner ? Math.max(52, (inner.trunk || 30) * 1.5 + 18) : 52;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * M.TAU;
      const rr = hole + r() * 24;
      rim.push({ a, x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.92 });
    }
    // a câmera olha de +x+y: a metade "do fundo" é a de menor x+y
    const far = (q) => q.x + q.y < x + y;
    // 1) o buraco escuro e a parede de dentro da borda do fundo (o corte da laje, mais claro)
    poly(ctx, rim.map((q) => P(q.x, q.y, z)), '#14110e', INK, ink * 1.6);
    for (let i = 0; i < N; i++) {
      const a = rim[i], c = rim[(i + 1) % N];
      if (!far(a) && !far(c)) continue;
      poly(ctx, [P(a.x, a.y, z), P(c.x, c.y, z), P(c.x, c.y, z - slab), P(a.x, a.y, z - slab)], '#6f6a60');
    }
    // 2) o tronco, saindo lá de baixo: o pedaço abaixo da laje só aparece dentro do buraco (recortado pelo contorno
    // dele) e é escuro, como na sombra de dentro da casa; acima da laje, a casca de sempre
    const t = { x, y, kind: 'mata', r: 250, h: 560, trunk: 16 };
    const fork = { x, y, z: z + t.h * FORK };
    const b1 = cam.p(fork);
    const w0 = (inner ? (inner.trunk || 30) * 1.05 : 27) * cam.zoom, w1 = 14 * cam.zoom;
    const trunkShape = (za) => {
      const b0 = P(x, y, za);
      return [{ x: b0.x - w0, y: b0.y }, { x: b1.x - w1, y: b1.y }, { x: b1.x + w1, y: b1.y }, { x: b0.x + w0, y: b0.y }];
    };
    const holePath = new Path2D();
    rim.forEach((q, i) => {
      const pt = P(q.x, q.y, z);
      if (i) holePath.lineTo(pt.x, pt.y);
      else holePath.moveTo(pt.x, pt.y);
    });
    holePath.closePath();
    ctx.save();
    ctx.clip(holePath);
    poly(ctx, trunkShape(z - 90), '#1d1712', INK, ink * 2.4);
    ctx.restore();
    if (inner) {
      // a árvore de verdade: a forquilha dela fica na altura da laje; os galhos e a copa são os dela (TreeCanopy),
      // desenhados por cima da casa. Aqui só o toco do tronco saindo do buraco, até onde os galhos começam
      const top = P(x, y, z + 26);
      const base = P(x, y, z);
      const ww = w0 * 0.92;
      const stub = [{ x: base.x - ww, y: base.y }, { x: top.x - ww * 0.86, y: top.y }, { x: top.x + ww * 0.86, y: top.y }, { x: base.x + ww, y: base.y }];
      poly(ctx, stub, BARK.mata ? BARK.mata[0] : '#6b4a30', INK, ink * 2.2);
      poly(ctx, [stub[0], stub[1], { x: top.x - ww * 0.3, y: top.y }, { x: base.x - ww * 0.35, y: base.y }], 'rgba(255, 240, 210, 0.16)');
    }
    const shape = trunkShape(z);
    const base = shape[0].y;
    // a parte de fora: cobre só do nível da laje para cima (o pé fica escondido atrás da borda da frente); com a árvore
    // de verdade, quem desenha o tronco e os galhos é ela
    if (!inner) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(b1.x - 400, b1.y - 400, 800, base - (b1.y - 400) + 1);
      ctx.clip();
      poly(ctx, shape, null, INK, ink * 2.4);
      const g = ctx.createLinearGradient(0, base, 0, b1.y);
      g.addColorStop(0, '#2a2017');
      g.addColorStop(0.18, BARK.figueira[1]);
      g.addColorStop(0.45, BARK.figueira[0]);
      g.addColorStop(1, BARK.figueira[0]);
      poly(ctx, shape, g);
      ctx.strokeStyle = 'rgba(40, 30, 20, 0.5)';
      ctx.lineWidth = Math.max(1, 2 * cam.zoom);
      for (let k = 0; k < 3; k++) {
        const f = (k + 1) / 4;
        ctx.beginPath();
        ctx.moveTo(shape[0].x + 2 * w0 * f, shape[0].y);
        ctx.lineTo(b1.x - w1 + 2 * w1 * f, b1.y);
        ctx.stroke();
      }
      ctx.restore();
    }
    // 3) a borda da frente do buraco, quebrada, por cima do pé do tronco: uma beirada de concreto com a quina lascada
    const idx = rim.map((q, i) => (!far(q) ? i : -1)).filter((i) => i >= 0);
    const run = [];
    if (idx.length >= 2) {
      // a metade da frente, em ordem: começa no primeiro ponto da frente que vem depois de um do fundo
      let startI = idx[0];
      for (const i of idx) if (far(rim[(i - 1 + N) % N])) startI = i;
      for (let k = 0; k < N; k++) {
        const q = rim[(startI + k) % N];
        if (far(q)) break;
        run.push(q);
      }
    }
    if (run.length >= 2) {
      const outer = run.map((q) => P(x + (q.x - x) * 1.16, y + (q.y - y) * 1.16, z));
      const inner = run.map((q) => P(q.x, q.y, z));
      poly(ctx, [...outer, ...inner.reverse()], '#a59f93');
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 1.6;
      ctx.beginPath();
      run.forEach((q, i) => {
        const pt = P(q.x, q.y, z);
        if (i) ctx.lineTo(pt.x, pt.y);
        else ctx.moveTo(pt.x, pt.y);
      });
      ctx.stroke();
    }
    // 4) três ferros da laje, tortos, na beirada do buraco
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const q = rim[Math.floor(r() * N)];
      const p0 = P(q.x, q.y, z - 4);
      const p1 = P(x + (q.x - x) * 0.72, y + (q.y - y) * 0.72, z + 14 + r() * 20);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.6, 3.2 * cam.zoom);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.strokeStyle = '#8a4a2a';
      ctx.lineWidth = Math.max(1, 1.7 * cam.zoom);
      ctx.stroke();
    }
    // 5) a copa (a árvore de verdade do mapa desenha a dela)
    if (!inner) crownPaint(ctx, cam, t, z, ink, CANOPY.mata, false);
  }
  /**
   * A árvore lá dentro aparece pelas aberturas (em cm da parede): pela porta de tábuas saem folhas pelas frestas e um
   * galho pela quina de cima; pelas janelas, galhos com cachos de folha passando da moldura. E duas trincas finas
   * descendo da beirada da laje, perto de onde o tronco rompeu (`trunkAt` = onde o tronco fica ao longo da parede).
   */
  function treeOpenings(ctx, openings, len, H, r, trunkAt) {
    const BRANCH = BARK.figueira[0];
    const branch = (x0, y0, x1, y1, w) => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = w + 5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 20, (y0 + y1) / 2 - 12, x1, y1);
      ctx.stroke();
      ctx.strokeStyle = BRANCH;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    for (const o of openings) {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      if (o.door) {
        // pela porta: folhas nas frestas entre as tábuas e um galho saindo pela quina de cima
        for (let k = 0; k < 4; k++) leafCluster(ctx, o.x + o.w * (0.2 + r() * 0.6), o.y + 64 + k * 48, 2, 13, r);
        branch(o.x + o.w * 0.75, o.y + 26, o.x + o.w + 42, o.y - 26, 9);
        leafCluster(ctx, o.x + o.w + 46, o.y - 30, 6, 17, r);
        continue;
      }
      // pela janela: dois galhos saindo e as folhas transbordando da moldura
      const side = cx < trunkAt ? -1 : 1;
      branch(cx - side * 10, cy + 6, cx + side * (o.w * 0.75), o.y - 18, 10);
      branch(cx, cy + 10, cx - side * (o.w * 0.35), o.y + o.h + 22, 7);
      leafCluster(ctx, cx + side * (o.w * 0.78), o.y - 22, 7, 18, r);
      leafCluster(ctx, cx - side * (o.w * 0.36), o.y + o.h + 24, 5, 15, r);
      leafCluster(ctx, cx, cy, 6, 16, r);
    }
    // trincas finas descendo da laje, perto do tronco
    ctx.strokeStyle = 'rgba(52, 46, 40, 0.65)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      let x = Math.max(20, Math.min(len - 20, trunkAt + (k ? 70 : -60) + (r() - 0.5) * 40));
      let y = 14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += (r() - 0.5) * 26;
        y += 22 + r() * 22;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  /** Varal na laje: dois postinhos, o fio caindo um pouco e as roupas penduradas (viradas para a frente). */
  function clothesLine(ctx, cam, b, z, ink) {
    const W = b.x1 - b.x0, D = b.y1 - b.y0;
    const y = b.y0 + D * 0.7;
    const xa = b.x0 + W * 0.12, xb = Math.min(b.x1 - W * 0.12, xa + 420);
    const L = xb - xa;
    for (const x of [xa, xb]) {
      const p0 = cam.p({ x, y, z }), p1 = cam.p({ x, y, z: z + 165 });
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4 * cam.zoom + ink * 2;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.strokeStyle = '#8a8f96';
      ctx.lineWidth = 4 * cam.zoom;
      ctx.stroke();
    }
    onWall(ctx, cam, { x: xa, y, z: z + 160 }, { x: 1, y: 0 }, () => {
      const sag = (a) => Math.sin((Math.PI * a) / L) * 14;
      ctx.strokeStyle = '#2a2a2e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let a = 0; a <= L; a += 10) (a ? ctx.lineTo(a, sag(a)) : ctx.moveTo(a, sag(a)));
      ctx.stroke();
      const COL = ['#e8452c', '#2f6fd0', '#f4c21c', '#f2efe6', '#e86a9a', '#3f9a4a', '#7d3fa8'];
      const r = M.rng(Math.round(b.x0 * 5 + b.y0));
      for (let a = 26; a < L - 30; a += 52 + r() * 18) {
        const top = sag(a) + 1;
        const c = COL[Math.floor(r() * COL.length)];
        const kind = r();
        ctx.fillStyle = c;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (kind < 0.4) {
          // camiseta
          ctx.moveTo(a - 22, top);
          ctx.lineTo(a + 22, top);
          ctx.lineTo(a + 30, top + 14);
          ctx.lineTo(a + 18, top + 18);
          ctx.lineTo(a + 18, top + 52);
          ctx.lineTo(a - 18, top + 52);
          ctx.lineTo(a - 18, top + 18);
          ctx.lineTo(a - 30, top + 14);
        } else if (kind < 0.7) {
          // toalha
          ctx.rect(a - 18, top, 36, 58);
        } else {
          // bermuda
          ctx.moveTo(a - 18, top);
          ctx.lineTo(a + 18, top);
          ctx.lineTo(a + 20, top + 44);
          ctx.lineTo(a + 3, top + 44);
          ctx.lineTo(a, top + 18);
          ctx.lineTo(a - 3, top + 44);
          ctx.lineTo(a - 20, top + 44);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        // prendedores
        ctx.fillStyle = '#d8d2c2';
        ctx.fillRect(a - 12, top - 3, 4, 7);
        ctx.fillRect(a + 8, top - 3, 4, 7);
      }
    });
  }
  /** O que fica na laje, do fundo para a frente: caixa d'água, plantas, árvore e varal. */
  function roofItems(ctx, cam, b, z, ink) {
    const W = b.x1 - b.x0, D = b.y1 - b.y0;
    const items = [];
    const tx = b.x0 + W * 0.68, ty = b.y0 + D * 0.35;
    if (b.tank && !b.abandoned) items.push({ k: tx + ty, draw: () => tank(ctx, cam, tx, ty, z, ink) });
    if (b.tower && b.tank && W > 500) items.push({ k: b.x0 + W * 0.3 + ty, draw: () => tank(ctx, cam, b.x0 + W * 0.3, ty, z, ink) });
    if (b.roofTree) {
      const rx = b.x0 + W * 0.28, ry = b.y0 + D * 0.42;
      items.push({ k: rx + ry, draw: () => roofTree(ctx, cam, rx, ry, z, ink) });
    }
    // a árvore nasceu dentro da casa e rompeu a laje (etapa 4c, a casa abandonada do terreno do fundo); com a árvore
    // de verdade do mapa (`innerTree`), o buraco fica em volta dela
    const holeX = b.innerTree ? b.innerTree.x : b.x0 + W * 0.48, holeY = b.innerTree ? b.innerTree.y : b.y0 + D * 0.5;
    if (b.treeInside) items.push({ k: holeX + holeY, draw: () => treeThroughRoof(ctx, cam, b, holeX, holeY, z, ink) });
    if (b.plants && PD.flora) {
      const r = M.rng(Math.round(b.x0 * 7 + b.y0 * 3));
      for (let k = 0; k < 6 + Math.floor(r() * 3); k++) {
        const x = b.x0 + W * (0.08 + r() * 0.84), y = b.y0 + D * (0.1 + r() * 0.8);
        if (Math.hypot(x - tx, y - ty) < 100) continue;
        // a árvore que sai de dentro: a laje em volta do buraco fica limpa (senão parecia árvore plantada no telhado)
        if (b.treeInside && Math.hypot(x - holeX, y - holeY) < 170) continue;
        const kind = r() < 0.55 ? 'planta-samambaia' : 'arbusto';
        const d = { kind, x, y, r: kind === 'arbusto' ? 38 + r() * 18 : 34 + r() * 18, wild: true };
        const fl = PD.flora.small[kind];
        if (fl) items.push({ k: x + y, draw: () => fl.paint(ctx, cam, d, z, ink) });
      }
    }
    if (b.clothes) items.push({ k: b.x0 + W * 0.3 + b.y0 + D * 0.7, draw: () => clothesLine(ctx, cam, b, z, ink) });
    items.sort((p, q) => p.k - q.k);
    for (const it of items) it.draw();
  }
  /** Vendinha: porta de enrolar meio aberta, prateleiras acesas lá dentro (garrafas, latas, caixas, frutas) e o letreiro. */
  function vendinha(ctx, b, W, H, r) {
    const s = b.shop;
    const ox = 34, ow = W - 68;
    const oh = Math.min(200, H - 70);
    const oy = H - oh;
    ctx.fillStyle = INK;
    ctx.fillRect(ox - 7, oy - 7, ow + 14, oh + 7);
    ctx.fillStyle = '#f3d79a';
    ctx.fillRect(ox, oy, ow, oh);
    // prateleiras com mercadoria (sem cigarro/tabaco)
    const goods = ['#d6402f', '#2f73c4', '#f1c84a', '#3f9a4a', '#e8e2d0', '#a0522d', '#7d3fa8'];
    for (let sh = 0; sh < 3; sh++) {
      const sy = oy + oh * (0.42 + sh * 0.19);
      ctx.fillStyle = '#8a6a45';
      ctx.fillRect(ox + 6, sy, ow - 12, 6);
      for (let x = ox + 12; x < ox + ow - 20; x += 16 + r() * 8) {
        const gh = 18 + r() * 22;
        ctx.fillStyle = goods[Math.floor(r() * goods.length)];
        ctx.fillRect(x, sy - gh, 11 + r() * 6, gh);
      }
    }
    // a porta de aço enrolada até a metade (na que dá para entrar, quase toda aberta: dá para passar)
    const shut = oh * (b.interior ? 0.12 : 0.36);
    ctx.fillStyle = '#9da1a6';
    ctx.fillRect(ox, oy, ow, shut);
    ctx.strokeStyle = '#7e8287';
    ctx.lineWidth = 3;
    for (let y = oy + 10; y < oy + shut; y += 12) {
      ctx.beginPath();
      ctx.moveTo(ox, y);
      ctx.lineTo(ox + ow, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#6d7175';
    ctx.fillRect(ox, oy + shut - 8, ow, 8);
    // balcão na entrada (na que dá para entrar, o balcão de verdade fica lá dentro)
    if (b.interior) {
      if (s.sign && !b.logo) sign(ctx, 22, 8, W - 44, Math.min(46, oy - 22), s.sign, '#7a2e22', '#fff4dc');
      return;
    }
    ctx.fillStyle = INK;
    ctx.fillRect(ox + ow * 0.55 - 4, H - 92, ow * 0.45 + 4, 92);
    ctx.fillStyle = '#b5523a';
    ctx.fillRect(ox + ow * 0.55, H - 88, ow * 0.45, 88);
    ctx.fillStyle = '#d97a5a';
    ctx.fillRect(ox + ow * 0.55, H - 88, ow * 0.45, 12);
    // letreiro pintado na parede, em cima da porta (quem tem logo ganha a placa em cima da laje no lugar dele)
    if (s.sign && !b.logo) sign(ctx, 22, 8, W - 44, Math.min(46, oy - 22), s.sign, '#7a2e22', '#fff4dc');
  }
  /** A placa com o escudo da Budega, em pé na beirada da laje, presa por dois ferros (na frente do que está na laje). */
  function logoBoard(ctx, b, W) {
    if (b.logo !== 'budega') return;
    const lw = Math.min(124, W * 0.36);
    ctx.fillStyle = INK;
    for (const px of [W / 2 - lw * 0.3, W / 2 + lw * 0.3]) ctx.fillRect(px - 4, -20, 8, 34);
    budegaLogo(ctx, W / 2, -lw * 1.02 + 4, lw);
  }
  /**
   * Logo da Budega (o escudo dourado do dono): "BUDEGA" e "DISTRIBUIDORA" numa faixa mais larga que o escudo, os
   * arabescos em cima e o círculo embaixo. Sem a palavra "tabacaria" e sem o narguilé do original (nada de tabaco no
   * desenho): no círculo vai a flor de hibisco, a mesma do cabelo da Xiovanna. Desenhado no plano em que estiver (cm, y
   * para baixo), com o meio em `cx`, o topo em `top` e a largura `w` (a altura é 1,06 × w).
   */
  function budegaLogo(ctx, cx, top, w) {
    const X = (x) => cx + x * w;
    const Y = (y) => top + y * w;
    const gold = ctx.createLinearGradient(X(-0.5), Y(0), X(0.5), Y(1));
    gold.addColorStop(0, '#d18e2c');
    gold.addColorStop(0.32, '#f7e08c');
    gold.addColorStop(0.55, '#e3a840');
    gold.addColorStop(0.8, '#f6d77e');
    gold.addColorStop(1, '#d69a38');
    const CREAM = '#fff8e8';
    const shield = (k) => {
      // k < 1: o mesmo escudo encolhido para dentro (o filete de dentro)
      const sx = (x) => X(x * k);
      const sy = (y) => Y(0.53 + (y - 0.53) * k);
      const p = new Path2D();
      p.moveTo(sx(-0.36), sy(0));
      p.lineTo(sx(0.36), sy(0));
      p.lineTo(sx(0.47), sy(0.09));
      p.lineTo(sx(0.43), sy(0.62));
      p.quadraticCurveTo(sx(0.37), sy(0.86), sx(0), sy(1.06));
      p.quadraticCurveTo(sx(-0.37), sy(0.86), sx(-0.43), sy(0.62));
      p.lineTo(sx(-0.47), sy(0.09));
      p.closePath();
      return p;
    };
    ctx.save();
    ctx.lineJoin = 'round';
    const outer = shield(1);
    ctx.lineWidth = w * 0.06;
    ctx.strokeStyle = INK;
    ctx.stroke(outer);
    ctx.fillStyle = gold;
    ctx.fill(outer);
    ctx.fillStyle = CREAM;
    ctx.fill(shield(0.9));
    ctx.lineWidth = w * 0.012;
    ctx.strokeStyle = gold;
    ctx.stroke(shield(0.84));
    // arabescos em cima: dois cachos dourados e o filete
    ctx.strokeStyle = gold;
    ctx.lineWidth = w * 0.022;
    ctx.lineCap = 'round';
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(X(sg * 0.04), Y(0.17));
      ctx.bezierCurveTo(X(sg * 0.16), Y(0.07), X(sg * 0.3), Y(0.14), X(sg * 0.25), Y(0.2));
      ctx.bezierCurveTo(X(sg * 0.21), Y(0.24), X(sg * 0.15), Y(0.2), X(sg * 0.19), Y(0.17));
      ctx.stroke();
    }
    ctx.lineWidth = w * 0.01;
    ctx.beginPath();
    ctx.moveTo(X(-0.22), Y(0.255));
    ctx.lineTo(X(0.22), Y(0.255));
    ctx.stroke();
    // a faixa do nome, mais larga que o escudo
    const band = new Path2D();
    band.roundRect(X(-0.53), Y(0.3), w * 1.06, w * 0.31, w * 0.05);
    ctx.lineWidth = w * 0.05;
    ctx.strokeStyle = INK;
    ctx.stroke(band);
    ctx.fillStyle = gold;
    ctx.fill(band);
    const bandIn = new Path2D();
    bandIn.roundRect(X(-0.495), Y(0.325), w * 0.99, w * 0.26, w * 0.035);
    ctx.fillStyle = CREAM;
    ctx.fill(bandIn);
    // o nome: dourado com contorno marrom, para ler de longe
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.font = `bold ${w * 0.17}px Georgia, "Times New Roman", serif`;
    ctx.lineWidth = w * 0.02;
    ctx.strokeStyle = '#6b4416';
    ctx.strokeText('BUDEGA', X(0), Y(0.49));
    ctx.fillStyle = gold;
    ctx.fillText('BUDEGA', X(0), Y(0.49));
    ctx.font = `bold ${w * 0.062}px Georgia, "Times New Roman", serif`;
    ctx.lineWidth = w * 0.01;
    ctx.strokeText('DISTRIBUIDORA', X(0), Y(0.565));
    ctx.fillText('DISTRIBUIDORA', X(0), Y(0.565));
    // filete e o círculo com a flor de hibisco
    ctx.strokeStyle = gold;
    ctx.lineWidth = w * 0.01;
    ctx.beginPath();
    ctx.moveTo(X(-0.2), Y(0.655));
    ctx.lineTo(X(0.2), Y(0.655));
    ctx.stroke();
    const cy = Y(0.81);
    const cr = w * 0.125;
    ctx.lineWidth = w * 0.022;
    ctx.beginPath();
    ctx.arc(X(0), cy, cr, 0, M.TAU);
    ctx.stroke();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * M.TAU - Math.PI / 2;
      ctx.fillStyle = '#c8323a';
      ctx.beginPath();
      ctx.ellipse(X(0) + Math.cos(a) * cr * 0.42, cy + Math.sin(a) * cr * 0.42, cr * 0.36, cr * 0.26, a, 0, M.TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f2c84b';
    ctx.beginPath();
    ctx.arc(X(0), cy, cr * 0.16, 0, M.TAU);
    ctx.fill();
    ctx.restore();
  }
  /** Toldo listrado da vendinha: sai da parede logo acima da porta, abaixo do letreiro. */
  function houseAwning(ctx, cam, b, z0, ink) {
    const P = (x, y, z) => cam.p({ x, y, z });
    const xa = b.x0 + 26;
    const xb = b.x1 - 26;
    const zTop = z0 + Math.min(b.h - 52, 206);
    const zLow = zTop - 40;
    const out = 105;
    const [c1, c2] = b.shop.awning;
    const n = Math.max(4, Math.round((xb - xa) / 50));
    const outline = [P(xa, b.y1, zTop), P(xb, b.y1, zTop), P(xb, b.y1 + out, zLow), P(xb, b.y1 + out, zLow - 26), P(xa, b.y1 + out, zLow - 26), P(xa, b.y1 + out, zLow)];
    poly(ctx, outline, null, INK, ink * 2.4);
    for (let k = 0; k < n; k++) {
      const a0 = xa + ((xb - xa) * k) / n;
      const a1 = xa + ((xb - xa) * (k + 1)) / n;
      poly(ctx, [P(a0, b.y1, zTop), P(a1, b.y1, zTop), P(a1, b.y1 + out, zLow), P(a0, b.y1 + out, zLow)], k % 2 ? c2 : c1);
      const p0 = P(a0, b.y1 + out, zLow), p1 = P(a1, b.y1 + out, zLow), p2 = P(a1, b.y1 + out, zLow - 20), p3 = P((a0 + a1) / 2, b.y1 + out, zLow - 30), p4 = P(a0, b.y1 + out, zLow - 20);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.quadraticCurveTo(p3.x, p3.y, p4.x, p4.y);
      ctx.closePath();
      ctx.fillStyle = k % 2 ? c2 : c1;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 0.7;
      ctx.stroke();
    }
  }

  function bbox(pts, pad = 0) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }

  function window_(ctx, x, y, w, h, b, r, sideFace) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.fillStyle = b.trim;
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    const lit = r() < 0.25;
    ctx.fillStyle = lit ? '#f3d38a' : sideFace ? '#4f6475' : '#6d8aa0';
    ctx.fillRect(x, y, w, h);
    // reflexo do céu (diagonal clara)
    if (!lit) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.15, y + h);
      ctx.lineTo(x + w * 0.55, y);
      ctx.lineTo(x + w * 0.8, y);
      ctx.lineTo(x + w * 0.4, y + h);
      ctx.fill();
    }
    // cortina ou grade
    const kind = r();
    if (kind < 0.3) {
      ctx.fillStyle = ['#e7b8a6', '#c9d9b8', '#e8dcae'][Math.floor(r() * 3)];
      ctx.fillRect(x, y, w * 0.35, h);
      ctx.fillRect(x + w * 0.65, y, w * 0.35, h);
    } else if (kind < 0.6) {
      ctx.strokeStyle = '#2a2a30';
      ctx.lineWidth = 5;
      for (let k = 1; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(x + (w * k) / 5, y);
        ctx.lineTo(x + (w * k) / 5, y + h);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.stroke();
    // peitoril
    ctx.fillStyle = M.shade(b.trim, -0.12);
    ctx.fillRect(x - 10, y + h + 4, w + 20, 12);
  }
  function balcony(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y, w, 14);
    ctx.strokeStyle = '#2b2b31';
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y - 70, w, 70);
    for (let k = 1; k < 7; k++) {
      ctx.beginPath();
      ctx.moveTo(x + (w * k) / 7, y - 70);
      ctx.lineTo(x + (w * k) / 7, y);
      ctx.stroke();
    }
  }
  function acBox(ctx, x, y) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 4, y - 4, 78, 54);
    ctx.fillStyle = '#d9d8d2';
    ctx.fillRect(x, y, 70, 46);
    ctx.strokeStyle = '#8f8e88';
    ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 8 + k * 8);
      ctx.lineTo(x + 40, y + 8 + k * 8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x + 54, y + 23, 12, 0, M.TAU);
    ctx.stroke();
  }
  function pixo(ctx, W, y, r, alpha = 1) {
    ctx.globalAlpha = 0.82 * alpha;
    ctx.strokeStyle = '#111014';
    ctx.lineWidth = 9;
    ctx.lineCap = 'square';
    let x = 30 + r() * 40;
    while (x < W - 90) {
      const h = 70 + r() * 50;
      const kind = r();
      ctx.beginPath();
      if (kind < 0.35) {
        ctx.moveTo(x, y + h);
        ctx.lineTo(x, y);
        ctx.lineTo(x + 22, y + 18);
        ctx.lineTo(x + 22, y + h);
      } else if (kind < 0.65) {
        ctx.moveTo(x, y + h);
        ctx.lineTo(x + 12, y);
        ctx.lineTo(x + 24, y + h);
        ctx.moveTo(x + 5, y + h * 0.6);
        ctx.lineTo(x + 20, y + h * 0.6);
      } else {
        ctx.moveTo(x + 22, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + 22, y + h);
        ctx.moveTo(x, y + h * 0.5);
        ctx.lineTo(x + 16, y + h * 0.5);
      }
      ctx.stroke();
      x += 38 + r() * 10;
      if (r() < 0.12) x += 50;
    }
    ctx.globalAlpha = 1;
  }
  function sign(ctx, x, y, w, h, text, bg, fg) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, w, h * 0.35);
    ctx.fillStyle = fg;
    ctx.font = `${Math.round(h * 0.78)}px ${FONT_SIGN}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.strokeText(text, x + w / 2, y + h * 0.56);
    ctx.fillText(text, x + w / 2, y + h * 0.56);
  }
  function shopFront(ctx, b, W, y, H) {
    const s = b.shop || {};
    // base do térreo um pouco mais escura
    ctx.fillStyle = M.shade(b.wall, -0.08);
    ctx.fillRect(0, y, W, H);
    const signH = 78;
    if (s.sign) sign(ctx, 40, y + 14, W - 80, signH, s.sign, s.awning ? s.awning[0] : '#444', '#fff8e6');
    const oy = y + 120;
    const oh = H - 120;
    if (s.type === 'bar' || s.type === 'lanches') {
      // porta de aço de enrolar, meio aberta
      const ox = 50;
      const ow = W - 100;
      ctx.fillStyle = INK;
      ctx.fillRect(ox - 6, oy - 6, ow + 12, oh + 6);
      ctx.fillStyle = '#3b2f2a';
      ctx.fillRect(ox, oy, ow, oh);
      ctx.fillStyle = '#f1c86a';
      ctx.globalAlpha = 0.35;
      ctx.fillRect(ox, oy + oh * 0.45, ow, oh * 0.55);
      ctx.globalAlpha = 1;
      const shut = oh * 0.42;
      ctx.fillStyle = '#9da1a6';
      ctx.fillRect(ox, oy, ow, shut);
      ctx.strokeStyle = '#6f7378';
      ctx.lineWidth = 4;
      for (let yy = oy + 10; yy < oy + shut; yy += 14) {
        ctx.beginPath();
        ctx.moveTo(ox, yy);
        ctx.lineTo(ox + ow, yy);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ox, oy + shut);
      ctx.lineTo(ox + ow, oy + shut);
      ctx.stroke();
      // balcão e garrafas lá dentro
      ctx.fillStyle = '#6b3f2a';
      ctx.fillRect(ox + 20, oy + oh - 80, ow - 40, 80);
      const r = M.rng(b.x0);
      for (let k = 0; k < 9; k++) {
        ctx.fillStyle = ['#3d7a4a', '#7a4a2a', '#c9a64a'][k % 3];
        ctx.fillRect(ox + 40 + k * ((ow - 80) / 9), oy + shut + 18 + r() * 8, 14, 40);
      }
    } else if (s.type === 'portaria') {
      // portão de prédio com interfone
      ctx.fillStyle = INK;
      ctx.fillRect(W / 2 - 96, oy - 6, 192, oh + 6);
      ctx.fillStyle = '#2f3438';
      ctx.fillRect(W / 2 - 90, oy, 180, oh);
      ctx.strokeStyle = '#6c757c';
      ctx.lineWidth = 6;
      for (let k = 1; k < 9; k++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 - 90 + k * 20, oy);
        ctx.lineTo(W / 2 - 90 + k * 20, oy + oh);
        ctx.stroke();
      }
      ctx.fillStyle = '#e8e2d2';
      ctx.fillRect(W / 2 + 110, oy + 60, 40, 60);
      // número
      ctx.fillStyle = INK;
      ctx.font = `60px ${FONT_SIGN}`;
      ctx.textAlign = 'center';
      ctx.fillText('1340', W / 2, oy - 24);
    } else {
      // vitrine de vidro com porta
      ctx.fillStyle = INK;
      ctx.fillRect(34, oy - 6, W - 68, oh + 6);
      ctx.fillStyle = '#89a8b8';
      ctx.fillRect(40, oy, W - 80, oh);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(60 + k * (W / 3), oy + oh);
        ctx.lineTo(140 + k * (W / 3), oy);
        ctx.lineTo(180 + k * (W / 3), oy);
        ctx.lineTo(100 + k * (W / 3), oy + oh);
        ctx.fill();
      }
      // prateleiras (pães, frutas)
      const r = M.rng(b.x0 + 2);
      const colors = s.type === 'padaria' ? ['#d99a4e', '#b8743a', '#f0c27a'] : ['#e04a3a', '#f2b632', '#6fae3f', '#f07a2a'];
      for (let row = 0; row < 3; row++) {
        ctx.fillStyle = '#7d5a3c';
        ctx.fillRect(50, oy + 40 + row * 50, W * 0.4, 8);
        for (let k = 0; k < 7; k++) {
          ctx.fillStyle = colors[Math.floor(r() * colors.length)];
          ctx.beginPath();
          ctx.ellipse(62 + k * (W * 0.055), oy + 30 + row * 50, 12, 9, 0, 0, M.TAU);
          ctx.fill();
        }
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.strokeRect(W - 230, oy, 130, oh);
      ctx.beginPath();
      ctx.moveTo(W - 165, oy);
      ctx.lineTo(W - 165, oy + oh);
      ctx.stroke();
    }
  }
  function awning(ctx, cam, b, z0, ink) {
    const P = (x, y, z) => cam.p({ x, y, z });
    const xa = b.x0 + 30;
    const xb = b.x1 - 30;
    const zTop = z0 + 222;
    const zLow = z0 + 175;
    const out = 120;
    const [c1, c2] = b.shop.awning;
    const n = Math.max(4, Math.round((xb - xa) / 55));
    const quads = [];
    for (let k = 0; k < n; k++) {
      const a0 = xa + ((xb - xa) * k) / n;
      const a1 = xa + ((xb - xa) * (k + 1)) / n;
      quads.push({ pts: [P(a0, b.y1, zTop), P(a1, b.y1, zTop), P(a1, b.y1 + out, zLow), P(a0, b.y1 + out, zLow)], c: k % 2 ? c2 : c1 });
    }
    const outline = [P(xa, b.y1, zTop), P(xb, b.y1, zTop), P(xb, b.y1 + out, zLow), P(xb, b.y1 + out, zLow - 30), P(xa, b.y1 + out, zLow - 30), P(xa, b.y1 + out, zLow)];
    poly(ctx, outline, null, INK, ink * 2.4);
    for (const q of quads) poly(ctx, q.pts, q.c);
    // franja (barrado) com ondinhas
    for (let k = 0; k < n; k++) {
      const a0 = xa + ((xb - xa) * k) / n;
      const a1 = xa + ((xb - xa) * (k + 1)) / n;
      const p0 = P(a0, b.y1 + out, zLow);
      const p1 = P(a1, b.y1 + out, zLow);
      const p2 = P(a1, b.y1 + out, zLow - 22);
      const p3 = P((a0 + a1) / 2, b.y1 + out, zLow - 34);
      const p4 = P(a0, b.y1 + out, zLow - 22);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.quadraticCurveTo(p3.x, p3.y, p4.x, p4.y);
      ctx.closePath();
      ctx.fillStyle = k % 2 ? c2 : c1;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 0.7;
      ctx.stroke();
    }
    // sombra embaixo do toldo
    const sh = [P(xa, b.y1, zTop - 8), P(xb, b.y1, zTop - 8), P(xb, b.y1, zTop - 70), P(xa, b.y1, zTop - 70)];
    poly(ctx, sh, 'rgba(20,14,26,0.28)');
  }
  /**
   * Caixa d'água de plástico (as azuis das lajes): corpo que abre um pouco para cima, com dois anéis; tampa mais larga
   * com a cúpula e o pegador; o cano branco saindo do lado e descendo para a laje; em cima de um calço de madeira.
   * (O dono pediu: a de antes parecia uma lata.)
   */
  function tank(ctx, cam, x, y, z, ink) {
    const zoom = cam.zoom;
    const sp = cam.sinP;
    const zb = z + 12; // em cima do calço
    const rb = 56, rt = 68, h = 82;
    const B = cam.p({ x, y, z: zb });
    const T = cam.p({ x, y, z: zb + h });
    const ell = (c, r, color, k = 1, a0 = 0, a1 = M.TAU) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, r * zoom * k, r * zoom * sp * k, 0, a0, a1);
      ctx.fill();
    };
    // calço de madeira
    const s0 = cam.p({ x, y, z });
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(s0.x, s0.y, (rb + 10) * zoom + ink, (rb + 10) * zoom * sp + ink, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#7a5a3c';
    ctx.fillRect(s0.x - (rb + 10) * zoom, s0.y - 12 * zoom * cam.cosP, (rb + 10) * 2 * zoom, 12 * zoom * cam.cosP);
    ell(s0, rb + 10, '#6a4e34');
    // o corpo (tronco de cone) com o lado da sombra
    const body = [
      { x: B.x - rb * zoom, y: B.y },
      { x: T.x - rt * zoom, y: T.y },
      { x: T.x + rt * zoom, y: T.y },
      { x: B.x + rb * zoom, y: B.y },
    ];
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(B.x, B.y, rb * zoom + ink * 1.4, rb * zoom * sp + ink * 1.4, 0, 0, Math.PI);
    ctx.fill();
    poly(ctx, body, null, INK, ink * 2.6);
    poly(ctx, body, '#2f73c4');
    ell(B, rb, '#2f73c4', 1, 0, Math.PI);
    poly(ctx, [{ x: B.x + rb * zoom * 0.3, y: B.y }, { x: T.x + rt * zoom * 0.3, y: T.y }, { x: T.x + rt * zoom, y: T.y }, { x: B.x + rb * zoom, y: B.y }], '#245a9c');
    // os dois anéis do corpo
    ctx.strokeStyle = '#1f4f8c';
    ctx.lineWidth = Math.max(1.2, 2.6 * zoom);
    for (const u of [0.33, 0.66]) {
      const c = cam.p({ x, y, z: zb + h * u });
      const r = (rb + (rt - rb) * u) * zoom;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, r, r * sp, 0, 0.08, Math.PI - 0.08);
      ctx.stroke();
    }
    // sujeira e limo escorrendo (a mata tomando a cidade)
    ctx.fillStyle = 'rgba(30, 60, 40, 0.28)';
    for (let k = 0; k < 4; k++) {
      const u = (k + 0.5) / 4;
      const px = T.x - rt * zoom * 0.8 + rt * zoom * 1.6 * u;
      ctx.fillRect(px, T.y + 4 * zoom, 3 * zoom, (h * cam.cosP * 0.35 + k * 6) * zoom);
    }
    // o cano branco: sai do lado, faz a curva e desce até a laje
    const p0 = cam.p({ x: x + rb * 0.8, y: y + rb * 0.6, z: zb + 18 });
    const p1 = cam.p({ x: x + rb * 1.3, y: y + rb * 1.0, z: zb + 18 });
    const p2 = cam.p({ x: x + rb * 1.3, y: y + rb * 1.0, z });
    for (const [c, w] of [[INK, 6 * zoom + ink * 2], ['#dcd8cc', 6 * zoom]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    // a tampa: aba mais larga, a cúpula e o pegador no meio
    const L = cam.p({ x, y, z: zb + h + 4 });
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(L.x, L.y, (rt + 6) * zoom + ink * 1.4, (rt + 6) * zoom * sp + ink * 1.4, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillRect(L.x - (rt + 6) * zoom - ink * 1.4, L.y - 0, ((rt + 6) * zoom + ink * 1.4) * 2, (T.y - L.y) + 2);
    ell(T, rt + 6, '#2a66b0', 1, 0, Math.PI);
    ctx.fillStyle = '#2a66b0';
    ctx.fillRect(T.x - (rt + 6) * zoom, L.y, (rt + 6) * 2 * zoom, T.y - L.y);
    ell(L, rt + 6, '#4f8fdc');
    const D = cam.p({ x, y, z: zb + h + 4 });
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(D.x, D.y - 2 * zoom, rt * 0.82 * zoom + ink, (rt * 0.82 * sp + 14) * zoom + ink, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#5b9be6';
    ctx.beginPath();
    ctx.ellipse(D.x, D.y - 2 * zoom, rt * 0.82 * zoom, (rt * 0.82 * sp + 14) * zoom, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(D.x - rt * 0.32 * zoom, D.y - 12 * zoom, rt * 0.3 * zoom, 5 * zoom, -0.2, 0, M.TAU);
    ctx.fill();
    const K = cam.p({ x, y, z: zb + h + 4 + 20 });
    ctx.fillStyle = INK;
    ctx.fillRect(K.x - 9 * zoom - ink, K.y - ink, 18 * zoom + ink * 2, 7 * zoom + ink * 2);
    ctx.fillStyle = '#3e83cf';
    ctx.fillRect(K.x - 9 * zoom, K.y, 18 * zoom, 7 * zoom);
  }

  function antenna(ctx, cam, x, y, z, ink) {
    const a = cam.p({ x, y, z });
    const b = cam.p({ x, y, z: z + 260 });
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 1.4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    for (let k = 0; k < 4; k++) {
      const c = cam.p({ x, y, z: z + 150 + k * 30 });
      const w = (40 - k * 8) * cam.zoom;
      ctx.moveTo(c.x - w, c.y + w * 0.3);
      ctx.lineTo(c.x + w, c.y - w * 0.3);
    }
    ctx.stroke();
  }

  // ------------------------------------------------------------------ árvore (tronco + copa que balança)
  // casca por espécie (as árvores da rua têm a barra caiada; as da mata não)
  const BARK = {
    mata: ['#5a4532', '#3c2d21'],
    seca: ['#857c72', '#5c554d'],
    jeriva: ['#8a8072', '#5f574c'],
    embauba: ['#c9c2b2', '#9a9384'],
    xaxim: ['#4a3526', '#2f2219'],
    bananeira: ['#7f9a4c', '#5b7436'],
    figueira: ['#7c6a57', '#574838'],
    sibipiruna: ['#7a7060', '#544b3e'],
    'ipe-amarelo': ['#6b5541', '#4a3a2b'],
    'ipe-roxo': ['#6b5541', '#4a3a2b'],
  };
  class TreeTrunk extends Prop {
    draw(ctx, t) {
      // a árvore que nasceu dentro da casa (world.js liga `house`): o tronco só aparece com a casa cortada
      if (this.house) {
        const k = this.house.cutK || 0;
        if (k <= 0) return;
        const a = this.alpha;
        this.alpha = a * k;
        super.draw(ctx, t);
        this.alpha = a;
        return;
      }
      super.draw(ctx, t);
    }
    constructor(world, t) {
      const rr = Math.max(22, t.trunk || 0);
      // a figueira é larga (tronco de 2 m e galhos): fica transparente se esconder o personagem, como a copa
      super(world, { x0: t.x - rr, x1: t.x + rr, y0: t.y - rr, y1: t.y + rr }, { fades: t.kind === 'figueira' });
      this.t = t;
      this.collider = { type: 'circle', x: t.x, y: t.y, r: t.trunk ? t.trunk + 4 : 26 };
    }
    screenBox() {
      const t = this.t;
      const fl = PD.flora && PD.flora.tree[t.kind];
      if (fl && fl.trunkBox) return fl.trunkBox(this.cam, t, this.z0);
      const roots = t.kind === 'figueira' ? (t.trunk || 60) * 4.2 : 40;
      return bbox([this.P(t.x, t.y, this.z0), this.P(t.x, t.y, this.z0 + t.h * 0.72)], Math.max(40, roots) * this.cam.zoom);
    }
    shadow(path) {
      const t = this.t;
      lineShadow(path, this.cam, t.x, t.y, t.h * 0.6, t.kind === 'figueira' ? (t.trunk || 60) * 1.6 : 16);
      circleShadow(path, this.cam, t.x, t.y, t.r * 0.95, t.h * 0.72);
    }
    paint(ctx) {
      const cam = this.cam;
      const t = this.t;
      const z0 = this.z0;
      const ink = this.ink;
      const crown = BROADLEAF.has(t.kind) || t.kind === 'seca';
      const top = t.h * (t.kind === 'seca' ? DEAD_FORK : crown ? FORK : 0.68);
      const pts = [];
      const r0 = t.trunk || 17;
      const r1 = t.trunk ? t.trunk * (crown ? 0.75 : 0.55) : 9;
      const N = 6;
      const twist = t.kind === 'seca' ? 10 : t.trunk ? 3 : 6;
      const lean = (k) => Math.sin(k * 1.3 + t.x) * twist;
      const bark = BARK[t.kind];
      if (t.kind === 'figueira') {
        this._figPaint(ctx);
        return;
      }
      const fl = PD.flora && PD.flora.tree[t.kind];
      if (fl) {
        fl.trunk(ctx, cam, t, z0, ink);
        return;
      }
      for (let k = 0; k <= N; k++) {
        const z = z0 + (top * k) / N;
        const r = r0 + (r1 - r0) * (k / N);
        const c = cam.p({ x: t.x + lean(k), y: t.y, z });
        pts.push({ c, r: r * cam.zoom });
      }
      const left = pts.map((p) => ({ x: p.c.x - p.r, y: p.c.y }));
      const right = pts.map((p) => ({ x: p.c.x + p.r, y: p.c.y })).reverse();
      const shape = left.concat(right);
      poly(ctx, shape, null, INK, ink * 2.4);
      poly(ctx, shape, bark ? bark[0] : '#7a5537');
      // lado da sombra
      const shadeSide = pts.map((p) => ({ x: p.c.x + p.r * 0.2, y: p.c.y })).concat(right);
      poly(ctx, shadeSide, bark ? bark[1] : '#5a3b25');
      if (!bark) {
        // caiação (barra branca do tronco), só nas árvores da rua
        const wz = Math.round((N * 75) / top);
        const wl = left.slice(0, wz + 1);
        const wr = pts.slice(0, wz + 1).map((p) => ({ x: p.c.x + p.r, y: p.c.y })).reverse();
        poly(ctx, wl.concat(wr), '#efe9dc');
        poly(ctx, pts.slice(0, wz + 1).map((p) => ({ x: p.c.x + p.r * 0.2, y: p.c.y })).concat(wr), '#cfc6b4');
      }
      if (t.kind === 'figueira' && this._sacred()) this._figGlyphs(ctx, pts);
      if (crown) return; // os galhos saem da forquilha na copa (crownPaint)
      // galhos para dentro da copa
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      const ctop = pts[N].c;
      for (const [dx, dz, w] of [[-55, 60, 6], [60, 75, 5], [10, 95, 5]]) {
        const e = cam.p({ x: t.x + dx, y: t.y - dx * 0.4, z: z0 + top + dz });
        ctx.lineWidth = w * cam.zoom + ink * 2;
        ctx.beginPath();
        ctx.moveTo(ctop.x, ctop.y);
        ctx.quadraticCurveTo((ctop.x + e.x) / 2, (ctop.y + e.y) / 2 - 10 * cam.zoom, e.x, e.y);
        ctx.stroke();
        ctx.strokeStyle = '#6a4a30';
        ctx.lineWidth = w * cam.zoom;
        ctx.stroke();
        ctx.strokeStyle = INK;
      }
    }
  }

  // ------------------------------------------------------------------ Figueira dos Despertos
  // O tronco é um cilindro feito de fatias (cada fatia é um círculo deitado, que a câmera mostra como uma elipse de
  // r × r·sinP): por isso a base é redonda e entra no chão, sem a linha reta de antes. As sapopemas (raízes em aleta)
  // saem do próprio tronco, quatro galhos grossos sobem da forquilha até a copa e soltam raízes aéreas.
  const FIG = { fork: 0.42, bark: { light: '#a48d72', base: '#7c6a57', shade: '#574838', dark: '#3a2e23' } };

  TreeTrunk.prototype._figPaint = function (ctx) {
    const cam = this.cam;
    const t = this.t;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const R = t.trunk || 100;
    const zf = t.h * FIG.fork; // forquilha: onde o tronco vira galhos
    const rnd = M.rng(Math.round(t.x * 7 + t.y * 3));
    const lean = rnd() * M.TAU;
    // perfil: alarga na base e afina um pouco até a forquilha. O pé é feito das raízes que saem do chão
    // (_figButtress), na figueira da rua e na dos Despertos (aprovado pelo dono em 13/11): as raízes curtas enroladas
    // no tronco viravam "garras" e a base lisa parecia uma saia — o dono achou feio as duas
    const slices = [];
    const N = 24;
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      const fu = 0.3;
      const flare = u < fu ? Math.pow(1 - u / fu, 2) * 0.45 : 0;
      const r = R * (0.78 + 0.22 * (1 - u) + flare) * (1 + Math.sin(u * 9 + lean) * 0.03);
      const off = Math.sin(u * 2.2 + lean) * R * 0.12 * u;
      const c = cam.p({ x: t.x + Math.cos(lean) * off, y: t.y + Math.sin(lean) * off, z: z0 + zf * u });
      slices.push({ c, r, u });
    }
    // os sorteios das raízes antigas (em garra, não desenhadas mais) continuam, para os galhos e a copa saírem iguais
    for (let k = 0; k < 8; k++) for (let j = 0; j < 5; j++) rnd();
    const limbs = [];
    const turn = rnd() * M.TAU;
    for (let k = 0; k < 4; k++) {
      limbs.push({ a: turn + (k / 4) * M.TAU + (rnd() - 0.5) * 0.7, reach: R * (2.5 + rnd() * 1.2), rise: t.h * (0.2 + rnd() * 0.1), w0: R * (0.5 - k * 0.05), w1: R * 0.15, seed: rnd() * 10, hang: 2 + Math.floor(rnd() * 2) });
    }
    // raízes de trás antes e as da frente depois do tronco; os galhos saem todos do meio do topo do tronco, depois dele:
    // primeiro os de trás, depois os da frente, cada grupo com o contorno de todos antes do recheio (senão a borda de um
    // galho riscava o outro e os dois pareciam cruzar em "X")
    const front = (a) => Math.cos(a) + Math.sin(a) > 0;
    const base = this._figBaseRoots(R, rnd);
    this._figButtress(ctx, base, 'back');
    this._figTrunkBody(ctx, slices);
    this._figButtress(ctx, base, 'front');
    this._figLimbs(ctx, limbs.filter((l) => !front(l.a)), R, zf, rnd);
    this._figLimbs(ctx, limbs.filter((l) => front(l.a)), R, zf, rnd);
    // símbolos na frente do tronco (na superfície: a frente do cilindro fica r·sinP abaixo do centro da fatia)
    const onFace = (s) => ({ c: { x: s.c.x - s.r * zoom * 0.12, y: s.c.y + s.r * cam.sinP * zoom * 0.95 }, r: 0 });
    if (this._sacred()) this._figGlyphs(ctx, [null, onFace(slices[6]), onFace(slices[11]), onFace(slices[16])]);
  };

  /**
   * Figueira sagrada (com os símbolos que brilham): a que tem um ponto do Véu perto. A Figueira da Esquina, que rompeu
   * a rua (`rompendo`), é só uma árvore grande da cidade. No protótipo antigo (sem véus no mapa), todas são.
   */
  TreeTrunk.prototype._sacred = function () {
    const t = this.t;
    if (t.breaks) return false;
    const map = this.world.map;
    if (!map || map.kind !== 'tmj') return true;
    return (map.veils || []).some((v) => Math.hypot(v.x - t.x, v.y - t.y) < 400);
  };

  /** Corpo do tronco: fatias em tinta (contorno), depois a casca com luz à esquerda e sulcos que contornam o cilindro. */
  TreeTrunk.prototype._figTrunkBody = function (ctx, slices) {
    const cam = this.cam;
    const zoom = cam.zoom;
    const sinP = cam.sinP;
    const B = FIG.bark;
    const ell = (s, grow) => {
      const rx = s.r * zoom + grow;
      ctx.moveTo(s.c.x + rx, s.c.y);
      ctx.ellipse(s.c.x, s.c.y, rx, s.r * sinP * zoom + grow, 0, 0, M.TAU);
    };
    ctx.fillStyle = INK;
    ctx.beginPath();
    for (const s of slices) ell(s, this.ink * 1.3);
    ctx.fill();
    let x0 = Infinity, x1 = -Infinity;
    for (const s of slices) {
      x0 = Math.min(x0, s.c.x - s.r * zoom);
      x1 = Math.max(x1, s.c.x + s.r * zoom);
    }
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, B.light);
    g.addColorStop(0.3, B.base);
    g.addColorStop(0.7, B.shade);
    g.addColorStop(1, B.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    for (const s of slices) ell(s, 0);
    ctx.fill();
    // sulcos: as raízes fundidas subindo pelo tronco, desenhadas na superfície da frente (x = r·a, y desce r·sinP·√(1−a²))
    const rnd = M.rng(Math.round(this.t.x + this.t.y * 11));
    ctx.lineCap = 'round';
    for (let f = 0; f < 9; f++) {
      const across = -0.86 + (f / 8) * 1.72 + (rnd() - 0.5) * 0.08;
      const lit = across < 0.1;
      const line = (shift) => {
        ctx.beginPath();
        slices.forEach((s, k) => {
          const a = Math.max(-0.98, Math.min(0.98, across + shift + Math.sin(k * 0.7 + f * 1.3) * 0.035));
          const x = s.c.x + s.r * zoom * a;
          const y = s.c.y + s.r * sinP * zoom * Math.sqrt(1 - a * a);
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
      };
      ctx.strokeStyle = lit ? 'rgba(58, 44, 32, 0.5)' : 'rgba(24, 18, 13, 0.55)';
      ctx.lineWidth = Math.max(1, (2 + rnd() * 1.8) * zoom);
      line(0);
      if (lit) {
        ctx.strokeStyle = 'rgba(190, 168, 136, 0.35)';
        ctx.lineWidth = Math.max(0.8, 1.2 * zoom);
        line(-0.05);
      }
    }
  };

  /**
   * Raízes do pé da figueira: os mesmos caminhos das raízes pintadas no chão (street.js, figRootPaths) — as do mapa
   * (figueira da rua) e as a mais, nos vãos entre elas. Sem o chão novo (protótipo antigo), cinco retas em volta.
   */
  TreeTrunk.prototype._figBaseRoots = function (R, rnd) {
    const t = this.t;
    const map = this.world.map;
    const S = PD.street;
    if (S && S.figRootPaths && map && map.shapes) return S.figRootPaths(t, map);
    const out = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * M.TAU + rnd() * 0.5;
      const pts = [{ x: t.x, y: t.y }, { x: t.x + Math.cos(a) * R * 4, y: t.y + Math.sin(a) * R * 4 }];
      out.push({ pts, len: R * 4, wa: R * 0.8, h0: R * 0.7, a });
    }
    return out;
  };

  /**
   * Raízes que saem do chão (toda figueira; referência do dono de 13/11). Cada uma nasce dentro do tronco, alta e
   * larga, desce e vira a raiz do chão (street.js): no fim do pé ela tem a largura e a altura da raiz do chão, e sem
   * contorno, as duas viram uma só. O corte é meia elipse (lombo redondo) em oito faixas, cada uma com a cor da luz que
   * recebe, e musgo no alto. O que o dono achou feio antes: "garras" enroladas no pé, base lisa como saia, tábuas.
   * `part` 'back' desenha a terra, o contorno de todas e as de trás (antes do tronco); 'front', as da frente.
   */
  TreeTrunk.prototype._figButtress = function (ctx, roots, part) {
    const cam = this.cam;
    const t = this.t;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const R = t.trunk || 100;
    const ink = this.ink;
    const L = cam.light;
    const tc = cam.toCamera;
    const tcl = Math.hypot(tc.x, tc.y, tc.z);
    const ST = PD.street;
    const widthAt = (r, d) => (ST && ST.rootWidth ? ST.rootWidth(r.wa, d, r.len) : r.wa * (1 - 0.5 * Math.min(1, d / r.len)));
    const pointAt = (r, d) => {
      if (ST && ST.along) return ST.along(r.pts, d);
      const a = r.a;
      return { x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d, a };
    };
    const RAMP = ['#2f251c', '#4a3c2f', '#665443', '#857160', '#a58f76'];
    const tone = (v) => {
      const f = M.clamp(v, 0, 0.999) * (RAMP.length - 1);
      const i = Math.floor(f);
      return M.mix(RAMP[i], RAMP[i + 1], f - i);
    };
    const S = 16;
    const ARC = 8;
    const d0 = R * 0.5;
    const d1 = R * 2.3;
    const geo = roots.map((r) => {
      const hTip = widthAt(r, d1) * 0.26;
      const rows = [];
      for (let s = 0; s <= S; s++) {
        const u = s / S;
        const d = d0 + (d1 - d0) * u;
        const p = pointAt(r, d);
        const nx = -Math.sin(p.a), ny = Math.cos(p.a);
        // no tronco, larga e alta (aleta); no fim, igual à raiz do chão
        const w = widthAt(r, d) * (1 + 0.9 * Math.pow(1 - u, 2));
        const h = hTip + (r.h0 - hTip) * Math.pow(1 - u, 1.5);
        const row = { u, cx: p.x, cy: p.y, a: p.a, nx, ny, w, h };
        for (let j = 0; j <= ARC; j++) {
          const th = (j / ARC) * Math.PI;
          const side = (Math.cos(th) * w) / 2;
          row['e' + j] = cam.p({ x: p.x + nx * side, y: p.y + ny * side, z: z0 + Math.sin(th) * h });
        }
        row.sL = cam.p({ x: p.x + nx * (w / 2 + 6), y: p.y + ny * (w / 2 + 6), z: z0 });
        row.sR = cam.p({ x: p.x - nx * (w / 2 + 6), y: p.y - ny * (w / 2 + 6), z: z0 });
        rows.push(row);
      }
      // as faixas e a cor de cada uma pela normal no meio do pé
      const mid = rows[Math.round(S * 0.4)];
      const faces = [];
      for (let j = 0; j < ARC; j++) {
        const th = ((j + 0.5) / ARC) * Math.PI;
        const ns = Math.cos(th) * mid.h, nz = (Math.sin(th) * mid.w) / 2;
        const nl = Math.hypot(ns, nz) || 1;
        const N3 = { x: (mid.nx * ns) / nl, y: (mid.ny * ns) / nl, z: nz / nl };
        const lit = N3.x * L.x + N3.y * L.y + N3.z * L.z;
        const face = (N3.x * tc.x + N3.y * tc.y + N3.z * tc.z) / tcl;
        faces.push({ A: 'e' + j, B: 'e' + (j + 1), color: tone(0.2 + lit * 0.78), face });
      }
      faces.sort((p, q) => p.face - q.face);
      const tip = rows[S];
      return { r, rows, faces, depth: Math.cos(tip.a) + Math.sin(tip.a), front: Math.cos(r.a) + Math.sin(r.a) > 0 };
    });
    const facePoly = (g, f, upto) => {
      const rows = g.rows.slice(0, upto);
      return rows.map((q) => q[f.A]).concat(rows.map((q) => q[f.B]).reverse());
    };
    const fill = (g) => {
      for (const f of g.faces) poly(ctx, facePoly(g, f, g.rows.length), f.color);
      // sulco da casca no alto do lombo (some antes do fim do pé)
      ctx.strokeStyle = 'rgba(40, 30, 22, 0.45)';
      ctx.lineWidth = Math.max(0.8, 1.6 * zoom);
      ctx.lineCap = 'round';
      ctx.beginPath();
      g.rows.slice(1, Math.round(S * 0.75)).forEach((q, i) => {
        const p = cam.p({ x: q.cx + q.nx * q.w * 0.12, y: q.cy + q.ny * q.w * 0.12, z: z0 + q.h * 0.95 });
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
      // musgo no alto, aqui e ali
      const rnd = M.rng(Math.round(g.r.a * 1000) + 91);
      for (let k = 0; k < 2; k++) {
        const q = g.rows[Math.round(S * (0.25 + rnd() * 0.5))];
        const p = cam.p({ x: q.cx, y: q.cy, z: z0 + q.h * 0.98 });
        const rx = q.w * (0.16 + rnd() * 0.1) * zoom;
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(74, 104, 46, 0.85)' : 'rgba(92, 124, 54, 0.82)';
        const mx = p.x + (rnd() - 0.5) * rx;
        const edge = [];
        for (let e = 0; e < 11; e++) {
          const th = (e / 11) * M.TAU;
          const k = 0.6 + rnd() * 0.8;
          edge.push({ x: mx + Math.cos(th) * rx * k, y: p.y + Math.sin(th) * rx * 0.5 * k });
        }
        poly(ctx, edge);
        ctx.fill();
        ctx.fillStyle = 'rgba(160, 182, 92, 0.85)';
        for (let d = 0; d < 3; d++) {
          ctx.beginPath();
          ctx.arc(p.x + (rnd() - 0.5) * rx * 1.4, p.y + (rnd() - 0.5) * rx * 0.6, Math.max(0.8, 1.3 * zoom), 0, M.TAU);
          ctx.fill();
        }
      }
    };
    if (part === 'back') {
      // a terra rompida dos dois lados de cada raiz (embaixo dela)
      for (const g of geo) poly(ctx, g.rows.map((q) => q.sL).concat(g.rows.map((q) => q.sR).reverse()), 'rgba(36, 28, 20, 0.45)');
      // contorno de todas (sem o fim, que vira a raiz do chão), antes de qualquer recheio: as juntas ficam sem risco
      for (const g of geo) for (const f of g.faces) poly(ctx, facePoly(g, f, Math.round(S * 0.8)), null, INK, ink * 2.2);
      geo.filter((g) => !g.front).sort((p, q) => p.depth - q.depth).forEach(fill);
    } else {
      geo.filter((g) => g.front).sort((p, q) => p.depth - q.depth).forEach(fill);
    }
  };

  /** Galhos grossos: saem do meio do topo do tronco, abrem para fora subindo até a copa, afinando; soltam raízes aéreas. */
  TreeTrunk.prototype._figLimbs = function (ctx, group, R, zf, rnd) {
    if (!group.length) return;
    const cam = this.cam;
    const t = this.t;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const ink = this.ink;
    const B = FIG.bark;
    const L = cam.lightScreen;
    const S = 14;
    const all = group.map((l) => {
      const pts = [];
      for (let s = 0; s <= S; s++) {
        const u = s / S;
        const d = (l.reach * Math.pow(u, 0.9));
        const a = l.a + Math.sin(u * 2 + l.seed) * 0.15;
        const w = { x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d, z: z0 + zf - R * 0.2 + l.rise * (1 - Math.pow(1 - u, 2)) + R * 0.3 * u };
        pts.push({ w, p: cam.p(w), r: (l.w0 + (l.w1 - l.w0) * Math.pow(u, 0.8)) * zoom });
      }
      // raízes aéreas penduradas: algumas chegam ao chão, outras param no ar
      const hangs = [];
      for (let k = 0; k < l.hang; k++) {
        const s = Math.floor(S * (0.45 + 0.5 * rnd()));
        const reach = t.breaks ? (rnd(), 170 + rnd() * 150) : rnd() < 0.5 ? 0 : 60 + rnd() * 160;
        hangs.push({ s, end: z0 + reach, sway: (rnd() - 0.5) * 30, w: (2.4 + rnd() * 1.6) * zoom });
      }
      return { pts, hangs };
    });
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const { pts, hangs } of all) {
      for (const h of hangs) {
        const top = pts[h.s];
        const end = cam.p({ x: top.w.x + h.sway, y: top.w.y, z: h.end });
        const mid = cam.p({ x: top.w.x + h.sway * 0.4, y: top.w.y, z: (top.w.z + h.end) / 2 });
        for (const [color, extra] of [[INK, ink * 1.6], [B.shade, 0]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = h.w + extra;
          ctx.beginPath();
          ctx.moveTo(top.p.x, top.p.y);
          ctx.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
          ctx.stroke();
        }
      }
    }
    const pass = (color, grow) => {
      ctx.strokeStyle = color;
      for (const { pts } of all) {
        for (let s = 0; s + 1 < pts.length; s++) {
          ctx.lineWidth = pts[s].r * 2 + grow;
          ctx.beginPath();
          ctx.moveTo(pts[s].p.x, pts[s].p.y);
          ctx.lineTo(pts[s + 1].p.x, pts[s + 1].p.y);
          ctx.stroke();
        }
      }
    };
    pass(INK, ink * 2.4);
    pass(B.base, 0);
    // sombra embaixo e luz em cima de cada galho (começa um pouco depois da junta, para a forquilha não riscar)
    for (const [color, side, k] of [[B.shade, -1, 0.45], [B.light, 1, 0.3]]) {
      ctx.strokeStyle = color;
      for (const { pts } of all) {
        for (let s = 2; s + 1 < pts.length; s++) {
          const o = pts[s].r * 0.55 * side;
          ctx.lineWidth = Math.max(0.6, pts[s].r * 2 * k);
          ctx.beginPath();
          ctx.moveTo(pts[s].p.x + L.x * o, pts[s].p.y + L.y * o);
          ctx.lineTo(pts[s + 1].p.x + L.x * o, pts[s + 1].p.y + L.y * o);
          ctx.stroke();
        }
      }
    }
  };

  /** Símbolos entalhados no tronco da figueira, que brilham em verde-água. */
  TreeTrunk.prototype._figGlyphs = function (ctx, pts) {
    const cam = this.cam;
    const z = cam.zoom;
    ctx.save();
    ctx.shadowColor = '#3fd6c8';
    ctx.shadowBlur = 10 * z;
    ctx.strokeStyle = '#7ff5e6';
    ctx.lineWidth = Math.max(1.2, 3.2 * z);
    ctx.lineCap = 'round';
    for (const [k, s] of [[1, 34], [2, 28], [3, 22]]) {
      const p = pts[k].c;
      const x = p.x - (pts[k].r || 0) * 0.15;
      const y = p.y;
      const r = s * z;
      ctx.beginPath(); // losango com um olho no meio
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.7, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.7, y);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.25, 0, M.TAU);
      ctx.stroke();
    }
    ctx.restore();
  };

  // copa por espécie: verde frio e fundo na mata, ipês floridos, a figueira imensa
  const CANOPY = {
    ipe: { base: '#f2c21c', shade: '#cf8f0f', light: '#ffe46b', under: '#5d7f34' },
    'ipe-amarelo': { base: '#efbd22', shade: '#c88a14', light: '#ffe06a', under: '#4d6d2e' },
    'ipe-roxo': { base: '#b0569f', shade: '#7c3a72', light: '#d88ccb', under: '#3d5f33' },
    mata: { base: '#2f5c33', shade: '#1e4126', light: '#47794a', under: '#16301e' },
    figueira: { base: '#2c6a3b', shade: '#1b4829', light: '#4f9053', under: '#143022' },
    sibipiruna: { base: '#4a8a3a', shade: '#33692b', light: '#72aa52', under: '#244d20', flowers: '#e9c84a' },
  };

  const CANOPY_INK = '#13221a';

  class TreeCanopy extends Prop {
    constructor(world, t) {
      super(world, { x0: t.x - t.r, x1: t.x + t.r, y0: t.y - t.r, y1: t.y + t.r }, { overhead: true });
      this.t = t;
      this.colors = CANOPY[t.kind] || { base: '#5f9a3e', shade: '#3f7130', light: '#86bf55', under: '#355f2a' };
      this.sway = 0;
    }
    get center() {
      const t = this.t;
      return { x: t.x, y: t.y, z: this.z0 + t.h * (t.kind === 'figueira' ? 0.8 : 0.78) };
    }
    screenBox() {
      const t = this.t;
      const fl = PD.flora && PD.flora.tree[t.kind];
      if (fl) return fl.crownBox(this.cam, t, this.z0);
      if (BROADLEAF.has(t.kind) || t.kind === 'seca') {
        // árvore de verdade: a caixa justa dos tufos e da forquilha (a caixa folgada fazia a imagem grande demais, e
        // desenhar imagens grandes a cada quadro pesava no celular)
        const dead = t.kind === 'seca';
        const { fork, tufts } = crownPlan(t, this.z0, dead);
        const zoom = this.cam.zoom;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const grow = (q, rx, ry) => {
          x0 = Math.min(x0, q.x - rx);
          x1 = Math.max(x1, q.x + rx);
          y0 = Math.min(y0, q.y - ry);
          y1 = Math.max(y1, q.y + ry);
        };
        grow(this.cam.p(fork), 30 * zoom, 20 * zoom);
        for (const tf of tufts) {
          // a seca: os gravetos passam da ponta do galho (até ~0,75 do galho) e a barba-de-velho pende
          const q = this.cam.p(tf.w);
          const r = dead ? t.r * 0.9 * zoom : tf.R * 1.35 * zoom;
          grow(q, r, r);
          if (dead || t.kind === 'mata') grow({ x: q.x, y: q.y + 150 * zoom }, r, 0);
        }
        return { x0: x0 - 8 * zoom, y0: y0 - 8 * zoom, x1: x1 + 8 * zoom, y1: y1 + 8 * zoom };
      }
      const c = this.cam.p(this.center);
      const r = t.r * this.cam.zoom * 1.25;
      return { x0: c.x - r, y0: c.y - r * 1.05, x1: c.x + r, y1: c.y + r * 0.85 };
    }
    paint(ctx) {
      const cam = this.cam;
      const t = this.t;
      const ink = this.ink;
      const fl = PD.flora && PD.flora.tree[t.kind];
      if (fl) {
        fl.crown(ctx, cam, t, this.z0, ink);
        return;
      }
      if (BROADLEAF.has(t.kind) || t.kind === 'seca') {
        crownPaint(ctx, cam, t, this.z0, ink, this.colors, t.kind === 'seca');
        return;
      }
      const c = this.center;
      const r = M.rng(Math.round(t.x * 3 + t.y));
      // cachos numa cúpula achatada (mais larga do que alta); o tom de cada um vem da altura: embaixo escuro, em cima
      // claro. Antes eram 14 bolas grandes e lisas — o dono achou "bolas verdes enormes empilhadas que enchem a tela"
      const blobs = [];
      if (t.kind === 'figueira') this._figBlobs(blobs, c, r);
      else this._leafBlobs(blobs, c, r);
      blobs.sort((a, b) => a.depth - b.depth);
      const circles = blobs.map((b) => {
        const q = cam.p(b.p);
        return { x: q.x, y: q.y, r: b.r * cam.zoom, tier: b.tier };
      });
      // cada árvore com um tom um pouco diferente (a mata não fica de uma cor só)
      const j = (r() - 0.5) * 0.16;
      const tone = (hex) => M.shade(hex, j);
      const col = { base: tone(this.colors.base), shade: tone(this.colors.shade), light: tone(this.colors.light), under: tone(this.colors.under) };
      // contorno da copa toda, em verde quase preto (o preto puro deixava tudo com cara de bola de desenho)
      ctx.fillStyle = CANOPY_INK;
      for (const ci of circles) {
        ctx.beginPath();
        ctx.arc(ci.x, ci.y, ci.r + ink * 1.25, 0, M.TAU);
        ctx.fill();
      }
      const L = cam.lightScreen;
      const toLight = Math.atan2(L.y, L.x);
      circles.forEach((ci, k) => {
        const back = ci.tier === 0;
        ctx.fillStyle = back ? col.shade : col.base;
        ctx.beginPath();
        ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
        ctx.fill();
        if (k) {
          ctx.strokeStyle = 'rgba(19, 34, 26, 0.55)';
          ctx.lineWidth = ink * 0.6;
          ctx.stroke();
        }
        ctx.save();
        ctx.beginPath();
        ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
        ctx.clip();
        // meia-lua de sombra do lado longe da luz
        ctx.fillStyle = back ? col.under : col.shade;
        ctx.beginPath();
        ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
        ctx.arc(ci.x + L.x * ci.r * 0.42, ci.y + L.y * ci.r * 0.42, ci.r, 0, M.TAU, true);
        ctx.fill('evenodd');
        // folhagem: tufos de folha do lado da luz, cada um com a beirada escura do outro lado
        const tuft = back ? M.mix(col.shade, col.base, 0.5) : ci.tier === 2 ? col.light : M.mix(col.base, col.light, 0.55);
        const tufts = back ? 3 : 5;
        for (let f = 0; f < tufts; f++) {
          const a = toLight + (r() - 0.5) * 2.4;
          const dist = ci.r * (0.22 + r() * 0.5);
          const tr = ci.r * (0.17 + r() * 0.11);
          const x = ci.x + Math.cos(a) * dist;
          const y = ci.y + Math.sin(a) * dist;
          ctx.fillStyle = back ? col.under : col.shade;
          ctx.beginPath();
          ctx.arc(x - L.x * tr * 0.28, y - L.y * tr * 0.28, tr, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = tuft;
          ctx.beginPath();
          ctx.arc(x, y, tr, 0, M.TAU);
          ctx.fill();
        }
        // vãos escuros entre as folhas, do lado da sombra
        ctx.fillStyle = col.under;
        for (let g = 0; g < 2; g++) {
          const a = toLight + Math.PI + (r() - 0.5) * 1.4;
          const dist = ci.r * (0.55 + r() * 0.25);
          ctx.beginPath();
          ctx.ellipse(ci.x + Math.cos(a) * dist, ci.y + Math.sin(a) * dist, ci.r * 0.12, ci.r * 0.08, a, 0, M.TAU);
          ctx.fill();
        }
        ctx.restore();
      });
      // a sibipiruna tem florzinhas amarelas em cachos, só nos cachos de cima (pouca cor: o dono não quer árvore berrante)
      if (this.colors.flowers) {
        for (const ci of circles) {
          if (ci.tier !== 2 && r() < 0.6) continue;
          for (let k = 0; k < 3; k++) {
            const a = toLight + (r() - 0.5) * 2;
            const fx = ci.x + Math.cos(a) * ci.r * (0.2 + r() * 0.5);
            const fy = ci.y + Math.sin(a) * ci.r * (0.2 + r() * 0.5);
            for (let j = 0; j < 4; j++) {
              ctx.fillStyle = j ? this.colors.flowers : M.shade(this.colors.flowers, -0.3);
              ctx.beginPath();
              ctx.arc(fx + (r() - 0.5) * 9 * cam.zoom, fy + (r() - 0.5) * 6 * cam.zoom, Math.max(1, 2.4 * cam.zoom), 0, M.TAU);
              ctx.fill();
            }
          }
        }
      }
      // folhinhas soltas na borda
      ctx.fillStyle = col.light;
      for (let k = 0; k < 10; k++) {
        const ci = circles[Math.floor(r() * circles.length)];
        const a = r() * M.TAU;
        ctx.beginPath();
        ctx.arc(ci.x + Math.cos(a) * ci.r * 0.7, ci.y + Math.sin(a) * ci.r * 0.7, Math.max(1, 3 * cam.zoom), 0, M.TAU);
        ctx.fill();
      }
    }
    /** Copa comum: cachos menores numa cúpula achatada (mais larga do que alta). */
    _leafBlobs(blobs, c, r) {
      const cam = this.cam;
      const t = this.t;
      const n = 10 + Math.round(t.r / 32);
      for (let k = 0; k < n; k++) {
        const a = r() * M.TAU;
        const q = k < 2 ? r() * 0.25 : Math.sqrt(0.1 + r() * 0.9);
        const d = q * t.r * 0.72;
        const z = t.r * (0.3 * (1 - q * q) - 0.1) + (r() - 0.5) * t.r * 0.12;
        const p = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, z: c.z + z };
        const rel = (p.z - c.z) / t.r;
        blobs.push({ p, r: t.r * (0.26 + r() * 0.1), depth: cam.depth(p) + z * 0.3, tier: rel < -0.03 ? 0 : rel > 0.14 ? 2 : 1 });
      }
    }
    /**
     * Copa da figueira: muitos cachos menores numa cúpula larga e baixa (mais larga do que alta). Na frente do tronco os
     * cachos sobem até a altura dos galhos, para o tronco e a forquilha aparecerem embaixo da copa (sem o "pirulito").
     */
    _figBlobs(blobs, c, r) {
      const cam = this.cam;
      const t = this.t;
      const R = t.trunk || 100;
      const n = 50;
      const limitY = cam.p({ x: t.x, y: t.y, z: this.z0 + t.h * 0.6 }).y; // a copa não desce na frente do tronco além disto
      const trunkX = cam.p({ x: t.x, y: t.y, z: this.z0 }).x;
      for (let k = 0; k < n; k++) {
        const a = r() * M.TAU;
        const q = k < 4 ? r() * 0.3 : Math.sqrt(0.08 + r() * 0.92);
        const d = q * t.r * 0.95;
        const z = t.r * (0.24 * (1 - q * q) - 0.06) + (r() - 0.5) * t.r * 0.08;
        const p = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, z: c.z + z };
        const br = t.r * (0.14 + r() * 0.08);
        const s = cam.p(p);
        const near = 1 - M.smoothstep(R * 1.3, R * 2.8, Math.abs(s.x - trunkX) / cam.zoom);
        const bottom = s.y + br * cam.zoom;
        if (near > 0 && bottom > limitY) p.z += ((bottom - limitY) / (cam.cosP * cam.zoom)) * near;
        const rel = (p.z - c.z) / t.r;
        blobs.push({ p, r: br, depth: cam.depth(p) + (p.z - c.z) * 0.3, tier: rel < -0.02 ? 0 : rel > 0.13 ? 2 : 1 });
      }
    }
    /** A copa (círculo na tela) cobre a caixa do corpo? */
    cover(box) {
      const c = this.cam.p(this.center);
      const r = this.t.r * this.cam.zoom * 1.05;
      const cx = Math.max(box.x0, Math.min(c.x, box.x1));
      const cy = Math.max(box.y0, Math.min(c.y, box.y1));
      return (cx - c.x) ** 2 + (cy - c.y) ** 2 < r * r;
    }
    draw(ctx, time) {
      const s = this._spriteNow();
      // balanço da copa: desliza a imagem pronta (girar uma imagem grande custa caro a cada quadro);
      // o passo é de meio pixel do aparelho, então o movimento fica suave sem refazer pixel nenhum
      const dpr = this.cam.dpr;
      const amp = (this.t.kind === 'ipe' ? 3.2 : 2.6) * this.cam.zoom;
      const off = Math.round((Math.sin(time * 0.9 + this.t.x * 0.01) * 0.8 + Math.sin(time * 2.3 + this.t.y) * 0.2) * amp * dpr) / dpr;
      if (this.alpha < 0.999) ctx.globalAlpha = this.alpha;
      ctx.drawImage(s.c, s.x + off, s.y, s.w, s.h);
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ árvore de verdade (pedido do dono, 13/11)
  // "as árvores ao invés de ser redonda poderia ser normal como uma árvore e ter árvore seca tbm": o tronco sobe até a
  // forquilha e abre em galhos; cada galho termina num tufo de folhas de contorno recortado (lóbulos de folhagem, não
  // bola), com o lado da luz claro, folhinhas na borda e vãos escuros. Entre os tufos aparecem os galhos e pendem uns
  // cipós. A seca tem só galhos tortos, que se dividem em gravetos, e barba-de-velho pendurada.
  /** O ponto (no mundo) da curva de Bézier quadrática entre `a` e `b`, com o controle `c`. */
  function bez2(a, c, b, u) {
    const v = 1 - u;
    return { x: a.x * v * v + 2 * c.x * u * v + b.x * u * u, y: a.y * v * v + 2 * c.y * u * v + b.y * u * u, z: a.z * v * v + 2 * c.z * u * v + b.z * u * u };
  }
  /** Galho afinando (tela): a curva de `a` a `b` subindo `lift` cm no meio, de meia-largura w0 até w1 (cm). */
  function limbPoly(cam, a, b, w0, w1, lift) {
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 + lift };
    const q = [];
    for (let i = 0; i <= 8; i++) q.push({ p: cam.p(bez2(a, c, b, i / 8)), w: (w0 + ((w1 - w0) * i) / 8) * cam.zoom });
    const left = [];
    const right = [];
    for (let i = 0; i < q.length; i++) {
      const p0 = q[Math.max(0, i - 1)].p;
      const p1 = q[Math.min(q.length - 1, i + 1)].p;
      let nx = -(p1.y - p0.y);
      let ny = p1.x - p0.x;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      left.push({ x: q[i].p.x + nx * q[i].w, y: q[i].p.y + ny * q[i].w });
      right.push({ x: q[i].p.x - nx * q[i].w, y: q[i].p.y - ny * q[i].w });
    }
    return left.concat(right.reverse());
  }
  /** Contorno de um tufo (tela): lóbulos em volta de uma elipse achatada; `k` encolhe, (dx, dy) desloca. */
  function tuftPath(o, k = 1, dx = 0, dy = 0) {
    const p = new Path2D();
    const N = o.lobes.length;
    const pt = (i) => {
      const L = o.lobes[i % N];
      const th = (i / N) * M.TAU + o.phase;
      const rr = o.R * k * L;
      return { x: o.x + dx + Math.cos(th) * rr, y: o.y + dy + Math.sin(th) * rr * o.sq, th };
    };
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    let prev = pt(N - 1);
    let cur = pt(0);
    let m = mid(prev, cur);
    p.moveTo(m.x, m.y);
    for (let i = 0; i < N; i++) {
      const next = pt(i + 1);
      const out = { x: Math.cos(cur.th), y: Math.sin(cur.th) * o.sq };
      const bulge = o.R * k * 0.3;
      const end = mid(cur, next);
      p.quadraticCurveTo(cur.x + out.x * bulge, cur.y + out.y * bulge, end.x, end.y);
      cur = next;
    }
    p.closePath();
    return p;
  }
  const BROADLEAF = new Set(['mata', 'sibipiruna', 'ipe', 'ipe-amarelo', 'ipe-roxo']);
  /** Forquilha (onde o tronco vira galhos), em fração da altura; a seca abre mais baixo. */
  const FORK = 0.42;
  const DEAD_FORK = 0.45;
  const DEAD = { bark: '#857c72', shade: '#5c554d', moss: '#9aa58c' };

  /** O plano da copa (no mundo, cm), sorteado pela posição: a forquilha e os tufos (na seca, as pontas dos galhos). */
  function crownPlan(t, z0, dead) {
    const rnd = M.rng(Math.round(t.x * 13 + t.y * 7 + 5));
    const fork = { x: t.x + Math.sin(6 * 1.3 + t.x) * (dead ? 10 : 3), y: t.y, z: z0 + t.h * (dead ? DEAD_FORK : FORK) };
    const n = dead ? 3 + Math.floor(rnd() * 2) : 4 + Math.floor(rnd() * 2) + (t.r > 300 ? 1 : 0);
    const a0 = rnd() * M.TAU;
    const tufts = [];
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * M.TAU + (rnd() - 0.5) * 0.9;
      const d = t.r * (dead ? 0.65 + rnd() * 0.35 : 0.55 + rnd() * 0.3);
      const z = z0 + t.h * (dead ? 0.78 + rnd() * 0.2 : 0.6 + rnd() * 0.28);
      tufts.push({ w: { x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d, z }, R: t.r * (0.36 + rnd() * 0.16), a });
    }
    if (!dead) tufts.push({ w: { x: t.x + (rnd() - 0.5) * t.r * 0.3, y: t.y + (rnd() - 0.5) * t.r * 0.3, z: z0 + t.h * 0.92 }, R: t.r * 0.46, a: 0 });
    return { fork, tufts, rnd };
  }

  function crownPaint(ctx, cam, t, z0, ink, colors, dead) {
    const { fork, tufts, rnd } = crownPlan(t, z0, dead);
    const zoom = cam.zoom;
    const L = cam.lightScreen;
    const bark = BARK[t.kind] || BARK.mata;
    const w0 = (t.trunk || 17) * 0.62;

    // ---- galhos: todos os contornos antes dos recheios (senão a borda de um galho risca o outro na forquilha)
    const limbs = [];
    for (const tf of tufts) {
      const end = dead ? tf.w : { ...tf.w, z: tf.w.z - tf.R * 0.25 };
      const len = Math.hypot(end.x - fork.x, end.y - fork.y, end.z - fork.z);
      limbs.push({ poly: limbPoly(cam, fork, end, w0 * (dead ? 0.8 : 1), w0 * (dead ? 0.18 : 0.32), len * 0.18), end });
      if (dead) {
        // a seca: cada galho se divide em gravetos, duas vezes
        const split = (from, dir, len2, w, depth) => {
          for (const turn of [-0.55, 0.5]) {
            const ang = Math.atan2(dir.y, dir.x) + turn + (rnd() - 0.5) * 0.4;
            const to = { x: from.x + Math.cos(ang) * len2, y: from.y + Math.sin(ang) * len2, z: from.z + len2 * (0.35 + rnd() * 0.4) };
            limbs.push({ poly: limbPoly(cam, from, to, w, w * 0.45, len2 * 0.12), end: to, twig: true });
            if (depth > 1) split(to, { x: to.x - from.x, y: to.y - from.y }, len2 * 0.62, w * 0.45, depth - 1);
          }
        };
        split(end, { x: end.x - fork.x, y: end.y - fork.y }, len * 0.45, w0 * 0.2, 2);
      }
    }
    const fill = (pts, color) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    ctx.lineJoin = 'round';
    for (const lb of limbs) {
      ctx.beginPath();
      lb.poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 2.2;
      ctx.stroke();
    }
    for (const lb of limbs) fill(lb.poly, dead ? DEAD.bark : bark[0]);

    if (dead) {
      // barba-de-velho: fios cinza-esverdeados pendurados nos gravetos
      ctx.strokeStyle = DEAD.moss;
      ctx.lineWidth = Math.max(1, 1.4 * zoom);
      ctx.globalAlpha = 0.85;
      const tips = limbs.filter((l) => l.twig);
      for (let k = 0; k < 5 && tips.length; k++) {
        const e = cam.p(tips[Math.floor(rnd() * tips.length)].end);
        for (let j = 0; j < 4; j++) {
          const len = (40 + rnd() * 70) * cam.cosP * zoom;
          const x = e.x + (rnd() - 0.5) * 10 * zoom;
          ctx.beginPath();
          ctx.moveTo(x, e.y);
          ctx.bezierCurveTo(x + 5 * zoom, e.y + len * 0.35, x - 5 * zoom, e.y + len * 0.7, x + (rnd() - 0.5) * 6 * zoom, e.y + len);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      return;
    }

    // ---- tufos de folhas, de trás para a frente, cada um com o seu contorno
    const j = (rnd() - 0.5) * 0.16; // cada árvore com um tom um pouco diferente
    const tone = (hex) => M.shade(hex, j);
    const col = { base: tone(colors.base), shade: tone(colors.shade), light: tone(colors.light), under: tone(colors.under) };
    const hi = M.shade(col.light, 0.22);
    const list = tufts.map((tf) => {
      const q = cam.p(tf.w);
      const lobes = [];
      const N = 8 + Math.floor(rnd() * 4);
      for (let i = 0; i < N; i++) lobes.push(0.8 + rnd() * 0.32);
      return { x: q.x, y: q.y, R: tf.R * zoom, sq: 0.84, lobes, phase: rnd() * M.TAU, depth: cam.depth(tf.w) };
    });
    list.sort((a, b) => a.depth - b.depth);
    for (const o of list) {
      const out = tuftPath(o);
      ctx.strokeStyle = CANOPY_INK;
      ctx.lineWidth = ink * 2.5;
      ctx.stroke(out);
      ctx.fillStyle = col.under;
      ctx.fill(out);
      ctx.save();
      ctx.clip(out);
      // o corpo do tufo (deslocado para a luz deixa o lado da sombra escuro) e a parte de cima clara
      ctx.fillStyle = col.base;
      ctx.fill(tuftPath(o, 0.86, L.x * o.R * 0.12, L.y * o.R * 0.12 - o.R * 0.04));
      ctx.fillStyle = col.light;
      ctx.fill(tuftPath(o, 0.5, L.x * o.R * 0.32, L.y * o.R * 0.32 - o.R * 0.06));
      // folhas: claras do lado da luz, escuras do lado da sombra; e uns vãos escuros
      const leaf = (x, y, len, rot, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, len, len * 0.42, rot, 0, M.TAU);
        ctx.fill();
      };
      const toLight = Math.atan2(L.y, L.x);
      for (let k = 0; k < 9; k++) {
        const a = toLight + (rnd() - 0.5) * 2.2;
        const d = o.R * (0.15 + rnd() * 0.55);
        leaf(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d * o.sq, o.R * (0.09 + rnd() * 0.05), rnd() * Math.PI, rnd() < 0.5 ? hi : col.light);
      }
      for (let k = 0; k < 6; k++) {
        const a = toLight + Math.PI + (rnd() - 0.5) * 2;
        const d = o.R * (0.3 + rnd() * 0.5);
        leaf(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d * o.sq, o.R * (0.08 + rnd() * 0.05), rnd() * Math.PI, col.shade);
      }
      ctx.fillStyle = CANOPY_INK;
      for (let k = 0; k < 2; k++) {
        const a = toLight + Math.PI + (rnd() - 0.5) * 1.3;
        const d = o.R * (0.45 + rnd() * 0.3);
        ctx.beginPath();
        ctx.ellipse(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d * o.sq, o.R * 0.09, o.R * 0.05, a, 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
      // folhas soltas na beirada de cima, quebrando o contorno
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
        const x = o.x + Math.cos(a) * o.R * 0.95;
        const y = o.y + Math.sin(a) * o.R * o.sq * 0.95;
        const len = o.R * (0.1 + rnd() * 0.05);
        const rot = a + Math.PI / 2 + (rnd() - 0.5) * 0.6;
        ctx.fillStyle = CANOPY_INK;
        ctx.beginPath();
        ctx.ellipse(x, y, len + ink, len * 0.45 + ink, rot, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = Math.sin(a - toLight) > 0 ? col.base : col.light;
        ctx.beginPath();
        ctx.ellipse(x, y, len, len * 0.45, rot, 0, M.TAU);
        ctx.fill();
      }
    }
    // cipós pendurados (só na mata)
    if (t.kind === 'mata') {
      const nv = Math.floor(rnd() * 3);
      for (let k = 0; k < nv; k++) {
        const o = list[Math.floor(rnd() * list.length)];
        const x = o.x + (rnd() - 0.5) * o.R;
        const y = o.y + o.R * o.sq * 0.75;
        const len = (60 + rnd() * 80) * cam.cosP * zoom;
        ctx.strokeStyle = CANOPY_INK;
        ctx.lineWidth = Math.max(1.5, 3 * zoom);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + 8 * zoom, y + len * 0.4, x - 8 * zoom, y + len * 0.7, x + 3 * zoom, y + len);
        ctx.stroke();
        ctx.strokeStyle = col.shade;
        ctx.lineWidth = Math.max(1, 1.6 * zoom);
        ctx.stroke();
        for (let f = 1; f < 4; f++) {
          ctx.fillStyle = col.base;
          ctx.beginPath();
          ctx.ellipse(x + (f % 2 ? 4 : -4) * zoom, y + len * (f / 4), 4 * zoom, 2 * zoom, f % 2 ? 0.5 : -0.5, 0, M.TAU);
          ctx.fill();
        }
      }
    }
  }

  // ------------------------------------------------------------------ poste de concreto
  class Pole extends Prop {
    constructor(world, p) {
      super(world, { x0: p.x - 16, x1: p.x + 16, y0: p.y - 16, y1: p.y + 16 }, { fades: false });
      this.p = p;
      this.h = p.h || 880;
      this.collider = { type: 'circle', x: p.x, y: p.y, r: 20 };
    }
    /** Pontas da cruzeta (onde os fios prendem). */
    wireAnchors() {
      const z = this.z0 + this.h - 60;
      return [-1, 0, 1].map((k) => ({ x: this.p.x + k * 60, y: this.p.y - k * 60, z: z + (k === 0 ? 30 : 0) }));
    }
    screenBox() {
      return bbox([this.P(this.p.x, this.p.y, this.z0), this.P(this.p.x, this.p.y, this.z0 + this.h + 40), this.P(this.p.x - 100, this.p.y + 100, this.z0 + this.h), this.P(this.p.x + 100, this.p.y - 100, this.z0 + this.h)], 30 * this.cam.zoom);
    }
    shadow(path) {
      lineShadow(path, this.cam, this.p.x, this.p.y, this.h, 12);
    }
    paint(ctx) {
      const cam = this.cam;
      const p = this.p;
      const z0 = this.z0;
      const ink = this.ink;
      const b = cam.p({ x: p.x, y: p.y, z: z0 });
      const t = cam.p({ x: p.x, y: p.y, z: z0 + this.h });
      const rb = 14 * cam.zoom;
      const rt = 8 * cam.zoom;
      const shape = [{ x: b.x - rb, y: b.y }, { x: t.x - rt, y: t.y }, { x: t.x + rt, y: t.y }, { x: b.x + rb, y: b.y }];
      poly(ctx, shape, null, INK, ink * 2.4);
      poly(ctx, shape, '#c3beb3');
      poly(ctx, [{ x: b.x + rb * 0.2, y: b.y }, { x: t.x + rt * 0.2, y: t.y }, { x: t.x + rt, y: t.y }, { x: b.x + rb, y: b.y }], '#9e998f');
      // furinhos do poste
      ctx.fillStyle = '#7f7a71';
      for (let k = 1; k < 8; k++) {
        const q = cam.p({ x: p.x, y: p.y, z: z0 + k * 95 });
        ctx.fillRect(q.x - 2 * cam.zoom, q.y, 4 * cam.zoom, 4 * cam.zoom);
      }
      // cruzeta com isoladores
      const za = z0 + this.h - 60;
      const a0 = cam.p({ x: p.x - 75, y: p.y + 75, z: za });
      const a1 = cam.p({ x: p.x + 75, y: p.y - 75, z: za });
      ctx.strokeStyle = INK;
      ctx.lineWidth = 9 * cam.zoom + ink * 2;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(a1.x, a1.y);
      ctx.stroke();
      ctx.strokeStyle = '#8a8378';
      ctx.lineWidth = 9 * cam.zoom;
      ctx.stroke();
      for (const an of this.wireAnchors()) {
        const q = cam.p(an);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(q.x, q.y - 6 * cam.zoom, 7 * cam.zoom + ink, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#e9e3d0';
        ctx.beginPath();
        ctx.arc(q.x, q.y - 6 * cam.zoom, 7 * cam.zoom, 0, M.TAU);
        ctx.fill();
      }
      if (p.transformer) {
        const q = cam.p({ x: p.x + 20, y: p.y + 20, z: z0 + this.h - 230 });
        const w = 38 * cam.zoom;
        const h = 90 * cam.zoom;
        ctx.fillStyle = INK;
        ctx.fillRect(q.x - w / 2 - ink * 1.4, q.y - h - ink * 1.4, w + ink * 2.8, h + ink * 2.8);
        ctx.fillStyle = '#8c949b';
        ctx.fillRect(q.x - w / 2, q.y - h, w, h);
        ctx.fillStyle = '#6c737a';
        ctx.fillRect(q.x + w * 0.1, q.y - h, w * 0.4, h);
      }
      if (p.lamp) {
        // braço com a luminária, para o lado da rua
        const s0 = cam.p({ x: p.x, y: p.y, z: z0 + this.h - 120 });
        const s1 = cam.p({ x: p.x, y: p.y + 170, z: z0 + this.h - 80 });
        ctx.strokeStyle = INK;
        ctx.lineWidth = 6 * cam.zoom + ink * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.quadraticCurveTo(s0.x, s1.y - 20 * cam.zoom, s1.x, s1.y);
        ctx.stroke();
        ctx.strokeStyle = '#7d786f';
        ctx.lineWidth = 6 * cam.zoom;
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(s1.x, s1.y + 6 * cam.zoom, 30 * cam.zoom + ink, 12 * cam.zoom + ink, -0.45, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#5b5e63';
        ctx.beginPath();
        ctx.ellipse(s1.x, s1.y + 6 * cam.zoom, 30 * cam.zoom, 12 * cam.zoom, -0.45, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#fff1bf';
        ctx.beginPath();
        ctx.ellipse(s1.x + 2 * cam.zoom, s1.y + 11 * cam.zoom, 18 * cam.zoom, 6 * cam.zoom, -0.45, 0, M.TAU);
        ctx.fill();
      }
      // a mata subindo pelo poste (planta da rua da Budega)
      if (p.vine && PD.city) PD.city.poleVine(ctx, cam, p, z0, this.h, ink);
    }
  }

  // ------------------------------------------------------------------ muro
  class Wall extends Prop {
    constructor(world, w) {
      super(world, { x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 }, { fades: w.h > 120 });
      this.w = w;
      this.collider = { type: 'box', x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 };
    }
    screenBox() {
      const w = this.w;
      const z = this.z0;
      return bbox([this.P(w.x0, w.y1, z), this.P(w.x1, w.y1, z), this.P(w.x1, w.y0, z), this.P(w.x0, w.y0, z + w.h), this.P(w.x1, w.y0, z + w.h), this.P(w.x0, w.y1, z + w.h)], 20 * this.cam.zoom);
    }
    shadow(path) {
      const w = this.w;
      boxShadow(path, this.cam, w.x0, w.x1, w.y0, w.y1, w.h);
    }
    paint(ctx) {
      const cam = this.cam;
      const w = this.w;
      const z0 = this.z0;
      box(ctx, cam, w.x0, w.x1, w.y0, w.y1, z0, z0 + w.h, { front: w.color, side: M.shade(w.color, -0.25), top: M.shade(w.color, 0.15) }, this.ink);
      if (!w.graffiti) return;
      const along = w.x1 - w.x0 > w.y1 - w.y0;
      const o = along ? { x: w.x0, y: w.y1, z: z0 + w.h } : { x: w.x1, y: w.y1, z: z0 + w.h };
      const dir = along ? { x: 1, y: 0 } : { x: 0, y: -1 };
      const L = along ? w.x1 - w.x0 : w.y1 - w.y0;
      onWall(ctx, cam, o, dir, () => {
        if (w.graffiti === 'cores') graffitiColors(ctx, L, w.h);
        else graffitiLetters(ctx, L, w.h);
      });
    }
  }
  function graffitiColors(ctx, L, H) {
    // mural: sol, ondas e uma arara estilizada (cores fortes, contorno grosso)
    const r = M.rng(55);
    const cols = ['#e8452c', '#f4b81b', '#2f6fd0', '#34a35b', '#e86a9a'];
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = cols[k % cols.length];
      ctx.beginPath();
      const y = 40 + k * 26;
      ctx.moveTo(0, y);
      for (let x = 0; x <= L; x += 20) ctx.lineTo(x, y + Math.sin(x / 50 + k) * 14);
      ctx.lineTo(L, y + 26);
      for (let x = L; x >= 0; x -= 20) ctx.lineTo(x, y + 26 + Math.sin(x / 50 + k + 0.4) * 14);
      ctx.closePath();
      ctx.globalAlpha = 0.85;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f7d23a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(L * 0.25, H * 0.42, 52, 0, M.TAU);
    ctx.fill();
    ctx.stroke();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * M.TAU;
      ctx.beginPath();
      ctx.moveTo(L * 0.25 + Math.cos(a) * 62, H * 0.42 + Math.sin(a) * 62);
      ctx.lineTo(L * 0.25 + Math.cos(a) * 82, H * 0.42 + Math.sin(a) * 82);
      ctx.stroke();
    }
    void r;
  }
  function graffitiLetters(ctx, L, H) {
    // letras de balão: PINDORAMA (o nome do jogo, sem marca de ninguém)
    ctx.save();
    ctx.font = `${Math.round(H * 0.5)}px ${FONT_SIGN}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = 'PINDORAMA';
    const x = L * 0.42;
    const y = H * 0.55;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 26;
    ctx.strokeStyle = INK;
    ctx.strokeText(text, x, y);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#f7f2e4';
    ctx.strokeText(text, x, y);
    const g = ctx.createLinearGradient(0, y - H * 0.25, 0, y + H * 0.25);
    g.addColorStop(0, '#2f8f5a');
    g.addColorStop(0.5, '#f4c21c');
    g.addColorStop(1, '#e0452c');
    ctx.fillStyle = g;
    ctx.fillText(text, x, y);
    ctx.restore();
    // pingos de tinta
    ctx.fillStyle = '#2f8f5a';
    for (let k = 0; k < 8; k++) ctx.fillRect(L * 0.12 + k * L * 0.09, H * 0.78, 6, 18 + (k % 3) * 10);
  }

  // ------------------------------------------------------------------ miudezas
  // pedra: tons da rocha (do lado escuro ao topo iluminado), musgo e a grama que cobre a base
  const ROCK = { dark: [74, 70, 64], light: [206, 200, 186], moss: ['#5d8a3e', '#46733a', '#7aa54d'], grass: ['#4b7c3a', '#3d6a32', '#5b8d43'] };

  class Small extends Prop {
    draw(ctx, time) {
      // móvel de dentro de casa (prateleira, geladeira, sofá, cama...): só com a casa cortada (herói dentro)
      let k = 1;
      if (this.house) {
        k = this.house.cutK || 0;
        if (k <= 0) return;
      }
      // o que se mexe (o Joaquim respirando) é desenhado a cada quadro, sem a imagem pronta
      if (this.fl && this.fl.live) {
        ctx.globalAlpha = this.alpha * k;
        this.fl.live(ctx, this.cam, this.d, this.z0, time);
        ctx.globalAlpha = 1;
        return;
      }
      const a = this.alpha;
      this.alpha = a * k;
      super.draw(ctx, time);
      this.alpha = a;
      if (this.d.kind === 'fogueira') this._flames(ctx, time);
    }
    constructor(world, d) {
      const fp = d.x0 !== undefined ? { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 } : { x0: d.x - (d.r || 30), x1: d.x + (d.r || 30), y0: d.y - (d.r || 30), y1: d.y + (d.r || 30) };
      // desenhos de fora: as plantas da mata (flora.js) e as coisas da rua (city.js)
      const fl = (PD.flora && PD.flora.small[d.kind]) || (PD.city && PD.city.small[d.kind]);
      super(world, fp, { fades: d.kind === 'banca' || !!(fl && fl.fades) });
      this.d = d;
      if (fl) {
        // desenho da flora: ela diz a altura, se segura o jogador e como desenha
        this.fl = fl;
        this.height = fl.height(d);
        // empilhado (o trem em cima do viaduto): com os pés se cruzando, o de baixo é desenhado antes (world.js)
        this.lift = fl.lift ? fl.lift(d) : 0;
        const r = d.r || 30;
        this.collider = fl.blocks ? { type: 'circle', x: d.x, y: d.y, r: r * fl.blocks } : null;
        return;
      }
      const r = d.r || 30;
      const decor = d.kind === 'aguape' || d.kind === 'capivara'; // enfeites: não seguram ninguém
      this.collider = decor ? null : d.x0 !== undefined ? { type: 'box', ...fp } : { type: 'circle', x: d.x, y: d.y, r: d.kind === 'arbusto' ? r * 0.8 : d.kind === 'pedra' ? r : d.kind === 'mesa' ? 60 : 22 };
      this.height = { banca: 250, orelhao: 230, lixeira: 95, hidrante: 70, mesa: 80, banco: d.material === 'concreto' ? 96 : 50, arbusto: (d.r || 60) * 1.1, pedra: (d.r || 40) * 0.8, 'poste-praca': (d.h || 340) + 40, 'tronco-caido': d.h || 60, aguape: 20, capivara: 60, carro: d.tree ? 520 : d.h || 140, fogueira: 40 }[d.kind] || 80;
    }
    screenBox() {
      if (this.fl && this.fl.box) return this.fl.box(this.cam, this.d, this.z0, this.height);
      const f = this.fp;
      const z = this.z0;
      const h = this.height + 60;
      const e = this.d.tree ? 140 : 0; // a copa da árvore do carro passa da caixa do carro
      return bbox([this.P(f.x0 - e, f.y1 + e, z), this.P(f.x1 + e, f.y0 - e, z), this.P(f.x1 + e, f.y1 + e, z), this.P(f.x0 - e, f.y0 - e, z + h), this.P(f.x1 + e, f.y0 - e, z + h), this.P(f.x0 - e, f.y1 + e, z + h)], 40 * this.cam.zoom);
    }
    shadow(path) {
      const f = this.fp;
      const d = this.d;
      if (this.fl) {
        if (this.fl.shadow) this.fl.shadow(path, this.cam, d, this.height);
        return;
      }
      if (d.kind === 'arbusto' || d.kind === 'pedra') circleShadow(path, this.cam, d.x, d.y, d.r * 0.9, this.height * 0.5);
      else if (d.kind === 'aguape') return; // boia na água: sem sombra
      else if (d.kind === 'capivara') circleShadow(path, this.cam, d.x, d.y, 42, 30);
      else if (d.kind === 'banca' || d.kind === 'banco' || d.kind === 'tronco-caido' || d.kind === 'carro') boxShadow(path, this.cam, f.x0, f.x1, f.y0, f.y1, this.height);
      else if (d.kind === 'lixeira' && d.weeds) boxShadow(path, this.cam, d.x - 24, d.x + 24, d.y - 24, d.y + 24, 86);
      else if (d.kind === 'fogueira') return; // o fogo clareia o chão (o clarão sai em _flames)
      else if (d.kind === 'mesa') circleShadow(path, this.cam, d.x, d.y, 45, 60);
      else lineShadow(path, this.cam, d.x, d.y, this.height, 12);
    }
    paint(ctx) {
      const cam = this.cam;
      const d = this.d;
      const z0 = this.z0;
      const ink = this.ink;
      const P = (x, y, z) => cam.p({ x, y, z });
      if (this.fl) {
        this.fl.paint(ctx, cam, d, z0, ink);
        return;
      }
      switch (d.kind) {
        case 'banca': {
          const f = this.fp;
          box(ctx, cam, f.x0, f.x1, f.y0, f.y1, z0, z0 + 230, { front: '#2f7a4f', side: '#245d3d', top: '#3c9461' }, ink);
          // revistas penduradas
          onWall(ctx, cam, { x: f.x0, y: f.y1, z: z0 + 230 }, { x: 1, y: 0 }, () => {
            const r = M.rng(8);
            for (let k = 0; k < 8; k++) {
              ctx.fillStyle = ['#e8452c', '#f4c21c', '#2f6fd0', '#f2efe6', '#e86a9a'][Math.floor(r() * 5)];
              ctx.fillRect(14 + k * 28, 70, 24, 34);
              ctx.fillRect(14 + k * 28, 112, 24, 34);
            }
            ctx.fillStyle = '#f7edd4';
            ctx.fillRect(10, 18, (f.x1 - f.x0) - 20, 34);
            ctx.fillStyle = INK;
            ctx.font = `30px ${FONT_SIGN}`;
            ctx.textAlign = 'center';
            ctx.fillText('JORNAIS E REVISTAS', (f.x1 - f.x0) / 2, 46);
          });
          // telhadinho que sai para a frente
          const roof = [P(f.x0 - 20, f.y0 - 10, z0 + 240), P(f.x1 + 30, f.y0 - 10, z0 + 240), P(f.x1 + 30, f.y1 + 50, z0 + 225), P(f.x0 - 20, f.y1 + 50, z0 + 225)];
          poly(ctx, roof, '#3c9461', INK, ink * 1.6);
          break;
        }
        case 'orelhao': {
          // orelhão: poste com a "concha" laranja
          const base = P(d.x, d.y, z0);
          const top = P(d.x, d.y, z0 + 150);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 9 * cam.zoom + ink * 2;
          ctx.beginPath();
          ctx.moveTo(base.x, base.y);
          ctx.lineTo(top.x, top.y);
          ctx.stroke();
          ctx.strokeStyle = '#8a8d93';
          ctx.lineWidth = 9 * cam.zoom;
          ctx.stroke();
          const c = P(d.x, d.y + 8, z0 + 175);
          const rx = 42 * cam.zoom;
          const ry = 58 * cam.zoom;
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, rx + ink * 1.6, ry + ink * 1.6, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#ef7d22';
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, rx, ry, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#c95e16';
          ctx.beginPath();
          ctx.ellipse(c.x + rx * 0.25, c.y + ry * 0.1, rx * 0.72, ry * 0.85, 0, 0, M.TAU);
          ctx.fill();
          // aparelho dentro
          ctx.fillStyle = '#3c3f46';
          ctx.fillRect(c.x - 10 * cam.zoom, c.y - 4 * cam.zoom, 20 * cam.zoom, 30 * cam.zoom);
          ctx.fillStyle = '#ffb35c';
          ctx.beginPath();
          ctx.ellipse(c.x - rx * 0.35, c.y - ry * 0.45, rx * 0.25, ry * 0.18, -0.5, 0, M.TAU);
          ctx.fill();
          break;
        }
        case 'lixeira': {
          if (d.weeds) {
            this._parkBin(ctx);
            break;
          }
          const top = P(d.x, d.y, z0 + 95);
          const base = P(d.x, d.y, z0);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 6 * cam.zoom + ink * 2;
          ctx.beginPath();
          ctx.moveTo(base.x, base.y);
          ctx.lineTo(base.x, top.y + 20 * cam.zoom);
          ctx.stroke();
          ctx.strokeStyle = '#6f7378';
          ctx.lineWidth = 6 * cam.zoom;
          ctx.stroke();
          const w = 22 * cam.zoom;
          const h = 42 * cam.zoom;
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.roundRect(top.x - w - ink * 1.5, top.y - ink * 1.5, 2 * w + ink * 3, h + ink * 3, 6 * cam.zoom);
          ctx.fill();
          ctx.fillStyle = '#f07c1c';
          ctx.beginPath();
          ctx.roundRect(top.x - w, top.y, 2 * w, h, 5 * cam.zoom);
          ctx.fill();
          ctx.fillStyle = '#c75f12';
          ctx.fillRect(top.x + w * 0.2, top.y + 3, w * 0.8, h - 6);
          ctx.fillStyle = '#2b2b30';
          ctx.fillRect(top.x - w * 0.7, top.y + 4 * cam.zoom, w * 1.4, 5 * cam.zoom);
          break;
        }
        case 'hidrante': {
          const base = P(d.x, d.y, z0);
          const w = 13 * cam.zoom;
          const h = 62 * cam.zoom;
          ctx.fillStyle = INK;
          ctx.fillRect(base.x - w - ink * 1.5, base.y - h - ink * 1.5, 2 * w + ink * 3, h + ink * 1.5);
          ctx.fillStyle = '#d53a2c';
          ctx.fillRect(base.x - w, base.y - h, 2 * w, h);
          ctx.fillStyle = '#a62a20';
          ctx.fillRect(base.x + w * 0.2, base.y - h, w * 0.8, h);
          ctx.fillStyle = '#f2c230';
          ctx.fillRect(base.x - w, base.y - h, 2 * w, 10 * cam.zoom);
          ctx.fillRect(base.x - w * 1.8, base.y - h * 0.6, w * 3.6, 9 * cam.zoom);
          break;
        }
        case 'mesa': {
          // mesa de plástico com duas cadeiras (sem marca)
          const chair = (cx, cy, col) => {
            const s = P(cx, cy, z0 + 45);
            const w = 20 * cam.zoom;
            ctx.fillStyle = INK;
            ctx.fillRect(s.x - w - ink, s.y - 40 * cam.zoom - ink, 2 * w + 2 * ink, 46 * cam.zoom + 2 * ink);
            ctx.fillStyle = col;
            ctx.fillRect(s.x - w, s.y - 40 * cam.zoom, 2 * w, 18 * cam.zoom);
            ctx.fillRect(s.x - w, s.y - 6 * cam.zoom, 2 * w, 12 * cam.zoom);
            ctx.fillStyle = M.shade(col, -0.25);
            ctx.fillRect(s.x - w, s.y + 6 * cam.zoom, 5 * cam.zoom, 30 * cam.zoom);
            ctx.fillRect(s.x + w - 5 * cam.zoom, s.y + 6 * cam.zoom, 5 * cam.zoom, 30 * cam.zoom);
          };
          chair(d.x - 55, d.y - 10, '#e4b21b');
          const top = P(d.x, d.y, z0 + 72);
          const leg = P(d.x, d.y, z0);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 8 * cam.zoom;
          ctx.beginPath();
          ctx.moveTo(leg.x, leg.y);
          ctx.lineTo(top.x, top.y);
          ctx.stroke();
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.ellipse(top.x, top.y, 46 * cam.zoom + ink, 23 * cam.zoom + ink, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#d6402f';
          ctx.beginPath();
          ctx.ellipse(top.x, top.y, 46 * cam.zoom, 23 * cam.zoom, 0, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#f06a55';
          ctx.beginPath();
          ctx.ellipse(top.x - 8 * cam.zoom, top.y - 4 * cam.zoom, 26 * cam.zoom, 11 * cam.zoom, 0, 0, M.TAU);
          ctx.fill();
          chair(d.x + 40, d.y + 55, '#e4b21b');
          break;
        }
        case 'banco': {
          const f = this.fp;
          if (d.material === 'concreto') {
            this._concreteBench(ctx);
            break;
          }
          if (d.angle === undefined) {
            box(ctx, cam, f.x0, f.x1, f.y0, f.y1, z0, z0 + 45, { front: '#bfb7a6', side: '#9b9383', top: '#d8d1c1' }, ink);
            break;
          }
          this._bench(ctx);
          break;
        }
        case 'fogueira':
          this._fireBase(ctx);
          break;
        case 'carro':
          this._car(ctx);
          break;
        case 'arbusto': {
          const r = M.rng(d.x + d.y);
          const circles = [];
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * M.TAU;
            const p = P(d.x + Math.cos(a) * d.r * 0.45, d.y + Math.sin(a) * d.r * 0.45, z0 + d.r * (0.45 + r() * 0.3));
            circles.push({ x: p.x, y: p.y, r: d.r * (0.42 + r() * 0.15) * cam.zoom });
          }
          const c = P(d.x, d.y, z0 + d.r * 0.8);
          circles.push({ x: c.x, y: c.y, r: d.r * 0.5 * cam.zoom });
          circles.sort((a, b) => a.y - b.y);
          // na mata o arbusto é mais escuro (e o da mata fechada, que segura o jogador, mais ainda)
          const leaf = d.wild ? (d.dense ? { base: '#244a2b', shade: '#16321d', light: '#356a3b' } : { base: '#2f6236', shade: '#1e4426', light: '#468a4a' }) : { base: '#5a9440', shade: '#3c6d2f', light: '#80b955' };
          blobCluster(ctx, circles, leaf, ink, cam.lightScreen);
          break;
        }
        case 'pedra': {
          this._rock(ctx);
          if (d.ancestral) this._rockGlyph(ctx);
          break;
        }
        case 'tronco-caido':
          this._log(ctx);
          break;
        case 'aguape':
          this._hyacinth(ctx);
          break;
        case 'capivara':
          this._capybara(ctx);
          break;
        case 'poste-praca': {
          if (d.off || d.bent || d.vine) {
            this._oldLamp(ctx);
            break;
          }
          const base = P(d.x, d.y, z0);
          const top = P(d.x, d.y, z0 + (d.h || 340));
          ctx.strokeStyle = INK;
          ctx.lineWidth = 8 * cam.zoom + ink * 2;
          ctx.beginPath();
          ctx.moveTo(base.x, base.y);
          ctx.lineTo(top.x, top.y);
          ctx.stroke();
          ctx.strokeStyle = '#2f4a3a';
          ctx.lineWidth = 8 * cam.zoom;
          ctx.stroke();
          const w = 18 * cam.zoom;
          ctx.fillStyle = INK;
          ctx.fillRect(top.x - w - ink, top.y - 44 * cam.zoom - ink, 2 * w + 2 * ink, 44 * cam.zoom + 2 * ink);
          ctx.fillStyle = d.light || '#ffe9a6';
          ctx.fillRect(top.x - w, top.y - 44 * cam.zoom, 2 * w, 44 * cam.zoom);
          ctx.fillStyle = '#2f4a3a';
          ctx.fillRect(top.x - w * 1.4, top.y - 52 * cam.zoom, w * 2.8, 9 * cam.zoom);
          break;
        }
      }
    }
  }
  /**
   * Pedra: rocha de contorno irregular e facetada. Um anel de base (enterrado uns centímetros) e um anel de cima menor;
   * as faces que a câmera vê ganham tom pela luz (topo claro, lado longe da luz escuro). Musgo no topo iluminado e
   * fiapos de grama cobrindo a base da frente, para ela parecer meio enterrada. Cada pedra sai diferente (pela posição).
   */
  Small.prototype._rock = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const ink = this.ink;
    const rnd = M.rng(Math.round(d.x * 13 + d.y * 7));
    const R = d.r || 40;
    const H = R * (0.7 + rnd() * 0.35);
    const N = 7;
    const rot = rnd() * M.TAU;
    const lean = { x: (rnd() - 0.5) * R * 0.3, y: (rnd() - 0.5) * R * 0.3 };
    const base = [];
    const top = [];
    for (let k = 0; k < N; k++) {
      const a = rot + (k / N) * M.TAU + (rnd() - 0.5) * 0.45;
      const rb = R * (0.82 + rnd() * 0.22);
      const rt = rb * (0.42 + rnd() * 0.22);
      base.push({ x: d.x + Math.cos(a) * rb, y: d.y + Math.sin(a) * rb, z: z0 - 5 });
      top.push({ x: d.x + lean.x + Math.cos(a + 0.2) * rt, y: d.y + lean.y + Math.sin(a + 0.2) * rt, z: z0 + H * (0.78 + rnd() * 0.22) });
    }
    const crown = { x: d.x + lean.x * 1.2, y: d.y + lean.y * 1.2, z: z0 + H * 1.04 };
    // faces: lados (quadriláteros base→topo) e o topo em leque em volta da coroa
    const faces = [];
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N;
      faces.push([base[k], base[j], top[j], top[k]]);
      faces.push([top[k], top[j], crown]);
    }
    const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
    const center = { x: d.x, y: d.y, z: z0 + H * 0.4 };
    const shaded = [];
    for (const f of faces) {
      let n = cross(sub(f[1], f[0]), sub(f[2], f[0]));
      const c = f.reduce((acc, q) => ({ x: acc.x + q.x / f.length, y: acc.y + q.y / f.length, z: acc.z + q.z / f.length }), { x: 0, y: 0, z: 0 });
      const out = sub(c, center);
      if (n.x * out.x + n.y * out.y + n.z * out.z < 0) n = { x: -n.x, y: -n.y, z: -n.z }; // normal para fora
      const l = Math.hypot(n.x, n.y, n.z) || 1;
      n = { x: n.x / l, y: n.y / l, z: n.z / l };
      if (n.x * cam.toCamera.x + n.y * cam.toCamera.y + n.z * cam.toCamera.z <= 0) continue; // de costas para a câmera
      const lit = M.clamp01(0.5 + 0.6 * (n.x * cam.light.x + n.y * cam.light.y + n.z * cam.light.z));
      const tone = ROCK.dark.map((v, i) => Math.round(v + (ROCK.light[i] - v) * lit));
      shaded.push({ pts: f.map((q) => cam.p(q)), color: `rgb(${tone.join(',')})`, depth: cam.depth(c), up: n.z, lit });
    }
    shaded.sort((a, b) => a.depth - b.depth);
    // contorno: o casco de todos os pontos na tela
    const all = base.concat(top, [crown]).map((q) => cam.p(q));
    const hull = convexHull(all);
    poly(ctx, hull, ROCK_EDGE, INK, ink * 2.4);
    for (const f of shaded) {
      poly(ctx, f.pts, f.color);
      ctx.strokeStyle = 'rgba(27, 16, 13, 0.28)';
      ctx.lineWidth = Math.max(0.6, ink * 0.7);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    // musgo nas faces de cima, do lado da luz
    const tops = shaded.filter((f) => f.up > 0.45 && f.lit > 0.55);
    for (let k = 0; k < Math.min(4, tops.length); k++) {
      const f = tops[Math.floor(rnd() * tops.length)];
      const c = f.pts.reduce((acc, q) => ({ x: acc.x + q.x / f.pts.length, y: acc.y + q.y / f.pts.length }), { x: 0, y: 0 });
      ctx.fillStyle = ROCK.moss[k % ROCK.moss.length];
      ctx.beginPath();
      ctx.ellipse(c.x + (rnd() - 0.5) * R * 0.25 * zoom, c.y + (rnd() - 0.5) * R * 0.12 * zoom, R * (0.12 + rnd() * 0.1) * zoom, R * (0.07 + rnd() * 0.05) * zoom, 0, 0, M.TAU);
      ctx.fill();
    }
    // fiapos de grama na base da frente (a pedra parece meio enterrada)
    ctx.lineCap = 'round';
    const depth0 = cam.depth({ x: d.x, y: d.y, z: z0 });
    for (let k = 0; k < N; k++) {
      const q = base[k];
      if (cam.depth(q) < depth0) continue;
      const j = (k + 1) % N;
      for (let b = 0; b < 3; b++) {
        const u = rnd();
        const g = { x: q.x + (base[j].x - q.x) * u, y: q.y + (base[j].y - q.y) * u, z: z0 };
        const p0 = cam.p(g);
        const hgt = (7 + rnd() * 9) * zoom;
        ctx.strokeStyle = ROCK.grass[b % ROCK.grass.length];
        ctx.lineWidth = Math.max(1, 2.4 * zoom);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y + 1);
        ctx.quadraticCurveTo(p0.x + (rnd() - 0.5) * 4 * zoom, p0.y - hgt * 0.6, p0.x + (rnd() - 0.5) * 7 * zoom, p0.y - hgt);
        ctx.stroke();
      }
    }
  };
  const ROCK_EDGE = '#5f5a52';

  const WOOD = { top: '#b5875a', front: '#9a6b42', side: '#7a5232', leg: '#4a3a2c' };
  /** Banco de madeira de praça: assento de tábuas e encosto do lado contrário de `olhando` (para onde quem senta olha). */
  Small.prototype._bench = function (ctx) {
    const cam = this.cam;
    const f = this.fp;
    const z0 = this.z0;
    const ink = this.ink;
    const a = (((this.d.angle % 360) + 360) % 360);
    const alongX = f.x1 - f.x0 >= f.y1 - f.y0;
    const legs = alongX
      ? [[f.x0 + 14, f.x0 + 24], [f.x1 - 24, f.x1 - 14]].map(([x0, x1]) => ({ x0, x1, y0: f.y0 + 8, y1: f.y1 - 8 }))
      : [[f.y0 + 14, f.y0 + 24], [f.y1 - 24, f.y1 - 14]].map(([y0, y1]) => ({ x0: f.x0 + 8, x1: f.x1 - 8, y0, y1 }));
    for (const l of legs) box(ctx, cam, l.x0, l.x1, l.y0, l.y1, z0, z0 + 40, { front: WOOD.leg, side: WOOD.leg, top: WOOD.leg }, ink);
    // o encosto fica do lado de trás: olhando para o sul (90°), as costas ficam no norte (y0), e assim por diante
    const back = alongX ? (a > 180 ? 'y1' : 'y0') : (a > 90 && a < 270 ? 'x1' : 'x0');
    const rest = { ...f };
    if (back === 'y0') rest.y1 = f.y0 + 8;
    if (back === 'y1') rest.y0 = f.y1 - 8;
    if (back === 'x0') rest.x1 = f.x0 + 8;
    if (back === 'x1') rest.x0 = f.x1 - 8;
    const drawRest = () => box(ctx, cam, rest.x0, rest.x1, rest.y0, rest.y1, z0 + 48, z0 + 88, { front: WOOD.front, side: WOOD.side, top: WOOD.top }, ink);
    // o encosto de trás (longe da câmera) vem antes do assento; o da frente, depois
    const restFirst = back === 'y0' || back === 'x0';
    if (restFirst) drawRest();
    const seat = box(ctx, cam, f.x0, f.x1, f.y0, f.y1, z0 + 40, z0 + 47, { front: WOOD.front, side: WOOD.side, top: WOOD.top }, ink);
    // frestas entre as tábuas do assento
    ctx.strokeStyle = 'rgba(60, 40, 24, 0.55)';
    ctx.lineWidth = Math.max(0.8, 1.4 * cam.zoom);
    for (let k = 1; k < 3; k++) {
      const u = k / 3;
      const p0 = alongX ? cam.p({ x: f.x0, y: f.y0 + (f.y1 - f.y0) * u, z: z0 + 47 }) : cam.p({ x: f.x0 + (f.x1 - f.x0) * u, y: f.y0, z: z0 + 47 });
      const p1 = alongX ? cam.p({ x: f.x1, y: f.y0 + (f.y1 - f.y0) * u, z: z0 + 47 }) : cam.p({ x: f.x0 + (f.x1 - f.x0) * u, y: f.y1, z: z0 + 47 });
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    void seat;
    if (!restFirst) drawRest();
  };

  // concreto velho do parque (lado da frente, lado de lado, topo) e o musgo em cima dele
  const CONCRETE_OLD = { front: '#aea89a', side: '#8f897c', top: '#c4beb0' };
  /** Manchas de musgo num quadrilátero do topo (pontos na tela). */
  function mossPatches(ctx, quad, rnd, n, zoom) {
    for (let k = 0; k < n; k++) {
      const u = rnd(), v = rnd();
      const a = quad[0], b = quad[1], c = quad[2], dd = quad[3];
      const x = (a.x * (1 - u) + b.x * u) * (1 - v) + (dd.x * (1 - u) + c.x * u) * v;
      const y = (a.y * (1 - u) + b.y * u) * (1 - v) + (dd.y * (1 - u) + c.y * u) * v;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(86, 128, 58, 0.85)' : 'rgba(64, 104, 48, 0.8)';
      ctx.beginPath();
      ctx.ellipse(x, y, (4 + rnd() * 6) * zoom, (2 + rnd() * 3) * zoom, rnd() * 3, 0, M.TAU);
      ctx.fill();
    }
  }
  /**
   * Banco de concreto do parque antigo: dois pés de laje, o assento e o encosto (do lado de trás, pelo `olhando`),
   * musgo em cima, uma quina lascada, trinca e capim nos pés.
   */
  Small.prototype._concreteBench = function (ctx) {
    const cam = this.cam;
    const f = this.fp;
    const d = this.d;
    const z0 = this.z0;
    const ink = this.ink;
    const rnd = M.rng(Math.round(f.x0 * 3 + f.y0 * 7));
    const a = ((((d.angle || 90) % 360) + 360) % 360);
    const alongX = f.x1 - f.x0 >= f.y1 - f.y0;
    const C = CONCRETE_OLD;
    // pés: duas lajes em pé nas pontas
    const legs = alongX
      ? [[f.x0 + 8, f.x0 + 22], [f.x1 - 22, f.x1 - 8]].map(([x0, x1]) => ({ x0, x1, y0: f.y0 + 4, y1: f.y1 - 4 }))
      : [[f.y0 + 8, f.y0 + 22], [f.y1 - 22, f.y1 - 8]].map(([y0, y1]) => ({ x0: f.x0 + 4, x1: f.x1 - 4, y0, y1 }));
    const grass = (x, y) => PD.city && PD.city.grass && PD.city.grass(ctx, cam.p({ x, y, z: z0 }), 22 * cam.zoom, rnd, ink);
    if (d.weeds) for (const l of legs) grass((l.x0 + l.x1) / 2 - 10, (l.y0 + l.y1) / 2 - 10);
    for (const l of legs) box(ctx, cam, l.x0, l.x1, l.y0, l.y1, z0, z0 + 42, C, ink);
    // o encosto fica do lado de trás: olhando para o sul (90°), as costas ficam no norte (y0), e assim por diante
    const back = alongX ? (a > 180 ? 'y1' : 'y0') : (a > 90 && a < 270 ? 'x1' : 'x0');
    const rest = { ...f };
    if (back === 'y0') rest.y1 = f.y0 + 10;
    if (back === 'y1') rest.y0 = f.y1 - 10;
    if (back === 'x0') rest.x1 = f.x0 + 10;
    if (back === 'x1') rest.x0 = f.x1 - 10;
    const drawRest = () => {
      const r = box(ctx, cam, rest.x0, rest.x1, rest.y0, rest.y1, z0 + 50, z0 + 96, C, ink);
      if (d.weeds) mossPatches(ctx, r.top, rnd, 4, cam.zoom);
    };
    const restFirst = back === 'y0' || back === 'x0';
    if (restFirst) drawRest();
    const seat = box(ctx, cam, f.x0, f.x1, f.y0, f.y1, z0 + 42, z0 + 51, C, ink);
    if (d.weeds) mossPatches(ctx, seat.top, rnd, 6, cam.zoom);
    // trinca no assento e uma quina lascada (o pedaço que falta, escuro)
    const q = seat.top;
    ctx.strokeStyle = 'rgba(70, 64, 56, 0.7)';
    ctx.lineWidth = Math.max(0.8, 1.2 * cam.zoom);
    ctx.beginPath();
    const t0 = 0.3 + rnd() * 0.4;
    ctx.moveTo(q[0].x + (q[1].x - q[0].x) * t0, q[0].y + (q[1].y - q[0].y) * t0);
    ctx.lineTo(q[3].x + (q[2].x - q[3].x) * (t0 + 0.08), q[3].y + (q[2].y - q[3].y) * (t0 + 0.08));
    ctx.stroke();
    const chip = seat.fy[1];
    ctx.fillStyle = '#6f6a60';
    ctx.beginPath();
    ctx.moveTo(chip.x, chip.y);
    ctx.lineTo(chip.x - 9 * cam.zoom, chip.y - 2 * cam.zoom);
    ctx.lineTo(chip.x - 3 * cam.zoom, chip.y - 7 * cam.zoom);
    ctx.closePath();
    ctx.fill();
    if (!restFirst) drawRest();
    if (d.weeds) for (const l of legs) grass((l.x0 + l.x1) / 2 + 12, (l.y0 + l.y1) / 2 + 12);
  };

  /** Lixeira verde do parque (caixa com tampa e a boca escura na frente), suja de ferrugem, com capim em volta. */
  Small.prototype._parkBin = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0;
    const ink = this.ink;
    const rnd = M.rng(Math.round(d.x * 5 + d.y * 3));
    const s = 22;
    const grass = (x, y, k) => PD.city && PD.city.grass && PD.city.grass(ctx, cam.p({ x, y, z: z0 }), k * cam.zoom, rnd, ink);
    grass(d.x - 14, d.y - 18, 20);
    const body = box(ctx, cam, d.x - s, d.x + s, d.y - s, d.y + s, z0, z0 + 76, { front: '#3f6b4c', side: '#2f523a', top: '#4d7d5a' }, ink);
    const lid = box(ctx, cam, d.x - s - 3, d.x + s + 3, d.y - s - 3, d.y + s + 3, z0 + 76, z0 + 86, { front: '#355c41', side: '#284632', top: '#4a7656' }, ink);
    // a boca escura na frente (+y), em cima
    const P = (x, y, z) => cam.p({ x, y, z });
    const mouth = [P(d.x - s + 7, d.y + s, z0 + 70), P(d.x + s - 7, d.y + s, z0 + 70), P(d.x + s - 7, d.y + s, z0 + 56), P(d.x - s + 7, d.y + s, z0 + 56)];
    poly(ctx, mouth, '#15201a');
    // ferrugem e sujeira escorrendo
    for (let k = 0; k < 5; k++) {
      const u = rnd();
      const q = P(d.x - s + u * 2 * s, d.y + s, z0 + 8 + rnd() * 50);
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(140, 84, 40, 0.55)' : 'rgba(60, 52, 36, 0.45)';
      ctx.fillRect(q.x, q.y, 2.4 * cam.zoom, (6 + rnd() * 12) * cam.zoom);
    }
    mossPatches(ctx, lid.top, rnd, 3, cam.zoom);
    void body;
    grass(d.x + 18, d.y + 22, 24);
    grass(d.x - 22, d.y + 20, 18);
  };

  /** Poste velho do parque: torto (inclinado para um lado), apagado (vidro escuro e trincado) e com cipó subindo. */
  Small.prototype._oldLamp = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0;
    const ink = this.ink;
    const rnd = M.rng(Math.round(d.x * 11 + d.y * 3));
    const h = d.h || 340;
    const lean = d.bent ? 22 + rnd() * 14 : 0;
    const la = rnd() * M.TAU;
    const tx = d.x + Math.cos(la) * lean, ty = d.y + Math.sin(la) * lean;
    const base = cam.p({ x: d.x, y: d.y, z: z0 });
    const top = cam.p({ x: tx, y: ty, z: z0 + h });
    // base de concreto
    box(ctx, cam, d.x - 12, d.x + 12, d.y - 12, d.y + 12, z0, z0 + 16, CONCRETE_OLD, ink);
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7 * cam.zoom + ink * 2;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    ctx.strokeStyle = '#3a4a40';
    ctx.lineWidth = 7 * cam.zoom;
    ctx.stroke();
    // ferrugem no cano
    for (let k = 0; k < 4; k++) {
      const u = 0.1 + rnd() * 0.8;
      ctx.fillStyle = 'rgba(140, 84, 40, 0.7)';
      ctx.beginPath();
      ctx.ellipse(base.x + (top.x - base.x) * u, base.y + (top.y - base.y) * u, 3 * cam.zoom, 2 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
    }
    // a luminária: caixa com o vidro escuro (apagada) e trinca, o chapéu em cima
    const w = 16 * cam.zoom, hh = 38 * cam.zoom;
    ctx.fillStyle = INK;
    ctx.fillRect(top.x - w - ink, top.y - hh - ink, 2 * w + 2 * ink, hh + 2 * ink);
    ctx.fillStyle = d.off ? '#3d464c' : d.light || '#ffe9a6';
    ctx.fillRect(top.x - w, top.y - hh, 2 * w, hh);
    if (d.off) {
      ctx.strokeStyle = 'rgba(200, 210, 214, 0.6)';
      ctx.lineWidth = Math.max(0.8, 1.2 * cam.zoom);
      ctx.beginPath();
      ctx.moveTo(top.x - w * 0.4, top.y - hh * 0.8);
      ctx.lineTo(top.x + w * 0.1, top.y - hh * 0.45);
      ctx.lineTo(top.x - w * 0.2, top.y - hh * 0.15);
      ctx.moveTo(top.x + w * 0.1, top.y - hh * 0.45);
      ctx.lineTo(top.x + w * 0.6, top.y - hh * 0.55);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(top.x - w * 0.8, top.y - hh * 0.95, w * 0.35, hh * 0.85);
    }
    ctx.fillStyle = INK;
    ctx.fillRect(top.x - w * 1.45 - ink, top.y - hh - 8 * cam.zoom - ink, w * 2.9 + 2 * ink, 9 * cam.zoom + 2 * ink);
    ctx.fillStyle = '#34443a';
    ctx.fillRect(top.x - w * 1.45, top.y - hh - 8 * cam.zoom, w * 2.9, 9 * cam.zoom);
    if (d.vine && PD.city && PD.city.vine) {
      // cipó enrolando no cano até perto da luminária, e um pedaço pendurado do chapéu
      const pts = [];
      for (let j = 0; j <= 12; j++) {
        const u = (j / 12) * 0.9;
        const wob = Math.sin(j * 1.7) * 5 * cam.zoom;
        pts.push({ x: base.x + (top.x - base.x) * u + wob, y: base.y + (top.y - base.y) * u });
      }
      PD.city.vine(ctx, pts, rnd, cam.zoom, ink);
      const hang = [];
      for (let j = 0; j <= 5; j++) hang.push({ x: top.x + w * 1.2 + Math.sin(j) * 2 * cam.zoom, y: top.y - hh - 4 * cam.zoom + j * 9 * cam.zoom });
      PD.city.vine(ctx, hang, rnd, cam.zoom, ink);
    }
  };

  /** Fogueira (a parte parada, que vai no desenho guardado): roda de pedras, lenha cruzada, brasa e cinza. */
  Small.prototype._fireBase = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0;
    const ink = this.ink;
    const R = d.r || 60;
    const rnd = M.rng(Math.round(d.x * 7 + d.y));
    // cinza e brasa no meio
    const c = cam.p({ x: d.x, y: d.y, z: z0 + 2 });
    ctx.fillStyle = '#3a3330';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, R * 0.7 * cam.zoom, R * 0.7 * cam.sinP * cam.zoom, 0, 0, M.TAU);
    ctx.fill();
    ctx.fillStyle = '#c4451c';
    for (let k = 0; k < 9; k++) {
      ctx.beginPath();
      ctx.ellipse(c.x + (rnd() - 0.5) * R * 0.8 * cam.zoom, c.y + (rnd() - 0.5) * R * 0.4 * cam.zoom, 4 * cam.zoom, 2.4 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
    }
    // lenha cruzada
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI + rnd() * 0.3;
      const p0 = cam.p({ x: d.x + Math.cos(a) * R * 0.62, y: d.y + Math.sin(a) * R * 0.62, z: z0 + 6 });
      const p1 = cam.p({ x: d.x - Math.cos(a) * R * 0.62, y: d.y - Math.sin(a) * R * 0.62, z: z0 + 18 });
      for (const [color, w] of [[INK, 10 * cam.zoom + ink * 2], ['#5a3e28', 10 * cam.zoom], ['#2b201a', 4 * cam.zoom]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }
    // roda de pedras (as de trás antes)
    const stones = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * M.TAU + rnd() * 0.2;
      const q = { x: d.x + Math.cos(a) * R, y: d.y + Math.sin(a) * R, z: z0 + 6 };
      stones.push({ q, r: 9 + rnd() * 5, depth: cam.depth(q) });
    }
    stones.sort((p, q) => p.depth - q.depth);
    for (const st of stones) {
      const p = cam.p(st.q);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, st.r * cam.zoom + ink, st.r * 0.75 * cam.zoom + ink, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#8c877d';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, st.r * cam.zoom, st.r * 0.75 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#b3ada1';
      ctx.beginPath();
      ctx.ellipse(p.x - st.r * 0.25 * cam.zoom, p.y - st.r * 0.25 * cam.zoom, st.r * 0.5 * cam.zoom, st.r * 0.3 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
    }
  };
  /** Fogueira acesa (a cada quadro, por cima do desenho guardado): clarão no chão, chamas que tremem e faíscas subindo. */
  Small.prototype._flames = function (ctx, time) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0;
    const R = d.r || 60;
    const z = cam.zoom;
    const c = cam.p({ x: d.x, y: d.y, z: z0 + 10 });
    const t = time || 0;
    // clarão quente no chão (some e volta um pouco)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1);
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R * 4 * z);
    g.addColorStop(0, `rgba(255, 150, 60, ${0.28 * flick})`);
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, R * 4 * z, R * 4 * z * cam.sinP, 0, 0, M.TAU);
    ctx.fill();
    ctx.restore();
    // chamas: línguas de fogo (de fora para dentro: laranja, amarelo, quase branco)
    const tongues = [[-0.35, 0.8, 0], [0.3, 0.9, 1.7], [0, 1.25, 3.1], [-0.1, 0.7, 4.4], [0.45, 0.6, 5.2]];
    for (const [layer, color, scale] of [[0, '#ff7a24', 1], [1, '#ffc23a', 0.68], [2, '#fff0b0', 0.36]]) {
      ctx.fillStyle = color;
      for (const [ox, hgt, ph] of tongues) {
        const h = (55 + 25 * Math.sin(t * 9 + ph) + 10 * Math.sin(t * 17 + ph * 2)) * hgt * scale * z;
        const w = R * 0.32 * scale * z * (1 + 0.15 * Math.sin(t * 11 + ph));
        const bx = c.x + ox * R * 0.7 * z;
        const sway = Math.sin(t * 6 + ph) * w * 0.5;
        ctx.beginPath();
        ctx.moveTo(bx - w, c.y);
        ctx.quadraticCurveTo(bx - w * 0.9, c.y - h * 0.55, bx + sway, c.y - h);
        ctx.quadraticCurveTo(bx + w * 0.9, c.y - h * 0.55, bx + w, c.y);
        ctx.closePath();
        ctx.fill();
      }
      void layer;
    }
    // faíscas
    ctx.fillStyle = '#ffd36b';
    for (let k = 0; k < 5; k++) {
      const life = (t * 0.7 + k * 0.21) % 1;
      const px = c.x + Math.sin(k * 3.7 + t * 2) * R * 0.5 * z;
      const py = c.y - (60 + life * 160) * z;
      ctx.globalAlpha = 1 - life;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1, 2.2 * z), 0, M.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  /**
   * Carro largado: carroceria e cabine em caixas, vidros escuros (um quebrado), pneus murchos, ferrugem e o mato que
   * tomou conta (tufos no capô e no teto, capim em volta). Deitado no lado comprido da caixa.
   */
  /**
   * Carro largado (a cidade tomada pela mata; o dono pediu "arruma esse carro", que parecia duas caixas): perfil de
   * sedã esticado na largura (porta-malas, vidro de trás, teto, para-brisa e capô), portas e maçanetas, vidros (um
   * quebrado), faróis, rodas murchas, ferrugem; com `mato`, musgo no teto e no capô, cipó por cima e capim em volta;
   * com `arvore`, uma árvore saindo por um buraco no teto. A frente aponta para +x (ou +y).
   */
  Small.prototype._car = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0;
    const ink = this.ink;
    const f = this.fp;
    const rnd = M.rng(Math.round(f.x0 * 3 + f.y0 * 5));
    const alongX = f.x1 - f.x0 >= f.y1 - f.y0;
    const H = d.h || 140;
    const body = d.color || '#a8473e';
    const Lc = alongX ? f.x1 - f.x0 : f.y1 - f.y0;
    const Wc = alongX ? f.y1 - f.y0 : f.x1 - f.x0;
    const vN = Wc - 8, vF = 8; // o lado de perto (virado para a câmera) e o de longe
    const W3 = (u, v, z) => (alongX ? { x: f.x0 + u, y: f.y0 + v, z: z0 + z } : { x: f.x0 + v, y: f.y0 + u, z: z0 + z });
    const P = (u, v, z) => cam.p(W3(u, v, z));
    const zb = 26; // a barra de baixo (as rodas murchas deixam o carro baixo)
    const prof = [[0, zb], [0, 0.56 * H], [0.17 * Lc, 0.6 * H], [0.27 * Lc, 0.63 * H], [0.37 * Lc, H], [0.63 * Lc, H], [0.75 * Lc, 0.64 * H], [0.95 * Lc, 0.57 * H], [Lc, 0.5 * H], [Lc, zb]];
    const tc = cam.toCamera;
    const uDir = alongX ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const C = { side: M.shade(body, -0.22), top: M.shade(body, 0.1), end: body };
    const glassC = '#2b3640';
    // rodas: as de longe antes do carro (só a parte de baixo aparece), as de perto depois
    const wheel = (uc, v) => {
      const r = 30, zc = 24;
      const out = [], rim = [];
      for (let i = 0; i < 24; i++) {
        const t = (i / 24) * M.TAU;
        out.push(P(uc + Math.cos(t) * r, v, Math.max(0, zc + Math.sin(t) * r * 0.92)));
        rim.push(P(uc + Math.cos(t) * r * 0.55, v + 1, zc + Math.sin(t) * r * 0.55));
      }
      poly(ctx, out, null, INK, ink * 2);
      poly(ctx, out, '#252322');
      poly(ctx, rim, '#6d665e');
      ctx.fillStyle = 'rgba(128, 74, 38, 0.55)';
      const c = P(uc, v + 1, zc);
      ctx.beginPath();
      ctx.arc(c.x + 3 * cam.zoom, c.y + 2 * cam.zoom, 6 * cam.zoom, 0, M.TAU);
      ctx.fill();
    };
    const wheelsU = [0.18 * Lc, 0.8 * Lc];
    for (const u of wheelsU) wheel(u, vF + 6);
    // as faces de cima (do perfil), as que a câmera vê, da mais longe para a mais perto
    const faces = [];
    for (let i = 0; i + 1 < prof.length; i++) {
      const [ua, za] = prof[i], [ub, zb2] = prof[i + 1];
      const du = ub - ua, dz = zb2 - za;
      const nu = -dz, nz = du; // normal para fora (o perfil anda de trás para a frente por cima)
      const dot = nu * (uDir.x * tc.x + uDir.y * tc.y) + nz * tc.z;
      if (dot <= 0 || (du === 0 && dz === 0)) continue;
      const quad = [P(ua, vF, za), P(ub, vF, zb2), P(ub, vN, zb2), P(ua, vN, za)];
      faces.push({ i, quad, depth: cam.depth(W3((ua + ub) / 2, (vF + vN) / 2, (za + zb2) / 2)), steep: Math.abs(dz) > Math.abs(du) });
    }
    faces.sort((a, b) => a.depth - b.depth);
    const glassFace = (i) => i === 3 || i === 5; // vidro de trás e para-brisa
    for (const fc of faces) {
      const col = glassFace(fc.i) ? glassC : fc.i === 8 ? C.end : fc.i === 0 ? C.end : C.top;
      poly(ctx, fc.quad, col, INK, ink * 2);
    }
    // o lado de perto: o perfil inteiro
    const side = prof.map(([u, z]) => P(u, vN, z));
    poly(ctx, side, C.side, INK, ink * 2.2);
    ctx.save();
    poly(ctx, side);
    ctx.clip();
    // caixas de roda escuras, frisos das portas, maçanetas e ferrugem
    for (const u of wheelsU) {
      const arc = [];
      for (let i = 0; i <= 12; i++) {
        const t = Math.PI + (i / 12) * Math.PI;
        arc.push(P(u + Math.cos(t) * 40, vN, 24 + Math.sin(-t) * 40));
      }
      poly(ctx, arc, '#1c1a19');
    }
    ctx.strokeStyle = M.shade(body, -0.45);
    ctx.lineWidth = Math.max(1, 1.6 * cam.zoom);
    ctx.beginPath();
    for (const u of [0.38 * Lc, 0.61 * Lc]) {
      const a = P(u, vN, zb + 6), b = P(u, vN, 0.63 * H);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    const r0 = P(0.02 * Lc, vN, 0.4 * H), r1 = P(0.98 * Lc, vN, 0.4 * H);
    ctx.moveTo(r0.x, r0.y);
    ctx.lineTo(r1.x, r1.y);
    ctx.stroke();
    ctx.fillStyle = '#2a2624';
    for (const u of [0.46 * Lc, 0.68 * Lc]) {
      const q = P(u, vN, 0.55 * H);
      ctx.fillRect(q.x - 5 * cam.zoom, q.y - 1.5 * cam.zoom, 10 * cam.zoom, 3 * cam.zoom);
    }
    ctx.fillStyle = 'rgba(122, 66, 32, 0.5)';
    for (let k = 0; k < 7; k++) {
      const q = P(rnd() * Lc, vN, zb + rnd() * H * 0.35);
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, (6 + rnd() * 12) * cam.zoom, (4 + rnd() * 6) * cam.zoom, rnd() * 3, 0, M.TAU);
      ctx.fill();
    }
    ctx.restore();
    // vidros do lado (o da frente às vezes quebrado)
    const win = (pts, broken) => {
      const q = pts.map(([u, z]) => P(u, vN + 1, z));
      poly(ctx, q, broken ? '#14171a' : glassC, INK, ink * 1.4);
      const cx = q.reduce((a, p) => a + p.x, 0) / q.length, cy = q.reduce((a, p) => a + p.y, 0) / q.length;
      if (broken) {
        ctx.strokeStyle = 'rgba(200, 215, 225, 0.55)';
        ctx.lineWidth = Math.max(0.8, 1.2 * cam.zoom);
        ctx.beginPath();
        for (const p of q) {
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + (p.x - cx) * 0.85, cy + (p.y - cy) * 0.85);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.beginPath();
        ctx.moveTo(q[0].x * 0.6 + q[1].x * 0.4, q[0].y * 0.6 + q[1].y * 0.4);
        ctx.lineTo(q[1].x * 0.5 + q[2].x * 0.5, q[1].y * 0.5 + q[2].y * 0.5);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fill();
      }
    };
    win([[0.29 * Lc, 0.66 * H], [0.38 * Lc, 0.95 * H], [0.49 * Lc, 0.95 * H], [0.49 * Lc, 0.66 * H]], false);
    win([[0.51 * Lc, 0.66 * H], [0.51 * Lc, 0.95 * H], [0.62 * Lc, 0.95 * H], [0.72 * Lc, 0.66 * H]], rnd() < 0.6);
    // trincas no para-brisa, se a câmera vê ele
    const ws = faces.find((fc) => fc.i === 5);
    if (ws) {
      const q = ws.quad;
      const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4, cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
      ctx.strokeStyle = 'rgba(205, 220, 230, 0.55)';
      ctx.lineWidth = Math.max(0.8, 1.1 * cam.zoom);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = rnd() * M.TAU;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 18 * cam.zoom, cy + Math.sin(a) * 9 * cam.zoom);
      }
      ctx.stroke();
    }
    // farol e grade na frente (a frente é virada para +x ou +y: a câmera vê)
    for (const v of [vF + 18, vN - 18]) {
      const q = P(Lc + 1, v, 0.42 * H);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, 8 * cam.zoom + ink, 5 * cam.zoom + ink, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = v === vF + 18 ? '#bdb59a' : '#5a5648';
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, 8 * cam.zoom, 5 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
    }
    poly(ctx, [P(Lc + 1, vF + 32, 0.36 * H), P(Lc + 1, vN - 32, 0.36 * H), P(Lc + 1, vN - 32, 0.26 * H), P(Lc + 1, vF + 32, 0.26 * H)], '#2a2725', INK, ink);
    for (const u of wheelsU) wheel(u, vN + 2);
    // a mata tomando o carro: musgo no teto e no capô, cipó por cima, capim em volta
    if (d.weeds) {
      const MOSS = ['rgba(70, 106, 48, 0.75)', 'rgba(88, 126, 58, 0.7)', 'rgba(56, 88, 40, 0.75)'];
      for (const fc of faces) {
        if (fc.i !== 4 && fc.i !== 7 && fc.i !== 2) continue;
        ctx.save();
        poly(ctx, fc.quad);
        ctx.clip();
        const q = fc.quad;
        for (let k = 0; k < 9; k++) {
          const a = rnd(), b = rnd();
          const x = q[0].x + (q[1].x - q[0].x) * a + (q[3].x - q[0].x) * b;
          const y = q[0].y + (q[1].y - q[0].y) * a + (q[3].y - q[0].y) * b;
          ctx.fillStyle = MOSS[Math.floor(rnd() * MOSS.length)];
          ctx.beginPath();
          ctx.ellipse(x, y, (8 + rnd() * 14) * cam.zoom, (5 + rnd() * 8) * cam.zoom, rnd() * 3, 0, M.TAU);
          ctx.fill();
        }
        ctx.restore();
      }
      if (PD.city) {
        const pts = [];
        for (let k = 0; k <= 9; k++) pts.push(P(0.1 * Lc + k * 0.09 * Lc, vN - 4 - Math.sin(k) * 10, (k < 3 || k > 7 ? 0.62 * H : H + 2) + Math.sin(k * 1.7) * 4));
        PD.city.vine(ctx, pts, rnd, cam.zoom, ink);
        for (const u of [0.05, 0.18, 0.32, 0.55, 0.8, 0.96]) PD.city.grass(ctx, P(u * Lc, vN + 10, 0), 26 * cam.zoom, rnd, ink);
      }
    }
    // uma árvore nascendo de dentro do carro: o tronco sai por um buraco no teto e a copa abre em cima
    if (d.tree) {
      const tu = 0.5 * Lc, tv = Wc / 2;
      const tp = W3(tu, tv, 0);
      const t = { x: tp.x, y: tp.y, kind: 'mata', r: 150, h: 430, trunk: 9 };
      const fork = { x: tp.x, y: tp.y, z: z0 + 20 + t.h * FORK };
      const hole = P(tu, tv, H);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(hole.x, hole.y, 24 * cam.zoom, 10 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#1a1614';
      ctx.beginPath();
      ctx.ellipse(hole.x, hole.y, 20 * cam.zoom, 8 * cam.zoom, 0, 0, M.TAU);
      ctx.fill();
      const b1 = cam.p(fork);
      const w0 = 11 * cam.zoom, w1 = 7 * cam.zoom;
      const trunkShape = [{ x: hole.x - w0, y: hole.y }, { x: b1.x - w1, y: b1.y }, { x: b1.x + w1, y: b1.y }, { x: hole.x + w0, y: hole.y }];
      poly(ctx, trunkShape, null, INK, ink * 2.2);
      poly(ctx, trunkShape, '#5a4532');
      crownPaint(ctx, cam, t, z0 + 20, ink, CANOPY.mata, false);
    }
  };


  /** Pedra do Véu (pedra ancestral): o mesmo símbolo da figueira, brilhando em verde-água na face da frente. */
  Small.prototype._rockGlyph = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const R = d.r || 120;
    const c = cam.p({ x: d.x + R * 0.45, y: d.y + R * 0.45, z: this.z0 + R * 0.42 });
    const z = cam.zoom;
    const r = R * 0.3 * z;
    ctx.save();
    ctx.shadowColor = '#3fd6c8';
    ctx.shadowBlur = 12 * z;
    ctx.strokeStyle = '#7ff5e6';
    ctx.lineWidth = Math.max(1.2, 3.4 * z);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - r);
    ctx.lineTo(c.x + r * 0.7, c.y);
    ctx.lineTo(c.x, c.y + r);
    ctx.lineTo(c.x - r * 0.7, c.y);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.25, 0, M.TAU);
    ctx.stroke();
    // riscos que saem do símbolo, como rachaduras acesas
    for (const [dx, dy] of [[-1.3, 0.5], [1.2, 0.7], [0.2, -1.4]]) {
      ctx.beginPath();
      ctx.moveTo(c.x + dx * r * 0.55, c.y + dy * r * 0.55);
      ctx.lineTo(c.x + dx * r * 1.05, c.y + dy * r * 1.05);
      ctx.stroke();
    }
    ctx.restore();
  };

  // tronco caído e capivara: tons de casca, madeira cortada e pelo
  const LOG = { base: '#5b4632', shade: '#3c2e21', light: '#7d654a', cut: '#c9a776', ring: '#9a7850', moss: ['#5d8a3e', '#46733a'] };
  const CAPY = { base: '#8a6a45', shade: '#68502f', light: '#a8865b', dark: '#3b2c1c', nose: '#4a3626' };

  /**
   * Tronco caído: um cilindro deitado ao longo do lado comprido da caixa (na tela, um cilindro tem sempre a largura do
   * diâmetro, de qualquer lado que se olhe: um traço grosso resolve o corpo). A ponta que fica virada para a câmera
   * mostra a madeira cortada com os anéis; musgo por cima e um toco de galho.
   */
  Small.prototype._log = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const ink = this.ink;
    const L = cam.lightScreen;
    const rnd = M.rng(Math.round(d.x0 * 5 + d.y0 * 9));
    const alongX = d.x1 - d.x0 >= d.y1 - d.y0;
    const r = Math.min((d.h || 60) / 2, (alongX ? d.y1 - d.y0 : d.x1 - d.x0) / 2);
    const cx = (d.x0 + d.x1) / 2;
    const cy = (d.y0 + d.y1) / 2;
    const half = (alongX ? d.x1 - d.x0 : d.y1 - d.y0) / 2 - r * 0.3;
    const ax = alongX ? 1 : 0;
    const ay = alongX ? 0 : 1;
    // a ponta de trás (longe da câmera) e a da frente; o tronco afina um pouco para a de trás
    const A = { x: cx - ax * half, y: cy - ay * half, z: z0 + r * 0.92 };
    const B = { x: cx + ax * half, y: cy + ay * half, z: z0 + r * 0.92 };
    const S = 10;
    const pts = [];
    for (let k = 0; k <= S; k++) {
      const u = k / S;
      const q = { x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u, z: A.z - r * 0.06 * (1 - u) };
      pts.push({ p: cam.p(q), r: r * (0.88 + 0.12 * u) * zoom });
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pass = (color, grow, off, k) => {
      ctx.strokeStyle = color;
      for (let s = 0; s + 1 < pts.length; s++) {
        const o = pts[s].r * off;
        ctx.lineWidth = Math.max(0.6, pts[s].r * 2 * k + grow);
        ctx.beginPath();
        ctx.moveTo(pts[s].p.x + L.x * o, pts[s].p.y + L.y * o);
        ctx.lineTo(pts[s + 1].p.x + L.x * o, pts[s + 1].p.y + L.y * o);
        ctx.stroke();
      }
    };
    // toco de galho (atrás do corpo, saindo para cima)
    const sb = { x: cx - ax * half * 0.2 - ay * r * 0.6, y: cy - ay * half * 0.2 - ax * r * 0.6, z: z0 + r * 1.3 };
    const se = { x: sb.x - ay * r * 0.9, y: sb.y - ax * r * 0.9, z: sb.z + r * 1.4 };
    const p0 = cam.p(sb), p1 = cam.p(se);
    for (const [color, w] of [[INK, r * 0.5 * zoom + ink * 2], [LOG.base, r * 0.5 * zoom]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    pass(INK, ink * 2.4, 0, 1);
    pass(LOG.base, 0, 0, 1);
    pass(LOG.shade, 0, -0.5, 0.48);
    pass(LOG.light, 0, 0.5, 0.26);
    // estrias da casca ao longo do tronco
    ctx.strokeStyle = 'rgba(30, 22, 15, 0.45)';
    ctx.lineWidth = Math.max(0.8, 1.6 * zoom);
    for (const f of [-0.35, 0.05, 0.4]) {
      ctx.beginPath();
      pts.forEach((q, k) => {
        const x = q.p.x - L.y * q.r * f;
        const y = q.p.y + L.x * q.r * f;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    // musgo por cima
    for (let k = 0; k < 4; k++) {
      const q = pts[1 + Math.floor(rnd() * (S - 2))];
      ctx.fillStyle = LOG.moss[k % 2];
      ctx.beginPath();
      ctx.ellipse(q.p.x + L.x * q.r * 0.45, q.p.y + L.y * q.r * 0.45, q.r * (0.35 + rnd() * 0.25), q.r * (0.18 + rnd() * 0.1), 0, 0, M.TAU);
      ctx.fill();
    }
    // a ponta da frente: a seção do tronco (círculo no plano de pé, perpendicular a ele) com os anéis da madeira
    const ring = (rr) => {
      const out = [];
      for (let k = 0; k < 24; k++) {
        const t = (k / 24) * M.TAU;
        const u = Math.cos(t) * rr;
        const w = Math.sin(t) * rr;
        out.push(cam.p({ x: B.x + (alongX ? 0 : u), y: B.y + (alongX ? u : 0), z: B.z + w }));
      }
      return out;
    };
    poly(ctx, ring(r), LOG.cut, INK, ink * 2.2);
    for (const k of [0.68, 0.42, 0.18]) poly(ctx, ring(r * k), null, LOG.ring, Math.max(0.8, 1.3 * zoom));
  };

  /** Aguapé: um tapete de folhas redondas boiando (círculos deitados na água) com flores lilás no meio. */
  Small.prototype._hyacinth = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0 + 2;
    const zoom = cam.zoom;
    const ink = this.ink;
    const rnd = M.rng(Math.round(d.x * 3 + d.y * 17));
    const R = d.r || 70;
    const leaves = [];
    const n = 5 + Math.floor(R / 14);
    for (let k = 0; k < n; k++) {
      const a = rnd() * M.TAU;
      const dist = Math.sqrt(rnd()) * R * 0.72;
      const q = { x: d.x + Math.cos(a) * dist, y: d.y + Math.sin(a) * dist, z: z0 };
      leaves.push({ q, r: R * (0.2 + rnd() * 0.12), notch: rnd() * M.TAU, depth: cam.depth(q) });
    }
    leaves.sort((p, q) => p.depth - q.depth);
    for (const l of leaves) {
      const c = cam.p(l.q);
      const rx = l.r * zoom;
      const ry = l.r * cam.sinP * zoom;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx + ink * 1.2, ry + ink * 1.2, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#3f7a34';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx, ry, 0, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#5c9a45';
      ctx.beginPath();
      ctx.ellipse(c.x - rx * 0.18, c.y - ry * 0.22, rx * 0.66, ry * 0.6, 0, 0, M.TAU);
      ctx.fill();
      // nervura do centro até a borda
      ctx.strokeStyle = 'rgba(28, 52, 24, 0.7)';
      ctx.lineWidth = Math.max(0.6, 1 * zoom);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(l.notch) * rx, c.y + Math.sin(l.notch) * ry);
      ctx.stroke();
    }
    // flores: cachinhos lilás um pouco acima das folhas
    const flowers = R > 60 ? 2 : 1;
    for (let f = 0; f < flowers; f++) {
      const a = rnd() * M.TAU;
      const base = { x: d.x + Math.cos(a) * R * 0.2, y: d.y + Math.sin(a) * R * 0.2, z: z0 };
      const top = { ...base, z: z0 + 22 + rnd() * 8 };
      const b = cam.p(base), t = cam.p(top);
      ctx.strokeStyle = '#2f5f2a';
      ctx.lineWidth = Math.max(1, 2.2 * zoom);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * M.TAU;
        const px = t.x + Math.cos(ang) * 4.5 * zoom;
        const py = t.y + Math.sin(ang) * 3.2 * zoom - 3 * zoom;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(px, py, 3.4 * zoom + ink * 0.6, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = k % 2 ? '#b892dc' : '#9f74cc';
        ctx.beginPath();
        ctx.arc(px, py, 3.4 * zoom, 0, M.TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#f2d34a';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 3 * zoom, 1.8 * zoom, 0, M.TAU);
      ctx.fill();
    }
  };

  /**
   * Capivara (enfeite): corpo de barril deitado na direção em que olha (bolas ao longo do corpo, que ficam redondas de
   * qualquer lado; contorno de todas antes do recheio), cabeça quadradona mais baixa na frente, focinho escuro, olho e
   * orelhinhas; perninhas curtas.
   */
  Small.prototype._capybara = function (ctx) {
    const cam = this.cam;
    const d = this.d;
    const z0 = this.z0;
    const zoom = cam.zoom;
    const ink = this.ink;
    const a = ((d.angle || 0) * Math.PI) / 180;
    const fx = Math.cos(a);
    const fy = Math.sin(a);
    const sx = -fy; // para o lado
    const sy = fx;
    const at = (along, side, z) => ({ x: d.x + fx * along + sx * side, y: d.y + fy * along + sy * side, z: z0 + z });
    // fatias de pé, perpendiculares ao corpo: [onde, raio, altura do centro]
    const body = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      body.push({ c: at(-48 + u * 78, 0, 32 + Math.sin(u * Math.PI) * 4), r: 26 * Math.pow(Math.sin(Math.PI * (0.12 + 0.82 * u)), 0.6) });
    }
    const head = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      head.push({ c: at(30 + u * 30, 0, 36 - u * 6), r: 16 - u * 4 });
    }

    // perninhas
    ctx.lineCap = 'round';
    for (const [along, side] of [[-34, -12], [-34, 12], [16, -11], [16, 11]]) {
      const top = cam.p(at(along, side, 20));
      const foot = cam.p(at(along, side, 1));
      for (const [color, w] of [[INK, 7 * zoom + ink * 2], [CAPY.dark, 7 * zoom]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(foot.x, foot.y);
        ctx.stroke();
      }
    }
    // a cabeça vai na frente ou atrás do corpo, conforme o lado para onde olha
    const headFront = fx + fy > 0;
    const drawSlices = (list, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const sl of list) {
        const q = cam.p(sl.c);
        const rr = sl.r * zoom + (color === INK ? ink * 1.3 : 0);
        ctx.moveTo(q.x + rr, q.y);
        ctx.arc(q.x, q.y, rr, 0, M.TAU);
      }
      ctx.fill();
    };
    const parts = headFront ? [body, head] : [head, body];
    for (const part of parts) {
      drawSlices(part, INK);
      drawSlices(part, part === head ? CAPY.shade : CAPY.base);
    }
    // luz no lombo
    const L = cam.lightScreen;
    ctx.strokeStyle = CAPY.light;
    ctx.lineWidth = Math.max(1, 9 * zoom);
    ctx.beginPath();
    body.slice(2, 9).forEach((sl, i) => {
      const q = cam.p({ ...sl.c, z: sl.c.z + sl.r * 0.55 });
      i ? ctx.lineTo(q.x + L.x * 3 * zoom, q.y + L.y * 3 * zoom) : ctx.moveTo(q.x + L.x * 3 * zoom, q.y + L.y * 3 * zoom);
    });
    ctx.stroke();
    // focinho, olho e orelhas
    const snout = cam.p(at(61, 0, 30));
    ctx.fillStyle = CAPY.nose;
    ctx.beginPath();
    ctx.ellipse(snout.x, snout.y, 7 * zoom, 5.5 * zoom, 0, 0, M.TAU);
    ctx.fill();
    const side = cam.toCamera.x * sx + cam.toCamera.y * sy > 0 ? 1 : -1; // o lado da cabeça que a câmera vê
    const eye = cam.p(at(46, side * 9, 42));
    ctx.fillStyle = '#120c08';
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, Math.max(1.2, 2.6 * zoom), 0, M.TAU);
    ctx.fill();
    for (const s of [-1, 1]) {
      const ear = cam.p(at(36, s * 9, 52));
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ear.x, ear.y, 4.6 * zoom + ink * 0.8, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = CAPY.dark;
      ctx.beginPath();
      ctx.arc(ear.x, ear.y, 4.6 * zoom, 0, M.TAU);
      ctx.fill();
    }
  };
  /** Casco convexo de pontos na tela (cadeia monótona). */
  function convexHull(points) {
    const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const turn = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const q of p) {
      while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  function blobCluster(ctx, circles, colors, ink, L) {
    for (const ci of circles) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r + ink * 1.3, 0, M.TAU);
      ctx.fill();
    }
    for (const ci of circles) {
      ctx.fillStyle = colors.base;
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
      ctx.clip();
      ctx.fillStyle = colors.shade;
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
      ctx.arc(ci.x + L.x * ci.r * 0.45, ci.y + L.y * ci.r * 0.45, ci.r, 0, M.TAU, true);
      ctx.fill('evenodd');
      ctx.fillStyle = colors.light;
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
      ctx.arc(ci.x - L.x * ci.r * 0.25, ci.y - L.y * ci.r * 0.25, ci.r, 0, M.TAU, true);
      ctx.fill('evenodd');
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 0.6;
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, ci.r, 0, M.TAU);
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------------ semáforo
  // O de antes (mapa antigo de São Paulo): poste e caixa de três luzes trocando de cor. O do mundo novo (`semaforo` no
  // mapa, pedido do dono em 13/11: "um semáforo quebrado saindo faísca"): semáforo de rua de São Paulo, poste cinza com
  // o braço sobre a rua (entortado para baixo), a caixa de luzes preta com o anteparo amarelo pendurada torta pelos
  // fios, lentes apagadas (uma trincada), a amarela piscando falhada de vez em quando; no poste, a caixinha de força com
  // a porta aberta e os fios para fora; ferrugem e cipó. As faíscas (da caixinha e da ponta do fio solto) são
  // partículas do mundo (World.update, 'faisca'); este objeto diz de onde elas saem (`sparkPoints`).
  class TrafficLight extends Prop {
    constructor(world, d) {
      super(world, { x0: d.x - 14, x1: d.x + 14, y0: d.y - 14, y1: d.y + 14 }, { fades: false });
      this.d = d;
      this.collider = { type: 'circle', x: d.x, y: d.y, r: 18 };
      if (d.broken) this._rig();
    }
    /** A forma do semáforo quebrado, em cm do mundo (z a partir do chão do poste). */
    _rig() {
      const d = this.d;
      const H = d.h || 460;
      const fa = ((d.facing || 0) * Math.PI) / 180;
      const f = { x: Math.cos(fa), y: Math.sin(fa) };
      // o braço vai para o lado da rua (onde há asfalto a 3 m); sem asfalto, para o lado da câmera
      const map = this.world.map;
      const road = (map.shapes || []).filter((s) => s.type === 'asfalto' || s.type === 'rua');
      const lat = { x: -f.y, y: f.x };
      const onRoad = (k) => road.some((s) => PD.groundHelp && PD.groundHelp.inside(s, d.x + lat.x * 300 * k, d.y + lat.y * 300 * k));
      const k = onRoad(1) ? 1 : onRoad(-1) ? -1 : lat.x + lat.y >= 0 ? 1 : -1;
      const s = { x: lat.x * k, y: lat.y * k };
      const P3 = (x, y, z) => ({ x, y, z });
      const add = (p, v, m) => ({ x: p.x + v.x * m, y: p.y + v.y * m, z: p.z + (v.z || 0) * m });
      const base = P3(d.x, d.y, 0);
      const top = P3(d.x, d.y, H);
      const a0 = P3(d.x, d.y, H - 25);
      const a1 = add(P3(d.x, d.y, H - 19), s, 130);
      const a2 = add(P3(d.x, d.y, H - 70), s, 262);
      // a caixa de luzes: pendurada no fim do braço, torta de lado (gira em volta da direção para onde olha)
      const tilt = 0.4;
      const u = { x: f.x, y: f.y, z: 0 };
      const v = { x: s.x * Math.cos(tilt), y: s.y * Math.cos(tilt), z: Math.sin(tilt) };
      const w = { x: -s.x * Math.sin(tilt), y: -s.y * Math.sin(tilt), z: Math.cos(tilt) };
      const headTop = add(add(a2, { x: 0, y: 0, z: 1 }, -34), s, -6);
      const c = add(headTop, w, -50);
      const corner = (a, b, e) => add(add(add(c, u, 12 * a), v, 17 * b), w, 50 * e);
      const lens = [1, 0, -1].map((e) => add(add(c, u, 12.5), w, 31 * e));
      // a caixinha de força no poste, virada para a câmera
      const cv = { x: Math.SQRT1_2, y: Math.SQRT1_2, z: 0 };
      const side = { x: -Math.SQRT1_2, y: Math.SQRT1_2, z: 0 };
      const box = add(P3(d.x, d.y, 168), cv, 15);
      const loose = [add(a2, s, 4), add(add(a2, s, 18), { x: 0, y: 0, z: 1 }, -50), add(add(a2, s, 10), { x: 0, y: 0, z: 1 }, -105), add(add(add(a2, s, -4), u, 8), { x: 0, y: 0, z: 1 }, -132)];
      this.rig = { H, f, s, u, v, w, base, top, a0, a1, a2, headTop, c, corner, lens, box, cv, side, loose };
    }
    /** De onde saem as faíscas (cm do mundo): a caixinha de força, a ponta do fio solto e os fios da caixa de luzes. */
    sparkPoints() {
      const r = this.rig;
      if (!r) return [];
      const z0 = this.z0;
      const at = (p) => ({ x: p.x, y: p.y, z: z0 + p.z });
      const end = r.loose[r.loose.length - 1];
      return [at({ x: r.box.x + r.cv.x * 9, y: r.box.y + r.cv.y * 9, z: r.box.z + 6 }), at(end), at(r.headTop)];
    }
    screenBox() {
      const d = this.d;
      const r = this.rig;
      if (!r) return bbox([this.P(d.x, d.y, this.z0), this.P(d.x, d.y, this.z0 + 400)], 40 * this.cam.zoom);
      const z0 = this.z0;
      const pts = [r.base, r.top, r.a2, r.corner(1, 1, -1), r.corner(-1, -1, -1), r.corner(1, -1, 1), r.loose[3]].map((p) => this.P(p.x, p.y, z0 + p.z));
      return bbox(pts, 60 * this.cam.zoom);
    }
    shadow(path) {
      lineShadow(path, this.cam, this.d.x, this.d.y, this.rig ? this.rig.H : 400, 10);
    }
    paint(ctx) {
      if (this.rig) {
        this._paintBroken(ctx);
        return;
      }
      const cam = this.cam;
      const d = this.d;
      const base = cam.p({ x: d.x, y: d.y, z: this.z0 });
      const top = cam.p({ x: d.x, y: d.y, z: this.z0 + 330 });
      ctx.strokeStyle = INK;
      ctx.lineWidth = 9 * cam.zoom + this.ink * 2;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      ctx.strokeStyle = '#3a3d43';
      ctx.lineWidth = 9 * cam.zoom;
      ctx.stroke();
      const w = 22 * cam.zoom;
      const h = 74 * cam.zoom;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.roundRect(top.x - w - this.ink * 1.5, top.y - h - this.ink * 1.5, 2 * w + this.ink * 3, h + this.ink * 3, 5 * cam.zoom);
      ctx.fill();
      ctx.fillStyle = '#2b2e33';
      ctx.beginPath();
      ctx.roundRect(top.x - w, top.y - h, 2 * w, h, 4 * cam.zoom);
      ctx.fill();
      this.lamps = [0, 1, 2].map((k) => ({ x: top.x, y: top.y - h + (k + 0.5) * (h / 3), r: 8.5 * cam.zoom }));
      for (const l of this.lamps) {
        ctx.fillStyle = '#4a4d52';
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r, 0, M.TAU);
        ctx.fill();
      }
    }
    _paintBroken(ctx) {
      const cam = this.cam;
      const zoom = cam.zoom;
      const ink = this.ink;
      const z0 = this.z0;
      const r = this.rig;
      const P = (p) => cam.p({ x: p.x, y: p.y, z: z0 + p.z });
      const tube = (pts, wid, color, shade) => {
        const sp = pts.map(P);
        const path = () => {
          ctx.beginPath();
          sp.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        };
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        path();
        ctx.strokeStyle = INK;
        ctx.lineWidth = wid * zoom + ink * 2.2;
        ctx.stroke();
        path();
        ctx.strokeStyle = color;
        ctx.lineWidth = wid * zoom;
        ctx.stroke();
        if (shade) {
          ctx.beginPath();
          sp.forEach((p, i) => (i ? ctx.lineTo(p.x + wid * zoom * 0.25, p.y) : ctx.moveTo(p.x + wid * zoom * 0.25, p.y)));
          ctx.strokeStyle = shade;
          ctx.lineWidth = wid * zoom * 0.45;
          ctx.stroke();
        }
      };
      const rnd = M.rng(Math.round(this.d.x * 3 + this.d.y * 7));
      // placa do pé e o poste (cinza, com o lado da sombra), ferrugem
      const foot = P(r.base);
      ctx.fillStyle = '#6d7277';
      ctx.strokeStyle = INK;
      ctx.lineWidth = ink * 1.4;
      ctx.beginPath();
      ctx.ellipse(foot.x, foot.y, 16 * zoom, 16 * zoom * cam.sinP, 0, 0, M.TAU);
      ctx.fill();
      ctx.stroke();
      tube([r.base, r.top], 15, '#9aa0a6', '#73797f');
      const RUST = ['rgba(150, 82, 38, 0.75)', 'rgba(118, 62, 30, 0.7)'];
      for (let k = 0; k < 7; k++) {
        const z = 30 + rnd() * (r.H - 60);
        const p = P({ x: r.base.x, y: r.base.y, z });
        ctx.fillStyle = RUST[k % 2];
        ctx.beginPath();
        ctx.ellipse(p.x + (rnd() - 0.4) * 5 * zoom, p.y, (2.5 + rnd() * 3) * zoom, (5 + rnd() * 9) * zoom, 0, 0, M.TAU);
        ctx.fill();
      }
      // cipó subindo pelo poste (como nos postes da rua)
      if (PD.city && PD.city.poleVine) PD.city.poleVine(ctx, cam, { x: r.base.x, y: r.base.y }, z0, r.H * 0.75, ink);
      // a caixinha de força, aberta, com os fios para fora
      const bx = (a, b, e) => P({ x: r.box.x + r.side.x * 12 * a + r.cv.x * 7 * e, y: r.box.y + r.side.y * 12 * a + r.cv.y * 7 * e, z: r.box.z + 21 * b });
      const front = [bx(-1, -1, 1), bx(1, -1, 1), bx(1, 1, 1), bx(-1, 1, 1)];
      const sideFace = [bx(1, -1, 1), bx(1, -1, -1), bx(1, 1, -1), bx(1, 1, 1)];
      const topFace = [bx(-1, 1, 1), bx(1, 1, 1), bx(1, 1, -1), bx(-1, 1, -1)];
      poly(ctx, sideFace, '#5f6469', INK, ink * 1.4);
      poly(ctx, topFace, '#8d9399', INK, ink * 1.4);
      poly(ctx, front, '#1a1b1d', INK, ink * 1.4);
      // a porta aberta (presa num lado, aberta para fora)
      const hinge = (b) => P({ x: r.box.x - r.side.x * 12 + r.cv.x * 7, y: r.box.y - r.side.y * 12 + r.cv.y * 7, z: r.box.z + 21 * b });
      const open = (b) => P({ x: r.box.x - r.side.x * 17 + r.cv.x * 27, y: r.box.y - r.side.y * 17 + r.cv.y * 27, z: r.box.z + 21 * b - 3 });
      poly(ctx, [hinge(-1), open(-1), open(1), hinge(1)], '#7d8389', INK, ink * 1.4);
      // fios coloridos saindo da caixinha
      for (const [col, dx, drop] of [['#c0392b', -5, 46], ['#e0b92a', 1, 62], ['#2b2b2b', 6, 38]]) {
        const p0 = { x: r.box.x + r.side.x * dx + r.cv.x * 7, y: r.box.y + r.side.y * dx + r.cv.y * 7, z: r.box.z - 8 };
        const p1 = { x: p0.x + r.cv.x * 14, y: p0.y + r.cv.y * 14, z: p0.z - drop * 0.6 };
        const p2 = { x: p0.x + r.cv.x * 20 + r.side.x * dx, y: p0.y + r.cv.y * 20 + r.side.y * dx, z: p0.z - drop };
        const a = P(p0), b = P(p1), e = P(p2);
        ctx.lineCap = 'round';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.6 * zoom + ink;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(b.x, b.y, e.x, e.y);
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.6 * zoom;
        ctx.stroke();
      }
      // o braço sobre a rua, entortado para baixo no fim
      tube([r.a0, r.a1, r.a2], 10, '#959ba1', '#6f757b');
      for (let k = 0; k < 3; k++) {
        const t = 0.2 + rnd() * 0.7;
        const p = t < 0.5 ? P({ x: r.a0.x + (r.a1.x - r.a0.x) * t * 2, y: r.a0.y + (r.a1.y - r.a0.y) * t * 2, z: r.a0.z + (r.a1.z - r.a0.z) * t * 2 }) : P({ x: r.a1.x + (r.a2.x - r.a1.x) * (t * 2 - 1), y: r.a1.y + (r.a2.y - r.a1.y) * (t * 2 - 1), z: r.a1.z + (r.a2.z - r.a1.z) * (t * 2 - 1) });
        ctx.fillStyle = RUST[k % 2];
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, (4 + rnd() * 4) * zoom, (2 + rnd() * 2) * zoom, 0.4, 0, M.TAU);
        ctx.fill();
      }
      // os dois fios que seguram a caixa de luzes torta
      const hang = [r.corner(0, 0.6, 1), r.corner(0, -0.6, 1)];
      ctx.strokeStyle = '#141414';
      ctx.lineWidth = Math.max(1, 2.2 * zoom);
      for (const h of hang) {
        const a = P(r.a2), b = P(h);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2 + 4 * zoom, (a.y + b.y) / 2, b.x, b.y);
        ctx.stroke();
      }
      // anteparo amarelo atrás da caixa (no plano da frente, um pouco para trás)
      const plate = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([b, e]) => {
        const p = { x: r.c.x - r.u.x * 13 + r.v.x * 27 * b + r.w.x * 61 * e, y: r.c.y - r.u.y * 13 + r.v.y * 27 * b + r.w.y * 61 * e, z: r.c.z - r.u.z * 13 + r.v.z * 27 * b + r.w.z * 61 * e };
        return P(p);
      });
      poly(ctx, plate, '#c4951d', INK, ink * 1.6);
      // a caixa: as faces que olham para a câmera
      const tc = cam.toCamera;
      const faces = [
        { n: r.u, pts: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], color: '#1e2023' },
        { n: { x: -r.u.x, y: -r.u.y, z: -r.u.z }, pts: [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]], color: '#17181a' },
        { n: r.v, pts: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]], color: '#2e3135' },
        { n: { x: -r.v.x, y: -r.v.y, z: -r.v.z }, pts: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], color: '#26292c' },
        { n: r.w, pts: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], color: '#3b3e43' },
        { n: { x: -r.w.x, y: -r.w.y, z: -r.w.z }, pts: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]], color: '#121314' },
      ];
      for (const fc of faces) {
        if (fc.n.x * tc.x + fc.n.y * tc.y + fc.n.z * tc.z <= 0) continue;
        poly(ctx, fc.pts.map(([a, b, e]) => P(r.corner(a, b, e))), fc.color, INK, ink * 1.4);
      }
      // as lentes apagadas (vermelha, amarela, verde) com a pala em cima; a verde trincada
      const ring = (cen, rad, out) => {
        const pts = [];
        for (let k = 0; k <= 16; k++) {
          const t = (k / 16) * M.TAU;
          pts.push(P({ x: cen.x + r.u.x * out + (r.v.x * Math.cos(t) + r.w.x * Math.sin(t)) * rad, y: cen.y + r.u.y * out + (r.v.y * Math.cos(t) + r.w.y * Math.sin(t)) * rad, z: cen.z + r.u.z * out + (r.v.z * Math.cos(t) + r.w.z * Math.sin(t)) * rad }));
        }
        return pts;
      };
      const LENS = ['#43201c', '#4b3c14', '#173822'];
      r.lens.forEach((cen, i) => {
        poly(ctx, ring(cen, 11, 0), LENS[i], INK, ink * 1.1);
        // brilho do vidro
        const hl = ring(cen, 7, 0.5).slice(9, 13);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = Math.max(1, 1.6 * zoom);
        ctx.beginPath();
        hl.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
        // pala (a aba em cima da lente)
        const visor = ring(cen, 13, 7).slice(0, 9);
        ctx.strokeStyle = '#101112';
        ctx.lineWidth = Math.max(1.5, 3.4 * zoom);
        ctx.beginPath();
        visor.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
      });
      const g = P({ x: r.lens[2].x + r.u.x * 0.5, y: r.lens[2].y + r.u.y * 0.5, z: r.lens[2].z });
      ctx.strokeStyle = 'rgba(220, 235, 225, 0.7)';
      ctx.lineWidth = Math.max(0.8, 1.1 * zoom);
      for (const a of [0.3, 2.2, 4.1]) {
        ctx.beginPath();
        ctx.moveTo(g.x + Math.cos(a) * 2 * zoom, g.y + Math.sin(a) * 2 * zoom);
        ctx.lineTo(g.x + Math.cos(a + 0.4) * 9 * zoom, g.y + Math.sin(a + 0.4) * 7 * zoom);
        ctx.stroke();
      }
      // o fio solto que desce do braço (na ponta, as faíscas)
      const ls = r.loose.map(P);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4 * zoom + ink;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ls[0].x, ls[0].y);
      ctx.bezierCurveTo(ls[1].x, ls[1].y, ls[2].x, ls[2].y, ls[3].x, ls[3].y);
      ctx.stroke();
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 2.4 * zoom;
      ctx.stroke();
      // a ponta desencapada (cobre)
      ctx.fillStyle = '#d08a3c';
      ctx.beginPath();
      ctx.arc(ls[3].x, ls[3].y, 2.4 * zoom, 0, M.TAU);
      ctx.fill();
    }
    draw(ctx, time) {
      super.draw(ctx);
      const cam = this.cam;
      if (this.rig) {
        // a amarela pisca falhada de vez em quando (soma de três ondas: só passa do limite em poucos instantes)
        const t = time + (this.d.x % 7);
        const v = Math.sin(t * 9.1) + Math.sin(t * 4.3 + 1.7) + Math.sin(t * 1.3 + 0.4);
        if (v < 2.2 || this.alpha < 0.5) return;
        const r = this.rig;
        const cen = r.lens[1];
        const q = cam.p({ x: cen.x + r.u.x, y: cen.y + r.u.y, z: this.z0 + cen.z });
        const rad = 11 * cam.zoom;
        const glow = ctx.createRadialGradient(q.x, q.y, rad * 0.3, q.x, q.y, rad * 3.2);
        glow.addColorStop(0, 'rgba(255, 214, 90, 0.75)');
        glow.addColorStop(1, 'rgba(255, 190, 40, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rad * 3.2, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#ffd34a';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, rad * 0.8, rad * 0.95, 0, 0, M.TAU);
        ctx.fill();
        return;
      }
      // ciclo: verde 6 s, amarelo 2 s, vermelho 6 s
      const t = time % 14;
      const on = t < 6 ? 2 : t < 8 ? 1 : 0;
      const colors = ['#ff4a3a', '#ffc21f', '#3fe07a'];
      const l = this.lamps[on];
      ctx.fillStyle = colors[on];
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r * 2.2, 0, M.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, M.TAU);
      ctx.fill();
    }
  }

  // ------------------------------------------------------------------ gradil, portão e pilar (mundo novo)
  // Gradil velho de ferro verde, com cipó; o portão é o mesmo gradil com quadro e travessa. Um gradil comprido é
  // dividido em pedaços de até 4 m (sprites menores e a ordem de desenho certa perto do personagem)
  class Fence extends Prop {
    static split(f, max = 400) {
      const alongY = f.y1 - f.y0 >= f.x1 - f.x0;
      const len = alongY ? f.y1 - f.y0 : f.x1 - f.x0;
      const n = Math.max(1, Math.ceil(len / max));
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = (alongY ? f.y0 : f.x0) + (len * i) / n;
        const b = (alongY ? f.y0 : f.x0) + (len * (i + 1)) / n;
        out.push(alongY ? { ...f, y0: a, y1: b, part: i } : { ...f, x0: a, x1: b, part: i });
      }
      return out;
    }
    constructor(world, f) {
      super(world, { x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y1 }, { fades: true });
      this.f = f;
      this.alongY = f.y1 - f.y0 >= f.x1 - f.x0;
    }
    _ends() {
      const f = this.f;
      return this.alongY
        ? [{ x: (f.x0 + f.x1) / 2, y: f.y0 }, { x: (f.x0 + f.x1) / 2, y: f.y1 }]
        : [{ x: f.x0, y: (f.y0 + f.y1) / 2 }, { x: f.x1, y: (f.y0 + f.y1) / 2 }];
    }
    screenBox() {
      const [a, b] = this._ends();
      const h = this.f.h + 30;
      // aberto, as folhas saem da linha do portão até meia largura para o lado
      const open = this.f.gate && this.f.open ? Math.hypot(b.x - a.x, b.y - a.y) * 0.55 : 0;
      return bbox([this.P(a.x, a.y, this.z0), this.P(b.x, b.y, this.z0), this.P(a.x, a.y, this.z0 + h), this.P(b.x, b.y, this.z0 + h)], (30 + open) * this.cam.zoom);
    }
    shadow(path) {
      const [a, b] = this._ends();
      const L = this.cam.light;
      const h = this.f.h * 0.35;
      const dx = (-L.x / L.z) * h, dy = (-L.y / L.z) * h;
      path.moveTo(a.x, a.y);
      path.lineTo(b.x, b.y);
      path.lineTo(b.x + dx, b.y + dy);
      path.lineTo(a.x + dx, a.y + dy);
      path.closePath();
    }
    paint(ctx) {
      const [a, b] = this._ends();
      const f = this.f;
      if (!(f.gate && f.open)) return this._panel(ctx, a, b, f.gate, true);
      // portão aberto: as duas folhas giradas ~75° nas dobradiças, abertas para o lado da câmera (+x+y)
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const dx = (b.x - a.x) / len, dy = (b.y - a.y) / len;
      let nx = -dy, ny = dx;
      if (nx + ny < 0) { nx = -nx; ny = -ny; }
      const ang = 75 * DEG_P;
      const half = len / 2 - 6;
      const endA = { x: a.x + (dx * Math.cos(ang) + nx * Math.sin(ang)) * half, y: a.y + (dy * Math.cos(ang) + ny * Math.sin(ang)) * half };
      const endB = { x: b.x + (-dx * Math.cos(ang) + nx * Math.sin(ang)) * half, y: b.y + (-dy * Math.cos(ang) + ny * Math.sin(ang)) * half };
      // a folha mais longe da câmera primeiro
      const leaves = [[a, endA], [b, endB]].sort((p, q) => this.cam.depth({ ...p[1], z: 0 }) - this.cam.depth({ ...q[1], z: 0 }));
      for (const [h, e] of leaves) this._panel(ctx, h, e, true, false);
    }
    /** Um trecho de gradil (ou uma folha de portão) de `a` até `b`. */
    _panel(ctx, a, b, gate, withVines) {
      const cam = this.cam;
      const f = this.f;
      const z0 = this.z0;
      const ink = this.ink;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const at = (u, z) => cam.p({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: z0 + z });
      const iron = '#2b4a3a';
      const ironLight = '#44705a';
      const rnd = M.rng(Math.round(a.x * 7 + a.y * 3 + (f.part || 0)));
      const line = (p, q, w, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      };
      ctx.lineCap = 'round';
      const H = f.h;
      const rails = gate ? [16, H * 0.5, H - 12] : [16, H - 12];
      const bars = Math.max(2, Math.round(len / 12));
      // contorno de tinta primeiro (tudo), depois o ferro
      for (const pass of [0, 1]) {
        const w = (base) => (pass ? base * cam.zoom : base * cam.zoom + ink * 2);
        const color = pass ? iron : INK;
        for (const z of rails) line(at(0, z), at(1, z), w(4), color);
        for (let i = 0; i <= bars; i++) {
          if (f.broken && rnd() < 0.18) continue;
          const u = i / bars;
          const post = i % 16 === 0 || i === bars;
          line(at(u, 0), at(u, H + (post ? 4 : 10)), w(post ? 7 : 2.6), color);
          if (!post && pass) {
            // ponta de lança
            const tip = at(u, H + 18);
            const base = at(u, H + 8);
            ctx.fillStyle = iron;
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(base.x - 3 * cam.zoom, base.y);
            ctx.lineTo(base.x + 3 * cam.zoom, base.y);
            ctx.closePath();
            ctx.fill();
          }
        }
        if (gate) {
          // travessa em diagonal e o quadro do portão
          line(at(0.02, 20), at(0.98, H * 0.5), w(3.4), color);
          line(at(0.02, H * 0.5), at(0.98, H - 14), w(3.4), color);
          line(at(0, 0), at(0, H + 6), w(8), color);
          line(at(1, 0), at(1, H + 6), w(8), color);
        }
      }
      // brilho no corrimão de cima
      line(at(0, H - 14), at(1, H - 14), 1.4 * cam.zoom, ironLight);
      if (gate && !f.open) {
        // fechadura
        const lk = at(0.5, H * 0.5);
        ctx.fillStyle = INK;
        ctx.fillRect(lk.x - 5 * cam.zoom - ink, lk.y - 7 * cam.zoom - ink, 10 * cam.zoom + 2 * ink, 14 * cam.zoom + 2 * ink);
        ctx.fillStyle = '#7a6a3a';
        ctx.fillRect(lk.x - 5 * cam.zoom, lk.y - 7 * cam.zoom, 10 * cam.zoom, 14 * cam.zoom);
      }
      // cipó: tufos de folha subindo pelo gradil
      const tufts = withVines ? Math.round(len / 70) : 0;
      for (let k = 0; k < tufts; k++) {
        if (rnd() < 0.35) continue;
        const u = rnd();
        const top = H * (0.3 + rnd() * 0.75);
        const circles = [];
        for (let j = 0; j < 5; j++) {
          const q = at(Math.min(1, Math.max(0, u + (rnd() - 0.5) * 0.08)), top * (j / 4) * (0.6 + rnd() * 0.5));
          circles.push({ x: q.x, y: q.y, r: (7 + rnd() * 7) * cam.zoom });
        }
        circles.sort((p, q) => p.y - q.y);
        blobCluster(ctx, circles, { base: '#2f6a35', shade: '#1f4a26', light: '#4a8a4a' }, ink, cam.lightScreen);
      }
    }
  }

  /** Pilar do portão: concreto velho com chapéu. */
  class Pillar extends Prop {
    constructor(world, b) {
      super(world, { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }, { fades: false });
      this.b = b;
      this.collider = { type: 'box', x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 };
    }
    screenBox() {
      const b = this.b;
      return bbox([this.P(b.x0, b.y1, this.z0), this.P(b.x1, b.y0, this.z0), this.P(b.x1, b.y1, this.z0), this.P(b.x0, b.y0, this.z0 + b.h + 20)], 24 * this.cam.zoom);
    }
    shadow(path) {
      const b = this.b;
      boxShadow(path, this.cam, b.x0, b.x1, b.y0, b.y1, b.h);
    }
    paint(ctx) {
      const b = this.b;
      const z0 = this.z0;
      box(ctx, this.cam, b.x0, b.x1, b.y0, b.y1, z0, z0 + b.h, { front: '#9a958a', side: '#7a756b', top: '#b4afa3' }, this.ink);
      const c = 6;
      box(ctx, this.cam, b.x0 - c, b.x1 + c, b.y0 - c, b.y1 + c, z0 + b.h, z0 + b.h + 12, { front: '#8a857a', side: '#6c675e', top: '#c2bdb1' }, this.ink);
    }
  }

  PD.props = {
    Prop, Building, House, HouseBack, TreeTrunk, TreeCanopy, Pole, Wall, Small, TrafficLight, Fence, Pillar, bbox, poly,
    // para as plantas da mata (flora.js) e as coisas da cidade (city.js) desenharem com o mesmo traço
    help: { INK, CANOPY_INK, BARK, CANOPY, FONT_SIGN, tuftPath, limbPoly, circleShadow, lineShadow, boxShadow, box, onWall, pixo, crownPaint, roofTree },
  };
})(window.PD = window.PD || {});
