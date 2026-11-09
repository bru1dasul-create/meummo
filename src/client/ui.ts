// Interface em HTML por cima do jogo: barra de informações e chat.

const MAX_CHAT_LINES = 60;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento #${id} não encontrado`);
  return el as T;
}

export class ChatBox {
  private readonly root = byId<HTMLDivElement>('chat');
  private readonly log = byId<HTMLUListElement>('chat-log');
  private readonly form = byId<HTMLFormElement>('chat-form');
  private readonly input = byId<HTMLInputElement>('chat-input');

  constructor(private readonly onSend: (text: string) => void) {
    this.root.hidden = false;
    this.log.replaceChildren();
    this.input.placeholder = matchMedia('(pointer: coarse)').matches ? 'Conversar...' : 'Enter para conversar';
    this.form.addEventListener('submit', this.submit);
    window.addEventListener('keydown', this.keydown);
  }

  isTyping(): boolean {
    return document.activeElement === this.input;
  }

  blur(): void {
    this.input.blur();
  }

  addChat(name: string, text: string, self: boolean): void {
    const li = document.createElement('li');
    if (self) li.className = 'self';
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = `${name}: `;
    const body = document.createElement('span');
    body.textContent = text; // textContent: nunca interpretar HTML vindo de outros jogadores
    li.append(who, body);
    this.append(li);
  }

  addSystem(text: string): void {
    const li = document.createElement('li');
    li.className = 'sys';
    li.textContent = text;
    this.append(li);
  }

  destroy(): void {
    this.form.removeEventListener('submit', this.submit);
    window.removeEventListener('keydown', this.keydown);
    this.input.value = '';
    this.input.blur();
    this.root.hidden = true;
  }

  private append(li: HTMLLIElement): void {
    const atBottom = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 24;
    this.log.append(li);
    while (this.log.children.length > MAX_CHAT_LINES) this.log.firstElementChild?.remove();
    if (atBottom) this.log.scrollTop = this.log.scrollHeight;
  }

  private readonly submit = (event: SubmitEvent) => {
    event.preventDefault();
    const text = this.input.value.trim();
    if (text) this.onSend(text);
    this.input.value = '';
    this.input.blur(); // volta para o jogo
  };

  private readonly keydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !this.isTyping()) {
      event.preventDefault();
      this.input.focus();
    } else if (event.key === 'Escape' && this.isTyping()) {
      this.input.value = '';
      this.input.blur();
    }
  };
}

/** Painel do canto: nome, nível, vida, XP, online e ping. */
export class Hud {
  private readonly root = byId<HTMLDivElement>('hud');
  private readonly name = byId<HTMLSpanElement>('hud-name');
  private readonly level = byId<HTMLSpanElement>('hud-level');
  private readonly hpFill = byId<HTMLDivElement>('hud-hp-fill');
  private readonly hpText = byId<HTMLSpanElement>('hud-hp-text');
  private readonly xpFill = byId<HTMLDivElement>('hud-xp-fill');
  private readonly xpText = byId<HTMLSpanElement>('hud-xp-text');
  private readonly online = byId<HTMLSpanElement>('hud-online');
  private readonly ping = byId<HTMLSpanElement>('hud-ping');

  constructor(playerName: string) {
    this.root.hidden = false;
    this.name.textContent = playerName;
  }

  setHp(hp: number, maxHp: number): void {
    const fraction = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.hpFill.style.width = `${(fraction * 100).toFixed(1)}%`;
    this.hpFill.className = `fill ${fraction > 0.5 ? 'ok' : fraction > 0.25 ? 'mid' : 'low'}`;
    this.hpText.textContent = `${hp} / ${maxHp}`;
  }

  setXp(xp: number, xpNext: number, level: number): void {
    this.level.textContent = `Nv ${level}`;
    this.xpFill.style.width = `${xpNext > 0 ? ((xp / xpNext) * 100).toFixed(1) : 0}%`;
    this.xpText.textContent = `XP ${xp} / ${xpNext}`;
  }

  setOnline(count: number): void {
    this.online.textContent = count === 1 ? '1 online' : `${count} online`;
  }

  setPing(ms: number): void {
    this.ping.textContent = `ping ${Math.round(ms)} ms`;
  }

  destroy(): void {
    this.root.hidden = true;
    this.ping.textContent = 'ping —';
  }
}

export type ActionSlot = 'shot' | 'skill0' | 'skill1' | 'dash';

