// Classes e habilidades (pedido do dono, 14/11): todo mundo começa igual; depois das missões do começo escolhe a classe
// (por enquanto só o Caçador da Floresta: arco e flecha ou estilingue). 1 ponto por nível, a partir do 2; cada
// habilidade libera num nível e vai até 5 pontos (entre um ponto e o próximo, alguns níveis). A primeira que funciona é
// a Chuva de Flechas: as flechas sobem e caem na área escolhida, acertando todos os bichos dentro. A segunda (o "pode" do
// dono em 15/11), a Flecha Ancestral: atravessa todos os bichos da linha, marca (mais dano de todos) e explode no fim.

import { describe, expect, it } from 'vitest';
import { checkClasses, loadClassDefs, parseClassDefs } from '../src/server/classes';
import { parseItemDefs } from '../src/server/items';
import { parseMonsterDefs } from '../src/server/monsters';
import { parseNpcDefs } from '../src/server/npcs';
import { loadQuestDefs, parseQuestDefs } from '../src/server/quests';
import { parseClientMsg } from '../src/server/validate';
import { characterData, World, type Player } from '../src/server/world';
import { castPoint, cleanSkills, earnedPoints, learnBlocker, levelForPoint, pointsLeft } from '../src/shared/classes';
import { SHOT_COOLDOWN_MS, TICK_MS } from '../src/shared/constants';
import { LEFT } from '../src/shared/dir';
import { GameMap } from '../src/shared/map';
import { feetAt } from '../src/shared/movement';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

const CLASSES = {
  cacador: {
    nome: 'Caçador da Floresta',
    descricao: 'De longe.',
    liberaDepoisDe: 'espantar',
    niveisEntrePontos: 2,
    habilidades: {
      chuva: {
        nome: 'Chuva',
        descricao: 'Chove flecha.',
        nivel: 3,
        tipo: 'chuva',
        recargaSegundos: 10,
        alcance: 10,
        demoraMs: 600,
        pontos: [
          { flechas: 6, raio: 2, danoPorcento: 100 },
          { flechas: 8, raio: 2.5, danoPorcento: 200 },
        ],
      },
      futura: { nome: 'Futura', descricao: 'Em breve.', nivel: 6 },
      flecha: {
        nome: 'Flecha',
        descricao: 'Atravessa.',
        nivel: 1,
        tipo: 'flecha',
        recargaSegundos: 8,
        alcance: 20,
        velocidade: 24,
        pontos: [
          { danoPorcento: 100 },
          { danoPorcento: 100, marcaPorcento: 50, marcaSegundos: 4 },
          { danoPorcento: 100, marcaPorcento: 50, marcaSegundos: 4, explosaoRaio: 2, explosaoPorcento: 100 },
        ],
      },
    },
  },
};
const classes = parseClassDefs(CLASSES);
const cacador = classes.get('cacador')!;
const chuva = cacador.skills[0]!;
const futura = cacador.skills[1]!;
const flecha = cacador.skills[2]!;

