// O mapa da tecla M e o mini mapa (pedido do dono, 14/11: "o M abre o mapa completo, que só mostra o que você já
// andou, e um mini mapa"). O mapa é visto de cima, com o norte para cima; o que você ainda não viu fica na neblina.
//
// O chão vem da imagem de cima do mapa (`/assets/maps-iso/<id>-mapa.png` + `<id>-mapa.json`, do [mundo]); sem ela, das
// formas do mapa. O visual (o giro, o ponto do herói, a neblina, as molduras e o lugar na tela) é da [arte] desde 15/11;
// a grade do explorado e o jeito de chamar (draw(picture, me, markers)) continuam da [estrutura].
// O dono (15/11) achou o mini mapa provisório "horrível": agora ele é redondo, com anel de madeira e o N, e gira 45°
// para bater com a câmera (a rua que na tela corre de lado corre de lado no mapa); você é um ponto dourado pulsando.

import { decodeGrid, EXPLORE_CELL, isExplored, type ExploreGrid } from '../../shared/explore';
import { GameMap, type TiledMap } from '../../shared/map';
import { GROUND, shapeOf, typeOf, type Shape } from './view';

/** Pixels por metro das imagens prontas (o chão e a neblina). */
const PX_PER_M = 4;
/** Quanto do mundo o mini mapa mostra em volta de você (metros, de um lado ao outro). */
const MINIMAP_SPAN_M = 56;
/** A neblina do que ainda não foi visto: escurece, mas deixa ver o contorno (antes, quase preta, cobria tudo). */
const FOG = 'rgba(10, 16, 14, 0.62)';
/** O giro do mini mapa e do mapa do M: 45° no sentido do relógio, como a câmera (o leste vai para baixo à direita). */
const TURN = Math.PI / 4;

/** Um nome no mapa (metros). */
interface PlaceName {
  name: string;
  x: number;
  y: number;
}

/** Quem aparece no mapa além de você: os NPCs (com o sinal de missão, se tiver). */
export interface MapMarker {
  x: number;
  y: number;
  mark?: '!' | '?' | '';
}

/** As imagens prontas de um mapa: o chão (de cima) e a neblina do que falta ver. */
export class MapPicture {
  readonly widthM: number;
  readonly heightM: number;
  private readonly base = document.createElement('canvas');
  private readonly fog = document.createElement('canvas');
  private grid: ExploreGrid;
  private names: PlaceName[] = [];

  constructor(
    json: TiledMap,
    readonly mapId: string,
    explored: string | undefined,
  ) {
    const map = GameMap.fromTiled(json, mapId);
    this.widthM = map.width;
    this.heightM = map.height;
    for (const c of [this.base, this.fog]) {
      c.width = Math.ceil(this.widthM * PX_PER_M);
      c.height = Math.ceil(this.heightM * PX_PER_M);
    }
    this.paintShapes(json);
    this.names = map.places.filter((p) => p.name).map((p) => ({ name: p.name, x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2 }));
    this.grid = decodeGrid(explored, this.widthM, this.heightM);
    this.paintFog();
    void this.loadPicture();
  }

  /** Quadradinhos novos explorados (a mensagem `explored`). */
  reveal(cells: number[]): void {
    for (const cell of cells) {
      if (cell < 0 || cell >= this.grid.cols * this.grid.rows) continue;
      this.grid.bits[cell >> 3]! |= 1 << (cell & 7);
      this.clearCell(cell);
    }
  }

  /** Quantos quadradinhos estão explorados e quantos o mapa tem (para os testes). */
  progress(): { cells: number; total: number } {
    let cells = 0;
    for (let i = 0; i < this.grid.cols * this.grid.rows; i++) if (isExplored(this.grid, i)) cells++;
    return { cells, total: this.grid.cols * this.grid.rows };
  }

  /** O ponto (metros) já foi visto? */
  seen(x: number, y: number): boolean {
    const cx = Math.floor(x / EXPLORE_CELL);
    const cy = Math.floor(y / EXPLORE_CELL);
    return cx >= 0 && cy >= 0 && cx < this.grid.cols && cy < this.grid.rows && isExplored(this.grid, cy * this.grid.cols + cx);
  }

