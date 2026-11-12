// Loja: preço dos itens (data/items.json), vendedores (data/npcs.json), comprar e vender no mundo.

import { beforeEach, describe, expect, it } from 'vitest';
import { loadItemDefs, parseItemDefs } from '../src/server/items';
import { checkNpcs, loadNpcDefs, parseNpcDefs } from '../src/server/npcs';
import { loadMaps } from '../src/server/server';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { TRADE_RANGE } from '../src/shared/constants';
import { BAG_SIZE, MAX_GOLD, sellPrice } from '../src/shared/items';
import { GameMap } from '../src/shared/map';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

const items = parseItemDefs({
  fruta: { nome: 'Fruta', preco: 5, tipo: 'consumivel', cura: 10, pilha: 5 },
  chapeu: { nome: 'Chapéu', preco: 40, tipo: 'equipamento', parte: 'cabeca', vida: 10 },
  pena: { nome: 'Pena', preco: 1, tipo: 'material' },
  pedra: { nome: 'Pedra', tipo: 'material' }, // sem preço: não se compra nem se vende
});

const VENDEDORA = {
  nome: 'Dona Teste',
  titulo: 'quitandeira',
  mapa: 'vila',
  x: 3,
  y: 1,
  fala: 'Olá, freguês!',
  veste: ['chapeu'],
  loja: { vende: ['fruta', 'chapeu'], compraPor: 50 },
};

describe('preço dos itens', () => {
  it('"preco" é um número inteiro; sem ele, o item não se compra nem se vende', () => {
    expect(items.get('fruta')!.price).toBe(5);
    expect(items.get('pedra')!.price).toBe(0);
    expect(() => parseItemDefs({ x: { nome: 'X', tipo: 'material', preco: 2.5 } })).toThrow(/"preco" precisa ser um número inteiro/);
    expect(() => parseItemDefs({ x: { nome: 'X', tipo: 'material', preco: -1 } })).toThrow(/"preco" precisa ser pelo menos 0/);
  });

  it('a loja paga uma parte do preço (arredonda para baixo, mas pelo menos 1)', () => {
    expect(sellPrice(items.get('chapeu')!, 50)).toBe(20);
    expect(sellPrice(items.get('fruta')!, 50)).toBe(2);
    expect(sellPrice(items.get('pena')!, 50)).toBe(1);
    expect(sellPrice(items.get('pedra')!, 50)).toBe(0);
    expect(sellPrice(items.get('chapeu')!, 0)).toBe(0);
  });
});

describe('data/npcs.json', () => {
  it('o arquivo de verdade é válido (mapas e itens existem; tudo que se vende tem preço)', () => {
    const npcs = loadNpcDefs();
    expect(npcs.get('iracema')).toMatchObject({ name: 'Dona Iracema', map: 'refugio', shop: { buyPercent: 50 } });
    expect(() => checkNpcs(npcs, loadItemDefs(), loadMaps())).not.toThrow();
  });

  it('traduz o português e completa o que faltou', () => {
    const npcs = parseNpcDefs({ teste: VENDEDORA, mudo: { nome: 'Seu Mudo', mapa: 'vila', x: 0, y: 0 } });
    expect(npcs.get('teste')).toEqual({
      id: 'teste',
      name: 'Dona Teste',
      title: 'quitandeira',
      map: 'vila',
      x: 3,
      y: 1,
      line: 'Olá, freguês!',
      wears: ['chapeu'],
      shop: { sells: ['fruta', 'chapeu'], buyPercent: 50 },
    });
    expect(npcs.get('mudo')).toMatchObject({ title: '', line: '', wears: [], shop: null });
  });

  it('explica o erro em português', () => {
    const bad = (npc: Record<string, unknown>) => () => parseNpcDefs({ teste: { ...VENDEDORA, ...npc } });
    expect(bad({ x: -1 })).toThrow(/"x"/);
    expect(bad({ mapa: undefined })).toThrow(/"mapa" precisa ser um texto/);
    expect(bad({ loja: { vende: ['fruta'], compraPor: 150 } })).toThrow(/"compraPor" é em %, de 0 a 100/);
    expect(bad({ loja: { vende: 'fruta' } })).toThrow(/"vende" precisa ser uma lista/);
    expect(bad({ veste: [3] })).toThrow(/"veste" precisa ser uma lista de ids de itens/);
    expect(() => parseNpcDefs({ 'Dona Ana': VENDEDORA })).toThrow(/só pode ter letras sem acento/);

    const maps = [GameMap.fromTiled(tiledFromAscii(['....']), 'vila')];
    const check = (npc: Record<string, unknown>) => () => checkNpcs(parseNpcDefs({ teste: { ...VENDEDORA, ...npc } }), items, maps);
    expect(check({})).not.toThrow();
    expect(check({ mapa: 'cidade' })).toThrow(/o mapa "cidade" não existe. Use um destes: vila/);
    // posição com fração só nos mapas do formato novo (onde é o ponto exato do pé, em metros)
    expect(check({ x: 2.5 })).toThrow(/precisam ser números inteiros/);
    expect(check({ loja: { vende: ['frutaa'] } })).toThrow(/a loja vende "frutaa", que não existe em data\/items.json/);
    expect(check({ loja: { vende: ['pedra'] } })).toThrow(/a loja vende "pedra", mas esse item não tem "preco"/);
    expect(check({ veste: ['fruta'] })).toThrow(/só dá para vestir equipamento/);
  });
});

