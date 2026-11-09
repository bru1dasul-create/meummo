// Arte provisória do mundo, desenhada por código (pixel art 16x16).
// Para trocar por arte de verdade: substitua public/assets/tiles.png mantendo a mesma ordem dos tiles,
// ou crie um tileset novo no Tiled.
//
// ATENÇÃO: a ordem desta lista define o número de cada tile no mapa. Só acrescente tiles no FINAL.

import { hex, mulberry32, Pixels, randInt, type RGBA, type Rng } from './pixels';

const T = 16;

const C = {
  grass: hex('#5aa33f'),
  grassDark: hex('#4b8d35'),
  grassLight: hex('#69b54b'),
  grassTuft: hex('#86cf5f'),
  dirt: hex('#b88b58'),
  dirtDark: hex('#a0774a'),
  dirtLight: hex('#c99d69'),
  pebble: hex('#8c6b4b'),
  sand: hex('#e3cf8f'),
  sandDark: hex('#d3bc7a'),
  sandLight: hex('#efe0ad'),
  water: hex('#3f84d4'),
  waterDark: hex('#3574c2'),
  waterLight: hex('#6eaaea'),
  foam: hex('#d4ebff'),
  stone: hex('#a9a8ae'),
  stoneDark: hex('#8a8990'),
  stoneLight: hex('#c0bfc5'),
  wood: hex('#a8743f'),
  woodDark: hex('#7c5331'),
  woodDarker: hex('#5e3d22'),
  woodLight: hex('#bf8a52'),
  leaf: hex('#2f8a3a'),
  leafDark: hex('#23702e'),
  leafLight: hex('#46a84f'),
  pine: hex('#2c7149'),
  pineDark: hex('#215a3a'),
  pineLight: hex('#3b8b5c'),
  trunk: hex('#6e4b2c'),
  trunkDark: hex('#52371f'),
  outline: hex('#1c2a1c'),
  rock: hex('#93929a'),
  rockDark: hex('#6f6e76'),
  rockLight: hex('#b8b7bf'),
  rockEdge: hex('#45444d'),
  roof: hex('#b8493c'),
  roofDark: hex('#913a30'),
  roofLight: hex('#cf6151'),
  plaster: hex('#e6d7b2'),
  plasterDark: hex('#d2c197'),
  plasterShade: hex('#bfae86'),
  beam: hex('#6b4a2b'),
  glass: hex('#7db4e3'),
  glassLight: hex('#d4ebff'),
  door: hex('#7d4e29'),
  doorDark: hex('#5f3a1c'),
  gold: hex('#e9b941'),
  red: hex('#e2435a'),
  yellow: hex('#f6cf3e'),
  white: hex('#f5f3ee'),
  orange: hex('#ef8a2b'),
  stem: hex('#3a8a30'),
  shadow: [0, 0, 0, 70] as RGBA,
};

export interface TileDef {
  key: string;
  /** Bloqueia a passagem. */
  collides?: boolean;
  /** Projéteis passam por cima, mesmo bloqueando a passagem (água). */
  shootOver?: boolean;
  /** Animação (vira a `animation` do Tiled): os tiles de cada quadro e quanto tempo cada um fica. */
  animation?: { key: string; ms: number }[];
  /** Brilho em volta (fogueira, janela acesa): cor e raio em pixels (propriedades `luz` e `luzRaio`). */
  light?: { color: string; radius: number };
  /** Solta faíscas subindo (propriedade `faiscas`): brasas, tambor com fogo. */
  sparks?: boolean;
  draw(p: Pixels, rng: Rng): void;
}

function grass(variant: number) {
  return (p: Pixels, rng: Rng) => {
    p.fill(C.grass);
    p.speckle(rng, [C.grassDark, C.grassDark, C.grassLight], 22);
    // folhinhas: tracinhos de 2 pixels (ponta clara em cima, pé escuro embaixo)
    for (let k = 0; k < 10; k++) {
      const x = randInt(rng, T);
      const y = 1 + randInt(rng, T - 2);
      p.set(x, y, C.grassLight);
      p.set(x, y + 1, C.grassDark);
      if (rng() < 0.4) p.set(x + (rng() < 0.5 ? 1 : -1), y, C.grassLight);
    }
    if (variant === 1) {
      for (let k = 0; k < 3; k++) {
        const x = 2 + randInt(rng, 12);
        const y = 3 + randInt(rng, 11);
        p.set(x, y, C.grassTuft);
        p.set(x - 1, y - 1, C.grassTuft);
        p.set(x + 1, y - 1, C.grassTuft);
        p.set(x, y + 1, C.grassDark);
      }
    }
    if (variant === 2) {
      for (let k = 0; k < 2; k++) {
        const cx = 3 + randInt(rng, 10);
        const cy = 3 + randInt(rng, 10);
        for (let y = cy - 2; y <= cy + 2; y++) {
          for (let x = cx - 2; x <= cx + 2; x++) if (rng() < 0.55) p.set(x, y, C.grassDark);
        }
      }
    }
  };
}

/**
 * Água da represa. `frame` 0, 1 ou 2: as ondinhas balançam de um lado para o outro (a animação vai
 * 0-1-2-1). O fundo é o mesmo em todos os quadros, para só as ondas mexerem.
 */
function water(variant: number, frame = 0) {
  return (p: Pixels) => {
    const rng = mulberry32(310 + variant);
    p.fill(C.water);
    p.speckle(rng, [C.waterDark], 16);
    const waves =
      variant === 0
        ? [
            [2, 4],
            [9, 7],
            [3, 12],
            [11, 14],
          ]
        : [
            [7, 2],
            [1, 8],
            [10, 10],
            [5, 14],
          ];
    waves.forEach(([x, y], i) => wave(p, x! + (i % 2 === 0 ? frame : -frame), y!, C.waterLight));
    if (variant === 1) {
      // brilho do sol na água: aparece, fica mais forte e some
      const glint = frame === 1 ? C.foam : C.waterLight;
      p.set(12, 4, frame === 0 ? C.foam : glint);
      p.set(4, 10, frame === 2 ? C.foam : glint);
      if (frame === 1) {
        p.set(11, 4, C.waterLight);
        p.set(13, 4, C.waterLight);
      }
    }
  };
}

/** Ondinha (um arco de 4 pixels) que dá a volta na borda do tile, para emendar com o vizinho. */
function wave(p: Pixels, x: number, y: number, color: RGBA): void {
  const wrap = (v: number) => ((v % T) + T) % T;
  p.set(wrap(x), y, color);
  p.set(wrap(x + 1), y - 1, color);
  p.set(wrap(x + 2), y - 1, color);
  p.set(wrap(x + 3), y, color);
}

/** Lama do brejo, com poças. */
function drawMud(p: Pixels, rng: Rng): void {
  p.fill(G.mud);
  p.speckle(rng, [G.mudDark, G.mudDark, G.mudLight], 34);
  for (let k = 0; k < 2; k++) p.ellipse(3 + randInt(rng, 10), 3 + randInt(rng, 10), 2.2, 1.3, G.puddle);
  for (let k = 0; k < 3; k++) p.set(randInt(rng, 16), randInt(rng, 16), C.grassDark);
}

/** Terra batida das trilhas: grãos, pedrinhas (com brilho e sombra) e marcas de passos. */
function drawDirt(p: Pixels, rng: Rng): void {
  p.fill(C.dirt);
  p.speckle(rng, [C.dirtDark, C.dirtDark, C.dirtLight], 30);
  for (let k = 0; k < 4; k++) {
    const x = 1 + randInt(rng, 13);
    const y = 1 + randInt(rng, 13);
    p.set(x, y, C.dirtLight);
    p.set(x + 1, y, C.pebble);
    p.set(x, y + 1, C.pebble);
    p.set(x + 1, y + 1, C.dirtDark);
  }
  for (let k = 0; k < 2; k++) {
    const x = 2 + randInt(rng, 11);
    const y = 2 + randInt(rng, 11);
    p.rect(x, y, 2, 1, C.dirtDark); // pegada
    p.set(x + 1, y + 2, C.dirtDark);
  }
}

/** Areia: grãos, marquinhas do vento e, às vezes, uma conchinha. */
function drawSand(p: Pixels, rng: Rng): void {
  p.fill(C.sand);
  p.speckle(rng, [C.sandDark, C.sandDark, C.sandLight], 24);
  for (let k = 0; k < 3; k++) {
    const x = randInt(rng, 12);
    const y = 2 + randInt(rng, 13);
    for (let i = 0; i < 4; i++) p.set(x + i, y - (i === 1 || i === 2 ? 1 : 0), C.sandDark);
    p.set(x + 1, y, C.sandLight);
    p.set(x + 2, y, C.sandLight);
  }
  if (rng() < 0.35) {
    const x = 2 + randInt(rng, 12);
    const y = 2 + randInt(rng, 12);
    p.set(x, y, C.white);
    p.set(x + 1, y, [233, 196, 180, 255]);
  }
}

function planks(p: Pixels, rng: Rng): void {
  p.fill(C.wood);
  for (let x = 3; x < T; x += 4) for (let y = 0; y < T; y++) p.set(x, y, C.woodDark);
  p.speckle(rng, [C.woodLight, C.woodDark], 14);
  for (let x = 0; x < T; x += 4) p.set(x + 1, 3 + randInt(rng, 10), C.woodDarker); // pregos/nós
}

function bridge(rail: 'top' | 'bottom' | 'none') {
  return (p: Pixels, rng: Rng) => {
    planks(p, rng);
    const rows = rail === 'top' ? [0, 1] : rail === 'bottom' ? [14, 15] : [];
    for (const y of rows) {
      for (let x = 0; x < T; x++) p.set(x, y, y === 0 || y === 15 ? C.woodDarker : C.woodDark);
    }
    if (rail !== 'none') {
      const y0 = rail === 'top' ? 0 : 13;
      p.rect(7, y0, 2, 3, C.woodDarker);
    }
  };
}

function flowers(petal: RGBA, center: RGBA) {
  return (p: Pixels, rng: Rng) => {
    const spots: [number, number][] = [];
    while (spots.length < 4) {
      const x = 2 + randInt(rng, 12);
      const y = 2 + randInt(rng, 11);
      if (spots.every(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) > 4)) spots.push([x, y]);
    }
    for (const [x, y] of spots) {
      p.set(x, y + 2, C.stem);
      p.set(x, y + 1, C.stem);
      p.set(x - 1, y, petal);
      p.set(x + 1, y, petal);
      p.set(x, y - 1, petal);
      p.set(x, y, center);
    }
  };
}

function wallBase(p: Pixels, rng: Rng): void {
  p.fill(C.plaster);
  p.speckle(rng, [C.plasterDark], 12);
  for (let x = 0; x < T; x++) {
    p.set(x, 0, C.plasterShade); // sombra do telhado
    p.set(x, 1, C.plasterDark);
    p.set(x, 14, C.stoneDark); // base de pedra
    p.set(x, 15, C.rockDark);
  }
  for (let y = 0; y < 14; y++) {
    p.set(0, y, C.beam);
    p.set(15, y, C.beam);
  }
}

// ---------- Refúgio de Guarapiranga: cores e desenhos ----------

const G = {
  deck: hex('#b8895a'),
  deckDark: hex('#8e6539'),
  deckLight: hex('#cfa06b'),
  nail: hex('#5b3d22'),
  post: hex('#5e3d22'),
  postDark: hex('#3f2814'),
  hull: hex('#8b5a2b'),
  hullDark: hex('#5f3c1b'),
  hullLight: hex('#a8743f'),
  boatInside: hex('#c79a62'),
  paintBlue: hex('#3f7fb5'),
  paintRed: hex('#c0443a'),
  stone: hex('#8a8a90'),
  stoneDark: hex('#5f5f66'),
  fire1: hex('#ffe066'),
  fire2: hex('#ff9a2e'),
  fire3: hex('#e0482b'),
  ember: hex('#7a2a17'),
  log: hex('#6b4a2b'),
  asphalt: hex('#4b4c52'),
  asphaltLight: hex('#5c5d64'),
  asphaltDark: hex('#36373c'),
  crack: hex('#2a2a2e'),
  lane: hex('#c9b458'),
  concrete: hex('#8f9196'),
  concreteDark: hex('#6d6f74'),
  concreteLight: hex('#abadb1'),
  moss: hex('#55803d'),
  mossDark: hex('#3f6630'),
  rust: hex('#9c4a2a'),
  graffiti: [hex('#ff4fa3'), hex('#2ec8e8'), hex('#ffd23f'), hex('#62e26b')],
  carRust: hex('#a8562d'),
  carRustDark: hex('#7a3a1c'),
  carPaint: hex('#5b7fa3'),
  carGlass: hex('#2f4a52'),
  carGlassLight: hex('#5f8a94'),
  tire: hex('#232326'),
  pole: hex('#7b7f86'),
  poleDark: hex('#555960'),
  deep: hex('#2b5f9e'),
  deepDark: hex('#244f86'),
  deepLight: hex('#3d74b8'),
  reed: hex('#4f8f3a'),
  reedDark: hex('#3a6e2b'),
  cattail: hex('#6b4426'),
  mud: hex('#6e5434'),
  mudDark: hex('#57412a'),
  mudLight: hex('#80653f'),
  puddle: hex('#4f7480'),
  tin1: hex('#a3abb0'),
  tin2: hex('#7f888d'),
  tinRust: hex('#a65a33'),
  tinBlue: hex('#4c7fa8'),
  tinRed: hex('#b04a3a'),
  plank: hex('#9b6b3d'),
  plankDark: hex('#74502c'),
  plankLight: hex('#b5834f'),
  ipeYellow: hex('#f2c230'),
  ipeYellowLight: hex('#ffe27a'),
  ipeYellowDark: hex('#c99a1c'),
  ipePink: hex('#e86fb0'),
  ipePinkLight: hex('#ffa6d6'),
  ipePinkDark: hex('#b94d88'),
  bone: hex('#e9e2cf'),
  boneDark: hex('#b9b09a'),
};

/** Cores das Ruínas de Santo Amaro: concreto, ferrugem, mato escuro, óleo e fios. */
const S = {
  concrete: hex('#7b7e83'),
  concreteDark: hex('#5c5f64'),
  concreteLight: hex('#94979c'),
  seam: hex('#4c4f54'),
  crack: hex('#2f3135'),
  dirt: [40, 42, 46, 70] as RGBA,
  gloom: hex('#3e6a38'),
  gloomDark: hex('#30552d'),
  gloomLight: hex('#4c7b43'),
  dry: hex('#7a7a40'),
  moss: hex('#4f7a3a'),
  mossDark: hex('#3a5e2c'),
  oil: hex('#1c242b'),
  oilEdge: hex('#2d3840'),
  sheen1: hex('#6a4f8a'),
  sheen2: hex('#3f7a80'),
  iron: hex('#4f5257'),
  ironDark: hex('#36383c'),
  ironLight: hex('#6d7076'),
  rust: hex('#9a4a2b'),
  rustLight: hex('#c26a3c'),
  rustDark: hex('#6a3119'),
  facade: hex('#8a8580'),
  facadeDark: hex('#6a6560'),
  facadeLight: hex('#a39e98'),
  window: hex('#161b20'),
  glass: hex('#4a6670'),
  glassLight: hex('#86a8b0'),
  shutter: hex('#80858b'),
  shutterDark: hex('#5c6066'),
  shutterLight: hex('#9a9fa5'),
  sign: [hex('#c9a43a'), hex('#3f78a8'), hex('#b5473a'), hex('#4f9a5a')],
  vine: hex('#2e6a2b'),
  vineLight: hex('#4f9440'),
  vineDark: hex('#1f4d1f'),
  deadWood: hex('#5b4836'),
  deadWoodDark: hex('#3d3025'),
  deadWoodLight: hex('#76604a'),
  wire: hex('#16161a'),
  wireRed: hex('#8e2b24'),
  wireYellow: hex('#b39b2e'),
  insulator: hex('#d9d6cc'),
  herb: hex('#5d9c48'),
  herbDark: hex('#447a36'),
  herbLight: hex('#8ccf66'),
  herbFlower: hex('#e3d968'),
  tire: hex('#222226'),
  tireLight: hex('#3b3b41'),
  busPaint: hex('#c9b27a'),
  busPaintDark: hex('#9c8656'),
  busStripe: hex('#3f6f9a'),
  outline: hex('#1f2124'),
};

