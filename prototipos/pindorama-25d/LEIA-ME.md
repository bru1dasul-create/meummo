# Pindorama 2.5D — protótipo do personagem base

Protótipo jogável do protagonista de **PINDORAMA**: um rapaz que acorda numa esquina de São Paulo de hoje, sem
saber de onde veio e sem classe. Câmera isométrica fixa (parecida com a do Albion Online), desenho estilo HQ
(contorno de tinta, 2 ou 3 tons por superfície, sombra suave) e **tudo desenhado por código**: nenhuma imagem
pronta, nenhuma engine, nenhum WebGL — só HTML5 Canvas 2D e JavaScript.

Este protótipo é **separado do MeuMMO** (o jogo em Phaser). Ele não mexe no jogo nem no servidor.

## Como abrir

- **No computador:** dê dois cliques em `index.html` (abre no navegador, funciona sem internet; com internet,
  as letras das placas usam a fonte de HQ).
- **No celular:** use o link da página publicada (o Claude manda na conversa).
- **`prancha.html`:** a prancha de conferência — o mesmo personagem nas 8 direções e em cada animação,
  lado a lado. Serve para ver que ele não muda de cara em nenhuma pose.

## Controles

| Computador | Celular |
|---|---|
| **W A S D** (ou setas): andar nas 8 direções | arrastar no lado esquerdo: joystick (empurrar pouco = devagar) |
| **Shift** segurado: correr | botão **Correr** (liga/desliga) |
| **Ctrl** ou **C**: agachar / levantar | botão **Agachar** (liga/desliga) |
| **Espaço**: pular | botão **Pular** |
| **Clique esquerdo**: soco na direção do mouse (**J**: soco para a frente) | botão **Soco** |
| roda do mouse ou **+ / −**: zoom · **B**: esqueleto · **H**: ajuda | botões − + no alto |

A tela mostra sozinha os controles do aparelho (e troca se você começar a usar o outro).

**Atenção com o Ctrl:** no Chrome, **segurar Ctrl e apertar W fecha a aba** — nenhuma página consegue impedir.
Por isso o Ctrl aqui funciona com um toque (aperta e solta), existe o **C** como alternativa, e o navegador
pergunta antes de fechar. Em **Tela cheia** o Chrome deixa o jogo segurar o Ctrl+W.

## O que tem

- **Visual (pela referência que o dono mandou):** rosto forte e largo (maçãs altas, mandíbula larga, queixo quadrado,
  nariz largo e curto, sobrancelha grossa e baixa no meio), faixa de urucum nos olhos com listras brancas nas bochechas
  e uma linha branca no queixo; faixa trançada na testa (losangos vermelhos com miolo preto e cordão dourado nas
  bordas); cabelo puxado para trás (a orelha aparece), comprido nas costas, e duas tranças com amarrações, que nascem
  atrás da orelha e caem na frente dos ombros; coroa de penas vermelhas e creme atrás da cabeça; brincos de contas com
  uma peninha; colar de garras com contas vermelhas e pretas; ombros, peito e costas largos, com o deltoide saindo liso
  do trapézio e músculos marcados de leve (bíceps, antebraço, peitoral, abdômen, coxa, panturrilha); mãos com quatro
  dedos e polegar (fechadas no soco, soltas paradas) e pés com dedão e dedos que dobram no chão. **A aljava e a capa de penas da referência ficaram de fora:**
  o personagem base não tem arma nem armadura (podem virar equipamento).
- **Animações:** parado (respira, troca o peso de perna, olha em volta, pisca), andar, correr (passada longa,
  tronco inclinado, braços rápidos, calcanhar subindo atrás), agachar (com transição suave e andando agachado),
  pular (preparo com os braços para trás, impulso com um balanço dos braços para a frente, subida, queda e pouso
  dobrando os joelhos) e soco (guarda, armar, golpe, recolher e
  voltar; clicar de novo emenda o próximo soco com a outra mão, saindo da pose em que o anterior estava).
- **Pé que rola:** pisa com o calcanhar, fica chato e sai pela ponta, com os dedos dobrando no chão. O ponto que
  encosta fica parado (não escorrega nem em curva fechada); o pé sai do chão parado e pousa parado. Parado, ele dá um
  passinho para se ajeitar quando vira ou entra na guarda do soco.
- **Corpo com peso:** a pelve sobe no meio do passo e desce quando os dois pés estão no chão (e desce um pouco mais
  se a perna precisar alcançar); o tronco gira ao contrário da pelve, um pouco atrasado; braços em pêndulo soltos e
  cabeça com "mola" (chegam um pouquinho depois do corpo). A cabeça vira junto com o corpo e vai na frente nas
  curvas (olha para onde vai).
