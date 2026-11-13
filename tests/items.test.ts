// Itens: leitura de data/items.json, mochila, o que cai dos monstros, equipar, usar e salvar.

import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { CharacterStore, hashPassword, MIGRATIONS, type CharacterData, type CharacterSaver } from '../src/server/accounts';
import { Inventory } from '../src/server/inventory';
import { loadItemDefs, parseItemDefs } from '../src/server/items';
import { checkDrops, loadMonsterDefs, parseMonsterDefs } from '../src/server/monsters';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { SHOT_COOLDOWN_MS, TICK_MS } from '../src/shared/constants';
import { DOWN } from '../src/shared/dir';
import { BAG_SIZE, emptyEquipment, gearLookOf, pickQuickItem, type InventoryState } from '../src/shared/items';
import { GameMap } from '../src/shared/map';
import { damageRange, maxHpFor } from '../src/shared/progression';
import { FAST_HASH, FakeClock, FakeConn, tiledFromAscii } from './helpers';

const items = parseItemDefs({
  fruta: { nome: 'Fruta', tipo: 'consumivel', cura: 10, recargaMs: 1000, pilha: 5 },
  capacete: { nome: 'Capacete', tipo: 'equipamento', parte: 'cabeça', vida: 10, defesa: 2 },
  coroa: { nome: 'Coroa', tipo: 'equipamento', parte: 'cabeca', dano: 1, raridade: 'lendário' },
  espada: { nome: 'Espada de Pau', tipo: 'equipamento', parte: 'arma', dano: 3, raridade: 'raro' },
  pena: { nome: 'Pena', tipo: 'material' },
});

describe('data/items.json', () => {
  it('o arquivo de verdade é válido e todo item que os monstros deixam existe', () => {
    const real = loadItemDefs();
    expect(real.size).toBeGreaterThan(3);
    expect(() => checkDrops(loadMonsterDefs(), real)).not.toThrow();
  });

  it('traduz o português e completa o que faltou', () => {
    expect(items.get('capacete')).toMatchObject({ kind: 'equipment', slot: 'head', bonus: { damage: 0, hp: 10, defense: 2 }, stack: 1, rarity: 'common', icon: 'capacete' });
    expect(items.get('coroa')).toMatchObject({ slot: 'head', rarity: 'legendary' });
    expect(items.get('fruta')).toMatchObject({ kind: 'consumable', heal: 10, cooldownMs: 1000, stack: 5, slot: null });
    expect(items.get('pena')).toMatchObject({ kind: 'material', stack: 20, heal: 0 });
  });

  it('explica o erro em português', () => {
    const bad = (item: Record<string, unknown>) => () => parseItemDefs({ teste: item });
    expect(bad({ nome: 'X', tipo: 'arma' })).toThrow(/"tipo" não pode ser "arma". Use: equipamento, consumivel, material/);
    expect(bad({ nome: 'X', tipo: 'equipamento' })).toThrow(/"parte"/);
    expect(bad({ nome: 'X', tipo: 'equipamento', parte: 'pé' })).toThrow(/Use: arma, cabeca, corpo, amuleto/);
    expect(bad({ nome: 'X', tipo: 'material', parte: 'arma' })).toThrow(/só vale para equipamentos/);
    expect(bad({ nome: 'X', tipo: 'consumivel' })).toThrow(/"cura"/);
    expect(bad({ nome: 'X', tipo: 'equipamento', parte: 'arma', dano: 1.5 })).toThrow(/número inteiro/);
    expect(() => parseItemDefs({ 'Chapéu Grande': { nome: 'X', tipo: 'material' } })).toThrow(/só pode ter letras sem acento/);
  });

  it('os monstros dizem o que deixam, com chance em %', () => {
    const base = { nome: 'X', nivel: 1, vida: 10, xp: 1, passoMs: 100, ataque: { tipo: 'mordida', preparoMs: 1, intervaloMs: 100, dano: [1, 1] } };
    const monsters = parseMonsterDefs({ bicho: { ...base, itens: [{ item: 'fruta', chance: 50, quantidade: [1, 3] }, { item: 'pena', chance: 5 }] } });
    expect(monsters.get('bicho')!.drops).toEqual([
      { item: 'fruta', chance: 50, min: 1, max: 3 },
      { item: 'pena', chance: 5, min: 1, max: 1 },
    ]);
    expect(() => parseMonsterDefs({ bicho: { ...base, itens: [{ item: 'fruta', chance: 150 }] } })).toThrow(/em %, de 0 a 100/);
    expect(() => parseMonsterDefs({ bicho: { ...base, itens: [{ item: 'fruta', chance: 10, quantidade: [3, 1] }] } })).toThrow(/quantidade/);
    const typo = parseMonsterDefs({ bicho: { ...base, itens: [{ item: 'frutaa', chance: 10 }] } });
    expect(() => checkDrops(typo, items)).toThrow(/o item "frutaa" não existe em data\/items.json/);
  });
});

