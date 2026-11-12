// O laço do jogo: lê os controles, move o personagem, monta o esqueleto, atualiza o mundo e desenha.
// Usa requestAnimationFrame e o tempo real entre quadros (o movimento é igual a 30, 60 ou 120 fps).
(function (PD) {
  'use strict';
  const M = PD.math;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const cam = new PD.IsoCamera();
  const ui = new PD.UI();
  let world = null;
  let hero = null;
  let renderer = null;
  let input = null;
  let zoomUser = 1;
  let camTarget = null;
  let paused = false;
  let last = 0;
  let rig = null;
  let combat = null, rival = null, rivalRig = null, rivalRenderer = null;
  let audio = null;
  const stats = { frames: 0, acc: 0, fps: 0, work: 0, workAvg: 0 };
  let showFps = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    showFps = new URLSearchParams(location.search).has('fps');
  } catch {
    showFps = false;
  }

  function baseZoom() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return M.clamp(Math.min(w * 1.45, h) / 790, 0.5, 1.4);
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    cam.dpr = dpr;
    cam.viewW = w;
    cam.viewH = h;
    const z = baseZoom() * zoomUser;
    if (Math.abs(z - cam.zoom) > 1e-4 || world?._dpr !== dpr) {
      cam.zoom = z;
      if (world) {
        world.invalidate();
        world._dpr = dpr;
      }
    }
  }

  function setZoom(f) {
    zoomUser = M.clamp(f, 0.7, 1.7);
    resize();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dtRaw = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    const dt = Math.min(0.05, Math.max(0, dtRaw));
    const t0 = performance.now();

    const inp = input.frame(hero);
    if (inp.other.weapon) combat.selectWeapon(inp.other.weapon);
    if (inp.other.bones) renderer.showBones = !renderer.showBones;
    if (inp.other.help) toggleHelp();
    if (inp.other.zoomIn) setZoom(zoomUser * 1.12);
    if (inp.other.zoomOut) setZoom(zoomUser / 1.12);
    if (inp.other.start) mainAction();
    if (inp.other.restart) restart();
    if ((inp.attack || inp.attackHeld || inp.guardHeld) && inp.aimPoint) {
      const b = rivalRenderer.bounds(rivalRig), x = inp.aimPoint.x + cam.viewX, y = inp.aimPoint.y + cam.viewY;
      if (x >= b.x0 - 10 && x <= b.x1 + 10 && y >= b.y0 - 10 && y <= b.y1 + 10) {
        const target = rival.death ? rivalRig.chest.o : rival.pos;
        inp.attackDir = Math.atan2(target.y - hero.pos.y, target.x - hero.pos.x);
        if (inp.guardHeld) inp.guardDir = inp.attackDir;
        if (inp.attack) inp.attackTarget = 'enemy';
      }
    }

    if (!paused && !combat.paused) {
      combat.update(dt, inp);
      audio?.update(combat, false);
      rig = PD.rig.buildRig(hero.pose());
      hero.secondary(rig, dt);
      rivalRig = PD.rig.buildRig(rival.pose());
      rival.secondary(rivalRig, dt);
      world._dt = dt;
      world.update(dt, hero, [rival]);
    } else audio?.silence();

    // câmera: segue o personagem com suavidade, olhando um pouco para onde ele vai
    const lead = { x: hero.vel.x * 0.22, y: hero.vel.y * 0.22, z: 0 };
    const distance = Math.hypot(rival.pos.x - hero.pos.x, rival.pos.y - hero.pos.y);
    const pair = combat.phase === 'active' && !rival.death ? 0.32 * (1 - M.smoothstep(420, 800, distance)) : 0;
    const goal = { x: hero.pos.x + lead.x + (rival.pos.x - hero.pos.x) * pair, y: hero.pos.y + lead.y + (rival.pos.y - hero.pos.y) * pair, z: 0 };
    camTarget = camTarget ? M.damp3(camTarget, goal, 5.5, dt) : goal;
    cam.follow(camTarget);
    if (world.shake > 0 && !reducedMotion) {
      world.shake -= dt;
      const s = world.shake * 30 * cam.zoom;
      cam.viewX += (Math.random() - 0.5) * s;
      cam.viewY += (Math.random() - 0.5) * s;
    }

    draw();

    const work = performance.now() - t0;
    stats.workAvg = stats.workAvg * 0.95 + work * 0.05;
    stats.frames++;
    stats.acc += dtRaw;
    if (stats.acc >= 0.5) {
      stats.fps = stats.frames / stats.acc;
      stats.frames = 0;
      stats.acc = 0;
      if (showFps) ui.setFps(`${Math.round(stats.fps)} fps · ${stats.workAvg.toFixed(1)} ms`);
    }
    ui.setLabel(hero.label);
    ui.setLife(hero);
    ui.setCombat(combat);
  }

  function draw() {
    const dpr = cam.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#4b4e57';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    ctx.setTransform(dpr, 0, 0, dpr, -cam.viewX * dpr, -cam.viewY * dpr);
    const actors = [makeActor(hero, rig, renderer, true), makeActor(rival, rivalRig, rivalRenderer, false)];
    if (PD.slingshot) for (const stone of combat.projectiles) actors.push(PD.slingshot.actor(stone, cam));
    world.draw(ctx, actors);
    for (const e of combat.effects) {
      if (e.kind === 'stoneImpact') { PD.slingshot.drawImpact(ctx, e, cam, reducedMotion); continue; }
      if (e.kind === 'block' || e.kind === 'guardBreak') PD.guard?.drawImpact(ctx, e, cam, reducedMotion);
      if (e.kind === 'block' && e.broke) continue;
      const q = cam.p({ x: e.x, y: e.y, z: e.z + e.t * 38 });
      ctx.save(); ctx.globalAlpha = Math.min(1, (e.life - e.t) * 5);
      ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3;
      ctx.strokeStyle = '#1b100d'; ctx.fillStyle = e.kind === 'dodge' || e.kind === 'block' ? '#aee5ef' : e.kind === 'guardBreak' ? '#f5aa65' : '#fff0b5';
      const text = e.kind === 'dodge' ? 'ESQUIVA' : e.kind === 'block' ? 'BLOQUEIO' : e.kind === 'guardBreak' ? 'GUARDA QUEBRADA' : `−${e.amount}`;
      ctx.strokeText(text, q.x, q.y); ctx.fillText(text, q.x, q.y); ctx.restore();
    }
    // a névoa nas bordas da tela é do CSS (#vinheta)
  }

  function makeActor(character, skeleton, painter, primary) {
    const r = character.radius;
    const points = character.death ? [skeleton.head.o, skeleton.chest.o, skeleton.pelvis.o, ...skeleton.knee, ...skeleton.ankle] : null;
    const footprint = points ? {
      x0: Math.min(...points.map(p => p.x)) - 14, x1: Math.max(...points.map(p => p.x)) + 14,
      y0: Math.min(...points.map(p => p.y)) - 14, y1: Math.max(...points.map(p => p.y)) + 14,
    } : { x0: character.pos.x - r, x1: character.pos.x + r, y0: character.pos.y - r, y1: character.pos.y + r };
    return {
      entity: character, primary,
      groundedCorpse: !!character.death && character.pos.z < 1 && Math.abs(skeleton.chest.u.z) < 0.25,
      fp: footprint,
      bounds: painter.bounds(skeleton),
      body: painter.bounds(skeleton, 0.35),
      drawShadow: (c) => {
        if (!primary && !character.death) {
          c.save(); c.translate(0, -character.groundZ * cam.cosP * cam.zoom); c.transform(...cam.groundMatrix());
          c.strokeStyle = '#c14e40'; c.lineWidth = 2.5 / cam.zoom;
          c.beginPath(); c.arc(character.pos.x, character.pos.y, 33, 0, Math.PI * 2); c.stroke();
          const warning = combat.telegraph;
          if (warning) {
            const range = warning.kind === 'stone' ? warning.range : 105, cone = warning.kind === 'stone' ? 0.075 : 0.48;
            c.fillStyle = 'rgba(177,47,26,0.14)'; c.strokeStyle = '#a12d22'; c.lineWidth = 3 / cam.zoom;
            c.beginPath(); c.moveTo(character.pos.x, character.pos.y); c.arc(character.pos.x, character.pos.y, range, warning.dir - cone, warning.dir + cone); c.closePath(); c.fill(); c.stroke();
            c.fillStyle = 'rgba(242,136,35,0.5)';
            c.beginPath(); c.moveTo(character.pos.x, character.pos.y); c.arc(character.pos.x, character.pos.y, range * warning.progress, warning.dir - cone, warning.dir + cone); c.closePath(); c.fill();
          }
          c.restore();
        }
        painter.drawShadow(c, skeleton, character.groundZ);
      },
      draw: (c) => {
        painter.draw(c, skeleton, character.look, character.equipped, primary ? PD.classes.appearanceOf(character) : combat.rivalAppearance);
        PD.slingshot?.drawCharge(c, character, skeleton, cam, reducedMotion);
      },
    };
  }

  function start() {
    resize();
    if (PD.GameAudio) audio = new PD.GameAudio();
    world = new PD.World(cam);
    world._dpr = cam.dpr;
    createRound(false);
    input = new PD.Input(canvas, cam, ui);
    ui.setMode(input.mode);
    input.onMode = (m) => ui.setMode(m);
    rig = PD.rig.buildRig(hero.pose());
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    window.addEventListener('blur', () => { input.cancelActions(); combat.setPaused(true); audio?.silence(); ui.setCombat(combat); });
    document.addEventListener?.('visibilitychange', () => { if (document.hidden) { input.cancelActions(); combat.setPaused(true); audio?.silence(); ui.setCombat(combat); } });
    // não perde o jogo sem querer (ex.: Ctrl+W): o navegador pergunta antes de fechar
    window.addEventListener('beforeunload', (e) => {
      if (hero && hero.time > 3) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    bindButtons();
    requestAnimationFrame(frame);
    window.__pdReady = true;
  }

  function bindButtons() {
    const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
    on('btn-bones', () => {
      renderer.showBones = !renderer.showBones;
      document.getElementById('btn-bones').setAttribute('aria-pressed', renderer.showBones ? 'true' : 'false');
    });
    on('btn-help', toggleHelp);
    on('btn-death', () => { ui.toggleHelp(false); combat.setPaused(false); hero.die(); });
    on('btn-hit', () => { ui.toggleHelp(false); combat.setPaused(false); hero.reactToHit(); });
    on('btn-restart', restart);
    on('btn-training', mainAction);
    on('weapon-fists', () => { combat.selectWeapon('fists'); ui.setCombat(combat); });
    on('weapon-slingshot', () => { combat.selectWeapon('slingshot'); ui.setCombat(combat); });
    on('help-close', () => { ui.toggleHelp(false); combat.setPaused(false); });
    on('btn-zoom-in', () => setZoom(zoomUser * 1.15));
    on('btn-zoom-out', () => setZoom(zoomUser / 1.15));
    on('btn-full', async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          // em tela cheia o Chrome deixa a página segurar Ctrl+W (assim agachar com Ctrl não fecha a aba)
          await navigator.keyboard?.lock?.(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ControlLeft', 'ControlRight']).catch(() => {});
        } else {
          await document.exitFullscreen();
        }
      } catch {
        // tela cheia não disponível (alguns celulares): segue normal
      }
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      setZoom(zoomUser * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    }, { passive: false });
    try {
      if (localStorage.getItem('pindorama:ajuda') === '0') ui.toggleHelp(false);
    } catch {
      // sem armazenamento
    }
  }

  function toggleHelp() {
    ui.toggleHelp();
    if (!ui.help.hidden) input.cancelActions();
    combat.setPaused(!ui.help.hidden);
    if (!ui.help.hidden) audio?.silence();
  }

  function mainAction() {
    input?.cancelActions();
    ui.toggleHelp(false);
    if (combat.paused) { combat.setPaused(false); return; }
    if (combat.phase === 'ready') combat.start();
    else restart();
  }

  function createRound(active) {
    audio?.reset();
    const sp = PD.MAP.spawn, equipped = { ...(hero && hero.equipped) }, classe = hero && hero.classe;
    if (world.particles) world.particles.length = 0;
    world.shake = 0;
    hero = new PD.Character(sp.x, sp.y, Math.PI / 4, { classe });
    hero.equipped = equipped;
    hero.groundZ = world.heightAt(sp.x, sp.y);
    rig = PD.rig.buildRig(hero.pose());
    combat = new PD.TrainingCombat(hero, world, { enemyWeapon: 'slingshot' });
    rival = combat.enemy.character;
    rivalRig = PD.rig.buildRig(rival.pose());
    renderer = new PD.CharacterRenderer(cam); rivalRenderer = new PD.CharacterRenderer(cam);
    if (active) combat.start();
    camTarget = null;
  }

  function restart() {
    if (!combat.canReset) return;
    input?.cancelActions();
    ui.toggleHelp(false);
    createRound(combat.hasStarted);
    ui.setLife(hero); ui.setCombat(combat);
  }

  // Para testes automáticos (só leitura e comandos simples)
  window.__pd = {
    get hero() { return hero; },
    get enemy() { return rival; },
    get combat() { return combat; },
    get world() { return world; },
    get cam() { return cam; },
    get renderer() { return renderer; },
    get stats() { return { fps: stats.fps, ms: stats.workAvg, fases: world && world.timing }; },
    pause(v = true) { paused = v; },
    setYaw(deg) { hero.yaw = deg * M.DEG; hero.faceYaw = hero.yaw; },
    teleport(x, y) { hero.pos.x = x; hero.pos.y = y; camTarget = null; },
    setZoom,
    startTraining: mainAction,
    /** Teste da arquitetura de equipamentos: veste um capacete e botas de prova (some ao recarregar). */
    provarEquipamento() {
      const E = PD.equipment;
      if (!E.catalog.has('teste-capacete')) {
        E.define({ id: 'teste-capacete', slot: 'cabeca', nome: 'Capacete de prova', esconde: ['cabeloFrente'], material: { base: '#8d96a0', shade: '#5f6770', light: '#c4ccd4' },
          pecas: [{ osso: 'cabeca', esferas: [{ p: [0, -1, 4], r: 17.4 }, { p: [0, 3, 9], r: 15.5 }, { p: [-12, -3, -3], r: 9 }, { p: [12, -3, -3], r: 9 }] }] });
        E.define({ id: 'teste-bota', slot: 'pes', nome: 'Bota de prova', material: { base: '#6b4a2f', shade: '#47301d', light: '#8f6844' },
          pecas: [
            { osso: 'canela', lado: 'ambos', esferas: [{ t: 0.6, f: 0, o: 0, r: 5 }, { t: 1, f: 0, o: 0, r: 4.4 }] },
            { osso: 'pe', lado: 'ambos', esferas: [{ s: 0, f: -3.8, u: -2.6, r: 4.1 }, { s: 0, f: 5, u: -1, r: 4.2 }, { s: 0.3, f: 15.8, u: -3.3, r: 3.3 }] },
          ] });
      }
      hero.equip('cabeca', 'teste-capacete');
      hero.equip('pes', 'teste-bota');
    },
  };

  // espera as fontes das placas (se a internet não deixar, segue com a fonte de reserva)
  const fontsReady = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('40px "Bangers"'), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  fontsReady.then(start, start);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => world && world.invalidate());
  }
})(window.PD = window.PD || {});
