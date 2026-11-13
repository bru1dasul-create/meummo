// Registros do servidor (para achar e corrigir problemas): tudo o que o servidor anota vai para a tela (a janela do
// servidor), para um arquivo por dia (saves/registros/AAAA-MM-DD.log, os últimos dias) e fica na memória (as últimas
// linhas) para a aba "Registros" do painel do administrador, que mostra e copia para mandar a quem vai corrigir.

import { appendFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

/** Quantas linhas ficam na memória para o painel. */
const MEMORY_LINES = 2000;
/** O mesmo erro repetindo (ex.: a cada tick): anota de novo no máximo a cada este tempo, com quantas vezes repetiu. */
const REPEAT_MS = 60_000;

export interface LogbookOptions {
  /** Pasta dos arquivos (null = só tela e memória, como nos testes). */
  dir: string | null;
  /** Quantos dias de arquivos guardar (os mais velhos são apagados ao ligar). */
  keepDays?: number;
  /** Mostrar na tela. */
  console?: boolean;
  now?: () => Date;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export class Logbook {
  private readonly lines: string[] = [];
  private readonly now: () => Date;
  private readonly repeats = new Map<string, { at: number; count: number }>();
  private fileFailed = false;

  constructor(private readonly options: LogbookOptions) {
    this.now = options.now ?? (() => new Date());
    if (options.dir) {
      try {
        mkdirSync(options.dir, { recursive: true });
        this.prune(options.keepDays ?? 14);
      } catch (error) {
        this.fileFailed = true;
        console.error(`Não consegui abrir a pasta dos registros (${options.dir}): ${(error as Error).message}`);
      }
    }
  }

  /** Onde ficam os arquivos (null = não guarda em arquivo). */
  get dir(): string | null {
    return this.options.dir;
  }

  /** Anota uma linha, com data e hora. */
  readonly write = (message: string): void => {
    const now = this.now();
    const line = `[${dayOf(now)} ${timeOf(now)}] ${message}`;
    this.lines.push(line);
    if (this.lines.length > MEMORY_LINES) this.lines.splice(0, this.lines.length - MEMORY_LINES);
    if (this.options.console) console.log(`[${timeOf(now)}] ${message}`);
    if (!this.options.dir || this.fileFailed) return;
    try {
      appendFileSync(path.join(this.options.dir, `${dayOf(now)}.log`), `${line}\n`, 'utf8');
    } catch (error) {
      this.fileFailed = true; // avisa uma vez só; a tela e o painel continuam funcionando
      console.error(`Não consegui gravar o registro em ${this.options.dir}: ${(error as Error).message}`);
    }
  };

  /**
   * Anota um erro com onde ele aconteceu (o "caminho" do erro, para quem vai corrigir). O mesmo erro repetindo é
   * anotado de novo só depois de REPEAT_MS, dizendo quantas vezes repetiu.
   */
  error(where: string, error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    const key = `${where}|${err.message}`;
    const now = this.now().getTime();
    const seen = this.repeats.get(key);
    if (seen && now - seen.at < REPEAT_MS) {
      seen.count += 1;
      return;
    }
    const again = seen && seen.count > 0 ? ` (repetiu ${seen.count} vez(es) no último minuto)` : '';
    this.repeats.set(key, { at: now, count: 0 });
    if (this.repeats.size > 500) this.repeats.clear();
    const stack = (err.stack ?? '').split('\n').slice(1, 6).join('\n');
    this.write(`ERRO ${where}: ${err.message}${again}${stack ? `\n${stack}` : ''}`);
  }

  /** As últimas linhas (só as que têm `filter`, sem diferença de maiúsculas), da mais antiga para a mais nova. */
  recent(limit = 500, filter = ''): string[] {
    const wanted = filter.trim().toLowerCase();
    const list = wanted ? this.lines.filter((line) => line.toLowerCase().includes(wanted)) : this.lines;
    return list.slice(-Math.max(1, limit));
  }

  /** Apaga os arquivos de registro mais velhos que `days` dias. */
  private prune(days: number): void {
    const dir = this.options.dir!;
    const oldest = dayOf(new Date(this.now().getTime() - days * 24 * 3600_000));
    for (const file of readdirSync(dir)) {
      const match = /^(\d{4}-\d{2}-\d{2})\.log$/.exec(file);
      if (match && match[1]! < oldest) rmSync(path.join(dir, file), { force: true });
    }
  }
}
