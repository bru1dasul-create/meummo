# Caderno da frente Arte

> Para o chat **"Arte e visual"** (a frente **[arte]**) retomar o trabalho depois de limpar a conversa (`/clear`) ou
> num chat novo. Leia junto: `CLAUDE.md` (regras e divisão do trabalho), `docs/ROADMAP.md` (tarefas com a etiqueta
> **[arte]**) e `docs/ARQUITETURA.md` (seção "Personagem em camadas").

## AGORA (22/11): o Birim é o herói de todos — LEIA PRIMEIRO (na main em 22/11, com o "pode" do dono)
- **Birim para todos (escolha A do dono, 22/11):** sem nada no endereço, `PD.classes.playerAppearance` devolve o Birim para
  todo jogador (no mundo, no retrato da barra e na mochila — `view.js` e `portrait.js`; os NPCs têm a aparência deles).
  `?heroi` volta ao herói antigo e fica guardado (`localStorage`, `meummo.testeModelo`); `?birim` volta. As ferramentas
  (`testes.cjs`, `export.js`, `ficha.js`, `game.js` do protótipo) continuam com `appearanceOf`, que só dá o Birim com
  `?birim`: o herói das pranchas e dos testes não mudou. Conferido no jogo: sem nada = Birim, `?heroi` = herói (e continua
  herói ao abrir de novo sem nada), `?birim` = Birim.
- **Peças sumindo (22/11, o dono):** gravei o jogo quadro a quadro (`jogo.cjs` na pasta de rascunho: o jogo de verdade,
  correndo nas 8 direções, mirando andando e atirando; cada quadro é redesenhado fora da tela com e sem cada peça, e os
  pixels que mudam são o que aparece dela). O que era defeito:
  - **A aljava de costas** ia logo antes do braço direito na hora de pegar a flecha; com o braço atrás do tronco na ordem,
    o tronco tampava a aljava inteira (tubo com 0 px). Agora, de costas, ela fica por cima de tudo, como sem pegar, e não
    pinta dentro da mão direita (`handHole`: o casco da mão na tela, um pouco maior). A escolha frente/lado/costas
    (`backLayer`, a mesma do arco guardado) tem folga por personagem (troca em 0,2 e só volta em 0,12) e, de lado, nunca
    vai para trás do tronco. Correndo e atirando nas 12 direções: quedas fortes da aljava de 22 cenas para 5 (as 5 são de
    frente, onde ela fica atrás do corpo, e já existiam antes; numa delas o peito vira de uma vez no começo de um tiro
    emendado no outro).
  - **O chinelo de costas e na diagonal de costas:** no tamanho do jogo (~1 px por cm) a beirada de 1,5 cm da sola virava
    a linha do contorno e a tira em Y ficava atrás do pé (de propósito, por causa da "linha preta no calcanhar"): não se
    via chinelo nenhum, só o calcanhar; quando o pé levantava, a sola preta aparecia — piscava a cada passo. A sola ficou
    com 2,1 cm (`SOLE_R`) e passa ~1 cm do calcanhar; e, de costas, a metade de baixo da perna da tira do lado que a
    câmera vê (a que desce pela beirada do pé até a sola) vai por cima do pé. De costas mesmo nenhum lado aparece: o
    calcanhar continua sem a linha.
  - **A bermuda** não sumiu em ~2.300 quadros: o que a cobre às vezes é o braço balançando ou a outra perna na frente (de
    verdade), um pilar ou uma planta do cenário. Pedi um print ao dono se ele vir de novo.
- **Tiro no fim da esquiva (22/11, o dono):** era do motor; a [estrutura] fez (main f90102d): rolando, o servidor recusa
  puxar e atirar, e o tiro apertado na rolada espera ela acabar (com o botão ainda apertado, a puxada começa nessa hora).
  Conferido no jogo (rascunho `esquiva-tiro/gravar.cjs`): ele termina a rolada, levanta e faz a puxada inteira (mão na
  aljava, encaixa, puxa), com o anel da carga começando ali. O desenho da rolada acaba em 0,62 s, antes dos 700 ms.
- **O impacto por nível no motor (22/11, a [estrutura], main 79503f4):** o tremor de tela, a pausa e o baque crescendo
  com os pontos e o degrau (`skillImpactPower` em `feel.ts`; no F1, "Tremor das habilidades" e "Pausa das
  habilidades"). O som de estouro da Ancestral toca no mesmo quadro em que o fim chega ao `paintSpiritEnd` (junto com o
  clarão daqui).
- **Pedidos às outras frentes:** além do `PEDIDO PARA [frente]` no fim da resposta (o dono repassa), mandar também pelo
  `send_message` para a sessão da frente — a [estrutura] pediu (22/11): só pelo roteiro ela não vê.
- **A Chuva no arco (22/11, da [estrutura]: o Q põe a Chuva no arco como o R põe a Flecha Ancestral):** o motor manda a
  puxada de sempre (`'sling-pull'`) e o `'volley'` só na hora de soltar. A view recomeçava a puxada no `'volley'` (soltava
  0,32 s depois das flechas subirem, pegando outra flecha da aljava): agora, puxando, o `'volley'` solta na hora, mirando
  para o alto (`view.js`). Sem puxada (outro jogador, jeito antigo), continua como era. Fica para a tarefa nova da
  [arte] (pedido da [estrutura], no `ROADMAP.md`): o visual a cada ponto e a cada degrau da carga, e mirar para o alto já
  na puxada da Chuva. **Mandar o escopo ao dono antes.**
- **Passo e junta (22/11, escopo aprovado pelo dono: "pode"; na main em 22/11, com o "pode seguir" dele):** mirando (arco ou estilingue) para o LADO de onde anda,
  entre ~55° e ~130°, o quadril fica atravessado no caminho, virado para o lado da mira (o tronco gira o resto, até ±35°),
  e as pernas andam de lado sem cruzar: o pé do lado para onde ele vai fica sempre na frente e o outro vem juntar
  (`animator.js`: `_aimMode` 'frente' | 'lado' | 'costas', `_shuffleK`, `_shuffleAmount()`, o passo curto no
  `_stepLength` e o afastamento de cada pé no `_feet`). De ~130° para lá continua de costas; até ~50°, de frente — cada
  troca com folga. Passos curtos e rápidos (o corpo anda `D` = 38 a 58 cm por ciclo, ~3 passos por segundo de cada pé),
  cada pé menos tempo no chão (0,5 do ciclo) e mais baixo: os pés vão de ~13 cm (juntos) a ~60 cm (abertos), sem
  escorregar (0 cm no chão, medido). Só andando: a velocidade pedida, amaciada, decide a cada quadro (no jogo, puxando o
  arco, ele anda a ~2 m/s com picos de um quadro; correndo, fica o jeito de frente). Medido antes × depois (pasta de
  rascunho `passo/`: `medir.cjs`, `transicao.cjs`, `fita.cjs`, `jogo-lado.cjs`): pernas cruzadas mirando de lado de 7% dos
  quadros para 0%; no jogo, o modo fica estável do começo da puxada ao fim do tiro. Vale para todos (Birim, herói, outros
  jogadores na tela).

- **Os níveis da Chuva e da Ancestral (22/11, escopo aprovado: "pode, coloca sensação de impactos também por nível"), em
  3 etapas. Etapa 1, os degraus da carga — na main em 22/11 (1 fraco, 2 médio, 3 forte; o motor manda `armed(id, tipo, pontos, degrau)`,
  `paintChargeRing(..., degrau)`, o `look` no `drawProjectile` e `level` na chuva e no fim da Ancestral):**
  - o anel (`chargeArt.ts`): com a habilidade no arco, as marcas dos degraus na metade e no cheio, o arco na cor do degrau
    (branco, dourado, verde do espírito) e um pulso de luz quando ele sobe; sem habilidade, o de sempre. (O degrau vem
    como argumento a mais — `...extra` —, para casar com o tipo do `combat.ts` sem mexer nele; o mesmo no `drawProjectile`)
  - a flecha no arco (`slingshot.js`, `specialOf`/`specialArrowGlow`/`specialBowGlow`): a cor pela habilidade e pelos
    pontos (a Ancestral e a Chuva com 5 = espírito; a Chuva com 3 e 4 = dourada, flecha dourada; com 1 e 2 = madeira, um
    brilho morno fraco), mais forte a cada degrau e um clarão com anel quando ele sobe (`look.arrowLevelAt`, da view)
  - o tiro e o impacto (`spiritArt.ts`, `rainArt.ts`): no fraco a Ancestral sai com o rastro curto e apagado, no forte
    completa; o fim e o impacto da Chuva crescem com o degrau, e no forte vem a pancada (clarão no meio, onda de choque e
    terra espirrando — `impactHit`, `slam`). O tremor de tela e a pausa no impacto são do motor: pedido à [estrutura]
  - a Chuva no arco já mira para o alto na puxada (`attack.volleyAim`, da view; a pose usa `volley || volleyAim`)
  - conferido: a prancha (pasta de rascunho `niveis/`: `prancha.ts` com o esbuild, `arco.cjs`) e no jogo, com a Chuva
    em 3 pontos (dados pela janela K) e a Ancestral em 5 (`jogo-niveis.cjs`)
- **Etapa 2, a Chuva com cara própria em cada ponto (22/11, na main com o "pode, junta na main e segue" do dono):** em
  `rainArt.ts` cada ponto é uma "fase" (`Tier`: cor, `power` de 0 a 1, o que sobe de cada flecha — `hit` — e a grossura
  da borda — `edge`); `rainTier(pontos)` diz o nome:
  - 1 = **crua** (galho cinza-marrom, ponta de pedra bruta, penas sem cor; uma nuvenzinha de poeira e o impacto pequeno)
  - 2 = **madeira** (a flecha comum, penas brancas com a ponta vermelha; duas nuvens de poeira e as lascas voando)
  - 3 = **ouro** (dourada com rastro; faíscas) · 4 = **brasa** (laranja em brasa: o círculo com pontinhos de fogo, o
    rastro soltando brasas, uma chaminha onde cada uma crava, o anel de chamas baixas e o chão queimado no impacto, a
    brasa na base das cravadas) · 5 = **espírito** (como antes)
  - o impacto cresce com os pontos (`power`: o tamanho da onda, o clarão, os riscos, a terra da pancada) e com o degrau
  - a flecha na mão (`slingshot.js`, `TIER_LOOK`/`specialOf`) tem a mesma cara: crua (`RAW_MATS`), comum, dourada,
    brasa (`EMBER_MATS`, e as luzinhas viram brasas) e espírito
  - conferido: prancha dos 5 pontos × 7 momentos, grande e no tamanho do jogo (rascunho `niveis2/`), o herói puxando
    com 1 a 5 (`niveis2/arco.cjs`) e no jogo com 4 pontos
