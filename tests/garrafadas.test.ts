// Garrafadas e a vida que volta sozinha (pedido do dono, 23/11): três garrafadas que curam uma parte da vida máxima
// (Pequena 25%, Média 40%, Grande 60%), com 10 s entre um gole e outro; o Fôlego saiu do jogo novo ("retira o Fôlego,
// tecla e como poder"); a vida volta aos poucos depois de alguns segundos sem lutar ("sem combate, lentamente").

import { describe, expect, it } from 'vitest';
import { KeyBindings, KEY_ACTIONS, KEYS_STORAGE } from '../src/client/novo/keys';
import { loadItemDefs, parseItemDefs } from '../src/server/items';
import { loadMonsterDefs } from '../src/server/monsters';
import { loadNpcDefs } from '../src/server/npcs';
import { Tuning, type BaseData } from '../src/server/tuning';
import { World, type Player } from '../src/server/world';
import { DEFAULT_COMBAT_RULES } from '../src/shared/combatRules';
import { TICK_MS } from '../src/shared/constants';
import { healAmount, healLabel, pickQuickItem } from '../src/shared/items';
import { GameMap, type TiledObject } from '../src/shared/map';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

const items = loadItemDefs();

describe('as garrafadas (data/items.json)', () => {
  it('três tamanhos, curando uma parte da vida máxima, e 10 s até o próximo gole', () => {
    expect([...['garrafada_pequena', 'garrafada', 'garrafada_grande'].map((id) => {
      const def = items.get(id)!;
      return [def.name, def.healPct, def.heal, def.cooldownMs, def.quick];
    })]).toEqual([
      ['Garrafada Pequena', 25, 0, 10_000, 2],
      ['Garrafada Média', 40, 0, 10_000, 2],
      ['Garrafada Grande', 60, 0, 10_000, 2],
    ]);
    // a comida espera só 3 s (a Banana e a Água de Coco não curam mais: dão atributos por um tempo)
    expect(items.get('banana')).toMatchObject({ heal: 0, cooldownMs: 3000 });
  });

  it('a Pequena se compra na vila, a Média na Xiovanna e a Grande cai dos chefes', () => {
    const npcs = loadNpcDefs();
    const sells = (id: string) => npcs.get(id)!.shop!.sells;
    expect(sells('iracema')).toContain('garrafada_pequena');
    expect(sells('iracema_guarapiranga')).toContain('garrafada_pequena');
    expect(sells('budega')).toEqual(expect.arrayContaining(['garrafada_pequena', 'garrafada']));
    expect(Object.values(Object.fromEntries(npcs)).some((npc) => npc.shop?.sells.includes('garrafada_grande'))).toBe(false);
    const monsters = loadMonsterDefs();
    for (const boss of ['mula_sem_cabeca', 'iara']) expect(monsters.get(boss)!.drops.map((d) => d.item)).toContain('garrafada_grande');
  });

  it('o arquivo é conferido: a porcentagem só em consumível, de 0 a 100, e consumível precisa curar', () => {
    const base = { nome: 'Teste', preco: 1, tipo: 'consumivel' };
    expect(parseItemDefs({ a: { ...base, curaPorcento: 30 } }).get('a')!.healPct).toBe(30);
    expect(() => parseItemDefs({ a: { ...base, curaPorcento: 130 } })).toThrow(/0 a 100/);
    expect(() => parseItemDefs({ a: { ...base } })).toThrow(/curaPorcento/);
    expect(() => parseItemDefs({ a: { nome: 'Chapéu', preco: 1, tipo: 'equipamento', parte: 'cabeca', curaPorcento: 10 } })).toThrow(/só vale para consumíveis/);
  });

  it('quanto cura e o texto: a porcentagem vale da vida máxima de quem bebe', () => {
    const media = items.get('garrafada')!;
    expect(healAmount(media, 180)).toBe(72);
    expect(healAmount(media, 108)).toBe(43);
    expect(healLabel(media)).toBe('40% da vida');
    expect(healLabel(items.get('erva_arruda')!)).toBe('30');
    expect(healLabel(items.get('banana')!)).toBe(''); // não cura
    expect(healLabel({ heal: 10, healPct: 25 })).toBe('10 + 25% da vida');
  });

  it('o atalho do remédio usa o que mais cura para a vida de quem joga', () => {
    const inv = { slots: [{ item: 'erva_arruda', n: 3 }, { item: 'garrafada_pequena', n: 2 }, null], equipped: {}, gold: 0 } as never;
    expect(pickQuickItem(2, items, inv, 100)!.item).toBe('erva_arruda'); // 30 contra 25
    expect(pickQuickItem(2, items, inv, 180)!.item).toBe('garrafada_pequena'); // 45 contra 30
  });
});

