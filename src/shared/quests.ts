// Missões: o que o navegador e o servidor precisam concordar. As missões vêm de data/missoes.json e chegam
// ao navegador na mensagem de boas-vindas; o progresso de cada um é do servidor (e fica salvo).

import type { ItemStack } from './items';

/**
 * Derrotar N de um monstro, levar N de um item para quem deu a missão, ou ir até alguém e falar com ele (a missão de
 * falar se conclui com essa pessoa, não com quem deu).
 */
export type QuestGoal =
  | { kind: 'kill'; monster: string; count: number }
  | { kind: 'deliver'; item: string; count: number }
  | { kind: 'talk'; npc: string; count: 1 };

export interface QuestInfo {
  id: string;
  name: string;
  /** Id do NPC que dá a missão (data/npcs.json) — é para ele que se volta para concluir (menos na de falar). */
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
  /** O nome do monstro, do item ou de quem procurar, para mostrar ("Sagui Encantado"). */
  goalName: string;
  /** O objetivo do jeito que a missão quer que apareça (campo "rotulo"), ex.: "Acalmar 4 saguis encantados". */
  goalLabel?: string;
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

/** Com quem a missão se conclui: quem deu, ou (missão de falar) a pessoa procurada. */
export function questFinisher(quest: QuestInfo): string {
  return quest.goal.kind === 'talk' ? quest.goal.npc : quest.giver;
}

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
  const goal = quest.goal;
  if (goal.kind === 'talk') return 1; // é só chegar lá e falar
  return Math.min(goal.count, goal.kind === 'kill' ? progress.count : inBag(goal.item));
}
