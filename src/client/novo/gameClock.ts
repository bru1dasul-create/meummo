// O relógio do jogo no navegador: o de verdade, no ritmo que o servidor mandar (câmera lenta do painel de ajustes).
// O motor e a camada do combate contam tudo por ele (passos, tiros, recargas, desenhos); o som, a rede e o contador de
// quadros continuam no relógio de verdade.

import { PacedClock } from '../../shared/pace';

export const gameClock = new PacedClock(() => performance.now());
export const gameNow = (): number => gameClock.now();