describe('data/classes.json', () => {
  it('o Caçador da Floresta: libera depois dos saguis encantados, com as 5 habilidades e só a Chuva de Flechas pronta', () => {
    const real = loadClassDefs();
    const hunter = real.get('cacador')!;
    expect(hunter).toMatchObject({ name: 'Caçador da Floresta', unlockQuest: 'saguis_encantados', levelsBetweenPoints: 2 });
    expect(hunter.skills.map((s) => [s.id, s.level, s.kind])).toEqual([
      ['chuva_de_flechas', 3, 'chuva'],
      ['flecha_ancestral', 6, 'flecha'],
      ['olhos_de_gaviao', 10, null],
      ['chamado_selvagem', 15, null],
      ['furia_da_onca', 20, null],
    ]);
    const rain = hunter.skills[0]!;
    expect(rain).toMatchObject({ name: 'Chuva de Flechas', cooldownMs: 10_000, range: 10 });
    expect(rain.points).toHaveLength(5);
    // cada ponto: mais flechas, área maior e mais dano
    for (let i = 1; i < rain.points.length; i++) {
      expect(rain.points[i]!.arrows).toBeGreaterThan(rain.points[i - 1]!.arrows);
      expect(rain.points[i]!.radius).toBeGreaterThan(rain.points[i - 1]!.radius);
      expect(rain.points[i]!.damagePct).toBeGreaterThan(rain.points[i - 1]!.damagePct);
    }
    // a Flecha Ancestral: mais dano a cada ponto; a marca com 3 e a explosão com 5
    const arrow = hunter.skills[1]!;
    expect(arrow).toMatchObject({ name: 'Flecha Ancestral', cooldownMs: 8000, range: 14, speed: 24, width: 0.8 });
    expect(arrow.points.map((p) => p.markPct > 0)).toEqual([false, false, true, true, true]);
    expect(arrow.points.map((p) => p.burstRadius > 0)).toEqual([false, false, false, false, true]);
    for (let i = 1; i < arrow.points.length; i++) expect(arrow.points[i]!.damagePct).toBeGreaterThan(arrow.points[i - 1]!.damagePct);
    expect(() => checkClasses(real, loadQuestDefs())).not.toThrow();
  });

  it('traduz o português', () => {
    expect(chuva).toEqual({
      id: 'chuva',
      name: 'Chuva',
      description: 'Chove flecha.',
      level: 3,
      kind: 'chuva',
      cooldownMs: 10_000,
      range: 10,
      delayMs: 600,
      speed: 0,
      width: 0,
      points: [
        { arrows: 6, radius: 2, damagePct: 100, markPct: 0, markMs: 0, burstRadius: 0, burstPct: 0 },
        { arrows: 8, radius: 2.5, damagePct: 200, markPct: 0, markMs: 0, burstRadius: 0, burstPct: 0 },
      ],
    });
    expect(futura).toMatchObject({ kind: null, points: [] });
    expect(flecha).toMatchObject({ kind: 'flecha', cooldownMs: 8000, range: 20, speed: 24, delayMs: 0, width: 0.8 }); // sem "largura": 0,8 m
    expect(flecha.points[2]).toEqual({ damagePct: 100, arrows: 0, radius: 0, markPct: 50, markMs: 4000, burstRadius: 2, burstPct: 100 });
  });

  it('explica o erro em português', () => {
    const skill = CLASSES.cacador.habilidades.chuva;
    const bad = (change: Record<string, unknown>) => () => parseClassDefs({ c: { ...CLASSES.cacador, habilidades: { h: { ...skill, ...change } } } });
    expect(bad({ tipo: 'raio' })).toThrow(/"tipo" precisa ser "chuva"/);
    expect(bad({ pontos: [] })).toThrow(/"pontos" precisa ser uma lista de 1 a 10 pontos/);
    expect(bad({ nivel: 0 })).toThrow(/"nivel" precisa ser pelo menos 1/);
    expect(bad({ pontos: [{ flechas: 6, raio: 20, danoPorcento: 100 }] })).toThrow(/"raio" precisa ser no máximo 8/);
    const arrow = CLASSES.cacador.habilidades.flecha;
    const badArrow = (change: Record<string, unknown>) => () => parseClassDefs({ c: { ...CLASSES.cacador, habilidades: { h: { ...arrow, ...change } } } });
    expect(badArrow({ pontos: [{ danoPorcento: 100, marcaPorcento: 20 }] })).toThrow(/"marcaSegundos" precisa ser um número/);
    expect(badArrow({ pontos: [{ danoPorcento: 100, explosaoPorcento: 80 }] })).toThrow(/"explosaoRaio" precisa ser um número/);
    expect(badArrow({ velocidade: 100 })).toThrow(/"velocidade" precisa ser no máximo 60/);
    expect(() => parseClassDefs({ 'Caçador': CLASSES.cacador })).toThrow(/só pode ter letras sem acento/);
    expect(() => checkClasses(classes, parseQuestDefs({}))).toThrow(/"liberaDepoisDe" é "espantar", que não é uma missão/);
  });
});

