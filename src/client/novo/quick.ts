// Atalhos de consumo do jogo novo: 1 = comida, 2 = remédio (campo "atalho" de data/items.json). Cada um usa, sem abrir
// a mochila, o item do grupo que você TEM com a maior cura, e mostra quantos ainda há. Teclas 3 e 4 no PC.
// Visual simples (botões redondos ao lado da barra de ações); a [arte] restiliza (#quick-slots .quick) ou leva para a
// HUD nova.

import type { ItemInfo, QuickPick } from '../../shared/items';
import { itemIconUrl } from '../itemArt';

const LABELS = ['Comida', 'Remédio'] as const;
const KEYS = ['3', '4'] as const;

interface QuickButton {
  el: HTMLButtonElement;
  img: HTMLImageElement;
  count: HTMLSpanElement;
  cd: HTMLSpanElement;
}

export class QuickSlots {
  private readonly root = document.createElement('div');
  private readonly buttons: QuickButton[] = [];
  private readonly style = document.createElement('style');
  private readyAt = 0;
  private duration = 0;

  constructor(private readonly onUse: (n: 1 | 2) => void) {
    this.root.id = 'quick-slots';
    // provisório (a [arte] leva para o style.css): à direita da barra de ações no PC; no celular, à esquerda do
    // quadrado de botões, no lado direito da tela (o esquerdo é do joystick)
    this.style.textContent = `
      #quick-slots { position: fixed; left: calc(50% + 184px); bottom: calc(14px + env(safe-area-inset-bottom)); display: flex; gap: 8px; z-index: 6; }
      #quick-slots .quick { position: relative; width: 58px; height: 58px; border-radius: 50%; border: 2px solid var(--frame, #b8893a); background: var(--wood, #2b1d12); padding: 0; cursor: pointer; overflow: hidden; touch-action: manipulation; }
      #quick-slots .quick img { width: 34px; height: 34px; image-rendering: pixelated; display: block; margin: 0 auto; }
      #quick-slots .quick.empty img { opacity: 0.25; filter: grayscale(1); }
      #quick-slots .quick .count { position: absolute; right: 6px; bottom: 4px; font: 700 13px system-ui, sans-serif; color: #fff; text-shadow: 0 1px 2px #000; }
      #quick-slots .quick .key { position: absolute; left: 7px; top: 3px; font: 600 10px system-ui, sans-serif; color: #e9d8b0; opacity: 0.8; }
      #quick-slots .quick .cd { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.55); transform-origin: bottom; transform: scaleY(0); pointer-events: none; }
      @media (pointer: coarse) {
        #quick-slots { left: auto; right: calc(164px + env(safe-area-inset-right)); flex-direction: column; }
        #quick-slots .quick .key { display: none; }
      }`;
    document.head.append(this.style);
    LABELS.forEach((label, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'quick empty';
      el.tabIndex = -1;
      el.dataset.slot = String(i + 1);
      el.title = `${label} (${KEYS[i]})`;
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      const count = document.createElement('span');
      count.className = 'count';
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = KEYS[i]!;
      const cd = document.createElement('span');
      cd.className = 'cd';
      el.append(img, count, key, cd);
      el.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.onUse((i + 1) as 1 | 2);
      });
      el.addEventListener('contextmenu', (event) => event.preventDefault());
      this.root.append(el);
      this.buttons.push({ el, img, count, cd });
    });
    document.body.append(this.root);
  }

  /** O que cada atalho tem agora (null = nada daquele grupo na mochila). */
  set(picks: readonly (QuickPick | null)[], items: ReadonlyMap<string, ItemInfo>): void {
    this.buttons.forEach((button, i) => {
      const pick = picks[i] ?? null;
      const def = pick ? items.get(pick.item) : undefined;
      button.el.classList.toggle('empty', !def);
      button.img.src = itemIconUrl(def ? def.icon : i === 0 ? 'banana' : 'erva');
      button.count.textContent = pick ? String(pick.count) : '';
      button.el.title = def ? `${def.name} — cura ${def.heal} (${KEYS[i]})` : `${LABELS[i]}: nada na mochila (${KEYS[i]})`;
    });
  }

  setCooldown(readyAt: number, duration: number): void {
    this.readyAt = readyAt;
    this.duration = duration;
  }

  update(now: number): void {
    const remaining = Math.max(0, this.readyAt - now);
    const fraction = this.duration > 0 ? remaining / this.duration : 0;
    for (const button of this.buttons) button.cd.style.transform = `scaleY(${fraction.toFixed(3)})`;
  }

  destroy(): void {
    this.root.remove();
    this.style.remove();
  }
}
