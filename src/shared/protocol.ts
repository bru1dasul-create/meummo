// Formato das mensagens entre o navegador e o servidor (JSON via WebSocket).
// Regra de ouro: o cliente só pede ("quero andar", "quero atirar"); quem decide é o servidor.
// Posições são em tiles. Ângulos são em radianos (0 = direita, π/2 = baixo).

import type { Dir } from './dir';
import type { EquipSlot, InventoryState, ItemInfo, ItemStack } from './items';

export type EntityKind = 'player' | 'monster';

/** Tudo que o cliente precisa saber para desenhar alguém. */
export interface EntityState {
  id: number;
  kind: EntityKind;
  /** 'player' para jogadores; para monstros, o id do monstro em data/monsters.json (ex.: 'saci'). */
  type: string;
  name: string;
  x: number;
  y: number;
  dir: Dir;
  /** Semente da aparência dos jogadores (cores de cabelo, pele, roupa). */
  look: number;
  level: number;
  hp: number;
  maxHp: number;
  /** Monstros: tempo para andar um tile (cada um tem sua velocidade). */
  stepMs?: number;
}

/** Números que só o próprio jogador precisa ver. */
export interface PlayerStats {
  level: number;
  /** XP dentro do nível atual. */
  xp: number;
  /** XP que falta juntar para subir de nível. */
  xpNext: number;
  /** Já com o que os equipamentos somam. */
  maxHp: number;
  damage: [number, number];
  defense: number;
}

/** Cliente → servidor. */
export type ClientMsg =
  | { t: 'hello'; v: number; name: string; password: string } // quero entrar com este personagem (criado na hora se não existir)
  | { t: 'step'; seq: number; dir: Dir; dash?: true } // quero andar um tile (ou rolar, se dash)
  | { t: 'shoot'; cid: number; a: number } // estilingue na direção do ângulo `a` (cid: número do tiro no cliente)
  | { t: 'skill'; n: number; a: number } // habilidade número n, mirando no ângulo `a`
  | { t: 'item'; act: ItemAction; i: number } // fazer algo com o item do espaço i da mochila
  | { t: 'unequip'; part: EquipSlot } // tirar o que está equipado nesta parte (volta para a mochila)
  | { t: 'loaded' } // terminei de carregar o mapa novo (depois de um `zone`)
  | { t: 'chat'; text: string }
  | { t: 'ping'; id: number };

/** equip = equipar; use = usar/comer; drop = jogar fora (a pilha inteira). */
export type ItemAction = 'equip' | 'use' | 'drop';

export type RejectReason =
  | 'name_invalid'
  | 'name_taken'
  | 'password_invalid' // senha curta ou longa demais
  | 'wrong_password'
  | 'too_many_attempts' // errou a senha vezes demais: espere uns minutos
  | 'creation_limit' // personagens novos demais vindos do mesmo lugar
  | 'unavailable' // o servidor não conseguiu ler os personagens salvos
  | 'full'
  | 'version';
/** Por que o servidor encerrou a sua sessão. */
export type ByeReason = 'replaced' | 'shutdown';
export type FailReason = 'cooldown' | 'dead' | 'full_hp' | 'no_target' | 'bag_full';

/** Tipos de efeito visual que o servidor manda mostrar. */
export type FxKind = 'arc' | 'spin' | 'strike' | 'bite' | 'dash' | 'whirlwind';

/** Servidor → cliente. O servidor sempre envia uma lista (um pacote por tick). */
export type ServerMsg =
  | {
      t: 'welcome';
      id: number;
      you: EntityState;
      stats: PlayerStats;
      stepMs: number;
      online: number;
      /** Id do mapa onde você está (arquivo public/assets/maps/<id>.tmj). */
      map: string;
      /** Todos os tipos de item (de data/items.json). */
      items: ItemInfo[];
      inv: InventoryState;
    }
  /** Você foi para outro mapa: carregue o mapa `map`, recomece a tela e responda com `loaded`. */
  | { t: 'zone'; map: string; you: EntityState; stats: PlayerStats; inv: InventoryState; online: number }
  | { t: 'reject'; reason: RejectReason }
  | { t: 'bye'; reason: ByeReason } // sessão encerrada: entrou com o personagem em outro lugar, ou servidor desligando
  | { t: 'spawn'; e: EntityState } // alguém apareceu na sua área de visão
  | { t: 'despawn'; id: number } // alguém saiu da sua área de visão (ou do jogo)
  | { t: 'move'; id: number; x: number; y: number; dir: Dir; dash?: true }
  | { t: 'ack'; seq: number; x: number; y: number; dir: Dir } // sua posição oficial após o pedido `seq`
  | { t: 'teleport'; x: number; y: number; dir: Dir } // você foi levado para outro lugar (ex.: voltou para a vila)
  | { t: 'stats'; stats: PlayerStats }
  | { t: 'shot'; id: number; by: number; x: number; y: number; a: number; speed: number; range: number; kind: string; cid?: number }
  | { t: 'shot_end'; id: number; hit: number } // projétil acabou (hit = id de quem levou, ou 0)
  | { t: 'warn'; id: number; tiles: number[]; ms: number } // aviso de golpe: [x1, y1, x2, y2, ...] em `ms` milissegundos
  | { t: 'fx'; id: number; kind: FxKind; a?: number }
  | { t: 'hit'; id: number; by: number; dmg: number; hp: number }
  | { t: 'heal'; id: number; amount: number; hp: number }
  | { t: 'hp'; id: number; hp: number; maxHp: number }
  | { t: 'death'; id: number }
  | { t: 'levelup'; id: number; level: number; maxHp: number }
  | { t: 'cd'; n: number; ms: number } // habilidade n entrou em recarga (n = -1: esquiva)
  | { t: 'fail'; reason: FailReason; item?: true } // pedido recusado (item: era um pedido da mochila)
  | { t: 'inv'; inv: InventoryState } // sua mochila mudou
  | { t: 'loot'; x: number; y: number; items: ItemStack[] } // você pegou isto do monstro que caiu em (x, y)
  | { t: 'say'; id: number; text: string } // fala curta (balão), sem ir para o chat
  | { t: 'chat'; id: number; name: string; text: string }
  | { t: 'sys'; text: string } // aviso do sistema
  | { t: 'online'; n: number }
  | { t: 'pong'; id: number };

export type WelcomeMsg = Extract<ServerMsg, { t: 'welcome' }>;
export type ZoneMsg = Extract<ServerMsg, { t: 'zone' }>;

/** Número usado em `cd` para a esquiva. */
export const DASH_SLOT = -1;