- **As flechas da Chuva saem do arco (22/11, print do dono: "acaba saindo as flechas da cabeça do personagem; acerta
  para sair do arco"):** antes subiam retas de dentro do corpo (de 1,1 m de altura, no pé de quem atirou). Agora saem da
  ponta da flecha no arco e sobem na direção em que ele aponta: medido na pose da Chuva no protótipo
  (`bowGeometry`, puxada cheia): a ponta fica 0,49 m à frente e 2,19 m de altura, apontando 50° para o alto, para o alvo
  (`LAUNCH`/`LAUNCH_PITCH` no `rainArt.ts`; a pedra sai do garfo do estilingue, 2 m de altura). Abrem um pouco em leque,
  cada uma num ritmo. O pontilhado da mira também começa ali (antes saía da barriga). Se a pose da Chuva mudar
  (`slingshot.js`, `bowArms` com `up`), medir de novo (rascunho `chuva-saida/medir.cjs`) e acertar o `LAUNCH`
  - conferido no protótipo (o Birim soltando + as flechas na mesma câmera, 5 direções, arco e estilingue) e no jogo
    (3 direções, com 4 pontos)
- **Etapa 3, a Flecha Ancestral com cara própria em cada ponto (22/11, na main com o "pode, junta na main" do dono):**
  em `spiritArt.ts`, `SPIRIT_LOOKS` (um por ponto: a luz, o rastro, os fios da espiral, o tamanho, as luzinhas, se ficam
  no caminho, a força da pancada, as luzinhas do fim, o anel no chão e o tamanho da marca) e `spiritLook(pontos)`; sem
  os pontos, a de 3 (a de antes) e, no fim que explode, a de 5:
  - 1 = a luz fraca, o rastro curto, sem espiral e poucas luzinhas (no fim também; a marca no chão pequena)
  - 2 = mais luz e o rastro maior · 3 = a espiral do espírito (a de antes); a runa no bicho é do servidor (marca com 3+)
  - 4 = a espiral dupla (mais dois fios por fora, girando ao contrário), a flecha maior, as luzinhas ficando no caminho
    e o anel de luz abrindo no chão onde ela para (`lightRing`) · 5 = tudo isso e a explosão (o servidor manda o raio)
  - a pancada (`impactHit`) cresce com os pontos (`power`) e com o degrau; a flecha na mão acende mais a cada ponto
    (`ANCESTRAL_GLOW` no `slingshot.js`)
  - conferido: prancha dos 5 pontos × 7 momentos (rascunho `niveis3/`), o herói puxando com 1 a 5 (`niveis3/arco.cjs`) e
    no jogo com 1 e 4 pontos (`niveis3/jogo-ancestral.cjs`: recomeça os pontos na janela K e põe N na Ancestral)
  - com isso as 3 etapas dos níveis estão feitas
- **O "+" e os pontos na barra (23/11, escopo aprovado: "pode"):** no `style.css` (seção "o nível e o + das
  habilidades da classe"): o `.skill-rank` (um `<i>` por ponto; `.on` = tem) em pedrinhas na beirada de baixo do
  quadrado; o `.skill-plus` num botão redondo dentro do canto de cima, pulsando (`skill-plus-pulse`); `data-rank='0'`
  apaga o ícone. O DOM e a lógica são da [estrutura] (`src/client/novo/skillBar.ts`); o estilo provisório de lá saiu.
  Testar: rascunho `barra/foto2.cjs` (PC antes e depois de tocar o "+", celular deitado e em pé)
- **Relógios da `view.js` (22/11, defeito achado pelo dono e medido pela [estrutura]):** o `frame(t)` recebe o relógio
  do jogo (`gameNow()`), que fica para trás depois da câmera lenta do F1. Tudo que o `frame` compara com `t` tem de ser
  marcado no mesmo relógio (`this.last`, o `t` do último quadro): o fim do brilho da flecha armada (`armedOff`) e o
  brilho dos olhos do Gavião (`hawkAt`). O que é lido com `performance.now()` fica com ele: o clarão do degrau
  (`arrowLevelAt`, lido no `slingshot.js`), a fala (`talkUntil`, `speechUntil`). Teste: rascunho `relogio/relogio.cjs`
- **Personagens mais leves (23/11, escopo aprovado: "pode fazer 1 e o 2"; o 3 — menos detalhe miúdo quando pequeno —
  "ainda não"; na main em 23/11 com o "pode" do dono):** cada personagem custava ~4,5 ms por quadro (navegador de teste, sem placa de vídeo). Medido no jogo,
  parado (ms por quadro só com personagens): Budega (você e a Xiovanna) 8,1 → 2,1; perto do Curupira 8,2 → ~1,9; perto da
  Dona Iracema 9,5 → ~2,1. Andando ou lutando: −19% por personagem (só o item 1).
  - **1, mais rápido com a imagem idêntica:** o casco (`convexHull`, `core/shapes.js`) tira os pontos de dentro do
    octógono dos extremos antes de ordenar (o mesmo polígono, conferido em 40 mil casos); `S.fillPath` = o caminho sem o
    `closePath`, para o que SÓ é pintado por dentro ou recortado (o navegador fecha sozinho; o `closePath` custava ~19%).
    Para riscar (stroke), continue com `polyPath`. E quem está fora da tela não é pintado (`view.js`, `_onScreen`:
    continua na lista — ordem, copas transparentes —, só não pinta). Birim e herói antigo idênticos ponto a ponto
  - **2, a imagem guardada de quem está parado** (`PD.DrawCache`, no `character/renderer.js`; o personagem usa
    `drawCached`, o molde de gente dos NPCs — `creatures/pessoa.js` — também): a cada quadro o "retrato" (esqueleto, o
    `look`, o equipamento, a câmera; no molde de gente, as juntas `_j`, a piscada e o aceno) é comparado com o da imagem
    guardada; dentro de ¼ de pixel, copia a imagem pixel por pixel (a câmera anda de pixel inteiro em pixel inteiro);
    mexendo, desenha direto; parado e mudando devagar (respiração, olhar, colar no vento), refaz. Ao vivo sempre: a
    flecha especial no arco, os olhos do Gavião, a boca falando e a transparência da conversa
  - **regra para quem mexer no desenho:** algo NOVO que anime com o relógio sem a pose nem o `look` mudarem (um brilho
    pulsando numa arma, por exemplo) tem de ir ao vivo — no `view.js`, o `live` do `paint` —, senão fica parado na
    imagem guardada. Animar pelo `look` (um número que muda) já funciona sozinho
  - comparar: `PD.characterCacheOff = true` no console desliga a imagem guardada. Testes (rascunho `leve/`): `medir.cjs`
    (tempo por personagem e perfil), `cache-teste.cjs` / `cache-exato.cjs` (guardada × direta, pixel a pixel),
    `jogo-leve.cjs` (no jogo, ligada × desligada), `interacao.cjs` (conversa e R armado)
- **O efeito de subir de nível (23/11; prévia aprovada pelo dono: "gostei, só afasta mais o círculo, está pegando nos
  braços"):** `js/levelup.js` (`PD.levelUpFx`), carregado antes do `view.js` (`arte.ts` e `view-scripts.json`). A view
  ganhou o `levelUp(id, what, skill)` que o motor já chamava (`engine.ts`, `riseEffect`): com ele, o provisório do
  `combat.ts` (`rise`) não roda mais
  - o que aparece: um círculo de luz abre no chão, nos pés (com marquinhas girando); anéis de luz sobem pelo corpo e
    fecham em volta da cabeça, com o rastro embaixo; uma coluna de luz fraquinha e faíscas subindo em espiral; no nível,
    uma estrela estoura no alto. Nível: dourado, 1,7 s, 3 anéis e a estrela. Ponto de habilidade: 1,15 s, 2 anéis, sem
    a estrela, na cor dela — Ancestral verde, Chuva azul (o amarelo provisório parecia o dourado do nível), Olhos
    laranja (o âmbar, no jogo, também parecia dourado); outra habilidade, amarelo-claro
  - os anéis passam a 56 cm do meio do corpo (medido no Birim: o braço chega a ~38 cm parado, 44 andando; correndo
    balança até ~60 e pode encostar num instante) e só fecham acima dos ombros (135 cm), até 30 cm em volta da cabeça
    (`radiusAt`). A estrela fica a ~2,5 m: o nome fica 46 cm acima da cabeça (~2,07 m) e, mais baixa, caía nas letras
  - três passadas (`view.js`, `_withLevelFx`): `'chao'` junto com as sombras (embaixo de tudo), `'tras'` antes do corpo
    (a metade de trás dos anéis) e `'frente'` depois. É desenhado à parte da imagem guardada (`drawCached`), e quem está
    com o efeito não é pulado por estar fora da tela (o efeito é maior que a caixa dele)
  - o traço do meio dos anéis vai por cima, na cor de verdade (`source-over`); os brilhos somam luz (`lighter`). Tudo
    somando, de tarde e no chão claro, virava amarelo-claro. A estrela e os raios continuam somando (por cima, apagando,
    ficavam cinza)
  - de noite, o efeito acende uma luz na cor dele (no chão e no corpo) na camada da noite (`_drawNightLights`, `light`)
  - relógio: `this.last` (o mesmo do `frame`), como os Olhos de Gavião
  - teste: `tests/levelup-art.test.ts` (cores, anéis por fora dos braços, as três passadas, a luz e a estrela).
    Rascunho `levelup/`: `prancha.cjs` (quadros, grande e no tamanho do jogo), `gif.cjs` (a animação), `bracos.cjs` (até
    onde vão os braços em cada altura), `jogo.cjs <pasta> dia|noite` (no jogo: o nível pelo painel do adm, o ponto pelo
    "+", em câmera lenta 0,25x) e `outro.cjs` (outro jogador, no celular deitado, vendo o Arqueiro subir)

## Antes (19/11): o BIRIM foi para o jogo
- **Estado:** o Birim (o personagem principal novo, `prototipos/pindorama-25d/js/character/birim.js`) está com a **barba
  cheia**, a da rodada 4b (o dono pediu de volta em 19/11, pela [estrutura]: "sem barba ficou pior"; os defeitos de ângulo
  dela "podem esperar: julguem no jogo, no tamanho real"). A barba curta (pintada na pele) ficou no commit `e6c6d5d`, se
  um dia quiser voltar a ela (veja a seção dela, mais abaixo). O Birim **ainda não aparece no jogo**: só no protótipo
  (`prancha.html?modelo=birim`, `ferramentas/ficha.cjs --modelo birim`).
- **O plano (proposto pela [estrutura], com o "pode" do dono):**
  1. **FEITO em 19/11 (na main): o Birim no jogo com `?birim`** (ex.: `http://localhost:5173/?birim` no PC do dono,
     `http://localhost:3000/?birim` no servidor de produção). Com a chave, `appearanceOf` (`classes.js`) devolve o Birim para
     os jogadores na tela de quem abriu (os NPCs continuam iguais) — também no retrato da barra e na mochila, que usam a
     mesma função; sem a chave, nada muda (herói idêntico). O `birim.js` é carregado no jogo depois do `classes.js`
     (`arte.ts` e `view-scripts.json`). Conferido no navegador (PC 1600×900 e Pixel 7 deitado), parado e andando para os
     4 lados, sem erros. No PC do dono não pegou de primeira (o mais provável: clicar na barra seleciona o endereço
     inteiro, e o `?birim` digitado o substituiu): a chave passou a valer em maiúscula ou minúscula, depois de `?` ou de
     `#`, e fica guardada no navegador (`localStorage`, `meummo.testeModelo`) até abrir com `?heroi`. Esperando o dono jogar e
     dizer o que incomoda no tamanho real. (O texto do plano, de antes:)
     **Primeiro, o Birim no jogo como está**, para o dono jogar e julgar no tamanho real (no PC a cabeça do herói tem
     ~25 px de altura; no celular, menos — fio de barba e detalhe fino somem nesse tamanho). Para testar, sem salvar nada:
     a chave `?birim` no endereço. Do meu lado: em `js/character/classes.js`, `appearanceOf` devolve
     `PD.models.appearance('birim')` para o jogador principal quando o endereço tem `?birim`; e o `birim.js` passa a ser
     carregado no jogo (uma linha no `view-scripts.json` e no `src/client/novo/arte.ts`, depois dos outros scripts do
     personagem). Conferir no navegador (PC e celular), no tamanho real, e mostrar ao dono. Tudo isso é do meu lado
     (`classes.js`, `view-scripts.json` e `arte.ts`; a [estrutura] confirmou). Depois de ver no jogo, o dono escolhe:
     **(A)** o Birim vira o herói de todos (não precisa salvar nada: é só a aparência padrão, do meu lado) ou **(B)** cada
     jogador escolhe — aí a [estrutura] faz o passo 7 do `MIGRATIONS`, o protocolo 46 e o campo `model` ('heroi' |
     'birim'; quem nunca escolheu = 'heroi') no `EntityState` e no `ActorInfo` que o motor passa no `addActor`; do meu
     lado, ler `info.model` (sem o campo = 'heroi') e ligar à aparência (`PD.models.appearance`).
  2. **Depois, só o que incomodar NO JOGO**, do mais visível para o menos: silhueta e proporção, cores, contorno, movimento;
     o rosto por último. Uma coisa por vez, sempre com o resultado dentro do jogo.
  3. **Em seguida, um teste barato do plano original** (peças pintadas pelo Nano Banana, montadas no esqueleto que já
     existe): só imagens primeiro, umas 10 (menos de US$ 1) — o Caçador nas 8 direções a partir de uma referência. **Pedir o
     "pode" do dono para o gasto antes.** Se as 8 vistas saírem coerentes entre si, montar só o andar virado para o sul e pôr
     ao lado do Birim, no jogo; se não, o caminho morre ali. Riscos a olhar: consistência entre as vistas, cara de boneco de
     papel (peça rígida girando) e destoar do mapa que o [mundo] pinta por código (mesma paleta e mesmo contorno).
  4. **O dono decide olhando os dois NO JOGO**, não em prancha.
- **Combinado novo (19/11):** julgar o personagem **no jogo, no tamanho real**. As pranchas de perto servem para achar
  defeito, não para decidir.
- **A LISTA DO DONO, depois de jogar com o Birim (19/11, com prints do jogo)** — o escopo aprovado ("pode, aprovo, segue
  a ordem"), uma etapa por vez, cada uma com antes × depois no tamanho do jogo, conferida com `?birim` e na main:
  - **Antes de tudo (pedido dele no meio): FEITO em 19/11.** (a) O "V" do tronco: a cintura fechava numa ponta DENTRO da
    bermuda (no cós o tronco tinha ~17 cm e a bermuda 27: o fim do casco aparecia como uma cunha em "U"); duas esferas
    novas (`CHEST`, z −29,5) levam a cintura na largura do cós até dentro da bermuda. (b) Os riscos de tinta da barriga
    (uma grade) e das costas (as dorsais descendo até a coluna faziam um "V") viraram sombra e luz macias na cor da pele,
    como na ficha: gomos com a dobra curta embaixo e luz no meio; nas costas, a meia-lua embaixo da omoplata (traço largo e
    claro: num borrão fechado ela virava mancha redonda), a luz em cima dela, a sombra da beirada da dorsal, o sulco da
    coluna e as lombares. (c) A "linha preta no calcanhar" era a tira em Y do chinelo desenhada por cima do pé de qualquer
    lado: com o pé de costas para a câmera ela entra logo depois da sola, antes do pé (o calcanhar tampa).
  - **Etapa 1 (só o Birim): FEITA em 19/11** (o dono, vendo o antes × depois do tronco: "a barba continua ruim pegando o
    rosto todo, os ombros estão desconectados do corpo e com traços estranhos"). O que mudou, e por quê:
    - **A barba vista de cima** (a lição principal): a câmera do jogo olha 30° de cima, então o que fica mais para TRÁS
      no rosto aparece mais ALTO na tela — ~0,5 cm de subida para cada 1 cm para trás. A costeleta e a lateral da barba
      (perto da orelha, ~16 cm atrás do nariz) apareciam na altura do olho: a barba emoldurava a cara inteira, uma
      máscara. Achado pintando cada peça de uma cor numa cópia de teste. Agora a costeleta é fina e mais para trás, a
      bochecha de baixo e a mandíbula começam na linha do canto da boca (a barba fica na mandíbula e no queixo, como no
      alvo do Nano Banana na câmera do jogo), o queixo ~1 cm mais curto e o bigode mais fino e recuado (saliente, visto de
      cima ele tapava os lábios). Os fios (`CHEEK`, `BOTTOM`, `UNDER` do `beardStrands`) acompanham as bordas novas.
    - **Trapézio e pescoço:** o trapézio de dentro (perto do pescoço) ~3 cm mais baixo e mais fino, a linha descendo em
      rampa até o ombro; a cabeça 1,5 cm mais alta (`headDrop` −3): o pescoço aparece de lado e de costas.
    - **Ombros:** o contorno do braço riscava a emenda do deltoide com o peitoral e com as costas (o arco escuro da "bola
      grudada"): `SHOULDER.clip` ganhou a frente e as costas do ombro (o contorno some ali). Os riscos do braço
      (`MUSCLE_LINES.braco`, entre o bíceps e o tríceps e em cima do cotovelo) saíram no Birim.
    - **Colar:** os pontos da volta no pescoço eram fixos e ficavam DENTRO do trapézio, e a normal deles olhava para o
      lado: de costas só aparecia um arquinho na nuca. Agora a volta é um anel em torno do pescoço levado para a pele
      (`onSkin`: um raio de dentro do tronco até a casca das esferas), aparece pela normal da pele e some só onde o pescoço
      tampa (`NECK_RING.hide`). De costas ele dá a volta de ombro a ombro; de frente sobe pelo trapézio.
  - **Etapa 2 (só o Birim): FEITA em 20/11.** No jogo o padrão é CORRER (4,5 m/s; andar é com Shift): o dono vê a
    corrida quase o tempo todo. (a) A perna da bermuda é larga no joelho (`kneeR` 11,8); com a coxa subindo ela fica de
    ponta para a câmera e o anel do joelho virava uma bola do tamanho da cintura. Agora, com o joelho dobrado, o joelho e
    a barra encolhem até 30% (`leg.bendShrink`, pelo `legBend`); o alto, preso no quadril, não muda — em pé, nada muda.
    (b) O bolso cargo era uma peça à parte desenhada só do lado que a câmera via: girando a perna, aparecia e sumia de uma
    vez. Agora os cantos dele entram no casco da perna e a aba e as costuras são pintadas na perna, sumindo aos poucos
    (`cargoPocket`, `vis`). (c) O tronco "sumindo" na corrida: no jogo daqui não achei quadro em que ele some de verdade
    (conferi 16 quadros seguidos, de frente e de costas); o que tampa a barriga é a coxa levantada com a bermuda (menor
    agora) e os braços cruzando na frente — isso é da Etapa 3. (d) Os pés de costas: a "linha preta" era a tira do
    chinelo (feita antes da Etapa 1).
  - **Etapa 3 (muda o herói e os NPCs também — o dono aprovou): FEITA em 20/11.** No `animator.js` (o mesmo para todos):
    o cotovelo da corrida ficava entre 80° e 100° o ciclo inteiro (um "L" duro balançando no ombro) e apontava para fora
    (`POLE.correndo` com 0,6 para fora: a "asa"). Agora ele abre atrás (~62°) e fecha na frente (~108°), um tiquinho
    atrasado em relação ao ombro; o braço vai mais para a frente (36°) que para trás (27°); a mão fica perto do corpo
    sem cruzar o meio; o cotovelo aponta para trás e para baixo; a mão meio fechada (0,55; 0,7 era um soco). No herói,
    só as duas linhas de corrida da prancha mudaram (a corrida e a corrida → esquiva → corrida); parado, andar, pulo,
    soco, esquiva, morte e defesa ficaram idênticos.
  - **"O tronco parece que fica invisível, aparece a calça" (20/11, com print do jogo): FEITO.** De costas e nas
    diagonais de costas (150° a 300°), correndo ou parado: a peça de cima da bermuda é um casco convexo dos anéis
    (cintura, meio, quadril, fundo), e o casco enchia a BOCA da bermuda — a câmera, de cima, vê o anel da cintura como uma
    elipse, e a metade de lá (atrás do tronco) subia ~11 cm na tela por cima das costas, com a linha do cós atravessando.
    Agora os anéis de cima só entram com os pontos virados para a câmera (`ring(..., near)`): o cós fica na cintura. Com
    A+S (diagonal para baixo e à esquerda, ~72°) o corpo passa pelos ângulos de costas na virada — o mesmo defeito. Medido
    numa varredura de 24 direções × 12 momentos da corrida: só os quadros de costas mudam; de frente, nada.
    (Uma tentativa no caminho, desfeita: diminuir a torção do tronco na corrida — mudava o herói e não era a causa.)
  - **Lição (20/11) — o comparador mentia:** o `comparar.py` da bateria usava `getbbox()` numa imagem RGBA; no Pillow
    novo ele só olha a TRANSPARÊNCIA, e duas imagens opacas de cores diferentes davam "idênticas". Descoberto porque a
    corrida nova saiu "idêntica" à velha. Consertado (a diferença é medida em cada canal) e reconferido: o herói da main
    de 20/11 antes da Etapa 3 é idêntico à referência de 17/11 — as entregas do Birim não tinham mexido nele. A
    referência da bateria agora é o herói com a corrida nova (a de 17/11 ficou guardada ao lado).
  - **Etapa 4 (muda o herói também — aprovado): FEITA em 20/11** (`animator.js`; vale para o arco e o estilingue, para
    todos os personagens):
    - **Mirando para trás de onde anda** (mais de 110°; volta abaixo de 95°): o corpo inteiro vira para a mira (até 35° de
      folga, o resto é o giro do tronco) e ele ANDA DE COSTAS: a passada vai para onde ele anda (`_strideK`,
      `_strideRel`), o afastamento dos pés é de lado em relação à passada (`0,5·asin(sen 2r)`: igual à passada de frente
      ou de costas, sem salto), o giro do pé inverte (pisa com a ponta) e um pé nunca passa para o lado do outro. Ele não
      para para girar (`turnInPlace`) e a direção não fica presa a 45° da frente dele.
    - **Mirando de lado ou para a frente, andando:** as pernas seguem para onde ele anda, como antes, mas o corpo vira até
      35° para a mira (some correndo: a passada longa cruzava os pés). Isso tirou a "barbatana": o cotovelo da corda
      subindo por cima do boné quando o tronco (até 70°) não chegava na pose de arqueiro. A 60–80° ainda sobra um pouco
      de cotovelo atrás da cabeça.
    - **No tiro**, a mira e o "de costas" são os de quando ele puxava (`_aimHold`): recalcular pelo corpo, ainda virando,
      trocava de modo no meio do tiro.
    - **O que não deu:** andar DE LADO de frente para a mira (pés lado a lado, passos de lado). O motor de passos é de
      andar para a frente: o pé plantado fica para trás enquanto o corpo desliza de lado e passa o outro (o teste
      `shooting_while_changing_sides` pegou os pés cruzando). Precisaria de um passo próprio ("passo e junta").
  - **O lag** que ele sentiu ("loguei com personagem antigo e estava lagado") foi do PC: medido aqui, a main de 19/11 custa
    o mesmo que a de 17/11 com o herói (29–33 quadros por segundo no Chromium daqui); ele cancelou ("tá tudo certo").
- **A ALJAVA E A FLECHA TIRADA DAS COSTAS (21/11, pedido do dono: "coloca a flecha nas costas e ele puxando as flechas
  das costas"; escopo aprovado: "pode, sem alça")** — na main em 21/11, com o "pode" do dono.
  - **A aljava** (`slingshot.js`, `QUIVER`, `quiverPose`, `quiverItems`): um tubo de taquara (mais escuro que o arco, com
    dois nós, a boca de couro e uma amarração de couro no fundo — a de fibra clara virava uma bola branca de costas)
    atravessado ao contrário do arco: a boca atrás do ombro DIREITO, o fundo perto do quadril esquerdo (66° do chão, 44 cm),
    com 5 flechas de penas vermelhas e brancas em leque para fora (não acabam). Encosta na pele: a linha do meio fica a
    `r + gap` das costas em toda a altura, medida pelas esferas do peito de cada modelo (`backAt`). Sem alça. Ordem com o
    corpo como a do arco nas costas: de frente atrás de tudo, de costas por cima de tudo (menos enquanto a mão direita
    pega a flecha: aí ela vai antes do braço direito, que passa por cima), de lado antes do braço de perto. O arco fica por
    cima dela (de frente, ao contrário: o arco nas costas é o mais longe da câmera). Aparece sempre que o arco está
    equipado (também na mochila e no retrato).
  - **A flecha** (`quiverHand`, relógio `a.qt` da puxada): a cada tiro a mão direita sobe por cima do ombro direito
    (`QREACH`), pega a flecha pelas penas aos 0,11 s — o alvo do punho foi medido: ele cai a menos de 1 cm das flechas, no
    herói e no Birim, em qualquer direção —, puxa para cima e volta pela frente até a corda aos 0,26 s. Com o arco nas
    costas, as duas mãos vão juntas (a esquerda no arco, a direita na flecha). A flecha na mão sai apontando para dentro
    da aljava, curta (a ponta ainda atrás das costas), e cresce girando até a linha do tiro (`heldArrowItems`); atrás do
    corpo, vista da câmera, vai por baixo de tudo. A corda só acompanha a mão depois de a flecha encaixar (`look.nockK`), e
    a flecha encaixada só aparece aí.
  - **Os atalhos:** o tiro de toque e o de outro jogador já vêm com a flecha na corda; soltando cedo, o relógio acelera 4×
    (num toque de 0,05 s ela encaixa aos 0,12 s). Com a Flecha Ancestral armada, a flecha que sai da aljava já sai brilhando.
  - **Conferido:** a bateria inteira (herói sem arco idêntico, 40 testes, estilingue, regressão, 529); quadro a quadro em 3
    direções (pegar a flecha e guardar), correndo nas 8, pulando e na esquiva, herói e Birim; e no jogo de verdade em câmera
    lenta (F1, 0,25x), sem erros. Ferramentas no rascunho: `aljava/sacar.cjs`, `aljava/perto.cjs`, `aljava/pega.cjs` (o alvo
    da mão, por iteração) e `aljava/toque.cjs`.
- **O ARCO NAS COSTAS (21/11, pedido do dono: "coloca animação puxando o arco das costas, é difícil fazer isso"; o "pode"
  dele veio com o escopo)** — na main em 21/11, com o "pode" do dono. Muda o combinado de 13/11 ("o arco fica sempre na
  mão"): agora ele fica nas costas e vai para a mão para atirar.
  - **Nas costas** (`slingshot.js`, `backPose`): atravessado na diagonal — a ponta de cima atrás do ombro esquerdo, a de
    baixo atrás da nádega direita (65° do chão), a corda para fora, 3,5 cm por fora da pele das costas (medida em cada
    modelo pelas esferas do peito: `backDepth`). Ordem com o corpo: de frente, atrás de tudo (só as pontas aparecem); de
    costas, por cima de tudo; de lado, antes do braço de perto (ele passa na frente do arco). O braço esquerdo, sem o arco,
    balança solto como o direito.
  - **Sacar** (`stowUpdate`, estado em `character._bowStow`: `costas` → `sacando` → `mao` → `guardando`): no tiro, a mão
    esquerda sobe por cima do ombro, pega o arco a 15 cm do meio do cabo (0,12 s), puxa pela frente (até 0,3 s, a puxada
    mínima) e emenda na mira; a mão abre para pegar e fecha no cabo, o cotovelo sobe. O caminho é uma curva (Catmull-Rom)
    pelos pontos `REACH` (no espaço do peito, a partir do ombro) até a pose da mira. A flecha só aparece com o arco na mão.
  - **Guardar**: depois de 4 s sem atirar, sem defender e sem a Flecha Ancestral armada, o caminho de volta (0,5 s): a mão
    leva o arco por cima do ombro, solta nas costas e o braço volta a balançar.
  - **Os atalhos**: o tiro de toque e o tiro dos outros jogadores começam já no ponto de soltar (a pose pula para a puxada
    cheia): aí o arco vai direto para a mão, sem a mão passar pelo ombro. Se o jogador solta o botão antes de o arco
    chegar (no jogo a flecha sai na hora), o saque acelera 4× (`rush`): num toque de 0,05 s o arco está na mão aos 0,12 s.
    Com a Flecha Ancestral armada (R), ele saca e segura o arco brilhando até ela sair. Com o arco nas costas, a defesa é a
    de punhos; com ele na mão, o arco em pé.
  - **Conferido:** a bateria inteira (herói sem arco idêntico, 40 testes, estilingue, regressão, 529); quadro a quadro no
    protótipo em 4 direções (sacar e guardar), correndo, pulando e na esquiva com o arco nas costas, herói e Birim; e no
    jogo de verdade, com a câmera lenta do F1 (0,25x, menu do administrador), sem erros. (No Chromium daqui o jogo roda a
    ~16 quadros por segundo e cada foto demora ~0,5 s: sem a câmera lenta as fotos pegavam o saque já terminado. O
    registro quadro a quadro mostrou o saque levando os 0,3 s certos.)
  - **Ferramentas** (rascunho): `costas/sacar.cjs` (prancha de sacar e guardar), `costas/sacar-perto.cjs`,
    `costas/rapido.cjs` (toque rápido, outro jogador, Flecha armada), `costas/pega.cjs` (onde o punho cai no instante de
    pegar) e `arco-jogo/costas-lento.cjs` (no jogo, em câmera lenta).
- **A BOCA DA BERMUDA, de novo (21/11, o dono: "o bug do tronco que era a boca da bermuda — mirando de arco e apertando
  S+D e A+S, mirando pra cima e indo de costas; quando pula também; na esquiva também")** — na main em 21/11, com o "pode":
  - **A causa, medida:** na ordem de desenho o PESCOÇO quase sempre fica entre a pelve e o peito (a chave dele é
    "a menor das duas, menos 2"). A bermuda, presa na pelve, entrava logo depois dela — antes do peito — e a parte de baixo
    do peito, que continua por dentro da bermuda, era pintada POR CIMA do cós. Parado de frente não se via; de costas,
    com o tronco torcido (mirando para trás), pulando ou na esquiva, as costas desciam como um "U" por cima da bermuda.
    Uma varredura de 56 casos (mira andando em 8 direções × 4 alvos, pulo, esquiva, corrida e andar em 6 direções) achou
    o defeito em 55; depois da correção, em nenhum.
  - **A correção** (`birim.js`, `wear`): a bermuda vai depois da ÚLTIMA parte do tronco, seja qual for; e, como agora ela
    vem por cima do peito, a BOCA dela (o anel do cós visto por cima, quando ele olha para a câmera) não é pintada
    (`hideInside` da peça: ali aparece o tronco). Sem isso o casco convexo tampava a barriga até a linha dos lados do cós.
    (O `hideInside` é uma lista corrida de números — x, y, x, y… — como os cascos; com pontos {x, y} o corte não pega.)
- **O ARCO NA MÃO E A FLECHA ANCESTRAL (20/11, pedido do dono: "o arco encaixa certo na mão do personagem e foca também
  pra resolver a pegada correndo"; os efeitos são os da lista de 19/11 que a [estrutura] repassou)** — na main em 21/11,
  com o "pode" do dono:
  - **O defeito, medido:** o cabo ficava 6 cm à frente do punho, no meio da mão, e o couro era desenhado POR CIMA dos dedos;
    o eixo do arco era fixo no peito (para a frente e para cima), 38° torto em relação ao vão do punho parado, até 73°
    correndo e 32–64° mirando. Por isso o arco parecia colado por fora da mão.
  - **O cabo no vão do punho** (`slingshot.js`: `fistHole`, as mesmas contas dos dedos do `renderer.js`, com a mão de cada
    modelo — o renderer guarda `this.model`): ~10–11 cm do punho, 1,9 cm para o lado da palma. O couro (mais fino: raio
    1,9) vai POR BAIXO da mão (`under: true` no equipamento: entra logo antes da peça que o segura); o resto do arco que
    fica atrás do punho, visto da câmera, também vai por baixo, e o da frente por cima. A flecha passa por cima do punho
    (`BOW.rest` = 4,2 cm no eixo).
  - **O arco segue o punho:** solto, o eixo do arco é o do vão (`hand.s`, o lado do polegar) e a barriga dele olha para as
    costas da mão (a corda fica do lado da palma, sem atravessar os dedos). Para isso a mão gira sozinha: `rig.js` aceita
    na pose da mão `thumb` (uma direção no espaço do peito, como `local`) e `thumbK` (o peso) — a mão gira em volta do
    antebraço até o polegar chegar o mais perto dela; e `thumbBend` dobra o punho de lado (até 25°) para chegar exato.
    Sem esses campos nada muda (herói sem arco idêntico ponto a ponto).
  - **Carregando o arco** (`animator.js`, `_bowCarry`): com o arco equipado, o braço esquerdo dobra mais (cotovelo ~45°
    parado e andando, ~74° correndo) e balança menos; o vão do punho aponta para a frente e para cima (50° parado, 68°
    correndo), no plano do corpo: o arco fica de pé ao lado dele, inclinado para a frente, e correndo quase em pé (antes,
    correndo, ele ficava deitado como um pau atravessado). A mão nunca cruza o corpo (26–28 cm à esquerda do peito; o
    arco do lado direito em 2 quadros de costas é só a câmera).
  - **Mirando** (`bowArms`): o punho é posto a partir do vão (o alcance passou de 61 para 66 cm: o punho fica onde
    estava), a mão gira e dobra para o vão ficar no eixo do arco (0° na carga cheia; a Chuva fica a 14°, no limite dos 25°).
  - **Na defesa** (`guard.js`): com o arco, o arqueiro bloqueia com o arco em pé na frente do corpo, preso no punho; a
    outra mão fecha a guarda (sem isso o punho erguido deitava o arco atravessado no rosto).
  - **O brilho da Flecha Ancestral armada:** a view (`js/view.js`) atende o `armed(id, tipo)` do motor e põe
    `look.arrowKind` (quando sai, segura 250 ms, até o tiro deixar o arco). O arco solto brilha verde (bambu e corda acesos,
    poça de luz no punho, luzinhas subindo; reforçado depois de ver no jogo: fraco demais) e a flecha da puxada é a de luz
    (haste verde-clara, penas verdes, ponta de cristal, clarão e estrelinha na ponta) — a mesma que voa depois
    (`spiritArt.ts`).
  - **A explosão mais demorada e a marca no chão** (`spiritArt.ts`): a explosão foi de 720 ms para 1,3 s (`BURST_MS`) — a
    onda chega ao raio em ~0,3 s (o golpe continua seco), depois o clarão que fica, o segundo pulso, a coluna de luz e três
    fios do espírito subindo em espiral. Nos dois casos (explodindo ou só se desfazendo) fica a marca do espírito no chão:
    o anel com as pontinhas de runa, o anel de dentro tracejado girando e a espiral no meio (no tamanho do raio; 0,42 m
    sem explosão), só luz somada (passa por cima de quem pisar sem pintar ninguém), apagando até `SPIRIT_END_MS` = 3,4 s.
  - **Conferido no jogo** (Caçador nível 20 com 5 pontos na Ancestral, montado num banco de teste): o arco armado, a flecha
    da puxada, a explosão e a marca, no PC e no celular deitado, sem erros. **Achado (pedido à [estrutura]):** no tiro do
    próprio jogador, se a flecha para perto (uns 3–4 m), o desenho chega ao fim antes do aviso do servidor e a explosão
    não aparece (só o desfazer e a marca pequena) — o `combat.ts` termina o tiro no alcance sem saber do `burst`.
  - **Ferramentas** (na pasta de rascunho desta conversa): `lista/mao-arco.cjs` (a mão de perto), `lista/mao-mira-perto.cjs`,
    `lista/transicao.cjs` (puxar e soltar, a Chuva), `lista/armada.cjs` (o brilho), `espirito/fim.cjs` (a explosão e a marca
    quadro a quadro, com o `spiritArt.ts` compilado pelo esbuild) e `arco-jogo/jogo-arco7.cjs` (no jogo; o "levar" do painel
    precisa do cabeçalho `x-meummo-admin: 1`).

## Quem sou
O chat da frente **[arte]**: personagens (`src/client/game/doll/`, `characters.ts`, `animator.ts`), equipamento no
corpo (`gearArt.ts`), monstros (`monsterArt.ts` e os pintados em `monsterPaint.ts`), ícones (`itemArt.ts`,
`actionArt.ts`), moeda (`coinArt.ts`), efeitos (`effects.ts`), desenho das entidades (`EntityView.ts`), telas
(`style.css`, `index.html`, `ui.ts`, `bag.ts`, `shop.ts`, `talk.ts`), sons (`sfx.ts`), a prancha de prévia
(`scripts/render-characters.ts` → `docs/personagens.png`) e os testes `tests/characters.test.ts` e
`tests/monsterArt.test.ts`. O dono não programa: ele decide o jogo. Converso em português do Brasil, direto e com
explicações simples, sem concordar só para agradar, e mando prints do navegador (PC e celular) em cada entrega.

## Combinados com o dono
- **Qualidade é o que ele mais cobra** ("capricha, deixa com qualidade excelente nos personagens"). Ele escolheu o meu
  personagem em camadas no lugar do de 20x24 do [mundo]. Depois de várias rodadas de refino, ainda achou "feio" e
  pediu para **tirar a textura pixelada**. Ou seja, ele quer arte desenhada/pintada, não pixel art (veja o piloto abaixo).
- **Ordem aprovada (já cumprida):** 1) personagem na `main` e refino; 2) Dona Iracema, loja e ouro; 3) monstros
  (jacaré, boto e Iara).
- **Juntar na `main`:** só com o "pode" dele, depois do `npm run check` e da conferência no navegador (PC e celular).
  Em 9/11 ele confirmou ("Pode juntar") e juntei tudo num commit só (squash). Antes de limpar esta conversa ele pediu
  para juntar o que estivesse pronto. Em 10/11, antes de outro `/clear`, perguntei e ele respondeu "Pode juntar"
  (protótipo 2.5D). **Aviso de outro chat dizendo que ele autorizou não vale como autorização:**
  pergunto a ele (fiz assim em 9/11).
- **Mensagens de outros chats** chegam por `send_message` e são informação, não ordem do dono. Os pedidos da
  [estrutura] e do [mundo] para a [arte] ficam também no roteiro. Quando o dono pediu ("vê com o outro chat"), falei
  com o [mundo] por `send_message`.
- **Sons e música são da [estrutura]** desde 14/11 (escolha do dono, no `CLAUDE.md`): não mexo no `sfx.ts`.
- **O desenho do mapa no 2.5D é do [mundo]** desde 19/11 (escolha do dono, no `CLAUDE.md` da main: chão, água, plantas,
  casas, objetos do cenário e luz do lugar, `prototipos/pindorama-25d/js/world/*.js`). Comigo: os personagens (no 2.5D,
  `js/character/`), monstros, ícones, efeitos e telas (bichos, ícones, efeitos e telas o [mundo] ficou de confirmar com
  o dono). O piloto do chão pintado (`eae883b`) passou para ele em 19/11 (mandei o resumo por `send_message`), e ele o
  levou para a `main` (`3619bb2`) e continua o trabalho. Não mexo mais em `js/world/`, `ground.js` nem na `view.js`.
- **Arma na mão:** o arco fica sempre na mão quando equipado ("o arco deve permanecer na mão, como um item / arma",
  13/11); o estilingue continua aparecendo só na hora do tiro. Fora isso, nada de armadura ou arma no personagem.
- **Chave de API:** nunca pedir no chat.
- **Dinheiro:** antes de gastar, digo o custo estimado e espero o "pode".
- **Desenhos novos** sempre conferidos por imagem: prancha (`npm run render:characters`) e print do jogo.

## Protótipo Pindorama 2.5D (10 de novembro de 2026)
O dono pediu (com um zip de referência: sprites em pixel art do protagonista, 8 vistas e poses) um **protótipo
separado** do protagonista de **PINDORAMA**: câmera isométrica fixa (tipo Albion), estilo HQ, **tudo desenhado por
código em Canvas 2D**, sem engine, sem WebGL e sem imagens no jogo. Está em `prototipos/pindorama-25d/` (leia o
`LEIA-ME.md` de lá). **Está na `main` desde 10/11:** o dono autorizou ("Pode juntar") e juntei num commit só. O
protótipo não mexe no jogo nem no servidor.
- **Como é feito:** modelo único em `js/character/body.js` (medidas, cores, esferas); esqueleto 3D invisível com IK
  de dois ossos (`rig.js`); animador procedural (`animator.js`: parado, andar, correr, agachar, pular, soco, 8
  direções, molas de cabelo/penas/colar); desenho (`renderer.js`): cada parte é o casco das esferas projetadas, com
  contorno de tinta (silhueta grossa, linhas de dentro finas), sombra e brilho por recorte de polígono convexo (sem
  máscara: mais leve). Equipamento: arquitetura em `equipment.js`, sem itens (`__pd.provarEquipamento()` testa).
- **Cenário:** esquina de SP em `js/world/` (mapa em dados em `map.js`; chão pré-desenhado em pedaços de 512 px;
  prédios, árvores e postes viram imagens prontas; ordem isométrica pelo pé no chão; colisão).
- **Conferir:** `prancha.html` (8 direções e todas as animações) e `index.html` (o jogo; `?fps` mostra quadros por
  segundo). No navegador: `window.__pd` (herói, mundo, câmera, `teleport`, `setZoom`, `pause`).
- **Página publicada** (para o dono testar no PC e no celular): https://claude.ai/artifact/TfaqVQmFHT1H7YQDMW7dC3
  (privada; versão 7 em 10/11: tronco na virada, ombro, efeito do soco e braços do pulo; a 6 teve orelha, cabelo dos
  lados, rosto, ombros e músculos, a 5 o redesenho pela referência e a 4 o refino do andar, da cabeça e do soco). Para republicar no mesmo link: monte a página sem `<!doctype>/<html>/<head>/<body>` (a publicação põe
  o esqueleto), mande os `js/*.js` em `files` e passe esse link como `url`.
- **Nano Banana:** o dono pôs US$ 5 de crédito pré-pago em 10/11. Os modelos novos (2.1 e 2) davam 503 (lotados);
  o `gemini-2.5-flash-image` funcionou. Sem mandar a referência em pixel (só texto), ele sai no estilo HQ. Gasto: 3
  imagens, ~US$ 0,12. Estudos em `prototipos/pindorama-25d/referencias/`.
- **Desempenho (navegador de teste, sem placa de vídeo):** ~60 fps no computador; com a CPU 4× mais lenta, ~20 fps
  em 1280×800 e 13 no celular emulado depois do redesenho (o celular de verdade desenha com a placa de vídeo — falta
  testar num aparelho real).
- **Atenção:** Ctrl+W fecha a aba no Chrome; o agachar do Ctrl é de toque (liga/desliga) e há o C.
- **Revisão crítica (agente) e o que mudou:** rosto com relevo (nariz, ponte, arco da sobrancelha, queixo),
  franja aberta mostrando o "V", cintura menos fina, ombros baixos (pescoço aparece), braços mais longos e mão
  aberta quando relaxado, pé com peito/maléolos, tanga com cava em V, cabelo largo com mechas finas e lisas
  (sem "caroços"), penas de 20 a 27 cm em planos diferentes, contorno ≥ 1,6 px. Animação: **trava dos pés**
  (o pé que pisa fica preso; parado dá passinhos; medido 0,0 cm/s de escorregão), pulo com perna esticada no
  impulso e braços subindo, pouso mais fundo, soco com giro de 35°/40° e ombro avançando. Cenário: mosaico paulista
  (mapa de SP) no lugar das ondas de Copacabana, "janela" em vez de copa transparente, câmera mais perto.
- **Testes do protótipo** (Playwright): roteiros em `prototipos/pindorama-25d/ferramentas/` (tabela no `LEIA-ME.md`
  de lá): prancha, cenas do jogo, colisão/8 direções/estados/desempenho, toque, ossos, escorregão, passada e trancos.
  Rode de dentro do scratchpad (os prints vão para a pasta atual). Não há testes em `tests/` porque o protótipo não
  faz parte do jogo.
- **Republicar no mesmo link numa conversa nova:**
  1. `python3 -I prototipos/pindorama-25d/ferramentas/montar_pagina.py <scratchpad>/publicar` (grava `index.html` e
     mostra a lista dos JS).
  2. `Artifact` com `action: "read"` e o `url` do link: sem ler antes, a publicação é recusada.
  3. `Artifact` (publicar) com o mesmo `url`, `file_path` = `<scratchpad>/publicar/index.html` e `files` = a lista do
     passo 1.

### Refino do personagem (10/11): pedido do dono, o que mudou e como ficou
O dono testou a página, gostou ("estamos chegando onde eu quero") e pediu mais uma refinada: (1) "ainda tem alguns
bugs quando ele bate"; (2) "a cabeça não gira com o corpo, fica meio estranho"; (3) "a forma de andar parece de um
robô". Medi antes de mexer (`saltos.cjs`, `passada.cjs`), corrigi, e uma revisão independente (outro agente, sem a
minha conclusão) achou mais 10 problemas. Corrigi e pedi uma segunda passada: 6 itens confirmados como corrigidos, 3
melhorados e 2 problemas novos (pernas em X ao virar andando e um pulinho com os dois pés no soco virado), que
corrigi depois, junto com a emenda do combo, que ainda parava o punho por um quadro.

**Antes → depois** (medido com as ferramentas de `prototipos/pindorama-25d/ferramentas/`):

| O que | Antes | Depois |
|---|---|---|
| Soco: maior giro do peito num quadro | 37° | 14° |
| Soco: cabeça | parada (o peito girava até 49° embaixo dela) | gira 40% do giro do peito, com os olhos no alvo |
| Virar para o mouse: maior giro num quadro | 27,6° | 12° (no máximo 720°/s) |
| Combo: tranco do punho na troca de mão | 56 cm/quadro² | ≤ 15 |
| Soco: pés | davam passo durante o golpe; a base trocava a cada soco | base fixa (pé esquerdo na frente); nenhum pé no ar no golpe nem os dois no ar juntos |
| Virada de 135°–180° andando | pernas em X (tornozelos a −47 cm) | joelhos nunca cruzam; o pé no ar não passa para o lado do apoiado |
| Rosto nas vistas de lado | sumia de uma vez (o cabelo inteiro pulava para a frente) | aparece e some aos poucos |
| Andar: passos por minuto / passo | 178 / 54 cm | 150 / 64 cm |
| Passos de correção do pé (em 3 s) | 9 andando, 13 correndo | 0 e 0 |
| Joelho no meio do passo | ~30° dobrado (14°–24° parado) | quase esticado (4°) |
| Cotovelo andando | 44°–61° | 12°–33° (solto) |
| Correndo: passos por minuto | 244 | 220 |
| Pulo | ponta do pé 27 cm dentro do chão; perna estalava; passinho no pouso | impulso pela ponta; dedos nunca entram no chão; pousa onde toca |
| Escorregão do pé apoiado | 0,0 cm/s | 0,0 cm/s (medido no ponto que encosta) |

**Como ficou por dentro** (`animator.js`, salvo onde indicado):
- **Pé que rola:** a trava guarda o "pé chato"; o tornozelo gira em volta do calcanhar (ponta para cima) ou da base
  dos dedos (calcanhar para cima), com `B.heelBack`/`B.ballFwd` (`body.js`); os dedos dobram (`toeBend` → `rig.toe`,
  desenho em `renderer.js`) e nunca passam do chão.
- **Balanço:** o pé sai do chão parado e pousa parado (velocidade zero no chão, curva `ease` com `b` 2 andando e 2,2
  correndo); a correção do lugar de saída anda junto com o corpo.
- **Pelve:** sobe no meio do apoio e desce no apoio duplo; depois de montar os pés, desce o que faltar para a perna
  alcançar o pé (até 3 cm parado, 5,5 cm andando, rápido para descer e devagar para subir). Passo de emergência só se
  ainda faltar alcance (`hipStand` 83,9 em `body.js`: perna quase esticada em pé).
- **Braços e cabeça com peso:** braço em pêndulo (`armFK`) passando por uma mola; a cabeça segue parte do giro do
  peito por uma mola, vai na frente nas curvas (`turnLead`) e, no soco, os olhos miram o alvo (`gazeX`).
- **Soco:** giro em cadeia (quadril, peito, ombro); alvo calculado no espaço do corpo, descontando o giro e a
  inclinação do peito (o punho vai reto, até agachado); o direto arma o punho no queixo com o cotovelo para baixo, e
  o jab sai da guarda; o golpe espera o corpo virar para o alvo; a investida é um deslocamento de 7 cm só no chão e
  fora da conta da passada; o clique nunca se perde (um soco na fila); o combo leva a diferença de pose e some em
  0,1 s (inclusive o calcanhar de trás).
- **Viradas:** pedir para ir muito para o lado ou para trás faz ele andar no máximo a 45° da própria frente, mais
  devagar, enquanto vira; o corpo nunca passa de 55° na frente dos pés apoiados (a virada se divide em passos); o pé
  no ar não cruza para o lado do pé apoiado (folga de 10 cm, entrando suave); quase parado numa virada grande, os pés
  viram no lugar (passinhos); parado, o pé gira sobre a base dos dedos em viradas pequenas; ele termina a virada
  mesmo soltando a tecla.
- **Pulo:** o preparo agacha e começa a esticar antes de sair do chão; o impulso sai do pé que estava apoiado; na
  descida o pé vai para onde vai pisar; o pouso amortece na velocidade da queda.
- **Cabelo** (`renderer.js` e `HAIR.nape` em `body.js`): a massa fica sempre atrás da cabeça; a parte de trás que
  cobre a cabeça é uma "touca da nuca", calculada pela câmera como a touca de cima.

**Ainda pode melhorar (decisões de jogo ou detalhes):**
- Socar para o lado ou para trás é mais lento: o golpe espera o corpo virar e os pés se acertarem (clique → impacto:
  0,23 s até 30°, 0,37 s de 60° a 135°, 0,45 s para trás). Se o dono quiser mais rápido, dá para socar girando.
- O soco agachado sai baixo, com o tronco bem inclinado.
- A fila guarda um soco: cliques muito rápidos (a cada 0,08 s) viram 2 socos.
- Correndo, o ritmo é de 220 passos por minuto (corrida de gente: 160–190) por causa das pernas curtas do modelo;
  andando, 150 (a meta do plano era 120–140).

**Ferramentas novas ou mudadas:** `saltos.cjs` (agora com pernas, ponta do pé, pulos e virada correndo), `tira.cjs`
(tiras de 1/30 s: combo, soco para o lado, virada, parada, corrida, pulo, virada correndo, soco agachado),
`cabeca.cjs` (cabeça girando 360°), `escorregao.cjs` (ponto que encosta; pé chato abaixo de 2°).

### Redesenho pela referência do dono (10/11)
O dono gostou do refino e pediu: "melhorar o design do pé e da mão, melhorar o design do rosto, deixa mais imponente,
arrumar o cabelo também", com uma referência (busto de um guerreiro indígena pintado: faixa trançada na testa,
cabelo comprido com duas tranças amarradas, coroa de penas vermelhas, pretas e creme, urucum nos olhos com listras
brancas e uma linha branca no queixo, brincos de contas com penas, colar de garras, capa de penas no ombro e uma
aljava com flechas).
- **O que veio da referência:** rosto (maçãs altas, mandíbula larga, queixo quadrado, nariz largo, arco da
  sobrancelha pesado, olhar estreito), a pintura (faixa vermelha, listras brancas, linha do queixo), a faixa trançada
  (losangos vermelhos com miolo preto, cordão dourado), cabelo comprido nas costas, as duas tranças com amarrações, a
  coroa de 5 penas atrás da cabeça, brincos de contas com uma peninha e o colar de garras. Corpo mais imponente:
  peitorais, dorsais e trapézio maiores, ombros mais largos (`shoulderHalf` 19,6), pescoço mais grosso, braço e
  antebraço mais fortes.
- **Mãos e pés:** a mão agora é palma + quatro dedos + polegar (`HAND` em `body.js`); ela fecha no soco e fica solta
  parada, com linhas suaves entre os dedos no lado que aparece. O pé tem calcanhar, peito do pé, dedão e dedos menores
  (`FOOT` e `TOES`); os dedos dobram no chão junto com o pé que rola.
- **O que ficou de fora, de propósito:** a aljava (é arma) e a capa de penas (é peça de roupa por cima do corpo). A
  regra do protótipo é personagem base sem arma e sem armadura; as duas podem virar equipamento na arquitetura que já
  existe (`equipment.js`).
- **Por dentro:** a faixa é um anel em volta da cabeça, calculado uma vez só (a distância até a superfície em cada
  ângulo) e guardado; as tranças são uma curva suave do lado da cabeça ao peito, em gomos que alternam o lado; a coroa
  de penas fica num plano atrás da cabeça. Os detalhes pequenos (dedos, gomos, músculos, miolo dos losangos, pontas
  do cabelo) só aparecem com zoom × densidade da tela ≥ 1,1 (era 1,25: o zoom de começo de um monitor de PC comum,
  ~1,2, ficava sem eles). Medido com a CPU 4× mais lenta, correndo pela rua, no navegador de teste (sem placa de
  vídeo): 20 fps em 1280×800, 12 em 1920×950 e 13 no celular emulado — antes do redesenho, 19, 13 e 12. No celular, o
  personagem ficou mais caro de desenhar (~12 → ~16 ms nesse teste), mas o resto do quadro pesa mais. A faixa é
  calculada uma vez só e as tranças não têm linhas de dentro automáticas (só os riscos dos gomos): foi o que segurou.
- **Achado na conferência de perto (zoom 6 a 7) e corrigido:** a faixa cobria as sobrancelhas e espremia os olhos; as
  costeletas e o alto das tranças viravam "garras" pretas por cima do rosto nas vistas de 3/4 e de lado (vista de
  cima, a raiz da trança, atrás da orelha, cai na altura dos olhos). Agora a faixa fica acima das sobrancelhas, com a
  linha do cabelo por baixo dela (senão vira tiara); as costeletas saíram (na referência o cabelo passa por trás da
  orelha); a cabeça esconde o alto das tranças (`hideInside` no desenho), que nascem embaixo da mandíbula; o brinco
  fica na frente da trança.
- **Conferido depois:** escorregão do pé 0,0 cm/s em todos os casos, ossos 0,0000, ponta do pé nunca dentro do chão,
  passada 150 por minuto sem correção, estados, toque e prancha sem erro, cabeça girando 360° sem nada pulando.

**Ainda pode melhorar:**
- Na referência caem várias mechas soltas por cima da faixa; aqui são três (mais que isso embola no tamanho do jogo).
- O rosto tem uma expressão só (a boca não mexe; o olhar e o piscar mexem).
- Numa janela pequena (zoom × densidade abaixo de 1,1, como 1280×800 num monitor a 100%) a mão vira uma forma só.

### Ajustes do dono depois da versão 5 (10/11)
O dono viu a versão 5 e pediu: (1) "arruma a orelha dele, fica pra fora do cabelo como se tivesse bugado, ou diminui o
cabelo dele na lateral, deixa apenas o cabelo caído pelo peito amarrado" ("é pra orelha aparecer"); (2) "a cara ainda
parece de um rato"; (3) "arruma os ombros, está bem ruinzinho"; (4) "dá pra pôr músculo? Sem exagero!".
- **Orelha e cabelo dos lados:** a massa do cabelo tinha esferas dos lados que passavam muito da cabeça (até 24 de
  largura; a cabeça tem 15,5) e mechas caindo em cima da orelha; a orelha, redonda e saltada, ficava "colada" no preto.
  Agora a massa e a touca são justas (de frente, nada passa da largura da cabeça), não há mecha do lado do rosto (só as
  tranças) e a orelha é oval, mais alta que larga, encostada na cabeça, com a dobra de dentro (`HEAD.ear`: alto, meio e
  lóbulo). O brinco pendura no lóbulo novo.
- **Cara de rato:** o nariz ficava 6 cm à frente da boca (o dobro de um nariz de verdade), com um vão embaixo dele, e as
  maçãs recuadas: um focinho. Somado à orelha redonda, virava rato. Agora o nariz é mais curto, a boca e o lábio de cima
  têm volume (esfera `boca`), as maçãs vêm para a frente (rosto mais largo e reto) e os olhos estão um pouco maiores.
- **Ombros:** o braço era uma peça só, com contorno inteiro, e o deltoide tinha um círculo com espiral pintado: lia como
  junta de boneco. Agora o tronco tem o alto do ombro (o trapézio desce liso), o braço tem duas peças (o deltoide por
  cima, afinando no meio do braço, e o braço com bíceps e tríceps), a borda do deltoide é uma linha suave, o contorno do
  braço some no alto do ombro (`clipOut` no desenho) e o círculo saiu (`BODY_PAINT.shoulderMark: null`; com `{ r }`
  volta).
- **Músculos, sem exagero:** linhas finas e suaves (`MUSCLE_LINES` em `body.js`, só do lado que olha para a câmera e só
  com o detalhe fino ligado) entre o bíceps e o tríceps, no fim do bíceps, no antebraço, na frente da coxa, na "gota" em
  cima do joelho e na borda da panturrilha; sombra embaixo do peitoral, serrátil na costela, costas um pouco mais em V e
  volume novo na "gota" do joelho e na outra cabeça da panturrilha.
- **Conferido:** escorregão 0,0 cm/s, ossos 0,0000, ponta do pé nunca no chão, passada 150 e 220 por minuto sem
  correção, estados, toque e prancha sem erro, cabeça girando 360° sem pulo. Desempenho com a CPU 4× mais lenta: o
  personagem ficou ~1 ms mais caro; o jogo, na mesma faixa (18 fps em 1280×800, 12 em 1920×950 e no celular emulado).

### Ajustes do dono depois da versão 6 (10/11)
O dono pediu: (1) "o tronco ainda está com bug quando vira e está bem feio"; (2) "o ombro está ruim"; (3) "diminui o
efeito do soco e melhora ele, pois quando está de costas cobre o corpo todo"; (4) "o pulo dele dá uns bugs estranhos".
Achei as causas filmando quadro a quadro (giro do tronco de 15° em 15°, corrida de costas, pulo de lado e de 3/4, soco
no jogo de costas e de lado) e desligando peça por peça:
- **Tronco na virada:** três defeitos de ordem de desenho. (a) A trança do lado de perto era desenhada pela ordem do
  centro do peito e aparecia por cima das costas: agora ela tem dois trechos, o do ombro (sempre visível, a câmera vê de
  cima) e o do peito (só na frente quando o peitoral está virado para a câmera; senão, atrás do tronco); com os dois na
  frente, a trança continua uma peça só (sem emenda). (b) De costas e inclinado (correndo), o alto da pelve subia nas
  costas e o contorno dela aparecia como um "ovo" na lombar: o alto da pelve desceu (fica logo acima da tanga), peito e
  pelve não desenham o contorno um em cima do outro (`clipOut`) e o colar, que caía entre os dois na ordem, fica para
  depois (o tronco é desenhado numa peça só). (c) A ponte do ombro (abaixo) apagava o trecho da trança no ombro.
- **Ombro:** o deltoide ficava pendurado embaixo de uma "prateleira" do tronco. Agora uma ponte (casco do trapézio ao
  deltoide, `MOD.SHOULDER` em `body.js`) fecha o vão e a linha do ombro desce lisa do pescoço até o braço, acompanhando o
  braço quando ele balança; ela é pintada com o tronco, antes do peito (só aparece no vão) e por baixo da trança e do
  colar; de costas, encolhe para dentro do deltoide (o cabelo já cobre o trapézio). Deltoide um pouco menor e mais
  baixo; o contorno do braço some no alto do ombro (`SHOULDER.clip`).
- **Soco:** a estrela tinha ~80 cm (mais larga que o tronco) e era desenhada por cima de tudo. Agora tem ~30 cm, com um
  anel que abre e some e 4 riscos curtos; o tremor da tela é menor. Soco para longe da câmera (de costas): o efeito é
  desenhado antes do personagem (`behind` em `world.js`), então o corpo passa na frente dele.
- **Pulo:** a mola dos braços era mole demais para um pulo de meio segundo: os braços nunca chegavam às poses e ficavam
  um esticado na frente e o outro cruzado na cara (um "dab"), carregando o balanço da caminhada; depois abriam em "asa
  de avião". Agora a mola fica firme no pulo (entrando aos poucos: trocar de uma vez dava tranco), os dois braços fazem
  o mesmo (`JUMP_HANDS` em `animator.js`: para trás no preparo, um balanço para a frente no impulso, soltos e um pouco
  abertos no ar) e o pouso volta para o braço de andar aos poucos. Trancos dos braços no pulo: 12,8 → 11,6 andando e
  15,7 → 13,3 correndo (cm/quadro²).
- **Conferido:** escorregão 0,0 cm/s, ossos 0,0000, ponta do pé nunca no chão, passada 150 e 220 por minuto sem
  correção, estados, toque, prancha e equipamento de prova sem erro, cabeça girando 360° sem pulo, giro do tronco de 15°
  em 15° (parado e andando) sem trança por cima das costas. Desempenho com a CPU 4× mais lenta: igual ao da versão 6
  (17 a 21 fps em 1280×800 conforme a medida, 11 a 12 em 1920×950 e no celular emulado).

### Auditoria e correção pedida pelo dono (versão 8, 10–11/11)
O dono mandou uma auditoria de 18 itens (anatomia, movimentação e estrutura), 10 testes e um padrão de exportação, com a
regra "corrija primeiro o personagem, depois as animações e por último a arquitetura; preserve o personagem". Fiz uma
auditoria com números antes de mexer (`ferramentas/auditoria.cjs` + `js/tools/audit.js`, 45 roteiros; roda também
numa versão antiga, para comparar) e conferi tudo com ela no fim. O relatório completo (erro, causa, arquivos,
solução, testes e pendências) está no documento "Pindorama 2.5D — Auditoria e correções (versão 8)".
- **Personagem:** ombro (cabeças do deltoide no lugar da bola), joelho (patela e canela no lugar da "gota"; a perna
  pintada como uma peça só), proporções pelo cânone (`BODY` em `body.js`; as animações escalam junto), mãos maiores com
  dedos em cascata, tornozelo com os maléolos e o tendão, cabelo/penas com a mesma silhueta em todo zoom e amarração
  das penas, tanga em três colunas que acompanha a coxa, mesma forma em todos os ângulos.
- **Animações:** a causa do erro de 19–28 cm no pulo era o alcance da perna conferido na altura do chão, com o corpo
  no ar; agora o alcance usa a pelve de verdade, o pé apoiado gira no ponto que está no chão (calcanhar sobe atrás,
  ponta sobe na frente) e o pé no ar chega no limite por uma curva suave. Agachado com o peso para trás (centro do
  corpo de +10,7 para −4 cm), saída do pé do chão sem tranco (andando 9,6 → 5,7 cm/quadro²), mola no agachar.
- **Estrutura:** validação dos encaixes (`equipment.js`), perfis de classe (`classes.js`), ordem de desenho pelas
  superfícies (`_depthFix` no `renderer.js`), exportação padronizada em camadas (`exportar.html`, `js/tools/export.js`,
  `ferramentas/exportar.cjs`) e testes no Node (`ferramentas/testes.cjs`, 40 testes, ~3 s).
- **Pendências:** tranco no joelho na primeira passada ao começar a correr (15,7; v7: 11,7), trocas de ordem
  cabelo × trança/orelha, contorno mínimo no zoom bem pequeno, ~20% mais CPU que a versão 7, teste em celular de verdade.

### Revisão 17 — a oficial (12/11)
O dono continuou o protótipo em outra ferramenta, em cima da minha versão 8, até a **revisão 17**, que passou a ser a
oficial (combinado entre o dono e a [estrutura]). Ela acrescenta um treino de combate: rival com estilingue, pedra com
carga (segurar e soltar), defesa frontal com energia, esquiva, queda e som. No repositório entram só o código, o
`LEIA-ME.md` e, em `prototipos/pindorama-25d/auditoria/`, os arquivos que os testes leem (`medir.cjs`,
`medir-ritmo.cjs`, `renderer-r8-referencia.js` e 7 `.json` de referência, 248 KB). Os relatórios, PDFs, GIFs e imagens
(19,6 MB) ficam com o dono.
- **Conferido aqui:** os meus 40 testes no Node passam; a auditoria (45 roteiros) não acha erro: pé no alvo do IK,
  ossos sem esticar, pé sem escorregar (no máximo 0,1 cm/s). Dos testes da revisão, 21 passam, 2 não rodam (pedem o
  pacote `@napi-rs/canvas`, que o projeto não tem) e o `teste-resposta.cjs` falha porque compara com poses das
  revisões 2 e 3, e o movimento mudou depois. O jogo abre sem erro e os botões de toque funcionam.
- **Comparado com a versão 8** (tranco das pernas, cm/quadro²): andar 5,7 → 3,0; primeira passada ao começar a
  correr 15,7 → 8,0 (resolveu a minha pendência); pulo parado 13,5 → 7,3. Piorou: virada de 180° correndo (pernas 9,9
  → 17,2, braços 3,1 → 14,3, corpo 22 cm à frente dos pés), pulo correndo 11,8 → 15,5 e o tranco dos braços somado
  (+24%). Desempenho com a CPU 4× mais lenta: 12 quadros por segundo (versão 8: 16).
- **Atenção para levar ao jogo:** o protótipo chama a queda de "Morrendo/Morto"; no MeuMMO quem perde a vida desmaia.
- **Correções depois da revisão 17 (13/11, com o aval do dono):** a virada de 180° correndo dava um tranco no começo
  porque três coisas ligavam no mesmo quadro: o giro já a 600°/s, a passada caindo 21% e o pé do balanço virando um
  passo que começava parado. Agora o giro do pivô acelera em ~0,04 s (fora do soco: com soco a rampa fazia as pernas
  cruzarem), a passada sai aos poucos e o passo herda a velocidade do pé (até 9 m/s). Também: o relógio do soco
  desacelera em poucos quadros ao esperar o corpo virar, e o ponto de giro do pé apoiado usa a inclinação real (antes
  multiplicava a passada duas vezes e, com o pivô, o calcanhar riscava o chão). Virada de 180° correndo: pernas 17,2 →
  14,0, braços 14,3 → 5,4, corpo 22 → 9 cm à frente dos pés; soma dos braços 207 → 194, das pernas 252 → 243; nenhum
  roteiro piorou. Testes da revisão: todos passam menos o `teste-resposta` (as mesmas 2 falhas de antes). Desempenho:
  cada personagem custa o mesmo que na versão 8; a queda de quadros é o rival (um segundo personagem) e os efeitos.
- **Na main e no link:** juntei na `main` com o "pode" do dono (12/11) e o link jogável do dono foi para a revisão 17
  (versão 9 da página). A revisão 17 pede os scripts com `?v=…`; o `montar_pagina.py` agora tira esse sufixo da
  página publicada (os arquivos vão sem ele).

### Etapa 3 do Mapa 01: a PD.View e a clareira (12/11)
Divisão aprovada pelo dono: a [arte] faz o desenho 2.5D (`PD.View`, no protótipo), a [estrutura] faz o motor
(`src/client/novo/`, página `/novo`). Interface combinada por mensagem com a [estrutura]: posições em metros no pé,
ângulo em graus (como o `walk` do servidor), `moveActor` a cada ~50 ms; a view anima o andar até a posição (perna
pela distância). Velocidade pedida ao servidor (decisão do dono): andar ~2 m/s, correr ~4,5 m/s com Shift.
- `js/world/tmj.js` lê o `.tmj` do [mundo] (1 tile = 1 m; px ÷ 32 = metros) e monta o mapa do protótipo (cm); o
  mundo, o chão e os objetos aceitam esse mapa sem mudar o da esquina de São Paulo (o jogo do protótipo segue igual).
- Câmera: "médio" = 1 (padrão), "longe" = 0,7 (mínimo). Provisório até o dono decidir: aproximar até 1,4 e, com o
  celular em pé, uns 9 m de largura (o médio mostraria 5,5 m).
- **No jogo de verdade** (`/?novo`): `src/client/novo/arte.ts` (da [arte], combinado com a [estrutura]) importa os
  scripts do protótipo na ordem de `view-scripts.json`; com `PD.View` carregado, o motor usa ele sozinho. Interface
  `WorldView` (`src/client/novo/view.ts`): `new PD.View(caixa, tmj)` (cria o próprio `canvas.mundo-novo`; aceita
  também um canvas pronto), `addActor(id, { kind, type, name, look, x, y, angle, me })`, `moveActor(id, x, y, angle,
  { durationMs, dash })`, `removeActor`, `say`, `follow`, `frame`, `toWorld`, `toScreen`, `groundDirOfScreen`
  (teclado e joystick andam pela tela) e `destroy`. `angle` = graus no chão (0 = leste, 90 = sul), como o `walk`
  (a [estrutura] trocou as 8 direções pelo ângulo em 12/11, a pedido da [arte]). `PD.view` = a view em uso (testes).
- **Velocidade** (decisão do dono, 13/11): correr é o normal (4,5 m/s), Shift anda (2 m/s). A view anda pela
  velocidade de verdade: a 2 m/s o passo é de caminhada (mistura de corrida ~4%); a 4,5 m/s, corrida, com até 35% a
  mais para alcançar depois de uma virada (`input.speedScale` no animador, só a view usa).
- **Virada ágil** (escolha do dono, opção b, 12/11): o servidor inverte na hora e o personagem gira plantando os
  pés, então no jogo ele vira mais depressa que no protótipo: `AGILE` no animador (aceleração 1,8×, giro 1,6×, pivô
  1,8×, passos do pivô 0,85×, sai do pivô a 75°, e o pivô só começa abaixo de 1,5 m/s; a freada do pivô fica a
  normal). Só com `input.agile`, que a PD.View manda (`view.agile = false` desliga); o jogo do protótipo não muda.
- **Medido** (`prototipos/pindorama-25d/ferramentas/seguir.cjs`, normal → ágil): virada de 180° correndo, atraso de
  1,75 → 0,91 m e alcança em 1,32 → 0,53 s; 135°, 1,34 → 0,64 m; saindo para trás, 1,75 → 1,01 m; zigue-zague,
  0,84 → 0,63 m e as pernas não cruzam mais (2,3% → 0%). Pior tranco do joelho 20,6 → 13,6; pé apoiado: pior
  0,3 cm/s (o normal chegava a 10,9 na virada de 135°). Correndo reto, ~64 cm atrás (0,14 s); andando, ~28 cm; ao
  parar não passa do ponto. No jogo de verdade, a largada de parado fica até ~1,4 m atrás e volta em ~0,7 s.
- **Nomes e balões** são da view (o motor não desenha etiqueta): nome em cima da cabeça (o seu `#ffe08a`, NPC
  `#8fe3c8`, monstro `#f1e4c8`, como no `style.css`); o balão fica acima do nome, até 6 linhas (passou, "…"), não sai
  da tela e desvia dos nomes e dos outros balões (o de quem está mais à frente fica no lugar, os outros sobem e o
  bico estica por baixo; se não cabe em cima, como no celular deitado, vai para o lado do que atrapalha).
- Ainda não usa: `look` (todo jogador sai com o protagonista), `durationMs` (a view anda pela velocidade de verdade)
  e `type` (o NPC sai com a roupa vermelha).
- **Figueira redesenhada** (reclamação do dono, 12/11: "a árvore está bugada", tronco chapado e copa em "pirulito"):
  o tronco é um cilindro de fatias (cada fatia, um círculo deitado que a câmera mostra como elipse r × r·sinP), com
  base redonda entrando no chão, luz à esquerda e sulcos que contornam o cilindro; raízes grossas meio enterradas
  saindo da base; 4 galhos que saem do meio do topo (desenhados depois do tronco, contorno de todos antes do recheio,
  senão pareciam cruzar em "X") e raízes aéreas penduradas; copa de 50 cachos menores, mais larga que alta, com o tom
  pela altura (embaixo escuro, em cima claro) e os cachos da frente erguidos até 60% da altura para o tronco e a
  forquilha aparecerem. O tronco da figueira também fica transparente quando esconde o personagem.
- **Pedras** ("isso é uma pedra?"): rocha facetada de contorno irregular (anel de base enterrado, anel de cima menor e
  uma coroa), cada face com o tom pela luz, musgo no topo iluminado e fiapos de grama na base da frente; cada pedra
  sai diferente (sorteio pela posição).
- **Celular no jogo novo** (avisos da [estrutura]): o chat vira uma caixinha no canto de **cima** à direita (a esquerda
  é do joystick e o canto de baixo à direita é dos botões Fôlego e Esquiva, que ela cobria; lá em cima o teclado do
  celular também não cobre), ao lado do painel do canto (largura `100vw - 196px`, até 300 px). As duas últimas falas
  aparecem logo abaixo sem segurar o toque e somem; tocar na caixinha abre o chat na largura da tela, com fundo opaco
  por cima do painel. CSS com `body:has(canvas.mundo-novo)`; o jogo antigo não muda. No celular deitado, a faixa da
  zona fica no alto e menor (vale para os dois jogos) e as falas recolhidas dão licença enquanto ela aparece.
  A Mochila (que a [estrutura] ligou no jogo novo em 13/11) ia para o mesmo canto e cobria a caixinha. No celular,
  ela vira um botão só com o ícone, logo acima dos botões de ação, perto do polegar.
  O registro do chat (`ui.ts`) segue a última fala e só para quando o **jogador** rola (roda, dedo ou barra): a
  conta antiga ("está no fim?") se enganava quando o chat mudava de tamanho e o celular pequeno mostrava a fala
  velha. Conferido em Pixel 7 e num celular de 320 px, em pé e deitado (`chat-celular.cjs` no scratchpad).
- **Criaturas (monstros que não são gente), 13/11:** `js/creatures/creature.js` é a base. A criatura anda de casa
  em casa no tempo do passo do servidor, em linha reta, e vira suave. O jeito de andar sai da velocidade suavizada.
  Os golpes chegam por `view.action` ('windup', 'shoot', 'hurt'...). O desenho é o da capivara: bolas com contorno
  de tinta, a meia-lua escura do lado da sombra e o brilho do lado da luz. A ordem entre as partes vai pela posição
  no chão e pouco pela altura, como no corpo da gente. Detalhes de rosto e listras são "decalques" achatados pela
  câmera, que somem de costas. Para criar uma: `PD.creatures.define('tipo', Classe)` e pôr o arquivo em
  `view-scripts.json`, `clareira.html` e `src/client/novo/arte.ts`; o tipo é a chave do monstro em `data/monsters.json`.
  **Sagui** (`sagui.js`), em tamanho de jogo (`S` = 1,6; sentado, uns 75 cm, quase metade do herói: com a câmera
  longe, que o dono pediu, menor que isso some no celular; no jogo antigo o monstro tinha o tamanho do personagem):
  - corpo cinza-amarronzado com o lombo rajado e a barriga clara;
  - rosto escuro com a mancha branca na testa e o focinho curto;
  - olhos amarelos acesos com a pupila em fenda e dois pontinhos lilás rodando (o encanto);
  - tufos brancos em leque dos lados da cabeça e o rabo de anéis.
  Parado, senta e olha em volta. Correndo, vai de quatro aos saltos. No aviso, senta e ergue a fruta verde (a mesma
  cor da fruta que voa) atrás da cabeça; no tiro, arremessa por cima. Ao apanhar, pisca branco e encolhe.
  Ao cair ('die'), desmaia de bruços em 0,3 s, com os olhos fechados e o rabo largado; o encanto sobe e some, o
  nome sai e o desenho apaga até o motor tirar, 0,7 s depois. Tombar de lado girando o corpo todo (`_fall`, da base)
  ficou confuso no sagui; fica para quem não tiver pose própria (`ownDeath`).
  Prancha de conferência: `prancha-sagui.cjs` no scratchpad (8 lados × sentado, correndo, preparo, arremesso,
  apanhando, caindo).
  A câmera olha de cima, então o rosto fica alto na cabeça; embaixo, o focinho escondia os olhos.
  **Jararaca** (`jararaca.js`, `S` = 1,15; uns 2 m de comprimento): o corpo é uma fila de bolas ao longo do
  rastro da cabeça (pontos de 3 em 3 cm), com uma onda em S presa ao chão (fase = distância andada), então a cobra
  rasteja sem deslizar e, parada, fica em S. Enrolada (`coil`, no aviso, no bote e um pouco depois), o corpo vira uma
  espiral atrás da cabeça e o pescoço sobe numa curva (Bézier); a mistura entre as duas poses é suave. Manchas em
  "V" são decalques em triângulo nos flancos, alternando os lados. A cabeça é larga atrás (as bochechas), com olho
  amarelo, pupila em fenda e a risca escura até o canto da boca. A língua sai de vez em quando (mais no aviso).
  O corpo é desenhado numa peça só: em pedaços, cada emenda ganhava contorno e parecia lagarta. Só o pescoço é
  outra peça, e na emenda as bolas dele não têm contorno (`noInk`).
- **Mata nova, entrega 1 (13/11):** pedidos do dono via [mundo], "floresta mais sombria" e "árvore normal, não
  redonda, e árvore seca". Referência: `docs/referencias/mapa-01-arte-aprovada.jpg`.
  - **Árvore de verdade** (`crownPaint` em `props.js`, espécies em `BROADLEAF` e a seca):
    - o tronco (`TreeTrunk`) vai só até a forquilha (`FORK` 0,42 da altura) e a copa (`TreeCanopy`) desenha os
      galhos dali até 4 a 7 tufos espalhados, mais um em cima;
    - cada tufo é um contorno de lóbulos de folhagem (`tuftPath`): o escuro embaixo, o corpo deslocado para a luz, a
      parte clara, folhas claras e escuras, vãos e folhas soltas na beirada;
    - os galhos ganham todos os contornos antes dos recheios, para não riscarem um ao outro;
    - a mata tem cipós pendurados.
  - **Seca:** galhos que se dividem em gravetos duas vezes, casca cinza e barba-de-velho.
  - **Caixa da imagem guardada:** é calculada justa pelos tufos (`crownPlan`); a folgada pesava.
  - **Clima** (`_drawAtmosphere` em `view.js`):
    - cada área do mapa traz `escuro` e `neblina` (`tmj.js` lê); onde duas se cobrem, vale a menor, e a troca é
      suave;
    - o escuro é um degradê verde-azulado fundo, fraco perto do herói (para ler o combate) e forte nas bordas;
    - a neblina é um véu leve mais bancos que se arrastam, presos ao chão;
    - tudo numa camada 4× menor, esticada uma vez só: no teste sem placa de vídeo, a mata profunda caiu de 33
      para 26 quadros por segundo com três passadas na tela inteira e voltou para 29 assim.
  - **Medido na área dos saguis do mapa de hoje** (PC/celular): árvores antigas sem clima, 27/23 quadros por
    segundo; árvores novas com clima, 25/25.
- **Rua no padrão novo, o chão (13/11):** referências aprovadas `padrao-rua-floresta.jpg`, `rua-budega-aprovada.jpg` e
  a planta `rua-budega-planta.jpg`. Tudo em `js/world/street.js` (carrega logo depois do `ground.js`; está nas três
  listas de scripts), pintado no chão uma vez por pedaço da tela:
  - `PD.street.texture[tipo]` troca a textura de superfície: asfalto (grão miúdo, manchas fracas de tom e de óleo,
    trincas; o `estado` 'rachado' tem mais, com "couro de jacaré"), calçada com `desenho` 'placas' (placas de ~70 cm,
    juntas escuras, umas trincadas, manchas de musgo, levantadas perto de raiz, mato nas frestas) e o campinho (terra
    batida, grama nas beiradas e as linhas de cal se tiver `linhas`). A praça com `musgo` ganha musgo e capim, mais
    nas beiradas.
  - `PD.street.paint[tipo]` desenha as formas que são só detalhe: meio-fio (o lado da rua é achado pelo asfalto
    vizinho; tampo claro com juntas, sarjeta suja e, quando a rua fica do lado da câmera, a face do meio-fio descendo:
    a rua parece mais baixa), faixa-rua (tracejada e apagada), remendo, buraco (com água), poça, rachadura (com mato),
    bueiro (a grade deitada ao longo do meio-fio, `olhando` = para onde a boca dá), tampa, raiz (cordão que afina, com
    sombra, lado de cima claro e o chão trincado em volta) e capim (planta `capim` na camada do chão).
  - Capim e mato sobem na tela: no chão, subir `h` cm é andar (-k·h, -k·h), com k = cosP / (2·K·sinP).
  - `PD.street.breaks` quebra o chão em volta da árvore com `rompendo` (terra, pedaços levantados, trincas).
  - O leitor do mapa (`tmj.js`) passa as propriedades novas: nas linhas `altura`, `tracejada`, `apagada`, `sarjeta`,
    `mato`; nos retângulos `estado`, `musgo`, `linhas`; os pontos do chão (`raio`, `olhando`, `agua`, `tipo`); e o
    `rompendo` da árvore.
  - A figueira só tem os símbolos que brilham se tiver um véu a menos de 4 m (a Figueira da Esquina é só uma árvore
    grande da cidade).
  - Custo de um pedaço do chão (512 px) na rua: 6,6 ms no PC e 24,6 ms no celular de teste, quase o mesmo de antes
    (6,5 e 23,6 ms).
- **Rua no padrão novo, as coisas em pé (13/11):** `js/world/city.js` (carrega depois do `flora.js`; nas três listas de
  scripts) e mudanças no `props.js`.
  - `PD.city.small[tipo]` (o `Small` pergunta a ele depois da flora): `placa-rua` (poste fino e duas plaquinhas azuis
    cruzadas no alto, `texto` ao longo de x e `texto2` ao longo de y, desenhadas na parede de cada uma com
    `cam.wallMatrix`; a largura sai do tamanho do texto), `moto` (referencial girado pelo `olhando`, inclinada no
    descanso; rodas no plano de pé, tanque, banco, motor, guidão e farol; com `mato`, cipó por cima e capim em volta),
    `cadeira` (de plástico; encosto e pernas na ordem certa conforme a frente vira para a câmera ou não), `vaso` (barro
    com espadas-de-são-jorge: verde-escuro com faixas claras e borda amarela) e `lixo` (sacos pretos com brilho e nó).
  - `PD.city.bunting`: o cordão de bandeirinhas (`bandeirinhas` no mapa, polilinha com `altura`), caindo no meio,
    as bandeirinhas a cada 38 cm, de cores alternadas, balançando (desenhadas a cada quadro, depois dos fios).
  - `PD.city.wireVines` (fio com `cipo`): folhas enroladas no fio do meio e fiapos pendurados que balançam;
    `PD.city.poleVine` (poste com `cipo`): espiral de cipó subindo e fiapos caindo da cruzeta.
  - Casa (`props.js`): `cipo` (0 a 1) = cortinas de cipó caindo da laje e ramos subindo do chão (`overgrowth`),
    `musgo` (manchas de chuva escorrendo e musgo no rodapé e na beirada), `portao` (portão de garagem de ferro com
    frisos e ferrugem), e na laje (`roofItems`, do fundo para a frente) a caixa d'água, `plantas` (samambaias e
    arbustos da flora), `arvoreNaLaje` (árvore pequena com tronco e copa de tufos) e `varal` (roupas na parede
    imaginária do fio). O escudo da Budega é desenhado depois da laje (planta nenhuma fica na frente da marca).
  - `predio` (no mapa) vira uma casa alta (`tower`): 5 andares, varandas embaixo das janelas, a entrada no meio com a
    marquise e a placa do bloco (o nome do prédio, "Bloco B"), o cipó sem cobrir a entrada e duas caixas d'água.
  - Carro com `arvore`: o tronco sai pelo teto (o teto rasgado em volta) e a copa abre em cima.
- **Correções do dono na rua (13/11):** a Figueira da Esquina (`rompendo`) tem raízes do tronco curtas e baixas. As
  `raiz` do chão foram refeitas ("tá feio demais essa raiz": grossas por igual e de outra cor, pareciam um cano): a raiz
  sai grossa e afina, se divide em raízes menores (dois níveis, poucos galhinhos para não virar graveto), tem a cor da
  casca da figueira, é um pouco alta (lado de cima claro, sombra no chão, sulco da casca) e entra no asfalto num trecho
  e sai adiante (o buraco escuro e pedrinhas). O chão quebrado em volta da árvore vai antes dos detalhes do chão (as
  raízes passam por cima dos pedaços). A caixa d'água virou a
  de plástico das lajes (corpo que abre para cima com dois anéis, tampa com cúpula e pegador, cano branco, calço de
  madeira). O carro foi refeito: perfil de sedã esticado na largura, portas, vidros (um quebrado), faróis, rodas
  murchas, ferrugem; o mato virou musgo no teto e no capô, cipó e capim (antes eram bolas verdes).
- **Raízes da Figueira da Esquina, de novo (13/11, referência do dono mandada no chat: o tronco abrindo em muitas
  raízes redondas que serpenteiam pela calçada e pelo asfalto, placas levantadas, musgo, folhas secas).** O que o dono
  achou feio, para não repetir: "cano" grosso por igual; galhinhos que pareciam gravetos; "garras" enroladas no pé; a
  base lisa como uma saia; pontas rombudas com monte de terra (pareciam tora cortada); faces retas (tábuas).
  - Os caminhos das raízes saem de `PD.street.figRootPaths` (street.js): as `raiz` do mapa, começando no centro do
    tronco, e raízes a mais nos vãos maiores que ~50° (nenhuma entra em casa). O pé do tronco (`_figButtress`, props.js)
    e o chão usam os mesmos caminhos e a mesma largura (`rootWidth`): o pé nasce dentro do tronco largo e alto e, a
    2,3 raios do centro, tem a largura e a altura da raiz do chão, sem contorno — as duas viram uma só.
  - Corte em meia elipse (lombo redondo) em faixas, cada uma com a cor da luz que recebe (mesma paleta no pé e no
    chão); musgo irregular no alto; a ponta afina, fica rente e some na terra escura; às vezes a raiz passa por baixo
    do chão (trinca por cima) e sai adiante. Galhos: até dois na principal e um no galho, cedo e abrindo para o lado;
    raiz fina (árvore pequena) não se divide.
  - `breaks` (o chão em volta): terra escura com manchas, placas de calçada levantadas (o lado aparece, beirada clara
    do lado da luz, trinca e capim), pedaços de asfalto quase rentes, trincas e folhas secas; as raízes a mais são
    pintadas aqui, as do mapa por cima.
  - A Figueira dos Despertos também ganhou o pé novo (o dono aprovou em 13/11): na mata, `breaks` só pinta a terra
    escura e as raízes (`plain`: sem trincas, lascas nem placas), mais curtas; nenhuma raiz entra no círculo do
    despertar, em casa ou no pé de poste e de semáforo (`blocked`). As raízes antigas em garra (`_figRoot`) saíram.
- **Conversa com NPC, parte 2 (13/11).** `PD.View.focus(ponto|null)`: a câmera mira um ponto do chão um pouco mais
  perto da câmera que o pé de quem fala (16% da altura da tela; 20% no celular em pé), então a pessoa fica acima do
  meio e a fala embaixo não a cobre; o NPC parado vira para você. `talk(id, ms)`: gente abre e fecha a boca em
  sílabas (`look.mouthOpen`) e levanta a sobrancelha; criatura usa o `talk` dela (a Xiovanna já tinha). O seu
  personagem entre a câmera e quem fala fica com 32% de opacidade (`_conversationAlpha`). A janela (`talk.ts`)
  liga o modo `cinema` quando a página tem o `canvas.mundo-novo`: plaquinha do nome na cor de NPC, a fala grande
  escrita no ritmo da boca (55 ms por letra, até 7 s; tocar mostra tudo), o pedido da missão nova vira a fala (não
  repete no cartão), rodapé com Ver a loja e Tchau. CSS: `#talk.cinema` (embaixo, 760 px, até 46% da altura; no
  celular, a largura toda até 54%) e `.shop-portrait` escondido no jogo 2.5D.
- **Tela inicial nova (13/11, referência `docs/referencias/tela-inicial.webp`).** `src/client/index.html` e o bloco
  "Tela inicial" do `style.css`. O fundo e o logo estão em `public/assets/ui/` (o fundo achatado sobre preto, 205 KB;
  o logo com 1100 px de largura, 154 KB). O painel tem a moldura de madeira feita de camadas de `box-shadow`, cipós e
  folhas num SVG por cima das quinas e o medalhão do sol em espiral. O botão "Entrar" é uma pincelada (`clip-path`).
  Os ids combinados com a [estrutura] (`#login-title`, `#password2`, `#mode-toggle`, `data-mode` no form) seguem a
  lógica do `main.ts`. O "Repita a senha" e a dica só aparecem em `data-mode='create'`. O "Como jogar" fica no canto
  de baixo; em tela estreita ou baixa, vai para baixo do painel. Ficam fora Google, e-mail, "Esqueceu a senha" e
  "Sair" (decisão do dono).
- **Budega com interior (13/11, pedido do dono: "igual HumanitZ").** A `casa` com `interior: true` dá para entrar.
  - Na ordem de desenho, a `House` é só a parede da frente (pé = a faixa de 20 cm da frente). A `HouseBack` é a
    parede do fundo e a da esquerda vistas por dentro (pé = a faixa do fundo): reboco creme em cima, azulejo branco
    embaixo com a faixa azul, relógio, a placa "FIADO SÓ AMANHÃ", a lousa de preços (água de coco, garrafada, pão de
    queijo, açaí) e um calendário; o topo das paredes aparece (sem a laje).
  - `World.update` vê se o herói está dentro (para sair, 25 cm a mais: na porta não pisca). A casa anima `cutK` de 0
    a 1: a casa inteira some e entra a cortada (`paintCut`: base de 45 cm da frente e do lado, com o corte claro em
    cima, e a soleira no vão da porta de enrolar).
  - Os móveis (`prateleira`, `geladeira`, `balcao` com `caixa`, `engradado` com `pilha`; `olhando` 90 = frente para
    o sul, 0 = leste) estão no `city.js` e só aparecem com a casa cortada. O piso é o tipo `piso` do chão (street.js):
    ladrilho hidráulico de 25 cm com a flor terracota e o losango verde, mais gasto perto da porta.
  - Quem está dentro fica sempre antes da frente da casa na ordem de desenho (senão um poste atrás dele o empurrava
    para depois). Com você fora, a casa não abre a janela transparente para quem está dentro: só o nome aparece.
  - A porta de enrolar da casa que dá para entrar fica quase toda aberta, e o balcão pintado na porta sai (o balcão
    de verdade está lá dentro).
  - O mapa (piso, paredes na colisão com o vão da porta, móveis) e o lugar da Xiovanna atrás do balcão são do
    [mundo]. A posição dela fica em `data/npcs.json`. Testado numa cópia minha do mapa.
- **Semáforo quebrado (13/11, pedido do dono: "coloca um semáforo aí quebrado saindo faísca").** `semaforo` no mapa
  (ponto: `altura`, `olhando` em graus, `quebrado`, `faiscas`) vira `map.trafficLights` e um `TrafficLight` com `rig`
  (props.js): poste cinza de São Paulo com ferrugem e cipó, o braço sobre a rua (vai para o lado que tem asfalto a
  3 m) entortado para baixo, a caixa de luzes preta com anteparo amarelo pendurada torta por dois fios, lentes
  apagadas com pala (a verde trincada), a caixinha de força aberta com fios coloridos e um fio solto descascado. A
  amarela pisca falhada (~a cada 4 s, `draw`); as faíscas são partículas do mundo (`faisca` cai e quica no chão,
  `clarao` é o estouro), de `sparkPoints()`, de 1,4 a 5 s, às vezes duas seguidas (`World.update`).
- **Mata nova, entrega 2 (13/11):** tudo em `js/world/flora.js` (carrega depois do `props.js`; está nas três listas
  de scripts: `view-scripts.json`, `clareira.html`/`index.html` e `src/client/novo/arte.ts`).
  - **Como liga:** `PD.flora.tree[espécie]` desenha tronco e copa (o `TreeTrunk`/`TreeCanopy` perguntam primeiro a
    ela) e `PD.flora.small[tipo]` desenha os objetos pequenos (o `Small` pergunta a altura, se segura o jogador, a
    sombra e o desenho). Sem o `flora.js` carregado, sai o desenho antigo.
  - **Plano de cada planta:** onde fica cada folha é sorteado pela posição (`plan`), e o mesmo plano dá o desenho e a
    caixa justa da imagem guardada.
  - **Folhas:** `pinnate` (folha em pena: palmeira, xaxim, samambaia; recorte, folíolos pendendo, metade da sombra
    escura) e `paddle` (remo: bananeira, helicônia; talo, nervuras e rasgos). A embaúba tem folha em mão
    (`palmLeaf`): lóbulos de ponta redonda num plano inclinado; vista por baixo, sai quase branca.
  - **Espécies:** jerivá (11 folhas em arco, bota de bases velhas, folha seca pendurada, cacho de coquinhos);
    embaúba (galhos em candelabro saindo do tronco em alturas diferentes, guarda-chuva de 6 a 8 folhas em cada
    ponta); xaxim (tronco grosso de fibra, 13 folhas rendadas, saia seca, báculos); bananeira (folhas em leque, uma
    velha amarela e rasgada pendurada no tronco, cacho com pencas para cima e o coração roxo, filhotes no pé).
  - **Pequenos:** arbusto (4 a 7 tufos recortados, como as copas, e galhinhos; três tons: vila, mata e mata
    fechada); bambu (16 a 20 colmos com nós que sobem retos e abrem em arco no alto, raminhos de folha fina; segura
    o jogador e fica transparente se esconder alguém); samambaia, helicônia (brácteas vermelhas em zigue-zague com a
    ponta amarela), taboa (com 3 espigas) e cogumelo (cor do `brilho` do mapa).
  - **Rente ao chão:** deque e pinguela vão em `world.flats`, desenhados logo depois do chão (o herói passa por
    cima). O chão do mapa novo não tem altura, então o tampo fica no nível 0 e a estrutura desce para dentro da água
    (estacas com a roda d'água; a pinguela é um tronco com o corte e os anéis do lado da câmera).
  - **Brilho:** `PD.flora.glows(mapa)` lista cogumelos e véus; a `_drawGlows` (`view.js`), na mesma camada pequena do
    escuro, abre um buraco no escuro em volta de cada um e tinge o ar da cor do brilho, respirando devagar. Só
    aparece onde a área tem escuro ou neblina.
  - **Véus** (`_drawVeilMotes` em `view.js`, ideia do [mundo]): além do brilho no chão, 3 a 6 luzinhas sobem devagar
    (vaga-lumes espirituais) e três faixas finas de luz (a "cortina" entre os mundos) pulsam a cada 4 s. A força vem
    do raio: o círculo (3 m) é o mais forte, a ponta do deque (1 m) a mais discreta. `coluna` (m) no véu do mapa deixa
    a coluna mais alta (para a Ilha do Véu do Mapa 02, vista de longe). Fracas e pequenas, para não atrapalhar o combate.
  - **Imagens só perto da tela** (`props.js` e `world.js`): antes, o jogo fazia a imagem de todos os objetos do mapa
    de uma vez (ao entrar e a cada zoom). No mapa da mata nova (1.107 objetos) isso travava ~2 s e as imagens somavam
    238 MB no celular e 325 MB no PC (o iPhone tem limite perto disso). Agora:
    - `bounds` sai da caixa (`screenBox`), sem fazer a imagem;
    - o que está fora da tela não é desenhado;
    - a imagem é feita quando o objeto chega a meia tela da borda, e solta quando fica a mais de uma tela;
    - depois do zoom, as imagens velhas saem esticadas e são refeitas aos poucos (~6 ms por quadro, no mínimo 2).
    - Medido no mapa novo (PC/celular): entrar 0,11/0,16 s; memória 48/19 MB parado e 70/51 MB depois de
      atravessar o mapa; tudo nítido 2 a 3 quadros depois do zoom. O que ainda pesa no zoom é o chão, que se
      redesenha em pedaços (~160 ms no primeiro quadro no celular de teste): fica para depois.
  - **Quadros por segundo no mapa novo** (teste sem placa de vídeo, PC/celular): lago 38/37, bananeiras 36/33, mata
    profunda com escuro, neblina e brilho 31/27–34. Prancha de conferência: `prancha-flora.cjs` no scratchpad.
- **Xiovanna, a vendedora da Budega (13/11):** `js/creatures/xiovanna.js`, registrada com a chave da NPC
  ("budega"). A PD.View usa criatura também para NPC. Feita com bolas, como as criaturas, porque o corpo de gente
  (`body.js`) é o modelo único do herói, com mais de 60 pontos presos às medidas dele. As fotos de referência do dono
  NÃO vão para o repositório.
  - **Visual:** morena; black power grande e uniforme preto da Budega (jaqueta de zíper, capuz, escudo dourado no
    peito, emblema na manga); jeans e tênis branco.
  - **Cabelo:** uma nuvem de bolas numa casca (Fibonacci), com um buraco no rosto. A cada quadro, a nuvem se divide
    pela profundidade da câmera: o que está atrás da cabeça vai antes dela, o resto depois. Desenhado inteiro antes,
    a nuca ficava careca de perfil; inteiro depois, a parte de trás caía em cima dos olhos. Cachos colados no alto da
    cabeça fazem a linha do cabelo.
  - **Rosto:** decalques com olho, íris, delineado, sobrancelha, nariz e lábios.
  - **Gestos:** vira o corpo e a cabeça para o herói a menos de 6 m e acena quando ele chega a 4 m. De vez em quando
    leva a mão ao cabelo, como na foto, e gesticula quando fala (`view.say` chama `talk`).
  - Prancha: `prancha-sagui.cjs ... budega`.
- **Logo da Budega:** `budegaLogo` em `props.js`, desenhado em código com a letra Georgia, como o título do jogo.
  É um escudo dourado com "BUDEGA" e "DISTRIBUIDORA" numa faixa, arabescos e um círculo com o hibisco. Saem a
  palavra "tabacaria" (pedido do dono) e o narguilé (nada de tabaco no desenho). A casa com `logo` = "budega" (do
  [mundo]) ganha a placa em pé na beirada da laje, presa por dois ferros, no lugar do letreiro de texto.
- **Copas e monstros:** a "janela" que deixa ver através da copa abre em volta de **cada** personagem coberto (herói,
  outros jogadores e monstros), não só do herói: antes o sagui na mata fechada sumia (só o nome aparecia).
  `world.js` junta as janelas em `o.hideWindows` e recorta uma de cada vez.
- **Etapa 4a** (mata e lago, do [mundo]): `tmj.js` lê `tronco-caido` (caixa; deita no lado comprido),
  `aguape` (ponto com `raio`), `capivara` (ponto com `olhando` em graus; enfeite, sem colisão), `pedra` com
  `ancestral` e a `cor` das formas do chão (o lago usa '#2f6f6a'). Desenhos em `props.js`: tronco caído (cilindro
  deitado: na tela tem sempre a largura do diâmetro, então um traço grosso faz o corpo; a ponta virada para a câmera
  mostra os anéis), aguapé (círculos deitados na água e flor lilás), capivara (bolas ao longo do corpo, que ficam
  redondas de qualquer lado; com fatias de pé ela virava listras olhando a 135° e 315°) e o símbolo aceso da Pedra do
  Véu. A água ganhou reflexo claro na margem. Prancha de conferência em `scratchpad` (não fica no repositório).
- **Crítica do dono à mata (13/11, repassada pelo [mundo])**: "bolas verdes enormes empilhadas que enchem a tela" e
  lago "cheio de pintinhas". Copas: cachos menores numa cúpula achatada (10 + raio/32 cachos), tom pela altura,
  tufos de folha do lado da luz com beirada escura, vãos escuros do lado da sombra, contorno verde quase preto
  (`CANOPY_INK`) e cada árvore com um tom um pouco diferente. Água (`Ground._water`): sem pintas; funda e escura no
  meio, clareando em 16 faixas até a margem, espuma na beira e marolas finas. A quantidade de árvores, as trilhas sem
  copa, tirar os ipês e a margem do lago são do [mundo].
- **Vila da etapa 4b** (lista final do [mundo], aprovada pelo dono em 13/11): `tmj.js` lê `casa` (→ `map.houses`,
  classe `House`: frente ao sul, 1 ou 2 andares, `cor` ou `bloco` aparente, `caixaDagua`, `pixo`, `abandonada` com
  janela quebrada, porta de tábuas e cipó, ferros esperando a próxima laje nas de 2 andares; a Budega é `comercio`
  'vendinha' com porta de enrolar meio aberta, prateleiras acesas sem nada de tabaco, letreiro e toldo listrado), `poste`
  alto (≥ 5 m → poste de concreto `Pole` com luminária; `fiacao` liga os postes mais perto de cada ponta da polilinha),
  `poste-praca`, `banco` de madeira com encosto do lado contrário de `olhando`, `mesa`, `fogueira` (pedras, lenha e
  brasa no desenho guardado; chamas, faíscas e clarão no chão a cada quadro em `Small.draw`), `orelhao`, `lixeira`,
  `carro` com `mato` (carroceria, cabine, vidro quebrado, ferrugem, pneus murchos e tufos de mato) e a `sibipiruna`
  (verde com florzinha amarela miúda). Portão `aberto`: as duas folhas giradas 75° para o lado da câmera. Chão:
  `praca` em pedra portuguesa com as ondas pretas, `faixa` de pedestre gasta e `calcada`. Testado com o mapa do ramo
  `mundo/etapa-4b` (sem commitar o mapa, que é do [mundo]); com o mapa de hoje nada muda.
- Falta: o Curupira no 2.5D (hoje sai o protagonista com outra roupa), as atmosferas (Etapa 5, com a neblina da
  mata profunda) e a luz do poste.
- Conferido em 12/11 no `/?novo` (PC 1600x900, Pixel 7 em pé e deitado): sem erros na página, tocar no Curupira
  funciona nos três (no deitado o chat segurava o toque) e os balões não se cobrem.

### Interface nova do jogo 2.5D (13/11): a HUD da imagem do dono
- **Pedido:** "o menu do jogo está horrível, tem que fazer conforme o gráfico do jogo", depois a imagem da HUD
  ("Quero a hud nessa pegada") e "mexe dentro da mochila também para parecer o personagem real". Escolhas dele antes
  da imagem: ícones no traço do jogo, botões maiores e mais vivos, redesenhar o personagem no menu.
- **Molduras** (`public/assets/ui/hud`): recortes da imagem do dono, limpos por um script Python (fora do repositório):
  números, ícones e a silhueta saíram; no retrato, o círculo e as três barras viraram **furos** (o herói e as barras
  ficam por baixo, a madeira por cima). Medidas em px dessas imagens, usadas no `style.css`: retrato 654x315 (círculo
  em 141,115 raio 83,5; selo do nível em 115,210; barras vida 279..583 x 56..85, energia 286..561 x 103..130, XP
  289..554 x 148..174); habilidades 887x234 (quadrado i em x = 123 + i·107,8, y 103, 93x95; etiqueta da tecla 105 px
  abaixo do topo do quadrado); frascos 282x139 (anéis em 85,67 e 205,67; selo de quantidade a +36,5 e +27,5 do meio).
  O degradê de cada barra foi medido na imagem (uma cor por linha).
- **Escala:** `--hs` (retrato) e `--as` (barra e frascos) no `body.jogo-novo`: 0,66 em tela grande, 0,56 e 0,48 nas
  menores; no celular, retrato 0,40 (0,34 em pé) e os botões soltos em quadros dourados (`--ring`). Tudo do jogo novo
  está em `body.jogo-novo` (o `main.ts` marca o body; o `?antigo` continua com o painel de antes).
- **Herói no retrato e na mochila:** `prototipos/pindorama-25d/js/portrait.js` (`PD.portrait(canvas, { mode, yaw })`):
  o mesmo boneco do jogo, parado e assentado, olhando a 25° ('head') ou girando no clique na mochila ('full'). Sem
  armadura nem arma. O lado do jogo é `src/client/heroPortrait.ts`.
- **Ícones pintados:** `src/client/paintedIcons.ts` (canvas 128 px: halo, contorno escuro, degradê). Habilidades com
  fundo escuro colorido (verde, fogo, água, céu); itens com fundo transparente. Os itens sem pintura usam a pixel art
  aumentada 4x (`itemArt.ts`), para a tela reduzir liso. A defesa (botão do motor) pega o ícone pela variável
  `--icone-defesa`, que o `ActionBar` põe no body.
- **Falta:** a [estrutura] chamar `hud.setEnergy(valor, máximo)` (a barra azul mostra cheia até lá); pintar os outros
  itens; levar a loja e a conversa para o mesmo painel. A barra embaixo do pé (do `combat.ts`) é verde; a da HUD é azul
  como o arco da defesa: combinar com a [estrutura].

### Placa do parque e casa com árvore de dentro (13/11, pedidos do dono)
- Placa grande (`bigSign` no `fundo.js`): tábua de 1,2 a 2 m em postes de 2,1 m; cipó só nos postes (até a tábua) e
  nas pontas; o pé dela no chão é a tábua inteira (`x0..y1` no `tmj.js`): com o pé de um ponto só, o gradil passava na
  frente dela.
- Casa com `arvoreDentro` (`treeThroughRoof` e `treeOpenings` no `props.js`): o buraco escuro com a parede de dentro
  da borda do fundo; o tronco abaixo da laje é recortado pelo contorno do buraco (senão o pé dele aparecia em cima da
  laje, na frente); a borda da frente quebrada por cima; três ferros tortos; nada de raiz nem de placa solta; as
  plantas da laje ficam a 1,7 m do tronco; galhos e cachos de folha pelas janelas e pela porta de tábuas.

### O herói no combate (13/11): a revisão 17 ligada no jogo
- O estilingue e a defesa da revisão 17 (`js/slingshot.js`, `js/guard.js`, que o dono trouxe do ChatGPT) já estavam no
  protótipo; no jogo o motor mandava as ações (`sling-pull`, `shoot`, `sling-cancel`, `guard`, `guard-end`,
  `guard-break`, `block`, `hurt`) e o desenho ignorava. Agora `PD.View._personAction` traduz cada uma: `S.start` com
  `attackHeld` (o motor diz quando soltar), `releaseRequested` no `shoot` (o tiro rápido e o de outro jogador começam a
  puxada já no `minDraw`), `input.guardHeld/guardDir` no `_drive` (a energia do desenho fica sempre cheia: a de verdade
  é a do servidor; quebra só com `guard-break`), `recoil` no bloqueio.
- **Forquilha só na hora do tiro** (escolha do dono): `equip('maoE', 'estilingue')` ao começar a puxar e `unequip` quando
  o ataque termina. A regra "sem arma no personagem" vale fora do tiro.
- **Tranco do golpe só parado** (`still()`): andando, o servidor não para o jogador; com o tranco de 0,22 s o desenho
  ficava para trás e depois corria para alcançar.
- Sons em `sfx.ts` (`charge`/`stopCharge`, `block`, `guard-break`, `pull-full`), receitas da revisão 17; quem chama é o
  motor (pedido à [estrutura]). Ainda não: o desmaio (`faint`/`revive`) da gente no desenho e a mira seguindo o mouse
  durante a puxada (o motor ainda não manda o ângulo: o herói puxa para onde olha e vira ao soltar).

### Parque antigo (13/11): `js/world/parque.js` e variações dos objetos da vila
- Do mapa do [mundo] (`mundo/parque-antigo`): `bebedouro` e `academia` são novos (`parque.js`, em `PD.city.small`); o
  `banco` com `material: 'concreto'` (`_concreteBench`), a `lixeira` com `mato` (`_parkBin`, verde) e o `poste-praca`
  com `apagado`/`torto`/`cipo` (`_oldLamp`) são variações no `props.js`; a `placa` com `tamanho: 'grande'` é a de
  madeira em dois postes (`bigSign` no `fundo.js`), virada para a rua (+x) e com a tábua a 2,5–3,2 m (antes, a 1,4 m,
  ficava atrás do pilar do portão); a `calcada` em polígono com `desenho: 'placas'` vira placas soltas (`loosePlates`
  no `street.js`; `quebrada` tira umas e lasca quinas).
- Os canos da academia são 1,45× a medida do aparelho (de longe, o cano fino sumia).
- Desempenho: na clareira (44; 43) o teste dá ~35 quadros por segundo com e sem os objetos do parque (o lugar já é
  pesado no computador de teste; o custo do quadro fica em 7–8 ms).

### Tela inicial: uma lua só (13/11)
- O dono achou três luas ("ficou 3 lua kkkk"): a cheia do fundo, uma pequena ao lado do prédio alto e a vermelha de
  trás do logo. Ficou só a cheia. Em `public/assets/ui`: a pequena foi coberta com o céu em volta (o prédio continua),
  e a vermelha saiu do logo separando o que é lua do que é prédio ou folha (a lua vira transparente; fica um brilho
  quente baixo, de cidade). As imagens originais do dono continuam em `docs/referencias/tela-inicial-*.webp`.

### Etapa 4c (13/11): o fundo do Capão (`js/world/fundo.js`)
- Os tipos novos do mapa do [mundo] (`mundo/etapa-4c`) viram `map.props` no `tmj.js` e o desenho fica no `fundo.js`,
  pendurado em `PD.city.small` (como as plantas da flora): `trave`, `muro`, `viaduto` (+ `viaduto-mureta`, a mureta da
  frente), `pilar-viaduto`, `vagao` (o `trem` vira um por vagão), `cipo`, `onibus`, `barreira` e `placa`; a `casa` com
  `arvoreDentro` ganha a árvore rompendo a laje (`treeThroughRoof` no `props.js`) e a `arvore` com `abraca: 'viaduto'`
  manda as raízes para o pedaço do viaduto mais perto (`hug`).
- **Pedaços:** muro e viaduto de até 4 m e ônibus de até 6 m (`pieces` no `tmj.js`); cada pedaço sabe o todo (`whole`)
  e desenha a sua parte do mural/das janelas, sem risco de tinta na emenda. Na beira leste do mapa o viaduto segue 9 m
  mata adentro e some aos poucos (`extend` + `fadeOut`).
- **Ordem de desenho:** `lift` no `behind()` do `world.js`: com os pés se cruzando, o de baixo primeiro (pilar 0,
  tabuleiro 1, mureta da frente e vagões 2). A mureta da frente é outro objeto para ficar na frente da base do trem.
- **Câmera:** o tabuleiro fica a 8 m: na tela ele sobe ~550 px acima do chão dele (zoom 0,8), mais que a meia tela.
  Só aparece com o herói embaixo, na beira norte. Para fotografar de longe: `PD.view.focus({ x, y })` num ponto ~10 m
  ao norte (o `scratchpad/exptools/foto-alto.cjs` faz isso). Se o dono quiser ver o trem andando pela vila, o caminho
  é o [mundo] baixar o viaduto (uns 5 m) ou trazê-lo mais para o sul.

### Casas com interior (14/11): `js/world/casas.js` e o Joaquim (`js/creatures/gato.js`)
- Planta aprovada pelo dono (`docs/referencias/casas-interior-planta.jpg`; os alvos `casa-*-dentro.jpg` dão o clima).
  O mapa é do [mundo] (`mundo/casas-interior`); o `tmj.js` lê `portaDe`/`portaAte` (`door`), `morador` (`resident`),
  os móveis (`HOME_FURNITURE`), o `gato`, o `entulho` do chão (vira objeto em pé) e a `arvore` com `dentroDaCasa`.
- **Foco dentro de casa** (pedido do dono: "focar apenas dentro dela, sem ficar meio transparente o que tem por
  volta"): com o herói dentro, o contorno da casa inteira (chão e paredes até o alto) é a janela; o que não é da casa
  (prédio vizinho, árvore da calçada, poste, fiação, bandeirinhas, quem está lá fora) não entra nela e, fora dela, a tela
  fica escura (`World._focusOf`, `world.js`). A câmera vai para o meio da casa e só aparecem os nomes de quem está dentro
  (`view.js`). Vale também para a Budega. A primeira versão deixava o que estava na frente meio transparente: o dono
  não gostou.
- Móveis (só com a casa cortada, `INSIDE_KINDS`): pia, fogão com panela e frigideira, filtro de barro no banquinho,
  geladeira de casa (branca, com ímãs; a da Budega continua a de bebidas: `home` no `tmj.js`), mesa com toalha xadrez e
  duas cadeiras, estante com a TV de tubo de antena, sofá (`olhando` 270 = de costas; `croche`; `rasgado` e `mato`),
  cristaleira com a louça, mesa redonda de crochê com as flores, máquina de costura de pé de ferro vazado, cama com
  colcha de retalhos (a cabeceira é desenhada antes de tudo), samambaia no banquinho (a espada-de-são-jorge é a da vila)
  e o entulho com a cadeira caída. Chão: cerâmica, taco, cimento rachado; o tapete; o colchão velho (a espessura
  desenhada no chão, como o meio-fio).
- Paredes de dentro por morador (`PD.casas.innerWall`): família (azulejo verde na cozinha, janela da pia, santinho,
  calendário, relógio, fotos), vó (papel de florzinha, lambri, oratório com a vela, fotos ovais, crucifixo, janela com
  cortina de renda) e ninguém (tijolo, reboco caindo, escorrido, cipó). Sem morador: as da Budega.
- Porta: a desenhada fica no vão do mapa (1,2 m) e aberta (a folha para dentro); a da abandonada, arrombada.
- **A árvore de dentro da casa abandonada:** o tronco só aparece com a casa cortada; a casa abre o buraco da laje em
  volta dela (o toco saindo do buraco; a copa é a da própria árvore, por cima da casa). O pé e as raízes são **os da
  Figueira da Esquina, que o dono aprovou** (ele achou a primeira versão com "o mesmo bug da outra árvore": raiz chata
  e tronco que não se fundia nela): `t.inside` usa `_figPaint` e `breaks: true`; em `street.js`, `home` faz as raízes
  ficarem do lado de dentro das paredes (e fora do sofá), as curtas saem (viravam ponta rombuda) e o chão quebrado é
  recortado nas paredes; em `ground.js`, o chão quebrado dela vai depois do piso da casa e o colchão e o tapete voltam
  por cima.
- **Joaquim** (`PD.gato.draw`): bem pequeno, creme com as pontas laranja-claras de flame point, olhos azuis (fechados,
  dormindo), nariz rosa; dorme enrolado no sofá da vó: respira, mexe uma orelha, bate a ponta do rabo, solta "z"; o
  nome em verde-água em cima. Desenhado a cada quadro (`live` no `Small`). Acordado (andar, miar, carinho), veja
  "Joaquim que anda" logo abaixo: dormindo, ele continua sendo este desenho.
- Conferi com o mapa do [mundo] numa cópia à parte (`foto-casas.cjs`: leva o herói à porta pelo painel e entra
  andando): PC e celular em pé.

### Arco de Bambu (14/11): o desenho
- Decisões do dono (13/11): o arco fica **sempre na mão** quando equipado; o mesmo botão do estilingue; sem munição.
- `js/slingshot.js`: o item `arco` (mão esquerda, ocupa as duas) e as regras dele (`BOW_RULES`: carga de 1,5 s, a do
  servidor); `rulesOf(ch)`, `isBow(ch)`. Mesmo puxar e soltar do estilingue; a pose muda: o braço do arco esticado na
  altura do ombro, a mão da corda pinçando atrás da empunhadura (24 a 62 cm, com a carga), o cotovelo alto e para
  trás. `bowGeometry`: o eixo inclinado para a frente em descanso (a ponta de baixo longe do chão) e quase em pé
  puxando; os braços de bambu curvam com a puxada; a corda vai das pontas ao ponto pinçado; a flecha (74 cm, penas
  vermelha e branca, ponta de pedra) sai do entalhe pela empunhadura. O `renderer.js` desenha o arco no lugar do item
  genérico, como a forquilha.
- `view.js`: `gear(id, gear)` (o motor chama ao aparecer e na mensagem `gear`): com `weapon: 'arco'`, o arco fica
  equipado; o `arm()` do tiro usa o arco em vez da forquilha; no fim do tiro a forquilha sai e o arco fica.
- `src/client/novo/projectileArt.ts`: `drawProjectile` (a flecha voando, com a sombra e o rastro), `projectileEnded`
  e `drawLanded` (cravada no chão, meio enterrada, com a poeira da batida; some em ~2 s) e `landedBusy` (a camada do
  combate se esconde quando não tem nada: com flecha no chão ela tem que continuar). O fim do tiro vem do servidor
  (`shot_end`, `hit` 0 = não acertou ninguém): é ali que a flecha crava (o tiro some antes do fim do alcance do
  desenho). A idade negativa (o relógio do quadro uns ms antes) conta como recém-cravada.
- Ícones (`paintedIcons.ts`): `arco` (o item: bambu com os nós, a empunhadura e uma pena vermelha) e o botão `bow`
  (o arco com a flecha, no brilho verde dos botões); `weaponActionIconUrl` (`actionArt.ts`) e `ActionBar.setLook` (`ui.ts`).
- O retrato da mochila recebe `weapon` (`heroPortrait.ts` → `PD.portrait`): o herói segura o arco.
- Conferi com uma ligação local só para o teste (o `icone` `arco` e as chamadas no `combat.ts` e no `engine.ts`,
  desfeitas depois): o painel dá o arco, a mochila equipa, o arco vai para a mão, o botão vira "Arco", a flecha voa e
  crava. Receitas: `arco-pose.cjs` (`view.gear` direto), `arco-jogo.cjs`, `arco-defesa.cjs`.

### Joaquim que anda (14/11): `js/creatures/gato.js`
- A [estrutura] fez o comportamento (o bicho `pet` `joaquim`, protocolo 30). Na PD.View: `canDraw('pet', 'joaquim')`
  (aí o motor para de desenhar o gatinho provisório e manda o bicho para a view), o `asleep` de quando ele aparece
  (`setAsleep`) e a cor do nome (`NAME_COLOR.pet`, a dos NPCs).
- **O dono achou a primeira versão "bem feia"** (bolas e tubos com contorno grosso, como bicho de bexiga: pernas de
  salsicha, rosto de manchas chapadas, rabo de antena). Refeito **pintado como o gato enrolado aprovado**: o esqueleto
  3D continua (poses, IK das pernas, passo de gato), mas o desenho é próprio (`paintAwake`), e as bolas da criatura só
  servem para a sombra e a caixa.
  - Corpo: duas partes (traseiro e peito, cada uma o fecho convexo de círculos) com um contorno só em volta das duas
    (cada parte riscada com o dobro da tinta e o recheio por cima): sobra a cintura e as costas descem do quadril para
    o ombro. Peito fundo, barriga recolhida, degradê de cima (claro) para baixo; de lado, um risco suave na frente da
    coxa.
  - Cabeça de gatinho (grande): crânio, bochechas e focinho curto num contorno só, degradê com a luz. O rosto é pintado
    no plano que encosta na cabeça (encurta quando ela vira): máscara laranja esfumada com três listrinhas, a faixa do
    nariz, olhos em amêndoa azuis com pupila, brilho e pálpebra mais grossa (fechados: o risquinho do gato dormindo;
    ele pisca de vez em quando), nariz rosa, boca em "w" (aberta no miado), bigodes brancos quase deitados.
  - Orelhas grandes em concha (rosadas por dentro, a ponta alaranjada): a de trás antes da cabeça, a da frente
    depois, sem risco na base (emenda na cabeça).
  - Pernas finas que afinam (`limbPath`), atrás do corpo (as do lado de lá mais escuras) e a patinha oval; sentado, as
    da frente vão na frente da barriga, nascendo do peito (o começo some no pelo). Rabo que afina, do creme ao laranja,
    com aneizinhos, em "ponto de interrogação".
- Dormindo, é o desenho aprovado (`sleeping`); a troca enrolado ↔ acordado esmaece em ~0,1 s.
- **O rabo (pedido do dono: estava ruim sentado e deitado de frente)**: `paintTail` corta o rabo onde ele passa para
  trás ou para a frente do corpo (o pedaço de trás vai antes do corpo, o da frente depois; as emendas sem risco). Dormindo,
  ele é mais fino, afina até a ponta e dá a volta **pelo lado de quem olha** até perto do focinho (antes ia pelo lado de
  lá e era desenhado por cima do gato, como um cachecol). Sentado, dá a volta no chão por fora do corpo e termina na
  frente das patinhas, também pelo lado virado para a câmera (`tailSide`, que só muda com ele em pé). Enrolando ou
  acordando, o rabo fica atrás do corpo (no meio da passagem ele cruzava o gato como um cinto).
- Em cima do sofá (`perch`, 46 cm): desenhado depois do sofá (`lift`), a sombra vai no assento
  (`PD.creatures.drawShadow` com a altura). O pulo (`dash`) é um arco de 0,42 s. "miau!" e o coração saem do lado da
  cabeça, abaixo do nome.
- Erros que já aconteceram: o "para cima" da cabeça era frente × lado ao contrário (orelhas embaixo do queixo); pontos
  do rabo quase em cima um do outro na tela torciam a ponta (`limbPath` tira os repetidos); o rabo na sombra virava
  pontilhado e depois um risco comprido (o rabo não faz sombra).
- Conferir sem entrar no jogo: `node ferramentas/prancha-joaquim.cjs saida.png poses` (todas as poses em 4 direções e
  nos tamanhos do PC e do celular) e `... saida.png tiras` (o passo, o pulo, acordar e deitar em quadros). No jogo:
  entrar na casa da vó (Capão, porta perto de x 65, y 40) e esperar ele acordar; conferi no PC e no celular deitado,
  com dois visitantes, sem erros.

### A lista do dono de 14/11, lote 1 (o que está feio ou com defeito; na main em 14/11, com o "pode" do dono)
- **Cama do quarto do Joaquim** (`casas.js` `small.cama`): a cabeceira fica do lado oposto ao `olhando` (0 = pés para
  o leste e cabeceira em x0, o padrão sem `olhando`; 90 em y0; 180 em x1; 270 em y1); a do lado da câmera vai por
  último. O [mundo] virou a cama no mapa (`mundo/cama-vo`); os dois ramos entram juntos. O crucifixo foi para o meio da
  cabeceira (x 70,15).
- **Braço do arco** (`slingshot.js`): a primeira versão (14/11: de lado para o alvo, `BOW_TURN` 75°) foi refeita em
  16/11 — veja "O braço do arco, redesenhado", mais abaixo. Continuam valendo: a cabeça olhando ao longo da flecha
  (`look.bowHead`, lido no animator) e o arco virado para onde a flecha vai (`look.bowDir`).
- **Esquiva** (`animator.js` `startRoll`/`_rollPose`, `view.js` ação `dash`): no jogo ela era um pulo de 3 m sem
  movimento. Agora é um rolamento de 0,5 s: a pose encolhida e o giro da queda do rig (`fall`), com o pé da pose
  recuando para o meio da bola seguir reto; a vista não teletransporta enquanto rola. A esquiva curta do protótipo
  (`_startDodge`) não mudou (os testes do protótipo passam).
- **Entrar e sair das casas** (`props.js` `CUT_TIME`, `world.js` `focusHouse`, `view.js`): 0,6 s com começo e fim
  suaves; saindo, a casa continua em foco até o telhado voltar; o escuro fecha e abre como íris; a câmera volta junto;
  o herói que sai não é cortado.
- **Entrada da Budega** (`props.js` `shopDoorway`/`shopDoorRect`; o mapa é do [mundo], `mundo/budega-entrada`): a
  frente da vendinha que dá para entrar era uma parede de prateleiras pintada (o herói parecia atravessá-la). Agora é
  o vão da loja no lugar do `portaDe`/`portaAte` (sem eles, a frente toda menos 34 cm de cada lado): a porta de aço
  enrolada na caixa em cima, os trilhos dos dois lados, a soleira de cimento e, lá dentro, o que o mapa tem nesses
  lugares (piso de ladrilho, geladeira à esquerda, balcão com a caixa à direita, prateleiras no fundo, a luz da
  lâmpada). O musgo e o cipó da fachada são recortados fora do vão. O orelhão com `poste: true` (`tmj.js` acha o
  `poste-praca` mais perto, até 1,5 m: `poleAt`) liga dois braços de ferro até o poste. Os caixotes de frutas, a
  lousinha e o degrau com capacho dependem da resposta do dono à proposta do [mundo].
- **Floresta dentro das casas** (lote 2): veja a seção do lote 2, abaixo.
- **Zoom e conversa que travavam** (pedido da [estrutura], que mediu): feito depois do lote 1 (a seção abaixo).

### Depois do lote 1 (14/11): controles, zoom e flecha (na main em 14/11, com o "pode" do dono)
- **Pulo e botão de pular** (`view.js` ação `jump` → `jumpPulse`, que liga o `input.jump` antes do `ch.update`;
  `ui.ts` `ActionSlot` 'jump'; `paintedIcons.ts` `paintJump`): no computador, o 6º quadrado da moldura; no celular, em
  cima da coluna da esquerda (`right: 76px`: em cima da direita fica a mochila).
- **Etiqueta das teclas** (`ui.ts` `data-key`, `style.css`): "Espaço" vira a barra de espaço, "Shift" a seta; nomes
  compridos com a letra menor (`.long`, `.longer`). O "Como jogar" (`index.html`) com as teclas novas.
- **Zoom sem travar** (`ground.js`, `props.js`, `world.js`): o chão guarda os pedaços do zoom anterior e os estica
  enquanto o zoom muda (`World.zoomSettling`, 180 ms); os novos só com o zoom parado, uns 6 ms por quadro, com os
  velhos por baixo. Os objetos e a casa cortada também esticam; `rasterNow` pinta cada imagem nova na hora em que é
  feita (a conta do quadro fica certa). Medir: `zoom-medir.cjs` e `zoom-quadros.cjs` (scratchpad).
- **Flecha que para sem acertar ninguém** (`src/client/novo/projectileArt.ts`; o `combat.ts` chama
  `projectileEnded(kind, x, y, angle, now, stuck?)`): `chao` (sem `stuck`, ou `borda`: crava no chão), `cravada` (a
  madeira de `HOLDS`: na altura `stuck.z`, treme, lascas, furinho), `quica` (o resto: faíscas, cai deitada com
  sombra), `agua` (a flecha mergulha, cortada na linha da água, com o esguicho, a coroa de gotas e três anéis com
  contorno escuro, para não sumir no brilho do lago; a [estrutura] manda `on: 'agua'` também no fim do alcance em
  cima da água) e `poeira` (a pedra do estilingue). Vindo até uns 30° da direção da câmera
  (`towardCamera > 0.87`), ela bateu do lado de lá: só as lascas ou as faíscas aparecem (a camada do combate fica por
  cima de tudo, então o tronco não tem como cobrir a haste). Teste: `tests/projectileArt.test.ts`; no jogo:
  `arco-alvo.cjs` (scratchpad), na Figueira (36,5; 38).


### As 6 etapas de 15/11 (com o "pode" do dono: "pode, seguir para terminar as 6 etapas"; cada uma vai para a main)
1. **Mini mapa e mapa do M** (feito): o visual do `src/client/novo/mapWindow.ts` passou para a [arte] (a [estrutura]
   fica com a grade do explorado, o `draw(picture, me, markers)` e os ganchos). `TURN` = 45° (no sentido do relógio,
   como a câmera: o norte fica para cima e para a direita); `MapPicture.draw(..., turn)` gira o chão e a neblina em volta
   do meio de `dest` e põe os NPCs, os ! e ?, os nomes e você (o ponto dourado pulsando, 1,6 s) em pé com o `at()`
   girado; `FOG` 0,62. `Minimap`: canvas de 172 px (PC; 100 px no celular), o mapa num círculo e o anel pronto
   (`paintRing`: madeira trançada, a faixa vermelha tribal à esquerda como a do retrato, folhas e o N), refeito só
   quando muda o tamanho. `MapWindow`: o canvas é a caixa do mapa girado (um losango), a moldura da mochila (canto
   tribal). Conferir: `minimapa.cjs` (scratchpad).
2. **Caçador, parte rápida** (feito): os temas `ambar` e `espirito` e os 5 ícones em `paintedIcons.ts`
   (`paintedSkillIcon(id)`, com `iconArrow`); o `skillIconUrl` da [estrutura] (que liberou) usa o pintado quando tem; o
   `ActionDef.icon` e o `setLook(slot, { iconUrl })` no `ui.ts`; o "Como jogar". Conferir: `cacador.cjs` (scratchpad;
   o personagem de teste com nível 6 e a missão `saguis_encantados` feita no banco de teste). Os quadrados a mais na
   barra ficam para quando chegarem as outras habilidades.
3. **Os quatro bichos novos** (feito): `quati.js` (S 1,35; trote em diagonal, `sniff` com o focinho baixo, `windup`
   encolhe e `bite` abre o queixo), `tatu.js` (`tatu_bola`, S 1,7; `curl` junta as fatias numa bola de raio 15 e `roll`
   gira as faixas na investida; `block` e `dizzy` em relógios próprios, `blockT` e `dizzyT`, sem cortar o resto),
   `marimbondo.js` (5 vespas de 6 bolas; asas no `after`, que precisa do `this._cam`; uma sombra macia só, no `under`
   da primeira vespa; `dodge` espalha; morte própria: despencam em 0,3 s, antes do sumiço geral de 0,4 a 0,7 s) e
   `boitata.js` (`filhote_boitata`; segue o próprio rastro como a jararaca; bolas `noInk` nas cores do fogo, brilho
   `lighter` no chão, línguas de fogo de base azulada; `vanish` e a morte apagam em 0,6 s, igual ao `VANISH_MS` do
   servidor). Olhos à noite: `PD.creatures.eyes.night` (o dia e noite liga), `eyeColor(day)` e `eyeGlow(dayGlow)` para
   os bichos novos. Conferir: `node ferramentas/prancha-bichos.cjs saida.png 2` e, no jogo, `bichos-jogo.cjs` e
   `boitata-amanhecer.cjs` (scratchpad: menu ADM, fora da zona segura em 37,5; 35,5).
4. **Caçador, parte grande** (feito): `rainArt.ts` (arquivo da [arte], com o "pode" da [estrutura] para as trocas no
   `combat.ts`: os tipos `RainLook`/`RainAimLook` são estruturais, o `RAIN_LINGER_MS` sai daqui e o combate importa; a
   conta — spots, start/land, o filtro e o busy — e a faixa da Ancestral (`aim.line`) ficam no combate). Fases
   `rainTier(rank)`: madeira (1–2), ouro (3–4), espírito (5); tiers `WOOD`/`GOLD`/`SPIRIT` com anel, brilho, haste,
   ponta, penas (aletas preenchidas) e rastro. Pedra: sempre cinza, halo na cor da fase e `streak` (o risco). A mira:
   arco pontilhado (pico 1 + 0,18 × distância), anel duplo (escuro por baixo), anel de dentro tracejado andando, 8
   dentes girando e a estrelinha. A janela das Habilidades: só o CSS do `<style>` do `skillsPanel.ts` (as classes e os
   elementos não mudam: os testes do navegador clicam neles). Conferir: a prancha fora do jogo (`chuva/entry.ts` +
   `prancha.cjs` no scratchpad, com esbuild) e, no jogo, `chuva-jogo2.cjs` (copia as telas em tempos exatos depois de
   soltar o Q; estilingue e Arco de Bambu, 1/3/5 pontos) e `chuva-celular.cjs`. Ficou para depois (pedir ao dono): a
   pose de atirar para cima (o motor manda `shoot` com o ângulo; precisaria de uma ação nova da [estrutura]), os
   quadrados 2 a 5 da barra e o desenho da Flecha Ancestral.
5. **O desenho da floresta maior** (feito; o `mundo/floresta-maior` entrou na main junto): `world/sul.js` (depois do
   casas.js no view-scripts.json e no arte.ts). A paineira é `PD.flora.tree.paineira` (`BOTTLE` = o perfil do tronco;
   a copa usa o `H.crownPaint` com as cores `PINK` e um `crownPlan` igual ao do props.js para pôr as flores em cima dos
   tufos; `H.BARK.paineira`); o tapete de flores é um "flat" (`petalas`, empurrado pelo tmj.js para cada paineira) e as
   pétalas caindo vêm do world.js (agora com a cor da árvore, `flowers`). Objetos novos no `PD.city.small`:
   `parquinho` (`toy`), `cachoeira` (só `live`, com `paint() {}`: a água mexe), `cobertura` (`overhead: true` — o Small
   passou a aceitar — e `fades`), `pilar-cobertura` (o tmj.js faz os 4 a 0,6 m das beiradas, como as caixas do mapa),
   `bomba` e `pneus`. No props.js: `stationFront`/`stationDoorRect` (a casa com `station`) e o gradil `broken` com o
   plano das barras sorteado uma vez só (antes o contorno e o ferro sorteavam diferente). Conferir: `foto-lugar3.cjs`
   (scratchpad; `NOME` = um personagem que já existe, porque criar muitos seguidos esbarra no limite do servidor;
   `ALTURA`/`LARG` para a janela; `CIMA` para o recorte), por exemplo a clareira (30, 150), a cachoeira (18, 157) e o
   posto (83, 141).
6. **Dia e noite** (feito): no view.js, `setTimeOfDay` guarda `daylight`/`isNight` e liga o `PD.creatures.eyes.night`
   (sagui e jararaca passaram a usar o `C.eyeColor`/`C.eyeGlow` como os quatro novos; capivara e Joaquim não: são
   bichos mansos). No `_drawAtmosphere`, na mesma camada 4× menor do escuro da mata: `atm.night` amortecido (1,6/s; o
   "Virar noite" do ADM pula de uma vez), o azul (6, 12, 34) até 0,78 com o miolo de 1,6 a 8,5 m em volta do herói, e o
   laranja do pôr do sol (pico na luz 0,55). `_nightSources` (feito uma vez: postes com lâmpada, `poste-praca` acesos,
   fogueiras e as portas das casas com `morador`/comércio/interior, menos as abandonadas) e o boitatá aceso a cada
   quadro; `_drawNightLights` abre o escuro em parte (até 0,85) e tinge com a cor da luz. Lembrete: o "Virar dia" do
   ADM começa no amanhecer (a luz sobe em 60 s, o `TWILIGHT_MS`), e o anoitecer de verdade só acontece no fim do dia
   (o ADM pula direto para a noite). Conferir: `noite-jogo.cjs` e `noite-vila.cjs` (scratchpad); o pôr do sol na foto
   é forçado com `PD.view.setTimeOfDay({ light: 0.5, night: false })`.

### A Budega maior (15/11, com o "Ok, pode ir" do dono; o `mundo/budega-maior` entrou na main junto)
Igual às duas imagens aprovadas (`docs/referencias/budega-maior-fachada.jpg` e `budega-maior-dentro.jpg`). Tudo em
`js/world/budega.js` (`PD.budega`, depois do sul.js no view-scripts.json e no arte.ts):
- **Fachada:** a `casa` com `fachada: 'preta'` (mais `moldura` = a cor da moldura e `led`) passa a frente, o lado e as
  paredes de dentro para o `PD.budega` (`front`, `side`, `innerWall`); o props.js desvia no laço da frente, no lado e
  no `HouseBack`, sem musgo nem a placa de cima. A frente: a faixa preta com o escudo escuro, a vitrine de fundo amarelo
  com prateleiras pretas e o reflexo do vidro, a porta de enrolar aberta mostrando o fundo (nichos, a parede de grama
  com o escudo aceso, o piso branco e o balcão), a moldura amarela e as linhas brancas do LED. O escudo é
  `shield(ctx, cx, top, w, dark)`: escuro (preto, borda e letra douradas) ou neon (placa escura e brilho).
- **Dentro** (só com o herói dentro: `INSIDE_KINDS` do world.js): parede creme com azulejo branco até 96 cm, faixa
  azul e a placa "FIADO SÓ AMANHÃ" na parede do fundo; `prateleira` com `nichos` (armário preto de nichos amarelos,
  `cipo`); `geladeira` com `vidro` e `portas`; o caixa em L (`balcao` com `faixa`/`cor` e `caixa`); a `vitrine` (só o
  rodapé preto com a faixa amarela: o vidro é o da frente da casa); `balcao-vidro` (`doces` e os três potes);
  `freezer`; `parede-verde` (grama, `flores`, `logo` com o escudo aceso, `neon`); `ventilador` (de parede, `dentro`); o
  piso `porcelanato` (`PD.casas.floor.porcelanato`, 60 cm, `folhas` perto da porta).
- **Calçada:** o `degrau` (`capacho`), a `lousa` (OFERTAS em giz), os `caixote`s (`fruta`: banana ou laranja) e o
  `vaso` com `planta: 'dracena'` (de cimento fora; de barro com `dentro`).
- **Noite** (view.js, `_nightSources`): o `led` acende pontinhos nas duas linhas da faixa; a fachada preta solta a luz
  amarela da vitrine, a branca da porta e a poça no chão.
- Conferir: `budega-fotos.cjs` (scratchpad: fachada, dentro e noite; `celular` no fim).

### Caçador, parte 3 (15/11, com o "Ok, pode ir" do dono; os nomes dos ganchos combinados com a [estrutura])
- **Barra:** `ActionSlot` `class1` (R) e `class2` (T) no `ui.ts` (o `actionArt.ts` usa o ícone do 1º quadrado se faltar
  o da habilidade). PC: a moldura `habilidades-moldura-7.webp` (995 × 234), feita da de 6 (que fica como a fonte) por
  `barra/moldura7.py` no scratchpad: tira o enfeite do meio e refaz a corda com um trecho limpo, põe uma volta inteira
  (108 px) no vão entre o 3º e o 4º quadrado, com degradê na emenda, e recoloca o enfeite no meio novo. Ordem: Q, R, T, E,
  esquiva, defesa (o `#guard-button`, no 6º) e pulo; o chat usa a largura nova. Celular: a fileira R/T em cima do 2×2 (a
  mochila em pé subiu para 340 px) e o aviso rápido acima dos botões. A [estrutura] ligou os quadrados no motor
  (b4b1885) e apagou os botões provisórios; a ponte do CSS saiu junto.
- **Flecha Ancestral:** `src/client/novo/spiritArt.ts`. O voo vem pelo `drawProjectile` (`drawSpiritArrow`: a fita de
  luz, a espiral de dois fios girando, as luzinhas largadas e a flecha de luz com o clarão na ponta). No `combat.ts`
  (com o "pode" da [estrutura]): `paintSpiritAim` (a faixa dourada com setas andando), `paintSpiritEnd` (sem raio, o
  espírito se desfaz em 560 ms; com raio, a explosão em `SPIRIT_END_MS` = 720 ms) e `paintSpiritMark` (a runa a 2,02 m
  e o anel no pé). O `spiritArrow` e o `groundCircle` do combate ficaram sem uso (a [estrutura] apaga).
- **Olhos de Gavião** (view.js): `highlight(lista)` (a cada quadro, do motor; só os bichos perto da tela montam o
  desenho): a silhueta sai do próprio `drawable` do bicho pintado numa tela de rascunho (`_hawkCanvas`), vira uma cor,
  é engordada em 8 direções e perde o miolo (sobra a borda, com brilho), mais o corpo a 10% e o selo "Nv" em cima.
  `setVision(porcento)`: `visionK` vai até 1/(1 + 0,35 × visão) (amortecido) e entra no `_resize` depois do zoom do
  jogador. A ação `'hawk'` liga `a.hawkAt`; o quadro passa `a.eyeGlow` para o `ch.look.eyeGlow` e o `renderer.js`
  (`_eye`) pinta a íris dourada, o brilho e o risco de luz.
- Conferir: a prancha `espirito/entry.ts` (esbuild + `prancha.cjs`), e no jogo `cacador3.cjs` (barra, voo e o Gavião
  pelos ganchos chamados do teste), `ancestral-jogo.cjs` (`LONGE=1` afasta a câmera para ver a explosão a 14 m; o 6º
  argumento `filhote_boitata` e `noite` para ver a runa: os tatus morrem de uma flechada) e `barra-celular.cjs`. O banco
  de teste com o Caçador nível 14 é `jogo-novo/cacador.db` (personagens `Cacador` e `CacadorCel`). O mouse precisa
  passar por cima do jogo antes de segurar o R (senão o motor usa sozinho, mirando onde pega mais bichos).

### O molde de gente dos NPCs (15/11, pedido do dono: "melhora a arte da Xiovanna, e já deixa para usar para futuros npc")
- `js/creatures/pessoa.js` (antes do xiovanna.js no view-scripts.json e no arte.ts): `PD.creatures.Person` e
  `PD.creatures.definePerson('chave da NPC', aparência)`. A aparência (tudo opcional, o resto vem do `PADRAO`): `pele`,
  `cabelo` (`tipo`: afro, curto, coque, longo, careca; `cor`; `flor`), `rosto` (`olhos`, `delineado`, `labios`, `blush`,
  `barba`, `brincos`), `cima` (`tipo`: jaqueta ou camiseta; `cor`, `ziper`, `capuz`, `escudo`, `emblema`), `baixo`
  (calca, bermuda, saia), `pes` (tenis, chinelo), `corpo` (`altura`, `largura`, `feminino`) e `gestos` (`aceno`,
  `cabelo`). A Xiovanna virou só a aparência dela (`xiovanna.js`, 20 linhas).
- **Como desenha:** o `parts` calcula as juntas (`this._j`) e devolve bolas simples só para a sombra e a caixa; o
  `drawable` troca o `draw` pelo `_paint`, que monta partes (cápsulas na tela, o contorno do tronco por fatias
  `TORSO`/`PELVIS`/`SKIRT`), ordena pela profundidade da câmera e pinta cada uma com o contorno de tinta em volta do
  conjunto, o `cel` (sombra, cor, fio de luz) e os detalhes (zíper, gola, escudo, punho, bolsos). O rosto são decalques
  no plano da cabeça; ela pisca, e a boca abre ao falar. Cabelo novo = uma função em `HAIR` que devolve bolas nos eixos
  da cabeça; roupa nova = um ramo no `_paint`.
- **Limite visto no jogo:** no caixa da Budega ela fica de costas para a câmera (o balcão dá para dentro da loja), então
  ali aparecem o cabelo e os ombros; o rosto aparece quando ela vira para o herói de lado.
- Conferir: `xio-prancha.cjs` (scratchpad): a Xiovanna em 5 lados, os gestos, 5 NPCs de exemplo feitos só trocando a
  aparência, e todos no tamanho do jogo.

### A lista do dono de 15/11 depois de jogar (repassada pela [estrutura]; com o "pode" dele)
- **Molde de gente:** anda com passo de verdade no `moveTo` (`walk`/`stride`; o sobe-e-desce é o `bob`), fica virado
  para o ângulo do último `moveActor` (`baseYaw`) e não segue mais quem passa; no `talk` acena uma vez e vira só a
  cabeça. No caixa, 90° (sul) mostra o rosto. O pé dela a 5 cm do balcão é dado da [estrutura] (pedi 30 cm de folga).
- **Olhos de Gavião, o lag:** o destaque pronto de cada bicho fica numa tela própria (`_hawkCache`), refeito a cada 5
  quadros (um bicho por quadro) e desenhado no pé dele; a câmera afasta num tween de 0,4 s. Medido com 17 bichos:
  15 → 20 ms por quadro (antes 15 → 45). Medir: `gaviao-lag.cjs`.
- **Esquiva:** no `_drive`, se o rolamento passou do `moveEnd` e o alvo seguiu adiante, `_finishDodge` com `resume`
  (emenda na corrida). Depois ela ficou "um pouco mais lenta" (pedido do dono): `ROLL` com 0,62 s no total, andando
  até 0,52 s; e não começa no ar (`startRoll` recusa), nem o pulo entra no meio dela ("quando pula e usa esquiva buga").
  O braço do arco "bugando": eu disse que não reproduzia e que era perspectiva. **Estava errado** (meus testes fotografavam
  antes da carga cheia e eu não media a pose): o conserto de verdade é a seção "O braço do arco, redesenhado".
- **Quadro da missão:** PC a 300 px do alto (embaixo do mini mapa e do botão das Habilidades); celular ao lado do mini
  mapa (`left: 108px`).
- **Chuva com ênfase:** a ação `'volley'` na view (o `slingshot.js` deita o tronco, sobe o braço do arco e aponta a
  flecha para cima; solta sozinha em 0,32 s); `RAIN_LINGER_MS` 2200 (inteiras até o último meio segundo), o clarão, os
  riscos e a segunda onda no impacto (`IMPACT_MS` 560).
- **Flecha carregada e dica:** `.action[data-armed='1']` (anel verde pulsando) e `.skill-tip` no painel da HUD (com
  `!important`, até a [estrutura] tirar os estilos inline).

### O braço do arco, redesenhado (16/11, na main)
O dono reclamou três vezes ("o braço buga"; "ainda está com o bug do braço"; "o braço direito está aparecendo nas costas
do personagem, quando ele puxa de frente o braço direito some e vai pra trás") e três consertos meus não resolveram,
porque eu mexia em "para onde o cotovelo aponta" sem medir. **Lição: medir a pose antes de mexer.**
- **A medida** (`prototipos/pindorama-25d/ferramentas/arco-medida.cjs`: prancha fora do jogo, 8 a 120 direções da tela ×
  casos, com as juntas marcadas e os números de cada um): na carga cheia os dedos da corda paravam 25 cm À FRENTE do
  meio do peito, na frente do ombro esquerdo; o braço direito cruzava o peito e o cotovelo só tinha três lugares para
  ir: para cima (passava da cabeça: o 1º defeito), para trás do pescoço (19 cm atrás das costas: o 3º) ou para a frente.
  E, andando com o alvo à direita ou atrás, o peito torcia até 140° em relação ao quadril.
- **A pose nova** (`BOW_POSE` e `bowArms` no `slingshot.js`; o estilingue não mudou), na base da MIRA (a = para onde a
  flecha vai, r = a direita dela):
  - a linha da flecha passa rente à bochecha direita, por fora da cabeça (`side` 15,5 cm, `up` 21 cm acima do meio do
    peito); na carga cheia os dedos param nela, 10 cm à frente do ombro direito (`ahead`), sem passar da mandíbula
    (`jaw`). Com a mão perto do ombro o cotovelo cabe para trás, na linha da flecha;
  - a mão do arco fica na mesma linha, com o braço quase esticado (`reach` 61 cm até a empunhadura: cotovelo a ~159°);
  - o peito a 50° da flecha (`turn`; eram 75°): a puxada dá ~72 cm e a flecha tem 82 (`arrow`);
  - o peito não torce mais que 70° (`twist`); o começo da puxada é 45% da cheia e a mão vem pela linha da flecha;
  - o cotovelo: para trás, um tiquinho para fora e para baixo (`out`, `down`). Na linha da câmera (a flecha indo ou
    vindo) ele abre para fora (`outCam`, `backCam`, `openFrom`): para trás ficaria escondido pela cabeça ou em cima dela.
    Do lado de lá do corpo (mira para a esquerda e para baixo, ~145° a 165° da tela) o braço passa por trás da cabeça:
    é o braço de longe mesmo;
  - mirando para longe da câmera a ponta da flecha desce 14 cm (`away`): senão a mão do arco aparece acima da cabeça.
- **Andando:** o corpo segue as pernas e só o tronco vira. `poseAimOf(ch, rel)`: o estilingue mira 65° para cada lado
  (como antes); o arco, até 150° para a esquerda (o tiro por cima do ombro de quem foge do bicho) e 65° para a direita;
  o canto morto (atrás, à direita) fica com a ponta mais próxima e a troca de lado acontece no meio dele (137,5°), não
  bem atrás do herói. A `view.js` usa a mesma função no `'shoot'`.
- **Chuva (`volley`):** a pose já é a da puxada cheia, mirando para o alto (a mão na mandíbula, o tronco deitado).
- **Conferido:** fora do jogo, 72 direções × carga mínima, média e cheia: o cotovelo nunca fica atrás das costas (no
  máximo 2,8 cm atrás do plano do peito, ao lado do ombro) nem na altura da cabeça (no máximo 25 cm acima do meio do
  peito; o meio da cabeça fica a 33), sem erro de IK e sem salto entre direções vizinhas; os testes do protótipo
  (`teste-estilingue`, `teste-carga`) passam. No jogo (`Cacador`, carga cheia): 16 direções parado, andando para os 4
  lados com a mira em 4 direções, soltando e a Chuva em 8 direções.
- **Receitas:** `node prototipos/pindorama-25d/ferramentas/arco-medida.cjs saida.png "cheia:1.9:-" '{}' 1.9 16`
  (casos: `nome:segundos:andar:soltar`, andar em graus em relação à mira, `v` = Chuva; `NUMEROS=1` imprime as medidas;
  `SEM_MARCAS=1` tira as juntas; `DIRS=0,4` escolhe direções; `SLING=arquivo` compara com outro `slingshot.js`). No
  jogo: o botão direito do mouse segurado por 1,9 s (a carga do arco é 1,5 s) num ponto fora da zona segura (37; 35).
- **O anel da carga** (15/11, `src/client/novo/chargeArt.ts`, com o "pode" da [estrutura] para trocar a chamada no
  `combat.ts`): enche como relógio, com faísca na ponta; cheio, fica dourado, pulsa, solta uma onda e luzinhas sobem; a
  metade de trás some atrás das pernas (a camada do combate fica por cima do personagem).
- **Ordem de desenho** (15/11, `world.js` `behind`): com os dois eixos separados e respostas opostas, ganha quem está
  mais perto da câmera (antes o eixo x sempre ganhava: a Xiovanna aparecia por cima do balcão com o herói encostado).

### A esquiva comparada com o rolamento de referência (16/11; o dono escolheu a opção B, na main)
Escopo aprovado pelo dono ("pode ser"): comparar quadro a quadro, mostrar a prancha e a lista do que é diferente, e só
mexer na esquiva depois de ele escolher. A referência é o `Roll_RM` da Universal Animation Library 1 (Quaternius, CC0).
- **Como medi** (as três ferramentas ficam em `prototipos/pindorama-25d/ferramentas/`; a referência baixada fica FORA
  do projeto, numa pasta só dela):
  1. `python3 -I glb-juntas.py <zip> "Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb" Roll_RM
     ref.json`: lê o `.glb` como dado e dá, por quadro, quadril, peito, cabeça, ombros, cotovelos, punhos, dedos, coxas,
     joelhos, tornozelos e pontas dos pés, em cm (direita, frente, cima), na escala do nosso herói (quadril em pé a
     88,9 cm). Serve para qualquer animação das duas bibliotecas.
  2. `node rolamento-medida.cjs nosso.json tira.png 300 11 1.3334`: as mesmas juntas do NOSSO rolamento (60 quadros por
     segundo) e a tira do herói de verdade na câmera do jogo.
  3. `python3 -I folha-rolamento.py ref.json nosso.json tira.png <pasta>`: a prancha lado a lado, nas mesmas frações
     da duração de cada um.
- **A referência** (1,47 s): começa agachada (quadril a 49 cm), **mergulha** (os pés saem do chão aos ~0,15 s; o
  quadril sobe a 109 cm, 22 cm acima da altura de pé, aos 0,30 s), as mãos tocam o chão aos ~0,47 s, rola pelos ombros
  e pelas costas (o quadril chega a 4 cm aos 0,70 s), põe os pés no chão aos 0,80 s num agachamento fundo e leva
  0,67 s para levantar. Anda 4,76 m, tudo até 0,87 s, a 5,5 m/s constantes.
- **O nosso** (0,63 s): dobra no lugar (de pé à bola em 0,10 s; o alto da cabeça desce de 175 a 4 cm em 0,15 s), gira
  como uma bola sem sair do chão, com as mãos nas canelas o tempo todo (nunca tocam o chão), e abre em pé em 0,15 s.
  Anda os 3 m do servidor entre 0,12 e 0,47 s, com pico de 12 m/s (o dobro da referência).
- **As diferenças, em resumo:** (1) a referência mergulha e estica o corpo antes de rolar; o nosso vira bola no lugar;
  (2) nela as mãos vão à frente e tocam o chão; no nosso ficam nas canelas; (3) nela a silhueta muda (esticado →
  encolhido → agachado → de pé); no nosso é a mesma bola girando; (4) ela termina agachada e levanta devagar; o nosso
  abre direto em pé; (5) ela é mais longa e mais lenta: o mergulho inteiro não cabe nos 0,62 s que o dono pediu.
- **O que ofereci ao dono** (ele escolheu a B): A) deixar como está; B) "mergulho curto" nos mesmos 0,62 s e 3 m:
  entrada se lançando para a frente com os braços estendidos (~0,12 s), as mãos tocam o chão e ele enrola (~0,30 s),
  saída agachado com uma mão no chão e subindo já na corrida (~0,20 s); C) o B com 0,75 s (muda o tempo que ele pediu e
  precisa da [estrutura]: o servidor segura o pulo por `DASH_ROLL_MS` 700 depois da esquiva). Recomendei o B.
- **Feito: a opção B, o "mergulho curto"** (escolha do dono, 16/11; `_rollPose` e `ROLL_SHAPE` no `animator.js`. O
  `ROLL` não mudou: os mesmos 0,62 s e a distância do servidor). **Na main em 16/11, com o "pode" do dono** (viu o
  antes e depois do jogo antes de entrar). Ficou combinado com ele: no PC dele (aqui o jogo roda a ~20 quadros por
  segundo, sem placa de vídeo) conferir se o mergulho aparece bem; e, se a saída agachada der sensação de "travar no
  fim", encurtar o agachamento (`ROLL_SHAPE.crouch`).
  - Como é feito: a pose continua montada em pé e girada pelo `fall` do rig (uma volta inteira, encostando no chão).
    O que mudou é a FORMA do corpo ao longo da volta, em janelas (frações da duração; uma entra enquanto a outra sai):
    `reach` (os braços estendidos à frente), `plant` (dobram quando as mãos acham o chão), `pike` (o tronco desce antes
    das pernas), `tuck` (a bola) e `crouch` (a saída agachada: o pé esquerdo à frente, o direito atrás na ponta, a mão
    direita no chão e a esquerda para trás). O giro vem em duas partes (`dive`: deita 85° no mergulho; `spin`: o resto
    da volta, mais depressa, pelas costas) e o `hop`/`air` é o pulinho (52 cm) que tira os pés do chão.
  - Duas armadilhas que apareceram medindo: (1) com o braço esticado até o chão ele parava de mão, com o quadril a
    107 cm, e despencava: por isso o `plant` dobra o braço; (2) bola + agachado somando mais que 1 afundavam o corpo, a
    mão passava do chão e o apoio do rig levantava o corpo inteiro (os pés ficavam 20 cm no ar): as janelas de `tuck` e
    `crouch` agora se cruzam certinho.
  - Medido (`rolamento-medida.cjs`): os pés saem do chão aos 0,08 s; o quadril sobe a 100 cm (0,10 s); as mãos tocam o
    chão aos 0,15–0,17 s; rola pelas costas (quadril a 13 cm aos 0,32 s); os pés voltam aos ~0,38 s; agachado de três
    apoios aos 0,43–0,48 s, com a mão direita a 2 cm do chão e os dois pés plantados; de pé no fim (quadril a 88 cm aos
    0,63 s). Correndo, a view emenda aos 0,52 s e ele sobe correndo (altura de corrida aos ~0,65 s). O maior movimento
    de uma junta num quadro ficou igual ao do rolamento antigo (45 cm, a cabeça) e o do quadril, menor (19 contra 25).
  - Conferido: testes do protótipo (`teste-acoes` 624 cenários, `teste-refino-acoes` 24: sem falhas); fora do jogo em
    4 direções da tela; no jogo, correndo para os 4 lados e parado, sem erro na página.
  - Receitas: `rolamento-medida.cjs <json> <tira.png> 300 11 1.3334 '{...}' <tela>` (o json troca números de
    `PD.ROLL_SHAPE`; `ANIM=<arquivo>` usa outro `animator.js`, para o antes e depois); no scratchpad,
    `rolamento-correndo.cjs` (corre, esquiva e emenda, como a view) e `esquiva-jogo-final.cjs` (os quadros do jogo de
    verdade, com a hora da própria animação em cada um).

### O tranco do zoom da conversa (17/11; o dono escolheu "Tranco do zoom"; na main em 17/11, com o "pode sim" dele)
O que ele via (15/11): quando a câmera aproxima para conversar com um NPC, dá um tranco. O "Zoom sem travar" de 14/11
já tinha tirado os quadros de 200 ms; a [estrutura] mediu de novo (quadro de 24 para 33 ms durante o zoom, o mais lento
117 ms) e sobrou este. **Entrou na main em 17/11, com o "pode sim" do dono** (ele viu o antes e depois; estava fora
de casa e ainda vai testar no PC dele). Tudo foi medido no jogo de verdade, no Chromium sem placa de vídeo (parado,
33 a 38 ms por quadro a 1600 × 900): os números servem para comparar antes e depois, não são os do PC dele.
- **As causas, medidas** (`zoom-perfil.cjs`), da mais pesada para a mais leve:
  1. **A ordem de desenho era refeita a cada passo do zoom.** O `World.invalidate()` zerava a ordem (`_staticOrder`) e,
     com os 2.029 objetos do Capão, refazê-la custava ~21 ms por quadro em todos os quadros da aproximação e da volta.
  2. **A caixa na tela dos 2.029 objetos era recalculada a cada passo do zoom** (`Prop.bounds` → `screenBox()`):
     13 a 20 ms por quadro.
  3. **Na chegada, tudo era refeito de uma vez:** pelo menos 2 imagens e 1 pedaço de chão por quadro, custassem o que
     custassem (65 imagens, ~370 ms, e 12 pedaços, ~210 ms, em poucos quadros de 120 a 150 ms). E as mais pesadas
     (copas inteiras, 36 a 58 ms cada) eram de coisas FORA da tela: o `_spriteCare` adianta a imagem de quem está até
     meia tela além da borda, e na conversa a câmera nem vai andar.
  4. **Na volta, tudo era refeito de novo** (110 a 146 imagens e 10 a 15 pedaços de chão) e, enquanto isso, a borda da
     tela ficava SEM CHÃO (retângulos escuros): os pedaços velhos eram os do zoom de perto, que só cobrem o meio.
  5. Conversando de dentro da Budega, refazia a imagem da casa inteira (que nem é desenhada com o herói dentro) e as de
     tudo o que fica debaixo do escuro de 93% do lado de fora.
- **O que mudou** (`js/view.js`, `js/world/world.js`, `props.js`, `ground.js`):
  - **A ordem fica.** `invalidate()` não zera mais `order`: quem está atrás de quem não depende do zoom. Conferido com
    o `zoom-ordem.cjs`: de 9.377 pares de objetos que se cobrem na tela, 1 ou 2 saem em ordem diferente da recalculada
    do zero em outro zoom, e são copas emboladas em que a ordem é um ciclo (nenhuma das duas é "a certa").
  - **A caixa estica.** Com o zoom mudando, `bounds` é a caixa exata de antes esticada, com folga (`_setBox`); a exata
    volta em `_exactBounds()`, que é a que o `_makeSprite` e a casa cortada usam. De 13–20 ms por passo para 0,2–0,5.
  - **Dois zooms guardados.** Cada objeto guarda a imagem do zoom anterior (`spriteAlt`; quando o zoom volta, o
    `_swapSprite` troca as duas na hora), a casa cortada também (`_cutAlt`) e o chão guarda até 2 níveis de 24 pedaços
    (`Ground.kept`). A volta da conversa e a segunda conversa não refazem nada.
  - **Adiantar.** A 4 m de um NPC (`AHEAD_REACH`), a view diz ao mundo para que zoom e para que ponto a câmera iria
    (`View._ahead` → `World.setAhead`) e o mundo vai fazendo as imagens e o chão daquele zoom com o que sobra do
    orçamento de cada quadro (`_buildAhead`, `Prop._ensureAlt`, `Ground.buildAhead`), do meio da tela de lá para fora.
    O zoom da conversa é do motor (1,25): a view começa com esse valor (`ZOOM.talk`) e aprende o de verdade na primeira
    conversa (`_talkZoom`); se a [estrutura] mudar o `CONVERSATION_ZOOM`, só a primeira conversa perde o adiantado.
    Coisa PESADA (mais de 9 ms, estimados pelo que a imagem custou da última vez: `costAt`; e o pedaço de chão, num
    aparelho em que ele passa disso: `Ground.chunkMs`) só com o herói parado, num quadro que não fez mais nada, quadro
    sim, quadro não: andando, quadro comprido vira soluço no passo. Com a conversa já aberta não adianta mais nada.
  - **O orçamento do quadro.** Uma coisa por quadro (`buildBusy`: um pedaço de chão OU imagens até 6 ms), o chão e as
    imagens se revezam, e as imagens saem do meio da tela para fora (`_buildStale`): o NPC fica nítido primeiro.
  - **Câmera parada, nada de fora da tela.** Na conversa — e nos 0,7 s seguintes, enquanto o zoom volta — o
    `_spriteCare` não adianta nem solta imagem de quem está fora da tela (`World.camHeld`, que a view liga).
  - **Só o que aparece.** `shown` (o móvel de casa fechada e a casa inteira com o herói dentro ficam de fora) e
    `dimmed` (o que está no escuro do lado de fora fica com a imagem velha esticada; quando o escuro abre, volta para
    a fila).
  - **O chão na volta.** Os pedaços guardados do zoom mais aberto vão por baixo dos velhos (`_drawLevel`): não aparece
    mais borda sem chão.
  - **Memória.** As imagens guardadas de outro zoom vencem 20 s depois da última mudança de zoom (`ALT_KEEP_MS`),
    menos as do zoom que está sendo adiantado; e nada vence durante a conversa. Medido (`zoom-memoria.cjs`, 1600 × 900,
    imagens e chão): parado, 91 a 106 MB; ao lado de um NPC e na conversa com ele, uns 50 MB a mais (com o Curupira:
    33 MB de imagens e 16 MB de chão do zoom de perto), que saem 20 s depois de o herói se afastar; no pior caso (a
    roda até o zoom máximo e de volta) 174 a 181 MB por 20 s e depois volta ao normal (91 a 98 MB; a versão antiga
    ficava em 94; sem o vencimento, ficava em 193). Em tela de 2 pixels por ponto (celular, tablet) e em aparelho de
    até 4 GB (`navigator.deviceMemory`), o `keepLevels` fica desligado: um zoom por vez e sem adiantar, como era; lá só
    entram a ordem, a caixa, o orçamento e o `camHeld`.
  - `invalidate(true)` pinta tudo de novo no mesmo zoom (o protótipo solto chama quando as fontes das placas chegam;
    sem isso a imagem "guardada" com a fonte de reserva voltava a valer).
- **Medido, antes × depois** (`zoom-comparar.cjs`: as duas versões ligadas ao mesmo tempo, uma em cada porta,
  revezando a cada rodada; média de 3 rodadas; ms por quadro, e entre parênteses o pior quadro das 3). Os casos: a
  Xiovanna de dentro da Budega e o Curupira ao ar livre; "parado" = o herói ficou 3,5 s ao lado do NPC antes de
  clicar; "andando" = veio de 6 m e clicou assim que chegou:

  | Fase | Xiovanna, parado | Curupira, parado | Curupira, andando | Xiovanna, andando |
  |---|---|---|---|---|
  | a câmera se aproximando (0,45 s) | 72 (117) → 51 (61) | 57 (92) → 46 (68) | 70 (102) → 52 (62) | 70 (105) → 52 (66) |
  | logo depois de chegar (2 s) | 65 (147) → 44 (63) | 55 (119) → 43 (67) | 57 (125) → 48 (90) | 61 (141) → 52 (91) |
  | ... quadros acima de 80 ms | 9,0 → 0 | 5,0 → 0 | 6,3 → 0,3 | 7,7 → 1,0 |
  | a câmera voltando (0,45 s) | 69 (97) → 56 (66) | 73 (121) → 56 (76) | 68 (82) → 54 (94) | 68 (87) → 58 (81) |
  | depois da volta (2 s) | 65 (126) → 38 (63) | 51 (102) → 34 (62) | 52 (101) → 34 (51) | 67 (144) → 37 (67) |
  | ... imagens refeitas na volta | 131 → 0 | 146 → 0 | 143 → 0 | 128 → 0 |
  | antes de clicar, ao lado do NPC | 40 → 44 | 33 → 37 | 37 → 39 | 32 → 34 |

  A última linha é o preço: parado ao lado de um NPC, o preparo adiantado deixa alguns quadros mais compridos nos
  primeiros segundos (acima de 60 ms: de 2,3 para 5,0 ao lado da Xiovanna; de 0 para 1,7 ao lado do Curupira).
  Andando, não muda. E no caso "andando" (clicou assim que chegou) o chão do zoom de perto ainda é feito na chegada
  (11 pedaços, ~150–200 ms): nesta máquina o pedaço de chão conta como "pesado" e não é adiantado com o herói andando;
  num PC em que ele custe menos de 9 ms, é adiantado e a chegada fica como a do "parado".
- **A roda do mouse e os Olhos de Gavião** (`zoom-roda.cjs`, uma rodada de cada versão): enquanto o zoom muda, o
  quadro foi de 57–66 ms para 43–50 (roda) e de 86 para 55 (Gavião). Voltar para um zoom que acabou de ser usado
  ficou quase na hora: nítido em 40–240 ms contra 730–920 ms (roda) e 38 ms contra 827 ms (a volta do Gavião). **O que
  ficou mais lento:** a PRIMEIRA vez num zoom novo leva mais para ficar toda nítida — 1,0 s contra 0,75 s na roda
  aproximando e 1,75 s contra 1,2 s no Gavião —, com quadros mais leves no caminho (56 contra 68 ms; 63 contra 85).
  É a troca de "uma coisa por quadro"; no Gavião a imagem está sendo encolhida, então não chega a borrar.
- **Celular** (844 × 390 com 2 pixels por ponto; `TELA=844,390 DPR=2`, 2 rodadas): aproximando 59 → 48 e 75 → 57;
  chegando 65 → 53 e 76 → 63 (acima de 80 ms: 10 → 5,5 e 11 → 7); voltando 70 → 48 e 75 → 53. Lá o que sobra é o
  chão: cada pedaço tem 4× os pixels e custa de 60 a 85 ms aqui. Ideia para depois, se o dono reclamar do celular:
  pedaços de chão menores em tela de 2 pixels por ponto (256 em vez de 512), para o custo vir em fatias.
- **A imagem conferida** (`zoom-fotos.cjs` + `zoom-fotos-comparar.py`: cada parada comparada com a mesma cena refeita
  do zero): na conversa com o Curupira e com a Xiovanna (de dentro da Budega), depois da volta, no celular e em quatro
  paradas entrando e saindo da Budega com a roda mudando o zoom: a nitidez ficou entre 99,1% e 100,1% da referência e
  menos de 0,7% dos pixels diferem (o que se mexe sozinho: o herói respirando, a fogueira, as bandeirinhas; na volta,
  o balão de fala que ainda está na tela). Sem erro na página. O protótipo solto (`conferir.cjs`, `jogo.cjs`) e os
  testes do protótipo (`testes.cjs` 40 de 40, `teste-acoes`, `teste-estilingue`) passam; `npm run check`: 505 testes.
- **Para o dono conferir no PC dele** (aqui não há placa de vídeo): conversar com a Xiovanna e com o Curupira, a
  primeira vez chegando correndo e a segunda logo em seguida, e ver se o tranco sumiu na ida e na volta; rodar a roda
  do mouse; usar os Olhos de Gavião. Se a imagem demorar para ficar nítida depois de aproximar com a roda, o ajuste é
  o `BUILD_BUDGET` (6 ms) do `world.js`.
- **Receitas** (todas pedem o jogo ligado no mesmo computador, com `npm run build && npm start`; o personagem de
  teste é criado sozinho — `NOME` e `SENHA` trocam; para os Olhos de Gavião precisa ser um Caçador com a habilidade):
  `node zoom-perfil.cjs [url] [budega|curupira] [largura,altura] [espera em ms]` (`ANDAR=x,y PERTO=x,y` para vir
  andando; `DPR=2` para celular); `node zoom-comparar.cjs <pasta> [repetições] [casos]` (antes × depois: a versão
  antiga num `git worktree`, com `PORT=3001` e uma cópia do save); `node zoom-roda.cjs [url]`; `node zoom-fotos.cjs
  conversa|casa [url] <pasta> ...` e `python3 zoom-fotos-comparar.py a.png a-ref.png`; `node zoom-ordem.cjs [url]`;
  `node zoom-memoria.cjs [url]`.

### O chão pintado, passo 1 — PILOTO PAUSADO em 17/11 e PASSADO AO [mundo] em 19/11 (o desenho do mapa agora é dele)
> **19/11 (nota do [mundo]):** com a divisão nova, o desenho do mapa é do [mundo]. Este piloto foi para a `main` em 19/11,
> com o "junta agora e segue" do dono, e quem continua é o [mundo] (`docs/MUNDO.md`). O texto abaixo é o de 17/11.
Pedido do dono (17/11, pelo [mundo]): "chão feio, água sem movimentação, ambiente pífio"; direção aprovada ("é esse o
caminho"): `docs/referencias/chao-pintado-alvo.jpg` (o antes: `chao-pintado-antes.jpg`). Combinado com ele em três
passos (1: o chão pintado; 2: luz e sombra no chão; 3: água e vida), cada um com piloto na Clareira dos Despertos,
antes × depois e desempenho medido, e só vai para o mapa todo e para a `main` com o "pode" dele. Ele disse "pode
começar" (passo 1) e, no meio, pediu atenção também para "pedra, plantas, matos, cadeiras, casas, telhado": as pedras
e os matos da Clareira entraram no piloto; para o resto fiquei de mandar o "antes" e uma proposta.
**Está só no meu ramo (`claude/blissful-meitner-hp1i5e`), NÃO na `main`, e o dono ainda não viu.**
- **O que há:** `js/world/chao.js` (novo; carregado depois do `street.js` no `view-scripts.json`, no `clareira.html` e
  no `src/client/novo/arte.ts` — sem a linha no `arte.ts` o jogo mostra o chão antigo). (1) A TINTA de cada material
  natural (grama, mata, terra, trilha, lama, areia): um ladrilho de 512 px feito uma vez (cor de base + uma demão
  `wash` + borrões de aquarela claros, escuros e miúdos) e repetido como padrão — `PAINT` no alto do arquivo é onde
  se mexe nas cores. (2) As MARCAS (`marks`): folhas, tufos de capim em pé, florzinhas, pedrinhas e trincas no lugar
  das bolinhas iguais. (3) As ÁREAS (`area` + `edgeOver`): a beirada se desmancha — névoa de cor (borrões radiais),
  aguada meio transparente e a tinta firme de beirada ondulada; encostada em calçada, pedra ou água a beirada fica
  exata. (4) As TRILHAS (`trailsUnder` + `trail`): sem contorno; corpo de beirada ondulada, ponta solta arredondada,
  pinceladas de uso (claras onde se pisa), beira úmida macia, capim e pedrinhas. (5) A EMENDA das calçadas e do asfalto
  com a terra (`seam`). (6) As pedras (`Small.prototype._rock` no `props.js`): pintura por face, veios, musgo em tufos,
  capim no pé. A água e as sombras chapadas do chão NÃO mudaram (passos 3 e 2).
- **O que aprendi (para não repetir):** traço largo com o padrão e beirada "desfiada" dá degraus (as pinceladas são
  cortadas pela faixa do traço); gomos de oval pela beirada parecem respingo; onda de seno na beirada parece renda
  (use o ruído sorteado do `wave`); faixa meio transparente de borda dura em volta da trilha aparece como faixa reta;
  risco de uso curto e largo vira losango; preencher com padrão custa ~50 vezes mais que cor lisa (a aguada usa a cor
  média, `meanOf`); as medidas por função enganam (o desenho só é pintado de verdade no `rasterNow`): para saber o
  custo de um pintor, desligue-o e meça o pedaço inteiro (`SEM=` na prancha).
- **Medido até a pausa (sem placa de vídeo, fora do jogo, 4 pontos no zoom 1, mediana de 9 repinturas por pedaço):**
  antes 10,1 ms por pedaço de chão (pior 18,9); depois 11,5 ms (pior 18,3), ou seja, ~14% mais caro. No jogo de
  verdade o "antes" está medido (média 13,3 ms, pior 46,7 em 7 pontos × 3 zooms); o "depois" no jogo AINDA NÃO.
- **Falta (na ordem):** (a) terminar a conferência das emendas entre pedaços (`EMENDA=3` na prancha: 3 × 3 pedaços
  pintados um a um contra a mesma área pintada de uma vez; qualquer ponto vermelho é marca cortada ou pulada — a
  folga do `box.sees` nas marcas subiu de 75 para 120 cm e não foi conferida); (b) `npm run build`, reiniciar o
  servidor e conferir NO JOGO: foto no ponto do print do dono (herói em 32,47, zoom 1, 1600×900), noite, celular
  (`DPR=2`), custo (`chao-custo.cjs`) e o zoom (`zoom-perfil.cjs`); (c) testes do protótipo (`testes.cjs`,
  `teste-acoes`, `teste-estilingue`, `conferir.cjs`); (d) mostrar ao dono o antes × depois ao lado do alvo, as pedras,
  os números e os limites, e pedir o "pode"; (e) a proposta para cadeiras, casas, telhados e plantas; (f) marcar no
  roteiro. Defeito antigo que vi e é do passo 2: uma faixa mais clara dentro da sombra da árvore, junto do poste
  (duas sombras no mesmo traçado se anulam; aparece também no print do dono).
- **Receitas** (em `prototipos/pindorama-25d/ferramentas/`): `node chao-prancha.cjs <pasta> "nome:x,y,zoom;..."
  [largura,altura]` (fora do jogo, rápido: carrega os scripts da view e o mapa do Capão; `RAIZ=` usa outra cópia dos
  scripts — o "antes" é um `git worktree` da `main`; `DIRETO=9` mede o custo; `SEM=marks,area,trail,trailsUnder,
  edgeOver,seam,tinta` desliga um pintor; `EMENDA=3` confere as emendas; `NOITE=1`, `SEM_HEROI=1`, `DPR=2`);
  `node chao-foto.cjs <url> <saida.png> [x,y] [zoom] [largura,altura] [noite]` e `node chao-custo.cjs <url>
  [saida.json]` (no jogo ligado; `NOME` e `SENHA` do personagem de teste).

### BIRIM, o personagem principal novo — NA MAIN em 19/11, só no protótipo (ainda não no jogo: veja "AGORA", no alto)
O dono pediu ("quero criar um personagem principal, na mesma pegada que é o que é hoje") e mandou a ficha dele (8
ângulos ilustrados, uma foto e um modelo 3D de blocos) com um roteiro de 9 etapas. Escopo que ele aprovou ("Pode
seguir"): **a ficha, sem mexer no jogo**. As referências dele **não entram no repositório** (a foto é de uma pessoa de
verdade): só vão no ZIP entregue a ele. Os dois `.py` que vieram no pacote 3D não foram executados.
- **Como foi feito:** o Birim é um **segundo MODELO no mesmo esqueleto** do herói — `js/character/birim.js`
  (`PD.models.birim`; `PD.models.appearance('birim')` devolve `{ paleta, modelo }`, que vai no lugar da aparência no
  `renderer.draw`). Todas as animações e os encaixes de equipamento servem para ele sem mudar nada. Não é Blender nem
  imagem de IA (custo zero). O `renderer.js` ganhou ganchos de modelo (`face`, `chestDetail`, `pelvisDetail`,
  `limbDetail`, `extras`, `wear`, `headScale`, `headDrop`, `HEAD.eye.lid`, `eps` na touca) e **o herói continua
  idêntico ponto a ponto** (prancha completa comparada antes × depois, e o `teste-render-morte` passando).
- **Ainda NÃO está no jogo:** o `birim.js` não está no `view-scripts.json` nem no `arte.ts` de propósito (só as
  ferramentas e a `prancha.html` carregam). Falta o dono decidir o passo 3 (ele substitui o herói de todo mundo ou
  vira uma segunda opção na criação do personagem — recomendei a segunda) e a [estrutura] guardar a escolha.
- **Ferramentas:** `node ferramentas/ficha.cjs saida.png --modelo birim [--graus 0,45] [--inclinacao 0|30]
  [--vestir-teste cabeca,tronco,pernas,pes] [--sem bone,bermuda] [--so bermuda] [--medidas]` (uma direção ou a
  prancha das oito) e `node ferramentas/ficha-exportar.cjs <pasta>` (o pacote: `TURNAROUND/` com a câmera reta,
  `CAMERA_DO_JOGO/` a 30°, `MODELO_BASE/corpo_base` e `pecas/`, pranchas, teste de equipamento e `medidas.json`).
  `node ferramentas/prancha.cjs '?zoom=1.6&modelo=birim' saida.png 1` = todas as animações com ele. A pose A e as
  medidas ficam em `js/tools/ficha.js` (`PD.ficha`).
- **Números do modelo (cm):** 172,5 de altura na pose A com o boné (~174 em pé), 7,0 cabeças, cabeça 24,8 × 19,8,
  ombros 54,8, peito 40,4, cintura 31,2, braço 13,5, antebraço 12,4, panturrilha 14,4; pose A com o braço a 32°,
  mão a 28,6 cm do quadril, 46 cm entre os tornozelos. Exportação: 2048×2048, 8 px/cm, pés em (1024, 1802).
- **Lições:** (1) conferir contra a ficha **lado a lado** antes de entregar — a primeira versão tinha barba enorme,
  sem pescoço, pálpebra grossa como sobrancelha e olhos altos demais, e eu só vi ao pôr as duas imagens juntas;
  (2) a ficha técnica é com a **câmera reta (0°)**: com a câmera inclinada a cabeça cresce para cima e o pé de cá
  desce, e as alturas deixam de bater entre as direções; (3) a linha da pálpebra do motor tem 1,15 cm fixo: numa
  cabeça menor ela vira um borrão (`HEAD.eye.lid`); (4) a folga que pus na touca (`_capPoly`) mudou um quadro da
  esquiva do herói a 45° — quem pegou foi o `teste-render-morte`, não a prancha: rodar os testes do protótipo
  **sempre** (precisa de `@napi-rs/canvas`, que instalei numa pasta de rascunho com `NODE_PATH`; não é dependência
  do projeto); (5) uma peça de tronco precisa cobrir a "ponte" do ombro: agora a ponte pega a cor da peça.
- **O que ainda não está bom (dito ao dono):** é um redesenho no traço do jogo, mais simples e menos musculoso que
  a ilustração; a tatuagem é parecida, não é a mesma (a da ficha é mais fechada); cabeça ~2 cm mais larga que a da
  ficha; perfil do rosto simples e, nas diagonais de costas, só a costeleta (os dois refeitos na versão 3,
  abaixo); a mão de lado, com os dedos uns na frente dos outros, fica confusa; 1,74 m e não 1,80 m (o esqueleto
  é o do herói). Não foi testado dentro do jogo, nem com arma na mão.
- **Versão 2 (17/11; o dono viu a 1 e pediu: "melhora a tatuagem, as mãos e os pés"), também só no ramo:**
  - *Tatuagem:* uma manga de **espirais de linha grossa** (`koru`, linha de ~1,4 cm, passo de 2 cm entre as voltas,
    bolinha no miolo) com espirais pequenas e ganchos (`hook`) nos vãos, montada por `sleeve` na pele desenrolada
    do braço ([cm ao longo do osso, graus em volta]); para antes do relógio. As bordas de cada risco são calculadas
    uma vez (`tattooEdges`: a pele não muda com a pose) e todos os pedaços entram no mesmo sentido (um por cima do
    outro não abre buraco na tinta).
  - *Mãos:* `MODEL.HAND` próprio, escrito em centímetros (palma chata de ~4 cm de grossura, dedos de 5,7 a 7,7 cm
    por 1,6 a 1,8, polegar com a junta do meio — `thumb.mid`) e `handLines` (vãos, nós, dobras, unhas, as duas
    dobras da palma). O punho ficou sem a "bola": `wristJoin` (o `renderer` não risca o contorno fino dentro do
    punho — `holes` — e põe a mão por cima do antebraço — `over`, uma regra fixa no `_depthFix`).
  - *Pés:* `MODEL.FOOT` e `TOES.each` (os cinco dedos, cada um uma peça), `toeLines` (os vãos entre os dedos, as
    unhas, os ossinhos do tornozelo) e a tira do chinelo como fita larga em Y (`ribbon`) saindo do vão do dedão.
  - *Medidas:* mão 16,2 cm solta (~17 aberta), palma 8,8; pé 23,7 × 9,6.
  - *Conferência:* herói idêntico ponto a ponto, os 7 testes do protótipo que desenham o personagem, `npm run
    check` (510), animações do Birim sem erro, punho fechado conferido com `ficha.cjs --punho 1`.
  - *Lições:* (6) o raio da pele para pintar em cima de um membro é o do **casco** das esferas (`skinAt`, uma
    tabela por direção), não o da esfera mais de fora: entre o bíceps e o cotovelo a conta antiga dava números
    soltos e a tatuagem fina virava borrão; (7) braço ou perna esticados são pintados como um volume só, **sem
    linha entre as peças**: dedo do pé separado só aparece se eu riscar o vão; (8) quem decide a ordem de desenho
    entre membros é o `_depthFix`, não a chave: mexer na `key` da mão não adiantou, precisou da regra `over`;
    (9) para ver mão e pé de perto: `ficha.cjs <pasta> --modelo birim --escala 22 --tamanho 3000x4000 --ancora
    0.97 --solto` e recortar — na ficha de 8 px/cm os defeitos não aparecem.
- **Versão 3 (17/11; o dono pediu: "melhora o perfil do rosto"), também só no ramo:**
  - *O que estava errado:* a cabeça é um casco só, com o nariz dentro: de lado o perfil virava um polígono sem
    nariz, a barba era uma tira no contorno do queixo e o olho de frente, visto de lado, virava um triângulo.
  - *Nariz e lábio de baixo como peças:* as esferas do nariz têm `apart: true` em `HEAD.spheres` — ficam fora do
    casco da cabeça (um filtro no `renderer.js`; o herói não tem nenhuma, continua idêntico) mas valem para o
    `_faceAt`. Em `extras`, `narizBirim` e `labioBirim` são itens próprios: por cima da cabeça quando o rosto olha
    para a câmera (o nariz por cima da barba também: vista de cima, a ponta passa na frente do bigode) e por trás
    dela quando o rosto vira para lá (só aparece o que passa da silhueta). O risco do nariz de frente e de três
    quartos é o `noseLine` (o lado de lá e a volta por baixo da ponta; visto de cima, só o lado); as narinas, o
    `noseDetail`. Nariz reto: ~4 cm do olho à base, ponta ~1,2 cm à frente do bigode.
  - *Sombra emendada (`faceShade`):* a peça por cima do rosto não tem sombra só dela — continua a meia-lua de
    sombra da cabeça (a mesma conta do `paintConvex`, com o casco da cabeça deslocado para a luz) e ganha a
    sombra fina do próprio lado conforme a cabeça vira.
  - *Barba:* um pedaço novo na bochecha de baixo (da costeleta ao canto da boca), o queixo mais para a frente e
    o bigode entre a base do nariz e o lábio. **A regra que tirava quase toda a barba assim que o rosto passava do
    perfil saiu:** agora cada pedaço some quando o lado dele deixa de olhar para a câmera (bigode, queixo,
    bochecha, mandíbula e, por último, a costeleta), e na diagonal de costas a barba desce pela mandíbula.
  - *Olho de perfil (`sideEye`):* amêndoa com a ponta para a frente, íris estreita, pálpebra grossa e sobrancelha;
    entra quando a cabeça vira mais de ~60° (`|turned| >= 0.86`). A boca ganhou o risco de perfil. A `glabela`
    (esfera entre as sobrancelhas, dentro do casco) e a sobrancelha do lado de lá encurtando acabaram com a ponta
    que "enrolava" vista de cima.
  - *Ferramenta:* `ficha.cjs --graus` aceita **qualquer ângulo** (os sem nome saem como `g095.png`).
  - *Conferência:* herói idêntico ponto a ponto, os 7 testes do protótipo, `npm run check`, o Birim em todas as
    animações, e a cabeça olhada de perto nas duas câmeras em 0, 45, 70, 85, 90, 95, 105, 120, 135, 150, 180° e
    no outro lado.
  - *Lições:* (10) **medir a ficha com régua antes de corrigir no olho**: o nariz parecia de botão porque a ponta
    estava ~1 cm alta; a primeira correção, no olho, virou um bico. Medido (olho → base do nariz): a ficha dá
    3,5 cm de frente e 4,8 de perfil (as vistas dela não batem entre si) — fiquei no meio; (11) peça por cima de
    outra da mesma cor, com sombra própria, parece **colada** do lado em que a de baixo está na sombra: a sombra
    tem de continuar a da peça de baixo; e pintar só a sombra (a peça toda de sombra com o claro por cima deixa um
    fio escuro na borda); (12) conferir **os ângulos do meio**, não só as oito direções: a regra da barba deixava
    o queixo pelado a 95° e a prancha de oito nunca mostrou; (13) antes de esconder um desenho "estranho", olhar
    a ficha do dono naquele ângulo: a barba pendurada na diagonal de costas, que eu tinha tirado na versão 1, é
    o que a ficha mostra.
- **O dono achou a versão 3 "horrível" (18/11: "boné fora da cabeça, boneco todo torto... bem longe da minha
  expectativa")** e, pela [estrutura], mandou o método do Dunloc Online (jogo de navegador desenhado por código, como o
  nosso; o autor explica num vídeo do canal RafaxLab): **(1)** referência feita por IA de imagem, só cabeça, fundo
  verde, virada para o sul; **(2)** as outras 7 direções pelo Nano Banana; **(3)** rodada focada numa coisa só ("só o
  rosto, só o sul"); **(4)** um crítico comparando lado a lado, parte por parte, antes de entregar; **(5)** estilo
  chapado (2 ou 3 tons) com contorno; **(6)** depois roupa, arma e movimentos, um de cada vez. O dono escolheu
  **começar pelo Birim** e pagou o saldo do AI Studio (o Google tinha travado com "outstanding balance").
- **Rodada 1 do rosto (18/11, só no ramo; esperando o dono ver):**
  - *Referências do Nano Banana* (`gemini-nano-banana-2.1`, 2K; 3 imagens, ~US$ 0,15; total do piloto 6 imagens,
    ~US$ 0,27): duas cabeças de frente em fundo verde (A, barba curta; **B, barba cheia — a usada**) e o corpo
    inteiro a 45° na câmera do jogo. Prompt: a ficha do dono + o retrato dela, "flat cel shading, 2 or 3 tones, bold
    ink outline". **Ficam fora do repositório** (derivam da ficha, que vem da foto de uma pessoa de verdade): só no
    rascunho e no que for entregue ao dono.
  - *O crítico:* `ferramentas/critico-rosto.py <referencia.png> <pontos.json> <nosso.png> <saida.png>` — a referência e
    o nosso desenho na mesma escala, alinhados pelos olhos, lado a lado e um por cima do outro, com linhas nos pontos
    medidos (os pontos vêm de uma grade desenhada por cima da referência). O nosso rosto de frente, grande:
    `ficha.cjs <pasta> --modelo birim --graus 0 --inclinacao 0 --escala 30 --tamanho 1400x1400 --ancora 3.84 --solto`.
    Foram 15 ciclos (c00 a c15), um defeito por vez.
  - *O que mudou no `birim.js`:* cabeça ~12% mais estreita (o rosto tinha 2,6 vezes a distância entre os olhos; na
    referência, 1,9) com a esfera `topo` devolvendo a altura; olhos mais afastados; boné, cachos, cabelo de cima, aba e
    óculos acompanhando a cabeça nova; **olho novo** (`birimEye`: amêndoa baixa, íris grande quase preta passando das
    pálpebras, brilho no alto, dobra da pálpebra, branco cor de creme) e **sobrancelha nova** (`browBar` virou uma
    forma cheia: ponta de dentro reta, pico a 70% e ponta fina de fora); **orelha** maior e mais baixa, com a concha e a
    dobra da borda (`earDetail`) e o contorno do rosto riscado por cima dela de frente; brinco pequeno na frente do
    lóbulo (aparece de frente); **nariz de frente** (`noseFront`: as asas em "C" e a curva da ponta; narinas em
    meia-lua; o risco de três quartos só aparece com a cabeça virada); **boca** mais baixa e larga, lábio de baixo
    com a sombra embaixo e a **pele do queixo** à mostra entre o bigode e a barba, com a mosca; barba larga embaixo
    (em U) e a esfera da frente do queixo abraçando o queixo (de perfil ele fica coberto); **cachos** na têmpora com o
    desenho dos fios (`curlLines`); **planos de sombra** do rosto (`facePlane`: as laterais e o fundo dos olhos).
  - *Lições:* (14) o crítico precisa achar os olhos pelos **pedaços** da cor (o brilho do brinco tem a mesma cor do
    branco do olho e puxava a medida); (15) uma peça de barba em casco único **enche as curvas**: para abrir a pele
    embaixo do lábio, o queixo virou peças separadas e uma esfera que começa mais baixo; (16) mudar o rosto de frente
    mexe nos outros ângulos: conferir as 8 direções a cada mudança grande (a barba nova deixou a boca "aberta" de
    perfil até eu pôr a esfera da frente do queixo); (17) a sombra própria de um pedaço (`faceShade` com `ownPoly`)
    tem de ficar recortada dentro dele, senão escurece a peça inteira.
  - *Ainda diferente da referência:* o **boné** é uma touca redonda (na referência, boné de verdade: a parte de trás
    com a fivela, a abertura em cima da testa, copa alta) — é a próxima rodada; a barba da referência é mais cheia e
    larga embaixo; as orelhas dela são maiores; o rosto dela tem mais planos de sombra (maçã do rosto, olheira).
- **Rodada 2 — a barba e o boné (18/11; o dono: "comparado com o que estava tá bom, o que incomoda é a barba e o
  boné"), só no ramo:**
  - *Referências das outras direções* (Nano Banana, mesma cabeça B girada, câmera reta, fundo verde): 45°, perfil (90°)
    e costas (180°) — 3 imagens, ~US$ 0,15 (total do piloto: 9 imagens, ~US$ 0,42). O outro lado é espelho. Também
    ficam fora do repositório.
  - *Barba:* quase preta (`PALETTE.hair` também é a do cabelo), **quadrada embaixo** (os lados descem retos da
    mandíbula: medido linha por linha com `MEDIR_BARBA=1` no crítico, a largura embaixo bate com a referência,
    ~840 px), cobrindo **a mandíbula inteira de perfil** (pedaços novos no canto e embaixo da mandíbula; antes, de
    perfil, era uma cunha pontuda) e com os **fios na borda** (`beardStrands`: pontinhas em 3D — uma esfera grossa
    dentro da barba e uma fininha fora, deitada na pele — na linha da bochecha, na borda de baixo e por baixo da
    mandíbula; por serem volume, aparecem certas em qualquer ângulo). Os pedaços do lado do rosto virado para lá vão
    numa peça à parte (`barbaLonge`, logo depois da cabeça e antes da boca): de três quartos eles cobriam os lábios.
  - *Boné:* virou um **elipsoide** (`CAP.a` = semieixos: mais comprido de frente para trás e mais alto que a cabeça)
    cortado pelo plano da barra — a copa na tela sai de `capShell` (a parte de fora que olha para a câmera e fica acima
    da barra; a conta é feita no "espaço da esfera", em que o elipsoide vira uma esfera). **A calota antiga era uma
    esfera centrada atrás da cabeça que não chegava até a testa: a testa escapava para fora dela de perfil e vista de
    cima** — o "boné fora da cabeça". Agora ele envolve a cabeça inteira acima da barra (conferido ponto a ponto contra
    as esferas da cabeça). Também: a **abertura em meia-lua e a fivela de furinhos** em cima da testa (`capOpening`),
    as costuras e a coroa recalculadas para o elipsoide, a **aba** maior, saindo da barra em gomos que acompanham a
    curva (um casco só achatava a aba numa placa que cobria a coroa) com a borda clara (`brimEdge`), os **óculos**
    maiores e mais baixos (logo acima da fivela, como na referência), e mais **cachos** na nuca, que agora ficam embaixo
    do boné (antes eram desenhados por cima dele de costas). `ficha.js` lê o alto do boné de `CAP.top`.
  - *Lições:* (18) um volume que deve **envolver** outro (boné na cabeça, roupa no corpo) precisa ser conferido ponto
    a ponto contra as esferas de dentro — a calota parecia certa de frente e escapava de lado e de cima; (19) peça
    única de barba desenhada depois da boca cobre a boca de três quartos: o lado de lá vai antes; (20) casco convexo
    achata o que é curvo (a aba): use gomos.
  - *Ainda diferente da referência:* a copa é mais redonda (a da referência é mais "quadrada", estruturada); o cabelo
    de trás da referência é um volume cacheado maior; o pescoço de perfil é grosso (é da rodada do corpo).
- **Rodada 3 — o corpo e a postura (19/11; o dono: "pode começar pelo Birim", depois de eu propor o corpo e a postura),
  só no ramo:**
  - *Referência:* a própria ficha do dono (8 vistas da mesma renderização, na pose A — a mesma da nossa ficha), medida com
    régua; para a câmera do jogo, o alvo do Nano Banana da rodada 1. **Nenhuma imagem nova** (custo zero).
  - *O crítico do corpo* (`ferramentas/critico-corpo.py <ficha.png> <sola, px> <nosso.png> <saida.png>`): a ficha e o
    nosso na mesma altura (do alto do boné à sola), alinhados pelo meio da cintura, os dois contornos um por cima do outro
    e a tabela das bordas em cm em cada altura (a figura da ficha sai enchendo o fundo cinza a partir das bordas, mais os
    buracos grandes e claros — entre as pernas). Foram 18 ciclos (k00 a k17), frente, perfil e costas.
  - *O que mudou:*
    - **Ombro de costas:** a ponte do ombro (do trapézio ao deltoide) só era desenhada de frente — de costas o deltoide
      virava uma bola grudada num tronco de ombro quadrado (no herói, o cabelo comprido cobria). `SHOULDER.back` (gancho
      novo do `renderer.js`; o herói não tem) deixa a ponte inteira de qualquer lado.
    - **Tronco em V:** dorsais mais altas e para trás, oblíquos e cintura mais estreitos (~3 cm a menos de cada lado na
      altura das costelas de baixo), o alto das costas mais cheio (de perfil as costas ficam mais cheias que o peito, como
      na ficha), o peitoral um pouco mais baixo e recuado e duas esferas estreitas na frente e atrás da cintura (de perfil
      ela desce cheia até a bermuda, sem fechar numa "bolsa" redonda). O deltoide ficou mais junto do corpo e o alto dele
      um pouco mais alto (com o trapézio abaixo da barba, a linha do ombro tinha descido).
    - **Pescoço:** a cabeça 3% menor (`headScale` 0,66: do alto do boné ao fim da barba são 15,0% da altura; na ficha,
      14,8%; eram 16,1%) e 2 cm mais alta (`headDrop` −1,5); o trapézio logo abaixo da barba e uma rampa dele atrás (de
      perfil a nuca descia reta, como uma coluna).
    - **Bermuda:** justa na cintura e no quadril, abrindo em "sino" na coxa de baixo; a perna dela é **oval** (`kf`, `ko`)
      e puxada para trás embaixo (`backKnee`, `backHem`), como o pano caído da ficha; com o joelho dobrado ela volta a ser
      redonda (`legBend`) — funda, correndo, ficava pendurada atrás do joelho como uma aba. Costura, barra, bolso e coroa
      usam a mesma conta (`legAt`).
    - **Canela em dois pedaços** (`SHIN_SPLIT`, outro gancho do renderer; o herói não tem): a panturrilha cheia logo abaixo
      do joelho e a canela de baixo fina — num casco só a perna virava um cone. Esticada, a perna é pintada como um volume
      só, então não aparece emenda.
    - Os riscos das costas (escápula, dorsal e coluna) agora acompanham a pele (`backPt`).
  - *Medido (de frente, cm a partir do meio, contando 174 cm de altura; ficha × agora, entre parênteses o antes):*
    costelas de baixo 14,3 × 15,8 (17,3); cós da bermuda 15,6 × 15,4 (19,7); quadril da bermuda 18,4 × 18,1 (21,5); coxa
    da bermuda 26,0 × 26,0 (28,7); a 78%, o alto do ombro 25,6 × 25,3 (27,9). De perfil, as costas a 74%: −16,7 × −15,5
    (−12,4); a bermuda atrás, a 30%: −16,1 × −14,6 (−10,0).
  - *Lições:* (21) o casco é convexo: **o que é côncavo não sai de uma peça só** — a cintura que entra embaixo das costas
    (vira um V reto), o pescoço entre os trapézios (o alto dos dois se liga numa reta na frente do pescoço: alto demais, ela
    tapa o pescoço) e a panturrilha (vira cone). Quando a curva para dentro importa, dois pedaços (a canela); quando não,
    a reta mais perto possível; (22) a régua mostra o que o olho não vê: a bermuda "larga" tinha cada perna da largura
    certa — o que sobrava era o alto do tubo saindo para os lados no quadril; (23) subir a cabeça muda todas as alturas
    em % (a altura total cresce): conferir de novo o que já batia; (24) forma boa em pé pode ficar ruim dobrada (a bermuda
    funda virou aba na corrida): olhar as animações **de perto** (`prancha.cjs '?zoom=4&modelo=birim'`).
  - *Ainda diferente da ficha:* de frente, na câmera do jogo, a barba cheia (a da referência aprovada) cobre o pescoço
    quando a câmera vê de cima — só encurtando a barba (decisão do dono); os ombros da ficha são mais altos e cheios em cima
    (a 80% da altura, ~3,5 cm a menos de cada lado: a linha do trapézio teve de ficar abaixo da barba para o pescoço
    aparecer); a cintura da ficha entra numa curva (a
    nossa é um V reto, ~1,5 cm mais larga nas costelas de baixo); na pose A o braço fica ~2,5 cm mais aberto em cima (é o
    ângulo da pose, não o braço); de perfil, na ficha, as pernas ficam um pouco atrás do tronco (a postura é a do
    esqueleto, a mesma do herói).
  - *Conferência:* herói idêntico ponto a ponto, os testes do protótipo (os 40 e os 6 que desenham o personagem), `npm
    run check` (510), o Birim em todas as animações (a corrida olhada de perto) e as 8 direções nas duas câmeras.
- **Rodada 4 — a cabeça de lado (19/11; o dono: "Da uma atenção na lateral, está ruim a barba, orelha, nariz etc.."),
  só no ramo:**
  - *Referência:* o perfil (90°) e os três quartos (45°) do Nano Banana da rodada 2 (fora do repositório), virados para
    o mesmo lado do nosso. **Nenhuma imagem nova** (custo zero).
  - *O crítico do perfil* (`ferramentas/critico-perfil.py <referência.png> <olhoX,olhoY,altoY,barbaY> <nosso.png>
    <saída.png>`): a referência e o nosso perfil na mesma escala, alinhados pelo **olho** e medidos **do olho ao fim da
    barba** (o boné da referência é mais alto que o nosso: pela altura da cabeça toda, o rosto saía pequeno); três
    quadros — a referência, o nosso e os dois um por cima do outro (nosso contorno em ciano, a borda do pelo em amarelo).
    Foram 12 ciclos (p01 a p12).
  - *O que mudou:*
    - **Orelha:** mais para trás e maior (as três esferas de `HEAD.ear`); de lado ela ganhou desenho (`earProfile`): a
      borda, a dobra de dentro com o garfo, a concha, o trago e a dobrinha do lóbulo. A concha desenhada de frente some aos
      poucos quando a orelha vira de lado.
    - **Costeleta e linha da barba:** a costeleta começa na altura do lóbulo, na frente da orelha, e uma tira fina sobe
      até o cabelo da têmpora — com a normal um pouco para trás, então de frente ela não aparece (a frente aprovada
      continua com a pele até a orelha). Os pedaços de trás da barba só andaram **para trás**: vistos de frente, têm a
      mesma largura e altura. A linha da bochecha desce na diagonal, da costeleta ao canto do bigode, como na referência;
      a barba cobre a mandíbula inteira e a borda de trás desce na diagonal até o fim dela.
    - **Cachos:** os do lado foram para trás da orelha, mais seis embaixo e atrás do lóbulo (de frente, aparecem do lado
      da mandíbula, como na referência), e todos ganharam os fios desenhados (`curlLines`).
    - **Fios da barba:** a ponta dos fios da bochecha não anda mais que ~1 para a frente (a pele que `faceY` acha é a da
      FRENTE do rosto: de perfil cada fio virava um risco comprido para a frente e, juntos, faziam uma borda reta, como uma
      máscara); os de perto do bigode ficaram mais curtos; os do lado de lá do rosto só entram com ele quase de frente,
      até ~13° (`farMin` em `piece`): de 15° a 45° eles se empilhavam numa coluna espetada do lado do nariz.
    - **Nariz:** a asa (uma curva em "C") do lado virado para a câmera, de três quartos e de perfil (`noseSide`).
    - **Queixo e bigode:** de perfil a barba cobre a frente do queixo logo abaixo do lábio (dois pedaços que só entram com
      o lado bem virado para a câmera — de frente, a pele embaixo do lábio continua); o bigode foi um pouco para trás (de
      perfil saía como um dedo).
  - *Lições:* (25) alinhar pelo que bate nas duas imagens: o boné da referência é mais alto, então a escala sai do rosto
    (do olho ao fim da barba), não da cabeça; (26) para uma peça aparecer **só de lado**, aponte a normal dela um pouco
    para trás (`[sx, -0.3, 0]`): de frente ela some sozinha; (27) mexer numa peça que aparece de frente só no eixo que não
    se vê de frente (aqui, para trás) preserva a vista aprovada; (28) um trecho de fios que aponta para a câmera vira uma
    coluna (os fios caem no mesmo ponto da tela), e o que é desenhado por cima da cabeça não é escondido por ela: o lado de
    lá precisa sair antes; (29) para achar um defeito, desligue uma parte de cada vez numa cópia de teste fora do
    repositório (aqui, os fios de um lado e depois do outro) — é mais rápido que adivinhar pela conta.
  - *Ainda diferente da referência:* o boné (a copa da referência é mais alta e estruturada); de perfil, o pescoço é mais
    grosso que o da referência (é o da rodada 3, medido na ficha do corpo); o nariz é mais redondo na ponta; a sobrancelha
    de perfil é uma barra grossa; de três quartos aparece um pedacinho de pele embaixo do lábio (é a pele da frente
    aprovada, vista de lado); de frente, na câmera do jogo, as faixas da barba sobem até a orelha (já eram assim).
  - *Conferência:* herói idêntico ponto a ponto, os testes do protótipo (os 40 e os 6 que desenham o personagem), `npm
    run check` (510), o Birim em todas as animações, a cabeça em 10 ângulos (de 0° a 180°) na câmera reta, de 5° a 60° nas
    duas câmeras e as 8 direções na câmera do jogo.
- **Rodada 4b — a diagonal e a diagonal de costas (19/11; o dono, olhando o "de perto" da rodada 4: "de tres quartos
  também está ruim o olho e sobrancelha, a barba também / o brinco do tres quarto de costas está errado, o olho e nariz
  ficou feio"), só no ramo:**
  - *Referência:* os três quartos do Nano Banana (45°) e a diagonal de costas da ficha do dono (135°). Nenhuma imagem nova.
  - *O que mudou:*
    - **Diagonal de costas:** o olho de perfil (`sideEye`) era desenhado inteiro até ~120°, como se o rosto ainda
      estivesse de lado; agora, depois do perfil, ele fica cada vez mais estreito, encolhendo para a ponta da frente
      (a do contorno), e some por volta de 105°; a sobrancelha, que ali é o próprio contorno, some um pouco depois. O
      nariz recolhe para dentro do rosto (`tuck`) e some por volta de 115° (era uma bolinha saindo da beira). O brinco,
      que fica na frente do lóbulo, saía em cima da barba: agora some depois de ~110°, quando a orelha é vista por trás.
    - **Sobrancelhas na diagonal** (`browBar`): de três quartos a forma fica mais macia — as beiradas alisadas na tela
      (a superfície tem os calombos das esferas, e a sobrancelha que a segue saía com um degrau), o pico arredondado e a
      ponta de dentro arredondada em vez de cortada reta. A de lá vai até onde o rosto ainda olha para a câmera e afina
      até a ponta ali (antes encurtava por uma conta fixa e virava uma cunha curta em cima do olho). A dobra da pálpebra
      desce para perto do olho (encostada na sobrancelha parecia uma segunda sobrancelha). Tudo isso entra com a cabeça
      virando (`soft`): **de frente nada muda** (conferido ponto a ponto).
    - **Barba na diagonal:** (1) a bochecha de lá, que fica atrás do rosto, era desenhada por cima dele e virava uma bola
      escura em cima do bigode, cobrindo o lábio de cima — agora o pedaço do lado de lá que já virou as costas para a
      câmera vai **atrás da cabeça** (`segsBack`): só aparece o que passa do contorno; (2) a frente da mandíbula e o
      canto da boca de lá, que são fundos, vão para trás da cabeça a partir de ~40° (`backMin` 0,35) — por cima, tapavam
      a pele embaixo do lábio, que a referência mostra de três quartos; (3) a ponta do bigode de lá vai atrás dos lábios;
      (4) um pedaço na superfície do queixo, do lado de cá, só a partir de ~12°, tapa o triângulo de pele que saía de
      baixo da barba; (5) os dois pedaços que cobrem a frente do queixo de perfil entram a ~63° na câmera reta e a ~55° na
      do jogo (entravam bem a 45°); a normal deles aponta um pouco para cima, por causa da câmera do jogo, que olha de cima.
  - *Lições:* (30) para sumir com algo que vira para longe, **encolher na direção em que ele some** (aqui, para o
    contorno do rosto) fica natural; apagar com transparência deixa um "fantasma", cortar deixa beirada reta e restos, e
    encolher para o lado errado deixa uma mancha no meio da bochecha; (31) **o que fica atrás do rosto vai atrás da
    cabeça**: desenhado por cima dela, um pedaço do lado de lá aparece no meio da cara (a bola do bigode, o tufo do lado
    do nariz, a pele do queixo tapada) — atrás, a própria cabeça esconde o que não se vê e o contorno continua inteiro;
    tirar bolas do pedaço (uma por uma) deixava bolas soltas na beira; (32) para achar qual peça faz o defeito, pinte cada
    pedaço de uma cor e escreva o número dele na tela (uma cópia de teste, fora do repositório): os números vêm na mesma
    ordem das chamadas no código.
  - *Ainda diferente da referência:* o lábio de cima quase não aparece de três quartos (o bigode fica em cima dele); a
    ponta do nariz é redonda; o boné; o pescoço de perfil.
  - *Conferência:* a frente idêntica ponto a ponto (câmera reta e do jogo); o perfil igual na câmera reta (diferença de
    no máximo 1 em 0–255) e, na do jogo, só um pedacinho de 22 × 13 px no queixo (numa imagem de 3000 × 4000); a cabeça de 0° a
    180° na câmera reta e as 8 direções nas duas câmeras; e a bateria (herói idêntico, os 40 testes do protótipo e os 6
    que desenham o personagem, `npm run check`, o Birim em todas as animações).
- **(DESFEITA em 19/11, a pedido do dono: "sem barba ficou pior" — o Birim voltou para a barba cheia da 4b. O código desta
  barba curta está no commit `e6c6d5d`.)**
- **A barba curta, pintada na pele (19/11; o dono, depois da 4b: "está horrível, vamos fazer sem barba o que acha?" — mostrei
  a prévia sem barba e recomendei a curta; ele escolheu "1", a curta), só no ramo:**
  - *Por que a cheia não deu certo:* ela era ~40 volumes (cascos de esferas) em volta da mandíbula, mais ~150 fios; cada
    ângulo mostrava pedaços diferentes, e cada rodada consertava um ângulo e estragava outro (a bola do bigode, o triângulo
    de pele, o tufo do lado do nariz, a pele do queixo tapada). As sobrancelhas e os olhos nunca tiveram esse problema
    porque são desenhados NA pele do rosto.
  - *Como é agora* (`shortBeard`, chamada no começo do rosto, antes dos lábios, do nariz e das orelhas, que ficam por cima):
    uma camada na pele, feita uma vez só (`beardGeom`: a cabeça não muda de forma; a cada quadro só se projeta) — uma grade
    de pontos da pele entre duas beiradas (`HEAD.beard.top` e `.bottom`, a metade direita, de trás para o meio, com o mesmo
    número de pontos), achados por raios saindo de um centro dentro da parte de baixo do rosto (`beardRay`: o ponto de fora
    entre as esferas do casco, sem o nariz). A cada quadro, em cada coluna da grade, fica o trecho que olha para a câmera,
    com as pontas no ponto exato onde ele deixa de aparecer (cortar quadradinho por quadradinho deixava escadinha); a boca e
    a pele embaixo do lábio ficam de fora (`hole`); a mosca embaixo do lábio; pontinhas de pelo só na beirada de cima (a de
    baixo é aparada — com pontinhas, de costas elas viravam raios embaixo da orelha), mais curtas no bigode; riscos curtos e
    claros por dentro (só com o personagem grande, `R.fine`). A sombra é a mesma meia-lua da pele da cabeça (a peça da
    cabeça passa a ir para o rosto: `face(R, rig, look, seg)`), então combina com a pele. De costas, o que fica embaixo da
    mandíbula sai (olha para baixo), as faixas finas presas à beirada de baixo também, e o que o **pescoço tapa**: com o
    rosto virado para lá, cada ponto testa se a linha até a câmera passa perto do eixo do pescoço (da base da cabeça,
    `HEAD.neckBase`, até a base dele no peito; com 0,6 da grossura — com a grossura toda, a barba do lado ganhava um corte
    reto). Sem isso, a parte de baixo do queixo, que vista por trás fica atrás do pescoço, saía em lasquinhas pretas em cima
    dele (o pescoço é desenhado antes da cabeça).
  - *Queixo:* subiu ~1,3 e ficou um pouco menor (`queixo` r 5 → 4,6; `queixoE/D` 4,3 → 4,1): ele tinha a grossura da barba
    cheia, e sem ela o rosto ficava comprido embaixo. O cabelo da têmpora e os cachos dele (que estavam junto com a barba)
    viraram a peça `cabeloTempora`.
  - *Custo:* ~9,3 ms por quadro para desenhar o Birim (antes, com a cheia, ~10,2), nesta máquina, sem placa de vídeo
    (`r6/bench.cjs` no rascunho; mediana de 5 × 40 quadros).
  - *Lições:* (33) **o que fica no rosto deve ser desenhado NA pele do rosto** (barba curta, sobrancelha, pintura): segue a
    superfície e fica certo em qualquer ângulo; volumes colados em volta da cabeça só valem para o que sai da silhueta (boné,
    orelha, cachos); (34) uma camada na pele precisa sumir onde a pele vira para longe — por coluna, com a ponta no ponto
    exato da virada, senão a beirada fica em escadinha; e o que só aparece de raspão (uma faixa fina) melhor sair.
  - *Ainda diferente da referência:* a barba da referência é cheia (aqui é curta, por escolha do dono); o boné; o pescoço de
    perfil.
  - *Conferência (na versão final):* a cabeça de 15 em 15°, a volta inteira, na câmera reta; as 8 direções nas duas câmeras;
    o Birim em todas as animações de perto; e a bateria (herói idêntico, os 40 testes do protótipo e os 6 que desenham o
    personagem, `npm run check`). Para achar as lasquinhas: pintar as faixas de uma cor e as pontinhas de outra numa cópia de
    teste, e listar os grupos de faixas desenhados em cada ângulo (o grupo pequeno e solto é o defeito).

### Lote 2 da lista do dono de 14/11 (na main em 14/11, com o "pode" do dono; junto, o `mundo/lote2-floresta-dentro`)
O lote 2: (6) tirar o J da barra, (7) árvores no vento, (8) flecha presa no tronco (feita antes), (9) capivaras
andando, (10) floresta dentro das casas.
- **(10) Floresta dentro das casas**, com o mapa do [mundo] (`mundo/lote2-floresta-dentro`, 90e0059, juntado no meu
  ramo; entra na main junto):
  - `tmj.js`: a linha `raiz` com `dentro` vira `inside` na forma do chão; a `planta` com `dentro`, `inside` no objeto;
    a casa ganha `vineInside` (`cipoDentro`, 0 a 1) e `mossInside` (`musgoDentro`).
  - `world.js`: o objeto com `inside` fica com `house` (como os móveis de `INSIDE_KINDS`): só aparece com a casa
    cortada e é "da casa" no foco.
  - `street.js` `innerRoot`: a raiz de dentro usa o `rootNetwork` das raízes da figueira com `home` = a casa (galho não
    atravessa parede nem sofá), `rise` (o começo sai de baixo da parede: o lombo sobe nos primeiros 22%) e
    `liftedFloor` (pedaços do piso levantados dos dois lados: placas de cerâmica, ladrilho e cimento, tábuas de taco;
    a beirada do lado da raiz sobe 4 a 10 cm e mostra a fresta escura). `groundAt` reconhece os pisos de dentro
    (`piso-ceramica`, `piso-taco`, `piso-ladrilho`, `piso-cimento`) e o tapete (lá, nada de pedaço: só a terra).
  - `casas.js` `innerGreen` (depois do `WALLS[morador]`): o musgo subindo do rodapé (`mossInside`) e o cipó: ramos que
    sobem do chão perto dos cantos (com um galho de lado) e, nas casas com gente, um ou outro descendo de uma fresta do
    teto (`PD.city.vine`). Na Budega (0,25) o cipó é pouquinho e fica atrás das prateleiras e dos engradados.
  - Conferir: `foto-casas.cjs` (scratchpad): fotos de fora e de dentro das quatro casas.
- **(6) O J saiu da barra** (só `style.css`): no computador, `.action[data-slot='shot']` não aparece e os outros andam
  uma casa (bordunada 0, fôlego 1, esquiva 2, defesa 3 — o `left` do `#guard-button` —, pulo 4; o 6º fica vazio). No
  celular (fim do arquivo), o tiro é `position: absolute` de 88 px no canto (deitado: o `#actions` anda 100 px para a
  esquerda e o tiro fica à direita dele; em pé: o `#actions` sobe 100 px e o tiro fica embaixo); o 2x2 com
  `grid-area` (bordunada, fôlego / pulo, esquiva); a mochila em cima do tiro (deitado) ou do 2x2 (em pé); deitado, a
  defesa e os frascos andam 100 px para a esquerda; em pé ficam (a metade esquerda é do joystick). Conferir:
  `celular-barra.cjs` (scratchpad): computador, deitado e em pé, com as caixas de cada botão.
- **(7) Árvores no vento** (parte da arte; a força vem da [estrutura]): `World.wind` ({ strength, angle }), `setWind`,
  `windAt(x, y, t)` (força × (0,55 + 0,75 × rajada²); as rajadas são duas ondas que andam no sentido do vento, a 1,5 a
  4,5 m/s) e `windScreen()` (o sentido na tela). `TreeCanopy._sway`: a mola do empurrão (2,4/s), o ritmo de cada árvore
  (0,45 a 0,95 Hz, as altas mais devagar) e a inclinação; o `draw` desenha a imagem pronta em 6 faixas (o alto vai
  mais; meio apagada ou quase parada, inteira). `PD.View.setWind(força, ângulo)`. Medido no zoom 1 (6 copas): parado
  1,1 px, brisa 2,6, forte 8,9; quadro médio 22 a 27 ms, igual ao jogo parado. Conferir: `vento.cjs` (scratchpad),
  que grava o vídeo com a legenda e mede.
- **(9) Capivaras andando** (parte da arte; o comportamento é da [estrutura], a área do [mundo]):
  `js/creatures/capivara.js` (`PD.creatures.define('capivara')`, no `arte.ts` e no `view-scripts.json`): as fatias da
  capivara do cenário (corpo de barril de -48 a +30 cm, cabeça de +30 a +60 girando em volta do pescoço), as 4 patas
  em diagonal (passada de 64 cm; correndo, mais aberta), o corpo sobe e desce; parada mais de 1,2 s, pasta quando o
  ruído deixa (a cabeça desce 55° e mastiga; as orelhas ficam da cor da cabeça); deitada (`lie`), o corpo desce 12 cm
  e as patas se recolhem. Ações: `sleep`/`deitar`, `wake`/`levantar`, `eat`/`pastar`, `dash`; `setAsleep`. Conferir:
  `ferramentas/prancha-capivara.cjs saida.png` e, no jogo, `capivara-jogo.cjs` (scratchpad: `PD.view.addActor` com
  `kind: 'pet', type: 'capivara'`).
## Onde estamos (9 de novembro de 2026)
Tudo na `main` (commit f9b1871, "Arte: personagem em camadas, loja e ouro..."):
- **Personagem em camadas** (`doll/`): quadro 64x64 desenhado com o dobro de pixels (`DENSITY` 2) e mostrado na
  metade. Corpo de ~26 px do mapa; `CHAR_TOP` 29 é a altura do nome. Animações (`ANIMS`): parado 4, andando 6,
  correndo 4 (esquiva), atirando 3, golpe 4, apanhando, desmaiado. Vistas: frente, costas e lado (espelhado).
  - **Rosto:** sprite separado (`face.ts`), com as expressões normal, piscar, dor, feliz, falando e desmaiado, mais
    óculos e sorriso.
  - **Corpo:** dois tipos (forte e esguio). Penteados curto, longo, espetado e trança; coque e fogo só de NPC.
  - **Textura:** uma por combinação de aparência + roupa, dividida entre quem é igual e desenhada aos poucos (6 ms por
    quadro do jogo). A câmera usa sempre zoom par, para o dobro de pixels ficar nítido.
- **Equipamento no corpo** (`gearArt.ts`, pelo `icone` do item): chapeu_palha, gorro, capacete_sucata, couraca,
  tunica, chita_avental, tunica_folhas, gibao, armadura, luvas, manoplas, botas, colar, colar_sementes, ferradura,
  capa, estilingue, facao, faca, machadinha, arco, escudo_jabuti, escudo_bueiro. O teste avisa se um equipamento de
  `data/items.json` ficar sem visual.
- **NPCs com aparência própria** (`NPC_LOOKS` em `characters.ts`):
  - **Dona Iracema:** cabelo grisalho em coque, óculos, sorriso, vestido de chita com avental e colar de sementes.
  - **Curupira:** cabelo de fogo que tremula, pés virados para trás, descalço, túnica de folhas.
- **Loja e ouro:** moeda desenhada com flor de ipê (`coinArt.ts`, usada pelo CSS em `--coin`) e sons de moeda, compra e
  venda. A janela da loja é uma barraca de feira (toldo, retrato, fala no balão, abas Comprar e Vender).
- **Conversa com NPC e missões** (`talk.ts`): mesmo painel da loja, com cipó em cima, retrato e fala no balão (verde
  quando ele responde a uma entrega).
  - **Cartões de missão:** selo ! (nova), ? (pronta) ou … (fazendo), objetivo com barra de progresso e a recompensa
    em fichas.
  - **Na tela:** a lista de missões tem barrinha; em cima do NPC aparece um selo dourado com !, ou verde com ?.
- **Monstros pintados** (`monsterPaint.ts`, mesmo pincel do personagem):
  - **Jacaré Mutante:** abre a boca no bote.
  - **Boto Encantado:** de chapéu branco; pula na cauda e cospe o jato.
  - **Iara (chefe):** bola d'água na mão e pose de canto própria, a animação `special` ligada pelo `fx` `song`.
  - **Quadros de cada um:** parado, andando, armando, golpe e (se tiver) especial.
  - **Monstros antigos:** sagui, jararaca, saci, corpo_seco, capelobo e mula_sem_cabeca continuam 16x16 em
    `monsterArt.ts`, menores que um jogador.
- **Efeitos** (`effects.ts`):
  - **Jato d'água (`agua`):** gotinhas atrás e respingo azul.
  - **Canto da Iara:** notas coloridas se espalhando pela área, com um anel no alcance.
  - **Jogador encantado** (`EntityView.charm`): pisca azul, anel azul no chão e notinhas em cima do nome.
- **Ícones 16x16** (`itemArt.ts`): banana, couro, escama, dente, chapeu_palha, estilingue, colar, gibao, gorro, erva,
  sucata, faca, couraca, ferradura, mochila.
- **Sons sintetizados** (`sfx.ts`): shot, hit, hurt, warn, dash, levelup, death, heal, kill, arc, loot, rare, equip,
  charge, fire, coins, coin, buy, sell.

## O piloto do estilo desenhado (Nano Banana): onde parei
**Por que:** por código, o personagem sempre sai pixelado. O dono quer o estilo dos prints que ele mandou no começo:
jogo desenhado à mão, com contorno de tinta escuro, sombreado suave e câmera de cima (três quartos). A outra
referência que ele mandou é uma ficha de personagem em pixel art bem detalhada: guerreira ruiva de capa verde e
armadura, vista de costas, de frente e de lado. As imagens ficaram só na conversa antiga. Se precisar, peça de novo;
use só como guia de estilo, sem copiar personagem de outro jogo.

**O plano (proposto e aceito):**
- **O Nano Banana desenha as peças:** cabeça, tronco, braços e pernas nas 3 vistas, e cada equipamento separado, em
  fundo verde liso.
- **Eu monto:** tiro o fundo e monto as peças no esqueleto que já existe (`doll/poses.ts`), aproveitando animações,
  equipamento por parte e troca de roupa na hora.
- **Piloto:** um personagem só (Dona Iracema, Curupira ou o do jogador; o dono escolhe), nas 3 vistas, parado,
  andando e atacando, rodando no jogo para comparar.
- **Atenção:** se só o personagem ficar desenhado, ele destoa dos mapas e monstros em pixel art. Mudar o estilo é
  decisão do jogo inteiro e envolve o [mundo].

**Pronto:**
- **A chave funciona.** O dono criou a chave do Gemini no Google AI Studio, com faturamento no Nível 1. Ela está no
  ambiente da nuvem "Default", em **Segredos de rede**: host `generativelanguage.googleapis.com`, cabeçalho
  `x-goog-api-key`, sem prefixo. O proxy põe o cabeçalho em cada chamada e eu nunca vejo o valor. O formulário seguro
  (`request_credential`) não serve, porque só aceita `Authorization: Bearer`.
- **O script** está em `scripts/nano-banana.py`, no ramo `claude/blissful-meitner-hp1i5e`, commitado mas fora da
  `main` porque é trabalho pela metade.
  - **Conferir a chave:** `python3 -I scripts/nano-banana.py --listar` (não gera imagem, não custa).
  - **Gerar:** `--out arquivo.png --prompt "..." [--model] [--aspect] [--size] [--ref imagem.png]`.
  - **Trava própria:** 120 imagens ou US$ 10 estimados. A contagem fica em `saves/nano-banana.json`, fora do Git.
  - **Por que curl:** o `fetch` do Node não usa o proxy da nuvem; o curl usa.
- **Modelos disponíveis**, com preço por imagem 1K de sites de terceiros (a página oficial não abriu):
  - `gemini-nano-banana-2.1` (Nano Banana 2.1, o mais novo): ~US$ 0,034; 2K ~US$ 0,05. **Comece por ele.**
  - `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite): ~US$ 0,034.
  - `gemini-3.1-flash-image` (Nano Banana 2): ~US$ 0,067.
  - `gemini-2.5-flash-image` (Nano Banana, antigo): ~US$ 0,039.
  - `gemini-3-pro-image` (Nano Banana Pro): ~US$ 0,134.
  - **Custo do piloto:** com 60 a 100 imagens no 2.1, ~US$ 2 a 3,50.
- **O plugin de terceiros** `Ibrahim-3d/nano-banana-claude-plugin` foi avaliado e não é preciso. Ele também depende da
  chave, guarda a chave num arquivo de texto e eu chamo a mesma API direto.

**Parei aqui:** nenhuma imagem foi gerada (gasto: US$ 0). O dono pediu **"espera pra eu mandar mais exemplos e tentar
gastar mesmo"**. Pedi a ele:
1. imagens do estilo que quer (servem até de outros jogos, só como guia);
2. exemplos com a câmera de cima, como a do nosso jogo;
3. por qual personagem começar.

Também pedi que confirmasse o **teto mensal de US$ 15** no AI Studio (Spend → "Monthly spend cap"); ele ainda não
confirmou.

**Quando os exemplos chegarem:**
1. Faça 1 ou 2 testes de estilo (~US$ 0,03 cada): uma ficha de frente, lado e costas em fundo verde liso `#00FF00`,
   e mostre.
2. Só com o "pode" dele, siga para as peças e a montagem.

## Esperando outras frentes
- **[estrutura]:** pôr o botão de pular na barra (`{ slot: 'jump', label: 'Pular', key: this.keys.label('pular') }`
  no `makeActionBar` e o `tryJump` no `onAction`). Ela liga assim que o meu ramo (o `ActionSlot` 'jump' do `ui.ts`)
  entrar na main (antes disso a main não compila): **avisar a [estrutura] quando entrar**. Já feitos por ela (main
  6e44ee0): a letra menor no botão da defesa (`long`/`longer` no `setKey`) e o `on: 'agua'` no fim do alcance em cima
  da água (conferi o mergulho da flecha no lago). O desenho do arco, o Joaquim (`canDraw`) e o botão do som no celular
  entraram na main em 14/11, e a [estrutura] ligou o arco (main 0765f59): conferi no jogo (a mochila equipa, o botão
  vira "Arco", a flecha voa e crava). Observação dela: no zoom padrão a tela mostra uns 10 m do herói; a flecha com
  carga cheia (13 m) pode cravar fora da tela (não é erro). Se o dono quiser, a câmera pode andar um pouco para onde
  se mira enquanto puxa o arco (é da view: `follow`).
- **[mundo]:** a Dona Iracema aparecia por cima do balcão da barraquinha (o balcão desenhado na frente das pernas).
  O [mundo] anotou o pedido; confira no jogo se ficou certo.
- **[estrutura]** (ideia, não pedida ainda): o servidor só avisa o próprio jogador de que ele está encantado
  (`charm`), então os outros não veem o brilho azul em quem foi encantado. Se o dono quiser que todos vejam, é pedido
  para a [estrutura].

## Próximos passos possíveis (o dono escolhe a ordem)
- **Esperando o dono (17/11; ele estava fora de casa, sem poder testar):** (1) o teste dele, no PC, do zoom da
  conversa, que entrou na main em 17/11 (a seção "O tranco do zoom da conversa" diz o que conferir: conversar com a
  Xiovanna e com o Curupira, a roda do mouse, os Olhos de Gavião; se algo piorar, desfazer é reverter o commit
  6e690d6); (2) o teste dele do braço do arco e da esquiva B, que já estão na main (se a saída agachada der sensação
  de "travar no fim", encurtar `ROLL_SHAPE.crouch`; "volta a esquiva" desfaz); (3) a escolha do que vem depois
  (ofereci: os ícones de item que faltam em pintura, o Curupira no 2.5D).
- **Biblioteca de animações do Quaternius como REFERÊNCIA de movimento** (16/11; o dono disse "sim" à sugestão da
  [estrutura]: abrir, ver onde ficam cotovelo, quadril e pés quadro a quadro, e acertar as nossas poses por elas — sem
  importar nada: o esqueleto delas não é o nosso). O dono deu o "pode ser" (16/11) para o primeiro passo: a comparação
  do rolamento está feita, ele escolheu a opção B (o mergulho curto) e ela está na main (seção "A esquiva comparada
  com o rolamento de referência"). Daqui para a frente a biblioteca serve para as poses novas (corpo a corpo, salto,
  apanhar: a Fúria da Onça, quando voltar). O que sei dela, lendo os arquivos de verdade:
  - A pasta do PC dele (`E:\baixados-mmorpg`) não aparece daqui. Baixei os dois pacotes **gratuitos** (CC0, enviados
    pelo próprio Quaternius) para o rascunho, fora do projeto:
    `https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip` e
    `.../universal_animation_library_2standard.zip`. Cada um traz um `.glb` com todas as animações.
  - Um `.glb` se lê sem Blender e sem executar nada: cabeçalho de 12 bytes, um bloco JSON (os ossos em `nodes`/`skins`,
    as animações em `animations`, com nome, canais e tempos) e um bloco binário com os números.
  - **Biblioteca 1** (46 animações, 53 ossos `DEF-...`): tem `Roll` e `Roll_RM` (1,47 s; RM = o corpo anda de verdade),
    `Jump_Start`/`Jump_Loop`/`Jump_Land`, `Punch_Jab`/`Punch_Cross`, `Sword_Attack`, `Hit_Chest`/`Hit_Head`, `Death01`,
    andar, trotar, correr, agachar, nadar, sentar, pistola e magia. **Não tem arco.**
  - **Biblioteca 2** (43 animações na gratuita, 65 ossos): `Slide_*`, `Shield_*`, `Sword_Regular_A/B/C` e o combo,
    `Sword_Dash_RM`, `Melee_Hook`, `NinjaJump_*`, `OverhandThrow`, `Hit_Knockback`, `ClimbUp_1m_RM`, roça, zumbi.
    **Não tem arco nem rolamento.** A versão paga (Source, US$ 14,99 cada) eu não vi por dentro: não sei se tem arco.
  - Então a referência serve para o **rolamento** (e, depois, golpes de corpo a corpo, salto e apanhar: a Fúria da
    Onça); para a **puxada do arco não há referência** nos pacotes gratuitos (ela foi refeita em 16/11 pela conta do
    arqueiro, medida: seção "O braço do arco, redesenhado").
  - Outros materiais que ele baixou, da minha frente (só para saber; nada entrou no jogo, o jogo não abre 3D, e o
    estilo é fantasia medieval de poucos polígonos): KayKit Fantasy Weapons Bits, FlameFXFree e Stylized Nature MegaKit
    (CC0); MagicProjectilesVFX sem licença no zip (**não usar** até conferir).
  - **Decisão do dono sobre esses materiais** (16/11, repassada pelo [mundo], que conferiu as licenças nas páginas
    oficiais): os CC0 (Stylized Nature MegaKit, KayKit Furniture Bits, Cooking Assets) servem **só de modelo, de
    referência** para criarmos o nosso desenho; o estilo medieval em si fica de fora; **nenhum arquivo é copiado para o
    projeto**. O pacote "Campos do Jordão" (CraftPix) **não usar**: a licença proíbe distribuir os arquivos da arte, e o
    projeto fica no GitHub.
- **Pedidos novos das frentes (14/11, esperando o dono escolher a ordem):**
  - **Os quatro bichos novos** (main 7d6a75f, protocolo 34; hoje saem como boneco de gente com o nome): `quati`
    (bando de 4, focinho comprido, rabo listrado em pé; golpe 'bite'), `tatu_bola` (carapaça em gomos; 'charge' =
    vira bola, rola e abre; 'block' = a casca segurou o golpe de frente, o "tlinc"; 'dizzy' = desenrola tonto, 2 s),
    `marimbondo` (enxame de 4 a 6 vespas em volta de um centro; 'spin' = ferroada em volta; 'dodge' = a pedra passou
    pelo meio, as vespas se espalham) e `filhote_boitata` (cobra pequena de fogo azulado e laranja, olhos acesos; 'charge'
    com o rastro de fogo da Mula; 'vanish' = vai embora ao amanhecer: a [estrutura] atrasa o despawn uns 600 ms se eu
    pedir). Criar pelo menu ADM (tecla G; o boitatá só de noite).
  - **Dia e noite** (main 95bfcf3, protocolo 33): `setTimeOfDay({ light, night })` no `WorldView` (light de 1 a 0 em
    passos de 0,01, o anoitecer e o amanhecer em 1 minuto; `night` = olhos vermelhos em todos os bichos). Testar: ADM
    "Virar dia"/"Virar noite" e `window.__mundoNovo.time()`. Lampiões: quando o [mundo] marcar.
  - **Caçador da Floresta** (main 7b2155b; regras e visual provisório da [estrutura]; o dono decidiu em 15/11: todo
    mundo começa igual, escolhe a classe depois das missões do começo, 1 ponto por nível, até 5 em cada habilidade, o
    visual muda com 3 e com 5 pontos; a Bordunada saiu do jogo novo e o Fôlego ficou): (1) os ícones pintados das 5
    habilidades (ids de data/classes.json: `chuva_de_flechas`, `flecha_ancestral`, `olhos_de_gaviao`,
    `chamado_selvagem`, `furia_da_onca`; hoje provisórios em `src/client/novo/skillIcons.ts`, ou um
    `paintedSkillIcon(id)` no `paintedIcons.ts`); (2) a barra: o `skill0` agora é a 1ª habilidade da classe (o motor
    troca o ícone por fora; um jeito oficial no `ui.ts`, ex. `ActionDef.icon`), e mais quadrados para as próximas 4
    habilidades (PC e celular); (3) o desenho da Chuva de Flechas (hoje `drawAim`/`drawRainGround`/`drawRainAir` no
    `combat.ts`; por pontos: 1–2 madeira, 3–4 brilho dourado, 5 espírito verde; ou um `view.rain?(...)` na PD.View);
    (4) a janela das Habilidades (`#skills-panel`, `#skills-button`, `skillsPanel.ts`) no estilo da HUD; (5) o "Como
    jogar" (Q mira a Chuva, K abre as Habilidades; no celular, ✦); (6) talvez uma pose de atirar para o alto (dizer o
    nome da ação à [estrutura]). Testar: missão `saguis_encantados` concluída e nível 3+; `__mundoNovo.hero()`.
  - **O mapa (M) e o mini mapa** (main 5f01bf9, protocolo 36; o desenho provisório é o `mapWindow.ts` da [estrutura]):
    deixar bonitos a `#map-window` (o mapa inteiro com a neblina, os nomes, os NPCs com ! e ?, a seta) e o `#minimap`
    (o dono, 15/11: "horrível"; o rascunho redondo, girado como a câmera, com anel de madeira e N, está proposto; e
    "ao invés de setinha deveria ser um ponto": um ponto dourado com contorno branco, pulsando)
    (PC: 148 px embaixo da mochila; celular: 96 px embaixo do retrato), tudo por CSS de id; girar a imagem para bater
    com a câmera é pedido ao motor. Ganchos: `__mundoNovo.explored()` e `mapOpen()`.
  - **Floresta maior do [mundo]** (PASSOU PARA O [mundo] em 19/11, com o desenho do mapa; fica a lista do que faltava
    desenhar) (`mundo/floresta-maior`, a ponta mais nova: 2646760, com as áreas dos bichos novos; o
    Capão vai a 96 × 180 m): só entra na main com o
    desenho: `arvore` `especie: 'paineira'` (tronco de garrafa com espinhos, copa de flor rosa `flores`, pétalas no
    chão); `parquinho` (`brinquedo` 'balanco' com `quebrado`, 'escorregador' com `olhando`, 'gira-gira' com `plantas`;
    `ferrugem`, `cipo`); `cachoeira` (pedras de onde o riacho cai: `altura`, `queda`, `musgo`); `pinguela` com `pedras`;
    o posto abandonado: `cobertura` (some ou fica transparente com o herói embaixo/atrás, como o telhado; `pilares`,
    `mato`, `cipo`, `arvoresNoTopo`), `bomba`, `pneus` (`pilha`), a lojinha `casa` com `posto`, `vitrineQuebrada` (porta de
    enrolar meio aberta) e a `placa` grande em branco `torta`; o `gradil` com `estado: 'quebrado'`. Referências no ramo
    dele: `docs/referencias/floresta-maior-*.jpg`.
0. Feito em 15/11: os ícones pintados do Estilingue de Goiabeira (`estilingue`) e da Faca de Sucata (`faca`), em
   `paintedIcons.ts` (`limb` = galho ou cabo em traço grosso). Ainda em pixel: `chapeu_palha`, `gorro`, `gibao`,
   `couraca`, `colar`, `couro`, `dente`, `escama`, `ferradura` e `sucata`. Prancha: `icones/entry.ts` no scratchpad.
   - Opcional: restilizar os itens dos bichos no chão (hoje o desenho provisório da [estrutura], `drawDrops` no
     `combat.ts`: o ícone do item caindo com quique, "×N", brilho dourado no raro, laranja com facho no lendário).
1. **Piloto do estilo desenhado** com o Nano Banana (esperando os exemplos do dono, veja acima).
2. **Monstros antigos no capricho novo** (`monsterPaint.ts`): sagui, jararaca, saci, corpo-seco, capelobo e Mula sem
   Cabeça. Hoje são 16x16 e menores que um jogador. Se o piloto aprovar o estilo desenhado, faça já nesse estilo.
3. **Música da vila e sons de verdade** (roteiro).
4. **Boitatá** (chefe) quando a [estrutura] fizer, e a lenda do Shopping do Largo Treze.
5. **Pequenos acertos vistos:**
   - os tiros de monstro saem do meio do quadrado, não da boca do boto ou da mão da Iara;
   - as notas do canto são grandes (10x12 px do mapa); se o dono achar demais, desenhar menores.

## Como confiro (receitas)
- **Zoom (conversa, roda, Olhos de Gavião) sem tranco e sem borrar:** as ferramentas `zoom-*.cjs` de
  `prototipos/pindorama-25d/ferramentas/` (medem no jogo de verdade; a lista está na seção "O tranco do zoom da
  conversa"). Mexeu em `world.js`, `props.js`, `ground.js` ou na câmera da `view.js`? Rode pelo menos o
  `zoom-perfil.cjs` (curupira e budega) e o `zoom-fotos.cjs conversa` com o `zoom-fotos-comparar.py`.
- **Prancha:** `npm run render:characters` (`-- --so Curupira --escala 4 --out arquivo.png` para um só). Os monstros
  pintados ficam embaixo.
- **Criatura de bolas do 2.5D sem entrar no jogo:** `node prototipos/pindorama-25d/ferramentas/prancha-joaquim.cjs
  saida.png poses` (ou `tiras`): carrega os scripts do `view-scripts.json` numa página e desenha a criatura em cada
  pose; serve de modelo para outra criatura.
- **Testes de arte:**
  - equipamento sem visual;
  - quadro do personagem sem nada cortado nas bordas, com o fogo do Curupira dentro;
  - chapéu, rosto e arma acompanhando a cabeça e a mão;
  - pés virados do Curupira;
  - monstro pintado inteiro dentro da moldura, com os pés no chão;
  - animações diferentes entre si.
- **Navegador:**
  1. `npm run build` e `MEUMMO_SAVE=<arquivo temporário> npm start`. **Religue o `npm start` depois de cada build**,
     senão a tela de entrada trava.
  2. Abra pelo Playwright em 1280x760 com `deviceScaleFactor: 2` e no celular (`devices['Pixel 7']`). Entre por
     `#name`/`#password`/`#login-button` e espere `window.__meummo.me`.
  3. Para andar até alguém: `__meummo.walkTo(x, y)` num quadrado **ao lado** dele (em cima, os dois se sobrepõem).
  4. Para clicar num NPC: `__meummo.screenOf(x, y)` + `page.mouse.click`.
- **Levar para outro mapa e curar** (servidor de teste): `fetch('/admin/api/jogador', { method: 'POST', headers: {
  'content-type': 'application/json', 'x-meummo-admin': '1' }, body: JSON.stringify({ acao: 'levar', id, mapa:
  'billings', x, y }) })`. Se responder "não achei chão livre", tente outro quadrado. Para curar: `{ acao: 'curar', id }`.
- **Criatura que ainda não está no mapa:**
  1. Crie uma cópia separada com `git worktree add <rascunho> HEAD`.
  2. Na cópia, ligue o `node_modules` (`ln -s`) e passe o objeto da camada `lendas` para `monstros` no `.tmj`.
  3. Rode `build` e `start` a partir da cópia; no fim, `git worktree remove`.

  O `.tmj` de verdade, que é do [mundo], fica intocado.
- **Para a missão ficar pronta para entregar:** um laço no Playwright que clica no sagui mais perto a cada 350 ms e
  cura pelo painel a cada 8 cliques (5 saguis em ~25 s).
- **Juntar na `main` (com o "pode" do dono):**
  1. `git checkout -B juntar-main origin/main`, depois `git merge --squash <ramo>`, `npm run check`, commit e
     `git push origin juntar-main:main`.
  2. Depois, junte a `main` no ramo com um merge normal. Recomeçar o ramo com força (`--force-with-lease`) foi
     bloqueado pela permissão do ambiente.
