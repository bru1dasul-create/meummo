// Uma conexão de um navegador: cuida do login e repassa os pedidos para o mundo.

import { PROTOCOL_VERSION } from '../shared/constants';
import type { RejectReason, ServerMsg } from '../shared/protocol';
import { TokenBucket } from './rate-limit';
import { parseClientMsg } from './validate';
import type { Player, World } from './world';

/** O canal "cru" (no servidor real, um WebSocket). */
export interface Transport {
  send(data: string): void;
  close(code: number, reason: string): void;
}

/** Quantas mensagens ruins (inválidas ou em excesso) toleramos antes de desconectar. */
const MAX_STRIKES = 20;

export class Session {
  private player: Player | null = null;
  private readonly limiter: TokenBucket;
  private strikes = 0;
  private closed = false;

  constructor(
    private readonly world: World,
    private readonly transport: Transport,
    private readonly now: () => number = () => performance.now(),
  ) {
    // Até 30 mensagens de uma vez, 15 por segundo em média (andar usa ~5/s).
    this.limiter = new TokenBucket(30, 15, now());
  }

  get playerName(): string | null {
    return this.player?.name ?? null;
  }

  handle(raw: string): void {
    if (this.closed) return;
    if (!this.limiter.take(this.now())) return this.strike('mensagens demais');
    const msg = parseClientMsg(raw);
    if (!msg) return this.strike('mensagem inválida');

    if (!this.player) {
      if (msg.t !== 'hello') return this.strike('precisa entrar primeiro');
      if (msg.v !== PROTOCOL_VERSION) return this.reject('version');
      const result = this.world.join(msg.name, { send: (batch) => this.sendBatch(batch) });
      if (!result.ok) return this.reject(result.reason);
      this.player = result.player;
      return;
    }

    switch (msg.t) {
      case 'step':
        this.world.requestStep(this.player, msg.seq, msg.dir);
        break;
      case 'chat':
        this.world.chat(this.player, msg.text);
        break;
      case 'ping':
        this.sendBatch([{ t: 'pong', id: msg.id }]);
        break;
      case 'hello':
        break; // já entrou
    }
  }

  /** A conexão caiu ou foi fechada. */
  disconnect(): void {
    this.closed = true;
    if (this.player) this.world.leave(this.player);
    this.player = null;
  }

  private sendBatch(batch: ServerMsg[]): void {
    if (!this.closed) this.transport.send(JSON.stringify(batch));
  }

  private reject(reason: RejectReason): void {
    this.sendBatch([{ t: 'reject', reason }]);
    this.close(4000, reason);
  }

  private strike(why: string): void {
    if (++this.strikes > MAX_STRIKES) this.close(4001, why);
  }

  private close(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.transport.close(code, reason);
  }
}
