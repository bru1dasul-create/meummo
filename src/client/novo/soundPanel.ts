// Painel do som do jogo 2.5D: o botão do som da HUD abre. Liga e desliga o som e ajusta o volume de cada parte:
// música, efeitos (golpes, moedas...) e ambiente (mata, água, vila). No computador, tem também o botão das teclas
// (keysPanel.ts). Visual simples (provisório): a [arte] restiliza (#sound-panel) quando quiser.

import type { SoundPart, SoundVolumes } from '../sfx';

export interface SoundPanelActions {
  toggleMute(): void;
  setVolume(part: SoundPart, value: number): void;
  /** Abre a janela das teclas (só no computador: no celular não tem teclado). */
  openKeys?(): void;
}

const PARTS: { part: SoundPart; label: string }[] = [
  { part: 'musica', label: 'Música' },
  { part: 'efeitos', label: 'Efeitos' },
  { part: 'ambiente', label: 'Ambiente' },
];

export class SoundPanel {
  private readonly panel = document.createElement('div');
  private readonly style = document.createElement('style');
  private readonly muteButton = document.createElement('button');
  private readonly sliders = new Map<SoundPart, HTMLInputElement>();

  constructor(private readonly actions: SoundPanelActions) {
    this.style.textContent = `
      #sound-panel { position: fixed; left: calc(8px + env(safe-area-inset-left)); top: calc(150px + env(safe-area-inset-top)); z-index: 8; width: 230px; padding: 10px 12px; border-radius: 10px; border: 2px solid #8a5a2b; background: rgba(28, 18, 12, 0.95); color: #f1e4c8; font: 13px system-ui, sans-serif; display: flex; flex-direction: column; gap: 8px; }
      #sound-panel h3 { margin: 0; font: 800 13px system-ui, sans-serif; color: #ffd98a; display: flex; justify-content: space-between; align-items: center; }
      #sound-panel h3 button { background: none; border: 0; color: #f1e4c8; font-size: 16px; cursor: pointer; }
      #sound-panel label { display: grid; grid-template-columns: 70px 1fr 34px; gap: 6px; align-items: center; }
      #sound-panel input[type=range] { width: 100%; accent-color: #e8a33a; }
      #sound-panel .mute { padding: 6px 8px; border-radius: 6px; border: 1px solid #8a5a2b; background: #3a2616; color: #f1e4c8; font: 600 12px system-ui, sans-serif; cursor: pointer; }
      #sound-panel .mute.off { background: #5b1e16; border-color: #c0392b; }
      #sound-panel .keys { padding: 6px 8px; border-radius: 6px; border: 1px solid #8a5a2b; background: #3a2616; color: #f1e4c8; font: 600 12px system-ui, sans-serif; cursor: pointer; }
      @media (pointer: coarse) { #sound-panel { top: calc(126px + env(safe-area-inset-top)); } #sound-panel input[type=range] { height: 28px; } #sound-panel .keys { display: none; } }`;
    document.head.append(this.style);
    this.panel.id = 'sound-panel';
    this.panel.hidden = true;
    const title = document.createElement('h3');
    title.textContent = 'Som';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.title = 'Fechar';
    close.addEventListener('click', () => this.close());
    title.append(close);
    this.muteButton.type = 'button';
    this.muteButton.className = 'mute';
    this.muteButton.addEventListener('click', () => this.actions.toggleMute());
    this.panel.append(title, this.muteButton);
    for (const { part, label } of PARTS) {
      const row = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = label;
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.step = '5';
      slider.dataset.part = part;
      const value = document.createElement('span');
      slider.addEventListener('input', () => {
        value.textContent = slider.value;
        this.actions.setVolume(part, Number(slider.value) / 100);
      });
      row.append(name, slider, value);
      this.sliders.set(part, slider);
      this.panel.append(row);
    }
    if (actions.openKeys) {
      const keys = document.createElement('button');
      keys.type = 'button';
      keys.className = 'keys';
      keys.id = 'keys-button';
      keys.textContent = '⌨️ Teclas';
      keys.addEventListener('click', () => {
        this.close();
        actions.openKeys?.();
      });
      this.panel.append(keys);
    }
    // clique no painel não vira clique no jogo (andar, atirar)
    for (const type of ['pointerdown', 'keydown'] as const) this.panel.addEventListener(type, (event) => event.stopPropagation());
    document.body.append(this.panel);
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  toggle(): void {
    this.panel.hidden = !this.panel.hidden;
  }

  close(): void {
    this.panel.hidden = true;
  }

  /** Mostra o que vale agora (o som ligado ou não e os volumes). */
  show(muted: boolean, volumes: SoundVolumes): void {
    this.muteButton.textContent = muted ? '🔇 Som desligado (ligar)' : '🔊 Som ligado (desligar)';
    this.muteButton.classList.toggle('off', muted);
    for (const [part, slider] of this.sliders) {
      slider.value = String(Math.round(volumes[part] * 100));
      (slider.nextElementSibling as HTMLElement).textContent = slider.value;
    }
  }

  destroy(): void {
    this.panel.remove();
    this.style.remove();
  }
}