describe('as regras dos pontos', () => {
  it('1 ponto por nível a partir do 2; o primeiro no nível da habilidade, os outros a cada 2 níveis', () => {
    expect([1, 2, 3, 11].map(earnedPoints)).toEqual([0, 1, 2, 10]);
    expect(pointsLeft(5, { chuva: 1 })).toBe(3);
    expect(levelForPoint(cacador, chuva, 1)).toBe(3);
    expect(levelForPoint(cacador, chuva, 2)).toBe(5);
    expect(learnBlocker(cacador, chuva, 2, {})).toBe('level');
    expect(learnBlocker(cacador, chuva, 3, {})).toBeNull();
    expect(learnBlocker(cacador, chuva, 4, { chuva: 1 })).toBe('level'); // o segundo ponto é no nível 5
    expect(learnBlocker(cacador, chuva, 5, { chuva: 1 })).toBeNull();
    expect(learnBlocker(cacador, chuva, 9, { chuva: 2 })).toBe('max'); // esta tem 2 pontos no máximo
    expect(learnBlocker(cacador, futura, 20, {})).toBe('soon');
    // sem espera entre os pontos: o que segura é ter pontos
    expect(learnBlocker({ ...cacador, levelsBetweenPoints: 0 }, { ...chuva, level: 1 }, 2, { chuva: 1 })).toBe('points');
  });

  it('os pontos salvos são conferidos com a classe de agora', () => {
    expect(cleanSkills(cacador, 9, { chuva: 2, sumiu: 3, futura: 1 })).toEqual({ chuva: 2 }); // o que não existe (ou é "em breve") sai
    expect(cleanSkills(cacador, 9, { chuva: 7 })).toEqual({ chuva: 2 }); // passou do máximo
    expect(cleanSkills(cacador, 4, { chuva: 2 })).toEqual({ chuva: 1 }); // o nível só deixa 1
    expect(cleanSkills(cacador, 9, 'lixo')).toEqual({});
    expect(cleanSkills(undefined, 9, { chuva: 2 })).toEqual({});
  });

  it('longe demais, cai no alcance (na mesma direção)', () => {
    expect(castPoint({ x: 0, y: 0 }, { x: 3, y: 4 }, 10)).toEqual({ x: 3, y: 4 });
    expect(castPoint({ x: 0, y: 0 }, { x: 30, y: 40 }, 10)).toEqual({ x: 6, y: 8 });
  });

  it('as mensagens novas passam pela conferência', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'class', id: 'cacador' }))).toEqual({ t: 'class', id: 'cacador' });
    expect(parseClientMsg(JSON.stringify({ t: 'learn', id: 'chuva_de_flechas' }))).toEqual({ t: 'learn', id: 'chuva_de_flechas' });
    expect(parseClientMsg(JSON.stringify({ t: 'unlearn' }))).toEqual({ t: 'unlearn' });
    expect(parseClientMsg(JSON.stringify({ t: 'cast', id: 'chuva', x: 3.5, y: 4 }))).toEqual({ t: 'cast', id: 'chuva', x: 3.5, y: 4 });
    expect(parseClientMsg(JSON.stringify({ t: 'class', id: 'Caçador!' }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'cast', id: 'chuva', x: 'longe', y: 4 }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'cast', id: 'chuva', x: 1e9, y: 4 }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'cast', id: 'flecha', x: 3, y: 4, cid: 7 }))).toEqual({ t: 'cast', id: 'flecha', x: 3, y: 4, cid: 7 });
    expect(parseClientMsg(JSON.stringify({ t: 'cast', id: 'flecha', x: 3, y: 4, cid: -1 }))).toBeNull();
  });
});

// ---------- no mundo ----------

