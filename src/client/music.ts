// Música do jogo 2.5D: cada lugar tem a sua (licença livre, CC0: veja public/assets/audio/musica/CREDITOS.md). A troca
// é devagar: uma some enquanto a outra entra. Toca pelo volume "música" do painel do som (e o "desligar" abaixa tudo).
//
// Dois tocadores (um sai, o outro entra), que tocam o arquivo aos poucos (não carregam a música inteira na memória:
// importante no celular). O iPhone só deixa tocar o que começou num toque: no primeiro clique (Sfx.unlock) os dois
// tocadores são "liberados" com um silêncio curtinho, e depois trocam de música sozinhos.

import type { AmbientScene } from './ambient';
import type { Sfx } from './sfx';

const TRACKS = {
  vila: '/assets/audio/musica/vila-capao.mp3',
  mata: '/assets/audio/musica/mata.mp3',
  'mata-profunda': '/assets/audio/musica/mata-profunda.mp3',
} as const;
export type MusicTrack = keyof typeof TRACKS;

/** A música de cada lugar (a clareira e o lago usam a da mata). */
export function trackOfScene(scene: AmbientScene): MusicTrack {
  if (scene === 'vila') return 'vila';
  if (scene === 'mata-profunda') return 'mata-profunda';
  return 'mata';
}

/** Quanto tempo leva a troca de uma música para a outra (constante de tempo, em segundos). */
const FADE_S = 1.2;

interface Player {
  el: HTMLAudioElement;
  gain: GainNode | null;
}

export class Music {
  private readonly players: Player[] = [];
  private active = -1;
  private track: MusicTrack | null = null;
  private wanted: MusicTrack | null = null;

  constructor(private readonly sfx: Sfx) {}

  /** A música que está tocando (para os testes). */
  get current(): MusicTrack | null {
    return this.track;
  }

  /** Está tocando de verdade (o tocador da vez andando)? */
  get playing(): boolean {
    const el = this.players[this.active]?.el;
    return !!el && !el.paused && el.currentTime > 0;
  }

  /** No clique do jogador (o gesto que libera o som): prepara os dois tocadores. */
  prime(): void {
    if (this.players.length > 0 || typeof Audio === 'undefined') return;
    const silence = silentWav();
    for (let i = 0; i < 2; i++) {
      const el = new Audio();
      el.loop = true;
      el.preload = 'none';
      el.src = silence;
      el.play()
        .then(() => el.pause())
        .catch(() => {
          // sem liberar (navegador muito restrito): tenta de novo ao trocar de música
        });
      this.players.push({ el, gain: null });
    }
  }

  /** O lugar pede esta música (troca devagar, se for outra). */
  play(track: MusicTrack): void {
    this.wanted = track;
    this.apply();
  }

  /** A cada quadro: começa assim que o som do navegador estiver liberado. */
  update(): void {
    if (this.wanted !== this.track) this.apply();
  }

  /** Saiu do jogo: a música some. */
  stop(): void {
    this.wanted = null;
    const audio = this.sfx.audio;
    for (const p of this.players) {
      if (audio && p.gain) p.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.2);
      window.setTimeout(() => p.el.pause(), 800);
    }
    this.track = null;
    this.active = -1;
  }

  private apply(): void {
    const audio = this.sfx.audio;
    const wanted = this.wanted;
    if (!audio || this.players.length === 0 || !wanted || wanted === this.track) return;
    for (const p of this.players) {
      if (p.gain) continue;
      const source = audio.ctx.createMediaElementSource(p.el);
      p.gain = audio.ctx.createGain();
      p.gain.gain.value = 0;
      source.connect(p.gain).connect(audio.out('musica'));
    }
    const t = audio.ctx.currentTime;
    // a de agora some...
    if (this.active >= 0) {
      const old = this.players[this.active]!;
      old.gain!.gain.setTargetAtTime(0, t, FADE_S);
      const el = old.el;
      window.setTimeout(() => {
        if (this.players[this.active]?.el !== el) el.pause();
      }, FADE_S * 5000);
    }
    // ...enquanto a nova entra, do começo
    const next = (this.active + 1) % this.players.length;
    const player = this.players[next]!;
    player.el.src = TRACKS[wanted];
    player.el.currentTime = 0;
    player.el.play().catch(() => {
      // o navegador ainda não deixou: tenta de novo no próximo quadro
      this.track = null;
    });
    player.gain!.gain.cancelScheduledValues(t);
    player.gain!.gain.setValueAtTime(0, t);
    player.gain!.gain.setTargetAtTime(1, t, FADE_S);
    this.active = next;
    this.track = wanted;
  }
}

/** Um silêncio curtinho (WAV de 0,05 s), para liberar os tocadores no primeiro clique sem baixar música nenhuma. */
function silentWav(): string {
  const samples = 2205;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 44100, true);
  view.setUint32(28, 44100 * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}
