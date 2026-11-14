// Ícones dos botões de habilidade. Jogo antigo: pixel art 16x16 desenhada por código, como os itens. Jogo 2.5D: os
// ícones pintados com brilho de paintedIcons.ts, no traço da HUD nova (a defesa também, que não é botão desta barra).
// Para trocar por arte de verdade: troque o desenho aqui ou devolva a URL de uma imagem em actionIconUrl.

import type { ActionSlot } from './ui';
import { drawIcon, type IconArt } from './itemArt';
import { paintedActionIcon } from './paintedIcons';

const ICONS: Record<ActionSlot, IconArt> = {
  // Estilingue: forquilha de madeira com o elástico vermelho
  shot: {
    colors: { D: '#9a6a3a', d: '#5e3c1e', r: '#e0533f', s: '#b9b2a4' },
    rows: [
      '................',
      '..d.........d...',
      '..Dd.......dD...',
      '..DDrrrrrrrDD...',
      '...DDr...rDD....',
      '....DDr.rDD.....',
      '.....DDsDD......',
      '......DDD.......',
      '.......DD.......',
      '.......DD.......',
      '.......Dd.......',
      '.......DD.......',
      '.......dD.......',
      '.......DD.......',
      '.......dd.......',
      '................',
    ],
  },
  // Bordunada: a borduna, clava de madeira com a empunhadura amarrada
  skill0: {
    colors: { D: '#8a5a2c', L: '#c08a52', d: '#5a3818', r: '#d9c27a' },
    rows: [
      '................',
      '...........DDD..',
      '..........DDDDD.',
      '.........DDLDDD.',
      '........DDLDDDD.',
      '........DLDDDDd.',
      '.......DDDDDdd..',
      '......DDDDdd....',
      '.....DDDd.......',
      '....DDd.........',
      '...rDd..........',
      '..rrd...........',
      '.rrd............',
      '.dd.............',
      '................',
      '................',
    ],
  },
  // Fôlego: folha de cura com um brilho
  skill1: {
    colors: { G: '#4fc25a', L: '#8be38a', g: '#2a7a34', W: '#f4ffe0' },
    rows: [
      '................',
      '..W.......GGGG..',
      '.WWW....GGGGGG..',
      '..W...GGGLGGGG..',
      '.....GGGLgGGGG..',
      '....GGGLgGGGGG..',
      '....GGLgGGGGG...',
      '...GGLgGGGGGG...',
      '...GLgGGGGGG....',
      '...LgGGGGGG.....',
      '..g.GGGGGG......',
      '..g...GGG.......',
      '.g..............',
      '.g..............',
      '................',
      '................',
    ],
  },
  // Esquiva: rajada de vento
  dash: {
    colors: { W: '#c9f0ff', B: '#7cc8f0' },
    rows: [
      '................',
      '................',
      '........WWWW....',
      '......WW....W...',
      '............W...',
      '..WWWWWWWWWW....',
      '................',
      '....BBBBBBBBBBB.',
      '..............B.',
      '.....BBBBBBBBB..',
      '................',
      '..WWWWWWW.......',
      '.........W......',
      '.........W......',
      '.......WW.......',
      '................',
    ],
  },
};

const urls = new Map<ActionSlot, string>();

/** Jogo 2.5D aberto (main.ts marca o body)? */
function newWorld(): boolean {
  return document.body.classList.contains('jogo-novo');
}

export function actionIconUrl(slot: ActionSlot): string {
  if (newWorld()) return paintedActionIcon(slot);
  let url = urls.get(slot);
  if (!url) {
    url = drawIcon(ICONS[slot]).toDataURL();
    urls.set(slot, url);
  }
  return url;
}

/**
 * O ícone do botão de atirar com uma arma (o `icone` do item): com o Arco de Bambu, o arco com a flecha. Só no jogo
 * 2.5D; null quando a arma não tem ícone próprio (aí fica o do estilingue).
 */
export function weaponActionIconUrl(icon: string): string | null {
  if (!newWorld()) return null;
  return icon === 'arco' ? paintedActionIcon('bow') : null;
}

/** O ícone da defesa (jogo 2.5D): o botão dela é do motor, a HUD só pinta. */
export function guardIconUrl(): string {
  return paintedActionIcon('guard');
}
