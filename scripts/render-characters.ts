// Desenha uma prancha com personagens de exemplo, em todas as animações e direções, com e sem
// equipamentos: docs/personagens.png. Use para conferir a arte depois de mexer em
// src/client/game/gearArt.ts ou src/client/game/doll/ (npm run render:characters).
//
//   npm run render:characters                      → todos os conjuntos de exemplo
//   npm run render:characters -- --out outro.png   → em outro arquivo
//   npm run render:characters -- --escala 6 --so Caio  → maior, só um dos conjuntos
//   npm run render:characters -- --tudo            → todos os quadros (o padrão mostra os principais)

import { writeFileSync } from 'node:fs';
import pngjs from 'pngjs';
import { bodyLook } from '../src/client/game/doll/body';
import { drawDollFrame, type DollGear } from '../src/client/game/doll/compose';
import { drawFace } from '../src/client/game/doll/face';
import { gearIcon, slotOfArt } from '../src/client/game/doll/gearIcon';
import { ANIMS, FRAME_H, FRAME_W, VIEWS, faceOrigin, type AnimName } from '../src/client/game/doll/poses';
import { Sheet } from '../src/client/game/doll/sheet';
import { GEAR_ART } from '../src/client/game/gearArt';
import { lookFromName } from '../src/shared/look';

const { PNG } = pngjs;
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const SCALE = Number(arg('--escala') ?? 2);
const out = arg('--out') ?? 'docs/personagens.png';
const only = arg('--so');
const everything = process.argv.includes('--tudo');

/** Veste os visuais pelo nome (os de src/client/game/gearArt.ts), cada um na parte dele. */
function gearOf(names: string[]): DollGear {
  const gear: DollGear = {};
  for (const name of names) {
    const art = GEAR_ART[name];
    if (!art) throw new Error(`não existe o visual "${name}" em gearArt.ts`);
    gear[slotOfArt(art)] = art;
  }
  return gear;
}

// Os de cima usam itens que já existem no jogo; Caio e Duda mostram visuais prontos para itens futuros.
const ALL_SETS: { name: string; gear: string[] }[] = [
  { name: 'Ana', gear: [] },
  { name: 'Beto', gear: ['chapeu_palha', 'gibao', 'estilingue', 'colar'] },
  { name: 'Eva', gear: ['gorro', 'couraca', 'faca', 'ferradura'] },
  { name: 'Caio', gear: ['capacete_sucata', 'armadura', 'manoplas', 'botas', 'machadinha', 'escudo_bueiro'] },
  { name: 'Duda', gear: ['tunica', 'luvas', 'arco', 'capa', 'escudo_jabuti'] },
];
const SETS = only ? ALL_SETS.filter((s) => s.name === only) : ALL_SETS;

// quadros mostrados: todos (--tudo) ou os que resumem cada animação
const FRAMES: [AnimName, number][] = everything
  ? (Object.keys(ANIMS) as AnimName[]).flatMap((anim) => Array.from({ length: ANIMS[anim] }, (_, f): [AnimName, number] => [anim, f]))
  : [
      ['idle', 0],
      ['walk', 0],
      ['walk', 2],
      ['walk', 4],
      ['run', 0],
      ['shoot', 0],
      ['swing', 0],
      ['swing', 1],
      ['hurt', 0],
      ['ko', 0],
    ];
const columns = FRAMES.length;
const rows = SETS.length * VIEWS.length;
const gap = 2;
// última linha: os ícones de mochila feitos automaticamente a partir de cada visual
const ICON = 32;
const iconsPerRow = Math.floor((columns * (FRAME_W + gap)) / (ICON + gap * 2));
const iconRows = Math.ceil(Object.keys(GEAR_ART).length / iconsPerRow);
const sheet = new Sheet(columns * (FRAME_W + gap), rows * (FRAME_H + gap) + iconRows * (ICON + gap * 2));

SETS.forEach((set, s) => {
  const look = bodyLook(lookFromName(set.name));
  const gear = gearOf(set.gear);
  VIEWS.forEach((view, v) => {
    FRAMES.forEach(([anim, f], column) => {
      const ox = column * (FRAME_W + gap);
      const oy = (s * VIEWS.length + v) * (FRAME_H + gap);
      drawDollFrame(sheet, ox, oy, look, gear, view, anim, f);
      if (view !== 'up') {
        const [fx, fy] = faceOrigin(view, anim, f);
        drawFace(sheet, ox + fx, oy + fy, view, anim === 'hurt' ? 'hurt' : anim === 'ko' ? 'ko' : anim === 'swing' ? 'happy' : 'normal', look);
      }
    });
  });
});

Object.values(GEAR_ART).forEach((art, i) => {
  const icon = gearIcon(art);
  if (!icon) return;
  const ox = (i % iconsPerRow) * (ICON + gap * 2) + gap;
  const oy = rows * (FRAME_H + gap) + Math.floor(i / iconsPerRow) * (ICON + gap * 2) + gap;
  for (let y = 0; y < ICON; y++) {
    for (let x = 0; x < ICON; x++) {
      const k = (y * ICON + x) * 4;
      if (icon.data[k + 3]) sheet.set(ox + x, oy + y, [icon.data[k]!, icon.data[k + 1]!, icon.data[k + 2]!, 255]);
    }
  }
});

const png = new PNG({ width: sheet.width * SCALE, height: sheet.height * SCALE, deflateLevel: 9 });
for (let y = 0; y < png.height; y++) {
  for (let x = 0; x < png.width; x++) {
    const from = (Math.floor(y / SCALE) * sheet.width + Math.floor(x / SCALE)) * 4;
    const to = (y * png.width + x) * 4;
    const solid = sheet.data[from + 3]! > 0;
    // fundo de grama, para parecer o jogo
    png.data[to] = solid ? sheet.data[from]! : 92;
    png.data[to + 1] = solid ? sheet.data[from + 1]! : 140;
    png.data[to + 2] = solid ? sheet.data[from + 2]! : 74;
    png.data[to + 3] = 255;
  }
}
writeFileSync(out, PNG.sync.write(png));
console.log(`Prancha salva em ${out} (${SETS.length} personagens × ${VIEWS.length} direções × ${columns} quadros).`);
