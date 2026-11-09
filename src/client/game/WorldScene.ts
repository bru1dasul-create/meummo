// A cena principal: desenha o mapa, os jogadores e os monstros, lê teclado/mouse/toque
// e conversa com o servidor. O combate é de ação: você mira, atira e desvia.

import Phaser from 'phaser';
import {
  DASH_COOLDOWN_MS,
  DASH_INVULNERABLE_MS,
  DASH_TILES,
  MAX_PENDING_STEPS,
  SHOT_COOLDOWN_MS,
  SHOT_RANGE,
  SHOT_SPEED,
  STEP_TOLERANCE_MS,
  TICK_MS,
  TILE_SIZE,
} from '../../shared/constants';
import { angleBetween, angleOfDir, arcTiles, dir8FromAngle, dirFromAngle, reachableLine } from '../../shared/combat';
import { ALL_DIRS, DX, DY, stepDuration, type Dir } from '../../shared/dir';
import { GameMap, type MapExit, type Tile, type TiledMap } from '../../shared/map';
import { applyDash, applyInput, applyStep, nextStepTime, type Pose } from '../../shared/movement';
import { findPath } from '../../shared/pathfind';
import { DASH_SLOT, type EntityState, type PlayerStats, type ServerMsg, type WelcomeMsg, type ZoneMsg } from '../../shared/protocol';
import type { InventoryState, ItemInfo, ItemStack } from '../../shared/items';
import { SKILLS } from '../../shared/skills';
import { Bag } from '../bag';
import { itemTexture } from '../itemArt';
import type { Connection } from '../net';
import type { Sfx } from '../sfx';
import { ActionBar, Feedback, Toast, ZoneBanner, type ActionSlot, type ChatBox, type Hud } from '../ui';
import { Effects } from './effects';
import { EntityView, feetOf } from './EntityView';
import { KeyboardDirections, type HeldMove } from './input';
import { CanopyFader, createMapLayers, MapLights } from './mapDepth';

export interface WorldSceneData {
  conn: Connection;
  welcome: WelcomeMsg;
  chat: ChatBox;
  hud: Hud;
  sfx: Sfx;
  /** Número do último passo enviado (continua contando quando troca de mapa). */
  seq?: number;
  /** Chegou de outro mapa (e não acabou de entrar no jogo). */
  arrived?: boolean;
  /** Trocar de mapa: quem cuida é o main.ts (cria uma cena nova para o mapa novo). */
  travel: (next: WelcomeMsg, seq: number) => void;
}

/** Quantos tiles queremos ver no lado menor da tela (isso define o zoom). */
const TILES_ON_SHORT_SIDE = 14;
const PING_EVERY_MS = 2000;
const DEFAULT_MONSTER_STEP_MS = 320;
/** Altura (em pixels da tela) de uma linha de nome + barra de vida. */
const LABEL_HEIGHT = 20;
const T = TILE_SIZE;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

type StepResult = 'moved' | 'turned' | 'blocked' | 'wait';

export class WorldScene extends Phaser.Scene {
  private conn!: Connection;
  private welcome!: WelcomeMsg;
  private chat!: ChatBox;
  private hud!: Hud;
  private sfx!: Sfx;
  private soundButton: HTMLButtonElement | null = null;
  /** Quando cada monstro levou a última pedrada sua (para tocar o som de vitória). */
  private readonly lastHitByMe = new Map<number, number>();
  private stepMs = 200;
  private myId = 0;

  private map!: GameMap;
  private labels!: HTMLElement;
  private keyboard: KeyboardDirections | null = null;
  private readonly entities = new Map<number, EntityView>();
  /** Monstros derrotados sumindo aos poucos. */
  private dying: EntityView[] = [];
  private me!: EntityView;
  private marker!: Phaser.GameObjects.Rectangle;
  private effects!: Effects;
  /** Copas que ficam transparentes em cima de quem passa embaixo (null: o mapa não tem camada "acima"). */
  private canopy: CanopyFader | null = null;
  private mapLights!: MapLights;
  private lastFrameAt = 0;
  private actionBar!: ActionBar;
  private toast!: Toast;
  private feedback!: Feedback;
  private zoneBanner!: ZoneBanner;
  private bag!: Bag;
  /** Tipos de item (chegam nas boas-vindas). */
  private readonly items = new Map<string, ItemInfo>();
  /** O que estava equipado (para tocar o som de "equipou" só quando muda). */
  private bagEquipped: InventoryState['equipped'] | null = null;

  // Previsão do próprio movimento: o personagem anda na hora e o servidor confirma depois.
  private predicted!: Pose;
  private pending: { seq: number; dir: Dir; dash: boolean }[] = [];
  private seq = 0;
  private nextStepAt = 0;
  /** Caminho do "clique para andar". */
  private path: Dir[] = [];

  // Combate
  private myLevel = 1;
  private myXp = 0;
  private myXpNext = 1;
  private myHp = 1;
  private myMaxHp = 1;
  private dead = false;
  private nextShotAt = 0;
  private shotCid = 0;
  private dashReadyAt = 0;
  private readonly skillReadyAt = SKILLS.map(() => 0);
  /** Atirando sem parar: segurando o botão do mouse ou o botão "Estilingue". */
  private firing: 'mouse' | 'button' | null = null;
  private usingTouch = false;

