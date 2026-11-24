// Receitas (poções, etapa 3; pedido do dono, 23/11: "a porção de vida pode ser uma mistura de alguma planta com frasco
// e água ... e ela dropa e também faz craft"; aprovado com a Dona Iracema preparando). A Pequena leva Arruda, Frasco e
// Água da Mina; a Média, também a Babosa; a Grande, Babosa e a Jurubeba das matas fundas e das lendas. A loja vende só os
// ingredientes; as garrafadas saem da receita e dos bichos.

import { describe, expect, it } from 'vitest';
import { loadItemDefs, parseItemDefs } from '../src/server/items';
import { loadMonsterDefs } from '../src/server/monsters';
import { loadNpcDefs, parseNpcDefs } from '../src/server/npcs';
import { checkRecipes, loadRecipeDefs, parseRecipeDefs } from '../src/server/recipes';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { TICK_MS } from '../src/shared/constants';
import { GameMap } from '../src/shared/map';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

const items = loadItemDefs();
const recipes = loadRecipeDefs();

describe('as receitas (data/receitas.json)', () => {
  it('as três garrafadas: planta, frasco e água; a Dona Iracema (nos dois lugares) prepara', () => {
    expect(Object.fromEntries([...recipes.values()].map((r) => [r.item, Object.fromEntries(r.needs.map((n) => [n.item, n.n]))]))).toEqual({
      garrafada_pequena: { erva_arruda: 1, frasco: 1, agua_mina: 1 },
      garrafada: { erva_arruda: 1, babosa: 1, frasco: 1, agua_mina: 1 },
      garrafada_grande: { babosa: 2, jurubeba: 1, frasco: 1, agua_mina: 1 },
      // a da Cuca, no caldeirão da toca (tests/cuca.test.ts)
      garrafada_cuca: { jurubeba: 2, babosa: 2, frasco: 1, agua_mina: 1 },
    });
    const npcs = loadNpcDefs();
    expect(() => checkRecipes(recipes, items, npcs)).not.toThrow();
    for (const id of ['iracema', 'iracema_guarapiranga']) {
      expect(npcs.get(id)!.recipes).toEqual(['garrafada_pequena', 'garrafada', 'garrafada_grande']);
      expect(npcs.get(id)!.shop!.sells).toEqual(expect.arrayContaining(['erva_arruda', 'frasco', 'agua_mina']));
    }
    expect(npcs.get('budega')!.shop!.sells).toEqual(expect.arrayContaining(['erva_arruda', 'frasco', 'agua_mina']));
  });

  it('os bichos deixam as plantas e as garrafadas (a Jurubeba e a Grande, mais das lendas)', () => {
    const monsters = loadMonsterDefs();
    const drops = (id: string) => monsters.get(id)!.drops.map((d) => d.item);
    expect(drops('sagui')).toContain('garrafada_pequena');
    expect(drops('tatu_bola')).toEqual(expect.arrayContaining(['garrafada_pequena', 'babosa']));
    expect(drops('capelobo')).toEqual(expect.arrayContaining(['garrafada', 'babosa', 'jurubeba']));
    expect(drops('mula_sem_cabeca')).toEqual(expect.arrayContaining(['garrafada_grande', 'jurubeba']));
    // no jogo novo, a Jurubeba só cai do Filhote de Boitatá (os chefes ainda não estão lá): 25% (pedido do dono, 23/11)
    expect(monsters.get('filhote_boitata')!.drops.find((d) => d.item === 'jurubeba')!.chance).toBe(25);
  });

  it('o arquivo é conferido (e explica em português)', () => {
    expect(() => parseRecipeDefs({ x: {} })).toThrow(/"precisa" precisa ser um objeto/);
    expect(() => parseRecipeDefs({ x: { precisa: {} } })).toThrow(/pelo menos um ingrediente/);
    expect(() => parseRecipeDefs({ x: { precisa: { erva_arruda: 0 } } })).toThrow(/de 1 a 20/);
    expect(() => checkRecipes(parseRecipeDefs({ sumiu: { precisa: { frasco: 1 } } }), items, new Map())).toThrow(/"sumiu" não existe/);
    expect(() => checkRecipes(parseRecipeDefs({ frasco: { precisa: { pedra_lua: 1 } } }), items, new Map())).toThrow(/ingrediente "pedra_lua"/);
    const npcs = parseNpcDefs({ dona: { nome: 'Dona', mapa: 'vila', x: 1, y: 1, receitas: ['bolo'] } });
    expect(() => checkRecipes(recipes, items, npcs)).toThrow(/a receita "bolo" não existe/);
  });

  it('o pedido passa pela conferência', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'craft', npc: 3, id: 'garrafada_pequena' }))).toEqual({ t: 'craft', npc: 3, id: 'garrafada_pequena' });
    expect(parseClientMsg(JSON.stringify({ t: 'craft', npc: 3 }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'craft', npc: -1, id: 'garrafada' }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'craft', npc: 3, id: 'Garrafada Média!' }))).toBeNull();
  });
});

// ---------- no mundo ----------

const clock = new FakeClock();

