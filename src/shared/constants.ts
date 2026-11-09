// Números que o cliente (navegador) e o servidor precisam concordar.

/** Versão do protocolo de rede. Aumente quando cliente e servidor ficarem incompatíveis. */
export const PROTOCOL_VERSION = 1;

/** Tamanho de um tile (quadradinho do mapa) em pixels de arte. */
export const TILE_SIZE = 16;

/** Quantas vezes por segundo o servidor atualiza o mundo. */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/** Tempo para andar um tile, em milissegundos. 200 ms = 5 tiles por segundo. */
export const STEP_MS = 200;

/** Folga para aceitar um passo um pouquinho antes da hora (não muda a velocidade média). */
export const STEP_TOLERANCE_MS = TICK_MS / 2;

/** Quantos passos o servidor guarda na fila de cada jogador. Mais que isso = bug ou trapaça. */
export const MAX_QUEUED_STEPS = 8;

/** Quantos passos o cliente pode dar "adiantado", sem confirmação do servidor. */
export const MAX_PENDING_STEPS = 5;

/** Área de visão, em tiles a partir do jogador. O servidor só envia o que está dentro dela. */
export const VIEW_RADIUS_X = 20;
export const VIEW_RADIUS_Y = 16;
/** Margem extra antes de "esquecer" alguém (evita ficar aparecendo/sumindo na borda). */
export const VIEW_HYSTERESIS = 2;

export const MAX_PLAYERS = 200;
export const CHAT_MAX_LENGTH = 160;
