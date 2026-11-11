// Auditoria do protagonista: roda roteiros (parado, andar, correr, agachar, pular, viradas, transições, soco) e mede
// com números o que a gente só via no olho. Usa só a parte pública do personagem (Character, rig, renderer), então
// roda também em versões antigas do protótipo (para comparar antes e depois).
//
// Mede, por roteiro:
//  - ik: distância entre onde o animador quer o pé/punho e onde o esqueleto chegou (cm). Tem que ser ~0.
//  - escorregão: velocidade do ponto do pé apoiado que encosta no chão (cm/s). Tem que ser 0.
//  - ossos: variação do comprimento da coxa, canela, braço e antebraço (cm). Tem que ser 0.
//  - tranco: maior mudança brusca de velocidade de punho, cotovelo, joelho, tornozelo e cabeça (cm/quadro², 60 Hz).
//  - joelho para trás / cotovelo ao contrário: quadros em que a articulação dobra para o lado impossível.
//  - interseção: o quanto um membro entra no outro (cm), por par (perna com perna, braço com tronco, mão com coxa...).
//  - equilíbrio: distância do centro de massa ao centro dos pés apoiados, para a frente (cm).
//  - pés abaixo do chão (cm).
// E, com o desenho: trocas de ordem (uma parte que passa de trás para a frente de outra enquanto elas se cobrem).
(function (PD) {
  'use strict';
  const M = PD.math;

  const DT = 1 / 120;
  const click = (t, at) => Math.abs(t - at) < 0.5 * DT + 1e-9;
  const dirv = (deg, m = 1) => ({ x: Math.cos(deg * M.DEG) * m, y: Math.sin(deg * M.DEG) * m });

  /** Roteiros: [nome, segundos, entrada(t), yaw inicial (graus)] */
  function scenes() {
    const list = [];
    for (let k = 0; k < 8; k++) {
      const yaw = k * 45;
      list.push([`parado ${yaw}°`, 2.5, () => ({}), yaw, 'parado']);
    }
    for (let k = 0; k < 8; k++) {
      const yaw = k * 45;
      list.push([`andando ${yaw}°`, 3, () => ({ move: dirv(yaw) }), yaw, 'andar']);
    }
    for (let k = 0; k < 8; k++) {
      const yaw = k * 45;
      list.push([`correndo ${yaw}°`, 3, () => ({ move: dirv(yaw), run: true }), yaw, 'correr']);
    }
    list.push(['agachado parado', 3, (t) => ({ crouchToggle: click(t, 0.3) }), 0, 'agachar']);
    list.push(['andando agachado', 3.5, (t) => ({ crouchToggle: click(t, 0.3), move: t > 0.8 ? dirv(0) : null }), 0, 'agachar']);
    list.push(['agachando andando (transição)', 3, (t) => ({ crouchToggle: click(t, 1.0) || click(t, 2.0), move: dirv(0) }), 0, 'agachar']);
    list.push(['pulo parado', 2.2, (t) => ({ jump: click(t, 0.6) }), 0, 'pular']);
    list.push(['pulo andando', 2.4, (t) => ({ move: dirv(0), jump: click(t, 1.0) }), 0, 'pular']);
    list.push(['pulo correndo', 2.6, (t) => ({ move: dirv(0), run: true, jump: click(t, 1.2) }), 0, 'pular']);
    list.push(['pulo correndo de costas p/ câmera', 2.6, (t) => ({ move: dirv(225), run: true, jump: click(t, 1.2) }), 225, 'pular']);
    list.push(['pulo agachado (levanta e pula)', 2.6, (t) => ({ crouchToggle: click(t, 0.3), jump: click(t, 1.3) }), 0, 'pular']);
    list.push(['dois pulos seguidos', 3, (t) => ({ move: dirv(0), jump: click(t, 0.8) || click(t, 1.62) }), 0, 'pular']);
    list.push(['virada de 180° andando', 3, (t) => ({ move: dirv(t < 1.2 ? 0 : 180) }), 0, 'virar']);
    list.push(['virada de 180° correndo', 3, (t) => ({ move: dirv(t < 1.2 ? 0 : 180), run: true }), 0, 'virar']);
    list.push(['zigue-zague correndo (90°)', 3.4, (t) => ({ move: dirv(Math.floor(t / 0.6) % 2 ? 90 : 0), run: true }), 0, 'virar']);
    list.push(['virando no lugar 135°', 2.5, (t) => ({ move: t > 0.6 && t < 0.7 ? dirv(135, 0.4) : null }), 0, 'virar']);
    list.push([
      'transições: parado → anda → corre → anda → para',
      5,
      (t) => (t < 0.6 ? {} : t < 1.6 ? { move: dirv(0) } : t < 2.8 ? { move: dirv(0), run: true } : t < 3.6 ? { move: dirv(0) } : {}),
      0,
      'transicao',
    ]);
    list.push(['transições: corre → pula → continua correndo', 3.2, (t) => ({ move: dirv(0), run: true, jump: click(t, 1.4) }), 0, 'transicao']);
    list.push(['transições: corre → para de uma vez', 2.6, (t) => ({ move: t < 1.4 ? dirv(0) : null, run: t < 1.4 }), 0, 'transicao']);
    list.push(['transições: anda → agacha → levanta → corre', 4.2, (t) => ({ move: dirv(0), crouchToggle: click(t, 1.0) || click(t, 2.2), run: t > 2.6 }), 0, 'transicao']);
    list.push(['soco parado', 1.8, (t) => ({ attack: click(t, 0.5), attackDir: 0 }), 0, 'soco']);
    list.push(['combo de 4 socos', 3, (t) => ({ attack: [0.5, 0.68, 0.95, 1.22].some((a) => click(t, a)), attackDir: 0 }), 0, 'soco']);
    list.push(['soco andando', 2, (t) => ({ move: dirv(0), attack: click(t, 0.8), attackDir: 0 }), 0, 'soco']);
    list.push(['soco virando 90°', 1.8, (t) => ({ attack: click(t, 0.5), attackDir: Math.PI / 2 }), 0, 'soco']);
    return list;
  }

  // ---- geometria para interseções: pontos ao longo de cada membro com o raio do modelo naquele ponto
  function radiusAlong(spheres, t) {
    // raio do casco ao longo do osso: o maior raio das esferas perto de t (cada esfera cobre ±r/comprimento)
    let best = 0;
    for (const s of spheres) {
      const d = Math.abs(s.t - t);
      const r = s.r - d * 18; // cai 18 cm por osso inteiro de distância (aproximação do casco)
      if (r > best) best = r;
    }
    return Math.max(best, 1);
  }
  function limbSamples(lf, spheres, t0, t1, n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const t = t0 + ((t1 - t0) * k) / (n - 1);
      out.push({ p: PD.rig.limbAt(lf, t, 0, 0), r: radiusAlong(spheres, t) * 0.9 });
    }
    return out;
  }
  function frameSpheres(frame, list) {
    return list.map((s) => ({ p: M.at(frame, s.p[0], s.p[1], s.p[2]), r: s.r * 0.9 }));
  }
  function penetration(A, B) {
    let worst = -1e9;
    for (const a of A) for (const b of B) {
      const d = M.dist(a.p, b.p) - a.r - b.r;
      if (-d > worst) worst = -d;
    }
    return worst; // > 0: um entra no outro (cm)
  }

  function runScene(sc) {
    const [name, secs, input, yaw0] = sc;
    const B = PD.BODY;
    const MOD = PD.MODEL;
    const ch = new PD.Character(0, 0, yaw0 * M.DEG);
    const res = {
      name,
      kind: sc[4],
      ik: { leg: 0, arm: 0, legT: 0, armT: 0 },
      slide: 0,
      bones: {},
      jerk: {},
      kneeBack: 0,
      elbowWrong: 0,
      pen: {},
      balance: 0,
      belowGround: 0,
      frames: 0,
    };
    const bonesMin = {};
    const bonesMax = {};
    const hist = {};
    const prevContact = [null, null];
    const track = (k, p, t, every) => {
      if (!every) return;
      const h = hist[k] || (hist[k] = []);
      h.push(p);
      if (h.length > 3) h.shift();
      if (h.length === 3) {
        const j = Math.hypot(h[2].x - 2 * h[1].x + h[0].x, h[2].y - 2 * h[1].y + h[0].y, h[2].z - 2 * h[1].z + h[0].z);
        if (!res.jerk[k] || j > res.jerk[k].j) res.jerk[k] = { j, t };
      }
    };
    let frame = 0;
    for (let t = 0; t < secs; t += DT, frame++) {
      ch.update(DT, input(t, ch), null);
      const pose = ch.pose();
      const rig = PD.rig.buildRig(pose);
      ch.secondary(rig, DT);
      if (t < 0.35) continue;
      res.frames++;
      const every60 = frame % 2 === 0;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        // IK das pernas: alvo do tornozelo × tornozelo do esqueleto
        const eLeg = M.dist(pose.feet[i].pos, rig.ankle[i]);
        if (eLeg > res.ik.leg) {
          res.ik.leg = eLeg;
          res.ik.legT = t;
          res.ik.legState = ch.label + ' / pulo: ' + ch.jump.state;
        }
        // IK dos braços: alvo do punho (no mundo, ou relativo ao ombro no espaço do peito)
        const hd = pose.hands[i];
        const tgt = hd.pos || M.add(rig.shoulder[i], M.dirIn(rig.chest, side * hd.local.x, hd.local.y, hd.local.z));
        const eArm = M.dist(tgt, rig.wrist[i]);
        if (eArm > res.ik.arm) {
          res.ik.arm = eArm;
          res.ik.armT = t;
        }
        // ossos
        const L = {
          coxa: M.dist(rig.hip[i], rig.knee[i]),
          canela: M.dist(rig.knee[i], rig.ankle[i]),
          braco: M.dist(rig.shoulder[i], rig.elbow[i]),
          antebraco: M.dist(rig.elbow[i], rig.wrist[i]),
        };
        for (const k of Object.keys(L)) {
          bonesMin[k] = Math.min(bonesMin[k] ?? 1e9, L[k]);
          bonesMax[k] = Math.max(bonesMax[k] ?? -1e9, L[k]);
        }
        // escorregão do ponto que encosta no chão (pé preso)
        const st = ch.footLock[i];
        const planted = st.planted && !st.step && ch.jump.state !== 'ar';
        const heel = M.at(rig.foot[i], 0, -B.heelBack, -B.ankleHeight);
        const ball = M.at(rig.foot[i], 0, B.ballFwd, -B.ankleHeight);
        if (planted && prevContact[i]) {
          const vh = Math.hypot(heel.x - prevContact[i].h.x, heel.y - prevContact[i].h.y) / DT;
          const vb = Math.hypot(ball.x - prevContact[i].b.x, ball.y - prevContact[i].b.y) / DT;
          const flat = 2 * M.DEG;
          const pitch = pose.feet[i].pitch;
          const v = pitch > flat ? vh : pitch < -flat ? vb : Math.min(vh, vb);
          if (v > res.slide) {
            res.slide = v;
            res.slideAt = { t: +t.toFixed(3), pe: i, pitch: +(pitch / M.DEG).toFixed(1), ik: +M.dist(pose.feet[i].pos, rig.ankle[i]).toFixed(2), vh: +vh.toFixed(1), vb: +vb.toFixed(1) };
          }
        }
        prevContact[i] = planted ? { h: heel, b: ball } : null;
        // pé abaixo do chão
        const toeTip = M.at(rig.toe[i], 0, 4.3, 0);
        res.belowGround = Math.max(res.belowGround, -(Math.min(heel.z, ball.z, toeTip.z) - (ch.groundZ || 0)) - 0.6);
        // joelho dobrando para trás: o joelho sai da linha quadril–tornozelo para trás do corpo
        {
          const a = rig.hip[i];
          const b = rig.ankle[i];
          const ab = M.sub(b, a);
          const l2 = M.dot(ab, ab) || 1;
          const proj = M.add(a, M.scale(ab, M.dot(M.sub(rig.knee[i], a), ab) / l2));
          const off = M.sub(rig.knee[i], proj);
          if (M.len(off) > 1.2 && M.dot(M.norm(off), rig.pelvis.f) < -0.35) res.kneeBack++;
        }
        // cotovelo ao contrário: o antebraço dobra para trás do braço (hiperextensão)
        {
          const ua = M.norm(M.sub(rig.elbow[i], rig.shoulder[i]));
          const fa = M.sub(rig.wrist[i], rig.elbow[i]);
          const bendDir = M.sub(fa, M.scale(ua, M.dot(fa, ua)));
          const ant0 = M.sub(rig.chest.f, M.scale(ua, M.dot(rig.chest.f, ua)));
          const ant = M.len(ant0) > 0.35 ? M.norm(ant0) : M.norm(M.sub(rig.chest.u, M.scale(ua, M.dot(rig.chest.u, ua))));
          if (M.len(bendDir) > 2.5 && M.dot(M.norm(bendDir), ant) < -0.45) res.elbowWrong++;
        }
        track('punho ' + (i ? 'D' : 'E'), rig.wrist[i], t, every60);
        track('cotovelo ' + (i ? 'D' : 'E'), rig.elbow[i], t, every60);
        track('joelho ' + (i ? 'D' : 'E'), rig.knee[i], t, every60);
        track('tornozelo ' + (i ? 'D' : 'E'), rig.ankle[i], t, every60);
      }
      track('cabeça', rig.head.o, t, every60);

      // interseções (a cada 2 quadros)
      if (every60) {
        const limbs = [0, 1].map((i) => ({
          coxa: limbSamples(rig.thigh[i], MOD.THIGH, 0.38, 1, 6),
          canela: limbSamples(rig.shin[i], MOD.SHIN, 0, 1, 7),
          braco: limbSamples(rig.upperArm[i], MOD.UPPER_ARM, 0.45, 1, 5),
          antebraco: limbSamples(rig.forearm[i], MOD.FOREARM, 0, 1, 6),
          mao: [{ p: M.add(rig.hand[i].o, M.scale(rig.hand[i].a, 5)), r: 4.2 }],
        }));
        const chest = frameSpheres(rig.chest, MOD.CHEST.filter((s) => !s.shoulder));
        const pelvis = frameSpheres(rig.pelvis, MOD.PELVIS);
        const torso = chest.concat(pelvis);
        const pairs = {
          'perna com perna (coxa)': penetration(limbs[0].coxa, limbs[1].coxa),
          'perna com perna (canela)': Math.max(penetration(limbs[0].canela, limbs[1].canela), penetration(limbs[0].canela, limbs[1].coxa), penetration(limbs[1].canela, limbs[0].coxa)),
          'antebraço com tronco': Math.max(penetration(limbs[0].antebraco, torso), penetration(limbs[1].antebraco, torso)),
          'mão com tronco': Math.max(penetration(limbs[0].mao, torso), penetration(limbs[1].mao, torso)),
          'braço com tronco': Math.max(penetration(limbs[0].braco, chest), penetration(limbs[1].braco, chest)),
          'mão/antebraço com coxa': Math.max(
            penetration(limbs[0].mao.concat(limbs[0].antebraco), limbs[0].coxa.concat(limbs[1].coxa)),
            penetration(limbs[1].mao.concat(limbs[1].antebraco), limbs[0].coxa.concat(limbs[1].coxa)),
          ),
          'braço com braço': Math.max(penetration(limbs[0].antebraco.concat(limbs[0].mao), limbs[1].antebraco.concat(limbs[1].mao))),
        };
        for (const k of Object.keys(pairs)) {
          if (!res.pen[k] || pairs[k] > res.pen[k].d) res.pen[k] = { d: pairs[k], t };
        }
        // equilíbrio: centro de massa × centro dos pés apoiados (para a frente do corpo)
        const planted = [0, 1].filter((i) => ch.footLock[i].planted && !ch.footLock[i].step);
        if (planted.length === 2 && ch.jump.state === 'chao' && !ch.attack) {
          const mass = [];
          const add = (p, m) => mass.push({ p, m });
          add(rig.head.o, 8);
          add(rig.chest.o, 28);
          add(rig.pelvis.o, 22);
          for (let i = 0; i < 2; i++) {
            add(M.lerp3(rig.shoulder[i], rig.elbow[i], 0.5), 2.8);
            add(M.lerp3(rig.elbow[i], rig.wrist[i], 0.5), 1.6);
            add(rig.wrist[i], 0.6);
            add(M.lerp3(rig.hip[i], rig.knee[i], 0.45), 10);
            add(M.lerp3(rig.knee[i], rig.ankle[i], 0.45), 4.6);
            add(M.at(rig.foot[i], 0, 3, -3), 1.4);
          }
          let tm = 0;
          const com = { x: 0, y: 0 };
          for (const q of mass) {
            com.x += q.p.x * q.m;
            com.y += q.p.y * q.m;
            tm += q.m;
          }
          com.x /= tm;
          com.y /= tm;
          let sx = 0;
          let sy = 0;
          for (const i of planted) {
            const c = M.at(rig.foot[i], 0, (B.ballFwd - B.heelBack) / 2, -B.ankleHeight);
            sx += c.x / 2;
            sy += c.y / 2;
          }
          const f = rig.body.f;
          const off = (com.x - sx) * f.x + (com.y - sy) * f.y;
          if (Math.abs(off) > Math.abs(res.balance)) res.balance = off;
        }
      }
    }
    for (const k of Object.keys(bonesMin)) res.bones[k] = bonesMax[k] - bonesMin[k];
    return res;
  }

  const areaOf = (p) => {
    let a = 0;
    for (let k = 0; k < p.length; k += 2) {
      const j = (k + 2) % p.length;
      a += p[k] * p[j + 1] - p[j] * p[k + 1];
    }
    return Math.abs(a) / 2;
  };
  /** Área (px²) em que duas partes se cobrem na tela: soma das interseções dos pedaços (todos convexos). */
  function overlapArea(A, B) {
    let a = 0;
    for (const sa of A.segs || []) {
      if (!sa.poly || sa.poly.length < 6) continue;
      for (const sb of B.segs || []) {
        if (!sb.poly || sb.poly.length < 6) continue;
        const c = PD.shapes.clipConvex(sa.poly, sb.poly);
        if (c.length >= 6) a += areaOf(c);
      }
    }
    return a;
  }
  const itemArea = (it) => (it.segs || []).reduce((s, sg) => s + (sg.poly && sg.poly.length >= 6 ? areaOf(sg.poly) : 0), 0);

  /** Trocas de ordem de desenho entre partes que se cobrem (o "pulo" de uma parte para a frente de outra). */
  function orderPops(sc, zoom = 1.6) {
    const [name, secs, input, yaw0] = sc;
    const cam = new PD.IsoCamera();
    cam.zoom = zoom;
    cam.dpr = 1;
    const r = new PD.CharacterRenderer(cam);
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    r._setup(canvas.getContext('2d'));
    const ch = new PD.Character(0, 0, yaw0 * M.DEG);
    let prev = null;
    let pops = 0;
    let frames = 0;
    let legSplit = 0; // quadros em que alguma perna sai desenhada em mais de uma vez (emenda no joelho/tornozelo)
    const worst = [];
    const bbox = (it) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const s of it.segs || []) {
        const p = s.poly;
        for (let k = 0; k < p.length; k += 2) {
          if (p[k] < x0) x0 = p[k];
          if (p[k] > x1) x1 = p[k];
          if (p[k + 1] < y0) y0 = p[k + 1];
          if (p[k + 1] > y1) y1 = p[k + 1];
        }
      }
      return x1 > x0 ? { x0, y0, x1, y1, a: (x1 - x0) * (y1 - y0) } : null;
    };
    for (let t = 0; t < secs; t += DT) {
      ch.update(DT, input(t, ch), null);
      const rig = PD.rig.buildRig(ch.pose());
      ch.secondary(rig, DT);
      if (t < 0.35) continue;
      const items = r._sorted(r._items(rig, ch.look));
      frames++;
      for (const g of ['perna0', 'perna1']) {
        const idx = items.map((it, k) => (it.group === g ? k : -1)).filter((k) => k >= 0);
        if (idx.length > 1 && idx[idx.length - 1] - idx[0] !== idx.length - 1) {
          legSplit++;
          break;
        }
      }
      const cur = new Map();
      items.forEach((it, idx) => {
        if (!it.segs) return;
        const key = it.name + ':' + (it.group || '');
        if (!cur.has(key)) cur.set(key, { idx, bb: bbox(it), group: it.group || '', it });
      });
      if (prev) {
        const keys = [...cur.keys()];
        for (let a = 0; a < keys.length; a++) {
          for (let b = a + 1; b < keys.length; b++) {
            const A = cur.get(keys[a]);
            const Bq = cur.get(keys[b]);
            if (!A.bb || !Bq.bb) continue;
            if (A.group && A.group === Bq.group) continue;
            const pa = prev.get(keys[a]);
            const pb = prev.get(keys[b]);
            if (!pa || !pb) continue;
            if (Math.sign(A.idx - Bq.idx) === Math.sign(pa.idx - pb.idx)) continue;
            const ix = Math.min(A.bb.x1, Bq.bb.x1) - Math.max(A.bb.x0, Bq.bb.x0);
            const iy = Math.min(A.bb.y1, Bq.bb.y1) - Math.max(A.bb.y0, Bq.bb.y0);
            if (ix <= 0 || iy <= 0) continue;
            // área de verdade em que as duas se cobrem (não a caixa): uma troca de ordem só aparece onde elas se cobrem
            const frac = overlapArea(A.it, Bq.it) / Math.max(1, Math.min(itemArea(A.it), itemArea(Bq.it)));
            if (frac < 0.15) continue;
            pops++;
            worst.push({ t: +t.toFixed(2), par: keys[a].split(':')[0] + ' × ' + keys[b].split(':')[0], frac: +frac.toFixed(2) });
          }
        }
      }
      prev = cur;
    }
    worst.sort((x, y) => y.frac - x.frac);
    return { name, pops, legSplit: frames ? legSplit / frames : 0, worst: worst.slice(0, 4) };
  }

  /** Silhueta em vários zooms comparada com a de zoom alto (mesmo tamanho): 1 = idêntica. */
  function zoomIdentity(yaw = 30, zooms = [0.6, 0.8, 1.0, 1.2, 1.6], ref = 2.4) {
    const ch = new PD.Character(0, 0, yaw * M.DEG);
    ch.time = 5;
    for (let t = 0; t < 0.6; t += DT) {
      ch.update(DT, {}, null);
      const rig = PD.rig.buildRig(ch.pose());
      ch.secondary(rig, DT);
    }
    const rig = PD.rig.buildRig(ch.pose());
    const W = 360;
    const H = 520;
    const render = (z) => {
      const cam = new PD.IsoCamera();
      cam.zoom = z;
      cam.dpr = 1;
      const rr = new PD.CharacterRenderer(cam);
      const c = document.createElement('canvas');
      c.width = Math.ceil((W * z) / ref);
      c.height = Math.ceil((H * z) / ref);
      const ctx = c.getContext('2d');
      const fp = cam.p(rig.pelvis.o);
      ctx.translate(c.width / 2 - fp.x, c.height * 0.55 - fp.y);
      rr.draw(ctx, rig, ch.look);
      // leva para o tamanho de referência
      const big = document.createElement('canvas');
      big.width = W;
      big.height = H;
      const bx = big.getContext('2d');
      bx.imageSmoothingEnabled = true;
      bx.drawImage(c, 0, 0, W, (c.height * W) / c.width);
      return bx.getImageData(0, 0, W, H).data;
    };
    const R = render(ref);
    const out = {};
    for (const z of zooms) {
      const D = render(z);
      let inter = 0;
      let uni = 0;
      for (let k = 3; k < R.length; k += 4) {
        const a = R[k] > 127;
        const b = D[k] > 127;
        if (a && b) inter++;
        if (a || b) uni++;
      }
      out[z] = +(inter / Math.max(1, uni)).toFixed(3);
    }
    return out;
  }

  function runAll(opts = {}) {
    const list = scenes().filter((s) => !opts.only || opts.only.some((o) => s[0].includes(o)));
    const results = list.map(runScene);
    let pops = [];
    if (opts.pops !== false && PD.CharacterRenderer) {
      const pick = list.filter((s) => /^(andando (0|90|180|270)°|correndo (45|225)°|virada|zigue|soco virando|combo|pulo correndo$|agachado parado)/.test(s[0]));
      pops = pick.map((s) => orderPops(s));
    }
    const zoom = opts.zoom !== false && PD.CharacterRenderer ? { '30°': zoomIdentity(30), '200°': zoomIdentity(200) } : null;
    return { results, pops, zoom };
  }

  PD.audit = { scenes, runScene, orderPops, zoomIdentity, runAll };
})(window.PD = window.PD || {});