const clamp15 = (v: number) => Math.max(0, Math.min(15, v));

/**
 * Chão de concreto velho. Cada tile é uma placa (a emenda fica só na borda). Para não virar "papel de
 * parede" quando o mesmo tile se repete, o desenho é discreto; rachadura só na variação rachada.
 */
function drawConcrete(p: Pixels, rng: Rng, moss: boolean, cracked = false): void {
  p.fill(S.concrete);
  p.speckle(rng, [S.concreteDark, S.concreteLight], 30);
  for (let i = 0; i < T; i++) {
    p.set(i, 0, S.concreteDark);
    p.set(0, i, S.concreteDark);
  }
  if (cracked) {
    let x = 3 + randInt(rng, 10);
    for (let y = 2 + randInt(rng, 4); y < T; y++) {
      p.set(x, y, S.crack);
      if (rng() < 0.35) p.set(x + 1, y, rng() < 0.5 ? S.moss : S.gloomLight);
      x = clamp15(x + randInt(rng, 3) - 1);
    }
    p.ellipse(4 + rng() * 8, 4 + rng() * 8, 2.4, 1.5, S.dirt);
  }
  if (moss) {
    p.disc(1 + randInt(rng, 3), 12 + randInt(rng, 3), 1.6, S.mossDark); // musgo encostado na emenda
    p.speckle(rng, [S.moss, S.mossDark, S.gloomLight], 16);
  }
}

const BRICK = hex('#a85a3a');

/** Entulho: pedaços de laje (com a quebra mais clara), tijolos, pó e vergalhões tortos saindo do monte. */
function drawRubble(p: Pixels, rng: Rng): void {
  p.ellipse(8, 13.5, 7.5, 2.4, C.shadow);
  p.ellipse(8, 12.5, 6.5, 2.2, [120, 116, 108, 150]); // pó em volta
  for (const [x, y, w, h] of [
    [1, 9, 6, 4],
    [7, 7, 6, 6],
    [4, 4, 5, 4],
    [10, 10, 5, 3],
    [3, 12, 5, 2],
  ] as const) {
    p.rect(x, y, w, h, S.concrete);
    p.rect(x, y, w, 1, S.concreteLight);
    p.rect(x, y, 1, h, S.concreteLight);
    p.rect(x, y + h - 1, w, 1, S.concreteDark);
    p.rect(x + w - 1, y, 1, h, S.concreteDark);
    if (rng() < 0.6) p.set(x + 1 + randInt(rng, Math.max(1, w - 2)), y + 1, S.crack);
  }
  for (const [x, y] of [
    [9, 4],
    [12, 6],
    [2, 7],
  ] as const) {
    p.rect(x, y, 3, 2, BRICK); // tijolos
    p.set(x + 1, y, S.rustLight);
  }
  for (let y = 1; y < 7; y++) p.set(6 + Math.floor((y - 1) / 2), y, S.rust); // vergalhões
  for (let y = 3; y < 8; y++) p.set(13 - (y > 5 ? 1 : 0), y, S.rustDark);
  p.outline(S.outline);
}

/** Mato escuro e meio seco, onde a cidade sumiu. */
function drawGloom(p: Pixels, rng: Rng): void {
  p.fill(S.gloom);
  p.speckle(rng, [S.gloomDark, S.gloomDark, S.gloomLight], 42);
  p.speckle(rng, [S.dry], 10);
  for (let k = 0; k < 4; k++) {
    const x = randInt(rng, T);
    const y = 2 + randInt(rng, 12);
    p.set(x, y, S.gloomLight);
    p.set(x, y - 1, S.gloomLight);
  }
}

/** Fachada de prédio velho (o lado de baixo de um quarteirão): concreto manchado, laje e musgo no pé. */
function drawFacade(p: Pixels, rng: Rng): void {
  p.fill(S.facade);
  p.speckle(rng, [S.facadeDark, S.facadeLight], 26);
  p.rect(0, 0, T, 2, S.concreteDark); // beirada da laje
  p.rect(0, 2, T, 1, S.facadeLight);
  p.rect(0, 9, T, 1, S.facadeDark); // laje do andar de baixo
  for (let k = 0; k < 4; k++) {
    const sx = randInt(rng, T); // manchas escorrendo
    for (let y = 3; y < 3 + 3 + randInt(rng, 6); y++) p.set(sx, y, S.facadeDark);
  }
  for (let x = 0; x < T; x++) if (rng() < 0.55) p.set(x, 15, rng() < 0.5 ? S.moss : S.mossDark);
}

/** Topo de prédio visto de cima: laje escura e gasta (com um buraco que deixa ver o andar de baixo, se pedir). */
function drawRoofSlab(p: Pixels, rng: Rng, hole: boolean): void {
  p.fill(S.concreteDark);
  p.speckle(rng, [S.seam, S.concrete], 34);
  for (let i = 0; i < T; i++) {
    p.set(i, 0, S.seam);
    p.set(0, i, S.seam);
  }
  if (!hole) {
    let x = 4 + randInt(rng, 8);
    for (let y = 3; y < 3 + 5 + randInt(rng, 5); y++) {
      p.set(x, y, S.crack);
      x = clamp15(x + randInt(rng, 3) - 1);
    }
    p.disc(3 + randInt(rng, 10), 3 + randInt(rng, 10), 1.3, S.mossDark);
    return;
  }
  // buraco irregular: vários pedaços que caíram, com a beirada quebrada mais clara e ferros atravessando
  for (const [cx, cy, rx, ry] of [[7, 7, 3.4, 2.6], [10, 9, 2.8, 2.4], [6.5, 10, 2.2, 1.8]] as const) p.ellipse(cx, cy, rx, ry, [12, 14, 16, 255]);
  for (let y = 1; y < T - 1; y++) {
    for (let x = 1; x < T - 1; x++) {
      const dark = p.get(x, y)[0] < 20;
      if (!dark && (p.get(x - 1, y)[0] < 20 || p.get(x + 1, y)[0] < 20 || p.get(x, y - 1)[0] < 20 || p.get(x, y + 1)[0] < 20)) p.set(x, y, S.concreteLight);
    }
  }
  for (const [x, y] of [[3, 6], [3, 7], [13, 10], [12, 11], [8, 4]] as const) p.set(x, y, S.rust); // pontas de vergalhão na beirada
}

function sliceOf(width: number, drawFull: (p: Pixels) => void, index: number) {
  return (p: Pixels) => {
    const full = new Pixels(T * width, T);
    drawFull(full);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) p.set(x, y, full.get(x + index * T, y));
  };
}

/** Ônibus velho visto de cima (3 tiles): teto desbotado, ferrugem, janelas quebradas e mato no teto. */
function drawBus(p: Pixels): void {
  const rng = mulberry32(4242);
  p.ellipse(24, 14, 23, 2.4, C.shadow);
  p.rect(1, 2, 46, 11, S.busPaintDark);
  p.rect(2, 3, 44, 9, S.busPaint);
  for (let x = 3; x < 45; x += 4) p.rect(x, 2, 3, 1, S.window); // janelas de um lado
  for (let x = 3; x < 45; x += 4) p.rect(x, 12, 3, 1, S.window); // e do outro
  p.rect(2, 7, 44, 1, S.busStripe);
  p.rect(18, 5, 8, 4, S.ironLight); // ar-condicionado velho
  p.rect(19, 6, 6, 2, S.iron);
  for (let k = 0; k < 40; k++) p.set(2 + randInt(rng, 44), 3 + randInt(rng, 9), k % 3 ? S.rust : S.rustDark);
  p.disc(36, 5.5, 2.2, S.moss);
  p.disc(8, 9.5, 1.8, S.mossDark);
  p.rect(1, 5, 1, 5, S.glass); // para-brisa
  p.set(1, 6, S.glassLight);
  p.outline(S.outline);
}

/** Deck da vila flutuante: tábuas deitadas, com pregos. */
function drawDeck(p: Pixels, rng: Rng): void {
  p.fill(G.deck);
  for (let y = 3; y < T; y += 4) for (let x = 0; x < T; x++) p.set(x, y, G.deckDark);
  for (let row = 0; row < 4; row++) {
    const joint = (row % 2) * 7 + 4;
    for (let y = row * 4; y < row * 4 + 3; y++) p.set(joint, y, G.deckDark);
    p.set(joint - 1, row * 4 + 1, G.nail);
    p.set(joint + 1, row * 4 + 1, G.nail);
    for (let x = 0; x < T; x++) if (rng() < 0.2) p.set(x, row * 4, G.deckLight);
  }
  p.speckle(rng, [G.deckLight, G.deckDark], 8);
}

/** Píer de norte a sul: tábuas atravessadas, com corrimão de um lado (ou nenhum). */
function pier(rail: 'left' | 'right' | 'none') {
  return (p: Pixels, rng: Rng) => {
    p.fill(C.wood);
    for (let y = 3; y < T; y += 4) for (let x = 0; x < T; x++) p.set(x, y, C.woodDark);
    p.speckle(rng, [C.woodLight, C.woodDark], 12);
    if (rail === 'none') return;
    const x0 = rail === 'left' ? 0 : 14;
    for (let y = 0; y < T; y++) {
      p.set(x0, y, C.woodDarker);
      p.set(x0 + 1, y, C.woodDark);
    }
    p.rect(rail === 'left' ? 0 : 13, 6, 3, 3, C.woodDarker); // poste do corrimão
  };
}

/** Objetos de 2 tiles (barco, carro): desenha inteiro em 32x16 e pega a metade. */
function halfOf(drawFull: (p: Pixels) => void, side: 0 | 1) {
  return (p: Pixels) => {
    const full = new Pixels(T * 2, T);
    drawFull(full);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) p.set(x, y, full.get(x + side * T, y));
  };
}

function drawBoat(p: Pixels): void {
  p.ellipse(16, 10, 14.5, 5, [10, 30, 60, 90]); // sombra na água
  p.ellipse(16, 8.5, 14, 5.6, G.hullDark);
  p.ellipse(16, 8.2, 12.8, 4.6, G.hull);
  p.ellipse(16, 8.2, 11, 3.4, G.boatInside);
  p.rect(10, 5, 2, 7, G.hullLight); // bancos
  p.rect(20, 5, 2, 7, G.hullLight);
  for (let x = 4; x < 28; x++) if (p.alpha(x, 3) === 255) p.set(x, 3, G.paintBlue);
  p.rect(27, 7, 2, 2, G.paintRed); // remendo de tinta
  p.outline(G.postDark);
}

function drawCar(p: Pixels): void {
  p.ellipse(16, 13.5, 14, 2.5, C.shadow);
  p.rect(2, 3, 28, 10, G.carRust);
  p.rect(1, 4, 30, 8, G.carRust);
  p.rect(3, 4, 26, 1, G.carRustDark);
  p.rect(9, 5, 14, 6, G.carPaint); // teto com tinta velha
  p.rect(7, 5, 2, 6, G.carGlass); // para-brisas
  p.rect(23, 5, 2, 6, G.carGlass);
  p.set(7, 6, G.carGlassLight);
  p.set(24, 8, G.carGlassLight);
  for (const [x, y] of [
    [4, 2],
    [25, 2],
    [4, 12],
    [25, 12],
  ] as const) {
    p.rect(x, y, 3, 2, G.tire);
  }
  for (let k = 0; k < 18; k++) p.set(2 + ((k * 7) % 28), 4 + ((k * 5) % 8), k % 2 ? G.carRustDark : G.rust);
  for (const x of [12, 13, 19]) p.set(x, 4, G.moss); // mato crescendo em cima
  p.outline(G.asphaltDark);
}

/** Muro de concreto quebrado, com musgo e ferros enferrujados (e pichação, se pedir). */
function drawRuinWall(p: Pixels, rng: Rng, graffiti: boolean): void {
  for (let x = 0; x < T; x++) {
    const top = 2 + randInt(rng, 4); // borda de cima quebrada
    p.rect(x, top, 1, T - top, G.concrete);
    p.set(x, top, G.concreteLight);
  }
  for (const y of [7, 12]) for (let x = 0; x < T; x++) if (p.alpha(x, y) === 255) p.set(x, y, G.concreteDark);
  p.speckle(rng, [G.concreteDark, G.concreteLight], 14, true);
  for (let k = 0; k < 6; k++) p.set(randInt(rng, 16), 3 + randInt(rng, 3), rng() < 0.5 ? G.moss : G.mossDark);
  p.rect(4, 0, 1, 3, G.rust); // vergalhões
  p.rect(11, 1, 1, 3, G.rust);
  if (graffiti) {
    const colors = G.graffiti;
    for (let x = 1; x < 15; x++) {
      const y = 9 + Math.round(Math.sin(x * 0.9) * 1.5);
      p.set(x, y, colors[Math.floor(x / 4) % colors.length]!);
      p.set(x, y + 1, colors[(Math.floor(x / 4) + 1) % colors.length]!);
    }
  }
  p.outline(G.asphaltDark);
}

/** Telhado de lata ondulada, remendado com pedaços de outras cores. */
function drawTinRoof(p: Pixels, rng: Rng): void {
  for (let x = 0; x < T; x++) for (let y = 0; y < T; y++) p.set(x, y, x % 3 === 0 ? G.tin2 : G.tin1);
  const patchX = randInt(rng, 9);
  const patchY = randInt(rng, 8);
  const patch = rng() < 0.5 ? G.tinBlue : G.tinRed;
  for (let x = patchX; x < patchX + 6; x++) for (let y = patchY; y < patchY + 5; y++) p.set(x, y, x % 3 === 0 ? G.rust : patch);
  for (let x = 0; x < T; x++) {
    p.set(x, 7, G.tin2);
    if (rng() < 0.35) p.set(x, 8 + randInt(rng, 7), G.tinRust); // ferrugem escorrendo
  }
  for (const [x, y] of [
    [1, 1],
    [14, 1],
    [1, 14],
    [14, 14],
  ] as const) {
    p.set(x, y, G.postDark); // rebites
  }
}

/** Parede de tábuas (casas da vila flutuante). */
function drawWoodWall(p: Pixels, rng: Rng): void {
  p.fill(G.plank);
  for (let x = 3; x < T; x += 4) for (let y = 0; y < T; y++) p.set(x, y, G.plankDark);
  p.speckle(rng, [G.plankLight, G.plankDark], 12);
  for (let x = 0; x < T; x++) {
    p.set(x, 0, G.postDark); // sombra do telhado
    p.set(x, 1, G.plankDark);
    p.set(x, 15, G.postDark);
  }
}

/** Ipê florido (amarelo ou rosa): o colorido da floresta. */
function drawIpe(p: Pixels, rng: Rng, flower: RGBA, light: RGBA, dark: RGBA): void {
  p.ellipse(8, 14, 6, 2, C.shadow);
  p.rect(7, 10, 2, 5, C.trunk);
  p.rect(8, 10, 1, 5, C.trunkDark);
  p.disc(8, 6.5, 5.8, flower);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (p.alpha(x, y) === 255 && y < 12 && x - 8 + (y - 6.5) * 1.2 > 3) p.set(x, y, dark);
    }
  }
  p.disc(6, 4.5, 2.2, light, true);
  p.speckle(rng, [light, dark, C.leaf], 12, true);
  p.outline(C.outline);
}

// ---------- Capricho no mapa, passo 1: animações, objetos altos, mata fechada e sombras ----------
// Árvores grandes e postes altos são desenhados inteiros e cortados em tiles: a copa (ou o alto do poste)
// vai na camada "acima" do Tiled, que passa por cima dos personagens — quem anda atrás da árvore some
// embaixo das folhas — e o tronco vai na camada "decor" (bloqueia a passagem).

/** Cores extras dos objetos altos. */
const D = {
  leafDeep: hex('#1b5a26'),
  pineDeep: hex('#173f2a'),
  trunkLight: hex('#8a6038'),
  bark: hex('#4a3019'),
  thicket: hex('#1f4f27'),
  thicketDark: hex('#173d1e'),
};

