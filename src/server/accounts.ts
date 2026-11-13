// Personagens salvos: nome, senha (guardada de um jeito que não dá para ler de volta) e progresso.
// Tudo num arquivo SQLite (padrão: saves/meummo.db). Usa o SQLite que já vem dentro do Node.js
// (`node:sqlite`), então não há nada para instalar nem compilar — nem no Windows.
//
// Para mudar o formato no futuro (inventário, aparência escolhida...), acrescente um passo no fim
// de MIGRATIONS: quem já tem personagens salvos é convertido sozinho na próxima vez que o servidor ligar.

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { DOWN, isDir, type Dir } from '../shared/dir';
import type { SavedInventory } from './inventory';
import type { QuestLog } from '../shared/quests';
import { lookFromName } from '../shared/look';
import { nameKey } from '../shared/names';
import type { LoginMode } from '../shared/protocol';

/** O progresso que fica salvo. `null` = usar o padrão (vida cheia, nascer na vila). */
export interface CharacterData {
  level: number;
  /** XP dentro do nível atual. */
  xp: number;
  hp: number | null;
  /** Nome da zona (mapa) onde o personagem estava. */
  zone: string | null;
  x: number | null;
  y: number | null;
  dir: Dir;
  /** Semente da aparência. */
  look: number;
  /** Mochila e equipamentos (null = vazia). Conferida pelo mundo ao carregar. */
  inventory: SavedInventory | null;
  /** Progresso nas missões (null ou ausente = nenhuma). Conferido pelo mundo ao carregar. */
  quests?: QuestLog | null;
}

export interface SavedCharacter extends CharacterData {
  id: number;
  name: string;
}

/** Quem salva personagens (o mundo só conhece isto; nos testes dá para usar um falso). */
export interface CharacterSaver {
  save(list: { id: number; data: CharacterData }[]): void;
}

export type LoginResult =
  | { ok: true; id: number; created: boolean }
  | { ok: false; reason: 'wrong_password' | 'creation_limit' | 'not_found' | 'name_exists' };

/**
 * Custo do scrypt, a "receita" que protege as senhas: quanto maior, mais difícil adivinhar uma senha
 * a partir do arquivo — e mais demora para entrar (~50 ms no padrão). Cada senha guarda o custo usado,
 * então mudar isto não estraga as senhas antigas.
 */
export interface HashCost {
  N: number;
  r: number;
  p: number;
}
export const DEFAULT_HASH_COST: HashCost = { N: 16384, r: 8, p: 1 };
const KEY_BYTES = 32;
const SALT_BYTES = 16;

/**
 * Cada item cria ou converte o banco para a versão seguinte (a versão fica em PRAGMA user_version).
 * Nunca mude um passo que já existe: os arquivos de quem já joga dependem dele. Acrescente no fim.
 */
export const MIGRATIONS: readonly string[] = [
  // versão 1: personagens com senha e progresso
  `CREATE TABLE characters (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    hp INTEGER,
    zone TEXT,
    x INTEGER,
    y INTEGER,
    dir INTEGER NOT NULL DEFAULT ${DOWN},
    look INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    last_login_at TEXT,
    saved_at TEXT
  )`,
  // versão 2: mochila e equipamentos (JSON); quem já existia começa com a mochila vazia
  `ALTER TABLE characters ADD COLUMN inventory TEXT`,
  // versão 3: progresso nas missões (JSON); quem já existia começa sem missões
  `ALTER TABLE characters ADD COLUMN quests TEXT`,
];

interface CharacterRow {
  id: number;
  name: string;
  level: number;
  xp: number;
  hp: number | null;
  zone: string | null;
  x: number | null;
  y: number | null;
  dir: number;
  look: number;
  inventory: string | null;
  quests: string | null;
}

const COLUMNS = 'id, name, level, xp, hp, zone, x, y, dir, look, inventory, quests';

