// Lê os personagens do jogo que não são jogadores (NPCs) de data/npcs.json: quem são, onde ficam,
// o que dizem e, se tiverem loja, o que vendem e quanto pagam pelo que você traz.
// Como nos outros arquivos de dados, as chaves são em português para quem não programa poder ajustar.

import { readFileSync } from 'node:fs';
import type { ItemInfo } from '../shared/items';
import type { GameMap } from '../shared/map';
import { Reader } from './data-reader';
import { NPCS_FILE } from './paths';

const FILE = 'data/npcs.json';

export interface NpcShop {
  /** Ids dos itens que a loja vende (pelo `preco` de data/items.json). */
  sells: string[];
  /** Quanto ela paga pelo que você vende: esta % do preço do item (0 = não compra nada). */
  buyPercent: number;
}

export interface NpcDef {
  id: string;
  name: string;
  /** O que ela é ("quitandeira do píer"); aparece embaixo do nome. */
  title: string;
  /** Id do mapa onde fica (nome do arquivo em public/assets/maps, sem o .tmj). */
  map: string;
  x: number;
  y: number;
  /** O que diz quando alguém chega para negociar. */
  line: string;
  /** Itens que aparecem nela (chapéu, roupa...), como o equipamento dos jogadores. */
  wears: string[];
  shop: NpcShop | null;
}

export function parseNpcDefs(json: unknown): Map<string, NpcDef> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error(`Erro em ${FILE}: o arquivo precisa ser um objeto { "id-do-personagem": { ... } }.`);
  }
  const defs = new Map<string, NpcDef>();
  for (const [rawId, raw] of Object.entries(json as Record<string, unknown>)) {
    const id = rawId.trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(id)) {
      throw new Error(`Erro em ${FILE}: o id "${rawId}" só pode ter letras sem acento, números, _ ou - (ex.: "iracema").`);
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`Erro em ${FILE}: "${rawId}" precisa ser um objeto.`);
    const r = new Reader(raw as Record<string, unknown>, FILE, `personagem "${rawId}"`);
    // Em tiles, como no Tiled. Nos mapas do formato novo (1 tile = 1 metro) pode ter fração: é onde fica o pé.
    const tile = (field: string) => r.number(field, { min: 0 });
    const shopData = r.object('loja', true);
    let shop: NpcShop | null = null;
    if (shopData) {
      const s = new Reader(shopData, FILE, `loja do personagem "${rawId}"`);
      const buyPercent = s.number('compraPor', { min: 0, fallback: 50 });
      if (buyPercent > 100) s.fail('compraPor', 'é em %, de 0 a 100 (50 = paga metade do preço)');
      shop = { sells: itemIds(s, 'vende'), buyPercent };
    }
    defs.set(id, {
      id,
      name: r.text('nome'),
      title: r.optionalText('titulo'),
      map: r.text('mapa'),
      x: tile('x'),
      y: tile('y'),
      line: r.optionalText('fala'),
      wears: itemIds(r, 'veste'),
      shop,
    });
  }
  return defs;
}

/** Lista de ids de itens (textos). */
function itemIds(r: Reader, field: string): string[] {
  return r.list(field).map((value) => {
    if (typeof value !== 'string' || !value.trim()) r.fail(field, 'precisa ser uma lista de ids de itens, por exemplo ["banana", "chapeu_palha"]');
    return value.trim().toLowerCase();
  });
}

/**
 * Confere os NPCs contra os itens e os mapas: o mapa existe, cada item vendido existe e tem preço,
 * o que ela veste é equipamento. Erro em português se algo não bate.
 */
export function checkNpcs(npcs: ReadonlyMap<string, NpcDef>, items: ReadonlyMap<string, ItemInfo>, maps: readonly GameMap[]): void {
  const mapIds = new Set(maps.map((m) => m.id));
  for (const npc of npcs.values()) {
    const where = `Erro em ${FILE} (personagem "${npc.id}")`;
    if (!mapIds.has(npc.map)) {
      throw new Error(`${where}: o mapa "${npc.map}" não existe. Use um destes: ${[...mapIds].join(', ')}.`);
    }
    const map = maps.find((m) => m.id === npc.map)!;
    if (!map.metric && (!Number.isInteger(npc.x) || !Number.isInteger(npc.y))) {
      throw new Error(`${where}: "x" e "y" precisam ser números inteiros (a posição em tiles, como no Tiled). Com fração, só nos mapas do formato novo.`);
    }
    for (const item of npc.shop?.sells ?? []) {
      const def = items.get(item);
      if (!def) throw new Error(`${where}: a loja vende "${item}", que não existe em data/items.json.`);
      if (def.price <= 0) throw new Error(`${where}: a loja vende "${item}", mas esse item não tem "preco" em data/items.json.`);
    }
    for (const item of npc.wears) {
      const def = items.get(item);
      if (!def) throw new Error(`${where}: ela veste "${item}", que não existe em data/items.json.`);
      if (def.kind !== 'equipment') throw new Error(`${where}: ela veste "${item}", mas só dá para vestir equipamento.`);
    }
  }
}

export function loadNpcDefs(file = NPCS_FILE): Map<string, NpcDef> {
  return parseNpcDefs(JSON.parse(readFileSync(file, 'utf8')));
}
