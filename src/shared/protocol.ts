// Formato das mensagens entre o navegador e o servidor (JSON via WebSocket).
// Regra de ouro: o cliente só pede ("quero andar", "quero atirar"); quem decide é o servidor.
// Posições são em tiles (1 tile = 1 metro), "de canto": quem está parado no meio do tile (x, y) tem posição (x, y),
// e o centro do pé fica em (x + 0.5, y + 0.5). Monstros e NPCs andam de tile em tile (números inteiros); jogadores
// andam soltos (números quebrados). Ângulos são em radianos (0 = direita, π/2 = baixo); o `a` do `walk` é em graus.

import type { Dir } from './dir';
import type { EquipSlot, GearLook, InventoryState, ItemInfo, ItemStack } from './items';
import type { QuestInfo, QuestLog } from './quests';
import type { CombatRules } from './combatRules';
import type { ChargeLevel, ClassInfo, HeroState } from './classes';
import type { AttributeId, Attributes } from './attributes';

/** 'pet': bicho de estimação (o Joaquim, o gato da vó): anda sozinho, mia e ronrona; nunca é alvo. */
export type EntityKind = 'player' | 'monster' | 'npc' | 'pet';

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
  /** Bichos: dormindo agora (quem chega vê ele já enroladinho). */
  asleep?: true;
  /** Bichos: o retângulo do mapa (camada `pontos`) onde ele mora, ex.: 'joaquim-casa'. */
  home?: string;
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
  /** Os pontos em cada atributo (Força, Destreza, Espírito, Vitalidade) e quantos sobram para distribuir. */
  attrs: Attributes;
  attrPoints: number;
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
  // estilingue (ou arco) na direção do ângulo `a` (cid: número do tiro no cliente); `d`: a distância até o ponto mirado,
  // em metros (o tiro cai lá, se a carga alcançar). Com a flecha especial carregada (veja `armed`), é ela que sai
  | { t: 'shoot'; cid: number; a: number; d?: number }
  | { t: 'skill'; n: number; a: number } // habilidade número n, mirando no ângulo `a`
  | { t: 'item'; act: ItemAction; i: number } // fazer algo com o item do espaço i da mochila
  | { t: 'unequip'; part: EquipSlot } // tirar o que está equipado nesta parte (volta para a mochila)
  | { t: 'talk'; npc: number } // abri a conversa ou a loja deste NPC (e de tempos em tempos, enquanto aberta): ele espera parado
  | { t: 'buy'; npc: number; item: string; n: number } // comprar n deste item do vendedor `npc`
  | { t: 'sell'; npc: number; i: number; n: number } // vender n do item do espaço i da mochila para o vendedor `npc`
  | { t: 'quest'; act: QuestAction; id: string; npc?: number } // aceitar ou concluir (perto de quem dá a missão) ou abandonar
  | { t: 'pet'; id: number } // fazer carinho no bicho (perto dele)
  | { t: 'jump' } // pular (só de enfeite por enquanto: quem está perto vê)
  | { t: 'class'; id: string } // escolher a classe (a chave em data/classes.json; o servidor confere se já pode)
  | { t: 'learn'; id: string } // pôr um ponto nesta habilidade da sua classe
  | { t: 'unlearn' } // tirar os pontos de todas as habilidades (voltam para gastar de novo)
  | { t: 'attr'; id: AttributeId } // pôr um ponto neste atributo
  | { t: 'attrReset' } // tirar os pontos de todos os atributos (voltam para distribuir de novo)
  // usar a habilidade `id` da sua classe mirando no ponto (x, y) do chão (metros, como o pé); longe demais, cai no alcance.
  // A Flecha Ancestral não sai na hora: fica carregada no arco (o servidor responde `armed`) e sai no próximo `shoot`;
  // pedir de novo descarrega. (`cid` não é mais usado.)
  | { t: 'cast'; id: string; x: number; y: number; cid?: number }
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
  | { do: 'pace'; scale: number } // câmera lenta: o ritmo do servidor inteiro (0.25, 0.5 ou 1)
  | { do: 'nocd'; on: boolean } // habilidades sem recarga (as da classe e o Fôlego), para testar
  | { do: 'tp'; x: number; y: number }
  | { do: 'heal' }
  | { do: 'npc'; npc: string } // traz o NPC (a chave dele em data/npcs.json) para onde o administrador está
  | { do: 'time'; phase: 'dia' | 'tarde' | 'noite' } // vira o relógio para o começo do dia, do anoitecer ou da noite (todos os mapas)
  | { do: 'wind'; level: WindLevel }; // muda o vento na hora (todos os mapas)

