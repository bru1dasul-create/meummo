// O motor do jogo 2.5D (o mundo novo): conversa com o servidor, lê teclado/joystick/toque, prevê o próprio andar
// (com as mesmas regras do servidor, em src/shared/movement.ts) e manda o desenho (view.ts) mostrar tudo.
// O desenho de verdade é da [arte] (PD.View); sem ele, a ProvisionalView mostra o básico. O combate (aviso no
// chão, pedras, dano, barras de vida) é desenhado por cima, em combat.ts.
// É o que abre em http://localhost:3000 (o jogo antigo, visto de cima, fica em ?antigo).

import {
  DASH_COOLDOWN_MS,
  DASH_TILES,
  GM_FLY_FACTOR,
  GUARD_MAX_ENERGY,
  MAX_PENDING_WALKS,
  TRADE_RANGE,
  TRADE_SLACK,
  WALK_SLICE_MS,
} from '../../shared/constants';
import { DX, DY, type Dir } from '../../shared/dir';
import { pickQuickItem, type InventoryState, type ItemInfo, type ItemStack } from '../../shared/items';
import { GameMap, type Tile, type TiledMap } from '../../shared/map';
import { degreesOfDir, degreesToward, cornerAtFeet, feetAt, flySlice, footCenter, sweepBody, sliceDistance, walkSlice, type Pose } from '../../shared/movement';
import { findRoute, followRoute } from '../../shared/route';
import { DASH_SLOT, type EntityState, type GuardState, type NpcInfo, type PlayerStats, type ServerMsg, type WelcomeMsg, type ZoneMsg } from '../../shared/protocol';
import { questBlocker, questFinisher, type QuestInfo, type QuestLog } from '../../shared/quests';
import { SKILLS } from '../../shared/skills';
import { Bag } from '../bag';
import { KeyboardDirections } from '../game/input';
import type { Connection } from '../net';
import type { Sfx } from '../sfx';
import { ShopWindow } from '../shop';
import { npcMark, QuestTracker, TalkWindow, type QuestContext } from '../talk';
import { ActionBar, Feedback, Toast, ZoneBanner, type ActionSlot, type ChatBox, type Hud } from '../ui';
import './arte'; // o desenho de verdade (PD.View), da [arte], quando estiver pronto
import { angleDiff, chargedRange, chargeFraction, shotProfile, type ShotProfile } from '../../shared/combat';
import { defaultCombatRules, type CombatRules } from '../../shared/combatRules';
import { aimAngle, BODY_HEIGHT, CombatLayer, distanceToSegment, shotOriginOfFeet } from './combat';
import { GmPanel } from './gm';
import { GuardButton } from './guard';
import { Joystick } from './joystick';
import { QuickSlots } from './quick';
import { ProvisionalView, type WorldView } from './view';
import { Ambient, sceneOfPlace } from '../ambient';
import { SoundPanel } from './soundPanel';

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
/** Alcance da mira automática da Bordunada (golpe de perto). */
const MELEE_AIM_RANGE = 2.5;
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
  private readonly actionBar: ActionBar;
  private readonly soundButton = document.getElementById('hud-sound') as HTMLButtonElement | null;
  /** O painel do som (o botão do som abre): ligar/desligar e o volume da música, dos efeitos e do ambiente. */
  private readonly soundPanel: SoundPanel;
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
  /** Andando devagar agora (Shift segurado, ou o joystick empurrado só um pouco); o normal é correr. */
  private slow = false;
  private shiftDown = false;
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
  private readonly skillReadyAt = SKILLS.map(() => 0);
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
  private readonly guardButton: GuardButton;
  /** Menu ADM (só administrador): voando atravessa tudo; "teleporte ao clicar" troca o andar até pelo ir até lá. */
  private readonly gmPanel: GmPanel;
  private gmFly = false;
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
  /** O último toque foi com o dedo (a Bordunada mira sozinha). */
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
    this.actionBar = new ActionBar(
      [
        { slot: 'shot', label: 'Estilingue', key: 'J' }, // segurar puxa, soltar atira (pedra com carga)
        ...SKILLS.map((skill, i) => ({ slot: `skill${i}` as ActionSlot, label: skill.name, key: skill.key })),
        { slot: 'dash', label: 'Esquiva', key: 'Espaço' },
      ],
      (slot, down) => this.onAction(slot, down),
    );
    this.soundPanel = new SoundPanel({
      toggleMute: () => this.toggleSound(),
      setVolume: (part, value) => this.sfx.setVolume(part, value),
    });
    this.ambient = new Ambient(this.sfx);
    this.soundButton?.addEventListener('click', this.openSoundPanel);
    this.updateSoundButton();
    const welcome = deps.welcome;
    for (const item of welcome.items) this.items.set(item.id, item);
    this.lastInv = welcome.inv;
    this.myGold = welcome.inv.gold ?? 0;
    this.myLevel = welcome.stats.level;
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
    this.quick = new QuickSlots((n) => this.useQuick(n, performance.now()));
    this.guardButton = new GuardButton(
      () => this.startGuard(performance.now()),
      () => this.stopGuard(),
    );
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
      heal: () => this.conn.send({ t: 'gm', cmd: { do: 'heal' } }),
      teleportMode: (on) => {
        this.gmTeleport = on;
      },
      npc: (id) => this.conn.send({ t: 'gm', cmd: { do: 'npc', npc: id } }),
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
      sound: () => ({ scene: game.ambient.current, volumes: game.sfx.volumes(), muted: game.sfx.muted, running: game.sfx.audio !== null }),
      dead: () => game.dead,
      screenOf: (x: number, y: number) => game.view?.toScreen(x, y),
    };
  }

  /** Entra num mapa (no começo ou trocando de mapa). */
  async enter(msg: WelcomeMsg | ZoneMsg, arrived: boolean): Promise<void> {
    this.conn.hold(); // as mensagens esperam o mapa carregar
    const json = await loadMap(msg.map);
    if (this.destroyed) return;
    this.map = GameMap.fromTiled(json, msg.map);
    this.view?.destroy();
    this.view = createView(this.container, json);
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
    this.ambient.destroy();
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
    this.updateGuard(now);
    this.updateAmbient(now);
    this.updateConversation(now);
    this.checkNpcArrival();
    this.cuddleIfNear();
    this.checkNpcDistance();
    this.checkSafeArea();
    this.view.frame(now);
    this.combat.setViewer(this.predicted ? feetAt(this.predicted.x, this.predicted.y) : null);
    this.combat.frame(now, this.view, (id) => this.drawnFeet(id), this.hurtBars());
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
      // a view ainda não desenha este bicho: o gatinho provisório fica por cima (só aparece com você na casa dele)
      const home = e.home ? (this.map.regions.get(e.home) ?? null) : null;
      this.combat.setPet(e.id, e.name, feet.x, feet.y, (degreesOfDir(e.dir) * Math.PI) / 180, e.asleep === true, home);
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
   * Quanto anda um pedaço: correndo (o normal), devagar (Shift / joystick empurrado de leve) ou, segurando a defesa,
   * devagar × guardWalkFactor (o mesmo número do servidor).
   */
  private sliceOf(slow: boolean, guard = this.guardHeld, fly = this.gmFly): number {
    if (fly) return sliceDistance(this.map.metric, false, this.stepMs) * GM_FLY_FACTOR;
    if (guard) return sliceDistance(this.map.metric, true, this.stepMs) * this.rules.guardWalkFactor;
    return sliceDistance(this.map.metric, slow, this.stepMs);
  }

  private readonly onKey = (event: KeyboardEvent) => {
    if (event.key === 'Shift') this.shiftDown = event.type === 'keydown';
    // J: segurar puxa o estilingue, soltar atira no monstro mais perto (como no protótipo)
    if (event.code === 'KeyJ' && event.type === 'keyup') {
      if (this.charging?.aim.by === 'key') this.releaseCharge(performance.now());
      return;
    }
    // F: segurar levanta a defesa, soltar baixa (como no protótipo)
    if (event.code === 'KeyF' && event.type === 'keyup') {
      this.stopGuard();
      return;
    }
    if (event.type !== 'keydown' || this.chat.isTyping()) return;
    const now = performance.now();
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        if (!event.repeat) this.tryDash(now);
        break;
      case 'KeyQ':
      case 'Digit1':
        if (!event.repeat) this.trySkill(0, this.usingTouch ? this.autoAim(MELEE_AIM_RANGE) : (this.mouseAim() ?? this.autoAim(MELEE_AIM_RANGE)), now);
        break;
      case 'KeyE':
      case 'Digit2':
        if (!event.repeat) this.trySkill(1, 0, now);
        break;
      case 'Digit3':
      case 'Digit4':
        if (!event.repeat) this.useQuick(event.code === 'Digit3' ? 1 : 2, now);
        break;
      case 'KeyJ':
        if (!event.repeat) this.startCharge({ by: 'key' }, now);
        break;
      case 'KeyF':
        if (!event.repeat) this.startGuard(now);
        break;
      case 'KeyG':
        if (!event.repeat) this.gmPanel.toggle(); // só abre para administrador
        break;
      case 'KeyM':
        if (!event.repeat) this.toggleSound();
        break;
      case 'KeyI':
        if (!event.repeat) this.bag.toggle();
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
        if (this.talk.isOpen) this.talk.close();
        else if (this.shop.isOpen) this.shop.close();
        else if (this.bag.isOpen) this.bag.close();
        break;
    }
  };
  private readonly onBlur = () => {
    this.shiftDown = false;
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
      this.slow = this.shiftDown;
      return this.screenDegrees(DX[held.dir], DY[held.dir]);
    }
    const stick = this.joystick.direction();
    if (stick) {
      this.clearRoute();
      this.slow = stick.light;
      return this.screenDegrees(stick.dx, stick.dy);
    }
    this.slow = this.shiftDown; // "andar até" com Shift segurado vai devagar
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
    const slow = this.slow;
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
    // defendendo, o corpo fica virado para onde a defesa aponta
    this.myAngle = this.guardHeld ? toDegrees(this.guardAngle) : degrees;
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
      if (near) this.sfx.play('purr');
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
    this.faceStill(angle, now);
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
    // durante a recarga, sai assim que der, com a carga contada até lá (o servidor conta igual, até o tiro chegar)
    if (now < this.nextShotAt) this.pendingShot = { at: this.nextShotAt, aim: charging.aim, since: charging.since };
    else if (!this.fireAim(charging.aim, chargeFraction(now - charging.since, this.shot()), now)) this.view?.action?.(this.myId, 'sling-cancel');
  }

  /** Solta a pedra sem atirar (esquiva, golpe recebido, desmaio, troca de mapa, janela sem foco). */
  private cancelCharge(): void {
    const pulling = this.charging !== null || this.pendingShot !== null;
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
    return this.tryShoot(this.aimFor(aim, charge), now, charge);
  }

  /** Para onde a mira manda agora (a mesma conta na puxada e no tiro). */
  private aimFor(aim: Aim, charge: number): number {
    let angle: number | null = null;
    if (aim.by === 'target') {
      const target = this.entities.get(aim.id);
      angle = target ? aimAngle(this.myFeet(), feetAt(target.x, target.y)) : this.mouseAim(); // caiu: vai para o mouse
    } else if (aim.by === 'mouse') {
      angle = this.mouseAim();
    }
    // a mira automática procura até onde esta pedra chega (com carga cheia, mais longe)
    return angle ?? this.autoAim(chargedRange(charge, this.map.metric, this.shot()) + AUTO_AIM_SLACK);
  }

  /** Pedra fraca na hora (toque rápido no monstro, no celular). */
  private quickShot(angle: number, now: number): void {
    if (this.dead || this.charging || this.guardHeld || now < this.nextShotAt) return;
    this.conn.send({ t: 'charge' }); // zera a carga no servidor: o toque rápido é uma pedra sem carga
    this.tryShoot(angle, now, 0);
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
      if (npc) {
        const feet = feetAt(npc.e.x, npc.e.y);
        this.view?.focus?.({ x: feet.x, y: feet.y });
        this.animateZoom(Math.max(this.zoom, CONVERSATION_ZOOM), now);
        this.speak(npc.e.id, this.openingLine(npc));
      } else {
        this.view?.focus?.(null);
        this.animateZoom(this.zoom, now);
      }
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
  private tryShoot(angle: number, now: number, charge: number): boolean {
    if (this.dead || this.guardHeld || now < this.nextShotAt) return false;
    if (this.refuseInSafeArea(now)) return false;
    const shot = this.shot();
    // um pouco mais que a recarga do servidor, para a variação da rede não fazer um tiro ser recusado
    this.nextShotAt = now + shot.cooldownMs + 40;
    const cid = ++this.shotCid;
    this.conn.send({ t: 'shoot', cid, a: round3(angle) });
    const feet = this.myFeet();
    const origin = shotOriginOfFeet(feet.x, feet.y);
    this.combat.myShot(cid, origin.x, origin.y, angle, shot.speed, chargedRange(charge, this.map.metric, shot), now, shot.kind);
    this.sfx.play(shot.kind === 'flecha' ? 'bow-release' : 'shot');
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
    else if (slot === 'skill0') this.trySkill(0, this.autoAim(MELEE_AIM_RANGE), now);
    else if (slot === 'skill1') this.trySkill(1, 0, now);
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
    this.actionBar.setCooldown('dash', this.dashReadyAt, DASH_COOLDOWN_MS);
    this.clearRoute();
  }

  /** Habilidade `n` (Bordunada: golpe na frente, mirando em `angle`; Fôlego: cura). */
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
    this.skillReadyAt[n] = now + skill.cooldownMs;
    this.actionBar.setCooldown(`skill${n}` as ActionSlot, this.skillReadyAt[n]!, skill.cooldownMs);
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

  private onShot(msg: Extract<ServerMsg, { t: 'shot' }>): void {
    if (msg.by === this.myId && msg.cid !== undefined) {
      this.combat.linkMyShot(msg.cid, msg.id, msg.range); // o seu tiro já está voando desde o clique
      return;
    }
    const fromMonster = this.entities.get(msg.by)?.kind === 'monster';
    this.combat.shot(msg.id, msg.x, msg.y, msg.a, msg.speed, msg.range, msg.kind, fromMonster, performance.now());
    this.view?.action?.(msg.by, 'shoot', toDegrees(msg.a));
  }

  /** `blocked`: 1 = a defesa segurou (passou só um pouco), 2 = segurou e quebrou. */
  private onHit(id: number, dmg: number, hp: number, blocked: 0 | 1 | 2 = 0): void {
    const now = performance.now();
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
      this.feedback.hurtFlash();
      this.sfx.play('hurt');
      this.combat.floater(id, `-${dmg}`, '#ff6b6b', now);
      return;
    }
    this.combat.floater(id, `-${dmg}`, blocked ? BLOCKED_COLOR : e?.kind === 'monster' ? '#ffe08a' : '#ffffff', now);
    if (e?.kind === 'monster') this.sfx.play('hit');
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
    this.toast.show(this.sfx.muted ? 'Som desligado (M para ligar)' : 'Som ligado');
  };

  private updateSoundButton(): void {
    if (this.soundButton) this.soundButton.textContent = this.sfx.muted ? '🔇' : '🔊';
    this.soundPanel.show(this.sfx.muted, this.sfx.volumes());
  }

  /** O botão do som da HUD: abre (e fecha) o painel do som. */
  private readonly openSoundPanel = () => {
    this.sfx.unlock();
    this.soundPanel.show(this.sfx.muted, this.sfx.volumes());
    this.soundPanel.toggle();
  };

  /** O som de ambiente acompanha o lugar onde você está (de vez em quando: lugar não muda a cada quadro). */
  private updateAmbient(now: number): void {
    if (now >= this.ambientCheckAt && this.predicted) {
      this.ambientCheckAt = now + 500;
      const feet = feetAt(this.predicted.x, this.predicted.y);
      this.ambient.setScene(sceneOfPlace(this.map.placeAt(feet.x, feet.y)));
    }
    this.ambient.update();
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
    this.bag?.setStats(stats);
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
        this.combat.endShot(msg.id);
        break;
      case 'fx': {
        if (this.entities.get(msg.id)?.kind === 'pet') {
          this.onPetFx(msg.id, msg.kind, msg.a);
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
        this.onHit(msg.id, msg.dmg, msg.hp, msg.blk ?? 0);
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
        } else if (msg.n >= 0 && msg.n < SKILLS.length) {
          this.skillReadyAt[msg.n] = now + msg.ms;
          this.actionBar.setCooldown(`skill${msg.n}` as ActionSlot, this.skillReadyAt[msg.n]!, msg.ms);
        }
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
          SKILLS.forEach((skill, i) => {
            if (skill.kind !== 'heal') return;
            this.skillReadyAt[i] = 0;
            this.actionBar.setCooldown(`skill${i}` as ActionSlot, 0, 0);
          });
        }
        break;
      case 'drop':
        this.combat.addDrop(msg.id, msg.x, msg.y, msg.gold !== undefined, performance.now() + msg.ms);
        break;
      case 'pickup':
        this.combat.removeDrop(msg.id);
        this.sfx.play('coin');
        if (msg.gold) this.combat.floater(this.myId, `+${msg.gold} de ouro`, '#f2c14e', performance.now());
        if (msg.item) this.bag.notifyNew();
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
        Object.assign(this.rules, msg.rules); // o desenho do combate usa o mesmo objeto
        break;
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
