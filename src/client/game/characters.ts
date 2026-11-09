// Personagens desenhados por código (pixel art 20x24, com contorno). Cada "look" (vem do nome) escolhe
// pele, cabelo (cor e jeito), roupa e olhos; o equipamento aparece por cima, em camadas: chapéu ou gorro,
// colete ou couraça, a arma na mão e o amuleto no peito. Para trocar por arte de verdade: é só trocar estas
// funções por spritesheets com o mesmo layout (9 quadros: [costas, lado, frente] x [parado, passo A, passo B]).

import type Phaser from 'phaser';
import type { Facing } from '../../shared/dir';
import type { EquipSlot, GearLook } from '../../shared/items';

export const CHAR_W = 20;
export const CHAR_H = 24;
/** Quantos pixels acima dos pés fica o topo da cabeça (onde o nome aparece). */
export const CHAR_TOP = 23;

type View = 'up' | 'side' | 'down';
type Step = 0 | 1 | 2;
type Color = readonly [number, number, number, number];
/** Desenho em texto: cada letra é uma cor da paleta, '.' é vazio. Sempre 20 colunas. */
type Art = readonly string[];

// ---------------------------------------------------------------- cores

function hex(color: string, alpha = 255): Color {
  const v = parseInt(color.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, alpha];
}
function shade(c: Color, f: number): Color {
  return [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f)), c[3]];
}

const SKINS = ['#f8dcc0', '#efc39f', '#d9a37a', '#b9805a', '#8c5a3c', '#5e3a26'];
const HAIRS = ['#2a1c14', '#4b2f1e', '#7b4a25', '#b5803c', '#e2c372', '#dcdcdc', '#a33a26', '#3b4486', '#2f6a42', '#7d2f72', '#141418', '#c46a8a'];
const SHIRTS = [
  '#b03a2e', '#c8642a', '#d4a72c', '#5f8f3a', '#2e7d6b', '#2f6f9f', '#3b4f9a', '#6b3fa0',
  '#9c3b6e', '#e6e2d6', '#7f8288', '#6b4a2b', '#2f3136', '#1f7f8f', '#a0522d', '#8a9a3a',
];
const PANTS = ['#3b3b58', '#4c3a2a', '#2f4a3a', '#5a4632', '#2c2c2c', '#47506b'];
const BOOTS = ['#3b2616', '#2a1f1a', '#5a3a1e'];
const IRIS = ['#3b2a1a', '#2f4f7a', '#2f5f3a'];
const OUTLINE = hex('#1d1a26');

const HAIR_STYLES = ['curto', 'longo', 'coque', 'cacheado', 'rabo'] as const;
type HairStyle = (typeof HAIR_STYLES)[number];

function palette(look: number): { colors: Record<string, Color>; hair: HairStyle } {
  const skin = hex(SKINS[look % SKINS.length]!);
  const hair = hex(HAIRS[(look >>> 4) % HAIRS.length]!);
  const shirt = hex(SHIRTS[(look >>> 8) % SHIRTS.length]!);
  const pants = hex(PANTS[(look >>> 13) % PANTS.length]!);
  const boot = hex(BOOTS[(look >>> 16) % BOOTS.length]!);
  return {
    hair: HAIR_STYLES[(look >>> 18) % HAIR_STYLES.length]!,
    colors: {
      S: skin,
      s: shade(skin, 0.86),
      n: shade(skin, 0.8),
      K: skin,
      k: shade(skin, 0.8),
      E: hex(IRIS[(look >>> 21) % IRIS.length]!),
      e: hex('#16141c'),
      m: hex('#9a4f43'),
      r: hex('#e8736b', 110),
      W: shade(hair, 0.6),
      H: hair,
      h: shade(hair, 0.7),
      l: shade(hair, 1.3),
      T: shirt,
      t: shade(shirt, 0.74),
      L: shade(shirt, 1.22),
      B: hex('#4a2f18'),
      b: hex('#d9b54a'),
      P: pants,
      p: shade(pants, 0.75),
      F: boot,
      f: shade(boot, 0.6),
    },
  };
}

