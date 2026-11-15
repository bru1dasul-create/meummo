// Janela das Habilidades do jogo 2.5D (tecla K ou o botão ✦): escolher a classe (depois das missões do começo) e pôr
// os pontos nas habilidades dela (1 por nível). Quem decide tudo é o servidor: a janela só mostra o que ele mandou e
// pede. O visual (o CSS abaixo, no estilo da HUD: a moldura da mochila, o dourado e o "+" redondo) é da [arte].

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
    if (point.burstRadius > 0) parts.push(`explode onde mira (${meters(point.burstRadius)}, ${point.burstPct}%)`);
    return parts.join(' · ');
  }
  if (skill.kind === 'olhos') {
    const parts = [`${Math.round(point.durationMs / 1000)} s`, `vê ${point.visionPct}% mais longe`];
    if (point.bonusPct > 0) parts.push(`+${point.bonusPct}% de dano seu nos bichos`);
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
      #skills-button { position: fixed; z-index: 6; top: calc(258px + env(safe-area-inset-top)); right: calc(12px + env(safe-area-inset-right)); display: flex; align-items: center; gap: 7px; padding: 6px 10px 6px 8px; border-radius: 999px; border: 1px solid rgba(214, 170, 104, 0.75); background: linear-gradient(180deg, rgba(48, 37, 25, 0.95), rgba(16, 12, 8, 0.95)); color: #f1e4c8; font: 700 13px system-ui, sans-serif; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255, 224, 170, 0.18), 0 3px 10px rgba(0, 0, 0, 0.45); }
      #skills-button:hover { filter: brightness(1.15); }
      #skills-button .star { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; color: #ffd23e; font-size: 14px; background: radial-gradient(circle at 50% 40%, rgba(255, 200, 90, 0.28), rgba(0, 0, 0, 0)); text-shadow: 0 0 6px rgba(255, 190, 70, 0.8); }
      #skills-button kbd { font: 700 11px system-ui, sans-serif; padding: 0 5px; border-radius: 4px; border: 1px solid rgba(214, 170, 104, 0.6); background: rgba(0, 0, 0, 0.35); color: #e9d6ae; }
      #skills-button .badge { min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; background: radial-gradient(circle at 50% 35%, #ffe08a, #e09a26 70%); color: #2a1606; font: 900 12px/20px system-ui, sans-serif; text-align: center; box-shadow: 0 0 0 1px rgba(80, 44, 8, 0.8); }
      #skills-button .badge:empty { display: none; }
      #skills-button.news { animation: skills-news 1.2s ease-in-out infinite; border-color: #ffc864; }
      @keyframes skills-news { 50% { box-shadow: inset 0 1px 0 rgba(255, 224, 170, 0.18), 0 0 14px 3px rgba(255, 190, 70, 0.75); } }
      #skills-panel { position: fixed; z-index: 21; left: 50%; top: calc(60px + env(safe-area-inset-top)); transform: translateX(-50%); width: min(480px, calc(100vw - 24px)); max-height: calc(100vh - 230px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); overflow-y: auto; padding: 12px 16px 18px; border-radius: 12px; border: 1px solid rgba(214, 170, 104, 0.65); background: url('/assets/ui/hud/canto-tribal.webp') right -1px bottom -1px / 46px auto no-repeat, linear-gradient(180deg, rgba(42, 33, 23, 0.97), rgba(14, 11, 8, 0.97)); color: #f1e4c8; font: 13px/1.38 system-ui, sans-serif; box-shadow: inset 0 1px 0 rgba(255, 224, 170, 0.14), 0 12px 36px rgba(0, 0, 0, 0.55); scrollbar-color: rgba(214, 170, 104, 0.5) transparent; }
      #skills-panel h3 { margin: 0 0 10px; padding-bottom: 9px; border-bottom: 1px solid rgba(214, 170, 104, 0.35); font: 700 19px/1.2 var(--title-font, Georgia, serif); color: #ffd23e; text-shadow: 0 1px 2px #000; display: flex; align-items: center; gap: 8px; }
      #skills-panel h3 .pts { margin-left: auto; padding: 3px 10px; border-radius: 999px; border: 1px solid rgba(214, 170, 104, 0.45); background: rgba(0, 0, 0, 0.3); font: 600 12px system-ui, sans-serif; color: #e9d6ae; text-shadow: none; }
      #skills-panel h3 .pts b { color: #ffd23e; font-size: 14px; }
      #skills-panel h3 button { width: 26px; height: 26px; padding: 0; border-radius: 50%; border: 1px solid rgba(214, 170, 104, 0.6); background: rgba(20, 14, 9, 0.9); color: #f1e4c8; font: 13px/24px system-ui, sans-serif; text-shadow: none; cursor: pointer; }
      #skills-panel h3 button:hover { filter: brightness(1.25); }
      #skills-panel p { margin: 4px 0; }
      #skills-panel .intro { color: #d9c7a2; }
      #skills-panel .intro b { color: #ffd23e; font-family: var(--title-font, Georgia, serif); font-size: 15px; }
      #skills-panel .card { margin-top: 10px; padding: 12px; border-radius: 10px; border: 1px solid rgba(165, 124, 66, 0.55); background: radial-gradient(circle at 50% 0%, rgba(110, 82, 44, 0.35), rgba(0, 0, 0, 0) 70%), rgba(8, 6, 4, 0.55); box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6); }
      #skills-panel .card b.name { font: 700 17px var(--title-font, Georgia, serif); color: #ffd23e; text-shadow: 0 1px 2px #000; }
      #skills-panel .card ul { margin: 8px 0 10px; padding: 0; list-style: none; color: #d9c7a2; }
      #skills-panel .card li { padding-left: 18px; position: relative; }
      #skills-panel .card li::before { content: '✦'; position: absolute; left: 2px; color: #c9974a; font-size: 11px; }
      #skills-panel .skill { display: grid; grid-template-columns: 54px 1fr auto; gap: 12px; align-items: center; margin-top: 8px; padding: 9px 10px; border-radius: 10px; border: 1px solid rgba(165, 124, 66, 0.4); background: linear-gradient(180deg, rgba(64, 50, 34, 0.45), rgba(10, 8, 5, 0.55)); }
      #skills-panel .skill b { color: #ffe9b8; font-size: 14px; }
      #skills-panel .skill img { width: 54px; height: 54px; border-radius: 9px; border: 2px solid rgba(214, 170, 104, 0.85); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.7), inset 0 0 0 1px rgba(0, 0, 0, 0.6), 0 3px 8px rgba(0, 0, 0, 0.5); }
      #skills-panel .skill.locked { border-color: rgba(120, 96, 66, 0.3); background: rgba(10, 8, 5, 0.45); }
      #skills-panel .skill.locked img { filter: grayscale(0.85) brightness(0.6); border-color: rgba(120, 96, 66, 0.6); }
      #skills-panel .skill.locked b { color: #cbb894; }
      #skills-panel .skill .rank { margin-left: 8px; padding: 1px 7px; border-radius: 999px; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(214, 170, 104, 0.5); font: 800 11px system-ui, sans-serif; color: #ffd23e; vertical-align: 1px; }
      #skills-panel .skill .rank:empty { display: none; }
      #skills-panel .skill .numbers { color: #b8e39a; font-size: 12px; }
      #skills-panel .skill .next { color: #c9b994; font-size: 12px; }
      #skills-panel .skill .why { color: #f0ae4a; font-size: 12px; font-weight: 600; }
      #skills-panel button.act { min-width: 40px; padding: 8px 12px; border-radius: 8px; border: 1px solid #ffc864; background: linear-gradient(180deg, #8a5a1e, #5a3510); color: #fff2d2; font: 800 14px system-ui, sans-serif; text-shadow: 0 1px 1px #000; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255, 230, 170, 0.35), 0 2px 6px rgba(0, 0, 0, 0.5); }
      #skills-panel button.act:hover:not(:disabled) { filter: brightness(1.18); }
      #skills-panel button.act:disabled { opacity: 0.32; cursor: default; filter: grayscale(0.6); }
      #skills-panel button.act.learn { width: 40px; height: 40px; min-width: 0; padding: 0; border-radius: 50%; font: 900 22px/1 system-ui, sans-serif; background: radial-gradient(circle at 50% 35%, #ffe08a, #d58f22 62%, #8a5414); color: #3a1e04; text-shadow: 0 1px 0 rgba(255, 240, 200, 0.6); border: 1px solid #5a340c; box-shadow: 0 0 0 2px rgba(214, 170, 104, 0.45), 0 3px 8px rgba(0, 0, 0, 0.55); }
      #skills-panel button.act.learn:not(:disabled) { animation: skills-learn 1.6s ease-in-out infinite; }
      @keyframes skills-learn { 50% { box-shadow: 0 0 0 2px rgba(255, 210, 120, 0.8), 0 0 12px 3px rgba(255, 190, 70, 0.55); } }
      #skills-panel button.act.choose { display: block; width: 100%; padding: 10px; font: 700 15px var(--title-font, Georgia, serif); color: #ffe9b8; }
      #skills-panel button.act.confirm { background: linear-gradient(180deg, #a3381c, #6e1f0c); border-color: #ffb46a; }
      #skills-panel .reset { margin-top: 12px; width: 100%; padding: 7px; font-size: 12px; font-weight: 600; background: rgba(0, 0, 0, 0.35); border-color: rgba(214, 170, 104, 0.45); color: #d9c7a2; box-shadow: none; }
      @media (pointer: coarse) {
        #skills-button { top: calc(228px + env(safe-area-inset-top)); right: auto; left: calc(8px + env(safe-area-inset-left)); padding: 8px 10px; }
        #skills-button .label, #skills-button kbd { display: none; }
        #skills-panel { max-height: calc(100vh - 90px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
        #skills-panel button.act { min-width: 48px; min-height: 44px; }
        #skills-panel button.act.learn { width: 46px; height: 46px; }
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
    if (skill.kind && has === 0) info.append(this.line('next', `Recarga de ${Math.round(skill.cooldownMs / 1000)} s${skill.range > 0 ? ` · mira até ${meters(skill.range)}` : ''}`));
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
