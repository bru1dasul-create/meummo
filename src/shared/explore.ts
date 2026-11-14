// O mapa explorado (pedido do dono, 14/11: "o mapa só é visto quando você anda pelo mapa"): cada mapa do mundo novo é
// dividido em quadradinhos de EXPLORE_CELL metros; andando, os quadradinhos a até EXPLORE_RADIUS metros do seu pé
// ficam marcados (é o que dá para ver em volta). Fica salvo no personagem, um "texto" por mapa.
//
// O texto é `colunas:base64` (um bit por quadradinho, linha por linha). Com as colunas junto, um mapa que cresce (ex.:
// o Capão ganhando mata ao sul) continua batendo: o que já foi explorado fica no mesmo lugar.

/** Tamanho de cada quadradinho (metros). */
export const EXPLORE_CELL = 4;
/** O quanto em volta do pé fica explorado (metros). */
export const EXPLORE_RADIUS = 12;

export interface ExploreGrid {
  cols: number;
  rows: number;
  /** Um bit por quadradinho, linha por linha (o quadradinho i é o bit i % 8 do byte i / 8). */
  bits: Uint8Array;
}

/** A grade (vazia) de um mapa com esse tamanho em metros. */
export function exploreGrid(widthM: number, heightM: number): ExploreGrid {
  const cols = Math.max(1, Math.ceil(widthM / EXPLORE_CELL));
  const rows = Math.max(1, Math.ceil(heightM / EXPLORE_CELL));
  return { cols, rows, bits: new Uint8Array(Math.ceil((cols * rows) / 8)) };
}

export function isExplored(grid: ExploreGrid, cell: number): boolean {
  return cell >= 0 && cell < grid.cols * grid.rows && (grid.bits[cell >> 3]! & (1 << (cell & 7))) !== 0;
}

export function markExplored(grid: ExploreGrid, cell: number): void {
  if (cell >= 0 && cell < grid.cols * grid.rows) grid.bits[cell >> 3]! |= 1 << (cell & 7);
}

/** O quadradinho do ponto (x, y) em metros, ou -1 fora do mapa. */
export function cellAt(grid: ExploreGrid, x: number, y: number): number {
  const cx = Math.floor(x / EXPLORE_CELL);
  const cy = Math.floor(y / EXPLORE_CELL);
  return cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows ? -1 : cy * grid.cols + cx;
}

/** Marca os quadradinhos em volta do ponto (x, y); devolve os que eram novos. */
export function revealAround(grid: ExploreGrid, x: number, y: number, radius = EXPLORE_RADIUS): number[] {
  const fresh: number[] = [];
  const c0 = Math.max(0, Math.floor((x - radius) / EXPLORE_CELL));
  const c1 = Math.min(grid.cols - 1, Math.floor((x + radius) / EXPLORE_CELL));
  const r0 = Math.max(0, Math.floor((y - radius) / EXPLORE_CELL));
  const r1 = Math.min(grid.rows - 1, Math.floor((y + radius) / EXPLORE_CELL));
  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      // o quadradinho conta se o ponto mais perto dele estiver no raio
      const nx = Math.max(cx * EXPLORE_CELL, Math.min(x, (cx + 1) * EXPLORE_CELL));
      const ny = Math.max(cy * EXPLORE_CELL, Math.min(y, (cy + 1) * EXPLORE_CELL));
      if ((nx - x) ** 2 + (ny - y) ** 2 > radius * radius) continue;
      const cell = cy * grid.cols + cx;
      if (isExplored(grid, cell)) continue;
      markExplored(grid, cell);
      fresh.push(cell);
    }
  }
  return fresh;
}

/** A grade em texto (`colunas:base64`), para salvar e mandar ao navegador. */
export function encodeGrid(grid: ExploreGrid): string {
  let raw = '';
  for (const byte of grid.bits) raw += String.fromCharCode(byte);
  return `${grid.cols}:${btoa(raw)}`;
}

/**
 * Lê o texto salvo para um mapa com esse tamanho (metros). Se o mapa mudou de largura, cada quadradinho volta para o
 * mesmo lugar (linha e coluna); o que ficou fora do mapa novo some. Texto estragado: grade vazia.
 */
export function decodeGrid(text: string | null | undefined, widthM: number, heightM: number): ExploreGrid {
  const grid = exploreGrid(widthM, heightM);
  if (typeof text !== 'string') return grid;
  const sep = text.indexOf(':');
  const cols = Number(text.slice(0, sep));
  if (sep <= 0 || !Number.isInteger(cols) || cols <= 0 || cols > 10_000) return grid;
  let raw: string;
  try {
    raw = atob(text.slice(sep + 1));
  } catch {
    return grid;
  }
  const total = raw.length * 8;
  for (let i = 0; i < total; i++) {
    if ((raw.charCodeAt(i >> 3) & (1 << (i & 7))) === 0) continue;
    const cx = i % cols;
    const cy = Math.floor(i / cols);
    if (cx < grid.cols && cy < grid.rows) markExplored(grid, cy * grid.cols + cx);
  }
  return grid;
}

/** Quantos quadradinhos estão explorados. */
export function exploredCount(grid: ExploreGrid): number {
  let n = 0;
  for (const byte of grid.bits) {
    let b = byte;
    while (b) {
      n += b & 1;
      b >>= 1;
    }
  }
  return n;
}
