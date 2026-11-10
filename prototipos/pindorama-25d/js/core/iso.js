// Câmera isométrica fixa (projeção ortográfica): ângulo de 45° no chão e inclinação de 30° (o losango 2:1
// dos jogos isométricos clássicos). Nada aqui depende do navegador além do canvas que recebe as contas.
//
// Coordenadas de tela "do mundo" (px): não dependem de onde a câmera está. A câmera só desloca tudo na hora
// de desenhar; assim o chão e os prédios podem ser desenhados uma vez só e reaproveitados.
(function (PD) {
  'use strict';
  const { DEG, norm } = PD.math;
  const K = Math.SQRT1_2;

  class IsoCamera {
    constructor() {
      this.setPitch(30);
      this.zoom = 1; // px de tela (CSS) por centímetro do mundo
      this.viewW = 800;
      this.viewH = 600;
      this.target = { x: 0, y: 0, z: 0 };
      this.viewX = 0; // canto de cima à esquerda da tela, em px do mundo
      this.viewY = 0;
      this.dpr = 1;
    }

    setPitch(deg) {
      this.pitchDeg = deg;
      this.sinP = Math.sin(deg * DEG);
      this.cosP = Math.cos(deg * DEG);
      // de onde vem a luz (unitário, apontando PARA o sol): do alto, à esquerda da tela
      this.light = norm({ x: -0.62, y: 0.26, z: 0.74 });
      const lx = (this.light.x - this.light.y) * K;
      const ly = (this.light.x + this.light.y) * K * this.sinP - this.light.z * this.cosP;
      const l = Math.hypot(lx, ly);
      /** Direção da luz na tela (para o lado iluminado dos volumes). */
      this.lightScreen = { x: lx / l, y: ly / l };
      /** Direção do vetor "para a câmera" (perto = maior). */
      this.toCamera = { x: K * this.cosP, y: K * this.cosP, z: this.sinP };
    }

    // ---- mundo → tela ----
    /** x de tela do mundo (px), sem a câmera. */
    sx(x, y) {
      return (x - y) * K * this.zoom;
    }
    /** y de tela do mundo (px), sem a câmera. */
    sy(x, y, z) {
      return ((x + y) * K * this.sinP - z * this.cosP) * this.zoom;
    }
    /** Ponto 3D → px de tela do mundo. */
    p(pt) {
      return { x: (pt.x - pt.y) * K * this.zoom, y: ((pt.x + pt.y) * K * this.sinP - pt.z * this.cosP) * this.zoom };
    }
    /** Quanto mais perto da câmera, maior (serve para ordenar o desenho). */
    depth(pt) {
      return (pt.x + pt.y) * K * this.cosP + pt.z * this.sinP;
    }
    /** Direção 3D → direção na tela (px por cm). */
    pDir(d) {
      return { x: (d.x - d.y) * K * this.zoom, y: ((d.x + d.y) * K * this.sinP - d.z * this.cosP) * this.zoom };
    }

    // ---- tela → chão ----
    /** px de tela do mundo → ponto no chão (z = 0). */
    groundAt(wx, wy) {
      const a = wx / (K * this.zoom); // x - y
      const b = wy / (K * this.sinP * this.zoom); // x + y
      return { x: (a + b) / 2, y: (b - a) / 2, z: 0 };
    }
    /** Direção da tela (sem tamanho) → direção no chão, unitária. Ex.: (0, -1) = "para cima da tela". */
    groundDir(dx, dy) {
      // inverte a projeção da direção no chão: dx = (x - y)K, dy = (x + y)K sinP
      const a = dx / K;
      const b = dy / (K * this.sinP);
      // a direção na tela é "visual": normaliza no chão para andar na mesma velocidade em todo sentido
      return norm({ x: (a + b) / 2, y: (b - a) / 2, z: 0 }, { x: 0, y: 0, z: 0 });
    }

    // ---- câmera ----
    /** Centraliza a câmera no alvo (o personagem fica um pouco abaixo do meio da tela). */
    follow(pt) {
      this.target = pt;
      const cx = this.sx(pt.x, pt.y);
      const cy = this.sy(pt.x, pt.y, 0);
      // arredonda no pixel do aparelho: o chão pronto não fica borrado
      this.viewX = Math.round((cx - this.viewW / 2) * this.dpr) / this.dpr;
      this.viewY = Math.round((cy - this.viewH * 0.56) * this.dpr) / this.dpr;
    }
    /** Ponto do mundo → px da tela de verdade (para o HUD). */
    toScreen(pt) {
      const q = this.p(pt);
      return { x: q.x - this.viewX, y: q.y - this.viewY };
    }
    /** px da tela de verdade → chão. */
    screenToGround(x, y) {
      return this.groundAt(x + this.viewX, y + this.viewY);
    }

    /**
     * Transformação 2D que desenha o plano do chão: com ela, um retângulo em cm (x, y) sai como losango.
     * Devolve [a, b, c, d, e, f] para `ctx.setTransform`, já com o deslocamento `ox, oy` (px) e a escala `s`.
     */
    groundMatrix(s = 1, ox = 0, oy = 0) {
      const z = this.zoom * s;
      return [K * z, K * this.sinP * z, -K * z, K * this.sinP * z, ox * s, oy * s];
    }
    /**
     * Transformação de uma parede vertical: origem no ponto `o` (chão), eixo "a" ao longo da direção `dir`
     * (unitária, no chão) e eixo "b" para cima. Desenhe em cm com b crescendo PARA CIMA: use y negativo.
     */
    wallMatrix(o, dir, s = 1, ox = 0, oy = 0) {
      const z = this.zoom * s;
      const ax = (dir.x - dir.y) * K * z;
      const ay = (dir.x + dir.y) * K * this.sinP * z;
      const po = this.p(o);
      return [ax, ay, 0, this.cosP * z, (po.x + ox) * s, (po.y + oy) * s];
    }
  }

  PD.IsoCamera = IsoCamera;
  PD.ISO_K = K;
})(window.PD = window.PD || {});
