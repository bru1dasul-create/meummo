// Conversa com NPCs (missões) e a lista de missões em andamento na tela.
// Só mostra e pede: quem confere distância, pré-requisito, nível e objetivo é o servidor.
// Visual simples de propósito (a frente de Arte capricha depois).

import type { ItemInfo } from '../shared/items';
import type { NpcInfo } from '../shared/protocol';
import { questBlocker, questProgress, type QuestInfo, type QuestLog } from '../shared/quests';

export interface TalkActions {
  accept(npc: number, quest: string): void;
  complete(npc: number, quest: string): void;
  abandon(quest: string): void;
  /** O NPC também tem loja: abre a janela dela. */
  openShop(npc: NpcInfo): void;
}

/** O que a conversa e a lista precisam saber do jogador. */
export interface QuestContext {
  log: QuestLog;
  level: number;
  /** Quantos deste item há na mochila. */
  inBag(item: string): number;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento #${id} não encontrado`);
  return el as T;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** "Derrotar 5 Sagui Travesso" / "Entregar 3 Couro de Jararaca" */
export function goalText(quest: QuestInfo): string {
  return `${quest.goal.kind === 'kill' ? 'Derrotar' : 'Entregar'} ${quest.goal.count} ${quest.goalName}`;
}

/** Se a missão em andamento já pode ser entregue. */
export function questReady(quest: QuestInfo, ctx: QuestContext): boolean {
  return ctx.log[quest.id]?.state === 'active' && questProgress(quest, ctx.log[quest.id], ctx.inBag) >= quest.goal.count;
}

/** O sinal em cima do NPC: '?' tem missão para entregar, '!' tem missão nova, '' nada. */
export function npcMark(npcType: string, quests: readonly QuestInfo[], ctx: QuestContext): '?' | '!' | '' {
  const mine = quests.filter((q) => q.giver === npcType);
  if (mine.some((q) => questReady(q, ctx))) return '?';
  if (mine.some((q) => questBlocker(q, ctx.log, ctx.level) === null)) return '!';
  return '';
}

export class TalkWindow {
  private readonly root = byId<HTMLDivElement>('talk');
  private npc: NpcInfo | null = null;
  private ctx: QuestContext | null = null;
  /** O que o NPC acabou de dizer (ao entregar uma missão). */
  private reply: string | null = null;

  constructor(
    private readonly quests: readonly QuestInfo[],
    private readonly items: ReadonlyMap<string, ItemInfo>,
    private readonly actions: TalkActions,
  ) {
    this.root.hidden = true;
  }

  get isOpen(): boolean {
    return this.npc !== null;
  }

  get npcId(): number | null {
    return this.npc?.e.id ?? null;
  }

  /** Se este NPC tem missões (então clicar nele abre a conversa). */
  hasQuests(npc: NpcInfo): boolean {
    return this.quests.some((q) => q.giver === npc.e.type);
  }

  open(npc: NpcInfo, ctx: QuestContext): void {
    this.npc = npc;
    this.ctx = ctx;
    this.reply = null;
    this.root.hidden = false;
    this.render();
  }

  readonly close = (): void => {
    this.npc = null;
    this.reply = null;
    this.root.hidden = true;
    this.root.replaceChildren();
  };

  /** O diário, o nível ou a mochila mudaram. Se uma missão deste NPC acabou de ser concluída, ele responde. */
  update(ctx: QuestContext): void {
    const before = this.ctx?.log ?? {};
    this.ctx = ctx;
    if (!this.npc) return;
    for (const quest of this.quests) {
      if (quest.giver !== this.npc.e.type) continue;
      if (before[quest.id]?.state === 'active' && ctx.log[quest.id]?.state === 'done') this.reply = quest.done;
    }
    this.render();
  }

  destroy(): void {
    this.close();
  }

  private rewardText(quest: QuestInfo): string {
    const parts: string[] = [];
    if (quest.reward.xp > 0) parts.push(`${quest.reward.xp} XP`);
    if (quest.reward.gold > 0) parts.push(`${quest.reward.gold} de ouro`);
    for (const stack of quest.reward.items) parts.push(`${this.items.get(stack.item)?.name ?? stack.item}${stack.n > 1 ? ` ×${stack.n}` : ''}`);
    return parts.length ? `Recompensa: ${parts.join(', ')}` : '';
  }

