// Ícones dos itens desenhados por código, como os monstros.
// Equipamentos: o ícone é feito automaticamente do visual dele no personagem (game/doll/gearIcon.ts,
// 32x32), então sempre combina com o que aparece no corpo. Os outros itens (comida, materiais) usam os
// desenhos 16x16 daqui, pelo campo "icone" de data/items.json; ícone sem desenho vira uma trouxinha.
// Para trocar por arte de verdade: carregue uma imagem com a mesma chave (`item-<icone>`).

import type Phaser from 'phaser';
import { gearIcon, ICON_SIZE } from './game/doll/gearIcon';
import { GEAR_ART } from './game/gearArt';
import { outline } from './game/monsterArt';

const SIZE = 16;

interface IconArt {
  colors: Record<string, string>;
  rows: string[];
}

const ICONS: Record<string, IconArt> = {
  banana: {
    colors: { Y: '#f7d34a', y: '#c99a1e', b: '#5a3b1a' },
    rows: [
      '................',
      '................',
      '.............b..',
      '............Yb..',
      '...........YY...',
      '..........YYy...',
      '.........YYYy...',
      '........YYYy....',
      '.......YYYYy....',
      '.....YYYYYy.....',
      '...YYYYYYy......',
      '..bYYYYyy.......',
      '...yyyy.........',
      '................',
      '................',
      '................',
    ],
  },
  couro: {
    colors: { L: '#a8794a', d: '#6b4a2b', l: '#c99a66' },
    rows: [
      '................',
      '................',
      '....LLL...LL....',
      '...LlLLLLLLLL...',
      '..LLdLLLdLLlL...',
      '..LLLLLLLLLdL...',
      '...LdLLLdLLLL...',
      '...LLLLlLLLLL...',
      '..LLLdLLLLdLL...',
      '..LlLLLLLLLLLL..',
      '...LLdLLLdLLL...',
      '....LLLLLLLL....',
      '.....LL..LL.....',
      '................',
      '................',
      '................',
    ],
  },
  mochila: {
    colors: { B: '#a0703f', b: '#5e3d21', y: '#e9b941', l: '#c08a55' },
    rows: [
      '................',
      '................',
      '......bbbb......',
      '.....b....b.....',
      '....BBBBBBBB....',
      '...BlBBBBBBBB...',
      '...BBbbbbbbBB...',
      '...BlBBBBBBBB...',
      '...BBBByyBBBB...',
      '...BlBByyBBBB...',
      '...BBBBBBBBBB...',
      '...BlBBBBBBBB...',
      '....BBBBBBBB....',
      '................',
      '................',
      '................',
    ],
  },
};

const canvases = new Map<string, HTMLCanvasElement>();
const urls = new Map<string, string>();

function iconCanvas(icon: string, appearance: string): HTMLCanvasElement {
  const id = `${icon}|${appearance}`;
  const cached = canvases.get(id);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  const fromGear = GEAR_ART[appearance] ? gearIcon(GEAR_ART[appearance]!) : null;
  if (fromGear) {
    // já vem com contorno
    canvas.width = canvas.height = ICON_SIZE;
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(fromGear.data), ICON_SIZE, ICON_SIZE), 0, 0);
    canvases.set(id, canvas);
    return canvas;
  }
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  {
    const art = ICONS[icon] ?? ICONS.mochila!;
    art.rows.forEach((row, y) => {
      for (let x = 0; x < SIZE; x++) {
        const color = art.colors[row[x]!];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }
  outline(ctx, SIZE, SIZE);
  canvases.set(id, canvas);
  return canvas;
}

/** O ícone como imagem para usar no HTML (mochila). `appearance`: visual do equipamento, se tiver. */
export function itemIconUrl(icon: string, appearance = ''): string {
  const id = `${icon}|${appearance}`;
  let url = urls.get(id);
  if (!url) {
    url = iconCanvas(icon, appearance).toDataURL();
    urls.set(id, url);
  }
  return url;
}

/** O ícone como textura do Phaser (item voando do monstro até você). */
export function itemTexture(scene: Phaser.Scene, icon: string, appearance = ''): string {
  const key = `item-${icon}-${appearance}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, iconCanvas(icon, appearance));
  return key;
}
