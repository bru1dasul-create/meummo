// Janela da loja: o que o vendedor vende e o que você pode vender para ele.
// Só mostra e pede: quem confere ouro, distância e espaço na mochila é o servidor.
// Visual de barraca de feira: toldo listrado, retrato de quem vende com a fala num balão,
// abas Comprar/Vender e preços com a moeda desenhada (coinArt.ts).

import { sellPrice, type InventoryState, type ItemInfo } from '../shared/items';
import type { NpcInfo } from '../shared/protocol';
import { bonusLines } from './bag';
import { characterPortrait } from './game/characters';
import { itemIconUrl } from './itemArt';

export interface ShopActions {
  buy(npc: number, item: string, n: number): void;
  sell(npc: number, i: number, n: number): void;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento #${id} não encontrado`);
  return el as T;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function gold(n: number): HTMLSpanElement {
  return el('span', 'gold', n.toLocaleString('pt-BR'));
}

/** O ícone do item num quadradinho com a cor da raridade (e a quantidade, se tiver mais de um). */
function icon(def: ItemInfo, count = 1): HTMLElement {
  const slot = el('span', `shop-slot rarity-${def.rarity}`);
  const img = el('img', 'shop-icon');
  img.src = itemIconUrl(def.icon);
  img.alt = '';
  img.draggable = false;
  slot.append(img);
  if (count > 1) slot.append(el('span', 'shop-count', String(count)));
  return slot;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  b.tabIndex = -1;
  b.addEventListener('click', onClick);
  return b;
}

/** O que o item faz, numa linha curta ("cura 15", "+10 de vida"). */
function effectOf(def: ItemInfo): string {
  if (def.kind === 'consumable') return `cura ${def.heal}`;
  if (def.kind === 'equipment') return bonusLines(def).join(', ');
  return 'material';
}

export class ShopWindow {
  private readonly root = byId<HTMLDivElement>('shop');
  private npc: NpcInfo | null = null;
  private inv: InventoryState;
  private tab: 'buy' | 'sell' = 'buy';
  /** Ouro na última vez que desenhou (para o número pular quando muda). */
  private shownGold = -1;
  private portrait = '';

  constructor(
    private readonly items: ReadonlyMap<string, ItemInfo>,
    inv: InventoryState,
    private readonly actions: ShopActions,
  ) {
    this.inv = inv;
    this.root.hidden = true;
  }

  get isOpen(): boolean {
    return this.npc !== null;
  }

  /** Id do vendedor com a janela aberta (null = fechada). */
  get npcId(): number | null {
    return this.npc?.e.id ?? null;
  }

  open(npc: NpcInfo): void {
    this.npc = npc;
    this.tab = 'buy';
    this.shownGold = -1;
    this.portrait = characterPortrait(npc.e.look, npc.e.gear ?? {}, 6, npc.e.kind === 'npc' ? npc.e.type : undefined);
    this.root.hidden = false;
    this.render();
  }

  readonly close = (): void => {
    this.npc = null;
    this.root.hidden = true;
    this.root.replaceChildren();
  };

  /** A mochila mudou (comprou, vendeu, pegou item...): redesenha se estiver aberta. */
  setInventory(inv: InventoryState): void {
    this.inv = inv;
    if (this.npc) this.render();
  }

  destroy(): void {
    this.close();
  }

