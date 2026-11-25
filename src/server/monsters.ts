// Lê os monstros de data/monsters.json. O arquivo usa nomes em português para facilitar o
// balanceamento por quem não programa; aqui eles viram tipos do código e são conferidos.

import { readFileSync } from 'node:fs';
import { Reader } from './data-reader';
import { MONSTERS_FILE } from './paths';
import type { MonsterRank } from '../shared/protocol';

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
  /**
   * A poça (campo "poca" do ataque; o caldo da Cuca): onde o golpe que voa cai (ou acerta alguém), o chão fica queimando
   * por `durationMs`, com `damage` a cada meio segundo, na casa e nas vizinhas até `radius` casas (em cruz).
   */
  puddle: { durationMs: number; damage: [number, number]; radius: number } | null;
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
  /**
   * Casca (o tatu-bola, campo "casca"): o golpe que vem pela frente perde `block` (0 a 1) do dano; `halfArc` = metade do
   * ângulo da frente (radianos). Depois da investida ele fica tonto `dizzyMs`: parado e sem a casca.
   */
  shell: { block: number; halfArc: number; dizzyMs: number } | null;
  /** Enxame (o marimbondo, campo "desvioTiro" em %): a chance (0 a 1) de uma pedra ou flecha passar pelo meio sem acertar. */
  shotDodge: number;
  /** Só aparece de noite (o filhote de boitatá, "soNoite"): de dia a área fica vazia e ele vai embora ao amanhecer. */
  nightOnly: boolean;
  /**
   * Uma luta por noite (a Cuca, "desmaiaAteAmanhecer"; pedido do dono, 25/11): vencido, não renasce até a noite seguinte.
   * Quem vira NPC de dia (o NPC "soDeDia" com a mesma chave: a bruxa) fica desmaiada ali, à vista, até amanhecer.
   */
  faintsUntilDawn: boolean;
  /**
   * Sobe em galho (o sagui, campo "galho"; Sagui no galho, 23/11): calmo, vai até um galho livre da área dele (os pontos
   * `galho-sagui` do mapa), sobe e fica pendurado, jogando o golpe lá de cima. Desce quando alguém chega a `descendRange`
   * metros ou acerta nele, e sobe de novo depois de `climbAfterMs` calmo. Mapa sem galho: fica no chão, como sempre.
   */
  branch: MonsterBranch | null;
  /** Versão especial (campo "categoria": "elite" ou "raro"; os saguis raros, 24/11): o nome aparece com "(Elite)" ou "(Raro)". */
  rank: MonsterRank | null;
  /** O que ele pode deixar para quem ajudou a derrubá-lo. */
  drops: MonsterDrop[];
  /** Ouro que cada um que ajudou ganha: sorteado entre [mínimo, máximo] ([0, 0] = nenhum). */
  gold: [number, number];
}

