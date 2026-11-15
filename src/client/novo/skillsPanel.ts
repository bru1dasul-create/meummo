// Janela das Habilidades do jogo 2.5D (tecla K ou o botão ✦): escolher a classe (depois das missões do começo) e pôr
// os pontos nas habilidades dela (1 por nível). Quem decide tudo é o servidor: a janela só mostra o que ele mandou e
// pede. Visual simples (provisório): a [arte] restiliza (#skills-panel, #skills-button) quando quiser.

import { learnBlocker, levelForPoint, skillPoint, type ClassInfo, type ClassSkillInfo, type HeroState, type SkillPointInfo } from '../../shared/classes';
import { skillIconUrl } from './skillIcons';

export interface SkillsPanelActions {
  choose(classId: string): void;
  learn(skillId: string): void;
  unlearn(): void;
}

/** Quanto tempo o botão fica pedindo "tem certeza?" (escolher a classe, recomeçar os pontos). */
const CONFIRM_MS = 3000;

function meters(value: number): string {
  return `${String(Math.round(value * 10) / 10).replace('.', ',')} m`;
}

/** Os números de um ponto, em texto ("6 flechas · área de 2 m · dano 130%"). */
export function pointText(skill: ClassSkillInfo, point: SkillPointInfo): string {
  if (skill.kind === 'chuva') return `${point.arrows} flechas · área de ${meters(point.radius)} · dano ${point.damagePct}%`;
  if (skill.kind === 'flecha') {
    const parts = [`dano ${point.damagePct}% em cada um`];
    if (point.markPct > 0) parts.push(`marca: +${point.markPct}% de dano por ${Math.round(point.markMs / 100) / 10} s`.replace('.', ','));
    if (point.burstRadius > 0) parts.push(`explode no fim (${meters(point.burstRadius)}, ${point.burstPct}%)`);
    return parts.join(' · ');
  }
  return '';
}

export class SkillsPanel {
  private readonly panel = document.createElement('div');
  private readonly button = document.createElement('button');
  private readonly badge = document.createElement('span');
  private readonly style = document.createElement('style');
  private readonly body = document.createElement('div');
  private readonly points = document.createElement('span');
  private classes: ClassInfo[] = [];
  private hero: HeroState = { class: null, skills: {}, points: 0, canChoose: false };
  private level = 1;
  /** O botão que está pedindo confirmação (e até quando). */
  private confirming: { key: string; until: number } | null = null;
  private confirmTimer: number | undefined;

