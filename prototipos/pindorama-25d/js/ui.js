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
      this._lifeState = '';
    }

    setMode(mode) {
      this.mode = mode;
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
    setLife(hero) {
      const state = hero.death ? hero.label : hero.hurt ? 'Impacto' : hero.dodge ? 'Esquiva' : 'Vivo';
      if (state === this._lifeState) return;
      this._lifeState = state;
      const death = document.getElementById('btn-death'), restart = document.getElementById('btn-restart');
      if (death) death.disabled = !!hero.death;
      const hit = document.getElementById('btn-hit');
      if (hit) hit.disabled = !!(hero.death || hero.hurt || hero.dodge);
      if (restart) { restart.hidden = !hero.death; restart.disabled = state !== 'Morto'; }
      for (const id of ['t-attack', 't-jump', 't-crouch', 't-run', 't-dodge', 't-guard']) {
        const button = document.getElementById(id);
        if (button) button.disabled = !!(hero.death || hero.hurt);
      }
    }
    setCombat(combat) {
      const hero = combat.hero, rival = combat.enemy;
      const weapon = combat.weapon;
      const shot = hero.character.attack;
      const charging = shot && shot.kind === 'slingshot' && shot.stage === 'charging';
      const charge = charging ? Math.round(shot.power * 100) : 0;
      const guard = PD.guard?.ensure(hero.character), energy = guard ? Math.round(guard.energy) : 100;
      const guardText = hero.character.death ? '—' : guard?.broken > 0 ? 'Guarda quebrada' : guard?.exhausted ? 'Solte a defesa para rearmar' : guard?.active ? (PD.guard.ready(hero.character) ? 'Guarda frontal' : 'Levantando guarda') : energy < 100 ? 'Recuperando energia' : this.mode === 'touch' ? 'Segure Defender' : 'F ou botão direito: defender';
      const weaponBusy = !!(hero.character.death || hero.character.dodge || hero.character.hurt || hero.character.attack || guard?.active);
      const key = [hero.hp, rival.hp, combat.phase, combat.paused, combat.enemyLabel, combat.canReset, weapon, weaponBusy, charge, !!charging, energy, guardText].join(':');
      if (key === this._combatKey) return;
      this._combatKey = key;
      const energyWrap = document.getElementById('energy-wrap'), energyFill = document.getElementById('energy-fill'), energyValue = document.getElementById('energy-value'), guardState = document.getElementById('guard-state'), guardButton = document.getElementById('t-guard');
      if (energyWrap) energyWrap.dataset.low = String(energy < 20);
      if (energyFill) energyFill.style.width = energy + '%';
      if (energyValue) energyValue.textContent = `${energy} / 100`;
      document.getElementById('energy-meter')?.setAttribute('aria-valuenow', String(energy));
      if (guardState && guardState.textContent !== guardText) guardState.textContent = guardText;
      guardButton?.setAttribute('aria-pressed', String(!!guard?.active));
      guardButton?.classList.toggle('down', !!guard?.active);
      for (const [id, value] of [['weapon-fists', 'fists'], ['weapon-slingshot', 'slingshot']]) {
        const b = document.getElementById(id);
        b?.setAttribute('aria-pressed', weapon === value ? 'true' : 'false');
        if (b) b.disabled = weaponBusy;
      }
      const attackLabel = document.getElementById('t-attack-label');
      if (attackLabel) attackLabel.textContent = weapon === 'slingshot' ? (charging ? 'Soltar' : 'Pedra') : 'Soco';
      document.getElementById('t-attack')?.setAttribute('aria-label', weapon === 'slingshot' ? 'Segure para carregar, solte para disparar pedra' : 'Dar soco');
      const chargeWrap = document.getElementById('charge-wrap'), chargeBar = document.getElementById('charge-bar'), chargeFill = document.getElementById('charge-fill'), chargeValue = document.getElementById('charge-value');
      if (chargeWrap) chargeWrap.hidden = weapon !== 'slingshot' || !!hero.character.death;
      chargeBar?.setAttribute('aria-valuenow', String(charge));
      if (chargeFill) chargeFill.style.width = charge + '%';
      if (chargeWrap) chargeWrap.dataset.full = String(charge === 100 && !!charging);
      if (chargeValue) chargeValue.textContent = charging ? `${charge}% · ${PD.slingshot.strength(shot.power).damage} de dano` : 'Segure J, clique ou Pedra; solte para atirar';
      const setMeter = (name, fighter) => {
        const meter = document.getElementById(name + '-health');
        const fill = document.getElementById(name + '-health-fill');
        const value = document.getElementById(name + '-health-value');
        meter?.setAttribute('aria-valuenow', String(fighter.hp));
        meter?.setAttribute('aria-valuemax', String(fighter.maxHp));
        if (fill) fill.style.width = `${fighter.hp / fighter.maxHp * 100}%`;
        if (value) value.textContent = `${fighter.hp} / ${fighter.maxHp}`;
      };
      setMeter('hero', hero); setMeter('enemy', rival);
      const status = document.getElementById('combat-status'), button = document.getElementById('btn-training');
      const enemyState = document.getElementById('enemy-state'), hint = document.getElementById('combat-hint');
      if (enemyState) enemyState.textContent = combat.enemyLabel;
      const message = combat.paused ? 'Treino pausado' : combat.phase === 'won' ? 'Você venceu!' : combat.phase === 'lost' ? 'Você caiu' : combat.phase === 'active' ? 'Treino em andamento' : 'Pronto para treinar?';
      if (status) { if (status.textContent !== message) status.textContent = message; status.dataset.phase = combat.phase; }
      if (button) {
        button.textContent = combat.paused ? 'Retomar treino' : combat.phase === 'ready' ? 'Começar treino' : combat.phase === 'won' ? 'Treinar de novo' : combat.phase === 'lost' ? 'Tentar de novo' : 'Reiniciar treino';
        button.disabled = !combat.paused && !combat.canReset;
      }
      if (hint) hint.textContent = combat.paused ? 'Retome quando estiver pronto.' : combat.phase === 'active' ? (weapon === 'slingshot' ? 'Segure e solte para atirar · F ou botão direito defende · Q esquiva.' : 'J ou clique soca · F ou botão direito defende · 2 equipa o estilingue.') : combat.phase === 'won' ? (combat.canReset ? 'Pode continuar andando e atirando. Enter ou R iniciam outra rodada.' : 'Pode andar e atirar enquanto o rival termina a queda.') : combat.phase === 'lost' ? (combat.canReset ? 'Enter, R ou o botão começam outra rodada.' : 'Aguarde a animação terminar para recomeçar.') : 'Escolha sua arma. F ou botão direito mantém a guarda frontal.';
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
      draw('t-dodge', (ctx) => {
        ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(8, 10); ctx.lineTo(2, 10); ctx.moveTo(8, 17); ctx.lineTo(2, 17); ctx.stroke();
        ctx.beginPath(); ctx.arc(25, 9, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(24, 16); ctx.lineTo(17, 26); ctx.lineTo(29, 31); ctx.lineTo(36, 39);
        ctx.moveTo(18, 26); ctx.lineTo(11, 35); ctx.lineTo(3, 35); ctx.moveTo(21, 20); ctx.lineTo(31, 22); ctx.stroke();
      });
      draw('t-guard', (ctx) => {
        ctx.fillStyle = '#72b6cf'; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(22, 4); ctx.lineTo(37, 10); ctx.lineTo(34, 28); ctx.quadraticCurveTo(31, 35, 22, 40);
        ctx.quadraticCurveTo(13, 35, 10, 28); ctx.lineTo(7, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#f8e8c7'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(15, 27); ctx.lineTo(23, 16); ctx.moveTo(29, 27); ctx.lineTo(21, 16); ctx.stroke();
      });
    }
  }

  PD.UI = UI;
})(window.PD = window.PD || {});
