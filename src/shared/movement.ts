import { DOWN, DOWN_LEFT, DOWN_RIGHT, DX, DY, isDiagonal, LEFT, RIGHT, UP, UP_LEFT, UP_RIGHT, type Dir } from './dir';
import type { Walkable } from './map';

// Dois jeitos de andar:
// - os MONSTROS andam de tile em tile (grade), com `canStep` e a busca de caminho;
// - os JOGADORES andam soltos ("movimento livre"): a posição é um número quebrado e o pé é uma caixinha que
//   desliza encostada nas paredes. O navegador (para prever) e o servidor (para decidir) usam as mesmas funções.
//
// Posição "de canto": (x, y) em tiles (1 tile = 1 metro). Um número inteiro é alguém parado no tile (x, y) — o
// mesmo jeito dos monstros, desenhados com o pé na beirada de baixo do tile. A caixa do pé fica embaixo, onde o
// pé é desenhado: em (x, y) inteiros ela ocupa a faixa de baixo do tile (de x+0,2 a x+0,8 e de y+0,6 a y+1).
// Assim o personagem chega perto das coisas por qualquer lado. O tile onde a pessoa está é `footTile(x, y)`.

export interface Pose {
  x: number;
  y: number;
  dir: Dir;
}

/**
 * Dá para sair de (x, y) andando um tile na direção `dir`? (Monstros e busca de caminho.)
 * Na diagonal, pelo menos um dos dois tiles "de lado" precisa estar livre: dá para passar rente à
 * quina de uma árvore ou parede (sem virar escadinha), mas ninguém passa espremido entre duas.
 */
export function canStep(map: Walkable, x: number, y: number, dir: Dir): boolean {
  const nx = x + DX[dir];
  const ny = y + DY[dir];
  if (!map.isWalkable(nx, ny)) return false;
  if (isDiagonal(dir) && !map.isWalkable(nx, y) && !map.isWalkable(x, ny)) return false;
  return true;
}

/** Um passo de um tile na grade: anda se der; senão só vira para aquela direção. */
export function applyStep(map: Walkable, from: Pose, dir: Dir): Pose & { moved: boolean } {
  if (canStep(map, from.x, from.y, dir)) return { x: from.x + DX[dir], y: from.y + DY[dir], dir, moved: true };
  return { x: from.x, y: from.y, dir, moved: false };
}

// ======================= movimento livre =======================

/** Meia largura e meia altura da caixa do pé, em tiles (a caixa inteira tem 0,6 × 0,4). */
export const BODY_HALF_W = 0.3;
export const BODY_HALF_H = 0.2;
/** O centro da caixa fica este tanto abaixo do meio do tile: a beirada de baixo da caixa é onde o pé é desenhado. */
export const BODY_OFFSET_Y = 0.3;
/** Do canto até o centro da caixa, em cada eixo. */
const TO_CENTER_X = 0.5;
const TO_CENTER_Y = 0.5 + BODY_OFFSET_Y;
/**
 * Batendo de raspão na quina de uma passagem, escorrega de lado até isto para entrar nela (em tiles). É menos do
 * que a caixa precisaria para contornar um tile inteiro: ajuda a acertar a passagem, não anda sozinho em volta de nada.
 */
export const CORNER_SLIP = 0.3;
/** Folguinha para a caixa não ficar "encostando" exatamente na borda de um tile bloqueado. */
const GAP = 1e-6;
/** Na esquiva (e no puxão do canto) o caminho é andado em pedaços deste tamanho, para não atravessar nada. */
const SWEEP = 0.25;

/** O tile onde está o pé de quem tem esta posição "de canto" (o tile do centro da caixa do pé). */
export function footTile(x: number, y: number): { x: number; y: number } {
  return { x: Math.floor(x + TO_CENTER_X), y: Math.floor(y + TO_CENTER_Y) };
}

/**
 * Direção em graus inteiros (0 = direita, 90 = baixo, 180 = esquerda, 270 = cima), como x e y da tela.
 * Os senos e cossenos vêm de uma tabela arredondada: assim o navegador e o servidor (que podem ser
 * programas diferentes) chegam exatamente no mesmo número.
 */
