// Ouro e itens no chão, esperando você pegar (cada um só vê os seus).
// Quem decide quando você pega é o servidor (chegou perto, pegou): aqui só desenha, faz as moedas
// pularem do monstro e piscarem nos últimos segundos antes de sumir.
// Desenho provisório por código, como o resto da arte (a frente de Arte pode caprichar).

import type Phaser from 'phaser';
import { TILE_SIZE } from '../../shared/constants';
import type { ItemInfo, ItemStack } from '../../shared/items';
import { itemTexture } from '../itemArt';
import { outline } from './monsterArt';

const T = TILE_SIZE;
const COINS_TEXTURE = 'drop-moedas';
/** Logo acima do chão e das marcas de caminho, abaixo dos avisos de golpe e dos personagens. */
const DROP_DEPTH = -45;
/** Pisca quando falta isso para sumir. */
const BLINK_LAST_MS = 10_000;
/** Pulinho ao cair do monstro. */
const HOP_MS = 420;

/** Uma moeda (5x4): Y dourado, W brilho, y borda escura. */
const COIN = ['.YYY.', 'YWYYy', 'YYYyy', '.yyy.'];
/** Onde cada moeda do montinho fica (a última fica na frente). */
const PILE = [
  [1, 1],
  [7, 2],
  [3, 4],
];
const COLORS: Record<string, string> = { Y: '#f6cc45', W: '#fff6c8', y: '#b98316' };

/** O montinho de moedas, desenhado uma vez só. */
function coinsTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(COINS_TEXTURE)) return COINS_TEXTURE;
  const width = 14;
  const height = 10;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  for (const [ox, oy] of PILE) {
    COIN.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = COLORS[row[x]!];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(ox! + x, oy! + y, 1, 1);
      }
    });
  }
  outline(ctx, width, height);
  scene.textures.addCanvas(COINS_TEXTURE, canvas);
  return COINS_TEXTURE;
}

interface Shown {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  gold: number;
  item: ItemStack | null;
  bornAt: number;
  until: number;
  /** Acabou de cair do monstro (faz o pulinho). */
  hop: boolean;
}

export class GroundDrops {
  private readonly shown = new Map<number, Shown>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly items: ReadonlyMap<string, ItemInfo>,
  ) {}

  /** Algo caiu no chão para você. Se já existia (sobrou parte de um item), só atualiza sem pulinho. */
  add(id: number, x: number, y: number, gold: number, item: ItemStack | null, ms: number, now: number): void {
    const existing = this.shown.get(id);
    existing?.sprite.destroy();
    const texture = gold > 0 || !item ? coinsTexture(this.scene) : itemTexture(this.scene, this.items.get(item.item)?.icon ?? 'mochila');
    const sprite = this.scene.add.image((x + 0.5) * T, (y + 0.5) * T, texture).setDepth(DROP_DEPTH);
    if (item && gold <= 0) sprite.setScale(0.75);
    this.shown.set(id, { sprite, x, y, gold, item, bornAt: now, until: now + ms, hop: !existing });
  }

  /** Saiu do chão (você pegou, ou o tempo acabou). Devolve onde estava e o desenho, para o efeito de voar até você. */
  remove(id: number): { x: number; y: number; texture: string } | null {
    const drop = this.shown.get(id);
    if (!drop) return null;
    this.shown.delete(id);
    const result = { x: drop.sprite.x, y: drop.sprite.y, texture: drop.sprite.texture.key };
    drop.sprite.destroy();
    return result;
  }

  /** Onde há coisas no chão (as copas das árvores ficam transparentes em cima delas). */
  spots(): { x: number; y: number }[] {
    return [...this.shown.values()].map((d) => ({ x: d.sprite.x, y: d.sprite.y }));
  }

  /** Para os testes automáticos (`__meummo.drops()`). */
  list(): { id: number; x: number; y: number; gold: number; item: ItemStack | null }[] {
    return [...this.shown.entries()].map(([id, d]) => ({ id, x: d.x, y: d.y, gold: d.gold, item: d.item }));
  }

  update(now: number): void {
    for (const drop of this.shown.values()) {
      const baseY = (drop.y + 0.5) * T;
      const age = now - drop.bornAt;
      if (drop.hop && age < HOP_MS) {
        // pula do monstro e quica no chão
        const p = age / HOP_MS;
        drop.sprite.setY(baseY - 10 * Math.sin(p * Math.PI) * (1 - p * 0.4));
      } else {
        drop.sprite.setY(baseY);
      }
      const left = drop.until - now;
      drop.sprite.setAlpha(left < BLINK_LAST_MS && Math.floor(now / 220) % 2 === 0 ? 0.35 : 1);
    }
  }

  destroy(): void {
    for (const drop of this.shown.values()) drop.sprite.destroy();
    this.shown.clear();
  }
}
