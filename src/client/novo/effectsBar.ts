// Os efeitos com tempo valendo agora (a Banana, a Água de Coco, a garrafada): um quadradinho com o desenho do item e
// o tempo que falta, perto da vida. Quem decide é o servidor (a mensagem `effects`); aqui só mostra e conta o tempo.
// O visual é da [arte], no style.css (seção "efeitos com tempo": `#effects-bar .effect`, com `data-key` = o que mexe,
// 'destreza', 'regen'..., e `data-item`; `.time` e `.ending`).

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
