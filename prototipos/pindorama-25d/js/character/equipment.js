// Arquitetura de equipamentos (preparada, ainda SEM itens — o personagem começa sem classe e sem nada).
//
// Ideia: um equipamento é um grupo de esferas presas a um OSSO do mesmo esqueleto do corpo. Como o desenho
// é o casco dessas esferas visto pela câmera, a peça acompanha qualquer animação e qualquer direção sem
// deformar — exatamente como o braço ou a cabeça. A peça é desenhada logo depois da parte do corpo que
// ela veste (mesma ordem de profundidade), com contorno de tinta, sombra e brilho iguais aos do corpo.
//
// Encaixes (slots): cabeca (capacete), tronco (armadura), pernas (calça), pes (botas), maoD / maoE (armas)
// e acessorios. Ossos disponíveis e o formato das esferas em cada um:
//   - 'cabeca', 'peito', 'pelve'           → { p: [x, y, z], r }   (x = direita, y = frente, z = cima)
//   - 'braco', 'antebraco', 'coxa', 'canela' → { t, f, o, r }     (t = fração do osso, f = frente, o = fora)
//   - 'mao'                                 → { a, d, s, r }      (a = ao longo, d = costas da mão, s = polegar)
//   - 'pe'                                  → { s, f, u, r }      (s = lado de dentro, f = frente, u = cima)
// Peças de membro valem para os dois lados (`lado: 'ambos'`) ou só um ('E' / 'D'); o lado esquerdo é
// espelhado sozinho.
//
// Validação (`define` recusa o item com a lista de problemas; `validate(item)` só lista): encaixe e osso existentes,
// osso permitido para o encaixe (SLOT_BONES: um capacete só na cabeça, uma bota na canela e no pé, uma arma na mão e
// no antebraço), campos de cada esfera com números e raio > 0, lado válido (e só o da mão, nos itens de mão), cores
// em #rrggbb, partes escondidas que existem. `canEquip` / `personagem.equip` conferem também se o item é do encaixe
// pedido e se a classe do personagem pode usar. Opcionais: `ocupa: ['maoD', 'maoE']` (item de duas mãos: veste nos
// dois e tira o que estava neles), `classes: ['...']` (só essas classes), `esconde: ['franja', ...]`.
//
// Exemplo (não está ligado; é só o formato) — uma bota de couro:
//   PD.equipment.define({
//     id: 'bota-couro', slot: 'pes', nome: 'Bota de couro',
//     material: { base: '#6b4a2f', shade: '#47301d', light: '#8f6844' },
//     pecas: [
//       { osso: 'canela', lado: 'ambos', esferas: [{ t: 0.62, f: 0, o: 0, r: 4.9 }, { t: 1, f: 0, o: 0, r: 4.3 }] },
//       { osso: 'pe', lado: 'ambos', esferas: [{ s: 0, f: -3.8, u: -2.6, r: 4 }, { s: 0, f: 5, u: -1.2, r: 4.1 }, { s: 0.3, f: 15.6, u: -3.4, r: 3.2 }] },
//     ],
//   });
//   personagem.equip('pes', 'bota-couro');
(function (PD) {
  'use strict';
  const M = PD.math;
  const { limbAt } = PD.rig;
  const SLOTS = PD.MODEL.SLOTS;
  const catalog = new Map();

  // formato das esferas em cada osso (os campos que cada uma precisa ter)
  const BONE_FIELDS = {
    cabeca: ['p', 'r'],
    peito: ['p', 'r'],
    pelve: ['p', 'r'],
    braco: ['t', 'f', 'o', 'r'],
    antebraco: ['t', 'f', 'o', 'r'],
    coxa: ['t', 'f', 'o', 'r'],
    canela: ['t', 'f', 'o', 'r'],
    mao: ['a', 'd', 's', 'r'],
    pe: ['s', 'f', 'u', 'r'],
  };
  const BONES = Object.keys(BONE_FIELDS);
  // ossos em que cada encaixe pode prender peças (um capacete não vai no pé; uma bota não vai na cabeça)
  const SLOT_BONES = {
    cabeca: ['cabeca'],
    tronco: ['peito', 'pelve', 'braco', 'antebraco'],
    pernas: ['pelve', 'coxa', 'canela'],
    pes: ['canela', 'pe'],
    maoD: ['mao', 'antebraco'],
    maoE: ['mao', 'antebraco'],
    acessorios: BONES,
  };
  const SIDES = ['E', 'D', 'ambos'];
  const SINGLE = ['cabeca', 'peito', 'pelve']; // ossos que não têm lado
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const isColor = (c) => typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);
  const isMaterial = (m) => m && isColor(m.base) && isColor(m.shade) && (m.light === undefined || isColor(m.light));

  /**
   * Confere um item inteiro e devolve a lista de problemas (vazia = válido). Antes só o id e o encaixe eram
   * conferidos: um osso errado só dava erro na hora de desenhar, uma esfera sem raio sumia e um capacete podia ser
   * definido no encaixe dos pés.
   */
  function validate(item) {
    const err = [];
    if (!item || typeof item !== 'object') return ['o item precisa ser um objeto'];
    if (typeof item.id !== 'string' || !item.id) err.push('falta o id (texto)');
    if (!SLOTS.includes(item.slot)) err.push(`encaixe "${item.slot}" não existe (use: ${SLOTS.join(', ')})`);
    if (item.ocupa !== undefined) {
      if (!Array.isArray(item.ocupa) || !item.ocupa.every((x) => SLOTS.includes(x))) err.push('"ocupa" tem que ser uma lista de encaixes');
      else if (!item.ocupa.includes(item.slot)) err.push('"ocupa" tem que incluir o próprio encaixe do item');
    }
    if (item.material !== undefined && !isMaterial(item.material)) err.push('material inválido (precisa de base e shade em #rrggbb)');
    if (item.esconde !== undefined) {
      if (!Array.isArray(item.esconde)) err.push('"esconde" tem que ser uma lista');
      else for (const h of item.esconde) if (!PD.MODEL.PARTS.includes(h)) err.push(`"esconde": a parte "${h}" não existe`);
    }
    if (item.classes !== undefined && !(Array.isArray(item.classes) && item.classes.every((c) => typeof c === 'string'))) err.push('"classes" tem que ser uma lista de ids de classe');
    if (!Array.isArray(item.pecas) || !item.pecas.length) {
      err.push('o item precisa de pelo menos uma peça em "pecas"');
      return err;
    }
    item.pecas.forEach((pc, k) => {
      const at = `peça ${k + 1}`;
      if (!BONES.includes(pc.osso)) {
        err.push(`${at}: osso "${pc.osso}" não existe (use: ${BONES.join(', ')})`);
        return;
      }
      const allowed = SLOT_BONES[item.slot];
      if (allowed && !allowed.includes(pc.osso)) err.push(`${at}: o encaixe "${item.slot}" não prende peças no osso "${pc.osso}" (pode: ${allowed.join(', ')})`);
      if (pc.lado !== undefined && !SIDES.includes(pc.lado)) err.push(`${at}: lado "${pc.lado}" não existe (use E, D ou ambos)`);
      if (pc.lado !== undefined && SINGLE.includes(pc.osso)) err.push(`${at}: o osso "${pc.osso}" não tem lado`);
      if (item.slot === 'maoD' && pc.lado && pc.lado !== 'D') err.push(`${at}: item da mão direita com peça do lado "${pc.lado}"`);
      if (item.slot === 'maoE' && pc.lado && pc.lado !== 'E') err.push(`${at}: item da mão esquerda com peça do lado "${pc.lado}"`);
      if (pc.material !== undefined && !isMaterial(pc.material)) err.push(`${at}: material inválido`);
      if (pc.material === undefined && item.material === undefined) err.push(`${at}: sem material (nem no item, nem na peça)`);
      if (!Array.isArray(pc.esferas) || !pc.esferas.length) {
        err.push(`${at}: precisa de pelo menos uma esfera`);
        return;
      }
      const fields = BONE_FIELDS[pc.osso];
      pc.esferas.forEach((e, j) => {
        for (const f of fields) {
          if (f === 'p') {
            if (!Array.isArray(e.p) || e.p.length !== 3 || !e.p.every(isNum)) err.push(`${at}, esfera ${j + 1}: "p" tem que ser [x, y, z]`);
          } else if (!isNum(e[f])) err.push(`${at}, esfera ${j + 1}: falta "${f}" (número)`);
        }
        if (isNum(e.r) && e.r <= 0) err.push(`${at}, esfera ${j + 1}: o raio tem que ser maior que zero`);
        if (isNum(e.t) && (e.t < -0.2 || e.t > 1.2)) err.push(`${at}, esfera ${j + 1}: "t" (fração do osso) fora de -0,2..1,2`);
      });
    });
    return err;
  }

  function define(item) {
    const err = validate(item);
    if (err.length) throw new Error(`equipamento "${item && item.id}" inválido:\n - ` + err.join('\n - '));
    if (catalog.has(item.id)) console.warn(`equipamento "${item.id}" redefinido (o anterior foi substituído)`);
    catalog.set(item.id, item);
    return item;
  }

  /**
   * Pode vestir? Confere se o item existe, se é daquele encaixe, se a classe do personagem pode usar e se a classe
   * libera o encaixe. Devolve { ok, motivo }.
   */
  function canEquip(character, slot, id) {
    const item = catalog.get(id);
    if (!item) return { ok: false, motivo: `item "${id}" não existe` };
    if (!SLOTS.includes(slot)) return { ok: false, motivo: `encaixe "${slot}" não existe` };
    if (item.slot !== slot) return { ok: false, motivo: `"${id}" é do encaixe "${item.slot}", não de "${slot}"` };
    const cls = character && character.classe && PD.classes ? PD.classes.get(character.classe) : null;
    if (cls && cls.encaixes && !(item.ocupa || [slot]).every((s) => cls.encaixes.includes(s))) return { ok: false, motivo: `a classe "${cls.id}" não usa o encaixe "${slot}"` };
    if (item.classes && cls && !item.classes.includes(cls.id)) return { ok: false, motivo: `"${id}" não é da classe "${cls.id}"` };
    return { ok: true, motivo: '' };
  }

  /** Ponto de uma esfera da peça no mundo, preso ao osso certo do esqueleto. */
  function spherePoint(rig, bone, i, s, hs) {
    const side = i === 0 ? -1 : 1;
    switch (bone) {
      case 'cabeca': {
        const h = rig.head;
        return { p: M.at({ o: h.o, r: M.scale(h.r, hs), f: M.scale(h.f, hs), u: M.scale(h.u, hs) }, s.p[0], s.p[1], s.p[2]), r: s.r * hs };
      }
      case 'peito':
        return { p: M.at(rig.chest, s.p[0], s.p[1], s.p[2]), r: s.r };
      case 'pelve':
        return { p: M.at(rig.pelvis, s.p[0], s.p[1], s.p[2]), r: s.r };
      case 'braco':
        return { p: limbAt(rig.upperArm[i], s.t, s.f, s.o), r: s.r };
      case 'antebraco':
        return { p: limbAt(rig.forearm[i], s.t, s.f, s.o), r: s.r };
      case 'coxa':
        return { p: limbAt(rig.thigh[i], s.t, s.f, s.o), r: s.r };
      case 'canela':
        return { p: limbAt(rig.shin[i], s.t, s.f, s.o), r: s.r };
      case 'mao': {
        const h = rig.hand[i];
        return { p: M.add(M.add(M.add(h.o, M.scale(h.a, s.a)), M.scale(h.d, s.d)), M.scale(h.s, s.s)), r: s.r };
      }
      case 'pe': {
        // à frente da base dos dedos, a peça dobra junto com os dedos (igual ao pé)
        const B = PD.BODY;
        const toe = rig.toe && rig.toe[i];
        if (toe && s.f > B.ballFwd + 1) return { p: M.at(toe, -side * s.s, s.f - B.ballFwd, s.u + B.ankleHeight), r: s.r };
        return { p: M.at(rig.foot[i], -side * s.s, s.f, s.u), r: s.r };
      }
      default:
        throw new Error('osso desconhecido: ' + bone);
    }
  }

  /** Grupo de desenho do corpo em que a peça entra (para ficar logo depois da parte que ela veste). */
  const GROUP = { cabeca: () => 'cabeca', peito: () => 'tronco', pelve: () => 'tronco', braco: (i) => 'braco' + i, antebraco: (i) => 'braco' + i, coxa: (i) => 'perna' + i, canela: (i) => 'perna' + i, pe: (i) => 'perna' + i, mao: (i) => 'mao' + i };
  const BODY_ITEM = { cabeca: 'cabeca', peito: 'peito', pelve: 'pelve', braco: 'braco', antebraco: 'antebraco', coxa: 'coxa', canela: 'canela', pe: 'pe', mao: 'mao' };

  /**
   * Transforma o que o personagem está vestindo em pedaços de desenho, presos às partes do corpo.
   * `bodyItems` = partes do corpo já montadas pelo renderizador (para pegar a ordem de profundidade).
   */
  function drawItems(renderer, rig, equipped, bodyItems) {
    const out = [];
    const hides = new Set();
    const hs = PD.BODY.headScale;
    // cada item uma vez só (um item de duas mãos aparece nos dois encaixes)
    for (const id of new Set(Object.values(equipped || {}))) {
      const item = catalog.get(id);
      if (!item) continue;
      for (const h of item.esconde || []) hides.add(h);
      item.pecas.forEach((peca, k) => {
        const sides = item.slot === 'maoE' || peca.lado === 'E' ? [0] : item.slot === 'maoD' || peca.lado === 'D' ? [1] : SINGLE.includes(peca.osso) ? [1] : [0, 1];
        for (const i of sides) {
          const circles = peca.esferas.map((s) => {
            const q = spherePoint(rig, peca.osso, i, s, hs);
            return renderer.circle(q.p, q.r);
          });
          const group = GROUP[peca.osso](i);
          const host = bodyItems.find((b) => b.name === BODY_ITEM[peca.osso] && b.group === group) || bodyItems.find((b) => b.group === group);
          const key = (host ? host.key : renderer.keyOf(rig.chest.o)) + 0.05 + 0.01 * (peca.camada || k);
          out.push({ name: 'equip:' + item.id, key, host, segs: [{ poly: renderer.hull(circles), circles, mat: peca.material || item.material, k: 0.28 }] });
        }
      });
    }
    return { items: out, hides };
  }

  PD.equipment = { define, validate, canEquip, catalog, drawItems, SLOTS, BONES, SLOT_BONES };
})(window.PD = window.PD || {});