// ---------------------------------------------------------------- corpo
// Linhas 0-3: espaço para chapéu. Cabeça 4-12, pescoço 13, tronco 14-18 (cinto na 18), pernas 19-23.

const DOWN_HEAD: Art = [
  '....................',
  '....................',
  '....................',
  '....................',
  '.......SSSSSS.......',
  '......SSSSSSSS......',
  '......SSSSSSSS......',
  '......SWWSSWWS......',
  '.....sSSESSESSs.....',
  '.....sSSeSSeSSs.....',
  '......SrSSSSrS......',
  '......sSSmmSSs......',
  '.......sSSSSs.......',
  '........sSSs........',
];
const UP_HEAD: Art = [
  '....................',
  '....................',
  '....................',
  '....................',
  '.......SSSSSS.......',
  '......SSSSSSSS......',
  '......SSSSSSSS......',
  '......SSSSSSSS......',
  '.....sSSSSSSSSs.....',
  '.....sSSSSSSSSs.....',
  '......SSSSSSSS......',
  '......sSSSSSSs......',
  '.......sSSSSs.......',
  '........sSSs........',
];
const SIDE_HEAD: Art = [
  '....................',
  '....................',
  '....................',
  '....................',
  '........SSSSS.......',
  '.......SSSSSSS......',
  '.......SSSSSSS......',
  '.......SSSSWWS......',
  '.......SSsSSES......',
  '.......SSsSSeSn.....',
  '.......SSSSSrS......',
  '.......sSSSSSm......',
  '........sSSSS.......',
  '.........sSs........',
];

/** Tronco e braços (linhas 14-19) de frente/costas, para cada passo (os braços balançam). */
const FRONT_TORSO: Record<Step, Art> = {
  0: [
    '.....tTTLssLTTt.....',
    '.....tTTTTTTTTt.....',
    '.....tTTTTTTTTt.....',
    '.....KtTTTTTTtK.....',
    '.....kBBBbbBBBk.....',
    '.......PPPPPP.......',
  ],
  1: [
    '.....tTTLssLTTt.....',
    '.....tTTTTTTTTt.....',
    '.....KTTTTTTTTt.....',
    '.....ktTTTTTTtt.....',
    '......BBBbbBBBK.....',
    '.......PPPPPP.k.....',
  ],
  2: [
    '.....tTTLssLTTt.....',
    '.....tTTTTTTTTt.....',
    '.....tTTTTTTTTK.....',
    '.....ttTTTTTTtk.....',
    '.....KBBBbbBBB......',
    '.....k.PPPPPP.......',
  ],
};
const BACK_TORSO: Record<Step, Art> = {
  0: [
    '.....tTTTTTTTTt.....',
    '.....tTTTTTTTTt.....',
    '.....tTTTTTTTTt.....',
    '.....KtTTTTTTtK.....',
    '.....kBBBBBBBBk.....',
    '.......PPPPPP.......',
  ],
  1: [
    '.....tTTTTTTTTt.....',
    '.....tTTTTTTTTt.....',
    '.....tTTTTTTTTK.....',
    '.....ttTTTTTTtk.....',
    '.....KBBBBBBBB......',
    '.....k.PPPPPP.......',
  ],
  2: [
    '.....tTTTTTTTTt.....',
    '.....tTTTTTTTTt.....',
    '.....KTTTTTTTTt.....',
    '.....ktTTTTTTtt.....',
    '......BBBBBBBBK.....',
    '.......PPPPPP.k.....',
  ],
};
const SIDE_TORSO: Art = [
  '.......tTTTLT.......',
  '.......tTTTTT.......',
  '.......tTTTTT.......',
  '.......tTTTTT.......',
  '.......BBBBbB.......',
  '.......PPPPPP.......',
];
/** O braço do lado de cá, no perfil (desenhado por cima do colete ou da couraça). */
const SIDE_ARM: Record<Step, Art> = {
  0: ['.........tt.........', '.........tt.........', '.........tt.........', '.........KK.........', '..........k.........'],
  1: ['.........tt.........', '..........tt........', '...........tt.......', '...........KK.......', '....................'],
  2: ['.........tt.........', '........tt..........', '.......tt...........', '.......KK...........', '....................'],
};

