// Ícones PROVISÓRIOS das habilidades da classe (janela das Habilidades e barra), desenhados por código até a [arte]
// pintar os de verdade (o mesmo id de data/classes.json). Cada um é um quadrado com um desenho simples em cima.

const SIZE = 96;
const urls = new Map<string, string>();

type Painter = (ctx: CanvasRenderingContext2D) => void;

/** Uma flecha de (x0, y0) até a ponta (x1, y1). */
function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, width: number): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(a) * width * 2, y1 - Math.sin(a) * width * 2);
  ctx.stroke();
  const head = width * 3.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a - 0.45) * head, y1 - Math.sin(a - 0.45) * head);
  ctx.lineTo(x1 - Math.cos(a + 0.45) * head, y1 - Math.sin(a + 0.45) * head);
  ctx.closePath();
  ctx.fill();
  // as penas
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 - Math.cos(a + side * 0.6) * head * 0.9, y0 - Math.sin(a + side * 0.6) * head * 0.9);
    ctx.stroke();
  }
}

const PAINTERS: Record<string, { bg: [string, string]; paint: Painter }> = {
  // três flechas caindo do céu num círculo no chão
  chuva_de_flechas: {
    bg: ['#2f5f8a', '#0d1f30'],
    paint: (ctx) => {
      ctx.strokeStyle = 'rgba(255, 230, 150, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(48, 74, 30, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      arrow(ctx, 18, 10, 30, 66, '#f4e6c4', 4);
      arrow(ctx, 42, 4, 50, 70, '#f4e6c4', 4);
      arrow(ctx, 68, 12, 70, 64, '#f4e6c4', 4);
    },
  },
  // uma flecha grande com brilho do espírito
  flecha_ancestral: {
    bg: ['#2b6b52', '#08201a'],
    paint: (ctx) => {
      ctx.shadowColor = '#7dffc8';
      ctx.shadowBlur = 14;
      arrow(ctx, 16, 80, 80, 16, '#c9ffe6', 6);
    },
  },
  // o olho do gavião
  olhos_de_gaviao: {
    bg: ['#7a5a1e', '#22170a'],
    paint: (ctx) => {
      ctx.fillStyle = '#f7e7b5';
      ctx.beginPath();
      ctx.moveTo(10, 48);
      ctx.quadraticCurveTo(48, 12, 86, 48);
      ctx.quadraticCurveTo(48, 84, 10, 48);
      ctx.fill();
      ctx.fillStyle = '#d99a1e';
      ctx.beginPath();
      ctx.arc(48, 48, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1208';
      ctx.beginPath();
      ctx.arc(48, 48, 8, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  // a pegada do bicho espiritual
  chamado_selvagem: {
    bg: ['#5a3b7a', '#180d24'],
    paint: (ctx) => {
      ctx.fillStyle = '#efe1ff';
      ctx.shadowColor = '#c79bff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(48, 60, 18, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const [x, y] of [
        [24, 38],
        [38, 26],
        [58, 26],
        [72, 38],
      ] as const) {
        ctx.beginPath();
        ctx.ellipse(x, y, 7, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  // as três garras da onça
  furia_da_onca: {
    bg: ['#8a3a12', '#240c04'],
    paint: (ctx) => {
      ctx.strokeStyle = '#ffd27a';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      for (const dx of [-22, 0, 22]) {
        ctx.beginPath();
        ctx.moveTo(30 + dx, 16);
        ctx.quadraticCurveTo(50 + dx, 48, 40 + dx, 82);
        ctx.stroke();
      }
    },
  },
};

/** O ícone (imagem em texto) da habilidade `id`; habilidade sem desenho ganha uma estrela. */
export function skillIconUrl(id: string): string {
  let url = urls.get(id);
  if (url) return url;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const art = PAINTERS[id];
  const [light, dark] = art?.bg ?? ['#5c4a2a', '#1a140a'];
  const bg = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 4, SIZE / 2, SIZE / 2, SIZE * 0.7);
  bg.addColorStop(0, light);
  bg.addColorStop(1, dark);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.save();
  if (art) art.paint(ctx);
  else {
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦', SIZE / 2, SIZE / 2 + 2);
  }
  ctx.restore();
  url = canvas.toDataURL();
  urls.set(id, url);
  return url;
}
