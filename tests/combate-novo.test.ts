// Combate no jogo 2.5D: o que a tela desenha tem que bater com o que o servidor decide.
// (src/client/novo/combat.ts desenha; src/shared/combat.ts e o servidor decidem.)

import { describe, expect, it } from 'vitest';
import { aimAngle, distanceToSegment, shotFeet, shotOriginOfFeet, tileFeetSquare } from '../src/client/novo/combat';
import { angleBetween, makeShot, shotTouches } from '../src/shared/combat';
import { feetAt, footTile } from '../src/shared/movement';

let seed = 7;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

describe('combate do jogo novo: desenho igual à regra', () => {
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
});
