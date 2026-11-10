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
    shoulderUp: 5.5, // ombros acima do peito (baixo o bastante para o pescoço aparecer)
    shoulderBack: -1,
    neckBaseUp: 12.5, // peito → base do pescoço
    neck: 28, // base do pescoço → centro da cabeça
    headForward: 0.5,
    headScale: 1, // tamanho da cabeça; muda tudo da cabeça junto: cabelo, penas, rosto
    // braços
    upperArm: 28,
    forearm: 25,
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
    hairSheen: '#3d4660',
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
      { name: 'macaE', p: [-8.2, 7.2, -3.2], r: 6.4 },
      { name: 'macaD', p: [8.2, 7.2, -3.2], r: 6.4 },
      { name: 'mandibulaE', p: [-6.2, 5.6, -10.4], r: 5.6 },
      { name: 'mandibulaD', p: [6.2, 5.6, -10.4], r: 5.6 },
      { name: 'queixo', p: [0, 10.5, -13.5], r: 5.2 },
      { name: 'nariz', p: [0, 17.6, -3.2], r: 2.6 },
      { name: 'ponte', p: [0, 16, 3], r: 2.2 },
      { name: 'arcoE', p: [-5, 15, 4.5], r: 3 },
      { name: 'arcoD', p: [5, 15, 4.5], r: 3 },
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
    foreheadMark: { x: 0, z: 9.4, w: 4.6, h: 3.2 }, // "V" vermelho na testa
  };

  // Cabelo: massa de trás (casco), pontas bagunçadas, "touca" do couro cabeludo, franja e costeletas.
  const HAIR = {
    mass: [
      { p: [0, -2.8, 5.6], r: 17 },
      { p: [0, -8, -2.5], r: 15 },
      { p: [-6, -8.5, -11.5], r: 9 },
      { p: [6, -8.5, -11.5], r: 9 },
      { p: [-14, -4, -2], r: 10.2 },
      { p: [14, -4, -2], r: 10.2 },
      { p: [-11.5, -5, -11], r: 7.5 },
      { p: [11.5, -5, -11], r: 7.5 },
    ],
    // mechas grandes: raiz → meio → ponta (a curva no meio dá o "S"); abrem para fora e para cima
    spikes: [
      { root: [-4, -3, 14], mid: [-7, -7.5, 20.5], tip: [-5.5, -12.5, 25.5], r: 4.4 },
      { root: [5, -5, 13.5], mid: [8.6, -9, 19], tip: [7.6, -15, 22.5], r: 4.4 },
      { root: [0, -9, 11.5], mid: [1.5, -15, 15.5], tip: [-0.5, -21.5, 16.5], r: 4.4 },
      { root: [-13, -1.5, 7], mid: [-19, -2.5, 8.5], tip: [-24, -5, 13], r: 4 },
      { root: [13, -2.5, 6], mid: [19, -4, 7], tip: [24, -7.5, 11], r: 4 },
      { root: [-14, -4, -5], mid: [-20, -5, -6.5], tip: [-24.5, -7.5, -2.5], r: 3.8 },
      { root: [14, -4.5, -5], mid: [20, -6, -6.5], tip: [24.5, -9, -3], r: 3.8 },
      { root: [-6, -12, 0], mid: [-10, -19, -4.5], tip: [-15, -23, -3], r: 4.4 },
      { root: [6, -12, -1], mid: [10, -19, -5.5], tip: [15.5, -23, -4], r: 4.4 },
      { root: [0, -11, -9], mid: [1, -18, -14.5], tip: [-2, -22.5, -12.5], r: 4.2 },
      { root: [-8, -8, -14], mid: [-11.5, -11, -19.5], tip: [-15.5, -12.5, -18], r: 3.6 },
      { root: [8, -8, -14], mid: [11.5, -11.5, -19.5], tip: [15.5, -13, -18], r: 3.6 },
      { root: [-10, -6, 12], mid: [-15, -9, 16.5], tip: [-18.5, -12, 20], r: 3.6 },
      { root: [10, -7, 11.5], mid: [15, -10, 15.5], tip: [18.5, -13.5, 18.5], r: 3.6 },
    ],
    // touca: casca de esfera acima do plano da linha do cabelo
    cap: { c: [0, -0.8, 0.8], r: 17.6, n: [0, -0.49, 0.87], d: 1.55 }, // linha do cabelo alta: a testa e o "V" aparecem
    // franja e costeletas: caminho (x, z) sobre a cabeça + quanto fica acima da pele (lift) + raio.
    // O y sai da superfície da cabeça (veja `surfaceY`), então nada fica flutuando na frente do rosto.
    locks: [
      { path: [[-7, 13], [-9.4, 10.6], [-11, 8]], lift: [-2.5, 1.6, 0.6], r: [2.7, 1.7, 0.5] },
      { path: [[5, 13.2], [7.8, 10.8], [10, 8.2]], lift: [-2.5, 1.6, 0.6], r: [2.7, 1.7, 0.5] },
      { path: [[-3.4, 13.6], [-5.2, 11.6], [-6.6, 9.8]], lift: [-2.5, 1.5, 0.5], r: [2.5, 1.5, 0.45] },
      { path: [[-14, 3.5], [-14.8, -2], [-15.2, -6.5]], lift: [-1.2, 0.6, 0.2], r: [2, 1, 0.3], side: true },
      { path: [[14, 3.5], [14.8, -2], [15.2, -6.5]], lift: [-1.2, 0.6, 0.2], r: [2, 1, 0.3], side: true },
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
    root: [16, -5, 9],
    fanNormal: [0.86, 0.36, 0.1], // o leque fica de lado (largo visto da direita, ainda aparece de frente)
    list: [
      { dir: [0.18, -0.35, 0.92], len: 27, w: 5.6, n: [0.2, 0.95, 0.2] },
      { dir: [0.35, -0.55, 0.76], len: 25, w: 5.4, n: [0.9, 0.3, 0.1] },
      { dir: [0.42, -0.72, 0.55], len: 23, w: 5.2, n: [0.55, 0.7, 0.4] },
      { dir: [0.45, -0.85, 0.28], len: 20, w: 4.6, n: [0.85, -0.2, 0.45] },
    ],
  };

  // Tronco: peito (do peito até a cintura) e pelve (com a tanga)
  const CHEST = [
    { p: [0, 0.8, -17], r: 13.5 },
    { p: [-8.8, 1, -13], r: 8 }, // oblíquos (cintura menos fina)
    { p: [8.8, 1, -13], r: 8 },
    { p: [0, 4, -9.5], r: 10.8 },
    { p: [-7.8, 5, 1.5], r: 9.2 },
    { p: [7.8, 5, 1.5], r: 9.2 },
    { p: [-11, -2.8, -3.5], r: 9.4 },
    { p: [11, -2.8, -3.5], r: 9.4 },
    { p: [-6, -2.5, 13], r: 5.5 }, // trapézio subindo para o pescoço
    { p: [6, -2.5, 13], r: 5.5 },
    { p: [-10, -2.6, 9], r: 6.2 },
    { p: [10, -2.6, 9], r: 6.2 },
    { p: [0, 1.5, 7.2], r: 8.4 },
  ];
  const PELVIS = [
    { p: [0, 2.4, 8], r: 12.5 },
    { p: [-9.2, 0.4, 0.5], r: 8.8 },
    { p: [9.2, 0.4, 0.5], r: 8.8 },
    { p: [-5.5, -4.5, -5], r: 8.2 },
    { p: [5.5, -4.5, -5], r: 8.2 },
    { p: [0, 3.4, -10.2], r: 5.2 },
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
    { t: 0.18, f: 0.7, o: 0.8, r: 5.2 },
    { t: 1, f: 0, o: 0, r: 2.6 },
  ];
  // punho fechado: (ao longo, costas da mão, lado do polegar, raio)
  const FIST = [
    { a: 3, d: 0, s: 0, r: 4 },
    { a: 6.6, d: 0.5, s: -0.4, r: 3.8 },
    { a: 5.8, d: -1.5, s: 0, r: 3.5 },
    { a: 4, d: -0.6, s: 2.6, r: 2.1 }, // polegar
  ];
  const OPEN_HAND = [
    { a: 3.2, d: 0.2, s: 0, r: 3.6 }, // palma
    { a: 7.4, d: 0.3, s: -0.4, r: 3 }, // base dos dedos
    { a: 10.6, d: -1.2, s: -0.2, r: 2.2 }, // pontas dos dedos (um pouco dobradas)
    { a: 5, d: -0.8, s: 2.8, r: 1.8 }, // polegar
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
    { t: 0.22, f: -3.2, o: 0, r: 6.3 },
    { t: 0.58, f: -0.4, o: 0, r: 4.2 },
    { t: 1, f: 0, o: 0, r: 3.4 },
  ];
  // pé: (lado de dentro, frente, cima, raio) a partir do tornozelo
  const FOOT = [
    { s: 0, f: -3.4, u: -2.9, r: 3.4 }, // calcanhar
    { s: 0, f: 4, u: 0.4, r: 4 }, // peito do pé (alto, perto do tornozelo)
    { s: 2.2, f: 10.6, u: -3.5, r: 2.9 }, // base do dedão
    { s: -2, f: 10.2, u: -3.7, r: 2.7 }, // base dos dedos de fora
    { s: 0.8, f: 15.6, u: -4.6, r: 1.9 }, // ponta (afina)
    { s: 2.1, f: 0.2, u: 0, r: 2.2 }, // maléolo de dentro
    { s: -2.1, f: -0.2, u: -0.3, r: 2.2 }, // maléolo de fora
  ];

  // Pinturas no corpo (jenipapo): faixas nos braços e nas canelas, símbolo redondo nos ombros
  const BODY_PAINT = {
    upperArmBand: { t: 0.5, w: 3.2 },
    forearmBand: { t: 0.44, w: 2.6 },
    calfBand: { t: 0.34, w: 3.2 },
    shoulderMark: { r: 5 },
  };

  // Colar de contas com um dente pendurado
  const NECKLACE = { center: [0, 2.2, 8.2], radius: 12, tilt: 0.78, beads: 24, beadR: 1.5, pendant: 5.4 };

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

  /** y da frente da cabeça no ponto (x, z) (o máximo entre as esferas da cabeça); null fora dela. */
  function surfaceY(x, z) {
    let best = null;
    for (const sp of HEAD.spheres) {
      const dx = x - sp.p[0];
      const dz = z - sp.p[2];
      const q = sp.r * sp.r - dx * dx - dz * dz;
      if (q > 0) {
        const y = sp.p[1] + Math.sqrt(q);
        if (best === null || y > best) best = y;
      }
    }
    return best;
  }
  // franja e costeletas: transforma (x, z, lift) em pontos 3D sobre a pele
  for (const lk of HAIR.locks) {
    lk.pts = lk.path.map(([x, z], j) => [x, (surfaceY(x, z) ?? 0) + lk.lift[j] + lk.r[j], z]);
  }

  PD.BODY = BODY;
  PD.PALETTE = PALETTE;
  PD.MODEL = { HEAD, HAIR, FEATHERS, CHEST, PELVIS, NECK, UPPER_ARM, FOREARM, FIST, OPEN_HAND, THIGH, SHIN, FOOT, BODY_PAINT, NECKLACE, LOINCLOTH, SLOTS, surfaceY };
})(window.PD = window.PD || {});
