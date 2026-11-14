// Teclas do jogo 2.5D: cada ação tem a sua tecla, e o jogador troca na janela das teclas (fica guardado neste
// aparelho). O padrão é o do dono (14/11): esquiva no Shift, pulo no Espaço e o mapa no M (o som saiu do M: liga e
// desliga no painel do som, ou numa tecla que o jogador escolher).
//
// As teclas são as de `KeyboardEvent.code` (a posição no teclado, igual em qualquer idioma). As que têm duas (Shift
// da esquerda e da direita) contam como uma só. Algumas ficam fixas (andar, conversar, zoom, os números da barra):
// essas não podem ser escolhidas para outra ação.

export type KeyAction = 'esquiva' | 'pular' | 'atirar' | 'defesa' | 'golpe' | 'folego' | 'mochila' | 'mapa' | 'devagar' | 'som';

export interface KeyActionInfo {
  action: KeyAction;
  label: string;
}

/** As ações que o jogador pode trocar de tecla, na ordem da janela. */
export const KEY_ACTIONS: readonly KeyActionInfo[] = [
  { action: 'esquiva', label: 'Esquiva' },
  { action: 'pular', label: 'Pular' },
  { action: 'atirar', label: 'Atirar (segure para puxar)' },
  { action: 'defesa', label: 'Defesa (segure)' },
  { action: 'golpe', label: 'Bordunada' },
  { action: 'folego', label: 'Fôlego' },
  { action: 'mochila', label: 'Mochila' },
  { action: 'mapa', label: 'Mapa' },
  { action: 'devagar', label: 'Andar devagar (liga e desliga)' },
  { action: 'som', label: 'Ligar e desligar o som' },
];

/** A tecla de uma ação: o código (`KeyboardEvent.code`, já sem esquerda/direita) e o nome que aparece. '' = sem tecla. */
export interface KeyBinding {
  code: string;
  label: string;
}

const DEFAULTS: Record<KeyAction, string> = {
  esquiva: 'Shift',
  pular: 'Space',
  atirar: 'KeyJ',
  defesa: 'KeyF',
  golpe: 'KeyQ',
  folego: 'KeyE',
  mochila: 'KeyI',
  mapa: 'KeyM',
  devagar: 'KeyC',
  som: '',
};

/** Fixas: andar (WASD e setas), conversar (Enter), fechar (Esc), zoom (- e +), os números da barra e o menu ADM (G). */
const FIXED = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Enter', 'NumpadEnter', 'Escape',
  'Minus', 'Equal', 'NumpadAdd', 'NumpadSubtract',
  'Digit1', 'Digit2', 'Digit3', 'Digit4',
  'KeyG',
]);

/**
 * Que não servem para jogar: Ctrl e Alt (Ctrl + W fecha a aba do navegador; Alt mexe no menu dele), a tecla do
 * Windows/Command, Caps Lock (no Mac só avisa quando liga), as F1 a F12 (F5 recarrega a página) e as de sistema.
 */
const REFUSED = /^(Control|Alt|Meta|OS|CapsLock|NumLock|ScrollLock|Fn|F\d+|ContextMenu|PrintScreen|Pause|Unidentified|Lang\d|Kana|Convert|NonConvert|Browser|Audio|Media|Launch)/;

const NAMES: Record<string, string> = {
  Shift: 'Shift',
  Space: 'Espaço',
  Tab: 'Tab',
  Backspace: 'Apagar',
  Insert: 'Insert',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Backquote: "'",
  BracketLeft: '´',
  BracketRight: '[',
  Backslash: ']',
  Semicolon: 'Ç',
  Quote: '~',
  Comma: ',',
  Period: '.',
  Slash: ';',
  IntlBackslash: '\\',
  IntlRo: '/',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num ,',
  NumpadComma: 'Num .',
};

/** Shift da esquerda e da direita contam como uma tecla só. */
export function normalizeCode(code: string): string {
  return code === 'ShiftLeft' || code === 'ShiftRight' ? 'Shift' : code;
}