export interface ActionDef {
  slot: ActionSlot;
  label: string;
  key: string;
}

interface ActionButton {
  el: HTMLButtonElement;
  cooldown: HTMLSpanElement;
  readyAt: number;
  duration: number;
}

/** Botões de ação (no celular são o jeito principal de lutar; no computador mostram as recargas). */
export class ActionBar {
  private readonly root = byId<HTMLDivElement>('actions');
  private readonly buttons = new Map<ActionSlot, ActionButton>();
  private readonly cleanups: (() => void)[] = [];

  constructor(defs: ActionDef[], onPress: (slot: ActionSlot, down: boolean) => void) {
    this.root.replaceChildren();
    this.root.hidden = false;
    for (const def of defs) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'action';
      el.tabIndex = -1; // não rouba o foco do teclado (Espaço não "clica" no botão)
      el.dataset.slot = def.slot;
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = def.label;
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = def.key;
      const cooldown = document.createElement('span');
      cooldown.className = 'cd';
      el.append(cooldown, label, key);
      this.root.append(el);
      this.buttons.set(def.slot, { el, cooldown, readyAt: 0, duration: 0 });

      const down = (event: PointerEvent) => {
        event.preventDefault();
        try {
          el.setPointerCapture(event.pointerId); // continua "apertado" mesmo se o dedo escorregar
        } catch {
          // alguns navegadores recusam a captura; o botão funciona do mesmo jeito
        }
        el.classList.add('pressed');
        onPress(def.slot, true);
      };
      const up = () => {
        el.classList.remove('pressed');
        onPress(def.slot, false);
      };
      const noMenu = (event: Event) => event.preventDefault();
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', noMenu);
      this.cleanups.push(() => {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        el.removeEventListener('lostpointercapture', up);
        el.removeEventListener('contextmenu', noMenu);
      });
    }
  }

  setCooldown(slot: ActionSlot, readyAt: number, duration: number): void {
    const button = this.buttons.get(slot);
    if (!button) return;
    button.readyAt = readyAt;
    button.duration = duration;
  }

  /** Atualiza o "relógio" de recarga de cada botão. Chamado todo quadro. */
  update(now: number): void {
    for (const button of this.buttons.values()) {
      const remaining = Math.max(0, button.readyAt - now);
      const fraction = button.duration > 0 ? remaining / button.duration : 0;
      button.cooldown.style.transform = `scaleY(${fraction.toFixed(3)})`;
      button.el.classList.toggle('cooling', remaining > 0);
    }
  }

  destroy(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.root.replaceChildren();
    this.root.hidden = true;
  }
}

/** Faixa com o nome da zona, que aparece ao entrar e some sozinha. */
export class ZoneBanner {
  private readonly root = byId<HTMLDivElement>('zone-banner');
  private readonly name = byId<HTMLElement>('zone-name');
  private readonly sub = byId<HTMLSpanElement>('zone-sub');
  private timer: number | undefined;

  show(name: string, subtitle: string): void {
    this.name.textContent = name;
    this.sub.textContent = subtitle;
    this.root.hidden = true;
    void this.root.offsetWidth; // reinicia a animação
    this.root.hidden = false;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => (this.root.hidden = true), 4600);
  }

  destroy(): void {
    window.clearTimeout(this.timer);
    this.root.hidden = true;
  }
}

/** Aviso rápido no meio da tela ("Ainda recarregando..."). */
export class Toast {
  private readonly el = byId<HTMLDivElement>('toast');
  private timer: number | undefined;

  show(text: string, ms = 1500): void {
    this.el.textContent = text;
    this.el.classList.add('show');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.el.classList.remove('show'), ms);
  }

  destroy(): void {
    window.clearTimeout(this.timer);
    this.el.classList.remove('show');
  }
}

/** Tela de "Você desmaiou!" e o vermelho na borda quando você apanha. */
export class Feedback {
  private readonly death = byId<HTMLDivElement>('death');
  private readonly hurt = byId<HTMLDivElement>('hurt');

  showDeath(): void {
    this.death.hidden = false;
  }

  hideDeath(): void {
    this.death.hidden = true;
  }

  hurtFlash(): void {
    this.hurt.classList.remove('on');
    void this.hurt.offsetWidth; // reinicia a animação
    this.hurt.classList.add('on');
  }

  destroy(): void {
    this.hideDeath();
    this.hurt.classList.remove('on');
  }
}
