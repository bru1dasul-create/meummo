// O chão debaixo do pé e os passos (pedido do dono, 23/11: "colocar passos do boneco correndo"). O chão vem da camada
// `chao` do mapa do mundo novo (a do desenho do [mundo]: grama, terra, calçada, asfalto, lama...): retângulos, polígonos e
// caminhos com largura (`largura`, em metros). O que foi desenhado por último fica por cima. Cada tipo de chão vira um
// dos sons de passo gravados: terra (a grama, a trilha, a mata), pedra (a calçada, o asfalto, o piso) ou areia (a lama, a
// poça, a beira d'água).

import type { TiledMap, TiledObject } from '../../shared/map';

export type StepGround = 'terra' | 'pedra' | 'areia';

/** O som de passo de cada tipo de chão do mapa (o que não estiver aqui é terra). */
const GROUND_STEP: Readonly<Record<string, StepGround>> = {
  calcada: 'pedra',
  asfalto: 'pedra',
  piso: 'pedra',
  praca: 'pedra',
  pedra: 'pedra',
  'faixa-rua': 'pedra',
  faixa: 'pedra', // a faixa de pedestre, pintada no asfalto
  degrau: 'pedra', // a escada (o Morro do Escadão)
  entulho: 'pedra',
  // o chão da Caverna Sagrada (a rocha)
  caverna: 'pedra',
  'caverna-rocha': 'pedra',
  'meio-fio': 'pedra',
  bueiro: 'pedra',
  tampa: 'pedra',
  remendo: 'pedra',
  // o píer e o deque ficam por cima da água: o pé bate em coisa dura
  agua: 'pedra',
  lama: 'areia',
  poca: 'areia',
  areia: 'areia',
};

/** Os detalhes pintados por cima do chão (não mudam o som do passo: vale o chão de baixo). */
const DECORATION = new Set(['planta', 'rachadura', 'raiz', 'buraco']);

export function stepGroundOf(type: string | null): StepGround {
  return (type ? GROUND_STEP[type] : undefined) ?? 'terra';
}

interface Shape {
  type: string;
  contains(x: number, y: number): boolean;
}

function insidePolygon(points: { x: number; y: number }[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function nearPolyline(points: { x: number; y: number }[], x: number, y: number, half: number): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
    if (Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)) <= half) return true;
  }
  return false;
}

/** As formas da camada `chao`, em metros (1 tile = 1 metro), na ordem do desenho. */
function shapesOf(map: TiledMap): Shape[] {
  const layer = map.layers.find((l) => l.type === 'objectgroup' && l.name === 'chao');
  if (!layer?.objects) return [];
  const k = 1 / map.tilewidth;
  const shapes: Shape[] = [];
  for (const o of layer.objects as TiledObject[]) {
    const type = (o.type ?? o.class ?? '').toLowerCase();
    if (!type || DECORATION.has(type)) continue;
    const ox = o.x * k;
    const oy = o.y * k;
    if (o.polygon) {
      const points = o.polygon.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k }));
      shapes.push({ type, contains: (x, y) => insidePolygon(points, x, y) });
    } else if (o.polyline) {
      const points = o.polyline.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k }));
      const width = Number(o.properties?.find((p) => p.name === 'largura')?.value ?? 1);
      shapes.push({ type, contains: (x, y) => nearPolyline(points, x, y, Math.max(0.2, width / 2)) });
    } else if ((o.width ?? 0) > 0 && (o.height ?? 0) > 0) {
      const w = (o.width ?? 0) * k;
      const h = (o.height ?? 0) * k;
      shapes.push({ type, contains: (x, y) => x >= ox && x <= ox + w && y >= oy && y <= oy + h });
    }
  }
  return shapes;
}

/** O tipo de chão em (x, y) (metros): o da forma de cima que tem o ponto, ou null (fora de tudo). */
export class GroundMap {
  private readonly shapes: Shape[];

  constructor(map: TiledMap) {
    this.shapes = shapesOf(map);
  }

  typeAt(x: number, y: number): string | null {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const shape = this.shapes[i]!;
      if (shape.contains(x, y)) return shape.type;
    }
    return null;
  }

  stepAt(x: number, y: number): StepGround {
    return stepGroundOf(this.typeAt(x, y));
  }
}

/**
 * Quantos metros entre um passo e o próximo: maior correndo (a 4,5 m/s, um passo a cada ~0,25 s, o ritmo da gravação
 * que o dono mandou) e menor andando devagar.
 */
export function strideFor(speed: number): number {
  return 0.55 + 0.13 * Math.max(0, speed);
}

/**
 * Conta os passos de quem anda: a cada quadro, quanto o pé andou e a velocidade. Devolve true quando cai um passo
 * (o primeiro sai logo que começa a andar). Parado, no ar ou rolando, recomeça.
 */
export class StepCounter {
  private travelled = 0;
  private last: { x: number; y: number } | null = null;

  update(x: number, y: number, speed: number, onGround: boolean): boolean {
    const last = this.last;
    this.last = { x, y };
    if (!last || !onGround || speed < 0.3) {
      this.travelled = 0;
      return false;
    }
    const moved = Math.hypot(x - last.x, y - last.y);
    if (moved > 3) {
      this.travelled = 0; // pulou de lugar (chegou num mapa, foi levado): não é passo
      return false;
    }
    const stride = strideFor(speed);
    const before = this.travelled;
    this.travelled += moved;
    if (before === 0 && moved > 0) {
      this.travelled = moved;
      return true; // o primeiro passo sai logo
    }
    if (this.travelled >= stride) {
      this.travelled -= stride;
      return true;
    }
    return false;
  }

  reset(): void {
    this.travelled = 0;
    this.last = null;
  }
}
