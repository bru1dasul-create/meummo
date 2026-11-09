// O mapa em camadas: chão, sombras, enfeites e a camada "acima" (copas das árvores, alto dos postes),
// que é desenhada por cima dos personagens. Quando alguém passa embaixo de uma copa — ou tem um aviso de
// golpe ou fogo lá embaixo — ela fica transparente, para ninguém sumir de vista.
// Também acende as luzes do mapa: tiles com a propriedade `luz` (fogueira, janelas) ganham um brilho em volta.

import Phaser from 'phaser';
import { TILE_SIZE } from '../../shared/constants';
import type { TiledLayer, TiledMap } from '../../shared/map';

const T = TILE_SIZE;
/** Nome da camada do Tiled que fica por cima dos personagens. */
export const ABOVE_LAYER = 'acima';
/** Altura (depth) das copas: acima dos personagens (que usam a posição y em pixels), abaixo de tiros e efeitos. */
export const CANOPY_DEPTH = 3000;
/** Luzes: por cima dos personagens (iluminam quem chega perto) e por baixo das copas. */
const LIGHT_DEPTH = 2500;
/** O quanto a copa fica transparente bem em cima de alguém, e até que distância (pixels) isso vai sumindo. */
const FADE_ALPHA = 0.35;
const FADE_NEAR = 20;
const FADE_FAR = 36;
/** Tempo para a copa sumir ou voltar. */
const FADE_MS = 180;
const GID_MASK = 0x0fffffff;

/** Cria as camadas de tiles do mapa. Devolve a camada "acima" (ou null, se o mapa não tiver). */
export function createMapLayers(tilemap: Phaser.Tilemaps.Tilemap, tileset: Phaser.Tilemaps.Tileset): Phaser.Tilemaps.TilemapLayer | null {
  let above: Phaser.Tilemaps.TilemapLayer | null = null;
  tilemap.layers.forEach((data, i) => {
    const layer = tilemap.createLayer(data.name, tileset);
    if (!layer) return;
    if (data.name.toLowerCase() === ABOVE_LAYER) {
      layer.setDepth(CANOPY_DEPTH);
      if (layer instanceof Phaser.Tilemaps.TilemapLayer) above = layer;
    } else {
      layer.setDepth(-100 + i);
    }
  });
  return above;
}

/** Deixa a copa transparente em volta de quem está embaixo dela (e volta ao normal quando a pessoa sai). */
export class CanopyFader {
  /** Tiles que estão (ou estavam) transparentes: índice (y * largura + x) → transparência atual. */
  private readonly faded = new Map<number, number>();

  constructor(private readonly layer: Phaser.Tilemaps.TilemapLayer) {}

  /** `points`: o centro (em pixels) de cada coisa que precisa aparecer embaixo das copas. */
  update(points: readonly { x: number; y: number }[], deltaMs: number): void {
    const { width, height } = this.layer.layer;
    const targets = new Map<number, number>();
    for (const point of points) {
      const tx0 = Math.max(0, Math.floor((point.x - FADE_FAR) / T));
      const tx1 = Math.min(width - 1, Math.floor((point.x + FADE_FAR) / T));
      const ty0 = Math.max(0, Math.floor((point.y - FADE_FAR) / T));
      const ty1 = Math.min(height - 1, Math.floor((point.y + FADE_FAR) / T));
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (!this.layer.getTileAt(tx, ty)) continue;
          const d = Math.hypot((tx + 0.5) * T - point.x, (ty + 0.5) * T - point.y);
          if (d >= FADE_FAR) continue;
          const target = d <= FADE_NEAR ? FADE_ALPHA : FADE_ALPHA + ((1 - FADE_ALPHA) * (d - FADE_NEAR)) / (FADE_FAR - FADE_NEAR);
          const key = ty * width + tx;
          targets.set(key, Math.min(targets.get(key) ?? 1, target));
        }
      }
    }
    for (const key of targets.keys()) if (!this.faded.has(key)) this.faded.set(key, 1);
    const step = ((1 - FADE_ALPHA) * Math.min(deltaMs, 100)) / FADE_MS;
    for (const [key, alpha] of this.faded) {
      const target = targets.get(key) ?? 1;
      const next = alpha > target ? Math.max(target, alpha - step) : Math.min(target, alpha + step);
      const tile = this.layer.getTileAt(key % width, Math.floor(key / width));
      if (tile) tile.alpha = next;
      if (next >= 1) this.faded.delete(key);
      else this.faded.set(key, next);
    }
  }
}

interface Light {
  image: Phaser.GameObjects.Image;
  alpha: number;
  /** Fogo tremula; janela acesa fica parada. */
  flicker: boolean;
  seed: number;
}

/** As luzes do mapa: um brilho em volta de cada tile com a propriedade `luz` (cor) e `luzRaio` (tamanho). */
export class MapLights {
  private readonly lights: Light[] = [];

  constructor(scene: Phaser.Scene, json: TiledMap) {
    const kinds = new Map<number, { color: number; radius: number; flicker: boolean }>();
    for (const tileset of json.tilesets) {
      for (const tile of (tileset.tiles ?? []) as { id: number; properties?: { name: string; value: unknown }[]; animation?: unknown[] }[]) {
        const prop = (name: string) => tile.properties?.find((p) => p.name === name)?.value;
        const color = prop('luz');
        if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) continue;
        const radius = Number(prop('luzRaio')) || T;
        kinds.set(tileset.firstgid + tile.id, { color: parseInt(color.slice(1), 16), radius, flicker: !!tile.animation });
      }
    }
    if (kinds.size === 0) return;
    ensureGlowTexture(scene);
    const visit = (layers: TiledLayer[]) => {
      for (const layer of layers) {
        if (layer.type === 'group') visit(layer.layers ?? []);
        if (layer.type !== 'tilelayer' || !Array.isArray(layer.data)) continue;
        layer.data.forEach((raw, i) => {
          const kind = kinds.get(raw & GID_MASK);
          if (!kind) return;
          const x = ((i % json.width) + 0.5) * T;
          const y = (Math.floor(i / json.width) + 0.5) * T;
          const alpha = kind.radius >= 24 ? 0.5 : 0.32;
          const image = scene.add
            .image(x, y, GLOW_TEXTURE)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setTint(kind.color)
            .setDisplaySize(kind.radius * 2, kind.radius * 2)
            .setAlpha(alpha)
            .setDepth(LIGHT_DEPTH);
          this.lights.push({ image, alpha, flicker: kind.flicker, seed: Math.random() * 1000 });
        });
      }
    };
    visit(json.layers);
  }

  update(now: number): void {
    for (const light of this.lights) {
      if (!light.flicker) continue;
      const wave = 0.84 + 0.1 * Math.sin(now / 83 + light.seed) + 0.06 * Math.sin(now / 37 + light.seed * 2);
      light.image.setAlpha(light.alpha * wave);
    }
  }
}

const GLOW_TEXTURE = 'glow';

/** Um círculo branco que vai sumindo nas bordas (o brilho das luzes; a cor vem do tint). */
function ensureGlowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GLOW_TEXTURE)) return;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  scene.textures.addCanvas(GLOW_TEXTURE, canvas);
}
