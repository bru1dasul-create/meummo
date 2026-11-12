// Joystick na tela do celular: encostar e arrastar na metade esquerda da tela anda naquela direção (na tela).
// Solto, para. O resto da tela continua servindo para tocar no chão (andar até lá) ou num personagem.

const DEAD_ZONE = 12; // pixels: arrastar menos que isso não anda
const RADIUS = 56; // tamanho do joystick desenhado

export class Joystick {
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private dx = 0;
  private dy = 0;

  constructor(private readonly surface: HTMLElement) {
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
  }

  /** Para onde o joystick aponta (na tela, de -1 a 1), ou null se está solto ou no centro. */
  direction(): { dx: number; dy: number } | null {
    if (this.pointerId === null) return null;
    const length = Math.hypot(this.dx, this.dy);
    if (length < DEAD_ZONE) return null;
    return { dx: this.dx / length, dy: this.dy / length };
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
    this.base.remove();
  }

  private readonly down = (event: PointerEvent) => {
    // só toque (no mouse, o clique é para andar até o ponto) e só na metade esquerda
    if (event.pointerType === 'mouse' || this.pointerId !== null || event.clientX > window.innerWidth * 0.45) return;
    this.pointerId = event.pointerId;
    this.originX = event.clientX;
    this.originY = event.clientY;
    this.dx = 0;
    this.dy = 0;
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
    const k = length > RADIUS ? RADIUS / length : 1;
    this.knob.style.transform = `translate(${this.dx * k}px, ${this.dy * k}px)`;
  };

  private readonly up = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.base.style.display = 'none';
  };
}
