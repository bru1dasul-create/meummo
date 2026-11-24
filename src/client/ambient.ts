// Som de ambiente do jogo 2.5D. Por baixo, a floresta gravada (licença livre; escolha do dono em 23/11: de dia, pássaros
// com insetos e vento; de tarde e de noite, o pântano com sapos e insetos), que passa de uma para a outra com a luz do
// dia. Por cima, feito por código: o vento e as folhas, a água do lago, e os nossos bichos (bem-te-vi, sabiá, cigarra,
// coruja, sapo), que dão o sotaque brasileiro.
// O motor diz em que lugar do mapa você está (camada `areas`: Vila do Capão, Lago do Parque...); a troca de um lugar
// para o outro é suave. O volume é o da parte "ambiente" (painel do som).

import type { Sfx } from './sfx';

export type AmbientScene = 'vila' | 'clareira' | 'mata' | 'mata-profunda' | 'agua' | 'caverna';
const SCENES: readonly AmbientScene[] = ['vila', 'clareira', 'mata', 'mata-profunda', 'agua', 'caverna'];

/** Sem acento e sem maiúscula. */
function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * O som de um mapa inteiro, para os lugares dele sem som pelo nome: dentro de uma caverna (a Caverna Sagrada), a
 * caverna; nos outros, a mata.
 */
export function sceneOfMap(mapName: string): AmbientScene {
  return /\b(caverna|gruta)\b/.test(plain(mapName)) ? 'caverna' : 'mata';
}

/**
 * O som de um lugar do mapa: a propriedade `som` dele (se o mapa disser), senão pelo nome. Fora de qualquer lugar com
 * nome (ou com um nome que não diz nada), o do mapa (`fallback`: a mata, ou a caverna dentro dela).
 */
export function sceneOfPlace(place: { name: string; sound: string | null } | null, fallback: AmbientScene = 'mata'): AmbientScene {
  if (place?.sound && (SCENES as readonly string[]).includes(place.sound)) return place.sound as AmbientScene;
  const name = plain(place?.name ?? '');
  // a Caverna Sagrada (24/11, do [mundo]): a entrada, o salão e a Toca da Cuca
  if (/\b(caverna|gruta|toca)\b/.test(name)) return 'caverna';
  if (name.includes('vila')) return 'vila';
  if (name.includes('lago') || name.includes('represa') || name.includes('brejo')) return 'agua';
  if (name.includes('profunda')) return 'mata-profunda';
  if (name.includes('clareira')) return 'clareira';
  return fallback;
}

/** Os sons contínuos (de 0 a 1) e quantas vezes por minuto cada bicho aparece, em cada lugar. */
interface SceneMix {
  wind: number;
  leaves: number;
  water: number;
  hum: number;
  perMinute: Record<CallKind, number>;
  /** Lugar fechado (a caverna): a noite não muda nada lá dentro (sem coruja nem grilo). */
  indoor?: true;
}
type CallKind = 'bemtevi' | 'sabia' | 'chirp' | 'cicada' | 'crickets' | 'owl' | 'frog' | 'drop';
const CALLS: readonly CallKind[] = ['bemtevi', 'sabia', 'chirp', 'cicada', 'crickets', 'owl', 'frog', 'drop'];
const none: Record<CallKind, number> = { bemtevi: 0, sabia: 0, chirp: 0, cicada: 0, crickets: 0, owl: 0, frog: 0, drop: 0 };