/** Pernas (linhas 20-23). */
const FRONT_LEGS: Record<Step, Art> = {
  0: ['.......PpPPpP.......', '.......PP..PP.......', '.......FF..FF.......', '.......ff..ff.......'],
  1: ['.......PpPPpP.......', '.......FF..PP.......', '.......ff..FF.......', '...........ff.......'],
  2: ['.......PpPPpP.......', '.......PP..FF.......', '.......FF..ff.......', '.......ff...........'],
};
const SIDE_LEGS: Record<Step, Art> = {
  0: ['........PPPP........', '........PPPP........', '........FFFF........', '........fffff.......'],
  1: ['.......PP..PP.......', '......PP....PP......', '......FF....FF......', '.....ff.....fff.....'],
  2: ['........PPPP........', '........PP.PP.......', '........FF..FF......', '........ff..........'],
};

// ---------------------------------------------------------------- cabelos (uma camada por vista)

const HAIR: Record<HairStyle, Record<View, Art>> = {
  curto: {
    down: [
      '....................',
      '....................',
      '.......hHHHHh.......',
      '......HHlHHHHH......',
      '.....hHHHHHHHHh.....',
      '.....HHHHHHHHHH.....',
      '.....HHH.HH.HHH.....',
      '.....H........H.....',
    ],
    up: [
      '....................',
      '....................',
      '.......hHHHHh.......',
      '......HHHHlHHH......',
      '.....hHHHHHHHHh.....',
      '.....HHHHHHHHHH.....',
      '.....HHHHHHHHHH.....',
      '.....HHHHHHHHHH.....',
      '......HHHHHHHH......',
      '......HHHHHHHH......',
      '......hHHHHHHh......',
      '.......hhhhhh.......',
    ],
    side: [
      '....................',
      '....................',
      '........hHHHh.......',
      '.......HHHlHHH......',
      '......hHHHHHHHH.....',
      '......HHHHHHHHH.....',
      '......HHHHHHH.......',
      '......HHHH..........',
      '......HHH...........',
      '......HHH...........',
      '......hHH...........',
      '.......h............',
    ],
  },
  longo: {
    down: [
      '....................',
      '....................',
      '.......hHHHHh.......',
      '......HHlHHHHH......',
      '.....hHHHHHHHHh.....',
      '.....HHHHHHHHHH.....',
      '....HHHH.HH.HHHH....',
      '....hH........Hh....',
      '....HH........HH....',
      '....HH........HH....',
      '....HH........HH....',
      '....HH........HH....',
      '....hH........Hh....',
      '....hh........hh....',
      '....hh........hh....',
    ],
    up: [
      '....................',
      '....................',
      '.......hHHHHh.......',
      '......HHHHlHHH......',
      '.....hHHHHHHHHh.....',
      '.....HHHHHHHHHH.....',
      '.....HHHHHHHHHH.....',
      '.....HHHHHHHHHH.....',
      '....HHHHHHHHHHHH....',
      '....HHHHHHHHHHHH....',
      '....HHHHHHHHHHHH....',
      '....HHHHHHHHHHHH....',
      '....hHHHHHHHHHHh....',
      '.....HHHHHHHHHH.....',
      '.....hHHHHHHHHh.....',
      '......hhhhhhhh......',
    ],
    side: [
      '....................',
      '....................',
      '........hHHHh.......',
      '.......HHHlHHH......',
      '......hHHHHHHHH.....',
      '......HHHHHHHHH.....',
      '.....HHHHHHHH.......',
      '.....HHHHH..........',
      '.....HHHH...........',
      '.....HHHH...........',
      '.....HHHH...........',
      '.....hHHH...........',
      '.....hHHh...........',
      '.....hHh............',
      '......h.............',
    ],
  },
  coque: {
    down: [
      '........hHHh........',
      '........HlHH........',
      '.......hHHHHh.......',
      '......HHlHHHHH......',
      '.....hHHHHHHHHh.....',
      '.....HHHHHHHHHH.....',
      '.....HH......HH.....',
      '.....H........H.....',
    ],
    up: [
      '........hHHh........',
      '........HHlH........',
      '.......hHhhHh.......',
      '......HHHHlHHH......',
      '.....hHHHHHHHHh.....',
      '.....HHHHHHHHHH.....',
      '.....HHHHHHHHHH.....',
      '.....HHHHHHHHHH.....',
      '......HHHHHHHH......',
      '......HHHHHHHH......',
      '......hHHHHHHh......',
      '.......hhhhhh.......',
    ],
    side: [
      '.....hHh............',
      '.....HlHh...........',
      '.....hHhHHHh........',
      '.......HHHlHHH......',
      '......hHHHHHHHH.....',
      '......HHHHHHHHH.....',
      '......HHHHHH........',
      '......HHHH..........',
      '......HHH...........',
      '......HHH...........',
      '......hHH...........',
      '.......h............',
    ],
  },
  cacheado: {
    down: [
      '.......hHhHhH.......',
      '.....hHHHHHHHHh.....',
      '....hHHHlHHHHHHh....',
      '...hHHHHHHHHHHHHh...',
      '...HHHHHHHHHHHHHH...',
      '...HHHHHHHHHHHHHH...',
      '...HHH........HHH...',
      '...hHH........HHh...',
      '...hHH........HHh...',
      '....hH........Hh....',
      '....hh........hh....',
    ],
    up: [
      '.......hHhHhH.......',
      '.....hHHHHHHHHh.....',
      '....hHHHHHlHHHHh....',
      '...hHHHHHHHHHHHHh...',
      '...HHHHHHHHHHHHHH...',
      '...HHHHHHHHHHHHHH...',
      '...HHHHHHHHHHHHHH...',
      '...HHHHHHHHHHHHHH...',
      '...hHHHHHHHHHHHHh...',
      '....hHHHHHHHHHHh....',
      '.....hHHHHHHHHh.....',
      '.......hhhhhh.......',
    ],
    side: [
      '........hHhHh.......',
      '......hHHHHHHh......',
      '.....hHHHlHHHHh.....',
      '....hHHHHHHHHHHh....',
      '....HHHHHHHHHHHH....',
      '....HHHHHHHHHHHH....',
      '....HHHHHHH.........',
      '....HHHHHH..........',
      '....HHHHH...........',
      '....HHHHH...........',
      '....hHHHh...........',
      '.....hhh............',
    ],
  },
  rabo: {
    down: [
      '....................',
      '....................',
      '.......hHHHHh.......',
      '......HHlHHHHH......',
      '.....hHHHHHHHHh.....',
      '.....HHHHHHHHHH.....',
      '.....HH......HH.....',
      '.....H........H.....',
    ],
    up: [
      '....................',
      '....................',
      '.......hHHHHh.......',
      '......HHHHlHHH......',
      '.....hHHHHHHHHh.....',
      '.....HHHHHHHHHH.....',
      '.....HHHHHHHHHH.....',
      '.....HHHHWWHHHH.....',
      '......HHWLLWHH......',
      '......hHWHlWHh......',
      '......hhWHHWhh......',
      '.......hWHHWh.......',
      '........WHHW........',
      '.........HH.........',
      '.........Hh.........',
      '.........hh.........',
      '..........h.........',
    ],
    side: [
      '....................',
      '....................',
      '........hHHHh.......',
      '.......HHHlHHH......',
      '......hHHHHHHHH.....',
      '.....LHHHHHHHHH.....',
      '....hHHHHHHHH.......',
      '....HHHHHH..........',
      '...hHH.HHH..........',
      '...HH..HHH..........',
      '...Hh..hHH..........',
      '...h....h...........',
    ],
  },
};

