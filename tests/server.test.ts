// Teste de ponta a ponta: sobe o servidor de verdade (com o mapa de verdade)
// e conecta dois "jogadores" por WebSocket.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { startServer, type RunningServer } from '../src/server/server';
import { PROTOCOL_VERSION } from '../src/shared/constants';
import { DX, DY, type Dir } from '../src/shared/dir';
import type { ClientMsg, ServerMsg } from '../src/shared/protocol';

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

  close(): void {
    this.ws.close();
  }
}

let server: RunningServer;
beforeAll(async () => {
  server = await startServer({ port: 0, host: '127.0.0.1', log: false });
});
afterAll(async () => {
  await server.close();
});

describe('servidor de verdade', () => {
  it('dois jogadores se veem, andam e conversam', async () => {
    const ana = await TestClient.connect(server.port);
    const beto = await TestClient.connect(server.port);
    ana.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Ana' });
    const anaWelcome = await ana.waitFor('welcome');
    beto.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Beto' });
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

  it('recusa nome repetido', async () => {
    const a = await TestClient.connect(server.port);
    const b = await TestClient.connect(server.port);
    a.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Carla' });
    await a.waitFor('welcome');
    b.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'carla' });
    expect(await b.waitFor('reject')).toEqual({ t: 'reject', reason: 'name_taken' });
    a.close();
    b.close();
  });
});
