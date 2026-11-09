// Progressão do jogador: XP, níveis, vida e dano. Mexa nos números aqui para balancear.

export const MAX_LEVEL = 50;

/** XP necessária para sair do nível `level` e ir para o próximo. */
export function xpToNext(level: number): number {
  return Math.round(40 * Math.pow(level, 1.5));
}

/** Vida máxima em cada nível. */
export function maxHpFor(level: number): number {
  return 60 + (level - 1) * 12;
}

/** Dano do estilingue (mínimo e máximo) em cada nível. */
export function damageRange(level: number): [number, number] {
  return [2 + level, 5 + level * 2];
}
