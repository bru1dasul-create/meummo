// Desenho de cada tipo de equipamento (os parâmetros de cada item ficam em ../gearArt.ts).
// Tudo é desenhado preso aos ossos do quadro (Rig): cabeça, ombros, mãos, quadril. Por isso o
// equipamento acompanha sozinho cada animação e cada direção.

import { EQUIP_SLOTS } from '../../../shared/items';
import type { GearArt } from '../gearArt';
import type { BodyLook } from './body';
import type { DollGear } from './compose';
import { torsoNormal, torsoShape } from './shapes';
import { darken, material, type Material } from './palette';
import type { Rig } from './poses';
import { add, Canvas, cylinder, dirOf, lerp, perp, scale, sub, type Vec } from './raster';

/** Materiais do corpo já vestido (veja dressOf em compose.ts). */
export interface Dress {
  gear: DollGear;
  look: BodyLook;
  skin: Material;
  hair: Material;
  shirt: Material;
  sleeve: Material;
  /** Manga curta (o braço aparece do cotovelo para baixo... e um pouco acima). */
  shortSleeves: boolean;
  forearm: Material;
  hand: Material;
  pants: Material;
  shin: Material;
  foot: Material;
  belt: Material;
  buckle: Material;
  skirt: boolean;
  tallBoots: boolean;
  bootCuff?: Material;
  gloveCuff?: Material;
}

type Of<K extends GearArt['kind']> = Extract<GearArt, { kind: K }>;

function find<K extends GearArt['kind']>(d: Dress, kind: K): Of<K> | undefined {
  for (const slot of EQUIP_SLOTS) {
    const art = d.gear[slot];
    if (art?.kind === kind) return art as Of<K>;
  }
  return undefined;
}

// ======================= tronco: colete, armadura, colar =======================

export function drawBodyGear(cv: Canvas, r: Rig, d: Dress, layer: 'torso' | 'hips' | 'neck'): void {
  const vest = find(d, 'vest');
  const plate = find(d, 'plate');
  const necklace = find(d, 'necklace');
  const cape = find(d, 'cape');
  const c = r.chest;
  const top = r.neck[1] + 1.4;
  if (layer === 'torso' && vest) {
    const leather = material(vest.leather, 'leather');
    cv.part('vest');
    const shape = torsoShape(r);
    if (r.view === 'down') {
      // colete aberto na frente: dois painéis com a camisa aparecendo no meio
      const gap = 1.3;
      cv.polygon(shape, leather, { normal: torsoNormal(r), clip: (x, y) => Math.abs(x - c[0]) > gap + Math.max(0, (top + 5 - y) * 0.5) });
      if (vest.lacing) {
        for (let y = top + 5; y < r.pelvis[1] - 5; y += 2) {
          cv.dot(c[0] - 1, y, vest.lacing);
          cv.dot(c[0], y + 1, vest.lacing);
        }
      }
    } else if (r.view === 'side') {
      cv.polygon(shape, leather, { normal: torsoNormal(r), clip: (x) => x < c[0] + 3.4 });
    } else {
      cv.polygon(shape, leather, { normal: torsoNormal(r) });
    }
    if (vest.studs && r.view !== 'up') {
      for (const sx of r.view === 'down' ? [-4.6, 4.6] : [1.5]) cv.dot(c[0] + sx, top + 2, vest.studs);
    }
  }
  if (layer === 'torso' && plate) {
    const metal = material(plate.metal, 'metal');
    // peitoral: uma placa mais clara no meio do peito, com a junta da barriga
    cv.part('plate');
    const w = r.view === 'side' ? 3.6 : 5.2;
    const cx = r.view === 'side' ? c[0] + 1.3 : c[0];
    cv.ellipse([cx, c[1] - 0.6], w, 5.4, metal, { bias: 0.12 });
    cv.part('plate_seam');
    const seamY = c[1] + 4.6;
    cv.line([cx - w - 1, seamY], [cx + w + 1, seamY], metal.ramp[0]);
    if (plate.trim && r.view !== 'up') {
      cv.line([cx - w + 0.5, top + 0.3], [cx + w - 0.5, top + 0.3], plate.trim);
    }
    if (r.view === 'down') cv.line([cx, c[1] - 5], [cx, c[1] + 3.5], metal.ramp[4]);
  }
  if (layer === 'hips' && plate?.tassets) {
    const metal = material(plate.metal, 'metal');
    cv.part('tassets');
    const y = r.pelvis[1] - 2.2;
    const xs = r.view === 'side' ? [r.pelvis[0] + 1] : [r.pelvis[0] - 3.4, r.pelvis[0] + 3.4];
    for (const x of xs) {
      cv.polygon(
        [
          [x - 2.8, y],
          [x + 2.8, y],
          [x + 2.4, y + 5],
          [x - 2.4, y + 5],
        ],
        metal,
        { normal: (px, py) => cylinder((px - x) / 3.2, (py - y) / 8 - 0.3) },
      );
    }
  }
  if (layer === 'neck' && necklace && r.view !== 'up') {
    cv.part('necklace');
    const center: Vec = r.view === 'side' ? [c[0] + 2.6, top - 0.5] : [c[0], top - 1];
    const rx = r.view === 'side' ? 2.2 : 4.4;
    const pts: Vec[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (i / 12);
      pts.push([center[0] - Math.cos(a) * rx, center[1] + Math.sin(a) * 3.6]);
    }
    for (let i = 1; i < pts.length; i++) cv.line(pts[i - 1]!, pts[i]!, necklace.cord);
    const pend = material(necklace.pendant, 'cloth');
    const n = r.view === 'side' ? 1 : necklace.count;
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 6 : Math.round(3 + (i * 6) / Math.max(1, n - 1));
      const p = pts[k]!;
      cv.part('pendant');
      cv.capsule(add(p, [0, 0.5]), add(p, [0, 2.6]), 0.9, 0.4, pend);
    }
  }
  if (layer === 'neck' && cape?.clasp && r.view !== 'up') {
    cv.part('clasp');
    const m = material(cape.clasp, 'metal');
    const at: Vec = r.view === 'side' ? [c[0] + 2.8, top + 0.6] : [c[0], top + 0.4];
    cv.ellipse(at, 1.6, 1.4, m);
  }
}