function village() {
  const map = GameMap.fromTiled(tiledFromAscii(['.'.repeat(14), '.'.repeat(14), '.'.repeat(14)], { x: 1, y: 1 }), 'vila');
  const npcs = parseNpcDefs({
    dona: { nome: 'Dona Iracema', titulo: 'quitandeira', mapa: 'vila', x: 3, y: 1, fala: 'Oi!', loja: { vende: ['frasco'] }, receitas: ['garrafada_pequena', 'garrafada'] },
    seu: { nome: 'Seu Zé', mapa: 'vila', x: 12, y: 1, loja: { vende: ['frasco'] } },
  });
  const world = new World(map, { now: clock.now, random: () => 0, items, npcs, recipes });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  player.x = 1;
  player.y = 1;
  const npcOf = (name: string) => [...world.npcs.values()].find((n) => n.def.name === name)!.id;
  const flush = () => {
    clock.advance(TICK_MS);
    world.tick();
  };
  flush();
  return { world, conn, player, dona: npcOf('Dona Iracema'), seu: npcOf('Seu Zé'), flush };
}

const give = (player: Player, list: Record<string, number>) => {
  for (const [item, n] of Object.entries(list)) player.inventory.add(item, n);
};

describe('a Dona Iracema prepara', () => {
  it('as boas-vindas trazem as receitas dela (o que sai e o que vai)', () => {
    const { conn } = village();
    const dona = conn.ofType('welcome')[0]!.npcs.find((n) => n.e.name === 'Dona Iracema')!;
    expect(dona.recipes).toEqual([
      { item: 'garrafada_pequena', n: 1, needs: [{ item: 'erva_arruda', n: 1 }, { item: 'frasco', n: 1 }, { item: 'agua_mina', n: 1 }] },
      { item: 'garrafada', n: 1, needs: [{ item: 'erva_arruda', n: 1 }, { item: 'babosa', n: 1 }, { item: 'frasco', n: 1 }, { item: 'agua_mina', n: 1 }] },
    ]);
    expect(conn.ofType('welcome')[0]!.npcs.find((n) => n.e.name === 'Seu Zé')!.recipes).toBeUndefined();
  });

  it('com tudo na mochila: os ingredientes saem e a garrafada entra', () => {
    const { world, conn, player, dona, flush } = village();
    give(player, { erva_arruda: 2, frasco: 1, agua_mina: 1 });
    world.craft(player, dona, 'garrafada_pequena');
    flush();
    expect(player.inventory.countOf('garrafada_pequena')).toBe(1);
    expect(player.inventory.countOf('erva_arruda')).toBe(1);
    expect(player.inventory.countOf('frasco')).toBe(0);
    expect(player.inventory.countOf('agua_mina')).toBe(0);
    expect(conn.ofType('crafted').at(-1)).toEqual({ t: 'crafted', it: 'garrafada_pequena', n: 1 });
    expect(conn.ofType('sys').at(-1)!.text).toBe('Dona Iracema preparou: Garrafada Pequena.');
  });

  it('faltando ingrediente: diz o que falta e nada muda', () => {
    const { world, conn, player, dona, flush } = village();
    give(player, { erva_arruda: 1, frasco: 1 });
    world.craft(player, dona, 'garrafada');
    flush();
    expect(player.inventory.countOf('garrafada')).toBe(0);
    expect(player.inventory.countOf('erva_arruda')).toBe(1);
    expect(conn.ofType('sys').at(-1)!.text).toBe('Para Garrafada Média, falta: Folha de Babosa, Água da Mina.');
  });

  it('longe dela, receita que ela não sabe, ou quem não prepara nada: não faz', () => {
    const { world, conn, player, dona, seu, flush } = village();
    give(player, { erva_arruda: 2, frasco: 2, agua_mina: 2, babosa: 2, jurubeba: 1 });
    player.x = 10;
    world.craft(player, dona, 'garrafada_pequena');
    flush();
    expect(conn.ofType('fail').at(-1)).toMatchObject({ reason: 'too_far' });
    player.x = 1;
    world.craft(player, dona, 'garrafada_grande'); // essa ela não sabe (neste teste)
    world.craft(player, seu, 'garrafada_pequena');
    flush();
    expect(conn.ofType('fail').slice(-2).map((f) => f.reason)).toEqual(['cant_trade', 'cant_trade']);
    expect(player.inventory.countOf('frasco')).toBe(2);
  });

  it('mochila cheia: não cabe a garrafada, então os ingredientes voltam', () => {
    const { world, conn, player, dona, flush } = village();
    // os ingredientes em pilhas maiores que a receita (tirar um não libera o espaço) e o resto cheio de chapéus
    give(player, { erva_arruda: 5, frasco: 5, agua_mina: 5 });
    while (player.inventory.slots.some((s) => s === null)) player.inventory.add('chapeu_palha', 1);
    world.craft(player, dona, 'garrafada_pequena');
    flush();
    expect(conn.ofType('fail').at(-1)).toMatchObject({ reason: 'bag_full' });
    expect(player.inventory.countOf('garrafada_pequena')).toBe(0);
    expect([player.inventory.countOf('erva_arruda'), player.inventory.countOf('frasco'), player.inventory.countOf('agua_mina')]).toEqual([5, 5, 5]);
  });
});
