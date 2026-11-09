// Objetos altos e sombras nos mapas gerados por código (camadas "acima" e "sombras" do Tiled).
// A copa das árvores grandes e o alto dos postes vão na camada "acima", que o jogo desenha por cima dos
// personagens (quem passa atrás some embaixo das folhas); o tronco, ou o pé do poste, vai na "decor" e
// bloqueia a passagem. As sombras ficam numa camada entre o chão e a "decor".

import { EDGE_CORNERS, gid, TILES } from './tileset';

/** Árvores grandes (2 tiles de largura e 3 de altura): o prefixo dos 6 tiles de cada uma. */
export const BIG_TREES = ['tree_big', 'pine_big', 'ipe_yellow_big', 'ipe_pink_big', 'dead_tree_big', 'buriti_big'] as const;
export type BigTree = (typeof BIG_TREES)[number];

export class DepthLayers {
  /** Camada "acima": copas e alto dos postes. */
  readonly above: number[];
  /** Camada "sombras". */
  readonly shade: number[];

  constructor(
    readonly W: number,
    readonly H: number,
    private readonly decor: number[],
  ) {
    this.above = new Array<number>(W * H).fill(0);
    this.shade = new Array<number>(W * H).fill(0);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.W && y < this.H;
  }

  /** Tem copa (ou alto de poste) em cima deste tile? */
  covered(x: number, y: number): boolean {
    return this.inside(x, y) && this.above[y * this.W + x] !== 0;
  }

  /**
   * Planta uma árvore grande com o tronco em (x, y) e (x + 1, y) e a copa nas duas linhas de cima.
   * Não cabe se o tronco cair em cima de outra coisa ou se a copa encostar em outra copa.
   * `canCover` diz onde a copa pode ficar (ex.: em cima de trilhas e decks, não).
   */
  plantBigTree(kind: BigTree, x: number, y: number, canCover: (x: number, y: number) => boolean): boolean {
    if (y < 1) return false; // na primeira linha, a copa ficaria toda fora do mapa (sobraria só um toco)
    for (const tx of [x, x + 1]) if (!this.inside(tx, y) || this.decor[y * this.W + tx]) return false;
    for (let dy = -2; dy <= -1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        if (!this.inside(x + dx, y + dy)) continue; // a copa pode passar da borda de cima do mapa
        if (this.covered(x + dx, y + dy) || !canCover(x + dx, y + dy)) return false;
      }
    }
    this.decor[y * this.W + x] = gid(`${kind}_bl`);
    this.decor[y * this.W + x + 1] = gid(`${kind}_br`);
    for (const [part, dx, dy] of [
      ['tl', 0, -2],
      ['tr', 1, -2],
      ['ml', 0, -1],
      ['mr', 1, -1],
    ] as const) {
      if (this.inside(x + dx, y + dy)) this.above[(y + dy) * this.W + x + dx] = gid(`${kind}_${part}`);
    }
    return true;
  }

  /** Poste alto: o pé em (x, y) e o alto em (x, y - 1). */
  tallPole(prefix: 'lamp_post_tall' | 'pole_wires_tall', x: number, y: number): boolean {
    if (!this.inside(x, y) || this.decor[y * this.W + x] || this.covered(x, y - 1)) return false;
    this.decor[y * this.W + x] = gid(`${prefix}_base`);
    if (this.inside(x, y - 1)) this.above[(y - 1) * this.W + x] = gid(`${prefix}_top`);
    return true;
  }

  /**
   * Abre um caminho: tira tudo do retângulo (enfeites, mato) e as árvores grandes e postes altos que encostam nele
   * (inteiros: tronco e copa, pé e alto). Não sorteia nada, então pode rodar no fim do gerador sem mudar o resto.
   */
  clearArea(x0: number, y0: number, x1: number, y1: number): void {
    const keyAt = (layer: number[], x: number, y: number) => (this.inside(x, y) ? TILES[layer[y * this.W + x]! - 1]?.key : undefined);
    const clear = (layer: number[], x: number, y: number) => {
      if (this.inside(x, y)) layer[y * this.W + x] = 0;
    };
    const removeTree = (kind: string, x: number, y: number) => {
      // (x, y) = o pé esquerdo do tronco
      for (const [dx, dy, layer] of [
        [0, 0, this.decor],
        [1, 0, this.decor],
        [0, -1, this.above],
        [1, -1, this.above],
        [0, -2, this.above],
        [1, -2, this.above],
      ] as const) {
        if (keyAt(layer, x + dx, y + dy)?.startsWith(`${kind}_`)) clear(layer, x + dx, y + dy);
      }
    };
    const trunkOffset: Record<string, [number, number]> = { tl: [0, 2], tr: [-1, 2], ml: [0, 1], mr: [-1, 1], bl: [0, 0], br: [-1, 0] };
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        for (const layer of [this.above, this.decor]) {
          const key = keyAt(layer, x, y);
          if (!key) continue;
          const kind = BIG_TREES.find((k) => key.startsWith(`${k}_`));
          if (kind) {
            const [dx, dy] = trunkOffset[key.slice(kind.length + 1)] ?? [0, 0];
            removeTree(kind, x + dx, y + dy);
          } else if (key.endsWith('_tall_top')) {
            clear(this.above, x, y);
            clear(this.decor, x, y + 1);
          } else if (key.endsWith('_tall_base')) {
            clear(this.decor, x, y);
            clear(this.above, x, y - 1);
          } else {
            clear(layer, x, y);
          }
        }
      }
    }
  }

  /** Sombra de um bloco (casa, prédio) que vai de (x0, y0) até (x1, y1): o sol vem do noroeste, então ela cai ao sul e a leste. */
  shadeBlock(x0: number, y0: number, x1: number, y1: number, canShade: (x: number, y: number) => boolean): void {
    const put = (x: number, y: number, key: string) => {
      if (this.inside(x, y) && canShade(x, y)) this.shade[y * this.W + x] = gid(key);
    };
    for (let x = x0; x <= x1; x++) put(x, y1 + 1, 'shade_s');
    for (let y = y0 + 1; y <= y1; y++) put(x1 + 1, y, 'shade_e');
    put(x1 + 1, y1 + 1, 'shade_se');
  }
}

