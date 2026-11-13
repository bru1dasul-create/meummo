// Interface em HTML por cima do jogo: barra de informações e chat.

import { actionIconUrl } from './actionArt';
import { installCoinStyle } from './coinArt';

const MAX_CHAT_LINES = 60;
/** Sem mensagem nova por esse tempo, o chat fica mais transparente (para não esconder o jogo). */
const CHAT_IDLE_MS = 9000;
/** Gestos do jogador que rolam o registro do chat; a rolagem que vem logo depois deles é dele (inclui o embalo do dedo). */
const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'pointerdown'] as const;
const USER_SCROLL_MS = 1500;

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
  private idleTimer: number | undefined;
  /** O registro acompanha a última fala, a não ser que o jogador tenha rolado para cima para ler as antigas. */
  private stickToBottom = true;
  /** Quando o jogador mexeu na rolagem do registro pela última vez (roda do mouse, dedo ou barra). */
  private userScrollAt = -Infinity;
  /** O chat muda de tamanho (jogo novo carregando, abrir para escrever, girar o celular): continua na última fala. */
  private readonly resize = new ResizeObserver(() => this.followBottom());

  constructor(private readonly onSend: (text: string) => void) {
    this.root.hidden = false;
    this.log.replaceChildren();
    this.input.placeholder = matchMedia('(pointer: coarse)').matches ? 'Conversar...' : 'Enter para conversar';
    this.form.addEventListener('submit', this.submit);
    window.addEventListener('keydown', this.keydown);
    // No celular o chat fica recolhido (últimas linhas); um toque abre e outro fecha
    if (matchMedia('(pointer: coarse)').matches) this.log.addEventListener('click', this.toggleOpen);
    this.input.addEventListener('focus', this.wake);
    this.log.addEventListener('scroll', this.onScroll, { passive: true });
    for (const type of USER_SCROLL_EVENTS) this.log.addEventListener(type, this.markUserScroll, { passive: true });
    this.input.addEventListener('blur', this.backToBottom);
    this.resize.observe(this.log);
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
    this.log.removeEventListener('click', this.toggleOpen);
    this.input.removeEventListener('focus', this.wake);
    this.log.removeEventListener('scroll', this.onScroll);
    for (const type of USER_SCROLL_EVENTS) this.log.removeEventListener(type, this.markUserScroll);
    this.input.removeEventListener('blur', this.backToBottom);
    this.resize.disconnect();
    window.clearTimeout(this.idleTimer);
    this.root.classList.remove('idle', 'open');
    this.input.value = '';
    this.input.blur();
    this.root.hidden = true;
  }

  private append(li: HTMLLIElement): void {
    this.log.append(li);
    while (this.log.children.length > MAX_CHAT_LINES) this.log.firstElementChild?.remove();
    this.followBottom();
    this.wake();
  }

  private followBottom(): void {
    if (this.stickToBottom) this.log.scrollTop = this.log.scrollHeight;
  }

  private readonly markUserScroll = () => {
    this.userScrollAt = performance.now();
  };

  /** Só a rolagem feita pelo jogador decide se o registro para de acompanhar a última fala; a do próprio chat e a
   *  que o navegador faz quando o chat muda de tamanho chegam atrasadas e enganariam a conta. */
  private readonly onScroll = () => {
    if (performance.now() - this.userScrollAt > USER_SCROLL_MS || this.log.clientHeight === 0) return;
    this.stickToBottom = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 24;
  };

  /** Terminou de escrever (ou fechou o chat): o registro recolhido volta a mostrar as últimas falas. */
  private readonly backToBottom = () => {
    this.stickToBottom = true;
    this.followBottom();
  };

  /** Mensagem nova ou jogador mexendo no chat: volta a ficar bem visível e esmaece depois. */
  private readonly wake = () => {
    this.root.classList.remove('idle');
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      if (!this.isTyping() && !this.root.classList.contains('open')) this.root.classList.add('idle');
    }, CHAT_IDLE_MS);
  };

  private readonly toggleOpen = () => {
    this.root.classList.toggle('open');
    this.backToBottom();
    this.wake();
  };

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
  private readonly gold = byId<HTMLSpanElement>('hud-gold');
  private readonly online = byId<HTMLSpanElement>('hud-online');
  private readonly ping = byId<HTMLSpanElement>('hud-ping');

  constructor(playerName: string) {
    this.root.hidden = false;
    this.name.textContent = playerName;
    installCoinStyle(); // a moeda desenhada aparece em todo lugar que mostra ouro
  }

  /** O ouro mudou: o número pula (e brilha) para chamar a atenção. */
  private bumpGold(): void {
    this.gold.classList.remove('bump');
    void this.gold.offsetWidth; // reinicia a animação
    this.gold.classList.add('bump');
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

  setGold(gold: number): void {
    const text = gold.toLocaleString('pt-BR');
    if (this.gold.textContent !== text && this.gold.textContent !== '') this.bumpGold();
    this.gold.textContent = text;
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
  secs: HTMLSpanElement;
  shownSecs: number;
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
      el.title = `${def.label} (${def.key})`;
      // Ícone com os segundos da recarga por cima (o véu escuro fica entre os dois)
      const art = document.createElement('span');
      art.className = 'art';
      const icon = document.createElement('img');
      icon.className = 'icon';
      icon.src = actionIconUrl(def.slot);
      icon.alt = '';
      icon.draggable = false;
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = def.label;
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = def.key;
      const cooldown = document.createElement('span');
      cooldown.className = 'cd';
      const secs = document.createElement('span');
      secs.className = 'secs';
      art.append(icon, secs);
      el.append(art, cooldown, label, key);
      this.root.append(el);
      this.buttons.set(def.slot, { el, cooldown, secs, shownSecs: 0, readyAt: 0, duration: 0 });

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
      // Segundos que faltam (só nas recargas longas; o estilingue recarrega rápido demais para isso)
      const secs = button.duration >= 1500 && remaining > 0 ? Math.ceil(remaining / 1000) : 0;
      if (secs !== button.shownSecs) {
        button.shownSecs = secs;
        button.secs.textContent = secs > 0 ? String(secs) : '';
      }
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

  show(name: string, subtitle: string, danger = false): void {
    this.name.textContent = name;
    this.sub.textContent = subtitle;
    this.root.classList.toggle('danger', danger);
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
