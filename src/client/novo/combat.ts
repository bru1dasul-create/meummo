// Combate no jogo 2.5D, passo 1: o que o motor desenha POR CIMA do desenho (da [arte] ou o provisório) — o aviso
// de golpe no chão, o anel laranja de quem está preparando um golpe (o sagui antes de jogar a fruta), o chão pegando fogo, as pedras voando, os números de dano e de cura, a barra de vida de quem
// está machucado, o clarão dos golpes de perto e o ouro no chão. Fica numa tela transparente por cima, que não
// recebe toque nem clique. Quando a [arte] desenhar essas coisas do jeito dela, o motor deixa de desenhar aqui.
//
// Posições, em metros (as mesmas do servidor):
// - quem está no tile (tx, ty) tem o PÉ dentro do quadrado [tx, tx+1] × [ty+0,2, ty+1,2] do chão — é ali que o
//   aviso vermelho é desenhado (pé dentro do vermelho = leva o golpe);
// - um projétil em (sx, sy) é desenhado sobre o ponto do chão (sx, sy + 0,5), na altura do peito: é onde ficam os
//   pés de quem ele acerta;
// - mirar é sempre do seu pé até o pé do alvo (ou até o ponto do chão apontado).

import type { CombatRules } from '../../shared/combatRules';
import type { MapRegion } from '../../shared/map';
import { GUARD_MAX_ENERGY, SHOT_FEET_DY } from '../../shared/constants';
import type { GuardState } from '../../shared/protocol';
import type { WorldView } from './view';

type Point = { x: number; y: number };

/** Quadrado do chão (onde ficam os pés) que o tile (tx, ty) cobre. */
export function tileFeetSquare(tx: number, ty: number): Point[] {
  return [
    { x: tx, y: ty + 0.2 },
    { x: tx + 1, y: ty + 0.2 },
    { x: tx + 1, y: ty + 1.2 },
    { x: tx, y: ty + 1.2 },
  ];
}

/** Ponto do chão embaixo de um projétil que está em (sx, sy). */
export function shotFeet(sx: number, sy: number): Point {
  return { x: sx, y: sy + SHOT_FEET_DY };
}

/** Onde o projétil sai, para quem tem o pé em (feetX, feetY) (o inverso de shotFeet). */
export function shotOriginOfFeet(feetX: number, feetY: number): Point {
  return { x: feetX, y: feetY - SHOT_FEET_DY };
}

/** Ângulo do tiro (radianos, como o servidor espera) de um pé até outro ponto do chão. */
export function aimAngle(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Distância (pixels) de um ponto da tela até o segmento A–B da tela. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const length2 = abx * abx + aby * aby;
  const t = length2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / length2)) : 0;
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

/** Altura do corpo (metros) para acertar o toque/clique em cima de alguém. */
export const BODY_HEIGHT = 1.6;

interface Warning {
  tiles: number[];
  start: number;
  until: number;
  fire: boolean;
}

interface Flying {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  range: number;
  start: number;
  kind: string;
  fromMonster: boolean;
}

/** Um bicho que a view ainda não desenha (o Joaquim, até o desenho da [arte]): o gatinho provisório. */
interface ProvisionalPet {
  name: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  duration: number;
  /** Para onde olha (radianos, no chão). */
  angle: number;
  asleep: boolean;
  /** A casa dele: só aparece com você lá dentro (de fora, o telhado esconde). */
  home: MapRegion | null;
}

interface Floater {
  id: number;
  text: string;
  color: string;
  start: number;
}

interface Flash {
  x: number;
  y: number;
  angle: number;
  radius: number;
  wide: boolean;
  start: number;
}

interface GroundDrop {
  x: number;
  y: number;
  gold: boolean;
  until: number;
}

const FLOAT_MS = 900;
/** Raio do anel da carga em volta do pé (metros). */
const CHARGE_RING_RADIUS = 0.6;
/** Quanto tempo um aviso embaixo do pé ("carga perdida", "defesa quebrou!") fica na tela. */
const FOOT_NOTE_MS = 1100;
/** Raio do arco da defesa no chão (metros). */
const GUARD_RADIUS = 0.8;
/** Faísca da defesa segurando um golpe. */
const SPARK_MS = 420;
const FLASH_MS = 260;
/**
 * A camada de combate não precisa de mais pixels que o desenho do cenário: no celular de tela muito densa ela ficava
 * maior que o próprio cenário (2265×945 contra 1726×720). Até este tanto de pixels; acima disso, perde só um pouco de
 * nitidez nos números e anéis.
 */
const MAX_LAYER_PIXELS = 1_300_000;
const POOF_MS = 450;