// ---------------------------------------------------------------- equipamento
// Cada peça tem a sua paleta. Chapéu/gorro: linhas 0-6. Colete/couraça: linhas 14-17. Amuleto: 13-15.

interface GearArt {
  colors: Record<string, string>;
  views: Partial<Record<View, Art>>;
}

const STRAW = { Y: '#e8c872', y: '#b8913c', R: '#c0392b' };
const SACI_CAP = { R: '#d62f2f', r: '#8e1b1b', w: '#ff8a7a' };

const HEAD_GEAR: Record<string, GearArt> = {
  chapeu_palha: {
    colors: STRAW,
    views: {
      down: [
        '....................',
        '.......yYYYYy.......',
        '......YYYYYYYY......',
        '......YYYyYYYY......',
        '......RRRRRRRR......',
        '..yYYYYYYYYYYYYYYy..',
        '...yyyyyyyyyyyyyy...',
      ],
      side: [
        '....................',
        '........yYYYy.......',
        '.......YYYYYYY......',
        '.......YYYyYYY......',
        '.......RRRRRRR......',
        '...yYYYYYYYYYYYYYy..',
        '....yyyyyyyyyyyyy...',
      ],
    },
  },
  gorro: {
    colors: SACI_CAP,
    views: {
      down: [
        '.............rRR....',
        '...........rRRRr....',
        '.......rRRRRRRr.....',
        '......rRwRRRRRRr....',
        '.....rRRRRRRRRRr....',
        '.....rrrrrrrrrr.....',
      ],
      side: [
        '............rRRr....',
        '..........rRRRRR....',
        '.......rRRRRRRr.....',
        '......rRwRRRRRr.....',
        '......rRRRRRRRr.....',
        '......rrrrrrrrr.....',
      ],
    },
  },
};

