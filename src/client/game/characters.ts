// Personagens no Phaser: transforma o boneco de papel (doll/) em texturas e decide qual desenho de
// equipamento usar para cada parte do corpo.
//
// Cada combinação de aparência + roupa vira UMA textura com todos os quadros (doll/compose.ts).
// Jogadores com a mesma combinação dividem a textura; quando ninguém mais usa, ela é apagada.
// A textura é desenhada aos poucos (uma direção por quadro do jogo), para não dar "engasgo" quando
// aparece alguém novo ou alguém troca de roupa.
//
// O servidor manda, para cada parte, o ícone do item equipado (GearLook); o visual com o mesmo nome
// está em gearArt.ts. NPCs (vendedora...) podem ter aparência própria em NPC_LOOKS.

import type Phaser from 'phaser';
import type { EquipSlot, GearLook } from '../../shared/items';
import { bodyLook, type BodyLook } from './doll/body';
import { buildDollRow, drawDollFrame, dressOf, SHEET_COLUMNS, SHEET_ROWS, type DollGear } from './doll/compose';
import { buildFaceSheet, drawFace, EXPRESSIONS, FACE_H, FACE_W } from './doll/face';
import { slotOfArt } from './doll/gearIcon';
import { DENSITY, faceOrigin, FEET_Y, FRAME_H, FRAME_W, FRAMES_PER_VIEW, VIEWS, type View } from './doll/poses';
import { Sheet } from './doll/sheet';
import { DOLL_SLOTS, GEAR_ART, type DollSlot } from './gearArt';

/** Ponto de apoio da textura: logo abaixo dos pés. */
export const CHARACTER_ORIGIN_Y = (FEET_Y + 1) / FRAME_H;
/** O personagem é desenhado com o dobro de pixels do mapa e aparece na metade do tamanho. */
export const CHARACTER_SCALE = 1 / DENSITY;
/** Altura do nome acima dos pés, em pixels do mapa (o corpo tem ~26, mais chapéu). */
export const CHAR_TOP = 29;
/** Quanto tempo uma textura sem ninguém usando espera antes de ser apagada (rastro da esquiva ainda pode usar). */
const RELEASE_DELAY_MS = 2000;
/** Tempo máximo por quadro do jogo gasto desenhando personagens novos. */
const BUILD_BUDGET_MS = 6;

/**
 * Aparência própria de NPCs (a chave é o id em data/npcs.json). O que não estiver aqui vem do nome,
 * como nos jogadores. `gear` usa os nomes dos visuais de gearArt.ts.
 */
export const NPC_LOOKS: Record<string, { body?: Partial<BodyLook>; gear?: Partial<Record<DollSlot, string>> }> = {
  // quitandeira do píer: senhora de cabelo grisalho em coque, óculos redondinhos e sorriso de vó,
  // vestido de chita com avental e colar de sementes (o chapéu de palha vem dos dados: "veste")
  iracema: {
    body: { skin: '#9a6440', hair: '#ddd8cf', hairStyle: 'coque', build: 'forte', eyes: '#6b4423', glasses: '#4a3424', smile: true, shoes: '#5a3a22' },
    gear: { body: 'chita_avental', charm: 'colar_sementes' },
  },
  // guardião da mata: menino de cabelo de fogo, pés virados para trás, descalço, de túnica de folhas
  curupira: {
    body: {
      skin: '#8a5634',
      hair: '#f47b20',
      hairStyle: 'fogo',
      build: 'esguio',
      eyes: '#3d8a52',
      smile: true,
      feetBackward: true,
      barefoot: true,
    },
    gear: { body: 'tunica_folhas' },
  },
};

/** O desenho de cada parte vestida e uma chave que identifica a combinação. */
export function resolveGear(gear: GearLook | undefined, npc?: string): { gear: DollGear; key: string } {
  const doll: DollGear = {};
  const parts: string[] = [];
  const extra = npc ? NPC_LOOKS[npc]?.gear : undefined;
  for (const slot of DOLL_SLOTS) {
    const name = (gear as Partial<Record<DollSlot, string>> | undefined)?.[slot] ?? extra?.[slot];
    const art = name ? GEAR_ART[name] : undefined;
    // sem desenho (ou desenho de outra parte do corpo): o item vale, mas não aparece
    if (!art || slotOfArt(art) !== slot) continue;
    doll[slot] = art;
    parts.push(`${slot}:${name}`);
  }
  return { gear: doll, key: parts.join(',') };
}

/** A aparência do corpo: a do nome, com o que o NPC tiver de próprio por cima. */
export function lookOf(look: number, npc?: string): BodyLook {
  const own = npc ? NPC_LOOKS[npc]?.body : undefined;
  return own ? { ...bodyLook(look), ...own } : bodyLook(look);
}

function canvasOf(sheet: Sheet): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sheet.width;
  canvas.height = sheet.height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(sheet.data), sheet.width, sheet.height), 0, 0);
  return canvas;
}

const users = new Map<string, number>();
const releaseTimers = new Map<string, number>();
/** Texturas ainda sendo desenhadas: falta desenhar estas vistas. */
interface Job {
  key: string;
  scene: Phaser.Scene;
  look: BodyLook;
  gear: DollGear;
  views: View[];
  canvas: HTMLCanvasElement;
  texture: Phaser.Textures.CanvasTexture;
}
const jobs: Job[] = [];
const pumping = new WeakSet<Phaser.Scene>();

