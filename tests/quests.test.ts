// Missões: leitura de data/missoes.json, aceitar, contar, concluir com recompensa, salvar e converter saves antigos.

import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { CharacterStore, hashPassword, MIGRATIONS, type CharacterData } from '../src/server/accounts';
import { loadItemDefs, parseItemDefs } from '../src/server/items';
import { loadMonsterDefs, parseMonsterDefs } from '../src/server/monsters';
import { loadNpcDefs, parseNpcDefs } from '../src/server/npcs';
import { checkQuests, loadQuestDefs, parseQuestDefs } from '../src/server/quests';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { SHOT_COOLDOWN_MS, TICK_MS } from '../src/shared/constants';
import { DOWN } from '../src/shared/dir';
import { GameMap } from '../src/shared/map';
import { MAX_ACTIVE_QUESTS } from '../src/shared/quests';
import { FAST_HASH, FakeClock, FakeConn, tiledFromAscii } from './helpers';

const items = parseItemDefs({
  fruta: { nome: 'Fruta', preco: 5, tipo: 'consumivel', cura: 10 },
  couro: { nome: 'Couro', preco: 6, tipo: 'material' },
  chapeu: { nome: 'Chapéu', preco: 40, tipo: 'equipamento', parte: 'cabeca', vida: 10 },
});
const monsters = parseMonsterDefs({
  bicho: { nome: 'Bicho', nivel: 1, vida: 1, xp: 1, passoMs: 1e9, renascerMs: 100, ataque: { tipo: 'mordida', preparoMs: 500, intervaloMs: 1000, dano: [1, 1] } },
});
const npcs = parseNpcDefs({ velho: { nome: 'Seu Velho', titulo: 'do mato', mapa: 'vila', x: 2, y: 0, fala: 'Oi!' } });
const QUESTS = {
  espantar: {
    nome: 'Espantar Bichos',
    quemDa: 'velho',
    pedido: 'Espante 2 bichos.',
    concluida: 'Valeu!',
    objetivo: { tipo: 'derrotar', monstro: 'bicho', quantidade: 2 },
    recompensa: { xp: 7, ouro: 10, itens: [{ item: 'fruta', quantidade: 2 }] },
  },
  couros: {
    nome: 'Couros',
    quemDa: 'velho',
    depoisDe: 'espantar',
    nivelMinimo: 2,
    pedido: 'Traga 3 couros.',
    objetivo: { tipo: 'entregar', item: 'couro', quantidade: 3 },
    recompensa: { ouro: 30, itens: [{ item: 'chapeu', quantidade: 1 }] },
  },
  sempre: {
    nome: 'De Novo',
    quemDa: 'velho',
    repetivel: true,
    pedido: 'Espante 1 bicho.',
    objetivo: { tipo: 'derrotar', monstro: 'bicho', quantidade: 1 },
    recompensa: { ouro: 1 },
  },
};
const quests = parseQuestDefs(QUESTS);

