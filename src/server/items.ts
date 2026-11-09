// Lê os itens de data/items.json. Como em monsters.json, as chaves são em português para quem
// não programa poder criar e ajustar itens; aqui elas viram tipos do código e são conferidas.

import { readFileSync } from 'node:fs';
import type { EquipSlot, ItemInfo, ItemKind, Rarity } from '../shared/items';
import { Reader } from './data-reader';
import { ITEMS_FILE } from './paths';

const FILE = 'data/items.json';

const KINDS: Record<string, ItemKind> = { equipamento: 'equipment', consumivel: 'consumable', consumível: 'consumable', material: 'material' };
const SLOTS: Record<string, EquipSlot> = { arma: 'weapon', cabeca: 'head', cabeça: 'head', corpo: 'body', amuleto: 'charm' };
const RARITIES: Record<string, Rarity> = { comum: 'common', raro: 'rare', lendario: 'legendary', lendário: 'legendary' };

function pick<T>(table: Record<string, T>, value: string, field: string, where: string): T {
  const found = table[value.toLowerCase()];
  if (found === undefined) {
    const options = [...new Set(Object.keys(table).map((k) => k.normalize('NFD').replace(/\p{M}/gu, '')))].join(', ');
    throw new Error(`Erro em ${FILE} (${where}): "${field}" não pode ser "${value}". Use: ${options}.`);
  }
  return found;
}

export function parseItemDefs(json: unknown): Map<string, ItemInfo> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error(`Erro em ${FILE}: o arquivo precisa ser um objeto { "id-do-item": { ... } }.`);
  }
  const defs = new Map<string, ItemInfo>();
  for (const [rawId, raw] of Object.entries(json as Record<string, unknown>)) {
    const id = rawId.trim().toLowerCase();
    const where = `item "${rawId}"`;
    if (!/^[a-z0-9_-]+$/.test(id)) {
      throw new Error(`Erro em ${FILE}: o id "${rawId}" só pode ter letras sem acento, números, _ ou - (ex.: "chapeu_palha").`);
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`Erro em ${FILE}: "${rawId}" precisa ser um objeto.`);
    const r = new Reader(raw as Record<string, unknown>, FILE, where);
    const kind = pick(KINDS, r.text('tipo'), 'tipo', where);
    const slot = kind === 'equipment' ? pick(SLOTS, r.text('parte'), 'parte', where) : null;
    if (kind !== 'equipment' && r.has('parte')) r.fail('parte', 'só vale para equipamentos (tipo "equipamento")');
    const whole = (field: string, fallback: number, min = 0) => {
      const value = r.number(field, { min, fallback });
      if (!Number.isInteger(value)) r.fail(field, 'precisa ser um número inteiro');
      return value;
    };
    const def: ItemInfo = {
      id,
      name: r.text('nome'),
      kind,
      slot,
      bonus: kind === 'equipment' ? { damage: whole('dano', 0), hp: whole('vida', 0), defense: whole('defesa', 0) } : { damage: 0, hp: 0, defense: 0 },
      heal: kind === 'consumable' ? whole('cura', 0) : 0,
      cooldownMs: kind === 'consumable' ? whole('recargaMs', 3000) : 0,
      stack: kind === 'equipment' ? 1 : whole('pilha', 20, 1),
      rarity: pick(RARITIES, r.text('raridade', 'comum'), 'raridade', where),
      description: typeof (raw as Record<string, unknown>).descricao === 'string' ? ((raw as Record<string, unknown>).descricao as string).trim() : '',
      icon: r.text('icone', id),
      price: whole('preco', 0),
    };
    if (kind === 'consumable' && def.heal === 0) r.fail('cura', 'precisa ser maior que 0 (por enquanto, consumível é para curar)');
    defs.set(id, def);
  }
  return defs;
}

export function loadItemDefs(file = ITEMS_FILE): Map<string, ItemInfo> {
  return parseItemDefs(JSON.parse(readFileSync(file, 'utf8')));
}
