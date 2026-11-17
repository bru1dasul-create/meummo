// O motor do jogo 2.5D (o mundo novo): conversa com o servidor, lê teclado/joystick/toque, prevê o próprio andar
// (com as mesmas regras do servidor, em src/shared/movement.ts) e manda o desenho (view.ts) mostrar tudo.
// O desenho de verdade é da [arte] (PD.View); sem ele, a ProvisionalView mostra o básico. O combate (aviso no
// chão, pedras, dano, barras de vida) é desenhado por cima, em combat.ts.
// É o que abre em http://localhost:3000 (o jogo antigo, visto de cima, fica em ?antigo).

import {
  DASH_COOLDOWN_MS,
  DASH_ROLL_MS,
  DASH_TILES,
  GM_FLY_FACTOR,
  GUARD_MAX_ENERGY,
  JUMP_AIR_MS,
  JUMP_COOLDOWN_MS,
  MAX_PENDING_WALKS,
  SHOT_HIT_RADIUS,
  SHOT_MOVING_MS,
  TRADE_RANGE,
  TRADE_SLACK,
  WALK_SLICE_MS,
} from '../../shared/constants';
import { DX, DY, type Dir } from '../../shared/dir';
import { pickQuickItem, type GearLook, type InventoryState, type ItemInfo, type ItemStack } from '../../shared/items';
import { GameMap, type SolidRect, type Tile, type TiledMap } from '../../shared/map';
import { BODY_HALF_H, BODY_HALF_W, BODY_OFFSET_Y, degreesOfDir, degreesToward, cornerAtFeet, feetAt, flySlice, footCenter, sweepBody, sliceDistance, walkSlice, type Pose } from '../../shared/movement';
import { findRoute, followRoute } from '../../shared/route';
import { DASH_SLOT, type EntityState, type GuardState, type NpcInfo, type PlayerStats, type ServerMsg, type WelcomeMsg, type ZoneMsg } from '../../shared/protocol';
import { questBlocker, questFinisher, type QuestInfo, type QuestLog } from '../../shared/quests';
import { SKILLS } from '../../shared/skills';
import { castPoint, skillPoint, type ClassInfo, type ClassSkillInfo, type HeroState } from '../../shared/classes';
import { Bag } from '../bag';
import { KeyboardDirections } from '../game/input';
import type { Connection } from '../net';
import type { Sfx } from '../sfx';
import { ShopWindow } from '../shop';
import { npcMark, QuestTracker, TalkWindow, type QuestContext } from '../talk';
import { ActionBar, Feedback, Toast, ZoneBanner, type ActionSlot, type ChatBox, type Hud } from '../ui';
import './arte'; // o desenho de verdade (PD.View), da [arte], quando estiver pronto
import { aimedRange, angleDiff, chargedRange, chargeFraction, shotProfile, shotSpread, type ShotProfile, type ShotStance } from '../../shared/combat';
import { defaultCombatRules, type CombatRules } from '../../shared/combatRules';
import { aimAngle, BODY_HEIGHT, CombatLayer, distanceToSegment, shotOriginOfFeet, type DebugShape } from './combat';
import { GmPanel } from './gm';
import { GuardButton } from './guard';
import { Joystick } from './joystick';
import { QuickSlots } from './quick';
import { ProvisionalView, type WorldView } from './view';
import { Ambient, sceneOfPlace } from '../ambient';
import { trackOfScene } from '../music';
import { SoundPanel } from './soundPanel';
import { KeyBindings, type KeyAction } from './keys';
import { cyclePosition, daylightAt, isNightAt } from '../../shared/dayNight';
import { KeysPanel } from './keysPanel';
import { SkillsPanel } from './skillsPanel';
import { skillIconUrl } from './skillIcons';
import { dangerColor } from './danger';
import { DebugPanel } from './debugPanel';
import { loadFeel, saveFeel, shakeOffset, type Feel } from './feel';
import { SkillTip, type SkillTipText } from './skillTip';
import { MapPicture, MapWindow, Minimap, type MapMarker } from './mapWindow';

/** As teclas das habilidades da barra, na ordem de SKILLS (Bordunada, Fôlego). */
/** As teclas 1 e 2 da barra: a 1ª habilidade da classe e o Fôlego. */
const SKILL_KEYS: KeyAction[] = ['hab1', 'folego'];
/** A tecla de cada habilidade da classe, na ordem de data/classes.json (a 1ª no Q, a 2ª no R, a 3ª no T). */
const CLASS_KEYS: KeyAction[] = ['hab1', 'hab2', 'hab3'];
/** O quadrado da barra de cada habilidade da classe (na mesma ordem): a 1ª no que era da Bordunada, as outras nos novos. */
const CLASS_SLOTS: ActionSlot[] = ['skill0', 'class1', 'class2'];
/** O Fôlego na lista de SKILLS (src/shared/skills.ts). A Bordunada (a 0) saiu do jogo novo em 15/11: a classe entrou. */
const FOLEGO = 1;

export interface NewWorldDeps {
  conn: Connection;
  welcome: WelcomeMsg;
  chat: ChatBox;
  hud: Hud;
  sfx: Sfx;
}

type Point = { x: number; y: number };
/** Para onde a pedra vai quando soltar: no monstro clicado, para onde o mouse aponta, ou no mais perto (botão). */
/** Para onde vai a pedra que está sendo puxada: no monstro clicado, para o mouse, ou no mais perto (botão da tela, tecla J). */
type Aim = { by: 'target'; id: number } | { by: 'mouse' } | { by: 'button' } | { by: 'key' };

/** Ângulo com 3 casas (o servidor recebe assim). */
const round3 = (value: number) => Math.round(value * 1000) / 1000;
/** Radianos → graus inteiros de 0 a 359 (o `walk` e o desenho usam graus). */
const toDegrees = (radians: number) => ((Math.round((radians * 180) / Math.PI) % 360) + 360) % 360;
/** O "atirar no mais perto" dos botões procura um pouco além do alcance da pedra (o monstro anda). */
const AUTO_AIM_SLACK = 0.5;
/** Com a conversa aberta, avisa o servidor a cada tanto (o NPC espera NPC_BUSY_MS depois do último aviso). */
const TALK_PING_MS = 5000;
/** O NPC que passeia, parado: de frente para a loja e para a câmera (sul). */
const NPC_FRONT_DEGREES = 90;
/** Mirando num bicho, o tiro vai até um pouco depois do pé dele (para chegar nele antes de cair). */
const AIM_TARGET_SLACK = 0.75;
/** Depois do tiro, o corpo fica virado para ele por este tempo (mesmo andando para outro lado). */
const SHOT_FACING_MS = 350;
/** A defesa vira sozinha para o monstro mais perto até esta distância (metros); sem monstro, para onde você anda. */
const GUARD_AIM_RANGE = 8;
/** Defesa levantada: manda a direção nova quando ela muda mais que isto, no máximo a cada GUARD_RESEND_MS. */
const GUARD_RESEND_ANGLE = (10 * Math.PI) / 180;
const GUARD_RESEND_MS = 120;
/** Carinho no bicho: daqui (metros, de pé a pé; o servidor aceita um pouco mais). */
const PET_REACH = 1.5;
/** A altura do bicho na tela, para tocar nele (metros). */
const PET_HEIGHT = 0.45;
/** Puxando o estilingue: a mira nova vai para a view quando muda mais que isto (o corpo e os braços acompanham). */
const PULL_AIM_RESEND = (5 * Math.PI) / 180;
/** A barra de energia anda até o valor do servidor nesta velocidade (pontos por segundo). */
const ENERGY_ANIM_PER_S = 80;
/** Número do dano que passou pela defesa (azul-claro, a cor da defesa). */
const BLOCKED_COLOR = '#bfe6f0';
/** Monstro que caiu: tempo para a view mostrar a queda ('die') antes de o desenho sair. */
const DIE_MS = 700;
/**
 * Zoom da câmera: começa longe (o dono achou o "médio" perto demais) e o jogador ajusta (roda do mouse, teclas − e +).
 * A escolha fica guardada neste aparelho. A view limita (a da [arte] vai de 0,7 a 1,4).
 */
const DEFAULT_ZOOM = 0.7;
/** Conversa com NPC (missão ou loja): a câmera chega pelo menos até este zoom, e volta quando a conversa fecha. */
const CONVERSATION_ZOOM = 1.25;
/** Quanto tempo a câmera leva para chegar (e para voltar). */
const CONVERSATION_ZOOM_MS = 450;
/** Resposta curta do NPC (aceitou, desistiu): quanto tempo a boca mexe. */
const SHORT_REPLY_MS = 1200;
const ZOOM_KEY = 'meummo:zoom';
const ZOOM_STEP = 1.1;

export interface NewWorldGame {
  destroy(): void;
}

const PING_EVERY_MS = 2000;

/** Liga o jogo 2.5D. Recusa (com o motivo) se o mapa não for do formato novo. */
export async function startNewWorld(deps: NewWorldDeps): Promise<NewWorldGame> {
  const game = new NewWorld(deps);
  await game.enter(deps.welcome, false);
  return game;
}

/** Lê o mapa do mundo novo (public/assets/maps-iso). */
async function loadMap(id: string): Promise<TiledMap> {
  const response = await fetch(`/assets/maps-iso/${id}.tmj`);
  if (!response.ok) throw new Error(`O mapa "${id}" ainda não existe no jogo novo.`);
  return (await response.json()) as TiledMap;
}

/**
 * O desenho: o da [arte] (PD.View, quando estiver carregado) ou o provisório. `?novo&provisorio` força o provisório,
 * que mostra as caixas de colisão do mapa (bom para conferir onde o pé bate).
 */
function createView(container: HTMLElement, map: TiledMap): WorldView {
  const pd = (window as unknown as { PD?: { View?: new (container: HTMLElement, map: TiledMap) => WorldView } }).PD;
  const forceProvisional = new URLSearchParams(location.search).has('provisorio');
  return pd?.View && !forceProvisional ? new pd.View(container, map) : new ProvisionalView(container, map);
}

class NewWorld implements NewWorldGame {
  private readonly conn: Connection;
  private readonly chat: ChatBox;
  private readonly hud: Hud;
  private readonly container = document.getElementById('game') as HTMLElement;
  private readonly keyboard: KeyboardDirections;
  private readonly joystick: Joystick;
  private readonly toast = new Toast();
  private readonly zoneBanner = new ZoneBanner();
  private readonly sfx: Sfx;
  private readonly feedback = new Feedback();
  private readonly combat: CombatLayer;
  /** Os números do combate que valem (vêm do servidor; o painel do administrador pode mudar com o jogo rodando). */
  private readonly rules: CombatRules;
  private actionBar: ActionBar;
  private readonly soundButton = document.getElementById('hud-sound') as HTMLButtonElement | null;
  /** O painel do som (o botão do som abre): ligar/desligar e o volume da música, dos efeitos e do ambiente. */
  private readonly soundPanel: SoundPanel;
  /** As teclas de cada ação (o jogador troca na janela das teclas; fica guardado neste aparelho). */
  private readonly keys = new KeyBindings();
  private readonly keysPanel: KeysPanel;
  /** O que o jogador tem equipado (o botão do tiro mostra a arma; a barra é refeita quando as teclas mudam). */
  private gearNow: GearLook = {};
  /** O som de ambiente do lugar onde você está (mata, água, vila...). */
  private readonly ambient: Ambient;
  private ambientCheckAt = 0;
  // mochila, loja e conversa com missões (as janelas do jogo de sempre; a [arte] deixa no jeito do 2.5D depois)
  private readonly items = new Map<string, ItemInfo>();
  private readonly bag: Bag;
  private readonly shop: ShopWindow;
  private readonly talk: TalkWindow;
  private readonly tracker: QuestTracker;
  private readonly questList: QuestInfo[];
  private questLog: QuestLog;
  private lastInv: InventoryState;
  private myGold = 0;
  private myLevel = 1;
  /** O seu dano de agora (menor e maior), para a dica das habilidades. */
  private myDamage: [number, number] = [0, 0];
  private skillTip!: SkillTip;
  /** O painel de ajustes dentro do jogo (F1; só administrador). */
  private debugPanel!: DebugPanel;
  private gmPowers = { god: false, nocd: false, fly: false };
  /** O game feel (tremor, pausa no impacto, faíscas, clarão): só desta tela, guardado no navegador. */
  private feel: Feel = loadFeel();
  private shake = { start: 0, ms: 0, px: 0 };
  private hitStopUntil = 0;
  /** O que estava equipado (para tocar o som de equipar quando muda). */
  private equippedBefore = '';
  /** Atalhos de comida (1) e remédio (2). */
  private readonly quick: QuickSlots;
  /** Quando dá para usar o próximo item (o servidor conta uma recarga só para todos os consumíveis). */
  private itemReadyAt = 0;
  private map!: GameMap;
  private view: WorldView | null = null;
  private myId = 0;
  private stepMs = 200;

  // Previsão do próprio andar (como no jogo de hoje): anda na hora e o servidor confirma depois.
  private predicted!: Pose;
  /** `guard`: segurava a defesa quando mandou (anda devagar; o servidor conta igual, na ordem das mensagens). */
  private pending: { seq: number; a: number; dash: boolean; slow: boolean; guard: boolean; fly: boolean }[] = [];
  /** Andando devagar agora (a tecla do "devagar" ligada, ou o joystick empurrado só um pouco); o normal é correr. */
  private slow = false;
  /** O "andar devagar" do teclado (C no padrão: liga e desliga). */
  private slowWalk = false;
  private seq = 0;
  private walkCredit = WALK_SLICE_MS;
  private walkAt = 0;
  /** "Tocar no chão para andar": pontos até o destino. */
  private route: Tile[] = [];
  /** Onde o "andar até" quer chegar (para recalcular o caminho se travar). */
  private routeGoal: Tile | null = null;
  /** Quantas vezes o caminho deste "andar até" já foi recalculado. */
  private replans = 0;
  private stuckSlices = 0;
  /** Indo conversar com este NPC (fala quando chegar perto). */
  private goingToNpc: number | null = null;
  /** O bicho que você foi fazer carinho (faz quando chega perto) e quantas vezes ainda corrige o caminho (ele anda). */
  private goingToPet: number | null = null;
  private petRetries = 0;

  private readonly entities = new Map<number, EntityState>();
  /** Para onde cada um olha (graus), para o desenho girar contínuo. */
  private readonly facing = new Map<number, number>();
  /** Direção do seu último pedido de andar (graus): é para onde o seu personagem olha. */
  private myAngle = 90;
  private readonly npcs = new Map<number, NpcInfo>();
  private wasSafe: boolean | null = null;

  // combate
  /** Desmaiado: não anda nem ataca até acordar (o servidor manda o teleporte de volta). */
  private dead = false;
  private myHp = 1;
  private myMaxHp = 1;
  private shotCid = 0;
  private nextShotAt = 0;
  private dashReadyAt = 0;
  /** Quando rolou e quando pulou pela última vez: um não sai no meio do outro. */
  private dashedAt = -Infinity;
  private jumpedAt = -Infinity;
  private jumpReadyAt = 0;
  /** Dia e noite: o instante (performance.now) em que o ciclo começou, pelo relógio do servidor. */
  private timeBase = 0;
  /** O que a view já sabe da hora (manda de novo só quando muda). */
  private lightShown = -1;
  private nightShown: boolean | null = null;
  /** O mapa da tecla M e o mini mapa: as imagens do mapa de agora (com o explorado), a janela e o canto da tela. */
  private mapPicture: MapPicture | null = null;
  private readonly mapWindow = new MapWindow();
  private readonly minimap = new Minimap(() => this.mapWindow.toggle());
  /** Os sinais de missão dos NPCs (! e ?), para o mapa. */
  private readonly npcMarks = new Map<number, '!' | '?' | ''>();
  /** O vento: de onde vem e para onde vai a mudança de agora (força 0 a 1; ângulo em graus), começando em `start`. */
  private wind = { from: { strength: 0.35, angle: 0 }, to: { strength: 0.35, angle: 0 }, start: 0, ms: 0 };
  /** O que a view já sabe do vento (manda de novo só quando muda). */
  private windShown = { strength: -1, angle: -1 };
  private readonly skillReadyAt = SKILLS.map(() => 0);
  /** As classes (do servidor) e o que o jogador tem: a classe, os pontos de cada habilidade e quantos sobram. */
  private classes: ClassInfo[] = [];
  private hero: HeroState = { class: null, skills: {}, points: 0, canChoose: false };
  /** A janela das Habilidades (K ou o botão ✦): escolher a classe e pôr os pontos. */
  private readonly skillsPanel: SkillsPanel;
  /** A recarga de cada habilidade da classe (performance.now de quando fica pronta). */
  private readonly castReadyAt = new Map<string, number>();
  /** Segurando a tecla da habilidade: mirando (o círculo segue o mouse); soltar usa. */
  private aiming: ClassSkillInfo | null = null;
  /** Os botões das habilidades da classe da 2ª em diante (provisórios, até a barra ter quadrados para elas). */
  /** Olhos de Gavião: até quando valem (performance.now), e se a view está mostrando (o destaque e a câmera afastada). */
  private hawkUntil = 0;
  private hawkShown = false;
  /** Puxando o estilingue (pedra com carga): desde quando e para onde vai a pedra ao soltar. */
  /** Puxando o estilingue: desde quando, a mira (alvo, mouse ou a automática) e o último ângulo mandado à view. */
  private charging: { since: number; aim: Aim; sentAngle: number } | null = null;
  /** Soltou durante a recarga do estilingue: a pedra sai assim que der. */
  private pendingShot: { at: number; aim: Aim; since: number } | null = null;
  /** Defesa (passo 2b): segurando F ou o botão? Virada para onde (radianos)? O que já foi mandado ao servidor. */
  private guardHeld = false;
  private guardAngle = 0;
  private guardSentAngle = 0;
  private guardSentAt = 0;
  /** Energia e defesa como o servidor contou; a barra mostra `energyShown`, que anda até lá. */
  private energy = GUARD_MAX_ENERGY;
  private energyShown = GUARD_MAX_ENERGY;
  private guardState: GuardState = 'off';
  private guardFrameAt = 0;
  /** Último pedaço de caminhada: para onde e quando (sem monstro perto, a defesa acompanha o andar). */
  private lastWalkDegrees = 90;
  private lastWalkAt = 0;
  /** Quando avisar o servidor de novo que a conversa continua aberta. */
  private talkPingAt = 0;
  /** Os NPCs que passeiam (já andaram neste mapa): viram o corpo para quem vem falar. */
  private readonly npcStrolls = new Set<number>();
  /** O último pedaço andado foi devagar (ou defendendo)? Atirar andando espalha: correndo mais, devagar menos. */
  private lastWalkSlow = false;
  /** Puxando (e um instante depois do tiro), o corpo fica virado para a mira, mesmo andando para outro lado. */
  private aimFacing: { degrees: number; until: number } | null = null;
  /** A flecha especial carregada no arco (a habilidade): sai no próximo tiro. */
  private armed: string | null = null;
  private readonly guardButton: GuardButton;
  /** Menu ADM (só administrador): voando atravessa tudo; "teleporte ao clicar" troca o andar até pelo ir até lá. */
  private readonly gmPanel: GmPanel;
  private gmFly = false;
  /** Poder do administrador: as habilidades (da classe e o Fôlego) sem recarga. */
  private gmNoCd = false;
  private gmTeleport = false;
  /** `?fps` no endereço: quadros por segundo e o custo de cada quadro, para medir no aparelho de verdade. */
  private readonly fpsMeter = new URLSearchParams(location.search).has('fps') ? new FpsMeter() : null;
  /** Conversa aberta (missão ou loja): com quem. A câmera vai até ele e volta quando fecha. */
  private conversationNpc: number | null = null;
  /** O zoom que a tela mostra agora (o escolhido pelo jogador fica em `zoom`; na conversa, chega mais perto). */
  private viewZoom = DEFAULT_ZOOM;
  private zoomAnim: { from: number; to: number; start: number } | null = null;
  /** Onde está o mouse (tela), para mirar. */
  private mouse: Point | null = null;
  /** O último toque foi com o dedo (as habilidades miram sozinhas). */
  private usingTouch = false;
  /** Outros jogadores desmaiados (acordam quando a vida volta). */
  private readonly fainted = new Set<number>();
  private safeToastAt = 0;
  /** Zoom da câmera escolhido pelo jogador (veja DEFAULT_ZOOM). */
  private zoom = DEFAULT_ZOOM;
  private raf = 0;
  private pingTimer = 0;
  private pingId = 0;
  private readonly pings = new Map<number, number>();
  private destroyed = false;

