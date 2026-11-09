import { describe, expect, it } from 'vitest';
import { DOWN, LEFT, RIGHT, UP } from '../src/shared/dir';
import { GameMap } from '../src/shared/map';
import { applyStep, nextStepTime } from '../src/shared/movement';
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
    expect(path.length).toBe(8);
  });

  it('devolve lista vazia quando já está no destino e null quando não dá para chegar', () => {
    expect(findPath(map, 0, 0, 0, 0)).toEqual([]);
    expect(findPath(map, 0, 0, 1, 1)).toBeNull();
    const island = GameMap.fromTiled(tiledFromAscii(['..#..'], { x: 0, y: 0 }));
    expect(findPath(island, 0, 0, 4, 0)).toBeNull();
    expect(findPath(island, 1, 0, 0, 0)).toEqual([LEFT]);
  });
});
