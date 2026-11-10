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
    hipStand: 83.9, // altura da articulação do quadril em pé (perna quase esticada; andando, a pelve desce)
    hipHalf: 9.4, // metade da distância entre os quadris
    thigh: 40, // coxa (quadril → joelho)
    shin: 37.5, // canela (joelho → tornozelo)
    ankleHeight: 6.5, // tornozelo acima do chão, com o pé no chão
    heelBack: 3.4, // calcanhar atrás do tornozelo: o pé gira em volta dele ao pisar (ponta para cima)
    ballFwd: 10.4, // base dos dedos à frente do tornozelo: o pé gira em volta dela ao sair do chão
    footSide: 11.2, // pés afastados do meio (em pé, parado)
    toeOut: 7, // pés abertos para fora (graus)
    // tronco
    pelvisUp: 2, // centro da pelve acima dos quadris
    waistUp: 15, // pelve → cintura
    chestUp: 21, // cintura → peito
    shoulderHalf: 19.6, // metade da largura entre os ombros (articulação)
    shoulderUp: 5.5, // ombros acima do peito (baixo o bastante para o pescoço aparecer)
    shoulderBack: -1,
    neckBaseUp: 12.5, // peito → base do pescoço
    neck: 26.5, // base do pescoço → centro da cabeça
    headForward: 0.5,
    headScale: 0.9, // tamanho da cabeça; muda tudo da cabeça junto: cabelo, penas, rosto (menor = mais imponente)
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
    paintWhite: '#efe6d2', // tabatinga (listras brancas do rosto)
    band: { base: '#e6d6b4', shade: '#b9a47c', light: '#fff6df' }, // faixa trançada da testa (fundo creme)
    bandRed: '#b92a22',
    bandBlack: '#1c1617',
    cord: { base: '#d6ad55', shade: '#9c7a2c', light: '#f3d68a' }, // cordão trançado (bordas e amarrações)
    claw: { base: '#efe3c6', shade: '#c2b08a', light: '#fffaf0' }, // garras do colar
    eyeWhite: '#f7efe3',
    iris: '#3a1f12',
    gold: '#e8b54a',
    goldShade: '#a87822',
    tooth: { base: '#f3ecdb', shade: '#c7bb9f', light: '#ffffff' },
    beads: ['#b42a26', '#1e1a1b', '#e9dcc0', '#1e1a1b'], // contas: vermelha, preta, creme, preta
    feathers: [
      { base: '#c8281e', tip: '#7d130d', light: '#f05a3c' }, // vermelha
      { base: '#ebe1cb', tip: '#1d1718', light: '#fffaf0' }, // creme com a ponta preta
      { base: '#c8281e', tip: '#7d130d', light: '#f05a3c' },
      { base: '#ebe1cb', tip: '#1d1718', light: '#fffaf0' },
      { base: '#c8281e', tip: '#7d130d', light: '#f05a3c' },
    ],
    shadow: 'rgba(28, 18, 30, 1)',
  };

  // ---- volumes (esferas) ----
  // Cabeça (centro = centro do crânio)
  const HEAD = {
    spheres: [
      { name: 'cranio', p: [0, 0, 0], r: 15.5 },
      { name: 'testa', p: [0, 8.6, 4.4], r: 8.4 },
      { name: 'macaE', p: [-8.7, 7.4, -1.9], r: 6.5 }, // maçãs do rosto altas
      { name: 'macaD', p: [8.7, 7.4, -1.9], r: 6.5 },
      { name: 'mandibulaE', p: [-7.5, 5.1, -10.6], r: 6.3 }, // mandíbula larga
      { name: 'mandibulaD', p: [7.5, 5.1, -10.6], r: 6.3 },
      { name: 'queixo', p: [0, 10.7, -14], r: 5.6 }, // queixo forte e quadrado
      { name: 'queixoE', p: [-3, 10.1, -14.3], r: 4.8 },
      { name: 'queixoD', p: [3, 10.1, -14.3], r: 4.8 },
      { name: 'nariz', p: [0, 17.9, -3.8], r: 2.9 },
      { name: 'asaE', p: [-2.4, 16.4, -4.9], r: 2.05 }, // asas do nariz (nariz largo)
      { name: 'asaD', p: [2.4, 16.4, -4.9], r: 2.05 },
      { name: 'ponte', p: [0, 16.2, 2.8], r: 2.4 },
      { name: 'arcoE', p: [-5.2, 15.3, 4.3], r: 3.5 }, // arco da sobrancelha pesado
      { name: 'arcoD', p: [5.2, 15.3, 4.3], r: 3.5 },
    ],
    neckBase: [0, -2.4, -13], // onde o pescoço entra na cabeça
    ear: { p: [15.2, -0.6, -2.6], r: 3.5 }, // orelha direita (a esquerda é espelhada)
    // traços do rosto, no formato (x, z) da frente da cabeça; o y sai da superfície
    eye: { x: 5.8, z: 0.7, w: 6.6, h: 2.55, iris: 1.45 }, // olhos mais estreitos: olhar firme
    brow: { inner: [2, 3.2], outer: [10.8, 5.5], thick: 2.7 }, // sobrancelha grossa e baixa no meio
    mouth: { x: 3.5, z: -10.1 },
    paintBand: { top: 3.4, bottom: -3.2, x: 15 }, // faixa vermelha nos olhos, de uma têmpora à outra
    // listras brancas nas bochechas, saindo da faixa para baixo e para fora (lado direito; o esquerdo é espelhado)
    whiteStripes: [
      [[5.2, -3.4], [7.5, -5.6], [9.6, -7.7]],
      [[8.2, -2.6], [10.4, -4.6], [12.4, -6.4]],
    ],
    chinLine: { x: 0, z0: -12.3, z1: -17.6, w: 0.75 }, // linha branca no queixo
  };

  // Cabelo: massa de trás (casco), pontas bagunçadas, "touca" do couro cabeludo e franja.
  const HAIR = {
    mass: [
      { p: [0, -2.8, 5.6], r: 17 },
      { p: [0, -8, -2.5], r: 15 },
      { p: [-6.5, -9.5, -14], r: 9 },
      { p: [6.5, -9.5, -14], r: 9 },
      { p: [0, -11, -16], r: 9 },
      { p: [-14, -4, -2], r: 10.2 },
      { p: [14, -4, -2], r: 10.2 },
      { p: [-11.5, -5, -11], r: 7.5 },
      { p: [11.5, -5, -11], r: 7.5 },
    ],
    // mechas: raiz → meio → ponta. Poucas soltas no alto (cabelo meio bagunçado) e as compridas caindo dos lados
    // do rosto e atrás, até o pescoço (o resto do comprimento é o "cabelo comprido", nas costas)
    spikes: [
      { root: [0, -6, 14], mid: [-2, -12, 18], tip: [-1, -19, 19], r: 4.2 },
      { root: [-7, -4, 13], mid: [-11, -9, 15.5], tip: [-14.5, -14, 14], r: 3.8 },
      { root: [7, -5, 13], mid: [11, -10, 15], tip: [14.5, -15, 13.5], r: 3.8 },
      { root: [-14, 0, 3], mid: [-16.2, -1, -8], tip: [-15.6, -3, -18], r: 3 },
      { root: [14, 0, 3], mid: [16.2, -1, -8], tip: [15.6, -3, -18], r: 3 },
      { root: [-13, -5, 0], mid: [-15.2, -6, -11], tip: [-14.2, -8, -21], r: 3.3 },
      { root: [13, -5, 0], mid: [15.2, -6, -11], tip: [14.2, -8, -21], r: 3.3 },
      { root: [-6, -13, 2], mid: [-8, -16, -12], tip: [-7, -15, -26], r: 4 },
      { root: [6, -13, 2], mid: [8, -16, -12], tip: [7, -15, -26], r: 4 },
      { root: [0, -14, 4], mid: [0, -17.5, -10], tip: [0, -16, -25], r: 4.2 },
    ],
    // cabelo comprido caindo nas costas: o alto preso à cabeça, o resto ao peito (até as omoplatas)
    long: {
      head: [{ p: [0, -9, -4], r: 12.5 }, { p: [-7, -7.5, -9], r: 8.5 }, { p: [7, -7.5, -9], r: 8.5 }],
      back: [{ p: [0, -9.4, 11], r: 9.2 }, { p: [-6, -8.6, 9], r: 6.8 }, { p: [6, -8.6, 9], r: 6.8 }, { p: [0, -9, 4], r: 6.4 }],
      // pontas soltas embaixo (x no peito, comprimento): o cabelo termina em mechas, não reto
      tips: [{ x: -5.6, len: 6.5 }, { x: -2.6, len: 9 }, { x: 0.6, len: 8 }, { x: 3.6, len: 9.5 }, { x: 6.2, len: 6 }],
    },
    // duas tranças na frente dos ombros: saem de trás da orelha (cabeça), passam por cima do ombro e descem no
    // peito (lado direito; a esquerda é espelhada)
    braid: { root: [12.6, -3.5, -8], shoulder: [13.4, 2.5, 16.4], chest: [11.6, 13.6, 4], end: [10.8, 12.8, -8.5], r: 2.15, wraps: [0.16, 0.86] },
    // faixa trançada na testa (anel em volta da cabeça): acima das sobrancelhas, com um pouco de testa à mostra, e
    // por cima da linha do cabelo (cabelo em cima, pele embaixo — senão vira tiara)
    band: { front: [7.5, 10.6], back: [9.2, 12.4], out: 0.7 },
    // touca: casca de esfera acima do plano da linha do cabelo
    cap: { c: [0, -0.8, 0.8], r: 17.6, n: [0, -0.49, 0.87], d: 0.6 }, // linha do cabelo encostada na faixa da testa
    // nuca: a metade de trás de uma casca em volta da cabeça. É calculada pela câmera (como a touca), então aparece
    // aos poucos quando a nuca vira para a câmera, em vez de a massa inteira pular para a frente do rosto
    nape: { c: [0, -6.5, -1.5], r: 16, n: [0, -1, 0], d: 0 },
    // franja (mechas caindo por cima da faixa): caminho (x, z) sobre a cabeça + quanto fica acima da pele (lift) + raio.
    // Sem costeletas: como na referência, o cabelo dos lados passa por trás das orelhas.
    // O y sai da superfície da cabeça (veja `surfaceY`), então nada fica flutuando na frente do rosto.
    locks: [
      { path: [[-7, 13], [-9.4, 10.6], [-11, 8]], lift: [-2.5, 1.6, 0.6], r: [2.7, 1.7, 0.5] },
      { path: [[5, 13.2], [7.8, 10.8], [10, 8.2]], lift: [-2.5, 1.6, 0.6], r: [2.7, 1.7, 0.5] },
      { path: [[-3.4, 13.6], [-5.2, 11.6], [-6.6, 9.8]], lift: [-2.5, 1.5, 0.5], r: [2.5, 1.5, 0.45] },
    ],
    // fios brilhantes (faixas de luz no alto, estilo HQ): pontos (x, y, z) sobre a touca
    sheen: [
      [[-11, 3, 13], [-6, 4, 16.2], [0, 3, 17]],
      [[-13, -1, 10.5], [-9, -0.5, 14.2], [-4, -1, 16.2]],
      [[2, 4, 16.6], [6, 3, 15.8], [9.5, 1.5, 13.6]],
    ],
  };

  // Penas: coroa atrás da cabeça, presas na faixa, abrindo em leque para cima (como na referência)
  const FEATHERS = {
    root: [0, -12.5, 10.5],
    fanNormal: [0, -0.96, 0.25],
    list: [
      { dir: [-0.5, -0.36, 0.79], len: 29, w: 5.4, n: [-0.25, -0.94, 0.22], at: -6 },
      { dir: [-0.24, -0.42, 0.87], len: 34, w: 5.9, n: [-0.12, -0.96, 0.2], at: -3 },
      { dir: [0.02, -0.44, 0.9], len: 37, w: 6.1, n: [0, -0.97, 0.22], at: 0 },
      { dir: [0.28, -0.42, 0.86], len: 33, w: 5.9, n: [0.13, -0.96, 0.2], at: 3 },
      { dir: [0.52, -0.36, 0.78], len: 28, w: 5.4, n: [0.25, -0.94, 0.22], at: 6 },
    ],
  };

  // Tronco: peito (do peito até a cintura) e pelve (com a tanga)
  const CHEST = [
    { p: [0, 0.8, -17], r: 13.5 },
    { p: [-8.8, 1, -13], r: 8 }, // oblíquos (cintura menos fina)
    { p: [8.8, 1, -13], r: 8 },
    { p: [0, 4, -9.5], r: 10.8 },
    { p: [-8.2, 5.2, 1.8], r: 9.8 }, // peitorais
    { p: [8.2, 5.2, 1.8], r: 9.8 },
    { p: [-11.6, -2.6, -3.2], r: 10 }, // dorsais (costas largas)
    { p: [11.6, -2.6, -3.2], r: 10 },
    { p: [-6.4, -2.4, 13.2], r: 6.2 }, // trapézio subindo para o pescoço
    { p: [6.4, -2.4, 13.2], r: 6.2 },
    { p: [-10.8, -2.4, 9.4], r: 6.9 },
    { p: [10.8, -2.4, 9.4], r: 6.9 },
    { p: [0, 1.5, 7.4], r: 8.8 },
  ];
  const PELVIS = [
    { p: [0, 2.4, 8], r: 12.5 },
    { p: [-9.2, 0.4, 0.5], r: 8.8 },
    { p: [9.2, 0.4, 0.5], r: 8.8 },
    { p: [-5.5, -4.5, -5], r: 8.2 },
    { p: [5.5, -4.5, -5], r: 8.2 },
    { p: [0, 3.4, -10.2], r: 5.2 },
  ];
  const NECK = { r0: 8.1, r1: 7 }; // pescoço grosso

  // Membros: esferas em (t, frente, fora, raio)
  const UPPER_ARM = [
    { t: 0.05, f: 0.3, o: 1.2, r: 7.9 }, // deltoide
    { t: 0.42, f: 1.6, o: 0, r: 5.9 }, // bíceps
    { t: 0.36, f: -1.6, o: 0, r: 5.7 }, // tríceps
    { t: 1, f: 0, o: 0, r: 4.1 }, // cotovelo
  ];
  const FOREARM = [
    { t: 0, f: 0, o: 0, r: 4.1 },
    { t: 0.18, f: 0.7, o: 0.8, r: 5.5 },
    { t: 1, f: 0, o: 0, r: 2.6 },
  ];
  // mão: palma, polegar e quatro dedos — (ao longo do antebraço a partir do punho, costas da mão, lado do polegar,
  // raio). Cada dedo sai da base e, aberto (relaxado), fica quase reto e um pouco curvo; fechado, dobra para dentro
  // da palma e os nós dos dedos fazem a frente do punho
  const HAND = {
    palm: [{ a: 2.4, d: 0.1, s: 0.2, r: 3.3 }, { a: 6.2, d: 0.35, s: -0.15, r: 3.15 }, { a: 4.2, d: -0.6, s: 1.6, r: 2.6 }],
    fingers: [
      { s: -2.45, base: 7.4, len: 3.7, r: 1.0 }, // mindinho
      { s: -0.82, base: 7.9, len: 4.5, r: 1.12 },
      { s: 0.82, base: 8, len: 4.7, r: 1.15 },
      { s: 2.35, base: 7.7, len: 4.2, r: 1.1 }, // indicador
    ],
    thumb: { base: { a: 3.6, d: -0.6, s: 2.6, r: 1.55 }, open: { a: 6.7, d: -1.15, s: 3.25, r: 1.12 }, fist: { a: 7.2, d: -2.6, s: 0.9, r: 1.25 } }, // encostado no indicador
  };
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
  // pé: (lado de dentro, frente, cima, raio) a partir do tornozelo; o arco fica do lado de dentro (mais alto)
  const FOOT = [
    { s: 0, f: -3.5, u: -3.2, r: 3.3 }, // calcanhar
    { s: 0.5, f: 4, u: 0.2, r: 3.9 }, // peito do pé (alto, perto do tornozelo)
    { s: 2.4, f: 9.9, u: -3.9, r: 2.65 }, // base do dedão
    { s: -2.2, f: 9.5, u: -4.05, r: 2.45 }, // base dos dedos de fora
    { s: -2.9, f: 4.8, u: -4.45, r: 2.05 }, // borda de fora (apoiada no chão)
    { s: 2.1, f: 0.2, u: 0, r: 2.2 }, // maléolo de dentro
    { s: -2.1, f: -0.2, u: -0.3, r: 2.2 }, // maléolo de fora
  ];
  // dedos, no quadro dos dedos (origem na base dos dedos, no chão): o dedão separado dos outros
  const TOES = {
    big: [{ s: 2.5, f: 1.3, u: 1.75, r: 1.75 }, { s: 2.75, f: 4.3, u: 1.55, r: 1.55 }],
    small: [
      { s: 0.45, f: 1.1, u: 1.4, r: 1.35 }, { s: -1.3, f: 0.8, u: 1.3, r: 1.22 }, { s: -2.9, f: 0.3, u: 1.15, r: 1.05 },
      { s: 0.4, f: 3.2, u: 1.2, r: 1.15 }, { s: -1.4, f: 2.7, u: 1.1, r: 1.05 }, { s: -3, f: 2, u: 1, r: 0.9 },
    ],
  };

  // Pinturas no corpo (jenipapo): faixas nos braços e nas canelas, símbolo redondo nos ombros
  const BODY_PAINT = {
    upperArmBand: { t: 0.5, w: 3.2 },
    forearmBand: { t: 0.44, w: 2.6 },
    calfBand: { t: 0.34, w: 3.2 },
    shoulderMark: { r: 5 },
  };

  // Colar de contas (vermelhas, pretas e creme) com garras penduradas na frente
  const NECKLACE = { center: [0, 2.2, 8.2], radius: 12.6, tilt: 0.78, beads: 26, beadR: 1.45, claws: [-0.62, -0.31, 0, 0.31, 0.62], clawLen: 5.6 };

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
  // franja: transforma (x, z, lift) em pontos 3D sobre a pele
  for (const lk of HAIR.locks) {
    lk.pts = lk.path.map(([x, z], j) => [x, (surfaceY(x, z) ?? 0) + lk.lift[j] + lk.r[j], z]);
  }

  PD.BODY = BODY;
  PD.PALETTE = PALETTE;
  PD.MODEL = { HEAD, HAIR, FEATHERS, CHEST, PELVIS, NECK, UPPER_ARM, FOREARM, HAND, THIGH, SHIN, FOOT, TOES, BODY_PAINT, NECKLACE, LOINCLOTH, SLOTS, surfaceY };
})(window.PD = window.PD || {});