const items = parseItemDefs({ fruta: { nome: 'Fruta', preco: 5, tipo: 'consumivel', cura: 10 } });
const ATTACK = { tipo: 'mordida', preparoMs: 500, intervaloMs: 1000, dano: [1, 1] };
const monsters = parseMonsterDefs({
  bicho: { nome: 'Bicho', nivel: 1, vida: 1, xp: 1, passoMs: 1e9, renascerMs: 100, agressivo: false, ataque: ATTACK },
  alvo: { nome: 'Alvo', nivel: 1, vida: 100, xp: 1, passoMs: 1e9, renascerMs: 60_000, agressivo: false, perseguicao: 30, ataque: ATTACK },
  tatu: { nome: 'Tatu', nivel: 1, vida: 100, xp: 1, passoMs: 1e9, renascerMs: 60_000, agressivo: false, perseguicao: 30, ataque: ATTACK, casca: { seguraPorcento: 90, angulo: 360, tontoMs: 2000 } },
  enxame: { nome: 'Enxame', nivel: 1, vida: 100, xp: 1, passoMs: 1e9, renascerMs: 60_000, agressivo: false, perseguicao: 30, ataque: ATTACK, desvioTiro: 90 },
});
const npcs = parseNpcDefs({ velho: { nome: 'Seu Velho', titulo: 'do mato', mapa: 'campo', x: 1, y: 0, fala: 'Oi!' } });
const quests = parseQuestDefs({
  espantar: {
    nome: 'Espantar',
    quemDa: 'velho',
    pedido: 'Espante 1 bicho.',
    objetivo: { tipo: 'derrotar', monstro: 'bicho', quantidade: 1 },
    recompensa: { xp: 1 },
  },
});

/**
 * Campo aberto de 20 × 9: o jogador no tile (2, 4); dois alvos juntos nos tiles (8, 4) e (9, 5) (a chuva mira no pé do
 * primeiro), um longe em (15, 4), um tatu-bola em (8, 1) e um bicho de 1 de vida em (4, 4) (para a missão). O pé de quem
 * está no tile (x, y) fica em (x + 0,5; y + 1): veja feetAt. Área segura opcional (a faixa da esquerda).
 */
function setup(options: { safe?: boolean } = {}) {
  const clock = new FakeClock();
  const tiled = tiledFromAscii(Array.from({ length: 9 }, () => '.'.repeat(20)), { x: 2, y: 4 }, [
    { monster: 'alvo', x: 8, y: 4, w: 1, h: 1 },
    { monster: 'alvo', x: 9, y: 5, w: 1, h: 1 },
    { monster: 'alvo', x: 15, y: 4, w: 1, h: 1 },
    { monster: 'tatu', x: 8, y: 1, w: 1, h: 1 },
    { monster: 'bicho', x: 4, y: 4, w: 1, h: 1 },
  ]);
  if (options.safe) tiled.layers.push({ type: 'objectgroup', name: 'seguro', objects: [{ id: 900, name: 'Vila', x: 0, y: 0, width: 4 * 16, height: 9 * 16 }] });
  const map = GameMap.fromTiled(tiled, 'campo');
  const world = new World(map, { now: clock.now, random: () => 0, monsters, items, npcs, quests, classes });
  const conn = new FakeConn();
  const joined = world.join('Ana', conn);
  if (!joined.ok) throw new Error(joined.reason);
  const player = joined.player;
  Object.assign(player, { x: 2, y: 4 });
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  run(TICK_MS);
  const at = (x: number, y: number) => [...world.monsters.values()].find((m) => m.x === x && m.y === y)!;
  return { world, clock, conn, player, run, at };
}

/** Já concluiu a missão do começo, escolheu o Caçador e está no nível `level`. */
function hunter(level: number, options: { safe?: boolean } = {}) {
  const game = setup(options);
  game.player.quests.espantar = { state: 'done', count: 1 };
  game.player.level = level;
  game.world.chooseClass(game.player, 'cacador');
  game.run(TICK_MS);
  return game;
}

const heroOf = (conn: FakeConn) => conn.ofType('hero').at(-1)!.hero;