  constructor(deps: NewWorldDeps) {
    this.conn = deps.conn;
    this.chat = deps.chat;
    this.hud = deps.hud;
    this.sfx = deps.sfx;
    this.keyboard = new KeyboardDirections(() => this.chat.isTyping());
    this.joystick = new Joystick(this.container, (x, y) => {
      this.usingTouch = true;
      this.tapAt(x, y);
    });
    // os números do combate: o mesmo objeto aqui e no desenho do combate (o servidor manda os novos, se mudarem)
    this.rules = { ...defaultCombatRules(), ...deps.welcome.combat };
    this.combat = new CombatLayer(this.container, this.rules);
    this.classes = deps.welcome.classes ?? [];
    if (deps.welcome.hero) this.hero = deps.welcome.hero;
    this.actionBar = this.makeActionBar();
    this.keysPanel = new KeysPanel(this.keys, () => this.keysChanged());
    this.soundPanel = new SoundPanel({
      toggleMute: () => this.toggleSound(),
      setVolume: (part, value) => this.sfx.setVolume(part, value),
      openKeys: () => this.keysPanel.open(),
    });
    this.ambient = new Ambient(this.sfx);
    this.soundButton?.addEventListener('click', this.openSoundPanel);
    this.updateSoundButton();
    this.updateShotLook(deps.welcome.you.gear ?? {}); // entrou já com o arco equipado
    this.setClock(deps.welcome.time);
    this.wind.from = this.wind.to = { ...deps.welcome.wind };
    const welcome = deps.welcome;
    for (const item of welcome.items) this.items.set(item.id, item);
    this.lastInv = welcome.inv;
    this.myGold = welcome.inv.gold ?? 0;
    this.myLevel = welcome.stats.level;
    this.myDamage = welcome.stats.damage;
    this.equippedBefore = JSON.stringify(welcome.inv.equipped);
    this.bag = new Bag(
      this.items,
      welcome.inv,
      {
        item: (act, i) => {
          if (act === 'use') this.noteItemUse(this.lastInv.slots[i]?.item ?? null, performance.now());
          this.conn.send({ t: 'item', act, i });
        },
        unequip: (part) => this.conn.send({ t: 'unequip', part }),
      },
      welcome.stats,
      welcome.you.look,
    );
    this.shop = new ShopWindow(this.items, welcome.inv, {
      buy: (npc, item, n) => this.conn.send({ t: 'buy', npc, item, n }),
      sell: (npc, i, n) => this.conn.send({ t: 'sell', npc, i, n }),
    });
    this.questList = welcome.quests ?? [];
    this.questLog = welcome.questLog ?? {};
    this.talk = new TalkWindow(this.questList, this.items, {
      accept: (npc, id) => this.conn.send({ t: 'quest', act: 'accept', id, npc }),
      complete: (npc, id) => this.conn.send({ t: 'quest', act: 'complete', id, npc }),
      abandon: (id) => this.conn.send({ t: 'quest', act: 'abandon', id }),
      openShop: (npc) => {
        this.talk.close();
        this.bag.close();
        this.shop.open(npc);
      },
    });
    this.tracker = new QuestTracker(this.questList);
    this.skillsPanel = new SkillsPanel({
      choose: (id) => this.conn.send({ t: 'class', id }),
      learn: (id) => this.conn.send({ t: 'learn', id }),
      unlearn: () => this.conn.send({ t: 'unlearn' }),
    });
    this.skillsPanel.update(this.classes, this.hero, welcome.stats.level);
    this.skillsPanel.show();
    this.skillTip = new SkillTip((slot) => this.tipOf(slot as ActionSlot));
    this.debugPanel = new DebugPanel({
      isAdmin: () => this.gmPanel.admin,
      gm: (cmd) => {
        if (cmd.do === 'fly') {
          this.gmFly = cmd.on; // como no menu ADM: os próximos passos já saem voando
          this.clearRoute();
        }
        this.conn.send({ t: 'gm', cmd });
      },
      powers: () => this.gmPowers,
      monstersInView: () => [...this.entities.values()].filter((e) => e.kind === 'monster').length,
      weapon: () => {
        const weapon = this.lastInv.equipped.weapon;
        return weapon && this.items.get(weapon)?.shot ? weapon : null;
      },
      hitboxes: (on) => this.combat.setDebug(on ? () => this.debugShapes() : null),
      feel: () => this.feel,
      setFeel: (feel) => {
        this.feel = feel;
        saveFeel(feel);
      },
    });
    this.quick = new QuickSlots((n) => this.useQuick(n, performance.now()));
    this.guardButton = new GuardButton(
      () => this.startGuard(performance.now()),
      () => this.stopGuard(),
    );
    this.guardButton.setKey(this.keys.label('defesa'));
    this.gmPanel = new GmPanel({
      spawn: (monster, n) => this.conn.send({ t: 'gm', cmd: { do: 'spawn', monster, n } }),
      clear: () => this.conn.send({ t: 'gm', cmd: { do: 'clear' } }),
      // o voo vale na hora também aqui (os próximos passos já saem voando, na mesma ordem que o servidor conta)
      fly: (on) => {
        this.gmFly = on;
        this.clearRoute();
        this.conn.send({ t: 'gm', cmd: { do: 'fly', on } });
      },
      god: (on) => this.conn.send({ t: 'gm', cmd: { do: 'god', on } }),
      nocd: (on) => this.conn.send({ t: 'gm', cmd: { do: 'nocd', on } }),
      heal: () => this.conn.send({ t: 'gm', cmd: { do: 'heal' } }),
      teleportMode: (on) => {
        this.gmTeleport = on;
      },
      npc: (id) => this.conn.send({ t: 'gm', cmd: { do: 'npc', npc: id } }),
      time: (phase) => this.conn.send({ t: 'gm', cmd: { do: 'time', phase } }),
      wind: (level) => this.conn.send({ t: 'gm', cmd: { do: 'wind', level } }),
    });
    this.refreshQuick();
    this.container.addEventListener('pointerdown', this.onPointerDown);
    this.container.addEventListener('pointermove', this.onPointerMove);
    this.container.addEventListener('contextmenu', this.onContextMenu);
    this.container.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    try {
      const saved = Number(localStorage.getItem(ZOOM_KEY));
      if (saved > 0) this.zoom = saved;
    } catch {
      // sem acesso ao armazenamento (janela anônima...): começa no padrão
    }
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
    this.pingTimer = window.setInterval(() => this.ping(), PING_EVERY_MS);
    this.exposeDebug();
  }

  /**
   * Para testes automáticos (como o window.__meummo do jogo de hoje): só lê o estado e usa o mesmo
   * "andar até" do toque — não dá vantagem, quem manda é o servidor.
   */
  private exposeDebug(): void {
    const game = this;
    (window as unknown as { __mundoNovo?: unknown }).__mundoNovo = {
      get me() {
        if (!game.predicted) return null; // ainda carregando o mapa
        const feet = feetAt(game.predicted.x, game.predicted.y);
        return { id: game.myId, x: game.predicted.x, y: game.predicted.y, feetX: feet.x, feetY: feet.y, angle: game.myAngle, map: game.map?.id };
      },
      walkTo: (x: number, y: number) => game.walkToPoint(x, y),
      walking: () => game.route.length > 0,
      // ouro e itens no chão (os seus): o tile, o pé (metros, para o walkTo) e o item
      drops: () => game.combat.dropList(),
      safe: () => game.wasSafe,
      // x, y: posição "de canto" (a do servidor); feetX, feetY: o pé, em metros (é o que o screenOf espera)
      entities: () =>
        [...game.entities.values()].map((e) => {
          const feet = feetAt(e.x, e.y);
          return { id: e.id, kind: e.kind, type: e.type, name: e.name, x: e.x, y: e.y, feetX: feet.x, feetY: feet.y, hp: e.hp, maxHp: e.maxHp };
        }),
      hp: () => ({ hp: game.myHp, maxHp: game.myMaxHp }),
      // sinais de missão em cima dos NPCs ('!' nova, '?' para concluir)
      marks: () => [...game.npcs.values()].map((n) => ({ name: n.e.name, type: n.e.type, mark: npcMark(n.e.type, game.questList, game.questContext()) })),
      zoom: () => game.zoom,
      // os números do combate que o navegador está usando (vêm do servidor; o painel pode mudar com o jogo rodando)
      combat: () => ({ ...game.rules }),
      // o som: o lugar do ambiente, os volumes, se está desligado e se o navegador já liberou o áudio
      sound: () => ({ scene: game.ambient.current, night: game.ambient.isNight, music: game.sfx.music.current, playing: game.sfx.music.playing, volumes: game.sfx.volumes(), muted: game.sfx.muted, running: game.sfx.audio !== null }),
      // dia e noite: em que ponto do ciclo (ms), a luz (1 dia, 0 noite) e se os bichos estão "da noite"
      time: () => {
        const position = cyclePosition(performance.now() - game.timeBase, game.rules);
        return { position, light: daylightAt(position, game.rules), night: isNightAt(position, game.rules) };
      },
      // o mapa explorado: quantos quadradinhos já foram vistos (e quantos tem), e se a janela do mapa está aberta
      explored: () => game.mapPicture?.progress() ?? null,
      mapOpen: () => game.mapWindow.isOpen,
      // o vento de agora (força 0 a 1, ângulo em graus) e para onde ele está indo
      wind: () => ({ ...game.windNow(performance.now()), to: { ...game.wind.to } }),
      dead: () => game.dead,
      // a classe, os pontos de cada habilidade e quantos sobram; se a janela das Habilidades está aberta
      hero: () => ({ ...game.hero, skills: { ...game.hero.skills } }),
      skillsOpen: () => game.skillsPanel.isOpen,
      // os Olhos de Gavião: quantos ms ainda valem (0 = desligados)
      hawk: () => Math.max(0, Math.round(game.hawkUntil - performance.now())),
      screenOf: (x: number, y: number) => game.view?.toScreen(x, y),
    };
  }

  /** Entra num mapa (no começo ou trocando de mapa). */
  async enter(msg: WelcomeMsg | ZoneMsg, arrived: boolean): Promise<void> {
    this.conn.hold(); // as mensagens esperam o mapa carregar
    const json = await loadMap(msg.map);
    if (this.destroyed) return;
    this.map = GameMap.fromTiled(json, msg.map);
    // o mapa da tecla M e o mini mapa (só nos mapas do formato novo), com o que já foi explorado
    this.mapPicture = this.map.metric ? new MapPicture(json, msg.map, msg.explored) : null;
    this.view?.destroy();
    this.view = createView(this.container, json);
    this.lightShown = -1; // a view nova precisa saber a hora
    this.windShown = { strength: -1, angle: -1 }; // e o vento
    this.zoom = this.view.setZoom?.(this.zoom) ?? this.zoom;
    this.viewZoom = this.zoom;
    this.zoomAnim = null;
    this.conversationNpc = null;
    this.combat.clear();
    this.combat.raise(); // por cima do desenho novo
    this.entities.clear();
    this.facing.clear();
    this.npcs.clear();
    this.fainted.clear();
    this.pending = [];
    this.route = [];
    this.goingToNpc = null;
    this.wasSafe = null;
    this.cancelCharge();
    this.cancelAim();
    this.setArmed(null);
    this.hawkUntil = 0; // trocou de mapa: a view nova começa sem o destaque e sem a câmera afastada
    this.hawkShown = false;
    this.forgetGuard();
    this.setDead(false);
    if (msg.t === 'welcome') {
      this.myId = msg.id;
      this.stepMs = msg.stepMs;
      this.hud.setGold(msg.inv.gold ?? 0);
    }
    const you = msg.you;
    this.predicted = { x: you.x, y: you.y, dir: you.dir };
    this.myAngle = degreesOfDir(you.dir);
    this.addEntity(you, true);
    this.view.follow(this.myId);
    for (const npc of msg.npcs) {
      this.npcs.set(npc.e.id, npc);
      this.addEntity(npc.e, false);
    }
    this.gmPanel.setNpcs(msg.npcs.map((npc) => ({ id: npc.e.type, name: npc.e.name })));
    this.applyStats(msg.stats);
    this.myHp = you.hp;
    this.myMaxHp = you.maxHp;
    this.hud.setHp(you.hp, you.maxHp);
    if (msg.t === 'zone') {
      this.shop.close();
      this.talk.close();
      this.questLog = msg.questLog;
      this.onInventory(msg.inv, false);
    }
    this.refreshQuests();
    this.hud.setOnline(msg.online);
    if (arrived) this.conn.send({ t: 'loaded' });
    this.conn.listen((m) => this.onMessage(m));
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.destroyed = true;
    this.sfx.stopCharge(); // saiu no meio da puxada: o zumbido do elástico não fica tocando
    cancelAnimationFrame(this.raf);
    clearInterval(this.pingTimer);
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('contextmenu', this.onContextMenu);
    this.container.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    this.soundButton?.removeEventListener('click', this.openSoundPanel);
    this.soundPanel.destroy();
    this.keysPanel.destroy();
    this.skillsPanel.destroy();
    this.skillTip.destroy();
    this.debugPanel.destroy();

    this.mapWindow.destroy();
    this.minimap.destroy();
    this.ambient.destroy();
    this.sfx.music.stop();
    this.keyboard.destroy();
    this.joystick.destroy();
    this.toast.destroy();
    this.zoneBanner.destroy();
    this.actionBar.destroy();
    this.feedback.destroy();
    this.combat.destroy();
    this.bag.destroy();
    this.quick.destroy();
    this.guardButton.destroy();
    this.gmPanel.destroy();
    this.fpsMeter?.destroy();
    this.shop.destroy();
    this.talk.destroy();
    this.tracker.destroy();
    this.view?.destroy();
    this.view = null;
  }

  // ======================= laço =======================

  private readonly loop = (now: number) => {
    if (this.destroyed || !this.view) return;
    const workStart = performance.now();
    this.handleMovement(now);
    this.handlePendingShot(now);
    this.updateCharge(now);
    this.updateAim();
    this.updateHawk(now);
    this.updateGuard(now);
    this.updateAmbient(now);
    this.updateTimeOfDay(now);
    this.updateWind(now);
    this.drawMaps();
    this.updateConversation(now);
    this.checkNpcArrival();
    this.cuddleIfNear();
    this.checkNpcDistance();
    this.checkSafeArea();
    // game feel: a pausa no impacto segura o desenho (o jogo continua; a imagem fica um instante) e o tremor desloca a tela
    if (now >= this.hitStopUntil) {
      this.view.frame(now);
      this.combat.setViewer(this.predicted ? feetAt(this.predicted.x, this.predicted.y) : null);
      this.combat.frame(now, this.view, (id) => this.drawnFeet(id), this.hurtBars());
    }
    if (this.shake.px > 0) {
      const off = shakeOffset(now, this.shake.start, this.shake.ms, this.shake.px);
      this.combat.shake(off.x, off.y);
      if (now >= this.shake.start + this.shake.ms) this.shake.px = 0;
    }
    this.actionBar.update(now);
    this.quick.update(now);
    this.fpsMeter?.tick(now, performance.now() - workStart);
    this.raf = requestAnimationFrame(this.loop);
  };

