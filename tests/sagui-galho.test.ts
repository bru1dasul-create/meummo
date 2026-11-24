// O Sagui no galho (opção 3 do dono, 23/11: "pode fazer, só no Capão por enquanto"): calmo, o sagui vai até um galho
// livre (os pontos `galho-sagui` do mapa, um sagui por galho), sobe e fica pendurado, jogando a fruta lá de cima em quem
// chega ao alcance. Quando alguém chega a 3 m ou acerta nele, pula para o chão e luta normal; calmo de novo por 8 s, sobe
// outra vez. Subindo (0,72 s) e descendo (0,56 s) ele não faz mais nada: é o tempo do desenho da [arte]. Mapa sem galho:
// tudo como antes.

import { describe, expect, it } from 'vitest';
import { loadMonsterDefs, parseMonsterDefs } from '../src/server/monsters';
import { World, type Player } from '../src/server/world';
import { PERCH_CLIMB_MS, PERCH_DESCEND_MS, TICK_MS } from '../src/shared/constants';
import { GameMap, type TiledMap, type TiledObject } from '../src/shared/map';
import { cornerAtFeet, feetAt, footTile } from '../src/shared/movement';
import { FakeClock, FakeConn } from './helpers';
import { loadMaps } from '../src/server/server';
import { SHOT_DRAW_Z, shotZ, throwZ } from '../src/client/novo/combat';

const PX = 32;
const monsters = loadMonsterDefs();

/** Um galho no Tiled: o ponto no chão embaixo dele (metros), com a altura e a direção. */
function branch(id: number, x: number, y: number, altura?: unknown, direcao?: unknown): TiledObject {
  const properties = [
    ...(altura !== undefined ? [{ name: 'altura', type: 'float', value: altura }] : []),
    ...(direcao !== undefined ? [{ name: 'direcao', type: 'float', value: direcao }] : []),
  ];
  return { id, name: '', type: 'galho-sagui', x: x * PX, y: y * PX, point: true, ...(properties.length ? { properties } : {}) };
}

/** Mapa do formato novo (1 tile = 1 m), aberto, com a área dos saguis de (10, 4) a (17, 11) e os galhos dados. */
function grove(branches: TiledObject[], count = 1, extra: TiledObject[] = []): TiledMap {
  const spawn: TiledObject = { id: 1, name: 'spawn', x: 2 * PX, y: 2 * PX, point: true };
  const area: TiledObject = { id: 2, name: 'sagui', x: 10 * PX, y: 4 * PX, width: 8 * PX, height: 8 * PX, properties: [{ name: 'quantidade', type: 'int', value: count }] };
  return {
    width: 40,
    height: 24,
    tilewidth: PX,
    tileheight: PX,
    orientation: 'orthogonal',
    properties: [{ name: 'nome', type: 'string', value: 'Bosque' }],
    tilesets: [],
    layers: [
      { type: 'objectgroup', name: 'colisao', objects: extra },
      { type: 'objectgroup', name: 'monstros', objects: [area] },
      { type: 'objectgroup', name: 'pontos', objects: [spawn, ...branches] },
    ],
  } as TiledMap;
}

/** Sorteio repetível (o mesmo em toda rodada do teste), mas variado (os saguis nascem em tiles diferentes). */
function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Inner = { damage(target: unknown, amount: number, by: number, now: number, travel?: number): void };

/** Galhos de teste: um a leste (2,2 m, apontando para o leste) e um a oeste (2,0 m, apontando para o oeste). */
const EAST = { x: 14.5, y: 8, h: 2.2, a: 0 };
const WEST = { x: 11.5, y: 10, h: 2, a: 180 };

function setup(opts: { branches?: TiledObject[]; count?: number } = {}) {
  const clock = new FakeClock();
  const branches = opts.branches ?? [branch(10, EAST.x, EAST.y, EAST.h, EAST.a), branch(11, WEST.x, WEST.y, WEST.h, WEST.a)];
  const map = GameMap.fromTiled(grove(branches, opts.count ?? 1), 'bosque');
  const world = new World(map, { now: clock.now, random: seeded(), monsters });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  place(player, 2, 2); // longe: vê os saguis (a visão vai a 20 m), mas eles não percebem
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  /** Roda até `done` (ou o tempo acabar). */
  const until = (done: () => boolean, ms = 20_000) => {
    for (let t = 0; t < ms && !done(); t += TICK_MS) run(TICK_MS);
    return done();
  };
  const saguis = () => [...world.monsters.values()];
  return { world, clock, conn, player, run, until, saguis, map, inner: world as unknown as Inner };
}