// ---------- no mundo ----------

let clock: FakeClock;
beforeEach(() => {
  clock = new FakeClock();
});

/** Uma vila 12x3 toda livre, com a vendedora em (3, 1) (ou onde `npc` mandar). */
function village(npc: Record<string, unknown> = {}, rows = ['.'.repeat(12), '.'.repeat(12), '.'.repeat(12)]): { world: World; logs: string[] } {
  const logs: string[] = [];
  const map = GameMap.fromTiled(tiledFromAscii(rows, { x: 1, y: 1 }), 'vila');
  const npcs = parseNpcDefs({ teste: { ...VENDEDORA, ...npc } });
  const world = new World(map, { now: clock.now, random: () => 0, items, npcs, log: (m) => logs.push(m) });
  return { world, logs };
}

function join(world: World, name = 'Ana'): { player: Player; conn: FakeConn } {
  const conn = new FakeConn();
  const result = world.join(name, conn);
  if (!result.ok) throw new Error(result.reason);
  // perto da vendedora (em (3, 1)), a não ser que o teste mude
  result.player.x = 1;
  result.player.y = 1;
  return { player: result.player, conn };
}

function npcId(world: World): number {
  return [...world.npcs.keys()][0]!;
}

/** Roda um tick para o servidor mandar a mochila atualizada. */
function flush(world: World): void {
  clock.advance(50);
  world.tick();
}

describe('vendedora no mapa', () => {
  it('fica no lugar dela, vestida, e chega nas boas-vindas', () => {
    const { world } = village();
    const { conn } = join(world);
    const npcs = conn.ofType('welcome')[0]!.npcs;
    expect(npcs).toHaveLength(1);
    expect(npcs[0]).toEqual({
      e: expect.objectContaining({ kind: 'npc', type: 'teste', name: 'Dona Teste', x: 3, y: 1, gear: { head: 'chapeu' } }),
      title: 'quitandeira',
      line: 'Olá, freguês!',
      shop: { sells: ['fruta', 'chapeu'], buyPercent: 50 },
    });
  });

  it('só aparece no mapa dela', () => {
    const { world } = village({ mapa: 'outro' });
    expect(world.npcs.size).toBe(0);
  });

  it('lugar bloqueado (o mapa mudou): fica no chão livre mais perto, com aviso', () => {
    const { world, logs } = village({ x: 5, y: 1 }, ['.'.repeat(12), '.....#......', '.'.repeat(12)]);
    const npc = world.npcs.get(npcId(world))!;
    expect(world.map.isWalkable(npc.x, npc.y)).toBe(true);
    expect(Math.max(Math.abs(npc.x - 5), Math.abs(npc.y - 1))).toBe(1);
    expect(logs.some((m) => m.includes('Dona Teste') && m.includes('bloqueado'))).toBe(true);
  });

  it('quem chega de outro mapa recebe os NPCs do mapa novo', () => {
    const { world: vila } = village();
    const { world: mata } = village({ mapa: 'outro' });
    const { player, conn } = join(mata);
    mata.detach(player);
    vila.adopt(player, { x: 1, y: 1 });
    expect(conn.ofType('zone')[0]!.npcs.map((n) => n.e.name)).toEqual(['Dona Teste']);
  });
});

