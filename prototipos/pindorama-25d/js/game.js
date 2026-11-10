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
    return M.clamp(Math.min(w * 1.45, h) / 950, 0.5, 1.3);
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
    if (inp.other.bones) renderer.showBones = !renderer.showBones;
    if (inp.other.help) ui.toggleHelp();
    if (inp.other.zoomIn) setZoom(zoomUser * 1.12);
    if (inp.other.zoomOut) setZoom(zoomUser / 1.12);

    if (!paused) {
      hero.update(dt, inp, world);
      rig = PD.rig.buildRig(hero.pose());
      hero.secondary(rig, dt);
      world._dt = dt;
      world.update(dt, hero);
    }

    // câmera: segue o personagem com suavidade, olhando um pouco para onde ele vai
    const lead = { x: hero.vel.x * 0.22, y: hero.vel.y * 0.22, z: 0 };
    const goal = { x: hero.pos.x + lead.x, y: hero.pos.y + lead.y, z: 0 };
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
  }

  function draw() {
    const dpr = cam.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#4b4e57';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    ctx.setTransform(dpr, 0, 0, dpr, -cam.viewX * dpr, -cam.viewY * dpr);
    const r = hero.radius;
    const actor = {
      fp: { x0: hero.pos.x - r, x1: hero.pos.x + r, y0: hero.pos.y - r, y1: hero.pos.y + r },
      bounds: renderer.bounds(rig),
      body: renderer.bounds(rig, 0.35),
      drawShadow: (c) => renderer.drawShadow(c, rig, hero.groundZ),
      draw: (c) => renderer.draw(c, rig, hero.look, hero.equipped),
    };
    world.draw(ctx, [actor]);
    // a névoa nas bordas da tela é do CSS (#vinheta): o navegador desenha sem custo por quadro
  }

  function start() {
    resize();
    world = new PD.World(cam);
    world._dpr = cam.dpr;
    const sp = PD.MAP.spawn;
    hero = new PD.Character(sp.x, sp.y, Math.PI / 4);
    hero.groundZ = world.heightAt(sp.x, sp.y);
    renderer = new PD.CharacterRenderer(cam);
    input = new PD.Input(canvas, cam, ui);
    ui.setMode(input.mode);
    input.onMode = (m) => ui.setMode(m);
    rig = PD.rig.buildRig(hero.pose());
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
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
    on('btn-help', () => ui.toggleHelp());
    on('help-close', () => ui.toggleHelp(false));
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

  // Para testes automáticos (só leitura e comandos simples)
  window.__pd = {
    get hero() { return hero; },
    get world() { return world; },
    get cam() { return cam; },
    get renderer() { return renderer; },
    get stats() { return { fps: stats.fps, ms: stats.workAvg, fases: world && world.timing }; },
    pause(v = true) { paused = v; },
    setYaw(deg) { hero.yaw = deg * M.DEG; },
    teleport(x, y) { hero.pos.x = x; hero.pos.y = y; camTarget = null; },
    setZoom,
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
