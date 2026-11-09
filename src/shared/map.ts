// Lê mapas feitos no Tiled (https://www.mapeditor.org/) e responde "dá pra andar aqui?".
// O cliente e o servidor carregam o MESMO arquivo de mapa, então concordam sobre as paredes.
//
// Convenções do nosso mapa no Tiled:
// - tiles com a propriedade booleana `collides = true` bloqueiam a passagem (água, árvore, parede...);
// - um objeto do tipo ponto chamado `spawn` marca onde os jogadores nascem.

import { TILE_SIZE } from './constants';
import { DX, DY } from './dir';

// Só os pedaços do formato JSON do Tiled que usamos.
export interface TiledProperty {
  name: string;
  type?: string;
  value: unknown;
}
export interface TiledTile {
  id: number;
  properties?: TiledProperty[];
}
export interface TiledTileset {
  firstgid: number;
  name?: string;
  source?: string;
  tiles?: TiledTile[];
}
export interface TiledObject {
  id: number;
  name?: string;
  x: number;
  y: number;
  point?: boolean;
}
export interface TiledLayer {
  type: string;
  name: string;
  data?: number[] | string;
  objects?: TiledObject[];
  layers?: TiledLayer[];
}
export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  orientation?: string;
  infinite?: boolean;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
}

/** O mínimo que movimento e busca de caminho precisam saber sobre um mapa. */
export interface Walkable {
  readonly width: number;
  readonly height: number;
  isWalkable(x: number, y: number): boolean;
}

export interface Tile {
  x: number;
  y: number;
}

/** O Tiled guarda espelhamento/rotação nos bits altos do número do tile. */
const GID_MASK = 0x0fffffff;

export class GameMap implements Walkable {
  readonly width: number;
  readonly height: number;
  /** Onde os jogadores nascem (sempre um tile livre). */
  readonly spawn: Tile;
  private readonly blocked: Uint8Array;

  constructor(width: number, height: number, blocked: Uint8Array, spawnHint: Tile) {
    this.width = width;
    this.height = height;
    this.blocked = blocked;
    const spawn = this.nearestWalkable(spawnHint.x, spawnHint.y);
    if (!spawn) throw new Error('O mapa não tem nenhum tile livre perto do ponto de nascimento.');
    this.spawn = spawn;
  }

  static fromTiled(json: TiledMap): GameMap {
    if (json.infinite) {
      throw new Error('Mapas infinitos não são suportados. No Tiled: Map > Map Properties > desmarque "Infinite".');
    }
    if (json.orientation && json.orientation !== 'orthogonal') {
      throw new Error('Só mapas ortogonais (quadriculados) são suportados.');
    }
    if (json.tilewidth !== TILE_SIZE || json.tileheight !== TILE_SIZE) {
      throw new Error(`Os tiles do mapa precisam ter ${TILE_SIZE}x${TILE_SIZE} pixels.`);
    }

    const { width, height } = json;
    const colliding = new Set<number>();
    for (const tileset of json.tilesets) {
      if (tileset.source) {
        throw new Error(
          `O tileset "${tileset.source}" é externo. No Tiled, incorpore ele ao mapa (botão "Embed Tileset").`,
        );
      }
      for (const tile of tileset.tiles ?? []) {
        if (tile.properties?.some((p) => p.name === 'collides' && p.value === true)) {
          colliding.add(tileset.firstgid + tile.id);
        }
      }
    }

    const blocked = new Uint8Array(width * height);
    let spawnHint: Tile | null = null;
    const pending = [...json.layers];
    while (pending.length > 0) {
      const layer = pending.pop()!;
      if (layer.type === 'group') {
        pending.push(...(layer.layers ?? []));
      } else if (layer.type === 'tilelayer') {
        if (!Array.isArray(layer.data)) {
          throw new Error(
            `A camada "${layer.name}" precisa ser salva em CSV. No Tiled: Map > Map Properties > Tile Layer Format = CSV.`,
          );
        }
        if (layer.data.length !== width * height) {
          throw new Error(`A camada "${layer.name}" não tem o mesmo tamanho do mapa.`);
        }
        layer.data.forEach((gid, i) => {
          if (colliding.has(gid & GID_MASK)) blocked[i] = 1;
        });
      } else if (layer.type === 'objectgroup') {
        for (const obj of layer.objects ?? []) {
          if (obj.name?.toLowerCase() === 'spawn') {
            spawnHint = { x: Math.floor(obj.x / json.tilewidth), y: Math.floor(obj.y / json.tileheight) };
          }
        }
      }
    }

    return new GameMap(width, height, blocked, spawnHint ?? { x: width >> 1, y: height >> 1 });
  }

  inside(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isWalkable(x: number, y: number): boolean {
    return this.inside(x, y) && this.blocked[y * this.width + x] === 0;
  }

  /** Procura o tile livre mais próximo (busca em largura, passando por cima de obstáculos). */
  nearestWalkable(x: number, y: number, maxDistance = 64): Tile | null {
    const sx = Math.min(Math.max(Math.round(x), 0), this.width - 1);
    const sy = Math.min(Math.max(Math.round(y), 0), this.height - 1);
    const seen = new Uint8Array(this.width * this.height);
    let frontier: Tile[] = [{ x: sx, y: sy }];
    seen[sy * this.width + sx] = 1;
    for (let distance = 0; distance <= maxDistance && frontier.length > 0; distance++) {
      const next: Tile[] = [];
      for (const tile of frontier) {
        if (this.isWalkable(tile.x, tile.y)) return tile;
        for (let d = 0; d < 4; d++) {
          const nx = tile.x + DX[d];
          const ny = tile.y + DY[d];
          if (this.inside(nx, ny) && !seen[ny * this.width + nx]) {
            seen[ny * this.width + nx] = 1;
            next.push({ x: nx, y: ny });
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  /** Tiles livres alcançáveis a pé a partir de (x, y), até `radius` passos de distância. */
  walkableAround(x: number, y: number, radius: number): Tile[] {
    if (!this.isWalkable(x, y)) return [];
    const result: Tile[] = [{ x, y }];
    const seen = new Set<number>([y * this.width + x]);
    let frontier: Tile[] = [{ x, y }];
    for (let distance = 1; distance <= radius; distance++) {
      const next: Tile[] = [];
      for (const tile of frontier) {
        for (let d = 0; d < 4; d++) {
          const nx = tile.x + DX[d];
          const ny = tile.y + DY[d];
          const key = ny * this.width + nx;
          if (!seen.has(key) && this.isWalkable(nx, ny)) {
            seen.add(key);
            next.push({ x: nx, y: ny });
          }
        }
      }
      result.push(...next);
      frontier = next;
    }
    return result;
  }
}
