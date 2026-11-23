// Atributos do personagem (aprovado pelo dono em 23/11: "Força, Destreza, Espírito e Vitalidade, 3 pontos por nível").
// A cada nível, a partir do 2, o jogador ganha 3 pontos para distribuir (recomeçar é de graça, por enquanto). Cada ponto
// mexe num número fixo — nada de sorteio (crítico, errar): no jogo de ação, quem decide a luta é a mira e a esquiva.
// Quanto vale cada ponto fica nas regras do combate (CombatRules), que o painel do administrador ajusta.
// Regras iguais no servidor e no navegador (o navegador prevê a puxada e o intervalo do tiro com elas).

import type { ShotProfile } from './combat';
import type { CombatRules } from './combatRules';

export const ATTRIBUTE_IDS = ['forca', 'destreza', 'espirito', 'vitalidade'] as const;
export type AttributeId = (typeof ATTRIBUTE_IDS)[number];
/** Os pontos em cada atributo. */
export type Attributes = Record<AttributeId, number>;

export const ATTRIBUTE_NAMES: Readonly<Record<AttributeId, string>> = {
  forca: 'Força',
  destreza: 'Destreza',
  espirito: 'Espírito',
  vitalidade: 'Vitalidade',
};

/** Pontos ganhos a cada nível (a partir do 2). */
export const ATTRIBUTE_POINTS_PER_LEVEL = 3;
/** Um atributo não passa disto (contra arquivo estranho; com 3 por nível, nem o nível 50 chega perto). */
const ATTRIBUTE_MAX = 999;

export function noAttributes(): Attributes {
  return { forca: 0, destreza: 0, espirito: 0, vitalidade: 0 };
}

export function isAttributeId(value: unknown): value is AttributeId {
  return typeof value === 'string' && (ATTRIBUTE_IDS as readonly string[]).includes(value);
}

/** Pontos de atributo ganhos até este nível (3 por nível, a partir do 2: no nível 10, 27). */
export function attributePointsEarned(level: number): number {
  return Math.max(0, Math.floor(level) - 1) * ATTRIBUTE_POINTS_PER_LEVEL;
}

export function attributePointsSpent(attributes: Readonly<Attributes>): number {
  return ATTRIBUTE_IDS.reduce((sum, id) => sum + attributes[id], 0);
}

/** Pontos de atributo para gastar agora. */
export function attributePointsLeft(level: number, attributes: Readonly<Attributes>): number {
  return Math.max(0, attributePointsEarned(level) - attributePointsSpent(attributes));
}

/**
 * Os atributos salvos (ou de qualquer lugar), conferidos: só os quatro, inteiros de 0 em diante. Se gastam mais do que o
 * nível dá (o nível baixou pelo painel, a conta mudou), voltam todos: o jogador distribui de novo.
 */
export function cleanAttributes(level: number, saved: unknown): Attributes {
  const out = noAttributes();
  if (typeof saved !== 'object' || saved === null) return out;
  const raw = saved as Record<string, unknown>;
  for (const id of ATTRIBUTE_IDS) {
    const value = raw[id];
    if (typeof value === 'number' && Number.isFinite(value)) out[id] = Math.max(0, Math.min(ATTRIBUTE_MAX, Math.floor(value)));
  }
  return attributePointsSpent(out) > attributePointsEarned(level) ? noAttributes() : out;
}

/** Força: o dano do tiro de sempre (arco e estilingue) × isto. */
export function strengthFactor(attributes: Readonly<Attributes>, rules: Pick<CombatRules, 'strengthShotPct'>): number {
  return 1 + (attributes.forca * rules.strengthShotPct) / 100;
}

/** Espírito: o dano das habilidades da classe (a Chuva, a Flecha Ancestral) × isto. */
export function spiritDamageFactor(attributes: Readonly<Attributes>, rules: Pick<CombatRules, 'spiritSkillPct'>): number {
  return 1 + (attributes.espirito * rules.spiritSkillPct) / 100;
}

/** Quanto sobra de um tempo depois de cortar `pct`% por ponto, sem passar do corte máximo (`maxPct`%). */
function cut(points: number, pct: number, maxPct: number): number {
  return 1 - Math.min(maxPct, points * pct) / 100;
}

/** Espírito: a recarga das habilidades da classe × isto (menor; no máximo `attributeCutMaxPct`% a menos). */
export function spiritCooldownFactor(attributes: Readonly<Attributes>, rules: Pick<CombatRules, 'spiritCooldownPct' | 'attributeCutMaxPct'>): number {
  return cut(attributes.espirito, rules.spiritCooldownPct, rules.attributeCutMaxPct);
}

/** Vitalidade: vida a mais (antes do "vida dos jogadores ×" do painel, como a vida dos equipamentos). */
export function vitalityHp(attributes: Readonly<Attributes>, rules: Pick<CombatRules, 'vitalityHp'>): number {
  return attributes.vitalidade * rules.vitalityHp;
}

type DexterityRules = Pick<CombatRules, 'dexterityChargePct' | 'dexterityIntervalPct' | 'attributeCutMaxPct'>;

/**
 * Destreza: o tiro com a puxada e o intervalo menores (no máximo `attributeCutMaxPct`% a menos cada). Serve para o
 * servidor e para o navegador (que mostra o anel da carga e prevê quando dá para atirar de novo).
 */
export function dexterityShot(shot: ShotProfile, attributes: Readonly<Attributes>, rules: DexterityRules): ShotProfile {
  if (attributes.destreza <= 0) return shot;
  return {
    ...shot,
    chargeMs: Math.round(shot.chargeMs * cut(attributes.destreza, rules.dexterityChargePct, rules.attributeCutMaxPct)),
    cooldownMs: Math.round(shot.cooldownMs * cut(attributes.destreza, rules.dexterityIntervalPct, rules.attributeCutMaxPct)),
  };
}

/** O que os pontos dão agora, em números redondos (o que a janela mostra). */
export interface AttributeBonus {
  /** Força: % a mais no dano do tiro. */
  shotDamagePct: number;
  /** Destreza: % a menos na puxada e no intervalo entre os tiros. */
  chargeCutPct: number;
  intervalCutPct: number;
  /** Espírito: % a mais no dano das habilidades e % a menos na recarga delas. */
  skillDamagePct: number;
  cooldownCutPct: number;
  /** Vitalidade: vida a mais (já com o "vida dos jogadores ×" do painel). */
  hp: number;
}

type BonusRules = Pick<
  CombatRules,
  'strengthShotPct' | 'dexterityChargePct' | 'dexterityIntervalPct' | 'spiritSkillPct' | 'spiritCooldownPct' | 'vitalityHp' | 'attributeCutMaxPct' | 'playerHpFactor'
>;

const pct = (value: number) => Math.round(value * 10) / 10;

export function attributeBonus(attributes: Readonly<Attributes>, rules: BonusRules): AttributeBonus {
  return {
    shotDamagePct: pct((strengthFactor(attributes, rules) - 1) * 100),
    chargeCutPct: pct((1 - cut(attributes.destreza, rules.dexterityChargePct, rules.attributeCutMaxPct)) * 100),
    intervalCutPct: pct((1 - cut(attributes.destreza, rules.dexterityIntervalPct, rules.attributeCutMaxPct)) * 100),
    skillDamagePct: pct((spiritDamageFactor(attributes, rules) - 1) * 100),
    cooldownCutPct: pct((1 - spiritCooldownFactor(attributes, rules)) * 100),
    hp: Math.round(vitalityHp(attributes, rules) * rules.playerHpFactor),
  };
}