  constructor(private readonly actions: SkillsPanelActions) {
    this.style.textContent = `
      #skills-button { position: fixed; z-index: 6; top: calc(258px + env(safe-area-inset-top)); right: calc(12px + env(safe-area-inset-right)); display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 10px; border: 2px solid #8a5a2b; background: rgba(28, 18, 12, 0.92); color: #f1e4c8; font: 700 13px system-ui, sans-serif; cursor: pointer; }
      #skills-button .star { color: #ffd98a; font-size: 16px; }
      #skills-button kbd { font: 600 11px system-ui, sans-serif; padding: 0 4px; border-radius: 4px; border: 1px solid #8a5a2b; }
      #skills-button .badge { min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: #e8a33a; color: #2a1606; font: 800 12px/18px system-ui, sans-serif; text-align: center; }
      #skills-button .badge:empty { display: none; }
      #skills-button.news { animation: skills-news 1.2s ease-in-out infinite; border-color: #e8a33a; }
      @keyframes skills-news { 50% { box-shadow: 0 0 12px 2px rgba(232, 163, 58, 0.8); } }
      #skills-panel { position: fixed; z-index: 21; left: 50%; top: calc(60px + env(safe-area-inset-top)); transform: translateX(-50%); width: min(460px, calc(100vw - 24px)); max-height: calc(100vh - 230px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); overflow-y: auto; padding: 12px 14px; border-radius: 12px; border: 2px solid #8a5a2b; background: rgba(28, 18, 12, 0.96); color: #f1e4c8; font: 13px/1.35 system-ui, sans-serif; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5); }
      #skills-panel h3 { margin: 0 0 8px; font: 800 15px system-ui, sans-serif; color: #ffd98a; display: flex; align-items: center; gap: 8px; }
      #skills-panel h3 .pts { margin-left: auto; font: 700 12px system-ui, sans-serif; color: #f1e4c8; }
      #skills-panel h3 .pts b { color: #ffd98a; }
      #skills-panel h3 button { background: none; border: 0; color: #f1e4c8; font-size: 18px; cursor: pointer; padding: 0 2px; }
      #skills-panel p { margin: 4px 0; }
      #skills-panel .intro { color: #d8c8a6; }
      #skills-panel .card { margin-top: 8px; padding: 10px; border-radius: 10px; border: 1px solid #6e4a26; background: rgba(58, 38, 22, 0.6); }
      #skills-panel .card b.name { font-size: 15px; color: #ffe3a6; }
      #skills-panel .card ul { margin: 6px 0; padding-left: 18px; color: #d8c8a6; }
      #skills-panel .skill { display: grid; grid-template-columns: 48px 1fr auto; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid rgba(138, 90, 43, 0.45); }
      #skills-panel .skill img { width: 48px; height: 48px; border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.6); }
      #skills-panel .skill.locked img { filter: grayscale(0.85) brightness(0.65); }
      #skills-panel .skill .rank { margin-left: 6px; font-weight: 800; color: #ffd98a; }
      #skills-panel .skill .numbers { color: #bfe3a0; font-size: 12px; }
      #skills-panel .skill .next { color: #d8c8a6; font-size: 12px; }
      #skills-panel .skill .why { color: #e8a33a; font-size: 12px; }
      #skills-panel button.act { min-width: 40px; padding: 8px 10px; border-radius: 8px; border: 1px solid #c58a3a; background: #6b4216; color: #fff2d2; font: 800 14px system-ui, sans-serif; cursor: pointer; }
      #skills-panel button.act:disabled { opacity: 0.35; cursor: default; }
      #skills-panel button.act.confirm { background: #8a2c16; border-color: #e8a33a; }
      #skills-panel .reset { margin-top: 10px; width: 100%; font-size: 12px; }
      @media (pointer: coarse) {
        #skills-button { top: calc(228px + env(safe-area-inset-top)); right: auto; left: calc(8px + env(safe-area-inset-left)); padding: 8px 10px; }
        #skills-button .label, #skills-button kbd { display: none; }
        #skills-panel { max-height: calc(100vh - 90px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
        #skills-panel button.act { min-width: 48px; min-height: 44px; }
      }`;
    document.head.append(this.style);

    this.button.id = 'skills-button';
    this.button.type = 'button';
    this.button.title = 'Habilidades (K)';
    this.button.hidden = true;
    const star = document.createElement('span');
    star.className = 'star';
    star.textContent = '✦';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'Habilidades';
    const key = document.createElement('kbd');
    key.textContent = 'K';
    this.badge.className = 'badge';
    this.button.append(star, label, key, this.badge);
    this.button.addEventListener('click', () => {
      this.toggle();
      this.button.blur(); // o Espaço (pular) não "clica" no botão de novo
    });
    this.button.addEventListener('pointerdown', (event) => event.stopPropagation());

    this.panel.id = 'skills-panel';
    this.panel.hidden = true;
    const title = document.createElement('h3');
    title.append('✦ Habilidades');
    this.points.className = 'pts';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.title = 'Fechar (K ou Esc)';
    close.addEventListener('click', () => this.close());
    title.append(this.points, close);
    this.panel.append(title, this.body);
    // clique na janela não vira clique no jogo (andar, atirar)
    this.panel.addEventListener('pointerdown', (event) => event.stopPropagation());
    document.body.append(this.button, this.panel);
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  /** Mostra o botão (o jogo começou). */
  show(): void {
    this.button.hidden = false;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.panel.hidden = false;
    this.render();
  }

  close(): void {
    this.panel.hidden = true;
    this.confirming = null;
  }

  /** O que o servidor mandou (as classes, o herói) e o nível de agora. */
  update(classes: ClassInfo[], hero: HeroState, level: number): void {
    this.classes = classes;
    this.hero = hero;
    this.level = level;
    // o número no botão: os pontos para gastar (com classe) ou "!" (já pode escolher a classe)
    this.badge.textContent = hero.class ? (hero.points > 0 ? String(hero.points) : '') : hero.canChoose ? '!' : '';
    this.button.classList.toggle('news', hero.canChoose || (hero.class !== null && hero.points > 0 && this.canLearnSomething()));
    if (this.isOpen) this.render();
  }

  /** Tem alguma habilidade que aceita um ponto agora? */
  private canLearnSomething(): boolean {
    const cls = this.classes.find((c) => c.id === this.hero.class);
    return !!cls && cls.skills.some((skill) => learnBlocker(cls, skill, this.level, this.hero.skills) === null);
  }

  private render(): void {
    const hero = this.hero;
    const cls = this.classes.find((c) => c.id === hero.class);
    this.points.replaceChildren();
    const b = document.createElement('b');
    b.textContent = String(hero.points);
    this.points.append(b, hero.points === 1 ? ' ponto para gastar' : ' pontos para gastar');
    this.body.replaceChildren(...(cls ? this.renderClass(cls) : this.renderChoice()));
  }

  /** Sem classe: quem pode escolher vê o botão; quem ainda não pode vê o que falta. */
  private renderChoice(): HTMLElement[] {
    const intro = document.createElement('p');
    intro.className = 'intro';
    intro.textContent = this.hero.canChoose
      ? 'A mata te reconhece. Escolha o caminho que você vai seguir (não dá para trocar depois):'
      : 'Todo mundo começa igual. Termine as missões do começo (fale com a Budega, na vila) para escolher a sua classe. Os pontos de cada nível ficam guardados para depois.';
    const cards = this.classes.map((cls) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.class = cls.id;
      const name = document.createElement('b');
      name.className = 'name';
      name.textContent = cls.name;
      const description = document.createElement('p');
      description.textContent = cls.description;
      const list = document.createElement('ul');
      for (const skill of cls.skills) {
        const item = document.createElement('li');
        item.textContent = `${skill.name} (nível ${skill.level})${skill.kind ? '' : ' — em breve'}`;
        list.append(item);
      }
      const choose = this.actionButton(`class:${cls.id}`, 'Seguir este caminho', 'Tem certeza? Toque de novo', () => this.actions.choose(cls.id));
      choose.classList.add('choose');
      choose.disabled = !this.hero.canChoose;
      card.append(name, description, list, choose);
      return card;
    });
    return [intro, ...cards];
  }

