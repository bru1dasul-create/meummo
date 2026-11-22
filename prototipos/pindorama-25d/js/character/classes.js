// Classes (arquitetura preparada; por enquanto só existe "sem classe", o rapaz que acorda na esquina).
//
// Uma classe é um PERFIL por cima do mesmo protagonista. Ela muda o que pode mudar sem redesenhar ninguém:
//  - aparencia.paleta: cores de pintura, pano e enfeites (pele, olhos e cabelo NÃO: são a identidade dele)
//  - golpes.ataque: qual golpe o botão de ataque faz (hoje só existe o soco; um golpe novo entra em GOLPES)
//  - encaixes: quais encaixes de equipamento a classe usa (ex.: um arqueiro sem escudo na mão esquerda)
//  - equipamentoInicial: { encaixe: id do item } (os itens vêm de js/character/equipment.js)
// O corpo (medidas, esqueleto, animações e o desenho) é o mesmo para todas as classes: é isso que mantém a cara
// dele igual e deixa os sprites exportados e as peças de equipamento servirem para qualquer classe.
//
// Exemplo (não está ligado; é só o formato):
//   PD.classes.define({
//     id: 'cacador', nome: 'Caçador da mata',
//     aparencia: { paleta: { paintRed: '#8e2b1d', cloth: { base: '#3f4a2c', shade: '#2a321d', light: '#56623c' } } },
//     golpes: { ataque: 'soco' },
//     encaixes: ['cabeca', 'tronco', 'pernas', 'pes', 'maoD', 'acessorios'],
//     equipamentoInicial: {},
//   });
//   const heroi = new PD.Character(x, y, yaw, { classe: 'cacador' });
(function (PD) {
  'use strict';
  const registry = new Map();
  // golpes que o animador sabe fazer (o id é o que vai em golpes.ataque)
  const GOLPES = ['soco'];
  // cores da identidade: nenhuma classe muda
  const IDENTITY = ['ink', 'inkSoft', 'skin', 'skinFar', 'lip', 'hair', 'hairSheen'];

  const isColor = (c) => typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);
  const colorsOk = (v) => (typeof v === 'string' ? isColor(v) : Array.isArray(v) ? v.every(colorsOk) : v && typeof v === 'object' ? Object.values(v).every(colorsOk) : false);

  /** Confere uma classe e devolve a lista de problemas (vazia = válida). */
  function validate(c) {
    const err = [];
    if (!c || typeof c !== 'object') return ['a classe precisa ser um objeto'];
    if (typeof c.id !== 'string' || !c.id) err.push('falta o id (texto)');
    if (typeof c.nome !== 'string' || !c.nome) err.push('falta o nome');
    const pal = (c.aparencia && c.aparencia.paleta) || {};
    for (const k of Object.keys(pal)) {
      if (IDENTITY.includes(k)) err.push(`a cor "${k}" é da identidade do personagem e não muda por classe`);
      else if (!(k in PD.PALETTE)) err.push(`a cor "${k}" não existe na paleta`);
      else if (!colorsOk(pal[k])) err.push(`a cor "${k}" tem valor inválido (use #rrggbb)`);
    }
    const atk = c.golpes && c.golpes.ataque;
    if (atk !== undefined && !GOLPES.includes(atk)) err.push(`golpe "${atk}" não existe (hoje: ${GOLPES.join(', ')})`);
    if (c.encaixes !== undefined && !(Array.isArray(c.encaixes) && c.encaixes.every((s) => PD.MODEL.SLOTS.includes(s)))) err.push(`"encaixes" tem que ser uma lista de: ${PD.MODEL.SLOTS.join(', ')}`);
    const eq = c.equipamentoInicial || {};
    for (const s of Object.keys(eq)) {
      if (!PD.MODEL.SLOTS.includes(s)) err.push(`equipamento inicial: encaixe "${s}" não existe`);
      if (c.encaixes && !c.encaixes.includes(s)) err.push(`equipamento inicial: a classe não usa o encaixe "${s}"`);
    }
    return err;
  }

  function define(c) {
    const err = validate(c);
    if (err.length) throw new Error(`classe "${c && c.id}" inválida:\n - ` + err.join('\n - '));
    const full = {
      aparencia: { paleta: {} },
      golpes: { ataque: 'soco' },
      encaixes: PD.MODEL.SLOTS.slice(),
      equipamentoInicial: {},
      ...c,
    };
    full.golpes = { ataque: 'soco', ...(c.golpes || {}) };
    // a paleta pronta (base + o que a classe muda) fica guardada: o desenho não junta cores a cada quadro
    full.paletaFinal = { ...PD.PALETTE, ...((c.aparencia && c.aparencia.paleta) || {}) };
    registry.set(c.id, full);
    return full;
  }

  function get(id) {
    return registry.get(id) || registry.get('semClasse');
  }

  // O BIRIM É O HERÓI DE TODOS NO JOGO (21/11, escolha do dono: "A: Birim para todos"; de 19 a 21/11 ele só aparecia com
  // `?birim` no endereço). No jogo, os jogadores saem com o Birim (`birim.js`) — no mundo, no retrato da barra e na
  // mochila (`playerAppearance`); os NPCs continuam com a aparência deles. Para ver o herói antigo NESTE navegador: abrir
  // uma vez com `?heroi` (fica guardado até abrir com `?birim`). A chave vale em maiúscula ou minúscula, depois de `?` ou
  // de `#` (no PC do dono, digitar no endereço falhou: clicar na barra seleciona tudo). As ferramentas e as pranchas do
  // protótipo continuam com o herói (`appearanceOf`), menos depois de um `?birim` (o teste de antes).
  const CHOICE_KEY = 'meummo.testeModelo';
  const CHOICE = (() => {
    try {
      if (typeof location === 'undefined') return null;
      const where = (location.search + '&' + location.hash.replace(/^#/, '')).toLowerCase();
      const has = (k) => new RegExp('(^|[?&])' + k + '(=|&|$)').test(where);
      let store = null;
      try {
        store = window.localStorage;
      } catch (e) {
        store = null;
      }
      const save = (v) => {
        try {
          if (store) store.setItem(CHOICE_KEY, v);
        } catch (e) {
          // (sem onde guardar: vale só nesta página)
        }
      };
      if (has('heroi')) {
        save('heroi');
        return 'heroi';
      }
      if (has('birim')) {
        save('birim');
        return 'birim';
      }
      let saved = null;
      try {
        saved = store && store.getItem(CHOICE_KEY);
      } catch (e) {
        saved = null;
      }
      return saved === 'heroi' || saved === 'birim' ? saved : null;
    } catch (e) {
      return null;
    }
  })();
  let birimLook;
  const birim = () => {
    if (birimLook === undefined) birimLook = (PD.models && PD.models.appearance && PD.models.appearance('birim')) || null;
    return birimLook;
  };

  /** Aparência para o desenho (o renderer usa a paleta da classe do personagem): a das ferramentas e pranchas. */
  function appearanceOf(character) {
    if (CHOICE === 'birim' && birim()) return birim();
    const c = get(character && character.classe);
    return c ? { paleta: c.paletaFinal, classe: c.id } : null;
  }

  /** A aparência dos jogadores no jogo: o Birim (escolha do dono), menos neste navegador depois de um `?heroi`. */
  function playerAppearance(character) {
    if (CHOICE !== 'heroi' && birim()) return birim();
    const c = get(character && character.classe);
    return c ? { paleta: c.paletaFinal, classe: c.id } : null;
  }

  // a classe de hoje: sem classe, sem equipamento (o personagem base)
  define({ id: 'semClasse', nome: 'Sem classe' });

  PD.classes = { define, validate, get, appearanceOf, playerAppearance, list: () => [...registry.values()], GOLPES, IDENTITY };
})(window.PD = window.PD || {});
