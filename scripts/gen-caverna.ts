// A Caverna Sagrada por dentro (24/11, o dono: "pode fazer a caverna por dentro"): o mapa `caverna`, o de dentro da
// caverna do sudoeste do Guarapiranga. Entra-se pela boca (a saída "Caverna Sagrada" do Guarapiranga) e chega-se no pé
// do túnel, que sobe para o norte, passando pela cortina de raízes que brilham, até o Salão das Inscrições: os pilares
// de pedra com as itacoatiaras, a Pedra Ancestral (a das missões de classe) com as oferendas e, no leste, o poço da luz
// verde-água (a que se vê lá de fora, respirando no fundo). Do salão, a passagem do nordeste leva à Toca da Cuca: o
// caldeirão borbulhando, as estantes de potes, os barris e os cogumelos roxos. Escuro: a luz é a da entrada, a do poço,
// a dos cogumelos, a das velas e a do fogo. A Cuca (o bicho e a conversa) fica para a [estrutura] e a [arte]: o lugar
// dela é o ponto `toca-da-cuca`.
//
// O chão de andar é a união do túnel, do salão, da passagem e da toca; todo o resto é pedra (faixas de colisão, como as
// da água) com as pedras da parede na beira: altas no fundo (norte e oeste: a câmera olha do sudeste, elas ficam atrás) e
// baixas na frente (sul e leste), para não tampar quem anda.
//
// uso: npm run gen:caverna -- --out arquivo.tmj  (o mapa de verdade não é sobrescrito sem --force)

import { mulberry32 } from './pixels';
import { writeMapImage } from './mapa-de-cima';
import { area, blob, block, box, checkWedges, dist, distToPath, ellipse, inside, outputPath, point, rect, round, smooth, waterStrips, writeTmj, type Pt, type Rect, type Shape } from './iso-map';

const OUT = outputPath('public/assets/maps-iso/caverna.tmj', 'gen:caverna');
const W = 60;
const H = 54;
const SEED = 20261124;
/** Duas coisas sólidas de frente uma para a outra ficam coladas ou a pelo menos isto (num vão menor o pé entala). */
const MIN_GAP = 1.2;

// ---------------- a planta (metros) ----------------
/** O túnel da entrada: da boca (no sul, onde se chega de fora) subindo para o norte até o salão. */
const TUNNEL = smooth([[30, 53], [30.2, 48], [29, 43], [27.6, 38], [28.2, 33]], 1);
const TUNNEL_W = 4.2;
/** O Salão das Inscrições. */
const HALL = blob(28, 25, 12.5, 8.5, 0.1);
/** A passagem do nordeste, do salão até a toca. */
const PASSAGE = smooth([[36.5, 20.5], [41, 17.5], [44, 14.5]], 1);
const PASSAGE_W = 3.4;
/** A Toca da Cuca. */
const LAIR = blob(47, 10.5, 8.5, 5.6, 0.12);
/** O poço da luz, no leste do salão (não dá para entrar). */
const POOL = blob(35.2, 26.4, 3.2, 2.3, 0.1);
/** A chegada de fora (e onde acorda quem desmaia aqui dentro) e a saída de volta, na ponta sul do túnel. */
const ARRIVAL = { x: 30.1, y: 49 };
const EXIT: Rect = { x0: 27, x1: 33.4, y0: 52.4, y1: H };
/** O lugar da Cuca na toca (o bicho é da [estrutura] e da [arte]). */
const CUCA = { x: 44.4, y: 11.4 };

/**
 * O chão numa grade de 0,5 m (a mesma das faixas de colisão): 1 = de andar, 2 = o poço, 0 = pedra. Sai todo pedaço de
 * chão mais estreito que 1,5 m (numa linha ou numa coluna): a beira das formas, nessa grade, deixava bicos de meio metro
 * entre duas faixas de pedra, onde o pé entalava.
 */
