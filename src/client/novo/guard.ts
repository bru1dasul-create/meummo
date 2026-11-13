// Botão da defesa do jogo novo (combate passo 2b): segurar levanta a defesa, soltar baixa. No PC também vale a tecla F.
// Visual simples (botão redondo perto dos atalhos de comida e remédio); a [arte] restiliza (#guard-button) ou leva
// para a HUD nova. A energia aparece embaixo do pé (desenho do combate, src/client/novo/combat.ts).

export class GuardButton {
  private readonly el = document.createElement('button');
  private readonly style = document.createElement('style');
  private pointer: number | null = null;

  constructor(
    private readonly onDown: () => void,
    private readonly onUp: () => void,
  ) {
    // provisório (a [arte] leva para o style.css): no PC, à direita dos atalhos; no celular, em cima deles
    this.style.textContent = `
      #guard-button { position: fixed; left: calc(50% + 316px); bottom: calc(14px + env(safe-area-inset-bottom)); z-index: 6; width: 58px; height: 58px; border-radius: 50%; border: 2px solid var(--frame, #b8893a); background: var(--wood, #2b1d12); color: #e9d8b0; padding: 0; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; font: 700 11px system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
      #guard-button .shield { width: 22px; height: 24px; background: #b8ebf0; clip-path: polygon(50% 0, 100% 16%, 92% 62%, 50% 100%, 8% 62%, 0 16%); opacity: 0.9; }
      #guard-button .key { position: absolute; left: 7px; top: 3px; font: 600 10px system-ui, sans-serif; opacity: 0.8; }
      #guard-button.held { background: #3b5a5e; border-color: #b8ebf0; }
      #guard-button.broken .shield { background: #f3a25b; }
      @media (pointer: coarse) {
        #guard-button { left: auto; right: calc(164px + env(safe-area-inset-right)); bottom: calc(146px + env(safe-area-inset-bottom)); }
        #guard-button .key { display: none; }
      }`;
    document.head.append(this.style);
    this.el.id = 'guard-button';
    this.el.type = 'button';
    this.el.tabIndex = -1;
    this.el.title = 'Defender (segure F)';
    const shield = document.createElement('span');
    shield.className = 'shield';
    const label = document.createElement('span');
    label.textContent = 'Defesa';
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = 'F';
    this.el.append(shield, label, key);
    this.el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.pointer !== null) return;
      this.pointer = event.pointerId;
      try {
        this.el.setPointerCapture(event.pointerId); // o soltar chega aqui mesmo se o dedo escorregar para fora
      } catch {
        // sem captura: o pointerup/cancel do próprio botão ainda soltam
      }
      this.onDown();
    });
    const release = (event: PointerEvent) => {
      if (this.pointer !== event.pointerId) return;
      this.pointer = null;
      this.onUp();
    };
    this.el.addEventListener('pointerup', release);
    this.el.addEventListener('pointercancel', release);
    this.el.addEventListener('lostpointercapture', release);
    this.el.addEventListener('contextmenu', (event) => event.preventDefault());
    document.body.append(this.el);
  }

  /** Mostra se está segurando e se a defesa quebrou. */
  show(held: boolean, broken: boolean): void {
    this.el.classList.toggle('held', held && !broken);
    this.el.classList.toggle('broken', broken);
  }

  /** Esquece o dedo que segurava (o jogo soltou a defesa por conta própria: desmaio, troca de mapa). */
  reset(): void {
    this.pointer = null;
    this.show(false, false);
  }

  destroy(): void {
    this.el.remove();
    this.style.remove();
  }
}