  private pingId = 0;
  private readonly pingsSent = new Map<number, number>();

  /** Chave do mapa no cache do Phaser (`map-<id>`). */
  private mapKey = '';
  /** Placas das saídas (nome do lugar para onde cada uma leva), posicionadas a cada quadro. */
  private exitSigns: { el: HTMLDivElement; x: number; y: number }[] = [];
  private arrived = false;
  private travel!: WorldSceneData['travel'];

  constructor() {
    super(); // a chave da cena vem de quem cria (main.ts): uma cena nova a cada mapa
  }

  init(data: WorldSceneData): void {
    this.conn = data.conn;
    this.welcome = data.welcome;
    this.chat = data.chat;
    this.hud = data.hud;
    this.sfx = data.sfx;
    this.stepMs = data.welcome.stepMs;
    this.myId = data.welcome.id;
    this.seq = data.seq ?? 0;
    this.arrived = data.arrived ?? false;
    this.travel = data.travel;
    this.mapKey = `map-${data.welcome.map}`;
  }

  preload(): void {
    if (!this.textures.exists('tiles')) this.load.image('tiles', 'assets/tiles.png');
    if (!this.cache.tilemap.exists(this.mapKey)) this.load.tilemapTiledJSON(this.mapKey, `assets/maps/${this.welcome.map}.tmj`);
  }

