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
      this.mouseAttackDown = false;
      this.firePointers = new Set();
      this.guardPointers = new Set(); this.mouseGuardDown = false;
      this.attackReleaseQueued = false;
      this.attackCancelQueued = false;
      this.attackWasHeld = false;
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

    cancelAttack() {
      this.keys.delete('KeyJ'); this.edges.delete('KeyJ'); this.touchEdges.delete('attack');
      this.mouseAttackDown = false; this.firePointers.clear(); this.attackQueued = false;
      this.attackReleaseQueued = false; this.attackWasHeld = false; this.attackCancelQueued = true;
    }

    cancelGuard() {
      this.keys.delete('KeyF'); this.edges.delete('KeyF'); this.guardPointers.clear(); this.mouseGuardDown = false;
    }

    cancelActions() { this.cancelAttack(); this.cancelGuard(); }

    _bind() {
      const prevent = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyF']);
      window.addEventListener('keydown', (e) => {
        if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
        if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey || e.altKey)) return;
        if (e.code === 'Enter' && e.target && /BUTTON|A|SUMMARY/.test(e.target.tagName)) return;
        this.setMode('keyboard');
        if (prevent.has(e.code)) e.preventDefault();
        if (e.ctrlKey && /Key[SDA]/.test(e.code)) e.preventDefault(); // Ctrl+S, Ctrl+D... (Ctrl+W não dá)
        if (!e.repeat) this.edges.add(e.code);
        if (e.code === 'KeyJ' && !e.repeat) this.attackCancelQueued = false;
        if (e.code === 'KeyF' && !e.repeat) this.cancelAttack();
        this.keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyJ' && (this.keys.has('KeyJ') || this.edges.has('KeyJ'))) this.attackReleaseQueued = true;
        this.keys.delete(e.code);
      });
      window.addEventListener('blur', () => {
        this.keys.clear(); this.edges.clear(); this.touchEdges.clear(); this.attackQueued = false;
        this.cancelAttack();
        this.cancelGuard();
        this.stick.id = null; this.ui?.hideStick();
      });

      // mouse: clique esquerdo soca para onde o mouse aponta
      this.canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') {
          this.mouse.x = e.clientX;
          this.mouse.y = e.clientY;
          this.mouse.inside = true;
          if (Number.isFinite(e.buttons)) {
            if ((e.buttons & 2) && !this.mouseGuardDown) { this.cancelAttack(); this.mouseGuardDown = true; }
            if (!(e.buttons & 2)) this.mouseGuardDown = false;
            if (!(e.buttons & 1) && this.mouseAttackDown) { this.mouseAttackDown = false; this.attackReleaseQueued = true; }
          }
        }
      });
      this.canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') {
          this.setMode('keyboard');
          if (e.button === 0) {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            this.attackQueued = true;
            this.mouseAttackDown = true;
            this.attackCancelQueued = false;
            this.attackAt = { x: e.clientX, y: e.clientY };
            try { this.canvas.setPointerCapture?.(e.pointerId); } catch {}
          } else if (e.button === 2) {
            this.mouse.x = e.clientX; this.mouse.y = e.clientY;
            this.cancelAttack(); this.mouseGuardDown = true;
            try { this.canvas.setPointerCapture?.(e.pointerId); } catch {}
          }
          return;
        }
        // toque na tela (fora dos botões): metade esquerda = joystick
        this.setMode('touch');
        if (this.stick.id === null && e.clientX < window.innerWidth * 0.55) {
          this.stick.id = e.pointerId;
          this.stick.ox = this.stick.x = e.clientX;
          this.stick.oy = this.stick.y = e.clientY;
          try {
            this.canvas.setPointerCapture?.(e.pointerId);
          } catch {
            // alguns navegadores recusam: o joystick segue funcionando sem a captura
          }
          this.ui?.showStick(this.stick);
        } else if (e.clientX >= window.innerWidth * 0.55) {
          // toque no lado direito, fora dos botões: soco para a frente
          this.touchEdges.add('attack');
          this.firePointers.add('canvas:' + (e.pointerId ?? -1));
          this.attackCancelQueued = false;
          try { this.canvas.setPointerCapture?.(e.pointerId); } catch {}
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
      const releaseFire = (e, cancelled = false) => {
        let released = this.firePointers.delete('canvas:' + (e.pointerId ?? -1));
        released = this.firePointers.delete('button:' + (e.pointerId ?? -1)) || released;
        if ((e.pointerType === 'mouse' || e.pointerType === undefined && e.button === 0) && (e.button === 0 || e.button === undefined) && this.mouseAttackDown) {
          this.mouseAttackDown = false; released = true;
        }
        if (released) {
          if (cancelled) this.cancelAttack(); else this.attackReleaseQueued = true;
        }
      };
      this.canvas.addEventListener('pointerup', e => releaseFire(e));
      this.canvas.addEventListener('pointercancel', e => releaseFire(e, true));
      window.addEventListener('pointerup', e => releaseFire(e));
      window.addEventListener('pointercancel', e => releaseFire(e, true));
      const releaseGuard = (e, cancelled = false) => {
        this.guardPointers.delete('button:' + (e.pointerId ?? -1));
        if ((e.pointerType === 'mouse' || e.pointerType === undefined && e.button === 2) && (e.button === 2 || e.button === undefined || cancelled || Number.isFinite(e.buttons) && !(e.buttons & 2))) this.mouseGuardDown = false;
      };
      this.canvas.addEventListener('pointerup', e => releaseGuard(e));
      this.canvas.addEventListener('pointercancel', e => releaseGuard(e, true));
      window.addEventListener('pointerup', e => releaseGuard(e));
      window.addEventListener('pointercancel', e => releaseGuard(e, true));
      window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && this.mouseGuardDown && Number.isFinite(e.buttons) && !(e.buttons & 2)) this.mouseGuardDown = false; });
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      // botões da tela de toque
      const hold = (el, name) => {
        if (!el) return;
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.setMode('touch');
          this.touchEdges.add(name);
          if (name === 'attack') {
            this.firePointers.add('button:' + (e.pointerId ?? -1));
            this.attackCancelQueued = false;
            try { el.setPointerCapture?.(e.pointerId); } catch {}
          } else if (name === 'guard') {
            this.cancelAttack(); this.guardPointers.add('button:' + (e.pointerId ?? -1));
            try { el.setPointerCapture?.(e.pointerId); } catch {}
          }
          el.classList.add('down');
        });
        const up = (e, cancelled) => { el.classList.remove('down'); if (name === 'attack') releaseFire(e, cancelled); if (name === 'guard') releaseGuard(e, cancelled); };
        el.addEventListener('pointerup', e => up(e, false));
        el.addEventListener('pointercancel', e => up(e, true));
        el.addEventListener('pointerleave', () => { if (name !== 'attack' && name !== 'guard') el.classList.remove('down'); });
      };
      hold(document.getElementById('t-attack'), 'attack');
      hold(document.getElementById('t-jump'), 'jump');
      hold(document.getElementById('t-crouch'), 'crouch');
      hold(document.getElementById('t-run'), 'run');
      hold(document.getElementById('t-dodge'), 'dodge');
      hold(document.getElementById('t-guard'), 'guard');
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
      const dodge = e.has('KeyQ') || t.has('dodge');
      let attack = e.has('KeyJ') || t.has('attack');
      const guardHeld = k.has('KeyF') || this.mouseGuardDown || this.guardPointers.size > 0;
      const attackHeld = k.has('KeyJ') || this.mouseAttackDown || this.firePointers.size > 0;
      const attackReleased = !attackHeld && (this.attackReleaseQueued || this.attackWasHeld);
      const attackCancel = this.attackCancelQueued;
      let attackDir = null;
      let aimPoint = null;
      let guardDir = null;
      if (this.attackQueued || this.mouseAttackDown) {
        if (this.attackQueued) attack = true;
        const point = this.mouseAttackDown ? this.mouse : this.attackAt;
        const g = this.cam.screenToGround(point.x, point.y);
        attackDir = Math.atan2(g.y - hero.pos.y, g.x - hero.pos.x);
        aimPoint = { x: point.x, y: point.y };
        this.attackQueued = false;
      }
      if (this.mouseGuardDown) {
        const point = this.cam.screenToGround(this.mouse.x, this.mouse.y);
        guardDir = Math.atan2(point.y - hero.pos.y, point.x - hero.pos.x); aimPoint = { x: this.mouse.x, y: this.mouse.y };
      }
      if (guardHeld) attack = false;
      const other = { start: e.has('Enter'), bones: e.has('KeyB'), help: e.has('KeyH'), restart: e.has('KeyR'), zoomIn: e.has('Equal') || e.has('NumpadAdd'), zoomOut: e.has('Minus') || e.has('NumpadSubtract'), weapon: e.has('Digit1') ? 'fists' : e.has('Digit2') ? 'slingshot' : null };
      const die = e.has('KeyK');
      const hit = e.has('KeyE');
      e.clear();
      t.clear();
      this.attackWasHeld = attackHeld;
      this.attackReleaseQueued = false; this.attackCancelQueued = false;
      return { move, run, crouchToggle, jump, attack, attackHeld, attackReleased: guardHeld ? false : attackReleased, attackCancel: attackCancel || guardHeld, attackDir, aimPoint, guardHeld, guardDir, dodge, die, hit, other };
    }
  }

  PD.Input = Input;
})(window.PD = window.PD || {});