  /**
   * Desenha o pedaço `view` do mapa (metros: x, y, largura, altura) no retângulo `dest` (pixels) do `ctx`, girado de
   * `turn` (radianos) em volta do meio de `dest`, com você (o ponto dourado) e os NPCs que já foram vistos; `names`: os
   * nomes dos lugares já vistos. Os nomes, os sinais (! e ?) e o ponto ficam em pé. Quem chama recorta (o mini mapa
   * num círculo).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    view: { x: number; y: number; w: number; h: number },
    dest: { x: number; y: number; w: number; h: number },
    me: { x: number; y: number; angle: number },
    markers: MapMarker[],
    names: boolean,
    turn = 0,
  ): void {
    const k = dest.w / view.w; // pixels por metro na tela
    const cx = dest.x + dest.w / 2;
    const cy = dest.y + dest.h / 2;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    /** Metros → tela, girado em volta do meio de `dest`. */
    const at = (x: number, y: number) => {
      const px = dest.x + (x - view.x) * k - cx;
      const py = dest.y + (y - view.y) * k - cy;
      return { x: cx + px * cos - py * sin, y: cy + px * sin + py * cos };
    };
    ctx.save();
    // o chão e a neblina vão girados (o fundo escuro também: fora do mapa)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(turn);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = '#0c1210';
    ctx.fillRect(dest.x, dest.y, dest.w, dest.h);
    const src = { x: view.x * PX_PER_M, y: view.y * PX_PER_M, w: view.w * PX_PER_M, h: view.h * PX_PER_M };
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, src.x, src.y, src.w, src.h, dest.x, dest.y, dest.w, dest.h);
    ctx.drawImage(this.fog, src.x, src.y, src.w, src.h, dest.x, dest.y, dest.w, dest.h);
    ctx.restore();
    // os NPCs já vistos: bolinha verde-água (com ! ou ? em cima)
    for (const m of markers) {
      if (!this.seen(m.x, m.y)) continue;
      const p = at(m.x, m.y);
      ctx.fillStyle = '#9fe6c9';
      ctx.strokeStyle = '#0c1210';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(3, k * 0.9), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (m.mark) {
        ctx.font = `800 ${Math.round(Math.max(11, k * 3))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.fillStyle = m.mark === '!' ? '#ffd23f' : '#9fd8ff';
        ctx.strokeText(m.mark, p.x, p.y - Math.max(5, k * 1.4));
        ctx.fillText(m.mark, p.x, p.y - Math.max(5, k * 1.4));
      }
    }
    if (names) {
      // um nome não cobre o outro: tenta um pouco acima ou abaixo; se não couber, esse fica sem nome
      const size = Math.round(Math.max(11, Math.min(15, k * 2.2)));
      ctx.font = `700 ${size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(12, 18, 16, 0.85)';
      ctx.fillStyle = '#f4ead2';
      const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
      for (const n of this.names) {
        if (!this.seen(n.x, n.y)) continue;
        const p = at(n.x, n.y);
        const half = ctx.measureText(n.name).width / 2 + 3;
        for (const dy of [0, -size - 2, size + 2]) {
          const box = { x0: p.x - half, y0: p.y + dy - size, x1: p.x + half, y1: p.y + dy + 3 };
          if (placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
          placed.push(box);
          ctx.strokeText(n.name, p.x, p.y + dy);
          ctx.fillText(n.name, p.x, p.y + dy);
          break;
        }
      }
    }
    // você: o ponto dourado com contorno branco, pulsando de leve (pedido do dono, 15/11: "ao invés de setinha deveria
    // ser um ponto mesmo, com cor diferente"); os NPCs são verde-água
    const p = at(me.x, me.y);
    const r = Math.max(4.5, Math.min(7, k * 1.6));
    const pulse = (performance.now() % 1600) / 1600;
    ctx.fillStyle = `rgba(255, 201, 58, ${(0.5 * (1 - pulse)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * (1.25 + pulse * 1.8), 0, Math.PI * 2);
    ctx.fill();
    for (const [color, grow] of [['#2b1d12', 2.6], ['#ffffff', 1.5], ['#ffc93a', 0]] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + grow, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(p.x - r * 0.3, p.y - r * 0.35, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- as imagens ----------

  /** O chão de cima, das formas do mapa: o chão (camada `chao`), a água e o que bloqueia (`colisao`), as copas. */
  private paintShapes(json: TiledMap): void {
    const ctx = this.base.getContext('2d')!;
    const s = PX_PER_M;
    ctx.fillStyle = GROUND.mata ?? '#1f4a24';
    ctx.fillRect(0, 0, this.base.width, this.base.height);
    const px = json.tilewidth;
    const ground: Shape[] = [];
    const solids: Shape[] = [];
    const canopies: { x: number; y: number; r: number }[] = [];
    for (const layer of json.layers) {
      for (const o of layer.objects ?? []) {
        if (o.point && !(layer.name === 'cenario' && typeOf(o) === 'arvore')) continue;
        if (layer.name === 'chao') ground.push(shapeOf(o, px));
        else if (layer.name === 'colisao') solids.push(shapeOf(o, px));
        else if (layer.name === 'cenario' && typeOf(o) === 'arvore') {
          const copa = o.properties?.find((p) => p.name === 'copa')?.value;
          canopies.push({ x: o.x / px, y: o.y / px, r: typeof copa === 'number' && copa > 0 ? copa : 1.5 });
        }
      }
    }
    const fill = (shape: Shape, color: string) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      if (shape.lineWidth !== undefined && shape.points) {
        ctx.lineWidth = shape.lineWidth * s;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)));
        ctx.stroke();
        return;
      }
      ctx.beginPath();
      if (shape.points) shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)));
      else if (shape.ellipse) ctx.ellipse(((shape.x0 + shape.x1) / 2) * s, ((shape.y0 + shape.y1) / 2) * s, ((shape.x1 - shape.x0) / 2) * s, ((shape.y1 - shape.y0) / 2) * s, 0, 0, Math.PI * 2);
      else ctx.rect(shape.x0 * s, shape.y0 * s, (shape.x1 - shape.x0) * s, (shape.y1 - shape.y0) * s);
      ctx.closePath();
      ctx.fill();
    };
    for (const g of ground) fill(g, GROUND[g.kind] ?? '#355c2c');
    for (const b of solids) fill(b, SOLID_COLORS[b.kind] ?? '#5b4a38');
    ctx.fillStyle = 'rgba(30, 80, 38, 0.55)';
    for (const c of canopies) {
      ctx.beginPath();
      ctx.arc(c.x * s, c.y * s, c.r * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** A neblina inteira, e depois aberta nos quadradinhos já vistos. */
  private paintFog(): void {
    const ctx = this.fog.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = FOG;
    ctx.fillRect(0, 0, this.fog.width, this.fog.height);
    for (let i = 0; i < this.grid.cols * this.grid.rows; i++) if (isExplored(this.grid, i)) this.clearCell(i);
  }

  /** Abre a neblina de um quadradinho, com a borda macia (os vizinhos se juntam sem degrau). */
  private clearCell(cell: number): void {
    const ctx = this.fog.getContext('2d')!;
    const cx = ((cell % this.grid.cols) + 0.5) * EXPLORE_CELL * PX_PER_M;
    const cy = (Math.floor(cell / this.grid.cols) + 0.5) * EXPLORE_CELL * PX_PER_M;
    const r = EXPLORE_CELL * PX_PER_M * 1.05;
    const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    g.addColorStop(0, 'rgba(0, 0, 0, 1)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** A imagem de cima do [mundo], quando existir: entra no lugar do desenho provisório (e os nomes, os do .json). */
  private async loadPicture(): Promise<void> {
    try {
      const res = await fetch(`/assets/maps-iso/${this.mapId}-mapa.json`);
      if (!res.ok) return;
      const info = (await res.json()) as { nomes?: { nome?: unknown; x?: unknown; y?: unknown }[] };
      const img = new Image();
      img.src = `/assets/maps-iso/${this.mapId}-mapa.png`;
      await img.decode();
      const ctx = this.base.getContext('2d')!;
      ctx.drawImage(img, 0, 0, this.base.width, this.base.height);
      if (Array.isArray(info.nomes)) {
        this.names = info.nomes
          .filter((n): n is { nome: string; x: number; y: number } => typeof n.nome === 'string' && typeof n.x === 'number' && typeof n.y === 'number')
          .map((n) => ({ name: n.nome, x: n.x, y: n.y }));
      }
    } catch {
      // sem a imagem (ainda): fica o desenho das formas
    }
  }
}

/** Cores do que bloqueia (camada `colisao`), vistas de cima. */
const SOLID_COLORS: Record<string, string> = {
  agua: '#2f6f9f',
  'mata-fechada': '#163b1c',
  tronco: '#3a2a1a',
  bambu: '#5f8a3a',
  parede: '#8a8378',
  casa: '#9b7b5a',
  pedra: '#7d7a72',
  gradil: '#2e3a33',
  poste: '#55585c',
};

/** A janela do mapa inteiro (tecla M): o mapa todo cabendo na tela, girado como a câmera, com os nomes já vistos. */
export class MapWindow {
  private readonly panel = document.createElement('div');
  private readonly canvas = document.createElement('canvas');
  private readonly title = document.createElement('h3');
  private readonly style = document.createElement('style');

  constructor() {
    // a moldura é a da mochila (madeira escura com o bronze e o canto tribal)
    this.style.textContent = `
      #map-window { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; background: rgba(6, 10, 8, 0.6); }
      #map-window[hidden] { display: none; }
      #map-window .frame { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 12px 16px 16px; max-width: 94vw; max-height: 92vh;
        border: 1px solid rgba(214, 170, 104, 0.65); border-radius: 12px;
        background: url('/assets/ui/hud/canto-tribal.webp') right -1px bottom -1px / 46px auto no-repeat, linear-gradient(180deg, rgba(42, 33, 23, 0.97), rgba(14, 11, 8, 0.97));
        box-shadow: inset 0 1px 0 rgba(255, 224, 170, 0.14), 0 12px 36px rgba(0, 0, 0, 0.55); }
      #map-window h3 { margin: 0; padding-right: 34px; font: 700 19px / 1.2 var(--title-font, Georgia, serif); color: #ffd23e; text-shadow: 0 1px 2px #000;
        display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
      #map-window h3 small { font: 600 12px system-ui, sans-serif; color: #d9c7a2; text-shadow: none; }
      #map-window .close { position: absolute; top: 9px; right: 10px; width: 26px; height: 26px; padding: 0; border-radius: 50%;
        border: 1px solid rgba(214, 170, 104, 0.6); background: rgba(20, 14, 9, 0.9); color: #f1e4c8; font-size: 13px; line-height: 24px; cursor: pointer; }
      #map-window .close:hover { filter: brightness(1.25); }
      #map-window canvas { display: block; }`;
    document.head.append(this.style);
    this.panel.id = 'map-window';
    this.panel.hidden = true;
    const frame = document.createElement('div');
    frame.className = 'frame';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'close';
    close.textContent = '✕';
    close.title = 'Fechar (M)';
    close.addEventListener('click', () => this.close());
    frame.append(this.title, close, this.canvas);
    this.panel.append(frame);
    // clicar fora do mapa fecha; clique no mapa não vira clique no jogo
    this.panel.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      if (event.target === this.panel) this.close();
    });
    document.body.append(this.panel);
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  toggle(): void {
    this.panel.hidden = !this.panel.hidden;
  }

  close(): void {
    this.panel.hidden = true;
  }

  /** Desenha (só com a janela aberta): o mapa inteiro, girado 45° (um losango) e cabendo na tela. */
  draw(picture: MapPicture, mapName: string, me: { x: number; y: number; angle: number }, markers: MapMarker[]): void {
    if (this.panel.hidden) return;
    // a caixa do mapa girado (metros)
    const c = Math.abs(Math.cos(TURN));
    const sn = Math.abs(Math.sin(TURN));
    const bw = picture.widthM * c + picture.heightM * sn;
    const bh = picture.widthM * sn + picture.heightM * c;
    const maxW = Math.min(window.innerWidth * 0.9, 1100);
    const maxH = window.innerHeight * 0.84 - 34;
    const k = Math.min(maxW / bw, maxH / bh);
    const w = Math.max(1, Math.floor(bw * k));
    const h = Math.max(1, Math.floor(bh * k));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
    }
    const { cells, total } = picture.progress();
    this.title.innerHTML = '';
    this.title.append(mapName);
    const small = document.createElement('small');
    small.textContent = `${Math.round((cells / total) * 100)}% explorado`;
    this.title.append(small);
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const mw = picture.widthM * k;
    const mh = picture.heightM * k;
    picture.draw(ctx, { x: 0, y: 0, w: picture.widthM, h: picture.heightM }, { x: (w - mw) / 2, y: (h - mh) / 2, w: mw, h: mh }, me, markers, true, TURN);
  }

  destroy(): void {
    this.panel.remove();
    this.style.remove();
  }
}

