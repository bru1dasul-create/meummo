// Ajustes do administrador: o painel (/admin) muda números do jogo — monstros, itens, loja, missões e combate — sem mexer nos
// arquivos do projeto. Os ajustes ficam num arquivo separado (padrão: saves/ajustes.json, fora do Git): assim
// atualizar o jogo nunca briga com eles, e eles continuam valendo depois de cada atualização.
//
// Cada ajuste passa pelos mesmos leitores de data/*.json: valor inválido é recusado com o erro em português e
// nada muda. Ajuste aceito vale na hora: os objetos de monstros, itens e NPCs que o jogo usa são atualizados no
// lugar (o mundo inteiro enxerga o valor novo) e o mundo avisa quem está jogando (veja Realm.tuningChanged).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_COMBAT_RULES, defaultCombatRules, type CombatRules } from '../shared/combatRules';
import type { ItemInfo } from '../shared/items';
import type { GameMap } from '../shared/map';
import type { QuestInfo } from '../shared/quests';
import { parseItemDefs } from './items';
import { checkDrops, parseMonsterDefs, type MonsterDef } from './monsters';
import { checkNpcs, parseNpcDefs, type NpcDef } from './npcs';
import { ITEMS_FILE, MONSTERS_FILE, NPCS_FILE, QUESTS_FILE } from './paths';
import { checkQuests, nameQuestGoals, parseQuestDefs } from './quests';

/** Os arquivos de dados que o painel ajusta (com o nome em português, como no arquivo de ajustes). */
export type TuningFile = 'monstros' | 'itens' | 'npcs' | 'areas' | 'missoes' | 'combate';
export const TUNING_FILES: readonly TuningFile[] = ['monstros', 'itens', 'npcs', 'areas', 'missoes', 'combate'];

/**
 * Uma área de monstros de um mapa: o padrão vem do mapa (o [mundo] desenha no Tiled); o painel muda qual monstro e
 * quantos. A chave é `mapa#n` (n = a ordem da área no mapa, começando em 1).
 */
export interface AreaDef {
  id: string;
  map: string;
  index: number;
  name: string;
  detail: string;
  monster: string;
  count: number;
}

/** No máximo tantos monstros por área (mais que isso pesa no servidor e no celular). */
const AREA_MAX = 50;

/** O padrão das áreas: o que está nos mapas. */
function baseAreas(maps: readonly GameMap[]): Raw {
  const out: Raw = {};
  for (const map of maps) {
    map.monsterZones.forEach((zone, i) => {
      out[`${map.id}#${i + 1}`] = { monstro: zone.monster, quantidade: zone.count };
    });
  }
  return out;
}

/** Confere as áreas (monstro que existe, quantidade de 0 a AREA_MAX). Monstro que não existe só é erro se foi ajustado. */
function parseAreas(json: Raw, maps: readonly GameMap[], monsters: ReadonlyMap<string, MonsterDef>): Map<string, AreaDef> {
  const areas = new Map<string, AreaDef>();
  for (const map of maps) {
    map.monsterZones.forEach((zone, i) => {
      const id = `${map.id}#${i + 1}`;
      const raw = isObject(json[id]) ? (json[id] as Raw) : {};
      const name = `${map.name} · área ${i + 1}`;
      const monster = typeof raw.monstro === 'string' ? raw.monstro.trim().toLowerCase() : zone.monster;
      const count = raw.quantidade ?? zone.count;
      if (monster !== zone.monster && !monsters.has(monster)) {
        throw new Error(`Erro nos ajustes (${name}): o monstro "${monster}" não existe. Use um destes: ${[...monsters.keys()].join(', ')}.`);
      }
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > AREA_MAX) {
        throw new Error(`Erro nos ajustes (${name}): "quantidade" precisa ser um número inteiro de 0 a ${AREA_MAX}.`);
      }
      const where = `x ${zone.x}–${zone.x + zone.w}, y ${zone.y}–${zone.y + zone.h}`;
      const detail = `${monsters.get(monster)?.name ?? monster} · ${where}`;
      areas.set(id, { id, map: map.id, index: i + 1, name, detail, monster, count });
    });
  }
  return areas;
}

type CombatPartId = 'carga' | 'defesa' | 'recuo';

/** Uma parte dos números do combate, como o painel mostra (em ms, %, graus e metros). */
export interface CombatPart {
  id: CombatPartId;
  name: string;
  detail: string;
  values: Record<string, number>;
}

const COMBAT_PARTS: { id: CombatPartId; name: string; detail: string }[] = [
  { id: 'carga', name: 'Pedra com carga', detail: 'segurar o estilingue: a pedra vai mais longe e bate mais forte' },
  { id: 'defesa', name: 'Defesa', detail: 'segura os golpes que vêm pela frente e gasta energia (de 0 a 100)' },
  { id: 'recuo', name: 'Empurrão (recuo)', detail: 'quanto cada monstro empurra fica na aba Monstros (Empurrão do golpe)' },
];

/** Um número do combate no painel: a parte, o nome no arquivo de ajustes, os limites e como ler dos números do jogo. */
interface CombatNumber {
  parte: CombatPartId;
  campo: string;
  rotulo: string;
  tipo: 'inteiro' | 'numero' | 'porcento';
  min: number;
  max: number;
  dica?: string;
  ler: (rules: CombatRules) => number;
}

