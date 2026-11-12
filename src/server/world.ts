// O mundo do jogo: quem está conectado, os monstros, os projéteis e as regras do combate.
// Roda TICK_RATE vezes por segundo (veja server.ts). Nada aqui sabe de WebSocket —
// isso deixa o mundo fácil de testar com conexões e relógio falsos.

import {
  DASH_COOLDOWN_MS,
  DASH_INVULNERABLE_MS,
  DASH_TILES,
  DEATH_MS,
  GOLD_DROP_MS,
  ITEM_DROP_MS,
  MAX_PLAYERS,
  MAX_QUEUED_WALKS,
  PICKUP_RANGE,
  REGEN_DELAY_MS,
  REGEN_EVERY_MS,
  REGEN_FRACTION,
  SHOT_COOLDOWN_MS,
  SHOT_HIT_RADIUS,
  SHOT_RANGE,
  SHOT_SPEED,
  STEP_MS,
  TICK_MS,
  TRADE_RANGE,
  VIEW_HYSTERESIS,
  VIEW_RADIUS_X,
  VIEW_RADIUS_Y,
  WALK_BUDGET_MAX_MS,
  WALK_SLICE_MS,
} from '../shared/constants';
import {
  advanceShot,
  angleBetween,
  angleOfDir,
  arcTiles,
  areaTiles,
  chebyshev,
  dirFromAngle,
  dirTowards,
  dirTowards8,
  makeShot,
  reachableLine,
  shotTouches,
  tileIn,
} from '../shared/combat';
import { DOWN, DX, DY, stepDuration, type Dir } from '../shared/dir';
import type { GameMap, Tile } from '../shared/map';
import { canStep, degreesToward, sweepBody, walkDistance, walkSlice } from '../shared/movement';
import { nameKey, nameProblem, normalizeName } from '../shared/names';
import { findPath } from '../shared/pathfind';
import { emptyEquipment, gearLookOf, MAX_GOLD, sellPrice, type EquipSlot, type ItemInfo, type ItemStack } from '../shared/items';
import { MAX_LEVEL, maxHpFor, xpToNext } from '../shared/progression';
import type { FailReason, ItemAction, QuestAction, RejectReason, ServerMsg } from '../shared/protocol';
import { questBlocker, type QuestInfo, type QuestLog } from '../shared/quests';
import { DASH_SLOT } from '../shared/protocol';
import { SKILLS } from '../shared/skills';
import type { CharacterData, CharacterSaver, SavedCharacter } from './accounts';
import { Inventory } from './inventory';
import { Monster, Npc, Player, type Conn, type Entity, type Hazard, type Projectile, type ZoneState } from './entities';
import type { MonsterAttack, MonsterDef } from './monsters';
import type { NpcDef, NpcShop } from './npcs';
import { sanitizeChat } from './validate';

export { Monster, Npc, Player, type Conn } from './entities';

export type JoinResult = { ok: true; player: Player } | { ok: false; reason: RejectReason };

/** Personagem salvo que está entrando (sem isto, entra um personagem novo que não é salvo). */
export interface JoinProfile {
  character: SavedCharacter;
  /** Acabou de ser criado (muda a mensagem de boas-vindas). */
  created: boolean;
}

/**
 * O que um mapa precisa saber dos outros. No servidor de verdade quem cuida disso é o Realm (realm.ts);
 * um World sozinho (como nos testes) usa o padrão: ele mesmo é o jogo todo.
 */
export interface WorldLinks {
  /** Números de entidade únicos em todos os mapas. */
  nextId(): number;
  /** Aviso para todo mundo online, em qualquer mapa. */
  announce(msg: ServerMsg, exceptId?: number): void;
  /** Quantos estão online no jogo todo. */
  online(): number;
  /** Pede para levar o jogador para outro mapa (`arrival` = nome do ponto de chegada). false = não dá. */
  travel(player: Player, to: string, arrival: string): boolean;
}

export interface WorldOptions {
  /** Relógio em milissegundos (nos testes usamos um relógio falso). */
  now?: () => number;
  random?: () => number;
  log?: (message: string) => void;
  /** Tipos de monstro (de data/monsters.json). */
  monsters?: Map<string, MonsterDef>;
  /** Onde guardar o progresso dos personagens (sem isto, nada é salvo). */
  saver?: CharacterSaver;
  /** Tipos de item (de data/items.json). */
  items?: ReadonlyMap<string, ItemInfo>;
  /** Ligação com os outros mapas (veja WorldLinks). */
  links?: WorldLinks;
  /** Personagens que não são jogadores (de data/npcs.json); cada mapa fica com os seus. */
  npcs?: ReadonlyMap<string, NpcDef>;
  /** Missões (de data/missoes.json). */
  quests?: ReadonlyMap<string, QuestInfo>;
}

/** Folgas para pedidos que chegam um pouquinho antes da hora (rede não é precisa). */
const SHOT_TOLERANCE_MS = 60;
const SKILL_TOLERANCE_MS = 100;
/** Quanto um monstro pode se afastar da área dele, além do alcance de perseguição. */
const LEASH_MARGIN = 4;
/** Proteção depois de voltar para a vila. */
const RESPAWN_PROTECTION_MS = 2000;
/** Folga para usar um consumível um pouquinho antes da hora (rede). */
const ITEM_TOLERANCE_MS = 100;
/** Proteção para quem acabou de chegar de outro mapa (o navegador ainda está desenhando o mapa novo). */
const ARRIVAL_PROTECTION_MS = 2000;
/** Quem acabou de entrar, chegar de outro mapa (depois de carregar) ou acordar: tempo até os monstros notarem. */
const NOTICE_GRACE_MS = 3000;
/** Rastro de fogo: a primeira queimada demora um pouquinho (dá para sair), depois queima a cada FIRE_PULSE_MS. */
const FIRE_FIRST_PULSE_MS = 350;
const FIRE_PULSE_MS = 500;
/** Depois da investida, o monstro respira um pouco antes de andar de novo. */
const CHARGE_REST_MS = 500;
/** Ouro ou item no chão, esperando o dono: só ele vê e só ele pega (ninguém rouba de ninguém). */
export interface GroundDrop {
  id: number;
  /** Id do jogador dono. */
  owner: number;
  x: number;
  y: number;
  gold: number;
  /** Item que não coube na mochila (null = é ouro). */
  item: ItemStack | null;
  /** A partir de quando dá para pegar (antes disso as moedas ainda estão caindo do monstro). */
  readyAt: number;
  /** Quando some. */
  until: number;
  /** Já avisou que a mochila está cheia (avisa uma vez cada vez que o dono chega perto). */
  warned: boolean;
}

/** As moedas pulam do monstro antes de dar para pegar (para dar tempo de ver e ouvir caírem). */
export const DROP_READY_MS = 400;
/** De quanto em quanto tempo o progresso de todo mundo é salvo (além de ao sair e ao subir de nível). */
export const AUTOSAVE_MS = 30_000;

const round3 = (v: number) => Math.round(v * 1000) / 1000;
/** Onde a entidade está exatamente ("de canto"): jogadores andam soltos; monstros e NPCs, de tile em tile. */
const spotOf = (e: Entity): Tile => (e.kind === 'player' ? { x: e.fx, y: e.fy } : { x: e.x, y: e.y });

export class World {
  readonly players = new Map<number, Player>();
  readonly monsters = new Map<number, Monster>();
  readonly projectiles = new Map<number, Projectile>();
  /** Vendedora e outros personagens que não são jogadores (ficam parados no lugar deles). */
  readonly npcs = new Map<number, Npc>();
  /** Ouro e itens no chão, cada um com o seu dono. */
  readonly drops = new Map<number, GroundDrop>();
  readonly zones: ZoneState[] = [];
  readonly items: ReadonlyMap<string, ItemInfo>;
  readonly quests: ReadonlyMap<string, QuestInfo>;
  /** Todos os NPCs do jogo (de todos os mapas), para saber o nome de quem deu cada missão. */
  private readonly npcDefs: ReadonlyMap<string, NpcDef>;
  /** Chão pegando fogo agora (rastros de investida). */
  private hazards: Hazard[] = [];
  /** Tile → id do monstro que está nele (monstros não se empilham). */
  private readonly monsterAt = new Map<number, number>();
  private lastTickAt: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly log: (message: string) => void;
  private readonly saver: CharacterSaver | null;
  private nextAutosaveAt: number;
  private readonly links: WorldLinks;

  constructor(
    readonly map: GameMap,
    options: WorldOptions = {},
  ) {
    this.now = options.now ?? (() => performance.now());
    this.random = options.random ?? Math.random;
    this.log = options.log ?? (() => {});
    this.saver = options.saver ?? null;
    this.items = options.items ?? new Map();
    this.quests = options.quests ?? new Map();
    this.npcDefs = options.npcs ?? new Map();
    let ids = 1;
    this.links = options.links ?? {
      nextId: () => ids++,
      announce: (msg, exceptId) => this.broadcastLocal(msg, exceptId),
      online: () => this.players.size,
      travel: () => false,
    };
    this.lastTickAt = this.now();
    this.nextAutosaveAt = this.lastTickAt + AUTOSAVE_MS;

    for (const def of options.npcs?.values() ?? []) {
      if (def.map === map.id) this.placeNpc(def);
    }

    const defs = options.monsters ?? new Map<string, MonsterDef>();
    for (const zone of map.monsterZones) {
      const def = defs.get(zone.monster);
      if (!def) {
        this.log(`aviso: o mapa tem uma área do monstro "${zone.monster}", mas ele não existe em data/monsters.json`);
        continue;
      }
      const state: ZoneState = { zone, def, alive: new Set(), respawnAt: [] };
      this.zones.push(state);
      for (let i = 0; i < zone.count; i++) this.spawnMonster(state);
    }
  }