const CELL = 0.5;
const GW = Math.round(W / CELL), GH = Math.round(H / CELL);
const grid = new Uint8Array(GW * GH);
for (let j = 0; j < GH; j++) {
  for (let i = 0; i < GW; i++) {
    const [x, y] = [(i + 0.5) * CELL, (j + 0.5) * CELL];
    const open = inside(x, y, HALL) || inside(x, y, LAIR) || distToPath(x, y, TUNNEL) < TUNNEL_W / 2 || distToPath(x, y, PASSAGE) < PASSAGE_W / 2;
    grid[j * GW + i] = inside(x, y, POOL) ? 2 : open ? 1 : 0;
  }
}
for (let changed = true; changed; ) {
  changed = false;
  for (const [di, dj] of [[1, 0], [0, 1]] as const) {
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        if (grid[j * GW + i] !== 1) continue;
        // o tamanho da carreira de chão que passa por esta casa, na linha (ou na coluna)
        let [a, b] = [0, 0];
        while (i - (a + 1) * di >= 0 && j - (a + 1) * dj >= 0 && grid[(j - (a + 1) * dj) * GW + i - (a + 1) * di] === 1) a++;
        while (i + (b + 1) * di < GW && j + (b + 1) * dj < GH && grid[(j + (b + 1) * dj) * GW + i + (b + 1) * di] === 1) b++;
        if (a + b + 1 < 3) {
          grid[j * GW + i] = 0;
          changed = true;
        }
      }
    }
  }
}
const cellAt = (x: number, y: number) => {
  const [i, j] = [Math.floor(x / CELL), Math.floor(y / CELL)];
  return i < 0 || j < 0 || i >= GW || j >= GH ? 0 : grid[j * GW + i]!;
};
const inPool = (x: number, y: number) => cellAt(x, y) === 2;
/** Chão de andar (o poço fica de fora). */
const walkable = (x: number, y: number) => cellAt(x, y) === 1;
/** Chão de dentro (o de andar ou o poço). */
const floorAt = (x: number, y: number) => cellAt(x, y) !== 0;

const rng = mulberry32(SEED);
const chao: Shape[] = [];
const cenario: Shape[] = [];
const colisao: Shape[] = [];
const areas: Shape[] = [];
const pontos: Shape[] = [];
const saidas: Shape[] = [];

// ---------------- o chão ----------------
// a rocha em volta (quase preta: o que não é chão de andar), o chão de terra escura de dentro e a lama em volta do poço
chao.push(rect('caverna-rocha', 0, W, 0, H));
chao.push(area('caverna', HALL, undefined, 'Salão das Inscrições'));
chao.push(area('caverna', LAIR, undefined, 'Toca da Cuca'));
for (const [t, w] of [[TUNNEL, TUNNEL_W], [PASSAGE, PASSAGE_W]] as const) for (const [x, y] of t) chao.push(ellipse('caverna', x, y, round(w / 2 + 0.35)));
chao.push(area('lama', blob(35.2, 26.4, 4.3, 3.3, 0.12)));
chao.push(area('agua', POOL, { cor: '#1e8a80' }, 'Poço da Luz'));

// ---------------- o que é sólido (as coisas postas à mão) ----------------
/** As caixas de colisão das coisas postas à mão (para a folga das pedras da parede e dos vãos). */
const solids: Rect[] = [];
const keepOut = (x: number, y: number, r: number) => solids.some((s) => x > s.x0 - r && x < s.x1 + r && y > s.y0 - r && y < s.y1 + r);
/** Quanto falta até a pedra em volta (a beira do chão de andar), procurando em volta até `max`. */
function wallGap(x: number, y: number, max = 4): number {
  for (let r = 0.25; r <= max; r += 0.25) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      if (!floorAt(x + Math.cos(a) * r, y + Math.sin(a) * r)) return r;
    }
  }
  return max;
}
const solidBlock = (s: Shape) => {
  colisao.push(s);
  solids.push({ x0: s.x, x1: s.x + (s.w ?? 0), y0: s.y, y1: s.y + (s.h ?? 0) });
};

