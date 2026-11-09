// Nunca confie no que vem do cliente: tudo passa por aqui antes de chegar no mundo.

import { CHAT_MAX_LENGTH } from '../shared/constants';
import { isDir } from '../shared/dir';
import type { ClientMsg } from '../shared/protocol';

const MAX_RAW_LENGTH = 1024;

function isAngle(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10;
}

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
    case 'hello': {
      // Sem senha ainda é aceito aqui: assim um jogo antigo recebe "versão desatualizada", e não silêncio.
      const password = msg.password ?? '';
      return typeof msg.name === 'string' && msg.name.length <= 64 && typeof password === 'string' && password.length <= 256 && Number.isSafeInteger(msg.v)
        ? { t: 'hello', name: msg.name, password, v: msg.v as number }
        : null;
    }
    case 'step':
      if (!isDir(msg.dir) || !Number.isSafeInteger(msg.seq) || (msg.seq as number) < 0) return null;
      if (msg.dash !== undefined && msg.dash !== true) return null;
      return msg.dash ? { t: 'step', dir: msg.dir, seq: msg.seq as number, dash: true } : { t: 'step', dir: msg.dir, seq: msg.seq as number };
    case 'shoot':
      return Number.isSafeInteger(msg.cid) && (msg.cid as number) >= 0 && isAngle(msg.a)
        ? { t: 'shoot', cid: msg.cid as number, a: msg.a }
        : null;
    case 'skill':
      return Number.isInteger(msg.n) && (msg.n as number) >= 0 && (msg.n as number) < 16 && isAngle(msg.a)
        ? { t: 'skill', n: msg.n as number, a: msg.a }
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
