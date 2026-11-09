// O "pincel" do personagem: desenha formas com volume (esfera, cápsula, polígono) já sombreadas em
// tons de pixel art, numa tela do tamanho de um quadro. Cada forma pertence a uma "parte" (braço, tronco,
// chapéu...). No fim, `finish` faz o acabamento que um pixel artist faria à mão:
//   - linha interna mais escura onde uma parte passa NA FRENTE de outra (braço sobre o tronco);
//   - contorno externo colorido (a cor vizinha bem escura, não preto puro).

import { darken, type Material } from './palette';
import { rgba, Sheet } from './sheet';

export type Vec = readonly [number, number];
/** Normal "3D" de um pixel da forma: x para a direita, y para baixo, z saindo da tela. */
type Normal = [number, number, number];

/** De onde vem a luz: de cima, da esquerda e da frente. */
const LIGHT: Normal = (() => {
  const v: Normal = [-0.5, -0.62, 0.6];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

/** Escolhe o tom da rampa (0 = sombra forte ... 4 = brilho) pela luz que bate no pixel. */
export function tone(nx: number, ny: number, nz: number, shiny: boolean, bias = 0): number {
  const light = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + bias;
  if (light > (shiny ? 0.86 : 0.97)) return 4;
  if (light > (shiny ? 0.62 : 0.7)) return 3;
  if (light > 0.36) return 2;
  if (light > 0.08) return 1;
  return 0;
}

export interface ShapeOptions {
  /** Ajuste fino da luz (negativo = mais na sombra, ex.: o que fica atrás do corpo). */
  bias?: number;
  /** Só desenha onde isto for verdadeiro (recortes: aba do capacete, franja...). */
  clip?: (x: number, y: number) => boolean;
  /** Troca o tom calculado (texturas: trama da palha, dobras da capa...). */
  pattern?: (x: number, y: number, tone: number) => number;
}

export class Canvas {
  readonly color: (string | null)[];
  /** Número da parte que pintou cada pixel (0 = vazio). */
  private readonly owner: Uint16Array;
  /** Grupo de cada parte (número, para comparar rápido). */
  private readonly groupOf: number[] = [0];
  private readonly groups = new Map<string, number>();
  private current = 0;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.color = new Array<string | null>(width * height).fill(null);
    this.owner = new Uint16Array(width * height);
  }

  /** Começa uma parte nova. Partes do mesmo grupo (ex.: coxa e canela) não ganham linha entre si. */
  part(group: string): this {
    let id = this.groups.get(group);
    if (id === undefined) {
      id = this.groups.size + 1;
      this.groups.set(group, id);
    }
    this.groupOf.push(id);
    this.current = this.groupOf.length - 1;
    return this;
  }

  /** Pinta um pixel com uma cor pronta. */
  dot(x: number, y: number, color: string): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.width + x;
    this.color[i] = color;
    this.owner[i] = this.current;
  }

  filled(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height && this.color[y * this.width + x] !== null;
  }

  private shade(x: number, y: number, nx: number, ny: number, nz: number, mat: Material, o: ShapeOptions): void {
    const px = x + 0.5;
    const py = y + 0.5;
    if (o.clip && !o.clip(px, py)) return;
    let t = tone(nx, ny, nz, mat.shiny, o.bias ?? 0);
    if (o.pattern) t = Math.max(0, Math.min(4, o.pattern(px, py, t)));
    this.dot(x, y, mat.ramp[t]!);
  }

  /** Elipse com sombreado de esfera (cabeça, mãos, ombreiras...). */
  ellipse(c: Vec, rx: number, ry: number, mat: Material, o: ShapeOptions = {}): this {
    for (let y = Math.floor(c[1] - ry); y <= Math.ceil(c[1] + ry); y++) {
      for (let x = Math.floor(c[0] - rx); x <= Math.ceil(c[0] + rx); x++) {
        const nx = (x + 0.5 - c[0]) / rx;
        const ny = (y + 0.5 - c[1]) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        this.shade(x, y, nx, ny, Math.sqrt(1 - d), mat, o);
      }
    }
    return this;
  }

  /** Cápsula (cilindro com pontas redondas) de `a` até `b`, com raio indo de ra até rb (braços, pernas, cabos). */
  capsule(a: Vec, b: Vec, ra: number, rb: number, mat: Material, o: ShapeOptions = {}): this {
    const r = Math.max(ra, rb);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1e-6;
    for (let y = Math.floor(Math.min(a[1], b[1]) - r); y <= Math.ceil(Math.max(a[1], b[1]) + r); y++) {
      for (let x = Math.floor(Math.min(a[0], b[0]) - r); x <= Math.ceil(Math.max(a[0], b[0]) + r); x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
        const cx = a[0] + dx * t;
        const cy = a[1] + dy * t;
        const radius = ra + (rb - ra) * t;
        const ox = (px - cx) / radius;
        const oy = (py - cy) / radius;
        const d = ox * ox + oy * oy;
        if (d > 1) continue;
        this.shade(x, y, ox, oy, Math.sqrt(1 - d), mat, o);
      }
    }
    return this;
  }

  /**
   * Polígono (tronco, capa, lâmina...). O volume vem de `normal` (padrão: cilindro em pé, com o centro
   * em `axis` e meia largura `half`).
   */
  polygon(points: readonly Vec[], mat: Material, o: ShapeOptions & { normal?: (x: number, y: number) => Normal } = {}): this {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const half = Math.max(1, (Math.max(...xs) - Math.min(...xs)) / 2);
    const normal = o.normal ?? ((x: number) => cylinder((x - cx) / half));
    const cuts: number[] = [];
    // linha por linha: acha onde as bordas cruzam o meio da linha e pinta entre os cruzamentos
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(this.height - 1, Math.ceil(Math.max(...ys))); y++) {
      const py = y + 0.5;
      cuts.length = 0;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i]!;
        const [xj, yj] = points[j]!;
        if (yi > py !== yj > py) cuts.push(((xj - xi) * (py - yi)) / (yj - yi) + xi);
      }
      cuts.sort((a, b) => a - b);
      for (let k = 0; k + 1 < cuts.length; k += 2) {
        // pixels cujo centro (x + 0.5) cai dentro do trecho
        for (let x = Math.ceil(cuts[k]! - 0.5); x + 0.5 < cuts[k + 1]!; x++) {
          const n = normal(x + 0.5, py);
          this.shade(x, y, n[0], n[1], n[2], mat, o);
        }
      }
    }
    return this;
  }

  /** Linha fina de uma cor (corda do arco, costuras, cordão do colar). */
  line(a: Vec, b: Vec, color: string): this {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.dot(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, color);
    }
    return this;
  }

  /**
   * Acabamento e cópia para a folha: linha interna onde uma parte cobre outra que foi desenhada antes,
   * e contorno externo.
   */
  finish(sheet: Sheet, ox: number, oy: number): void {
    const w = this.width;
    const h = this.height;
    const color = this.color;
    const owner = this.owner;
    const groupOf = this.groupOf;
    // vizinho (direita, esquerda, baixo, cima) do pixel i, ou -1 fora da tela
    const near = (x: number, y: number, k: number): number =>
      k === 0 ? (x + 1 < w ? y * w + x + 1 : -1) : k === 1 ? (x > 0 ? y * w + x - 1 : -1) : k === 2 ? (y + 1 < h ? (y + 1) * w + x : -1) : y > 0 ? (y - 1) * w + x : -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const c = color[i];
        let out: string | null = c;
        if (!c) {
          // contorno: o vizinho desenhado, bem escuro
          for (let k = 0; k < 4; k++) {
            const n = near(x, y, k);
            const nc = n >= 0 ? color[n] : null;
            if (nc) {
              out = darken(nc, 0.34);
              break;
            }
          }
        } else {
          // linha interna: esta parte está na frente (foi desenhada depois) de uma vizinha de outro grupo
          const me = owner[i]!;
          for (let k = 0; k < 4; k++) {
            const n = near(x, y, k);
            if (n < 0) continue;
            const other = owner[n]!;
            if (other !== 0 && other < me && groupOf[other] !== groupOf[me]) {
              out = darken(c, 0.62);
              break;
            }
          }
        }
        if (out) sheet.set(ox + x, oy + y, rgba(out));
      }
    }
  }
}

