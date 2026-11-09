import type { TiledMap } from '../src/shared/map';
import type { ServerMsg } from '../src/shared/protocol';

/**
 * Cria um mapa do Tiled a partir de "desenho" em texto: '.' é chão livre, '#' é parede.
 * Facilita escrever testes com mapas pequenos.
 */
export function tiledFromAscii(rows: string[], spawn?: { x: number; y: number }): TiledMap {
  const height = rows.length;
  const width = rows[0]!.length;
  const data = rows.join('').split('').map((c) => (c === '#' ? 2 : 1));
  return {
    width,
    height,
    tilewidth: 16,
    tileheight: 16,
    orientation: 'orthogonal',
    infinite: false,
    layers: [
      { type: 'tilelayer', name: 'ground', data },
      ...(spawn
        ? [
            {
              type: 'objectgroup',
              name: 'objects',
              objects: [{ id: 1, name: 'spawn', x: spawn.x * 16 + 8, y: spawn.y * 16 + 8, point: true }],
            },
          ]
        : []),
    ],
    tilesets: [
      { firstgid: 1, name: 'tiles', tiles: [{ id: 1, properties: [{ name: 'collides', type: 'bool', value: true }] }] },
    ],
  };
}

/** Conexão falsa que só guarda o que o mundo enviou. */
export class FakeConn {
  batches: ServerMsg[][] = [];

  send(batch: ServerMsg[]): void {
    this.batches.push([...batch]);
  }

  all(): ServerMsg[] {
    return this.batches.flat();
  }

  ofType<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }>[] {
    return this.all().filter((m): m is Extract<ServerMsg, { t: T }> => m.t === t);
  }

  clear(): void {
    this.batches = [];
  }
}

/** Relógio falso: o teste decide quanto tempo passou. */
export class FakeClock {
  constructor(public time = 1000) {}
  now = (): number => this.time;
  advance(ms: number): void {
    this.time += ms;
  }
}
