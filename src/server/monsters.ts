// Lê os monstros de data/monsters.json. O arquivo usa nomes em português para facilitar o
// balanceamento por quem não programa; aqui eles viram tipos do código e são conferidos.

import { readFileSync } from 'node:fs';
import { Reader } from './data-reader';
import { MONSTERS_FILE } from './paths';

export type AttackKind = 'bite' | 'strike' | 'spin' | 'projectile' | 'charge';

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
  /** Investida: rastro de fogo que fica no caminho (null = sem fogo). */
  fire: { durationMs: number; damage: [number, number] } | null;
  /** Quanto o golpe empurra quem leva, em centímetros ("recuo"; a defesa segura boa parte). */
  pushCm: number;
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
  /** Só a Iara (por enquanto): o canto encanta quem está perto e puxa para ela; a esquiva solta. */
  song: MonsterSong | null;
  /** O que ele pode deixar para quem ajudou a derrubá-lo. */
  drops: MonsterDrop[];
  /** Ouro que cada um que ajudou ganha: sorteado entre [mínimo, máximo] ([0, 0] = nenhum). */
  gold: [number, number];
}

/** O canto (campo "canto" em data/monsters.json). */
export interface MonsterSong {
  /** De quanto em quanto tempo canta (se tem alguém por perto). */
  everyMs: number;
  /** Até quantos tiles dela o canto pega. */
  range: number;
  /** Tempo do aviso no chão antes de encantar (dá para sair ou esquivar). */
  windupMs: number;
  /** Quanto tempo o encanto dura (a esquiva solta antes). */
  durationMs: number;
  /** De quanto em quanto tempo puxa o encantado um passo para perto dela. */
  pullEveryMs: number;
  /** O que ela diz ao cantar (um balão, sorteado). */
  lines: string[];
}

/** Um item que o monstro pode deixar: `chance` em % (0 a 100), quantidade entre min e max. */
export interface MonsterDrop {
  item: string;
  chance: number;
  min: number;
  max: number;
}

const FILE = 'data/monsters.json';

/**
 * Recuo de cada tipo de golpe quando o monstro não diz o dele (centímetros): fruta e mordida empurram pouco (como a
 * pedra fraca do protótipo, 12 cm), a investida empurra como a pedra mais forte (34 cm).
 */
const DEFAULT_PUSH_CM: Record<AttackKind, number> = { projectile: 12, bite: 16, strike: 22, spin: 26, charge: 34 };
/** O maior recuo aceito (centímetros): mais que isso vira teleporte, não empurrão. */
const MAX_PUSH_CM = 100;

const ATTACK_KINDS: Record<string, AttackKind> = {
  mordida: 'bite',
  bote: 'strike',
  giro: 'spin',
  projetil: 'projectile',
  investida: 'charge',
};

export function parseMonsterDefs(json: unknown): Map<string, MonsterDef> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error('Erro em data/monsters.json: o arquivo precisa ser um objeto { "id-do-monstro": { ... } }.');
  }
  const defs = new Map<string, MonsterDef>();
  for (const [rawId, raw] of Object.entries(json as Record<string, unknown>)) {
    const id = rawId.trim().toLowerCase();
    if (typeof raw !== 'object' || raw === null) throw new Error(`Erro em data/monsters.json: "${rawId}" precisa ser um objeto.`);
    const r = new Reader(raw as Record<string, unknown>, FILE, `monstro "${rawId}"`);
    const a = new Reader(r.object('ataque')!, FILE, `ataque do monstro "${rawId}"`);
    const kindName = a.text('tipo');
    const kind = ATTACK_KINDS[kindName];
    if (!kind) throw new Error(`Erro em data/monsters.json (ataque do monstro "${rawId}"): tipo "${kindName}" não existe. Use: ${Object.keys(ATTACK_KINDS).join(', ')}.`);
    const pushCm = a.number('recuo', { min: 0, fallback: DEFAULT_PUSH_CM[kind] });
    if (pushCm > MAX_PUSH_CM) {
      throw new Error(`Erro em data/monsters.json (ataque do monstro "${rawId}"): "recuo" precisa ser no máximo ${MAX_PUSH_CM} (centímetros).`);
    }
    const fireData = a.object('rastroFogo', true);
    let fire: MonsterAttack['fire'] = null;
    if (fireData) {
      const f = new Reader(fireData, FILE, `rastro de fogo do monstro "${rawId}"`);
      fire = { durationMs: f.number('duracaoMs', { min: 200 }), damage: f.range('dano') };
    }
    const whirl = r.object('redemoinho', true);
    let whirlwind: MonsterDef['whirlwind'] = null;
    if (whirl) {
      const w = new Reader(whirl, FILE, `redemoinho do monstro "${rawId}"`);
      const lines = whirl.falas;
      whirlwind = {
        distance: w.number('distancia', { min: 2, fallback: 4 }),
        everyMs: w.number('cadaMs', { min: 500, fallback: 7000 }),
        lines: Array.isArray(lines) ? lines.filter((l): l is string => typeof l === 'string' && l.trim() !== '') : [],
      };
    }
    const songData = r.object('canto', true);
    let song: MonsterSong | null = null;
    if (songData) {
      const s = new Reader(songData, FILE, `canto do monstro "${rawId}"`);
      const lines = songData.falas;
      song = {
        everyMs: s.number('cadaMs', { min: 1000, fallback: 10000 }),
        range: s.number('alcance', { min: 1, fallback: 5 }),
        windupMs: s.number('preparoMs', { min: 300, fallback: 1300 }),
        durationMs: s.number('duracaoMs', { min: 500, fallback: 3000 }),
        pullEveryMs: s.number('puxaACadaMs', { min: 150, fallback: 450 }),
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
        fire,
        pushCm,
      },
      whirlwind,
      song,
      drops: parseDrops(r.list('itens'), rawId),
      gold: r.wholeRange('ouro'),
    });
  }
  return defs;
}

function parseDrops(list: unknown[], monster: string): MonsterDrop[] {
  return list.map((raw, i) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error(`Erro em ${FILE} (monstro "${monster}"): cada item de "itens" precisa ser { "item": ..., "chance": ... }.`);
    }
    const d = new Reader(raw as Record<string, unknown>, FILE, `item ${i + 1} do monstro "${monster}"`);
    const chance = d.number('chance', { min: 0 });
    if (chance > 100) throw new Error(`Erro em ${FILE} (item ${i + 1} do monstro "${monster}"): "chance" é em %, de 0 a 100.`);
    const [min, max] = d.amount('quantidade');
    return { item: d.text('item').toLowerCase(), chance, min, max };
  });
}

/** Confere se todo item que os monstros deixam existe em data/items.json. */
export function checkDrops(monsters: Map<string, MonsterDef>, items: ReadonlyMap<string, unknown>): void {
  for (const def of monsters.values()) {
    for (const drop of def.drops) {
      if (!items.has(drop.item)) {
        throw new Error(`Erro em ${FILE} (monstro "${def.id}"): o item "${drop.item}" não existe em data/items.json.`);
      }
    }
  }
}

export function loadMonsterDefs(file = MONSTERS_FILE): Map<string, MonsterDef> {
  return parseMonsterDefs(JSON.parse(readFileSync(file, 'utf8')));
}