describe('mochila', () => {
  it('junta itens iguais em pilhas e avisa quando não cabe mais', () => {
    const bag = new Inventory(items);
    expect(bag.add('fruta', 7)).toBe(7);
    expect(bag.slots.slice(0, 2)).toEqual([{ item: 'fruta', n: 5 }, { item: 'fruta', n: 2 }]);
    expect(bag.add('fruta', 2)).toBe(2);
    expect(bag.slots[1]).toEqual({ item: 'fruta', n: 4 });
    expect(bag.add('nao-existe', 1)).toBe(0);
    for (let i = 0; i < BAG_SIZE; i++) bag.add('espada', 1);
    expect(bag.slots.filter(Boolean)).toHaveLength(BAG_SIZE);
    expect(bag.add('fruta', 3)).toBe(1); // ainda cabia 1 na pilha que não estava cheia
    expect(bag.add('capacete', 1)).toBe(0);
  });

  it('equipar troca com o que estava equipado; tirar devolve para a mochila', () => {
    const bag = new Inventory(items);
    bag.add('capacete', 1);
    bag.add('coroa', 1);
    expect(bag.equip(0)).toBe(true);
    expect(bag.equipped.head).toBe('capacete');
    expect(bag.slots[0]).toBeNull();
    expect(bag.equip(1)).toBe(true); // coroa no lugar do capacete, que volta para o espaço da coroa
    expect(bag.equipped.head).toBe('coroa');
    expect(bag.slots[1]).toEqual({ item: 'capacete', n: 1 });
    expect(bag.bonus()).toEqual({ damage: 1, hp: 0, defense: 0 });
    expect(bag.unequip('head')).toBe(true);
    expect(bag.slots[0]).toEqual({ item: 'coroa', n: 1 });
    expect(bag.unequip('head')).toBe(false);
    bag.add('fruta', 1);
    expect(bag.equip(2)).toBe(false); // fruta não se equipa
  });

  it('o desenho do que está equipado é o ícone de cada item (item que não existe é ignorado)', () => {
    expect(gearLookOf({ weapon: 'espada', head: 'sumiu', body: null, charm: null }, items)).toEqual({ weapon: 'espada' });
    const bag = new Inventory(items);
    bag.add('coroa', 1);
    bag.equip(0);
    expect(bag.look()).toEqual({ head: 'coroa' });
  });

  it('carrega o que estava salvo com cuidado (itens que sumiram do jogo, pilhas grandes, lixo)', () => {
    const { inventory, dropped } = Inventory.fromSaved(items, {
      slots: [{ item: 'fruta', n: 99 }, { item: 'sumiu', n: 1 }, 'lixo', { item: 'pena', n: -3 }],
      equipped: { head: 'espada', weapon: 'espada', body: 'velho' },
    });
    expect(inventory.slots[0]).toEqual({ item: 'fruta', n: 5 });
    expect(inventory.slots[1]).toEqual({ item: 'espada', n: 1 }); // estava na cabeça: volta para a mochila
    expect(inventory.equipped).toEqual({ weapon: 'espada', head: null, body: null, charm: null });
    expect(dropped).toEqual(['sumiu', 'velho']);
    expect(Inventory.fromSaved(items, 'qualquer coisa').inventory.slots.every((s) => s === null)).toBe(true);
  });
});

