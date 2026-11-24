// A Caverna Sagrada por dentro (24/11, o dono: "pode fazer a caverna por dentro"): o mapa `caverna`, o de dentro da caverna
// do sudoeste do Guarapiranga (scripts/gen-caverna.ts). Entra-se pela boca e sai-se pela ponta sul do túnel; dentro,
// o Salão das Inscrições (os pilares gravados, a Pedra Ancestral e o poço da luz) e a Toca da Cuca (o caldeirão).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GameMap, type TiledMap } from '../src/shared/map';

interface TiledObject {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  properties?: { name: string; value: string | number | boolean }[];
}
const FILE = 'public/assets/maps-iso/caverna.tmj';
const map = JSON.parse(readFileSync(FILE, 'utf8')) as { width: number; height: number; tilewidth: number; layers: { name: string; objects: TiledObject[] }[] };
const M = map.tilewidth;
const layer = (name: string) => map.layers.find((l) => l.name === name)?.objects ?? [];
const prop = (o: TiledObject, name: string) => o.properties?.find((p) => p.name === name)?.value;
const at = (o: TiledObject) => (o.point ? { x: o.x / M, y: o.y / M } : { x: (o.x + o.width / 2) / M, y: (o.y + o.height / 2) / M });
const named = (layerName: string, name: string) => layer(layerName).find((o) => o.name === name)!;
const game = GameMap.fromTiled(map as unknown as TiledMap, 'caverna');

/** Onde o pé (0,6 × 0,4 m) cabe, numa grade de 0,25 m, e por onde ele vai a partir de um ponto. */
const STEP = 0.25;
const COLS = Math.round(map.width / STEP), ROWS = Math.round(map.height / STEP);
const boxes = layer('colisao').map((o) => ({ x0: o.x / M, y0: o.y / M, x1: (o.x + o.width) / M, y1: (o.y + o.height) / M }));
const blocked = new Uint8Array(COLS * ROWS);
for (const b of boxes) {
  for (let j = Math.max(0, Math.floor((b.y0 - 0.2) / STEP) - 1); j <= Math.min(ROWS - 1, Math.ceil((b.y1 + 0.2) / STEP) + 1); j++) {
    for (let i = Math.max(0, Math.floor((b.x0 - 0.3) / STEP) - 1); i <= Math.min(COLS - 1, Math.ceil((b.x1 + 0.3) / STEP) + 1); i++) {
      const [x, y] = [i * STEP, j * STEP];
      if (x - 0.3 < b.x1 && x + 0.3 > b.x0 && y - 0.2 < b.y1 && y + 0.2 > b.y0) blocked[j * COLS + i] = 1;
    }
  }
}
function flood(sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(COLS * ROWS);
  const queue: number[] = [Math.round(sy / STEP) * COLS + Math.round(sx / STEP)];
  seen[queue[0]!] = 1;
  while (queue.length) {
    const cell = queue.pop()!;
    const [i, j] = [cell % COLS, Math.floor(cell / COLS)];
    for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as const) {
      if (ni < 1 || nj < 1 || ni >= COLS - 1 || nj >= ROWS) continue;
      const k = nj * COLS + ni;
      if (seen[k] || blocked[k]) continue;
      seen[k] = 1;
      queue.push(k);
    }
  }
  return seen;
}
const ARRIVAL = at(named('pontos', 'chegada-guarapiranga'));
const seen = flood(ARRIVAL.x, ARRIVAL.y);
const reachNear = (x: number, y: number, r: number) => {
  for (let dx = -r; dx <= r; dx += STEP) for (let dy = -r; dy <= r; dy += STEP) if (Math.hypot(dx, dy) <= r && seen[Math.round((y + dy) / STEP) * COLS + Math.round((x + dx) / STEP)] === 1) return true;
  return false;
};

