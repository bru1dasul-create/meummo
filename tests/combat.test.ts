import { describe, expect, it } from 'vitest';
import { DASH_COOLDOWN_MS, DASH_INVULNERABLE_MS, DEATH_MS, SHOT_COOLDOWN_MS, TICK_MS } from '../src/shared/constants';
import { chebyshev } from '../src/shared/combat';
import { RIGHT, UP } from '../src/shared/dir';
import { GameMap } from '../src/shared/map';
import { DASH_SLOT } from '../src/shared/protocol';
import { loadMonsterDefs, parseMonsterDefs } from '../src/server/monsters';
import { loadMap } from '../src/server/server';
import { parseClientMsg } from '../src/server/validate';
import { World, type Player } from '../src/server/world';
import { FakeClock, FakeConn, tiledFromAscii, type TestZone } from './helpers';

const VALID_ATTACK = { tipo: 'mordida', preparoMs: 500, intervaloMs: 1000, dano: [5, 5] };

const defs = parseMonsterDefs({
  // Boneco de treino: não anda (passo enorme) e só reage quando apanha.
  alvo: { nome: 'Boneco de Treino', nivel: 1, vida: 10, xp: 50, passoMs: 1e9, agressivo: false, perseguicao: 30, renascerMs: 1000, ataque: VALID_ATTACK },
  cobra: {
    nome: 'Cobra',
    nivel: 2,
    vida: 30,
    xp: 10,
    passoMs: 300,
    agressivo: true,
    alcanceAgressao: 4,
    perseguicao: 8,
    renascerMs: 5000,
    ataque: { tipo: 'bote', alcance: 2, preparoMs: 600, intervaloMs: 1500, dano: [10, 10] },
  },
  saci: {
    nome: 'Saci',
    nivel: 5,
    vida: 100,
    xp: 80,
    passoMs: 300,
    agressivo: true,
    alcanceAgressao: 3,
    perseguicao: 12,
    renascerMs: 5000,
    ataque: { tipo: 'giro', alcance: 1, preparoMs: 800, intervaloMs: 2000, dano: [6, 6] },
    redemoinho: { distancia: 4, cadaMs: 7000, falas: ['Hehehe!'] },
  },
  sagui: {
    nome: 'Sagui',
    nivel: 1,
    vida: 50,
    xp: 8,
    passoMs: 300,
    agressivo: false,
    perseguicao: 9,
    renascerMs: 5000,
    ataque: { tipo: 'projetil', alcance: 5, distanciaMinima: 2, preparoMs: 300, intervaloMs: 1500, dano: [3, 3], velocidade: 7, projetil: 'fruta' },
  },
});

/** Campo aberto 30x7; o jogador nasce em (2, 3). */
const OPEN = Array.from({ length: 7 }, () => '.'.repeat(30));
const withTile = (rows: string[], x: number, y: number, c: string) => rows.map((r, i) => (i === y ? r.slice(0, x) + c + r.slice(x + 1) : r));

let clock: FakeClock;

function makeWorld(rows: string[], zones: TestZone[]): World {
  clock = new FakeClock();
  return new World(GameMap.fromTiled(tiledFromAscii(rows, { x: 2, y: 3 }, zones)), { now: clock.now, random: () => 0, monsters: defs });
}

function join(world: World, name = 'Ana'): { player: Player; conn: FakeConn } {
  const conn = new FakeConn();
  const result = world.join(name, conn);
  if (!result.ok) throw new Error(result.reason);
  return { player: result.player, conn };
}

/** Avança o relógio em ticks de verdade. */
function run(world: World, ms: number): void {
  for (let t = 0; t < ms; t += TICK_MS) {
    clock.advance(TICK_MS);
    world.tick();
  }
}

const firstMonster = (world: World) => [...world.monsters.values()][0]!;

