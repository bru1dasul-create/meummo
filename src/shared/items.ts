// Itens: o que o navegador e o servidor precisam concordar (os números de cada item vêm de
// data/items.json e chegam ao navegador na mensagem de boas-vindas).

/** Partes do corpo onde dá para equipar alguma coisa. */
export type EquipSlot = 'weapon' | 'head' | 'body' | 'charm';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'head', 'body', 'charm'];

export type ItemKind = 'equipment' | 'consumable' | 'material';
export type Rarity = 'common' | 'rare' | 'legendary';

/** Atributos que um equipamento soma ao personagem. */
export interface ItemBonus {
  damage: number;
  hp: number;
  defense: number;
}

/** Tudo que se sabe sobre um tipo de item. */
export interface ItemInfo {
  id: string;
  name: string;
  kind: ItemKind;
  /** Equipamento: onde ele vai. */
  slot: EquipSlot | null;
  bonus: ItemBonus;
  /** Consumível: quanto de vida recupera. */
  heal: number;
  /** Consumível: tempo até poder usar outro consumível. */
  cooldownMs: number;
  /** Quantos cabem num espaço da mochila. */
  stack: number;
  rarity: Rarity;
  description: string;
  /** Nome do desenho (src/client/itemArt.ts). */
  icon: string;
}

/** Quantos espaços a mochila tem. */
export const BAG_SIZE = 20;

export interface ItemStack {
  item: string;
  n: number;
}

/** A mochila e o que está equipado (o servidor manda isto inteiro quando muda). */
export interface InventoryState {
  slots: (ItemStack | null)[];
  equipped: Record<EquipSlot, string | null>;
}

export function emptyEquipment(): Record<EquipSlot, string | null> {
  return { weapon: null, head: null, body: null, charm: null };
}
