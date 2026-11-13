// Formato das mensagens entre o navegador e o servidor (JSON via WebSocket).
// Regra de ouro: o cliente só pede ("quero andar", "quero atirar"); quem decide é o servidor.
// Posições são em tiles (1 tile = 1 metro), "de canto": quem está parado no meio do tile (x, y) tem posição (x, y),
// e o centro do pé fica em (x + 0.5, y + 0.5). Monstros e NPCs andam de tile em tile (números inteiros); jogadores
// andam soltos (números quebrados). Ângulos são em radianos (0 = direita, π/2 = baixo); o `a` do `walk` é em graus.

import type { Dir } from './dir';
import type { EquipSlot, GearLook, InventoryState, ItemInfo, ItemStack } from './items';
import type { QuestInfo, QuestLog } from './quests';

export type EntityKind = 'player' | 'monster' | 'npc';

/** Tudo que o cliente precisa saber para desenhar alguém. */
export interface EntityState {
  id: number;
  kind: EntityKind;
  /** 'player' para jogadores; para monstros e NPCs, o id em data/monsters.json ou data/npcs.json (ex.: 'saci'). */
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
  /** Jogadores: o equipamento que aparece no personagem (chapéu, couraça, arma...). */
  gear?: GearLook;
}

/** Um personagem do jogo que não é jogador (vendedora...). Fica parado no lugar dele. */
export interface NpcInfo {
  /** Para desenhar (kind 'npc'). */
  e: EntityState;
  /** O que ela é ("quitandeira do píer"). */
  title: string;
  /** O que diz quando alguém chega para negociar. */
  line: string;
  /** null = não tem loja. `buyPercent`: quanto ela paga pelo que você vende (% do preço). */
  shop: { sells: string[]; buyPercent: number } | null;
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
  // quero entrar com este personagem (criado na hora se não existir); mundo 'novo' = o jogo 2.5D (só os mapas do formato novo)
  // mode: 'login' só entra (nome que não existe = not_found); 'create' só cria (nome que já existe = name_exists);
  // sem mode, entra ou cria, como sempre (a tela de entrada antiga e os bots)
  | { t: 'hello'; v: number; name: string; password: string; mundo?: 'novo'; mode?: LoginMode }
  // quero andar um pedaço (WALK_SLICE_MS) na direção `a` (graus inteiros); com dash, rolar; slow: devagar (mundo novo, Shift)
  | { t: 'walk'; seq: number; a: number; dash?: true; slow?: true }
  | { t: 'charge' } // comecei a puxar o estilingue (pedra com carga): o servidor conta o tempo até o `shoot`
  | { t: 'guard'; on: boolean; a: number } // segurando (ou soltei) a defesa, virada para o ângulo `a` (radianos)
  | { t: 'gm'; cmd: GmCommand } // poder do administrador (o servidor confere se é administrador mesmo)
  | { t: 'oops'; text: string } // deu erro no navegador: o servidor anota nos registros (para corrigir depois)
  | { t: 'shoot'; cid: number; a: number } // estilingue na direção do ângulo `a` (cid: número do tiro no cliente)
  | { t: 'skill'; n: number; a: number } // habilidade número n, mirando no ângulo `a`
  | { t: 'item'; act: ItemAction; i: number } // fazer algo com o item do espaço i da mochila
  | { t: 'unequip'; part: EquipSlot } // tirar o que está equipado nesta parte (volta para a mochila)
  | { t: 'buy'; npc: number; item: string; n: number } // comprar n deste item do vendedor `npc`
  | { t: 'sell'; npc: number; i: number; n: number } // vender n do item do espaço i da mochila para o vendedor `npc`
  | { t: 'quest'; act: QuestAction; id: string; npc?: number } // aceitar ou concluir (perto de quem dá a missão) ou abandonar
  | { t: 'loaded' } // terminei de carregar o mapa novo (depois de um `zone`)
  | { t: 'chat'; text: string }
  | { t: 'ping'; id: number };

/** accept = aceitar a missão; complete = entregar (receber a recompensa); abandon = desistir. */
export type QuestAction = 'accept' | 'complete' | 'abandon';

/** equip = equipar; use = usar/comer; drop = jogar fora (a pilha inteira). */
export type ItemAction = 'equip' | 'use' | 'drop';

/**
 * Poderes do administrador (menu ADM): criar monstros onde está, derrubar os de perto, voar (atravessa tudo), ficar
 * invencível, ir até um ponto (metros, o pé) e curar.
 */
export type GmCommand =
  | { do: 'spawn'; monster: string; n: number }
  | { do: 'clear' }
  | { do: 'fly'; on: boolean }
  | { do: 'god'; on: boolean }
  | { do: 'tp'; x: number; y: number }
  | { do: 'heal' };

/** Entrar com um personagem que já existe, ou criar um novo (a tela inicial com "Criar uma conta"). */
export type LoginMode = 'login' | 'create';

export type RejectReason =
  | 'name_invalid'
  | 'name_taken'
  | 'password_invalid' // senha curta ou longa demais
  | 'wrong_password'
  | 'too_many_attempts' // errou a senha vezes demais: espere uns minutos
  | 'creation_limit' // personagens novos demais vindos do mesmo lugar
  | 'unavailable' // o servidor não conseguiu ler os personagens salvos
  | 'full'
  | 'version'
  | 'not_found' // Entrar: não existe personagem com esse nome (confira o nome ou crie uma conta)
  | 'name_exists'; // Criar: esse nome já tem dono
/** Por que o servidor encerrou a sua sessão. */
export type ByeReason = 'replaced' | 'shutdown' | 'kicked';
export type FailReason = 'cooldown' | 'dead' | 'full_hp' | 'no_target' | 'bag_full' | 'no_gold' | 'too_far' | 'cant_trade';

/** Tipos de efeito visual que o servidor manda mostrar. */
export type FxKind = 'arc' | 'spin' | 'strike' | 'bite' | 'dash' | 'whirlwind' | 'charge' | 'song';

/** Servidor → cliente. O servidor sempre envia uma lista (um pacote por tick). */
/** A defesa do jogador: baixada, levantada, ou quebrada (sem energia; só levanta de novo soltando o botão). */
export type GuardState = 'off' | 'up' | 'broken';

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
      /** Os NPCs deste mapa (não somem nem andam: vêm uma vez só). */
      npcs: NpcInfo[];
      /** Todas as missões (de data/missoes.json) e o seu progresso. */
      quests: QuestInfo[];
      questLog: QuestLog;
    }
  /** Você foi para outro mapa: carregue o mapa `map`, recomece a tela e responda com `loaded`. */
  | { t: 'zone'; map: string; you: EntityState; stats: PlayerStats; inv: InventoryState; online: number; npcs: NpcInfo[]; questLog: QuestLog }
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
  | { t: 'fx'; id: number; kind: FxKind; a?: number; r?: number } // r = alcance do golpe (bote, investida)
  | { t: 'fire'; id: number; tiles: number[]; ms: number } // chão pegando fogo nestes tiles por `ms` (queima quem fica)
  // blk: 1 = a defesa segurou (passou só um pouco), 2 = segurou e quebrou
  | { t: 'hit'; id: number; by: number; dmg: number; hp: number; blk?: 1 | 2 }
  | { t: 'guard'; id: number; on: boolean; a: number } // outro jogador levantou (ou baixou) a defesa, virada para `a`
  // a sua energia (0 a 100) e a defesa: baixada, levantada ou quebrada (solte e espere a energia voltar)
  | { t: 'energy'; v: number; g: GuardState }
  // você é administrador (o menu ADM aparece), com o voo e o invencível ligados ou não e os monstros que dá para criar
  | { t: 'gm'; admin: boolean; fly: boolean; god: boolean; monsters: { id: string; name: string }[] }
  | { t: 'heal'; id: number; amount: number; hp: number }
  | { t: 'hp'; id: number; hp: number; maxHp: number }
  | { t: 'death'; id: number }
  | { t: 'levelup'; id: number; level: number; maxHp: number }
  | { t: 'gear'; id: number; gear: GearLook } // alguém trocou o equipamento (muda o desenho dele)
  | { t: 'cd'; n: number; ms: number } // habilidade n entrou em recarga (n = -1: esquiva)
  | { t: 'fail'; reason: FailReason; item?: true } // pedido recusado (item: era um pedido da mochila ou da loja)
  | { t: 'inv'; inv: InventoryState } // sua mochila mudou
  | { t: 'loot'; x: number; y: number; items: ItemStack[] } // estes itens do monstro que caiu em (x, y) foram para a sua mochila
  /** Caiu no chão para você pegar (só você vê): ouro ou um item que não coube na mochila. Some em `ms`. */
  | { t: 'drop'; id: number; x: number; y: number; gold?: number; item?: ItemStack; ms: number }
  | { t: 'pickup'; id: number; gold?: number; item?: ItemStack } // você pegou (tudo ou parte de) o que estava no chão
  | { t: 'drop_gone'; id: number } // o que estava no chão sumiu (o tempo acabou)
  | { t: 'items'; items: ItemInfo[] } // o administrador ajustou os itens (preço, cura, bônus): use estes daqui pra frente
  | { t: 'npcs'; npcs: NpcInfo[] } // o administrador ajustou os NPCs deste mapa (o que vendem, o que dizem...)
  | { t: 'say'; id: number; text: string } // fala curta (balão), sem ir para o chat
  | { t: 'chat'; id: number; name: string; text: string }
  | { t: 'sys'; text: string } // aviso do sistema
  | { t: 'notice'; text: string } // aviso do administrador para todo mundo (aparece grande na tela)
  | { t: 'quests'; log: QuestLog } // seu progresso nas missões mudou
  | { t: 'charm'; ms: number } // você foi encantado (canto da Iara) por `ms`: não anda, só a esquiva solta (0 = acabou)
  | { t: 'pull'; x: number; y: number; dir: Dir } // o canto te puxou um passo: sua posição agora é esta
  | { t: 'online'; n: number }
  | { t: 'pong'; id: number };

export type WelcomeMsg = Extract<ServerMsg, { t: 'welcome' }>;
export type ZoneMsg = Extract<ServerMsg, { t: 'zone' }>;

/** Número usado em `cd` para a esquiva. */
export const DASH_SLOT = -1;
