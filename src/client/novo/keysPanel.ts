// Janela das teclas do jogo 2.5D (abre pelo painel do som, no botão "Teclas"): mostra a tecla de cada ação e deixa
// trocar (clique e aperte a nova). Fica guardado neste aparelho (keys.ts). Visual simples (provisório): a [arte]
// restiliza (#keys-panel) quando quiser.

import { KEY_ACTIONS, type KeyAction, type KeyBindings } from './keys';

export class KeysPanel {
  private readonly panel = document.createElement('div');
  private readonly style = document.createElement('style');
  private readonly buttons = new Map<KeyAction, HTMLButtonElement>();
  private readonly message = document.createElement('p');
  private readonly stickyNote = document.createElement('p');
  /** Esperando a tecla nova desta ação. */
  private waiting: KeyAction | null = null;

  constructor(
    private readonly keys: KeyBindings,
    /** As teclas mudaram (a barra de ações mostra as novas). */
    private readonly changed: () => void,
  ) {
    this.style.textContent = `
      #keys-panel { position: fixed; left: calc(8px + env(safe-area-inset-left)); top: calc(150px + env(safe-area-inset-top)); z-index: 9; width: 320px; max-height: calc(100vh - 170px); overflow-y: auto; padding: 10px 12px; border-radius: 10px; border: 2px solid #8a5a2b; background: rgba(28, 18, 12, 0.96); color: #f1e4c8; font: 13px system-ui, sans-serif; display: flex; flex-direction: column; gap: 6px; }
      #keys-panel h3 { margin: 0; font: 800 13px system-ui, sans-serif; color: #ffd98a; display: flex; justify-content: space-between; align-items: center; }
      #keys-panel h3 button { background: none; border: 0; color: #f1e4c8; font-size: 16px; cursor: pointer; }
      #keys-panel p { margin: 0; font-size: 12px; color: #d9c7a2; }
      #keys-panel p.msg { color: #ffb48a; min-height: 15px; }
      #keys-panel .row { display: grid; grid-template-columns: 1fr 96px 22px; gap: 6px; align-items: center; }
      #keys-panel .key { padding: 4px 6px; border-radius: 6px; border: 1px solid #8a5a2b; background: #3a2616; color: #fff1d0; font: 700 12px system-ui, sans-serif; cursor: pointer; }
      #keys-panel .key.waiting { background: #6b4a12; border-color: #ffd98a; }
      #keys-panel .none { background: none; border: 0; color: #c9a37a; cursor: pointer; font-size: 13px; }
      #keys-panel .reset { margin-top: 4px; padding: 6px 8px; border-radius: 6px; border: 1px solid #8a5a2b; background: #3a2616; color: #f1e4c8; font: 600 12px system-ui, sans-serif; cursor: pointer; }`;
    document.head.append(this.style);
    this.panel.id = 'keys-panel';
    this.panel.hidden = true;
    const title = document.createElement('h3');
    title.textContent = 'Teclas';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.title = 'Fechar';
    close.addEventListener('click', () => this.close());
    title.append(close);
    const help = document.createElement('p');
    help.textContent = 'Clique na tecla e aperte a nova (Esc desiste). Fixas: andar (WASD e setas), Enter (conversar), Esc, - e + (zoom) e 1 a 4 (barra).';
    this.message.className = 'msg';
    this.panel.append(title, help);
    for (const { action, label } of KEY_ACTIONS) {
      const row = document.createElement('div');
      row.className = 'row';
      const name = document.createElement('span');
      name.textContent = label;
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'key';
      key.dataset.action = action;
      key.addEventListener('click', () => this.wait(action));
      const none = document.createElement('button');
      none.type = 'button';
      none.className = 'none';
      none.textContent = '✕';
      none.title = 'Sem tecla';
      none.addEventListener('click', () => {
        this.keys.clear(action);
        this.waiting = null;
        this.refresh();
        this.changed();
      });
      row.append(name, key, none);
      this.buttons.set(action, key);
      this.panel.append(row);
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'reset';
    reset.textContent = 'Voltar ao padrão';
    reset.addEventListener('click', () => {
      this.keys.reset();
      this.waiting = null;
      this.message.textContent = '';
      this.refresh();
      this.changed();
    });
    this.stickyNote.textContent =
      'Shift apertado 5 vezes seguidas abre as "Teclas de Aderência" do Windows. Para desligar esse aviso: Configurações → Acessibilidade → Teclado → Teclas de Aderência → desmarque o atalho de teclado.';
    this.panel.append(this.message, reset, this.stickyNote);
    // clique na janela não vira clique no jogo (andar, atirar)
    this.panel.addEventListener('pointerdown', (event) => event.stopPropagation());
    window.addEventListener('keydown', this.onKeyDown, true);
    document.body.append(this.panel);
    this.refresh();
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  /** Esperando a tecla nova (o jogo não reage às teclas enquanto isso). */
  get listening(): boolean {
    return this.waiting !== null;
  }

  open(): void {
    this.panel.hidden = false;
    this.message.textContent = '';
    this.refresh();
  }

  close(): void {
    this.panel.hidden = true;
    this.waiting = null;
    this.refresh();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.panel.remove();
    this.style.remove();
  }

  private wait(action: KeyAction): void {
    this.waiting = this.waiting === action ? null : action;
    this.message.textContent = this.waiting ? 'Aperte a tecla nova...' : '';
    this.refresh();
  }

  /** Com a janela esperando, a tecla apertada é a nova (e não chega no jogo). */
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (this.panel.hidden) return;
    if (!this.waiting) {
      if (event.code === 'Escape') {
        event.stopImmediatePropagation(); // o Esc fecha só esta janela
        this.close();
      }
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === 'Escape') {
      this.waiting = null;
      this.message.textContent = '';
      this.refresh();
      return;
    }
    const action = this.waiting;
    const refused = this.keys.set(action, event.code, event.key);
    if (refused) {
      this.message.textContent = refused;
      return;
    }
    this.waiting = null;
    this.message.textContent = '';
    this.refresh();
    this.changed();
  };

  private refresh(): void {
    for (const [action, button] of this.buttons) {
      const waiting = this.waiting === action;
      button.textContent = waiting ? '...' : this.keys.label(action);
      button.classList.toggle('waiting', waiting);
    }
    // o aviso do Windows só interessa com alguma ação no Shift
    this.stickyNote.hidden = !KEY_ACTIONS.some(({ action }) => this.keys.get(action).code === 'Shift');
  }
}