/** Desenha um pouco das texturas pendentes (chamado todo quadro, antes de atualizar a cena). */
function pump(): void {
  const start = performance.now();
  while (jobs.length > 0 && performance.now() - start < BUILD_BUDGET_MS) {
    const job = jobs[0]!;
    if (!job.scene.textures.exists(job.key)) {
      jobs.shift(); // ninguém mais quer esta (foi apagada antes de ficar pronta)
      continue;
    }
    const view = job.views.shift()!;
    const row = buildDollRow(job.look, job.gear, view, dressOf(job.look, job.gear));
    job.canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(row.data), row.width, row.height), 0, VIEWS.indexOf(view) * FRAME_H);
    job.texture.refresh();
    if (job.views.length === 0) jobs.shift();
  }
}

/** A textura já foi desenhada inteira? (Enquanto não, os quadros que faltam ficam vazios.) */
export function characterTextureReady(key: string): boolean {
  return !jobs.some((job) => job.key === key);
}

/**
 * Pega (e cria, se preciso) a textura desta aparência com esta roupa. Devolva com releaseCharacterTexture.
 * `npc`: id do NPC (aparência própria, se tiver).
 */
export function acquireCharacterTexture(scene: Phaser.Scene, look: number, gear?: GearLook, npc?: string): string {
  const resolved = resolveGear(gear, npc);
  const key = `char-${npc ? `${npc}-` : ''}${look}-${resolved.key}`;
  window.clearTimeout(releaseTimers.get(key));
  releaseTimers.delete(key);
  users.set(key, (users.get(key) ?? 0) + 1);
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = SHEET_COLUMNS * FRAME_W;
    canvas.height = SHEET_ROWS * FRAME_H;
    const texture = scene.textures.addCanvas(key, canvas)!;
    const total = FRAMES_PER_VIEW * VIEWS.length;
    for (let i = 0; i < total; i++) {
      texture.add(i, 0, (i % SHEET_COLUMNS) * FRAME_W, Math.floor(i / SHEET_COLUMNS) * FRAME_H, FRAME_W, FRAME_H);
    }
    jobs.push({ key, scene, look: lookOf(look, npc), gear: resolved.gear, views: [...VIEWS], canvas, texture });
    if (!pumping.has(scene)) {
      pumping.add(scene);
      scene.events.on('preupdate', pump);
      scene.events.once('shutdown', () => {
        scene.events.off('preupdate', pump);
        pumping.delete(scene);
      });
    }
  }
  return key;
}

export function releaseCharacterTexture(scene: Phaser.Scene, key: string): void {
  const left = (users.get(key) ?? 1) - 1;
  if (left > 0) {
    users.set(key, left);
    return;
  }
  users.delete(key);
  releaseTimers.set(
    key,
    window.setTimeout(() => {
      releaseTimers.delete(key);
      if (!users.has(key) && scene.textures.exists(key)) scene.textures.remove(key);
    }, RELEASE_DELAY_MS),
  );
}

/** Textura dos rostos desta aparência (cor dos olhos, das sobrancelhas e da pele). */
export function faceTexture(scene: Phaser.Scene, look: number, npc?: string): string {
  const key = `face-${npc ? `${npc}-` : ''}${look}`;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.addCanvas(key, canvasOf(buildFaceSheet(lookOf(look, npc))));
    for (let row = 0; row < 2; row++) {
      EXPRESSIONS.forEach((_, i) => texture?.add(row * EXPRESSIONS.length + i, 0, i * FACE_W, row * FACE_H, FACE_W, FACE_H));
    }
  }
  return key;
}

/** Largura do retrato da mochila (o meio do quadro; a sobra dos lados é para armas). */
const PORTRAIT_W = 48;

/**
 * O personagem parado como imagem (o "boneco" da mochila), já com o rosto.
 * `frame`: 6 = de frente, 3 = de lado, 0 = de costas (como os quadros do desenho antigo).
 */
export function characterPortrait(look: number, gear: GearLook = {}, frame = 6, npc?: string): string {
  const view: View = frame === 0 ? 'up' : frame === 3 ? 'side' : 'down';
  const body = lookOf(look, npc);
  const sheet = new Sheet(FRAME_W, FRAME_H);
  drawDollFrame(sheet, 0, 0, body, resolveGear(gear, npc).gear, view, 'idle', 0);
  if (view !== 'up') {
    const [fx, fy] = faceOrigin(view, 'idle', 0);
    drawFace(sheet, fx, fy, view, 'normal', body);
  }
  const canvas = document.createElement('canvas');
  canvas.width = PORTRAIT_W;
  canvas.height = FRAME_H;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(sheet.data), FRAME_W, FRAME_H), -(FRAME_W - PORTRAIT_W) / 2, 0);
  return canvas.toDataURL();
}

/** Se esta peça tem desenho no personagem, na parte certa (sem desenho, ela só não aparece). Usado pelos testes. */
export function hasGearArt(slot: EquipSlot, icon: string): boolean {
  const art = Object.hasOwn(GEAR_ART, icon) ? GEAR_ART[icon] : undefined;
  return art !== undefined && slotOfArt(art) === slot;
}
