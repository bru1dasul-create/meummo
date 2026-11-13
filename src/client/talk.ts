// Conversa com NPCs (missões) e a lista de missões em andamento na tela.
// Só mostra e pede: quem confere distância, pré-requisito, nível e objetivo é o servidor.
// Visual: o mesmo painel de tábuas da loja, com cipó em cima, o retrato de quem fala, a fala num balão e
// cada missão num cartão (objetivo com barra de progresso e a recompensa em "fichas": XP, ouro e itens).
// No jogo 2.5D (pedido do dono, 13/11: "a câmera deve se posicionar na Xiovanna e vir a msg por cima com ela
// falando, mexendo a boca"): a câmera mostra quem fala, então sai o retrato; a fala vem embaixo da tela, por cima
// da cena, escrita aos poucos no ritmo da boca, com os botões grandes (Aceitar, Entregar, Desistir, Ver a loja, Tchau).

import type { ItemInfo } from '../shared/items';
import type { NpcInfo } from '../shared/protocol';
import { questBlocker, questFinisher, questProgress, type QuestInfo, type QuestLog } from '../shared/quests';
import { characterPortrait } from './game/characters';
import { itemIconUrl } from './itemArt';

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
  if (quest.goalLabel) return quest.goalLabel;
  if (quest.goal.kind === 'talk') return `Falar com ${quest.goalName}`;
  return `${quest.goal.kind === 'kill' ? 'Derrotar' : 'Entregar'} ${quest.goal.count} ${quest.goalName}`;
}

/** Se a missão em andamento já pode ser entregue. */
export function questReady(quest: QuestInfo, ctx: QuestContext): boolean {
  return ctx.log[quest.id]?.state === 'active' && questProgress(quest, ctx.log[quest.id], ctx.inBag) >= quest.goal.count;
}

/** O sinal em cima do NPC: '?' tem missão para entregar, '!' tem missão nova, '' nada. */
export function npcMark(npcType: string, quests: readonly QuestInfo[], ctx: QuestContext): '?' | '!' | '' {
  // '?' com quem a missão se conclui (quem deu, ou a pessoa procurada na missão de falar)
  if (quests.some((q) => questFinisher(q) === npcType && questReady(q, ctx))) return '?';
  if (quests.some((q) => q.giver === npcType && questBlocker(q, ctx.log, ctx.level) === null)) return '!';
  return '';
}

/** O jogo 2.5D está aberto (a tela dele é o canvas.mundo-novo): a conversa vira a fala por cima da cena. */
function cinemaMode(): boolean {
  return document.querySelector('canvas.mundo-novo') !== null;
}

/** Tempo de cada letra da fala: o mesmo ritmo da boca no motor (55 ms por letra, até 7 s a fala inteira). */
function letterMs(text: string): number {
  return Math.min(55, 7000 / Math.max(1, text.length));
}