/** Animação "vai e volta" de 3 desenhos (0-1-2-1), usada na água: `key`, `key_f1` e `key_f2`. */
function swayFrames(key: string, ms = 320): { key: string; ms: number }[] {
  return [
    { key, ms },
    { key: `${key}_f1`, ms },
    { key: `${key}_f2`, ms },
    { key: `${key}_f1`, ms },
  ];
}

/** Água logo abaixo de um deck: estacas e sombra (as estacas ficam paradas; a água balança). */
function waterPosts(frame: number) {
  return (p: Pixels) => {
    water(0, frame)(p);
    p.rect(0, 0, 16, 3, [12, 28, 55, 120]);
    for (const x of [2, 12]) {
      p.rect(x, 0, 2, 9, G.post);
      p.rect(x + 1, 0, 1, 9, G.postDark);
      p.rect(x - 1 + (frame === 2 ? 1 : 0), 9, frame === 1 ? 4 : 3, 1, C.waterLight); // marola batendo na estaca
    }
  };
}

/** Parte funda da represa: mais escura, com ondas que balançam devagar. */
function deepWater(frame: number) {
  return (p: Pixels) => {
    const rng = mulberry32(377);
    p.fill(G.deep);
    p.speckle(rng, [G.deepDark], 22);
    for (const [x, y, dir] of [
      [3, 5, 1],
      [10, 11, -1],
    ] as const) {
      const sx = x + dir * frame;
      p.set(sx, y, G.deepLight);
      p.set(sx + 1, y - 1, G.deepLight);
      p.set(sx + 2, y, G.deepLight);
    }
  };
}

/** Fogueira da vila. `frame` 0, 1 ou 2: as chamas mudam de forma (crepitando) e as faíscas sobem. */
function campfire(frame: number) {
  return (p: Pixels) => {
    p.ellipse(8, 11, 7, 3, C.shadow);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.disc(8 + Math.cos(a) * 5.2, 10 + Math.sin(a) * 2.8, 1.4, i % 2 ? G.stone : G.stoneDark);
    }
    p.rect(4, 10, 8, 1, G.log);
    p.rect(6, 9, 4, 3, G.ember);
    const flame = [
      { dx: 0, h: 4.5, w: 3 },
      { dx: -0.6, h: 5.3, w: 2.6 },
      { dx: 0.6, h: 3.9, w: 3.3 },
    ][frame]!;
    const cx = 8 + flame.dx;
    p.ellipse(cx, 11.5 - flame.h, flame.w, flame.h, G.fire3);
    p.ellipse(cx, 11.8 - flame.h * 0.8, flame.w * 0.73, flame.h * 0.76, G.fire2);
    p.ellipse(cx, 12.2 - flame.h * 0.6, flame.w * 0.43, flame.h * 0.49, G.fire1);
    const sparks = [
      [
        [6, 3],
        [10, 4],
      ],
      [
        [5, 2],
        [9, 1],
      ],
      [
        [11, 3],
        [7, 2],
      ],
    ][frame]!;
    sparks.forEach(([x, y], i) => p.set(x!, y!, i ? G.fire3 : G.fire2));
  };
}

/** Tufo de folhas (ou de flores): claro em cima à esquerda (o sol vem de lá), escuro embaixo à direita. */
function clump(p: Pixels, cx: number, cy: number, r: number, base: RGBA, light: RGBA, dark: RGBA): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = (x + 0.5 - cx) / r;
      const dy = (y + 0.5 - cy) / r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const side = dx * 0.8 + dy;
      p.set(x, y, side < -0.62 ? light : side > 0.5 || (d2 > 0.7 && dy > 0.3) ? dark : base);
    }
  }
}

/** Linha grossa (galho), de (x0, y0) até (x1, y1). */
function limb(p: Pixels, x0: number, y0: number, x1: number, y1: number, width: number, color: RGBA): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    for (let w = 0; w < width; w++) p.set(x + w, y, color);
  }
}

/** Galho seco que se divide em dois, e de novo, até virar graveto. */
function twig(p: Pixels, rng: Rng, x: number, y: number, angle: number, length: number, width: number, depth: number): void {
  let cx = x;
  let cy = y;
  for (let i = 0; i < length; i++) {
    cx += Math.cos(angle);
    cy += Math.sin(angle);
    for (let w = 0; w < width; w++) p.set(cx + w, cy, w === 0 && width > 1 ? S.deadWoodLight : S.deadWood);
    angle += (rng() - 0.5) * 0.3;
  }
  if (depth <= 0) {
    if (rng() < 0.6) p.set(cx, cy - 1, S.dry); // folha seca que ficou
    return;
  }
  const spread = 0.45 + rng() * 0.3;
  twig(p, rng, cx, cy, angle - spread, length * 0.62, Math.max(1, width - 1), depth - 1);
  twig(p, rng, cx, cy, angle + spread, length * 0.62, Math.max(1, width - 1), depth - 1);
}

/** Tronco de árvore grande (vai até a linha 45): mais largo no pé, claro à esquerda, com veios. */
function bigTrunk(p: Pixels, top: number, left: number, right: number, base: RGBA, light: RGBA, dark: RGBA, vein: RGBA): void {
  for (let y = top; y <= 45; y++) {
    const flare = Math.max(0, y - 42);
    const x0 = left - flare;
    const x1 = right + flare;
    for (let x = x0; x <= x1; x++) p.set(x, y, x <= x0 + (flare ? 0 : 1) ? light : x >= x1 - 1 ? dark : base);
  }
  for (const [x, y0, len] of [
    [left + 2, top + 4, 5],
    [right - 2, top + 9, 4],
    [left + 2, top + 14, 3],
  ] as const) {
    for (let y = y0; y < Math.min(44, y0 + len); y++) p.set(x, y, vein);
  }
}

/** Escurece as folhas de baixo da copa (a sombra das próprias folhas em cima do tronco). */
function shadeUnderside(p: Pixels, fromY: number, leaves: RGBA[], to: RGBA): void {
  const same = (a: RGBA, b: RGBA) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  for (let y = fromY; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) if (leaves.some((c) => same(p.get(x, y), c))) p.set(x, y, to);
  }
}

/** Uns pontinhos de textura em cima das folhas (só onde já tem folha). */
function leafTexture(p: Pixels, rng: Rng, leaves: RGBA[], dots: RGBA[], count: number, maxY: number): void {
  const same = (a: RGBA, b: RGBA) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  for (let k = 0; k < count; k++) {
    const x = randInt(rng, p.width);
    const y = randInt(rng, maxY);
    if (leaves.some((c) => same(p.get(x, y), c))) p.set(x, y, dots[randInt(rng, dots.length)]!);
  }
}

function drawBigRoundTree(): Pixels {
  const p = new Pixels(32, 48);
  const rng = mulberry32(5150);
  p.ellipse(17, 44.5, 12.5, 3.2, C.shadow);
  bigTrunk(p, 24, 13, 18, C.trunk, D.trunkLight, C.trunkDark, D.bark);
  for (const [x, y, r] of [
    [11, 9, 7],
    [21, 8, 7.5],
    [6, 17, 6.5],
    [26, 17, 6],
    [16, 15, 9],
    [9, 25, 7],
    [23, 25, 7],
    [16, 28, 6.5],
  ] as const) {
    clump(p, x, y, r, C.leaf, C.leafLight, C.leafDark);
  }
  leafTexture(p, rng, [C.leaf], [C.leafLight, C.leafDark], 70, 34);
  shadeUnderside(p, 32, [C.leaf, C.leafDark, C.leafLight], D.leafDeep);
  p.outline(C.outline);
  return p;
}

function drawBigPine(): Pixels {
  const p = new Pixels(32, 48);
  p.ellipse(16.5, 44.5, 10.5, 3, C.shadow);
  bigTrunk(p, 30, 14, 17, C.trunk, D.trunkLight, C.trunkDark, D.bark);
  // camadas de galhos: as de cima ficam por cima das de baixo (desenha de baixo para cima)
  const tiers = [
    [21, 36, 15],
    [15, 29, 13],
    [10, 22, 10.5],
    [5, 16, 7.5],
    [1, 10, 4.5],
  ] as const;
  for (const [top, bottom, half] of tiers) {
    for (let y = top; y <= bottom; y++) {
      const w = 0.8 + (half - 0.8) * ((y - top) / (bottom - top));
      for (let x = Math.floor(16 - w); x < Math.ceil(16 + w); x++) {
        if (y === bottom && (x & 1) === 1) continue; // pontas dos galhos: a base fica serrilhada
        const rel = (x + 0.5 - 16) / w;
        p.set(x, y, y >= bottom - 1 ? D.pineDeep : rel < -0.4 ? C.pineLight : rel > 0.3 ? C.pineDark : C.pine);
      }
    }
  }
  p.outline(C.outline);
  return p;
}

function drawBigIpe(flower: RGBA, light: RGBA, dark: RGBA, seed: number): Pixels {
  const p = new Pixels(32, 48);
  const rng = mulberry32(seed);
  p.ellipse(17, 44.5, 12, 3.1, C.shadow);
  for (let k = 0; k < 18; k++) {
    // flores caídas no chão, em volta do pé
    const a = rng() * Math.PI * 2;
    const r = 6 + rng() * 7;
    p.set(16 + Math.cos(a) * r * 1.3, 44.3 + Math.sin(a) * r * 0.3, k % 3 ? flower : light);
  }
  bigTrunk(p, 26, 14, 17, C.trunk, D.trunkLight, C.trunkDark, D.bark);
  // galhos abrindo em forquilha (aparecem nos buracos da copa)
  limb(p, 14, 28, 7, 13, 2, C.trunkDark);
  limb(p, 17, 28, 25, 12, 2, C.trunkDark);
  limb(p, 15, 26, 16, 7, 2, C.trunk);
  for (const [x, y, r] of [
    [9, 10, 5.5],
    [17, 6, 6],
    [25, 10, 5.5],
    [5, 18, 4.8],
    [14, 15, 6],
    [24, 18, 5.8],
    [9, 24, 5.3],
    [19, 25, 5.8],
    [14, 30, 4.2],
  ] as const) {
    clump(p, x, y, r, flower, light, dark);
  }
  leafTexture(p, rng, [flower, dark], [light, C.leaf, C.leafDark], 46, 34);
  p.outline(C.outline);
  return p;
}

function drawBigDeadTree(): Pixels {
  const p = new Pixels(32, 48);
  const rng = mulberry32(6060);
  p.ellipse(16.5, 44.5, 9, 2.6, C.shadow);
  bigTrunk(p, 22, 14, 17, S.deadWood, S.deadWoodLight, S.deadWoodDark, S.deadWoodDark);
  twig(p, rng, 15, 25, -Math.PI * 0.64, 10, 2, 3);
  twig(p, rng, 17, 24, -Math.PI * 0.36, 11, 2, 3);
  twig(p, rng, 15.5, 22, -Math.PI * 0.5, 9, 2, 3);
  p.ellipse(15.5, 36, 1.5, 2.2, S.deadWoodDark); // oco no tronco
  p.set(15, 36, S.wire);
  p.outline(S.outline);
  return p;
}

/** Poste antigo da avenida (alto: a luminária quebrada fica lá em cima), torto e com cipó subindo. */
function drawTallLampPost(): Pixels {
  const p = new Pixels(16, 32);
  p.ellipse(8, 30.5, 3.5, 1.3, C.shadow);
  p.rect(6, 27, 4, 4, G.poleDark); // base de concreto
  p.rect(6, 27, 3, 1, G.pole);
  for (let y = 5; y < 27; y++) {
    const x = y < 12 ? 8 : 7; // torto lá em cima
    p.set(x, y, G.pole);
    p.set(x + 1, y, G.poleDark);
  }
  limb(p, 9, 5, 12, 3, 1, G.pole); // braço da luminária
  p.rect(11, 3, 4, 2, G.poleDark);
  p.rect(12, 5, 2, 1, G.carGlassLight); // vidro quebrado
  for (let y = 8; y < 27; y += 3) {
    p.set(y % 2 ? 6 : 9, y, G.moss); // cipó subindo em zigue-zague
    p.set(y % 2 ? 6 : 9, y + 1, G.mossDark);
  }
  p.set(5, 12, C.leaf);
  p.set(10, 18, C.leafLight);
  p.outline(G.asphaltDark);
  return p;
}

/** Poste de madeira com fios (alto: a travessa, os isoladores e o transformador ficam lá em cima). */
function drawTallWirePole(): Pixels {
  const p = new Pixels(16, 32);
  p.ellipse(8, 30.5, 3, 1.2, C.shadow);
  p.rect(7, 2, 2, 29, S.deadWood);
  p.rect(8, 2, 1, 29, S.deadWoodDark);
  p.rect(2, 4, 12, 1, S.deadWoodDark); // travessas
  p.rect(4, 8, 8, 1, S.deadWoodDark);
  for (const x of [2, 13]) p.set(x, 3, S.insulator);
  for (const x of [4, 11]) p.set(x, 7, S.insulator);
  p.rect(9, 10, 3, 5, S.ironLight); // transformador velho
  p.rect(10, 10, 2, 5, S.iron);
  p.rect(9, 15, 3, 1, S.rustDark);
  for (let k = 0; k < 3; k++) {
    p.set(1 - k, 4 + k, S.wire); // fios caindo para os lados
    p.set(14 + k, 4 + k, S.wire);
  }
  for (let y = 9; y < 22; y++) p.set(12 + (y > 15 ? 1 : 0), y, S.wireRed); // fio solto pendurado
  p.set(6, 22, S.moss);
  p.set(9, 26, S.mossDark);
  p.outline(S.outline);
  return p;
}

/** Mata fechada: moitas de samambaia e arbusto bem juntas (bloqueia). Fica embaixo das copas, na borda das matas. */
function drawThicket(p: Pixels, rng: Rng): void {
  p.ellipse(8, 13.5, 7.5, 2.4, C.shadow);
  for (const [x, y, r] of [
    [4.5, 6, 4.2],
    [11.5, 5, 4.2],
    [8, 9.5, 4.8],
    [3.5, 11.5, 3.6],
    [12.5, 11.5, 3.6],
  ] as const) {
    clump(p, x + rng() - 0.5, y + rng() - 0.5, r, D.thicket, C.leafDark, D.thicketDark);
  }
  leafTexture(p, rng, [D.thicket], [C.leaf, C.leafDark], 14, T);
  p.outline(C.outline);
}

/** Sombra no chão ao lado de paredes e prédios: ao sul (s), a leste (e) ou no canto (se). */
function drawShade(kind: 's' | 'e' | 'se') {
  return (p: Pixels) => {
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const fy = Math.max(0, 1 - y / 11);
        const fx = Math.max(0, 1 - x / 8);
        const v = kind === 's' ? fy : kind === 'e' ? fx : Math.min(fx, fy);
        const alpha = Math.round(92 * v ** 1.3);
        if (alpha > 2) p.set(x, y, [8, 12, 24, alpha]);
      }
    }
  };
}

/** Guarda o desenho grande (feito uma vez só) para cortar em tiles. */
function once(draw: () => Pixels): () => Pixels {
  let art: Pixels | null = null;
  return () => (art ??= draw());
}

/** Um pedaço de 16x16 de um desenho grande. */
function pieceOf(art: () => Pixels, col: number, row: number) {
  return (p: Pixels) => {
    const full = art();
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const c = full.get(col * T + x, row * T + y);
        if (c[3] > 0) p.set(x, y, c);
      }
    }
  };
}

/** Os 6 tiles de uma árvore grande: copa (tl, tr, ml, mr, na camada "acima") e tronco (bl, br, que bloqueia). */
function bigTreeTiles(prefix: string, art: () => Pixels): TileDef[] {
  const parts = [
    ['tl', 0, 0],
    ['tr', 1, 0],
    ['ml', 0, 1],
    ['mr', 1, 1],
    ['bl', 0, 2],
    ['br', 1, 2],
  ] as const;
  return parts.map(([name, col, row]) => ({ key: `${prefix}_${name}`, collides: row === 2, draw: pieceOf(art, col, row) }));
}

