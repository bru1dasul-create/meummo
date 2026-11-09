// Habilidades do jogador. O ataque básico (estilingue) e a esquiva ficam em constants.ts.

export type SkillKind = 'arc' | 'heal';

export interface SkillDef {
  name: string;
  /** Tecla no computador (também funciona 1, 2...). */
  key: string;
  cooldownMs: number;
  kind: SkillKind;
  /** arc: multiplicador do dano; heal: fração da vida máxima recuperada. */
  power: number;
  description: string;
}

export const SKILLS: SkillDef[] = [
  {
    name: 'Bordunada',
    key: 'Q',
    cooldownMs: 4000,
    kind: 'arc',
    power: 2.2,
    description: 'Golpe de borduna que acerta os 3 quadrados à sua frente.',
  },
  {
    name: 'Fôlego',
    key: 'E',
    cooldownMs: 20000,
    kind: 'heal',
    power: 0.3,
    description: 'Respira fundo e recupera 30% da vida.',
  },
];