  /** Põe o NPC no lugar dele (ou no chão livre mais perto, se o mapa mudou e o lugar ficou bloqueado). */
  private placeNpc(def: NpcDef): void {
    let tile: Tile | null = { x: def.x, y: def.y };
    if (!this.map.isWalkable(def.x, def.y) || !this.map.isReachable(def.x, def.y)) {
      tile = this.map.nearestWalkable(def.x, def.y);
      if (tile && !this.map.isReachable(tile.x, tile.y)) tile = null;
      this.log(
        tile
          ? `aviso: ${def.name} (data/npcs.json) estava em (${def.x}, ${def.y}), que é bloqueado no mapa "${this.map.id}"; ficou em (${tile.x}, ${tile.y})`
          : `aviso: ${def.name} (data/npcs.json) não tem onde ficar perto de (${def.x}, ${def.y}) no mapa "${this.map.id}"`,
      );
      if (!tile) return;
    }
    const worn = emptyEquipment();
    for (const id of def.wears) {
      const slot = this.items.get(id)?.slot;
      if (slot) worn[slot] = id;
    }
    const npc = new Npc(this.links.nextId(), def, tile.x, tile.y, gearLookOf(worn, this.items));
    this.npcs.set(npc.id, npc);
  }

  /** Os NPCs deste mapa, para o navegador desenhar. */
  private npcList() {
    return [...this.npcs.values()].map((npc) => npc.info());
  }

  // ======================= entrar e sair =======================

  join(rawName: string, conn: Conn, profile?: JoinProfile): JoinResult {
    const saved = profile?.character;
    // O nome salvo já foi conferido quando o personagem nasceu (e as regras podem mudar depois).
    const name = saved ? saved.name : normalizeName(rawName);
    if (!saved && nameProblem(name)) return { ok: false, reason: 'name_invalid' };
    if (this.links.online() >= MAX_PLAYERS) return { ok: false, reason: 'full' };
    const key = nameKey(name);
    for (const other of this.players.values()) {
      if (nameKey(other.name) === key) return { ok: false, reason: 'name_taken' };
    }

    const savedSpot = saved ? this.savedSpot(saved) : null;
    const spot = savedSpot ?? this.pickSpawnTile();
    const player = new Player(this.links.nextId(), name, spot.x, spot.y, conn, this.now(), saved?.id ?? null, saved?.look);
    const bag = Inventory.fromSaved(this.items, saved?.inventory ?? null);
    player.inventory = bag.inventory;
    if (bag.dropped.length > 0) this.log(`aviso: ${name} tinha itens que não existem mais em data/items.json: ${bag.dropped.join(', ')}`);
    player.bonus = player.inventory.bonus();
    player.maxHp = playerMaxHp(player);
    player.hp = player.maxHp;
    if (saved) this.restore(player, saved, savedSpot !== null);
    // voltou onde tinha parado (pode ser no meio dos monstros): um tempinho para o jogo abrir
    if (savedSpot) player.unnoticedUntil = this.now() + NOTICE_GRACE_MS;
    this.players.set(player.id, player);
    const greeting = !profile
      ? `Bem-vindo(a), ${name}!`
      : profile.created
        ? `Personagem criado: ${name}! Guarde a sua senha: é com ela que você volta.`
        : `Bem-vindo(a) de volta, ${name}!`;
    // As boas-vindas vão na hora; quem está por perto chega no próximo tick.
    conn.send([
      {
        t: 'welcome',
        id: player.id,
        you: player.state(),
        stats: player.stats(),
        stepMs: STEP_MS,
        online: this.links.online(),
        map: this.map.id,
        items: [...this.items.values()],
        inv: player.inventory.state(),
        npcs: this.npcList(),
        quests: [...this.quests.values()],
        questLog: { ...player.quests },
      },
      { t: 'sys', text: `${greeting} Você está em: ${this.map.name}.` },
    ]);
    this.links.announce({ t: 'sys', text: `${name} entrou no mundo.` }, player.id);
    this.links.announce({ t: 'online', n: this.links.online() });
    this.log(`entrou: ${name} em ${this.map.name} (online: ${this.links.online()})`);
    return { ok: true, player };
  }

  leave(player: Player): void {
    if (!this.players.has(player.id)) return;
    this.detach(player);
    this.saveCharacters([player]);
    this.links.announce({ t: 'sys', text: `${player.name} saiu.` });
    this.links.announce({ t: 'online', n: this.links.online() });
    this.log(`saiu: ${player.name} (online: ${this.links.online()})`);
  }

  /** Tira o jogador deste mapa sem os avisos de "saiu" (ele está indo para outro mapa). */
  detach(player: Player): void {
    if (!this.players.delete(player.id)) return;
    for (const other of this.players.values()) {
      if (other.known.delete(player.id)) other.outbox.push({ t: 'despawn', id: player.id });
    }
    for (const monster of this.monsters.values()) {
      if (monster.targetId === player.id) this.dropTarget(monster);
    }
  }

  /** Recebe um jogador vindo de outro mapa (por uma saída, ou acordando na vila depois de desmaiar). */
  adopt(player: Player, spot: Tile): void {
    const now = this.now();
    if (player.dead) {
      player.deadUntil = 0;
      player.hp = player.maxHp;
      player.dir = DOWN;
      player.lastDamagedAt = -Infinity;
    }
    player.x = spot.x;
    player.y = spot.y;
    player.queue.length = 0;
    player.walkBudget = 0;
    player.known.clear();
    player.changed = true;
    player.invulnerableUntil = now + ARRIVAL_PROTECTION_MS;
    // Até o navegador avisar que terminou de carregar o mapa novo, pedidos dele são ignorados.
    player.loading = true;
    player.outbox = [{ t: 'sys', text: `Você chegou em: ${this.map.name}.` }];
    this.players.set(player.id, player);
    player.conn.send([
      {
        t: 'zone',
        map: this.map.id,
        you: player.state(),
        stats: player.stats(),
        inv: player.inventory.state(),
        online: this.links.online(),
        npcs: this.npcList(),
        questLog: { ...player.quests },
      },
    ]);
    this.saveCharacters([player]);
    this.log(`${player.name} foi para ${this.map.name}`);
  }

  /** Onde aparece quem chega por `arrival`: o ponto com esse nome no mapa ('spawn' = perto do nascimento). */
  arrivalSpot(arrival: string): Tile {
    const point = arrival === 'spawn' ? undefined : this.map.points.get(arrival);
    return (point && this.map.nearestWalkable(point.x, point.y)) || this.pickSpawnTile();
  }

  /** O navegador terminou de carregar o mapa novo: os pedidos dele voltam a valer. */
  loaded(player: Player): void {
    player.loading = false;
    player.unnoticedUntil = this.now() + NOTICE_GRACE_MS;
  }

  /** Salva o progresso de todo mundo que está online (também acontece sozinho a cada AUTOSAVE_MS). */
  saveAll(): void {
    this.saveCharacters([...this.players.values()]);
  }

