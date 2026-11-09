// Monstros desenhados por código (pixel art 16x16), olhando para a direita.
// Dois quadros: parado e andando. Para trocar por arte de verdade, carregue um spritesheet
// com a mesma chave (`mon-<tipo>`) e os mesmos quadros.

import type Phaser from 'phaser';

const FRAME = 16;
const OUTLINE: [number, number, number] = [29, 24, 30];

interface MonsterArt {
  colors: Record<string, string>;
  frames: string[][];
}

// Sagui-de-tufos-brancos: pequeno, cinza, tufos brancos nas orelhas e rabo listrado.
const SAGUI_BASE = [
  '................',
  '................',
  '................',
  '................',
  '.........W..W...',
  '.........WGGW...',
  '........GFFFFG..',
  '........GFEFEG..',
  '........GFFFFG..',
  '..tT.....GGGG...',
  '.T..t..GGGGGG...',
  '.t...TGGGGGGGG..',
  '..T...GGGGGGGG..',
  '...tTtGGgGGgGG..',
];
const SAGUI: MonsterArt = {
  colors: { G: '#8c7d6c', g: '#5f5448', W: '#f4f1ea', F: '#3d322b', E: '#f2d27a', T: '#4d4338', t: '#b8aa97' },
  frames: [
    [...SAGUI_BASE, '......Gg..Gg....', '................'],
    [...SAGUI_BASE, '.....Gg....Gg...', '................'],
  ],
};

// Jararaca: cobra enrolada com a cabeça levantada, manchas escuras e língua de fora.
const JARARACA_BASE_TOP = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..........BBB...',
  '.........BBEBB..',
];
const JARARACA_BASE_BOTTOM = [
  '..........BBL...',
  '.........BBL....',
  '....BBDBBBL.....',
  '...BDBBBDBBB....',
  '..BBBLLLLLBDB...',
  '..BDBBBDBBBBB...',
  '...BBBBBBBB.....',
  '................',
];
const JARARACA: MonsterArt = {
  colors: { B: '#8e6b3f', D: '#4b3620', L: '#cdb07a', E: '#f0d24a', R: '#d63a3a' },
  frames: [
    [...JARARACA_BASE_TOP, '.........BBBBBRR', ...JARARACA_BASE_BOTTOM],
    [...JARARACA_BASE_TOP, '.........BBBBB..', ...JARARACA_BASE_BOTTOM],
  ],
};

// Saci: gorro vermelho pontudo, uma perna só, bermuda vermelha e cachimbo.
const SACI_ROWS = [
  '................',
  '........CC......',
  '.......CCCC.....',
  '......CCCCCC....',
  '.....cCCCCCCc...',
  '......SSSSSS....',
  '......SSWSSW....',
  '......SSSSSSPP..',
  '.......SSSS..P..',
  '......SSSSSS....',
  '.....S.SSSS.S...',
  '.....S.RRRR.S...',
  '.......RRRR.....',
  '........SS......',
  '........SS......',
  '................',
];
const SACI: MonsterArt = {
  colors: { C: '#d93636', c: '#9c2020', S: '#6b4329', W: '#f6f2ea', P: '#8d6e63', R: '#c62f2f' },
  // segundo quadro: pulinho (tudo um pixel para cima)
  frames: [SACI_ROWS, [...SACI_ROWS.slice(1), '................']],
};

// Qualquer monstro novo sem desenho ainda vira uma bolinha roxa.
const BLOB_ROWS = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......PPP......',
  '.....PPPPPPP....',
  '....PPWPPPWPP...',
  '....PPEPPPEPP...',
  '....PPPPPPPPP...',
  '....PPPPPPPPP...',
  '.....PPPPPPP....',
  '................',
  '................',
  '................',
];
const BLOB: MonsterArt = {
  colors: { P: '#8e5bd6', W: '#ffffff', E: '#1b1b2a' },
  frames: [BLOB_ROWS, [...BLOB_ROWS.slice(1), '................']],
};

const ART: Record<string, MonsterArt> = { sagui: SAGUI, jararaca: JARARACA, saci: SACI };

/** Contorno escuro de 1 pixel em volta do desenho (deixa a arte legível em qualquer chão). */
export function outline(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && d[(y * width + x) * 4 + 3]! > 0;
  const targets: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) targets.push((y * width + x) * 4);
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

/** Cria (uma vez só) a textura do monstro e devolve a chave dela. Quadro 0 = parado, 1 = andando. */
export function monsterTexture(scene: Phaser.Scene, type: string): string {
  const key = `mon-${type}`;
  if (scene.textures.exists(key)) return key;
  const art = ART[type] ?? BLOB;
  const canvas = document.createElement('canvas');
  canvas.width = FRAME * art.frames.length;
  canvas.height = FRAME;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  art.frames.forEach((rows, frame) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < FRAME; x++) {
        const color = art.colors[row[x]!];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(frame * FRAME + x, y, 1, 1);
      }
    });
  });
  outline(ctx, canvas.width, canvas.height);
  const texture = scene.textures.addCanvas(key, canvas);
  for (let i = 0; i < art.frames.length; i++) texture?.add(i, 0, i * FRAME, 0, FRAME, FRAME);
  return key;
}
