// O motor do jogo 2.5D (o mundo novo): conversa com o servidor, lê teclado/joystick/toque, prevê o próprio andar
// (com as mesmas regras do servidor, em src/shared/movement.ts) e manda o desenho (view.ts) mostrar tudo.
// O desenho de verdade é da [arte]; enquanto ele não chega, a ProvisionalView mostra o básico.
// Abre em http://localhost:3000/?novo (o jogo de hoje continua em http://localhost:3000).

import { DASH_TILES, MAX_PENDING_WALKS, TRADE_RANGE, WALK_SLICE_MS } from '../../shared/constants';
import { DX, DY, type Dir } from '../../shared/dir';
import { GameMap, type Tile, type TiledMap } from '../../shared/map';
import { degreesOfDir, cornerAtFeet, feetAt, footCenter, sweepBody, sliceDistance, walkSlice, type Pose } from '../../shared/movement';
import { findRoute, followRoute } from '../../shared/route';
import type { EntityState, NpcInfo, PlayerStats, ServerMsg, WelcomeMsg, ZoneMsg } from '../../shared/protocol';
import { KeyboardDirections } from '../game/input';
import type { Connection } from '../net';
import { Toast, ZoneBanner, type ChatBox, type Hud } from '../ui';
import './arte'; // o desenho de verdade (PD.View), da [arte], quando estiver pronto
import { Joystick } from './joystick';
import { ProvisionalView, type WorldView } from './view';

export interface NewWorldDeps {
  conn: Connection;
  welcome: WelcomeMsg;
  chat: ChatBox;
  hud: Hud;
}

export interface NewWorldGame {
  destroy(): void;
}

const PING_EVERY_MS = 2000;

/** Liga o jogo 2.5D. Recusa (com o motivo) se o mapa não for do formato novo. */
export async function startNewWorld(deps: NewWorldDeps): Promise<NewWorldGame> {
  const game = new NewWorld(deps);
  await game.enter(deps.welcome, false);
  return game;
}

/** Lê o mapa do mundo novo (public/assets/maps-iso). */
async function loadMap(id: string): Promise<TiledMap> {
  const response = await fetch(`/assets/maps-iso/${id}.tmj`);
  if (!response.ok) throw new Error(`O mapa "${id}" ainda não existe no jogo novo.`);
  return (await response.json()) as TiledMap;
}

/**
 * O desenho: o da [arte] (PD.View, quando estiver carregado) ou o provisório. `?novo&provisorio` força o provisório,
 * que mostra as caixas de colisão do mapa (bom para conferir onde o pé bate).
 */
function createView(container: HTMLElement, map: TiledMap): WorldView {
  const pd = (window as unknown as { PD?: { View?: new (container: HTMLElement, map: TiledMap) => WorldView } }).PD;
  const forceProvisional = new URLSearchParams(location.search).has('provisorio');
  return pd?.View && !forceProvisional ? new pd.View(container, map) : new ProvisionalView(container, map);
}

class NewWorld implements NewWorldGame {
  private readonly conn: Connection;
  private readonly chat: ChatBox;
  private readonly hud: Hud;
  private readonly container = document.getElementById('game') as HTMLElement;
  private readonly keyboard: KeyboardDirections;
  private readonly joystick: Joystick;
  private readonly toast = new Toast();
  private readonly zoneBanner = new ZoneBanner();
  private map!: GameMap;
  private view: WorldView | null = null;
  private myId = 0;
  private stepMs = 200;

  // Previsão do próprio andar (como no jogo de hoje): anda na hora e o servidor confirma depois.
  private predicted!: Pose;
  private pending: { seq: number; a: number; dash: boolean; slow: boolean }[] = [];
  /** Andando devagar agora (Shift segurado, ou o joystick empurrado só um pouco); o normal é correr. */
  private slow = false;
  private shiftDown = false;
  private seq = 0;
  private walkCredit = WALK_SLICE_MS;
  private walkAt = 0;
  /** "Tocar no chão para andar": pontos até o destino. */
  private route: Tile[] = [];
  /** Onde o "andar até" quer chegar (para recalcular o caminho se travar). */
  private routeGoal: Tile | null = null;
  /** Quantas vezes o caminho deste "andar até" já foi recalculado. */
  private replans = 0;
  private stuckSlices = 0;
  /** Indo conversar com este NPC (fala quando chegar perto). */
  private goingToNpc: number | null = null;