/** Os 2 tiles de um poste alto: o alto (camada "acima") e o pé (bloqueia; o tiro passa). */
function tallTiles(prefix: string, art: () => Pixels): TileDef[] {
  return [
    { key: `${prefix}_top`, draw: pieceOf(art, 0, 0) },
    { key: `${prefix}_base`, collides: true, shootOver: true, draw: pieceOf(art, 0, 1) },
  ];
}

// ---------- Capricho no mapa, passo 2: beiradas suaves entre terrenos ----------
// Onde dois terrenos se encontram (areia e água, grama e terra...), o tile do terreno de baixo ganha uma
// beirada irregular do vizinho entrando, em vez de um degrau quadrado. Cada tipo de beirada tem 15 tiles
// (quais lados encostam no outro terreno: bits 1 = norte, 2 = leste, 4 = sul, 8 = oeste; ex.: `shore_3` =
// água ao norte e a leste) e 4 de canto (o outro terreno só na diagonal: `shore_c_ne`...). Quem escolhe o tile
// certo é o gerador do mapa, olhando os vizinhos (scripts/map-depth.ts).

/** Os cantos, na ordem dos tiles: nordeste, sudeste, sudoeste, noroeste. */
export const EDGE_CORNERS = ['ne', 'se', 'sw', 'nw'] as const;

interface EdgeStyle {
  /** O terreno do próprio tile (o de baixo: areia, terra, lama). */
  base: (p: Pixels, rng: Rng) => void;
  /** O terreno vizinho que entra pela beirada (água, grama). */
  over: (p: Pixels, rng: Rng) => void;
  /** Quantos pixels o vizinho entra. */
  band: number;
  /** Ondulação da beirada ao longo do lado (repete a cada 16 pixels, para emendar com o tile do lado). */
  wobble: (t: number) => number;
  /** Linha na beirada, do lado do vizinho (espuma, contorno da grama). */
  rim: RGBA;
  /** Linha do lado de dentro (areia molhada, sombra da grama). */
  shade: RGBA;
}

/** Mínimo "arredondado": deixa os cantos das beiradas redondos em vez de quinas. */
function smoothMin(values: number[], k: number): number {
  if (values.length === 0) return Infinity;
  return values.reduce((a, b) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - (h * h * k) / 4;
  });
}

const wavy = (amplitudes: [number, number, number][]) => (t: number) =>
  amplitudes.reduce((sum, [amp, cycles, phase]) => sum + amp * Math.sin((t / T) * Math.PI * 2 * cycles + phase), 0);

function edgeTile(style: EdgeStyle, mask: number, corner: number) {
  return (p: Pixels) => {
    const base = new Pixels(T, T);
    style.base(base, mulberry32(4100 + mask * 13 + corner * 7));
    const over = new Pixels(T, T);
    style.over(over, mulberry32(4300 + mask * 17 + corner * 5));
    const cornerAt = [
      [T, 0],
      [T, T],
      [0, T],
      [0, 0],
    ];
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        const reach: number[] = [];
        if (mask & 1) reach.push(cy - style.wobble(cx));
        if (mask & 2) reach.push(T - cx - style.wobble(cy));
        if (mask & 4) reach.push(T - cy - style.wobble(cx));
        if (mask & 8) reach.push(cx - style.wobble(cy));
        if (corner >= 0) reach.push(Math.hypot(cx - cornerAt[corner]![0]!, cy - cornerAt[corner]![1]!) - style.wobble(0));
        const d = smoothMin(reach, 3.5) - style.band;
        p.set(x, y, d < -1 ? over.get(x, y) : d < 0 ? style.rim : d < 1.5 ? style.shade : base.get(x, y));
      }
    }
  };
}

/** Os 19 tiles de um tipo de beirada: `${name}_1` a `${name}_15` e `${name}_c_ne`, `_c_se`, `_c_sw`, `_c_nw`. */
function edgeTiles(name: string, style: EdgeStyle): TileDef[] {
  const tiles: TileDef[] = [];
  for (let mask = 1; mask <= 15; mask++) tiles.push({ key: `${name}_${mask}`, draw: edgeTile(style, mask, -1) });
  EDGE_CORNERS.forEach((corner, i) => tiles.push({ key: `${name}_c_${corner}`, draw: edgeTile(style, 0, i) }));
  return tiles;
}

/** Água parada, sem ondinha (a beirada fica quieta; a água de verdade, no tile do lado, balança). */
function stillWater(p: Pixels, rng: Rng): void {
  p.fill(C.water);
  p.speckle(rng, [C.waterDark], 10);
}

const SHORE_WOBBLE = wavy([
  [0.9, 2, 0],
  [0.5, 3, 1.3],
]);
const GRASS_WOBBLE = wavy([
  [1.1, 3, 0.4],
  [0.7, 5, 2.1],
]);
const GRASS_RIM = hex('#3d7a2e');

const EDGE_STYLES: Record<string, EdgeStyle> = {
  shore: { base: drawSand, over: stillWater, band: 4.5, wobble: SHORE_WOBBLE, rim: C.foam, shade: hex('#cdb46d') },
  mud_shore: { base: drawMud, over: stillWater, band: 4, wobble: SHORE_WOBBLE, rim: hex('#8fb3b8'), shade: G.mudDark },
  sand_grass: { base: drawSand, over: grass(0), band: 3.5, wobble: GRASS_WOBBLE, rim: GRASS_RIM, shade: C.sandDark },
  dirt_grass: { base: drawDirt, over: grass(0), band: 3.5, wobble: GRASS_WOBBLE, rim: GRASS_RIM, shade: C.dirtDark },
  mud_grass: { base: drawMud, over: grass(0), band: 3.5, wobble: GRASS_WOBBLE, rim: GRASS_RIM, shade: G.mudDark },
  dirt_mud: { base: drawDirt, over: drawMud, band: 3, wobble: SHORE_WOBBLE, rim: G.mudDark, shade: C.dirtDark },
  concrete_gloom: { base: (p, rng) => drawConcrete(p, rng, false), over: drawGloom, band: 3.5, wobble: GRASS_WOBBLE, rim: S.gloomDark, shade: S.concreteDark },
  swamp_shore: { base: swampGrass(0), over: stillSwampWater, band: 4, wobble: SHORE_WOBBLE, rim: hex('#a9cbbf'), shade: hex('#35602c') },
  mud_swamp: { base: drawMud, over: swampGrass(0), band: 3.5, wobble: GRASS_WOBBLE, rim: hex('#2f5a26'), shade: G.mudDark },
  mud_swamp_shore: { base: drawMud, over: stillSwampWater, band: 4, wobble: SHORE_WOBBLE, rim: hex('#a9cbbf'), shade: G.mudDark },
  sand_swamp_shore: { base: drawSand, over: stillSwampWater, band: 4.5, wobble: SHORE_WOBBLE, rim: hex('#cfe6da'), shade: hex('#c9b06a') },
  sand_swamp: { base: drawSand, over: swampGrass(0), band: 3.5, wobble: GRASS_WOBBLE, rim: hex('#2f5a26'), shade: C.sandDark },
};

// ---------- Capricho no mapa, passo 2: a vila (casas coloridas, enfeites) e a parte funda da represa ----------

/** Beirada que só escurece (fica na camada "sombras"): a parte funda da represa entrando na água rasa. */
function fadeEdgeTile(color: RGBA, band: number, maxAlpha: number, mask: number, corner: number) {
  return (p: Pixels) => {
    const cornerAt = [
      [T, 0],
      [T, T],
      [0, T],
      [0, 0],
    ];
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        const reach: number[] = [];
        if (mask & 1) reach.push(cy - SHORE_WOBBLE(cx));
        if (mask & 2) reach.push(T - cx - SHORE_WOBBLE(cy));
        if (mask & 4) reach.push(T - cy - SHORE_WOBBLE(cx));
        if (mask & 8) reach.push(cx - SHORE_WOBBLE(cy));
        if (corner >= 0) reach.push(Math.hypot(cx - cornerAt[corner]![0]!, cy - cornerAt[corner]![1]!) - SHORE_WOBBLE(0));
        const d = smoothMin(reach, 3.5);
        if (d >= band) continue;
        const alpha = Math.round(maxAlpha * Math.max(0, 1 - d / band) ** 1.2);
        if (alpha > 2) p.set(x, y, [color[0], color[1], color[2], alpha]);
      }
    }
  };
}

function fadeEdgeTiles(name: string, color: RGBA, band: number, maxAlpha: number): TileDef[] {
  const tiles: TileDef[] = [];
  for (let mask = 1; mask <= 15; mask++) tiles.push({ key: `${name}_${mask}`, draw: fadeEdgeTile(color, band, maxAlpha, mask, -1) });
  EDGE_CORNERS.forEach((corner, i) => tiles.push({ key: `${name}_c_${corner}`, draw: fadeEdgeTile(color, band, maxAlpha, 0, i) }));
  return tiles;
}

/** Cores das casas da vila (palafitas pintadas). */
export const HOUSE_COLORS = {
  azul: { plank: hex('#4f86b8'), dark: hex('#3a6690'), light: hex('#6fa2cf') },
  verde: { plank: hex('#5a9a5e'), dark: hex('#437a47'), light: hex('#78b67b') },
  terracota: { plank: hex('#c46a45'), dark: hex('#9a4f31'), light: hex('#dc8761') },
  amarelo: { plank: hex('#d9b44a'), dark: hex('#b08e33'), light: hex('#ecca6a') },
} as const;
type HouseColor = (typeof HOUSE_COLORS)[keyof typeof HOUSE_COLORS];

const V = {
  trim: hex('#efe8d6'),
  trimShade: hex('#c9c0a8'),
  glow: hex('#ffd77a'),
  glowDeep: hex('#f0a94a'),
  door: hex('#6b4426'),
  doorDark: hex('#4e2f19'),
  doorLight: hex('#86593a'),
  step: hex('#8d8a84'),
  stepDark: hex('#6a6862'),
  flowerBox: hex('#7a4a26'),
  rope: hex('#d8c9a3'),
  ropeDark: hex('#a8987a'),
  cork: hex('#e8783a'),
  net: hex('#c9bfa6'),
  fish: hex('#c7d3dc'),
  fishDark: hex('#8a9aa6'),
  basket: hex('#b98b4e'),
  basketDark: hex('#8a6332'),
  hoop: hex('#55575c'),
  flame: hex('#ffe08a'),
  flags: [hex('#e2435a'), hex('#f6cf3e'), hex('#3f8fd8'), hex('#5ab55a'), hex('#ef8a2b'), hex('#9b59c9')],
  clothes: [hex('#d9483b'), hex('#3f78c4'), hex('#f2d04a'), hex('#f5f3ee'), hex('#5ab55a')],
};

/** Tábuas na vertical, com frestas escuras e alguns pregos (a cor vem da casa). */
function housePlanks(p: Pixels, rng: Rng, color: HouseColor): void {
  p.fill(color.plank);
  for (let x = 3; x < T; x += 4) for (let y = 0; y < T; y++) p.set(x, y, color.dark);
  for (let x = 0; x < T; x += 4) p.set(x, 0, color.light);
  p.speckle(rng, [color.light, color.dark], 10);
  for (let k = 0; k < 3; k++) p.set(1 + randInt(rng, 4) * 4, 2 + randInt(rng, 12), G.postDark);
}

/** Parede de cima (logo embaixo do telhado): sombra da beirada no alto. */
function houseWall(color: HouseColor) {
  return (p: Pixels, rng: Rng) => {
    housePlanks(p, rng, color);
    p.rect(0, 0, T, 2, G.postDark);
    p.rect(0, 2, T, 1, color.dark);
  };
}

/** Parede de cima com janela acesa, venezianas abertas e uma floreira embaixo. */
function houseWindow(color: HouseColor) {
  return (p: Pixels, rng: Rng) => {
    houseWall(color)(p, rng);
    p.rect(1, 4, 2, 8, color.dark); // venezianas
    p.rect(13, 4, 2, 8, color.dark);
    p.rect(3, 4, 10, 9, V.trim); // moldura
    p.rect(4, 5, 8, 7, V.glow); // luz lá dentro
    p.rect(4, 5, 8, 2, V.glowDeep);
    p.rect(7, 5, 2, 7, V.trimShade); // a cruz da janela
    p.rect(4, 8, 8, 1, V.trimShade);
    p.rect(3, 13, 10, 2, V.flowerBox); // floreira
    for (const [x, c] of [
      [4, C.red],
      [6, C.yellow],
      [8, C.red],
      [10, C.white],
      [11, C.yellow],
    ] as const) {
      p.set(x, 12, c);
      p.set(x, 13, C.stem);
    }
  };
}

/** Parede de baixo: tábuas e a viga do pé, encostada no deck. */
function houseBase(color: HouseColor) {
  return (p: Pixels, rng: Rng) => {
    housePlanks(p, rng, color);
    p.rect(0, 12, T, 3, G.plankDark);
    p.rect(0, 12, T, 1, G.plankLight);
    p.rect(0, 15, T, 1, G.postDark);
  };
}

/** Porta (2 tiles de altura): `top` = metade de cima, com a bandeira de vidro; senão a de baixo, com o degrau. */
function houseDoor(color: HouseColor, top: boolean) {
  return (p: Pixels, rng: Rng) => {
    (top ? houseWall(color) : houseBase(color))(p, rng);
    if (top) {
      p.rect(3, 4, 10, 12, V.trim); // batente
      p.rect(4, 5, 8, 11, V.door);
      p.rect(5, 6, 6, 3, V.glow); // vidrinho em cima da porta
      p.rect(5, 6, 6, 1, V.glowDeep);
      p.rect(7, 6, 2, 3, V.trimShade);
      for (const x of [6, 9]) p.rect(x, 10, 1, 6, V.doorDark);
    } else {
      p.rect(3, 0, 10, 13, V.trim);
      p.rect(4, 0, 8, 13, V.door);
      for (const x of [6, 9]) p.rect(x, 0, 1, 13, V.doorDark);
      p.rect(4, 0, 1, 13, V.doorLight);
      p.set(10, 5, C.gold); // maçaneta
      p.rect(2, 13, 12, 3, V.step); // degrau
      p.rect(2, 13, 12, 1, hex('#a9a69f'));
      p.rect(2, 15, 12, 1, V.stepDark);
    }
  };
}

/** Telhado de lata ondulada: `row` 0 = cumeeira (em cima), 1 = beirada; `side` diz se é a ponta da esquerda/direita. */
function tinRoof(row: 0 | 1, side: 'l' | 'm' | 'r', rust: number) {
  return (p: Pixels) => {
    const rng = mulberry32(880 + rust * 31 + row * 7 + (side === 'l' ? 1 : side === 'r' ? 2 : 0));
    for (let x = 0; x < T; x++) for (let y = 0; y < T; y++) p.set(x, y, x % 4 < 2 ? G.tin1 : G.tin2);
    if (row === 0) {
      p.rect(0, 0, T, 1, G.postDark);
      p.rect(0, 1, T, 2, hex('#c3c9cd')); // cumeeira
      p.rect(0, 3, T, 1, G.tin2);
    } else {
      p.rect(0, 12, T, 1, hex('#c3c9cd')); // beirada
      p.rect(0, 13, T, 3, G.postDark);
      p.rect(0, 13, T, 1, hex('#3a3f44'));
    }
    for (let k = 0; k < rust; k++) {
      // ferrugem escorrendo pela ondulação
      const x = randInt(rng, T);
      const y0 = row === 0 ? 4 + randInt(rng, 6) : randInt(rng, 6);
      for (let y = y0; y < Math.min(row === 0 ? T : 12, y0 + 3 + randInt(rng, 5)); y++) p.set(x, y, k % 2 ? G.tinRust : G.rust);
    }
    if (side !== 'm') {
      const x = side === 'l' ? 0 : T - 2;
      p.rect(x, 0, 2, row === 0 ? T : 13, hex('#5c6368')); // acabamento da ponta
    }
  };
}

