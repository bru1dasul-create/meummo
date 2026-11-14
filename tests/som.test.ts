// Som de ambiente (pedido do dono, 14/11, a fila: arco, Joaquim e som): cada lugar com nome do mapa (camada `areas`)
// tem o seu som: a vila, a clareira, a mata, a mata profunda e a água. O mapa pode dizer o som pela propriedade `som`;
// sem ela, vale o nome do lugar.

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sceneOfPlace } from '../src/client/ambient';
import { trackOfScene } from '../src/client/music';
import { loadMaps } from '../src/server/server';
import { GameMap } from '../src/shared/map';

describe('o som de cada lugar', () => {
  it('pelo nome do lugar (sem acento e sem maiúscula)', () => {
    const place = (name: string) => ({ name, sound: null });
    expect(sceneOfPlace(place('Vila do Capão'))).toBe('vila');
    expect(sceneOfPlace(place('Lago do Parque'))).toBe('agua');
    expect(sceneOfPlace(place('Brejo da Billings'))).toBe('agua');
    expect(sceneOfPlace(place('Mata Profunda'))).toBe('mata-profunda');
    expect(sceneOfPlace(place('Clareira dos Despertos'))).toBe('clareira');
    expect(sceneOfPlace(place('Mata do Parque Santo Dias'))).toBe('mata');
    expect(sceneOfPlace(null)).toBe('mata'); // fora de qualquer lugar com nome
  });

  it('a propriedade "som" do lugar manda (se for um som que existe)', () => {
    expect(sceneOfPlace({ name: 'Praça', sound: 'vila' })).toBe('vila');
    expect(sceneOfPlace({ name: 'Lago', sound: 'trovoada' })).toBe('agua'); // som que não existe: vale o nome
  });

  it('no Capão de verdade: o lugar mais específico ganha (o lago fica dentro da mata do parque)', () => {
    const capao = loadMaps().find((m) => m.id === 'capao') as GameMap;
    const at = (x: number, y: number) => sceneOfPlace(capao.placeAt(x, y));
    expect(at(60, 50)).toBe('vila');
    expect(at(10, 50)).toBe('agua');
    expect(at(5, 5)).toBe('mata-profunda');
    expect(at(37, 43)).toBe('clareira');
    expect(at(40, 100)).toBe('mata');
    expect(capao.placeAt(10, 50)!.name).toBe('Lago do Parque');
  });
});

describe('a música de cada lugar (licença livre)', () => {
  it('a vila tem a sua, a mata profunda a sua, e o resto usa a da mata', () => {
    expect(trackOfScene('vila')).toBe('vila');
    expect(trackOfScene('mata-profunda')).toBe('mata-profunda');
    for (const scene of ['mata', 'clareira', 'agua'] as const) expect(trackOfScene(scene)).toBe('mata');
  });

  it('os arquivos existem e cada um tem o crédito e a licença anotados', () => {
    const credits = readFileSync('public/assets/audio/musica/CREDITOS.md', 'utf8');
    for (const file of ['vila-capao.mp3', 'mata.mp3', 'mata-profunda.mp3']) {
      expect(existsSync(`public/assets/audio/musica/${file}`)).toBe(true);
      expect(credits).toContain(`\`${file}\``);
    }
    expect(credits).toContain('CC0');
  });
});
