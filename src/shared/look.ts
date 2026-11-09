/** Hash FNV-1a de 32 bits: rápido e sempre dá o mesmo resultado para o mesmo texto. */
export function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A aparência vem do nome: o mesmo nome sempre tem o mesmo visual. */
export function lookFromName(name: string): number {
  return hash32(name.toLocaleLowerCase('pt-BR'));
}
