// Vários mapas ligados: entrar no mapa certo, passar pelas saídas, acordar na vila, chat para todos.

import { beforeEach, describe, expect, it } from 'vitest';
import type { CharacterData } from '../src/server/accounts';
import { checkLinks, Realm } from '../src/server/realm';
import { loadMaps } from '../src/server/server';
import type { Player } from '../src/server/world';
import { TICK_MS, WALK_SLICE_MS } from '../src/shared/constants';
import { DOWN, LEFT, RIGHT, type Dir } from '../src/shared/dir';
import { GameMap, type Tile, type TiledProperty } from '../src/shared/map';
import { findPath } from '../src/shared/pathfind';
import { deg, FakeClock, FakeConn, SLICES_PER_TILE, tiledFromAscii } from './helpers';

interface ExitDef {
  x: number;
  y: number;
  w: number;
  h: number;
  to: string;
  arrival?: string;
  label?: string;
}

/** Mapa de teste com saídas, pontos com nome e propriedades (como o Tiled salvaria). */
function mapWith(id: string, rows: string[], opts: { spawn?: Tile; exits?: ExitDef[]; points?: Record<string, Tile>; props?: TiledProperty[] }): GameMap {
  const json = tiledFromAscii(rows, opts.spawn);
  json.layers.push({
    type: 'objectgroup',
    name: 'saidas',
    objects: (opts.exits ?? []).map((e, i) => ({
      id: 100 + i,
      name: e.label ?? '',
      x: e.x * 16,
      y: e.y * 16,
      width: e.w * 16,
      height: e.h * 16,
      properties: [
        { name: 'mapa', type: 'string', value: e.to },
        ...(e.arrival ? [{ name: 'chegada', type: 'string', value: e.arrival }] : []),
      ],
    })),
  });
  json.layers.push({
    type: 'objectgroup',
    name: 'pontos',
    objects: Object.entries(opts.points ?? {}).map(([name, p], i) => ({ id: 200 + i, name, point: true, x: p.x * 16 + 8, y: p.y * 16 + 8 })),
  });
  json.properties = opts.props;
  return GameMap.fromTiled(json, id);
}

const ROWS = ['.'.repeat(12), '.'.repeat(12), '.'.repeat(12)];
const vila = () =>
  mapWith('vila', ROWS, {
    spawn: { x: 1, y: 1 },
    exits: [{ x: 11, y: 0, w: 1, h: 3, to: 'mata', arrival: 'oeste', label: 'Mata Escura' }],
    points: { leste: { x: 9, y: 1 } },
    props: [
      { name: 'nome', type: 'string', value: 'Vila' },
      { name: 'inicial', type: 'bool', value: true },
    ],
  });
const mata = () =>
  mapWith('mata', ROWS, {
    spawn: { x: 2, y: 1 },
    exits: [{ x: 0, y: 0, w: 1, h: 3, to: 'vila', arrival: 'leste' }],
    points: { oeste: { x: 2, y: 1 } },
    props: [
      { name: 'nome', type: 'string', value: 'Mata' },
      { name: 'renascerEm', type: 'string', value: 'vila' },
    ],
  });

let clock: FakeClock;
let realm: Realm;
let seq: number;
beforeEach(() => {
  clock = new FakeClock();
  realm = new Realm([mata(), vila()], { now: clock.now, random: () => 0 });
  seq = 0;
});

function join(name: string, character?: Partial<CharacterData>): { player: Player; conn: FakeConn } {
  const conn = new FakeConn();
  const profile = character
    ? { character: { id: 9, name, level: 1, xp: 0, hp: null, zone: null, x: null, y: null, dir: DOWN, look: 1, inventory: null, ...character }, created: false }
    : undefined;
  const result = realm.join(name, conn, profile);
  if (!result.ok) throw new Error(result.reason);
  return { player: result.player, conn };
}

function run(ms: number): void {
  for (let t = 0; t < ms; t += TICK_MS) {
    clock.advance(TICK_MS);
    realm.tick();
  }
}

/** Anda `steps` tiles na direção `dir`, um pedaço de caminhada por tick (como o navegador). */
function walk(player: Player, dir: Dir, steps: number): void {
  for (let i = 0; i < steps * SLICES_PER_TILE; i++) {
    realm.requestWalk(player, ++seq, deg(dir));
    run(WALK_SLICE_MS);
  }
}