/** O anel do mini mapa: as medidas no PC (`s` = 1) e no celular (menor). */
interface RingLook {
  s: number;
  band: number;
  margin: number;
}
const ringLook = (size: number): RingLook => {
  const s = Math.max(0.5, Math.min(1, size / 172));
  const band = 9 * s;
  return { s, band, margin: band + 8 * s };
};

/** Uma folha do enfeite do anel (como as da moldura do retrato): no ponto (x, y), apontando para `a`. */
function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, wid: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
    ctx.closePath();
  };
  shape();
  ctx.fillStyle = '#13221a';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#13221a';
  ctx.stroke();
  ctx.fillStyle = '#4f8a3c';
  ctx.fill();
  // a metade de baixo mais escura e a nervura
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
  ctx.closePath();
  ctx.fillStyle = '#346b2c';
  ctx.fill();
  ctx.strokeStyle = 'rgba(190, 230, 140, 0.55)';
  ctx.lineWidth = Math.max(0.8, wid * 0.16);
  ctx.beginPath();
  ctx.moveTo(len * 0.06, 0);
  ctx.lineTo(len * 0.9, 0);
  ctx.stroke();
  ctx.restore();
}

/**
 * O anel de madeira trançada do mini mapa (no estilo dos anéis da HUD): a faixa vermelha tribal do lado esquerdo, como a
 * do retrato, umas folhas e o N, que fica para cima e para a direita (o norte, depois do giro de 45°).
 */
function paintRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, look: RingLook): void {
  const { s, band } = look;
  const mid = R + band / 2;
  // a sombra do anel em cima do mapa (dá fundo)
  const shade = ctx.createRadialGradient(cx, cy, R * 0.78, cx, cy, R);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  // o contorno de fora, a madeira e o fio dourado de dentro
  ctx.lineWidth = band + 3.2 * s;
  ctx.strokeStyle = '#1b100d';
  ctx.beginPath();
  ctx.arc(cx, cy, mid, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = band;
  ctx.strokeStyle = '#7a4f2a';
  ctx.stroke();
  // o trançado: tracinhos inclinados, escuros e claros, ao longo do anel
  const n = Math.round((Math.PI * 2 * mid) / (6.5 * s));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const a2 = a + (2.2 * s) / mid;
    const p = (rr: number, aa: number) => ({ x: cx + Math.cos(aa) * rr, y: cy + Math.sin(aa) * rr });
    const i0 = p(R + band * 0.12, a);
    const o0 = p(R + band * 0.88, a2);
    ctx.strokeStyle = '#4b2d16';
    ctx.lineWidth = 1.7 * s;
    ctx.beginPath();
    ctx.moveTo(i0.x, i0.y);
    ctx.lineTo(o0.x, o0.y);
    ctx.stroke();
    const i1 = p(R + band * 0.12, a + (1.6 * s) / mid);
    const o1 = p(R + band * 0.88, a2 + (1.6 * s) / mid);
    ctx.strokeStyle = 'rgba(196, 146, 86, 0.85)';
    ctx.lineWidth = 1.1 * s;
    ctx.beginPath();
    ctx.moveTo(i1.x, i1.y);
    ctx.lineTo(o1.x, o1.y);
    ctx.stroke();
  }
  // a faixa vermelha tribal (do lado esquerdo, como a do retrato), com o zigue-zague claro
  const r0 = Math.PI * 0.82;
  const r1 = Math.PI * 1.2;
  ctx.lineWidth = band * 0.78;
  ctx.strokeStyle = '#8e2a1f';
  ctx.beginPath();
  ctx.arc(cx, cy, mid, r0, r1);
  ctx.stroke();
  ctx.strokeStyle = '#e0b075';
  ctx.lineWidth = 1.1 * s;
  ctx.beginPath();
  const steps = Math.round(((r1 - r0) * mid) / (3.2 * s));
  for (let i = 0; i <= steps; i++) {
    const a = r0 + ((r1 - r0) * i) / steps;
    const rr = mid + (i % 2 ? 1 : -1) * band * 0.24;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 1.4 * s;
  ctx.strokeStyle = '#d6a865';
  ctx.beginPath();
  ctx.arc(cx, cy, R + 0.7 * s, 0, Math.PI * 2);
  ctx.stroke();
  // as folhas: duas embaixo à esquerda e uma à direita
  for (const [ang, len, wid] of [[Math.PI * 0.7, 19, 6.5], [Math.PI * 0.78, 15, 5.5], [Math.PI * 0.03, 15, 5.2]] as const) {
    const x = cx + Math.cos(ang) * (R + band * 0.5);
    const y = cy + Math.sin(ang) * (R + band * 0.5);
    leaf(ctx, x, y, ang + 0.35, len * s, wid * s);
  }
  // o N, no norte (para cima e para a direita, depois do giro)
  const na = -Math.PI / 2 + TURN;
  const nx = cx + Math.cos(na) * mid;
  const ny = cy + Math.sin(na) * mid;
  const nr = 8.6 * s;
  ctx.fillStyle = '#1b100d';
  ctx.beginPath();
  ctx.arc(nx, ny, nr + 1.6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a170b';
  ctx.strokeStyle = '#d6a865';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(nx, ny, nr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd98a';
  ctx.font = `900 ${Math.round(11 * s)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', nx, ny + 0.5 * s);
}

/** O mini mapa (no canto da tela): o pedaço em volta de você, redondo e girado como a câmera; tocar abre o mapa inteiro. */
export class Minimap {
  private readonly canvas = document.createElement('canvas');
  private readonly style = document.createElement('style');
  /** O anel pronto (não muda: é refeito só quando muda o tamanho). */
  private ring: { c: HTMLCanvasElement; key: string } | null = null;

  constructor(onOpen: () => void) {
    // no PC, embaixo da mochila (e em cima do botão das Habilidades, em 250 px); no celular, menor, embaixo do retrato (o
    // anel é desenhado: o canvas fica sem borda)
    this.style.textContent = `
      #minimap { position: fixed; top: calc(76px + env(safe-area-inset-top)); right: calc(6px + env(safe-area-inset-right)); z-index: 6; width: 172px; height: 172px;
        background: none; border: 0; border-radius: 50%; cursor: pointer; touch-action: none; filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5)); }
      @media (pointer: coarse) { #minimap { top: calc(110px + env(safe-area-inset-top)); right: auto; left: calc(2px + env(safe-area-inset-left)); width: 100px; height: 100px; } }`;
    document.head.append(this.style);
    this.canvas.id = 'minimap';
    this.canvas.title = 'Mapa (M)';
    this.canvas.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      event.preventDefault();
      onOpen();
    });
    document.body.append(this.canvas);
  }

  draw(picture: MapPicture, me: { x: number; y: number; angle: number }, markers: MapMarker[]): void {
    const w = this.canvas.clientWidth || 172;
    const h = this.canvas.clientHeight || 172;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const look = ringLook(Math.min(w, h));
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2 - look.margin;
    // o mapa em volta de você, no círculo (o quadrado da vista cobre o círculo em qualquer giro)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    const span = MINIMAP_SPAN_M;
    picture.draw(ctx, { x: me.x - span / 2, y: me.y - span / 2, w: span, h: span }, { x: cx - R, y: cy - R, w: R * 2, h: R * 2 }, me, markers, false, TURN);
    ctx.restore();
    // o anel (pronto; refeito só quando o tamanho muda)
    const key = `${w}x${h}@${dpr}`;
    if (!this.ring || this.ring.key !== key) {
      const c = document.createElement('canvas');
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const rc = c.getContext('2d')!;
      rc.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintRing(rc, cx, cy, R, look);
      this.ring = { c, key };
    }
    ctx.drawImage(this.ring.c, 0, 0, w, h);
  }

  destroy(): void {
    this.canvas.remove();
    this.style.remove();
  }
}
