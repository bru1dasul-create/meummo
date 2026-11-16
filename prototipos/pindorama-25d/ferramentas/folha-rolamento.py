# A comparação do rolamento: a referência (Roll do Quaternius, lida pelo glb-juntas.py) e o nosso (rolamento-medida.cjs).
#   python3 -I folha-rolamento.py <ref.json> <nosso.json> <tira do herói.png> <pasta de saída> [caminho]
# Sai: rolamento-fases.png (as mesmas frações da duração, lado a lado). Com um 5º argumento, também o
# rolamento-caminho.png (o caminho inteiro na mesma escala; as poses se cobrem, ficou confuso). Precisa do Pillow.
import json, sys
from PIL import Image, ImageDraw, ImageFont

def font(size, bold=False):
    try:
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if bold else ''), size)
    except Exception:
        return ImageFont.load_default()

def frame_at(data, t):
    q = data['quadros']
    best = min(q, key=lambda f: abs(f['t'] - t))
    return best

def stick(d, j, ox, oy, k, near=(250, 236, 200), far=(150, 170, 150), w=4, center=None):
    """Boneco de palitos de lado: frente → direita da imagem, cima → cima. `center`: de onde contar a frente (cm)."""
    c = j['raiz'][1] if center is None else center
    P = lambda name: (ox + (j[name][1] - c) * k, oy - j[name][2] * k)
    def line(names, color, width=w):
        pts = [P(n) for n in names]
        d.line(pts, fill=color, width=width, joint='curve')
        for p in (pts[0], pts[-1]):
            d.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=color)
    # o lado de lá (esquerdo) primeiro
    line(['coxaE', 'joelhoE', 'tornozeloE', 'pontaE'], far)
    line(['ombroE', 'cotoveloE', 'punhoE', 'dedosE'], far)
    line(['quadril', 'peito', 'pescoco', 'cabeca'], near, w + 2)
    hx, hy = P('cabeca'); tx, ty = P('topo')
    cx, cy = (hx + tx) / 2, (hy + ty) / 2
    r = max(6, (((hx - tx) ** 2 + (hy - ty) ** 2) ** 0.5) / 2 + 1.5)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=near)
    line(['coxaD', 'joelhoD', 'tornozeloD', 'pontaD'], near)
    line(['ombroD', 'cotoveloD', 'punhoD', 'dedosD'], near)
    for hand in ('dedosD', 'dedosE'):
        p = P(hand)
        d.ellipse([p[0] - 3.5, p[1] - 3.5, p[0] + 3.5, p[1] + 3.5], fill=(255, 190, 90))

def phases(ref, ours, strip_path, out, n=11):
    strip = Image.open(strip_path).convert('RGB')
    CW = strip.width // n
    k = 0.9
    RH = 196  # altura de cada linha de bonecos (px)
    head = 36
    W = CW * n
    H = (head + RH) * 2 + head + strip.height
    im = Image.new('RGB', (W, H), (28, 36, 26))
    d = ImageDraw.Draw(im)
    f1, f2 = font(20, True), font(12)
    rows = [(ref, 'REFERÊNCIA (biblioteca do Quaternius) — dura %.2f s' % ref['quadros'][-1]['t'], (255, 205, 120)),
            (ours, 'O NOSSO rolamento — dura %.2f s' % ours['total'], (150, 230, 150))]
    y = 0
    for data, title, color in rows:
        total = data.get('total') or data['quadros'][-1]['t']
        d.text((10, y + 8), title, fill=color, font=f1)
        d.text((W - 372, y + 12), 'de lado · pontos laranja = as mãos · cinza = o lado de lá', fill=(190, 200, 180), font=f2)
        y += head
        d.rectangle([0, y, W, y + RH], fill=(61, 90, 52))
        ground = y + RH - 16
        d.line([(0, ground), (W, ground)], fill=(40, 60, 36), width=2)
        for i in range(n):
            t = total * i / (n - 1)
            fr = frame_at(data, t)
            stick(d, fr['juntas'], i * CW + CW / 2, ground, k)
            d.text((i * CW + 6, y + 4), '%d%% · %.2f s' % (round(100 * i / (n - 1)), t), fill=(255, 255, 255), font=f2)
            d.text((i * CW + 6, y + RH - 14), 'andou %.1f m' % (fr['juntas']['raiz'][1] / 100), fill=(215, 225, 205), font=f2)
        y += RH
    d.text((10, y + 8), 'O NOSSO, como aparece no jogo (as mesmas frações)', fill=(150, 230, 150), font=f1)
    y += head
    im.paste(strip, (0, y))
    im.save(out + '/rolamento-fases.png')
    return im.size

def path(ref, ours, out):
    k = 1.75  # px por cm
    left, right = 110, 150
    span = 520  # cm
    W = int(left + span * k + right)
    RH, head = 330, 40
    H = (RH + head) * 2 + 8
    im = Image.new('RGB', (W, H), (28, 36, 26))
    d = ImageDraw.Draw(im)
    f1, f2, f3 = font(20, True), font(13), font(13, True)
    def panel(y, data, title, color, times):
        d.text((10, y + 9), title, fill=color, font=f1)
        y += head
        d.rectangle([0, y, W, y + RH], fill=(61, 90, 52))
        ground = y + RH - 46
        d.line([(0, ground), (W, ground)], fill=(40, 60, 36), width=2)
        # a régua: um risco a cada metro
        for m in range(0, 6):
            x = left + m * 100 * k
            d.line([(x, ground), (x, ground + 8)], fill=(200, 215, 190), width=2)
            d.text((x - 8, ground + 26), '%d m' % m, fill=(200, 215, 190), font=f2)
        for i, t in enumerate(times):
            fr = frame_at(data, t)
            u = i / max(1, len(times) - 1)
            near = (int(120 + 135 * u), int(190 + 46 * u), int(255 - 55 * u))
            far = tuple(int(c * 0.6) for c in near)
            stick(d, fr['juntas'], left, ground, k, near=near, far=far, w=4, center=0)
            x = left + fr['juntas']['quadril'][1] * k
            d.text((x - 14, ground + 11), '%.2f' % fr['t'], fill=near, font=f3)
        return y + RH
    y = panel(0, ref, 'REFERÊNCIA: mergulha, rola pelas costas e levanta  (os números embaixo são o tempo, em segundos)', (255, 205, 120), [0, 0.13, 0.27, 0.4, 0.53, 0.67, 0.8, 1.47])
    panel(y + 8, ours, 'O NOSSO: vira uma bola no lugar e rola, sem sair do chão', (150, 230, 150), [0, 0.1, 0.17, 0.22, 0.28, 0.35, 0.43, 0.63])
    im.save(out + '/rolamento-caminho.png')
    return im.size

if __name__ == '__main__':
    ref = json.load(open(sys.argv[1]))
    ours = json.load(open(sys.argv[2]))
    print('fases', phases(ref, ours, sys.argv[3], sys.argv[4]))
    if len(sys.argv) > 5:
        print('caminho', path(ref, ours, sys.argv[4]))
