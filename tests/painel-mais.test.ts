// Painel do administrador, mais coisas (pedido do dono: "todos esses"): nível e XP de um jogador, a posição dos NPCs
// (no painel e no menu ADM, "trazer para cá"), os monstros por área e as missões, valendo na hora para quem está jogando.

import { describe, expect, it } from 'vitest';
import { Realm } from '../src/server/realm';
import { loadMaps } from '../src/server/server';
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

describe('monstros por área (painel)', () => {
  const base: BaseData = {
    monstros: {
      bicho: { nome: 'Bicho', nivel: 1, vida: 20, xp: 5, passoMs: 1e9, ouro: [1, 2], ataque: { tipo: 'mordida', preparoMs: 400, intervaloMs: 1000, dano: [2, 3] } },
      cobra: { nome: 'Cobra', nivel: 2, vida: 30, xp: 9, passoMs: 1e9, ouro: [1, 2], ataque: { tipo: 'bote', preparoMs: 400, intervaloMs: 1000, dano: [3, 4] } },
    },
    itens: {},
    npcs: {},
  };
  const map = () => GameMap.fromTiled(tiledFromAscii(['..........', '..........', '..........', '..........'], { x: 1, y: 1 }, [{ monster: 'bicho', x: 4, y: 0, w: 5, h: 4, count: 2 }]), 'vila');

  it('o painel mostra cada área (com o padrão do mapa) e confere o que muda', () => {
    const tuning = new Tuning(structuredClone(base), [map()], null);
    const group = tuning.view().grupos.find((g) => g.arquivo === 'areas')!;
    expect(group.titulo).toBe('Áreas de monstros');
    expect(group.lista[0]).toMatchObject({ id: 'vila#1', campos: [{ campo: 'monstro', valor: 'bicho' }, { campo: 'quantidade', valor: 2 }] });
    expect(tuning.set('areas', 'vila#1', 'quantidade', 6)).toEqual({ ok: true });
    expect(tuning.areas.get('vila#1')).toMatchObject({ monster: 'bicho', count: 6 });
    expect(tuning.set('areas', 'vila#1', 'monstro', 'naoexiste').ok).toBe(false);
    expect(tuning.set('areas', 'vila#1', 'quantidade', 99).ok).toBe(false);
    expect(tuning.set('areas', 'vila#1', 'monstro', 'cobra')).toEqual({ ok: true });
    expect(tuning.areas.get('vila#1')).toMatchObject({ monster: 'cobra', count: 6 });
  });

  it('vale na hora: completa, tira e troca o monstro da área', () => {
    const tuning = new Tuning(structuredClone(base), [map()], null);
    const clock = new FakeClock();
    const realm = new Realm([map()], { now: clock.now, random: () => 0.5, monsters: tuning.monsters, areas: tuning.areas });
    tuning.onChange = (changed) => realm.tuningChanged(changed);
    const world = realm.worlds.get('vila')!;
    const count = (type: string) => [...world.monsters.values()].filter((m) => m.def.id === type).length;
    expect(count('bicho')).toBe(2);
    tuning.set('areas', 'vila#1', 'quantidade', 5);
    expect(count('bicho')).toBe(5);
    tuning.set('areas', 'vila#1', 'quantidade', 1);
    expect(count('bicho')).toBe(1);
    tuning.set('areas', 'vila#1', 'monstro', 'cobra');
    expect(count('bicho')).toBe(0);
    expect(count('cobra')).toBe(1);
    tuning.set('areas', 'vila#1', 'quantidade', 0);
    expect(world.monsters.size).toBe(0);
  });
});

