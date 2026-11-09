// Conexão com o servidor (WebSocket).

import { PROTOCOL_VERSION } from '../shared/constants';
import type { ClientMsg, RejectReason, ServerMsg, WelcomeMsg } from '../shared/protocol';

export type JoinFailure = RejectReason | 'offline' | 'timeout';

export class JoinError extends Error {
  constructor(readonly reason: JoinFailure) {
    super(reason);
  }
}

type Handler = (msg: ServerMsg) => void;

export class Connection {
  /** Quem trata as mensagens. Enquanto ninguém escuta, elas ficam guardadas. */
  private handler: Handler | null = null;
  private buffer: ServerMsg[] = [];
  onClose: (() => void) | null = null;

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (event) => {
      let batch: unknown;
      try {
        batch = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!Array.isArray(batch)) return;
      for (const msg of batch as ServerMsg[]) {
        if (this.handler) this.handler(msg);
        else this.buffer.push(msg);
      }
    });
    ws.addEventListener('close', () => this.onClose?.());
  }

  static defaultUrl(): string {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/ws`;
  }

  /** Conecta e entra no mundo com o nome escolhido. */
  static join(name: string, url = Connection.defaultUrl(), timeoutMs = 8000): Promise<{ conn: Connection; welcome: WelcomeMsg }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const conn = new Connection(ws);
      let done = false;
      const finish = (error: JoinError | null, welcome?: WelcomeMsg) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (error) {
          conn.handler = null;
          ws.close();
          reject(error);
        } else {
          resolve({ conn, welcome: welcome! });
        }
      };
      const timer = setTimeout(() => finish(new JoinError('timeout')), timeoutMs);
      conn.handler = (msg) => {
        if (msg.t === 'welcome') {
          conn.handler = null; // o resto fica guardado até o jogo começar a escutar
          finish(null, msg);
        } else if (msg.t === 'reject') {
          finish(new JoinError(msg.reason));
        }
      };
      ws.addEventListener('open', () => conn.send({ t: 'hello', v: PROTOCOL_VERSION, name }));
      ws.addEventListener('error', () => finish(new JoinError('offline')));
      ws.addEventListener('close', () => finish(new JoinError('offline')));
    });
  }

  /** Começa a receber mensagens (inclusive as que chegaram antes). */
  listen(handler: Handler): void {
    this.handler = handler;
    const pending = this.buffer;
    this.buffer = [];
    for (const msg of pending) handler(msg);
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.onClose = null;
    this.handler = null;
    this.ws.close();
  }
}
