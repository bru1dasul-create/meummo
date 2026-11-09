// Formato das mensagens entre o navegador e o servidor (JSON via WebSocket).
// Regra de ouro: o cliente só pede ("quero andar"); quem decide é o servidor.

import type { Dir } from './dir';

/** Tudo que o cliente precisa saber para desenhar alguém. */
export interface EntityState {
  id: number;
  name: string;
  x: number;
  y: number;
  dir: Dir;
  /** Semente da aparência (cores de cabelo, pele, roupa). */
  look: number;
}

/** Cliente → servidor. */
export type ClientMsg =
  | { t: 'hello'; v: number; name: string } // quero entrar com este nome
  | { t: 'step'; seq: number; dir: Dir } // quero andar um tile (seq numera os pedidos)
  | { t: 'chat'; text: string }
  | { t: 'ping'; id: number };

export type RejectReason = 'name_invalid' | 'name_taken' | 'full' | 'version';

/** Servidor → cliente. O servidor sempre envia uma lista (um pacote por tick). */
export type ServerMsg =
  | { t: 'welcome'; id: number; you: EntityState; stepMs: number; online: number }
  | { t: 'reject'; reason: RejectReason }
  | { t: 'spawn'; e: EntityState } // alguém apareceu na sua área de visão
  | { t: 'despawn'; id: number } // alguém saiu da sua área de visão (ou do jogo)
  | { t: 'move'; id: number; x: number; y: number; dir: Dir }
  | { t: 'ack'; seq: number; x: number; y: number; dir: Dir } // sua posição oficial após o pedido `seq`
  | { t: 'chat'; id: number; name: string; text: string }
  | { t: 'sys'; text: string } // aviso do sistema
  | { t: 'online'; n: number }
  | { t: 'pong'; id: number };

export type WelcomeMsg = Extract<ServerMsg, { t: 'welcome' }>;
