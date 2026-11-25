// O desenho do jogo 2.5D. O motor (engine.ts) só fala com esta interface; quem desenha de verdade é a [arte]
// (o "PD.View" do protótipo). Enquanto ele não fica pronto, a ProvisionalView desenha o básico: o chão do mapa, as
// caixas de colisão e os personagens como bonecos simples, numa câmera isométrica.
//
// Tudo em METROS, no chão: x para o leste, y para o sul (como o servidor). As posições são do PÉ do personagem.

import type { ChargeLevel } from '../../shared/classes';
import type { GearLook } from '../../shared/items';
import type { TiledMap, TiledObject } from '../../shared/map';

export interface ActorInfo {
  kind: 'player' | 'npc' | 'monster' | 'pet';
  /** 'player' ou o id do monstro/NPC (ex.: 'curupira_capao'). */
  type: string;
  name: string;
  look: number;
  x: number;
  y: number;
  /** Para onde olha, em graus no chão (0 = leste/+x, 90 = sul/+y), como o pedido `walk`: o personagem gira contínuo. */
  angle: number;
  /** É o seu personagem (a câmera segue, desenho destacado). */
  me?: boolean;
  /** Bicho (kind 'pet'): já está dormindo quando aparece. */
  asleep?: boolean;
  /** Monstro: já aparece pendurado neste galho (o Sagui no galho; veja `WorldView.perch`). */
  galho?: PerchLook;
  /**
   * Monstro: a versão especial (os saguis raros, 24/11). Por enquanto o motor põe "(Elite)" ou "(Raro)" no `name`; se a
   * view desenhar um selo, avise a [estrutura] para o nome vir sem o complemento.
   */
  rank?: 'elite' | 'raro';
  /**
   * NPC: desmaiada (a Cuca vencida de noite, caída na toca até amanhecer): já aparece caída e fica à vista (sem sumir
   * como o monstro que cai). O motor chama logo depois `action(id, 'faint')` e, de tempos em tempos, `sleep(id, true)`
   * (o "Zzz"). Quando a chefe acabou de cair ali, a bruxa só aparece depois que o desenho da chefe sai (DIE_MS). De manhã,
   * o motor põe o desenho de novo (em pé, sem `fainted`) e chama `action(id, 'revive')`: levanta do chão.
   */
  fainted?: boolean;
}

/** O galho de quem está pendurado: a altura (metros, como no mapa) e para onde ele aponta, do tronco para a ponta (graus). */
export interface PerchLook {
  altura: number;
  direcao: number;
}

export interface WorldView {
  addActor(id: number, info: ActorInfo): void;
  /** Nova posição do pé (metros) e para onde olha (graus). A view anima até lá em `durationMs` (ou pula, se for longe). */
  moveActor(id: number, x: number, y: number, angle: number, options?: { durationMs?: number; dash?: boolean }): void;
  removeActor(id: number): void;
  /** Fala curta em cima do personagem. */
  say(id: number, text: string): void;
  /** A câmera segue este personagem. */
  follow(id: number): void;
  /** Desenha um quadro. */
  frame(now: number): void;
  /** Ponto da tela (pixels) → ponto no chão (metros). */
  toWorld(screenX: number, screenY: number): { x: number; y: number };
  /** Ponto do mundo (metros; `z` = altura acima do chão, em metros) → tela (pixels). */
  toScreen(x: number, y: number, z?: number): { x: number; y: number };
  /** Uma direção na tela (ex.: "para cima") vira qual direção no chão? (Teclado e joystick andam pela tela.) */
  groundDirOfScreen(dx: number, dy: number): { x: number; y: number };
  destroy(): void;