/** A lista embaralhada (com o sorteio do mapa, para o mapa sair sempre igual). */
export function shuffled<T>(list: readonly T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** As camadas novas no formato do Tiled (para pôr na lista de camadas do mapa). */
export function depthTileLayers(depth: DepthLayers): { shade: object; above: object } {
  const layer = (id: number, name: string, data: number[]) => ({ id, name, type: 'tilelayer', width: depth.W, height: depth.H, x: 0, y: 0, opacity: 1, visible: true, data });
  return { shade: layer(6, 'sombras', depth.shade), above: layer(7, 'acima', depth.above) };
}

/** Uma regra de beirada: tiles do terreno `base` que encostam no terreno de `touches` viram os tiles `set_...`. */
export interface EdgeRule {
  base: readonly string[];
  set: string;
  touches: (x: number, y: number) => boolean;
}

/**
 * Troca o chão que encosta em outro terreno pelos tiles de beirada suave (vale a primeira regra que servir).
 * Rode no fim do gerador: depois disso, a areia da beira deixa de ser "areia" e vira "areia com beirada".
 * Com `out`, a beirada vai para outra camada (ex.: "sombras") e o chão fica como está. Devolve quantos tiles mudaram.
 */
export function softenEdges(ground: number[], W: number, H: number, rules: readonly EdgeRule[], out: number[] = ground): number {
  const original = [...ground];
  const sides = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const;
  const corners = [
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ] as const;
  let changed = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (const rule of rules) {
        if (!rule.base.some((key) => original[i] === gid(key))) continue;
        let mask = 0;
        sides.forEach(([dx, dy], bit) => {
          if (rule.touches(x + dx, y + dy)) mask |= 1 << bit;
        });
        const corner = mask ? -1 : corners.findIndex(([dx, dy]) => rule.touches(x + dx, y + dy));
        if (!mask && corner < 0) continue;
        out[i] = gid(mask ? `${rule.set}_${mask}` : `${rule.set}_c_${EDGE_CORNERS[corner]}`);
        changed++;
        break;
      }
    }
  }
  return changed;
}
