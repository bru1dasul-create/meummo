import { describe, expect, it } from 'vitest';
import { combineDirs, DOWN, DOWN_LEFT, DOWN_RIGHT, facingOf, LEFT, RIGHT, splitDiagonal, stepDuration, UP, UP_LEFT, UP_RIGHT } from '../src/shared/dir';
import { GameMap } from '../src/shared/map';
import { applyDash, applyStep, canStep, nextStepTime } from '../src/shared/movement';
import { nameProblem, normalizeName } from '../src/shared/names';
import { findPath } from '../src/shared/pathfind';
import { tiledFromAscii } from './helpers';

const map = GameMap.fromTiled(
  tiledFromAscii(
    [
      '.......', //
      '.#####.',
      '.#...#.',
      '.#.#.#.',
      '...#...',
    ],
    { x: 0, y: 0 },
  ),
);

describe('GameMap', () => {
  it('sabe onde dá para andar', () => {
    expect(map.isWalkable(0, 0)).toBe(true);
    expect(map.isWalkable(1, 1)).toBe(false);
    expect(map.isWalkable(-1, 0)).toBe(false);
    expect(map.isWalkable(7, 0)).toBe(false);
    expect(map.isWalkable(0.5, 0)).toBe(false);
  });

  it('acha o ponto de nascimento e corrige se ele estiver numa parede', () => {
    expect(map.spawn).toEqual({ x: 0, y: 0 });
    const walled = GameMap.fromTiled(tiledFromAscii(['###', '#..', '###'], { x: 0, y: 1 }));
    expect(walled.spawn).toEqual({ x: 1, y: 1 });
  });

  it('ignora as marcas de espelhamento do Tiled', () => {
    const json = tiledFromAscii(['..', '..']);
    (json.layers[0]!.data as number[])[0] = 2 | 0x80000000; // parede espelhada
    expect(GameMap.fromTiled(json).isWalkable(0, 0)).toBe(false);
  });

  it('lê o nome da zona e se ela é segura nas propriedades do mapa', () => {
    const json = tiledFromAscii(['..']);
    expect(GameMap.fromTiled(json)).toMatchObject({ name: 'Pindorama', safe: false });
    json.properties = [
      { name: 'nome', type: 'string', value: 'Refúgio de Teste' },
      { name: 'seguro', type: 'bool', value: true },
    ];
    expect(GameMap.fromTiled(json)).toMatchObject({ name: 'Refúgio de Teste', safe: true });
  });

  it('explica o erro quando o tileset é externo', () => {
    const json = tiledFromAscii(['..']);
    json.tilesets = [{ firstgid: 1, source: 'tiles.tsj' }];
    expect(() => GameMap.fromTiled(json)).toThrow(/Embed Tileset/);
  });

  it('lista tiles livres alcançáveis em volta', () => {
    const around = map.walkableAround(2, 2, 1);
    expect(around).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 },
    ]);
  });
});

describe('movimento', () => {
  it('anda quando o caminho está livre e só vira quando está bloqueado', () => {
    expect(applyStep(map, { x: 0, y: 0, dir: DOWN }, RIGHT)).toEqual({ x: 1, y: 0, dir: RIGHT, moved: true });
    expect(applyStep(map, { x: 0, y: 0, dir: DOWN }, UP)).toEqual({ x: 0, y: 0, dir: UP, moved: false });
  });

  it('mantém o ritmo dos passos sem acumular atraso', () => {
    // passo saiu 10 ms atrasado: o próximo continua no ritmo original
    expect(nextStepTime(1210, 1200, 200, 50)).toBe(1400);
    // estava parado há muito tempo: conta a partir de agora
    expect(nextStepTime(5000, 1200, 200, 50)).toBe(5200);
  });
});