// ---------- no mundo ----------

const DUMMY = { nivel: 1, vida: 1, xp: 1, passoMs: 1e9, agressivo: false, perseguicao: 30, renascerMs: 60000 };
const monsters = parseMonsterDefs({
  boneco: {
    nome: 'Boneco',
    ...DUMMY,
    ataque: { tipo: 'mordida', preparoMs: 500, intervaloMs: 1000, dano: [5, 5] },
    itens: [
      { item: 'fruta', chance: 50, quantidade: [2, 3] },
      { item: 'coroa', chance: 1 },
    ],
  },
  cobra: {
    nome: 'Cobra',
    ...DUMMY,
    vida: 1000,
    agressivo: true,
    alcanceAgressao: 5,
    ataque: { tipo: 'mordida', preparoMs: 200, intervaloMs: 400, dano: [5, 5] },
  },
});

let clock: FakeClock;
beforeEach(() => {
  clock = new FakeClock();
});

function arena(monster: 'boneco' | 'cobra' = 'boneco', saver?: CharacterSaver): World {
  const map = GameMap.fromTiled(tiledFromAscii(['.'.repeat(12), '.'.repeat(12), '.'.repeat(12)], { x: 1, y: 1 }, [{ monster, x: 4, y: 1, w: 1, h: 1 }]));
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

describe('itens no mundo', () => {
  it('quem ajudou a derrubar o monstro ganha os itens dele (cada um os seus)', () => {
    const world = arena();
    const ana = join(world, 'Ana');
    const beto = join(world, 'Beto');
    world.tick();
    [...world.monsters.values()][0]!.contributors.add(beto.player.id); // Beto também bateu
    shootRight(world, ana.player);
    for (const { player, conn } of [ana, beto]) {
      expect(player.inventory.slots[0]).toEqual({ item: 'fruta', n: 2 });
      expect(player.inventory.slots[1]).toEqual({ item: 'coroa', n: 1 });
      expect(conn.ofType('loot')[0]).toMatchObject({ x: 4, y: 1, items: [{ item: 'fruta', n: 2 }, { item: 'coroa', n: 1 }] });
      expect(conn.ofType('inv').at(-1)?.inv.slots[0]).toEqual({ item: 'fruta', n: 2 });
      expect(conn.ofType('sys').some((m) => m.text === 'Você pegou: Fruta ×2, Coroa.')).toBe(true);
    }
    // item lendário: todo mundo fica sabendo
    expect(beto.conn.ofType('sys').some((m) => m.text === 'Ana conseguiu: Coroa!')).toBe(true);
  });

  it('mochila cheia: o item fica no chão, com aviso', () => {
    const world = arena();
    const ana = join(world);
    for (let i = 0; i < BAG_SIZE; i++) ana.player.inventory.add('espada', 1);
    world.tick();
    shootRight(world, ana.player);
    expect(ana.conn.ofType('loot')).toHaveLength(0);
    expect(ana.conn.ofType('sys').some((m) => m.text === 'Mochila cheia! Ficou no chão: Fruta ×2, Coroa. Abra espaço e passe lá para pegar.')).toBe(true);
    expect(ana.conn.ofType('drop').map((d) => d.item)).toEqual([{ item: 'fruta', n: 2 }, { item: 'coroa', n: 1 }]);
  });

  it('equipar muda vida máxima e dano; tirar volta ao normal', () => {
    const world = arena();
    const ana = join(world);
    ana.player.inventory.add('capacete', 1);
    ana.player.inventory.add('espada', 1);
    world.itemAction(ana.player, 'equip', 0);
    world.itemAction(ana.player, 'equip', 1);
    expect(ana.player.maxHp).toBe(maxHpFor(1) + 10);
    expect(ana.player.damage()).toEqual(damageRange(1).map((d) => d + 3));
    world.tick();
    expect(ana.conn.ofType('stats').at(-1)?.stats).toMatchObject({ maxHp: maxHpFor(1) + 10, defense: 2 });
    expect(ana.conn.ofType('inv').at(-1)?.inv.equipped).toMatchObject({ head: 'capacete', weapon: 'espada' });

    ana.player.hp = ana.player.maxHp;
    world.unequip(ana.player, 'head');
    expect(ana.player.maxHp).toBe(maxHpFor(1));
    expect(ana.player.hp).toBe(maxHpFor(1)); // a vida não fica acima do novo máximo
  });

  it('o dano da espada vale de verdade no estilingue', () => {
    const world = arena('cobra');
    const ana = join(world);
    ana.player.inventory.add('espada', 1);
    world.itemAction(ana.player, 'equip', 0);
    world.tick();
    shootRight(world, ana.player);
    const hit = ana.conn.ofType('hit').find((h) => h.by === ana.player.id);
    expect(hit?.dmg).toBe(damageRange(1)[0] + 3); // com random = 0, o dano é o mínimo
  });

  it('defesa tira um pouco de cada golpe (mas sempre sobra 1)', () => {
    const world = arena('cobra');
    const ana = join(world);
    ana.player.x = 3; // do lado da cobra
    ana.player.inventory.add('capacete', 1);
    world.itemAction(ana.player, 'equip', 0);
    ana.player.hp = ana.player.maxHp; // vida cheia: assim a vida que volta sozinha não entra na conta
    const before = ana.player.hp;
    run(world, 1500);
    const bites = ana.conn.ofType('hit').filter((h) => h.id === ana.player.id);
    expect(bites.length).toBeGreaterThan(0);
    expect(bites.every((h) => h.dmg === 3)).toBe(true); // 5 de dano - 2 de defesa
    expect(ana.player.hp).toBe(before - 3 * bites.length);
  });

  it('comer a fruta cura e gasta uma; vida cheia ou rápido demais é recusado', () => {
    const world = arena();
    const ana = join(world);
    ana.player.inventory.add('fruta', 2);
    world.itemAction(ana.player, 'use', 0);
    world.tick(); // as respostas saem no fim do tick
    expect(ana.conn.ofType('fail').at(-1)).toEqual({ t: 'fail', reason: 'full_hp', item: true });
    expect(ana.player.inventory.slots[0]).toEqual({ item: 'fruta', n: 2 });

    ana.player.hp = 20;
    ana.player.lastDamagedAt = clock.now(); // "acabou de apanhar": a vida não volta sozinha durante o teste
    world.itemAction(ana.player, 'use', 0);
    expect(ana.player.hp).toBe(30);
    expect(ana.player.inventory.slots[0]).toEqual({ item: 'fruta', n: 1 });
    world.itemAction(ana.player, 'use', 0);
    world.tick();
    expect(ana.conn.ofType('fail').at(-1)).toEqual({ t: 'fail', reason: 'cooldown', item: true });
    clock.advance(1000);
    world.itemAction(ana.player, 'use', 0);
    expect(ana.player.hp).toBe(40);
    expect(ana.player.inventory.slots[0]).toBeNull();
  });

  it('jogar fora tira a pilha inteira; desmaiado não mexe na mochila; espaço vazio é ignorado', () => {
    const world = arena();
    const ana = join(world);
    ana.player.inventory.add('fruta', 4);
    ana.player.inventory.add('capacete', 1);
    world.itemAction(ana.player, 'drop', 0);
    world.tick();
    expect(ana.player.inventory.slots[0]).toBeNull();
    expect(ana.conn.ofType('sys').at(-1)?.text).toBe('Você jogou fora: Fruta ×4.');
    world.itemAction(ana.player, 'equip', 7);
    ana.player.deadUntil = clock.now() + 1000;
    world.itemAction(ana.player, 'equip', 1);
    world.tick();
    expect(ana.player.inventory.equipped.head).toBeNull();
    expect(ana.conn.ofType('fail').at(-1)).toEqual({ t: 'fail', reason: 'dead', item: true });
  });

  it('o equipamento aparece no personagem: quem está perto recebe o desenho novo', () => {
    const world = arena();
    const ana = join(world, 'Ana');
    const beto = join(world, 'Beto');
    world.tick();
    expect(beto.conn.ofType('spawn').find((m) => m.e.id === ana.player.id)?.e.gear).toEqual({});
    ana.player.inventory.add('capacete', 1);
    ana.player.inventory.add('espada', 1);
    world.itemAction(ana.player, 'equip', 0);
    world.itemAction(ana.player, 'equip', 1);
    world.tick();
    const look = { head: 'capacete', weapon: 'espada' };
    expect(beto.conn.ofType('gear').at(-1)).toEqual({ t: 'gear', id: ana.player.id, gear: look });
    expect(ana.conn.ofType('gear').at(-1)?.gear).toEqual(look); // o próprio também, para se desenhar
    // quem chega depois já encontra a Ana equipada
    const caio = join(world, 'Caio');
    world.tick();
    expect(caio.conn.ofType('spawn').find((m) => m.e.id === ana.player.id)?.e.gear).toEqual(look);
    world.unequip(ana.player, 'head');
    world.tick();
    expect(beto.conn.ofType('gear').at(-1)?.gear).toEqual({ weapon: 'espada' });
  });

  it('tirar com a mochila cheia é recusado', () => {
    const world = arena();
    const ana = join(world);
    ana.player.inventory.add('capacete', 1);
    world.itemAction(ana.player, 'equip', 0);
    for (let i = 0; i < BAG_SIZE; i++) ana.player.inventory.add('espada', 1);
    world.unequip(ana.player, 'head');
    world.tick();
    expect(ana.player.inventory.equipped.head).toBe('capacete');
    expect(ana.conn.ofType('fail').at(-1)).toEqual({ t: 'fail', reason: 'bag_full', item: true });
  });

  it('a mochila é salva e volta igual (com os equipamentos valendo)', () => {
    const saves: { id: number; data: CharacterData }[] = [];
    const world = arena('boneco', { save: (list) => saves.push(...list) });
    const character = { id: 3, name: 'Ana', level: 2, xp: 0, hp: null, zone: null, x: null, y: null, dir: DOWN, look: 1, inventory: null };
    const conn = new FakeConn();
    const first = world.join('Ana', conn, { character, created: false });
    if (!first.ok) throw new Error(first.reason);
    first.player.inventory.add('fruta', 3);
    first.player.inventory.add('capacete', 1);
    world.itemAction(first.player, 'equip', 1);
    world.leave(first.player);
    const saved = saves.at(-1)!.data;
    expect(saved.inventory?.slots[0]).toEqual({ item: 'fruta', n: 3 });
    expect(saved.inventory?.slots[1]).toBeNull();
    expect(saved.inventory?.equipped).toMatchObject({ head: 'capacete' });

    const back = world.join('Ana', new FakeConn(), { character: { ...character, inventory: saved.inventory }, created: false });
    if (!back.ok) throw new Error(back.reason);
    expect(back.player.inventory.slots[0]).toEqual({ item: 'fruta', n: 3 });
    expect(back.player.maxHp).toBe(maxHpFor(2) + 10);
    expect(back.player.hp).toBe(back.player.maxHp);
  });

  it('as mensagens da mochila são conferidas', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'item', act: 'equip', i: 3 }))).toEqual({ t: 'item', act: 'equip', i: 3 });
    expect(parseClientMsg(JSON.stringify({ t: 'item', act: 'vender', i: 3 }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'item', act: 'use', i: BAG_SIZE }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'item', act: 'use', i: 1.5 }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'unequip', part: 'head' }))).toEqual({ t: 'unequip', part: 'head' });
    expect(parseClientMsg(JSON.stringify({ t: 'unequip', part: 'pe' }))).toBeNull();
  });
});