// ---------- no mundo ----------

const PX = 32;

/** Um mapa do mundo novo (em metros), aberto, com o jogador no meio. */
function metricMap(): GameMap {
  const spawn: TiledObject = { id: 0, name: 'spawn', x: 8 * PX, y: 5 * PX, point: true };
  return GameMap.fromTiled(
    {
      width: 30,
      height: 12,
      tilewidth: PX,
      tileheight: PX,
      orientation: 'orthogonal',
      properties: [{ name: 'nome', type: 'string', value: 'praca' }],
      tilesets: [],
      layers: [
        { type: 'objectgroup', name: 'colisao', objects: [] },
        { type: 'objectgroup', name: 'pontos', objects: [spawn] },
      ],
    },
    'praca',
  );
}

function setup(map = metricMap()) {
  const clock = new FakeClock();
  const world = new World(map, { now: clock.now, random: () => 0, items });
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
  run(TICK_MS);
  return { world, clock, conn, player, run };
}

/** Põe o item na mochila e devolve o espaço dele. */
function give(player: Player, item: string, n = 1): number {
  player.inventory.add(item, n);
  return player.inventory.slots.findIndex((stack) => stack?.item === item);
}

describe('beber garrafada', () => {
  it('cura a porcentagem da vida máxima; depois, 10 s sem beber nem comer nada', () => {
    const { world, conn, player, run, clock } = setup();
    world.adminSetLevel(player, 11); // 180 de vida máxima
    expect(player.maxHp).toBe(180);
    player.hp = 50;
    player.lastDamagedAt = clock.now(); // no meio da luta (a vida não volta sozinha agora)
    world.itemAction(player, 'use', give(player, 'garrafada', 2));
    expect(player.hp).toBe(122); // 40% de 180 = 72
    run(TICK_MS);
    expect(conn.ofType('heal').at(-1)).toEqual({ t: 'heal', id: player.id, amount: 72, hp: 122, it: 'garrafada' }); // quem vê desenha o gole
    world.itemAction(player, 'use', give(player, 'banana'));
    run(TICK_MS);
    expect(conn.ofType('fail').at(-1)).toMatchObject({ reason: 'cooldown' });
    expect(player.hp).toBe(122);
    clock.advance(10_000);
    world.itemAction(player, 'use', player.inventory.slots.findIndex((s) => s?.item === 'garrafada'));
    expect(player.hp).toBe(180); // não passa da máxima
  });
});