export class CharacterStore implements CharacterSaver {
  private readonly db: DatabaseSync;
  private readonly cost: HashCost;
  private readonly findKey: StatementSync;
  private readonly findId: StatementSync;
  private readonly insert: StatementSync;
  private readonly update: StatementSync;
  private readonly touch: StatementSync;
  private closed = false;

  /** `file` pode ser ':memory:' (testes: nada vai para o disco). */
  constructor(file: string, options: { cost?: HashCost } = {}) {
    const { DatabaseSync } = loadSqlite();
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.cost = options.cost ?? DEFAULT_HASH_COST;
    try {
      // WAL: salvar não trava quem está lendo, e o arquivo aguenta o computador desligar no meio.
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = NORMAL');
      this.db.exec('PRAGMA busy_timeout = 3000');
      migrate(this.db);
    } catch (error) {
      this.db.close();
      throw error;
    }
    this.findKey = this.db.prepare('SELECT id, password_hash FROM characters WHERE name_key = ?');
    this.findId = this.db.prepare(`SELECT ${COLUMNS} FROM characters WHERE id = ?`);
    this.insert = this.db.prepare(
      'INSERT INTO characters (name, name_key, password_hash, look, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    this.update = this.db.prepare(
      'UPDATE characters SET level = ?, xp = ?, hp = ?, zone = ?, x = ?, y = ?, dir = ?, look = ?, inventory = ?, quests = ?, saved_at = ? WHERE id = ?',
    );
    this.touch = this.db.prepare('UPDATE characters SET last_login_at = ? WHERE id = ?');
  }

  /**
   * Confere nome e senha. Se ainda não existe personagem com esse nome (e `allowCreate`), cria um novo
   * com esta senha. Demora um pouquinho de propósito (scrypt), sem travar o jogo.
   */
  /**
   * Entra com o personagem `name` (conferindo a senha) ou cria um novo. `mode`: 'login' só entra (não existe =
   * not_found), 'create' só cria (já existe = name_exists, sem conferir a senha); sem `mode`, entra ou cria.
   */
  async login(name: string, password: string, allowCreate = true, mode?: LoginMode): Promise<LoginResult> {
    const key = nameKey(name);
    const existing = this.findKey.get(key) as { id: number; password_hash: string } | undefined;
    if (existing) return mode === 'create' ? { ok: false, reason: 'name_exists' } : this.checkPassword(existing, password);
    if (mode === 'login') return { ok: false, reason: 'not_found' };
    if (!allowCreate) return { ok: false, reason: 'creation_limit' };

    const hash = await hashPassword(password, this.cost);
    this.assertOpen();
    const now = new Date().toISOString();
    try {
      const info = this.insert.run(name, key, hash, lookFromName(name), now, now);
      return { ok: true, id: Number(info.lastInsertRowid), created: true };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Outra conexão criou o mesmo nome enquanto a senha era preparada: vale a senha de quem chegou antes.
      const winner = this.findKey.get(key) as { id: number; password_hash: string } | undefined;
      if (!winner) throw error;
      return mode === 'create' ? { ok: false, reason: 'name_exists' } : this.checkPassword(winner, password);
    }
  }

  /**
   * Troca a senha do personagem `name` (painel do administrador, para quem esqueceu). Devolve o nome como está salvo,
   * ou null se não existir personagem com esse nome. A senha nunca vai para o registro: só o hash fica salvo.
   */
  async setPassword(name: string, password: string): Promise<string | null> {
    const row = this.db.prepare('SELECT id, name FROM characters WHERE name_key = ?').get(nameKey(name)) as { id: number; name: string } | undefined;
    if (!row) return null;
    const hash = await hashPassword(password, this.cost);
    this.assertOpen();
    this.db.prepare('UPDATE characters SET password_hash = ? WHERE id = ?').run(hash, row.id);
    return row.name;
  }