/** Ombreiras (por cima dos braços). */
export function drawShoulderGear(cv: Canvas, r: Rig, d: Dress): void {
  const plate = find(d, 'plate');
  if (!plate?.pauldrons) return;
  const metal = material(plate.metal, 'metal');
  const shoulders = r.view === 'side' ? [r.shoulder.main] : [r.shoulder.main, r.shoulder.off];
  for (const s of shoulders) {
    cv.part('pauldron');
    const at = add(s, [0, 0.4]);
    cv.ellipse(at, r.view === 'side' ? 3.6 : 4.1, 3.3, metal, { clip: (_x, y) => y < at[1] + 2.4 });
    if (plate.trim) cv.line(add(at, [-3, 2]), add(at, [3, 2]), plate.trim);
  }
}

// ======================= capa =======================

export function drawBackGear(cv: Canvas, r: Rig, d: Dress, layer: 'behind' | 'over'): void {
  const cape = find(d, 'cape');
  if (!cape) return;
  if ((layer === 'over') !== (r.view === 'up')) return;
  const cloth = material(cape.color, 'cloth');
  const length = cape.length ?? 26;
  const sway = r.pose.cape;
  const top = r.shoulder.main[1] - 0.5;
  const bottom = top + length - sway * 0.4;
  let pts: Vec[];
  if (r.view === 'side') {
    const x = r.chest[0] - 3.2;
    pts = [
      [x + 1.5, top - 1.5],
      [x + 3.5, top + 2],
      [x + 1.5 - sway * 0.3, bottom - 1],
      [x - 7 - sway, bottom],
      [x - 4 - sway * 0.6, top + 8],
      [x - 1.5, top],
    ];
  } else {
    const cx = r.chest[0];
    const wTop = r.view === 'up' ? 8.3 : 8.8;
    const wBottom = (r.view === 'up' ? 10.8 : 11.6) + sway * 0.25;
    pts = [
      [cx - wTop, top],
      [cx + wTop, top],
      [cx + wBottom, bottom],
      [cx - wBottom, bottom],
    ];
  }
  cv.part('cape');
  const folds = (x: number, y: number, t: number) => {
    let tone = t + (Math.sin(x * 1.15 + y * 0.06) > 0.55 ? -1 : 0);
    if (y > bottom - 1.5) tone -= 1; // barra
    return tone;
  };
  cv.polygon(pts, cloth, { pattern: folds, bias: layer === 'behind' ? -0.15 : 0 });
  if (cape.trim) {
    for (let x = Math.min(...pts.map((p) => p[0])); x <= Math.max(...pts.map((p) => p[0])); x++) {
      if (cv.filled(Math.floor(x), Math.floor(bottom - 0.5))) cv.dot(x, bottom - 0.5, cape.trim);
    }
  }
  if (cape.leaves) {
    // folhas trançadas por cima (posições fixas: a capa não "ferve" entre um quadro e outro)
    cv.part('cape_leaves');
    const leaf = material(cape.leaves, 'leaf');
    for (let i = 0; i < 14; i++) {
      const fx = ((i * 37) % 17) / 17;
      const fy = ((i * 53) % 13) / 13;
      const minX = Math.min(...pts.map((p) => p[0]));
      const maxX = Math.max(...pts.map((p) => p[0]));
      const at: Vec = [minX + 1.5 + fx * (maxX - minX - 3), top + 3 + fy * (bottom - top - 6)];
      if (!cv.filled(Math.floor(at[0]), Math.floor(at[1]))) continue;
      cv.capsule(add(at, [-1.1, -0.8]), add(at, [1.1, 0.8]), 1, 0.6, leaf, { clip: (x, y) => cv.filled(Math.floor(x), Math.floor(y)) });
    }
  }
}

