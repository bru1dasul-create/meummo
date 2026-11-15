// Xiovanna, a vendedora da Budega (NPC "budega" em data/npcs.json; pedido do dono, com fotos de referência que NÃO
// ficam no repositório). Morena, black power grande e cacheado, flor de hibisco vermelha do lado direito, uniforme
// preto da Budega (jaqueta de zíper com capuz, o escudo dourado no peito e um emblema na manga), calça jeans escura e
// tênis branco. É um NPC do molde de gente (pessoa.js): aqui fica só a aparência dela.
// Fica no balcão respirando e mudando o peso de perna. Vira para quem chega perto e acena; de vez em quando leva a mão
// ao cabelo; ao falar, mexe a cabeça, a boca e a mão.
(function (PD) {
  'use strict';
  const GOLD = '#e2b04a';
  PD.Xiovanna = PD.creatures.definePerson('budega', {
    pele: '#9a6345',
    cabelo: { tipo: 'afro', cor: '#2b1e19', flor: '#c8323a' },
    rosto: { olhos: '#4a2c1a', delineado: true, labios: '#a84f5a', blush: true, brincos: GOLD },
    cima: { tipo: 'jaqueta', cor: '#23232a', ziper: true, capuz: true, escudo: GOLD, emblema: GOLD },
    baixo: { tipo: 'calca', cor: '#2f3c58' },
    pes: { tipo: 'tenis', cor: '#ece7dd', sola: '#5a5048' },
    corpo: { altura: 1, largura: 1, feminino: true },
    gestos: { aceno: true, cabelo: true },
  });
})(window.PD = window.PD || {});
