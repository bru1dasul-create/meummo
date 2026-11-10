// Controles. Computador: WASD (ou setas) anda, Shift corre, Ctrl ou C agacha (aperta e solta: liga e
// desliga), Espaço pula, clique esquerdo soca na direção do mouse (J soca para a frente).
// Celular: joystick que aparece onde o polegar encosta (lado esquerdo) e botões Soco, Pular, Agachar e
// Correr. A tela mostra os controles que o aparelho tem (e troca se você começar a usar o outro).
//
// Atenção (navegador): segurar Ctrl e apertar W FECHA A ABA no Chrome — a página não consegue impedir.
// Por isso o Ctrl aqui liga/desliga (toque e solte), e existe o C como alternativa.
(function (PD) {
  'use strict';
  const M = PD.math;

  class Input {
    constructor(canvas, cam, ui) {
      this.canvas = canvas;
      this.cam = cam;
      this.ui = ui;
      this.keys = new Set();
      this.edges = new Set(); // teclas apertadas neste quadro
      this.mouse = { x: 0, y: 0, inside: false };
      this.attackQueued = false;
      this.attackDir = null;
      this.touchRun = false;
      this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
      this.touchEdges = new Set();
      this.mode = matchMedia('(any-pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches ? 'touch' : 'keyboard';
      this.onMode = null;
      this._bind();
    }

    setMode(mode) {
      if (mode === this.mode) return;
      this.mode = mode;
      if (this.onMode) this.onMode(mode);
    }

    _bind() {
      const prevent = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
      window.addEventListener('keydown', (e) => {
        if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
        this.setMode('keyboard');
        if (prevent.has(e.code)) e.preventDefault();
        if (e.ctrlKey && /Key[SDA]/.test(e.code)) e.preventDefault(); // Ctrl+S, Ctrl+D... (Ctrl+W não dá)
        if (!e.repeat) this.edges.add(e.code);
        this.keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => {
        this.keys.delete(e.code);
      });
      window.addEventListener('blur', () => this.keys.clear());

      // mouse: clique esquerdo soca para onde o mouse aponta
      this.canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') {
          this.mouse.x = e.clientX;
          this.mouse.y = e.clientY;
          this.mouse.inside = true;
        }
      });
      this.canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') {
          this.setMode('keyboard');
          if (e.button === 0) {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            this.attackQueued = true;
            this.attackAt = { x: e.clientX, y: e.clientY };
          }
          return;
        }
        // toque na tela (fora dos botões): metade esquerda = joystick
        this.setMode('touch');
        if (this.stick.id === null && e.clientX < window.innerWidth * 0.55) {
          this.stick.id = e.pointerId;
          this.stick.ox = this.stick.x = e.clientX;
          this.stick.oy = this.stick.y = e.clientY;
          this.canvas.setPointerCapture?.(e.pointerId);
          this.ui?.showStick(this.stick);
        } else if (e.clientX >= window.innerWidth * 0.55) {
          // toque no lado direito, fora dos botões: soco para a frente
          this.touchEdges.add('attack');
        }
        e.preventDefault();
      });
      const moveStick = (e) => {
        if (e.pointerId !== this.stick.id) return;
        this.stick.x = e.clientX;
        this.stick.y = e.clientY;
        this.ui?.showStick(this.stick);
        e.preventDefault();
      };
      const endStick = (e) => {
        if (e.pointerId !== this.stick.id) return;
        this.stick.id = null;
        this.ui?.hideStick();
      };
      this.canvas.addEventListener('pointermove', moveStick);
      this.canvas.addEventListener('pointerup', endStick);
      this.canvas.addEventListener('pointercancel', endStick);
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      // botões da tela de toque
      const hold = (el, name) => {
        if (!el) return;
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.setMode('touch');
          this.touchEdges.add(name);
          el.classList.add('down');
        });
        const up = () => el.classList.remove('down');
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        el.addEventListener('pointerleave', up);
      };
      hold(document.getElementById('t-attack'), 'attack');
      hold(document.getElementById('t-jump'), 'jump');
      hold(document.getElementById('t-crouch'), 'crouch');
      hold(document.getElementById('t-run'), 'run');
    }

    /** Lê os controles deste quadro para o personagem (e limpa os "apertou agora"). */
    frame(hero) {
      const k = this.keys;
      const e = this.edges;
      const t = this.touchEdges;
      // direção pelas teclas (eixos do mundo isométrico: as 8 direções)
      let sx = 0, sy = 0;
      if (k.has('KeyW') || k.has('ArrowUp')) sy -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) sy += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) sx -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) sx += 1;
      let move = { x: 0, y: 0 };
      if (sx || sy) {
        // cima = (-1,-1), baixo = (1,1), esquerda = (-1,1), direita = (1,-1) no chão
        const x = sx + sy;
        const y = -sx + sy;
        const l = Math.hypot(x, y);
        move = { x: x / l, y: y / l };
      }
      // joystick (direção livre, força pelo quanto empurra)
      if (this.stick.id !== null) {
        const dx = this.stick.x - this.stick.ox;
        const dy = this.stick.y - this.stick.oy;
        const max = 58;
        const len = Math.min(max, Math.hypot(dx, dy));
        if (len > 8) {
          const g = this.cam.groundDir(dx, dy);
          const mag = M.clamp((len - 8) / (max - 8), 0, 1);
          move = { x: g.x * mag, y: g.y * mag };
        }
      }
      if (t.has('run')) {
        this.touchRun = !this.touchRun;
        this.ui?.setRun(this.touchRun);
      }
      const run = k.has('ShiftLeft') || k.has('ShiftRight') || (this.mode === 'touch' && this.touchRun);
      const crouchToggle = e.has('ControlLeft') || e.has('ControlRight') || e.has('KeyC') || t.has('crouch');
      const jump = e.has('Space') || t.has('jump');
      let attack = e.has('KeyJ') || t.has('attack');
      let attackDir = null;
      if (this.attackQueued) {
        attack = true;
        const g = this.cam.screenToGround(this.attackAt.x, this.attackAt.y);
        attackDir = Math.atan2(g.y - hero.pos.y, g.x - hero.pos.x);
        this.attackQueued = false;
      }
      const other = { bones: e.has('KeyB'), help: e.has('KeyH'), zoomIn: e.has('Equal') || e.has('NumpadAdd'), zoomOut: e.has('Minus') || e.has('NumpadSubtract') };
      e.clear();
      t.clear();
      return { move, run, crouchToggle, jump, attack, attackDir, other };
    }
  }

  PD.Input = Input;
})(window.PD = window.PD || {});
