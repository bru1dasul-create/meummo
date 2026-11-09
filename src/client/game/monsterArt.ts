// Monstros desenhados por código, olhando para a direita (o jogo espelha para a esquerda).
// Os novos são pintados com o pincel dos personagens (monsterPaint.ts: volume, contorno, o dobro de
// detalhe e animação de andar, armar e dar o golpe). Os antigos ainda são pixel art 16x16, com dois
// quadros: parado e andando. Para trocar por arte de verdade, carregue um spritesheet com a mesma chave
// (`mon-<tipo>`) e os mesmos quadros.

import type Phaser from "phaser";
import { TILE_SIZE } from "../../shared/constants";
import {
  PAINTED,
  paintedFrame,
  paintedFrameCount,
  paintMonster,
  type PaintedMonster,
} from "./monsterPaint";

const FRAME = 16;
const OUTLINE: [number, number, number] = [29, 24, 30];

interface MonsterArt {
  colors: Record<string, string>;
  frames: string[][];
}

// Sagui-de-tufos-brancos: pequeno, cinza, tufos brancos nas orelhas e rabo listrado.
const SAGUI_BASE = [
  "................",
  "................",
  "................",
  "................",
  ".........W..W...",
  ".........WGGW...",
  "........GFFFFG..",
  "........GFEFEG..",
  "........GFFFFG..",
  "..tT.....GGGG...",
  ".T..t..GGGGGG...",
  ".t...TGGGGGGGG..",
  "..T...GGGGGGGG..",
  "...tTtGGgGGgGG..",
];
const SAGUI: MonsterArt = {
  colors: {
    G: "#8c7d6c",
    g: "#5f5448",
    W: "#f4f1ea",
    F: "#3d322b",
    E: "#f2d27a",
    T: "#4d4338",
    t: "#b8aa97",
  },
  frames: [
    [...SAGUI_BASE, "......Gg..Gg....", "................"],
    [...SAGUI_BASE, ".....Gg....Gg...", "................"],
  ],
};

// Jararaca: cobra enrolada com a cabeça levantada, manchas escuras e língua de fora.
const JARARACA_BASE_TOP = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "..........BBB...",
  ".........BBEBB..",
];
const JARARACA_BASE_BOTTOM = [
  "..........BBL...",
  ".........BBL....",
  "....BBDBBBL.....",
  "...BDBBBDBBB....",
  "..BBBLLLLLBDB...",
  "..BDBBBDBBBBB...",
  "...BBBBBBBB.....",
  "................",
];
const JARARACA: MonsterArt = {
  colors: {
    B: "#8e6b3f",
    D: "#4b3620",
    L: "#cdb07a",
    E: "#f0d24a",
    R: "#d63a3a",
  },
  frames: [
    [...JARARACA_BASE_TOP, ".........BBBBBRR", ...JARARACA_BASE_BOTTOM],
    [...JARARACA_BASE_TOP, ".........BBBBB..", ...JARARACA_BASE_BOTTOM],
  ],
};

// Saci: gorro vermelho pontudo, uma perna só, bermuda vermelha e cachimbo.
const SACI_ROWS = [
  "................",
  "........CC......",
  ".......CCCC.....",
  "......CCCCCC....",
  ".....cCCCCCCc...",
  "......SSSSSS....",
  "......SSWSSW....",
  "......SSSSSSPP..",
  ".......SSSS..P..",
  "......SSSSSS....",
  ".....S.SSSS.S...",
  ".....S.RRRR.S...",
  ".......RRRR.....",
  "........SS......",
  "........SS......",
  "................",
];
const SACI: MonsterArt = {
  colors: {
    C: "#d93636",
    c: "#9c2020",
    S: "#6b4329",
    W: "#f6f2ea",
    P: "#8d6e63",
    R: "#c62f2f",
  },
  // segundo quadro: pulinho (tudo um pixel para cima)
  frames: [SACI_ROWS, [...SACI_ROWS.slice(1), "................"]],
};

