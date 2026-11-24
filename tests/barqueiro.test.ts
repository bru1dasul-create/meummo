// A viagem de barco com o Barqueiro (pedido do dono, 24/11: "faz a viagem de barco com o Barqueiro"): no atracadouro do
// Refúgio, ele leva até a Ilha do Véu (o ponto `chegada-ilha-do-veu` do [mundo]); na ilha, o Barqueiro do atracadouro de
// lá traz de volta (desce na frente do Barqueiro do Refúgio). De graça; o preço é um número em data/npcs.json.

import { describe, expect, it } from 'vitest';
import { loadItemDefs } from '../src/server/items';
import { checkNpcs, loadNpcDefs, parseNpcDefs } from '../src/server/npcs';
import { loadMaps } from '../src/server/server';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { TICK_MS } from '../src/shared/constants';
import { GameMap, type TiledObject } from '../src/shared/map';
import { cornerAtFeet, feetAt } from '../src/shared/movement';
import { arrivedAt, tripLabel } from '../src/client/talk';
import { FakeClock, FakeConn } from './helpers';

const maps = loadMaps();
const items = loadItemDefs();
const npcs = loadNpcDefs();

describe('os dados das viagens (data/npcs.json)', () => {
  it('o Barqueiro do Refúgio leva até a Ilha do Véu; o da ilha traz de volta; de graça', () => {
    expect(npcs.get('barqueiro')!.trips).toEqual([{ to: 'chegada-ilha-do-veu', name: 'a Ilha do Véu', price: 0 }]);
    expect(npcs.get('barqueiro_ilha')).toMatchObject({ name: 'Barqueiro', map: 'guarapiranga', trips: [{ to: 'barqueiro', name: 'o Refúgio', price: 0 }] });
    expect(() => checkNpcs(npcs, items, maps)).not.toThrow();
  });

  it('o arquivo é conferido (e explica em português)', () => {
    const base = { nome: 'B', mapa: 'guarapiranga', x: 1, y: 1 };
    expect(() => parseNpcDefs({ b: { ...base, viagens: ['ilha'] } })).toThrow(/"viagens" precisa ser uma lista de viagens/);
    expect(() => parseNpcDefs({ b: { ...base, viagens: [{ nome: 'a Ilha' }] } })).toThrow(/viagem 1 do personagem "b".*"para"/);
    expect(() => parseNpcDefs({ b: { ...base, viagens: [{ para: 'x', nome: 'a Ilha', preco: 2.5 }] } })).toThrow(/número inteiro de ouro/);
    const lost = parseNpcDefs({ b: { ...base, viagens: [{ para: 'lugar-que-nao-existe', nome: 'lugar nenhum' }] } });
    expect(() => checkNpcs(lost, items, maps)).toThrow(/a viagem para "lugar-que-nao-existe" não acha o lugar/);
  });

  it('o pedido passa pela conferência', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'travel', npc: 4, to: 'chegada-ilha-do-veu' }))).toEqual({ t: 'travel', npc: 4, to: 'chegada-ilha-do-veu' });
    expect(parseClientMsg(JSON.stringify({ t: 'travel', npc: 4 }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'travel', npc: 4, to: 'Ilha do Véu!' }))).toBeNull();
  });
});

describe('no navegador: o botão e o aviso', () => {
  it('"Atravessar para a Ilha do Véu" (e o preço, se cobrar); "chegou à Ilha", "ao Refúgio"', () => {
    expect(tripLabel({ to: 'chegada-ilha-do-veu', name: 'a Ilha do Véu', price: 0 })).toBe('Atravessar para a Ilha do Véu');
    expect(tripLabel({ to: 'x', name: 'o Refúgio', price: 5 })).toBe('Atravessar para o Refúgio · 5 de ouro');
    expect(arrivedAt('a Ilha do Véu')).toBe('à Ilha do Véu');
    expect(arrivedAt('o Refúgio')).toBe('ao Refúgio');
    expect(arrivedAt('Santo Amaro')).toBe('a Santo Amaro');
  });
});

// ---------- no mapa de verdade (a Guarapiranga) ----------

function guarapiranga() {
  const clock = new FakeClock();
  const map = maps.find((m) => m.id === 'guarapiranga')!;
  const world = new World(map, { now: clock.now, random: () => 0.5, items, npcs });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  const npcOf = (type: string) => [...world.npcs.values()].find((n) => n.def.id === type)!;
  run(TICK_MS * 2);
  return { world, conn, player, run, npcOf };
}

/** Põe o pé do jogador em (x, y) metros (o tile do pé, `player.x`/`y`, vem disso). */
function standAt(player: Player, x: number, y: number): void {
  const corner = cornerAtFeet(x, y);
  player.fx = corner.x;
  player.fy = corner.y;
}

