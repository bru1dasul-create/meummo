// As "coisas vivas" do mundo: jogadores e monstros. Só dados e pequenas ajudas;
// as regras ficam em world.ts.

import { DOWN, type Dir } from '../shared/dir';
import type { ShotPath } from '../shared/combat';
import { lookFromName } from '../shared/look';
import type { MonsterZone, Tile } from '../shared/map';
import type { GearLook, ItemBonus, ItemInfo } from '../shared/items';
import { damageRange, maxHpFor, xpToNext } from '../shared/progression';
import type { EntityState, NpcInfo, PlayerStats, ServerMsg } from '../shared/protocol';
import { SKILLS } from '../shared/skills';
import { Inventory } from './inventory';
import type { AttackKind, MonsterDef } from './monsters';
import type { NpcDef } from './npcs';
import { TokenBucket } from './rate-limit';

/** Como o mundo envia mensagens para um jogador. */
export interface Conn {
  send(batch: ServerMsg[]): void;
}

const NO_ITEMS: ReadonlyMap<string, ItemInfo> = new Map();

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

  // mochila
  inventory: Inventory = new Inventory(NO_ITEMS);
  /** O que os equipamentos somam agora (recalculado quando a mochila muda). */
  bonus: ItemBonus = { damage: 0, hp: 0, defense: 0 };
  /** Quando dá para usar o próximo consumível (banana...). */
  nextItemAt = 0;
  /** A mochila mudou neste tick (o dono precisa saber). */
  invDirty = false;

  /** Trocando de mapa: o navegador está carregando o mapa novo (pedidos são ignorados até ele avisar). */
  loading = false;

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
    /** Número do personagem salvo (null = não salva, como nos testes do mundo). */
    readonly characterId: number | null = null,
    look = lookFromName(name),
  ) {
    this.x = x;
    this.y = y;
    this.look = look;
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
      gear: this.inventory.look(),
    };
  }

  /** Dano do estilingue (a Bordunada multiplica isto), já com os equipamentos. */
  damage(): [number, number] {
    const [min, max] = damageRange(this.level);
    return [min + this.bonus.damage, max + this.bonus.damage];
  }

  stats(): PlayerStats {
    return {
      level: this.level,
      xp: this.xp,
      xpNext: xpToNext(this.level),
      maxHp: this.maxHp,
      damage: this.damage(),
      defense: this.bonus.defense,
    };
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
  /** Muda se o administrador ajustar a vida do monstro (veja World.refreshMonsters). */
  maxHp: number;
  readonly level: number;
  mode: MonsterMode = 'idle';
  targetId: number | null = null;
  windup: Windup | null = null;
  nextStepAt = 0;
  nextAttackAt = 0;
  nextWanderAt = 0;
  nextSpecialAt = 0;
  nextRegenAt = 0;
  /** Depois de não achar caminho até alguém, espera um pouco antes de tentar de novo. */
  retargetAt = 0;
  lastDamagedAt = -Infinity;
  changed = false;
  /** O movimento deste tick foi uma investida (o navegador desenha rápido, com rastro). */
  dashed = false;
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

/** Personagem que não é jogador (vendedora...): fica parado, não luta e não apanha. */
export class Npc {
  readonly kind = 'npc' as const;
  readonly look: number;

  constructor(
    readonly id: number,
    readonly def: NpcDef,
    readonly x: number,
    readonly y: number,
    /** O desenho do que ela veste (como o equipamento dos jogadores). */
    readonly gear: GearLook,
  ) {
    this.look = lookFromName(def.name);
  }

  state(): EntityState {
    return { id: this.id, kind: 'npc', type: this.def.id, name: this.def.name, x: this.x, y: this.y, dir: DOWN, look: this.look, level: 0, hp: 1, maxHp: 1, gear: this.gear };
  }

  info(): NpcInfo {
    const shop = this.def.shop;
    return { e: this.state(), title: this.def.title, line: this.def.line, shop: shop ? { sells: [...shop.sells], buyPercent: shop.buyPercent } : null };
  }
}

/** Chão perigoso por um tempo (o rastro de fogo da investida da Mula sem Cabeça). */
export interface Hazard {
  ownerId: number;
  tiles: Tile[];
  until: number;
  nextPulseAt: number;
  damage: [number, number];
}

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
