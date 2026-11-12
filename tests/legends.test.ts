// Criaturas novas das lendas (por enquanto, da Represa Billings): existem nos dados de verdade, usam golpes
// que já existem e o que deixam vale ouro na loja.

import { describe, expect, it } from 'vitest';
import { loadItemDefs } from '../src/server/items';
import { loadMonsterDefs } from '../src/server/monsters';
import { sellPrice } from '../src/shared/items';
import { degreesOfDir } from '../src/shared/movement';

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

  it('boto: ataca quem chega perto, mantém distância e lança jato d’água', () => {
    expect(monsters.get('boto')).toMatchObject({
      name: 'Boto Encantado',
      level: 6,
      aggressive: true,
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
  it('o jacaré avisa e dá o bote em quem chega perto; o boto lança jato d’água em quem chega perto', async () => {
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

    // jacaré: agressivo, percebe a 5 tiles
    const lago = arena('jacare');
    const ana = new FakeConn();
    const joined = lago.join('Ana', ana);
    if (!joined.ok) throw new Error(joined.reason);
    joined.player.x = 2;
    joined.player.y = 1;
    run(lago, 3000);
    expect(ana.ofType('warn').length).toBeGreaterThan(0); // avisou o golpe no chão
    expect(ana.ofType('hit').some((h) => h.id === joined.player.id)).toBe(true); // e acertou (Ana ficou parada)

    // boto: agressivo, percebe a 6 tiles e ataca de longe, sem ninguém mexer com ele
    const rio = arena('boto');
    const beto = new FakeConn();
    const b = rio.join('Beto', beto);
    if (!b.ok) throw new Error(b.reason);
    b.player.x = 1;
    b.player.y = 1;
    run(rio, 4000);
    expect(beto.ofType('shot').some((s) => s.kind === 'agua' && s.by !== b.player.id)).toBe(true);
  });
});

describe('Iara: o canto que puxa para a água', () => {
  async function arena() {
    const { World } = await import('../src/server/world');
    const { GameMap } = await import('../src/shared/map');
    const { TICK_MS } = await import('../src/shared/constants');
    const { FakeClock, FakeConn, tiledFromAscii } = await import('./helpers');
    const clock = new FakeClock();
    const world = new World(
      GameMap.fromTiled(tiledFromAscii(['............', '............', '............'], { x: 1, y: 1 }, [{ monster: 'iara', x: 7, y: 1, w: 1, h: 1 }])),
      { now: clock.now, random: () => 0, monsters: loadMonsterDefs(), items: loadItemDefs() },
    );
    const conn = new FakeConn();
    const joined = world.join('Ana', conn);
    if (!joined.ok) throw new Error(joined.reason);
    const player = joined.player;
    player.maxHp = player.hp = 5000; // o teste é do canto, não do dano
    const run = (ms: number) => {
      for (let t = 0; t < ms; t += TICK_MS) {
        clock.advance(TICK_MS);
        world.tick();
      }
    };
    // primeiro de longe (fora do alcance dela, mas já vendo), como quem chega andando
    player.x = 0;
    player.y = 1;
    run(TICK_MS);
    player.x = 3; // a 4 tiles da Iara (o canto pega até 5)
    const iara = [...world.monsters.values()][0]!;
    return { world, conn, player, run, clock, iara };
  }

  it('o arquivo diz como é o canto', () => {
    expect(loadMonsterDefs().get('iara')!.song).toMatchObject({ everyMs: 10000, range: 5, windupMs: 1300, durationMs: 3000, pullEveryMs: 450 });
    expect(loadMonsterDefs().get('saci')!.song).toBeNull();
  });

  it('avisa no chão; quem fica na área é encantado: não anda e é puxado para perto dela', async () => {
    const { world, conn, player, run, iara } = await arena();
    run(200);
    const warn = conn.ofType('warn').find((w) => w.id === iara.id);
    expect(warn?.ms).toBe(1300);
    expect(conn.ofType('fx').some((f) => f.kind === 'song')).toBe(true);
    expect(conn.ofType('say').some((s) => s.id === iara.id)).toBe(true);
    expect(conn.ofType('charm')).toHaveLength(0); // ainda é só o aviso

    run(1300);
    expect(conn.ofType('charm')[0]).toEqual({ t: 'charm', ms: 3000 });
    // tentar andar não adianta
    const { LEFT } = await import('../src/shared/dir');
    const before = { x: player.x, y: player.y };
    world.requestWalk(player, 1, degreesOfDir(LEFT));
    run(100);
    expect(conn.ofType('pull').length === 0 ? { x: player.x, y: player.y } : before).toEqual(before);
    // vai sendo puxado para perto dela
    const startDistance = Math.max(Math.abs(player.x - iara.x), Math.abs(player.y - iara.y));
    run(1500);
    expect(conn.ofType('pull').length).toBeGreaterThan(0);
    expect(Math.max(Math.abs(player.x - iara.x), Math.abs(player.y - iara.y))).toBeLessThan(startDistance);
    // o encanto acaba sozinho
    run(2000);
    expect(conn.ofType('charm').at(-1)).toEqual({ t: 'charm', ms: 0 });
  });

  it('a esquiva quebra o encanto na hora', async () => {
    const { world, conn, player, run } = await arena();
    run(1600); // aviso + encanto
    expect(conn.ofType('charm')[0]?.ms).toBe(3000);
    const { LEFT } = await import('../src/shared/dir');
    const x = player.x;
    world.requestWalk(player, 1, degreesOfDir(LEFT), true); // esquiva para longe
    run(100);
    expect(conn.ofType('charm').at(-1)).toEqual({ t: 'charm', ms: 0 });
    expect(player.charmedBy).toBeNull();
    expect(player.x).toBeLessThan(x);
  });

  it('quem esquiva na hora do canto, ou sai da área antes, escapa', async () => {
    const a = await arena();
    a.run(1200); // quase no fim do aviso
    const { LEFT } = await import('../src/shared/dir');
    a.world.requestWalk(a.player, 1, degreesOfDir(LEFT), true); // esquiva: invencível bem na hora
    a.run(300);
    expect(a.conn.ofType('charm')).toHaveLength(0);

    const b = await arena();
    b.run(200);
    b.player.x = 0; // saiu da área (a Iara está em 7, o canto pega até 5)
    b.run(1300);
    expect(b.conn.ofType('charm')).toHaveLength(0);
  });

  it('a escama da Iara vale um bom ouro na Dona Iracema', () => {
    expect(loadMonsterDefs().get('iara')!.drops.map((d) => d.item)).toContain('escama_iara');
    expect(sellPrice(loadItemDefs().get('escama_iara')!, 50)).toBe(45);
  });
});

describe('o canto no painel do administrador', () => {
  it('a Iara tem os campos do canto; quem não canta, não', async () => {
    const { Tuning } = await import('../src/server/tuning');
    const { loadMaps } = await import('../src/server/server');
    const tuning = Tuning.load(null, loadMaps());
    const iara = tuning.view().grupos.find((g) => g.arquivo === 'monstros')!.lista.find((m) => m.id === 'iara')!;
    expect(iara.campos.filter((c) => c.campo.startsWith('canto.')).map((c) => c.campo)).toEqual([
      'canto.cadaMs',
      'canto.alcance',
      'canto.preparoMs',
      'canto.duracaoMs',
      'canto.puxaACadaMs',
    ]);
    expect(tuning.set('monstros', 'iara', 'canto.alcance', 3)).toEqual({ ok: true });
    expect(tuning.monsters.get('iara')!.song!.range).toBe(3);
    expect(tuning.set('monstros', 'iara', 'canto.preparoMs', 100)).toEqual({ ok: false, erro: expect.stringMatching(/"preparoMs" precisa ser pelo menos 300/) });
    expect(tuning.set('monstros', 'sagui', 'canto.alcance', 3)).toEqual({ ok: false, erro: 'O campo "Alcance do canto (tiles)" não vale para Sagui Travesso.' });
  });
});
