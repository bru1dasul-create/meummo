// O mundo do jogo: quem está conectado, onde cada um está e o que cada um enxerga.
// Roda TICK_RATE vezes por segundo (veja server.ts). Nada aqui sabe de WebSocket —
// isso deixa o mundo fácil de testar com conexões falsas.

import {
  MAX_PLAYERS,
  MAX_QUEUED_STEPS,
  STEP_MS,
  STEP_TOLERANCE_MS,
  TICK_MS,
  VIEW_HYSTERESIS,
  VIEW_RADIUS_X,
  VIEW_RADIUS_Y,
} from '../shared/constants';
import { DOWN, type Dir } from '../shared/dir';
import { lookFromName } from '../shared/look';
import type { GameMap } from '../shared/map';
import { applyStep, nextStepTime } from '../shared/movement';
import { nameProblem, normalizeName } from '../shared/names';
import type { EntityState, RejectReason, ServerMsg } from '../shared/protocol';
import { TokenBucket } from './rate-limit';
import { sanitizeChat } from './validate';

/** Como o mundo envia mensagens para um jogador. */
export interface Conn {
  send(batch: ServerMsg[]): void;
}

export class Player {
  x: number;
  y: number;
  dir: Dir = DOWN;
  readonly look: number;
  /** Ids de quem este jogador está vendo agora. */
  readonly known = new Set<number>();
  /** Passos pedidos e ainda não processados (o servidor anda no ritmo dele, não no do cliente). */
  readonly queue: { seq: number; dir: Dir }[] = [];
  /** Momento em que o próximo passo fica liberado. */
  nextStepAt = 0;
  /** Maior número de pedido recebido (ignora pedidos repetidos ou fora de ordem). */
  lastSeq = -1;
  /** Último pedido processado — o cliente usa isso para conferir a própria previsão. */
  ackSeq = -1;
  ackPending = false;
  /** Andou ou virou neste tick (os outros precisam saber). */
  changed = false;
  outbox: ServerMsg[] = [];
  readonly chatLimit: TokenBucket;

  constructor(
    readonly id: number,
    readonly name: string,
    x: number,
    y: number,
    readonly conn: Conn,
    now: number,
  ) {
    this.x = x;
    this.y = y;
    this.look = lookFromName(name);
    // Até 4 mensagens seguidas; depois, uma a cada ~1,3 s.
    this.chatLimit = new TokenBucket(4, 0.75, now);
  }

  state(): EntityState {
    return { id: this.id, name: this.name, x: this.x, y: this.y, dir: this.dir, look: this.look };
  }
}

export type JoinResult = { ok: true; player: Player } | { ok: false; reason: RejectReason };

export interface WorldOptions {
  /** Relógio em milissegundos (nos testes usamos um relógio falso). */
  now?: () => number;
  random?: () => number;
  log?: (message: string) => void;
}

export class World {
  readonly players = new Map<number, Player>();
  private nextId = 1;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly log: (message: string) => void;

  constructor(
    readonly map: GameMap,
    options: WorldOptions = {},
  ) {
    this.now = options.now ?? (() => performance.now());
    this.random = options.random ?? Math.random;
    this.log = options.log ?? (() => {});
  }

  join(rawName: string, conn: Conn): JoinResult {
    const name = normalizeName(rawName);
    if (nameProblem(name)) return { ok: false, reason: 'name_invalid' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, reason: 'full' };
    const key = name.toLocaleLowerCase('pt-BR');
    for (const other of this.players.values()) {
      if (other.name.toLocaleLowerCase('pt-BR') === key) return { ok: false, reason: 'name_taken' };
    }

    const spot = this.pickSpawnTile();
    const player = new Player(this.nextId++, name, spot.x, spot.y, conn, this.now());
    this.players.set(player.id, player);
    // As boas-vindas vão na hora; quem está por perto chega no próximo tick.
    conn.send([
      { t: 'welcome', id: player.id, you: player.state(), stepMs: STEP_MS, online: this.players.size },
      { t: 'sys', text: `Bem-vindo(a) ao mundo, ${name}!` },
    ]);
    this.broadcast({ t: 'sys', text: `${name} entrou no mundo.` }, player.id);
    this.broadcast({ t: 'online', n: this.players.size });
    this.log(`entrou: ${name} (online: ${this.players.size})`);
    return { ok: true, player };
  }

