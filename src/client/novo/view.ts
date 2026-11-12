// O desenho do jogo 2.5D. O motor (engine.ts) só fala com esta interface; quem desenha de verdade é a [arte]
// (o "PD.View" do protótipo). Enquanto ele não fica pronto, a ProvisionalView desenha o básico: o chão do mapa, as
// caixas de colisão e os personagens como bonecos simples, numa câmera isométrica.
//
// Tudo em METROS, no chão: x para o leste, y para o sul (como o servidor). As posições são do PÉ do personagem.

import type { TiledMap, TiledObject } from '../../shared/map';

export interface ActorInfo {
  kind: 'player' | 'npc' | 'monster';
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
  /** Ponto no chão (metros) → tela (pixels). */
  toScreen(x: number, y: number): { x: number; y: number };
  /** Uma direção na tela (ex.: "para cima") vira qual direção no chão? (Teclado e joystick andam pela tela.) */
  groundDirOfScreen(dx: number, dy: number): { x: number; y: number };
  destroy(): void;
}

// ======================= desenho provisório =======================

/** Uma forma do mapa, em metros: retângulo, elipse (dentro da caixa), polígono ou linha com largura (trilha). */
interface Shape {
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
}

/** Objeto do Tiled → forma em metros. */
function shapeOf(o: TiledObject, px: number): Shape {
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
  return { x0: o.x / px, y0: o.y / px, x1: (o.x + (o.width ?? 0)) / px, y1: (o.y + (o.height ?? 0)) / px, kind, ellipse: o.ellipse === true };
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
}

/** Cores do chão por tipo (camada `chao` do mapa). */
const GROUND: Record<string, string> = {
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
};
/** Coisas da camada `colisao` que ficam no nível do chão (não viram caixa): a beira da água. */
const FLAT: Record<string, string> = { agua: 'rgba(47, 111, 159, 0.85)' };
/** Altura (metros) de cada tipo de coisa que bloqueia (camada `colisao`). */
const HEIGHT: Record<string, number> = { tronco: 1.6, poste: 3, pedra: 0.5, gradil: 1, portao: 2.2, pilar: 2.6, 'mata-fechada': 2.5, 'tronco-caido': 0.6 };
const ACTOR_COLORS = { me: '#f2c14e', player: '#6fa8ff', npc: '#7bd389', monster: '#ff6b6b' };

const typeOf = (o: { type?: string; class?: string }) => o.type || o.class || '';

export class ProvisionalView implements WorldView {
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
  private camX = 0;
  private camY = 0;
  /** Pixels por metro (muda com o tamanho da tela). */
  private scale = 40;
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
          const copa = (o.properties?.find((p) => p.name === 'copa')?.value as number | undefined) ?? 3;
          this.canopies.push({ x: o.x / px, y: o.y / px, r: copa / 2 });
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

  toScreen(x: number, y: number): { x: number; y: number } {
    const s = this.scale;
    return { x: (x - y - (this.camX - this.camY)) * s * 0.866 + this.canvas.clientWidth / 2, y: (x + y - (this.camX + this.camY)) * s * 0.5 + this.canvas.clientHeight / 2 };
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
    const target = this.followId !== null ? this.actors.get(this.followId) : undefined;
    if (target) {
      const at = this.position(target, now);
      // câmera acompanha macio
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
      if (this.onScreen((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, w, h)) items.push({ depth: s.x1 + s.y1, draw: () => this.drawBox(s, HEIGHT[s.kind] ?? 1.2) });
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
    this.scale = Math.max(22, Math.min(70, Math.min(w / 16, h / 10)));
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
    const p = this.toScreen(x, y);
    const s = this.scale;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s * 0.32, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    const color = a.me ? ACTOR_COLORS.me : ACTOR_COLORS[a.kind];
    const height = s * 1.5;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(p.x - s * 0.22, p.y - height, s * 0.44, height, s * 0.2);
    ctx.fill();
    ctx.stroke();
    // para onde olha: um tracinho no chão
    const look = { x: Math.cos((a.angle * Math.PI) / 180), y: Math.sin((a.angle * Math.PI) / 180) };
    const tip = this.toScreen(x + look.x * 0.5, y + look.y * 0.5);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
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
