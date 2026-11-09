// Uma "folha" de pixels em memória (RGBA), sem depender do navegador: assim o mesmo desenho do
// personagem funciona no jogo, nos testes e no script que gera a prancha de prévia (docs/personagens.png).

export type RGBA = readonly [number, number, number, number];

const cache = new Map<string, RGBA>();

/** '#rrggbb' → [r, g, b, 255]. */
export function rgba(color: string): RGBA {
  let found = cache.get(color);
  if (!found) {
    const v = parseInt(color.slice(1, 7), 16);
    found = [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
    cache.set(color, found);
  }
  return found;
}

export class Sheet {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  /** Pinta um pixel (fora da folha, nada acontece). */
  set(x: number, y: number, color: RGBA): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = color[0];
    this.data[i + 1] = color[1];
    this.data[i + 2] = color[2];
    this.data[i + 3] = color[3];
  }

  solid(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height && this.data[(y * this.width + x) * 4 + 3]! > 0;
  }
}
