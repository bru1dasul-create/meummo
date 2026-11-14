// Bichos de estimação e do ambiente (data/bichos.json): o Joaquim, o gato da vó, e as capivaras (pedidos do dono,
// 14/11). Não são monstros nem NPCs parados: andam sozinhos pela área deles, dormem (a capivara deita), o gato mia
// quando alguém chega e os dois gostam de carinho. Nunca são alvo (não estão na lista de monstros: a pedra, a flecha,
// a mira e o "derrubar" do menu ADM nem enxergam eles). Um bicho dos dados pode ser um bando (`quantidade`).
//
// O servidor decide tudo (igual para todo mundo que está vendo): onde ele está, se está dormindo, quando mia.
// O mapa diz onde ele dorme (ponto da camada `pontos`) e por onde anda (retângulo da camada `pontos`).

import { readFileSync } from 'node:fs';
import { DOWN, type Dir } from '../shared/dir';
import type { GameMap, MapRegion } from '../shared/map';
import { bodyFits, cornerAtFeet, dirOfDegrees, feetAt, walkSlice } from '../shared/movement';
import type { EntityState, FxKind } from '../shared/protocol';
import { Reader } from './data-reader';
import { PETS_FILE } from './paths';

const FILE = 'data/bichos.json';

export interface PetDef {
  id: string;
  /** O que é, para o desenho (ex.: 'joaquim', 'capivara'); sem o campo `tipo`, o próprio id. */
  type: string;
  /** Quantos (um bando de capivaras): cada um anda sozinho e eles dormem lado a lado. */
  count: number;
  /** Mora dentro de uma casa (o desenho provisório só mostra com você lá dentro: de fora, o telhado esconde). */
  indoor: boolean;
  name: string;
  /** O que ele é ("o gato da vó"); aparece embaixo do nome. */
  title: string;
  /** Id do mapa onde mora. */
  map: string;
  /** Nome do ponto (camada `pontos`) onde ele dorme (pode ser em cima de um móvel: ele pula). */
  bed: string;
  /** Nome do retângulo (camada `pontos`) por onde ele anda; ele nunca sai dele. */
  area: string;
  /** Metros por segundo andando. */
  speed: number;
  /** Quanto tempo dorme (segundos, mínimo e máximo). */
  sleepS: [number, number];
  /** Quantos lugares visita acordado antes de voltar a dormir. */
  walks: [number, number];
  /** Quanto fica parado em cada lugar (segundos). */
  restS: [number, number];
  /** Mia quando alguém chega a tantos metros (e espera tanto para miar de novo). 0 = não mia ("mia": false). */
  meowRange: number;
  meowEveryS: number;
  /** Dá para fazer carinho a tantos metros (e ele espera tanto entre um carinho e outro). 0 = não ("carinho": false). */
  petRange: number;
  petEveryS: number;
}

function pair(r: Reader, field: string, fallback: [number, number], min: number): [number, number] {
  if (!r.has(field)) return fallback;
  const value = r.range(field);
  if (value[0] < min) r.fail(field, `precisa começar em pelo menos ${min}`);
  return value;
}

