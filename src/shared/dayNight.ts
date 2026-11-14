// Dia e noite (decisão do dono, 14/11): um ciclo de dia (dayMs) e noite (nightMs). As contas são as mesmas no servidor
// (os bichos ficam mais fortes enquanto é noite) e no navegador (a luz do desenho e os olhos vermelhos).
//
// "Posição" = quantos ms do ciclo já passaram: de 0 até dayMs é dia; de dayMs até o fim, noite. A luz escurece nos
// últimos TWILIGHT_MS do dia e clareia nos primeiros (o amanhecer e o anoitecer ficam dentro do dia: a noite é sempre
// noite fechada, e é nela que os bichos estão mais fortes).

import { TWILIGHT_MS } from './constants';
import type { CombatRules } from './combatRules';

export type DayNightLengths = Pick<CombatRules, 'dayMs' | 'nightMs'>;

/** Quanto dura um dia inteiro (dia + noite), em ms. */
export function cycleMs(r: DayNightLengths): number {
  return Math.max(1, r.dayMs + r.nightMs);
}

/** Em que ponto do ciclo está o instante `t` (ms, de 0 até cycleMs). */
export function cyclePosition(t: number, r: DayNightLengths): number {
  const c = cycleMs(r);
  return ((t % c) + c) % c;
}

/** É noite nesse ponto do ciclo? */
export function isNightAt(position: number, r: DayNightLengths): boolean {
  return r.nightMs > 0 && position >= r.dayMs;
}

/** Quanto dura o amanhecer e o anoitecer (no máximo 1/4 do dia cada). */
export function twilightMs(r: DayNightLengths): number {
  return Math.min(TWILIGHT_MS, r.dayMs / 4);
}

/** A luz nesse ponto do ciclo: 1 de dia, 0 de noite, e a passagem suave no anoitecer e no amanhecer. */
export function daylightAt(position: number, r: DayNightLengths): number {
  if (r.nightMs <= 0) return 1;
  if (position >= r.dayMs) return 0;
  const t = twilightMs(r);
  if (t <= 0) return 1;
  if (position < t) return smooth(position / t); // amanhecendo
  if (position > r.dayMs - t) return smooth((r.dayMs - position) / t); // anoitecendo
  return 1;
}

/** Quanto falta (ms) para a próxima virada (do dia para a noite, ou da noite para o dia). */
export function msToNextTurn(position: number, r: DayNightLengths): number {
  return position < r.dayMs ? r.dayMs - position : cycleMs(r) - position;
}

function smooth(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}
