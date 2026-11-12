// Leitor dos mapas do mundo novo (Tiled, formato combinado com o [mundo] e a [estrutura]; veja docs/ARQUITETURA.md,
// "Mapas do mundo novo"): 1 tile = 1 metro, tile de 32 px, tudo em camadas de objetos. Transforma o .tmj no mapa que
// o mundo do protótipo desenha (medidas em centímetros, x desce para a direita na tela e y desce para a esquerda —
// as mesmas direções do Tiled visto de cima).
//  - "chao": áreas do chão, na ordem de desenho (mata, grama, terra, asfalto, trilha em polilinha com `largura`,
//    `circulo` com `brilho`);
//  - "cenario": árvores (`especie`, `copa`, `altura`, `tronco`, em metros), arbusto, pedra, poste, gradil, portão,
//    pilar e `veu` (pontos do Véu Ancestral);
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
      colliders: [],
      safe: [],
      areas: [],
      spawn: null,
      awakening: null,
      // o que o mapa da esquina de São Paulo tinha e este não tem
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
        map.shapes.push({ type: k, kind: 'line', pts, width: (pr.largura || 2) * 100 });
      } else if (o.ellipse) {
        const r = rect(o);
        const s = { type: k, kind: 'ellipse', cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2, rx: (r.x1 - r.x0) / 2, ry: (r.y1 - r.y0) / 2 };
        map.shapes.push(s);
        if (k === 'circulo') map.awakening = { x: s.cx, y: s.cy, r: Math.min(s.rx, s.ry), color: pr.brilho || '#3fd6c8' };
      } else if (o.polygon) {
        const pts = o.polygon.map((p) => ({ x: (o.x + p.x) * CM, y: (o.y + p.y) * CM }));
        map.shapes.push({ type: k, kind: 'poly', pts });
      } else {
        map.shapes.push({ type: k, kind: 'rect', ...rect(o) });
      }
    }

    for (const o of objs('cenario')) {
      const k = kindOf(o);
      const pr = props(o);
      const x = o.x * CM;
      const y = o.y * CM;
      if (k === 'arvore') {
        map.trees.push({ x, y, kind: pr.especie || 'mata', r: (pr.copa || 2.5) * 100, h: (pr.altura || 5) * 100, trunk: ((pr.tronco || 0.35) * 100) / 2, name: o.name || '' });
      } else if (k === 'arbusto') {
        map.props.push({ kind: 'arbusto', x, y, r: (pr.raio || 0.8) * 100, dense: !!pr.fechado, wild: true });
      } else if (k === 'pedra') {
        map.props.push({ kind: 'pedra', x, y, r: (pr.raio || 0.4) * 100 });
      } else if (k === 'poste') {
        map.props.push({ kind: 'poste-praca', x, y, h: (pr.altura || 3.8) * 100, light: pr.luz || '#ffe9a6' });
      } else if (k === 'gradil' || k === 'portao') {
        map.fences.push({ ...rect(o), h: (pr.altura || 1.8) * 100, hasH: pr.altura !== undefined, gate: k === 'portao', open: !!pr.aberto, broken: pr.estado === 'quebrado', name: o.name || '' });
      } else if (k === 'pilar') {
        map.pillars.push({ ...rect(o), h: (pr.altura || 2.4) * 100 });
      } else if (k === 'veu') {
        map.veils.push({ x, y, r: (pr.raio || 1.5) * 100 });
      }
    }
    // portões e gradis herdam a altura do gradil vizinho quando não dizem a deles
    const fenceH = (map.fences.find((f) => !f.gate) || {}).h || 180;
    for (const f of map.fences) if (f.gate && !f.hasH) f.h = fenceH;

    for (const o of objs('colisao')) map.colliders.push({ type: 'box', ...rect(o), shots: props(o).bloqueiaTiro !== false });
    for (const o of objs('seguro')) map.safe.push({ ...rect(o), name: o.name || '' });
    for (const o of objs('areas')) map.areas.push({ ...rect(o), name: o.name || '' });
    for (const o of objs('pontos')) if ((o.name || '') === 'spawn') map.spawn = { x: o.x * CM, y: o.y * CM };
    if (!map.spawn) map.spawn = { x: map.w / 2, y: map.h / 2 };
    return map;
  }

  PD.tmj = { toMap, CM };
})(window.PD = window.PD || {});
