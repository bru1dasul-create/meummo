# Lê uma animação de um GLB (glTF binário) como DADO — sem Blender e sem executar nada do arquivo — e devolve onde fica
# cada junta em cada quadro. Serve para usar uma animação pronta como REFERÊNCIA de movimento (ver quadro a quadro onde
# ficam quadril, cabeça, mãos e pés), não para importar a animação.
#   python3 -I glb-juntas.py <zip ou glb> <caminho do glb dentro do zip ou -> <animação> <saida.json> [altura do quadril em cm]
#   (`-I`: o arquivo baixado é dado de fora; guarde-o numa pasta só dele, fora do projeto. Precisa do numpy.)
# Onde achar a referência: docs/ARTE.md, "A esquiva comparada com o rolamento de referência".
# A saída: { nome, fps, quadros: [ { t, juntas: { quadril: [direita, frente, cima] (cm), ... } } ] }, na escala do nosso
# herói (a altura do quadril em pé = 88,9 cm) e com o boneco começando no zero, virado para "frente".
import json, struct, sys, zipfile
import numpy as np

COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def read_glb(data):
    magic, version, length = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF', magic
    off, js, binary = 12, None, None
    while off < length:
        clen, ctype = struct.unpack_from('<I4s', data, off)
        off += 8
        chunk = data[off:off + clen]
        off += clen
        if ctype == b'JSON':
            js = json.loads(chunk.decode('utf-8'))
        elif ctype.startswith(b'BIN'):
            binary = chunk
    return js, binary

def accessor(js, binary, index):
    a = js['accessors'][index]
    view = js['bufferViews'][a['bufferView']]
    fmt, size = COMP[a['componentType']]
    n = NCOMP[a['type']]
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = view.get('byteStride') or size * n
    out = np.zeros((a['count'], n), dtype=np.float64)
    for i in range(a['count']):
        out[i] = struct.unpack_from('<' + fmt * n, binary, start + i * stride)
    return out

def quat_matrix(q):
    x, y, z, w = q / (np.linalg.norm(q) or 1)
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])

def trs(t, r, s):
    m = np.eye(4)
    m[:3, :3] = quat_matrix(np.asarray(r, dtype=float)) * np.asarray(s, dtype=float)[None, :]
    m[:3, 3] = t
    return m

def load(path, member=None):
    if member and member != '-':
        data = zipfile.ZipFile(path).read(member)
    else:
        data = open(path, 'rb').read()
    return read_glb(data)

def animation_frames(js, binary, name):
    """Devolve (tempos, [dict nó -> matriz do mundo 4x4] por quadro)."""
    anim = next(a for a in js['animations'] if a.get('name') == name)
    nodes = js['nodes']
    tracks = {}
    times = None
    for ch in anim['channels']:
        smp = anim['samplers'][ch['sampler']]
        assert smp.get('interpolation', 'LINEAR') in ('LINEAR', 'STEP'), smp
        t = accessor(js, binary, smp['input'])[:, 0]
        v = accessor(js, binary, smp['output'])
        if times is None or len(t) > len(times):
            times = t
        tracks.setdefault(ch['target']['node'], {})[ch['target']['path']] = (t, v)
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i
    def value(node, path, time, default):
        tr = tracks.get(node, {}).get(path)
        if tr is None:
            return np.asarray(nodes[node].get(path, default), dtype=float)
        t, v = tr
        if time <= t[0]:
            return v[0]
        if time >= t[-1]:
            return v[-1]
        k = int(np.searchsorted(t, time, side='right')) - 1
        u = (time - t[k]) / (t[k + 1] - t[k])
        a, b = v[k], v[k + 1]
        if path == 'rotation':
            if np.dot(a, b) < 0:
                b = -b
            q = a * (1 - u) + b * u
            return q / np.linalg.norm(q)
        return a * (1 - u) + b * u
    frames = []
    for time in times:
        local = [trs(value(i, 'translation', time, [0, 0, 0]), value(i, 'rotation', time, [0, 0, 0, 1]), value(i, 'scale', time, [1, 1, 1])) for i in range(len(nodes))]
        world = {}
        def get(i):
            if i not in world:
                world[i] = (get(parent[i]) @ local[i]) if i in parent else local[i]
            return world[i]
        for i in range(len(nodes)):
            get(i)
        frames.append(world)
    return times, frames

