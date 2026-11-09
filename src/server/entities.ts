// As "coisas vivas" do mundo: jogadores e monstros. Só dados e pequenas ajudas;
// as regras ficam em world.ts.

import { DOWN, type Dir } from '../shared/dir';
import type { ShotPath } from '../shared/combat';
import { lookFromName } from '../shared/look';
import type { MonsterZone, Tile } from '../shared/map';
import { maxHpFor, xpToNext } from '../shared/progression';
import type { EntityState, PlayerStats, ServerMsg } from '../shared/protocol';
import { SKILLS } from '../shared/skills';
import type { AttackKind, MonsterDef } from './monsters';
import { TokenBucket } from './rate-limit';

/** Como o mundo envia mensagens para um jogador. */
export interface Conn {
  send(batch: ServerMsg[]): void;
}

export class Player {
  readonly kind = 'player' as const;
  x: number;
  y: number;
  dir: Dir = DOWN;
  level = 1;
  /** XP dentro do nível atual. */
  xp = 0;
  hp: number;
  maxHp: number;
  readonly look: number;
  /** Ids de quem este jogador está vendo agora. */
  readonly known = new Set<number>();
  /** Passos/esquivas pedidos e ainda não processados (o servidor anda no ritmo dele). */
  readonly queue: { seq: number; dir: Dir; dash: boolean }[] = [];
  nextStepAt = 0;
  lastSeq = -1;
  ackSeq = -1;
  ackPending = false;
  /** Andou ou virou neste tick (os outros precisam saber). */
  changed = false;
  /** O movimento deste tick foi uma esquiva (os outros desenham mais rápido). */
  dashed = false;
  outbox: ServerMsg[] = [];
  readonly chatLimit: TokenBucket;

  // combate
  /** Diferente de 0: está desmaiado e volta para a vila nesse momento. */
  deadUntil = 0;
  invulnerableUntil = 0;
  nextShotAt = 0;
  dashReadyAt = 0;
  readonly skillReadyAt: number[] = SKILLS.map(() => 0);
  lastDamagedAt = -Infinity;
  nextRegenAt = 0;
  statsDirty = false;

  constructor(
    readonly id: number,
    readonly name: string,
    x: number,
    y: number,
    readonly conn: Conn,
    now: number,
  ) {
    this.x = x;
    this.y = y;
    this.look = lookFromName(name);
    this.maxHp = maxHpFor(this.level);
    this.hp = this.maxHp;
    // Até 4 mensagens seguidas; depois, uma a cada ~1,3 s.
    this.chatLimit = new TokenBucket(4, 0.75, now);
  }

  get dead(): boolean {
    return this.deadUntil > 0;
  }

  state(): EntityState {
    return {
      id: this.id,
      kind: 'player',
      type: 'player',
      name: this.name,
      x: this.x,
      y: this.y,
      dir: this.dir,
      look: this.look,
      level: this.level,
      hp: this.hp,
      maxHp: this.maxHp,
    };
  }

  stats(): PlayerStats {
    return { level: this.level, xp: this.xp, xpNext: xpToNext(this.level), maxHp: this.maxHp };
  }
}

export type MonsterMode = 'idle' | 'chase' | 'return';

/** Uma área do mapa que mantém monstros de um tipo vivos. */
export interface ZoneState {
  zone: MonsterZone;
  def: MonsterDef;
  alive: Set<number>;
  /** Momentos em que monstros mortos voltam (em ordem). */
  respawnAt: number[];
}

/** Golpe sendo preparado (o aviso vermelho já apareceu no chão). */
export interface Windup {
  kind: AttackKind;
  tiles: Tile[];
  resolveAt: number;
  angle: number;
}

export class Monster {
  readonly kind = 'monster' as const;
  x: number;
  y: number;
  dir: Dir = DOWN;
  hp: number;
  readonly maxHp: number;
  readonly level: number;
  mode: MonsterMode = 'idle';
  targetId: number | null = null;
  windup: Windup | null = null;
  nextStepAt = 0;
  nextAttackAt = 0;
  nextWanderAt = 0;
  nextSpecialAt = 0;
  nextRegenAt = 0;
  lastDamagedAt = -Infinity;
  changed = false;
  /** Jogadores que bateram neste monstro (todos ganham XP quando ele cai). */
  readonly contributors = new Set<number>();

  constructor(
    readonly id: number,
    readonly def: MonsterDef,
    readonly zone: ZoneState,
    x: number,
    y: number,
  ) {
    this.x = x;
    this.y = y;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.level = def.level;
  }

  state(): EntityState {
    return {
      id: this.id,
      kind: 'monster',
      type: this.def.id,
      name: this.def.name,
      x: this.x,
      y: this.y,
      dir: this.dir,
      look: 0,
      level: this.level,
      hp: this.hp,
      maxHp: this.maxHp,
      stepMs: this.def.stepMs,
    };
  }
}

export type Entity = Player | Monster;

export interface Projectile extends ShotPath {
  id: number;
  ownerId: number;
  /** Tiros de monstro acertam jogadores; tiros de jogador acertam monstros. */
  fromMonster: boolean;
  damage: number;
  kind: string;
  /** Jogadores que viram o tiro sair (recebem o aviso de quando ele acaba). */
  viewers: Set<number>;
}