  /** O personagem salvo (ou null se não existir). */
  load(id: number): SavedCharacter | null {
    const row = this.findId.get(id) as CharacterRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      level: Math.max(1, Math.floor(row.level)),
      xp: Math.max(0, Math.floor(row.xp)),
      hp: row.hp === null ? null : Math.floor(row.hp),
      zone: row.zone,
      x: row.x,
      y: row.y,
      dir: isDir(row.dir) ? row.dir : DOWN,
      look: row.look >>> 0,
      inventory: parseJson(row.inventory) as SavedInventory | null,
      quests: parseJson(row.quests) as QuestLog | null,
    };
  }

  /** Salva vários personagens de uma vez (tudo ou nada). */
  save(list: { id: number; data: CharacterData }[]): void {
    if (list.length === 0) return;
    this.assertOpen();
    const now = new Date().toISOString();
    this.db.exec('BEGIN');
    try {
      for (const { id, data } of list) {
        const inventory = data.inventory ? JSON.stringify(data.inventory) : null;
        const quests = data.quests && Object.keys(data.quests).length > 0 ? JSON.stringify(data.quests) : null;
        this.update.run(data.level, data.xp, data.hp, data.zone, data.x, data.y, data.dir, data.look, inventory, quests, now, id);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Quantos personagens existem. */
  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM characters').get() as { n: number }).n;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }

  private async checkPassword(row: { id: number; password_hash: string }, password: string): Promise<LoginResult> {
    if (!(await verifyPassword(password, row.password_hash))) return { ok: false, reason: 'wrong_password' };
    this.assertOpen();
    this.touch.run(new Date().toISOString(), row.id);
    return { ok: true, id: row.id, created: false };
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('o arquivo de personagens já foi fechado');
  }
}

// ---------- senhas ----------

/** Formato guardado: scrypt$N$r$p$sal$resultado (sal e resultado em base64). */
export async function hashPassword(password: string, cost: HashCost = DEFAULT_HASH_COST): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_BYTES, cost);
  return ['scrypt', cost.N, cost.r, cost.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  if (![N, r, p].every((n) => Number.isSafeInteger(n) && n > 0)) return false;
  const salt = Buffer.from(parts[4]!, 'base64');
  const expected = Buffer.from(parts[5]!, 'base64');
  if (expected.length === 0) return false;
  const actual = await scryptAsync(password, salt, expected.length, { N, r, p });
  return timingSafeEqual(actual, expected);
}

function scryptAsync(password: string, salt: Buffer, length: number, cost: HashCost): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, { ...cost, maxmem: 256 * cost.N * cost.r + 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

// ---------- banco ----------

function migrate(db: DatabaseSync): void {
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  if (version > MIGRATIONS.length) {
    throw new Error(
      'O arquivo de personagens foi criado por uma versão mais nova do MeuMMO. Atualize o jogo (Atualizar MeuMMO).',
    );
  }
  for (let next = version; next < MIGRATIONS.length; next++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[next]!);
      db.exec(`PRAGMA user_version = ${next + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

/** JSON guardado no banco; se estiver estragado, vale como vazio (melhor que o personagem não entrar). */
function parseJson(text: string | null): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

const require = createRequire(import.meta.url);

/** Carrega o `node:sqlite`. Ele ainda vem marcado como "experimental" e avisaria isso toda vez no terminal. */
function loadSqlite(): typeof import('node:sqlite') {
  const emitWarning = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const text = typeof warning === 'string' ? warning : warning.message;
    if (text.includes('SQLite')) return; // o aviso de "experimental": funciona bem, não precisa assustar ninguém
    (emitWarning as (...args: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return require('node:sqlite') as typeof import('node:sqlite');
  } catch {
    throw new Error(
      `Este Node.js (${process.version}) não tem o SQLite embutido, que guarda os personagens. ` +
        'Instale o Node.js 22.13 ou mais novo (https://nodejs.org). No Windows, rode o instalador do MeuMMO de novo.',
    );
  } finally {
    process.emitWarning = emitWarning;
  }
}