// Corpo-Seco: morto-vivo ressecado e corcunda, com os braços esticados e olhos pálidos.
const CORPO_SECO: MonsterArt = {
  colors: {
    S: "#8a7a62",
    s: "#5e523f",
    E: "#e2ea84",
    C: "#3f3a35",
    c: "#2a2622",
  },
  frames: [
    [
      "................",
      ".......SSS......",
      "......SSSSS.....",
      "......SsEsE.....",
      "......SSSSs.....",
      ".......sSs......",
      ".....CCCCCSSSS..",
      "....CCCCCCC..Ss.",
      "....CsCCCCC.....",
      ".....CCCCCC.....",
      ".....CCcCCC.....",
      ".....Cc.cCc.....",
      ".....SS..SS.....",
      ".....S....S.....",
      "....ss....ss....",
      "................",
    ],
    [
      "................",
      "................",
      ".......SSS......",
      "......SSSSS.....",
      "......SsEsE.....",
      "......SSSSsSS...",
      ".....CCsSsCC.Ss.",
      "....CCCCCCC.....",
      "....CsCCCCC.....",
      ".....CCCCCC.....",
      ".....CCcCCC.....",
      ".....Cc.cCc.....",
      "......SS.SS.....",
      "......S..S......",
      ".....ss..ss.....",
      "................",
    ],
  ],
};

// Capelobo: corpo peludo de gente e cabeça de tamanduá, com o focinho comprido e garras.
const CAPELOBO: MonsterArt = {
  colors: {
    F: "#7a5a3a",
    f: "#523a24",
    L: "#a88a62",
    N: "#5a4636",
    E: "#f0d24a",
    W: "#e9e2cf",
    T: "#d65a6a",
  },
  frames: [
    [
      "................",
      ".....FFF........",
      "....FFFFFNNN....",
      "....FFEFFNNNNNN.",
      "....FFFFF....NT.",
      ".....fFFf.......",
      "....fFFFFFf.....",
      "...fFFLLLFFW....",
      "...fFFLLLFF.....",
      "....FFLLLFF.....",
      "....fFFFFFf.....",
      ".....FF.FF......",
      ".....FF.FF......",
      "....fWW.fWW.....",
      "................",
      "................",
    ],
    [
      "................",
      "................",
      ".....FFF........",
      "....FFFFFNNN....",
      "....FFEFFNNNNNNT",
      "....FFFFF.......",
      ".....fFFfW......",
      "....fFFFFFf.....",
      "...fFFLLLFF.....",
      "...fFFLLLFF.....",
      "....FFLLLFF.....",
      "....fFFFFFf.....",
      "....FF...FF.....",
      "...fWW...fWW....",
      "................",
      "................",
    ],
  ],
};

// Mula sem Cabeça: mula escura com fogo saindo do pescoço (e ferraduras brilhando).
const MULA: MonsterArt = {
  colors: {
    B: "#3a2a22",
    b: "#24190f",
    L: "#5a4232",
    H: "#ffb347",
    Y: "#ffe066",
    O: "#ff9a2e",
    R: "#e0482b",
  },
  frames: [
    [
      "................",
      "............Y...",
      "...........YOY..",
      "..........YORY..",
      "..........ORRO..",
      "...BBBBBBBBBR...",
      "..BBBBBBBBBBB...",
      ".bBLLLLLLLBBB...",
      ".b.BBBBBBBBBB...",
      "...BBBBBBBBB....",
      "...BB.....BB....",
      "...BB.....BB....",
      "...Bb.....Bb....",
      "...HH.....HH....",
      "................",
      "................",
    ],
    [
      "................",
      "...........Y....",
      "..........YOY.Y.",
      "..........ORYOY.",
      "...........RRO..",
      "...BBBBBBBBBR...",
      "..BBBBBBBBBBB...",
      ".bBLLLLLLLBBB...",
      "b..BBBBBBBBBB...",
      "...BBBBBBBBB....",
      "..BB.......BB...",
      "..BB.......BB...",
      ".Bb.........Bb..",
      ".HH.........HH..",
      "................",
      "................",
    ],
  ],
};

// Qualquer monstro novo sem desenho ainda vira uma bolinha roxa.
const BLOB_ROWS = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......PPP......",
  ".....PPPPPPP....",
  "....PPWPPPWPP...",
  "....PPEPPPEPP...",
  "....PPPPPPPPP...",
  "....PPPPPPPPP...",
  ".....PPPPPPP....",
  "................",
  "................",
  "................",
];
const BLOB: MonsterArt = {
  colors: { P: "#8e5bd6", W: "#ffffff", E: "#1b1b2a" },
  frames: [BLOB_ROWS, [...BLOB_ROWS.slice(1), "................"]],
};

const ART: Record<string, MonsterArt> = {
  sagui: SAGUI,
  jararaca: JARARACA,
  saci: SACI,
  corpo_seco: CORPO_SECO,
  capelobo: CAPELOBO,
  mula_sem_cabeca: MULA,
};

