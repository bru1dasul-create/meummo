// O mapa em camadas: chão, sombras, enfeites e a camada "acima" (copas das árvores, alto dos postes),
// que é desenhada por cima dos personagens. Quando alguém passa embaixo de uma copa — ou tem um aviso de
// golpe ou fogo lá embaixo — ela fica transparente, para ninguém sumir de vista.
// Também cuida do clima do mapa: luzes (tiles com a propriedade `luz`), faíscas (tiles com `faiscas`) e, pelas
// propriedades do próprio mapa, neblina passando (`neblina`) e o lugar mais escuro (`escuro`).

import Phaser from 'phaser';
import { TILE_SIZE } from '../../shared/constants';
import type { TiledLayer, TiledMap } from '../../shared/map';

const T = TILE_SIZE;
/** Nome da camada do Tiled que fica por cima dos personagens. */
export const ABOVE_LAYER = 'acima';
/** Altura (depth) das copas: acima dos personagens (que usam a posição y em pixels), abaixo de tiros e efeitos. */
export const CANOPY_DEPTH = 3000;
/** Escuridão do mapa (`escuro`): por cima de tudo que está no chão e das copas. */
const DARK_DEPTH = 3100;
/** Luzes: por cima da escuridão (é aí que elas aparecem) e de quem chega perto. */
const LIGHT_DEPTH = 3200;
/** Neblina passando por cima de tudo; as faíscas brilham por cima dela. Tiros e golpes (4000+) ficam acima. */
const FOG_DEPTH = 3300;
const SPARK_DEPTH = 3400;
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

const numberProp = (json: TiledMap, name: string) => {
  const value = json.properties?.find((p) => p.name === name)?.value;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
};

/** O clima do mapa: o lugar mais escuro (propriedade `escuro`, 0 a 1) e neblina passando devagar (`neblina`, 0 a 1). */
export class MapWeather {
  private readonly fog: Phaser.GameObjects.TileSprite | null = null;

  constructor(scene: Phaser.Scene, json: TiledMap) {
    const width = json.width * T;
    const height = json.height * T;
    const dark = numberProp(json, 'escuro');
    if (dark > 0) scene.add.rectangle(0, 0, width, height, 0x0b0f14, dark).setOrigin(0).setDepth(DARK_DEPTH);
    const fog = numberProp(json, 'neblina');
    if (fog > 0) {
      ensureFogTexture(scene);
      this.fog = scene.add.tileSprite(0, 0, width, height, FOG_TEXTURE).setOrigin(0).setDepth(FOG_DEPTH).setAlpha(fog);
    }
  }

  update(now: number): void {
    if (!this.fog) return;
    this.fog.tilePositionX = now * 0.006;
    this.fog.tilePositionY = now * 0.0025;
  }
}

interface Spark {
  dot: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  vx: number;
  born: number;
  life: number;
}

const SPARK_COLORS = [0xffe066, 0xff9a2e, 0xff6a2a];
const MAX_SPARKS = 50;

/** Faíscas subindo e sumindo dos tiles com a propriedade `faiscas` (brasas no chão, tambor com fogo). */
export class MapSparks {
  private readonly sources: { x: number; y: number }[] = [];
  private readonly sparks: Spark[] = [];
  private nextAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    json: TiledMap,
  ) {
    const gids = new Set<number>();
    for (const tileset of json.tilesets) {
      for (const tile of (tileset.tiles ?? []) as { id: number; properties?: { name: string; value: unknown }[] }[]) {
        if (tile.properties?.some((p) => p.name === 'faiscas' && p.value === true)) gids.add(tileset.firstgid + tile.id);
      }
    }
    if (gids.size === 0) return;
    const visit = (layers: TiledLayer[]) => {
      for (const layer of layers) {
        if (layer.type === 'group') visit(layer.layers ?? []);
        if (layer.type !== 'tilelayer' || !Array.isArray(layer.data)) continue;
        layer.data.forEach((raw, i) => {
          if (gids.has(raw & GID_MASK)) this.sources.push({ x: ((i % json.width) + 0.5) * T, y: (Math.floor(i / json.width) + 0.5) * T });
        });
      }
    };
    visit(json.layers);
  }

  /** `view`: o pedaço do mapa que aparece na tela (só solta faísca ali perto). */
  update(now: number, view: Phaser.Geom.Rectangle): void {
    if (this.sources.length === 0) return;
    if (now >= this.nextAt && this.sparks.length < MAX_SPARKS) {
      this.nextAt = now + 70;
      const near = this.sources.filter((s) => s.x > view.x - 32 && s.x < view.right + 32 && s.y > view.y - 32 && s.y < view.bottom + 32);
      const source = near[Math.floor(Math.random() * near.length)];
      if (source) {
        const color = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)]!;
        const x = source.x + (Math.random() - 0.5) * 10;
        const y = source.y + (Math.random() - 0.5) * 6;
        const dot = this.scene.add.rectangle(x, y, 1, 1, color).setDepth(SPARK_DEPTH);
        this.sparks.push({ dot, x, y, vx: (Math.random() - 0.5) * 0.012, born: now, life: 700 + Math.random() * 700 });
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i]!;
      const age = now - spark.born;
      if (age >= spark.life) {
        spark.dot.destroy();
        this.sparks.splice(i, 1);
        continue;
      }
      // sobe cada vez mais devagar, balançando de lado
      spark.dot.setPosition(spark.x + spark.vx * age + Math.sin(age / 140 + spark.born) * 1.5, spark.y - age * 0.022);
      spark.dot.setAlpha(1 - age / spark.life);
    }
  }
}

const FOG_TEXTURE = 'fog';

/** Neblina que emenda nas bordas (dá para repetir): manchas claras e suaves, transparentes no meio. */
function ensureFogTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FOG_TEXTURE)) return;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  const octave = (cells: number, seed: number) => {
    const grid = Array.from({ length: cells * cells }, (_, i) => {
      const v = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
      return v - Math.floor(v);
    });
    return (x: number, y: number) => {
      const gx = (x / size) * cells;
      const gy = (y / size) * cells;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const sx = (gx - x0) * (gx - x0) * (3 - 2 * (gx - x0));
      const sy = (gy - y0) * (gy - y0) * (3 - 2 * (gy - y0));
      const at = (i: number, j: number) => grid[((y0 + j) % cells) * cells + ((x0 + i) % cells)]!;
      return (at(0, 0) * (1 - sx) + at(1, 0) * sx) * (1 - sy) + (at(0, 1) * (1 - sx) + at(1, 1) * sx) * sy;
    };
  };
  const big = octave(4, 1);
  const small = octave(8, 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = big(x, y) * 0.7 + small(x, y) * 0.3;
      const alpha = Math.max(0, Math.min(1, (n - 0.38) * 2.2));
      const i = (y * size + x) * 4;
      image.data[i] = 214;
      image.data[i + 1] = 222;
      image.data[i + 2] = 214;
      image.data[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  scene.textures.addCanvas(FOG_TEXTURE, canvas);
}
