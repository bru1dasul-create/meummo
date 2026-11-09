// Mochila: o que você tem equipado, os itens que carrega e o que dá para fazer com cada um.
// Só mostra e pede: quem decide se dá para equipar ou comer é o servidor.

import { EQUIP_SLOTS, gearLookOf, type EquipSlot, type InventoryState, type ItemInfo, type Rarity } from '../shared/items';
import type { ItemAction, PlayerStats } from '../shared/protocol';
import { characterPortrait } from './game/characters';
import { itemIconUrl } from './itemArt';

const PART_LABELS: Record<EquipSlot, string> = { weapon: 'Arma', head: 'Cabeça', body: 'Corpo', charm: 'Amuleto' };
const KIND_LABELS: Record<ItemInfo['kind'], string> = { equipment: 'Equipamento', consumable: 'Consumível', material: 'Material' };
const RARITY_LABELS: Record<Rarity, string> = { common: 'Comum', rare: 'Raro', legendary: 'Lendário' };
/** Tempo para o segundo clique em "Jogar fora" (confirmação). */
const CONFIRM_MS = 3000;
/** O boneco gira quando você clica: de frente, de lado, de costas, do outro lado (quadro e se é espelhado). */
const DOLL_TURNS: readonly { frame: number; mirror: boolean }[] = [
  { frame: 6, mirror: false },
  { frame: 3, mirror: false },
  { frame: 0, mirror: false },
  { frame: 3, mirror: true },
];

type Selection = { kind: 'bag'; i: number } | { kind: 'gear'; part: EquipSlot } | null;

export interface BagActions {
  item(act: ItemAction, i: number): void;
  unequip(part: EquipSlot): void;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento #${id} não encontrado`);
  return el as T;
}

function icon(def: ItemInfo): HTMLImageElement {
  const img = document.createElement('img');
  img.src = itemIconUrl(def.icon);
  img.alt = '';
  img.draggable = false;
  return img;
}

/** "+2 de dano", "+10 de vida"... */
export function bonusLines(def: ItemInfo): string[] {
  const lines: string[] = [];
  if (def.bonus.damage) lines.push(`${def.bonus.damage > 0 ? '+' : ''}${def.bonus.damage} de dano`);
  if (def.bonus.hp) lines.push(`${def.bonus.hp > 0 ? '+' : ''}${def.bonus.hp} de vida`);
  if (def.bonus.defense) lines.push(`${def.bonus.defense > 0 ? '+' : ''}${def.bonus.defense} de defesa`);
  if (def.heal) lines.push(`Recupera ${def.heal} de vida`);
  return lines;
}

export class Bag {
  private readonly root = byId<HTMLDivElement>('bag');
  private readonly button = byId<HTMLButtonElement>('bag-button');
  private readonly closeButton = byId<HTMLButtonElement>('bag-close');
  private readonly countEl = byId<HTMLSpanElement>('bag-count');
  private readonly gearEl = byId<HTMLDivElement>('bag-gear');
  private readonly statsEl = byId<HTMLDivElement>('bag-stats');
  private readonly gridEl = byId<HTMLDivElement>('bag-grid');
  private readonly infoEl = byId<HTMLDivElement>('bag-info');
  private readonly gearButtons = new Map<EquipSlot, HTMLButtonElement>();
  private readonly doll = document.createElement('button');
  private readonly dollImg = document.createElement('img');
  private dollTurn = 0;
  private dollKey = '';
  private readonly slotButtons: HTMLButtonElement[] = [];
  private selected: Selection = null;
  private confirmDrop: { i: number; until: number } | null = null;
  private confirmTimer: number | undefined;