// ======================= cabeça =======================

export function drawHeadGear(cv: Canvas, r: Rig, d: Dress): void {
  const art = d.gear.head;
  if (!art) return;
  const h = r.head;
  const side = r.view === 'side';
  switch (art.kind) {
    case 'hat': {
      const straw = material(art.color, 'straw');
      const weave = (x: number, y: number, t: number) => ((Math.floor(x) + Math.floor(y) * 2) % 4 === 0 ? t - 1 : t);
      const brimY = h[1] - 3.4;
      cv.part('hat_brim');
      cv.ellipse([h[0] + (side ? 0.5 : 0), brimY], side ? art.brim * 0.88 : art.brim, side ? 2.2 : 2.7, straw, { pattern: weave });
      cv.part('hat_crown');
      const crownC: Vec = [h[0] + (side ? -0.6 : 0), brimY - art.crown * 0.55];
      cv.ellipse(crownC, 5.3, art.crown, straw, { pattern: weave, clip: (_x, y) => y < brimY + 0.4 });
      if (art.band) {
        cv.part('hat_band');
        cv.capsule([crownC[0] - 5, brimY - 0.9], [crownC[0] + 5, brimY - 0.9], 0.95, 0.95, material(art.band, 'cloth'));
      }
      break;
    }
    case 'cap': {
      const cloth = material(art.color, 'cloth');
      const tip = side ? -1 : r.view === 'up' ? -art.tip : art.tip;
      cv.part('cap');
      cv.ellipse([h[0], h[1] - 2.6], 7.4, 5.8, cloth, { clip: (_x, y) => y < h[1] - 0.3 });
      // ponta mole que cai para o lado
      const a: Vec = [h[0] + tip * 0.5, h[1] - 6.5];
      const b: Vec = [h[0] + tip * 2.6, h[1] - 11];
      const c: Vec = [h[0] + tip * 7, h[1] - 11.4];
      const e: Vec = [h[0] + tip * 9.4, h[1] - 8.6];
      cv.capsule(a, b, 4, 2.7, cloth);
      cv.capsule(b, c, 2.7, 1.7, cloth);
      cv.capsule(c, e, 1.7, 1.2, cloth);
      if (art.trim) {
        cv.part('cap_trim');
        cv.capsule([h[0] - 7.3, h[1] - 0.9], [h[0] + 7.3, h[1] - 0.9], 1.3, 1.3, material(art.trim, 'cloth'));
      }
      break;
    }
    case 'helmet': {
      const metal = material(art.metal, 'metal');
      const rim = material(art.rim ?? darken(art.metal, 0.75), 'metal');
      if (art.handle && r.view !== 'down') {
        cv.part('helmet_handle');
        const from: Vec = side ? [h[0] - 7.4, h[1] - 1] : [h[0] - 7.6, h[1] - 0.6];
        cv.capsule(from, add(from, [side ? -4.4 : -3.6, -0.6]), 1.05, 1.05, material(art.handle, 'wood'));
      }
      cv.part('helmet');
      cv.ellipse([h[0] + (side ? -0.3 : 0), h[1] - 2.3], 7.7, 6.7, metal, { clip: (_x, y) => y < h[1] + 0.8 });
      cv.part('helmet_rim');
      cv.capsule([h[0] - 7.8, h[1] + 0.4], [h[0] + 7.8, h[1] + 0.4], 1.25, 1.25, rim);
      if (art.noseGuard && r.view !== 'up') {
        cv.part('helmet_nose');
        const x = side ? h[0] + 6.6 : h[0];
        cv.capsule([x, h[1] + 0.6], [x + (side ? 0.3 : 0), h[1] + 4.2], 0.85, 0.75, metal);
      }
      if (art.handle && r.view === 'down') {
        cv.part('helmet_handle');
        cv.capsule([h[0] + 7.6, h[1] - 0.6], [h[0] + 11.2, h[1] - 0.2], 1.05, 1.05, material(art.handle, 'wood'));
      }
      if (art.crest) {
        cv.part('helmet_crest');
        const plume = material(art.crest, 'cloth');
        if (side) {
          cv.capsule([h[0] + 1.5, h[1] - 8.6], [h[0] - 4, h[1] - 9.4], 2.4, 2.2, plume);
          cv.capsule([h[0] - 4, h[1] - 9.4], [h[0] - 9.5, h[1] - 4], 2.2, 1.3, plume);
        } else {
          cv.capsule([h[0], h[1] - 8.4], [h[0], h[1] - 12], 2.4, 1.8, plume);
        }
      }
      break;
    }
  }
}

