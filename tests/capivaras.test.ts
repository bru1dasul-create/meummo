// As capivaras (pedido do dono, 14/11: "colocar as capivaras para andar"): bichos do ambiente, como o Joaquim, mas
// em bando e fora de casa. Cada uma anda sozinha pela área dela, deita para descansar em volta do ponto de descanso
// (lado a lado, cada uma acordando numa hora), não mia e gosta de carinho. Nunca são alvo.

import { describe, expect, it } from 'vitest';
import { loadPetDefs, parsePetDefs, petHome } from '../src/server/pets';
import { World } from '../src/server/world';
import { TICK_MS } from '../src/shared/constants';
import { GameMap, type TiledObject } from '../src/shared/map';
import { bodyFits, cornerAtFeet, feetAt } from '../src/shared/movement';
import { FakeClock, FakeConn } from './helpers';

const PX = 32;
const rect = (id: number, name: string, x: number, y: number, w: number, h: number): TiledObject => ({ id, name, x: x * PX, y: y * PX, width: w * PX, height: h * PX });
const point = (id: number, name: string, x: number, y: number): TiledObject => ({ id, name, x: x * PX, y: y * PX, point: true });

/** Um campo aberto de 30 × 20 m com a área das capivaras (8 a 20 × 4 a 14) e o ponto de descanso (14, 9). */
function fieldMap(): GameMap {
  return GameMap.fromTiled(
    {
      width: 30,
      height: 20,
      tilewidth: PX,
      tileheight: PX,
      orientation: 'orthogonal',
      properties: [{ name: 'nome', type: 'string', value: 'Campo' }],
      tilesets: [],
      layers: [
        { type: 'objectgroup', name: 'colisao', objects: [] },
        { type: 'objectgroup', name: 'pontos', objects: [point(1, 'spawn', 3, 3), rect(2, 'capivaras-campo', 8, 4, 12, 10), point(3, 'capivaras-campo-descanso', 14, 9)] },
      ],
    },
    'campo',
  );
}

const DATA = {
  capivaras: {
    nome: 'Capivara',
    tipo: 'capivara',
    mapa: 'campo',
    dorme: 'capivaras-campo-descanso',
    area: 'capivaras-campo',
    quantidade: 3,
    dentroDeCasa: false,
    velocidade: 0.5,
    sonoSegundos: [5, 20],
    passeios: [2, 3],
    paradaSegundos: [1, 2],
    mia: false,
    carinho: { alcance: 1.8, esperaSegundos: 3 },
  },
};

/** Sorteio com semente (sempre igual em todo teste). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('data/bichos.json: as capivaras', () => {
  it('dois bandos no Capão (o do lago e o do campinho), desenhados como capivara, fora de casa, sem miar', () => {
    const defs = loadPetDefs();
    expect(defs.get('capivaras_lago')).toMatchObject({ type: 'capivara', count: 3, indoor: false, meowRange: 0, map: 'capao', area: 'capivaras-lago', bed: 'capivaras-lago-descanso' });
    expect(defs.get('capivaras_campinho')).toMatchObject({ type: 'capivara', count: 2, area: 'capivaras-campinho', bed: 'capivaras-campinho-descanso' });
    expect(defs.get('joaquim')).toMatchObject({ type: 'joaquim', count: 1, indoor: true });
  });

  it('"mia": false e "carinho": false desligam; quantidade de 1 a 8', () => {
    const base = { nome: 'B', mapa: 'campo', dorme: 'x', area: 'y' };
    expect(parsePetDefs({ b: { ...base, mia: false, carinho: false } }).get('b')).toMatchObject({ meowRange: 0, petRange: 0 });
    expect(() => parsePetDefs({ b: { ...base, quantidade: 12 } })).toThrow(/quantidade/);
  });
});

describe('as capivaras no mapa', () => {
  function setup() {
    const clock = new FakeClock();
    const pets = parsePetDefs(DATA);
    const world = new World(fieldMap(), { now: clock.now, random: seeded(9), pets });
    const conn = new FakeConn();
    const joined = world.join('Ana', conn);
    if (!joined.ok) throw new Error(joined.reason);
    const corner = cornerAtFeet(14, 11);
    Object.assign(joined.player, { fx: corner.x, fy: corner.y, x: Math.floor(corner.x), y: Math.floor(corner.y) });
    const run = (ms: number, each?: () => void) => {
      for (let t = 0; t < ms; t += TICK_MS) {
        clock.advance(TICK_MS);
        world.tick();
        each?.();
      }
    };
    return { world, conn, player: joined.player, run };
  }

  it('o bando inteiro aparece, deitado lado a lado em volta do ponto, no chão (sem pular)', () => {
    const { world, conn, run } = setup();
    run(TICK_MS * 2);
    const capys = [...world.pets.values()];
    expect(capys).toHaveLength(3);
    const spots = capys.map((c) => feetAt(c.x, c.y));
    for (const s of spots) expect(Math.hypot(s.x - 14, s.y - 9)).toBeLessThan(1.6);
    // nenhuma em cima da outra
    expect(new Set(spots.map((s) => `${s.x.toFixed(2)},${s.y.toFixed(2)}`)).size).toBe(3);
    for (const c of capys) expect(bodyFits(fieldMap(), c.x, c.y)).toBe(true);
    const seen = conn.ofType('spawn').map((m) => m.e).filter((e) => e.kind === 'pet');
    expect(seen.map((e) => e.type)).toEqual(['capivara', 'capivara', 'capivara']);
    expect(seen.every((e) => e.asleep === true && e.home === undefined)).toBe(true); // fora de casa: sem "home"
  });

  it('cada uma acorda numa hora, passeia sem sair da área e volta a deitar; nenhuma mia', () => {
    const { world, conn, run } = setup();
    const area = fieldMap().regions.get('capivaras-campo')!;
    const wokeAt = new Map<number, number>();
    let t = 0;
    run(60_000, () => {
      t += TICK_MS;
      for (const c of world.pets.values()) {
        if (!c.asleep && !wokeAt.has(c.id)) wokeAt.set(c.id, t);
        const f = c.feet();
        expect(f.x).toBeGreaterThanOrEqual(area.x0);
        expect(f.x).toBeLessThanOrEqual(area.x1);
        expect(f.y).toBeGreaterThanOrEqual(area.y0);
        expect(f.y).toBeLessThanOrEqual(area.y1);
      }
    });
    expect(wokeAt.size).toBe(3);
    expect(new Set(wokeAt.values()).size).toBeGreaterThan(1); // não acordam todas juntas
    expect(conn.ofType('fx').some((m) => m.kind === 'meow')).toBe(false);
    expect(conn.ofType('fx').filter((m) => m.kind === 'sleep').length).toBeGreaterThan(0);
  });

  it('carinho: perto dela, ela gosta (purr); e o "home" do bando é dela (o petHome de cada uma)', () => {
    const { world, conn, player, run } = setup();
    run(TICK_MS * 2);
    const capy = [...world.pets.values()][0]!;
    const near = feetAt(capy.x, capy.y);
    const corner = cornerAtFeet(near.x, near.y + 1);
    Object.assign(player, { fx: corner.x, fy: corner.y, x: Math.floor(corner.x), y: Math.floor(corner.y) });
    world.cuddle(player, capy.id);
    run(TICK_MS);
    expect(conn.ofType('fx').some((m) => m.kind === 'purr' && m.id === capy.id)).toBe(true);
    const def = parsePetDefs(DATA).get('capivaras')!;
    expect(petHome(fieldMap(), def, 0)!.bed).toEqual(petHome(fieldMap(), def, 0)!.hop); // deita no chão: sem pulo
  });
});