  constructor(
    private readonly items: ReadonlyMap<string, ItemInfo>,
    private state: InventoryState,
    private readonly actions: BagActions,
    private stats: PlayerStats,
    /** O look do seu personagem (vem do nome), para desenhar o boneco. */
    private readonly look: number,
  ) {
    this.gearEl.replaceChildren();
    // o boneco no meio, com as quatro partes em volta
    this.doll.type = 'button';
    this.doll.className = 'bag-doll';
    this.doll.tabIndex = -1;
    this.doll.title = 'Seu personagem (clique para girar)';
    this.dollImg.alt = 'Seu personagem com o equipamento';
    this.dollImg.draggable = false;
    this.doll.append(this.dollImg);
    this.doll.addEventListener('click', this.turnDoll);
    this.gearEl.append(this.doll);
    for (const part of EQUIP_SLOTS) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'gear-slot';
      el.tabIndex = -1;
      el.style.gridArea = part;
      el.addEventListener('click', () => this.select({ kind: 'gear', part }));
      this.gearButtons.set(part, el);
      this.gearEl.append(el);
    }
    this.gridEl.replaceChildren();
    for (let i = 0; i < state.slots.length; i++) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'slot';
      el.tabIndex = -1;
      el.addEventListener('click', () => this.select({ kind: 'bag', i }));
      el.addEventListener('dblclick', () => this.quickUse(i));
      this.slotButtons.push(el);
      this.gridEl.append(el);
    }
    const buttonIcon = this.button.querySelector('img');
    if (buttonIcon) buttonIcon.src = itemIconUrl('mochila');
    this.button.addEventListener('click', this.toggle);
    this.closeButton.addEventListener('click', this.close);
    this.button.hidden = false;
    this.root.hidden = true;
    this.render();
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  readonly toggle = (): void => {
    if (this.isOpen) this.close();
    else this.open();
  };

  open(): void {
    this.root.hidden = false;
    this.button.classList.add('open');
    this.button.classList.remove('new');
    this.render();
  }

  readonly close = (): void => {
    this.root.hidden = true;
    this.button.classList.remove('open');
    this.confirmDrop = null;
  };

  setState(state: InventoryState): void {
    this.state = state;
    this.confirmDrop = null;
    this.render();
  }

  setStats(stats: PlayerStats): void {
    this.stats = stats;
    this.renderStats();
  }

  /** Avisa no botão que chegou coisa nova (quando a mochila está fechada). */
  notifyNew(): void {
    if (this.isOpen) return;
    this.button.classList.remove('new');
    void this.button.offsetWidth; // reinicia a animação
    this.button.classList.add('new');
  }

  destroy(): void {
    window.clearTimeout(this.confirmTimer);
    this.button.removeEventListener('click', this.toggle);
    this.closeButton.removeEventListener('click', this.close);
    this.close();
    this.button.hidden = true;
    this.button.classList.remove('new');
    this.doll.removeEventListener('click', this.turnDoll);
    this.gearEl.replaceChildren();
    this.gridEl.replaceChildren();
    this.infoEl.replaceChildren();
  }

  private readonly turnDoll = (): void => {
    this.dollTurn = (this.dollTurn + 1) % DOLL_TURNS.length;
    this.renderDoll();
  };

  /** Desenha o boneco com o que está equipado agora (só refaz a imagem quando algo muda). */
  private renderDoll(): void {
    const gear = gearLookOf(this.state.equipped, this.items);
    const turn = DOLL_TURNS[this.dollTurn]!;
    const key = `${JSON.stringify(gear)}|${turn.frame}`;
    if (key !== this.dollKey) {
      this.dollKey = key;
      this.dollImg.src = characterPortrait(this.look, gear, turn.frame);
    }
    this.dollImg.classList.toggle('mirror', turn.mirror);
  }

  private select(selection: Selection): void {
    this.selected = selection;
    this.confirmDrop = null;
    this.render();
  }

  /** Clique duplo: equipa ou usa direto. */
  private quickUse(i: number): void {
    const def = this.defAt(i);
    if (!def) return;
    if (def.kind === 'equipment') this.equip(i, def);
    else if (def.kind === 'consumable') this.actions.item('use', i);
  }

  private equip(i: number, def: ItemInfo): void {
    this.actions.item('equip', i);
    if (def.slot) this.selected = { kind: 'gear', part: def.slot }; // depois de equipar, mostra onde ele foi parar
  }

  private defAt(i: number): ItemInfo | undefined {
    const stack = this.state.slots[i];
    return stack ? this.items.get(stack.item) : undefined;
  }

  private render(): void {
    const used = this.state.slots.filter(Boolean).length;
    this.countEl.textContent = `${used}/${this.state.slots.length}`;
    for (const part of EQUIP_SLOTS) {
      const el = this.gearButtons.get(part)!;
      const def = this.state.equipped[part] ? this.items.get(this.state.equipped[part]!) : undefined;
      const label = document.createElement('span');
      label.className = 'part';
      label.textContent = PART_LABELS[part];
      el.replaceChildren(...(def ? [icon(def)] : []), label);
      el.className = `gear-slot${def ? ` rarity-${def.rarity}` : ' empty'}`;
      el.classList.toggle('selected', this.selected?.kind === 'gear' && this.selected.part === part);
      el.title = def ? def.name : `${PART_LABELS[part]}: vazio`;
    }
    this.state.slots.forEach((stack, i) => {
      const el = this.slotButtons[i]!;
      const def = stack ? this.items.get(stack.item) : undefined;
      if (!stack || !def) {
        el.replaceChildren();
        el.className = 'slot empty';
        el.title = '';
      } else {
        const children: HTMLElement[] = [icon(def)];
        if (stack.n > 1) {
          const count = document.createElement('span');
          count.className = 'count';
          count.textContent = String(stack.n);
          children.push(count);
        }
        el.replaceChildren(...children);
        el.className = `slot rarity-${def.rarity}`;
        el.title = def.name;
      }
      el.classList.toggle('selected', this.selected?.kind === 'bag' && this.selected.i === i);
    });
    this.renderDoll();
    this.renderStats();
    this.renderInfo();
  }

  private renderStats(): void {
    const { maxHp, damage, defense } = this.stats;
    this.statsEl.textContent = `Vida ${maxHp} · Dano ${damage[0]}–${damage[1]} · Defesa ${defense}`;
  }

  private renderInfo(): void {
    const selection = this.selected;
    let def: ItemInfo | undefined;
    let count = 0;
    if (selection?.kind === 'bag') {
      const stack = this.state.slots[selection.i];
      def = stack ? this.items.get(stack.item) : undefined;
      count = stack?.n ?? 0;
    } else if (selection?.kind === 'gear') {
      const id = this.state.equipped[selection.part];
      def = id ? this.items.get(id) : undefined;
      count = def ? 1 : 0;
    }
    if (!selection || !def) {
      const hint = document.createElement('p');
      hint.className = 'bag-hint';
      hint.textContent =
        selection?.kind === 'gear'
          ? `Nada equipado em ${PART_LABELS[selection.part]}. Equipamentos caem dos monstros.`
          : 'Escolha um item para ver o que ele faz. Monstros deixam itens para quem ajudou a derrubá-los.';
      this.infoEl.replaceChildren(hint);
      return;
    }

    const title = document.createElement('strong');
    title.className = `item-name rarity-${def.rarity}`;
    title.textContent = count > 1 ? `${def.name} ×${count}` : def.name;
    const kind = document.createElement('span');
    kind.className = 'item-kind';
    kind.textContent = [def.slot ? PART_LABELS[def.slot] : KIND_LABELS[def.kind], RARITY_LABELS[def.rarity]].join(' · ');
    const parts: HTMLElement[] = [title, kind];
    const lines = bonusLines(def);
    if (lines.length > 0) {
      const list = document.createElement('ul');
      list.className = 'item-bonus';
      for (const line of lines) {
        const li = document.createElement('li');
        li.textContent = line;
        list.append(li);
      }
      parts.push(list);
    }
    if (def.description) {
      const desc = document.createElement('p');
      desc.className = 'item-desc';
      desc.textContent = def.description;
      parts.push(desc);
    }

    const buttons = document.createElement('div');
    buttons.className = 'item-actions';
    const add = (label: string, onClick: () => void, danger = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.tabIndex = -1;
      b.textContent = label;
      if (danger) b.className = 'danger';
      b.addEventListener('click', onClick);
      buttons.append(b);
    };
    if (selection.kind === 'gear') {
      add('Tirar', () => this.actions.unequip(selection.part));
    } else {
      const i = selection.i;
      if (def.kind === 'equipment') add('Equipar', () => this.equip(i, def));
      if (def.kind === 'consumable') add('Usar', () => this.actions.item('use', i));
      const confirming = this.confirmDrop?.i === i && performance.now() < this.confirmDrop.until;
      add(confirming ? 'Certeza? Clique de novo' : 'Jogar fora', () => this.drop(i), true);
    }
    parts.push(buttons);
    this.infoEl.replaceChildren(...parts);
  }

  /** Jogar fora pede um segundo clique (não dá para desfazer). */
  private drop(i: number): void {
    const now = performance.now();
    if (this.confirmDrop?.i === i && now < this.confirmDrop.until) {
      this.confirmDrop = null;
      this.actions.item('drop', i);
      return;
    }
    this.confirmDrop = { i, until: now + CONFIRM_MS };
    this.renderInfo();
    window.clearTimeout(this.confirmTimer);
    this.confirmTimer = window.setTimeout(() => this.renderInfo(), CONFIRM_MS + 50);
  }
}