  // ---- opcionais (combate): a view que não tiver, o motor segue sem ----
  /**
   * Animação curta de alguém: 'windup' (preparando um golpe), 'shoot' (estilingue, ou o monstro jogando algo),
   * 'arc' (Bordunada), 'dash' (esquiva, sua ou de outro jogador), 'jump' (pulo, seu ou de outro jogador: só o
   * desenho, sem mudar de lugar), 'hurt' (levou golpe), 'die' (monstro caiu: o motor
   * tira o desenho 0,7 s depois),
   * 'faint' (desmaiou: fica caído até 'revive'), 'revive' (acordou), 'sling-pull' (começou a puxar o estilingue:
   * termina com 'shoot' ou, sem atirar, com 'sling-cancel') e os golpes dos monstros ('bite', 'strike', 'charge' =
   * investida, 'spin', 'whirlwind', 'song'). `angle`: para onde, em graus no chão.
   * A Cuca (uma luta por noite, 25/11): 'transform' = vira numa fumaça (ao anoitecer, a bruxa vira a chefe: o desenho
   * dela sai logo depois e a chefe aparece no mesmo lugar; ao amanhecer, a bruxa acabou de aparecer onde a chefe estava),
   * 'revive' num NPC que acabou de aparecer = levanta do chão (ela estava caída) e 'wake' num NPC = acorda confusa
   * (esfrega os olhos, olha em volta). O motor solta a nuvenzinha no pé dela na 'transform'.
   */
  action?(id: number, kind: string, angle?: number): void;
  /** Onde o pé de alguém está DESENHADO agora (metros): barras de vida e números de dano seguem o desenho. */
  actorPosition?(id: number): { x: number; y: number } | null;
  /**
   * O alto do desenho de alguém (metros acima do pé), para a barra de vida ir acima dele (a Cuca chefe, 1,35× maior,
   * tem uns 2,1 m). null = não sei (gente): o motor usa a altura de sempre (veja `barHeight` no combat.ts).
   */
  actorTop?(id: number): number | null;
  /** Zoom do jogador (1 = o "médio"; menos = mais longe). A view limita e devolve o que ficou valendo. */
  setZoom?(factor: number): number;
  /** Sinal de missão em cima de um NPC: '!' tem missão nova, '?' tem missão para concluir, '' nada. */
  mark?(id: number, mark: '!' | '?' | ''): void;
  /**
   * O equipamento de um jogador (você ou outro): ao aparecer e quando ele troca. A view usa o `weapon` (ex.: 'arco':
   * o arco fica sempre na mão).
   */
  gear?(id: number, gear: GearLook): void;
  /**
   * O que está no arco do seu personagem (null: nada): 'ancestral' (a Flecha Ancestral, o mesmo tipo do tiro que voa
   * depois) ou 'chuva' (a Chuva de Flechas), com `rank` = os pontos da habilidade (1 a 5) e, puxando, `level` = o nível
   * da carga (1 fraco, 2 médio, 3 forte; vem de novo a cada degrau). Para a view desenhar o brilho na flecha da mão
   * (pedidos do dono, 19/11: "o efeito pegando na flecha do arco"; "um brilho em cada degrau"; "nível 1 é feio e fraco,
   * nível 2 melhora...").
   */
  armed?(id: number, kind: string | null, rank?: number, level?: ChargeLevel): void;
  /**
   * O efeito subindo do chão em volta do personagem `id` (você ou outro jogador; pedido do dono, 23/11: "cada nível que o
   * personagem upar quero um efeito no personagem vindo do chão, mesma coisa quando upar uma habilidade"): `what` =
   * 'level' (subiu de nível) ou 'skill' (pôs um ponto numa habilidade; `skill` = o tipo dela: 'chuva', 'flecha' ou
   * 'olhos', para a cor). Sem este método, o motor desenha um efeito provisório (combat.ts, rise).
   */
  levelUp?(id: number, what: 'level' | 'skill', skill?: string): void;
  /**
   * Alguém usou um consumível da mochila (`item`: a chave em data/items.json, ex.: 'garrafada_pequena', 'garrafada',
   * 'garrafada_grande', 'banana'): o efeito de beber ou comer em volta do personagem (pedido do dono, 23/11: "o efeito
   * de quando usar a poção na mesma pegada do Priston Tale"). Opcional: sem ele, só o número verde da cura.
   */
  consume?(id: number, item: string): void;
  /**
   * O bicho subiu no galho (`galho`) ou pulou para o chão (null) — o Sagui no galho (opção 3 do dono, 23/11). Quem decide
   * é o servidor; a view anima a subida (0,72 s) e a descida (0,56 s). O pé (`moveActor`) fica no chão embaixo do galho.
   */
  perch?(id: number, galho: PerchLook | null): void;
  /**
   * O aviso de um golpe no chão (pedido do dono, 23/11: o quadrado vermelho por cima do quati era "muito feio"): as casas
   * onde ele vai pegar (`tiles` = [x, y, ...], as do servidor), pintadas pela view por baixo dos bichos, até a hora do
   * golpe (`ms`); `fire` = o chão pegando fogo (o rastro do boitatá). Sem este método, o motor pinta os quadrados de
   * sempre (combat.ts, `drawWarnings`).
   */
  warn?(tiles: number[], ms: number, opts?: { fire?: boolean; kind?: string }): void;
  /**
   * O chão parou de queimar nestas casas (`tiles` = [x, y, ...], como no `warn`): a poça da Cuca secou porque ela virou
   * bruxa ou caiu (pedido do dono, 25/11). Tire o desenho do fogo ou da poça dessas casas (pode sumir num piscar).
   * Opcional: sem ele, o desenho fica até o fim do tempo dele (sem queimar ninguém).
   */
  clearWarn?(tiles: number[]): void;
  /**
   * Alguém dormiu (a cantiga de ninar da Cuca, 24/11) ou acordou: o "Zzz" em cima dele (`asleep`). Opcional: sem ele, só
   * o aviso na tela de quem dormiu. O `warn` com `kind: 'caldo'` é a poça verde do caldo da Cuca (sem o `kind`, fogo).
   */
  sleep?(id: number, asleep: boolean): void;
  /**
   * A view sabe desenhar este tipo? Hoje só pergunto para os bichos (kind 'pet', ex.: 'joaquim'): se a view não sabe
   * (ou não tem este método), o motor desenha um gatinho provisório por cima. Ações dos bichos: 'meow', 'purr',
   * 'wake', 'sleep' e 'dash' (o pulo para o sofá e de volta).
   */
  canDraw?(kind: string, type: string): boolean;

