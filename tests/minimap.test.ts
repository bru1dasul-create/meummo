// Minimapa e mapa grande: o terreno sai das cores dos tiles (o que bloqueia fica mais escuro) e o nome de cada
// saída fica dentro do mapa, com a setinha apontando para fora.

import { readFileSync } from 'node:fs';
import pngjs from 'pngjs';
import { describe, expect, it } from 'vitest';
import { averageTileColors, exitLabel, terrainImage, tileSheetOf } from '../src/client/game/minimap';
import { GameMap, type TiledMap } from '../src/shared/map';
import { TILE_INDEX } from '../scripts/tileset';

const MAPS = ['refugio', 'santo-amaro', 'billings', 'terminal-santo-amaro', 'shopping-largo-treze'];
const realMap = (id: string) => JSON.parse(readFileSync(`public/assets/maps/${id}.tmj`, 'utf8')) as TiledMap;
const tilesPng = pngjs.PNG.sync.read(readFileSync('public/assets/tiles.png'));
const colorsFor = (json: TiledMap) => averageTileColors(tilesPng, tileSheetOf(json));
const brightness = (data: ArrayLike<number>, i: number) => data[i * 4]! + data[i * 4 + 1]! + data[i * 4 + 2]!;

describe('minimapa: cor dos tiles', () => {
  it('cada tile ganha a cor média dele: água é azul, grama é verde, e o chão cobre o tile inteiro', () => {
    const colors = colorsFor(realMap('refugio'));
    const color = (key: string) => Array.from(colors.subarray(TILE_INDEX[key]! * 4, TILE_INDEX[key]! * 4 + 4));
    const [wr, wg, wb, wCover] = color('water');
    expect(wb).toBeGreaterThan(wr! + 40);
    expect(wb).toBeGreaterThan(wg!);
    expect(wCover).toBe(1);
    const [gr, gg, gb] = color('grass');
    expect(gg).toBeGreaterThan(gr!);
    expect(gg).toBeGreaterThan(gb!);
    for (let i = 3; i < colors.length; i += 4) {
      expect(colors[i]).toBeGreaterThanOrEqual(0);
      expect(colors[i]).toBeLessThanOrEqual(1);
    }
  });
});

describe('minimapa: terreno dos mapas de verdade', () => {
  for (const id of MAPS) {
    it(`${id}: 1 pixel por tile, sem buraco, e o que bloqueia é mais escuro que o caminho`, () => {
      const json = realMap(id);
      const map = GameMap.fromTiled(json, id);
      const image = terrainImage(json, colorsFor(json), (x, y) => map.isWalkable(x, y), tileSheetOf(json).firstgid);
      expect(image.width).toBe(json.width);
      expect(image.height).toBe(json.height);
      let blocked = 0;
      let blockedLight = 0;
      let free = 0;
      let freeLight = 0;
      for (let i = 0; i < json.width * json.height; i++) {
        expect(image.data[i * 4 + 3]).toBe(255);
        expect(brightness(image.data, i)).toBeGreaterThan(0); // todo tile tem chão (nada fica preto)
        if (map.isWalkable(i % json.width, Math.floor(i / json.width))) {
          free++;
          freeLight += brightness(image.data, i);
        } else {
          blocked++;
          blockedLight += brightness(image.data, i);
        }
      }
      // na média, dá para ver por onde se anda: o caminho é bem mais claro que água, mata e paredes
      expect(freeLight / free).toBeGreaterThan((blockedLight / blocked) * 1.25);
    });
  }

  it('as copas (camada "acima") não entram: o caminho embaixo delas continua aparecendo', () => {
    const json = realMap('refugio');
    const map = GameMap.fromTiled(json, 'refugio');
    const colors = colorsFor(json);
    const walkable = (x: number, y: number) => map.isWalkable(x, y);
    const without = terrainImage(json, colors, walkable).data;
    const noCanopy = { ...json, layers: json.layers.filter((l) => l.name !== 'acima') };
    expect(Array.from(terrainImage(noCanopy, colors, walkable).data)).toEqual(Array.from(without));
  });
});

describe('mapa grande: nome das saídas', () => {
  it('fica dentro do mapa, com a setinha apontando para o lado da saída', () => {
    let total = 0;
    for (const id of MAPS) {
      const map = GameMap.fromTiled(realMap(id), id);
      for (const exit of map.exits) {
        const spot = exitLabel(exit, map.width, map.height);
        total++;
        expect(spot.x, `${id}: ${exit.label}`).toBeGreaterThan(0);
        expect(spot.x, `${id}: ${exit.label}`).toBeLessThan(map.width);
        expect(spot.y, `${id}: ${exit.label}`).toBeGreaterThan(0);
        expect(spot.y, `${id}: ${exit.label}`).toBeLessThan(map.height);
        expect(spot.text).toContain(exit.label);
        if (exit.x === 0) expect(spot.text.startsWith('◂')).toBe(true);
        else if (exit.x + exit.w >= map.width) expect(spot.text.endsWith('▸')).toBe(true);
      }
    }
    expect(total).toBeGreaterThanOrEqual(6); // as ligações entre os 5 mapas
  });
});
