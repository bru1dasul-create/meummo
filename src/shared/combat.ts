// Geometria do combate e voo dos projéteis. O servidor usa para decidir quem levou dano;
// o cliente usa as mesmas funções para desenhar os tiros sem esperar a rede.

import { DOWN, DOWN_LEFT, DOWN_RIGHT, DX, DY, LEFT, RIGHT, UP, UP_LEFT, UP_RIGHT, type Dir } from './dir';
import type { Tile, Walkable } from './map';
import { SHOT_COOLDOWN_MS, SHOT_RANGE, SHOT_SPEED } from './constants';
import type { CombatRules } from './combatRules';
import type { ShotKind, WeaponShot } from './items';
import { canStep } from './movement';

/** O tiro de quem atira: a pedra (os números do combate) ou o da arma equipada (ex.: a flecha do arco). */
export interface ShotProfile {
  kind: ShotKind;
  /** Tempo até a carga encher. */
  chargeMs: number;
  /** Alcance sem carga e com a carga cheia (metros, no mapa novo; no antigo, sempre SHOT_RANGE). */
  rangeMin: number;
  rangeMax: number;
  /** Tempo entre um tiro e outro. */
  cooldownMs: number;
  /** Metros por segundo. */
  speed: number;
  /** Carga cheia: dano × (1 + damageBonus) (o mesmo para todas as armas: é número do combate). */
  damageBonus: number;
}

/**
 * O tiro com a arma `weapon` (o "tiro" dela; sem ele, ou no mapa antigo, a pedra de sempre). O servidor e o navegador
 * fazem a mesma conta: a previsão do seu tiro bate com o que o servidor manda.
 */
export function shotProfile(rules: CombatRules, weapon: WeaponShot | null | undefined, metric = true): ShotProfile {
  const base = { damageBonus: rules.chargeDamageBonus };
  if (!weapon || !metric) {
    return { ...base, kind: 'pedra', chargeMs: rules.chargeFullMs, rangeMin: rules.chargeRangeMin, rangeMax: rules.chargeRangeMax, cooldownMs: SHOT_COOLDOWN_MS, speed: SHOT_SPEED };
  }
  return { ...base, kind: weapon.projectile, chargeMs: weapon.chargeMs, rangeMin: weapon.rangeMin, rangeMax: weapon.rangeMax, cooldownMs: weapon.cooldownMs, speed: weapon.speed };
}

/** Quanto da carga (0 a 1) depois de puxar `heldMs`. */
export function chargeFraction(heldMs: number, shot: Pick<ShotProfile, 'chargeMs'>): number {
  return shot.chargeMs > 0 ? Math.max(0, Math.min(1, heldMs / shot.chargeMs)) : 1;
}

/** Alcance do tiro com esta carga: no mapa novo, do alcance sem carga ao da carga cheia; no antigo, o de sempre. */
export function chargedRange(charge: number, metric: boolean, shot: Pick<ShotProfile, 'rangeMin' | 'rangeMax'>): number {
  return metric ? shot.rangeMin + (shot.rangeMax - shot.rangeMin) * charge : SHOT_RANGE;
}

/** Dano do tiro com esta carga (carga cheia, no padrão: o dobro). */
export function chargedDamage(base: number, charge: number, shot: Pick<ShotProfile, 'damageBonus'>): number {
  return Math.round(base * (1 + shot.damageBonus * charge));
}

/** Diferença entre dois ângulos (radianos), de -π a π. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * A defesa virada para `guardAngle` pega um golpe que vem andando na direção `travel` (radianos)? Só se ele chegar
 * pela frente: até guardHalfArc para cada lado (no padrão, 140° ao todo). Laterais mais abertas e costas levam o
 * golpe inteiro.
 */
export function guardCovers(guardAngle: number, travel: number, rules: CombatRules): boolean {
  return Math.abs(angleDiff(guardAngle, travel + Math.PI)) <= rules.guardHalfArc + 1e-9;
}

/**
 * Um golpe de `damage` na defesa levantada com `energy`: o dano que passa, a energia que sobra e se a defesa quebrou.
 * Com energia de sobra, passa guardDamageFactor do dano (pelo menos 1). Sem energia para o golpe inteiro, protege
 * em parte (na proporção da energia que tinha) e quebra; zerar a energia também quebra.
 */
export function blockHit(energy: number, damage: number, rules: CombatRules): { damage: number; energy: number; broke: boolean } {
  const cost = rules.guardHitCost + rules.guardHitDamageCost * damage;
  const spent = Math.min(Math.max(0, energy), cost);
  const fraction = cost > 0 ? spent / cost : 1; // golpe que não gasta energia: segura inteiro
  const left = energy - spent;
  const broke = fraction < 1 - 1e-9 || left <= 1e-9;
  const through = damage * (1 - (1 - rules.guardDamageFactor) * fraction);
  return { damage: Math.max(1, Math.ceil(through - 1e-9)), energy: broke ? 0 : left, broke };
}

export interface Point {
  x: number;
  y: number;
}

