// Os efeitos com tempo valendo agora (a Banana, a Água de Coco, a garrafada): um quadradinho com o desenho do item e
// o tempo que falta, perto da vida. Quem decide é o servidor (a mensagem `effects`); aqui só mostra e conta o tempo.
// O visual é da [arte], no style.css (seção "efeitos com tempo": `#effects-bar .effect`, com `data-key` = o que mexe,
// 'destreza', 'regen'..., e `data-item`; `.time` e `.ending`; com o mouse em cima, a dica `.tip`, na cara da dica das
// habilidades — pedido do dono, 23/11: "melhorar o visual quando passa o mouse em cima da poção/banana utilizada").
// Cada quadradinho é feito uma vez e só o tempo muda a cada segundo (refazer tudo apagava a dica com o mouse em cima).

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
  if (effect.key === 'regen') return `A vida volta ${String(effect.value).replace('.', ',')}× mais rápido fora de luta`;
  return isAttributeId(effect.key) ? `+${effect.value} de ${ATTRIBUTE_NAMES[effect.key]}` : '';
}

/** Um quadradinho na tela: o elemento e os pedaços que mudam com o tempo. */
interface Slot {
  el: HTMLDivElement;
  time: HTMLSpanElement;
  left: HTMLSpanElement;
}

function part<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

export class EffectsBar {
  private readonly root = document.createElement('div');
  private effects: ShownEffect[] = [];
  private shownKey = '';
  /** Os quadradinhos na tela, pelo efeito (o que mexe e o item). */
  private readonly slots = new Map<string, Slot>();

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
    const keep = new Set<string>();
    let prev: HTMLElement | null = null;
    for (const effect of active) {
      const id = `${effect.key}:${effect.item}`;
      keep.add(id);
      let slot = this.slots.get(id);
      if (!slot) {
        slot = this.makeSlot(effect);
        this.slots.set(id, slot);
      }
      // na ordem da lista do servidor (sem tirar da tela quem já está no lugar)
      const want: ChildNode | null = prev ? prev.nextSibling : this.root.firstChild;
      if (want !== slot.el) this.root.insertBefore(slot.el, want);
      prev = slot.el;
      const left = effect.until - now;
      slot.el.classList.toggle('ending', left < 10_000);
      slot.time.textContent = clock(left);
      slot.left.textContent = clock(left);
    }
    for (const [id, slot] of this.slots) {
      if (keep.has(id)) continue;
      slot.el.remove();
      this.slots.delete(id);
    }
  }

  /** O quadradinho de um efeito: o desenho do item, o tempo e a dica (o nome, o que dá e quanto falta). */
  private makeSlot(effect: ShownEffect): Slot {
    const el = part('div', 'effect');
    el.dataset.key = effect.key;
    el.dataset.item = effect.item;
    const def = this.items.get(effect.item);
    const img = part('img', '');
    img.src = itemIconUrl(def ? def.icon : effect.item);
    img.alt = '';
    const time = part('span', 'time');
    const tip = part('div', 'tip');
    tip.setAttribute('role', 'tooltip');
    const title = part('strong', `tip-title${def ? ` rarity-${def.rarity}` : ''}`, def?.name ?? effect.item);
    const gives = part('div', 'tip-line tip-bonus', what(effect));
    const left = part('span', 'tip-left');
    const ends = part('div', 'tip-line tip-tempo', 'Acaba em ');
    ends.append(left);
    tip.append(title, gives, ends);
    el.append(img, time, tip);
    return { el, time, left };
  }

  destroy(): void {
    this.root.remove();
    this.slots.clear();
  }
}
