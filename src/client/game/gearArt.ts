// Como cada equipamento aparece NO PERSONAGEM (arte provisória desenhada por código).
// Cada item de data/items.json diz qual visual usar no campo "aparencia" (sem o campo, usa o "icone").
//
// COMO CRIAR O VISUAL DE UM ITEM NOVO
// Escolha um `kind` (o tipo de desenho) e ajuste as cores e os tamanhos. O desenho é montado preso aos
// ossos do personagem, então ele acompanha sozinho todas as animações e direções, e o ícone da mochila
// sai dele automaticamente. Tipos que existem:
//   hat      chapéu de aba        color, band (fita), brim (raio da aba), crown (altura da copa)
//   cap      gorro mole           color, trim (barra), tip (para que lado a ponta cai: 1 ou -1)
//   helmet   capacete             metal, rim (aba), crest (pluma), noseGuard (protetor de nariz), handle (cabo de panela)
//   clothes  roupa (túnica)       shirt, skirt (saia até a coxa), belt
//   vest     colete               leather, lacing (cordão), studs (tachinhas)
//   plate    armadura             metal, chain (malha dos braços), pauldrons (ombreiras), tassets (placas do quadril), trim
//   gloves   luvas                color, metal (manopla), long (cobre o antebraço)
//   boots    botas                color, tall (cano alto), cuff (barra), metal
//   cape     capa                 color, trim (barra), leaves (folhas por cima), clasp (broche), length
//   necklace colar                cord, pendant, count (quantos pingentes)
//   blade    facão, espada        steel, length, width, guard, grip, curve (lâmina de facão)
//   axe      machado              head, handle, length, binding (amarração)
//   bow      arco                 wood, string, size
//   sling    estilingue           wood, band
//   shield   escudo               shape ('round', 'shell' casco, 'kite' gota), color, rim, pattern ('hex', 'grate', 'cross'), boss (miolo), metal
// Depois de mudar, rode `npm run render:characters` e confira docs/personagens.png.

export type GearArt =
  | { kind: 'hat'; color: string; band?: string; brim: number; crown: number }
  | { kind: 'cap'; color: string; trim?: string; tip: 1 | -1 }
  | { kind: 'helmet'; metal: string; rim?: string; crest?: string; noseGuard?: boolean; handle?: string }
  | { kind: 'clothes'; shirt: string; skirt?: boolean; belt?: string }
  | { kind: 'vest'; leather: string; lacing?: string; studs?: string }
  | { kind: 'plate'; metal: string; chain?: string; pauldrons?: boolean; tassets?: boolean; trim?: string }
  | { kind: 'gloves'; color: string; metal?: boolean; long?: boolean }
  | { kind: 'boots'; color: string; tall?: boolean; cuff?: string; metal?: boolean }
  | { kind: 'cape'; color: string; trim?: string; leaves?: string; clasp?: string; length?: number }
  | { kind: 'necklace'; cord: string; pendant: string; count: number }
  | { kind: 'blade'; steel: string; length: number; width: number; guard?: string; grip: string; curve?: boolean }
  | { kind: 'axe'; head: string; handle: string; length: number; binding?: string }
  | { kind: 'bow'; wood: string; string: string; size: number }
  | { kind: 'sling'; wood: string; band: string }
  | {
      kind: 'shield';
      shape: 'round' | 'shell' | 'kite';
      color: string;
      rim?: string;
      pattern?: 'hex' | 'grate' | 'cross';
      boss?: string;
      metal?: boolean;
    };

export type GearKind = GearArt['kind'];

export const GEAR_ART: Record<string, GearArt> = {
  // ======================= cabeça =======================
  chapeu_palha: { kind: 'hat', color: '#e2be62', band: '#c0392b', brim: 10.5, crown: 4.2 },
  gorro: { kind: 'cap', color: '#d62f2f', trim: '#a51f1f', tip: 1 },
  capacete_sucata: { kind: 'helmet', metal: '#a3acb5', rim: '#6b737c', handle: '#7a4a22', noseGuard: true },

  // ======================= corpo =======================
  tunica: { kind: 'clothes', shirt: '#ece4cf', skirt: true, belt: '#8a6b3d' },
  gibao: { kind: 'vest', leather: '#9b6a3c', lacing: '#e9d9a8', studs: '#e9b941' },
  armadura: { kind: 'plate', metal: '#a3acb5', chain: '#6e767f', pauldrons: true, tassets: true, trim: '#c9a062' },

  // ======================= luvas e botas =======================
  luvas: { kind: 'gloves', color: '#7a4a26' },
  manoplas: { kind: 'gloves', color: '#a3acb5', metal: true, long: true },
  botas: { kind: 'boots', color: '#3a3a44', tall: true, cuff: '#55555f' },

  // ======================= acessórios =======================
  colar: { kind: 'necklace', cord: '#8a6b3d', pendant: '#f3efe0', count: 3 },
  capa: { kind: 'cape', color: '#3f8f3a', trim: '#2b6627', leaves: '#7fd05a', clasp: '#d8b050', length: 27 },

  // ======================= armas =======================
  estilingue: { kind: 'sling', wood: '#8a5a2b', band: '#e04f4f' },
  facao: { kind: 'blade', steel: '#cdd5dc', length: 13, width: 2.4, guard: '#5b3a22', grip: '#4a2b12', curve: true },
  machadinha: { kind: 'axe', head: '#8f9a9e', handle: '#8a5a2b', length: 14, binding: '#d8b050' },
  arco: { kind: 'bow', wood: '#d9a12a', string: '#e8e0c8', size: 11 },

  // ======================= escudos =======================
  escudo_jabuti: { kind: 'shield', shape: 'shell', color: '#8a9a40', rim: '#4f5a22', pattern: 'hex' },
  escudo_bueiro: { kind: 'shield', shape: 'round', color: '#5f666e', rim: '#8a939c', pattern: 'grate', metal: true },
};
