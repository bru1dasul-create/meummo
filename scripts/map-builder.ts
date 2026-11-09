// Ajudas para gerar mapas do Tiled por código (usado por gen-santo-amaro.ts e pelos próximos geradores).
// O mapa sai no mesmo formato que o Tiled salva, pronto para ser editado à mão depois.

import { DepthLayers, depthTileLayers } from './map-depth';
import { mulberry32 } from './pixels';
import { gid, tiledTileset } from './tileset';

export interface PointObject {
  name: string;
  x: number;
  y: number;
}

export interface AreaObject {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  properties: { name: string; type: 'string' | 'int' | 'bool'; value: string | number | boolean }[];
}

export class MapBuilder {
  readonly ground: number[];
  readonly decor: number[];
  /** Lugares onde não deve nascer nada aleatório (ruas, prédios, entradas...). */
  readonly reserved: Uint8Array;
  readonly rng: () => number;
  /** Camadas "acima" (copas, alto dos postes) e "sombras". */
  readonly depth: DepthLayers;

  constructor(
    readonly W: number,
    readonly H: number,
    seed: number,
  ) {
    this.ground = new Array<number>(W * H).fill(0);
    this.decor = new Array<number>(W * H).fill(0);
    this.reserved = new Uint8Array(W * H);
    this.rng = mulberry32(seed);
    this.depth = new DepthLayers(W, H, this.decor);
  }

  idx(x: number, y: number): number {
    return y * this.W + x;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.W && y < this.H;
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rng() * list.length)]!;
  }

  setGround(x: number, y: number, key: string, reserve = true): void {
    if (!this.inside(x, y)) return;
    this.ground[this.idx(x, y)] = gid(key);
    if (reserve) this.reserved[this.idx(x, y)] = 1;
  }

  setDecor(x: number, y: number, key: string | null): void {
    if (this.inside(x, y)) this.decor[this.idx(x, y)] = key ? gid(key) : 0;
  }

  groundIs(x: number, y: number, ...keys: string[]): boolean {
    return this.inside(x, y) && keys.some((k) => this.ground[this.idx(x, y)] === gid(k));
  }

  hasDecor(x: number, y: number): boolean {
    return this.inside(x, y) && this.decor[this.idx(x, y)] !== 0;
  }

  isReserved(x: number, y: number): boolean {
    return !this.inside(x, y) || this.reserved[this.idx(x, y)] === 1;
  }

  reserve(x: number, y: number): void {
    if (this.inside(x, y)) this.reserved[this.idx(x, y)] = 1;
  }

  fill(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.inside(x, y)) fn(x, y);
  }

  /** Ruído suave entre 0 e 1 (para manchas com formato natural). */
  noise(cell: number): (x: number, y: number) => number {
    const gw = Math.ceil(this.W / cell) + 2;
    const gh = Math.ceil(this.H / cell) + 2;
    const grid = Array.from({ length: gw * gh }, () => this.rng());
    return (x, y) => {
      const gx = Math.max(0, x) / cell;
      const gy = Math.max(0, y) / cell;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const sx = (gx - x0) * (gx - x0) * (3 - 2 * (gx - x0));
      const sy = (gy - y0) * (gy - y0) * (3 - 2 * (gy - y0));
      const v = (i: number, j: number) => grid[(y0 + j) * gw + (x0 + i)]!;
      return (v(0, 0) * (1 - sx) + v(1, 0) * sx) * (1 - sy) + (v(0, 1) * (1 - sx) + v(1, 1) * sx) * sy;
    };
  }

  /** Monta o JSON no formato do Tiled (camadas ground, sombras, decor e acima; pontos, áreas de monstros e saídas). */
  toTiled(options: {
    properties: AreaObject['properties'];
    points: PointObject[];
    monsters: (AreaObject & { name: string })[];
    exits: AreaObject[];
  }) {
    let nextId = 1;
    const point = (p: PointObject) => ({
      id: nextId++,
      name: p.name,
      type: '',
      point: true,
      x: p.x * 16 + 8,
      y: p.y * 16 + 8,
      width: 0,
      height: 0,
      rotation: 0,
      visible: true,
    });
    const area = (a: AreaObject) => ({
      id: nextId++,
      name: a.name,
      type: '',
      x: a.x * 16,
      y: a.y * 16,
      width: a.w * 16,
      height: a.h * 16,
      rotation: 0,
      visible: true,
      properties: a.properties,
    });
    const group = (id: number, name: string, objects: unknown[]) => ({
      id,
      name,
      type: 'objectgroup',
      draworder: 'topdown',
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      objects,
    });
    const { shade, above } = depthTileLayers(this.depth);
    const layers = [
      { id: 1, name: 'ground', type: 'tilelayer', width: this.W, height: this.H, x: 0, y: 0, opacity: 1, visible: true, data: this.ground },
      shade,
      { id: 2, name: 'decor', type: 'tilelayer', width: this.W, height: this.H, x: 0, y: 0, opacity: 1, visible: true, data: this.decor },
      above,
      group(3, 'objects', options.points.map(point)),
      group(4, 'monstros', options.monsters.map(area)),
      group(5, 'saidas', options.exits.map(area)),
    ];
    return {
      compressionlevel: -1,
      height: this.H,
      width: this.W,
      infinite: false,
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tiledversion: '1.11.0',
      version: '1.10',
      type: 'map',
      tilewidth: 16,
      tileheight: 16,
      nextlayerid: 8,
      nextobjectid: nextId,
      properties: options.properties,
      layers,
      tilesets: [tiledTileset('../tiles.png')],
    };
  }
}