describe('a viagem de barco', () => {
  it('as boas-vindas trazem as viagens do Barqueiro', () => {
    const { conn } = guarapiranga();
    const welcome = conn.ofType('welcome')[0] ?? conn.ofType('zone')[0];
    const barqueiros = welcome!.npcs.filter((n) => n.e.name === 'Barqueiro');
    expect(barqueiros.map((b) => b.trips)).toEqual(
      expect.arrayContaining([[{ to: 'chegada-ilha-do-veu', name: 'a Ilha do Véu', price: 0 }], [{ to: 'barqueiro', name: 'o Refúgio', price: 0 }]]),
    );
  });

  it('ida: do lado dele, desce na ponta do atracadouro da ilha; volta: desce na frente do Barqueiro do Refúgio', () => {
    const { world, conn, player, run, npcOf } = guarapiranga();
    standAt(player, 49.6, 63.3); // na frente do Barqueiro do Refúgio
    conn.clear();
    world.travel(player, npcOf('barqueiro').id, 'chegada-ilha-do-veu');
    run(TICK_MS);
    expect(feetAt(player.fx, player.fy)).toEqual({ x: 172.4, y: 148 });
    expect(conn.all().map((m) => m.t).filter((t) => t === 'trip' || t === 'teleport')).toEqual(['trip', 'teleport']);
    expect(conn.ofType('trip')[0]).toEqual({ t: 'trip', name: 'a Ilha do Véu' });
    expect(conn.ofType('sys').at(-1)!.text).toBe('Você atravessou até a Ilha do Véu.');

    // na ilha: anda até o Barqueiro de lá e volta
    const island = npcOf('barqueiro_ilha');
    const there = feetAt(island.x, island.y);
    standAt(player, there.x + 1, there.y);
    conn.clear();
    world.travel(player, island.id, 'barqueiro');
    run(TICK_MS);
    const back = feetAt(player.fx, player.fy);
    expect(Math.hypot(back.x - 49.6, back.y - 63.3)).toBeLessThan(0.5);
    expect(conn.ofType('sys').at(-1)!.text).toBe('Você atravessou até o Refúgio.');
  });

  it('longe dele, viagem que ele não faz ou desmaiado: não vai', () => {
    const { world, conn, player, run, npcOf } = guarapiranga();
    const barqueiro = npcOf('barqueiro');
    standAt(player, 60, 50); // longe do atracadouro
    world.travel(player, barqueiro.id, 'chegada-ilha-do-veu');
    standAt(player, 49.6, 63.3);
    world.travel(player, barqueiro.id, 'chegada-capao'); // essa ele não faz
    world.travel(player, npcOf('iracema_guarapiranga').id, 'chegada-ilha-do-veu'); // ela não tem canoa
    run(TICK_MS);
    expect(conn.ofType('fail').map((f) => f.reason)).toEqual(['too_far', 'cant_trade', 'cant_trade']);
    expect(feetAt(player.fx, player.fy)).toEqual({ x: 49.6, y: 63.3 });
  });
});

describe('a viagem paga (o preço em data/npcs.json)', () => {
  it('cobra o ouro; sem ouro, não leva', () => {
    const PX = 32;
    const spawn: TiledObject = { id: 1, name: 'spawn', x: 2 * PX, y: 2 * PX, point: true };
    const dock: TiledObject = { id: 2, name: 'outra-margem', x: 20 * PX, y: 5 * PX, point: true };
    const map = GameMap.fromTiled(
      { width: 24, height: 8, tilewidth: PX, tileheight: PX, orientation: 'orthogonal', tilesets: [], layers: [{ type: 'objectgroup', name: 'pontos', objects: [spawn, dock] }] },
      'lago',
    );
    const ferry = parseNpcDefs({ balsa: { nome: 'Balseiro', mapa: 'lago', x: 3, y: 3, viagens: [{ para: 'outra-margem', nome: 'a outra margem', preco: 5 }] } });
    const clock = new FakeClock();
    const world = new World(map, { now: clock.now, random: () => 0.5, items, npcs: ferry });
    const conn = new FakeConn();
    const joined = world.join('Ana', conn);
    if (!joined.ok) throw new Error(joined.reason);
    const player = joined.player;
    const id = [...world.npcs.values()][0]!.id;
    const flush = () => {
      clock.advance(TICK_MS);
      world.tick();
    };
    standAt(player, 3, 3.8);
    player.inventory.gold = 3;
    world.travel(player, id, 'outra-margem');
    flush();
    expect(conn.ofType('fail').at(-1)).toMatchObject({ reason: 'no_gold' });
    player.inventory.gold = 12;
    world.travel(player, id, 'outra-margem');
    flush();
    expect(player.inventory.gold).toBe(7);
    expect(feetAt(player.fx, player.fy)).toEqual({ x: 20, y: 5 });
    expect(conn.ofType('sys').at(-1)!.text).toBe('Você atravessou até a outra margem (5 de ouro).');
  });
});