const MIXES: Record<AmbientScene, SceneMix> = {
  vila: { wind: 0.15, leaves: 0.12, water: 0, hum: 0, perMinute: { ...none, bemtevi: 2.5, sabia: 2, chirp: 4, cicada: 0.4 } },
  clareira: { wind: 0.2, leaves: 0.2, water: 0, hum: 1, perMinute: { ...none, bemtevi: 1, sabia: 3, chirp: 3 } },
  mata: { wind: 0.35, leaves: 0.35, water: 0, hum: 0, perMinute: { ...none, bemtevi: 1, sabia: 1.5, chirp: 4, cicada: 1.5 } },
  'mata-profunda': { wind: 0.5, leaves: 0.2, water: 0, hum: 0, perMinute: { ...none, chirp: 1, crickets: 2, owl: 0.8, cicada: 0.3 } },
  agua: { wind: 0.2, leaves: 0.15, water: 1, hum: 0, perMinute: { ...none, chirp: 2, sabia: 0.5, frog: 3, drop: 8 } },
  // dentro da caverna: a corrente de ar, o zumbido baixo do lugar sagrado e as gotas pingando; nenhum bicho
  caverna: { wind: 0.25, leaves: 0, water: 0, hum: 0.8, perMinute: { ...none, drop: 10 }, indoor: true },
};

/** De noite: os passarinhos e as cigarras dormem; os grilos e a coruja aparecem (e o sapo, na água, continua). */
function nightCalls(day: Record<CallKind, number>): Record<CallKind, number> {
  return { ...day, bemtevi: 0, sabia: 0, chirp: 0, cicada: 0, crickets: Math.max(day.crickets, 3), owl: Math.max(day.owl, 0.6) };
}

/** Quanto da floresta gravada toca em cada lugar (1 = toda): na vila e na beira d'água, menos. */
const RECORDED_LEVEL: Record<AmbientScene, number> = { vila: 0.5, clareira: 0.85, mata: 1, 'mata-profunda': 1, agua: 0.65, caverna: 0 };
/** O volume da floresta gravada (as duas já vêm com o mesmo volume de arquivo). */
const RECORDED_GAIN = 0.9;
/** Com a floresta gravada tocando: o vento e as folhas feitos por código mais baixos (a gravação já tem). */
const BEDS_WITH_RECORDING = { wind: 0.6, leaves: 0.4 };
/** E quantos dos nossos bichos continuam (os passarinhos genéricos e os grilos saem: a gravação já tem). */
const CALLS_WITH_RECORDING: Record<CallKind, number> = { bemtevi: 0.6, sabia: 0.6, chirp: 0, cicada: 0.5, crickets: 0, owl: 1, frog: 0.5, drop: 1 };

/** Quanto toca de cada floresta gravada com esta luz (1 de dia, 0 de noite; no anoitecer, as duas juntas). */
export function recordedMix(scene: AmbientScene, daylight: number): { day: number; night: number } {
  const level = RECORDED_LEVEL[scene] * RECORDED_GAIN;
  const light = Math.max(0, Math.min(1, daylight));
  return { day: level * light, night: level * (1 - light) };
}

/** Volume máximo de cada som contínuo (os bichos têm o seu em cada receita). */
const BED_GAIN = { wind: 0.22, leaves: 0.05, water: 0.16, hum: 0.025 };
/** Troca de lugar: quanto tempo (s) leva a mistura nova (constante de tempo). */
const FADE_S = 1.2;

interface Beds {
  wind: GainNode;
  gust: GainNode;
  leaves: GainNode;
  water: GainNode;
  hum: GainNode;
  stop: () => void;
}

export class Ambient {
  private beds: Beds | null = null;
  private scene: AmbientScene | null = null;
  /** É noite (os bichos da noite no lugar dos passarinhos)? */
  private night = false;
  /** A luz do dia (1 de dia, 0 de noite): leva a floresta gravada do dia para a da noite. */
  private daylight = 1;
  /** A floresta gravada (as duas tocando sempre, em loop; a luz decide o volume de cada uma). */
  private recorded: { day: GainNode; night: GainNode; stop: () => void } | null = null;
  /** O vento (0 a 1): o chiado do vento, as rajadas e as folhas acompanham. */
  private windStrength = 0.35;
  private readonly nextAt: Record<CallKind, number> = { ...none };
  private lastCheck = 0;

