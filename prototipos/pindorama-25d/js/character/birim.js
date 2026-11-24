// O BIRIM: outro personagem jogável, montado no MESMO esqueleto do herói (js/character/body.js, rig.js, animator.js).
// Todas as animações e os encaixes de equipamento servem para ele sem mudar nada: aqui ficam só as MEDIDAS dos
// volumes dele, as CORES e os pintores do que é dele — rosto, barba, cabelo curto, boné para trás com os óculos em
// cima, cordão com a coroa, tatuagem do braço esquerdo, relógio, bermuda cargo e chinelos.
// A referência é a ficha aprovada pelo dono (17/11; as imagens ficam fora do repositório).
//
// Como o desenho escolhe o modelo: `appearance.modelo` (veja `PD.models.appearance('birim')` e renderer.js). Um
// modelo é o objeto de medidas (as mesmas chaves de PD.MODEL) mais os ganchos:
//   face(R, esqueleto, look, pedaço)        → o rosto (no lugar do rosto pintado do herói)
//   chestDetail(R, pedaço, esqueleto, look) → detalhes do peito
//   limbDetail(R, esqueleto, lado, parte)   → detalhes na pele de um braço ou de uma perna (a tatuagem)
//   extras(R, esqueleto, look, peças, env)  → peças próprias com lugar pela distância (cabelo, boné, óculos, cordão)
//   wear(R, esqueleto, look, peças, equip)  → roupa presa a uma parte do corpo (a bermuda, o relógio)
//   footUnder / footOver                    → o que vai por baixo e por cima do pé (o chinelo)
// O que é ROUPA sai quando o encaixe correspondente recebe um equipamento (um capacete no lugar do boné, uma calça no
// lugar da bermuda, uma bota no lugar do chinelo); rosto, barba, cabelo e tatuagem são a identidade dele e não saem.
(function (PD) {
  'use strict';
  const M = PD.math;
  const S = PD.shapes;
  const { add, sub, scale, dot, norm, cross, at, dirIn, clamp01, smoothstep } = M;
  const { limbAt } = PD.rig;
  const BASE = PD.MODEL;

  // ------------------------------------------------------------------ cores (tiradas da ficha)
  const PALETTE = {
    ...PD.PALETTE,
    ink: '#1a0e0a',
    inkSoft: '#4f2613',
    skin: { base: '#e2732b', shade: '#a94e1b', light: '#f89248' },
    skinFar: { base: '#cb6424', shade: '#934216', light: '#e1803c' },
    lip: '#a04a26',
    hair: { base: '#17110f', shade: '#0a0706', light: '#3b302c' }, // (cabelo e barba quase pretos, como na referência)
    iris: '#2a170d', // (íris quase preta e branco cor de creme, como na referência)
    eyeWhite: '#f3d8ae',
    // roupa e acessórios
    cap: { base: '#241b1a', shade: '#100b0b', light: '#40332f' },
    capLogo: '#f1cfa6',
    lens: ['#ffd84f', '#ff8a1c', '#dc2a16'],
    frame: { base: '#8c9199', shade: '#4a4e55', light: '#d7dbe0' },
    metal: { base: '#cfd4da', shade: '#7c838c', light: '#ffffff' },
    denim: { base: '#1e1d2b', shade: '#0b0b11', light: '#302f44' },
    stitch: '#d98a3c',
    rivet: '#b8733a',
    print: '#f1cfa6',
    tattoo: 'rgba(52, 27, 20, 0.84)',
    sandal: { base: '#1e1c1d', shade: '#0b0a0b', light: '#3c393a' },
    watch: { base: '#1d1d21', shade: '#0a0a0c', light: '#45454d' },
  };

  // ------------------------------------------------------------------ medidas da cabeça
  // crânio mais estreito e rosto mais comprido que o do herói; a mandíbula e o queixo já têm a grossura da barba
  const HEAD = {
    spheres: [
      // (rodada do rosto, 18/11: a cabeça ficou ~12% mais estreita e os olhos mais afastados — medido lado a lado com a
      // referência, o rosto era largo demais para os olhos: 2,6 vezes a distância entre eles; na referência, 1,9)
      { name: 'cranio', p: [0, -0.4, 1.8], r: 11.5 },
      { name: 'topo', p: [0, -1.5, 4.5], r: 9.6 }, // (devolve a altura que o crânio mais estreito perdeu)
      { name: 'cranioTras', p: [0, -3.8, 0.8], r: 11.2 },
      { name: 'testa', p: [0, 6.6, 4.6], r: 8 },
      { name: 'macaE', p: [-5.8, 8.2, -2.6], r: 5.4 },
      { name: 'macaD', p: [5.8, 8.2, -2.6], r: 5.4 },
      { name: 'orbitaE', p: [-5.1, 9.2, -1.2], r: 4.3 }, // onde o olho assenta: olhando para a frente, um tiquinho para fora
      { name: 'orbitaD', p: [5.1, 9.2, -1.2], r: 4.3 },
      { name: 'mandibulaE', p: [-4.4, 5.4, -9.8], r: 4.9 },
      { name: 'mandibulaD', p: [4.4, 5.4, -9.8], r: 4.9 },
      { name: 'boca', p: [0, 10.6, -7.8], r: 5 },
      { name: 'queixo', p: [0, 10.4, -14.2], r: 5 },
      { name: 'queixoE', p: [-2.3, 9.8, -14.5], r: 4.3 },
      { name: 'queixoD', p: [2.3, 9.8, -14.5], r: 4.3 },
      // o nariz é uma peça à parte (`apart`: fica de fora do casco da cabeça — veja `extras`): de perfil ele sai do rosto
      // de verdade, com a raiz recuada embaixo das sobrancelhas e a base voltando até o lábio
      // (entre as sobrancelhas: sem ela, a superfície do rosto afundava ali e a ponta de dentro da sobrancelha "enrolava"
      // para cima vista de cima; fica dentro do casco, não muda a silhueta)
      { name: 'glabela', p: [0, 12.4, 2.4], r: 3.4 },
      // (comprido e reto, como na ficha: do olho até a base são ~4 cm — a ficha dá 3,5 de frente e 4,8 de perfil — e a
      // ponta fica ~1,2 cm à frente do bigode. Mais curto, a ponta ficava quase na altura do olho, um nariz de botão;
      // mais saliente, virava um bico)
      { name: 'ponte', p: [0, 14.4, 0.3], r: 1, apart: true },
      { name: 'dorso', p: [0, 15.75, -3.4], r: 1.12, apart: true },
      { name: 'nariz', p: [0, 16.7, -6.5], r: 1.5, apart: true },
      { name: 'asaE', p: [-1.7, 14.95, -7.0], r: 1.15, apart: true },
      { name: 'asaD', p: [1.7, 14.95, -7.0], r: 1.15, apart: true },
      { name: 'arcoE', p: [-5.2, 12.6, 3], r: 3.1 }, // (o arco fica acima do olho: mais baixo, o olho caía na parte de baixo dele e sumia)
      { name: 'arcoD', p: [5.2, 12.6, 3], r: 3.1 },
    ],
    neckBase: [0, -2.4, -13],
    // (a orelha é grande e fica do lado de fora, como na referência: do meio do olho até a base do nariz. Rodada 4: medida
    // no perfil da referência, ela fica ~3,5 mais para trás e é maior — antes ficava colada no olho, e de lado a costeleta
    // e os cachos a tapavam)
    ear: { top: { p: [11.1, -5.7, -2.3], r: 2.7 }, mid: { p: [11.5, -5.0, -4.9], r: 2.8 }, lobe: { p: [11.0, -4.0, -7.9], r: 2.0 } },
    eye: { x: 5.5, z: -1.3, w: 5.6, h: 2.0, iris: 1.3, lid: 0.3 }, // (`lid`: a grossura da linha da pálpebra, em cm; o olho é uma amêndoa baixa, a íris grande passa das pálpebras)
    brow: { inner: [1.3, 0.9], outer: [8.9, 0.9], thick: 0 }, // (a sobrancelha em gota do motor fica desligada: a dele é a barra de `browBar`)
    // a sobrancelha (medida na referência): a ponta de dentro em x0, o pico em tPeak do caminho e a ponta fina em x1; zIn, zPeak e
    // zOut = a altura da linha do meio em cada um; w = a grossura
    browBar: { x0: 1.5, x1: 8.9, tPeak: 0.7, zIn: 1.45, zPeak: 2.1, zOut: 1.6, w: 1.28 },
    mouth: { x: 3.8, z: -11.55 },
  };
  // boné (para trás): um ELIPSOIDE — mais comprido de frente para trás e mais alto que a cabeça, a copa estruturada de
  // um boné de verdade — cortado pelo plano da barra (alto na testa, baixo na nuca, onde fica a aba). Ele abraça a
  // cabeça inteira acima da barra: a calota redonda de antes (uma esfera centrada atrás da cabeça) não chegava até a
  // testa, e a testa escapava para fora dela de perfil e vista de cima — o "boné fora da cabeça" (rodada 2, 18/11).
  // c = o centro, a = os semieixos (x para o lado, y para a frente, z para cima), rimFront/rimBack = a altura da barra na
  // testa e na nuca
  const CAP = { c: [0, -0.2, 3.0], a: [12.6, 15.4, 14.2], rimFront: 5.8, rimBack: -2.0, eps: 1e-6 };
  {
    // o plano da barra (inclinado: alto na testa, baixo na nuca): passa pela frente da casca na altura rimFront e pela
    // parte de trás na altura rimBack. n·p = d (p nos eixos da cabeça); acima da barra: n·p > d
    const [, cy, cz] = CAP.c, [, ay, az] = CAP.a;
    const yf = cy + ay * Math.sqrt(1 - ((CAP.rimFront - cz) / az) ** 2);
    const yb = cy - ay * Math.sqrt(1 - ((CAP.rimBack - cz) / az) ** 2);
    const l = Math.hypot(yf - yb, CAP.rimFront - CAP.rimBack);
    CAP.n = [0, -(CAP.rimFront - CAP.rimBack) / l, (yf - yb) / l];
    CAP.d = yf * CAP.n[1] + CAP.rimFront * CAP.n[2];
    CAP.top = cz + az; // (o alto da copa; o botão fica em cima)
  }
  /** Ponto da casca do boné na direção `phi` (0 = testa, π = nuca) e na altura z (`grow`: um pouco para fora). */
  const capPoint = (phi, z, grow = 0) => {
    const [cx, cy, cz] = CAP.c, [ax, ay, az] = CAP.a;
    const s = Math.sqrt(Math.max(0, 1 - ((z - cz) / az) ** 2));
    return [cx + (ax + grow) * s * Math.sin(phi), cy + (ay + grow) * s * Math.cos(phi), z];
  };
  /** A normal da casca no ponto p (nos eixos da cabeça, sem normalizar). */
  const capNormal = (p) => [(p[0] - CAP.c[0]) / CAP.a[0] ** 2, (p[1] - CAP.c[1]) / CAP.a[1] ** 2, (p[2] - CAP.c[2]) / CAP.a[2] ** 2];
  const capRimZ = (phi) => {
    // a altura da barra na direção phi: onde o plano inclinado corta a casca (resolvido por aproximações)
    let z = (CAP.rimFront + CAP.rimBack) / 2 + ((CAP.rimFront - CAP.rimBack) / 2) * Math.cos(phi);
    for (let k = 0; k < 8; k++) {
      const p = capPoint(phi, z);
      z = (CAP.d - CAP.n[1] * p[1]) / CAP.n[2];
    }
    return z;
  };
  // a aba: presa na barra, na nuca (de π − 1 a π + 1 em volta da cabeça), saindo para trás e um pouco para baixo; mais
  // comprida no meio. Uma placa fina (esferas pequenas em volta da borda dela)
  const BRIM = [];
  for (let i = 0; i <= 8; i++) {
    const phi = Math.PI - 1.05 + (2.1 * i) / 8;
    const base = capPoint(phi, capRimZ(phi) + 0.3, 0.2);
    const L = 8.8 * Math.cos((phi - Math.PI) * 1.2);
    const dir = [Math.sin(phi) * 0.92, Math.cos(phi) * 0.92, -0.38];
    BRIM.push(base, [base[0] + dir[0] * L, base[1] + dir[1] * L, base[2] + dir[2] * L]);
  }
  const BRIM_MID = [0, CAP.c[1] - CAP.a[1] - 3.2, CAP.rimBack - 1.6];

  // ------------------------------------------------------------------ medidas da mão e do pé (os do herói são mais simples)
  // A MÃO, escrita em centímetros de verdade. O motor mede a mão em "unidades" (× `size`, e o raio × 0,95 disso), então
  // converto aqui. Palma chata (~4 cm de grossura, e não uma bola), dedos finos e compridos, polegar com a junta do meio.
  const HAND_SIZE = 1.32;
  const hu = (cm) => cm / HAND_SIZE; // comprimento em unidades de mão
  const hru = (cm) => cm / (HAND_SIZE * 0.95); // raio em unidades de mão
  /** Esfera da mão: a = cm a partir do punho, d = para as costas da mão (negativo = palma), s = para o lado do polegar. */
  const hs3 = (a, d, s, r) => ({ a: hu(a), d: hu(d), s: hu(s), r: hru(r) });
  const HAND = {
    size: HAND_SIZE,
    curl: [0.34, 0.24, 0.13, 0.02], // quanto cada dedo dobra a mais numa mão solta (mindinho → indicador)
    palm: [
      hs3(1.3, 0, -1.25, 2.05), hs3(1.3, 0, 1.15, 2.05), // perto do punho
      hs3(4.9, 0.15, -2.35, 1.95), hs3(4.9, 0.15, 2.15, 2), // meio da palma
      hs3(8.4, 0.3, -2.8, 1.6), hs3(8.8, 0.35, -0.95, 1.72), hs3(8.9, 0.35, 0.95, 1.72), hs3(8.6, 0.3, 2.75, 1.66), // os nós
      hs3(3.5, -1, 2.45, 1.95), // a "almofada" do polegar, do lado da palma
    ],
    fingers: [
      { s: hu(-2.85), base: hu(8.7), len: hu(5.7), r: hru(0.8) }, // mindinho
      { s: hu(-0.97), base: hu(9.2), len: hu(7.1), r: hru(0.88) },
      { s: hu(0.97), base: hu(9.3), len: hu(7.7), r: hru(0.92) },
      { s: hu(2.8), base: hu(9), len: hu(6.9), r: hru(0.9) }, // indicador
    ],
    thumb: {
      base: hs3(2.7, -0.9, 3, 1.55),
      mid: { open: hs3(5.8, -1.3, 4.7, 1.22), fist: hs3(6.6, -2.5, 3.5, 1.28) },
      open: hs3(8.6, -1.7, 5.6, 1.02),
      fist: hs3(9.4, -3.6, 1.5, 1.12),
    },
  };
  // O PÉ (cm a partir do tornozelo: s = para dentro, f = para a frente, u = para cima; o chão fica em u = −6,5): peito do
  // pé mais baixo que o do herói, calcanhar, as duas "bolas" da frente e os ossinhos do tornozelo.
  const FOOT = [
    { s: 0, f: -3.6, u: -3.4, r: 3.1 }, // calcanhar
    { s: 0.4, f: 4.2, u: -1.2, r: 3.3 }, // peito do pé
    { s: 0.6, f: 7.6, u: -2.9, r: 2.9 },
    { s: 2.5, f: 10.2, u: -4.1, r: 2.4 }, // bola de dentro (atrás do dedão)
    { s: -2.5, f: 9.2, u: -4.3, r: 2.2 }, // bola de fora
    { s: -3, f: 4.6, u: -4.6, r: 1.9 }, // beirada de fora
    { s: 2.6, f: 0.2, u: 0.3, r: 1.7 }, // ossinho de dentro
    { s: -2.7, f: -0.9, u: -0.5, r: 1.7 }, // ossinho de fora
  ];
  // OS CINCO DEDOS, separados (cm a partir da dobra dos dedos: s = para dentro, f = para a frente, u = acima do chão):
  // do mindinho ao dedão, cada um com três esferas (base, meio, ponta)
  const toe3 = (s, f, r, ds = 0.1) => [{ s, f: f[0], u: r, r }, { s: s + Math.sign(s) * ds, f: f[1], u: r * 0.9, r: r * 0.9 }, { s: s + Math.sign(s) * ds * 1.5, f: f[2], u: r * 0.8, r: r * 0.8 }];
  const TOES = {
    ...BASE.TOES,
    each: [
      toe3(-3.95, [-0.7, 1.1, 2.4], 1.08),
      toe3(-2.62, [0, 2.1, 3.6], 1.14),
      toe3(-1.2, [0.5, 2.8, 4.5], 1.22),
      toe3(0.35, [0.9, 3.3, 5.2], 1.3),
      toe3(2.75, [0.5, 3.1, 5.2], 1.8, 0.12), // dedão
    ],
  };

  // ------------------------------------------------------------------ o modelo (o que muda do herói)
  const MODEL = {
    ...BASE,
    id: 'birim',
    HEAD,
    // a cabeça dele é menor que a do herói (que é de "cabeça grande de herói"); rodada 3: um tiquinho menor ainda (na ficha,
    // do alto do boné ao fim da barba são 14,8% da altura; aqui eram 16,1%) e mais ALTA no pescoço (`headDrop` negativo =
    // sobe, em cm): com a câmera do jogo, de cima, a barba encostava no peito e o pescoço sumia — no alvo ele aparece
    // (19/11, lista do dono no jogo: mais 1,5 cm, com o trapézio de dentro mais baixo — era −1,5)
    headScale: 0.66,
    headDrop: -3,
    // O alto entra sob a mandíbula, sem formar uma segunda borda de pele ao lado da barba.
    NECK: { r0: 7.9, r1: 5.5 },
    // corpo de quem treina, mais estreito que o do herói
    // (rodada 3, medido contra a ficha com régua: o tronco abre em V — cintura ~26 cm de largura, peito largo em cima
    // —, as costas são mais cheias que o peito de perfil e o alto do peito não passa da linha do peitoral)
    CHEST: [
      { p: [0, 0.4, -20], r: 12 },
      // (de perfil a cintura desce cheia até a bermuda, sem fechar numa "bolsa" redonda: uma esfera na frente e outra
      // atrás, estreitas — de frente ficam dentro do V)
      { p: [0, 3, -25.5], r: 8.6 },
      { p: [0, -3.2, -25.5], r: 8.6 },
      { p: [-6.2, 0.6, -15], r: 7.4 }, // oblíquos
      { p: [6.2, 0.6, -15], r: 7.4 },
      { p: [0, 3, -10.5], r: 10 },
      { p: [-7.8, 3.4, 0.2], r: 9.6 }, // peitorais (o alto do peito mais chato: a massa do peitoral fica embaixo)
      { p: [7.8, 3.4, 0.2], r: 9.6 },
      { p: [-10.2, -5, -0.6], r: 9 }, // dorsais (mais altas: embaixo do peito o tronco afina logo)
      { p: [10.2, -5, -0.6], r: 9 },
      { p: [0, -6.3, 3.5], r: 9.6 }, // o alto das costas (de perfil, as costas mais cheias que o peito)
      { p: [0, -6.4, 7.6], r: 7.2 }, // a rampa do trapézio atrás, da nuca até o ombro (de perfil a nuca descia reta como uma coluna)
      // trapézio: o tronco é um casco só (convexo), então o alto dos dois trapézios se liga numa linha reta NA FRENTE do
      // pescoço — alto demais, ela tapava o pescoço inteiro. Fica logo abaixo da barba, e a descida para o ombro é mais cheia
      // (19/11, o dono: "o trapézio tem que diminuir, tá muito grande": o de dentro subia quase até a orelha — 3 cm mais
      // baixo e mais fino, e a linha desce em rampa leve do pescoço até o ombro — no mesmo nível ela ficava quadrada. O
      // pescoço volta a aparecer)
      { p: [-6.4, -2.6, 10.4], r: 5.2 },
      { p: [6.4, -2.6, 10.4], r: 5.2 },
      { p: [-11.6, -3.0, 8.8], r: 6.2 },
      { p: [11.6, -3.0, 8.8], r: 6.2 },
      { p: [0, 0.8, 6.8], r: 8.4 },
      { p: [-5.6, 0.4, -22.5], r: 7 }, // a cintura desce reta até o quadril
      { p: [5.6, 0.4, -22.5], r: 7 },
      // (19/11, o dono: "o V do tronco tá ruim". A cintura fechava numa ponta DENTRO da bermuda: no cós o tronco tinha
      // ~17 cm de largura e a bermuda 27, e o fim do casco aparecia como uma cunha em "U" entre os dois lados do cós.
      // Agora ela desce na largura do cós e continua por dentro da bermuda: o cós fecha o tronco numa linha reta)
      { p: [-6.4, 0.3, -29.5], r: 6.6 },
      { p: [6.4, 0.3, -29.5], r: 6.6 },
    ],
    PELVIS: BASE.PELVIS.map((s, k) => (k === 1 || k === 2 ? { p: [Math.sign(s.p[0]) * 8, 0.4, 0.8], r: 8 } : s)),
    // (de cabelo curto, o trapézio aparece de costas: a ponte do ombro fica inteira de qualquer lado — rodada 3)
    // (e a ponta da ponte no trapézio mais baixa, acompanhando o trapézio novo)
    SHOULDER: {
      ...BASE.SHOULDER,
      trap: { p: [12.4, -2.8, 9.8], r: 6.6 },
      back: true,
      // (19/11, o dono: "os ombros estão desconectados do corpo e com traços estranhos": o contorno do braço riscava a
      // emenda do deltoide com o peitoral e com as costas — um arco escuro que fazia do ombro uma bola grudada. Em `clip`
      // o contorno some; a frente e as costas do ombro entram nele)
      clip: [...BASE.SHOULDER.clip, { p: [15, 4.6, 2.8], r: 5.6 }, { p: [15, -5.4, 2.8], r: 5.6 }],
    },
    // (rodada 3: o deltoide mais junto do corpo — de frente e de costas o ombro passava ~2 cm da ficha para fora)
    // e o alto dele um pouco mais alto: com o trapézio abaixo da barba, a linha do ombro tinha descido ~3 cm da ficha
    UPPER_ARM: BASE.UPPER_ARM.map((s) => ({ ...s, t: s.part === 'deltoide' && s.t < 0.2 ? s.t - 0.06 : s.t, o: s.part === 'deltoide' ? s.o * 0.45 : s.o, r: s.r + (s.t === 1 ? 0.35 : s.part === 'deltoide' ? 0.45 : 1.15) })),
    FOREARM: BASE.FOREARM.map((s, k) => ({ ...s, r: s.r + [0.35, 0.8, 0.5, 0.1][k] })),
    HAND,
    FOOT,
    TOES,
    wristJoin: 1.5, // o punho sem emenda (veja o renderer): a ponta do antebraço não vira uma "bola" em cima da mão
    THIGH: BASE.THIGH.map((s, k) => ({ ...s, r: s.r + [0.3, 0.4, 0.4, 0.3, 0.1, 0.1][k] })),
    // canela (rodada 3, medida na ficha): a panturrilha cheia logo abaixo do joelho e a perna afinando até o tornozelo. Em
    // dois pedaços que se emendam na esfera de t = SHIN_SPLIT (veja o renderer): num casco só ela virava um cone
    SHIN_SPLIT: 0.5,
    SHIN: [
      { t: 0, f: 0.3, o: 0, r: 4.8 },
      { t: 0.2, f: -2.9, o: 0, r: 6.8 }, // panturrilha
      { t: 0.24, f: -2.3, o: -1.2, r: 5.6 }, // a outra cabeça da panturrilha (dentro)
      { t: 0.5, f: -1.3, o: -0.2, r: 4.6 }, // a emenda: onde a panturrilha acaba (a quina entre os dois pedaços fica suave)
      { t: 0.62, f: -0.9, o: 0, r: 4 },
      { t: 0.74, f: -0.4, o: 0, r: 3.6 }, // a canela de baixo, fina
      { t: 0.84, f: -1.6, o: 0, r: 2.9 }, // tendão de Aquiles
      { t: 1, f: 0, o: 0, r: 3.2 },
    ],
    // nada disto é dele: cabelo comprido, tranças, faixa e penas; colar de garras; tanga; pinturas de jenipapo; brincos
    // (os riscos do braço — entre o bíceps e o tríceps e em cima do cotovelo — no Birim, de braço grosso e sem pintura,
    // eram os "traços estranhos" do ombro que o dono apontou em 19/11)
    MUSCLE_LINES: { ...BASE.MUSCLE_LINES, braco: [] },
    HAIR: null,
    FEATHERS: null,
    NECKLACE: null,
    LOINCLOTH: null,
    BODY_PAINT: null,
    EARRINGS: false,
  };

  // ------------------------------------------------------------------ utilidades
  /** Curva por pontos [|x|, z] (linear entre eles). */
  const curve = (pts) => (x) => {
    const a = Math.abs(x);
    if (a <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (a <= pts[i][0]) {
        const t = (a - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
      }
    }
    return pts[pts.length - 1][1];
  };
  /** Polígono plano no espaço (pontos 3D já no mundo) → caminho na tela. */
  const flatPath = (R, pts) => {
    const p = new Path2D();
    pts.forEach((q, i) => {
      const s = R.P(q);
      if (i) p.lineTo(s.x, s.y);
      else p.moveTo(s.x, s.y);
    });
    p.closePath();
    return p;
  };
  /** Traço de tinta por baixo e a cor por cima (um fio grosso com contorno): cordão, haste dos óculos, tira do chinelo. */
  function cord(R, pts, width, color, ink = R.pal.ink, extra = 0.9) {
    const ctx = R.ctx;
    if (pts.length < 2) return;
    const path = S.smoothLinePath(pts.map((q) => R.P(q)));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ink;
    ctx.lineWidth = width * R.zoom + Math.max(1.1, R.inkIn * extra * 2);
    ctx.stroke(path);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.9, width * R.zoom);
    ctx.stroke(path);
  }
  /** A coroa de três pontas (o símbolo dele): pontos em (u, v) de −1 a 1, com a base embaixo. */
  const CROWN = [[-1, -0.78], [-1, 0.42], [-0.52, -0.1], [0, 0.95], [0.52, -0.1], [1, 0.42], [1, -0.78]];

  // ------------------------------------------------------------------ rosto
  function face(R, rig, look) {
    const ctx = R.ctx;
    const head = R.H;
    const PAL = R.pal;
    const z = R.zoom;
    const fFace = R.facing(rig.head.f);

    if (fFace < -0.55) return; // de costas: nada do rosto aparece
    // os lábios (a barba e o bigode são volumes, por cima do rosto: veja `extras`)
    const mo = MODEL.HEAD.mouth;
    R._faceStrip(head, -3.7, 3.7, (x) => mo.z + 1.25 - 0.05 * x * x, (x) => mo.z - 1.3 + 0.08 * x * x, M.mix(PAL.lip, PAL.skin.base, 0.12), 12, 0.12);
    // a sombra embaixo do lábio de baixo (na referência, uma curva escura entre o lábio e a pele do queixo)
    {
      const q = [-2.6, -1.3, 0, 1.3, 2.6].map((x) => R._faceAt(head, x, mo.z - 1.45 + 0.07 * x * x, 0.1));
      if (q.every(Boolean) && R.facing(q[2].n) > 0.15) {
        ctx.strokeStyle = PAL.skin.shade;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.6, 0.32 * z);
        ctx.globalAlpha = smoothstep(0.15, 0.45, R.facing(q[2].n));
        ctx.stroke(S.smoothLinePath(q.map((p) => R.P(p.pt))));
        ctx.globalAlpha = 1;
      }
    }

    // sombra do boné e dos óculos na testa (o sol vem do alto)
    R._faceStrip(head, -11.5, 11.5, () => 7.6, (x) => 5.2 - 0.012 * x * x, PAL.skin.shade, 20, 0.1);
    // os planos de sombra da referência: as laterais do rosto (da têmpora até a barba) e o fundo dos olhos, entre a
    // sobrancelha e a pálpebra (um tom só, sem degradê, como o resto do desenho)
    const plane = 'rgba(150, 62, 18, 0.26)';
    const turnedF = R.facing(rig.head.r);
    for (const sx of [-1, 1]) {
      // (a lateral: da ponta de fora da sobrancelha, descendo pela maçã do rosto até a barba — um contorno curvo, não uma faixa;
      // conforme a lateral vira para a câmera ela some: de perfil ela está na luz, e virava uma mancha escura no rosto)
      const sideA = 0.26 * (1 - 0.8 * smoothstep(0.25, 0.8, sx * turnedF));
      facePlane(R, head, sx, [[7.9, 2.6], [9.2, 3.9], [10.5, 3.3], [10.6, -1.2], [10.2, -6.4], [8.7, -7.4], [7.7, -4.6], [7.3, -2.0], [7.5, 0.6]], `rgba(150, 62, 18, ${sideA.toFixed(3)})`);
      R._faceStrip(head, sx > 0 ? 2.4 : -8.4, sx > 0 ? 8.4 : -2.4, (x) => 0.35 + 0.05 * (Math.abs(x) - 2.4), (x) => -0.25 - 0.04 * Math.abs(Math.abs(x) - 5.4), plane, 10, 0.1);
    }

    // olhos e sobrancelhas (os mesmos do herói, com as medidas dele)
    const turned = R.facing(rig.head.r); // > 0: o lado direito dele olha para a câmera
    for (const sx of [-1, 1]) {
      if (-sx * turned < 0.8 && Math.abs(turned) < 0.86) {
        birimEye(R, head, sx, look);
        browBar(R, head, sx, look);
      } else if (sx * turned >= 0.86) sideEye(R, rig, head, sx, look); // de perfil: o olho do lado de cá, visto de lado
    }
    // (o nariz é uma peça à parte, por cima do rosto: veja `extras` e `noseDetail`)
    // boca: fechada e séria; abre um pouco no esforço
    const open = clamp01(look.mouthOpen || 0);
    const m0 = R._faceAt(head, -mo.x, mo.z - 0.22, 0.1);
    const m1 = R._faceAt(head, 0, mo.z + 0.05, 0.1);
    const m2 = R._faceAt(head, mo.x, mo.z - 0.22, 0.1);
    const m3 = R._faceAt(head, 0, mo.z - 0.9 - open * 1.8, 0.1);
    if (m0 && m1 && m2 && m3 && R.facing(m1.n) > 0.15) {
      const a = R.P(m0.pt), b = R.P(m1.pt), c = R.P(m2.pt), d = R.P(m3.pt);
      ctx.globalAlpha = smoothstep(0.15, 0.45, R.facing(m1.n));
      if (open > 0.15) {
        ctx.fillStyle = '#4a1a14';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
        ctx.quadraticCurveTo(d.x, d.y, a.x, a.y);
        ctx.fill();
      }
      ctx.strokeStyle = PAL.ink;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.7, 0.46 * z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (Math.abs(turned) > 0.5 && fFace > -0.35) {
      // de perfil: o risco da boca do lado de cá, da frente dos lábios até o canto (de frente ele não era desenhado)
      const sx = Math.sign(turned);
      const q = [0.2, 1.7, 3.3].map((x, k) => R._faceAt(head, sx * x, mo.z + 0.05 - 0.14 * k, 0.1));
      if (q.every(Boolean)) {
        const [a, b, c] = q.map((p) => R.P(p.pt));
        ctx.strokeStyle = PAL.ink;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.7, 0.46 * z);
        ctx.globalAlpha = smoothstep(0.5, 0.75, Math.abs(turned));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  /**
   * Um plano de sombra na superfície do rosto: o contorno é dado em (x, z) do lado `sx` (o x vem positivo e é espelhado).
   * Os pontos que caem fora do rosto ou viram para o outro lado ficam de fora.
   */
  function facePlane(R, head, sx, pts, color) {
    const q = [];
    for (const [x, z] of pts) {
      const p = R._faceAt(head, sx * x, z, 0.06);
      if (p && R.facing(p.n) > 0.02) q.push(R.P(p.pt));
    }
    if (q.length < 3) return;
    R.ctx.fillStyle = color;
    R.ctx.fill(S.smoothClosedPath(q));
  }

  /**
   * A sobrancelha dele, como na referência: grossa, com a ponta de dentro reta e mais baixa, subindo até o pico (a uns
   * 2/3 do caminho, por fora do olho) e caindo até uma ponta fina. A curva se apoia na profundidade do olho para manter
   * a distância da pálpebra entre as esferas da testa e da órbita.
   */
  function browBar(R, head, sx, look) {
    const B = MODEL.HEAD.browBar;
    const ctx = R.ctx;
    const raise = (look.browRaise || 0) * 0.8;
    const turn = R.facing(norm(head.r)); // (`head` aqui é a cabeça já na escala dele: o eixo não é unitário)
    // (de três quartos a forma fica mais macia, como na referência: o pico arredondado em vez de um bico e a ponta de
    // dentro um pouco mais fina; de frente, a que o dono aprovou, ela não muda. Rodada 4b)
    const soft = smoothstep(0.1, 0.45, Math.abs(turn));
    // O lado de lá encurta gradualmente. O balanço de frente passa perto da emenda entre as esferas da testa e da órbita:
    // usar a primeira normal nessa emenda para definir o comprimento fazia a sobrancelha sumir com a cabeça quase reta.
    const away = Math.max(0, -sx * turn);
    const x1 = M.lerp(B.x1, B.x0 + 2.5, smoothstep(0.12, 0.64, away));
    const N = 16;
    const top = [];
    const bot = [];
    const E = MODEL.HEAD.eye;
    const eyeDepth = faceY(E.x, E.z);
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const x = B.x0 + (x1 - B.x0) * t;
      const tp = B.tPeak;
      const u = t < tp ? 0 : (t - tp) / (1 - tp);
      // a linha do meio sobe de zIn até zPeak e cai até zOut; a grossura fica igual até o pico e afina até a ponta
      const zc = t < tp ? B.zIn + (B.zPeak - B.zIn) * Math.sin(((t / tp) * Math.PI) / 2) : B.zPeak + (B.zOut - B.zPeak) * Math.pow(u, 1.3 + 0.3 * soft);
      const wOut = t < tp ? 1 : M.lerp(Math.max(0.06, 1 - Math.pow(u, 1.15)), Math.max(0.06, Math.pow(1 - u * u, 0.75)), soft);
      const wIn = 1 - 0.25 * soft * (1 - smoothstep(0, 0.16, t));
      const w = B.w * wOut * wIn;
      const lift = raise * (0.6 + 0.4 * (1 - t));
      const zTop = zc + lift + w / 2;
      const zBot = zc + lift - w / 2;
      const a = R._faceAt(head, sx * x, zTop);
      const b = R._faceAt(head, sx * x, zBot);
      if (!a || !b || R.facing(a.n) < 0.06 || R.facing(b.n) < 0.06) continue;
      const y = eyeDepth - 0.02 * (x - E.x) ** 2;
      top.push(R.P(at(head, sx * x, y, zTop)));
      bot.push(R.P(at(head, sx * x, y, zBot)));
    }
    if (top.length < 2) return;
    const p = new Path2D();
    p.moveTo(top[0].x, top[0].y);
    for (const q of top) p.lineTo(q.x, q.y);
    for (let k = bot.length - 1; k >= 0; k--) p.lineTo(bot[k].x, bot[k].y);
    if (soft > 0 && top.length > 1) {
      // a ponta de dentro: um bico arredondado entre a beirada de cima e a de baixo, um pouco para dentro (para o nariz)
      const ix = top[0].x - top[1].x + bot[0].x - bot[1].x, iy = top[0].y - top[1].y + bot[0].y - bot[1].y;
      const il = Math.hypot(ix, iy) || 1;
      const th = Math.hypot(top[0].x - bot[0].x, top[0].y - bot[0].y);
      const k = 0.32 * th * soft;
      p.quadraticCurveTo((top[0].x + bot[0].x) / 2 + (ix / il) * k, (top[0].y + bot[0].y) / 2 + (iy / il) * k, top[0].x, top[0].y);
    }
    p.closePath();
    ctx.fillStyle = '#1c1416';
    ctx.fill(p);
    ctx.strokeStyle = '#1c1416';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.5, 0.1 * R.hs * R.zoom);
    ctx.stroke(p);
  }

  /**
   * O olho dele, como na referência: amêndoa mais baixa que a do herói, íris grande e escura (cortada em cima e embaixo
   * pelas pálpebras), o brilho branco no alto, a pálpebra de cima grossa passando um pouco do canto de fora, a de baixo
   * fina e a dobra da pálpebra por cima. Os pontos ficam na superfície do rosto (como a sobrancelha).
   */
  function birimEye(R, head, sx, look) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const E = MODEL.HEAD.eye;
    const mid = R._faceAt(head, sx * E.x, E.z, 0.12);
    if (!mid) return;
    const f = R.facing(mid.n);
    if (f < 0.12) return;
    const blink = clamp01(look.blink || 0);
    const w = E.w / 2;
    const h = (E.h / 2) * (1 - blink * 0.92);
    // u: -1 = canto de fora, +1 = canto de dentro; v: para cima (unidades da cabeça)
    const at2 = (u, v, lift = 0.12) => {
      const q = R._faceAt(head, sx * (E.x - u * w), E.z + v, lift);
      return q ? R.P(q.pt) : null;
    };
    const topV = (u) => h * Math.pow(Math.max(0, 1 - u * u), 0.7) * (1 + 0.22 * u);
    const botV = (u) => -h * 0.62 * Math.pow(Math.max(0, 1 - u * u), 0.85) * (1 - 0.2 * u);
    const N = 12;
    const top = [];
    const bot = [];
    for (let k = 0; k <= N; k++) {
      const u = -1 + (2 * k) / N;
      top.push(at2(u, topV(u)));
      bot.push(at2(u, botV(u)));
    }
    if (top.some((q) => !q) || bot.some((q) => !q)) return;
    ctx.globalAlpha = smoothstep(0.12, 0.38, f);
    if (blink < 0.85) {
      const eye = new Path2D();
      eye.moveTo(top[0].x, top[0].y);
      for (const q of top) eye.lineTo(q.x, q.y);
      for (let k = bot.length - 1; k >= 0; k--) eye.lineTo(bot[k].x, bot[k].y);
      eye.closePath();
      ctx.fillStyle = PAL.eyeWhite;
      ctx.fill(eye);
      ctx.save();
      ctx.clip(eye);
      // íris: um pouco para dentro (o olhar para a frente) e para onde o personagem olha
      const gx = (look.gazeX || 0) * 0.9;
      const gy = (look.gazeY || 0) * 0.5;
      const ic = R._faceAt(head, sx * (E.x - 0.15) + gx, E.z + 0.05 + gy, 0.14);
      const ix = R._faceAt(head, sx * (E.x - 0.15) + gx + E.iris, E.z + 0.05 + gy, 0.14);
      const iy = R._faceAt(head, sx * (E.x - 0.15) + gx, E.z + 0.05 + gy + E.iris, 0.14);
      if (ic && ix && iy) {
        const C = R.P(ic.pt), X = R.P(ix.pt), Y = R.P(iy.pt);
        const rx = Math.max(0.5, Math.hypot(X.x - C.x, X.y - C.y));
        const ry = Math.max(0.5, Math.hypot(Y.x - C.x, Y.y - C.y));
        const rot = Math.atan2(X.y - C.y, X.x - C.x);
        ctx.fillStyle = (look.eyeGlow || 0) > 0.3 ? '#e8a514' : PAL.iris;
        ctx.beginPath();
        ctx.ellipse(C.x, C.y, rx, ry, rot, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#0c0606';
        ctx.beginPath();
        ctx.ellipse(C.x, C.y, rx * 0.52, ry * 0.52, rot, 0, M.TAU);
        ctx.fill();
        // o brilho, no alto e para o lado de onde vem a luz (os dois olhos do mesmo lado, como na referência)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(C.x - rx * 0.36, C.y - ry * 0.42, Math.max(0.6, rx * 0.24), 0, M.TAU);
        ctx.fill();
      }
      // sombra da pálpebra no alto do branco
      ctx.fillStyle = 'rgba(90, 40, 20, 0.3)';
      const sh = new Path2D();
      sh.moveTo(top[0].x, top[0].y);
      for (const q of top) sh.lineTo(q.x, q.y);
      for (let k = N; k >= 0; k--) {
        const u = -1 + (2 * k) / N;
        const q = at2(u, topV(u) - h * 0.45);
        if (q) sh.lineTo(q.x, q.y);
      }
      sh.closePath();
      ctx.fill(sh);
      ctx.restore();
    }
    ctx.strokeStyle = PAL.ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // a dobra da pálpebra, por cima (fina). (De três quartos ela desce para perto da pálpebra e fica mais escura, como na
    // referência: lá em cima, encostada na sobrancelha, parecia uma segunda sobrancelha. De frente não muda. Rodada 4b)
    const soft = smoothstep(0.1, 0.45, Math.abs(R.facing(norm(head.r))));
    const crease = [];
    for (let k = 1; k < N; k++) {
      const u = -1 + (2 * k) / N;
      if (u < -0.8 || u > 0.85) continue;
      const q = at2(u, topV(u) + 0.55 - 0.17 * soft + 0.1 * (1 - u * u));
      if (q) crease.push(q);
    }
    if (crease.length > 1 && blink < 0.85) {
      ctx.globalAlpha *= 0.7 + 0.2 * soft;
      ctx.lineWidth = Math.max(0.5, 0.16 * R.zoom);
      ctx.stroke(S.smoothLinePath(crease));
      ctx.globalAlpha = smoothstep(0.12, 0.38, f);
    }
    // a pálpebra de cima: grossa, passando um pouco do canto de fora
    const wing = at2(-1.16, 0.06);
    ctx.lineWidth = Math.max(1, E.lid * R.zoom);
    ctx.stroke(S.smoothLinePath((wing ? [wing] : []).concat(top)));
    // a de baixo: fina, do canto de fora até perto do canto de dentro
    if (blink < 0.85) {
      ctx.lineWidth = Math.max(0.5, 0.2 * R.zoom);
      ctx.stroke(S.smoothLinePath(bot.slice(0, Math.round(N * 0.85))));
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ peito
  /** y da frente do peito no ponto (x, z) do peito (o máximo entre as esferas); null fora dele. */
  function chestY(x, z) {
    let best = null;
    for (const s of MODEL.CHEST) {
      const q = s.r * s.r - (x - s.p[0]) * (x - s.p[0]) - (z - s.p[2]) * (z - s.p[2]);
      if (q > 0) best = Math.max(best ?? -1e9, s.p[1] + Math.sqrt(q));
    }
    return best;
  }
  /** A pele das COSTAS em (x, z): o ponto mais de trás das esferas do tronco (como `chestY`, do outro lado). */
  function backY(x, z) {
    let best = null;
    for (const s of MODEL.CHEST) {
      const q = s.r * s.r - (x - s.p[0]) * (x - s.p[0]) - (z - s.p[2]) * (z - s.p[2]);
      if (q > 0) best = Math.min(best ?? 1e9, s.p[1] - Math.sqrt(q));
    }
    return best;
  }
  /** Ponto na pele das costas, já em 3D nos eixos do peito (para `line`): um tiquinho para fora. */
  const backPt = (x, z) => [x, (backY(x, z) ?? -10) - 0.05, z];
  function chestDetail(R, seg, rig) {
    const ctx = R.ctx;
    const ch = rig.chest;
    const PAL = R.pal;
    const z = R.zoom;
    const fine = R.fine;
    /** Ponto na pele da frente do peito em (x, z). */
    const fp = (x, zz, lift = 0.05) => {
      const y = chestY(x, zz);
      return y === null ? null : R.P(at(ch, x, y + lift, zz));
    };
    const facing = (n) => R.facing(norm(dirIn(ch, n[0], n[1], n[2])));
    const line = (pts, n, width, alpha, color = PAL.inkSoft) => {
      const f = facing(n);
      if (f < 0.12 || (!fine && width < 0.5)) return;
      const q = pts.map((p) => (p.length === 2 ? fp(p[0], p[1]) : R.P(at(ch, p[0], p[1], p[2])))).filter(Boolean);
      if (q.length < 2) return;
      ctx.globalAlpha = alpha * smoothstep(0.12, 0.42, f);
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.5, width * z);
      ctx.stroke(S.smoothLinePath(q));
      ctx.globalAlpha = 1;
    };
    const shadeBlob = (pts, n, alpha, color = PAL.skin.shade) => {
      const f = facing(n);
      if (f < 0.12) return;
      const q = pts.map((p) => fp(p[0], p[1])).filter(Boolean);
      if (q.length < 3) return;
      ctx.globalAlpha = alpha * smoothstep(0.12, 0.42, f);
      ctx.fillStyle = color;
      ctx.fill(S.smoothClosedPath(q));
      ctx.globalAlpha = 1;
    };
    /** O mesmo borrão na pele das COSTAS (pontos [x, z]). */
    const backBlob = (pts, n, alpha, color = PAL.skin.shade) => {
      const f = facing(n);
      if (f < 0.12) return;
      const q = pts.map(([x, zz]) => R.P(at(ch, ...backPt(x, zz))));
      ctx.globalAlpha = alpha * smoothstep(0.12, 0.42, f);
      ctx.fillStyle = color;
      ctx.fill(S.smoothClosedPath(q));
      ctx.globalAlpha = 1;
    };
    /** Sombra comprida nas costas: um traço largo e claro na cor da sombra (lê como volume, não como risco). */
    const backShade = (pts, n, width, alpha) => {
      const f = facing(n);
      if (f < 0.12) return;
      ctx.globalAlpha = alpha * smoothstep(0.12, 0.42, f);
      ctx.strokeStyle = PAL.skin.shade;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(0.8, width * z);
      ctx.stroke(S.smoothLinePath(pts.map(([x, zz]) => R.P(at(ch, ...backPt(x, zz))))));
      ctx.globalAlpha = 1;
    };
    // (19/11, o dono: os riscos escuros da barriga viravam uma GRADE e os das costas um "V" — "redesenhe melhor isso".
    // Como na ficha, os músculos agora são de sombra e luz macias, na cor da pele: os riscos de tinta ficaram só no
    // peitoral, que é a forma mais forte)
    const SH = PAL.skin.shade;
    for (const sx of [-1, 1]) {
      // peitoral: a sombra embaixo dele e a linha
      shadeBlob([[sx * 0.9, -2], [sx * 5.4, -4.9], [sx * 10.6, -4.2], [sx * 14, 0.2], [sx * 13.4, -1.9], [sx * 10.2, -6.5], [sx * 5.2, -7.1], [sx * 1.1, -4.2]], [sx * 0.35, 1, -0.2], 0.42);
      line([[sx * 0.9, -2], [sx * 5.4, -4.9], [sx * 10.6, -4.2], [sx * 14, 0.2]], [sx * 0.35, 1, -0.2], 0.62, 0.75);
      // a luz em cima do peitoral
      shadeBlob([[sx * 2.4, 4.4], [sx * 7.6, 5.6], [sx * 11.6, 3.6], [sx * 10.4, 0.6], [sx * 6.4, -0.4], [sx * 2.8, 0.8]], [sx * 0.3, 1, 0.2], 0.2, PAL.skin.light);
      // clavícula
      line([[sx * 2.4, 9.4, 11.2], [sx * 7.2, 8, 12.6], [sx * 12, 4.4, 12.2]], [sx * 0.2, 0.8, 0.6], 0.45, 0.45, SH);
      // gomos da barriga: três de cada lado — a sombra embaixo de cada um (a dobra, curta e curva, sem os "trilhos" dos
      // lados) e uma luz no meio dele, que dá o volume
      for (const [z0, z1] of [[-8.2, -12.2], [-13, -17.2], [-18, -22.4]]) {
        shadeBlob([[sx * 0.9, z1 + 1.1], [sx * 3.2, z1 + 0.5], [sx * 5.6, z1 + 1.5], [sx * 5.9, z1 + 0.5], [sx * 3.2, z1 - 0.5], [sx * 0.8, z1 + 0.1]], [sx * 0.2, 1, -0.1], 0.4);
        shadeBlob([[sx * 1.5, z0 - 0.7], [sx * 3.4, z0 - 0.5], [sx * 4.9, z0 - 1.2], [sx * 4.7, (z0 + z1) / 2 - 0.2], [sx * 3.2, (z0 + z1) / 2 + 0.2], [sx * 1.6, (z0 + z1) / 2]], [sx * 0.2, 1, 0], 0.2, PAL.skin.light);
        line([[sx * 1.3, z1 + 0.3], [sx * 3.3, z1 - 0.1], [sx * 5.1, z1 + 0.8]], [sx * 0.2, 1, 0], 0.4, 0.45, SH);
      }
      // costelas (serrátil) e o lado da barriga (o oblíquo: uma sombra comprida, sem risco)
      for (const zz of [-5.6, -8.6, -11.4]) line([[sx * 11.6, zz + 0.9], [sx * 9.9, zz - 0.5]], [sx * 0.8, 0.6, 0], 0.4, 0.4, SH);
      shadeBlob([[sx * 8.2, -10.5], [sx * 9.6, -15], [sx * 9.4, -21], [sx * 8.4, -24.5], [sx * 7.6, -21], [sx * 7.8, -15]], [sx * 0.6, 0.8, 0], 0.26);
      // costas: a sombra embaixo da omoplata e a luz em cima dela, e as duas lombares (a luz de cada lado do sulco da
      // coluna, embaixo). Nada desce da omoplata até a coluna: era isso que fazia o "V"
      // (a sombra da omoplata é uma meia-lua que segue a beirada de dentro e a ponta de baixo dela; num borrão
      // fechado ela virava uma mancha redonda)
      backShade([[sx * 3.9, 7], [sx * 4.7, 2.4], [sx * 6.6, -1.4], [sx * 9.2, -2.2], [sx * 11.2, 0]], [sx * 0.25, -1, 0.1], 1.5, 0.3);
      backBlob([[sx * 5.2, 8.6], [sx * 9.6, 7.4], [sx * 11.6, 4.4], [sx * 9.8, 3.4], [sx * 6.8, 4.6], [sx * 5.2, 6.8]], [sx * 0.25, -1, 0.3], 0.15, PAL.skin.light);
      // a dorsal: uma sombra larga e clara na beirada de fora, embaixo do braço (o volume do V, sem risco no meio)
      backShade([[sx * 12, -3], [sx * 11.2, -9], [sx * 9.8, -15]], [sx * 0.6, -0.8, 0], 2.2, 0.16);
      backBlob([[sx * 1.5, -9.5], [sx * 3.3, -11.5], [sx * 3.8, -19.5], [sx * 3, -25.5], [sx * 1.7, -25.5], [sx * 1.3, -18]], [sx * 0.15, -1, 0], 0.18, PAL.skin.light);
    }
    line([[0, 5.6], [0, -1.8]], [0, 1, 0], 0.45, 0.45, SH); // esterno
    line([[0, -7.4], [0, -15], [0, -23.4]], [0, 1, 0], 0.45, 0.55, SH); // linha do meio da barriga
    // o sulco da coluna: uma sombra fina e comprida, mais larga embaixo (entre as lombares), e a linha só no meio dela
    backBlob([[-0.5, 7], [-0.8, -2], [-1.3, -14], [-1.2, -24], [0, -26.5], [1.2, -24], [1.3, -14], [0.8, -2], [0.5, 7], [0, 8.5]], [0, -1, 0], 0.3);
    line([backPt(0, 4), backPt(0, -6), backPt(0, -16), backPt(0, -24)], [0, -1, 0], 0.35, 0.45, SH); // coluna
    const f = facing([0, 1, 0.1]);
    if (f > 0.12) {
      ctx.globalAlpha = smoothstep(0.12, 0.4, f);
      // umbigo
      const nb = fp(0, -24.6);
      if (nb) {
        ctx.fillStyle = PAL.skin.shade;
        ctx.beginPath();
        ctx.ellipse(nb.x, nb.y, 0.8 * z, 0.6 * z, 0, 0, M.TAU);
        ctx.fill();
      }
      // mamilos
      ctx.fillStyle = M.mix(PAL.skin.shade, '#5a2412', 0.45);
      for (const sx of [-1, 1]) {
        const c = fp(sx * 8.6, -0.4), u = fp(sx * 8.6 + 1.2, -0.4), v = fp(sx * 8.6, 0.5);
        if (!c || !u || !v) continue;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, Math.max(0.7, Math.hypot(u.x - c.x, u.y - c.y)), Math.max(0.55, Math.hypot(v.x - c.x, v.y - c.y)), Math.atan2(u.y - c.y, u.x - c.x), 0, M.TAU);
        ctx.fill();
      }
      // pelos no meio do peito (uns risquinhos, só de perto)
      if (fine) {
        ctx.strokeStyle = PAL.skin.shade;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.5, 0.36 * z);
        ctx.globalAlpha *= 0.75;
        ctx.beginPath();
        for (const [x, zz, dx, dz] of [[-1.6, 4.6, -0.5, -1.5], [1.5, 4.9, 0.5, -1.5], [-0.7, 2.6, -0.3, -1.6], [0.8, 2.4, 0.3, -1.6], [-2.4, 1.8, -0.7, -1.3], [2.5, 1.6, 0.7, -1.3], [0, 0.4, 0, -1.6], [-1.3, -0.6, -0.4, -1.4], [1.4, -0.8, 0.4, -1.4]]) {
          const a = fp(x, zz), b = fp(x + dx, zz + dz);
          if (!a || !b) continue;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // sombra dos braços que estão na frente do peito (contato), como no herói
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      if (dot(scale(rig.body.r, side), R.toCam) < -0.2) continue;
      const circles = MODEL.UPPER_ARM.map((s) => R.circle(limbAt(rig.upperArm[i], s.t, s.f, s.o), s.r));
      const k = 2.6 * z;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = PAL.skin.shade;
      ctx.fill(S.polyPath(R.hull(circles), -R.light.x * k, -R.light.y * k));
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ cabelo, boné, óculos, brincos, cordão
  function extras(R, rig, look, items, env) {
    const { head, hs, headKey } = env;
    const PAL = R.pal;
    const hp = (p) => at(head, p[0], p[1], p[2]);
    const sphere = (p, r) => R.circle(hp(p), r * hs);
    const gear = R.equipped || {};
    const off = look.semPecas || {};

    // ---- cabelo curto e crespo: a parte de trás da cabeça (uma touca rente) e os cachos da nuca e de trás das orelhas
    const back = R._capPoly(head, { c: [0, -3.0, 1.4], r: 12.2, n: [0, -0.8, 0.6], d: 3, eps: 1e-6 });
    if (back) items.push({ name: 'cabeloCurto', key: headKey + 0.3, group: 'cabeloCurto', segs: [{ poly: back.poly, path: back.path, mat: PAL.hair, k: 0.2, isNape: true, concave: true }] });
    const CURLS = [
      [[-7.7, -8.3, -6.4], 3.0], [[-4.1, -11.2, -8.3], 3.3], [[0, -12.3, -8.9], 3.4], [[4.1, -11.2, -8.3], 3.3], [[7.7, -8.3, -6.4], 3.0],
      // (rodada 4: atrás da orelha, que foi para trás — antes estes ficavam onde ela fica agora)
      [[-10.9, -9.4, -3.4], 3.0], [[10.9, -9.4, -3.4], 3.0], [[-10.4, -9.6, 0.8], 3.0], [[10.4, -9.6, 0.8], 3.0], [[-10.2, -8.6, -7.6], 2.6], [[10.2, -8.6, -7.6], 2.6],
      [[-6.2, -10.9, -2.6], 3.2], [[6.2, -10.9, -2.6], 3.2], [[0, -13.1, -3.6], 3.3],
      // (a segunda fileira, mais baixa e mais larga: na referência o cabelo crespo cobre a nuca toda, de orelha a orelha,
      // e aparece dos lados da mandíbula de frente e de perfil)
      [[-9.4, -8.6, -9.8], 2.8], [[9.4, -8.6, -9.8], 2.8], [[-5.0, -11.4, -11.2], 3.0], [[5.0, -11.4, -11.2], 3.0], [[0, -12.3, -11.8], 3.1],
      [[-9.8, -10.2, -6.4], 2.7], [[9.8, -10.2, -6.4], 2.7], [[-8.8, -11.2, -5.2], 2.9], [[8.8, -11.2, -5.2], 2.9],
      // (embaixo e atrás do lóbulo: de frente aparecem ao lado da barba, embaixo da orelha; de perfil, os cachos descem atrás
      // da orelha até a altura da mandíbula — como nas duas referências)
      [[-10.4, -7.2, -10.4], 2.4], [[10.4, -7.2, -10.4], 2.4], [[-9.4, -8.6, -12.4], 2.2], [[9.4, -8.6, -12.4], 2.2],
      [[-10.8, -8.8, -8.6], 2.4], [[10.8, -8.8, -8.6], 2.4],
    ];
    // (com os fios de cacho por cima, como os da têmpora: liso, cada cacho era uma bola)
    const curlSegs = CURLS.map(([p, r]) => ({ poly: R.hull([sphere(p, r), sphere([p[0] * 0.92, p[1] * 0.92, p[2] + 1.4], r * 0.8)]), circles: R._last, mat: PAL.hair, k: 0.3, noInner: true, decal: (seg) => curlLines(R, seg) }));
    const curlKey = R.keyOf(hp([0, -10.5, -5]));
    // (de trás os cachos ficam por cima da cabeça mas EMBAIXO do boné: eles saem por baixo da barra; antes, com a chave
    // da posição deles, cobriam a parte de baixo do boné e a coroa)
    items.push({ name: 'cachos', key: curlKey < headKey ? Math.min(curlKey, headKey - 0.25) : Math.min(curlKey, headKey + 0.31), group: 'cachos', chain: true, segs: curlSegs });

    // ---- barba, bigode e costeletas: volumes rentes ao rosto (aparecem certo de frente, de lado e de três quartos).
    // Cada pedaço só entra se o lado dele olha para a câmera (o de lá fica escondido atrás do rosto): conforme a
    // cabeça vira de costas eles saem um a um — o bigode primeiro, depois o queixo, a bochecha, a mandíbula e, por
    // último, a costeleta. Na diagonal de costas ainda aparece a barba descendo pela mandíbula, como na ficha.
    // (uma regra antiga tirava quase tudo de uma vez assim que o rosto passava do perfil: a 95° o queixo ficava pelado)
    {
      const segs = [];
      // (os pedaços do lado do rosto que está virado para lá vão numa peça à parte, desenhada logo depois da cabeça e
      // antes da boca: de três quartos eles ficam atrás dos lábios — numa peça só com o resto, cobriam a boca)
      const segsFar = [];
      // (e o pedaço do lado de lá que já virou as costas para a câmera vai atrás da cabeça: só aparece o que passa do
      // contorno do rosto. Por cima dela, de três quartos, a bochecha de lá — que fica atrás do rosto — virava uma bola
      // escura no meio da cara, em cima do bigode, cobrindo o lábio de cima. Rodada 4b)
      const segsBack = [];
      const turned = R.facing(rig.head.r);
      // (`farMin`: um mínimo mais alto só para quando o pedaço está do lado de lá do rosto; `backMin`: do lado de lá, abaixo
      // dele o pedaço vai atrás da cabeça — os pedaços fundos, como a frente da mandíbula, vão antes: de três quartos eles
      // ficam atrás do queixo e, por cima, tapavam a pele embaixo do lábio)
      const piece = (list, nLocal, minFacing, k = 0, curls = false, side = 0, farMin = minFacing, backMin = 0.05) => {
        const far = side && side * turned < -0.12;
        const fa = R.facing(norm(dirIn(rig.head, nLocal[0], nLocal[1], nLocal[2])));
        if (fa < (far ? farMin : minFacing)) return;
        (far ? (fa < backMin ? segsBack : segsFar) : segs).push({ poly: R.hull(list.map(([p, r]) => sphere(p, r))), circles: R._last, mat: PAL.hair, k, noInner: true, decal: curls ? (seg) => curlLines(R, seg) : undefined });
      };
      // O centro conserva o volume da barba cheia. Os cantos sobem para a linha da mandíbula.
      const chinCorner = (sx) => [[sx * 6.4, 8.4, -17.9], 1.9];
      piece([[[0, 10.0, -18.4], 2.5], [[-3.8, 9.4, -18.25], 2.15], [[3.8, 9.4, -18.25], 2.15], [[0, 12.0, -17.0], 2.7]], [0, 0.85, -0.5], -0.22, 0.24);
      for (const sx of [-1, 1]) piece([[[sx * 3.8, 9.4, -18.25], 2.15], chinCorner(sx), [[sx * 4.6, 10.4, -16.6], 2.1]], [sx * 0.3, 0.85, -0.45], -0.2);
      for (const sx of [-1, 1]) piece([[[sx * 3.3, 10.4, -15.5], 1.35]], [sx * 0.3, 0.85, -0.4], -0.2);
      // A barba acompanha a parte de baixo da boca, fechando as frestas de pele nos cantos do queixo.
      piece([[[-3.2, 13.2, -14.0], 1.4], [[0, 14.1, -14.25], 1.4], [[3.2, 13.2, -14.0], 1.4], [[0, 12.2, -16.8], 2.0]], [0, 0.9, -0.3], -0.1, 0.14);
      // (de perfil, na referência, a barba cobre a frente do queixo logo abaixo do lábio: estes dois só entram com o lado deles
      // bem virado para a câmera — de frente a pele embaixo do lábio continua aparecendo, como o dono aprovou. Rodada 4)
      // (rodada 4b: com 0,78 eles entravam bem a 45° e tapavam a pele do queixo que a referência mostra de três quartos;
      // agora entram a ~63° na câmera reta e a ~55° na do jogo — a normal um pouco para cima conta a câmera do jogo, que
      // olha de cima: sem isso, de perfil nela, eles não entravam e a pele embaixo do lábio voltava a aparecer)
      for (const sx of [-1, 1]) piece([[[sx * 1.6, 13.3, -13.7], 1.15], [[sx * 2.3, 12.7, -15.3], 1.5]], [sx, 0.12, 0.35], 0.88);
      for (const sx of [-1, 1]) {
        // (na referência não há faixa escura na frente da orelha: a pele do rosto vai até a orelha, o cabelo da têmpora
        // fica acima dela e a costeleta começa na altura do lóbulo)
        piece([[[sx * 10.7, -2.0, 3.0], 0.9], [[sx * 10.9, -2.6, 0.6], 0.85]], [sx, 0.2, 0], 0.02); // cabelo da têmpora, acima e na frente da orelha
        for (const [p, r] of [[[sx * 11.2, -1.8, 2.8], 1.1], [[sx * 11.6, -3.0, 1.5], 1.05], [[sx * 11.6, -3.8, -0.6], 0.9]]) piece([[p, r]], [sx, 0, 0.1], -0.05, 0, true); // os cachos dela
        const jawCorner = [[sx * 9.6, 2.6, -13.5], 1.0];
        const cheekStart = [[sx * 8.6, 4.6, -13.4], 1.2];
        // A costeleta sobe da mandíbula até a têmpora conforme a cabeça vira de perfil. Na câmera de cima, a tira alta
        // vista de frente invadia a altura dos olhos.
        const sideburn = smoothstep(0.41, 0.69, sx * turned);
        if (sideburn > 0) {
          const upper = [sx * M.lerp(9.6, 10.9, sideburn), M.lerp(2.6, -2.2, sideburn), M.lerp(-13.5, -0.8, sideburn)];
          const middle = [sx * M.lerp(9.6, 10.6, sideburn), M.lerp(2.6, -1.8, sideburn), M.lerp(-13.5, -3.6, sideburn)];
          piece([[upper, 0.62], [middle, 0.7], jawCorner], [sx, -0.3, 0], 0.05, 0, false, sx);
        }
        piece([cheekStart, [[sx * 6.4, 7.4, -14.6], 2.1], [[sx * 8.0, 4.4, -15.0], 1.75]], [sx * 0.8, 0.5, -0.3], -0.12, 0, false, sx, -0.12, 0.46);
        // O canto do lado distante passa por trás da cabeça ao virar, para a bochecha esconder seu volume.
        piece([jawCorner, [[sx * 8.8, 1.0, -14.0], 1.6], [[sx * 7.6, 2.2, -15.8], 1.9], cheekStart], [sx * 0.9, 0.1, -0.35], 0.04, 0, false, sx, 0.04, 0.52);
        piece([[[sx * 7.6, 2.2, -15.8], 1.9], [[sx * 5.6, 5.4, -17.8], 2.0], [[sx * 7.0, 7.6, -16.9], 2.2]], [sx * 0.5, 0.3, -0.8], -0.2, 0, false, sx); // embaixo da mandíbula
        piece([[[sx * 6.4, 7.4, -14.6], 2.1], [[sx * 7.0, 7.6, -16.9], 2.2], chinCorner(sx)], [sx * 0.45, 0.8, -0.35], -0.18, 0, false, sx, -0.18, 0.35); // frente da mandíbula
        // A faixa sob o nariz segue até o canto da boca. Mais baixa no meio, aparece inteira na câmera do jogo.
        const must = [
          [[sx * 0.55, 14.6, -9.7], 0.88], [[sx * 2.1, 14.05, -9.65], 0.90],
          [[sx * 3.45, 13.4, -10.25], 0.84], [[sx * 4.2, 12.6, -10.9], 0.75],
        ];
        if (sx * turned < -0.12) {
          // (do lado de lá, a ponta do bigode — no canto da boca, atrás dos lábios — vai na peça de lá, antes da boca; o resto
          // fica por cima. Numa peça só, de três quartos o bigode de lá cobria os lábios e o bigode virava uma bola. Rodada 4b)
          piece(must.slice(0, 3), [sx * 0.3, 0.9, 0.1], 0.05);
          piece(must.slice(2), [sx * 0.3, 0.9, 0.1], 0.05, 0, false, sx);
        } else piece(must, [sx * 0.3, 0.9, 0.1], 0.05);
        // (de três quartos, do lado de cá, a pele do queixo — mais para a frente que os pedaços de barba em volta dela — saía
        // de baixo da barba como um triângulo do lado do queixo; este pedaço, na superfície do rosto, só entra com o lado
        // virado para a câmera, a partir de ~12°: de frente a pele embaixo do lábio continua a mesma. Rodada 4b)
        piece([[[sx * 4.3, 13.0, -13.7], 1.0], [[sx * 4.0, 12.7, -15.1], 1.15], [[sx * 4.9, 12.0, -14.6], 1.1]], [sx, 0.3, 0], 0.48, 0, false, sx);
        // O canto acompanha a superfície do rosto. Recuado, deixava pele entre o bigode e a bochecha.
        piece([must[3], [[sx * 4.65, 12.85, -12.1], 1.12], [[sx * 5.3, 12.4, -13.65], 1.38], [[sx * 4.4, 12.85, -14.6], 1.4]], [sx * 0.5, 0.85, -0.1], 0.05, 0, false, sx, 0.05, 0.35);
        // Esta faixa cobre a parte saliente da mandíbula e desce até a base da barba nos dois lados.
        piece([[[sx * 8.5, 6.4, -12.3], 1.4], [[sx * 7.65, 8.0, -12.15], 1.85], [[sx * 6.1, 9.7, -14.9], 1.72]], [sx * 0.72, 0.65, -0.18], -0.08, 0, false, sx, -0.02, 0.46);
        // Bochecha inferior, da mandíbula ao canto da boca.
        piece([cheekStart, [[sx * 7.0, 7.0, -13.6], 1.5], [[sx * 5.6, 10.6, -13.2], 1.0], [[sx * 6.4, 7.4, -14.6], 2.1], [[sx * 5.2, 10.8, -13.8], 1.25]], [sx * 0.75, 0.62, -0.1], -0.1, 0, false, sx, -0.1, 0.46);
      }
      beardStrands(piece);
      if (segsBack.length) items.push({ name: 'barbaAtras', key: headKey - 0.05, group: 'barbaAtras', chain: true, segs: segsBack });
      if (segsFar.length) items.push({ name: 'barbaLonge', key: headKey + 0.02, group: 'barbaLonge', chain: true, segs: segsFar });
      if (segs.length) items.push({ name: 'barba', key: headKey + 0.25, group: 'barba', chain: true, segs });
    }

    // ---- sem o boné: o cabelo curto do alto da cabeça (com ele, fica escondido)
    if (off.bone && !gear.cabeca) {
      const top = R._capPoly(head, { c: [0, -1.6, 1.9], r: 12.4, n: [0, -0.38, 0.925], d: 4.2, eps: 1e-6 });
      if (top) items.push({ name: 'cabeloTopo', key: headKey + 0.32, group: 'cabeloTopo', segs: [{ poly: top.poly, path: top.path, mat: PAL.hair, k: 0.2, isCap: true, concave: true }] });
      const TOP = [[0, 3.5, 13.4], [-4.7, 2, 12.1], [4.7, 2, 12.1], [-2.7, -4, 13.9], [2.7, -4, 13.9], [0, -9.5, 11.9], [-6.8, -4.5, 9.9], [6.8, -4.5, 9.9], [0, -1, 14.5]];
      const segs = TOP.map((p) => ({ poly: R.hull([sphere(p, 3.1), sphere([p[0] * 0.9, p[1], p[2] - 1.2], 2.6)]), circles: R._last, mat: PAL.hair, k: 0, noInner: true }));
      items.push({ name: 'cachosTopo', key: headKey + 0.33, group: 'cachosTopo', chain: true, segs });
    }

    // ---- nariz e lábio de baixo: peças à parte do casco da cabeça, para o perfil ter nariz e boca de verdade (dentro
    // do casco, o perfil virava um polígono sem nariz). Com o rosto virado para a câmera elas ficam por cima dele; com
    // o rosto virado para lá, por trás da cabeça (aí só aparece a ponta que passa da silhueta).
    // A sombra das duas continua a da cabeça (`faceShade`): com sombra só delas, do lado em que o rosto está na sombra
    // o nariz ficava mais claro que o rosto em volta, como uma peça colada. De frente o nariz é só a cor da pele por
    // cima da pele (quem o desenha é o risco de `noseLine`); conforme a cabeça vira, ganha a sombra do lado; de perfil,
    // é a silhueta que aparece.
    // O nariz fica por cima da barba (a ponta passa na frente do bigode, vista de cima); o lábio de baixo, por baixo dela
    {
      const front = R.facing(rig.head.f) > -0.05;
      const side = Math.abs(R.facing(rig.head.r));
      // (com o rosto virando para lá, depois do perfil, a ponta do nariz recolhe para dentro do rosto: na diagonal de
      // costas ela era uma bolinha saindo da beira do rosto. Some de vez por volta de 115°. Rodada 4b)
      const tuck = 3.4 * smoothstep(0.1, 0.42, -R.facing(rig.head.f));
      const NOSE = MODEL.HEAD.spheres.filter((s) => s.apart).map((s) => (tuck ? { ...s, p: [s.p[0], s.p[1] - tuck, s.p[2]] } : s));
      const tipPoly = R.hull(NOSE.filter((s) => s.name === 'nariz' || s.name.startsWith('asa')).map((s) => sphere(s.p, s.r)));
      const headSeg = env.headItem && env.headItem.segs[0];
      items.push({
        name: 'narizBirim', key: front ? headKey + 0.26 : headKey - 0.35, group: 'narizBirim',
        segs: [{
          poly: R.hull(NOSE.map((s) => sphere(s.p, s.r))), circles: R._last, mat: PAL.skin, k: 0, noThin: true, noInner: true,
          decal: (seg) => {
            faceShade(R, seg, headSeg, R.pal.skin.shade, Math.max(0.16, 0.26 * smoothstep(0.3, 0.75, side)), side < 0.5 ? tipPoly : null); // (de frente, só a ponta e as asas têm sombra própria)
            noseDetail(R, rig, head, hs);
          },
        }],
        after: () => {
          noseLine(R, rig, head, hs);
          noseFront(R, rig, head, hs);
          noseSide(R, rig, head, hs);
        },
      });
      const lipBase = M.mix(PAL.lip, PAL.skin.base, 0.3);
      const lipMat = { base: lipBase, shade: M.mix(PAL.lip, PAL.skin.shade, 0.4), light: M.mix(lipBase, PAL.skin.light, 0.4) };
      // (quando a boca abre no esforço, o lábio de baixo desce junto: senão ele tapava a boca aberta)
      const lz = -12.25 - 1.7 * clamp01(look.mouthOpen || 0);
      items.push({
        name: 'labioBirim', key: front ? headKey + 0.03 : headKey - 0.36, group: 'labioBirim',
        segs: [{
          poly: R.hull([sphere([-2.6, 14.2, lz + 0.2], 0.7), sphere([0, 15.2, lz], 0.9), sphere([2.6, 14.2, lz + 0.2], 0.7)]), circles: R._last, mat: lipMat, k: 0, noThin: true, noInner: true,
          decal: (seg) => faceShade(R, seg, headSeg, lipMat.shade, 0.22),
        }],
      });
    }

    // ---- brinco (um ponto de metal em cada orelha), do lado que olha para a câmera
    for (let i = 0; i < 2; i++) {
      const ear = items.find((it) => it.name === 'orelha' && it.group === 'orelha' + i);
      if (!ear) continue;
      const side = i === 0 ? -1 : 1;
      items.push({
        name: 'brincoBirim', key: ear.key + 0.2,
        draw: () => {
          // (o brinco fica na frente do lóbulo, um pouco para fora: aparece de frente — como na referência — e de lado;
          // de costas, o lóbulo esconde. Rodada 4b: o limite era -0,1 e, na diagonal de costas (~120°), o ponto, que fica na
          // frente do lóbulo, saía em cima da barba; agora ele some depois de ~110°, quando a orelha já é vista por trás)
          const n = norm(add(scale(rig.head.r, side * 0.6), scale(rig.head.f, 0.8)));
          if (R.facing(n) < 0.3) return;
          const L = MODEL.HEAD.ear.lobe;
          const q = R.P(add(hp([side * L.p[0], L.p[1], L.p[2] - 0.4]), scale(n, L.r * 0.95 * hs)));
          const r = Math.max(0.7, 0.62 * hs * R.zoom); // (um ponto pequeno, como na referência)
          const ctx = R.ctx;
          ctx.fillStyle = PAL.ink;
          ctx.beginPath();
          ctx.arc(q.x, q.y, r + Math.max(0.5, R.inkIn * 0.8), 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = PAL.metal.base;
          ctx.beginPath();
          ctx.arc(q.x, q.y, r, 0, M.TAU);
          ctx.fill();
          ctx.fillStyle = PAL.metal.light;
          ctx.beginPath();
          ctx.arc(q.x - r * 0.3, q.y - r * 0.3, r * 0.4, 0, M.TAU);
          ctx.fill();
        },
      });
    }

    // ---- a orelha por dentro: a dobra da borda e a concha mais escura (o motor desenha a orelha como um volume liso).
    // Com a orelha atrás da cabeça (de frente), o contorno do rosto passando por cima dela também precisa ser riscado:
    // a pintura da orelha cobre o contorno grosso da cabeça e a orelha se emendava na bochecha, sem linha
    for (let i = 0; i < 2; i++) {
      const ear = items.find((it) => it.name === 'orelha' && it.group === 'orelha' + i);
      if (!ear || !ear.segs[0] || ear.segs[0].poly.length < 6) continue;
      const side = i === 0 ? -1 : 1;
      const behind = ear.key < headKey;
      items.push({ name: 'orelhaDetalhe', key: behind ? headKey + 0.11 : ear.key + 0.05, draw: () => earDetail(R, rig, ear.segs[0].poly, behind ? env.headPoly : null, side) });
    }

    // ---- boné para trás e os óculos em cima dele (saem se o encaixe da cabeça tiver um capacete)
    if (!gear.cabeca && !off.bone) {
      // a copa: a parte da casca acima da barra que a câmera vê (o mesmo recorte da touca de cabelo do herói; um casco
      // de esferas pintaria por cima do rosto a parte de trás do boné, que fica escondida atrás da cabeça)
      const dome = capShell(R, head);
      if (dome) items.push({ name: 'bone', key: headKey + 0.34, group: 'bone', segs: [{ poly: dome.poly, path: dome.path, mat: PAL.cap, k: 0.26, concave: true, decal: () => capDetail(R, rig, head, hs) }] });
      // a aba, na nuca, saindo da barra para trás e um pouco para baixo
      // (em gomos: cada um liga dois pontos da barra às duas pontas da aba na frente deles — um casco só achatava a aba
      // numa placa reta, que de trás cobria a parte de baixo do boné e a coroa)
      const brimSegs = [];
      for (let i = 0; i + 3 < BRIM.length; i += 2) brimSegs.push({ poly: R.hull([BRIM[i], BRIM[i + 1], BRIM[i + 2], BRIM[i + 3]].map((p) => sphere(p, 0.9))), circles: R._last, mat: PAL.cap, k: 0, noInner: true, noThin: true }); // (sem risco nem sombra por gomo: a aba é uma peça só)
      items.push({ name: 'aba', key: R.keyOf(hp(BRIM_MID)), group: 'aba', chain: true, segs: brimSegs, after: () => brimEdge(R, hp) });
      // botão do alto
      items.push({ name: 'botaoBone', key: headKey + 0.36, group: 'botaoBone', segs: [{ poly: R.hull([sphere([CAP.c[0], CAP.c[1], CAP.top + 0.4], 1.2)]), circles: R._last, mat: PAL.cap, k: 0.3 }] });
      items.push({ name: 'oculos', key: R.keyOf(hp([0, 11.8, 10.6])) + 0.2, draw: () => glasses(R, rig, head, hs) });
    }

    // ---- cordão com a coroa
    if (!off.cordao) {
      const neck = items.find((it) => it.name === 'pescoco')?.segs[0].circles ?? [];
      items.push({ name: 'cordao', key: env.chestKey + 0.5, draw: () => chain(R, rig, look, neck) });
    }

    // ---- as solas dos chinelos (saem se o encaixe dos pés tiver um calçado)
    if (!gear.pes && !off.chinelos) for (let i = 0; i < 2; i++) items.push(soleItem(R, rig, i, items));
  }

  /**
   * O desenho de dentro da orelha, em cima do volume dela: a concha (mais escura) e a dobra da borda (um risco que
   * acompanha o contorno por dentro), feitas encolhendo o próprio contorno da orelha em volta do meio dela. Com a orelha
   * atrás da cabeça (`headPoly`), só a parte de fora da cabeça recebe o desenho, e o contorno do rosto é riscado por
   * cima da orelha. De costas não aparece (lá se vê o lado de trás da orelha).
   */
  function earDetail(R, rig, earPoly, headPoly, side) {
    const inside = norm(add(scale(rig.head.r, side), scale(rig.head.f, 0.55)));
    const f = R.facing(inside);
    if (f < -0.2) return;
    const ctx = R.ctx;
    const PAL = R.pal;
    const z = R.zoom;
    const n = earPoly.length / 2;
    let cx = 0, cy = 0;
    for (let k = 0; k < earPoly.length; k += 2) {
      cx += earPoly[k];
      cy += earPoly[k + 1];
    }
    cx /= n;
    cy /= n;
    const shrunk = (s, dx = 0, dy = 0) => {
      const out = new Array(earPoly.length);
      for (let k = 0; k < earPoly.length; k += 2) {
        out[k] = cx + (earPoly[k] - cx) * s + dx;
        out[k + 1] = cy + (earPoly[k + 1] - cy) * s + dy;
      }
      return out;
    };
    // (a concha fica um pouco para o lado do rosto: a borda de fora é a mais larga)
    const toward = headPoly ? -side : 0;
    const w = Math.max(1, Math.abs(earPoly[0] - cx) + Math.abs(earPoly[1] - cy));
    ctx.save();
    const clip = new Path2D();
    clip.addPath(S.polyPath(earPoly));
    ctx.clip(clip);
    if (headPoly) {
      // só a parte da orelha que fica fora da cabeça
      const out = new Path2D();
      out.rect(-1e5, -1e5, 2e5, 2e5);
      S.polyPath(headPoly, 0, 0, out);
      ctx.clip(out, 'evenodd');
    }
    const alpha = smoothstep(-0.2, 0.25, f);
    // de lado (a orelha virada para a câmera) ela ganha o desenho de perfil, como na referência: a borda dobrada
    // (hélice), a dobra de dentro (anti-hélice), a concha escura e o trago; de frente fica a concha simples
    const sideK = smoothstep(0.45, 0.8, R.facing(scale(rig.head.r, side)));
    ctx.globalAlpha = alpha * (1 - sideK);
    ctx.fillStyle = PAL.skin.shade;
    ctx.fill(S.polyPath(shrunk(0.6, toward * w * 0.08, 0)));
    ctx.strokeStyle = PAL.ink;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.5, 0.22 * z);
    ctx.stroke(S.polyPath(shrunk(0.68, toward * w * 0.08, 0)));
    if (sideK > 0.01) earProfile(R, rig, side, sideK * alpha);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (headPoly) {
      // o contorno do rosto por cima da orelha (só dentro dela)
      ctx.save();
      ctx.clip(S.polyPath(earPoly));
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = Math.max(0.6, R.inkIn * 1.0);
      ctx.lineJoin = 'round';
      ctx.stroke(S.polyPath(headPoly));
      ctx.restore();
    }
  }

  /**
   * A orelha de perfil (rodada 4, medida na referência): em coordenadas da orelha — u de 0 (a borda da frente, junto do
   * rosto) a 1 (a de trás), v de −1 (o fim do lóbulo) a 1 (o alto) — a borda dobrada (hélice) correndo por dentro do
   * contorno no alto e atrás, a dobra de dentro (anti-hélice, com o garfo no alto), a concha escura na frente dela, o trago
   * e a dobrinha do lóbulo. Já vem recortada dentro da orelha (por earDetail).
   */
  function earProfile(R, rig, side, alpha) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const z = R.zoom;
    const E = MODEL.HEAD.ear;
    const zc = (E.top.p[2] + E.top.r + E.lobe.p[2] - E.lobe.r) / 2;
    const hz = (E.top.p[2] + E.top.r - (E.lobe.p[2] - E.lobe.r)) / 2;
    const yf = (v) => (E.lobe.p[1] + E.lobe.r) * (1 - (v + 1) / 2) + (E.top.p[1] + E.top.r) * ((v + 1) / 2) + 0.1;
    const yb = (v) => (v >= 0 ? E.mid.p[1] - E.mid.r * 1.02 : (E.mid.p[1] - E.mid.r) + ((E.lobe.p[1] - E.lobe.r * 0.9) - (E.mid.p[1] - E.mid.r)) * -v);
    const xo = E.mid.p[0] + E.mid.r * 0.6;
    const pt = (u, v) => R.P(at(R.H, side * (xo - 0.5 * (u - 0.5) ** 2), yf(v) + (yb(v) - yf(v)) * u, zc + hz * v));
    const curve = (uv) => S.smoothLinePath(uv.map(([u, v]) => pt(u, v)));
    ctx.globalAlpha = alpha;
    // a concha (o fundo da orelha, mais escuro)
    ctx.fillStyle = PAL.skin.shade;
    ctx.fill(S.smoothClosedPath([[0.1, 0.12], [0.26, 0.3], [0.46, 0.22], [0.54, -0.04], [0.46, -0.28], [0.26, -0.34], [0.1, -0.16]].map(([u, v]) => pt(u, v))));
    ctx.strokeStyle = PAL.ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.55, 0.24 * z);
    ctx.stroke(curve([[0.3, 0.74], [0.5, 0.8], [0.7, 0.68], [0.82, 0.42], [0.84, 0.1], [0.78, -0.22], [0.66, -0.42]])); // hélice
    ctx.stroke(curve([[0.42, 0.52], [0.58, 0.36], [0.66, 0.08], [0.62, -0.18], [0.5, -0.34]])); // anti-hélice
    ctx.lineWidth = Math.max(0.5, 0.2 * z);
    ctx.stroke(curve([[0.58, 0.36], [0.4, 0.34]])); // o garfo dela, no alto
    ctx.stroke(curve([[0.04, 0.08], [0.14, 0], [0.12, -0.14]])); // trago
    ctx.globalAlpha = alpha * 0.7;
    ctx.stroke(curve([[0.32, -0.5], [0.48, -0.56], [0.6, -0.48]])); // a dobrinha do lóbulo
    ctx.globalAlpha = 1;
  }

  /** A superfície do rosto (y, para a frente) no ponto (x, z) da cabeça: a mais de fora entre as esferas do casco. */
  function faceY(x, z) {
    let best = -1e9;
    for (const s of MODEL.HEAD.spheres) {
      if (s.apart) continue;
      const q = s.r * s.r - (x - s.p[0]) * (x - s.p[0]) - (z - s.p[2]) * (z - s.p[2]);
      if (q > 0) best = Math.max(best, s.p[1] + Math.sqrt(q));
    }
    return best;
  }
  /** Um número entre 0 e 1 que depende só de i (o mesmo a cada quadro: os fios não tremem). */
  const rnd = (i) => {
    const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  /**
   * Os fios da beirada da barba (na referência a beirada é cheia de pontinhas, não uma linha lisa). Cada fio é uma
   * ponta em 3D: uma esfera grossa dentro da barba e uma fininha fora dela, deitada na pele — por ser volume, aparece
   * certa em qualquer ângulo, e some junto com o pedaço de barba quando o lado dele vira para lá.
   *  - na bochecha: ao longo da linha da barba sobre a mandíbula, apontando para cima;
   *  - embaixo: ao longo da borda de baixo (dos lados e do queixo), apontando para baixo.
   */
  function beardStrands(piece) {
    const along = (pts, step, fn) => {
      let i = 0;
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k], b = pts[k + 1];
        const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / step));
        for (let j = 0; j < n; j++, i++) {
          const t = j / n;
          fn([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], i);
        }
      }
    };
    // Os fios começam onde a barba encontra a bochecha. No alto da costeleta eles sobressaíam ao lado do olho.
    const CHEEK = [[8.6, 4.6, -12.25], [7.0, 7.0, -12.1], [5.6, 10.6, -12.2]];
    // a borda de baixo, do lado da mandíbula até o meio do queixo (os baixos das peças de baixo)
    const BOTTOM = [[9.4, 7.0, -15.6], [9.2, 7.4, -17.8], [7.6, 8.2, -19.55], [5.2, 9.3, -20.15], [2.4, 10.0, -20.8], [0, 10.0, -20.95]];
    // por baixo da mandíbula, do canto dela (atrás) até o queixo: a borda de baixo que aparece de perfil
    const UNDER = [[8.7, -1.4, -14.3], [7.6, 1.8, -17.6], [5.6, 4.6, -19.85], [3.6, 7.4, -20.4]];
    for (const sx of [-1, 1]) {
      along(CHEEK, 0.42, (p, i) => {
        // (mais curtos perto do bigode: ali a barba emenda limpa nele; compridos, de três quartos espetavam ao lado do nariz)
        // (o último trecho, até o bigode, aponta para a câmera de três quartos: os fios dele se empilhavam numa coluna)
        const len = (0.5 + 0.45 * rnd(i + 3)) * (1 - 0.8 * smoothstep(8.8, 10.8, p[1]));
        const lean = (rnd(i + 11) - 0.5) * 0.6 - 0.15; // (um pouco para fora, como pelo penteado para trás)
        const tx = p[0] + lean, tz = p[2] + len;
        const base = [sx * p[0], p[1] + 0.35, p[2] - 0.4];
        // (a ponta deitada na pele, mas sem andar mais que ~1 para a frente: a pele que `faceY` acha é a da FRENTE do rosto —
        // no fundo da bochecha ela fica lá perto do nariz, e de perfil cada fio virava um risco comprido para a frente; juntos,
        // eles faziam uma borda reta e alta na bochecha, como uma máscara. Rodada 4)
        // (perto do bigode a pele da frente está ali mesmo: lá a ponta fica na pele — limitada, ela entrava no rosto e virava
        // um risco preto do lado do nariz, de três quartos)
        const tip = [sx * tx, Math.min(Math.max(p[1], faceY(tx, tz)) + 0.12, p[1] + 1.2 + 3 * smoothstep(5, 8, p[1])), tz];
        // (os do lado de lá do rosto só entram com ele quase de frente, até ~13°: virando, o trecho perto do bigode aponta
        // para a câmera e os fios dele se empilhavam numa coluna espetada do lado do nariz, de 15° a 45° — eles são
        // desenhados por cima da cabeça, então nada os escondia. A borda de lá fica lisa, a do pedaço de barba. Rodada 4)
        piece([[base, 0.34], [tip, 0.07]], [sx * 0.75, 0.62, -0.1], -0.1, 0, false, sx, 0.45);
      });
      along(UNDER, 0.55, (p, i) => {
        const len = 0.32 + 0.3 * rnd(i + 61);
        const lean = (rnd(i + 73) - 0.5) * 0.5;
        piece([[[sx * p[0], p[1], p[2] + 0.4], 0.32], [[sx * (p[0] + lean * 0.3), p[1] - 0.2 + lean, p[2] - len], 0.07]], [sx * 0.6, 0.1, -0.8], 0.04, 0, false, sx);
      });
      along(BOTTOM, 0.55, (p, i) => {
        if (sx > 0 && p[0] === 0) return; // (o fio do meio, uma vez só)
        const len = 0.35 + 0.3 * rnd(i + 31);
        const lean = (rnd(i + 47) - 0.5) * 0.5;
        const side = p[0] > 8.5; // (nos lados, o fio aponta para fora; embaixo, para baixo)
        const base = [sx * (p[0] - (side ? 0.4 : 0)), p[1], p[2] + (side ? 0 : 0.4)];
        const tip = side ? [sx * (p[0] + len), p[1] - 0.2, p[2] + lean] : [sx * (p[0] + lean), p[1] - 0.15, p[2] - len];
        piece([[base, 0.32], [tip, 0.07]], [sx * 0.35, 0.8, -0.45], -0.2);
      });
    }
  }

  /**
   * Os fios de um cacho: dois arcos mais claros dentro de cada círculo do pedaço (sem eles, o cabelo crespo era uma
   * mancha escura lisa).
   */
  function curlLines(R, seg) {
    if (!seg.circles || !R.fine) return;
    const ctx = R.ctx;
    ctx.strokeStyle = R.pal.hair.light;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.85;
    for (const c of seg.circles) {
      ctx.lineWidth = Math.max(0.5, c.r * 0.12);
      ctx.beginPath();
      ctx.arc(c.x - c.r * 0.12, c.y + c.r * 0.05, c.r * 0.55, Math.PI * 0.95, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c.x + c.r * 0.2, c.y + c.r * 0.25, c.r * 0.32, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * A copa do boné na tela: a parte de FORA da casca (o elipsoide de CAP) que olha para a câmera e fica acima da barra.
   * O resto está atrás da cabeça (pintar o boné inteiro cobriria o rosto com a parte de trás dele).
   * Conta no "espaço da esfera": o elipsoide é uma esfera esticada (p = c + A·u, com u de tamanho 1), então
   *  - a parte que olha para a câmera é u·w > 0, com w = A⁻¹·v (v = a direção da câmera nos eixos da cabeça), e a
   *    silhueta é o grande círculo u·w = 0;
   *  - a barra é o círculo u·m = k (m = A·n normalizado), e acima dela fica u·m > k.
   * O contorno é o trecho visível da barra seguido do trecho da silhueta que fica acima dela.
   */
  function capShell(R, head) {
    const C = CAP.c, A = CAP.a, eps = CAP.eps;
    const v = R.toCam;
    const ex = norm(head.r), ey = norm(head.f), ez = norm(head.u);
    const unit = (p) => {
      const l = Math.hypot(p[0], p[1], p[2]) || 1;
      return [p[0] / l, p[1] / l, p[2] / l];
    };
    const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const basis = (n) => {
      const t = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const e1 = unit(cross3(n, t));
      return [e1, cross3(n, e1)];
    };
    const w = unit([dot(v, ex) / A[0], dot(v, ey) / A[1], dot(v, ez) / A[2]]);
    const mRaw = [CAP.n[0] * A[0], CAP.n[1] * A[1], CAP.n[2] * A[2]];
    const mLen = Math.hypot(mRaw[0], mRaw[1], mRaw[2]);
    const m = [mRaw[0] / mLen, mRaw[1] / mLen, mRaw[2] / mLen];
    const k = (CAP.d - dot3(CAP.n, C)) / mLen;
    const toScreen = (u) => R.P(at(head, C[0] + A[0] * u[0], C[1] + A[1] * u[1], C[2] + A[2] * u[2]));
    const N = 72;
    const rho = Math.sqrt(Math.max(0, 1 - k * k));
    const [r1, r2] = basis(m);
    const rim = [];
    for (let i = 0; i < N; i++) {
      const s = (i / N) * M.TAU;
      const u = [0, 1, 2].map((j) => k * m[j] + rho * (Math.cos(s) * r1[j] + Math.sin(s) * r2[j]));
      rim.push({ u, vis: dot3(u, w) > eps });
    }
    const [g1, g2] = basis(w);
    const sil = [];
    for (let i = 0; i < N; i++) {
      const t = (i / N) * M.TAU;
      const u = [0, 1, 2].map((j) => Math.cos(t) * g1[j] + Math.sin(t) * g2[j]);
      sil.push({ u, inCap: dot3(u, m) > k + eps });
    }
    const nRim = rim.filter((r) => r.vis).length;
    const nSil = sil.filter((r) => r.inCap).length;
    // um trecho seguido (em volta do círculo) dos pontos que cumprem `ok`
    const run = (list, ok) => {
      const n = list.length;
      const start = list.findIndex((r, i) => ok(r) && !ok(list[(i - 1 + n) % n]));
      if (start < 0) return null;
      const out = [];
      for (let j = 0; j < n; j++) {
        const r = list[(start + j) % n];
        if (!ok(r)) break;
        out.push(r.u);
      }
      return out;
    };
    let us;
    if (nRim === N) us = nSil === 0 ? rim.map((r) => r.u) : sil.map((r) => r.u); // (a barra inteira à vista: de baixo)
    else if (nRim === 0) {
      if (nSil === 0) return null; // (de baixo, sem nada da copa à vista)
      us = sil.map((r) => r.u); // (de cima: a copa inteira)
    } else {
      const a = run(rim, (r) => r.vis);
      const b = run(sil, (r) => r.inCap);
      if (!a || !b) return null;
      const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      const end = a[a.length - 1];
      us = a.concat(d2(b[0], end) <= d2(b[b.length - 1], end) ? b : b.slice().reverse());
    }
    const poly = [];
    for (const u of us) {
      const q = toScreen(u);
      poly.push(q.x, q.y);
    }
    if (poly.length < 6) return null;
    return { poly, path: S.polyPath(poly) };
  }

  /** Costuras do boné, a fivela com a abertura em cima da testa e a coroa bordada no painel que fica virado para trás. */
  function capDetail(R, rig, head, hs) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const z = R.zoom;
    const hp = (p) => at(head, p[0], p[1], p[2]);
    const nrm = (phi, zz) => {
      const nl = capNormal(capPoint(phi, zz));
      return norm(dirIn(rig.head, nl[0], nl[1], nl[2]));
    };
    const top = CAP.top - 0.7;
    // costuras dos gomos, do botão até a barra
    if (R.fine) {
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.5, 0.4 * z);
      for (let k = 0; k < 6; k++) {
        const phi = (k / 6) * M.TAU + M.TAU / 12;
        const pts = [];
        for (let j = 0; j <= 8; j++) {
          const zz = capRimZ(phi) + ((top - capRimZ(phi)) * j) / 8;
          pts.push(R.facing(nrm(phi, zz)) > 0.06 ? R.P(hp(capPoint(phi, zz, 0.15))) : null);
        }
        ctx.strokeStyle = PAL.cap.shade;
        ctx.globalAlpha = 0.9;
        strokeGaps(ctx, pts);
      }
      ctx.globalAlpha = 1;
    }
    // a barra (um vinco claro logo acima da borda), menos na frente, onde fica a abertura
    {
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const phi = (k / 40) * M.TAU;
        const open = Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi))) < OPEN.half + 0.06;
        pts.push(!open && R.facing(nrm(phi, capRimZ(phi) + 1.6)) > 0.05 ? R.P(hp(capPoint(phi, capRimZ(phi) + 1.7, 0.15))) : null);
      }
      ctx.strokeStyle = PAL.cap.light;
      ctx.lineWidth = Math.max(0.5, 0.42 * z);
      ctx.globalAlpha = 0.75;
      strokeGaps(ctx, pts);
      ctx.globalAlpha = 1;
    }
    // a abertura em meia-lua em cima da testa e a fivela de furinhos (o fundo de um boné usado para trás)
    capOpening(R, rig, head, hs, nrm);
    // a coroa: no painel da frente do boné, que com ele para trás fica na nuca
    const zc = capRimZ(Math.PI) + 5.2;
    const n = nrm(Math.PI, zc);
    const f = R.facing(n);
    if (f > 0.15) {
      const c = hp(capPoint(Math.PI, zc, 0.2));
      const right = norm(cross(rig.head.u, n));
      const up = norm(cross(n, right));
      const w = 3.5 * hs, h = 3 * hs;
      const pts = CROWN.map(([u, v]) => add(add(c, scale(right, u * w)), scale(up, v * h)));
      ctx.globalAlpha = smoothstep(0.15, 0.4, f);
      ctx.strokeStyle = PAL.capLogo;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.9, 0.62 * hs * z);
      ctx.stroke(flatPath(R, pts));
      ctx.globalAlpha = 1;
    }
  }
  /** A borda da aba: um risco claro na ponta dela (como o brilho da referência) e um escuro onde ela sai da barra. */
  function brimEdge(R, hp) {
    const ctx = R.ctx;
    const tips = [], base = [];
    for (let i = 0; i < BRIM.length; i += 2) {
      base.push(R.P(hp(BRIM[i])));
      tips.push(R.P(hp(BRIM[i + 1])));
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = R.pal.cap.light;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(0.6, 0.45 * R.zoom);
    ctx.stroke(S.smoothLinePath(tips));
    ctx.strokeStyle = R.pal.cap.shade;
    ctx.lineWidth = Math.max(0.6, 0.35 * R.zoom);
    ctx.stroke(S.smoothLinePath(base));
    ctx.globalAlpha = 1;
  }
  /** Risca os trechos seguidos de uma lista de pontos (null = buraco). */
  function strokeGaps(ctx, pts) {
    let run = [];
    const flush = () => {
      if (run.length > 1) ctx.stroke(S.smoothLinePath(run));
      run = [];
    };
    for (const q of pts) {
      if (q) run.push(q);
      else flush();
    }
    flush();
  }
  // a abertura de trás do boné (que fica em cima da testa): metade da largura em radianos em volta da cabeça e a altura
  const OPEN = { half: 0.36, h: 3.4 };
  /**
   * A abertura e a fivela (snapback), como na referência: uma meia-lua escura acima da barra (dá para ver o cabelo por
   * ela) e, atravessando a parte de baixo dela, a tira da fivela com a fileira de furinhos e o pino.
   */
  function capOpening(R, rig, head, hs, nrm) {
    const f = R.facing(nrm(0, capRimZ(0) + 1.2));
    if (f < 0.05) return;
    const ctx = R.ctx;
    const PAL = R.pal;
    const z = R.zoom;
    const hp = (p) => at(head, p[0], p[1], p[2]);
    const on = (phi, dz, grow = 0.12) => R.P(hp(capPoint(phi, capRimZ(phi) + dz, grow)));
    ctx.globalAlpha = smoothstep(0.05, 0.3, f);
    // a meia-lua: sobe da barra até OPEN.h no meio
    const arch = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const t = -1 + (2 * i) / N;
      arch.push(on(t * OPEN.half, OPEN.h * Math.sqrt(Math.max(0, 1 - t * t)) ** 0.9));
    }
    const hole = new Path2D();
    hole.moveTo(arch[0].x, arch[0].y);
    for (const q of arch) hole.lineTo(q.x, q.y);
    for (let i = N; i >= 0; i--) {
      const q = on(-OPEN.half + (2 * OPEN.half * i) / N, -0.05);
      hole.lineTo(q.x, q.y);
    }
    hole.closePath();
    ctx.fillStyle = PAL.hair.shade;
    ctx.fill(hole);
    ctx.strokeStyle = PAL.ink;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.6, 0.3 * z);
    ctx.stroke(S.smoothLinePath(arch));
    // a tira da fivela, atravessando a parte de baixo da abertura
    const band = new Path2D();
    const B0 = 0.25, B1 = 1.45, H = OPEN.half + 0.05;
    const n2 = 12;
    for (let i = 0; i <= n2; i++) {
      const q = on(-H + (2 * H * i) / n2, B1);
      if (i === 0) band.moveTo(q.x, q.y);
      else band.lineTo(q.x, q.y);
    }
    for (let i = n2; i >= 0; i--) {
      const q = on(-H + (2 * H * i) / n2, B0);
      band.lineTo(q.x, q.y);
    }
    band.closePath();
    ctx.fillStyle = PAL.cap.light;
    ctx.fill(band);
    ctx.lineWidth = Math.max(0.5, 0.24 * z);
    ctx.stroke(band);
    // os furinhos (e o pino, cheio, na ponta)
    const holes = 6;
    for (let i = 0; i < holes; i++) {
      const phi = -H + 0.1 + ((2 * H - 0.2) * i) / (holes - 1);
      const q = on(phi, (B0 + B1) / 2, 0.16);
      const r = Math.max(0.5, 0.36 * hs * z);
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, M.TAU);
      if (i === 0) {
        ctx.fillStyle = PAL.ink;
        ctx.fill();
      } else {
        ctx.lineWidth = Math.max(0.5, 0.2 * z);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Óculos de lente laranja, apoiados no boné em cima da testa: duas lentes, a ponte e as hastes. */
  function glasses(R, rig, head, hs) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const z = R.zoom;
    const hp = (p) => at(head, p[0], p[1], p[2]);
    const nLens = norm(dirIn(rig.head, 0, 0.9, 0.44));
    const fl = R.facing(nLens);
    // hastes: da ponta de fora de cada lente até atrás da orelha, por fora do boné
    const WRAP = 0.5; // quanto cada lente vira para o lado (os óculos abraçam a cabeça): de perfil a de cá aparece
    const lensFacing = (sx) => R.facing(norm(add(nLens, scale(rig.head.r, WRAP * sx))));
    for (const sx of [-1, 1]) {
      const ns = norm(dirIn(rig.head, sx, 0.25, 0.2));
      if (R.facing(ns) < -0.02) continue;
      // (de costas, a ponta da frente da haste fica escondida atrás do boné: sem isto ela sobrava como uma antena)
      const path = [[sx * 10.2, 7.8, 10.2], [sx * 11.9, 2.2, 8.8], [sx * 12.6, -3.4, 7.2], [sx * 12.4, -8.4, 5.8]];
      cord(R, (lensFacing(sx) < 0.04 ? path.slice(2) : path).map(hp), 0.6 * hs, PAL.frame.base);
    }
    if (fl < -0.3) return; // de costas, as lentes ficam atrás do boné
    const up = norm(sub(rig.head.u, scale(nLens, dot(rig.head.u, nLens))));
    const LENS = [[-4, 1.8], [-0.4, 2.35], [3.6, 2.05], [4.5, 0.55], [3.7, -1.7], [0.7, -2.35], [-2.8, -1.9], [-4.2, -0.2]];
    const lenses = [];
    for (const sx of [-1, 1]) {
      // cada lente vira um pouco para o lado (os óculos abraçam a cabeça)
      const c = hp([sx * 5.5, 11.7, 10.4]);
      const right = norm(add(scale(rig.head.r, 1), scale(rig.head.f, -WRAP * sx)));
      const pts = LENS.map(([u, v]) => add(add(c, scale(right, sx * u * 1.18 * hs)), scale(up, v * 1.18 * hs)));
      if (lensFacing(sx) >= 0.04) lenses.push({ sx, c, pts, path: flatPath(R, pts) });
    }
    if (!lenses.length) return;
    // ponte
    if (fl > 0.02) cord(R, [hp([-1.2, 12.5, 11.9]), hp([0, 12.9, 11.5]), hp([1.2, 12.5, 11.9])], 0.9 * hs, PAL.frame.base);
    for (const L of lenses) {
      // armação (contorno de tinta, depois o metal claro) e a lente em degradê
      ctx.lineJoin = 'round';
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = Math.max(2.2, 1.75 * hs * z);
      ctx.stroke(L.path);
      ctx.strokeStyle = PAL.frame.base;
      ctx.lineWidth = Math.max(1, 0.85 * hs * z);
      ctx.stroke(L.path);
      const a = R.P(L.pts[1]), b = R.P(L.pts[5]);
      const g = ctx.createLinearGradient(a.x - (b.y - a.y) * 0.6, a.y, b.x + (b.y - a.y) * 0.6, b.y);
      g.addColorStop(0, PAL.lens[0]);
      g.addColorStop(0.45, PAL.lens[1]);
      g.addColorStop(1, PAL.lens[2]);
      ctx.fillStyle = g;
      ctx.fill(L.path);
      // reflexo
      ctx.save();
      ctx.clip(L.path);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#fff6c8';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.8, 0.7 * hs * z);
      const s0 = R.P(add(L.c, add(scale(up, 1.2 * hs), scale(rig.head.r, -1.6 * hs)))), s1 = R.P(add(L.c, add(scale(up, -0.2 * hs), scale(rig.head.r, -2.6 * hs))));
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // A guia do cordão acompanha a base do pescoço nos eixos do peito.
  const NECK_RING = { r: 8.9, y: -0.5, z: 13.5 };
  const SKIN_IN = [0, -1, 8.5]; // um ponto de dentro do alto do tronco: os raios de `onSkin` saem dele
  /** Leva o ponto `g` (eixos do peito) até um pouco acima da pele pelo raio que sai de `SKIN_IN`. */
  function onSkin(g) {
    const dx = g[0] - SKIN_IN[0], dy = g[1] - SKIN_IN[1], dz = g[2] - SKIN_IN[2];
    const L = Math.hypot(dx, dy, dz) || 1;
    const d = [dx / L, dy / L, dz / L];
    let best = -1;
    for (const s of MODEL.CHEST) {
      const ox = SKIN_IN[0] - s.p[0], oy = SKIN_IN[1] - s.p[1], oz = SKIN_IN[2] - s.p[2];
      const b = ox * d[0] + oy * d[1] + oz * d[2];
      const disc = b * b - (ox * ox + oy * oy + oz * oz - s.r * s.r);
      if (disc >= 0) best = Math.max(best, -b + Math.sqrt(disc));
    }
    return best < 0 ? g : SKIN_IN.map((origin, i) => origin + (best + 0.45) * d[i]);
  }

  // Pontos próximos deixam a volta contínua quando um trecho passa pela borda do pescoço. A normal da guia gira
  // suavemente pelo trapézio, inclusive onde o raio troca de esfera de apoio no tronco.
  const NECK_TRACE = Array.from({ length: 17 }, (_, i) => {
    const a = i * 8 * M.DEG;
    const sin = Math.sin(a), cos = Math.cos(a);
    const p = onSkin([NECK_RING.r * sin, NECK_RING.y - NECK_RING.r * cos, NECK_RING.z]);
    // Junto à clavícula, a pele do tronco pode ficar por dentro da base do pescoço. Deixa o elo pelo lado de fora.
    const r = Math.max(Math.hypot(p[0], p[1] - NECK_RING.y), MODEL.NECK.r0 + 0.6);
    return { p: [r * sin, NECK_RING.y - r * cos, p[2]], n: [sin, -cos, 0.9] };
  });
  const CHAIN_DOWN = [[5.2, 9.6, 9.8], [3, 12.9, 5.6], [1.1, 14.6, 1.6]];

  /** Cordão de elos prateados em volta do pescoço, descendo em V até o meio do peito, com a coroa pendurada. */
  function chain(R, rig, look, neck) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const z = R.zoom;
    const ch = rig.chest;
    const sw = look.pendantSwing || { x: 0, y: 0, z: 0 };
    const pend = add(at(ch, 0, 15.1, 0.2), scale(sw, 1.6));
    // A volta passa atrás das mesmas esferas que desenham o pescoço, na inclinação da câmera e na pose atuais.
    const behindNeck = (q) => {
      const p = R.P(q);
      const depth = dot(q, R.toCam);
      return neck.some((c) => {
        const inside = c.r ** 2 - (p.x - c.x) ** 2 - (p.y - c.y) ** 2;
        return inside > 0 && c.d + Math.sqrt(inside) / z > depth + 0.45;
      });
    };
    // A nuca fica firme, e a coroa leva todo o balanço. A volta encontra a descida antes de chegar a ela.
    const swing = (part) => scale(sw, 1.2 * part);
    const sideRun = (sx) => {
      const out = NECK_TRACE.map(({ p, n }, k) => {
        const q = add(at(ch, sx * p[0], p[1], p[2]), swing((5 / 8) * k / (NECK_TRACE.length - 1)));
        const normal = norm(dirIn(ch, sx * n[0], n[1], n[2]));
        return { q, vis: R.facing(normal) > -0.06 && !behindNeck(q) };
      });
      CHAIN_DOWN.forEach((p, k) => {
        const n = norm(dirIn(ch, sx * p[0], p[1], 0.35));
        const q = add(at(ch, sx * p[0], p[1], p[2]), swing((6 + k) / 8));
        out.push({ q, vis: R.facing(n) > -0.06 });
      });
      out.push({ q: pend, vis: R.facing(norm(dirIn(ch, 0, 1, 0.2))) > -0.06 });
      return out;
    };
    const w = 0.82;
    const paintRun = (run) => {
      if (run.length < 2) return;
      cord(R, run, w, PAL.metal.base);
      if (!R.fine) return;
      // Os elos atravessam a corrente e só aparecem de perto.
      const pts = run.map((q) => R.P(q));
      ctx.strokeStyle = PAL.metal.shade;
      ctx.lineWidth = Math.max(0.5, 0.3 * z);
      ctx.beginPath();
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k], b = pts[k + 1];
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        const n = Math.max(1, Math.round(L / (1.5 * z)));
        const nx = -(b.y - a.y) / (L || 1), ny = (b.x - a.x) / (L || 1);
        for (let j = 0; j < n; j++) {
          const t = (j + 0.5) / n;
          const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          ctx.moveTo(x - nx * w * z * 0.45, y - ny * w * z * 0.45);
          ctx.lineTo(x + nx * w * z * 0.45, y + ny * w * z * 0.45);
        }
      }
      ctx.stroke();
    };
    // A corrente é uma linha entre as duas pontas no pingente, com uma única passagem pela nuca.
    const trace = sideRun(-1).reverse().concat(sideRun(1).slice(1));
    let run = [];
    for (const p of trace) {
      if (p.vis) run.push(p.q);
      else if (run.length) {
        paintRun(run);
        run = [];
      }
    }
    paintRun(run);
    // a coroa (o pingente), deitada no peito
    const n = norm(dirIn(ch, 0, 1, 0.12));
    const f = R.facing(n);
    if (f < 0.05) return;
    const right = ch.r;
    const up = norm(cross(n, right));
    const c = add(pend, scale(up, -2.3));
    const pts = CROWN.map(([u, v]) => add(add(c, scale(right, u * 2.7)), scale(up, v * 2.35)));
    const path = flatPath(R, pts);
    ctx.globalAlpha = smoothstep(0.05, 0.3, f);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = Math.max(1.8, R.inkIn * 2.2);
    ctx.stroke(path);
    ctx.fillStyle = PAL.metal.base;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = PAL.metal.light;
    ctx.translate(R.light.x * 0.9 * z, R.light.y * 0.9 * z);
    ctx.globalAlpha *= 0.8;
    ctx.fill(path);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ utilidades dos membros
  /** Anel de esferinhas em volta de um osso (em t, com raio `rad`): o casco de dois anéis é um tubo de boca reta. */
  const ringOn = (R, lf, t, rad, n, r, off = 0) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const th = (k / n) * M.TAU;
      out.push(R.circle(limbAt(lf, t, Math.cos(th) * rad, Math.sin(th) * rad + off), r));
    }
    return out;
  };
  /** O ângulo em volta do osso que olha para a câmera (o meio da metade visível). */
  const facingAngle = (R, lf) => Math.atan2(dot(R.toCam, lf.out), dot(R.toCam, lf.f));
  /** Ponto na superfície de um tubo em volta do osso: fração t, ângulo th (0 = frente, π/2 = fora), raio. */
  const tubeAt = (lf, t, th, rad, off = 0) => limbAt(lf, t, Math.cos(th) * rad, Math.sin(th) * rad + off);
  /** Linha em volta do osso (de th0 a th1), só na metade que a câmera vê; devolve os trechos de pontos na tela. */
  function arcRuns(R, lf, t, rad, th0, th1, off = 0, steps = 18, pointAt = null) {
    const tc = facingAngle(R, lf);
    const runs = [];
    let cur = null;
    for (let k = 0; k <= steps; k++) {
      const th = th0 + ((th1 - th0) * k) / steps;
      if (Math.cos(th - tc) < 0.03) {
        cur = null;
        continue;
      }
      if (!cur) runs.push((cur = []));
      // (`pointAt(th)`: um tubo que não é redondo — a perna da bermuda — dá o ponto dele)
      cur.push(R.P(pointAt ? pointAt(th) : tubeAt(lf, typeof t === 'function' ? t(th) : t, th, rad, off)));
    }
    return runs.filter((r) => r.length > 1);
  }
  const strokeRuns = (R, runs, color, width, alpha = 1) => {
    const ctx = R.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, width * R.zoom);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;
    for (const run of runs) ctx.stroke(S.smoothLinePath(run));
    ctx.globalAlpha = 1;
  };
  /** Faixa em volta do osso entre t0 e t1 (a metade visível), preenchida: a pulseira do relógio. */
  function bandOn(R, lf, t0, t1, rad, color) {
    const tc = facingAngle(R, lf);
    const a = [], b = [];
    for (let k = 0; k <= 14; k++) {
      const th = tc - Math.PI / 2 + (Math.PI * k) / 14;
      a.push(R.P(tubeAt(lf, t0, th, rad)));
      b.push(R.P(tubeAt(lf, t1, th, rad)));
    }
    const path = new Path2D();
    path.moveTo(a[0].x, a[0].y);
    for (const q of a) path.lineTo(q.x, q.y);
    for (let k = b.length - 1; k >= 0; k--) path.lineTo(b[k].x, b[k].y);
    path.closePath();
    R.ctx.fillStyle = color;
    R.ctx.fill(path);
    return path;
  }
  /**
   * O raio da pele de um membro num ponto: `s` cm ao longo do osso, ângulo `th` em volta dele. O membro desenhado é o
   * CASCO das esferas, então o raio é a borda de cima do casco das esferas vistas de perfil naquela direção (e não a
   * esfera mais de fora: entre duas esferas — do bíceps ao cotovelo, por exemplo — a pele é a reta que liga uma na
   * outra). Uma tabela por direção, calculada uma vez: a pele não muda com a pose.
   */
  const SKIN_STEP = 0.2, SKIN_PAD = 10, SKIN_BINS = 180;
  const skinCache = new WeakMap();
  function skinProfile(spheres, len, bin) {
    let byBin = skinCache.get(spheres);
    if (!byBin) skinCache.set(spheres, (byBin = new Map()));
    let tab = byBin.get(bin);
    if (tab) return tab;
    const th = (bin / SKIN_BINS) * M.TAU;
    const cs = Math.cos(th), sn = Math.sin(th);
    const n = Math.round((len + 2 * SKIN_PAD) / SKIN_STEP) + 1;
    const top = new Float64Array(n).fill(-Infinity);
    for (const sp of spheres) {
      const sc = sp.t * len, cc = (sp.f || 0) * cs + (sp.o || 0) * sn;
      const i0 = Math.max(0, Math.ceil((sc - sp.r + SKIN_PAD) / SKIN_STEP)), i1 = Math.min(n - 1, Math.floor((sc + sp.r + SKIN_PAD) / SKIN_STEP));
      for (let i = i0; i <= i1; i++) {
        const d = i * SKIN_STEP - SKIN_PAD - sc;
        const y = cc + Math.sqrt(Math.max(0, sp.r * sp.r - d * d));
        if (y > top[i]) top[i] = y;
      }
    }
    // a borda de cima do casco (os pontos que ficam por baixo de uma reta entre dois vizinhos saem)
    const hull = [];
    for (let i = 0; i < n; i++) {
      if (top[i] === -Infinity) continue;
      while (hull.length >= 2) {
        const a = hull[hull.length - 2], b = hull[hull.length - 1];
        if ((top[b] - top[a]) * (i - a) <= (top[i] - top[a]) * (b - a)) hull.pop();
        else break;
      }
      hull.push(i);
    }
    tab = new Float32Array(n).fill(-1);
    for (let k = 0; k + 1 < hull.length; k++) {
      const a = hull[k], b = hull[k + 1];
      for (let i = a; i <= b; i++) tab[i] = top[a] + ((top[b] - top[a]) * (i - a)) / (b - a);
    }
    byBin.set(bin, tab);
    return tab;
  }
  function skinAt(spheres, len, s, th) {
    const x = ((((th / M.TAU) % 1) + 1) % 1) * SKIN_BINS;
    const b0 = Math.floor(x) % SKIN_BINS, w = x - Math.floor(x);
    const read = (bin) => {
      const tab = skinProfile(spheres, len, bin);
      const p = Math.max(0, Math.min(tab.length - 1.001, (s + SKIN_PAD) / SKIN_STEP));
      const i = Math.floor(p), f = p - i;
      const a = tab[i], b = tab[i + 1];
      return a < 0 ? b : b < 0 ? a : a + (b - a) * f;
    };
    const r = read(b0) * (1 - w) + read((b0 + 1) % SKIN_BINS) * w;
    return r > 0.5 ? r : 0.5;
  }

  // ------------------------------------------------------------------ tatuagem (braço esquerdo, do ombro ao punho)
  // Como na ficha: uma manga tribal de ESPIRAIS de linha grossa (~1,2 cm), uma encostada na outra, com ganchos pontudos
  // nos vãos. O desenho é marcado na pele "desenrolada" do braço: cada ponto é [cm ao longo do osso, graus em volta
  // dele] (0° = frente do braço, 90° = lado de fora, 180° = trás, 270° = lado de dentro, encostado no tronco).
  const TATTOO_HW = 0.68; // meia largura da linha (cm): linha de ~1,4 cm, grossa como a da ficha
  const TATTOO_PITCH = 2; // de uma volta da espiral à outra (cm): a linha e o vão de pele entre as voltas
  /**
   * Espiral: do rabo pontudo (por fora) até o miolo, onde termina numa bolinha. `a0` = o ângulo em que o rabo começa.
   * O número de voltas sai do tamanho (o passo entre as voltas é sempre o mesmo: senão as pequenas viravam uma mancha).
   */
  function koru(spheres, len, s, deg, r0, _turns, dir, a0, hw = TATTOO_HW) {
    const R0 = skinAt(spheres, len, s, deg * M.DEG);
    const rIn = 0.95;
    const turns = Math.max(0.75, (r0 - rIn) / TATTOO_PITCH);
    const n = Math.round(34 * turns);
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const ang = a0 + dir * turns * M.TAU * u;
      const rad = r0 - (r0 - rIn) * u;
      pts.push([s + rad * Math.cos(ang), deg + (rad * Math.sin(ang)) / R0 / M.DEG]);
    }
    const width = (u) => hw * (u < 0.14 ? 0.1 + 0.9 * Math.sin(((u / 0.14) * Math.PI) / 2) : u > 0.93 ? 1 + 0.3 * ((u - 0.93) / 0.07) : 1);
    return { pts, c: [s, deg], r0, R0, hw: width, bulb: hw * 1.42 };
  }
  /** Gancho: um risco curvo, grosso de um lado e pontudo do outro (uma "vírgula"), no vão entre as espirais. */
  function hook(spheres, len, s, deg, L, rot, bend, hw = TATTOO_HW * 0.86) {
    const R0 = skinAt(spheres, len, s, deg * M.DEG);
    const c = Math.cos(rot), sn = Math.sin(rot);
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const u = k / 12 - 0.5;
      const x = u * L, y = bend * L * (0.25 - u * u) * 1.7;
      pts.push([s + x * c - y * sn, deg + (x * sn + y * c) / R0 / M.DEG]);
    }
    return { pts, hw: (u) => hw * Math.pow(Math.sin(Math.PI * Math.min(1, 0.03 + u * 0.97)), 0.62) * (1.2 - 0.55 * u) };
  }
  /** A manga de um osso: as espirais dadas e os ganchos nos vãos (numa grade na pele desenrolada, longe das espirais). */
  function sleeve(spheres, len, korus, s0, s1) {
    const spirals = korus.map((k) => koru(spheres, len, ...k));
    const list = spirals.slice();
    // a espiral mais perto de um ponto (distância na pele, em cm) e a folga até a borda dela
    const nearest = (s, deg) => {
      let near = null, gap = 1e9, dd0 = 0;
      for (const k of spirals) {
        const dd = ((deg - k.c[1] + 540) % 360) - 180;
        const g = Math.hypot(s - k.c[0], dd * M.DEG * k.R0) - k.r0;
        if (g < gap) {
          gap = g;
          near = k;
          dd0 = dd;
        }
      }
      return { near, gap, dd: dd0 };
    };
    const grid = (step, arc, visit) => {
      for (let row = 0, s = s0 + 1.5; s < s1 - 0.9; s += step, row++) {
        const Rm = (skinAt(spheres, len, s, 0) + skinAt(spheres, len, s, Math.PI / 2) + skinAt(spheres, len, s, Math.PI) + skinAt(spheres, len, s, -Math.PI / 2)) / 4;
        const n = Math.max(3, Math.round((M.TAU * Rm) / arc));
        for (let j = 0; j < n; j++) visit(s, (j + (row % 2 ? 0.5 : 0)) * (360 / n), row, j);
      }
    };
    // 1) nos vãos grandes cabe uma espiral pequena (e ela passa a contar para os vãos seguintes)
    grid(2.6, 2.6, (s, deg, row, j) => {
      const { gap } = nearest(s, deg);
      const r = Math.min(2.8, gap - 0.35, s - s0 - 0.3, s1 - s - 0.3);
      if (r < 1.85) return;
      const small = koru(spheres, len, s, deg, r, 0.55 + r * 0.32, (j + row) % 2 ? 1 : -1, row * 1.7 + j * 2.3);
      spirals.push(small);
      list.push(small);
    });
    // 2) nos vãos que sobram, os ganchos: deitados em volta da espiral mais perto (acompanham o giro dela)
    grid(3.1, 3.2, (s, deg, row, j) => {
      const { near, gap, dd } = nearest(s, deg);
      if (gap < 0.95) return; // em cima de uma espiral (ou colado nela)
      const rot = Math.atan2(dd * M.DEG * near.R0, s - near.c[0]) + Math.PI / 2;
      const L = Math.min(3.1, 1.5 + gap * 1.05, (s1 - s) * 1.6, (s - s0) * 1.6);
      if (L < 1.5) return;
      list.push(hook(spheres, len, s, deg, L, rot + ((j + row) % 2 ? Math.PI : 0), (j + row) % 2 ? 0.55 : -0.55));
    });
    return list;
  }
  // [cm ao longo, graus em volta, raio de fora, voltas, sentido, ângulo do rabo]
  const TATTOO = {
    braco: sleeve(MODEL.UPPER_ARM, PD.BODY.upperArm, [
      [6.4, 96, 5.5, 2.05, 1, 2.5], // a grande, na capa do ombro
      [15.6, 14, 4.9, 2, -1, 0.4], // bíceps
      [18.8, 102, 4.6, 1.95, 1, -0.6], // lado de fora, embaixo
      [13.2, 186, 5, 2, -1, 2.9], // tríceps
      [5.2, 8, 3.5, 1.6, 1, 1.2], // frente do ombro
      [4.8, 180, 3.4, 1.6, -1, -1.4], // trás do ombro
      [25.2, 42, 3.2, 1.55, -1, 2.2], // perto do cotovelo, na frente
      [24.6, 162, 3.3, 1.55, 1, 0.8], // perto do cotovelo, atrás
      [12, 276, 4.1, 1.8, 1, 0.2], // lado de dentro
      [22.4, 266, 3.3, 1.5, -1, 1.6],
    ], -0.6, 29.6),
    antebraco: sleeve(MODEL.FOREARM, PD.BODY.forearm, [
      [5.9, 86, 4.2, 1.9, 1, 2.2], // a grande, no músculo de fora
      [11.4, 6, 3.4, 1.7, -1, 0.5],
      [9.8, 182, 3.6, 1.7, 1, -2.4],
      [15.2, 100, 2.9, 1.6, -1, 1.4],
      [8, 276, 3.3, 1.6, -1, 2.6],
      [18.4, 28, 2.3, 1.4, 1, -0.8],
      [18, 192, 2.4, 1.4, -1, 0.9],
      [17.4, 280, 2.2, 1.4, 1, 2],
    ], 0.4, 21.4), // (para antes do relógio)
  };

  /** As bordas de um risco na pele (fração do osso, ângulo, raio), calculadas uma vez: a pele não muda com a pose. */
  function tattooEdges(spheres, len, bl) {
    if (bl.edges) return bl.edges;
    const mid = bl.pts;
    const N = mid.length - 1;
    const lift = 0.06;
    const out = [];
    for (let i = 0; i <= N; i++) {
      const [s, deg] = mid[i];
      const th = deg * M.DEG;
      const rad = skinAt(spheres, len, s, th) + lift;
      const a = mid[Math.max(0, i - 1)], b = mid[Math.min(N, i + 1)];
      // direção da linha na pele desenrolada (cm ao longo, cm em volta)
      let ds = b[0] - a[0], dv = (b[1] - a[1]) * M.DEG * rad;
      const l = Math.hypot(ds, dv) || 1;
      ds /= l;
      dv /= l;
      const hw = bl.hw(i / N);
      const side = (k) => {
        const s2 = s - dv * hw * k, th2 = th + (ds * hw * k) / rad;
        return [s2 / len, th2, skinAt(spheres, len, s2, th2) + lift];
      };
      out.push({ l: side(1), r: side(-1), th });
    }
    if (bl.bulb) {
      // a bolinha do miolo da espiral
      const [s, deg] = mid[N];
      const th = deg * M.DEG;
      const rad = skinAt(spheres, len, s, th) + lift;
      const ring = [];
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * M.TAU;
        const s2 = s + Math.cos(a) * bl.bulb, th2 = th + (Math.sin(a) * bl.bulb) / rad;
        ring.push([s2 / len, th2, skinAt(spheres, len, s2, th2) + lift]);
      }
      out.bulb = { ring, th };
    }
    return (bl.edges = out);
  }
  function tattoo(R, lf, spheres, blades) {
    const ctx = R.ctx;
    const len = lf.len;
    const tc = facingAngle(R, lf);
    const path = new Path2D();
    const P = (q) => R.P(tubeAt(lf, q[0], q[1], q[2]));
    // (todos os pedaços entram no mesmo sentido: um por cima do outro não abre buraco na tinta)
    const addPoly = (pts) => {
      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        area += a.x * b.y - b.x * a.y;
      }
      if (area < 0) pts.reverse();
      path.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
      path.closePath();
    };
    for (const bl of blades) {
      const E = tattooEdges(spheres, len, bl);
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          const pts = run.map((e) => P(e.l));
          for (let i = run.length - 1; i >= 0; i--) pts.push(P(run[i].r));
          addPoly(pts);
        }
        run = [];
      };
      for (const e of E) {
        if (Math.cos(e.th - tc) < 0.04) flush(); // do lado de lá do braço
        else run.push(e);
      }
      flush();
      if (E.bulb && Math.cos(E.bulb.th - tc) >= 0.04) addPoly(E.bulb.ring.map(P));
    }
    ctx.fillStyle = R.pal.tattoo;
    ctx.fill(path);
  }
  function limbDetail(R, rig, i, part) {
    if (i !== 0) return; // só o braço esquerdo
    if (part === 'deltoide' || part === 'braco') tattoo(R, rig.upperArm[0], MODEL.UPPER_ARM, TATTOO.braco);
    else if (part === 'antebraco') tattoo(R, rig.forearm[0], MODEL.FOREARM, TATTOO.antebraco);
  }

  // ------------------------------------------------------------------ bermuda cargo e relógio (presos ao corpo)
  // O gancho fecha mais alto junto ao quadril. O volume abaixo dele segue cada coxa, inclusive na passada aberta.
  // A perna ainda abre até o joelho, com pouco recuo atrás e um corte oval (`kf` frente-trás, `ko` de lado).
  const SHORTS = {
    waist: { z: 10.2, rx: 12.6, ry: 10.9, cy: 0.9 },
    mid: { z: 3.5, rx: 14.6, ry: 13, cy: 0.2 },
    hip: { z: -3, rx: 15.2, ry: 13.4, cy: -0.4 },
    low: { z: -15.5, rx: 9.5, ry: 11.8, cy: -0.6 },
    // a barra fica ~7 cm abaixo do joelho (0,18 da canela)
    leg: { top: -0.16, topR: 8.7, off: -0.5, kneeR: 10.1, kneeOff: -1.2, hem: 0.18, hemR: 9.1, hemOff: -1, kf: 1.16, ko: 0.95, backTop: 0, backKnee: -2.6, backHem: -2.3, bendShrink: 0.2 },
    pocket: { c: 1.28, w: 0.56, t0: 0.6, t1: 1.02, out: 1.5 }, // bolso cargo: no lado de fora da coxa, um pouco para a frente
  };
  const SHORTS_THIGH = MODEL.THIGH.filter((p) => p.t <= 0.4);
  /** O raio e o deslocamento para fora da perna da bermuda em t (na coxa: do alto ao joelho; na canela: do joelho à barra). */
  const legShape = (shin, t) => {
    const L = SHORTS.leg;
    if (shin) {
      const u = clamp01(t / L.hem);
      return { rad: L.kneeR + (L.hemR - L.kneeR) * u, off: L.kneeOff + (L.hemOff - L.kneeOff) * u, back: L.backKnee + (L.backHem - L.backKnee) * u };
    }
    const u = clamp01((t - L.top) / (1 - L.top));
    return { rad: L.topR + (L.kneeR - L.topR) * u, off: L.off + (L.kneeOff - L.off) * u, back: L.backTop + (L.backKnee - L.backTop) * u * u };
  };
  /** O quanto o joelho dobra (0 = esticado, 1 = dobrado): com ele dobrado a perna da bermuda volta a ser redonda — funda
   *  atrás, ela ficava pendurada atrás do joelho como uma aba (correndo, a perna de trás). */
  const legBend = (rig, i) => clamp01((0.94 - dot(rig.thigh[i].a, rig.shin[i].a)) / 0.45);
  /** Ponto na perna (oval) da bermuda: osso, se é a canela, fração t, ângulo th (0 = frente, π/2 = fora); `grow` afasta do
   *  pano; `bend` = legBend (o oval e o recuo para trás somem com o joelho dobrado). */
  // (19/11, o dono: "o shorts quando anda parece bugado". Na corrida a coxa sobe e a perna da bermuda, larga no joelho,
  // fica de ponta para a câmera: o anel do joelho virava uma BOLA do tamanho da cintura. Com o joelho dobrado o pano cai:
  // o joelho e a barra encolhem até `bendShrink`; o alto, preso no quadril, não muda)
  const legAt = (rig, i, shin, t, th, grow = 0, bend = 0) => {
    const L = SHORTS.leg;
    const lf = shin ? rig.shin[i] : rig.thigh[i];
    const g = legShape(shin, t);
    const r = g.rad * (1 - L.bendShrink * bend * (shin ? 1 : clamp01((t - L.top) / (1 - L.top)))) + grow;
    const kf = 1 + (L.kf - 1) * (1 - bend);
    const front = Math.cos(th) * r * kf + g.back * (1 - bend);
    const side = Math.sin(th) * r * L.ko + g.off;
    const point = limbAt(lf, t, front, side);
    if (shin || t >= 0.34) return point;
    // O começo da perna é costurado no quadril. Se girasse inteiro com a coxa, a borda de cima empurrava o pano para trás.
    const hip = add(rig.hip[i], dirIn(rig.pelvis, (i === 0 ? -1 : 1) * side, front, -t * lf.len));
    return M.lerp3(hip, point, smoothstep(L.top, 0.34, t));
  };
  /** Anel de esferinhas em volta da perna da bermuda (o casco de dois anéis é um pedaço da perna). */
  const legRing = (R, rig, i, shin, t, bend) => {
    const n = 10;
    const out = [];
    for (let k = 0; k < n; k++) out.push(R.circle(legAt(rig, i, shin, t, (k / n) * M.TAU, 0, bend), 0.9));
    return out;
  };
  const pelvisRing = (pv, g, phi, grow = 0, dz = 0) => at(pv, (g.rx + grow) * Math.sin(phi), g.cy + (g.ry + grow) * Math.cos(phi), g.z + dz);
  /** A parte de baixo do assento entra sob o quadril conforme as coxas se afastam na passada. */
  function shortsSeatPoint(rig, ring, phi, grow = 0) {
    const pv = rig.pelvis;
    const point = pelvisRing(pv, ring, phi, grow);
    const rear = Math.max(0, -Math.cos(phi));
    const depth = clamp01((SHORTS.hip.z - ring.z) / (SHORTS.hip.z - SHORTS.low.z));
    const k = rear * depth;
    if (!k) return point;
    const spread = clamp01(Math.abs(dot(rig.thigh[0].a, pv.f) - dot(rig.thigh[1].a, pv.f)));
    return add(point, dirIn(pv, 0, (3.5 + 2.4 * spread) * k, (4.2 + 2.8 * spread) * k));
  }
  /** O anel da bermuda numa altura z da pelve (entre a cintura, o quadril e o fundo). */
  const shortsRingAt = (zz) => {
    const G = SHORTS;
    const [a, b] = zz >= G.mid.z ? [G.mid, G.waist] : zz >= G.hip.z ? [G.hip, G.mid] : [G.low, G.hip];
    const t = clamp01((zz - a.z) / (b.z - a.z));
    return { z: zz, rx: a.rx + (b.rx - a.rx) * t, ry: a.ry + (b.ry - a.ry) * t, cy: a.cy + (b.cy - a.cy) * t };
  };
  const shortsNormal = (pv, phi, zz) => {
    const g = shortsRingAt(zz);
    return norm(dirIn(pv, Math.sin(phi) / g.rx, Math.cos(phi) / g.ry, 0));
  };
  /** Ponto na bermuda (na pelve): direção phi (0 = frente, π = trás) e altura z; `grow` afasta do pano. */
  const shortsAt = (pv, phi, zz, grow = 0.6) => pelvisRing(pv, shortsRingAt(zz), phi, grow);
  /** Linha na bermuda por pontos [phi, z]: só o trecho que a câmera vê. */
  function shortsLine(R, pv, pts, grow = 0.6) {
    const runs = [];
    let cur = null;
    for (const [phi, zz] of pts) {
      if (R.facing(shortsNormal(pv, phi, zz)) < 0.03) {
        cur = null;
        continue;
      }
      if (!cur) runs.push((cur = []));
      cur.push(R.P(shortsAt(pv, phi, zz, grow)));
    }
    return runs.filter((r) => r.length > 1);
  }
  const around = (zz, phi0 = 0, phi1 = M.TAU, n = 36) => {
    const pts = [];
    for (let k = 0; k <= n; k++) pts.push([phi0 + ((phi1 - phi0) * k) / n, zz]);
    return pts;
  };

  function wear(R, rig, look, items, gear) {
    const out = [];
    const PAL = R.pal;
    const hostOf = (name, group) => items.find((b) => b.name === name && b.group === group) || items.find((b) => b.group === group);
    const keyAfter = (host, k) => (host ? host.key : R.keyOf(rig.pelvis.o)) + 0.05 + 0.01 * k;
    const off = look.semPecas || {};

    if (!gear.pernas && !off.bermuda) {
      const G = SHORTS;
      const pv = rig.pelvis;
      // ---- as duas pernas da bermuda (cada uma depois da perna dela)
      for (let i = 0; i < 2; i++) {
        const th = rig.thigh[i], sh = rig.shin[i];
        const L = G.leg;
        const bend = legBend(rig, i);
        const top = legRing(R, rig, i, false, L.top, bend);
        // O pano acompanha a pele entre a costura do quadril e a perna, inclusive quando ela se dobra.
        const upperThigh = SHORTS_THIGH.map((p) => R.circle(limbAt(th, p.t, p.f, p.o), p.r + 0.65));
        const knee = legRing(R, rig, i, false, 1, bend);
        const hem = legRing(R, rig, i, true, L.hem, bend);
        const host = hostOf('coxa', 'perna' + i);
        // o bolso cargo: uma caixa de pano por fora da coxa. Era uma peça à parte, desenhada só do lado que a câmera via —
        // com a perna girando ela aparecia e sumia de uma vez (o "pulo" do bolso). Agora os cantos dela entram no casco da
        // perna (o volume dela está sempre no contorno) e a aba e as costuras são pintadas na perna, sumindo aos poucos
        // quando o lado dela vira para longe (`cargoPocket`)
        const P = SHORTS.pocket;
        const corner = (t, a) => R.circle(legAt(rig, i, false, t, a, P.out, bend), 1.25);
        const pocket = [corner(P.t0, P.c - P.w), corner(P.t0, P.c), corner(P.t0, P.c + P.w), corner(P.t1, P.c + P.w), corner(P.t1, P.c), corner(P.t1, P.c - P.w)];
        let segs;
        if (dot(th.a, sh.a) > 0.94) {
          segs = [{ poly: R.hull(top.concat(upperThigh, knee, hem, pocket)), circles: R._last, mat: PAL.denim, k: 0.26, decal: () => { shortsLeg(R, rig, i, 'coxa'); cargoPocket(R, rig, i); shortsLeg(R, rig, i, 'barra'); } }];
        } else {
          const upper = { poly: R.hull(top.concat(upperThigh, knee, pocket)), circles: R._last, mat: PAL.denim, k: 0.26, decal: () => { shortsLeg(R, rig, i, 'coxa'); cargoPocket(R, rig, i); } };
          const lower = { poly: R.hull(knee.concat(hem)), circles: R._last, mat: PAL.denim, k: 0.26, noInner: true, decal: () => shortsLeg(R, rig, i, 'barra') };
          segs = [upper, lower];
        }
        out.push({ name: 'bermudaPerna', key: keyAfter(host, i), host, group: 'bermudaPerna' + i, chain: true, segs });
      }
      // ---- a parte da pelve (por cima das pernas da bermuda e da barriga de baixo)
      // (20/11, o dono: "o tronco parece que fica invisível, aparece a calça". A peça é um casco convexo dos anéis, e o
      // casco enche a BOCA da bermuda: correndo, com o tronco inclinado, a câmera vê o anel da cintura de cima e o pano
      // tampava as costas inteiras até o outro lado do cós. A metade do anel que fica atrás do tronco não entra mais no
      // casco: em cima fica a beirada do cós virada para a câmera, e o tronco aparece acima dela. `near`: só os pontos
      // do anel virados para a câmera (os do lado, de perfil, ainda entram)
      const ring = (g, n, near = false) => {
        const cs = [];
        for (let k = 0; k < n; k++) {
          const phi = (k / n) * M.TAU;
          if (near && R.facing(shortsNormal(pv, phi, g.z)) < -0.12) continue;
          cs.push(R.circle(shortsSeatPoint(rig, g, phi), 1));
        }
        return cs;
      };
      // (21/11, o dono: "o bug do tronco que era a boca da bermuda" — mirando andando para trás, no pulo e na esquiva. Na
      // ordem de desenho o pescoço quase sempre fica entre a pelve e o peito, e a bermuda presa na pelve saía ANTES do
      // peito: a parte de baixo do peito, que continua por dentro da bermuda, aparecia por cima do cós quando o tronco
      // torcia ou dobrava. Ela vai depois da última parte do tronco, seja qual for)
      const torso = items.filter((b) => b.group === 'tronco');
      const host = torso.length ? torso[torso.length - 1] : hostOf('pelve', 'tronco');
      // e a BOCA da bermuda não é pano: com a câmera vendo o anel do cós por cima, nada dela é pintado dentro dele (ali
      // aparece o tronco). Sem isto, por cima do tronco, o casco tampava a barriga até a linha dos lados do cós
      let mouth = null;
      if (dot(pv.u, R.toCam) > 0.02) {
        mouth = [];
        for (let k = 0; k < 36; k++) {
          const q = R.P(pelvisRing(pv, G.waist, (k / 36) * M.TAU));
          mouth.push(q.x, q.y);
        }
      }
      out.push({ name: 'bermuda', key: keyAfter(host, 3), host, group: 'bermuda', hideInside: mouth, segs: [{ poly: R.hull(ring(G.waist, 16, true).concat(ring(G.mid, 16, true), ring(G.hip, 12, true), ring(G.low, 10))), circles: R._last, mat: PAL.denim, k: 0, noThin: true, decal: () => shortsTop(R, rig) }] });
    }

    // ---- relógio no punho esquerdo: a pulseira (um anel em volta do punho) e a caixa, do lado das costas da mão
    if (!off.relogio) {
      const fa = rig.forearm[0], hd = rig.hand[0];
      const rad = skinAt(MODEL.FOREARM, fa.len, fa.len * 0.9, Math.PI / 2);
      // (com o punho sem emenda a mão fica por cima do antebraço: aí o relógio entra depois da mão, senão a base dela
      // tapava a caixa do relógio)
      const handHost = hostOf('mao', 'mao0');
      const host = handHost && handHost.over ? handHost : hostOf('antebraco', 'braco0');
      const band = ringOn(R, fa, 0.84, rad + 0.1, 8, 0.55).concat(ringOn(R, fa, 0.955, rad - 0.15, 8, 0.55));
      const segs = [{ poly: R.hull(band), circles: R._last, mat: PAL.watch, k: 0.22 }];
      if (R.facing(hd.d) > -0.15) {
        const c = add(limbAt(fa, 0.9, 0, 0), scale(hd.d, rad + 0.6));
        const side = norm(cross(fa.a, hd.d));
        const corner = (u, v) => R.circle(add(add(c, scale(fa.a, u * 1.75)), scale(side, v * 1.75)), 0.9);
        segs.push({
          poly: R.hull([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]), circles: R._last, mat: PAL.watch, k: 0.3, noInner: true,
          decal: () => {
            // o mostrador
            const o = add(c, scale(hd.d, 0.9));
            const q = R.P(o), u = R.P(add(o, scale(fa.a, 1.6))), v = R.P(add(o, scale(side, 1.6)));
            const ctx = R.ctx;
            ctx.fillStyle = PAL.watch.light;
            ctx.beginPath();
            ctx.ellipse(q.x, q.y, Math.max(0.6, Math.hypot(u.x - q.x, u.y - q.y)), Math.max(0.5, Math.hypot(v.x - q.x, v.y - q.y)), Math.atan2(u.y - q.y, u.x - q.x), 0, M.TAU);
            ctx.fill();
            ctx.strokeStyle = PAL.metal.base;
            ctx.lineCap = 'round';
            ctx.lineWidth = Math.max(0.5, 0.2 * R.zoom);
            ctx.beginPath();
            ctx.moveTo(q.x, q.y);
            ctx.lineTo((q.x + u.x) / 2, (q.y + u.y) / 2);
            ctx.moveTo(q.x, q.y);
            ctx.lineTo(q.x + (v.x - q.x) * 0.7, q.y + (v.y - q.y) * 0.7);
            ctx.stroke();
          },
        });
      }
      out.push({ name: 'relogio', key: keyAfter(host, 5), host, group: 'relogio', chain: true, segs });
    }

    // ---- as tiras dos chinelos, por cima de cada pé
    // (19/11, o dono: "essa linha preta no calcanhar tem que tirar, ele tá de chinelo". A tira em Y fica no peito do pé
    // e era desenhada por cima dele de qualquer lado: de costas ela aparecia em cima do calcanhar, como uma tira de
    // sandália. Com o pé de costas para a câmera ela entra logo depois da sola, ANTES do pé: o calcanhar e o tornozelo
    // tampam, como no chinelo de verdade)
    if (!gear.pes && !off.chinelos) {
      for (let i = 0; i < 2; i++) {
        const behind = dot(rig.foot[i].f, R.toCam) < -0.3;
        const host = (behind && hostOf('sola', 'sola' + i)) || hostOf('pe', 'perna' + i);
        out.push({ name: 'tiraChinelo', key: keyAfter(host, 8 + i), host, draw: () => sandalStraps(R, rig, i) });
        // (22/11, o dono: "o chinelo some" correndo. Na diagonal de costas a câmera vê a beirada do pé, e a perna da tira
        // daquele lado desce por ela até a sola: essa parte vai por cima do pé. De costas mesmo, nenhum lado aparece e
        // nada muda — o calcanhar continua sem a linha preta)
        if (behind) {
          const foot = hostOf('pe', 'perna' + i);
          if (foot) out.push({ name: 'tiraChinelo', key: keyAfter(foot, 10 + i), host: foot, draw: () => sandalStraps(R, rig, i, true) });
        }
      }
    }
    return out;
  }

  /** Detalhes de uma perna da bermuda: costura laranja do lado, barra pespontada e a coroa estampada (perna direita). */
  function shortsLeg(R, rig, i, part) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const th = rig.thigh[i], sh = rig.shin[i];
    const L = SHORTS.leg;
    const z = R.zoom;
    const seam = Math.PI / 2 - 0.62; // a costura do lado, puxada para a frente
    const bend = legBend(rig, i);
    if (part === 'coxa') {
      const tc = facingAngle(R, th);
      if (Math.cos(seam - tc) > 0.05) {
        const pts = [];
        for (let k = 0; k <= 8; k++) pts.push(R.P(legAt(rig, i, false, L.top + (1 - L.top) * (k / 8), seam, 0.15, bend)));
        strokeRuns(R, [pts], PAL.stitch, 0.24, 0.9);
      }
      // a coroa estampada na perna direita, na frente, na parte de baixo da coxa
      if (i === 1) {
        const c = 0.08, tcen = 0.78, w = 0.5, h = 0.15; // meia largura em radianos em volta e meia altura em fração da coxa
        if (Math.cos(c - tc) > 0.12) {
          const path = new Path2D();
          CROWN.forEach(([u, v], k) => {
            const q = R.P(legAt(rig, i, false, tcen - v * h, c + u * w, 0.25, bend));
            if (k) path.lineTo(q.x, q.y);
            else path.moveTo(q.x, q.y);
          });
          path.closePath();
          ctx.globalAlpha = smoothstep(0.12, 0.4, Math.cos(c - tc)) * 0.95;
          ctx.strokeStyle = PAL.print;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(1, 0.85 * z);
          ctx.stroke(path);
          ctx.globalAlpha = 1;
        }
      }
      return;
    }
    // a parte de baixo: a costura continua até a barra, e dois pespontos laranja em volta dela
    const tc = facingAngle(R, sh);
    if (Math.cos(seam - tc) > 0.05) strokeRuns(R, [[R.P(legAt(rig, i, true, 0, seam, 0.15, bend)), R.P(legAt(rig, i, true, L.hem, seam, 0.2, bend))]], PAL.stitch, 0.24, 0.9);
    for (const dt of [0.04, 0.075]) strokeRuns(R, arcRuns(R, sh, L.hem - dt, 0, 0, M.TAU, 0, 30, (a) => legAt(rig, i, true, L.hem - dt, a, 0.2, bend)), PAL.stitch, 0.22, 0.95);
  }

  /** O bolso cargo (em cima da caixa dele): a aba com a linha, o pesponto laranja e os dois rebites. */
  function cargoPocket(R, rig, i) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const th = rig.thigh[i];
    const P = SHORTS.pocket;
    const z = R.zoom;
    const bend = legBend(rig, i);
    const vis = smoothstep(-0.25, 0.2, Math.cos(P.c - facingAngle(R, th)));
    if (vis <= 0.01) return;
    const pt = (t, a) => R.P(legAt(rig, i, false, t, a, P.out + 1.3, bend));
    const row = (t, inset = 0, n = 6) => { const q = []; for (let k = 0; k <= n; k++) q.push(pt(t, P.c - P.w + inset + ((P.w - inset) * 2 * k) / n)); return q; };
    const flap = P.t0 + (P.t1 - P.t0) * 0.34;
    // a aba: mais clara, com a linha escura embaixo
    const top = row(P.t0 - 0.03), mid = row(flap);
    const fl = new Path2D();
    fl.moveTo(top[0].x, top[0].y);
    for (const q of top) fl.lineTo(q.x, q.y);
    for (let k = mid.length - 1; k >= 0; k--) fl.lineTo(mid[k].x, mid[k].y);
    fl.closePath();
    ctx.fillStyle = M.mix(PAL.denim.base, PAL.denim.light, 0.75);
    ctx.globalAlpha = vis;
    ctx.fill(fl);
    ctx.globalAlpha = 1;
    strokeRuns(R, [mid], PAL.denim.shade, 0.4, vis);
    // pesponto laranja: embaixo da aba e em volta do bolso
    strokeRuns(R, [row(flap - 0.035, 0.07)], PAL.stitch, 0.2, 0.95 * vis);
    strokeRuns(R, [[pt(flap + 0.03, P.c - P.w + 0.08), pt(P.t1 - 0.035, P.c - P.w + 0.08)].concat(row(P.t1 - 0.035, 0.08), [pt(flap + 0.03, P.c + P.w - 0.08)])], PAL.stitch, 0.2, 0.9 * vis);
    // rebites nos cantos da aba
    ctx.globalAlpha = vis;
    ctx.fillStyle = PAL.rivet;
    for (const a of [P.c - P.w + 0.13, P.c + P.w - 0.13]) {
      const q = pt(flap - 0.075, a);
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(0.8, 0.5 * z), 0, M.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Detalhes da bermuda na pelve: cós com passantes e botão, braguilha, bocas dos bolsos e os bolsos de trás. */
  function shortsTop(R, rig) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const pv = rig.pelvis;
    const W = SHORTS.waist.z;
    const z = R.zoom;
    // a linha de cima da bermuda (a peça não tem o contorno fino: ele riscaria a emenda com as pernas)
    strokeRuns(R, shortsLine(R, pv, around(W + 0.9), 0.95), PAL.ink, (R.inkIn * 1.7) / z, 1);
    // o cós: uma linha escura embaixo dele e o pesponto
    strokeRuns(R, shortsLine(R, pv, around(W - 3.3)), PAL.denim.shade, 0.45, 0.95);
    strokeRuns(R, shortsLine(R, pv, around(W - 2.5)), PAL.stitch, 0.2, 0.9);
    // passantes
    ctx.lineCap = 'round';
    for (const phi of [0.62, -0.62, 1.75, -1.75, Math.PI]) {
      if (R.facing(shortsNormal(pv, phi, W)) < 0.4) continue;
      const a = R.P(shortsAt(pv, phi, W + 0.6, 0.7)), b = R.P(shortsAt(pv, phi, W - 3.6, 1));
      ctx.strokeStyle = PAL.denim.shade;
      ctx.lineWidth = Math.max(1.4, 1.5 * z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = PAL.denim.light;
      ctx.lineWidth = Math.max(0.8, 0.9 * z);
      ctx.stroke();
    }
    if (R.facing(shortsNormal(pv, 0, W)) > 0.1) {
      // botão
      const q = R.P(shortsAt(pv, 0, W - 1.5, 1));
      ctx.fillStyle = PAL.ink;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(1.1, 0.95 * z), 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = PAL.metal.base;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(0.7, 0.62 * z), 0, M.TAU);
      ctx.fill();
    }
    // braguilha: a costura do meio e o pesponto em curva
    strokeRuns(R, shortsLine(R, pv, [[0, W - 3.4], [0, 0], [0, -7], [0, -12]], 0.7), PAL.denim.shade, 0.32, 0.9);
    strokeRuns(R, shortsLine(R, pv, [[0.17, W - 3.6], [0.2, 0.5], [0.15, -5], [0.03, -8.6]], 0.7), PAL.stitch, 0.2, 0.85);
    // bocas dos bolsos da frente (um arco laranja de cada lado)
    for (const sx of [-1, 1]) strokeRuns(R, shortsLine(R, pv, [[sx * 0.5, W - 3.4], [sx * 0.76, W - 5.4], [sx * 1.02, W - 9.4], [sx * 1.2, W - 14.5]], 0.7), PAL.stitch, 0.22, 0.9);
    // bolsos de trás
    for (const sx of [-1, 1]) {
      const c = Math.PI + sx * 0.6;
      if (R.facing(shortsNormal(pv, c, -2)) < 0.12) continue;
      const pt = (dphi, zz) => R.P(shortsSeatPoint(rig, shortsRingAt(zz), c + dphi, 0.7));
      const pts = [pt(-0.34, 3.6), pt(0.34, 3.6), pt(0.34, -5.4), pt(0, -7.6), pt(-0.34, -5.4)];
      const path = new Path2D();
      pts.forEach((q, k) => (k ? path.lineTo(q.x, q.y) : path.moveTo(q.x, q.y)));
      path.closePath();
      ctx.lineJoin = 'round';
      ctx.fillStyle = M.mix(PAL.denim.base, PAL.denim.light, 0.4);
      ctx.fill(path);
      ctx.strokeStyle = PAL.denim.shade;
      ctx.lineWidth = Math.max(0.8, 0.45 * z);
      ctx.stroke(path);
      ctx.strokeStyle = PAL.stitch;
      ctx.lineWidth = Math.max(0.5, 0.2 * z);
      ctx.globalAlpha = 0.9;
      const s2 = [pt(-0.27, 2.5), pt(0.27, 2.5), pt(0.27, -4.9), pt(0, -6.6), pt(-0.27, -4.9)];
      ctx.beginPath();
      s2.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ chinelos
  // a sola: um pouco maior que o pé, rente ao chão (o pé é pintado por cima; sobra a beirada dela em volta)
  // (22/11, o dono: "o chinelo some" correndo. No tamanho do jogo, ~1 px por cm, a beirada de 1,5 cm virava a linha do
  // contorno: de costas e na diagonal de costas não se via chinelo nenhum, só o calcanhar. A sola ficou mais grossa,
  // 2,1 cm, e passa um pouco mais do calcanhar: de costas sobra uma faixa preta embaixo dele)
  const SOLE = [[0, -8.3], [3.8, -6.3], [4.9, -1], [5.3, 5], [5.6, 10.6], [4.6, 15.6], [1.6, 18.2], [-2.4, 17.4], [-5.2, 13.6], [-5.9, 8], [-5.3, 2], [-4.4, -5.4]];
  const SOLE_R = 1.05; // meia grossura da sola
  const soleSphere = (R, rig, i, s, f, u, r) => {
    const side = i === 0 ? -1 : 1;
    const B = PD.BODY;
    const toe = rig.toe && rig.toe[i];
    // à frente da base dos dedos a sola dobra junto com os dedos (igual ao pé)
    if (toe && f > B.ballFwd + 1) return R.circle(at(toe, -side * s, f - B.ballFwd, u + B.ankleHeight), r);
    return R.circle(at(rig.foot[i], -side * s, f, u), r);
  };
  /** A sola de um pé, como peça própria: entra na ordem logo antes da perna (o pé cobre o miolo; sobra a beirada). */
  function soleItem(R, rig, i, items) {
    const u = -PD.BODY.ankleHeight + SOLE_R;
    const leg = items.find((it) => it.name === 'coxa' && it.group === 'perna' + i);
    const foot = items.find((it) => it.name === 'pe' && it.group === 'perna' + i);
    const key = Math.min(leg ? leg.key : Infinity, foot ? foot.key : Infinity) - 0.03;
    return { name: 'sola', key, group: 'sola' + i, segs: [{ poly: R.hull(SOLE.map(([s, f]) => soleSphere(R, rig, i, s, f, u, SOLE_R))), circles: R._last, mat: R.pal.sandal, k: 0.2 }] };
  }
  /** Tira chata: uma fita que vai de `w0` a `w1` cm de largura ao longo de pontos no espaço, com contorno de tinta. */
  function ribbon(R, pts, w0, w1, color, ink = R.pal.ink) {
    const ctx = R.ctx;
    // curva suave pelos pontos, já na tela
    const sm = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < 6; k++) {
        const t = k / 6, t2 = t * t, t3 = t2 * t;
        const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        sm.push(R.P({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), z: cr(p0.z, p1.z, p2.z, p3.z) }));
      }
    }
    sm.push(R.P(pts[pts.length - 1]));
    const N = sm.length - 1;
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const a = sm[Math.max(0, i - 1)], b = sm[Math.min(N, i + 1)];
      let nx = -(b.y - a.y), ny = b.x - a.x;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      const hw = ((w0 + (w1 - w0) * (i / N)) / 2) * R.zoom;
      left.push({ x: sm[i].x + nx * hw, y: sm[i].y + ny * hw });
      right.push({ x: sm[i].x - nx * hw, y: sm[i].y - ny * hw });
    }
    const path = new Path2D();
    path.moveTo(left[0].x, left[0].y);
    for (const q of left) path.lineTo(q.x, q.y);
    for (let i = N; i >= 0; i--) path.lineTo(right[i].x, right[i].y);
    path.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.1, R.inkIn * 1.5);
    ctx.stroke(path);
    ctx.fillStyle = color;
    ctx.fill(path);
  }
  function sandalStraps(R, rig, i, sideOnly = false) {
    const side = i === 0 ? -1 : 1;
    const B = PD.BODY;
    const ft = rig.foot[i];
    const toe = rig.toe[i];
    const fp = (s, f, u) => (f > B.ballFwd + 1 ? at(toe, -side * s, f - B.ballFwd, u + B.ankleHeight) : at(ft, -side * s, f, u));
    // a tira em Y: o pino sai da sola entre o dedão e o segundo dedo e as duas tiras, largas, descem pelo peito do pé
    // até as beiradas da sola
    const post = fp(1.5, 12, -3.3);
    const cam = R.toCam;
    const sideVec = scale(ft.r, -side); // para o lado de dentro do pé
    const seeIn = dot(sideVec, cam) > -0.35, seeOut = dot(sideVec, cam) < 0.35;
    const mat = R.pal.sandal;
    if (sideOnly) {
      // de costas: só a metade de baixo da perna da tira do lado que a câmera vê (a que desce pela beirada do pé)
      const k = dot(sideVec, cam);
      if (k < -0.42) ribbon(R, [fp(-2.7, 7, -2.1), fp(-4.3, 4.6, -3.8), fp(-5.1, 3.2, -5.7)], 1.3, 1.75, mat.base);
      if (k > 0.42) ribbon(R, [fp(4.2, 6.9, -2.6), fp(4.95, 4.2, -4.4), fp(5.15, 3, -5.7)], 1.3, 1.75, mat.base);
      return;
    }
    cord(R, [fp(1.5, 12.1, -5.9), post], 0.75, mat.base, R.pal.ink, 0.6); // o pino
    if (seeOut) ribbon(R, [post, fp(-0.4, 9.8, -1.35), fp(-2.7, 7, -2.1), fp(-4.3, 4.6, -3.8), fp(-5.1, 3.2, -5.7)], 0.85, 1.75, mat.base);
    if (seeIn) ribbon(R, [post, fp(2.6, 9.9, -1.6), fp(4.2, 6.9, -2.6), fp(4.95, 4.2, -4.4), fp(5.15, 3, -5.7)], 0.85, 1.75, mat.base);
  }

  // ------------------------------------------------------------------ as linhas da mão e do pé dele
  const bez = (f, t) => {
    const u = 1 - t;
    return { x: u * u * f.base.x + 2 * u * t * f.mid.x + t * t * f.tip.x, y: u * u * f.base.y + 2 * u * t * f.mid.y + t * t * f.tip.y, z: u * u * f.base.z + 2 * u * t * f.mid.z + t * t * f.tip.z };
  };
  /** Uma forma arredondada, quase quadrada, deitada no espaço (centro e dois meios-eixos): a unha. */
  const pad3 = (R, c, ax, bx, n = 12) => {
    const p = new Path2D();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * M.TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const q = R.P(add(c, add(scale(ax, Math.sign(ca) * Math.pow(Math.abs(ca), 0.6)), scale(bx, Math.sign(sa) * Math.pow(Math.abs(sa), 0.6)))));
      if (k) p.lineTo(q.x, q.y);
      else p.moveTo(q.x, q.y);
    }
    p.closePath();
    return p;
  };
  const nailColor = (PAL) => M.mix(PAL.skin.light, '#ffe9d2', 0.5);
  function paintNail(R, path, alpha) {
    const ctx = R.ctx;
    ctx.globalAlpha = 0.95 * alpha;
    ctx.fillStyle = nailColor(R.pal);
    ctx.fill(path);
    ctx.globalAlpha = 0.5 * alpha;
    ctx.strokeStyle = R.pal.inkSoft;
    ctx.lineWidth = Math.max(0.4, 0.13 * R.zoom);
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  }
  /** As linhas da mão: os vãos entre os dedos, os nós, as dobras, as unhas e, do lado da palma, as duas dobras dela. */
  function handLines(R, rig, i, hd, fingers, HP, info) {
    if (!R.fine) return;
    const ctx = R.ctx;
    const z = R.zoom;
    const PAL = R.pal;
    const back = R.facing(hd.d); // > 0: as costas da mão olham para a câmera
    const up = back >= 0 ? 1 : -1;
    const open = 1 - smoothstep(0.3, 0.62, info.fist); // (fechada, a ponta dos dedos vira para a palma: sem unha)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // os vãos entre os dedos, do lado que aparece
    ctx.strokeStyle = PAL.inkSoft;
    ctx.lineWidth = Math.max(0.45, 0.22 * z);
    ctx.globalAlpha = 0.8;
    for (let k = 0; k + 1 < fingers.length; k++) {
      const a = fingers[k], b = fingers[k + 1];
      const pts = [0.06, 0.5, 0.94].map((t) => R.P(add(scale(add(bez(a, t), bez(b, t)), 0.5), scale(hd.d, up * (a.r + b.r) * 0.4))));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (back > 0.18) {
      const al = smoothstep(0.18, 0.45, back);
      ctx.strokeStyle = PAL.skin.shade;
      ctx.lineWidth = Math.max(0.5, 0.28 * z);
      for (const f of fingers) {
        // o nó (um arquinho na base do dedo) e a dobra do meio
        const dirF = norm(sub(bez(f, 0.2), f.base));
        const c = add(f.base, scale(hd.d, f.r * 0.95));
        const p0 = R.P(add(c, scale(hd.s, -f.r * 0.8))), p1 = R.P(add(c, scale(dirF, f.r * 0.8))), p2 = R.P(add(c, scale(hd.s, f.r * 0.8)));
        ctx.globalAlpha = 0.85 * al;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
        ctx.stroke();
        if (open > 0.05) {
          const m = add(bez(f, 0.52), scale(hd.d, f.r * 0.9));
          const a0 = R.P(add(m, scale(hd.s, -f.r * 0.55))), a1 = R.P(add(m, scale(hd.s, f.r * 0.55)));
          ctx.globalAlpha = 0.6 * al * open;
          ctx.beginPath();
          ctx.moveTo(a0.x, a0.y);
          ctx.lineTo(a1.x, a1.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      // (as unhas só com as costas da mão bem de frente: com a mão de lado, a de um dedo saía por cima do dedo vizinho)
      const nailAl = smoothstep(0.42, 0.62, back) * open;
      if (nailAl > 0.03) {
        for (const f of fingers) {
          const dirF = norm(sub(f.tip, bez(f, 0.75)));
          const c = add(bez(f, 0.9), scale(hd.d, f.r * 0.66));
          paintNail(R, pad3(R, c, scale(dirF, f.r * 0.62), scale(hd.s, f.r * 0.52)), nailAl);
        }
      }
    } else if (back < -0.25 && open > 0.05) {
      // a palma: as duas dobras (a de baixo dos dedos e a que contorna a almofada do polegar)
      const al = smoothstep(0.25, 0.5, -back) * open;
      const pp = (a, s) => R.P(HP(hu(a), hu(-2.05), hu(s)));
      ctx.strokeStyle = PAL.skin.shade;
      ctx.lineWidth = Math.max(0.5, 0.26 * z);
      ctx.globalAlpha = 0.75 * al;
      for (const [a, b, c] of [[[7.5, -2.7], [6.9, -0.2], [7.9, 2.2]], [[7.6, 2.3], [5.4, 0.5], [2, 0.5]]]) {
        const p0 = pp(a[0], a[1]), p1 = pp(b[0], b[1]), p2 = pp(c[0], c[1]);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // a unha do polegar (olha para o lado e um pouco para as costas da mão)
    const T = info.thumb;
    if (T && open > 0.05) {
      const dirT = norm(sub(T.tip, T.mid || T.base));
      let n = add(scale(hd.s, 0.75), scale(hd.d, 0.66));
      n = norm(sub(n, scale(dirT, dot(n, dirT))));
      const f = R.facing(n);
      if (f > 0.2) paintNail(R, pad3(R, add(sub(T.tip, scale(dirT, T.r * 0.1)), scale(n, T.r * 0.66)), scale(dirT, T.r * 0.62), scale(norm(cross(n, dirT)), T.r * 0.55)), smoothstep(0.2, 0.45, f) * open);
    }
  }
  /** As linhas do pé: os ossinhos do tornozelo e a unha de cada dedo (os vãos já aparecem: cada dedo é uma peça). */
  function toeLines(R, rig, i, toe, side, ft) {
    if (!R.fine) return;
    const ctx = R.ctx;
    const PAL = R.pal;
    if (ft) {
      for (const sgn of [-1, 1]) {
        const sp = MODEL.FOOT.find((q) => Math.sign(q.s) === sgn && Math.abs(q.s) > 2 && Math.abs(q.f) < 1);
        if (!sp) continue;
        const nrm = scale(ft.r, -side * sgn);
        const fc = R.facing(nrm);
        if (fc < 0.25) continue;
        const c = at(ft, -side * sp.s, sp.f, sp.u);
        const pts = [-0.9, 0, 0.9].map((k) => R.P(add(add(c, scale(nrm, sp.r * 0.8)), add(scale(ft.f, sp.r * 0.75 * k), scale(ft.u, sp.r * 0.6 * (1 - Math.abs(k)))))));
        ctx.strokeStyle = PAL.skin.shade;
        ctx.globalAlpha = 0.8 * smoothstep(0.25, 0.55, fc);
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.5, 0.4 * R.zoom);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // de costas os dedos ficam escondidos atrás do pé: nem vãos, nem unhas
    const seen = smoothstep(-0.55, -0.2, R.facing(toe.f));
    if (seen < 0.03) return;
    const each = MODEL.TOES.each;
    // os vãos entre os dedos: um risco por cima (da raiz até a ponta) que desce pela frente até o chão. (O pé e os
    // dedos são pintados como um volume só, sem linha entre eles: sem estes riscos os cinco dedos viravam uma "língua")
    ctx.strokeStyle = PAL.inkSoft;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.5, 0.2 * R.zoom);
    ctx.globalAlpha = 0.85 * seen;
    for (let k = 0; k + 1 < each.length; k++) {
      const a = each[k], b = each[k + 1]; // (a = o de fora, b = o de dentro)
      const gap = (j) => (a[j].s + a[j].r + (b[j].s - b[j].r)) / 2;
      const topU = (j) => Math.min(a[j].u + a[j].r, b[j].u + b[j].r) * 0.92;
      const fTip = Math.min(a[2].f + a[2].r, b[2].f + b[2].r);
      const pts = [
        at(toe, -side * gap(0), Math.max(a[0].f, b[0].f) - 0.4, topU(0)),
        at(toe, -side * gap(1), (a[1].f + b[1].f) / 2, topU(1)),
        at(toe, -side * gap(2), fTip - 0.55, topU(2) * 0.95),
        at(toe, -side * gap(2), fTip, topU(2) * 0.45),
        at(toe, -side * gap(2), fTip - 0.15, 0.2),
      ].map((q) => R.P(q));
      ctx.stroke(S.smoothLinePath(pts));
    }
    ctx.globalAlpha = 1;
    const top = R.facing(toe.u);
    if (top < 0.02) return; // de frente, com a câmera reta, a unha fica de quina: não aparece
    const al = smoothstep(0.02, 0.26, top) * seen;
    for (const t of each) {
      const q = t[t.length - 1];
      const c = at(toe, -side * q.s, q.f + q.r * 0.16, q.u + q.r * 0.88);
      paintNail(R, pad3(R, c, scale(toe.f, q.r * 0.56), scale(toe.r, q.r * 0.64)), al);
    }
  }

  /**
   * A sombra de uma peça do rosto que fica por cima da cabeça (o nariz, o lábio de baixo), pintada dentro dela. São
   * duas meias-luas, com a mesma conta dos volumes (`paintConvex`: sombra = o que a peça, deslocada para o lado da
   * luz, não cobre):
   *  - a da CABEÇA, continuada: onde o rosto está na sombra, a peça também está (uma luz só para os dois);
   *  - a da própria peça (`kOwn`, em raios dela): a sombra fina do lado contrário à luz, que dá o volume.
   * (pinta só a sombra, por cima da cor base: a peça inteira de sombra e a parte clara por cima deixava um fio escuro
   * na borda dela, de frente)
   */
  function faceShade(R, seg, headSeg, shade, kOwn, ownPoly = null) {
    const ctx = R.ctx;
    const outside = (poly, k) => {
      if (k <= 0.2) return;
      const p = new Path2D();
      p.rect(-1e5, -1e5, 2e5, 2e5);
      S.polyPath(poly, R.light.x * k, R.light.y * k, p);
      ctx.fill(p, 'evenodd');
    };
    ctx.fillStyle = shade;
    if (headSeg && headSeg.poly && headSeg.poly.length >= 6 && headSeg.k > 0) outside(headSeg.poly, S.polyRadius(headSeg.poly) * headSeg.k);
    // (`ownPoly`: a sombra própria vem de um pedaço só da peça — no nariz, a ponta e as asas: com o nariz inteiro, a
    // sombra do lado virava um risco comprido da sobrancelha até a asa)
    if (!ownPoly) outside(seg.poly, S.polyRadius(seg.poly) * kOwn);
    else {
      ctx.save();
      ctx.clip(S.polyPath(ownPoly));
      outside(ownPoly, S.polyRadius(ownPoly) * kOwn);
      ctx.restore();
    }
  }
  /**
   * As narinas (pintadas dentro da peça do nariz): uma meia-lua escura embaixo de cada asa, do lado que aparece. Olham
   * para baixo e um pouco para o lado: de cima (a câmera do jogo) quase não aparecem.
   */
  function noseDetail(R, rig, head, hs) {
    const ctx = R.ctx;
    const hp = (p) => at(head, p[0], p[1], p[2]);
    for (const sx of [-1, 1]) {
      const f = R.facing(norm(dirIn(rig.head, sx * 0.45, 0.4, -0.8)));
      if (f < 0.1) continue;
      // a meia-lua: a borda de cima curva (a asa por cima dela) e a de baixo quase reta
      const P = (x, y, z) => R.P(hp([sx * x, y, z]));
      const pts = [P(0.55, 16.4, -7.7), P(1.05, 16.0, -7.5), P(1.55, 15.6, -7.6), P(1.55, 15.6, -7.8), P(1.05, 16.0, -7.85), P(0.6, 16.35, -7.85)];
      ctx.fillStyle = '#2a120a';
      ctx.globalAlpha = 0.95 * smoothstep(0.1, 0.35, f);
      ctx.fill(S.smoothClosedPath(pts));
    }
    ctx.globalAlpha = 1;
  }
  /**
   * O nariz visto de frente, como na referência: o contorno de cada asa (um "C" aberto para o meio, que desce até a
   * narina) e a curva embaixo da ponta. Some conforme a cabeça vira (de três quartos fica o risco de `noseLine`; de perfil,
   * a silhueta).
   */
  function noseFront(R, rig, head, hs) {
    const fFace = R.facing(rig.head.f);
    const t = Math.abs(R.facing(rig.head.r));
    const alpha = smoothstep(0.3, 0.6, fFace) * (1 - smoothstep(0.3, 0.6, t));
    if (alpha < 0.03) return;
    const ctx = R.ctx;
    const hp = (p) => at(head, p[0], p[1], p[2]);
    ctx.strokeStyle = R.pal.ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(0.6, 0.24 * R.zoom);
    for (const sx of [-1, 1]) {
      // (do alto da asa, por fora, até a narina: os pontos ficam na superfície da esfera da asa)
      const C = [[1.85, 15.45, -6.05], [2.6, 15.35, -6.6], [2.85, 15.05, -7.25], [2.45, 15.3, -7.85], [1.6, 15.75, -8.0]];
      ctx.stroke(S.smoothLinePath(C.map(([x, y, z]) => R.P(hp([sx * x, y, z])))));
    }
    // embaixo da ponta, entre as narinas
    ctx.lineWidth = Math.max(0.5, 0.2 * R.zoom);
    ctx.stroke(S.smoothLinePath([[-0.7, 16.5, -8.05], [0, 16.9, -8.2], [0.7, 16.5, -8.05]].map((p) => R.P(hp(p)))));
    ctx.globalAlpha = 1;
  }
  /**
   * De lado (rodada 4, como na referência de perfil): a curva em "C" da asa do nariz em volta da narina, aberta para a
   * frente, no lado que olha para a câmera. De frente ela some (lá quem desenha as asas é `noseFront`).
   */
  function noseSide(R, rig, head, hs) {
    const t = R.facing(rig.head.r);
    const sx = t >= 0 ? 1 : -1;
    const alpha = smoothstep(0.5, 0.85, Math.abs(t)) * smoothstep(-0.2, 0.15, R.facing(rig.head.f) + 0.25);
    if (alpha < 0.03) return;
    const ctx = R.ctx;
    const hp = (p) => at(head, p[0], p[1], p[2]);
    ctx.strokeStyle = R.pal.ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(0.6, 0.24 * R.zoom);
    const C = [[2.2, 15.7, -6.0], [2.7, 14.8, -6.2], [2.85, 14.15, -7.0], [2.55, 14.5, -7.85], [1.9, 15.3, -8.15]];
    ctx.stroke(S.smoothLinePath(C.map(([x, y, z]) => R.P(hp([sx * x, y, z])))));
    ctx.globalAlpha = 1;
  }
  /**
   * O risco do nariz, para as vistas de frente e de três quartos: desce pelo lado de lá do nariz (o que fica contra a
   * bochecha), contorna a asa e passa por baixo da ponta. De frente ele fica do lado direito dele; conforme a cabeça
   * vira, troca de lado sem pulo (um some enquanto o outro aparece). De perfil não aparece: lá o nariz é a silhueta.
   */
  function noseLine(R, rig, head, hs) {
    const fFace = R.facing(rig.head.f);
    if (fFace < 0.1) return;
    const ctx = R.ctx;
    const t = R.facing(rig.head.r); // > 0: o lado direito dele olha para a câmera (o lado de lá é o esquerdo)
    const hp = (p) => at(head, p[0], p[1], p[2]);
    const N = Object.fromEntries(MODEL.HEAD.spheres.filter((s) => s.apart).map((s) => [s.name, s]));
    const inPlane = (v) => norm(sub(v, scale(R.toCam, dot(v, R.toCam)))); // a direção, deitada no plano da imagem
    const down = inPlane(scale(rig.head.u, -1));
    // (vista de cima — a câmera do jogo —, a ponta do nariz desce na imagem e a volta por baixo dela virava um
    // rabisco: aí fica só o risco do lado)
    const fromAbove = smoothstep(0.15, 0.4, R.facing(rig.head.u));
    const draw = (sgn, alpha) => {
      if (alpha < 0.03) return;
      const out = inPlane(scale(rig.head.r, sgn));
      const far = sgn > 0 ? N.asaD : N.asaE, near = sgn > 0 ? N.asaE : N.asaD;
      const on = (s, dir, k = 1) => add(hp(s.p), scale(dir, s.r * hs * k));
      const side = [on(N.dorso, out, 0.95), on(far, out, 1), on(far, norm(add(out, scale(down, 0.7))), 1)];
      const under = [on(far, norm(add(out, down)), 1), on(N.nariz, down, 1), on(near, norm(add(scale(out, -0.35), down)), 0.9)];
      const pts = (fromAbove > 0.5 ? side : [side[0], side[1]].concat(under)).map((q) => R.P(q));
      ctx.strokeStyle = R.pal.inkSoft;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(0.6, 0.26 * R.zoom); // (fino: de três quartos ele só sugere o lado do nariz)
      ctx.globalAlpha = alpha;
      ctx.stroke(S.smoothLinePath(pts));
      ctx.globalAlpha = 1;
    };
    const frontal = smoothstep(0.1, 0.4, fFace);
    const turn = smoothstep(0.2, 0.5, Math.abs(t)); // (de frente, o nariz é desenhado por `noseFront`)
    draw(1, (1 - smoothstep(-0.05, 0.3, t)) * frontal * turn);
    draw(-1, smoothstep(0.05, 0.4, t) * frontal * turn);
  }

  /**
   * O olho de perfil (o desenho do olho de frente some quando a cabeça está de lado): uma amêndoa com a ponta para a
   * frente, a íris vista de lado (estreita), a pálpebra grossa por cima, a de baixo fina e a sobrancelha.
   */
  function sideEye(R, rig, head, sx, look) {
    const ctx = R.ctx;
    const PAL = R.pal;
    const hs = R.hs;
    const E = MODEL.HEAD.eye;
    // (depois do perfil, com o rosto virando para lá, o olho some atrás do contorno do rosto: ele fica cada vez mais
    // estreito, encolhendo para a ponta da frente (a do lado do contorno), entre ~92° e ~105°, até sobrar só a ponta da
    // pálpebra e sumir; a sobrancelha, que é o próprio contorno ali, encolhe do mesmo jeito um pouco depois. Rodada 4b: a
    // 120° o olho inteiro aparecia na beira do rosto, como se ele ainda estivesse de perfil; apagar com transparência
    // deixava um olho "fantasma", cortar deixava uma beirada reta e encolher para o canto de trás deixava uma mancha no
    // meio da bochecha)
    const away = -R.facing(rig.head.f);
    const kE = 1 - smoothstep(0.04, 0.28, away);
    const kB = 1 - smoothstep(0.1, 0.36, away);
    if (kB < 0.04) return;
    const c = at(head, sx * 5.9, 10.7, E.z + 0.1); // (recuado: o olho fica atrás da raiz do nariz e da sobrancelha)
    const F = rig.head.f, U = rig.head.u;
    const blink = clamp01(look.blink || 0);
    const h = 1 - blink * 0.9;
    const pt0 = (a, b) => R.P(add(add(c, scale(F, a * hs)), scale(U, b * h * hs)));
    const pt = (a, b) => pt0(2.8 - (2.8 - a) * kE, b); // (o olho, encolhendo para a ponta da frente)
    const showEye = kE >= 0.08;
    const eyeA = kE >= 0.22 ? 1 : 0; // (bem estreito, o branco e a íris saem: fica só a pálpebra)
    // (a = para a frente do rosto, b = para cima; o canto de fora do olho fica atrás)
    const top = [[-2.6, 0.5], [-1.3, 1.2], [0.4, 1.45], [1.9, 1], [2.8, 0.15]].map(([a, b]) => pt(a, b));
    const bot = [[2.8, 0.15], [1.8, -0.7], [0.3, -0.95], [-1.4, -0.7], [-2.6, 0.05]].map(([a, b]) => pt(a, b));
    if (blink < 0.85 && eyeA > 0.01) {
      const eye = new Path2D();
      eye.moveTo(top[0].x, top[0].y);
      for (const q of top) eye.lineTo(q.x, q.y);
      for (const q of bot) eye.lineTo(q.x, q.y);
      eye.closePath();
      ctx.fillStyle = PAL.eyeWhite;
      ctx.fill(eye);
      ctx.save();
      ctx.clip(eye);
      // a íris, na frente do olho, vista de lado: uma elipse estreita
      const ic = pt(1.5, 0.15);
      const ax = pt(1.5 + 0.85, 0.15), ay = pt(1.5, 0.15 + 1.35);
      const rx = Math.max(0.5, Math.hypot(ax.x - ic.x, ax.y - ic.y)), ry = Math.max(0.5, Math.hypot(ay.x - ic.x, ay.y - ic.y));
      const rot = Math.atan2(ax.y - ic.y, ax.x - ic.x);
      ctx.fillStyle = (look.eyeGlow || 0) > 0.3 ? '#e8a514' : PAL.iris;
      ctx.beginPath();
      ctx.ellipse(ic.x, ic.y, rx, ry, rot, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#0c0606';
      ctx.beginPath();
      ctx.ellipse(ic.x, ic.y, rx * 0.5, ry * 0.5, rot, 0, M.TAU);
      ctx.fill();
      const hl = pt(1.85, 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hl.x, hl.y, Math.max(0.45, rx * 0.3), 0, M.TAU);
      ctx.fill();
      // sombra da pálpebra no alto do olho
      ctx.fillStyle = 'rgba(80, 30, 20, 0.28)';
      const sh = new Path2D();
      sh.moveTo(top[0].x, top[0].y);
      for (const q of top) sh.lineTo(q.x, q.y);
      for (const [a, b] of [[2.8, -0.2], [0.4, 0.95], [-2.6, 0.1]]) {
        const q = pt(a, b);
        sh.lineTo(q.x, q.y);
      }
      sh.closePath();
      ctx.fill(sh);
      ctx.restore();
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // a pálpebra de cima: traço grosso, passando um pouco do canto de trás
    if (showEye) {
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = Math.max(1, E.lid * 1.25 * R.zoom);
      ctx.stroke(S.smoothLinePath([pt(-3.4, 0.25)].concat(top)));
      // a de baixo: fina
      if (blink < 0.85 && eyeA > 0.01) {
        ctx.lineWidth = Math.max(0.5, 0.2 * R.zoom);
        ctx.globalAlpha = 0.75;
        ctx.stroke(S.smoothLinePath(bot));
        ctx.globalAlpha = 1;
      }
    }
    // sobrancelha: grossa, descendo para o nariz (encolhendo para a ponta de trás quando o rosto vira para lá)
    const raise = (look.browRaise || 0) * 0.8;
    const ptB = (a, b) => pt0(3.9 - (3.9 - a) * kB, b);
    const b0 = ptB(3.9, 2.35 + raise), b1 = ptB(0.4, 3.75 + raise), b2 = ptB(-3.4, 3.2 + raise);
    ctx.strokeStyle = '#1c1416';
    ctx.lineWidth = Math.max(1.4, 1.75 * hs * R.zoom * (0.6 + 0.4 * kB));
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.quadraticCurveTo(b1.x, b1.y, b2.x, b2.y);
    ctx.stroke();
  }

  /** A sunga das fichas também cobre a base da pelve por baixo da bermuda durante a passada. */
  function pelvisDetail(R, seg, rig) {
    const waistZ = 6.6;
    const ctx = R.ctx;
    ctx.fillStyle = R.pal.denim.base;
    ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
    // a pele volta acima do elástico (a barriga de baixo) — a linha fica na altura do cós da bermuda
    const pv = rig.pelvis;
    const top = [];
    for (let k = 0; k <= 30; k++) {
      const phi = (k / 30) * M.TAU;
      top.push(R.P(pelvisRing(pv, { z: waistZ, rx: 30, ry: 30, cy: 0 }, phi)));
    }
    const up = R.P(at(pv, 0, 0, 60));
    const c = R.P(at(pv, 0, 0, waistZ));
    // tudo o que fica acima do plano do elástico (o disco do elástico arrastado para cima)
    ctx.fillStyle = R.pal.skin.base;
    const sweep = new Path2D();
    top.forEach((q, k) => (k ? sweep.lineTo(q.x, q.y) : sweep.moveTo(q.x, q.y)));
    sweep.closePath();
    for (let k = 0; k < top.length; k++) {
      const a = top[k], b = top[(k + 1) % top.length];
      sweep.moveTo(a.x, a.y);
      sweep.lineTo(b.x, b.y);
      sweep.lineTo(b.x + (up.x - c.x), b.y + (up.y - c.y));
      sweep.lineTo(a.x + (up.x - c.x), a.y + (up.y - c.y));
      sweep.closePath();
    }
    ctx.fill(sweep, 'nonzero');
  }

  Object.assign(MODEL, { face, chestDetail, pelvisDetail, extras, limbDetail, wear, handLines, toeLines });

  // ------------------------------------------------------------------ registro
  PD.models = PD.models || {};
  PD.models.birim = { id: 'birim', nome: 'Birim', PALETTE, MODEL, CAP };
  /** A aparência de um modelo, para o desenho: { paleta, modelo }. Sem modelo (ou 'heroi'): null (o herói de sempre). */
  PD.models.appearance = (id) => {
    const m = id && PD.models[id];
    return m && m.MODEL ? { paleta: m.PALETTE, modelo: m.MODEL, id: m.id } : null;
  };
})(window.PD = window.PD || {});
