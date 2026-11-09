// Ouro: quanto cada monstro deixa (data/monsters.json), onde ele fica (fora dos espaços da mochila),
// como chega para quem ajudou a derrubar e como fica salvo.

import { beforeEach, describe, expect, it } from 'vitest';
import { CharacterStore, type CharacterData } from '../src/server/accounts';
import { Inventory } from '../src/server/inventory';
import { parseItemDefs } from '../src/server/items';
import { loadMonsterDefs, parseMonsterDefs } from '../src/server/monsters';
import { World, type Player } from '../src/server/world';
import { SHOT_COOLDOWN_MS, TICK_MS } from '../src/shared/constants';
import { DOWN } from '../src/shared/dir';
import { BAG_SIZE, MAX_GOLD } from '../src/shared/items';
import { GameMap } from '../src/shared/map';
import { FAST_HASH, FakeClock, FakeConn, tiledFromAscii } from './helpers';

const items = parseItemDefs({
  fruta: { nome: 'Fruta', tipo: 'consumivel', cura: 10, recargaMs: 1000, pilha: 5 },
  espada: { nome: 'Espada de Pau', tipo: 'equipamento', parte: 'arma', dano: 3 },
});

const BASE = { nivel: 1, vida: 1, xp: 1, passoMs: 1e9, agressivo: false, perseguicao: 30, renascerMs: 60000 };
const ATTACK = { tipo: 'mordida', preparoMs: 500, intervaloMs: 1000, dano: [5, 5] };

describe('ouro em data/monsters.json', () => {
  it('"ouro" é um número ou [mínimo, máximo]; sem o campo, o monstro não deixa ouro', () => {
    const monsters = parseMonsterDefs({
      fixo: { nome: 'Fixo', ...BASE, ataque: ATTACK, ouro: 5 },
      faixa: { nome: 'Faixa', ...BASE, ataque: ATTACK, ouro: [0, 3] },
      pobre: { nome: 'Pobre', ...BASE, ataque: ATTACK },
    });
    expect(monsters.get('fixo')!.gold).toEqual([5, 5]);
    expect(monsters.get('faixa')!.gold).toEqual([0, 3]);
    expect(monsters.get('pobre')!.gold).toEqual([0, 0]);
  });

  it('explica o erro em português', () => {
    const bad = (ouro: unknown) => () => parseMonsterDefs({ bicho: { nome: 'X', ...BASE, ataque: ATTACK, ouro } });
    for (const value of [-1, 2.5, [5, 2], [1], 'muito', [1, 2.5]]) {
      expect(bad(value)).toThrow(/monstro "bicho"\): o campo "ouro" precisa ser um número inteiro/);
    }
  });

  it('todo monstro do jogo deixa algum ouro', () => {
    for (const def of loadMonsterDefs().values()) {
      expect(def.gold[1], def.id).toBeGreaterThan(0);
    }
  });
});

describe('ouro na mochila', () => {
  it('não ocupa espaço e para no máximo', () => {
    const bag = new Inventory(items);
    expect(bag.addGold(7)).toBe(7);
    expect(bag.addGold(0)).toBe(0);
    expect(bag.addGold(-3)).toBe(0);
    expect(bag.gold).toBe(7);
    expect(bag.slots.every((s) => s === null)).toBe(true);
    expect(bag.state().gold).toBe(7);
    bag.gold = MAX_GOLD - 2;
    expect(bag.addGold(10)).toBe(2);
    expect(bag.gold).toBe(MAX_GOLD);
  });

  it('volta do que estava salvo com cuidado (save antigo, lixo, negativo, demais)', () => {
    const load = (saved: unknown) => Inventory.fromSaved(items, saved).inventory.gold;
    expect(load({ slots: [], equipped: {}, gold: 42 })).toBe(42);
    expect(load({ slots: [], equipped: {} })).toBe(0); // save de antes do ouro
    expect(load({ slots: [], equipped: {}, gold: 'muito' })).toBe(0);
    expect(load({ slots: [], equipped: {}, gold: -5 })).toBe(0);
    expect(load({ slots: [], equipped: {}, gold: 12.9 })).toBe(12);
    expect(load({ slots: [], equipped: {}, gold: MAX_GOLD * 3 })).toBe(MAX_GOLD);
    expect(load(null)).toBe(0);
  });
});

// ---------- no mundo ----------

const monsters = parseMonsterDefs({
  rico: { nome: 'Rico', ...BASE, ataque: ATTACK, ouro: [2, 6], itens: [{ item: 'fruta', chance: 100, quantidade: 2 }] },
  pobre: { nome: 'Pobre', ...BASE, ataque: ATTACK, itens: [{ item: 'fruta', chance: 100 }] },
  so_ouro: { nome: 'Só Ouro', ...BASE, ataque: ATTACK, ouro: 3 },
});

let clock: FakeClock;
beforeEach(() => {
  clock = new FakeClock();
});

function arena(monster: string, saver?: { save(list: { id: number; data: CharacterData }[]): void }): World {
  const map = GameMap.fromTiled(tiledFromAscii(['.'.repeat(12), '.'.repeat(12), '.'.repeat(12)], { x: 1, y: 1 }, [{ monster, x: 4, y: 1, w: 1, h: 1 }]));
  // random sempre 0: o ouro sorteado é o mínimo da faixa
  return new World(map, { now: clock.now, random: () => 0, monsters, items, saver });
}

