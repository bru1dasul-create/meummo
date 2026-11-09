/**
 * "Balde de fichas": cada ação gasta uma ficha, e as fichas voltam aos poucos.
 * Permite rajadas curtas, mas segura quem tenta mandar coisa demais (spam/flood).
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    now: number,
  ) {
    this.tokens = capacity;
    this.last = now;
  }

  take(now: number, cost = 1): boolean {
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSecond);
    this.last = now;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}
