// Personagens no Phaser: transforma o boneco de papel (doll/) em texturas e decide qual desenho de
// equipamento usar para cada item vestido.
//
// Cada combinação de aparência + roupa vira UMA textura com todos os quadros (doll/compose.ts).
// Jogadores com a mesma combinação dividem a textura; quando ninguém mais usa, ela é apagada.
// A textura é desenhada aos poucos (uma direção por quadro do jogo), para não dar "engasgo" quando
// aparece alguém novo ou alguém troca de roupa.
// Quando tivermos arte de verdade, dá para trocar o desenho de cada camada sem mexer no resto.

import type Phaser from 'phaser';
import { EQUIP_SLOTS, type GearLook, type ItemInfo } from '../../shared/items';
import { bodyLook, type BodyLook } from './doll/body';
import { buildDollRow, dressOf, SHEET_COLUMNS, SHEET_ROWS, type DollGear } from './doll/compose';
import { buildFaceSheet, EXPRESSIONS, FACE_H, FACE_W } from './doll/face';
import { DENSITY, FEET_Y, FRAME_H, FRAME_W, FRAMES_PER_VIEW, VIEWS, type View } from './doll/poses';
import type { Sheet } from './doll/sheet';
import { GEAR_ART } from './gearArt';

/** Ponto de apoio da textura: logo abaixo dos pés. */
export const CHARACTER_ORIGIN_Y = (FEET_Y + 1) / FRAME_H;
/** O personagem é desenhado com o dobro de pixels do mapa e aparece na metade do tamanho. */
export const CHARACTER_SCALE = 1 / DENSITY;
/** Quanto tempo uma textura sem ninguém usando espera antes de ser apagada (rastro da esquiva ainda pode usar). */
const RELEASE_DELAY_MS = 2000;
/** Tempo máximo por quadro do jogo gasto desenhando personagens novos. */
const BUILD_BUDGET_MS = 6;

/** O desenho de cada parte vestida e uma chave que identifica a combinação. */
export function resolveGear(gear: GearLook | undefined, items: ReadonlyMap<string, ItemInfo>): { gear: DollGear; key: string } {
  const doll: DollGear = {};
  const parts: string[] = [];
  for (const slot of EQUIP_SLOTS) {
    const id = gear?.[slot];
    const appearance = id ? items.get(id)?.appearance : undefined;
    const art = appearance ? GEAR_ART[appearance] : undefined;
    if (!art) continue; // item sem desenho no corpo: não aparece (mas continua valendo)
    doll[slot] = art;
    parts.push(`${slot}:${appearance}`);
  }
  return { gear: doll, key: parts.join(',') };
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

/** Pega (e cria, se preciso) a textura desta aparência com esta roupa. Devolva com releaseCharacterTexture. */
export function acquireCharacterTexture(scene: Phaser.Scene, look: number, gear: GearLook | undefined, items: ReadonlyMap<string, ItemInfo>): string {
  const resolved = resolveGear(gear, items);
  const key = `char-${look}-${resolved.key}`;
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
    jobs.push({ key, scene, look: bodyLook(look), gear: resolved.gear, views: [...VIEWS], canvas, texture });
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
export function faceTexture(scene: Phaser.Scene, look: number): string {
  const key = `face-${look}`;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.addCanvas(key, canvasOf(buildFaceSheet(bodyLook(look))));
    for (let row = 0; row < 2; row++) {
      EXPRESSIONS.forEach((_, i) => texture?.add(row * EXPRESSIONS.length + i, 0, i * FACE_W, row * FACE_H, FACE_W, FACE_H));
    }
  }
  return key;
}