const COMBAT_NUMBERS: CombatNumber[] = [
  { parte: 'carga', campo: 'tempoMs', rotulo: 'Tempo para carregar (ms)', tipo: 'inteiro', min: 100, max: 5000, dica: 'segurando o estilingue', ler: (r) => r.chargeFullMs },
  {
    parte: 'carga',
    campo: 'danoPorcento',
    rotulo: 'Dano com a carga cheia (%)',
    tipo: 'inteiro',
    min: 100,
    max: 500,
    dica: '200 = o dobro do normal',
    ler: (r) => Math.round((1 + r.chargeDamageBonus) * 100),
  },
  { parte: 'carga', campo: 'alcanceMinimo', rotulo: 'Alcance sem carga (m)', tipo: 'numero', min: 2, max: 20, dica: 'no mapa novo', ler: (r) => r.chargeRangeMin },
  { parte: 'carga', campo: 'alcanceMaximo', rotulo: 'Alcance com a carga cheia (m)', tipo: 'numero', min: 2, max: 20, dica: 'no mapa novo', ler: (r) => r.chargeRangeMax },
  {
    parte: 'defesa',
    campo: 'seguraPorcento',
    rotulo: 'Quanto do golpe ela segura (%)',
    tipo: 'porcento',
    min: 0,
    max: 100,
    dica: '75 = passa só 25% do dano',
    ler: (r) => Math.round((1 - r.guardDamageFactor) * 100),
  },
  {
    parte: 'defesa',
    campo: 'angulo',
    rotulo: 'Ângulo que ela cobre (graus)',
    tipo: 'inteiro',
    min: 30,
    max: 360,
    dica: '140 = a frente; 360 = todos os lados',
    ler: (r) => Math.round((r.guardHalfArc * 2 * 180) / Math.PI),
  },
  { parte: 'defesa', campo: 'preparoMs', rotulo: 'Tempo para subir (ms)', tipo: 'inteiro', min: 0, max: 2000, dica: 'antes disso ainda não protege', ler: (r) => r.guardReadyMs },
  { parte: 'defesa', campo: 'gastoPorGolpe', rotulo: 'Energia que cada golpe gasta', tipo: 'numero', min: 0, max: 100, ler: (r) => r.guardHitCost },
  { parte: 'defesa', campo: 'gastoPorDano', rotulo: 'Energia a mais por ponto de dano do golpe', tipo: 'numero', min: 0, max: 10, ler: (r) => r.guardHitDamageCost },
  { parte: 'defesa', campo: 'gastoPorSegundo', rotulo: 'Energia gasta por segundo segurando', tipo: 'numero', min: 0, max: 100, ler: (r) => r.guardDrainPerS },
  { parte: 'defesa', campo: 'recuperaPorSegundo', rotulo: 'Energia que volta por segundo', tipo: 'numero', min: 1, max: 200, ler: (r) => r.guardRegenPerS },
  {
    parte: 'defesa',
    campo: 'esperaMs',
    rotulo: 'Espera para a energia voltar (ms)',
    tipo: 'inteiro',
    min: 0,
    max: 10000,
    dica: 'depois de soltar a defesa ou de levar um golpe nela',
    ler: (r) => r.guardRegenDelayMs,
  },
  { parte: 'defesa', campo: 'quebradaMs', rotulo: 'Quebrou: tempo até levantar de novo (ms)', tipo: 'inteiro', min: 0, max: 10000, ler: (r) => r.guardBreakMs },
  { parte: 'defesa', campo: 'energiaParaLevantar', rotulo: 'Quebrou: energia para levantar de novo', tipo: 'inteiro', min: 0, max: 100, ler: (r) => r.guardRearmEnergy },
  {
    parte: 'defesa',
    campo: 'andarPorcento',
    rotulo: 'Andando com ela (% do andar devagar)',
    tipo: 'porcento',
    min: 10,
    max: 100,
    ler: (r) => Math.round(r.guardWalkFactor * 100),
  },
  {
    parte: 'recuo',
    campo: 'defesaSeguraPorcento',
    rotulo: 'Defesa que segura o golpe: quanto do empurrão ela segura (%)',
    tipo: 'porcento',
    min: 0,
    max: 100,
    dica: '75 = passa só 25% do empurrão',
    ler: (r) => Math.round((1 - r.guardPushFactor) * 100),
  },
  {
    parte: 'recuo',
    campo: 'defesaQuebradaPorcento',
    rotulo: 'Defesa que quebra no golpe: quanto do empurrão ela segura (%)',
    tipo: 'porcento',
    min: 0,
    max: 100,
    ler: (r) => Math.round((1 - r.guardBreakPushFactor) * 100),
  },
];

/** O padrão dos números do combate, como no arquivo de ajustes (parte → campo → valor). */
function baseCombat(): Raw {
  const out: Record<string, Raw> = {};
  for (const n of COMBAT_NUMBERS) (out[n.parte] ??= {})[n.campo] = n.ler(DEFAULT_COMBAT_RULES);
  return out;
}

