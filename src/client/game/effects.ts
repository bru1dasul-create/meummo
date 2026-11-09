// Efeitos visuais do combate: avisos no chão, projéteis, golpes e rastros.
// Tudo aqui é só aparência — quem decide dano é o servidor.

import type Phaser from 'phaser';
import { SHOT_HIT_RADIUS, TILE_SIZE } from '../../shared/constants';
import { advanceShot, shotTouches, type ShotPath } from '../../shared/combat';
import type { GameMap, Tile } from '../../shared/map';

const T = TILE_SIZE;

interface Effect {
  /** Devolve false quando o efeito acabou. */
  update(now: number): boolean;
  destroy(): void;
  /** Quem criou (para apagar os avisos de um monstro que morreu no meio do golpe). */
  owner?: number;
  cancelled?: boolean;
  /** Avisos e fogo no chão: o centro de cada tile (as copas em cima ficam transparentes para dar para ver). */
  spots?: { x: number; y: number }[];
}

interface VisualShot {
  path: ShotPath;
  sprite: Phaser.GameObjects.Arc;
  serverId: number | null;
  cid: number | null;
  fromMonster: boolean;
  done: boolean;
  lastUpdate: number;
}

export interface ShotOptions {
  x: number;
  y: number;
  angle: number;
  speed: number;
  range: number;
  kind: string;
  fromMonster: boolean;
  serverId?: number;
  cid?: number;
}

const SHOT_COLORS: Record<string, number> = { pedra: 0xe9e6df, fruta: 0xff9f1c, agua: 0x7cc8f0 }; // agua: jato do boto

/** Lista [x0, y0, x1, y1, ...] de tiles → o centro de cada um, em pixels. */
function tileCenters(tiles: number[]): { x: number; y: number }[] {
  const centers: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < tiles.length; i += 2) centers.push({ x: (tiles[i]! + 0.5) * T, y: (tiles[i + 1]! + 0.5) * T });
  return centers;
}

export class Effects {
  private effects: Effect[] = [];
  private shots: VisualShot[] = [];