const BODY_GEAR: Record<string, GearArt> = {
  gibao: {
    colors: { V: '#9b6a3c', v: '#6e4a2a', d: '#3e2814' },
    views: {
      down: ['......VVv..vVV......', '......VVVddVVV......', '......VVV..VVV......', '......vVVddVVv......'],
      up: ['......VVVVVVVV......', '......VVVVVVVV......', '......VVVvvVVV......', '......vVVVVVVv......'],
      side: ['.......VVVVV........', '.......VVVVVd.......', '.......VVVVV........', '.......vVVVVd.......'],
    },
  },
  couraca: {
    colors: { I: '#8a8f96', i: '#5c6066', L: '#b4bac0', R: '#9a4a2b', o: '#dde1e5' },
    views: {
      down: ['.....iIILIILIIi.....', '.....iIIIiiIIIi.....', '......IoIiiIoI......', '......iIRIIIIi......'],
      up: ['.....iIIIIIIIIi.....', '.....iIIIIIIIIi.....', '......IIIiiIII......', '......iIIIIIRi......'],
      side: ['.......iIILII.......', '.......iIIIII.......', '.......iIoIII.......', '.......iIIRII.......'],
    },
  },
};

const CHARM_GEAR: Record<string, GearArt> = {
  colar: {
    colors: { c: '#6b4a2b', F: '#f3efe0' },
    views: {
      down: ['........c..c........', '........cFFc........', '.........FF.........'],
      up: ['........cccc........'],
      side: ['..........c.........', '...........cF.......', '............F.......'],
    },
  },
  ferradura: {
    colors: { c: '#3a2a1e', O: '#ff9a2e', Y: '#ffe066' },
    views: {
      down: ['........c..c........', '.........OY.........', '........O..O........'],
      up: ['........cccc........'],
      side: ['..........c.........', '............O.......', '...........O.O......'],
    },
  },
};

