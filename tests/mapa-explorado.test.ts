// O mapa explorado (pedido do dono, 14/11: "o M abre o mapa completo, que só mostra o que você já andou"): o mapa do
// mundo novo é dividido em quadradinhos de 4 m; o que fica a até 12 m do seu pé vira explorado, o navegador recebe os
// novos e tudo fica salvo no personagem.

import { describe, expect, it } from 'vitest';
import { characterData, World } from '../src/server/world';
import { TICK_MS } from '../src/shared/constants';
import { cellAt, decodeGrid, encodeGrid, exploreGrid, exploredCount, EXPLORE_CELL, isExplored, revealAround } from '../src/shared/explore';
import { GameMap, type TiledObject } from '../src/shared/map';
import { cornerAtFeet } from '../src/shared/movement';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

describe('a grade do mapa explorado', () => {
  it('quadradinhos de 4 m; o que está a até 12 m do pé fica explorado (uma vez só)', () => {
    const grid = exploreGrid(96, 180);
    expect(grid).toMatchObject({ cols: 24, rows: 45 });
    const fresh = revealAround(grid, 50, 50);
    expect(fresh.length).toBeGreaterThan(20);
    expect(isExplored(grid, cellAt(grid, 50, 50))).toBe(true);
    expect(isExplored(grid, cellAt(grid, 61, 50))).toBe(true); // 11 m
    expect(isExplored(grid, cellAt(grid, 50, 66))).toBe(false); // 16 m
    expect(revealAround(grid, 50, 50)).toEqual([]); // já estava
    expect(exploredCount(grid)).toBe(fresh.length);
  });

  it('vira texto e volta igual; texto estragado vira grade vazia', () => {
    const grid = exploreGrid(96, 120);
    revealAround(grid, 10, 10);
    revealAround(grid, 80, 100);
    const back = decodeGrid(encodeGrid(grid), 96, 120);
    expect(back.bits).toEqual(grid.bits);
    expect(exploredCount(decodeGrid('lixo', 96, 120))).toBe(0);
    expect(exploredCount(decodeGrid('24:%%%', 96, 120))).toBe(0);
    expect(exploredCount(decodeGrid(null, 96, 120))).toBe(0);
  });

  it('o mapa cresceu (o Capão ganhando a mata do sul): o que já foi visto fica no mesmo lugar', () => {
    const old = exploreGrid(96, 120);
    revealAround(old, 20, 100);
    const grown = decodeGrid(encodeGrid(old), 96, 180);
    expect(grown.rows).toBe(45);
    expect(isExplored(grown, cellAt(grown, 20, 100))).toBe(true);
    expect(exploredCount(grown)).toBe(exploredCount(old));
    // e ficou mais estreito: o que sai do mapa some, o resto fica no lugar
    const wide = exploreGrid(96, 120);
    revealAround(wide, 90, 10);
    revealAround(wide, 10, 10);
    const narrow = decodeGrid(encodeGrid(wide), 40, 120);
    expect(isExplored(narrow, cellAt(narrow, 10, 10))).toBe(true);
    expect(exploredCount(narrow)).toBeLessThan(exploredCount(wide));
  });
});

// ---------- no mundo ----------

const PX = 32;

/** Mapa do formato novo (1 tile = 1 metro), aberto, 60 × 40 m. */
function metricMap(): GameMap {
  const spawn: TiledObject = { id: 0, name: 'spawn', x: 10 * PX, y: 10 * PX, point: true };
  return GameMap.fromTiled(
    {
      width: 60,
      height: 40,
      tilewidth: PX,
      tileheight: PX,
      orientation: 'orthogonal',
      properties: [{ name: 'nome', type: 'string', value: 'Teste' }],
      tilesets: [],
      layers: [
        { type: 'objectgroup', name: 'colisao', objects: [] },
        { type: 'objectgroup', name: 'pontos', objects: [spawn] },
      ],
    },
    'teste',
  );
}

function setup(saved?: Record<string, string>) {
  const clock = new FakeClock();
  const world = new World(metricMap(), { now: clock.now, random: () => 0 });
  const conn = new FakeConn();
  const character = { id: 1, name: 'Ana', level: 1, xp: 0, hp: null, zone: null, x: null, y: null, dir: 0 as const, look: 1, inventory: null, explored: saved ?? null };
  const joined = world.join('Ana', conn, { character, created: false });
  if (!joined.ok) throw new Error(joined.reason);
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  return { world, conn, player: joined.player, run };
}

describe('o mapa explorado no jogo', () => {
  it('as boas-vindas trazem o explorado do mapa, já com o que se vê de onde ele nasceu', () => {
    const { conn } = setup();
    const text = conn.ofType('welcome')[0]!.explored!;
    const grid = decodeGrid(text, 60, 40);
    expect(isExplored(grid, cellAt(grid, 10.5, 10.5))).toBe(true);
    expect(isExplored(grid, cellAt(grid, 50, 30))).toBe(false);
  });

  it('andando, o navegador recebe os quadradinhos novos; e eles ficam no que é salvo', () => {
    const { conn, player, run } = setup();
    run(TICK_MS * 2);
    const corner = cornerAtFeet(45, 30); // longe de onde nasceu
    Object.assign(player, { fx: corner.x, fy: corner.y, x: Math.floor(corner.x), y: Math.floor(corner.y) });
    run(600);
    const cells = conn.ofType('explored').flatMap((m) => m.cells);
    expect(cells.length).toBeGreaterThan(10);
    const grid = exploreGrid(60, 40);
    expect(cells).toContain(cellAt(grid, 45, 30));
    const saved = characterData(player, 'teste').explored!;
    expect(isExplored(decodeGrid(saved.teste, 60, 40), cellAt(grid, 45, 30))).toBe(true);
  });

  it('volta com o que já tinha explorado (e guarda os mapas por onde não passou desta vez)', () => {
    const before = exploreGrid(60, 40);
    revealAround(before, 50, 35);
    const { conn, player } = setup({ teste: encodeGrid(before), outro: '10:AA==' });
    const grid = decodeGrid(conn.ofType('welcome')[0]!.explored, 60, 40);
    expect(isExplored(grid, cellAt(grid, 50, 35))).toBe(true);
    expect(characterData(player, 'teste').explored!.outro).toBe('10:AA==');
  });

  it('nos mapas de antes (vistos de cima) não tem mapa explorado', () => {
    const clock = new FakeClock();
    const world = new World(GameMap.fromTiled(tiledFromAscii(['.'.repeat(8), '.'.repeat(8)], { x: 1, y: 1 })), { now: clock.now });
    const conn = new FakeConn();
    world.join('Ana', conn);
    expect(conn.ofType('welcome')[0]!.explored).toBeUndefined();
    expect(EXPLORE_CELL).toBe(4);
  });
});
