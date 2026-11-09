// Nunca confie no que vem do cliente: tudo passa por aqui antes de chegar no mundo.

import { CHAT_MAX_LENGTH } from '../shared/constants';
import { isDir } from '../shared/dir';
import type { ClientMsg } from '../shared/protocol';

const MAX_RAW_LENGTH = 1024;

/** Transforma o texto recebido numa mensagem válida, ou null se vier qualquer coisa estranha. */
export function parseClientMsg(raw: string): ClientMsg | null {
  if (raw.length > MAX_RAW_LENGTH) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const msg = data as Record<string, unknown>;

  switch (msg.t) {
    case 'hello':
      return typeof msg.name === 'string' && msg.name.length <= 64 && Number.isSafeInteger(msg.v)
        ? { t: 'hello', name: msg.name, v: msg.v as number }
        : null;
    case 'step':
      return isDir(msg.dir) && Number.isSafeInteger(msg.seq) && (msg.seq as number) >= 0
        ? { t: 'step', dir: msg.dir, seq: msg.seq as number }
        : null;
    case 'chat':
      return typeof msg.text === 'string' && msg.text.length <= CHAT_MAX_LENGTH * 4 ? { t: 'chat', text: msg.text } : null;
    case 'ping':
      return Number.isSafeInteger(msg.id) ? { t: 'ping', id: msg.id as number } : null;
    default:
      return null;
  }
}

// Caracteres de controle e de inversão de texto (usados para bagunçar ou disfarçar mensagens).
const UNSAFE_CHARS = /[\p{Cc}​‎‏‪-‮⁦-⁩﻿]/gu;

/** Limpa uma mensagem de chat. Pode devolver texto vazio (aí a mensagem é ignorada). */
export function sanitizeChat(raw: string): string {
  const clean = raw.normalize('NFC').replace(/\s+/gu, ' ').replace(UNSAFE_CHARS, '').trim();
  const chars = [...clean];
  return chars.length > CHAT_MAX_LENGTH ? chars.slice(0, CHAT_MAX_LENGTH).join('').trimEnd() : clean;
}
