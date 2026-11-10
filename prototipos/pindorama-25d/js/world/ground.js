// O chão do cenário: desenhado UMA vez em pedaços (canvas fora da tela) e só copiado a cada quadro.
// Rua no nível 0; calçadas, praça e quarteirões 14 cm mais altos (o meio-fio aparece de verdade).
// As sombras dos prédios, árvores e postes também vão aqui, porque não se mexem.
(function (PD) {
  'use strict';
  const M = PD.math;
  const K = PD.ISO_K;
  const CHUNK = 512; // px de tela (CSS) por pedaço
  /** Contorno simplificado do estado de São Paulo (o desenho do mosaico das calçadas paulistanas). */
  const SP_MAP = [[0, 0.42], [0.1, 0.34], [0.22, 0.3], [0.34, 0.18], [0.47, 0.12], [0.58, 0.05], [0.7, 0.08], [0.8, 0.02], [0.92, 0.1], [1, 0.22], [0.96, 0.38], [0.86, 0.52], [0.74, 0.62], [0.6, 0.7], [0.48, 0.66], [0.36, 0.6], [0.24, 0.56], [0.12, 0.52]];
  const PAD = 1800; // o chão continua além do mapa (o personagem não chega lá, mas a câmera vê)

  const C = {
    asphalt: '#4b4e57', asphaltDark: '#3f424b', asphaltLight: '#5a5d66', patch: '#545760',
    lineYellow: '#e8b62f', lineWhite: '#ece8dc',
    sidewalk: '#cbc5b7', sidewalkJoint: '#aaa497', curbTop: '#dcd6c9', curbFace: '#8f897d', curbYellow: '#e2b53a',
    lot: '#9b8a6a', lotDark: '#857455', back: '#b8b1a2',
    grass: '#6f9a45', grassDark: '#5a8238', grassLight: '#8db457',
    stone: '#e6decb', stoneDark: '#8c857c',
    shadow: 'rgba(26, 22, 44, 0.26)',
    ink: '#1b100d',
  };

  class Ground {
    constructor(cam, map, props) {
      this.cam = cam;
      this.map = map;
      this.props = props; // para as sombras
      this.cache = new Map();
      this.key = '';
      this.maxChunks = 90;
    }

    /** Altura do chão no ponto (rua 0, resto 14 cm). */
    heightAt(x, y) {
      const m = this.map;
      const inStreet = y > m.street.y0 && y < m.street.y1;
      const inAvenue = x > m.avenue.x0 && x < m.avenue.x1;
      return inStreet || inAvenue ? 0 : m.curb;
    }

    _ensureKey() {
      const k = `${this.cam.zoom.toFixed(4)}|${this.cam.dpr}|${this.cam.pitchDeg}`;
      if (k !== this.key) {
        this.key = k;
        this.cache.clear();
      }
    }

    /** Desenha os pedaços visíveis (ctx já em px de tela do mundo). */
    draw(ctx) {
      this._ensureKey();
      const cam = this.cam;
      const x0 = Math.floor(cam.viewX / CHUNK);
      const y0 = Math.floor(cam.viewY / CHUNK);
      const x1 = Math.floor((cam.viewX + cam.viewW) / CHUNK);
      const y1 = Math.floor((cam.viewY + cam.viewH) / CHUNK);
      let made = 0;
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const key = cx + ',' + cy;
          let c = this.cache.get(key);
          if (!c) {
            if (made > 3 && this.cache.size > 0) continue; // no máximo 4 por quadro (não trava ao andar rápido)
            c = this._render(cx, cy);
            this.cache.set(key, c);
            made++;
            if (this.cache.size > this.maxChunks) this.cache.delete(this.cache.keys().next().value);
          } else {
            // usado agora: vai para o fim da fila (o mais antigo sai primeiro)
            this.cache.delete(key);
            this.cache.set(key, c);
          }
          ctx.drawImage(c, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
        }
      }
      this.pending = made > 3;
    }

    _render(cx, cy) {
      const dpr = this.cam.dpr;
      const c = document.createElement('canvas');
      c.width = Math.ceil(CHUNK * dpr);
      c.height = Math.ceil(CHUNK * dpr);
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, -cx * CHUNK * dpr, -cy * CHUNK * dpr);
      // limites do pedaço no chão (para pular o que não aparece)
      this._paint(ctx, { x: cx * CHUNK, y: cy * CHUNK, w: CHUNK, h: CHUNK });
      return c;
    }

    // ------------------------------------------------------------ pintura
    _paint(ctx, view) {
      const cam = this.cam;
      const m = this.map;
      const lift = m.curb * cam.cosP * cam.zoom; // quanto o nível da calçada sobe na tela
      const g = cam.groundMatrix();
      const ground = (z, fn) => {
        ctx.save();
        ctx.translate(0, -z * cam.cosP * cam.zoom);
        ctx.transform(...g);
        fn();
        ctx.restore();
      };
      const W = m.w, H = m.h;
      const R = (x0, y0, x1, y1, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      };
      const rnd = M.rng(1234);

      // ---- nível da rua: asfalto em tudo
      ground(0, () => {
        R(-PAD, -PAD, W + PAD, H + PAD, C.asphalt);
        // remendos e manchas
        const r2 = M.rng(77);
        for (let i = 0; i < 70; i++) {
          const x = -PAD + r2() * (W + 2 * PAD);
          const y = r2() < 0.5 ? m.street.y0 + r2() * (m.street.y1 - m.street.y0) : -PAD + r2() * (H + 2 * PAD);
          const w = 60 + r2() * 220;
          const h = 40 + r2() * 160;
          ctx.fillStyle = r2() < 0.5 ? C.patch : C.asphaltDark;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(x, y, w, h);
        }
        ctx.globalAlpha = 1;
        // pontinhos do asfalto
        const r3 = M.rng(5);
        for (let i = 0; i < 2600; i++) {
          const x = -400 + r3() * (W + 800);
          const y = -400 + r3() * (H + 800);
          ctx.fillStyle = r3() < 0.5 ? C.asphaltLight : C.asphaltDark;
          ctx.fillRect(x, y, 4 + r3() * 5, 4 + r3() * 5);
        }
        // rachaduras
        ctx.strokeStyle = '#33353c';
        ctx.lineWidth = 3;
        const r4 = M.rng(31);
        for (let i = 0; i < 16; i++) {
          let x = r4() * W;
          let y = m.street.y0 + r4() * (m.street.y1 - m.street.y0);
          if (i % 3 === 0) {
            x = m.avenue.x0 + r4() * (m.avenue.x1 - m.avenue.x0);
            y = r4() * H;
          }
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let k = 0; k < 5; k++) {
            x += (r4() - 0.3) * 70;
            y += (r4() - 0.5) * 70;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        // faixa amarela no meio da rua (tracejada dupla) e branca na travessa
        const midY = (m.street.y0 + m.street.y1) / 2;
        ctx.fillStyle = C.lineYellow;
        for (let x = -PAD; x < W + PAD; x += 400) {
          if (x + 240 > m.avenue.x0 - 260 && x < m.avenue.x1 + 40) continue;
          ctx.fillRect(x, midY - 16, 240, 10);
          ctx.fillRect(x, midY + 6, 240, 10);
        }
        const midX = (m.avenue.x0 + m.avenue.x1) / 2;
        ctx.fillStyle = C.lineWhite;
        for (let y = -PAD; y < H + PAD; y += 360) {
          if (y + 200 > m.street.y0 - 260 && y < m.street.y1 + 260) continue;
          ctx.fillRect(midX - 6, y, 12, 200);
        }
        // faixas de pedestre
        for (const cw of m.crosswalks) {
          ctx.fillStyle = C.lineWhite;
          if (cw.along === 'x') {
            for (let y = cw.y0 + 40; y < cw.y1 - 40; y += 90) ctx.fillRect(cw.x0, y, cw.x1 - cw.x0, 48);
          } else {
            for (let x = cw.x0 + 40; x < cw.x1 - 40; x += 90) ctx.fillRect(x, cw.y0, 48, cw.y1 - cw.y0);
          }
        }
        // linha de parada
        ctx.fillStyle = C.lineWhite;
        ctx.fillRect(m.crosswalks[0].x0 - 50, midY + 20, 22, m.street.y1 - midY - 40);
        // bueiros (tampas redondas de ferro)
        for (const mh of m.manholes) {
          ctx.fillStyle = C.ink;
          ctx.beginPath();
          ctx.arc(mh.x, mh.y, 40, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = '#5d5b5a';
          ctx.beginPath();
          ctx.arc(mh.x, mh.y, 35, 0, M.TAU);
          ctx.fill();
          ctx.strokeStyle = '#46444a';
          ctx.lineWidth = 4;
          for (let k = -2; k <= 2; k++) {
            ctx.beginPath();
            ctx.moveTo(mh.x - 30, mh.y + k * 11);
            ctx.lineTo(mh.x + 30, mh.y + k * 11);
            ctx.stroke();
          }
        }
      });

      // ---- nível da calçada: quarteirões (com calçadas), praça e terreno
      const blocks = [
        [-PAD, -PAD, m.avenue.x0, m.street.y0],
        [m.avenue.x1, -PAD, W + PAD, m.street.y0],
        [-PAD, m.street.y1, m.avenue.x0, H + PAD],
        [m.avenue.x1, m.street.y1, W + PAD, H + PAD],
      ];
      ground(m.curb, () => {
        for (const b of blocks) R(b[0], b[1], b[2], b[3], C.sidewalk);
        // miolo dos quarteirões de cima (atrás dos prédios): cimento mais escuro
        R(-PAD, -PAD, m.avenue.x0 - m.sidewalk, m.street.y0 - m.sidewalk, C.back);
        R(m.avenue.x1 + m.sidewalk, -PAD, W + PAD, m.street.y0 - m.sidewalk, C.back);
        // juntas das placas de concreto das calçadas
        ctx.strokeStyle = C.sidewalkJoint;
        ctx.lineWidth = 3;
        const joints = (x0, y0, x1, y1, step) => {
          ctx.beginPath();
          for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) {
            ctx.moveTo(x, y0);
            ctx.lineTo(x, y1);
          }
          for (let y = Math.ceil(y0 / step) * step; y < y1; y += step) {
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
          }
          ctx.stroke();
        };
        joints(-PAD, m.street.y0 - m.sidewalk, m.avenue.x0, m.street.y0, 100);
        joints(m.avenue.x1, m.street.y0 - m.sidewalk, W + PAD, m.street.y0, 100);
        joints(-PAD, m.street.y1, m.avenue.x0, m.street.y1 + m.sidewalk, 100);
        joints(m.avenue.x1, m.street.y1, W + PAD, m.street.y1 + m.sidewalk, 100);
        joints(m.avenue.x0 - m.sidewalk, -PAD, m.avenue.x0, m.street.y0, 100);
        joints(m.avenue.x1, -PAD, m.avenue.x1 + m.sidewalk, m.street.y0, 100);
        joints(m.avenue.x0 - m.sidewalk, m.street.y1, m.avenue.x0, H + PAD, 100);
        joints(m.avenue.x1, m.street.y1, m.avenue.x1 + m.sidewalk, H + PAD, 100);
        // ladrilho hidráulico na frente das lojas
        for (const t of m.tiles) {
          for (let x = t.x0; x < t.x1; x += 50) {
            for (let y = t.y0; y < t.y1; y += 50) {
              const odd = (Math.floor(x / 50) + Math.floor(y / 50)) % 2;
              R(x, y, Math.min(x + 50, t.x1), Math.min(y + 50, t.y1), odd ? t.a : t.b);
              if (!odd) {
                ctx.fillStyle = t.a;
                ctx.beginPath();
                ctx.arc(x + 25, y + 25, 12, 0, M.TAU);
                ctx.fill();
              }
            }
          }
        }
        // praça: mosaico paulista (o mapa do estado de São Paulo repetido em pedra portuguesa), em cinza
        // médio para não brigar com o contorno do personagem; grama e o círculo do despertar por cima
        const sq = m.square;
        R(sq.x0, sq.y0 + 40, sq.x1 - 40, sq.y1, C.stone);
        ctx.fillStyle = C.stoneDark;
        const T = 64; // lado da peça (cm)
        for (let gy = 0; gy * T < sq.y1 - sq.y0 - 40; gy++) {
          for (let gx = 0; gx * T < sq.x1 - sq.x0 - 40; gx++) {
            const cx = sq.x0 + gx * T + T / 2;
            const cy = sq.y0 + 40 + gy * T + T / 2;
            const rot = ((gx + gy * 2) % 4) * (Math.PI / 2);
            const cs = Math.cos(rot), sn = Math.sin(rot);
            ctx.beginPath();
            SP_MAP.forEach(([u, v], k) => {
              const lx = (u - 0.5) * T * 0.78;
              const ly = (v - 0.36) * T * 0.78;
              const px = cx + lx * cs - ly * sn;
              const py = cy + lx * sn + ly * cs;
              if (k) ctx.lineTo(px, py);
              else ctx.moveTo(px, py);
            });
            ctx.closePath();
            ctx.fill();
          }
        }
        // pedrinhas soltas no desenho (textura)
        const r5 = M.rng(9);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        for (let i = 0; i < 1800; i++) ctx.fillRect(sq.x0 + r5() * (sq.x1 - sq.x0), sq.y0 + r5() * (sq.y1 - sq.y0), 6, 6);
        for (const l of m.lawns) this._lawn(ctx, l, rnd);
        // terreno baldio: terra com mato
        const lot = m.lot;
        R(lot.x0 + 40, lot.y0 + 40, W + PAD, H + PAD, C.lot);
        const r6 = M.rng(41);
        for (let i = 0; i < 260; i++) {
          const x = lot.x0 + 60 + r6() * 600;
          const y = lot.y0 + 60 + r6() * (lot.y1 - lot.y0);
          ctx.fillStyle = r6() < 0.6 ? C.lotDark : C.grassDark;
          ctx.beginPath();
          ctx.ellipse(x, y, 10 + r6() * 20, 8 + r6() * 14, 0, 0, M.TAU);
          ctx.fill();
        }
        // círculo do despertar: anel de pedras (a luz é desenhada por cima, animada)
        const aw = m.awakening;
        ctx.fillStyle = '#d8cdb5';
        ctx.beginPath();
        ctx.arc(aw.x, aw.y, aw.r + 40, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#b9ab8e';
        ctx.beginPath();
        ctx.arc(aw.x, aw.y, aw.r + 40, 0, M.TAU);
        ctx.arc(aw.x, aw.y, aw.r + 10, 0, M.TAU, true);
        ctx.fill();
        ctx.strokeStyle = '#8f8064';
        ctx.lineWidth = 6;
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * M.TAU;
          ctx.beginPath();
          ctx.moveTo(aw.x + Math.cos(a) * (aw.r + 10), aw.y + Math.sin(a) * (aw.r + 10));
          ctx.lineTo(aw.x + Math.cos(a) * (aw.r + 40), aw.y + Math.sin(a) * (aw.r + 40));
          ctx.stroke();
        }
        // grafismo no chão do círculo (losangos, como pintura de jenipapo)
        ctx.strokeStyle = 'rgba(120, 60, 30, 0.5)';
        ctx.lineWidth = 7;
        for (let k = 0; k < 3; k++) {
          const rr = aw.r * (0.35 + k * 0.22);
          ctx.beginPath();
          for (let j = 0; j <= 16; j++) {
            const a = (j / 16) * M.TAU;
            const rad = j % 2 ? rr * 0.84 : rr;
            const px = aw.x + Math.cos(a) * rad;
            const py = aw.y + Math.sin(a) * rad;
            if (j) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
          ctx.stroke();
        }
        // pétalas do ipê caídas
        for (const t of m.trees) {
          if (t.kind !== 'ipe') continue;
          const r7 = M.rng(t.x + t.y);
          for (let i = 0; i < 90; i++) {
            const a = r7() * M.TAU;
            const d = Math.sqrt(r7()) * t.r * 1.25;
            ctx.fillStyle = r7() < 0.7 ? '#f5c51f' : '#e09a12';
            ctx.beginPath();
            ctx.ellipse(t.x + Math.cos(a) * d + 80, t.y + Math.sin(a) * d - 30, 9, 6, a, 0, M.TAU);
            ctx.fill();
          }
        }
        // borda do meio-fio (faixa clara) com pintura amarela perto das esquinas
        ctx.fillStyle = C.curbTop;
        R(-PAD, m.street.y0 - 16, m.avenue.x0, m.street.y0, C.curbTop);
        R(m.avenue.x1, m.street.y0 - 16, W + PAD, m.street.y0, C.curbTop);
        R(-PAD, m.street.y1, m.avenue.x0, m.street.y1 + 16, C.curbTop);
        R(m.avenue.x1, m.street.y1, W + PAD, m.street.y1 + 16, C.curbTop);
        R(m.avenue.x0 - 16, -PAD, m.avenue.x0, m.street.y0, C.curbTop);
        R(m.avenue.x0 - 16, m.street.y1, m.avenue.x0, H + PAD, C.curbTop);
        R(m.avenue.x1, -PAD, m.avenue.x1 + 16, m.street.y0, C.curbTop);
        R(m.avenue.x1, m.street.y1, m.avenue.x1 + 16, H + PAD, C.curbTop);
        ctx.fillStyle = C.curbYellow;
        R(m.avenue.x0 - 520, m.street.y0 - 16, m.avenue.x0 - 16, m.street.y0, C.curbYellow);
        R(m.avenue.x0 - 16, m.street.y0 - 500, m.avenue.x0, m.street.y0, C.curbYellow);
        // bocas de lobo
        for (const d of m.drains) {
          ctx.fillStyle = '#2a2a2e';
          if (d.side === 'n') ctx.fillRect(d.x - 60, m.street.y0 - 30, 120, 22);
          if (d.side === 's') ctx.fillRect(d.x - 60, m.street.y1 + 8, 120, 22);
          if (d.side === 'w') ctx.fillRect(m.avenue.x0 - 30, d.y - 60, 22, 120);
        }
        // sombras de tudo o que fica em pé (fixas)
        ctx.fillStyle = C.shadow;
        const sh = new Path2D();
        for (const p of this.props) p.shadow && p.shadow(sh);
        ctx.fill(sh);
        // sombra de contato na base dos prédios e muros
        for (const p of this.props) p.contact && p.contact(ctx);
      });

      // ---- face do meio-fio (as bordas viradas para a câmera)
      const face = (ax, ay, bx, by) => {
        const a0 = cam.p({ x: ax, y: ay, z: m.curb });
        const b0 = cam.p({ x: bx, y: by, z: m.curb });
        const a1 = cam.p({ x: ax, y: ay, z: 0 });
        const b1 = cam.p({ x: bx, y: by, z: 0 });
        ctx.fillStyle = C.curbFace;
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(b0.x, b0.y);
        ctx.lineTo(b1.x, b1.y);
        ctx.lineTo(a1.x, a1.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(30,25,30,0.55)';
        ctx.lineWidth = Math.max(1, cam.zoom);
        ctx.beginPath();
        ctx.moveTo(a1.x, a1.y);
        ctx.lineTo(b1.x, b1.y);
        ctx.stroke();
      };
      face(-PAD, m.street.y0, m.avenue.x0, m.street.y0);
      face(m.avenue.x1, m.street.y0, W + PAD, m.street.y0);
      face(m.avenue.x0, -PAD, m.avenue.x0, m.street.y0);
      face(m.avenue.x0, m.street.y1, m.avenue.x0, H + PAD);
      void lift;
    }

    _lawn(ctx, l, rnd) {
      const r = M.rng(l.x0 * 7 + l.y0);
      ctx.fillStyle = '#7b6a4f';
      ctx.fillRect(l.x0 - 14, l.y0 - 14, l.x1 - l.x0 + 28, l.y1 - l.y0 + 28);
      ctx.fillStyle = C.grass;
      ctx.fillRect(l.x0, l.y0, l.x1 - l.x0, l.y1 - l.y0);
      for (let i = 0; i < ((l.x1 - l.x0) * (l.y1 - l.y0)) / 900; i++) {
        const x = l.x0 + r() * (l.x1 - l.x0);
        const y = l.y0 + r() * (l.y1 - l.y0);
        ctx.fillStyle = r() < 0.5 ? C.grassDark : C.grassLight;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 6, y - 26);
        ctx.lineTo(x + 12, y);
        ctx.fill();
      }
      // florzinhas
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = ['#f4f0e0', '#f2c230', '#e86a8f'][i % 3];
        ctx.beginPath();
        ctx.arc(l.x0 + r() * (l.x1 - l.x0), l.y0 + r() * (l.y1 - l.y0), 7, 0, M.TAU);
        ctx.fill();
      }
      void rnd;
    }
  }

  PD.Ground = Ground;
  PD.GROUND_COLORS = C;
})(window.PD = window.PD || {});
