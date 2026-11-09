#!/usr/bin/env python3
"""Gera imagens com o Nano Banana (API do Gemini) para o piloto de arte do MeuMMO (frente [arte]).

Ferramenta do chat de Arte na nuvem; o jogo não usa este arquivo. Veja docs/ARTE.md.

A chave NÃO passa por aqui: no ambiente da nuvem ela está em "Segredos de rede" (host
generativelanguage.googleapis.com, cabeçalho x-goog-api-key, sem prefixo) e o proxy coloca o cabeçalho em cada
chamada. Por isso o script usa o curl (que respeita o proxy e o certificado do ambiente). Nunca peça a chave no chat.

Trava de gasto própria: saves/nano-banana.json (fora do Git) conta as imagens e o custo estimado; passou do
limite, o script se recusa a gerar. O dono também pôs (ou ia pôr) um teto mensal no Google AI Studio.

Uso:
  python3 -I scripts/nano-banana.py --listar                      (confere a chave; não gera imagem, não custa)
  python3 -I scripts/nano-banana.py --out arquivo.png --prompt "texto" [--model M] [--aspect 16:9] [--size 1K]
                                     [--ref referencia.png ...]
"""
import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEDGER = os.path.join(ROOT, 'saves', 'nano-banana.json')
MAX_IMAGES = 120          # trava: no máximo 120 imagens no piloto
MAX_USD = 10.0            # trava: no máximo US$ 10 estimados (o teto do Google é US$ 15)
# preço estimado por imagem (fontes de terceiros; a página oficial não abriu)
PRICE = {
    'gemini-nano-banana-2.1': {'1K': 0.034, '2K': 0.05, '4K': 0.113},
    'gemini-3.1-flash-lite-image': {'1K': 0.034, '2K': 0.05, '4K': 0.1},
    'gemini-3.1-flash-image': {'1K': 0.067, '2K': 0.101, '4K': 0.151},
    'gemini-2.5-flash-image': {'1K': 0.039, '2K': 0.039, '4K': 0.039},
    'gemini-3-pro-image': {'1K': 0.134, '2K': 0.134, '4K': 0.24},
}


def ledger():
    if os.path.exists(LEDGER):
        with open(LEDGER) as f:
            return json.load(f)
    return {'images': 0, 'usd': 0.0, 'calls': []}


def listar():
    res = subprocess.run(
        ['curl', '-sS', 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', '--max-time', '60'],
        capture_output=True,
    )
    reply = json.loads(res.stdout or b'{}')
    if 'error' in reply:
        e = reply['error']
        sys.exit(f"ERRO da API (a chave está nos Segredos de rede do ambiente?): {e.get('code')} {e.get('status')} - {e.get('message', '')[:300]}")
    led = ledger()
    print(f"chave ok: {len(reply.get('models', []))} modelos. Piloto até agora: {led['images']} imagens, ~US$ {led['usd']:.2f}")
    for m in reply.get('models', []):
        if 'image' in m['name'] or 'banana' in m.get('displayName', '').lower():
            preco = PRICE.get(m['name'].split('/')[-1], {}).get('1K')
            print(f"  {m['name'].split('/')[-1]:32} {m.get('displayName', ''):24} {'~US$ %.3f/imagem 1K' % preco if preco else ''}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='gemini-nano-banana-2.1')
    ap.add_argument('--aspect', default='1:1')
    ap.add_argument('--size', default='1K')
    ap.add_argument('--out')
    ap.add_argument('--prompt')
    ap.add_argument('--ref', nargs='*', default=[])
    ap.add_argument('--listar', action='store_true', help='lista os modelos de imagem (confere a chave; não custa)')
    a = ap.parse_args()
    if a.listar:
        return listar()
    if not a.out or not a.prompt:
        ap.error('--out e --prompt são obrigatórios para gerar')

    led = ledger()
    cost = PRICE.get(a.model, {}).get(a.size, 0.15)
    if led['images'] + 1 > MAX_IMAGES or led['usd'] + cost > MAX_USD:
        sys.exit(f"TRAVA: limite do piloto atingido ({led['images']} imagens, ~US$ {led['usd']:.2f}). Nada foi gerado.")

    parts = []
    for path in a.ref:
        with open(path, 'rb') as f:
            data = base64.b64encode(f.read()).decode()
        mime = 'image/png' if path.endswith('.png') else 'image/jpeg' if path.endswith(('.jpg', '.jpeg')) else 'image/webp'
        parts.append({'inlineData': {'mimeType': mime, 'data': data}})
    parts.append({'text': a.prompt})
    body = {
        'contents': [{'role': 'user', 'parts': parts}],
        'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': a.aspect, 'imageSize': a.size}},
    }
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as tf:
        json.dump(body, tf)
        body_path = tf.name
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{a.model}:generateContent'
    t0 = time.time()
    res = subprocess.run(
        ['curl', '-sS', '-X', 'POST', url, '-H', 'content-type: application/json', '--data-binary', f'@{body_path}', '--max-time', '180'],
        capture_output=True,
    )
    os.unlink(body_path)
    if res.returncode != 0:
        sys.exit(f'curl falhou: {res.stderr.decode()[:400]}')
    try:
        reply = json.loads(res.stdout)
    except json.JSONDecodeError:
        sys.exit(f'resposta estranha: {res.stdout[:400]!r}')
    if 'error' in reply:
        e = reply['error']
        sys.exit(f"ERRO da API: {e.get('code')} {e.get('status')} - {e.get('message', '')[:500]}")

    saved = 0
    texts = []
    for cand in reply.get('candidates', []):
        for part in cand.get('content', {}).get('parts', []):
            if 'inlineData' in part:
                out = a.out if saved == 0 else a.out.replace('.png', f'-{saved}.png')
                with open(out, 'wb') as f:
                    f.write(base64.b64decode(part['inlineData']['data']))
                saved += 1
            elif 'text' in part:
                texts.append(part['text'])
    usage = reply.get('usageMetadata', {})
    led['images'] += max(saved, 1)
    led['usd'] += cost * max(saved, 1)
    led['calls'].append({'out': a.out, 'model': a.model, 'size': a.size, 'saved': saved, 'usd': cost, 'secs': round(time.time() - t0, 1), 'usage': usage})
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    with open(LEDGER, 'w') as f:
        json.dump(led, f, indent=1)
    if not saved:
        finish = [c.get('finishReason') for c in reply.get('candidates', [])]
        sys.exit(f'nenhuma imagem veio (motivo: {finish}; texto: {" ".join(texts)[:300]})')
    print(f"ok: {saved} imagem(ns) em {a.out} | {round(time.time() - t0, 1)} s | total do piloto: {led['images']} imagens, ~US$ {led['usd']:.2f}")


if __name__ == '__main__':
    main()