describe('A Caverna Sagrada por dentro (o mapa caverna)', () => {
  it('é um mapa do mundo novo, com o nome e as camadas de sempre', () => {
    expect(game.metric).toBe(true);
    const props = (map as unknown as { properties?: { name: string; value: unknown }[] }).properties ?? [];
    expect(props.find((p) => p.name === 'nome')?.value).toBe('Caverna Sagrada');
    for (const name of ['chao', 'cenario', 'colisao', 'areas', 'pontos', 'saidas']) expect(layer(name).length, name).toBeGreaterThan(0);
  });

  it('a saída, na ponta sul do túnel, leva de volta à boca da caverna do Guarapiranga; quem entra chega fora dela', () => {
    expect(game.exits).toHaveLength(1);
    expect(game.exits[0]).toMatchObject({ to: 'guarapiranga', arrival: 'chegada-caverna' });
    expect(game.exitAt(ARRIVAL.x, ARRIVAL.y)).toBeNull();
    const out = game.exits[0]!;
    expect(reachNear(out.x + out.w / 2, out.y + 0.3, 0.4), 'a saída se alcança a pé').toBe(true);
    const guara = GameMap.fromTiled(JSON.parse(readFileSync('public/assets/maps-iso/guarapiranga.tmj', 'utf8')) as TiledMap, 'guarapiranga');
    expect(guara.spots.has('chegada-caverna')).toBe(true);
    // quem desmaia aqui dentro acorda na entrada
    expect(game.spots.has('spawn')).toBe(true);
  });

  it('da entrada se anda até tudo: os pilares gravados, a Pedra Ancestral, a beira do poço, o caldeirão e o lugar da Cuca', () => {
    const cenario = layer('cenario');
    const pillars = cenario.filter((o) => o.type === 'menir');
    expect(pillars.length).toBeGreaterThanOrEqual(4);
    for (const o of pillars) {
      expect(prop(o, 'olhando'), 'a face gravada virada para a câmera (o sul)').toBe(90);
      expect(reachNear(at(o).x, at(o).y + 0.9, 0.4), `pilar em (${at(o).x}, ${at(o).y})`).toBe(true);
    }
    const stone = named('cenario', 'Pedra Ancestral');
    expect(prop(stone, 'ancestral')).toBe(true);
    expect(reachNear(at(stone).x, at(stone).y + 1.5, 0.5)).toBe(true);
    const pool = named('chao', 'Poço da Luz');
    expect(pool.type).toBe('agua');
    const light = named('cenario', 'Luz do Poço');
    expect([light.type, Number(prop(light, 'coluna')) > 0]).toEqual(['veu', true]);
    expect(reachNear(at(light).x, at(light).y + 3.2, 0.8), 'a beira do poço').toBe(true);
    const cauldron = named('cenario', 'Caldeirão da Cuca');
    expect(reachNear(at(cauldron).x, at(cauldron).y + 1.3, 0.4)).toBe(true);
    const cuca = at(named('pontos', 'toca-da-cuca'));
    expect(reachNear(cuca.x, cuca.y, 0.3)).toBe(true);
    expect(cenario.filter((o) => o.type === 'estante-potes').length).toBeGreaterThanOrEqual(2);
  });

  it('a toca é a arena da luta com a Cuca: chão largo para desviar, estalagmites para se esconder e a área dela pronta', () => {
    // o chão que se alcança dentro da toca (a área "Toca da Cuca"): largo e comprido o bastante para desviar dos golpes
    const lair = named('areas', 'Toca da Cuca');
    const [x0, x1, y0, y1] = [lair.x / M, (lair.x + lair.width) / M, lair.y / M, (lair.y + lair.height) / M];
    let [cells, minX, maxX, minY, maxY] = [0, Infinity, -Infinity, Infinity, -Infinity];
    for (let j = Math.ceil(y0 / STEP); j <= Math.floor(y1 / STEP); j++) {
      for (let i = Math.ceil(x0 / STEP); i <= Math.floor(x1 / STEP); i++) {
        if (seen[j * COLS + i] !== 1) continue;
        cells++;
        [minX, maxX, minY, maxY] = [Math.min(minX, i * STEP), Math.max(maxX, i * STEP), Math.min(minY, j * STEP), Math.max(maxY, j * STEP)];
      }
    }
    expect(cells * STEP * STEP, 'm² de chão na toca').toBeGreaterThan(170);
    expect(maxX - minX).toBeGreaterThanOrEqual(18);
    expect(maxY - minY).toBeGreaterThanOrEqual(11);
    const cuca = at(named('pontos', 'toca-da-cuca'));
    expect(cuca.x > x0 && cuca.x < x1 && cuca.y > y0 && cuca.y < y1).toBe(true);
    // as estalagmites da toca (fora o caldeirão, as estantes e os barris)
    expect(layer('cenario').filter((o) => o.type === 'rocha' && at(o).x > x0 && at(o).x < x1 && at(o).y > y0 && at(o).y < y1 && Number(prop(o, 'raio')) <= 0.6).length).toBeGreaterThanOrEqual(2);
    // a área da luta entra quando a chave `cuca` existir em data/monsters.json (o jeito dela é da [estrutura])
    const monsters = JSON.parse(readFileSync('data/monsters.json', 'utf8')) as Record<string, unknown>;
    const zone = layer('monstros').find((o) => o.name === 'cuca');
    if ('cuca' in monsters) {
      expect(zone, 'a área da Cuca na camada monstros').toBeDefined();
      expect(prop(zone!, 'quantidade')).toBe(1);
      expect(cuca.x > zone!.x / M && cuca.x < (zone!.x + zone!.width) / M && cuca.y > zone!.y / M && cuca.y < (zone!.y + zone!.height) / M).toBe(true);
    } else expect(zone).toBeUndefined();
  });

  it('é escura por dentro (mais clara na entrada, a toca a mais escura), com o que brilha: o poço, as raízes e os cogumelos', () => {
    const areas = layer('areas');
    const dark = (name: string) => Number(prop(named('areas', name), 'escuro'));
    expect(areas.length).toBeGreaterThanOrEqual(3);
    expect(dark('Caverna Sagrada')).toBeGreaterThanOrEqual(0.6);
    expect(dark('Entrada da Caverna')).toBeLessThan(dark('Caverna Sagrada'));
    expect(dark('Toca da Cuca')).toBeGreaterThan(dark('Salão das Inscrições'));
    const cenario = layer('cenario');
    expect(cenario.some((o) => o.type === 'cortina-veu')).toBe(true);
    expect(cenario.filter((o) => o.type === 'planta' && prop(o, 'tipo') === 'cogumelo' && prop(o, 'brilho')).length).toBeGreaterThanOrEqual(10);
  });
});
