// Objetos altos e sombras nos mapas gerados por código (camadas "acima" e "sombras" do Tiled).
// A copa das árvores grandes e o alto dos postes vão na camada "acima", que o jogo desenha por cima dos
// personagens (quem passa atrás some embaixo das folhas); o tronco, ou o pé do poste, vai na "decor" e
// bloqueia a passagem. As sombras ficam numa camada entre o chão e a "decor".

import { gid } from './tileset';

/** Árvores grandes (2 tiles de largura e 3 de altura): o prefixo dos 6 tiles de cada uma. */
export const BIG_TREES = ['tree_big', 'pine_big', 'ipe_yellow_big', 'ipe_pink_big', 'dead_tree_big'] as const;
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