/** O canto (campo "canto" em data/monsters.json). */
export interface MonsterSong {
  /**
   * O que acontece com quem fica na área ("efeito"): 'charm' = encanta e puxa para quem cantou (a Iara, "encanto", o
   * de sempre); 'sleep' = dorme por `durationMs`, sem andar nem atirar, e levar golpe acorda (a cantiga de ninar da
   * Cuca, "sono").
   */
  effect: 'charm' | 'sleep';
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

/** O galho (campo "galho" em data/monsters.json): "desceA" (metros) e "sobeDepoisMs". */
export interface MonsterBranch {
  /** Alguém chegou a esta distância (metros, do pé dele até o chão embaixo do galho): pula para o chão e luta. */
  descendRange: number;
  /** Calmo (sem alvo e sem levar golpe) por este tempo, volta para um galho. */
  climbAfterMs: number;
}

/** Um item que o monstro pode deixar: `chance` em % (0 a 100), quantidade entre min e max. */
export interface MonsterDrop {
  item: string;
  chance: number;
  min: number;
  max: number;
}

const FILE = 'data/monsters.json';
const RANKS: readonly MonsterRank[] = ['elite', 'raro'];

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
    const puddleData = a.object('poca', true);
    let puddle: MonsterAttack['puddle'] = null;
    if (puddleData) {
      const f = new Reader(puddleData, FILE, `poça do monstro "${rawId}"`);
      const radius = f.number('raio', { min: 0, fallback: 1 });
      if (!Number.isInteger(radius) || radius > 3) f.fail('raio', 'precisa ser um número inteiro de 0 a 3 (0 = só a casa onde cai)');
      puddle = { durationMs: f.number('duracaoMs', { min: 200 }), damage: f.range('dano'), radius };
      if (kind !== 'projectile') throw new Error(`Erro em ${FILE} (ataque do monstro "${rawId}"): só o golpe que voa ("tipo": "projetil") deixa poça.`);
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
      const effectName = s.optionalText('efeito').toLowerCase() || 'encanto';
      if (effectName !== 'encanto' && effectName !== 'sono') s.fail('efeito', 'precisa ser "encanto" (puxa, como a Iara) ou "sono" (dorme, como a Cuca)');
      song = {
        effect: effectName === 'sono' ? 'sleep' : 'charm',
        everyMs: s.number('cadaMs', { min: 1000, fallback: 10000 }),
        range: s.number('alcance', { min: 1, fallback: 5 }),
        windupMs: s.number('preparoMs', { min: 300, fallback: 1300 }),
        durationMs: s.number('duracaoMs', { min: 500, fallback: 3000 }),
        pullEveryMs: s.number('puxaACadaMs', { min: 150, fallback: 450 }),
        lines: Array.isArray(lines) ? lines.filter((l): l is string => typeof l === 'string' && l.trim() !== '') : [],
      };
    }
    const shellData = r.object('casca', true);
    let shell: MonsterDef['shell'] = null;
    if (shellData) {
      const c = new Reader(shellData, FILE, `casca do monstro "${rawId}"`);
      const block = c.number('seguraPorcento', { min: 0, fallback: 70 });
      const angle = c.number('angulo', { min: 10, fallback: 140 });
      if (block > 100) throw new Error(`Erro em ${FILE} (casca do monstro "${rawId}"): "seguraPorcento" é de 0 a 100.`);
      if (angle > 360) throw new Error(`Erro em ${FILE} (casca do monstro "${rawId}"): "angulo" é de 10 a 360 (graus).`);
      shell = { block: block / 100, halfArc: ((angle / 2) * Math.PI) / 180, dizzyMs: c.number('tontoMs', { min: 0, fallback: 2000 }) };
    }
    const branchData = r.object('galho', true);
    let branch: MonsterBranch | null = null;
    if (branchData) {
      const g = new Reader(branchData, FILE, `galho do monstro "${rawId}"`);
      branch = { descendRange: g.number('desceA', { min: 0, fallback: 3 }), climbAfterMs: g.number('sobeDepoisMs', { min: 0, fallback: 8000 }) };
      if (kind !== 'projectile') {
        throw new Error(`Erro em ${FILE} (monstro "${rawId}"): só quem joga de longe ("tipo": "projetil") sobe no galho.`);
      }
    }
    const rankName = r.optionalText('categoria').toLowerCase();
    if (rankName && !(RANKS as readonly string[]).includes(rankName)) {
      throw new Error(`Erro em ${FILE} (monstro "${rawId}"): "categoria" "${rankName}" não existe. Use: ${RANKS.join(' ou ')} (ou tire o campo).`);
    }
    const dodge = r.number('desvioTiro', { min: 0, fallback: 0 });
    if (dodge > 90) throw new Error(`Erro em ${FILE} (monstro "${rawId}"): "desvioTiro" é em %, de 0 a 90.`);
    const nightOnly = r.bool('soNoite', false);
    const faintsUntilDawn = r.bool('desmaiaAteAmanhecer', false);
    if (faintsUntilDawn && !nightOnly) {
      throw new Error(`Erro em ${FILE} (monstro "${rawId}"): "desmaiaAteAmanhecer" só vale para quem aparece só de noite ("soNoite": true).`);
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
        puddle,
        pushCm,
      },
      whirlwind,
      song,
      shell,
      shotDodge: dodge / 100,
      nightOnly,
      faintsUntilDawn,
      branch,
      rank: rankName ? (rankName as MonsterRank) : null,
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
