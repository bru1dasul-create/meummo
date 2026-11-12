// Bots: jogadores automáticos que andam pela vila e conversam — ou caçam monstros.
// Servem para testar o servidor e para ver o mundo "cheio".
// Eles são personagens salvos como qualquer outro (nome "Bot ...", senha BOT_PASSWORD):
// os caçadores continuam do nível em que pararam.
// Uso: npm run bots -- [quantidade] [endereço] [--cacar]
//      npm run bots -- 10
//      npm run bots -- 6 --cacar                (vão até os monstros e atiram neles)
//      npm run bots -- 30 ws://localhost:3000/ws

import WebSocket from 'ws';
import { loadMap } from '../src/server/server';
import { SHOT_COOLDOWN_MS, PROTOCOL_VERSION, WALK_SLICE_MS } from '../src/shared/constants';
import { angleBetween, chebyshev } from '../src/shared/combat';
import { DX, DY } from '../src/shared/dir';
import type { GameMap, Tile } from '../src/shared/map';
import { degreesToward, footTile } from '../src/shared/movement';
import { findPath } from '../src/shared/pathfind';
import type { ClientMsg, ServerMsg } from '../src/shared/protocol';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const hunting = process.argv.includes('--cacar');
const count = Number(args[0] ?? 8);
const url = args[1] ?? 'ws://localhost:3000/ws';
/** Os mapas já lidos (cada bot usa o do mapa onde está). */
const maps = new Map<string, GameMap>();
function mapFor(id: string): GameMap {
  let map = maps.get(id);
  if (!map) maps.set(id, (map = loadMap(id)));
  return map;
}

