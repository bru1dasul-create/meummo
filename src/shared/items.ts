// Itens: o que o navegador e o servidor precisam concordar (os números de cada item vêm de
// data/items.json e chegam ao navegador na mensagem de boas-vindas).

import { ATTRIBUTE_IDS, ATTRIBUTE_NAMES, type AttributeId } from './attributes';

/** Partes do corpo onde dá para equipar alguma coisa. */
export type EquipSlot = 'weapon' | 'head' | 'body' | 'charm';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'head', 'body', 'charm'];

export type ItemKind = 'equipment' | 'consumable' | 'material';
export type Rarity = 'common' | 'rare' | 'legendary';

/** O que pode sair voando de uma arma (o desenho e o som de cada um). */
export const SHOT_KINDS = ['pedra', 'flecha'] as const;
export type ShotKind = (typeof SHOT_KINDS)[number];

/**
 * Arma com tiro próprio (campo "tiro" de data/items.json, ex.: o Arco de Bambu): o que sai, o tempo da carga cheia, o
 * alcance sem carga e com a carga cheia (metros, no mapa novo), o tempo entre tiros e a velocidade (metros por
 * segundo). Arma sem "tiro" atira pedra com os números do combate.
 */
export interface WeaponShot {
  projectile: ShotKind;
  chargeMs: number;
  rangeMin: number;
  rangeMax: number;
  cooldownMs: number;
  speed: number;
}

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
  /** Consumível: quanto de vida recupera (fixo; veja também `healPct`). */
  heal: number;
  /** Consumível: quanto da vida máxima recupera, em % (as garrafadas), além do `heal`. */
  healPct?: number;
  /** Consumível: o efeito com tempo (a Banana dá Destreza; a garrafada faz a vida voltar mais rápido). */
  effect?: ItemEffect;
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
  /** Arma com tiro próprio (veja WeaponShot). */
  shot?: WeaponShot;
}

/** O que o atalho usa agora: qual item, quantos você tem e em qual espaço da mochila está o primeiro. */
export interface QuickPick {
  item: string;
  count: number;
  slot: number;
}

/**
 * Um efeito com tempo de um consumível (pedido do dono, 23/11: "a banana ao invés de dar vida dar destreza por
 * determinado tempo"; a Água de Coco, Espírito; a garrafada, a vida subindo mais rápido por 3 minutos).
 */
export interface ItemEffect {
  /** Pontos a mais nos atributos enquanto dura. */
  attrs: Partial<Record<AttributeId, number>>;
  /** A vida que volta sozinha (fora de luta) fica × isto enquanto dura (0 = não mexe nela). */
  regen: number;
  durationMs: number;
}

/** O que um efeito mexe: um atributo ou a vida que volta sozinha ('regen'). Um de cada vale por vez. */
export type EffectKey = AttributeId | 'regen';

/** Um efeito valendo agora, como o servidor manda: o que mexe, de qual item, quanto e quanto tempo falta (ms). */
export interface ActiveEffectInfo {
  k: EffectKey;
  it: string;
  v: number;
  ms: number;
}

/** O efeito em texto, para as janelas: "+5 de Destreza por 3 min", "a vida volta 3× mais rápido fora de luta por 3 min". */
export function effectLabel(effect: ItemEffect): string {
  const parts = ATTRIBUTE_IDS.filter((id) => effect.attrs[id]).map((id) => `+${effect.attrs[id]} de ${ATTRIBUTE_NAMES[id]}`);
  if (effect.regen > 0) parts.push(`a vida volta ${String(effect.regen).replace('.', ',')}× mais rápido fora de luta`);
  const minutes = effect.durationMs / 60_000;
  const time = minutes >= 1 ? `${String(Math.round(minutes * 10) / 10).replace('.', ',')} min` : `${Math.round(effect.durationMs / 1000)} s`;
  return `${parts.join(' e ')} por ${time}`;
}

/** Quanto um consumível cura para quem tem `maxHp` de vida máxima: a cura fixa mais a porcentagem (arredondada). */
export function healAmount(def: Pick<ItemInfo, 'heal' | 'healPct'>, maxHp: number): number {
  return def.heal + Math.round((maxHp * (def.healPct ?? 0)) / 100);
}

/** A cura em texto, para as janelas: "60", "40% da vida" ou "10 + 25% da vida" ('' se não cura). */
export function healLabel(def: Pick<ItemInfo, 'heal' | 'healPct'>): string {
  const pct = def.healPct ?? 0;
  if (pct <= 0) return def.heal > 0 ? String(def.heal) : '';
  return def.heal > 0 ? `${def.heal} + ${pct}% da vida` : `${pct}% da vida`;
}

/** O que um consumível faz, numa frase: "cura 40% da vida e a vida volta 3× mais rápido...", "+5 de Destreza por 3 min". */
export function useLabel(def: Pick<ItemInfo, 'heal' | 'healPct' | 'effect'>): string {
  const heal = healLabel(def);
  const parts = heal ? [`cura ${heal}`] : [];
  if (def.effect) parts.push(effectLabel(def.effect));
  return parts.join(' e ');
}

/**
 * Atalho `n` (1 = comida, 2 = remédio): dos consumíveis desse grupo que estão na mochila, o que mais cura para quem
 * tem `maxHp` de vida máxima (empate: o que aparece primeiro na mochila). Null se não tem nenhum.
 */
export function pickQuickItem(n: 1 | 2, items: ReadonlyMap<string, ItemInfo>, inv: InventoryState, maxHp = 100): QuickPick | null {
  let best: { item: string; slot: number; heal: number } | null = null;
  for (let i = 0; i < inv.slots.length; i++) {
    const stack = inv.slots[i];
    if (!stack) continue;
    const def = items.get(stack.item);
    if (!def || def.kind !== 'consumable' || def.quick !== n) continue;
    const heal = healAmount(def, maxHp);
    if (!best || heal > best.heal) best = { item: stack.item, slot: i, heal };
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