// ======================= escudo =======================

export function drawShield(cv: Canvas, r: Rig, d: Dress): void {
  const art = d.gear.offhand;
  if (art?.kind !== 'shield') return;
  const face = material(art.color, art.metal ? 'metal' : 'leather');
  const rim = material(art.rim ?? darken(art.color, 0.7), art.metal ? 'metal' : 'leather');
  const hand = r.hand.off;
  cv.part('shield');
  if (r.view === 'side') {
    // de perfil: uma lente fina na frente do corpo
    const c = add(hand, [3.4, -2.2]);
    cv.ellipse(c, 2, 6.8, rim);
    cv.ellipse(add(c, [0.6, 0]), 1.1, 6.1, face);
    return;
  }
  const c = add(hand, [r.view === 'down' ? 1.2 : -1.2, -1.8]);
  const rx = art.shape === 'shell' ? 5.9 : 6.1;
  const ry = art.shape === 'shell' ? 6.9 : 6.3;
  if (r.view === 'up') {
    // de costas vemos o lado de dentro, com a alça
    cv.ellipse(c, rx, ry, rim, { bias: -0.2 });
    cv.ellipse(c, rx - 1.3, ry - 1.3, face, { bias: -0.45 });
    cv.part('shield_strap');
    cv.capsule(add(c, [-3, -1.5]), add(c, [3, 1.5]), 0.9, 0.9, material('#6b4423', 'leather'));
    return;
  }
  if (art.shape === 'kite') {
    const pts: Vec[] = [add(c, [-5.6, -5.6]), add(c, [5.6, -5.6]), add(c, [5, 1]), add(c, [0, 7.4]), add(c, [-5, 1])];
    cv.polygon(pts, rim);
    cv.polygon(
      pts.map((p) => lerp(c, p, 0.8)),
      face,
    );
  } else {
    cv.ellipse(c, rx, ry, rim);
    cv.ellipse(c, rx - 1.2, ry - 1.2, face);
  }
  cv.part('shield_pattern');
  const inside = (x: number, y: number) => ((x - c[0]) / (rx - 1.4)) ** 2 + ((y - c[1]) / (ry - 1.4)) ** 2 <= 1;
  if (art.pattern === 'grate') {
    for (let y = Math.ceil(c[1] - ry); y <= c[1] + ry; y++) {
      for (let x = Math.ceil(c[0] - rx); x <= c[0] + rx; x++) {
        if (!inside(x + 0.5, y + 0.5)) continue;
        if ((x - Math.floor(c[0])) % 3 === 0 || (y - Math.floor(c[1])) % 3 === 0) cv.dot(x, y, face.ramp[0]);
      }
    }
  } else if (art.pattern === 'hex') {
    // casco de jabuti: um hexágono no meio e "raios" até a borda
    const hex: Vec[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      hex.push([c[0] + Math.cos(a) * 2.8, c[1] + Math.sin(a) * 3.2]);
    }
    for (let i = 0; i < 6; i++) {
      cv.line(hex[i]!, hex[(i + 1) % 6]!, face.ramp[0]);
      const out = lerp(c, hex[i]!, 2.05);
      if (inside(out[0], out[1])) cv.line(hex[i]!, out, face.ramp[0]);
    }
  } else if (art.pattern === 'cross') {
    cv.line(add(c, [0, -(ry - 1.5)]), add(c, [0, ry - 1.5]), art.boss ?? face.ramp[4]);
    cv.line(add(c, [-(rx - 1.5), 0]), add(c, [rx - 1.5, 0]), art.boss ?? face.ramp[4]);
  }
  if (art.boss) {
    cv.part('shield_boss');
    cv.ellipse(c, 1.8, 1.8, material(art.boss, 'metal'));
  }
}

