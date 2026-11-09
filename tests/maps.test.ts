// Camadas do mapa (sombras e "acima"), árvores grandes, postes altos, animações e luzes do tileset.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GameMap, type TiledMap } from '../src/shared/map';
import { BIG_TREES } from '../scripts/map-depth';
import { gid, IMAGE_HEIGHT, IMAGE_WIDTH, tiledTileset } from '../scripts/tileset';
import { tiledFromAscii } from './helpers';

const realMap = (id: string) => JSON.parse(readFileSync(`public/assets/maps/${id}.tmj`, 'utf8')) as TiledMap;
const layerData = (map: TiledMap, name: string) => map.layers.find((l) => l.name === name)?.data as number[];
const MAPS = ['refugio', 'santo-amaro'];

describe('camadas do mapa', () => {
  it('o que está na camada "acima" (copas) não bloqueia: dá para passar por baixo', () => {
    const json = tiledFromAscii(['....', '.#..'], { x: 0, y: 0 });
    // tile 5 (sem propriedades) na camada acima, em cima de um tile livre e do tile que bloqueia
    json.layers.push({ type: 'tilelayer', name: 'acima', data: [0, 5, 5, 0, 0, 5, 0, 0] });
    const map = GameMap.fromTiled(json);
    expect(map.isWalkable(1, 0)).toBe(true);
    expect(map.isWalkable(2, 0)).toBe(true);
    expect(map.isWalkable(1, 1)).toBe(false); // continua bloqueado pelo que está embaixo
  });

  it('nos mapas de verdade, nada na camada "acima" bloqueia e cada árvore grande tem copa e tronco', () => {
    const colliding = new Set(
      tiledTileset('')
        .tiles.filter((t) => t.properties?.some((p) => p.name === 'colide'))
        .map((t) => t.id + 1),
    );
    for (const id of MAPS) {
      const map = realMap(id);
      expect(
        map.layers.map((l) => l.name),
        id,
      ).toEqual(['ground', 'sombras', 'decor', 'acima', 'objects', 'monstros', 'saidas']);
      const above = layerData(map, 'acima');
      const decor = layerData(map, 'decor');
      expect(above.filter((g) => colliding.has(g)), `${id}: tile que bloqueia na camada acima`).toEqual([]);
      const at = (data: number[], x: number, y: number) => (x >= 0 && y >= 0 && x < map.width && y < map.height ? data[y * map.width + x] : undefined);
      let trees = 0;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          for (const kind of BIG_TREES) {
            if (at(decor, x, y) === gid(`${kind}_bl`)) {
              trees++;
              expect(at(decor, x + 1, y), `${id}: tronco em (${x},${y})`).toBe(gid(`${kind}_br`));
              expect(y, `${id}: árvore sem copa (tronco na primeira linha) em (${x},${y})`).toBeGreaterThanOrEqual(1);
              if (y >= 2) expect(at(above, x, y - 2), `${id}: copa da árvore em (${x},${y})`).toBe(gid(`${kind}_tl`));
              expect(at(above, x + 1, y - 1), `${id}: copa da árvore em (${x},${y})`).toBe(gid(`${kind}_mr`));
            }
            if (at(above, x, y) === gid(`${kind}_tl`)) expect(at(decor, x, y + 2), `${id}: copa sem tronco em (${x},${y})`).toBe(gid(`${kind}_bl`));
          }
        }
      }
      expect(trees, id).toBeGreaterThan(40);
    }
  });

  it('as animações e as luzes do tileset apontam para tiles que existem', () => {
    const tileset = tiledTileset('');
    const animated = tileset.tiles.filter((t) => t.animation);
    expect(animated.map((t) => t.id + 1)).toEqual(expect.arrayContaining([gid('water'), gid('dark_water'), gid('campfire')]));
    for (const tile of animated) {
      for (const frame of tile.animation!) {
        expect(frame.tileid).toBeGreaterThanOrEqual(0);
        expect(frame.tileid).toBeLessThan(tileset.tilecount);
        expect(frame.duration).toBeGreaterThan(0);
      }
    }
    const lights = tileset.tiles.filter((t) => t.properties?.some((p) => p.name === 'luz'));
    expect(lights.map((t) => t.id + 1)).toContain(gid('campfire'));
    for (const tile of lights) expect(tile.properties!.find((p) => p.name === 'luz')!.value).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a imagem dos tiles (public/assets/tiles.png) está em dia com scripts/tileset.ts (npm run gen:tiles)', () => {
    const png = readFileSync('public/assets/tiles.png');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([IMAGE_WIDTH, IMAGE_HEIGHT]);
    for (const id of MAPS) expect(realMap(id).tilesets[0], id).toMatchObject({ imagewidth: IMAGE_WIDTH, imageheight: IMAGE_HEIGHT });
  });
});