describe('a classe no jogo', () => {
  it('as boas-vindas trazem as classes e o herói: sem classe, sem pontos e ainda sem poder escolher', () => {
    const { conn } = setup();
    const welcome = conn.ofType('welcome')[0]!;
    expect(welcome.classes.map((c) => c.id)).toEqual(['cacador']);
    expect(welcome.hero).toEqual({ class: null, skills: {}, points: 0, canChoose: false });
  });

  it('escolher: só depois da missão do começo, uma vez só, e todo mundo fica sabendo', () => {
    const { world, conn, player, run } = setup();
    const other = new FakeConn();
    world.join('Beto', other);
    world.chooseClass(player, 'cacador');
    run(TICK_MS);
    expect(player.heroClass).toBeNull();
    expect(conn.ofType('sys').at(-1)!.text).toBe('Ainda não: termine antes as missões do começo.');
    player.quests.espantar = { state: 'done', count: 1 };
    world.chooseClass(player, 'cacador');
    world.chooseClass(player, 'nenhuma'); // não existe: nada
    run(TICK_MS);
    expect(player.heroClass).toBe('cacador');
    expect(heroOf(conn)).toEqual({ class: 'cacador', skills: {}, points: 0, canChoose: false });
    expect(other.ofType('sys').some((m) => m.text === 'Ana seguiu o caminho: Caçador da Floresta.')).toBe(true);
  });

  it('concluir a missão do começo libera a escolha (o herói chega com canChoose e o aviso)', () => {
    const { world, conn, player, run } = setup();
    const velho = [...world.npcs.values()][0]!.id;
    Object.assign(player, { x: 1, y: 1 });
    world.questAction(player, 'accept', 'espantar', velho);
    run(TICK_MS);
    const bicho = [...world.monsters.values()].find((m) => m.def.id === 'bicho')!;
    Object.assign(player, { x: 1, y: bicho.y }); // na linha do bicho, atirando para o leste
    world.shoot(player, 1, 0);
    run(SHOT_COOLDOWN_MS + 500);
    expect(player.quests.espantar!.count).toBe(1);
    Object.assign(player, { x: 1, y: 1 });
    world.questAction(player, 'complete', 'espantar', velho);
    run(TICK_MS);
    expect(heroOf(conn).canChoose).toBe(true);
    expect(conn.ofType('sys').some((m) => /agora você pode escolher a sua classe/.test(m.text))).toBe(true);
  });

  it('pontos: 1 por nível; o nível de cada habilidade manda; "em breve" não recebe; tirar os pontos devolve', () => {
    const { world, conn, player, run } = hunter(2);
    expect(heroOf(conn).points).toBe(1);
    world.learnSkill(player, 'chuva');
    run(TICK_MS);
    expect(conn.ofType('sys').at(-1)!.text).toBe('O próximo ponto em Chuva é no nível 3.');
    player.level = 3; // (o painel ou a caça: subir de nível manda o herói de novo, veja abaixo)
    world.learnSkill(player, 'chuva');
    world.learnSkill(player, 'chuva'); // o segundo ponto só no nível 5
    world.learnSkill(player, 'futura');
    run(TICK_MS);
    expect(player.skillPoints).toEqual({ chuva: 1 });
    expect(heroOf(conn)).toMatchObject({ skills: { chuva: 1 }, points: 1 });
    const texts = conn.ofType('sys').map((m) => m.text);
    expect(texts).toContain('Você aprendeu: Chuva!');
    expect(texts).toContain('O próximo ponto em Chuva é no nível 5.');
    expect(texts).toContain('Futura ainda não chegou no jogo: em breve!');
    world.adminSetLevel(player, 5);
    run(TICK_MS);
    expect(heroOf(conn).points).toBe(3);
    world.learnSkill(player, 'chuva');
    run(TICK_MS);
    expect(conn.ofType('sys').at(-1)!.text).toBe('Chuva: 2 de 2.');
    world.unlearnSkills(player);
    run(TICK_MS);
    expect(heroOf(conn)).toMatchObject({ skills: {}, points: 4 });
  });

  it('subir de nível caçando: o herói chega com o ponto novo', () => {
    const { world, conn, player, run } = hunter(1);
    (world as unknown as { giveXp(p: Player, n: number): void }).giveXp(player, 1000);
    run(TICK_MS);
    expect(heroOf(conn).points).toBe(player.level - 1);
  });

  it('baixar o nível pelo painel: os pontos que passaram voltam', () => {
    const { world, conn, player, run } = hunter(5);
    world.learnSkill(player, 'chuva');
    world.learnSkill(player, 'chuva');
    world.adminSetLevel(player, 3);
    run(TICK_MS);
    expect(player.skillPoints).toEqual({ chuva: 1 });
    expect(heroOf(conn)).toMatchObject({ skills: { chuva: 1 }, points: 1 });
  });
});

