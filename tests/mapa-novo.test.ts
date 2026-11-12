// Formato novo de mapa (mundo 2.5D, combinado com o [mundo]): tile de 32 px só como grade (1 tile = 1 metro),
// colisão por retângulos exatos, áreas seguras e pontos que dizem onde fica o pé.

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkNpcs, type NpcDef } from '../src/server/npcs';
import { Realm } from '../src/server/realm';
import { parseMonsterDefs } from '../src/server/monsters';
import { parseClientMsg } from '../src/server/validate';
import { World } from '../src/server/world';
import { TICK_MS } from '../src/shared/constants';
import { DX, DY, RIGHT } from '../src/shared/dir';
import { GameMap, type TiledMap, type TiledObject } from '../src/shared/map';
import { BODY_HALF_W, bodyFits, bodySpotIn, bodyWalkable, degreesOfDir, feetAt, footTile, steerDegrees, walkSlice } from '../src/shared/movement';
import { findPath } from '../src/shared/pathfind';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

const PX = 32; // pixels por metro no Tiled

/** Retângulo em metros → objeto do Tiled (em pixels). */
const rect = (x: number, y: number, w: number, h: number, extra: Partial<TiledObject> = {}): TiledObject => ({
  id: 0,
  x: x * PX,
  y: y * PX,
  width: w * PX,
  height: h * PX,
  ...extra,
});

/** Um mapa do formato novo, pequeno: tudo em camadas de objetos. */
function metricMap(options: { width?: number; height?: number; solids?: TiledObject[]; safe?: TiledObject[]; points?: TiledObject[]; monsters?: TiledObject[] } = {}): TiledMap {
  const width = options.width ?? 20;
  const height = options.height ?? 12;
  return {
    width,
    height,
    tilewidth: PX,
    tileheight: PX,
    orientation: 'orthogonal',
    properties: [
      { name: 'nome', type: 'string', value: 'Clareira de Teste' },
      { name: 'seguro', type: 'bool', value: false },
    ],
    tilesets: [],
    layers: [
      { type: 'objectgroup', name: 'colisao', objects: options.solids ?? [] },
      { type: 'objectgroup', name: 'seguro', objects: options.safe ?? [] },
      { type: 'objectgroup', name: 'pontos', objects: options.points ?? [{ id: 0, name: 'spawn', x: 3 * PX, y: 6 * PX, point: true }] },
      { type: 'objectgroup', name: 'monstros', objects: options.monsters ?? [] },
    ],
  };
}

