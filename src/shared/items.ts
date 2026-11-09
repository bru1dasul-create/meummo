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
  /** Preço na loja, em ouro (0 = não se compra nem se vende). Quem vende para a loja recebe uma parte disso. */
  price: number;
}

/** Quanto a loja paga por um item: `percent`% do preço, arredondado para baixo (mas pelo menos 1 se o item vale algo). */
export function sellPrice(def: ItemInfo, percent: number): number {
  if (def.price <= 0 || percent <= 0) return 0;
  return Math.max(1, Math.floor((def.price * percent) / 100));
}

/** Quantos espaços a mochila tem. */
export const BAG_SIZE = 20;

/** Ouro máximo que um personagem carrega (o que passar disso não entra). */
export const MAX_GOLD = 1_000_000;

export interface ItemStack {
  item: string;
  n: number;
}

/** A mochila e o que está equipado (o servidor manda isto inteiro quando muda). */
export interface InventoryState {
  slots: (ItemStack | null)[];
  equipped: Record<EquipSlot, string | null>;
  /** Ouro (fica fora dos espaços da mochila: não ocupa lugar). */
  gold: number;
}

/** O que aparece no personagem: o desenho (ícone) do que está equipado em cada parte. */
export type GearLook = Partial<Record<EquipSlot, string>>;

export function emptyEquipment(): Record<EquipSlot, string | null> {
  return { weapon: null, head: null, body: null, charm: null };
}

/** O desenho de cada parte equipada (o ícone do item), para aparecer no personagem e no boneco da mochila. */
export function gearLookOf(equipped: Record<EquipSlot, string | null>, defs: ReadonlyMap<string, ItemInfo>): GearLook {
  const gear: GearLook = {};
  for (const slot of EQUIP_SLOTS) {
    const id = equipped[slot];
    const def = id ? defs.get(id) : undefined;
    if (def) gear[slot] = def.icon;
  }
  return gear;
}
