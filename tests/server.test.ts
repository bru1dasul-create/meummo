// Teste de ponta a ponta: sobe o servidor de verdade (com o mapa de verdade)
// e conecta dois "jogadores" por WebSocket.

import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { CharacterStore } from '../src/server/accounts';
import { startServer, type RunningServer } from '../src/server/server';
import { PROTOCOL_VERSION } from '../src/shared/constants';
import { DX, DY, type Dir } from '../src/shared/dir';
import type { ClientMsg, ServerMsg } from '../src/shared/protocol';
import { FAST_HASH } from './helpers';

class TestClient {
  readonly received: ServerMsg[] = [];
  private waiters: { match: (m: ServerMsg) => boolean; resolve: (m: ServerMsg) => void }[] = [];

  private constructor(private readonly ws: WebSocket) {
    ws.on('message', (data) => {
      for (const msg of JSON.parse(data.toString()) as ServerMsg[]) {
        this.received.push(msg);
        this.waiters = this.waiters.filter((w) => (w.match(msg) ? (w.resolve(msg), false) : true));
      }
    });
  }

  static async connect(port: number): Promise<TestClient> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise((resolve, reject) => ws.once('open', resolve).once('error', reject));
    return new TestClient(ws);
  }

  send(msg: ClientMsg): void {
    this.ws.send(JSON.stringify(msg));
  }

  waitFor<T extends ServerMsg['t']>(t: T, match: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true, timeoutMs = 2000) {
    const test = (m: ServerMsg) => m.t === t && match(m as Extract<ServerMsg, { t: T }>);
    const found = this.received.find(test);
    if (found) return Promise.resolve(found as Extract<ServerMsg, { t: T }>);
    return new Promise<Extract<ServerMsg, { t: T }>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`não chegou mensagem "${t}"`)), timeoutMs);
      this.waiters.push({ match: test, resolve: (m) => (clearTimeout(timer), resolve(m as Extract<ServerMsg, { t: T }>)) });
    });
  }

  hello(name: string, password = 'segredo1'): void {
    this.send({ t: 'hello', v: PROTOCOL_VERSION, name, password });
  }

  close(): void {
    this.ws.close();
  }
}

const testServer = (saveFile = ':memory:') => startServer({ port: 0, host: '127.0.0.1', log: false, saveFile, hashCost: FAST_HASH });

let server: RunningServer;
beforeAll(async () => {
  server = await testServer();
});
afterAll(async () => {
  await server.close();
});

describe('servidor de verdade', () => {
  it('dois jogadores se veem, andam e conversam', async () => {
    const ana = await TestClient.connect(server.port);
    const beto = await TestClient.connect(server.port);
    ana.hello('Ana');
    const anaWelcome = await ana.waitFor('welcome');
    beto.hello('Beto');
    const betoWelcome = await beto.waitFor('welcome');

    await ana.waitFor('spawn', (m) => m.e.id === betoWelcome.id);
    await beto.waitFor('spawn', (m) => m.e.id === anaWelcome.id);

    // Ana anda para algum lado livre; Beto precisa ver o movimento.
    const map = server.world.map;
    const { x, y } = anaWelcome.you;
    const dir = ([0, 1, 2, 3] as Dir[]).find((d) => map.isWalkable(x + DX[d], y + DY[d]))!;
    ana.send({ t: 'step', seq: 1, dir });
    const ack = await ana.waitFor('ack', (m) => m.seq === 1);
    expect([ack.x, ack.y]).toEqual([x + DX[dir], y + DY[dir]]);
    await beto.waitFor('move', (m) => m.id === anaWelcome.id && m.x === ack.x && m.y === ack.y);

    ana.send({ t: 'chat', text: 'Olá, Beto!' });
    const chat = await beto.waitFor('chat');
    expect(chat).toEqual({ t: 'chat', id: anaWelcome.id, name: 'Ana', text: 'Olá, Beto!' });

    ana.close();
    await beto.waitFor('despawn', (m) => m.id === anaWelcome.id);
    beto.close();
  });

  it('mesmo nome com outra senha é recusado; com a senha certa, a aba antiga sai', async () => {
    const a = await TestClient.connect(server.port);
    a.hello('Carla');
    await a.waitFor('welcome');

    const intruder = await TestClient.connect(server.port);
    intruder.hello('carla', 'nao-sei-a-senha');
    expect(await intruder.waitFor('reject')).toEqual({ t: 'reject', reason: 'wrong_password' });

    const b = await TestClient.connect(server.port);
    b.hello('carla');
    const welcome = await b.waitFor('welcome');
    expect(welcome.you.name).toBe('Carla');
    expect(await a.waitFor('bye')).toEqual({ t: 'bye', reason: 'replaced' });
    a.close();
    b.close();
    intruder.close();
  });
});

describe('progresso salvo de verdade (arquivo)', () => {
  it('desligar o servidor salva todo mundo, e na volta o personagem continua igual', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'meummo-servidor-'));
    const file = path.join(dir, 'meummo.db');
    try {
      const first = await testServer(file);
      const dani = await TestClient.connect(first.port);
      dani.hello('Dani');
      const welcome = await dani.waitFor('welcome');
      const player = first.world.players.get(welcome.id)!;
      player.level = 5;
      player.xp = 42;
      await first.close();
      expect(await dani.waitFor('bye')).toEqual({ t: 'bye', reason: 'shutdown' });

      const store = new CharacterStore(file, { cost: FAST_HASH });
      const login = await store.login('Dani', 'segredo1');
      expect(login).toMatchObject({ ok: true, created: false });
      expect(store.load(login.ok ? login.id : -1)).toMatchObject({ name: 'Dani', level: 5, xp: 42, x: welcome.you.x, y: welcome.you.y });
      store.close();

      const second = await testServer(file);
      const again = await TestClient.connect(second.port);
      again.hello('dani');
      expect(await again.waitFor('welcome')).toMatchObject({ you: { name: 'Dani', level: 5 }, stats: { xp: 42 } });
      again.close();
      await second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