  private addEntity(e: EntityState, me: boolean): void {
    this.entities.set(e.id, e);
    const feet = feetAt(e.x, e.y);
    this.facing.set(e.id, degreesOfDir(e.dir));
    if (e.kind === 'pet' && !this.view?.canDraw?.('pet', e.type)) {
      // a view ainda não desenha este bicho: o provisório fica por cima (o gatinho só aparece com você na casa dele; a
      // capivara, que mora fora, sempre)
      const home = e.home ? (this.map.regions.get(e.home) ?? null) : null;
      this.combat.setPet(e.id, e.name, feet.x, feet.y, (degreesOfDir(e.dir) * Math.PI) / 180, e.asleep === true, home, e.type === 'capivara');
      return;
    }
    this.view?.addActor(e.id, { kind: e.kind, type: e.type, name: e.name, look: e.look, x: feet.x, y: feet.y, angle: degreesOfDir(e.dir), me, ...(e.asleep ? { asleep: true } : {}) });
    if (e.kind === 'player') this.view?.gear?.(e.id, e.gear ?? {}); // o que ele tem na mão (o arco fica sempre à vista)
  }

  /**
   * Para onde alguém olha, em graus: o servidor manda só uma das 8 direções, então quem anda olha para onde
   * andou (o 2.5D gira contínuo); parado, vale a direção do servidor.
   */
  private facingOf(id: number, fromX: number, fromY: number, toX: number, toY: number, dir: Dir): number {
    const moved = Math.hypot(toX - fromX, toY - fromY) > 0.01;
    const angle = moved ? (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI : degreesOfDir(dir);
    this.facing.set(id, angle);
    return angle;
  }

  // ======================= andar =======================

  /**
   * Quanto anda um pedaço: correndo (o normal), devagar (o C liga e desliga / joystick empurrado de leve) ou, segurando a defesa,
   * devagar × guardWalkFactor (o mesmo número do servidor).
   */
  private sliceOf(slow: boolean, guard = this.guardHeld, fly = this.gmFly): number {
    if (fly) return sliceDistance(this.map.metric, false, this.stepMs, this.rules) * GM_FLY_FACTOR;
    if (guard) return sliceDistance(this.map.metric, true, this.stepMs, this.rules) * this.rules.guardWalkFactor;
    return sliceDistance(this.map.metric, slow, this.stepMs, this.rules);
  }

  private readonly onKey = (event: KeyboardEvent) => {
    const action = this.keys.actionOf(event.code);
    // soltar: o tiro e a defesa são de segurar (segurar puxa a pedra ou levanta a defesa; soltar atira ou baixa)
    if (event.type === 'keyup') {
      if (action === 'atirar' && this.charging?.aim.by === 'key') this.releaseCharge(performance.now());
      if (action === 'defesa') this.stopGuard();
      // soltou a tecla da habilidade (ou o 1): usa onde a mira está
      if ((action === 'hab1' || action === 'hab2' || event.code === 'Digit1') && this.aiming) this.releaseAim(performance.now());
      return;
    }
    if (event.type !== 'keydown' || this.chat.isTyping() || this.keysPanel.listening) return;
    const now = performance.now();
    if (action) {
      event.preventDefault(); // o Espaço não rola a página e o Tab não pula de botão
      if (!event.repeat) this.keyAction(action, now);
      return;
    }
    // as fixas (não dá para trocar): os números da barra, o menu ADM, o zoom e o Esc
    switch (event.code) {
      case 'Digit1':
      case 'Digit2':
        if (!event.repeat) this.keyAction(SKILL_KEYS[event.code === 'Digit1' ? 0 : 1]!, now);
        break;
      case 'Digit3':
      case 'Digit4':
        if (!event.repeat) this.useQuick(event.code === 'Digit3' ? 1 : 2, now);
        break;
      case 'KeyG':
        if (!event.repeat) this.gmPanel.toggle(); // só abre para administrador
        break;
      case 'Minus':
      case 'NumpadSubtract':
        this.zoomBy(1 / ZOOM_STEP);
        break;
      case 'Equal':
      case 'NumpadAdd':
        this.zoomBy(ZOOM_STEP);
        break;
      case 'Escape':
        if (this.aiming) this.cancelAim();
        else if (this.skillsPanel.isOpen) this.skillsPanel.close();
        else if (this.mapWindow.isOpen) this.mapWindow.close();
        else if (this.talk.isOpen) this.talk.close();
        else if (this.shop.isOpen) this.shop.close();
        else if (this.bag.isOpen) this.bag.close();
        else if (this.soundPanel.isOpen) this.soundPanel.close();
        break;
    }
  };

  /** O que cada ação faz (a tecla de cada uma está em keys.ts; o jogador troca na janela das teclas). */
  private keyAction(action: KeyAction, now: number): void {
    switch (action) {
      case 'esquiva':
        this.tryDash(now);
        break;
      case 'pular':
        this.tryJump(now);
        break;
      case 'atirar':
        this.startCharge({ by: 'key' }, now);
        break;
      case 'defesa':
        this.startGuard(now);
        break;
      case 'hab1':
        this.startAim(0, now);
        break;
      case 'hab2':
        this.startAim(1, now);
        break;
      case 'hab3':
        this.startAim(2, now);
        break;
      case 'folego':
        this.trySkill(FOLEGO, 0, now);
        break;
      case 'habilidades':
        this.skillsPanel.toggle();
        break;
      case 'mochila':
        this.bag.toggle();
        break;
      case 'mapa':
        if (this.mapPicture) this.mapWindow.toggle();
        else this.toast.show('Este lugar não tem mapa');
        break;
      case 'devagar':
        this.toggleSlowWalk();
        break;
      case 'som':
        this.toggleSound();
        break;
    }
  }

  /**
   * A barra de ações, com as teclas de agora (refeita quando o jogador troca uma tecla ou aprende a habilidade). As
   * habilidades da classe que já têm ponto ficam nos quadrados delas (a 1ª no 'skill0', que era da Bordunada; a 2ª e a
   * 3ª no 'class1' e no 'class2'); depois o Fôlego, a esquiva e o pulo.
   */
  private makeActionBar(): ActionBar {
    const classDefs = CLASS_SLOTS.flatMap((slot, i) => {
      const skill = this.classSkillAt(i);
      return skill ? [{ slot, label: skill.name, key: this.keys.label(CLASS_KEYS[i]!), icon: skillIconUrl(skill.id) }] : [];
    });
    return new ActionBar(
      [
        { slot: 'shot', label: 'Estilingue', key: this.keys.label('atirar') }, // segurar puxa, soltar atira (pedra com carga)
        ...classDefs,
        { slot: 'skill1', label: SKILLS[FOLEGO]!.name, key: this.keys.label('folego') },
        { slot: 'dash', label: 'Esquiva', key: this.keys.label('esquiva') },
        { slot: 'jump', label: 'Pular', key: this.keys.label('pular') }, // no celular, o botão de pular (o desenho é da [arte])
      ],
      (slot, down) => this.onAction(slot, down),
    );
  }

  /** O jogador trocou uma tecla: a barra mostra as novas (com a arma e as recargas que estavam correndo). */
  private keysChanged(): void {
    this.guardButton.setKey(this.keys.label('defesa'));
    this.rebuildActionBar();
  }

  /** Refaz a barra (teclas novas, habilidade nova), com a arma e as recargas que estavam correndo. */
  private rebuildActionBar(): void {
    this.actionBar.destroy();
    this.actionBar = this.makeActionBar();
    this.updateShotLook(this.gearNow);
    this.actionBar.setCooldown('shot', this.nextShotAt, this.shot().cooldownMs);
    this.actionBar.setCooldown('dash', this.dashReadyAt, DASH_COOLDOWN_MS);
    this.actionBar.setCooldown('skill1', this.skillReadyAt[FOLEGO]!, SKILLS[FOLEGO]!.cooldownMs);
    CLASS_SLOTS.forEach((slot, i) => {
      const skill = this.classSkillAt(i);
      if (skill) this.actionBar.setCooldown(slot, this.castReadyAt.get(skill.id) ?? 0, skill.cooldownMs);
    });
    const armed = this.armed; // a barra nova nasce sem a marca da flecha carregada
    if (armed) {
      this.armed = null;
      this.setArmed(this.armedSkillId(armed));
    }
  }

  /**
   * As hitboxes do painel de ajustes (F1), como o servidor conta: o círculo em que um tiro acerta cada bicho, a caixa do
   * pé de todo mundo, a área em que o bicho que ataca sozinho percebe você e o que bloqueia perto de você.
   */
  private debugShapes(): DebugShape[] {
    const shapes: DebugShape[] = [];
    const body = (x: number, y: number, color: string): DebugShape => {
      const cx = x + 0.5;
      const cy = y + 0.5 + BODY_OFFSET_Y;
      return { rect: { x0: cx - BODY_HALF_W, y0: cy - BODY_HALF_H, x1: cx + BODY_HALF_W, y1: cy + BODY_HALF_H }, color };
    };
    for (const e of this.entities.values()) {
      if (e.id === this.myId) continue;
      // onde está desenhado agora (o desenho anda um pouco atrás do servidor): as linhas acompanham o bicho na tela
      const feet = this.drawnFeet(e.id) ?? feetAt(e.x, e.y);
      const corner = cornerAtFeet(feet.x, feet.y);
      shapes.push(body(corner.x, corner.y, e.kind === 'monster' ? '#ffffff' : '#7fd4ff'));
      if (e.kind !== 'monster') continue;
      shapes.push({ circle: { x: corner.x + 0.5, y: corner.y + 0.5, r: SHOT_HIT_RADIUS }, color: '#ff5a4a' });
      const aggro = this.debugPanel.aggroOf(e.type);
      if (aggro > 0) {
        shapes.push({ rect: { x0: corner.x - aggro, y0: corner.y - aggro, x1: corner.x + aggro + 1, y1: corner.y + aggro + 1 }, color: '#ffa63d', dash: true, label: `${e.name}: percebe a ${aggro} m` });
      }
    }
    if (this.predicted) shapes.push(body(this.predicted.x, this.predicted.y, '#7dff9a'));
    // o que bloqueia, perto de você (o mapa inteiro seria linha demais)
    const me = this.myFeet();
    const seen = new Set<SolidRect>();
    for (let ty = Math.floor(me.y) - 12; ty <= Math.floor(me.y) + 12; ty++) {
      for (let tx = Math.floor(me.x) - 12; tx <= Math.floor(me.x) + 12; tx++) {
        for (const rect of this.map.solidsAt?.(tx, ty) ?? []) {
          if (seen.has(rect)) continue;
          seen.add(rect);
          shapes.push({ rect, color: rect.shot ? '#f2d24b' : '#9aa0a6' });
        }
      }
    }
    return shapes;
  }

  /**
   * A dica de um quadrado da barra (mouse em cima): o que faz, em frases curtas, com os seus números de agora — o dano
   * em vermelho, os tempos em azul, área e alcance em dourado e os bônus em verde (as marcas de skillTip.ts).
   */
  private tipOf(slot: ActionSlot): SkillTipText | null {
    const [min, max] = this.myDamage;
    const num = (value: number) => String(Math.round(value * 10) / 10).replace('.', ',');
    const hit = (pct: number) => {
      const a = Math.max(1, Math.round((min * pct) / 100));
      const b = Math.max(1, Math.round((max * pct) / 100));
      return `[d]${a === b ? a : `${a} a ${b}`} de dano[/d]`;
    };
    const secs = (ms: number) => `[t]${num(ms / 1000)} s[/t]`;
    const meters = (m: number) => `[a]${num(m)} m[/a]`;
    const cooldown = (ms: number) => (this.gmNoCd ? 'Recarga: [b]nenhuma (poder de ADM)[/b]' : `Recarga: ${secs(ms)}`);
    const key = (action: KeyAction) => this.keys.label(action);
    if (slot === 'shot') {
      const shot = this.shot();
      const bow = shot.kind === 'flecha';
      return {
        title: `${bow ? 'Arco' : 'Estilingue'} (${key('atirar')})`,
        lines: [
          `Segure para puxar e solte: a ${bow ? 'flecha' : 'pedra'} cai onde você mirar.`,
          `Dano: ${hit(100)}`,
          `Puxada cheia: ${hit(100 * (1 + shot.damageBonus))}`,
          `Alcance: de ${meters(shot.rangeMin)} a ${meters(shot.rangeMax)}`,
          'Correndo, o tiro espalha. Puxando, você anda devagar.',
        ],
      };
    }
    if (slot === 'skill1') {
      const skill = SKILLS[FOLEGO]!;
      return { title: `${skill.name} (${key('folego')})`, lines: [`Cura: [b]${Math.round(skill.power * 100)}% da sua vida[/b]`, cooldown(skill.cooldownMs)] };
    }
    if (slot === 'dash') return { title: `Esquiva (${key('esquiva')})`, lines: [`Rola ${meters(DASH_TILES)} para onde você anda.`, 'Durante a rolada, [b]nenhum golpe te acerta[/b].', `Recarga: ${secs(DASH_COOLDOWN_MS)}`] };
    if (slot === 'jump') return { title: `Pular (${key('pular')})`, lines: ['Um pulo (por enquanto, só de enfeite).'] };
    const index = CLASS_SLOTS.indexOf(slot);
    const skill = index >= 0 ? this.classSkillAt(index) : null;
    const rank = skill ? (this.hero.skills[skill.id] ?? 0) : 0;
    const numbers = skill ? skillPoint(skill, rank) : null;
    if (!skill || !numbers) return null;
    const lines: string[] = [];
    if (skill.kind === 'chuva') {
      lines.push('Segure para mirar o círculo e solte: chovem flechas em todos os bichos da área.');
      lines.push(`Dano em cada bicho: ${hit(numbers.damagePct)}`);
      lines.push(`Área: ${meters(numbers.radius)} de raio · ${numbers.arrows} flechas`);
      lines.push(`Alcance da mira: ${meters(skill.range)}`);
      lines.push('[b]Nem a casca do tatu segura.[/b]');
    } else if (skill.kind === 'flecha') {
      lines.push('Carrega a flecha do espírito no arco: o próximo tiro é ela. Puxe e solte como sempre.');
      lines.push(`Atravessa os bichos do caminho: ${hit(numbers.damagePct)} em cada um`);
      if (numbers.burstRadius > 0) lines.push(`Explode onde você mirou: ${hit(numbers.burstPct)} em ${meters(numbers.burstRadius)}`);
      else lines.push('Cai onde você mirou (com 5 pontos, explode lá).');
      if (numbers.markPct > 0) lines.push(`Marca quem atravessa: [b]+${numbers.markPct}% de dano de todo mundo[/b] por ${secs(numbers.markMs)}`);
      lines.push(`Alcance com a puxada cheia: ${meters(skill.range)}`);
    } else if (skill.kind === 'olhos') {
      lines.push('Todo bicho aparece destacado, com o nível e a cor do perigo, mesmo atrás das árvores e no escuro.');
      lines.push(`Duração: ${secs(numbers.durationMs)}`);
      lines.push(`Você vê [a]${numbers.visionPct}% mais longe[/a]`);
      if (numbers.bonusPct > 0) lines.push(`Enquanto dura: [d]+${numbers.bonusPct}% de dano seu[/d] nos bichos`);
    }
    lines.push(cooldown(skill.cooldownMs));
    lines.push(`${rank} de ${skill.points.length} pontos${rank >= skill.points.length ? ' (no máximo)' : ' · K para pôr mais'}`);
    return { title: `${skill.name} (${key(CLASS_KEYS[index]!)})`, lines };
  }

  /** O quadrado da barra desta habilidade da classe (ou null, se ela não está na barra). */
  private classSlotOf(skillId: string): ActionSlot | null {
    const i = CLASS_SLOTS.findIndex((_, index) => this.classSkillAt(index)?.id === skillId);
    return i >= 0 ? CLASS_SLOTS[i]! : null;
  }

  /** Andar devagar (C no padrão): liga e desliga. O normal é correr. */
  private toggleSlowWalk(): void {
    this.slowWalk = !this.slowWalk;
    const key = this.keys.label('devagar');
    this.toast.show(this.slowWalk ? `Andando devagar (${key} para correr)` : `Correndo (${key} para andar devagar)`);
  }



  private readonly onBlur = () => {
    this.cancelAim(); // sem foco, o soltar da tecla não chega: a mira some sem usar
    this.cancelCharge(); // sem foco, o soltar do botão não chega: solta a pedra sem atirar
    this.stopGuard(); // e baixa a defesa
  };

  private handleMovement(now: number): void {
    const delta = this.walkAt > 0 ? Math.min(250, now - this.walkAt) : 0;
    this.walkAt = now;
    if (this.dead) {
      this.walkCredit = WALK_SLICE_MS;
      return;
    }
    let degrees = this.wantedDegrees();
    if (degrees === null) {
      this.walkCredit = WALK_SLICE_MS; // parado: o primeiro pedaço sai na hora em que mexer
      return;
    }
    this.walkCredit = Math.min(this.walkCredit + delta, WALK_SLICE_MS * 3);
    while (degrees !== null && this.walkCredit >= WALK_SLICE_MS && this.pending.length < MAX_PENDING_WALKS) {
      this.walkCredit -= WALK_SLICE_MS;
      this.walkOnce(degrees);
      degrees = this.wantedDegrees();
    }
  }

  /** Direção (graus no chão) de uma direção da tela: o teclado e o joystick andam pela tela (W = para cima). */
  private screenDegrees(dx: number, dy: number): number {
    const ground = this.view!.groundDirOfScreen(dx, dy);
    return ((Math.round((Math.atan2(ground.y, ground.x) * 180) / Math.PI) % 360) + 360) % 360;
  }

  private wantedDegrees(): number | null {
    const held = this.keyboard.current();
    if (held !== null) {
      this.clearRoute();
      this.slow = this.slowWalk;
      return this.screenDegrees(DX[held.dir], DY[held.dir]);
    }
    const stick = this.joystick.direction();
    if (stick) {
      this.clearRoute();
      this.slow = stick.light;
      return this.screenDegrees(stick.dx, stick.dy);
    }
    this.slow = this.slowWalk; // "andar até" com o andar devagar ligado vai devagar
    if (this.route.length === 0) return null;
    if (this.gmFly) {
      // voando: em linha reta até o ponto, atravessando tudo
      const goal = this.route[this.route.length - 1]!;
      if (Math.hypot(goal.x - this.predicted.x, goal.y - this.predicted.y) <= this.sliceOf(false) / 2 + 0.01) {
        this.clearRoute();
        return null;
      }
      return degreesToward(this.predicted.x, this.predicted.y, goal.x, goal.y);
    }
    return followRoute(this.map, this.predicted, this.route, this.sliceOf(this.slow));
  }

  private walkOnce(degrees: number): void {
    // puxando a pedra ou a flecha (ou com o tiro esperando a recarga), anda devagar: o servidor faz igual
    const slow = this.slow || this.charging !== null || this.pendingShot !== null;
    const result = this.gmFly ? flySlice(this.map, this.predicted, degrees, this.sliceOf(slow)) : walkSlice(this.map, this.predicted, degrees, this.sliceOf(slow));
    if (!result.moved && result.dir === this.predicted.dir) {
      this.noteStuck();
      return;
    }
    this.seq += 1;
    this.pending.push({ seq: this.seq, a: degrees, dash: false, slow, guard: this.guardHeld, fly: this.gmFly });
    this.conn.send(slow ? { t: 'walk', seq: this.seq, a: degrees, slow: true } : { t: 'walk', seq: this.seq, a: degrees });
    this.predicted = { x: result.x, y: result.y, dir: result.dir };
    this.lastWalkDegrees = degrees;
    this.lastWalkAt = performance.now();
    this.lastWalkSlow = slow || this.guardHeld;
    // defendendo, o corpo fica virado para onde a defesa aponta; puxando (e logo depois do tiro), para a mira
    const aiming = this.aimFacing && this.lastWalkAt < this.aimFacing.until ? this.aimFacing.degrees : null;
    this.myAngle = this.guardHeld ? toDegrees(this.guardAngle) : (aiming ?? degrees);
    this.showMe(WALK_SLICE_MS);
    if (result.moved) this.stuckSlices = 0;
    else this.noteStuck();
  }

  /**
   * O "andar até" não saiu do lugar: recalcula o caminho a partir de onde está (até 2 vezes). Se continuar
   * preso, larga a rota e avisa — o próximo toque calcula de novo a partir daqui.
   */
  private noteStuck(): void {
    if (this.route.length === 0) return;
    this.stuckSlices += 1;
    if (this.stuckSlices < 3) return;
    this.stuckSlices = 0;
    const found = this.routeGoal && this.replans < 2 ? findRoute(this.map, this.predicted, this.routeGoal) : null;
    this.replans += 1;
    if (found && found.points.length > 0) {
      this.route = found.points;
      return;
    }
    this.clearRoute();
    this.goingToNpc = null;
    this.toast.show('Não dá para chegar aí');
  }

  private showMe(durationMs: number): void {
    const feet = feetAt(this.predicted.x, this.predicted.y);
    this.view?.moveActor(this.myId, feet.x, feet.y, this.myAngle, { durationMs });
  }

  private onAck(seq: number, server: Pose): void {
    this.pending = this.pending.filter((p) => p.seq > seq);
    let pose: Pose = server;
    for (const p of this.pending) {
      if (p.dash) pose = sweepBody(this.map, pose, p.a, DASH_TILES);
      else if (p.fly) pose = flySlice(this.map, pose, p.a, this.sliceOf(p.slow, p.guard, true));
      else pose = walkSlice(this.map, pose, p.a, this.sliceOf(p.slow, p.guard, false));
    }
    const off = Math.hypot(pose.x - this.predicted.x, pose.y - this.predicted.y);
    if (off > 1e-6) {
      this.predicted = { x: pose.x, y: pose.y, dir: pose.dir };
      if (off > 0.75) this.clearRoute();
      this.showMe(100);
    }
  }

  private placeMe(x: number, y: number, dir: Dir): void {
    this.pending = [];
    this.predicted = { x, y, dir };
    this.myAngle = degreesOfDir(dir);
    this.walkCredit = WALK_SLICE_MS;
    this.clearRoute();
    this.showMe(0);
  }

  /**
   * Tocar/clicar no chão: anda até lá, pelo caminho onde o pé passa (src/shared/route.ts). Se o pé não cabe
   * onde tocou (árvore, casa), vai até o lugar livre mais perto.
   */
  private walkToPoint(x: number, y: number): void {
    const goal = cornerAtFeet(x, y);
    if (this.gmFly) {
      // voando não precisa de caminho: vai reto (veja nextDirection)
      this.stuckSlices = 0;
      this.route = [goal];
      this.routeGoal = goal;
      return;
    }
    const found = findRoute(this.map, this.predicted, goal);
    this.stuckSlices = 0;
    this.replans = 0;
    if (!found || found.points.length === 0) {
      this.clearRoute();
      this.toast.show('Não dá para chegar aí');
      return;
    }
    this.route = found.points;
    this.routeGoal = found.points[found.points.length - 1]!;
  }

  private clearRoute(): void {
    this.route = [];
    this.routeGoal = null;
  }

  /**
   * Mouse: clique esquerdo num monstro atira nele (segurando, continua); no NPC, vai conversar; no chão, anda até
   * lá. Botão direito: atira para onde o mouse aponta (segurando, continua). Toque: veja tapAt.
   */
  private readonly onPointerDown = (event: PointerEvent) => {
    if (!this.view || this.joystick.owns(event)) return;
    if (this.chat.isTyping()) this.chat.blur();
    this.usingTouch = event.pointerType !== 'mouse';
    if (event.pointerType === 'mouse') {
      this.mouse = { x: event.clientX, y: event.clientY };
      const now = performance.now();
      // segurar puxa o estilingue; soltar atira (pedra com carga)
      if (event.button === 2) {
        this.startCharge({ by: 'mouse' }, now);
        return;
      }
      if (event.button !== 0) return;
      const monster = this.actorAtScreen(event.clientX, event.clientY, 'monster');
      if (monster !== null) {
        this.startCharge({ by: 'target', id: monster }, now);
        return;
      }
      this.tapAt(event.clientX, event.clientY);
      return;
    }
    // na área do joystick, o toque rápido chega pelo próprio joystick (tapAt), quando o dedo sai
    if (event.clientX <= window.innerWidth * 0.45) return;
    this.tapAt(event.clientX, event.clientY);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') this.mouse = { x: event.clientX, y: event.clientY };
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const aim = this.charging?.aim.by;
    if (event.pointerType === 'mouse' && (aim === 'target' || aim === 'mouse')) this.releaseCharge(performance.now());
  };

  /** O botão direito é do jogo (atirar), não do menu do navegador. */
  private readonly onContextMenu = (event: Event) => event.preventDefault();

  /** Roda do mouse: afasta ou aproxima a câmera. */
  private readonly onWheel = (event: WheelEvent) => {
    if (!this.view?.setZoom) return;
    event.preventDefault();
    this.zoomBy(event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP);
  };

  /** Muda o zoom da câmera (multiplica) e guarda a escolha neste aparelho. */
  zoomBy(step: number): void {
    if (!this.view?.setZoom) return;
    this.zoom = this.view.setZoom(this.zoom * step);
    this.viewZoom = this.zoom; // o jogador mexeu: vale o dele (até na conversa)
    this.zoomAnim = null;
    try {
      localStorage.setItem(ZOOM_KEY, String(Math.round(this.zoom * 1000) / 1000));
    } catch {
      // sem armazenamento: vale só nesta visita
    }
  }

  /** Tocou/clicou na tela neste ponto: atira no monstro que está ali, vai conversar com o NPC ou anda até lá. */
  private tapAt(clientX: number, clientY: number): void {
    if (!this.view || this.dead) return;
    // (o clique do mouse já olhou o monstro antes de chegar aqui; o toque olha agora)
    const monster = this.actorAtScreen(clientX, clientY, 'monster');
    if (monster !== null) {
      // toque rápido no monstro: pedra fraca na hora (para puxar, segure o botão Estilingue)
      const target = this.entities.get(monster)!;
      this.quickShot(aimAngle(this.myFeet(), feetAt(target.x, target.y)), performance.now());
      return;
    }
    const npcId = this.actorAtScreen(clientX, clientY, 'npc');
    const npc = npcId !== null ? this.npcs.get(npcId) : undefined;
    if (npc) {
      const feet = feetAt(npc.e.x, npc.e.y);
      this.goingToNpc = npc.e.id;
      this.goingToPet = null;
      this.walkToPoint(feet.x, feet.y + 1);
      return;
    }
    // tocou no Joaquim: carinho (longe, vai até ele primeiro)
    const petId = this.actorAtScreen(clientX, clientY, 'pet');
    const pet = petId !== null ? this.entities.get(petId) : undefined;
    if (pet) {
      this.goingToNpc = null;
      this.goingToPet = pet.id;
      this.petRetries = 4;
      if (!this.cuddleIfNear()) this.walkToPet(pet.id);
      return;
    }
    const point = this.view.toWorld(clientX, clientY);
    this.goingToNpc = null;
    this.goingToPet = null;
    if (this.gmTeleport && this.gmPanel.admin) {
      this.clearRoute();
      this.conn.send({ t: 'gm', cmd: { do: 'tp', x: round3(point.x), y: round3(point.y) } });
      return;
    }
    this.walkToPoint(point.x, point.y);
  }

  /**
   * Quem está neste ponto da tela (o corpo, do pé até a cabeça), deste tipo, ou null. Vale tanto onde ele está
   * desenhado quanto onde o servidor diz que ele está (o desenho anda um pouco atrás de quem corre). No dedo, a folga
   * é maior. Funciona com qualquer câmera: usa só o toScreen da view.
   */
  private actorAtScreen(clientX: number, clientY: number, kind: 'monster' | 'npc' | 'pet'): number | null {
    if (!this.view) return null;
    const point = { x: clientX, y: clientY };
    let best: number | null = null;
    let bestScore = Infinity;
    for (const e of this.entities.values()) {
      if (e.kind !== kind) continue;
      for (const feet of [this.drawnFeet(e.id), feetAt(e.x, e.y)]) {
        if (!feet) continue;
        const foot = this.view.toScreen(feet.x, feet.y, 0);
        const head = this.view.toScreen(feet.x, feet.y, kind === 'pet' ? PET_HEIGHT : BODY_HEIGHT);
        const height = Math.hypot(head.x - foot.x, head.y - foot.y);
        const reach = this.usingTouch ? Math.max(32, height * 0.6) : Math.max(18, height * 0.4);
        const score = distanceToSegment(point, foot, head) / reach;
        if (score <= 1 && score < bestScore) {
          best = e.id;
          bestScore = score;
        }
      }
    }
    return best;
  }

  /** Indo fazer carinho no bicho: perto o bastante, faz (e para de andar). Devolve true se fez. */
  private cuddleIfNear(): boolean {
    if (this.goingToPet === null) return false;
    const pet = this.entities.get(this.goingToPet);
    if (!pet) {
      this.goingToPet = null;
      return false;
    }
    const me = feetAt(this.predicted.x, this.predicted.y);
    const feet = this.drawnFeet(pet.id) ?? feetAt(pet.x, pet.y);
    if (Math.hypot(me.x - feet.x, me.y - feet.y) > PET_REACH) {
      if (this.route.length > 0) return false;
      // chegou onde ele estava, mas ele andou: vai de novo até onde ele está agora (algumas vezes)
      if (this.petRetries > 0 && Math.hypot(me.x - feet.x, me.y - feet.y) < 10) {
        this.petRetries -= 1;
        this.walkToPet(pet.id);
      } else {
        this.goingToPet = null; // não deu para chegar
      }
      return false;
    }
    this.goingToPet = null;
    this.clearRoute();
    this.conn.send({ t: 'pet', id: pet.id });
    this.faceAngle(toDegrees(aimAngle(me, feet)));
    return true;
  }

  /** Anda até ficar do lado do bicho (do lado mais perto de você). */
  private walkToPet(id: number): void {
    const pet = this.entities.get(id);
    if (!pet) return;
    const feet = this.drawnFeet(id) ?? feetAt(pet.x, pet.y);
    const me = this.myFeet();
    const d = Math.hypot(me.x - feet.x, me.y - feet.y) || 1;
    this.walkToPoint(feet.x + ((me.x - feet.x) / d) * 0.7, feet.y + ((me.y - feet.y) / d) * 0.7);
  }

  /** O bicho miou, ronronou (carinho), acordou ou dormiu: o som e, no gatinho provisório, o desenho. */
  private onPetFx(id: number, kind: string, angle?: number): void {
    const now = performance.now();
    const provisional = this.combat.hasPet(id);
    if (kind === 'wake' || kind === 'sleep') {
      if (provisional) this.combat.petAsleep(id, kind === 'sleep');
      else this.view?.action?.(id, kind);
      return;
    }
    const feet = this.drawnFeet(id);
    const me = this.myFeet();
    const near = feet !== null && Math.hypot(feet.x - me.x, feet.y - me.y) < 8;
    if (kind === 'meow') {
      if (near) this.sfx.play('meow');
      if (provisional) this.combat.floater(id, 'miau!', '#f6e7c8', now);
    } else if (kind === 'purr') {
      // carinho: o gato ronrona; a capivara contente faz uns estalinhos baixos
      if (near) this.sfx.play(this.entities.get(id)?.type === 'capivara' ? 'capy' : 'purr');
      if (provisional) this.combat.floater(id, '♥', '#ff7aa8', now);
    }
    if (!provisional) this.view?.action?.(id, kind, angle !== undefined ? toDegrees(angle) : undefined);
  }

  /** Chegou perto do NPC que foi procurar: ele fala. */
  private checkNpcArrival(): void {
    if (this.goingToNpc === null) return;
    const npc = this.npcs.get(this.goingToNpc);
    if (!npc) {
      this.goingToNpc = null;
      return;
    }
    const me = feetAt(this.predicted.x, this.predicted.y);
    const feet = feetAt(npc.e.x, npc.e.y);
    if (Math.hypot(me.x - feet.x, me.y - feet.y) > TRADE_RANGE) {
      if (this.route.length === 0) this.goingToNpc = null; // desistiu no caminho
      return;
    }
    this.goingToNpc = null;
    this.clearRoute();
    this.openNpc(npc);
  }

  /**
   * Perto do NPC: a conversa quando ele tem missão para você agora (nova, em andamento ou para concluir); senão a loja
   * (se vende); senão a conversa (quem só dá missão) ou a fala dele.
   */
  private openNpc(npc: NpcInfo): void {
    const ctx = this.questContext();
    const type = npc.e.type;
    const questNow = this.questList.some(
      (q) =>
        (questFinisher(q) === type && ctx.log[q.id]?.state === 'active') ||
        (q.giver === type && (ctx.log[q.id]?.state === 'active' || questBlocker(q, ctx.log, ctx.level) === null)),
    );
    if (questNow || (this.talk.hasQuests(npc) && !npc.shop)) {
      this.bag.close();
      this.shop.close();
      this.talk.open(npc, this.questContext());
      return;
    }
    if (npc.shop) {
      this.bag.close();
      this.shop.open(npc);
      if (npc.line) this.view?.say(npc.e.id, npc.line);
      return;
    }
    if (npc.line) {
      this.view?.say(npc.e.id, npc.line);
      this.chat.addSystem(`${npc.e.name}: ${npc.line}`);
    }
  }

  /** Loja ou conversa aberta e você se afastou: fecha (o servidor recusaria a compra de longe). */
  private checkNpcDistance(): void {
    for (const window of [this.shop, this.talk]) {
      const id = window.npcId;
      if (id === null) continue;
      const npc = this.npcs.get(id);
      const me = feetAt(this.predicted.x, this.predicted.y);
      const feet = npc ? feetAt(npc.e.x, npc.e.y) : null;
      if (!feet || Math.hypot(me.x - feet.x, me.y - feet.y) > TRADE_RANGE + TRADE_SLACK) {
        window.close();
        if (window === this.shop) this.toast.show('Você se afastou da loja');
      }
    }
  }

  /** Avisa quando entra ou sai de uma área segura. */
  private checkSafeArea(): void {
    if (this.map.safeAreas.length === 0) return;
    const at = footCenter(this.predicted.x, this.predicted.y);
    const safe = this.map.isSafeAt(at.x, at.y);
    if (safe === this.wasSafe) return;
    const first = this.wasSafe === null;
    this.wasSafe = safe;
    const area = this.map.safeAreas.find((a) => at.x >= a.x0 && at.x < a.x1 && at.y >= a.y0 && at.y < a.y1);
    if (safe) this.zoneBanner.show(area?.name || this.map.name, 'Zona segura');
    else this.zoneBanner.show(this.map.name, first ? 'Cuidado: aqui tem perigo' : 'Saiu da zona segura: cuidado', true);
  }

  // ======================= combate =======================

  /** Onde o pé de alguém está desenhado agora (a view sabe; se não souber, a última posição do servidor). */
  private drawnFeet(id: number): Point | null {
    const drawn = this.view?.actorPosition?.(id);
    if (drawn) return drawn;
    if (id === this.myId) return this.predicted ? feetAt(this.predicted.x, this.predicted.y) : null;
    const e = this.entities.get(id);
    return e ? feetAt(e.x, e.y) : null;
  }

  /** Barras de vida: monstros e outros jogadores machucados (a sua vida fica no painel). */
  private *hurtBars(): Iterable<{ id: number; hp: number; maxHp: number }> {
    for (const e of this.entities.values()) {
      if (e.id === this.myId || e.kind === 'npc' || e.hp >= e.maxHp || this.fainted.has(e.id)) continue;
      yield { id: e.id, hp: e.hp, maxHp: e.maxHp };
    }
  }

  private myFeet(): Point {
    return feetAt(this.predicted.x, this.predicted.y);
  }

  /** Mira do mouse: do seu pé até o ponto do chão apontado (radianos), ou null sem mouse. */
  private mouseAim(): number | null {
    if (!this.mouse || !this.view) return null;
    return aimAngle(this.myFeet(), this.view.toWorld(this.mouse.x, this.mouse.y));
  }

  /** O monstro mais perto (pé a pé) até `maxDistance` metros. */
  private nearestMonster(maxDistance: number): EntityState | null {
    const me = this.myFeet();
    let best: EntityState | null = null;
    let bestDistance = maxDistance;
    for (const e of this.entities.values()) {
      if (e.kind !== 'monster') continue;
      const feet = feetAt(e.x, e.y);
      const distance = Math.hypot(feet.x - me.x, feet.y - me.y);
      if (distance <= bestDistance) {
        best = e;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Mira automática (botões e celular): o monstro mais perto; sem monstro, para onde você olha. */
  private autoAim(maxDistance: number): number {
    const target = this.nearestMonster(maxDistance);
    if (!target) return (this.myAngle * Math.PI) / 180;
    return aimAngle(this.myFeet(), feetAt(target.x, target.y));
  }

  /** Começa a puxar o estilingue: o servidor conta a carga pelo relógio dele, até o tiro. */
  private startCharge(aim: Aim, now: number): void {
    if (this.dead || this.charging || this.guardHeld) return; // defendendo, as mãos estão ocupadas
    if (this.refuseInSafeArea(now)) return;
    this.pendingShot = null;
    const angle = this.aimFor(aim, 0);
    this.charging = { since: now, aim, sentAngle: angle };
    this.conn.send({ t: 'charge' });
    this.combat.setCharge(this.myId, now, this.shot().chargeMs);
    this.view?.action?.(this.myId, 'sling-pull', toDegrees(angle)); // já puxa para a mira
    this.aimFacing = { degrees: toDegrees(angle), until: Infinity };
    this.faceStill(angle, now);
  }

  /**
   * A cada quadro, puxando: o som do elástico sobe com a carga, e a mira acompanha o alvo (ou o mouse): a view vira
   * os braços e o corpo quando ela muda mais que PULL_AIM_RESEND. O servidor só fica sabendo da direção no tiro.
   */
  private updateCharge(now: number): void {
    const charging = this.charging;
    if (!charging) return;
    const shot = this.shot();
    const charge = chargeFraction(now - charging.since, shot);
    this.sfx.charge(charge, shot.kind); // o elástico do estilingue ou a corda do arco
    const angle = this.aimFor(charging.aim, charge);
    if (Math.abs(angleDiff(charging.sentAngle, angle)) > PULL_AIM_RESEND) {
      charging.sentAngle = angle;
      this.view?.action?.(this.myId, 'sling-pull', toDegrees(angle));
    }
    this.aimFacing = { degrees: toDegrees(angle), until: Infinity };
    this.faceStill(angle, now);
    this.showArmedAim(charging.aim, charge);
  }

  /** Com a flecha especial no arco, puxando: a faixa no chão mostra até onde ela vai e onde explode. */
  private showArmedAim(aim: Aim, charge: number): void {
    const skill = this.armedSkill();
    if (!skill) return;
    const spot = this.aimSpotFor(aim, charge);
    const feet = this.myFeet();
    const range = this.armedRange(skill, charge, spot.d);
    this.combat.setAim({ from: feet, x: feet.x + Math.cos(spot.angle) * range, y: feet.y + Math.sin(spot.angle) * range, r: skill.width, line: true });
  }

  /** Esta habilidade ainda tem ponto (tirou os pontos com a flecha no arco: ela sai)? */
  private armedSkillId(id: string): string | null {
    return (this.hero.skills[id] ?? 0) > 0 ? id : null;
  }

  /** A habilidade da flecha especial que está no arco (se ainda tem ponto nela). */
  private armedSkill(): ClassSkillInfo | null {
    if (!this.armed) return null;
    const cls = this.classes.find((c) => c.id === this.hero.class);
    const skill = cls?.skills.find((s) => s.id === this.armed);
    return skill && (this.hero.skills[skill.id] ?? 0) > 0 ? skill : null;
  }

  /** Até onde a flecha especial vai com esta carga, mirando a `aimed` metros (a mesma conta do servidor). */
  private armedRange(skill: ClassSkillInfo, charge: number, aimed: number | undefined): number {
    const shot = this.shot();
    const reach = Math.max(shot.rangeMin, skill.range);
    return aimedRange(shot.rangeMin + (reach - shot.rangeMin) * charge, aimed);
  }

  /** Parado, o corpo vira para `angle` (andando, o andar cuida de para onde ele olha). */
  private faceStill(angle: number, now: number): void {
    if (now - this.lastWalkAt <= 200) return;
    if (Math.abs(angleDiff((this.myAngle * Math.PI) / 180, angle)) > 0.05) this.faceAngle(toDegrees(angle));
  }

  /** Soltou: a pedra sai com a carga que juntou (durante a recarga, sai assim que der). */
  private releaseCharge(now: number): void {
    const charging = this.charging;
    if (!charging) return;
    this.charging = null;
    this.sfx.stopCharge();
    this.combat.setCharge(this.myId, null);
    if (this.armed) this.combat.setAim(null);
    // durante a recarga, sai assim que der, com a carga contada até lá (o servidor conta igual, até o tiro chegar)
    if (now < this.nextShotAt) this.pendingShot = { at: this.nextShotAt, aim: charging.aim, since: charging.since };
    else if (!this.fireAim(charging.aim, chargeFraction(now - charging.since, this.shot()), now)) this.view?.action?.(this.myId, 'sling-cancel');
  }

  /** Solta a pedra sem atirar (esquiva, golpe recebido, desmaio, troca de mapa, janela sem foco). */
  private cancelCharge(): void {
    const pulling = this.charging !== null || this.pendingShot !== null;
    if (pulling) {
      this.aimFacing = null;
      if (this.armed) this.combat.setAim(null);
    }
    this.charging = null;
    this.pendingShot = null;
    this.sfx.stopCharge();
    this.combat.setCharge(this.myId, null);
    // a view volta da pose de puxar (o 'sling-pull' começa a pose; o 'shoot' ou este 'sling-cancel' terminam)
    if (pulling) this.view?.action?.(this.myId, 'sling-cancel');
  }

  private handlePendingShot(now: number): void {
    const pending = this.pendingShot;
    if (!pending || now < pending.at) return;
    this.pendingShot = null;
    if (!this.fireAim(pending.aim, chargeFraction(now - pending.since, this.shot()), now)) this.view?.action?.(this.myId, 'sling-cancel');
  }

  /** Atira para onde a mira manda: no monstro (onde ele está de verdade), para o mouse, ou no mais perto. */
  private fireAim(aim: Aim, charge: number, now: number): boolean {
    const spot = this.aimSpotFor(aim, charge);
    return this.tryShoot(spot.angle, now, charge, spot.d);
  }

  /**
   * Para onde a mira manda e a que distância está o ponto mirado (o tiro cai lá, se a carga alcançar): o pé do
   * monstro (com uma folga, para a pedra chegar nele) ou o ponto do chão debaixo do mouse. Sem ponto, vai até o fim.
   */
  private aimSpotFor(aim: Aim, charge: number): { angle: number; d: number | undefined } {
    const feet = this.myFeet();
    const far = (to: Point, slack: number) => Math.hypot(to.x - feet.x, to.y - feet.y) + slack;
    const target = aim.by === 'target' ? this.entities.get(aim.id) : undefined;
    if (target) {
      const at = feetAt(target.x, target.y);
      return { angle: aimAngle(feet, at), d: far(at, AIM_TARGET_SLACK) };
    }
    if ((aim.by === 'mouse' || aim.by === 'target') && this.mouse && this.view) {
      // com o mouse em cima de um bicho (no corpo dele), mira no pé dele: é para onde quem joga está olhando
      const hovered = this.actorAtScreen(this.mouse.x, this.mouse.y, 'monster');
      const at = (hovered !== null ? this.drawnFeet(hovered) : null) ?? this.view.toWorld(this.mouse.x, this.mouse.y);
      return { angle: aimAngle(feet, at), d: far(at, hovered !== null ? AIM_TARGET_SLACK : 0) };
    }
    // a mira automática procura até onde esta pedra chega (com carga cheia, mais longe)
    const near = this.nearestMonster(chargedRange(charge, this.map.metric, this.shot()) + AUTO_AIM_SLACK);
    if (near) {
      const at = feetAt(near.x, near.y);
      return { angle: aimAngle(feet, at), d: far(at, AIM_TARGET_SLACK) };
    }
    return { angle: (this.myAngle * Math.PI) / 180, d: undefined };
  }

  /** Para onde a mira manda agora (a mesma conta na puxada e no tiro). */
  private aimFor(aim: Aim, charge: number): number {
    return this.aimSpotFor(aim, charge).angle;
  }

  /** Pedra fraca na hora (toque rápido no monstro, no celular). */
  private quickShot(angle: number, now: number): void {
    if (this.dead || this.charging || this.guardHeld || now < this.nextShotAt) return;
    this.conn.send({ t: 'charge' }); // zera a carga no servidor: o toque rápido é uma pedra sem carga
    this.tryShoot(angle, now, 0, undefined);
  }

  /**
   * A lista de NPCs deste mapa mudou (painel ou menu ADM): quem mudou de lugar anda até lá, quem chegou aparece, quem
   * foi embora some. Loja ou conversa aberta mostra o que mudou.
   */
  private onNpcList(list: NpcInfo[]): void {
    const fresh = new Set<number>();
    for (const npc of list) {
      fresh.add(npc.e.id);
      const old = this.entities.get(npc.e.id);
      this.npcs.set(npc.e.id, npc);
      if (!old) {
        this.addEntity(npc.e, false);
      } else if (old.x !== npc.e.x || old.y !== npc.e.y) {
        this.entities.set(npc.e.id, npc.e);
        const feet = feetAt(npc.e.x, npc.e.y);
        this.view?.moveActor(npc.e.id, feet.x, feet.y, degreesOfDir(npc.e.dir), { durationMs: 0 });
      }
      if (this.shop.npcId === npc.e.id) this.shop.open(npc); // loja aberta: mostra o que ela vende agora
      if (this.talk.npcId === npc.e.id) this.talk.open(npc, this.questContext());
    }
    for (const id of [...this.npcs.keys()]) {
      if (fresh.has(id)) continue;
      this.npcs.delete(id);
      this.entities.delete(id);
      this.view?.removeActor(id);
      if (this.talk.npcId === id) this.talk.close();
      if (this.shop.npcId === id) this.shop.close();
    }
    this.gmPanel.setNpcs([...this.npcs.values()].map((npc) => ({ id: npc.e.type, name: npc.e.name })));
    this.refreshQuests(); // os sinais ! e ? em cima de quem chegou
  }

  // ======================= conversa =======================

  /**
   * A cada quadro: abriu ou fechou conversa (missão ou loja)? A câmera vai até quem fala (zoom suave e, onde a view
   * souber, centralizando nele) e volta quando fecha.
   */
  private updateConversation(now: number): void {
    const npcId = this.talk.isOpen ? this.talk.npcId : this.shop.isOpen ? this.shop.npcId : null;
    if (npcId !== this.conversationNpc) {
      const before = this.conversationNpc;
      this.conversationNpc = npcId;
      if (before !== null) this.view?.talk?.(before, 0);
      const npc = npcId !== null ? this.npcs.get(npcId) : undefined;
      this.talkPingAt = 0;
      if (npc) {
        const feet = feetAt(npc.e.x, npc.e.y);
        // quem passeia vira o corpo para quem veio falar (os outros NPCs ficam como estão)
        const me = this.myFeet();
        if (this.npcStrolls.has(npc.e.id) && Math.hypot(me.x - feet.x, me.y - feet.y) > 0.05) this.view?.moveActor(npc.e.id, feet.x, feet.y, toDegrees(aimAngle(feet, me)), { durationMs: 0 });
        this.view?.focus?.({ x: feet.x, y: feet.y });
        this.animateZoom(Math.max(this.zoom, CONVERSATION_ZOOM), now);
        this.speak(npc.e.id, this.openingLine(npc));
      } else {
        this.view?.focus?.(null);
        this.animateZoom(this.zoom, now);
      }
    }
    // com a conversa (ou a loja) aberta, o servidor fica sabendo de tempos em tempos: o NPC que passeia espera parado
    if (this.conversationNpc !== null && now >= this.talkPingAt) {
      this.talkPingAt = now + TALK_PING_MS;
      this.conn.send({ t: 'talk', npc: this.conversationNpc });
    }
    const anim = this.zoomAnim;
    if (anim && this.view?.setZoom) {
      const t = Math.min(1, (now - anim.start) / CONVERSATION_ZOOM_MS);
      this.viewZoom = this.view.setZoom(anim.from + (anim.to - anim.from) * t * t * (3 - 2 * t));
      if (t >= 1) this.zoomAnim = null;
    }
  }

  private animateZoom(to: number, now: number): void {
    if (!this.view?.setZoom || Math.abs(to - this.viewZoom) < 1e-3) return;
    this.zoomAnim = { from: this.viewZoom, to, start: now };
  }

  /** `id` fala `text`: a view mexe a boca pelo tempo de ler (a que não souber, segue sem). */
  private speak(id: number, text: string): void {
    if (text) this.view?.talk?.(id, Math.min(7000, Math.max(SHORT_REPLY_MS, text.length * 55)));
  }

  /** O que o NPC diz ao abrir a conversa: a missão que ele pede agora, ou a fala dele. */
  private openingLine(npc: NpcInfo): string {
    const ctx = this.questContext();
    const offer = this.questList.find((q) => q.giver === npc.e.type && questBlocker(q, ctx.log, ctx.level) === null);
    return offer?.ask ?? npc.line ?? '';
  }

  /** Mudou o diário com a conversa aberta: quem está falando com você responde (entregou, aceitou, desistiu). */
  private npcAnswers(before: QuestLog, log: QuestLog): void {
    const id = this.conversationNpc;
    const npc = id !== null ? this.npcs.get(id) : undefined;
    if (!npc) return;
    for (const quest of this.questList) {
      if (before[quest.id]?.state === log[quest.id]?.state) continue;
      if (questFinisher(quest) === npc.e.type && log[quest.id]?.state === 'done') return this.speak(npc.e.id, quest.done);
      if (quest.giver === npc.e.type) return void this.view?.talk?.(npc.e.id, SHORT_REPLY_MS); // aceitou ou desistiu: resposta curta
    }
  }

  // ======================= defesa =======================

  /** Segurou F ou o botão Defesa: levanta a defesa (e solta a pedra que estava puxando). */
  private startGuard(now: number): void {
    if (this.dead || this.guardHeld) return;
    this.cancelCharge();
    this.guardHeld = true;
    this.guardAngle = this.guardAim(now, true);
    this.sendGuard(now);
  }

  /** Soltou: baixa a defesa (a energia volta um pouco depois). */
  private stopGuard(): void {
    if (!this.guardHeld) return;
    this.guardHeld = false;
    this.conn.send({ t: 'guard', on: false, a: round3(this.guardAngle) });
    this.view?.action?.(this.myId, 'guard-end');
  }

  /** Mudou de mapa: o servidor já baixou a defesa; aqui só esquece (o soltar do botão, se vier, não faz nada). */
  private forgetGuard(): void {
    this.guardHeld = false;
    this.guardButton.reset();
  }

  /** Manda a defesa (e a direção dela) ao servidor; a view vira os braços para lá (ao levantar e quando a mira muda). */
  private sendGuard(now: number): void {
    this.guardSentAngle = this.guardAngle;
    this.guardSentAt = now;
    this.conn.send({ t: 'guard', on: true, a: round3(this.guardAngle) });
    this.view?.action?.(this.myId, 'guard', toDegrees(this.guardAngle));
  }

  /**
   * Para onde a defesa aponta: para o monstro mais perto (até GUARD_AIM_RANGE); sem monstro, para onde você anda;
   * parado, fica como estava (ao levantar, para onde você olha).
   */
  private guardAim(now: number, raising = false): number {
    const target = this.nearestMonster(GUARD_AIM_RANGE);
    if (target) return aimAngle(this.myFeet(), feetAt(target.x, target.y));
    if (now - this.lastWalkAt < 200) return (this.lastWalkDegrees * Math.PI) / 180;
    return raising ? (this.myAngle * Math.PI) / 180 : this.guardAngle;
  }

  /** A cada quadro: a defesa acompanha o alvo, a barra de energia anda e o desenho do chão fica sabendo. */
  private updateGuard(now: number): void {
    const dt = this.guardFrameAt > 0 ? Math.min(0.25, (now - this.guardFrameAt) / 1000) : 0;
    this.guardFrameAt = now;
    if (this.guardHeld) {
      this.guardAngle = this.guardAim(now);
      const turned = Math.abs(angleDiff(this.guardAngle, this.guardSentAngle)) > GUARD_RESEND_ANGLE;
      if (turned && now - this.guardSentAt >= GUARD_RESEND_MS) this.sendGuard(now);
      // parado, o corpo vira para onde a defesa aponta (andando, o andar já cuida disso)
      const facing = (this.myAngle * Math.PI) / 180;
      if (now - this.lastWalkAt > 200 && Math.abs(angleDiff(facing, this.guardAngle)) > 0.05) this.faceAngle(toDegrees(this.guardAngle));
    }
    const gap = this.energy - this.energyShown;
    const step = ENERGY_ANIM_PER_S * dt;
    this.energyShown = Math.abs(gap) <= step ? this.energy : this.energyShown + Math.sign(gap) * step;
    const up = this.guardHeld && this.guardState !== 'broken';
    this.combat.setGuard(this.myId, up ? this.guardAngle : null, now);
    this.combat.setEnergy(this.myId, this.energyShown, up ? 'up' : this.guardState);
    this.hud.setEnergy(this.energyShown, GUARD_MAX_ENERGY); // a barra azul da HUD (só mexe na tela quando o número muda)
    this.guardButton.show(this.guardHeld, this.guardState === 'broken');
  }

  /** O seu tile está entre estes ([x1, y1, x2, y2, ...])? */
  private onMyTile(tiles: number[]): boolean {
    const at = footCenter(this.predicted.x, this.predicted.y);
    const tx = Math.floor(at.x);
    const ty = Math.floor(at.y);
    for (let i = 0; i + 1 < tiles.length; i += 2) if (tiles[i] === tx && tiles[i + 1] === ty) return true;
    return false;
  }

  /** Zona segura: aqui ninguém briga (o servidor também recusa). */
  private inSafeArea(): boolean {
    if (this.map.safeAreas.length === 0) return false;
    const at = footCenter(this.predicted.x, this.predicted.y);
    return this.map.isSafeAt(at.x, at.y);
  }

  private refuseInSafeArea(now: number): boolean {
    if (!this.inSafeArea()) return false;
    if (now >= this.safeToastAt) {
      this.toast.show('Zona segura: aqui não tem briga');
      this.safeToastAt = now + 1500;
    }
    return true;
  }

  /**
   * O tiro de agora: o da arma equipada (o arco: flecha, com carga, alcance, intervalo e velocidade dele) ou a pedra.
   * A mesma conta do servidor (shotProfile), para a previsão bater.
   */
  private shot(): ShotProfile {
    const weapon = this.lastInv.equipped.weapon;
    return shotProfile(this.rules, weapon ? this.items.get(weapon)?.shot : null, this.map.metric);
  }

  /** Atira na direção `angle` (radianos), com a carga (0 a 1): a pedra ou a flecha aparece na hora; o servidor decide. */
  private tryShoot(angle: number, now: number, charge: number, aimed: number | undefined): boolean {
    if (this.dead || this.guardHeld || now < this.nextShotAt) return false;
    if (this.refuseInSafeArea(now)) return false;
    const shot = this.shot();
    // um pouco mais que a recarga do servidor, para a variação da rede não fazer um tiro ser recusado
    this.nextShotAt = now + shot.cooldownMs + 40;
    const cid = ++this.shotCid;
    const sent = round3(angle);
    const d = aimed === undefined ? undefined : round3(aimed);
    this.conn.send({ t: 'shoot', cid, a: sent, ...(d !== undefined ? { d } : {}) });
    const feet = this.myFeet();
    const origin = shotOriginOfFeet(feet.x, feet.y);
    // atirar andando espalha (a mesma conta do servidor, pelo número do tiro): correndo mais, devagar menos
    const stance: ShotStance = now - this.lastWalkAt > SHOT_MOVING_MS ? 'still' : this.lastWalkSlow ? 'walk' : 'run';
    const flight = sent + shotSpread(cid, stance, this.rules);
    const special = this.armedSkill();
    if (special && now >= (this.castReadyAt.get(special.id) ?? 0)) {
      // a flecha especial que estava no arco (a Flecha Ancestral): é ela que sai, e a recarga dela começa agora
      this.combat.myShot(cid, origin.x, origin.y, flight, special.speed, this.armedRange(special, charge, d), now, 'ancestral');
      this.sfx.play('spirit');
      this.setArmed(null);
      const wait = this.gmNoCd ? 0 : special.cooldownMs;
      const readyAt = now + wait;
      this.castReadyAt.set(special.id, readyAt);
      const slot = this.classSlotOf(special.id);
      if (slot) this.actionBar.setCooldown(slot, readyAt, wait);
    } else {
      this.combat.myShot(cid, origin.x, origin.y, flight, shot.speed, aimedRange(chargedRange(charge, this.map.metric, shot), d), now, shot.kind);
      this.sfx.play(shot.kind === 'flecha' ? 'bow-release' : 'shot');
    }
    this.aimFacing = { degrees: toDegrees(angle), until: now + SHOT_FACING_MS }; // fica um instante virado para o tiro
    this.faceAngle(toDegrees(angle));
    this.view?.action?.(this.myId, 'shoot', toDegrees(angle));
    this.actionBar.setCooldown('shot', this.nextShotAt, shot.cooldownMs);
    return true;
  }

  /** Botões da tela (celular e PC). */
  private onAction(slot: ActionSlot, down: boolean): void {
    const now = performance.now();
    if (slot === 'shot') {
      // segurar o botão puxa; soltar atira no monstro mais perto
      if (down) this.startCharge({ by: 'button' }, now);
      else if (this.charging?.aim.by === 'button') this.releaseCharge(now);
      return;
    }
    if (!down) return;
    if (slot === 'dash') this.tryDash(now);
    else if (slot === 'jump') this.tryJump(now);
    else if (slot === 'skill1') this.trySkill(FOLEGO, 0, now);
    else if (CLASS_SLOTS.includes(slot)) {
      const skill = this.classSkillAt(CLASS_SLOTS.indexOf(slot));
      if (skill) this.castAuto(skill, now); // o botão mira sozinho: onde pega mais bichos
    }
  }

  /** O seu personagem vira para `degrees` (atirando, golpeando). */
  private faceAngle(degrees: number): void {
    this.myAngle = degrees;
    const feet = this.myFeet();
    this.view?.moveActor(this.myId, feet.x, feet.y, degrees, { durationMs: 0 });
  }

  /**
   * Para onde rolar: a direção que você segura (teclado ou joystick); senão, para onde está andando; senão, para
   * longe do monstro mais perto (é o que se quer quando um golpe vem vindo); senão, para onde olha.
   */
  private dashDegrees(): number {
    const held = this.keyboard.current();
    if (held !== null) return this.screenDegrees(DX[held.dir], DY[held.dir]);
    const stick = this.joystick.direction();
    if (stick) return this.screenDegrees(stick.dx, stick.dy);
    const next = this.route[0];
    if (next) return degreesToward(this.predicted.x, this.predicted.y, next.x, next.y);
    const facing = ((Math.round(this.myAngle) % 360) + 360) % 360;
    const threat = this.nearestMonster(4.5);
    if (!threat) return facing;
    const danger = feetAt(threat.x, threat.y);
    let best = facing;
    let bestDistance = -Infinity;
    for (let degrees = 0; degrees < 360; degrees += 45) {
      const landing = sweepBody(this.map, this.predicted, degrees, DASH_TILES);
      if (!landing.moved) continue;
      const feet = feetAt(landing.x, landing.y);
      const distance = Math.hypot(feet.x - danger.x, feet.y - danger.y);
      if (distance > bestDistance) {
        best = degrees;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Esquiva: rola DASH_TILES metros (desliza no que tiver no caminho); some do golpe por um instante. */
  private tryDash(now: number): void {
    if (this.dead || now < this.dashReadyAt || this.pending.length >= MAX_PENDING_WALKS) return;
    if (now - this.jumpedAt < JUMP_AIR_MS) return; // no ar, não rola (o servidor também recusa)
    const degrees = this.dashDegrees();
    const result = sweepBody(this.map, this.predicted, degrees, DASH_TILES);
    if (!result.moved) {
      this.toast.show('Sem espaço para rolar aí');
      return;
    }
    this.cancelCharge(); // a esquiva solta a pedra que estava puxando (o servidor faz o mesmo)
    this.seq += 1;
    this.pending.push({ seq: this.seq, a: degrees, dash: true, slow: false, guard: this.guardHeld, fly: this.gmFly });
    this.conn.send({ t: 'walk', seq: this.seq, a: degrees, dash: true });
    this.sfx.play('dash');
    this.predicted = { x: result.x, y: result.y, dir: result.dir };
    this.myAngle = degrees;
    const feet = this.myFeet();
    this.view?.moveActor(this.myId, feet.x, feet.y, degrees, { durationMs: 140, dash: true });
    this.view?.action?.(this.myId, 'dash', degrees);
    this.dashReadyAt = now + DASH_COOLDOWN_MS + 120;
    this.dashedAt = now;
    this.actionBar.setCooldown('dash', this.dashReadyAt, DASH_COOLDOWN_MS);
    this.clearRoute();
  }

  /**
   * Pular (Espaço no padrão): por enquanto só de enfeite. Pula na hora; o servidor confere a recarga e mostra para
   * quem está perto. Defendendo ou puxando o tiro, não pula (o desenho também não deixa).
   */
  private tryJump(now: number): void {
    if (this.dead || this.guardHeld || this.charging || now < this.jumpReadyAt) return;
    if (now - this.dashedAt < DASH_ROLL_MS) return; // rolando, não pula (o servidor também recusa)
    this.jumpedAt = now;
    this.jumpReadyAt = now + JUMP_COOLDOWN_MS + 40;
    this.conn.send({ t: 'jump' });
    this.view?.action?.(this.myId, 'jump');
    this.sfx.play('jump');
  }

  /** Habilidade `n` de SKILLS (no jogo novo, só o Fôlego: cura; a Bordunada ficou no jogo antigo). */
  private trySkill(n: number, angle: number, now: number): void {
    const skill = SKILLS[n];
    if (!skill || this.dead || this.guardHeld) return;
    if (now < this.skillReadyAt[n]!) {
      this.toast.show('Ainda recarregando...');
      return;
    }
    if (skill.kind === 'heal' && this.myHp >= this.myMaxHp) {
      this.toast.show('Sua vida já está cheia');
      return;
    }
    if (skill.kind === 'arc' && this.refuseInSafeArea(now)) return;
    const wait = this.gmNoCd ? 0 : skill.cooldownMs;
    this.skillReadyAt[n] = now + wait;
    this.actionBar.setCooldown(`skill${n}` as ActionSlot, this.skillReadyAt[n]!, wait);
    this.conn.send({ t: 'skill', n, a: round3(angle) });
    if (skill.kind === 'arc') {
      // o servidor não manda o efeito da Bordunada de volta para quem golpeou: mostra aqui mesmo
      this.sfx.play('arc');
      this.faceAngle(toDegrees(angle));
      this.view?.action?.(this.myId, 'arc', toDegrees(angle));
      const feet = this.myFeet();
      this.combat.flash(feet.x, feet.y, angle, 1.6, false, now);
    }
  }

  // ======================= classe e habilidades =======================

  /** A 1ª habilidade da classe, se ela já tem ponto (é a do Q e do 1º quadrado da barra), ou null. */
  private barSkill(): ClassSkillInfo | null {
    return this.classSkillAt(0);
  }

  /** A habilidade número `index` da classe (na ordem de data/classes.json), se ela já tem ponto, ou null. */
  private classSkillAt(index: number): ClassSkillInfo | null {
    const cls = this.classes.find((c) => c.id === this.hero.class);
    const skill = cls?.skills[index];
    return skill && skill.kind && (this.hero.skills[skill.id] ?? 0) > 0 ? skill : null;
  }

  /**
   * A cada quadro, com os Olhos de Gavião valendo: a view destaca todos os bichos que você conhece (o contorno na cor
   * do perigo, por cima das copas e do escuro, e o nível). Acabou (ou desmaiou): o destaque some e a câmera volta.
   */
  private updateHawk(now: number): void {
    if (this.dead) this.hawkUntil = 0; // desmaiou: os Olhos acabam
    if (now >= this.hawkUntil || !this.view) {
      this.endHawk();
      return;
    }
    this.hawkShown = true;
    const list = [];
    for (const e of this.entities.values()) {
      if (e.kind === 'monster') list.push({ id: e.id, color: dangerColor(e.level, this.myLevel), level: e.level });
    }
    this.view.highlight?.(list);
  }

  /** Os Olhos de Gavião acabaram (ou desmaiou, ou trocou de mapa): tira o destaque e volta a câmera. */
  private endHawk(): void {
    if (!this.hawkShown) return;
    this.hawkShown = false;
    this.view?.highlight?.([]);
    this.view?.setVision?.(0);
  }

  /** Quantas habilidades com ponto (para saber se a barra muda: aprendeu uma nova, ou tirou os pontos). */
  private learnedOnBar(): string {
    return CLASS_KEYS.map((_, i) => this.classSkillAt(i)?.id ?? '').join(',');
  }

  /** O servidor mandou a classe e os pontos (escolheu, aprendeu, subiu de nível...): a janela e a barra acompanham. */
  private setHero(hero: HeroState): void {
    const before = this.hero;
    const hadOnBar = this.learnedOnBar();
    this.hero = hero;
    if (!before.canChoose && hero.canChoose) this.toast.show('Você já pode escolher a sua classe: abra as Habilidades (K)', 4500);
    this.skillsPanel.update(this.classes, hero, this.myLevel);
    if (this.learnedOnBar() !== hadOnBar) {
      this.cancelAim();
      this.rebuildActionBar(); // aprendeu (ou tirou os pontos): o botão da habilidade aparece (ou sai)
    }
  }

  /** Dá para usar esta habilidade agora? (Avisa o porquê, se não der.) */
  private castable(skill: ClassSkillInfo, now: number, calm = skill.kind === 'olhos'): boolean {
    const look = calm; // os Olhos de Gavião não atacam (e carregar a flecha no arco também não): valem defendendo e na área segura
    if (this.dead || (this.guardHeld && !look)) return false;
    if (now < (this.castReadyAt.get(skill.id) ?? 0)) {
      this.toast.show('Ainda recarregando...');
      return false;
    }
    return look || !this.refuseInSafeArea(now);
  }

  /**
   * Apertou a tecla de uma habilidade da classe (Q a 1ª, R a 2ª): começa a mirar — o círculo (ou a linha) segue o mouse e
   * soltar a tecla usa. Sem mouse (no celular), usa na hora, mirando sozinha.
   */
  private startAim(index: number, now: number): void {
    const skill = this.classSkillAt(index);
    if (!skill) {
      const cls = this.classes.find((c) => c.id === this.hero.class);
      const name = cls?.skills[index]?.name;
      this.toast.show(!this.hero.class ? 'Escolha a sua classe nas Habilidades (K)' : name ? `Ponha um ponto em ${name}: abra as Habilidades (K)` : 'Esta tecla ainda não tem habilidade');
      return;
    }
    if (skill.kind === 'flecha') {
      this.toggleArmed(skill, now); // a Flecha Ancestral não mira aqui: carrega no arco e sai no próximo tiro
      return;
    }
    if (this.aiming || !this.castable(skill, now)) return;
    // sem mouse (no celular), ou uma habilidade que não mira (os Olhos de Gavião): usa na hora
    if (!this.mouse || this.usingTouch || skill.kind === 'olhos') {
      this.castAuto(skill, now);
      return;
    }
    this.aiming = skill;
    this.updateAim();
  }

  /**
   * Onde a habilidade vai, mirando no mouse: a Chuva, o ponto do chão apontado (trazido para dentro do alcance); a
   * Flecha, o fim do voo na direção do mouse.
   */
  private aimSpot(skill: ClassSkillInfo): Point | null {
    if (!this.mouse || !this.view || !this.map) return null;
    const feet = this.myFeet();
    // com o mouse em cima de um bicho (no corpo dele), mira no pé dele: é para onde quem joga está olhando
    const hovered = this.actorAtScreen(this.mouse.x, this.mouse.y, 'monster');
    const pointed = (hovered !== null ? this.drawnFeet(hovered) : null) ?? this.view.toWorld(this.mouse.x, this.mouse.y);
    if (skill.kind === 'flecha') {
      const angle = Math.hypot(pointed.x - feet.x, pointed.y - feet.y) > 0.01 ? aimAngle(feet, pointed) : (this.myAngle * Math.PI) / 180;
      return { x: feet.x + Math.cos(angle) * skill.range, y: feet.y + Math.sin(angle) * skill.range };
    }
    const aimed = castPoint(feet, pointed, skill.range);
    return { x: Math.max(0, Math.min(this.map.width, aimed.x)), y: Math.max(0, Math.min(this.map.height, aimed.y)) };
  }

  /** A cada quadro, mirando: o círculo (ou a linha da flecha) vai para onde o mouse aponta. */
  private updateAim(): void {
    const skill = this.aiming;
    if (!skill) return;
    const spot = this.aimSpot(skill);
    const numbers = skillPoint(skill, this.hero.skills[skill.id] ?? 0);
    if (!spot || !numbers || this.dead) {
      this.cancelAim();
      return;
    }
    const line = skill.kind === 'flecha';
    this.combat.setAim({ from: this.myFeet(), x: spot.x, y: spot.y, r: line ? skill.width : numbers.radius, line });
  }

  /** Soltou a tecla: usa onde o círculo está. */
  private releaseAim(now: number): void {
    const skill = this.aiming;
    if (!skill) return;
    const spot = this.aimSpot(skill);
    this.cancelAim();
    if (spot) this.castAt(skill, spot, now);
  }

  private cancelAim(): void {
    this.aiming = null;
    this.combat.setAim(null);
  }

  /** Usa mirando sozinha (botão da barra, celular): onde pega mais bichos. Sem bicho ao alcance, avisa. */
  private castAuto(skill: ClassSkillInfo, now: number): void {
    const numbers = skillPoint(skill, this.hero.skills[skill.id] ?? 0);
    if (skill.kind === 'flecha') {
      if (numbers) this.toggleArmed(skill, now);
      return;
    }
    if (!numbers || !this.castable(skill, now)) return;
    if (skill.kind === 'olhos') {
      this.castAt(skill, this.myFeet(), now); // não mira: vale em volta de você
      return;
    }
    const spot = this.bestRainSpot(skill.range, numbers.radius);
    if (!spot) {
      this.toast.show('Nenhum bicho ao alcance');
      return;
    }
    this.castAt(skill, spot, now);
  }

  /**
   * Carrega (ou descarrega) a flecha especial no arco: o próximo tiro é ela, com a puxada de verdade — quanto mais
   * puxar, mais longe; cai e explode onde você mirar. A recarga só começa quando ela sai. O servidor confirma (`armed`).
   */
  private toggleArmed(skill: ClassSkillInfo, now: number): void {
    if (this.dead) return;
    if (this.armed === skill.id) {
      this.setArmed(null);
      this.conn.send({ t: 'cast', id: skill.id, x: 0, y: 0 });
      return;
    }
    if (!this.castable(skill, now, true)) return;
    this.setArmed(skill.id);
    this.conn.send({ t: 'cast', id: skill.id, x: 0, y: 0 });
    this.combat.floater(this.myId, `${skill.name} no arco!`, '#8dffc8', now);
    this.sfx.play('hawk');
  }

  /** A flecha especial entrou ou saiu do arco: o quadrado dela na barra acende (`data-armed`, o desenho é da [arte]). */
  private setArmed(id: string | null): void {
    if (this.armed === id) return;
    const old = this.armed ? this.classSlotOf(this.armed) : null;
    this.armed = id;
    if (!id) this.combat.setAim(null);
    const slot = id ? this.classSlotOf(id) : null;
    for (const el of document.querySelectorAll<HTMLElement>('#actions .action')) {
      // o anel verde pulsando é da [arte] (style.css, pelo `data-armed`)
      if (old && el.dataset.slot === old) delete el.dataset.armed;
      if (slot && el.dataset.slot === slot) el.dataset.armed = '1';
    }
  }

  /** O pé do monstro onde um círculo deste raio pega mais monstros, até `range` metros de você (empate: o mais perto). */
  private bestRainSpot(range: number, radius: number): Point | null {
    const me = this.myFeet();
    const monsters = [...this.entities.values()].filter((e) => e.kind === 'monster').map((e) => this.drawnFeet(e.id) ?? feetAt(e.x, e.y));
    let best: Point | null = null;
    let bestCount = 0;
    let bestDistance = Infinity;
    for (const spot of monsters) {
      const distance = Math.hypot(spot.x - me.x, spot.y - me.y);
      if (distance > range) continue;
      const count = monsters.filter((m) => Math.hypot(m.x - spot.x, m.y - spot.y) <= radius).length;
      if (count > bestCount || (count === bestCount && distance < bestDistance)) {
        best = spot;
        bestCount = count;
        bestDistance = distance;
      }
    }
    return best;
  }

  /**
   * Usa a habilidade no ponto: o pedido vai para o servidor (que confere tudo e faz cair de verdade) e o desenho já
   * começa aqui (as flechas subindo, o círculo no chão e o som), sem esperar a resposta.
   */
  private castAt(skill: ClassSkillInfo, point: Point, now: number): void {
    const rank = this.hero.skills[skill.id] ?? 0;
    const numbers = skillPoint(skill, rank);
    if (!numbers || !this.castable(skill, now)) return;
    const feet = this.myFeet();
    const wait = this.gmNoCd ? 0 : skill.cooldownMs;
    const readyAt = now + wait;
    this.castReadyAt.set(skill.id, readyAt);
    const slot = this.classSlotOf(skill.id);
    if (slot) this.actionBar.setCooldown(slot, readyAt, wait);
    if (skill.kind === 'olhos') {
      // os Olhos de Gavião: enxerga mais longe por um tempo (o servidor manda os bichos de longe; aqui, as etiquetas
      // e os pontos no mini mapa). Não soltam a pedra puxada.
      this.conn.send({ t: 'cast', id: skill.id, x: round3(feet.x), y: round3(feet.y) });
      this.hawkUntil = now + numbers.durationMs;
      this.view?.setVision?.(numbers.visionPct); // a câmera afasta (e volta no fim: endHawk)
      this.view?.action?.(this.myId, 'hawk'); // o brilho dourado nos olhos
      this.combat.floater(this.myId, 'Olhos de Gavião!', '#ffd23f', now);
      this.sfx.play('hawk');
      return;
    }
    this.cancelCharge(); // usar a habilidade solta a pedra que estava puxando (o servidor faz o mesmo)
    const aimed = castPoint(feet, point, skill.range);
    const spot = { x: Math.max(0, Math.min(this.map.width, aimed.x)), y: Math.max(0, Math.min(this.map.height, aimed.y)) };
    this.conn.send({ t: 'cast', id: skill.id, x: round3(spot.x), y: round3(spot.y) });
    if (spot.x !== feet.x || spot.y !== feet.y) {
      const degrees = toDegrees(aimAngle(feet, spot));
      this.faceAngle(degrees);
      this.view?.action?.(this.myId, 'volley', degrees); // puxa mirando para o alto e solta (a pose é da [arte])
    }
    const kind = this.shot().kind;
    this.combat.rain(feet, spot.x, spot.y, numbers.radius, numbers.arrows, rank, skill.delayMs, kind, now);
    this.sfx.volley(skill.delayMs, numbers.arrows, kind === 'pedra');
  }

  private onShot(msg: Extract<ServerMsg, { t: 'shot' }>): void {
    if (msg.by === this.myId && msg.cid !== undefined) {
      this.combat.linkMyShot(msg.cid, msg.id, msg.range); // o seu tiro já está voando desde o clique
      return;
    }
    const fromMonster = this.entities.get(msg.by)?.kind === 'monster';
    this.combat.shot(msg.id, msg.x, msg.y, msg.a, msg.speed, msg.range, msg.kind, fromMonster, performance.now());
    if (msg.kind === 'ancestral') this.sfx.play('spirit'); // outro jogador soltou a Flecha Ancestral
    this.view?.action?.(msg.by, 'shoot', toDegrees(msg.a));
  }

  /** `blocked`: 1 = a defesa segurou (passou só um pouco), 2 = segurou e quebrou. */
  private onHit(id: number, dmg: number, hp: number, blocked: 0 | 1 | 2 = 0, by = 0): void {
    const now = performance.now();
    // game feel: o seu acerto num bicho treme a tela, segura o desenho um instante e solta faíscas (se ligados)
    if (by === this.myId && id !== this.myId) {
      this.startShake(this.feel.shakeHitPx, now);
      if (this.feel.hitStopMs > 0) this.hitStopUntil = now + this.feel.hitStopMs;
      const feet = this.feel.particles > 0 ? this.drawnFeet(id) : null;
      if (feet) this.combat.burst(feet.x, feet.y, this.feel.particles, now);
    }
    const e = this.entities.get(id);
    if (e) e.hp = hp;
    this.view?.action?.(id, blocked ? 'block' : 'hurt');
    if (blocked) this.combat.spark(id, id === this.myId ? this.guardAngle : null, blocked === 2, now);
    if (id === this.myId) {
      // apanhando, a conversa fecha (a câmera volta para você ver de onde veio)
      if (this.talk.isOpen) this.talk.close();
      if (this.shop.isOpen) this.shop.close();
      // golpe recebido solta a pedra (o servidor faz o mesmo); para puxar de novo, aperte de novo
      const hadCharge = this.charging !== null || this.pendingShot !== null;
      this.cancelCharge();
      if (hadCharge) this.combat.loseCharge(id, now);
      this.myHp = hp;
      this.hud.setHp(hp, this.myMaxHp);
      if (blocked) {
        // pancada seca na defesa (sem o vermelho na tela); se quebrou, o som da quebra vem com a energia ('energy')
        if (blocked === 1) this.sfx.play('block');
        this.combat.floater(id, `-${dmg}`, BLOCKED_COLOR, now);
        return;
      }
      if (this.feel.hurtFlash) this.feedback.hurtFlash();
      this.startShake(this.feel.shakeHurtPx, now);
      this.sfx.play('hurt');
      this.combat.floater(id, `-${dmg}`, '#ff6b6b', now);
      return;
    }
    this.combat.floater(id, `-${dmg}`, blocked ? BLOCKED_COLOR : e?.kind === 'monster' ? '#ffe08a' : '#ffffff', now);
    if (e?.kind === 'monster') this.sfx.play(blocked ? 'block' : 'hit'); // a casca do tatu-bola soa como a defesa
  }

  /** Começa um tremor de tela (o mais forte ganha, se já tiver um). */
  private startShake(px: number, now: number): void {
    if (px <= 0 || this.feel.shakeMs <= 0) return;
    const left = this.shake.px > 0 ? shakeOffset(now, this.shake.start, this.shake.ms, this.shake.px) : { x: 0, y: 0 };
    if (Math.hypot(left.x, left.y) > px) return;
    this.shake = { start: now, ms: this.feel.shakeMs, px };
  }

  private onDeath(id: number): void {
    this.combat.setGuard(id, null, 0); // quem desmaia baixa a defesa (o servidor não manda à parte)
    const now = performance.now();
    if (id === this.myId) {
      this.myHp = 0;
      this.hud.setHp(0, this.myMaxHp);
      this.sfx.play('death');
      this.setDead(true);
      return;
    }
    const e = this.entities.get(id);
    if (e?.kind === 'monster') {
      // o monstro caiu: some com uma nuvenzinha (o servidor já tirou ele da sua área de visão). A view que anima
      // ('die') ganha um instante para mostrar a queda antes de o desenho sair.
      const feet = this.drawnFeet(id);
      if (feet) this.combat.poof(feet.x, feet.y, now);
      this.entities.delete(id);
      this.facing.delete(id);
      const view = this.view;
      if (view?.action) {
        view.action(id, 'die');
        window.setTimeout(() => {
          if (this.view === view) view.removeActor(id);
        }, DIE_MS);
      } else {
        view?.removeActor(id);
      }
      this.sfx.play('kill'); // (puxando a pedra nele: ao soltar, ela vai para o mouse ou o mais perto)
      return;
    }
    if (e) {
      this.fainted.add(id); // outro jogador desmaiou (acorda quando a vida voltar)
      this.view?.action?.(id, 'faint');
    }
  }

  /** Desmaiou (ou acordou): sem andar nem atacar, com o aviso na tela. */
  private setDead(dead: boolean): void {
    if (this.dead === dead) return;
    this.dead = dead;
    if (dead) {
      this.setArmed(null);
      this.cancelCharge();
      this.stopGuard();
      this.clearRoute();
      this.goingToNpc = null;
      this.feedback.showDeath();
      this.view?.action?.(this.myId, 'faint');
      this.bag.close();
      this.shop.close();
      this.talk.close();
    } else {
      this.feedback.hideDeath();
      this.view?.action?.(this.myId, 'revive');
    }
  }

  private readonly toggleSound = () => {
    this.sfx.toggleMute();
    this.updateSoundButton();
    const key = this.keys.get('som').code ? this.keys.label('som') : null;
    this.toast.show(this.sfx.muted ? (key ? `Som desligado (${key} ou o botão do som ligam de novo)` : 'Som desligado (o botão do som liga de novo)') : 'Som ligado');
  };

  private updateSoundButton(): void {
    if (this.soundButton) this.soundButton.textContent = this.sfx.muted ? '🔇' : '🔊';
    this.soundPanel.show(this.sfx.muted, this.sfx.volumes());
  }

  /** O botão do tiro mostra a arma de agora: com o arco, "Arco" (e o ícone dele); senão, o estilingue. */
  private updateShotLook(gear: GearLook): void {
    this.gearNow = gear;
    this.actionBar.setLook('shot', gear.weapon === 'arco' ? { label: 'Arco', icon: 'arco' } : { label: 'Estilingue', icon: null });
  }

  /** O botão do som da HUD: abre (e fecha) o painel do som. */
  private readonly openSoundPanel = () => {
    this.sfx.unlock();
    this.soundPanel.show(this.sfx.muted, this.sfx.volumes());
    this.soundPanel.toggle();
  };

  /** O relógio do dia e noite: o servidor disse que estamos em `at` ms do ciclo (daqui, o navegador anda sozinho). */
  private setClock(at: number): void {
    this.timeBase = performance.now() - at;
  }

  /**
   * Dia e noite: a luz (de 1, dia, a 0, noite fechada, com o anoitecer e o amanhecer suaves) e se os bichos estão
   * "da noite" (mais fortes, de olhos vermelhos) vão para a view; o som do ambiente troca os passarinhos pelos grilos.
   * Na virada, um aviso.
   */
  private updateTimeOfDay(now: number): void {
    const position = cyclePosition(now - this.timeBase, this.rules);
    const light = Math.round(daylightAt(position, this.rules) * 100) / 100;
    const night = isNightAt(position, this.rules);
    if (light === this.lightShown && night === this.nightShown) return;
    const turned = this.nightShown !== null && night !== this.nightShown;
    this.lightShown = light;
    this.nightShown = night;
    this.view?.setTimeOfDay?.({ light, night });
    this.ambient.setNight(night);
    if (turned) this.toast.show(night ? 'Anoiteceu: os bichos ficam mais fortes (e dão mais XP e ouro)' : 'Amanheceu', 3500);
  }

  /** O mini mapa (sempre) e o mapa inteiro (se a janela estiver aberta): você, os NPCs já vistos e a neblina. */
  private drawMaps(): void {
    const picture = this.mapPicture;
    if (!picture || !this.predicted) return;
    const feet = this.myFeet();
    const me = { x: feet.x, y: feet.y, angle: this.myAngle };
    const markers: MapMarker[] = [...this.npcs].map(([id, n]) => ({ ...feetAt(n.e.x, n.e.y), mark: this.npcMarks.get(id) ?? '' }));
    // com os Olhos de Gavião, os bichos viram pontos na cor do perigo
    if (performance.now() < this.hawkUntil) {
      for (const e of this.entities.values()) {
        if (e.kind === 'monster') markers.push({ ...feetAt(e.x, e.y), monster: dangerColor(e.level, this.myLevel) });
      }
    }
    this.minimap.draw(picture, me, markers);
    this.mapWindow.draw(picture, this.map.name, me, markers);
  }

  /** O vento agora: o caminho entre o de antes e o novo (a direção gira pelo lado mais curto). */
  private windNow(now: number): { strength: number; angle: number } {
    const w = this.wind;
    const t = w.ms > 0 ? Math.min(1, Math.max(0, (now - w.start) / w.ms)) : 1;
    const k = t * t * (3 - 2 * t);
    const turn = ((((w.to.angle - w.from.angle) % 360) + 540) % 360) - 180;
    return { strength: w.from.strength + (w.to.strength - w.from.strength) * k, angle: (((w.from.angle + turn * k) % 360) + 360) % 360 };
  }

  /** O vento vai para a view (as árvores balançam) e para o som (o vento da mata), só quando muda. */
  private updateWind(now: number): void {
    const w = this.windNow(now);
    const strength = Math.round(w.strength * 100) / 100;
    const angle = Math.round(w.angle);
    if (strength === this.windShown.strength && angle === this.windShown.angle) return;
    this.windShown = { strength, angle };
    this.view?.setWind?.(strength, angle);
    this.ambient.setWind(strength);
  }

  /** O som de ambiente acompanha o lugar onde você está (de vez em quando: lugar não muda a cada quadro). */
  private updateAmbient(now: number): void {
    if (now >= this.ambientCheckAt && this.predicted) {
      this.ambientCheckAt = now + 500;
      const feet = feetAt(this.predicted.x, this.predicted.y);
      const scene = sceneOfPlace(this.map.placeAt(feet.x, feet.y));
      this.ambient.setScene(scene);
      this.sfx.music.play(trackOfScene(scene)); // a música do lugar (troca devagar)
    }
    this.ambient.update();
    this.sfx.music.update();
  }

  // ======================= servidor =======================

  private ping(): void {
    this.pingId += 1;
    this.pings.set(this.pingId, performance.now());
    this.conn.send({ t: 'ping', id: this.pingId });
  }

  private applyStats(stats: PlayerStats): void {
    this.hud.setXp(stats.xp, stats.xpNext, stats.level);
    this.myLevel = stats.level;
    this.myDamage = stats.damage;
    this.bag?.setStats(stats);
    this.skillsPanel?.update(this.classes, this.hero, stats.level); // o nível novo pode liberar um ponto
    if (this.talk) this.refreshQuests(); // nível novo pode liberar missões
  }

  /** A mochila mudou (comprou, vendeu, pegou, comeu, equipou). */
  private onInventory(inv: InventoryState, sounds = true): void {
    const equipped = JSON.stringify(inv.equipped);
    if (sounds && equipped !== this.equippedBefore) this.sfx.play('equip');
    this.equippedBefore = equipped;
    const gold = inv.gold ?? 0;
    // na loja: ouro diminuiu = comprou ("ka-tching"); aumentou = vendeu
    if (sounds && this.shop.isOpen && gold !== this.myGold) this.sfx.play(gold < this.myGold ? 'buy' : 'sell');
    this.myGold = gold;
    this.lastInv = inv;
    this.hud.setGold(gold);
    this.bag.setState(inv);
    this.shop.setInventory(inv);
    this.refreshQuick();
    this.refreshQuests(); // missão de entregar conta pela mochila
  }

  /** Os atalhos mostram o que a mochila tem agora. */
  private refreshQuick(): void {
    this.quick.set([pickQuickItem(1, this.items, this.lastInv), pickQuickItem(2, this.items, this.lastInv)], this.items);
  }

  /** Atalho de comida (1) ou remédio (2): usa o item daquele grupo com a maior cura que está na mochila. */
  private useQuick(n: 1 | 2, now: number): void {
    if (this.dead) return this.toast.show('Desmaiado não dá para comer');
    const pick = pickQuickItem(n, this.items, this.lastInv);
    if (!pick) return this.toast.show(n === 1 ? 'Sem comida na mochila (a Budega vende)' : 'Sem remédio na mochila (a Budega vende)');
    if (now < this.itemReadyAt) return this.toast.show('Espere um pouquinho para usar outro item');
    if (this.myHp >= this.myMaxHp) return this.toast.show('Sua vida já está cheia');
    this.conn.send({ t: 'item', act: 'use', i: pick.slot });
    this.noteItemUse(pick.item, now);
  }

  /** Usou um consumível (pelo atalho ou pela mochila): o véu da recarga nos atalhos. */
  private noteItemUse(item: string | null, now: number): void {
    const ms = (item ? this.items.get(item)?.cooldownMs : undefined) ?? 3000;
    this.itemReadyAt = now + ms + 40;
    this.quick.setCooldown(this.itemReadyAt, ms);
  }

  private questContext(): QuestContext {
    return {
      log: this.questLog,
      level: this.myLevel,
      inBag: (item) => this.lastInv.slots.reduce((n, stack) => n + (stack?.item === item ? stack.n : 0), 0),
    };
  }

  /** O diário, o nível ou a mochila mudaram: a lista de missões na tela, a conversa aberta e os sinais ! e ?. */
  private refreshQuests(): void {
    const ctx = this.questContext();
    this.tracker.update(ctx);
    this.talk.update(ctx);
    for (const [id, npc] of this.npcs) {
      const mark = npcMark(npc.e.type, this.questList, ctx);
      this.npcMarks.set(id, mark);
      if (this.view?.mark) this.view.mark(id, mark);
      else this.combat.setMark(id, mark);
    }
  }

  private onQuestLog(log: QuestLog): void {
    const before = this.questLog;
    this.questLog = log;
    this.npcAnswers(before, log);
    for (const quest of this.questList) {
      const was = before[quest.id];
      const now = log[quest.id];
      if (quest.goal.kind === 'kill' && was?.state === 'active' && now?.state === 'active' && now.count > was.count) {
        this.combat.floater(this.myId, `${quest.goalName} ${now.count}/${quest.goal.count}`, '#9fd3ff', performance.now());
        if (now.count === quest.goal.count) this.toast.show(`Missão pronta: ${quest.name}`, 2500);
      }
      if (was?.state === 'active' && now?.state === 'done') {
        this.toast.show(`Missão concluída: ${quest.name}!`, 3000);
        this.sfx.play('rare');
      }
    }
    this.refreshQuests();
  }

  /** Itens que vieram do monstro direto para a mochila. */
  private onLoot(stacks: ItemStack[]): void {
    let precious = false;
    stacks.forEach((stack, i) => {
      const def = this.items.get(stack.item);
      if (!def) return;
      if (def.rarity !== 'common') precious = true;
      const label = `+${stack.n > 1 ? `${stack.n} ` : ''}${def.name}`;
      window.setTimeout(() => this.combat.floater(this.myId, label, def.rarity === 'common' ? '#f4ead2' : '#f2c14e', performance.now()), 300 + i * 200);
      if (def.rarity === 'legendary') this.toast.show(`Item lendário: ${def.name}!`, 3000);
    });
    this.sfx.play(precious ? 'rare' : 'loot');
    this.bag.notifyNew();
  }

  private onItemFail(reason: string): void {
    if (reason === 'cooldown') this.toast.show('Espere um pouquinho para usar outro item');
    else if (reason === 'full_hp') this.toast.show('Sua vida já está cheia');
    else if (reason === 'bag_full') this.toast.show('A mochila está cheia');
    else if (reason === 'dead') this.toast.show('Desmaiado não dá para mexer na mochila');
    else if (reason === 'no_gold') this.toast.show('Ouro insuficiente');
    else if (reason === 'too_far') this.toast.show('Chegue mais perto');
    else if (reason === 'cant_trade') this.toast.show('Isso não dá para negociar aqui');
  }

  private onMessage(msg: ServerMsg): void {
    switch (msg.t) {
      case 'spawn':
        if (msg.e.id !== this.myId) this.addEntity(msg.e, false);
        break;
      case 'despawn':
        this.entities.delete(msg.id);
        this.facing.delete(msg.id);
        this.combat.setGuard(msg.id, null, 0);
        this.combat.removePet(msg.id);
        if (this.goingToPet === msg.id) this.goingToPet = null;
        this.view?.removeActor(msg.id);
        break;
      case 'move': {
        const e = this.entities.get(msg.id);
        if (!e || msg.id === this.myId) break;
        const angle = this.facingOf(msg.id, e.x, e.y, msg.x, msg.y, msg.dir);
        e.x = msg.x;
        e.y = msg.y;
        e.dir = msg.dir;
        const feet = feetAt(msg.x, msg.y);
        const duration = e.kind === 'monster' ? (e.stepMs ?? 320) : 120;
        if (this.combat.hasPet(msg.id)) {
          // o gatinho provisório: anda (ou pula para o sofá, mais devagar) até o ponto novo
          this.combat.movePet(msg.id, feet.x, feet.y, (angle * Math.PI) / 180, performance.now(), msg.dash ? 300 : duration);
          break;
        }
        this.view?.moveActor(msg.id, feet.x, feet.y, angle, { durationMs: msg.dash ? 140 : duration, dash: msg.dash === true });
        if (msg.dash) this.view?.action?.(msg.id, 'dash', angle);
        break;
      }
      case 'ack':
        this.onAck(msg.seq, { x: msg.x, y: msg.y, dir: msg.dir });
        break;
      case 'teleport':
      case 'pull':
        this.placeMe(msg.x, msg.y, msg.dir);
        if (msg.t === 'teleport' && this.dead) this.setDead(false); // acordou
        break;
      case 'zone':
        void this.enter(msg, true).catch((error: Error) => this.toast.show(error.message, 6000));
        break;
      case 'say':
        this.view?.say(msg.id, msg.text);
        break;
      case 'chat':
        this.chat.addChat(msg.name, msg.text, msg.id === this.myId);
        this.view?.say(msg.id, msg.text);
        break;
      case 'sys':
        this.chat.addSystem(msg.text);
        break;
      case 'notice':
        this.toast.show(msg.text, 7000);
        this.chat.addSystem(`Aviso do administrador: ${msg.text}`);
        break;
      case 'hp': {
        const e = this.entities.get(msg.id);
        if (e) {
          e.hp = msg.hp;
          e.maxHp = msg.maxHp;
        }
        if (msg.id === this.myId) {
          this.myHp = msg.hp;
          this.myMaxHp = msg.maxHp;
          this.hud.setHp(msg.hp, msg.maxHp);
        } else if (this.fainted.delete(msg.id)) {
          this.view?.action?.(msg.id, 'revive');
        }
        break;
      }
      case 'stats':
        this.applyStats(msg.stats);
        break;
      case 'warn': {
        // golpe vindo: quadrados vermelhos onde ele pega (golpe de perto) e o anel laranja em quem prepara
        const now = performance.now();
        if (msg.tiles.length > 0) this.combat.warn(msg.tiles, msg.ms, now);
        this.combat.windup(msg.id, msg.ms, now);
        this.view?.action?.(msg.id, 'windup');
        if (this.onMyTile(msg.tiles)) this.sfx.play('warn');
        break;
      }
      case 'fire':
        this.combat.warn(msg.tiles, msg.ms, performance.now(), true);
        this.sfx.play('fire');
        break;
      case 'shot':
        this.onShot(msg);
        break;
      case 'shot_end':
        // sem acertar ninguém, a flecha crava onde o servidor diz que parou: no chão ou no que segurou (o tronco)
        this.combat.endShot(
          msg.id,
          msg.hit,
          msg.x !== undefined && msg.y !== undefined ? { x: msg.x, y: msg.y, ...(msg.on ? { on: msg.on } : {}), ...(msg.burst ? { burst: msg.burst } : {}) } : undefined,
        );
        if (msg.burst) this.sfx.play('burst'); // a Flecha Ancestral explodiu no fim
        break;
      case 'fx': {
        if (this.entities.get(msg.id)?.kind === 'pet') {
          this.onPetFx(msg.id, msg.kind, msg.a);
          break;
        }
        if (msg.kind === 'jump') {
          this.view?.action?.(msg.id, 'jump'); // o pulo de outro jogador: só o desenho
          break;
        }
        if (msg.kind === 'hawk') {
          // outro jogador usou os Olhos de Gavião (só ele enxerga mais longe; os outros veem o brilho nos olhos dele)
          this.view?.action?.(msg.id, 'hawk');
          break;
        }
        if (msg.kind === 'mark') {
          // a Flecha Ancestral marcou o bicho: a runa em cima dele enquanto durar
          this.combat.mark(msg.id, msg.ms ?? 0, performance.now());
          break;
        }
        if (msg.kind === 'dizzy' || msg.kind === 'dodge' || msg.kind === 'vanish') {
          // tonto (o tatu-bola depois da investida), o tiro que passou pelo enxame e o bicho que foi embora
          this.view?.action?.(msg.id, msg.kind);
          if (msg.kind !== 'vanish') this.combat.floater(msg.id, msg.kind === 'dizzy' ? 'tonto!' : 'passou!', msg.kind === 'dizzy' ? '#ffe08a' : '#d6d6d6', performance.now());
          break;
        }
        const feet = this.drawnFeet(msg.id);
        const wide = msg.a === undefined || msg.kind === 'spin' || msg.kind === 'whirlwind';
        if (feet && msg.kind !== 'song') this.combat.flash(feet.x, feet.y, msg.a ?? 0, msg.r ?? 1.4, wide, performance.now());
        this.view?.action?.(msg.id, msg.kind, msg.a !== undefined ? toDegrees(msg.a) : undefined);
        if (msg.kind === 'charge') this.sfx.play('charge');
        break;
      }
      case 'hit':
        this.onHit(msg.id, msg.dmg, msg.hp, msg.blk ?? 0, msg.by);
        break;
      case 'energy': {
        const was = this.guardState;
        this.energy = msg.v;
        this.guardState = msg.g;
        if (msg.g === 'broken' && was !== 'broken') {
          // a energia acabou: a defesa cai (solte e espere a energia voltar para levantar de novo)
          this.combat.note(this.myId, 'defesa quebrou!', '#f3a25b', performance.now());
          this.view?.action?.(this.myId, 'guard-break');
          this.sfx.play('guard-break'); // quebrou num golpe ou segurando até acabar a energia: o mesmo som
        }
        break;
      }
      case 'gm':
        this.gmFly = msg.admin && msg.fly;
        this.gmNoCd = msg.admin && msg.nocd;
        this.gmPowers = { god: msg.admin && msg.god, nocd: msg.admin && msg.nocd, fly: msg.admin && msg.fly };
        if (!msg.admin) this.gmTeleport = false;
        this.gmPanel.set(msg);
        break;
      case 'guard':
        this.combat.setGuard(msg.id, msg.on ? msg.a : null, performance.now());
        this.view?.action?.(msg.id, msg.on ? 'guard' : 'guard-end', toDegrees(msg.a));
        break;
      case 'heal': {
        const e = this.entities.get(msg.id);
        if (e) e.hp = msg.hp;
        this.combat.floater(msg.id, `+${msg.amount}`, '#7bd389', performance.now());
        if (msg.id === this.myId) {
          this.myHp = msg.hp;
          this.hud.setHp(msg.hp, this.myMaxHp);
          this.sfx.play('heal');
        }
        break;
      }
      case 'death':
        this.onDeath(msg.id);
        break;
      case 'levelup':
        if (msg.id === this.myId) {
          this.myMaxHp = msg.maxHp;
          this.toast.show(`Você subiu para o nível ${msg.level}!`, 2500);
          this.combat.floater(msg.id, `Nível ${msg.level}!`, '#f2c14e', performance.now());
          this.sfx.play('levelup');
        } else {
          this.view?.say(msg.id, `Nível ${msg.level}!`);
        }
        break;
      case 'cd': {
        const now = performance.now();
        if (msg.n === DASH_SLOT) {
          this.dashReadyAt = now + msg.ms;
          this.actionBar.setCooldown('dash', this.dashReadyAt, msg.ms);
        } else if (msg.n === FOLEGO) {
          this.skillReadyAt[msg.n] = now + msg.ms;
          this.actionBar.setCooldown('skill1', this.skillReadyAt[msg.n]!, msg.ms);
        }
        break;
      }
      case 'scd': {
        // a recarga da habilidade da classe (a conta do servidor vale)
        const now = performance.now();
        this.castReadyAt.set(msg.s, now + msg.ms);
        const slot = this.classSlotOf(msg.s);
        if (slot) this.actionBar.setCooldown(slot, now + msg.ms, msg.ms);
        break;
      }
      case 'armed':
        this.setArmed(msg.s); // o servidor é quem sabe (recusou por recarga, desmaiou, tirou os pontos)
        break;
      case 'npc_walk': {
        // o passeio do NPC: anda até lá no tempo que o servidor disse, olhando para onde vai
        const npc = this.npcs.get(msg.id);
        const old = this.entities.get(msg.id);
        if (!npc || !old) break;
        this.npcStrolls.add(msg.id);
        const from = feetAt(old.x, old.y);
        const to = feetAt(msg.x, msg.y);
        const moved = { ...old, x: msg.x, y: msg.y };
        this.entities.set(msg.id, moved);
        this.npcs.set(msg.id, { ...npc, e: moved });
        this.view?.moveActor(msg.id, to.x, to.y, toDegrees(aimAngle(from, to)), { durationMs: msg.ms });
        // chegou: vira de frente (para a loja e para a câmera), se não saiu de novo nem está em conversa
        window.setTimeout(() => {
          const now = this.entities.get(msg.id);
          if (now && now.x === msg.x && now.y === msg.y && this.conversationNpc !== msg.id) this.view?.moveActor(msg.id, to.x, to.y, NPC_FRONT_DEGREES, { durationMs: 0 });
        }, msg.ms + 150);
        break;
      }
      case 'hero':
        this.setHero(msg.hero);
        break;
      case 'cast': {
        // outro jogador usou a Chuva: sobe dele e cai no círculo (você vê e ouve)
        const now = performance.now();
        const from = this.drawnFeet(msg.id) ?? { x: msg.x, y: msg.y };
        this.combat.rain(from, msg.x, msg.y, msg.r, msg.n, msg.p, msg.ms, msg.kind, now);
        if (msg.x !== from.x || msg.y !== from.y) this.view?.action?.(msg.id, 'volley', toDegrees(aimAngle(from, msg)));
        this.sfx.volley(msg.ms, msg.n, msg.kind === 'pedra');
        break;
      }
      case 'fail':
        if (msg.item) {
          this.onItemFail(msg.reason);
          break;
        }
        if (msg.reason === 'cooldown') this.toast.show('Ainda recarregando...');
        else if (msg.reason === 'dead') this.toast.show('Você está desmaiado');
        else if (msg.reason === 'full_hp') {
          this.toast.show('Sua vida já está cheia');
          this.skillReadyAt[FOLEGO] = 0;
          this.actionBar.setCooldown('skill1', 0, 0);
        }
        break;
      case 'drop': {
        // ouro ou item no chão (só você vê os seus): o item com o desenho dele e o brilho da raridade
        const def = msg.item ? this.items.get(msg.item.item) : undefined;
        const item = def && msg.item ? { icon: def.icon, rarity: def.rarity, n: msg.item.n } : undefined;
        this.combat.addDrop(msg.id, msg.x, msg.y, msg.gold !== undefined, performance.now() + msg.ms, item);
        break;
      }
      case 'pickup':
        this.combat.removeDrop(msg.id);
        if (msg.gold) {
          this.sfx.play('coin');
          this.combat.floater(this.myId, `+${msg.gold} de ouro`, '#f2c14e', performance.now());
        }
        if (msg.item) this.onLoot([msg.item]); // "+Banana" em cima de você, o som e a mochila avisando
        break;
      case 'drop_gone':
        this.combat.removeDrop(msg.id);
        break;
      case 'loot':
        this.onLoot(msg.items); // o servidor também manda o texto ("Você pegou: ...") no chat
        break;
      case 'charm':
        if (msg.ms > 0) this.toast.show('Você foi encantado pelo canto! A esquiva solta.', 2500);
        break;
      case 'inv':
        this.onInventory(msg.inv);
        break;
      case 'gear': {
        // alguém (ou você) trocou o equipamento: a view muda o desenho (o arco na mão)
        const e = this.entities.get(msg.id);
        if (e) e.gear = msg.gear;
        this.view?.gear?.(msg.id, msg.gear);
        if (msg.id === this.myId) this.updateShotLook(msg.gear);
        break;
      }
      case 'items':
        // o administrador ajustou os itens (preço, cura, bônus): a mochila e a loja mostram os números novos
        for (const item of msg.items) this.items.set(item.id, item);
        this.bag.setState(this.lastInv);
        this.shop.setInventory(this.lastInv);
        this.refreshQuick();
        break;
      case 'quests':
        this.onQuestLog(msg.log);
        break;
      case 'combat':
        Object.assign(this.rules, msg.rules); // o desenho do combate usa o mesmo objeto (e o dia e noite, os tamanhos)
        break;
      case 'time':
        this.setClock(msg.at); // virou dia ou noite, ou o administrador mexeu no relógio
        break;
      case 'explored':
        this.mapPicture?.reveal(msg.cells); // você andou e viu mais um pedaço do mapa
        break;
      case 'wind': {
        // o vento muda devagar: daqui (onde está agora) até o novo, em msg.ms
        const now = performance.now();
        this.wind = { from: this.windNow(now), to: { strength: msg.strength, angle: msg.angle }, start: now, ms: msg.ms };
        break;
      }
      case 'questDefs':
        // o painel mudou as missões: troca dentro da mesma lista (a conversa e a lista na tela usam ela)
        this.questList.splice(0, this.questList.length, ...msg.quests);
        this.refreshQuests();
        break;
      case 'npcs':
        this.onNpcList(msg.npcs);
        break;
      case 'online':
        this.hud.setOnline(msg.n);
        break;
      case 'pong': {
        const sentAt = this.pings.get(msg.id);
        this.pings.delete(msg.id);
        if (sentAt !== undefined) this.hud.setPing(performance.now() - sentAt);
        break;
      }
      default:
        // combate, loja, missões...: chegam nas próximas etapas do mundo novo
        break;
    }
  }
}

/**
 * Medidor de desempenho (`?fps` no endereço), no alto da tela: quadros por segundo, quanto o processador gasta em
 * cada quadro (o motor e o desenho; para 60 quadros por segundo precisa ficar abaixo de ~16 ms, para 30, de ~33 ms)
 * e o quadro mais lento do último segundo (os "engasgos").
 */
class FpsMeter {
  private readonly el = document.createElement('div');
  private frames = 0;
  private work = 0;
  private worst = 0;
  private since = 0;
  private last = 0;

  constructor() {
    this.el.id = 'fps-meter';
    this.el.style.cssText =
      'position:fixed;top:calc(6px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:50;padding:3px 8px;' +
      'border-radius:6px;background:rgba(0,0,0,0.6);color:#fff;font:600 12px system-ui,sans-serif;pointer-events:none;white-space:nowrap';
    this.el.textContent = 'medindo...';
    document.body.append(this.el);
  }

  tick(now: number, workMs: number): void {
    if (this.last > 0) this.worst = Math.max(this.worst, now - this.last);
    this.last = now;
    this.frames += 1;
    this.work += workMs;
    if (this.since === 0) this.since = now;
    if (now - this.since < 1000) return;
    const fps = Math.round((this.frames * 1000) / (now - this.since));
    this.el.textContent = `${fps} FPS · cada quadro ${(this.work / this.frames).toFixed(1)} ms · mais lento ${Math.round(this.worst)} ms`;
    this.frames = 0;
    this.work = 0;
    this.worst = 0;
    this.since = now;
  }

  destroy(): void {
    this.el.remove();
  }
}
