// Lê os itens de data/items.json. Como em monsters.json, as chaves são em português para quem
// não programa poder criar e ajustar itens; aqui elas viram tipos do código e são conferidas.

import { readFileSync } from 'node:fs';
import { ATTRIBUTE_IDS, type AttributeId } from '../shared/attributes';
import { SHOT_KINDS, USE_SOUNDS, type EquipSlot, type ItemEffect, type ItemInfo, type ItemKind, type Rarity, type ShotKind, type UseSound, type WeaponShot } from '../shared/items';
import { Reader } from './data-reader';
import { ITEMS_FILE } from './paths';

const FILE = 'data/items.json';

const KINDS: Record<string, ItemKind> = { equipamento: 'equipment', consumivel: 'consumable', consumível: 'consumable', material: 'material' };
const SLOTS: Record<string, EquipSlot> = { arma: 'weapon', cabeca: 'head', cabeça: 'head', corpo: 'body', amuleto: 'charm' };
const RARITIES: Record<string, Rarity> = { comum: 'common', raro: 'rare', lendario: 'legendary', lendário: 'legendary' };

/** Limites do "tiro" de uma arma (os mesmos que o painel do administrador confere). */
export const WEAPON_SHOT_LIMITS = {
  cargaMs: [100, 5000],
  alcance: [2, 20],
  intervaloMs: [200, 5000],
  velocidade: [4, 40],
} as const;

/** O campo "tiro" de uma arma: { "projetil": "flecha", "cargaMs": 1500, "alcanceMinimo": 8, "alcanceMaximo": 13, ... }. */
function parseWeaponShot(raw: unknown, where: string): WeaponShot {
  const at = `tiro do ${where}`;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`Erro em ${FILE} (${where}): o campo "tiro" precisa ser um objeto { "projetil": "flecha", "cargaMs": ..., ... }.`);
  }
  const r = new Reader(raw as Record<string, unknown>, FILE, at);
  const projectile = r.text('projetil').toLowerCase();
  if (!(SHOT_KINDS as readonly string[]).includes(projectile)) r.fail('projetil', `precisa ser ${SHOT_KINDS.map((k) => `"${k}"`).join(' ou ')}`);
  const within = (field: string, [min, max]: readonly [number, number], whole: boolean) => {
    const value = r.number(field);
    if (whole && !Number.isInteger(value)) r.fail(field, 'precisa ser um número inteiro');
    if (value < min || value > max) r.fail(field, `precisa ser de ${min} a ${max}`);
    return value;
  };
  const L = WEAPON_SHOT_LIMITS;
  const shot: WeaponShot = {
    projectile: projectile as ShotKind,
    chargeMs: within('cargaMs', L.cargaMs, true),
    rangeMin: within('alcanceMinimo', L.alcance, false),
    rangeMax: within('alcanceMaximo', L.alcance, false),
    cooldownMs: within('intervaloMs', L.intervaloMs, true),
    speed: within('velocidade', L.velocidade, false),
  };
  if (shot.rangeMax < shot.rangeMin) r.fail('alcanceMaximo', 'não pode ser menor que o "alcanceMinimo"');
  return shot;
}

/** Limites do "efeito" de um consumível (os mesmos que o painel do administrador confere). */
export const EFFECT_LIMITS = { pontos: [1, 50], vidaVolta: [1, 10], minutos: [0.1, 60] } as const;

/**
 * O campo "efeito" de um consumível: { "destreza": 5, "minutos": 3 } (pontos a mais num atributo: "forca", "destreza",
 * "espirito", "vitalidade") ou { "vidaVolta": 3, "minutos": 3 } (a vida que volta sozinha fora de luta fica 3× mais
 * rápida). Pode juntar mais de um; "minutos" é quanto dura.
 */