describe('a Chuva de Flechas', () => {
  it('sem ponto nela, nada; com ponto, quem está perto vê e quem usou recebe a recarga', () => {
    const { world, conn, player, run, at } = hunter(3);
    const other = new FakeConn();
    const beto = world.join('Beto', other);
    if (!beto.ok) throw new Error(beto.reason);
    Object.assign(beto.player, { x: 3, y: 6 });
    run(TICK_MS);
    world.castSkill(player, 'chuva', 8.5, 5);
    run(TICK_MS);
    expect(other.ofType('cast')).toHaveLength(0);
    world.learnSkill(player, 'chuva');
    world.castSkill(player, 'chuva', 8.5, 5);
    run(TICK_MS);
    expect(other.ofType('cast')).toEqual([{ t: 'cast', id: player.id, s: 'chuva', x: 8.5, y: 5, r: 2, n: 6, p: 1, ms: 600, kind: 'pedra' }]);
    expect(conn.ofType('cast')).toHaveLength(0); // quem usou já desenhou
    expect(conn.ofType('scd')).toEqual([{ t: 'scd', s: 'chuva', ms: 10_000 }]);
    expect(at(8, 4).hp).toBe(100); // ainda no ar
  });

  it('cai depois da demora em todos os bichos do círculo (e só neles), uma vez; depois, a recarga', () => {
    const { world, conn, player, run, at } = hunter(3);
    const [a, b, far] = [at(8, 4), at(9, 5), at(15, 4)]; // (acertados, eles dão um passo na direção de quem atirou)
    world.learnSkill(player, 'chuva');
    const center = feetAt(a.x, a.y);
    world.castSkill(player, 'chuva', center.x, center.y);
    run(500);
    expect(a.hp).toBe(100);
    run(200);
    // nível 3, sorteio no mínimo: 5 de dano × 100%
    expect(a.hp).toBe(95);
    expect(b.hp).toBe(95); // o pé dele está a 1,4 m do centro
    expect(far.hp).toBe(100); // longe
    run(2000);
    expect(a.hp).toBe(95); // uma vez só
    expect(a.targetId).toBe(player.id); // e ele sabe quem foi
    world.castSkill(player, 'chuva', center.x, center.y);
    run(TICK_MS);
    expect(conn.ofType('fail').at(-1)).toEqual({ t: 'fail', reason: 'cooldown' });
    run(8000);
    const moved = feetAt(a.x, a.y);
    world.castSkill(player, 'chuva', moved.x, moved.y);
    run(1000);
    expect(a.hp).toBe(90);
  });

  it('com mais pontos, a área e o dano crescem', () => {
    const { world, player, run, at } = hunter(5);
    const a = at(8, 4);
    world.learnSkill(player, 'chuva');
    world.learnSkill(player, 'chuva');
    world.castSkill(player, 'chuva', feetAt(a.x, a.y).x, feetAt(a.x, a.y).y);
    run(700);
    // nível 5: 7 de dano × 200%
    expect(a.hp).toBe(86);
  });

  it('vem de cima: a casca do tatu-bola não segura (a pedra de frente, sim)', () => {
    const { world, player, run, at } = hunter(3);
    world.learnSkill(player, 'chuva');
    const tatu = at(8, 1);
    tatu.dir = LEFT;
    world.castSkill(player, 'chuva', feetAt(tatu.x, tatu.y).x, feetAt(tatu.x, tatu.y).y);
    run(700);
    expect(tatu.hp).toBe(95);
  });

  it('longe demais, cai no alcance; da área segura, não chove', () => {
    const far = hunter(3);
    const other = new FakeConn();
    far.world.join('Beto', other); // nasce perto da Ana: vê a chuva
    far.run(TICK_MS);
    const [a, c] = [far.at(8, 4), far.at(15, 4)];
    far.world.learnSkill(far.player, 'chuva');
    far.world.castSkill(far.player, 'chuva', 40, 5); // a 37,5 m do pé (2,5; 5): cai a 10 m, em (12,5; 5)
    far.run(700);
    expect(other.ofType('cast')[0]).toMatchObject({ x: 12.5, y: 5 });
    expect(c.hp).toBe(100); // o pé dele fica a 3 m do centro
    expect(a.hp).toBe(100);

    const safe = hunter(3, { safe: true });
    safe.world.learnSkill(safe.player, 'chuva');
    safe.world.castSkill(safe.player, 'chuva', 8.5, 5);
    safe.run(700);
    expect(safe.at(8, 4).hp).toBe(100);
    expect(safe.conn.ofType('scd')).toHaveLength(0);
  });
});