/** Lamparina num poste de madeira (alta: o lampião fica lá em cima). `flags`: de onde sai o cordão das bandeirinhas. */
function drawLantern(flags: 'none' | 'left' | 'right'): Pixels {
  const p = new Pixels(16, 32);
  p.ellipse(8, 30.5, 3.5, 1.3, C.shadow);
  p.rect(7, 2, 2, 29, G.post);
  p.rect(8, 2, 1, 29, G.postDark);
  p.rect(6, 28, 4, 3, G.postDark); // pé
  p.rect(6, 4, 1, 1, G.postDark);
  const side = flags === 'right' ? -1 : 1; // o lampião fica do lado contrário ao cordão
  const lx = side > 0 ? 10 : 3;
  p.rect(side > 0 ? 9 : 5, 5, 3, 1, G.postDark); // braço
  p.rect(lx, 6, 4, 1, G.postDark); // tampa
  p.rect(lx, 7, 4, 4, V.flame);
  p.rect(lx + 1, 8, 2, 2, hex('#fff6c8'));
  p.rect(lx, 11, 4, 1, G.postDark);
  if (flags !== 'none') {
    const from = flags === 'right' ? 9 : 0;
    const to = flags === 'right' ? T : 7;
    for (let x = from; x < to; x++) p.set(x, 3, V.rope);
  }
  p.outline(G.postDark);
  return p;
}

/** Cordão de bandeirinhas de festa junina (camada "acima"), caindo um pouco no meio de cada tile. */
function drawFlags(offset: number) {
  return (p: Pixels) => {
    for (let x = 0; x < T; x++) {
      const y = 3 + Math.round(2.2 * Math.sin((Math.PI * x) / T));
      p.set(x, y, V.rope);
    }
    for (const [x0, i] of [
      [2, 0],
      [9, 1],
    ] as const) {
      const color = V.flags[(offset + i) % V.flags.length]!;
      const top = 3 + Math.round(2.2 * Math.sin((Math.PI * (x0 + 2)) / T)) + 1;
      for (let row = 0; row < 5; row++) for (let x = x0 + Math.ceil(row / 2); x <= x0 + 4 - Math.ceil(row / 2); x++) p.set(x, top + row, color);
    }
  };
}

/** Varal com roupa colorida (3 tiles de largura, 2 de altura: o cordão e o alto das roupas ficam "acima"). */
function drawClothesline(): Pixels {
  const p = new Pixels(48, 32);
  const rng = mulberry32(2290);
  p.ellipse(24, 30.5, 22, 1.6, C.shadow);
  for (const x of [2, 45]) {
    p.rect(x, 4, 2, 27, G.post);
    p.rect(x + 1, 4, 1, 27, G.postDark);
  }
  const ropeY = (x: number) => 6 + Math.round(3 * Math.sin((Math.PI * (x - 3)) / 42));
  for (let x = 3; x < 45; x++) p.set(x, ropeY(x), V.rope);
  let x = 6;
  V.clothes.forEach((color, i) => {
    const w = 5 + randInt(rng, 3);
    const top = ropeY(x + (w >> 1)) + 1;
    const h = i % 2 ? 9 : 12; // camiseta mais curta, toalha/vestido mais comprido
    p.rect(x, top, w, h, color);
    if (i % 2 === 0) p.rect(x + 1, top + h, w - 2, 1, color);
    for (let yy = top; yy < top + h; yy += 3) p.set(x + w - 1, yy, [0, 0, 0, 48]); // dobrinhas
    p.set(x + 1, top - 1, G.postDark); // pregadores
    p.set(x + w - 2, top - 1, G.postDark);
    x += w + 2;
  });
  p.outline(G.postDark);
  return p;
}

/** Rede de pesca secando num cavalete, com boias de cortiça (2 tiles de largura). */
function drawFishingNet(p: Pixels): void {
  p.ellipse(16, 14.5, 14, 1.6, C.shadow);
  for (const x of [3, 28]) {
    p.rect(x, 3, 2, 12, G.post);
    p.rect(x + 1, 3, 1, 12, G.postDark);
  }
  p.rect(3, 3, 27, 2, G.postDark); // travessa
  for (let y = 5; y < 13; y++) {
    for (let x = 5; x < 28; x++) if ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) p.set(x, y, V.net);
  }
  for (let x = 6; x < 28; x += 4) p.set(x, 5, V.cork);
  p.outline(G.postDark);
}

function drawCrate(p: Pixels, rng: Rng): void {
  p.ellipse(8, 14.5, 7, 1.5, C.shadow);
  p.rect(2, 3, 12, 11, G.plank);
  for (const y of [3, 8, 13]) p.rect(2, y, 12, 1, G.plankDark);
  p.rect(2, 3, 1, 11, G.plankLight);
  p.rect(13, 3, 1, 11, G.plankDark);
  for (let k = 0; k < 4; k++) p.set(3 + randInt(rng, 10), 4 + randInt(rng, 9), G.plankLight);
  p.rect(5, 1, 6, 2, V.fish); // peixe aparecendo em cima
  p.set(5, 1, V.fishDark);
  p.outline(G.postDark);
}

function drawBarrel(p: Pixels): void {
  p.ellipse(8, 14.5, 6.5, 1.5, C.shadow);
  p.ellipse(8, 8.5, 5.5, 6, G.hull);
  p.rect(4, 3, 8, 11, G.hull);
  p.rect(4, 3, 2, 11, G.hullLight);
  p.rect(10, 3, 2, 11, G.hullDark);
  for (const y of [4, 8, 12]) p.rect(3, y, 10, 1, V.hoop);
  p.ellipse(8, 3, 4, 1.4, G.hullDark); // tampa
  p.outline(G.postDark);
}

function drawFishBasket(p: Pixels): void {
  p.ellipse(8, 14.5, 7, 1.5, C.shadow);
  p.ellipse(8, 10, 6.5, 4.5, V.basket);
  for (let y = 7; y < 14; y += 2) for (let x = 2; x < 15; x++) if (p.alpha(x, y) === 255) p.set(x, y, V.basketDark);
  for (const [x, y] of [
    [4, 6],
    [8, 5],
    [11, 6],
  ] as const) {
    p.rect(x, y, 3, 2, V.fish); // peixes
    p.set(x + 3, y, V.fishDark);
    p.set(x, y, V.fishDark);
  }
  p.outline(G.postDark);
}

/** As peças da casa colorida de cada cor: parede, janela, pé da parede e as duas metades da porta. */
function houseTiles(name: string, color: HouseColor): TileDef[] {
  return [
    { key: `house_${name}_wall`, collides: true, draw: houseWall(color) },
    { key: `house_${name}_window`, collides: true, light: { color: '#ffd27a', radius: 14 }, draw: houseWindow(color) },
    { key: `house_${name}_base`, collides: true, draw: houseBase(color) },
    { key: `house_${name}_door_top`, collides: true, draw: houseDoor(color, true) },
    { key: `house_${name}_door`, collides: true, draw: houseDoor(color, false) },
  ];
}

const clothesline = once(drawClothesline);
const boulder = once(drawBoulder);
const fruitStall = once(drawFruitStall);
const lanternFlagsRight = once(() => drawLantern('right'));
const lanternFlagsLeft = once(() => drawLantern('left'));

// ---------- Capricho no mapa, passo 3: Santo Amaro (prédios de 2 andares, brasas, fogo, beiradas) ----------

/** Andar de cima da fachada: beirada da laje em cima, janelas quebradas e a marquise de concreto embaixo. */
function facadeUpper(kind: 'windows' | 'vines' | 'tags') {
  return (p: Pixels, rng: Rng) => {
    p.fill(S.facade);
    p.speckle(rng, [S.facadeDark, S.facadeLight], 24);
    p.rect(0, 0, T, 2, S.concreteDark); // beirada da laje
    p.rect(0, 2, T, 1, S.facadeLight);
    for (const x of [1, 6, 11]) {
      p.rect(x, 4, 4, 6, S.window);
      p.rect(x + 2, 4, 1, 6, S.facadeDark);
      p.rect(x, 10, 4, 1, S.facadeLight); // peitoril
      if (rng() < 0.6) p.set(x + 1, 5, S.glass);
      if (rng() < 0.4) p.set(x + 3, 8, S.glassLight);
    }
    if (rng() < 0.5) for (const y of [5, 7]) p.rect(11, y, 4, 1, G.plank); // janela tapada com tábuas
    p.rect(0, 12, T, 2, S.concreteLight); // marquise
    p.rect(0, 14, T, 2, S.concreteDark);
    if (kind === 'vines') {
      for (let k = 0; k < 4; k++) {
        let x = randInt(rng, T);
        for (let y = 0; y < 12; y++) {
          p.set(x, y, S.vine);
          if (rng() < 0.4) p.set(x + (rng() < 0.5 ? -1 : 1), y, rng() < 0.5 ? S.vineLight : S.vineDark);
          if (rng() < 0.3) x = clamp15(x + randInt(rng, 3) - 1);
        }
      }
    }
    if (kind === 'tags') {
      // pichação lá no alto: letras retas e pontudas, em preto
      for (let x = 1; x < 15; x += 3) {
        p.rect(x, 0, 1, 3, S.wire);
        p.set(x + 1, rng() < 0.5 ? 0 : 2, S.wire);
      }
    }
  };
}

/** Andar de baixo (a calçada): loja de porta de aço, entrada escura, parede com lambe-lambe, ou cipó subindo. */
function facadeLower(kind: 'shop' | 'door' | 'posters' | 'vines') {
  return (p: Pixels, rng: Rng) => {
    p.fill(S.facade);
    p.speckle(rng, [S.facadeDark, S.facadeLight], 20);
    p.rect(0, 0, T, 2, [24, 26, 30, 120]); // sombra da marquise
    if (kind === 'shop') {
      const sign = S.sign[randInt(rng, S.sign.length)]!;
      p.rect(0, 2, T, 3, sign);
      for (let x = 2; x < 14; x += 3) p.rect(x, 3, 2, 1, S.facadeLight); // letras apagadas (sem nome de ninguém)
      for (let y = 5; y < T; y++) p.rect(1, y, 14, 1, y % 2 ? S.shutterDark : S.shutter);
      p.rect(1, 5, 14, 1, S.shutterLight);
      for (let k = 0; k < 14; k++) p.set(1 + randInt(rng, 14), 10 + randInt(rng, 6), k % 2 ? S.rust : S.rustDark);
      p.rect(7, 12, 2, 2, S.ironDark); // cadeado
      if (rng() < 0.6) for (let x = 3; x < 12; x++) p.set(x, 8 + Math.round(Math.sin(x) * 1.2), G.graffiti[x % 4]!);
    } else if (kind === 'door') {
      p.rect(4, 3, 8, 13, S.facadeDark); // batente
      p.rect(5, 4, 6, 12, S.window); // entrada escura
      p.rect(5, 4, 6, 1, S.glass);
      p.set(6, 7, S.glassLight); // caco de vidro
      p.rect(3, 15, 10, 1, S.concreteLight); // degrau
    } else if (kind === 'posters') {
      const colors = [hex('#d9c9a0'), hex('#c9a43a'), hex('#b5473a'), hex('#3f78a8'), hex('#e6e2d6')];
      for (let k = 0; k < 5; k++) {
        const x = randInt(rng, 12);
        const y = 3 + randInt(rng, 8);
        p.rect(x, y, 4, 5, colors[k % colors.length]!); // lambe-lambe rasgado
        p.set(x + 3, y + 4, S.facade);
        p.rect(x + 1, y + 1, 2, 1, S.facadeDark);
      }
    } else {
      for (let k = 0; k < 5; k++) {
        let x = randInt(rng, T);
        for (let y = T - 1; y >= 4 + randInt(rng, 6); y--) {
          p.set(x, y, S.vine);
          if (rng() < 0.45) p.set(x + (rng() < 0.5 ? -1 : 1), y, rng() < 0.5 ? S.vineLight : S.vineDark);
          if (rng() < 0.3) x = clamp15(x + randInt(rng, 3) - 1);
        }
      }
    }
    for (let x = 0; x < T; x++) if (rng() < 0.5) p.set(x, 15, rng() < 0.5 ? S.moss : S.mossDark); // musgo no pé
  };
}

/** Brasas no chão (o rastro da Mula): cinza com carvões acesos que pulsam. `frame` 0, 1 ou 2. */
function drawEmbers(frame: number) {
  return (p: Pixels) => {
    const rng = mulberry32(9091);
    p.ellipse(8, 9, 7, 4.5, [40, 34, 32, 200]); // cinza
    p.speckle(rng, [hex('#2a2422'), hex('#4a3f3a')], 26, true);
    const hot = [G.fire1, G.fire2, G.fire3, G.ember];
    for (let k = 0; k < 9; k++) {
      const x = 3 + randInt(rng, 10);
      const y = 6 + randInt(rng, 6);
      const heat = (k + frame) % 4;
      p.set(x, y, hot[heat]!);
      if (heat < 2) p.set(x + 1, y, G.fire3);
    }
  };
}

/** Tambor com fogo (o pessoal das ruínas se esquentando). `frame` 0, 1 ou 2: as chamas mudam. */
function drawFireBarrel(frame: number) {
  return (p: Pixels) => {
    p.ellipse(8, 14.5, 6.5, 1.6, C.shadow);
    p.rect(3, 6, 10, 9, S.rustDark);
    p.rect(3, 6, 2, 9, S.rust);
    for (const y of [8, 12]) p.rect(3, y, 10, 1, S.ironDark);
    p.rect(3, 5, 10, 1, S.iron); // borda
    const flames = [
      [
        [5, 1, 2, 4],
        [8, 0, 2, 5],
        [10, 2, 2, 3],
      ],
      [
        [4, 2, 2, 3],
        [7, 1, 3, 4],
        [10, 0, 2, 5],
      ],
      [
        [5, 0, 2, 5],
        [8, 2, 2, 3],
        [10, 1, 2, 4],
      ],
    ][frame]!;
    for (const [x, y, w, h] of flames) {
      p.rect(x!, y!, w!, h!, G.fire3);
      p.rect(x!, y! + 1, w!, h! - 1, G.fire2);
      p.set(x!, y! + h! - 1, G.fire1);
    }
    p.outline(S.outline);
  };
}

// ---------- Represa Billings: água verde, mato de brejo, buritis, aguapés e casas afundadas ----------

/** Cores da Billings: água esverdeada (cheia de vida depois de anos parada) e mato de brejo. */
const B2 = {
  water: hex('#3f7a6e'),
  waterDark: hex('#346a60'),
  waterLight: hex('#62a092'),
  foam: hex('#cfe6da'),
  deep: hex('#2c5a52'),
  deepDark: hex('#254d46'),
  deepLight: hex('#3d7068'),
  grass: hex('#4b7a3a'),
  grassDark: hex('#3c6630'),
  grassLight: hex('#5f9146'),
  grassWet: hex('#3f6a4f'),
  leaf: hex('#4f9a3c'),
  leafLight: hex('#78c25a'),
  leafDark: hex('#357a2a'),
  flower: hex('#b48ad9'),
  flowerLight: hex('#dcc2f2'),
  palm: hex('#5a9a3e'),
  palmLight: hex('#86c45a'),
  palmDark: hex('#3a6e2a'),
  palmTrunk: hex('#7a6248'),
  palmTrunkDark: hex('#5a4634'),
  fruit: hex('#b4542e'),
};

/** Água da Billings (verde). `frame` 0, 1 ou 2: as ondinhas balançam (animação 0-1-2-1, como a da Guarapiranga). */
function swampWater(frame: number, deep = false) {
  return (p: Pixels) => {
    const rng = mulberry32(deep ? 512 : 511);
    p.fill(deep ? B2.deep : B2.water);
    p.speckle(rng, [deep ? B2.deepDark : B2.waterDark], deep ? 22 : 16);
    const light = deep ? B2.deepLight : B2.waterLight;
    [
      [2, 5],
      [10, 9],
      [4, 13],
    ].forEach(([x, y], i) => wave(p, x! + (i % 2 === 0 ? frame : -frame), y!, light));
    if (!deep && frame === 1) p.set(12, 3, B2.foam);
  };
}

