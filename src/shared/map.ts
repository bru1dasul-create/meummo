// Lê mapas feitos no Tiled (https://www.mapeditor.org/) e responde "dá pra andar aqui?".
// O cliente e o servidor carregam o MESMO arquivo de mapa, então concordam sobre as paredes.
//
// Convenções do nosso mapa no Tiled:
// - propriedade booleana `colide` no tile: bloqueia a passagem (água, árvore, parede...);
// - propriedade booleana `bloqueiaTiro` no tile: segura projéteis (árvore, pedra, parede — água não);
// - um objeto do tipo ponto chamado `spawn` marca onde os jogadores nascem;
// - numa camada de objetos chamada `monstros`, cada retângulo é uma área onde nascem monstros:
//   o nome do retângulo é o id do monstro (ex.: `jararaca`) e a propriedade `quantidade` diz quantos.

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
  width?: number;
  height?: number;
  point?: boolean;
  properties?: TiledProperty[];
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

/** Área (em tiles) onde nascem monstros de um tipo. */
export interface MonsterZone {
  monster: string;
  x: number;
  y: number;
  w: number;
  h: number;
  count: number;
}

/** O Tiled guarda espelhamento/rotação nos bits altos do número do tile. */
const GID_MASK = 0x0fffffff;

function boolProp(props: TiledProperty[] | undefined, ...names: string[]): boolean {
  return props?.some((p) => names.includes(p.name) && p.value === true) ?? false;
}

export class GameMap implements Walkable {
  readonly width: number;
  readonly height: number;
  /** Onde os jogadores nascem (sempre um tile livre). */
  readonly spawn: Tile;
  readonly monsterZones: MonsterZone[];
  private readonly blocked: Uint8Array;
  private readonly cover: Uint8Array;
  /** Tiles alcançáveis a pé a partir do ponto de nascimento (calculado na primeira consulta). */
  private reachable: Uint8Array | null = null;

  constructor(
    width: number,
    height: number,
    blocked: Uint8Array,
    spawnHint: Tile,
    cover: Uint8Array = new Uint8Array(width * height),
    monsterZones: MonsterZone[] = [],
  ) {
    this.width = width;
    this.height = height;
    this.blocked = blocked;
    this.cover = cover;
    this.monsterZones = monsterZones;
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
    const shotBlocking = new Set<number>();
    for (const tileset of json.tilesets) {
      if (tileset.source) {
        throw new Error(
          `O tileset "${tileset.source}" é externo. No Tiled, incorpore ele ao mapa (botão "Embed Tileset").`,
        );
      }
      for (const tile of tileset.tiles ?? []) {
        const gid = tileset.firstgid + tile.id;
        if (boolProp(tile.properties, 'colide', 'collides')) colliding.add(gid);
        if (boolProp(tile.properties, 'bloqueiaTiro')) shotBlocking.add(gid);
      }
    }

    const blocked = new Uint8Array(width * height);
    const cover = new Uint8Array(width * height);
    const zones: MonsterZone[] = [];
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
        layer.data.forEach((raw, i) => {
          const gid = raw & GID_MASK;
          if (colliding.has(gid)) blocked[i] = 1;
          if (shotBlocking.has(gid)) cover[i] = 1;
        });
      } else if (layer.type === 'objectgroup') {
        const isMonsterLayer = layer.name.toLowerCase() === 'monstros';
        for (const obj of layer.objects ?? []) {
          if (obj.name?.toLowerCase() === 'spawn') {
            spawnHint = { x: Math.floor(obj.x / json.tilewidth), y: Math.floor(obj.y / json.tileheight) };
          } else if (isMonsterLayer && obj.name && !obj.point) {
            const x0 = Math.max(0, Math.floor(obj.x / json.tilewidth));
            const y0 = Math.max(0, Math.floor(obj.y / json.tileheight));
            const x1 = Math.min(width - 1, Math.ceil((obj.x + (obj.width ?? 0)) / json.tilewidth) - 1);
            const y1 = Math.min(height - 1, Math.ceil((obj.y + (obj.height ?? 0)) / json.tileheight) - 1);
            const amount = obj.properties?.find((p) => p.name === 'quantidade')?.value;
            if (x1 >= x0 && y1 >= y0) {
              zones.push({
                monster: obj.name.trim().toLowerCase(),
                x: x0,
                y: y0,
                w: x1 - x0 + 1,
                h: y1 - y0 + 1,
                count: typeof amount === 'number' && amount > 0 ? Math.floor(amount) : 1,
              });
            }
          }
        }
      }
    }

    return new GameMap(width, height, blocked, spawnHint ?? { x: width >> 1, y: height >> 1 }, cover, zones);
  }

  inside(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isWalkable(x: number, y: number): boolean {
    return this.inside(x, y) && this.blocked[y * this.width + x] === 0;
  }

  /** Dá para chegar a pé até aqui saindo do ponto de nascimento? (Evita monstros presos em bolsões.) */
  isReachable(x: number, y: number): boolean {
    if (!this.reachable) {
      this.reachable = new Uint8Array(this.width * this.height);
      const stack: Tile[] = [this.spawn];
      this.reachable[this.spawn.y * this.width + this.spawn.x] = 1;
      while (stack.length > 0) {
        const tile = stack.pop()!;
        for (let d = 0; d < 4; d++) {
          const nx = tile.x + DX[d];
          const ny = tile.y + DY[d];
          if (this.isWalkable(nx, ny) && !this.reachable[ny * this.width + nx]) {
            this.reachable[ny * this.width + nx] = 1;
            stack.push({ x: nx, y: ny });
          }
        }
      }
    }
    return this.inside(x, y) && this.reachable[y * this.width + x] === 1;
  }

  /** Projéteis param aqui? (fora do mapa, ou tile com `bloqueiaTiro`.) */
  blocksShot(x: number, y: number): boolean {
    return !this.inside(x, y) || this.cover[y * this.width + x] === 1;
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
