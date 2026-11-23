// Janela das Habilidades do jogo 2.5D (tecla K ou o botão ✦), com duas abas:
// - Habilidades: escolher a classe (depois das missões do começo) e pôr os pontos nas habilidades dela (1 por nível);
// - Atributos: Força, Destreza, Espírito e Vitalidade (3 pontos por nível; aprovado pelo dono em 23/11).
// Quem decide tudo é o servidor: a janela só mostra o que ele mandou e pede. O visual (no estilo da HUD: a moldura da
// mochila, o dourado, o "+" redondo, as abas e os ícones dos atributos) é da [arte] e fica no style.css (seção "janela
// das Habilidades e dos Atributos"; saiu daqui em 23/11, como o da barra).

import { ATTRIBUTE_IDS, ATTRIBUTE_NAMES, ATTRIBUTE_POINTS_PER_LEVEL, attributeBonus, noAttributes, type AttributeId, type Attributes } from '../../shared/attributes';
import { learnBlocker, levelForPoint, skillPoint, type ClassInfo, type ClassSkillInfo, type HeroState, type SkillPointInfo } from '../../shared/classes';
import { defaultCombatRules, type CombatRules } from '../../shared/combatRules';
import { skillIconUrl } from './skillIcons';

export interface SkillsPanelActions {
  choose(classId: string): void;
  learn(skillId: string): void;
  unlearn(): void;
  addAttribute(id: AttributeId): void;
  resetAttributes(): void;
}

export type SkillsTab = 'skills' | 'attrs';

