// Efeitos sonoros sintetizados na hora (Web Audio), sem arquivos de som.
// Quando tivermos sons de verdade, dá para trocar cada receita por um arquivo carregado.
// Desde 14/11 o som é da [estrutura] (escolha do dono): quem liga o som no motor também faz o som.

import type { ShotKind } from '../shared/items';
import { Music } from './music';

export type SoundName =
  | 'shot'
  | 'hit'
  | 'hurt'
  | 'warn'
  | 'dash'
  | 'jump'
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
  | 'bow-release'
  | 'meow'
  | 'purr';

const MUTE_KEY = 'meummo:som-desligado';
const VOLUME_KEY = 'meummo:volumes';
/** O volume geral (tudo junto); cada parte (efeitos, ambiente, música) tem o seu, de 0 a 1, por cima dele. */
const MASTER_VOLUME = 0.35;

/** As partes do som que têm volume próprio (o jogador ajusta no painel do som). */
export type SoundPart = 'efeitos' | 'ambiente' | 'musica';
export type SoundVolumes = Record<SoundPart, number>;
const DEFAULT_VOLUMES: SoundVolumes = { efeitos: 1, ambiente: 0.7, musica: 0.6 };
/** O mesmo som não toca mais de uma vez nesse intervalo (evita barulheira). */
const MIN_GAP_MS = 45;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Cada parte passa pelo seu volume antes do geral. */
  private readonly buses: Partial<Record<SoundPart, GainNode>> = {};
  private readonly volume: SoundVolumes = readVolumes();
  private noiseBuffer: AudioBuffer | null = null;
  private readonly lastPlayed = new Map<SoundName, number>();
  /**
   * O som contínuo da puxada, que sobe com a carga: o zumbido do elástico do estilingue (revisão 17) ou o rangido da
   * corda do arco (mais grave e áspero).
   */
  private pull: { source: AudioScheduledSourceNode; gain: GainNode; filter: BiquadFilterNode | null; kind: ShotKind; full: boolean; nextCreakAt: number } | null =
    null;
  muted: boolean;
  /** A música de cada lugar (pelo volume "música"). */
  readonly music = new Music(this);

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
        this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
        this.master.connect(this.ctx.destination);
        for (const part of ['efeitos', 'ambiente', 'musica'] as const) {
          const bus = this.ctx.createGain();
          bus.gain.value = this.volume[part];
          bus.connect(this.master);
          this.buses[part] = bus;
        }
        const length = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      }
      void this.ctx.resume();
      this.music.prime(); // no mesmo clique: libera os tocadores de música (o iPhone pede)
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
      const gain = ctx.createGain();
      gain.gain.value = 0;
      let filter: BiquadFilterNode | null = null;
      let source: AudioScheduledSourceNode;
      if (kind === 'flecha') {
        // o arco: um chiado fininho de corda esticando (nada de tom contínuo: o dono achou que parecia motor)
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        noise.loop = true;
        filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2400;
        filter.Q.value = 9;
        noise.connect(filter).connect(gain).connect(this.buses.efeitos!);
        source = noise;
      } else {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 105;
        osc.connect(gain).connect(this.buses.efeitos!);
        source = osc;
      }
      source.start(t);
      this.pull = { source, gain, filter, kind, full: false, nextCreakAt: t + 0.05 };
    }
    if (kind === 'flecha') {
      this.pull.filter?.frequency.setTargetAtTime(2400 + p * 1100, t, 0.08);
      this.pull.gain.gain.setTargetAtTime(0.012 + p * 0.022, t, 0.06);
      // e a madeira do arco rangendo: estalinhos que ficam mais rápidos e fortes com a carga
      if (t >= this.pull.nextCreakAt && p < 1) {
        this.creak(t, 0.045 + p * 0.05);
        this.pull.nextCreakAt = t + 0.22 - p * 0.14 + Math.random() * 0.04;
      }
    } else {
      (this.pull.source as OscillatorNode).frequency.setTargetAtTime(105 + p * 250, t, 0.05);
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
      v.source.stop(t + 0.05);
      v.source.onended = () => {
        v.source.disconnect();
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
    // o ambiente e a música continuam tocando por baixo: desligar o som abaixa tudo (sem estalo) e ligar volta
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.05);
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // sem armazenamento: só não lembra a escolha
    }
    return this.muted;
  }

  /** Os volumes de agora (0 a 1). */
  volumes(): SoundVolumes {
    return { ...this.volume };
  }

  /** Muda o volume de uma parte (0 a 1); fica guardado neste navegador. */
  setVolume(part: SoundPart, value: number): void {
    const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : DEFAULT_VOLUMES[part]));
    this.volume[part] = v;
    const bus = this.buses[part];
    if (this.ctx && bus) bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify(this.volume));
    } catch {
      // sem armazenamento: vale só nesta visita
    }
  }

  /** Para o som de ambiente e a música (ambient.ts): o áudio do navegador, a saída de cada parte e o chiado pronto. */
  get audio(): { ctx: AudioContext; out: (part: SoundPart) => GainNode; noise: AudioBuffer } | null {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.noiseBuffer) return null;
    return { ctx, out: (part) => this.buses[part]!, noise: this.noiseBuffer };
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
      case 'jump': // o pé empurra o chão, um ventinho e, meio segundo depois, o pouso macio
        this.noise(t, 0.08, 'lowpass', 900, 350, 0.16);
        this.noise(t + 0.06, 0.2, 'bandpass', 450, 1300, 0.06);
        this.noise(t + 0.5, 0.07, 'lowpass', 700, 250, 0.18);
        this.tone('sine', 120, 60, t + 0.5, 0.09, 0.16);
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
      case 'meow': // o Joaquim miando: "mi-au" (a voz sobe e desce, e a boca abre e fecha num filtro)
        this.meow(t, 0.16);
        break;
      case 'purr': // o Joaquim ronronando no carinho: um rom-rom grave que pulsa
        this.purr(t, 1.6, 0.5);
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
    osc.connect(gain).connect(this.buses.efeitos!);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  /** Um rangido curtinho de madeira (o arco envergando): um estalo de chiado médio e um "toc" grave. */
  private creak(start: number, volume: number): void {
    this.noise(start, 0.035, 'bandpass', 900 + Math.random() * 500, 700, volume);
    this.tone('triangle', 170, 120, start, 0.04, volume * 0.4);
  }

  /** "Mi-au": a voz (dente de serra) sobe e desce; um filtro faz o "i" virar "a" e depois "u". */
  private meow(start: number, volume: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(430, start);
    osc.frequency.linearRampToValueAtTime(650, start + 0.16);
    osc.frequency.linearRampToValueAtTime(460, start + 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(1000, start);
    filter.frequency.linearRampToValueAtTime(1900, start + 0.18);
    filter.frequency.linearRampToValueAtTime(750, start + 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.05);
    gain.gain.setValueAtTime(volume, start + 0.36);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
    osc.connect(filter).connect(gain).connect(this.buses.efeitos!);
    osc.start(start);
    osc.stop(start + 0.6);
  }

  /** Ronronar: um chiado bem grave que pulsa umas 24 vezes por segundo, subindo e sumindo devagar. */
  private purr(start: number, duration: number, volume: number): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    const pulse = ctx.createGain();
    pulse.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 24;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(pulse.gain);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.25);
    gain.gain.setValueAtTime(volume, start + duration - 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(pulse).connect(gain).connect(this.buses.efeitos!);
    source.start(start);
    lfo.start(start);
    source.stop(start + duration + 0.05);
    lfo.stop(start + duration + 0.05);
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
    source.connect(filter).connect(gain).connect(this.buses.efeitos!);
    source.start(start);
    source.stop(start + duration + 0.02);
  }
}

function readVolumes(): SoundVolumes {
  try {
    const saved = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? '{}') as Partial<SoundVolumes>;
    const pick = (part: SoundPart) => (typeof saved[part] === 'number' && saved[part]! >= 0 && saved[part]! <= 1 ? saved[part]! : DEFAULT_VOLUMES[part]);
    return { efeitos: pick('efeitos'), ambiente: pick('ambiente'), musica: pick('musica') };
  } catch {
    return { ...DEFAULT_VOLUMES };
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
