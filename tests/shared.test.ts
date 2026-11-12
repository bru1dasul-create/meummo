import { describe, expect, it } from 'vitest';
import { combineDirs, DOWN, DOWN_LEFT, DOWN_RIGHT, facingOf, LEFT, RIGHT, splitDiagonal, stepDuration, UP, UP_LEFT, UP_RIGHT } from '../src/shared/dir';
import { GameMap } from '../src/shared/map';
import { applyStep, BODY_HALF_H, BODY_HALF_W, BODY_OFFSET_Y, canStep, degreesOfDir, dirOfDegrees, footTile, sweepBody, walkSlice } from '../src/shared/movement';
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

describe('movimento livre (jogadores)', () => {
  const open = GameMap.fromTiled(tiledFromAscii(['......', '......', '......', '......', '......', '......'], { x: 0, y: 0 }));
  const slice = 0.25; // pedaço de caminhada: 50 ms a 5 tiles por segundo

  it('anda um pedaço, na mesma velocidade em qualquer direção', () => {
    expect(walkSlice(open, { x: 1, y: 1, dir: DOWN }, degreesOfDir(RIGHT), slice)).toEqual({ x: 1.25, y: 1, dir: RIGHT, moved: true });
    const diagonal = walkSlice(open, { x: 1, y: 1, dir: DOWN }, degreesOfDir(DOWN_RIGHT), slice);
    expect(Math.hypot(diagonal.x - 1, diagonal.y - 1)).toBeCloseTo(slice, 3);
    expect(diagonal.dir).toBe(DOWN_RIGHT);
  });

  it('tem 360 direções (joystick e clique para andar), e o desenho olha para a mais perto das 8', () => {
    const pose = walkSlice(open, { x: 2, y: 2, dir: DOWN }, 30, slice);
    expect(pose.x).toBeGreaterThan(2);
    expect(pose.y).toBeGreaterThan(2);
    expect(pose.x - 2).toBeGreaterThan(pose.y - 2);
    expect(dirOfDegrees(30)).toBe(DOWN_RIGHT);
    expect(dirOfDegrees(10)).toBe(RIGHT);
    expect(dirOfDegrees(359)).toBe(RIGHT);
    expect(dirOfDegrees(270)).toBe(UP);
  });

  it('para encostado na parede (perto dela, não a um tile de distância) e só vira', () => {
    const wall = GameMap.fromTiled(tiledFromAscii(['...#..', '......'], { x: 0, y: 0 }));
    let pose = { x: 1, y: 0, dir: DOWN as typeof DOWN };
    for (let i = 0; i < 8; i++) pose = { ...walkSlice(wall, pose, degreesOfDir(RIGHT), slice) };
    // o pé (0,6 de largura) encosta na parede que começa em x = 3
    expect(pose.x + 0.5 + BODY_HALF_W).toBeCloseTo(3, 4);
    expect(footTile(pose.x, pose.y).x).toBe(2);
    const again = walkSlice(wall, pose, degreesOfDir(RIGHT), slice);
    expect(again.moved).toBe(false);
  });

  it('desliza encostado na parede quando anda na diagonal', () => {
    const wall = GameMap.fromTiled(tiledFromAscii(['...#..', '...#..', '...#..', '......'], { x: 0, y: 0 }));
    const start = { x: 2.2, y: 0, dir: DOWN as typeof DOWN }; // já encostado na parede da direita
    const pose = walkSlice(wall, start, degreesOfDir(DOWN_RIGHT), slice);
    expect(pose.y).toBeGreaterThan(start.y); // desceu
    expect(pose.x).toBeCloseTo(start.x, 4); // sem entrar na parede
  });

  it('escorrega na quina para entrar numa passagem estreita (não trava de raspão)', () => {
    // parede com um vão de 1 tile em x = 2
    const gap = GameMap.fromTiled(tiledFromAscii(['.....', '##.##', '.....', '.....'], { x: 0, y: 0 }));
    let pose = { x: 1.7, y: 0, dir: DOWN as typeof DOWN }; // um pouco à esquerda do vão
    for (let i = 0; i < 12; i++) pose = { ...walkSlice(gap, pose, degreesOfDir(DOWN), slice) };
    expect(footTile(pose.x, pose.y).y).toBeGreaterThanOrEqual(2); // passou pelo vão
    expect(footTile(pose.x, pose.y).x).toBe(2);
  });

  it('não passa espremido entre duas paredes na diagonal', () => {
    const squeeze = GameMap.fromTiled(tiledFromAscii(['.#.', '#..', '...'], { x: 0, y: 0 }));
    let pose = { x: 0, y: 0, dir: DOWN as typeof DOWN };
    for (let i = 0; i < 8; i++) pose = { ...walkSlice(squeeze, pose, degreesOfDir(DOWN_RIGHT), slice) };
    expect(footTile(pose.x, pose.y)).toEqual({ x: 0, y: 0 });
  });

  it('a esquiva rola 3 tiles em qualquer direção e para encostada no que tiver no caminho', () => {
    expect(sweepBody(open, { x: 0, y: 0, dir: DOWN }, degreesOfDir(RIGHT), 3)).toEqual({ x: 3, y: 0, dir: RIGHT, moved: true });
    const diagonal = sweepBody(open, { x: 0, y: 0, dir: DOWN }, degreesOfDir(DOWN_RIGHT), 3);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(3, 2);
    const wall = GameMap.fromTiled(tiledFromAscii(['....#.'], { x: 0, y: 0 }));
    const stopped = sweepBody(wall, { x: 0, y: 0, dir: DOWN }, degreesOfDir(RIGHT), 3);
    expect(footTile(stopped.x, stopped.y).x).toBe(3);
    // colado na parede: não conta como esquiva e não sai do lugar
    const stuck = sweepBody(wall, { x: 3.1, y: 0, dir: DOWN }, degreesOfDir(RIGHT), 3);
    expect(stuck).toMatchObject({ x: 3.1, y: 0, moved: false });
  });

  it('o tile de quem está entre dois tiles é o do centro da caixa do pé', () => {
    expect(footTile(2, 3)).toEqual({ x: 2, y: 3 });
    expect(footTile(2.49, 3.19)).toEqual({ x: 2, y: 3 });
    expect(footTile(2.5, 3.2)).toEqual({ x: 3, y: 4 }); // a caixa do pé já passou mais da metade para o tile de baixo
    expect(footTile(-0.2, 0)).toEqual({ x: 0, y: 0 });
  });

  it('a caixa do pé fica onde o pé é desenhado: na faixa de baixo do tile', () => {
    // parado no tile (2, 2), a beirada de baixo da caixa é a beirada de baixo do tile (onde o desenho põe o pé)
    expect(2 + 0.5 + BODY_OFFSET_Y + BODY_HALF_H).toBeCloseTo(3, 9);
    // chegando por baixo de uma parede, o pé para perto dela (0,4 tile), não a um tile inteiro
    const wall = GameMap.fromTiled(tiledFromAscii(['...', '#.#', '...', '...'], { x: 1, y: 3 }));
    const blocked = GameMap.fromTiled(tiledFromAscii(['...', '###', '...', '...'], { x: 1, y: 3 }));
    let pose = { x: 1, y: 3, dir: DOWN as typeof DOWN };
    for (let i = 0; i < 8; i++) pose = { ...walkSlice(blocked, pose, degreesOfDir(UP), slice) };
    const feet = pose.y + 1; // onde o pé é desenhado
    expect(feet - 2).toBeCloseTo(2 * BODY_HALF_H, 4); // a parede termina em y = 2
    expect(wall.isWalkable(1, 1)).toBe(true);
  });
});
