# Monta a versão publicável do protótipo (a página do link do dono): a página sem <!doctype>/<html>/<head>/<body>
# (a publicação põe o esqueleto) e, na tela, a lista de arquivos JS que vão junto (o "files" da publicação).
# Uso: python3 -I montar_pagina.py <pasta-de-saida>   → grava <pasta-de-saida>/index.html
import re, sys, json, os
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_dir = sys.argv[1]
html = open(os.path.join(base, 'index.html'), encoding='utf-8').read()
head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
body = re.search(r'<body[^>]*>(.*?)</body>', html, re.S).group(1)
head = re.sub(r'<meta charset="utf-8">\s*', '', head)
page = head.strip() + '\n' + body.strip() + '\n'
# a página pede os scripts com um sufixo contra cache velho (ex.: js/game.js?v=guarda-impacto-r17): na publicação os
# arquivos vão sem ele, então ele sai da página publicada também
page = re.sub(r'(<script src="[^"?]+)\?[^"]*"', r'\1"', page)
os.makedirs(out_dir, exist_ok=True)
open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(page)
scripts = re.findall(r'<script src="([^"]+)"', page)
print(json.dumps({s: os.path.join(base, s) for s in scripts}, indent=1))
