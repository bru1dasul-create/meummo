// A dica das habilidades da barra (pedido do dono, 15/11): com o mouse em cima de um quadrado, um quadrinho diz o que
// ela faz, o dano e a recarga. Só com o mouse (no celular, tocar usa a habilidade; lá os números ficam na janela das
// Habilidades). O visual é da [arte] (style.css, classes `.skill-tip`, `.skill-tip-title`, `.skill-tip-line`).

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
    // só o que é de lugar; a cara (cor, borda, fundo, letra) é da [arte], em style.css
    Object.assign(this.box.style, { position: 'fixed', zIndex: '60', pointerEvents: 'none' });
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