  constructor(
    private readonly sfx: Sfx,
    private readonly random: () => number = Math.random,
  ) {}

  /** O lugar de agora (para os testes e o painel). */
  get current(): AmbientScene | null {
    return this.scene;
  }

  setScene(scene: AmbientScene): void {
    if (scene === this.scene) return;
    this.scene = scene;
    this.soon();
    this.mix();
  }

  /** Anoiteceu (ou amanheceu): os bichos da hora entram logo. */
  setNight(night: boolean): void {
    if (night === this.night) return;
    this.night = night;
    this.soon();
  }

  /** A luz do dia mudou (0 a 1): a floresta gravada acompanha (só quando muda de verdade). */
  setDaylight(light: number): void {
    if (Math.abs(light - this.daylight) < 0.02) return;
    this.daylight = light;
    this.mix();
  }

  /** O vento mudou de força (0 a 1): o som acompanha devagar (só quando muda de verdade). */
  setWind(strength: number): void {
    if (Math.abs(strength - this.windStrength) < 0.05) return;
    this.windStrength = strength;
    this.mix();
  }

  /** A floresta gravada está tocando? (para os testes) */
  get recording(): boolean {
    return this.recorded !== null;
  }

  /** É noite no som? (para os testes) */
  get isNight(): boolean {
    return this.night;
  }

  /** Os bichos do lugar (e da hora) novos aparecem logo (não esperam a vez dos de antes). */
  private soon(): void {
    const now = performance.now() / 1000;
    for (const kind of CALLS) this.nextAt[kind] = now + 1 + this.random() * 4;
  }

  /** A cada quadro: começa quando o som do navegador estiver liberado (depois do primeiro toque) e chama os bichos. */
  update(): void {
    const now = performance.now() / 1000;
    if (now - this.lastCheck < 0.25) return;
    this.lastCheck = now;
    const audio = this.sfx.audio;
    if (!audio || !this.scene) return;
    if (!this.beds) {
      this.beds = this.start(audio.ctx, audio.out('ambiente'));
      this.mix();
    }
    if (!this.recorded) {
      // a floresta gravada entra quando os dois arquivos terminarem de carregar
      const day = this.sfx.sample('floresta-dia');
      const night = this.sfx.sample('floresta-noite');
      if (day && night) {
        this.recorded = this.startRecorded(audio.ctx, audio.out('ambiente'), day, night);
        this.mix();
      }
    }
    const mix = MIXES[this.scene];
    const perMinute = this.night && !mix.indoor ? nightCalls(mix.perMinute) : mix.perMinute;
    for (const kind of CALLS) {
      if (now < this.nextAt[kind]) continue;
      const rate = perMinute[kind] * (this.recorded ? CALLS_WITH_RECORDING[kind] : 1);
      if (rate > 0 && !this.sfx.muted) this.call(kind, audio.ctx, audio.out('ambiente'));
      // o próximo: em média `60 / rate` segundos (sem padrão fixo, como na natureza)
      this.nextAt[kind] = now + (rate > 0 ? Math.max(2, -Math.log(1 - this.random()) * (60 / rate)) : 5);
    }
  }

  destroy(): void {
    this.beds?.stop();
    this.beds = null;
    this.recorded?.stop();
    this.recorded = null;
  }

