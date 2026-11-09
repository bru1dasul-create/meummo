// Personagens desenhados por código: cada "look" (vem do nome) gera cores diferentes.
// Quando tivermos arte de verdade, é só trocar esta função por um spritesheet carregado.

import type Phaser from 'phaser';
import type { Facing } from '../../shared/dir';

const FRAME = 16;

// Legenda: . vazio | H cabelo | h cabelo (sombra) | S pele | s pele (sombra) | E olho
//          T roupa | t roupa (sombra) | B cinto | P calça | F bota
const BODY_DOWN = [
  '................',
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '....HHHHHHHH....',
  '....HSSSSSSH....',
  '....SSESSESS....',
  '....SSSSSSSS....',
  '.....sSSSSs.....',
  '....TTTTTTTT....',
  '...STTTTTTTTS...',
  '...STTTTTTTTS...',
  '...sBBBBBBBBs...',
  '....tTTTTTTt....',
];
const BODY_UP = [
  '................',
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '....HHHHHHHH....',
  '....HHHHHHHH....',
  '....HHHHHHHH....',
  '....hHHHHHHh....',
  '.....sSSSSs.....',
  '....TTTTTTTT....',
  '...STTTTTTTTS...',
  '...STTTTTTTTS...',
  '...sBBBBBBBBs...',
  '....tTTTTTTt....',
];
const BODY_SIDE = [
  // olhando para a direita (para a esquerda, o sprite é espelhado)
  '................',
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '....HHHHHHHH....',
  '....HHHHSSSS....',
  '....HHHSSSES....',
  '....hHHSSSSS....',
  '.....hSSSSs.....',
  '.....TTTTTT.....',
  '.....TTTTTT.....',
  '.....TTSSTT.....',
  '.....BBSSBB.....',
  '.....tTTTTt.....',
];
// Pernas (3 últimas linhas): parado, passo A, passo B
const LEGS_FRONT = [
  ['.....PP..PP.....', '.....FF..FF.....', '................'],
  ['.....PP..FF.....', '.....FF.........', '................'],
  ['.....FF..PP.....', '.........FF.....', '................'],
];
const LEGS_SIDE = [
  ['......PPPP......', '......FFFF......', '................'],
  ['.....PP..PP.....', '....FF....FF....', '................'],
  ['......PPPP......', '.....FF..FF.....', '................'],
];

/** Ordem dos quadros: [cima, lado, baixo] x [parado, passo A, passo B]. */
const GROUPS: [string[], string[][]][] = [
  [BODY_UP, LEGS_FRONT],
  [BODY_SIDE, LEGS_SIDE],
  [BODY_DOWN, LEGS_FRONT],
];

const SKINS = ['#f6d5b5', '#ecc39d', '#d49d6e', '#ad7449', '#7c4d2e', '#5b3820'];
const HAIRS = ['#2a1c14', '#4b2f1e', '#7b4a25', '#b5803c', '#e2c372', '#dcdcdc', '#9b2f22', '#3b4486', '#2f6a42', '#7d2f72'];
const PANTS = ['#3b3b58', '#4c3a2a', '#2f4a3a', '#5a4632', '#2c2c2c'];
const OUTLINE: [number, number, number] = [29, 26, 38];

function shade(hex: string, factor: number): string {
  const v = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(((v >> shift) & 255) * factor);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function palette(look: number): Record<string, string> {
  const skin = SKINS[look % SKINS.length]!;
  const hair = HAIRS[(look >>> 4) % HAIRS.length]!;
  const hue = (look >>> 8) % 360;
  return {
    H: hair,
    h: shade(hair, 0.72),
    S: skin,
    s: shade(skin, 0.85),
    E: '#1b1b2a',
    T: `hsl(${hue} 55% 46%)`,
    t: `hsl(${hue} 55% 33%)`,
    B: '#5a3a1e',
    P: PANTS[(look >>> 17) % PANTS.length]!,
    F: '#3b2616',
  };
}

/** Contorno escuro de 1 pixel em volta do personagem (deixa ele legível em qualquer chão). */
function outline(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && d[(y * width + x) * 4 + 3]! > 0;
  const targets: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) targets.push((y * width + x) * 4);
    }
  }
  for (const i of targets) {
    d[i] = OUTLINE[0];
    d[i + 1] = OUTLINE[1];
    d[i + 2] = OUTLINE[2];
    d[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

/** Cria (uma vez só) a textura do personagem com esse look e devolve a chave dela. */
export function characterTexture(scene: Phaser.Scene, look: number): string {
  const key = `char-${look}`;
  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement('canvas');
  canvas.width = FRAME * 9;
  canvas.height = FRAME;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const colors = palette(look);

  GROUPS.forEach(([body, legs], group) => {
    legs.forEach((legRows, frame) => {
      const ox = (group * 3 + frame) * FRAME;
      [...body, ...legRows].forEach((row, y) => {
        for (let x = 0; x < FRAME; x++) {
          const color = colors[row[x]!];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(ox + x, y, 1, 1);
        }
      });
    });
  });
  outline(ctx, canvas.width, canvas.height);

  const texture = scene.textures.addCanvas(key, canvas);
  for (let i = 0; i < 9; i++) texture?.add(i, 0, i * FRAME, 0, FRAME, FRAME);
  return key;
}

/** Qual quadro usar: lado (0 cima, 1 direita, 2 baixo, 3 esquerda) e passo (0 parado, 1/2 andando). */
export function characterFrame(facing: Facing, step: 0 | 1 | 2): number {
  const group = facing === 0 ? 0 : facing === 2 ? 2 : 1;
  return group * 3 + step;
}
