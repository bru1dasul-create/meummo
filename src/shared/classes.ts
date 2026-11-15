// Classes e habilidades (pedido do dono, 14/11). Todo mundo começa igual; depois das missões do começo, escolhe a
// classe (por enquanto só o Caçador da Floresta: arco e flecha ou estilingue). A cada nível, a partir do 2, ganha 1
// ponto para pôr numa habilidade da classe (até 5 em cada). Cada habilidade libera num nível, e entre um ponto e o
// próximo na mesma habilidade é preciso subir alguns níveis (assim ninguém põe tudo numa só logo no começo).
// Os números ficam em data/classes.json; as regras (iguais no servidor e no navegador) ficam aqui.

import type { QuestLog } from './quests';

/** O que a habilidade faz (o código dela). Habilidade sem tipo ainda não existe no jogo: aparece como "em breve". */
export type ClassSkillKind = 'chuva';

/** Os números de um ponto da habilidade (na lista, o primeiro é com 1 ponto, o segundo com 2...). */
export interface SkillPointInfo {
  /** Chuva: quantas flechas sobem (o desenho; mais flechas, mais dano). */
  arrows: number;
  /** Chuva: o raio da área onde elas caem (metros). */
  radius: number;
  /** Chuva: o dano em cada bicho da área (% do tiro sem carga). */
  damagePct: number;
}

export interface ClassSkillInfo {
  id: string;
  name: string;
  description: string;
  /** Nível do personagem para pôr o primeiro ponto. */
  level: number;
  /** null = ainda não existe no jogo (aparece como "em breve" e não recebe pontos). */
  kind: ClassSkillKind | null;
  cooldownMs: number;
  /** Até onde dá para mirar (metros, do pé). */
  range: number;
  /** Do tiro até as flechas caírem (ms): dá para ver a área antes. */
  delayMs: number;
  /** Os números de cada ponto (o máximo de pontos é o tamanho da lista). Vazia nas "em breve". */
  points: SkillPointInfo[];
}

export interface ClassInfo {
  id: string;
  name: string;
  description: string;
  /** Precisa ter concluído esta missão para escolher a classe (null = qualquer um escolhe). */
  unlockQuest: string | null;
  /** Quantos níveis entre um ponto e o próximo na mesma habilidade (0 = sem espera). */
  levelsBetweenPoints: number;
  /** Na ordem da janela e da barra (a primeira fica no Q). */
  skills: ClassSkillInfo[];
}

/** O que o jogador tem: a classe, os pontos postos em cada habilidade e quantos sobram para gastar. */
export interface HeroState {
  /** A chave da classe em data/classes.json, ou null (ainda não escolheu). */
  class: string | null;
  /** Habilidade → quantos pontos ela tem (só as que têm pelo menos 1). */
  skills: Record<string, number>;
  /** Pontos para gastar. */
  points: number;
  /** Pode escolher a classe agora (concluiu a missão do começo e ainda não escolheu). */
  canChoose: boolean;
}

/** 1 ponto por nível, a partir do 2 (no nível 1, nenhum). */
export function earnedPoints(level: number): number {
  return Math.max(0, Math.floor(level) - 1);
}

export function spentPoints(skills: Readonly<Record<string, number>>): number {
  let total = 0;
  for (const n of Object.values(skills)) total += n;
  return total;
}

/** Quantos pontos sobram para gastar. */
export function pointsLeft(level: number, skills: Readonly<Record<string, number>>): number {
  return Math.max(0, earnedPoints(level) - spentPoints(skills));
}

/** O nível do personagem para pôr o ponto número `n` (1, 2, 3...) nesta habilidade. */
export function levelForPoint(cls: ClassInfo, skill: ClassSkillInfo, n: number): number {
  return skill.level + (Math.max(1, n) - 1) * cls.levelsBetweenPoints;
}

/** Por que não dá: 'soon' = ainda não existe; 'max' = já está no máximo; 'level' = nível baixo; 'points' = sem pontos. */
export type LearnBlocker = 'soon' | 'max' | 'level' | 'points';

/** Por que não dá para pôr mais um ponto nesta habilidade, ou null se dá. */
export function learnBlocker(cls: ClassInfo, skill: ClassSkillInfo, level: number, skills: Readonly<Record<string, number>>): LearnBlocker | null {
  if (!skill.kind || skill.points.length === 0) return 'soon';
  const has = skills[skill.id] ?? 0;
  if (has >= skill.points.length) return 'max';
  if (level < levelForPoint(cls, skill, has + 1)) return 'level';
  if (pointsLeft(level, skills) < 1) return 'points';
  return null;
}

/** Já concluiu a missão que libera esta classe? (Ter ou não uma classe é outra conta.) */
export function classUnlocked(cls: ClassInfo, log: Readonly<QuestLog>): boolean {
  return cls.unlockQuest === null || log[cls.unlockQuest]?.state === 'done';
}

/** Os números com `n` pontos (1 = o primeiro da lista), ou null sem pontos. Passou do máximo: o último. */
export function skillPoint(skill: ClassSkillInfo, n: number): SkillPointInfo | null {
  if (n < 1 || skill.points.length === 0) return null;
  return skill.points[Math.min(n, skill.points.length) - 1]!;
}

/**
 * Os pontos salvos, conferidos com a classe de agora (os dados podem ter mudado): habilidade que não existe mais (ou
 * que virou "em breve") sai, ninguém passa do máximo nem do que o nível deixa, e se a soma passar dos pontos do nível
 * (o administrador baixou o nível), tudo volta para gastar de novo.
 */
export function cleanSkills(cls: ClassInfo | undefined, level: number, raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!cls || typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const skill of cls.skills) {
    const value = (raw as Record<string, unknown>)[skill.id];
    if (typeof value !== 'number' || !Number.isFinite(value) || !skill.kind) continue;
    let n = Math.min(skill.points.length, Math.floor(value));
    while (n > 0 && level < levelForPoint(cls, skill, n)) n -= 1;
    if (n > 0) out[skill.id] = n;
  }
  return spentPoints(out) > earnedPoints(level) ? {} : out;
}

/** Onde a habilidade cai: o ponto mirado, trazido para dentro do alcance (medido do pé de quem usa). */
export function castPoint(from: { x: number; y: number }, to: { x: number; y: number }, range: number): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= range || distance === 0) return { x: to.x, y: to.y };
  return { x: from.x + (dx / distance) * range, y: from.y + (dy / distance) * range };
}