describe('monstros', () => {
  it('nascem nas áreas do mapa e aparecem para quem está perto', () => {
    const world = makeWorld(OPEN, [{ monster: 'alvo', x: 6, y: 3, w: 1, h: 1 }]);
    expect(world.monsters.size).toBe(1);
    expect(firstMonster(world)).toMatchObject({ x: 6, y: 3 });
    const ana = join(world);
    world.tick();
    expect(ana.conn.ofType('spawn')[0]?.e).toMatchObject({ kind: 'monster', type: 'alvo', name: 'Boneco de Treino', hp: 10, maxHp: 10, level: 1 });
  });

  it('renascem depois do tempo definido', () => {
    const world = makeWorld(OPEN, [{ monster: 'alvo', x: 6, y: 3, w: 1, h: 1 }]);
    const ana = join(world);
    world.tick();
    const first = firstMonster(world);
    for (let i = 0; i < 4; i++) {
      world.shoot(ana.player, i, 0);
      run(world, SHOT_COOLDOWN_MS + TICK_MS);
    }
    expect(world.monsters.size).toBe(0);
    run(world, 1000);
    expect(world.monsters.size).toBe(1);
    expect(firstMonster(world).id).not.toBe(first.id);
    expect(firstMonster(world).hp).toBe(10);
  });
});

describe('estilingue', () => {
  it('acerta o monstro; ele cai e quem acertou ganha XP e sobe de nível', () => {
    const world = makeWorld(OPEN, [{ monster: 'alvo', x: 6, y: 3, w: 1, h: 1 }]);
    const ana = join(world);
    world.tick();
    const monster = firstMonster(world);
    // Com random = 0 o dano é sempre o mínimo (3); vida 10 → 4 pedradas.
    for (let i = 0; i < 4; i++) {
      world.shoot(ana.player, i, 0);
      run(world, SHOT_COOLDOWN_MS + TICK_MS);
    }
    expect(world.monsters.has(monster.id)).toBe(false);
    expect(ana.conn.ofType('hit').filter((h) => h.id === monster.id).map((h) => h.dmg)).toEqual([3, 3, 3, 3]);
    expect(ana.conn.ofType('shot_end').filter((s) => s.hit === monster.id)).toHaveLength(4);
    expect(ana.conn.ofType('death')).toContainEqual({ t: 'death', id: monster.id });
    // 50 XP: o nível 1 pede 40, então sobe para o 2 e sobram 10.
    expect(ana.player.level).toBe(2);
    expect(ana.player.xp).toBe(10);
    expect(ana.player.hp).toBe(ana.player.maxHp);
    expect(ana.conn.ofType('levelup')[0]).toMatchObject({ id: ana.player.id, level: 2 });
    expect(ana.conn.ofType('stats').at(-1)?.stats).toMatchObject({ level: 2, xp: 10 });
    expect(ana.conn.ofType('sys').some((m) => m.text.includes('nível 2'))).toBe(true);
  });

  it('respeita o tempo entre tiros', () => {
    const world = makeWorld(OPEN, []);
    const ana = join(world);
    world.shoot(ana.player, 1, 0);
    world.shoot(ana.player, 2, 0);
    world.tick();
    expect(ana.conn.ofType('shot')).toHaveLength(1);
    expect(ana.conn.ofType('shot')[0]).toMatchObject({ cid: 1, by: ana.player.id, kind: 'pedra' });
  });

  it('para em paredes, mas passa por cima da água', () => {
    const wall = makeWorld(withTile(OPEN, 4, 3, '#'), [{ monster: 'alvo', x: 6, y: 3, w: 1, h: 1 }]);
    const ana = join(wall);
    wall.tick();
    wall.shoot(ana.player, 1, 0);
    run(wall, 500);
    expect(ana.conn.ofType('shot_end')[0]?.hit).toBe(0);
    expect(firstMonster(wall).hp).toBe(10);

    const water = makeWorld(withTile(OPEN, 4, 3, '~'), [{ monster: 'alvo', x: 6, y: 3, w: 1, h: 1 }]);
    const bia = join(water, 'Bia');
    water.tick();
    water.shoot(bia.player, 1, 0);
    run(water, 500);
    expect(firstMonster(water).hp).toBe(7);
  });
});

