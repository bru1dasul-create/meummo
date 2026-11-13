// Conexão com o servidor (WebSocket).

import { PROTOCOL_VERSION } from '../shared/constants';
import type { ByeReason, ClientMsg, LoginMode, RejectReason, ServerMsg, WelcomeMsg } from '../shared/protocol';

export type JoinFailure = RejectReason | 'offline' | 'timeout';

/** Quantos erros do navegador mandar por sessão (os repetidos não contam). */
const MAX_ERROR_REPORTS = 10;

/**
 * Erros que acontecerem nesta página vão para os registros do servidor (aba Registros do painel), com onde
 * aconteceram e o aparelho: assim dá para corrigir sem precisar que alguém descreva o problema. Devolve quem desliga.
 */
export function reportErrors(conn: Connection): () => void {
  const sent = new Set<string>();
  const device = navigator.userAgent.replace(/\s+/g, ' ').slice(0, 140);
  const report = (text: string) => {
    const key = text.slice(0, 200);
    if (sent.has(key) || sent.size >= MAX_ERROR_REPORTS) return;
    sent.add(key);
    conn.send({ t: 'oops', text: `${text} | ${location.pathname}${location.search} | ${innerWidth}x${innerHeight} | ${device}`.slice(0, 700) }); // com folga para o limite de 1024 da mensagem inteira
  };
  const onError = (event: ErrorEvent) => {
    const where = event.filename ? ` (${event.filename.replace(/^.*\//, '')}:${event.lineno}:${event.colno})` : '';
    const stack = event.error instanceof Error && event.error.stack ? ` — ${event.error.stack.split('\n').slice(1, 4).map((l) => l.trim()).join(' / ')}` : '';
    report(`${event.message}${where}${stack}`);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error ? `${event.reason.message} — ${(event.reason.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim()).join(' / ')}` : String(event.reason);
    report(`promessa sem tratamento: ${reason}`);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

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
