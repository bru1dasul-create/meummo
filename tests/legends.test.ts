// Criaturas novas das lendas (por enquanto, da Represa Billings): existem nos dados de verdade, usam golpes
// que já existem e o que deixam vale ouro na loja.

import { describe, expect, it } from 'vitest';
import { loadItemDefs } from '../src/server/items';
import { loadMonsterDefs } from '../src/server/monsters';
import { sellPrice } from '../src/shared/items';

describe('criaturas da Represa Billings', () => {
  const monsters = loadMonsterDefs();
  const items = loadItemDefs();

  it('jacaré: agressivo, lento na terra, abocanhada em linha com aviso longo', () => {
    expect(monsters.get('jacare')).toMatchObject({
      name: 'Jacaré Mutante',
      level: 5,
      aggressive: true,
      attack: { kind: 'strike', range: 2, windupMs: 750 },
    });
    expect(monsters.get('jacare')!.stepMs).toBeGreaterThan(monsters.get('capelobo')!.stepMs); // mais lento que o capelobo
  });

  it('boto: só ataca quem mexe com ele, mantém distância e lança jato d’água', () => {
    expect(monsters.get('boto')).toMatchObject({
      name: 'Boto Encantado',
      level: 6,
      aggressive: false,
      attack: { kind: 'projectile', projectile: 'agua', minDistance: 3 },
    });
  });

  it('o dente de jacaré vale ouro na Dona Iracema', () => {
    expect(monsters.get('jacare')!.drops.map((d) => d.item)).toContain('dente_jacare');
    expect(sellPrice(items.get('dente_jacare')!, 50)).toBe(7);
  });
});

describe('jacaré e boto lutando de verdade (dados reais numa arena)', () => {
  // imports aqui embaixo para o teste ficar junto do que usa
  it('o jacaré avisa e dá o bote em quem chega perto; o boto só revida depois de apanhar', async () => {
    const { World } = await import('../src/server/world');
    const { GameMap } = await import('../src/shared/map');
    const { TICK_MS } = await import('../src/shared/constants');
    const { FakeClock, FakeConn, tiledFromAscii } = await import('./helpers');
    const clock = new FakeClock();
    const monsters = loadMonsterDefs();
    const items = loadItemDefs();
    const arena = (monster: string) =>
      new World(GameMap.fromTiled(tiledFromAscii(['..........', '..........', '..........'], { x: 1, y: 1 }, [{ monster, x: 4, y: 1, w: 1, h: 1 }])), {
        now: clock.now,
        random: () => 0,
        monsters,
        items,
      });
    const run = (world: InstanceType<typeof World>, ms: number) => {
      for (let t = 0; t < ms; t += TICK_MS) {
        clock.advance(TICK_MS);
        world.tick();
      }
    };

    // jacaré: agressivo, percebe a 3 tiles
    const lago = arena('jacare');
    const ana = new FakeConn();
    const joined = lago.join('Ana', ana);
    if (!joined.ok) throw new Error(joined.reason);
    joined.player.x = 2;
    joined.player.y = 1;
    run(lago, 3000);
    expect(ana.ofType('warn').length).toBeGreaterThan(0); // avisou o golpe no chão
    expect(ana.ofType('hit').some((h) => h.id === joined.player.id)).toBe(true); // e acertou (Ana ficou parada)

    // boto: pacífico até apanhar
    const rio = arena('boto');
    const beto = new FakeConn();
    const b = rio.join('Beto', beto);
    if (!b.ok) throw new Error(b.reason);
    b.player.x = 1;
    b.player.y = 1;
    run(rio, 3000);
    expect(beto.ofType('shot').filter((s) => s.by !== b.player.id)).toHaveLength(0); // ninguém mexeu com ele
    rio.shoot(b.player, 1, 0); // pedrada no boto
    run(rio, 4000);
    expect(beto.ofType('shot').some((s) => s.kind === 'agua')).toBe(true); // revidou com jato d'água
  });
});
