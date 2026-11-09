// Desenha os mapas inteiros em imagens (útil para ver o mundo de cima e para a documentação).
// Uso: npm run render:map                  (todos os mapas → docs/mapa-<id>.png)
//      npm run render:map -- refugio x.png (um mapa só, na imagem que você escolher)
//      npm run render:map -- outro.tmj x.png (um arquivo de mapa qualquer, ex.: o gerado com --out)

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";
import pngjs from "pngjs";
import { COLUMNS, MARGIN, SPACING } from "./tileset";

const { PNG } = pngjs;
const T = 16;
const MAPS = "public/assets/maps";
const tiles = PNG.sync.read(readFileSync("public/assets/tiles.png"));

interface MapJson {
  width: number;
  height: number;
  layers: {
    name: string;
    type: string;
    data?: number[];
    objects?: {
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
      point?: boolean;
    }[];
  }[];
}

function render(map: MapJson): Buffer {
  const width = map.width * T;
  const height = map.height * T;
  const rgba = new Uint8Array(width * height * 4);

  for (const layer of map.layers) {
    if (layer.type !== "tilelayer" || !layer.data) continue;
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
          for (let k = 0; k < 3; k++)
            rgba[d + k] = Math.round(
              tiles.data[s + k]! * a + rgba[d + k]! * (1 - a),
            );
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
    corpo_seco: [190, 200, 120],
    capelobo: [200, 120, 60],
    mula_sem_cabeca: [255, 60, 200],
  };
  const frames: {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: [number, number, number];
  }[] = [];
  for (const layer of map.layers) {
    if (layer.type !== "objectgroup") continue;
    const kind = layer.name.toLowerCase();
    for (const obj of layer.objects ?? []) {
      if (obj.point) continue;
      if (kind === "monstros")
        frames.push({
          ...obj,
          color: ZONE_COLORS[obj.name] ?? [180, 120, 255],
        });
      if (kind === "saidas" || kind === "saídas")
        frames.push({ ...obj, color: [40, 220, 255] }); // saídas: azul-claro
    }
  }
  for (const zone of frames) {
    const color = zone.color;
    const x0 = Math.round(zone.x);
    const y0 = Math.round(zone.y);
    const x1 = Math.min(width - 1, Math.round(zone.x + zone.width) - 1);
    const y1 = Math.min(height - 1, Math.round(zone.y + zone.height) - 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const border = x - x0 < 3 || x1 - x < 3 || y - y0 < 3 || y1 - y < 3;
        const d = (y * width + x) * 4;
        const a = border ? 0.85 : 0.12;
        for (let k = 0; k < 3; k++)
          rgba[d + k] = Math.round(color[k]! * a + rgba[d + k]! * (1 - a));
      }
    }
  }

  return indexedPng(rgba, width, height) ?? rgbPng(rgba, width, height);
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
  out.write(type, 4, "ascii");
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** PNG com paleta (até 256 cores). Devolve null se a imagem tiver cores demais. */
function indexedPng(
  rgba: Uint8Array,
  width: number,
  height: number,
): Buffer | null {
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
    chunk("IHDR", header),
    chunk("PLTE", plte),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

function rgbPng(rgba: Uint8Array, width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  png.data = Buffer.from(rgba);
  return PNG.sync.write(png);
}

// Desenha (no fim do arquivo: as tabelas lá de cima já existem aqui).
const only = process.argv[2];
const ids = only
  ? [only]
  : readdirSync(MAPS)
      .filter((f) => f.endsWith(".tmj"))
      .map((f) => f.slice(0, -4))
      .sort();
for (const id of ids) {
  const file = id.endsWith(".tmj") ? path.resolve(id) : path.join(MAPS, `${id}.tmj`);
  const name = path.basename(id, ".tmj");
  const out = path.resolve(
    only && process.argv[3] ? process.argv[3] : `docs/mapa-${name}.png`,
  );
  writeFileSync(out, render(JSON.parse(readFileSync(file, "utf8")) as MapJson));
  console.log(`mapa "${name}" desenhado em ${path.relative(process.cwd(), out)}`);
}
