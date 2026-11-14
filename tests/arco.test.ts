// Arco de Bambu (pedido do dono, 14/11): arma com tiro próprio. Com o arco equipado, o mesmo botão do estilingue atira
// flecha, com os números do arco (carga, alcance, intervalo e velocidade); sem munição. A Budega vende o arco e o
// estilingue de goiabeira. Os números do tiro também ficam no painel do administrador.

import { describe, expect, it } from 'vitest';
import { loadItemDefs, parseItemDefs } from '../src/server/items';
import { loadNpcDefs } from '../src/server/npcs';
import { Tuning, type BaseData } from '../src/server/tuning';
import { World } from '../src/server/world';
import { shotProfile } from '../src/shared/combat';
import { DEFAULT_COMBAT_RULES } from '../src/shared/combatRules';
import { SHOT_RANGE, SHOT_SPEED } from '../src/shared/constants';
import { GameMap, type TiledObject } from '../src/shared/map';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

const PX = 32;

/** Mapa do formato novo (1 tile = 1 metro), aberto. */
function metricMap(): GameMap {
  const spawn: TiledObject = { id: 0, name: 'spawn', x: 5 * PX, y: 5 * PX, point: true };
  return GameMap.fromTiled(
    {
      width: 40,
      height: 12,
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

const ITEMS = {
  arco: {
    nome: 'Arco',
    tipo: 'equipamento',
    parte: 'arma',
    dano: 5,
    preco: 300,
    tiro: { projetil: 'flecha', cargaMs: 1500, alcanceMinimo: 8, alcanceMaximo: 13, intervaloMs: 700, velocidade: 20 },
  },
  estilingue: { nome: 'Estilingue', tipo: 'equipamento', parte: 'arma', dano: 2 },
};

function setup(map = metricMap()) {
  const clock = new FakeClock();
  const items = parseItemDefs(ITEMS);
  const world = new World(map, { now: clock.now, random: () => 0, items });
  const joined = world.join('Ana', new FakeConn());
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  /** Põe a arma na mochila e equipa (como o jogador faz pela mochila). */
  const wield = (item: string) => {
    player.inventory.add(item, 1);
    const slot = player.inventory.state().slots.findIndex((s) => s?.item === item);
    world.itemAction(player, 'use', slot);
    expect(player.inventory.equipped.weapon).toBe(item);
  };
  const lastShot = () => [...world.projectiles.values()].at(-1)!;
  return { world, clock, player, wield, lastShot };
}

describe('o "tiro" de uma arma em data/items.json', () => {
  it('lê o tiro do arco e confere cada número', () => {
    expect(parseItemDefs(ITEMS).get('arco')!.shot).toEqual({ projectile: 'flecha', chargeMs: 1500, rangeMin: 8, rangeMax: 13, cooldownMs: 700, speed: 20 });
    expect(parseItemDefs(ITEMS).get('estilingue')!.shot).toBeUndefined();
    const bad = (tiro: Record<string, unknown>, extra: Record<string, unknown> = {}) => () =>
      parseItemDefs({ x: { nome: 'X', tipo: 'equipamento', parte: 'arma', tiro: { ...ITEMS.arco.tiro, ...tiro }, ...extra } });
    expect(bad({ projetil: 'lanca' })).toThrow(/"projetil" precisa ser "pedra" ou "flecha"/);
    expect(bad({ alcanceMaximo: 5 })).toThrow(/não pode ser menor que o "alcanceMinimo"/);
    expect(bad({ intervaloMs: 50 })).toThrow(/"intervaloMs" precisa ser de 200 a 5000/);
    expect(bad({ cargaMs: 1500.5 })).toThrow(/inteiro/);
    expect(bad({ velocidade: 99 })).toThrow(/"velocidade" precisa ser de 4 a 40/);
    expect(bad({}, { parte: 'cabeca' })).toThrow(/só vale para armas/);
  });

  it('o arco de verdade existe, e a Budega vende o arco e o estilingue de goiabeira', () => {
    const items = loadItemDefs();
    expect(items.get('arco_bambu')).toMatchObject({
      name: 'Arco de Bambu',
      slot: 'weapon',
      price: 300,
      bonus: { damage: 5 },
      description: 'Bambu do brejo curvado no fogo, corda de fibra de tucum.',
      shot: { projectile: 'flecha', chargeMs: 1500, rangeMin: 8, rangeMax: 13, cooldownMs: 700 },
    });
    expect(loadNpcDefs().get('budega')!.shop!.sells).toEqual(expect.arrayContaining(['arco_bambu', 'estilingue_goiabeira']));
  });

  it('sem arma de tiro (ou no mapa antigo), o tiro é a pedra de sempre', () => {
    const stone = shotProfile(DEFAULT_COMBAT_RULES, null);
    expect(stone).toMatchObject({ kind: 'pedra', chargeMs: DEFAULT_COMBAT_RULES.chargeFullMs, speed: SHOT_SPEED });
    const bow = parseItemDefs(ITEMS).get('arco')!.shot!;
    expect(shotProfile(DEFAULT_COMBAT_RULES, bow)).toMatchObject({ kind: 'flecha', chargeMs: 1500, rangeMin: 8, rangeMax: 13, cooldownMs: 700, speed: 20 });
    expect(shotProfile(DEFAULT_COMBAT_RULES, bow, false).kind).toBe('pedra');
  });
});

describe('atirando com o arco', () => {
  it('flecha sem carga: 8 m e o dano de sempre; com a carga cheia (1,5 s): 13 m e o dobro', () => {
    const { world, clock, player, wield, lastShot } = setup();
    wield('arco');
    const base = player.damage()[0];
    world.shoot(player, 1, 0);
    expect(lastShot()).toMatchObject({ kind: 'flecha', range: 8, speed: 20, damage: base });
    clock.advance(1000);
    world.charge(player);
    clock.advance(1100); // o tempo do estilingue não enche o arco
    world.shoot(player, 2, 0);
    expect(lastShot().range).toBeLessThan(13);
    clock.advance(1000);
    world.charge(player);
    clock.advance(1500);
    world.shoot(player, 3, 0);
    expect(lastShot()).toMatchObject({ kind: 'flecha', range: 13, damage: 2 * base });
  });

  it('o arco atira mais devagar: 0,7 s entre uma flecha e outra', () => {
    const { world, clock, player, wield } = setup();
    wield('arco');
    world.shoot(player, 1, 0);
    clock.advance(500); // o estilingue já poderia; o arco ainda não
    world.shoot(player, 2, 0);
    expect(world.projectiles.size).toBe(1);
    clock.advance(200);
    world.shoot(player, 3, 0);
    expect(world.projectiles.size).toBe(2);
  });

  it('trocou para o estilingue: volta a ser pedra', () => {
    const { world, clock, player, wield, lastShot } = setup();
    wield('arco');
    world.shoot(player, 1, 0);
    expect(lastShot().kind).toBe('flecha');
    wield('estilingue');
    clock.advance(1000);
    world.shoot(player, 2, 0);
    expect(lastShot()).toMatchObject({ kind: 'pedra', speed: SHOT_SPEED, range: DEFAULT_COMBAT_RULES.chargeRangeMin });
  });

  it('no mapa antigo (o jogo antigo não sabe da flecha), o arco atira pedra', () => {
    const old = GameMap.fromTiled(tiledFromAscii(['..........', '..........', '..........'], { x: 1, y: 1 }), 'vila');
    const { world, player, wield, lastShot } = setup(old);
    wield('arco');
    world.shoot(player, 1, 0);
    expect(lastShot()).toMatchObject({ kind: 'pedra', range: SHOT_RANGE, speed: SHOT_SPEED });
  });
});

describe('os números do tiro no painel', () => {
  it('aparecem só nas armas com tiro, conferidos e valendo na hora', () => {
    const base: BaseData = { monstros: {}, itens: structuredClone(ITEMS), npcs: {} };
    const tuning = new Tuning(base, [], null);
    const group = tuning.view().grupos.find((g) => g.arquivo === 'itens')!;
    const fields = (id: string) => group.lista.find((e) => e.id === id)!.campos.map((c) => c.campo);
    expect(fields('arco')).toEqual(expect.arrayContaining(['tiro.cargaMs', 'tiro.alcanceMinimo', 'tiro.alcanceMaximo', 'tiro.intervaloMs', 'tiro.velocidade']));
    expect(fields('estilingue')).not.toContain('tiro.cargaMs');
    const bow = tuning.items.get('arco')!;
    expect(tuning.set('itens', 'arco', 'tiro.intervaloMs', 900)).toEqual({ ok: true });
    expect(bow.shot!.cooldownMs).toBe(900); // o mesmo objeto que o jogo usa
    expect(tuning.set('itens', 'arco', 'tiro.alcanceMaximo', 6).ok).toBe(false); // menor que o sem carga (8)
    expect(tuning.set('itens', 'arco', 'tiro.velocidade', 12.5)).toEqual({ ok: true });
    expect(bow.shot!.speed).toBe(12.5);
    expect(tuning.set('itens', 'estilingue', 'tiro.cargaMs', 900).ok).toBe(false);
  });
});