function join(world: World, name = 'Ana'): { player: Player; conn: FakeConn } {
  const conn = new FakeConn();
  const result = world.join(name, conn);
  if (!result.ok) throw new Error(result.reason);
  return { player: result.player, conn };
}

function run(world: World, ms: number): void {
  for (let t = 0; t < ms; t += TICK_MS) {
    clock.advance(TICK_MS);
    world.tick();
  }
}

/** Atira para a direita (no monstro em (4, 1)) e espera a pedrinha chegar. */
function shootRight(world: World, player: Player): void {
  world.shoot(player, Math.floor(clock.now()), 0);
  run(world, SHOT_COOLDOWN_MS + TICK_MS);
}

describe('ouro no mundo', () => {
  it('cada um que ajudou a derrubar o monstro ganha o seu ouro, junto com os itens', () => {
    const world = arena('rico');
    const ana = join(world, 'Ana');
    const beto = join(world, 'Beto');
    world.tick();
    [...world.monsters.values()][0]!.contributors.add(beto.player.id); // Beto também bateu
    shootRight(world, ana.player);
    for (const { player, conn } of [ana, beto]) {
      expect(player.inventory.gold).toBe(2);
      expect(conn.ofType('loot')[0]).toEqual({ t: 'loot', x: 4, y: 1, items: [{ item: 'fruta', n: 2 }], gold: 2 });
      expect(conn.ofType('inv').at(-1)?.inv.gold).toBe(2);
      expect(conn.ofType('sys').some((m) => m.text === 'Você pegou: 2 de ouro, Fruta ×2.')).toBe(true);
    }
  });

  it('monstro sem ouro: a mensagem não fala de ouro', () => {
    const world = arena('pobre');
    const ana = join(world);
    world.tick();
    shootRight(world, ana.player);
    expect(ana.player.inventory.gold).toBe(0);
    expect(ana.conn.ofType('loot')[0]).toEqual({ t: 'loot', x: 4, y: 1, items: [{ item: 'fruta', n: 1 }] });
    expect(ana.conn.ofType('sys').some((m) => m.text === 'Você pegou: Fruta.')).toBe(true);
  });

  it('monstro que só deixa ouro também avisa', () => {
    const world = arena('so_ouro');
    const ana = join(world);
    world.tick();
    shootRight(world, ana.player);
    expect(ana.conn.ofType('loot')[0]).toEqual({ t: 'loot', x: 4, y: 1, items: [], gold: 3 });
    expect(ana.conn.ofType('sys').some((m) => m.text === 'Você pegou: 3 de ouro.')).toBe(true);
  });

  it('mochila cheia: o item fica para trás, mas o ouro entra', () => {
    const world = arena('rico');
    const ana = join(world);
    for (let i = 0; i < BAG_SIZE; i++) ana.player.inventory.add('espada', 1);
    world.tick();
    shootRight(world, ana.player);
    expect(ana.player.inventory.gold).toBe(2);
    expect(ana.conn.ofType('loot')[0]).toMatchObject({ items: [], gold: 2 });
    expect(ana.conn.ofType('sys').some((m) => m.text === 'Mochila cheia! Ficou para trás: Fruta ×2.')).toBe(true);
  });

  it('o ouro chega nas boas-vindas e é salvo com o personagem', () => {
    const saves: { id: number; data: CharacterData }[] = [];
    const world = arena('rico', { save: (list) => saves.push(...list) });
    const character = { id: 3, name: 'Ana', level: 1, xp: 0, hp: null, zone: null, x: null, y: null, dir: DOWN, look: 1, inventory: null };
    const first = world.join('Ana', new FakeConn(), { character, created: false });
    if (!first.ok) throw new Error(first.reason);
    first.player.inventory.addGold(150);
    world.leave(first.player);
    const saved = saves.at(-1)!.data;
    expect(saved.inventory?.gold).toBe(150);

    const conn = new FakeConn();
    const back = world.join('Ana', conn, { character: { ...character, inventory: saved.inventory }, created: false });
    if (!back.ok) throw new Error(back.reason);
    expect(back.player.inventory.gold).toBe(150);
    expect(conn.ofType('welcome')[0]!.inv.gold).toBe(150);
  });

  it('o arquivo de personagens guarda o ouro (e personagem de antes do ouro entra com 0)', async () => {
    const store = new CharacterStore(':memory:', { cost: FAST_HASH });
    try {
      const login = await store.login('Ana', 'segredo1');
      const id = login.ok ? login.id : -1;
      expect(store.load(id)?.inventory).toBeNull(); // personagem novo: mochila vazia, sem ouro
      expect(Inventory.fromSaved(items, store.load(id)?.inventory ?? null).inventory.gold).toBe(0);
      store.save([{ id, data: { ...store.load(id)!, inventory: { slots: [], equipped: {}, gold: 77 } } }]);
      expect(store.load(id)?.inventory?.gold).toBe(77);
    } finally {
      store.close();
    }
  });
});