- **Soco em cadeia:** o quadril gira primeiro, o peito logo atrás e o ombro por último; o punho vai reto para onde
  o mouse aponta e os olhos ficam no alvo. O corpo vira para o alvo rápido, mas com velocidade máxima (nada de
  pular de pose). O impacto é uma estrela pequena com um anel; socando para longe da câmera, ele fica atrás do corpo.
- **Movimento secundário:** cabelo, penas, colar, cordão da tanga e brincos balançam com o vento e com o corpo.
- **Cenário:** esquina com rua de asfalto (faixa amarela, faixa de pedestre, bueiros), calçadas com meio-fio de
  verdade (14 cm: o personagem sobe e desce), ladrilho hidráulico, prédios baixos com padaria, bar, mercadinho e
  lanchonete (toldos, placas, caixa d'água, pichação), postes de concreto com fiação, semáforo funcionando,
  orelhão, banca de jornal, lixeiras laranja, hidrante, mesas de bar, muros com grafite, e uma praça com o
  mosaico paulista (o mapa do estado em pedra portuguesa), grama, ipê-amarelo soltando pétalas, bancos, pedras e o
  **círculo do despertar** (onde ele acorda).
- **Profundidade:** cada coisa é desenhada na ordem certa pelo pé no chão; quem fica na frente do personagem
  (prédio, copa de árvore) abre uma "janela" em volta dele. Sombras projetadas no chão. Colisão com prédios, muros,
  postes, árvores, bancos e objetos (desliza encostado).

## Como o personagem funciona (por dentro)

1. **Um modelo só** (`js/character/body.js`): todas as medidas (altura, cabeça, braços, pernas), cores e
   volumes. Nenhuma animação tem desenho próprio: todas usam este mesmo modelo — por isso ele é sempre igual.
2. **Esqueleto 3D invisível** (`js/character/rig.js`): pelve, coluna, peito, pescoço, cabeça, ombros, braços e
   pernas. Braços e pernas usam **IK de dois ossos**: a animação diz onde o pé ou o punho deve estar e o IK
   acha o joelho ou o cotovelo — o osso nunca estica nem encolhe.
3. **Animador procedural** (`js/character/animator.js`): calcula a pose a cada quadro. A passada avança pela
   distância andada; o pé de apoio fica preso no chão e o tornozelo gira em volta do calcanhar ou da base dos
   dedos (`heelBack` e `ballFwd` em `body.js`). Se uma perna apoiada ficaria esticada demais, a pelve desce o que
   falta (e, se for muito, o pé dá um passo). Braços e cabeça passam por molas; as mudanças são misturas suaves.
4. **Desenho** (`js/character/renderer.js`): cada parte (cabeça, tronco, braço esquerdo e direito, perna
   esquerda e direita) é um grupo de esferas; numa câmera isométrica uma esfera vira sempre um círculo, então o
   contorno da parte é o "casco" desses círculos — certo de qualquer ângulo. Por cima: sombra em meia-lua,
   brilho, contorno de tinta (mais grosso do lado da sombra), rosto, pinturas, colar e tanga. As partes são
   ordenadas pela distância até a câmera a cada quadro (o braço passa na frente ou atrás do tronco).

### Mexer nas medidas e cores

Tudo em `js/character/body.js` (chaves comentadas em português): por exemplo `headScale` (tamanho da cabeça,
com cabelo, penas e rosto juntos), `thigh` e `shin` (pernas), `skin` (cor da pele), `paintRed` (urucum).
Confira na `prancha.html`.

## Equipamentos (arquitetura pronta, sem itens)

`js/character/equipment.js` define os encaixes **cabeça, tronco, pernas, pés, mão direita, mão esquerda e
acessórios**. Um item é um grupo de esferas preso a um osso do mesmo esqueleto (cabeça, peito, pelve, braço,
antebraço, mão, coxa, canela, pé) — então acompanha qualquer animação sem deformar, e é desenhado logo depois da
parte do corpo que veste. O arquivo tem um exemplo comentado (uma bota). Para testar a arquitetura, abra o
console do navegador e rode `__pd.provarEquipamento()` (veste um capacete e botas de prova; some ao recarregar).

Cada item é **conferido** ao ser definido (`define` recusa com a lista dos problemas, em português): encaixe e osso
existentes, osso permitido para o encaixe (capacete só na cabeça, bota na canela e no pé, arma na mão e no
antebraço), esferas com números e raio maior que zero, lado certo nos itens de mão, cores `#rrggbb`. Opcionais:
`ocupa: ['maoD', 'maoE']` (duas mãos: tira o que estava nas duas), `classes: [...]` (só essas classes),
`esconde: [...]` (partes do corpo que somem por baixo). `personagem.equip(encaixe, id)` devolve o que saiu.

## Classes (arquitetura pronta; hoje só "sem classe")

`js/character/classes.js`: uma classe é um **perfil** por cima do mesmo protagonista — muda as cores de pintura,
pano e enfeites (pele, olhos e cabelo não: são a identidade dele), qual golpe o ataque faz, quais encaixes de
equipamento usa e o equipamento inicial. O corpo, o esqueleto, as animações e o desenho são os mesmos para todas,
então a cara dele não muda e os sprites exportados e as peças de equipamento servem para qualquer classe. Exemplo
comentado no começo do arquivo; `new PD.Character(x, y, yaw, { classe: 'id' })`.

## Exportar sprites (`exportar.html`)

Abre no navegador, escolhe animações, direções, classe e escala e baixa um ZIP com os PNGs e o `manifest.json`.
Padrão: quadro do mesmo tamanho para tudo (medido com todas as animações e direções; a 2 px/cm, 408×544),
fundo transparente, **âncora** no chão embaixo do personagem sempre no mesmo pixel (todas as direções se alinham),
pose sem sorteio (exportar de novo dá o mesmo), nomes `pindorama_<classe>_<animação>_<direção>_<NN>.png`.
Animações: parado, andar, correr, agachado, andarAgachado, pular e soco, nas 8 direções (`s` = de frente).
As de passada saem "no lugar": o manifesto diz quanto ele anda por ciclo e a velocidade (o jogo move o sprite nela e
o pé não escorrega); no pulo e no soco o movimento vem desenhado. Também diz os pontos de encaixe (mãos, cabeça,
peito, costas, quadril, pés) em pixels de cada quadro. Com **camadas**, cada quadro vem também em pedaços com o nome
da parte (`..._<NN>__<CC>_<parte>.png`; 00 é o contorno): empilhados em ordem dão exatamente o quadro inteiro.
Pela linha de comando: `node ferramentas/exportar.cjs <pasta> [--animacoes parado,andar] [--direcoes s,n]
[--partes] [--escala 2] [--prancha conferencia.png]`.

## Arquivos

```
index.html            o jogo (página, painel e controles de toque)
prancha.html          prancha de conferência do personagem
js/core/              matemática, câmera isométrica, cascos e pintura no estilo HQ
js/character/         modelo, esqueleto + IK, animador, desenho e equipamentos
js/world/             mapa (dados), chão (pré-desenhado em pedaços), objetos do cenário e o mundo
js/input.js, ui.js    controles (teclado, mouse, toque) e painel
js/game.js            laço do jogo (requestAnimationFrame, tempo real entre quadros)
js/character/classes.js  perfis de classe (cores, golpe, encaixes, equipamento inicial)
js/tools/sheet.js     a prancha
js/tools/audit.js     auditoria com números (IK, escorregão, trancos, interseções, ordem de desenho, zoom)
js/tools/export.js    exportação de sprites padronizados (usada por exportar.html e ferramentas/exportar.cjs)
exportar.html         página de exportação de sprites
```

## Conferido (testes automáticos)

Auditoria da versão 8 (`ferramentas/auditoria.cjs`, 45 roteiros: parado, andando e correndo nas 8 direções,
agachado, pulos, viradas, zigue-zague, transições e socos) e testes no Node (`ferramentas/testes.cjs`, 40 testes):
- O pé e o punho chegam no alvo do IK em todos os roteiros (0,0 cm; antes o pulo chegava a 20–28 cm de erro).
- Pé apoiado não escorrega (0,0 cm/s em todos; antes 31,6 na virada de 180° e 12,8 no zigue-zague) e não entra no
  chão; ossos com 0,0000 cm de variação; joelho nunca dobra para trás, cotovelo nunca ao contrário.
- Agachado: o centro do corpo fica sobre os pés (−4 cm, igual a parado; antes +10,7 cm, caindo para a frente).
- Trancos de perna (cm/quadro² a 60 Hz): andando 5,7 (v7: 4,7), correndo 9,9 (14,5), pulo parado 13,5 (21,2),
  virada de 180° andando 14,7 (30,9); soma dos 45 roteiros 327 (v7: 419).
- Passada: andando ~141 passos/min (passo ~68 cm), correndo ~207 (passo ~127 cm), sem passos de correção.
- Ordem de desenho: trocas com as partes se cobrindo caíram de 436 para 285 nos roteiros medidos; perna desenhada em
  pedaços de 59–90% dos quadros para 12–42%.
- Exportação: todos os quadros do mesmo tamanho, cantos transparentes, nada encostando na borda, camadas
  empilhadas = quadro inteiro (0,0% de diferença); ZIP baixado pela página abre sem erro (PC e celular emulado).
- Colisão, 8 direções, estados, joystick e botões de toque, celular em pé e deitado (`conferir.cjs`, `toque.cjs`).

## Ferramentas de conferência (`ferramentas/`)

Roteiros do Playwright (o navegador de teste) que abrem as páginas direto do disco. Rodam de qualquer pasta e gravam
os prints na pasta de onde forem chamados: `node prototipos/pindorama-25d/ferramentas/<roteiro>`.

| Roteiro | O que faz |
|---|---|
| `prancha.cjs [consulta] [saida.png] [escala]` | print da prancha (ex.: `'?zoom=3&ossos'` mostra o esqueleto; `linhas=` escolhe as linhas) |
| `jogo.cjs <cena> <saida.png> [celular]` | abre o jogo, faz uma cena (andar, correr, soco, pulo, agachar, rua, esquina...) e tira print |
| `conferir.cjs` | colisão com o prédio, 8 direções, estados e quadros por segundo com a CPU 4× mais lenta |
| `toque.cjs [saida.png]` | celular: joystick e botões de toque |
| `ossos.cjs` | comprimento dos ossos em 1.200 quadros (tem que variar 0,0000) |
| `escorregao.cjs` | ponto do pé apoiado que encosta no chão (tem que dar 0,0 cm/s) |
| `passada.cjs` | passos por minuto, tamanho do passo, joelho, cotovelo, balanço e passos de correção do pé |
| `saltos.cjs` | procura trancos (coisa que pula de um quadro para o outro) em braços, pernas e cabeça: soco, combo, andar, pulo, virada; e se a ponta do pé entra no chão |
| `tira.cjs <cena> [saida.png] [zoom] [direção]` | tira de filme (um quadro a cada 1/30 s): combo, soco para o lado, virada, parada, corrida e parada, pulo, virada correndo, soco agachado |
| `cabeca.cjs [saida.png] [zoom]` | a cabeça girando 360°, de 7,5° em 7,5° (o cabelo não pode cobrir o rosto nem pular) |
| `perfil.cjs` | funções que mais gastam CPU |
| `auditoria.cjs [pasta] [saida.json] [filtro]` | auditoria com números em 45 roteiros (a pasta pode ser uma versão antiga, para comparar) |
| `testes.cjs` | testes no Node, sem navegador: encaixes, classes, IK/escorregão/ossos em todos os roteiros, exportação |
| `exportar.cjs <pasta> [opções]` | exporta os sprites padronizados (veja "Exportar sprites") |
| `montar_pagina.py <pasta>` | monta a versão da página publicada (veja `docs/ARTE.md`) |

## Desempenho

- O chão é desenhado uma vez, em pedaços de 512 px, e só copiado; cada prédio, árvore e poste vira uma imagem
  pronta. A cada quadro só se desenham o personagem, a copa balançando, o semáforo e os efeitos.
- Resolução limitada a 2× (telas de celular muito densas não pesam à toa).
- Medido no navegador de teste (computador, sem placa de vídeo): ~60 quadros por segundo; o personagem leva ~4 ms
  por quadro. Com a CPU 4× mais lenta, correndo pela rua: 16 a 17 quadros por segundo numa janela de 1280×800, 12 numa
  de 1920×950 e 12 no celular emulado (Pixel 7) — na versão 7 eram 18, 13 e 13 (a ordem de desenho pelas superfícies
  e as mãos e pés com a mesma forma em todo zoom custam ~20% a mais). Celular de verdade desenha com a placa de vídeo:
  o número real só testando num aparelho.
- Os detalhes pequenos (dedos separados, gomos da trança, músculos, miolo dos losangos da faixa, pontas do cabelo)
  só são desenhados quando o personagem aparece grande o bastante na tela (zoom × densidade da tela ≥ 1,1: o zoom de
  começo de um monitor comum de PC e o celular já passam disso); menor que isso, viram uma forma só.

## Limites conhecidos (protótipo)

- O personagem não tem corpo-a-corpo com nada ainda (o soco só mostra o impacto).
- O soco agachado sai baixo, com o tronco bem inclinado (funciona, mas é o caso menos caprichado).
- Socar para o lado ou para trás espera o corpo virar e os pés se acertarem: o impacto sai em 0,37 s a 0,45 s
  (em frente: 0,23 s).
- No meio-fio, os dois pés sobem juntos (não há pé em altura diferente).
- Fios dos postes são desenhados por cima de tudo (no mapa atual não há nada alto na frente deles).
- Na primeira passada ao começar a correr (e ao levantar do agachado direto para a corrida) o joelho ainda dá um
  tranco (15,7 cm/quadro²; na v7 eram 11,7 e 9,0): a pelve desce de uma vez quando o pé da frente vai pousar longe.
- Trocas de ordem que sobraram: cabelo com trança e com a orelha (encostados) e braço passando atrás do peito no
  balanço da corrida (essa é de verdade). A perna agachada sai em pedaços porque a mão fica entre os joelhos.
- Muito pequeno na tela (zoom 0,6), a silhueta muda um pouco (contorno de 1,6 px no mínimo, para continuar legível).
