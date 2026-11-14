// Teclas do jogo 2.5D (pedido do dono, 14/11): esquiva no Shift (configurável), pulo no Espaço e o mapa no M. O
// jogador troca a tecla de cada ação; fica guardado neste aparelho.

import { describe, expect, it } from 'vitest';
import { KeyBindings, KEYS_STORAGE, keyName, refusalOf } from '../src/client/novo/keys';

/** Um "localStorage" de mentira. */
function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('teclas: o padrão', () => {
  it('Shift esquiva (os dois Shifts), Espaço pula, M é o mapa e o som fica sem tecla', () => {
    const keys = new KeyBindings(fakeStore());
    expect(keys.actionOf('ShiftLeft')).toBe('esquiva');
    expect(keys.actionOf('ShiftRight')).toBe('esquiva');
    expect(keys.actionOf('Space')).toBe('pular');
    expect(keys.actionOf('KeyM')).toBe('mapa');
    expect(keys.actionOf('KeyJ')).toBe('atirar');
    expect(keys.actionOf('KeyF')).toBe('defesa');
    expect(keys.actionOf('KeyC')).toBe('devagar');
    expect(keys.get('som').code).toBe('');
    expect(keys.label('esquiva')).toBe('Shift');
    expect(keys.label('pular')).toBe('Espaço');
    expect(keys.isDefault()).toBe(true);
  });

  it('as teclas de andar e as fixas não têm ação trocável', () => {
    const keys = new KeyBindings(fakeStore());
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'Digit1', 'Digit3', 'Escape', 'Enter', 'KeyG']) {
      expect(keys.actionOf(code)).toBeNull();
    }
  });
});

describe('teclas: trocar', () => {
  it('trocar a esquiva para o Q: a Bordunada (que era do Q) fica com o Shift', () => {
    const store = fakeStore();
    const keys = new KeyBindings(store);
    expect(keys.set('esquiva', 'KeyQ', 'q')).toBeNull();
    expect(keys.actionOf('KeyQ')).toBe('esquiva');
    expect(keys.actionOf('ShiftLeft')).toBe('golpe');
    expect(keys.label('esquiva')).toBe('Q');
    // guardou neste aparelho: abrir de novo lembra
    const again = new KeyBindings(store);
    expect(again.actionOf('KeyQ')).toBe('esquiva');
    expect(again.actionOf('Shift')).toBe('golpe');
  });

  it('recusa as teclas de andar, as fixas e as que o navegador usa (e nada muda)', () => {
    const keys = new KeyBindings(fakeStore());
    expect(keys.set('pular', 'KeyW')).toMatch(/andar/);
    expect(keys.set('pular', 'ArrowLeft')).toMatch(/andar/);
    expect(keys.set('pular', 'Digit3')).toMatch(/fixa/);
    expect(keys.set('pular', 'ControlLeft')).toMatch(/não serve/);
    expect(keys.set('pular', 'AltLeft')).toMatch(/não serve/);
    expect(keys.set('pular', 'F5')).toMatch(/não serve/);
    expect(keys.set('pular', 'CapsLock')).toMatch(/não serve/);
    expect(keys.actionOf('Space')).toBe('pular');
    expect(refusalOf('KeyZ')).toBeNull();
  });

  it('dar uma tecla ao som e tirar a de outra ação (fica sem tecla)', () => {
    const keys = new KeyBindings(fakeStore());
    expect(keys.set('som', 'KeyN', 'n')).toBeNull();
    expect(keys.actionOf('KeyN')).toBe('som');
    keys.clear('mapa');
    expect(keys.actionOf('KeyM')).toBeNull();
    expect(keys.label('mapa')).toBe('—');
  });

  it('pôr numa ação sem tecla a tecla de outra: a outra fica sem', () => {
    const keys = new KeyBindings(fakeStore());
    expect(keys.set('som', 'KeyM')).toBeNull();
    expect(keys.actionOf('KeyM')).toBe('som');
    expect(keys.get('mapa').code).toBe('');
  });

  it('voltar ao padrão apaga o que estava guardado', () => {
    const store = fakeStore();
    const keys = new KeyBindings(store);
    keys.set('esquiva', 'KeyZ', 'z');
    expect(store.data.has(KEYS_STORAGE)).toBe(true);
    keys.reset();
    expect(keys.isDefault()).toBe(true);
    expect(store.data.has(KEYS_STORAGE)).toBe(false);
  });
});

describe('teclas: o que estava guardado', () => {
  it('lixo, tecla fixa ou ação que não existe: fica no padrão', () => {
    expect(new KeyBindings(fakeStore({ [KEYS_STORAGE]: '{não é json' })).isDefault()).toBe(true);
    const keys = new KeyBindings(fakeStore({ [KEYS_STORAGE]: JSON.stringify({ esquiva: { code: 'KeyW' }, voar: { code: 'KeyX' }, pular: 'Space' }) }));
    expect(keys.isDefault()).toBe(true);
  });

  it('sem armazenamento (navegador fechado para isso): funciona, só não lembra', () => {
    const keys = new KeyBindings(null);
    expect(keys.set('pular', 'KeyX', 'x')).toBeNull();
    expect(keys.actionOf('KeyX')).toBe('pular');
  });
});

describe('teclas: o nome que aparece', () => {
  it('letras, números, Espaço e a pontuação do teclado brasileiro (ou a do teclado de quem apertou)', () => {
    expect(keyName('KeyZ')).toBe('Z');
    expect(keyName('Digit7')).toBe('7');
    expect(keyName('Numpad5')).toBe('Num 5');
    expect(keyName('Space')).toBe('Espaço');
    expect(keyName('Semicolon')).toBe('Ç');
    expect(keyName('Semicolon', ';')).toBe(';'); // teclado americano
    expect(keyName('Quote', 'Dead')).toBe('~'); // o acento não escreve sozinho: vale o ABNT2
    expect(keyName('')).toBe('—');
  });
});