const UNIT_X: number[] = [];
const UNIT_Y: number[] = [];
for (let a = 0; a < 360; a++) {
  UNIT_X.push(Math.round(Math.cos((a * Math.PI) / 180) * 1024) / 1024);
  UNIT_Y.push(Math.round(Math.sin((a * Math.PI) / 180) * 1024) / 1024);
}

/** É uma direção válida de pedido (grau inteiro de 0 a 359)? */
export function isWalkAngle(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 360;
}

/** Graus de cada uma das 8 direções (UP, RIGHT, DOWN, LEFT, UP_RIGHT, DOWN_RIGHT, DOWN_LEFT, UP_LEFT). */
const DIR_DEGREES = [270, 0, 90, 180, 315, 45, 135, 225] as const;
const SECTOR_DIRS: Dir[] = [RIGHT, DOWN_RIGHT, DOWN, DOWN_LEFT, LEFT, UP_LEFT, UP, UP_RIGHT];

export function degreesOfDir(dir: Dir): number {
  return DIR_DEGREES[dir];
}

/** Para qual das 8 direções o personagem olha andando neste ângulo. */
export function dirOfDegrees(degrees: number): Dir {
  return SECTOR_DIRS[Math.round(degrees / 45) % 8]!;
}

/** Ângulo (grau inteiro) de um ponto até outro. */
export function degreesToward(fromX: number, fromY: number, toX: number, toY: number): number {
  const degrees = Math.round((Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI);
  return ((degrees % 360) + 360) % 360;
}

/** Quanto se anda num pedaço de caminhada (WALK_SLICE_MS), no ritmo de `stepMs` por tile. */
export function walkDistance(sliceMs: number, stepMs: number): number {
  return sliceMs / stepMs;
}

/** A caixa do pé com centro em (cx, cy) encosta em algum tile bloqueado (ou sai do mapa)? */
function boxBlocked(map: Walkable, cx: number, cy: number): boolean {
  const x0 = cx - BODY_HALF_W;
  const x1 = cx + BODY_HALF_W;
  const y0 = cy - BODY_HALF_H;
  const y1 = cy + BODY_HALF_H;
  for (let ty = Math.floor(y0); ty <= Math.ceil(y1) - 1; ty++) {
    for (let tx = Math.floor(x0); tx <= Math.ceil(x1) - 1; tx++) {
      if (!map.isWalkable(tx, ty)) return true;
    }
  }
  return false;
}

/**
 * Anda `d` num eixo só (o outro fica parado), parando encostado no primeiro tile bloqueado.
 * `d` nunca passa de 1 tile (quem chama anda em pedaços), então a caixa não atravessa nada.
 */
function slideAxis(map: Walkable, cx: number, cy: number, d: number, horizontal: boolean): number {
  if (d === 0) return horizontal ? cx : cy;
  const nx = horizontal ? cx + d : cx;
  const ny = horizontal ? cy : cy + d;
  const x0 = nx - BODY_HALF_W;
  const x1 = nx + BODY_HALF_W;
  const y0 = ny - BODY_HALF_H;
  const y1 = ny + BODY_HALF_H;
  let limit = horizontal ? nx : ny;
  for (let ty = Math.floor(y0); ty <= Math.ceil(y1) - 1; ty++) {
    for (let tx = Math.floor(x0); tx <= Math.ceil(x1) - 1; tx++) {
      if (map.isWalkable(tx, ty)) continue;
      // encosta na borda do tile bloqueado que vem primeiro nesta direção
      if (horizontal) limit = d > 0 ? Math.min(limit, tx - BODY_HALF_W - GAP) : Math.max(limit, tx + 1 + BODY_HALF_W + GAP);
      else limit = d > 0 ? Math.min(limit, ty - BODY_HALF_H - GAP) : Math.max(limit, ty + 1 + BODY_HALF_H + GAP);
    }
  }
  const from = horizontal ? cx : cy;
  // nunca anda para trás (se já estava encostado, fica onde está)
  return d > 0 ? Math.max(from, limit) : Math.min(from, limit);
}

/**
 * Batendo de frente numa quina (andando só na horizontal ou só na vertical): procura, de lado, o
 * menor desvio (até CORNER_SLIP) que deixa seguir em frente. Devolve o desvio com sinal, ou 0.
 */
function cornerSlip(map: Walkable, cx: number, cy: number, sign: number, horizontal: boolean): number {
  for (let offset = 0.05; offset <= CORNER_SLIP + 1e-9; offset += 0.05) {
    for (const side of [-1, 1]) {
      const sx = horizontal ? cx + sign * 0.05 : cx + side * offset;
      const sy = horizontal ? cy + side * offset : cy + sign * 0.05;
      const bx = horizontal ? cx : cx + side * offset;
      const by = horizontal ? cy + side * offset : cy;
      if (!boxBlocked(map, sx, sy) && !boxBlocked(map, bx, by)) return side * offset;
    }
  }
  return 0;
}

/**
 * Anda (dx, dy) a partir de `from`, deslizando encostado nas paredes. Se o pedido era reto e bateu na
 * quina de uma passagem, usa o que sobrou do pedaço para escorregar de lado e entrar nela (nunca anda
 * mais do que pediu). `dir` é só para onde o personagem olha.
 */
export function moveBody(map: Walkable, from: Pose, dx: number, dy: number, dir: Dir): Pose & { moved: boolean } {
  let cx = from.x + TO_CENTER_X;
  let cy = from.y + TO_CENTER_Y;
  const startX = cx;
  const startY = cy;
  cx = slideAxis(map, cx, cy, dx, true);
  cy = slideAxis(map, cx, cy, dy, false);
  if ((dx === 0) !== (dy === 0)) {
    const horizontal = dx !== 0;
    const wanted = Math.abs(horizontal ? dx : dy);
    const done = Math.abs(horizontal ? cx - startX : cy - startY);
    const left = wanted - done;
    if (left > 0.01) {
      const slip = cornerSlip(map, cx, cy, Math.sign(horizontal ? dx : dy), horizontal);
      if (slip !== 0) {
        const amount = Math.sign(slip) * Math.min(Math.abs(slip), left);
        if (horizontal) cy = slideAxis(map, cx, cy, amount, false);
        else cx = slideAxis(map, cx, cy, amount, true);
      }
    }
  }
  // eixo que não andou fica exatamente igual (sem sobra de arredondamento da ida e volta ao centro)
  const x = cx === startX ? from.x : cx - TO_CENTER_X;
  const y = cy === startY ? from.y : cy - TO_CENTER_Y;
  return { x, y, dir, moved: x !== from.x || y !== from.y };
}

/** Um pedaço de caminhada na direção `degrees`, andando `distance` tiles (no máximo 1). */
export function walkSlice(map: Walkable, from: Pose, degrees: number, distance: number): Pose & { moved: boolean } {
  return moveBody(map, from, UNIT_X[degrees]! * distance, UNIT_Y[degrees]! * distance, dirOfDegrees(degrees));
}

/**
 * Anda até `distance` tiles em linha reta (esquiva, puxão do canto), em pedaços, deslizando nas paredes.
 * Para quando não consegue mais avançar. `moved` só conta se andou pelo menos um pedacinho de verdade.
 */
export function sweepBody(map: Walkable, from: Pose, degrees: number, distance: number): Pose & { moved: boolean } {
  let pose: Pose = { x: from.x, y: from.y, dir: dirOfDegrees(degrees) };
  let left = distance;
  while (left > 1e-9) {
    const piece = Math.min(SWEEP, left);
    const next = walkSlice(map, pose, degrees, piece);
    left -= piece;
    if (!next.moved) break;
    pose = next;
  }
  if (Math.hypot(pose.x - from.x, pose.y - from.y) < 0.2) return { x: from.x, y: from.y, dir: pose.dir, moved: false };
  return { x: pose.x, y: pose.y, dir: pose.dir, moved: true };
}

/** A caixa do pé cabe aqui (posição "de canto")? Para conferir pontos de chegada e teleportes. */
export function bodyFits(map: Walkable, x: number, y: number): boolean {
  return !boxBlocked(map, x + TO_CENTER_X, y + TO_CENTER_Y);
}

/** Quanto falta para chegar a um ponto (distância em linha reta). */
export function distanceTo(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}
