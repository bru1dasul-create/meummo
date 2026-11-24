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
        // (`dentro`: a raiz que entrou numa casa; sai de baixo da parede e levanta o piso, street.js)
        map.shapes.push({ type: k, kind: 'line', pts, width: (pr.largura || 2) * 100, color: pr.cor, height: pr.altura != null ? pr.altura * 100 : null, dashed: !!pr.tracejada, faded: !!pr.apagada, gutter: !!pr.sarjeta, weeds: !!pr.mato, inside: !!pr.dentro });
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
        // (`folhas`: as folhas secas no piso da Budega; `capacho`: o degrau da porta com o capacho)
        map.shapes.push({ type: k, kind: 'rect', ...rect(o), color: pr.cor, pattern: pr.desenho, stripes: pr.listras, state: pr.estado || null, moss: !!pr.musgo, lines: !!pr.linhas, leaves: !!pr.folhas, mat: !!pr.capacho });
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
        map.trees.push({ x, y, kind: pr.especie || 'mata', r: (pr.copa || 2.5) * 100, h: (pr.altura || 5) * 100, trunk: ((pr.tronco || 0.35) * 100) / 2, name: o.name || '', breaks: !!pr.rompendo || !!pr.dentroDaCasa, hugs: pr.abraca || null, inside: !!pr.dentroDaCasa, flowers: pr.flores || null });
        // a paineira florida (floresta maior): as flores caídas fazem um tapete no chão em volta (rente ao chão, desenhado
        // antes de todo mundo, como o deque)
        if (pr.especie === 'paineira') map.flats.push({ kind: 'petalas', x, y, r: (pr.copa || 2.5) * 100 * 0.9, trunk: ((pr.tronco || 0.35) * 100) / 2, color: pr.flores || '#e58fb0' });
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
        // a Budega maior (budega.js): `nichos` (a cor do fundo dos nichos), `cipo`, `portas`, `vidro`, `pequena`, `faixa`
        map.props.push({ kind: k, ...r0, h: pr.altura != null ? pr.altura * 100 : null, angle: pr.olhando ?? 90, register: !!pr.caixa, stack: pr.pilha || 3, color: pr.cor || null, niches: pr.nichos || null, vine: !!pr.cipo, doors: pr.portas || 1, glass: !!pr.vidro, small: !!pr.pequena, stripe: pr.faixa || null });
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
      } else if ((k === 'poste' || k === 'poste-praca') && pr.estilo === 'lampiao') {
        // o lampião de poste de madeira do Refúgio (refugio.js)
        map.props.push({ kind: 'lampiao', x, y, r: 20, h: (pr.altura || 2.8) * 100, light: pr.luz || '#ffd36b' });
      } else if (k === 'poste' || k === 'poste-praca') {
        // `apagado` (vidro quebrado, sem luz), `torto` e `cipo` (os do parque antigo)
        map.props.push({ kind: 'poste-praca', x, y, h: (pr.altura || 3.8) * 100, light: pr.luz || '#ffe9a6', off: !!pr.apagado, bent: !!pr.torto, vine: !!pr.cipo });
      } else if (k === 'fiacao' && o.polyline) {
        // (`pipa`: uma pipa presa no fio do meio, com a cor dela)
        wireLines.push({ pts: o.polyline.map((p) => ({ x: (o.x + p.x) * CM, y: (o.y + p.y) * CM })), vine: !!pr.cipo, kite: pr.pipa || null });
      } else if (k === 'casa') {
        // casa da vila: a frente é o lado sul (+y), o que a câmera vê
        map.houses.push({
          ...rect(o),
          h: (pr.altura || 3) * 100,
          floors: pr.andares || 1,
          wall: pr.cor || '#c9a27a',
          block: !!pr.bloco,
          // tijolo baiano sem reboco (a comunidade da represa): `tijolo: true` a casa inteira, `'cima'` só os andares de
          // cima (o térreo rebocado e pintado); `vergalhao`: os ferros espetados na laje, esperando o próximo andar
          brick: pr.tijolo === 'cima' ? 'top' : pr.tijolo ? 'all' : null,
          rebar: !!pr.vergalhao,
          // o letreiro pintado na parede, desbotado (o clube náutico: `pintura: 'CLUBE NÁUTICO'`)
          paint: pr.pintura || null,
          // o prédio antigo (a Barragem de 1909): `estilo: 'historico'` (tijolo antigo, janelas em arco, cornija), `ano`
          // (no frontão) e `relogio` (a torre, com o relógio parado no lugar das janelas do andar de cima)
          historic: pr.estilo === 'historico',
          // outro estilo de fachada, desenhado fora do props.js (`estilo: 'escola'`, fundo.js), com a cor da `faixa`
          style: pr.estilo && pr.estilo !== 'historico' ? pr.estilo : null,
          band: pr.faixa || null,
          year: pr.ano || null,
          clock: !!pr.relogio,
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
          // a mata entrando: `cipoDentro` (0 a 1, o cipó nas paredes de dentro) e `musgoDentro` (casas.js)
          vineInside: typeof pr.cipoDentro === 'number' ? Math.max(0, Math.min(1, pr.cipoDentro)) : pr.cipoDentro ? 0.5 : 0,
          mossInside: !!pr.musgoDentro,
          // a lojinha do posto abandonado (floresta maior): vitrine (quebrada, com `vitrineQuebrada`) e porta de enrolar
          station: !!pr.posto,
          // a Budega maior (budega.js): `fachada: 'preta'`, a `moldura` amarela e o `led` branco
          facade: pr.fachada || null,
          frame: pr.moldura || null,
          led: !!pr.led,
          brokenWindow: !!pr.vitrineQuebrada,
          // o Refúgio (refugio.js): a casa de tábua (`material: 'tabua'`) com o telhado de duas águas (`telhado: 'zinco'`)
          material: pr.material || null,
          roofKind: pr.telhado || null,
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
        // (`dentro`: o vaso de dentro da loja, que só aparece com o herói lá dentro)
        map.props.push({ kind: 'vaso', x, y, r: 25, plant: pr.planta || 'espada-de-sao-jorge', inside: !!pr.dentro });
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
        // samambaia, helicônia, taboa e cogumelo (com `brilho`): enfeite, não bloqueia. Com `dentro`, é da casa em que
        // está (aparece com o herói lá dentro, como os móveis; world.js)
        map.props.push({ kind: 'planta-' + (pr.tipo || 'samambaia'), x, y, r: (pr.raio || 0.5) * 100, glow: pr.brilho || null, inside: !!pr.dentro });
      } else if (k === 'trave') {
        // trave do campinho (caixa fina ao longo do gol): `olhando` = para onde a boca do gol dá (a rede fica atrás)
        const r0 = rect(o);
        const along = r0.y1 - r0.y0 >= r0.x1 - r0.x0;
        const back = ((pr.olhando || 0) + 180) % 360; // a rede vai para trás
        const bx = Math.round(Math.cos((back * Math.PI) / 180)), by = Math.round(Math.sin((back * Math.PI) / 180));
        const depth = 110;
        const f = { x0: r0.x0 + Math.min(0, bx * depth), x1: r0.x1 + Math.max(0, bx * depth), y0: r0.y0 + Math.min(0, by * depth), y1: r0.y1 + Math.max(0, by * depth) };
        map.props.push({ kind: 'trave', ...f, post: along ? { x: (r0.x0 + r0.x1) / 2, a: r0.y0, b: r0.y1 } : { y: (r0.y0 + r0.y1) / 2, a: r0.x0, b: r0.x1 }, along, back: { x: bx, y: by }, depth, h: (pr.altura || 2) * 100, rust: !!pr.ferrugem, vine: !!pr.cipo, net: pr.rede || 'inteira' });
      } else if (k === 'lona') {
        // a lona de uma fileira de bancas da feira (fundo.js): `altura` atrás, `frente` (a altura da beira da frente),
        // `bancas` (quantas) e `cores` (a cor de cada uma, separadas por vírgula)
        map.props.push({ kind: 'lona', ...rect(o), h: (pr.altura || 2.6) * 100, hf: (pr.frente || 2.35) * 100, stalls: pr.bancas || 0, colors: pr.cores ? String(pr.cores).split(',') : null });
      } else if (k === 'banca-pastel') {
        map.props.push({ kind: 'banca-pastel', ...rect(o), h: (pr.altura || 0.9) * 100 });
      } else if (k === 'carrinho-feira') {
        // o carrinho de feira (ponto): `olhando` (graus) e `cor` (a sacola)
        map.props.push({ kind: 'carrinho-feira', x, y, r: 25, angle: pr.olhando || 0, color: pr.cor || null });
      } else if (k === 'ponte') {
        // uma mureta da ponte da Rua do Córrego (fundo.js): `altura`, `lado` ('leste' desenha também a lateral da laje
        // descendo `queda` m até a água) e `pixo`
        map.props.push({ kind: 'ponte', ...rect(o), h: (pr.altura || 1.05) * 100, side: pr.lado || 'oeste', drop: (pr.queda || 1.5) * 100, pixo: !!pr.pixo });
      } else if (k === 'sucata') {
        map.props.push({ kind: 'sucata', x, y, r: (pr.raio || 1) * 100 });
      } else if (k === 'corrimao') {
        map.props.push({ kind: 'corrimao', ...rect(o) });
      } else if (k === 'gatos' && o.polyline) {
        // os "gatos" (a fiação puxada de casa em casa, polilinha): `altura` dos fios e a `pipa` enroscada (a cor)
        const pts = o.polyline.map((q) => ({ x: (o.x + q.x) * CM, y: (o.y + q.y) * CM }));
        const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
        map.props.push({ kind: 'gatos', x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), pts, h: (pr.altura || 5) * 100, kite: pr.pipa || null });
      } else if (k === 'alambrado') {
        // o alambrado (a tela de arame nos postes de cano, a da quadra da escola do Capão maior; fundo.js), em pedaços de
        // até 4 m: `altura`, `estado: 'rasgado'` (a tela furada), `cipo` (0 a 1)
        const whole = rect(o);
        for (const part of pieces(whole, 400)) map.props.push({ kind: 'alambrado', ...part, whole, h: (pr.altura || 3) * 100, torn: pr.estado === 'rasgado', vine: typeof pr.cipo === 'number' ? pr.cipo : pr.cipo ? 0.5 : 0 });
      } else if (k === 'muro') {
        // muro em pedaços de até 4 m (cada pedaço é uma imagem): `grafite` ('cores') no `lado` (leste, sul...), `cipo`
        // (0 a 1), `musgo`; `whole` = o muro inteiro (o desenho do grafite continua de um pedaço para o outro)
        const whole = rect(o);
        for (const part of pieces(whole, 400)) map.props.push({ kind: 'muro', ...part, whole, h: (pr.altura || 2.2) * 100, color: pr.cor || '#c9c2b6', graffiti: pr.grafite || null, text: pr.texto || null, side: pr.lado || 'sul', vine: typeof pr.cipo === 'number' ? pr.cipo : pr.cipo ? 0.5 : 0, moss: !!pr.musgo });
      } else if (k === 'viaduto') {
        // o viaduto da linha lilás, em pedaços de 4 m: `altura` = embaixo do tabuleiro, `espessura`, `quebrado`
        // (o lado da ponta quebrada), `mato`, `cipo` (0 a 1) e `arvoresNoTopo`
        const whole = rect(o);
        for (const part of pieces(whole, 400)) map.props.push({ kind: 'viaduto', ...part, whole, z: (pr.altura || 8) * 100, thick: (pr.espessura || 1.4) * 100, broken: pr.quebrado || null, weeds: !!pr.mato, vine: typeof pr.cipo === 'number' ? pr.cipo : pr.cipo ? 0.5 : 0, trees: !!pr.arvoresNoTopo });
      } else if (k === 'estacao') {
        // a Estação Capão Redondo (Capão maior; fundo.js): o prédio de baixo do viaduto. `altura` = o chão da plataforma
        // (a do viaduto), `frente` = a altura do bloco da entrada, `plataforma` = a fundura do bloco de trás (m), `linha`
        // (a cor da faixa), `letreiro`, `cipo` (0 a 1), `musgo` e `pixo`
        map.props.push({ kind: 'estacao', ...rect(o), h: (pr.altura || 8) * 100, hf: (pr.frente || 6.5) * 100, back: (pr.plataforma || 3.6) * 100, line: pr.linha || '#8a63b8', sign: pr.letreiro || '', vine: typeof pr.cipo === 'number' ? pr.cipo : pr.cipo ? 0.5 : 0, moss: !!pr.musgo, pixo: !!pr.pixo, name: o.name || '' });
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
        map.props.push({ kind: 'placa', x, y, r: 14, ...foot, text: pr.texto || '', arrow: pr.seta || null, pole: !!pr.poste, big, weeds: !!pr.mato, crooked: !!pr.torta });
      } else if (k === 'deque' || k === 'pinguela') {
        // dá para andar em cima: o lado comprido diz a direção (`pedras`: a pinguela de pedras de atravessar)
        map.flats.push({ kind: k, ...rect(o), h: (pr.altura || 0.4) * 100, stones: !!pr.pedras });
      } else if (k === 'vitrine' || k === 'balcao-vidro' || k === 'freezer' || k === 'parede-verde' || k === 'caixote') {
        // a Budega maior (budega.js): a `vitrine` (`fundo`, `frente`), o balcão de vidro (`doces`), o freezer, a parede de
        // grama (`logo`, `neon`, `flores`) e os caixotes da calçada (`fruta`)
        map.props.push({ kind: k, ...rect(o), h: pr.altura != null ? pr.altura * 100 : null, angle: pr.olhando ?? 90, back: pr.fundo || null, front: !!pr.frente, sweets: pr.doces !== false, logo: pr.logo || null, neon: !!pr.neon, flowers: pr.flores || null, fruit: pr.fruta || null });
      } else if (k === 'ventilador') {
        // o ventilador de parede (ponto na parede): `altura`, `dentro`
        map.props.push({ kind: 'ventilador', x, y, r: 30, h: (pr.altura || 2.5) * 100, inside: !!pr.dentro });
      } else if (k === 'lousa') {
        // a lousinha de cavalete da calçada
        map.props.push({ kind: 'lousa', x, y, r: 30, angle: pr.olhando ?? 90 });
      } else if (k === 'parquinho') {
        // o parquinho antigo (floresta maior; sul.js): `brinquedo` ('balanco', 'escorregador', 'gira-gira'), `ferrugem`,
        // `cipo`, `quebrado` (o balanço com uma corrente arrebentada), `plantas` (o gira-gira com mato no meio), `olhando`
        const toy = pr.brinquedo || 'balanco';
        const shape = toy === 'gira-gira' ? { x, y, r: (pr.raio || 0.8) * 100 } : rect(o);
        map.props.push({ kind: 'parquinho', toy, ...shape, h: (pr.altura || 2) * 100, rust: !!pr.ferrugem, vine: !!pr.cipo, broken: !!pr.quebrado, plants: !!pr.plantas, angle: pr.olhando ?? 90 });
      } else if (k === 'cachoeira') {
        // a cachoeirinha (sul.js): as pedras com musgo e a água caindo para o lado `queda` (por enquanto só 'sul');
        // `estilo` 'comporta' (a barragem): o muro de pedra com a boca em arco e o tanque de `tanque` m
        map.props.push({ kind: 'cachoeira', ...rect(o), h: (pr.altura || 1.6) * 100, fall: pr.queda || 'sul', moss: !!pr.musgo, style: pr.estilo || null, basin: (pr.tanque || 3) * 100 });
      } else if (k === 'torre-mirante') {
        // a torre de observação do mirante (sul.js): a caixa é a torre com a escada do lado sul (`escada`, m); `altura`
        // é a do andar de cima (m)
        map.props.push({ kind: 'torre-mirante', ...rect(o), h: (pr.altura || 6.2) * 100, stair: (pr.escada || 1) * 100 });
      } else if (k === 'guarda-corpo') {
        // o guarda-corpo de madeira (sul.js): uma caixa fina, ao longo do lado comprido; `altura`
        map.props.push({ kind: 'guarda-corpo', ...rect(o), h: (pr.altura || 0.95) * 100 });
      } else if (k === 'luneta') {
        // a luneta de moedas do mirante (sul.js): `olhando` (graus, 0 = leste)
        map.props.push({ kind: 'luneta', x, y, r: 20, angle: pr.olhando ?? 0 });
      } else if (k === 'painel-mirante') {
        // o painel com o mapa da represa e as aves (sul.js), virado para o sul
        map.props.push({ kind: 'painel-mirante', ...rect(o) });
      } else if (k === 'caverna') {
        // a Caverna Sagrada (sul.js): o morro de pedra (a caixa) com a boca no lado sul: `boca` (largura, m), `bocaX` (o
        // meio dela, m; sem ele, o meio da caixa), `bocaAltura` (m), `altura` (do morro, m), `brilho` (a luz lá dentro),
        // `inscricoes`, `pinturas`, `raizes` e `arvore` (a arvorezinha no alto; todos ligados se não disser nada)
        const r0 = rect(o);
        const mx = pr.bocaX != null ? pr.bocaX * 100 : (r0.x0 + r0.x1) / 2;
        map.props.push({ kind: 'caverna', ...r0, x: (r0.x0 + r0.x1) / 2, y: (r0.y0 + r0.y1) / 2, h: (pr.altura || 5) * 100, mouth: { x: mx, w: (pr.boca || 3.2) * 100, hm: (pr.bocaAltura || 2.5) * 100 }, glow: pr.brilho || '#3fd6c8', glyphs: pr.inscricoes !== false, paint: pr.pinturas !== false, roots: pr.raizes !== false, tree: pr.arvore !== false });
      } else if (k === 'rocha') {
        // a pedra solta da caverna (sul.js): `raio`, `altura` (m) e `musgo`
        map.props.push({ kind: 'rocha', x, y, r: (pr.raio || 1) * 100, h: (pr.altura || 1.4) * 100, moss: pr.musgo !== false });
      } else if (k === 'oferenda') {
        // a pedra chata com as velas acesas, a cuia, a cabaça e as flores (sul.js): `velas`
        map.props.push({ kind: 'oferenda', x, y, r: 40, candles: pr.velas || 4 });
      } else if (k === 'brasas') {
        // a fogueira apagada da caverna, com brasas e o fiozinho de fumaça (sul.js): `raio` da roda de pedras
        map.props.push({ kind: 'brasas', x, y, r: (pr.raio || 0.7) * 100 });
      } else if (k === 'esteio') {
        // o tronco fincado com a cabaça, as penas e as fitas no vento (sul.js): `altura`, `fitas`
        map.props.push({ kind: 'esteio', x, y, r: 12, h: (pr.altura || 2.2) * 100, ribbons: pr.fitas !== false });
      } else if (k === 'menir') {
        // a pedra em pé da roda da Ilha do Véu (sul.js): `altura` e `largura` (m), `olhando` (para onde olha a face larga,
        // em graus) e `glifo` (a itacoatiara gravada nela: espiral, sol, circulos ou cobra)
        map.props.push({ kind: 'menir', x, y, r: ((pr.largura || 0.9) / 2) * 100, h: (pr.altura || 2.2) * 100, face: pr.olhando || 0, glyph: pr.glifo || 'espiral' });
      } else if (k === 'bola') {
        // a bola de futebol esquecida no campinho (sul.js)
        map.props.push({ kind: 'bola', x, y, r: 12 });
      } else if (k === 'cortina-veu') {
        // o Véu da ilha (sul.js): a cortina de raízes que brilham, de frente para a câmera; `largura` e `altura` (m)
        map.props.push({ kind: 'cortina-veu', x, y, r: 60, w: (pr.largura || 4) * 100, h: (pr.altura || 6) * 100 });
      } else if (k === 'coreto') {
        // o coreto da praça em ruínas (sul.js): a base octogonal de `raio` m no meio da caixa, a `altura` da base, a
        // escada do lado sul (`escada: false`, sem), `ruina` (o reboco caído, a pichação, o gradil arrancado, o buraco
        // no telhado) e `cipo` (0 a 1). A caixa do desenho é a da base com a escada (a colisão vem do mapa)
        const r0 = rect(o);
        const cx = (r0.x0 + r0.x1) / 2, cy = (r0.y0 + r0.y1) / 2;
        const R = (pr.raio || 4.4) * 100, Rf = R * Math.cos(Math.PI / 8);
        const stairs = pr.escada !== false;
        map.props.push({ kind: 'coreto', x: cx, y: cy, r: R, x0: cx - Rf, x1: cx + Rf, y0: cy - Rf, y1: cy + Rf + (stairs ? 128 : 0), h: (pr.altura || 0.95) * 100, stairs, ruin: !!pr.ruina, vine: typeof pr.cipo === 'number' ? pr.cipo : pr.cipo ? 0.5 : 0 });
      } else if (k === 'cobertura') {
        // a cobertura do posto abandonado (sul.js): a laje no alto (por cima de quem está embaixo, fica transparente com
        // o herói embaixo ou atrás) e os 4 pilares (objetos à parte, para cada um ficar na frente ou atrás do herói)
        const r0 = rect(o);
        const h = (pr.altura || 4.2) * 100;
        const pw = (pr.pilares || 0.4) * 100;
        const vine = typeof pr.cipo === 'number' ? pr.cipo : pr.cipo ? 0.5 : 0;
        map.props.push({ kind: 'cobertura', ...r0, h, weeds: !!pr.mato, vine, trees: !!pr.arvoresNoTopo });
        // (o meio de cada pilar a 0,6 m das beiradas, como as caixas de colisão `pilar-cobertura` do mapa)
        const ix = Math.min(60, (r0.x1 - r0.x0) * 0.2), iy = Math.min(60, (r0.y1 - r0.y0) * 0.2);
        for (const px of [r0.x0 + ix, r0.x1 - ix]) {
          for (const py of [r0.y0 + iy, r0.y1 - iy]) {
            // (`faixa`: a cor da barra de baixo dos pilares; sem ela, o vermelho do posto. O clube náutico usa o azul)
            map.props.push({ kind: 'pilar-cobertura', x0: px - pw / 2, x1: px + pw / 2, y0: py - pw / 2, y1: py + pw / 2, x: px, y: py, h, vine, band: pr.faixa || null });
          }
        }
      } else if (k === 'bomba') {
        // bomba de combustível velha, sem marca (sul.js): `olhando` (para onde o visor dá), `ferrugem`, `plantas`
        map.props.push({ kind: 'bomba', ...rect(o), h: (pr.altura || 1.6) * 100, angle: pr.olhando || 0, rust: !!pr.ferrugem, plants: !!pr.plantas });
      } else if (k === 'barco') {
        // o Refúgio (refugio.js): `tipo` ('canoa', 'voadeira'), `cor`, `olhando` (para onde a proa aponta), `afundado`
        map.props.push({ kind: 'barco', ...rect(o), boat: pr.tipo || 'canoa', color: pr.cor || null, angle: pr.olhando || 0, sunk: !!pr.afundado });
      } else if (k === 'banca-frutas') {
        // a banca de frutas em U da quitanda (refugio.js): `frente` e `lados` (m) e `pano` (a cor do pano listrado)
        // (`mercadoria`: 'frutas', 'peixe' — os pescadores do Brejo Maior — ou 'artesanato': cestos, potes e colares)
        map.props.push({ kind: k, ...rect(o), h: (pr.altura || 0.9) * 100, front: (pr.frente || 0.5) * 100, side: (pr.lados || 0.3) * 100, cloth: pr.pano ? [pr.pano, '#fff4dc'] : null, goods: pr.mercadoria || 'frutas' });
      } else if (k === 'barril' || k === 'rede' || k === 'varal' || k === 'ponto-onibus') {
        // o barril (bombona, tambor ou de madeira, sorteado), a rede de pesca secando e o ponto de ônibus (`placa`)
        map.props.push({ kind: k, ...rect(o), h: pr.altura != null ? pr.altura * 100 : null, color: pr.cor || null, sign: pr.placa || '' });
      } else if (k === 'pneus') {
        // pilha de pneus velhos (sul.js): `raio` e `pilha` (quantos)
        map.props.push({ kind: 'pneus', x, y, r: (pr.raio || 0.5) * 100, count: pr.pilha || 3 });
      } else if (k === 'trampolim') {
        // o clube náutico (refugio.js): o trampolim da piscina; `lado` = para onde a prancha avança (por cima da água)
        map.props.push({ kind: k, ...rect(o), side: pr.lado || 'oeste' });
      } else if (k === 'guincho-comporta') {
        // o guincho da comporta em cima do muro da barragem (refugio.js): os dois pilares, a viga e o volante
        map.props.push({ kind: k, ...rect(o), h: (pr.altura || 3.2) * 100 });
      } else if (k === 'engrenagem') {
        // a engrenagem velha largada no chão, meio enterrada (refugio.js): `raio`
        map.props.push({ kind: k, x, y, r: (pr.raio || 0.9) * 100 });
      } else if (k === 'escada-piscina' || k === 'mastro') {
        // a escadinha de inox da piscina (`olhando`: para onde ela desce) e o mastro com a bandeira rasgada (`altura`, `cor`)
        map.props.push({ kind: k, x, y, r: 25, h: pr.altura != null ? pr.altura * 100 : null, color: pr.cor || null, angle: pr.olhando ?? 90 });
      }
    }
    // etapa 4c: a mureta da frente de cada pedaço do viaduto (outro objeto, desenhado depois do trem), o pedaço onde o
    // trem está (lá não nasce árvore) e a figueira que abraça o viaduto (as raízes vão no pedaço mais perto dela)
    const deck = map.props.filter((p) => p.kind === 'viaduto');
    const cars = map.props.filter((p) => p.kind === 'vagao');
    // (na estação, a plataforma encosta nos trilhos: lá o tabuleiro fica sem a mureta da frente e sem árvore no leito)
    const stations = map.props.filter((p) => p.kind === 'estacao');
    for (const p of deck) {
      p.train = cars.some((c) => c.x0 < p.x1 && c.x1 > p.x0 && c.y0 < p.y1 && c.y1 > p.y0);
      p.station = stations.some((s) => p.x1 > s.x0 + 50 && p.x0 < s.x1 - 50 && s.y0 - p.y1 < 150);
      // na beira do mapa (leste) o tabuleiro segue mata adentro no desenho, em vez de terminar no ar
      if (p.piece === p.pieces - 1 && p.x1 >= map.w - 50) p.extend = 900;
      if (!p.station) map.props.push({ ...p, kind: 'viaduto-mureta', y0: p.y1 - 18 });
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
      // o orelhão preso no poste de luz (`poste`): o poste mais perto (até 1,5 m), para os braços irem até ele
      if (p.kind === 'orelhao' && p.pole) {
        let best = null, bd = 150;
        for (const q of map.props) {
          if (q.kind !== 'poste-praca') continue;
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < bd) { bd = d; best = q; }
        }
        if (best) p.poleAt = { x: best.x, y: best.y };
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
    for (const { pts: line, vine, kite } of wireLines) {
      for (let i = 0; i + 1 < line.length; i++) {
        const a = poleNear(line[i]);
        const b = poleNear(line[i + 1]);
        if (a >= 0 && b >= 0 && a !== b) map.wires.push([a, b, vine, kite]);
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
    // os galhos baixos dos saguis (`galho-sagui`, 23/11, pedido da [arte]): o ponto no chão embaixo do meio do galho, a
    // `altura` (m) e a `direcao` (graus, do tronco para a ponta); o galho é desenhado na árvore mais perto (props.js)
    for (const o of objs('pontos')) {
      if (kindOf(o) !== 'galho-sagui') continue;
      const pr = props(o);
      const p = { x: o.x * CM, y: o.y * CM, h: (pr.altura || 2.2) * 100, dir: pr.direcao || 0 };
      // (24/11: a distância conta da beira do tronco, não do meio — o galho do Sagui Ancestral, na Figueira do Viaduto,
      // fica a 2,1 m do meio do tronco grosso e sumia. E a árvore do galho é a que fica atrás do ponto, na `direcao`:
      // se outra árvore estiver mais perto, mas para o lado, o galho não vai para ela)
      let best = null, bd = Infinity;
      for (const t of map.trees) {
        const dx = p.x - t.x, dy = p.y - t.y;
        const dd = Math.hypot(dx, dy) - (t.trunk || 0);
        if (dd > 200) continue;
        const off = Math.abs(((((Math.atan2(dy, dx) * 180) / Math.PI - p.dir) % 360) + 540) % 360 - 180);
        const score = dd + (off > 20 ? 1000 : 0);
        if (score < bd) {
          bd = score;
          best = t;
        }
      }
      if (best) (best.perches || (best.perches = [])).push(p);
    }
    if (!map.spawn) map.spawn = { x: map.w / 2, y: map.h / 2 };
    return map;
  }

  PD.tmj = { toMap, CM };
})(window.PD = window.PD || {});
