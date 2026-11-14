// Efeitos sonoros sintetizados na hora (Web Audio), sem arquivos de som.
// Quando tivermos sons de verdade, dá para trocar cada receita por um arquivo carregado.
// Desde 14/11 o som é da [estrutura] (escolha do dono): quem liga o som no motor também faz o som.

import type { ShotKind } from '../shared/items';

export type SoundName =
  | 'shot'
  | 'hit'
  | 'hurt'
  | 'warn'
  | 'dash'
  | 'levelup'
  | 'death'
  | 'heal'
  | 'kill'
  | 'arc'
  | 'loot'
  | 'rare'
  | 'equip'
  | 'charge'
  | 'fire'
  | 'coins'
  | 'coin'
  | 'buy'
  | 'sell'
  | 'block'
  | 'guard-break'
  | 'pull-full'
  | 'bow-release';

const MUTE_KEY = 'meummo:som-desligado';
/** O mesmo som não toca mais de uma vez nesse intervalo (evita barulheira). */
const MIN_GAP_MS = 45;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly lastPlayed = new Map<SoundName, number>();
  /**
   * O som contínuo da puxada, que sobe com a carga: o zumbido do elástico do estilingue (revisão 17) ou o rangido da
   * corda do arco (mais grave e áspero).
   */
  private pull: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode | null; kind: ShotKind; full: boolean } | null = null;
  muted: boolean;

  constructor() {
    this.muted = readMuted();
  }

  /** Os navegadores só deixam tocar som depois de um clique ou toque: chame num desses momentos. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtor) return;
        this.ctx = new AudioCtor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
        const length = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      }
      void this.ctx.resume();
    } catch {
      this.ctx = null; // sem áudio neste navegador: o jogo segue mudo
    }
  }

  /**
   * Puxando o estilingue (`pedra`) ou o arco (`flecha`): chame a cada quadro com a carga (0 a 1). O tom sobe e fica
   * mais forte com a carga; quando enche, um "plim". O do estilingue é a receita da revisão 17 do protótipo
   * (js/audio.js); o do arco é um rangido de corda, mais grave, passando por um filtro.
   */
  charge(power: number, kind: ShotKind = 'pedra'): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || ctx.state !== 'running') {
      this.stopCharge();
      return;
    }
    const p = Math.max(0, Math.min(1, power));
    const t = ctx.currentTime;
    if (this.pull && this.pull.kind !== kind) this.stopCharge(); // trocou de arma no meio: recomeça com o som certo
    if (!this.pull) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      let filter: BiquadFilterNode | null = null;
      if (kind === 'flecha') {
        osc.type = 'sawtooth';
        osc.frequency.value = 70;
        filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 520;
        filter.Q.value = 4;
        osc.connect(filter).connect(gain).connect(this.master!);
      } else {
        osc.type = 'triangle';
        osc.frequency.value = 105;
        osc.connect(gain).connect(this.master!);
      }
      osc.start(t);
      this.pull = { osc, gain, filter, kind, full: false };
    }
    if (kind === 'flecha') {
      this.pull.osc.frequency.setTargetAtTime(70 + p * 120, t, 0.06);
      this.pull.filter?.frequency.setTargetAtTime(520 + p * 900, t, 0.06);
      this.pull.gain.gain.setTargetAtTime(0.04 + p * 0.06, t, 0.04);
    } else {
      this.pull.osc.frequency.setTargetAtTime(105 + p * 250, t, 0.05);
      this.pull.gain.gain.setTargetAtTime(0.05 + p * 0.07, t, 0.035);
    }
    if (p >= 1 && !this.pull.full) {
      this.pull.full = true;
      this.play('pull-full');
    }
  }

  /** Soltou (atirou), cancelou ou desmaiou: o zumbido do elástico para. */
  stopCharge(): void {
    const v = this.pull;
    if (!v) return;
    this.pull = null;
    try {
      const t = this.ctx!.currentTime;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, 0.008);
      v.osc.stop(t + 0.05);
      v.osc.onended = () => {
        v.osc.disconnect();
        v.filter?.disconnect();
        v.gain.disconnect();
      };
    } catch {
      // já parou
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) this.stopCharge();
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // sem armazenamento: só não lembra a escolha
    }
    return this.muted;
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const nowMs = performance.now();
    if (nowMs - (this.lastPlayed.get(name) ?? -Infinity) < MIN_GAP_MS) return;
    this.lastPlayed.set(name, nowMs);
    const t = ctx.currentTime;
    switch (name) {
      case 'shot': // corda do estilingue
        this.tone('triangle', 900, 280, t, 0.09, 0.22);
        break;
      case 'hit': // pedrada acertando
        this.noise(t, 0.06, 'lowpass', 1400, 600, 0.35);
        this.tone('sine', 190, 80, t, 0.09, 0.3);
        break;
      case 'hurt': // você apanhou
        this.tone('square', 230, 110, t, 0.16, 0.18);
        this.noise(t, 0.08, 'lowpass', 900, 300, 0.25);
        break;
      case 'warn': // golpe vindo bem onde você está
        this.tone('sine', 880, 880, t, 0.06, 0.12);
        this.tone('sine', 880, 880, t + 0.1, 0.06, 0.12);
        break;
      case 'dash': // vuush
        this.noise(t, 0.2, 'bandpass', 700, 3200, 0.35);
        break;
      case 'arc': // borduna cortando o ar
        this.noise(t, 0.13, 'bandpass', 500, 1500, 0.4);
        this.tone('sine', 140, 70, t + 0.05, 0.1, 0.3);
        break;
      case 'heal':
        this.tone('sine', 420, 840, t, 0.3, 0.18);
        this.tone('sine', 630, 1260, t + 0.05, 0.25, 0.08);
        break;
      case 'kill': // monstro derrotado
        this.tone('triangle', 784, 784, t, 0.08, 0.2);
        this.tone('triangle', 1047, 1047, t + 0.08, 0.12, 0.2);
        break;
      case 'levelup': // musiquinha subindo
        [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, t + i * 0.09, 0.12, 0.12));
        break;
      case 'death':
        this.tone('sine', 440, 110, t, 0.7, 0.25);
        break;
      case 'loot': // plim: item na mochila
        this.tone('triangle', 1319, 1319, t, 0.07, 0.14);
        this.tone('triangle', 1760, 1760, t + 0.07, 0.12, 0.12);
        break;
      case 'rare': // item raro ou lendário: plim mais caprichado
        [1047, 1319, 1568, 2093].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.07, 0.16, 0.12));
        break;
      case 'charge': // cascos batendo e o vento da corrida
        for (let i = 0; i < 4; i++) this.noise(t + i * 0.07, 0.05, 'lowpass', 500, 150, 0.4);
        this.noise(t + 0.05, 0.3, 'bandpass', 400, 2200, 0.3);
        break;
      case 'fire': // fogo estalando
        this.noise(t, 0.35, 'highpass', 1800, 900, 0.18);
        this.noise(t + 0.12, 0.08, 'bandpass', 2600, 1400, 0.2);
        break;
      case 'coins': // moedas caindo no chão (tilintar)
        [2093, 2637, 2349, 2794].forEach((f, i) => this.tone('triangle', f, f * 0.97, t + i * 0.055, 0.09, 0.08));
        this.noise(t, 0.05, 'highpass', 6000, 3500, 0.05);
        break;
      case 'coin': // pegou o ouro: "tlim-tlim" de moeda (sino com harmônicos)
        this.bell(2093, t, 0.32, 0.12);
        this.bell(2637, t + 0.07, 0.38, 0.1);
        this.noise(t, 0.02, 'highpass', 7000, 5000, 0.08);
        break;
      case 'buy': // comprou: "ka-tching" de caixa registradora (gaveta + moedas)
        this.noise(t, 0.06, 'bandpass', 1800, 900, 0.22);
        this.tone('square', 196, 160, t, 0.05, 0.05);
        this.bell(2349, t + 0.06, 0.4, 0.12);
        this.bell(3136, t + 0.1, 0.45, 0.08);
        break;
      case 'sell': // vendeu: moedas caindo na mão, uma atrás da outra
        [1760, 2093, 2349, 2794].forEach((f, i) => this.bell(f, t + i * 0.06, 0.22, 0.07));
        this.noise(t + 0.02, 0.05, 'highpass', 6500, 4000, 0.05);
        break;
      case 'equip': // fivela fechando
        this.noise(t, 0.05, 'bandpass', 2600, 1700, 0.25);
        this.tone('square', 330, 440, t + 0.03, 0.07, 0.07);
        break;
      case 'block': // a defesa segurou o golpe: pancada seca nos braços (revisão 17)
        this.noise(t, 0.11, 'bandpass', 1800, 900, 0.42);
        this.tone('triangle', 240, 110, t, 0.12, 0.38);
        break;
      case 'guard-break': // a defesa quebrou (acabou a energia): pancada grave e mais longa (revisão 17)
        this.noise(t, 0.24, 'lowpass', 950, 300, 0.55);
        this.tone('triangle', 180, 48, t, 0.26, 0.4);
        break;
      case 'pull-full': // o estilingue (ou o arco) chegou na carga máxima (revisão 17)
        this.tone('triangle', 690, 1050, t, 0.18, 0.24);
        break;
      case 'bow-release': // a corda do arco solta: um "tóim" grave da corda e a flecha cortando o ar
        this.tone('triangle', 260, 120, t, 0.16, 0.3);
        this.tone('sine', 520, 300, t, 0.08, 0.1);
        this.noise(t + 0.02, 0.14, 'bandpass', 3200, 900, 0.22);
        break;
    }
  }

  /** Som de metal (moeda, sino): a nota e dois harmônicos "tortos", como num sino de verdade, morrendo rápido. */
  private bell(freq: number, start: number, duration: number, volume: number): void {
    for (const [ratio, gain] of [
      [1, 1],
      [2.76, 0.45],
      [5.4, 0.2],
    ] as const) {
      this.tone('sine', freq * ratio, freq * ratio * 0.995, start, duration / ratio ** 0.4, volume * gain);
    }
  }

  private tone(type: OscillatorType, from: number, to: number, start: number, duration: number, volume: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.master!);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(start: number, duration: number, filterType: BiquadFilterType, from: number, to: number, volume: number): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.master!);
    source.start(start);
    source.stop(start + duration + 0.02);
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