/** Água verde parada (a beirada; a água de verdade, no tile do lado, balança). */
function stillSwampWater(p: Pixels, rng: Rng): void {
  p.fill(B2.water);
  p.speckle(rng, [B2.waterDark], 10);
}

/** Mato de brejo: escuro e úmido, com poças pequenas e (na variação b) trevos e samambaias. */
function swampGrass(variant: number) {
  return (p: Pixels, rng: Rng) => {
    p.fill(B2.grass);
    p.speckle(rng, [B2.grassDark, B2.grassDark, B2.grassLight], 26);
    for (let k = 0; k < 8; k++) {
      const x = randInt(rng, T);
      const y = 1 + randInt(rng, T - 2);
      p.set(x, y, B2.grassLight);
      p.set(x, y + 1, B2.grassDark);
    }
    if (rng() < 0.5) p.ellipse(3 + rng() * 10, 3 + rng() * 10, 2.2, 1.2, B2.grassWet); // chão encharcado
    if (variant === 1) {
      for (let k = 0; k < 3; k++) {
        const x = 2 + randInt(rng, 12);
        const y = 2 + randInt(rng, 12);
        for (const [dx, dy] of [
          [0, -1],
          [-1, 0],
          [1, 0],
        ] as const) {
          p.set(x + dx, y + dy, B2.leafLight); // trevo
        }
        p.set(x, y, B2.leafDark);
      }
    }
  };
}

/** Aguapé boiando: folhas redondas e (na variação com flor) um cacho lilás. Fica na "decor", em cima da água. */
function drawAguape(withFlower: boolean) {
  return (p: Pixels, rng: Rng) => {
    for (let k = 0; k < 6; k++) {
      const cx = 3 + rng() * 10;
      const cy = 4 + rng() * 9;
      p.ellipse(cx, cy + 1, 2.6, 1.6, [20, 50, 40, 90]); // sombra na água
      clump(p, cx, cy, 2.2 + rng() * 0.8, B2.leaf, B2.leafLight, B2.leafDark);
    }
    if (withFlower) {
      for (let y = 2; y < 8; y++) p.set(8 + (y % 2), y, y < 4 ? B2.flowerLight : B2.flower);
      p.set(7, 4, B2.flower);
      p.set(10, 5, B2.flower);
    }
  };
}

/** Buriti (palmeira do brejo), alta: as folhas em leque lá em cima, cachos de coquinhos, tronco com anéis. */
function drawBigBuriti(): Pixels {
  const p = new Pixels(32, 48);
  const rng = mulberry32(8181);
  p.ellipse(16.5, 44.5, 9, 2.6, C.shadow);
  for (let y = 14; y <= 45; y++) {
    const x = 15 + Math.round(Math.sin(y / 9) * 0.8); // tronco quase reto
    p.rect(x, y, 3, 1, y % 3 === 0 ? B2.palmTrunkDark : B2.palmTrunk);
    p.set(x, y, hex('#937a5e'));
  }
  p.rect(13, 43, 7, 3, B2.palmTrunkDark); // pé mais largo
  // folhas em leque: muitas pontas saindo do alto do tronco; as dos lados caem bastante
  const top = { x: 16.5, y: 13 };
  for (let k = 0; k < 22; k++) {
    const t = k / 21;
    const angle = Math.PI * (0.92 + t * 1.16) + (rng() - 0.5) * 0.08; // de 166° a 374°: em volta toda, mais para cima
    const side = Math.abs(Math.cos(angle));
    const length = 12 + rng() * 4 + side * 3;
    for (let i = 0; i < length; i++) {
      const droop = (i / length) ** 2 * (3 + side * 7); // as folhas dos lados caem mais
      const x = top.x + Math.cos(angle) * i;
      const y = top.y + Math.sin(angle) * i * 0.8 + droop;
      p.set(x, y, i > length - 3 ? B2.palmLight : k % 3 === 0 ? B2.palmDark : B2.palm);
      if (i > 3 && i % 2 === 0) {
        p.set(x, y + 1, B2.palmDark); // folíolos
        p.set(x + (Math.cos(angle) > 0 ? 1 : -1), y + 1, B2.palm);
      }
    }
  }
  for (const [x, y] of [
    [13, 16],
    [20, 16],
    [16.5, 17],
  ] as const) {
    p.ellipse(x, y, 1.6, 1.4, B2.fruit); // cachos de buriti
    p.set(x - 1, y - 1, hex('#d07a4a'));
  }
  p.outline(C.outline);
  return p;
}

/**
 * Barraquinha de frutas da feira (3x2 tiles): em cima, o toldo listrado nos dois postes (a vendedora fica em pé no
 * meio, na frente do toldo); embaixo, o balcão com caixotes de banana, laranja, abacaxi, melancia e mamão.
 */
function drawFruitStall(): Pixels {
  const p = new Pixels(48, 32);
  const rng = mulberry32(6262);
  p.ellipse(24, 30.5, 22, 1.8, C.shadow);
  for (const x of [3, 43]) {
    p.rect(x, 3, 2, 26, G.post); // postes
    p.rect(x + 1, 3, 1, 26, G.postDark);
  }
  // toldo listrado (vermelho e branco), com a beirada em ondinhas
  for (let y = 1; y < 9; y++) {
    for (let x = 1; x < 47; x++) p.set(x, y, Math.floor((x - 1) / 4) % 2 === 0 ? hex('#d9483b') : hex('#f2ede0'));
  }
  for (let x = 1; x < 47; x++) {
    const red = Math.floor((x - 1) / 4) % 2 === 0;
    if ((x - 1) % 4 !== 3) p.set(x, 9, red ? hex('#b23a2f') : hex('#d6cfbd'));
  }
  p.rect(1, 1, 46, 1, hex('#8e2f26'));
  // cacho de banana pendurado e uma réstia de alho no poste
  p.rect(8, 10, 3, 4, C.yellow);
  p.set(9, 14, C.yellow);
  p.rect(8, 10, 1, 4, hex('#c9a42a'));
  p.rect(37, 10, 2, 5, V.trim);
  // o balcão: tampo, frente de tábuas e uma lousinha
  p.rect(1, 17, 46, 2, G.plankLight);
  p.rect(1, 19, 46, 11, G.plank);
  for (let x = 4; x < 46; x += 5) p.rect(x, 19, 1, 11, G.plankDark);
  p.rect(1, 29, 46, 1, G.postDark);
  p.rect(19, 21, 10, 6, hex('#2f3a33')); // lousinha (preço escrito a giz)
  for (let x = 21; x < 27; x += 2) p.set(x, 23 + (x % 3 === 0 ? 1 : 0), V.trim);
  // caixotes com frutas em cima do balcão
  const crate = (x: number, fruit: RGBA, light: RGBA) => {
    p.rect(x, 13, 9, 5, G.plankDark);
    p.rect(x + 1, 12, 7, 2, fruit);
    for (let k = 0; k < 5; k++) p.set(x + 1 + randInt(rng, 7), 12 + randInt(rng, 2), light);
  };
  crate(3, hex('#ef8a2b'), hex('#ffc070')); // laranja
  crate(13, C.yellow, hex('#fff2a0')); // banana
  crate(26, hex('#e8a23a'), hex('#5ab55a')); // mamão
  p.ellipse(39.5, 14, 4, 3, hex('#3f8a3a')); // melancia, com uma fatia aberta
  p.rect(37, 12, 3, 2, hex('#e2435a'));
  p.set(38, 12, G.postDark);
  p.rect(23, 9, 2, 4, hex('#d9b34a')); // abacaxi em pé
  p.set(23, 8, C.stem);
  p.set(24, 7, C.stem);
  p.outline(G.postDark);
  return p;
}

/** Pedra grande (2x2 tiles), lisa em cima e com musgo embaixo: a pedra da Iara, no meio do lago. */
function drawBoulder(): Pixels {
  const p = new Pixels(32, 32);
  const rng = mulberry32(4242);
  p.ellipse(16.5, 27, 14, 4, [20, 50, 45, 120]); // reflexo escuro na água
  p.ellipse(16, 18, 13, 10, C.rockDark);
  p.ellipse(15, 16, 12, 9.5, C.rock);
  p.ellipse(13, 12, 8, 5, C.rockLight); // o alto, liso (onde ela senta)
  p.ellipse(11.5, 10.5, 3.5, 1.6, hex('#d4d3da'));
  for (let k = 0; k < 40; k++) {
    const x = 4 + randInt(rng, 24);
    const y = 18 + randInt(rng, 9);
    if (p.alpha(x, y) === 255) p.set(x, y, k % 3 ? B2.grassDark : B2.leaf); // musgo perto da água
  }
  for (const [x0, y0, len] of [
    [20, 9, 5],
    [8, 17, 4],
  ] as const) {
    for (let i = 0; i < len; i++) p.set(x0 + i, y0 + (i % 2), C.rockEdge); // rachaduras
  }
  for (const [x, y, w] of [
    [3, 26, 6],
    [22, 27, 7],
  ] as const) {
    p.rect(x, y, w, 1, B2.waterLight); // marolinha
  }
  p.outline(C.rockEdge);
  return p;
}

/** Telhado de uma casa afundada saindo da água (2 tiles: a cumeeira e as duas águas do telhado). */
function drawSunkenRoof(p: Pixels): void {
  p.ellipse(16, 12, 15, 3.5, [20, 50, 45, 110]); // sombra na água
  for (let y = 3; y < 13; y++) {
    const half = 3 + (y - 3) * 1.25;
    for (let x = Math.floor(16 - half); x < Math.ceil(16 + half); x++) {
      p.set(x, y, x < 16 ? (x % 3 === 0 ? G.tin2 : G.tin1) : x % 3 === 0 ? G.tin2 : hex('#8d969b'));
    }
  }
  p.rect(13, 3, 6, 1, hex('#c3c9cd')); // cumeeira
  for (let k = 0; k < 7; k++) p.set(6 + ((k * 7) % 20), 6 + ((k * 5) % 6), G.tinRust);
  for (const [x, y, w] of [
    [2, 13, 5],
    [24, 13, 6],
    [11, 14, 9],
  ] as const) {
    p.rect(x, y, w, 1, B2.waterLight); // marolinha batendo no telhado
  }
  p.outline(G.postDark);
}

