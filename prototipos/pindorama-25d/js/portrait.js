// Retrato do herói para a interface do jogo (o círculo da HUD e a mochila): o mesmo boneco 2.5D que anda no mundo,
// parado e assentado, desenhado num canvas comum (sem mundo nem câmera do jogo).
//
//   PD.portrait(canvas, { mode, yaw, dpr })
//     mode 'head' (padrão): cabeça e ombros num fundo escuro redondo (o furo da moldura da HUD mostra isto)
//     mode 'full': o corpo inteiro com a sombra no chão, fundo transparente (a mochila)
//     yaw: para onde olha, em graus no chão (45 = de frente para a câmera; menos que isso vira para a direita da tela)
//     dpr: px de verdade em 1 px de tela (o canvas já vem no tamanho de verdade); muda só a espessura das linhas
//
// O herói sai sem armadura e sem arma (pedido do dono): só o corpo, o cabelo, as penas e a tanga da classe.
(function () {
  'use strict';
  const PD = (window.PD = window.PD || {});
  const DEG = Math.PI / 180;

  /** Corpo parado há um tempo: a respiração anda e as molas do cabelo e das penas descansam; olho aberto. */
  function restingHero(yawDeg) {
    const ch = new PD.Character(0, 0, yawDeg * DEG);
    ch.faceYaw = yawDeg * DEG;
    ch.blinkIn = 1e9; // não pisca no meio do retrato
    for (let i = 0; i < 120; i++) ch.update(1 / 60, {}, null);
    ch.look.blink = 0;
    return ch;
  }

  function background(ctx, w, h) {
    // fundo escuro com um clarão quente de lado (como a luz da fogueira), para o rosto destacar
    const g = ctx.createRadialGradient(w * 0.42, h * 0.36, 0, w * 0.5, h * 0.5, w * 0.62);
    g.addColorStop(0, '#4a3a2c');
    g.addColorStop(0.45, '#241b14');
    g.addColorStop(1, '#0a0806');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function portrait(canvas, opts = {}) {
    if (!PD.Character || !PD.CharacterRenderer || !PD.IsoCamera || !PD.rig) return false;
    const mode = opts.mode === 'full' ? 'full' : 'head';
    const dpr = opts.dpr > 0 ? opts.dpr : 1;
    const yawDeg = Number.isFinite(opts.yaw) ? opts.yaw : mode === 'head' ? 25 : 30;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (mode === 'head') background(ctx, w, h);

    const ch = restingHero(yawDeg);
    const cam = new PD.IsoCamera();
    cam.dpr = dpr;
    // tamanho: 'head' mostra uns 80 cm de altura (das penas ao peito); 'full', o corpo inteiro com folga
    const span = mode === 'head' ? (opts.span > 0 ? opts.span : 74) : 192;
    cam.zoom = h / dpr / span;
    const rig = PD.rig.buildRig(ch.pose());
    const painter = new PD.CharacterRenderer(cam);
    // onde fica o desenho: na cabeça, o rosto um pouco acima do meio (as penas aparecem em cima); no corpo, o pé
    // perto de baixo
    const head = cam.p(rig.head.o);
    const chest = cam.p(rig.chest.o);
    const ground = cam.p({ x: ch.pos.x, y: ch.pos.y, z: 0 });
    let ax;
    let ay;
    if (mode === 'head') {
      const at = Number.isFinite(opts.headAt) ? opts.headAt : 0.49;
      ax = head.x * 0.8 + chest.x * 0.2;
      ay = head.y + (0.5 - at) * (h / dpr);
    } else {
      ax = ground.x;
      ay = ground.y - (h / dpr) * 0.43;
    }
    ctx.setTransform(dpr, 0, 0, dpr, (w / dpr / 2 - ax) * dpr, (h / dpr / 2 - ay) * dpr);
    if (mode === 'full') {
      // sombra redonda e macia embaixo dos pés (a sombra comprida do sol sairia do quadro)
      const r = 44 * cam.zoom;
      const g = ctx.createRadialGradient(ground.x, ground.y, 0, ground.x, ground.y, r);
      g.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(ground.x, ground.y, r, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    painter.draw(ctx, rig, ch.look, {}, PD.classes ? PD.classes.appearanceOf(ch) : undefined);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return true;
  }

  PD.portrait = portrait;
})();
