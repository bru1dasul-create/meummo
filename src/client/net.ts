// Conexão com o servidor (WebSocket).

import { PROTOCOL_VERSION } from '../shared/constants';
import type { ByeReason, ClientMsg, LoginMode, RejectReason, ServerMsg, WelcomeMsg } from '../shared/protocol';

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
  /** Motivo que o servidor deu antes de encerrar (null = a conexão simplesmente caiu). */
  private byeReason: ByeReason | null = null;
  onClose: ((reason: ByeReason | null) => void) | null = null;

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
        if (msg.t === 'bye') this.byeReason = msg.reason;
        if (this.handler) this.handler(msg);
        else this.buffer.push(msg);
      }
    });
    ws.addEventListener('close', () => this.onClose?.(this.byeReason));
  }

  static defaultUrl(): string {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/ws`;
  }

  /** Conecta e entra no mundo com este personagem (o servidor cria se o nome ainda não existir). */
  static join(
    name: string,
    password: string,
    url = Connection.defaultUrl(),
    timeoutMs = 10000,
    /** Entrar pelo jogo 2.5D novo (o servidor manda para os mapas do formato novo). */
    newWorld = false,
    /** 'login' só entra, 'create' só cria; sem, entra ou cria (como sempre). */
    mode?: LoginMode,
  ): Promise<{ conn: Connection; welcome: WelcomeMsg }> {
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
      ws.addEventListener('open', () =>
        conn.send({ t: 'hello', v: PROTOCOL_VERSION, name, password, ...(newWorld ? { mundo: 'novo' as const } : {}), ...(mode ? { mode } : {}) }),
      );
      ws.addEventListener('error', () => finish(new JoinError('offline')));
      ws.addEventListener('close', () => finish(new JoinError('offline')));
    });
  }

  /** Para de entregar mensagens: elas ficam guardadas até o próximo `listen` (ex.: trocando de mapa). */
  hold(): void {
    this.handler = null;
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