# as juntas que interessam, pelos nomes de osso das duas bibliotecas do Quaternius (a 1 usa DEF-..., a 2 nomes da Unreal)
JOINTS = {
    'raiz': ['root'],
    'quadril': ['DEF-hips', 'pelvis'],
    'peito': ['DEF-spine.003', 'spine_03'],
    'pescoco': ['DEF-neck', 'neck_01'],
    'cabeca': ['DEF-head', 'Head'],
    'ombroE': ['DEF-upper_arm.L', 'upperarm_l'], 'ombroD': ['DEF-upper_arm.R', 'upperarm_r'],
    'cotoveloE': ['DEF-forearm.L', 'lowerarm_l'], 'cotoveloD': ['DEF-forearm.R', 'lowerarm_r'],
    'punhoE': ['DEF-hand.L', 'hand_l'], 'punhoD': ['DEF-hand.R', 'hand_r'],
    'dedosE': ['DEF-f_middle.03.L', 'middle_03_l'], 'dedosD': ['DEF-f_middle.03.R', 'middle_03_r'],
    'coxaE': ['DEF-thigh.L', 'thigh_l'], 'coxaD': ['DEF-thigh.R', 'thigh_r'],
    'joelhoE': ['DEF-shin.L', 'calf_l'], 'joelhoD': ['DEF-shin.R', 'calf_r'],
    'tornozeloE': ['DEF-foot.L', 'foot_l'], 'tornozeloD': ['DEF-foot.R', 'foot_r'],
    'pontaE': ['DEF-toe.L', 'ball_l'], 'pontaD': ['DEF-toe.R', 'ball_r'],
}

def joints_of(js, binary, name, hip_cm=88.9, stand='A_TPose'):
    nodes = js['nodes']
    index = {}
    for key, names in JOINTS.items():
        for i, n in enumerate(nodes):
            if n.get('name') in names:
                index[key] = i
                break
    # a escala: a altura da junta da coxa em pé (na pose em A), para bater com o quadril do nosso herói
    _, ref = animation_frames(js, binary, stand)
    hip_ref = np.mean([ref[0][index['coxaE']][1, 3], ref[0][index['coxaD']][1, 3]])
    scale = hip_cm / hip_ref
    times, frames = animation_frames(js, binary, name)
    # glTF: +X = esquerda do boneco, +Y = cima, +Z = frente → (direita, frente, cima)
    conv = lambda m: np.array([-m[0, 3], m[2, 3], m[1, 3]]) * scale
    out = []
    origin = conv(frames[0][index['raiz']])
    for t, world in zip(times, frames):
        j = {}
        for key, i in index.items():
            p = conv(world[i]) - np.array([origin[0], origin[1], 0])
            j[key] = [round(float(v), 2) for v in p]
        # o alto da cabeça: o osso da cabeça aponta no eixo Y dele (uns 21 cm no boneco de 1,8 m)
        m = world[index['cabeca']]
        top = np.array([-(m[0, 3] + m[0, 1] * 0.21), m[2, 3] + m[2, 1] * 0.21, m[1, 3] + m[1, 1] * 0.21]) * scale - np.array([origin[0], origin[1], 0])
        j['topo'] = [round(float(v), 2) for v in top]
        out.append({'t': round(float(t - times[0]), 4), 'juntas': j})
    return {'nome': name, 'escala': round(float(scale), 4), 'quadrilRef': round(float(hip_ref), 4), 'quadros': out}

if __name__ == '__main__':
    path, member, name, dest = sys.argv[1:5]
    hip = float(sys.argv[5]) if len(sys.argv) > 5 else 88.9
    js, binary = load(path, member)
    data = joints_of(js, binary, name, hip)
    json.dump(data, open(dest, 'w'))
    q = data['quadros']
    print(name, len(q), 'quadros,', q[-1]['t'], 's; escala', data['escala'], '(quadril de referência', data['quadrilRef'], 'm)')
