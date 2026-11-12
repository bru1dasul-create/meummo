// Testes do protótipo que rodam só no Node (sem navegador): encaixes de equipamento, classes, esqueleto/IK em todos os
// roteiros da auditoria e o padrão da exportação de sprites. Uso: node ferramentas/testes.cjs
// (as conferências com desenho e navegador são as outras ferramentas: conferir, auditoria, exportar...)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'js/core/math.js',
  'js/core/iso.js',
  'js/core/shapes.js',
  'js/character/body.js',
  'js/character/rig.js',
  'js/character/animator.js',
  'js/character/renderer.js',
  'js/character/equipment.js',
  'js/character/classes.js',
  'js/guard.js',
  'js/tools/export.js',
  'js/tools/audit.js',
];

/** Carrega o protótipo num "navegador de mentira" (window = o próprio global, sem tela). */
function load() {
  const ctx = { console: { log() {}, warn() {}, error: console.error }, setTimeout, clearTimeout, TextEncoder, Uint8Array, Uint32Array, Map, Set, Math, JSON };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.PD;
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, err: e && e.message ? e.message : String(e) });
  }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'diferente'}: esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
}
function ok(v, msg) {
  if (!v) throw new Error(msg || 'falhou');
}
function has(list, piece, msg) {
  if (!list.some((s) => s.includes(piece))) throw new Error(`${msg || 'faltou o aviso'} "${piece}" em: ${JSON.stringify(list)}`);
}
function throws(fn, piece) {
  try {
    fn();
  } catch (e) {
    if (piece && !String(e.message).includes(piece)) throw new Error(`erro sem "${piece}": ${e.message}`);
    return;
  }
  throw new Error('devia dar erro');
}

// ---------------------------------------------------------------- equipamentos
{
  const PD = load();
  const E = PD.equipment;
  const couro = { base: '#6b4a2f', shade: '#47301d', light: '#8f6844' };
  const bota = {
    id: 'bota-couro', slot: 'pes', nome: 'Bota de couro', material: couro,
    pecas: [
      { osso: 'canela', lado: 'ambos', esferas: [{ t: 0.62, f: 0, o: 0, r: 4.9 }, { t: 1, f: 0, o: 0, r: 4.3 }] },
      { osso: 'pe', lado: 'ambos', esferas: [{ s: 0, f: -3.8, u: -2.6, r: 4 }, { s: 0, f: 5, u: -1.2, r: 4.1 }] },
    ],
  };
  const comPeca = (extra, peca) => ({ ...bota, ...extra, pecas: [{ ...bota.pecas[0], ...peca }] });

  test('equipamento: o exemplo da bota é válido', () => eq(E.validate(bota).length, 0, 'problemas'));
  test('equipamento: encaixe que não existe', () => has(E.validate({ ...bota, slot: 'cauda' }), 'encaixe "cauda" não existe'));
  test('equipamento: osso que não existe', () => has(E.validate(comPeca({}, { osso: 'asa' })), 'osso "asa" não existe'));
  test('equipamento: capacete não prende no pé', () => has(E.validate({ ...bota, slot: 'cabeca' }), 'não prende peças no osso "canela"'));
  test('equipamento: arma da mão direita com peça da esquerda', () =>
    has(E.validate({ id: 'faca', slot: 'maoD', material: couro, pecas: [{ osso: 'mao', lado: 'E', esferas: [{ a: 4, d: 0, s: 0, r: 1 }] }] }), 'item da mão direita'));
  test('equipamento: esfera sem raio', () => has(E.validate(comPeca({}, { esferas: [{ t: 0.5, f: 0, o: 0 }] })), 'falta "r"'));
  test('equipamento: raio zero', () => has(E.validate(comPeca({}, { esferas: [{ t: 0.5, f: 0, o: 0, r: 0 }] })), 'maior que zero'));
  test('equipamento: cor inválida', () => has(E.validate({ ...bota, material: { base: 'marrom', shade: '#000000' } }), 'material inválido'));
  test('equipamento: esconder parte que não existe', () => has(E.validate({ ...bota, esconde: ['rabo'] }), 'a parte "rabo" não existe'));
  test('equipamento: "ocupa" sem o próprio encaixe', () => has(E.validate({ ...bota, ocupa: ['maoD'] }), '"ocupa" tem que incluir'));
  test('equipamento: define recusa item inválido com a lista', () => throws(() => E.define({ ...bota, id: 'ruim', slot: 'cauda' }), 'encaixe "cauda" não existe'));

  E.define(bota);
  const mat = { base: '#7a5a3a', shade: '#4d3824' };
  E.define({ id: 'faca', slot: 'maoE', material: mat, pecas: [{ osso: 'mao', esferas: [{ a: 6, d: 0, s: 0, r: 1.2 }] }] });
  E.define({ id: 'cajado', slot: 'maoD', ocupa: ['maoD', 'maoE'], material: mat, pecas: [{ osso: 'mao', lado: 'D', esferas: [{ a: 6, d: 0, s: 0, r: 1.6 }] }] });

  test('equipamento: canEquip recusa item de outro encaixe', () => {
    const r = E.canEquip({ classe: 'semClasse' }, 'cabeca', 'bota-couro');
    ok(!r.ok && r.motivo.includes('é do encaixe "pes"'), r.motivo);
  });
  test('equipamento: canEquip recusa item que não existe', () => ok(!E.canEquip({}, 'pes', 'nada').ok));
  test('equipamento: duas mãos tira o que estava nas duas e sai das duas', () => {
    const ch = new PD.Character(0, 0, 0);
    eq(ch.equip('maoE', 'faca').length, 0, 'tirou algo sem precisar');
    const tirou = ch.equip('maoD', 'cajado');
    eq(tirou.join(','), 'faca', 'o que saiu');
    eq(ch.equipped.maoD, 'cajado');
    eq(ch.equipped.maoE, 'cajado');
    eq(ch.equip('maoE', 'faca').join(','), 'cajado', 'o que saiu');
    eq(ch.equipped.maoD, undefined, 'o cajado ficou na outra mão');
    eq(ch.unequip('maoE'), 'faca');
    throws(() => ch.unequip('cauda'), 'não existe');
    throws(() => ch.equip('pes', 'faca'), 'não dá para vestir');
  });
}

