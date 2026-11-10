// O MODELO ÚNICO do protagonista: medidas, cores e volumes. Tudo o que define a aparência mora aqui,
// e todas as animações usam este mesmo modelo — por isso ele não muda de cara ao correr, pular ou virar.
//
// Medidas em centímetros. Cada parte do corpo é um grupo de esferas presas a um osso; o desenho é o
// casco dessas esferas visto pela câmera, então o volume é o mesmo de qualquer ângulo.
//
// Espaços locais:
//  - tronco/pelve/cabeça: x = direita do personagem, y = frente, z = cima
//  - membros (braço, perna): t = fração ao longo do osso (0 = começo, 1 = fim), "frente" = lado para onde
//    a articulação dobra (o lado do bíceps, a frente do joelho), "fora" = lado de fora do corpo
(function (PD) {
  'use strict';

  const BODY = {
    // pernas
    hipStand: 83.2, // altura da articulação do quadril em pé (perna quase esticada; andando, a pelve desce)
    hipHalf: 9.4, // metade da distância entre os quadris
    thigh: 40, // coxa (quadril → joelho)
    shin: 37.5, // canela (joelho → tornozelo)
    ankleHeight: 6.5, // tornozelo acima do chão, com o pé no chão
    footSide: 11.2, // pés afastados do meio (em pé, parado)
    toeOut: 7, // pés abertos para fora (graus)
    // tronco
    pelvisUp: 2, // centro da pelve acima dos quadris
    waistUp: 15, // pelve → cintura
    chestUp: 21, // cintura → peito
    shoulderHalf: 18.6, // metade da largura entre os ombros (articulação)
    shoulderUp: 9, // ombros acima do peito
    shoulderBack: -1,
    neckBaseUp: 12.5, // peito → base do pescoço
    neck: 28, // base do pescoço → centro da cabeça
    headForward: 2.2,
    headScale: 1.06, // cabeça grande (estilo da referência); muda tudo da cabeça junto: cabelo, penas, rosto
    // braços
    upperArm: 26,
    forearm: 23.5,
  };
  BODY.legLength = BODY.thigh + BODY.shin;

  // ---- cores (tiradas da referência do dono: pele morena dourada, cabelo preto, tanga marrom) ----
  const PALETTE = {
    ink: '#1b100d', // tinta do contorno
    inkSoft: '#3a201a', // linhas de dentro (músculos)
    skin: { base: '#c07d43', shade: '#8f512e', light: '#dda16a' },
    skinFar: { base: '#ab6e3a', shade: '#7c4528', light: '#c78d5a' }, // membros do lado de lá (profundidade)
    lip: '#9c4a2b',
    hair: { base: '#2a2124', shade: '#141012', light: '#4b3e41' },
    hairSheen: '#6b6a82',
    cloth: { base: '#573632', shade: '#37221f', light: '#704a42' }, // tanga
    clothBand: { base: '#432824', shade: '#2c1a18', light: '#6a433b' }, // barra da cintura
    paintRed: '#c3382a', // urucum
    paintRedDark: '#981a12',
    paintBlack: '#35332f', // jenipapo
    eyeWhite: '#f7efe3',
    iris: '#3a1f12',
    gold: '#e8b54a',
    goldShade: '#a87822',
    tooth: { base: '#f3ecdb', shade: '#c7bb9f', light: '#ffffff' },
    beads: ['#c8323a', '#f4efe6', '#2f74d0', '#f4efe6', '#1d1a1e', '#8fd3e8', '#c8323a', '#e8b84a'],
    feathers: [
      { base: '#d9301f', tip: '#8f1710', light: '#ff7048' }, // arara vermelha
      { base: '#f4b818', tip: '#cf7a06', light: '#ffe46a' }, // amarela
      { base: '#2453c4', tip: '#122d78', light: '#5d8cf0' }, // azul
      { base: '#f08c1d', tip: '#c2401a', light: '#ffc15c' }, // laranja
    ],
    shadow: 'rgba(28, 18, 30, 1)',
  };

  // ---- volumes (esferas) ----
  // Cabeça (centro = centro do crânio)
  const HEAD = {
    spheres: [
      { name: 'cranio', p: [0, 0, 0], r: 15.5 },
      { name: 'testa', p: [0, 8.8, 4.6], r: 8.2 },
      { name: 'macaE', p: [-8.2, 7.2, -3.2], r: 7 },
      { name: 'macaD', p: [8.2, 7.2, -3.2], r: 7 },
      { name: 'mandibulaE', p: [-6.5, 4.6, -9.6], r: 6.8 },
      { name: 'mandibulaD', p: [6.5, 4.6, -9.6], r: 6.8 },
      { name: 'queixo', p: [0, 9.3, -12.2], r: 5.6 },
      { name: 'nariz', p: [0, 15.9, -2.6], r: 2.4 },
    ],
    neckBase: [0, -2.4, -13], // onde o pescoço entra na cabeça
    ear: { p: [15.2, -0.6, -2.6], r: 3.5 }, // orelha direita (a esquerda é espelhada)
    // traços do rosto, no formato (x, z) da frente da cabeça; o y sai da superfície
    eye: { x: 5.9, z: 0.5, w: 7, h: 3.3, iris: 1.6 },
    brow: { inner: [2, 4.3], outer: [10.3, 6.1], thick: 2 },
    mouth: { x: 2.7, z: -9.7 },
    paintBand: { top: 3.3, bottom: -3.1, x: 14.6 }, // faixa vermelha nos olhos
    paintStripes: [-6.3, 6.3], // listras descendo nas bochechas (x)
    paintStripeBottom: -10.2,
    foreheadMark: { x: 0, z: 10.6, w: 4.6, h: 3.4 }, // "V" vermelho na testa
  };

  // Cabelo: massa de trás (casco), pontas bagunçadas, "touca" do couro cabeludo, franja e costeletas.
  const HAIR = {
    mass: [
      { p: [0, -2.8, 5.6], r: 17 },
      { p: [0, -8, -3], r: 15 },
      { p: [-6.5, -9, -13.5], r: 10 },
      { p: [6.5, -9, -13.5], r: 10 },
      { p: [-11.6, -3.6, -5], r: 10.4 },
      { p: [11.6, -3.6, -5], r: 10.4 },
      { p: [-11, -5.2, -14], r: 7 },
      { p: [11, -5.2, -14], r: 7 },
    ],
    // pontas: raiz → ponta (raio da raiz, a ponta afina)
    spikes: [
      { root: [-3, -4, 14], tip: [-6.5, -8.5, 22], r: 6 },
      { root: [5, -6, 13], tip: [8, -12.5, 19.5], r: 6 },
      { root: [-11, -3, 10], tip: [-17, -6.5, 12.5], r: 5.5 },
      { root: [12, -4, 9], tip: [17.5, -8.5, 10], r: 5.5 },
      { root: [0, -9, 11], tip: [0.5, -18.5, 13], r: 6 },
      { root: [-5, -12, 2], tip: [-8, -22, -5], r: 6 },
      { root: [5, -12, 0], tip: [7.5, -21.5, -8], r: 6 },
      { root: [0, -11, -10], tip: [0.5, -19.5, -19.5], r: 6 },
      { root: [-13, -4, -10], tip: [-16.8, -6, -19.5], r: 5 },
      { root: [13, -4, -10], tip: [16.8, -6.5, -19], r: 5 },
      { root: [-5, -8, -18], tip: [-6, -10, -26.5], r: 5 },
      { root: [5, -8, -18], tip: [6, -10.5, -26], r: 5 },
      { root: [-14, -2, 2], tip: [-22.5, -3.5, -2.5], r: 5 },
      { root: [14, -3, 1], tip: [22, -5, -4], r: 5 },
      { root: [-13, 0.5, 7.5], tip: [-21, 1, 6.5], r: 4.5 },
      { root: [13, 0, 8], tip: [20.5, 0, 6.5], r: 4.5 },
      { root: [-12, -6, -16], tip: [-17.5, -9, -25], r: 4.6 },
      { root: [12, -6, -16], tip: [17.5, -9.5, -24.5], r: 4.6 },
    ],
    // touca: casca de esfera acima do plano da linha do cabelo
    cap: { c: [0, -0.8, 0.8], r: 17.6, n: [0, -0.49, 0.87], d: 0.3 },
    // franja (raiz, meio, ponta) e costeletas
    locks: [
      { pts: [[-9.5, 10, 11], [-10.2, 14, 7.4], [-9.6, 15, 4.6]], r: [3.1, 2.1, 0.6] },
      { pts: [[-4.6, 12, 11.5], [-4.6, 15.8, 8], [-3.6, 16.6, 5.2]], r: [3.1, 2, 0.6] },
      { pts: [[3.6, 12.5, 11.5], [4.6, 16.1, 8.2], [5.6, 16.6, 5.6]], r: [3.1, 2, 0.6] },
      { pts: [[8.4, 11, 11], [10, 14.2, 7.3], [11, 14.4, 4.4]], r: [3.1, 2, 0.6] },
      { pts: [[12, 8, 10], [13.6, 10.4, 5.6], [14.4, 10.4, 1.8]], r: [3.4, 2.3, 0.7] },
      { pts: [[-12.5, 7.5, 9.5], [-14, 9.9, 4.6], [-14.9, 9.4, 0.6]], r: [3.4, 2.3, 0.7] },
      { pts: [[-14.4, 3.6, 4], [-15.7, 4.3, -4], [-15.5, 4.7, -10.2]], r: [3.6, 2.6, 0.9], side: true },
      { pts: [[14.4, 3.6, 4], [15.7, 4.3, -4], [15.5, 4.7, -10.2]], r: [3.6, 2.6, 0.9], side: true },
    ],
    // fios brilhantes (faixas de luz no alto, estilo HQ): pontos (x, y, z) sobre a touca
    sheen: [
      [[-11, 3, 13], [-6, 4, 16.2], [0, 3, 17]],
      [[-13, -1, 10.5], [-9, -0.5, 14.2], [-4, -1, 16.2]],
      [[2, 4, 16.6], [6, 3, 15.8], [9.5, 1.5, 13.6]],
    ],
  };

  // Penas: presas no lado DIREITO da cabeça, acima e atrás da orelha (como na referência)
  const FEATHERS = {
    root: [13.2, -6.6, 5.4],
    fanNormal: [0.42, 0.86, 0.22],
    list: [
      { dir: [0.25, -0.4, 0.88], len: 17.5, w: 5 },
      { dir: [0.58, -0.5, 0.64], len: 16.5, w: 4.8 },
      { dir: [0.8, -0.5, 0.33], len: 15.2, w: 4.5 },
      { dir: [0.87, -0.47, 0.02], len: 13, w: 4 },
    ],
  };

  // Tronco: peito (do peito até a cintura) e pelve (com a tanga)
  const CHEST = [
    { p: [0, 0.8, -17], r: 11.2 },
    { p: [0, 4, -9.5], r: 10.8 },
    { p: [-7.8, 5, 1.5], r: 9.2 },
    { p: [7.8, 5, 1.5], r: 9.2 },
    { p: [-11, -2.8, -3.5], r: 9.4 },
    { p: [11, -2.8, -3.5], r: 9.4 },
    { p: [-9.6, -2.6, 8.6], r: 7 },
    { p: [9.6, -2.6, 8.6], r: 7 },
    { p: [0, 1.5, 7.2], r: 8.4 },
  ];
  const PELVIS = [
    { p: [0, 2.4, 8], r: 10.6 },
    { p: [-9.4, 0, -1], r: 9.6 },
    { p: [9.4, 0, -1], r: 9.6 },
    { p: [-6, -5.2, -2.5], r: 9.4 },
    { p: [6, -5.2, -2.5], r: 9.4 },
    { p: [0, 3.2, -9.8], r: 5.4 },
  ];
  const NECK = { r0: 7.3, r1: 6.4 };

  // Membros: esferas em (t, frente, fora, raio)
  const UPPER_ARM = [
    { t: 0.05, f: 0.3, o: 1.1, r: 7.3 }, // deltoide
    { t: 0.42, f: 1.5, o: 0, r: 5.5 }, // bíceps
    { t: 0.36, f: -1.5, o: 0, r: 5.4 }, // tríceps
    { t: 1, f: 0, o: 0, r: 4.1 }, // cotovelo
  ];
  const FOREARM = [
    { t: 0, f: 0, o: 0, r: 4.1 },
    { t: 0.22, f: 0.6, o: 0.7, r: 4.9 },
    { t: 1, f: 0, o: 0, r: 3.1 },
  ];
  // punho fechado: (ao longo, costas da mão, lado do polegar, raio)
  const FIST = [
    { a: 3, d: 0, s: 0, r: 4 },
    { a: 6.6, d: 0.5, s: -0.4, r: 3.8 },
    { a: 5.8, d: -1.5, s: 0, r: 3.5 },
    { a: 4, d: -0.6, s: 2.6, r: 2.1 }, // polegar
  ];
  const THIGH = [
    { t: 0.04, f: 0, o: 0, r: 8.4 },
    { t: 0.34, f: 1.6, o: 0, r: 7.3 },
    { t: 0.3, f: 0, o: 1.2, r: 6.9 },
    { t: 0.4, f: -1.3, o: 0, r: 6.8 },
    { t: 1, f: 0.5, o: 0, r: 4.9 },
  ];
  const SHIN = [
    { t: 0, f: 0.4, o: 0, r: 4.9 },
    { t: 0.28, f: -2.3, o: 0, r: 5.6 },
    { t: 0.58, f: -0.4, o: 0, r: 4.2 },
    { t: 1, f: 0, o: 0, r: 3.4 },
  ];
  // pé: (lado de dentro, frente, cima, raio) a partir do tornozelo
  const FOOT = [
    { s: 0, f: -3.6, u: -2.9, r: 3.6 },
    { s: 0, f: 4.8, u: -1.4, r: 3.6 },
    { s: 2.2, f: 10.8, u: -3.4, r: 3.15 },
    { s: -2.1, f: 10.4, u: -3.5, r: 3.05 },
    { s: 0.3, f: 15.4, u: -3.8, r: 2.7 },
  ];

  // Pinturas no corpo (jenipapo): faixas nos braços e nas canelas, símbolo redondo nos ombros
  const BODY_PAINT = {
    upperArmBand: { t: 0.5, w: 3.2 },
    forearmBand: { t: 0.44, w: 2.6 },
    calfBand: { t: 0.34, w: 3.2 },
    shoulderMark: { r: 3.5 },
  };

  // Colar de contas com um dente pendurado
  const NECKLACE = { center: [0, 2.2, 11.2], radius: 10.2, tilt: 0.62, beads: 22, beadR: 1.45, pendant: 5.2 };

  // Tanga: cintura (anel na pelve) e o resto vem do casco da pelve
  const LOINCLOTH = { ringZ: 3.6, ringFrontDrop: 1.6, rx: 15.6, ry: 12.6, band: 2.3 };

  /**
   * Encaixes para equipamento (ainda vazios). Cada item futuro diz em qual encaixe entra e traz suas
   * próprias esferas, presas ao mesmo osso da parte do corpo — por isso acompanha qualquer animação.
   *  - cabeca: capacete (pode esconder o cabelo)       - tronco: armadura (peito + pelve)
   *  - pernas: calça (coxa + canela)                   - pes: botas (canela de baixo + pé)
   *  - maoD / maoE: armas (presas no punho)            - acessorios: colar, penas, brinco, tanga
   */
  const SLOTS = ['cabeca', 'tronco', 'pernas', 'pes', 'maoD', 'maoE', 'acessorios'];

  PD.BODY = BODY;
  PD.PALETTE = PALETTE;
  PD.MODEL = { HEAD, HAIR, FEATHERS, CHEST, PELVIS, NECK, UPPER_ARM, FOREARM, FIST, THIGH, SHIN, FOOT, BODY_PAINT, NECKLACE, LOINCLOTH, SLOTS };
})(window.PD = window.PD || {});
