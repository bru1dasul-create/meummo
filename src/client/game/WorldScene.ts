// A cena principal: desenha o mapa e os jogadores, lê o teclado/toque e conversa com o servidor.

import Phaser from 'phaser';
import { MAX_PENDING_STEPS, STEP_TOLERANCE_MS, TICK_MS, TILE_SIZE } from '../../shared/constants';
import { DX, DY, type Dir } from '../../shared/dir';
import { GameMap, type Tile, type TiledMap } from '../../shared/map';
import { applyStep, nextStepTime, type Pose } from '../../shared/movement';
import { findPath } from '../../shared/pathfind';
import type { EntityState, ServerMsg, WelcomeMsg } from '../../shared/protocol';
import type { Connection } from '../net';
import type { ChatBox, Hud } from '../ui';
import { EntityView } from './EntityView';
import { KeyboardDirections } from './input';

export interface WorldSceneData {
  conn: Connection;
  welcome: WelcomeMsg;
  chat: ChatBox;
  hud: Hud;
}

/** Quantos tiles queremos ver no lado menor da tela (isso define o zoom). */
const TILES_ON_SHORT_SIDE = 14;
const PING_EVERY_MS = 2000;

type StepResult = 'moved' | 'turned' | 'blocked' | 'wait';

export class WorldScene extends Phaser.Scene {
  private conn!: Connection;
  private welcome!: WelcomeMsg;
  private chat!: ChatBox;
  private hud!: Hud;
  private stepMs = 200;

  private map!: GameMap;
  private labels!: HTMLElement;
  private keyboard: KeyboardDirections | null = null;
  private readonly entities = new Map<number, EntityView>();
  private me!: EntityView;
  private marker!: Phaser.GameObjects.Rectangle;

  // Previsão do próprio movimento: o personagem anda na hora e o servidor confirma depois.
  // Se o servidor discordar, corrigimos a posição (veja onAck).
  private predicted!: Pose;
  private pending: { seq: number; dir: Dir }[] = [];
  private seq = 0;
  private nextStepAt = 0;
  /** Caminho do "clique para andar". */
  private path: Dir[] = [];

  private pingId = 0;
  private readonly pingsSent = new Map<number, number>();

  constructor() {
    super('world');
  }

  init(data: WorldSceneData): void {
    this.conn = data.conn;
    this.welcome = data.welcome;
    this.chat = data.chat;
    this.hud = data.hud;
    this.stepMs = data.welcome.stepMs;
  }

  preload(): void {
    this.load.image('tiles', 'assets/tiles.png');
    this.load.tilemapTiledJSON('world', 'assets/maps/world.tmj');
  }

