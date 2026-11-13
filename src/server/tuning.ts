// Ajustes do administrador: o painel (/admin) muda números do jogo — monstros, itens e loja — sem mexer nos
// arquivos do projeto. Os ajustes ficam num arquivo separado (padrão: saves/ajustes.json, fora do Git): assim
// atualizar o jogo nunca briga com eles, e eles continuam valendo depois de cada atualização.
//
// Cada ajuste passa pelos mesmos leitores de data/*.json: valor inválido é recusado com o erro em português e
// nada muda. Ajuste aceito vale na hora: os objetos de monstros, itens e NPCs que o jogo usa são atualizados no
// lugar (o mundo inteiro enxerga o valor novo) e o mundo avisa quem está jogando (veja Realm.tuningChanged).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ItemInfo } from '../shared/items';
import type { GameMap } from '../shared/map';
import { parseItemDefs } from './items';
import { checkDrops, parseMonsterDefs, type MonsterDef } from './monsters';
import { checkNpcs, parseNpcDefs, type NpcDef } from './npcs';
import { ITEMS_FILE, MONSTERS_FILE, NPCS_FILE } from './paths';

/** Os arquivos de dados que o painel ajusta (com o nome em português, como no arquivo de ajustes). */
export type TuningFile = 'monstros' | 'itens' | 'npcs';
export const TUNING_FILES: readonly TuningFile[] = ['monstros', 'itens', 'npcs'];

/** Como o painel mostra e confere cada campo. */
export type FieldKind = 'inteiro' | 'faixa' | 'sim-nao' | 'texto' | 'itens' | 'porcento';

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

const NPC_FIELDS: FieldSpec<NpcDef>[] = [
  { campo: 'fala', rotulo: 'O que diz', tipo: 'texto', ler: (d) => d.line },
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
}

/** O conteúdo de data/monsters.json, data/items.json e data/npcs.json. */
export interface BaseData {
  monstros: unknown;
  itens: unknown;
  npcs: unknown;
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

const TITLES: Record<TuningFile, string> = { monstros: 'Monstros', itens: 'Itens', npcs: 'Loja e personagens' };
const PART_NAMES: Record<string, string> = { weapon: 'arma', head: 'cabeça', body: 'corpo', charm: 'amuleto' };
const KIND_NAMES: Record<ItemInfo['kind'], string> = { equipment: 'Equipamento', consumable: 'Consumível', material: 'Material' };

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Lê os três arquivos de dados do projeto. */
export function loadBaseData(): BaseData {
  return { monstros: readJson(MONSTERS_FILE), itens: readJson(ITEMS_FILE), npcs: readJson(NPCS_FILE) };
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
  return { monsters, items, npcs };
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
    case 'porcento':
      return whole(value) && (value as number) >= 0 && (value as number) <= 100 ? null : 'precisa ser um número de 0 a 100';
    case 'faixa':
      return Array.isArray(value) && value.length === 2 && value.every(whole) ? null : 'precisa ser mínimo e máximo (números inteiros)';
    case 'sim-nao':
      return typeof value === 'boolean' ? null : 'precisa ser sim ou não';
    case 'texto':
      return typeof value === 'string' && value.length <= 300 ? null : 'precisa ser um texto de até 300 letras';
    case 'itens':
      return Array.isArray(value) && value.length <= 60 && value.every((v) => typeof v === 'string') ? null : 'precisa ser uma lista de itens';
  }
}

export class Tuning {
  /** Os objetos que o jogo usa (atualizados no lugar quando um ajuste é aceito). */
  readonly monsters: Map<string, MonsterDef>;
  readonly items: Map<string, ItemInfo>;
  readonly npcs: Map<string, NpcDef>;
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
    const effective: Record<TuningFile, ReadonlyMap<string, unknown>> = { monstros: this.monsters, itens: this.items, npcs: this.npcs };
    const defaults: Record<TuningFile, ReadonlyMap<string, unknown>> = { monstros: this.defaults.monsters, itens: this.defaults.items, npcs: this.defaults.npcs };
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
            detalhe: describe(arquivo, def),
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

  private spec(arquivo: TuningFile, id: string, campo: string): FieldSpec<unknown> | { erro: string } {
    if (!TUNING_FILES.includes(arquivo)) return { erro: 'Arquivo de ajustes desconhecido.' };
    const current = ({ monstros: this.monsters, itens: this.items, npcs: this.npcs } as Record<TuningFile, ReadonlyMap<string, unknown>>)[arquivo].get(id);
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
    const known: Record<TuningFile, ReadonlyMap<string, unknown>> = { monstros: this.defaults.monsters, itens: this.defaults.items, npcs: this.defaults.npcs };
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
};

function describe(arquivo: TuningFile, def: unknown): string {
  if (arquivo === 'monstros') return `Nível ${(def as MonsterDef).level}`;
  if (arquivo === 'itens') {
    const item = def as ItemInfo;
    return item.slot ? `${KIND_NAMES[item.kind]} · ${PART_NAMES[item.slot] ?? item.slot}` : KIND_NAMES[item.kind];
  }
  const npc = def as NpcDef;
  return [npc.title, `mapa ${npc.map}`].filter(Boolean).join(' · ');
}

/** Copia os valores novos para dentro dos objetos que o jogo já usa (quem guardou a referência vê a mudança). */
function replaceInPlace<T extends object>(current: Map<string, T>, next: Map<string, T>): void {
  for (const [id, def] of next) {
    const existing = current.get(id);
    if (existing) Object.assign(existing, def);
    else current.set(id, def);
  }
}
