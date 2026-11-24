// Os saguis raros (forma B, aprovada pelo dono em 24/11: "pode fazer a B"): o Sagui Corrompido (Elite) e o Sagui
// Ancestral (Raro), cada um com um lugar próprio no mapa (a área com o nome da chave na camada `monstros`, marcada
// pelo [mundo]), um de cada, demorando para voltar (4 e 12 minutos). Fazem tudo que o sagui comum faz (a fruta, o galho);
// o nome aparece com "(Elite)" ou "(Raro)" e a fruta sai com a cor do desenho da [arte] (roxa e dourada).

import { describe, expect, it } from 'vitest';
import { loadItemDefs } from '../src/server/items';
import { checkDrops, loadMonsterDefs, parseMonsterDefs } from '../src/server/monsters';
import { loadMaps } from '../src/server/server';
import { World } from '../src/server/world';
import { TICK_MS } from '../src/shared/constants';
import { GameMap, type TiledMap, type TiledObject } from '../src/shared/map';
import { SHOT_BALLS } from '../src/client/novo/combat';
import { FakeClock, FakeConn } from './helpers';

const monsters = loadMonsterDefs();
const PX = 32;

describe('os dados dos saguis raros (data/monsters.json)', () => {
  it('os números aprovados pelo dono', () => {
    const corrompido = monsters.get('sagui_corrompido')!;
    expect(corrompido).toMatchObject({ name: 'Sagui Corrompido', rank: 'elite', level: 3, hp: 66, xp: 30, gold: [5, 10], respawnMs: 240_000 });
    expect(corrompido.attack).toMatchObject({ kind: 'projectile', damage: [3, 6], intervalMs: 1400, projectile: 'fruta_podre' });
    expect(Object.fromEntries(corrompido.drops.map((d) => [d.item, d.chance]))).toEqual({ banana: 60, garrafada_pequena: 20, chapeu_palha: 10, estilingue_goiabeira: 12 });

    const ancestral = monsters.get('sagui_ancestral')!;
    expect(ancestral).toMatchObject({ name: 'Sagui Ancestral', rank: 'raro', level: 4, hp: 100, xp: 60, gold: [12, 25], respawnMs: 720_000 });
    expect(ancestral.attack).toMatchObject({ kind: 'projectile', damage: [4, 7], intervalMs: 1500, projectile: 'fruta_dourada' });
    // a jurubeba (a Garrafada Grande) de dia: 30%
    expect(Object.fromEntries(ancestral.drops.map((d) => [d.item, d.chance]))).toEqual({ banana: 70, garrafada: 20, estilingue_goiabeira: 25, jurubeba: 30 });

    // sobem no galho como o comum; o comum continua o mesmo
    expect(corrompido.branch).toEqual(monsters.get('sagui')!.branch);
    expect(ancestral.branch).toEqual(monsters.get('sagui')!.branch);
    expect(monsters.get('sagui')).toMatchObject({ rank: null, hp: 22, xp: 8 });
    expect(() => checkDrops(monsters, loadItemDefs())).not.toThrow();
  });

  it('a "categoria" é conferida (elite ou raro)', () => {
    const base = { nome: 'B', nivel: 1, vida: 10, xp: 1, passoMs: 300, ataque: { tipo: 'mordida', preparoMs: 100, intervaloMs: 500, dano: [1, 2] } };
    expect(parseMonsterDefs({ b: { ...base, categoria: 'Elite' } }).get('b')!.rank).toBe('elite');
    expect(parseMonsterDefs({ b: base }).get('b')!.rank).toBeNull();
    expect(() => parseMonsterDefs({ b: { ...base, categoria: 'chefe' } })).toThrow(/"categoria" "chefe" não existe. Use: elite ou raro/);
  });

  it('só no mundo novo (os mapas antigos não têm a área deles)', () => {
    for (const map of loadMaps()) {
      if (map.metric) continue;
      expect(map.monsterZones.some((z) => z.monster.startsWith('sagui_')), map.id).toBe(false);
    }
  });

  it('o painel do administrador mostra os dois (com os números do galho)', async () => {
    const { Tuning } = await import('../src/server/tuning');
    const list = Tuning.load(null, loadMaps()).view().grupos.find((g) => g.arquivo === 'monstros')!.lista;
    for (const id of ['sagui_corrompido', 'sagui_ancestral']) {
      const campos = list.find((m) => m.id === id)!.campos.map((c) => c.campo);
      expect(campos).toEqual(expect.arrayContaining(['vida', 'ataque.dano', 'renascerMs', 'galho.desceA']));
    }
  });
});

