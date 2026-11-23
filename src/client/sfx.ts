// Efeitos sonoros sintetizados na hora (Web Audio), sem arquivos de som.
// Quando tivermos sons de verdade, dá para trocar cada receita por um arquivo carregado.
// Desde 14/11 o som é da [estrutura] (escolha do dono): quem liga o som no motor também faz o som.

import type { ShotKind, UseSound } from '../shared/items';
import type { StepGround } from './novo/ground';
import { Music } from './music';

export type SoundName =
  | 'shot'
  | 'hit'
  | 'hurt'
  | 'warn'
  | 'dash'
  | 'jump'
  | 'levelup'
  | 'skillup'
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
  | 'purr'
  | 'capy'
  | 'spirit'
  | 'burst'
  | 'hawk'
  | 'arrow-hit';

/**
 * Os sons gravados (licença livre, CC0, do OpenGameArt; créditos em public/assets/audio/CREDITOS-SONS.md): o nome e o
 * arquivo. Escolhidos pelo dono em 23/11 a partir das prévias. Carregam depois do primeiro toque; até lá (ou se um
 * faltar), toca o som feito por código.
 */
export const SAMPLE_FILES = {
  'arco-soltar': '/assets/audio/efeitos/arco-soltar.mp3',
  'flecha-vibra-1': '/assets/audio/efeitos/flecha-vibra-1.mp3',
  'flecha-vibra-2': '/assets/audio/efeitos/flecha-vibra-2.mp3',
  'passo-terra-1': '/assets/audio/efeitos/passo-terra-1.mp3',
  'passo-terra-2': '/assets/audio/efeitos/passo-terra-2.mp3',
  'passo-terra-3': '/assets/audio/efeitos/passo-terra-3.mp3',
  'passo-pedra-1': '/assets/audio/efeitos/passo-pedra-1.mp3',
  'passo-pedra-2': '/assets/audio/efeitos/passo-pedra-2.mp3',
  'passo-pedra-3': '/assets/audio/efeitos/passo-pedra-3.mp3',
  'passo-pedra-4': '/assets/audio/efeitos/passo-pedra-4.mp3',
  'passo-pedra-5': '/assets/audio/efeitos/passo-pedra-5.mp3',
  'passo-pedra-6': '/assets/audio/efeitos/passo-pedra-6.mp3',
  'passo-areia-1': '/assets/audio/efeitos/passo-areia-1.mp3',
  'passo-areia-2': '/assets/audio/efeitos/passo-areia-2.mp3',
  'passo-areia-3': '/assets/audio/efeitos/passo-areia-3.mp3',
  'passo-areia-4': '/assets/audio/efeitos/passo-areia-4.mp3',
  'passo-areia-5': '/assets/audio/efeitos/passo-areia-5.mp3',
  'passo-areia-6': '/assets/audio/efeitos/passo-areia-6.mp3',
  'floresta-dia': '/assets/audio/ambiente/floresta-dia.mp3',
  'floresta-noite': '/assets/audio/ambiente/floresta-noite.mp3',
} as const;
export type SampleName = keyof typeof SAMPLE_FILES;

