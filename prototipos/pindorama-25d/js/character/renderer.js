// Desenha o personagem a partir do esqueleto: cada parte vira um casco de círculos com contorno de tinta,
// sombra em meia-lua e brilho (estilo HQ). As partes são ordenadas pela distância até a câmera a cada
// quadro, então um braço passa na frente ou atrás do tronco conforme o personagem vira.
//
// Ordem do desenho:
//  1. contorno grosso de TODAS as partes (vira a silhueta de fora, mais grossa do lado da sombra);
//  2. parte por parte, da mais longe para a mais perto: contorno fino + pintura + detalhes.
// A pintura de cada parte cobre o contorno grosso por dentro; ele só sobra na borda de fora. O contorno
// fino vira as linhas de dentro (braço na frente do peito, mão sobre a coxa).
(function (PD) {
  'use strict';
  const M = PD.math;
  const S = PD.shapes;
  const { add, sub, scale, dot, norm, cross, at, dirIn, clamp, clamp01, smoothstep, mix } = M;
  const { limbAt } = PD.rig;
  const MOD = PD.MODEL;
  const PAL = PD.PALETTE;
  const K = PD.ISO_K;
  /** Peso da altura na ordem de desenho entre as partes do corpo (menor que o da câmera: veja `keyOf`). */
  const Z_WEIGHT = 0.15;
  /** Base da cabeça com os eixos esticados por `s`: tudo o que é da cabeça cresce junto (BODY.headScale). */
  const scaledFrame = (fr, s) => ({ o: fr.o, r: scale(fr.r, s), f: scale(fr.f, s), u: scale(fr.u, s) });

  class CharacterRenderer {
    constructor(cam) {
      this.cam = cam;
      this.showBones = false;
    }

    // ---------------------------------------------------------------- utilidades de projeção
    _setup(ctx) {
      const cam = this.cam;
      this.ctx = ctx;
      this.zoom = cam.zoom;
      this.light = cam.lightScreen;
      this.toCam = cam.toCamera;
      // espessuras de linha (px): silhueta e linhas de dentro
      this.inkOut = clamp(1.05 * this.zoom, 0.8, 3.4);
      this.inkIn = clamp(0.55 * this.zoom, 0.5, 2);
      this.density = (cam.dpr || 1) * 0.9;
      // nível de detalhe: riscos miúdos (dedos, artelhos, músculos) só quando o personagem está grande
      this.fine = this.zoom * (cam.dpr || 1) >= 1.25;
    }
    P(pt) {
      return this.cam.p(pt);
    }
    /**
     * Ordem entre as partes: a distância horizontal até a câmera, com um pouco da altura. Se a altura
     * pesasse como na câmera (0,5), o peito (alto) passaria sempre na frente do braço caído ao lado dele.
     */
    keyOf(pt) {
      return (pt.x + pt.y) * K * this.cam.cosP + pt.z * Z_WEIGHT;
    }
    circle(pt, r) {
      const q = this.P(pt);
      return { x: q.x, y: q.y, r: r * this.zoom };
    }
    hull(circles) {
      this._last = circles;
      return S.circleHull(circles, this.density);
    }
    /** Contorno como preenchimento: casco dos mesmos círculos, maiores (e puxados para o lado da sombra). */
    outlinePoly(seg, w, heavy) {
      const L = this.light;
      const dx = heavy ? -L.x * w * 0.42 : 0;
      const dy = heavy ? -L.y * w * 0.42 : 0;
      return S.offsetConvex(seg.poly, w, dx, dy);
    }
    facing(n) {
      return dot(n, this.toCam);
    }

    // ---------------------------------------------------------------- materiais com profundidade
    /** Pele um pouco mais escura no lado de lá (ajuda a ler qual braço está na frente). */
    skinFor(sideVec) {
      const d = dot(sideVec, this.toCam);
      const t = smoothstep(-0.05, -0.75, d);
      if (t <= 0.01) return PAL.skin;
      return { base: mix(PAL.skin.base, PAL.skinFar.base, t), shade: mix(PAL.skin.shade, PAL.skinFar.shade, t), light: mix(PAL.skin.light, PAL.skinFar.light, t) };
    }

    // ---------------------------------------------------------------- montagem das partes
    _items(rig, look) {
      const items = [];
      const hs = PD.BODY.headScale;
      const head = scaledFrame(rig.head, hs);
      this.H = head;
      this.hs = hs;
      const headKey = this.keyOf(head.o);

      // ---- cabeça
      const headCircles = MOD.HEAD.spheres.map((s) => this.circle(at(head, ...s.p), s.r * hs));
      items.push({ name: 'cabeca', key: headKey, group: 'cabeca', segs: [{ poly: this.hull(headCircles), circles: this._last, mat: PAL.skin, k: 0.24, decal: (seg) => this._face(rig, look, seg) }] });

      // ---- orelhas
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const e = MOD.HEAD.ear;
        const c = at(head, side * e.p[0], e.p[1], e.p[2]);
        const n = scale(rig.head.r, side);
        const key = this.keyOf(c) - 3;
        items.push({
          name: 'orelha', key, group: 'orelha' + i,
          segs: [{ poly: this.hull([this.circle(c, e.r * hs), this.circle(at(head, side * (e.p[0] - 1.4), e.p[1] + 0.6, e.p[2] - 2.2), e.r * 0.72 * hs)]), circles: this._last, mat: PAL.skin, k: 0.3, decal: (seg) => this._ear(seg, c, n, rig.head) }],
        });
        items.push({ name: 'brinco', key: key + 0.2, draw: () => this._earring(rig, look, i) });
      }

      // ---- cabelo: massa de trás (com as pontas) e a frente (touca, franja e costeletas)
      const wind = look.hairWind || { x: 0, y: 0, z: 0 };
      const massCircles = MOD.HAIR.mass.map((s) => this.circle(at(head, ...s.p), s.r * hs));
      const massPoly = this.hull(massCircles);
      const hairSegs = [{ poly: massPoly, mat: PAL.hair, k: 0.22 }];
      for (const sp of MOD.HAIR.spikes) {
        const root = at(head, ...sp.root);
        const tipL = sp.tip;
        const sway = 0.55 + (tipL[2] > 10 ? 0.3 : 0);
        const tip = add(at(head, ...tipL), scale(wind, sway));
        const mid = M.lerp3(root, tip, 0.55);
        const rootC = this.circle(root, sp.r * hs);
        hairSegs.push({ poly: this.hull([rootC, this.circle(mid, sp.r * 0.58 * hs), this.circle(tip, 0.9)]), circles: this._last, mat: PAL.hair, k: 0.3, joint: { pt: rootC, r: rootC.r * 1.6 }, noInner: !this.fine || tipL[2] > -2 }); // só as mechas de baixo ganham linha
      }
      const massKey = this.keyOf(at(head, 0, -6, 0)) - 0.5;
      items.push({ name: 'cabelo', key: massKey, group: 'cabeloTras', chain: true, segs: hairSegs, after: (segs) => this._hairStrands(rig, segs[0].poly) });

      const facingFront = this.facing(rig.head.f);
      const frontSegs = [];
      const cap = this._capPoly(head);
      if (cap) frontSegs.push({ poly: cap.poly, path: cap.path, mat: PAL.hair, k: 0.2, isCap: true, concave: true });
      for (const lk of MOD.HAIR.locks) {
        if (!lk.side && facingFront < -0.25) continue; // franja virada para trás: escondida pela massa
        const pts = lk.pts.map((p, j) => {
          const w = j === 2 ? 0.35 : j === 1 ? 0.15 : 0;
          return add(at(head, ...p), scale(wind, w));
        });
        frontSegs.push({ poly: this.hull(pts.map((p, j) => this.circle(p, lk.r[j] * hs))), circles: this._last, mat: PAL.hair, k: 0.34 });
      }
      items.push({ name: 'cabeloFrente', key: headKey + 0.3, group: 'cabeloFrente', chain: true, segs: frontSegs, clipOut: massPoly, after: (segs) => this._hairSheen(rig, segs) });

      // ---- penas (lado direito da cabeça)
      for (let j = 0; j < MOD.FEATHERS.list.length; j++) {
        const fd = this._feather(rig, look, j);
        items.push({ name: 'pena', key: this.keyOf(fd.mid), group: 'pena' + j, segs: [{ poly: fd.poly, mat: fd.mat, k: 0.22, concave: true, decal: (seg) => this._featherDetail(seg, fd) }] });
      }
      items.push({ name: 'amarracao', key: this.keyOf(at(head, ...MOD.FEATHERS.root)) + 0.4, draw: () => this._featherTie(rig) });

      // ---- pescoço (sempre atrás do peito e da cabeça)
      const chestKey = this.keyOf(rig.chest.o);
      const headBase = at(head, ...MOD.HEAD.neckBase);
      const neckPoly = this.hull([this.circle(rig.neckBase, MOD.NECK.r0), this.circle(M.lerp3(rig.neckBase, headBase, 0.5), (MOD.NECK.r0 + MOD.NECK.r1) / 2), this.circle(headBase, MOD.NECK.r1)]);
      items.push({ name: 'pescoco', key: Math.min(headKey, chestKey) - 2, group: 'pescoco', segs: [{ poly: neckPoly, mat: PAL.skin, k: 0.32, decal: (seg) => this._neckShadow(seg, rig, headCircles) }] });

      // ---- tronco: peito e pelve (a tanga é pintada na pelve)
      const chestPoly = this.hull(MOD.CHEST.map((s) => this.circle(at(rig.chest, ...s.p), s.r)));
      const pelvisPoly = this.hull(MOD.PELVIS.map((s) => this.circle(at(rig.pelvis, ...s.p), s.r)));
      const waistJoint = { pt: this.P(at(rig.chest, ...MOD.CHEST[0].p)), r: MOD.CHEST[0].r * 1.25 * this.zoom };
      items.push({ name: 'peito', key: chestKey, group: 'tronco', order: 1, joint: waistJoint, segs: [{ poly: chestPoly, mat: PAL.skin, k: 0.26, decal: (seg) => this._chestDetail(seg, rig) }] });
      const pelvisKey = this.keyOf(rig.pelvis.o) + 1;
      items.push({ name: 'pelve', key: pelvisKey, group: 'tronco', order: 0, segs: [{ poly: pelvisPoly, mat: PAL.skin, k: 0.26, decal: (seg) => this._loincloth(seg, rig, look) }] });
      items.push({ name: 'colar', key: chestKey + 0.5, draw: () => this._necklace(rig, look) });

      // ---- braços e pernas (cada lado)
      const thighKeys = [0, 1].map((i) => this.keyOf(limbAt(rig.thigh[i], 0.5, 0, 0)));
      const thighMax = Math.max(...thighKeys);
      const thighKeyOf = (i) => (thighKeys[i] < pelvisKey - 0.6 ? thighKeys[i] : pelvisKey - 0.6 - (thighMax - thighKeys[i]) * 0.1);
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const sideVec = scale(rig.body.r, side);
        const skin = this.skinFor(sideVec);
        const ua = rig.upperArm[i];
        const fa = rig.forearm[i];
        const uaCircles = MOD.UPPER_ARM.map((s) => this.circle(limbAt(ua, s.t, s.f, s.o), s.r));
        const faCircles = MOD.FOREARM.map((s) => this.circle(limbAt(fa, s.t, s.f, s.o), s.r));
        const elbow = { pt: this.P(rig.elbow[i]), r: MOD.UPPER_ARM[3].r * 1.3 * this.zoom };
        items.push({ name: 'braco', key: this.keyOf(limbAt(ua, 0.5, 0, 0)) + 5.5, group: 'braco' + i, order: 0, segs: [{ poly: this.hull(uaCircles), circles: this._last, mat: skin, k: 0.3, decal: (seg) => this._upperArmPaint(seg, rig, i) }] });
        items.push({ name: 'antebraco', key: this.keyOf(limbAt(fa, 0.6, 0, 0)) + 5.5, group: 'braco' + i, order: 1, joint: elbow, bent: dot(ua.a, fa.a) < 0.45, segs: [{ poly: this.hull(faCircles), circles: this._last, mat: skin, k: 0.3, decal: (seg) => this._band(seg, fa, MOD.BODY_PAINT.forearmBand, 4.6) }] });
        const hd = rig.hand[i];
        const fistCenter = add(hd.o, scale(hd.a, 5));
        const fistCircles = MOD.FIST.map((s) => this.circle(add(add(add(hd.o, scale(hd.a, s.a)), scale(hd.d, s.d)), scale(hd.s, s.s)), s.r));
        items.push({ name: 'mao', key: this.keyOf(fistCenter) + 6, group: 'mao' + i, segs: [{ poly: this.hull(fistCircles), circles: this._last, mat: skin, k: 0.3, decal: (seg) => this._fistDetail(seg, hd) }] });

        const th = rig.thigh[i];
        const sh = rig.shin[i];
        const thCircles = MOD.THIGH.map((s) => this.circle(limbAt(th, s.t, s.f, s.o), s.r));
        const shCircles = MOD.SHIN.map((s) => this.circle(limbAt(sh, s.t, s.f, s.o), s.r));
        const ft = rig.foot[i];
        const ftCircles = MOD.FOOT.map((s) => this.circle(at(ft, -side * s.s, s.f, s.u), s.r));
        const knee = { pt: this.P(rig.knee[i]), r: MOD.THIGH[4].r * 1.3 * this.zoom };
        const ankle = { pt: this.P(rig.ankle[i]), r: MOD.SHIN[3].r * 1.5 * this.zoom };
        items.push({ name: 'coxa', key: thighKeyOf(i), group: 'perna' + i, order: 0, segs: [{ poly: this.hull(thCircles), circles: this._last, mat: skin, k: 0.3 }] });
        items.push({ name: 'canela', key: this.keyOf(limbAt(sh, 0.5, 0, 0)) + 0.3, group: 'perna' + i, order: 1, joint: knee, bent: dot(th.a, sh.a) < 0.45, segs: [{ poly: this.hull(shCircles), circles: this._last, mat: skin, k: 0.3, decal: (seg) => this._band(seg, sh, MOD.BODY_PAINT.calfBand, 5.5) }] });
        items.push({ name: 'pe', key: this.keyOf(at(ft, 0, 6, -2)) + 0.6, group: 'perna' + i, order: 2, joint: ankle, segs: [{ poly: this.hull(ftCircles), circles: this._last, mat: skin, k: 0.3, decal: (seg) => this._toes(seg, ft, side) }] });
      }
      return items;
    }

    // ---------------------------------------------------------------- desenho
    /**
     * Desenha o personagem. `look` traz piscar, vento no cabelo, molas das penas etc.;
     * `equipped` = { slot: id do item } (veja js/character/equipment.js).
     */
    draw(ctx, rig, look, equipped) {
      this._setup(ctx);
      let items = this._sorted(this._items(rig, look));
      if (equipped && Object.keys(equipped).length && PD.equipment) {
        // cada peça entra logo depois da parte do corpo que ela veste
        const eq = PD.equipment.drawItems(this, rig, equipped, items);
        if (eq.hides.size) items = items.filter((it) => !eq.hides.has(it.name));
        for (const e of eq.items) {
          let idx = items.indexOf(e.host);
          if (idx < 0) {
            items.push(e);
            continue;
          }
          while (idx + 1 < items.length && e.host.group && items[idx + 1].group === e.host.group) idx++;
          while (idx + 1 < items.length && items[idx + 1].equipFor === e.host) idx++;
          e.equipFor = e.host;
          items.splice(idx + 1, 0, e);
        }
      }
      const ink = PAL.ink;

      const skip = this.debugSkip || {};
      // 1) silhueta: contorno grosso de todas as partes
      if (!skip.outline) {
        ctx.fillStyle = ink;
        const all = new Path2D();
        for (const it of items) {
          if (!it.segs) continue;
          for (const s of it.segs) {
            if (!s.poly || s.poly.length < 6 || s.isCap) continue;
            if (s.circles) S.polyPath(this.outlinePoly(s, this.inkOut, true), 0, 0, all);
            else S.inkOutline(ctx, s.poly, ink, this.inkOut, this.light);
          }
        }
        ctx.fillStyle = ink;
        ctx.fill(all);
      }

      // 2) parte por parte; partes vizinhas do mesmo membro viram uma corrente só (sem emenda na junta)
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.draw) {
          it.draw();
          continue;
        }
        const run = [it];
        while (i + 1 < items.length && items[i + 1].group && items[i + 1].group === it.group && items[i + 1].segs && Math.abs((items[i + 1].order ?? 0) - (run[run.length - 1].order ?? 0)) === 1) {
          run.push(items[++i]);
        }
        this._drawRun(run);
      }

      if (this.showBones) this._bones(rig);
    }

    /**
     * Ordena as partes. Os pedaços de um mesmo membro que estão quase à mesma distância andam juntos
     * (viram uma peça só, sem emenda no cotovelo ou no joelho); se um pedaço passa bem na frente do
     * resto (o antebraço do soco na frente do peito), ele se separa e é desenhado na hora certa.
     */
    _sorted(items) {
      const groups = new Map();
      for (const it of items) {
        it.sortKey = it.key;
        it.subKey = 0;
        if (!it.group || !/^(braco|perna)/.test(it.group)) continue;
        if (!groups.has(it.group)) groups.set(it.group, []);
        groups.get(it.group).push(it);
      }
      for (const [name, list] of groups) {
        const keys = list.map((it) => it.key);
        const spread = Math.max(...keys) - Math.min(...keys);
        const limit = name.startsWith('braco') ? 6 : 11;
        if (spread > limit) continue;
        const gk = name.startsWith('perna') ? list.find((it) => it.name === 'coxa').key : Math.max(...keys);
        for (const it of list) {
          it.subKey = it.key;
          it.sortKey = gk;
        }
      }
      return items.sort((a, b) => a.sortKey - b.sortKey || a.subKey - b.subKey);
    }

    _drawRun(run) {
      const ctx = this.ctx;
      const ink = PAL.ink;
      const segs = [];
      const joints = [];
      for (const it of run) {
        for (const s of it.segs) {
          segs.push(Object.assign(s, { item: it }));
          if (s.joint) joints.push(s.joint);
        }
        if (it.joint) joints.push(it.joint);
      }
      const chain = run.length > 1 || run[0].chain;
      const clipOut = run[0].clipOut;
      // contorno fino de todas (as juntas somem porque a pintura de todas vem depois)
      ctx.save();
      if (clipOut) {
        const p = new Path2D();
        p.rect(-1e5, -1e5, 2e5, 2e5);
        S.polyPath(clipOut, 0, 0, p);
        ctx.clip(p, 'evenodd');
      }
      const thin = new Path2D();
      for (const s of segs) {
        if (s.poly.length < 6) continue;
        if (s.circles) S.polyPath(this.outlinePoly(s, this.inkIn, false), 0, 0, thin);
        else S.inkOutline(ctx, s.poly, ink, this.inkIn, null);
      }
      ctx.fillStyle = ink;
      ctx.fill(thin);
      ctx.restore();
      // pintura e detalhes
      for (const s of segs) {
        if (s.poly.length < 6) continue;
        const r = S.polyRadius(s.poly);
        // cascos são convexos: sombra e brilho sem máscara (bem mais leve); o resto usa a máscara
        s.path = s.concave ? S.paintVolume(ctx, s.poly, s.mat, this.light, r * s.k, s.opts) : S.paintConvex(ctx, s.poly, s.mat, this.light, r * s.k, s.opts);
        if (s.decal && !(this.debugSkip && this.debugSkip.decals)) {
          ctx.save();
          ctx.clip(s.path);
          s.decal(s);
          ctx.restore();
        }
      }
      // linhas de dentro entre os pedaços da corrente (menos perto das juntas)
      if (chain && segs.length > 1 && !(run[0].group && /^(braco|perna|tronco)/.test(run[0].group) && !run.some((it) => it.bent))) {
        for (let i = 1; i < segs.length; i++) {
          if (segs[i].noInner || segs[i].poly.length < 6) continue;
          ctx.save();
          const union = new Path2D();
          for (let j = 0; j < i; j++) S.polyPath(segs[j].poly, 0, 0, union);
          ctx.clip(union);
          if (joints.length || clipOut) {
            const hole = new Path2D();
            hole.rect(-1e5, -1e5, 2e5, 2e5);
            for (const jt of joints) {
              hole.moveTo(jt.pt.x + jt.r, jt.pt.y);
              hole.arc(jt.pt.x, jt.pt.y, jt.r, 0, M.TAU);
            }
            if (clipOut) S.polyPath(clipOut, 0, 0, hole);
            ctx.clip(hole, 'evenodd');
          }
          ctx.lineJoin = 'round';
          ctx.strokeStyle = ink;
          ctx.lineWidth = this.inkIn * 1.6;
          ctx.stroke(S.polyPath(segs[i].poly));
          ctx.restore();
        }
      }
      for (const it of run) if (it.after) it.after(it.segs);
    }

    // ---------------------------------------------------------------- rosto
    /** Ponto da superfície da frente da cabeça em (x, z) locais; devolve o ponto do mundo e a normal. */
    _faceAt(head, x, z, lift = 0.05) {
      let best = null;
      for (const s of MOD.HEAD.spheres) {
        const dx = x - s.p[0];
        const dz = z - s.p[2];
        const q = s.r * s.r - dx * dx - dz * dz;
        if (q <= 0) continue;
        const y = s.p[1] + Math.sqrt(q);
        if (!best || y > best.y) best = { y, s };
      }
      if (!best) return null;
      const s = best.s;
      const nl = { x: (x - s.p[0]) / s.r, y: (best.y - s.p[1]) / s.r, z: (z - s.p[2]) / s.r };
      const n = norm(dirIn(head, nl.x, nl.y, nl.z));
      const pt = add(at(head, x, best.y, z), scale(n, lift));
      return { pt, n };
    }

    /** Faixa na superfície do rosto entre duas curvas (x de x0 a x1, z de cima e de baixo dados por função). */
    _faceStrip(head, x0, x1, zTop, zBot, color, steps = 22, minFacing = 0.05) {
      const ctx = this.ctx;
      const tops = [];
      const bots = [];
      for (let i = 0; i <= steps; i++) {
        const x = x0 + ((x1 - x0) * i) / steps;
        const a = this._faceAt(head, x, zTop(x));
        const b = this._faceAt(head, x, zBot(x));
        if (!a || !b) {
          tops.push(null);
          bots.push(null);
          continue;
        }
        const vis = this.facing(a.n) > minFacing && this.facing(b.n) > minFacing;
        tops.push(vis ? this.P(a.pt) : null);
        bots.push(vis ? this.P(b.pt) : null);
      }
      ctx.fillStyle = color;
      // um polígono por trecho visível seguido (sem emendas)
      let run = [];
      const flush = () => {
        if (run.length >= 2) {
          const p = new Path2D();
          p.moveTo(tops[run[0]].x, tops[run[0]].y);
          for (const k of run) p.lineTo(tops[k].x, tops[k].y);
          for (let k = run.length - 1; k >= 0; k--) p.lineTo(bots[run[k]].x, bots[run[k]].y);
          p.closePath();
          ctx.fill(p);
        }
        run = [];
      };
      for (let i = 0; i <= steps; i++) {
        if (tops[i]) run.push(i);
        else flush();
      }
      flush();
    }

    _face(rig, look, seg) {
      const ctx = this.ctx;
      const head = this.H;
      const H = MOD.HEAD;
      const fFace = this.facing(rig.head.f);
      if (fFace < -0.55) return; // de costas: nada do rosto aparece
      const z = this.zoom;

      // pintura vermelha (urucum): faixa nos olhos, listras nas bochechas e a marca na testa
      const band = H.paintBand;
      this._faceStrip(head, -band.x, band.x, (x) => band.top + Math.abs(x) * 0.06, (x) => band.bottom + Math.abs(x) * 0.1 - (Math.abs(x) < 3 ? 0.4 : 0), PAL.paintRed, 26);
      for (const sx of H.paintStripes) {
        this._faceStripV(head, sx, band.bottom + 0.4, H.paintStripeBottom, 0.75, PAL.paintRed);
      }
      const fm = H.foreheadMark;
      const vPts = [[-fm.w / 2, fm.z + fm.h / 2], [0, fm.z - fm.h / 2], [fm.w / 2, fm.z + fm.h / 2], [fm.w / 2 - 1.1, fm.z + fm.h / 2], [0, fm.z - fm.h / 2 + 1.5], [-fm.w / 2 + 1.1, fm.z + fm.h / 2]];
      const mk = vPts.map(([x, zz]) => this._faceAt(head, x, zz, 0.08));
      if (mk.every((m) => m && this.facing(m.n) > 0.1)) {
        ctx.fillStyle = PAL.paintRed;
        const p = new Path2D();
        mk.forEach((m, k) => {
          const q = this.P(m.pt);
          if (k) p.lineTo(q.x, q.y);
          else p.moveTo(q.x, q.y);
        });
        p.closePath();
        ctx.fill(p);
      }

      // sombra embaixo do queixo / maçãs (dá volume ao rosto)
      // olhos e sobrancelhas
      for (const sx of [-1, 1]) this._eye(head, sx, look);
      // nariz: linha do lado da sombra + narina
      const nTop = this._faceAt(head, 0.9, -0.2, 0.1);
      const nBot = this._faceAt(head, 1.5, -4.2, 0.1);
      const nL = this._faceAt(head, -1.7, -4.7, 0.1);
      const nR = this._faceAt(head, 1.9, -4.6, 0.1);
      if (nTop && nBot && nL && nR && this.facing(nBot.n) > 0.2) {
        ctx.strokeStyle = PAL.inkSoft;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.6, 0.55 * z);
        ctx.globalAlpha = smoothstep(0.2, 0.5, this.facing(nBot.n));
        const a = this.P(nTop.pt), b = this.P(nBot.pt), c = this.P(nL.pt), d = this.P(nR.pt);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(b.x + (b.x - a.x) * 0.3, b.y, b.x, b.y);
        ctx.moveTo(c.x, c.y);
        ctx.quadraticCurveTo((c.x + d.x) / 2, (c.y + d.y) / 2 + 0.5 * z, d.x, d.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // boca: séria, cantos um pouco para baixo; abre um pouco no esforço
      const mo = H.mouth;
      const open = clamp01(look.mouthOpen || 0);
      const m0 = this._faceAt(head, -mo.x, mo.z - 0.5, 0.1);
      const m1 = this._faceAt(head, 0, mo.z + 0.15, 0.1);
      const m2 = this._faceAt(head, mo.x, mo.z - 0.5, 0.1);
      const m3 = this._faceAt(head, 0, mo.z - 0.9 - open * 1.8, 0.1);
      if (m0 && m1 && m2 && m3 && this.facing(m1.n) > 0.15) {
        const a = this.P(m0.pt), b = this.P(m1.pt), c = this.P(m2.pt), d = this.P(m3.pt);
        ctx.globalAlpha = smoothstep(0.15, 0.45, this.facing(m1.n));
        if (open > 0.15) {
          ctx.fillStyle = '#4a1a14';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
          ctx.quadraticCurveTo(d.x, d.y, a.x, a.y);
          ctx.fill();
        }
        ctx.strokeStyle = PAL.ink;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.7, 0.62 * z);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
        ctx.stroke();
        // lábio de baixo (sombra curta)
        const l0 = this._faceAt(head, -1.4, mo.z - 1.9, 0.1);
        const l1 = this._faceAt(head, 1.4, mo.z - 1.9, 0.1);
        if (l0 && l1) {
          const p0 = this.P(l0.pt), p1 = this.P(l1.pt);
          ctx.strokeStyle = PAL.skin.shade;
          ctx.lineWidth = Math.max(0.7, 0.8 * z);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    /** Listra vertical (de z0 até z1) na superfície do rosto, afinando embaixo como um pingo. */
    _faceStripV(head, x, z0, z1, halfW, color) {
      const ctx = this.ctx;
      const left = [];
      const right = [];
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const zz = z0 + (z1 - z0) * t;
        const w = halfW * (1 - t * 0.55);
        const a = this._faceAt(head, x - w, zz);
        const b = this._faceAt(head, x + w, zz);
        if (!a || !b || this.facing(a.n) < 0.08 || this.facing(b.n) < 0.08) return;
        left.push(this.P(a.pt));
        right.push(this.P(b.pt));
      }
      const tip = this._faceAt(head, x, z1 - 0.9);
      const p = new Path2D();
      p.moveTo(left[0].x, left[0].y);
      for (const q of left) p.lineTo(q.x, q.y);
      if (tip) {
        const t = this.P(tip.pt);
        p.lineTo(t.x, t.y);
      }
      for (let i = right.length - 1; i >= 0; i--) p.lineTo(right[i].x, right[i].y);
      p.closePath();
      ctx.fillStyle = color;
      ctx.fill(p);
    }

    /** Um olho no estilo HQ: branco amendoado, íris escura com brilho, pálpebra grossa e sobrancelha. */
    _eye(head, sx, look) {
      const ctx = this.ctx;
      const E = MOD.HEAD.eye;
      const c = this._faceAt(head, sx * E.x, E.z, 0.12);
      if (!c) return;
      const f = this.facing(c.n);
      if (f < 0.12) return;
      const alpha = smoothstep(0.12, 0.38, f);
      // eixos do plano tangente: "direita" e "cima" na superfície
      const tR = norm(cross(head.u, c.n));
      const tU = norm(cross(c.n, tR));
      const blink = clamp01(look.blink || 0);
      const w = E.w / 2;
      const h = (E.h / 2) * (1 - blink * 0.92);
      const tilt = 0.32 * sx; // canto de fora um pouco mais alto (olhar decidido)
      const hs = this.hs;
      const pt = (a, b) => this.P(add(add(c.pt, scale(tR, a * hs)), scale(tU, b * hs)));
      const top = [];
      const bot = [];
      const N = 9;
      for (let i = 0; i <= N; i++) {
        const s = -1 + (2 * i) / N;
        const a = s * w;
        const yy = tilt * s;
        top.push(pt(a, yy + h * Math.pow(1 - s * s, 0.55)));
        bot.push(pt(a, yy - h * 0.82 * Math.pow(1 - s * s, 0.7)));
      }
      ctx.globalAlpha = alpha;
      if (blink < 0.85) {
        const eyePath = new Path2D();
        eyePath.moveTo(top[0].x, top[0].y);
        for (const q of top) eyePath.lineTo(q.x, q.y);
        for (let i = bot.length - 1; i >= 0; i--) eyePath.lineTo(bot[i].x, bot[i].y);
        eyePath.closePath();
        ctx.fillStyle = PAL.eyeWhite;
        ctx.fill(eyePath);
        // íris: olha para onde o personagem olha (e um pouco para o lado de dentro)
        ctx.save();
        ctx.clip(eyePath);
        const gx = (look.gazeX || 0) * 0.9 - sx * 0.25;
        const gy = (look.gazeY || 0) * 0.5 - 0.1;
        const ir = E.iris;
        const ic = pt(gx, gy);
        const ix = sub(pt(gx + ir, gy), ic);
        const iy = sub(pt(gx, gy + ir), ic);
        const rx = Math.hypot(ix.x, ix.y);
        const ry = Math.hypot(iy.x, iy.y);
        const rot = Math.atan2(ix.y, ix.x);
        ctx.fillStyle = PAL.iris;
        ctx.beginPath();
        ctx.ellipse(ic.x, ic.y, Math.max(0.4, rx), Math.max(0.4, ry * 1.1), rot, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = '#0c0606';
        ctx.beginPath();
        ctx.ellipse(ic.x, ic.y, Math.max(0.3, rx * 0.5), Math.max(0.3, ry * 0.55), rot, 0, M.TAU);
        ctx.fill();
        const hl = pt(gx - ir * 0.35, gy + ir * 0.4);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hl.x, hl.y, Math.max(0.45, rx * 0.32), 0, M.TAU);
        ctx.fill();
        // sombra da pálpebra no alto do olho
        ctx.fillStyle = 'rgba(80, 30, 20, 0.28)';
        const sh = new Path2D();
        sh.moveTo(top[0].x, top[0].y);
        for (const q of top) sh.lineTo(q.x, q.y);
        for (let i = top.length - 1; i >= 0; i--) {
          const q = pt(-w + (2 * w * i) / N, tilt * (-1 + (2 * i) / N) + h * 0.35);
          sh.lineTo(q.x, q.y);
        }
        sh.closePath();
        ctx.fill(sh);
        ctx.restore();
      }
      // pálpebra de cima: traço grosso que passa um pouco do canto de fora
      ctx.strokeStyle = PAL.ink;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(0.9, 0.95 * this.zoom);
      const lid = new Path2D();
      const wing = pt(sx * (w + 0.9), tilt * sx * 1.6 + h * 0.25 + 0.15);
      if (sx > 0) {
        lid.moveTo(top[0].x, top[0].y);
        for (const q of top) lid.lineTo(q.x, q.y);
        lid.lineTo(wing.x, wing.y);
      } else {
        lid.moveTo(wing.x, wing.y);
        for (const q of top) lid.lineTo(q.x, q.y);
      }
      ctx.stroke(lid);
      if (blink < 0.85) {
        ctx.lineWidth = Math.max(0.5, 0.42 * this.zoom);
        ctx.beginPath();
        const half = sx > 0 ? bot.slice(Math.floor(N / 2)) : bot.slice(0, Math.ceil(N / 2) + 1);
        ctx.moveTo(half[0].x, half[0].y);
        for (const q of half) ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
      // sobrancelha grossa, mais baixa no meio (cara de determinado)
      const B = MOD.HEAD.brow;
      const raise = (look.browRaise || 0) * 0.8;
      const bi = this._faceAt(head, sx * B.inner[0], B.inner[1] + raise, 0.15);
      const bm = this._faceAt(head, sx * (B.inner[0] + B.outer[0]) / 2, (B.inner[1] + B.outer[1]) / 2 + 0.9 + raise, 0.15);
      const bo = this._faceAt(head, sx * B.outer[0], B.outer[1] + raise * 0.6, 0.15);
      if (bi && bm && bo && this.facing(bm.n) > 0.1) {
        const t = B.thick;
        const pi = this.P(bi.pt), pm = this.P(bm.pt), po = this.P(bo.pt);
        const up = this.P(add(bm.pt, scale(tU, t * hs)));
        const dUp = { x: up.x - pm.x, y: up.y - pm.y };
        ctx.fillStyle = '#1c1416';
        ctx.beginPath();
        ctx.moveTo(pi.x - dUp.x * 0.15, pi.y - dUp.y * 0.15);
        ctx.quadraticCurveTo(pm.x + dUp.x * 1.05, pm.y + dUp.y * 1.05, po.x + dUp.x * 0.25, po.y + dUp.y * 0.25);
        ctx.quadraticCurveTo(pm.x - dUp.x * 0.15, pm.y - dUp.y * 0.15, pi.x - dUp.x * 0.15 + (pi.x - pm.x) * 0, pi.y + dUp.y * 0.55);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    _ear(seg, c, n, head) {
      if (!this.fine) return;
      const f = this.facing(n);
      if (f < 0.1) return;
      const ctx = this.ctx;
      const z = this.zoom;
      const q = this.P(add(c, scale(n, 1.2)));
      const up = this.P(add(add(c, scale(n, 1.2)), scale(head.u, 1.8)));
      const dn = this.P(add(add(c, scale(n, 1.2)), scale(head.u, -1.6)));
      const fw = this.P(add(add(c, scale(n, 1.2)), scale(head.f, 1.3)));
      ctx.strokeStyle = PAL.skin.shade;
      ctx.lineWidth = Math.max(0.7, 0.75 * z);
      ctx.lineCap = 'round';
      ctx.globalAlpha = smoothstep(0.1, 0.4, f);
      ctx.beginPath();
      ctx.moveTo(up.x, up.y);
      ctx.quadraticCurveTo(q.x - (fw.x - q.x), q.y - (fw.y - q.y), dn.x, dn.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /** Brinco de dente (branco, curvo) pendurado em cada orelha. */
    _earring(rig, look, i) {
      const ctx = this.ctx;
      const head = this.H;
      const side = i === 0 ? -1 : 1;
      if (this.facing(scale(rig.head.r, side)) < -0.45) return;
      const sw = look.earringSwing || { x: 0, y: 0, z: 0 };
      const top = at(head, side * 15.3, -0.4, -5.4);
      const down = norm(add({ x: 0, y: 0, z: -1 }, scale(sw, 0.35)));
      const fwd = norm(dirIn(rig.head, 0, 1, 0));
      const L = 3.6 * this.hs;
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        pts.push({ c: add(add(top, scale(down, L * t)), scale(fwd, Math.sin(t * 2.4) * 0.9)), w: 0.75 * (1 - t) + 0.08 });
      }
      const side2 = norm(cross(down, fwd));
      const A = pts.map((p) => this.P(add(p.c, scale(side2, p.w))));
      const Bp = pts.map((p) => this.P(add(p.c, scale(side2, -p.w))));
      const poly = [];
      for (const q of A) poly.push(q.x, q.y);
      for (let k = Bp.length - 1; k >= 0; k--) poly.push(Bp[k].x, Bp[k].y);
      S.inkOutline(ctx, poly, PAL.ink, Math.max(0.6, this.inkIn), null);
      S.paintVolume(ctx, poly, PAL.tooth, this.light, 0.6 * this.zoom);
      const q = this.P(top);
      ctx.fillStyle = PAL.ink;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 0.7 * this.zoom + this.inkIn * 0.8, 0, M.TAU);
      ctx.fill();
    }

    // ---------------------------------------------------------------- cabelo
    /** Região visível da "touca" (casca de esfera acima da linha do cabelo) na tela. */
    _capPoly(head) {
      const C = MOD.HAIR.cap;
      const hs = this.hs;
      const c = at(head, ...C.c);
      const n = norm(dirIn(head, ...C.n));
      const R = C.r * hs;
      const v = this.toCam;
      const cs = this.P(c);
      const rs = R * this.zoom;
      // círculo onde o plano corta a esfera
      const d = C.d * hs;
      const rho = Math.sqrt(Math.max(0, R * R - d * d));
      const m = add(c, scale(n, d));
      const e1 = norm(cross(n, Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 }));
      const e2 = cross(n, e1);
      const N = 48;
      const ring = [];
      for (let i = 0; i < N; i++) {
        const t = (i / N) * M.TAU;
        const p = add(m, add(scale(e1, rho * Math.cos(t)), scale(e2, rho * Math.sin(t))));
        ring.push({ p, s: this.P(p), vis: dot(sub(p, c), v) > 0 });
      }
      const nv = dot(n, v);
      const visCount = ring.filter((r) => r.vis).length;
      // ponto da borda da esfera (silhueta) no ângulo da tela `ang` está dentro da touca?
      // a silhueta é o círculo perpendicular à câmera; pontos dela: c + R*(cos·eR + sin·eD)
      const eR = norm({ x: K, y: -K, z: 0 });
      const eD = norm(cross(v, eR)); // para baixo na tela (lado de baixo da silhueta)
      const silPoint = (ang) => add(c, add(scale(eR, R * Math.cos(ang)), scale(eD, R * Math.sin(ang))));
      const inCap = (p) => dot(sub(p, c), n) > d;
      const path = new Path2D();
      const poly = [];
      const pushPt = (q) => poly.push(q.x, q.y);
      if (visCount === N) {
        if (nv > 0) {
          ring.forEach((r) => pushPt(r.s));
        } else {
          // anel: borda inteira menos o meio (raro nesta câmera)
          for (let i = 0; i < 40; i++) {
            const a = (i / 40) * M.TAU;
            pushPt({ x: cs.x + Math.cos(a) * rs, y: cs.y + Math.sin(a) * rs });
          }
        }
      } else if (visCount === 0) {
        if (!inCap(silPoint(0)) && !inCap(silPoint(Math.PI / 2))) return null;
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * M.TAU;
          pushPt({ x: cs.x + Math.cos(a) * rs, y: cs.y + Math.sin(a) * rs });
        }
      } else {
        // trecho visível do anel, em ordem
        let start = ring.findIndex((r, i) => r.vis && !ring[(i - 1 + N) % N].vis);
        const arc = [];
        for (let k = 0; k < N; k++) {
          const r = ring[(start + k) % N];
          if (!r.vis) break;
          arc.push(r.s);
        }
        const ang = (q) => Math.atan2((q.y - cs.y), (q.x - cs.x));
        // ângulo da tela -> ângulo no círculo da silhueta (eD aponta para baixo da tela: mesmo sentido)
        const a0 = ang(arc[arc.length - 1]);
        const a1 = ang(arc[0]);
        // dois caminhos possíveis pela borda: escolhe o que passa por dentro da touca
        let sweep = a1 - a0;
        while (sweep <= 0) sweep += M.TAU;
        const midA = a0 + sweep / 2;
        const useCCW = inCap(silPoint(midA));
        arc.forEach(pushPt);
        const steps = 24;
        if (useCCW) {
          for (let k = 1; k < steps; k++) {
            const a = a0 + (sweep * k) / steps;
            pushPt({ x: cs.x + Math.cos(a) * rs, y: cs.y + Math.sin(a) * rs });
          }
        } else {
          const other = M.TAU - sweep;
          for (let k = 1; k < steps; k++) {
            const a = a0 - (other * k) / steps;
            pushPt({ x: cs.x + Math.cos(a) * rs, y: cs.y + Math.sin(a) * rs });
          }
        }
      }
      if (poly.length < 6) return null;
      S.polyPath(poly, 0, 0, path);
      return { poly, path };
    }

    /** Fios no cabelo (separação das mechas), visíveis de trás e dos lados. */
    _hairStrands(rig, massPoly) {
      if (!this.fine) return;
      const ctx = this.ctx;
      const head = this.H;
      ctx.save();
      ctx.clip(S.polyPath(massPoly));
      ctx.lineCap = 'round';
      const c = at(head, 0, -4, 2);
      // mechas caindo: começam no meio da cabeça e afinam até a borda de baixo
      for (let k = 0; k < 13; k++) {
        const phi = -2.75 + (5.5 * k) / 12; // em volta da cabeça (0 = frente)
        if (Math.abs(phi) < 1.0) continue;
        const pts = [];
        for (let j = 0; j <= 6; j++) {
          const el = 0.75 - j * 0.27; // de cima para baixo
          const rr = 18.4 - j * 0.3;
          const sway = Math.sin(k * 1.7) * 0.12 * (j / 6);
          const lx = Math.sin(phi + sway) * Math.cos(el) * rr;
          const ly = Math.cos(phi + sway) * Math.cos(el) * rr;
          const lz = Math.sin(el) * rr;
          const nrm = norm(dirIn(head, lx, ly, lz));
          if (this.facing(nrm) < 0.1) {
            if (pts.length) break;
            continue;
          }
          pts.push(this.P(add(c, dirIn(head, lx, ly, lz))));
        }
        if (pts.length < 3) continue;
        const light = k % 4 === 1 && phi < 0;
        ctx.strokeStyle = light ? PAL.hair.light : PAL.hair.shade;
        // traço que afina: dois traços, um grosso curto e um fino até a ponta
        ctx.lineWidth = Math.max(0.8, (light ? 0.9 : 1.15) * this.zoom);
        ctx.stroke(S.smoothLinePath(pts));
        ctx.lineWidth = Math.max(1, (light ? 1.4 : 1.9) * this.zoom);
        ctx.stroke(S.smoothLinePath(pts.slice(0, Math.ceil(pts.length / 2))));
      }
      ctx.restore();
    }

    /** Brilhos do cabelo (faixas de luz no alto, do lado do sol). */
    _hairSheen(rig, segs) {
      const ctx = this.ctx;
      const head = this.H;
      const cap = segs.find((s) => s.isCap);
      if (!cap) return;
      ctx.save();
      ctx.clip(cap.path || S.polyPath(cap.poly));
      ctx.strokeStyle = PAL.hairSheen;
      ctx.lineCap = 'round';
      const c = at(head, ...MOD.HAIR.cap.c);
      for (const line of MOD.HAIR.sheen) {
        const pts = [];
        let ok = true;
        for (const p of line) {
          const w = at(head, p[0], p[1], p[2]);
          const nrm = norm(sub(w, c));
          if (this.facing(nrm) < 0.05) ok = false;
          pts.push(this.P(add(w, scale(nrm, 0.4))));
        }
        if (!ok) continue;
        ctx.lineWidth = 1.9 * this.zoom;
        ctx.globalAlpha = 0.38;
        ctx.stroke(S.smoothLinePath(pts));
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ---------------------------------------------------------------- penas
    _feather(rig, look, j) {
      const head = rig.head;
      const hs = this.hs;
      const F = MOD.FEATHERS;
      const def = F.list[j];
      const root = at(this.H, ...F.root);
      const sw = (look.featherSwing && look.featherSwing[j]) || { x: 0, y: 0, z: 0 };
      const dir = norm(add(dirIn(head, ...def.dir), sw));
      const fanN = norm(dirIn(head, ...F.fanNormal));
      let wAxis = cross(fanN, dir);
      wAxis = norm(wAxis);
      const curl = norm(dirIn(head, 0, -1, -0.3));
      const L = def.len * hs;
      const W = def.w * hs;
      const left = [];
      const right = [];
      const rachis = [];
      const N = 12;
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const ctr = add(add(root, scale(dir, L * s)), scale(curl, 1.6 * s * s));
        const hw = (W / 2) * Math.sin(Math.PI * Math.pow(s, 0.72)) * (1 - 0.1 * s);
        left.push(this.P(add(ctr, scale(wAxis, hw))));
        right.push(this.P(add(ctr, scale(wAxis, -hw))));
        rachis.push(this.P(ctr));
      }
      const poly = [];
      for (const q of left) poly.push(q.x, q.y);
      for (let i = right.length - 1; i >= 0; i--) poly.push(right[i].x, right[i].y);
      const mat = PAL.feathers[j % PAL.feathers.length];
      return { poly, left, right, rachis, mat: { base: mat.base, shade: mat.tip, light: mat.light }, tip: mat.tip, light: mat.light, mid: add(root, scale(dir, L * 0.45)) };
    }

    _featherDetail(seg, fd) {
      const ctx = this.ctx;
      // ponta escura
      const p = new Path2D();
      const from = Math.round(fd.left.length * 0.66);
      p.moveTo(fd.left[from].x, fd.left[from].y);
      for (let i = from; i < fd.left.length; i++) p.lineTo(fd.left[i].x, fd.left[i].y);
      for (let i = fd.right.length - 1; i >= from; i--) p.lineTo(fd.right[i].x, fd.right[i].y);
      p.closePath();
      ctx.fillStyle = fd.tip;
      ctx.fill(p);
      // talo claro
      ctx.strokeStyle = '#f7ead0';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.5, 0.45 * this.zoom);
      ctx.globalAlpha = 0.9;
      ctx.stroke(S.smoothLinePath(fd.rachis.slice(0, fd.rachis.length - 1)));
      ctx.globalAlpha = 1;
      // dois "cortes" na borda (pena de verdade)
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = Math.max(0.5, 0.35 * this.zoom);
      for (const k of [5, 8]) {
        const a = fd.left[k];
        const b = fd.rachis[k + 1];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + (b.x - a.x) * 0.55, a.y + (b.y - a.y) * 0.55);
        ctx.stroke();
      }
    }

    _featherTie(rig) {
      const ctx = this.ctx;
      const root = at(this.H, ...MOD.FEATHERS.root);
      if (this.facing(rig.head.r) < -0.6) return;
      const q = this.P(root);
      const r = 1.9 * this.hs * this.zoom;
      ctx.fillStyle = PAL.ink;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r + this.inkOut * 0.9, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = PAL.gold;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = PAL.goldShade;
      ctx.beginPath();
      ctx.arc(q.x + r * 0.3, q.y + r * 0.35, r * 0.55, 0, M.TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      ctx.arc(q.x - r * 0.35, q.y - r * 0.35, r * 0.28, 0, M.TAU);
      ctx.fill();
    }

    // ---------------------------------------------------------------- pescoço, peito, braços
    _neckShadow(seg, rig, headCircles) {
      // a cabeça faz sombra no pescoço (o sol vem de cima)
      const ctx = this.ctx;
      const hp = this.hull(headCircles);
      const k = 4.2 * this.zoom;
      ctx.fillStyle = PAL.skin.shade;
      ctx.fill(S.polyPath(hp, -this.light.x * k, -this.light.y * k));
    }

    _chestDetail(seg, rig) {
      const ctx = this.ctx;
      const ch = rig.chest;
      const z = this.zoom;
      // linhas de músculo (finas, só do lado que olha para a câmera)
      const fine = this.fine;
      const line = (pts, nrmLocal, width = 0.5, alpha = 0.75, color = PAL.inkSoft) => {
        if (!fine && width < 0.5) return; // longe: só as linhas principais (peitoral, coluna)
        const n = norm(dirIn(ch, ...nrmLocal));
        const f = this.facing(n);
        if (f < 0.12) return;
        ctx.globalAlpha = alpha * smoothstep(0.12, 0.42, f);
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.5, width * z);
        ctx.stroke(S.smoothLinePath(pts.map((p) => this.P(at(ch, ...p)))));
      };
      for (const sx of [-1, 1]) {
        // embaixo do peitoral
        line([[sx * 1.2, 13.6, -1.6], [sx * 6, 13.4, -4.6], [sx * 11.5, 11, -4], [sx * 15.2, 7, -0.5]], [sx * 0.35, 1, -0.2], 0.62, 0.85);
        // clavícula
        line([[sx * 2.6, 9.6, 11.2], [sx * 7.5, 8.2, 12.6], [sx * 12.5, 4.6, 12.2]], [sx * 0.2, 0.8, 0.6], 0.45, 0.55);
        // gomos da barriga
        for (const zz of [-8.4, -12.6, -16.6]) line([[sx * 1, 14.1 + zz * 0.06, zz], [sx * 3.6, 13.9 + zz * 0.06, zz + 0.5], [sx * 5.8, 13.2 + zz * 0.06, zz + 1.2]], [sx * 0.15, 1, 0], 0.42, 0.5);
        // lado da costela (oblíquo)
        line([[sx * 8.8, 11.4, -9], [sx * 9.2, 10.6, -14], [sx * 8.4, 10, -18.5]], [sx * 0.6, 0.8, 0], 0.42, 0.45);
        // escápula (costas)
        line([[sx * 4, -11.6, 6], [sx * 9, -11, 1], [sx * 8, -10.6, -4]], [sx * 0.2, -1, 0.1], 0.5, 0.6);
      }
      line([[0, 14.5, 4], [0, 14.6, -1]], [0, 1, 0], 0.45, 0.5); // esterno
      line([[0, 14.4, -6], [0, 14, -12], [0, 13.6, -19]], [0, 1, 0], 0.45, 0.55); // linha da barriga
      line([[0, -11.8, 9], [0, -12, 0], [0, -11.6, -10], [0, -11, -18]], [0, -1, 0], 0.5, 0.6); // coluna
      // umbigo
      const nb = at(ch, 0, 12.6, -20.6);
      const nn = norm(dirIn(ch, 0, 1, -0.1));
      if (this.facing(nn) > 0.2) {
        const q = this.P(nb);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = PAL.skin.shade;
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, 0.75 * z, 0.55 * z, 0, 0, M.TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // sombra dos braços que estão na frente do peito (contato)
      for (let i = 0; i < 2; i++) {
        const ua = rig.upperArm[i];
        const side = i === 0 ? -1 : 1;
        if (dot(scale(rig.body.r, side), this.toCam) < -0.2) continue;
        const circles = MOD.UPPER_ARM.map((s) => this.circle(limbAt(ua, s.t, s.f, s.o), s.r));
        const k = 2.6 * z;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = PAL.skin.shade;
        ctx.fill(S.polyPath(this.hull(circles), -this.light.x * k, -this.light.y * k));
        ctx.globalAlpha = 1;
      }
    }

    /** Faixa dupla de jenipapo em volta de um membro (duas listras finas, como nas referências). */
    _band(seg, lf, def, radius) {
      const ctx = this.ctx;
      const v = this.toCam;
      const thetaC = Math.atan2(dot(v, lf.out), dot(v, lf.f));
      const ringPts = (t) => {
        const pts = [];
        for (let k = 0; k <= 14; k++) {
          const th = thetaC - Math.PI / 2 + (Math.PI * k) / 14;
          const off = add(scale(lf.f, Math.cos(th) * radius), scale(lf.out, Math.sin(th) * radius));
          pts.push(this.P(add(limbAt(lf, t, 0, 0), off)));
        }
        return pts;
      };
      const stripe = 0.95 / lf.len; // listra de ~1 cm
      const gap = def.w / 2 / lf.len;
      ctx.fillStyle = PAL.paintBlack;
      ctx.globalAlpha = 0.9;
      for (const c of [def.t - gap, def.t + gap]) {
        const a = ringPts(c - stripe / 2);
        const b = ringPts(c + stripe / 2);
        const p = new Path2D();
        p.moveTo(a[0].x, a[0].y);
        for (const q of a) p.lineTo(q.x, q.y);
        for (let k = b.length - 1; k >= 0; k--) p.lineTo(b[k].x, b[k].y);
        p.closePath();
        ctx.fill(p);
      }
      ctx.globalAlpha = 1;
    }

    _upperArmPaint(seg, rig, i) {
      const ua = rig.upperArm[i];
      this._band(seg, ua, MOD.BODY_PAINT.upperArmBand, 5.7);
      // símbolo redondo no ombro (deltoide), do lado de fora
      const ctx = this.ctx;
      const side = i === 0 ? -1 : 1;
      const d0 = limbAt(ua, MOD.UPPER_ARM[0].t, MOD.UPPER_ARM[0].f, MOD.UPPER_ARM[0].o);
      const nrm = norm(add(add(scale(ua.out, 0.8), scale(rig.chest.f, 0.38)), scale(rig.chest.u, 0.3)));
      const f = this.facing(nrm);
      if (f < 0.1) return;
      const c = add(d0, scale(nrm, MOD.UPPER_ARM[0].r + 0.1));
      const t1 = norm(cross(nrm, rig.chest.u));
      const t2 = norm(cross(nrm, t1));
      const R = MOD.BODY_PAINT.shoulderMark.r;
      const ring = (r) => {
        const pts = [];
        for (let k = 0; k < 18; k++) {
          const a = (k / 18) * M.TAU;
          pts.push(this.P(add(c, add(scale(t1, Math.cos(a) * r), scale(t2, Math.sin(a) * r)))));
        }
        return pts;
      };
      ctx.globalAlpha = smoothstep(0.1, 0.35, f) * 0.92;
      ctx.strokeStyle = PAL.paintBlack;
      ctx.lineWidth = Math.max(0.6, 0.85 * this.zoom);
      ctx.lineJoin = 'round';
      ctx.stroke(S.smoothClosedPath(ring(R)));
      // espiral dentro
      const sp = [];
      for (let k = 0; k <= 14; k++) {
        const a = (k / 14) * M.TAU * 1.15 + side;
        const r = R * 0.65 * (1 - k / 16);
        sp.push(this.P(add(c, add(scale(t1, Math.cos(a) * r), scale(t2, Math.sin(a) * r)))));
      }
      ctx.lineWidth = Math.max(0.5, 0.6 * this.zoom);
      ctx.stroke(S.smoothLinePath(sp));
      ctx.globalAlpha = 1;
    }

    _fistDetail(seg, hd) {
      // linhas dos dedos fechados
      if (!this.fine) return;
      const ctx = this.ctx;
      const f = this.facing(hd.d);
      ctx.strokeStyle = PAL.inkSoft;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.45, 0.4 * this.zoom);
      ctx.globalAlpha = 0.65;
      for (const s of [-1.6, 0, 1.6]) {
        const a = this.P(add(add(add(hd.o, scale(hd.a, 6.8)), scale(hd.d, f > 0 ? 2.2 : -2.2)), scale(hd.s, s)));
        const b = this.P(add(add(add(hd.o, scale(hd.a, 9.2)), scale(hd.d, f > 0 ? 1.2 : -1.8)), scale(hd.s, s * 1.05)));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    _toes(seg, ft, side) {
      if (!this.fine) return;
      const ctx = this.ctx;
      if (this.facing(ft.u) < -0.2) return;
      ctx.strokeStyle = PAL.inkSoft;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.45, 0.42 * this.zoom);
      ctx.globalAlpha = 0.7;
      for (const s of [-1.6, 0.2, 1.9]) {
        const a = this.P(at(ft, -side * s, 15.2, -1.2));
        const b = this.P(at(ft, -side * s * 1.1, 19, -2.6));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------------- tanga e colar
    _loincloth(seg, rig, look) {
      const ctx = this.ctx;
      const pv = rig.pelvis;
      const L = MOD.LOINCLOTH;
      // anel da cintura: a parte de baixo dele na tela é a borda da tanga
      const ring = [];
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * M.TAU;
        const front = Math.max(0, Math.sin(a)); // frente = +y
        ring.push(this.P(at(pv, Math.cos(a) * L.rx, Math.sin(a) * L.ry + 1.5, L.ringZ - front * L.ringFrontDrop)));
      }
      // metade de baixo do anel (de ponta a ponta na tela, passando por baixo)
      let iMin = 0, iMax = 0;
      ring.forEach((q, k) => {
        if (q.x < ring[iMin].x) iMin = k;
        if (q.x > ring[iMax].x) iMax = k;
      });
      const lower = [];
      const walk = (from, to, dir) => {
        const out = [];
        for (let k = from; ; k = (k + dir + 36) % 36) {
          out.push(ring[k]);
          if (k === to) break;
        }
        return out;
      };
      const pathA = walk(iMin, iMax, 1);
      const pathB = walk(iMin, iMax, -1);
      const avgY = (pts) => pts.reduce((s, q) => s + q.y, 0) / pts.length;
      const arc = avgY(pathA) > avgY(pathB) ? pathA : pathB;
      for (const q of arc) lower.push(q);
      const big = 400 * this.zoom;
      const region = new Path2D();
      region.moveTo(lower[0].x - big, lower[0].y);
      for (const q of lower) region.lineTo(q.x, q.y);
      region.lineTo(lower[lower.length - 1].x + big, lower[lower.length - 1].y);
      region.lineTo(lower[lower.length - 1].x + big, lower[lower.length - 1].y + big);
      region.lineTo(lower[0].x - big, lower[0].y + big);
      region.closePath();
      ctx.save();
      ctx.clip(region);
      // pano da tanga com sombra e brilho próprios
      const r = S.polyRadius(seg.poly);
      S.paintVolume(ctx, seg.poly, PAL.cloth, this.light, r * 0.3);
      // dobras: duas linhas do quadril até o meio
      const crease = (sx) => [this.P(at(pv, sx * 10.5, 9.5, 1.5)), this.P(at(pv, sx * 4.5, 10.2, -5)), this.P(at(pv, sx * 1.2, 7.5, -11))];
      if (this.facing(pv.f) > 0.1) {
        ctx.strokeStyle = PAL.cloth.shade;
        ctx.lineWidth = Math.max(0.6, 0.6 * this.zoom);
        ctx.lineCap = 'round';
        for (const sx of [-1, 1]) ctx.stroke(S.smoothLinePath(crease(sx)));
      }
      ctx.restore();
      // borda (linha fina de tinta) e o cordão da cintura
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = this.inkIn * 1.7;
      ctx.lineJoin = 'round';
      ctx.stroke(S.linePath(lower));
      ctx.strokeStyle = PAL.clothBand.base;
      ctx.lineWidth = L.band * this.zoom;
      ctx.lineCap = 'round';
      const band = lower.map((q) => ({ x: q.x, y: q.y + L.band * this.zoom * 0.45 }));
      ctx.stroke(S.linePath(band));
      ctx.strokeStyle = PAL.clothBand.light;
      ctx.lineWidth = Math.max(0.5, L.band * this.zoom * 0.3);
      ctx.stroke(S.linePath(band.map((q) => ({ x: q.x, y: q.y - L.band * this.zoom * 0.2 }))));
      // nó do cordão no quadril esquerdo, com as duas pontas balançando
      const knotN = norm(dirIn(pv, -0.55, 0.83, 0));
      if (this.facing(knotN) > 0) {
        const knot = at(pv, -8.4, 11.6, L.ringZ - 1.2);
        const kq = this.P(knot);
        const sw = look.tasselSwing || { x: 0, y: 0, z: 0 };
        ctx.lineCap = 'round';
        for (const [dx, len] of [[-1.1, 7.5], [1.2, 6]]) {
          const end = add(add(knot, { x: 0, y: 0, z: -len }), add(scale(pv.r, dx), scale(sw, len / 6)));
          const mid = add(add(knot, { x: 0, y: 0, z: -len * 0.5 }), scale(pv.r, dx * 0.5));
          const qe = this.P(end);
          const qm = this.P(mid);
          ctx.strokeStyle = PAL.ink;
          ctx.lineWidth = Math.max(1.2, 1.25 * this.zoom) + this.inkIn * 2;
          ctx.beginPath();
          ctx.moveTo(kq.x, kq.y);
          ctx.quadraticCurveTo(qm.x, qm.y, qe.x, qe.y);
          ctx.stroke();
          ctx.strokeStyle = PAL.clothBand.base;
          ctx.lineWidth = Math.max(1.2, 1.25 * this.zoom);
          ctx.stroke();
        }
        ctx.fillStyle = PAL.ink;
        ctx.beginPath();
        ctx.arc(kq.x, kq.y, 1.9 * this.zoom + this.inkIn, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = PAL.clothBand.light;
        ctx.beginPath();
        ctx.arc(kq.x, kq.y, 1.9 * this.zoom, 0, M.TAU);
        ctx.fill();
      }
    }

    _necklace(rig, look) {
      const ctx = this.ctx;
      const ch = rig.chest;
      const N = MOD.NECKLACE;
      // anel inclinado para a frente (a frente desce no peito)
      let fr = M.pitch(ch, N.tilt);
      fr = M.moved(fr, at(ch, ...N.center));
      const beads = [];
      for (let k = 0; k < N.beads; k++) {
        const a = (k / N.beads) * M.TAU;
        const dir = dirIn(fr, Math.sin(a), Math.cos(a), 0); // a = 0 é a frente
        const p = add(fr.o, scale(dir, N.radius));
        beads.push({ p, n: norm(dirIn(ch, Math.sin(a), Math.cos(a), 0.15)), k });
      }
      const vis = beads.filter((b) => this.facing(b.n) > -0.05);
      if (!vis.length) return;
      vis.sort((a, b) => this.keyOf(a.p) - this.keyOf(b.p));
      // cordão
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = Math.max(0.6, 0.45 * this.zoom);
      const ordered = beads.filter((b) => this.facing(b.n) > -0.05);
      ctx.beginPath();
      ordered.forEach((b, j) => {
        const q = this.P(b.p);
        if (j) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
      });
      ctx.stroke();
      const r = N.beadR * this.zoom;
      for (const b of vis) {
        const q = this.P(b.p);
        ctx.fillStyle = PAL.ink;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r + Math.max(0.55, this.inkIn * 0.9), 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = PAL.beads[b.k % PAL.beads.length];
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(q.x - r * 0.35, q.y - r * 0.35, r * 0.3, 0, M.TAU);
        ctx.fill();
      }
      // dente pendurado na frente
      const front = beads[0];
      if (this.facing(front.n) > 0.05) {
        const sw = look.pendantSwing || { x: 0, y: 0, z: 0 };
        const top = add(front.p, scale(ch.f, 0.6));
        const down = norm(add({ x: 0, y: 0, z: -1 }, add(scale(ch.f, 0.12), sw)));
        const side = norm(cross(down, ch.f));
        const L = N.pendant;
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          const bend = Math.sin(t * Math.PI * 0.8) * 1.1;
          const w = 1.25 * (1 - t) + 0.1;
          pts.push({ c: add(add(top, scale(down, L * t)), scale(side, bend)), w });
        }
        const L1 = pts.map((p) => this.P(add(p.c, scale(side, p.w))));
        const R1 = pts.map((p) => this.P(add(p.c, scale(side, -p.w))));
        const poly = [];
        for (const q of L1) poly.push(q.x, q.y);
        for (let k = R1.length - 1; k >= 0; k--) poly.push(R1[k].x, R1[k].y);
        S.inkOutline(ctx, poly, PAL.ink, Math.max(0.6, this.inkIn), null);
        S.paintVolume(ctx, poly, PAL.tooth, this.light, 0.9 * this.zoom);
        // capinha dourada
        const q = this.P(top);
        ctx.fillStyle = PAL.ink;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 1.15 * this.zoom + this.inkIn, 0, M.TAU);
        ctx.fill();
        ctx.fillStyle = PAL.gold;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 1.15 * this.zoom, 0, M.TAU);
        ctx.fill();
      }
    }

    // ---------------------------------------------------------------- sombra no chão
    /** Sombra do corpo no chão (projetada pela luz), desenhada antes de tudo que fica em pé. */
    drawShadow(ctx, rig, groundZ = 0) {
      const cam = this.cam;
      const L = cam.light;
      const path = new Path2D();
      const add2 = (p, r) => {
        const h = Math.max(0, p.z - groundZ);
        const gx = p.x - (L.x / L.z) * h;
        const gy = p.y - (L.y / L.z) * h;
        path.moveTo(gx + r, gy);
        path.arc(gx, gy, r, 0, M.TAU);
      };
      const seg = (a, b, r0, r1) => {
        const n = Math.max(2, Math.ceil(M.dist(a, b) / (Math.min(r0, r1) * 0.8)));
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          add2(M.lerp3(a, b, t), r0 + (r1 - r0) * t);
        }
      };
      add2(rig.head.o, 15.5 * PD.BODY.headScale);
      add2(at(rig.head, 0, -6, 0), 15 * PD.BODY.headScale);
      seg(rig.neckBase, rig.head.o, 7, 8, 2);
      seg(at(rig.chest, 0, 0, 6), at(rig.pelvis, 0, 0, 2), 15, 13, 3);
      for (let i = 0; i < 2; i++) {
        seg(rig.shoulder[i], rig.elbow[i], 6.5, 4.6, 3);
        seg(rig.elbow[i], rig.wrist[i], 4.6, 3.8, 3);
        add2(add(rig.hand[i].o, scale(rig.hand[i].a, 5)), 4.6);
        seg(rig.hip[i], rig.knee[i], 9, 6, 3);
        seg(rig.knee[i], rig.ankle[i], 5.8, 4, 3);
        seg(at(rig.foot[i], 0, -3, -3), at(rig.foot[i], 0, 15, -3.5), 4, 3.2, 3);
      }
      const lift = Math.max(0, rig.body.o.z - groundZ);
      const fade = clamp01(1 - lift / 220);
      ctx.save();
      ctx.translate(0, -groundZ * cam.cosP * cam.zoom); // a sombra fica no nível do chão (calçada ou rua)
      ctx.transform(...cam.groundMatrix());
      ctx.fillStyle = `rgba(28, 18, 34, ${0.3 * fade})`;
      ctx.fill(path);
      // sombra de contato embaixo dos pés (mais escura e pequena)
      ctx.fillStyle = `rgba(20, 12, 24, ${0.22 * fade})`;
      for (let i = 0; i < 2; i++) {
        const a = rig.ankle[i];
        const h = Math.max(0, a.z - groundZ - BODYH);
        const s = clamp01(1 - h / 40);
        if (s <= 0) continue;
        ctx.beginPath();
        ctx.ellipse(a.x + rig.foot[i].f.x * 6, a.y + rig.foot[i].f.y * 6, 13 * s, 9 * s, Math.atan2(rig.foot[i].f.y, rig.foot[i].f.x), 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    /** Caixa aproximada na tela (para saber se algo está na frente do personagem). */
    bounds(rig, padScale = 1) {
      const pts = [rig.head.o, rig.ankle[0], rig.ankle[1], rig.wrist[0], rig.wrist[1], rig.elbow[0], rig.elbow[1]].map((p) => this.cam.p(p));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of pts) {
        x0 = Math.min(x0, q.x);
        x1 = Math.max(x1, q.x);
        y0 = Math.min(y0, q.y);
        y1 = Math.max(y1, q.y);
      }
      const pad = 26 * this.cam.zoom * padScale;
      return { x0: x0 - pad, y0: y0 - pad * 1.3, x1: x1 + pad, y1: y1 + pad * 0.5 };
    }

    // ---------------------------------------------------------------- esqueleto (depuração)
    _bones(rig) {
      const ctx = this.ctx;
      const line = (a, b, c) => {
        const p = this.P(a), q = this.P(b);
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      };
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      line(rig.pelvis.o, rig.waist, '#00e5ff');
      line(rig.waist, rig.chest.o, '#00e5ff');
      line(rig.chest.o, rig.neckBase, '#00e5ff');
      line(rig.neckBase, rig.head.o, '#00e5ff');
      for (let i = 0; i < 2; i++) {
        const c = i === 0 ? '#ff3df2' : '#7dff3d';
        line(rig.chest.o, rig.shoulder[i], c);
        line(rig.shoulder[i], rig.elbow[i], c);
        line(rig.elbow[i], rig.wrist[i], c);
        line(rig.pelvis.o, rig.hip[i], c);
        line(rig.hip[i], rig.knee[i], c);
        line(rig.knee[i], rig.ankle[i], c);
        line(rig.ankle[i], at(rig.foot[i], 0, 16, -3), c);
      }
      ctx.fillStyle = '#ffffff';
      const joints = [rig.head.o, rig.neckBase, rig.chest.o, rig.waist, rig.pelvis.o, ...rig.shoulder, ...rig.elbow, ...rig.wrist, ...rig.hip, ...rig.knee, ...rig.ankle];
      for (const j of joints) {
        const q = this.P(j);
        ctx.beginPath();
        ctx.arc(q.x, q.y, 2.5, 0, M.TAU);
        ctx.fill();
      }
    }
  }

  const BODYH = PD.BODY.ankleHeight;
  PD.CharacterRenderer = CharacterRenderer;
})(window.PD = window.PD || {});
