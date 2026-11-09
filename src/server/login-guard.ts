// Freio para quem tenta adivinhar senhas ou criar personagens sem parar.
// Conta tentativas numa "janela" de tempo que vai andando (as antigas vão sendo esquecidas).

export interface GuardLimits {
  /** Senhas erradas por endereço (IP) dentro da janela. */
  failsPerIp: number;
  /** Senhas erradas para o mesmo personagem (vindas de qualquer lugar) dentro da janela. */
  failsPerName: number;
  failWindowMs: number;
  /** Personagens novos por endereço dentro da janela. */
  createsPerIp: number;
  createWindowMs: number;
}

export const DEFAULT_GUARD_LIMITS: GuardLimits = {
  failsPerIp: 10,
  failsPerName: 8,
  failWindowMs: 5 * 60_000,
  createsPerIp: 20,
  createWindowMs: 60 * 60_000,
};

/** Quantas vezes algo aconteceu, por chave, nos últimos `windowMs`. */
class SlidingCount {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly windowMs: number) {}

  count(key: string, now: number): number {
    const list = this.hits.get(key);
    if (!list) return 0;
    while (list.length > 0 && list[0]! <= now - this.windowMs) list.shift();
    if (list.length === 0) this.hits.delete(key);
    return list.length;
  }

  add(key: string, now: number): void {
    const list = this.hits.get(key);
    if (list) list.push(now);
    else this.hits.set(key, [now]);
    // Muitas chaves (muitos endereços diferentes)? Joga fora o que já expirou.
    if (this.hits.size > 5000) for (const other of [...this.hits.keys()]) this.count(other, now);
  }
}

export class LoginGuard {
  private readonly ipFails: SlidingCount;
  private readonly nameFails: SlidingCount;
  private readonly creates: SlidingCount;

  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly limits: GuardLimits = DEFAULT_GUARD_LIMITS,
  ) {
    this.ipFails = new SlidingCount(limits.failWindowMs);
    this.nameFails = new SlidingCount(limits.failWindowMs);
    this.creates = new SlidingCount(limits.createWindowMs);
  }

  /** Pode tentar entrar agora? (false = errou a senha vezes demais; espere uns minutos.) */
  allowed(ip: string, nameKey: string): boolean {
    const now = this.now();
    return this.ipFails.count(ip, now) < this.limits.failsPerIp && this.nameFails.count(nameKey, now) < this.limits.failsPerName;
  }

  failed(ip: string, nameKey: string): void {
    const now = this.now();
    this.ipFails.add(ip, now);
    this.nameFails.add(nameKey, now);
  }

  canCreate(ip: string): boolean {
    return this.creates.count(ip, this.now()) < this.limits.createsPerIp;
  }

  created(ip: string): void {
    this.creates.add(ip, this.now());
  }
}
