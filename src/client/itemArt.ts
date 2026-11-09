// Ícones dos itens desenhados por código (pixel art 16x16), como os monstros.
// Cada item de data/items.json diz qual desenho usar no campo "icone". Ícone sem desenho vira uma trouxinha.
// Para trocar por arte de verdade: carregue uma imagem com a mesma chave (`item-<icone>`).

import type Phaser from "phaser";
import { outline } from "./game/monsterArt";

const SIZE = 16;

export interface IconArt {
  colors: Record<string, string>;
  rows: string[];
}

const ICONS: Record<string, IconArt> = {
  banana: {
    colors: { Y: "#f7d34a", y: "#c99a1e", b: "#5a3b1a" },
    rows: [
      "................",
      "................",
      ".............b..",
      "............Yb..",
      "...........YY...",
      "..........YYy...",
      ".........YYYy...",
      "........YYYy....",
      ".......YYYYy....",
      ".....YYYYYy.....",
      "...YYYYYYy......",
      "..bYYYYyy.......",
      "...yyyy.........",
      "................",
      "................",
      "................",
    ],
  },
  couro: {
    colors: { L: "#a8794a", d: "#6b4a2b", l: "#c99a66" },
    rows: [
      "................",
      "................",
      "....LLL...LL....",
      "...LlLLLLLLLL...",
      "..LLdLLLdLLlL...",
      "..LLLLLLLLLdL...",
      "...LdLLLdLLLL...",
      "...LLLLlLLLLL...",
      "..LLLdLLLLdLL...",
      "..LlLLLLLLLLLL..",
      "...LLdLLLdLLL...",
      "....LLLLLLLL....",
      ".....LL..LL.....",
      "................",
      "................",
      "................",
    ],
  },
  // escama da Iara: verde-água brilhante, com reflexo rosado de madrepérola
  escama: {
    colors: { a: "#2a6f6a", b: "#5fd0c0", B: "#3aa898", W: "#effffa", p: "#f4c4dc" },
    rows: [
      "................",
      "................",
      "...aaaaaaaaaa...",
      "..aWWpbbbbbbBa..",
      "..aWpbbbbbbbBa..",
      "..abbbbbbbbbBa..",
      "..aBbbbbbbbbBa..",
      "..abBbbbbbbBBa..",
      "...abBBBBBBBa...",
      "...abbbbbbbBa...",
      "....aBbbbbBa....",
      ".....aBBBBa.....",
      "......abba......",
      ".......aa.......",
      "................",
      "................",
    ],
  },
  // dente de jacaré: grande, curvo e pontudo, com a raiz mais escura
  dente: {
    colors: { I: "#efe6c8", W: "#fffdf4", i: "#c9b98e", r: "#a8845a", R: "#7a5a3a" },
    rows: [
      "................",
      "................",
      "......RrrR......",
      ".....RrrrrR.....",
      ".....iIIIIi.....",
      ".....IWIIIi.....",
      ".....IWIIIi.....",
      "......WIIIi.....",
      "......IWIIi.....",
      ".......WIi......",
      ".......IIi......",
      "........Ii......",
      "........I.......",
      "................",
      "................",
      "................",
    ],
  },
  chapeu_palha: {
    colors: { S: "#e8c872", s: "#b8913c", R: "#c0392b" },
    rows: [
      "................",
      "................",
      "................",
      "................",
      "......SSSS......",
      ".....SSsSSS.....",
      ".....SSSSsS.....",
      ".....RRRRRR.....",
      "..SSSSSSSSSSSS..",
      ".SSsSSsSSsSSsSS.",
      "..ssSSSSSSSSss..",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  estilingue: {
    colors: { W: "#7a4a22", w: "#b07a45", r: "#e04f4f", h: "#4a2b12" },
    rows: [
      "................",
      "..ww.......ww...",
      "..wW.......Ww...",
      "...W.......W....",
      "...WW.....WW....",
      "....Wr...rW.....",
      "....WWrrrWW.....",
      ".....WWWWW......",
      "......WWW.......",
      "......WwW.......",
      "......WhW.......",
      "......WhW.......",
      "......WhW.......",
      "......WWW.......",
      "................",
      "................",
    ],
  },
  colar: {
    colors: { c: "#8a6b3d", F: "#f3efe0", f: "#c9c2ad" },
    rows: [
      "................",
      "................",
      "..c..........c..",
      "..c..........c..",
      "...c........c...",
      "...c........c...",
      "....c......c....",
      "....cc....cc....",
      ".....cccccc.....",
      ".....F.FF.F.....",
      ".....F.Ff.F.....",
      ".....f..f.f.....",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  gibao: {
    colors: { L: "#9b6a3c", d: "#5e3d21", l: "#c08a55", y: "#e9b941" },
    rows: [
      "................",
      "................",
      "....LL....LL....",
      "...LlLL..LLlL...",
      "..LLLLLL.LLLLL..",
      "..LLLLLd.dLLLL..",
      "..LlLLLdydLLlL..",
      "...LLLLd.dLLL...",
      "...LLLLdydLLL...",
      "...LlLLd.dLlL...",
      "...LLLLdydLLL...",
      "...LLLLd.dLLL...",
      "...LLLL...LLL...",
      "................",
      "................",
      "................",
    ],
  },
  gorro: {
    colors: { R: "#d62f2f", r: "#8e1b1b", w: "#ff8a7a" },
    rows: [
      "................",
      "................",
      "..........RR....",
      ".........RRRr...",
      "........RRRr....",
      ".......RwRRr....",
      "......RwRRRr....",
      ".....RRwRRRR....",
      "....RRRRRRRRr...",
      "....RRRRRRRRR...",
      "...RRRRRRRRRRr..",
      "...rrrrrrrrrrr..",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  erva: {
    colors: {
      G: "#5d9c48",
      g: "#447a36",
      L: "#8ccf66",
      S: "#3d6b2a",
      Y: "#e3d968",
    },
    rows: [
      "................",
      "................",
      ".......LL.......",
      "......LGGL..Y...",
      ".....GGLGG.LL...",
      "..Y..gGGGgGGL...",
      "..LL..gGGGGg....",
      ".LGGL..gSGg.....",
      "..GGGg..S.......",
      "...gGGg.S.......",
      ".....gGSS.......",
      ".......S........",
      ".......S........",
      "......SS........",
      "................",
      "................",
    ],
  },
  sucata: {
    colors: {
      R: "#9a4a2b",
      r: "#6a3119",
      L: "#c26a3c",
      I: "#6d7076",
      i: "#4f5257",
    },
    rows: [
      "................",
      "................",
      ".........IIi....",
      "........IiiiI...",
      ".......IiI.IiI..",
      "..RRRR.IiI.IiI..",
      ".RLLRRr.IiiiI...",
      ".RLRRRr..IIi....",
      ".RRRRrr.........",
      "..rrrr..RRRRR...",
      ".......RLLLRRr..",
      "....IIIRRRRRrr..",
      "...IiiiIrrrrr...",
      "....IIII........",
      "................",
      "................",
    ],
  },
  faca: {
    colors: {
      B: "#b8bcc2",
      b: "#7f848a",
      W: "#eef0f2",
      C: "#c87533",
      c: "#8a4a1e",
    },
    rows: [
      "................",
      ".............W..",
      "............WB..",
      "...........WBb..",
      "..........WBb...",
      ".........WBb....",
      "........WBb.....",
      ".......WBb......",
      "......cCb.......",
      ".....cCCc.......",
      "....cCCc........",
      "...cCCc.........",
      "..cCCc..........",
      "..cc............",
      "................",
      "................",
    ],
  },
  couraca: {
    colors: {
      I: "#8a8f96",
      i: "#5c6066",
      L: "#aab0b6",
      R: "#9a4a2b",
      S: "#6b4a2b",
      D: "#2a2d31",
    },
    rows: [
      "................",
      "................",
      "....SIIDDIIS....",
      "...SIILDDLIIS...",
      "..IIILIDDILIII..",
      "..ILIIIiiIIILI..",
      "..IIIIIiiIIRII..",
      "..SIIIIiiIIIIS..",
      "...IIIIiiIIII...",
      "...ILIIiiIIRI...",
      "...SSSSSSSSSS...",
      "...IIIIiiIIII...",
      "....IRIiiIIII...",
      ".....IIiiIII....",
      "................",
      "................",
    ],
  },
  ferradura: {
    colors: { O: "#ff9a2e", Y: "#ffe066", R: "#e0482b", D: "#7a2a17" },
    rows: [
      "................",
      "................",
      ".....OOOOOO.....",
      "....OYYYYYYO....",
      "...OYOOOOOOYO...",
      "..OYOD....DOYO..",
      "..OYO......OYO..",
      "..OYD......DYO..",
      "..OYO......OYO..",
      "..OYD......DYO..",
      "..ROYO....OYOR..",
      "..RROR....RORR..",
      "...RR......RR...",
      "................",
      "................",
      "................",
    ],
  },
  mochila: {
    colors: { B: "#a0703f", b: "#5e3d21", y: "#e9b941", l: "#c08a55" },
    rows: [
      "................",
      "................",
      "......bbbb......",
      ".....b....b.....",
      "....BBBBBBBB....",
      "...BlBBBBBBBB...",
      "...BBbbbbbbBB...",
      "...BlBBBBBBBB...",
      "...BBBByyBBBB...",
      "...BlBByyBBBB...",
      "...BBBBBBBBBB...",
      "...BlBBBBBBBB...",
      "....BBBBBBBB....",
      "................",
      "................",
      "................",
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
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
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
  if (!scene.textures.exists(key))
    scene.textures.addCanvas(key, iconCanvas(icon));
  return key;
}