describe('data/missoes.json', () => {
  it('o arquivo de verdade é válido (quem dá, monstros, itens e missões anteriores existem)', () => {
    const real = loadQuestDefs();
    expect(real.size).toBeGreaterThan(0);
    expect(() => checkQuests(real, { npcs: loadNpcDefs(), monsters: loadMonsterDefs(), items: loadItemDefs() })).not.toThrow();
  });

  it('traduz o português e completa o que faltou', () => {
    expect(quests.get('espantar')).toEqual({
      id: 'espantar',
      name: 'Espantar Bichos',
      giver: 'velho',
      minLevel: 1,
      after: null,
      repeatable: false,
      ask: 'Espante 2 bichos.',
      done: 'Valeu!',
      goal: { kind: 'kill', monster: 'bicho', count: 2 },
      goalName: 'bicho',
      reward: { xp: 7, gold: 10, items: [{ item: 'fruta', n: 2 }] },
    });
    expect(quests.get('couros')).toMatchObject({ after: 'espantar', minLevel: 2, done: 'Obrigado!', goal: { kind: 'deliver', item: 'couro', count: 3 }, reward: { xp: 0 } });
    expect(quests.get('sempre')!.repeatable).toBe(true);
  });

  it('explica o erro em português', () => {
    const base = QUESTS.espantar;
    const bad = (quest: Record<string, unknown>) => () => parseQuestDefs({ teste: { ...base, ...quest } });
    expect(bad({ objetivo: { tipo: 'pescar', monstro: 'bicho' } })).toThrow(/"tipo" precisa ser "derrotar" \(monstros\), "entregar" \(itens\) ou "falar"/);
    expect(bad({ objetivo: { tipo: 'derrotar', monstro: 'bicho', quantidade: 0 } })).toThrow(/"quantidade" precisa ser pelo menos 1/);
    expect(bad({ recompensa: { xp: 1.5 } })).toThrow(/"xp" precisa ser um número inteiro/);
    expect(bad({ pedido: undefined })).toThrow(/"pedido" precisa ser um texto/);
    expect(() => parseQuestDefs({ 'Missão 1': base })).toThrow(/só pode ter letras sem acento/);

    const game = { npcs, monsters, items };
    const check = (quest: Record<string, unknown>) => () => checkQuests(parseQuestDefs({ teste: { ...base, ...quest } }), game);
    expect(check({})).not.toThrow();
    expect(check({ quemDa: 'ninguem' })).toThrow(/"quemDa" é "ninguem", que não existe em data\/npcs.json/);
    expect(check({ objetivo: { tipo: 'derrotar', monstro: 'dragao' } })).toThrow(/o monstro "dragao" não existe/);
    expect(check({ objetivo: { tipo: 'entregar', item: 'ouro_puro' } })).toThrow(/o item "ouro_puro" não existe/);
    expect(check({ recompensa: { itens: [{ item: 'espada' }] } })).toThrow(/a recompensa tem o item "espada"/);
    expect(check({ depoisDe: 'outra' })).toThrow(/"depoisDe" é "outra", que não é uma missão/);
    const circle = parseQuestDefs({ a: { ...base, depoisDe: 'b' }, b: { ...base, depoisDe: 'a' } });
    expect(() => checkQuests(circle, game)).toThrow(/volta em círculo/);
  });
});

// ---------- no mundo ----------

let clock: FakeClock;
beforeEach(() => {
  clock = new FakeClock();
});

/** Vila 8x3: o Seu Velho em (2, 0), o jogador nasce em (1, 1), um bicho de 1 de vida em (4, 1). */
function village(saver?: { save(list: { id: number; data: CharacterData }[]): void }): World {
  const map = GameMap.fromTiled(tiledFromAscii(['........', '........', '........'], { x: 1, y: 1 }, [{ monster: 'bicho', x: 4, y: 1, w: 1, h: 1 }]), 'vila');
  return new World(map, { now: clock.now, random: () => 0, monsters, items, npcs, quests, saver });
}

function join(world: World, name = 'Ana', character?: CharacterData & { id: number; name: string }): { player: Player; conn: FakeConn } {
  const conn = new FakeConn();
  const result = character ? world.join(name, conn, { character, created: false }) : world.join(name, conn);
  if (!result.ok) throw new Error(result.reason);
  result.player.x = 1;
  result.player.y = 1;
  return { player: result.player, conn };
}

function run(world: World, ms: number): void {
  for (let t = 0; t < ms; t += TICK_MS) {
    clock.advance(TICK_MS);
    world.tick();
  }
}

const velho = (world: World) => [...world.npcs.values()].find((n) => n.def.id === 'velho')!.id;

/** Derruba o bicho (atirando para a direita) e espera ele renascer. */
function killBicho(world: World, player: Player): void {
  world.shoot(player, Math.floor(clock.now()), 0);
  run(world, SHOT_COOLDOWN_MS + 200);
}