describe('comprar', () => {
  it('paga o preço e o item vai para a mochila', () => {
    const { world } = village();
    const { player, conn } = join(world);
    player.inventory.gold = 100;
    world.buy(player, npcId(world), 'fruta', 3);
    flush(world);
    expect(player.inventory.gold).toBe(85);
    expect(player.inventory.slots[0]).toEqual({ item: 'fruta', n: 3 });
    expect(conn.ofType('inv').at(-1)?.inv.gold).toBe(85);
    expect(conn.ofType('sys').some((m) => m.text === 'Você comprou: Fruta ×3, por 15 de ouro.')).toBe(true);
  });

  it('sem ouro suficiente, não compra', () => {
    const { world } = village();
    const { player, conn } = join(world);
    player.inventory.gold = 39;
    world.buy(player, npcId(world), 'chapeu', 1);
    flush(world);
    expect(player.inventory.gold).toBe(39);
    expect(player.inventory.slots.every((s) => s === null)).toBe(true);
    expect(conn.ofType('fail').at(-1)).toEqual({ t: 'fail', reason: 'no_gold', item: true });
  });

  it('item que ela não vende (ou que não existe) é recusado', () => {
    const { world } = village();
    const { player, conn } = join(world);
    player.inventory.gold = 100;
    world.buy(player, npcId(world), 'pena', 1); // tem preço, mas não está na lista dela
    world.buy(player, npcId(world), 'nada', 1);
    flush(world);
    expect(player.inventory.gold).toBe(100);
    expect(conn.ofType('fail').map((f) => f.reason)).toEqual(['cant_trade', 'cant_trade']);
  });

  it('mochila sem espaço para tudo: não compra nada (nem cobra)', () => {
    const { world } = village();
    const { player, conn } = join(world);
    player.inventory.gold = 1000;
    for (let i = 0; i < BAG_SIZE - 1; i++) player.inventory.add('pena', 20);
    player.inventory.add('fruta', 3); // último espaço: cabem mais 2 frutas
    world.buy(player, npcId(world), 'fruta', 3);
    flush(world);
    expect(conn.ofType('fail').at(-1)?.reason).toBe('bag_full');
    expect(player.inventory.gold).toBe(1000);
    world.buy(player, npcId(world), 'fruta', 2);
    expect(player.inventory.gold).toBe(990);
    expect(player.inventory.slots[BAG_SIZE - 1]).toEqual({ item: 'fruta', n: 5 });
  });

  it(`longe da vendedora (mais de ${TRADE_RANGE} tiles), não negocia`, () => {
    const { world } = village();
    const { player, conn } = join(world);
    player.inventory.gold = 100;
    player.x = 3 + TRADE_RANGE + 1;
    world.buy(player, npcId(world), 'fruta', 1);
    flush(world);
    expect(conn.ofType('fail').at(-1)?.reason).toBe('too_far');
    player.x = 3 + TRADE_RANGE;
    world.buy(player, npcId(world), 'fruta', 1);
    expect(player.inventory.gold).toBe(95);
  });

  it('desmaiado não negocia; vendedor que não existe (ou de outro mapa) é ignorado', () => {
    const { world } = village();
    const { player, conn } = join(world);
    player.inventory.gold = 100;
    player.deadUntil = clock.now() + 5000;
    world.buy(player, npcId(world), 'fruta', 1);
    flush(world);
    expect(conn.ofType('fail').at(-1)?.reason).toBe('dead');
    player.deadUntil = 0;
    conn.clear();
    world.buy(player, 9999, 'fruta', 1);
    world.sell(player, 9999, 0, 1);
    flush(world);
    expect(conn.ofType('fail')).toHaveLength(0);
    expect(player.inventory.gold).toBe(100);
  });
});