// ----- o túnel: a cortina de raízes que brilham, os cogumelos e as estalagmites -----
cenario.push(point('cortina-veu', 28.6, 40.2, { largura: 3.6, altura: 4 }, 'Raízes do Véu'));
for (const [x, y] of [[27.9, 44.8], [31.2, 46.4], [26.4, 36.2], [29.8, 35.4], [30, 41.4]] as const) cenario.push(point('planta', x, y, { tipo: 'cogumelo', brilho: '#3fd6c8', raio: 0.35 }));

// ----- o Salão das Inscrições -----
// os pilares de pedra com as itacoatiaras, encostados na parede do fundo (a do norte), com a face gravada para o sul
const GLYPHS = ['espiral', 'sol', 'circulos', 'cobra'];
const pillarXs = [19.5, 24, 28.5, 33];
pillarXs.forEach((x, k) => {
  // (no chão, a uns 1,6 m da parede: o vão até as pedras dela passa de 1,2 m)
  let y = 25;
  while (floorAt(x, y - 0.25)) y -= 0.25;
  y = round(y + 2.2);
  const altura = [2.8, 3.2, 2.6, 3][k]!;
  cenario.push(point('menir', x, y, { altura, largura: 1.1, olhando: 90, glifo: GLYPHS[k % GLYPHS.length]! }));
  solidBlock(block('pedra', x, y, 0.8, { altura }));
});
// a Pedra Ancestral (a das missões de classe), com as oferendas dos dois lados
cenario.push(point('pedra', 23.4, 26.8, { raio: 1.1, ancestral: true }, 'Pedra Ancestral'));
solidBlock(block('pedra', 23.4, 26.8, 1.65));
for (const x of [20.6, 26.2]) {
  cenario.push(point('oferenda', x, 28.6, { velas: 5 }));
  solidBlock(block('oferenda', x, 28.6, 0.6, { bloqueiaTiro: false, altura: 0.5 }));
}
// o poço da luz: o brilho que respira e a luz alta (a que se vê lá de fora), os cogumelos em volta
cenario.push(point('veu', 35.2, 26.4, { raio: 2.6, coluna: 7 }, 'Luz do Poço'));
for (const [x, y] of [[31.4, 24.2], [38.9, 25.1], [32.4, 29.6], [37.8, 29.4], [35.6, 23.2]] as const) cenario.push(point('planta', x, y, { tipo: 'cogumelo', brilho: '#3fd6c8', raio: 0.4 }));
/** Um lugar perto de (x, y) com folga da parede e das outras coisas sólidas (procura em anéis, até 3 m). */
function clearSpot(x: number, y: number, wall: number, around: number): Pt {
  for (let r = 0; r <= 3; r += 0.25) {
    const n = Math.max(1, Math.round(r * 8));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const [px, py] = [round(x + Math.cos(a) * r), round(y + Math.sin(a) * r)];
      if (walkable(px, py) && wallGap(px, py) >= wall && !keepOut(px, py, around)) return [px, py];
    }
  }
  throw new Error(`Não achei lugar livre perto de (${x}, ${y}).`);
}
// as estalagmites (pedras finas e altas no chão), longe das outras coisas sólidas e da parede
for (const [tx, ty, h] of [[18.4, 27.6, 1.8], [21.8, 21.8, 1.5], [30.8, 31.4, 2.1], [38.2, 21.6, 1.6], [17.6, 22.4, 1.4]] as const) {
  const [x, y] = clearSpot(tx, ty, 2.1, 1.6);
  cenario.push(point('rocha', x, y, { raio: 0.45, altura: h, musgo: false, escura: true }));
  solidBlock(block('pedra', x, y, round(0.45 * 1.5)));
}

