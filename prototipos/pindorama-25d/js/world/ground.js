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

    /** Altura do chão no ponto (rua 0, resto 14 cm). Nos mapas do mundo novo o chão é todo no nível 0. */
    heightAt(x, y) {
      const m = this.map;
      if (m.kind === 'tmj') return 0;
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
      if (this.map.kind === 'tmj') return this._paintShapes(ctx, view);
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

  // ------------------------------------------------------------ chão dos mapas do mundo novo (.tmj)
  // cores do Mapa 01 ("2.5D estilizado e sombrio"): mata fria e funda, grama viva na clareira, terra e trilha quentes
  const MAT = {
    mata: { base: '#1d3123', dots: ['#26402a', '#162619', '#2f4d2c', '#3d3424', '#213a26'], n: 7, size: [6, 16] },
    grama: { base: '#3d6a32', dots: ['#4b7c3a', '#335c2a', '#5b8d43', '#2e5226'], n: 9, size: [4, 9], edge: '#2a4a24', flowers: ['#e9d36a', '#e7a5c9', '#f3f0e2'] },
    terra: { base: '#6a4e34', dots: ['#5a412b', '#7b5c3e', '#857d70', '#4d3824'], n: 6, size: [4, 10] },
    trilha: { base: '#7a5c3c', dots: ['#694d31', '#8c6c48', '#9a9283', '#5a412b'], n: 6, size: [3, 8], edge: '#4e3923' },
    asfalto: { base: '#3d4045', dots: ['#474a50', '#33363a', '#52555b'], n: 7, size: [3, 7] },
    areia: { base: '#b89a66', dots: ['#a88a58', '#c8ab78', '#9a7d4c'], n: 6, size: [3, 7] },
    agua: { base: '#22484f', dots: ['#2b5960', '#1b3b42', '#3a6f72'], n: 3, size: [8, 20] },
    circulo: { base: '#8b867b', dots: ['#7a756b', '#9c978b', '#6c675e'], n: 5, size: [6, 12], edge: '#4f4b44' },
    // os que o [mundo] vai usar na etapa 4 (lago, lama, mata profunda, vila) — já com cara, para não virar terra
    'mata-profunda': { base: '#13251a', dots: ['#1a3021', '#0e1b13', '#22382a', '#2b2a1f'], n: 7, size: [6, 16] },
    lama: { base: '#4a3826', dots: ['#3c2d1e', '#5a4530', '#2f2418', '#5b5a4c'], n: 6, size: [5, 14] },
    clareira: { base: '#4b7a3a', dots: ['#5a8a44', '#3f6b31', '#6a9a4e', '#365e2b'], n: 9, size: [4, 9], flowers: ['#e9d36a', '#f3f0e2'] },
    calcada: { base: '#8f8c82', dots: ['#7f7c73', '#a19e93', '#6f6c64'], n: 6, size: [3, 7] },
    rua: { base: '#3f4247', dots: ['#4a4d53', '#35383c', '#55585e'], n: 7, size: [3, 7] },
    pedra: { base: '#77736b', dots: ['#67635c', '#8a867d', '#5a564f'], n: 5, size: [6, 12] },
    // vila (etapa 4b): praça de pedra portuguesa e faixa de pedestre (pintores próprios logo abaixo)
    praca: { base: '#e6e0d2', dots: [], n: 0, size: [0, 0], edge: '#8f8c82' },
    faixa: { base: '#3d4045', dots: [], n: 0, size: [0, 0] },
  };
  const matOf = (t) => MAT[t] || MAT.terra;

  /** O ponto (x, y) está dentro da forma? */
  function inside(sh, x, y) {
    if (sh.kind === 'point') return false;
    if (sh.kind === 'rect') return x >= sh.x0 && x <= sh.x1 && y >= sh.y0 && y <= sh.y1;
    if (sh.kind === 'ellipse') {
      const dx = (x - sh.cx) / sh.rx;
      const dy = (y - sh.cy) / sh.ry;
      return dx * dx + dy * dy <= 1;
    }
    if (sh.kind === 'line') {
      const h = sh.width / 2;
      for (let i = 0; i + 1 < sh.pts.length; i++) {
        const a = sh.pts[i], b = sh.pts[i + 1];
        const vx = b.x - a.x, vy = b.y - a.y;
        const l2 = vx * vx + vy * vy || 1;
        const t = M.clamp(((x - a.x) * vx + (y - a.y) * vy) / l2, 0, 1);
        const qx = a.x + vx * t - x, qy = a.y + vy * t - y;
        if (qx * qx + qy * qy <= h * h) return true;
      }
      return false;
    }
    if (sh.kind === 'poly') {
      let c = false;
      const p = sh.pts;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        if (p[i].y > y !== p[j].y > y && x < ((p[j].x - p[i].x) * (y - p[i].y)) / (p[j].y - p[i].y) + p[i].x) c = !c;
      }
      return c;
    }
    return false;
  }
  function shapeBox(sh) {
    if (sh.kind === 'rect') return sh;
    if (sh.kind === 'point') {
      const r = Math.max(60, (sh.r || 40) * 2.5);
      return { x0: sh.x - r, x1: sh.x + r, y0: sh.y - r, y1: sh.y + r };
    }
    if (sh.kind === 'ellipse') return { x0: sh.cx - sh.rx, x1: sh.cx + sh.rx, y0: sh.cy - sh.ry, y1: sh.cy + sh.ry };
    const pad = sh.kind === 'line' ? sh.width / 2 : 0;
    const xs = sh.pts.map((p) => p.x), ys = sh.pts.map((p) => p.y);
    return { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad };
  }
  function shapePath(ctx, sh) {
    ctx.beginPath();
    if (sh.kind === 'point') return;
    if (sh.kind === 'rect') ctx.rect(sh.x0, sh.y0, sh.x1 - sh.x0, sh.y1 - sh.y0);
    else if (sh.kind === 'ellipse') ctx.ellipse(sh.cx, sh.cy, sh.rx, sh.ry, 0, 0, M.TAU);
    else {
      sh.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (sh.kind === 'poly') ctx.closePath();
    }
  }
  // número fixo por metro quadrado: o mesmo pontinho sai igual em qualquer pedaço da tela
  const cellRng = (i, j, s) => M.rng(((i * 73856093) ^ (j * 19349663) ^ (s * 83492791)) >>> 0);

  // para os pintores da rua (street.js), que carregam depois deste arquivo
  PD.groundHelp = { inside, shapeBox, shapePath, cellRng, MAT };

  Ground.prototype._paintShapes = function (ctx, view) {
    const cam = this.cam;
    const m = this.map;
    // o pedaço da tela volta para o chão: só pinta o que cai nele
    const inv = (sx, sy) => {
      const a = sx / (K * cam.zoom);
      const b = sy / (K * cam.sinP * cam.zoom);
      return { x: (a + b) / 2, y: (b - a) / 2 };
    };
    const cs = [inv(view.x, view.y), inv(view.x + view.w, view.y), inv(view.x, view.y + view.h), inv(view.x + view.w, view.y + view.h)];
    const box = { x0: Math.min(...cs.map((c) => c.x)) - 40, x1: Math.max(...cs.map((c) => c.x)) + 40, y0: Math.min(...cs.map((c) => c.y)) - 40, y1: Math.max(...cs.map((c) => c.y)) + 40 };
    ctx.save();
    ctx.transform(...cam.groundMatrix());
    // em volta de tudo, mata (a câmera vê além da borda do mapa)
    ctx.fillStyle = MAT.mata.base;
    ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    this._texture(ctx, { type: 'mata', kind: 'rect', x0: -1e6, x1: 1e6, y0: -1e6, y1: 1e6 }, box, 0);
    const env = { map: m, g: this, box };
    m.shapes.forEach((sh, n) => {
      const b = shapeBox(sh);
      if (b.x1 < box.x0 || b.x0 > box.x1 || b.y1 < box.y0 || b.y0 > box.y1) return;
      // detalhes da rua (meio-fio, faixa, remendo, bueiro, tampa, buraco, poça, rachadura, raiz, capim): street.js
      const sp = PD.street && PD.street.paint[sh.type];
      if (sp) {
        sp(ctx, sh, env);
        return;
      }
      if (sh.kind === 'point') return;
      const mat = matOf(sh.type);
      if (sh.kind === 'line') {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (mat.edge) {
          shapePath(ctx, sh);
          ctx.strokeStyle = mat.edge;
          ctx.lineWidth = sh.width + 24;
          ctx.stroke();
        }
        shapePath(ctx, sh);
        ctx.strokeStyle = mat.base;
        ctx.lineWidth = sh.width;
        ctx.stroke();
      } else {
        if (mat.edge) {
          // borda um pouco mais escura (a grama "pisa" na mata, a pedra do círculo tem beirada)
          shapePath(ctx, sh);
          ctx.strokeStyle = mat.edge;
          ctx.lineWidth = sh.type === 'circulo' ? 26 : 30;
          ctx.stroke();
        }
        shapePath(ctx, sh);
        ctx.fillStyle = sh.color || mat.base;
        ctx.fill();
      }
      this._texture(ctx, sh, box, n + 1);
      if (sh.type === 'circulo') this._circleStone(ctx, sh);
    });
    // a figueira que rompeu a esquina: o chão quebrado em volta do tronco
    if (PD.street) {
      for (const t of m.trees || []) {
        if (t.breaks && t.x + 700 > box.x0 && t.x - 700 < box.x1 && t.y + 700 > box.y0 && t.y - 700 < box.y1) PD.street.breaks(ctx, t, env);
      }
    }
    // sombras do que fica em pé (fixas), só das coisas perto deste pedaço
    ctx.fillStyle = C.shadow;
    const shade = new Path2D();
    const reach = 1200; // a sombra de uma árvore alta cai longe
    for (const p of this.props) {
      const f = p.fp;
      if (!p.shadow || f.x1 < box.x0 - reach || f.x0 > box.x1 + reach || f.y1 < box.y0 - reach || f.y0 > box.y1 + reach) continue;
      p.shadow(shade);
    }
    ctx.fill(shade);
    ctx.restore();
  };

  /** Pontinhos de textura da forma, só dentro dela e dentro do pedaço. */
  Ground.prototype._texture = function (ctx, sh, box, seed) {
    // o padrão novo da rua (street.js): asfalto de verdade, calçada de placas, campinho
    const st = PD.street && PD.street.texture[sh.type];
    if (st && st(ctx, sh, box, seed, this, this.map)) return;
    if (sh.type === 'agua') return this._water(ctx, sh, box, seed);
    if (sh.type === 'praca') {
      this._portuguese(ctx, sh, seed);
      if (sh.moss && PD.street) PD.street.moss(ctx, sh, box, seed, this);
      return;
    }
    if (sh.type === 'faixa') return this._crosswalk(ctx, sh);
    const mat = matOf(sh.type);
    const b = shapeBox(sh);
    const i0 = Math.floor(Math.max(b.x0, box.x0) / 100), i1 = Math.floor(Math.min(b.x1, box.x1) / 100);
    const j0 = Math.floor(Math.max(b.y0, box.y0) / 100), j1 = Math.floor(Math.min(b.y1, box.y1) / 100);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const r = cellRng(i, j, seed + 7);
        for (let k = 0; k < mat.n; k++) {
          const x = (i + r()) * 100;
          const y = (j + r()) * 100;
          const c = mat.dots[Math.floor(r() * mat.dots.length)];
          const w = mat.size[0] + r() * (mat.size[1] - mat.size[0]);
          if (!inside(sh, x, y)) continue;
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.ellipse(x, y, w, w * (0.5 + r() * 0.5), r() * 3, 0, M.TAU);
          ctx.fill();
        }
        // florzinhas na grama
        if (mat.flowers && r() < 0.18) {
          const x = (i + r()) * 100, y = (j + r()) * 100;
          if (inside(sh, x, y)) {
            ctx.fillStyle = mat.flowers[Math.floor(r() * mat.flowers.length)];
            for (let f = 0; f < 3; f++) {
              ctx.beginPath();
              ctx.arc(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30, 2.6, 0, M.TAU);
              ctx.fill();
            }
          }
        }
      }
    }
  };

  /**
   * Água (o dono achou o lago "cheio de pintinhas"): funda e escura no meio, clareando em faixas suaves até a margem,
   * uma linha de espuma na beira e marolas finas aqui e ali. Tudo em cm do chão (o pedaço já está na projeção do chão,
   * então um arco de círculo vira a marola achatada da câmera).
   */
  Ground.prototype._water = function (ctx, sh, box, seed) {
    const base = sh.color || MAT.agua.base;
    ctx.save();
    shapePath(ctx, sh);
    ctx.clip();
    ctx.fillStyle = M.shade(base, -0.38);
    shapePath(ctx, sh);
    ctx.fill();
    // da parte funda para a margem: cada faixa (o traço dentro da forma recortada) um pouco mais clara
    ctx.lineJoin = 'round';
    // muitas faixas com passo pequeno: a passagem do fundo para a margem fica suave (sem degraus de mapa de relevo)
    const N = 16;
    for (let k = 0; k < N; k++) {
      const u = k / (N - 1);
      ctx.strokeStyle = M.shade(base, -0.34 + u * 0.56);
      ctx.lineWidth = 1400 * Math.pow(1 - u, 1.6) + 70;
      shapePath(ctx, sh);
      ctx.stroke();
    }
    // espuma na beira
    ctx.strokeStyle = 'rgba(214, 246, 238, 0.42)';
    ctx.lineWidth = 16;
    shapePath(ctx, sh);
    ctx.stroke();
    // marolas: arcos finos e claros, poucos
    const b = shapeBox(sh);
    const i0 = Math.floor(Math.max(b.x0, box.x0) / 200), i1 = Math.floor(Math.min(b.x1, box.x1) / 200);
    const j0 = Math.floor(Math.max(b.y0, box.y0) / 200), j1 = Math.floor(Math.min(b.y1, box.y1) / 200);
    ctx.lineCap = 'round';
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const r = cellRng(i, j, seed + 31);
        if (r() > 0.42) continue;
        const x = (i + r()) * 200;
        const y = (j + r()) * 200;
        if (!inside(sh, x, y)) continue;
        const rad = 30 + r() * 45;
        const a0 = -2.4 + r() * 0.6;
        ctx.strokeStyle = `rgba(206, 244, 236, ${0.2 + r() * 0.14})`;
        ctx.lineWidth = 4 + r() * 2;
        ctx.beginPath();
        ctx.arc(x, y, rad, a0, a0 + 1 + r() * 0.5);
        ctx.stroke();
        if (r() < 0.5) {
          ctx.beginPath();
          ctx.arc(x + 14, y + 10, rad * 0.62, a0 + 0.2, a0 + 1.1);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  };

  /**
   * Praça de pedra portuguesa: chão claro de pedrinhas com as ondas pretas (o desenho 'ondas', como o calçadão de
   * Copacabana), cada onda uma faixa larga e ondulada; as pedrinhas aparecem como pontinhos de junta.
   */
  Ground.prototype._portuguese = function (ctx, sh, seed) {
    ctx.save();
    shapePath(ctx, sh);
    ctx.clip();
    const b = shapeBox(sh);
    const dark = '#2b2a28';
    const amp = 55;
    const wave = 260; // comprimento de uma onda (cm)
    const band = 70; // largura da faixa preta
    // as ondas correm no sentido x; uma a cada 2 m em y
    ctx.fillStyle = dark;
    for (let y0 = b.y0 - 120; y0 < b.y1 + 120; y0 += 200) {
      ctx.beginPath();
      for (let x = b.x0 - 20; x <= b.x1 + 20; x += 10) {
        const y = y0 + Math.sin(((x - b.x0) / wave) * M.TAU) * amp;
        x === b.x0 - 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      for (let x = b.x1 + 20; x >= b.x0 - 20; x -= 10) ctx.lineTo(x, y0 + band + Math.sin(((x - b.x0) / wave) * M.TAU) * amp);
      ctx.closePath();
      ctx.fill();
    }
    // juntas das pedrinhas: pontinhos regulares, mais visíveis no claro
    const r = cellRng(Math.floor(b.x0 / 100), Math.floor(b.y0 / 100), seed + 5);
    ctx.fillStyle = 'rgba(120, 112, 98, 0.35)';
    for (let x = b.x0; x < b.x1; x += 14) {
      for (let y = b.y0; y < b.y1; y += 14) {
        if (r() < 0.55) ctx.fillRect(x + r() * 4, y + r() * 4, 2.4, 2.4);
      }
    }
    // marcas de uso e algumas pedras soltas
    ctx.fillStyle = 'rgba(60, 54, 44, 0.12)';
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.ellipse(b.x0 + r() * (b.x1 - b.x0), b.y0 + r() * (b.y1 - b.y0), 60 + r() * 90, 30 + r() * 50, r() * 3, 0, M.TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  /** Faixa de pedestre: listras brancas e gastas sobre o asfalto, compridas no sentido da propriedade `listras`. */
  Ground.prototype._crosswalk = function (ctx, sh) {
    ctx.save();
    shapePath(ctx, sh);
    ctx.clip();
    const b = shapeBox(sh);
    const alongY = (sh.stripes || 'y') === 'y';
    const step = 60, w = 34;
    ctx.fillStyle = 'rgba(236, 232, 220, 0.88)';
    if (alongY) for (let x = b.x0 + 12; x < b.x1 - 10; x += step) ctx.fillRect(x, b.y0 + 10, w, b.y1 - b.y0 - 20);
    else for (let y = b.y0 + 12; y < b.y1 - 10; y += step) ctx.fillRect(b.x0 + 10, y, b.x1 - b.x0 - 20, w);
    // tinta gasta: falhas escuras nas listras
    const r = cellRng(Math.floor(b.x0 / 100), Math.floor(b.y0 / 100), 77);
    ctx.fillStyle = 'rgba(61, 64, 69, 0.55)';
    for (let k = 0; k < (b.x1 - b.x0) * (b.y1 - b.y0) / 2500; k++) {
      ctx.beginPath();
      ctx.ellipse(b.x0 + r() * (b.x1 - b.x0), b.y0 + r() * (b.y1 - b.y0), 4 + r() * 10, 3 + r() * 6, r() * 3, 0, M.TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  /** O círculo ancestral no chão: pedra com anéis e rachaduras entalhadas (o brilho vem do mundo, animado). */
  Ground.prototype._circleStone = function (ctx, sh) {
    const r = Math.min(sh.rx, sh.ry);
    const glow = (this.map.awakening && this.map.awakening.color) || '#3fd6c8';
    ctx.save();
    ctx.strokeStyle = '#4f4b44';
    ctx.lineWidth = 7;
    for (const k of [0.78, 0.5]) {
      ctx.beginPath();
      ctx.ellipse(sh.cx, sh.cy, r * k, r * k, 0, 0, M.TAU);
      ctx.stroke();
    }
    // lajotas: raios entre os anéis
    ctx.lineWidth = 4;
    for (let a = 0; a < 16; a++) {
      const t = (a / 16) * M.TAU + 0.1;
      ctx.beginPath();
      ctx.moveTo(sh.cx + Math.cos(t) * r * 0.78, sh.cy + Math.sin(t) * r * 0.78);
      ctx.lineTo(sh.cx + Math.cos(t) * r * 0.98, sh.cy + Math.sin(t) * r * 0.98);
      ctx.stroke();
    }
    // entalhes (o desenho que acende): uma estrela de oito pontas e rachaduras saindo dela
    ctx.strokeStyle = M.mix ? M.mix('#2a3a38', glow, 0.35) : '#2f6f6a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const t = (k / 16) * M.TAU;
      const rr = (k % 2 ? 0.2 : 0.42) * r;
      const x = sh.cx + Math.cos(t) * rr, y = sh.cy + Math.sin(t) * rr;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    const rnd = M.rng(Math.round(sh.cx + sh.cy));
    ctx.lineWidth = 3.5;
    for (let k = 0; k < 9; k++) {
      let t = rnd() * M.TAU;
      let d = r * 0.44;
      ctx.beginPath();
      ctx.moveTo(sh.cx + Math.cos(t) * d, sh.cy + Math.sin(t) * d);
      for (let s = 0; s < 4; s++) {
        d += r * (0.08 + rnd() * 0.08);
        t += (rnd() - 0.5) * 0.35;
        ctx.lineTo(sh.cx + Math.cos(t) * d, sh.cy + Math.sin(t) * d);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  PD.Ground = Ground;
  PD.GROUND_COLORS = C;
})(window.PD = window.PD || {});
