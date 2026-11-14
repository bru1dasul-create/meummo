// Vento (pedido do dono, 14/11: "vento forte/fraco"): um só para o mundo todo. Fica calmo, em brisa ou forte por uns
// minutos e muda devagar; é só desenho (as árvores balançam) e som. O navegador recebe o vento nas boas-vindas e a
// mensagem `wind` quando muda; o administrador muda na hora pelo menu ADM.

import { describe, expect, it } from 'vitest';
import { Realm } from '../src/server/realm';
import { parseClientMsg } from '../src/server/validate';
import { WindWeather } from '../src/server/wind';
import { World } from '../src/server/world';
import { TICK_MS, WIND_MAX_MS, WIND_MIN_MS, WIND_TRANSITION_MS } from '../src/shared/constants';
import { GameMap } from '../src/shared/map';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

/** Sorteio com semente (sempre igual em todo teste). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('o vento', () => {
  it('começa em brisa e só muda depois de uns minutos', () => {
    const clock = new FakeClock();
    const wind = new WindWeather(clock.now, seeded(3));
    expect(wind.level).toBe('brisa');
    expect(wind.strength).toBe(0.35);
    expect(wind.update()).toBe(false);
    clock.advance(WIND_MIN_MS - 1);
    expect(wind.update()).toBe(false);
    clock.advance(WIND_MAX_MS);
    expect(wind.update()).toBe(true);
  });

  it('cada jeito tem a sua faixa de força; a direção fica entre 0 e 360°', () => {
    const clock = new FakeClock();
    const wind = new WindWeather(clock.now, seeded(11));
    const ranges = { calmo: [0.05, 0.2], brisa: [0.3, 0.5], forte: [0.75, 1] } as const;
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      clock.advance(WIND_MAX_MS);
      wind.update();
      seen.add(wind.level);
      const [min, max] = ranges[wind.level];
      expect(wind.strength).toBeGreaterThanOrEqual(min);
      expect(wind.strength).toBeLessThanOrEqual(max);
      expect(wind.angle).toBeGreaterThanOrEqual(0);
      expect(wind.angle).toBeLessThan(360);
    }
    expect(seen).toEqual(new Set(['calmo', 'brisa', 'forte'])); // em 60 mudanças, aparecem os três
  });

  it('o administrador põe forte (ou calmo) na hora; a mensagem diz a força, a direção e em quanto tempo muda', () => {
    const clock = new FakeClock();
    const wind = new WindWeather(clock.now, seeded(5));
    wind.set('forte');
    expect(wind.strength).toBeGreaterThanOrEqual(0.75);
    expect(wind.message()).toEqual({ t: 'wind', strength: wind.strength, angle: wind.angle, ms: WIND_TRANSITION_MS });
    wind.set('calmo');
    expect(wind.strength).toBeLessThanOrEqual(0.2);
  });
});

describe('o vento no jogo', () => {
  function setup() {
    const clock = new FakeClock();
    const map = GameMap.fromTiled(tiledFromAscii(['.'.repeat(8), '.'.repeat(8)], { x: 1, y: 1 }));
    const wind = new WindWeather(clock.now, seeded(7));
    const world = new World(map, { now: clock.now, random: () => 0, wind });
    const conn = new FakeConn();
    const joined = world.join('Ana', conn);
    if (!joined.ok) throw new Error(joined.reason);
    const run = (ms: number) => {
      for (let t = 0; t < ms; t += TICK_MS) {
        clock.advance(TICK_MS);
        world.tick();
      }
    };
    return { world, conn, player: joined.player, run, wind };
  }

  it('as boas-vindas trazem o vento de agora', () => {
    const { conn, wind } = setup();
    expect(conn.ofType('welcome')[0]!.wind).toEqual({ strength: wind.strength, angle: wind.angle });
  });

  it('menu ADM: "vento forte" vale na hora para quem está jogando (com uma passagem curta); quem não é administrador, nada', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'gm', cmd: { do: 'wind', level: 'forte' } }))).toEqual({ t: 'gm', cmd: { do: 'wind', level: 'forte' } });
    expect(parseClientMsg(JSON.stringify({ t: 'gm', cmd: { do: 'wind', level: 'furacao' } }))).toBeNull();
    const { world, conn, player, run, wind } = setup();
    world.gm(player, { do: 'wind', level: 'forte' });
    run(TICK_MS);
    expect(conn.ofType('wind')).toHaveLength(0); // sem ser administrador
    player.admin = true;
    world.gm(player, { do: 'wind', level: 'forte' });
    run(TICK_MS);
    expect(conn.ofType('wind').at(-1)).toEqual({ t: 'wind', strength: wind.strength, angle: wind.angle, ms: 3000 });
    expect(wind.strength).toBeGreaterThanOrEqual(0.75);
  });

  it('o reino tem um vento só para todos os mapas e avisa todo mundo quando ele muda', () => {
    const clock = new FakeClock();
    const a = GameMap.fromTiled(tiledFromAscii(['.'.repeat(8), '.'.repeat(8)], { x: 1, y: 1 }), 'a');
    const b = GameMap.fromTiled(tiledFromAscii(['.'.repeat(8), '.'.repeat(8)], { x: 1, y: 1 }), 'b');
    const realm = new Realm([a, b], { now: clock.now });
    expect(realm.worlds.get('a')!.wind).toBe(realm.wind);
    expect(realm.worlds.get('b')!.wind).toBe(realm.wind);
    const conn = new FakeConn();
    const joined = realm.start.join('Ana', conn);
    if (!joined.ok) throw new Error(joined.reason);
    for (let t = 0; t < WIND_MAX_MS + 1000; t += 1000) {
      clock.advance(1000);
      realm.tick();
    }
    expect(conn.ofType('wind').length).toBeGreaterThanOrEqual(1);
    expect(conn.ofType('wind').at(-1)!.ms).toBe(WIND_TRANSITION_MS);
  });
});
