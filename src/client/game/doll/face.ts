// Expressões do rosto: desenhadas por cima da cabeça, numa camada separada do corpo. Assim o personagem
// pisca, faz careta quando apanha, sorri quando sobe de nível e mexe a boca quando fala no chat — sem
// precisar de uma textura nova para cada combinação de roupa.
// Caixa de 12x12 em volta do centro da cabeça (veja faceOrigin em poses.ts).

import type { BodyLook } from './body';
import { darken, ramp } from './palette';
import { rgba, Sheet } from './sheet';

export type Expression = 'normal' | 'blink' | 'hurt' | 'happy' | 'talk' | 'ko';
export const EXPRESSIONS: readonly Expression[] = ['normal', 'blink', 'hurt', 'happy', 'talk', 'ko'];

export const FACE_W = 12;
export const FACE_H = 12;

// Letras: E cílio/olho fechado | W brilho do olho | I íris | i pupila | B sobrancelha | n sombra do nariz
//         m boca | M boca aberta | b bochecha corada
// Linha 0 = 6 pixels acima do centro da cabeça; coluna 0 = 6 pixels à esquerda.
const blank = (rows: Record<number, string>): string[] => Array.from({ length: FACE_H }, (_, i) => rows[i] ?? '');

const DOWN: Record<Expression, string[]> = {
  normal: blank({ 5: '..BBB..BBB..', 6: '...EE..EE...', 7: '...WI..IW...', 8: '...Ii..iI...', 9: '......n.....', 10: '.....mm.....' }),
  blink: blank({ 5: '..BBB..BBB..', 8: '...EE..EE...', 9: '......n.....', 10: '.....mm.....' }),
  hurt: blank({
    4: '....B..B....',
    5: '..BB....BB..',
    6: '...E....E...',
    7: '....E..E....',
    8: '...E....E...',
    9: '......n.....',
    10: '.....MM.....',
    11: '.....MM.....',
  }),
  happy: blank({ 5: '..BBB..BBB..', 7: '...EE..EE...', 9: '..b......b..', 10: '....m..m....', 11: '.....mm.....' }),
  talk: blank({ 5: '..BBB..BBB..', 6: '...EE..EE...', 7: '...WI..IW...', 8: '...Ii..iI...', 9: '......n.....', 10: '.....MM.....', 11: '.....MM.....' }),
  ko: blank({ 5: '..BBB..BBB..', 6: '..E.E..E.E..', 7: '...E....E...', 8: '..E.E..E.E..', 9: '......n.....', 10: '....m.m.....' }),
};
// de lado (olhando para a direita): um olho só, perto da frente do rosto
const SIDE: Record<Expression, string[]> = {
  normal: blank({ 5: '.......BBB..', 6: '........EE..', 7: '........WI..', 8: '........Ii..', 10: '..........m.' }),
  blink: blank({ 5: '.......BBB..', 8: '........EE..', 10: '..........m.' }),
  hurt: blank({ 4: '.......B....', 5: '........BB..', 6: '........E...', 7: '.........E..', 8: '........E...', 10: '.........MM.' }),
  happy: blank({ 5: '.......BBB..', 7: '........EE..', 9: '.......b....', 10: '.........mm.' }),
  talk: blank({ 5: '.......BBB..', 6: '........EE..', 7: '........WI..', 8: '........Ii..', 10: '..........M.', 11: '..........M.' }),
  ko: blank({ 5: '.......BBB..', 6: '.......E.E..', 7: '........E...', 8: '.......E.E..', 10: '.........m..' }),
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

// Sorriso (rosto parado de NPC simpático) e óculos redondinhos (por cima de tudo): G = armação
const SMILE: Record<'down' | 'side', Record<number, string>> = {
  down: { 10: '....m..m....', 11: '.....mm.....' },
  side: { 10: '.........m..', 11: '..........m.' },
};
const GLASSES: Record<'down' | 'side', string[]> = {
  down: blank({ 6: '..GGG..GGG..', 7: '..G..GG..G..', 8: '..G..G.G.G..', 9: '...GG...GG..' }),
  side: blank({ 6: '.......GGG..', 7: 'GGGGGGG...G.', 8: '.......G..G.', 9: '........GG..' }),
};

/** Desenha o rosto com o canto da caixa em (x, y). Sem rosto de costas. */
export function drawFace(sheet: Sheet, x: number, y: number, view: 'down' | 'side', expression: Expression, look: BodyLook): void {
  const palette: Record<string, string> = { ...colors(look), G: look.glasses ?? '' };
  let rows = (view === 'down' ? DOWN : SIDE)[expression];
  if (look.smile && (expression === 'normal' || expression === 'blink')) {
    rows = rows.map((row, i) => (i === 10 ? '' : row)).map((row, i) => SMILE[view][i] ?? row);
  }
  const paint = (art: string[]) =>
    art.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) {
        const c = palette[row[gx]!];
        if (c) sheet.set(x + gx, y + gy, rgba(c));
      }
    });
  paint(rows);
  if (look.glasses) paint(GLASSES[view]);
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
