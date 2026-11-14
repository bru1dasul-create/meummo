// Joaquim, o gato da vó (pedido do dono, 14/11): mora na casa rosa do Capão. Dorme no sofá (pula para cima e para
// baixo), acorda, se espreguiça, anda pela casa sem sair dela nem entrar nos móveis, mia quando alguém chega e ronrona
// com carinho. Nunca é alvo: não é monstro (a pedra, a mira e o menu ADM não enxergam ele).

import { describe, expect, it } from 'vitest';
import { loadPetDefs, parsePetDefs, type PetDef } from '../src/server/pets';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { TICK_MS } from '../src/shared/constants';
import { GameMap, type TiledObject } from '../src/shared/map';
import { bodyFits, cornerAtFeet, feetAt } from '../src/shared/movement';
import { FakeClock, FakeConn } from './helpers';

const PX = 32;
const rect = (id: number, name: string, x: number, y: number, w: number, h: number): TiledObject => ({ id, name, x: x * PX, y: y * PX, width: w * PX, height: h * PX });
const point = (id: number, name: string, x: number, y: number): TiledObject => ({ id, name, x: x * PX, y: y * PX, point: true });

/** A casa do teste: o chão de 8 a 15 × 4 a 10, o sofá (sólido) em 8–9 × 6–8 com a cama em cima, e uma mesa. */
function houseMap(withHome = true): GameMap {
  return GameMap.fromTiled(
    {
      width: 24,
      height: 14,
      tilewidth: PX,
      tileheight: PX,
      orientation: 'orthogonal',
      properties: [{ name: 'nome', type: 'string', value: 'Vila' }],
      tilesets: [],
      layers: [
        { type: 'objectgroup', name: 'colisao', objects: [rect(1, 'sofa', 8, 6, 1, 2), rect(2, 'mesa', 11, 6, 1, 1)] },
        {
          type: 'objectgroup',
          name: 'pontos',
          objects: [point(3, 'spawn', 3, 3), ...(withHome ? [point(4, 'joaquim', 8.5, 7), rect(5, 'joaquim-casa', 8, 4, 7, 6)] : [])],
        },
      ],
    },
    'vila',
  );
}

const JOAQUIM: PetDef = {
  id: 'joaquim',
  name: 'Joaquim',
  title: 'o gato da vó',
  map: 'vila',
  bed: 'joaquim',
  area: 'joaquim-casa',
  speed: 0.8,
  sleepS: [5, 5],
  walks: [3, 3],
  restS: [1, 2],
  meowRange: 2.5,
  meowEveryS: 12,
  petRange: 1.6,
  petEveryS: 2,
};

/** Sorte com semente (para o passeio variar, sempre igual em todo teste). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function setup(map = houseMap(), def = JOAQUIM) {
  const clock = new FakeClock();
  const logs: string[] = [];
  const world = new World(map, { now: clock.now, random: seeded(7), pets: new Map([[def.id, def]]), log: (m) => logs.push(m) });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  const run = (ms: number, each?: () => void) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
      each?.();
    }
  };
  /** Põe o pé da Ana neste ponto (metros). */
  const standAt = (p: Player, x: number, y: number) => {
    const corner = cornerAtFeet(x, y);
    p.fx = corner.x;
    p.fy = corner.y;
    p.x = Math.floor(corner.x);
    p.y = Math.floor(corner.y);
  };
  const pet = () => [...world.pets.values()][0]!;
  return { world, clock, conn, player, run, standAt, pet, logs };
}

describe('data/bichos.json', () => {
  it('o Joaquim de verdade: mora no Capão, dorme no ponto "joaquim" e anda no retângulo "joaquim-casa"', () => {
    expect(loadPetDefs().get('joaquim')).toMatchObject({ name: 'Joaquim', map: 'capao', bed: 'joaquim', area: 'joaquim-casa' });
  });

  it('confere os números (com o erro em português)', () => {
    const base = { nome: 'Gato', mapa: 'vila', dorme: 'cama', area: 'casa' };
    expect(() => parsePetDefs({ g: { ...base, velocidade: 10 } })).toThrow(/velocidade/);
    expect(() => parsePetDefs({ g: { ...base, passeios: [1.5, 3] } })).toThrow(/passeios/);
    expect(() => parsePetDefs({ g: { nome: 'Gato', mapa: 'vila', area: 'casa' } })).toThrow(/"dorme"/);
    expect(parsePetDefs({ g: base }).get('g')).toMatchObject({ speed: 0.8, meowRange: 2.5, petRange: 1.6 });
  });

  it('o mapa guarda os retângulos com nome da camada pontos', () => {
    expect(houseMap().regions.get('joaquim-casa')).toEqual({ x0: 8, y0: 4, x1: 15, y1: 10 });
  });
});