  // ---- opcional (dia e noite) ----
  /**
   * A hora do dia: `light` de 1 (dia) a 0 (noite fechada), com o anoitecer e o amanhecer suaves (vem só quando muda,
   * em passos de 0,01); `night` = é noite: os bichos estão mais fortes (olhos vermelhos em todos eles).
   */
  setTimeOfDay?(time: { light: number; night: boolean }): void;
  /**
   * O vento: `strength` de 0 (parado) a 1 (forte) e `angle` = para onde sopra, em graus no chão (0 = leste, 90 = sul).
   * Vem só quando muda (as mudanças do servidor são devagar: o motor manda os passos do meio).
   */
  setWind?(strength: number, angle?: number): void;
  /** A intensidade da chuva, a umidade que acompanha a troca de mapa e se o mapa é todo coberto. */
  setRain?(strength: number, surface?: { wetness: number }, sheltered?: boolean): void;
  /**
   * Os Olhos de Gavião: os bichos destacados agora (o contorno na cor do perigo, por cima das copas e do escuro, e o
   * selo com o nível). O motor chama a cada quadro enquanto os Olhos valem; lista vazia = nenhum.
   */
  highlight?(list: { id: number; color: string; level: number }[]): void;
  /**
   * Os Olhos de Gavião: quanto a mais você enxerga (`percent`, 50 a 100; 0 = o normal). A view afasta a câmera com
   * suavidade além do limite do zoom (e volta no 0); o `setZoom` continua devolvendo só o zoom do jogador.
   */
  setVision?(percent: number): void;

  // ---- opcionais (conversa com NPC) ----
  /**
   * Modo conversa: a câmera vai, com suavidade, olhar para este ponto do chão (metros; o pé de quem fala) em vez de
   * seguir o seu personagem; null volta a seguir. O motor cuida do zoom (chega mais perto com setZoom).
   */
  focus?(point: { x: number; y: number } | null): void;
  /** `id` está falando por `ms` (boca e gestos, sem balão: o texto está na janela de conversa); 0 para de falar. */
  talk?(id: number, ms: number): void;
}

// ======================= desenho provisório =======================

/** Uma forma do mapa, em metros: retângulo, elipse (dentro da caixa), polígono ou linha com largura (trilha). */
export interface Shape {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  kind: string;
  ellipse?: boolean;
  /** Pontos do polígono (fechado) ou da linha (aberta). */
  points?: { x: number; y: number }[];
  /** Linha: largura em metros (propriedade `largura`). */
  lineWidth?: number;
  /** Altura em metros (propriedade `altura` da colisão; sem ela, a altura padrão do tipo). */
  height?: number;
}