describe('missões pelo painel', () => {
  const base = (): BaseData => ({
    monstros: {
      bicho: { nome: 'Bicho', nivel: 1, vida: 20, xp: 1, passoMs: 1e9, ouro: [1, 2], ataque: { tipo: 'mordida', preparoMs: 400, intervaloMs: 1000, dano: [2, 3] } },
    },
    itens: {
      fruta: { nome: 'Fruta', preco: 5, tipo: 'consumivel', cura: 10 },
      couro: { nome: 'Couro', preco: 6, tipo: 'material' },
    },
    npcs: { velho: { nome: 'Seu Velho', titulo: 'do mato', mapa: 'vila', x: 2, y: 0, fala: 'Oi!' } },
    missoes: {
      espantar: {
        nome: 'Espantar Bichos',
        quemDa: 'velho',
        pedido: 'Espante 3 bichos.',
        concluida: 'Valeu!',
        objetivo: { tipo: 'derrotar', monstro: 'bicho', quantidade: 3, rotulo: 'Espantar 3 bichos' },
        recompensa: { xp: 7, ouro: 10, itens: [{ item: 'fruta', quantidade: 2 }] },
      },
    },
  });
  const vila = () => GameMap.fromTiled(tiledFromAscii(['........', '........', '........'], { x: 1, y: 1 }), 'vila');

  it('o painel mostra cada missão (textos, objetivo e recompensa) e confere o que muda', () => {
    const tuning = new Tuning(base(), [vila()], null);
    const group = tuning.view().grupos.find((g) => g.arquivo === 'missoes')!;
    expect(group.titulo).toBe('Missões');
    const entry = group.lista[0]!;
    expect(entry).toMatchObject({ id: 'espantar', nome: 'Espantar Bichos', detalhe: 'quem dá: Seu Velho · derrotar 3 Bicho' });
    expect(entry.campos.map((c) => c.campo)).toEqual([
      'nome',
      'pedido',
      'concluida',
      'objetivo.rotulo',
      'objetivo.quantidade',
      'objetivo.monstro',
      'nivelMinimo',
      'repetivel',
      'recompensa.xp',
      'recompensa.ouro',
      'recompensa.itens',
    ]);
    expect(entry.campos.find((c) => c.campo === 'recompensa.itens')!.valor).toEqual([{ item: 'fruta', quantidade: 2 }]);

    expect(tuning.set('missoes', 'espantar', 'pedido', 'Espante 5 bichos, por favor.')).toEqual({ ok: true });
    expect(tuning.set('missoes', 'espantar', 'objetivo.quantidade', 5)).toEqual({ ok: true });
    const reward = [
      { item: 'couro', quantidade: 1 },
      { item: 'fruta', quantidade: 4 },
    ];
    expect(tuning.set('missoes', 'espantar', 'recompensa.itens', reward)).toEqual({ ok: true });
    const quest = tuning.quests.get('espantar')!;
    expect(quest).toMatchObject({
      ask: 'Espante 5 bichos, por favor.',
      goal: { kind: 'kill', monster: 'bicho', count: 5 },
      reward: { xp: 7, gold: 10, items: [{ item: 'couro', n: 1 }, { item: 'fruta', n: 4 }] },
    });

    // valor errado: recusado com o motivo, e nada muda
    expect(tuning.set('missoes', 'espantar', 'objetivo.quantidade', 0).ok).toBe(false);
    expect(tuning.set('missoes', 'espantar', 'objetivo.monstro', 'naoexiste').ok).toBe(false);
    expect(tuning.set('missoes', 'espantar', 'recompensa.itens', [{ item: 'naoexiste', quantidade: 1 }]).ok).toBe(false);
    expect(tuning.set('missoes', 'espantar', 'recompensa.itens', [{ item: 'fruta', quantidade: 0 }]).ok).toBe(false);
    expect(tuning.set('missoes', 'espantar', 'pedido', 'a'.repeat(601)).ok).toBe(false);
    expect(tuning.set('missoes', 'espantar', 'nome', '').ok).toBe(false);
    expect(tuning.set('missoes', 'espantar', 'objetivo.item', 'couro').ok).toBe(false); // não é missão de entregar
    expect(quest.goal.count).toBe(5);
    expect(quest.name).toBe('Espantar Bichos');

    // objetivo na tela vazio = o texto automático; "voltar ao padrão" traz o de antes
    expect(tuning.set('missoes', 'espantar', 'objetivo.rotulo', '')).toEqual({ ok: true });
    expect('goalLabel' in quest).toBe(false);
    expect(tuning.reset('missoes', 'espantar', 'objetivo.rotulo')).toEqual({ ok: true });
    expect(quest.goalLabel).toBe('Espantar 3 bichos');
  });

  it('vale na hora: quem está jogando recebe as missões novas, e o objetivo menor já deixa concluir', () => {
    const tuning = new Tuning(base(), [vila()], null);
    const clock = new FakeClock();
    const realm = new Realm([vila()], {
      now: clock.now,
      random: () => 0,
      monsters: tuning.monsters,
      items: tuning.items,
      npcs: tuning.npcs,
      quests: tuning.quests,
    });
    tuning.onChange = (changed) => realm.tuningChanged(changed);
    const conn = new FakeConn();
    const joined = realm.join('Ana', conn);
    if (!joined.ok) throw new Error(joined.reason);
    const player = joined.player;
    const world = realm.worlds.get('vila')!;
    const velho = [...world.npcs.values()][0]!;
    world.questAction(player, 'accept', 'espantar', velho.id);
    expect(player.quests.espantar).toEqual({ state: 'active', count: 0 });
    player.quests.espantar!.count = 2; // derrubou 2 dos 3
    world.questAction(player, 'complete', 'espantar', velho.id);
    expect(player.quests.espantar!.state).toBe('active');

    expect(tuning.set('missoes', 'espantar', 'objetivo.quantidade', 2)).toEqual({ ok: true });
    expect(tuning.set('missoes', 'espantar', 'concluida', 'Dois já está bom!')).toEqual({ ok: true });
    world.tick();
    const sent = conn.ofType('questDefs').at(-1)!.quests.find((q) => q.id === 'espantar')!;
    expect(sent).toMatchObject({ done: 'Dois já está bom!', goal: { count: 2 } });

    world.questAction(player, 'complete', 'espantar', velho.id);
    expect(player.quests.espantar!.state).toBe('done');
    expect(player.xp).toBe(7);
  });

  it('as missões de verdade (data/missoes.json) entram no painel', () => {
    const tuning = Tuning.load(null, loadMaps());
    const group = tuning.view().grupos.find((g) => g.arquivo === 'missoes')!;
    expect(group.lista.map((e) => e.id)).toContain('saguis_encantados');
    expect(group.lista.find((e) => e.id === 'o_despertar')!.campos.map((c) => c.campo)).not.toContain('objetivo.quantidade'); // falar: sem quantidade
  });
});