export function parsePetDefs(json: unknown): Map<string, PetDef> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error(`Erro em ${FILE}: o arquivo precisa ser um objeto { "id-do-bicho": { ... } }.`);
  }
  const defs = new Map<string, PetDef>();
  for (const [rawId, raw] of Object.entries(json as Record<string, unknown>)) {
    const id = rawId.trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(id)) {
      throw new Error(`Erro em ${FILE}: o id "${rawId}" só pode ter letras sem acento, números, _ ou - (ex.: "joaquim").`);
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`Erro em ${FILE}: "${rawId}" precisa ser um objeto.`);
    const r = new Reader(raw as Record<string, unknown>, FILE, `bicho "${rawId}"`);
    const obj = raw as Record<string, unknown>;
    // "mia": false e "carinho": false desligam (a capivara não mia)
    const noMeow = obj.mia === false;
    const noPet = obj.carinho === false;
    const meow = new Reader(noMeow ? {} : (r.object('mia', true) ?? {}), FILE, `"mia" do bicho "${rawId}"`);
    const pet = new Reader(noPet ? {} : (r.object('carinho', true) ?? {}), FILE, `"carinho" do bicho "${rawId}"`);
    const count = r.number('quantidade', { min: 1, fallback: 1 });
    if (!Number.isInteger(count) || count > 8) r.fail('quantidade', 'precisa ser um número inteiro de 1 a 8');
    const type = (r.has('tipo') ? r.text('tipo') : id).trim().toLowerCase();
    const speed = r.number('velocidade', { min: 0.2, fallback: 0.8 });
    if (speed > 4) r.fail('velocidade', 'precisa ser no máximo 4 (metros por segundo)');
    const walks = pair(r, 'passeios', [3, 6], 0);
    if (!walks.every(Number.isInteger)) r.fail('passeios', 'precisa ser [mínimo, máximo] em números inteiros');
    defs.set(id, {
      id,
      type,
      count,
      indoor: r.bool('dentroDeCasa', true),
      name: r.text('nome'),
      title: r.optionalText('titulo'),
      map: r.text('mapa').toLowerCase(),
      bed: r.text('dorme').toLowerCase(),
      area: r.text('area').toLowerCase(),
      speed,
      sleepS: pair(r, 'sonoSegundos', [25, 50], 1),
      walks,
      restS: pair(r, 'paradaSegundos', [2, 6], 0),
      meowRange: noMeow ? 0 : meow.number('alcance', { min: 0.5, fallback: 2.5 }),
      meowEveryS: meow.number('esperaSegundos', { min: 1, fallback: 12 }),
      petRange: noPet ? 0 : pet.number('alcance', { min: 0.5, fallback: 1.6 }),
      petEveryS: pet.number('esperaSegundos', { min: 0.5, fallback: 2 }),
    });
  }
  return defs;
}

export function loadPetDefs(file = PETS_FILE): Map<string, PetDef> {
  return parsePetDefs(JSON.parse(readFileSync(file, 'utf8')));
}

/** O que ele está fazendo: dormindo, se espreguiçando, andando, parado (sentado) ou ganhando carinho. */
export type PetMode = 'sleep' | 'stretch' | 'walk' | 'rest';

/** Tempo da espreguiçada ao acordar, e de ficar quietinho ronronando depois de um carinho. */
const STRETCH_MS = 1600;
const PURR_MS = 3500;
/** Sem conseguir andar por tanto tempo (encostou num móvel de quina): desiste e escolhe outro lugar. */
const STUCK_MS = 800;
/** Margem da beirada da área (o pé não encosta na parede). */
const EDGE = 0.25;

/** Um bicho no mapa. A posição é "de canto", como a dos jogadores: o pé fica em feetAt(x, y). */
export class Pet {
  readonly kind = 'pet' as const;
  dir: Dir = DOWN;
  /** Andou neste passo do mundo (quem vê recebe a posição nova). */
  changed = false;
  /** Pulou (para a cama e de volta): quem vê anima um pulo em vez de andar. */
  dashed = false;
  mode: PetMode = 'sleep';
  /** Quando termina o que está fazendo (o sono, a espreguiçada, a parada). */
  until = 0;
  /** Para onde está andando (posição "de canto"); `home`: voltando para a cama. */
  private target: { x: number; y: number; home: boolean } | null = null;
  /** Quantos lugares ainda visita antes de voltar a dormir. */
  private walksLeft = 0;
  private stuckSince: number | null = null;
  private nextMeowAt = 0;
  private nextPetAt = 0;
  /** Quem já estava perto (só mia para quem chega). */
  private readonly near = new Set<number>();

  constructor(
    readonly id: number,
    readonly def: PetDef,
    /** Onde dorme e o chão livre ao lado de onde pula (posições "de canto"). */
    readonly bed: { x: number; y: number },
    readonly hop: { x: number; y: number },
    /** Por onde anda (o pé nunca sai daqui). */
    readonly area: MapRegion,
    public x: number,
    public y: number,
  ) {}

  get asleep(): boolean {
    return this.mode === 'sleep';
  }

  /** O pé, em metros. */
  feet(): { x: number; y: number } {
    return feetAt(this.x, this.y);
  }

  state(): EntityState {
    return {
      id: this.id,
      kind: 'pet',
      type: this.def.type,
      name: this.def.name,
      x: this.x,
      y: this.y,
      dir: this.dir,
      look: 0,
      level: 0,
      hp: 1,
      maxHp: 1,
      ...(this.def.indoor ? { home: this.def.area } : {}),
      ...(this.asleep ? { asleep: true as const } : {}),
    };
  }

