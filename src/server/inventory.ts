// A mochila de um jogador: BAG_SIZE espaços (itens iguais se juntam em pilhas) e o que está equipado.
// Só regras de "onde cada coisa fica"; o que o item faz (curar, dar dano...) fica em world.ts.

import {
  BAG_SIZE,
  EQUIP_SLOTS,
  MAX_GOLD,
  emptyEquipment,
  gearLookOf,
  type EquipSlot,
  type GearLook,
  type InventoryState,
  type ItemBonus,
  type ItemInfo,
  type ItemStack,
} from '../shared/items';

/** Como a mochila fica guardada no arquivo de personagens (JSON). */
export interface SavedInventory {
  slots: (ItemStack | null)[];
  equipped: Partial<Record<EquipSlot, string | null>>;
  /** Saves de antes do ouro não têm: começa com 0. */
  gold?: number;
}

export class Inventory {
  readonly slots: (ItemStack | null)[] = new Array<ItemStack | null>(BAG_SIZE).fill(null);
  readonly equipped: Record<EquipSlot, string | null> = emptyEquipment();
  /** Ouro: não ocupa espaço na mochila (até MAX_GOLD). */
  gold = 0;

  constructor(private readonly defs: ReadonlyMap<string, ItemInfo>) {}

  /** Guarda ouro (até o máximo). Devolve quanto entrou. */
  addGold(n: number): number {
    if (!(n > 0)) return 0;
    const added = Math.min(Math.floor(n), MAX_GOLD - this.gold);
    this.gold += added;
    return added;
  }

  /** O item do espaço `i` e o que se sabe dele (ou null se o espaço está vazio). */
  at(i: number): { stack: ItemStack; def: ItemInfo } | null {
    const stack = Number.isInteger(i) ? this.slots[i] : undefined;
    const def = stack ? this.defs.get(stack.item) : undefined;
    return stack && def ? { stack, def } : null;
  }

  /** Põe itens na mochila, juntando com pilhas do mesmo item. Devolve quantos couberam. */
  add(item: string, n: number): number {
    const def = this.defs.get(item);
    if (!def || !(n > 0)) return 0;
    let left = Math.floor(n);
    for (const stack of this.slots) {
      if (left === 0) break;
      if (stack && stack.item === item && stack.n < def.stack) {
        const put = Math.min(left, def.stack - stack.n);
        stack.n += put;
        left -= put;
      }
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (this.slots[i] === null) {
        const put = Math.min(left, def.stack);
        this.slots[i] = { item, n: put };
        left -= put;
      }
    }
    return Math.floor(n) - left;
  }

  /** Quantos deste item ainda cabem (nas pilhas que não estão cheias e nos espaços vazios). */
  room(item: string): number {
    const def = this.defs.get(item);
    if (!def) return 0;
    let room = 0;
    for (const stack of this.slots) room += stack === null ? def.stack : stack.item === item ? Math.max(0, def.stack - stack.n) : 0;
    return room;
  }

  /** Quantos deste item há na mochila (somando as pilhas). */
  countOf(item: string): number {
    let total = 0;
    for (const stack of this.slots) if (stack?.item === item) total += stack.n;
    return total;
  }