/** Arma na mão: o desenho é relativo ao pixel da mão. */
const WEAPONS: Record<string, { colors: Record<string, string>; front: [number, number, string][]; side: [number, number, string][] }> = {
  estilingue: {
    colors: { W: '#7a4a22', w: '#b07a45', r: '#e04f4f' },
    front: [[1, 0, 'W'], [1, 1, 'w'], [0, -1, 'W'], [2, -1, 'W'], [0, -2, 'w'], [2, -2, 'w'], [1, -2, 'r']],
    side: [[1, 0, 'W'], [2, 0, 'W'], [3, -1, 'w'], [3, 1, 'w'], [3, 0, 'r']],
  },
  faca: {
    colors: { C: '#c87533', B: '#b8bcc2', W: '#eef0f2' },
    front: [[1, 0, 'C'], [1, 1, 'B'], [1, 2, 'B'], [1, 3, 'W']],
    side: [[1, 0, 'C'], [2, 0, 'B'], [3, 0, 'B'], [4, 0, 'W']],
  },
};

/** Onde fica a mão que segura a arma, em cada vista e passo (anda junto com o balanço do braço). */
const HAND: Record<View, Record<Step, [number, number]>> = {
  down: { 0: [14, 17], 1: [14, 18], 2: [14, 16] },
  up: { 0: [5, 17], 1: [5, 16], 2: [5, 18] },
  side: { 0: [10, 17], 1: [12, 16], 2: [8, 17] },
};

// ---------------------------------------------------------------- montagem

class Sheet {
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  set(x: number, y: number, c: Color): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const a = c[3] / 255;
    if (a >= 1 || this.data[i + 3] === 0) {
      this.data.set([c[0], c[1], c[2], Math.max(c[3], this.data[i + 3]!)], i);
      return;
    }
    for (let k = 0; k < 3; k++) this.data[i + k] = Math.round(c[k]! * a + this.data[i + k]! * (1 - a));
  }

  solid(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height && this.data[(y * this.width + x) * 4 + 3]! > 0;
  }
}

/** Pinta um desenho em texto a partir da linha `top` do quadro que começa em `ox`. */
function paint(sheet: Sheet, ox: number, top: number, art: Art, colors: Record<string, Color>, skip?: (x: number, y: number) => boolean): void {
  art.forEach((row, dy) => {
    for (let x = 0; x < CHAR_W; x++) {
      const color = colors[row[x]!];
      const y = top + dy;
      if (color && !skip?.(x, y)) sheet.set(ox + x, y, color);
    }
  });
}

const toColors = (table: Record<string, string>) => Object.fromEntries(Object.entries(table).map(([k, v]) => [k, hex(v)]));
/** O mesmo desenho virado da esquerda para a direita. */
const mirror = (art: Art): Art => art.map((row) => [...row].reverse().join(''));

