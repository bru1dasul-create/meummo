// As receitas (data/receitas.json): o que um NPC prepara com o que você traz (pedido do dono, 23/11: "a poção de vida
// pode ser uma mistura de alguma planta com frasco e água ... e ela dropa e também faz craft"; aprovado com a Dona
// Iracema preparando). Cada receita tem como chave o item que ela faz; "precisa" diz os ingredientes e quantos de cada.
// Quais NPCs preparam o quê: o campo "receitas" de cada um em data/npcs.json.

import { readFileSync } from 'node:fs';
import type { ItemInfo, ItemStack } from '../shared/items';
import { Reader } from './data-reader';
import type { NpcDef } from './npcs';
import { RECIPES_FILE } from './paths';

const FILE = 'data/receitas.json';

/** Uma receita: o item que sai (e quantos) e o que vai nela. */
export interface RecipeDef {
  item: string;
  n: number;
  needs: ItemStack[];
}

export function parseRecipeDefs(json: unknown): Map<string, RecipeDef> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error(`Erro em ${FILE}: o arquivo precisa ser um objeto { "item-que-sai": { "precisa": { ... } } }.`);
  }
  const defs = new Map<string, RecipeDef>();
  for (const [rawId, raw] of Object.entries(json as Record<string, unknown>)) {
    const item = rawId.trim().toLowerCase();
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`Erro em ${FILE}: "${rawId}" precisa ser um objeto.`);
    const r: Reader = new Reader(raw as Record<string, unknown>, FILE, `receita "${rawId}"`);
    const n = r.number('quantidade', { min: 1, fallback: 1 });
    if (!Number.isInteger(n) || n > 20) r.fail('quantidade', 'precisa ser um número inteiro de 1 a 20 (quantos itens a receita faz)');
    const needsRaw = r.object('precisa')!;
    const needs: ItemStack[] = [];
    for (const [ingredient, count] of Object.entries(needsRaw)) {
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 20) {
        r.fail('precisa', `diz quantos de cada ingrediente (um número inteiro de 1 a 20); "${ingredient}" não está assim`);
      }
      needs.push({ item: ingredient.trim().toLowerCase(), n: count });
    }
    if (needs.length === 0) r.fail('precisa', 'precisa de pelo menos um ingrediente, por exemplo { "erva_arruda": 1, "frasco": 1 }');
    defs.set(item, { item, n, needs });
  }
  return defs;
}

export function loadRecipeDefs(file = RECIPES_FILE): Map<string, RecipeDef> {
  return parseRecipeDefs(JSON.parse(readFileSync(file, 'utf8')));
}

/**
 * Confere as receitas contra os itens e os NPCs: o item que sai e cada ingrediente existem, e cada receita que um NPC
 * prepara existe. Erro em português se algo não bate.
 */
export function checkRecipes(recipes: ReadonlyMap<string, RecipeDef>, items: ReadonlyMap<string, ItemInfo>, npcs: ReadonlyMap<string, NpcDef>): void {
  for (const recipe of recipes.values()) {
    const where = `Erro em ${FILE} (receita "${recipe.item}")`;
    if (!items.has(recipe.item)) throw new Error(`${where}: o item "${recipe.item}" não existe em data/items.json.`);
    for (const need of recipe.needs) {
      if (!items.has(need.item)) throw new Error(`${where}: o ingrediente "${need.item}" não existe em data/items.json.`);
    }
  }
  for (const npc of npcs.values()) {
    for (const id of npc.recipes) {
      if (!recipes.has(id)) throw new Error(`Erro em data/npcs.json (personagem "${npc.id}"): a receita "${id}" não existe em ${FILE}.`);
    }
  }
}
