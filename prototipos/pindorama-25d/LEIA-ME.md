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

- **Animações:** parado (respira, troca o peso de perna, olha em volta, pisca), andar, correr (passada longa,
  tronco inclinado, braços rápidos, calcanhar subindo atrás), agachar (com transição suave e andando agachado),
  pular (preparo, impulso, subida, queda e pouso dobrando os joelhos) e soco (guarda, armar, golpe, recolher e
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
  pular de pose).
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

## Arquivos

```
index.html            o jogo (página, painel e controles de toque)
prancha.html          prancha de conferência do personagem
js/core/              matemática, câmera isométrica, cascos e pintura no estilo HQ
js/character/         modelo, esqueleto + IK, animador, desenho e equipamentos
js/world/             mapa (dados), chão (pré-desenhado em pedaços), objetos do cenário e o mundo
js/input.js, ui.js    controles (teclado, mouse, toque) e painel
js/game.js            laço do jogo (requestAnimationFrame, tempo real entre quadros)
js/tools/sheet.js     a prancha
```

## Conferido (testes automáticos no navegador)

- Prancha das 8 direções e de todas as animações (`prancha.html`).
- Comprimento dos ossos em 1.200 quadros de animação misturada: coxa, canela, braço, antebraço, pescoço, tronco e o
  tamanho da cabeça não variam (0,0000 cm) — o modelo é um só.
- Pé apoiado no chão andando reto, em curva de 90°, devagar no analógico, correndo, parado e virando no lugar:
  0,0 cm/s de escorregão.
- Colisão (anda contra um prédio e para na fachada, deslizando), as 8 direções (de 45° em 45°), os estados
  (correr, agachar, pular, atacar), o joystick e os botões de toque, celular em pé e deitado.
- Uma revisão crítica independente (outro agente) apontou os problemas de rosto, cintura, pescoço, cabelo, penas,
  mãos, pés, tanga, pé escorregando, pulo, pouso, soco e a calçada de Copacabana; tudo isso foi corrigido.

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
| `saltos.cjs` | procura trancos (coisa que pula de um quadro para o outro) no soco, no combo e andando |
| `tira.cjs <cena> [saida.png] [zoom] [direção]` | tira de filme (um quadro a cada 1/30 s): combo, soco para o lado, virada, parada, corrida e parada, pulo |
| `perfil.cjs` | funções que mais gastam CPU |
| `montar_pagina.py <pasta>` | monta a versão da página publicada (veja `docs/ARTE.md`) |

## Desempenho

- O chão é desenhado uma vez, em pedaços de 512 px, e só copiado; cada prédio, árvore e poste vira uma imagem
  pronta. A cada quadro só se desenham o personagem, a copa balançando, o semáforo e os efeitos.
- Resolução limitada a 2× (telas de celular muito densas não pesam à toa).
- Medido no navegador de teste (computador): ~60 quadros por segundo, de 2 a 4 ms de trabalho por quadro.

## Limites conhecidos (protótipo)

- O personagem não tem corpo-a-corpo com nada ainda (o soco só mostra o impacto).
- Vistos pelo dono e medidos (10/11), para o próximo refino: no soco o tronco gira 37° num quadro só e a cabeça
  fica parada enquanto o peito gira; no combo os braços pulam de pose; andando, o passo é curto e rápido (178 por
  minuto) e o pé dá um passinho de correção a cada pisada. Diagnóstico e plano em `docs/ARTE.md`.
- No meio-fio, os dois pés sobem juntos (não há pé em altura diferente).
- Fios dos postes são desenhados por cima de tudo (no mapa atual não há nada alto na frente deles).