// ----- a Toca da Cuca -----
cenario.push(point('caldeirao', 47.6, 10.8, { raio: 0.7 }, 'Caldeirão da Cuca'));
solidBlock(block('caldeirao', 47.6, 10.8, 1.4, { bloqueiaTiro: false, altura: 1 }));
// as estantes de potes, no fundo da toca, de frente para o sul (longe da parede: o vão passa de 1,2 m)
for (const [x0, x1] of [[42.6, 44.8], [49.6, 51.8]] as const) {
  let y = 10.5;
  while (floorAt((x0 + x1) / 2, y - 0.25) && floorAt(x0, y - 0.25) && floorAt(x1, y - 0.25)) y -= 0.25;
  const y0 = round(y + 1.6);
  const r: Rect = { x0, x1, y0, y1: round(y0 + 0.5) };
  cenario.push(box('estante-potes', r, { altura: 1.8 }));
  solidBlock(box('estante', r, { altura: 1.8 }));
}
// os barris e o caixote, colados (um do lado do outro)
for (const [x0, y0, t] of [[51.2, 12.2, 'barril'], [51.2, 12.8, 'barril'], [51.8, 12.2, 'caixote']] as const) {
  const r: Rect = { x0, x1: round(x0 + 0.6), y0, y1: round(y0 + 0.6) };
  cenario.push(box(t, r, { altura: t === 'barril' ? 0.9 : 0.5 }));
  solidBlock(box(t, r, { bloqueiaTiro: false, altura: t === 'barril' ? 0.9 : 0.5 }));
}
for (const [x, y] of [[41.4, 12.2], [43.2, 15], [50.6, 14.6], [53.4, 9.2], [46, 7.6]] as const) cenario.push(point('planta', x, y, { tipo: 'cogumelo', brilho: '#b36bff', raio: 0.35 }));

// (as plantas de enfeite ficam no chão de dentro)
for (const o of cenario) if (o.type === 'planta' && !walkable(o.x, o.y)) throw new Error(`O cogumelo em (${o.x}, ${o.y}) ficou fora do chão.`);

// ---------------- a parede: as pedras na beira do chão ----------------
// As casas da beira (chão de dentro com algum vizinho fora dele), a cada 0,5 m; a pedra fica um pouco para fora, na
// direção de fora (a normal). Do lado que a câmera vê (a normal para o sul ou o leste) elas são baixas; no fundo, altas
// e com uma segunda fileira mais alta atrás. Uma a cada ~1,5 m (as de perto se encostam: sem vão de entalar).
{
  const STEP = 0.5;
  const edge: { x: number; y: number; nx: number; ny: number }[] = [];
  for (let y = 0.25; y < H; y += STEP) {
    for (let x = 0.25; x < W; x += STEP) {
      if (!floorAt(x, y)) continue;
      let [nx, ny] = [0, 0];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (!floorAt(x + dx * STEP, y + dy * STEP)) [nx, ny] = [nx + dx, ny + dy];
      const l = Math.hypot(nx, ny);
      if (l > 0) edge.push({ x, y, nx: nx / l, ny: ny / l });
    }
  }
  const placed: Pt[] = [];
  for (const e of edge) {
    // (nada de pedra na boca do túnel: lá é a saída)
    if (e.y > EXIT.y0 - 1.5 && e.x > EXIT.x0 - 1 && e.x < EXIT.x1 + 1) continue;
    if (placed.some(([px, py]) => dist(px, py, e.x, e.y) < 1.5)) continue;
    const front = e.nx + e.ny > 0.35;
    const raio = round(front ? 0.9 + rng() * 0.3 : 1.1 + rng() * 0.5);
    const altura = round(front ? 0.8 + rng() * 0.5 : 2.2 + rng() * 1.3);
    // (a caixa da pedra é quadrada: na diagonal, o canto dela chega mais perto do chão — a conta leva isso em conta)
    const reach = Math.abs(e.nx) + Math.abs(e.ny);
    const off = raio * 0.75 * reach + 0.6;
    const [x, y] = [round(e.x + e.nx * off), round(e.y + e.ny * off)];
    // (fora do mapa, não: ninguém chega lá)
    if (x < 0.6 || y < 0.6 || x > W - 0.6 || y > H - 0.6) continue;
    placed.push([e.x, e.y]);
    cenario.push(point('rocha', x, y, { raio, altura, musgo: rng() < 0.25, escura: true }));
    colisao.push(block('pedra', x, y, round(raio * 1.5)));
    if (!front) {
      // a segunda fileira, mais alta, atrás (a massa da pedra)
      const r2 = round(raio * 1.15), off2 = off + raio * 1.3 * reach;
      const [x2, y2] = [round(e.x + e.nx * off2), round(e.y + e.ny * off2)];
      if (x2 - r2 * 0.75 < 0 || y2 - r2 * 0.75 < 0 || x2 + r2 * 0.75 > W || y2 + r2 * 0.75 > H) continue;
      cenario.push(point('rocha', x2, y2, { raio: r2, altura: round(altura + 0.6 + rng() * 0.8), musgo: rng() < 0.2, escura: true }));
      colisao.push(block('pedra', x2, y2, round(r2 * 1.5)));
    }
  }
}
// a pedra em volta e a água do poço: faixas que o pé não atravessa (a pedra segura tiro; a água, não)
for (const s of waterStrips((x, y) => !floorAt(x, y), 0, W, 0, H)) colisao.push({ ...s, type: 'pedra', props: {} });
for (const s of waterStrips(inPool, 0, W, 0, H)) colisao.push(s);
// nenhum vão de entalar entre duas coisas sólidas
checkWedges(colisao, MIN_GAP);

