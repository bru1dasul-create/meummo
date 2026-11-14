// O mapa da tecla M e o mini mapa (pedido do dono, 14/11: "o M abre o mapa completo, que só mostra o que você já
// andou, e um mini mapa"). O mapa é visto de cima, com o norte para cima; o que você ainda não viu fica na neblina.
//
// O desenho é provisório, feito das formas do mapa (o chão, a água, o que bloqueia, as copas). Quando o [mundo] fizer a
// imagem de cima do mapa (`/assets/maps-iso/<id>-mapa.png` + `<id>-mapa.json`, o formato combinado), ela entra no
// lugar, com os nomes do .json. A [arte] restiliza (#map-window, #minimap) quando quiser.

import { decodeGrid, EXPLORE_CELL, isExplored, type ExploreGrid } from '../../shared/explore';
import { GameMap, type TiledMap } from '../../shared/map';
import { GROUND, shapeOf, typeOf, type Shape } from './view';

/** Pixels por metro das imagens prontas (o chão e a neblina). */
const PX_PER_M = 4;
/** Quanto do mundo o mini mapa mostra em volta de você (metros, de um lado ao outro). */
const MINIMAP_SPAN_M = 56;
const FOG = 'rgba(12, 18, 16, 0.94)';

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
   * Desenha o pedaço `view` do mapa (metros: x, y, largura, altura) no retângulo `dest` (pixels) do `ctx`, com você
   * (a seta) e os NPCs que já foram vistos; `names`: os nomes dos lugares já vistos.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    view: { x: number; y: number; w: number; h: number },
    dest: { x: number; y: number; w: number; h: number },
    me: { x: number; y: number; angle: number },
    markers: MapMarker[],
    names: boolean,
  ): void {
    const k = dest.w / view.w; // pixels por metro na tela
    ctx.save();
    ctx.beginPath();
    ctx.rect(dest.x, dest.y, dest.w, dest.h);
    ctx.clip();
    ctx.fillStyle = '#0c1210';
    ctx.fillRect(dest.x, dest.y, dest.w, dest.h);
    const src = { x: view.x * PX_PER_M, y: view.y * PX_PER_M, w: view.w * PX_PER_M, h: view.h * PX_PER_M };
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, src.x, src.y, src.w, src.h, dest.x, dest.y, dest.w, dest.h);
    ctx.drawImage(this.fog, src.x, src.y, src.w, src.h, dest.x, dest.y, dest.w, dest.h);
    const at = (x: number, y: number) => ({ x: dest.x + (x - view.x) * k, y: dest.y + (y - view.y) * k });
    // os NPCs já vistos: bolinha clara (com ! ou ? em cima)
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
        ctx.fillStyle = m.mark === '!' ? '#ffd23f' : '#9fd8ff';
        ctx.strokeText(m.mark, p.x, p.y - Math.max(5, k * 1.4));
        ctx.fillText(m.mark, p.x, p.y - Math.max(5, k * 1.4));
      }
    }
    if (names) {
      for (const n of this.names) {
        if (!this.seen(n.x, n.y)) continue;
        const p = at(n.x, n.y);
        ctx.font = `700 ${Math.round(Math.max(11, Math.min(15, k * 2.2)))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(12, 18, 16, 0.85)';
        ctx.fillStyle = '#f4ead2';
        ctx.strokeText(n.name, p.x, p.y);
        ctx.fillText(n.name, p.x, p.y);
      }
    }
    // você: a seta amarela apontando para onde olha
    const p = at(me.x, me.y);
    const a = (me.angle * Math.PI) / 180;
    const r = Math.max(7, k * 2.2);
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#2b1d12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    ctx.lineTo(p.x + Math.cos(a + 2.5) * r * 0.75, p.y + Math.sin(a + 2.5) * r * 0.75);
    ctx.lineTo(p.x + Math.cos(a) * -r * 0.25, p.y + Math.sin(a) * -r * 0.25);
    ctx.lineTo(p.x + Math.cos(a - 2.5) * r * 0.75, p.y + Math.sin(a - 2.5) * r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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

/** A janela do mapa inteiro (tecla M): o mapa todo cabendo na tela, com os nomes dos lugares já vistos. */
export class MapWindow {
  private readonly panel = document.createElement('div');
  private readonly canvas = document.createElement('canvas');
  private readonly title = document.createElement('h3');
  private readonly style = document.createElement('style');

  constructor() {
    this.style.textContent = `
      #map-window { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; background: rgba(6, 10, 8, 0.55); }
      #map-window[hidden] { display: none; }
      #map-window .frame { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px 12px; border-radius: 12px; border: 2px solid #8a5a2b; background: rgba(28, 18, 12, 0.96); max-width: 94vw; max-height: 92vh; }
      #map-window h3 { margin: 0; padding-right: 30px; font: 800 15px system-ui, sans-serif; color: #ffd98a; display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
      #map-window h3 small { font: 600 12px system-ui, sans-serif; color: #d9c7a2; }
      #map-window .close { position: absolute; top: 6px; right: 8px; background: none; border: 0; color: #f1e4c8; font-size: 18px; cursor: pointer; }
      #map-window canvas { display: block; border-radius: 6px; }`;
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

  /** Desenha (só com a janela aberta): o mapa inteiro cabendo na tela. */
  draw(picture: MapPicture, mapName: string, me: { x: number; y: number; angle: number }, markers: MapMarker[]): void {
    if (this.panel.hidden) return;
    const maxW = Math.min(window.innerWidth * 0.9, 1100);
    const maxH = window.innerHeight * 0.84 - 30;
    const k = Math.min(maxW / picture.widthM, maxH / picture.heightM);
    const w = Math.max(1, Math.floor(picture.widthM * k));
    const h = Math.max(1, Math.floor(picture.heightM * k));
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
    picture.draw(ctx, { x: 0, y: 0, w: picture.widthM, h: picture.heightM }, { x: 0, y: 0, w, h }, me, markers, true);
  }

  destroy(): void {
    this.panel.remove();
    this.style.remove();
  }
}

/** O mini mapa (no canto da tela): o pedaço em volta de você; tocar abre o mapa inteiro. */
export class Minimap {
  private readonly canvas = document.createElement('canvas');
  private readonly style = document.createElement('style');

  constructor(onOpen: () => void) {
    this.style.textContent = `
      #minimap { position: fixed; top: calc(92px + env(safe-area-inset-top)); right: calc(12px + env(safe-area-inset-right)); z-index: 6; width: 148px; height: 148px; border-radius: 12px; border: 2px solid #8a5a2b; background: #0c1210; box-shadow: 0 2px 8px rgba(0,0,0,0.45); cursor: pointer; touch-action: none; }
      @media (pointer: coarse) { #minimap { top: calc(124px + env(safe-area-inset-top)); right: auto; left: calc(8px + env(safe-area-inset-left)); width: 96px; height: 96px; } }`;
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
    const w = this.canvas.clientWidth || 148;
    const h = this.canvas.clientHeight || 148;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const span = MINIMAP_SPAN_M;
    picture.draw(ctx, { x: me.x - span / 2, y: me.y - span / 2, w: span, h: span }, { x: 0, y: 0, w, h }, me, markers, false);
  }

  destroy(): void {
    this.canvas.remove();
    this.style.remove();
  }
}
