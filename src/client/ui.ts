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
    this.input.placeholder = matchMedia('(pointer: coarse)').matches ? 'Toque aqui para conversar' : 'Enter para conversar';
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

export class Hud {
  private readonly root = byId<HTMLDivElement>('hud');
  private readonly name = byId<HTMLSpanElement>('hud-name');
  private readonly online = byId<HTMLSpanElement>('hud-online');
  private readonly ping = byId<HTMLSpanElement>('hud-ping');

  constructor(playerName: string) {
    this.root.hidden = false;
    this.name.textContent = playerName;
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