  create(): void {
    const tilemap = this.make.tilemap({ key: this.mapKey });
    const tileset = tilemap.addTilesetImage('tiles', 'tiles');
    if (!tileset) throw new Error('O mapa precisa usar um tileset chamado "tiles".');
    // chão, sombras e enfeites embaixo dos personagens; a camada "acima" (copas, alto dos postes) por cima
    const above = createMapLayers(tilemap, tileset);
    this.canopy = above ? new CanopyFader(above) : null;
    // O mesmo arquivo que o servidor usa: cliente e servidor concordam sobre as paredes.
    const mapJson = (this.cache.tilemap.get(this.mapKey) as { data: TiledMap }).data;
    this.map = GameMap.fromTiled(mapJson, this.welcome.map);
    this.mapLights = new MapLights(this, mapJson);

    this.labels = document.getElementById('labels')!;
    const you = this.welcome.you;
    this.me = this.addEntity(you, true);
    this.predicted = { x: you.x, y: you.y, dir: you.dir };
    this.myHp = you.hp;
    for (const item of this.welcome.items) this.items.set(item.id, item);
    this.bag = new Bag(
      this.items,
      this.welcome.inv,
      {
        item: (act, i) => this.conn.send({ t: 'item', act, i }),
        unequip: (part) => this.conn.send({ t: 'unequip', part }),
      },
      this.welcome.stats,
      you.look,
    );
    this.bagEquipped = this.welcome.inv.equipped;
    this.applyStats(this.welcome.stats, false);
    this.hud.setOnline(this.welcome.online);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);
    camera.startFollow(this.me.sprite);
    this.fitZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitZoom, this);

    this.marker = this.add.rectangle(0, 0, T, T).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.85).setDepth(-50).setVisible(false);
    for (const exit of this.map.exits) this.drawExit(exit);
    this.effects = new Effects(this, this.map, (fromMonster) => this.shotTargets(fromMonster));
    this.toast = new Toast();
    this.feedback = new Feedback();
    this.zoneBanner = new ZoneBanner();
    this.zoneBanner.show(this.map.name, this.map.safe ? 'Zona segura' : 'Cuidado: zona perigosa', !this.map.safe);
    this.actionBar = new ActionBar(
      [
        { slot: 'shot', label: 'Estilingue', key: 'clique' },
        ...SKILLS.map((skill, i) => ({ slot: `skill${i}` as ActionSlot, label: skill.name, key: skill.key })),
        { slot: 'dash', label: 'Esquiva', key: 'Espaço' },
      ],
      (slot, down) => this.onActionButton(slot, down),
    );
    this.soundButton = document.getElementById('hud-sound') as HTMLButtonElement | null;
    this.soundButton?.addEventListener('click', this.toggleSound);
    this.updateSoundButton();

    this.keyboard = new KeyboardDirections(() => this.chat.isTyping());
    window.addEventListener('keydown', this.onKeyDown);
    this.input.mouse?.disableContextMenu();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);

    this.conn.listen((msg) => this.onMessage(msg));
    if (this.arrived) {
      this.cameras.main.fadeIn(350, 16, 26, 18);
    } else {
      this.chat.addSystem(
        matchMedia('(pointer: coarse)').matches
          ? 'Dica: toque num monstro para atirar. Quadrados vermelhos no chão = golpe vindo: saia deles ou use a Esquiva!'
          : 'Dica: mire com o mouse e clique para atirar. Quadrados vermelhos no chão = golpe vindo: saia deles ou aperte Espaço!',
      );
    }
    this.conn.send({ t: 'loaded' }); // mapa pronto: o servidor volta a aceitar nossos pedidos
    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.syncLabels, this);
    this.time.addEvent({ delay: PING_EVERY_MS, loop: true, callback: this.sendPing, callbackScope: this });
    this.sendPing();
    this.exposeDebug();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  /**
   * Ajuda para testes automáticos e depuração (no console do navegador: `__meummo.me`).
   * Só lê o estado e usa o mesmo "andar até" do clique — não dá vantagem, quem manda é o servidor.
   */
  private exposeDebug(): void {
    const scene = this;
    (window as unknown as { __meummo?: unknown }).__meummo = {
      get me() {
        const { x, y } = scene.predicted;
        return { id: scene.myId, x, y, hp: scene.myHp, maxHp: scene.myMaxHp, level: scene.myLevel, xp: scene.myXp, dead: scene.dead };
      },
      entities: () =>
        [...scene.entities.values()].map((v) => ({ id: v.id, kind: v.kind, type: v.type, name: v.name, x: v.tileX, y: v.tileY, hp: v.hp, maxHp: v.maxHp, level: v.level, texture: v.sprite.texture.key })),
      walkTo: (x: number, y: number) => scene.walkTo(x, y),
      /** Id do mapa onde você está. */
      get zone() {
        return scene.welcome.map;
      },
      walking: () => scene.path.length > 0,
      /** Posição na tela (pixels) do centro de um tile. */
      screenOf: (x: number, y: number) => {
        const camera = scene.cameras.main;
        return { x: ((x + 0.5) * T - camera.worldView.x) * camera.zoom, y: ((y + 0.5) * T - camera.worldView.y) * camera.zoom };
      },
    };
  }

  override update(): void {
    const now = performance.now();
    if (!this.dead) {
      this.handleMovementInput(now);
      this.handleHeldFire(now);
    }
    for (const entity of this.entities.values()) entity.update(now);
    this.dying = this.dying.filter((view) => {
      if (view.update(now)) return true;
      view.destroy();
      return false;
    });
    this.effects.update(now);
    this.actionBar.update(now);
    this.updateDepth(now);
  }

  /** Copas transparentes em cima de quem está embaixo delas (e dos avisos no chão), e as luzes tremulando. */
  private updateDepth(now: number): void {
    const delta = this.lastFrameAt ? now - this.lastFrameAt : 0;
    this.lastFrameAt = now;
    this.mapLights.update(now);
    if (!this.canopy) return;
    const view = this.cameras.main.worldView;
    const near = (x: number, y: number) => x > view.x - 48 && x < view.right + 48 && y > view.y - 48 && y < view.bottom + 48;
    const points: { x: number; y: number }[] = [];
    for (const entity of [...this.entities.values(), ...this.dying]) {
      const { x, y } = entity.sprite;
      if (near(x, y)) points.push({ x, y: y - 12 });
    }
    for (const spot of this.effects.dangerSpots()) if (near(spot.x, spot.y)) points.push(spot);
    if (this.marker.visible) points.push({ x: this.marker.x + T / 2, y: this.marker.y + T / 2 });
    this.canopy.update(points, delta);
  }

  // ======================= movimento =======================

  private handleMovementInput(now: number): void {
    const held = this.keyboard?.current() ?? null;
    if (held !== null) {
      this.clearPath();
      this.tryHeldStep(held, now);
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

  /**
   * Passo pelo teclado. Na diagonal (ex.: W+D), se tiver parede no caminho, "escorrega"
   * para o lado que estiver livre em vez de travar.
   */
  private tryHeldStep(held: HeldMove, now: number): void {
    if (now < this.nextStepAt - STEP_TOLERANCE_MS || this.pending.length >= MAX_PENDING_STEPS) return;
    for (const dir of [held.dir, ...held.fallbacks]) {
      if (applyStep(this.map, this.predicted, dir).moved) {
        this.tryStep(dir, now);
        return;
      }
    }
    this.tryStep(held.dir, now); // tudo bloqueado: só vira para lá
  }

  /** Tenta dar um passo: mostra na hora (previsão) e avisa o servidor. */
  private tryStep(dir: Dir, now: number): StepResult {
    if (now < this.nextStepAt - STEP_TOLERANCE_MS || this.pending.length >= MAX_PENDING_STEPS) return 'wait';
    const result = applyStep(this.map, this.predicted, dir);
    if (!result.moved && result.dir === this.predicted.dir) return 'blocked';

    this.seq += 1;
    this.pending.push({ seq: this.seq, dir, dash: false });
    this.conn.send({ t: 'step', seq: this.seq, dir });
    this.predicted = { x: result.x, y: result.y, dir: result.dir };
    if (result.moved) this.nextStepAt = nextStepTime(now, this.nextStepAt, stepDuration(dir, this.stepMs), TICK_MS);
    this.me.moveTo(result.x, result.y, result.dir, now, this.stepMs);
    return result.moved ? 'moved' : 'turned';
  }

  /**
   * Para onde rolar: a tecla que você segura; senão, para onde está andando;
   * senão, para longe do monstro mais perto (é o que se quer quando um golpe vem vindo).
   */
  private dashDirection(): Dir {
    const held = this.keyboard?.current() ?? null;
    if (held !== null) return held.dir;
    if (this.path.length > 0) return this.path[0]!;
    const threat = this.nearestMonster(this.predicted.x + 0.5, this.predicted.y + 0.5, 4.5);
    if (!threat) return this.predicted.dir;
    let best = this.predicted.dir;
    let bestDistance = -Infinity;
    for (const dir of ALL_DIRS) {
      const landing = applyDash(this.map, this.predicted, dir, DASH_TILES);
      if (!landing.moved) continue;
      const distance = Math.hypot(landing.x - threat.tileX, landing.y - threat.tileY);
      if (distance > bestDistance) {
        best = dir;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Esquiva: rola 3 tiles (veja dashDirection). */
  private tryDash(now: number): void {
    if (this.dead || now < this.dashReadyAt || this.pending.length >= MAX_PENDING_STEPS) return;
    const dir = this.dashDirection();
    const result = applyDash(this.map, this.predicted, dir, DASH_TILES);
    if (!result.moved) {
      this.toast.show('Sem espaço para rolar aí');
      return;
    }
    this.seq += 1;
    this.pending.push({ seq: this.seq, dir, dash: true });
    this.conn.send({ t: 'step', seq: this.seq, dir, dash: true });
    this.sfx.play('dash');
    const from = feetOf(this.predicted.x, this.predicted.y);
    this.predicted = { x: result.x, y: result.y, dir };
    this.nextStepAt = nextStepTime(now, this.nextStepAt, stepDuration(dir, this.stepMs), TICK_MS);
    this.me.moveTo(result.x, result.y, dir, now, this.stepMs, { snapBeyond: DASH_TILES + 1, durationMs: 140 });
    this.me.ghost(now, DASH_INVULNERABLE_MS);
    const to = feetOf(result.x, result.y);
    this.effects.trail(this.me.sprite.texture.key, Number(this.me.sprite.frame.name) || 0, this.me.sprite.flipX, { x: from[0], y: from[1] }, { x: to[0], y: to[1] }, now);
    this.dashReadyAt = now + DASH_COOLDOWN_MS + 120;
    this.actionBar.setCooldown('dash', this.dashReadyAt, DASH_COOLDOWN_MS);
    this.clearPath();
  }

  /** O servidor confirmou nossos passos até `seq`. Se a previsão errou, corrige. */
  private onAck(seq: number, server: Pose, now: number): void {
    this.pending = this.pending.filter((p) => p.seq > seq);
    let pose: Pose = server;
    for (const p of this.pending) pose = applyInput(this.map, pose, p.dir, p.dash, DASH_TILES);
    if (pose.x !== this.predicted.x || pose.y !== this.predicted.y) {
      this.predicted = { x: pose.x, y: pose.y, dir: pose.dir };
      this.clearPath();
      this.me.moveTo(pose.x, pose.y, pose.dir, now, this.stepMs);
    }
  }

  private walkTo(tx: number, ty: number): void {
    const target = this.pathTo(tx, ty);
    if (!target || target.path.length === 0) {
      this.clearPath();
      return;
    }
    this.path = target.path;
    this.marker.setPosition(target.goal.x * T, target.goal.y * T).setVisible(true);
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

  // ======================= combate =======================

  private handleHeldFire(now: number): void {
    if (this.firing === 'mouse') {
      const pointer = this.input.activePointer;
      if (!pointer.isDown) this.firing = null;
      else this.tryShoot(this.mouseAngle(now), now);
    } else if (this.firing === 'button') {
      this.tryShoot(this.autoAim(SHOT_RANGE + 0.5), now);
    }
  }

  private tryShoot(angle: number, now: number): void {
    if (this.dead || now < this.nextShotAt) return;
    // um pouco mais que a recarga do servidor, para a variação da rede não fazer um tiro ser recusado
    this.nextShotAt = now + SHOT_COOLDOWN_MS + 40;
    const cid = ++this.shotCid;
    this.conn.send({ t: 'shoot', cid, a: round3(angle) });
    this.sfx.play('shot');
    this.effects.addShot(
      { x: this.predicted.x + 0.5, y: this.predicted.y + 0.5, angle, speed: SHOT_SPEED, range: SHOT_RANGE, kind: 'pedra', fromMonster: false, cid },
      now,
    );
    this.face(dirFromAngle(angle));
    this.actionBar.setCooldown('shot', this.nextShotAt, SHOT_COOLDOWN_MS);
  }

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
    this.skillReadyAt[n] = now + skill.cooldownMs;
    this.actionBar.setCooldown(`skill${n}` as ActionSlot, this.skillReadyAt[n]!, skill.cooldownMs);
    this.conn.send({ t: 'skill', n, a: round3(angle) });
    if (skill.kind === 'arc') {
      this.sfx.play('arc');
      this.face(dirFromAngle(angle));
      this.effects.flashTiles(arcTiles(this.predicted.x, this.predicted.y, angle), 0xffe08a, 220, now);
    }
  }

  private face(dir: Dir): void {
    this.predicted = { ...this.predicted, dir };
    this.me.setDir(dir);
  }

  /** Ângulo do personagem até o mouse. */
  private mouseAngle(now: number): number {
    const pointer = this.input.activePointer;
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const center = this.me.center(now);
    return Math.atan2(point.y - center.y, point.x - center.x);
  }

  /** Mira automática (celular e botões): o monstro mais perto; se não tiver, para onde você olha. */
  private autoAim(maxDistance: number): number {
    const target = this.nearestMonster(this.predicted.x + 0.5, this.predicted.y + 0.5, maxDistance);
    return target ? angleBetween(this.predicted, { x: target.tileX, y: target.tileY }) : angleOfDir(this.predicted.dir);
  }

  private nearestMonster(cx: number, cy: number, maxDistance: number): EntityView | null {
    let best: EntityView | null = null;
    let bestDistance = maxDistance;
    for (const view of this.entities.values()) {
      if (view.kind !== 'monster') continue;
      const distance = Math.hypot(view.tileX + 0.5 - cx, view.tileY + 0.5 - cy);
      if (distance <= bestDistance) {
        best = view;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Onde estão os alvos de um projétil (só para o desenho parar no lugar certo). */
  private shotTargets(fromMonster: boolean): Tile[] {
    const tiles: Tile[] = [];
    for (const view of this.entities.values()) {
      if ((view.kind === 'player') === fromMonster) tiles.push({ x: view.tileX, y: view.tileY });
    }
    return tiles;
  }

  // ======================= entrada =======================

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (this.chat.isTyping()) return;
    const now = performance.now();
    switch (event.code) {
      case 'Space':
      case 'ShiftLeft':
      case 'ShiftRight':
        event.preventDefault();
        if (!event.repeat) this.tryDash(now);
        break;
      case 'KeyQ':
      case 'Digit1':
        if (!event.repeat) this.trySkill(0, this.usingTouch ? this.autoAim(2.5) : this.mouseAngle(now), now);
        break;
      case 'KeyE':
      case 'Digit2':
        if (!event.repeat) this.trySkill(1, 0, now);
        break;
      case 'KeyM':
        if (!event.repeat) this.toggleSound();
        break;
      case 'KeyI':
        if (!event.repeat) this.bag.toggle();
        break;
      case 'Escape':
        if (this.bag.isOpen) this.bag.close();
        break;
    }
  };

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.chat.isTyping()) this.chat.blur();
    this.usingTouch = pointer.wasTouch;
    if (this.dead) return;
    const now = performance.now();
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tx = point.x / T;
    const ty = point.y / T;

    if (pointer.wasTouch) {
      // Toque num monstro: atira nele. Toque no chão: anda até lá.
      const monster = this.nearestMonster(tx, ty, 1.3);
      if (monster) this.tryShoot(angleBetween(this.predicted, { x: monster.tileX, y: monster.tileY }), now);
      else this.walkTo(Math.floor(tx), Math.floor(ty));
      return;
    }
    if (pointer.rightButtonDown()) {
      this.walkTo(Math.floor(tx), Math.floor(ty));
      return;
    }
    this.firing = 'mouse';
    this.tryShoot(this.mouseAngle(now), now);
  }

  private onPointerUp(): void {
    if (this.firing === 'mouse') this.firing = null;
  }

  private onActionButton(slot: ActionSlot, down: boolean): void {
    const now = performance.now();
    if (slot === 'shot') {
      if (down) {
        this.firing = 'button';
        this.tryShoot(this.autoAim(SHOT_RANGE + 0.5), now);
      } else if (this.firing === 'button') {
        this.firing = null;
      }
      return;
    }
    if (!down) return;
    if (slot === 'dash') this.tryDash(now);
    else if (slot === 'skill0') this.trySkill(0, this.autoAim(2.5), now);
    else if (slot === 'skill1') this.trySkill(1, 0, now);
  }

  // ======================= mensagens do servidor =======================

  private onMessage(msg: ServerMsg): void {
    const now = performance.now();
    switch (msg.t) {
      case 'spawn': {
        if (msg.e.id === this.myId) break;
        this.entities.get(msg.e.id)?.destroy();
        this.addEntity(msg.e, false).setThreat(this.myLevel);
        break;
      }
      case 'despawn':
        this.entities.get(msg.id)?.destroy();
        this.entities.delete(msg.id);
        break;
      case 'move':
        this.onMove(msg.id, msg.x, msg.y, msg.dir, msg.dash === true, now);
        break;
      case 'ack':
        this.onAck(msg.seq, { x: msg.x, y: msg.y, dir: msg.dir }, now);
        break;
      case 'teleport':
        this.onTeleport(msg.x, msg.y, msg.dir, now);
        break;
      case 'stats':
        this.applyStats(msg.stats, true);
        break;
      case 'shot':
        if (msg.by === this.myId && msg.cid !== undefined) {
          this.effects.bindShot(msg.cid, msg.id);
        } else {
          this.effects.addShot(
            {
              x: msg.x,
              y: msg.y,
              angle: msg.a,
              speed: msg.speed,
              range: msg.range,
              kind: msg.kind,
              fromMonster: this.entities.get(msg.by)?.kind === 'monster',
              serverId: msg.id,
            },
            now,
          );
        }
        break;
      case 'shot_end':
        this.effects.endShot(msg.id, msg.hit !== 0);
        break;
      case 'warn':
        this.entities.get(msg.id)?.windup(now, msg.ms);
        this.effects.warn(msg.tiles, msg.ms, now, msg.id);
        if (this.isMyTile(msg.tiles)) this.sfx.play('warn');
        break;
      case 'fx':
        this.onFx(msg.id, msg.kind, msg.a ?? 0, now, msg.r);
        break;
      case 'fire':
        this.effects.fire(msg.tiles, msg.ms, now);
        if (this.isMyTile(msg.tiles) || this.near(msg.id, 8)) this.sfx.play('fire');
        break;
      case 'hit':
        this.onHit(msg.id, msg.by, msg.dmg, msg.hp, now);
        break;
      case 'heal': {
        const view = this.entities.get(msg.id);
        view?.setHp(msg.hp);
        view?.floatText(`+${msg.amount}`, 'heal');
        if (msg.id === this.myId) {
          this.setMyHp(msg.hp, this.myMaxHp);
          this.sfx.play('heal');
        }
        break;
      }
      case 'hp':
        this.entities.get(msg.id)?.setHp(msg.hp, msg.maxHp);
        if (msg.id === this.myId) this.setMyHp(msg.hp, msg.maxHp);
        break;
      case 'death':
        this.onDeath(msg.id, now);
        break;
      case 'levelup':
        this.onLevelUp(msg.id, msg.level, msg.maxHp);
        break;
      case 'cd': {
        const readyAt = now + msg.ms;
        if (msg.n === DASH_SLOT) {
          this.dashReadyAt = Math.max(this.dashReadyAt, readyAt);
          this.actionBar.setCooldown('dash', this.dashReadyAt, msg.ms);
        } else if (SKILLS[msg.n]) {
          this.skillReadyAt[msg.n] = readyAt;
          this.actionBar.setCooldown(`skill${msg.n}` as ActionSlot, readyAt, msg.ms);
        }
        break;
      }
      case 'fail':
        if (msg.item) {
          this.onItemFail(msg.reason);
          break;
        }
        if (msg.reason === 'cooldown') this.toast.show('Ainda recarregando...');
        if (msg.reason === 'full_hp') {
          this.toast.show('Sua vida já está cheia');
          SKILLS.forEach((skill, i) => {
            if (skill.kind === 'heal') {
              this.skillReadyAt[i] = 0;
              this.actionBar.setCooldown(`skill${i}` as ActionSlot, 0, 0);
            }
          });
        }
        break;
      case 'inv': {
        // Equipou ou tirou alguma coisa? (a mochila de antes x a de agora)
        const before = JSON.stringify(this.bagEquipped);
        this.bagEquipped = msg.inv.equipped;
        if (JSON.stringify(msg.inv.equipped) !== before) this.sfx.play('equip');
        this.bag.setState(msg.inv);
        break;
      }
      case 'gear':
        this.entities.get(msg.id)?.setGear(msg.gear);
        break;
      case 'loot':
        this.onLoot(msg.x, msg.y, msg.items, now);
        break;
      case 'zone':
        this.changeZone(msg);
        break;
      case 'say':
        this.entities.get(msg.id)?.say(msg.text);
        break;
      case 'chat':
        this.chat.addChat(msg.name, msg.text, msg.id === this.myId);
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

  private onMove(id: number, x: number, y: number, dir: Dir, dash: boolean, now: number): void {
    const view = this.entities.get(id);
    if (!view) return;
    if (dash) {
      const [fx, fy] = feetOf(view.tileX, view.tileY);
      const [tx, ty] = feetOf(x, y);
      const monster = view.kind === 'monster';
      // investida de monstro: rastro cor de fogo e uma corrida um pouco mais longa (até 8 tiles)
      this.effects.trail(view.sprite.texture.key, Number(view.sprite.frame.name) || 0, view.sprite.flipX, { x: fx, y: fy }, { x: tx, y: ty }, now, monster ? 0xff9a4a : undefined);
      view.moveTo(x, y, dir, now, this.stepMs, monster ? { snapBeyond: 9, durationMs: 220 } : { snapBeyond: DASH_TILES + 1, durationMs: 140 });
      if (!monster) view.ghost(now, DASH_INVULNERABLE_MS);
      return;
    }
    if (view.kind === 'monster') {
      // Monstros andam no máximo 1 tile por vez; mais que isso é teleporte (redemoinho do Saci).
      view.moveTo(x, y, dir, now, view.stepMs ?? DEFAULT_MONSTER_STEP_MS, { snapBeyond: 1 });
    } else {
      view.setFainted(false);
      view.moveTo(x, y, dir, now, this.stepMs);
    }
  }

  private onTeleport(x: number, y: number, dir: Dir, now: number): void {
    this.pending = [];
    this.predicted = { x, y, dir };
    this.nextStepAt = 0;
    this.clearPath();
    this.firing = null;
    this.me.teleportTo(x, y, dir);
    this.me.setFainted(false);
    this.me.ghost(now, 2000); // proteção depois de voltar
    this.dead = false;
    this.feedback.hideDeath();
  }

  private onHit(id: number, by: number, dmg: number, hp: number, now: number): void {
    const view = this.entities.get(id);
    if (view) {
      view.setHp(hp);
      view.flash(now);
      view.floatText(String(dmg), id === this.myId ? 'taken' : by === this.myId ? 'dealt' : 'other');
    }
    if (id === this.myId) {
      this.setMyHp(hp, this.myMaxHp);
      this.feedback.hurtFlash();
      this.sfx.play('hurt');
    } else if (by === this.myId) {
      this.lastHitByMe.set(id, now);
      this.sfx.play('hit');
    }
  }

  private onDeath(id: number, now: number): void {
    if (id === this.myId) {
      this.dead = true;
      this.firing = null;
      this.bag.close();
      this.clearPath();
      this.me.setFainted(true);
      this.setMyHp(0, this.myMaxHp);
      this.feedback.showDeath();
      this.sfx.play('death');
      return;
    }
    const view = this.entities.get(id);
    if (!view) return;
    if (view.kind === 'monster') {
      if (now - (this.lastHitByMe.get(id) ?? -Infinity) < 2000) this.sfx.play('kill');
      this.lastHitByMe.delete(id);
      this.effects.clearWarns(id);
      view.die(now);
      this.entities.delete(id);
      this.dying.push(view);
    } else {
      view.setFainted(true);
    }
  }

  private onLevelUp(id: number, level: number, maxHp: number): void {
    const view = this.entities.get(id);
    view?.setLevel(level);
    view?.setHp(maxHp, maxHp);
    view?.floatText(`Nível ${level}!`, 'level');
    if (id !== this.myId) return;
    // this.myLevel é atualizado pelo applyStats (vem logo em seguida), que também calcula o "+XP".
    this.setMyHp(maxHp, maxHp);
    this.toast.show(`Você chegou ao nível ${level}!`, 2500);
    this.sfx.play('levelup');
    for (const other of this.entities.values()) other.setThreat(level);
  }

  /** A entidade está a até `tiles` de distância de mim? */
  private near(id: number, tiles: number): boolean {
    const view = this.entities.get(id);
    return !!view && Math.max(Math.abs(view.tileX - this.predicted.x), Math.abs(view.tileY - this.predicted.y)) <= tiles;
  }

  private onFx(id: number, kind: string, angle: number, now: number, range?: number): void {
    const view = this.entities.get(id);
    if (!view) return;
    const center = view.center(now);
    switch (kind) {
      case 'arc':
        this.effects.flashTiles(arcTiles(view.tileX, view.tileY, angle), 0xffe08a, 220, now);
        break;
      case 'spin':
        this.effects.ring(center.x, center.y, 0xff6b4a, 26, 320, now);
        break;
      case 'strike':
      case 'bite':
        this.effects.flashTiles(reachableLine(this.map, view.tileX, view.tileY, dir8FromAngle(angle), kind === 'strike' ? (range ?? 2) : 1).slice(1), 0xffffff, 160, now);
        break;
      case 'charge':
        this.effects.flashTiles(reachableLine(this.map, view.tileX, view.tileY, dir8FromAngle(angle), range ?? 6).slice(1), 0xffb347, 220, now);
        this.effects.ring(center.x, center.y, 0xff9a4a, 14, 260, now);
        if (this.near(id, 10)) {
          this.sfx.play('charge');
          this.cameras.main.shake(180, 0.004);
        }
        break;
      case 'whirlwind':
        this.effects.whirlwind(center.x, center.y + 6, now);
        break;
    }
  }

  /** Fomos para outro mapa: esta cena sai e entra uma nova, já com o mapa novo. */
  private changeZone(msg: ZoneMsg): void {
    this.conn.hold(); // o que chegar daqui em diante é do mapa novo: fica guardado para a próxima cena
    this.travel({ ...this.welcome, map: msg.map, you: msg.you, stats: msg.stats, inv: msg.inv, online: msg.online }, this.seq);
  }

  private onLoot(x: number, y: number, stacks: ItemStack[], now: number): void {
    const from = { x: (x + 0.5) * T, y: (y + 0.5) * T };
    let precious = false;
    stacks.forEach((stack, i) => {
      const def = this.items.get(stack.item);
      if (!def) return;
      if (def.rarity !== 'common') precious = true;
      this.effects.loot(itemTexture(this, def.icon), from, () => this.lootTarget(), now, i * 150);
      const label = `+${stack.n > 1 ? `${stack.n} ` : ''}${def.name}`;
      window.setTimeout(() => this.me?.floatText(label, `loot ${def.rarity}`), 650 + i * 150);
      if (def.rarity === 'legendary') this.toast.show(`Item lendário: ${def.name}!`, 3000);
    });
    this.sfx.play(precious ? 'rare' : 'loot');
    this.bag.notifyNew();
  }

  /** Para onde o item voa: a cabeça do seu personagem. */
  private lootTarget(): { x: number; y: number } {
    const center = this.me.center(performance.now());
    return { x: center.x, y: center.y - 6 };
  }

  private onItemFail(reason: string): void {
    if (reason === 'cooldown') this.toast.show('Espere um pouquinho para usar outro item');
    else if (reason === 'full_hp') this.toast.show('Sua vida já está cheia');
    else if (reason === 'bag_full') this.toast.show('A mochila está cheia');
    else if (reason === 'dead') this.toast.show('Desmaiado não dá para mexer na mochila');
  }

  private applyStats(stats: PlayerStats, showGain: boolean): void {
    if (showGain) {
      const gained = stats.level > this.myLevel ? this.myXpNext - this.myXp + stats.xp : stats.xp - this.myXp;
      if (gained > 0) this.me.floatText(`+${gained} XP`, 'xp');
    }
    this.myLevel = stats.level;
    this.myXp = stats.xp;
    this.myXpNext = stats.xpNext;
    this.myMaxHp = stats.maxHp;
    this.bag?.setStats(stats);
    this.hud.setXp(stats.xp, stats.xpNext, stats.level);
    this.setMyHp(Math.min(this.myHp, stats.maxHp), stats.maxHp);
  }

  private setMyHp(hp: number, maxHp: number): void {
    this.myHp = hp;
    this.myMaxHp = maxHp;
    this.hud.setHp(hp, maxHp);
    this.me.setHp(hp, maxHp);
  }

  /** O aviso de golpe cobre o tile onde você está? */
  private isMyTile(tiles: number[]): boolean {
    for (let i = 0; i + 1 < tiles.length; i += 2) {
      if (tiles[i] === this.predicted.x && tiles[i + 1] === this.predicted.y) return true;
    }
    return false;
  }

  private readonly toggleSound = () => {
    this.sfx.toggleMute();
    this.updateSoundButton();
    this.toast.show(this.sfx.muted ? 'Som desligado (M para ligar)' : 'Som ligado');
  };

  private updateSoundButton(): void {
    if (this.soundButton) this.soundButton.textContent = this.sfx.muted ? '🔇' : '🔊';
  }

  private addEntity(state: EntityState, isSelf: boolean): EntityView {
    const view = new EntityView(this, this.labels, state, isSelf);
    this.entities.set(state.id, view);
    return view;
  }

  // ======================= tela =======================

  /** Zoom em números inteiros (pixel art fica nítida) mostrando ~14 tiles no lado menor. */
  private fitZoom(): void {
    const { width, height } = this.scale.gameSize;
    const zoom = Math.max(1, Math.round(Math.min(width, height) / (TILES_ON_SHORT_SIDE * T)));
    this.cameras.main.setZoom(zoom);
  }

  /**
   * Depois de desenhar o quadro, posiciona os nomes (HTML) em cima dos personagens.
   * Nomes que encostariam em outro sobem até achar espaço — o seu nunca sai do lugar.
   */
  /** Saída: brilho dourado no chão e uma placa com o nome do lugar para onde ela leva. */
  private drawExit(exit: MapExit): void {
    const glow: Phaser.GameObjects.Rectangle[] = [];
    for (let y = exit.y; y < exit.y + exit.h; y++) {
      for (let x = exit.x; x < exit.x + exit.w; x++) {
        if (this.map.isWalkable(x, y)) glow.push(this.add.rectangle(x * T, y * T, T, T, 0xffd76a, 0.25).setOrigin(0).setDepth(-60));
      }
    }
    this.tweens.add({ targets: glow, alpha: { from: 0.35, to: 0.1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (!exit.label) return;
    const atLeft = exit.x === 0;
    const atRight = exit.x + exit.w >= this.map.width;
    const el = document.createElement('div');
    el.className = 'exit-sign';
    el.textContent = atLeft ? `‹ ${exit.label}` : atRight ? `${exit.label} ›` : exit.label;
    this.labels.append(el);
    // a placa fica um pouco para dentro do mapa, para aparecer inteira na tela
    const cx = (atLeft ? exit.x + 3 : atRight ? exit.x - 2 : exit.x + exit.w / 2) * T;
    const cy = (exit.y + exit.h / 2) * T - T * 1.2;
    this.exitSigns.push({ el, x: cx, y: cy });
  }

  private syncLabels(): void {
    const camera = this.cameras.main;
    for (const sign of this.exitSigns) {
      sign.el.style.transform = `translate(${(sign.x - camera.worldView.x) * camera.zoom}px, ${(sign.y - camera.worldView.y) * camera.zoom}px) translate(-50%, -100%)`;
    }
    const items = [...this.entities.values(), ...this.dying].map((view) => ({ view, ...view.labelAnchor(camera) }));
    items.sort((a, b) => (a.view === this.me ? -1 : b.view === this.me ? 1 : b.y - a.y));
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const item of items) {
      const half = item.view.labelWidth() / 2 + 2;
      let y = item.y;
      for (let tries = 0; tries < 6; tries++) {
        const hit = placed.find((r) => item.x - half < r.x1 && item.x + half > r.x0 && y - LABEL_HEIGHT < r.y1 && y > r.y0);
        if (!hit) break;
        y = hit.y0 - 1;
      }
      placed.push({ x0: item.x - half, x1: item.x + half, y0: y - LABEL_HEIGHT, y1: y });
      item.view.placeLabel(item.x, y);
    }
  }

  private sendPing(): void {
    const id = ++this.pingId;
    this.pingsSent.set(id, performance.now());
    if (this.pingsSent.size > 10) this.pingsSent.delete(this.pingsSent.keys().next().value!);
    this.conn.send({ t: 'ping', id });
  }

  private cleanup(): void {
    delete (window as unknown as { __meummo?: unknown }).__meummo;
    for (const sign of this.exitSigns) sign.el.remove();
    this.exitSigns = [];
    this.keyboard?.destroy();
    this.keyboard = null;
    window.removeEventListener('keydown', this.onKeyDown);
    this.soundButton?.removeEventListener('click', this.toggleSound);
    this.game.events.off(Phaser.Core.Events.POST_RENDER, this.syncLabels, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.fitZoom, this);
    for (const view of [...this.entities.values(), ...this.dying]) view.destroy();
    this.entities.clear();
    this.dying = [];
    this.effects?.destroy();
    this.actionBar?.destroy();
    this.toast?.destroy();
    this.zoneBanner?.destroy();
    this.bag?.destroy();
    this.feedback?.destroy();
  }
}
