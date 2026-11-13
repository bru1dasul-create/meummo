// Painel do administrador, mais coisas (pedido do dono: "todos esses"): nível e XP de um jogador e a posição dos NPCs
// (no painel e no menu ADM, "trazer para cá"), valendo na hora para quem está jogando.

import { describe, expect, it } from 'vitest';
import { Realm } from '../src/server/realm';
import { Tuning, type BaseData } from '../src/server/tuning';
import { World } from '../src/server/world';
import type { NpcDef } from '../src/server/npcs';
import { GameMap, type TiledObject } from '../src/shared/map';
import { maxHpFor } from '../src/shared/progression';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

const PX = 32;

function metricMap(id: string): GameMap {
  const spawn: TiledObject = { id: 0, name: 'spawn', x: 8 * PX, y: 5 * PX, point: true };
  return GameMap.fromTiled(
    {
      width: 30,
      height: 12,
      tilewidth: PX,
      tileheight: PX,
      orientation: 'orthogonal',
      properties: [{ name: 'nome', type: 'string', value: id }],
      tilesets: [],
      layers: [
        { type: 'objectgroup', name: 'colisao', objects: [] },
        { type: 'objectgroup', name: 'pontos', objects: [spawn] },
      ],
    },
    id,
  );
}

const vendedor = (): NpcDef => ({
  id: 'vendedor',
  name: 'Vendedor',
  title: '',
  map: 'praca',
  x: 10.5,
  y: 6,
  look: null,
  wears: [],
  line: 'Oi!',
  shop: null,
} as unknown as NpcDef);

describe('nível e XP pelo painel', () => {
  it('muda o nível (XP do nível do zero, vida cheia) e dá XP (sobe como caçando)', () => {
    const clock = new FakeClock();
    const realm = new Realm([metricMap('praca')], { now: clock.now, random: () => 0 });
    const conn = new FakeConn();
    const joined = realm.join('Ana', conn);
    if (!joined.ok) throw new Error(joined.reason);
    const player = joined.player;
    expect(realm.adminSetLevel(player.id, 5)).toEqual({ ok: true, texto: 'Ana agora está no nível 5.' });
    expect(player.level).toBe(5);
    expect(player.xp).toBe(0);
    expect(player.maxHp).toBe(maxHpFor(5));
    expect(player.hp).toBe(player.maxHp);
    const result = realm.adminGiveXp(player.id, 100_000);
    expect(result.ok).toBe(true);
    expect(player.level).toBeGreaterThan(5);
    expect(realm.adminSetLevel(999, 3).ok).toBe(false);
  });
});

describe('posição dos NPCs', () => {
  it('o painel mudou o lugar: o NPC anda até lá e quem está jogando fica sabendo', () => {
    const clock = new FakeClock();
    const def = vendedor();
    const world = new World(metricMap('praca'), { now: clock.now, random: () => 0, npcs: new Map([['vendedor', def]]) });
    const conn = new FakeConn();
    world.join('Ana', conn);
    const npc = [...world.npcs.values()][0]!;
    expect(npc.x + 0.5).toBeCloseTo(10.5);
    def.x = 20.5; // o painel atualiza o mesmo objeto
    def.y = 8;
    world.refreshNpcs();
    expect(npc.x + 0.5).toBeCloseTo(20.5);
    expect(npc.y + 1).toBeCloseTo(8);
    world.tick();
    const list = conn.ofType('npcs').at(-1)!.npcs;
    expect(list[0]!.e.x + 0.5).toBeCloseTo(20.5);
  });

  it('mudou de mapa: sai de um e entra no outro', () => {
    const clock = new FakeClock();
    const def = vendedor();
    const realm = new Realm([metricMap('praca'), metricMap('rua')], { now: clock.now, random: () => 0, npcs: new Map([['vendedor', def]]) });
    const praca = realm.worlds.get('praca')!;
    const rua = realm.worlds.get('rua')!;
    expect(praca.npcs.size).toBe(1);
    expect(rua.npcs.size).toBe(0);
    def.map = 'rua';
    realm.tuningChanged(new Set(['npcs']));
    expect(praca.npcs.size).toBe(0);
    expect(rua.npcs.size).toBe(1);
  });

  it('menu ADM "trazer para cá": grava o pé de quem pediu (mapa, x e y)', () => {
    const clock = new FakeClock();
    const calls: [string, string, number, number][] = [];
    const world = new World(metricMap('praca'), {
      now: clock.now,
      random: () => 0,
      npcs: new Map([['vendedor', vendedor()]]),
      setNpcSpot: (npc, map, x, y) => {
        calls.push([npc, map, x, y]);
        return null;
      },
    });
    const character = { id: 1, name: 'Ana', level: 1, xp: 0, hp: null, zone: null, x: null, y: null, dir: 2 as const, look: 1, inventory: null, admin: true };
    const joined = world.join('Ana', new FakeConn(), { character, created: false });
    if (!joined.ok) throw new Error(joined.reason);
    world.gm(joined.player, { do: 'npc', npc: 'vendedor' });
    expect(calls).toHaveLength(1);
    const [npc, map, x, y] = calls[0]!;
    expect([npc, map]).toEqual(['vendedor', 'praca']);
    expect(x).toBeCloseTo(joined.player.fx + 0.5, 1);
    expect(y).toBeCloseTo(joined.player.fy + 1, 1);
  });

  it('nos ajustes do painel: mapa, x e y juntos (vale uma vez só), e número com vírgula', () => {
    const base: BaseData = {
      monstros: {},
      itens: {},
      npcs: { dona: { nome: 'Dona', titulo: '', mapa: 'vila', x: 1, y: 1, fala: 'Oi!' } },
    };
    const iso = metricMap('praca');
    const vila = GameMap.fromTiled(tiledFromAscii(['......', '......'], { x: 1, y: 1 }), 'vila');
    const tuning = new Tuning(base, [vila, iso], null);
    let changes = 0;
    tuning.onChange = () => changes++;
    expect(tuning.setMany('npcs', 'dona', { mapa: 'praca', x: 12.5, y: 7.2 })).toEqual({ ok: true });
    expect(changes).toBe(1);
    expect(tuning.npcs.get('dona')).toMatchObject({ map: 'praca', x: 12.5, y: 7.2 });
    // no mapa antigo, com fração não vale (lá a posição é em tiles)
    expect(tuning.setMany('npcs', 'dona', { mapa: 'vila', x: 2.5, y: 1 }).ok).toBe(false);
    expect(tuning.setMany('npcs', 'dona', { mapa: 'naoexiste', x: 2, y: 1 }).ok).toBe(false);
    expect(tuning.npcs.get('dona')).toMatchObject({ map: 'praca', x: 12.5 });
  });
});
