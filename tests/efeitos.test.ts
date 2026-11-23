// Efeitos com tempo (poções, etapa 2; pedido do dono, 23/11: "a banana ao invés de dar vida dar destreza por
// determinado tempo / agua de coco dar mais espirito / a poção de vida ... faz com que a vida suba mais rápido por
// 3 minutos"). A Banana dá +5 de Destreza, a Água de Coco +5 de Espírito e as garrafadas fazem a vida voltar 3× mais
// rápido fora de luta, tudo por 3 minutos. Um de cada tipo por vez: o mais novo toma o lugar. Sair do jogo acaba com eles.

import { describe, expect, it } from 'vitest';
import { loadItemDefs, parseItemDefs } from '../src/server/items';
import { Tuning } from '../src/server/tuning';
import { World } from '../src/server/world';
import { TICK_MS } from '../src/shared/constants';
import { effectLabel, useLabel } from '../src/shared/items';
import { GameMap, type TiledObject } from '../src/shared/map';
import { maxHpFor } from '../src/shared/progression';
import { FakeClock, FakeConn } from './helpers';

describe('os efeitos em data/items.json', () => {
  it('Banana: +5 de Destreza; Água de Coco: +5 de Espírito; garrafadas: a vida volta 3× mais rápido; tudo por 3 min', () => {
    const items = loadItemDefs();
    expect(items.get('banana')!.effect).toEqual({ attrs: { destreza: 5 }, regen: 0, durationMs: 180_000 });
    expect(items.get('agua_coco')!.effect).toEqual({ attrs: { espirito: 5 }, regen: 0, durationMs: 180_000 });
    for (const id of ['garrafada_pequena', 'garrafada', 'garrafada_grande']) expect(items.get(id)!.effect).toEqual({ attrs: {}, regen: 3, durationMs: 180_000 });
    expect(effectLabel(items.get('banana')!.effect!)).toBe('+5 de Destreza por 3 min');
    expect(effectLabel(items.get('garrafada')!.effect!)).toBe('a vida volta 3× mais rápido fora de luta por 3 min');
    expect(effectLabel({ attrs: { forca: 2, vitalidade: 4 }, regen: 0, durationMs: 30_000 })).toBe('+2 de Força e +4 de Vitalidade por 30 s');
    // numa frase, para a loja e o atalho
    expect(useLabel(items.get('banana')!)).toBe('+5 de Destreza por 3 min');
    expect(useLabel(items.get('garrafada')!)).toBe('cura 40% da vida e a vida volta 3× mais rápido fora de luta por 3 min');
    expect(useLabel(items.get('erva_arruda')!)).toBe('cura 30');
  });

  it('o arquivo é conferido (e explica em português)', () => {
    const base = { nome: 'Teste', preco: 1, tipo: 'consumivel' };
    expect(() => parseItemDefs({ a: { ...base, efeito: { sorte: 3, minutos: 1 } } })).toThrow(/"sorte" não existe/);
    expect(() => parseItemDefs({ a: { ...base, efeito: { minutos: 1 } } })).toThrow(/está sozinho/);
    expect(() => parseItemDefs({ a: { ...base, efeito: { destreza: 5 } } })).toThrow(/"minutos" precisa ser um número/);
    expect(() => parseItemDefs({ a: { ...base, efeito: { destreza: 5, minutos: 120 } } })).toThrow(/de 0,1 a 60/);
    expect(() => parseItemDefs({ a: { ...base, efeito: { destreza: 2.5, minutos: 1 } } })).toThrow(/inteiro de 1 a 50/);
    expect(() => parseItemDefs({ a: { ...base, efeito: { vidaVolta: 20, minutos: 1 } } })).toThrow(/de 1 a 10/);
    expect(() => parseItemDefs({ a: { nome: 'Chapéu', preco: 1, tipo: 'equipamento', parte: 'cabeca', efeito: { forca: 1, minutos: 1 } } })).toThrow(/só vale para consumíveis/);
  });
});

// ---------- no mundo ----------

const items = parseItemDefs({
  banana: { nome: 'Banana', preco: 5, tipo: 'consumivel', efeito: { destreza: 5, minutos: 3 }, recargaMs: 3000, atalho: 1 },
  forte: { nome: 'Forte', preco: 5, tipo: 'consumivel', efeito: { destreza: 20, vitalidade: 4, minutos: 1 }, recargaMs: 1000 },
  garrafada: { nome: 'Garrafada', preco: 35, tipo: 'consumivel', curaPorcento: 40, efeito: { vidaVolta: 3, minutos: 3 }, recargaMs: 10_000, atalho: 2 },
});

