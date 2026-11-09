// Missões: o que o navegador e o servidor precisam concordar. As missões vêm de data/missoes.json e chegam
// ao navegador na mensagem de boas-vindas; o progresso de cada um é do servidor (e fica salvo).

import type { ItemStack } from './items';

/** Derrotar N de um monstro, ou levar N de um item para quem deu a missão. */
export type QuestGoal = { kind: 'kill'; monster: string; count: number } | { kind: 'deliver'; item: string; count: number };

export interface QuestInfo {
  id: string;
  name: string;
  /** Id do NPC que dá a missão (data/npcs.json) — é para ele que se volta para concluir. */
  giver: string;
  minLevel: number;
  /** Só aparece depois de concluir esta outra missão (null = sem pré-requisito). */
  after: string | null;
  /** Dá para fazer de novo depois de concluir. */
  repeatable: boolean;
  /** O que o NPC diz ao pedir. */
  ask: string;
  /** O que o NPC diz ao receber. */
  done: string;
  goal: QuestGoal;
  /** O nome do monstro ou do item do objetivo, para mostrar ("Sagui Travesso"). */
  goalName: string;
  reward: { xp: number; gold: number; items: ItemStack[] };
}

/** active = fazendo; done = já concluída (missão repetível pode ser aceita de novo). */
export type QuestState = 'active' | 'done';

/** O progresso de um jogador numa missão. `count`: quantos já derrotou (missão de entregar conta pela mochila). */
export interface QuestProgress {
  state: QuestState;
  count: number;
}

/** Missão → progresso, de um jogador. */
export type QuestLog = Record<string, QuestProgress>;

/** Quantas missões dá para fazer ao mesmo tempo. */
export const MAX_ACTIVE_QUESTS = 5;

/** O que falta para aceitar a missão (null = pode aceitar). */
export function questBlocker(quest: QuestInfo, log: QuestLog, level: number): 'active' | 'done' | 'after' | 'level' | 'full' | null {
  const mine = log[quest.id];
  if (mine?.state === 'active') return 'active';
  if (mine?.state === 'done' && !quest.repeatable) return 'done';
  if (quest.after && log[quest.after]?.state !== 'done') return 'after';
  if (level < quest.minLevel) return 'level';
  if (Object.values(log).filter((p) => p.state === 'active').length >= MAX_ACTIVE_QUESTS) return 'full';
  return null;
}

/** Quanto do objetivo já foi feito (missão de entregar: o que está na mochila agora). */
export function questProgress(quest: QuestInfo, progress: QuestProgress | undefined, inBag: (item: string) => number): number {
  if (!progress || progress.state !== 'active') return 0;
  return Math.min(quest.goal.count, quest.goal.kind === 'kill' ? progress.count : inBag(quest.goal.item));
}