  /** Com classe: as habilidades dela, com os pontos de cada uma e o botão de pôr mais um. */
  private renderClass(cls: ClassInfo): HTMLElement[] {
    const head = document.createElement('p');
    head.className = 'intro';
    const name = document.createElement('b');
    name.textContent = cls.name;
    const most = Math.max(0, ...cls.skills.map((s) => s.points.length)) || 5;
    head.append(name, ` — 1 ponto por nível; cada habilidade vai até ${most} pontos.`);
    const rows = cls.skills.map((skill) => this.renderSkill(cls, skill));
    const out: HTMLElement[] = [head, ...rows];
    if (Object.keys(this.hero.skills).length > 0) {
      const reset = this.actionButton('reset', 'Recomeçar os pontos (de graça, por enquanto)', 'Tem certeza? Toque de novo', () => this.actions.unlearn());
      reset.classList.add('reset');
      out.push(reset);
    }
    return out;
  }

  private renderSkill(cls: ClassInfo, skill: ClassSkillInfo): HTMLElement {
    const has = this.hero.skills[skill.id] ?? 0;
    const max = skill.points.length;
    const row = document.createElement('div');
    row.className = 'skill';
    row.dataset.skill = skill.id;
    row.classList.toggle('locked', has === 0);
    const icon = document.createElement('img');
    icon.src = skillIconUrl(skill.id);
    icon.alt = '';
    const info = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = skill.name;
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = skill.kind ? `${has}/${max}` : '';
    const description = document.createElement('p');
    description.textContent = skill.description;
    info.append(title, rank, description);
    const now = skillPoint(skill, has);
    const next = has < max ? skillPoint(skill, has + 1) : null;
    if (now) info.append(this.line('numbers', `Agora: ${pointText(skill, now)}`));
    if (next) info.append(this.line('next', `${has === 0 ? 'Com 1 ponto' : 'Próximo ponto'}: ${pointText(skill, next)}`));
    if (skill.kind && has === 0) info.append(this.line('next', `Recarga de ${Math.round(skill.cooldownMs / 1000)} s · mira até ${meters(skill.range)}`));
    const blocker = learnBlocker(cls, skill, this.level, this.hero.skills);
    const why =
      blocker === 'soon'
        ? `Em breve (libera no nível ${skill.level})`
        : blocker === 'level'
          ? `${has === 0 ? 'Libera' : 'Próximo ponto'} no nível ${levelForPoint(cls, skill, has + 1)}`
          : blocker === 'max'
            ? 'No máximo!'
            : blocker === 'points'
              ? 'Suba de nível para ganhar pontos'
              : '';
    if (why) info.append(this.line('why', why));
    const learn = document.createElement('button');
    learn.type = 'button';
    learn.className = 'act learn';
    learn.textContent = '+';
    learn.title = `Pôr um ponto em ${skill.name}`;
    learn.disabled = blocker !== null;
    learn.addEventListener('click', () => {
      learn.blur();
      this.actions.learn(skill.id);
    });
    row.append(icon, info, learn);
    return row;
  }

  private line(kind: string, text: string): HTMLElement {
    const p = document.createElement('p');
    p.className = kind;
    p.textContent = text;
    return p;
  }

  /** Botão que pede "tem certeza?" antes de fazer (o segundo toque, em até 3 s, faz). */
  private actionButton(key: string, text: string, confirmText: string, act: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'act';
    const asking = this.confirming?.key === key && performance.now() < this.confirming.until;
    button.textContent = asking ? confirmText : text;
    button.classList.toggle('confirm', asking);
    button.addEventListener('click', () => {
      button.blur();
      if (this.confirming?.key === key && performance.now() < this.confirming.until) {
        this.confirming = null;
        act();
        this.render();
        return;
      }
      this.confirming = { key, until: performance.now() + CONFIRM_MS };
      this.render();
      window.clearTimeout(this.confirmTimer);
      this.confirmTimer = window.setTimeout(() => {
        this.confirming = null;
        if (this.isOpen) this.render();
      }, CONFIRM_MS);
    });
    return button;
  }

  destroy(): void {
    window.clearTimeout(this.confirmTimer);
    this.panel.remove();
    this.button.remove();
    this.style.remove();
  }
}