/** Põe o jogador na posição "de canto" (x, y) (metros); o tile do pé (`player.x`/`y`) vem disso. */
function place(player: Player, x: number, y: number): void {
  player.fx = x;
  player.fy = y;
}

/** Põe o jogador com o pé a `distance` metros a leste (e na mesma linha) do chão embaixo do sagui. */
function standEastOf(player: Player, sagui: { x: number; y: number }, distance: number): void {
  const feet = feetAt(sagui.x, sagui.y);
  const corner = cornerAtFeet(feet.x + distance, feet.y);
  place(player, corner.x, corner.y);
}

describe('o mapa: os galhos do sagui (camada pontos, tipo galho-sagui)', () => {
  it('de que tile se sobe: o de baixo, ou o andável mais perto (o de baixo pode encostar no tronco)', () => {
    const trunk: TiledObject = { id: 20, x: 14 * PX, y: 7.2 * PX, width: 0.5 * PX, height: 0.5 * PX }; // encosta no tile (14, 7)
    const open = GameMap.fromTiled(grove([branch(10, 14.5, 8)]), 'bosque');
    expect(open.branchTile(0)).toEqual({ x: 14, y: 7 });
    const blocked = GameMap.fromTiled(grove([branch(10, 14.5, 8)], 1, [trunk]), 'bosque');
    expect(blocked.isWalkable(14, 7)).toBe(false);
    const tile = blocked.branchTile(0)!;
    expect(Math.max(Math.abs(tile.x - 14), Math.abs(tile.y - 7))).toBe(1);
    expect(blocked.isWalkable(tile.x, tile.y)).toBe(true);
    expect(open.branchTile(5)).toBeNull(); // não existe
  });

  it('lê o chão embaixo do galho (metros), a altura e a direção', () => {
    const map = GameMap.fromTiled(grove([branch(10, 14.5, 8, 2.2, 0), branch(11, 11.5, 10, 2, -90), branch(12, 16, 6)]), 'bosque');
    expect(map.branches).toEqual([
      { x: 14.5, y: 8, height: 2.2, angle: 0 },
      { x: 11.5, y: 10, height: 2, angle: 270 }, // -90 vira 270 (para o norte)
      { x: 16, y: 6, height: 2.2, angle: 90 }, // sem altura e direção: 2,2 m, para o sul
    ]);
    // não é ponto de chegada (nem precisa de nome)
    expect(map.spots.size).toBe(1);
  });

  it('o galho com dono: a propriedade "bicho" (a chave do monstro)', () => {
    const owned = { ...branch(12, 16, 6, 2.3, 110), properties: [...branch(12, 16, 6, 2.3, 110).properties!, { name: 'bicho', type: 'string', value: 'Sagui_Ancestral ' }] };
    const map = GameMap.fromTiled(grove([branch(10, 14.5, 8), owned]), 'bosque');
    expect(map.branches.map((b) => b.owner)).toEqual([undefined, 'sagui_ancestral']);
    const wrong = { ...owned, properties: [{ name: 'bicho', type: 'string', value: '' }] };
    expect(() => GameMap.fromTiled(grove([wrong]), 'bosque')).toThrow(/"bicho" é a chave do monstro dono do galho/);
  });

  it('a altura errada dá erro em português (220 seria em centímetros)', () => {
    expect(() => GameMap.fromTiled(grove([branch(10, 14.5, 8, 220)]), 'bosque')).toThrow(/"altura" é em metros, de 1 a 4/);
    expect(() => GameMap.fromTiled(grove([branch(10, 14.5, 8, 'alto')]), 'bosque')).toThrow(/galho do sagui \(objeto 10\) do mapa "bosque"/);
    expect(() => GameMap.fromTiled(grove([branch(10, 14.5, 8, 2, 'leste')]), 'bosque')).toThrow(/"direcao" é em graus/);
  });

  it('os mapas de hoje carregam (e cada galho do Capão tem chão embaixo, perto da área de quem sobe nele)', () => {
    const maps = loadMaps();
    const capao = maps.find((m) => m.id === 'capao')!;
    capao.branches.forEach((b, i) => {
      // galho com dono (`bicho`: o do Sagui Ancestral, o do Corrompido): perto da área dele; sem dono, da dos saguis
      const zone = capao.monsterZones.find((z) => z.monster === (b.owner ?? 'sagui'));
      expect(zone, `a área de quem sobe no galho em (${b.x}, ${b.y})`).toBeDefined();
      if (!zone) return;
      if (b.owner) expect(monsters.get(b.owner)?.branch, `${b.owner} sobe em galho`).toBeTruthy();
      // o tile de onde ele sobe: bem perto do chão embaixo do galho (o pulo da [arte] vai de uma casa ao lado)
      const tile = capao.branchTile(i);
      expect(tile, `galho em (${b.x}, ${b.y})`).not.toBeNull();
      const under = cornerAtFeet(b.x, b.y);
      expect(Math.hypot(tile!.x - under.x, tile!.y - under.y)).toBeLessThan(1.5);
      expect(b.height).toBeGreaterThanOrEqual(1.8);
      expect(b.height).toBeLessThanOrEqual(2.6);
      expect(b.x).toBeGreaterThanOrEqual(zone.x - 1);
      expect(b.x).toBeLessThanOrEqual(zone.x + zone.w + 1);
      expect(b.y).toBeGreaterThanOrEqual(zone.y - 1);
      expect(b.y).toBeLessThanOrEqual(zone.y + zone.h + 2);
    });
    // só no Capão por enquanto (pedido do dono)
    for (const map of maps) if (map.id !== 'capao') expect(map.branches, map.id).toEqual([]);
  });
});

