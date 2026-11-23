// Os efeitos com tempo valendo agora (a Banana, a Água de Coco, a garrafada): um quadradinho com o desenho do item e
// o tempo que falta, perto da vida. Quem decide é o servidor (a mensagem `effects`); aqui só mostra e conta o tempo.
// O visual é provisório: a [arte] veste (`#effects-bar .effect`, `data-key` = o que mexe: 'destreza', 'regen'...) ou
// leva para a HUD.

import { ATTRIBUTE_NAMES, isAttributeId } from '../../shared/attributes';
import type { EffectKey, ItemInfo } from '../../shared/items';
import { itemIconUrl } from '../itemArt';

/** Um efeito valendo, com o fim no relógio do jogo. */
export interface ShownEffect {
  key: EffectKey;
  item: string;
  value: number;
  until: number;
}

const STYLE_ID = 'effects-bar-provisorio';

function installStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#effects-bar { position: fixed; z-index: 6; top: calc(160px + env(safe-area-inset-top)); left: calc(168px + env(safe-area-inset-left));
  display: flex; gap: 6px; pointer-events: none; }
#effects-bar .effect { position: relative; width: 34px; height: 34px; border-radius: 8px; border: 1px solid rgba(214, 170, 104, 0.8);
  background: rgba(16, 12, 8, 0.85); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5); pointer-events: auto; }
#effects-bar .effect img { width: 100%; height: 100%; object-fit: contain; }
#effects-bar .effect .time { position: absolute; left: 50%; bottom: -15px; transform: translateX(-50%); font: 700 11px/1 system-ui, sans-serif;
  color: #f1e4c8; text-shadow: 0 1px 2px #000, 0 0 3px #000; white-space: nowrap; }
#effects-bar .effect.ending { animation: effect-ending 0.6s ease-in-out infinite; }
@keyframes effect-ending { 50% { opacity: 0.45; } }
@media (pointer: coarse) { #effects-bar { top: calc(118px + env(safe-area-inset-top)); left: calc(100px + env(safe-area-inset-left)); } }
`;
  document.head.append(style);
}

/** "2:41", "0:09". */
function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** O que o efeito dá, em texto (para a dica do quadradinho). */
function what(effect: ShownEffect): string {
  if (effect.key === 'regen') return `a vida volta ${String(effect.value).replace('.', ',')}× mais rápido fora de luta`;
  return isAttributeId(effect.key) ? `+${effect.value} de ${ATTRIBUTE_NAMES[effect.key]}` : '';
}

export class EffectsBar {
  private readonly root = document.createElement('div');
  private effects: ShownEffect[] = [];
  private shownKey = '';

  constructor(private readonly items: ReadonlyMap<string, ItemInfo>) {
    installStyle();
    this.root.id = 'effects-bar';
    document.body.append(this.root);
  }

  /** A lista nova que o servidor mandou (já com o fim no relógio do jogo). */
  set(effects: ShownEffect[]): void {
    this.effects = effects;
    this.shownKey = '';
  }

  /** Os efeitos valendo agora (para os testes e para as contas do navegador). */
  active(now: number): ShownEffect[] {
    return this.effects.filter((effect) => now < effect.until);
  }

  /** A cada quadro: tira os que acabaram e atualiza o tempo (só mexe na tela quando o segundo muda). */
  update(now: number): void {
    const active = this.active(now);
    const key = active.map((e) => `${e.key}:${e.item}:${Math.ceil((e.until - now) / 1000)}`).join('|');
    if (key === this.shownKey) return;
    this.shownKey = key;
    this.root.replaceChildren(
      ...active.map((effect) => {
        const el = document.createElement('div');
        el.className = 'effect';
        el.dataset.key = effect.key;
        el.dataset.item = effect.item;
        const left = effect.until - now;
        el.classList.toggle('ending', left < 10_000);
        const def = this.items.get(effect.item);
        const img = document.createElement('img');
        img.src = itemIconUrl(def ? def.icon : effect.item);
        img.alt = '';
        const time = document.createElement('span');
        time.className = 'time';
        time.textContent = clock(left);
        el.title = `${def?.name ?? effect.item}: ${what(effect)} (${clock(left)})`;
        el.append(img, time);
        return el;
      }),
    );
  }

  destroy(): void {
    this.root.remove();
  }
}