describe('a classe fica salva', () => {
  it('o que vai para o arquivo: a classe e os pontos', () => {
    const { world, player } = hunter(3);
    world.learnSkill(player, 'chuva');
    expect(characterData(player, 'campo').hero).toEqual({ class: 'cacador', skills: { chuva: 1 } });
  });

  it('na volta, os pontos são conferidos (e a classe que sumiu dos dados volta a ser escolhida)', () => {
    const clock = new FakeClock();
    const map = GameMap.fromTiled(tiledFromAscii(['.'.repeat(8), '.'.repeat(8)], { x: 1, y: 1 }), 'campo');
    const world = new World(map, { now: clock.now, random: () => 0, classes, quests, npcs, monsters, items });
    const base = { id: 1, name: 'Ana', level: 4, xp: 0, hp: null, zone: null, x: null, y: null, dir: 0 as const, look: 1, inventory: null, quests: { espantar: { state: 'done' as const, count: 1 } } };
    const conn = new FakeConn();
    const joined = world.join('Ana', conn, { character: { ...base, hero: { class: 'cacador', skills: { chuva: 2, sumiu: 1 } } }, created: false });
    if (!joined.ok) throw new Error(joined.reason);
    expect(joined.player.heroClass).toBe('cacador');
    expect(joined.player.skillPoints).toEqual({ chuva: 1 }); // no nível 4, só 1 ponto na Chuva
    expect(conn.ofType('welcome')[0]!.hero).toEqual({ class: 'cacador', skills: { chuva: 1 }, points: 2, canChoose: false });
    world.leave(joined.player);
    const conn2 = new FakeConn();
    const again = world.join('Ana', conn2, { character: { ...base, id: 2, hero: { class: 'sumiu', skills: { chuva: 1 } } }, created: false });
    if (!again.ok) throw new Error(again.reason);
    expect(conn2.ofType('welcome')[0]!.hero).toEqual({ class: null, skills: {}, points: 3, canChoose: true });
  });
});

