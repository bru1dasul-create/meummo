// Regras de nome e de senha dos personagens (iguais no navegador e no servidor).

export const NAME_MIN = 3;
export const NAME_MAX = 16;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;

export type NameProblem = 'short' | 'long' | 'chars';
export type PasswordProblem = 'short' | 'long';

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

/** "Ana", "ANA" e "ana" são o mesmo personagem. */
export function nameKey(name: string): string {
  return normalizeName(name).toLocaleLowerCase('pt-BR');
}

/** Valida uma senha (qualquer caractere vale; só o tamanho importa). Retorna null quando está tudo certo. */
export function passwordProblem(password: string): PasswordProblem | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN) return 'short';
  if (length > PASSWORD_MAX) return 'long';
  return null;
}
