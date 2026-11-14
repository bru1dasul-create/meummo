// Lê mapas feitos no Tiled (https://www.mapeditor.org/) e responde "dá pra andar aqui?".
// O cliente e o servidor carregam o MESMO arquivo de mapa, então concordam sobre as paredes.
//
// Convenções do nosso mapa no Tiled:
// - propriedade booleana `colide` no tile: bloqueia a passagem (água, árvore, parede...);
// - propriedade booleana `bloqueiaTiro` no tile: segura projéteis (árvore, pedra, parede — água não);
// - um objeto do tipo ponto chamado `spawn` marca onde os jogadores nascem;
// - numa camada de objetos chamada `monstros`, cada retângulo é uma área onde nascem monstros:
//   o nome do retângulo é o id do monstro (ex.: `jararaca`) e a propriedade `quantidade` diz quantos;
// - numa camada de objetos chamada `saidas`, cada retângulo leva para outro mapa: propriedade `mapa`
//   (o nome do arquivo, sem .tmj) e `chegada` (o nome do ponto onde você aparece no outro mapa);
// - pontos com nome (em qualquer camada de objetos) são lugares de chegada;
// - propriedades do mapa: `nome`, `seguro`, `inicial` (onde todo mundo começa) e `renascerEm`
//   (em que mapa acorda quem desmaia aqui; sem isso, no próprio mapa).
//
// Formato novo (mundo 2.5D, combinado com o [mundo]): tile de 32 px no Tiled, só como grade — 1 tile = 1 metro.
// - camada de objetos `colisao`: retângulos que bloqueiam o pé, exatos (tronco, poste, muro...). Propriedade
//   `bloqueiaTiro` (bool; sem ela, true). Só retângulos: elipse vale como o retângulo em volta e polígono dá
//   erro. Para os monstros e a busca de caminho, o tile que um retângulo toca fica bloqueado inteiro (monstro
//   nunca atravessa árvore);
// - camada de objetos `seguro`: retângulos de área segura (monstro não entra, não nota e não acerta quem está lá);
// - pontos com nome dizem onde fica o PÉ, exato (no formato antigo, o tile onde o ponto cai).

import { SHOT_FEET_DY, TILE_SIZE } from './constants';
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
  /** Tipo do objeto no Tiled ("Class"; nas versões antigas, "Type"). */
  type?: string;
  class?: string;
  /** Formas além do retângulo: elipse (dentro de x/y/width/height) e pontos relativos a x, y. */
  ellipse?: boolean;
  polygon?: { x: number; y: number }[];
  polyline?: { x: number; y: number }[];
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
  /** Propriedades do mapa no Tiled (Map > Map Properties): `nome` (texto) e `seguro` (sem PvP). */
  properties?: TiledProperty[];
  tilewidth: number;
  tileheight: number;
  orientation?: string;
  infinite?: boolean;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
}

/** Retângulo (em tiles = metros) que segura o pé: camada `colisao`. */
export interface SolidRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Segura projéteis também (`bloqueiaTiro`). */
  shot: boolean;
}

/** Retângulo (em tiles = metros) de área segura: camada `seguro`. */
export interface SafeArea {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  name: string;
}

/** O mínimo que movimento e busca de caminho precisam saber sobre um mapa. */
export interface Walkable {
  readonly width: number;
  readonly height: number;
  /** Tile livre para quem anda de tile em tile (monstros, busca de caminho). */
  isWalkable(x: number, y: number): boolean;
  /** Movimento livre: este tile bloqueia o pé inteiro (tile com `colide`, ou fora do mapa)? Sem isto: !isWalkable. */
  isSolidTile?(x: number, y: number): boolean;
  /** Movimento livre: os retângulos exatos (camada `colisao`) que encostam neste tile. */
  solidsAt?(x: number, y: number): readonly SolidRect[];
}

export interface Tile {
  x: number;
  y: number;
}

