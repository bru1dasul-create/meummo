// Personagens salvos: senha, arquivo, entrada no jogo e progresso que volta.

import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CharacterStore,
  hashPassword,
  verifyPassword,
  type CharacterData,
  type CharacterSaver,
  type SavedCharacter,
} from '../src/server/accounts';
import { parseMonsterDefs } from '../src/server/monsters';
import { Session } from '../src/server/session';
import { parseClientMsg } from '../src/server/validate';
import { AUTOSAVE_MS, characterData, World, type Player } from '../src/server/world';
import { PROTOCOL_VERSION, SHOT_COOLDOWN_MS, TICK_MS } from '../src/shared/constants';
import { DOWN, LEFT } from '../src/shared/dir';
import { GameMap } from '../src/shared/map';
import { maxHpFor, xpToNext } from '../src/shared/progression';
import { FAST_HASH, FakeClock, FakeConn, FakeTransport, makeLobby, sendHello, tiledFromAscii } from './helpers';

const map = GameMap.fromTiled(
  tiledFromAscii(
    [
      '..........', //
      '..#.......', // parede em (2, 1)
      '..........',
      '..........',
      '..........',
    ],
    { x: 0, y: 0 },
  ),
);

let clock: FakeClock;
beforeEach(() => {
  clock = new FakeClock();
});

/** Guarda o que o mundo mandou salvar. */
class FakeSaver implements CharacterSaver {
  readonly saves: { id: number; data: CharacterData }[][] = [];

  save(list: { id: number; data: CharacterData }[]): void {
    this.saves.push(list.map(({ id, data }) => ({ id, data: { ...data } })));
  }

  lastFor(id: number): CharacterData | undefined {
    return this.saves.flat().filter((entry) => entry.id === id).at(-1)?.data;
  }
}

function saved(changes: Partial<SavedCharacter> = {}): SavedCharacter {
  return { id: 7, name: 'Ana', level: 1, xp: 0, hp: null, zone: null, x: null, y: null, dir: DOWN, look: 123, inventory: null, ...changes };
}

function joinSaved(world: World, character: SavedCharacter): { player: Player; conn: FakeConn } {
  const conn = new FakeConn();
  const result = world.join(character.name, conn, { character, created: false });
  if (!result.ok) throw new Error(result.reason);
  return { player: result.player, conn };
}

describe('senhas', () => {
  it('ficam guardadas embaralhadas (scrypt) e só a senha certa confere', async () => {
    const stored = await hashPassword('minha senha', FAST_HASH);
    expect(stored).toMatch(/^scrypt\$1024\$8\$1\$/);
    expect(stored).not.toContain('minha senha');
    expect(await verifyPassword('minha senha', stored)).toBe(true);
    expect(await verifyPassword('minha senhA', stored)).toBe(false);
    // Cada senha leva um "sal" aleatório: a mesma senha nunca fica igual no arquivo.
    expect(await hashPassword('minha senha', FAST_HASH)).not.toBe(stored);
    expect(await verifyPassword('qualquer', 'lixo no arquivo')).toBe(false);
  });
});

