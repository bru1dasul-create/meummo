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

  function define(item) {
    if (!item || !item.id || !SLOTS.includes(item.slot)) throw new Error('equipamento inválido: precisa de id e de um slot de ' + SLOTS.join(', '));
    catalog.set(item.id, item);
    return item;
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
      case 'pe':
        return { p: M.at(rig.foot[i], -side * s.s, s.f, s.u), r: s.r };
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
    for (const slot of Object.keys(equipped || {})) {
      const item = catalog.get(equipped[slot]);
      if (!item) continue;
      for (const h of item.esconde || []) hides.add(h);
      item.pecas.forEach((peca, k) => {
        const sides = peca.lado === 'E' ? [0] : peca.lado === 'D' ? [1] : ['cabeca', 'peito', 'pelve'].includes(peca.osso) ? [1] : [0, 1];
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

  PD.equipment = { define, catalog, drawItems, SLOTS };
})(window.PD = window.PD || {});
