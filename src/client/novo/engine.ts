// O motor do jogo 2.5D (o mundo novo): conversa com o servidor, lê teclado/joystick/toque, prevê o próprio andar
// (com as mesmas regras do servidor, em src/shared/movement.ts) e manda o desenho (view.ts) mostrar tudo.
// O desenho de verdade é da [arte] (PD.View); sem ele, a ProvisionalView mostra o básico. O combate (aviso no
// chão, pedras, dano, barras de vida) é desenhado por cima, em combat.ts.
// É o que abre em http://localhost:3000 (o jogo antigo, visto de cima, fica em ?antigo).

import { DASH_COOLDOWN_MS, DASH_TILES, MAX_PENDING_WALKS, SHOT_COOLDOWN_MS, SHOT_RANGE, SHOT_SPEED, TRADE_RANGE, WALK_SLICE_MS } from '../../shared/constants';
import { DX, DY, type Dir } from '../../shared/dir';
import { GameMap, type Tile, type TiledMap } from '../../shared/map';
import { degreesOfDir, degreesToward, cornerAtFeet, feetAt, footCenter, sweepBody, sliceDistance, walkSlice, type Pose } from '../../shared/movement';
import { findRoute, followRoute } from '../../shared/route';
import { DASH_SLOT, type EntityState, type NpcInfo, type PlayerStats, type ServerMsg, type WelcomeMsg, type ZoneMsg } from '../../shared/protocol';
import { SKILLS } from '../../shared/skills';
import { KeyboardDirections } from '../game/input';
import type { Connection } from '../net';
import type { Sfx } from '../sfx';
import { ActionBar, Feedback, Toast, ZoneBanner, type ActionSlot, type ChatBox, type Hud } from '../ui';
import './arte'; // o desenho de verdade (PD.View), da [arte], quando estiver pronto
import { aimAngle, BODY_HEIGHT, CombatLayer, distanceToSegment, shotOriginOfFeet } from './combat';
import { Joystick } from './joystick';
import { ProvisionalView, type WorldView } from './view';

export interface NewWorldDeps {
  conn: Connection;
  welcome: WelcomeMsg;
  chat: ChatBox;
  hud: Hud;
  sfx: Sfx;
}

type Point = { x: number; y: number };