describe('missões no mundo', () => {
  it('as missões e o seu progresso chegam nas boas-vindas', () => {
    const world = village();
    const { conn } = join(world);
    const welcome = conn.ofType('welcome')[0]!;
    expect(welcome.quests.map((q) => q.id)).toEqual(['espantar', 'couros', 'sempre']);
    expect(welcome.questLog).toEqual({});
  });

  it('aceitar perto de quem dá; derrotar conta; pronta avisa; concluir dá a recompensa', () => {
    const world = village();
    const { player, conn } = join(world);
    world.questAction(player, 'accept', 'espantar', velho(world));
    run(world, TICK_MS);
    expect(player.quests).toEqual({ espantar: { state: 'active', count: 0 } });
    expect(conn.ofType('quests').at(-1)?.log).toEqual({ espantar: { state: 'active', count: 0 } });
    expect(conn.ofType('sys').some((m) => m.text === 'Missão aceita: Espantar Bichos.')).toBe(true);

    killBicho(world, player);
    expect(player.quests.espantar).toEqual({ state: 'active', count: 1 });
    // concluir antes da hora: avisa o que falta
    world.questAction(player, 'complete', 'espantar', velho(world));
    run(world, TICK_MS);
    expect(conn.ofType('sys').some((m) => m.text === 'Ainda falta: 1 para concluir "Espantar Bichos".')).toBe(true);

    killBicho(world, player);
    expect(player.quests.espantar!.count).toBe(2);
    expect(conn.ofType('sys').some((m) => m.text === 'Missão pronta: Espantar Bichos. Fale com Seu Velho para receber a recompensa.')).toBe(true);
    killBicho(world, player); // depois de pronta, não passa de 2
    expect(player.quests.espantar!.count).toBe(2);

    const xpBefore = player.xp;
    world.questAction(player, 'complete', 'espantar', velho(world));
    run(world, TICK_MS);
    expect(player.quests.espantar).toEqual({ state: 'done', count: 2 });
    expect(player.inventory.gold).toBe(10);
    expect(player.inventory.countOf('fruta')).toBe(2);
    expect(player.xp).toBe(xpBefore + 7);
    expect(conn.ofType('sys').some((m) => m.text === 'Missão concluída: Espantar Bichos! Você ganhou: 7 XP, 10 de ouro, Fruta ×2.')).toBe(true);

    // não repetível: não dá para aceitar de novo
    world.questAction(player, 'accept', 'espantar', velho(world));
    run(world, TICK_MS);
    expect(conn.ofType('sys').at(-1)?.text).toBe('Você já fez esta missão.');
  });

  it('missão de entregar: depois da anterior, com nível mínimo; tira os itens da mochila', () => {
    const world = village();
    const { player, conn } = join(world);
    const id = velho(world);
    world.questAction(player, 'accept', 'couros', id);
    run(world, TICK_MS);
    expect(conn.ofType('sys').at(-1)?.text).toBe('Ainda não: faça antes a missão anterior.');
    player.quests.espantar = { state: 'done', count: 2 };
    world.questAction(player, 'accept', 'couros', id);
    run(world, TICK_MS);
    expect(conn.ofType('sys').at(-1)?.text).toBe('Esta missão é para quem tem nível 2 ou mais.');
    player.level = 2;
    world.questAction(player, 'accept', 'couros', id);
    expect(player.quests.couros?.state).toBe('active');

    player.inventory.add('couro', 2);
    world.questAction(player, 'complete', 'couros', id);
    run(world, TICK_MS);
    expect(conn.ofType('sys').at(-1)?.text).toBe('Ainda faltam 1 de Couro para concluir "Couros".');
    expect(player.inventory.countOf('couro')).toBe(2);

    player.inventory.add('couro', 2);
    world.questAction(player, 'complete', 'couros', id);
    expect(player.inventory.countOf('couro')).toBe(1);
    expect(player.inventory.countOf('chapeu')).toBe(1);
    expect(player.inventory.gold).toBe(30);
    expect(player.quests.couros?.state).toBe('done');
  });

  it('longe de quem dá, não aceita nem conclui; NPC errado ou missão que não existe é ignorado', () => {
    const world = village();
    const { player, conn } = join(world);
    player.x = 7; // a 5 tiles do Seu Velho
    world.questAction(player, 'accept', 'espantar', velho(world));
    run(world, TICK_MS);
    expect(conn.ofType('fail').at(-1)).toEqual({ t: 'fail', reason: 'too_far', item: true });
    player.x = 1;
    conn.clear();
    world.questAction(player, 'accept', 'nada', velho(world));
    world.questAction(player, 'accept', 'espantar', 9999);
    world.questAction(player, 'accept', 'espantar');
    run(world, TICK_MS);
    expect(player.quests).toEqual({});
    expect(conn.ofType('fail')).toHaveLength(0);
  });

  it('abandonar tira do diário; repetível dá para fazer de novo; limite de missões ao mesmo tempo', () => {
    const world = village();
    const { player, conn } = join(world);
    const id = velho(world);
    world.questAction(player, 'accept', 'espantar', id);
    world.questAction(player, 'abandon', 'espantar');
    expect(player.quests.espantar).toBeUndefined();

    world.questAction(player, 'accept', 'sempre', id);
    killBicho(world, player);
    world.questAction(player, 'complete', 'sempre', id);
    expect(player.quests.sempre?.state).toBe('done');
    world.questAction(player, 'accept', 'sempre', id);
    expect(player.quests.sempre).toEqual({ state: 'active', count: 0 });

    // limite
    for (let i = 0; i < MAX_ACTIVE_QUESTS; i++) player.quests[`outra${i}`] = { state: 'active', count: 0 };
    world.questAction(player, 'accept', 'espantar', id);
    run(world, TICK_MS);
    expect(conn.ofType('sys').at(-1)?.text).toBe('Você já está com missões demais. Conclua ou abandone uma antes.');
  });

  it('o progresso é salvo e volta conferido (missão que sumiu sai; número estranho é corrigido)', () => {
    const saves: { id: number; data: CharacterData }[] = [];
    const world = village({ save: (list) => saves.push(...list) });
    const character = { id: 3, name: 'Ana', level: 1, xp: 0, hp: null, zone: null, x: null, y: null, dir: DOWN, look: 1, inventory: null };
    const first = join(world, 'Ana', character);
    world.questAction(first.player, 'accept', 'espantar', velho(world));
    killBicho(world, first.player);
    world.leave(first.player);
    const saved = saves.at(-1)!.data;
    expect(saved.quests).toEqual({ espantar: { state: 'active', count: 1 } });

    const messy = { espantar: { state: 'active', count: 99 }, sumiu: { state: 'done', count: 1 }, sempre: { state: 'estranho', count: 1 } };
    const back = join(world, 'Ana', { ...character, quests: messy as CharacterData['quests'] });
    expect(back.player.quests).toEqual({ espantar: { state: 'active', count: 2 } });
    expect(back.conn.ofType('welcome')[0]!.questLog).toEqual({ espantar: { state: 'active', count: 2 } });
  });

  it('as mensagens de missão são conferidas', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'quest', act: 'accept', id: 'espantar', npc: 7 }))).toEqual({ t: 'quest', act: 'accept', id: 'espantar', npc: 7 });
    expect(parseClientMsg(JSON.stringify({ t: 'quest', act: 'abandon', id: 'espantar' }))).toEqual({ t: 'quest', act: 'abandon', id: 'espantar' });
    expect(parseClientMsg(JSON.stringify({ t: 'quest', act: 'roubar', id: 'espantar', npc: 7 }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'quest', act: 'accept', id: 'Espantar Bichos', npc: 7 }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'quest', act: 'accept', id: 'espantar', npc: -1 }))).toBeNull();
  });
});