// ======================= armas =======================

/** Rastro claro do golpe (arco em volta do ombro). */
function drawSmear(cv: Canvas, r: Rig, reach: number): void {
  const smear = r.pose.smear;
  if (!smear) return;
  const [from, to] = smear;
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  cv.part('smear');
  const center = r.shoulder.main;
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const a0 = from + (delta * i) / steps;
    const a1 = from + (delta * (i + 1)) / steps;
    // fino nas pontas e mais grosso no meio, como um risco de pincel
    const w = 0.45 + 0.75 * Math.sin((Math.PI * (i + 0.5)) / steps);
    const p0 = add(center, scale(dirOf(a0), reach));
    const p1 = add(center, scale(dirOf(a1), reach));
    cv.capsule(p0, p1, w, w, { ramp: ['#f6e7b0', '#f6e7b0', '#fff3c9', '#fffbe8', '#fffbe8'], shiny: false });
  }
}

export function drawWeapon(cv: Canvas, r: Rig, d: Dress): void {
  const art = d.gear.weapon;
  const pose = r.pose;
  const h = r.hand.main;
  if (!art) {
    drawSmear(cv, r, 9);
    return;
  }
  switch (art.kind) {
    case 'blade': {
      drawSmear(cv, r, 9 + art.length * 0.6);
      const dir = dirOf(pose.blade);
      const p = perp(dir);
      const steel = material(art.steel, 'metal');
      const guard = material(art.guard ?? '#c9a062', 'leather');
      cv.part('weapon_grip');
      cv.capsule(add(h, scale(dir, -3.2)), add(h, scale(dir, 1.6)), 1.05, 1.05, material(art.grip, 'leather'));
      cv.ellipse(add(h, scale(dir, -3.6)), 1.25, 1.25, guard);
      cv.part('weapon_blade');
      const base = add(h, scale(dir, 2.6));
      const tip = add(base, scale(dir, art.length));
      const w = art.width;
      const pts: Vec[] = art.curve
        ? [
            add(base, scale(p, -w * 0.45)),
            add(base, scale(p, w * 0.45)),
            add(lerp(base, tip, 0.72), scale(p, w * 0.75)),
            add(tip, scale(p, w * 0.35)),
            add(lerp(base, tip, 0.86), scale(p, -w * 0.45)),
          ]
        : [add(base, scale(p, -w * 0.5)), add(base, scale(p, w * 0.5)), add(lerp(base, tip, 0.85), scale(p, w * 0.5)), tip, add(lerp(base, tip, 0.85), scale(p, -w * 0.5))];
      cv.polygon(pts, steel, {
        normal: (x, y) => {
          const u = ((x - base[0]) * p[0] + (y - base[1]) * p[1]) / (w * 0.8);
          const k = Math.max(-1, Math.min(1, u));
          return [p[0] * k, p[1] * k, Math.sqrt(1 - k * k)];
        },
      });
      cv.line(add(base, scale(p, w * 0.15)), add(lerp(base, tip, 0.8), scale(p, w * 0.25)), steel.ramp[4]);
      cv.part('weapon_guard');
      cv.capsule(add(base, scale(p, -2.8)), add(base, scale(p, 2.8)), 0.95, 0.95, guard);
      break;
    }
    case 'axe': {
      drawSmear(cv, r, 9 + art.length * 0.6);
      const dir = dirOf(pose.blade);
      const p = perp(dir);
      cv.part('weapon_grip');
      const end = add(h, scale(dir, art.length - 1));
      cv.capsule(add(h, scale(dir, -3)), end, 1.15, 1.05, material(art.handle, 'wood'));
      cv.part('weapon_head');
      const a = add(h, scale(dir, art.length - 4.5));
      const b = add(h, scale(dir, art.length + 0.4));
      const stone = material(art.head, 'metal');
      cv.polygon([a, b, add(add(b, scale(p, 5.6)), scale(dir, 1.2)), add(add(a, scale(p, 5.6)), scale(dir, -1.8))], stone, {
        normal: (x, y) => {
          const u = ((x - a[0]) * p[0] + (y - a[1]) * p[1]) / 5.6;
          return cylinder(u * 1.4 - 0.4);
        },
      });
      cv.line(add(add(b, scale(p, 5.4)), scale(dir, 0.9)), add(add(a, scale(p, 5.4)), scale(dir, -1.5)), stone.ramp[4]);
      if (art.binding) {
        cv.part('weapon_binding');
        cv.capsule(add(a, scale(dir, -0.6)), add(a, scale(dir, 1.2)), 1.4, 1.4, material(art.binding, 'cloth'));
      }
      break;
    }
    case 'bow': {
      const dir = dirOf(pose.bow);
      const u = perp(dir);
      const wood = material(art.wood, 'wood');
      const curve = (s: number): Vec => add(add(h, scale(u, s * art.size)), scale(dir, -2.2 * s * s));
      const tipA = curve(-1);
      const tipB = curve(1);
      const pull = pose.draw > 0 ? lerp(lerp(tipA, tipB, 0.5), r.hand.off, pose.draw) : lerp(tipA, tipB, 0.5);
      cv.part('weapon_string');
      cv.line(tipA, pull, art.string);
      cv.line(pull, tipB, art.string);
      cv.part('weapon_bow');
      for (let i = 0; i < 10; i++) {
        const s0 = -1 + (i * 2) / 10;
        const s1 = -1 + ((i + 1) * 2) / 10;
        const rad = 1.25 - Math.abs(s0 + s1) * 0.22;
        cv.capsule(curve(s0), curve(s1), rad, rad, wood);
      }
      if (pose.draw > 0.3) {
        cv.part('weapon_arrow');
        const head = add(h, scale(dir, 4.8));
        cv.line(pull, head, '#7a4a22');
        cv.capsule(head, add(head, scale(dir, 1.8)), 1, 0.3, material('#c8d0d6', 'metal'));
        cv.dot(pull[0] - dir[0], pull[1] - dir[1], '#d64545');
      }
      break;
    }
    case 'sling': {
      drawSmear(cv, r, 10);
      const dir = dirOf(pose.blade);
      const p = perp(dir);
      const wood = material(art.wood, 'wood');
      cv.part('weapon_grip');
      cv.capsule(add(h, scale(dir, -3.2)), add(h, scale(dir, 1.8)), 1.2, 1.1, wood);
      const fork = add(h, scale(dir, 1.8));
      const left = add(add(fork, scale(dir, 3.6)), scale(p, -2.6));
      const right = add(add(fork, scale(dir, 3.6)), scale(p, 2.6));
      cv.capsule(fork, left, 1, 0.85, wood);
      cv.capsule(fork, right, 1, 0.85, wood);
      cv.part('weapon_band');
      const pull = pose.draw > 0 ? lerp(lerp(left, right, 0.5), r.hand.off, pose.draw) : lerp(left, right, 0.5);
      cv.line(left, pull, art.band);
      cv.line(pull, right, art.band);
      break;
    }
    default:
      break;
  }
}

/** Para os testes e para o ícone: vetor da mão até a ponta da arma neste quadro. */
export function weaponReach(r: Rig, art: GearArt): Vec {
  const dir = dirOf(art.kind === 'bow' ? r.pose.bow : r.pose.blade);
  const length = art.kind === 'blade' || art.kind === 'axe' ? art.length : 5;
  return sub(add(r.hand.main, scale(dir, length)), r.hand.main);
}