function drawFrame(sheet: Sheet, ox: number, view: View, step: Step, look: number, gear: GearLook): void {
  const { colors, hair } = palette(look);
  const hairArt = HAIR[hair][view];
  const hat = gear.head ? HEAD_GEAR[gear.head] : undefined;
  // de costas, sem desenho próprio: o da frente espelhado (a ponta do gorro cai para o outro lado)
  const hatArt = hat ? (hat.views[view] ?? (view === 'up' && hat.views.down ? mirror(hat.views.down) : hat.views.down)) : undefined;
  // com chapéu/gorro, o cabelo de cima fica escondido (só aparece o que sai por baixo da aba)
  const underHat = hatArt ? (_x: number, y: number) => y <= 5 : undefined;

  // cabelo comprido de costas fica atrás do corpo; nas outras vistas, por cima da cabeça
  if (view === 'up') {
    paint(sheet, ox, 0, view === 'up' ? UP_HEAD : DOWN_HEAD, colors);
  } else {
    paint(sheet, ox, 0, view === 'down' ? DOWN_HEAD : SIDE_HEAD, colors);
  }
  if (view === 'side') {
    paint(sheet, ox, 14, SIDE_TORSO, colors);
    paint(sheet, ox, 20, SIDE_LEGS[step], colors);
  } else {
    paint(sheet, ox, 14, view === 'down' ? FRONT_TORSO[step] : BACK_TORSO[step], colors);
    paint(sheet, ox, 20, FRONT_LEGS[step], colors);
  }
  paint(sheet, ox, 0, hairArt, colors, underHat);

  const body = gear.body ? BODY_GEAR[gear.body] : undefined;
  const bodyArt = body?.views[view];
  if (body && bodyArt) paint(sheet, ox, 14, bodyArt, toColors(body.colors));
  if (view === 'side') paint(sheet, ox, 14, SIDE_ARM[step], colors);

  const charm = gear.charm ? CHARM_GEAR[gear.charm] : undefined;
  const charmArt = charm?.views[view];
  if (charm && charmArt) paint(sheet, ox, 13, charmArt, toColors(charm.colors));

  const weapon = gear.weapon ? WEAPONS[gear.weapon] : undefined;
  if (weapon) {
    const [hx, hy] = HAND[view][step];
    const weaponColors = toColors(weapon.colors);
    const flip = view === 'up' ? -1 : 1; // de costas, a arma fica na outra mão (espelhada)
    for (const [dx, dy, key] of view === 'side' ? weapon.side : weapon.front) sheet.set(ox + hx + dx * flip, hy + dy, weaponColors[key]!);
  }

  if (hat && hatArt) paint(sheet, ox, 0, hatArt, toColors(hat.colors));
}

function outline(sheet: Sheet): void {
  const targets: number[] = [];
  for (let y = 0; y < sheet.height; y++) {
    for (let x = 0; x < sheet.width; x++) {
      if (sheet.solid(x, y)) continue;
      if (sheet.solid(x - 1, y) || sheet.solid(x + 1, y) || sheet.solid(x, y - 1) || sheet.solid(x, y + 1)) targets.push(x, y);
    }
  }
  for (let i = 0; i < targets.length; i += 2) sheet.set(targets[i]!, targets[i + 1]!, OUTLINE);
}

/** Ordem dos quadros na folha: [costas, lado, frente] x [parado, passo A, passo B]. */
const VIEWS: View[] = ['up', 'side', 'down'];

function gearKey(gear: GearLook): string {
  return [gear.head, gear.body, gear.weapon, gear.charm].map((g) => g ?? '-').join('.');
}

function buildSheet(look: number, gear: GearLook): HTMLCanvasElement {
  const sheet = new Sheet(CHAR_W * 9, CHAR_H);
  VIEWS.forEach((view, group) => {
    for (const step of [0, 1, 2] as const) drawFrame(sheet, (group * 3 + step) * CHAR_W, view, step, look, gear);
  });
  outline(sheet);
  const canvas = document.createElement('canvas');
  canvas.width = sheet.width;
  canvas.height = sheet.height;
  canvas.getContext('2d')!.putImageData(new ImageData(sheet.data, sheet.width, sheet.height), 0, 0);
  return canvas;
}

/** Cria (uma vez só) a textura do personagem com esse look e esse equipamento, e devolve a chave dela. */
export function characterTexture(scene: Phaser.Scene, look: number, gear: GearLook = {}): string {
  const key = `char-${look}-${gearKey(gear)}`;
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.addCanvas(key, buildSheet(look, gear));
  for (let i = 0; i < 9; i++) texture?.add(i, 0, i * CHAR_W, 0, CHAR_W, CHAR_H);
  return key;
}