describe('arquivo de personagens de antes das missões', () => {
  it('é convertido sozinho e o personagem entra sem missões', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'meummo-v2-'));
    try {
      const file = path.join(dir, 'meummo.db');
      // Um arquivo da versão 2 (com mochila, sem missões), como o de quem jogou antes das missões.
      const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
      const old = new DatabaseSync(file);
      old.exec(MIGRATIONS[0]!);
      old.exec(MIGRATIONS[1]!);
      old.exec('PRAGMA user_version = 2');
      old
        .prepare(
          "INSERT INTO characters (name, name_key, password_hash, level, xp, look, inventory, created_at) VALUES ('Ana', 'ana', ?, 3, 7, 5, '{\"slots\":[],\"equipped\":{},\"gold\":40}', 'ontem')",
        )
        .run(await hashPassword('segredo1', FAST_HASH));
      old.close();

      const store = new CharacterStore(file, { cost: FAST_HASH });
      const login = await store.login('Ana', 'segredo1');
      const id = login.ok ? login.id : -1;
      expect(store.load(id)).toMatchObject({ name: 'Ana', level: 3, quests: null, inventory: { gold: 40 } });
      store.save([{ id, data: { ...store.load(id)!, quests: { espantar: { state: 'done', count: 2 } } } }]);
      expect(store.load(id)?.quests).toEqual({ espantar: { state: 'done', count: 2 } });
      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('missão de falar com alguém', () => {
  const talkNpcs = parseNpcDefs({
    velho: { nome: 'Seu Velho', titulo: 'do mato', mapa: 'vila', x: 2, y: 0, fala: 'Oi!' },
    dona: { nome: 'Dona Venda', titulo: 'do balcão', mapa: 'vila', x: 6, y: 0, fala: 'Opa!' },
  });
  const talkQuests = parseQuestDefs({
    recado: {
      nome: 'O Recado',
      quemDa: 'velho',
      pedido: 'Vá falar com a Dona Venda.',
      concluida: 'Ah, foi o Seu Velho que te mandou!',
      objetivo: { tipo: 'falar', com: 'dona', rotulo: 'Falar com a Dona Venda, no balcão' },
      recompensa: { xp: 9 },
    },
  });

  it('lê o objetivo "falar" (com quem e o texto) e confere se a pessoa existe', () => {
    expect(talkQuests.get('recado')).toMatchObject({ goal: { kind: 'talk', npc: 'dona', count: 1 }, goalName: 'dona', goalLabel: 'Falar com a Dona Venda, no balcão' });
    const game = { npcs: talkNpcs, monsters, items };
    expect(() => checkQuests(talkQuests, game)).not.toThrow();
    const ghost = parseQuestDefs({ x: { nome: 'X', quemDa: 'velho', pedido: '...', objetivo: { tipo: 'falar', com: 'ninguem' } } });
    expect(() => checkQuests(ghost, game)).toThrow(/manda falar com "ninguem", que não existe/);
  });

  it('aceita com quem dá e conclui com a pessoa procurada, nunca com quem deu', () => {
    const map = GameMap.fromTiled(tiledFromAscii(['........', '........', '........'], { x: 1, y: 1 }), 'vila');
    const world = new World(map, { now: clock.now, random: () => 0, monsters, items, npcs: talkNpcs, quests: talkQuests });
    const { player, conn } = join(world);
    const idOf = (key: string) => [...world.npcs.values()].find((n) => n.def.id === key)!.id;
    world.questAction(player, 'accept', 'recado', idOf('dona')); // a Dona não dá esta missão
    expect(player.quests.recado).toBeUndefined();
    world.questAction(player, 'accept', 'recado', idOf('velho'));
    expect(player.quests.recado).toEqual({ state: 'active', count: 0 });
    world.questAction(player, 'complete', 'recado', idOf('velho')); // concluir é com a pessoa procurada
    expect(player.quests.recado!.state).toBe('active');
    player.x = 5; // foi até o balcão dela
    world.questAction(player, 'complete', 'recado', idOf('dona'));
    expect(player.quests.recado).toEqual({ state: 'done', count: 1 });
    expect(player.xp).toBe(9);
    world.tick();
    expect(conn.ofType('sys').some((m) => m.text.includes('Missão concluída: O Recado'))).toBe(true);
  });

  it('a primeira missão do jogo novo: o Curupira manda falar com a Budega, e a Budega pede os saguis', () => {
    const real = loadQuestDefs();
    expect(real.get('o_despertar')).toMatchObject({ giver: 'curupira_capao', goal: { kind: 'talk', npc: 'budega' } });
    expect(real.get('saguis_encantados')).toMatchObject({ giver: 'budega', after: 'o_despertar', goal: { kind: 'kill', monster: 'sagui', count: 4 } });
    expect(() => checkQuests(real, { npcs: loadNpcDefs(), monsters: loadMonsterDefs(), items: loadItemDefs() })).not.toThrow();
  });
});