/** Normal de um cilindro em pé: u = posição de −1 (borda esquerda) a 1 (borda direita). */
export function cylinder(u: number, tilt = 0): Normal {
  const x = Math.max(-1, Math.min(1, u));
  return [x, tilt, Math.sqrt(Math.max(0, 1 - x * x))];
}

// ---------- pequenas contas de vetor ----------

export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
export const len = (a: Vec): number => Math.hypot(a[0], a[1]);
export const lerp = (a: Vec, b: Vec, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Vetor de tamanho 1 para o ângulo (graus): 0 = para cima, 90 = para a direita, 180 = para baixo. */
export const dirOf = (degrees: number): Vec => {
  const r = (degrees * Math.PI) / 180;
  return [Math.sin(r), -Math.cos(r)];
};
/** Perpendicular (gira 90° no sentido do relógio). */
export const perp = (a: Vec): Vec => [-a[1], a[0]];

/**
 * Cinemática inversa de 2 ossos: onde fica o cotovelo/joelho para a mão/pé chegar em `target`.
 * `bend` diz para que lado a junta dobra (+1 ou −1).
 */
export function joint(root: Vec, target: Vec, a: number, b: number, bend: number): Vec {
  const d = sub(target, root);
  const dist = Math.min(len(d), a + b - 0.01);
  if (dist < 1e-3) return add(root, [0, a]);
  const dir = scale(d, 1 / len(d));
  const cos = Math.max(-1, Math.min(1, (a * a + dist * dist - b * b) / (2 * a * dist)));
  const angle = Math.acos(cos) * bend;
  const rot: Vec = [dir[0] * Math.cos(angle) - dir[1] * Math.sin(angle), dir[0] * Math.sin(angle) + dir[1] * Math.cos(angle)];
  return add(root, scale(rot, a));
}