describe('movimento em 8 direções', () => {
  const open = GameMap.fromTiled(tiledFromAscii(['.....', '.....', '.....', '.....', '.....'], { x: 0, y: 0 }));
  // Parede em (1,0).
  const corner = GameMap.fromTiled(tiledFromAscii(['.#...', '.....', '.....'], { x: 0, y: 1 }));

  it('anda na diagonal quando os dois lados estão livres', () => {
    expect(applyStep(open, { x: 1, y: 1, dir: DOWN }, DOWN_RIGHT)).toEqual({ x: 2, y: 2, dir: DOWN_RIGHT, moved: true });
    expect(applyStep(open, { x: 1, y: 1, dir: DOWN }, UP_LEFT)).toEqual({ x: 0, y: 0, dir: UP_LEFT, moved: true });
  });

  it('passa rente à quina de uma parede, mas não espremido entre duas', () => {
    // o destino (1,0) é a própria parede
    expect(applyStep(corner, { x: 0, y: 1, dir: DOWN }, UP_RIGHT).moved).toBe(false);
    // de (0,0) para (1,1) passa rente à quina da parede (1,0): pode (o outro lado, (0,1), está livre)
    expect(canStep(corner, 0, 0, DOWN_RIGHT)).toBe(true);
    // de (0,2) para (1,1) os dois lados estão livres: pode
    expect(canStep(corner, 0, 2, UP_RIGHT)).toBe(true);
    // paredes em (1,0) e (0,1): de (0,0) para (1,1) seria passar espremido entre as duas
    const squeeze = GameMap.fromTiled(tiledFromAscii(['.#.', '#..', '...'], { x: 0, y: 0 }));
    expect(canStep(squeeze, 0, 0, DOWN_RIGHT)).toBe(false);
    expect(canStep(squeeze, 1, 1, UP_LEFT)).toBe(false);
  });

  it('a esquiva na diagonal rola 2 tiles (mais ou menos a mesma distância de 3 retos)', () => {
    expect(applyDash(open, { x: 0, y: 0, dir: DOWN }, DOWN_RIGHT, 3)).toMatchObject({ x: 2, y: 2, moved: true });
    expect(applyDash(open, { x: 0, y: 0, dir: DOWN }, RIGHT, 3)).toMatchObject({ x: 3, y: 0, moved: true });
  });

  it('passo na diagonal demora √2 a mais (mesma velocidade em qualquer direção)', () => {
    expect(stepDuration(RIGHT, 200)).toBe(200);
    expect(stepDuration(UP_LEFT, 200)).toBe(283);
  });

  it('junta e separa diagonais e escolhe o lado do desenho', () => {
    expect(combineDirs(UP, RIGHT)).toBe(UP_RIGHT);
    expect(combineDirs(DOWN, LEFT)).toBe(DOWN_LEFT);
    expect(splitDiagonal(DOWN_LEFT)).toEqual([DOWN, LEFT]);
    expect(facingOf(UP_RIGHT)).toBe(RIGHT);
    expect(facingOf(DOWN_LEFT)).toBe(LEFT);
    expect(facingOf(UP)).toBe(UP);
  });

  it('o caminho usa diagonais quando é mais curto', () => {
    expect(findPath(open, 0, 0, 3, 3)).toEqual([DOWN_RIGHT, DOWN_RIGHT, DOWN_RIGHT]);
    const path = findPath(open, 0, 0, 4, 2)!;
    expect(path).toHaveLength(4); // 2 diagonais + 2 retos
  });
});

describe('nomes', () => {
  it('aceita nomes com acento e recusa nomes ruins', () => {
    expect(nameProblem(normalizeName('  João   Paulo '))).toBeNull();
    expect(normalizeName('  João   Paulo ')).toBe('João Paulo');
    expect(nameProblem('Al')).toBe('short');
    expect(nameProblem('Nome Comprido Demais')).toBe('long');
    expect(nameProblem('<script>')).toBe('chars');
    expect(nameProblem('1234')).toBe('chars');
  });
});

describe('findPath (A*)', () => {
  it('contorna obstáculos pelo caminho mais curto', () => {
    const path = findPath(map, 0, 0, 2, 2)!;
    expect(path).not.toBeNull();
    // caminho válido: seguir as direções termina no destino sem atravessar paredes
    let pos = { x: 0, y: 0, dir: DOWN };
    for (const dir of path) {
      const next = applyStep(map, pos, dir);
      expect(next.moved).toBe(true);
      pos = next;
    }
    expect([pos.x, pos.y]).toEqual([2, 2]);
    expect(path.length).toBe(6); // desce, passa rente às quinas de (1,3) na diagonal e sobe
  });

  it('devolve lista vazia quando já está no destino e null quando não dá para chegar', () => {
    expect(findPath(map, 0, 0, 0, 0)).toEqual([]);
    expect(findPath(map, 0, 0, 1, 1)).toBeNull();
    const island = GameMap.fromTiled(tiledFromAscii(['..#..'], { x: 0, y: 0 }));
    expect(findPath(island, 0, 0, 4, 0)).toBeNull();
    expect(findPath(island, 1, 0, 0, 0)).toEqual([LEFT]);
  });
});