describe('golpes com aviso', () => {
  it('a cobra avisa onde vai dar o bote; quem fica parado leva o dano', () => {
    const world = makeWorld(OPEN, [{ monster: 'cobra', x: 5, y: 3, w: 1, h: 1 }]);
    const ana = join(world);
    world.tick(); // a cobra vê a Ana e chega mais perto
    run(world, 300); // começa a preparar o bote
    const warn = ana.conn.ofType('warn')[0];
    expect(warn).toMatchObject({ ms: 600 });
    expect(warn?.tiles).toEqual([4, 3, 3, 3, 2, 3]);
    run(world, 650);
    expect(ana.player.hp).toBe(60 - 10);
  });

  it('quem sai da área marcada a tempo não leva dano', () => {
    const world = makeWorld(OPEN, [{ monster: 'cobra', x: 5, y: 3, w: 1, h: 1 }]);
    const ana = join(world);
    world.tick();
    run(world, 300);
    world.requestStep(ana.player, 1, UP); // desvia
    run(world, 650);
    expect(ana.player.y).toBe(2);
    expect(ana.player.hp).toBe(60);
    expect(ana.conn.ofType('fx').some((f) => f.kind === 'strike')).toBe(true);
  });
});

describe('esquiva', () => {
  it('rola 3 tiles, deixa invencível por um instante e entra em recarga', () => {
    const world = makeWorld(OPEN, []);
    const ana = join(world);
    world.requestStep(ana.player, 1, RIGHT, true);
    run(world, TICK_MS);
    expect([ana.player.x, ana.player.y]).toEqual([5, 3]);
    expect(ana.player.invulnerableUntil).toBe(clock.time + DASH_INVULNERABLE_MS);
    expect(ana.conn.ofType('cd')).toContainEqual({ t: 'cd', n: DASH_SLOT, ms: DASH_COOLDOWN_MS });

    // Outra esquiva antes da recarga vira um passo normal.
    run(world, 300);
    world.requestStep(ana.player, 2, RIGHT, true);
    run(world, TICK_MS);
    expect(ana.player.x).toBe(6);
  });

  it('para antes de paredes', () => {
    const world = makeWorld(withTile(OPEN, 4, 3, '#'), []);
    const ana = join(world);
    world.requestStep(ana.player, 1, RIGHT, true);
    run(world, TICK_MS);
    expect(ana.player.x).toBe(3);
  });
});

describe('desmaio', () => {
  it('quem zera a vida desmaia, não anda e volta para a vila com a vida cheia', () => {
    const world = makeWorld(OPEN, [{ monster: 'cobra', x: 5, y: 3, w: 1, h: 1 }]);
    const ana = join(world);
    ana.player.hp = 5;
    world.tick();
    run(world, 950);
    expect(ana.player.dead).toBe(true);
    expect(ana.conn.ofType('death')).toContainEqual({ t: 'death', id: ana.player.id });

    world.requestStep(ana.player, 1, UP);
    run(world, TICK_MS);
    expect(ana.player.y).toBe(3);

    run(world, DEATH_MS);
    expect(ana.player.dead).toBe(false);
    expect(ana.player.hp).toBe(ana.player.maxHp);
    expect(ana.conn.ofType('teleport').at(-1)).toMatchObject({ x: 2, y: 3 });
  });
});