  private render(): void {
    const npc = this.npc;
    const ctx = this.ctx;
    if (!npc || !ctx) return;
    const head = el('div', 'shop-head');
    const who = el('div', 'shop-who');
    who.append(el('strong', '', npc.e.name));
    if (npc.title) who.append(el('span', 'shop-title', npc.title));
    const close = button('✕', 'shop-close', this.close);
    close.title = 'Fechar (Esc)';
    close.setAttribute('aria-label', 'Fechar a conversa');
    head.append(who, close);
    const parts: HTMLElement[] = [head];
    const line = this.reply ?? npc.line;
    if (line) parts.push(el('p', `shop-line${this.reply ? ' talk-reply' : ''}`, `“${line}”`));

    const mine = this.quests.filter((q) => q.giver === npc.e.type);
    const ready = mine.filter((q) => questReady(q, ctx));
    const doing = mine.filter((q) => ctx.log[q.id]?.state === 'active' && !questReady(q, ctx));
    const fresh = mine.filter((q) => questBlocker(q, ctx.log, ctx.level) === null);
    const later = mine.filter((q) => questBlocker(q, ctx.log, ctx.level) === 'level');

    const card = (quest: QuestInfo, extra: HTMLElement[]) => {
      const box = el('li', 'talk-quest');
      box.append(el('strong', '', quest.name), ...extra);
      return box;
    };

    if (ready.length) {
      parts.push(el('h3', '', 'Para entregar'));
      const list = el('ul', 'talk-list');
      for (const quest of ready) {
        list.append(
          card(quest, [el('span', 'talk-goal done', `${goalText(quest)} ✓`), el('span', 'talk-reward', this.rewardText(quest)), button('Entregar', 'talk-main', () => this.actions.complete(npc.e.id, quest.id))]),
        );
      }
      parts.push(list);
    }
    if (doing.length) {
      parts.push(el('h3', '', 'Fazendo'));
      const list = el('ul', 'talk-list');
      for (const quest of doing) {
        const done = questProgress(quest, ctx.log[quest.id], ctx.inBag);
        list.append(card(quest, [el('span', 'talk-goal', `${goalText(quest)}: ${done}/${quest.goal.count}`), button('Desistir', 'talk-soft', () => this.actions.abandon(quest.id))]));
      }
      parts.push(list);
    }
    if (fresh.length) {
      parts.push(el('h3', '', 'Missões'));
      const list = el('ul', 'talk-list');
      for (const quest of fresh) {
        list.append(
          card(quest, [
            el('p', 'talk-ask', quest.ask),
            el('span', 'talk-goal', goalText(quest)),
            el('span', 'talk-reward', this.rewardText(quest)),
            button('Aceitar', 'talk-main', () => this.actions.accept(npc.e.id, quest.id)),
          ]),
        );
      }
      parts.push(list);
    }
    if (later.length) {
      parts.push(el('p', 'shop-empty', `Volte quando tiver nível ${Math.min(...later.map((q) => q.minLevel))}: ${later.length === 1 ? 'tem mais uma missão' : `tem mais ${later.length} missões`}.`));
    }
    if (!ready.length && !doing.length && !fresh.length && !later.length) parts.push(el('p', 'shop-empty', 'Nenhuma missão agora. Volte mais tarde!'));
    if (npc.shop) parts.push(button('Ver a loja', 'talk-shop', () => this.actions.openShop(npc)));
    this.root.replaceChildren(...parts);
  }
}

/** As missões em andamento, no canto da tela, embaixo do painel de vida. */
export class QuestTracker {
  private readonly root = byId<HTMLDivElement>('quest-tracker');

  constructor(private readonly quests: readonly QuestInfo[]) {
    this.root.hidden = true;
  }

  update(ctx: QuestContext): void {
    const active = this.quests.filter((q) => ctx.log[q.id]?.state === 'active');
    this.root.hidden = active.length === 0;
    this.root.replaceChildren(
      ...active.map((quest) => {
        const done = questProgress(quest, ctx.log[quest.id], ctx.inBag);
        const row = el('div', `tracker-row${done >= quest.goal.count ? ' ready' : ''}`);
        row.append(el('strong', '', quest.name), el('span', '', done >= quest.goal.count ? 'pronta: volte para entregar' : `${quest.goalName}: ${done}/${quest.goal.count}`));
        return row;
      }),
    );
  }

  destroy(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }
}
