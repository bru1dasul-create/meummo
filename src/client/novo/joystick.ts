// Joystick na tela do celular: encostar e arrastar na metade esquerda da tela anda naquela direção (na tela).
// Solto, para. Um toque rápido, sem arrastar, vale como tocar no chão ali (andar até lá ou falar com quem está lá),
// como no resto da tela.

const DEAD_ZONE = 12; // pixels: arrastar menos que isso não anda
const RADIUS = 56; // tamanho do joystick desenhado
const TAP_MS = 300; // encostou e soltou antes disto, sem arrastar: foi um toque, não o joystick

export class Joystick {
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private dx = 0;
  private dy = 0;
  private downAt = 0;
  private dragged = false;

  constructor(
    private readonly surface: HTMLElement,
    /** Toque rápido sem arrastar na área do joystick: o jogo trata como tocar no chão ali. */
    private readonly onTap: (clientX: number, clientY: number) => void = () => {},
  ) {
    this.base = document.createElement('div');
    this.base.style.cssText = `position:fixed;width:${RADIUS * 2}px;height:${RADIUS * 2}px;border-radius:50%;border:2px solid rgba(255,255,255,.45);background:rgba(0,0,0,.18);pointer-events:none;display:none;z-index:5;`;
    this.knob = document.createElement('div');
    this.knob.style.cssText = 'position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(255,236,160,.75);left:50%;top:50%;margin:-22px 0 0 -22px;';
    this.base.append(this.knob);
    document.body.append(this.base);
    surface.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    surface.addEventListener('lostpointercapture', this.up);
  }

  /**
   * Para onde o joystick aponta (na tela, de -1 a 1) e se está empurrado só um pouco (`light`: andar devagar),
   * ou null se está solto ou no centro.
   */
  direction(): { dx: number; dy: number; light: boolean } | null {
    if (this.pointerId === null) return null;
    const length = Math.hypot(this.dx, this.dy);
    if (length < DEAD_ZONE) return null;
    return { dx: this.dx / length, dy: this.dy / length, light: length < RADIUS * 0.55 };
  }

  /** O toque começou no joystick (o jogo não deve tratar como toque no chão). */
  owns(event: PointerEvent): boolean {
    return event.pointerId === this.pointerId;
  }

  destroy(): void {
    this.surface.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
    this.surface.removeEventListener('lostpointercapture', this.up);
    this.reset();
    this.base.remove();
  }

  reset(): void {
    const pointer = this.pointerId;
    this.pointerId = null;
    this.base.style.display = 'none';
    if (pointer !== null && this.surface.hasPointerCapture(pointer)) this.surface.releasePointerCapture(pointer);
  }

  private readonly down = (event: PointerEvent) => {
    // só toque (no mouse, o clique é para andar até o ponto) e só na metade esquerda
    if (event.pointerType === 'mouse' || this.pointerId !== null || event.clientX > window.innerWidth * 0.45) return;
    this.pointerId = event.pointerId;
    this.originX = event.clientX;
    this.originY = event.clientY;
    this.dx = 0;
    this.dy = 0;
    this.downAt = performance.now();
    this.dragged = false;
    // A captura mantém o gesto mesmo que o polegar deslize por cima de outro controle.
    try { this.surface.setPointerCapture(event.pointerId); } catch { /* os eventos da janela continuam valendo */ }
    this.base.style.left = `${event.clientX - RADIUS}px`;
    this.base.style.top = `${event.clientY - RADIUS}px`;
    this.base.style.display = 'block';
    this.knob.style.transform = 'translate(0, 0)';
  };

  private readonly move = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return;
    this.dx = event.clientX - this.originX;
    this.dy = event.clientY - this.originY;
    const length = Math.hypot(this.dx, this.dy);
    if (length >= DEAD_ZONE) this.dragged = true;
    if (length > RADIUS) {
      const scale = RADIUS / length;
      this.dx *= scale;
      this.dy *= scale;
      this.originX = event.clientX - this.dx;
      this.originY = event.clientY - this.dy;
      this.base.style.left = `${this.originX - RADIUS}px`;
      this.base.style.top = `${this.originY - RADIUS}px`;
    }
    this.knob.style.transform = `translate(${this.dx}px, ${this.dy}px)`;
  };

  private readonly up = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return;
    if (event.type === 'lostpointercapture' && event.target !== this.surface) return;
    const tapped = event.type === 'pointerup' && !this.dragged &&
      Math.hypot(event.clientX - this.originX, event.clientY - this.originY) < DEAD_ZONE &&
      performance.now() - this.downAt < TAP_MS;
    this.reset();
    if (tapped) this.onTap(this.originX, this.originY);
  };
}
