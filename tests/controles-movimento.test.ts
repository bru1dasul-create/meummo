import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyboardDirections } from '../src/client/game/input';
import { Joystick } from '../src/client/novo/joystick';
import { DOWN, DOWN_RIGHT, RIGHT, UP } from '../src/shared/dir';

beforeEach(() => vi.stubGlobal('window', Object.assign(new EventTarget(), { innerWidth: 800 })));
afterEach(() => vi.unstubAllGlobals());

function tecla(type: 'keydown' | 'keyup', code: string, repeat = false) {
  window.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code, repeat }));
}

describe('movimento pelo teclado', () => {
  it('continua andando se soltar W enquanto a seta para cima ainda está apertada', () => {
    const keys = new KeyboardDirections(() => false);
    tecla('keydown', 'KeyW');
    tecla('keydown', 'ArrowUp');
    tecla('keyup', 'KeyW');
    expect(keys.current()?.dir).toBe(UP);
    tecla('keyup', 'ArrowUp');
    expect(keys.current()).toBeNull();
    keys.destroy();
  });

  it('mantém a prioridade da última tecla e esquece as teclas ao perder o foco', () => {
    const keys = new KeyboardDirections(() => false);
    tecla('keydown', 'KeyW');
    tecla('keydown', 'KeyS');
    tecla('keydown', 'KeyD');
    tecla('keydown', 'KeyW', true);
    expect(keys.current()).toEqual({ dir: DOWN_RIGHT, fallbacks: [RIGHT, DOWN] });
    window.dispatchEvent(new Event('blur'));
    expect(keys.current()).toBeNull();
    keys.destroy();
  });
});

/** A superfície registra qual dedo capturou, como no navegador. */
class Superficie extends EventTarget {
  private captured = new Set<number>();
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) { this.captured.delete(id); }
}

function controle() {
  const surface = new Superficie();
  const tap = vi.fn();
  vi.stubGlobal('document', {
    body: { append() {} },
    createElement: () => ({ style: {}, append() {}, remove() {} }),
  });
  const stick = new Joystick(surface as unknown as HTMLElement, tap);
  const toque = (type: string, x: number, id = 1) => {
    const target = type === 'pointerdown' || type === 'lostpointercapture' ? surface : window;
    target.dispatchEvent(Object.assign(new Event(type), { pointerType: 'touch', pointerId: id, clientX: x, clientY: 180 }));
  };
  return { surface, stick, tap, toque };
}

describe('movimento pelo toque', () => {
  it('inverte depois de um arrasto comprido e mantém o passo lento perto do centro', () => {
    const { stick, tap, toque } = controle();
    toque('pointerdown', 100);
    toque('pointermove', 320);
    expect(stick.direction()).toEqual({ dx: 1, dy: 0, light: false });
    toque('pointermove', 244);
    expect(stick.direction()).toEqual({ dx: -1, dy: 0, light: true });
    toque('pointermove', 264);
    expect(stick.direction()).toBeNull();
    toque('pointerup', 264);
    expect(tap).not.toHaveBeenCalled();
    stick.destroy();
  });

  it('distingue toque de arrasto mesmo quando só a soltura chega longe da origem', () => {
    const { stick, tap, toque } = controle();
    toque('pointerdown', 110);
    toque('pointerup', 145);
    toque('pointerdown', 110);
    toque('pointerup', 112);
    expect(tap.mock.calls).toEqual([[110, 180]]);
    stick.destroy();
  });

  it('um segundo dedo não interrompe o movimento e perder a captura solta o joystick', () => {
    const { surface, stick, tap, toque } = controle();
    toque('pointerdown', 100);
    toque('pointermove', 140);
    toque('pointerdown', 160, 2);
    toque('pointerup', 160, 2);
    expect(surface.hasPointerCapture(1)).toBe(true);
    expect(stick.direction()?.dx).toBe(1);
    toque('lostpointercapture', 140);
    expect(surface.hasPointerCapture(1)).toBe(false);
    expect(stick.direction()).toBeNull();
    expect(tap).not.toHaveBeenCalled();
    stick.destroy();
  });
});
