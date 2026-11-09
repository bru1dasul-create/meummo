// Pequena "tela" de pixels para desenhar arte por código (usada pelo gerador de tiles).

export type RGBA = readonly [number, number, number, number];
export type Rng = () => number;

export function hex(color: string, alpha = 255): RGBA {
  const v = parseInt(color.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, alpha];
}

/** Gerador de números aleatórios com semente: a mesma semente sempre gera a mesma arte. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}

export class Pixels {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  alpha(x: number, y: number): number {
    return this.inside(x, y) ? this.data[(y * this.width + x) * 4 + 3]! : 0;
  }

  get(x: number, y: number): RGBA {
    const i = (y * this.width + x) * 4;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!, this.data[i + 3]!];
  }

  /** Pinta um pixel. Cores com transparência são misturadas com o que já estava lá. */
  set(x: number, y: number, c: RGBA): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const i = (y * this.width + x) * 4;
    const a = c[3] / 255;
    if (a >= 1) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = 255;
      return;
    }
    const da = this.data[i + 3]! / 255;
    const outA = a + da * (1 - a);
    if (outA === 0) return;
    for (let k = 0; k < 3; k++) {
      this.data[i + k] = (c[k]! * a + this.data[i + k]! * da * (1 - a)) / outA;
    }
    this.data[i + 3] = outA * 255;
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }

  fill(c: RGBA): void {
    this.rect(0, 0, this.width, this.height, c);
  }

  /** Elipse cheia (o centro de cada pixel precisa estar dentro). */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA, onlyOpaque = false): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!onlyOpaque || this.alpha(x, y) === 255)) this.set(x, y, c);
      }
    }
  }

  disc(cx: number, cy: number, r: number, c: RGBA, onlyOpaque = false): void {
    this.ellipse(cx, cy, r, r, c, onlyOpaque);
  }

  /** Espalha pixels de cor aleatória (textura). Com onlyOpaque, só sobre o que já foi desenhado. */
  speckle(rng: Rng, colors: RGBA[], count: number, onlyOpaque = false): void {
    for (let k = 0; k < count; k++) {
      const x = randInt(rng, this.width);
      const y = randInt(rng, this.height);
      if (onlyOpaque && this.alpha(x, y) !== 255) continue;
      this.set(x, y, colors[randInt(rng, colors.length)]!);
    }
  }

  /** Contorno de 1 pixel em volta de tudo que é opaco. */
  outline(c: RGBA): void {
    const targets: [number, number][] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.alpha(x, y) === 255) continue;
        if (
          this.alpha(x - 1, y) === 255 ||
          this.alpha(x + 1, y) === 255 ||
          this.alpha(x, y - 1) === 255 ||
          this.alpha(x, y + 1) === 255
        ) {
          targets.push([x, y]);
        }
      }
    }
    for (const [x, y] of targets) this.set(x, y, c);
  }

  /** Copia outra imagem para dentro desta. */
  blit(src: Pixels, ox: number, oy: number): void {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const i = ((oy + y) * this.width + (ox + x)) * 4;
        const j = (y * src.width + x) * 4;
        for (let k = 0; k < 4; k++) this.data[i + k] = src.data[j + k]!;
      }
    }
  }
}
