// Números que o cliente (navegador) e o servidor precisam concordar.

/** Versão do protocolo de rede. Aumente quando cliente e servidor ficarem incompatíveis. */
export const PROTOCOL_VERSION = 18;

/** Tamanho de um tile (quadradinho do mapa) em pixels de arte. */
export const TILE_SIZE = 16;

/** Quantas vezes por segundo o servidor atualiza o mundo. */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/** Tempo para andar um tile, em milissegundos. 200 ms = 5 tiles por segundo (1 tile = 1 metro). Jogo de hoje. */
export const STEP_MS = 200;

/**
 * Mundo 2.5D novo (mapas do formato novo), decisão do dono em 13/11: correr é o normal e andar devagar é segurando
 * Shift (no celular, empurrando pouco o joystick). Em metros por segundo; o herói tem 1,76 m.
 */
export const RUN_SPEED = 4.5;
export const WALK_SPEED = 2;

/**
 * Movimento livre: o navegador manda um pedido de andar a cada WALK_SLICE_MS (um "pedaço" de caminhada)
 * e o servidor anda esse pedaço quando chega a vez dele (no máximo no ritmo do relógio).
 */
export const WALK_SLICE_MS = TICK_MS;

/** Quantos pedaços de caminhada o servidor guarda na fila de cada jogador. Mais que isso = bug ou trapaça. */
export const MAX_QUEUED_WALKS = 12;

/** Folga de tempo que o servidor acumula para pedidos que chegam juntos (a rede atrasa e depois entrega de uma vez). */
export const WALK_BUDGET_MAX_MS = 200;

/** Quantos pedaços o navegador pode andar "adiantado", sem confirmação do servidor (1 s de caminhada). */
export const MAX_PENDING_WALKS = 20;

/** Área de visão, em tiles a partir do jogador. O servidor só envia o que está dentro dela. */
export const VIEW_RADIUS_X = 20;
export const VIEW_RADIUS_Y = 16;
/** Margem extra antes de "esquecer" alguém (evita ficar aparecendo/sumindo na borda). */
export const VIEW_HYSTERESIS = 2;

export const MAX_PLAYERS = 200;
export const CHAT_MAX_LENGTH = 160;

// ---------- Combate (ação) ----------

/** Estilingue (ataque básico): velocidade e alcance da pedrinha, em tiles. */
export const SHOT_SPEED = 14;
export const SHOT_RANGE = 7;
/** Distância (em tiles) do centro do alvo para a pedrinha contar como acerto. */
export const SHOT_HIT_RADIUS = 0.6;
/** Tempo mínimo entre dois tiros do estilingue. */
export const SHOT_COOLDOWN_MS = 450;

/** Esquiva: quantos tiles o rolamento anda, de quanto em quanto tempo e quanto tempo fica invencível. */
export const DASH_TILES = 3;
export const DASH_COOLDOWN_MS = 2500;
export const DASH_INVULNERABLE_MS = 350;

/** Quanto tempo o jogador fica desmaiado antes de voltar para a vila. */
export const DEATH_MS = 3000;
/** A vida volta sozinha depois de um tempo sem apanhar. */
export const REGEN_DELAY_MS = 6000;
export const REGEN_EVERY_MS = 1000;
export const REGEN_FRACTION = 0.03;

/** Distância (em tiles) para negociar com um vendedor. */
export const TRADE_RANGE = 3;

/** Ouro no chão: quanto tempo fica esperando o dono pegar (pisca nos últimos segundos). */
export const GOLD_DROP_MS = 60_000;
/** Item que não coube na mochila: quanto tempo fica no chão (dá tempo de abrir espaço). */
export const ITEM_DROP_MS = 120_000;
/** Distância (em tiles) para pegar o que está no chão: chegou perto, pegou. */
export const PICKUP_RANGE = 1;