/** Os passos gravados de cada chão (ground.ts). */
const STEP_SAMPLES: Record<StepGround, readonly SampleName[]> = {
  terra: ['passo-terra-1', 'passo-terra-2', 'passo-terra-3'],
  pedra: ['passo-pedra-1', 'passo-pedra-2', 'passo-pedra-3', 'passo-pedra-4', 'passo-pedra-5', 'passo-pedra-6'],
  areia: ['passo-areia-1', 'passo-areia-2', 'passo-areia-3', 'passo-areia-4', 'passo-areia-5', 'passo-areia-6'],
};

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
  /** Volume de quem toca agora (1 = o de sempre): o `consume` de quem está perto toca mais baixo. */
  private scale = 1;
  /** Os sons gravados já carregados (SAMPLE_FILES). */
  private readonly samples = new Map<SampleName, AudioBuffer>();
  private samplesAsked = false;
  /** O último passo que tocou (para não repetir o mesmo arquivo duas vezes seguidas). */
  private lastStep: SampleName | null = null;
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
      this.loadSamples();
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
      case 'skillup': // pôs um ponto numa habilidade: três sininhos subindo, rápidos (menor que o subir de nível)
        this.bell(784, t, 0.35, 0.08);
        this.bell(988, t + 0.08, 0.35, 0.08);
        this.bell(1319, t + 0.16, 0.5, 0.09);
        this.noise(t + 0.05, 0.35, 'bandpass', 2200, 4800, 0.04);
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
      case 'capy': // a capivara contente: uns estalinhos baixos e rápidos ("tc-tc-tc"), duas rodadas
        for (let i = 0; i < 14; i++) {
          const at = t + i * 0.055 + (i >= 7 ? 0.18 : 0);
          this.tone('triangle', 380, 300, at, 0.025, 0.06);
          this.noise(at, 0.012, 'bandpass', 1400, 900, 0.03);
        }
        break;
      case 'spirit': // a Flecha Ancestral: a corda e um sopro que sobe, com um sininho do espírito
        this.tone('triangle', 240, 110, t, 0.14, 0.24);
        this.noise(t + 0.01, 0.3, 'bandpass', 900, 3600, 0.18);
        this.tone('sine', 880, 1320, t + 0.03, 0.35, 0.09);
        this.tone('sine', 1320, 1980, t + 0.08, 0.3, 0.05);
        break;
      case 'hawk': // os Olhos de Gavião: o grito do gavião lá no alto ("kiiii-ah"), longe
        this.tone('sine', 2300, 1500, t, 0.45, 0.07);
        this.tone('sine', 2600, 1700, t + 0.02, 0.4, 0.04);
        this.noise(t, 0.3, 'bandpass', 3000, 2200, 0.05);
        this.tone('sine', 1900, 1200, t + 0.5, 0.3, 0.05);
        break;
      case 'burst': // a Flecha Ancestral explode no fim: um baque fundo e o brilho subindo
        this.tone('sine', 150, 50, t, 0.35, 0.3);
        this.noise(t, 0.25, 'lowpass', 1200, 200, 0.25);
        this.tone('sine', 660, 1320, t + 0.05, 0.4, 0.07);
        break;
      case 'bow-release': // a corda do arco solta: a gravação (escolhida pelo dono); sem ela, o "tóim" feito por código
        if (this.playSample('arco-soltar', t, 0.55, 0.96 + Math.random() * 0.08)) break;
        this.tone('triangle', 260, 120, t, 0.16, 0.3);
        this.tone('sine', 520, 300, t, 0.08, 0.1);
        this.noise(t + 0.02, 0.14, 'bandpass', 3200, 900, 0.22);
        break;
      case 'arrow-hit': // a flecha entrando num bicho: o "toc" surdo (o grave caindo, o abafado e um estalo seco)
        this.tone('sine', 170, 70, t, 0.16, 0.32);
        this.noise(t, 0.07, 'lowpass', 1100, 350, 0.28);
        this.noise(t, 0.012, 'highpass', 3000, 2500, 0.1);
        break;
    }
  }

  /**
   * A Chuva de Flechas: as cordas do arco soltando uma atrás da outra (com o estilingue, o elástico), o assobio subindo
   * e, quando elas chegam (daqui a `delayMs`), a chuvarada de "tucs" no chão. Tudo marcado no relógio do som.
   */
  volley(delayMs: number, count: number, stone: boolean, power = 0): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const strings = Math.max(3, Math.min(8, Math.round(count / 2)));
    for (let i = 0; i < strings; i++) {
      const at = t + i * 0.045;
      if (stone) this.tone('triangle', 900, 300, at, 0.06, 0.12);
      else this.tone('triangle', 250 + i * 12, 120, at, 0.1, 0.16);
    }
    this.noise(t + 0.03, 0.35, 'bandpass', 1800, 4200, 0.12); // o assobio subindo
    const land = t + Math.max(0.1, delayMs / 1000);
    for (let i = 0; i < Math.min(16, Math.max(3, count)); i++) {
      const at = land - 0.08 + Math.random() * 0.2;
      this.noise(at, 0.04, 'lowpass', stone ? 1600 : 900, 300, 0.16);
      this.tone('sine', stone ? 300 : 180, 90, at, 0.05, 0.08);
    }
    // o chão retumbando quando ela chega: mais fundo e mais forte com os pontos e o degrau (pedido do dono, 22/11)
    if (power > 0.05) this.thud(land, power);
  }

  /**
   * Um impacto de habilidade (a Flecha Ancestral batendo ou explodindo), crescendo com a força (0 a 1: os pontos e o
   * degrau da carga). `burst` = explodiu (o estouro de sempre, por cima do baque).
   */
  impact(power: number, burst = false): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    if (burst) this.play('burst');
    this.thud(ctx.currentTime, power);
  }

  /**
   * Usou um consumível (pedido do dono, 23/11: "o som de cura" na poção e "comendo algo, tomando algo" na banana e na
   * água de coco). Os tempos são os da animação da [arte] (prototipos/pindorama-25d/js/consume.js), contados da
   * mensagem `consume`: a garrafada sai da mão aos 0,30 s (um "fiu") e estoura acima da cabeça aos 0,52 s (a cura); a
   * banana leva duas mordidas (0,38 s e 0,66 s); a água de coco é sorvida no canudinho de 0,32 s a 0,95 s; a arruda
   * benze na hora. `volume`: 1 para quem usou; menos para quem está vendo de perto.
   */
  consume(sound: UseSound, volume = 1): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const before = this.scale;
    this.scale = Math.max(0, Math.min(1, volume));
    try {
      switch (sound) {
        case 'garrafada':
          this.noise(t + 0.3, 0.2, 'bandpass', 700, 2600, 0.06); // a garrafa subindo
          this.healShimmer(t + 0.52); // e estourando acima da cabeça
          break;
        case 'mordida':
          this.bite(t + 0.38);
          this.bite(t + 0.66);
          break;
        case 'canudinho':
          this.sip(t + 0.32, 0.63);
          break;
        case 'cura':
          this.healShimmer(t);
          break;
      }
    } finally {
      this.scale = before;
    }
  }

  /** A cura: um estalinho de vidro, as duas notas subindo (o "heal") e um sininho por cima. */
  private healShimmer(at: number): void {
    this.noise(at, 0.03, 'highpass', 3500, 5200, 0.09);
    this.tone('sine', 420, 840, at, 0.3, 0.18);
    this.tone('sine', 630, 1260, at + 0.05, 0.25, 0.08);
    this.bell(1568, at + 0.06, 0.5, 0.05);
  }

  /** Uma mordida: o "nhac" (ruído curto e médio), o crocante por cima e um grave da boca. */
  private bite(at: number): void {
    this.noise(at, 0.05, 'bandpass', 1800, 900, 0.15);
    this.noise(at + 0.005, 0.025, 'highpass', 3000, 2200, 0.05);
    this.tone('sine', 180, 120, at, 0.04, 0.05);
  }

  /** Sorvendo no canudinho por `duration` s: puxadinhas de ar com líquido (um chiado que pulsa) e uns glub no meio. */
  private sip(at: number, duration: number): void {
    for (let k = 0, s = at; s < at + duration - 0.04; k++, s += 0.09) {
      this.noise(s, 0.07, 'bandpass', 1350 - k * 25, 1050 - k * 20, 0.07 - Math.min(0.03, k * 0.004));
      if (k % 2 === 1) this.tone('sine', 320, 210, s + 0.02, 0.05, 0.05);
    }
  }

  /** A sua flecha cravou: numa árvore ou coisa (`onObject`), a madeira vibrando (gravada); no chão, um "toc" baixinho. */
  arrowStuck(onObject: boolean): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    if (onObject && this.playSample(Math.random() < 0.5 ? 'flecha-vibra-1' : 'flecha-vibra-2', t, 0.4, 0.95 + Math.random() * 0.1)) return;
    this.tone('sine', 150, 80, t, 0.1, onObject ? 0.2 : 0.1);
    this.noise(t, 0.05, 'lowpass', 900, 300, onObject ? 0.16 : 0.1);
  }

  /** Um passo seu no chão `ground` (um dos gravados, sem repetir o anterior, cada um num tom um pouquinho diferente). */
  step(ground: StepGround, volume = 1): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const options = STEP_SAMPLES[ground].filter((name) => name !== this.lastStep && this.samples.has(name));
    if (options.length === 0) return; // ainda carregando: sem passo (melhor que um som feito por código esquisito)
    const name = options[Math.floor(Math.random() * options.length)]!;
    this.lastStep = name;
    this.playSample(name, ctx.currentTime, (0.26 + Math.random() * 0.06) * volume, 0.93 + Math.random() * 0.14);
  }

  /** Quantos sons gravados já carregaram (para os testes). */
  get loadedSamples(): number {
    return this.samples.size;
  }

  /** O som gravado `name`, se já carregou (o ambiente pega a floresta daqui). */
  sample(name: SampleName): AudioBuffer | null {
    return this.samples.get(name) ?? null;
  }

  /** Carrega os sons gravados (uma vez, depois do primeiro toque). O que faltar fica com o som feito por código. */
  private loadSamples(): void {
    const ctx = this.ctx;
    if (this.samplesAsked || !ctx) return;
    this.samplesAsked = true;
    for (const [name, url] of Object.entries(SAMPLE_FILES) as [SampleName, string][]) {
      fetch(url)
        .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(url))))
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => this.samples.set(name, buffer))
        .catch(() => {
          // sem o arquivo (ou o navegador não leu): o som feito por código fica no lugar
        });
    }
  }

  /** Toca um som gravado (no volume dos efeitos); false se ele ainda não carregou. */
  private playSample(name: SampleName, at: number, volume: number, rate = 1): boolean {
    const ctx = this.ctx;
    const buffer = this.samples.get(name);
    if (!ctx || !buffer) return false;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, volume * this.scale);
    source.connect(gain).connect(this.buses.efeitos!);
    source.start(at);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    return true;
  }

  /** O baque de um impacto: um grave que desce e a terra; com mais força, mais fundo, mais longo e com um brilho no fim. */
  private thud(at: number, power: number): void {
    const p = Math.min(1, Math.max(0, power));
    this.tone('sine', 140 - 50 * p, 38, at, 0.22 + 0.28 * p, 0.1 + 0.22 * p);
    this.noise(at, 0.1 + 0.2 * p, 'lowpass', 900 + 900 * p, 160, 0.06 + 0.16 * p);
    if (p > 0.45) this.tone('sine', 520 + 400 * p, 1100 + 600 * p, at + 0.04, 0.22 + 0.2 * p, 0.025 + 0.05 * p);
  }

  /**
   * Puxando com a Chuva ou a Flecha Ancestral no arco, a carga subiu de degrau (2 médio, 3 forte): um sininho do
   * espírito, mais agudo e mais cheio no forte (pedido do dono, 19/11: "um brilho e um som em cada degrau").
   */
  chargeLevel(level: number): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    if (level >= 3) {
      this.bell(1320, t, 0.5, 0.1);
      this.bell(1980, t + 0.06, 0.45, 0.07);
      this.noise(t, 0.22, 'bandpass', 2400, 5200, 0.05);
    } else {
      this.bell(990, t, 0.4, 0.09);
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
    volume = Math.max(0.0002, volume * this.scale);
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
    volume = Math.max(0.0002, volume * this.scale);
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
