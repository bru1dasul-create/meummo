// A cor do perigo de um bicho (os Olhos de Gavião: o contorno na tela e o ponto no mini mapa): verde (fácil), amarelo
// (parelho) ou vermelho (perigoso), pela diferença de nível para quem está olhando.

/** A cor do perigo de um bicho deste nível para quem está no nível `mine`. */
export function dangerColor(level: number, mine: number): string {
  const diff = level - mine;
  if (diff >= 2) return '#ff5a4a'; // perigoso
  if (diff <= -2) return '#7bd389'; // fácil
  return '#f2c14e'; // parelho
}
