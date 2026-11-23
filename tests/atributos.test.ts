// Atributos (aprovado pelo dono em 23/11: "pode fazer assim, 3 pontos por nível, espírito"): Força, Destreza, Espírito
// e Vitalidade. A cada nível, a partir do 2, 3 pontos para distribuir; recomeçar é de graça, por enquanto. Cada ponto
// mexe num número fixo, sem sorteio: Força, o dano do tiro de sempre; Destreza, a puxada e o intervalo do tiro;
// Espírito, o dano e a recarga das habilidades da classe; Vitalidade, a vida. Quanto vale cada ponto: painel de ajustes.

import { describe, expect, it } from 'vitest';
import { parseClassDefs } from '../src/server/classes';
import { parseItemDefs } from '../src/server/items';
import { parseMonsterDefs } from '../src/server/monsters';
import { parseNpcDefs } from '../src/server/npcs';
import { parseQuestDefs } from '../src/server/quests';
import { parseClientMsg } from '../src/server/validate';
import { characterData, World } from '../src/server/world';
import {
  attributeBonus,
  attributePointsEarned,
  attributePointsLeft,
  cleanAttributes,
  dexterityShot,
  noAttributes,
  spiritCooldownFactor,
  spiritDamageFactor,
  strengthFactor,
  vitalityHp,
  type AttributeId,
} from '../src/shared/attributes';
import { shotProfile } from '../src/shared/combat';
import { DEFAULT_COMBAT_RULES } from '../src/shared/combatRules';
import { CHARGE_FULL_MS, SHOT_COOLDOWN_MS, TICK_MS } from '../src/shared/constants';
import { GameMap } from '../src/shared/map';
import { feetAt } from '../src/shared/movement';
import { damageRange, maxHpFor } from '../src/shared/progression';
import { FakeClock, FakeConn, tiledFromAscii } from './helpers';

describe('as regras dos atributos', () => {
  it('3 pontos por nível, a partir do 2 (no nível 10, 27)', () => {
    expect(attributePointsEarned(1)).toBe(0);
    expect(attributePointsEarned(2)).toBe(3);
    expect(attributePointsEarned(10)).toBe(27);
    expect(attributePointsLeft(10, { forca: 5, destreza: 2, espirito: 0, vitalidade: 0 })).toBe(20);
    expect(attributePointsLeft(1, noAttributes())).toBe(0);
  });

  it('o que vem do arquivo é conferido: só os quatro, inteiros de 0 em diante; gastou mais que o nível dá, voltam todos', () => {
    expect(cleanAttributes(5, null)).toEqual(noAttributes());
    expect(cleanAttributes(5, 'lixo')).toEqual(noAttributes());
    expect(cleanAttributes(5, { forca: 3.9, destreza: -2, espirito: '4', vitalidade: 2, sorte: 9 })).toEqual({ forca: 3, destreza: 0, espirito: 0, vitalidade: 2 });
    expect(cleanAttributes(2, { forca: 2, vitalidade: 2 })).toEqual(noAttributes()); // 4 pontos no nível 2 (que dá 3)
    expect(cleanAttributes(2, { forca: 2, vitalidade: 1 })).toEqual({ forca: 2, destreza: 0, espirito: 0, vitalidade: 1 });
  });

  it('quanto vale cada ponto (padrão: Força 2%, Destreza 1,5% e 1%, Espírito 2% e 1%, Vitalidade 5; corte até 40%)', () => {
    const rules = DEFAULT_COMBAT_RULES;
    const ten = { forca: 10, destreza: 10, espirito: 10, vitalidade: 10 };
    expect(strengthFactor(ten, rules)).toBeCloseTo(1.2);
    expect(spiritDamageFactor(ten, rules)).toBeCloseTo(1.2);
    expect(spiritCooldownFactor(ten, rules)).toBeCloseTo(0.9);
    expect(vitalityHp(ten, rules)).toBe(50);
    const stone = shotProfile(rules, null, false); // a pedra: puxada de 1,1 s e 450 ms entre os tiros
    expect(stone).toMatchObject({ chargeMs: CHARGE_FULL_MS, cooldownMs: SHOT_COOLDOWN_MS });
    expect(dexterityShot(stone, ten, rules)).toMatchObject({ chargeMs: 935, cooldownMs: 405 });
    expect(dexterityShot(stone, noAttributes(), rules)).toBe(stone);
    // ponto demais: no máximo 40% a menos em cada tempo
    const many = { forca: 0, destreza: 60, espirito: 60, vitalidade: 0 };
    expect(dexterityShot(stone, many, rules)).toMatchObject({ chargeMs: 660, cooldownMs: 270 });
    expect(spiritCooldownFactor(many, rules)).toBeCloseTo(0.6);
    // o que a janela mostra
    expect(attributeBonus(ten, rules)).toEqual({ shotDamagePct: 20, chargeCutPct: 15, intervalCutPct: 10, skillDamagePct: 20, cooldownCutPct: 10, hp: 50 });
    expect(attributeBonus(ten, { ...rules, playerHpFactor: 2 }).hp).toBe(100); // a vida passa pelo "vida dos jogadores ×"
  });

  it('as mensagens novas passam pela conferência', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'attr', id: 'forca' }))).toEqual({ t: 'attr', id: 'forca' });
    expect(parseClientMsg(JSON.stringify({ t: 'attr', id: 'vitalidade', extra: 1 }))).toEqual({ t: 'attr', id: 'vitalidade' });
    expect(parseClientMsg(JSON.stringify({ t: 'attr', id: 'sorte' }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'attr' }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'attrReset' }))).toEqual({ t: 'attrReset' });
  });
});

