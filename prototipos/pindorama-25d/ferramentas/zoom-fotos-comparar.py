# Compara duas fotos do jogo tiradas pelo zoom-fotos.cjs (a de verdade e a "referência" refeita do zero): quanto
# diferem e ONDE.
#   python3 zoom-fotos-comparar.py <a.png> <b.png> [saida-diferenca.png]
# Sai: % de pixels com diferença grande (> 40 num canal), a nitidez das duas (energia do laplaciano: imagem esticada
# perde nitidez) e, por quadradinho de 100 px, onde está a diferença. O que se mexe sozinho (o herói respirando, a
# fogueira, as bandeirinhas, o balão de fala) sempre aparece: até ~1% e em poucos quadradinhos é normal.
# Precisa de numpy e Pillow.
import sys
import numpy as np
from PIL import Image

def lap_energy(g):
    l = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float((l * l).mean())

a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.int32)
b = np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(np.int32)
if a.shape != b.shape:
    print('tamanhos diferentes', a.shape, b.shape)
    sys.exit(1)
d = np.abs(a - b).max(axis=2)
big = d > 40
ga, gb = a.mean(axis=2), b.mean(axis=2)
print('pixels com diferença grande: %.3f%% | diferença média: %.2f | nitidez: %.1f contra %.1f (referência) = %.1f%%' % (100 * big.mean(), d.mean(), lap_energy(ga), lap_energy(gb), 100 * lap_energy(ga) / max(1e-9, lap_energy(gb))))
H, W = d.shape
cell = 100
rows = []
for y in range(0, H, cell):
    for x in range(0, W, cell):
        frac = big[y:y + cell, x:x + cell].mean()
        if frac > 0.02:
            sa, sb = lap_energy(ga[y:y + cell, x:x + cell]), lap_energy(gb[y:y + cell, x:x + cell])
            rows.append((frac, x, y, sa, sb))
rows.sort(reverse=True)
for frac, x, y, sa, sb in rows[:14]:
    print('   quadradinho em (%4d, %4d): %4.1f%% diferente | nitidez %.0f contra %.0f' % (x, y, 100 * frac, sa, sb))
if len(sys.argv) > 3:
    out = np.zeros_like(a, dtype=np.uint8)
    out[..., 0] = np.clip(d * 3, 0, 255)
    out[..., 1] = (gb * 0.35).astype(np.uint8)
    out[..., 2] = (gb * 0.35).astype(np.uint8)
    Image.fromarray(out).save(sys.argv[3])
