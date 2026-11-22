// O "game feel" (pedido do dono, 17/11): o tremor de tela, a pausa no impacto, as faíscas de cada acerto e o clarão ao
// tomar dano. É só da tela de quem joga (não passa pelo servidor) e fica guardado neste navegador. O padrão é o jogo
// como era antes do painel de ajustes: sem tremor, sem pausa, sem faíscas, com o clarão.

export interface Feel {
  /** Tremor ao acertar um bicho e ao tomar dano: quantos pixels a tela mexe (0 = não treme). */
  shakeHitPx: number;
  shakeHurtPx: number;
  /** Quanto o tremor dura (ms). */
  shakeMs: number;
  /** Pausa no impacto (hit stop): o desenho congela este tempo quando você acerta (ms; 0 = sem pausa). */
  hitStopMs: number;
  /** Faíscas que saltam do bicho a cada acerto seu (0 = nenhuma). */
  particles: number;
  /** O clarão na tela ao tomar dano. */
  hurtFlash: boolean;
  /**
   * As suas habilidades caindo (a Chuva chegando ao chão, a Flecha Ancestral batendo ou explodindo): o tremor (pixels) e
   * a pausa no impacto (ms) no mais forte — 5 pontos e o degrau forte da carga. Mais fraco, menos (veja skillImpactFeel;
   * pedido do dono, 22/11: "sensação de impactos também por nível"). 0 = desligado.
   */
  shakeSkillPx: number;
  hitStopSkillMs: number;
}

export const DEFAULT_FEEL: Readonly<Feel> = Object.freeze({ shakeHitPx: 0, shakeHurtPx: 0, shakeMs: 150, hitStopMs: 0, particles: 0, hurtFlash: true, shakeSkillPx: 10, hitStopSkillMs: 60 });

/** Os limites de cada número (para os sliders e para conferir o que estava guardado). */
export const FEEL_LIMITS: Readonly<Record<Exclude<keyof Feel, 'hurtFlash'>, { max: number; step: number; label: string }>> = {
  shakeHitPx: { max: 20, step: 1, label: 'Tremor ao acertar (pixels)' },
  shakeHurtPx: { max: 30, step: 1, label: 'Tremor ao tomar dano (pixels)' },
  shakeMs: { max: 600, step: 10, label: 'Duração do tremor (ms)' },
  hitStopMs: { max: 200, step: 5, label: 'Pausa no impacto (ms)' },
  particles: { max: 40, step: 1, label: 'Faíscas por acerto' },
  shakeSkillPx: { max: 30, step: 1, label: 'Tremor das habilidades, no mais forte (pixels)' },
  hitStopSkillMs: { max: 200, step: 5, label: 'Pausa das habilidades, no mais forte (ms)' },
};

const KEY = 'pindorama.feel';

/** Confere o que veio do navegador (ou de onde for): só números dentro dos limites; o resto fica no padrão. */
export function cleanFeel(saved: unknown): Feel {
  const out: Feel = { ...DEFAULT_FEEL };
  if (typeof saved !== 'object' || saved === null) return out;
  const raw = saved as Record<string, unknown>;
  for (const key of Object.keys(FEEL_LIMITS) as (keyof typeof FEEL_LIMITS)[]) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = Math.max(0, Math.min(FEEL_LIMITS[key].max, value));
  }
  if (typeof raw.hurtFlash === 'boolean') out.hurtFlash = raw.hurtFlash;
  return out;
}

export function loadFeel(): Feel {
  try {
    return cleanFeel(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_FEEL };
  }
}

export function saveFeel(feel: Feel): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(feel));
  } catch {
    // navegador sem armazenamento: vale só até fechar
  }
}

/** Só o que está diferente do padrão (para o "Copiar valores"). */
export function changedFeel(feel: Feel): Partial<Feel> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_FEEL) as (keyof Feel)[]) if (feel[key] !== DEFAULT_FEEL[key]) out[key] = feel[key];
  return out as Partial<Feel>;
}

/** Quanto a tela está deslocada agora, num tremor de `px` pixels que começou em `start` e dura `ms` (some aos poucos). */
export function shakeOffset(now: number, start: number, ms: number, px: number): { x: number; y: number } {
  const t = ms > 0 ? (now - start) / ms : 1;
  if (t < 0 || t >= 1 || px <= 0) return { x: 0, y: 0 };
  const strength = px * (1 - t) * (1 - t);
  return { x: Math.round(Math.sin(now * 0.09) * strength), y: Math.round(Math.cos(now * 0.13) * strength) };
}

/**
 * A força de um impacto de habilidade, de 0 (1 ponto, puxada fraca) a 1 (5 pontos, puxada forte): os pontos pesam um
 * pouco mais que o degrau da carga.
 */
export function skillImpactPower(rank: number, level: number): number {
  const r = Math.min(1, Math.max(0, (rank - 1) / 4));
  const l = Math.min(1, Math.max(0, (level - 1) / 2));
  return 0.55 * r + 0.45 * l;
}

/**
 * O tremor e a pausa de um impacto de habilidade com esta força: o tremor vai de um quarto ao máximo (e dura até o dobro);
 * a pausa vai de nada ao máximo.
 */
export function skillImpactFeel(feel: Feel, power: number): { shakePx: number; shakeMs: number; stopMs: number } {
  const p = Math.min(1, Math.max(0, power));
  return {
    shakePx: Math.round(feel.shakeSkillPx * (0.25 + 0.75 * p)),
    shakeMs: Math.round(feel.shakeMs * (1 + p)),
    stopMs: Math.round(feel.hitStopSkillMs * p),
  };
}