describe('a Flecha Ancestral', () => {
  /**
   * Uma linha de 20 × 5 com uma parede (que segura tiro) na coluna 17, com uma passagem lá em cima: o jogador no tile
   * (1, 2); na mesma linha, dois alvos (5 e 8), um tatu-bola (11, casca de 90% para todo lado), um enxame (14, 90% das
   * pedras passam), um alvo colado na parede (16) e outro atrás dela (19). Pontos: o 1º no nível 1, o 2º no 3, o 3º no 5.
   */
  function line(level: number, points: number) {
    const clock = new FakeClock();
    const rows = Array.from({ length: 5 }, (_, i) => (i === 0 ? '.'.repeat(20) : '.'.repeat(17) + '#..'));
    const zones = [
      { monster: 'alvo', x: 5 },
      { monster: 'alvo', x: 8 },
      { monster: 'tatu', x: 11 },
      { monster: 'enxame', x: 14 },
      { monster: 'alvo', x: 16 },
      { monster: 'alvo', x: 19 },
    ].map((z) => ({ ...z, y: 2, w: 1, h: 1 }));
    const map = GameMap.fromTiled(tiledFromAscii(rows, { x: 1, y: 2 }, zones), 'linha');
    const world = new World(map, { now: clock.now, random: () => 0, monsters, items, npcs, quests, classes });
    const conn = new FakeConn();
    const joined = world.join('Ana', conn);
    if (!joined.ok) throw new Error(joined.reason);
    const player = joined.player;
    Object.assign(player, { x: 1, y: 2, level });
    player.quests.espantar = { state: 'done', count: 1 };
    world.chooseClass(player, 'cacador');
    for (let i = 0; i < points; i++) world.learnSkill(player, 'flecha');
    const run = (ms: number) => {
      for (let t = 0; t < ms; t += TICK_MS) {
        clock.advance(TICK_MS);
        world.tick();
      }
    };
    run(TICK_MS);
    const at = (x: number) => [...world.monsters.values()].find((m) => m.x === x && m.y === 2)!;
    const row = [5, 8, 11, 14, 16, 19].map(at);
    // mira no leste, na altura do pé
    const fire = (cid?: number) => world.castSkill(player, 'flecha', 20, feetAt(player.x, player.y).y, cid);
    return { world, conn, player, run, row, fire };
  }

  it('atravessa todos os bichos da linha, cada um uma vez: nem a casca do tatu nem o enxame seguram; a parede, sim', () => {
    const { conn, run, row, fire } = line(2, 1);
    fire(7);
    run(1500);
    // nível 2, sorteio no mínimo: 4 de dano × 100%, em cada um
    expect(row.map((m) => m.hp)).toEqual([96, 96, 96, 96, 96, 100]);
    const shot = conn.ofType('shot').at(-1)!;
    expect(shot).toMatchObject({ kind: 'ancestral', cid: 7, speed: 24, range: 20 });
    const end = conn.ofType('shot_end').find((m) => m.id === shot.id)!;
    expect(end.hit).toBe(0);
    expect(end.on).toBeDefined(); // parou na parede
    expect(end.burst).toBeUndefined();
    expect(conn.ofType('fx').some((m) => m.kind === 'mark')).toBe(false); // com 1 ponto, ainda sem marca
  });

  it('com a marca (2 pontos): quem ela atravessou leva mais dano de todo mundo, por uns segundos', () => {
    const { world, conn, player, run, row, fire } = line(3, 2);
    fire();
    run(1500);
    const first = row[0]!;
    expect(first.hp).toBe(95); // nível 3: 5 × 100%
    expect(conn.ofType('fx').find((m) => m.kind === 'mark' && m.id === first.id)).toMatchObject({ ms: 4000 });
    world.shoot(player, 1, 0); // a pedra de sempre (5) leva +50%: 7,5 → 8
    run(SHOT_COOLDOWN_MS + 300);
    expect(first.hp).toBe(87);
    run(3000); // a marca acabou
    world.shoot(player, 2, 0);
    run(SHOT_COOLDOWN_MS + 300);
    expect(first.hp).toBe(82);
  });

  it('com a explosão (3 pontos): no fim, todo bicho no raio leva o dano dela (o marcado, a mais)', () => {
    const { conn, run, row, fire } = line(5, 3);
    fire();
    run(1500);
    const end = conn.ofType('shot_end').at(-1)!;
    expect(end.burst).toBe(2);
    // nível 5: 7 de dano. O colado na parede: a flecha (7) e a explosão (7 + 50% da marca = 10,5 → 11)
    expect(row[4]!.hp).toBe(100 - 7 - 11);
    expect(row[0]!.hp).toBe(93); // longe do fim: só a flecha
    expect(row[5]!.hp).toBe(100); // atrás da parede
  });

  it('a largura ("largura", 0,8 m sem o campo): pega quem tem o pé a até 0,8 m da linha (o tiro de sempre, só 0,6)', () => {
    const near = line(2, 1);
    Object.assign(near.player, { fx: 1, fy: 2.7 }); // a flecha passa 0,7 m ao sul do pé dos bichos
    near.world.castSkill(near.player, 'flecha', 20, feetAt(1, 2.7).y);
    near.run(1500);
    expect(near.row[0]!.hp).toBe(96);
    const far = line(2, 1);
    Object.assign(far.player, { fx: 1, fy: 2.9 }); // 0,9 m: passa longe
    far.world.castSkill(far.player, 'flecha', 20, feetAt(1, 2.9).y);
    far.run(1500);
    expect(far.row[0]!.hp).toBe(100);
  });

  it('recarga: de novo antes da hora, não sai', () => {
    const { conn, run, fire } = line(2, 1);
    fire();
    run(TICK_MS);
    fire();
    run(TICK_MS);
    expect(conn.ofType('fail').at(-1)).toEqual({ t: 'fail', reason: 'cooldown' });
    expect(conn.ofType('scd')).toEqual([{ t: 'scd', s: 'flecha', ms: 8000 }]);
    expect(conn.ofType('shot').filter((m) => m.kind === 'ancestral')).toHaveLength(1);
  });
});