  /** As duas florestas gravadas em loop, cada uma num ponto diferente, começando em silêncio. */
  private startRecorded(ctx: AudioContext, out: GainNode, day: AudioBuffer, night: AudioBuffer): { day: GainNode; night: GainNode; stop: () => void } {
    const sources: AudioBufferSourceNode[] = [];
    const loop = (buffer: AudioBuffer) => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      // um fio de folga nas pontas (o arquivo comprimido pode ter um silencinho no começo e no fim)
      src.loopStart = Math.min(0.03, buffer.duration / 4);
      src.loopEnd = Math.max(src.loopStart + 0.1, buffer.duration - 0.03);
      src.connect(gain).connect(out);
      src.start(ctx.currentTime, src.loopStart + this.random() * (src.loopEnd - src.loopStart));
      sources.push(src);
      return gain;
    };
    const dayGain = loop(day);
    const nightGain = loop(night);
    return {
      day: dayGain,
      night: nightGain,
      stop: () => {
        for (const src of sources) {
          try {
            src.stop();
            src.disconnect();
          } catch {
            // já parou
          }
        }
        dayGain.disconnect();
        nightGain.disconnect();
      },
    };
  }

  /** Leva os sons contínuos para a mistura do lugar de agora. */
  private mix(): void {
    const beds = this.beds;
    const audio = this.sfx.audio;
    if (!beds || !audio || !this.scene) return;
    const m = MIXES[this.scene];
    const t = audio.ctx.currentTime;
    // o vento do mundo: calmo (0,1) quase some; brisa (0,35) é o de sempre; forte (0,9) bem mais alto e com rajadas
    const w = this.windStrength;
    const windBed = this.recorded ? BEDS_WITH_RECORDING.wind : 1;
    const leavesBed = this.recorded ? BEDS_WITH_RECORDING.leaves : 1;
    beds.wind.gain.setTargetAtTime(m.wind * BED_GAIN.wind * windBed * (0.3 + 2 * w), t, FADE_S);
    beds.gust.gain.setTargetAtTime(m.wind * BED_GAIN.wind * windBed * 0.45 * (0.1 + 2.6 * w), t, FADE_S);
    beds.leaves.gain.setTargetAtTime(m.leaves * BED_GAIN.leaves * leavesBed * (0.5 + 1.4 * w), t, FADE_S);
    if (this.recorded) {
      const rec = recordedMix(this.scene, this.daylight);
      this.recorded.day.gain.setTargetAtTime(rec.day, t, FADE_S);
      this.recorded.night.gain.setTargetAtTime(rec.night, t, FADE_S);
    }
    beds.water.gain.setTargetAtTime(m.water * BED_GAIN.water, t, FADE_S);
    beds.hum.gain.setTargetAtTime(m.hum * BED_GAIN.hum, t, FADE_S);
  }

  /** Os sons contínuos: vento (com rajadas), folhas, água e o zumbido mágico da clareira. Começam em silêncio. */
  private start(ctx: AudioContext, out: GainNode): Beds {
    // um chiado de 4 s (o de 1 s dos efeitos repetiria um padrão que dá para ouvir)
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = this.random() * 2 - 1;
    const sources: AudioScheduledSourceNode[] = [];
    const noise = (offset: number) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.start(ctx.currentTime, offset);
      sources.push(src);
      return src;
    };
    const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };
    const silent = () => {
      const g = ctx.createGain();
      g.gain.value = 0;
      return g;
    };
    // vento: chiado grave; as rajadas são uma onda bem lenta somada ao volume
    const wind = silent();
    noise(0).connect(filter('lowpass', 420)).connect(wind).connect(out);
    const gust = silent();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    lfo.connect(gust).connect(wind.gain);
    lfo.start();
    sources.push(lfo);
    // folhas: chiado agudo e baixinho
    const leaves = silent();
    noise(1.3).connect(filter('bandpass', 3200, 0.6)).connect(leaves).connect(out);
    // água: duas faixas do chiado (o correr e o borbulhar)
    const water = silent();
    const waterSrc = noise(2.6);
    waterSrc.connect(filter('bandpass', 850, 1.1)).connect(water);
    waterSrc.connect(filter('bandpass', 2300, 2)).connect(water);
    water.connect(out);
    // a clareira: um zumbido mágico bem baixinho (duas notas e um tremor lento)
    const hum = silent();
    for (const freq of [196, 293.7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(hum);
      osc.start();
      sources.push(osc);
    }
    hum.connect(out);
    return {
      wind,
      gust,
      leaves,
      water,
      hum,
      stop: () => {
        for (const src of sources) {
          try {
            src.stop();
            src.disconnect();
          } catch {
            // já parou
          }
        }
        for (const node of [wind, gust, leaves, water, hum]) node.disconnect();
      },
    };
  }

  // ---- os bichos ----

  private call(kind: CallKind, ctx: AudioContext, out: GainNode): void {
    const t = ctx.currentTime + 0.05 + this.random() * 0.3;
    const r = this.random;
    switch (kind) {
      case 'bemtevi': // "bem-te-vi!": duas notas curtas e a última comprida, descendo
        this.whistle(ctx, out, t, 2600, 2850, 0.09, 0.05);
        this.whistle(ctx, out, t + 0.14, 2900, 3150, 0.08, 0.05);
        this.whistle(ctx, out, t + 0.28, 3350, 2450, 0.36, 0.055);
        break;
      case 'sabia': {
        // o sabiá: uma frase de assobios que sobem e descem
        let at = t;
        const notes = 4 + Math.floor(r() * 3);
        for (let i = 0; i < notes; i++) {
          const from = 1700 + r() * 1300;
          const to = from * (0.85 + r() * 0.35);
          const length = 0.12 + r() * 0.14;
          this.whistle(ctx, out, at, from, to, length, 0.035);
          at += length + 0.05 + r() * 0.08;
        }
        break;
      }
      case 'chirp': {
        const n = 2 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) this.whistle(ctx, out, t + i * 0.09, 3600 + r() * 600, 4500 + r() * 500, 0.045, 0.025);
        break;
      }
      case 'cicada':
        this.cicada(ctx, out, t);
        break;
      case 'crickets':
        for (let rep = 0; rep < 5; rep++) {
          for (let i = 0; i < 3; i++) this.whistle(ctx, out, t + rep * 0.9 + i * 0.07, 4300, 4300, 0.03, 0.02);
        }
        break;
      case 'owl': // a coruja: "hu... huuu"
        this.whistle(ctx, out, t, 430, 390, 0.26, 0.05, 'sine', 900);
        this.whistle(ctx, out, t + 0.42, 410, 340, 0.55, 0.05, 'sine', 900);
        break;
      case 'frog': {
        const n = 2 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) this.croak(ctx, out, t + i * 0.32);
        break;
      }
      case 'drop':
        this.whistle(ctx, out, t, 1400 + r() * 500, 2300 + r() * 600, 0.06, 0.03);
        break;
    }
  }

  /** Um assobio de `from` a `to` Hz (passarinho, coruja, gota). */
  private whistle(
    ctx: AudioContext,
    out: GainNode,
    start: number,
    from: number,
    to: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
    lowpass = 0,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.02, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    let node: AudioNode = osc;
    if (lowpass > 0) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node = osc.connect(f);
    }
    node.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  /** A cigarra: um chiado agudo que pulsa rápido, cresce, fica e some (uns 6 s). */
  private cicada(ctx: AudioContext, out: GainNode, start: number): void {
    const audio = this.sfx.audio;
    if (!audio) return;
    const src = ctx.createBufferSource();
    src.buffer = audio.noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 5200;
    band.Q.value = 4;
    const pulse = ctx.createGain();
    pulse.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 45;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(pulse.gain);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.05, start + 1.5);
    gain.gain.setValueAtTime(0.05, start + 4.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 6.2);
    src.connect(band).connect(pulse).connect(gain).connect(out);
    src.start(start);
    lfo.start(start);
    src.stop(start + 6.3);
    lfo.stop(start + 6.3);
  }

  /** O sapo: um "croc" grave e áspero. */
  private croak(ctx: AudioContext, out: GainNode, start: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(115, start);
    osc.frequency.exponentialRampToValueAtTime(95, start + 0.22);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 650;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.06, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
    osc.connect(f).connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + 0.26);
  }
}
