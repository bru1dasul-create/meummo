// Ícones dos itens desenhados por código (pixel art 16x16), como os monstros.
// Cada item de data/items.json diz qual desenho usar no campo "icone". Ícone sem desenho vira uma trouxinha.
// Para trocar por arte de verdade: carregue uma imagem com a mesma chave (`item-<icone>`).

import type Phaser from 'phaser';
import { outline } from './game/monsterArt';

const SIZE = 16;

export interface IconArt {
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
  chapeu_palha: {
    colors: { S: '#e8c872', s: '#b8913c', R: '#c0392b' },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '......SSSS......',
      '.....SSsSSS.....',
      '.....SSSSsS.....',
      '.....RRRRRR.....',
      '..SSSSSSSSSSSS..',
      '.SSsSSsSSsSSsSS.',
      '..ssSSSSSSSSss..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  estilingue: {
    colors: { W: '#7a4a22', w: '#b07a45', r: '#e04f4f', h: '#4a2b12' },
    rows: [
      '................',
      '..ww.......ww...',
      '..wW.......Ww...',
      '...W.......W....',
      '...WW.....WW....',
      '....Wr...rW.....',
      '....WWrrrWW.....',
      '.....WWWWW......',
      '......WWW.......',
      '......WwW.......',
      '......WhW.......',
      '......WhW.......',
      '......WhW.......',
      '......WWW.......',
      '................',
      '................',
    ],
  },
  colar: {
    colors: { c: '#8a6b3d', F: '#f3efe0', f: '#c9c2ad' },
    rows: [
      '................',
      '................',
      '..c..........c..',
      '..c..........c..',
      '...c........c...',
      '...c........c...',
      '....c......c....',
      '....cc....cc....',
      '.....cccccc.....',
      '.....F.FF.F.....',
      '.....F.Ff.F.....',
      '.....f..f.f.....',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  gibao: {
    colors: { L: '#9b6a3c', d: '#5e3d21', l: '#c08a55', y: '#e9b941' },
    rows: [
      '................',
      '................',
      '....LL....LL....',
      '...LlLL..LLlL...',
      '..LLLLLL.LLLLL..',
      '..LLLLLd.dLLLL..',
      '..LlLLLdydLLlL..',
      '...LLLLd.dLLL...',
      '...LLLLdydLLL...',
      '...LlLLd.dLlL...',
      '...LLLLdydLLL...',
      '...LLLLd.dLLL...',
      '...LLLL...LLL...',
      '................',
      '................',
      '................',
    ],
  },
  gorro: {
    colors: { R: '#d62f2f', r: '#8e1b1b', w: '#ff8a7a' },
    rows: [
      '................',
      '................',
      '..........RR....',
      '.........RRRr...',
      '........RRRr....',
      '.......RwRRr....',
      '......RwRRRr....',
      '.....RRwRRRR....',
      '....RRRRRRRRr...',
      '....RRRRRRRRR...',
      '...RRRRRRRRRRr..',
      '...rrrrrrrrrrr..',
      '................',
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

function iconCanvas(icon: string): HTMLCanvasElement {
  const cached = canvases.get(icon);
  if (cached) return cached;
  const canvas = drawIcon(ICONS[icon] ?? ICONS.mochila!);
  canvases.set(icon, canvas);
  return canvas;
}

/** Desenha um ícone 16x16 (com contorno escuro). Também usado pelos botões de habilidade. */
export function drawIcon(art: IconArt): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  art.rows.forEach((row, y) => {
    for (let x = 0; x < SIZE; x++) {
      const color = art.colors[row[x]!];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  outline(ctx, SIZE, SIZE);
  return canvas;
}

/** O ícone como imagem para usar no HTML (mochila). */
export function itemIconUrl(icon: string): string {
  let url = urls.get(icon);
  if (!url) {
    url = iconCanvas(icon).toDataURL();
    urls.set(icon, url);
  }
  return url;
}

/** O ícone como textura do Phaser (item voando do monstro até você). */
export function itemTexture(scene: Phaser.Scene, icon: string): string {
  const key = `item-${icon}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, iconCanvas(icon));
  return key;
}