const zoneOf = (player: Player) => realm.worldOf(player)?.map.id;

describe('vários mapas', () => {
  it('lê saídas, pontos com nome e as propriedades do mapa', () => {
    const map = vila();
    expect(map).toMatchObject({ id: 'vila', name: 'Vila', start: true, respawnMap: null });
    expect(map.exits).toEqual([{ x: 11, y: 0, w: 1, h: 3, to: 'mata', arrival: 'oeste', label: 'Mata Escura' }]);
    expect(map.points.get('leste')).toEqual({ x: 9, y: 1 });
    expect(map.exitAt(11, 2)?.to).toBe('mata');
    expect(map.exitAt(10, 2)).toBeNull();
    expect(mata().respawnMap).toBe('vila');
    // sem "chegada": aparece perto do ponto de nascimento do outro mapa
    expect(mapWith('x', ROWS, { exits: [{ x: 0, y: 0, w: 1, h: 1, to: 'vila' }] }).exits[0]!.arrival).toBe('spawn');
  });

  it('entra no mapa inicial e, pisando na saída, vai para o outro mapa no ponto de chegada', () => {
    const ana = join('Ana');
    expect(zoneOf(ana.player)).toBe('vila');
    expect(ana.conn.ofType('welcome')[0]).toMatchObject({ map: 'vila' });
    walk(ana.player, RIGHT, 10);
    expect(zoneOf(ana.player)).toBe('mata');
    expect(ana.player).toMatchObject({ x: 2, y: 1 });
    expect(ana.conn.ofType('zone').at(-1)).toMatchObject({ map: 'mata', you: { id: ana.player.id, x: 2, y: 1 } });
    run(TICK_MS);
    expect(ana.conn.ofType('sys').at(-1)?.text).toBe('Você chegou em: Mata.');
  });

  it('até o navegador avisar que carregou, os pedidos dele são ignorados', () => {
    const ana = join('Ana');
    walk(ana.player, RIGHT, 10);
    walk(ana.player, RIGHT, 2);
    expect(ana.player).toMatchObject({ x: 2, y: 1 }); // ainda carregando: não andou
    realm.loaded(ana.player);
    walk(ana.player, RIGHT, 2);
    expect(ana.player).toMatchObject({ x: 4, y: 1 });
    walk(ana.player, LEFT, 4); // e volta para a vila pela saída da esquerda
    expect(zoneOf(ana.player)).toBe('vila');
    expect(ana.player).toMatchObject({ x: 9, y: 1 });
  });

  it('quem fica no mapa antigo para de ver; quem está no mapa novo passa a ver', () => {
    const ana = join('Ana');
    const beto = join('Beto');
    const carla = join('Carla', { zone: 'mata', x: 6, y: 1 });
    run(TICK_MS);
    expect(beto.conn.ofType('spawn').some((m) => m.e.id === ana.player.id)).toBe(true);
    expect(carla.conn.ofType('spawn').some((m) => m.e.id === ana.player.id)).toBe(false);
    walk(ana.player, RIGHT, 10);
    run(TICK_MS);
    expect(beto.conn.ofType('despawn').some((m) => m.id === ana.player.id)).toBe(true);
    expect(carla.conn.ofType('spawn').some((m) => m.e.id === ana.player.id)).toBe(true);
  });

  it('chat, avisos e "online" valem para todos os mapas', () => {
    const ana = join('Ana');
    const carla = join('Carla', { zone: 'mata' });
    expect(carla.conn.ofType('welcome')[0]?.online).toBe(2);
    realm.chat(ana.player, 'Oi, Carla!');
    run(TICK_MS);
    expect(carla.conn.ofType('chat').at(-1)).toMatchObject({ name: 'Ana', text: 'Oi, Carla!' });
    expect(() => join('ana')).toThrow('name_taken'); // nome repetido, mesmo em outro mapa
  });

  it('desmaiou num mapa sem vila: acorda na vila, com a vida cheia', () => {
    const ana = join('Ana', { zone: 'mata', x: 6, y: 1 });
    ana.player.hp = 0;
    ana.player.deadUntil = clock.now() + 100;
    run(200);
    expect(zoneOf(ana.player)).toBe('vila');
    expect(ana.player.dead).toBe(false);
    expect(ana.player.hp).toBe(ana.player.maxHp);
    expect(ana.conn.ofType('zone').at(-1)).toMatchObject({ map: 'vila', you: { hp: ana.player.maxHp } });
  });

  it('quem sai do jogo desmaiado num mapa sem vila volta acordando na vila', () => {
    const saved: CharacterData[] = [];
    realm = new Realm([vila(), mata()], { now: clock.now, random: () => 0, saver: { save: (list) => saved.push(...list.map((e) => e.data)) } });
    const ana = join('Ana', { zone: 'mata', x: 6, y: 1 });
    ana.player.hp = 0;
    ana.player.deadUntil = clock.now() + 3000;
    realm.leave(ana.player);
    expect(saved.at(-1)).toMatchObject({ zone: 'vila', x: null, y: null, hp: null });
  });

  it('volta no mapa salvo (pelo id, ou pelo nome dos saves antigos); mapa que sumiu = mapa inicial', () => {
    expect(zoneOf(join('Ana', { zone: 'mata', x: 6, y: 1 }).player)).toBe('mata');
    expect(zoneOf(join('Beto', { zone: 'Mata', x: 6, y: 1 }).player)).toBe('mata');
    expect(zoneOf(join('Caio', { zone: 'pantano' }).player)).toBe('vila');
  });

  it('salva a zona pelo id do mapa quando troca de mapa', () => {
    const saved: CharacterData[] = [];
    realm = new Realm([vila(), mata()], { now: clock.now, random: () => 0, saver: { save: (list) => saved.push(...list.map((e) => e.data)) } });
    const ana = join('Ana', {});
    walk(ana.player, RIGHT, 10);
    expect(saved.at(-1)).toMatchObject({ zone: 'mata', x: 2, y: 1 });
  });

  it('saída para mapa ou ponto que não existe dá um erro claro', () => {
    const broken = (exit: ExitDef, points?: Record<string, Tile>) => () => checkLinks([vila(), mata(), mapWith('b', ROWS, { exits: [exit], points })]);
    expect(broken({ x: 0, y: 0, w: 1, h: 1, to: 'nada' })).toThrow(/mapa "nada", que não existe/);
    expect(broken({ x: 0, y: 0, w: 1, h: 1, to: 'vila', arrival: 'norte' })).toThrow(/não tem um ponto com esse nome/);
    expect(() => checkLinks([mapWith('a', ROWS, { exits: [{ x: 0, y: 0, w: 3, h: 3, to: 'a', arrival: 'meio' }], points: { meio: { x: 1, y: 1 } } })])).toThrow(
      /em cima de uma saída/,
    );
    expect(() => checkLinks([mapWith('a', ROWS, { props: [{ name: 'renascerEm', type: 'string', value: 'nada' }] })])).toThrow(/renascerEm/);
  });
});

describe('os mapas de verdade', () => {
  it('se ligam: dá para ir a pé da vila até a saída para Santo Amaro, e de lá voltar', () => {
    const maps = loadMaps();
    const byId = new Map(maps.map((m) => [m.id, m]));
    expect([...byId.keys()]).toEqual(expect.arrayContaining(['refugio', 'santo-amaro']));
    const real = new Realm(maps);
    expect(real.start.map.id).toBe('refugio');
    for (const map of maps) {
      const from = map.id === 'refugio' ? map.spawn : map.points.get('oeste') ?? map.spawn;
      for (const exit of map.exits) {
        const target = [...Array(exit.h)].flatMap((_, dy) => [...Array(exit.w)].map((__, dx) => ({ x: exit.x + dx, y: exit.y + dy }))).find((t) => map.isWalkable(t.x, t.y));
        expect(target, `saída de ${map.id} sem tile livre`).toBeDefined();
        expect(findPath(map, from.x, from.y, target!.x, target!.y, map.width * map.height * 2), `de ${map.id} até a saída para ${exit.to}`).not.toBeNull();
      }
    }
    expect(byId.get('santo-amaro')).toMatchObject({ name: 'Ruínas de Santo Amaro', safe: false, respawnMap: 'refugio' });
  });
});
