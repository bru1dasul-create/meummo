// O vento do mundo (pedido do dono, 14/11: "vento forte/fraco"): um só para todos os mapas, como o sol. Fica calmo,
// em brisa ou forte por uns minutos e muda devagar; a direção gira um pouco a cada mudança. É só desenho (as árvores
// balançam) e som (o vento da mata): não mexe em tiro nem em andar.

import { WIND_MAX_MS, WIND_MIN_MS, WIND_TRANSITION_MS } from '../shared/constants';
import type { ServerMsg, WindLevel } from '../shared/protocol';

/** A força de cada jeito do vento (sorteada nessa faixa) e a chance de cada um. */
const LEVELS: Record<WindLevel, { min: number; max: number; chance: number }> = {
  calmo: { min: 0.05, max: 0.2, chance: 0.3 },
  brisa: { min: 0.3, max: 0.5, chance: 0.5 },
  forte: { min: 0.75, max: 1, chance: 0.2 },
};

export class WindWeather {
  level: WindLevel = 'brisa';
  strength = 0.35;
  /** Para onde sopra (graus no chão: 0 = leste, 90 = sul). */
  angle: number;
  private nextShiftAt: number;

  constructor(
    private readonly now: () => number,
    private readonly random: () => number = Math.random,
  ) {
    this.angle = Math.round(random() * 360) % 360;
    this.nextShiftAt = now() + this.duration();
  }

  /** A cada tick: chegou a hora de mudar? Devolve true quando muda (quem está jogando recebe `message()`). */
  update(): boolean {
    if (this.now() < this.nextShiftAt) return false;
    this.shift(this.pick());
    return true;
  }

  /** O administrador mudou o vento (menu ADM). */
  set(level: WindLevel): void {
    this.shift(level);
  }

  /** A mensagem para o navegador: a força e a direção novas, alcançadas em `ms`. */
  message(ms = WIND_TRANSITION_MS): Extract<ServerMsg, { t: 'wind' }> {
    return { t: 'wind', strength: this.strength, angle: this.angle, ms };
  }

  private shift(level: WindLevel): void {
    const l = LEVELS[level];
    this.level = level;
    this.strength = Math.round((l.min + this.random() * (l.max - l.min)) * 100) / 100;
    // a direção gira até 30° para cada lado
    this.angle = Math.round((((this.angle + (this.random() - 0.5) * 60) % 360) + 360) % 360);
    this.nextShiftAt = this.now() + this.duration();
  }

  private pick(): WindLevel {
    let r = this.random();
    for (const level of ['calmo', 'brisa', 'forte'] as const) {
      r -= LEVELS[level].chance;
      if (r < 0) return level;
    }
    return 'brisa';
  }

  private duration(): number {
    return WIND_MIN_MS + this.random() * (WIND_MAX_MS - WIND_MIN_MS);
  }
}
