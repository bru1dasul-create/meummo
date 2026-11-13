// Leitor dos mapas do mundo novo (Tiled, formato combinado com o [mundo] e a [estrutura]; veja docs/ARQUITETURA.md,
// "Mapas do mundo novo"): 1 tile = 1 metro, tile de 32 px, tudo em camadas de objetos. Transforma o .tmj no mapa que
// o mundo do protótipo desenha (medidas em centímetros, x desce para a direita na tela e y desce para a esquerda —
// as mesmas direções do Tiled visto de cima).
//  - "chao": áreas do chão, na ordem de desenho (mata, grama, terra, asfalto, trilha em polilinha com `largura`, `cor`
//    opcional, como a da água do lago,
//    `circulo` com `brilho`);
//  - "cenario": árvores (`especie`, `copa` = raio, `altura`, `tronco` = diâmetro, em metros), arbusto, pedra, poste
//    (alto = de concreto, com `fiacao`), poste-praca, gradil, portão, pilar, `veu`, tronco-caido, aguape, capivara e a
//    vila: casa (frente ao sul), banco, mesa, fogueira, orelhao, lixeira e carro;
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
    };

    for (const o of objs('chao')) {
      const k = kindOf(o);
      const pr = props(o);
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
        map.shapes.push({ type: k, kind: 'poly', pts, color: pr.cor });
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
        map.trees.push({ x, y, kind: pr.especie || 'mata', r: (pr.copa || 2.5) * 100, h: (pr.altura || 5) * 100, trunk: ((pr.tronco || 0.35) * 100) / 2, name: o.name || '', breaks: !!pr.rompendo });
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
      } else if (k === 'poste' || k === 'poste-praca') {
        map.props.push({ kind: 'poste-praca', x, y, h: (pr.altura || 3.8) * 100, light: pr.luz || '#ffe9a6' });
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
        map.props.push({ kind: 'banco', ...rect(o), angle: pr.olhando });
      } else if (k === 'mesa') {
        map.props.push({ kind: 'mesa', x, y, chairs: pr.cadeiras || 2 });
      } else if (k === 'fogueira') {
        map.props.push({ kind: 'fogueira', x, y, r: (pr.raio || 0.6) * 100, light: pr.luz || '#ffb347' });
      } else if (k === 'orelhao' || k === 'lixeira') {
        map.props.push({ kind: k, x, y, angle: pr.olhando });
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
      } else if (k === 'deque' || k === 'pinguela') {
        // dá para andar em cima: o lado comprido diz a direção
        map.flats.push({ kind: k, ...rect(o), h: (pr.altura || 0.4) * 100 });
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