/** Área (em tiles) que leva para outro mapa. */
export interface MapExit {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Id do mapa de destino (nome do arquivo sem .tmj). */
  to: string;
  /** Nome do ponto de chegada no mapa de destino. */
  arrival: string;
  /** Placa mostrada no jogo (o nome do objeto no Tiled, ex.: "Ruínas de Santo Amaro"). */
  label: string;
}

/** Um retângulo com nome no mapa (em tiles = metros): de (x0, y0) a (x1, y1). */
export interface MapRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Um lugar com nome da camada `areas` (Vila do Capão, Mata Profunda, Lago do Parque...), em tiles = metros. `sound`: a
 * propriedade `som` do lugar (o som de ambiente: 'vila', 'mata'...), se o mapa disser; sem ela, vale o nome.
 */
export interface MapPlace extends MapRegion {
  name: string;
  sound: string | null;
}

/** Informações do mapa que vêm das propriedades e objetos do Tiled. */
export interface MapInfo {
  id?: string;
  name?: string;
  safe?: boolean;
  start?: boolean;
  respawnMap?: string | null;
  exits?: MapExit[];
  points?: ReadonlyMap<string, Tile>;
  /** Pontos com nome, exatos (em tiles = metros, com fração). */
  spots?: ReadonlyMap<string, { x: number; y: number }>;
  /** Retângulos com nome da camada `pontos` (ex.: `joaquim-casa`, por onde o gato da vó anda). */
  regions?: ReadonlyMap<string, MapRegion>;
  /** Os lugares com nome da camada `areas`. */
  places?: readonly MapPlace[];
  /** Formato novo: 1 tile = 1 metro e pontos/NPCs dizem onde fica o pé, exato. */
  metric?: boolean;
  /** Retângulos que seguram o pé (camada `colisao`). */
  solids?: SolidRect[];
  /** Áreas seguras (camada `seguro`). */
  safeAreas?: SafeArea[];
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
const NO_SOLIDS: readonly SolidRect[] = [];

function boolProp(props: TiledProperty[] | undefined, ...names: string[]): boolean {
  return props?.some((p) => names.includes(p.name) && p.value === true) ?? false;
}

export class GameMap implements Walkable {
  readonly width: number;
  readonly height: number;
  /** Onde os jogadores nascem (sempre um tile livre). */
  readonly spawn: Tile;
  readonly monsterZones: MonsterZone[];
  /** Nome da zona (propriedade `nome` do mapa). */
  readonly name: string;
  /** Zona segura (propriedade `seguro`): sem PvP. */
  readonly safe: boolean;
  /** Id do mapa: o nome do arquivo sem .tmj (ex.: 'refugio'). */
  readonly id: string;
  /** É aqui que os personagens novos começam (propriedade `inicial`). */
  readonly start: boolean;
  /** Em que mapa acorda quem desmaia aqui (propriedade `renascerEm`); null = neste mesmo. */
  readonly respawnMap: string | null;
  /** Saídas para outros mapas (camada `saidas`). */
  readonly exits: MapExit[];
  /** Pontos com nome (lugares de chegada). Os nomes ficam em minúsculas. */
  readonly points: ReadonlyMap<string, Tile>;
  /** Os mesmos pontos, exatos (com fração). */
  readonly spots: ReadonlyMap<string, { x: number; y: number }>;
  /** Retângulos com nome da camada `pontos` (em tiles = metros). Os nomes ficam em minúsculas. */
  readonly regions: ReadonlyMap<string, MapRegion>;
  /** Os lugares com nome da camada `areas` (para o som de ambiente de cada um). */
  readonly places: readonly MapPlace[];
  /** Formato novo (1 tile = 1 metro; pontos e NPCs dizem onde fica o pé, exato). */
  readonly metric: boolean;
  /** Áreas seguras (camada `seguro`). */
  readonly safeAreas: readonly SafeArea[];
  /** Tiles bloqueados para quem anda de tile em tile: os de `colide` e os que algum retângulo de `colisao` toca. */
  private readonly blocked: Uint8Array;
  /** Tiles bloqueados inteiros para o pé (só os de `colide`). */
  private readonly solidTiles: Uint8Array;
  /** Retângulos de `colisao` que encostam em cada tile. */
  private readonly solidsByTile: (SolidRect[] | undefined)[];
  private readonly cover: Uint8Array;
  /** Só os tiles com `bloqueiaTiro` (sem os retângulos de `colisao`): a pedra do mapa novo usa os retângulos exatos. */
  private readonly tileCover: Uint8Array;
  /** Tiles alcançáveis a pé a partir do ponto de nascimento (calculado na primeira consulta). */
  private reachable: Uint8Array | null = null;

