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
  /** Cada tecla física conta até ser solta, mesmo que outra aponte para o mesmo lado. */
  private readonly held = new Map<string, Dir>();

  constructor(private readonly isBlocked: () => boolean) {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.clear);
  }

  current(): HeldMove | null {
    if (this.isBlocked()) {
      this.clear();
      return null;
    }
    // A tecla mais recente de cada eixo vale (ex.: segurou A e depois D: vai para a direita).
    let vertical: Dir | undefined;
    let horizontal: Dir | undefined;
    let last: Dir | undefined;
    for (const dir of this.held.values()) {
      if (dir === UP || dir === DOWN) vertical = dir;
      else horizontal = dir;
      last = dir;
    }
    if (vertical !== undefined && horizontal !== undefined) {
      const verticalIsNewer = last === vertical;
      return { dir: combineDirs(vertical, horizontal), fallbacks: verticalIsNewer ? [vertical, horizontal] : [horizontal, vertical] };
    }
    const single = vertical ?? horizontal;
    return single === undefined ? null : { dir: single, fallbacks: [] };
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
    if (!event.repeat) this.held.set(event.code, dir);
  };

  private readonly up = (event: KeyboardEvent) => {
    this.held.delete(event.code);
  };

  readonly clear = () => {
    this.held.clear();
  };
}
