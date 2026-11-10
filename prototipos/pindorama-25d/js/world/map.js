// O cenário inicial em forma de dados: uma esquina de São Paulo de hoje (rua, calçadas, prédios baixos com
// comércio, praça, postes com fiação, muros). Medidas em centímetros; x desce para a direita na tela e y
// desce para a esquerda. Os prédios altos ficam no fundo (no alto da tela) para não esconder o personagem.
// Lugares e coisas reais sim, marcas não: as placas só têm palavras comuns (PADARIA, BAR...).
(function (PD) {
  'use strict';

  const MAP = {
    w: 4000,
    h: 3800,
    spawn: { x: 1250, y: 3020 }, // a praça, no círculo onde ele acorda
    // ---- chão (desenhado uma vez só, em pedaços)
    street: { y0: 1400, y1: 2100 }, // rua principal (ao longo de x)
    avenue: { x0: 2600, x1: 3200 }, // travessa (ao longo de y)
    sidewalk: 300, // largura das calçadas
    curb: 14, // altura do meio-fio
    crosswalks: [
      { x0: 2340, x1: 2540, y0: 1400, y1: 2100, along: 'x' },
      { x0: 2600, x1: 3200, y0: 2150, y1: 2340, along: 'y' },
    ],
    manholes: [{ x: 900, y: 1760 }, { x: 2900, y: 900 }, { x: 1900, y: 1560 }],
    drains: [{ x: 640, y: 1405, side: 'n' }, { x: 2050, y: 2096, side: 's' }, { x: 2606, y: 2700, side: 'w' }],
    // a praça (canto de baixo à esquerda): grama, caminhos de pedra portuguesa e o círculo do despertar
    square: { x0: 0, x1: 2300, y0: 2400, y1: 3800 },
    lawns: [
      { x0: 150, x1: 1000, y0: 2560, y1: 2860 },
      { x0: 1500, x1: 2180, y0: 2560, y1: 2900 },
      { x0: 150, x1: 900, y0: 3220, y1: 3650 },
      { x0: 1580, x1: 2180, y0: 3180, y1: 3650 },
    ],
    awakening: { x: 1250, y: 3020, r: 210 },
    lot: { x0: 3500, x1: 4000, y0: 2400, y1: 3800 }, // terreno baldio
    tiles: [
      { x0: 140, x1: 690, y0: 1100, y1: 1400, a: '#d9c9a8', b: '#9a5a3c' }, // ladrilho hidráulico da padaria
      { x0: 1760, x1: 2290, y0: 1100, y1: 1400, a: '#d8d2c2', b: '#4f7f74' },
    ],

    // ---- prédios (pé no chão: x0..x1, y0..y1; h = altura) — a fachada da rua fica no lado +y
    buildings: [
      { x0: 120, x1: 700, y0: 330, y1: 1100, h: 760, wall: '#e9c98f', trim: '#f6ead0', floors: 3, shop: { type: 'padaria', sign: 'PADARIA', awning: ['#c8442d', '#f3e7cf'] }, tank: true, ac: 2 },
      { x0: 700, x1: 1150, y0: 450, y1: 1100, h: 620, wall: '#8fb8b2', trim: '#e8efe9', floors: 2, shop: { type: 'bar', sign: 'BAR', awning: ['#2f6d4f', '#e9e1c8'] }, pixo: true, ac: 1 },
      { x0: 1150, x1: 1760, y0: 240, y1: 1100, h: 1480, wall: '#d7b7b0', trim: '#f2e6df', floors: 5, balconies: true, tank: true, ac: 3, antenna: true, shop: { type: 'portaria' } },
      { x0: 1760, x1: 2300, y0: 380, y1: 1100, h: 860, wall: '#f0e3b6', trim: '#ffffff', floors: 3, shop: { type: 'mercadinho', sign: 'MERCADINHO', awning: ['#2b5fa8', '#f4f1e8'] }, side: { sign: 'FRUTAS' }, pixo: true, tank: true },
      { x0: 3500, x1: 3960, y0: 300, y1: 1100, h: 940, wall: '#c9d6e3', trim: '#f3f6f9', floors: 3, shop: { type: 'lanches', sign: 'LANCHES', awning: ['#e0a21b', '#fff4d6'] }, ac: 2, tank: true },
    ],
    // muros (pé fino): pichação e grafite colorido de um lado
    walls: [
      { x0: 3540, x1: 3990, y0: 2440, y1: 2470, h: 210, color: '#b9b2a6', graffiti: 'cores' },
      { x0: 3540, x1: 3570, y0: 2470, y1: 3760, h: 210, color: '#c3bcae', graffiti: 'letras' },
      { x0: 20, x1: 2280, y0: 3740, y1: 3770, h: 70, color: '#cfc7b6' }, // mureta da praça (fundo)
      { x0: 20, x1: 50, y0: 2440, y1: 3740, h: 70, color: '#cfc7b6' },
    ],
    // árvores: tipo (sibipiruna = verde; ipe = ipê-amarelo florido); r = raio da copa
    trees: [
      { x: 950, y: 1270, kind: 'sibipiruna', r: 210, h: 480 },
      { x: 2050, y: 1265, kind: 'sibipiruna', r: 190, h: 450 },
      { x: 1150, y: 2280, kind: 'sibipiruna', r: 200, h: 470 },
      { x: 520, y: 2720, kind: 'ipe', r: 250, h: 560 },
      { x: 1900, y: 2760, kind: 'sibipiruna', r: 240, h: 530 },
      { x: 480, y: 3420, kind: 'sibipiruna', r: 230, h: 500 },
      { x: 1880, y: 3420, kind: 'ipe', r: 220, h: 520 },
      { x: 3760, y: 3150, kind: 'sibipiruna', r: 230, h: 520 },
    ],
    // postes de concreto (com fiação entre eles) e o semáforo
    poles: [
      { x: 330, y: 1150, lamp: true },
      { x: 1350, y: 1150, transformer: true },
      { x: 2350, y: 1150, lamp: true },
      { x: 2350, y: 300 },
      { x: 3450, y: 1150, lamp: true },
    ],
    wires: [[0, 1], [1, 2], [2, 3], [2, 4]],
    trafficLight: { x: 2560, y: 2140 },
    // miudezas
    props: [
      { kind: 'banca', x0: 1880, x1: 2120, y0: 2480, y1: 2640 },
      { kind: 'orelhao', x: 2460, y: 2300 },
      { kind: 'lixeira', x: 620, y: 1170 },
      { kind: 'lixeira', x: 2240, y: 2330 },
      { kind: 'lixeira', x: 3300, y: 1180 },
      { kind: 'hidrante', x: 2250, y: 1180 },
      { kind: 'mesa', x: 820, y: 1220 },
      { kind: 'mesa', x: 1040, y: 1240 },
      { kind: 'banco', x0: 780, x1: 1020, y0: 3000, y1: 3060 },
      { kind: 'banco', x0: 1480, x1: 1720, y0: 3000, y1: 3060 },
      { kind: 'arbusto', x: 220, y: 2620, r: 70 },
      { kind: 'arbusto', x: 900, y: 2600, r: 60 },
      { kind: 'arbusto', x: 2120, y: 2960, r: 75 },
      { kind: 'arbusto', x: 200, y: 3300, r: 80 },
      { kind: 'arbusto', x: 2130, y: 3560, r: 70 },
      { kind: 'arbusto', x: 3880, y: 2620, r: 80 },
      { kind: 'pedra', x: 760, y: 3300, r: 45 },
      { kind: 'pedra', x: 1650, y: 3330, r: 38 },
      { kind: 'pedra', x: 3700, y: 3500, r: 55 },
      { kind: 'poste-praca', x: 1250, y: 2600 },
      { kind: 'poste-praca', x: 1250, y: 3460 },
    ],
  };

  PD.MAP = MAP;
})(window.PD = window.PD || {});