  leave(player: Player): void {
    if (!this.players.delete(player.id)) return;
    for (const other of this.players.values()) {
      if (other.known.delete(player.id)) other.outbox.push({ t: 'despawn', id: player.id });
    }
    this.broadcast({ t: 'sys', text: `${player.name} saiu.` });
    this.broadcast({ t: 'online', n: this.players.size });
    this.log(`saiu: ${player.name} (online: ${this.players.size})`);
  }

  /** O cliente pediu para andar. O passo entra na fila e é processado no ritmo certo, no tick. */
  requestStep(player: Player, seq: number, dir: Dir): void {
    if (seq <= player.lastSeq) return;
    player.lastSeq = seq;
    if (player.queue.length >= MAX_QUEUED_STEPS) {
      // Passos demais de uma vez (bug ou trapaça): descarta a fila e manda o cliente se corrigir.
      player.queue.length = 0;
      player.ackSeq = seq;
      player.ackPending = true;
      return;
    }
    player.queue.push({ seq, dir });
  }

  chat(player: Player, raw: string): void {
    const text = sanitizeChat(raw);
    if (!text) return;
    if (!player.chatLimit.take(this.now())) {
      player.outbox.push({ t: 'sys', text: 'Calma! Você está mandando mensagens rápido demais.' });
      return;
    }
    this.broadcast({ t: 'chat', id: player.id, name: player.name, text });
  }

  /** Um "batimento" do mundo: move todo mundo, atualiza o que cada um vê e envia os pacotes. */
  tick(): void {
    const now = this.now();
    for (const player of this.players.values()) this.processSteps(player, now);
    for (const player of this.players.values()) this.updateView(player);
    for (const player of this.players.values()) {
      if (player.ackPending) {
        player.outbox.push({ t: 'ack', seq: player.ackSeq, x: player.x, y: player.y, dir: player.dir });
        player.ackPending = false;
      }
    }
    for (const player of this.players.values()) {
      player.changed = false;
      if (player.outbox.length > 0) {
        player.conn.send(player.outbox);
        player.outbox = [];
      }
    }
  }

  private processSteps(player: Player, now: number): void {
    while (player.queue.length > 0 && now >= player.nextStepAt - STEP_TOLERANCE_MS) {
      const step = player.queue.shift()!;
      const result = applyStep(this.map, player, step.dir);
      // Virar contra uma parede não gasta tempo; andar gasta um passo inteiro.
      if (result.moved) player.nextStepAt = nextStepTime(now, player.nextStepAt, STEP_MS, TICK_MS);
      if (result.moved || result.dir !== player.dir) player.changed = true;
      player.x = result.x;
      player.y = result.y;
      player.dir = result.dir;
      player.ackSeq = step.seq;
      player.ackPending = true;
    }
  }

  /** Área de visão: cada jogador só recebe notícias de quem está perto dele. */
  private updateView(player: Player): void {
    for (const other of this.players.values()) {
      if (other === player) continue;
      const dx = Math.abs(other.x - player.x);
      const dy = Math.abs(other.y - player.y);
      if (player.known.has(other.id)) {
        if (dx > VIEW_RADIUS_X + VIEW_HYSTERESIS || dy > VIEW_RADIUS_Y + VIEW_HYSTERESIS) {
          player.known.delete(other.id);
          player.outbox.push({ t: 'despawn', id: other.id });
        } else if (other.changed) {
          player.outbox.push({ t: 'move', id: other.id, x: other.x, y: other.y, dir: other.dir });
        }
      } else if (dx <= VIEW_RADIUS_X && dy <= VIEW_RADIUS_Y) {
        player.known.add(other.id);
        player.outbox.push({ t: 'spawn', e: other.state() });
      }
    }
  }

  private broadcast(msg: ServerMsg, exceptId?: number): void {
    for (const player of this.players.values()) {
      if (player.id !== exceptId) player.outbox.push(msg);
    }
  }

  /** Espalha quem nasce para não ficar todo mundo empilhado no mesmo tile. */
  private pickSpawnTile(): { x: number; y: number } {
    const options = this.map.walkableAround(this.map.spawn.x, this.map.spawn.y, 2);
    return options[Math.floor(this.random() * options.length)] ?? this.map.spawn;
  }
}