export class CombatLayer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private warnings: Warning[] = [];
  private readonly shots = new Map<number, Flying>();
  /** Seus tiros, desenhados na hora do clique (cid) até o servidor mandar o número dele. */
  private readonly myShots = new Map<number, Flying>();
  /** Número do servidor → número do seu tiro (cid). */
  private readonly shotOfServer = new Map<number, number>();
  private floaters: Floater[] = [];
  private flashes: Flash[] = [];
  private poofs: { x: number; y: number; start: number }[] = [];
  /** Puxando o estilingue (ou o arco): de quem, desde quando e em quanto tempo enche (o anel em volta do pé). */
  private chargeRing: { id: number; since: number; fullMs: number } | null = null;
  /** Aviso curto embaixo do pé ("carga perdida", "defesa quebrou!"). */
  private footNote: { id: number; text: string; color: string; start: number } | null = null;
  /** Defesas levantadas: de quem, para onde (radianos) e desde quando (protege depois de guardReadyMs). */
  private readonly guards = new Map<number, { angle: number; since: number }>();
  /** A sua energia (barra embaixo do pé quando não está cheia ou a defesa está levantada). */
  private energy: { id: number; value: number; state: GuardState } | null = null;
  /** Faíscas de golpes que bateram na defesa. */
  private sparks: { id: number; angle: number; broke: boolean; start: number }[] = [];
  /** Sinais de missão em cima dos NPCs ('!' nova, '?' para concluir). */
  private readonly marks = new Map<number, '!' | '?'>();
  /** Quem está preparando um golpe (anel laranja no pé), até quando. */
  private readonly windups = new Map<number, { start: number; until: number }>();
  private readonly drops = new Map<number, GroundDrop>();
  private readonly pets = new Map<number, ProvisionalPet>();
  /** O seu pé (para saber se você está dentro da casa do bicho). */
  private viewer: Point | null = null;

  constructor(
    container: HTMLElement,
    /** Os números do combate (tempo da carga, arco da defesa): o motor muda no lugar quando o servidor manda novos. */
    private readonly rules: CombatRules,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'combate-novo';
    this.canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    container.append(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  // ---- bichos que a view ainda não desenha (o gatinho provisório) ----

  setPet(id: number, name: string, x: number, y: number, angle: number, asleep: boolean, home: MapRegion | null): void {
    this.pets.set(id, { name, fromX: x, fromY: y, toX: x, toY: y, start: 0, duration: 0, angle, asleep, home });
  }

  movePet(id: number, x: number, y: number, angle: number, now: number, durationMs: number): void {
    const pet = this.pets.get(id);
    if (!pet) return;
    const at = this.petAt(pet, now);
    Object.assign(pet, { fromX: at.x, fromY: at.y, toX: x, toY: y, start: now, duration: durationMs, angle });
  }

  petAsleep(id: number, asleep: boolean): void {
    const pet = this.pets.get(id);
    if (pet) pet.asleep = asleep;
  }

  removePet(id: number): void {
    this.pets.delete(id);
  }

  hasPet(id: number): boolean {
    return this.pets.has(id);
  }

  /** O seu pé agora (o motor manda a cada quadro). */
  setViewer(feet: Point | null): void {
    this.viewer = feet;
  }

  private petAt(pet: ProvisionalPet, now: number): Point {
    const t = pet.duration > 0 ? Math.min(1, (now - pet.start) / pet.duration) : 1;
    return { x: pet.fromX + (pet.toX - pet.fromX) * t, y: pet.fromY + (pet.toY - pet.fromY) * t };
  }

  private petVisible(pet: ProvisionalPet): boolean {
    const home = pet.home;
    const me = this.viewer;
    if (!home) return true;
    return me !== null && me.x >= home.x0 - 0.3 && me.x <= home.x1 + 0.3 && me.y >= home.y0 - 0.3 && me.y <= home.y1 + 0.6;
  }

  /** O gatinho provisório: branco com orelhas, máscara e rabo laranja; dormindo, enroladinho com "z". */
  private drawPets(now: number, screen: (x: number, y: number, z?: number) => Point, meter: (x: number, y: number) => number): void {
    const ctx = this.ctx;
    for (const pet of this.pets.values()) {
      if (!this.petVisible(pet)) continue;
      const at = this.petAt(pet, now);
      const m = meter(at.x, at.y);
      const shadow = screen(at.x, at.y, 0);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, m * 0.2, m * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      const white = '#f6f2ea';
      const orange = '#e8913a';
      ctx.lineWidth = Math.max(1, m * 0.012);
      ctx.strokeStyle = '#6b5a48';
      if (pet.asleep) {
        const c = screen(at.x, at.y, 0.1);
        ctx.fillStyle = white;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, m * 0.17, m * 0.11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = orange;
        ctx.lineWidth = Math.max(2, m * 0.04);
        ctx.beginPath();
        ctx.arc(c.x, c.y, m * 0.15, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
        ctx.fillStyle = orange;
        ctx.beginPath();
        ctx.arc(c.x - m * 0.1, c.y - m * 0.05, m * 0.05, 0, Math.PI * 2);
        ctx.fill();
        const rise = (now / 900) % 1;
        ctx.fillStyle = `rgba(240, 240, 255, ${(1 - rise).toFixed(2)})`;
        ctx.font = `700 ${Math.round(Math.max(10, m * 0.14))}px system-ui, sans-serif`;
        ctx.fillText('z', c.x + m * 0.12, c.y - m * (0.18 + rise * 0.25));
      } else {
        const dx = Math.cos(pet.angle);
        const dy = Math.sin(pet.angle);
        const body = screen(at.x, at.y, 0.14);
        const head = screen(at.x + dx * 0.15, at.y + dy * 0.15, 0.24);
        const tail = screen(at.x - dx * 0.18, at.y - dy * 0.18, 0.3);
        const tailBase = screen(at.x - dx * 0.12, at.y - dy * 0.12, 0.14);
        ctx.strokeStyle = orange;
        ctx.lineWidth = Math.max(2, m * 0.035);
        ctx.beginPath();
        ctx.moveTo(tailBase.x, tailBase.y);
        ctx.quadraticCurveTo(tailBase.x, tail.y, tail.x, tail.y);
        ctx.stroke();
        ctx.fillStyle = white;
        ctx.strokeStyle = '#6b5a48';
        ctx.lineWidth = Math.max(1, m * 0.012);
        ctx.beginPath();
        ctx.ellipse(body.x, body.y, m * 0.15, m * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // orelhas laranja e a cabeça branca com a máscara laranja na testa
        const r = m * 0.075;
        ctx.fillStyle = orange;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(head.x + side * r * 0.9, head.y - r * 0.3);
          ctx.lineTo(head.x + side * r * 0.75, head.y - r * 1.55);
          ctx.lineTo(head.x + side * r * 0.1, head.y - r * 0.85);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = white;
        ctx.beginPath();
        ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = orange;
        ctx.beginPath();
        ctx.ellipse(head.x, head.y - r * 0.55, r * 0.55, r * 0.35, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5aa9e6'; // olhos azuis, como o gato do dono
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(head.x + side * r * 0.38, head.y - r * 0.05, Math.max(1, r * 0.16), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // o nome em cima
      const label = screen(at.x, at.y, pet.asleep ? 0.45 : 0.55);
      ctx.font = `700 ${Math.round(Math.max(11, m * 0.13))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.strokeText(pet.name, label.x, label.y);
      ctx.fillStyle = '#f6e7c8';
      ctx.fillText(pet.name, label.x, label.y);
      ctx.textAlign = 'start';
    }
  }

  /** Aviso de golpe nestes tiles ([x1, y1, x2, y2, ...]) por `ms`; `fire`: chão pegando fogo. */
  warn(tiles: number[], ms: number, now: number, fire = false): void {
    this.warnings.push({ tiles, start: now, until: now + ms, fire });
  }

  /** Alguém está preparando um golpe por `ms` (o aviso laranja embaixo dele). */
  windup(id: number, ms: number, now: number): void {
    this.windups.set(id, { start: now, until: now + ms });
  }

  /** Um projétil que o servidor mandou (de monstro ou de outro jogador). */
  shot(id: number, x: number, y: number, angle: number, speed: number, range: number, kind: string, fromMonster: boolean, now: number): void {
    this.shots.set(id, { x, y, dx: Math.cos(angle), dy: Math.sin(angle), speed, range, start: now, kind, fromMonster });
  }

  /** O seu tiro, desenhado na hora (o servidor confirma depois com o mesmo `cid`). */
  myShot(cid: number, x: number, y: number, angle: number, speed: number, range: number, now: number, kind = 'pedra'): void {
    this.myShots.set(cid, { x, y, dx: Math.cos(angle), dy: Math.sin(angle), speed, range, start: now, kind, fromMonster: false });
  }

  /** O servidor confirmou o seu tiro `cid` com o número `id`. */
  linkMyShot(cid: number, id: number, range?: number): void {
    const mine = this.myShots.get(cid);
    if (!mine) return;
    this.shotOfServer.set(id, cid);
    // o alcance que vale é o do servidor (ex.: um golpe soltou a carga um instante antes de a pedra sair)
    if (range !== undefined) mine.range = range;
  }

  /** O projétil acabou (acertou alguém, bateu em algo ou chegou no fim). */
  endShot(id: number): void {
    this.shots.delete(id);
    const cid = this.shotOfServer.get(id);
    if (cid !== undefined) {
      this.myShots.delete(cid);
      this.shotOfServer.delete(id);
    }
  }

  /** Número que sobe em cima de alguém (dano, cura, nível). */
  floater(id: number, text: string, color: string, now: number): void {
    this.floaters.push({ id, text, color, start: now });
  }

  /** Clarão de golpe de perto: leque (ou círculo, `wide`) no chão a partir do pé (x, y). */
  flash(x: number, y: number, angle: number, radius: number, wide: boolean, now: number): void {
    this.flashes.push({ x, y, angle, radius, wide, start: now });
  }

  /** Começou (`since`) ou parou (null) de puxar o estilingue. */
  /** Começou a puxar (`since`) ou soltou (null). `fullMs`: em quanto tempo a carga enche (o arco é mais lento). */
  setCharge(id: number, since: number | null, fullMs = this.rules.chargeFullMs): void {
    this.chargeRing = since === null ? null : { id, since, fullMs };
    if (since !== null && this.footNote?.id === id) this.footNote = null;
  }

  /** Um golpe soltou a pedra que `id` puxava: some o anel e aparece "carga perdida" no lugar. */
  loseCharge(id: number, now: number): void {
    this.chargeRing = null;
    this.note(id, 'carga perdida', '#efe3c6', now);
  }

  /** Aviso curto embaixo do pé de `id`. */
  note(id: number, text: string, color: string, now: number): void {
    this.footNote = { id, text, color, start: now };
  }

  /** Defesa de `id` levantada, virada para `angle` (radianos), ou baixada (null). */
  setGuard(id: number, angle: number | null, now: number): void {
    if (angle === null) {
      this.guards.delete(id);
      return;
    }
    const guard = this.guards.get(id);
    if (guard) guard.angle = angle;
    else this.guards.set(id, { angle, since: now });
  }

  /** A sua energia (0 a 100) e a defesa, para a barra embaixo do pé. */
  setEnergy(id: number, value: number, state: GuardState): void {
    this.energy = { id, value, state };
  }

  /** Um golpe bateu na defesa de `id` (virada para `angle`; null = para onde a defesa dele está); `broke`: e quebrou. */
  spark(id: number, angle: number | null, broke: boolean, now: number): void {
    this.sparks.push({ id, angle: angle ?? this.guards.get(id)?.angle ?? 0, broke, start: now });
  }

  /** Sinal de missão em cima do NPC `id` ('' tira). */
  setMark(id: number, mark: '!' | '?' | ''): void {
    if (mark) this.marks.set(id, mark);
    else this.marks.delete(id);
  }

  /** Nuvenzinha onde um monstro caiu. */
  poof(x: number, y: number, now: number): void {
    this.poofs.push({ x, y, start: now });
  }

  /** Ouro (ou item) no chão no tile (x, y), até `until`. */
  addDrop(id: number, x: number, y: number, gold: boolean, until: number): void {
    this.drops.set(id, { x, y, gold, until });
  }

  removeDrop(id: number): void {
    this.drops.delete(id);
  }

  /** Mudou de mapa: limpa tudo. */
  clear(): void {
    this.warnings = [];
    this.shots.clear();
    this.myShots.clear();
    this.shotOfServer.clear();
    this.floaters = [];
    this.flashes = [];
    this.poofs = [];
    this.drops.clear();
    this.windups.clear();
    this.marks.clear();
    this.chargeRing = null;
    this.footNote = null;
    this.guards.clear();
    this.sparks = [];
  }

  /** Põe a tela do combate por cima do desenho (chamar depois de criar a view de um mapa novo). */
  raise(): void {
    this.canvas.parentElement?.append(this.canvas);
  }

  destroy(): void {
    this.canvas.remove();
  }

  /**
   * Desenha um quadro, depois do desenho do mundo. `feetOf(id)`: onde o pé de alguém está desenhado agora;
   * `health(id)`: vida de quem mostra barra (null = não mostra).
   */
  frame(now: number, view: WorldView, feetOf: (id: number) => Point | null, health: Iterable<{ id: number; hp: number; maxHp: number }>): void {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const screen = (x: number, y: number, z = 0) => view.toScreen(x, y, z);
    const bars = [...health];
    // nada para mostrar: a camada some (o navegador não gasta para juntá-la ao desenho do cenário)
    if (!this.busy(feetOf, screen, w, h, bars.length > 0)) {
      if (this.canvas.style.visibility !== 'hidden') {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.style.visibility = 'hidden';
      }
      return;
    }
    this.canvas.style.visibility = '';
    const scale = Math.min(window.devicePixelRatio || 1, Math.max(1, Math.sqrt(MAX_LAYER_PIXELS / Math.max(1, w * h))));
    if (this.canvas.width !== Math.round(w * scale) || this.canvas.height !== Math.round(h * scale)) {
      this.canvas.width = Math.round(w * scale);
      this.canvas.height = Math.round(h * scale);
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // quantos pixels tem 1 metro de altura aqui (para o tamanho das coisas acompanhar o zoom)
    const meter = (x: number, y: number) => Math.max(8, Math.abs(screen(x, y, 0).y - screen(x, y, 1).y));

    this.drawWarnings(now, screen);
    this.drawWindups(now, feetOf, screen);
    this.drawGuards(now, feetOf, screen);
    this.drawChargeRing(now, feetOf, screen);
    const below = this.drawEnergy(now, feetOf, screen, meter);
    this.drawFootNote(now, feetOf, screen, meter, below);
    this.drawDrops(now, screen, meter);
    this.drawPets(now, screen, meter);
    this.drawFlashes(now, screen);
    this.drawPoofs(now, screen, meter);
    this.drawShots(now, screen, meter);
    this.drawBars(feetOf, bars, screen, meter);
    this.drawMarks(now, feetOf, screen, meter);
    this.drawFloaters(now, feetOf, screen, meter);
  }

  /** Tem algo para desenhar agora? (Sinal de missão só conta se o NPC estiver na tela.) */
  private busy(feetOf: (id: number) => Point | null, screen: (x: number, y: number, z?: number) => Point, w: number, h: number, bars: boolean): boolean {
    if (bars || this.warnings.length > 0 || this.shots.size > 0 || this.myShots.size > 0 || this.floaters.length > 0) return true;
    if (this.flashes.length > 0 || this.poofs.length > 0 || this.chargeRing !== null || this.footNote !== null) return true;
    if (this.guards.size > 0 || this.sparks.length > 0 || this.windups.size > 0 || this.drops.size > 0) return true;
    if (this.energy !== null && (this.energy.value < GUARD_MAX_ENERGY || this.energy.state !== 'off')) return true;
    for (const pet of this.pets.values()) if (this.petVisible(pet)) return true;
    for (const id of this.marks.keys()) {
      const feet = feetOf(id);
      if (!feet) continue;
      const p = screen(feet.x, feet.y, BODY_HEIGHT);
      if (p.x > -80 && p.x < w + 80 && p.y > -120 && p.y < h + 80) return true;
    }
    return false;
  }

  private drawWarnings(now: number, screen: (x: number, y: number, z?: number) => Point): void {
    const ctx = this.ctx;
    this.warnings = this.warnings.filter((warning) => now < warning.until);
    for (const warning of this.warnings) {
      const total = Math.max(1, warning.until - warning.start);
      const progress = Math.min(1, (now - warning.start) / total);
      // o vermelho fica mais forte perto do golpe; o fogo tremula
      const alpha = warning.fire ? 0.3 + 0.12 * Math.sin(now / 70) : 0.2 + 0.35 * progress;
      ctx.fillStyle = warning.fire ? `rgba(255, 140, 40, ${alpha.toFixed(3)})` : `rgba(229, 60, 60, ${alpha.toFixed(3)})`;
      ctx.strokeStyle = warning.fire ? 'rgba(255, 190, 90, 0.7)' : 'rgba(255, 120, 110, 0.75)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i + 1 < warning.tiles.length; i += 2) {
        const corners = tileFeetSquare(warning.tiles[i]!, warning.tiles[i + 1]!).map((p) => screen(p.x, p.y));
        ctx.beginPath();
        corners.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  private drawWindups(now: number, feetOf: (id: number) => Point | null, screen: (x: number, y: number, z?: number) => Point): void {
    const ctx = this.ctx;
    for (const [id, windup] of this.windups) {
      const feet = now < windup.until ? feetOf(id) : null;
      if (!feet) {
        this.windups.delete(id);
        continue;
      }
      const progress = Math.min(1, (now - windup.start) / Math.max(1, windup.until - windup.start));
      // anel no chão que fecha conforme o golpe chega
      const radius = 0.75 - 0.3 * progress;
      ctx.strokeStyle = `rgba(255, 150, 40, ${(0.45 + 0.5 * progress).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const p = screen(feet.x + Math.cos(a) * radius, feet.y + Math.sin(a) * radius);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  /** O anel da carga em volta do pé: enche no sentido do relógio; cheio, fica dourado e pulsa. */
  private drawChargeRing(now: number, feetOf: (id: number) => Point | null, screen: (x: number, y: number, z?: number) => Point): void {
    const ring = this.chargeRing;
    const feet = ring ? feetOf(ring.id) : null;
    if (!ring || !feet) return;
    const progress = ring.fullMs > 0 ? Math.min(1, (now - ring.since) / ring.fullMs) : 1;
    const full = progress >= 1;
    const ctx = this.ctx;
    const radius = CHARGE_RING_RADIUS;
    const arc = (from: number, to: number) => {
      ctx.beginPath();
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const a = from + ((to - from) * i) / steps;
        const p = screen(feet.x + Math.cos(a) * radius, feet.y + Math.sin(a) * radius);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    };
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20, 12, 10, 0.35)';
    arc(0, Math.PI * 2);
    // enche como um relógio na tela: começa no ponto mais alto do anel e vai para a direita (com qualquer câmera)
    let top = 0;
    let topY = Infinity;
    for (let i = 0; i < 48; i++) {
      const a = (Math.PI * 2 * i) / 48;
      const y = screen(feet.x + Math.cos(a) * radius, feet.y + Math.sin(a) * radius).y;
      if (y < topY) {
        topY = y;
        top = a;
      }
    }
    const step = Math.PI / 24;
    const right = screen(feet.x + Math.cos(top + step) * radius, feet.y + Math.sin(top + step) * radius).x;
    const left = screen(feet.x + Math.cos(top - step) * radius, feet.y + Math.sin(top - step) * radius).x;
    const turn = right >= left ? 1 : -1;
    ctx.strokeStyle = full ? `rgba(255, 205, 80, ${(0.75 + 0.25 * Math.sin(now / 80)).toFixed(3)})` : 'rgba(255, 240, 200, 0.95)';
    ctx.lineWidth = full ? 5 : 4;
    arc(top, top + turn * Math.PI * 2 * progress);
  }

  /** O ponto mais baixo, na tela, de um círculo de `radius` metros no chão em volta de `feet`. */
  private bottomOfRing(feet: Point, radius: number, screen: (x: number, y: number, z?: number) => Point): number {
    let bottom = -Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      bottom = Math.max(bottom, screen(feet.x + Math.cos(a) * radius, feet.y + Math.sin(a) * radius).y);
    }
    return bottom;
  }

  /** O aviso embaixo do pé, abaixo do anel (e da barra de energia, se ela estiver aparecendo: `below` pixels). */
  private drawFootNote(now: number, feetOf: (id: number) => Point | null, screen: (x: number, y: number, z?: number) => Point, meter: (x: number, y: number) => number, below: number): void {
    const note = this.footNote;
    if (!note) return;
    const t = (now - note.start) / FOOT_NOTE_MS;
    const feet = t < 1 ? feetOf(note.id) : null;
    if (!feet) {
      if (t >= 1) this.footNote = null;
      return;
    }
    const ctx = this.ctx;
    const bottom = this.bottomOfRing(feet, CHARGE_RING_RADIUS, screen) + (this.energy?.id === note.id ? below : 0);
    const center = screen(feet.x, feet.y);
    const size = Math.round(Math.max(12, meter(feet.x, feet.y) * 0.22));
    ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20, 12, 10, 0.85)';
    ctx.strokeText(note.text, center.x, bottom + size + 2);
    ctx.fillStyle = note.color;
    ctx.fillText(note.text, center.x, bottom + size + 2);
    ctx.globalAlpha = 1;
  }

  /** Arco da defesa no chão, na frente de quem defende (fraco enquanto sobe, forte quando já protege). */
  private drawGuards(now: number, feetOf: (id: number) => Point | null, screen: (x: number, y: number, z?: number) => Point): void {
    const ctx = this.ctx;
    const arc = (feet: Point, radius: number, from: number, to: number, first: boolean) => {
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const a = from + ((to - from) * i) / steps;
        const p = screen(feet.x + Math.cos(a) * radius, feet.y + Math.sin(a) * radius);
        if (i === 0 && first) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
    };
    for (const [id, guard] of this.guards) {
      const feet = feetOf(id);
      if (!feet) continue;
      const ready = now - guard.since >= this.rules.guardReadyMs;
      const from = guard.angle - this.rules.guardHalfArc;
      const to = guard.angle + this.rules.guardHalfArc;
      // faixa clara (o pedaço protegido) e a borda de fora
      ctx.beginPath();
      arc(feet, GUARD_RADIUS, from, to, true);
      arc(feet, GUARD_RADIUS - 0.18, to, from, false);
      ctx.closePath();
      ctx.fillStyle = `rgba(184, 235, 240, ${ready ? 0.28 : 0.12})`;
      ctx.fill();
      ctx.beginPath();
      arc(feet, GUARD_RADIUS, from, to, true);
      ctx.lineWidth = ready ? 4 : 2;
      ctx.strokeStyle = `rgba(184, 235, 240, ${ready ? 0.9 : 0.45})`;
      ctx.stroke();
    }
    // faíscas: um golpe bateu na defesa (laranja: e quebrou)
    this.sparks = this.sparks.filter((spark) => now - spark.start < SPARK_MS);
    for (const spark of this.sparks) {
      const feet = feetOf(spark.id);
      if (!feet) continue;
      const u = (now - spark.start) / SPARK_MS;
      const center = screen(feet.x + Math.cos(spark.angle) * GUARD_RADIUS, feet.y + Math.sin(spark.angle) * GUARD_RADIUS, 0.9);
      const radius = 8 + u * 18;
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = spark.broke ? '#f3a25b' : '#b8ebf0';
      ctx.lineWidth = 3 - u * 1.5;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047 + spark.start;
        ctx.beginPath();
        ctx.moveTo(center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius * 0.7);
        ctx.lineTo(center.x + Math.cos(a) * (radius + 7), center.y + Math.sin(a) * (radius + 7) * 0.7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /**
   * A barra de energia embaixo do seu pé (só quando não está cheia ou a defesa está levantada; laranja piscando
   * quando quebrou). Azul, como o arco da defesa e a barra de energia da HUD (a verde da HUD é a XP).
   * Devolve quantos pixels ela ocupa, para o aviso embaixo do pé descer.
   */
  private drawEnergy(now: number, feetOf: (id: number) => Point | null, screen: (x: number, y: number, z?: number) => Point, meter: (x: number, y: number) => number): number {
    const energy = this.energy;
    if (!energy || (energy.value >= GUARD_MAX_ENERGY && energy.state === 'off')) return 0;
    const feet = feetOf(energy.id);
    if (!feet) return 0;
    const ctx = this.ctx;
    const center = screen(feet.x, feet.y);
    const top = this.bottomOfRing(feet, CHARGE_RING_RADIUS, screen) + 6;
    const width = Math.round(Math.max(44, meter(feet.x, feet.y) * 0.9));
    const height = 6;
    const left = center.x - width / 2;
    const fraction = Math.max(0, Math.min(1, energy.value / GUARD_MAX_ENERGY));
    ctx.fillStyle = 'rgba(20, 12, 10, 0.7)';
    ctx.fillRect(left - 1, top - 1, width + 2, height + 2);
    if (energy.state === 'broken') {
      ctx.fillStyle = Math.floor(now / 160) % 2 === 0 ? '#f3a25b' : '#a8582a';
      ctx.fillRect(left, top, Math.max(2, width * fraction), height);
    } else {
      ctx.fillStyle = energy.state === 'up' ? '#6ec6ff' : '#2a7ad8';
      ctx.fillRect(left, top, width * fraction, height);
    }
    return height + 8;
  }

  private drawDrops(now: number, screen: (x: number, y: number, z?: number) => Point, meter: (x: number, y: number) => number): void {
    const ctx = this.ctx;
    for (const [id, drop] of this.drops) {
      if (now >= drop.until) {
        this.drops.delete(id);
        continue;
      }
      const x = drop.x + 0.5;
      const y = drop.y + 0.7;
      const m = meter(x, y);
      const bob = 0.08 + 0.04 * Math.sin(now / 200 + id);
      const shadow = screen(x, y, 0);
      const p = screen(x, y, bob);
      // pisca no último segundo e meio, antes de sumir
      if (drop.until - now < 1500 && Math.floor(now / 150) % 2 === 0) continue;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, m * 0.16, m * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = drop.gold ? '#f2c14e' : '#b07a45';
      ctx.strokeStyle = drop.gold ? '#8a5a12' : '#5a3a1c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (drop.gold) ctx.ellipse(p.x, p.y - m * 0.06, m * 0.11, m * 0.11, 0, 0, Math.PI * 2);
      else ctx.roundRect(p.x - m * 0.12, p.y - m * 0.2, m * 0.24, m * 0.2, m * 0.04);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawFlashes(now: number, screen: (x: number, y: number, z?: number) => Point): void {
    const ctx = this.ctx;
    this.flashes = this.flashes.filter((flash) => now - flash.start < FLASH_MS);
    for (const flash of this.flashes) {
      const life = 1 - (now - flash.start) / FLASH_MS;
      ctx.fillStyle = `rgba(255, 236, 170, ${(0.45 * life).toFixed(3)})`;
      ctx.beginPath();
      const steps = 14;
      const from = flash.wide ? 0 : flash.angle - Math.PI / 3;
      const to = flash.wide ? Math.PI * 2 : flash.angle + Math.PI / 3;
      const center = screen(flash.x, flash.y);
      if (!flash.wide) ctx.moveTo(center.x, center.y);
      for (let i = 0; i <= steps; i++) {
        const a = from + ((to - from) * i) / steps;
        const p = screen(flash.x + Math.cos(a) * flash.radius, flash.y + Math.sin(a) * flash.radius);
        if (flash.wide && i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawPoofs(now: number, screen: (x: number, y: number, z?: number) => Point, meter: (x: number, y: number) => number): void {
    const ctx = this.ctx;
    this.poofs = this.poofs.filter((poof) => now - poof.start < POOF_MS);
    for (const poof of this.poofs) {
      const t = (now - poof.start) / POOF_MS;
      const m = meter(poof.x, poof.y);
      const p = screen(poof.x, poof.y, 0.5 + t * 0.4);
      ctx.fillStyle = `rgba(235, 235, 225, ${(0.6 * (1 - t)).toFixed(3)})`;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + t;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(a) * m * 0.3 * (0.5 + t), p.y + Math.sin(a) * m * 0.15 * (0.5 + t), m * 0.16, m * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawShots(now: number, screen: (x: number, y: number, z?: number) => Point, meter: (x: number, y: number) => number): void {
    const draw = (shots: Map<number, Flying>) => {
      for (const [key, shot] of shots) {
        const traveled = (shot.speed * (now - shot.start)) / 1000;
        if (traveled >= shot.range + 0.2) {
          shots.delete(key);
          continue;
        }
        const ground = shotFeet(shot.x + shot.dx * Math.min(traveled, shot.range), shot.y + shot.dy * Math.min(traveled, shot.range));
        const m = meter(ground.x, ground.y);
        const shadow = screen(ground.x, ground.y, 0);
        const p = screen(ground.x, ground.y, 0.9);
        const ctx = this.ctx;
        if (shot.kind === 'flecha') {
          // flecha provisória (a [arte] desenha a de verdade): uma haste na direção do voo, com a ponta clara
          const tail = screen(ground.x - shot.dx * 0.6, ground.y - shot.dy * 0.6, 0.9);
          const tailShadow = screen(ground.x - shot.dx * 0.6, ground.y - shot.dy * 0.6, 0);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
          ctx.lineWidth = Math.max(2, m * 0.04);
          ctx.beginPath();
          ctx.moveTo(tailShadow.x, tailShadow.y);
          ctx.lineTo(shadow.x, shadow.y);
          ctx.stroke();
          ctx.strokeStyle = '#7a5530';
          ctx.lineWidth = Math.max(2, m * 0.035);
          ctx.beginPath();
          ctx.moveTo(tail.x, tail.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.fillStyle = '#e8e2d2';
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(2, m * 0.035), 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(shadow.x, shadow.y, m * 0.1, m * 0.045, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shot.fromMonster ? '#c9e265' : '#d9d2c3';
        ctx.strokeStyle = shot.fromMonster ? '#4f6b12' : '#4a4237';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, Math.max(3, m * 0.08), Math.max(3, m * 0.08), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    };
    draw(this.shots);
    draw(this.myShots);
  }

  private drawBars(
    feetOf: (id: number) => Point | null,
    health: Iterable<{ id: number; hp: number; maxHp: number }>,
    screen: (x: number, y: number, z?: number) => Point,
    meter: (x: number, y: number) => number,
  ): void {
    const ctx = this.ctx;
    for (const { id, hp, maxHp } of health) {
      const feet = feetOf(id);
      if (!feet || maxHp <= 0) continue;
      const m = meter(feet.x, feet.y);
      const p = screen(feet.x, feet.y, BODY_HEIGHT + 0.12);
      const width = Math.max(30, m * 0.8);
      const height = Math.max(4, m * 0.07);
      const fraction = Math.max(0, Math.min(1, hp / maxHp));
      ctx.fillStyle = 'rgba(20, 12, 10, 0.75)';
      ctx.fillRect(p.x - width / 2 - 1, p.y - height - 1, width + 2, height + 2);
      ctx.fillStyle = fraction > 0.5 ? '#7bd389' : fraction > 0.25 ? '#f2c14e' : '#e5484d';
      ctx.fillRect(p.x - width / 2, p.y - height, width * fraction, height);
    }
  }

  private drawMarks(now: number, feetOf: (id: number) => Point | null, screen: (x: number, y: number, z?: number) => Point, meter: (x: number, y: number) => number): void {
    const ctx = this.ctx;
    for (const [id, mark] of this.marks) {
      const feet = feetOf(id);
      if (!feet) continue;
      const m = meter(feet.x, feet.y);
      // acima do nome, balançando de leve
      const p = screen(feet.x, feet.y, BODY_HEIGHT + 0.95 + 0.06 * Math.sin(now / 250));
      const r = Math.max(10, m * 0.2);
      ctx.fillStyle = mark === '?' ? '#f2c14e' : '#ffe08a';
      ctx.strokeStyle = 'rgba(40, 24, 10, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2b1d12';
      ctx.font = `800 ${Math.round(r * 1.4)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(mark, p.x, p.y + 1);
      ctx.textBaseline = 'alphabetic';
    }
  }

  private drawFloaters(now: number, feetOf: (id: number) => Point | null, screen: (x: number, y: number, z?: number) => Point, meter: (x: number, y: number) => number): void {
    const ctx = this.ctx;
    this.floaters = this.floaters.filter((floater) => now - floater.start < FLOAT_MS);
    // vários números em cima da mesma pessoa saem um pouco de lado, para não ficarem um em cima do outro
    const seen = new Map<number, number>();
    for (const floater of this.floaters) {
      const feet = feetOf(floater.id);
      if (!feet) continue;
      const t = (now - floater.start) / FLOAT_MS;
      const m = meter(feet.x, feet.y);
      const index = seen.get(floater.id) ?? 0;
      seen.set(floater.id, index + 1);
      // começa acima do nome (que a view desenha em cima da cabeça) e sobe
      const p = screen(feet.x, feet.y, BODY_HEIGHT + 0.7 + t * 0.6);
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      ctx.font = `700 ${Math.round(Math.max(13, m * 0.32))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20, 12, 10, 0.85)';
      const x = p.x + (index % 2 === 0 ? 1 : -1) * Math.ceil(index / 2) * m * 0.25;
      ctx.strokeText(floater.text, x, p.y);
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, x, p.y);
      ctx.globalAlpha = 1;
    }
  }
}