  private readonly entities = new Map<number, EntityState>();
  /** Para onde cada um olha (graus), para o desenho girar contínuo. */
  private readonly facing = new Map<number, number>();
  /** Direção do seu último pedido de andar (graus): é para onde o seu personagem olha. */
  private myAngle = 90;
  private readonly npcs = new Map<number, NpcInfo>();
  private wasSafe: boolean | null = null;
  private raf = 0;
  private pingTimer = 0;
  private pingId = 0;
  private readonly pings = new Map<number, number>();
  private destroyed = false;

  constructor(deps: NewWorldDeps) {
    this.conn = deps.conn;
    this.chat = deps.chat;
    this.hud = deps.hud;
    this.keyboard = new KeyboardDirections(() => this.chat.isTyping());
    this.joystick = new Joystick(this.container, (x, y) => this.tapAt(x, y));
    this.container.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
    this.pingTimer = window.setInterval(() => this.ping(), PING_EVERY_MS);
    this.exposeDebug();
  }

  /**
   * Para testes automáticos (como o window.__meummo do jogo de hoje): só lê o estado e usa o mesmo
   * "andar até" do toque — não dá vantagem, quem manda é o servidor.
   */
  private exposeDebug(): void {
    const game = this;
    (window as unknown as { __mundoNovo?: unknown }).__mundoNovo = {
      get me() {
        if (!game.predicted) return null; // ainda carregando o mapa
        const feet = feetAt(game.predicted.x, game.predicted.y);
        return { id: game.myId, x: game.predicted.x, y: game.predicted.y, feetX: feet.x, feetY: feet.y, map: game.map?.id };
      },
      walkTo: (x: number, y: number) => game.walkToPoint(x, y),
      walking: () => game.route.length > 0,
      safe: () => game.wasSafe,
      entities: () => [...game.entities.values()].map((e) => ({ id: e.id, kind: e.kind, type: e.type, name: e.name, x: e.x, y: e.y })),
      screenOf: (x: number, y: number) => game.view?.toScreen(x, y),
    };
  }

  /** Entra num mapa (no começo ou trocando de mapa). */
  async enter(msg: WelcomeMsg | ZoneMsg, arrived: boolean): Promise<void> {
    this.conn.hold(); // as mensagens esperam o mapa carregar
    const json = await loadMap(msg.map);
    if (this.destroyed) return;
    this.map = GameMap.fromTiled(json, msg.map);
    this.view?.destroy();
    this.view = createView(this.container, json);
    this.entities.clear();
    this.facing.clear();
    this.npcs.clear();
    this.pending = [];
    this.route = [];
    this.goingToNpc = null;
    this.wasSafe = null;
    if (msg.t === 'welcome') {
      this.myId = msg.id;
      this.stepMs = msg.stepMs;
      this.hud.setGold(msg.inv.gold ?? 0);
    }
    const you = msg.you;
    this.predicted = { x: you.x, y: you.y, dir: you.dir };
    this.myAngle = degreesOfDir(you.dir);
    this.addEntity(you, true);
    this.view.follow(this.myId);
    for (const npc of msg.npcs) {
      this.npcs.set(npc.e.id, npc);
      this.addEntity(npc.e, false);
    }
    this.applyStats(msg.stats);
    this.hud.setHp(you.hp, you.maxHp);
    this.hud.setOnline(msg.online);
    if (arrived) this.conn.send({ t: 'loaded' });
    this.conn.listen((m) => this.onMessage(m));
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearInterval(this.pingTimer);
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    this.keyboard.destroy();
    this.joystick.destroy();
    this.toast.destroy();
    this.zoneBanner.destroy();
    this.view?.destroy();
    this.view = null;
  }

  // ======================= laço =======================

