// O retrato do herói 2.5D (PD.portrait, em prototipos/pindorama-25d/js/portrait.js) para a interface: o círculo da
// HUD e o boneco da mochila. Só existe no jogo novo (os scripts do 2.5D carregam junto com o motor); no jogo antigo
// as funções daqui devolvem false e cada tela usa o desenho de antes.

export interface HeroPortraitOptions {
  /** 'head': cabeça e ombros com fundo escuro; 'full': corpo inteiro, fundo transparente. */
  mode: 'head' | 'full';
  /** Para onde olha, em graus no chão (45 = de frente para a câmera). */
  yaw?: number;
}

type PortraitFn = (canvas: HTMLCanvasElement, opts: HeroPortraitOptions & { dpr: number }) => boolean;

function portraitFn(): PortraitFn | null {
  const pd = (window as unknown as { PD?: { portrait?: PortraitFn } }).PD;
  return typeof pd?.portrait === 'function' ? pd.portrait : null;
}

/** O desenho 2.5D já carregou (jogo novo)? */
export function hasHeroPortrait(): boolean {
  return portraitFn() !== null;
}

/**
 * Desenha o herói no canvas, do tamanho que ele tem na tela (o canvas ganha os px de verdade da tela). Devolve false
 * se não deu (2.5D não carregado ou canvas escondido): quem chamou tenta de novo depois.
 */
export function drawHeroPortrait(canvas: HTMLCanvasElement, opts: HeroPortraitOptions): boolean {
  const draw = portraitFn();
  if (!draw) return false;
  const box = canvas.getBoundingClientRect();
  if (box.width < 4 || box.height < 4) return false;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  try {
    return draw(canvas, { ...opts, dpr });
  } catch {
    return false; // o retrato é enfeite: um erro no desenho não pode derrubar a HUD
  }
}
