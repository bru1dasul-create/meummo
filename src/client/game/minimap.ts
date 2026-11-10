// Minimapa (no canto da tela) e mapa grande (tecla M, ou um toque no minimapa).
//
// O terreno sai das cores dos próprios tiles: cada tile vira um pontinho com a cor média dele, e o que
// bloqueia a passagem (água, árvore, parede) fica mais escuro — assim dá para ver por onde se anda. Tile novo
// no tileset já aparece certo, sem pintar nada à mão.
// Por cima do terreno: você (a setinha), outros jogadores, monstros por perto, NPCs e as saídas para outros mapas.
//
// Este arquivo não usa o Phaser: a cena entrega a imagem dos tiles e, a cada quadro, quem está por perto.
// A parte do terreno não usa nem o navegador (os testes conferem ela direto).

import type { GameMap, MapExit, TiledLayer, TiledMap } from '../../shared/map';

// ======================= terreno =======================

/** Camada que não entra no mapa: as copas e o alto dos postes (esconderiam os caminhos embaixo delas). */
const SKIP_LAYER = 'acima';
/** O quanto escurece o que bloqueia a passagem (1 = nada). */
export const BLOCKED_SHADE = 0.62;
/** Um pouco mais de cor: a média dos pixels de um tile fica "lavada". */
const SATURATION = 1.25;
/** Quanto cada camada pinta por cima da de baixo (multiplica a parte pintada do tile). */
const LAYER_WEIGHT: Record<string, number> = { ground: 1, sombras: 0.6 };
const DEFAULT_LAYER_WEIGHT = 1.15;
const GID_MASK = 0x0fffffff;

/** As medidas do tileset embutido no mapa (o Tiled guarda junto com o mapa). */
export interface TileSheet {
  firstgid: number;
  columns: number;
  tilecount: number;
  tilewidth: number;
  tileheight: number;
  margin?: number;
  spacing?: number;
}