  /**
   * @param targets onde estão (em tiles) quem um projétil pode acertar:
   *   tiros de jogador → monstros; tiros de monstro → jogadores.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: GameMap,
    private readonly targets: (fromMonster: boolean) => Tile[],
  ) {}

  // ---------- avisos ----------

  /** Aviso vermelho no chão: o golpe vai acertar estes tiles daqui a `ms` milissegundos. */
  warn(tiles: number[], ms: number, now: number, owner?: number): void {
    const rects: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i + 1 < tiles.length; i += 2) {
      rects.push(
        this.scene.add
          .rectangle(tiles[i]! * T, tiles[i + 1]! * T, T, T, 0xff3b30, 0.12)
          .setOrigin(0)
          .setStrokeStyle(1, 0xff3b30, 0.9)
          .setDepth(-40),
      );
    }
    if (rects.length === 0) return;
    const end = now + ms;
    this.effects.push({
      owner,
      spots: tileCenters(tiles),
      update: (t) => {
        const progress = Math.min(1, Math.max(0, 1 - (end - t) / ms));
        for (const rect of rects) rect.setFillStyle(0xff3b30, 0.12 + 0.43 * progress);
        return t < end + 100;
      },
      destroy: () => rects.forEach((r) => r.destroy()),
    });
  }

  /** Onde tem aviso de golpe ou fogo no chão agora (o centro de cada tile, em pixels). */
  dangerSpots(): { x: number; y: number }[] {
    return this.effects.flatMap((effect) => (effect.cancelled ? [] : (effect.spots ?? [])));
  }

  /** Apaga os avisos de alguém (ex.: o monstro morreu antes de dar o golpe). */
  clearWarns(owner: number): void {
    for (const effect of this.effects) if (effect.owner === owner) effect.cancelled = true;
  }

  // ---------- projéteis ----------

  addShot(options: ShotOptions, now: number): void {
    const path: ShotPath = {
      x: options.x,
      y: options.y,
      dx: Math.cos(options.angle),
      dy: Math.sin(options.angle),
      speed: options.speed,
      range: options.range,
      traveled: 0,
    };
    const sprite = this.scene.add
      .circle(path.x * T, path.y * T, options.kind === 'fruta' ? 2.5 : 2, SHOT_COLORS[options.kind] ?? 0xffffff)
      .setStrokeStyle(1, 0x2a2420, 0.95)
      .setDepth(5000);
    this.shots.push({
      path,
      sprite,
      serverId: options.serverId ?? null,
      cid: options.cid ?? null,
      fromMonster: options.fromMonster,
      done: false,
      lastUpdate: now,
    });
  }

  /** O servidor confirmou um tiro que o cliente já estava desenhando. */
  bindShot(cid: number, serverId: number): void {
    const shot = this.shots.find((s) => s.cid === cid && s.serverId === null);
    if (shot) shot.serverId = serverId;
  }

  /** O servidor disse que o projétil acabou. */
  endShot(serverId: number, hit: boolean): void {
    const shot = this.shots.find((s) => s.serverId === serverId);
    if (shot && !shot.done) this.finishShot(shot, hit);
  }

  // ---------- golpes ----------

  /** Pisca alguns tiles (arco da Bordunada, bote, mordida). */
  flashTiles(tiles: Tile[], color: number, ms: number, now: number): void {
    const rects = tiles.map((t) =>
      this.scene.add.rectangle(t.x * T, t.y * T, T, T, color, 0.55).setOrigin(0).setDepth(-30),
    );
    const end = now + ms;
    this.effects.push({
      update: (t) => {
        const left = Math.max(0, (end - t) / ms);
        for (const rect of rects) rect.setAlpha(left);
        return t < end;
      },
      destroy: () => rects.forEach((r) => r.destroy()),
    });
  }

  /** Anel que cresce e some (giro, redemoinho, impacto). */
  ring(x: number, y: number, color: number, radius: number, ms: number, now: number, filled = false): void {
    const circle = this.scene.add.circle(x, y, 2, color, filled ? 0.5 : 0).setDepth(4000);
    if (!filled) circle.setStrokeStyle(2, color, 0.9);
    const end = now + ms;
    this.effects.push({
      update: (t) => {
        const progress = 1 - Math.max(0, (end - t) / ms);
        circle.setRadius(2 + (radius - 2) * progress);
        circle.setAlpha(1 - progress);
        return t < end;
      },
      destroy: () => circle.destroy(),
    });
  }

  /** Redemoinho do Saci: vários anéis girando. */
  whirlwind(x: number, y: number, now: number): void {
    for (let i = 0; i < 3; i++) this.ring(x, y - 4 + i * 3, 0xd8c7a8, 10 + i * 4, 450 + i * 120, now);
  }

  /** Rastro da esquiva: "fantasmas" do personagem entre a origem e o destino. */
  trail(
    texture: string,
    frame: number,
    flipX: boolean,
    from: { x: number; y: number },
    to: { x: number; y: number },
    now: number,
    tint = 0xbfe3ff,
  ): void {
    const ghosts: Phaser.GameObjects.Sprite[] = [];
    for (let i = 1; i <= 3; i++) {
      const k = i / 4;
      ghosts.push(
        this.scene.add
          .sprite(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, texture, frame)
          .setOrigin(0.5, 1)
          .setFlipX(flipX)
          .setAlpha(0.35)
          .setTint(tint)
          .setDepth(from.y - 1),
      );
    }
    const end = now + 260;
    this.effects.push({
      update: (t) => {
        const left = Math.max(0, (end - t) / 260);
        ghosts.forEach((g) => g.setAlpha(0.35 * left));
        return t < end;
      },
      destroy: () => ghosts.forEach((g) => g.destroy()),
    });
  }

  /** Item saindo do monstro que caiu e voando até quem pegou (`to` segue o personagem andando). */
  loot(texture: string, from: { x: number; y: number }, to: () => { x: number; y: number }, now: number, delay = 0): void {
    const sprite = this.scene.add.image(from.x, from.y, texture).setDepth(1e6).setAlpha(0);
    const start = now + delay;
    const POP_MS = 280;
    const FLY_MS = 420;
    this.effects.push({
      update: (t) => {
        if (t < start) return true;
        const k = t - start;
        if (k < POP_MS) {
          // sobe com um pulinho
          const p = k / POP_MS;
          sprite.setAlpha(1).setScale(0.5 + 0.5 * p).setPosition(from.x, from.y - 14 * Math.sin((p * Math.PI) / 2));
          return true;
        }
        const p = Math.min(1, (k - POP_MS) / FLY_MS);
        const target = to();
        const e = p * p;
        sprite.setPosition(from.x + (target.x - from.x) * e, from.y - 14 + (target.y - from.y + 14) * e).setScale(1 - 0.5 * p);
        return p < 1;
      },
      destroy: () => sprite.destroy(),
    });
  }

  /** Chão pegando fogo (rastro da investida): chamas tremendo por `ms`, que se apagam no fim. */
  fire(tiles: number[], ms: number, now: number): void {
    const flames: { glow: Phaser.GameObjects.Rectangle; tongue: Phaser.GameObjects.Rectangle; seed: number }[] = [];
    for (let i = 0; i + 1 < tiles.length; i += 2) {
      const x = tiles[i]! * T;
      const y = tiles[i + 1]! * T;
      flames.push({
        glow: this.scene.add.rectangle(x, y, T, T, 0xff6a1a, 0.35).setOrigin(0).setDepth(-39),
        tongue: this.scene.add
          .rectangle(x + T / 2 + (Math.random() * 6 - 3), y + T - 2, 6, 9, 0xffd34d, 0.9)
          .setOrigin(0.5, 1)
          .setDepth(y + T - 1),
        seed: Math.random() * 1000,
      });
    }
    if (flames.length === 0) return;
    const end = now + ms;
    this.effects.push({
      spots: tileCenters(tiles),
      update: (t) => {
        const fade = Math.max(0, Math.min(1, (end - t) / 400)); // apaga nos últimos 400 ms
        for (const f of flames) {
          const flick = 0.5 + 0.5 * Math.sin((t + f.seed) / 65);
          f.glow.setFillStyle(0xff6a1a, (0.18 + 0.25 * flick) * fade);
          f.tongue.setFillStyle(flick > 0.5 ? 0xffd34d : 0xff8a2a, 0.9 * fade).setScale(1, 0.55 + 0.65 * flick);
        }
        return t < end;
      },
      destroy: () => flames.forEach((f) => (f.glow.destroy(), f.tongue.destroy())),
    });
  }

  // ---------- quadro a quadro ----------

  update(now: number): void {
    for (const shot of this.shots) {
      if (shot.done) continue;
      const dt = Math.min(0.1, Math.max(0, (now - shot.lastUpdate) / 1000));
      shot.lastUpdate = now;
      const targets = this.targets(shot.fromMonster);
      const result = advanceShot(shot.path, dt, this.map, (x, y) => targets.some((t) => shotTouches(x, y, t.x, t.y, SHOT_HIT_RADIUS)));
      shot.sprite.setPosition(shot.path.x * T, shot.path.y * T);
      if (result !== 'flying') this.finishShot(shot, result === 'hit');
    }
    this.shots = this.shots.filter((s) => !s.done);

    const alive: Effect[] = [];
    for (const effect of this.effects) {
      if (!effect.cancelled && effect.update(now)) alive.push(effect);
      else effect.destroy();
    }
    this.effects = alive;
  }

  destroy(): void {
    for (const shot of this.shots) if (!shot.done) shot.sprite.destroy();
    for (const effect of this.effects) effect.destroy();
    this.shots = [];
    this.effects = [];
  }

  private finishShot(shot: VisualShot, hit: boolean): void {
    shot.done = true;
    shot.sprite.destroy();
    this.ring(shot.path.x * T, shot.path.y * T, hit ? 0xffffff : 0xb8b2a6, hit ? 6 : 4, 180, performance.now(), hit);
  }
}
