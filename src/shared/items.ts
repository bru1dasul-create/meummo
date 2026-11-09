// Itens: o que o navegador e o servidor precisam concordar (os números de cada item vêm de
// data/items.json e chegam ao navegador na mensagem de boas-vindas).

/**
 * Partes do corpo onde dá para equipar alguma coisa: arma, escudo (mão secundária), cabeça, corpo,
 * luvas, botas e acessório. A ordem é a da mochila.
 */
export type EquipSlot = 'head' | 'body' | 'hands' | 'feet' | 'weapon' | 'offhand' | 'charm';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['head', 'body', 'hands', 'feet', 'weapon', 'offhand', 'charm'];

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
  /** Nome do visual no personagem (src/client/game/gearArt.ts). Vazio = não aparece no corpo. */
  appearance: string;
  /** Arma de duas mãos (arco): não deixa usar escudo junto. */
  twoHanded: boolean;
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
  return { head: null, body: null, hands: null, feet: null, weapon: null, offhand: null, charm: null };
}

/** O que um jogador está vestindo, como os outros veem (parte → id do item). Só as partes ocupadas. */
export type GearLook = Partial<Record<EquipSlot, string>>;

export function gearLookOf(equipped: Record<EquipSlot, string | null>): GearLook {
  const gear: GearLook = {};
  for (const slot of EQUIP_SLOTS) {
    const item = equipped[slot];
    if (item) gear[slot] = item;
  }
  return gear;
}