/** Contorno escuro de 1 pixel em volta do desenho (deixa a arte legível em qualquer chão). */
export function outline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  const solid = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height &&
    d[(y * width + x) * 4 + 3]! > 0;
  const targets: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (
        !solid(x, y) &&
        (solid(x - 1, y) ||
          solid(x + 1, y) ||
          solid(x, y - 1) ||
          solid(x, y + 1))
      )
        targets.push((y * width + x) * 4);
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

/** Monstros antigos (16x16) que se mexem mesmo parados (o Saci pulando, o fogo da Mula). */
const ANIMATED_IDLE = new Set(["saci", "mula_sem_cabeca"]);

/** O que muda o quadro do monstro a cada momento. */
export interface MonsterMoment {
  now: number;
  moving: boolean;
  /** Preparando o golpe (o aviso vermelho está no chão). */
  windup: boolean;
  /** Logo depois de preparar: o golpe. */
  striking: boolean;
  /** Número da entidade, para os monstros parados não respirarem todos juntos. */
  seed: number;
}

/** Como o monstro aparece: textura, tamanho, sombra, altura do nome e qual quadro mostrar. */
export interface MonsterLook {
  key: string;
  /** Escala do sprite (os pintados têm o dobro de detalhe e aparecem na metade). */
  scale: number;
  /** Ponto de apoio (0 a 1, de cima para baixo): logo abaixo dos pés. */
  originY: number;
  /** Altura do nome acima dos pés (pixels do mapa). */
  top: number;
  /** Largura da sombra no chão (pixels do mapa). */
  shadow: number;
  /** Quanto o monstro "pulsa" enquanto prepara o golpe (os pintados já abrem a boca, pulsam menos). */
  pulse: number;
  frame(moment: MonsterMoment): number;
}

function paintedTexture(scene: Phaser.Scene, key: string, art: PaintedMonster): void {
  const sheet = paintMonster(art);
  const canvas = document.createElement("canvas");
  canvas.width = sheet.width;
  canvas.height = sheet.height;
  canvas
    .getContext("2d")!
    .putImageData(
      new ImageData(
        new Uint8ClampedArray(sheet.data),
        sheet.width,
        sheet.height,
      ),
      0,
      0,
    );
  const texture = scene.textures.addCanvas(key, canvas);
  for (let i = 0; i < paintedFrameCount(art); i++)
    texture?.add(i, 0, i * art.width, 0, art.width, art.height);
}

/** Cria (uma vez só) a textura do monstro e diz como mostrá-lo. */
export function monsterLook(scene: Phaser.Scene, type: string): MonsterLook {
  const art = PAINTED[type];
  if (!art) {
    return {
      key: monsterTexture(scene, type),
      scale: 1,
      originY: 1,
      top: TILE_SIZE,
      shadow: 10,
      pulse: 0.12,
      frame: ({ now, moving }) =>
        moving || (now % 900 < 450 && ANIMATED_IDLE.has(type)) ? 1 : 0,
    };
  }
  const key = `mon-${type}`;
  if (!scene.textures.exists(key)) paintedTexture(scene, key, art);
  return {
    key,
    scale: 0.5,
    originY: art.feet / art.height,
    top: art.top,
    shadow: art.shadow,
    pulse: 0.05,
    frame: ({ now, moving, windup, striking, seed }) => {
      if (windup) return paintedFrame(art, "windup", 0);
      if (striking) return paintedFrame(art, "attack", 0);
      if (moving)
        return paintedFrame(art, "walk", Math.floor(now / art.walkMs));
      return paintedFrame(
        art,
        "idle",
        Math.floor((now + seed * 137) / art.idleMs),
      );
    },
  };
}

/** Cria (uma vez só) a textura 16x16 do monstro antigo e devolve a chave dela. Quadro 0 = parado, 1 = andando. */
export function monsterTexture(scene: Phaser.Scene, type: string): string {
  const key = `mon-${type}`;
  if (scene.textures.exists(key)) return key;
  const art = ART[type] ?? BLOB;
  const canvas = document.createElement("canvas");
  canvas.width = FRAME * art.frames.length;
  canvas.height = FRAME;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
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
  for (let i = 0; i < art.frames.length; i++)
    texture?.add(i, 0, i * FRAME, 0, FRAME, FRAME);
  return key;
}
