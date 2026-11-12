// Efeitos sintetizados no navegador. O contexto só abre depois de um gesto do jogador.
(function (PD) {
  'use strict';
  class GameAudio {
    constructor() {
      this.context = null; this.master = null; this.charges = new Map(); this.voices = new Set();
      this.previous = new WeakMap(); this.seenEffects = new WeakSet(); this.muted = false;
      try { this.muted = localStorage.getItem('pindorama:som') === '0'; } catch { /* armazenamento opcional */ }
      this.available = !!(window.AudioContext || window.webkitAudioContext);
      window.addEventListener('pointerdown', () => this.unlock(), { passive: true, capture: true });
      window.addEventListener('keydown', () => this.unlock(), { capture: true });
      const button = document.getElementById('btn-sound');
      button?.addEventListener('click', () => this.toggle());
      this.refreshButton();
    }

    refreshButton() {
      const b = document.getElementById('btn-sound');
      if (!b) return;
      b.disabled = !this.available;
      b.textContent = !this.available ? 'Som indisponível' : this.muted ? 'Som desligado' : 'Som ligado';
      b.setAttribute('aria-pressed', String(this.available && !this.muted));
      b.setAttribute('aria-label', this.muted ? 'Ligar efeitos de som' : 'Desligar efeitos de som');
    }

    unlock() {
      if (this.muted || !this.available) return;
      try {
        if (!this.context) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          this.context = new Audio(); this.master = this.context.createGain();
          this.master.gain.value = 0.42; this.master.connect(this.context.destination);
          const count = Math.ceil(this.context.sampleRate * 0.5);
          this.noiseBuffer = this.context.createBuffer(1, count, this.context.sampleRate);
          const samples = this.noiseBuffer.getChannelData(0);
          for (let k = 0; k < count; k++) samples[k] = Math.random() * 2 - 1;
        }
        if (this.context.state === 'suspended') this.context.resume()?.catch?.(() => {});
      } catch { this.available = false; this.refreshButton(); }
    }

    toggle() {
      this.muted = !this.muted;
      try { localStorage.setItem('pindorama:som', this.muted ? '0' : '1'); } catch { /* armazenamento opcional */ }
      if (this.muted) this.silence(); else { this.unlock(); this.tone(440, 520, 0.09, 0.06); }
      this.refreshButton();
    }

    get ready() { return !this.muted && this.context?.state === 'running'; }

    panOf(character, hero) {
      return PD.math.clamp(((character.pos.x - hero.pos.x) - (character.pos.y - hero.pos.y)) / 700, -0.65, 0.65);
    }

    output(node, pan) {
      if (!this.context.createStereoPanner) { node.connect(this.master); return null; }
      const panner = this.context.createStereoPanner(); panner.pan.value = pan; node.connect(panner); panner.connect(this.master); return panner;
    }

    voice(source, gain, extras, duration) {
      const v = { source, gain, extras };
      this.voices.add(v);
      source.onended = () => { this.voices.delete(v); source.disconnect(); gain.disconnect(); for (const n of extras) n?.disconnect(); };
      source.start(); source.stop(this.context.currentTime + duration + 0.02);
      return v;
    }

    tone(start, end, duration, volume, pan = 0, type = 'sine') {
      if (!this.ready || this.voices.size > 24) return;
      const c = this.context, t = c.currentTime, source = c.createOscillator(), gain = c.createGain(); source.type = type;
      source.frequency.setValueAtTime(start, t); source.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + Math.min(0.012, duration * 0.15));
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      source.connect(gain); const panner = this.output(gain, pan); this.voice(source, gain, [panner], duration);
    }

    noise(duration, volume, frequency, pan = 0) {
      if (!this.ready || this.voices.size > 24) return;
      const c = this.context, t = c.currentTime, source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
      source.buffer = this.noiseBuffer; filter.type = 'lowpass'; filter.frequency.value = frequency;
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      source.connect(filter); filter.connect(gain); const panner = this.output(gain, pan); this.voice(source, gain, [filter, panner], duration);
    }

    charge(character, power, pan) {
      let v = this.charges.get(character);
      if (!v) {
        const c = this.context, source = c.createOscillator(), gain = c.createGain(); source.type = 'triangle'; gain.gain.value = 0;
        source.connect(gain); const panner = this.output(gain, pan); source.start();
        v = { source, gain, panner, full: false }; this.charges.set(character, v);
      }
      const t = this.context.currentTime;
      v.source.frequency.setTargetAtTime(105 + power * 250, t, 0.05);
      v.gain.gain.setTargetAtTime(0.018 + power * 0.025, t, 0.035);
      if (v.panner) v.panner.pan.setTargetAtTime(pan, t, 0.04);
      if (power >= 1 - 1e-8 && !v.full) { v.full = true; this.tone(690, 1050, 0.18, 0.12, pan); }
    }

    stopCharge(character) {
      const v = this.charges.get(character);
      if (!v) return;
      this.charges.delete(character);
      const t = this.context.currentTime; v.gain.gain.cancelScheduledValues(t); v.gain.gain.setTargetAtTime(0, t, 0.008);
      v.source.onended = () => { v.source.disconnect(); v.gain.disconnect(); v.panner?.disconnect(); };
      v.source.stop(t + 0.04);
    }

    silence() {
      if (!this.context) return;
      for (const ch of this.charges.keys()) this.stopCharge(ch);
      const t = this.context.currentTime;
      for (const v of this.voices) {
        if (v.stopping) continue;
        v.stopping = true;
        v.gain.gain.cancelScheduledValues(t); v.gain.gain.setTargetAtTime(0, t, 0.008);
        try { v.source.stop(t + 0.04); } catch { /* voz já encerrada */ }
      }
    }

    reset() {
      this.silence(); this.previous = new WeakMap(); this.seenEffects = new WeakSet();
    }

    update(combat, paused) {
      if (!this.ready || paused || combat.paused) { this.silence(); return; }
      const hero = combat.hero.character, activeCharges = new Set();
      for (const f of [combat.hero, combat.enemy]) {
        const ch = f.character, old = this.previous.get(ch) || {}, pan = this.panOf(ch, hero), a = ch.attack;
        if (a?.kind === 'slingshot' && a.stage === 'charging' && !ch.death) {
          activeCharges.add(ch); this.charge(ch, a.power, pan);
        }
        for (const ev of ch.events) {
          if (ev.type === 'pedra') { this.noise(0.10, 0.15 + ev.power * 0.07, 4800, pan); this.tone(260 + ev.power * 170, 75, 0.13, 0.16, pan, 'triangle'); }
          if (ev.type === 'impacto') this.noise(0.10, 0.12, 1800, pan);
        }
        if (ch.dodge && old.dodge !== ch.dodge) this.noise(0.19, 0.12, 2100, pan);
        if (ch.hurt && old.hurt !== ch.hurt) {
          const force = ch.hurt.strength || 0.5;
          this.tone(155 - 45 * force, 70 - 20 * force, 0.10 + 0.04 * force, 0.12 + 0.10 * force, pan, 'triangle');
        }
        if (ch.death && old.death !== ch.death) this.tone(130, 42, 0.32, 0.15, pan, 'triangle');
        if (ch.death?.hit && !old.landed) { this.noise(0.23, 0.28, 550, pan); this.tone(82, 32, 0.22, 0.18, pan); }
        this.previous.set(ch, { dodge: ch.dodge, hurt: ch.hurt, death: ch.death, landed: !!ch.death?.hit });
      }
      for (const ch of this.charges.keys()) if (!activeCharges.has(ch)) this.stopCharge(ch);
      for (const e of combat.effects) {
        if (this.seenEffects.has(e)) continue;
        this.seenEffects.add(e);
        if (e.kind === 'stoneImpact') {
          const pan = PD.math.clamp(((e.x - hero.pos.x) - (e.y - hero.pos.y)) / 700, -0.65, 0.65);
          const variation = [0.96, 1.04, 1.01, 0.93, 1.07][e.soundVariant || 0], power = e.power || 0, body = e.material === 'body';
          this.noise(0.08 + power * 0.06, 0.15 + power * 0.14, (body ? 1200 - power * 500 : 2600) * variation, pan);
          this.tone((body ? 145 - power * 65 : 430) * variation, (body ? 65 - power * 25 : 65) * variation, 0.08 + power * 0.06, 0.11 + power * 0.10, pan, 'triangle');
        } else if (e.kind === 'block' || e.kind === 'guardBreak') {
          if (e.kind === 'block' && e.broke) continue;
          const pan = PD.math.clamp(((e.x - hero.pos.x) - (e.y - hero.pos.y)) / 700, -0.65, 0.65);
          const broke = e.kind === 'guardBreak', variation = [0.96, 1.04, 1.01, 0.93, 1.07][e.soundVariant || 0];
          this.noise(broke ? 0.24 : 0.11, broke ? 0.25 : 0.18, broke ? 950 : 1800 * variation, pan);
          this.tone((broke ? 180 : 240) * variation, broke ? 48 : 110 * variation, broke ? 0.26 : 0.12, 0.17, pan, 'triangle');
        }
      }
    }
  }
  PD.GameAudio = GameAudio;
})(window.PD = window.PD || {});
