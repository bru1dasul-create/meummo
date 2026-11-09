// Desenha o mapa inteiro numa imagem (útil para ver o mundo de cima e para a documentação).
// Uso: npm run render:map -- [saida.png]   (padrão: docs/mapa.png)

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import pngjs from 'pngjs';
import { COLUMNS, MARGIN, SPACING } from './tileset';

const { PNG } = pngjs;
const T = 16;
const out = path.resolve(process.argv[2] ?? 'docs/mapa.png');
const map = JSON.parse(readFileSync('public/assets/maps/world.tmj', 'utf8')) as {
  width: number;
  height: number;
  layers: { type: string; data?: number[] }[];
};
const tiles = PNG.sync.read(readFileSync('public/assets/tiles.png'));
const width = map.width * T;
const height = map.height * T;
const rgba = new Uint8Array(width * height * 4);

for (const layer of map.layers) {
  if (layer.type !== 'tilelayer' || !layer.data) continue;
  layer.data.forEach((raw, i) => {
    const gid = raw & 0x0fffffff;
    if (!gid) return;
    const index = gid - 1;
    const sx = MARGIN + (index % COLUMNS) * (T + SPACING);
    const sy = MARGIN + Math.floor(index / COLUMNS) * (T + SPACING);
    const dx = (i % map.width) * T;
    const dy = Math.floor(i / map.width) * T;
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const s = ((sy + y) * tiles.width + sx + x) * 4;
        const d = ((dy + y) * width + dx + x) * 4;
        const a = tiles.data[s + 3]! / 255;
        for (let k = 0; k < 3; k++) rgba[d + k] = Math.round(tiles.data[s + k]! * a + rgba[d + k]! * (1 - a));
        rgba[d + 3] = 255;
      }
    }
  });
}

// Áreas de monstros (camada "monstros"): uma moldura colorida por criatura.
const ZONE_COLORS: Record<string, [number, number, number]> = {
  sagui: [255, 214, 64],
  jararaca: [255, 140, 0],
  saci: [235, 40, 40],
};
const zoneLayer = (map as unknown as { layers: { name: string; type: string; objects?: { name: string; x: number; y: number; width: number; height: number }[] }[] }).layers.find(
  (l) => l.type === 'objectgroup' && l.name.toLowerCase() === 'monstros',
);
for (const zone of zoneLayer?.objects ?? []) {
  const color = ZONE_COLORS[zone.name] ?? [180, 120, 255];
  const x0 = Math.round(zone.x);
  const y0 = Math.round(zone.y);
  const x1 = Math.min(width - 1, Math.round(zone.x + zone.width) - 1);
  const y1 = Math.min(height - 1, Math.round(zone.y + zone.height) - 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const border = x - x0 < 3 || x1 - x < 3 || y - y0 < 3 || y1 - y < 3;
      const d = (y * width + x) * 4;
      const a = border ? 0.85 : 0.12;
      for (let k = 0; k < 3; k++) rgba[d + k] = Math.round(color[k]! * a + rgba[d + k]! * (1 - a));
    }
  }
}

// Pixel art usa poucas cores: um PNG com paleta fica ~15x menor que o normal.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** PNG com paleta (até 256 cores). Devolve null se a imagem tiver cores demais. */
function indexedPng(): Buffer | null {
  const palette = new Map<number, number>();
  const rows = Buffer.alloc((width + 1) * height); // cada linha começa com o byte de filtro (0)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const color = (rgba[p]! << 16) | (rgba[p + 1]! << 8) | rgba[p + 2]!;
      let index = palette.get(color);
      if (index === undefined) {
        if (palette.size === 256) return null;
        index = palette.size;
        palette.set(color, index);
      }
      rows[y * (width + 1) + 1 + x] = index;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits por pixel
  header[9] = 3; // tipo: paleta
  const plte = Buffer.alloc(palette.size * 3);
  for (const [color, index] of palette) {
    plte[index * 3] = (color >> 16) & 255;
    plte[index * 3 + 1] = (color >> 8) & 255;
    plte[index * 3 + 2] = color & 255;
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('PLTE', plte),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

function rgbPng(): Buffer {
  const png = new PNG({ width, height });
  png.data = Buffer.from(rgba);
  return PNG.sync.write(png);
}

writeFileSync(out, indexedPng() ?? rgbPng());
console.log(`mapa desenhado em ${out}`);
