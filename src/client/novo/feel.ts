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
}

export const DEFAULT_FEEL: Readonly<Feel> = Object.freeze({ shakeHitPx: 0, shakeHurtPx: 0, shakeMs: 150, hitStopMs: 0, particles: 0, hurtFlash: true });

/** Os limites de cada número (para os sliders e para conferir o que estava guardado). */
export const FEEL_LIMITS: Readonly<Record<Exclude<keyof Feel, 'hurtFlash'>, { max: number; step: number; label: string }>> = {
  shakeHitPx: { max: 20, step: 1, label: 'Tremor ao acertar (pixels)' },
  shakeHurtPx: { max: 30, step: 1, label: 'Tremor ao tomar dano (pixels)' },
  shakeMs: { max: 600, step: 10, label: 'Duração do tremor (ms)' },
  hitStopMs: { max: 200, step: 5, label: 'Pausa no impacto (ms)' },
  particles: { max: 40, step: 1, label: 'Faíscas por acerto' },
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
