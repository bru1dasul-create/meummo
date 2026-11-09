// Janela da loja: o que o vendedor vende e o que você pode vender para ele.
// Só mostra e pede: quem confere ouro, distância e espaço na mochila é o servidor.
// Visual simples de propósito (a frente de Arte capricha depois).

import { sellPrice, type InventoryState, type ItemInfo } from '../shared/items';
import type { NpcInfo } from '../shared/protocol';
import { bonusLines } from './bag';
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

function icon(def: ItemInfo): HTMLImageElement {
  const img = el('img', 'shop-icon');
  img.src = itemIconUrl(def.icon);
  img.alt = '';
  img.draggable = false;
  return img;
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
    const head = el('div', 'shop-head');
    const who = el('div', 'shop-who');
    who.append(el('strong', '', npc.e.name));
    if (npc.title) who.append(el('span', 'shop-title', npc.title));
    const close = el('button', 'shop-close', '✕');
    close.type = 'button';
    close.title = 'Fechar (Esc)';
    close.setAttribute('aria-label', 'Fechar a loja');
    close.addEventListener('click', this.close);
    head.append(who, close);

    const parts: HTMLElement[] = [head];
    if (npc.line) parts.push(el('p', 'shop-line', `“${npc.line}”`));
    const purse = el('div', 'shop-purse', 'Seu ouro: ');
    purse.append(gold(this.inv.gold));
    parts.push(purse);

    // ---- comprar ----
    parts.push(el('h3', '', 'Comprar'));
    const buyList = el('ul', 'shop-list');
    for (const id of shop.sells) {
      const def = this.items.get(id);
      if (!def) continue;
      const row = el('li');
      const info = el('div', 'shop-info');
      info.append(el('span', `item-name rarity-${def.rarity}`, def.name), el('span', 'shop-effect', effectOf(def)));
      const price = gold(def.price);
      const buy = el('button', 'shop-buy', 'Comprar');
      buy.type = 'button';
      buy.disabled = this.inv.gold < def.price;
      buy.title = buy.disabled ? 'Ouro insuficiente' : `Comprar 1 ${def.name}`;
      buy.addEventListener('click', () => this.actions.buy(npc.e.id, id, 1));
      row.append(icon(def), info, price, buy);
      buyList.append(row);
    }
    parts.push(buyList);

    // ---- vender ----
    const sellTitle = el('h3', '', 'Vender');
    if (shop.buyPercent > 0) sellTitle.append(el('small', '', ` (ela paga ${shop.buyPercent === 50 ? 'metade do preço' : `${shop.buyPercent}% do preço`})`));
    parts.push(sellTitle);
    const sellList = el('ul', 'shop-list');
    this.inv.slots.forEach((stack, i) => {
      if (!stack) return;
      const def = this.items.get(stack.item);
      if (!def) return;
      const each = sellPrice(def, shop.buyPercent);
      if (each <= 0) return;
      const row = el('li');
      const info = el('div', 'shop-info');
      info.append(el('span', `item-name rarity-${def.rarity}`, stack.n > 1 ? `${def.name} ×${stack.n}` : def.name));
      const eachEl = el('span', 'shop-effect', 'cada: ');
      eachEl.append(gold(each));
      info.append(eachEl);
      const buttons = el('div', 'shop-buttons');
      const one = el('button', 'shop-sell', 'Vender');
      one.type = 'button';
      one.addEventListener('click', () => this.actions.sell(npc.e.id, i, 1));
      buttons.append(one);
      if (stack.n > 1) {
        const all = el('button', 'shop-sell', 'Todos');
        all.type = 'button';
        all.title = `Vender ${stack.n} por ${(each * stack.n).toLocaleString('pt-BR')} de ouro`;
        all.addEventListener('click', () => this.actions.sell(npc.e.id, i, stack.n));
        buttons.append(all);
      }
      row.append(icon(def), info, buttons);
      sellList.append(row);
    });
    if (sellList.children.length === 0) parts.push(el('p', 'shop-empty', 'Nada para vender. Os monstros deixam itens que valem ouro.'));
    else parts.push(sellList);

    this.root.replaceChildren(...parts);
  }
}
