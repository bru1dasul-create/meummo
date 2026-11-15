// O relógio do dia e noite do servidor: um só para todos os mapas (o reino cria e passa para cada mundo). Ele anda com
// o relógio de verdade (Date.now), então continua de onde estava depois que o servidor reinicia; nos testes, com o
// relógio falso. O administrador pode virar para o começo do dia, da tarde (o anoitecer) ou da noite (menu ADM), para
// testar sem esperar.

import { cyclePosition, isNightAt, twilightMs, type DayNightLengths } from '../shared/dayNight';

/** 'tarde' = o começo do anoitecer: escurece devagar até a noite (para ver o pôr do sol sem esperar o dia todo). */
export type DayPhase = 'dia' | 'tarde' | 'noite';

export class DayNightClock {
  /** O quanto o administrador adiantou ou voltou o relógio (ms). */
  private offset = 0;

  constructor(
    /** Quanto dura o dia e a noite: o objeto dos números do combate (o painel muda na hora). */
    private readonly rules: DayNightLengths,
    private readonly wallNow: () => number = Date.now,
  ) {}

  /** Em que ponto do ciclo estamos (ms; de 0 até dayMs é dia). */
  position(): number {
    return cyclePosition(this.wallNow() + this.offset, this.rules);
  }

  isNight(): boolean {
    return isNightAt(this.position(), this.rules);
  }

  /** Vira para o começo do dia, do anoitecer ou da noite (vale para todos os mapas). */
  turnTo(phase: DayPhase): void {
    const target = phase === 'dia' ? 0 : phase === 'tarde' ? this.rules.dayMs - twilightMs(this.rules) : this.rules.dayMs;
    this.offset += target - this.position();
  }
}