describe('vender', () => {
  it('ela paga metade do preço; vender mais do que tem vende a pilha', () => {
    const { world } = village();
    const { player, conn } = join(world);
    player.inventory.add('chapeu', 1);
    player.inventory.add('fruta', 4);
    world.sell(player, npcId(world), 0, 1);
    expect(player.inventory.gold).toBe(20);
    expect(player.inventory.slots[0]).toBeNull();
    world.sell(player, npcId(world), 1, 99);
    flush(world);
    expect(player.inventory.gold).toBe(28); // 4 frutas × 2
    expect(player.inventory.slots[1]).toBeNull();
    expect(conn.ofType('inv').at(-1)?.inv.gold).toBe(28);
    expect(conn.ofType('sys').map((m) => m.text)).toEqual(
      expect.arrayContaining(['Você vendeu: Chapéu, por 20 de ouro.', 'Você vendeu: Fruta ×4, por 8 de ouro.']),
    );
  });

  it('vende só uma parte da pilha, se pedir', () => {
    const { world } = village();
    const { player } = join(world);
    player.inventory.add('fruta', 5);
    world.sell(player, npcId(world), 0, 2);
    expect(player.inventory.slots[0]).toEqual({ item: 'fruta', n: 3 });
    expect(player.inventory.gold).toBe(4);
  });

  it('item sem preço ela não compra; espaço vazio é ignorado', () => {
    const { world } = village();
    const { player, conn } = join(world);
    player.inventory.add('pedra', 3);
    world.sell(player, npcId(world), 0, 3);
    flush(world);
    expect(player.inventory.slots[0]).toEqual({ item: 'pedra', n: 3 });
    expect(conn.ofType('fail').at(-1)?.reason).toBe('cant_trade');
    conn.clear();
    world.sell(player, npcId(world), 5, 1);
    flush(world);
    expect(conn.ofType('fail')).toHaveLength(0);
  });

  it('perto do limite de ouro: vende só o que cabe (ninguém perde item sem receber)', () => {
    const { world } = village();
    const { player } = join(world);
    player.inventory.add('fruta', 5);
    player.inventory.gold = MAX_GOLD - 5; // cabem mais 2 frutas (2 de ouro cada)
    world.sell(player, npcId(world), 0, 5);
    expect(player.inventory.slots[0]).toEqual({ item: 'fruta', n: 3 });
    expect(player.inventory.gold).toBe(MAX_GOLD - 1);
  });
});

describe('mensagens da loja', () => {
  it('são conferidas antes de chegar no mundo', () => {
    const ok = [
      { t: 'buy', npc: 7, item: 'banana', n: 1 },
      { t: 'sell', npc: 7, i: 0, n: 20 },
    ];
    for (const msg of ok) expect(parseClientMsg(JSON.stringify(msg))).toEqual(msg);
    const bad = [
      { t: 'buy', npc: 7, item: 'banana', n: 0 },
      { t: 'buy', npc: 7, item: 'banana', n: 1000 },
      { t: 'buy', npc: 7, item: 'Banana Grande', n: 1 },
      { t: 'buy', npc: 0, item: 'banana', n: 1 },
      { t: 'buy', npc: 7, item: 3, n: 1 },
      { t: 'sell', npc: 7, i: BAG_SIZE, n: 1 },
      { t: 'sell', npc: 7, i: 0, n: 1.5 },
      { t: 'sell', npc: -1, i: 0, n: 1 },
    ];
    for (const msg of bad) expect(parseClientMsg(JSON.stringify(msg)), JSON.stringify(msg)).toBeNull();
  });
});
