// A dica das habilidades da barra (pedido do dono, 15/11): com o mouse em cima de um quadrado, um quadrinho diz o que
// ela faz, o dano e a recarga. Só com o mouse (no celular, tocar usa a habilidade; lá os números ficam na janela das
// Habilidades). O visual é simples, do jeito da [estrutura]: a [arte] pode vestir pelas classes `.skill-tip`.

export interface SkillTipText {
  title: string;
  /** Frases curtas, uma por linha. */
  lines: string[];
}

export class SkillTip {
  private readonly box = document.createElement('div');
  private readonly root = document.getElementById('actions');
  private shown: HTMLElement | null = null;

  constructor(private readonly textOf: (slot: string) => SkillTipText | null) {
    this.box.className = 'skill-tip';
    this.box.hidden = true;
    Object.assign(this.box.style, {
      position: 'fixed',
      zIndex: '60',
      maxWidth: '280px',
      padding: '10px 12px',
      borderRadius: '10px',
      border: '1px solid rgba(214, 170, 92, 0.7)',
      background: 'rgba(24, 16, 10, 0.94)',
      color: '#f3e6cf',
      font: '14px/1.35 system-ui, sans-serif',
      pointerEvents: 'none',
      boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
    });
    document.body.append(this.box);
    this.root?.addEventListener('pointerover', this.onOver);
    this.root?.addEventListener('pointerout', this.onOut);
    this.root?.addEventListener('pointerdown', this.hide);
  }

  private readonly onOver = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const el = (event.target as HTMLElement | null)?.closest<HTMLElement>('.action');
    if (!el || el === this.shown) return;
    const text = el.dataset.slot ? this.textOf(el.dataset.slot) : null;
    if (!text) return this.hide();
    el.title = ''; // a dica do navegador não aparece por cima desta
    this.shown = el;
    const title = document.createElement('strong');
    title.className = 'skill-tip-title';
    title.textContent = text.title;
    Object.assign(title.style, { display: 'block', color: '#ffd98a', marginBottom: '4px', fontSize: '15px' });
    const lines = text.lines.map((line) => {
      const p = document.createElement('div');
      p.className = 'skill-tip-line';
      p.textContent = line;
      return p;
    });
    this.box.replaceChildren(title, ...lines);
    this.box.hidden = false;
    // em cima do quadrado, sem sair da tela
    const at = el.getBoundingClientRect();
    const box = this.box.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - box.width - 8, at.left + at.width / 2 - box.width / 2));
    const top = at.top - box.height - 10 >= 8 ? at.top - box.height - 10 : at.bottom + 10;
    this.box.style.left = `${Math.round(left)}px`;
    this.box.style.top = `${Math.round(top)}px`;
  };

  private readonly onOut = (event: PointerEvent) => {
    const to = event.relatedTarget as Node | null;
    if (this.shown && to && this.shown.contains(to)) return;
    this.hide();
  };

  readonly hide = (): void => {
    this.shown = null;
    this.box.hidden = true;
  };

  destroy(): void {
    this.root?.removeEventListener('pointerover', this.onOver);
    this.root?.removeEventListener('pointerout', this.onOut);
    this.root?.removeEventListener('pointerdown', this.hide);
    this.box.remove();
  }
}
