// O jogo inteiro: todos os mapas ligados. Cada mapa é um World (com os monstros e jogadores de lá);
// o Realm cuida do que atravessa mapas — entrar no jogo no mapa certo, passar pelas saídas, acordar
// na vila depois de desmaiar num mapa sem vila, e o chat e os avisos que valem para todo mundo.

import { MAX_PLAYERS } from '../shared/constants';
import type { EquipSlot } from '../shared/items';
import type { GameMap } from '../shared/map';
import { nameKey, nameProblem, normalizeName } from '../shared/names';
import type { GmCommand, ItemAction, QuestAction, ServerMsg } from '../shared/protocol';
import type { ItemInfo } from '../shared/items';
import type { TuningFile } from './tuning';
import { World, type Conn, type JoinProfile, type JoinResult, type Player, type WorldLinks, type WorldOptions } from './world';

export type RealmOptions = Omit<WorldOptions, 'links'> & {
  /** Id do mapa onde os personagens novos começam (para testar um mapa novo); sem isto, o de `inicial`. */
  startMap?: string;
};

/** Um jogador online, como o painel do administrador mostra. */
export interface AdminPlayer {
  id: number;
  nome: string;
  mapa: string;
  mapaNome: string;
  x: number;
  y: number;
  nivel: number;
  vida: number;
  vidaMax: number;
  ouro: number;
  desmaiado: boolean;
}

