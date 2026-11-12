// Nunca confie no que vem do cliente: tudo passa por aqui antes de chegar no mundo.

import { CHAT_MAX_LENGTH } from '../shared/constants';
import { isWalkAngle } from '../shared/movement';
import { BAG_SIZE, EQUIP_SLOTS, type EquipSlot } from '../shared/items';
import type { ClientMsg } from '../shared/protocol';

const MAX_RAW_LENGTH = 1024;
/** Maior quantidade numa compra ou venda (maior que qualquer pilha). */
const MAX_TRADE = 999;

function isAngle(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10;
}

function isId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

/** Quantos itens de uma vez numa compra ou venda (uma pilha cheia, no máximo). */
function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_TRADE;
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
    case 'walk':
      if (!isWalkAngle(msg.a) || !Number.isSafeInteger(msg.seq) || (msg.seq as number) < 0) return null;
      if (msg.dash !== undefined && msg.dash !== true) return null;
      return msg.dash ? { t: 'walk', a: msg.a, seq: msg.seq as number, dash: true } : { t: 'walk', a: msg.a, seq: msg.seq as number };
    case 'shoot':
      return Number.isSafeInteger(msg.cid) && (msg.cid as number) >= 0 && isAngle(msg.a)
        ? { t: 'shoot', cid: msg.cid as number, a: msg.a }
        : null;
    case 'skill':
      return Number.isInteger(msg.n) && (msg.n as number) >= 0 && (msg.n as number) < 16 && isAngle(msg.a)
        ? { t: 'skill', n: msg.n as number, a: msg.a }
        : null;
    case 'item':
      return (msg.act === 'equip' || msg.act === 'use' || msg.act === 'drop') &&
        Number.isInteger(msg.i) &&
        (msg.i as number) >= 0 &&
        (msg.i as number) < BAG_SIZE
        ? { t: 'item', act: msg.act, i: msg.i as number }
        : null;
    case 'unequip':
      return EQUIP_SLOTS.includes(msg.part as EquipSlot) ? { t: 'unequip', part: msg.part as EquipSlot } : null;
    case 'buy':
      return isId(msg.npc) && typeof msg.item === 'string' && /^[a-z0-9_-]{1,40}$/.test(msg.item) && isCount(msg.n)
        ? { t: 'buy', npc: msg.npc, item: msg.item, n: msg.n }
        : null;
    case 'quest':
      if (msg.act !== 'accept' && msg.act !== 'complete' && msg.act !== 'abandon') return null;
      if (typeof msg.id !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(msg.id)) return null;
      if (msg.npc !== undefined && !isId(msg.npc)) return null;
      return msg.npc !== undefined ? { t: 'quest', act: msg.act, id: msg.id, npc: msg.npc } : { t: 'quest', act: msg.act, id: msg.id };
    case 'sell':
      return isId(msg.npc) && Number.isInteger(msg.i) && (msg.i as number) >= 0 && (msg.i as number) < BAG_SIZE && isCount(msg.n)
        ? { t: 'sell', npc: msg.npc, i: msg.i as number, n: msg.n }
        : null;
    case 'loaded':
      return { t: 'loaded' };
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