  /** Tira `n` deste item, das pilhas que houver. false (e nada muda) se não tiver tudo isso. */
  removeItem(item: string, n: number): boolean {
    if (this.countOf(item) < n) return false;
    let left = n;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const stack = this.slots[i];
      if (stack?.item !== item) continue;
      const taken = Math.min(left, stack.n);
      stack.n -= taken;
      left -= taken;
      if (stack.n === 0) this.slots[i] = null;
    }
    return true;
  }

  /** Tira até `n` itens do espaço `i`. */
  take(i: number, n = 1): ItemStack | null {
    const stack = Number.isInteger(i) ? this.slots[i] : undefined;
    if (!stack) return null;
    const taken = Math.min(n, stack.n);
    stack.n -= taken;
    if (stack.n === 0) this.slots[i] = null;
    return { item: stack.item, n: taken };
  }

  /** Equipa o item do espaço `i`. O que estava equipado naquela parte volta para o mesmo espaço. */
  equip(i: number): boolean {
    const found = this.at(i);
    if (!found || found.def.kind !== 'equipment' || !found.def.slot) return false;
    const slot = found.def.slot;
    const previous = this.equipped[slot];
    this.equipped[slot] = found.stack.item;
    this.slots[i] = previous ? { item: previous, n: 1 } : null;
    return true;
  }

  /** Tira o equipamento e guarda na mochila. false = nada equipado ali, ou mochila cheia. */
  unequip(slot: EquipSlot): boolean {
    const item = this.equipped[slot];
    const free = this.slots.indexOf(null);
    if (!item || free === -1) return false;
    this.slots[free] = { item, n: 1 };
    this.equipped[slot] = null;
    return true;
  }

  /** Soma dos atributos de tudo que está equipado. */
  bonus(): ItemBonus {
    const total: ItemBonus = { damage: 0, hp: 0, defense: 0 };
    for (const slot of EQUIP_SLOTS) {
      const def = this.equipped[slot] ? this.defs.get(this.equipped[slot]!) : undefined;
      if (!def) continue;
      total.damage += def.bonus.damage;
      total.hp += def.bonus.hp;
      total.defense += def.bonus.defense;
    }
    return total;
  }

  /** O desenho de cada parte equipada (o ícone do item), para os outros verem no personagem. */
  look(): GearLook {
    return gearLookOf(this.equipped, this.defs);
  }

  /** Uma cópia, para mandar ao navegador ou salvar. */
  state(): InventoryState {
    return { slots: this.slots.map((s) => (s ? { ...s } : null)), equipped: { ...this.equipped }, gold: this.gold };
  }

  /**
   * Monta a mochila a partir do que estava salvo, com cuidado: o arquivo pode ser de outra versão do jogo.
   * Itens que não existem mais em data/items.json saem (e voltam em `dropped`); pilhas grandes demais são
   * cortadas; um equipamento que mudou de parte volta para a mochila; o ouro fica entre 0 e MAX_GOLD
   * (save de antes do ouro: 0).
   */
  static fromSaved(defs: ReadonlyMap<string, ItemInfo>, saved: unknown): { inventory: Inventory; dropped: string[] } {
    const inventory = new Inventory(defs);
    const dropped: string[] = [];
    if (typeof saved !== 'object' || saved === null) return { inventory, dropped };
    const { slots, equipped, gold } = saved as { slots?: unknown; equipped?: unknown; gold?: unknown };
    if (typeof gold === 'number' && Number.isFinite(gold)) inventory.gold = Math.min(MAX_GOLD, Math.max(0, Math.floor(gold)));
    if (Array.isArray(slots)) {
      slots.slice(0, BAG_SIZE).forEach((raw: unknown, i) => {
        if (typeof raw !== 'object' || raw === null) return;
        const { item, n } = raw as { item?: unknown; n?: unknown };
        if (typeof item !== 'string' || typeof n !== 'number' || !Number.isInteger(n) || n <= 0) return;
        const def = defs.get(item);
        if (!def) dropped.push(item);
        else inventory.slots[i] = { item, n: Math.min(n, def.stack) };
      });
    }
    if (typeof equipped === 'object' && equipped !== null) {
      for (const slot of EQUIP_SLOTS) {
        const item = (equipped as Record<string, unknown>)[slot];
        if (typeof item !== 'string') continue;
        const def = defs.get(item);
        if (!def) dropped.push(item);
        else if (def.kind === 'equipment' && def.slot === slot) inventory.equipped[slot] = item;
        else if (inventory.add(item, 1) === 0) dropped.push(item);
      }
    }
    return { inventory, dropped };
  }
}