  create(): void {
    const tilemap = this.make.tilemap({ key: 'world' });
    const tileset = tilemap.addTilesetImage('tiles', 'tiles');
    if (!tileset) throw new Error('O mapa precisa usar um tileset chamado "tiles".');
    tilemap.layers.forEach((layer, i) => tilemap.createLayer(layer.name, tileset)?.setDepth(-100 + i));
    // O mesmo arquivo que o servidor usa: cliente e servidor concordam sobre as paredes.
    this.map = GameMap.fromTiled((this.cache.tilemap.get('world') as { data: TiledMap }).data);

    this.labels = document.getElementById('labels')!;
    this.me = this.addEntity(this.welcome.you, true);
    this.predicted = { x: this.welcome.you.x, y: this.welcome.you.y, dir: this.welcome.you.dir };
    this.hud.setOnline(this.welcome.online);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);
    camera.startFollow(this.me.sprite);
    this.fitZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitZoom, this);

    this.marker = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setOrigin(0)
      .setStrokeStyle(1, 0xffffff, 0.85)
      .setDepth(-50)
      .setVisible(false);
    this.keyboard = new KeyboardDirections(() => this.chat.isTyping());
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);

    this.conn.listen((msg) => this.onMessage(msg));
    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.syncLabels, this);
    this.time.addEvent({ delay: PING_EVERY_MS, loop: true, callback: this.sendPing, callbackScope: this });
    this.sendPing();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  override update(): void {
    const now = performance.now();
    this.handleMovementInput(now);
    for (const entity of this.entities.values()) entity.update(now);
  }

  // ---------- movimento do próprio jogador ----------

  private handleMovementInput(now: number): void {
    const keyDir = this.keyboard?.current() ?? null;
    if (keyDir !== null) {
      this.clearPath();
      this.tryStep(keyDir, now);
      return;
    }
    if (this.path.length === 0) return;
    const result = this.tryStep(this.path[0]!, now);
    if (result === 'moved') {
      this.path.shift();
      if (this.path.length === 0) this.marker.setVisible(false);
    } else if (result !== 'wait') {
      this.clearPath();
    }
  }

  /** Tenta dar um passo: mostra na hora (previsão) e avisa o servidor. */
  private tryStep(dir: Dir, now: number): StepResult {
    if (now < this.nextStepAt - STEP_TOLERANCE_MS || this.pending.length >= MAX_PENDING_STEPS) return 'wait';
    const result = applyStep(this.map, this.predicted, dir);
    if (!result.moved && result.dir === this.predicted.dir) return 'blocked';

    this.seq += 1;
    this.pending.push({ seq: this.seq, dir });
    this.conn.send({ t: 'step', seq: this.seq, dir });
    this.predicted = { x: result.x, y: result.y, dir: result.dir };
    if (result.moved) this.nextStepAt = nextStepTime(now, this.nextStepAt, this.stepMs, TICK_MS);
    this.me.moveTo(result.x, result.y, result.dir, now, this.stepMs);
    return result.moved ? 'moved' : 'turned';
  }

  /** O servidor confirmou nossos passos até `seq`. Se a previsão errou, corrige. */
  private onAck(seq: number, server: Pose, now: number): void {
    this.pending = this.pending.filter((p) => p.seq > seq);
    let pose: Pose = server;
    for (const p of this.pending) pose = applyStep(this.map, pose, p.dir);
    if (pose.x !== this.predicted.x || pose.y !== this.predicted.y) {
      this.predicted = { x: pose.x, y: pose.y, dir: pose.dir };
      this.clearPath();
      this.me.moveTo(pose.x, pose.y, pose.dir, now, this.stepMs);
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.chat.isTyping()) this.chat.blur();
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const target = this.pathTo(Math.floor(point.x / TILE_SIZE), Math.floor(point.y / TILE_SIZE));
    if (!target || target.path.length === 0) {
      this.clearPath();
      return;
    }
    this.path = target.path;
    this.marker.setPosition(target.goal.x * TILE_SIZE, target.goal.y * TILE_SIZE).setVisible(true);
  }

  private pathTo(tx: number, ty: number): { path: Dir[]; goal: Tile } | null {
    const { x, y } = this.predicted;
    const direct = findPath(this.map, x, y, tx, ty);
    if (direct) return { path: direct, goal: { x: tx, y: ty } };
    // Clicou num obstáculo (árvore, casa...): vai até o vizinho livre mais perto.
    const neighbors = [0, 1, 2, 3]
      .map((d) => ({ x: tx + DX[d]!, y: ty + DY[d]! }))
      .filter((p) => this.map.isWalkable(p.x, p.y))
      .sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - (Math.abs(b.x - x) + Math.abs(b.y - y)));
    for (const goal of neighbors) {
      const path = findPath(this.map, x, y, goal.x, goal.y);
      if (path) return { path, goal };
    }
    return null;
  }

  private clearPath(): void {
    this.path = [];
    this.marker?.setVisible(false);
  }

  // ---------- mensagens do servidor ----------

  private onMessage(msg: ServerMsg): void {
    const now = performance.now();
    switch (msg.t) {
      case 'spawn':
        if (msg.e.id === this.welcome.id) break;
        this.entities.get(msg.e.id)?.destroy();
        this.addEntity(msg.e, false);
        break;
      case 'despawn':
        this.entities.get(msg.id)?.destroy();
        this.entities.delete(msg.id);
        break;
      case 'move':
        this.entities.get(msg.id)?.moveTo(msg.x, msg.y, msg.dir, now, this.stepMs);
        break;
      case 'ack':
        this.onAck(msg.seq, { x: msg.x, y: msg.y, dir: msg.dir }, now);
        break;
      case 'chat':
        this.chat.addChat(msg.name, msg.text, msg.id === this.welcome.id);
        this.entities.get(msg.id)?.say(msg.text);
        break;
      case 'sys':
        this.chat.addSystem(msg.text);
        break;
      case 'online':
        this.hud.setOnline(msg.n);
        break;
      case 'pong': {
        const sentAt = this.pingsSent.get(msg.id);
        if (sentAt !== undefined) {
          this.pingsSent.delete(msg.id);
          this.hud.setPing(now - sentAt);
        }
        break;
      }
      case 'welcome':
      case 'reject':
        break;
    }
  }

  private addEntity(state: EntityState, isSelf: boolean): EntityView {
    const view = new EntityView(this, this.labels, state, isSelf);
    this.entities.set(state.id, view);
    return view;
  }

  // ---------- tela ----------

  /** Zoom em números inteiros (pixel art fica nítida) mostrando ~14 tiles no lado menor. */
  private fitZoom(): void {
    const { width, height } = this.scale.gameSize;
    const zoom = Math.max(1, Math.round(Math.min(width, height) / (TILES_ON_SHORT_SIDE * TILE_SIZE)));
    this.cameras.main.setZoom(zoom);
  }

  /** Depois de desenhar o quadro, posiciona os nomes (HTML) em cima dos personagens. */
  private syncLabels(): void {
    const camera = this.cameras.main;
    // Quem divide o mesmo tile ganha o nome um pouco mais acima, para os nomes não se embaralharem.
    const perTile = new Map<number, number>();
    for (const entity of this.entities.values()) {
      const key = entity.tileY * this.map.width + entity.tileX;
      const stackIndex = perTile.get(key) ?? 0;
      perTile.set(key, stackIndex + 1);
      entity.syncLabel(camera, stackIndex);
    }
  }

  private sendPing(): void {
    const id = ++this.pingId;
    this.pingsSent.set(id, performance.now());
    if (this.pingsSent.size > 10) this.pingsSent.delete(this.pingsSent.keys().next().value!);
    this.conn.send({ t: 'ping', id });
  }

  private cleanup(): void {
    this.keyboard?.destroy();
    this.keyboard = null;
    this.game.events.off(Phaser.Core.Events.POST_RENDER, this.syncLabels, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.fitZoom, this);
    for (const entity of this.entities.values()) entity.destroy();
    this.entities.clear();
  }
}
