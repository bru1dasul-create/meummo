// Como cada equipamento aparece NO PERSONAGEM (arte provisória desenhada por código).
// O servidor manda, para cada parte do corpo, o "icone" do item equipado (data/items.json); o visual
// usado é o desta tabela com o MESMO nome. Ícone sem visual aqui: o item vale, mas não aparece no corpo
// (o teste em tests/characters.test.ts avisa).
//
// COMO CRIAR O VISUAL DE UM ITEM NOVO
// Escolha um `kind` (o tipo de desenho) e ajuste as cores e os tamanhos. O desenho é montado preso aos
// ossos do personagem, então ele acompanha sozinho todas as animações e direções, e o ícone da mochila
// sai dele automaticamente. Tipos que existem:
//   hat      chapéu de aba        color, band (fita), brim (raio da aba), crown (altura da copa)
//   cap      gorro mole           color, trim (barra), tip (para que lado a ponta cai: 1 ou -1)
//   helmet   capacete             metal, rim (aba), crest (pluma), noseGuard (protetor de nariz), handle (cabo de panela)
//   clothes  roupa                shirt, skirt (true = até a coxa, 'long' = até o tornozelo), belt,
//                                 apron (avental por cima), flowers (estampa de chita: cores das flores)
//   vest     colete               leather, lacing (cordão), studs (tachinhas), scales (escamas de cobra)
//   plate    armadura             metal, chain (malha dos braços), pauldrons (ombreiras), tassets (placas do quadril), trim
//   gloves   luvas                color, metal (manopla), long (cobre o antebraço)
//   boots    botas                color, tall (cano alto), cuff (barra), metal
//   cape     capa                 color, trim (barra), leaves (folhas por cima), clasp (broche), length
//   necklace colar                cord, pendant, count (quantos pingentes), shape ('fang' presa, 'horseshoe' ferradura,
//                                 'beads' contas/sementes), glow (brilho)
//   blade    facão, espada        steel, length, width, guard, grip, curve (lâmina de facão)
//   axe      machado              head, handle, length, binding (amarração)
//   bow      arco                 wood, string, size
//   sling    estilingue           wood, band
//   shield   escudo               shape ('round', 'shell' casco, 'kite' gota), color, rim, pattern ('hex', 'grate', 'cross'), boss (miolo), metal
// Depois de mudar, rode `npm run render:characters` e confira docs/personagens.png.

/**
 * Partes do corpo que o desenho conhece. Hoje o servidor usa 4 (cabeça, corpo, arma, amuleto); luvas,
 * botas e escudo já têm desenho para quando existirem.
 */
export type DollSlot = 'head' | 'body' | 'hands' | 'feet' | 'weapon' | 'offhand' | 'charm';
export const DOLL_SLOTS: readonly DollSlot[] = ['head', 'body', 'hands', 'feet', 'weapon', 'offhand', 'charm'];

export type GearArt =
  | { kind: 'hat'; color: string; band?: string; brim: number; crown: number }
  | { kind: 'cap'; color: string; trim?: string; tip: 1 | -1 }
  | { kind: 'helmet'; metal: string; rim?: string; crest?: string; noseGuard?: boolean; handle?: string }
  | { kind: 'clothes'; shirt: string; skirt?: boolean | 'long'; belt?: string; apron?: string; flowers?: string[] }
  | { kind: 'vest'; leather: string; lacing?: string; studs?: string; scales?: boolean }
  | { kind: 'plate'; metal: string; chain?: string; pauldrons?: boolean; tassets?: boolean; trim?: string }
  | { kind: 'gloves'; color: string; metal?: boolean; long?: boolean }
  | { kind: 'boots'; color: string; tall?: boolean; cuff?: string; metal?: boolean }
  | { kind: 'cape'; color: string; trim?: string; leaves?: string; clasp?: string; length?: number }
  | { kind: 'necklace'; cord: string; pendant: string; count: number; shape?: 'fang' | 'horseshoe' | 'beads'; glow?: string }
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
  chapeu_palha: { kind: 'hat', color: '#e2be62', band: '#c0392b', brim: 9.2, crown: 3.6 },
  gorro: { kind: 'cap', color: '#d62f2f', trim: '#a51f1f', tip: 1 },
  capacete_sucata: { kind: 'helmet', metal: '#a3acb5', rim: '#6b737c', handle: '#7a4a22', noseGuard: true },

  // ======================= corpo =======================
  // chapas de carro amarradas com corda: placas de lata meio enferrujadas, sem ombreira
  couraca: { kind: 'plate', metal: '#9fa7a8', chain: '#7a6a58', tassets: true, trim: '#b5823c' },
  tunica: { kind: 'clothes', shirt: '#ece4cf', skirt: true, belt: '#8a6b3d' },
  // vestido de chita (o tecido florido das feiras) com avental: a roupa da Dona Iracema
  chita_avental: { kind: 'clothes', shirt: '#c8452f', skirt: 'long', apron: '#efe6d2', flowers: ['#f2c94c', '#f6efe0', '#4f9a3c'] },
  // couro de cobra, costurado à mão: escamas e um tom oliva (não some em quem tem a pele morena)
  gibao: { kind: 'vest', leather: '#7c7440', lacing: '#e9d9a8', studs: '#e9b941', scales: true },
  armadura: { kind: 'plate', metal: '#a3acb5', chain: '#6e767f', pauldrons: true, tassets: true, trim: '#c9a062' },

  // ======================= luvas e botas =======================
  luvas: { kind: 'gloves', color: '#7a4a26' },
  manoplas: { kind: 'gloves', color: '#a3acb5', metal: true, long: true },
  botas: { kind: 'boots', color: '#3a3a44', tall: true, cuff: '#55555f' },

  // ======================= acessórios =======================
  colar: { kind: 'necklace', cord: '#8a6b3d', pendant: '#f3efe0', count: 3 },
  // sementes de açaí num cordão
  colar_sementes: { kind: 'necklace', cord: '#5a3a1e', pendant: '#4a2a3a', count: 9, shape: 'beads' },
  // ferradura que nunca esfria (da Mula sem Cabeça)
  ferradura: { kind: 'necklace', cord: '#4a3a2a', pendant: '#ff8a2a', count: 1, shape: 'horseshoe', glow: '#ffd36a' },
  capa: { kind: 'cape', color: '#3f8f3a', trim: '#2b6627', leaves: '#7fd05a', clasp: '#d8b050', length: 27 },

  // ======================= armas =======================
  estilingue: { kind: 'sling', wood: '#8a5a2b', band: '#e04f4f' },
  facao: { kind: 'blade', steel: '#cdd5dc', length: 13, width: 2.4, guard: '#5b3a22', grip: '#4a2b12', curve: true },
  // lâmina de lata afiada na pedra, cabo enrolado com fio de cobre
  faca: { kind: 'blade', steel: '#b9c0c4', length: 8, width: 2, guard: '#a8642a', grip: '#c07a3a' },
  machadinha: { kind: 'axe', head: '#8f9a9e', handle: '#8a5a2b', length: 14, binding: '#d8b050' },
  arco: { kind: 'bow', wood: '#d9a12a', string: '#e8e0c8', size: 11 },

  // ======================= escudos =======================
  escudo_jabuti: { kind: 'shield', shape: 'shell', color: '#8a9a40', rim: '#4f5a22', pattern: 'hex' },
  escudo_bueiro: { kind: 'shield', shape: 'round', color: '#5f666e', rim: '#8a939c', pattern: 'grate', metal: true },
};