/** Objeto do Tiled → forma em metros. */
export function shapeOf(o: TiledObject, px: number): Shape {
  const kind = typeOf(o);
  const pts = o.polygon ?? o.polyline;
  if (pts && pts.length > 0) {
    const points = pts.map((p) => ({ x: (o.x + p.x) / px, y: (o.y + p.y) / px }));
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), kind, points };
    if (!o.polyline) return box;
    const width = o.properties?.find((p) => p.name === 'largura')?.value;
    return { ...box, lineWidth: typeof width === 'number' && width > 0 ? width : 2 };
  }
  const altura = o.properties?.find((p) => p.name === 'altura')?.value;
  const height = typeof altura === 'number' && altura >= 0 ? altura : undefined;
  return { x0: o.x / px, y0: o.y / px, x1: (o.x + (o.width ?? 0)) / px, y1: (o.y + (o.height ?? 0)) / px, kind, ellipse: o.ellipse === true, height };
}

interface Actor extends ActorInfo {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  duration: number;
  speech: string;
  speechUntil: number;
  /** Levou golpe: fica vermelho até aqui. */
  hurtUntil?: number;
  /** Desmaiado (deitado e apagado) até 'revive'. */
  fainted?: boolean;
  /** Pulou (action 'jump') neste instante: sobe e desce em JUMP_DRAW_MS. */
  jumpAt?: number;
}

/** Quanto dura o pulinho do desenho provisório. */
const JUMP_DRAW_MS = 550;

/** Cores do chão por tipo (camada `chao` do mapa). O mapa da tecla M usa as mesmas. */
export const GROUND: Record<string, string> = {
  mata: '#1f4a24',
  terra: '#6b5232',
  grama: '#3f7a35',
  trilha: '#8a6c43',
  calcada: '#9a978c',
  rua: '#4a4a4f',
  agua: '#2f6f9f',
  clareira: '#5a8a3c',
  pedra: '#7d7a72',
  'mata-profunda': '#163b1c',
  lama: '#4d3a24',
  asfalto: '#3e3f44',
  circulo: '#8d9b97',
  praca: '#b8b2a3',
  faixa: '#d8d4c8',
};
/** Coisas da camada `colisao` que ficam no nível do chão (não viram caixa): a beira da água. */
const FLAT: Record<string, string> = { agua: 'rgba(47, 111, 159, 0.85)' };
/** Altura (metros) de cada tipo de coisa que bloqueia (camada `colisao`). */
const HEIGHT: Record<string, number> = { tronco: 1.6, poste: 3, pedra: 0.5, gradil: 1, portao: 2.2, pilar: 2.6, 'mata-fechada': 2.5, 'tronco-caido': 0.6 };
const ACTOR_COLORS = { me: '#f2c14e', player: '#6fa8ff', npc: '#7bd389', monster: '#ff6b6b', pet: '#f6f2ea' };

export const typeOf = (o: { type?: string; class?: string }) => o.type || o.class || '';

export class ProvisionalView implements WorldView {
  /** A luz do dia (1) até a noite fechada (0): setTimeOfDay. */
  private light = 1;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly actors = new Map<number, Actor>();
  private readonly ground: Shape[] = [];
  private readonly solids: Shape[] = [];
  /** Colisão no nível do chão (água): desenhada junto com o chão. */
  private readonly flat: Shape[] = [];
  private readonly safe: Shape[] = [];
  private readonly canopies: { x: number; y: number; r: number }[] = [];
  private followId: number | null = null;
  /** Modo conversa: a câmera olha para este ponto em vez de seguir alguém. */
  private focusPoint: { x: number; y: number } | null = null;
  private camX = 0;
  private camY = 0;
  /** Pixels por metro (muda com o tamanho da tela e com o zoom do jogador). */
  private scale = 40;
  private zoomUser = 1;
  /** Hora do último quadro (para actorPosition e action). */
  private lastNow = 0;
  private readonly onResize = () => this.resize();