  private render(): void {
    const npc = this.npc;
    if (!npc?.shop) return;
    const shop = npc.shop;

    // ---- cabeçalho: toldo, retrato, nome e a fala no balão ----
    const head = el('div', 'shop-head');
    const portrait = el('div', 'shop-portrait');
    const face = el('img');
    face.src = this.portrait;
    face.alt = '';
    face.draggable = false;
    portrait.append(face);
    const who = el('div', 'shop-who');
    who.append(el('strong', '', npc.e.name));
    if (npc.title) who.append(el('span', 'shop-title', npc.title));
    if (npc.line) who.append(el('p', 'shop-line', npc.line));
    const close = button('shop-close', '✕', this.close);
    close.title = 'Fechar (Esc)';
    close.setAttribute('aria-label', 'Fechar a loja');
    head.append(portrait, who, close);

    // ---- abas e o seu ouro ----
    const forSale = this.inv.slots.filter((stack) => {
      const def = stack ? this.items.get(stack.item) : undefined;
      return def && sellPrice(def, shop.buyPercent) > 0;
    }).length;
    const bar = el('div', 'shop-bar');
    const tabs = el('div', 'shop-tabs');
    for (const [key, label] of [
      ['buy', 'Comprar'],
      ['sell', forSale > 0 ? `Vender (${forSale})` : 'Vender'],
    ] as const) {
      const t = button(`shop-tab${this.tab === key ? ' on' : ''}`, label, () => {
        this.tab = key;
        this.render();
      });
      tabs.append(t);
    }
    const purse = el('div', 'shop-purse');
    purse.title = 'Seu ouro';
    const amount = gold(this.inv.gold);
    if (this.shownGold >= 0 && this.shownGold !== this.inv.gold) amount.classList.add('bump');
    this.shownGold = this.inv.gold;
    purse.append(amount);
    bar.append(tabs, purse);

    const list = el('ul', 'shop-list');
    let foot = '';
    if (this.tab === 'buy') {
      for (const id of shop.sells) {
        const def = this.items.get(id);
        if (!def) continue;
        const row = el('li', 'shop-card');
        const info = el('div', 'shop-info');
        info.append(el('span', `item-name rarity-${def.rarity}`, def.name), el('span', 'shop-effect', effectOf(def)));
        const missing = def.price - this.inv.gold;
        const buy = button('shop-buy', 'Comprar', () => this.actions.buy(npc.e.id, id, 1));
        buy.disabled = missing > 0;
        buy.title = missing > 0 ? `Falta ${missing.toLocaleString('pt-BR')} de ouro` : `Comprar 1 ${def.name}`;
        const price = el('div', 'shop-price');
        price.append(gold(def.price));
        if (missing > 0) price.append(el('span', 'shop-missing', `falta ${missing.toLocaleString('pt-BR')}`));
        row.append(icon(def), info, price, buy);
        list.append(row);
      }
      foot = 'O que você compra vai direto para a mochila.';
    } else {
      this.inv.slots.forEach((stack, i) => {
        if (!stack) return;
        const def = this.items.get(stack.item);
        if (!def) return;
        const each = sellPrice(def, shop.buyPercent);
        if (each <= 0) return;
        const row = el('li', 'shop-card');
        const info = el('div', 'shop-info');
        info.append(el('span', `item-name rarity-${def.rarity}`, def.name));
        const eachEl = el('span', 'shop-effect', 'cada ');
        eachEl.append(gold(each));
        info.append(eachEl);
        const buttons = el('div', 'shop-buttons');
        buttons.append(button('shop-sell', 'Vender', () => this.actions.sell(npc.e.id, i, 1)));
        if (stack.n > 1) {
          const all = button('shop-sell all', `Todos (${(each * stack.n).toLocaleString('pt-BR')})`, () => this.actions.sell(npc.e.id, i, stack.n));
          all.title = `Vender ${stack.n} por ${(each * stack.n).toLocaleString('pt-BR')} de ouro`;
          buttons.append(all);
        }
        row.append(icon(def, stack.n), info, buttons);
        list.append(row);
      });
      foot =
        shop.buyPercent > 0
          ? `${npc.e.name.split(' ').slice(-1)[0]} paga ${shop.buyPercent === 50 ? 'metade do preço' : `${shop.buyPercent}% do preço`} pelo que você vende.`
          : '';
    }

    const parts: HTMLElement[] = [el('div', 'shop-awning'), head, bar];
    if (list.children.length > 0) parts.push(list);
    else parts.push(el('p', 'shop-empty', this.tab === 'sell' ? 'Nada para vender. Os monstros deixam itens que valem ouro.' : 'Nada à venda agora.'));
    if (foot) parts.push(el('p', 'shop-foot', foot));
    this.root.replaceChildren(...parts);
  }
}
