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
  /** Consumível: em qual atalho ele entra (1 = comida, 2 = remédio; campo "atalho" de data/items.json). */
  quick?: 1 | 2;
}

/** O que o atalho usa agora: qual item, quantos você tem e em qual espaço da mochila está o primeiro. */
export interface QuickPick {
  item: string;
  count: number;
  slot: number;
}

/**
 * Atalho `n` (1 = comida, 2 = remédio): dos consumíveis desse grupo que estão na mochila, o de maior cura (empate:
 * o que aparece primeiro na mochila). Null se não tem nenhum.
 */
export function pickQuickItem(n: 1 | 2, items: ReadonlyMap<string, ItemInfo>, inv: InventoryState): QuickPick | null {
  let best: { item: string; slot: number; heal: number } | null = null;
  for (let i = 0; i < inv.slots.length; i++) {
    const stack = inv.slots[i];
    if (!stack) continue;
    const def = items.get(stack.item);
    if (!def || def.kind !== 'consumable' || def.quick !== n) continue;
    if (!best || def.heal > best.heal) best = { item: stack.item, slot: i, heal: def.heal };
  }
  if (!best) return null;
  const item = best.item;
  // o mesmo item espalhado em mais de um espaço da mochila: conta tudo
  const count = inv.slots.reduce((total, stack) => total + (stack?.item === item ? stack.n : 0), 0);
  return { item, count, slot: best.slot };
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
