// Som de ambiente (pedido do dono, 14/11, a fila: arco, Joaquim e som): cada lugar com nome do mapa (camada `areas`)
// tem o seu som: a vila, a clareira, a mata, a mata profunda e a água. O mapa pode dizer o som pela propriedade `som`;
// sem ela, vale o nome do lugar.

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { recordedMix, sceneOfMap, sceneOfPlace } from '../src/client/ambient';
import { GroundMap, StepCounter, stepGroundOf, strideFor } from '../src/client/novo/ground';
import { SAMPLE_FILES } from '../src/client/sfx';
import { trackOfScene } from '../src/client/music';
import { loadMaps } from '../src/server/server';
import { GameMap, type TiledMap } from '../src/shared/map';

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

  it('a Caverna Sagrada: o som dela (sem floresta gravada nem bicho; de noite, igual), a música sombria e passo de pedra', () => {
    const cave = loadMaps().find((m) => m.id === 'caverna') as GameMap;
    // todo lugar com nome da caverna (a entrada, o salão, a Toca da Cuca) é caverna: o nome do mapa vale para quem não diz
    expect(cave.places.length).toBeGreaterThan(0);
    expect(sceneOfMap(cave.name)).toBe('caverna');
    for (const place of cave.places) expect(sceneOfPlace(place, sceneOfMap(cave.name)), place.name).toBe('caverna');
    // nos outros mapas nada muda (fora dos lugares com nome, a mata)
    for (const id of ['capao', 'guarapiranga']) expect(sceneOfMap(loadMaps().find((m) => m.id === id)!.name), id).toBe('mata');
    expect(sceneOfPlace({ name: 'Toca da Cuca', sound: null })).toBe('caverna');
    expect(sceneOfPlace({ name: 'Mata Tocante', sound: null })).toBe('mata'); // "toca" só como palavra
    expect(recordedMix('caverna', 1)).toEqual({ day: 0, night: 0 });
    expect(recordedMix('caverna', 0)).toEqual({ day: 0, night: 0 });
    expect(trackOfScene('caverna')).toBe('mata-profunda');
    const ground = new GroundMap(JSON.parse(readFileSync('public/assets/maps-iso/caverna.tmj', 'utf8')) as TiledMap);
    const spawn = cave.spots.get('spawn')!;
    expect(ground.stepAt(spawn.x, spawn.y)).toBe('pedra');
    expect([stepGroundOf('caverna'), stepGroundOf('caverna-rocha')]).toEqual(['pedra', 'pedra']);
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

describe('os sons gravados (licença livre, escolha do dono em 23/11)', () => {
  it('os arquivos existem e cada um tem o crédito e a licença anotados', () => {
    const credits = readFileSync('public/assets/audio/CREDITOS-SONS.md', 'utf8');
    for (const url of Object.values(SAMPLE_FILES)) {
      expect(existsSync(`public${url}`)).toBe(true);
      const file = url.replace('/assets/audio/', '');
      // na tabela: o nome do arquivo (os passos e as flechas aparecem em faixa: "passo-terra-1.mp3 a -3")
      expect(credits.includes(`\`${file}\``) || credits.includes(`\`${file.replace(/-\d+\.mp3$/, '-1.mp3')}\``)).toBe(true);
    }
    expect(credits).toContain('CC0');
  });

  it('a floresta gravada: a do dia de dia, a da noite de noite, as duas no anoitecer; mais baixa na vila', () => {
    expect(recordedMix('mata', 1)).toEqual({ day: 0.9, night: 0 });
    expect(recordedMix('mata', 0)).toEqual({ day: 0, night: 0.9 });
    const dusk = recordedMix('mata', 0.5);
    expect(dusk.day).toBeCloseTo(0.45);
    expect(dusk.night).toBeCloseTo(0.45);
    expect(recordedMix('vila', 1).day).toBeLessThan(recordedMix('mata', 1).day);
  });
});

describe('os passos (pedido do dono, 23/11: "passos do boneco correndo")', () => {
  /** Um mapa de 20 × 10 m com o chão: grama embaixo de tudo, uma calçada (retângulo), uma poça de lama (polígono) e uma trilha de lama com largura. */
  const map = {
    width: 20,
    height: 10,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        name: 'chao',
        objects: [
          { id: 1, type: 'grama', x: 0, y: 0, width: 640, height: 320 },
          { id: 2, type: 'calcada', x: 320, y: 0, width: 160, height: 320 },
          { id: 3, type: 'lama', x: 0, y: 0, polygon: [{ x: 32, y: 192 }, { x: 128, y: 192 }, { x: 128, y: 288 }, { x: 32, y: 288 }] },
          { id: 4, type: 'lama', x: 0, y: 0, polyline: [{ x: 512, y: 32 }, { x: 608, y: 32 }], properties: [{ name: 'largura', type: 'float', value: 2 }] },
          { id: 5, type: 'rachadura', x: 320, y: 0, width: 160, height: 320 }, // detalhe pintado: não muda o passo
        ],
      },
    ],
    tilesets: [],
  } as unknown as TiledMap;

  it('o chão debaixo do pé: o de cima vale (retângulo, polígono e caminho com largura); detalhe pintado não conta', () => {
    const ground = new GroundMap(map);
    expect(ground.typeAt(2, 2)).toBe('grama');
    expect(ground.typeAt(11, 5)).toBe('calcada'); // a rachadura por cima não muda
    expect(ground.typeAt(2, 7)).toBe('lama');
    expect(ground.typeAt(17, 1.8)).toBe('lama'); // a 0,8 m do meio da trilha de 2 m
    expect(ground.typeAt(17, 2.6)).toBe('grama'); // fora dela
    expect([ground.stepAt(2, 2), ground.stepAt(11, 5), ground.stepAt(2, 7)]).toEqual(['terra', 'pedra', 'areia']);
    expect(stepGroundOf('asfalto')).toBe('pedra');
    // a faixa de pedestre, a escada e o entulho do Capão maior: duros
    expect(['faixa', 'degrau', 'entulho'].map(stepGroundOf)).toEqual(['pedra', 'pedra', 'pedra']);
    expect(stepGroundOf('mata-profunda')).toBe('terra');
    expect(stepGroundOf('campinho')).toBe('terra');
    expect(stepGroundOf(null)).toBe('terra');
  });

  it('o chão de verdade da Guarapiranga: a calçada da chegada é pedra, e fora do desenho é terra', () => {
    const tiled = JSON.parse(readFileSync('public/assets/maps-iso/guarapiranga.tmj', 'utf8')) as TiledMap;
    const ground = new GroundMap(tiled);
    const layer = tiled.layers.find((l) => l.name === 'chao')!;
    const calcada = layer.objects!.find((o) => o.type === 'calcada' && !o.polygon && !o.polyline)!;
    const k = 1 / tiled.tilewidth;
    expect(ground.stepAt((calcada.x + calcada.width! / 2) * k, (calcada.y + calcada.height! / 2) * k)).toBe('pedra');
  });

  it('um passo a cada passada: correndo (4,5 m/s), um a cada ~0,25 s, como a gravação que o dono mandou', () => {
    expect(strideFor(4.5) / 4.5).toBeGreaterThan(0.23);
    expect(strideFor(4.5) / 4.5).toBeLessThan(0.27);
    expect(strideFor(2)).toBeLessThan(strideFor(4.5)); // andando devagar, passos menores
    const steps = new StepCounter();
    let count = 0;
    // 2 s correndo em linha reta, a 60 quadros por segundo
    for (let f = 0; f <= 120; f++) if (steps.update((f / 60) * 4.5, 0, 4.5, true)) count++;
    expect(count).toBeGreaterThanOrEqual(8);
    expect(count).toBeLessThanOrEqual(10);
    // parado, no ar ou levado longe: nada
    expect(steps.update(9, 0, 0, true)).toBe(false);
    expect(steps.update(9.1, 0, 4.5, false)).toBe(false);
    expect(steps.update(30, 0, 4.5, true)).toBe(false);
  });
});
