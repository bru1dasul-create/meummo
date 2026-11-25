// Chão na chuva: uma película molhada e poças onde a água junta. As gotas de perto caem até o mesmo ponto no chão em
// que aparecem o respingo e a ondinha. Tudo em cima da imagem pronta do piso, sem refazer o chão de nenhum zoom.
(function (PD) {
  'use strict';
  const M = PD.math;
  const CELL = 205;
  const HARD = new Set(['asfalto', 'rua', 'calcada', 'praca', 'pedra', 'circulo', 'piso', 'degrau']);
  const EARTH = new Set(['terra', 'trilha', 'lama', 'campinho', 'areia']);
  const CACHE_LIMIT = 2400;

  function seedAt(world, column, row, columns) {
    const cache = world._rainGroundCells || (world._rainGroundCells = new Map());
    const id = row * columns + column;
    const old = cache.get(id);
    if (old) return old;
    const rand = PD.groundHelp.cellRng(column, row, 719);
    const x = (column + 0.13 + rand() * 0.74) * CELL;
    const y = (row + 0.13 + rand() * 0.74) * CELL;
    const surface = PD.chao.under(world.map, x, y, Infinity);
    const water = surface === 'agua';
    const hard = HARD.has(surface), earth = EARTH.has(surface);
    const puddle = !water && rand() < (hard ? 0.54 : earth ? 0.34 : 0.06);
    const radius = (24 + rand() * 38) * (hard ? 1.24 : 0.87);
    const period = 0.53 + rand() * 0.76;
    const phase = rand() * period;
    const density = rand();
    const size = 0.72 + rand() * 0.48;
    const outline = puddle ? puddleOutline(rand, world.cam.sinP) : null;
    const seed = { x, y, water, radius, period, phase, density, size, outline };
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(id, seed);
    return seed;
  }

  /** Silhueta da poça sorteada no chão e achatada pela câmera isométrica. */
  function puddleOutline(rand, pitch) {
    const angle = rand() * M.TAU;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const width = 0.43 + rand() * 0.28;
    return Array.from({ length: 9 }, (_, i) => {
      const a = i * M.TAU / 9;
      const reach = 0.57 + rand() * 0.52;
      const dx = Math.cos(a) * reach, dy = Math.sin(a) * reach * width;
      return { x: dx * ca - dy * sa, y: (dx * sa + dy * ca) * pitch };
    });
  }

  function addPuddle(path, x, y, scale, outline) {
    PD.shapes.smoothClosedPath(outline.map((p) => ({ x: x + p.x * scale, y: y + p.y * scale })), path);
  }

  /** O piso das casas que abrem fica seco. O recorte no plano do chão vale também durante a transição do telhado. */
  function clipOutdoors(ctx, world, rect) {
    const cam = world.cam;
    let mask;
    for (const { b } of world.interiors || []) {
      if (cam.sx(b.x1, b.y0) < rect.x0 || cam.sx(b.x0, b.y1) > rect.x1 ||
          cam.sy(b.x1, b.y1, 0) < rect.y0 || cam.sy(b.x0, b.y0, 0) > rect.y1) continue;
      if (!mask) {
        mask = new Path2D();
        mask.rect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
      }
      mask.moveTo(cam.sx(b.x0, b.y0), cam.sy(b.x0, b.y0, 0));
      mask.lineTo(cam.sx(b.x1, b.y0), cam.sy(b.x1, b.y0, 0));
      mask.lineTo(cam.sx(b.x1, b.y1), cam.sy(b.x1, b.y1, 0));
      mask.lineTo(cam.sx(b.x0, b.y1), cam.sy(b.x0, b.y1, 0));
      mask.closePath();
    }
    if (mask) ctx.clip(mask, 'evenodd');
  }

  function addEllipse(path, x, y, rx, ry, angle) {
    path.moveTo(x + rx * Math.cos(angle), y + rx * Math.sin(angle));
    path.ellipse(x, y, rx, ry, angle, 0, M.TAU);
    path.closePath();
  }

  function drawWetFilm(ctx, world, rect, wetness) {
    const cam = world.cam;
    const water = PD.agua?.screenWater(world, (x, y) => ({ x: cam.sx(x, y), y: cam.sy(x, y, 0) }), 1);
    ctx.save();
    if (water) {
      const land = new Path2D();
      land.rect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
      land.addPath(water);
      ctx.clip(land, 'evenodd');
    }
    ctx.fillStyle = `rgba(13, 28, 39, ${wetness * 0.23})`;
    ctx.fillRect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
    ctx.restore();
  }

  function addImpact(paths, p, seed, age, zoom, tilt, ring) {
    const size = seed.size * M.clamp(zoom * 1.75, 0.65, 1.6);
    if (age < 0) {
      const height = -age * 290 * size;
      paths.falls.moveTo(p.x - (height + 6 * size) * tilt, p.y - height - 7 * size);
      paths.falls.lineTo(p.x - height * tilt, p.y - height);
      return;
    }
    if (age < 0.17) {
      const k = age / 0.17;
      const side = (1.1 + k * 4.4) * size;
      const lift = (0.8 + Math.sin(k * Math.PI) * 3.5) * size;
      paths.splashes.moveTo(p.x - side * 0.44, p.y - lift * 0.48);
      paths.splashes.lineTo(p.x - side, p.y - lift);
      paths.splashes.moveTo(p.x + side * 0.44, p.y - lift * 0.48);
      paths.splashes.lineTo(p.x + side, p.y - lift);
      paths.splashes.moveTo(p.x, p.y - lift * 0.75);
      paths.splashes.lineTo(p.x + size * 0.5, p.y - lift * 1.4);
    }
    if (ring) {
      const r = (2 + age * 18) * size;
      addEllipse(age < 0.18 ? paths.rings : paths.ringsFaint, p.x, p.y, r, r * 0.47, 0);
    }
  }

  function draw(ctx, world, t) {
    const rain = world.rainLevel || 0, wetness = world.wetness || 0;
    if (Math.max(rain, wetness) < 0.01 || world.map.kind !== 'tmj') return;
    const cam = world.cam;
    const rect = world._viewRect(36);
    const nw = cam.groundAt(rect.x0, rect.y0), ne = cam.groundAt(rect.x1, rect.y0);
    const sw = cam.groundAt(rect.x0, rect.y1), se = cam.groundAt(rect.x1, rect.y1);
    const columns = Math.ceil(world.map.w / CELL), rows = Math.ceil(world.map.h / CELL);
    const x0 = Math.max(0, Math.floor(nw.x / CELL));
    const y0 = Math.max(0, Math.floor(ne.y / CELL));
    const x1 = Math.min(columns - 1, Math.floor(se.x / CELL));
    const y1 = Math.min(rows - 1, Math.floor(sw.y / CELL));
    const paths = {
      pools: new Path2D(), sheen: new Path2D(), falls: new Path2D(), splashes: new Path2D(), rings: new Path2D(),
      ringsFaint: new Path2D(),
    };
    const tilt = rain > 0.01 ? world.windScreen().x * world.wind.strength * 0.46 : 0;
    const stride = (x1 - x0 + 1) * (y1 - y0 + 1) > 960 ? 2 : 1;
    for (let row = y0; row <= y1; row++) for (let column = x0; column <= x1; column++) {
      if ((column + row) % stride) continue;
      const seed = seedAt(world, column, row, columns);
      if (seed.x >= world.map.w || seed.y >= world.map.h) continue;
      const p = cam.p({ x: seed.x, y: seed.y, z: 0 });
      if (p.x < rect.x0 || p.x > rect.x1 || p.y < rect.y0 || p.y > rect.y1) continue;
      if (wetness > 0.01 && seed.outline) {
        const r = seed.radius * cam.zoom * (0.65 + 0.35 * wetness);
        addPuddle(paths.pools, p.x, p.y, r, seed.outline);
        addPuddle(paths.sheen, p.x - r * 0.045, p.y - r * 0.05, r * 0.69, seed.outline);
      }
      if (rain <= 0.01 || seed.density > 0.27 + rain * 0.73) continue;
      const age = (t + seed.phase) % seed.period - 0.095;
      if (age < 0.38) addImpact(paths, p, seed, age, cam.zoom, tilt, seed.water || (seed.outline && wetness > 0.16));
    }

    ctx.save();
    clipOutdoors(ctx, world, rect);
    if (wetness > 0.01) {
      drawWetFilm(ctx, world, rect, wetness);
      ctx.fillStyle = `rgba(7, 20, 31, ${wetness * 0.37})`;
      ctx.fill(paths.pools);
      ctx.fillStyle = `rgba(153, 195, 223, ${wetness * 0.27})`;
      ctx.fill(paths.sheen);
    }
    if (rain > 0.01) {
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = `rgba(193, 220, 241, ${rain * 0.39})`;
      ctx.stroke(paths.falls);
      ctx.strokeStyle = `rgba(221, 239, 250, ${rain * 0.69})`;
      ctx.stroke(paths.splashes);
      ctx.strokeStyle = `rgba(187, 224, 245, ${rain * 0.43})`;
      ctx.stroke(paths.rings);
      ctx.strokeStyle = `rgba(187, 224, 245, ${rain * 0.22})`;
      ctx.stroke(paths.ringsFaint);
    }
    ctx.restore();
  }

  PD.rainGround = { draw };
})(window.PD = window.PD || {});