/** Como está o vento: calmo, brisa ou forte. */
export type WindLevel = 'calmo' | 'brisa' | 'forte';

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
// 'dizzy' = o bicho ficou tonto (o tatu-bola depois da investida); 'dodge' = o tiro passou pelo meio do enxame sem acertar;
// 'vanish' = o bicho foi embora (o filhote de boitatá ao amanhecer: em seguida vem o `despawn`); 'mark' = a Flecha
// Ancestral marcou o bicho: ele leva mais dano de todo mundo por `ms`; 'hawk' = o jogador usou os Olhos de Gavião
// (enxerga mais longe por `ms`)
// 'skillup': pôs um ponto numa habilidade (`s` = qual): o efeito subindo do chão, como ao subir de nível (pedido do
// dono, 23/11)
export type FxKind = 'arc' | 'spin' | 'strike' | 'bite' | 'dash' | 'jump' | 'whirlwind' | 'charge' | 'song' | 'dizzy' | 'dodge' | 'vanish' | 'mark' | 'hawk' | 'skillup' | PetFx;
/** O que um bicho faz que quem vê precisa animar: miar, ronronar (carinho), acordar e dormir. */
export type PetFx = 'meow' | 'purr' | 'wake' | 'sleep';

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
      /** Os números do combate que valem (carga, defesa, empurrão, dia e noite), com os ajustes do painel. */
      combat: CombatRules;
      /** Dia e noite: em que ponto do ciclo estamos agora (ms; de 0 até combat.dayMs é dia). O navegador anda sozinho daqui. */
      time: number;
      /** O vento de agora: força (0 a 1) e para onde sopra (graus no chão: 0 = leste, 90 = sul). */
      wind: { strength: number; angle: number };
      /** O mapa explorado deste mapa (só no formato novo): a grade em texto (src/shared/explore.ts). */
      explored?: string;
      /** As classes (de data/classes.json) e as habilidades de cada uma. */
      classes: ClassInfo[];
      /** A sua classe, os pontos de cada habilidade e quantos sobram. */
      hero: HeroState;
    }
  /** Você foi para outro mapa: carregue o mapa `map`, recomece a tela e responda com `loaded`. */
  | { t: 'zone'; map: string; you: EntityState; stats: PlayerStats; inv: InventoryState; online: number; npcs: NpcInfo[]; questLog: QuestLog; explored?: string }
  | { t: 'reject'; reason: RejectReason }
  | { t: 'bye'; reason: ByeReason } // sessão encerrada: entrou com o personagem em outro lugar, ou servidor desligando
  | { t: 'spawn'; e: EntityState } // alguém apareceu na sua área de visão
  | { t: 'despawn'; id: number } // alguém saiu da sua área de visão (ou do jogo)
  | { t: 'move'; id: number; x: number; y: number; dir: Dir; dash?: true }
  | { t: 'ack'; seq: number; x: number; y: number; dir: Dir } // sua posição oficial após o pedido `seq`
  | { t: 'teleport'; x: number; y: number; dir: Dir } // você foi levado para outro lugar (ex.: voltou para a vila)
  | { t: 'stats'; stats: PlayerStats }
  // a Flecha Ancestral (kind 'ancestral') leva rk = os pontos dela de quem atirou e lv = o nível da puxada (1 fraco,
  // 2 médio, 3 forte): o desenho muda com eles
  | { t: 'shot'; id: number; by: number; x: number; y: number; a: number; speed: number; range: number; kind: string; cid?: number; rk?: number; lv?: ChargeLevel }
  // projétil acabou (hit = id de quem levou, ou 0). Sem acertar ninguém: onde parou (x, y, como no `shot`) e, se bateu
  // em algo, `on` = o tipo do que segurou (ex.: 'tronco', 'parede', 'pedra'; 'borda' = fim do mapa). No fim do alcance:
  // `on: 'agua'` se caiu na água; sem `on`, caiu no chão
  // `burst`: a Flecha Ancestral explodiu no fim, neste raio (metros)
  | { t: 'shot_end'; id: number; hit: number; x?: number; y?: number; on?: string; burst?: number }
  | { t: 'warn'; id: number; tiles: number[]; ms: number } // aviso de golpe: [x1, y1, x2, y2, ...] em `ms` milissegundos
  | { t: 'fx'; id: number; kind: FxKind; a?: number; r?: number; ms?: number; s?: string } // r = alcance do golpe (bote, investida); ms = quanto dura (a marca); s = a habilidade ('skillup')
  | { t: 'fire'; id: number; tiles: number[]; ms: number } // chão pegando fogo nestes tiles por `ms` (queima quem fica)
  // blk: 1 = a defesa segurou (passou só um pouco), 2 = segurou e quebrou
  | { t: 'hit'; id: number; by: number; dmg: number; hp: number; blk?: 1 | 2 }
  | { t: 'guard'; id: number; on: boolean; a: number } // outro jogador levantou (ou baixou) a defesa, virada para `a`
  // a sua energia (0 a 100) e a defesa: baixada, levantada ou quebrada (solte e espere a energia voltar)
  | { t: 'energy'; v: number; g: GuardState }
  // você é administrador (o menu ADM aparece), com o voo e o invencível ligados ou não e os monstros que dá para criar
  | { t: 'gm'; admin: boolean; fly: boolean; god: boolean; nocd: boolean; monsters: { id: string; name: string }[] }
  | { t: 'heal'; id: number; amount: number; hp: number }
  | { t: 'hp'; id: number; hp: number; maxHp: number }
  | { t: 'death'; id: number }
  | { t: 'levelup'; id: number; level: number; maxHp: number }
  | { t: 'gear'; id: number; gear: GearLook } // alguém trocou o equipamento (muda o desenho dele)
  | { t: 'cd'; n: number; ms: number } // habilidade n entrou em recarga (n = -1: esquiva)
  | { t: 'hero'; hero: HeroState } // a sua classe ou os pontos das habilidades mudaram (subiu de nível, escolheu...)
  | { t: 'scd'; s: string; ms: number } // a habilidade `s` da sua classe entrou em recarga
  | { t: 'pace'; scale: number } // o ritmo do jogo mudou (câmera lenta do administrador): 1 = normal
  | { t: 'armed'; s: string | null } // a flecha especial carregada no seu arco (a habilidade `s`), ou null: saiu ou descarregou
  // alguém (`id`) usou a habilidade `s` da classe: cai em (x, y) (metros, no chão), num raio `r`, daqui a `ms`. n = quantas
  // flechas sobem; p = quantos pontos ela tem (o desenho muda com eles); kind = o que chove ('flecha' ou 'pedra': o
  // tiro da arma de quem usou); lv = o nível da puxada (1 fraco, 2 médio, 3 forte). Quem usou não recebe: já desenhou
  | { t: 'cast'; id: number; s: string; x: number; y: number; r: number; n: number; p: number; ms: number; kind: string; lv?: ChargeLevel }
  | { t: 'fail'; reason: FailReason; item?: true } // pedido recusado (item: era um pedido da mochila ou da loja)
  | { t: 'inv'; inv: InventoryState } // sua mochila mudou
  // estes itens do monstro que caiu em (x, y) foram para a sua mochila. Desde 14/11 o servidor não manda mais: os itens
  // caem no chão (`drop`) e você pega passando por cima (`pickup`); os jogos ainda sabem mostrar, se um dia voltar
  | { t: 'loot'; x: number; y: number; items: ItemStack[] }
  /** Caiu no chão para você pegar (só você vê): ouro ou um item que não coube na mochila. Some em `ms`. */
  | { t: 'drop'; id: number; x: number; y: number; gold?: number; item?: ItemStack; ms: number }
  | { t: 'pickup'; id: number; gold?: number; item?: ItemStack } // você pegou (tudo ou parte de) o que estava no chão
  | { t: 'drop_gone'; id: number } // o que estava no chão sumiu (o tempo acabou)
  | { t: 'items'; items: ItemInfo[] } // o administrador ajustou os itens (preço, cura, bônus): use estes daqui pra frente
  | { t: 'npc_walk'; id: number; x: number; y: number; ms: number } // o NPC `id` anda até (x, y) em `ms` (o passeio dele)
  | { t: 'npcs'; npcs: NpcInfo[] } // o administrador ajustou os NPCs deste mapa (o que vendem, o que dizem...)
  | { t: 'say'; id: number; text: string } // fala curta (balão), sem ir para o chat
  | { t: 'chat'; id: number; name: string; text: string }
  | { t: 'sys'; text: string } // aviso do sistema
  | { t: 'notice'; text: string } // aviso do administrador para todo mundo (aparece grande na tela)
  | { t: 'quests'; log: QuestLog } // seu progresso nas missões mudou
  | { t: 'questDefs'; quests: QuestInfo[] } // o painel do administrador mudou as missões (textos, objetivo, recompensa)
  | { t: 'combat'; rules: CombatRules } // o painel do administrador mudou os números do combate (carga, defesa, empurrão)
  // dia e noite: em que ponto do ciclo estamos agora (ms). Vem quando o dia vira noite (e vice-versa), quando o
  // administrador vira o relógio ou muda quanto dura cada um: o navegador acerta o relógio dele
  | { t: 'time'; at: number }
  // o mapa explorado: estes quadradinhos (de EXPLORE_CELL metros, linha por linha) acabaram de ser vistos
  | { t: 'explored'; cells: number[] }
  // o vento mudou: chega a esta força (0 a 1) e direção (graus no chão, para onde sopra) em `ms`, devagar
  | { t: 'wind'; strength: number; angle: number; ms: number }
  | { t: 'charm'; ms: number } // você foi encantado (canto da Iara) por `ms`: não anda, só a esquiva solta (0 = acabou)
  | { t: 'pull'; x: number; y: number; dir: Dir } // o canto te puxou um passo: sua posição agora é esta
  | { t: 'online'; n: number }
  | { t: 'pong'; id: number };

export type WelcomeMsg = Extract<ServerMsg, { t: 'welcome' }>;
export type ZoneMsg = Extract<ServerMsg, { t: 'zone' }>;

/** Número usado em `cd` para a esquiva. */
export const DASH_SLOT = -1;