describe('os dados: o "galho" do sagui (data/monsters.json)', () => {
  it('o sagui desce a 3 m e sobe de novo depois de 8 s calmo', () => {
    expect(monsters.get('sagui')!.branch).toEqual({ descendRange: 3, climbAfterMs: 8000 });
    expect(monsters.get('jararaca')!.branch).toBeNull();
  });

  it('é conferido: só quem joga de longe sobe no galho; os números não podem ser negativos', () => {
    const base = { nome: 'B', nivel: 1, vida: 10, xp: 1, passoMs: 300 };
    const throws = { tipo: 'projetil', preparoMs: 300, intervaloMs: 1500, dano: [1, 2] };
    expect(() => parseMonsterDefs({ b: { ...base, ataque: { tipo: 'mordida', preparoMs: 100, intervaloMs: 500, dano: [1, 2] }, galho: {} } })).toThrow(
      /só quem joga de longe \("tipo": "projetil"\) sobe no galho/,
    );
    expect(() => parseMonsterDefs({ b: { ...base, ataque: throws, galho: { desceA: -1 } } })).toThrow(/"desceA" precisa ser pelo menos 0/);
    expect(parseMonsterDefs({ b: { ...base, ataque: throws, galho: {} } }).get('b')!.branch).toEqual({ descendRange: 3, climbAfterMs: 8000 });
  });

  it('o painel do administrador mostra os números do galho (só de quem sobe)', async () => {
    const { Tuning } = await import('../src/server/tuning');
    const tuning = Tuning.load(null, loadMaps());
    const list = tuning.view().grupos.find((g) => g.arquivo === 'monstros')!.lista;
    const sagui = list.find((m) => m.id === 'sagui')!;
    expect(sagui.campos.filter((c) => c.campo.startsWith('galho.')).map((c) => c.campo)).toEqual(['galho.desceA', 'galho.sobeDepoisMs']);
    expect(tuning.set('monstros', 'sagui', 'galho.desceA', 2)).toEqual({ ok: true });
    expect(tuning.monsters.get('sagui')!.branch!.descendRange).toBe(2);
    expect(list.find((m) => m.id === 'jararaca')!.campos.some((c) => c.campo.startsWith('galho.'))).toBe(false);
  });
});

