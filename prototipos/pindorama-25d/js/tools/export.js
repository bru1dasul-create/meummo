// Exportação de sprites padronizados do protagonista (para usar depois: em outro motor de jogo, em pranchas de
// animação ou para montar equipamentos por cima sem redesenhar).
//
// Padrão de cada exportação (o mesmo para todas as animações, direções e partes):
//  - TAMANHO fixo: um quadro só (largura × altura) que cabe o maior quadro de todos, com margem;
//  - ESCALA fixa: `pxPorCm` (padrão 2 px por cm; o personagem tem ~176 cm);
//  - FUNDO transparente e sem sombra no chão (o jogo desenha a sombra);
//  - ÂNCORA fixa: o ponto do chão embaixo do personagem fica sempre no mesmo pixel (`ancora`). Todas as direções e
//    quadros se alinham sozinhos; no pulo o corpo sobe e a âncora não. A animação sai "no lugar": quem anda é o jogo,
//    na velocidade de `deslocamentoCm` / `duracaoSeg` do manifesto (assim o pé não escorrega);
//  - NOMES: pindorama_<classe>_<animação>_<direção>_<NN>.png e as camadas pindorama_..._<NN>__<CC>_<parte>.png;
//  - POSE sem sorteio (olhar, peso e piscar desligados): exportar de novo dá os mesmos quadros.
// Camadas (opcional): o quadro sai também em pedaços com nome de parte (cabeça, cabelo, tronco, braços, pernas...),
// todos no mesmo tamanho e âncora. A camada 00 é o contorno grosso de fora; empilhando as camadas na ordem dos números
// sai exatamente o quadro inteiro (é conferido pixel a pixel). Uma parte pode vir em duas camadas quando outra passa
// mesmo no meio dela (a tanga de trás atrás das pernas, o brinco por cima da trança, a mão entre os joelhos).
// Pontos de encaixe (mãos, cabeça, peito, costas, quadril, pés) vão em pixels do quadro, para prender armas e
// equipamentos depois.
(function (PD) {
  'use strict';
  const M = PD.math;

  // direções na tela (s = de frente para a câmera, olhando para baixo da tela); yaw = ângulo no mundo (graus)
  const DIRECOES = [
    { nome: 's', yaw: 45 },
    { nome: 'sw', yaw: 90 },
    { nome: 'w', yaw: 135 },
    { nome: 'nw', yaw: 180 },
    { nome: 'n', yaw: 225 },
    { nome: 'ne', yaw: 270 },
    { nome: 'e', yaw: 315 },
    { nome: 'se', yaw: 0 },
  ];

  const BREATH = 1 / 0.27; // um ciclo da respiração (animator.js): o "parado" emenda sem tranco

  // animações. tipo: 'tempo' (quadros espaçados no tempo), 'passada' (um ciclo inteiro da passada, começando sempre
  // no mesmo ponto), 'pulo' e 'soco' (do começo ao fim)
  const ANIMACOES = [
    { nome: 'parado', quadros: 8, duracao: BREATH, repete: true, tipo: 'tempo', entrada: () => ({}) },
    { nome: 'andar', quadros: 8, repete: true, tipo: 'passada', entrada: (d) => ({ move: d }) },
    { nome: 'correr', quadros: 8, repete: true, tipo: 'passada', entrada: (d) => ({ move: d, run: true }) },
    { nome: 'agachado', quadros: 8, duracao: BREATH, repete: true, tipo: 'tempo', agachar: true, entrada: () => ({}) },
    { nome: 'andarAgachado', quadros: 8, repete: true, tipo: 'passada', agachar: true, entrada: (d) => ({ move: d }) },
    { nome: 'pular', quadros: 12, duracao: 1.2, repete: false, tipo: 'pulo', entrada: () => ({}) },
    { nome: 'soco', quadros: 8, duracao: PD.PUNCH_AT ? PD.PUNCH_AT.total : 0.8, repete: false, tipo: 'soco', entrada: () => ({}) },
  ];

  // partes do corpo (nomes fixos). 0 = esquerda (E), 1 = direita (D). A tanga de trás e o cabelo comprido ficam
  // separados do tronco e da cabeça porque passam atrás das pernas e das costas enquanto o resto vem na frente
  const PARTES = {
    cabeca: (it) => ['cabeca', 'cabelo', 'cabeloFrente', 'franja', 'faixa', 'pena', 'amarracao', 'orelha', 'brinco'].includes(it.name),
    cabeloLongo: (it) => it.name === 'cabeloLongo',
    trancas: (it) => it.name === 'tranca',
    tronco: (it) => ['pescoco', 'peito', 'pelve', 'colar', 'abaFrente'].includes(it.name),
    tangaTras: (it) => it.name === 'abaTras',
    bracoE: (it) => it.group === 'braco0' || it.group === 'mao0',
    bracoD: (it) => it.group === 'braco1' || it.group === 'mao1',
    pernaE: (it) => it.group === 'perna0',
    pernaD: (it) => it.group === 'perna1',
  };
  const parteDe = (it) => Object.keys(PARTES).find((p) => PARTES[p](it)) || null;

  const pad = (n) => String(n).padStart(2, '0');
  const okId = (s) => /^[A-Za-z0-9]+$/.test(s);
  /** Nome do arquivo de um quadro, ou de uma camada dele (camada = { ordem, parte }). */
  function nomeArquivo(classe, anim, dir, quadro, camada) {
    for (const s of [classe, anim, dir].concat(camada ? [camada.parte] : [])) if (!okId(s)) throw new Error(`nome inválido para arquivo: "${s}" (só letras e números)`);
    const base = `pindorama_${classe}_${anim}_${dir}_${pad(quadro)}`;
    return camada ? `${base}__${pad(camada.ordem)}_${camada.parte}.png` : `${base}.png`;
  }

  /**
   * Simula a animação numa direção e devolve os quadros: { rig, look, raiz } (raiz = ponto do chão embaixo do
   * personagem) e, nas animações de passada, quanto ele anda e quanto dura um ciclo.
   */
  function poses(anim, dir, classe) {
    const dt = 1 / 240;
    const ch = new PD.Character(0, 0, dir.yaw * M.DEG, { classe });
    const d = { x: Math.cos(dir.yaw * M.DEG), y: Math.sin(dir.yaw * M.DEG) };
    const step = (input) => {
      ch.update(dt, input || {}, null);
      const rig = PD.rig.buildRig(ch.pose());
      ch.secondary(rig, dt);
      return rig;
    };
    const snap = (rig) => {
      const look = JSON.parse(JSON.stringify(ch.look));
      look.blink = 0; // de olho aberto em todos os quadros
      return { rig, look, equipado: { ...ch.equipped }, raiz: { x: ch.pos.x, y: ch.pos.y, z: ch.groundZ } };
    };
    const quadros = [];
    const info = { duracao: anim.duracao || null, deslocamentoCm: 0 };
    if (anim.agachar) {
      step({ crouchToggle: true });
      for (let t = 0; t < 1.0; t += dt) step({});
    }
    const porTempo = (input, dur) => {
      let next = 0;
      for (let t = 0; quadros.length < anim.quadros; t += dt) {
        const rig = step(input);
        if (t + 1e-9 >= next) {
          quadros.push(snap(rig));
          next += dur / anim.quadros;
        }
      }
    };
    if (anim.tipo === 'tempo') {
      for (let t = 0; t < 1.5; t += dt) step(anim.entrada(d));
      porTempo(anim.entrada(d), anim.duracao);
    } else if (anim.tipo === 'passada') {
      const input = anim.entrada(d);
      // aquece até a passada assentar e espera a fase virar (começo do ciclo)
      for (let t = 0; t < 2.5; t += dt) step(input);
      let prev = ch.phase;
      for (let guard = 0; guard < 4000; guard++) {
        const rig = step(input);
        if (ch.phase < prev) {
          quadros.push(snap(rig));
          break;
        }
        prev = ch.phase;
      }
      const start = { x: ch.pos.x, y: ch.pos.y };
      let k = 1;
      let steps = 0;
      prev = ch.phase;
      for (let guard = 0; guard < 4000; guard++) {
        const rig = step(input);
        steps++;
        const ph = ch.phase;
        if (ph < prev) {
          // fechou o ciclo: duração e distância de um ciclo (dois passos)
          info.duracao = steps * dt;
          info.deslocamentoCm = Math.hypot(ch.pos.x - start.x, ch.pos.y - start.y);
          break;
        }
        if (k < anim.quadros && prev < k / anim.quadros && ph >= k / anim.quadros) {
          quadros.push(snap(rig));
          k++;
        }
        prev = ph;
      }
    } else {
      // pulo e soco: do começo ao fim, com a âncora parada onde ele começou (a investida de ~7 cm do soco fica
      // desenhada no sprite, com os pés firmes; o jogo não precisa mover o personagem durante o golpe)
      for (let t = 0; t < 1.5; t += dt) step({});
      step(anim.tipo === 'pulo' ? { jump: true } : { attack: true, attackDir: dir.yaw * M.DEG });
      porTempo({}, anim.duracao);
      const r0 = quadros[0].raiz;
      const r1 = quadros[quadros.length - 1].raiz;
      info.deslocamentoCm = Math.hypot(r1.x - r0.x, r1.y - r0.y);
      info.raizFixa = true;
      for (const q of quadros) q.raiz = r0;
    }
    return { quadros, info };
  }

  /** Pontos de encaixe (em pixels do quadro). */
  function pontos(cam, rig, origem) {
    const P = (p) => {
      const q = cam.p(p);
      return { x: +(q.x - origem.x).toFixed(1), y: +(q.y - origem.y).toFixed(1) };
    };
    const hs = (PD.MODEL.HAND && PD.MODEL.HAND.size) || 1;
    const mao = (i) => M.add(rig.hand[i].o, M.scale(rig.hand[i].a, 6.5 * hs)); // meio da palma, onde se segura algo
    return {
      maoE: P(mao(0)),
      maoD: P(mao(1)),
      cabeca: P(rig.head.o),
      peito: P(rig.chest.o),
      costas: P(M.at(rig.chest, 0, -14, 4)),
      quadril: P(rig.pelvis.o),
      peE: P(rig.ankle[0]),
      peD: P(rig.ankle[1]),
    };
  }

  /** Máscara de uma vez de pintar (onde ela deixa tinta), recortada na caixa dela. */
  function mascara(canvas) {
    const W = canvas.width, H = canvas.height;
    const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const w = x1 - x0 + 1;
    const bits = new Uint8Array(w * (y1 - y0 + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) bits[(y - y0) * w + (x - x0)] = d[(y * W + x) * 4 + 3] ? 1 : 0;
    return { x0, y0, x1, y1, w, bits };
  }
  function cobre(A, B) {
    if (!A || !B || A.x1 < B.x0 || B.x1 < A.x0 || A.y1 < B.y0 || B.y1 < A.y0) return false;
    const xa = Math.max(A.x0, B.x0), xb = Math.min(A.x1, B.x1), ya = Math.max(A.y0, B.y0), yb = Math.min(A.y1, B.y1);
    for (let y = ya; y <= yb; y++) {
      const ra = (y - A.y0) * A.w - A.x0, rb = (y - B.y0) * B.w - B.x0;
      for (let x = xa; x <= xb; x++) if (A.bits[ra + x] && B.bits[rb + x]) return true;
    }
    return false;
  }

  /**
   * Camadas de um quadro. Começa da ordem de desenho e junta as vezes de pintar da mesma parte: uma vez só troca de
   * lugar com outra que não encosta nela na tela (aí a ordem entre as duas não muda nenhum pixel). Quem se cobre fica
   * sempre na ordem de antes, então empilhar as camadas dá exatamente o quadro inteiro. Uma parte ainda pode sair em
   * duas camadas quando outra passa mesmo no meio dela (ex.: a mão entre os joelhos no agachamento).
   * `partes[i]` = parte da vez i; `masks[i]` = máscara dela. Devolve [{ parte, vezes: [índices] }].
   */
  function agrupar(partes, masks) {
    const n = partes.length;
    const antes = Array.from({ length: n }, () => []);
    for (let v = 1; v < n; v++) for (let u = 0; u < v; u++) if (cobre(masks[u], masks[v])) antes[v].push(u);
    const feito = new Array(n).fill(false);
    const out = [];
    let atual = null;
    for (let c = 0; c < n; c++) {
      let pick = -1;
      let first = -1;
      for (let i = 0; i < n; i++) {
        if (feito[i] || !antes[i].every((u) => feito[u])) continue;
        if (first < 0) first = i;
        if (partes[i] === atual) {
          pick = i;
          break;
        }
      }
      if (pick < 0) {
        pick = first;
        atual = partes[pick];
        out.push({ parte: atual, vezes: [] });
      }
      feito[pick] = true;
      out[out.length - 1].vezes.push(pick);
    }
    return out;
  }

  const pausa = () => new Promise((ok) => setTimeout(ok, 0));
  const MEDIDAS = new Map(); // tamanho do quadro já medido, por classe e escala

  /**
   * Gera tudo. `opts`: { classe, pxPorCm, animacoes: [nomes], direcoes: [nomes], partes: bool | [animações],
   * aoAndar(fração, texto) }. Devolve (Promise) { manifest, arquivos: [{ nome, canvas }] }.
   */
  async function gerar(opts = {}) {
    const classe = opts.classe || 'semClasse';
    if (PD.classes && !PD.classes.list().some((c) => c.id === classe)) throw new Error(`classe "${classe}" não existe`);
    const escala = opts.pxPorCm || 2;
    const anims = ANIMACOES.filter((a) => !opts.animacoes || opts.animacoes.includes(a.nome));
    const dirs = DIRECOES.filter((d) => !opts.direcoes || opts.direcoes.includes(d.nome));
    if (!anims.length || !dirs.length) throw new Error('escolha pelo menos uma animação e uma direção');
    const comPartes = (a) => opts.partes === true || (Array.isArray(opts.partes) && opts.partes.includes(a.nome));
    const andar = opts.aoAndar || (() => {});
    const cam = new PD.IsoCamera();
    cam.zoom = escala;
    cam.dpr = 1;
    const aparencia = PD.classes ? PD.classes.appearanceOf({ classe }) : null;
    const noise = M.noise1;
    M.noise1 = () => 0; // pose sem sorteio: o mesmo quadro sai sempre igual
    try {
      const desenhar = (r, ctx, p, ax, ay, layer) => {
        const g = cam.p(p.raiz);
        ctx.save();
        ctx.translate(ax - g.x, ay - g.y);
        r.layer = layer || null;
        try {
          r.draw(ctx, p.rig, p.look, p.equipado, aparencia);
        } finally {
          r.layer = null;
          ctx.restore();
        }
      };
      const scratch = document.createElement('canvas');
      scratch.width = Math.ceil(300 * escala);
      scratch.height = Math.ceil(420 * escala);
      const sc = scratch.getContext('2d', { willReadFrequently: true });
      // cada sequência tem o próprio desenhista: a ordem das partes perto do empate lembra o quadro anterior, então ele
      // "ensaia" a sequência antes (numa animação que repete, o quadro 0 vem depois do último)
      const desenhista = (seq) => {
        const r = new PD.CharacterRenderer(cam);
        for (const p of seq.a.repete ? seq.quadros : seq.quadros.slice(0, 1)) desenhar(r, sc, p, scratch.width / 2, scratch.height / 2);
        return r;
      };
      const simular = async (aa, dd, de, ate) => {
        const out = [];
        for (const a of aa) {
          for (const d of dd) {
            out.push({ a, d, ...poses(a, d, classe) });
            andar(de + ((ate - de) * out.length) / (aa.length * dd.length), `simulando ${a.nome} (${d.nome})`);
            await pausa();
          }
        }
        return out;
      };

      // 1) tamanho do quadro: o maior desenho de TODAS as animações e direções em volta da âncora, com margem. Sai o
      // mesmo para todos os quadros e para qualquer escolha de animações (uma exportação só do "parado" encaixa com a
      // completa); fica guardado por classe e escala
      const chave = `${classe}|${escala}`;
      let medida = MEDIDAS.get(chave);
      if (!medida) {
        const todas = await simular(ANIMACOES, DIRECOES, 0, 0.15);
        const A0 = { x: Math.round(scratch.width / 2), y: scratch.height - Math.ceil(60 * escala) };
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        let n = 0;
        const nTotal = todas.reduce((s, q) => s + q.quadros.length, 0);
        for (const seq of todas) {
          const r = desenhista(seq);
          for (const p of seq.quadros) {
            sc.clearRect(0, 0, scratch.width, scratch.height);
            desenhar(r, sc, p, A0.x, A0.y);
            const W0 = scratch.width;
            const data = sc.getImageData(0, 0, W0, scratch.height).data;
            for (let y = 0; y < scratch.height; y++) {
              const row = y * W0 * 4;
              for (let x = 0; x < W0; x++) {
                if (data[row + x * 4 + 3] > 4) {
                  if (x < x0) x0 = x;
                  if (x > x1) x1 = x;
                  if (y < y0) y0 = y;
                  if (y > y1) y1 = y;
                }
              }
            }
            if (x0 <= 1 || y0 <= 1 || x1 >= W0 - 2 || y1 >= scratch.height - 2) throw new Error('o desenho saiu da área de medida');
            n++;
          }
          andar(0.15 + (0.25 * n) / nTotal, 'medindo o tamanho do quadro');
          await pausa();
        }
        const margem = Math.ceil(4 * escala);
        // largura simétrica em volta da âncora: dá para espelhar o sprite (virar de lado) sem desalinhar
        const meia = Math.max(A0.x - x0, x1 - A0.x) + 1 + margem;
        const W = Math.ceil((2 * meia) / 8) * 8;
        const baixo = Math.max(0, y1 - A0.y) + 1 + margem;
        const H = Math.ceil((A0.y - y0 + baixo + margem) / 8) * 8;
        medida = { W, H, ancora: { x: W / 2, y: H - baixo } };
        MEDIDAS.set(chave, medida);
      }
      const { W, H, ancora } = medida;

      // 2) as animações escolhidas
      const seqs = await simular(anims, dirs, 0.4, 0.45);
      const total = seqs.reduce((s, q) => s + q.quadros.length, 0);
      // 3) quadros (inteiro e, se pedido, em camadas)
      const novo = () => {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        return c;
      };
      const arquivos = [];
      const quadros = [];
      const mk = novo(); // rascunho das máscaras
      let feitos = 0;
      for (const seq of seqs) {
        const r = desenhista(seq);
        for (let k = 0; k < seq.quadros.length; k++) {
          const p = seq.quadros[k];
          const nome = nomeArquivo(classe, seq.a.nome, seq.d.nome, k);
          const c = novo();
          // as peças e as vezes de pintar montadas uma vez só: o quadro inteiro e as camadas usam exatamente as mesmas
          const items = r.prepare(c.getContext('2d'), p.rig, p.look, p.equipado, aparencia);
          const units = r._units(items);
          desenhar(r, c.getContext('2d'), p, ancora.x, ancora.y, { items, units });
          arquivos.push({ nome, canvas: c });
          const g = cam.p(p.raiz);
          const origem = { x: g.x - ancora.x, y: g.y - ancora.y };
          const q = { arquivo: nome, animacao: seq.a.nome, direcao: seq.d.nome, quadro: k, pontos: pontos(cam, p.rig, origem) };
          if (comPartes(seq.a)) {
            const partes = units.map((un) => parteDe(un.items[0].host || un.items[0]) || 'outros');
            const masks = units.map((un, u) => {
              const ctx = mk.getContext('2d', { willReadFrequently: true });
              ctx.clearRect(0, 0, W, H);
              desenhar(r, ctx, p, ancora.x, ancora.y, { items, units, pinta: (x, i) => i === u });
              return mascara(mk);
            });
            const grupos = agrupar(partes, masks);
            // camada 00: o contorno grosso de fora; depois as peças, de trás para a frente. Empilhar na ordem dos
            // números dá o quadro inteiro
            q.camadas = [];
            const cc = novo();
            desenhar(r, cc.getContext('2d'), p, ancora.x, ancora.y, { items, units, contorno: true });
            const n0 = nomeArquivo(classe, seq.a.nome, seq.d.nome, k, { ordem: 0, parte: 'contorno' });
            arquivos.push({ nome: n0, canvas: cc });
            q.camadas.push({ arquivo: n0, parte: 'contorno', pecas: [] });
            grupos.forEach((gr, j) => {
              const set = new Set(gr.vezes);
              const pc = novo();
              desenhar(r, pc.getContext('2d'), p, ancora.x, ancora.y, { items, units, pinta: (x, i) => set.has(i) });
              const pn = nomeArquivo(classe, seq.a.nome, seq.d.nome, k, { ordem: j + 1, parte: gr.parte });
              arquivos.push({ nome: pn, canvas: pc });
              const pecas = [];
              for (const i of gr.vezes) for (const it of units[i].items) if (!pecas.includes(it.name)) pecas.push(it.name);
              q.camadas.push({ arquivo: pn, parte: gr.parte, pecas });
            });
            const vistas = grupos.map((gr) => gr.parte);
            q.partesDivididas = [...new Set(vistas.filter((pt, i) => vistas.indexOf(pt) !== i))];
          }
          quadros.push(q);
          feitos++;
        }
        andar(0.45 + (0.55 * feitos) / total, 'desenhando os quadros');
        await pausa();
      }
      const manifest = {
        versao: 1,
        personagem: 'pindorama-protagonista',
        classe,
        pxPorCm: escala,
        quadro: { largura: W, altura: H, oQueE: 'o mesmo para todas as animações e direções deste personagem nesta escala (medido com todas)' },
        ancora: { x: ancora.x, y: ancora.y, oQueE: 'ponto do chão embaixo do personagem (onde ele pisa); o mesmo pixel em todos os quadros' },
        fundo: 'transparente, sem sombra no chão',
        nomes: {
          quadro: 'pindorama_<classe>_<animação>_<direção>_<NN>.png',
          camada: 'pindorama_<classe>_<animação>_<direção>_<NN>__<CC>_<parte>.png (CC = ordem: 00 é o contorno, o fundo; empilhe em ordem crescente)',
        },
        direcoes: dirs.map((d) => ({ nome: d.nome, yawGraus: d.yaw })),
        animacoes: anims.map((a) => {
          const info = seqs.find((s) => s.a === a).info;
          const dur = info.duracao;
          return {
            nome: a.nome,
            quadros: a.quadros,
            duracaoSeg: +dur.toFixed(3),
            fps: +(a.quadros / dur).toFixed(2),
            repete: a.repete,
            deslocamentoCm: +info.deslocamentoCm.toFixed(1),
            velocidadeCmPorSeg: info.raizFixa ? 0 : +(info.deslocamentoCm / dur).toFixed(1),
            movimentoNoSprite: !!info.raizFixa,
            camadas: comPartes(a),
          };
        }),
        partes: Object.keys(PARTES),
        pontosDeEncaixe: 'maoE, maoD (meio da palma), cabeca, peito, costas, quadril, peE, peD (tornozelos) — em pixels do quadro',
        quadros,
      };
      return { manifest, arquivos };
    } finally {
      M.noise1 = noise;
    }
  }

  // ---- ZIP sem compressão ("store"), para a página baixar tudo de uma vez sem biblioteca
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(b) {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  /** files: [{ nome, dados: Uint8Array }] → Uint8Array com o ZIP. */
  function zip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.nome);
      const crc = crc32(f.dados);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true);
      h.setUint16(4, 20, true);
      h.setUint16(6, 0x0800, true); // nomes em UTF-8
      h.setUint32(14, crc, true);
      h.setUint32(18, f.dados.length, true);
      h.setUint32(22, f.dados.length, true);
      h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, f.dados);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, f.dados.length, true);
      c.setUint32(24, f.dados.length, true);
      c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + f.dados.length;
    }
    const csize = central.reduce((s, b) => s + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, csize, true);
    e.setUint32(16, offset, true);
    const all = parts.concat(central, [new Uint8Array(e.buffer)]);
    const out = new Uint8Array(all.reduce((s, b) => s + b.length, 0));
    let p = 0;
    for (const b of all) {
      out.set(b, p);
      p += b.length;
    }
    return out;
  }
  function pngBytes(canvas) {
    const bin = atob(canvas.toDataURL('image/png').split(',')[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  PD.exporter = { DIRECOES, ANIMACOES, PARTES, parteDe, agrupar, cobre, nomeArquivo, poses, gerar, zip, crc32, pngBytes };
})(window.PD = window.PD || {});