export class TalkWindow {
  private readonly root = byId<HTMLDivElement>('talk');
  /** A fala que já foi escrita aos poucos (render de novo com a mesma fala a mostra inteira). */
  private typed = '';
  private typeTimer = 0;
  private npc: NpcInfo | null = null;
  private ctx: QuestContext | null = null;
  /** O que o NPC acabou de dizer (ao entregar uma missão). */
  private reply: string | null = null;
  /** Retrato de quem fala (desenhado ao abrir). */
  private portrait = '';

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
    return this.quests.some((q) => q.giver === npc.e.type || questFinisher(q) === npc.e.type);
  }

  open(npc: NpcInfo, ctx: QuestContext): void {
    const cinema = cinemaMode();
    this.root.classList.toggle('cinema', cinema);
    if (this.npc?.e.id !== npc.e.id) {
      this.typed = '';
      if (!cinema) this.portrait = characterPortrait(npc.e.look, npc.e.gear ?? {}, 6, npc.e.kind === 'npc' ? npc.e.type : undefined);
    }
    this.npc = npc;
    this.ctx = ctx;
    this.reply = null;
    this.root.hidden = false;
    this.render();
  }

  readonly close = (): void => {
    window.clearInterval(this.typeTimer);
    this.typed = '';
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
      if (questFinisher(quest) !== this.npc.e.type) continue;
      if (before[quest.id]?.state === 'active' && ctx.log[quest.id]?.state === 'done') this.reply = quest.done;
    }
    this.render();
  }

  destroy(): void {
    this.close();
  }

  /** A recompensa em fichas: XP, ouro (com a moeda) e cada item com o ícone. */
  private rewardChips(quest: QuestInfo): HTMLElement | null {
    const chips: HTMLElement[] = [];
    if (quest.reward.xp > 0) chips.push(el('span', 'talk-chip xp', `${quest.reward.xp} XP`));
    if (quest.reward.gold > 0) {
      const chip = el('span', 'talk-chip');
      chip.append(el('span', 'gold', quest.reward.gold.toLocaleString('pt-BR')));
      chips.push(chip);
    }
    for (const stack of quest.reward.items) {
      const def = this.items.get(stack.item);
      const chip = el('span', 'talk-chip');
      if (def) {
        const icon = el('img');
        icon.src = itemIconUrl(def.icon);
        icon.alt = '';
        chip.append(icon);
      }
      chip.append(`${def?.name ?? stack.item}${stack.n > 1 ? ` ×${stack.n}` : ''}`);
      chips.push(chip);
    }
    if (!chips.length) return null;
    const box = el('div', 'talk-reward');
    box.append(el('span', 'talk-reward-label', 'Recompensa'), ...chips);
    return box;
  }

  /** Objetivo com barra de progresso ("Derrotar 5 Sagui Travesso", 3/5). */
  private goal(quest: QuestInfo, done: number | null): HTMLElement {
    const box = el('div', `talk-goal${done !== null && done >= quest.goal.count ? ' done' : ''}`);
    box.append(el('span', '', goalText(quest)));
    if (done !== null) {
      const shown = Math.min(done, quest.goal.count);
      box.append(el('span', 'talk-count', shown >= quest.goal.count ? '✓' : `${shown}/${quest.goal.count}`));
      const bar = el('div', 'talk-bar');
      const fill = el('div');
      fill.style.width = `${Math.round((100 * shown) / quest.goal.count)}%`;
      bar.append(fill);
      box.append(bar);
    }
    return box;
  }

  /** Escreve a fala aos poucos, no ritmo da boca; clicar nela mostra tudo. A mesma fala de antes sai inteira. */
  private typewrite(p: HTMLElement, text: string): void {
    window.clearInterval(this.typeTimer);
    if (!text || text === this.typed) {
      p.textContent = text;
      return;
    }
    this.typed = text;
    const start = performance.now();
    const ms = letterMs(text);
    const step = (): void => {
      const n = Math.min(text.length, Math.floor((performance.now() - start) / ms) + 1);
      p.textContent = text.slice(0, n);
      if (n >= text.length) window.clearInterval(this.typeTimer);
    };
    p.addEventListener('click', () => {
      window.clearInterval(this.typeTimer);
      p.textContent = text;
    });
    step();
    this.typeTimer = window.setInterval(step, 30);
  }

  /** Jogo 2.5D: o nome (e o que a pessoa é) numa plaquinha, o ✕ e a fala grande, sem retrato. */
  private cinemaHead(npc: NpcInfo, line: string): HTMLElement[] {
    const head = el('div', 'talk-cine-head');
    const plate = el('div', 'talk-cine-name');
    plate.append(el('strong', '', npc.e.name));
    if (npc.title) plate.append(el('span', '', npc.title));
    const close = button('✕', 'shop-close', this.close);
    close.title = 'Fechar (Esc)';
    close.setAttribute('aria-label', 'Fechar a conversa');
    head.append(plate, close);
    const p = el('p', `talk-cine-line${this.reply ? ' talk-reply' : ''}`);
    this.typewrite(p, line);
    return [head, p];
  }

  private render(): void {
    const npc = this.npc;
    const ctx = this.ctx;
    if (!npc || !ctx) return;
    if (this.root.classList.contains('cinema')) {
      this.renderCinema(npc, ctx);
      return;
    }

    // ---- cabeçalho: cipó, retrato, nome e a fala no balão ----
    const head = el('div', 'shop-head');
    const portrait = el('div', 'shop-portrait talk-portrait');
    const face = el('img');
    face.src = this.portrait;
    face.alt = '';
    face.draggable = false;
    portrait.append(face);
    const who = el('div', 'shop-who');
    who.append(el('strong', '', npc.e.name));
    if (npc.title) who.append(el('span', 'shop-title', npc.title));
    const line = this.reply ?? npc.line;
    if (line) who.append(el('p', `shop-line${this.reply ? ' talk-reply' : ''}`, line));
    const close = button('✕', 'shop-close', this.close);
    close.title = 'Fechar (Esc)';
    close.setAttribute('aria-label', 'Fechar a conversa');
    head.append(portrait, who, close);
    const parts: HTMLElement[] = [el('div', 'talk-vine'), head, ...this.questParts(npc, ctx, true)];
    if (npc.shop) parts.push(button('Ver a loja', 'talk-shop', () => this.actions.openShop(npc)));
    this.root.replaceChildren(...parts);
  }

  /**
   * Jogo 2.5D: a fala é o que a pessoa diz agora (a resposta ao entregar; ou o pedido da missão nova, que a boca
   * acabou de falar; ou a fala dela), embaixo os cartões e os botões grandes.
   */
  private renderCinema(npc: NpcInfo, ctx: QuestContext): void {
    const offer = this.quests.find((q) => q.giver === npc.e.type && questBlocker(q, ctx.log, ctx.level) === null);
    const line = this.reply ?? offer?.ask ?? npc.line ?? '';
    const parts: HTMLElement[] = [...this.cinemaHead(npc, line), ...this.questParts(npc, ctx, !offer || line !== offer.ask)];
    const foot = el('div', 'talk-cine-foot');
    if (npc.shop) foot.append(button('Ver a loja', 'talk-shop', () => this.actions.openShop(npc)));
    foot.append(button('Tchau', 'talk-soft talk-bye', this.close));
    parts.push(foot);
    this.root.replaceChildren(...parts);
  }

  /** As missões deste NPC em cartões: para concluir, fazendo, novas e as que esperam nível. */
  private questParts(npc: NpcInfo, ctx: QuestContext, showAsk: boolean): HTMLElement[] {
    const parts: HTMLElement[] = [];
    // conclui aqui o que acaba com este NPC (inclusive a missão de falar, que outro deu); o resto é de quem deu
    const type = npc.e.type;
    const mine = this.quests.filter((q) => q.giver === type);
    const ready = this.quests.filter((q) => questFinisher(q) === type && questReady(q, ctx));
    const doing = mine.filter((q) => ctx.log[q.id]?.state === 'active' && !ready.includes(q));
    const fresh = mine.filter((q) => questBlocker(q, ctx.log, ctx.level) === null);
    const later = mine.filter((q) => questBlocker(q, ctx.log, ctx.level) === 'level');

    // cada missão num cartão: sinal (! nova, ? pronta, … fazendo), nome e o resto
    const card = (quest: QuestInfo, kind: 'fresh' | 'doing' | 'ready', extra: (HTMLElement | null)[]) => {
      const box = el('li', `talk-quest ${kind}`);
      const title = el('div', 'talk-quest-head');
      title.append(el('span', 'talk-badge', kind === 'fresh' ? '!' : kind === 'ready' ? '?' : '…'), el('strong', '', quest.name));
      box.append(title, ...extra.filter((x): x is HTMLElement => x !== null));
      return box;
    };
    const progress = (quest: QuestInfo) => questProgress(quest, ctx.log[quest.id], ctx.inBag);

    if (ready.length) {
      parts.push(el('h3', '', 'Para concluir'));
      const list = el('ul', 'talk-list');
      for (const quest of ready) {
        list.append(
          card(quest, 'ready', [
            this.goal(quest, progress(quest)),
            this.rewardChips(quest),
            button(quest.goal.kind === 'talk' ? 'Conversar' : 'Entregar', 'talk-main talk-give', () => this.actions.complete(npc.e.id, quest.id)),
          ]),
        );
      }
      parts.push(list);
    }
    if (doing.length) {
      parts.push(el('h3', '', 'Fazendo'));
      const list = el('ul', 'talk-list');
      for (const quest of doing) {
        list.append(card(quest, 'doing', [this.goal(quest, progress(quest)), button('Desistir', 'talk-soft', () => this.actions.abandon(quest.id))]));
      }
      parts.push(list);
    }
    if (fresh.length) {
      parts.push(el('h3', '', 'Missões'));
      const list = el('ul', 'talk-list');
      for (const quest of fresh) {
        list.append(
          card(quest, 'fresh', [
            showAsk || quest !== fresh[0] ? el('p', 'talk-ask', quest.ask) : null,
            this.goal(quest, null),
            this.rewardChips(quest),
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
    return parts;
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
        const done = Math.min(questProgress(quest, ctx.log[quest.id], ctx.inBag), quest.goal.count);
        const ready = done >= quest.goal.count;
        const row = el('div', `tracker-row${ready ? ' ready' : ''}`);
        const bar = el('div', 'tracker-bar');
        const fill = el('div');
        fill.style.width = `${Math.round((100 * done) / quest.goal.count)}%`;
        bar.append(fill);
        const status =
          quest.goal.kind === 'talk'
            ? (quest.goalLabel ?? `Fale com ${quest.goalName}`)
            : ready
              ? '✓ pronta: volte para entregar'
              : `${quest.goalLabel ?? quest.goalName}: ${done}/${quest.goal.count}`;
        row.append(el('strong', '', quest.name), el('span', '', status), bar);
        return row;
      }),
    );
  }

  destroy(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }
}
