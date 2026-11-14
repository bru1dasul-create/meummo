// O relógio do dia e noite do servidor: um só para todos os mapas (o reino cria e passa para cada mundo). Ele anda com
// o relógio de verdade (Date.now), então continua de onde estava depois que o servidor reinicia; nos testes, com o
// relógio falso. O administrador pode virar para o começo do dia ou da noite (menu ADM), para testar sem esperar.

import { cyclePosition, isNightAt, type DayNightLengths } from '../shared/dayNight';

export type DayPhase = 'dia' | 'noite';

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

  /** Vira para o começo do dia ou da noite (vale para todos os mapas). */
  turnTo(phase: DayPhase): void {
    const target = phase === 'dia' ? 0 : this.rules.dayMs;
    this.offset += target - this.position();
  }
}
