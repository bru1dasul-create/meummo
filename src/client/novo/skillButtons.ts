// Os botões das habilidades da classe que ainda não têm quadrado próprio na barra da [arte]: da 2ª em diante (a 1ª
// fica no quadrado que era da Bordunada). PROVISÓRIO, como o botão da defesa foi: o mesmo jeito dos botões da barra
// (as classes `.action`, `.art`, `.icon`, `.cd`, `.label` e `.key` do style.css), no PC no 6º quadrado da moldura e no
// celular em cima do quadrado da 1ª habilidade. A [arte] leva para a barra quando fizer os quadrados novos.

export interface ExtraSkillDef {
  id: string;
  name: string;
  /** O nome da tecla ('R'). */
  key: string;
  icon: string;
}

interface ExtraButton {
  def: ExtraSkillDef;
  el: HTMLButtonElement;
  cd: HTMLSpanElement;
  secs: HTMLSpanElement;
  readyAt: number;
  duration: number;
  shownSecs: number;
}

export class ExtraSkillButtons {
  private readonly style = document.createElement('style');
  private buttons: ExtraButton[] = [];

  constructor(private readonly onPress: (skillId: string) => void) {
    this.style.textContent = `
      #actions .action.extra-skill { --i: 5; }
      #actions .action.extra-skill + .action.extra-skill { --i: 6; }
      @media (pointer: coarse) {
        body.jogo-novo #actions .action.extra-skill { position: absolute; right: 76px; bottom: calc(100% + 12px); left: auto; top: auto; width: 64px; height: 64px; }
      }`;
    document.head.append(this.style);
  }

  /**
   * Monta os botões destas habilidades dentro da barra (chamar depois de cada barra nova: ela apaga o que tiver dentro
   * dela). As recargas que estavam correndo continuam (vêm de `readyAt`).
   */
  build(defs: ExtraSkillDef[], readyAt: (id: string) => { at: number; duration: number }): void {
    for (const button of this.buttons) button.el.remove();
    this.buttons = [];
    const root = document.getElementById('actions');
    if (!root) return;
    for (const def of defs) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'action extra-skill';
      el.tabIndex = -1;
      el.dataset.slot = 'class-extra';
      el.dataset.skill = def.id;
      el.title = `${def.name} (${def.key})`;
      const art = document.createElement('span');
      art.className = 'art';
      const icon = document.createElement('img');
      icon.className = 'icon';
      icon.src = def.icon;
      icon.alt = '';
      icon.draggable = false;
      const secs = document.createElement('span');
      secs.className = 'secs';
      art.append(icon, secs);
      const cd = document.createElement('span');
      cd.className = 'cd';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = def.name;
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = def.key;
      key.dataset.key = def.key;
      if (def.key.length > 4) key.classList.add('longer');
      else if (def.key.length > 2) key.classList.add('long');
      el.append(art, cd, label, key);
      el.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        el.classList.add('pressed');
        this.onPress(def.id);
      });
      const up = () => el.classList.remove('pressed');
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', (event) => event.preventDefault());
      root.append(el);
      const ready = readyAt(def.id);
      this.buttons.push({ def, el, cd, secs, readyAt: ready.at, duration: ready.duration, shownSecs: 0 });
    }
  }

  setCooldown(id: string, readyAt: number, duration: number): void {
    const button = this.buttons.find((b) => b.def.id === id);
    if (!button) return;
    button.readyAt = readyAt;
    button.duration = duration;
  }

  /** O "relógio" da recarga de cada botão (como na barra). Chamado todo quadro. */
  update(now: number): void {
    for (const button of this.buttons) {
      const remaining = Math.max(0, button.readyAt - now);
      const fraction = button.duration > 0 ? remaining / button.duration : 0;
      button.cd.style.transform = `scaleY(${fraction.toFixed(3)})`;
      button.el.classList.toggle('cooling', remaining > 0);
      const secs = remaining > 0 ? Math.ceil(remaining / 1000) : 0;
      if (secs !== button.shownSecs) {
        button.shownSecs = secs;
        button.secs.textContent = secs > 0 ? String(secs) : '';
      }
    }
  }

  destroy(): void {
    for (const button of this.buttons) button.el.remove();
    this.buttons = [];
    this.style.remove();
  }
}
