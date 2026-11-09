// Lê os monstros de data/monsters.json. O arquivo usa nomes em português para facilitar o
// balanceamento por quem não programa; aqui eles viram tipos do código e são conferidos.

import { readFileSync } from 'node:fs';
import { MONSTERS_FILE } from './paths';

export type AttackKind = 'bite' | 'strike' | 'spin' | 'projectile';

export interface MonsterAttack {
  kind: AttackKind;
  /** Tiles: alcance do golpe (ou distância máxima para atirar, no projétil). */
  range: number;
  /** Projétil: distância mínima que o monstro tenta manter do alvo. */
  minDistance: number;
  /** Tempo do aviso no chão antes do golpe acontecer. */
  windupMs: number;
  /** Tempo entre um ataque e outro. */
  intervalMs: number;
  damage: [number, number];
  /** Projétil: velocidade em tiles por segundo. */
  speed: number;
  /** Projétil: como ele aparece na tela (ex.: 'fruta'). */
  projectile: string;
}

export interface MonsterDef {
  id: string;
  name: string;
  level: number;
  hp: number;
  xp: number;
  stepMs: number;
  aggressive: boolean;
  aggroRange: number;
  chaseRange: number;
  respawnMs: number;
  attack: MonsterAttack;
  /** Só o Saci (por enquanto): some num redemoinho e aparece em outro lugar. */
  whirlwind: { distance: number; everyMs: number; lines: string[] } | null;
}

const ATTACK_KINDS: Record<string, AttackKind> = {
  mordida: 'bite',
  bote: 'strike',
  giro: 'spin',
  projetil: 'projectile',
};

class Reader {
  constructor(
    private readonly data: Record<string, unknown>,
    private readonly where: string,
  ) {}

  private fail(field: string, what: string): never {
    throw new Error(`Erro em data/monsters.json (${this.where}): o campo "${field}" ${what}.`);
  }

  number(field: string, opts: { min?: number; fallback?: number } = {}): number {
    const value = this.data[field] ?? opts.fallback;
    if (typeof value !== 'number' || !Number.isFinite(value)) this.fail(field, 'precisa ser um número');
    if (opts.min !== undefined && value < opts.min) this.fail(field, `precisa ser pelo menos ${opts.min}`);
    return value;
  }

  bool(field: string, fallback?: boolean): boolean {
    const value = this.data[field] ?? fallback;
    if (typeof value !== 'boolean') this.fail(field, 'precisa ser true ou false');
    return value;
  }

  text(field: string, fallback?: string): string {
    const value = this.data[field] ?? fallback;
    if (typeof value !== 'string' || !value.trim()) this.fail(field, 'precisa ser um texto');
    return value.trim();
  }

  range(field: string): [number, number] {
    const value = this.data[field];
    if (!Array.isArray(value) || value.length !== 2 || !value.every((v) => typeof v === 'number' && v >= 0) || value[0] > value[1]) {
      this.fail(field, 'precisa ser [mínimo, máximo], por exemplo [2, 5]');
    }
    return [value[0], value[1]];
  }

  object(field: string, optional = false): Record<string, unknown> | null {
    const value = this.data[field];
    if (value === undefined && optional) return null;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) this.fail(field, 'precisa ser um objeto { ... }');
    return value as Record<string, unknown>;
  }
}

export function parseMonsterDefs(json: unknown): Map<string, MonsterDef> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error('Erro em data/monsters.json: o arquivo precisa ser um objeto { "id-do-monstro": { ... } }.');
  }
  const defs = new Map<string, MonsterDef>();
  for (const [rawId, raw] of Object.entries(json as Record<string, unknown>)) {
    const id = rawId.trim().toLowerCase();
    if (typeof raw !== 'object' || raw === null) throw new Error(`Erro em data/monsters.json: "${rawId}" precisa ser um objeto.`);
    const r = new Reader(raw as Record<string, unknown>, `monstro "${rawId}"`);
    const a = new Reader(r.object('ataque')!, `ataque do monstro "${rawId}"`);
    const kindName = a.text('tipo');
    const kind = ATTACK_KINDS[kindName];
    if (!kind) throw new Error(`Erro em data/monsters.json (ataque do monstro "${rawId}"): tipo "${kindName}" não existe. Use: ${Object.keys(ATTACK_KINDS).join(', ')}.`);
    const whirl = r.object('redemoinho', true);
    let whirlwind: MonsterDef['whirlwind'] = null;
    if (whirl) {
      const w = new Reader(whirl, `redemoinho do monstro "${rawId}"`);
      const lines = whirl.falas;
      whirlwind = {
        distance: w.number('distancia', { min: 2, fallback: 4 }),
        everyMs: w.number('cadaMs', { min: 500, fallback: 7000 }),
        lines: Array.isArray(lines) ? lines.filter((l): l is string => typeof l === 'string' && l.trim() !== '') : [],
      };
    }
    defs.set(id, {
      id,
      name: r.text('nome'),
      level: r.number('nivel', { min: 1 }),
      hp: r.number('vida', { min: 1 }),
      xp: r.number('xp', { min: 0 }),
      stepMs: r.number('passoMs', { min: 50 }),
      aggressive: r.bool('agressivo', false),
      aggroRange: r.number('alcanceAgressao', { min: 0, fallback: 0 }),
      chaseRange: r.number('perseguicao', { min: 1, fallback: 8 }),
      respawnMs: r.number('renascerMs', { min: 0, fallback: 20000 }),
      attack: {
        kind,
        range: a.number('alcance', { min: 1, fallback: 1 }),
        minDistance: a.number('distanciaMinima', { min: 0, fallback: 2 }),
        windupMs: a.number('preparoMs', { min: 0 }),
        intervalMs: a.number('intervaloMs', { min: 100 }),
        damage: a.range('dano'),
        speed: a.number('velocidade', { min: 1, fallback: 8 }),
        projectile: a.text('projetil', 'pedra'),
      },
      whirlwind,
    });
  }
  return defs;
}

export function loadMonsterDefs(file = MONSTERS_FILE): Map<string, MonsterDef> {
  return parseMonsterDefs(JSON.parse(readFileSync(file, 'utf8')));
}