describe('a vida que volta sozinha', () => {
  it('só depois de 8 s sem apanhar e sem atacar, 1,5% da vida máxima por segundo (sem perder a fração)', () => {
    const { world, player, run, clock } = setup();
    expect(DEFAULT_COMBAT_RULES).toMatchObject({ regenDelayMs: 8000, regenPctPerSecond: 1.5 });
    player.maxHp = 200; // 3 por segundo
    player.hp = 100;
    (world as unknown as { damage(t: unknown, amount: number, by: number, now: number): void }).damage(player, 10, 0, clock.now());
    expect(player.hp).toBe(90);
    run(7800);
    expect(player.hp).toBe(90); // ainda esperando
    run(400);
    expect(player.hp).toBe(93);
    run(2000);
    expect(player.hp).toBe(99);
    // com 60 de vida máxima, 0,9 por segundo: em 10 s, 9 (a fração junta de um segundo para o outro)
    player.maxHp = 60;
    player.hp = 10;
    run(10_000);
    expect(player.hp).toBe(19);
  });

  it('atacar também é lutar: atirando, a vida não volta', () => {
    const { world, player, run } = setup();
    player.maxHp = 200;
    player.hp = 100;
    run(9000);
    expect(player.hp).toBeGreaterThan(100); // descansando, volta
    const resting = player.hp;
    world.shoot(player, 1, 0);
    run(7800);
    expect(player.hp).toBe(resting);
    run(400);
    expect(player.hp).toBe(resting + 3);
  });
});

describe('o Fôlego saiu do jogo novo', () => {
  it('no mapa novo, o servidor não cura com ele; no jogo antigo, continua', () => {
    const novo = setup();
    novo.player.hp = 10;
    novo.world.useSkill(novo.player, 1, 0);
    novo.run(TICK_MS);
    expect(novo.player.hp).toBe(10);
    expect(novo.conn.ofType('heal')).toHaveLength(0);

    const antigo = setup(GameMap.fromTiled(tiledFromAscii(['.'.repeat(10), '.'.repeat(10)], { x: 1, y: 1 })));
    antigo.player.hp = 10;
    antigo.world.useSkill(antigo.player, 1, 0);
    antigo.run(TICK_MS);
    expect(antigo.player.hp).toBeGreaterThan(10);
  });

  it('a tecla dele saiu: o E fica livre, e a guardada some sem estragar as outras', () => {
    expect(KEY_ACTIONS.map((a) => a.action)).not.toContain('folego');
    const data = new Map([[KEYS_STORAGE, JSON.stringify({ folego: { code: 'KeyE', label: 'E' }, pular: { code: 'KeyX', label: 'X' } })]]);
    const keys = new KeyBindings({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) });
    expect(keys.actionOf('KeyE')).toBeNull();
    expect(keys.actionOf('KeyX')).toBe('pular');
  });
});

describe('pelo painel de ajustes', () => {
  const empty = (): BaseData => ({ monstros: {}, itens: {}, npcs: {} });

  it('a vida que volta sozinha (o tempo e a porcentagem) e a cura em % das garrafadas', () => {
    const tuning = new Tuning(empty(), [], null);
    expect(tuning.set('combate', 'jogador', 'vidaVoltaSegundos', 12)).toEqual({ ok: true });
    expect(tuning.set('combate', 'jogador', 'vidaVoltaPorcento', 2.5)).toEqual({ ok: true });
    expect(tuning.combat).toMatchObject({ regenDelayMs: 12_000, regenPctPerSecond: 2.5 });
    expect(tuning.set('combate', 'jogador', 'vidaVoltaPorcento', 30).ok).toBe(false);

    const withItems = new Tuning({ monstros: {}, itens: { garrafada: { nome: 'Garrafada Média', preco: 35, tipo: 'consumivel', curaPorcento: 40, recargaMs: 10000 } }, npcs: {} }, [], null);
    const field = withItems.view().grupos.find((g) => g.arquivo === 'itens')!.lista.find((e) => e.id === 'garrafada')!.campos.find((c) => c.campo === 'curaPorcento')!;
    expect(field.valor).toBe(40);
    expect(withItems.set('itens', 'garrafada', 'curaPorcento', 50)).toEqual({ ok: true });
    expect(withItems.items.get('garrafada')!.healPct).toBe(50);
    expect(withItems.set('itens', 'garrafada', 'curaPorcento', 0).ok).toBe(false); // aí não curaria nada
  });
});