// ---------------------------------------------------------------- classes
{
  const PD = load();
  const C = PD.classes;
  test('classe: a padrão é "semClasse" e o personagem começa nela', () => {
    eq(new PD.Character(0, 0, 0).classe, 'semClasse');
    eq(C.get('naoExiste').id, 'semClasse', 'classe desconhecida');
  });
  test('classe: cor da identidade não muda', () => has(C.validate({ id: 'x', nome: 'X', aparencia: { paleta: { skin: '#ffffff' } } }), 'é da identidade'));
  test('classe: cor que não existe na paleta', () => has(C.validate({ id: 'x', nome: 'X', aparencia: { paleta: { neon: '#ffffff' } } }), 'não existe na paleta'));
  test('classe: valor de cor inválido', () => has(C.validate({ id: 'x', nome: 'X', aparencia: { paleta: { paintRed: 'vermelho' } } }), 'valor inválido'));
  test('classe: golpe que não existe', () => has(C.validate({ id: 'x', nome: 'X', golpes: { ataque: 'chute' } }), 'golpe "chute" não existe'));
  test('classe: encaixe que não existe', () => has(C.validate({ id: 'x', nome: 'X', encaixes: ['cauda'] }), '"encaixes" tem que ser'));
  test('classe: equipamento inicial num encaixe que a classe não usa', () =>
    has(C.validate({ id: 'x', nome: 'X', encaixes: ['cabeca'], equipamentoInicial: { pes: 'bota' } }), 'não usa o encaixe "pes"'));

  PD.equipment.define({ id: 'bota', slot: 'pes', material: { base: '#6b4a2f', shade: '#47301d' }, pecas: [{ osso: 'pe', esferas: [{ s: 0, f: 4, u: -1, r: 4 }] }] });
  PD.equipment.define({ id: 'escudo', slot: 'maoE', classes: ['guardiao'], material: { base: '#6b4a2f', shade: '#47301d' }, pecas: [{ osso: 'mao', esferas: [{ a: 4, d: 2, s: 0, r: 5 }] }] });
  const base = PD.PALETTE;
  C.define({ id: 'cacador', nome: 'Caçador', aparencia: { paleta: { paintRed: '#8e2b1d' } }, encaixes: ['cabeca', 'tronco', 'pernas', 'pes', 'maoD', 'acessorios'], equipamentoInicial: { pes: 'bota' } });
  C.define({ id: 'guardiao', nome: 'Guardião' });

  test('classe: a paleta muda só o que a classe pede', () => {
    const ap = C.appearanceOf({ classe: 'cacador' });
    eq(ap.paleta.paintRed, '#8e2b1d');
    eq(JSON.stringify(ap.paleta.skin), JSON.stringify(base.skin), 'pele');
    eq(C.appearanceOf({ classe: 'semClasse' }).paleta.paintRed, base.paintRed, 'paleta base');
  });
  test('classe: equipamento inicial entra no personagem', () => eq(new PD.Character(0, 0, 0, { classe: 'cacador' }).equipped.pes, 'bota'));
  test('classe: encaixe fora da classe é recusado', () => {
    const r = PD.equipment.canEquip({ classe: 'cacador' }, 'maoE', 'escudo');
    ok(!r.ok && r.motivo.includes('não usa o encaixe'), r.motivo);
  });
  test('classe: item só de uma classe', () => {
    ok(!PD.equipment.canEquip({ classe: 'semClasse' }, 'maoE', 'escudo').ok, 'semClasse vestiu o escudo do guardião');
    ok(PD.equipment.canEquip({ classe: 'guardiao' }, 'maoE', 'escudo').ok, 'o guardião não vestiu o escudo');
  });
  test('classe: o golpe do ataque vem da classe', () => {
    const ch = new PD.Character(0, 0, 0, { classe: 'cacador' });
    for (let i = 0; i < 30; i++) ch.update(1 / 60, i === 2 ? { attack: true, attackDir: 0 } : {}, null);
    ok(ch.attack, 'não socou');
  });
}