  constructor(
    width: number,
    height: number,
    blocked: Uint8Array,
    spawnHint: Tile,
    cover: Uint8Array = new Uint8Array(width * height),
    monsterZones: MonsterZone[] = [],
    info: MapInfo = {},
  ) {
    this.name = info.name ?? 'Pindorama';
    this.safe = info.safe ?? false;
    this.id = info.id ?? 'mapa';
    this.start = info.start ?? false;
    this.respawnMap = info.respawnMap ?? null;
    this.exits = info.exits ?? [];
    this.points = info.points ?? new Map();
    this.spots = info.spots ?? new Map();
    this.regions = info.regions ?? new Map();
    this.places = info.places ?? [];
    this.metric = info.metric ?? false;
    this.safeAreas = info.safeAreas ?? [];
    this.width = width;
    this.height = height;
    this.solidTiles = blocked;
    this.blocked = new Uint8Array(blocked);
    this.tileCover = new Uint8Array(cover);
    this.cover = cover;
    this.solidsByTile = new Array(width * height);
    for (const rect of info.solids ?? []) {
      // o tile que o retângulo toca (com área) fica bloqueado para os monstros e, se segura tiro, para os projéteis
      for (let ty = Math.max(0, Math.floor(rect.y0)); ty <= Math.min(height - 1, Math.ceil(rect.y1) - 1); ty++) {
        for (let tx = Math.max(0, Math.floor(rect.x0)); tx <= Math.min(width - 1, Math.ceil(rect.x1) - 1); tx++) {
          const i = ty * width + tx;
          this.blocked[i] = 1;
          if (rect.shot) this.cover[i] = 1;
          (this.solidsByTile[i] ??= []).push(rect);
        }
      }
    }
    this.monsterZones = monsterZones;
    const spawn = this.nearestWalkable(spawnHint.x, spawnHint.y);
    if (!spawn) throw new Error('O mapa não tem nenhum tile livre perto do ponto de nascimento.');
    this.spawn = spawn;
  }

