import type { MonsterZone, TiledMap } from '../src/shared/map';
import type { ServerMsg } from '../src/shared/protocol';

/**
 * Cria um mapa do Tiled a partir de "desenho" em texto, para testes com mapas pequenos:
 * '.' chão livre, '#' parede (bloqueia passagem e tiros), '~' água (bloqueia passagem, mas não tiros).
 */
export type TestZone = Omit<MonsterZone, 'count'> & { count?: number };

export function tiledFromAscii(rows: string[], spawn?: { x: number; y: number }, zones: TestZone[] = []): TiledMap {
  const height = rows.length;
  const width = rows[0]!.length;
  const data = rows
    .join('')
    .split('')
    .map((c) => (c === '#' ? 2 : c === '~' ? 3 : 1));
  const objects = spawn ? [{ id: 1, name: 'spawn', x: spawn.x * 16 + 8, y: spawn.y * 16 + 8, point: true }] : [];
  return {
    width,
    height,
    tilewidth: 16,
    tileheight: 16,
    orientation: 'orthogonal',
    infinite: false,
    layers: [
      { type: 'tilelayer', name: 'ground', data },
      { type: 'objectgroup', name: 'objects', objects },
      {
        type: 'objectgroup',
        name: 'monstros',
        objects: zones.map((z, i) => ({
          id: 100 + i,
          name: z.monster,
          x: z.x * 16,
          y: z.y * 16,
          width: z.w * 16,
          height: z.h * 16,
          properties: [{ name: 'quantidade', type: 'int', value: z.count ?? 1 }],
        })),
      },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'tiles',
        tiles: [
          {
            id: 1,
            properties: [
              { name: 'colide', type: 'bool', value: true },
              { name: 'bloqueiaTiro', type: 'bool', value: true },
            ],
          },
          { id: 2, properties: [{ name: 'colide', type: 'bool', value: true }] },
        ],
      },
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
