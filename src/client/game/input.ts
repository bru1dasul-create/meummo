// Teclado: qual direção o jogador está segurando agora.

import { DOWN, LEFT, RIGHT, UP, type Dir } from '../../shared/dir';

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: UP,
  KeyW: UP,
  ArrowRight: RIGHT,
  KeyD: RIGHT,
  ArrowDown: DOWN,
  KeyS: DOWN,
  ArrowLeft: LEFT,
  KeyA: LEFT,
};

export class KeyboardDirections {
  /** Teclas seguradas, na ordem em que foram apertadas (a última vale). */
  private held: Dir[] = [];

  constructor(private readonly isBlocked: () => boolean) {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.clear);
  }

  current(): Dir | null {
    if (this.isBlocked()) {
      this.held = [];
      return null;
    }
    return this.held.at(-1) ?? null;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.clear);
  }

  private readonly down = (event: KeyboardEvent) => {
    const dir = KEY_DIRS[event.code];
    if (dir === undefined || this.isBlocked()) return;
    event.preventDefault();
    if (!this.held.includes(dir)) this.held.push(dir);
  };

  private readonly up = (event: KeyboardEvent) => {
    const dir = KEY_DIRS[event.code];
    if (dir !== undefined) this.held = this.held.filter((d) => d !== dir);
  };

  private readonly clear = () => {
    this.held = [];
  };
}
