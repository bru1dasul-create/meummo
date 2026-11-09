// Gera public/assets/tiles.png a partir dos desenhos em scripts/tileset.ts.
// Uso: npm run gen:tiles            (pode rodar quantas vezes quiser; não mexe no mapa)
//      npm run gen:tiles -- --preview caminho.png   (também salva uma versão ampliada para conferir)

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import pngjs from 'pngjs';
import { Pixels } from './pixels';
import { buildTileset } from './tileset';

const { PNG } = pngjs;
const OUT = path.resolve('public/assets/tiles.png');

function savePng(pixels: Pixels, file: string): void {
  const png = new PNG({ width: pixels.width, height: pixels.height });
  png.data = Buffer.from(pixels.data.buffer);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, PNG.sync.write(png));
}

function scaled(src: Pixels, factor: number): Pixels {
  const out = new Pixels(src.width * factor, src.height * factor);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const c = src.get(Math.floor(x / factor), Math.floor(y / factor));
      // fundo xadrez para enxergar transparência
      const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 200 : 160;
      const a = c[3] / 255;
      out.set(x, y, [c[0] * a + checker * (1 - a), c[1] * a + checker * (1 - a), c[2] * a + checker * (1 - a), 255]);
    }
  }
  return out;
}

const tileset = buildTileset();
savePng(tileset, OUT);
console.log(`tileset salvo em ${path.relative(process.cwd(), OUT)} (${tileset.width}x${tileset.height})`);

const previewIndex = process.argv.indexOf('--preview');
if (previewIndex !== -1 && process.argv[previewIndex + 1]) {
  const file = path.resolve(process.argv[previewIndex + 1]!);
  savePng(scaled(tileset, 6), file);
  console.log(`prévia ampliada salva em ${file}`);
}