export const TILES: TileDef[] = [
  { key: 'grass', draw: grass(0) },
  { key: 'grass_tufts', draw: grass(1) },
  { key: 'grass_dark', draw: grass(2) },
  { key: 'dirt', draw: drawDirt },
  { key: 'sand', draw: drawSand },
  { key: 'water', collides: true, shootOver: true, animation: swayFrames('water'), draw: water(0) },
  { key: 'water_sparkle', collides: true, shootOver: true, animation: swayFrames('water_sparkle'), draw: water(1) },
  {
    key: 'stone_floor',
    draw(p, rng) {
      p.fill(C.stone);
      for (let x = 0; x < T; x++) {
        p.set(x, 7, C.stoneDark);
        p.set(x, 15, C.stoneDark);
        p.set(x, 0, C.stoneLight);
        p.set(x, 8, C.stoneLight);
      }
      for (let y = 0; y < 7; y++) p.set(11, y, C.stoneDark);
      for (let y = 8; y < 15; y++) p.set(3, y, C.stoneDark);
      p.speckle(rng, [C.stoneDark, C.stoneLight], 14);
    },
  },
  { key: 'bridge_top', draw: bridge('top') },
  { key: 'bridge', draw: bridge('none') },
  { key: 'bridge_bottom', draw: bridge('bottom') },
  {
    key: 'wood_floor',
    draw(p, rng) {
      p.fill(C.wood);
      for (let y = 3; y < T; y += 4) for (let x = 0; x < T; x++) p.set(x, y, C.woodDark);
      for (let band = 0; band < 4; band++) p.set((band % 2) * 8 + 3, band * 4 + 1, C.woodDarker);
      p.speckle(rng, [C.woodLight], 10);
    },
  },
  {
    key: 'tree',
    collides: true,
    draw(p, rng) {
      p.ellipse(8, 14, 6, 2, C.shadow);
      p.rect(7, 10, 2, 5, C.trunk);
      p.rect(8, 10, 1, 5, C.trunkDark);
      p.disc(8, 6.5, 5.8, C.leaf);
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) {
          if (p.alpha(x, y) === 255 && y < 12 && x - 8 + (y - 6.5) * 1.2 > 3) p.set(x, y, C.leafDark);
        }
      }
      p.disc(6, 4.5, 2.4, C.leafLight, true);
      p.speckle(rng, [C.leafDark, C.leafLight], 10, true);
      p.outline(C.outline);
    },
  },
  {
    key: 'pine',
    collides: true,
    draw(p) {
      p.ellipse(8, 14, 5, 1.8, C.shadow);
      p.rect(7, 12, 2, 3, C.trunk);
      const tiers = [
        [1, 1],
        [2, 2],
        [3, 2],
        [4, 3],
        [5, 2],
        [6, 3],
        [7, 4],
        [8, 5],
        [9, 4],
        [10, 5],
        [11, 6],
        [12, 6],
      ];
      for (const [y, half] of tiers) {
        for (let x = 8 - half!; x < 8 + half!; x++) {
          const color = x < 7 ? C.pineLight : x > 8 ? C.pineDark : C.pine;
          p.set(x, y!, color);
        }
      }
      p.outline(C.outline);
    },
  },
  {
    key: 'bush',
    collides: true,
    draw(p, rng) {
      p.ellipse(8, 14, 6, 1.8, C.shadow);
      p.disc(8, 9.5, 4.6, C.leaf);
      p.disc(4.8, 10.5, 3, C.leaf);
      p.disc(11.2, 10.5, 3, C.leaf);
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) if (p.alpha(x, y) === 255 && y > 10) p.set(x, y, C.leafDark);
      }
      p.disc(6.5, 7.5, 1.8, C.leafLight, true);
      p.speckle(rng, [C.leafDark, C.leafLight], 6, true);
      p.outline(C.outline);
    },
  },
  {
    key: 'rock',
    collides: true,
    draw(p, rng) {
      p.ellipse(8, 14, 6.5, 1.8, C.shadow);
      p.ellipse(8, 10, 6, 4.3, C.rock);
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) {
          if (p.alpha(x, y) === 255 && (x - 8) * 0.5 + (y - 10) > 1.2) p.set(x, y, C.rockDark);
        }
      }
      p.ellipse(6.5, 8.3, 2.8, 1.6, C.rockLight, true);
      p.speckle(rng, [C.rockDark], 4, true);
      p.outline(C.rockEdge);
    },
  },
  { key: 'flowers_red', draw: flowers(C.red, C.yellow) },
  { key: 'flowers_yellow', draw: flowers(C.yellow, C.orange) },
  { key: 'flowers_white', draw: flowers(C.white, C.yellow) },
  {
    key: 'tall_grass',
    draw(p, rng) {
      for (let k = 0; k < 14; k++) {
        const x = 1 + randInt(rng, 14);
        const height = 4 + randInt(rng, 4);
        const base = 11 + randInt(rng, 4);
        for (let i = 0; i < height; i++) {
          const color = i === height - 1 ? C.grassTuft : i === 0 ? C.grassDark : C.grassLight;
          p.set(x + (i === height - 1 && rng() < 0.5 ? 1 : 0), base - i, color);
        }
      }
    },
  },
  {
    key: 'roof',
    collides: true,
    draw(p) {
      p.fill(C.roof);
      for (let band = 0; band < 4; band++) {
        const y0 = band * 4;
        const offset = band % 2 === 0 ? 0 : 2;
        for (let x = 0; x < T; x++) {
          p.set(x, y0, C.roofLight);
          p.set(x, y0 + 3, C.roofDark);
        }
        for (let x = offset; x < T; x += 4) {
          p.set(x, y0 + 1, C.roofDark);
          p.set(x, y0 + 2, C.roofDark);
        }
      }
    },
  },
  { key: 'wall', collides: true, draw: wallBase },
  {
    key: 'wall_window',
    collides: true,
    draw(p, rng) {
      wallBase(p, rng);
      p.rect(4, 4, 8, 7, C.beam);
      p.rect(5, 5, 6, 5, C.glass);
      p.rect(7, 5, 2, 5, C.beam);
      p.set(5, 5, C.glassLight);
      p.set(9, 5, C.glassLight);
      p.rect(3, 11, 10, 1, C.woodDark); // parapeito
    },
  },
  {
    key: 'door',
    collides: true,
    draw(p, rng) {
      wallBase(p, rng);
      p.rect(4, 3, 8, 13, C.beam);
      p.rect(5, 4, 6, 12, C.door);
      p.rect(7, 4, 1, 12, C.doorDark);
      p.set(5, 4, C.beam);
      p.set(10, 4, C.beam);
      p.set(9, 10, C.gold);
      p.rect(5, 15, 6, 1, C.doorDark);
    },
  },
  {
    key: 'fence',
    collides: true,
    draw(p) {
      p.rect(0, 13, 16, 1, C.shadow);
      for (const y of [5, 9]) {
        p.rect(0, y, 16, 2, C.wood);
        p.rect(0, y + 1, 16, 1, C.woodDark);
      }
      for (const x of [2, 12]) {
        p.rect(x, 3, 2, 10, C.wood);
        p.rect(x + 1, 3, 1, 10, C.woodDark);
        p.set(x, 3, C.woodLight);
      }
      p.outline(C.woodDarker);
    },
  },
  {
    key: 'well',
    collides: true,
    draw(p, rng) {
      p.ellipse(8, 14, 7, 2, C.shadow);
      p.disc(8, 8.5, 6.4, C.stone);
      p.speckle(rng, [C.stoneDark, C.stoneLight], 18, true);
      p.disc(8, 8.5, 3.9, C.waterDark);
      p.set(6, 6, C.waterLight);
      p.set(7, 6, C.waterLight);
      p.outline(C.rockEdge);
    },
  },
  // ---------- Refúgio de Guarapiranga ----------
  { key: 'deck', draw: drawDeck },
  {
    key: 'water_posts', // água logo abaixo de um deck: estacas e sombra
    collides: true,
    shootOver: true,
    animation: swayFrames('water_posts'),
    draw: waterPosts(0),
  },
  { key: 'pier_left', draw: pier('left') },
  { key: 'pier_v', draw: pier('none') },
  { key: 'pier_right', draw: pier('right') },
  { key: 'boat_left', collides: true, shootOver: true, draw: halfOf(drawBoat, 0) },
  { key: 'boat_right', collides: true, shootOver: true, draw: halfOf(drawBoat, 1) },
  {
    key: 'boat_wreck', // barco afundado pela metade
    collides: true,
    shootOver: true,
    draw(p) {
      p.ellipse(8, 9, 7, 4, [10, 30, 60, 90]);
      for (let x = 2; x <= 13; x++) {
        const top = 6 + Math.round(Math.abs(x - 7.5) * 0.35);
        p.rect(x, top, 1, 2, x % 3 === 0 ? G.hullLight : G.hull);
      }
      p.rect(4, 4, 1, 4, G.hullDark); // tábuas quebradas
      p.rect(9, 3, 1, 5, G.hullDark);
      p.rect(12, 5, 1, 3, G.hullLight);
      for (const [x, y] of [
        [1, 11],
        [6, 12],
        [11, 11],
      ] as const) {
        p.rect(x, y, 3, 1, C.waterLight);
      }
      p.outline(G.postDark);
    },
  },
  {
    key: 'campfire',
    collides: true,
    shootOver: true,
    animation: [
      { key: 'campfire', ms: 140 },
      { key: 'campfire_f1', ms: 110 },
      { key: 'campfire_f2', ms: 150 },
      { key: 'campfire_f1', ms: 120 },
    ],
    light: { color: '#ffb04a', radius: 46 },
    draw: campfire(0),
  },
  {
    key: 'asphalt',
    draw(p, rng) {
      p.fill(G.asphalt);
      p.speckle(rng, [G.asphaltLight, G.asphaltDark], 30);
    },
  },
  {
    key: 'asphalt_cracked',
    draw(p, rng) {
      p.fill(G.asphalt);
      p.speckle(rng, [G.asphaltLight, G.asphaltDark], 26);
      // rachaduras com mato nascendo
      let x = randInt(rng, 16);
      for (let y = 0; y < 16; y++) {
        p.set(x, y, G.crack);
        if (rng() < 0.3) p.set(x + 1, y, C.grassDark);
        if (rng() < 0.15) p.set(x - 1, y, C.grassTuft);
        x = Math.max(0, Math.min(15, x + randInt(rng, 3) - 1));
      }
      for (let k = 0; k < 4; k++) p.set(randInt(rng, 16), randInt(rng, 16), C.grassLight);
      if (rng() < 0.5) p.rect(2, 7, 4, 1, G.lane); // pedaço da faixa antiga
    },
  },
  { key: 'ruin_wall', collides: true, draw: (p, rng) => drawRuinWall(p, rng, false) },
  { key: 'ruin_wall_graffiti', collides: true, draw: (p, rng) => drawRuinWall(p, rng, true) },
  { key: 'car_left', collides: true, draw: halfOf(drawCar, 0) },
  { key: 'car_right', collides: true, draw: halfOf(drawCar, 1) },
  {
    key: 'lamp_post', // poste antigo, torto, com cipó
    collides: true,
    shootOver: true,
    draw(p) {
      p.ellipse(8, 14.5, 3, 1.2, C.shadow);
      p.rect(7, 4, 2, 11, G.pole);
      p.rect(8, 4, 1, 11, G.poleDark);
      p.rect(8, 2, 5, 2, G.pole);
      p.rect(11, 4, 2, 1, G.poleDark); // luminária quebrada
      for (const y of [6, 9, 12]) {
        p.set(6, y, G.moss);
        p.set(9, y + 1, G.mossDark);
      }
      p.outline(G.asphaltDark);
    },
  },
  {
    key: 'dark_water', // parte funda da represa
    collides: true,
    shootOver: true,
    animation: swayFrames('dark_water'),
    draw: deepWater(0),
  },
  {
    key: 'reeds', // taboa na beira da água
    draw(p, rng) {
      for (let k = 0; k < 7; k++) {
        const x = 1 + randInt(rng, 14);
        const height = 6 + randInt(rng, 6);
        const base = 14 + randInt(rng, 2);
        for (let i = 0; i < height; i++) p.set(x, base - i, i < 2 ? G.reedDark : G.reed);
        if (rng() < 0.7) p.rect(x, base - height - 2, 1, 3, G.cattail);
      }
    },
  },
  { key: 'mud', draw: drawMud }, // brejo
  { key: 'tin_roof', collides: true, draw: drawTinRoof },
  { key: 'wood_wall', collides: true, draw: drawWoodWall },
  {
    key: 'wood_window',
    collides: true,
    light: { color: '#ffd27a', radius: 14 },
    draw(p, rng) {
      drawWoodWall(p, rng);
      p.rect(4, 4, 8, 7, G.postDark);
      p.rect(5, 5, 6, 5, [255, 214, 120, 255]); // luz acesa lá dentro
      p.rect(5, 5, 6, 1, [230, 170, 80, 255]);
      p.rect(7, 5, 2, 5, G.postDark);
      p.rect(3, 11, 10, 1, G.plankDark);
    },
  },
  {
    key: 'wood_door',
    collides: true,
    draw(p, rng) {
      drawWoodWall(p, rng);
      p.rect(4, 3, 8, 13, G.postDark);
      p.rect(5, 4, 6, 12, G.hull);
      p.rect(7, 4, 1, 12, G.hullDark);
      p.set(9, 10, C.gold);
    },
  },
  { key: 'ipe_yellow', collides: true, draw: (p, rng) => drawIpe(p, rng, G.ipeYellow, G.ipeYellowLight, G.ipeYellowDark) },
  { key: 'ipe_pink', collides: true, draw: (p, rng) => drawIpe(p, rng, G.ipePink, G.ipePinkLight, G.ipePinkDark) },
  {
    key: 'bones', // ossada (aviso de perigo perto do Saci)
    draw(p) {
      p.rect(3, 11, 7, 1, G.bone);
      p.rect(4, 13, 7, 1, G.boneDark);
      p.set(2, 10, G.bone);
      p.set(10, 12, G.bone);
      p.disc(11.5, 9.5, 2.6, G.bone);
      p.set(10, 9, G.postDark);
      p.set(12, 9, G.postDark);
      p.rect(11, 11, 1, 1, G.boneDark);
      p.outline(G.asphaltDark);
    },
  },
  // ---------- Ruínas de Santo Amaro ----------
  { key: 'concrete', draw: (p, rng) => drawConcrete(p, rng, false) },
  { key: 'concrete_moss', draw: (p, rng) => drawConcrete(p, rng, true) },
  { key: 'grass_gloom', draw: drawGloom }, // mato escuro e meio seco, onde a cidade sumiu
  {
    key: 'oil_puddle', // poça escura de óleo velho (dá para pisar)
    draw(p, rng) {
      drawConcrete(p, rng, false);
      p.ellipse(8, 8.5, 6.2, 4.4, S.oilEdge);
      p.ellipse(8, 8.5, 5.4, 3.6, S.oil);
      for (const [x, y, c] of [[5, 7, S.sheen1], [6, 7, S.sheen2], [9, 9, S.sheen1], [10, 9, S.sheen2], [7, 10, S.sheen2]] as const) p.set(x, y, c);
    },
  },
  {
    key: 'manhole', // tampa de bueiro no asfalto
    draw(p, rng) {
      p.fill(G.asphalt);
      p.speckle(rng, [G.asphaltLight, G.asphaltDark], 26);
      p.disc(8, 8, 5.6, S.ironDark);
      p.disc(8, 8, 4.6, S.iron);
      for (let i = 4; i <= 12; i += 2) p.rect(i, 4, 1, 8, S.ironDark);
      p.disc(8, 8, 4.6, [0, 0, 0, 0], true);
      p.set(6, 5, S.ironLight);
      p.set(10, 10, S.rust);
      p.set(11, 9, S.rust);
    },
  },
  {
    key: 'rubble', // entulho: pedaços de concreto e ferro
    collides: true,
    shootOver: true,
    draw: drawRubble,
  },
  { key: 'building_top', collides: true, draw: (p, rng) => drawRoofSlab(p, rng, false) },
  { key: 'building_top_broken', collides: true, draw: (p, rng) => drawRoofSlab(p, rng, true) },
  { key: 'building_wall', collides: true, draw: (p, rng) => drawFacade(p, rng) },
  {
    key: 'building_window', // fachada com janelas quebradas
    collides: true,
    draw(p, rng) {
      drawFacade(p, rng);
      // duas fileiras de janelas (uma por andar), com o caixilho no meio; algumas tapadas com tábuas
      for (const [y, h] of [[3, 5], [10, 4]] as const) {
        for (const x of [1, 6, 11]) {
          p.rect(x, y, 4, h, S.window);
          p.rect(x + 2, y, 1, h, S.facadeDark);
          if (rng() < 0.6) p.set(x + 1, y + 1, S.glass);
          if (rng() < 0.4) p.set(x + 3, y + h - 2, S.glassLight);
        }
      }
      for (const y of [11, 13]) p.rect(11, y, 4, 1, G.plank); // janela tapada
    },
  },
  {
    key: 'shop_shutter', // porta de aço de loja abandonada, com a faixa da placa apagada
    collides: true,
    draw(p, rng) {
      const sign = S.sign[randInt(rng, S.sign.length)]!;
      p.fill(S.facade);
      p.rect(0, 0, T, 2, S.concreteDark);
      p.rect(0, 2, T, 3, sign);
      for (let x = 2; x < 14; x += 3) p.rect(x, 3, 2, 1, S.facadeLight); // letras apagadas (sem nome de ninguém)
      for (let y = 5; y < T; y++) p.rect(1, y, 14, 1, y % 2 ? S.shutterDark : S.shutter);
      p.rect(1, 5, 14, 1, S.shutterLight);
      for (let k = 0; k < 16; k++) p.set(1 + randInt(rng, 14), 11 + randInt(rng, 5), k % 2 ? S.rust : S.rustDark);
      p.rect(7, 13, 2, 2, S.ironDark); // cadeado
      if (rng() < 0.6) for (let x = 3; x < 12; x++) p.set(x, 9 + Math.round(Math.sin(x) * 1.2), G.graffiti[x % 4]!);
    },
  },
  {
    key: 'vine_wall', // fachada engolida pelo cipó
    collides: true,
    draw(p, rng) {
      drawFacade(p, rng);
      for (let k = 0; k < 5; k++) {
        let x = randInt(rng, T);
        for (let y = 0; y < T; y++) {
          p.set(x, y, S.vine);
          if (rng() < 0.45) p.set(x + (rng() < 0.5 ? -1 : 1), y, rng() < 0.5 ? S.vineLight : S.vineDark);
          if (rng() < 0.3) x = clamp15(x + randInt(rng, 3) - 1);
        }
      }
      p.speckle(rng, [S.vine, S.vineLight, S.vineDark], 24);
    },
  },
  {
    key: 'scrap', // monte de sucata: chapas, cano e engrenagem
    collides: true,
    shootOver: true,
    draw(p) {
      p.ellipse(8, 13.5, 7, 2.2, C.shadow);
      // tambor de óleo enferrujado
      p.rect(2, 4, 5, 10, S.rust);
      p.rect(2, 4, 5, 1, S.rustLight);
      p.rect(2, 7, 5, 1, S.rustDark);
      p.rect(2, 11, 5, 1, S.rustDark);
      p.rect(6, 4, 1, 10, S.rustDark);
      // chapas de lata empilhadas e um cano
      p.rect(7, 9, 8, 2, S.iron);
      p.rect(7, 9, 8, 1, S.ironLight);
      p.rect(8, 11, 7, 2, S.rust);
      p.rect(8, 11, 7, 1, S.rustLight);
      p.rect(9, 6, 6, 1, S.ironLight);
      p.rect(9, 7, 6, 1, S.ironDark);
      p.set(14, 6, S.window);
      p.outline(S.outline);
    },
  },
  {
    key: 'tires', // pilha de pneus velhos
    collides: true,
    shootOver: true,
    draw(p) {
      p.ellipse(8, 14.2, 6.5, 1.6, C.shadow);
      // três pneus deitados, um em cima do outro (dá para ver o furo do de cima)
      for (const y of [11, 8, 5]) {
        p.rect(2, y, 12, 3, S.tire);
        p.rect(3, y - 1, 10, 1, S.tire);
        p.rect(3, y + 3, 10, 1, S.tire);
        p.rect(2, y + 1, 12, 1, S.tireLight);
        for (let x = 3; x < 13; x += 2) p.set(x, y + 2, S.tireLight); // desenho da banda
      }
      p.rect(5, 4, 6, 2, [12, 12, 14, 255]); // furo do pneu de cima
      p.rect(5, 4, 6, 1, S.tireLight);
      p.set(4, 9, S.moss);
      p.set(12, 12, S.mossDark);
      p.outline(S.outline);
    },
  },
  {
    key: 'wires', // fios caídos no chão (dá para passar por cima)
    draw(p) {
      for (const [color, phase, base] of [[S.wire, 0, 5], [S.wireRed, 1.7, 9], [S.wireYellow, 3.1, 12]] as const) {
        for (let x = 0; x < T; x++) {
          if (base === 12 && x > 11) break; // ponta solta
          p.set(x, base + Math.round(Math.sin(x * 0.55 + phase) * 1.6), color);
        }
      }
      p.set(12, 11, S.wireYellow);
      p.set(13, 10, S.herbFlower); // faísca de outro tempo
    },
  },
  {
    key: 'pole_wires', // poste de madeira com fios pendurados
    collides: true,
    shootOver: true,
    draw(p) {
      p.ellipse(8, 14.5, 3, 1.2, C.shadow);
      p.rect(7, 0, 2, 15, S.deadWood);
      p.rect(8, 0, 1, 15, S.deadWoodDark);
      p.rect(3, 1, 10, 1, S.deadWoodDark); // travessa lá no alto
      for (const x of [3, 12]) p.set(x, 0, S.insulator);
      p.rect(9, 4, 3, 4, S.ironLight); // transformador velho
      p.rect(10, 4, 2, 4, S.iron);
      p.rect(9, 8, 3, 1, S.rustDark);
      for (let x = 0; x < 3; x++) p.set(x, 2 + x, S.wire); // fios caindo para os lados
      for (let y = 2; y < 9; y++) p.set(13 + (y > 5 ? 1 : 0), y, S.wireRed);
      p.set(6, 9, S.moss);
      p.set(9, 12, S.mossDark);
      p.outline(S.outline);
    },
  },
  {
    key: 'dead_tree', // árvore seca
    collides: true,
    draw(p) {
      p.ellipse(8, 14.5, 5, 1.6, C.shadow);
      p.rect(7, 7, 2, 8, S.deadWood);
      p.rect(8, 7, 1, 8, S.deadWoodDark);
      for (const [x0, y0, dx] of [[7, 8, -1], [8, 7, 1], [7, 5, -1], [8, 4, 1], [7, 3, 0]] as const) {
        for (let k = 0; k < 4; k++) p.set(x0 + dx * k, y0 - k, k === 3 ? S.deadWoodLight : S.deadWood);
      }
      for (const [x, y] of [[3, 4], [12, 3], [5, 1], [10, 6]] as const) p.set(x, y, S.dry); // folhas secas
      p.outline(S.outline);
    },
  },
  {
    key: 'herbs', // ervas de cura (arruda, boldo...) nascendo no meio do concreto
    draw(p, rng) {
      for (let k = 0; k < 9; k++) {
        const x = 4 + randInt(rng, 8);
        const y = 7 + randInt(rng, 6);
        p.rect(x, y, 2, 2, k % 3 === 0 ? S.herbDark : k % 3 === 1 ? S.herb : S.herbLight);
      }
      p.rect(7, 12, 1, 3, S.herbDark);
      for (const [x, y] of [[5, 7], [10, 8], [8, 6]] as const) p.set(x, y, S.herbFlower);
      p.outline(S.outline);
    },
  },
  { key: 'bus_left', collides: true, draw: sliceOf(3, drawBus, 0) },
  { key: 'bus_middle', collides: true, draw: sliceOf(3, drawBus, 1) },
  { key: 'bus_right', collides: true, draw: sliceOf(3, drawBus, 2) },
  { key: 'concrete_cracked', draw: (p, rng) => drawConcrete(p, rng, true, true) },
  // ---- capricho no mapa, passo 1 ----
  ...bigTreeTiles('tree_big', once(drawBigRoundTree)),
  ...bigTreeTiles('pine_big', once(drawBigPine)),
  ...bigTreeTiles('ipe_yellow_big', once(() => drawBigIpe(G.ipeYellow, G.ipeYellowLight, G.ipeYellowDark, 7301))),
  ...bigTreeTiles('ipe_pink_big', once(() => drawBigIpe(G.ipePink, G.ipePinkLight, G.ipePinkDark, 7302))),
  ...bigTreeTiles('dead_tree_big', once(drawBigDeadTree)),
  ...tallTiles('lamp_post_tall', once(drawTallLampPost)),
  ...tallTiles('pole_wires_tall', once(drawTallWirePole)),
  { key: 'thicket', collides: true, draw: drawThicket },
  { key: 'shade_s', draw: drawShade('s') },
  { key: 'shade_e', draw: drawShade('e') },
  { key: 'shade_se', draw: drawShade('se') },
  { key: 'water_f1', collides: true, shootOver: true, draw: water(0, 1) },
  { key: 'water_f2', collides: true, shootOver: true, draw: water(0, 2) },
  { key: 'water_sparkle_f1', collides: true, shootOver: true, draw: water(1, 1) },
  { key: 'water_sparkle_f2', collides: true, shootOver: true, draw: water(1, 2) },
  { key: 'dark_water_f1', collides: true, shootOver: true, draw: deepWater(1) },
  { key: 'dark_water_f2', collides: true, shootOver: true, draw: deepWater(2) },
  { key: 'water_posts_f1', collides: true, shootOver: true, draw: waterPosts(1) },
  { key: 'water_posts_f2', collides: true, shootOver: true, draw: waterPosts(2) },
  { key: 'campfire_f1', collides: true, shootOver: true, draw: campfire(1) },
  { key: 'campfire_f2', collides: true, shootOver: true, draw: campfire(2) },
  // ---- capricho no mapa, passo 2: beiradas suaves ----
  ...edgeTiles('shore', EDGE_STYLES.shore!),
  ...edgeTiles('mud_shore', EDGE_STYLES.mud_shore!),
  ...edgeTiles('sand_grass', EDGE_STYLES.sand_grass!),
  ...edgeTiles('dirt_grass', EDGE_STYLES.dirt_grass!),
  ...edgeTiles('mud_grass', EDGE_STYLES.mud_grass!),
  ...fadeEdgeTiles('deep_edge', G.deep, 14, 235),
  ...edgeTiles('dirt_mud', EDGE_STYLES.dirt_mud!),
  { key: 'roof_top_l', collides: true, draw: tinRoof(0, 'l', 1) },
  { key: 'roof_top_m', collides: true, draw: tinRoof(0, 'm', 0) },
  { key: 'roof_top_m2', collides: true, draw: tinRoof(0, 'm', 2) },
  { key: 'roof_top_r', collides: true, draw: tinRoof(0, 'r', 1) },
  { key: 'roof_eave_l', collides: true, draw: tinRoof(1, 'l', 0) },
  { key: 'roof_eave_m', collides: true, draw: tinRoof(1, 'm', 1) },
  { key: 'roof_eave_m2', collides: true, draw: tinRoof(1, 'm', 3) },
  { key: 'roof_eave_r', collides: true, draw: tinRoof(1, 'r', 0) },
  ...houseTiles('azul', HOUSE_COLORS.azul),
  ...houseTiles('verde', HOUSE_COLORS.verde),
  ...houseTiles('terracota', HOUSE_COLORS.terracota),
  ...houseTiles('amarelo', HOUSE_COLORS.amarelo),
  ...tallTiles('lantern', once(() => drawLantern('none'))),
  { key: 'lantern_flags_r_top', draw: pieceOf(lanternFlagsRight, 0, 0) },
  { key: 'lantern_flags_l_top', draw: pieceOf(lanternFlagsLeft, 0, 0) },
  { key: 'flags_a', draw: drawFlags(0) },
  { key: 'flags_b', draw: drawFlags(2) },
  { key: 'flags_c', draw: drawFlags(4) },
  { key: 'clothesline_tl', draw: pieceOf(clothesline, 0, 0) },
  { key: 'clothesline_tm', draw: pieceOf(clothesline, 1, 0) },
  { key: 'clothesline_tr', draw: pieceOf(clothesline, 2, 0) },
  { key: 'clothesline_bl', collides: true, shootOver: true, draw: pieceOf(clothesline, 0, 1) },
  { key: 'clothesline_bm', collides: true, shootOver: true, draw: pieceOf(clothesline, 1, 1) },
  { key: 'clothesline_br', collides: true, shootOver: true, draw: pieceOf(clothesline, 2, 1) },
  { key: 'fishing_net_left', collides: true, shootOver: true, draw: halfOf(drawFishingNet, 0) },
  { key: 'fishing_net_right', collides: true, shootOver: true, draw: halfOf(drawFishingNet, 1) },
  { key: 'crate', collides: true, draw: drawCrate },
  { key: 'barrel', collides: true, draw: drawBarrel },
  { key: 'fish_basket', collides: true, shootOver: true, draw: drawFishBasket },
  // ---- capricho no mapa, passo 3: Santo Amaro ----
  { key: 'facade_up_windows', collides: true, draw: facadeUpper('windows') },
  { key: 'facade_up_vines', collides: true, draw: facadeUpper('vines') },
  { key: 'facade_up_tags', collides: true, draw: facadeUpper('tags') },
  { key: 'facade_low_shop', collides: true, draw: facadeLower('shop') },
  { key: 'facade_low_door', collides: true, draw: facadeLower('door') },
  { key: 'facade_low_posters', collides: true, draw: facadeLower('posters') },
  { key: 'facade_low_vines', collides: true, draw: facadeLower('vines') },
  {
    key: 'embers',
    animation: [
      { key: 'embers', ms: 260 },
      { key: 'embers_f1', ms: 220 },
      { key: 'embers_f2', ms: 280 },
    ],
    light: { color: '#ff6a2a', radius: 22 },
    sparks: true,
    draw: drawEmbers(0),
  },
  { key: 'embers_f1', draw: drawEmbers(1) },
  { key: 'embers_f2', draw: drawEmbers(2) },
  {
    key: 'fire_barrel',
    collides: true,
    shootOver: true,
    animation: [
      { key: 'fire_barrel', ms: 130 },
      { key: 'fire_barrel_f1', ms: 120 },
      { key: 'fire_barrel_f2', ms: 140 },
    ],
    light: { color: '#ffa040', radius: 40 },
    sparks: true,
    draw: drawFireBarrel(0),
  },
  { key: 'fire_barrel_f1', collides: true, shootOver: true, draw: drawFireBarrel(1) },
  { key: 'fire_barrel_f2', collides: true, shootOver: true, draw: drawFireBarrel(2) },
  ...edgeTiles('concrete_gloom', EDGE_STYLES.concrete_gloom!),
  // ---- Represa Billings ----
  { key: 'swamp_water', collides: true, shootOver: true, animation: swayFrames('swamp_water', 360), draw: swampWater(0) },
  { key: 'swamp_water_f1', collides: true, shootOver: true, draw: swampWater(1) },
  { key: 'swamp_water_f2', collides: true, shootOver: true, draw: swampWater(2) },
  { key: 'swamp_deep', collides: true, shootOver: true, animation: swayFrames('swamp_deep', 420), draw: swampWater(0, true) },
  { key: 'swamp_deep_f1', collides: true, shootOver: true, draw: swampWater(1, true) },
  { key: 'swamp_deep_f2', collides: true, shootOver: true, draw: swampWater(2, true) },
  { key: 'swamp_grass', draw: swampGrass(0) },
  { key: 'swamp_grass_b', draw: swampGrass(1) },
  ...edgeTiles('swamp_shore', EDGE_STYLES.swamp_shore!),
  ...edgeTiles('mud_swamp', EDGE_STYLES.mud_swamp!),
  ...edgeTiles('mud_swamp_shore', EDGE_STYLES.mud_swamp_shore!),
  ...fadeEdgeTiles('swamp_deep_edge', B2.deep, 14, 235),
  { key: 'aguape', draw: drawAguape(false) },
  { key: 'aguape_flower', draw: drawAguape(true) },
  ...bigTreeTiles('buriti_big', once(drawBigBuriti)),
  { key: 'sunken_roof_left', collides: true, shootOver: true, draw: halfOf(drawSunkenRoof, 0) },
  { key: 'sunken_roof_right', collides: true, shootOver: true, draw: halfOf(drawSunkenRoof, 1) },
  ...edgeTiles('sand_swamp_shore', EDGE_STYLES.sand_swamp_shore!),
  ...edgeTiles('sand_swamp', EDGE_STYLES.sand_swamp!),
  { key: 'boulder_tl', collides: true, draw: pieceOf(boulder, 0, 0) },
  { key: 'boulder_tr', collides: true, draw: pieceOf(boulder, 1, 0) },
  { key: 'boulder_bl', collides: true, draw: pieceOf(boulder, 0, 1) },
  { key: 'boulder_br', collides: true, draw: pieceOf(boulder, 1, 1) },
  // barraquinha de frutas (a da Dona Iracema): a fileira de trás (toldo e postes) é livre — a vendedora fica no meio
  // e entra pelos lados; quem bloqueia é só o balcão (um NPC precisa de um lugar que dê para alcançar a pé)
  { key: 'stall_back_l', draw: pieceOf(fruitStall, 0, 0) },
  { key: 'stall_back_m', draw: pieceOf(fruitStall, 1, 0) },
  { key: 'stall_back_r', draw: pieceOf(fruitStall, 2, 0) },
  { key: 'stall_front_l', collides: true, shootOver: true, draw: pieceOf(fruitStall, 0, 1) },
  { key: 'stall_front_m', collides: true, shootOver: true, draw: pieceOf(fruitStall, 1, 1) },
  { key: 'stall_front_r', collides: true, shootOver: true, draw: pieceOf(fruitStall, 2, 1) },
];

