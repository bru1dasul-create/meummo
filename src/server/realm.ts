// O jogo inteiro: todos os mapas ligados. Cada mapa é um World (com os monstros e jogadores de lá);
// o Realm cuida do que atravessa mapas — entrar no jogo no mapa certo, passar pelas saídas, acordar
// na vila depois de desmaiar num mapa sem vila, e o chat e os avisos que valem para todo mundo.

import { MAX_PLAYERS } from '../shared/constants';
import type { Dir } from '../shared/dir';
import type { EquipSlot } from '../shared/items';
import type { GameMap } from '../shared/map';
import { nameKey, nameProblem, normalizeName } from '../shared/names';
import type { ItemAction, ServerMsg } from '../shared/protocol';
import type { TuningFile } from './tuning';
import { World, type Conn, type JoinProfile, type JoinResult, type Player, type WorldLinks, type WorldOptions } from './world';

export type RealmOptions = Omit<WorldOptions, 'links'>;

/** Confere se toda saída leva a um mapa e a um ponto de chegada que existem (erro em português se não). */
export function checkLinks(maps: GameMap[]): void {
  const byId = new Map(maps.map((m) => [m.id, m]));
  for (const map of maps) {
    for (const exit of map.exits) {
      const target = byId.get(exit.to);
      if (!target) {
        throw new Error(`A saída em (${exit.x}, ${exit.y}) do mapa "${map.id}" leva para o mapa "${exit.to}", que não existe em public/assets/maps.`);
      }
      if (exit.arrival !== 'spawn' && !target.points.has(exit.arrival)) {
        throw new Error(
          `A saída em (${exit.x}, ${exit.y}) do mapa "${map.id}" chega no ponto "${exit.arrival}", mas o mapa "${target.id}" não tem um ponto com esse nome.`,
        );
      }
      const point = exit.arrival === 'spawn' ? target.spawn : target.points.get(exit.arrival)!;
      if (target.exitAt(point.x, point.y)) {
        throw new Error(`O ponto de chegada "${exit.arrival}" do mapa "${target.id}" está em cima de uma saída: quem chegasse voltaria na hora.`);
      }
    }
    if (map.respawnMap && !byId.has(map.respawnMap)) {
      throw new Error(`O mapa "${map.id}" manda acordar no mapa "${map.respawnMap}" (propriedade renascerEm), que não existe.`);
    }
  }
}

export class Realm {
  /** Id do mapa → o mundo daquele mapa. */
  readonly worlds = new Map<string, World>();
  /** Onde os personagens novos começam (o mapa com a propriedade `inicial`). */
  readonly start: World;
  private nextId = 1;
  /** Id do jogador → mapa onde ele está agora. */
  private readonly where = new Map<number, World>();
  private readonly travels: { player: Player; to: string; arrival: string }[] = [];

  constructor(maps: GameMap[], options: RealmOptions = {}) {
    if (maps.length === 0) throw new Error('Nenhum mapa encontrado em public/assets/maps.');
    checkLinks(maps);
    const links: WorldLinks = {
      nextId: () => this.nextId++,
      announce: (msg, exceptId) => this.announce(msg, exceptId),
      online: () => this.online,
      travel: (player, to, arrival) => {
        if (!this.worlds.has(to)) return false;
        this.travels.push({ player, to, arrival });
        return true;
      },
    };
    for (const map of maps) {
      if (this.worlds.has(map.id)) throw new Error(`Dois mapas com o mesmo id: "${map.id}".`);
      this.worlds.set(map.id, new World(map, { ...options, links }));
    }
    this.start = [...this.worlds.values()].find((w) => w.map.start) ?? this.worlds.values().next().value!;
  }

  /** Quantos estão online, somando todos os mapas. */
  get online(): number {
    let total = 0;
    for (const world of this.worlds.values()) total += world.players.size;
    return total;
  }

  /** O mapa onde o jogador está. */
  worldOf(player: Player): World | undefined {
    return this.where.get(player.id);
  }

  /** Entra no jogo: no mapa onde o personagem salvo estava (se ainda existir) ou no mapa inicial. */
  join(rawName: string, conn: Conn, profile?: JoinProfile): JoinResult {
    const saved = profile?.character;
    const name = saved ? saved.name : normalizeName(rawName);
    if (!saved && nameProblem(name)) return { ok: false, reason: 'name_invalid' };
    if (this.online >= MAX_PLAYERS) return { ok: false, reason: 'full' };
    const key = nameKey(name);
    for (const world of this.worlds.values()) {
      for (const other of world.players.values()) if (nameKey(other.name) === key) return { ok: false, reason: 'name_taken' };
    }
    const zone = saved?.zone;
    const world = (zone && [...this.worlds.values()].find((w) => w.map.id === zone || w.map.name === zone)) || this.start;
    const result = world.join(name, conn, profile);
    if (result.ok) this.where.set(result.player.id, world);
    return result;
  }

  leave(player: Player): void {
    this.worldOf(player)?.leave(player);
    this.where.delete(player.id);
  }

  // ---------- pedidos do jogador: vão para o mapa onde ele está ----------

  requestStep(player: Player, seq: number, dir: Dir, dash = false): void {
    this.worldOf(player)?.requestStep(player, seq, dir, dash);
  }

  shoot(player: Player, cid: number, angle: number): void {
    this.worldOf(player)?.shoot(player, cid, angle);
  }

  useSkill(player: Player, n: number, angle: number): void {
    this.worldOf(player)?.useSkill(player, n, angle);
  }

  itemAction(player: Player, act: ItemAction, i: number): void {
    this.worldOf(player)?.itemAction(player, act, i);
  }

  unequip(player: Player, part: EquipSlot): void {
    this.worldOf(player)?.unequip(player, part);
  }

  buy(player: Player, npc: number, item: string, n: number): void {
    this.worldOf(player)?.buy(player, npc, item, n);
  }

  sell(player: Player, npc: number, i: number, n: number): void {
    this.worldOf(player)?.sell(player, npc, i, n);
  }

  chat(player: Player, text: string): void {
    this.worldOf(player)?.chat(player, text);
  }

  loaded(player: Player): void {
    this.worldOf(player)?.loaded(player);
  }

  // ---------- o relógio ----------

  /** Um tick em todos os mapas; depois, quem pisou numa saída troca de mapa. */
  tick(): void {
    for (const world of this.worlds.values()) world.tick();
    const travels = this.travels.splice(0);
    for (const { player, to, arrival } of travels) {
      const from = this.where.get(player.id);
      const target = this.worlds.get(to);
      if (!from || !target || !from.players.has(player.id)) continue; // saiu do jogo no meio do caminho
      from.detach(player);
      target.adopt(player, target.arrivalSpot(arrival));
      this.where.set(player.id, target);
    }
  }

  /** O administrador ajustou o jogo no painel: cada mapa atualiza o que precisa e avisa quem está jogando. */
  tuningChanged(changed: ReadonlySet<TuningFile>): void {
    for (const world of this.worlds.values()) {
      if (changed.has('monstros')) world.refreshMonsters();
      if (changed.has('itens')) world.refreshItems();
      if (changed.has('npcs')) world.refreshNpcs();
    }
  }

  /** Salva todo mundo (em todos os mapas). */
  saveAll(): void {
    for (const world of this.worlds.values()) world.saveAll();
  }

  /** Aviso para todo mundo online, em qualquer mapa. */
  announce(msg: ServerMsg, exceptId?: number): void {
    for (const world of this.worlds.values()) world.broadcastLocal(msg, exceptId);
  }
}
