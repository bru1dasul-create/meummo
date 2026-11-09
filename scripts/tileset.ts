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
  draw(p: Pixels, rng: Rng): void;
}

function grass(variant: number) {
  return (p: Pixels, rng: Rng) => {
    p.fill(C.grass);
    p.speckle(rng, [C.grassDark, C.grassDark, C.grassLight], 30);
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

function water(variant: number) {
  return (p: Pixels, rng: Rng) => {
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
    for (const [x, y] of waves) {
      p.set(x!, y!, C.waterLight);
      p.set(x! + 1, y! - 1, C.waterLight);
      p.set(x! + 2, y! - 1, C.waterLight);
      p.set(x! + 3, y!, C.waterLight);
    }
    if (variant === 1) {
      p.set(12, 4, C.foam);
      p.set(4, 10, C.foam);
    }
  };
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

export const TILES: TileDef[] = [
  { key: 'grass', draw: grass(0) },
  { key: 'grass_tufts', draw: grass(1) },
  { key: 'grass_dark', draw: grass(2) },
  {
    key: 'dirt',
    draw(p, rng) {
      p.fill(C.dirt);
      p.speckle(rng, [C.dirtDark, C.dirtDark, C.dirtLight], 36);
      for (let k = 0; k < 3; k++) {
        const x = 1 + randInt(rng, 13);
        const y = 1 + randInt(rng, 14);
        p.set(x, y, C.pebble);
        p.set(x + 1, y, C.dirtLight);
      }
    },
  },
  {
    key: 'sand',
    draw(p, rng) {
      p.fill(C.sand);
      p.speckle(rng, [C.sandDark, C.sandDark, C.sandLight], 30);
    },
  },
  { key: 'water', collides: true, shootOver: true, draw: water(0) },
  { key: 'water_sparkle', collides: true, shootOver: true, draw: water(1) },
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
    draw(p, rng) {
      water(0)(p, rng);
      p.rect(0, 0, 16, 3, [12, 28, 55, 120]);
      for (const x of [2, 12]) {
        p.rect(x, 0, 2, 9, G.post);
        p.rect(x + 1, 0, 1, 9, G.postDark);
        p.rect(x - 1, 9, 4, 1, C.waterLight);
      }
    },
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
    draw(p) {
      p.ellipse(8, 11, 7, 3, C.shadow);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        p.disc(8 + Math.cos(a) * 5.2, 10 + Math.sin(a) * 2.8, 1.4, i % 2 ? G.stone : G.stoneDark);
      }
      p.rect(4, 10, 8, 1, G.log);
      p.rect(6, 9, 4, 3, G.ember);
      p.ellipse(8, 7, 3, 4.5, G.fire3);
      p.ellipse(8, 7.8, 2.2, 3.4, G.fire2);
      p.ellipse(8, 8.6, 1.3, 2.2, G.fire1);
      p.set(6, 3, G.fire2);
      p.set(10, 4, G.fire3);
    },
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
    draw(p, rng) {
      p.fill(G.deep);
      p.speckle(rng, [G.deepDark], 22);
      for (const [x, y] of [
        [3, 5],
        [10, 11],
      ] as const) {
        p.set(x, y, G.deepLight);
        p.set(x + 1, y - 1, G.deepLight);
        p.set(x + 2, y, G.deepLight);
      }
    },
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
  {
    key: 'mud', // brejo
    draw(p, rng) {
      p.fill(G.mud);
      p.speckle(rng, [G.mudDark, G.mudDark, G.mudLight], 34);
      for (let k = 0; k < 2; k++) p.ellipse(3 + randInt(rng, 10), 3 + randInt(rng, 10), 2.2, 1.3, G.puddle);
      for (let k = 0; k < 3; k++) p.set(randInt(rng, 16), randInt(rng, 16), C.grassDark);
    },
  },
  { key: 'tin_roof', collides: true, draw: drawTinRoof },
  { key: 'wood_wall', collides: true, draw: drawWoodWall },
  {
    key: 'wood_window',
    collides: true,
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
    tiles: TILES.flatMap((t, id) => {
      const properties: { name: string; type: string; value: boolean }[] = [];
      if (t.collides) properties.push({ name: 'colide', type: 'bool', value: true });
      if (t.collides && !t.shootOver) properties.push({ name: 'bloqueiaTiro', type: 'bool', value: true });
      return properties.length > 0 ? [{ id, properties }] : [];
    }),
  };
}