/** Ângulo com 3 casas (o servidor recebe assim). */
const round3 = (value: number) => Math.round(value * 1000) / 1000;
/** Radianos → graus inteiros de 0 a 359 (o `walk` e o desenho usam graus). */
const toDegrees = (radians: number) => ((Math.round((radians * 180) / Math.PI) % 360) + 360) % 360;
/** Alcance do "atirar no mais perto" dos botões (o estilingue vai até SHOT_RANGE). */
const AUTO_AIM_RANGE = SHOT_RANGE + 0.5;
/** Alcance da mira automática da Bordunada (golpe de perto). */
const MELEE_AIM_RANGE = 2.5;
/** Monstro que caiu: tempo para a view mostrar a queda ('die') antes de o desenho sair. */
const DIE_MS = 700;

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
  private readonly sfx: Sfx;
  private readonly feedback = new Feedback();
  private readonly combat: CombatLayer;
  private readonly actionBar: ActionBar;
  private readonly soundButton = document.getElementById('hud-sound') as HTMLButtonElement | null;
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

  // combate
  /** Desmaiado: não anda nem ataca até acordar (o servidor manda o teleporte de volta). */
  private dead = false;
  private myHp = 1;
  private myMaxHp = 1;
  private shotCid = 0;
  private nextShotAt = 0;
  private dashReadyAt = 0;
  private readonly skillReadyAt = SKILLS.map(() => 0);
  /** Atirando sem parar: no monstro clicado, para onde o mouse aponta (botão direito) ou pelo botão da tela. */
  private firing: { by: 'target'; id: number } | { by: 'mouse' } | { by: 'button' } | null = null;
  /** Onde está o mouse (tela), para mirar. */
  private mouse: Point | null = null;
  /** O último toque foi com o dedo (a Bordunada mira sozinha). */
  private usingTouch = false;
  /** Outros jogadores desmaiados (acordam quando a vida volta). */
  private readonly fainted = new Set<number>();
  private safeToastAt = 0;
  private raf = 0;
  private pingTimer = 0;
  private pingId = 0;
  private readonly pings = new Map<number, number>();
  private destroyed = false;

  constructor(deps: NewWorldDeps) {
    this.conn = deps.conn;
    this.chat = deps.chat;
    this.hud = deps.hud;
    this.sfx = deps.sfx;
    this.keyboard = new KeyboardDirections(() => this.chat.isTyping());
    this.joystick = new Joystick(this.container, (x, y) => {
      this.usingTouch = true;
      this.tapAt(x, y);
    });
    this.combat = new CombatLayer(this.container);
    this.actionBar = new ActionBar(
      [
        { slot: 'shot', label: 'Estilingue', key: 'clique' },
        ...SKILLS.map((skill, i) => ({ slot: `skill${i}` as ActionSlot, label: skill.name, key: skill.key })),
        { slot: 'dash', label: 'Esquiva', key: 'Espaço' },
      ],
      (slot, down) => this.onAction(slot, down),
    );
    this.soundButton?.addEventListener('click', this.toggleSound);
    this.updateSoundButton();
    this.container.addEventListener('pointerdown', this.onPointerDown);
    this.container.addEventListener('pointermove', this.onPointerMove);
    this.container.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('pointerup', this.onPointerUp);
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
      // x, y: posição "de canto" (a do servidor); feetX, feetY: o pé, em metros (é o que o screenOf espera)
      entities: () =>
        [...game.entities.values()].map((e) => {
          const feet = feetAt(e.x, e.y);
          return { id: e.id, kind: e.kind, type: e.type, name: e.name, x: e.x, y: e.y, feetX: feet.x, feetY: feet.y, hp: e.hp, maxHp: e.maxHp };
        }),
      hp: () => ({ hp: game.myHp, maxHp: game.myMaxHp }),
      dead: () => game.dead,
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
    this.combat.clear();
    this.combat.raise(); // por cima do desenho novo
    this.entities.clear();
    this.facing.clear();
    this.npcs.clear();
    this.fainted.clear();
    this.pending = [];
    this.route = [];
    this.goingToNpc = null;
    this.wasSafe = null;
    this.firing = null;
    this.setDead(false);
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
    this.myHp = you.hp;
    this.myMaxHp = you.maxHp;
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
    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    this.soundButton?.removeEventListener('click', this.toggleSound);
    this.keyboard.destroy();
    this.joystick.destroy();
    this.toast.destroy();
    this.zoneBanner.destroy();
    this.actionBar.destroy();
    this.feedback.destroy();
    this.combat.destroy();
    this.view?.destroy();
    this.view = null;
  }

  // ======================= laço =======================

  private readonly loop = (now: number) => {
    if (this.destroyed || !this.view) return;
    this.handleMovement(now);
    this.handleFiring(now);
    this.checkNpcArrival();
    this.checkSafeArea();
    this.view.frame(now);
    this.combat.frame(now, this.view, (id) => this.drawnFeet(id), this.hurtBars());
    this.actionBar.update(now);
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
    if (event.type !== 'keydown' || this.chat.isTyping()) return;
    const now = performance.now();
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        if (!event.repeat) this.tryDash(now);
        break;
      case 'KeyQ':
      case 'Digit1':
        if (!event.repeat) this.trySkill(0, this.usingTouch ? this.autoAim(MELEE_AIM_RANGE) : (this.mouseAim() ?? this.autoAim(MELEE_AIM_RANGE)), now);
        break;
      case 'KeyE':
      case 'Digit2':
        if (!event.repeat) this.trySkill(1, 0, now);
        break;
      case 'KeyM':
        if (!event.repeat) this.toggleSound();
        break;
    }
  };
  private readonly onBlur = () => {
    this.shiftDown = false;
  };

  private handleMovement(now: number): void {
    const delta = this.walkAt > 0 ? Math.min(250, now - this.walkAt) : 0;
    this.walkAt = now;
    if (this.dead) {
      this.walkCredit = WALK_SLICE_MS;
      return;
    }
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

  /**
   * Mouse: clique esquerdo num monstro atira nele (segurando, continua); no NPC, vai conversar; no chão, anda até
   * lá. Botão direito: atira para onde o mouse aponta (segurando, continua). Toque: veja tapAt.
   */
  private readonly onPointerDown = (event: PointerEvent) => {
    if (!this.view || this.joystick.owns(event)) return;
    if (this.chat.isTyping()) this.chat.blur();
    this.usingTouch = event.pointerType !== 'mouse';
    if (event.pointerType === 'mouse') {
      this.mouse = { x: event.clientX, y: event.clientY };
      const now = performance.now();
      if (event.button === 2) {
        this.firing = { by: 'mouse' };
        const angle = this.mouseAim();
        if (angle !== null) this.tryShoot(angle, now);
        return;
      }
      if (event.button !== 0) return;
      const monster = this.actorAtScreen(event.clientX, event.clientY, 'monster');
      if (monster !== null) {
        this.firing = { by: 'target', id: monster };
        this.shootAt(monster, now);
        return;
      }
      this.tapAt(event.clientX, event.clientY);
      return;
    }
    // na área do joystick, o toque rápido chega pelo próprio joystick (tapAt), quando o dedo sai
    if (event.clientX <= window.innerWidth * 0.45) return;
    this.tapAt(event.clientX, event.clientY);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') this.mouse = { x: event.clientX, y: event.clientY };
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && this.firing && this.firing.by !== 'button') this.firing = null;
  };

  /** O botão direito é do jogo (atirar), não do menu do navegador. */
  private readonly onContextMenu = (event: Event) => event.preventDefault();

  /** Tocou/clicou na tela neste ponto: atira no monstro que está ali, vai conversar com o NPC ou anda até lá. */
  private tapAt(clientX: number, clientY: number): void {
    if (!this.view || this.dead) return;
    // (o clique do mouse já olhou o monstro antes de chegar aqui; o toque olha agora)
    const monster = this.actorAtScreen(clientX, clientY, 'monster');
    if (monster !== null) {
      this.shootAt(monster, performance.now());
      return;
    }
    const npcId = this.actorAtScreen(clientX, clientY, 'npc');
    const npc = npcId !== null ? this.npcs.get(npcId) : undefined;
    if (npc) {
      const feet = feetAt(npc.e.x, npc.e.y);
      this.goingToNpc = npc.e.id;
      this.walkToPoint(feet.x, feet.y + 1);
      return;
    }
    const point = this.view.toWorld(clientX, clientY);
    this.goingToNpc = null;
    this.walkToPoint(point.x, point.y);
  }

  /**
   * Quem está neste ponto da tela (o corpo, do pé até a cabeça), deste tipo, ou null. Vale tanto onde ele está
   * desenhado quanto onde o servidor diz que ele está (o desenho anda um pouco atrás de quem corre). No dedo, a folga
   * é maior. Funciona com qualquer câmera: usa só o toScreen da view.
   */
  private actorAtScreen(clientX: number, clientY: number, kind: 'monster' | 'npc'): number | null {
    if (!this.view) return null;
    const point = { x: clientX, y: clientY };
    let best: number | null = null;
    let bestScore = Infinity;
    for (const e of this.entities.values()) {
      if (e.kind !== kind) continue;
      for (const feet of [this.drawnFeet(e.id), feetAt(e.x, e.y)]) {
        if (!feet) continue;
        const foot = this.view.toScreen(feet.x, feet.y, 0);
        const head = this.view.toScreen(feet.x, feet.y, BODY_HEIGHT);
        const height = Math.hypot(head.x - foot.x, head.y - foot.y);
        const reach = this.usingTouch ? Math.max(32, height * 0.6) : Math.max(18, height * 0.4);
        const score = distanceToSegment(point, foot, head) / reach;
        if (score <= 1 && score < bestScore) {
          best = e.id;
          bestScore = score;
        }
      }
    }
    return best;
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

  // ======================= combate =======================

  /** Onde o pé de alguém está desenhado agora (a view sabe; se não souber, a última posição do servidor). */
  private drawnFeet(id: number): Point | null {
    const drawn = this.view?.actorPosition?.(id);
    if (drawn) return drawn;
    if (id === this.myId) return this.predicted ? feetAt(this.predicted.x, this.predicted.y) : null;
    const e = this.entities.get(id);
    return e ? feetAt(e.x, e.y) : null;
  }

  /** Barras de vida: monstros e outros jogadores machucados (a sua vida fica no painel). */
  private *hurtBars(): Iterable<{ id: number; hp: number; maxHp: number }> {
    for (const e of this.entities.values()) {
      if (e.id === this.myId || e.kind === 'npc' || e.hp >= e.maxHp || this.fainted.has(e.id)) continue;
      yield { id: e.id, hp: e.hp, maxHp: e.maxHp };
    }
  }

  private myFeet(): Point {
    return feetAt(this.predicted.x, this.predicted.y);
  }

  /** Mira do mouse: do seu pé até o ponto do chão apontado (radianos), ou null sem mouse. */
  private mouseAim(): number | null {
    if (!this.mouse || !this.view) return null;
    return aimAngle(this.myFeet(), this.view.toWorld(this.mouse.x, this.mouse.y));
  }

  /** O monstro mais perto (pé a pé) até `maxDistance` metros. */
  private nearestMonster(maxDistance: number): EntityState | null {
    const me = this.myFeet();
    let best: EntityState | null = null;
    let bestDistance = maxDistance;
    for (const e of this.entities.values()) {
      if (e.kind !== 'monster') continue;
      const feet = feetAt(e.x, e.y);
      const distance = Math.hypot(feet.x - me.x, feet.y - me.y);
      if (distance <= bestDistance) {
        best = e;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Mira automática (botões e celular): o monstro mais perto; sem monstro, para onde você olha. */
  private autoAim(maxDistance: number): number {
    const target = this.nearestMonster(maxDistance);
    if (!target) return (this.myAngle * Math.PI) / 180;
    return aimAngle(this.myFeet(), feetAt(target.x, target.y));
  }

  /** Atira no monstro `id` (na posição do servidor, que é onde ele está de verdade). */
  private shootAt(id: number, now: number): void {
    const target = this.entities.get(id);
    if (!target) return;
    this.tryShoot(aimAngle(this.myFeet(), feetAt(target.x, target.y)), now);
  }

  /** O seu tile está entre estes ([x1, y1, x2, y2, ...])? */
  private onMyTile(tiles: number[]): boolean {
    const at = footCenter(this.predicted.x, this.predicted.y);
    const tx = Math.floor(at.x);
    const ty = Math.floor(at.y);
    for (let i = 0; i + 1 < tiles.length; i += 2) if (tiles[i] === tx && tiles[i + 1] === ty) return true;
    return false;
  }

  /** Zona segura: aqui ninguém briga (o servidor também recusa). */
  private inSafeArea(): boolean {
    if (this.map.safeAreas.length === 0) return false;
    const at = footCenter(this.predicted.x, this.predicted.y);
    return this.map.isSafeAt(at.x, at.y);
  }

  private refuseInSafeArea(now: number): boolean {
    if (!this.inSafeArea()) return false;
    if (now >= this.safeToastAt) {
      this.toast.show('Zona segura: aqui não tem briga');
      this.safeToastAt = now + 1500;
    }
    return true;
  }

  /** Estilingue: uma pedra na direção `angle` (radianos). Aparece na hora; o servidor decide se acerta. */
  private tryShoot(angle: number, now: number): void {
    if (this.dead || now < this.nextShotAt) return;
    if (this.refuseInSafeArea(now)) {
      this.firing = null;
      return;
    }
    // um pouco mais que a recarga do servidor, para a variação da rede não fazer um tiro ser recusado
    this.nextShotAt = now + SHOT_COOLDOWN_MS + 40;
    const cid = ++this.shotCid;
    this.conn.send({ t: 'shoot', cid, a: round3(angle) });
    const feet = this.myFeet();
    const origin = shotOriginOfFeet(feet.x, feet.y);
    this.combat.myShot(cid, origin.x, origin.y, angle, SHOT_SPEED, SHOT_RANGE, now);
    this.sfx.play('shot');
    this.faceAngle(toDegrees(angle));
    this.view?.action?.(this.myId, 'shoot', toDegrees(angle));
    this.actionBar.setCooldown('shot', this.nextShotAt, SHOT_COOLDOWN_MS);
  }

  /** Atirando sem parar (botão segurado): um tiro por recarga. */
  private handleFiring(now: number): void {
    if (!this.firing || this.dead) return;
    if (this.firing.by === 'target') {
      if (!this.entities.has(this.firing.id)) {
        this.firing = null; // o monstro caiu ou sumiu
        return;
      }
      this.shootAt(this.firing.id, now);
    } else if (this.firing.by === 'mouse') {
      const angle = this.mouseAim();
      if (angle !== null) this.tryShoot(angle, now);
    } else {
      this.tryShoot(this.autoAim(AUTO_AIM_RANGE), now);
    }
  }

  /** Botões da tela (celular e PC). */
  private onAction(slot: ActionSlot, down: boolean): void {
    const now = performance.now();
    if (slot === 'shot') {
      if (down) {
        this.firing = { by: 'button' };
        this.tryShoot(this.autoAim(AUTO_AIM_RANGE), now);
      } else if (this.firing?.by === 'button') {
        this.firing = null;
      }
      return;
    }
    if (!down) return;
    if (slot === 'dash') this.tryDash(now);
    else if (slot === 'skill0') this.trySkill(0, this.autoAim(MELEE_AIM_RANGE), now);
    else if (slot === 'skill1') this.trySkill(1, 0, now);
  }

  /** O seu personagem vira para `degrees` (atirando, golpeando). */
  private faceAngle(degrees: number): void {
    this.myAngle = degrees;
    const feet = this.myFeet();
    this.view?.moveActor(this.myId, feet.x, feet.y, degrees, { durationMs: 0 });
  }

  /**
   * Para onde rolar: a direção que você segura (teclado ou joystick); senão, para onde está andando; senão, para
   * longe do monstro mais perto (é o que se quer quando um golpe vem vindo); senão, para onde olha.
   */
  private dashDegrees(): number {
    const held = this.keyboard.current();
    if (held !== null) return this.screenDegrees(DX[held.dir], DY[held.dir]);
    const stick = this.joystick.direction();
    if (stick) return this.screenDegrees(stick.dx, stick.dy);
    const next = this.route[0];
    if (next) return degreesToward(this.predicted.x, this.predicted.y, next.x, next.y);
    const facing = ((Math.round(this.myAngle) % 360) + 360) % 360;
    const threat = this.nearestMonster(4.5);
    if (!threat) return facing;
    const danger = feetAt(threat.x, threat.y);
    let best = facing;
    let bestDistance = -Infinity;
    for (let degrees = 0; degrees < 360; degrees += 45) {
      const landing = sweepBody(this.map, this.predicted, degrees, DASH_TILES);
      if (!landing.moved) continue;
      const feet = feetAt(landing.x, landing.y);
      const distance = Math.hypot(feet.x - danger.x, feet.y - danger.y);
      if (distance > bestDistance) {
        best = degrees;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Esquiva: rola DASH_TILES metros (desliza no que tiver no caminho); some do golpe por um instante. */
  private tryDash(now: number): void {
    if (this.dead || now < this.dashReadyAt || this.pending.length >= MAX_PENDING_WALKS) return;
    const degrees = this.dashDegrees();
    const result = sweepBody(this.map, this.predicted, degrees, DASH_TILES);
    if (!result.moved) {
      this.toast.show('Sem espaço para rolar aí');
      return;
    }
    this.seq += 1;
    this.pending.push({ seq: this.seq, a: degrees, dash: true, slow: false });
    this.conn.send({ t: 'walk', seq: this.seq, a: degrees, dash: true });
    this.sfx.play('dash');
    this.predicted = { x: result.x, y: result.y, dir: result.dir };
    this.myAngle = degrees;
    const feet = this.myFeet();
    this.view?.moveActor(this.myId, feet.x, feet.y, degrees, { durationMs: 140, dash: true });
    this.view?.action?.(this.myId, 'dash', degrees);
    this.dashReadyAt = now + DASH_COOLDOWN_MS + 120;
    this.actionBar.setCooldown('dash', this.dashReadyAt, DASH_COOLDOWN_MS);
    this.clearRoute();
  }

  /** Habilidade `n` (Bordunada: golpe na frente, mirando em `angle`; Fôlego: cura). */
  private trySkill(n: number, angle: number, now: number): void {
    const skill = SKILLS[n];
    if (!skill || this.dead) return;
    if (now < this.skillReadyAt[n]!) {
      this.toast.show('Ainda recarregando...');
      return;
    }
    if (skill.kind === 'heal' && this.myHp >= this.myMaxHp) {
      this.toast.show('Sua vida já está cheia');
      return;
    }
    if (skill.kind === 'arc' && this.refuseInSafeArea(now)) return;
    this.skillReadyAt[n] = now + skill.cooldownMs;
    this.actionBar.setCooldown(`skill${n}` as ActionSlot, this.skillReadyAt[n]!, skill.cooldownMs);
    this.conn.send({ t: 'skill', n, a: round3(angle) });
    if (skill.kind === 'arc') {
      // o servidor não manda o efeito da Bordunada de volta para quem golpeou: mostra aqui mesmo
      this.sfx.play('arc');
      this.faceAngle(toDegrees(angle));
      this.view?.action?.(this.myId, 'arc', toDegrees(angle));
      const feet = this.myFeet();
      this.combat.flash(feet.x, feet.y, angle, 1.6, false, now);
    }
  }

  private onShot(msg: Extract<ServerMsg, { t: 'shot' }>): void {
    if (msg.by === this.myId && msg.cid !== undefined) {
      this.combat.linkMyShot(msg.cid, msg.id); // o seu tiro já está voando desde o clique
      return;
    }
    const fromMonster = this.entities.get(msg.by)?.kind === 'monster';
    this.combat.shot(msg.id, msg.x, msg.y, msg.a, msg.speed, msg.range, msg.kind, fromMonster, performance.now());
    this.view?.action?.(msg.by, 'shoot', toDegrees(msg.a));
  }

  private onHit(id: number, dmg: number, hp: number): void {
    const now = performance.now();
    const e = this.entities.get(id);
    if (e) e.hp = hp;
    this.view?.action?.(id, 'hurt');
    if (id === this.myId) {
      this.myHp = hp;
      this.hud.setHp(hp, this.myMaxHp);
      this.feedback.hurtFlash();
      this.sfx.play('hurt');
      this.combat.floater(id, `-${dmg}`, '#ff6b6b', now);
      return;
    }
    this.combat.floater(id, `-${dmg}`, e?.kind === 'monster' ? '#ffe08a' : '#ffffff', now);
    if (e?.kind === 'monster') this.sfx.play('hit');
  }

  private onDeath(id: number): void {
    const now = performance.now();
    if (id === this.myId) {
      this.myHp = 0;
      this.hud.setHp(0, this.myMaxHp);
      this.sfx.play('death');
      this.setDead(true);
      return;
    }
    const e = this.entities.get(id);
    if (e?.kind === 'monster') {
      // o monstro caiu: some com uma nuvenzinha (o servidor já tirou ele da sua área de visão). A view que anima
      // ('die') ganha um instante para mostrar a queda antes de o desenho sair.
      const feet = this.drawnFeet(id);
      if (feet) this.combat.poof(feet.x, feet.y, now);
      this.entities.delete(id);
      this.facing.delete(id);
      const view = this.view;
      if (view?.action) {
        view.action(id, 'die');
        window.setTimeout(() => {
          if (this.view === view) view.removeActor(id);
        }, DIE_MS);
      } else {
        view?.removeActor(id);
      }
      if (this.firing?.by === 'target' && this.firing.id === id) this.firing = null;
      this.sfx.play('kill');
      return;
    }
    if (e) {
      this.fainted.add(id); // outro jogador desmaiou (acorda quando a vida voltar)
      this.view?.action?.(id, 'faint');
    }
  }

  /** Desmaiou (ou acordou): sem andar nem atacar, com o aviso na tela. */
  private setDead(dead: boolean): void {
    if (this.dead === dead) return;
    this.dead = dead;
    if (dead) {
      this.firing = null;
      this.clearRoute();
      this.goingToNpc = null;
      this.feedback.showDeath();
      this.view?.action?.(this.myId, 'faint');
    } else {
      this.feedback.hideDeath();
      this.view?.action?.(this.myId, 'revive');
    }
  }

  private readonly toggleSound = () => {
    this.sfx.toggleMute();
    this.updateSoundButton();
    this.toast.show(this.sfx.muted ? 'Som desligado (M para ligar)' : 'Som ligado');
  };

  private updateSoundButton(): void {
    if (this.soundButton) this.soundButton.textContent = this.sfx.muted ? '🔇' : '🔊';
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
        if (msg.dash) this.view?.action?.(msg.id, 'dash', angle);
        break;
      }
      case 'ack':
        this.onAck(msg.seq, { x: msg.x, y: msg.y, dir: msg.dir });
        break;
      case 'teleport':
      case 'pull':
        this.placeMe(msg.x, msg.y, msg.dir);
        if (msg.t === 'teleport' && this.dead) this.setDead(false); // acordou
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
      case 'hp': {
        const e = this.entities.get(msg.id);
        if (e) {
          e.hp = msg.hp;
          e.maxHp = msg.maxHp;
        }
        if (msg.id === this.myId) {
          this.myHp = msg.hp;
          this.myMaxHp = msg.maxHp;
          this.hud.setHp(msg.hp, msg.maxHp);
        } else if (this.fainted.delete(msg.id)) {
          this.view?.action?.(msg.id, 'revive');
        }
        break;
      }
      case 'stats':
        this.applyStats(msg.stats);
        break;
      case 'warn': {
        // golpe vindo: quadrados vermelhos onde ele pega (golpe de perto) e o anel laranja em quem prepara
        const now = performance.now();
        if (msg.tiles.length > 0) this.combat.warn(msg.tiles, msg.ms, now);
        this.combat.windup(msg.id, msg.ms, now);
        this.view?.action?.(msg.id, 'windup');
        if (this.onMyTile(msg.tiles)) this.sfx.play('warn');
        break;
      }
      case 'fire':
        this.combat.warn(msg.tiles, msg.ms, performance.now(), true);
        this.sfx.play('fire');
        break;
      case 'shot':
        this.onShot(msg);
        break;
      case 'shot_end':
        this.combat.endShot(msg.id);
        break;
      case 'fx': {
        const feet = this.drawnFeet(msg.id);
        const wide = msg.a === undefined || msg.kind === 'spin' || msg.kind === 'whirlwind';
        if (feet && msg.kind !== 'song') this.combat.flash(feet.x, feet.y, msg.a ?? 0, msg.r ?? 1.4, wide, performance.now());
        this.view?.action?.(msg.id, msg.kind, msg.a !== undefined ? toDegrees(msg.a) : undefined);
        if (msg.kind === 'charge') this.sfx.play('charge');
        break;
      }
      case 'hit':
        this.onHit(msg.id, msg.dmg, msg.hp);
        break;
      case 'heal': {
        const e = this.entities.get(msg.id);
        if (e) e.hp = msg.hp;
        this.combat.floater(msg.id, `+${msg.amount}`, '#7bd389', performance.now());
        if (msg.id === this.myId) {
          this.myHp = msg.hp;
          this.hud.setHp(msg.hp, this.myMaxHp);
          this.sfx.play('heal');
        }
        break;
      }
      case 'death':
        this.onDeath(msg.id);
        break;
      case 'levelup':
        if (msg.id === this.myId) {
          this.myMaxHp = msg.maxHp;
          this.toast.show(`Você subiu para o nível ${msg.level}!`, 2500);
          this.combat.floater(msg.id, `Nível ${msg.level}!`, '#f2c14e', performance.now());
          this.sfx.play('levelup');
        } else {
          this.view?.say(msg.id, `Nível ${msg.level}!`);
        }
        break;
      case 'cd': {
        const now = performance.now();
        if (msg.n === DASH_SLOT) {
          this.dashReadyAt = now + msg.ms;
          this.actionBar.setCooldown('dash', this.dashReadyAt, msg.ms);
        } else if (msg.n >= 0 && msg.n < SKILLS.length) {
          this.skillReadyAt[msg.n] = now + msg.ms;
          this.actionBar.setCooldown(`skill${msg.n}` as ActionSlot, this.skillReadyAt[msg.n]!, msg.ms);
        }
        break;
      }
      case 'fail':
        if (msg.item) break; // mochila e loja ainda não chegaram no jogo novo
        if (msg.reason === 'cooldown') this.toast.show('Ainda recarregando...');
        else if (msg.reason === 'dead') this.toast.show('Você está desmaiado');
        else if (msg.reason === 'full_hp') {
          this.toast.show('Sua vida já está cheia');
          SKILLS.forEach((skill, i) => {
            if (skill.kind !== 'heal') return;
            this.skillReadyAt[i] = 0;
            this.actionBar.setCooldown(`skill${i}` as ActionSlot, 0, 0);
          });
        }
        break;
      case 'drop':
        this.combat.addDrop(msg.id, msg.x, msg.y, msg.gold !== undefined, performance.now() + msg.ms);
        break;
      case 'pickup':
        this.combat.removeDrop(msg.id);
        this.sfx.play('coin');
        if (msg.gold) this.combat.floater(this.myId, `+${msg.gold} de ouro`, '#f2c14e', performance.now());
        break;
      case 'drop_gone':
        this.combat.removeDrop(msg.id);
        break;
      case 'loot':
        this.sfx.play('coins'); // o servidor também manda o texto ("Você pegou: ...") no chat
        break;
      case 'charm':
        if (msg.ms > 0) this.toast.show('Você foi encantado pelo canto! A esquiva solta.', 2500);
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