function parseEffect(raw: unknown, where: string): ItemEffect {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`Erro em ${FILE} (${where}): o campo "efeito" precisa ser um objeto, por exemplo { "destreza": 5, "minutos": 3 }.`);
  }
  const data = raw as Record<string, unknown>;
  const r = new Reader(data, FILE, `efeito do ${where}`);
  const known = [...ATTRIBUTE_IDS, 'vidaVolta'];
  for (const key of Object.keys(data)) {
    if (key !== 'minutos' && !known.includes(key)) r.fail(key, `não existe (use ${known.map((k) => `"${k}"`).join(', ')} e "minutos")`);
  }
  const L = EFFECT_LIMITS;
  const minutes = r.number('minutos');
  if (minutes < L.minutos[0] || minutes > L.minutos[1]) r.fail('minutos', `precisa ser de ${String(L.minutos[0]).replace('.', ',')} a ${L.minutos[1]}`);
  const attrs: Partial<Record<AttributeId, number>> = {};
  for (const id of ATTRIBUTE_IDS) {
    if (!r.has(id)) continue;
    const points = r.number(id);
    if (!Number.isInteger(points) || points < L.pontos[0] || points > L.pontos[1]) r.fail(id, `precisa ser um número inteiro de ${L.pontos[0]} a ${L.pontos[1]}`);
    attrs[id] = points;
  }
  let regen = 0;
  if (r.has('vidaVolta')) {
    regen = r.number('vidaVolta');
    if (regen < L.vidaVolta[0] || regen > L.vidaVolta[1]) r.fail('vidaVolta', `precisa ser de ${L.vidaVolta[0]} a ${L.vidaVolta[1]} (quantas vezes mais rápido a vida volta)`);
  }
  if (Object.keys(attrs).length === 0 && regen === 0) {
    r.fail('minutos', 'está sozinho: diga também o que o efeito dá (ex.: "destreza": 5 ou "vidaVolta": 3)');
  }
  return { attrs, regen, durationMs: Math.round(minutes * 60_000) };
}

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
    if (r.has('curaPorcento')) {
      if (kind !== 'consumable') r.fail('curaPorcento', 'só vale para consumíveis (tipo "consumivel")');
      const pct = whole('curaPorcento', 0);
      if (pct > 100) r.fail('curaPorcento', 'vai de 0 a 100 (% da vida máxima)');
      if (pct > 0) def.healPct = pct;
    }
    if (r.has('som')) {
      if (kind !== 'consumable') r.fail('som', 'só vale para consumíveis (tipo "consumivel")');
      const sound = r.text('som').toLowerCase();
      if (!(USE_SOUNDS as readonly string[]).includes(sound)) r.fail('som', `precisa ser ${USE_SOUNDS.map((s) => `"${s}"`).join(', ')}`);
      def.useSound = sound as UseSound;
    }
    if (r.has('efeito')) {
      if (kind !== 'consumable') r.fail('efeito', 'só vale para consumíveis (tipo "consumivel")');
      def.effect = parseEffect((raw as Record<string, unknown>).efeito, where);
    }
    if (kind === 'consumable' && def.heal === 0 && !def.healPct && !def.effect) {
      r.fail('cura', 'precisa ser maior que 0, ou use "curaPorcento" ou "efeito" (um consumível precisa fazer alguma coisa)');
    }
    if (r.has('tiro')) {
      if (slot !== 'weapon') r.fail('tiro', 'só vale para armas (tipo "equipamento", parte "arma")');
      def.shot = parseWeaponShot((raw as Record<string, unknown>).tiro, where);
    }
    if (r.has('atalho')) {
      if (kind !== 'consumable') r.fail('atalho', 'só vale para consumíveis (tipo "consumivel")');
      const quick = whole('atalho', 0, 1);
      if (quick !== 1 && quick !== 2) r.fail('atalho', 'precisa ser 1 (comida) ou 2 (remédio)');
      def.quick = quick as 1 | 2;
    }
    defs.set(id, def);
  }
  return defs;
}

export function loadItemDefs(file = ITEMS_FILE): Map<string, ItemInfo> {
  return parseItemDefs(JSON.parse(readFileSync(file, 'utf8')));
}