  constructor(container: HTMLElement, map: TiledMap) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'mundo-novo';
    this.canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none;';
    container.append(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    const px = map.tilewidth;
    for (const layer of map.layers) {
      for (const o of layer.objects ?? []) {
        const shape = shapeOf(o, px);
        if (layer.name === 'chao' && !o.point) this.ground.push(shape);
        else if (layer.name === 'colisao' && !o.point) (FLAT[shape.kind] ? this.flat : this.solids).push(shape);
        else if (layer.name === 'seguro' && !o.point) this.safe.push(shape);
        else if (layer.name === 'cenario' && typeOf(o) === 'arvore') {
          // `copa` é o RAIO da copa em metros (combinado com o [mundo] e a [arte], docs/ARQUITETURA.md)
          const copa = o.properties?.find((p) => p.name === 'copa')?.value;
          this.canopies.push({ x: o.x / px, y: o.y / px, r: typeof copa === 'number' && copa > 0 ? copa : 1.5 });
        }
      }
    }
    this.resize();
    window.addEventListener('resize', this.onResize);
  }

  addActor(id: number, info: ActorInfo): void {
    this.actors.set(id, { ...info, fromX: info.x, fromY: info.y, toX: info.x, toY: info.y, start: 0, duration: 0, speech: '', speechUntil: 0 });
  }

  moveActor(id: number, x: number, y: number, angle: number, options: { durationMs?: number; dash?: boolean } = {}): void {
    const a = this.actors.get(id);
    if (!a) return;
    const now = performance.now();
    const at = this.position(a, now);
    const far = Math.hypot(x - at.x, y - at.y) > 4;
    a.fromX = far ? x : at.x;
    a.fromY = far ? y : at.y;
    a.toX = x;
    a.toY = y;
    a.angle = angle;
    a.start = now;
    a.duration = far ? 0 : (options.durationMs ?? 100);
  }

  removeActor(id: number): void {
    this.actors.delete(id);
  }

  say(id: number, text: string): void {
    const a = this.actors.get(id);
    if (!a) return;
    a.speech = text;
    a.speechUntil = performance.now() + 2500 + text.length * 60;
  }

  follow(id: number): void {
    this.followId = id;
    const a = this.actors.get(id);
    if (a) [this.camX, this.camY] = [a.toX, a.toY];
  }

  toScreen(x: number, y: number, z = 0): { x: number; y: number } {
    const s = this.scale;
    return {
      x: (x - y - (this.camX - this.camY)) * s * 0.866 + this.canvas.clientWidth / 2,
      y: (x + y - (this.camX + this.camY)) * s * 0.5 + this.canvas.clientHeight / 2 - z * s * 0.8,
    };
  }

  actorPosition(id: number): { x: number; y: number } | null {
    const a = this.actors.get(id);
    return a ? this.position(a, this.lastNow) : null;
  }

  action(id: number, kind: string): void {
    const a = this.actors.get(id);
    if (!a) return;
    if (kind === 'hurt') a.hurtUntil = this.lastNow + 180;
    else if (kind === 'faint' || kind === 'die') a.fainted = true;
    else if (kind === 'revive') a.fainted = false;
    else if (kind === 'jump') a.jumpAt = this.lastNow;
  }

  toWorld(screenX: number, screenY: number): { x: number; y: number } {
    const s = this.scale;
    const u = (screenX - this.canvas.clientWidth / 2) / (s * 0.866) + (this.camX - this.camY); // x - y
    const v = (screenY - this.canvas.clientHeight / 2) / (s * 0.5) + (this.camX + this.camY); // x + y
    return { x: (u + v) / 2, y: (v - u) / 2 };
  }

