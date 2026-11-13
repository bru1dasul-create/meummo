// Poderes do administrador (menu ADM no jogo): só quem foi marcado no painel; criar monstros (não renascem), derrubar
// os de perto, voar (atravessa tudo e anda rápido), invencível, ir até um ponto e curar. Tudo conferido no servidor.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterStore } from '../src/server/accounts';
import type { MonsterDef } from '../src/server/monsters';
import { startServer, type RunningServer } from '../src/server/server';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { GM_FLY_FACTOR, GM_SPAWN_MAX, PROTOCOL_VERSION, STEP_MS, TICK_MS } from '../src/shared/constants';
import { GameMap, type TiledObject } from '../src/shared/map';
import { bodyFits, sliceDistance } from '../src/shared/movement';
import { FAST_HASH, FakeClock, FakeConn } from './helpers';

const PX = 32;

/** Mapa do formato novo, aberto, com uma parede de x = 12 a 13. */
function metricMap(): GameMap {
  const spawn: TiledObject = { id: 0, name: 'spawn', x: 8 * PX, y: 5 * PX, point: true };
  const wall: TiledObject = { id: 1, x: 12 * PX, y: 0, width: PX, height: 12 * PX };
  return GameMap.fromTiled(
    {
      width: 30,
      height: 12,
      tilewidth: PX,
      tileheight: PX,
      orientation: 'orthogonal',
      properties: [{ name: 'nome', type: 'string', value: 'Teste' }],
      tilesets: [],
      layers: [
        { type: 'objectgroup', name: 'colisao', objects: [wall] },
        { type: 'objectgroup', name: 'pontos', objects: [spawn] },
      ],
    },
    'teste',
  );
}

const bicho: MonsterDef = {
  id: 'bicho',
  name: 'Bicho',
  level: 1,
  hp: 10,
  xp: 7,
  stepMs: 400,
  aggressive: true,
  aggroRange: 6,
  chaseRange: 8,
  respawnMs: 1000,
  attack: { kind: 'bite', range: 1, minDistance: 0, windupMs: 300, intervalMs: 1000, damage: [3, 3], speed: 8, projectile: 'pedra', fire: null, pushCm: 0 },
  whirlwind: null,
  song: null,
  drops: [],
  gold: [0, 0],
};

function setup(admin = true) {
  const clock = new FakeClock();
  const world = new World(metricMap(), { now: clock.now, random: () => 0.5, monsters: new Map([['bicho', bicho]]) });
  const conn = new FakeConn();
  const character = { id: 1, name: 'Ana', level: 1, xp: 0, hp: null, zone: null, x: null, y: null, dir: 2 as const, look: 1, inventory: null, admin };
  const joined = world.join('Ana', conn, { character, created: false });
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  return { world, clock, conn, player, run };
}

const madeMonsters = (world: World) => [...world.monsters.values()].filter((m) => m.zone.temporary);

