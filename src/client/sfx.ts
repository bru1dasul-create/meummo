// Efeitos sonoros sintetizados na hora (Web Audio), sem arquivos de som.
// Quando tivermos sons de verdade, dá para trocar cada receita por um arquivo carregado.

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
  | 'fire';

const MUTE_KEY = 'meummo:som-desligado';
/** O mesmo som não toca mais de uma vez nesse intervalo (evita barulheira). */
const MIN_GAP_MS = 45;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly lastPlayed = new Map<SoundName, number>();
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

  toggleMute(): boolean {
    this.muted = !this.muted;
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
      case 'equip': // fivela fechando
        this.noise(t, 0.05, 'bandpass', 2600, 1700, 0.25);
        this.tone('square', 330, 440, t + 0.03, 0.07, 0.07);
        break;
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