  /**
   * Um passo do mundo. `players`: o pé de quem está no mapa (para miar). `fx`: avisa quem está vendo (miado,
   * acordou, dormiu); o ângulo diz para onde ele olha. Devolve true se mudou de posição.
   */
  update(
    now: number,
    dt: number,
    map: GameMap,
    random: () => number,
    players: Iterable<{ id: number; x: number; y: number }>,
    fx: (kind: FxKind, angle?: number) => void,
  ): void {
    this.meow(now, players, fx);
    switch (this.mode) {
      case 'sleep':
        if (now >= this.until) {
          this.mode = 'stretch';
          this.until = now + STRETCH_MS;
          fx('wake');
        }
        return;
      case 'stretch':
        if (now >= this.until) {
          this.jumpTo(this.hop);
          this.walksLeft = between(random, this.def.walks[0], this.def.walks[1], true);
          this.rest(now, 0.6);
        }
        return;
      case 'rest':
        if (now >= this.until) this.pickTarget(now, map, random);
        return;
      case 'walk':
        this.walk(now, dt, map, random, fx);
        return;
    }
  }

  /** Alguém fez carinho (já conferido que está perto): ronrona; acordado, fica quietinho olhando para a pessoa. */
  cuddle(now: number, from: { x: number; y: number }, fx: (kind: FxKind, angle?: number) => void): boolean {
    if (now < this.nextPetAt) return false;
    this.nextPetAt = now + this.def.petEveryS * 1000;
    const feet = this.feet();
    const angle = Math.atan2(from.y - feet.y, from.x - feet.x);
    if (!this.asleep && this.mode !== 'stretch') {
      this.face(angle);
      this.rest(now, PURR_MS / 1000);
    }
    fx('purr', angle);
    return true;
  }

  /** Mia (olhando para a pessoa) quando alguém chega perto, acordado, com uma espera entre um miado e outro. */
  private meow(now: number, players: Iterable<{ id: number; x: number; y: number }>, fx: (kind: FxKind, angle?: number) => void): void {
    if (this.def.meowRange <= 0) return; // não mia (a capivara)
    const feet = this.feet();
    let arrived: { x: number; y: number } | null = null;
    const still = new Set<number>();
    for (const p of players) {
      if (Math.hypot(p.x - feet.x, p.y - feet.y) > this.def.meowRange) continue;
      still.add(p.id);
      if (!this.near.has(p.id) && !arrived) arrived = p;
    }
    this.near.clear();
    for (const id of still) this.near.add(id);
    if (!arrived || this.asleep || now < this.nextMeowAt) return;
    this.nextMeowAt = now + this.def.meowEveryS * 1000;
    const angle = Math.atan2(arrived.y - feet.y, arrived.x - feet.x);
    if (this.mode !== 'walk') this.face(angle);
    fx('meow', angle);
  }

  private rest(now: number, seconds: number): void {
    this.mode = 'rest';
    this.target = null;
    this.until = now + seconds * 1000;
  }

  /** Escolhe um lugar livre da área para ir (ou volta para a cama, depois dos passeios). */
  private pickTarget(now: number, map: GameMap, random: () => number): void {
    if (this.walksLeft <= 0) {
      this.target = { ...this.hop, home: true };
    } else {
      this.walksLeft -= 1;
      let spot: { x: number; y: number } | null = null;
      for (let i = 0; i < 12 && !spot; i++) {
        const fx = this.area.x0 + EDGE + random() * Math.max(0, this.area.x1 - this.area.x0 - 2 * EDGE);
        const fy = this.area.y0 + EDGE + random() * Math.max(0, this.area.y1 - this.area.y0 - 2 * EDGE);
        const corner = cornerAtFeet(fx, fy);
        if (bodyFits(map, corner.x, corner.y)) spot = corner;
      }
      if (!spot) return this.rest(now, 1); // não achou lugar: tenta de novo daqui a pouco
      this.target = { ...spot, home: false };
    }
    this.mode = 'walk';
    this.stuckSince = null;
  }