function num(value: number): string {
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

/**
 * O que cada ponto de um atributo dá (`each`, a frase que explica o atributo) e o que os pontos dele dão agora (`now`;
 * vazio sem pontos), em texto, com os números das regras de agora (o painel do administrador muda).
 */
export function attributeText(id: AttributeId, attrs: Readonly<Attributes>, rules: CombatRules): { each: string; now: string } {
  const bonus = attributeBonus(attrs, rules);
  const upTo = `(até ${num(rules.attributeCutMaxPct)}%)`;
  const has = attrs[id] > 0;
  switch (id) {
    case 'forca':
      return { each: `+${num(rules.strengthShotPct)}% de dano por ponto no tiro de sempre (arco e estilingue)`, now: has ? `+${num(bonus.shotDamagePct)}% de dano no tiro` : '' };
    case 'destreza':
      return {
        each: `Por ponto, puxa o arco ${num(rules.dexterityChargePct)}% mais rápido e atira de novo ${num(rules.dexterityIntervalPct)}% mais cedo ${upTo}`,
        now: has ? `puxada ${num(bonus.chargeCutPct)}% e intervalo ${num(bonus.intervalCutPct)}% mais curtos` : '',
      };
    case 'espirito':
      return {
        each: `Por ponto, as habilidades da classe dão +${num(rules.spiritSkillPct)}% de dano e voltam ${num(rules.spiritCooldownPct)}% mais cedo ${upTo}`,
        now: has ? `+${num(bonus.skillDamagePct)}% de dano e recarga ${num(bonus.cooldownCutPct)}% menor` : '',
      };
    case 'vitalidade':
      return { each: `+${num(rules.vitalityHp * rules.playerHpFactor)} de vida por ponto`, now: has ? `+${bonus.hp} de vida` : '' };
  }
}

/** Uma linha de atributo na janela (montada uma vez e atualizada no lugar: o "+" não some no meio do clique). */
interface AttrRow {
  value: HTMLElement;
  now: HTMLElement;
  each: HTMLElement;
  plus: HTMLButtonElement;
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
  private readonly body = document.createElement('div');
  private readonly points = document.createElement('span');
  private readonly heading = document.createElement('span');
  private readonly tabButtons = new Map<SkillsTab, { button: HTMLButtonElement; count: HTMLElement }>();
  private readonly attrBody = document.createElement('div');
  private readonly attrRows = new Map<AttributeId, AttrRow>();
  private readonly attrReset = document.createElement('button');
  private attrResetAsking = 0;
  private attrResetTimer: number | undefined;
  private tab: SkillsTab = 'skills';
  private classes: ClassInfo[] = [];
  private hero: HeroState = { class: null, skills: {}, points: 0, canChoose: false };
  private level = 1;
  private attrs: Attributes = noAttributes();
  private attrPoints = 0;
  private rules: CombatRules = defaultCombatRules();
  /** O botão que está pedindo confirmação (e até quando). */
  private confirming: { key: string; until: number } | null = null;
  private confirmTimer: number | undefined;

  constructor(private readonly actions: SkillsPanelActions) {
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
    this.heading.textContent = '✦ Habilidades';
    this.points.className = 'pts';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.title = 'Fechar (K ou Esc)';
    close.addEventListener('click', () => this.close());
    title.append(this.heading, this.points, close);
    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    for (const [tab, text] of [['skills', 'Habilidades'], ['attrs', 'Atributos']] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tab = tab;
      const count = document.createElement('span');
      count.className = 'count';
      button.append(text, count);
      button.addEventListener('click', () => {
        button.blur();
        this.showTab(tab);
      });
      tabs.append(button);
      this.tabButtons.set(tab, { button, count });
    }
    this.buildAttributes();
    // o título e as abas ficam presos no alto quando a janela rola (no celular, rola quase sempre)
    const head = document.createElement('div');
    head.className = 'head';
    head.append(title, tabs);
    this.panel.append(head, this.body, this.attrBody);
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

  /** Abre (na aba `tab`, ou na que estava). */
  open(tab?: SkillsTab): void {
    if (tab) this.tab = tab;
    this.panel.hidden = false;
    this.render();
  }

  close(): void {
    this.panel.hidden = true;
    this.confirming = null;
    this.attrResetAsking = 0;
  }

  /** A aba aberta. */
  get currentTab(): SkillsTab {
    return this.tab;
  }

  showTab(tab: SkillsTab): void {
    this.tab = tab;
    this.confirming = null;
    this.attrResetAsking = 0;
    this.render();
    this.panel.scrollTop = 0; // a outra aba começa do começo
  }

  /** O que o servidor mandou (as classes, o herói) e o nível de agora. */
  update(classes: ClassInfo[], hero: HeroState, level: number): void {
    this.classes = classes;
    this.hero = hero;
    this.level = level;
    this.refreshBadges();
    if (this.isOpen && this.tab === 'skills') this.render();
    else this.refreshHeader();
  }

  /** Os atributos que o servidor mandou (os pontos de cada um e os que sobram) e as regras de quanto vale cada ponto. */
  setAttributes(attrs: Readonly<Attributes>, points: number, rules: CombatRules): void {
    this.attrs = { ...attrs };
    this.attrPoints = points;
    this.rules = rules;
    this.refreshBadges();
    this.refreshAttributes();
    this.refreshHeader();
  }

  /** O número no botão e nas abas, e o botão piscando quando tem o que fazer. */
  private refreshBadges(): void {
    const hero = this.hero;
    const skillPoints = hero.class ? hero.points : 0;
    // os pontos para gastar (habilidades, com classe, e atributos) ou "!" (já pode escolher a classe)
    const total = skillPoints + this.attrPoints;
    this.badge.textContent = !hero.class && hero.canChoose ? '!' : total > 0 ? String(total) : '';
    this.button.classList.toggle('news', hero.canChoose || (hero.class !== null && hero.points > 0 && this.canLearnSomething()) || this.attrPoints > 0);
    const skills = this.tabButtons.get('skills');
    if (skills) skills.count.textContent = hero.class ? (hero.points > 0 ? String(hero.points) : '') : hero.canChoose ? '!' : '';
    const attrs = this.tabButtons.get('attrs');
    if (attrs) attrs.count.textContent = this.attrPoints > 0 ? String(this.attrPoints) : '';
  }

  /** O título e os pontos da aba aberta. */
  private refreshHeader(): void {
    const onAttrs = this.tab === 'attrs';
    this.heading.textContent = onAttrs ? '✦ Atributos' : '✦ Habilidades';
    const value = onAttrs ? this.attrPoints : this.hero.points;
    this.points.replaceChildren();
    const b = document.createElement('b');
    b.textContent = String(value);
    const what = onAttrs ? 'para distribuir' : 'para gastar';
    this.points.append(b, value === 1 ? ` ponto ${what}` : ` pontos ${what}`);
    for (const [tab, { button }] of this.tabButtons) button.classList.toggle('on', tab === this.tab);
  }

  /** Monta a aba dos atributos (uma vez: depois só os números mudam). */
  private buildAttributes(): void {
    this.attrBody.className = 'attrs';
    const intro = document.createElement('p');
    intro.className = 'intro';
    intro.textContent = `${ATTRIBUTE_POINTS_PER_LEVEL} pontos a cada nível, a partir do 2. Recomeçar é de graça, por enquanto.`;
    const rows = ATTRIBUTE_IDS.map((id) => {
      const row = document.createElement('div');
      row.className = 'attr';
      row.dataset.attr = id;
      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = ATTRIBUTE_NAMES[id].charAt(0);
      const info = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = ATTRIBUTE_NAMES[id];
      const value = document.createElement('span');
      value.className = 'value';
      const each = this.line('what', '');
      const now = this.line('numbers', '');
      info.append(name, value, each, now);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'act learn';
      plus.textContent = '+';
      plus.title = `Pôr um ponto em ${ATTRIBUTE_NAMES[id]}`;
      plus.addEventListener('click', () => this.addPoint(id));
      row.append(letter, info, plus);
      this.attrRows.set(id, { value, now, each, plus });
      return row;
    });
    this.attrReset.type = 'button';
    this.attrReset.className = 'act reset';
    this.attrReset.addEventListener('click', () => {
      this.attrReset.blur();
      if (performance.now() < this.attrResetAsking) {
        this.attrResetAsking = 0;
        this.actions.resetAttributes();
      } else {
        this.attrResetAsking = performance.now() + CONFIRM_MS;
        window.clearTimeout(this.attrResetTimer);
        this.attrResetTimer = window.setTimeout(() => {
          this.attrResetAsking = 0;
          this.refreshAttributes();
        }, CONFIRM_MS);
      }
      this.refreshAttributes();
    });
    this.attrBody.append(intro, ...rows, this.attrReset);
    this.refreshAttributes();
  }

  /** Um ponto a mais: já aparece aqui (o servidor confere e manda os números de verdade logo depois). */
  private addPoint(id: AttributeId): void {
    if (this.attrPoints <= 0) return;
    this.attrPoints -= 1;
    this.attrs = { ...this.attrs, [id]: this.attrs[id] + 1 };
    this.actions.addAttribute(id);
    this.refreshBadges();
    this.refreshAttributes();
    this.refreshHeader();
  }

  /** Os números da aba dos atributos (no lugar, sem refazer os botões). */
  private refreshAttributes(): void {
    for (const id of ATTRIBUTE_IDS) {
      const row = this.attrRows.get(id);
      if (!row) continue;
      const text = attributeText(id, this.attrs, this.rules);
      row.value.textContent = String(this.attrs[id]);
      row.each.textContent = text.each;
      row.now.textContent = text.now ? `Agora: ${text.now}` : '';
      row.plus.disabled = this.attrPoints <= 0;
    }
    const spent = ATTRIBUTE_IDS.some((id) => this.attrs[id] > 0);
    this.attrReset.hidden = !spent;
    const asking = performance.now() < this.attrResetAsking;
    this.attrReset.textContent = asking ? 'Tem certeza? Toque de novo' : 'Recomeçar os atributos (de graça, por enquanto)';
    this.attrReset.classList.toggle('confirm', asking);
  }

  /** Tem alguma habilidade que aceita um ponto agora? */
  private canLearnSomething(): boolean {
    const cls = this.classes.find((c) => c.id === this.hero.class);
    return !!cls && cls.skills.some((skill) => learnBlocker(cls, skill, this.level, this.hero.skills) === null);
  }

  private render(): void {
    this.refreshHeader();
    const onAttrs = this.tab === 'attrs';
    this.body.hidden = onAttrs;
    this.attrBody.hidden = !onAttrs;
    if (onAttrs) {
      this.refreshAttributes();
      return;
    }
    const cls = this.classes.find((c) => c.id === this.hero.class);
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
    window.clearTimeout(this.attrResetTimer);
    this.panel.remove();
    this.button.remove();
  }
}
