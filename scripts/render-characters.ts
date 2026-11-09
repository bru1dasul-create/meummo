// Desenha uma prancha com personagens de exemplo, em todas as animações e direções, com e sem
// equipamentos, os ícones de equipamento e, embaixo, os monstros pintados (todos os quadros):
// docs/personagens.png. Use para conferir a arte depois de mexer em src/client/game/gearArt.ts,
// src/client/game/doll/ ou src/client/game/monsterPaint.ts (npm run render:characters).
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
import { lookOf, resolveGear } from '../src/client/game/characters';
import { GEAR_ART } from '../src/client/game/gearArt';
import { PAINTED, paintedFrameCount, paintMonster } from '../src/client/game/monsterPaint';
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
const ALL_SETS: { name: string; gear: string[]; npc?: string }[] = [
  { name: 'Dona Iracema', gear: ['chapeu_palha'], npc: 'iracema' },
  { name: 'Curupira', gear: [], npc: 'curupira' },
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
// monstros pintados: um por linha, todos os quadros (parado, andando, armando, golpe)
const monsters = only ? [] : Object.values(PAINTED);
const iconsHeight = iconRows * (ICON + gap * 2);
const monstersHeight = monsters.reduce((sum, art) => sum + art.height + gap, 0);
const width = Math.max(columns * (FRAME_W + gap), ...monsters.map((art) => paintedFrameCount(art) * (art.width + gap)));
const sheet = new Sheet(width, rows * (FRAME_H + gap) + iconsHeight + monstersHeight);

SETS.forEach((set, s) => {
  const look = set.npc ? lookOf(lookFromName(set.name), set.npc) : bodyLook(lookFromName(set.name));
  // NPC: o que os dados vestem (chapéu) + a roupa própria dele (NPC_LOOKS)
  const gear = set.npc ? resolveGear({ head: set.gear[0] }, set.npc).gear : gearOf(set.gear);
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

let monsterY = rows * (FRAME_H + gap) + iconsHeight;
for (const art of monsters) {
  const painted = paintMonster(art);
  for (let y = 0; y < art.height; y++) {
    for (let x = 0; x < painted.width; x++) {
      const k = (y * painted.width + x) * 4;
      const frame = Math.floor(x / art.width);
      if (painted.data[k + 3]) sheet.set(x + frame * gap, monsterY + y, [painted.data[k]!, painted.data[k + 1]!, painted.data[k + 2]!, 255]);
    }
  }
  monsterY += art.height + gap;
}

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
console.log(`Prancha salva em ${out} (${SETS.length} personagens × ${VIEWS.length} direções × ${columns} quadros; ${monsters.length} monstros pintados).`);