/** Um quadro do personagem como imagem (o "boneco" da mochila). Quadro 6 = de frente, parado. */
export function characterPortrait(look: number, gear: GearLook = {}, frame = 6): string {
  const sheet = buildSheet(look, gear);
  const canvas = document.createElement('canvas');
  canvas.width = CHAR_W;
  canvas.height = CHAR_H;
  canvas.getContext('2d')!.drawImage(sheet, frame * CHAR_W, 0, CHAR_W, CHAR_H, 0, 0, CHAR_W, CHAR_H);
  return canvas.toDataURL();
}

/** Qual quadro usar: lado (0 cima, 1 direita, 2 baixo, 3 esquerda) e passo (0 parado, 1/2 andando). */
export function characterFrame(facing: Facing, step: Step): number {
  const group = facing === 0 ? 0 : facing === 2 ? 2 : 1;
  return group * 3 + step;
}

/** Se esta peça tem desenho no personagem (sem desenho, ela só não aparece). Usado pelos testes. */
export function hasGearArt(slot: EquipSlot, icon: string): boolean {
  const table = slot === 'head' ? HEAD_GEAR : slot === 'body' ? BODY_GEAR : slot === 'charm' ? CHARM_GEAR : WEAPONS;
  return Object.hasOwn(table, icon);
}

/** Confere os desenhos: 20 colunas, cabem nos 24 pixels de altura e toda letra tem cor. Usado pelos testes. */
export function checkCharacterArt(): string[] {
  const problems: string[] = [];
  const bodyKeys = Object.keys(palette(0).colors);
  const check = (name: string, art: Art, top: number, keys: string[]) => {
    if (top + art.length > CHAR_H) problems.push(`${name}: ${art.length} linhas a partir da ${top} passam de ${CHAR_H}`);
    art.forEach((row, i) => {
      if (row.length !== CHAR_W) problems.push(`${name} linha ${i}: ${row.length} colunas`);
      for (const letter of new Set(row)) if (letter !== '.' && !keys.includes(letter)) problems.push(`${name} linha ${i}: a letra "${letter}" não tem cor`);
    });
  };
  check('cabeça de frente', DOWN_HEAD, 0, bodyKeys);
  check('cabeça de costas', UP_HEAD, 0, bodyKeys);
  check('cabeça de lado', SIDE_HEAD, 0, bodyKeys);
  check('tronco de lado', SIDE_TORSO, 14, bodyKeys);
  for (const step of [0, 1, 2] as const) {
    check(`tronco de frente ${step}`, FRONT_TORSO[step], 14, bodyKeys);
    check(`tronco de costas ${step}`, BACK_TORSO[step], 14, bodyKeys);
    check(`braço de lado ${step}`, SIDE_ARM[step], 14, bodyKeys);
    check(`pernas de frente ${step}`, FRONT_LEGS[step], 20, bodyKeys);
    check(`pernas de lado ${step}`, SIDE_LEGS[step], 20, bodyKeys);
  }
  for (const [style, views] of Object.entries(HAIR)) for (const [view, art] of Object.entries(views)) check(`cabelo ${style} ${view}`, art, 0, bodyKeys);
  for (const [table, top] of [[HEAD_GEAR, 0], [BODY_GEAR, 14], [CHARM_GEAR, 13]] as const) {
    for (const [id, gear] of Object.entries(table)) {
      for (const [view, art] of Object.entries(gear.views)) check(`${id} ${view}`, art!, top, Object.keys(gear.colors));
    }
  }
  for (const [id, weapon] of Object.entries(WEAPONS)) {
    for (const [, , letter] of [...weapon.front, ...weapon.side]) if (!(letter in weapon.colors)) problems.push(`${id}: a letra "${letter}" não tem cor`);
  }
  return problems;
}