// ---------------- as áreas (o escuro), os pontos e a saída ----------------
// (onde duas se cobrem, vale a menor: a entrada tem a luz de fora; a toca é a mais escura)
areas.push(rect('area', 0, W, 0, H, { escuro: 0.72, neblina: 0.12 }, 'Caverna Sagrada'));
areas.push(rect('area', 22, 38, 41, H, { escuro: 0.4, neblina: 0.08 }, 'Entrada da Caverna'));
areas.push(rect('area', 13, 42, 14, 36, { escuro: 0.6, neblina: 0.12 }, 'Salão das Inscrições'));
areas.push(rect('area', 37, 58, 2, 18, { escuro: 0.82, neblina: 0.25 }, 'Toca da Cuca'));
pontos.push(point('ponto', ARRIVAL.x, ARRIVAL.y, undefined, 'spawn'));
pontos.push(point('ponto', ARRIVAL.x, ARRIVAL.y, undefined, 'chegada-guarapiranga'));
pontos.push(point('ponto', CUCA.x, CUCA.y, undefined, 'toca-da-cuca'));
saidas.push(box('saida', EXIT, { mapa: 'guarapiranga', chegada: 'chegada-caverna' }, 'Guarapiranga'));
if (!walkable(ARRIVAL.x, ARRIVAL.y) || !walkable(CUCA.x, CUCA.y) || keepOut(CUCA.x, CUCA.y, 0.6)) throw new Error('A chegada ou o lugar da Cuca não ficam no chão livre.');

writeTmj(
  OUT,
  W,
  H,
  [
    ['chao', chao],
    ['cenario', cenario],
    ['colisao', colisao],
    ['areas', areas],
    ['pontos', pontos],
    ['saidas', saidas],
  ],
  { nome: 'Caverna Sagrada', seguro: false },
);
console.log(`Mapa gerado em ${OUT}: ${W}x${H} m, ${cenario.filter((s) => s.type === 'rocha').length} pedras, ${colisao.length} retângulos de colisão, ${cenario.length} coisas no cenário.`);
const mapImage = writeMapImage(OUT, 8);
console.log(`Mapa visto de cima (tecla M): ${mapImage.png} e ${mapImage.json.split('/').pop()}.`);