  /** `id` é o nome do arquivo sem .tmj (é por ele que as saídas de outros mapas chegam aqui). */
  static fromTiled(json: TiledMap, id = 'mapa'): GameMap {
    if (json.infinite) {
      throw new Error('Mapas infinitos não são suportados. No Tiled: Map > Map Properties > desmarque "Infinite".');
    }
    if (json.orientation && json.orientation !== 'orthogonal') {
      throw new Error('Só mapas ortogonais (quadriculados) são suportados.');
    }
    if (json.tilewidth !== json.tileheight || json.tilewidth <= 0) {
      throw new Error('Os tiles do mapa precisam ser quadrados (no Tiled: largura e altura do tile iguais).');
    }
    // Formato novo (mundo 2.5D): tile de 32 px só como grade, 1 tile = 1 metro, tudo em camadas de objetos.
    const metric = json.tilewidth !== TILE_SIZE;

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
    const exits: MapExit[] = [];
    const points = new Map<string, Tile>();
    const spots = new Map<string, { x: number; y: number }>();
    const regions = new Map<string, MapRegion>();
    const places: MapPlace[] = [];
    const solids: SolidRect[] = [];
    const safeAreas: SafeArea[] = [];
    const tw = json.tilewidth;
    const th = json.tileheight;
    /** O retângulo do objeto, em tiles (elipse: o retângulo em volta dela). */
    const rectOf = (obj: TiledObject) => ({ x0: obj.x / tw, y0: obj.y / th, x1: (obj.x + (obj.width ?? 0)) / tw, y1: (obj.y + (obj.height ?? 0)) / th });
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
        const layerName = layer.name.toLowerCase();
        const isMonsterLayer = layerName === 'monstros';
        const isExitLayer = layerName === 'saidas' || layerName === 'saídas';
        const isSolidLayer = layerName === 'colisao' || layerName === 'colisão';
        const isSafeLayer = layerName === 'seguro';
        const isPointsLayer = layerName === 'pontos';
        const isPlacesLayer = layerName === 'areas' || layerName === 'áreas';
        for (const obj of layer.objects ?? []) {
          const objName = obj.name?.trim().toLowerCase();
          if (isPlacesLayer && !obj.point && obj.name?.trim() && !obj.polygon && !obj.polyline) {
            const rect = rectOf(obj);
            const sound = obj.properties?.find((p) => p.name === 'som')?.value;
            if (rect.x1 > rect.x0 && rect.y1 > rect.y0) {
              places.push({ ...rect, name: obj.name.trim(), sound: typeof sound === 'string' && sound.trim() ? sound.trim().toLowerCase() : null });
            }
            continue;
          }
          if (obj.point && objName) {
            points.set(objName, { x: Math.floor(obj.x / json.tilewidth), y: Math.floor(obj.y / json.tileheight) });
            spots.set(objName, { x: obj.x / tw, y: obj.y / th });
          }
          if (isPointsLayer && !obj.point && objName && !obj.polygon && !obj.polyline) {
            const rect = rectOf(obj);
            if (rect.x1 > rect.x0 && rect.y1 > rect.y0) regions.set(objName, rect);
            continue;
          }
          if ((isSolidLayer || isSafeLayer) && (obj.polygon || obj.polyline)) {
            // sem isto o polígono sumiria calado (largura 0) e a parede ou a área segura não existiria no jogo
            throw new Error(`O objeto ${obj.id} da camada "${layer.name}" do mapa "${id}" é um polígono ou uma linha: essa camada só aceita retângulos.`);
          }
          if (isSolidLayer && !obj.point) {
            const rect = rectOf(obj);
            const shot = obj.properties?.find((p) => p.name === 'bloqueiaTiro')?.value;
            if (rect.x1 > rect.x0 && rect.y1 > rect.y0) solids.push({ ...rect, shot: shot !== false });
            continue;
          }
          if (isSafeLayer && !obj.point) {
            const rect = rectOf(obj);
            if (rect.x1 > rect.x0 && rect.y1 > rect.y0) safeAreas.push({ ...rect, name: obj.name?.trim() ?? '' });
            continue;
          }
          if (objName === 'spawn') {
            spawnHint = { x: Math.floor(obj.x / json.tilewidth), y: Math.floor(obj.y / json.tileheight) };
          } else if (isExitLayer && !obj.point) {
            const text = (name: string) => {
              const value = obj.properties?.find((p) => p.name === name)?.value;
              return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
            };
            const to = text('mapa');
            if (!to) throw new Error(`A saída "${obj.name ?? obj.id}" do mapa "${id}" precisa da propriedade "mapa" (para onde ela leva).`);
            const x0 = Math.max(0, Math.floor(obj.x / json.tilewidth));
            const y0 = Math.max(0, Math.floor(obj.y / json.tileheight));
            const x1 = Math.min(width - 1, Math.ceil((obj.x + (obj.width ?? 0)) / json.tilewidth) - 1);
            const y1 = Math.min(height - 1, Math.ceil((obj.y + (obj.height ?? 0)) / json.tileheight) - 1);
            if (x1 >= x0 && y1 >= y0) {
              exits.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, to, arrival: text('chegada') ?? 'spawn', label: obj.name?.trim() ?? '' });
            }
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

    const prop = (name: string) => json.properties?.find((p) => p.name === name)?.value;
    const mapName = prop('nome');
    const respawnMap = prop('renascerEm');
    return new GameMap(width, height, blocked, spawnHint ?? { x: width >> 1, y: height >> 1 }, cover, zones, {
      id,
      name: typeof mapName === 'string' && mapName.trim() ? mapName.trim() : undefined,
      safe: prop('seguro') === true,
      start: prop('inicial') === true,
      respawnMap: typeof respawnMap === 'string' && respawnMap.trim() ? respawnMap.trim().toLowerCase() : null,
      exits,
      points,
      spots,
      regions,
      places,
      metric,
      solids,
      safeAreas,
    });
  }