// ---------------------------------------------------------------- esqueleto, IK e passada (todos os roteiros da auditoria)
{
  const PD = load();
  const scenes = PD.audit.scenes();
  const piores = { ik: 0, braco: 0, escorregao: 0, ossos: 0, joelho: 0, cotovelo: 0, chao: 0 };
  const onde = {};
  const note = (k, v, nome) => {
    if (v > piores[k]) {
      piores[k] = v;
      onde[k] = nome;
    }
  };
  for (const sc of scenes) {
    const r = PD.audit.runScene(sc);
    note('ik', r.ik.leg, r.name);
    note('braco', r.ik.arm, r.name);
    note('escorregao', r.slide, r.name);
    note('ossos', Math.max(...Object.values(r.bones)), r.name);
    note('joelho', r.kneeBack, r.name);
    note('cotovelo', r.elbowWrong, r.name);
    note('chao', r.belowGround, r.name);
  }
  const lim = (k, max, txt) => test(`esqueleto: ${txt} (${scenes.length} roteiros)`, () => ok(piores[k] <= max, `${piores[k].toFixed(3)} em "${onde[k]}" (limite ${max})`));
  lim('ik', 0.5, 'pé chega no alvo do IK (até 0,5 cm)');
  lim('braco', 0.5, 'punho chega no alvo do IK (até 0,5 cm)');
  lim('escorregao', 0.5, 'pé apoiado não escorrega (até 0,5 cm/s)');
  lim('ossos', 0.001, 'ossos não esticam');
  lim('joelho', 0, 'joelho nunca dobra para trás');
  lim('cotovelo', 0, 'cotovelo nunca dobra ao contrário');
  lim('chao', 0.3, 'pé não entra no chão (até 0,3 cm)');
}

