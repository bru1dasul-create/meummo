// O relógio do jogo com ritmo (câmera lenta do painel de ajustes, pedido do dono, 17/11): anda `scale` vezes o relógio
// de verdade (1 = normal; 0,5 = metade; 0,25 = um quarto). Trocar o ritmo não dá salto: continua de onde estava. O
// servidor e o navegador usam um cada (o servidor avisa o ritmo com `pace`), então tudo o que é contado por ele —
// passos, tiros, recargas, golpes dos bichos — fica lento junto.

export const PACES = [0.25, 0.5, 1] as const;
export type Pace = (typeof PACES)[number];

export class PacedClock {
  private scale = 1;
  private base: number;
  private realBase: number;

  constructor(private readonly real: () => number) {
    this.realBase = real();
    this.base = this.realBase; // começa igual ao relógio de verdade
  }

  now(): number {
    return this.base + (this.real() - this.realBase) * this.scale;
  }

  get pace(): number {
    return this.scale;
  }

  setPace(scale: number): void {
    this.base = this.now();
    this.realBase = this.real();
    this.scale = scale;
  }
}
