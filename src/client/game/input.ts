// Teclado: para onde o jogador quer andar agora (8 direções: W+D = diagonal).

import { combineDirs, DOWN, LEFT, RIGHT, UP, type Dir } from '../../shared/dir';

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

/** Direção pedida pelo teclado e, se for diagonal, para onde "escorregar" quando ela estiver bloqueada. */
export interface HeldMove {
  dir: Dir;
  /** Direções retas para tentar se a diagonal bater numa parede (a tecla mais recente primeiro). */
  fallbacks: Dir[];
}

export class KeyboardDirections {
  /** Teclas seguradas, na ordem em que foram apertadas. */
  private held: Dir[] = [];

  constructor(private readonly isBlocked: () => boolean) {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.clear);
  }

  current(): HeldMove | null {
    if (this.isBlocked()) {
      this.held = [];
      return null;
    }
    // A tecla mais recente de cada eixo vale (ex.: segurou A e depois D: vai para a direita).
    const vertical = this.lastOf(UP, DOWN);
    const horizontal = this.lastOf(LEFT, RIGHT);
    if (vertical !== null && horizontal !== null) {
      const verticalIsNewer = this.held.lastIndexOf(vertical) > this.held.lastIndexOf(horizontal);
      return { dir: combineDirs(vertical, horizontal), fallbacks: verticalIsNewer ? [vertical, horizontal] : [horizontal, vertical] };
    }
    const single = vertical ?? horizontal;
    return single === null ? null : { dir: single, fallbacks: [] };
  }

  destroy(): void {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.clear);
  }

  private lastOf(a: Dir, b: Dir): Dir | null {
    const ia = this.held.lastIndexOf(a);
    const ib = this.held.lastIndexOf(b);
    if (ia === -1 && ib === -1) return null;
    return ia > ib ? a : b;
  }

  private readonly down = (event: KeyboardEvent) => {
    const dir = KEY_DIRS[event.code];
    if (dir === undefined || this.isBlocked()) return;
    event.preventDefault();
    // W e seta para cima são a mesma direção: guarda só uma vez, na posição mais recente
    this.held = this.held.filter((d) => d !== dir);
    this.held.push(dir);
  };

  private readonly up = (event: KeyboardEvent) => {
    const dir = KEY_DIRS[event.code];
    if (dir !== undefined) this.held = this.held.filter((d) => d !== dir);
  };

  private readonly clear = () => {
    this.held = [];
  };
}