describe('inteligência dos monstros', () => {
  it('desiste quando o jogador foge para longe, volta para casa e se cura', () => {
    const world = makeWorld(OPEN, [{ monster: 'cobra', x: 5, y: 3, w: 1, h: 1 }]);
    const ana = join(world);
    world.tick();
    const cobra = firstMonster(world);
    expect(cobra.targetId).toBe(ana.player.id);
    cobra.hp = 10;
    ana.player.x = 25; // fugiu
    run(world, 2000);
    expect(cobra.targetId).toBeNull();
    expect(cobra.mode).toBe('idle');
    expect([cobra.x, cobra.y]).toEqual([5, 3]);
    expect(cobra.hp).toBe(30);
  });

  it('o Saci gira e depois some num redemoinho', () => {
    const world = makeWorld(OPEN, [{ monster: 'saci', x: 4, y: 3, w: 1, h: 1 }]);
    const ana = join(world);
    world.tick(); // vê a Ana e chega do lado
    run(world, 300); // começa o giro
    expect(ana.conn.ofType('warn')[0]?.tiles).toHaveLength(18); // 3x3 tiles
    run(world, 850);
    const saci = firstMonster(world);
    expect(ana.player.hp).toBe(60 - 6);
    expect(chebyshev(saci, { x: 3, y: 3 })).toBeGreaterThanOrEqual(3);
    expect(ana.conn.ofType('fx').some((f) => f.kind === 'whirlwind' && f.id === saci.id)).toBe(true);
    expect(ana.conn.ofType('say').some((s) => s.text === 'Hehehe!')).toBe(true);
  });

  it('o Saci aparece do lado de quem atira nele de longe', () => {
    const world = makeWorld(OPEN, [{ monster: 'saci', x: 8, y: 3, w: 1, h: 1 }]);
    const ana = join(world);
    world.tick();
    world.shoot(ana.player, 1, 0);
    run(world, 500);
    expect(chebyshev(firstMonster(world), ana.player)).toBeLessThanOrEqual(2);
  });

  it('o Sagui foge do corpo a corpo e joga frutas de longe', () => {
    const world = makeWorld(OPEN, [{ monster: 'sagui', x: 6, y: 3, w: 1, h: 1 }]);
    const ana = join(world);
    world.tick();
    world.shoot(ana.player, 1, 0);
    run(world, 2000);
    const fruits = ana.conn.ofType('shot').filter((s) => s.kind === 'fruta');
    expect(fruits.length).toBeGreaterThan(0);
    expect(ana.player.hp).toBeLessThan(60);
  });
});

describe('habilidades', () => {
  it('Bordunada acerta em arco e respeita a recarga; Fôlego cura', () => {
    const world = makeWorld(OPEN, [{ monster: 'alvo', x: 3, y: 3, w: 1, h: 1 }]);
    const ana = join(world);
    world.tick();
    const alvo = firstMonster(world);

    world.useSkill(ana.player, 0, 0); // para a direita
    world.tick();
    expect(alvo.hp).toBe(10 - 7); // dano mínimo 3 x 2,2 = 6,6 → 7
    expect(ana.conn.ofType('cd')).toContainEqual({ t: 'cd', n: 0, ms: 4000 });

    world.useSkill(ana.player, 0, 0);
    world.tick();
    expect(ana.conn.ofType('fail').at(-1)).toEqual({ t: 'fail', reason: 'cooldown' });

    world.useSkill(ana.player, 1, 0); // vida cheia: não gasta
    world.tick();
    expect(ana.conn.ofType('fail').at(-1)).toEqual({ t: 'fail', reason: 'full_hp' });

    ana.player.hp = 20;
    world.useSkill(ana.player, 1, 0);
    expect(ana.player.hp).toBe(38); // 30% de 60
    world.tick();
    expect(ana.conn.ofType('heal').at(-1)).toMatchObject({ id: ana.player.id, amount: 18, hp: 38 });
  });
});

