// Cores do personagem: cada material (pele, tecido, couro, metal...) vira uma "rampa" de 5 tons, do mais
// escuro ao brilho. As sombras puxam para o roxo/azul e os brilhos para o amarelo, como os pixel artists
// fazem à mão — é isso que deixa o volume com cara de desenho, e não de filtro escuro.

export type Ramp = readonly [string, string, string, string, string];

export type MaterialKind = 'cloth' | 'skin' | 'hair' | 'leather' | 'metal' | 'wood' | 'straw' | 'leaf';

export interface Material {
  ramp: Ramp;
  /** Metal: brilho mais forte e mais contraste. */
  shiny: boolean;
}

export function hexToHsl(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1, 7), 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

/** Gira o matiz `h` em direção a `target` no máximo `amount` graus (pelo caminho mais curto). */
function towards(h: number, target: number, amount: number): number {
  const diff = ((target - h + 540) % 360) - 180;
  return h + Math.sign(diff) * Math.min(Math.abs(diff), amount);
}

const SETTINGS: Record<MaterialKind, { step: number; shadowHue: number; hueShift: number; shiny: boolean }> = {
  cloth: { step: 0.085, shadowHue: 255, hueShift: 9, shiny: false },
  skin: { step: 0.068, shadowHue: 15, hueShift: 4, shiny: false },
  hair: { step: 0.09, shadowHue: 265, hueShift: 8, shiny: false },
  leather: { step: 0.08, shadowHue: 280, hueShift: 8, shiny: false },
  metal: { step: 0.13, shadowHue: 235, hueShift: 6, shiny: true },
  wood: { step: 0.08, shadowHue: 285, hueShift: 8, shiny: false },
  straw: { step: 0.085, shadowHue: 15, hueShift: 10, shiny: false },
  leaf: { step: 0.09, shadowHue: 200, hueShift: 10, shiny: false },
};

/** Rampa de 5 tons a partir da cor do meio (índice 2). */
export function ramp(base: string, kind: MaterialKind = 'cloth'): Ramp {
  const [h, s, l] = hexToHsl(base);
  const { step, shadowHue, hueShift } = SETTINGS[kind];
  const tone = (k: number): string => {
    if (k === 0) return base;
    const hue = k < 0 ? towards(h, shadowHue, hueShift * -k) : towards(h, 55, hueShift * k * 0.8);
    const light = k < 0 ? l + k * step : l + k * step * (kind === 'metal' ? 1.25 : 0.9);
    const sat = k < 0 ? s + 0.04 * -k : s - 0.05 * k;
    return hslToHex(hue, sat, light);
  };
  return [tone(-2), tone(-1), base, tone(1), tone(2)];
}

const materials = new Map<string, Material>();

export function material(base: string, kind: MaterialKind = 'cloth'): Material {
  const key = `${base}|${kind}`;
  let found = materials.get(key);
  if (!found) {
    found = { ramp: ramp(base, kind), shiny: SETTINGS[kind].shiny };
    materials.set(key, found);
  }
  return found;
}

const darkened = new Map<number, Map<string, string>>();

/** Escurece uma cor (contornos), puxando para o roxo. */
export function darken(hex: string, factor: number): string {
  let byColor = darkened.get(factor);
  if (!byColor) darkened.set(factor, (byColor = new Map()));
  let found = byColor.get(hex);
  if (!found) {
    const [h, s, l] = hexToHsl(hex);
    found = hslToHex(towards(h, 265, 25), Math.min(1, s * 0.9 + 0.1), l * factor);
    byColor.set(hex, found);
  }
  return found;
}