  /** Coloca no jogador o progresso salvo, com cuidado: o arquivo pode ser de outra versão do jogo. */
  private restore(player: Player, saved: SavedCharacter, samePlace: boolean): void {
    let level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(saved.level)));
    let xp = Math.max(0, Math.floor(saved.xp));
    // Se a conta de XP mudou e agora sobra XP, sobe de nível em vez de perder o que juntou.
    while (level < MAX_LEVEL && xp >= xpToNext(level)) {
      xp -= xpToNext(level);
      level += 1;
    }
    player.level = level;
    player.xp = level >= MAX_LEVEL ? 0 : xp;
    player.maxHp = playerMaxHp(player);
    // Volta com a vida que tinha (sair do jogo não cura); na vila (ou sem vida salva), vida cheia.
    player.hp = samePlace && saved.hp !== null ? Math.min(player.maxHp, Math.max(1, saved.hp)) : player.maxHp;
    if (samePlace) player.dir = saved.dir;
    player.quests = this.cleanQuestLog(saved.quests);
  }

  /** O diário de missões salvo, conferido: missão que sumiu do arquivo sai; números estranhos são corrigidos. */
  private cleanQuestLog(saved: unknown): QuestLog {
    const log: QuestLog = {};
    if (typeof saved !== 'object' || saved === null) return log;
    for (const [id, raw] of Object.entries(saved as Record<string, unknown>)) {
      const quest = this.quests.get(id);
      if (!quest || typeof raw !== 'object' || raw === null) continue;
      const { state, count } = raw as { state?: unknown; count?: unknown };
      if (state !== 'active' && state !== 'done') continue;
      const n = typeof count === 'number' && Number.isFinite(count) ? Math.floor(count) : 0;
      log[id] = { state, count: Math.max(0, Math.min(quest.goal.count, n)) };
    }
    return log;
  }

  /** Onde o personagem estava, se ainda dá para ficar lá (o mapa pode ter mudado). */
  private savedSpot(saved: SavedCharacter): Tile | null {
    const { x, y } = saved;
    // A zona é guardada pelo id do mapa (saves antigos guardavam o nome, que também vale).
    if ((saved.zone !== this.map.id && saved.zone !== this.map.name) || x === null || y === null) return null;
    return this.map.isWalkable(x, y) && this.map.isReachable(x, y) ? { x, y } : null;
  }

  private saveCharacters(players: Player[]): void {
    if (!this.saver) return;
    const list: { id: number; data: CharacterData }[] = [];
    for (const player of players) {
      if (player.characterId === null) continue;
      // Desmaiado num mapa sem vila (renascerEm): na volta ele acorda na vila do outro mapa.
      const zone = player.dead ? (this.map.respawnMap ?? this.map.id) : this.map.id;
      list.push({ id: player.characterId, data: characterData(player, zone) });
    }
    if (list.length === 0) return;
    try {
      this.saver.save(list);
    } catch (error) {
      this.log(`ERRO ao salvar personagens: ${(error as Error).message}`);
    }
  }

  // ======================= pedidos dos jogadores =======================

  /**
   * O cliente pediu para andar um pedaço (WALK_SLICE_MS) na direção `degrees` (ou rolar, se dash).
   * Entra na fila e é processado no tick, no ritmo do relógio.
   */
  requestWalk(player: Player, seq: number, degrees: number, dash = false): void {
    if (player.loading || seq <= player.lastSeq) return;
    player.lastSeq = seq;
    if (player.dead) return;
    if (player.queue.length >= MAX_QUEUED_WALKS) {
      // Pedidos demais de uma vez (bug ou trapaça): descarta a fila e manda o cliente se corrigir.
      player.queue.length = 0;
      player.ackSeq = seq;
      player.ackPending = true;
      return;
    }
    player.queue.push({ seq, a: degrees, dash });
  }

  /** Estilingue: atira uma pedrinha na direção do ângulo. */
  shoot(player: Player, cid: number, angle: number): void {
    const now = this.now();
    if (player.loading || player.dead || now < player.nextShotAt - SHOT_TOLERANCE_MS) return;
    // A próxima recarga conta a partir do horário marcado, não do pedido adiantado:
    // a folga existe só para a rede, ninguém consegue atirar mais rápido com ela.
    player.nextShotAt = Math.max(now, player.nextShotAt) + SHOT_COOLDOWN_MS;
    this.faceAngle(player, angle);
    const [min, max] = player.damage();
    this.spawnProjectile(player, angle, SHOT_SPEED, SHOT_RANGE, this.rollRange(min, max), 'pedra', cid);
  }

  useSkill(player: Player, n: number, angle: number): void {
    const skill = SKILLS[n];
    if (!skill || player.loading) return;
    const now = this.now();
    if (player.dead) return this.fail(player, 'dead');
    if (now < player.skillReadyAt[n]! - SKILL_TOLERANCE_MS) return this.fail(player, 'cooldown');

    if (skill.kind === 'arc') {
      this.faceAngle(player, angle);
      const tiles = arcTiles(player.x, player.y, angle);
      const [min, max] = player.damage();
      this.emitToViewers(player, { t: 'fx', id: player.id, kind: 'arc', a: round3(angle) }, player.id);
      for (const monster of [...this.monsters.values()]) {
        if (tileIn(tiles, monster.x, monster.y)) {
          this.damage(monster, Math.round(this.rollRange(min, max) * skill.power), player.id, now);
        }
      }
    } else {
      if (player.hp >= player.maxHp) return this.fail(player, 'full_hp');
      const amount = Math.min(player.maxHp - player.hp, Math.round(player.maxHp * skill.power));
      player.hp += amount;
      this.emitToViewers(player, { t: 'heal', id: player.id, amount, hp: player.hp });
    }
    player.skillReadyAt[n] = Math.max(now, player.skillReadyAt[n]!) + skill.cooldownMs;
    player.outbox.push({ t: 'cd', n, ms: skill.cooldownMs });
  }

  // ======================= mochila =======================

  /** Equipar, usar (comer) ou jogar fora o item do espaço `i` da mochila. */
  itemAction(player: Player, act: ItemAction, i: number): void {
    const found = player.inventory.at(i);
    if (!found || player.loading) return; // espaço vazio (a mochila do navegador estava desatualizada): nada a fazer
    if (player.dead) return this.fail(player, 'dead', true);
    const { def } = found;
    if (act === 'drop') {
      const thrown = player.inventory.take(i, found.stack.n)!;
      player.invDirty = true;
      player.outbox.push({ t: 'sys', text: `Você jogou fora: ${this.describe([thrown])}.` });
      return;
    }
    if (def.kind === 'equipment') {
      if (player.inventory.equip(i)) this.gearChanged(player);
      return;
    }
    if (act !== 'use' || def.kind !== 'consumable') return;
    const now = this.now();
    if (now < player.nextItemAt - ITEM_TOLERANCE_MS) return this.fail(player, 'cooldown', true);
    if (player.hp >= player.maxHp) return this.fail(player, 'full_hp', true);
    player.inventory.take(i, 1);
    player.invDirty = true;
    player.nextItemAt = Math.max(now, player.nextItemAt) + def.cooldownMs;
    const amount = Math.min(player.maxHp - player.hp, def.heal);
    player.hp += amount;
    this.emitToViewers(player, { t: 'heal', id: player.id, amount, hp: player.hp });
  }

  /** Tira o que está equipado nesta parte e guarda na mochila. */
  unequip(player: Player, part: EquipSlot): void {
    if (!player.inventory.equipped[part] || player.loading) return;
    if (player.dead) return this.fail(player, 'dead', true);
    if (!player.inventory.unequip(part)) return this.fail(player, 'bag_full', true);
    this.gearChanged(player);
  }

  /** Os equipamentos mudaram: recalcula vida máxima e dano e avisa quem precisa saber. */
  private gearChanged(player: Player): void {
    player.bonus = player.inventory.bonus();
    const maxHp = playerMaxHp(player);
    if (maxHp !== player.maxHp) {
      player.maxHp = maxHp;
      player.hp = Math.min(player.hp, maxHp);
      this.emitToViewers(player, { t: 'hp', id: player.id, hp: player.hp, maxHp: player.maxHp });
    }
    player.invDirty = true;
    player.statsDirty = true;
    // todo mundo que está vendo (e o próprio) passa a desenhar o equipamento novo
    this.emitToViewers(player, { t: 'gear', id: player.id, gear: player.inventory.look() });
  }

  /**
   * O monstro caiu: cada um que ajudou sorteia os itens e o ouro dele (cada um tem os seus, ninguém rouba de ninguém).
   * Os itens vão direto para a mochila; o ouro (e o item que não coube) cai no chão, perto do monstro, para o dono pegar.
   */
  private giveLoot(player: Player, monster: Monster, now: number): void {
    const got: ItemStack[] = [];
    const lost: ItemStack[] = [];
    let precious = false;
    const [goldMin, goldMax] = monster.def.gold;
    const gold = goldMax > 0 ? this.rollRange(goldMin, goldMax) : 0;
    for (const drop of monster.def.drops) {
      if (this.random() * 100 >= drop.chance) continue;
      const def = this.items.get(drop.item);
      if (!def) continue;
      const n = this.rollRange(drop.min, drop.max);
      const added = player.inventory.add(drop.item, n);
      if (added > 0) got.push({ item: drop.item, n: added });
      if (added < n) lost.push({ item: drop.item, n: n - added });
      if (added > 0 && def.rarity !== 'common') precious = true;
      if (added > 0 && def.rarity === 'legendary') this.links.announce({ t: 'sys', text: `${player.name} conseguiu: ${def.name}!` });
    }
    if (got.length > 0) {
      player.invDirty = true;
      player.outbox.push({ t: 'loot', x: monster.x, y: monster.y, items: got });
      player.outbox.push({ t: 'sys', text: `Você pegou: ${this.describe(got)}.` });
      if (precious) this.saveCharacters([player]); // item raro não pode sumir se o servidor cair
    }
    // O ouro cai onde o monstro estava; o que não coube na mochila, nos tiles livres em volta.
    const spots = this.map.walkableAround(monster.x, monster.y, 1);
    const spot = (i: number): Tile => spots[Math.min(i, spots.length - 1)] ?? { x: monster.x, y: monster.y };
    if (gold > 0) this.dropOnGround(player, spot(0), gold, null, now, GOLD_DROP_MS);
    lost.forEach((stack, i) => this.dropOnGround(player, spot(i + 1), 0, stack, now, ITEM_DROP_MS));
    if (lost.length > 0) {
      player.outbox.push({ t: 'sys', text: `Mochila cheia! Ficou no chão: ${this.describe(lost)}. Abra espaço e passe lá para pegar.` });
    }
  }

  /** Põe ouro ou um item no chão para o jogador (só ele vê). */
  private dropOnGround(player: Player, at: Tile, gold: number, item: ItemStack | null, now: number, ms: number): void {
    const drop: GroundDrop = {
      id: this.links.nextId(),
      owner: player.id,
      x: at.x,
      y: at.y,
      gold,
      item,
      readyAt: now + DROP_READY_MS,
      until: now + ms,
      warned: false,
    };
    this.drops.set(drop.id, drop);
    player.outbox.push(this.dropMsg(drop, now));
  }

  private dropMsg(drop: GroundDrop, now: number): ServerMsg {
    return {
      t: 'drop',
      id: drop.id,
      x: drop.x,
      y: drop.y,
      ...(drop.gold > 0 ? { gold: drop.gold } : {}),
      ...(drop.item ? { item: { ...drop.item } } : {}),
      ms: Math.max(0, drop.until - now),
    };
  }

  /** Cada tick: o que está no chão some quando o tempo acaba, e o dono pega quando chega perto. */
  private updateDrops(now: number): void {
    for (const drop of [...this.drops.values()]) {
      const owner = this.players.get(drop.owner);
      if (!owner) {
        this.drops.delete(drop.id); // o dono saiu do jogo ou foi para outro mapa
        continue;
      }
      if (now >= drop.until) {
        this.drops.delete(drop.id);
        owner.outbox.push({ t: 'drop_gone', id: drop.id });
        continue;
      }
      if (owner.dead || owner.loading || now < drop.readyAt) continue;
      if (chebyshev(owner, drop) > PICKUP_RANGE) {
        drop.warned = false;
        continue;
      }
      this.pickUp(owner, drop, now);
    }
  }

  private pickUp(player: Player, drop: GroundDrop, now: number): void {
    if (drop.gold > 0) {
      const gold = player.inventory.addGold(drop.gold);
      this.drops.delete(drop.id);
      player.invDirty = true;
      player.outbox.push({ t: 'pickup', id: drop.id, gold });
      return;
    }
    const stack = drop.item;
    if (!stack) {
      this.drops.delete(drop.id);
      return;
    }
    const added = player.inventory.add(stack.item, stack.n);
    if (added === 0) {
      if (!drop.warned) player.outbox.push({ t: 'sys', text: `Mochila cheia: ${this.describe([stack])} continua no chão.` });
      drop.warned = true;
      return;
    }
    player.invDirty = true;
    player.outbox.push({ t: 'pickup', id: drop.id, item: { item: stack.item, n: added } });
    stack.n -= added;
    if (stack.n > 0) player.outbox.push(this.dropMsg(drop, now)); // só uma parte coube: o resto continua lá
    else this.drops.delete(drop.id);
    if (this.items.get(stack.item)?.rarity !== 'common') this.saveCharacters([player]); // item raro não pode sumir
  }

  // ======================= ferramentas do administrador =======================

  /** Dá itens a um jogador; o que não couber na mochila cai no chão, perto dele. Devolve quantos foram para a mochila. */
  adminGiveItem(player: Player, item: string, n: number): number {
    const added = player.inventory.add(item, n);
    if (added > 0) player.invDirty = true;
    if (added < n) this.dropOnGround(player, { x: player.x, y: player.y }, 0, { item, n: n - added }, this.now(), ITEM_DROP_MS);
    player.outbox.push({ t: 'sys', text: `O administrador te deu: ${this.describe([{ item, n }])}.` });
    return added;
  }

  adminGiveGold(player: Player, n: number): number {
    const added = player.inventory.addGold(n);
    if (added > 0) player.invDirty = true;
    player.outbox.push({ t: 'sys', text: `O administrador te deu ${added} de ouro.` });
    return added;
  }

  /** Vida cheia. */
  adminHeal(player: Player): void {
    const amount = player.maxHp - player.hp;
    player.hp = player.maxHp;
    if (amount > 0) this.emitToViewers(player, { t: 'heal', id: player.id, amount, hp: player.hp });
    player.outbox.push({ t: 'sys', text: 'O administrador te curou.' });
  }

  /** Leva o jogador para outro lugar deste mesmo mapa. */
  adminTeleport(player: Player, spot: Tile): void {
    player.x = spot.x;
    player.y = spot.y;
    player.queue.length = 0;
    player.walkBudget = 0;
    player.changed = true;
    player.outbox.push({ t: 'teleport', x: player.fx, y: player.fy, dir: player.dir });
    player.outbox.push({ t: 'sys', text: `O administrador te levou para (${spot.x}, ${spot.y}).` });
  }

  /** Um lugar livre neste mapa: (x, y) se der para ficar lá (ou o mais perto), ou o nascimento se não vier posição. */
  freeSpot(x?: number, y?: number): Tile | null {
    if (x === undefined || y === undefined) return this.arrivalSpot('spawn');
    if (this.map.isWalkable(x, y) && this.map.isReachable(x, y)) return { x, y };
    const near = this.map.nearestWalkable(x, y);
    return near && this.map.isReachable(near.x, near.y) ? near : null;
  }

  // ======================= ajustes do administrador =======================

  /** A vida dos monstros mudou no painel: os que estão no mapa acompanham (na mesma proporção). */
  refreshMonsters(): void {
    for (const monster of this.monsters.values()) {
      const max = monster.def.hp;
      if (max === monster.maxHp) continue;
      monster.hp = Math.max(1, Math.min(max, Math.round((monster.hp / monster.maxHp) * max)));
      monster.maxHp = max;
      this.emitToViewers(monster, { t: 'hp', id: monster.id, hp: monster.hp, maxHp: monster.maxHp });
    }
  }

  /** Os itens mudaram no painel: refaz o que os equipamentos somam e manda a lista nova para quem está aqui. */
  refreshItems(): void {
    const items = [...this.items.values()];
    for (const player of this.players.values()) {
      player.bonus = player.inventory.bonus();
      const maxHp = playerMaxHp(player);
      if (maxHp !== player.maxHp) {
        player.maxHp = maxHp;
        player.hp = Math.min(player.hp, maxHp);
        this.emitToViewers(player, { t: 'hp', id: player.id, hp: player.hp, maxHp: player.maxHp });
      }
      player.statsDirty = true;
      player.outbox.push({ t: 'items', items });
    }
  }

  /** Os NPCs mudaram no painel (o que vendem, o que dizem): manda a lista nova para quem está aqui. */
  refreshNpcs(): void {
    const npcs = this.npcList();
    for (const player of this.players.values()) player.outbox.push({ t: 'npcs', npcs });
  }

  // ======================= missões =======================

  /** Aceitar ou concluir (perto de quem dá a missão) ou abandonar uma missão. */
  questAction(player: Player, act: QuestAction, id: string, npcId?: number): void {
    const quest = this.quests.get(id);
    if (!quest || player.loading) return;
    if (player.dead) return this.fail(player, 'dead', true);
    if (act === 'abandon') {
      if (player.quests[id]?.state !== 'active') return;
      // repetível já concluída antes: volta a contar como concluída; senão, some do diário
      delete player.quests[id];
      player.questsDirty = true;
      player.outbox.push({ t: 'sys', text: `Missão abandonada: ${quest.name}.` });
      return;
    }
    const npc = npcId !== undefined ? this.npcs.get(npcId) : undefined;
    if (!npc || npc.def.id !== quest.giver) return; // NPC de outro mapa, ou não é ele quem dá esta missão
    if (chebyshev(player, npc) > TRADE_RANGE) return this.fail(player, 'too_far', true);

    if (act === 'accept') {
      const blocker = questBlocker(quest, player.quests, player.level);
      if (blocker) {
        const why: Record<typeof blocker, string> = {
          active: 'Você já está fazendo esta missão.',
          done: 'Você já fez esta missão.',
          after: 'Ainda não: faça antes a missão anterior.',
          level: `Esta missão é para quem tem nível ${quest.minLevel} ou mais.`,
          full: 'Você já está com missões demais. Conclua ou abandone uma antes.',
        };
        player.outbox.push({ t: 'sys', text: why[blocker] });
        return;
      }
      player.quests[id] = { state: 'active', count: 0 };
      player.questsDirty = true;
      player.outbox.push({ t: 'sys', text: `Missão aceita: ${quest.name}.` });
      return;
    }

    // concluir
    const mine = player.quests[id];
    if (mine?.state !== 'active') return;
    const goal = quest.goal;
    if (goal.kind === 'kill' && mine.count < goal.count) {
      player.outbox.push({ t: 'sys', text: `Ainda falta: ${goal.count - mine.count} para concluir "${quest.name}".` });
      return;
    }
    if (goal.kind === 'deliver') {
      if (!player.inventory.removeItem(goal.item, goal.count)) {
        const missing = goal.count - player.inventory.countOf(goal.item);
        player.outbox.push({ t: 'sys', text: `Ainda faltam ${missing} de ${this.items.get(goal.item)?.name ?? goal.item} para concluir "${quest.name}".` });
        return;
      }
      player.invDirty = true;
    }
    player.quests[id] = { state: 'done', count: goal.count };
    player.questsDirty = true;
    this.giveQuestReward(player, quest);
    this.saveCharacters([player]); // missão concluída não pode se perder se o servidor cair
  }

  private giveQuestReward(player: Player, quest: QuestInfo): void {
    const parts: string[] = [];
    if (quest.reward.xp > 0) parts.push(`${quest.reward.xp} XP`);
    if (quest.reward.gold > 0) {
      const gold = player.inventory.addGold(quest.reward.gold);
      if (gold > 0) parts.push(`${gold} de ouro`);
      player.invDirty = true;
    }
    for (const stack of quest.reward.items) {
      const added = player.inventory.add(stack.item, stack.n);
      if (added > 0) player.invDirty = true;
      if (added < stack.n) this.dropOnGround(player, { x: player.x, y: player.y }, 0, { item: stack.item, n: stack.n - added }, this.now(), ITEM_DROP_MS);
      parts.push(this.describe([stack]));
    }
    player.outbox.push({ t: 'sys', text: `Missão concluída: ${quest.name}!${parts.length ? ` Você ganhou: ${parts.join(', ')}.` : ''}` });
    this.giveXp(player, quest.reward.xp);
  }

  /** Um monstro que você ajudou a derrubar conta nas suas missões de derrotar. */
  private countQuestKill(player: Player, monster: string): void {
    for (const [id, progress] of Object.entries(player.quests)) {
      const quest = this.quests.get(id);
      if (progress.state !== 'active' || !quest || quest.goal.kind !== 'kill' || quest.goal.monster !== monster) continue;
      if (progress.count >= quest.goal.count) continue;
      progress.count += 1;
      player.questsDirty = true;
      if (progress.count === quest.goal.count) {
        const giver = this.npcDefs.get(quest.giver)?.name ?? 'quem te deu a missão';
        player.outbox.push({ t: 'sys', text: `Missão pronta: ${quest.name}. Fale com ${giver} para receber a recompensa.` });
      }
    }
  }

  // ======================= loja =======================

  /** Comprar `n` deste item do vendedor `npcId` (pelo `preco` de data/items.json). */
  buy(player: Player, npcId: number, item: string, n: number): void {
    const shop = this.shopFor(player, npcId);
    if (!shop) return;
    const def = this.items.get(item);
    if (!def || def.price <= 0 || !shop.sells.includes(item)) return this.fail(player, 'cant_trade', true);
    const cost = def.price * n;
    if (player.inventory.gold < cost) return this.fail(player, 'no_gold', true);
    if (player.inventory.room(item) < n) return this.fail(player, 'bag_full', true);
    player.inventory.add(item, n);
    player.inventory.gold -= cost;
    player.invDirty = true;
    player.outbox.push({ t: 'sys', text: `Você comprou: ${this.describe([{ item, n }])}, por ${cost} de ouro.` });
  }

  /** Vender `n` do item do espaço `i` da mochila para o vendedor `npcId` (ele paga uma parte do preço). */
  sell(player: Player, npcId: number, i: number, n: number): void {
    const shop = this.shopFor(player, npcId);
    if (!shop) return;
    const found = player.inventory.at(i);
    if (!found) return; // a mochila do navegador estava desatualizada: nada a fazer
    const each = sellPrice(found.def, shop.buyPercent);
    // Só vende o que cabe no limite de ouro (ninguém perde item sem receber).
    const count = Math.min(n, found.stack.n, Math.floor((MAX_GOLD - player.inventory.gold) / Math.max(1, each)));
    if (each <= 0 || count <= 0) return this.fail(player, 'cant_trade', true);
    const sold = player.inventory.take(i, count)!;
    const gold = player.inventory.addGold(each * sold.n);
    player.invDirty = true;
    player.outbox.push({ t: 'sys', text: `Você vendeu: ${this.describe([sold])}, por ${gold} de ouro.` });
  }

  /** A loja do vendedor, se dá para negociar agora (perto dele, acordado). Recusa com o motivo, se não. */
  private shopFor(player: Player, npcId: number): NpcShop | null {
    if (player.loading) return null;
    const npc = this.npcs.get(npcId);
    if (!npc?.def.shop) return null; // vendedor de outro mapa (o navegador estava desatualizado): ignora
    if (player.dead) {
      this.fail(player, 'dead', true);
      return null;
    }
    if (chebyshev(player, npc) > TRADE_RANGE) {
      this.fail(player, 'too_far', true);
      return null;
    }
    return npc.def.shop;
  }

  /** "Banana ×2, Chapéu de Palha" */
  private describe(stacks: ItemStack[]): string {
    return stacks.map(({ item, n }) => `${this.items.get(item)?.name ?? item}${n > 1 ? ` ×${n}` : ''}`).join(', ');
  }

  chat(player: Player, raw: string): void {
    const text = sanitizeChat(raw);
    if (!text) return;
    if (!player.chatLimit.take(this.now())) {
      player.outbox.push({ t: 'sys', text: 'Calma! Você está mandando mensagens rápido demais.' });
      return;
    }
    this.links.announce({ t: 'chat', id: player.id, name: player.name, text });
  }

  // ======================= o tick =======================

  /** Um "batimento" do mundo: move, luta, atualiza o que cada um vê e envia os pacotes. */
  tick(): void {
    const now = this.now();
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTickAt) / 1000));
    this.lastTickAt = now;

    for (const player of this.players.values()) this.updatePlayer(player, now);
    this.updateProjectiles(dt, now);
    for (const monster of [...this.monsters.values()]) {
      if (this.monsters.has(monster.id)) this.updateMonster(monster, now);
    }
    this.updateHazards(now);
    this.respawnMonsters(now);
    this.updateDrops(now);

    for (const player of this.players.values()) this.updateView(player);
    if (now >= this.nextAutosaveAt) {
      this.nextAutosaveAt = now + AUTOSAVE_MS;
      this.saveAll();
    }
    for (const player of this.players.values()) {
      if (player.statsDirty) {
        player.outbox.push({ t: 'stats', stats: player.stats() });
        player.statsDirty = false;
      }
      if (player.invDirty) {
        player.outbox.push({ t: 'inv', inv: player.inventory.state() });
        player.invDirty = false;
      }
      if (player.questsDirty) {
        player.outbox.push({ t: 'quests', log: { ...player.quests } });
        player.questsDirty = false;
      }
      if (player.ackPending) {
        player.outbox.push({ t: 'ack', seq: player.ackSeq, x: player.fx, y: player.fy, dir: player.dir });
        player.ackPending = false;
      }
    }
    for (const player of this.players.values()) {
      if (player.outbox.length > 0) {
        player.conn.send(player.outbox);
        player.outbox = [];
      }
    }
    for (const player of this.players.values()) {
      player.changed = false;
      player.dashed = false;
    }
    for (const monster of this.monsters.values()) {
      monster.changed = false;
      monster.dashed = false;
    }
  }

  // ======================= jogadores =======================

  private updatePlayer(player: Player, now: number): void {
    if (player.loading && player.dead) return; // indo acordar na vila, em outro mapa
    if (player.dead) {
      player.queue.length = 0;
      if (now >= player.deadUntil) this.respawnPlayer(player, now);
      return;
    }
    if (player.charmedBy !== null) this.updateCharm(player, now);
    this.processWalks(player, now);
    this.regenPlayer(player, now);
  }

  /**
   * Anda os pedaços de caminhada da fila. Cada pedaço gasta WALK_SLICE_MS do "orçamento" do jogador, que
   * enche com o relógio (até WALK_BUDGET_MAX_MS): ninguém anda mais rápido que a velocidade, mas pedidos que
   * a rede atrasou e entregou juntos ainda passam na hora. A esquiva não gasta orçamento (tem a recarga dela).
   */
  private processWalks(player: Player, now: number): void {
    const elapsed = player.walkClock > 0 ? now - player.walkClock : TICK_MS;
    player.walkClock = now;
    player.walkBudget = Math.min(WALK_BUDGET_MAX_MS, player.walkBudget + Math.max(0, elapsed));
    while (player.queue.length > 0) {
      const input = player.queue[0]!;
      // Esquiva pronta não espera a caminhada (no cliente ela também acontece na hora).
      // Esquiva ainda recarregando vira um pedaço de caminhada normal (o cliente se corrige com o ack).
      const dash = input.dash && now >= player.dashReadyAt - SKILL_TOLERANCE_MS;
      if (!dash && now < player.charmedUntil) {
        // Encantado: não anda (só a esquiva solta). O navegador corrige a posição pelo ack.
        player.queue.shift();
        player.ackSeq = input.seq;
        player.ackPending = true;
        if (now >= player.charmResyncAt) {
          player.charmResyncAt = now + 500;
          player.outbox.push({ t: 'charm', ms: player.charmedUntil - now });
        }
        continue;
      }
      if (!dash && player.walkBudget < WALK_SLICE_MS) break;
      player.queue.shift();
      const from = { x: player.fx, y: player.fy, dir: player.dir };
      const result = dash ? sweepBody(this.map, from, input.a, DASH_TILES) : walkSlice(this.map, from, input.a, walkDistance(WALK_SLICE_MS, STEP_MS));
      if (!dash) player.walkBudget -= WALK_SLICE_MS;
      // Rolar contra a parede não conta como esquiva (nem dá invencibilidade).
      if (dash && result.moved) {
        player.dashReadyAt = Math.max(now, player.dashReadyAt) + DASH_COOLDOWN_MS;
        player.invulnerableUntil = now + DASH_INVULNERABLE_MS;
        player.dashed = true;
        player.outbox.push({ t: 'cd', n: DASH_SLOT, ms: DASH_COOLDOWN_MS });
        this.emitToViewers(player, { t: 'fx', id: player.id, kind: 'dash' }, player.id);
        this.breakCharm(player); // a esquiva quebra o encanto
      }
      if (result.moved || result.dir !== player.dir) player.changed = true;
      player.fx = result.x;
      player.fy = result.y;
      player.dir = result.dir;
      player.ackSeq = input.seq;
      player.ackPending = true;
      // Pisou numa saída: vai para o outro mapa (o resto da fila era para este mapa, então fica para trás).
      const exit = result.moved ? this.map.exitAt(player.x, player.y) : null;
      if (exit && this.links.travel(player, exit.to, exit.arrival)) {
        player.loading = true;
        player.queue.length = 0;
        break;
      }
    }
  }

  private regenPlayer(player: Player, now: number): void {
    if (player.hp >= player.maxHp || now - player.lastDamagedAt < REGEN_DELAY_MS || now < player.nextRegenAt) return;
    player.nextRegenAt = now + REGEN_EVERY_MS;
    player.hp = Math.min(player.maxHp, player.hp + Math.max(1, Math.round(player.maxHp * REGEN_FRACTION)));
    this.emitToViewers(player, { t: 'hp', id: player.id, hp: player.hp, maxHp: player.maxHp });
  }

  private killPlayer(player: Player, now: number): void {
    player.deadUntil = now + DEATH_MS;
    player.queue.length = 0;
    this.emitToViewers(player, { t: 'death', id: player.id });
    player.outbox.push({ t: 'sys', text: 'Você desmaiou! Voltando para a vila...' });
    for (const monster of this.monsters.values()) {
      if (monster.targetId === player.id) this.dropTarget(monster);
    }
  }

  private respawnPlayer(player: Player, now: number): void {
    this.breakCharm(player);
    // Mapa sem vila (propriedade renascerEm): acorda no mapa da vila.
    const home = this.map.respawnMap;
    if (home && home !== this.map.id && this.links.travel(player, home, 'spawn')) {
      player.loading = true;
      return;
    }
    const spot = this.pickSpawnTile();
    player.deadUntil = 0;
    player.hp = player.maxHp;
    player.x = spot.x;
    player.y = spot.y;
    player.dir = DOWN;
    player.walkBudget = 0;
    player.invulnerableUntil = now + RESPAWN_PROTECTION_MS;
    player.unnoticedUntil = now + NOTICE_GRACE_MS;
    player.lastDamagedAt = -Infinity;
    player.changed = true;
    player.outbox.push({ t: 'teleport', x: player.fx, y: player.fy, dir: player.dir });
    this.emitToViewers(player, { t: 'hp', id: player.id, hp: player.hp, maxHp: player.maxHp });
  }

  private giveXp(player: Player, amount: number): void {
    if (player.level >= MAX_LEVEL || amount <= 0) return;
    player.xp += amount;
    let leveled = false;
    while (player.level < MAX_LEVEL && player.xp >= xpToNext(player.level)) {
      player.xp -= xpToNext(player.level);
      player.level += 1;
      leveled = true;
    }
    if (player.level >= MAX_LEVEL) player.xp = 0;
    if (leveled) {
      player.maxHp = playerMaxHp(player);
      player.hp = player.maxHp;
      this.emitToViewers(player, { t: 'levelup', id: player.id, level: player.level, maxHp: player.maxHp });
      this.emitToViewers(player, { t: 'hp', id: player.id, hp: player.hp, maxHp: player.maxHp });
      this.links.announce({ t: 'sys', text: `${player.name} chegou ao nível ${player.level}!` });
      this.saveCharacters([player]); // subir de nível é importante demais para esperar o próximo salvamento
    }
    player.statsDirty = true;
  }

  // ======================= projéteis =======================

  private spawnProjectile(owner: Entity, angle: number, speed: number, range: number, damage: number, kind: string, cid?: number): void {
    const shot: Projectile = {
      ...makeShot(spotOf(owner), angle, speed, range),
      id: this.links.nextId(),
      ownerId: owner.id,
      fromMonster: owner.kind === 'monster',
      damage,
      kind,
      viewers: new Set(),
    };
    this.projectiles.set(shot.id, shot);
    const msg: ServerMsg = {
      t: 'shot',
      id: shot.id,
      by: owner.id,
      x: round3(shot.x),
      y: round3(shot.y),
      a: round3(angle),
      speed,
      range,
      kind,
      ...(cid !== undefined ? { cid } : {}),
    };
    for (const player of this.players.values()) {
      if (player.id === owner.id || player.known.has(owner.id)) {
        player.outbox.push(msg);
        shot.viewers.add(player.id);
      }
    }
  }

  private updateProjectiles(dt: number, now: number): void {
    for (const shot of [...this.projectiles.values()]) {
      const hit: { target: Entity | null } = { target: null };
      const result = advanceShot(shot, dt, this.map, (x, y) => {
        hit.target = shot.fromMonster ? this.playerTouchedBy(x, y, now) : this.monsterTouchedBy(x, y);
        return hit.target !== null;
      });
      if (result === 'flying') continue;
      this.projectiles.delete(shot.id);
      for (const id of shot.viewers) this.players.get(id)?.outbox.push({ t: 'shot_end', id: shot.id, hit: hit.target?.id ?? 0 });
      if (hit.target) this.damage(hit.target, shot.damage, shot.ownerId, now);
    }
  }

  private monsterTouchedBy(x: number, y: number): Monster | null {
    for (const monster of this.monsters.values()) {
      if (shotTouches(x, y, monster.x, monster.y, SHOT_HIT_RADIUS)) return monster;
    }
    return null;
  }

  private playerTouchedBy(x: number, y: number, now: number): Player | null {
    for (const player of this.players.values()) {
      if (player.dead || now < player.invulnerableUntil) continue;
      if (shotTouches(x, y, player.fx, player.fy, SHOT_HIT_RADIUS)) return player;
    }
    return null;
  }

  // ======================= dano =======================

  private damage(target: Entity, amount: number, attackerId: number, now: number): void {
    if (target.hp <= 0) return;
    if (target.kind === 'player' && (target.dead || now < target.invulnerableUntil)) return;
    // Defesa dos equipamentos: tira um pouco de cada golpe, mas sempre sobra pelo menos 1.
    if (target.kind === 'player') amount = Math.max(1, amount - target.bonus.defense);
    target.hp = Math.max(0, target.hp - amount);
    target.lastDamagedAt = now;
    this.emitToViewers(target, { t: 'hit', id: target.id, by: attackerId, dmg: amount, hp: target.hp });

    if (target.kind === 'monster') {
      const attacker = this.players.get(attackerId);
      if (attacker) {
        target.contributors.add(attacker.id);
        if (target.targetId === null || target.mode === 'return') {
          target.targetId = attacker.id;
          target.mode = 'chase';
        }
      }
      if (target.hp === 0) this.killMonster(target, now);
    } else if (target.hp === 0) {
      this.killPlayer(target, now);
    }
  }

  // ======================= monstros =======================

  private spawnMonster(zone: ZoneState): boolean {
    const tile = this.freeTileInZone(zone);
    if (!tile) return false;
    const monster = new Monster(this.links.nextId(), zone.def, zone, tile.x, tile.y);
    monster.nextWanderAt = this.now() + this.random() * 3000;
    this.monsters.set(monster.id, monster);
    this.monsterAt.set(this.tileKey(tile.x, tile.y), monster.id);
    zone.alive.add(monster.id);
    return true;
  }

  private respawnMonsters(now: number): void {
    for (const zone of this.zones) {
      while (zone.respawnAt.length > 0 && zone.respawnAt[0]! <= now && zone.alive.size < zone.zone.count) {
        zone.respawnAt.shift();
        if (!this.spawnMonster(zone)) {
          zone.respawnAt.push(now + 5000); // área cheia agora: tenta de novo daqui a pouco
          break;
        }
      }
    }
  }

  private killMonster(monster: Monster, now: number): void {
    this.monsters.delete(monster.id);
    this.monsterAt.delete(this.tileKey(monster.x, monster.y));
    monster.zone.alive.delete(monster.id);
    monster.zone.respawnAt.push(now + monster.def.respawnMs);
    for (const player of this.players.values()) {
      if (player.known.delete(monster.id)) player.outbox.push({ t: 'death', id: monster.id });
    }
    // Todo mundo que ajudou leva a XP inteira (incentiva caçar em grupo).
    for (const id of monster.contributors) {
      const player = this.players.get(id);
      if (!player || player.dead) continue;
      this.giveXp(player, monster.def.xp);
      this.giveLoot(player, monster, now);
      this.countQuestKill(player, monster.def.id);
    }
  }

  private updateMonster(monster: Monster, now: number): void {
    if (monster.windup) {
      if (now >= monster.windup.resolveAt) this.resolveWindup(monster, now);
      return; // parado enquanto prepara o golpe
    }
    if (monster.singing) {
      if (now >= monster.singing.resolveAt) this.resolveSong(monster, now);
      return; // parada enquanto canta
    }
    const def = monster.def;
    let target = monster.targetId !== null ? this.players.get(monster.targetId) : undefined;
    if (
      monster.targetId !== null &&
      (!target ||
        target.dead ||
        chebyshev(monster, target) > def.chaseRange ||
        this.zoneDistance(monster) > def.chaseRange + LEASH_MARGIN)
    ) {
      this.dropTarget(monster);
      target = undefined;
    }

    if (!target && def.aggressive && monster.mode !== 'return' && now >= monster.retargetAt) {
      const found = this.nearestPlayer(monster, def.aggroRange, now);
      if (found) {
        monster.targetId = found.id;
        monster.mode = 'chase';
        monster.nextAttackAt = Math.max(monster.nextAttackAt, now + 300);
        target = found;
        this.emitToViewers(monster, { t: 'say', id: monster.id, text: '!' });
      }
    }

    if (target) return this.fight(monster, target, now);
    if (monster.mode === 'return') return this.walkHome(monster, now);
    this.wander(monster, now);
    this.regenMonster(monster, now);
  }

  private fight(monster: Monster, target: Player, now: number): void {
    const attack = monster.def.attack;
    const distance = chebyshev(monster, target);

    // Iara: de tempos em tempos canta, e quem fica perto é encantado e puxado para ela.
    const song = monster.def.song;
    if (song && distance <= song.range && now >= monster.nextSpecialAt) {
      this.startSong(monster, now);
      return;
    }

    // Saci: se o alvo foge para longe, ele aparece do lado num redemoinho.
    const whirlwind = monster.def.whirlwind;
    if (whirlwind && distance >= 5 && now >= monster.nextSpecialAt) {
      if (this.whirlwindNear(monster, target, now)) {
        monster.nextSpecialAt = now + whirlwind.everyMs;
        return;
      }
    }

    if (attack.kind === 'projectile') {
      if (distance < attack.minDistance) {
        if (now >= monster.nextStepAt) this.stepAway(monster, target, now);
        return;
      }
      if (distance > attack.range || !this.hasLineOfShot(monster, target)) {
        if (now >= monster.nextStepAt) this.stepToward(monster, target, now);
        return;
      }
      this.face(monster, dirTowards(monster, target));
      if (now >= monster.nextAttackAt) this.startWindup(monster, attack, [], angleBetween(monster, spotOf(target)), now);
      return;
    }

    const dir = dirTowards8(monster, target) ?? monster.dir;
    const tiles = this.attackTiles(monster, attack, dir);
    if (tileIn(tiles, target.x, target.y)) {
      this.face(monster, dir);
      if (now >= monster.nextAttackAt) this.startWindup(monster, attack, tiles, angleOfDir(dir), now);
      return;
    }
    if (now >= monster.nextStepAt) this.stepToward(monster, target, now);
  }

  private attackTiles(monster: Monster, attack: MonsterAttack, dir: Dir): Tile[] {
    switch (attack.kind) {
      case 'spin':
        return areaTiles(monster.x, monster.y, attack.range).filter((t) => this.map.isWalkable(t.x, t.y));
      case 'strike':
        return reachableLine(this.map, monster.x, monster.y, dir, attack.range);
      case 'bite':
        return reachableLine(this.map, monster.x, monster.y, dir, 1);
      case 'charge':
        return reachableLine(this.map, monster.x, monster.y, dir, attack.range);
      default:
        return [];
    }
  }

  // ---------- o canto (Iara) ----------

  /** Começa a cantar: avisa no chão a área do canto (dá para sair dela ou esquivar). */
  private startSong(monster: Monster, now: number): void {
    const song = monster.def.song!;
    monster.singing = { resolveAt: now + song.windupMs };
    monster.nextSpecialAt = now + song.everyMs;
    const tiles = areaTiles(monster.x, monster.y, song.range).filter((t) => this.map.isWalkable(t.x, t.y));
    this.emitToViewers(monster, { t: 'warn', id: monster.id, tiles: tiles.flatMap((t) => [t.x, t.y]), ms: song.windupMs });
    this.emitToViewers(monster, { t: 'fx', id: monster.id, kind: 'song', r: song.range });
    if (song.lines.length > 0) {
      this.emitToViewers(monster, { t: 'say', id: monster.id, text: song.lines[Math.floor(this.random() * song.lines.length)]! });
    }
  }

  /** O canto acaba: quem ficou na área (e não estava esquivando) fica encantado. */
  private resolveSong(monster: Monster, now: number): void {
    const song = monster.def.song;
    monster.singing = null;
    if (!song) return; // o administrador tirou o canto no meio
    monster.nextAttackAt = Math.max(monster.nextAttackAt, now + 600);
    for (const player of this.players.values()) {
      if (player.dead || player.loading || now < player.invulnerableUntil) continue;
      if (chebyshev(monster, player) > song.range) continue;
      player.charmedUntil = now + song.durationMs;
      player.charmedBy = monster.id;
      player.nextPullAt = now + song.pullEveryMs;
      player.queue.length = 0;
      player.charmResyncAt = now + 500;
      player.outbox.push({ t: 'charm', ms: song.durationMs });
    }
  }

  /** Encantado: a cada pouco é puxado um passo para perto de quem cantou; o tempo acabando ou ela sumindo, solta. */
  private updateCharm(player: Player, now: number): void {
    const charmer = player.charmedBy !== null ? this.monsters.get(player.charmedBy) : undefined;
    if (!charmer || now >= player.charmedUntil) return this.breakCharm(player);
    if (now < player.nextPullAt) return;
    player.nextPullAt = now + (charmer.def.song?.pullEveryMs ?? 450);
    if (chebyshev(player, charmer) <= 1) return; // já está colado nela
    const degrees = degreesToward(player.fx, player.fy, charmer.x, charmer.y);
    const result = sweepBody(this.map, { x: player.fx, y: player.fy, dir: player.dir }, degrees, 1);
    if (!result.moved) return;
    player.fx = result.x;
    player.fy = result.y;
    player.dir = result.dir;
    player.changed = true;
    player.outbox.push({ t: 'pull', x: player.fx, y: player.fy, dir: player.dir });
  }

  /** Solta o encanto (esquivou, acabou o tempo, ou quem cantou sumiu). */
  private breakCharm(player: Player): void {
    if (player.charmedBy === null) return;
    player.charmedBy = null;
    player.charmedUntil = 0;
    player.outbox.push({ t: 'charm', ms: 0 });
  }

  /** Começa a preparar um golpe: avisa no chão onde ele vai acertar. */
  private startWindup(monster: Monster, attack: MonsterAttack, tiles: Tile[], angle: number, now: number): void {
    monster.windup = { kind: attack.kind, tiles, resolveAt: now + attack.windupMs, angle };
    this.emitToViewers(monster, { t: 'warn', id: monster.id, tiles: tiles.flatMap((t) => [t.x, t.y]), ms: attack.windupMs });
  }

  private resolveWindup(monster: Monster, now: number): void {
    const windup = monster.windup!;
    monster.windup = null;
    const attack = monster.def.attack;
    monster.nextAttackAt = now + attack.intervalMs;

    if (windup.kind === 'projectile') {
      // Mira onde o alvo está agora: o projétil é lento e dá para desviar.
      const target = monster.targetId !== null ? this.players.get(monster.targetId) : undefined;
      const angle = target && !target.dead ? angleBetween(monster, spotOf(target)) : windup.angle;
      this.spawnProjectile(monster, angle, attack.speed, attack.range + 1.5, this.rollRange(...attack.damage), attack.projectile);
      return;
    }

    const reach = windup.kind === 'strike' || windup.kind === 'charge' ? { r: attack.range } : {};
    this.emitToViewers(monster, { t: 'fx', id: monster.id, kind: windup.kind, a: round3(windup.angle), ...reach });
    if (windup.kind === 'charge') return this.resolveCharge(monster, windup.tiles, now);
    for (const player of [...this.players.values()]) {
      if (!player.dead && tileIn(windup.tiles, player.x, player.y)) {
        this.damage(player, this.rollRange(...attack.damage), monster.id, now);
      }
    }
    // Saci: depois do giro, some num redemoinho.
    if (windup.kind === 'spin' && monster.def.whirlwind) this.whirlwindAway(monster, now);
  }

  /** Investida: atropela quem está na linha, corre até o fim dela e deixa o chão pegando fogo. */
  private resolveCharge(monster: Monster, path: Tile[], now: number): void {
    const attack = monster.def.attack;
    // até onde dá para correr: para antes de parede ou de outro monstro
    let last = 0;
    for (let i = 1; i < path.length; i++) {
      const tile = path[i]!;
      const other = this.monsterAt.get(this.tileKey(tile.x, tile.y));
      if (!this.map.isWalkable(tile.x, tile.y) || (other !== undefined && other !== monster.id)) break;
      last = i;
    }
    const run = path.slice(0, last + 1);
    for (const player of [...this.players.values()]) {
      if (!player.dead && tileIn(run, player.x, player.y)) this.damage(player, this.rollRange(...attack.damage), monster.id, now);
    }
    // não para em cima de ninguém: se tem gente no fim, para um tile antes
    const occupied = (t: Tile) => [...this.players.values()].some((p) => !p.dead && p.x === t.x && p.y === t.y);
    while (last > 0 && occupied(path[last]!)) last--;
    if (last > 0) {
      const end = path[last]!;
      this.monsterAt.delete(this.tileKey(monster.x, monster.y));
      monster.x = end.x;
      monster.y = end.y;
      this.monsterAt.set(this.tileKey(end.x, end.y), monster.id);
      monster.changed = true;
      monster.dashed = true;
    }
    monster.nextStepAt = now + CHARGE_REST_MS;
    if (attack.fire) this.setFire(monster, run, attack.fire, now);
  }

  private setFire(monster: Monster, tiles: Tile[], fire: { durationMs: number; damage: [number, number] }, now: number): void {
    this.hazards.push({ ownerId: monster.id, tiles, until: now + fire.durationMs, nextPulseAt: now + FIRE_FIRST_PULSE_MS, damage: fire.damage });
    this.emitToViewers(monster, { t: 'fire', id: monster.id, tiles: tiles.flatMap((t) => [t.x, t.y]), ms: fire.durationMs });
  }

  /** Quem está em cima do fogo se queima (a esquiva protege, como em qualquer golpe). */
  private updateHazards(now: number): void {
    if (this.hazards.length === 0) return;
    this.hazards = this.hazards.filter((hazard) => now < hazard.until);
    for (const hazard of this.hazards) {
      if (now < hazard.nextPulseAt) continue;
      hazard.nextPulseAt += FIRE_PULSE_MS;
      for (const player of [...this.players.values()]) {
        if (!player.dead && tileIn(hazard.tiles, player.x, player.y)) this.damage(player, this.rollRange(...hazard.damage), hazard.ownerId, now);
      }
    }
  }

  private dropTarget(monster: Monster): void {
    monster.targetId = null;
    monster.mode = 'return';
  }

  private walkHome(monster: Monster, now: number): void {
    if (this.zoneDistance(monster) === 0) {
      monster.mode = 'idle';
      monster.contributors.clear();
      if (monster.hp < monster.maxHp) {
        monster.hp = monster.maxHp;
        this.emitToViewers(monster, { t: 'hp', id: monster.id, hp: monster.hp, maxHp: monster.maxHp });
      }
      return;
    }
    if (now < monster.nextStepAt) return;
    const zone = monster.zone.zone;
    const home = { x: zone.x + (zone.w >> 1), y: zone.y + (zone.h >> 1) };
    const path = findPath(this.map, monster.x, monster.y, home.x, home.y, 2000);
    const dir = path?.[0];
    if (dir === undefined || !this.tryMoveMonster(monster, dir, now)) {
      // Sem caminho (ou travado): volta direto para a área.
      const tile = this.freeTileInZone(monster.zone);
      if (tile && !path) this.teleportMonster(monster, tile);
      monster.nextStepAt = now + monster.def.stepMs;
    }
  }

  private wander(monster: Monster, now: number): void {
    if (now < monster.nextWanderAt || now < monster.nextStepAt) return;
    monster.nextWanderAt = now + 1500 + this.random() * 3500;
    const dir = Math.floor(this.random() * 4) as Dir;
    const zone = monster.zone.zone;
    const nx = monster.x + DX[dir];
    const ny = monster.y + DY[dir];
    if (nx >= zone.x && ny >= zone.y && nx < zone.x + zone.w && ny < zone.y + zone.h) this.tryMoveMonster(monster, dir, now);
  }

  private regenMonster(monster: Monster, now: number): void {
    if (monster.hp >= monster.maxHp || now - monster.lastDamagedAt < 4000 || now < monster.nextRegenAt) return;
    monster.nextRegenAt = now + 1000;
    monster.hp = Math.min(monster.maxHp, monster.hp + Math.ceil(monster.maxHp * 0.1));
    this.emitToViewers(monster, { t: 'hp', id: monster.id, hp: monster.hp, maxHp: monster.maxHp });
  }

  private stepToward(monster: Monster, target: Player, now: number): void {
    const path = findPath(this.map, monster.x, monster.y, target.x, target.y, 600);
    if (!path) {
      // Não tem como chegar (ex.: do outro lado do rio): desiste e só tenta de novo daqui a pouco.
      monster.retargetAt = now + 3000;
      this.dropTarget(monster);
      return;
    }
    const first = path[0];
    if (first !== undefined && this.tryMoveMonster(monster, first, now)) return;
    // Caminho ocupado por outro monstro: tenta qualquer passo que aproxime.
    const current = Math.abs(target.x - monster.x) + Math.abs(target.y - monster.y);
    for (const dir of this.shuffledDirs()) {
      const nx = monster.x + DX[dir];
      const ny = monster.y + DY[dir];
      if (Math.abs(target.x - nx) + Math.abs(target.y - ny) < current && this.tryMoveMonster(monster, dir, now)) return;
    }
    monster.nextStepAt = now + monster.def.stepMs / 2;
  }

  private stepAway(monster: Monster, target: Player, now: number): void {
    let best: Dir | null = null;
    let bestDistance = chebyshev(monster, target);
    for (const dir of this.shuffledDirs()) {
      const tile = { x: monster.x + DX[dir], y: monster.y + DY[dir] };
      const distance = chebyshev(tile, target);
      if (distance > bestDistance && this.canMonsterEnter(tile.x, tile.y) && this.zoneDistance(tile, monster.zone) <= monster.def.chaseRange) {
        best = dir;
        bestDistance = distance;
      }
    }
    if (best !== null) this.tryMoveMonster(monster, best, now);
    else monster.nextStepAt = now + monster.def.stepMs;
  }

  /** Saci aparece pertinho do alvo. */
  private whirlwindNear(monster: Monster, target: Player, now: number): boolean {
    const options: Tile[] = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tile = { x: target.x + dx, y: target.y + dy };
        const distance = chebyshev(tile, target);
        if (distance >= 1 && distance <= 2 && this.canMonsterEnter(tile.x, tile.y) && this.map.isReachable(tile.x, tile.y)) options.push(tile);
      }
    }
    const tile = options[Math.floor(this.random() * options.length)];
    if (!tile) return false;
    this.whirlwindTo(monster, tile);
    monster.nextAttackAt = Math.max(monster.nextAttackAt, now + 500);
    return true;
  }

  /** Saci some e reaparece a alguns tiles de distância. */
  private whirlwindAway(monster: Monster, now: number): void {
    const reach = monster.def.whirlwind?.distance ?? 4;
    const options: Tile[] = [];
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const tile = { x: monster.x + dx, y: monster.y + dy };
        if (
          chebyshev(tile, monster) >= 3 &&
          this.canMonsterEnter(tile.x, tile.y) &&
          this.map.isReachable(tile.x, tile.y) &&
          this.zoneDistance(tile, monster.zone) <= monster.def.chaseRange
        ) {
          options.push(tile);
        }
      }
    }
    const tile = options[Math.floor(this.random() * options.length)];
    if (tile) this.whirlwindTo(monster, tile);
    monster.nextSpecialAt = Math.max(monster.nextSpecialAt, now + 1500);
  }

  private whirlwindTo(monster: Monster, tile: Tile): void {
    this.emitToViewers(monster, { t: 'fx', id: monster.id, kind: 'whirlwind' });
    this.teleportMonster(monster, tile);
    const lines = monster.def.whirlwind?.lines ?? [];
    const line = lines[Math.floor(this.random() * lines.length)];
    if (line) this.emitToViewers(monster, { t: 'say', id: monster.id, text: line });
  }

  private teleportMonster(monster: Monster, tile: Tile): void {
    this.monsterAt.delete(this.tileKey(monster.x, monster.y));
    monster.x = tile.x;
    monster.y = tile.y;
    this.monsterAt.set(this.tileKey(tile.x, tile.y), monster.id);
    monster.changed = true;
  }

  private tryMoveMonster(monster: Monster, dir: Dir, now: number): boolean {
    const nx = monster.x + DX[dir];
    const ny = monster.y + DY[dir];
    // mesma regra dos jogadores: na diagonal não corta quina de parede/árvore
    if (!canStep(this.map, monster.x, monster.y, dir) || !this.canMonsterEnter(nx, ny)) return false;
    this.monsterAt.delete(this.tileKey(monster.x, monster.y));
    monster.x = nx;
    monster.y = ny;
    monster.dir = dir;
    this.monsterAt.set(this.tileKey(nx, ny), monster.id);
    monster.changed = true;
    monster.nextStepAt = now + stepDuration(dir, monster.def.stepMs);
    return true;
  }

  /** Monstros não entram em parede, em outro monstro nem em cima de jogador. */
  private canMonsterEnter(x: number, y: number): boolean {
    if (!this.map.isWalkable(x, y) || this.monsterAt.has(this.tileKey(x, y))) return false;
    for (const player of this.players.values()) if (!player.dead && player.x === x && player.y === y) return false;
    return true;
  }

  private hasLineOfShot(from: Tile, to: Tile): boolean {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance === 0) return true;
    const probe = makeShot(from, angleBetween(from, to), 1, distance);
    return advanceShot(probe, distance, this.map) !== 'wall';
  }

  /** O jogador mais perto que este monstro pode notar sozinho (quem acabou de chegar ainda não conta). */
  private nearestPlayer(monster: Monster, range: number, now: number): Player | null {
    let best: Player | null = null;
    let bestDistance = Infinity;
    for (const player of this.players.values()) {
      if (player.dead || player.loading || now < player.unnoticedUntil) continue;
      const distance = chebyshev(monster, player);
      if (distance <= range && distance < bestDistance) {
        best = player;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Distância (em tiles) de um ponto até a área do monstro (0 = dentro dela). */
  private zoneDistance(point: Tile, zoneState?: ZoneState): number {
    const zone = (zoneState ?? (point as Monster).zone).zone;
    const dx = Math.max(zone.x - point.x, 0, point.x - (zone.x + zone.w - 1));
    const dy = Math.max(zone.y - point.y, 0, point.y - (zone.y + zone.h - 1));
    return Math.max(dx, dy);
  }

  /** Um tile livre (e alcançável a pé) dentro da área do monstro. */
  private freeTileInZone(zoneState: ZoneState): Tile | null {
    const zone = zoneState.zone;
    for (let tries = 0; tries < 40; tries++) {
      const x = zone.x + Math.floor(this.random() * zone.w);
      const y = zone.y + Math.floor(this.random() * zone.h);
      if (this.canMonsterEnter(x, y) && this.map.isReachable(x, y)) return { x, y };
    }
    for (let y = zone.y; y < zone.y + zone.h; y++) {
      for (let x = zone.x; x < zone.x + zone.w; x++) if (this.canMonsterEnter(x, y) && this.map.isReachable(x, y)) return { x, y };
    }
    return null;
  }

  // ======================= visão e mensagens =======================

  /** Área de visão: cada jogador só recebe notícias de quem está perto dele. */
  private updateView(player: Player): void {
    for (const other of this.players.values()) if (other !== player) this.see(player, other);
    for (const monster of this.monsters.values()) this.see(player, monster);
  }

  private see(player: Player, other: Entity): void {
    const dx = Math.abs(other.x - player.x);
    const dy = Math.abs(other.y - player.y);
    if (player.known.has(other.id)) {
      if (dx > VIEW_RADIUS_X + VIEW_HYSTERESIS || dy > VIEW_RADIUS_Y + VIEW_HYSTERESIS) {
        player.known.delete(other.id);
        player.outbox.push({ t: 'despawn', id: other.id });
      } else if (other.changed) {
        const dashed = other.dashed;
        const at = spotOf(other);
        player.outbox.push({ t: 'move', id: other.id, x: round3(at.x), y: round3(at.y), dir: other.dir, ...(dashed ? { dash: true as const } : {}) });
      }
    } else if (dx <= VIEW_RADIUS_X && dy <= VIEW_RADIUS_Y) {
      player.known.add(other.id);
      player.outbox.push({ t: 'spawn', e: other.state() });
    }
  }

  /** Manda a mensagem para quem está vendo a entidade (e para ela mesma, se for jogador). */
  private emitToViewers(entity: Entity, msg: ServerMsg, exceptId?: number): void {
    for (const player of this.players.values()) {
      if (player.id === exceptId) continue;
      if (player.id === entity.id || player.known.has(entity.id)) player.outbox.push(msg);
    }
  }

  /** Mensagem para todo mundo neste mapa. */
  broadcastLocal(msg: ServerMsg, exceptId?: number): void {
    for (const player of this.players.values()) {
      if (player.id !== exceptId) player.outbox.push(msg);
    }
  }

  private fail(player: Player, reason: FailReason, item = false): void {
    player.outbox.push(item ? { t: 'fail', reason, item: true } : { t: 'fail', reason });
  }

  // ======================= ajudantes =======================

  private face(entity: Entity, dir: Dir | null): void {
    if (dir !== null && dir !== entity.dir) {
      entity.dir = dir;
      entity.changed = true;
    }
  }

  private faceAngle(entity: Entity, angle: number): void {
    this.face(entity, dirFromAngle(angle));
  }

  private rollRange(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1));
  }

  private shuffledDirs(): Dir[] {
    const dirs: Dir[] = [0, 1, 2, 3];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j]!, dirs[i]!];
    }
    return dirs;
  }

  private tileKey(x: number, y: number): number {
    return y * this.map.width + x;
  }

  /** Espalha quem nasce para não ficar todo mundo empilhado no mesmo tile. */
  private pickSpawnTile(): { x: number; y: number } {
    const options = this.map.walkableAround(this.map.spawn.x, this.map.spawn.y, 2);
    return options[Math.floor(this.random() * options.length)] ?? this.map.spawn;
  }
}

/** Vida máxima: a do nível mais a dos equipamentos. */
function playerMaxHp(player: Player): number {
  return maxHpFor(player.level) + player.bonus.hp;
}

/** O que fica salvo de um jogador. */
export function characterData(player: Player, zone: string): CharacterData {
  const base = { level: player.level, xp: player.xp, look: player.look, zone, inventory: player.inventory.state(), quests: { ...player.quests } };
  // Desmaiado: na volta ele acordaria na vila com a vida cheia, então já salva assim.
  if (player.dead) return { ...base, hp: null, x: null, y: null, dir: DOWN };
  return { ...base, hp: player.hp, x: player.x, y: player.y, dir: player.dir };
}
