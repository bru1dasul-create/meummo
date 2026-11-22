// Teclas do jogo 2.5D (pedido do dono, 14/11): esquiva no Shift (configurável), pulo no Espaço e o mapa no M. O
// jogador troca a tecla de cada ação; fica guardado neste aparelho.

import { describe, expect, it } from 'vitest';
import { KeyBindings, KEYS_STORAGE, keyName, refusalOf } from '../src/client/novo/keys';
import { dangerColor } from '../src/client/novo/danger';

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
    expect(keys.actionOf('KeyQ')).toBe('hab1'); // a 1ª habilidade da classe (no lugar da Bordunada, desde 15/11)
    expect(keys.actionOf('KeyR')).toBe('hab2'); // a 2ª (a Flecha Ancestral, no Caçador)
    expect(keys.actionOf('KeyT')).toBe('hab3'); // a 3ª (os Olhos de Gavião)
    expect(keys.actionOf('KeyK')).toBe('habilidades');
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
  it('trocar a esquiva para o Q: a 1ª habilidade da classe (que era do Q) fica com o Shift', () => {
    const store = fakeStore();
    const keys = new KeyBindings(store);
    expect(keys.set('esquiva', 'KeyQ', 'q')).toBeNull();
    expect(keys.actionOf('KeyQ')).toBe('esquiva');
    expect(keys.actionOf('ShiftLeft')).toBe('hab1');
    expect(keys.label('esquiva')).toBe('Q');
    // guardou neste aparelho: abrir de novo lembra
    const again = new KeyBindings(store);
    expect(again.actionOf('KeyQ')).toBe('esquiva');
    expect(again.actionOf('Shift')).toBe('hab1');
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

  it('a tecla que o jogador deu à Bordunada (até 15/11) fica com a 1ª habilidade da classe', () => {
    const keys = new KeyBindings(fakeStore({ [KEYS_STORAGE]: JSON.stringify({ golpe: { code: 'KeyY', label: 'Y' } }) }));
    expect(keys.actionOf('KeyY')).toBe('hab1');
    expect(keys.actionOf('KeyQ')).toBeNull();
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

describe('os Olhos de Gavião: a cor do perigo de cada bicho', () => {
  it('2 níveis ou mais acima de você: vermelho; parelho (até 1 de diferença): amarelo; 2 ou mais abaixo: verde', () => {
    expect(dangerColor(16, 14)).toBe('#ff5a4a');
    expect(dangerColor(15, 14)).toBe('#f2c14e');
    expect(dangerColor(13, 14)).toBe('#f2c14e');
    expect(dangerColor(12, 14)).toBe('#7bd389');
  });
});

describe('o painel de ajustes do jogo (F1): os sliders', () => {
  it('o slider vai até umas 4 vezes o maior entre o padrão e o valor, num número redondo', async () => {
    const { sliderMax, sliderStep } = await import('../src/client/novo/debugPanel');
    expect(sliderMax(30, 30)).toBe(200); // a vida do quati: até 200
    expect(sliderMax(1100, 1100)).toBe(5000); // o tempo da puxada, em ms
    expect(sliderMax(0, 0)).toBe(5);
    expect(sliderMax(900, 30)).toBe(5000); // já ajustado para cima: o slider acompanha
    expect(sliderStep('inteiro', 200)).toBe(1);
    expect(sliderStep('inteiro', 5000)).toBe(10);
    expect(sliderStep('numero', 50)).toBe(0.1);
    expect(sliderStep('numero', 5)).toBe(0.05);
  });
});

describe('game feel (o tremor, a pausa no impacto, as faíscas): só da tela', () => {
  it('o impacto das habilidades cresce com os pontos e o degrau (pedido do dono: "sensação de impactos também por nível")', async () => {
    const { DEFAULT_FEEL, skillImpactPower, skillImpactFeel } = await import('../src/client/novo/feel');
    expect(skillImpactPower(1, 1)).toBe(0); // 1 ponto, puxada fraca: o mais fraco
    expect(skillImpactPower(5, 3)).toBe(1); // 5 pontos, puxada forte: o mais forte
    expect(skillImpactPower(3, 2)).toBeCloseTo(0.5);
    expect(skillImpactPower(5, 1)).toBeGreaterThan(skillImpactPower(1, 3)); // os pontos pesam um pouco mais
    // ligado no padrão (o tiro comum continua sem tremor): fraco = um tremorzinho sem pausa; forte = o máximo
    expect(skillImpactFeel(DEFAULT_FEEL, 0)).toEqual({ shakePx: 3, shakeMs: 150, stopMs: 0 });
    expect(skillImpactFeel(DEFAULT_FEEL, 1)).toEqual({ shakePx: 10, shakeMs: 300, stopMs: 60 });
    // desligado no F1 (0): nada
    expect(skillImpactFeel({ ...DEFAULT_FEEL, shakeSkillPx: 0, hitStopSkillMs: 0 }, 1)).toMatchObject({ shakePx: 0, stopMs: 0 });
  });

  it('o padrão é o jogo de antes; o guardado é conferido; o tremor some aos poucos', async () => {
    const { DEFAULT_FEEL, cleanFeel, changedFeel, shakeOffset } = await import('../src/client/novo/feel');
    expect(DEFAULT_FEEL).toMatchObject({ shakeHitPx: 0, shakeHurtPx: 0, hitStopMs: 0, particles: 0, hurtFlash: true });
    expect(cleanFeel(null)).toEqual(DEFAULT_FEEL);
    expect(cleanFeel({ shakeHitPx: 999, hitStopMs: -5, particles: 'muitas', hurtFlash: false })).toMatchObject({ shakeHitPx: 20, hitStopMs: 0, particles: 0, hurtFlash: false });
    expect(changedFeel({ ...DEFAULT_FEEL })).toEqual({});
    expect(changedFeel({ ...DEFAULT_FEEL, shakeHitPx: 6 })).toEqual({ shakeHitPx: 6 });
    // tremor de 10 px por 200 ms: no começo mexe até 10; no fim, parado
    const far = (t: number) => Math.hypot(shakeOffset(t, 1000, 200, 10).x, shakeOffset(t, 1000, 200, 10).y);
    expect(far(1010)).toBeGreaterThan(0);
    expect(far(1010)).toBeLessThanOrEqual(15);
    expect(far(1190)).toBeLessThan(far(1010) + 1);
    expect(shakeOffset(1200, 1000, 200, 10)).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(1100, 1000, 200, 0)).toEqual({ x: 0, y: 0 });
  });
});
