# O CRÍTICO DO ROSTO (rodada 1 do rosto do Birim, 18/11): a referência e o nosso desenho na MESMA escala, alinhados
# pelos olhos, lado a lado e um por cima do outro, com linhas nos pontos medidos da referência (boné, sobrancelha, olhos,
# base do nariz, boca, fim da barba). É o "crítico" do método: comparar parte por parte antes de entregar.
#
# Uso: python3 -I ferramentas/critico-rosto.py <referencia.png> <pontos.json> <nosso.png> <saida.png> [rotulo]
#  - referencia.png: a cabeça de referência, de frente, em fundo verde (o verde vira cinza). Fica FORA do repositório.
#  - pontos.json: medidos na referência (com uma grade por cima), em pixels dela:
#      {"olhoE": [784, 900], "olhoD": [1269, 900], "caixa": [300, 20, 1750, 1800],
#       "linhas": [["boné", 617], ["sobrancelha", 760], ["olhos", 900], ["nariz", 1200], ["boca", 1327], ["barba", 1740]]}
#  - nosso.png: o rosto de frente desenhado pelo motor, com fundo transparente:
#      node ferramentas/ficha.cjs <pasta> --modelo birim --graus 0 --inclinacao 0 --escala 30 --tamanho 1400x1400 --ancora 3.84 --solto
#  Os olhos do nosso desenho são achados pela cor do branco do olho (`eyeWhite` da paleta: troque OLHO abaixo se mudar).
import sys, os, json
from PIL import Image, ImageDraw, ImageFont

ref_path, pts_path, ours_path, out = sys.argv[1:5]
label = sys.argv[5] if len(sys.argv) > 5 else ''
REF = json.load(open(pts_path, encoding='utf-8'))
OLHO = (243, 216, 174)  # o branco do olho do Birim (#f3d8ae)
GREY = (60, 60, 64)

def font(size, bold=False):
    f = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    return ImageFont.truetype(f, size) if os.path.exists(f) else ImageFont.load_default()

# referência: troca o verde do fundo pelo cinza
ref = Image.open(ref_path).convert('RGB')
px = ref.load()
for y in range(ref.size[1]):
    for x in range(ref.size[0]):
        r, g, b = px[x, y]
        if g > 150 and r < 120 and b < 120:
            px[x, y] = GREY

# nosso: acha o branco dos olhos (cor eyeWhite) e o centro de cada olho
ours = Image.open(ours_path).convert('RGBA')
W, H = ours.size
op = ours.load()
pts = []
for y in range(H // 6, H * 2 // 3):
    for x in range(W // 4, W * 3 // 4):
        r, g, b, a = op[x, y]
        if a > 200 and abs(r - OLHO[0]) < 14 and abs(g - OLHO[1]) < 14 and abs(b - OLHO[2]) < 16:
            pts.append((x, y))
if not pts:
    sys.exit('não achei o branco dos olhos no nosso desenho')
# os dois maiores pedaços ligados dessa cor são os olhos (o brilho do brinco, por exemplo, também tem pixels parecidos)
mask = set(pts)
comps = []
while mask:
    seed = mask.pop()
    comp = [seed]
    stack = [seed]
    while stack:
        x, y = stack.pop()
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if q in mask:
                mask.remove(q)
                comp.append(q)
                stack.append(q)
    comps.append(comp)
# (a íris divide o branco de cada olho em dois pedaços; pedaços pequenos — a borda do brilho do brinco — ficam de fora)
big_pts = [p for c in comps if len(c) >= 40 for p in c]
if not big_pts:
    sys.exit('não achei o branco dos olhos no nosso desenho')
cx = sum(p[0] for p in big_pts) / len(big_pts)
def box(ps):
    xs = [p[0] for p in ps]; ys = [p[1] for p in ps]
    return min(xs), min(ys), max(xs), max(ys)
L = [p for p in big_pts if p[0] < cx]; R = [p for p in big_pts if p[0] >= cx]
bl, br = box(L), box(R)
eyeL = ((bl[0] + bl[2]) / 2, (bl[1] + bl[3]) / 2)
eyeR = ((br[0] + br[2]) / 2, (br[1] + br[3]) / 2)
ipd_ours = eyeR[0] - eyeL[0]
ipd_ref = REF['olhoD'][0] - REF['olhoE'][0]
k = ipd_ref / ipd_ours
# escala o nosso para a escala da referência e alinha o meio dos olhos
big = ours.resize((round(W * k), round(H * k)), Image.LANCZOS)
mid_ours = ((eyeL[0] + eyeR[0]) / 2 * k, (eyeL[1] + eyeR[1]) / 2 * k)
mid_ref = ((REF['olhoE'][0] + REF['olhoD'][0]) / 2, (REF['olhoE'][1] + REF['olhoD'][1]) / 2)
canvas = Image.new('RGBA', ref.size, GREY + (255,))
canvas.alpha_composite(big, (round(mid_ref[0] - mid_ours[0]), round(mid_ref[1] - mid_ours[1])))
ours_al = canvas.convert('RGB')

x0, y0, x1, y1 = REF['caixa']
A = ref.crop((x0, y0, x1, y1))
B = ours_al.crop((x0, y0, x1, y1))
C = Image.blend(A, B, 0.5)
cw = 620
s = cw / A.size[0]
A, B, C = [im.resize((cw, round(im.size[1] * s)), Image.LANCZOS) for im in (A, B, C)]
ch = A.size[1]
top = 70
sheet = Image.new('RGB', (cw * 3 + 20, ch + top + 10), (30, 30, 33))
d = ImageDraw.Draw(sheet)
d.text((10, 8), 'Rosto do Birim, de frente: referência × nosso × um por cima do outro ' + label, font=font(24, True), fill=(240, 232, 214))
d.text((10, 40), 'mesma escala, alinhados pelos olhos; as linhas são os pontos da referência', font=font(17), fill=(200, 196, 186))
for i, im in enumerate((A, B, C)):
    X = i * (cw + 10)
    sheet.paste(im, (X, top))
    for name, yy in REF['linhas']:
        Y = top + (yy - y0) * s
        d.line([(X, Y), (X + cw, Y)], fill=(80, 220, 255), width=1)
        if i == 0:
            d.text((X + 4, Y - 18), name, font=font(15), fill=(80, 220, 255))
sheet.save(out)
print(out, sheet.size, '| olhos do nosso: largura %.0f x %.0f e %.0f x %.0f px (na escala dele), distância %.0f' % (bl[2] - bl[0], bl[3] - bl[1], br[2] - br[0], br[3] - br[1], ipd_ours), '| escala %.2f' % k)