// ---------- no mundo ----------

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
        pontos: [{ flechas: 6, raio: 2, danoPorcento: 100 }],
      },
      olhos: {
        nome: 'Olhos',
        descricao: 'Vê longe.',
        nivel: 1,
        tipo: 'olhos',
        recargaSegundos: 30,
        pontos: [{ duracaoSegundos: 8, visaoPorcento: 50 }],
      },
    },
  },
};
const classes = parseClassDefs(CLASSES);
const items = parseItemDefs({ fruta: { nome: 'Fruta', preco: 5, tipo: 'consumivel', cura: 10 } });
const ATTACK = { tipo: 'mordida', preparoMs: 500, intervaloMs: 1000, dano: [1, 1] };
const monsters = parseMonsterDefs({
  alvo: { nome: 'Alvo', nivel: 1, vida: 1000, xp: 1, passoMs: 1e9, renascerMs: 60_000, agressivo: false, perseguicao: 30, ataque: ATTACK },
});
const npcs = parseNpcDefs({ velho: { nome: 'Seu Velho', titulo: 'do mato', mapa: 'campo', x: 1, y: 0, fala: 'Oi!' } });
const quests = parseQuestDefs({
  espantar: { nome: 'Espantar', quemDa: 'velho', pedido: 'Espante 1.', objetivo: { tipo: 'derrotar', monstro: 'alvo', quantidade: 1 }, recompensa: { xp: 1 } },
});

/** Campo aberto de 20 × 9: o jogador no tile (2, 4) e um alvo de 1000 de vida em (8, 4). Sorteio sempre no mínimo. */
function setup() {
  const clock = new FakeClock();
  const tiled = tiledFromAscii(Array.from({ length: 9 }, () => '.'.repeat(20)), { x: 2, y: 4 }, [{ monster: 'alvo', x: 8, y: 4, w: 1, h: 1 }]);
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
  const target = [...world.monsters.values()][0]!;
  const lastShot = () => [...world.projectiles.values()].at(-1);
  const put = (id: AttributeId, n: number) => {
    for (let i = 0; i < n; i++) world.addAttribute(player, id);
  };
  return { world, clock, conn, player, run, target, lastShot, put };
}

const statsOf = (conn: FakeConn) => conn.ofType('stats').at(-1)!.stats;

