// FICHA do personagem (turnaround): o MESMO modelo, parado na POSE A (braços e pernas afastados, para desenhar
// equipamento por cima sem uma parte tapar a outra), visto de oito direções com a câmera ortográfica. Como é um modelo
// só girando, altura, cabeça, braços e pernas são os mesmos em todas as direções por construção.
//   PD.ficha.poseA(yaw, opções)             → a pose (para PD.rig.buildRig)
//   PD.ficha.DIRECOES                       → as oito direções, com o nome de arquivo de cada uma
//   PD.ficha.desenhar(tela, opções)         → desenha uma direção numa tela (fundo transparente, pé na âncora)
//   PD.ficha.medidas(opções)                → medidas do modelo na tela, por direção (para conferir que não mudam)
(function (PD) {
  'use strict';
  const M = PD.math;

  // graus = o quanto a câmera andou em volta dele (0 = de frente; 90 = vê o lado direito dele)
  const DIRECOES = [
    { arquivo: '01_frente', nome: 'Frente', graus: 0 },
    { arquivo: '02_diagonal_direita', nome: 'Diagonal dianteira direita', graus: 45 },
    { arquivo: '03_lado_direito', nome: 'Lado direito', graus: 90 },
    { arquivo: '04_diagonal_traseira_direita', nome: 'Diagonal traseira direita', graus: 135 },
    { arquivo: '05_costas', nome: 'Costas', graus: 180 },
    { arquivo: '06_diagonal_traseira_esquerda', nome: 'Diagonal traseira esquerda', graus: 225 },
    { arquivo: '07_lado_esquerdo', nome: 'Lado esquerdo', graus: 270 },
    { arquivo: '08_diagonal_esquerda', nome: 'Diagonal dianteira esquerda', graus: 315 },
  ];
  /** O giro do personagem no mundo (rad) para a câmera vê-lo a `graus` da frente. */
  const yawOf = (graus) => (45 - graus) * M.DEG;

  /**
   * POSE A: em pé, cabeça reta, braços abertos `braco` graus do tronco (padrão 32), pés afastados `pes` cm do meio
   * (padrão 23: 46 cm entre os tornozelos), mãos abertas com os dedos à mostra.
   */
  function poseA(yaw, o = {}) {
    const B = PD.BODY;
    const root = { x: 0, y: 0, z: 0 };
    const body = M.frameYaw(root, yaw);
    const spread = o.pes ?? 23;
    const arm = (o.braco ?? 32) * M.DEG;
    const reach = (B.upperArm + B.forearm) * 0.985; // cotovelo quase reto (um tiquinho dobrado)
    // a perna aberta precisa do quadril um pouco mais baixo para o pé chegar no chão sem esticar o osso
    const side = spread - B.hipHalf;
    const legMax = (B.thigh + B.shin) * 0.994;
    const dz = Math.min(0, Math.sqrt(Math.max(1, legMax * legMax - side * side)) - (B.hipStand - B.ankleHeight));
    return {
      root, yaw,
      pelvis: { dx: 0, dy: 0, dz, yaw: 0, pitch: 0, roll: 0 },
      spine: { yaw: 0, pitch: 0, roll: 0 },
      head: { yaw: 0, pitch: 0, roll: 0 },
      // (os pés abrem um pouco mais para fora que no jogo — `abrePe` graus a mais —, para o pé aparecer inteiro de frente)
      feet: [-1, 1].map((s) => ({ pos: M.at(body, s * spread, 0, B.ankleHeight), pitch: 0, toeBend: 0, yawOff: s * (o.abrePe ?? 14) * M.DEG })),
      // (mão aberta e relaxada, com as costas da mão viradas para a frente: os dedos aparecem separados)
      hands: [-1, 1].map(() => ({ local: { x: Math.sin(arm) * reach, y: 1.2, z: -Math.cos(arm) * reach }, twist: o.torcao ?? 1.15, poleLocal: [-0.95, 0.32, -0.15], fist: o.punho ?? 0.12, flex: 0.1 })),
    };
  }

  const z0 = { x: 0, y: 0, z: 0 };
  const lookOf = () => ({ blink: 0, hairWind: z0, featherSwing: [z0, z0, z0, z0, z0], pendantSwing: z0, tasselSwing: z0, earringSwing: z0, flapSwing: [z0, z0], gazeX: 0, gazeY: 0, mouthOpen: 0, browRaise: 0 });

  /**
   * Desenha uma direção. Opções: modelo ('birim' ou nada = o herói), graus (direção), inclinacao (graus da câmera para
   * cima: 0 = de frente, reta; 30 = a câmera do jogo), pxPorCm (escala), ancora { x, y } (o ponto do chão embaixo
   * dele, em pontos da tela), equipado, pose (uma pose pronta no lugar da pose A), camada (veja renderer.draw).
   * Devolve { esqueleto, camera } para quem quiser medir.
   */
  function desenhar(canvas, o = {}) {
    const cam = new PD.IsoCamera();
    cam.setPitch(o.inclinacao ?? 0);
    cam.zoom = o.pxPorCm || 4;
    cam.dpr = 1;
    const R = new PD.CharacterRenderer(cam);
    R.inkFree = o.traco ?? 0.62; // o traço acompanha o tamanho do desenho (no jogo, de perto, ele é ~0,6 do zoom)
    const yaw = yawOf(o.graus || 0);
    const rig = PD.rig.buildRig(o.pose ? o.pose(yaw) : poseA(yaw, o));
    const ctx = canvas.getContext('2d');
    const anchor = o.ancora || { x: canvas.width / 2, y: canvas.height * 0.94 };
    ctx.save();
    if (o.fundo) {
      ctx.fillStyle = o.fundo;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.translate(anchor.x, anchor.y);
    const appearance = (o.modelo && PD.models ? PD.models.appearance(o.modelo) : null) || (PD.classes ? PD.classes.appearanceOf({ classe: 'semClasse' }) : null);
    const look = lookOf();
    // `sem`: peças que o modelo deixa de vestir (o corpo-base); `so`: desenha só as peças com esses nomes, inteiras e
    // com o contorno delas (uma peça de roupa isolada, no mesmo lugar e na mesma escala)
    if (o.sem) look.semPecas = Object.fromEntries(o.sem.map((k) => [k, true]));
    if (o.so) {
      const items = R.prepare(ctx, rig, look, o.equipado || {}, appearance).flatMap((it) => {
        if (o.so.includes(it.name)) return [it];
        if (it.name !== 'pe' || !R.model.footUnder) return [];
        // Na ficha isolada, recupera a sola e as tiras de dentro da passagem do pé, sem a pele e os dedos.
        const shoes = [];
        const segs = it.segs.filter((s) => s.under);
        if (segs.length && o.so.includes('sola')) shoes.push({ name: 'sola', segs });
        if (R.model.footOver && o.so.includes('tiraChinelo')) {
          shoes.push({ name: 'tiraChinelo', draw: () => R.model.footOver(R, rig, Number(it.group.slice(-1)), look) });
        }
        return shoes;
      });
      R.layer = { items };
    }
    R.draw(ctx, rig, look, o.equipado || {}, appearance);
    R.layer = null;
    ctx.restore();
    return { rig, cam, renderer: R, anchor };
  }

  /**
   * Medidas do ESQUELETO na tela (px) numa direção: os ossos têm sempre o mesmo comprimento no espaço; aqui fica o
   * que dá para conferir de fora — a altura das juntas na tela (igual em todas as direções com a câmera reta).
   */
  function medidas(o = {}) {
    const cam = new PD.IsoCamera();
    cam.setPitch(o.inclinacao ?? 0);
    cam.zoom = o.pxPorCm || 4;
    const out = [];
    for (const d of DIRECOES) {
      const rig = PD.rig.buildRig(poseA(yawOf(d.graus), o));
      const y = (p) => -cam.p(p).y / cam.zoom; // altura na tela, em cm de tela
      const len = (a, b) => M.dist(a, b);
      out.push({
        direcao: d.arquivo,
        alturaCabeca: y(rig.head.o), alturaOmbro: y(rig.shoulder[1]), alturaQuadril: y(rig.hip[1]), alturaJoelho: y(rig.knee[1]), alturaTornozelo: y(rig.ankle[1]),
        braco: len(rig.shoulder[1], rig.elbow[1]), antebraco: len(rig.elbow[1], rig.wrist[1]), coxa: len(rig.hip[1], rig.knee[1]), canela: len(rig.knee[1], rig.ankle[1]),
        ombros: len(rig.shoulder[0], rig.shoulder[1]), pes: len(rig.ankle[0], rig.ankle[1]), maoAoQuadril: len(rig.wrist[1], rig.hip[1]),
      });
    }
    return out;
  }

  /** As peças do Birim que saem separadas: o nome da pasta, o que tirar para sumir com ela e as peças do desenho. */
  const PECAS = {
    bone_e_oculos: { sem: 'bone', nomes: ['bone', 'aba', 'botaoBone', 'oculos'] },
    cordao: { sem: 'cordao', nomes: ['cordao'] },
    relogio: { sem: 'relogio', nomes: ['relogio'] },
    bermuda: { sem: 'bermuda', nomes: ['bermuda', 'bermudaPerna', 'bermudaBarra', 'bolsoCargo'] },
    chinelos: { sem: 'chinelos', nomes: ['sola', 'tiraChinelo'] },
  };

  /**
   * As medidas do MODELO (cm), tiradas das esferas e do esqueleto: é o que vai na documentação da ficha. As larguras
   * são as do corpo em pé, de frente (o ponto mais de fora das esferas de cada parte).
   */
  function resumo(modelo, o = {}) {
    const B = PD.BODY;
    const ap = modelo && PD.models ? PD.models.appearance(modelo) : null;
    const MOD = (ap && ap.modelo) || PD.MODEL;
    const hs = MOD.headScale || B.headScale;
    const drop = MOD.headDrop || 0;
    const rig = PD.rig.buildRig(poseA(yawOf(0), o));
    const z = (p) => p.z;
    const ext = (list, axis = 0) => Math.max(...list.map((s) => Math.abs(s.p[axis]) + s.r));
    const headC = rig.head.o.z - drop;
    const skullTop = Math.max(...MOD.HEAD.spheres.map((s) => s.p[2] + s.r));
    const chin = Math.min(...MOD.HEAD.spheres.map((s) => s.p[2] - s.r));
    const capTop = modelo === 'birim' && PD.models.birim.CAP ? PD.models.birim.CAP.top + 1.6 : skullTop; // (o alto da copa e o botão)
    const ear = MOD.HEAD.ear;
    const arm = (list) => Math.max(...list.map((s) => s.r));
    const r2 = (v) => Math.round(v * 10) / 10;
    return {
      modelo: modelo || 'heroi',
      esqueleto: { coxa: B.thigh, canela: B.shin, braco: B.upperArm, antebraco: B.forearm, entreOmbros: B.shoulderHalf * 2, entreQuadris: B.hipHalf * 2, tornozeloAcimaDoChao: B.ankleHeight },
      alturasNaPoseA: {
        topo: r2(headC + capTop * hs), altoDoCranio: r2(headC + skullTop * hs), olhos: r2(headC + MOD.HEAD.eye.z * hs), queixo: r2(headC + chin * hs),
        ombro: r2(z(rig.shoulder[1])), cotovelo: r2(z(rig.elbow[1])), punho: r2(z(rig.wrist[1])), quadril: r2(z(rig.hip[1])), joelho: r2(z(rig.knee[1])), tornozelo: r2(z(rig.ankle[1])),
      },
      cabeca: { escala: hs, altura: r2((capTop - chin) * hs), alturaSemBone: r2((skullTop - chin) * hs), larguraComOrelhas: r2(2 * (ear.mid.p[0] + ear.mid.r) * hs), larguraDoCranio: r2(2 * ext(MOD.HEAD.spheres.filter((s) => /cranio/.test(s.name))) * hs) },
      larguras: {
        ombros: r2(2 * (B.shoulderHalf + Math.max(...MOD.UPPER_ARM.filter((s) => s.part === 'deltoide').map((s) => s.o + s.r)))),
        peito: r2(2 * ext(MOD.CHEST.slice(4, 8))), cintura: r2(2 * ext(MOD.CHEST.filter((s) => s.p[2] < -14))), quadril: r2(2 * ext(MOD.PELVIS)), pescoco: r2(2 * MOD.NECK.r0),
      },
      grossuras: { braco: r2(2 * arm(MOD.UPPER_ARM.filter((s) => s.part !== 'deltoide'))), antebraco: r2(2 * arm(MOD.FOREARM)), coxa: r2(2 * arm(MOD.THIGH)), panturrilha: r2(2 * arm(MOD.SHIN)), tornozelo: r2(2 * MOD.SHIN[MOD.SHIN.length - 1].r) },
      poseA: {
        bracoAbertoGraus: o.braco ?? 32, punhoAoQuadril: r2(M.dist(rig.wrist[1], rig.hip[1])), entreTornozelos: r2(M.dist(rig.ankle[0], rig.ankle[1])), entrePunhos: r2(M.dist(rig.wrist[0], rig.wrist[1])),
      },
      paleta: ap ? ap.paleta : PD.PALETTE,
    };
  }

  /**
   * Peças de TESTE (não são do jogo): uma em cada encaixe de roupa, feitas das medidas do próprio modelo com uma folga.
   * Servem para conferir que o modelo veste equipamento e que a roupa dele sai quando o encaixe é ocupado. É também a
   * receita de uma peça de verdade: as esferas da parte do corpo que ela cobre, um pouco maiores.
   * Devolve o `equipado` ({ encaixe: id }) para `desenhar`.
   */
  function pecasDeTeste(modelo) {
    const ap = modelo && PD.models ? PD.models.appearance(modelo) : null;
    const MOD = (ap && ap.modelo) || PD.MODEL;
    const E = PD.equipment;
    const id = (nome) => `teste-${nome}-${modelo || 'heroi'}`;
    const limb = (list, grow, t0 = -1, t1 = 2) => list.filter((q) => q.t >= t0 && q.t <= t1).map((q) => ({ t: q.t, f: q.f || 0, o: q.o || 0, r: q.r + grow }));
    const body = (list, grow) => list.map((q) => ({ p: q.p, r: q.r + grow }));
    if (!E.catalog.has(id('capacete'))) {
      E.define({ id: id('capacete'), slot: 'cabeca', nome: 'Capacete de teste', material: { base: '#8f98a3', shade: '#5a626c', light: '#c3cad2' },
        pecas: [{ osso: 'cabeca', esferas: [{ p: [0, -0.5, 10.3], r: 9.8 }, { p: [0, -5.5, 8], r: 10.2 }, { p: [-7.2, -1.5, 7], r: 6.4 }, { p: [7.2, -1.5, 7], r: 6.4 }] }] });
      E.define({ id: id('camiseta'), slot: 'tronco', nome: 'Camiseta de teste', material: { base: '#b9b29a', shade: '#857f6b', light: '#d8d2bb' },
        pecas: [{ osso: 'peito', esferas: body(MOD.CHEST, 0.7) }, { osso: 'braco', lado: 'ambos', esferas: limb(MOD.UPPER_ARM, 0.7, -1, 0.5) }] });
      E.define({ id: id('calca'), slot: 'pernas', nome: 'Calça de teste', material: { base: '#3d4a63', shade: '#252e40', light: '#566684' },
        pecas: [{ osso: 'pelve', esferas: body(MOD.PELVIS, 0.8) }, { osso: 'coxa', lado: 'ambos', esferas: limb(MOD.THIGH, 0.8) }, { osso: 'canela', lado: 'ambos', esferas: limb(MOD.SHIN, 0.7, -1, 0.8) }] });
      E.define({ id: id('bota'), slot: 'pes', nome: 'Bota de teste', material: { base: '#6b4a2f', shade: '#47301d', light: '#8f6844' },
        pecas: [{ osso: 'canela', lado: 'ambos', esferas: [{ t: 0.62, f: 0, o: 0, r: 5.3 }, { t: 1, f: 0, o: 0, r: 4.5 }] },
          { osso: 'pe', lado: 'ambos', esferas: [{ s: 0, f: -3.8, u: -2.6, r: 4.2 }, { s: 0, f: 5, u: -1.2, r: 4.3 }, { s: 0.3, f: 15.6, u: -3.4, r: 3.4 }] }] });
    }
    return { cabeca: id('capacete'), tronco: id('camiseta'), pernas: id('calca'), pes: id('bota') };
  }

  PD.ficha = { DIRECOES, PECAS, yawOf, poseA, desenhar, medidas, resumo, lookOf, pecasDeTeste };
})(window.PD = window.PD || {});
