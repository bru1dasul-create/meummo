export const NAME_MIN = 3;
export const NAME_MAX = 16;

export type NameProblem = 'short' | 'long' | 'chars';

/** Limpa o nome: junta acentos, tira espaços repetidos e das pontas. */
export function normalizeName(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** Valida um nome já normalizado. Retorna null quando está tudo certo. */
export function nameProblem(name: string): NameProblem | null {
  const length = [...name].length;
  if (length < NAME_MIN) return 'short';
  if (length > NAME_MAX) return 'long';
  // Letras (com acento), números, espaço e _ — e pelo menos uma letra.
  if (!/^[\p{L}\p{N}_ ]+$/u.test(name) || !/\p{L}/u.test(name)) return 'chars';
  return null;
}
