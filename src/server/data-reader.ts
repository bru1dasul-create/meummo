// Ajuda a ler os arquivos de dados (data/*.json): confere cada campo e, se algo estiver errado,
// explica em português qual arquivo, onde e o que está errado.

export class Reader {
  constructor(
    private readonly data: Record<string, unknown>,
    /** Arquivo, para a mensagem de erro (ex.: 'data/monsters.json'). */
    private readonly file: string,
    /** Onde no arquivo (ex.: 'monstro "saci"'). */
    private readonly where: string,
  ) {}

  fail(field: string, what: string): never {
    throw new Error(`Erro em ${this.file} (${this.where}): o campo "${field}" ${what}.`);
  }

  has(field: string): boolean {
    return this.data[field] !== undefined;
  }

  number(field: string, opts: { min?: number; fallback?: number } = {}): number {
    const value = this.data[field] ?? opts.fallback;
    if (typeof value !== 'number' || !Number.isFinite(value)) this.fail(field, 'precisa ser um número');
    if (opts.min !== undefined && value < opts.min) this.fail(field, `precisa ser pelo menos ${opts.min}`);
    return value;
  }

  bool(field: string, fallback?: boolean): boolean {
    const value = this.data[field] ?? fallback;
    if (typeof value !== 'boolean') this.fail(field, 'precisa ser true ou false');
    return value;
  }

  text(field: string, fallback?: string): string {
    const value = this.data[field] ?? fallback;
    if (typeof value !== 'string' || !value.trim()) this.fail(field, 'precisa ser um texto');
    return value.trim();
  }

  /** Texto opcional (sem o campo = texto vazio). */
  optionalText(field: string): string {
    const value = this.data[field];
    if (value === undefined) return '';
    if (typeof value !== 'string') this.fail(field, 'precisa ser um texto');
    return value.trim();
  }

  range(field: string): [number, number] {
    const value = this.data[field];
    if (!Array.isArray(value) || value.length !== 2 || !value.every((v) => typeof v === 'number' && v >= 0) || value[0] > value[1]) {
      this.fail(field, 'precisa ser [mínimo, máximo], por exemplo [2, 5]');
    }
    return [value[0], value[1]];
  }

  object(field: string, optional = false): Record<string, unknown> | null {
    const value = this.data[field];
    if (value === undefined && optional) return null;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) this.fail(field, 'precisa ser um objeto { ... }');
    return value as Record<string, unknown>;
  }

  /** Lista opcional (sem o campo = lista vazia). */
  list(field: string): unknown[] {
    const value = this.data[field];
    if (value === undefined) return [];
    if (!Array.isArray(value)) this.fail(field, 'precisa ser uma lista [ ... ]');
    return value;
  }

  /** Quantidade que pode ser zero (ex.: ouro): um número (ex.: 5) ou [mínimo, máximo] (ex.: [0, 3]). Sem o campo = [0, 0]. */
  wholeRange(field: string): [number, number] {
    const value = this.data[field] ?? 0;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return [value, value];
    if (Array.isArray(value) && value.length === 2 && value.every((v) => Number.isInteger(v) && v >= 0) && value[0] <= value[1]) {
      return [value[0], value[1]];
    }
    this.fail(field, 'precisa ser um número inteiro (ex.: 5) ou [mínimo, máximo] (ex.: [2, 6])');
  }

  /** Quantidade: um número (ex.: 2) ou [mínimo, máximo] (ex.: [1, 3]). Sem o campo = 1. */
  amount(field: string): [number, number] {
    const value = this.data[field] ?? 1;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1) return [value, value];
    if (Array.isArray(value) && value.length === 2 && value.every((v) => Number.isInteger(v) && v >= 1) && value[0] <= value[1]) {
      return [value[0], value[1]];
    }
    this.fail(field, 'precisa ser um número inteiro (ex.: 2) ou [mínimo, máximo] (ex.: [1, 3])');
  }
}