/** Uma imagem em RGBA (4 números por pixel). */
export interface RgbaImage {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

/** O tileset do mapa (o primeiro; o jogo usa um só, chamado "tiles"). */
export function tileSheetOf(json: TiledMap): TileSheet {
  const sheet = json.tilesets[0] as Partial<TileSheet> | undefined;
  if (!sheet?.columns || !sheet.tilecount) throw new Error('O mapa precisa ter o tileset embutido (com colunas e número de tiles).');
  return {
    firstgid: sheet.firstgid ?? 1,
    columns: sheet.columns,
    tilecount: sheet.tilecount,
    tilewidth: sheet.tilewidth ?? json.tilewidth,
    tileheight: sheet.tileheight ?? json.tileheight,
    margin: sheet.margin ?? 0,
    spacing: sheet.spacing ?? 0,
  };
}

/**
 * Cor média de cada tile do tileset, na ordem dele: 4 números por tile (vermelho, verde, azul e o quanto do
 * tile é pintado, de 0 a 1). Pixels transparentes não contam na cor.
 */
export function averageTileColors(image: RgbaImage, sheet: TileSheet): Float32Array {
  const colors = new Float32Array(sheet.tilecount * 4);
  const margin = sheet.margin ?? 0;
  const spacing = sheet.spacing ?? 0;
  for (let index = 0; index < sheet.tilecount; index++) {
    const sx = margin + (index % sheet.columns) * (sheet.tilewidth + spacing);
    const sy = margin + Math.floor(index / sheet.columns) * (sheet.tileheight + spacing);
    let r = 0;
    let g = 0;
    let b = 0;
    let painted = 0;
    for (let y = 0; y < sheet.tileheight; y++) {
      for (let x = 0; x < sheet.tilewidth; x++) {
        if (sx + x >= image.width || sy + y >= image.height) continue;
        const s = ((sy + y) * image.width + sx + x) * 4;
        const alpha = image.data[s + 3]! / 255;
        r += image.data[s]! * alpha;
        g += image.data[s + 1]! * alpha;
        b += image.data[s + 2]! * alpha;
        painted += alpha;
      }
    }
    if (painted <= 0) continue;
    colors.set([r / painted, g / painted, b / painted, painted / (sheet.tilewidth * sheet.tileheight)], index * 4);
  }
  return colors;
}

/** As camadas de tiles do mapa, na ordem em que são desenhadas (entrando nos grupos). */
function tileLayers(layers: TiledLayer[]): TiledLayer[] {
  return layers.flatMap((layer) => (layer.type === 'group' ? tileLayers(layer.layers ?? []) : layer.type === 'tilelayer' ? [layer] : []));
}

/**
 * O terreno do mapa visto de cima: 1 pixel por tile, em RGBA. Chão, sombras e enfeites, cada um pintando por
 * cima do de baixo conforme o quanto do tile ele cobre; o que bloqueia a passagem fica mais escuro.
 */
export function terrainImage(
  json: TiledMap,
  colors: Float32Array,
  isWalkable: (x: number, y: number) => boolean,
  firstgid = 1,
): { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> } {
  const { width, height } = json;
  const rgb = new Float32Array(width * height * 3);
  for (const layer of tileLayers(json.layers)) {
    if (layer.name.toLowerCase() === SKIP_LAYER || !Array.isArray(layer.data)) continue;
    const weight = LAYER_WEIGHT[layer.name.toLowerCase()] ?? DEFAULT_LAYER_WEIGHT;
    layer.data.forEach((raw, i) => {
      const index = (raw & GID_MASK) - firstgid;
      if (raw === 0 || index < 0 || index * 4 >= colors.length) return;
      const k = Math.min(1, colors[index * 4 + 3]! * weight);
      if (k <= 0) return;
      for (let c = 0; c < 3; c++) rgb[i * 3 + c] = rgb[i * 3 + c]! * (1 - k) + colors[index * 4 + c]! * k;
    });
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = [rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!];
    const gray = (r + g + b) / 3;
    const shade = isWalkable(i % width, Math.floor(i / width)) ? 1 : BLOCKED_SHADE;
    data[i * 4] = (gray + (r - gray) * SATURATION) * shade;
    data[i * 4 + 1] = (gray + (g - gray) * SATURATION) * shade;
    data[i * 4 + 2] = (gray + (b - gray) * SATURATION) * shade;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

/** Onde escrever o nome de uma saída no mapa grande: um pouco para dentro do mapa, com a setinha para fora. */
export function exitLabel(exit: MapExit, mapWidth: number, mapHeight: number): { x: number; y: number; text: string; align: 'left' | 'right' | 'center' } {
  const midX = exit.x + exit.w / 2;
  const midY = exit.y + exit.h / 2;
  if (exit.x === 0) return { x: exit.x + exit.w + 0.6, y: midY, text: `◂ ${exit.label}`, align: 'left' };
  if (exit.x + exit.w >= mapWidth) return { x: exit.x - 0.6, y: midY, text: `${exit.label} ▸`, align: 'right' };
  if (exit.y === 0) return { x: midX, y: exit.y + exit.h + 1.2, text: `▴ ${exit.label}`, align: 'center' };
  if (exit.y + exit.h >= mapHeight) return { x: midX, y: exit.y - 1, text: `${exit.label} ▾`, align: 'center' };
  return { x: midX, y: exit.y - 1, text: exit.label, align: 'center' };
}

// ======================= na tela =======================

export type DotKind = 'player' | 'monster' | 'npc';

/** Alguém no mapa. Posição em tiles, no centro do tile (o meio do tile 3 é 3,5). */
export interface MapDot {
  kind: DotKind;
  x: number;
  y: number;
  name: string;
  /** Monstro bem mais forte que você. */
  danger?: boolean;
}

/** O que o mapa mostra agora: você (posição e para onde olha) e quem está por perto. */
export interface MapNow {
  you: { x: number; y: number; angle: number };
  dots: MapDot[];
}

/** Quantos tiles o minimapa mostra de lado a lado (o servidor manda quem está a até 20 tiles). */
const MINI_TILES = 40;
/** Redesenho: o minimapa umas 25 vezes por segundo; o mapa grande, 10. */
const MINI_EVERY_MS = 40;
const BIG_EVERY_MS = 100;

const COLORS = {
  void: '#0b100c',
  exit: '255, 215, 106',
  you: '#fff6d0',
  youEdge: '#2a1a06',
  player: '#a8d8ff',
  monster: '#ff6a55',
  danger: '#ff2a2a',
  npc: '#ffd34a',
  edge: 'rgba(10, 8, 6, 0.85)',
  label: '#f3ecda',
  exitLabel: '#ffd76a',
};

function canvas2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('O navegador não deixou desenhar o mapa.');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** A imagem dos tiles em RGBA (para tirar a cor média de cada um). */
function readPixels(source: HTMLImageElement | HTMLCanvasElement): RgbaImage {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas2d(canvas);
  ctx.drawImage(source, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** A cor média dos tiles só é calculada uma vez (a imagem é a mesma em todos os mapas). */
let colorCache: { source: HTMLImageElement | HTMLCanvasElement; colors: Float32Array } | null = null;

function tileColorsOf(source: HTMLImageElement | HTMLCanvasElement, sheet: TileSheet): Float32Array {
  if (colorCache?.source !== source || colorCache.colors.length !== sheet.tilecount * 4) {
    colorCache = { source, colors: averageTileColors(readPixels(source), sheet) };
  }
  return colorCache.colors;
}

/** O terreno ampliado: cada tile vira um quadrado de `scale` pixels (sem borrar). */
function scaledTerrain(terrain: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = terrain.width * scale;
  canvas.height = terrain.height * scale;
  canvas2d(canvas).drawImage(terrain, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Bolinha com contorno escuro. */
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = Math.max(1, radius * 0.45);
  ctx.strokeStyle = COLORS.edge;
  ctx.stroke();
}

/** NPC: losango dourado. */
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - radius * 1.25);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius * 1.25);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
  ctx.fillStyle = COLORS.npc;
  ctx.fill();
  ctx.lineWidth = Math.max(1, radius * 0.45);
  ctx.strokeStyle = COLORS.edge;
  ctx.stroke();
}

/** Você: uma setinha apontando para onde você olha. */
function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size * 1.15, 0);
  ctx.lineTo(-size * 0.8, size * 0.85);
  ctx.lineTo(-size * 0.35, 0);
  ctx.lineTo(-size * 0.8, -size * 0.85);
  ctx.closePath();
  ctx.fillStyle = COLORS.you;
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.3);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLORS.youEdge;
  ctx.stroke();
  ctx.restore();
}

