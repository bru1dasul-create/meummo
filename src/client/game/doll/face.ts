// Expressões do rosto: desenhadas por cima da cabeça, numa camada separada do corpo. Assim o personagem
// pisca, faz careta quando apanha, sorri quando sobe de nível e mexe a boca quando fala no chat — sem
// precisar de uma textura nova para cada combinação de roupa.
// Caixa de 16x14 em volta do centro da cabeça (veja faceOrigin em poses.ts).

import type { BodyLook } from './body';
import { darken, ramp } from './palette';
import { rgba, Sheet } from './sheet';

export type Expression = 'normal' | 'blink' | 'hurt' | 'happy' | 'talk' | 'ko';
export const EXPRESSIONS: readonly Expression[] = ['normal', 'blink', 'hurt', 'happy', 'talk', 'ko'];

export const FACE_W = 16;
export const FACE_H = 14;

// Letras: E cílio/olho fechado | W brilho do olho | I íris | i pupila | B sobrancelha | n sombra do nariz
//         m boca | M boca aberta | t dente/língua | b bochecha corada
// Linha 0 = 7 pixels acima do centro da cabeça; coluna 0 = 8 pixels à esquerda.
const blank = (rows: Record<number, string>): string[] => Array.from({ length: FACE_H }, (_, i) => rows[i] ?? '');

const DOWN: Record<Expression, string[]> = {
  normal: blank({ 6: '...BBB....BBB...', 7: '....EE....EE....', 8: '....WI....WI....', 9: '....Ii....Ii....', 11: '........n.......', 12: '.......mm.......' }),
  blink: blank({ 6: '...BBB....BBB...', 9: '....EE....EE....', 11: '........n.......', 12: '.......mm.......' }),
  hurt: blank({
    5: '....B......B....',
    6: '.....BB..BB.....',
    7: '....E......E....',
    8: '.....E....E.....',
    9: '....E......E....',
    11: '........n.......',
    12: '......MMMM......',
    13: '.......tt.......',
  }),
  happy: blank({
    6: '...BBB....BBB...',
    8: '....EE....EE....',
    9: '...E..E..E..E...',
    10: '..b..........b..',
    11: '......m..m......',
    12: '.......mm.......',
  }),
  talk: blank({ 6: '...BBB....BBB...', 7: '....EE....EE....', 8: '....WI....WI....', 9: '....Ii....Ii....', 11: '........n.......', 12: '.......MM.......', 13: '.......MM.......' }),
  ko: blank({
    6: '...BBB....BBB...',
    7: '...E.E....E.E...',
    8: '....E......E....',
    9: '...E.E....E.E...',
    11: '........n.......',
    12: '......m.m.......',
  }),
};
// de lado (olhando para a direita): um olho só, perto da frente do rosto
const SIDE: Record<Expression, string[]> = {
  normal: blank({ 6: '..........BBB...', 7: '...........EE...', 8: '...........WI...', 9: '...........Ii...', 12: '.............m..' }),
  blink: blank({ 6: '..........BBB...', 9: '...........EE...', 12: '.............m..' }),
  hurt: blank({ 5: '..........B.....', 6: '...........BB...', 7: '...........E....', 8: '............E...', 9: '...........E....', 12: '............MM..' }),
  happy: blank({ 6: '..........BBB...', 8: '...........EE...', 9: '..........E..E..', 10: '.........b......', 12: '............mm..' }),
  talk: blank({ 6: '..........BBB...', 7: '...........EE...', 8: '...........WI...', 9: '...........Ii...', 12: '.............M..', 13: '.............M..' }),
  ko: blank({ 6: '..........BBB...', 7: '..........E.E...', 8: '...........E....', 9: '..........E.E...', 12: '............m...' }),
};

function colors(look: BodyLook): Record<string, string> {
  const skin = ramp(look.skin, 'skin');
  const iris = ramp(look.eyes, 'cloth');
  return {
    E: '#1b1626',
    W: '#ffffff',
    I: iris[2],
    i: iris[0],
    B: darken(look.hair, 0.55),
    n: skin[1],
    m: skin[0],
    M: '#4a1820',
    t: '#d77a7a',
    b: '#e8848a',
  };
}

/** Desenha o rosto com o canto da caixa em (x, y). Sem rosto de costas. */
export function drawFace(sheet: Sheet, x: number, y: number, view: 'down' | 'side', expression: Expression, look: BodyLook): void {
  const palette = colors(look);
  (view === 'down' ? DOWN : SIDE)[expression].forEach((row, gy) => {
    for (let gx = 0; gx < row.length; gx++) {
      const c = palette[row[gx]!];
      if (c) sheet.set(x + gx, y + gy, rgba(c));
    }
  });
}

/** Folha com todos os rostos: linha 0 de frente, linha 1 de lado; uma coluna por expressão. */
export function buildFaceSheet(look: BodyLook): Sheet {
  const sheet = new Sheet(FACE_W * EXPRESSIONS.length, FACE_H * 2);
  EXPRESSIONS.forEach((e, i) => {
    drawFace(sheet, i * FACE_W, 0, 'down', e, look);
    drawFace(sheet, i * FACE_W, FACE_H, 'side', e, look);
  });
  return sheet;
}

export function faceFrame(view: 'down' | 'side', expression: Expression): number {
  return (view === 'down' ? 0 : EXPRESSIONS.length) + EXPRESSIONS.indexOf(expression);
}