describe('arquivo de personagens', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'meummo-teste-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('cria na primeira vez, confere a senha depois e não diferencia maiúsculas', async () => {
    const store = new CharacterStore(':memory:', { cost: FAST_HASH });
    const first = await store.login('Ana', 'segredo1');
    expect(first).toMatchObject({ ok: true, created: true });
    expect(await store.login('ANA', 'segredo1')).toEqual({ ok: true, id: first.ok ? first.id : -1, created: false });
    expect(await store.login('ana', 'errada!!')).toEqual({ ok: false, reason: 'wrong_password' });
    expect(store.load(first.ok ? first.id : -1)).toMatchObject({ name: 'Ana', level: 1, xp: 0, hp: null, x: null });
    expect(store.count()).toBe(1);
    store.close();
  });

  it('não cria personagem novo quando não pode (mas quem já existe entra)', async () => {
    const store = new CharacterStore(':memory:', { cost: FAST_HASH });
    await store.login('Ana', 'segredo1');
    expect(await store.login('Beto', 'segredo1', false)).toEqual({ ok: false, reason: 'creation_limit' });
    expect(await store.login('Ana', 'segredo1', false)).toMatchObject({ ok: true });
    store.close();
  });

  it('dois criando o mesmo nome ao mesmo tempo: fica a senha de quem chegou primeiro', async () => {
    const store = new CharacterStore(':memory:', { cost: FAST_HASH });
    const results = await Promise.all([store.login('Ana', 'senha-um'), store.login('ana', 'senha-dois')]);
    expect(results.filter((r) => r.ok && r.created)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: 'wrong_password' }]);
    expect(store.count()).toBe(1);
    store.close();
  });

  it('guarda o progresso e ele continua lá depois de fechar e abrir o arquivo', async () => {
    const file = path.join(dir, 'saves', 'meummo.db'); // a pasta ainda não existe: é criada sozinha
    const store = new CharacterStore(file, { cost: FAST_HASH });
    const login = await store.login('Lúcia', 'segredo1');
    if (!login.ok) throw new Error('não criou');
    const data: CharacterData = {
      level: 4,
      xp: 33,
      hp: 50,
      zone: 'Refúgio',
      x: 12,
      y: 9,
      dir: LEFT,
      look: 4_000_000_000,
      inventory: { slots: [{ item: 'banana', n: 3 }, null], equipped: { head: 'chapeu_palha' } },
    };
    store.save([{ id: login.id, data }]);
    store.close();

    const again = new CharacterStore(file, { cost: FAST_HASH });
    expect(again.load(login.id)).toEqual({ id: login.id, name: 'Lúcia', ...data });
    expect(await again.login('lúcia', 'segredo1')).toMatchObject({ ok: true, created: false });
    again.close();
  });

  it('arquivo de uma versão mais nova do jogo: explica em vez de estragar', () => {
    const file = path.join(dir, 'novo.db');
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = new DatabaseSync(file);
    db.exec('PRAGMA user_version = 99');
    db.close();
    expect(() => new CharacterStore(file, { cost: FAST_HASH })).toThrow(/versão mais nova/);
  });
});