describe('mapa do formato novo: leitura', () => {
  it('aceita tile de 32 px (1 tile = 1 metro) e guarda os pontos exatos', () => {
    const map = GameMap.fromTiled(metricMap({ points: [{ id: 0, name: 'spawn', x: 3.5 * PX, y: 6.25 * PX, point: true }] }), 'teste');
    expect(map.metric).toBe(true);
    expect(map.spots.get('spawn')).toEqual({ x: 3.5, y: 6.25 });
    expect(map.points.get('spawn')).toEqual({ x: 3, y: 6 });
    // os mapas de hoje (tile de 16 px) continuam no formato antigo
    expect(GameMap.fromTiled(tiledFromAscii(['...'], { x: 0, y: 0 })).metric).toBe(false);
  });

  it('o pé usa o retângulo exato; monstros e tiros, o tile inteiro que ele toca', () => {
    // tronco de 0,4 × 0,4 no meio do tile (5, 6), sem "bloqueiaTiro"; grade de ferro que deixa a pedra passar
    const trunk = rect(5.3, 6.3, 0.4, 0.4);
    const fence = rect(9, 4, 1, 1, { properties: [{ name: 'bloqueiaTiro', type: 'bool', value: false }] });
    const map = GameMap.fromTiled(metricMap({ solids: [trunk, fence] }), 'teste');
    expect(map.isWalkable(5, 6)).toBe(false); // monstro contorna o tronco inteiro
    expect(map.isSolidTile(5, 6)).toBe(false); // o pé, não
    expect(map.solidsAt(5, 6)).toHaveLength(1);
    expect(map.blocksShot(5, 6)).toBe(true);
    expect(map.blocksShot(9, 4)).toBe(false);
    expect(map.isWalkable(9, 4)).toBe(false);

    // andando para a direita na linha do tronco, o pé para encostado nele (não um tile antes)
    let pose = { x: 2, y: 5.7, dir: RIGHT as typeof RIGHT }; // o pé (y + 1) fica em 6,7, na altura do tronco
    for (let i = 0; i < 20; i++) pose = { ...walkSlice(map, pose, degreesOfDir(RIGHT), 0.25) };
    const feet = feetAt(pose.x, pose.y);
    expect(feet.x + BODY_HALF_W).toBeCloseTo(5.3, 4);
  });

  it('o clique para andar passa no vão de 1,2 m entre troncos, que a grade dos monstros fecha', () => {
    // uma fileira de troncos em y 5,0–5,4 com um vão de 1,2 m (x 5,25–6,45), fora do meio dos tiles
    const map = GameMap.fromTiled(metricMap({ width: 12, height: 12, solids: [rect(0, 5, 5.25, 0.4), rect(6.45, 5, 5.55, 0.4)] }), 'teste');
    expect(findPath(map, 5, 8, 5, 1)).toBeNull(); // monstro não passa (o tile inteiro que o tronco toca bloqueia)
    const path = findPath(bodyWalkable(map), 5, 8, 5, 1);
    expect(path).not.toBeNull();
    // seguindo o caminho como o navegador faz (mirando em cada ponto, um pedaço por vez), o pé atravessa o vão
    let x = 5;
    let y = 8;
    const route = path!.map((dir) => {
      x += DX[dir];
      y += DY[dir];
      return bodySpotIn(map, x, y)!;
    });
    let pose = { x: 5, y: 8, dir: RIGHT as typeof RIGHT };
    for (let i = 0; i < 200 && route.length > 0; i++) {
      const next = route[0]!;
      if (Math.hypot(next.x - pose.x, next.y - pose.y) <= (route.length === 1 ? 0.13 : 0.35)) {
        route.shift();
        continue;
      }
      pose = { ...walkSlice(map, pose, steerDegrees(pose.x, pose.y, next.x, next.y), 0.25) };
    }
    expect(route).toHaveLength(0);
    expect(footTile(pose.x, pose.y)).toEqual({ x: 5, y: 1 });
  });

  it('lê as áreas seguras', () => {
    const map = GameMap.fromTiled(metricMap({ safe: [rect(1, 4, 5, 4, { name: 'Clareira' })] }), 'teste');
    expect(map.safeAreas).toEqual([{ x0: 1, y0: 4, x1: 6, y1: 8, name: 'Clareira' }]);
    expect(map.isSafeAt(3, 6)).toBe(true);
    expect(map.isSafeAt(7, 6)).toBe(false);
    expect(map.touchesSafeArea(6, 6)).toBe(false);
    expect(map.touchesSafeArea(5, 6)).toBe(true);
  });

  it('o mapa da clareira (Capão Redondo) carrega: pé no centro do círculo e duas áreas seguras', () => {
    const file = ['public/assets/maps/capao.tmj', 'public/assets/maps-iso/capao.tmj'].find((f) => existsSync(f));
    if (!file) return; // o [mundo] ainda não subiu o arquivo
    const map = GameMap.fromTiled(JSON.parse(readFileSync(file, 'utf8')) as TiledMap, 'capao');
    expect(map.metric).toBe(true);
    expect(map.name).toBe('Capão Redondo');
    expect(map.safeAreas.length).toBeGreaterThanOrEqual(2);
    const spawn = map.spots.get('spawn')!;
    expect(map.isSafeAt(spawn.x, spawn.y - 0.2)).toBe(true);
    const world = new World(map, { now: () => 0, random: () => 0 });
    const joined = world.join('Ana', new FakeConn());
    if (!joined.ok) throw new Error(joined.reason);
    const feet = feetAt(joined.player.fx, joined.player.fy);
    expect(Math.hypot(feet.x - spawn.x, feet.y - spawn.y)).toBeLessThanOrEqual(0.81);
    expect(bodyFits(map, joined.player.fx, joined.player.fy)).toBe(true);
  });
});

