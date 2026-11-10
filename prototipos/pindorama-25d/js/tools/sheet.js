// Prancha de conferência: o MESMO modelo nas 8 direções e em cada animação, lado a lado.
// Serve para ver se as proporções, a cara e as pinturas ficam iguais em todas as poses.
(function (PD) {
  'use strict';
  const M = PD.math;
  const DIRS = [
    ['frente', 45], ['frente-dir.', 0], ['direita', -45], ['costas-dir.', -90],
    ['costas', -135], ['costas-esq.', 180], ['esquerda', 135], ['frente-esq.', 90],
  ];

  /** Roda o personagem por `secs` segundos com uma entrada fixa (passos de 1/120 s). */
  function simulate(ch, secs, input) {
    const dt = 1 / 120;
    for (let t = 0; t < secs; t += dt) {
      ch.update(dt, typeof input === 'function' ? input(t) : input, null);
      const rig = PD.rig.buildRig(ch.pose());
      ch.secondary(rig, dt);
    }
  }
  const moveDir = (yawDeg, mag = 1) => ({ x: Math.cos(yawDeg * M.DEG) * mag, y: Math.sin(yawDeg * M.DEG) * mag });

  function render(canvas, opts = {}) {
    const zoom = opts.zoom || 1.45;
    const cellW = opts.cellW || Math.round(145 * zoom);
    const cellH = opts.cellH || Math.round(205 * zoom);
    const cam = new PD.IsoCamera();
    cam.zoom = zoom;
    cam.dpr = opts.dpr || window.devicePixelRatio || 1;
    const renderer = new PD.CharacterRenderer(cam);
    renderer.showBones = !!opts.bones;

    // linhas da prancha: [título, lista de células { rótulo, fazer(ch) }]
    const rows = [];
    rows.push(['Parado — 8 direções', DIRS.map(([name, yaw]) => ({ label: name, make: (ch) => { ch.yaw = yaw * M.DEG; simulate(ch, 1.3, {}); } }))]);
    const walkFrames = (yaw, run) => {
      const cells = [];
      for (let k = 0; k < 8; k++) {
        cells.push({
          label: `${run ? 'corrida' : 'andar'} ${k + 1}`,
          make: (ch) => {
            ch.yaw = yaw * M.DEG;
            simulate(ch, 1.6, { move: moveDir(yaw), run });
            // avança até a fase k/8 da passada
            let guard = 0;
            const target = k / 8;
            while (Math.abs(((ch.phase - target + 1.5) % 1) - 0.5) > 0.012 && guard++ < 600) simulate(ch, 1 / 120, { move: moveDir(yaw), run });
          },
        });
      }
      return cells;
    };
    rows.push(['Caminhada — oito quadros (de lado)', walkFrames(-45, false)]);
    rows.push(['Corrida — oito quadros (de lado)', walkFrames(-45, true)]);
    rows.push(['Caminhada — 8 direções', DIRS.map(([name, yaw]) => ({ label: name, make: (ch) => { ch.yaw = yaw * M.DEG; simulate(ch, 1.45, { move: moveDir(yaw) }); } }))]);
    rows.push(['Agachar (transição) e andando agachado', [0.04, 0.1, 0.18, 0.4].map((s, k) => ({ label: `agachando ${k + 1}`, make: (ch) => { ch.yaw = 20 * M.DEG; simulate(ch, 0.4, {}); simulate(ch, s, (t) => ({ crouchToggle: t === 0 })); } })).concat(
      [['agachado frente', 45], ['agachado lado', -45], ['agach. andando', -45], ['agach. costas', -135]].map(([label, yaw], k) => ({ label, make: (ch) => { ch.yaw = yaw * M.DEG; simulate(ch, 0.3, {}); simulate(ch, 1.2, (t) => ({ crouchToggle: t === 0, move: k === 2 ? moveDir(yaw) : null })); } })))]);
    const jumpTimes = [0.06, 0.13, 0.2, 0.34, 0.48, 0.6, 0.7, 0.8];
    const jumpNames = ['preparo', 'impulso', 'subindo', 'alto', 'caindo', 'chegando', 'pouso', 'levantando'];
    rows.push(['Pulo — oito quadros', jumpTimes.map((s, k) => ({ label: jumpNames[k], lift: true, make: (ch) => { ch.yaw = 10 * M.DEG; simulate(ch, 0.5, {}); simulate(ch, s, (t) => ({ jump: t === 0 })); } }))]);
    const pt = PD.PUNCH_AT;
    const punchTimes = [pt.guarda[1] * 0.8, pt.armar[0] + 0.05, pt.armar[1], pt.golpe[0] + 0.04, pt.impacto[0] + 0.02, pt.recolher[0] + 0.06, pt.recolher[1], pt.voltar[0] + 0.12];
    const punchNames = ['guarda', 'armando', 'armado', 'golpe', 'impacto', 'recolhendo', 'guarda', 'voltando'];
    rows.push(['Soco — oito quadros (3/4)', punchTimes.map((s, k) => ({ label: punchNames[k], make: (ch) => { ch.yaw = 5 * M.DEG; simulate(ch, 0.5, {}); simulate(ch, s, (t) => ({ attack: t === 0, attackDir: 5 * M.DEG })); } }))]);
    if (opts.only) rows.splice(0, rows.length, ...rows.filter((r, i) => opts.only.includes(i)));

    const cols = 8;
    const titleH = 26;
    const W = cols * cellW;
    const H = rows.length * (cellH + titleH);
    canvas.width = Math.round(W * cam.dpr);
    canvas.height = Math.round(H * cam.dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
    ctx.fillStyle = '#d9d4c7';
    ctx.fillRect(0, 0, W, H);

    rows.forEach(([title, cells], r) => {
      const y0 = r * (cellH + titleH);
      ctx.fillStyle = '#2b2320';
      ctx.fillRect(0, y0, W, titleH);
      ctx.fillStyle = '#f7ead2';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(title, 10, y0 + 18);
      cells.forEach((cell, c) => {
        const x0 = c * cellW;
        const cy = y0 + titleH;
        ctx.fillStyle = (r + c) % 2 ? '#cfc9bb' : '#d6d0c2';
        ctx.fillRect(x0, cy, cellW, cellH);
        const ch = new PD.Character(0, 0, 0);
        cell.make(ch);
        const pose = ch.pose();
        const rig = PD.rig.buildRig(pose);
        // centraliza a raiz do personagem na célula (os pés perto de baixo)
        const root = cam.p({ x: ch.pos.x, y: ch.pos.y, z: 0 });
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, cy, cellW, cellH);
        ctx.clip();
        ctx.translate(x0 + cellW / 2 - root.x, cy + cellH - (cell.lift ? 12 : 26) * zoom / 1.45 - root.y + (cell.lift ? ch.pos.z * cam.cosP * zoom * 0.55 : 0));
        // chão: losango e sombra
        ctx.save();
        ctx.transform(...cam.groundMatrix());
        ctx.fillStyle = 'rgba(70, 60, 50, 0.12)';
        ctx.fillRect(ch.pos.x - 60, ch.pos.y - 60, 120, 120);
        ctx.restore();
        renderer.drawShadow(ctx, rig, 0);
        renderer.draw(ctx, rig, ch.look);
        ctx.restore();
        ctx.fillStyle = '#3b302a';
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText(cell.label, x0 + 6, cy + cellH - 8);
      });
    });
  }

  PD.sheet = { render, simulate, DIRS };
})(window.PD = window.PD || {});