export type AdminResult = { ok: true; texto: string } | { ok: false; erro: string };

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
  /** Onde começa quem entra pelo jogo 2.5D novo (o mapa do formato novo com `inicial`, ou o primeiro deles). */
  readonly newStart: World;
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
    if (options.startMap && !this.worlds.has(options.startMap)) {
      throw new Error(`O mapa inicial "${options.startMap}" não existe. Use um destes: ${[...this.worlds.keys()].join(', ')}.`);
    }
    const all = [...this.worlds.values()];
    const chosen = options.startMap ? this.worlds.get(options.startMap) : undefined;
    // o jogo de hoje não desenha os mapas do formato novo: o mapa escolhido só vale para o jogo do formato dele
    this.start = (chosen && !chosen.map.metric ? chosen : undefined) ?? all.find((w) => w.map.start && !w.map.metric) ?? all.find((w) => !w.map.metric) ?? all[0]!;
    const metric = all.filter((w) => w.map.metric);
    this.newStart = (chosen?.map.metric ? chosen : undefined) ?? metric.find((w) => w.map.start) ?? metric[0] ?? this.start;
  }

  /** Tem algum mapa do formato novo (mundo 2.5D)? */
  private get hasMetric(): boolean {
    return [...this.worlds.values()].some((w) => w.map.metric);
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
    const savedWorld = zone ? [...this.worlds.values()].find((w) => w.map.id === zone || w.map.name === zone) : undefined;
    // Cada jogo só abre os mapas do seu formato: o 2.5D novo, os do formato novo; o de hoje, os de sempre.
    const newWorld = profile?.newWorld === true;
    const fits = (w: World) => w.map.metric === newWorld || (!this.hasMetric && newWorld);
    const world = (savedWorld && fits(savedWorld) ? savedWorld : undefined) ?? (newWorld ? this.newStart : this.start);
    const result = world.join(name, conn, profile);
    if (result.ok) this.where.set(result.player.id, world);
    return result;
  }

  leave(player: Player): void {
    this.worldOf(player)?.leave(player);
    this.where.delete(player.id);
  }

  // ---------- pedidos do jogador: vão para o mapa onde ele está ----------

  requestWalk(player: Player, seq: number, degrees: number, dash = false, slow = false): void {
    this.worldOf(player)?.requestWalk(player, seq, degrees, dash, slow);
  }

  charge(player: Player): void {
    this.worldOf(player)?.charge(player);
  }

  guard(player: Player, on: boolean, angle: number): void {
    this.worldOf(player)?.guard(player, on, angle);
  }

  gm(player: Player, cmd: GmCommand): void {
    this.worldOf(player)?.gm(player, cmd);
  }

  /** O painel marcou (ou desmarcou) alguém como administrador: se ele está jogando, vale na hora. */
  setAdmin(name: string, admin: boolean): void {
    const key = nameKey(name);
    for (const world of this.worlds.values()) {
      for (const player of world.players.values()) {
        if (nameKey(player.name) === key) world.setAdmin(player, admin);
      }
    }
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

  questAction(player: Player, act: QuestAction, id: string, npc?: number): void {
    this.worldOf(player)?.questAction(player, act, id, npc);
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

  // ---------- painel do administrador: ferramentas de jogadores ----------

  /** Quem está online agora, em todos os mapas. */
  playersOnline(): AdminPlayer[] {
    const list: AdminPlayer[] = [];
    for (const world of this.worlds.values()) {
      for (const p of world.players.values()) {
        list.push({
          id: p.id,
          nome: p.name,
          mapa: world.map.id,
          mapaNome: world.map.name,
          x: p.x,
          y: p.y,
          nivel: p.level,
          vida: p.hp,
          vidaMax: p.maxHp,
          ouro: p.inventory.gold,
          desmaiado: p.dead,
        });
      }
    }
    return list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  private findOnline(id: number): { player: Player; world: World } | null {
    const world = this.where.get(id);
    const player = world?.players.get(id);
    return world && player ? { player, world } : null;
  }

  adminGiveGold(id: number, n: number): AdminResult {
    const found = this.findOnline(id);
    if (!found) return { ok: false, erro: 'Esse jogador não está mais online.' };
    const added = found.world.adminGiveGold(found.player, n);
    return { ok: true, texto: `${found.player.name} recebeu ${added} de ouro.` };
  }

  adminGiveItem(id: number, item: ItemInfo, n: number): AdminResult {
    const found = this.findOnline(id);
    if (!found) return { ok: false, erro: 'Esse jogador não está mais online.' };
    const added = found.world.adminGiveItem(found.player, item.id, n);
    const what = `${item.name}${n > 1 ? ` ×${n}` : ''}`;
    return {
      ok: true,
      texto: added === n ? `${found.player.name} recebeu: ${what}.` : `${found.player.name} recebeu: ${what} (${n - added} não couberam na mochila e ficaram no chão, ao lado).`,
    };
  }

  adminHeal(id: number): AdminResult {
    const found = this.findOnline(id);
    if (!found) return { ok: false, erro: 'Esse jogador não está mais online.' };
    if (found.player.dead) return { ok: false, erro: `${found.player.name} desmaiou: espere acordar na vila.` };
    found.world.adminHeal(found.player);
    return { ok: true, texto: `${found.player.name} está com a vida cheia.` };
  }

  /** Leva o jogador para um mapa (no ponto de nascimento, ou em (x, y) — ou o chão livre mais perto). */
  adminMove(id: number, mapId: string, x?: number, y?: number): AdminResult {
    const found = this.findOnline(id);
    if (!found) return { ok: false, erro: 'Esse jogador não está mais online.' };
    const { player, world: from } = found;
    if (player.dead) return { ok: false, erro: `${player.name} desmaiou: espere acordar na vila.` };
    if (player.loading) return { ok: false, erro: `${player.name} está trocando de mapa agora: tente de novo em um instante.` };
    const target = this.worlds.get(mapId);
    if (!target) return { ok: false, erro: `O mapa "${mapId}" não existe.` };
    if (x !== undefined && y !== undefined && (x >= target.map.width || y >= target.map.height)) {
      return { ok: false, erro: `(${x}, ${y}) fica fora do mapa ${target.map.name} (${target.map.width}×${target.map.height}).` };
    }
    const spot = target.freeSpot(x, y);
    if (!spot) return { ok: false, erro: `Não achei chão livre perto de (${x}, ${y}) em ${target.map.name}.` };
    if (target === from) {
      from.adminTeleport(player, spot);
    } else {
      from.detach(player);
      target.adopt(player, spot);
      this.where.set(player.id, target);
    }
    return { ok: true, texto: `${player.name} agora está em ${target.map.name} (${spot.x}, ${spot.y}).` };
  }

  /** Aviso do administrador para todo mundo online (aparece grande na tela). */
  notice(text: string): void {
    this.announce({ t: 'notice', text });
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