describe('mapa do formato novo: o mundo', () => {
  const defs = parseMonsterDefs({
    cobra: {
      nome: 'Cobra',
      nivel: 2,
      vida: 30,
      xp: 10,
      passoMs: 300,
      agressivo: true,
      alcanceAgressao: 6,
      perseguicao: 12,
      renascerMs: 5000,
      ataque: { tipo: 'bote', alcance: 2, preparoMs: 400, intervaloMs: 1000, dano: [10, 10] },
    },
  });

  function arena(clock: FakeClock) {
    // área segura de x 0 a 6; a cobra mora em x 10 (a 4 m da borda)
    const map = GameMap.fromTiled(
      metricMap({
        safe: [rect(0, 0, 6, 12, { name: 'Vila' })],
        points: [{ id: 0, name: 'spawn', x: 3 * PX, y: 6 * PX, point: true }],
        monsters: [rect(10, 5, 1, 1, { name: 'cobra' })],
      }),
      'teste',
    );
    const world = new World(map, { now: clock.now, random: () => 0, monsters: defs });
    const conn = new FakeConn();
    const joined = world.join('Ana', conn);
    if (!joined.ok) throw new Error(joined.reason);
    const run = (ms: number) => {
      for (let t = 0; t < ms; t += TICK_MS) {
        clock.advance(TICK_MS);
        world.tick();
      }
    };
    const cobra = [...world.monsters.values()][0]!;
    return { world, map, player: joined.player, conn, run, cobra };
  }

  it('nasce com o pé no ponto exato (ou bem perto dele)', () => {
    const { player } = arena(new FakeClock());
    const feet = feetAt(player.fx, player.fy);
    expect(Math.hypot(feet.x - 3, feet.y - 6)).toBeLessThanOrEqual(0.81);
  });

  it('na área segura o monstro não nota, não entra e não acerta', () => {
    const { player, run, cobra } = arena(new FakeClock());
    player.x = 5; // dentro da área segura, a 5 m da cobra (ela notaria a 6)
    player.y = 5;
    run(3000);
    expect(cobra.targetId).toBeNull();
    expect(player.hp).toBe(player.maxHp);
    expect(cobra.x).toBeGreaterThanOrEqual(6);
  });

  it('quem foge para a área segura se livra do monstro', () => {
    const { player, run, cobra } = arena(new FakeClock());
    player.x = 8; // fora da área segura, perto da cobra
    player.y = 5;
    run(200);
    expect(cobra.targetId).toBe(player.id);
    player.x = 2; // correu para a vila
    run(500);
    expect(cobra.targetId).toBeNull();
    expect(player.hp).toBe(player.maxHp);
  });

  it('NPC fica com o pé no ponto exato do data/npcs.json (com fração, só no formato novo)', () => {
    const clock = new FakeClock();
    const map = GameMap.fromTiled(metricMap(), 'teste');
    const curupira: NpcDef = { id: 'curupira', name: 'Curupira', title: '', map: 'teste', x: 4.5, y: 7.5, line: 'Oi', wears: [], shop: null };
    const world = new World(map, { now: clock.now, random: () => 0, npcs: new Map([['curupira', curupira]]) });
    const npc = [...world.npcs.values()][0]!;
    expect(feetAt(npc.x, npc.y)).toEqual({ x: 4.5, y: 7.5 });
    expect(footTile(npc.x, npc.y)).toEqual({ x: 4, y: 7 });
    // no formato antigo, posição com fração é erro
    const old = GameMap.fromTiled(tiledFromAscii(['.....'], { x: 0, y: 0 }), 'velho');
    expect(() => checkNpcs(new Map([['c', { ...curupira, map: 'velho' }]]), new Map(), [old])).toThrow(/inteiros/);
    expect(() => checkNpcs(new Map([['c', curupira]]), new Map(), [map])).not.toThrow();
  });

  it('no mundo novo correr é o normal (4,5 m/s) e andar devagar é com Shift (2 m/s); o jogo de hoje não muda', () => {
    const clock = new FakeClock();
    const map = GameMap.fromTiled(metricMap(), 'teste');
    const world = new World(map, { now: clock.now, random: () => 0 });
    const joined = world.join('Ana', new FakeConn());
    if (!joined.ok) throw new Error(joined.reason);
    const player = joined.player;
    const step = (slow: boolean, seq: number) => {
      const before = player.fx;
      world.requestWalk(player, seq, degreesOfDir(RIGHT), false, slow);
      clock.advance(TICK_MS);
      world.tick();
      return player.fx - before;
    };
    expect(step(false, 1)).toBeCloseTo(4.5 * 0.05, 9); // 0,225 m em 50 ms
    expect(step(true, 2)).toBeCloseTo(2 * 0.05, 9); // 0,1 m em 50 ms

    const old = new World(GameMap.fromTiled(tiledFromAscii(['..........'], { x: 0, y: 0 }), 'velho'), { now: clock.now, random: () => 0 });
    const ana = old.join('Ana', new FakeConn());
    if (!ana.ok) throw new Error(ana.reason);
    old.requestWalk(ana.player, 1, degreesOfDir(RIGHT), false, true);
    clock.advance(TICK_MS);
    old.tick();
    expect(ana.player.fx).toBe(0.25); // no jogo de hoje, sempre 5 tiles por segundo
    expect(parseClientMsg('{"t":"walk","seq":1,"a":0,"slow":true}')).toEqual({ t: 'walk', seq: 1, a: 0, slow: true });
    expect(parseClientMsg('{"t":"walk","seq":1,"a":0,"slow":"sim"}')).toBeNull();
  });

  it('a entrada diz se é o jogo 2.5D novo', () => {
    expect(parseClientMsg('{"t":"hello","v":17,"name":"Ana","password":"segredo1","mundo":"novo"}')).toEqual({ t: 'hello', v: 17, name: 'Ana', password: 'segredo1', mundo: 'novo' });
    expect(parseClientMsg('{"t":"hello","v":17,"name":"Ana","password":"segredo1"}')).toEqual({ t: 'hello', v: 17, name: 'Ana', password: 'segredo1' });
    expect(parseClientMsg('{"t":"hello","v":17,"name":"Ana","password":"segredo1","mundo":"velho"}')).toBeNull();
  });

  it('cada jogo começa no mapa do seu formato: o 2.5D novo no mapa novo, o de hoje no Refúgio', () => {
    const velho = GameMap.fromTiled({ ...tiledFromAscii(['.....'], { x: 0, y: 0 }), properties: [{ name: 'inicial', type: 'bool', value: true }] }, 'refugio');
    const novo = GameMap.fromTiled(metricMap(), 'capao');
    const realm = new Realm([velho, novo]);
    expect(realm.start.map.id).toBe('refugio');
    expect(realm.newStart.map.id).toBe('capao');
    expect(new Realm([velho, novo], { startMap: 'capao' }).start.map.id).toBe('refugio'); // o jogo de hoje não abre o mapa novo
    expect(() => new Realm([velho, novo], { startMap: 'nada' })).toThrow(/não existe/);

    // quem entra pelo jogo novo vai para o mapa novo, mesmo tendo parado no Refúgio (e vice-versa)
    const saved = (zone: string) => ({ id: 1, name: 'Ana', level: 1, xp: 0, hp: 60, zone, x: 2, y: 0, look: null, inventory: null, gold: 0, quests: null });
    const join = (zone: string, newWorld: boolean) => {
      const r = new Realm([velho, novo]);
      const result = r.join('Ana', new FakeConn(), { character: saved(zone) as never, created: false, newWorld });
      if (!result.ok) throw new Error(result.reason);
      return r.worldOf(result.player)!.map.id;
    };
    expect(join('refugio', true)).toBe('capao');
    expect(join('capao', false)).toBe('refugio');
    expect(join('capao', true)).toBe('capao');
    expect(join('refugio', false)).toBe('refugio');
  });
});
