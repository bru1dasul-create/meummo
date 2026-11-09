// Bots: jogadores automáticos que andam pela vila e conversam.
// Servem para testar o servidor e para ver o mundo "cheio".
// Uso: npm run bots -- [quantidade] [endereço]
//      npm run bots -- 10
//      npm run bots -- 30 ws://localhost:3000/ws

import WebSocket from 'ws';
import { loadMap } from '../src/server/server';
import { PROTOCOL_VERSION, STEP_MS } from '../src/shared/constants';
import type { Dir } from '../src/shared/dir';
import type { Tile } from '../src/shared/map';
import { findPath } from '../src/shared/pathfind';
import type { ClientMsg, ServerMsg } from '../src/shared/protocol';

const count = Number(process.argv[2] ?? 8);
const url = process.argv[3] ?? 'ws://localhost:3000/ws';
const map = loadMap();

const NAMES = [
  'Aurora', 'Bento', 'Cora', 'Davi', 'Elis', 'Fausto', 'Gaia', 'Heitor', 'Iara', 'Joaquim',
  'Lis', 'Martim', 'Naiara', 'Otávio', 'Pérola', 'Ravi', 'Serena', 'Tomé', 'Valentina', 'Yuri',
];
const PHRASES = [
  'Olá, aventureiros!',
  'Alguém quer explorar a floresta?',
  'Esse poço parece mágico...',
  'Bora até o rio?',
  'Que dia bonito na vila',
  'Vi umas pedras estranhas no norte',
  'Quem chegou agora?',
  'Partiu lago!',
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

/** Um destino aleatório perto da vila (para os bots não sumirem no mapa). */
function randomTarget(): Tile | null {
  for (let tries = 0; tries < 30; tries++) {
    const x = map.spawn.x + Math.round((Math.random() * 2 - 1) * 12);
    const y = map.spawn.y + Math.round((Math.random() * 2 - 1) * 9);
    if (map.isWalkable(x, y)) return { x, y };
  }
  return null;
}

class Bot {
  private ws!: WebSocket;
  private name: string;
  private x = 0;
  private y = 0;
  private ready = false;
  private waitingAck = false;
  private seq = 0;
  private path: Dir[] = [];
  private lastStepAt = 0;
  private restUntil = 0;

  constructor(name: string) {
    this.name = name;
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(url);
    this.ws.on('open', () => this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name }));
    this.ws.on('message', (data) => {
      for (const msg of JSON.parse(data.toString()) as ServerMsg[]) this.onMessage(msg);
    });
    this.ws.on('error', (err) => console.error(`[${this.name}] erro: ${err.message}`));
  }

  private onMessage(msg: ServerMsg): void {
    if (msg.t === 'welcome') {
      this.x = msg.you.x;
      this.y = msg.you.y;
      this.ready = true;
      console.log(`bot ${this.name} entrou`);
    } else if (msg.t === 'reject') {
      if (msg.reason === 'name_taken') {
        this.name = `${this.name.slice(0, 12)}${Math.floor(Math.random() * 90 + 10)}`;
        this.ws.removeAllListeners();
        this.connect();
      } else {
        console.log(`bot ${this.name} recusado: ${msg.reason}`);
      }
    } else if (msg.t === 'ack') {
      this.x = msg.x;
      this.y = msg.y;
      this.waitingAck = false;
    }
  }

  tick(now: number): void {
    if (!this.ready || this.waitingAck || now < this.restUntil || now - this.lastStepAt < STEP_MS) return;
    if (this.path.length === 0) {
      if (Math.random() < 0.3) {
        this.restUntil = now + 1000 + Math.random() * 3000; // para um pouquinho
        return;
      }
      const target = randomTarget();
      this.path = (target && findPath(map, this.x, this.y, target.x, target.y)) || [];
      return;
    }
    this.send({ t: 'step', seq: ++this.seq, dir: this.path.shift()! });
    this.waitingAck = true;
    this.lastStepAt = now;
    if (Math.random() < 0.006) this.send({ t: 'chat', text: pick(PHRASES) });
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws.close();
  }
}

const bots = Array.from({ length: count }, (_, i) => new Bot(i < NAMES.length ? NAMES[i]! : `${pick(NAMES)}${i}`));
const timer = setInterval(() => {
  const now = performance.now();
  for (const bot of bots) bot.tick(now);
}, 25);

console.log(`${count} bots conectando em ${url} (Ctrl+C para parar)`);
process.on('SIGINT', () => {
  clearInterval(timer);
  for (const bot of bots) bot.close();
  setTimeout(() => process.exit(0), 200);
});