  private readonly loop = (now: number) => {
    if (this.destroyed || !this.view) return;
    this.handleMovement(now);
    this.checkNpcArrival();
    this.checkSafeArea();
    this.view.frame(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  private addEntity(e: EntityState, me: boolean): void {
    this.entities.set(e.id, e);
    const feet = feetAt(e.x, e.y);
    this.facing.set(e.id, degreesOfDir(e.dir));
    this.view?.addActor(e.id, { kind: e.kind, type: e.type, name: e.name, look: e.look, x: feet.x, y: feet.y, angle: degreesOfDir(e.dir), me });
  }

  /**
   * Para onde alguém olha, em graus: o servidor manda só uma das 8 direções, então quem anda olha para onde
   * andou (o 2.5D gira contínuo); parado, vale a direção do servidor.
   */
  private facingOf(id: number, fromX: number, fromY: number, toX: number, toY: number, dir: Dir): number {
    const moved = Math.hypot(toX - fromX, toY - fromY) > 0.01;
    const angle = moved ? (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI : degreesOfDir(dir);
    this.facing.set(id, angle);
    return angle;
  }

  // ======================= andar =======================

  /** Quanto anda um pedaço: correndo (o normal) ou devagar (Shift / joystick empurrado de leve). */
  private sliceOf(slow: boolean): number {
    return sliceDistance(this.map.metric, slow, this.stepMs);
  }

  private readonly onKey = (event: KeyboardEvent) => {
    if (event.key === 'Shift') this.shiftDown = event.type === 'keydown';
  };
  private readonly onBlur = () => {
    this.shiftDown = false;
  };

  private handleMovement(now: number): void {
    const delta = this.walkAt > 0 ? Math.min(250, now - this.walkAt) : 0;
    this.walkAt = now;
    let degrees = this.wantedDegrees();
    if (degrees === null) {
      this.walkCredit = WALK_SLICE_MS; // parado: o primeiro pedaço sai na hora em que mexer
      return;
    }
    this.walkCredit = Math.min(this.walkCredit + delta, WALK_SLICE_MS * 3);
    while (degrees !== null && this.walkCredit >= WALK_SLICE_MS && this.pending.length < MAX_PENDING_WALKS) {
      this.walkCredit -= WALK_SLICE_MS;
      this.walkOnce(degrees);
      degrees = this.wantedDegrees();
    }
  }

  /** Direção (graus no chão) de uma direção da tela: o teclado e o joystick andam pela tela (W = para cima). */
  private screenDegrees(dx: number, dy: number): number {
    const ground = this.view!.groundDirOfScreen(dx, dy);
    return ((Math.round((Math.atan2(ground.y, ground.x) * 180) / Math.PI) % 360) + 360) % 360;
  }

  private wantedDegrees(): number | null {
    const held = this.keyboard.current();
    if (held !== null) {
      this.clearRoute();
      this.slow = this.shiftDown;
      return this.screenDegrees(DX[held.dir], DY[held.dir]);
    }
    const stick = this.joystick.direction();
    if (stick) {
      this.clearRoute();
      this.slow = stick.light;
      return this.screenDegrees(stick.dx, stick.dy);
    }
    this.slow = this.shiftDown; // "andar até" com Shift segurado vai devagar
    if (this.route.length === 0) return null;
    return followRoute(this.map, this.predicted, this.route, this.sliceOf(this.slow));
  }

  private walkOnce(degrees: number): void {
    const slow = this.slow;
    const result = walkSlice(this.map, this.predicted, degrees, this.sliceOf(slow));
    if (!result.moved && result.dir === this.predicted.dir) {
      this.noteStuck();
      return;
    }
    this.seq += 1;
    this.pending.push({ seq: this.seq, a: degrees, dash: false, slow });
    this.conn.send(slow ? { t: 'walk', seq: this.seq, a: degrees, slow: true } : { t: 'walk', seq: this.seq, a: degrees });
    this.predicted = { x: result.x, y: result.y, dir: result.dir };
    this.myAngle = degrees;
    this.showMe(WALK_SLICE_MS);
    if (result.moved) this.stuckSlices = 0;
    else this.noteStuck();
  }

  /**
   * O "andar até" não saiu do lugar: recalcula o caminho a partir de onde está (até 2 vezes). Se continuar
   * preso, larga a rota e avisa — o próximo toque calcula de novo a partir daqui.
   */
  private noteStuck(): void {
    if (this.route.length === 0) return;
    this.stuckSlices += 1;
    if (this.stuckSlices < 3) return;
    this.stuckSlices = 0;
    const found = this.routeGoal && this.replans < 2 ? findRoute(this.map, this.predicted, this.routeGoal) : null;
    this.replans += 1;
    if (found && found.points.length > 0) {
      this.route = found.points;
      return;
    }
    this.clearRoute();
    this.goingToNpc = null;
    this.toast.show('Não dá para chegar aí');
  }

  private showMe(durationMs: number): void {
    const feet = feetAt(this.predicted.x, this.predicted.y);
    this.view?.moveActor(this.myId, feet.x, feet.y, this.myAngle, { durationMs });
  }

  private onAck(seq: number, server: Pose): void {
    this.pending = this.pending.filter((p) => p.seq > seq);
    let pose: Pose = server;
    for (const p of this.pending) pose = p.dash ? sweepBody(this.map, pose, p.a, DASH_TILES) : walkSlice(this.map, pose, p.a, this.sliceOf(p.slow));
    const off = Math.hypot(pose.x - this.predicted.x, pose.y - this.predicted.y);
    if (off > 1e-6) {
      this.predicted = { x: pose.x, y: pose.y, dir: pose.dir };
      if (off > 0.75) this.clearRoute();
      this.showMe(100);
    }
  }

  private placeMe(x: number, y: number, dir: Dir): void {
    this.pending = [];
    this.predicted = { x, y, dir };
    this.myAngle = degreesOfDir(dir);
    this.walkCredit = WALK_SLICE_MS;
    this.clearRoute();
    this.showMe(0);
  }

  /**
   * Tocar/clicar no chão: anda até lá, pelo caminho onde o pé passa (src/shared/route.ts). Se o pé não cabe
   * onde tocou (árvore, casa), vai até o lugar livre mais perto.
   */
  private walkToPoint(x: number, y: number): void {
    const goal = cornerAtFeet(x, y);
    const found = findRoute(this.map, this.predicted, goal);
    this.stuckSlices = 0;
    this.replans = 0;
    if (!found || found.points.length === 0) {
      this.clearRoute();
      this.toast.show('Não dá para chegar aí');
      return;
    }
    this.route = found.points;
    this.routeGoal = found.points[found.points.length - 1]!;
  }

  private clearRoute(): void {
    this.route = [];
    this.routeGoal = null;
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    if (!this.view || event.button > 0 || this.joystick.owns(event)) return;
    // na área do joystick, o toque rápido chega pelo próprio joystick (tapAt), quando o dedo sai
    if (event.pointerType !== 'mouse' && event.clientX <= window.innerWidth * 0.45) return;
    this.tapAt(event.clientX, event.clientY);
  };

  /** Tocou/clicou na tela neste ponto: vai conversar com o NPC que está ali ou anda até lá. */
  private tapAt(clientX: number, clientY: number): void {
    if (!this.view) return;
    const point = this.view.toWorld(clientX, clientY);
    // tocou perto de um NPC: vai conversar
    for (const [id, npc] of this.npcs) {
      const feet = feetAt(npc.e.x, npc.e.y);
      if (Math.hypot(feet.x - point.x, feet.y - point.y) <= 1.2) {
        this.goingToNpc = id;
        this.walkToPoint(feet.x, feet.y + 1);
        return;
      }
    }
    this.goingToNpc = null;
    this.walkToPoint(point.x, point.y);
  }

  /** Chegou perto do NPC que foi procurar: ele fala. */
  private checkNpcArrival(): void {
    if (this.goingToNpc === null) return;
    const npc = this.npcs.get(this.goingToNpc);
    if (!npc) {
      this.goingToNpc = null;
      return;
    }
    const me = feetAt(this.predicted.x, this.predicted.y);
    const feet = feetAt(npc.e.x, npc.e.y);
    if (Math.hypot(me.x - feet.x, me.y - feet.y) > TRADE_RANGE) {
      if (this.route.length === 0) this.goingToNpc = null; // desistiu no caminho
      return;
    }
    this.goingToNpc = null;
    this.clearRoute();
    if (npc.line) {
      this.view?.say(npc.e.id, npc.line);
      this.chat.addSystem(`${npc.e.name}: ${npc.line}`);
    }
  }

  /** Avisa quando entra ou sai de uma área segura. */
  private checkSafeArea(): void {
    if (this.map.safeAreas.length === 0) return;
    const at = footCenter(this.predicted.x, this.predicted.y);
    const safe = this.map.isSafeAt(at.x, at.y);
    if (safe === this.wasSafe) return;
    const first = this.wasSafe === null;
    this.wasSafe = safe;
    const area = this.map.safeAreas.find((a) => at.x >= a.x0 && at.x < a.x1 && at.y >= a.y0 && at.y < a.y1);
    if (safe) this.zoneBanner.show(area?.name || this.map.name, 'Zona segura');
    else this.zoneBanner.show(this.map.name, first ? 'Cuidado: aqui tem perigo' : 'Saiu da zona segura: cuidado', true);
  }

  // ======================= servidor =======================

  private ping(): void {
    this.pingId += 1;
    this.pings.set(this.pingId, performance.now());
    this.conn.send({ t: 'ping', id: this.pingId });
  }

  private applyStats(stats: PlayerStats): void {
    this.hud.setXp(stats.xp, stats.xpNext, stats.level);
  }

  private onMessage(msg: ServerMsg): void {
    switch (msg.t) {
      case 'spawn':
        if (msg.e.id !== this.myId) this.addEntity(msg.e, false);
        break;
      case 'despawn':
        this.entities.delete(msg.id);
        this.facing.delete(msg.id);
        this.view?.removeActor(msg.id);
        break;
      case 'move': {
        const e = this.entities.get(msg.id);
        if (!e || msg.id === this.myId) break;
        const angle = this.facingOf(msg.id, e.x, e.y, msg.x, msg.y, msg.dir);
        e.x = msg.x;
        e.y = msg.y;
        e.dir = msg.dir;
        const feet = feetAt(msg.x, msg.y);
        const duration = e.kind === 'monster' ? (e.stepMs ?? 320) : 120;
        this.view?.moveActor(msg.id, feet.x, feet.y, angle, { durationMs: msg.dash ? 140 : duration, dash: msg.dash === true });
        break;
      }
      case 'ack':
        this.onAck(msg.seq, { x: msg.x, y: msg.y, dir: msg.dir });
        break;
      case 'teleport':
      case 'pull':
        this.placeMe(msg.x, msg.y, msg.dir);
        break;
      case 'zone':
        void this.enter(msg, true).catch((error: Error) => this.toast.show(error.message, 6000));
        break;
      case 'say':
        this.view?.say(msg.id, msg.text);
        break;
      case 'chat':
        this.chat.addChat(msg.name, msg.text, msg.id === this.myId);
        this.view?.say(msg.id, msg.text);
        break;
      case 'sys':
        this.chat.addSystem(msg.text);
        break;
      case 'notice':
        this.toast.show(msg.text, 7000);
        this.chat.addSystem(`Aviso do administrador: ${msg.text}`);
        break;
      case 'hp':
        if (msg.id === this.myId) this.hud.setHp(msg.hp, msg.maxHp);
        break;
      case 'stats':
        this.applyStats(msg.stats);
        break;
      case 'inv':
        this.hud.setGold(msg.inv.gold ?? 0);
        break;
      case 'npcs':
        for (const npc of msg.npcs) this.npcs.set(npc.e.id, npc);
        break;
      case 'online':
        this.hud.setOnline(msg.n);
        break;
      case 'pong': {
        const sentAt = this.pings.get(msg.id);
        this.pings.delete(msg.id);
        if (sentAt !== undefined) this.hud.setPing(performance.now() - sentAt);
        break;
      }
      default:
        // combate, loja, missões...: chegam nas próximas etapas do mundo novo
        break;
    }
  }
}
