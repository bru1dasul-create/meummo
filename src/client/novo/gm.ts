// Menu ADM do jogo novo: os poderes do administrador (o servidor confere se ele é administrador e registra tudo).
// Só aparece para quem foi marcado no painel do administrador (aba Jogadores). Tecla G ou o botão ADM abre e fecha.
// Visual simples (provisório): a [arte] restiliza (#gm-button, #gm-panel) ou leva para a HUD nova.

export interface GmActions {
  spawn(monster: string, n: number): void;
  clear(): void;
  fly(on: boolean): void;
  god(on: boolean): void;
  nocd(on: boolean): void;
  heal(): void;
  /** Liga/desliga o "teleporte ao clicar" (fica só no navegador: o clique no chão vira um pedido de ir até lá). */
  teleportMode(on: boolean): void;
  /** Traz o NPC (a chave dele) para onde o administrador está (fica salvo nos ajustes do painel). */
  npc(id: string): void;
  /** Vira o relógio para o começo do dia ou da noite (todos os mapas). */
  time(phase: 'dia' | 'tarde' | 'noite'): void;
  /** Muda o vento na hora (todos os mapas). */
  wind(level: 'calmo' | 'brisa' | 'forte'): void;
}

export interface GmState {
  admin: boolean;
  fly: boolean;
  god: boolean;
  nocd: boolean;
  monsters: { id: string; name: string }[];
}

export class GmPanel {
  private readonly button = document.createElement('button');
  private readonly panel = document.createElement('div');
  private readonly style = document.createElement('style');
  private readonly monster = document.createElement('select');
  private readonly npcSelect = document.createElement('select');
  private readonly count = document.createElement('input');
  private readonly flyButton: HTMLButtonElement;
  private readonly godButton: HTMLButtonElement;
  private readonly nocdButton: HTMLButtonElement;
  private readonly teleportButton: HTMLButtonElement;
  private state: GmState = { admin: false, fly: false, god: false, nocd: false, monsters: [] };
  private teleport = false;

  constructor(private readonly actions: GmActions) {
    this.style.textContent = `
      #gm-button { position: fixed; left: calc(8px + env(safe-area-inset-left)); top: calc(118px + env(safe-area-inset-top)); z-index: 7; padding: 4px 10px; border-radius: 6px; border: 2px solid #c0392b; background: #2b1d12; color: #ffd2c8; font: 800 12px system-ui, sans-serif; cursor: pointer; }
      #gm-panel { position: fixed; left: calc(8px + env(safe-area-inset-left)); top: calc(150px + env(safe-area-inset-top)); z-index: 7; width: 250px; padding: 10px; border-radius: 10px; border: 2px solid #c0392b; background: rgba(28, 18, 12, 0.95); color: #f1e4c8; font: 13px system-ui, sans-serif; display: flex; flex-direction: column; gap: 7px; }
      #gm-panel h3 { margin: 0; font: 800 13px system-ui, sans-serif; color: #ffb4a3; }
      #gm-panel .row { display: flex; gap: 6px; align-items: center; }
      #gm-panel select { flex: 1; min-width: 0; }
      #gm-panel input { width: 46px; }
      #gm-panel select, #gm-panel input { padding: 4px; border-radius: 5px; border: 1px solid #6b4a2a; background: #120c08; color: #f1e4c8; }
      #gm-panel button { padding: 6px 8px; border-radius: 6px; border: 1px solid #8a5a2b; background: #3a2616; color: #f1e4c8; font: 600 12px system-ui, sans-serif; cursor: pointer; }
      #gm-panel button.on { background: #2e6b3a; border-color: #7bd389; }
      #gm-panel .hint { font-size: 11px; opacity: 0.75; }
      @media (pointer: coarse) { #gm-button { top: calc(96px + env(safe-area-inset-top)); } #gm-panel { top: calc(126px + env(safe-area-inset-top)); max-height: calc(100vh - 140px); overflow: auto; } }`;
    document.head.append(this.style);

    this.button.id = 'gm-button';
    this.button.type = 'button';
    this.button.textContent = 'ADM';
    this.button.title = 'Menu do administrador (G)';
    this.button.hidden = true;
    this.button.addEventListener('click', () => this.toggle());

    this.panel.id = 'gm-panel';
    this.panel.hidden = true;
    const title = document.createElement('h3');
    title.textContent = 'ADM — poderes do administrador';
    this.count.type = 'number';
    this.count.min = '1';
    this.count.max = '10';
    this.count.value = '3';
    const make = (text: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', onClick);
      return b;
    };
    const spawnRow = document.createElement('div');
    spawnRow.className = 'row';
    spawnRow.append(this.monster, this.count, make('Criar aqui', () => this.actions.spawn(this.monster.value, Math.max(1, Math.min(10, Math.floor(Number(this.count.value) || 1))))));
    this.flyButton = make('Voar', () => this.actions.fly(!this.state.fly));
    this.godButton = make('Invencível', () => this.actions.god(!this.state.god));
    this.nocdButton = make('Sem recarga', () => this.actions.nocd(!this.state.nocd));
    this.teleportButton = make('Teleporte ao clicar', () => {
      this.teleport = !this.teleport;
      this.actions.teleportMode(this.teleport);
      this.render();
    });
    const npcRow = document.createElement('div');
    npcRow.className = 'row';
    npcRow.append(this.npcSelect, make('Trazer para cá', () => this.npcSelect.value && this.actions.npc(this.npcSelect.value)));
    const toggles = document.createElement('div');
    toggles.className = 'row';
    toggles.append(this.flyButton, this.godButton, this.nocdButton);
    const time = document.createElement('div');
    time.className = 'row';
    time.append(
      make('Virar dia', () => this.actions.time('dia')),
      make('Virar tarde', () => this.actions.time('tarde')), // o começo do anoitecer: o pôr do sol, sem esperar
      make('Virar noite', () => this.actions.time('noite')),
    );
    const wind = document.createElement('div');
    wind.className = 'row';
    wind.append(make('Calmo', () => this.actions.wind('calmo')), make('Brisa', () => this.actions.wind('brisa')), make('Vento forte', () => this.actions.wind('forte')));
    const others = document.createElement('div');
    others.className = 'row';
    others.append(make('Derrubar monstros perto', () => this.actions.clear()), make('Curar', () => this.actions.heal()));
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Monstros criados não renascem. Voando, você atravessa tudo. Tudo fica registrado no servidor.';
    this.panel.append(title, spawnRow, others, toggles, time, wind, this.teleportButton, npcRow, hint);
    // clique no menu não vira clique no jogo (andar, atirar)
    for (const el of [this.panel, this.button]) {
      el.addEventListener('pointerdown', (event) => event.stopPropagation());
      el.addEventListener('keydown', (event) => event.stopPropagation());
    }
    document.body.append(this.button, this.panel);
  }