describe('no navegador: a fruta de cada um', () => {
  it('a do Corrompido é roxa com brilho vermelho; a do Ancestral, dourada com brilho claro; a do comum, a verde de sempre', () => {
    expect(SHOT_BALLS.fruta_podre).toMatchObject({ fill: '#5a2346', glow: expect.stringContaining('255, 90, 70') });
    expect(SHOT_BALLS.fruta_dourada).toMatchObject({ fill: '#f2c14e', glow: expect.stringContaining('255, 226, 120') });
    expect(SHOT_BALLS.fruta).toEqual({ fill: '#c9e265', stroke: '#4f6b12' });
    // toda fruta que os bichos jogam tem a sua bolinha
    for (const def of monsters.values()) {
      if (def.attack.projectile.startsWith('fruta')) expect(SHOT_BALLS[def.attack.projectile], def.id).toBeDefined();
    }
  });
});

// ---------- no mundo ----------

/** Mapa do formato novo com a área de um sagui raro (1 tile = 1 m) e, se pedir, um galho perto. */
function home(id: string, withBranch = false): TiledMap {
  const spawn: TiledObject = { id: 1, name: 'spawn', x: 2 * PX, y: 2 * PX, point: true };
  const area: TiledObject = { id: 2, name: id, x: 10 * PX, y: 4 * PX, width: 6 * PX, height: 6 * PX, properties: [{ name: 'quantidade', type: 'int', value: 1 }] };
  const branch: TiledObject = {
    id: 3,
    name: '',
    type: 'galho-sagui',
    x: 13.5 * PX,
    y: 8 * PX,
    point: true,
    properties: [{ name: 'altura', type: 'float', value: 2.3 }],
  };
  return {
    width: 30,
    height: 16,
    tilewidth: PX,
    tileheight: PX,
    orientation: 'orthogonal',
    tilesets: [],
    layers: [
      { type: 'objectgroup', name: 'monstros', objects: [area] },
      { type: 'objectgroup', name: 'pontos', objects: withBranch ? [spawn, branch] : [spawn] },
    ],
  } as TiledMap;
}

function setup(id: string, withBranch = false) {
  const clock = new FakeClock();
  let seed = 11;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const world = new World(GameMap.fromTiled(home(id, withBranch), 'casa'), { now: clock.now, random, monsters });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  Object.assign(joined.player, { fx: 1, fy: 1, x: 1, y: 1 }); // longe: vê, mas não é percebida
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  run(TICK_MS * 2);
  return { world, clock, conn, player: joined.player, run, alive: () => [...world.monsters.values()] };
}

type Inner = { damage(target: unknown, amount: number, by: number, now: number): void };

describe('os saguis raros no mundo', () => {
  it('um de cada no lugar dele; quem vê recebe a categoria (o nome ganha "(Elite)" / "(Raro)" no navegador)', () => {
    for (const [id, rank] of [['sagui_corrompido', 'elite'], ['sagui_ancestral', 'raro']] as const) {
      const { conn, alive } = setup(id);
      expect(alive()).toHaveLength(1);
      const spawn = conn.ofType('spawn').find((m) => m.e.kind === 'monster')!;
      expect(spawn.e).toMatchObject({ type: id, rank });
    }
    // o comum continua sem categoria
    const { conn } = setup('sagui');
    expect(conn.ofType('spawn').find((m) => m.e.kind === 'monster')!.e.rank).toBeUndefined();
  });

  it('derrubado, demora para voltar: 4 minutos o Corrompido, 12 o Ancestral', () => {
    for (const [id, minutes] of [['sagui_corrompido', 4], ['sagui_ancestral', 12]] as const) {
      const { world, clock, player, run, alive } = setup(id);
      (world as unknown as Inner).damage(alive()[0], 999, player.id, clock.now());
      expect(alive()).toHaveLength(0);
      run(minutes * 60_000 - 2000);
      expect(alive(), `${id} antes da hora`).toHaveLength(0);
      run(3000);
      expect(alive(), `${id} na hora`).toHaveLength(1);
    }
  });

  it('sobem no galho como o comum', () => {
    for (const id of ['sagui_corrompido', 'sagui_ancestral']) {
      const { run, alive } = setup(id, true);
      run(15_000);
      expect(alive()[0]!.perch, id).not.toBeNull();
    }
  });
});
