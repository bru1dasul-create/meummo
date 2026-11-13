// Lê as missões de data/missoes.json. Como nos outros arquivos de dados, as chaves são em português para
// quem não programa poder escrever e ajustar missões; aqui elas viram tipos do código e são conferidas.

import { readFileSync } from 'node:fs';
import type { ItemInfo } from '../shared/items';
import type { QuestGoal, QuestInfo } from '../shared/quests';
import { Reader } from './data-reader';
import type { MonsterDef } from './monsters';
import type { NpcDef } from './npcs';
import { QUESTS_FILE } from './paths';

const FILE = 'data/missoes.json';

/** O id que o objetivo cita (monstro, item ou NPC). */
function goalKey(goal: QuestGoal): string {
  return goal.kind === 'kill' ? goal.monster : goal.kind === 'deliver' ? goal.item : goal.npc;
}

function wholeNumber(r: Reader, field: string, fallback: number, min = 0): number {
  const value = r.number(field, { min, fallback });
  if (!Number.isInteger(value)) r.fail(field, 'precisa ser um número inteiro');
  return value;
}

export function parseQuestDefs(json: unknown): Map<string, QuestInfo> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error(`Erro em ${FILE}: o arquivo precisa ser um objeto { "id-da-missao": { ... } }.`);
  }
  const quests = new Map<string, QuestInfo>();
  for (const [rawId, raw] of Object.entries(json as Record<string, unknown>)) {
    const id = rawId.trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(id)) {
      throw new Error(`Erro em ${FILE}: o id "${rawId}" só pode ter letras sem acento, números, _ ou - (ex.: "saguis_travessos").`);
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`Erro em ${FILE}: "${rawId}" precisa ser um objeto.`);
    const where = `missão "${rawId}"`;
    const r = new Reader(raw as Record<string, unknown>, FILE, where);
    const g = new Reader(r.object('objetivo')!, FILE, `objetivo da ${where}`);
    const kind = g.text('tipo');
    let goal: QuestGoal;
    if (kind === 'derrotar') goal = { kind: 'kill', monster: g.text('monstro').toLowerCase(), count: wholeNumber(g, 'quantidade', 1, 1) };
    else if (kind === 'entregar') goal = { kind: 'deliver', item: g.text('item').toLowerCase(), count: wholeNumber(g, 'quantidade', 1, 1) };
    else if (kind === 'falar') goal = { kind: 'talk', npc: g.text('com').toLowerCase(), count: 1 };
    else g.fail('tipo', 'precisa ser "derrotar" (monstros), "entregar" (itens) ou "falar" (ir até alguém, "com": id do NPC)');
    // "rotulo": o objetivo do jeito que aparece na tela (ex.: "Acalmar 4 saguis encantados"); sem ele, o texto padrão
    const label = g.has('rotulo') ? g.text('rotulo') : null;
    const rewardData = r.object('recompensa', true) ?? {};
    const rr = new Reader(rewardData, FILE, `recompensa da ${where}`);
    const items = rr.list('itens').map((value, i) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        rr.fail('itens', 'precisa ser uma lista de { "item": ..., "quantidade": ... }');
      }
      const ir = new Reader(value as Record<string, unknown>, FILE, `item ${i + 1} da recompensa da ${where}`);
      return { item: ir.text('item').toLowerCase(), n: wholeNumber(ir, 'quantidade', 1, 1) };
    });
    const afterRaw = (raw as Record<string, unknown>).depoisDe;
    if (afterRaw !== undefined && afterRaw !== null && (typeof afterRaw !== 'string' || !afterRaw.trim())) {
      r.fail('depoisDe', 'precisa ser o id de outra missão (ou ficar de fora)');
    }
    quests.set(id, {
      id,
      name: r.text('nome'),
      giver: r.text('quemDa').toLowerCase(),
      minLevel: wholeNumber(r, 'nivelMinimo', 1, 1),
      after: typeof afterRaw === 'string' ? afterRaw.trim().toLowerCase() : null,
      repeatable: r.bool('repetivel', false),
      ask: r.text('pedido'),
      done: r.text('concluida', 'Obrigado!'),
      goal: goal!,
      goalName: goalKey(goal!),
      ...(label ? { goalLabel: label } : {}),
      reward: { xp: wholeNumber(rr, 'xp', 0), gold: wholeNumber(rr, 'ouro', 0), items },
    });
  }
  return quests;
}

/** Confere se tudo que as missões citam existe (NPC, monstro, item, missão anterior) e se não há volta em círculo. */
export function checkQuests(
  quests: ReadonlyMap<string, QuestInfo>,
  game: { npcs: ReadonlyMap<string, NpcDef>; monsters: ReadonlyMap<string, MonsterDef>; items: ReadonlyMap<string, ItemInfo> },
): void {
  for (const quest of quests.values()) {
    const where = `Erro em ${FILE} (missão "${quest.id}")`;
    if (!game.npcs.has(quest.giver)) throw new Error(`${where}: "quemDa" é "${quest.giver}", que não existe em data/npcs.json.`);
    if (quest.goal.kind === 'kill' && !game.monsters.has(quest.goal.monster)) {
      throw new Error(`${where}: o monstro "${quest.goal.monster}" não existe em data/monsters.json.`);
    }
    if (quest.goal.kind === 'deliver' && !game.items.has(quest.goal.item)) {
      throw new Error(`${where}: o item "${quest.goal.item}" não existe em data/items.json.`);
    }
    if (quest.goal.kind === 'talk' && !game.npcs.has(quest.goal.npc)) {
      throw new Error(`${where}: o objetivo manda falar com "${quest.goal.npc}", que não existe em data/npcs.json.`);
    }
    for (const reward of quest.reward.items) {
      if (!game.items.has(reward.item)) throw new Error(`${where}: a recompensa tem o item "${reward.item}", que não existe em data/items.json.`);
    }
    if (quest.after && !quests.has(quest.after)) throw new Error(`${where}: "depoisDe" é "${quest.after}", que não é uma missão deste arquivo.`);
    // depoisDe em círculo (A depois de B, B depois de A): ninguém conseguiria começar
    const seen = new Set<string>([quest.id]);
    for (let next = quest.after; next; next = quests.get(next)?.after ?? null) {
      if (seen.has(next)) throw new Error(`${where}: "depoisDe" faz uma volta em círculo (${[...seen, next].join(' → ')}).`);
      seen.add(next);
    }
  }
}

/** Põe o nome de verdade do monstro, do item ou do NPC em cada objetivo (para o navegador mostrar). */
export function nameQuestGoals(
  quests: ReadonlyMap<string, QuestInfo>,
  game: { monsters: ReadonlyMap<string, MonsterDef>; items: ReadonlyMap<string, ItemInfo>; npcs?: ReadonlyMap<string, NpcDef> },
): void {
  for (const quest of quests.values()) {
    const goal = quest.goal;
    const name = goal.kind === 'kill' ? game.monsters.get(goal.monster)?.name : goal.kind === 'deliver' ? game.items.get(goal.item)?.name : game.npcs?.get(goal.npc)?.name;
    quest.goalName = name ?? quest.goalName;
  }
}

export function loadQuestDefs(file = QUESTS_FILE): Map<string, QuestInfo> {
  return parseQuestDefs(JSON.parse(readFileSync(file, 'utf8')));
}