const PX = 32;
function metricMap(id = 'praca'): GameMap {
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

function setup() {
  const clock = new FakeClock();
  const world = new World(metricMap(), { now: clock.now, random: () => 0, items });
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
  const use = (item: string) => {
    player.inventory.add(item, 1);
    world.itemAction(player, 'use', player.inventory.slots.findIndex((stack) => stack?.item === item));
  };
  return { world, clock, conn, player, run, use };
}

const lastEffects = (conn: FakeConn) => conn.ofType('effects').at(-1)!.list;

describe('os efeitos no jogo', () => {
  it('a Banana com a vida cheia: vale (não é para curar); +5 de Destreza por 3 min, e quem está perto vê a mordida', () => {
    const { world, conn, player, run } = setup();
    const other = new FakeConn();
    world.join('Beto', other);
    run(TICK_MS);
    expect(player.hp).toBe(player.maxHp);
    world.adminSetLevel(player, 3);
    world.addAttribute(player, 'destreza');
    use(player, 'banana');
    run(TICK_MS);
    expect(other.ofType('consume').at(-1)).toEqual({ t: 'consume', id: player.id, it: 'banana' });
    expect(lastEffects(conn)).toEqual([{ k: 'destreza', it: 'banana', v: 5, ms: 180_000 - TICK_MS }]);
    expect(player.effectiveAttributes().destreza).toBe(6); // 1 ponto posto + 5 da banana
    expect(conn.ofType('stats').at(-1)!.stats).toMatchObject({ attrs: { destreza: 1 }, attrBonus: { destreza: 5 }, attrPoints: 5 });
    run(180_000);
    expect(lastEffects(conn)).toEqual([]);
    expect(player.effectiveAttributes().destreza).toBe(1);
    expect(conn.ofType('stats').at(-1)!.stats.attrBonus.destreza).toBe(0);

    function use(p: typeof player, item: string): void {
      p.inventory.add(item, 1);
      world.itemAction(p, 'use', p.inventory.slots.findIndex((stack) => stack?.item === item));
    }
  });

  it('comer de novo recomeça o tempo (não soma)', () => {
    const { conn, run, use } = setup();
    use('banana');
    run(60_000);
    use('banana');
    run(TICK_MS);
    expect(lastEffects(conn)).toEqual([{ k: 'destreza', it: 'banana', v: 5, ms: 180_000 - TICK_MS }]);
  });

  it('o efeito vale no jogo: a Destreza dele deixa atirar mais cedo; a Vitalidade dele dá vida (e tira quando acaba)', () => {
    const { world, clock, player, run, use } = setup();
    const base = maxHpFor(1);
    use('forte'); // +20 de Destreza e +4 de Vitalidade por 1 min
    expect(player.maxHp).toBe(base + 20);
    expect(player.hp).toBe(base + 20); // a vida acompanha a máxima que cresceu
    world.shoot(player, 1, 0);
    clock.advance(380); // o intervalo com 20 de Destreza: 360 ms (o de sempre: 450)
    world.shoot(player, 2, 0);
    expect(world.projectiles.size).toBe(2);
    run(60_000);
    expect(player.maxHp).toBe(base);
    expect(player.hp).toBe(base);
  });

  it('a garrafada: cura e, por 3 min, a vida volta 3× mais rápido — só fora de luta', () => {
    const { world, clock, player, run, use } = setup();
    world.adminSetLevel(player, 11); // 180 de vida
    player.hp = 20;
    use('garrafada'); // +72
    expect(player.hp).toBe(92);
    // apanhando agora: nem com a garrafada a vida volta sozinha
    (world as unknown as { damage(t: unknown, amount: number, by: number, now: number): void }).damage(player, 2, 0, clock.now());
    expect(player.hp).toBe(90);
    run(7800);
    expect(player.hp).toBe(90);
    // depois dos 8 s: 1,5% × 3 = 4,5% de 180 = 8,1 por segundo
    run(1000);
    expect(player.hp).toBe(98);
    run(1000);
    expect(player.hp).toBe(106);
  });

  it('mudar de mapa não acaba com os efeitos: o navegador do mapa novo recebe a lista', () => {
    const { world, clock, conn, player, run, use } = setup();
    use('banana');
    run(TICK_MS);
    world.leave(player);
    const other = new World(metricMap('outra'), { now: clock.now, random: () => 0, items });
    other.adopt(player, { x: 3, y: 3 });
    clock.advance(TICK_MS);
    other.tick();
    expect(lastEffects(conn)).toEqual([{ k: 'destreza', it: 'banana', v: 5, ms: 180_000 - 2 * TICK_MS }]);
    expect(player.effectiveAttributes().destreza).toBe(5);
  });

  it('pelo painel: quanto dura e o que dá', () => {
    const tuning = new Tuning({ monstros: {}, itens: { banana: { nome: 'Banana', preco: 5, tipo: 'consumivel', efeito: { destreza: 5, minutos: 3 } } }, npcs: {} }, [], null);
    const campos = tuning.view().grupos.find((g) => g.arquivo === 'itens')!.lista.find((e) => e.id === 'banana')!.campos.map((c) => [c.campo, c.valor]);
    expect(campos).toEqual(expect.arrayContaining([['efeito.minutos', 3], ['efeito.destreza', 5]]));
    expect(campos.map(([c]) => c)).not.toContain('efeito.espirito'); // só o que ela dá
    expect(tuning.set('itens', 'banana', 'efeito.destreza', 7)).toEqual({ ok: true });
    expect(tuning.set('itens', 'banana', 'efeito.minutos', 5)).toEqual({ ok: true });
    expect(tuning.items.get('banana')!.effect).toEqual({ attrs: { destreza: 7 }, regen: 0, durationMs: 300_000 });
    expect(tuning.set('itens', 'banana', 'efeito.minutos', 500).ok).toBe(false);
  });
});
