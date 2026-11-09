// Camadas do mapa (sombras e "acima"), árvores grandes, postes altos, animações e luzes do tileset.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadMonsterDefs } from '../src/server/monsters';
import { GameMap, type TiledMap } from '../src/shared/map';
import { findPath } from '../src/shared/pathfind';
import { BIG_TREES } from '../scripts/map-depth';
import { gid, IMAGE_HEIGHT, IMAGE_WIDTH, tiledTileset } from '../scripts/tileset';
import { tiledFromAscii } from './helpers';

const realMap = (id: string) => JSON.parse(readFileSync(`public/assets/maps/${id}.tmj`, 'utf8')) as TiledMap;
const layerData = (map: TiledMap, name: string) => map.layers.find((l) => l.name === name)?.data as number[];
const MAPS = ['refugio', 'santo-amaro', 'billings', 'terminal-santo-amaro', 'shopping-largo-treze'];
/** Mínimo de árvores grandes de cada mapa (a cidade tem poucas; dentro do shopping, só as do jardim do átrio). */
const MIN_TREES: Record<string, number> = { 'terminal-santo-amaro': 4, 'shopping-largo-treze': 2 };

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
        map.layers.map((l) => l.name).slice(0, 7),
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
      expect(trees, id).toBeGreaterThan(MIN_TREES[id] ?? 40);
    }
  });

  it('no Refúgio, a areia que encosta na água tem beirada suave (nenhum degrau quadrado sobrou)', () => {
    const map = realMap('refugio');
    const ground = layerData(map, 'ground');
    const water = new Set(['water', 'water_sparkle', 'dark_water', 'water_posts'].map((k) => gid(k)));
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < map.width && y < map.height ? ground[y * map.width + x] : 0);
    const steps: string[] = [];
    let shore = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const g = at(x, y);
        if (g !== gid('sand')) {
          if (g && g >= gid('shore_1') && g <= gid('shore_c_nw')) shore++;
          continue;
        }
        if ([at(x, y - 1), at(x + 1, y), at(x, y + 1), at(x - 1, y)].some((n) => n !== undefined && water.has(n))) steps.push(`(${x},${y})`);
      }
    }
    expect(steps).toEqual([]);
    expect(shore).toBeGreaterThan(100);
  });

  it('a Billings liga com o Refúgio e é a casa dos jacarés, dos botos e da Iara (a chefe, na prainha)', () => {
    const billings = realMap('billings');
    const refugio = realMap('refugio');
    const objects = (map: TiledMap, layer: string) => map.layers.find((l) => l.name === layer)?.objects ?? [];
    const prop = (obj: { properties?: { name: string; value: unknown }[] }, name: string) => obj.properties?.find((p) => p.name === name)?.value;
    expect(objects(refugio, 'saidas').map((e) => [prop(e, 'mapa'), prop(e, 'chegada')])).toContainEqual(['billings', 'norte']);
    expect(objects(billings, 'saidas').map((e) => [prop(e, 'mapa'), prop(e, 'chegada')])).toEqual([['refugio', 'sul']]);
    const monsters = loadMonsterDefs();
    const areas = objects(billings, 'monstros');
    expect(areas.length).toBeGreaterThanOrEqual(5);
    for (const area of areas) expect(monsters.has(area.name!), area.name).toBe(true);
    // as lendas de lá já existem e moram lá (antes ficavam marcadas numa camada "lendas", que o servidor ignora)
    expect(areas.map((a) => a.name)).toEqual(expect.arrayContaining(['jacare', 'boto', 'iara']));
    expect(objects(billings, 'lendas')).toEqual([]);
    const map = GameMap.fromTiled(billings, 'billings');
    expect(map).toMatchObject({ name: 'Represa Billings', safe: false, respawnMap: 'refugio' });
    // a Iara é uma só (a chefe) e dá para chegar a pé na prainha dela
    const iara = map.monsterZones.filter((z) => z.monster === 'iara');
    expect(iara.map((z) => z.count)).toEqual([1]);
    let beach = 0;
    for (let y = iara[0]!.y; y < iara[0]!.y + iara[0]!.h; y++) for (let x = iara[0]!.x; x < iara[0]!.x + iara[0]!.w; x++) if (map.isReachable(x, y)) beach++;
    expect(beach).toBeGreaterThan(40);
  });

  it('o Terminal Santo Amaro liga com Santo Amaro (pela rua do meio, ao sul) e tem as quatro plataformas', () => {
    const terminal = realMap('terminal-santo-amaro');
    const santoAmaro = realMap('santo-amaro');
    const objects = (map: TiledMap, layer: string) => map.layers.find((l) => l.name === layer)?.objects ?? [];
    const prop = (obj: { properties?: { name: string; value: unknown }[] }, name: string) => obj.properties?.find((p) => p.name === name)?.value;
    expect(objects(santoAmaro, 'saidas').map((e) => [prop(e, 'mapa'), prop(e, 'chegada')])).toContainEqual(['terminal-santo-amaro', 'norte']);
    expect(objects(terminal, 'saidas').map((e) => [prop(e, 'mapa'), prop(e, 'chegada')])).toEqual([['santo-amaro', 'sul']]);
    const above = layerData(terminal, 'acima');
    for (const letter of ['a', 'b', 'c', 'd']) expect(above, `plataforma ${letter}`).toContain(gid(`terminal_roof_front_${letter}`));
    const monsters = loadMonsterDefs();
    for (const area of objects(terminal, 'monstros')) expect(monsters.has(area.name!), area.name).toBe(true);
    expect(GameMap.fromTiled(terminal, 'terminal-santo-amaro')).toMatchObject({ name: 'Terminal Santo Amaro', safe: false, respawnMap: 'refugio' });
  });

  it('o Shopping do Largo Treze liga com Santo Amaro (pela porta de vidro do prédio do largo) e dá para entrar em toda loja', () => {
    const shopping = realMap('shopping-largo-treze');
    const santoAmaro = realMap('santo-amaro');
    const objects = (map: TiledMap, layer: string) => map.layers.find((l) => l.name === layer)?.objects ?? [];
    const prop = (obj: { properties?: { name: string; value: unknown }[] }, name: string) => obj.properties?.find((p) => p.name === name)?.value;
    const toMall = objects(santoAmaro, 'saidas').find((e) => prop(e, 'mapa') === 'shopping-largo-treze')!;
    expect(prop(toMall, 'chegada')).toBe('entrada');
    // a saída fica em cima da porta de vidro da fachada (o resto da fachada bloqueia)
    const saDecor = layerData(santoAmaro, 'decor');
    for (let x = toMall.x / 16; x < (toMall.x + toMall.width!) / 16; x++) {
      expect(saDecor[(toMall.y / 16) * santoAmaro.width + x], `porta em x=${x}`).toBe(gid('mall_front_door'));
    }
    expect(objects(shopping, 'saidas').map((e) => [prop(e, 'mapa'), prop(e, 'chegada')])).toEqual([['santo-amaro', 'shopping']]);
    const above = layerData(shopping, 'acima');
    const decor = layerData(shopping, 'decor');
    for (let i = 1; i <= 4; i++) expect(above, 'letreiro do cinema').toContain(gid(`cinema_sign_${i}`));
    for (const key of ['shelf', 'checkout', 'food_table', 'cinema_seats', 'mall_fountain_tl', 'escalator_tl']) expect(decor, key).toContain(gid(key));
    const monsters = loadMonsterDefs();
    for (const area of objects(shopping, 'monstros')) expect(monsters.has(area.name!), area.name).toBe(true);
    const map = GameMap.fromTiled(shopping, 'shopping-largo-treze');
    expect(map).toMatchObject({ name: 'Shopping do Largo Treze', safe: false, respawnMap: 'refugio' });
    // cada porta de loja: dá para passar por ela e por baixo do letreiro, chegando lá dentro
    let doors = 0;
    decor.forEach((g, i) => {
      if (g !== gid('store_door')) return;
      doors++;
      const x = i % shopping.width;
      const y = Math.floor(i / shopping.width);
      for (const dy of [1, 0, -1, -2]) expect(map.isWalkable(x, y + dy) && map.isReachable(x, y + dy), `porta (${x},${y}), dy=${dy}`).toBe(true);
    });
    expect(doors).toBeGreaterThanOrEqual(30); // 12 lojas, o supermercado (2 portas) e o cinema, com 2 tiles cada
    // e nenhum pedaço de chão ficou preso (sem caminho até a entrada)
    const stuck: string[] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (map.isWalkable(x, y) && !map.isReachable(x, y)) stuck.push(`(${x},${y})`);
    expect(stuck).toEqual([]);
  });

  it('do deck da fogueira dá para ir direto aos decks dos lados e aos píeres (sem dar a volta no lago)', () => {
    const map = GameMap.fromTiled(realMap('refugio'), 'refugio');
    for (const [label, x, y] of [
      ['deck oeste', 29, 26],
      ['deck leste', 55, 26],
      ['píer oeste', 24, 26],
      ['píer leste', 60, 26],
    ] as const) {
      const steps = findPath(map, map.spawn.x, map.spawn.y, x, y, map.width * map.height * 2);
      expect(steps?.length ?? Infinity, label).toBeLessThan(30);
    }
  });

  it('todo NPC de data/npcs.json tem lugar no mapa dele (livre e alcançável a pé)', () => {
    const npcs = JSON.parse(readFileSync('data/npcs.json', 'utf8')) as Record<string, { mapa: string; x: number; y: number }>;
    for (const [id, npc] of Object.entries(npcs)) {
      const map = GameMap.fromTiled(realMap(npc.mapa), npc.mapa);
      expect(map.isWalkable(npc.x, npc.y) && map.isReachable(npc.x, npc.y), `${id} em (${npc.x}, ${npc.y})`).toBe(true);
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