export const TILE_INDEX: Record<string, number> = Object.fromEntries(TILES.map((t, i) => [t.key, i]));

/** Número do tile no mapa do Tiled ("gid" = índice + 1, porque 0 significa vazio). */
export function gid(key: string): number {
  const index = TILE_INDEX[key];
  if (index === undefined) throw new Error(`tile desconhecido: ${key}`);
  return index + 1;
}

// Layout da imagem: cada tile ganha 1 pixel de "borda repetida" (extrusão) em volta,
// o que evita linhas finas entre os tiles quando a câmera anda.
export const COLUMNS = 8;
export const MARGIN = 1;
export const SPACING = 2;
export const ROWS = Math.ceil(TILES.length / COLUMNS);
export const IMAGE_WIDTH = COLUMNS * (T + SPACING);
export const IMAGE_HEIGHT = ROWS * (T + SPACING);

/** Desenha todos os tiles numa única imagem (o "tileset"). */
export function buildTileset(): Pixels {
  const atlas = new Pixels(IMAGE_WIDTH, IMAGE_HEIGHT);
  TILES.forEach((def, index) => {
    const tile = new Pixels(T, T);
    def.draw(tile, mulberry32(1000 + index * 7919));
    const ox = MARGIN + (index % COLUMNS) * (T + SPACING);
    const oy = MARGIN + Math.floor(index / COLUMNS) * (T + SPACING);
    atlas.blit(tile, ox, oy);
    // extrusão: repete a borda do tile 1 pixel para fora
    for (let y = -1; y <= T; y++) {
      for (let x = -1; x <= T; x++) {
        if (x >= 0 && x < T && y >= 0 && y < T) continue;
        const sx = Math.min(Math.max(x, 0), T - 1);
        const sy = Math.min(Math.max(y, 0), T - 1);
        const i = ((oy + y) * atlas.width + (ox + x)) * 4;
        const j = (sy * T + sx) * 4;
        for (let k = 0; k < 4; k++) atlas.data[i + k] = tile.data[j + k]!;
      }
    }
  });
  return atlas;
}

/** O tileset no formato do Tiled, para embutir no mapa. */
export function tiledTileset(imagePath: string) {
  return {
    columns: COLUMNS,
    firstgid: 1,
    image: imagePath,
    imageheight: IMAGE_HEIGHT,
    imagewidth: IMAGE_WIDTH,
    margin: MARGIN,
    name: 'tiles',
    spacing: SPACING,
    tilecount: COLUMNS * ROWS,
    tileheight: T,
    tilewidth: T,
    // Propriedades em português porque são editadas no Tiled:
    // colide = bloqueia a passagem; bloqueiaTiro = segura projéteis.
    // luz = cor do brilho em volta e luzRaio = o tamanho dele (em pixels); animation = quadros da animação.
    tiles: TILES.flatMap((t, id) => {
      const properties: { name: string; type: string; value: boolean | string | number }[] = [];
      if (t.collides) properties.push({ name: 'colide', type: 'bool', value: true });
      if (t.collides && !t.shootOver) properties.push({ name: 'bloqueiaTiro', type: 'bool', value: true });
      if (t.light) properties.push({ name: 'luz', type: 'string', value: t.light.color }, { name: 'luzRaio', type: 'int', value: t.light.radius });
      if (t.sparks) properties.push({ name: 'faiscas', type: 'bool', value: true });
      const entry: { id: number; properties?: typeof properties; animation?: { tileid: number; duration: number }[] } = { id };
      if (properties.length > 0) entry.properties = properties;
      if (t.animation) entry.animation = t.animation.map((f) => ({ tileid: gid(f.key) - 1, duration: f.ms }));
      return entry.properties || entry.animation ? [entry] : [];
    }),
  };
}
