// A Cuca na toca (pedido do dono, 24/11: "faz a Cuca na toca"; escolha dele: "bruxa e depois chefe"). Etapa 1, a bruxa
// que negocia: mora na Toca da Cuca, na Caverna Sagrada (o ponto `toca-da-cuca` do [mundo], ao lado do caldeirão), vende
// frasco e água, prepara no caldeirão a Garrafada da Cuca (2 jurubebas e 2 babosas) e dá a missão "O Caldeirão da
// Cuca" (2 raízes de jurubeba). A luta (ela se revela) é a etapa 2.

import { describe, expect, it } from 'vitest';
import { loadItemDefs } from '../src/server/items';
import { loadMonsterDefs } from '../src/server/monsters';
import { checkNpcs, loadNpcDefs } from '../src/server/npcs';
import { checkQuests, loadQuestDefs } from '../src/server/quests';
import { checkRecipes, loadRecipeDefs } from '../src/server/recipes';
import { loadMaps } from '../src/server/server';
import { World, type Player } from '../src/server/world';
import { TICK_MS } from '../src/shared/constants';
import { cornerAtFeet } from '../src/shared/movement';
import { FakeClock, FakeConn } from './helpers';

const items = loadItemDefs();
const npcs = loadNpcDefs();
const recipes = loadRecipeDefs();
const quests = loadQuestDefs();
const monsters = loadMonsterDefs();
const maps = loadMaps();

describe('a Cuca (os dados)', () => {
  it('mora na Toca da Cuca, no ponto do [mundo], e vende só frasco e água (paga pouco pelo que você traz)', () => {
    const cuca = npcs.get('cuca')!;
    const cave = maps.find((m) => m.id === 'caverna')!;
    expect(cuca).toMatchObject({ name: 'Cuca', title: 'a bruxa da Toca', map: 'caverna', recipes: ['garrafada_cuca'], shop: { sells: ['frasco', 'agua_mina'], buyPercent: 40 } });
    expect({ x: cuca.x, y: cuca.y }).toEqual(cave.spots.get('toca-da-cuca'));
    expect(() => checkNpcs(npcs, items, maps)).not.toThrow();
    expect(() => checkRecipes(recipes, items, npcs)).not.toThrow();
  });

  it('a Garrafada da Cuca: cura 40% e dá +6 de Força e +6 de Espírito por 3 minutos; leva 2 jurubebas, 2 babosas, frasco e água', () => {
    const def = items.get('garrafada_cuca')!;
    expect(def).toMatchObject({ name: 'Garrafada da Cuca', kind: 'consumable', healPct: 40, rarity: 'rare', price: 150 });
    expect(def.effect).toEqual({ attrs: { forca: 6, espirito: 6 }, regen: 0, durationMs: 180_000 });
    const recipe = recipes.get('garrafada_cuca')!;
    expect(Object.fromEntries(recipe.needs.map((n) => [n.item, n.n]))).toEqual({ jurubeba: 2, babosa: 2, frasco: 1, agua_mina: 1 });
    // só a Cuca faz (a Dona Iracema, não)
    expect([...npcs.values()].filter((n) => n.recipes.includes('garrafada_cuca')).map((n) => n.id)).toEqual(['cuca']);
  });

  it('a missão: 2 raízes de jurubeba, a partir do nível 3; dá 80 de XP e uma Garrafada da Cuca', () => {
    const quest = quests.get('o_caldeirao_da_cuca')!;
    expect(quest).toMatchObject({ giver: 'cuca', minLevel: 3, goal: { kind: 'deliver', item: 'jurubeba', count: 2 }, reward: { xp: 80, gold: 0, items: [{ item: 'garrafada_cuca', n: 1 }] } });
    expect(() => checkQuests(quests, { npcs, monsters, items })).not.toThrow();
  });
});

// ---------- na caverna de verdade ----------

function toca() {
  const clock = new FakeClock();
  const map = maps.find((m) => m.id === 'caverna')!;
  const world = new World(map, { now: clock.now, random: () => 0.5, items, npcs, recipes, quests, monsters });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  const cuca = [...world.npcs.values()].find((n) => n.def.id === 'cuca')!;
  // o pé um passo na frente dela (para o sul, longe do caldeirão)
  const spot = cornerAtFeet(44.4, 12.4);
  player.fx = spot.x;
  player.fy = spot.y;
  const flush = () => {
    clock.advance(TICK_MS);
    world.tick();
  };
  flush();
  return { world, clock, conn, player, cuca, flush };
}

const give = (player: Player, list: Record<string, number>) => {
  for (const [item, n] of Object.entries(list)) player.inventory.add(item, n);
};

describe('na Toca da Cuca', () => {
  it('as boas-vindas trazem a Cuca com a loja e a receita dela', () => {
    const { conn } = toca();
    const info = (conn.ofType('welcome')[0] ?? conn.ofType('zone')[0])!.npcs.find((n) => n.e.type === 'cuca')!;
    expect(info.shop).toEqual({ sells: ['frasco', 'agua_mina'], buyPercent: 40 });
    expect(info.recipes!.map((r) => r.item)).toEqual(['garrafada_cuca']);
  });

  it('o caldeirão: com os ingredientes, sai a garrafada; bebida, cura 40% e dá Força e Espírito', () => {
    const { world, conn, player, cuca, flush } = toca();
    give(player, { jurubeba: 2, babosa: 2, frasco: 1, agua_mina: 1 });
    world.craft(player, cuca.id, 'garrafada_cuca');
    flush();
    expect(player.inventory.countOf('garrafada_cuca')).toBe(1);
    expect(player.inventory.countOf('jurubeba')).toBe(0);
    expect(conn.ofType('sys').at(-1)!.text).toBe('Cuca preparou: Garrafada da Cuca.');

    player.hp = 10;
    const slot = player.inventory.slots.findIndex((s) => s?.item === 'garrafada_cuca');
    world.itemAction(player, 'use', slot);
    flush();
    expect(player.hp).toBe(10 + Math.round(player.maxHp * 0.4));
    expect(player.effects.get('forca')).toMatchObject({ item: 'garrafada_cuca', value: 6 });
    expect(player.effects.get('espirito')).toMatchObject({ item: 'garrafada_cuca', value: 6 });
  });

  it('a missão: aceita no nível 3, entrega 2 jurubebas e ganha a garrafada', () => {
    const { world, player, cuca, flush } = toca();
    world.adminSetLevel(player, 3);
    world.questAction(player, 'accept', 'o_caldeirao_da_cuca', cuca.id);
    expect(player.quests.o_caldeirao_da_cuca).toEqual({ state: 'active', count: 0 });
    give(player, { jurubeba: 2 });
    const xp = player.xp;
    world.questAction(player, 'complete', 'o_caldeirao_da_cuca', cuca.id);
    flush();
    expect(player.quests.o_caldeirao_da_cuca!.state).toBe('done');
    expect(player.inventory.countOf('jurubeba')).toBe(0);
    expect(player.inventory.countOf('garrafada_cuca')).toBe(1);
    expect(player.xp).toBeGreaterThan(xp);
  });
});
