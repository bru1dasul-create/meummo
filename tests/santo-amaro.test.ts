// Criaturas das Ruínas de Santo Amaro: a investida (com rastro de fogo) e os dados de verdade.

import { beforeEach, describe, expect, it } from 'vitest';
import { loadItemDefs } from '../src/server/items';
import { checkDrops, loadMonsterDefs, parseMonsterDefs } from '../src/server/monsters';
import { loadMap } from '../src/server/server';
import { World, type Monster, type Player } from '../src/server/world';
import { DASH_INVULNERABLE_MS, TICK_MS } from '../src/shared/constants';
import { GameMap } from '../src/shared/map';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

const MULA = {
  nome: 'Mula de Teste',
  nivel: 8,
  vida: 500,
  xp: 10,
  passoMs: 1e9, // não anda: assim o teste controla onde ela está
  agressivo: true,
  alcanceAgressao: 8,
  perseguicao: 30,
  renascerMs: 1000,
  ataque: { tipo: 'investida', alcance: 6, preparoMs: 500, intervaloMs: 5000, dano: [10, 10], rastroFogo: { duracaoMs: 1000, dano: [3, 3] } },
};
const defs = parseMonsterDefs({ mula: MULA });

let clock: FakeClock;
beforeEach(() => {
  clock = new FakeClock();
});

/** Corredor aberto; a mula nasce em (2, 1). */
function arena(rows = ['.'.repeat(14), '.'.repeat(14), '.'.repeat(14)]): World {
  const map = GameMap.fromTiled(tiledFromAscii(rows, { x: 12, y: 2 }, [{ monster: 'mula', x: 2, y: 1, w: 1, h: 1 }]));
  return new World(map, { now: clock.now, random: () => 0, monsters: defs });
}

function join(world: World, name: string, x: number, y: number): { player: Player; conn: FakeConn } {
  const conn = new FakeConn();
  const result = world.join(name, conn);
  if (!result.ok) throw new Error(result.reason);
  result.player.x = x;
  result.player.y = y;
  return { player: result.player, conn };
}

function run(world: World, ms: number): void {
  for (let t = 0; t < ms; t += TICK_MS) {
    clock.advance(TICK_MS);
    world.tick();
  }
}

const mula = (world: World): Monster => [...world.monsters.values()][0]!;

/** Avança o relógio até a condição valer (ou desiste depois de `maxMs`). */
function runUntil(world: World, condition: () => boolean, maxMs = 3000): void {
  for (let t = 0; t < maxMs && !condition(); t += TICK_MS) {
    clock.advance(TICK_MS);
    world.tick();
  }
  if (!condition()) throw new Error('não aconteceu a tempo');
}