  /** O servidor contou: é administrador? voando? invencível? que monstros existem? */
  set(state: GmState): void {
    this.state = state;
    if (this.monster.options.length !== state.monsters.length) {
      this.monster.replaceChildren(
        ...state.monsters.map((m) => {
          const option = document.createElement('option');
          option.value = m.id;
          option.textContent = m.name;
          return option;
        }),
      );
    }
    if (!state.admin) {
      this.panel.hidden = true;
      if (this.teleport) {
        this.teleport = false;
        this.actions.teleportMode(false);
      }
    }
    this.button.hidden = !state.admin;
    this.render();
  }

  /** Os NPCs deste mapa (para o "trazer para cá"). */
  setNpcs(list: { id: string; name: string }[]): void {
    const current = this.npcSelect.value;
    this.npcSelect.replaceChildren(
      ...list.map((npc) => {
        const option = document.createElement('option');
        option.value = npc.id;
        option.textContent = npc.name;
        return option;
      }),
    );
    if (list.some((npc) => npc.id === current)) this.npcSelect.value = current;
  }

  toggle(): void {
    if (!this.state.admin) return;
    this.panel.hidden = !this.panel.hidden;
  }

  get admin(): boolean {
    return this.state.admin;
  }

  private render(): void {
    this.flyButton.classList.toggle('on', this.state.fly);
    this.flyButton.textContent = this.state.fly ? 'Voando (pousar)' : 'Voar';
    this.godButton.classList.toggle('on', this.state.god);
    this.godButton.textContent = this.state.god ? 'Invencível: ligado' : 'Invencível';
    this.nocdButton.classList.toggle('on', this.state.nocd);
    this.nocdButton.textContent = this.state.nocd ? 'Sem recarga: ligado' : 'Sem recarga';
    this.teleportButton.classList.toggle('on', this.teleport);
    this.teleportButton.textContent = this.teleport ? 'Teleporte ao clicar: ligado' : 'Teleporte ao clicar';
  }

  destroy(): void {
    this.button.remove();
    this.panel.remove();
    this.style.remove();
  }
}