/** Confere os números do combate (cada um nos seus limites) e monta os números que o jogo usa. */
function parseCombat(json: Raw): { parts: Map<string, CombatPart>; rules: CombatRules } {
  const values: Record<CombatPartId, Record<string, number>> = { carga: {}, defesa: {}, recuo: {} };
  for (const n of COMBAT_NUMBERS) {
    const section = isObject(json[n.parte]) ? (json[n.parte] as Raw) : {};
    const value = section[n.campo] ?? n.ler(DEFAULT_COMBAT_RULES);
    const whole = n.tipo !== 'numero';
    if (typeof value !== 'number' || !Number.isFinite(value) || (whole && !Number.isInteger(value)) || value < n.min || value > n.max) {
      throw new Error(`Erro nos ajustes (Combate › ${n.rotulo}): precisa ser um número${whole ? ' inteiro' : ''} de ${n.min} a ${n.max}.`);
    }
    values[n.parte][n.campo] = value;
  }
  const c = values.carga;
  const d = values.defesa;
  const r = values.recuo;
  if (c.alcanceMaximo! < c.alcanceMinimo!) {
    throw new Error('Erro nos ajustes (Combate › Pedra com carga): o alcance com a carga cheia não pode ser menor que o alcance sem carga.');
  }
  const rules: CombatRules = {
    chargeFullMs: c.tempoMs!,
    chargeDamageBonus: c.danoPorcento! / 100 - 1,
    chargeRangeMin: c.alcanceMinimo!,
    chargeRangeMax: c.alcanceMaximo!,
    guardReadyMs: d.preparoMs!,
    guardHalfArc: ((d.angulo! / 2) * Math.PI) / 180,
    guardDamageFactor: 1 - d.seguraPorcento! / 100,
    guardHitCost: d.gastoPorGolpe!,
    guardHitDamageCost: d.gastoPorDano!,
    guardDrainPerS: d.gastoPorSegundo!,
    guardRegenPerS: d.recuperaPorSegundo!,
    guardRegenDelayMs: d.esperaMs!,
    guardBreakMs: d.quebradaMs!,
    guardRearmEnergy: d.energiaParaLevantar!,
    guardWalkFactor: d.andarPorcento! / 100,
    guardPushFactor: 1 - r.defesaSeguraPorcento! / 100,
    guardBreakPushFactor: 1 - r.defesaQuebradaPorcento! / 100,
  };
  const parts = new Map<string, CombatPart>(COMBAT_PARTS.map((p) => [p.id, { ...p, values: values[p.id] }]));
  return { parts, rules };
}

/** Como o painel mostra e confere cada campo. */
export type FieldKind = 'inteiro' | 'numero' | 'faixa' | 'sim-nao' | 'texto' | 'texto-longo' | 'itens' | 'itens-qtd' | 'porcento';

/** Tamanho máximo dos textos (o curto: nomes e falas; o longo: o que o NPC conta numa missão). */
const TEXT_MAX = 300;
const LONG_TEXT_MAX = 600;
/** Lista de itens com quantidade (recompensa de missão): até tantos itens, cada um até tantas unidades. */
const ITEM_LIST_MAX = 8;
const ITEM_COUNT_MAX = 99;

interface FieldSpec<Def> {
  /** Caminho no arquivo de dados (ex.: 'ataque.dano'). */
  campo: string;
  rotulo: string;
  tipo: FieldKind;
  dica?: string;
  /** O valor que o jogo está usando (lido do que já foi conferido). */
  ler: (def: Def) => unknown;
  /** Se o campo vale para este item (ex.: "cura" só para consumível). Sem isto, vale para todos. */
  vale?: (def: Def) => boolean;
}

const MONSTER_FIELDS: FieldSpec<MonsterDef>[] = [
  { campo: 'vida', rotulo: 'Vida', tipo: 'inteiro', ler: (d) => d.hp },
  { campo: 'ataque.dano', rotulo: 'Dano do golpe', tipo: 'faixa', ler: (d) => d.attack.damage },
  { campo: 'ataque.preparoMs', rotulo: 'Aviso no chão (ms)', tipo: 'inteiro', dica: 'maior = mais tempo para desviar', ler: (d) => d.attack.windupMs },
  { campo: 'ataque.intervaloMs', rotulo: 'Tempo entre golpes (ms)', tipo: 'inteiro', ler: (d) => d.attack.intervalMs },
  { campo: 'ataque.recuo', rotulo: 'Empurrão do golpe (cm)', tipo: 'inteiro', dica: 'até 100; a defesa segura 75%', ler: (d) => d.attack.pushCm },
  { campo: 'xp', rotulo: 'XP que dá', tipo: 'inteiro', ler: (d) => d.xp },
  { campo: 'ouro', rotulo: 'Ouro que deixa', tipo: 'faixa', ler: (d) => d.gold },
  { campo: 'passoMs', rotulo: 'Tempo por passo (ms)', tipo: 'inteiro', dica: 'menor = mais rápido', ler: (d) => d.stepMs },
  { campo: 'agressivo', rotulo: 'Ataca sozinho', tipo: 'sim-nao', ler: (d) => d.aggressive },
  { campo: 'alcanceAgressao', rotulo: 'Percebe você a (tiles)', tipo: 'inteiro', dica: 'só vale se ataca sozinho', ler: (d) => d.aggroRange },
  { campo: 'perseguicao', rotulo: 'Persegue até (tiles)', tipo: 'inteiro', ler: (d) => d.chaseRange },
  { campo: 'renascerMs', rotulo: 'Renasce em (ms)', tipo: 'inteiro', ler: (d) => d.respawnMs },
  // o canto (só a Iara, por enquanto)
  { campo: 'canto.cadaMs', rotulo: 'Canta a cada (ms)', tipo: 'inteiro', ler: (d) => d.song?.everyMs, vale: (d) => d.song !== null },
  { campo: 'canto.alcance', rotulo: 'Alcance do canto (tiles)', tipo: 'inteiro', ler: (d) => d.song?.range, vale: (d) => d.song !== null },
  { campo: 'canto.preparoMs', rotulo: 'Aviso do canto (ms)', tipo: 'inteiro', dica: 'maior = mais tempo para sair da área', ler: (d) => d.song?.windupMs, vale: (d) => d.song !== null },
  { campo: 'canto.duracaoMs', rotulo: 'Encanto dura (ms)', tipo: 'inteiro', dica: 'a esquiva solta antes', ler: (d) => d.song?.durationMs, vale: (d) => d.song !== null },
  { campo: 'canto.puxaACadaMs', rotulo: 'Puxa um passo a cada (ms)', tipo: 'inteiro', dica: 'menor = puxa mais forte', ler: (d) => d.song?.pullEveryMs, vale: (d) => d.song !== null },
];