describe('poderes do administrador', () => {
  it('quem não é administrador não consegue (e recebe o estado só se for)', () => {
    const { world, conn, player } = setup(false);
    expect(conn.ofType('gm')).toHaveLength(0);
    world.gm(player, { do: 'spawn', monster: 'bicho', n: 3 });
    world.gm(player, { do: 'fly', on: true });
    expect(world.monsters.size).toBe(0);
    expect(player.fly).toBe(false);
    const admin = setup(true);
    expect(admin.conn.ofType('gm')[0]).toMatchObject({ admin: true, fly: false, god: false, monsters: [{ id: 'bicho', name: 'Bicho' }] });
  });

  it('cria monstros em volta (no máximo 10 por vez) e eles não renascem', () => {
    const { world, player, run } = setup();
    world.gm(player, { do: 'spawn', monster: 'bicho', n: 3 });
    expect(madeMonsters(world)).toHaveLength(3);
    for (const m of madeMonsters(world)) expect(Math.max(Math.abs(m.x - player.x), Math.abs(m.y - player.y))).toBeLessThanOrEqual(2);
    world.gm(player, { do: 'spawn', monster: 'bicho', n: 99 });
    expect(madeMonsters(world).length).toBeLessThanOrEqual(3 + GM_SPAWN_MAX);
    world.gm(player, { do: 'god', on: true }); // para os bichos não atrapalharem a conta
    world.gm(player, { do: 'clear' });
    expect(world.monsters.size).toBe(0);
    run(5000); // passou o tempo de renascer: os criados não voltam
    expect(world.monsters.size).toBe(0);
    world.gm(player, { do: 'spawn', monster: 'naoexiste', n: 1 });
    expect(world.monsters.size).toBe(0);
  });

  it('derrubar monstros perto dá a XP para o administrador', () => {
    const { world, player } = setup();
    world.gm(player, { do: 'spawn', monster: 'bicho', n: 2 });
    const xp = player.xp;
    world.gm(player, { do: 'clear' });
    expect(world.monsters.size).toBe(0);
    expect(player.xp).toBe(xp + 2 * bicho.xp);
  });

  it('voando atravessa a parede e anda 2,5 vezes o correr; pousar dentro dela leva para o chão livre', () => {
    const { world, conn, player, run } = setup();
    const step = (seq: number) => {
      const x = player.fx;
      world.requestWalk(player, seq, 0);
      run(TICK_MS);
      return player.fx - x;
    };
    // a pé, para na parede (x = 12)
    let seq = 1;
    for (; seq < 40; seq++) step(seq);
    const wallX = player.fx;
    expect(wallX).toBeLessThan(12);
    world.gm(player, { do: 'fly', on: true });
    expect(step(seq++)).toBeCloseTo(sliceDistance(true, false, STEP_MS) * GM_FLY_FACTOR);
    // atravessa: chega dentro da parede e passa
    while (player.fx < 12.3) step(seq++);
    expect(bodyFits(world.map, player.fx, player.fy)).toBe(false); // está dentro da parede
    world.gm(player, { do: 'fly', on: false });
    expect(bodyFits(world.map, player.fx, player.fy)).toBe(true); // foi para o chão livre
    run(TICK_MS);
    expect(conn.ofType('teleport').length).toBeGreaterThan(0);
  });

  it('invencível: não leva dano e os monstros não notam', () => {
    const { world, player, run } = setup();
    world.gm(player, { do: 'god', on: true });
    world.gm(player, { do: 'spawn', monster: 'bicho', n: 2 });
    const hp = player.hp;
    (world as unknown as { damage(t: Player, a: number, by: number, now: number): void }).damage(player, 50, 0, 0);
    run(4000);
    expect(player.hp).toBe(hp);
    for (const m of world.monsters.values()) expect(m.targetId).toBeNull();
  });

  it('vai até um ponto (o pé), ou o chão livre mais perto; e cura', () => {
    const { world, player } = setup();
    world.gm(player, { do: 'tp', x: 20.5, y: 6 });
    expect(player.fx + 0.5).toBeCloseTo(20.5);
    world.gm(player, { do: 'tp', x: 12.5, y: 6 }); // dentro da parede: vai para o lado
    expect(bodyFits(world.map, player.fx, player.fy)).toBe(true);
    player.hp = 5;
    world.gm(player, { do: 'heal' });
    expect(player.hp).toBe(player.maxHp);
  });

  it('as mensagens passam pela conferência', () => {
    const msg = (cmd: unknown) => parseClientMsg(JSON.stringify({ t: 'gm', cmd }));
    expect(msg({ do: 'spawn', monster: 'sagui', n: 3 })).toEqual({ t: 'gm', cmd: { do: 'spawn', monster: 'sagui', n: 3 } });
    expect(msg({ do: 'fly', on: true })).toEqual({ t: 'gm', cmd: { do: 'fly', on: true } });
    expect(msg({ do: 'tp', x: 10.5, y: 3 })).toEqual({ t: 'gm', cmd: { do: 'tp', x: 10.5, y: 3 } });
    expect(msg({ do: 'clear' })).toEqual({ t: 'gm', cmd: { do: 'clear' } });
    expect(msg({ do: 'spawn', monster: 'sagui', n: 0 })).toBeNull();
    expect(msg({ do: 'fly', on: 'sim' })).toBeNull();
    expect(msg({ do: 'tp', x: 'a', y: 3 })).toBeNull();
    expect(msg({ do: 'banir' })).toBeNull();
  });
});

describe('quem é administrador (salvo e pelo painel)', () => {
  it('fica salvo no personagem', async () => {
    const store = new CharacterStore(':memory:', { cost: FAST_HASH });
    const login = await store.login('Ana', 'segredo1');
    if (!login.ok) throw new Error('não criou');
    expect(store.load(login.id)!.admin).toBe(false);
    expect(store.setAdmin('ana', true)).toBe('Ana');
    expect(store.load(login.id)!.admin).toBe(true);
    expect(store.admins()).toEqual(['Ana']);
    expect(store.setAdmin('Ninguem', true)).toBeNull();
    store.setAdmin('Ana', false);
    expect(store.admins()).toEqual([]);
    store.close();
  });

  describe('com o servidor de verdade', () => {
    let server: RunningServer;
    beforeEach(async () => {
      server = await startServer({ port: 0, host: '127.0.0.1', log: false, saveFile: ':memory:', hashCost: FAST_HASH });
    });
    afterEach(() => server.close());

    it('o painel marca o administrador e, se ele está jogando, o menu aparece na hora', async () => {
      const { default: WebSocket } = await import('ws');
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
      const received: { t: string; admin?: boolean }[] = [];
      ws.on('message', (data) => received.push(...(JSON.parse(data.toString()) as { t: string }[])));
      await new Promise((resolve, reject) => ws.once('open', resolve).once('error', reject));
      ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name: 'Ana', password: 'segredo1' }));
      await vi.waitFor(() => expect(received.some((m) => m.t === 'welcome')).toBe(true), { timeout: 3000 });
      expect(received.some((m) => m.t === 'gm')).toBe(false);

      const base = `http://127.0.0.1:${server.port}`;
      const headers = { 'content-type': 'application/json', 'x-meummo-admin': '1' };
      const res = await fetch(`${base}/admin/api/adm`, { method: 'POST', headers, body: JSON.stringify({ nome: 'ana', admin: true }) });
      expect(await res.json()).toMatchObject({ ok: true });
      await vi.waitFor(() => expect(received.some((m) => m.t === 'gm' && m.admin === true)).toBe(true), { timeout: 3000 });
      const list = (await (await fetch(`${base}/admin/api/jogadores`)).json()) as { administradores: string[] };
      expect(list.administradores).toEqual(['Ana']);

      const unknown = await fetch(`${base}/admin/api/adm`, { method: 'POST', headers, body: JSON.stringify({ nome: 'Ninguem', admin: true }) });
      expect(unknown.status).toBe(400);
      const noHeader = await fetch(`${base}/admin/api/adm`, { method: 'POST', body: JSON.stringify({ nome: 'Ana', admin: false }) });
      expect(noHeader.status).toBe(403);
      ws.close();
    });
  });
});