describe('o sagui no galho', () => {
  it('calmo, vai até o galho e sobe: o pé fica no chão embaixo dele, exato, e quem vê fica sabendo', () => {
    const { conn, until, saguis } = setup();
    expect(until(() => saguis()[0]!.perch !== null)).toBe(true);
    const sagui = saguis()[0]!;
    const b = sagui.perch!.branch === 0 ? EAST : WEST;
    expect(feetAt(sagui.x, sagui.y)).toEqual({ x: b.x, y: b.y });
    expect(conn.ofType('perch').at(-1)).toEqual({ t: 'perch', id: sagui.id, p: { h: b.h, a: b.a } });
    expect(sagui.state().perch).toEqual({ h: b.h, a: b.a });
    // e o `move` leva o pé até lá (o desenho pula de onde ele estava até embaixo do galho)
    expect(conn.ofType('move').filter((m) => m.id === sagui.id).at(-1)).toMatchObject({ x: sagui.x, y: sagui.y });
  });

  it('quem chega depois já vê ele pendurado (no spawn)', () => {
    const { world, until, saguis } = setup();
    until(() => saguis()[0]!.perch !== null);
    const late = new FakeConn();
    const joined = world.join('Bia', late);
    if (!joined.ok) throw new Error(joined.reason);
    place(joined.player, 2, 2);
    until(() => late.ofType('spawn').some((m) => m.e.kind === 'monster'), 1000);
    const spawn = late.ofType('spawn').find((m) => m.e.kind === 'monster')!;
    expect(spawn.e.perch).toEqual({ h: expect.any(Number), a: expect.any(Number) });
  });

  it('um sagui por galho: com três saguis e dois galhos, dois sobem (cada um no seu) e um fica no chão', () => {
    const { run, saguis } = setup({ count: 3 });
    run(15_000);
    const perched = saguis().filter((s) => s.perch !== null);
    expect(perched).toHaveLength(2);
    expect(new Set(perched.map((s) => s.perch!.branch))).toEqual(new Set([0, 1]));
    const ground = saguis().find((s) => s.perch === null)!;
    expect(Number.isInteger(ground.x) && Number.isInteger(ground.y)).toBe(true);
  });

  it('subindo, não faz nada por 0,72 s (o tempo do desenho)', () => {
    const { conn, clock, run, until, saguis, player } = setup();
    until(() => conn.ofType('perch').length > 0);
    const sagui = saguis()[0]!;
    expect(sagui.perchBusyUntil).toBe(clock.now() + PERCH_CLIMB_MS);
    standEastOf(player, sagui, 4.5); // ao alcance da fruta, mas longe do chão embaixo dele
    run(PERCH_CLIMB_MS - 2 * TICK_MS);
    expect(conn.ofType('warn').filter((m) => m.id === sagui.id)).toHaveLength(0);
    run(1500);
    expect(conn.ofType('warn').filter((m) => m.id === sagui.id).length).toBeGreaterThan(0);
  });

  it('lá de cima, joga a fruta em quem chega ao alcance (com o aviso) e continua pendurado', () => {
    const { conn, run, until, saguis, player } = setup();
    until(() => saguis()[0]!.perch !== null);
    run(PERCH_CLIMB_MS);
    const sagui = saguis()[0]!;
    const at = { x: sagui.x, y: sagui.y };
    conn.clear();
    standEastOf(player, sagui, 4.5); // entre os 3 m (desce) e os 5 do alcance
    expect(until(() => conn.ofType('shot').some((m) => m.by === sagui.id), 4000)).toBe(true);
    const shot = conn.ofType('shot').find((m) => m.by === sagui.id)!;
    expect(shot.kind).toBe('fruta');
    expect(Math.cos(shot.a)).toBeGreaterThan(0.9); // para o leste, em quem chegou
    expect(conn.ofType('warn').some((m) => m.id === sagui.id)).toBe(true);
    expect(conn.ofType('say').some((m) => m.id === sagui.id && m.text === '!')).toBe(true);
    expect(sagui.perch).not.toBeNull();
    expect({ x: sagui.x, y: sagui.y }).toEqual(at);
  });

  it('lá de cima vê mais longe: percebe quem chega até o alcance da fruta (5), não só a 4', () => {
    const { conn, run, until, saguis, player } = setup();
    until(() => saguis()[0]!.perch !== null);
    run(PERCH_CLIMB_MS);
    const sagui = saguis()[0]!;
    standEastOf(player, sagui, 5.2); // o tile do pé fica a 5 do dele
    expect(until(() => conn.ofType('say').some((m) => m.id === sagui.id && m.text === '!'), 1000)).toBe(true);
  });

  it('alguém chega a 3 m: pula para o chão (num tile livre embaixo) e luta normal', () => {
    const { conn, clock, run, until, saguis, player, map } = setup();
    until(() => saguis()[0]!.perch !== null);
    run(PERCH_CLIMB_MS);
    const sagui = saguis()[0]!;
    conn.clear();
    standEastOf(player, sagui, 2.5);
    expect(until(() => sagui.perch === null, 1000)).toBe(true);
    expect(conn.ofType('perch').at(-1)).toEqual({ t: 'perch', id: sagui.id, p: null });
    expect(Number.isInteger(sagui.x) && Number.isInteger(sagui.y)).toBe(true);
    expect(map.isWalkable(sagui.x, sagui.y)).toBe(true);
    expect(sagui.state().perch).toBeUndefined();
    // descendo (0,56 s), nada; depois, luta no chão (joga a fruta ou se afasta)
    expect(sagui.perchBusyUntil).toBe(clock.now() + PERCH_DESCEND_MS);
    const before = conn.ofType('warn').length;
    run(PERCH_DESCEND_MS - 2 * TICK_MS);
    expect(conn.ofType('warn').length).toBe(before);
    expect(until(() => conn.ofType('shot').some((m) => m.by === sagui.id) || conn.ofType('move').some((m) => m.id === sagui.id), 4000)).toBe(true);
    expect(sagui.perch).toBeNull();
  });

  it('acertaram nele lá em cima: pula para o chão na hora (e larga a fruta que ia jogar)', () => {
    const { conn, clock, run, until, saguis, player, inner } = setup();
    until(() => saguis()[0]!.perch !== null);
    run(PERCH_CLIMB_MS);
    const sagui = saguis()[0]!;
    standEastOf(player, sagui, 4.5);
    until(() => sagui.windup !== null, 3000);
    expect(sagui.windup).not.toBeNull();
    inner.damage(sagui, 3, player.id, clock.now(), Math.PI); // a pedra veio do leste
    expect(sagui.perch).toBeNull();
    expect(sagui.windup).toBeNull();
    run(TICK_MS);
    expect(conn.ofType('perch').at(-1)).toEqual({ t: 'perch', id: sagui.id, p: null });
    expect(conn.ofType('hit').at(-1)).toMatchObject({ id: sagui.id, dmg: 3 });
    run(PERCH_DESCEND_MS);
    expect(sagui.targetId).toBe(player.id); // e vem brigar com quem acertou
  });

  it('acertaram nele no meio da subida: termina de subir e pula logo para o chão', () => {
    const { conn, clock, run, until, saguis, player, inner } = setup();
    until(() => conn.ofType('perch').length > 0);
    const sagui = saguis()[0]!;
    inner.damage(sagui, 2, player.id, clock.now());
    expect(sagui.perch).not.toBeNull(); // ainda subindo
    run(PERCH_CLIMB_MS + 2 * TICK_MS);
    expect(sagui.perch).toBeNull();
    expect(conn.ofType('perch').map((m) => m.p === null)).toEqual([false, true]);
  });

  it('depois da briga, calmo por 8 s, sobe de novo (num galho livre)', () => {
    const { conn, run, until, saguis, player } = setup();
    until(() => saguis()[0]!.perch !== null);
    run(PERCH_CLIMB_MS);
    const sagui = saguis()[0]!;
    standEastOf(player, sagui, 2.5);
    until(() => sagui.perch === null, 1000);
    place(player, 1, 1); // foi embora (a mais de 9 m)
    run(2000);
    expect(sagui.targetId).toBeNull();
    run(6000); // menos de 8 s calmo (contando a perseguição): ainda no chão
    expect(sagui.perch).toBeNull();
    expect(until(() => sagui.perch !== null, 12_000)).toBe(true);
    expect(conn.ofType('perch').filter((m) => m.id === sagui.id).map((m) => m.p !== null)).toEqual([true, false, true]);
  });

  it('quem perde o alvo lá em cima fica por lá, calmo, com a vida cheia', () => {
    const { run, until, saguis, player } = setup();
    until(() => saguis()[0]!.perch !== null);
    run(PERCH_CLIMB_MS);
    const sagui = saguis()[0]!;
    standEastOf(player, sagui, 4.5);
    until(() => sagui.targetId !== null, 1000);
    sagui.hp = sagui.maxHp - 5; // (machucado de antes)
    place(player, 1, 1); // saiu de perto (a mais de 9 m: ele não persegue)
    run(600);
    expect(sagui.targetId).toBeNull();
    expect(sagui.perch).not.toBeNull();
    expect(sagui.mode).toBe('idle');
    expect(sagui.hp).toBe(sagui.maxHp);
  });

  it('derrubado lá em cima: o que ele deixa cai no chão embaixo do galho, em tiles de verdade', () => {
    const { conn, run, until, saguis, player, clock, inner } = setup();
    until(() => saguis()[0]!.perch !== null);
    run(PERCH_CLIMB_MS);
    const sagui = saguis()[0]!;
    const under = footTile(sagui.x, sagui.y);
    inner.damage(sagui, 999, player.id, clock.now());
    run(TICK_MS);
    const drops = conn.ofType('drop');
    expect(drops.length).toBeGreaterThan(0); // o ouro (1 a 3), pelo menos
    for (const d of drops) {
      expect(Number.isInteger(d.x) && Number.isInteger(d.y)).toBe(true);
      expect(Math.max(Math.abs(d.x - under.x), Math.abs(d.y - under.y))).toBeLessThanOrEqual(2);
    }
  });

  it('derrubado lá em cima: o galho fica livre para outro', () => {
    const { run, until, saguis, player, clock, inner } = setup({ count: 3 });
    run(15_000);
    const perched = saguis().filter((s) => s.perch !== null);
    expect(perched).toHaveLength(2);
    const victim = perched[0]!;
    const freed = victim.perch!.branch;
    inner.damage(victim, 999, player.id, clock.now());
    expect(saguis()).not.toContain(victim);
    // o terceiro (que estava no chão) sobe no galho que ficou livre
    expect(until(() => saguis().some((s) => s.perch?.branch === freed), 20_000)).toBe(true);
  });

  it('galho com dono (o da Figueira, do Sagui Ancestral): o comum não sobe nele', () => {
    const owned: TiledObject = { ...branch(12, EAST.x, EAST.y, EAST.h, EAST.a), properties: [{ name: 'bicho', type: 'string', value: 'sagui_ancestral' }] };
    const { run, saguis } = setup({ branches: [owned], count: 3 });
    run(15_000);
    expect(saguis().every((s) => s.perch === null)).toBe(true);
  });

  it('mapa sem galho: o sagui fica no chão, como sempre', () => {
    const { run, saguis, conn } = setup({ branches: [] });
    run(15_000);
    expect(saguis()[0]!.perch).toBeNull();
    expect(conn.ofType('perch')).toHaveLength(0);
  });

  it('outros bichos não sobem (a jararaca não tem "galho")', () => {
    const clock = new FakeClock();
    const tiled = grove([branch(10, EAST.x, EAST.y, EAST.h, EAST.a)]);
    (tiled.layers[1]!.objects![0] as TiledObject).name = 'jararaca';
    const world = new World(GameMap.fromTiled(tiled, 'bosque'), { now: clock.now, random: seeded(), monsters });
    for (let t = 0; t < 15_000; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
    expect([...world.monsters.values()][0]!.perch).toBeNull();
  });
});

describe('no navegador: a fruta jogada lá de cima', () => {
  it('sai da mão dele (90 cm abaixo do galho) e cai até a altura do voo nos primeiros 4 m, como fruta jogada', () => {
    expect(throwZ(2.3)).toBeCloseTo(1.4); // os galhos do Capão: onde a fruta some da mão no desenho da [arte]
    expect(throwZ(1.6)).toBe(SHOT_DRAW_Z); // galho bem baixo: não sai de baixo da altura do voo
    expect(shotZ(true, 0, 6.5, throwZ(2.3))).toBeCloseTo(1.4);
    const middle = shotZ(true, 2, 6.5, 1.6);
    expect(middle).toBeLessThan(1.6);
    expect(middle).toBeGreaterThan(SHOT_DRAW_Z);
    expect(shotZ(true, 4, 20, 1.6)).toBeCloseTo(SHOT_DRAW_Z);
    // devagar no começo, ligeiro depois
    expect(1.6 - shotZ(true, 1, 20, 1.6)).toBeLessThan(shotZ(true, 3, 20, 1.6) - shotZ(true, 4, 20, 1.6));
    // e no fim do alcance cai até o chão, como todo tiro
    expect(shotZ(true, 6.5, 6.5, 1.6)).toBeCloseTo(0);
    // a fruta do sagui no chão: como sempre
    expect(shotZ(true, 1, 6.5)).toBe(SHOT_DRAW_Z);
  });
});