const ITEM_FIELDS: FieldSpec<ItemInfo>[] = [
  { campo: 'preco', rotulo: 'Preço na loja', tipo: 'inteiro', dica: '0 = não se compra nem se vende', ler: (d) => d.price },
  { campo: 'cura', rotulo: 'Cura', tipo: 'inteiro', ler: (d) => d.heal, vale: (d) => d.kind === 'consumable' },
  { campo: 'recargaMs', rotulo: 'Espera até usar outro (ms)', tipo: 'inteiro', ler: (d) => d.cooldownMs, vale: (d) => d.kind === 'consumable' },
  { campo: 'dano', rotulo: 'Dano', tipo: 'inteiro', ler: (d) => d.bonus.damage, vale: (d) => d.kind === 'equipment' },
  { campo: 'vida', rotulo: 'Vida', tipo: 'inteiro', ler: (d) => d.bonus.hp, vale: (d) => d.kind === 'equipment' },
  { campo: 'defesa', rotulo: 'Defesa', tipo: 'inteiro', ler: (d) => d.bonus.defense, vale: (d) => d.kind === 'equipment' },
];

const AREA_FIELDS: FieldSpec<AreaDef>[] = [
  { campo: 'monstro', rotulo: 'Qual monstro', tipo: 'texto', dica: 'a chave dele (ex.: sagui, jararaca); a lista está na aba Monstros', ler: (d) => d.monster },
  { campo: 'quantidade', rotulo: 'Quantos', tipo: 'inteiro', dica: `0 = nenhum; até ${AREA_MAX}`, ler: (d) => d.count },
];

const QUEST_FIELDS: FieldSpec<QuestInfo>[] = [
  { campo: 'nome', rotulo: 'Nome da missão', tipo: 'texto', ler: (d) => d.name },
  { campo: 'pedido', rotulo: 'O que diz ao pedir', tipo: 'texto-longo', dica: 'aparece na conversa, antes de aceitar', ler: (d) => d.ask },
  { campo: 'concluida', rotulo: 'O que diz ao concluir', tipo: 'texto-longo', ler: (d) => d.done },
  {
    campo: 'objetivo.rotulo',
    rotulo: 'Objetivo na tela',
    tipo: 'texto',
    dica: 'vazio = o texto automático (ex.: "Derrotar 5 Sagui")',
    ler: (d) => d.goalLabel ?? '',
  },
  { campo: 'objetivo.quantidade', rotulo: 'Quantos', tipo: 'inteiro', dica: 'pelo menos 1', ler: (d) => d.goal.count, vale: (d) => d.goal.kind !== 'talk' },
  {
    campo: 'objetivo.monstro',
    rotulo: 'Qual monstro',
    tipo: 'texto',
    dica: 'a chave dele (ex.: sagui, jararaca); a lista está na aba Monstros',
    ler: (d) => (d.goal.kind === 'kill' ? d.goal.monster : ''),
    vale: (d) => d.goal.kind === 'kill',
  },
  {
    campo: 'objetivo.item',
    rotulo: 'Qual item',
    tipo: 'texto',
    dica: 'a chave dele (ex.: couro_jararaca); a lista está na aba Itens',
    ler: (d) => (d.goal.kind === 'deliver' ? d.goal.item : ''),
    vale: (d) => d.goal.kind === 'deliver',
  },
  { campo: 'nivelMinimo', rotulo: 'Nível mínimo', tipo: 'inteiro', dica: 'pelo menos 1', ler: (d) => d.minLevel },
  { campo: 'repetivel', rotulo: 'Pode fazer de novo', tipo: 'sim-nao', ler: (d) => d.repeatable },
  { campo: 'recompensa.xp', rotulo: 'Recompensa: XP', tipo: 'inteiro', ler: (d) => d.reward.xp },
  { campo: 'recompensa.ouro', rotulo: 'Recompensa: ouro', tipo: 'inteiro', ler: (d) => d.reward.gold },
  {
    campo: 'recompensa.itens',
    rotulo: 'Recompensa: itens',
    tipo: 'itens-qtd',
    dica: `até ${ITEM_LIST_MAX} itens`,
    ler: (d) => d.reward.items.map((s) => ({ item: s.item, quantidade: s.n })),
  },
];

const COMBAT_FIELDS: FieldSpec<CombatPart>[] = COMBAT_NUMBERS.map((n) => ({
  campo: n.campo,
  rotulo: n.rotulo,
  tipo: n.tipo,
  dica: n.dica ? `${n.dica} (de ${n.min} a ${n.max})` : `de ${n.min} a ${n.max}`,
  ler: (d: CombatPart) => d.values[n.campo],
  vale: (d: CombatPart) => d.id === n.parte,
}));