  groundDirOfScreen(dx: number, dy: number): { x: number; y: number } {
    const u = dx / 0.866;
    const v = dy / 0.5;
    const x = (u + v) / 2;
    const y = (v - u) / 2;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  frame(now: number): void {
    this.lastNow = now;
    const target = this.followId !== null ? this.actors.get(this.followId) : undefined;
    const at = this.focusPoint ?? (target ? this.position(target, now) : null);
    if (at) {
      // câmera acompanha macio (na conversa, vai até quem fala)
      this.camX += (at.x - this.camX) * 0.2;
      this.camY += (at.y - this.camY) * 0.2;
    }
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.fillStyle = '#16301a';
    ctx.fillRect(0, 0, w, h);

    for (const g of this.ground) this.fillFootprint(g, GROUND[g.kind] ?? '#355c2c');
    for (const f of this.flat) this.fillFootprint(f, FLAT[f.kind]!);
    ctx.setLineDash([6, 6]);
    for (const area of this.safe) this.strokeFootprint(area, 'rgba(255, 236, 160, 0.55)');
    ctx.setLineDash([]);

    // coisas altas e personagens na ordem de quem está mais atrás (menor x + y) para a frente
    const items: { depth: number; draw: () => void }[] = [];
    for (const s of this.solids) {
      if (this.onScreen((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, w, h)) items.push({ depth: s.x1 + s.y1, draw: () => this.drawBox(s, s.height ?? HEIGHT[s.kind] ?? 1.2) });
    }
    for (const [id, a] of this.actors) {
      const at = this.position(a, now);
      items.push({ depth: at.x + at.y, draw: () => this.drawActor(id, a, at.x, at.y, now) });
    }
    items.sort((p, q) => p.depth - q.depth);
    for (const item of items) item.draw();

    // copas por cima (transparentes perto do seu personagem)
    const me = target ? this.position(target, now) : null;
    for (const c of this.canopies) {
      if (!this.onScreen(c.x, c.y, w, h)) continue;
      const center = this.toScreen(c.x, c.y);
      const near = me && Math.hypot(me.x - c.x, me.y - c.y) < c.r + 1;
      ctx.fillStyle = near ? 'rgba(40, 110, 50, 0.25)' : 'rgba(40, 110, 50, 0.75)';
      ctx.beginPath();
      ctx.ellipse(center.x, center.y - 4.5 * this.scale * 0.8, c.r * this.scale * 0.9, c.r * this.scale * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // a noite: um véu azul-escuro por cima de tudo (o desenho de verdade, da [arte], faz o dele)
    if (this.light < 1) {
      ctx.fillStyle = `rgba(8, 14, 38, ${((1 - this.light) * 0.55).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  setTimeOfDay(time: { light: number; night: boolean }): void {
    this.light = Math.max(0, Math.min(1, time.light));
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.canvas.remove();
  }

  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * devicePixelRatio);
    this.canvas.height = Math.round(h * devicePixelRatio);
    // a escolha do dono: no normal, uns 14 × 16 m de chão na tela
    this.scale = Math.max(22, Math.min(70, Math.min(w / 16, h / 10))) * this.zoomUser;
  }

  focus(point: { x: number; y: number } | null): void {
    this.focusPoint = point;
  }

  talk(): void {
    // o desenho provisório não tem boca: quem fala só aparece na janela de conversa
  }

  setZoom(factor: number): number {
    this.zoomUser = Math.max(0.5, Math.min(1.4, factor));
    this.resize();
    return this.zoomUser;
  }

  private position(a: Actor, now: number): { x: number; y: number } {
    if (a.duration <= 0) return { x: a.toX, y: a.toY };
    const t = Math.min(1, (now - a.start) / a.duration);
    return { x: a.fromX + (a.toX - a.fromX) * t, y: a.fromY + (a.toY - a.fromY) * t };
  }

  private corners(s: Shape): { x: number; y: number }[] {
    return [this.toScreen(s.x0, s.y0), this.toScreen(s.x1, s.y0), this.toScreen(s.x1, s.y1), this.toScreen(s.x0, s.y1)];
  }

  /** O contorno da forma na tela (retângulo, elipse ou polígono). */
  private outline(s: Shape): { x: number; y: number }[] {
    if (s.points) return s.points.map((p) => this.toScreen(p.x, p.y));
    if (s.ellipse) return this.ellipsePoints((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.x1 - s.x0) / 2, (s.y1 - s.y0) / 2, 40);
    return this.corners(s);
  }

  /** Elipse no chão (metros) → pontos na tela. */
  private ellipsePoints(cx: number, cy: number, rx: number, ry: number, n: number): { x: number; y: number }[] {
    return Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      return this.toScreen(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry);
    });
  }

  /** Perto o bastante da tela para valer a pena desenhar (com folga para o que é alto). */
  private onScreen(x: number, y: number, w: number, h: number): boolean {
    const p = this.toScreen(x, y);
    const margin = 4 * this.scale;
    return p.x > -margin && p.x < w + margin && p.y > -margin && p.y < h + margin * 1.5;
  }

  /** Linha com largura no chão (trilha): um pedaço por trecho e um círculo em cada curva. */
  private fillLine(s: Shape): void {
    const points = s.points ?? [];
    const half = (s.lineWidth ?? 2) / 2;
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = (-(b.y - a.y) / length) * half;
      const ny = ((b.x - a.x) / length) * half;
      this.path([this.toScreen(a.x + nx, a.y + ny), this.toScreen(b.x + nx, b.y + ny), this.toScreen(b.x - nx, b.y - ny), this.toScreen(a.x - nx, a.y - ny)]);
      this.ctx.fill();
    }
    for (const p of points) {
      this.path(this.ellipsePoints(p.x, p.y, half, half, 16));
      this.ctx.fill();
    }
  }

  private path(points: { x: number; y: number }[], lift = 0): void {
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y - lift) : ctx.lineTo(p.x, p.y - lift)));
    ctx.closePath();
  }

  private fillFootprint(s: Shape, color: string): void {
    this.ctx.fillStyle = color;
    if (s.lineWidth !== undefined) return this.fillLine(s);
    this.path(this.outline(s));
    this.ctx.fill();
  }

  private strokeFootprint(s: Shape, color: string): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.path(this.outline(s));
    this.ctx.stroke();
  }

  private drawBox(s: Shape, height: number): void {
    const ctx = this.ctx;
    const lift = height * this.scale * 0.8;
    const [a, b, c, d] = this.corners(s) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
    ctx.fillStyle = '#2b2118';
    ctx.beginPath(); // lado da direita (b-c) e da frente (c-d)
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.lineTo(d.x, d.y - lift);
    ctx.lineTo(c.x, c.y - lift);
    ctx.lineTo(b.x, b.y - lift);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = s.kind === 'mata-fechada' ? '#244d27' : '#5b4630';
    this.path([a, b, c, d], lift);
    ctx.fill();
  }

  private drawActor(id: number, a: Actor, x: number, y: number, now: number): void {
    const ctx = this.ctx;
    const ground = this.toScreen(x, y);
    const s = this.scale;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y, s * 0.32, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // no pulo, o boneco sobe meio metro e desce (a sombra fica no chão)
    const jumpT = a.jumpAt !== undefined ? (now - a.jumpAt) / JUMP_DRAW_MS : 1;
    const p = jumpT < 1 ? { x: ground.x, y: ground.y - Math.sin(jumpT * Math.PI) * s * 0.5 } : ground;
    const color = now < (a.hurtUntil ?? 0) ? '#ff2d2d' : a.me ? ACTOR_COLORS.me : ACTOR_COLORS[a.kind];
    const height = a.fainted ? s * 0.4 : s * 1.5;
    ctx.globalAlpha = a.fainted ? 0.55 : 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (a.fainted) ctx.roundRect(p.x - s * 0.75, p.y - height, s * 1.5, height, s * 0.2);
    else ctx.roundRect(p.x - s * 0.22, p.y - height, s * 0.44, height, s * 0.2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    // para onde olha: um tracinho no chão
    const look = { x: Math.cos((a.angle * Math.PI) / 180), y: Math.sin((a.angle * Math.PI) / 180) };
    const tip = this.toScreen(x + look.x * 0.5, y + look.y * 0.5);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(ground.x, ground.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.font = `${Math.round(Math.max(11, s * 0.3))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(a.name, p.x, p.y - height - 8);
    ctx.fillText(a.name, p.x, p.y - height - 8);
    if (now < a.speechUntil) {
      ctx.font = `${Math.round(Math.max(12, s * 0.32))}px system-ui, sans-serif`;
      const width = Math.min(320, ctx.measureText(a.speech).width + 16);
      ctx.fillStyle = 'rgba(255, 250, 235, 0.95)';
      ctx.beginPath();
      ctx.roundRect(p.x - width / 2, p.y - height - 52, width, 28, 8);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillText(a.speech.length > 46 ? `${a.speech.slice(0, 45)}…` : a.speech, p.x, p.y - height - 33, 300);
    }
    void id;
  }

}
