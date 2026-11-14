// Leitor dos mapas do mundo novo (Tiled, formato combinado com o [mundo] e a [estrutura]; veja docs/ARQUITETURA.md,
// "Mapas do mundo novo"): 1 tile = 1 metro, tile de 32 px, tudo em camadas de objetos. Transforma o .tmj no mapa que
// o mundo do protótipo desenha (medidas em centímetros, x desce para a direita na tela e y desce para a esquerda —
// as mesmas direções do Tiled visto de cima).
//  - "chao": áreas do chão, na ordem de desenho (mata, grama, terra, asfalto, trilha em polilinha com `largura`, `cor`
//    opcional, como a da água do lago,
//    `circulo` com `brilho`);
//  - "cenario": árvores (`especie`, `copa` = raio, `altura`, `tronco` = diâmetro, em metros), arbusto, pedra, poste
//    (alto = de concreto, com `fiacao`), poste-praca, gradil, portão, pilar, `veu`, tronco-caido, aguape, capivara, a
//    vila: casa (frente ao sul), banco, mesa, fogueira, orelhao, lixeira e carro; e a etapa 4c (desenho em fundo.js):
//    trave, muro, viaduto, pilar-viaduto, trem, cipo, onibus, barreira e placa; o parque antigo: bebedouro e academia
//    (parque.js), banco de concreto, lixeira e poste com mato/cipó, a placa grande e a calçada de placas soltas;
//  - "colisao": caixas onde o pé bate (as mesmas do servidor); "seguro", "areas" e "pontos" (o nascimento).
(function (PD) {
  'use strict';

  const CM = 100 / 32; // px do Tiled → cm (32 px = 1 m)

  function props(o) {
    const out = {};
    for (const p of o.properties || []) out[p.name] = p.value;
    return out;
  }
  const kindOf = (o) => o.type || o.class || '';
  const rect = (o) => ({ x0: o.x * CM, y0: o.y * CM, x1: (o.x + o.width) * CM, y1: (o.y + o.height) * CM });
  // móveis das casas com interior (o desenho fica em casas.js)
  const HOME_FURNITURE = new Set(['pia', 'fogao', 'filtro', 'mesa-cozinha', 'estante', 'sofa', 'cristaleira', 'mesa-redonda', 'maquina-costura', 'cama']);
  /** A caixa em pedaços de até `max` cm ao longo do lado comprido (coisa grande vira várias imagens menores). */
  function pieces(r, max) {
    const alongX = r.x1 - r.x0 >= r.y1 - r.y0;
    const L = alongX ? r.x1 - r.x0 : r.y1 - r.y0;
    const n = Math.max(1, Math.ceil(L / max - 1e-6));
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (alongX ? r.x0 : r.y0) + (L * i) / n;
      const b = (alongX ? r.x0 : r.y0) + (L * (i + 1)) / n;
      out.push(alongX ? { x0: a, x1: b, y0: r.y0, y1: r.y1, piece: i, pieces: n } : { x0: r.x0, x1: r.x1, y0: a, y1: b, piece: i, pieces: n });
    }
    return out;
  }

  /** Mapa do protótipo a partir de um .tmj já lido (JSON). */
  function toMap(tmj) {
    const layer = (name) => (tmj.layers || []).find((l) => l.name === name);
    const objs = (name) => (layer(name) && layer(name).objects) || [];
    const map = {
      kind: 'tmj',
      w: tmj.width * 100,
      h: tmj.height * 100,
      name: props(tmj).nome || '',
      shapes: [],
      trees: [],
      props: [],
      fences: [],
      pillars: [],
      veils: [],
      // bandeirinhas (cordões no alto, de ponto a ponto)
      bunting: [],
      // rentes ao chão (deque e pinguela): desenhados logo depois do chão, antes de quem fica em pé
      flats: [],
      colliders: [],
      safe: [],
      areas: [],
      spawn: null,
      awakening: null,
      houses: [],
      // o que o mapa da esquina de São Paulo tinha (postes e fios agora também vêm da vila)
      buildings: [],
      walls: [],
      poles: [],
      wires: [],
      trafficLight: null,
      trafficLights: [],
    };

    for (const o of objs('chao')) {
      const k = kindOf(o);
      const pr = props(o);
      if (k === 'entulho') {
        // o monte de entulho (com `cadeiraCaida`): tijolos e a cadeira têm altura, então é um objeto (casas.js)
        const r0 = o.width || o.height ? rect(o) : null;
        const ex = r0 ? (r0.x0 + r0.x1) / 2 : o.x * CM, ey = r0 ? (r0.y0 + r0.y1) / 2 : o.y * CM;
        map.props.push({ kind: 'entulho', x: ex, y: ey, r: 45, chair: !!pr.cadeiraCaida });
        continue;
      }
      if (o.polyline) {
        const pts = o.polyline.map((p) => ({ x: (o.x + p.x) * CM, y: (o.y + p.y) * CM }));
        // linhas da rua (meio-fio, faixa-rua, rachadura, raiz): altura, tracejada, apagada, sarjeta e mato
        map.shapes.push({ type: k, kind: 'line', pts, width: (pr.largura || 2) * 100, color: pr.cor, height: pr.altura != null ? pr.altura * 100 : null, dashed: !!pr.tracejada, faded: !!pr.apagada, gutter: !!pr.sarjeta, weeds: !!pr.mato });
      } else if (o.ellipse) {
        const r = rect(o);
        const s = { type: k, kind: 'ellipse', cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2, rx: (r.x1 - r.x0) / 2, ry: (r.y1 - r.y0) / 2, color: pr.cor };
        map.shapes.push(s);
        if (k === 'circulo') map.awakening = { x: s.cx, y: s.cy, r: Math.min(s.rx, s.ry), color: pr.brilho || '#3fd6c8' };
      } else if (o.polygon) {
        const pts = o.polygon.map((p) => ({ x: (o.x + p.x) * CM, y: (o.y + p.y) * CM }));
        // `desenho` e `quebrada` (as placas soltas da calçada velha do parque)
        map.shapes.push({ type: k, kind: 'poly', pts, color: pr.cor, pattern: pr.desenho, broken: !!pr.quebrada });
      } else if (o.point || (!o.width && !o.height)) {
        // pontos no chão (bueiro, tampa, buraco, capim): `raio`, `olhando`, `agua`, `tipo`
        map.shapes.push({ type: k, kind: 'point', x: o.x * CM, y: o.y * CM, r: pr.raio ? pr.raio * 100 : null, angle: pr.olhando || 0, water: !!pr.agua, plant: pr.tipo || null, color: pr.cor });
      } else {
        // `estado` (asfalto rachado), `musgo` (praça) e `linhas` (campinho)
        map.shapes.push({ type: k, kind: 'rect', ...rect(o), color: pr.cor, pattern: pr.desenho, stripes: pr.listras, state: pr.estado || null, moss: !!pr.musgo, lines: !!pr.linhas });
      }
    }

    const wireLines = [];
    for (const o of objs('cenario')) {
      const k = kindOf(o);
      const pr = props(o);
      const x = o.x * CM;
      const y = o.y * CM;
      if (k === 'arvore') {
        // `dentroDaCasa`: a árvore que nasceu dentro da casa abandonada (o tronco só aparece com a casa cortada; a casa
        // desenha o buraco da laje em volta dela e não um segundo tronco)
        // (e rompe o chão de dentro: o pé e as raízes são os da Figueira da Esquina, os que o dono aprovou)
        map.trees.push({ x, y, kind: pr.especie || 'mata', r: (pr.copa || 2.5) * 100, h: (pr.altura || 5) * 100, trunk: ((pr.tronco || 0.35) * 100) / 2, name: o.name || '', breaks: !!pr.rompendo || !!pr.dentroDaCasa, hugs: pr.abraca || null, inside: !!pr.dentroDaCasa });
      } else if (k === 'arbusto') {
        map.props.push({ kind: 'arbusto', x, y, r: (pr.raio || 0.8) * 100, dense: !!pr.fechado, wild: true });
      } else if (k === 'pedra') {
        map.props.push({ kind: 'pedra', x, y, r: (pr.raio || 0.4) * 100, ancestral: !!pr.ancestral, name: o.name || '' });
      } else if (k === 'tronco-caido') {
        // deitado ao longo do lado comprido da caixa
        map.props.push({ kind: 'tronco-caido', ...rect(o), h: (pr.altura || 0.6) * 100 });
      } else if (k === 'aguape') {
        map.props.push({ kind: 'aguape', x, y, r: (pr.raio || 0.7) * 100 });
      } else if (k === 'capivara') {
        // enfeite (não bloqueia); `olhando` em graus no chão (0 = leste, 90 = sul)
        map.props.push({ kind: 'capivara', x, y, angle: pr.olhando || 0 });
      } else if (k === 'poste' && (pr.altura || 3.8) >= 5) {
        // poste de concreto da rua (com luminária e a fiação que passa por ele)
        map.poles.push({ x, y, h: pr.altura * 100, lamp: !!pr.luz, light: pr.luz || '#ffe9a6', vine: !!pr.cipo });
      } else if (k === 'prateleira' || k === 'geladeira' || k === 'balcao' || k === 'engradado') {
        // móveis de dentro da casa que dá para entrar (retângulo): `altura`, `olhando` (para onde a frente dá: 90 = sul,
        // 0 = leste), `caixa` (balcão com a caixa registradora), `pilha` (quantos engradados), `cor`
        const r0 = o.width || o.height ? rect(o) : { x0: x - 20, x1: x + 20, y0: y - 15, y1: y + 15 };
        map.props.push({ kind: k, ...r0, h: pr.altura != null ? pr.altura * 100 : null, angle: pr.olhando ?? 90, register: !!pr.caixa, stack: pr.pilha || 3, color: pr.cor || null });
      } else if (HOME_FURNITURE.has(k)) {
        // móveis das casas com interior (casas.js): `altura`, `olhando` (90 = sul, 0 = leste, 270 = norte, 180 = oeste)
        // e os detalhes: `panela` (fogão), `tv` (estante), `cadeiras` e `toalha` (mesas), `cor`, `croche`, `rasgado` e
        // `mato` (sofá), `colcha` (cama)
        const r0 = o.width || o.height ? rect(o) : { x0: x - 25, x1: x + 25, y0: y - 25, y1: y + 25 };
        // (a cama sem `olhando` fica com os pés para o leste, como sempre foi; os outros móveis, de frente para o sul)
        map.props.push({ kind: k, ...r0, x: (r0.x0 + r0.x1) / 2, y: (r0.y0 + r0.y1) / 2, h: pr.altura != null ? pr.altura * 100 : null, angle: pr.olhando ?? (k === 'cama' ? 0 : 90), pot: !!pr.panela, tv: !!pr.tv, chairs: pr.cadeiras || 0, cloth: pr.toalha || null, color: pr.cor || null, doily: !!pr.croche, torn: !!pr.rasgado, weeds: !!pr.mato, quilt: pr.colcha || null });
      } else if (k === 'gato') {
        // o gato da casa (o Joaquim, da vó; creatures/gato.js): `nome`, `cor`, `manchas` e `tamanho`; dorme no sofá
        map.props.push({ kind: 'gato', x, y, r: 20, name: pr.nome || o.name || '', color: pr.cor || null, marks: pr.manchas || null, size: pr.tamanho || null });
      } else if (k === 'semaforo') {
        // semáforo de rua (ponto): `altura`, `olhando` (graus, para onde as luzes dão; 0 = leste), `quebrado` e `faiscas`
        map.trafficLights.push({ x, y, h: (pr.altura || 4.6) * 100, facing: pr.olhando || 0, broken: !!pr.quebrado, sparks: !!pr.faiscas });
      } else if (k === 'poste' || k === 'poste-praca') {
        // `apagado` (vidro quebrado, sem luz), `torto` e `cipo` (os do parque antigo)
        map.props.push({ kind: 'poste-praca', x, y, h: (pr.altura || 3.8) * 100, light: pr.luz || '#ffe9a6', off: !!pr.apagado, bent: !!pr.torto, vine: !!pr.cipo });
      } else if (k === 'fiacao' && o.polyline) {
        wireLines.push({ pts: o.polyline.map((p) => ({ x: (o.x + p.x) * CM, y: (o.y + p.y) * CM })), vine: !!pr.cipo });
      } else if (k === 'casa') {
        // casa da vila: a frente é o lado sul (+y), o que a câmera vê
        map.houses.push({
          ...rect(o),
          h: (pr.altura || 3) * 100,
          floors: pr.andares || 1,
          wall: pr.cor || '#c9a27a',
          block: !!pr.bloco,
          tank: !!pr.caixaDagua,
          pixo: !!pr.pixo,
          abandoned: !!pr.abandonada,
          name: o.name || '',
          shop: pr.comercio ? { type: pr.comercio, sign: pr.letreiro || '', awning: pr.toldo ? [pr.toldo, '#fff4dc'] : null } : null,
          // placa com o logo em cima da laje, no lugar do letreiro ('budega': o escudo da Budega, pedido do dono)
          logo: pr.logo || null,
          // a casa tomada pela mata (planta da rua da Budega): `cipo` de 0 a 1 = quanto da fachada o cipó cobre
          vine: typeof pr.cipo === 'number' ? pr.cipo : pr.cipo ? 0.5 : 0,
          plants: !!pr.plantas,
          roofTree: !!pr.arvoreNaLaje,
          clothes: !!pr.varal,
          moss: !!pr.musgo,
          grilles: !!pr.grade,
          garage: !!pr.portao,
          // dá para entrar (a Budega): com o herói dentro, o telhado e a frente saem e aparece o que tem lá dentro
          interior: !!pr.interior,
          // a árvore que nasceu dentro da casa abandonada e rompeu a laje (etapa 4c)
          treeInside: !!pr.arvoreDentro,
          // a porta (de onde até onde, em x, na frente) e quem mora (as paredes de dentro: 'familia', 'vo', 'ninguem')
          door: pr.portaDe != null && pr.portaAte != null ? { from: pr.portaDe * 100, to: pr.portaAte * 100 } : null,
          resident: pr.morador || null,
        });
      } else if (k === 'predio') {
        // prédio do conjunto habitacional (a frente é o sul): andares, varandas, caixa d'água, cipó e árvore na laje
        map.houses.push({
          ...rect(o),
          h: (pr.altura || 14) * 100,
          floors: pr.andares || 5,
          wall: pr.cor || '#b8b2a6',
          tank: !!pr.caixaDagua,
          tower: true,
          balconies: !!pr.varandas,
          vine: typeof pr.cipo === 'number' ? pr.cipo : pr.cipo ? 0.5 : 0,
          roofTree: !!pr.arvoreNaLaje,
          moss: true,
          name: o.name || '',
        });
      } else if (k === 'banco') {
        // `material` ('concreto' no parque; sem ele, de madeira) e `mato`
        map.props.push({ kind: 'banco', ...rect(o), angle: pr.olhando, material: pr.material || 'madeira', weeds: !!pr.mato });
      } else if (k === 'mesa') {
        map.props.push({ kind: 'mesa', x, y, chairs: pr.cadeiras || 2 });
      } else if (k === 'fogueira') {
        map.props.push({ kind: 'fogueira', x, y, r: (pr.raio || 0.6) * 100, light: pr.luz || '#ffb347' });
      } else if (k === 'orelhao' || k === 'lixeira') {
        // `mato`: a lixeira verde do parque antigo, com mato em volta (sem ele, a laranja de rua)
        // (`poste`: o orelhão preso no poste de luz do lado, sem o cano dele)
        map.props.push({ kind: k, x, y, angle: pr.olhando, weeds: !!pr.mato, pole: !!pr.poste });
      } else if (k === 'bebedouro') {
        map.props.push({ kind: 'bebedouro', x, y, r: 24, broken: !!pr.quebrado, moss: !!pr.musgo });
      } else if (k === 'academia') {
        // aparelho da academia ao ar livre (caixa): `aparelho` ('simulador-caminhada', 'barra', 'remada'), `ferrugem`, `cipo`
        map.props.push({ kind: 'academia', ...rect(o), h: (pr.altura || 1.6) * 100, device: pr.aparelho || 'barra', rust: !!pr.ferrugem, vine: !!pr.cipo });
      } else if (k === 'carro') {
        map.props.push({ kind: 'carro', ...rect(o), h: (pr.altura || 1.4) * 100, color: pr.cor || '#a8473e', weeds: !!pr.mato, tree: !!pr.arvore });
      } else if (k === 'moto') {
        // moto enferrujada (o lado comprido é o comprimento; `olhando` = para onde a frente aponta)
        map.props.push({ kind: 'moto', ...rect(o), h: (pr.altura || 1.1) * 100, color: pr.cor || '#8a3a2a', weeds: !!pr.mato, angle: pr.olhando || 0 });
      } else if (k === 'cadeira') {
        map.props.push({ kind: 'cadeira', x, y, r: 25, angle: pr.olhando || 0, color: pr.cor || '#f2f2ee' });
      } else if (k === 'vaso') {
        map.props.push({ kind: 'vaso', x, y, r: 25, plant: pr.planta || 'espada-de-sao-jorge' });
      } else if (k === 'lixo') {
        map.props.push({ kind: 'lixo', ...rect(o), h: (pr.altura || 0.6) * 100 });
      } else if (k === 'placa-rua') {
        map.props.push({ kind: 'placa-rua', x, y, r: 10, text: pr.texto || '', text2: pr.texto2 || '' });
      } else if (k === 'bandeirinhas' && o.polyline) {
        map.bunting.push({ pts: o.polyline.map((p) => ({ x: (o.x + p.x) * CM, y: (o.y + p.y) * CM })), h: (pr.altura || 3) * 100 });
      } else if (k === 'gradil' || k === 'portao') {
        map.fences.push({ ...rect(o), h: (pr.altura || 1.8) * 100, hasH: pr.altura !== undefined, gate: k === 'portao', open: !!pr.aberto, broken: pr.estado === 'quebrado', name: o.name || '' });
      } else if (k === 'pilar') {
        map.pillars.push({ ...rect(o), h: (pr.altura || 2.4) * 100 });
      } else if (k === 'veu') {
        map.veils.push({ x, y, r: (pr.raio || 1.5) * 100, h: pr.coluna ? pr.coluna * 100 : null });
      } else if (k === 'bambu') {
        // moita de bambu (bloqueia): `raio` e `altura` em metros
        map.props.push({ kind: 'bambu', x, y, r: (pr.raio || 1.2) * 100, h: (pr.altura || 7) * 100 });
      } else if (k === 'planta') {
        // samambaia, helicônia, taboa e cogumelo (com `brilho`): enfeite, não bloqueia
        map.props.push({ kind: 'planta-' + (pr.tipo || 'samambaia'), x, y, r: (pr.raio || 0.5) * 100, glow: pr.brilho || null });
      } else if (k === 'trave') {
        // trave do campinho (caixa fina ao longo do gol): `olhando` = para onde a boca do gol dá (a rede fica atrás)
        const r0 = rect(o);
        const along = r0.y1 - r0.y0 >= r0.x1 - r0.x0;
        const back = ((pr.olhando || 0) + 180) % 360; // a rede vai para trás
        const bx = Math.round(Math.cos((back * Math.PI) / 180)), by = Math.round(Math.sin((back * Math.PI) / 180));
        const depth = 110;
        const f = { x0: r0.x0 + Math.min(0, bx * depth), x1: r0.x1 + Math.max(0, bx * depth), y0: r0.y0 + Math.min(0, by * depth), y1: r0.y1 + Math.max(0, by * depth) };
        map.props.push({ kind: 'trave', ...f, post: along ? { x: (r0.x0 + r0.x1) / 2, a: r0.y0, b: r0.y1 } : { y: (r0.y0 + r0.y1) / 2, a: r0.x0, b: r0.x1 }, along, back: { x: bx, y: by }, depth, h: (pr.altura || 2) * 100, rust: !!pr.ferrugem, vine: !!pr.cipo, net: pr.rede || 'inteira' });
      } else if (k === 'muro') {
        // muro em pedaços de até 4 m (cada pedaço é uma imagem): `grafite` ('cores') no `lado` (leste, sul...), `cipo`
        // (0 a 1), `musgo`; `whole` = o muro inteiro (o desenho do grafite continua de um pedaço para o outro)
        const whole = rect(o);
        for (const part of pieces(whole, 400)) map.props.push({ kind: 'muro', ...part, whole, h: (pr.altura || 2.2) * 100, color: pr.cor || '#c9c2b6', graffiti: pr.grafite || null, side: pr.lado || 'sul', vine: typeof pr.cipo === 'number' ? pr.cipo : pr.cipo ? 0.5 : 0, moss: !!pr.musgo });
      } else if (k === 'viaduto') {
        // o viaduto da linha lilás, em pedaços de 4 m: `altura` = embaixo do tabuleiro, `espessura`, `quebrado`
        // (o lado da ponta quebrada), `mato`, `cipo` (0 a 1) e `arvoresNoTopo`
        const whole = rect(o);
        for (const part of pieces(whole, 400)) map.props.push({ kind: 'viaduto', ...part, whole, z: (pr.altura || 8) * 100, thick: (pr.espessura || 1.4) * 100, broken: pr.quebrado || null, weeds: !!pr.mato, vine: typeof pr.cipo === 'number' ? pr.cipo : pr.cipo ? 0.5 : 0, trees: !!pr.arvoresNoTopo });
      } else if (k === 'pilar-viaduto') {
        map.props.push({ kind: 'pilar-viaduto', ...rect(o), h: (pr.altura || 8) * 100, pixo: !!pr.pixo, moss: !!pr.musgo, vine: typeof pr.cipo === 'number' ? pr.cipo : pr.cipo ? 0.5 : 0 });
      } else if (k === 'trem') {
        // o trem parado em cima do viaduto: `vagoes` (um objeto cada), `base` = a altura do trilho, `cor`, `cipo`,
        // `plantas` (no teto) e `janelasQuebradas`; a cabine fica na ponta leste
        const r0 = rect(o);
        const n = Math.max(1, pr.vagoes || 3);
        const along = r0.x1 - r0.x0 >= r0.y1 - r0.y0;
        for (let i = 0; i < n; i++) {
          const a0 = along ? r0.x0 + ((r0.x1 - r0.x0) * i) / n : r0.y0 + ((r0.y1 - r0.y0) * i) / n;
          const a1 = along ? r0.x0 + ((r0.x1 - r0.x0) * (i + 1)) / n : r0.y0 + ((r0.y1 - r0.y0) * (i + 1)) / n;
          const part = along ? { x0: a0, x1: a1, y0: r0.y0, y1: r0.y1 } : { x0: r0.x0, x1: r0.x1, y0: a0, y1: a1 };
          map.props.push({ kind: 'vagao', ...part, index: i, count: n, along, base: (pr.base || 0) * 100, h: (pr.altura || 2.6) * 100, color: pr.cor || '#7d5ca8', vine: !!pr.cipo, plants: !!pr.plantas, broken: !!pr.janelasQuebradas });
        }
      } else if (k === 'cipo') {
        // cipó pendurado (ponto): de `base` (altura em m) até `comprimento` m abaixo
        map.props.push({ kind: 'cipo', x, y, r: 5, top: (pr.base || 6) * 100, len: (pr.comprimento || 3) * 100 });
      } else if (k === 'onibus') {
        // ônibus velho em pedaços de até 6 m (a frente fica na ponta leste): `cor`, `mato`, `horta` (canteiros no teto)
        const whole = rect(o);
        for (const part of pieces(whole, 600)) map.props.push({ kind: 'onibus', ...part, whole, h: (pr.altura || 3) * 100, color: pr.cor || '#d7b14a', weeds: !!pr.mato, garden: !!pr.horta });
      } else if (k === 'barreira') {
        map.props.push({ kind: 'barreira', ...rect(o), h: (pr.altura || 1.1) * 100 });
      } else if (k === 'placa') {
        // placa de direção (ponto): `texto`, `seta` (norte, sul, leste, oeste) e `poste` (num poste; sem ele, no chão)
        // `tamanho: 'grande'` = a placa de madeira em dois postes da entrada do parque; `mato` = musgo e cipó
        const big = pr.tamanho === 'grande';
        // a grande tem 2,4 m de tábua ao longo de y: o pé dela no chão é a tábua inteira (com o pé de um ponto só, o
        // gradil que ela encosta passava na frente dela no desenho)
        const foot = big ? { x0: x - 7, x1: x + 16, y0: y - 120, y1: y + 120 } : {};
        map.props.push({ kind: 'placa', x, y, r: 14, ...foot, text: pr.texto || '', arrow: pr.seta || null, pole: !!pr.poste, big, weeds: !!pr.mato });
      } else if (k === 'deque' || k === 'pinguela') {
        // dá para andar em cima: o lado comprido diz a direção
        map.flats.push({ kind: k, ...rect(o), h: (pr.altura || 0.4) * 100 });
      }
    }
    // etapa 4c: a mureta da frente de cada pedaço do viaduto (outro objeto, desenhado depois do trem), o pedaço onde o
    // trem está (lá não nasce árvore) e a figueira que abraça o viaduto (as raízes vão no pedaço mais perto dela)
    const deck = map.props.filter((p) => p.kind === 'viaduto');
    const cars = map.props.filter((p) => p.kind === 'vagao');
    for (const p of deck) {
      p.train = cars.some((c) => c.x0 < p.x1 && c.x1 > p.x0 && c.y0 < p.y1 && c.y1 > p.y0);
      // na beira do mapa (leste) o tabuleiro segue mata adentro no desenho, em vez de terminar no ar
      if (p.piece === p.pieces - 1 && p.x1 >= map.w - 50) p.extend = 900;
      map.props.push({ ...p, kind: 'viaduto-mureta', y0: p.y1 - 18 });
    }
    for (const t of map.trees) {
      if (t.hugs !== 'viaduto' || !deck.length) continue;
      let best = null, bd = Infinity;
      for (const p of deck) {
        const dx = Math.max(p.x0 - t.x, 0, t.x - p.x1), dy = Math.max(p.y0 - t.y, 0, t.y - p.y1);
        const dd = Math.hypot(dx, dy);
        if (dd < bd) { bd = dd; best = p; }
      }
      if (best && bd < 800) best.hug = { x: t.x, y: t.y, trunk: t.trunk };
    }
    // casas com interior: a árvore de dentro (a casa abre o buraco da laje em volta dela), a geladeira de casa (a da
    // Budega é a de bebidas) e o gato deitado no sofá (na altura do assento)
    const within = (q, x, y) => x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1;
    for (const t of map.trees) {
      if (!t.inside) continue;
      const house = map.houses.find((q) => within(q, t.x, t.y));
      if (house) house.innerTree = t;
    }
    for (const p of map.props) {
      if (p.kind === 'geladeira') p.home = map.houses.some((q) => q.resident && within(q, (p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2));
      if (p.kind === 'gato') {
        const sofa = map.props.find((q) => q.kind === 'sofa' && within(q, p.x, p.y));
        p.perch = sofa ? (sofa.h || 90) * 0.5 : 0;
      }
    }
    // fiação: cada trecho da polilinha liga os dois postes mais perto das pontas (os fios saem das cruzetas)
    const poleNear = (q) => {
      let best = -1, bd = 160;
      map.poles.forEach((p, i) => {
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    };
    for (const { pts: line, vine } of wireLines) {
      for (let i = 0; i + 1 < line.length; i++) {
        const a = poleNear(line[i]);
        const b = poleNear(line[i + 1]);
        if (a >= 0 && b >= 0 && a !== b) map.wires.push([a, b, vine]);
      }
    }
    // portões e gradis herdam a altura do gradil vizinho quando não dizem a deles
    const fenceH = (map.fences.find((f) => !f.gate) || {}).h || 180;
    for (const f of map.fences) if (f.gate && !f.hasH) f.h = fenceH;

    for (const o of objs('colisao')) map.colliders.push({ type: 'box', ...rect(o), shots: props(o).bloqueiaTiro !== false });
    for (const o of objs('seguro')) map.safe.push({ ...rect(o), name: o.name || '' });
    for (const o of objs('areas')) {
      // clima da área (de 0 a 1): `escuro` e `neblina`; onde duas se cobrem, vale a menor (a mais de perto)
      const pr = props(o);
      const num = (v) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : null);
      map.areas.push({ ...rect(o), name: o.name || '', dark: num(pr.escuro), fog: num(pr.neblina) });
    }
    for (const o of objs('pontos')) if ((o.name || '') === 'spawn') map.spawn = { x: o.x * CM, y: o.y * CM };
    if (!map.spawn) map.spawn = { x: map.w / 2, y: map.h / 2 };
    return map;
  }

  PD.tmj = { toMap, CM };
})(window.PD = window.PD || {});