describe('correções da revisão (não deixar voltar)', () => {
  it('não deixa atirar mais rápido mandando os pedidos um pouquinho adiantados', () => {
    const world = makeWorld(OPEN, []);
    const ana = join(world);
    for (let i = 0; i < 20; i++) {
      world.shoot(ana.player, i, 0); // um pedido a cada 400 ms (a recarga é 450 ms)
      run(world, 400);
    }
    // em 19 x 400 ms cabem no máximo 17 tiros respeitando a recarga
    expect(ana.conn.ofType('shot').length).toBeLessThanOrEqual(Math.floor((19 * 400) / SHOT_COOLDOWN_MS) + 1);
  });

  it('a esquiva acontece na hora, mesmo logo depois de um passo', () => {
    const world = makeWorld(OPEN, []);
    const ana = join(world);
    world.requestStep(ana.player, 1, RIGHT);
    run(world, TICK_MS);
    expect(ana.player.x).toBe(3);
    world.requestStep(ana.player, 2, RIGHT, true);
    run(world, TICK_MS); // não espera o tempo do passo anterior acabar
    expect(ana.player.x).toBe(6);
    expect(ana.player.invulnerableUntil).toBeGreaterThan(clock.time);
  });

  it('rolar contra a parede não dá invencibilidade nem gasta a esquiva', () => {
    const world = makeWorld(withTile(OPEN, 3, 3, '#'), []);
    const ana = join(world);
    world.requestStep(ana.player, 1, RIGHT, true);
    run(world, TICK_MS);
    expect(ana.player.x).toBe(2);
    expect(ana.player.invulnerableUntil).toBe(0);
    expect(ana.conn.ofType('cd')).toHaveLength(0);
  });

  it('o bote da cobra não atravessa árvores (ela dá a volta)', () => {
    const world = makeWorld(withTile(OPEN, 3, 3, '#'), [{ monster: 'cobra', x: 4, y: 3, w: 1, h: 1 }]);
    const ana = join(world);
    run(world, 3000);
    const warnedTiles = ana.conn.ofType('warn').flatMap((w) => w.tiles.flatMap((v, i) => (i % 2 === 0 ? [`${v},${w.tiles[i + 1]}`] : [])));
    expect(warnedTiles).not.toContain('3,3');
  });

  it('monstro que não consegue chegar até o jogador não fica gritando "!" sem parar', () => {
    // Ana numa ilhota cercada de água; a cobra fica do lado de fora.
    const rows = ['.'.repeat(14), '.~~~~' + '.'.repeat(9), '.~..~' + '.'.repeat(9), '.~..~' + '.'.repeat(9), '.~~~~' + '.'.repeat(9), '.'.repeat(14)];
    clock = new FakeClock();
    const world = new World(GameMap.fromTiled(tiledFromAscii(rows, { x: 10, y: 3 }, [{ monster: 'cobra', x: 6, y: 3, w: 1, h: 1 }])), {
      now: clock.now,
      random: () => 0,
      monsters: defs,
    });
    const ana = join(world);
    ana.player.x = 2; // na ilhota
    ana.player.y = 3;
    run(world, 2000);
    const shouts = ana.conn.ofType('say').filter((m) => m.text === '!');
    expect(shouts.length).toBeLessThanOrEqual(1);
  });
});

describe('dados e validação', () => {
  it('o mapa de verdade tem nome, é zona segura e todas as áreas conseguem criar seus monstros', () => {
    const map = loadMap();
    expect(map.name).toBe('Refúgio de Guarapiranga');
    expect(map.safe).toBe(true);
    const world = new World(map, { monsters: loadMonsterDefs() });
    expect(world.zones.length).toBe(map.monsterZones.length);
    for (const zone of world.zones) expect(zone.alive.size).toBe(zone.zone.count);
  });

  it('lê o data/monsters.json de verdade', () => {
    const real = loadMonsterDefs();
    expect([...real.keys()]).toEqual(expect.arrayContaining(['sagui', 'jararaca', 'saci']));
    expect(real.get('saci')?.whirlwind?.lines.length).toBeGreaterThan(0);
  });

  it('explica em português o que está errado no arquivo de monstros', () => {
    const base = { nome: 'X', nivel: 1, vida: 10, xp: 1, passoMs: 100, ataque: VALID_ATTACK };
    const { vida: _vida, ...semVida } = base;
    expect(() => parseMonsterDefs({ x: semVida })).toThrow(/"vida"/);
    expect(() => parseMonsterDefs({ x: { ...base, ataque: { ...VALID_ATTACK, tipo: 'voadora' } } })).toThrow(/voadora/);
    expect(() => parseMonsterDefs({ x: { ...base, ataque: { ...VALID_ATTACK, dano: [5, 1] } } })).toThrow(/dano/);
  });

  it('valida as mensagens novas do cliente', () => {
    expect(parseClientMsg('{"t":"shoot","cid":3,"a":1.5}')).toEqual({ t: 'shoot', cid: 3, a: 1.5 });
    expect(parseClientMsg('{"t":"shoot","cid":3,"a":"x"}')).toBeNull();
    expect(parseClientMsg('{"t":"skill","n":1,"a":0}')).toEqual({ t: 'skill', n: 1, a: 0 });
    expect(parseClientMsg('{"t":"skill","n":99,"a":0}')).toBeNull();
    expect(parseClientMsg('{"t":"step","seq":1,"dir":2,"dash":true}')).toEqual({ t: 'step', seq: 1, dir: 2, dash: true });
    expect(parseClientMsg('{"t":"step","seq":1,"dir":2,"dash":"sim"}')).toBeNull();
  });
});
