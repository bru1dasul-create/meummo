# O CRÍTICO DO PERFIL (BIRIM, rodada 4): a referência (de perfil, já virada para o mesmo lado) e o nosso rosto de lado na
# mesma escala, alinhados pelo OLHO, na escala do rosto (do olho ao fim da barba: o boné da referência é mais alto que o
# nosso). Três quadros: a referência, o nosso e os dois um por cima do outro (a referência apagada e o nosso contorno em
# ciano, com as bordas internas da barba em amarelo). As referências ficam fora do repositório.
# O nosso: `node ferramentas/ficha.cjs <pasta> --modelo birim --graus 90 --inclinacao 0 --escala 30 --tamanho 1400x1400
#   --ancora 3.84 --solto` (a cabeça de perto, com o fundo transparente).
# Uso: python3 -I ferramentas/critico-perfil.py <referencia.png> <olhoX,olhoY,altoY,barbaY da ref> <nosso.png RGBA> <saida.png> [rótulo]
import sys
from collections import deque
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ref_p, pts, ours_p, out = sys.argv[1:5]
label = sys.argv[5] if len(sys.argv) > 5 else ''
ex, ey, rtop, rbot = [float(v) for v in pts.split(',')]  # olho (x, y), alto do boné e fim da barba (y) na referência (o alto só é mostrado)
EYE_WHITE = (243, 216, 174)
W = 900  # largura de cada quadro


def font(size, bold=False):
    f = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    return ImageFont.truetype(f, size)


def blobs(im, ok, box=None):
    """Pedaços ligados dos pontos que cumprem `ok` (dentro de box), do maior para o menor: (n, cx, cy)."""
    w, h = im.size
    px = im.load()
    x0, y0, x1, y1 = box or (0, 0, w, h)
    seen = set()
    found = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if (x, y) in seen or not ok(px[x, y]):
                continue
            q = deque([(x, y)])
            seen.add((x, y))
            n = sx = sy = 0
            while q:
                a, b = q.popleft()
                n += 1
                sx += a
                sy += b
                for c, d in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if x0 <= c < x1 and y0 <= d < y1 and (c, d) not in seen and ok(px[c, d]):
                        seen.add((c, d))
                        q.append((c, d))
            found.append((n, sx / n, sy / n))
    return sorted(found, reverse=True)


ours = Image.open(ours_p).convert('RGBA')
orgb = Image.new('RGB', ours.size, (70, 70, 74))
orgb.paste(ours, (0, 0), ours)
near = lambda c, t, d=26: abs(c[0] - t[0]) + abs(c[1] - t[1]) + abs(c[2] - t[2]) < d
# o olho: o maior pedaço da cor do branco do olho
eye = blobs(orgb, lambda c: near(c, EYE_WHITE))[0]
# o brinco: o pedaço branco-prateado mais perto da orelha (atrás do olho e abaixo dele)
bb = ours.getbbox()
# (só os pedaços pequenos — o cordão também é prateado — e acima da altura do queixo)
cand = [c for c in blobs(orgb, lambda c: min(c) > 205 and max(c) - min(c) < 40, (bb[0], round(eye[2]), round(eye[1]) - 20, min(bb[3], round(eye[2]) + 420))) if 30 < c[0] < 2500]
stud = cand[0]
print('nosso: olho', [round(v) for v in eye[1:]], 'brinco', [round(v) for v in stud[1:]])
# o alto do boné (o primeiro ponto do desenho) e o fim da barba (a última linha com pelo, na frente do brinco)
otop = bb[1]
px_ = orgb.load()
# (a barba fica até ~650 px abaixo do olho nesta escala; mais embaixo é o cordão e o contorno do peito)
hairish = lambda c: sum(c) < 110 and abs(c[0] - c[2]) < 30
obot = max(y for y in range(round(eye[2]), min(bb[3], round(eye[2]) + 470)) if sum(1 for x in range(round(stud[1]), bb[2]) if hairish(px_[x, y])) > 40)
k = (rbot - ey) / (obot - eye[2])  # (pelo rosto: do olho ao fim da barba; o boné da referência é mais alto)
print('nosso: alto', otop, 'fim da barba', obot)
ref = Image.open(ref_p).convert('RGB')
o2 = orgb.resize((round(orgb.size[0] * k), round(orgb.size[1] * k)), Image.LANCZOS)
a2 = ours.split()[3].resize(o2.size, Image.NEAREST)
dx = ex - eye[1] * k
dy = ey - eye[2] * k
canvas = Image.new('RGB', ref.size, (70, 70, 74))
canvas.paste(o2, (round(dx), round(dy)))
mask = Image.new('L', ref.size, 0)
mask.paste(a2, (round(dx), round(dy)))
# recorte em volta da cabeça (da referência)
box = (round(ex - 1150), round(ey - 700), round(ex + 450), round(ey + 900))
crop = lambda im: im.crop(box).resize((W, round(W * (box[3] - box[1]) / (box[2] - box[0]))), Image.LANCZOS)
A, B = crop(ref), crop(canvas)
M = mask.crop(box).resize(A.size, Image.NEAREST)
edge = ImageChops.subtract(M.filter(ImageFilter.MaxFilter(5)), M)
ov = Image.eval(A, lambda v: int(v * 0.55))
ov.paste((60, 230, 255), (0, 0), edge)
# a borda da barba (preto do pelo) do nosso, em amarelo
Bp = B.load()
hair = Image.new('L', B.size, 0)
hp_ = hair.load()
for y in range(B.size[1]):
    for x in range(B.size[0]):
        c = Bp[x, y]
        if sum(c) < 90 and M.getpixel((x, y)):
            hp_[x, y] = 255
hedge = ImageChops.subtract(hair.filter(ImageFilter.MaxFilter(3)), hair)
ov.paste((255, 220, 60), (0, 0), hedge)
sheet = Image.new('RGB', (3 * W + 40, A.size[1] + 60), (28, 28, 31))
d = ImageDraw.Draw(sheet)
d.text((10, 10), f'CRÍTICO DO PERFIL {label}  (referência | nosso | por cima: ciano = nosso contorno, amarelo = borda do pelo)', font=font(22, True), fill=(240, 232, 216))
for i, im in enumerate((A, B, ov)):
    sheet.paste(im, (10 + i * (W + 10), 50))
sheet.save(out)
print(out, sheet.size, 'escala', round(k, 3))