describe('progresso no mundo', () => {
  it('volta de onde parou, com o nível, a XP, a vida e a aparência que tinha', () => {
    const world = new World(map, { now: clock.now, random: () => 0 });
    const { player, conn } = joinSaved(world, saved({ level: 3, xp: 5, hp: 30, zone: map.name, x: 6, y: 3, dir: LEFT }));
    expect(player).toMatchObject({ level: 3, xp: 5, hp: 30, maxHp: maxHpFor(3), x: 6, y: 3, dir: LEFT, look: 123, characterId: 7 });
    expect(conn.ofType('welcome')[0]?.you).toMatchObject({ x: 6, y: 3, level: 3, hp: 30, look: 123 });
    expect(conn.ofType('sys')[0]?.text).toContain('Bem-vindo(a) de volta, Ana!');
  });

  it('nasce na vila com vida cheia se o lugar salvo virou parede ou é de outra zona', () => {
    const world = new World(map, { now: clock.now, random: () => 0 });
    const wall = joinSaved(world, saved({ hp: 10, zone: map.name, x: 2, y: 1 }));
    expect(wall.player).toMatchObject({ x: 0, y: 0, hp: wall.player.maxHp });
    world.leave(wall.player);
    const elsewhere = joinSaved(world, saved({ hp: 10, zone: 'Ruínas de Santo Amaro', x: 6, y: 3 }));
    expect(elsewhere.player).toMatchObject({ x: 0, y: 0, hp: elsewhere.player.maxHp });
  });

  it('se a conta de XP mudar e sobrar XP, sobe de nível em vez de perder', () => {
    const world = new World(map, { now: clock.now, random: () => 0 });
    const { player } = joinSaved(world, saved({ level: 1, xp: xpToNext(1) + 10 }));
    expect(player.level).toBe(2);
    expect(player.xp).toBe(10);
  });

  it('salva ao sair e a cada 30 segundos', () => {
    const saver = new FakeSaver();
    const world = new World(map, { now: clock.now, random: () => 0, saver });
    const { player } = joinSaved(world, saved({ zone: map.name, x: 5, y: 2 }));
    clock.advance(AUTOSAVE_MS - 100);
    world.tick();
    expect(saver.saves).toHaveLength(0);
    clock.advance(200);
    world.tick();
    expect(saver.lastFor(7)).toMatchObject({ level: 1, x: 5, y: 2, zone: map.name, look: 123 });

    player.x = 8;
    world.leave(player);
    expect(saver.lastFor(7)).toMatchObject({ x: 8, y: 2 });
  });

  it('quem não tem personagem salvo (testes) não é salvo', () => {
    const saver = new FakeSaver();
    const world = new World(map, { now: clock.now, random: () => 0, saver });
    const result = world.join('Visita', new FakeConn());
    if (!result.ok) throw new Error(result.reason);
    world.leave(result.player);
    expect(saver.saves).toHaveLength(0);
  });

  it('desmaiado é salvo como quem acorda na vila, com a vida cheia', () => {
    const world = new World(map, { now: clock.now, random: () => 0 });
    const { player } = joinSaved(world, saved({ level: 2, zone: map.name, x: 6, y: 3 }));
    player.hp = 0;
    player.deadUntil = clock.now() + 1000;
    expect(characterData(player, map.name)).toMatchObject({ level: 2, hp: null, x: null, y: null });
  });

  it('subir de nível salva na hora', () => {
    const defs = parseMonsterDefs({
      alvo: {
        nome: 'Boneco',
        nivel: 1,
        vida: 3,
        xp: 50,
        passoMs: 1e9,
        agressivo: false,
        perseguicao: 30,
        renascerMs: 1000,
        ataque: { tipo: 'mordida', preparoMs: 500, intervaloMs: 1000, dano: [5, 5] },
      },
    });
    const arena = GameMap.fromTiled(tiledFromAscii(['.'.repeat(10), '.'.repeat(10), '.'.repeat(10)], { x: 1, y: 1 }, [{ monster: 'alvo', x: 5, y: 1, w: 1, h: 1 }]));
    const saver = new FakeSaver();
    const world = new World(arena, { now: clock.now, random: () => 0, saver, monsters: defs });
    const { player } = joinSaved(world, saved());
    world.tick();
    world.shoot(player, 1, 0); // para a direita, no boneco
    for (let t = 0; t < SHOT_COOLDOWN_MS; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
    expect(player.level).toBe(2);
    expect(saver.lastFor(7)).toMatchObject({ level: 2, xp: 10 });
  });
});

describe('entrar com senha', () => {
  function connect(lobby = makeLobby(map, clock), ip = '10.0.0.1') {
    const transport = new FakeTransport();
    const session = new Session(lobby, transport, ip, clock.now);
    return { lobby, transport, session };
  }

  it('cria o personagem na primeira vez e, na volta, ele está como ficou', async () => {
    const a = connect();
    const welcome = await sendHello(a.session, a.transport, 'Ana', 'segredo1');
    expect(welcome.t).toBe('welcome');
    expect(a.transport.ofType('sys')[0]?.text).toContain('Personagem criado: Ana!');
    const player = [...a.lobby.world.players.values()][0]!;
    player.level = 3;
    player.xp = 12;
    player.x = 6;
    player.y = 3;
    a.session.disconnect();
    expect(a.lobby.world.players.size).toBe(0);

    const b = connect(a.lobby);
    const back = await sendHello(b.session, b.transport, 'ana', 'segredo1');
    expect(back).toMatchObject({ t: 'welcome', you: { name: 'Ana', level: 3, x: 6, y: 3 }, stats: { level: 3, xp: 12 } });
    expect(b.transport.ofType('sys')[0]?.text).toContain('Bem-vindo(a) de volta, Ana!');
  });

  it('senha errada não entra; senha curta nem cria personagem', async () => {
    const a = connect();
    await sendHello(a.session, a.transport, 'Ana', 'segredo1');
    a.session.disconnect();

    const wrong = connect(a.lobby);
    expect(await sendHello(wrong.session, wrong.transport, 'Ana', 'outra-senha')).toEqual({ t: 'reject', reason: 'wrong_password' });
    expect(wrong.transport.closed).toEqual([4000]);
    expect(a.lobby.world.players.size).toBe(0);

    const short = connect(a.lobby);
    expect(await sendHello(short.session, short.transport, 'Beto', '123')).toEqual({ t: 'reject', reason: 'password_invalid' });
    expect(a.lobby.store.count()).toBe(1);
  });

  it('entrar de outro lugar tira a sessão antiga (avisando) e não perde nada', async () => {
    const tab1 = connect();
    await sendHello(tab1.session, tab1.transport, 'Ana', 'segredo1');
    const player = [...tab1.lobby.world.players.values()][0]!;
    player.level = 4;

    const tab2 = connect(tab1.lobby);
    const welcome = await sendHello(tab2.session, tab2.transport, 'Ana', 'segredo1');
    expect(tab1.transport.ofType('bye')).toEqual([{ t: 'bye', reason: 'replaced' }]);
    expect(tab1.transport.closed).toEqual([4002]);
    expect(welcome).toMatchObject({ t: 'welcome', you: { level: 4 } });
    expect(tab1.lobby.world.players.size).toBe(1);

    // A sessão antiga fechando depois não pode derrubar a nova.
    tab1.session.disconnect();
    expect(tab1.lobby.world.players.size).toBe(1);
    expect(tab1.lobby.online.size).toBe(1);
  });

  it('errou a senha muitas vezes: precisa esperar uns minutos', async () => {
    const lobby = makeLobby(map, clock, { guard: { failsPerIp: 3, failsPerName: 10, failWindowMs: 60_000, createsPerIp: 10, createWindowMs: 60_000 } });
    const first = connect(lobby);
    await sendHello(first.session, first.transport, 'Ana', 'segredo1');
    first.session.disconnect();
    for (let i = 0; i < 3; i++) {
      const attempt = connect(lobby);
      expect(await sendHello(attempt.session, attempt.transport, 'Ana', `chute-${i}`)).toMatchObject({ reason: 'wrong_password' });
    }
    // Agora nem a senha certa entra (de quem errou tanto)...
    const blocked = connect(lobby);
    expect(await sendHello(blocked.session, blocked.transport, 'Ana', 'segredo1')).toEqual({ t: 'reject', reason: 'too_many_attempts' });
    // ...mas de outro endereço entra, e depois de um tempo também.
    const other = connect(lobby, '10.0.0.2');
    expect((await sendHello(other.session, other.transport, 'Ana', 'segredo1')).t).toBe('welcome');
    other.session.disconnect();
    clock.advance(60_001);
    const later = connect(lobby);
    expect((await sendHello(later.session, later.transport, 'Ana', 'segredo1')).t).toBe('welcome');
  });

  it('limita personagens novos vindos do mesmo endereço', async () => {
    const lobby = makeLobby(map, clock, { guard: { failsPerIp: 10, failsPerName: 10, failWindowMs: 60_000, createsPerIp: 2, createWindowMs: 60_000 } });
    for (const name of ['Ana', 'Beto']) {
      const c = connect(lobby);
      expect((await sendHello(c.session, c.transport, name, 'segredo1')).t).toBe('welcome');
    }
    const third = connect(lobby);
    expect(await sendHello(third.session, third.transport, 'Caio', 'segredo1')).toEqual({ t: 'reject', reason: 'creation_limit' });
  });

  it('quem fecha a aba enquanto a senha é conferida não entra', async () => {
    const a = connect();
    a.session.handle(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name: 'Ana', password: 'segredo1' }));
    a.session.disconnect();
    await vi.waitFor(() => expect(a.lobby.store.count()).toBe(1)); // o personagem foi criado...
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(a.lobby.world.players.size).toBe(0); // ...mas ninguém ficou "fantasma" no mundo
    expect(a.lobby.online.size).toBe(0);
    expect(a.transport.batches).toEqual([]);
  });

  it('jogo antigo (sem senha) fica sabendo que está desatualizado', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'hello', v: 3, name: 'Ana' }))).toEqual({ t: 'hello', v: 3, name: 'Ana', password: '' });
    expect(parseClientMsg(JSON.stringify({ t: 'hello', v: 4, name: 'Ana', password: 5 }))).toBeNull();
    const a = connect();
    a.session.handle(JSON.stringify({ t: 'hello', v: 3, name: 'Ana' }));
    expect(a.transport.batches).toEqual([[{ t: 'reject', reason: 'version' }]]);
  });
});