/** Quantos passos (contando diagonais) separam dois tiles. */
export function chebyshev(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Direção (4 lados) mais próxima de um ângulo. */
export function dirFromAngle(angle: number): Dir {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? RIGHT : LEFT;
  return dy >= 0 ? DOWN : UP;
}

/** Ângulo de uma direção (as 8). */
export function angleOfDir(dir: Dir): number {
  const q = Math.PI / 4;
  return [-2 * q, 0, 2 * q, 4 * q, -q, q, 3 * q, -3 * q][dir]!;
}

/** Ângulo em múltiplos de 45° (0 = direita, sentido horário na tela) → direção. */
const OCTANT_DIRS: Dir[] = [RIGHT, DOWN_RIGHT, DOWN, DOWN_LEFT, LEFT, UP_LEFT, UP, UP_RIGHT];

/** Direção (as 8) mais próxima de um ângulo. */
export function dir8FromAngle(angle: number): Dir {
  const k = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return OCTANT_DIRS[k]!;
}

/** Direção (as 8) de `from` para `to`; null se for o mesmo tile. */
export function dirTowards8(from: Point, to: Point): Dir | null {
  if (from.x === to.x && from.y === to.y) return null;
  return dir8FromAngle(Math.atan2(to.y - from.y, to.x - from.x));
}

/** Direção (4 lados) de `from` para `to`; null se for o mesmo tile. */
export function dirTowards(from: Point, to: Point): Dir | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? RIGHT : LEFT;
  return dy > 0 ? DOWN : UP;
}

/** Ângulo do centro de um tile até o centro de outro. */
export function angleBetween(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

const EIGHT_DIRS: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/** Os 3 tiles à frente, na direção do ângulo (golpe em arco). */
export function arcTiles(x: number, y: number, angle: number): Tile[] {
  const k = (((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8) as number;
  return [k - 1, k, k + 1].map((i) => {
    const [dx, dy] = EIGHT_DIRS[(i + 8) % 8]!;
    return { x: x + dx, y: y + dy };
  });
}

/** O próprio tile mais `length` tiles em linha reta à frente (bote da cobra, mordida). */
export function lineTiles(x: number, y: number, dir: Dir, length: number): Tile[] {
  const tiles: Tile[] = [{ x, y }];
  for (let i = 1; i <= length; i++) tiles.push({ x: x + DX[dir] * i, y: y + DY[dir] * i });
  return tiles;
}

/**
 * Como lineTiles, mas para no primeiro tile bloqueado: o golpe não atravessa árvores, pedras nem
 * paredes (e, na diagonal, não corta quinas — mesma regra de quem anda).
 */
export function reachableLine(map: Walkable, x: number, y: number, dir: Dir, length: number): Tile[] {
  const tiles: Tile[] = [{ x, y }];
  let cx = x;
  let cy = y;
  for (let i = 1; i <= length; i++) {
    if (!canStep(map, cx, cy, dir)) break;
    cx += DX[dir];
    cy += DY[dir];
    tiles.push({ x: cx, y: cy });
  }
  return tiles;
}

/** O tile e todos os vizinhos até `radius` de distância (giro). */
export function areaTiles(x: number, y: number, radius: number): Tile[] {
  const tiles: Tile[] = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) tiles.push({ x: x + dx, y: y + dy });
  return tiles;
}

export function tileIn(tiles: Tile[], x: number, y: number): boolean {
  return tiles.some((t) => t.x === x && t.y === y);
}

// ---------- projéteis ----------

export interface ShotPath {
  /** Posição em tiles (com fração). O centro do tile (3, 4) é (3.5, 4.5). */
  x: number;
  y: number;
  /** Direção (vetor de tamanho 1). */
  dx: number;
  dy: number;
  /** Tiles por segundo. */
  speed: number;
  /** Distância máxima, em tiles. */
  range: number;
  traveled: number;
}

export interface ShotBlocker {
  blocksShot(x: number, y: number): boolean;
  /** Mapa do formato novo: bate em algo no ponto exato (x, y) da pedra? (Sem isto, vale o tile inteiro.) */
  blocksShotAt?(x: number, y: number): boolean;
}


export function makeShot(fromTile: Point, angle: number, speed: number, range: number): ShotPath {
  return { x: fromTile.x + 0.5, y: fromTile.y + 0.5, dx: Math.cos(angle), dy: Math.sin(angle), speed, range, traveled: 0 };
}

/**
 * Avança um projétil `dt` segundos, em pedacinhos de no máximo 1/4 de tile (para não atravessar nada).
 * A cada pedacinho chama `hits(x, y)`: se devolver true, o projétil acertou alguém e para.
 */
export function advanceShot(
  shot: ShotPath,
  dtSeconds: number,
  map: ShotBlocker,
  hits?: (x: number, y: number) => boolean,
): 'hit' | 'wall' | 'range' | 'flying' {
  let remaining = shot.speed * dtSeconds;
  while (remaining > 1e-9) {
    const step = Math.min(0.25, remaining, shot.range - shot.traveled);
    if (step <= 1e-9) return 'range';
    shot.x += shot.dx * step;
    shot.y += shot.dy * step;
    shot.traveled += step;
    remaining -= step;
    if (map.blocksShotAt ? map.blocksShotAt(shot.x, shot.y) : map.blocksShot(Math.floor(shot.x), Math.floor(shot.y))) return 'wall';
    if (hits?.(shot.x, shot.y)) return 'hit';
    if (shot.traveled >= shot.range - 1e-9) return 'range';
  }
  return 'flying';
}

/** O projétil (x, y) está perto o bastante do centro do tile (tx, ty) para acertar? */
export function shotTouches(x: number, y: number, tx: number, ty: number, radius: number): boolean {
  const dx = x - (tx + 0.5);
  const dy = y - (ty + 0.5);
  return dx * dx + dy * dy <= radius * radius;
}