const NPC_FIELDS: FieldSpec<NpcDef>[] = [
  { campo: 'fala', rotulo: 'O que diz', tipo: 'texto', ler: (d) => d.line },
  { campo: 'mapa', rotulo: 'Mapa onde fica', tipo: 'texto', dica: 'o nome do arquivo do mapa (ex.: capao). Mais fácil: no jogo, menu ADM → trazer para cá', ler: (d) => d.map },
  { campo: 'x', rotulo: 'Posição x', tipo: 'numero', dica: 'onde fica o pé (no mapa novo, em metros)', ler: (d) => d.x },
  { campo: 'y', rotulo: 'Posição y', tipo: 'numero', dica: 'onde fica o pé (no mapa novo, em metros)', ler: (d) => d.y },
  { campo: 'loja.vende', rotulo: 'O que vende', tipo: 'itens', ler: (d) => d.shop?.sells ?? [], vale: (d) => d.shop !== null },
  { campo: 'loja.compraPor', rotulo: 'Paga pelo que você vende (%)', tipo: 'porcento', dica: '50 = metade do preço', ler: (d) => d.shop?.buyPercent ?? 0, vale: (d) => d.shop !== null },
];

type Raw = Record<string, unknown>;
/** Ajustes: arquivo → id → campos (no formato dos arquivos de dados, só o que mudou). */
export type Overrides = Partial<Record<TuningFile, Record<string, Raw>>>;

interface Defs {
  monsters: Map<string, MonsterDef>;
  items: Map<string, ItemInfo>;
  npcs: Map<string, NpcDef>;
  areas: Map<string, AreaDef>;
  quests: Map<string, QuestInfo>;
  combatParts: Map<string, CombatPart>;
  combat: CombatRules;
}

/** O conteúdo de data/monsters.json, data/items.json, data/npcs.json e data/missoes.json (sem missões = nenhuma). */
export interface BaseData {
  monstros: unknown;
  itens: unknown;
  npcs: unknown;
  missoes?: unknown;
}

export type TuningResult = { ok: true } | { ok: false; erro: string };

/** O que o painel mostra. */
export interface TuningView {
  /** Problema com os ajustes salvos ao ligar (foram deixados de lado); null = tudo certo. */
  problema: string | null;
  /** Onde os ajustes ficam guardados (null = só na memória, como nos testes). */
  arquivo: string | null;
  grupos: {
    arquivo: TuningFile;
    titulo: string;
    lista: {
      id: string;
      nome: string;
      detalhe: string;
      campos: { campo: string; rotulo: string; tipo: FieldKind; dica?: string; valor: unknown; padrao: unknown; ajustado: boolean }[];
    }[];
  }[];
  /** Para os campos de lista de itens (o que a loja vende). */
  itens: { id: string; nome: string; preco: number }[];
}

const TITLES: Record<TuningFile, string> = {
  monstros: 'Monstros',
  itens: 'Itens',
  npcs: 'Loja e personagens',
  areas: 'Áreas de monstros',
  missoes: 'Missões',
  combate: 'Combate',
};
const PART_NAMES: Record<string, string> = { weapon: 'arma', head: 'cabeça', body: 'corpo', charm: 'amuleto' };
const KIND_NAMES: Record<ItemInfo['kind'], string> = { equipment: 'Equipamento', consumable: 'Consumível', material: 'Material' };

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Lê os arquivos de dados do projeto. */
export function loadBaseData(): BaseData {
  return { monstros: readJson(MONSTERS_FILE), itens: readJson(ITEMS_FILE), npcs: readJson(NPCS_FILE), missoes: readJson(QUESTS_FILE) };
}

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Junta o ajuste por cima do padrão: objetos se misturam; números, textos e listas trocam inteiros. */
function merge(base: unknown, over: unknown): unknown {
  if (!isObject(base) || !isObject(over)) return over === undefined ? base : over;
  const result: Raw = { ...base };
  for (const [key, value] of Object.entries(over)) result[key] = merge(base[key], value);
  return result;
}

function getPath(obj: unknown, parts: string[]): unknown {
  let current = obj;
  for (const part of parts) {
    if (!isObject(current)) return undefined;
    current = current[part];
  }
  return current;
}

function setPath(obj: Raw, parts: string[], value: unknown): void {
  let current = obj;
  for (const part of parts.slice(0, -1)) {
    if (!isObject(current[part])) current[part] = {};
    current = current[part] as Raw;
  }
  current[parts.at(-1)!] = value;
}

/** Tira um campo e limpa os objetos que ficaram vazios. */
function deletePath(obj: Raw, parts: string[]): void {
  const [head, ...rest] = parts;
  if (head === undefined || !(head in obj)) return;
  if (rest.length === 0) {
    delete obj[head];
    return;
  }
  const child = obj[head];
  if (!isObject(child)) return;
  deletePath(child, rest);
  if (Object.keys(child).length === 0) delete obj[head];
}

