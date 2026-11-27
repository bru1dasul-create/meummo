// Combate no jogo 2.5D: o que a tela desenha tem que bater com o que o servidor decide.
// (src/client/novo/combat.ts desenha; src/shared/combat.ts e o servidor decidem.)

import { describe, expect, it } from 'vitest';
import { aimAngle, barHeight, BODY_HEIGHT, distanceToSegment, floaterHeight, SHOT_DRAW_Z, shotFeet, shotOriginOfFeet, shotZ, tileFeetSquare } from '../src/client/novo/combat';
import { angleBetween, hasShotPath, makeShot, shotTouches } from '../src/shared/combat';
import { feetAt, footTile } from '../src/shared/movement';

let seed = 7;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

describe('combate do jogo novo: desenho igual à regra', () => {
  it('a mira respeita o tronco e enxerga um alvo ao lado dele, até dentro do mesmo tile', () => {
    const map = { blocksShot: () => true, blocksShotAt: (x: number, y: number) => x >= 1.2 && x <= 1.4 && y < 0.7 };
    const me = { x: 0, y: 0 };
    expect(hasShotPath(map, me, { x: 3, y: 0 })).toBe(false);
    expect(hasShotPath(map, me, { x: 3, y: 1.5 })).toBe(true);
  });

  it('um obstáculo depois do ponto de impacto não tira o monstro da mira', () => {
    const map = { blocksShot: (x: number) => x >= 3 };
    expect(hasShotPath(map, { x: 0, y: 0 }, { x: 2.75, y: 0 })).toBe(true);
    expect(hasShotPath(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
  });

  it('o pé está dentro do quadrado vermelho do aviso exatamente quando o servidor acerta aquele tile', () => {
    for (let n = 0; n < 2000; n++) {
      const x = random() * 40;
      const y = random() * 40;
      const tile = footTile(x, y); // o tile que o servidor usa para o golpe
      const feet = feetAt(x, y); // onde o pé é desenhado
      const [a, , c] = tileFeetSquare(tile.x, tile.y);
      expect(feet.x >= a!.x && feet.x < c!.x && feet.y >= a!.y && feet.y < c!.y).toBe(true);
    }
  });

  it('a pedra desenhada encosta no pé de quem ela acerta (mesma distância que o servidor mede)', () => {
    for (let n = 0; n < 2000; n++) {
      const sx = random() * 30;
      const sy = random() * 30;
      const mx = Math.floor(random() * 30); // monstro: tile inteiro
      const my = Math.floor(random() * 30);
      const radius = 0.6;
      const drawn = shotFeet(sx, sy);
      const feet = feetAt(mx, my);
      const close = Math.hypot(drawn.x - feet.x, drawn.y - feet.y) <= radius + 1e-9;
      if (Math.abs(Math.hypot(drawn.x - feet.x, drawn.y - feet.y) - radius) < 1e-6) continue; // na beirada exata
      expect(close).toBe(shotTouches(sx, sy, mx, my, radius));
    }
  });

  it('o seu tiro aparece saindo de onde o servidor solta a pedra', () => {
    for (const [x, y] of [[3.25, 7.5], [10, 4], [0.4, 0.9]] as const) {
      const feet = feetAt(x, y);
      const shot = makeShot({ x, y }, 0, 14, 7);
      const origin = shotOriginOfFeet(feet.x, feet.y);
      expect(origin.x).toBeCloseTo(shot.x, 9);
      expect(origin.y).toBeCloseTo(shot.y, 9);
    }
  });

  it('mirar do seu pé até o pé do monstro dá o mesmo ângulo que o servidor usa', () => {
    for (let n = 0; n < 500; n++) {
      const me = { x: random() * 30, y: random() * 30 };
      const monster = { x: Math.floor(random() * 30), y: Math.floor(random() * 30) };
      expect(aimAngle(feetAt(me.x, me.y), feetAt(monster.x, monster.y))).toBeCloseTo(angleBetween(me, monster), 9);
    }
  });

  it('toque em cima do corpo: distância até o segmento do pé à cabeça', () => {
    const foot = { x: 100, y: 200 };
    const head = { x: 100, y: 100 };
    expect(distanceToSegment({ x: 110, y: 150 }, foot, head)).toBeCloseTo(10);
    expect(distanceToSegment({ x: 100, y: 230 }, foot, head)).toBeCloseTo(30); // abaixo do pé
    expect(distanceToSegment({ x: 100, y: 80 }, foot, head)).toBeCloseTo(20); // acima da cabeça
  });

  it('a flecha de jogador sai do arco (na altura do ombro) e desce até a altura do voo; a do bicho não muda', () => {
    expect(shotZ(false, 0)).toBeCloseTo(1.35); // na mão do arco
    expect(shotZ(false, 0.55)).toBeCloseTo(1.35);
    const middle = shotZ(false, 2);
    expect(middle).toBeLessThan(1.35);
    expect(middle).toBeGreaterThan(SHOT_DRAW_Z);
    expect(shotZ(false, 3.55)).toBeCloseTo(SHOT_DRAW_Z); // depois de 3 m, voa onde acerta os bichos e crava
    expect(shotZ(false, 12)).toBeCloseTo(SHOT_DRAW_Z);
    expect(shotZ(true, 0)).toBe(SHOT_DRAW_Z);
  });

  it('no fim do alcance o tiro cai em curva até o chão (e não despenca de uma vez)', () => {
    // voo de 10 m: reto até 7,5 m, depois desce cada vez mais rápido até o chão no ponto mirado
    expect(shotZ(false, 7.5, 10)).toBeCloseTo(SHOT_DRAW_Z);
    expect(shotZ(false, 8.75, 10)).toBeCloseTo(SHOT_DRAW_Z * 0.75);
    expect(shotZ(false, 10, 10)).toBeCloseTo(0);
    expect(shotZ(false, 10.3, 10)).toBeCloseTo(0); // (o `ahead` passa do fim: a ponta aponta para baixo)
    expect(shotZ(true, 10, 10)).toBeCloseTo(0); // o dos bichos também cai
    // voo curto (3 m): a queda é só nos últimos 30% (0,9 m), saindo ainda da altura do arco
    expect(shotZ(false, 2.1, 3)).toBeCloseTo(shotZ(false, 2.1));
    expect(shotZ(false, 3, 3)).toBeCloseTo(0);
    // descendo sempre, sem degrau
    let last = Infinity;
    for (let d = 7.5; d <= 10; d += 0.1) {
      const z = shotZ(false, d, 10);
      expect(z).toBeLessThanOrEqual(last + 1e-9);
      last = z;
    }
  });
});

describe('a barra de vida', () => {
  it('na altura de sempre para gente e bicho baixo; acima do galho; na Cuca chefe, que é alta, acima do nome (25/11)', () => {
    const base = BODY_HEIGHT + 0.12;
    const zPx = 57; // 1 m de altura na tela, no zoom de sempre
    expect(barHeight(null, undefined, zPx)).toBeCloseTo(base); // gente: a view não conta o alto
    expect(barHeight(null, 2.2, zPx)).toBeCloseTo(2.45); // pendurado num galho de 2,2 m, como antes
    expect(barHeight(Number.NaN, undefined, zPx)).toBeCloseTo(base);
    // o tatu (36 cm): a barra logo acima do nome dele, e não 1,3 m acima (o dono, 26/11: "SIM")
    const tatu = barHeight(0.36, undefined, zPx);
    expect(tatu).toBeGreaterThan(0.36 + 0.1 + 13 / zPx);
    expect(tatu).toBeLessThan(0.9);
    // a chefe (2,1 m): a barra passa da cabeça e do nome (a linha de baixo do nome a 10 cm da cabeça, letras de 13 px)
    const boss = barHeight(2.1, undefined, zPx);
    const nameTop = 2.1 + 0.1 + 13 / zPx;
    expect(boss).toBeGreaterThan(nameTop);
    expect((boss - nameTop) * zPx).toBeLessThan(8); // logo acima do nome, sem ficar longe
    // com o zoom, o nome tem o mesmo tamanho na tela: a folga em pixels não muda
    for (const px of [30, 57, 110]) expect((barHeight(2.1, undefined, px) - 2.2) * px).toBeCloseTo((boss - 2.2) * zPx);
  });

  it('os números de dano sobem 40 cm acima da barra: num bicho, perto dele; em gente e no galho, como sempre', () => {
    const zPx = 57;
    expect(floaterHeight(0.36, undefined, zPx)).toBeCloseTo(barHeight(0.36, undefined, zPx) + 0.4); // o tatu
    expect(floaterHeight(2.1, undefined, zPx)).toBeCloseTo(barHeight(2.1, undefined, zPx) + 0.4); // a chefe
    expect(floaterHeight(null, undefined, zPx)).toBeCloseTo(BODY_HEIGHT + 0.7); // gente
    expect(floaterHeight(null, 2.2, zPx)).toBeCloseTo(2.85); // no galho
  });
});
