// Desenho dos personagens (feito por código): os desenhos estão certinhos e todo equipamento aparece no corpo.

import { describe, expect, it } from 'vitest';
import { checkCharacterArt, hasGearArt } from '../src/client/game/characters';
import { loadItemDefs } from '../src/server/items';

describe('desenho dos personagens', () => {
  it('toda linha tem 20 colunas, cabe na altura e só usa letras que têm cor', () => {
    expect(checkCharacterArt()).toEqual([]);
  });

  it('todo equipamento de data/items.json tem desenho no personagem', () => {
    const missing = [...loadItemDefs().values()]
      .filter((def) => def.kind === 'equipment' && def.slot && !hasGearArt(def.slot, def.icon))
      .map((def) => `${def.id} (ícone "${def.icon}")`);
    expect(missing, 'desenhe a peça em src/client/game/characters.ts (ou use o ícone de uma que já existe)').toEqual([]);
  });

  it('peça sem desenho é só ignorada', () => {
    expect(hasGearArt('head', 'gorro')).toBe(true);
    expect(hasGearArt('head', 'faca')).toBe(false);
    expect(hasGearArt('weapon', 'toString')).toBe(false);
  });
});