/** Monta e confere tudo (com as mesmas mensagens de erro de quando o servidor liga). */
function build(base: BaseData, overrides: Overrides, maps: readonly GameMap[]): Defs {
  const items = parseItemDefs(merge(base.itens, overrides.itens ?? {}));
  const monsters = parseMonsterDefs(merge(base.monstros, overrides.monstros ?? {}));
  checkDrops(monsters, items);
  const npcs = parseNpcDefs(merge(base.npcs, overrides.npcs ?? {}));
  checkNpcs(npcs, items, maps);
  const areas = parseAreas(merge(baseAreas(maps), overrides.areas ?? {}) as Raw, maps, monsters);
  const quests = parseQuestDefs(merge(base.missoes ?? {}, overrides.missoes ?? {}));
  checkQuests(quests, { npcs, monsters, items });
  nameQuestGoals(quests, { monsters, items, npcs });
  const combat = parseCombat(merge(baseCombat(), overrides.combate ?? {}) as Raw);
  return { monsters, items, npcs, areas, quests, combatParts: combat.parts, combat: combat.rules };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Confere o tipo do valor antes de tentar (o resto — mínimos, itens que existem... — os leitores conferem). */
function typeProblem(kind: FieldKind, value: unknown): string | null {
  const whole = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
  switch (kind) {
    case 'inteiro':
      return whole(value) ? null : 'precisa ser um número inteiro';
    case 'numero':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100000 ? null : 'precisa ser um número (pode ter vírgula)';
    case 'porcento':
      return whole(value) && (value as number) >= 0 && (value as number) <= 100 ? null : 'precisa ser um número de 0 a 100';
    case 'faixa':
      return Array.isArray(value) && value.length === 2 && value.every(whole) ? null : 'precisa ser mínimo e máximo (números inteiros)';
    case 'sim-nao':
      return typeof value === 'boolean' ? null : 'precisa ser sim ou não';
    case 'texto':
      return typeof value === 'string' && value.length <= TEXT_MAX ? null : `precisa ser um texto de até ${TEXT_MAX} letras`;
    case 'texto-longo':
      return typeof value === 'string' && value.length <= LONG_TEXT_MAX ? null : `precisa ser um texto de até ${LONG_TEXT_MAX} letras`;
    case 'itens':
      return Array.isArray(value) && value.length <= 60 && value.every((v) => typeof v === 'string') ? null : 'precisa ser uma lista de itens';
    case 'itens-qtd': {
      const stack = (v: unknown) => {
        if (!isObject(v) || Object.keys(v).some((k) => k !== 'item' && k !== 'quantidade')) return false;
        const n = v.quantidade;
        return typeof v.item === 'string' && whole(n) && (n as number) >= 1 && (n as number) <= ITEM_COUNT_MAX;
      };
      return Array.isArray(value) && value.length <= ITEM_LIST_MAX && value.every(stack)
        ? null
        : `precisa ser uma lista de até ${ITEM_LIST_MAX} itens, cada um com quantidade de 1 a ${ITEM_COUNT_MAX}`;
    }
  }
}

export class Tuning {
  /** Os objetos que o jogo usa (atualizados no lugar quando um ajuste é aceito). */
  readonly monsters: Map<string, MonsterDef>;
  readonly items: Map<string, ItemInfo>;
  readonly npcs: Map<string, NpcDef>;
  /** As áreas de monstros dos mapas (qual monstro e quantos), com os ajustes. */
  readonly areas: Map<string, AreaDef>;
  /** As missões (data/missoes.json), com os ajustes. */
  readonly quests: Map<string, QuestInfo>;
  /** Os números do combate que o jogo usa (carga, defesa, empurrão): o mesmo objeto, mudado no lugar. */
  readonly combat: CombatRules = defaultCombatRules();
  /** Os números do combate como o painel mostra (uma parte por cartão). */
  readonly combatParts: Map<string, CombatPart>;
  readonly problem: string | null;
  /** Avisado depois de cada ajuste aceito, com os arquivos que mudaram. */
  onChange: ((changed: ReadonlySet<TuningFile>) => void) | null = null;
  private overrides: Overrides;
  /** Os valores padrão (só os arquivos do projeto, sem ajustes). */
  private readonly defaults: Defs;

  constructor(
    private readonly base: BaseData,
    private readonly maps: readonly GameMap[],
    /** Onde guardar os ajustes (null = só na memória). */
    private readonly file: string | null,
    saved: Overrides = {},
    private readonly log: (message: string) => void = () => {},
  ) {
    this.defaults = build(base, {}, maps); // se os arquivos do projeto estiverem errados, o servidor nem liga (como antes)
    let overrides = this.dropUnknown(clone(saved));
    let defs: Defs;
    let problem: string | null = null;
    try {
      defs = build(base, overrides, maps);
    } catch (error) {
      problem =
        `Os ajustes salvos não valem com esta versão do jogo (${(error as Error).message}). ` +
        'O jogo ligou com os valores padrão; os ajustes antigos foram guardados em ajustes-antigos.json.';
      this.log(`aviso: ${problem}`);
      this.backupBroken();
      overrides = {};
      defs = build(base, {}, maps);
    }
    this.overrides = overrides;
    this.problem = problem;
    this.monsters = defs.monsters;
    this.items = defs.items;
    this.npcs = defs.npcs;
    this.areas = defs.areas;
    this.quests = defs.quests;
    this.combatParts = defs.combatParts;
    Object.assign(this.combat, defs.combat);
  }

  /** Lê os dados do projeto e os ajustes guardados (arquivo que não existe = sem ajustes). */
  static load(file: string | null, maps: readonly GameMap[], log: (message: string) => void = () => {}): Tuning {
    let saved: Overrides = {};
    if (file && existsSync(file)) {
      try {
        const parsed = readJson(file);
        if (isObject(parsed)) saved = parsed as Overrides;
      } catch (error) {
        log(`aviso: não consegui ler ${file} (${(error as Error).message}); o jogo ligou sem os ajustes.`);
      }
    }
    return new Tuning(loadBaseData(), maps, file, saved, log);
  }

  /** Muda um campo (ex.: arquivo 'monstros', id 'saci', campo 'vida', valor 200). Vale na hora, se for aceito. */
  set(arquivo: TuningFile, id: string, campo: string, valor: unknown): TuningResult {
    const spec = this.spec(arquivo, id, campo);
    if ('erro' in spec) return { ok: false, erro: spec.erro };
    const bad = typeProblem(spec.tipo, valor);
    if (bad) return { ok: false, erro: `${spec.rotulo}: ${bad}.` };
    const next = clone(this.overrides);
    const byId = (next[arquivo] ??= {});
    setPath((byId[id] ??= {}), campo.split('.'), valor);
    return this.commit(next, arquivo);
  }

  /** Muda vários campos de uma vez (ex.: mapa, x e y de um NPC): confere tudo junto e vale uma vez só. */
  setMany(arquivo: TuningFile, id: string, campos: Record<string, unknown>): TuningResult {
    const next = clone(this.overrides);
    const byId = (next[arquivo] ??= {});
    for (const [campo, valor] of Object.entries(campos)) {
      const spec = this.spec(arquivo, id, campo);
      if ('erro' in spec) return { ok: false, erro: spec.erro };
      const bad = typeProblem(spec.tipo, valor);
      if (bad) return { ok: false, erro: `${spec.rotulo}: ${bad}.` };
      setPath((byId[id] ??= {}), campo.split('.'), valor);
    }
    return this.commit(next, arquivo);
  }

  /** Volta um campo ao valor padrão do projeto. */
  reset(arquivo: TuningFile, id: string, campo: string): TuningResult {
    const spec = this.spec(arquivo, id, campo);
    if ('erro' in spec) return { ok: false, erro: spec.erro };
    const next = clone(this.overrides);
    const byId = next[arquivo];
    if (byId?.[id]) {
      deletePath(byId[id]!, campo.split('.'));
      if (Object.keys(byId[id]!).length === 0) delete byId[id];
      if (Object.keys(byId).length === 0) delete next[arquivo];
    }
    return this.commit(next, arquivo);
  }

  /** Os ajustes (só o que mudou), para copiar e mandar a um chat quando quiser que virem o padrão do projeto. */
  exportOverrides(): Overrides {
    return clone(this.overrides);
  }

  view(): TuningView {
    const effective = this.current();
    const defaults: Record<TuningFile, ReadonlyMap<string, unknown>> = {
      monstros: this.defaults.monsters,
      itens: this.defaults.items,
      npcs: this.defaults.npcs,
      areas: this.defaults.areas,
      missoes: this.defaults.quests,
      combate: this.defaults.combatParts,
    };
    const grupos = TUNING_FILES.map((arquivo) => ({
      arquivo,
      titulo: TITLES[arquivo],
      lista: [...effective[arquivo].entries()]
        .filter(([, def]) => arquivo !== 'npcs' || (def as NpcDef).shop !== null || (def as NpcDef).line !== '')
        .map(([id, def]) => {
          const fields = (FIELDS[arquivo] as FieldSpec<unknown>[]).filter((f) => !f.vale || f.vale(def));
          const base = defaults[arquivo].get(id);
          const own = this.overrides[arquivo]?.[id];
          return {
            id,
            nome: (def as { name: string }).name,
            detalhe: describe(arquivo, def, this),
            campos: fields.map((f) => ({
              campo: f.campo,
              rotulo: f.rotulo,
              tipo: f.tipo,
              ...(f.dica ? { dica: f.dica } : {}),
              valor: f.ler(def),
              padrao: base === undefined ? null : f.ler(base),
              ajustado: getPath(own, f.campo.split('.')) !== undefined,
            })),
          };
        }),
    }));
    const itens = [...this.items.values()].map((i) => ({ id: i.id, nome: i.name, preco: i.price }));
    return { problema: this.problem, arquivo: this.file, grupos, itens };
  }

  /** O que o jogo está usando agora, por arquivo. */
  private current(): Record<TuningFile, ReadonlyMap<string, unknown>> {
    return { monstros: this.monsters, itens: this.items, npcs: this.npcs, areas: this.areas, missoes: this.quests, combate: this.combatParts };
  }

  private spec(arquivo: TuningFile, id: string, campo: string): FieldSpec<unknown> | { erro: string } {
    if (!TUNING_FILES.includes(arquivo)) return { erro: 'Arquivo de ajustes desconhecido.' };
    const current = this.current()[arquivo].get(id);
    if (current === undefined) return { erro: `"${id}" não existe em ${TITLES[arquivo].toLowerCase()}.` };
    const spec = (FIELDS[arquivo] as FieldSpec<unknown>[]).find((f) => f.campo === campo);
    if (!spec) return { erro: `O campo "${campo}" não pode ser ajustado pelo painel.` };
    if (spec.vale && !spec.vale(current)) return { erro: `O campo "${spec.rotulo}" não vale para ${(current as { name: string }).name}.` };
    return spec;
  }

  /** Confere os ajustes novos; se tudo certo, guarda, atualiza o jogo e avisa. */
  private commit(next: Overrides, changed: TuningFile): TuningResult {
    let defs: Defs;
    try {
      defs = build(this.base, next, this.maps);
    } catch (error) {
      return { ok: false, erro: (error as Error).message };
    }
    try {
      this.save(next);
    } catch (error) {
      return { ok: false, erro: `Não consegui guardar os ajustes: ${(error as Error).message}` };
    }
    this.overrides = next;
    replaceInPlace(this.monsters, defs.monsters);
    replaceInPlace(this.items, defs.items);
    replaceInPlace(this.npcs, defs.npcs);
    replaceInPlace(this.areas, defs.areas);
    replaceInPlace(this.quests, defs.quests, true);
    replaceInPlace(this.combatParts, defs.combatParts);
    Object.assign(this.combat, defs.combat);
    // Preço de item aparece na loja: mudar item também atualiza a loja de quem está vendo.
    this.onChange?.(new Set<TuningFile>(changed === 'itens' ? ['itens', 'npcs'] : [changed]));
    return { ok: true };
  }

  private save(overrides: Overrides): void {
    if (!this.file) return;
    mkdirSync(path.dirname(this.file), { recursive: true });
    // Escreve num arquivo temporário e troca: se o computador desligar no meio, o arquivo antigo continua inteiro.
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');
    renameSync(temp, this.file);
  }

  /** Ajuste de algo que não existe mais nos arquivos do projeto: sai (com aviso). */
  private dropUnknown(overrides: Overrides): Overrides {
    const known: Record<TuningFile, ReadonlyMap<string, unknown>> = {
      monstros: this.defaults.monsters,
      itens: this.defaults.items,
      npcs: this.defaults.npcs,
      areas: this.defaults.areas,
      missoes: this.defaults.quests,
      combate: this.defaults.combatParts,
    };
    for (const key of Object.keys(overrides)) {
      if (!TUNING_FILES.includes(key as TuningFile)) delete overrides[key as TuningFile];
    }
    for (const arquivo of TUNING_FILES) {
      const byId = overrides[arquivo];
      if (!isObject(byId)) {
        delete overrides[arquivo];
        continue;
      }
      for (const id of Object.keys(byId)) {
        if (!known[arquivo].has(id) || !isObject(byId[id])) {
          this.log(`aviso: o ajuste de "${id}" (${arquivo}) foi ignorado: isso não existe mais no jogo.`);
          delete byId[id];
        }
      }
    }
    return overrides;
  }

  private backupBroken(): void {
    if (!this.file || !existsSync(this.file)) return;
    try {
      renameSync(this.file, path.join(path.dirname(this.file), 'ajustes-antigos.json'));
    } catch {
      // sem conseguir guardar a cópia: o arquivo continua lá, só não está valendo
    }
  }
}

const FIELDS: Record<TuningFile, FieldSpec<never>[]> = {
  monstros: MONSTER_FIELDS as FieldSpec<never>[],
  itens: ITEM_FIELDS as FieldSpec<never>[],
  npcs: NPC_FIELDS as FieldSpec<never>[],
  areas: AREA_FIELDS as FieldSpec<never>[],
  missoes: QUEST_FIELDS as FieldSpec<never>[],
  combate: COMBAT_FIELDS as FieldSpec<never>[],
};

function describe(arquivo: TuningFile, def: unknown, game: { npcs: ReadonlyMap<string, NpcDef>; quests: ReadonlyMap<string, QuestInfo> }): string {
  if (arquivo === 'monstros') return `Nível ${(def as MonsterDef).level}`;
  if (arquivo === 'areas' || arquivo === 'combate') return (def as AreaDef | CombatPart).detail;
  if (arquivo === 'missoes') {
    const quest = def as QuestInfo;
    const goal =
      quest.goal.kind === 'kill'
        ? `derrotar ${quest.goal.count} ${quest.goalName}`
        : quest.goal.kind === 'deliver'
          ? `entregar ${quest.goal.count} ${quest.goalName}`
          : `falar com ${quest.goalName}`;
    const after = quest.after ? `depois de "${game.quests.get(quest.after)?.name ?? quest.after}"` : '';
    return [`quem dá: ${game.npcs.get(quest.giver)?.name ?? quest.giver}`, goal, after].filter(Boolean).join(' · ');
  }
  if (arquivo === 'itens') {
    const item = def as ItemInfo;
    return item.slot ? `${KIND_NAMES[item.kind]} · ${PART_NAMES[item.slot] ?? item.slot}` : KIND_NAMES[item.kind];
  }
  const npc = def as NpcDef;
  return [npc.title, `mapa ${npc.map}`].filter(Boolean).join(' · ');
}

/**
 * Copia os valores novos para dentro dos objetos que o jogo já usa (quem guardou a referência vê a mudança).
 * `exact`: também tira o que não existe mais (ex.: o "rotulo" de uma missão que voltou ao texto automático).
 */
function replaceInPlace<T extends object>(current: Map<string, T>, next: Map<string, T>, exact = false): void {
  for (const [id, def] of next) {
    const existing = current.get(id);
    if (!existing) {
      current.set(id, def);
      continue;
    }
    if (exact) for (const key of Object.keys(existing)) if (!(key in def)) delete (existing as Record<string, unknown>)[key];
    Object.assign(existing, def);
  }
}