// ---------------------------------------------------------------- exportação de sprites
{
  const PD = load();
  const X = PD.exporter;
  test('exportação: nomes organizados', () => {
    eq(X.nomeArquivo('semClasse', 'andar', 's', 3), 'pindorama_semClasse_andar_s_03.png');
    eq(X.nomeArquivo('semClasse', 'andar', 's', 3, { ordem: 2, parte: 'bracoE' }), 'pindorama_semClasse_andar_s_03__02_bracoE.png');
    throws(() => X.nomeArquivo('sem classe', 'andar', 's', 0), 'nome inválido');
  });
  test('exportação: 8 direções diferentes, de 45 em 45 graus', () => {
    eq(new Set(X.DIRECOES.map((d) => d.nome)).size, 8, 'nomes');
    eq(new Set(X.DIRECOES.map((d) => ((d.yaw % 360) + 360) % 360)).size, 8, 'ângulos');
    ok(X.DIRECOES.every((d) => d.yaw % 45 === 0), 'ângulo fora de 45°');
  });
  test('exportação: todas as partes têm dono (nenhuma peça do corpo fica de fora)', () => {
    const sem = PD.MODEL.PARTS.filter((name) => {
      const it = { name, group: name === 'braco' || name === 'antebraco' ? 'braco0' : name === 'mao' ? 'mao0' : ['coxa', 'canela', 'pe'].includes(name) ? 'perna0' : name };
      return !X.parteDe(it);
    });
    eq(sem.join(','), '', 'partes sem camada');
  });
  test('exportação: CRC do ZIP (valor de referência)', () => eq(X.crc32(new TextEncoder().encode('123456789')), 0xcbf43926));
  test('exportação: ZIP com os arquivos inteiros e no lugar certo', () => {
    const a = new TextEncoder().encode('{"oi":1}');
    const b = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const z = X.zip([{ nome: 'manifest.json', dados: a }, { nome: 'sprites/x.png', dados: b }]);
    const dv = new DataView(z.buffer);
    eq(dv.getUint32(0, true), 0x04034b50, 'assinatura');
    const n1 = dv.getUint16(26, true);
    eq(Buffer.from(z.slice(30 + n1, 30 + n1 + a.length)).toString(), '{"oi":1}', 'conteúdo do primeiro');
    const end = z.length - 22;
    eq(dv.getUint32(end, true), 0x06054b50, 'fim do ZIP');
    eq(dv.getUint16(end + 10, true), 2, 'quantos arquivos');
  });
  test('exportação: camadas trocam de lugar só quem não se cobre', () => {
    // A e C são da mesma parte; B não encosta em ninguém → duas camadas (A+C, B)
    const box = (x0, y0, x1, y1) => ({ x0, y0, x1, y1, w: x1 - x0 + 1, bits: new Uint8Array((x1 - x0 + 1) * (y1 - y0 + 1)).fill(1) });
    const A = box(0, 0, 9, 9), B = box(30, 30, 39, 39), C = box(5, 5, 14, 14);
    let g = X.agrupar(['x', 'y', 'x'], [A, B, C]);
    eq(g.map((c) => c.parte + ':' + c.vezes.join('+')).join(' '), 'x:0+2 y:1');
    // agora B fica entre A e C na tela: a ordem não pode mudar
    const B2 = box(3, 3, 12, 12);
    g = X.agrupar(['x', 'y', 'x'], [A, B2, C]);
    eq(g.map((c) => c.parte + ':' + c.vezes.join('+')).join(' '), 'x:0 y:1 x:2');
  });
  test('exportação: passada com ciclo inteiro, pulo e soco com âncora parada', () => {
    const andar = X.ANIMACOES.find((a) => a.nome === 'andar');
    const d = X.DIRECOES[0];
    const r = X.poses(andar, d, 'semClasse');
    eq(r.quadros.length, andar.quadros, 'quadros');
    ok(r.info.duracao > 0.5 && r.info.duracao < 1.5, 'duração do ciclo ' + r.info.duracao);
    ok(r.info.deslocamentoCm > 80, 'quanto anda num ciclo ' + r.info.deslocamentoCm);
    const soco = X.poses(X.ANIMACOES.find((a) => a.nome === 'soco'), d, 'semClasse');
    ok(soco.quadros.every((q) => q.raiz === soco.quadros[0].raiz), 'âncora andou no soco');
    ok(soco.info.deslocamentoCm > 3, 'a investida do soco sumiu');
  });
}

const fail = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'ok   ' : 'FALHA'} ${r.name}${r.ok ? '' : '\n      ' + r.err}`);
console.log(`\n${results.length - fail.length} de ${results.length} passaram`);
process.exit(fail.length ? 1 : 0);