const fontOf = (size: number) => `700 ${size}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

/** Texto com contorno escuro (lê em cima de qualquer chão). */
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center'): void {
  ctx.font = fontOf(size);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.28);
  ctx.strokeStyle = 'rgba(8, 6, 4, 0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** O espaço que um texto ocupa no mapa grande (para um nome não cair em cima do outro). */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function textBox(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, align: CanvasTextAlign): Box {
  ctx.font = fontOf(size);
  const width = ctx.measureText(text).width;
  const x0 = align === 'left' ? x : align === 'right' ? x - width : x - width / 2;
  const pad = size * 0.2;
  return { x0: x0 - pad, y0: y - size * 0.62, x1: x0 + width + pad, y1: y + size * 0.62 };
}

const overlaps = (box: Box, taken: Box[]) => taken.some((t) => box.x0 < t.x1 && box.x1 > t.x0 && box.y0 < t.y1 && box.y1 > t.y0);

/**
 * Escreve o nome no primeiro lugar de `spots` que não cai em cima de outro nome (e não sai do mapa).
 * Sem lugar livre: só escreve se `force` (no primeiro lugar). Guarda o espaço usado em `taken`.
 */
function placeLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  spots: { x: number; y: number; align?: CanvasTextAlign }[],
  size: number,
  color: string,
  taken: Box[],
  force = false,
): void {
  const width = ctx.canvas.width;
  const fitted = spots.map((spot) => {
    const align = spot.align ?? 'center';
    const box = textBox(ctx, text, spot.x, spot.y, size, align);
    const shift = Math.max(0, -box.x0) - Math.max(0, box.x1 - width); // empurra para dentro do mapa
    return { x: spot.x + shift, y: spot.y, align, box: { ...box, x0: box.x0 + shift, x1: box.x1 + shift } };
  });
  const free = fitted.find((spot) => !overlaps(spot.box, taken)) ?? (force ? fitted[0] : undefined);
  if (!free) return;
  label(ctx, text, free.x, free.y, size, color, free.align);
  taken.push(free.box);
}

/** Os tiles livres de cada saída (é onde o brilho dourado aparece no jogo). */
function exitTiles(map: GameMap): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  for (const exit of map.exits) {
    for (let y = exit.y; y < exit.y + exit.h; y++) for (let x = exit.x; x < exit.x + exit.w; x++) if (map.isWalkable(x, y)) tiles.push({ x, y });
  }
  return tiles;
}

/** O minimapa no canto e o mapa grande. Um por mapa: a cena cria quando o mapa abre e destrói quando sai dele. */
export class MapView {
  private readonly terrain: HTMLCanvasElement;
  private readonly exits: { x: number; y: number }[];
  private readonly mini: HTMLButtonElement;
  private readonly miniCanvas: HTMLCanvasElement;
  /** O terreno já ampliado para o minimapa, e quantos pixels da tela cada tile tem nele. */
  private miniTerrain: HTMLCanvasElement | null = null;
  private miniScale = 0;
  private readonly big: HTMLDivElement;
  private readonly bigCanvas: HTMLCanvasElement;
  /** O mapa grande sem ninguém em cima (terreno, saídas e os nomes delas), feito ao abrir. */
  private bigBase: HTMLCanvasElement | null = null;
  /** Onde estão os nomes das saídas no mapa grande (os outros nomes desviam deles). */
  private bigBoxes: Box[] = [];
  private bigScale = 0;
  private nextMiniAt = 0;
  private nextBigAt = 0;

  constructor(
    private readonly map: GameMap,
    json: TiledMap,
    tiles: HTMLImageElement | HTMLCanvasElement,
    private readonly now: () => MapNow,
  ) {
    const sheet = tileSheetOf(json);
    const image = terrainImage(json, tileColorsOf(tiles, sheet), (x, y) => map.isWalkable(x, y), sheet.firstgid);
    this.terrain = document.createElement('canvas');
    this.terrain.width = image.width;
    this.terrain.height = image.height;
    canvas2d(this.terrain).putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
    this.exits = exitTiles(map);

    // minimapa: um botão (no celular, um toque abre o mapa grande)
    this.mini = document.createElement('button');
    this.mini.type = 'button';
    this.mini.id = 'minimap';
    this.mini.title = 'Mapa (M)';
    this.mini.setAttribute('aria-label', `Mapa: ${map.name}`);
    this.miniCanvas = document.createElement('canvas');
    const name = document.createElement('span');
    name.className = 'minimap-name';
    name.textContent = map.name;
    const key = document.createElement('kbd');
    key.className = 'minimap-key desktop-only';
    key.textContent = 'M';
    this.mini.append(this.miniCanvas, name, key);
    this.mini.addEventListener('click', this.onMiniClick);

    // mapa grande: por cima de tudo, fecha no ✕, no M, no Esc ou tocando fora dele
    this.big = document.createElement('div');
    this.big.id = 'worldmap';
    this.big.hidden = true;
    const panel = document.createElement('div');
    panel.className = 'worldmap-panel';
    const head = document.createElement('div');
    head.className = 'worldmap-head';
    const title = document.createElement('strong');
    title.textContent = map.name;
    const sub = document.createElement('span');
    sub.className = map.safe ? 'safe' : 'danger';
    sub.textContent = map.safe ? 'Zona segura' : 'Zona perigosa';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'worldmap-close';
    close.textContent = '✕';
    close.title = 'Fechar (M ou Esc)';
    close.setAttribute('aria-label', 'Fechar o mapa');
    close.addEventListener('click', () => this.close());
    head.append(title, sub, close);
    this.bigCanvas = document.createElement('canvas');
    this.bigCanvas.className = 'worldmap-canvas';
    const legend = document.createElement('div');
    legend.className = 'worldmap-legend';
    for (const [cls, text] of [
      ['you', 'Você'],
      ['player', 'Jogadores'],
      ['monster', 'Monstros por perto'],
      ['npc', 'NPCs'],
      ['exit', 'Saídas'],
    ] as const) {
      const item = document.createElement('span');
      item.className = `legend-${cls}`;
      item.textContent = text;
      legend.append(item);
    }
    panel.append(head, this.bigCanvas, legend);
    this.big.append(panel);
    this.big.addEventListener('click', (event) => {
      if (event.target === this.big) this.close(); // tocou fora do mapa
    });

    document.body.append(this.mini, this.big);
    window.addEventListener('resize', this.onResize);
  }

  get isOpen(): boolean {
    return !this.big.hidden;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.big.hidden = false;
    this.layoutBig();
    this.nextBigAt = 0;
    this.update(performance.now());
  }

  close(): void {
    this.big.hidden = true;
  }

  /** Chamado a cada quadro pela cena: redesenha quando chega a hora. */
  update(now: number): void {
    const dueMini = now >= this.nextMiniAt;
    const dueBig = this.isOpen && now >= this.nextBigAt;
    if (!dueMini && !dueBig) return;
    const state = this.now();
    if (dueMini) {
      this.nextMiniAt = now + MINI_EVERY_MS;
      this.drawMini(state, now);
    }
    if (dueBig) {
      this.nextBigAt = now + BIG_EVERY_MS;
      this.drawBig(state, now);
    }
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.mini.remove();
    this.big.remove();
  }

  private readonly onMiniClick = (event: MouseEvent) => {
    event.preventDefault();
    this.mini.blur(); // senão a barra de espaço (esquiva) "clicaria" o botão de novo
    this.toggle();
  };

  private readonly onResize = () => {
    this.miniTerrain = null;
    if (this.isOpen) this.layoutBig();
  };

  /** Brilho das saídas pulsando devagar (como no chão do jogo). */
  private exitAlpha(now: number): number {
    return 0.55 + 0.3 * Math.sin(now / 280);
  }

  private drawMini(state: MapNow, now: number): void {
    const dpr = window.devicePixelRatio || 1;
    const cssSize = this.miniCanvas.clientWidth || 160;
    const size = Math.round(cssSize * dpr);
    if (this.miniCanvas.width !== size || this.miniCanvas.height !== size) {
      this.miniCanvas.width = size;
      this.miniCanvas.height = size;
      this.miniTerrain = null;
    }
    if (!this.miniTerrain) {
      this.miniScale = Math.max(1, Math.round(size / MINI_TILES));
      this.miniTerrain = scaledTerrain(this.terrain, this.miniScale);
    }
    const k = this.miniScale;
    const ctx = canvas2d(this.miniCanvas);
    // você no meio; perto da beirada do mapa, o mapa para de andar (não sobra fundo vazio)
    const fit = (center: number, total: number) => (total * k <= size ? Math.round((size - total * k) / 2) : Math.round(Math.min(0, Math.max(size - total * k, size / 2 - center * k))));
    const ox = fit(state.you.x, this.map.width);
    const oy = fit(state.you.y, this.map.height);
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(this.miniTerrain, ox, oy);
    ctx.fillStyle = `rgba(${COLORS.exit}, ${this.exitAlpha(now)})`;
    for (const tile of this.exits) ctx.fillRect(ox + tile.x * k, oy + tile.y * k, k, k);
    const radius = Math.max(2, k * 0.55);
    this.drawDots(ctx, state.dots, ox, oy, k, radius, size);
    arrow(ctx, ox + state.you.x * k, oy + state.you.y * k, Math.max(3, k * 0.95), state.you.angle);
  }

  private drawDots(ctx: CanvasRenderingContext2D, dots: MapDot[], ox: number, oy: number, k: number, radius: number, size: number): void {
    // monstros embaixo, jogadores e NPCs por cima
    const order: DotKind[] = ['monster', 'player', 'npc'];
    for (const kind of order) {
      for (const d of dots) {
        if (d.kind !== kind) continue;
        const x = ox + d.x * k;
        const y = oy + d.y * k;
        if (x < -radius || y < -radius || x > size + radius || y > size + radius) continue;
        if (kind === 'npc') diamond(ctx, x, y, radius * 1.1);
        else if (kind === 'player') dot(ctx, x, y, radius, COLORS.player);
        else dot(ctx, x, y, d.danger ? radius * 1.3 : radius, d.danger ? COLORS.danger : COLORS.monster);
      }
    }
  }

  /** Tamanho do mapa grande: o maior que cabe na tela, com cada tile em pixels inteiros (fica nítido). */
  private layoutBig(): void {
    const dpr = window.devicePixelRatio || 1;
    const phone = matchMedia('(pointer: coarse)').matches;
    const maxW = Math.min(window.innerWidth - (phone ? 28 : 64), 1100);
    const maxH = window.innerHeight - (phone ? 110 : 150);
    const cssPerTile = Math.max(1, Math.min(maxW / this.map.width, maxH / this.map.height));
    const k = Math.max(1, Math.floor(cssPerTile * dpr));
    this.bigScale = k;
    this.bigCanvas.width = this.map.width * k;
    this.bigCanvas.height = this.map.height * k;
    this.bigCanvas.style.width = `${(this.map.width * k) / dpr}px`;
    this.bigCanvas.style.height = `${(this.map.height * k) / dpr}px`;

    const base = scaledTerrain(this.terrain, k);
    const ctx = canvas2d(base);
    ctx.fillStyle = `rgba(${COLORS.exit}, 0.8)`;
    for (const tile of this.exits) ctx.fillRect(tile.x * k, tile.y * k, k, k);
    const font = Math.round((phone ? 11 : 13) * dpr);
    this.bigBoxes = [];
    for (const exit of this.map.exits) {
      if (!exit.label) continue;
      const spot = exitLabel(exit, this.map.width, this.map.height);
      placeLabel(ctx, spot.text, [{ x: spot.x * k, y: spot.y * k, align: spot.align }], font, COLORS.exitLabel, this.bigBoxes, true);
    }
    this.bigBase = base;
  }

  private drawBig(state: MapNow, now: number): void {
    if (!this.bigBase) this.layoutBig();
    const k = this.bigScale;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas2d(this.bigCanvas);
    ctx.drawImage(this.bigBase!, 0, 0);
    // as saídas pulsam por cima do brilho fixo
    ctx.fillStyle = `rgba(${COLORS.exit}, ${this.exitAlpha(now) * 0.5})`;
    for (const tile of this.exits) ctx.fillRect(tile.x * k, tile.y * k, k, k);
    const radius = Math.max(2.5 * dpr, k * 0.45);
    this.drawDots(ctx, state.dots, 0, 0, k, radius, Math.max(this.bigCanvas.width, this.bigCanvas.height));
    const font = Math.round(11 * dpr);
    const youX = state.you.x * k;
    const youY = state.you.y * k;
    const ring = radius * 3.2;
    // um anel em volta de você, para achar rápido no mapa grande
    ctx.beginPath();
    ctx.arc(youX, youY, ring, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.5, dpr * 1.5);
    ctx.strokeStyle = `rgba(255, 246, 208, ${0.5 + 0.3 * Math.sin(now / 200)})`;
    ctx.stroke();
    arrow(ctx, youX, youY, radius * 1.9, state.you.angle);
    // nomes: o seu primeiro (embaixo ou em cima do anel), depois os NPCs, sem cair em cima das saídas nem de você
    const taken = [...this.bigBoxes, { x0: youX - ring, y0: youY - ring, x1: youX + ring, y1: youY + ring }];
    const gap = ring + font * 0.75;
    placeLabel(ctx, 'Você', [{ x: youX, y: youY + gap }, { x: youX, y: youY - gap }], font, COLORS.you, taken, true);
    for (const d of state.dots) {
      if (d.kind !== 'npc') continue;
      const [x, y] = [d.x * k, d.y * k];
      const up = radius + font * 0.85;
      const side = radius * 1.6;
      // em cima, embaixo, à direita ou à esquerda do losango; sem lugar livre, fica só o losango
      placeLabel(ctx, d.name, [{ x, y: y - up }, { x, y: y + up }, { x: x + side, y, align: 'left' }, { x: x - side, y, align: 'right' }], font, COLORS.npc, taken);
    }
  }
}
