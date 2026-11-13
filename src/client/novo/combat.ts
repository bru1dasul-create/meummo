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

import { CHARGE_FULL_MS, SHOT_FEET_DY } from '../../shared/constants';
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
/** Quanto tempo o "carga perdida" fica na tela. */
const CHARGE_LOST_MS = 1100;
const FLASH_MS = 260;
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
  /** Puxando o estilingue: de quem e desde quando (o anel em volta do pé enche até a carga cheia). */
  private chargeRing: { id: number; since: number } | null = null;
  /** Um golpe soltou a pedra: o aviso "carga perdida" embaixo do pé, onde o anel estava. */
  private chargeLost: { id: number; start: number } | null = null;
  /** Sinais de missão em cima dos NPCs ('!' nova, '?' para concluir). */
  private readonly marks = new Map<number, '!' | '?'>();
  /** Quem está preparando um golpe (anel laranja no pé), até quando. */
  private readonly windups = new Map<number, { start: number; until: number }>();
  private readonly drops = new Map<number, GroundDrop>();

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'combate-novo';
    this.canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    container.append(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
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
  myShot(cid: number, x: number, y: number, angle: number, speed: number, range: number, now: number): void {
    this.myShots.set(cid, { x, y, dx: Math.cos(angle), dy: Math.sin(angle), speed, range, start: now, kind: 'pedra', fromMonster: false });
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
  setCharge(id: number, since: number | null): void {
    this.chargeRing = since === null ? null : { id, since };
    if (since !== null) this.chargeLost = null;
  }

  /** Um golpe soltou a pedra que `id` puxava: some o anel e aparece "carga perdida" no lugar. */
  loseCharge(id: number, now: number): void {
    this.chargeRing = null;
    this.chargeLost = { id, start: now };
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
    this.chargeLost = null;
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
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const screen = (x: number, y: number, z = 0) => view.toScreen(x, y, z);
    // quantos pixels tem 1 metro de altura aqui (para o tamanho das coisas acompanhar o zoom)
    const meter = (x: number, y: number) => Math.max(8, Math.abs(screen(x, y, 0).y - screen(x, y, 1).y));

    this.drawWarnings(now, screen);
    this.drawWindups(now, feetOf, screen);
    this.drawChargeRing(now, feetOf, screen);
    this.drawChargeLost(now, feetOf, screen, meter);
    this.drawDrops(now, screen, meter);
    this.drawFlashes(now, screen);
    this.drawPoofs(now, screen, meter);
    this.drawShots(now, screen, meter);
    this.drawBars(feetOf, health, screen, meter);
    this.drawMarks(now, feetOf, screen, meter);
    this.drawFloaters(now, feetOf, screen, meter);
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
    const progress = Math.min(1, (now - ring.since) / CHARGE_FULL_MS);
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

  private drawChargeLost(now: number, feetOf: (id: number) => Point | null, screen: (x: number, y: number, z?: number) => Point, meter: (x: number, y: number) => number): void {
    const lost = this.chargeLost;
    if (!lost) return;
    const t = (now - lost.start) / CHARGE_LOST_MS;
    const feet = t < 1 ? feetOf(lost.id) : null;
    if (!feet) {
      if (t >= 1) this.chargeLost = null;
      return;
    }
    const ctx = this.ctx;
    // logo abaixo de onde o anel estava (o ponto mais baixo dele na tela)
    let bottom = -Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      bottom = Math.max(bottom, screen(feet.x + Math.cos(a) * CHARGE_RING_RADIUS, feet.y + Math.sin(a) * CHARGE_RING_RADIUS).y);
    }
    const center = screen(feet.x, feet.y);
    const size = Math.round(Math.max(12, meter(feet.x, feet.y) * 0.22));
    ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20, 12, 10, 0.85)';
    ctx.strokeText('carga perdida', center.x, bottom + size + 2);
    ctx.fillStyle = '#efe3c6';
    ctx.fillText('carga perdida', center.x, bottom + size + 2);
    ctx.globalAlpha = 1;
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
