// Painel e controles de toque (HTML por cima do jogo). Os ícones dos botões também são desenhados por
// código, num canvas pequeno dentro de cada botão — nenhuma imagem pronta.
(function (PD) {
  'use strict';
  const INK = '#1b100d';

  class UI {
    constructor() {
      this.root = document.body;
      this.state = document.getElementById('state');
      this.fps = document.getElementById('fps');
      this.base = document.getElementById('stick-base');
      this.knob = document.getElementById('stick-knob');
      this.help = document.getElementById('help');
      this.runBtn = document.getElementById('t-run');
      this._icons();
      this._lastLabel = '';
    }

    setMode(mode) {
      document.body.classList.toggle('mode-touch', mode === 'touch');
      document.body.classList.toggle('mode-keyboard', mode !== 'touch');
    }
    setLabel(text) {
      if (text === this._lastLabel) return;
      this._lastLabel = text;
      this.state.textContent = text;
      this.state.dataset.state = text;
    }
    setFps(text) {
      if (this.fps) this.fps.textContent = text;
    }
    showStick(s) {
      const max = 58;
      let dx = s.x - s.ox;
      let dy = s.y - s.oy;
      const l = Math.hypot(dx, dy);
      if (l > max) {
        dx = (dx / l) * max;
        dy = (dy / l) * max;
      }
      this.base.hidden = false;
      this.base.style.transform = `translate(${s.ox}px, ${s.oy}px)`;
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    hideStick() {
      this.base.hidden = true;
    }
    setRun(on) {
      this.runBtn?.classList.toggle('on', on);
      this.runBtn?.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    toggleHelp(force) {
      const show = force ?? this.help.hidden;
      this.help.hidden = !show;
      try {
        localStorage.setItem('pindorama:ajuda', show ? '1' : '0');
      } catch {
        // sem armazenamento: só não lembra
      }
    }

    /** Ícones dos botões de toque (soco, pulo, agachar, correr), desenhados por código. */
    _icons() {
      const draw = (id, fn) => {
        const btn = document.getElementById(id);
        const c = btn && btn.querySelector('canvas');
        if (!c) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const size = 44;
        c.width = size * dpr;
        c.height = size * dpr;
        c.style.width = size + 'px';
        c.style.height = size + 'px';
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        fn(ctx);
      };
      // punho fechado
      draw('t-attack', (ctx) => {
        const blob = (x, y, r, col) => {
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.arc(x, y, r + 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        };
        for (const [x, y] of [[14, 15], [21, 13], [28, 14], [33, 18]]) blob(x, y, 5.5, '#d8874a');
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.roundRect(8, 15, 30, 21, 9);
        ctx.fill();
        ctx.fillStyle = '#d8874a';
        ctx.beginPath();
        ctx.roundRect(10.5, 17, 25, 16.5, 7);
        ctx.fill();
        for (const [x, y] of [[14, 15], [21, 13], [28, 14], [33, 18]]) {
          ctx.fillStyle = '#d8874a';
          ctx.beginPath();
          ctx.arc(x, y, 5.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#a3532a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(17, 12);
        ctx.lineTo(17, 18);
        ctx.moveTo(24.5, 11);
        ctx.lineTo(24.5, 18);
        ctx.moveTo(31, 13);
        ctx.lineTo(31, 19);
        ctx.stroke();
        ctx.fillStyle = '#f2ab63';
        ctx.beginPath();
        ctx.ellipse(16, 25, 7, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // riscos de movimento
        ctx.strokeStyle = '#fff3c4';
        ctx.lineWidth = 2.4;
        for (const y of [20, 27, 34]) {
          ctx.beginPath();
          ctx.moveTo(4, y);
          ctx.lineTo(1, y + 1);
          ctx.stroke();
        }
      });
      // seta para cima com poeira
      draw('t-jump', (ctx) => {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(22, 4);
        ctx.lineTo(38, 22);
        ctx.lineTo(29, 22);
        ctx.lineTo(29, 34);
        ctx.lineTo(15, 34);
        ctx.lineTo(15, 22);
        ctx.lineTo(6, 22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f4b818';
        ctx.beginPath();
        ctx.moveTo(22, 8);
        ctx.lineTo(33.5, 20);
        ctx.lineTo(26.5, 20);
        ctx.lineTo(26.5, 31.5);
        ctx.lineTo(17.5, 31.5);
        ctx.lineTo(17.5, 20);
        ctx.lineTo(10.5, 20);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e8dfcf';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        for (const [x, r] of [[12, 4], [22, 5], [32, 4]]) {
          ctx.beginPath();
          ctx.arc(x, 39, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });
      // seta para baixo sobre uma linha (agachar)
      draw('t-crouch', (ctx) => {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(22, 34);
        ctx.lineTo(38, 17);
        ctx.lineTo(29, 17);
        ctx.lineTo(29, 6);
        ctx.lineTo(15, 6);
        ctx.lineTo(15, 17);
        ctx.lineTo(6, 17);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5d8cf0';
        ctx.beginPath();
        ctx.moveTo(22, 30);
        ctx.lineTo(33.5, 19);
        ctx.lineTo(26.5, 19);
        ctx.lineTo(26.5, 8.5);
        ctx.lineTo(17.5, 8.5);
        ctx.lineTo(17.5, 19);
        ctx.lineTo(10.5, 19);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(6, 39);
        ctx.lineTo(38, 39);
        ctx.stroke();
      });
      // pé com riscos de velocidade (correr)
      draw('t-run', (ctx) => {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        for (const [y, w] of [[14, 14], [22, 18], [30, 12]]) {
          ctx.beginPath();
          ctx.moveTo(4, y);
          ctx.lineTo(4 + w, y);
          ctx.stroke();
        }
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(30, 24, 11, 14, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d8874a';
        ctx.beginPath();
        ctx.ellipse(30, 24, 8.5, 11.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        for (const [x, y] of [[36, 12], [39.5, 16], [41, 21]]) {
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.arc(x, y, 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#d8874a';
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }

  PD.UI = UI;
})(window.PD = window.PD || {});