describe('arquivo de personagens de antes da mochila', () => {
  it('é convertido sozinho e o personagem continua entrando (com a mochila vazia)', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'meummo-v1-'));
    try {
      const file = path.join(dir, 'meummo.db');
      // Um arquivo da versão 1, como o de quem jogou antes de existir mochila.
      const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
      const old = new DatabaseSync(file);
      old.exec(MIGRATIONS[0]!);
      old.exec('PRAGMA user_version = 1');
      old
        .prepare("INSERT INTO characters (name, name_key, password_hash, level, xp, look, created_at) VALUES ('Ana', 'ana', ?, 3, 7, 5, 'ontem')")
        .run(await hashPassword('segredo1', FAST_HASH));
      old.close();

      const store = new CharacterStore(file, { cost: FAST_HASH });
      const login = await store.login('Ana', 'segredo1');
      expect(login).toMatchObject({ ok: true, created: false });
      const id = login.ok ? login.id : -1;
      expect(store.load(id)).toMatchObject({ name: 'Ana', level: 3, xp: 7, inventory: null });
      store.save([{ id, data: { ...store.load(id)!, inventory: { slots: [{ item: 'banana', n: 2 }], equipped: {} } } }]);
      expect(store.load(id)?.inventory).toEqual({ slots: [{ item: 'banana', n: 2 }], equipped: {} });
      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('atalhos de consumo (campo "atalho")', () => {
  const defs = parseItemDefs({
    banana: { nome: 'Banana', tipo: 'consumivel', cura: 15, atalho: 1 },
    coco: { nome: 'Água de Coco', tipo: 'consumivel', cura: 20, atalho: 1 },
    arruda: { nome: 'Arruda', tipo: 'consumivel', cura: 30, atalho: 2 },
    garrafada: { nome: 'Garrafada', tipo: 'consumivel', cura: 60, atalho: 2 },
    pao: { nome: 'Pão', tipo: 'consumivel', cura: 5 }, // sem atalho
    chapeu: { nome: 'Chapéu', tipo: 'equipamento', parte: 'cabeca' },
  });
  const bag = (...stacks: ([string, number] | null)[]): InventoryState => ({
    gold: 0,
    slots: stacks.map((s) => (s ? { item: s[0], n: s[1] } : null)),
    equipped: emptyEquipment(),
  });

  it('o arquivo diz o grupo: 1 = comida, 2 = remédio; só consumível tem atalho', () => {
    expect(defs.get('banana')!.quick).toBe(1);
    expect(defs.get('garrafada')!.quick).toBe(2);
    expect(defs.get('pao')!.quick).toBeUndefined();
    expect(() => parseItemDefs({ x: { nome: 'X', tipo: 'equipamento', parte: 'cabeca', atalho: 1 } })).toThrow(/"atalho" só vale para consumíveis/);
    expect(() => parseItemDefs({ x: { nome: 'X', tipo: 'consumivel', cura: 5, atalho: 3 } })).toThrow(/"atalho" precisa ser 1 \(comida\) ou 2 \(remédio\)/);
    const real = loadItemDefs();
    expect(real.get('banana')!.quick).toBe(1);
    expect(real.get('agua_coco')!.quick).toBe(1);
    expect(real.get('erva_arruda')!.quick).toBe(2);
    expect(real.get('garrafada')!.quick).toBe(2);
  });

  it('cada atalho usa o item do grupo com a maior cura que está na mochila, e conta todos os espaços dele', () => {
    const inv = bag(['banana', 5], ['chapeu', 1], ['coco', 2], null, ['arruda', 1], ['coco', 3]);
    expect(pickQuickItem(1, defs, inv)).toEqual({ item: 'coco', count: 5, slot: 2 });
    expect(pickQuickItem(2, defs, inv)).toEqual({ item: 'arruda', count: 1, slot: 4 });
    expect(pickQuickItem(1, defs, bag(['banana', 2]))).toEqual({ item: 'banana', count: 2, slot: 0 });
    expect(pickQuickItem(2, defs, bag(['banana', 2], ['pao', 4]))).toBeNull(); // nada do grupo 2 (pão não tem atalho)
  });
});