/** Senha dos personagens dos bots (qualquer um pode entrar com eles: são só para testes). */
const BOT_PASSWORD = 'bots-do-meummo';
const NAMES = [
  'Aurora', 'Bento', 'Cora', 'Davi', 'Elis', 'Fausto', 'Gaia', 'Heitor', 'Iara', 'Joaquim',
  'Lis', 'Martim', 'Naiara', 'Otávio', 'Pérola', 'Ravi', 'Serena', 'Tomé', 'Valentina', 'Yuri',
];
const PHRASES = [
  'Olá, aventureiros!',
  'Alguém quer explorar a floresta?',
  'Essa represa esconde alguma coisa...',
  'Bora até o rio?',
  'Que dia bonito na vila',
  'Dizem que o Saci mora depois do rio',
  'Cuidado com as jararacas perto do lago!',
  'Quem quer caçar sagui comigo?',
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

/** Um destino aleatório perto da vila (para os bots passeadores não sumirem no mapa). */
function villageTarget(map: GameMap): Tile | null {
  for (let tries = 0; tries < 30; tries++) {
    const x = map.spawn.x + Math.round((Math.random() * 2 - 1) * 12);
    const y = map.spawn.y + Math.round((Math.random() * 2 - 1) * 9);
    if (map.isWalkable(x, y)) return { x, y };
  }
  return null;
}

/** Um ponto livre perto de uma área de monstros (para os caçadores). */
function huntingTarget(map: GameMap): Tile | null {
  const zone = pick(map.monsterZones.filter((z) => z.monster !== 'saci'));
  if (!zone) return villageTarget(map);
  return map.nearestWalkable(zone.x - 3, zone.y + (zone.h >> 1));
}

class Bot {
  private ws!: WebSocket;
  private map = mapFor('refugio');
  private name: string;
  private id = 0;
  x = 0;
  y = 0;
  private ready = false;
  private dead = false;
  private waitingAck = false;
  private seq = 0;
  private cid = 0;
  /** Pontos do caminho (o meio de cada tile até o destino). */
  private path: Tile[] = [];
  private lastStepAt = 0;
  private nextShotAt = 0;
  private restUntil = 0;
  private readonly monsters = new Map<number, Tile>();

  constructor(name: string) {
    this.name = name;
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(url);
    this.ws.on('open', () => this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name, password: BOT_PASSWORD }));
    this.ws.on('message', (data) => {
      for (const msg of JSON.parse(data.toString()) as ServerMsg[]) this.onMessage(msg);
    });
    this.ws.on('error', (err) => console.error(`[${this.name}] erro: ${err.message}`));
  }

  private onMessage(msg: ServerMsg): void {
    switch (msg.t) {
      case 'welcome':
        this.map = mapFor(msg.map);
        this.id = msg.id;
        this.x = msg.you.x;
        this.y = msg.you.y;
        this.ready = true;
        console.log(`bot ${this.name} entrou${hunting ? ' (caçador)' : ''}`);
        break;
      case 'reject':
        // Nome de alguém de verdade (outra senha) ou em uso: tenta com um número no fim.
        if (msg.reason === 'wrong_password' || msg.reason === 'name_taken') {
          this.name = `${this.name.slice(0, 12)}${Math.floor(Math.random() * 90 + 10)}`;
          this.ws.removeAllListeners();
          this.connect();
        } else {
          console.log(`bot ${this.name} recusado: ${msg.reason}`);
        }
        break;
      case 'zone': // foi para outro mapa: troca o mapa e avisa que "carregou"
        this.map = mapFor(msg.map);
        this.x = msg.you.x;
        this.y = msg.you.y;
        this.path = [];
        this.dead = false;
        this.waitingAck = false;
        this.monsters.clear();
        this.send({ t: 'loaded' });
        console.log(`bot ${this.name} foi para o mapa ${msg.map}`);
        break;
      case 'bye':
        console.log(`bot ${this.name} saiu: ${msg.reason === 'replaced' ? 'entraram com ele em outro lugar' : 'servidor desligando'}`);
        break;
      case 'ack':
        this.x = msg.x;
        this.y = msg.y;
        this.waitingAck = false;
        break;
      case 'teleport':
        this.x = msg.x;
        this.y = msg.y;
        this.dead = false;
        this.path = [];
        this.waitingAck = false;
        break;
      case 'spawn':
        if (msg.e.kind === 'monster') this.monsters.set(msg.e.id, { x: msg.e.x, y: msg.e.y });
        break;
      case 'move':
        if (this.monsters.has(msg.id)) this.monsters.set(msg.id, { x: msg.x, y: msg.y });
        break;
      case 'despawn':
        this.monsters.delete(msg.id);
        break;
      case 'death':
        if (msg.id === this.id) {
          this.dead = true;
          console.log(`bot ${this.name} desmaiou`);
        }
        this.monsters.delete(msg.id);
        break;
      case 'levelup':
        if (msg.id === this.id) console.log(`bot ${this.name} chegou ao nível ${msg.level}`);
        break;
    }
  }

  tick(now: number): void {
    if (!this.ready || this.dead) return;
    if (hunting && this.fight(now)) return;
    if (this.waitingAck || now < this.restUntil || now - this.lastStepAt < WALK_SLICE_MS) return;
    // anda solto, como gente: um pedaço de caminhada por vez, mirando no próximo ponto do caminho
    while (this.path.length > 0 && Math.hypot(this.path[0]!.x - this.x, this.path[0]!.y - this.y) <= 0.3) this.path.shift();
    if (this.path.length === 0) {
      if (!hunting && Math.random() < 0.3) {
        this.restUntil = now + 1000 + Math.random() * 3000; // para um pouquinho
        return;
      }
      const target = hunting ? (this.nearestMonsterSpot() ?? huntingTarget(this.map)) : villageTarget(this.map);
      let { x, y } = footTile(this.x, this.y);
      const dirs = (target && findPath(this.map, x, y, target.x, target.y, 20000)) || [];
      this.path = dirs.map((dir) => {
        x += DX[dir];
        y += DY[dir];
        return { x, y };
      });
      return;
    }
    const next = this.path[0]!;
    this.send({ t: 'walk', seq: ++this.seq, a: degreesToward(this.x, this.y, next.x, next.y) });
    this.waitingAck = true;
    this.lastStepAt = now;
    if (Math.random() < 0.006) this.send({ t: 'chat', text: pick(PHRASES) });
  }

  /** Caçador: se tem monstro perto, para e atira nele. */
  private fight(now: number): boolean {
    let best: Tile | null = null;
    let bestDistance = 6;
    for (const monster of this.monsters.values()) {
      const distance = chebyshev(monster, this);
      if (distance <= bestDistance) {
        best = monster;
        bestDistance = distance;
      }
    }
    if (!best) return false;
    this.path = [];
    if (now >= this.nextShotAt) {
      this.nextShotAt = now + SHOT_COOLDOWN_MS + 50 + Math.random() * 200;
      this.send({ t: 'shoot', cid: ++this.cid, a: angleBetween(this, best) });
    }
    return true;
  }

  private nearestMonsterSpot(): Tile | null {
    let best: Tile | null = null;
    let bestDistance = Infinity;
    for (const monster of this.monsters.values()) {
      const distance = chebyshev(monster, this);
      if (distance < bestDistance) {
        best = monster;
        bestDistance = distance;
      }
    }
    return best ? this.map.nearestWalkable(best.x - 4, best.y) : null;
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws.close();
  }
}

// Passeadores usam os nomes do começo da lista e caçadores os do fim: dá para rodar os dois juntos.
const botName = (i: number) =>
  i < NAMES.length ? `Bot ${NAMES[hunting ? NAMES.length - 1 - i : i]}` : `Bot ${pick(NAMES).slice(0, 8)}${i}`;
const bots = Array.from({ length: count }, (_, i) => new Bot(botName(i)));
const timer = setInterval(() => {
  const now = performance.now();
  for (const bot of bots) bot.tick(now);
}, 25);

console.log(`${count} bots ${hunting ? 'caçadores ' : ''}conectando em ${url} (Ctrl+C para parar)`);
process.on('SIGINT', () => {
  clearInterval(timer);
  for (const bot of bots) bot.close();
  setTimeout(() => process.exit(0), 200);
});
