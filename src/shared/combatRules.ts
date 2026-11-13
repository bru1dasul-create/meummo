// Números do combate que o administrador ajusta no painel (aba "Combate"): a pedra com carga, a defesa e o quanto a
// defesa segura do empurrão. O padrão (revisão 17 do protótipo) está em constants.ts. O servidor manda os números
// para o navegador ao entrar e quando mudam: o navegador usa os mesmos (o andar com a defesa precisa bater com o do
// servidor; o anel da carga e o arco da defesa mostram o que vale).

import {
  CHARGE_DAMAGE_BONUS,
  CHARGE_FULL_MS,
  CHARGE_RANGE_MAX,
  CHARGE_RANGE_MIN,
  GUARD_BREAK_MS,
  GUARD_BREAK_PUSH_FACTOR,
  GUARD_DAMAGE_FACTOR,
  GUARD_DRAIN_PER_S,
  GUARD_HALF_ARC,
  GUARD_HIT_COST,
  GUARD_HIT_DAMAGE_COST,
  GUARD_PUSH_FACTOR,
  GUARD_READY_MS,
  GUARD_REARM_ENERGY,
  GUARD_REGEN_DELAY_MS,
  GUARD_REGEN_PER_S,
  GUARD_WALK_FACTOR,
} from './constants';

export interface CombatRules {
  /** Pedra com carga: tempo até a carga encher (ms). */
  chargeFullMs: number;
  /** Carga cheia: dano × (1 + chargeDamageBonus). */
  chargeDamageBonus: number;
  /** Alcance da pedra no mapa novo, sem carga e com a carga cheia (metros). */
  chargeRangeMin: number;
  chargeRangeMax: number;
  /** Defesa: tempo até proteger, depois de levantar (ms). */
  guardReadyMs: number;
  /** Metade do arco que a defesa cobre, em radianos (70° = 140° ao todo). */
  guardHalfArc: number;
  /** O que passa de um golpe defendido (0,25 = a defesa segura 75%). */
  guardDamageFactor: number;
  /** Energia que um golpe defendido gasta: guardHitCost + guardHitDamageCost × dano. */
  guardHitCost: number;
  guardHitDamageCost: number;
  /** Energia gasta por segundo segurando a defesa. */
  guardDrainPerS: number;
  /** Sem a defesa, a energia volta tanto por segundo, depois de guardRegenDelayMs. */
  guardRegenPerS: number;
  guardRegenDelayMs: number;
  /** Quebrou: só levanta de novo depois de guardBreakMs e com guardRearmEnergy de energia. */
  guardBreakMs: number;
  guardRearmEnergy: number;
  /** Andando com a defesa: × o andar devagar. */
  guardWalkFactor: number;
  /** O que passa do empurrão: com a defesa que segura o golpe e com a que quebra nele. */
  guardPushFactor: number;
  guardBreakPushFactor: number;
}

export const DEFAULT_COMBAT_RULES: Readonly<CombatRules> = Object.freeze({
  chargeFullMs: CHARGE_FULL_MS,
  chargeDamageBonus: CHARGE_DAMAGE_BONUS,
  chargeRangeMin: CHARGE_RANGE_MIN,
  chargeRangeMax: CHARGE_RANGE_MAX,
  guardReadyMs: GUARD_READY_MS,
  guardHalfArc: GUARD_HALF_ARC,
  guardDamageFactor: GUARD_DAMAGE_FACTOR,
  guardHitCost: GUARD_HIT_COST,
  guardHitDamageCost: GUARD_HIT_DAMAGE_COST,
  guardDrainPerS: GUARD_DRAIN_PER_S,
  guardRegenPerS: GUARD_REGEN_PER_S,
  guardRegenDelayMs: GUARD_REGEN_DELAY_MS,
  guardBreakMs: GUARD_BREAK_MS,
  guardRearmEnergy: GUARD_REARM_ENERGY,
  guardWalkFactor: GUARD_WALK_FACTOR,
  guardPushFactor: GUARD_PUSH_FACTOR,
  guardBreakPushFactor: GUARD_BREAK_PUSH_FACTOR,
});

/** Uma cópia dos números padrão (para mudar sem mexer no padrão). */
export function defaultCombatRules(): CombatRules {
  return { ...DEFAULT_COMBAT_RULES };
}