describe('os atributos no jogo', () => {
  it('as boas-vindas trazem os pontos (no nível 1, nenhum) e subir de nível dá mais 3', () => {
    const { world, conn, player, run } = setup();
    expect(conn.ofType('welcome')[0]!.stats).toMatchObject({ attrs: noAttributes(), attrPoints: 0 });
    world.adminGiveXp(player, 1_000_000); // sobe vários níveis de uma vez
    run(TICK_MS);
    expect(statsOf(conn).attrPoints).toBe((player.level - 1) * 3);
  });

  it('pôr um ponto: vale na hora; sem pontos, o servidor recusa e explica', () => {
    const { world, conn, player, run, put } = setup();
    world.adminSetLevel(player, 3); // 6 pontos
    put('forca', 4);
    put('destreza', 2);
    expect(player.attributes).toEqual({ forca: 4, destreza: 2, espirito: 0, vitalidade: 0 });
    world.addAttribute(player, 'forca'); // o 7º: não tem
    expect(player.attributes.forca).toBe(4);
    run(TICK_MS);
    expect(conn.ofType('sys').at(-1)!.text).toMatch(/Sem pontos de atributo/);
    expect(statsOf(conn)).toMatchObject({ attrs: { forca: 4, destreza: 2, espirito: 0, vitalidade: 0 }, attrPoints: 0 });
  });

  it('Vitalidade: a vida máxima cresce, e a vida junto (quem está perto vê); recomeçar devolve tudo', () => {
    const { world, conn, player, run, put } = setup();
    const other = new FakeConn();
    const beto = world.join('Beto', other);
    if (!beto.ok) throw new Error(beto.reason);
    run(TICK_MS);
    world.adminSetLevel(player, 3); // 6 pontos
    const base = maxHpFor(3);
    expect(player.maxHp).toBe(base);
    player.hp = 50;
    put('vitalidade', 2);
    expect(player.maxHp).toBe(base + 10);
    expect(player.hp).toBe(60); // ganhou os 10 que a máxima ganhou
    run(TICK_MS);
    expect(other.ofType('hp')).toContainEqual({ t: 'hp', id: player.id, hp: 60, maxHp: base + 10 });
    player.hp = 60; // (a vida volta sozinha aos poucos)
    world.resetAttributes(player);
    expect(player.attributes).toEqual(noAttributes());
    expect(player.maxHp).toBe(base);
    expect(player.hp).toBe(60); // cabe na máxima: fica como estava
    run(TICK_MS);
    expect(conn.ofType('sys').at(-1)!.text).toMatch(/atributos voltaram/);
    player.hp = 60;
    put('vitalidade', 6);
    expect(player.hp).toBe(90);
    world.resetAttributes(player);
    expect(player.hp).toBe(base); // não passa da máxima nova
    run(TICK_MS);
    expect(statsOf(conn)).toMatchObject({ attrs: noAttributes(), attrPoints: 6, maxHp: base });
  });

  it('Força: o tiro de sempre bate mais forte (com a puxada também)', () => {
    const { world, clock, player, lastShot, put } = setup();
    world.adminSetLevel(player, 10); // 27 pontos
    const [min] = damageRange(10);
    world.shoot(player, 1, 0);
    expect(lastShot()!.damage).toBe(min);
    put('forca', 25); // +50%
    clock.advance(1000);
    world.shoot(player, 2, 0);
    expect(lastShot()!.damage).toBe(Math.round(min * 1.5));
    clock.advance(1000);
    world.charge(player);
    clock.advance(CHARGE_FULL_MS);
    world.shoot(player, 3, 0);
    expect(lastShot()!.damage).toBe(Math.round(min * 2 * 1.5)); // a puxada cheia dobra, e a Força em cima
  });

  it('Destreza: puxa mais rápido e atira de novo mais cedo', () => {
    const plain = setup();
    const quick = setup();
    for (const game of [plain, quick]) game.world.adminSetLevel(game.player, 10);
    quick.put('destreza', 20); // puxada 30% e intervalo 20% menores
    const [min] = damageRange(10);
    for (const game of [plain, quick]) {
      game.world.shoot(game.player, 1, 0);
      game.clock.advance(380); // depois do intervalo de quem tem Destreza (360 ms), antes do de sempre (450 ms)
      game.world.shoot(game.player, 2, 0);
    }
    expect(plain.world.projectiles.size).toBe(1); // ainda na recarga
    expect(quick.world.projectiles.size).toBe(2);
    for (const game of [plain, quick]) {
      game.clock.advance(1000);
      game.world.charge(game.player);
      game.clock.advance(770); // a puxada de quem tem Destreza: 1,1 s × 0,7
      game.world.shoot(game.player, 3, 0);
    }
    expect(quick.lastShot()!.damage).toBe(min * 2); // já cheia
    expect(plain.lastShot()!.damage).toBe(Math.round(min * 1.7)); // 70% da puxada
  });

  it('Espírito: as habilidades da classe batem mais forte e voltam mais cedo (o tiro de sempre não muda)', () => {
    const game = setup();
    const { world, conn, player, run, target, put, lastShot } = game;
    player.quests.espantar = { state: 'done', count: 1 };
    world.adminSetLevel(player, 11); // 30 pontos
    world.chooseClass(player, 'cacador');
    world.learnSkill(player, 'chuva');
    world.learnSkill(player, 'olhos');
    put('espirito', 20); // +40% de dano e 20% a menos de recarga
    run(TICK_MS);
    const [min] = damageRange(11);
    // a Chuva no pé do alvo, com a puxada cheia (o dano todo)
    world.castSkill(player, 'chuva', 0, 0);
    world.charge(player);
    run(CHARGE_FULL_MS + TICK_MS);
    const feet = feetAt(player.fx, player.fy);
    const spot = feetAt(target.x, target.y);
    world.shoot(player, 1, Math.atan2(spot.y - feet.y, spot.x - feet.x), Math.hypot(spot.x - feet.x, spot.y - feet.y));
    run(700);
    expect(target.hp).toBe(1000 - Math.round(min * 1.4));
    expect(conn.ofType('scd').at(-1)).toEqual({ t: 'scd', s: 'chuva', ms: 8000 });
    // os Olhos de Gavião também voltam mais cedo
    world.castSkill(player, 'olhos', 0, 0);
    run(TICK_MS);
    expect(conn.ofType('scd').at(-1)).toEqual({ t: 'scd', s: 'olhos', ms: 24_000 });
    // e o tiro de sempre fica igual
    run(1000);
    world.shoot(player, 2, 0);
    expect(lastShot()!.damage).toBe(min);
  });

  it('baixar o nível pelo painel: os atributos que passaram voltam (e a vida máxima acompanha)', () => {
    const { world, conn, player, run, put } = setup();
    world.adminSetLevel(player, 4); // 9 pontos
    put('vitalidade', 9);
    expect(player.maxHp).toBe(maxHpFor(4) + 45);
    world.adminSetLevel(player, 5); // cabe: ficam
    expect(player.attributes.vitalidade).toBe(9);
    expect(player.maxHp).toBe(maxHpFor(5) + 45);
    world.adminSetLevel(player, 2); // 3 pontos: não cabe, voltam todos
    expect(player.attributes).toEqual(noAttributes());
    expect(player.maxHp).toBe(maxHpFor(2));
    expect(player.hp).toBe(maxHpFor(2));
    run(TICK_MS);
    expect(conn.ofType('sys').some((m) => /pontos dos atributos voltaram/.test(m.text))).toBe(true);
  });
});