/** Pontuação: muda de lugar de um teclado para outro (os nomes acima são os do teclado brasileiro, ABNT2). */
const PUNCTUATION = new Set(['Backquote', 'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'IntlBackslash', 'IntlRo']);

/**
 * O nome da tecla para mostrar. `key` é o `KeyboardEvent.key` do aperto, quando houver: na pontuação vale o que a
 * tecla escreveu (o teclado pode não ser o brasileiro); sem ele, ou num acento (´ e ~ não escrevem sozinhos), o ABNT2.
 */
export function keyName(code: string, key?: string): string {
  if (!code) return '—';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
  if (PUNCTUATION.has(code) && key && key.length === 1 && key !== ' ') return key.toUpperCase();
  return NAMES[code] ?? code;
}

/** Por que não dá para usar esta tecla (texto para o jogador), ou null se dá. */
export function refusalOf(code: string): string | null {
  const c = normalizeCode(code);
  if (FIXED.has(c)) {
    if (/^(Key[WASD]|Arrow)/.test(c)) return 'Essa tecla é do andar.';
    return 'Essa tecla já é fixa no jogo.';
  }
  if (REFUSED.test(c)) return 'Essa tecla não serve para jogar (o navegador ou o sistema usam).';
  return null;
}

/** Onde as teclas ficam guardadas (neste aparelho). */
export const KEYS_STORAGE = 'meummo:teclas';

interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class KeyBindings {
  private readonly keys = new Map<KeyAction, KeyBinding>();

  constructor(private readonly store: KeyStore | null = safeLocalStorage()) {
    this.reset(false);
    this.load();
  }

  /** A ação desta tecla (o código do aperto), ou null. */
  actionOf(code: string): KeyAction | null {
    const c = normalizeCode(code);
    for (const [action, b] of this.keys) if (b.code && b.code === c) return action;
    return null;
  }

  /** A tecla desta ação. */
  get(action: KeyAction): KeyBinding {
    return this.keys.get(action) ?? { code: '', label: '—' };
  }

  /** O nome da tecla desta ação ('—' sem tecla). */
  label(action: KeyAction): string {
    return this.get(action).label;
  }

  /**
   * Põe esta tecla nesta ação. Se outra ação usava a tecla, as duas trocam (a outra fica com a tecla antiga desta).
   * Devolve o motivo, se a tecla não puder ser usada (e aí nada muda).
   */
  set(action: KeyAction, code: string, key?: string, save = true): string | null {
    const c = normalizeCode(code);
    const refused = refusalOf(c);
    if (refused) return refused;
    const before = this.get(action);
    const other = this.actionOf(c);
    if (other && other !== action) this.keys.set(other, before.code ? before : { code: '', label: '—' });
    this.keys.set(action, { code: c, label: keyName(c, key) });
    if (save) this.save();
    return null;
  }

  /** Tira a tecla desta ação (fica sem). */
  clear(action: KeyAction): void {
    this.keys.set(action, { code: '', label: '—' });
    this.save();
  }

  /** Volta tudo para o padrão. */
  reset(save = true): void {
    for (const { action } of KEY_ACTIONS) {
      const code = DEFAULTS[action];
      this.keys.set(action, { code, label: keyName(code) });
    }
    if (save) {
      try {
        this.store?.removeItem(KEYS_STORAGE);
      } catch {
        // sem armazenamento: vale só nesta visita
      }
    }
  }

  /** Está tudo no padrão? */
  isDefault(): boolean {
    return KEY_ACTIONS.every(({ action }) => this.get(action).code === DEFAULTS[action]);
  }

  private save(): void {
    if (!this.store) return;
    const out: Record<string, KeyBinding> = {};
    for (const { action } of KEY_ACTIONS) {
      const b = this.get(action);
      if (b.code !== DEFAULTS[action]) out[action] = b;
    }
    try {
      if (Object.keys(out).length === 0) this.store.removeItem(KEYS_STORAGE);
      else this.store.setItem(KEYS_STORAGE, JSON.stringify(out));
    } catch {
      // sem armazenamento: vale só nesta visita
    }
  }

  /** Lê o que o jogador escolheu (o que estiver estranho fica no padrão). */
  private load(): void {
    let raw: string | null = null;
    try {
      raw = this.store?.getItem(KEYS_STORAGE) ?? null;
    } catch {
      return;
    }
    if (!raw) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return;
    for (const { action } of KEY_ACTIONS) {
      const b = (data as Record<string, unknown>)[action];
      if (typeof b !== 'object' || b === null) continue;
      const { code, label } = b as Record<string, unknown>;
      if (code === '') this.keys.set(action, { code: '', label: '—' });
      else if (typeof code === 'string' && code.length <= 32) {
        this.set(action, code, typeof label === 'string' && label.length === 1 ? label : undefined, false);
      }
    }
  }
}

function safeLocalStorage(): KeyStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
