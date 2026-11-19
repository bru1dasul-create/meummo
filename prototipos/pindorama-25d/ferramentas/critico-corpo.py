# O CRÍTICO DO CORPO: a ficha do dono e o nosso desenho na mesma altura (do alto do boné à sola), alinhados pelo meio da
# cintura; três quadros (a ficha, o nosso, e a ficha apagada com os dois contornos por cima: magenta = ficha, ciano =
# nosso) e uma tabela com as bordas em cm (contando 174 cm de altura) nas alturas que importam.
# Uso: python3 -I ferramentas/critico-corpo.py <ficha.png> <sola da ficha, px> <nosso.png RGBA> <saida.png> [rótulo]
# (rodada 3 do Birim, 19/11) A ficha do dono fica FORA do repositório: passe o caminho dela. A sola da ficha é a linha
# de baixo do chinelo (a sombra do chão sai junto com a figura); o nosso desenho: ficha.cjs <pasta> --modelo birim
# --graus 0,90,180 --inclinacao 0 --escala 22 --tamanho 3000x4000 --ancora 0.97 --solto
import sys
from collections import deque
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops


def ref_mask(im):
    """A figura da ficha: o fundo é cinza (pouca cor). Enche a partir das bordas enquanto for cinza e médio; os buracos
    de fundo fechados (entre as pernas, entre o braço e o corpo) também são fundo se forem grandes e claros."""
    w, h = im.size
    px = im.load()
    bg = bytearray(w * h)

    def grey(c):
        return max(c) - min(c) < 14 and 40 < sum(c) / 3 < 125

    def fill(seeds, mark):
        q = deque(seeds)
        comp = []
        while q:
            x, y = q.popleft()
            comp.append((x, y))
            c0 = px[x, y]
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx]:
                    c = px[nx, ny]
                    if grey(c) and abs(sum(c) - sum(c0)) < 30:
                        bg[ny * w + nx] = mark
                        q.append((nx, ny))
        return comp

    seeds = []
    for x in range(w):
        for y in (0, h - 1):
            if grey(px[x, y]) and not bg[y * w + x]:
                bg[y * w + x] = 1
                seeds.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if grey(px[x, y]) and not bg[y * w + x]:
                bg[y * w + x] = 1
                seeds.append((x, y))
    fill(seeds, 1)
    # buracos: componentes cinza grandes e claros (o fundo do painel é ~85-95)
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            c = px[x, y]
            if not bg[y * w + x] and grey(c) and sum(c) / 3 > 72:
                bg[y * w + x] = 2
                comp = fill([(x, y)], 2)
                mean = sum(sum(px[p]) / 3 for p in comp) / len(comp)
                keep = len(comp) > 1200 and mean > 72
                for p in comp:
                    bg[p[1] * w + p[0]] = 1 if keep else 3
    m = Image.new('L', (w, h), 0)
    mp = m.load()
    for y in range(h):
        for x in range(w):
            if bg[y * w + x] != 1:
                mp[x, y] = 255
    return m



ref_path, sole, ours_path, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
label = sys.argv[5] if len(sys.argv) > 5 else ''
H = 1300  # altura do desenho no quadro
TALL = 174.0
KEYS = [96, 92, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70, 66, 62, 58, 55, 50, 45, 40, 35, 30, 25, 22, 18, 14, 10, 6, 3]


def font(size, bold=False):
    f = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    try:
        return ImageFont.truetype(f, size)
    except OSError:
        return ImageFont.load_default()


ref = Image.open(ref_path).convert('RGB')
rm = ref_mask(ref)
rb = rm.getbbox()
top_r, bot_r = rb[1], sole
ours = Image.open(ours_path)
om = ours.split()[3].point(lambda a: 255 if a > 40 else 0)
ob = om.getbbox()
top_o, bot_o = ob[1], ob[3] - 1


def runs(mask, y, minlen=3):
    w = mask.size[0]
    mp = mask.load()
    out, x = [], 0
    while x < w:
        if mp[x, y]:
            x0 = x
            while x < w and mp[x, y]:
                x += 1
            if x - x0 >= minlen:
                out.append((x0, x - 1))
        else:
            x += 1
    return out


def waist_center(mask, top, bot):
    y = round(bot - (bot - top) * 0.60)
    big = max(runs(mask, y), key=lambda r: r[1] - r[0])
    return (big[0] + big[1]) / 2


cr = waist_center(rm, top_r, bot_r)
co = waist_center(om, top_o, bot_o)
kr = H / (bot_r - top_r)
ko = H / (bot_o - top_o)
PAD = 60
HALF = 560  # meia largura do quadro, em px do quadro


def frame(im, mask, top, cx, k, bgc=(70, 70, 74)):
    if im.mode == 'RGBA':
        bg = Image.new('RGB', im.size, bgc)
        bg.paste(im, (0, 0), im)
        im = bg
    box = (cx - HALF / k, top - PAD / k, cx + HALF / k, top + (H + PAD) / k)
    size = (2 * HALF, H + 2 * PAD)
    c = im.crop(tuple(round(v) for v in box)).resize(size, Image.LANCZOS)
    m = mask.crop(tuple(round(v) for v in box)).resize(size, Image.NEAREST)
    return c, m


a, am = frame(ref, rm, top_r, cr, kr)
b, bm = frame(ours, om, top_o, co, ko)


def contour(m):
    e = m.filter(ImageFilter.MaxFilter(5))
    return ImageChops.subtract(e, m)


ov = Image.eval(a, lambda v: int(v * 0.55))
ov.paste((255, 70, 200), (0, 0), contour(am))
ov.paste((60, 230, 255), (0, 0), contour(bm))
W = 3 * 2 * HALF + 4 * 20
sheet = Image.new('RGB', (W, H + 2 * PAD + 70), (28, 28, 31))
d = ImageDraw.Draw(sheet)
d.text((20, 10), f'CRÍTICO DO CORPO {label}', font=font(30, True), fill=(242, 233, 216))
d.text((20 + 2 * HALF + 20, 18), 'ficha | nosso | por cima (magenta = ficha, ciano = nosso)', font=font(20), fill=(200, 196, 186))
for i, im in enumerate((a, b, ov)):
    sheet.paste(im, (20 + i * (2 * HALF + 20), 60))
for pct in KEYS:
    y = 60 + PAD + H * (1 - pct / 100)
    d.line([(0, y), (W, y)], fill=(110, 110, 120), width=1)
    d.text((2, y - 9), f'{pct}', font=font(14), fill=(255, 210, 90))
sheet.save(out)

# a tabela: as bordas de cada trecho, em cm a partir do meio da cintura (contando 174 cm de altura)
cm_r = TALL / (bot_r - top_r)
cm_o = TALL / (bot_o - top_o)
fmt = lambda rr, c, cm: ' '.join(f'[{(x0 - c) * cm:+5.1f},{(x1 - c) * cm:+5.1f}]' for x0, x1 in rr)
print(f'{label}: ficha alto {top_r} sola {bot_r} | nosso alto {top_o} sola {bot_o}  (cm, a partir do meio da cintura)')
for pct in KEYS:
    yr = round(bot_r - (bot_r - top_r) * pct / 100)
    yo = round(bot_o - (bot_o - top_o) * pct / 100)
    print(f'{pct:3d}% {pct * TALL / 100:5.1f}cm  ficha {fmt(runs(rm, yr), cr, cm_r):58s} | nosso {fmt(runs(om, yo), co, cm_o)}')
print(out)