describe('os atributos ficam salvos', () => {
  it('vão para o arquivo e voltam conferidos com o nível (a vida máxima já com a Vitalidade)', () => {
    const { world, player, put } = setup();
    world.adminSetLevel(player, 2);
    put('forca', 1);
    put('vitalidade', 2);
    expect(characterData(player, 'campo').attributes).toEqual({ forca: 1, destreza: 0, espirito: 0, vitalidade: 2 });

    const clock = new FakeClock();
    const map = GameMap.fromTiled(tiledFromAscii(['.'.repeat(8), '.'.repeat(8)], { x: 1, y: 1 }), 'campo');
    const fresh = new World(map, { now: clock.now, random: () => 0, classes, quests, npcs, monsters, items });
    const base = { id: 1, name: 'Cida', level: 2, xp: 0, hp: null, zone: null, x: null, y: null, dir: 0 as const, look: 1, inventory: null };
    const conn = new FakeConn();
    const joined = fresh.join('Cida', conn, { character: { ...base, attributes: { forca: 1, vitalidade: 2 } }, created: false });
    if (!joined.ok) throw new Error(joined.reason);
    expect(joined.player.attributes).toEqual({ forca: 1, destreza: 0, espirito: 0, vitalidade: 2 });
    expect(joined.player.maxHp).toBe(maxHpFor(2) + 10);
    expect(joined.player.hp).toBe(maxHpFor(2) + 10);
    expect(conn.ofType('welcome')[0]!.stats).toMatchObject({ attrs: { forca: 1, vitalidade: 2 }, attrPoints: 0, maxHp: maxHpFor(2) + 10 });
    // mais pontos que o nível dá (o arquivo é de outra conta): voltam todos para distribuir
    const conn2 = new FakeConn();
    const again = fresh.join('Duda', conn2, { character: { ...base, id: 2, name: 'Duda', level: 1, attributes: { forca: 1 } }, created: false });
    if (!again.ok) throw new Error(again.reason);
    expect(again.player.attributes).toEqual(noAttributes());
    // personagem salvo antes dos atributos: começa sem nenhum posto
    const conn3 = new FakeConn();
    const old = fresh.join('Edu', conn3, { character: { ...base, id: 3, name: 'Edu', level: 3 }, created: false });
    if (!old.ok) throw new Error(old.reason);
    expect(old.player.attributes).toEqual(noAttributes());
    expect(conn3.ofType('welcome')[0]!.stats.attrPoints).toBe(6);
  });
});