  private walk(now: number, dt: number, map: GameMap, random: () => number, fx: (kind: FxKind, angle?: number) => void): void {
    const target = this.target;
    if (!target) return this.rest(now, 1);
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.05) return this.arrive(now, random, fx);
    const degrees = ((Math.round((Math.atan2(dy, dx) * 180) / Math.PI) % 360) + 360) % 360;
    const next = walkSlice(map, { x: this.x, y: this.y, dir: this.dir }, degrees, Math.min(distance, this.def.speed * dt));
    const feet = feetAt(next.x, next.y);
    if (next.moved && this.inside(feet)) {
      this.x = next.x;
      this.y = next.y;
      this.dir = next.dir;
      this.changed = true;
      this.stuckSince = null;
      return;
    }
    // encostou num móvel (ou na beirada da área): espera um pouco; se continuar preso, desiste
    this.stuckSince ??= now;
    if (now - this.stuckSince < STUCK_MS) return;
    if (target.home) {
      this.jumpTo(this.hop); // não deu para voltar andando: aparece ao lado da cama (raro: móvel de quina no caminho)
      return this.arrive(now, random, fx);
    }
    this.rest(now, 0.5);
  }

  private arrive(now: number, random: () => number, fx: (kind: FxKind, angle?: number) => void): void {
    if (this.target?.home) {
      this.target = null;
      this.jumpTo(this.bed);
      this.mode = 'sleep';
      this.until = now + between(random, this.def.sleepS[0], this.def.sleepS[1]) * 1000;
      fx('sleep');
      return;
    }
    this.rest(now, between(random, this.def.restS[0], this.def.restS[1]));
  }

  /** Pula para `spot` (a cama em cima do sofá, ou o chão ao lado): quem vê anima um pulo. */
  private jumpTo(spot: { x: number; y: number }): void {
    if (spot.x === this.x && spot.y === this.y) return;
    this.x = spot.x;
    this.y = spot.y;
    this.changed = true;
    this.dashed = true;
  }

  private face(angle: number): void {
    const degrees = ((Math.round((angle * 180) / Math.PI) % 360) + 360) % 360;
    this.dir = dirOfDegrees(degrees);
  }

  private inside(feet: { x: number; y: number }): boolean {
    const a = this.area;
    return feet.x >= a.x0 && feet.x <= a.x1 && feet.y >= a.y0 && feet.y <= a.y1;
  }
}

/** Número entre `min` e `max` (inteiro, se pedido). */
function between(random: () => number, min: number, max: number, whole = false): number {
  const value = min + random() * (max - min);
  return whole ? Math.round(value) : value;
}

/**
 * O lugar onde o bicho dorme e o chão livre mais perto dele (de onde ele pula), em posições "de canto". Num bando
 * (`index` 1, 2...), cada um dorme num lugar em volta do ponto, lado a lado. Se o lugar já é chão livre (a capivara
 * deita no chão), ele dorme ali mesmo, sem pular. Null se o mapa não tem o ponto, o retângulo, ou chão livre perto.
 */
export function petHome(map: GameMap, def: PetDef, index = 0): { bed: { x: number; y: number }; hop: { x: number; y: number }; area: MapRegion } | null {
  const spot = map.spots.get(def.bed);
  const area = map.regions.get(def.area);
  if (!spot || !area) return null;
  const inArea = (x: number, y: number) => x >= area.x0 + EDGE && x <= area.x1 - EDGE && y >= area.y0 + EDGE && y <= area.y1 - EDGE;
  // o bando dorme em roda: o primeiro no ponto, os outros a ~1 m dele
  const a0 = index === 0 ? 0 : ((index - 1) / Math.max(1, def.count - 1)) * Math.PI * 2 + Math.PI / 4;
  const center = index === 0 ? spot : { x: spot.x + Math.cos(a0) * 1.1, y: spot.y + Math.sin(a0) * 1.1 };
  const here = cornerAtFeet(center.x, center.y);
  if (inArea(center.x, center.y) && bodyFits(map, here.x, here.y)) return { bed: here, hop: here, area };
  const bed = index === 0 ? cornerAtFeet(spot.x, spot.y) : null;
  // o chão livre mais perto (procura em anéis de 0,3 m em volta)
  for (let radius = 0.3; radius <= 2.4; radius += 0.3) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const fx = center.x + Math.cos(a) * radius;
      const fy = center.y + Math.sin(a) * radius;
      if (!inArea(fx, fy)) continue;
      const corner = cornerAtFeet(fx, fy);
      if (bodyFits(map, corner.x, corner.y)) return { bed: bed ?? corner, hop: corner, area };
    }
  }
  return null;
}