describe('o Joaquim na casa', () => {
  it('começa dormindo em cima do sofá; quem está perto vê ele (bicho, dormindo, com a casa dele)', () => {
    const { conn, player, run, standAt, pet } = setup();
    standAt(player, 12, 9);
    run(TICK_MS * 2);
    const cat = pet();
    expect(cat.asleep).toBe(true);
    expect(feetAt(cat.x, cat.y).x).toBeCloseTo(8.5);
    expect(bodyFits(houseMap(), cat.x, cat.y)).toBe(false); // em cima do móvel
    expect(conn.ofType('spawn').map((m) => m.e).find((e) => e.kind === 'pet')).toMatchObject({ type: 'joaquim', name: 'Joaquim', asleep: true, home: 'joaquim-casa' });
  });

  it('sem a casa no mapa, ele não aparece (e o servidor avisa)', () => {
    const { world, logs } = setup(houseMap(false));
    expect(world.pets.size).toBe(0);
    expect(logs.some((l) => l.includes('Joaquim não tem casa'))).toBe(true);
  });

  it('acorda, pula do sofá, passeia sem sair da casa nem entrar nos móveis e volta a dormir no sofá', () => {
    const { conn, player, run, standAt, pet } = setup();
    standAt(player, 20, 3); // longe (não mia), mas vendo
    const map = houseMap();
    const area = map.regions.get('joaquim-casa')!;
    let awakeSteps = 0;
    let woke = false;
    let slept = false;
    let bedAgain: { x: number; y: number } | null = null;
    run(60_000, () => {
      const cat = pet();
      if (cat.asleep) {
        if (woke && !slept) bedAgain = feetAt(cat.x, cat.y); // onde ele foi dormir de novo
        if (woke) slept = true;
        return;
      }
      woke = true;
      if (cat.mode === 'stretch') return; // ainda em cima do sofá, se espreguiçando
      awakeSteps += 1;
      const f = feetAt(cat.x, cat.y);
      expect(f.x).toBeGreaterThanOrEqual(area.x0);
      expect(f.x).toBeLessThanOrEqual(area.x1);
      expect(f.y).toBeGreaterThanOrEqual(area.y0);
      expect(f.y).toBeLessThanOrEqual(area.y1);
      expect(bodyFits(map, cat.x, cat.y)).toBe(true);
    });
    expect(woke).toBe(true);
    expect(awakeSteps).toBeGreaterThan(20);
    expect(slept).toBe(true);
    const fx = conn.ofType('fx').filter((m) => m.id === pet().id).map((m) => m.kind);
    expect(fx).toContain('wake');
    expect(fx).toContain('sleep');
    expect(conn.ofType('move').some((m) => m.id === pet().id && m.dash)).toBe(true); // o pulo
    expect(bedAgain).not.toBeNull();
    expect(bedAgain!.x).toBeCloseTo(8.5); // de volta em cima do sofá
    expect(bedAgain!.y).toBeCloseTo(7);
  });

  it('acordado, mia uma vez quando alguém chega (olhando para a pessoa), e de novo só depois da espera', () => {
    const { conn, player, run, standAt, pet, clock } = setup();
    standAt(player, 20, 3);
    run(5_000 + 1_700); // acordou, se espreguiçou e pulou do sofá
    expect(pet().asleep).toBe(false);
    const meows = () => conn.ofType('fx').filter((m) => m.id === pet().id && m.kind === 'meow').length;
    const cat = feetAt(pet().x, pet().y);
    standAt(player, cat.x + 1, cat.y);
    run(TICK_MS * 3);
    expect(meows()).toBe(1);
    run(3_000); // continuou perto: não mia de novo
    expect(meows()).toBe(1);
    standAt(player, 20, 3);
    run(TICK_MS * 2);
    const near = feetAt(pet().x, pet().y);
    standAt(player, near.x + 1, near.y);
    run(TICK_MS * 2);
    expect(meows()).toBe(1); // voltou logo: ainda na espera de 12 s
    standAt(player, 20, 3);
    clock.advance(12_000);
    run(TICK_MS * 2);
    const later = feetAt(pet().x, pet().y);
    standAt(player, later.x + 1, later.y);
    run(TICK_MS * 2);
    expect(meows()).toBe(2);
  });

  it('dormindo, não mia', () => {
    const { conn, player, run, standAt, pet } = setup();
    standAt(player, 9.5, 8.5); // pertinho do sofá
    run(2_000);
    expect(pet().asleep).toBe(true);
    expect(conn.ofType('fx').some((m) => m.kind === 'meow')).toBe(false);
  });

  it('carinho: só de perto; ele ronrona (quem vê fica sabendo) e espera um pouco para o próximo', () => {
    const { world, conn, player, run, standAt, pet } = setup();
    standAt(player, 14, 9);
    run(TICK_MS * 2);
    world.cuddle(player, pet().id);
    run(TICK_MS);
    expect(conn.ofType('fail').at(-1)?.reason).toBe('too_far');
    standAt(player, 9.5, 7.6); // do lado do sofá
    world.cuddle(player, pet().id);
    run(TICK_MS);
    const purrs = () => conn.ofType('fx').filter((m) => m.kind === 'purr').length;
    expect(purrs()).toBe(1);
    expect(pet().asleep).toBe(true); // dormindo, ronrona e continua dormindo
    world.cuddle(player, pet().id); // logo de novo: espera
    run(TICK_MS);
    expect(purrs()).toBe(1);
    run(2_000);
    world.cuddle(player, pet().id);
    run(TICK_MS);
    expect(purrs()).toBe(2);
  });

  it('nunca é alvo: não é monstro, e a pedra passa por ele', () => {
    const { world, player, run, standAt, pet } = setup();
    expect(world.monsters.size).toBe(0);
    standAt(player, 6, 7); // do lado de fora do sofá, mirando o Joaquim
    world.shoot(player, 1, 0);
    run(1_000);
    expect(world.pets.size).toBe(1);
    expect(pet().asleep).toBe(true);
  });

  it('a mensagem do carinho passa pela conferência', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'pet', id: 12 }))).toEqual({ t: 'pet', id: 12 });
    expect(parseClientMsg(JSON.stringify({ t: 'pet', id: 'gato' }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'pet' }))).toBeNull();
  });
});