  /** O lugar com nome (camada `areas`) onde fica o ponto (x, y): o menor que contém o ponto (o mais específico). */
  placeAt(x: number, y: number): MapPlace | null {
    let best: MapPlace | null = null;
    let bestArea = Infinity;
    for (const place of this.places) {
      if (x < place.x0 || x > place.x1 || y < place.y0 || y > place.y1) continue;
      const area = (place.x1 - place.x0) * (place.y1 - place.y0);
      if (area < bestArea) {
        best = place;
        bestArea = area;
      }
    }
    return best;
  }

  inside(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isWalkable(x: number, y: number): boolean {
    return this.inside(x, y) && this.blocked[y * this.width + x] === 0;
  }

  /** Movimento livre: o tile bloqueia o pé inteiro (tile com `colide`, ou fora do mapa)? */
  isSolidTile(x: number, y: number): boolean {
    return !this.inside(x, y) || this.solidTiles[y * this.width + x] === 1;
  }

  /** Movimento livre: os retângulos exatos (camada `colisao`) que encostam neste tile. */
  solidsAt(x: number, y: number): readonly SolidRect[] {
    if (!this.inside(x, y)) return NO_SOLIDS;
    return this.solidsByTile[y * this.width + x] ?? NO_SOLIDS;
  }

  /** Este ponto (em tiles, com fração) está numa área segura? */
  isSafeAt(x: number, y: number): boolean {
    return this.safeAreas.some((a) => x >= a.x0 && x < a.x1 && y >= a.y0 && y < a.y1);
  }

  /** Este tile encosta numa área segura? (Monstro não entra.) */
  touchesSafeArea(x: number, y: number): boolean {
    return this.safeAreas.some((a) => x + 1 > a.x0 && x < a.x1 && y + 1 > a.y0 && y < a.y1);
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

  /** A saída que cobre este tile (ou null). */
  exitAt(x: number, y: number): MapExit | null {
    return this.exits.find((e) => x >= e.x && y >= e.y && x < e.x + e.w && y < e.y + e.h) ?? null;
  }

  /** Projéteis param aqui? (fora do mapa, ou tile com `bloqueiaTiro`.) */
  blocksShot(x: number, y: number): boolean {
    return !this.inside(x, y) || this.cover[y * this.width + x] === 1;
  }

  /**
   * A pedra no ponto exato (x, y) bate em algo? No formato novo, pelo retângulo de verdade (um tronco de 0,3 m segura
   * a pedra só nos 0,3 m dele, não no metro inteiro), olhando o ponto do chão embaixo da pedra (SHOT_FEET_DY). No
   * formato antigo, continua o tile inteiro.
   */
  blocksShotAt(x: number, y: number): boolean {
    if (!this.metric) return this.blocksShot(Math.floor(x), Math.floor(y));
    const gy = y + SHOT_FEET_DY;
    const tx = Math.floor(x);
    const ty = Math.floor(gy);
    if (!this.inside(tx, ty)) return true;
    const i = ty * this.width + tx;
    if (this.tileCover[i] === 1) return true;
    for (const r of this.solidsByTile[i] ?? NO_SOLIDS) {
      if (r.shot && x > r.x0 && x < r.x1 && gy > r.y0 && gy < r.y1) return true;
    }
    return false;
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