describe('investida (Mula sem Cabeça)', () => {
  it('lê o tipo "investida" e o rastro de fogo do data/monsters.json', () => {
    expect(defs.get('mula')!.attack).toMatchObject({ kind: 'charge', range: 6, fire: { durationMs: 1000, damage: [3, 3] } });
    expect(() => parseMonsterDefs({ x: { ...MULA, ataque: { ...MULA.ataque, rastroFogo: { duracaoMs: 50, dano: [1, 2] } } } })).toThrow(/duracaoMs/);
  });

  it('avisa a linha no chão, atropela quem está nela e corre até o fim', () => {
    const world = arena();
    const ana = join(world, 'Ana', 6, 1);
    runUntil(world, () => ana.conn.ofType('warn').length > 0);
    expect(ana.conn.ofType('warn')[0]?.tiles).toEqual([2, 1, 3, 1, 4, 1, 5, 1, 6, 1, 7, 1, 8, 1]); // 6 tiles na direção da Ana
    expect(mula(world)).toMatchObject({ x: 2, y: 1 }); // ainda preparando
    runUntil(world, () => ana.conn.ofType('fire').length > 0);
    expect(ana.player.hp).toBe(ana.player.maxHp - 10); // atropelada
    expect(mula(world)).toMatchObject({ x: 8, y: 1 });
    expect(ana.conn.ofType('fx').some((f) => f.kind === 'charge' && f.r === 6)).toBe(true);
    expect(ana.conn.ofType('move').some((m) => m.id === mula(world).id && m.dash === true && m.x === 8)).toBe(true);
  });

  it('para antes da parede e nunca em cima de alguém', () => {
    const wall = arena(['.'.repeat(14), '......#.......', '.'.repeat(14)]);
    const ana = join(wall, 'Ana', 5, 1);
    runUntil(wall, () => ana.conn.ofType('fire').length > 0);
    expect(mula(wall)).toMatchObject({ x: 4, y: 1 }); // a parede em (6,1) corta a linha e a Ana está em (5,1)

    const world = arena();
    const beto = join(world, 'Beto', 8, 1); // bem no fim da linha
    runUntil(world, () => beto.conn.ofType('fire').length > 0);
    expect(mula(world)).toMatchObject({ x: 7, y: 1 });
    expect(beto.player.hp).toBeLessThan(beto.player.maxHp);
  });

  it('deixa o chão pegando fogo: queima quem fica, não quem sai (e a esquiva protege)', () => {
    const world = arena();
    const ana = join(world, 'Ana', 6, 1);
    const caio = join(world, 'Caio', 13, 0); // longe da linha
    runUntil(world, () => ana.conn.ofType('fire').length > 0); // a investida acontece
    const fire = ana.conn.ofType('fire')[0];
    expect(fire).toMatchObject({ ms: 1000 });
    expect(fire!.tiles).toContain(4);

    // Caio pisa no fogo e fica; Ana sai da linha
    caio.player.x = 4;
    caio.player.y = 1;
    ana.player.x = 6;
    ana.player.y = 2;
    const anaHp = ana.player.hp;
    const caioHp = caio.player.hp;
    run(world, 1100);
    expect(ana.player.hp).toBe(anaHp);
    const burns = caio.conn.ofType('hit').filter((h) => h.id === caio.player.id);
    expect(burns.length).toBeGreaterThanOrEqual(2); // 350 ms e depois a cada 500 ms
    expect(burns.every((h) => h.dmg === 3)).toBe(true);
    expect(caio.player.hp).toBe(caioHp - 3 * burns.length);

    // depois que apaga, não queima mais
    const after = caio.player.hp;
    run(world, 1000);
    expect(caio.player.hp).toBe(after);
  });

  it('quem está esquivando (invencível) atravessa o fogo sem se queimar', () => {
    const world = arena();
    const ana = join(world, 'Ana', 6, 1);
    runUntil(world, () => ana.conn.ofType('fire').length > 0);
    ana.player.x = 6;
    ana.player.y = 2; // sai do fogo
    const dani = join(world, 'Dani', 5, 1);
    dani.player.invulnerableUntil = clock.now() + DASH_INVULNERABLE_MS + 1000;
    const hp = dani.player.hp;
    run(world, 900);
    expect(dani.player.hp).toBe(hp);
  });
});

describe('Santo Amaro de verdade', () => {
  it('as criaturas e os itens novos estão nos dados, e toda área do mapa cria todos os seus bichos', () => {
    const monsters = loadMonsterDefs();
    const items = loadItemDefs();
    expect(() => checkDrops(monsters, items)).not.toThrow();
    for (const id of ['corpo_seco', 'capelobo', 'mula_sem_cabeca']) expect(monsters.has(id)).toBe(true);
    expect(monsters.get('mula_sem_cabeca')!.attack.kind).toBe('charge');
    for (const id of ['erva_arruda', 'sucata', 'faca_sucata', 'couraca_lata', 'ferradura_brasa']) expect(items.has(id)).toBe(true);

    const map = loadMap('santo-amaro');
    const world = new World(map, { monsters, items });
    const kinds = new Set(map.monsterZones.map((z) => z.monster));
    expect([...kinds].sort()).toEqual(['capelobo', 'corpo_seco', 'mula_sem_cabeca']);
    for (const zone of world.zones) expect(zone.alive.size).toBe(zone.zone.count);
    // quem acabou de chegar pela avenida não está na mira de ninguém
    const arrival = map.points.get('oeste')!;
    for (const monster of world.monsters.values()) {
      const distance = Math.max(Math.abs(monster.x - arrival.x), Math.abs(monster.y - arrival.y));
      expect(distance, `${monster.def.id} em (${monster.x}, ${monster.y})`).toBeGreaterThan(monster.def.aggroRange);
    }
  });
});
