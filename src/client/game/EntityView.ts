// Como uma entidade (jogador) aparece na tela: sprite, sombra, nome e balão de fala.
// A posição "de verdade" é em tiles; aqui fazemos a animação suave entre um tile e outro.

import type Phaser from 'phaser';
import { TILE_SIZE } from '../../shared/constants';
import { LEFT, type Dir } from '../../shared/dir';
import type { EntityState } from '../../shared/protocol';
import { characterFrame, characterTexture } from './characters';

const BUBBLE_MS = 5000;

/** Pixel dos pés do personagem no tile (x, y). */
function feetOf(x: number, y: number): [number, number] {
  return [x * TILE_SIZE + TILE_SIZE / 2, (y + 1) * TILE_SIZE];
}

export class EntityView {
  readonly id: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  tileX: number;
  tileY: number;
  dir: Dir;

  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly tag: HTMLDivElement;
  private bubble: HTMLDivElement | null = null;
  private bubbleTimer: number | undefined;
  private fromX: number;
  private fromY: number;
  private toX: number;
  private toY: number;
  private moveStart = 0;
  private moveDuration = 0;
  private steps = 0;

  constructor(scene: Phaser.Scene, labels: HTMLElement, state: EntityState, isSelf: boolean) {
    this.id = state.id;
    this.tileX = state.x;
    this.tileY = state.y;
    this.dir = state.dir;
    const [px, py] = feetOf(state.x, state.y);
    this.fromX = this.toX = px;
    this.fromY = this.toY = py;

    this.shadow = scene.add.ellipse(px, py - 1.5, 10, 4, 0x000000, 0.28);
    this.sprite = scene.add.sprite(px, py, characterTexture(scene, state.look), 0).setOrigin(0.5, 1);

    this.tag = document.createElement('div');
    this.tag.className = isSelf ? 'tag self' : 'tag';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = state.name;
    this.tag.append(name);
    labels.append(this.tag);
    this.update(performance.now());
  }

  /** Manda a entidade para o tile (x, y). Um ou dois tiles de distância: anda; mais que isso: pula. */
  moveTo(x: number, y: number, dir: Dir, now: number, stepMs: number): void {
    this.dir = dir;
    const distance = Math.abs(x - this.tileX) + Math.abs(y - this.tileY);
    if (distance === 0) return;
    this.tileX = x;
    this.tileY = y;
    const [px, py] = feetOf(x, y);
    if (distance > 2) {
      this.fromX = this.toX = px;
      this.fromY = this.toY = py;
      this.moveDuration = 0;
      return;
    }
    const current = this.position(now);
    this.fromX = current.x;
    this.fromY = current.y;
    this.toX = px;
    this.toY = py;
    this.moveStart = now;
    this.moveDuration = stepMs * distance;
    this.steps++;
  }

  /** Atualiza sprite e sombra para o momento `now`. Chamado todo quadro. */
  update(now: number): void {
    const { x, y, moving } = this.position(now);
    this.sprite.setPosition(x, y);
    this.sprite.setFrame(characterFrame(this.dir, moving ? (this.steps % 2 === 0 ? 1 : 2) : 0));
    this.sprite.setFlipX(this.dir === LEFT);
    this.sprite.setDepth(y);
    this.shadow.setPosition(x, y - 1.5);
    this.shadow.setDepth(y - 0.5);
  }

  /** Posiciona nome e balão por cima do personagem, em pixels da tela. */
  syncLabel(camera: Phaser.Cameras.Scene2D.Camera): void {
    const x = (this.sprite.x - camera.worldView.x) * camera.zoom;
    const y = (this.sprite.y - TILE_SIZE - camera.worldView.y) * camera.zoom;
    this.tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  say(text: string): void {
    if (!this.bubble) {
      this.bubble = document.createElement('div');
      this.bubble.className = 'bubble';
      this.tag.prepend(this.bubble);
    }
    this.bubble.textContent = text;
    window.clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => {
      this.bubble?.remove();
      this.bubble = null;
    }, BUBBLE_MS);
  }

  destroy(): void {
    window.clearTimeout(this.bubbleTimer);
    this.sprite.destroy();
    this.shadow.destroy();
    this.tag.remove();
  }

  private position(now: number): { x: number; y: number; moving: boolean } {
    if (this.moveDuration <= 0) return { x: this.toX, y: this.toY, moving: false };
    const t = Math.min(1, (now - this.moveStart) / this.moveDuration);
    return {
      x: this.fromX + (this.toX - this.fromX) * t,
      y: this.fromY + (this.toY - this.fromY) * t,
      moving: t < 1,
    };
  }
}
