# Roteiro

Cada etapa termina com algo jogável. Só passamos para a próxima quando a atual estiver boa de jogar.

**Quem faz o quê:** cada tarefa aberta tem a etiqueta da frente — **[estrutura]** (servidor, regras, dados,
salvamento), **[arte]** (personagens, monstros, ícones, telas, sons), **[mundo]** (mapas e tiles) ou **[dono]**
(jogar e decidir). Cada chat pega só as suas; detalhes em `CLAUDE.md`, "Divisão do trabalho".
A visão do jogo está em [DESIGN.md](DESIGN.md).

## ✅ M0 — Mundo vivo
- [x] Servidor autoritativo, atualizando o mundo 20 vezes por segundo
- [x] Mapa feito no Tiled, lido do mesmo arquivo pelo jogo e pelo servidor
- [x] Andar em grade com teclado (WASD/setas) ou clicando/tocando no chão (busca de caminho A*)
- [x] Movimento sem atraso: o jogo prevê o passo e o servidor confirma ou corrige
- [x] Ver outros jogadores em tempo real, só quem está perto (área de visão)
- [x] Chat com balão de fala e proteção contra spam
- [x] Funciona no computador e no celular
- [x] Bots para testar e testes automáticos

## ✅ M1 — Combate de ação (folclore brasileiro)
- [x] Tema decidido: fantasia com folclore brasileiro (ver DESIGN.md)
- [x] Monstros definidos em `data/monsters.json`, com áreas de nascimento desenhadas no Tiled (camada `monstros`)
- [x] Sagui Travesso (joga frutas e mantém distância), Jararaca (bote com aviso) e Saci (mini-chefe com giro e redemoinho)
- [x] IA: passear, perceber o jogador, perseguir, desistir e voltar para casa se curando
- [x] Estilingue com mira (mouse ou automática no celular); projéteis param em árvores e paredes
- [x] Golpes dos monstros avisados no chão (quadrados vermelhos) — dá para desviar
- [x] Esquiva com invencibilidade, Bordunada (arco) e Fôlego (cura), com recargas visíveis
- [x] Vida, dano, XP e nível; desmaio e volta para a vila; vida que volta sozinha
- [x] Números de dano, barras de vida, painel com vida/XP/nível, botões grandes no celular
- [x] Testes automáticos de combate e teste no navegador (PC e celular); bots caçadores (`npm run bots -- 6 --cacar`)

## 🔧 Refinamento do M1 (para jogar e ajustar juntos)
Tudo isto se ajusta mexendo em números, sem programar:
- [x] Andar em 8 direções (W+D = diagonal), escorregando nas paredes; monstros e o clique para andar também usam diagonais
- [x] **[estrutura]** Monstros que atacam (o dono jogou em 10/11: "só atacam se você ataca"): todos atacam sozinhos
  (o sagui e o boto também) e percebem de mais longe (4 a 6 tiles); quem acabou de chegar de outro mapa, de acordar
  ou de entrar onde tinha parado tem 3 s de folga. A diagonal passa rente à quina de árvores e paredes (acabou a
  escadinha entre as árvores), mas não espremida entre duas
- [ ] **[dono → estrutura]** A velocidade do personagem e dos monstros está boa? (`STEP_MS` em `src/shared/constants.ts`; `passoMs` em `data/monsters.json`)
- [ ] **[dono → estrutura]** Os avisos dão tempo de desviar? (`preparoMs` de cada monstro)
- [ ] **[dono → estrutura]** O dano e a vida estão justos? (`vida`, `dano` nos monstros; `src/shared/progression.ts` para o jogador)
- [ ] **[dono → estrutura]** Subir de nível está rápido ou devagar demais? (`xp` dos monstros e `xpToNext`)
- [ ] **[dono → estrutura]** O Saci está forte demais para quem é nível 1? (ele é para nível 3+ ou para grupo)
- [x] Sons sintetizados (estilingue, acerto, aviso embaixo de você, esquiva, nível, desmaio) — tecla M desliga
- [ ] **[arte]** Música da vila e sons de verdade (gravados ou de banco gratuito)
- [ ] **[arte]** Arte de verdade para personagens e monstros (piloto do estilo desenhado com o Nano Banana: chave
  pronta, esperando os exemplos de estilo do dono — veja `docs/ARTE.md`)
- [x] **[arte]** Protótipo **Pindorama 2.5D** do protagonista, separado do jogo (`prototipos/pindorama-25d`): câmera
  isométrica, estilo HQ desenhado só por código (Canvas 2D), esqueleto 3D com IK, parado/andar/correr/agachar/pular/
  soco em 8 direções, esquina de São Paulo, controles de PC e celular, arquitetura de equipamento sem itens
- [x] **[arte]** Protótipo 2.5D, refino pedido pelo dono em 10/11: soco sem trancos, cabeça girando com o corpo e
  andar menos robótico (diagnóstico medido e plano em `docs/ARTE.md`)
- [x] **[arte]** Protótipo 2.5D, redesenho pela referência do dono (10/11): rosto mais forte com pintura de urucum,
  faixa trançada, cabelo comprido com duas tranças, coroa de penas, brincos e colar de garras, corpo mais largo,
  mãos com dedos e pés com dedos (sem arma e sem armadura: a aljava e a capa de penas ficam para equipamento)
- [x] **[arte]** Protótipo 2.5D, ajustes do dono na versão 5: orelha à mostra (cabelo dos lados puxado para trás),
  rosto sem "focinho", ombros sem junta de boneco e músculos sem exagero
- [x] **[arte]** Protótipo 2.5D, ajustes do dono na versão 6: tronco sem defeitos na virada (trança e lombar), ombro
  liso do pescoço ao braço, efeito do soco menor (e atrás do corpo de costas) e braços do pulo sem "dab"
- [x] **[arte]** Protótipo 2.5D, auditoria do dono (versão 8): ombro, joelho, proporções, mãos, pés, cabelo, penas e
  tanga; pulo sem erro no IK (era 19–28 cm), agachado com peso para trás, transições; validação de encaixes, perfis de
  classe, ordem de desenho pelas superfícies e exportação de sprites padronizados em camadas (`exportar.html`)
- [x] **[arte]** Protótipo 2.5D: revisão 17 do dono (combate de treino com estilingue, carga, guarda com energia,
  esquiva, queda e som) no repositório como a oficial, só código, LEIA-ME e dados dos testes
- [ ] **[dono]** Decidir o rumo depois do protótipo: levar o personagem procedural para o jogo, mudar a câmera para
  isométrica (refaz todos os mapas) ou seguir só com o estilo
- [ ] **[arte]** Monstros redesenhados no mesmo capricho dos personagens novos (hoje são 16x16, menores que um jogador;
  o jacaré e o boto já nasceram assim, em `monsterPaint.ts`)
- [x] Mapa, passo 1 — profundidade e vida: árvores grandes (copa por cima do personagem, que fica transparente
  quando alguém passa embaixo), postes altos, mata fechada nas bordas, sombras de casas e prédios, água
  balançando, fogueira crepitando com brilho em volta (camadas `sombras` e `acima` do Tiled)
- [x] **[mundo]** Mapa, passo 2 — Refúgio caprichado: beiradas suaves entre água, areia, grama, terra e lama
  (com espuma na beira da represa), a parte funda escurecendo aos poucos, grama/areia/terra com mais detalhe, casas
  coloridas na escala dos personagens novos (porta de 2 tiles, janelas acesas, floreiras), lamparinas nos píeres,
  bandeirinhas de festa junina, varais, redes de pesca, caixotes, barris e cestos de peixe
- [x] **[mundo]** Mapa, passo 3 — Santo Amaro caprichado: prédios com fachada de 2 andares (mais altos que quem
  passa: janelas, marquise, lojas fechadas, lambe-lambe, pichação, cipó), entulho caprichado, brasas soltando faíscas
  e tambores com fogo no largo da Mula, mato escuro avançando no concreto, neblina e o lugar mais escuro

## 🎮 Sensação de jogo (pedido do dono em 10/11: "andar engessado, trava longe das coisas")
Hoje o personagem anda de quadrado em quadrado e a colisão é do quadrado inteiro (uma árvore bloqueia 2 quadrados,
mas o tronco tem 6 px). A correção é o **movimento livre**, em entregas jogáveis:
- [x] **[estrutura]** Movimento livre, passo 1: o personagem anda solto (posição em fração de tile, 1 tile = 1 metro),
  com um pé pequeno (caixa de 0,6 × 0,4 onde o pé é desenhado) que desliza nas paredes e escorrega de raspão para
  entrar em passagens; 360 direções (pronto para o joystick); o servidor continua mandando (pedaços de 50 ms com
  "orçamento" de tempo, previsão no navegador). Monstros continuam de tile em tile. No `EntityView.ts` (da [arte]),
  só a perna passou a acompanhar a distância andada
- [x] **[estrutura]** Correções do andar (13/11, achadas pelo [mundo]; valem para os dois jogos): andar sem parar uns
  10 s derrubava a conexão ("mensagens demais": a trava era de 15 mensagens por segundo e o andar solto manda 20) —
  agora 40 por segundo; e o "andar até" ficava indo e voltando perto do destino — agora para quando nenhum passo
  aproxima mais
- [x] **[estrutura]** "Andar até" do jogo novo pelo tamanho exato do pé (13/11, achado pelo [mundo] na etapa 4b): não
  raspa mais em poste e banco (a rota de tile em tile travava de frente neles), recalcula se travar e, se não der,
  avisa e larga a rota (o toque seguinte funciona). No celular, um toque rápido na área do joystick também anda
- [ ] **[mundo]** Movimento livre, passo 2: colisão do tamanho de cada objeto (tronco, poste, cesto, caixote), dita
  no tileset; a [estrutura] lê e usa
- [ ] **[estrutura + arte]** Movimento livre, passo 3: joystick na tela do celular (a [estrutura] faz funcionar, a
  [arte] deixa bonito)
- [ ] **[mundo]** Mapa e minimapa: minimapa no canto (terreno, você, monstros perto, NPCs e saídas) e o mapa grande na
  tecla **M** (o som passa a ligar e desligar só pelo ícone 🔊 do painel)
- [ ] **[arte]** Animações do personagem melhores (o dono achou feias; ele vai ver se consegue trocar)
- [ ] **[arte]** Celular deitado (horizontal) como o jeito recomendado de jogar: joystick à esquerda, habilidades à
  direita (vem junto com o joystick)
- [ ] **[arte + mundo]** Modo leve para celular fraco: menos efeitos (neblina, luzes, faíscas), com opção nas
  configurações
- [ ] **[dono]** Medir em aparelho de verdade: meta de 30 quadros por segundo num celular intermediário e 60 no PC.
  Como: abrir o jogo com `?fps` no fim do endereço (no PC, http://localhost:3000/?fps; no celular, o mesmo endereço
  que você usa para jogar nele, com `?fps`). Mostra os quadros por segundo, quanto cada quadro custa (abaixo de 16 ms
  dá 60; abaixo de 33 ms, 30) e o quadro mais lento. Medido em 13/11 no navegador de teste, SEM placa de vídeo
  (pessimista): 31 a 58 no PC 1280×720, 26 a 43 no 1920×1080 e 33 a 57 no celular emulado; o combate é o mais pesado
- [x] **[estrutura]** Desempenho, a minha parte (13/11): a camada do combate usa no máximo ~1,3 milhão de pixels (no
  celular de tela densa ela tinha mais pixels que o próprio cenário) e some quando não tem nada para mostrar: +2 a 5
  quadros por segundo no celular emulado. O motor e essa camada gastam menos de 0,2 ms por quadro; o resto é o desenho
- [ ] **[arte]** Desempenho do desenho (perfil no combate, 13/11): o `get bounds` de `props.js` monta um texto com o
  zoom (`toFixed`) a cada leitura, em ~1000 objetos, várias vezes por quadro (é a função que mais gasta); a escolha do
  que aparece passa por todos os objetos a cada quadro; personagens e criaturas são pintados por código a cada quadro
  (guardar a imagem de cada pose, como já é feito com as árvores, é o ganho maior no combate). Feito o primeiro (13/11):
  o texto do zoom é montado uma vez por zoom (ler a caixa de todos os objetos caiu de ~0,10 ms para 0,03 ms)

## 🗺️ Mundo novo (2.5D isométrico) — decidido pelo dono em 12/11
O visual muda para o do protótipo 2.5D (`prototipos/pindorama-25d/`) e os mapas são refeitos do zero; o motor
(servidor, regras, salvamento, dados) fica. Os 5 mapas atuais saem quando o capítulo 1 novo estiver jogável.
- [x] **[dono]** Região: zona sul de SP, perto do Capão Redondo, com mapas "bem selvagens" (a mata volta pelo sul)
- [x] **[dono]** Nascimento no **Parque Santo Dias** (Capão Redondo). Capítulo 1, do mais fácil ao mais difícil:
  Capão Redondo e o parque → Guarapiranga → Santo Amaro (Largo Treze, Terminal e o Shopping do Largo Treze, sem
  o nome da rede) → Billings → o centro (Sé) no fim do jogo
- [x] **[dono]** Pausa para capricho (13/11): parar de avançar e melhorar o detalhe dos mapas (o dono achou a arte
  "ruinzinha": a rua não parece rua, a calçada não parece calçada), uma área por vez, começando pela rua e pela praça
  da Budega. **Direção de arte nova:** a floresta reinando sobre a cidade inteira, pós-apocalíptico em versão
  brasileira, sem barraco destruído (casas e prédios inteiros, tomados pela mata; a vila continua viva). Referências
  aprovadas: `docs/referencias/padrao-rua-floresta.jpg` (a rua da Budega, com o detalhe que se quer) e
  `docs/referencias/padrao-cidade-floresta.jpg` (o bairro inteiro). O Mapa 02 para depois do pedaço (a)
- [x] **[mundo]** A rua e a praça da Budega no padrão novo (**na main em 13/11**, com o desenho da [arte]): planta aprovada pelo dono em 13/11 ("show",
  `docs/referencias/rua-budega-planta.jpg` e o alvo `docs/referencias/rua-budega-aprovada.jpg`; na beirada esquerda
  dessa imagem a IA repetiu a Budega e a fogueira, ignore). Pronto no ramo `mundo/rua-budega` (por cima da main):
  meio-fio com sarjeta, faixa amarela apagada, remendos, buracos com água, poças, rachaduras com mato, bueiros,
  tampas, capim, calçada de placas, musgo na praça, a **Figueira da Esquina** rompendo a calçada e o asfalto na
  esquina do portão (com raízes), cipó nas casas, nos postes e nos fios, plantas e árvore nas lajes, varal, o prédio
  do conjunto (Bloco B) no fundo, moto com mato, placa azul (R. Santo Dias × Tv. Jasmim da Beirada), cadeiras,
  vasos, lixo e bandeirinhas. Nada do que já foi aprovado mudou de lugar. Ajustes do dono vendo as fotos: as cadeiras
  da casa amarela ao lado da porta (não na frente) e os postes da rua do portão na calçada das casas, que para a
  câmera fica atrás de quem anda na rua (antes ficavam na calçada da praça, na frente do personagem); nenhum fio
  atravessa a rua
- [x] **[mundo]** O resto do Capão (4c) no padrão novo (**na main em 13/11**, com o desenho da [arte]): planta aprovada pelo dono em 13/11 ("pode mandar pra arte";
  `docs/referencias/capao-fundo-planta.jpg`, `capao-sul-planta.jpg` e os alvos `capao-fundo-aprovado.jpg` e
  `capao-campinho-aprovado.jpg`; na imagem do fundo a IA desenhou a casa abandonada destruída: no jogo ela fica
  inteira, só com a árvore saindo pelo telhado). No ramo `mundo/etapa-4c`: viaduto com cipó e árvores no tabuleiro,
  pilares com pichação, musgo e cipó, o trem com cipó e plantas, o ônibus virando a horta da vila, a casa abandonada
  com árvore pelo telhado, caminho de terra no fundo, o campinho com o mato entrando, traves enferrujadas com a rede
  rasgada, o muro com cipó, cadeiras de quem assiste, a rua para Guarapiranga com faixa apagada, rachaduras, buracos
  e raízes, e a Figueira do Viaduto. O viaduto fica a 8 m, na beira norte (o tabuleiro e o trem aparecem quando se
  chega no fundo da vila; o dono não pediu mudança)
- [x] **[arte]** O desenho da 4c (13/11, `prototipos/pindorama-25d/js/world/fundo.js`): as traves com a rede rasgada,
  a ferrugem e o cipó; o muro com o grafite "CAPÃO", o sol e as manchas de tinta, musgo e cipó; o viaduto da linha
  lilás (o tabuleiro com a mureta, a brita, os dormentes e os trilhos, mato e arvorezinhas, a face manchada e pichada, a
  ponta quebrada com o ferro aparecendo e, na beira do mapa, seguindo mata adentro); os pilares pichados com musgo e
  cipó; o cipó pendurado; o trem lilás de 3 vagões (janelas quebradas com planta saindo, a cabine com o vidro trincado,
  moitas e arvorezinhas no teto); o ônibus amarelo com a horta de caixotes no teto; a casa abandonada com a árvore
  rompendo a laje; a barreira de concreto com listras; as placas GUARAPIRANGA e ESTAÇÃO CAPÃO REDONDO; e as raízes da
  Figueira do Viaduto abraçando a ponta. Coisa comprida vem em pedaços (uma imagem cada) e o trem fica por cima do
  viaduto (`lift`). Conferido com o mapa do ramo `mundo/etapa-4c` no PC e no celular (sem erros, uns 55 a 59 quadros
  por segundo). **Atenção:** com a câmera de hoje, o tabuleiro a 8 m (e o trem em cima) só aparece na tela quando o
  herói anda embaixo dele, na beira norte; de longe, aparecem os pilares e o cipó
- [x] **[mundo + arte]** Faixa de pedestre na esquina (fora do cruzamento) e o semáforo quebrado soltando faísca na
  esquina do portão (pedido do dono, 13/11; **na main em 13/11**, "pode, junta"): a faixa atravessa a travessa na
  esquina (antes ficava no meio do cruzamento) e o `semaforo` (`quebrado`, `faiscas`) fica na ponta da calçada das
  casas, com o braço sobre a rua do portão; a amarela pisca falhada e as faíscas caem e quicam no chão. Conferido no
  PC e no celular, já com a Figueira da Esquina no lugar novo
- [x] **[mundo]** A Figueira da Esquina vai para a calçada da casa rosa (**na main em 13/11**, aprovado pelo dono:
  "pode seguir com as alterações"): na esquina do portão, a copa alta tampava, na tela, 19 m da trilha do norte do
  parque, onde andam os saguis (o dono pediu "o caminho sem árvore"); na esquina ela tampa em qualquer tamanho. Fica com
  as mesmas raízes (caminhos novos, na calçada e na rua) e o poste da casa rosa vai para a divisa com a casa azul. O
  gerador confere as trilhas do parque e um teste garante que nenhuma árvore da vila as tampa
- [x] **[mundo]** A mata no padrão novo: o Parque Santo Dias de antes, engolido pela floresta (**na main em 13/11**, com o
  desenho da [arte]). Planta aprovada pelo
  dono em 13/11 ("pode seguir com as alterações"; `docs/referencias/parque-antigo-planta.jpg`,
  `parque-academia-planta.jpg` e os alvos `parque-antigo-aprovado.jpg` e `parque-academia-aprovado.jpg`; as imagens
  da IA só dão o clima). No ramo `mundo/parque-antigo` (por cima da 4c): a placa da entrada, o bebedouro quebrado,
  bancos de concreto com lixeira, postes de parque apagados e tortos, pedaços da pista de caminhada de cimento e a
  academia ao ar livre enferrujada na Clareira das Bananeiras; nada da mata muda de lugar. A placa grande fica alta,
  acima do pilar do portão (como na imagem aprovada), e o poste do parque da entrada saiu da frente do poste do portão
- [x] **[mundo]** Casas com interior (**na main em 14/11**, com o desenho da [arte]; pedido do dono, 13/11: "dar vida para alguns interiores de casa"; planta aprovada:
  "pode mandar as casas pra arte"; `docs/referencias/casas-interior-planta.jpg` e os alvos `casa-amarela-dentro.jpg`,
  `casa-rosa-dentro.jpg` e `casa-abandonada-dentro.jpg`, que só dão o clima): a amarela (a família: cozinha no fundo,
  sala na frente), a rosa (a casa da vó) e a abandonada do fundo (a árvore nasce do chão de dentro e sai pelo buraco da
  laje): `interior`, porta de 1,2 m na frente (`portaDe`/`portaAte`), `piso` e os móveis sem vão de entalar (a conferência
  de vãos pula o par que uma terceira coisa fecha de ponta a ponta: a parede de uma casa, com um dentro e o outro fora; o
  fogão entre a pia e o filtro). A placa PARQUE SANTO DIAS foi junto: do lado de fora do portão, na altura dos olhos (o
  dono achou errada atrás do pilar)
- [x] **[arte]** Casas com interior, o desenho (**na main em 14/11**; `js/world/casas.js`): os móveis, os pisos, as
  paredes de dentro de cada morador, a porta aberta no vão do mapa (a abandonada arrombada) e a árvore de dentro com o pé
  e as raízes da Figueira da Esquina. Com o herói dentro, **só a casa aparece** (o resto da tela escurece e a câmera vai
  para o meio dela, pedido do dono). O pedido era: como a Budega (o telhado e a frente somem com o herói dentro), a porta
  aberta no vão do mapa, o `piso` (`desenho`: `ceramica`, `taco`, `cimento`) e os móveis novos: `pia`, `fogao` (`panela`),
  `filtro` (de barro, no banquinho), `mesa-cozinha` (`toalha: 'xadrez'`, `cadeiras`), `estante` (`tv`: a TV de tubo),
  `tapete`, `sofa` (`cor`, `croche`, `rasgado`, `mato`), `cristaleira`, `mesa-redonda` (`toalha: 'croche'`),
  `maquina-costura`, `cama` (`colcha: 'retalhos'`), `colchao` (`velho`) e `entulho` (`cadeiraCaida`); a `geladeira` e o
  `vaso` já existem. Na casa abandonada, o tronco no chão de dentro é a `arvore` com `dentroDaCasa` (no meio da casa)
- [x] **[estrutura + arte + mundo]** Joaquim, o gato da vó (pedido do dono, 13/11): bem pequeno, todo branco com
  detalhes laranja (a máscara na testa e no focinho, as orelhas e o rabo), olhos azuis, como o gato do dono
  (`docs/referencias/joaquim-1.jpg` e `joaquim-2.jpg`), e com vida: dorme no sofá da vó, acorda, se espreguiça, anda
  pela casa, mia e dá para fazer carinho. A [estrutura] define a chave e o comportamento, a [arte] desenha e anima, e o
  [mundo] marca a casa dele (a casa rosa; no mapa ele está no sofá, `gato` com `nome: 'Joaquim'`). A [arte] já fez o
  Joaquim dormindo no sofá (respira, mexe a orelha e o rabo, com o nome em cima; `js/creatures/gato.js`): o resto vem
  com o comportamento
  - [x] **[estrutura]** O comportamento (14/11; o dono: carinho sem bônus): `data/bichos.json` (chave `joaquim`),
    entidade nova `pet` (nunca é alvo). Dorme em cima do sofá (ponto `joaquim`; pula para cima e para baixo), acorda e
    se espreguiça, passeia pelo retângulo `joaquim-casa` sem sair dele nem entrar nos móveis, volta a dormir; mia
    (uma vez) para quem chega a 2,5 m, acordado; tocar nele faz o herói ir até lá e fazer carinho: ele ronrona
    (dormindo, continua dormindo). Sons: miado e ronronar. Gatinho provisório desenhado pelo motor (só com você
    dentro da casa) até o da [arte]. Protocolo 30. Conferido no PC e no celular com o mapa do ramo do [mundo]
  - [x] **[arte]** Ligar o `gato.js` no Joaquim que anda (14/11, na main com o "pode" do dono):
    `canDraw('pet', 'joaquim')` na PD.View e o Joaquim acordado pintado como o gato enrolado (refeito depois
    que o dono achou a versão de bolas feia): em pé, andando no passo de gato, sentado, espreguiçando, o pulo do sofá,
    "miau!" e o coração do carinho; pisca e olha para quem está perto. Dormindo, continua o desenho enrolado aprovado.
    Conferido no PC e no celular deitado, na casa da vó
  - [x] **[mundo]** A casa rosa na main (14/11, com o desenho das casas) e o `gato` decorativo do sofá saiu: o Joaquim
    de verdade aparece lá (conferido no PC e no celular: dorme no sofá e passeia pela casa)
- [x] **[arte]** Budega com interior, o desenho (13/11, pedido do dono: "igual HumanitZ"): com o herói dentro, o
  telhado e a frente somem com suavidade e aparecem a parede do fundo por dentro (azulejo, relógio, "FIADO SÓ
  AMANHÃ", lousa de preços), o piso de ladrilho hidráulico (`piso`) e os móveis (`prateleira`, `geladeira`, `balcao`
  com `caixa`, `engradado`). Liga com `interior: true` na `casa`; o mapa é do [mundo] (`mundo/budega-interior`)
- [x] **[mundo]** Budega com interior, o mapa (**na main em 13/11**): ladrilho por dentro, colisão só nas paredes de
  15 cm com a porta de enrolar aberta (de 62,34 a 66,66; a parede do fundo vai até a frente das prateleiras), a
  geladeira na ponta do balcão fechando a passagem para trás dele, 1,25 m atrás do balcão para a Xiovanna, engradados
  nos cantos da porta e nenhum vão de entalar; a lixeira saiu da frente da porta. A Xiovanna fica com o pé em
  (64,6; 51), onde nenhuma copa a cobre na tela (a [estrutura] muda o `data/npcs.json` logo depois do mapa)
- [x] **[arte]** Os desenhos do parque antigo (13/11): `bebedouro` e `academia` (`aparelho`: `simulador-caminhada`,
  `barra`, `remada`) são novos; `placa` (a da 4c) com `tamanho: 'grande'` e `mato`; `banco` com `material: 'concreto'`
  e `mato`; `lixeira` com `mato`; `poste-praca` com `apagado`, `torto` e `cipo`; e a pista (`calcada` em polígono com
  `desenho: 'placas'` e `quebrada`). Tudo com `ferrugem`/`musgo`/`cipo` onde o mapa disser. **Feito (13/11):** a placa
  PARQUE SANTO DIAS de madeira no alto de dois postes (acima dos pilares do portão, como na imagem aprovada; fica
  transparente quando o herói passa atrás), o bebedouro de concreto com a cuba lascada, a torneira torta e musgo, os
  bancos de concreto com encosto, musgo e quina lascada, as lixeiras verdes, os postes tortos e apagados (vidro trincado)
  com cipó, os três aparelhos de cano azul com ferrugem e cipó (o simulador de caminhada, a barra em arco e a remada com o
  banco laranja) e as placas soltas da calçada velha (terra e capim nas frestas, umas faltando). Desenho em
  `js/world/parque.js` (novo), `fundo.js`, `props.js` e `street.js`; com o mapa de hoje nada muda. Conferido com o mapa
  do `mundo/parque-antigo` no PC e no celular, sem erros e sem perder quadros por segundo
- [x] **[arte]** O chão no padrão novo (13/11, `js/world/street.js`): asfalto de verdade (grão, manchas e trincas; mais
  trincas no `estado` rachado), calçada de placas de cimento (juntas, trincas, placas levantadas perto de raiz, mato
  nas frestas), meio-fio com sarjeta (a face aparece quando a rua fica do lado da câmera), faixa amarela apagada,
  remendos, buracos com água, poças, rachaduras com mato, bueiros, tampas de esgoto, raízes que levantam o chão,
  capim, musgo na praça, o campinho de terra com as linhas de cal e o chão quebrado em volta da Figueira da Esquina
  (`rompendo`; ela não tem os símbolos da Figueira dos Despertos: só árvore com véu perto tem)
- [x] **[arte]** As coisas novas da planta da rua (13/11, `js/world/city.js` e `props.js`): placa azul de rua (as de
  São Paulo, com os dois nomes), moto enferrujada com mato, cadeira de plástico, vaso de espada-de-são-jorge, sacos de
  lixo, bandeirinhas que balançam, cipó subindo pelos postes e pendurado nos fios, carro com uma árvore saindo pelo
  teto, casas tomadas pela mata (cortinas de cipó conforme o `cipo`, manchas de chuva e musgo, plantas e árvore na laje,
  varal com roupa, portão de garagem de ferro) e o prédio do conjunto (5 andares, varandas, entrada com a placa do
  bloco). O escudo da Budega fica na frente do que está na laje. As coisas da 4c (viaduto, trem, ônibus, muro, traves,
  barreira, placa, campinho) ficam para a etapa 4c: o ramo da rua do [mundo] (`mundo/rua-budega`) saiu sem a 4c
- [ ] **[mundo]** Primeiro mapa (a fatia de teste): a clareira do despertar na beira do parque, com caminho claro
  até a vila do Capão (zona segura); a mata fechada do parque é a primeira área de caça. Escopo aprovado pelo dono
  em 12/11, uma etapa por vez e cada uma com a aprovação dele: 1) distância da câmera ✔; 2) planta final no papel ✔
  (`docs/referencias/mapa-01-planta.jpg`); 3) uma tela jogável (a clareira, em `/?novo`) ✔ (`npm run gen:capao` →
  `public/assets/maps-iso/capao.tmj`); 4) o resto do mapa em 3 pedaços: mata e lago ✔ (12/11; os saguis encantados e
  as jararacas voltaram em 13/11, com o combate do jogo novo), portão e vila ✔ (13/11: a Budega Distribuidora na praça,
  desenhada pela [arte]), campinho, viaduto e saídas ✔ (13/11, já no padrão novo); 5) atmosferas (dia, entardecer e
  noite); 6) minimapa.
  Mata nova (pedido do dono, 13/11: 50% maior para o sul, menos árvores, trilhas sem copa, plantas variadas, mais
  sombria): aprovada pelo dono (13/11) e **na main em 13/11**, junto com o desenho da [arte] (árvores de verdade,
  árvore seca, jerivá, embaúba, xaxim, bananeira, bambu, plantas, cogumelos, deque, pinguela, véus, escuro e neblina).
  Dá para aumentar de novo depois (cresce para o sul sem mudar nada de lugar). Etapa 4c (campinho, viaduto
  da Linha 5-Lilás, ônibus velho e as saídas, fechadas com placa até os próximos mapas existirem): aprovada pelo dono
  (13/11) e **na main em 13/11**, com o desenho da [arte]. Padrão: a arte conceitual
  aprovada (`docs/referencias/mapa-01-arte-aprovada.jpg`, "2.5D estilizado e sombrio")
- [x] **[arte]** Desenhar no 2.5D o mapa novo a partir das camadas `chao` e `cenario` do `.tmj` (Etapa 3: a clareira,
  o círculo, a Figueira dos Despertos, a mata, o gradil e o Portão I), com a "janela" nas copas — `PD.View`
  (`prototipos/pindorama-25d/js/view.js`); teste sozinho em `clareira.html`
- [x] **[arte]** Etapa 4a no 2.5D: o lago (`agua`, na `cor` do mapa, com reflexo na margem), a lama, a mata profunda,
  aguapés (folhas boiando com flor lilás), capivaras (enfeite, nas 8 direções), troncos caídos (deitados, com a ponta
  cortada e anéis; eles bloqueiam no servidor), a Pedra do Véu (`pedra` com `ancestral`, símbolo aceso) e os véus
- [ ] **[arte]** Neblina e escuro dentro das áreas com `neblina`/`escuro` (a mata profunda): junto com as atmosferas
  (Etapa 5)
- [x] **[arte]** Desenho da vila da etapa 4b no 2.5D: casas (andares, cor, bloco aparente, caixa d'água, pichação,
  abandonada), a Budega (porta de enrolar, letreiro BUDEGA DISTRIBUIDORA, toldo), postes de concreto com luminária e
  fiação, poste de praça, bancos virados para a fogueira (com chamas), mesa, orelhão, lixeira, carro largado com mato,
  sibipiruna, portão aberto, praça em pedra portuguesa e faixa de pedestre. Entra na main antes da 4b do [mundo]
- [x] **[arte]** Crítica do dono à mata (13/11): copas com folhagem (sem as "bolas verdes enormes") e lago sem pintas
- [x] **[estrutura]** Motor do jogo 2.5D (`src/client/novo/`, abre em `/?novo`): entrada, rede, previsão do andar,
  teclado e joystick (andam pela tela), tocar no chão para andar, falar com NPC, aviso de zona segura, outros jogadores;
  com um desenho provisório (bonecos e caixas) até o da [arte] chegar. O servidor manda quem entra pelo jogo novo
  para os mapas do formato novo (`hello` com `mundo: 'novo'`, protocolo 17)
- [x] **[estrutura]** Velocidade no mundo novo (decisão do dono, 13/11): correr é o normal (4,5 m/s) e andar devagar
  (2 m/s) é segurando Shift ou empurrando pouco o joystick (protocolo 18). O jogo de hoje continua igual
- [x] **[estrutura]** O endereço normal abre o jogo novo (decisão do dono, 13/11): http://localhost:5173 (e a porta
  3000) é o 2.5D; o jogo antigo, visto de cima, fica em `?antigo`, só para consulta, até o capítulo 1 novo ficar pronto
- [x] **[estrutura]** Mochila, loja e conversa com missões no jogo novo (13/11): as janelas de sempre, com o visual
  simples (a [arte] deixa no jeito do 2.5D). Tecla I ou o botão Mochila; tocar no NPC com loja abre a loja. Câmera
  (o dono achou perto demais): começa no mais longe que a view deixa (0,7) e o jogador ajusta com a roda do mouse ou
  as teclas − e + (fica guardado no aparelho)
- [x] **[estrutura]** A Budega no balcão da praça (64,5; 53,3) (13/11, `budega` em `data/npcs.json`): vende Banana,
  Ramo de Arruda, Água de Coco, Garrafada e Chapéu de Palha, e compra o que se pega na mata pela metade do preço.
  Quem atende é a **Xiovanna** (13/11, personagem inspirada em alguém da equipe do dono; o desenho é da [arte]). No mapa novo, a
  distância para negociar é do pé ao pé (até 3,5 m: o balcão deixa o jogador a uns 3 m dela)
- [ ] **[arte]** Ícones da Água de Coco (`agua_coco`) e da Garrafada (`garrafada`), já em `data/items.json`
- [x] **[estrutura]** Primeira missão do jogo novo (13/11, com o "pode" do dono): "O Despertar" (o Curupira da clareira
  manda ir até a vila falar com a atendente da Budega) e "Saguis Encantados" (a atendente pede para acalmar 4 saguis
  encantados — uma pedrada e o encanto sai — e voltar; dá uma Garrafada). Objetivo novo "falar" (conclui com a
  pessoa procurada) e "rotulo" (o texto do objetivo); o monstro virou "Sagui Encantado"; sinais ! e ? em cima dos
  NPCs no jogo novo. Protocolo 20
- [x] **[estrutura]** Atalhos de consumo no jogo novo (13/11, da HUD do dono): 1 = comida, 2 = remédio (campo
  `atalho` em `data/items.json`); cada um usa o item do grupo com a maior cura que está na mochila. Teclas 3 e 4 ou os
  dois botões redondos (`src/client/novo/quick.ts`, visual simples para a [arte] levar à HUD nova). Protocolo 19
- [x] **[arte]** O desenho de verdade no jogo novo: `PD.View` com a interface `WorldView` (`src/client/novo/view.ts`),
  carregado em `src/client/novo/arte.ts` (o motor troca o provisório por ele sozinho). Desenha também o nome em cima
  de cada um (o seu em dourado, NPC em verde-água) e os balões de fala, que não saem da tela e desviam dos nomes e uns
  dos outros; recebe para onde cada um olha em graus e anda pela velocidade de verdade (2 m/s anda, 4,5 m/s corre).
  Ainda não usa o `look` (todo jogador sai com o protagonista) nem o `durationMs`
- [x] **[dono]** Virada no jogo 2.5D (12/11): o dono escolheu a virada mais ágil só no jogo (opção b)
- [x] **[arte]** Virada ágil no jogo 2.5D: na virada de 180° correndo, o desenho fica até 0,91 m atrás da posição de
  verdade (era 1,75 m) e alcança em 0,53 s (era 1,32 s); pernas sem cruzar e pé apoiado sem escorregar
  (`ferramentas/seguir.cjs`). O jogo do protótipo não muda
- [x] **[arte]** Figueira dos Despertos e pedras redesenhadas (reclamação do dono, 12/11): tronco com volume e base
  entrando no chão, sapopemas, galhos até a copa, raízes aéreas, copa de vários cachos; pedras facetadas com musgo.
  No celular, chat compacto no `/?novo` e faixa da zona no alto (celular deitado)
- [ ] **[arte]** O Curupira no 2.5D (hoje é o protagonista com outra roupa) e a luz do poste
- [ ] **[estrutura + mundo]** Formato do mapa novo (combinado em 12/11): `.tmj` ortogonal, 1 tile = 1 metro (tile de
  32 px no Tiled, só como grade); camada `colisao` com retângulos (`bloqueiaTiro`, padrão true) gerada pelo [mundo] a
  partir do cenário; `saidas`, `monstros`, pontos e propriedades de sempre; `chao` e `cenario` só para o desenho.
  A [estrutura] já lê (13/11): `colisao` (o pé usa o retângulo exato; a grade de 1 m dos monstros bloqueia se qualquer
  retângulo encostar), tile de 32 px, a **zona segura por área** (camada `seguro`: monstro não entra, não nota e não
  acerta quem está dentro), pontos e NPCs no ponto exato do pé, e a pasta `maps-iso/` (`MEUMMO_MAPA_INICIAL=capao`
  para testar). O Curupira já está na clareira (`curupira_capao` em `data/npcs.json`)
- [x] **[estrutura]** Combate no jogo novo, passo 1 (13/11, com o "pode" do dono): o servidor de sempre, agora visto
  no 2.5D. Aviso de golpe no chão (quadrados vermelhos no golpe de perto; anel laranja em quem prepara, como o sagui
  antes de jogar a fruta), pedras e frutas voando, número de dano e de cura, barra de vida de quem apanhou, desmaio
  e volta para a clareira, ouro no chão, nível. PC: clique no monstro atira nele (segurando, continua), botão direito
  atira para onde o mouse aponta, Espaço esquiva, Q Bordunada, E Fôlego. Celular: tocar no monstro atira; botões
  Estilingue (segurando, mira sozinho no mais perto), Bordunada, Fôlego e Esquiva. Regra nova no servidor: de dentro
  da área segura ninguém ataca (o monstro não teria como revidar). Desenhado por cima pelo motor
  (`src/client/novo/combat.ts`) até a [arte] desenhar do jeito dela
- [x] **[mundo]** Religar os saguis e as jararacas da etapa 4a no gerador (o combate do jogo novo chegou): 4 saguis
  encantados no norte do parque e 3 jararacas na mata profunda do sudoeste (13/11). Com a mata fechada de hoje elas
  ficam escondidas embaixo das copas; a mata nova (mais aberta) resolve
- [x] **[arte]** Sagui Travesso com corpo próprio no 2.5D (13/11, escolha do dono: monstros antes do Curupira):
  sagui-de-tufo-branco encantado (rosto escuro, mancha branca, tufos brancos, olhos amarelos, rabo de anéis); sentado
  olhando em volta, correndo de quatro aos saltos, ergue a fruta no aviso e arremessa no tiro, pisca ao apanhar e
  desmaia de bruços ao cair (o encanto sai).
  `PD.creatures` (`js/creatures/`): o monstro com desenho lá deixa de sair com o corpo de gente
- [x] **[arte]** Jararaca com corpo próprio no 2.5D (13/11): marrom-oliva com as manchas em "V", cabeça triangular,
  olhos amarelos e língua que entra e sai; rasteja em S seguindo o caminho da cabeça, se enrola e ergue o pescoço no
  aviso (treme a ponta do rabo), dá o bote e vira de barriga para cima ao cair
- [x] **[arte]** Mata nova, entrega 1 (13/11, pedidos do dono: "floresta mais sombria" e "árvore normal, não redonda,
  e árvore seca"): o tronco abre em galhos na forquilha e cada galho termina num tufo de folhas de contorno recortado
  (vãos entre os tufos mostram os galhos; cipós pendurados); árvore seca com galhos tortos e barba-de-velho; escuro
  e neblina por área (`escuro`/`neblina` das áreas do mapa, a menor área vale), claro perto do herói
- [x] **[arte]** Mata nova, entrega 2 (13/11): jerivá (folhas em pena, coquinhos e folha seca pendurada), embaúba
  (candelabro com guarda-chuvas de folhas em mão, prateadas), xaxim (tronco de fibra e coroa rendada), bananeira
  (leque rasgado, folha velha, cacho com coração roxo e filhote no pé), bambu (moita em chafariz), samambaia,
  helicônia, taboa, cogumelo que brilha, deque, pinguela (tronco com o corte à mostra) e o brilho dos cogumelos e dos
  véus por cima do escuro (nos véus, luzinhas subindo e uma cortina de luz bem fraca); os arbustos viraram tufos de
  folhas recortadas. E o jogo só prepara a imagem dos objetos
  perto da tela: no mapa novo (1.107 objetos) entrar caiu de ~2 s para 0,1–0,2 s e a memória das imagens, de
  240–325 MB para 20–70 MB
- [x] **[arte]** Xiovanna, a vendedora da Budega (13/11, pedido do dono, com fotos de referência que não vão para o
  repositório): morena, black power grande, flor de hibisco, uniforme preto (jaqueta de zíper com capuz, escudo
  dourado no peito, emblema na manga), jeans e tênis. Vira para quem chega, acena, leva a mão ao cabelo e gesticula
  ao falar. E o escudo da Budega numa placa em cima da laje (`logo` = "budega" na casa, do [mundo]), sem
  "tabacaria" e sem o narguilé: no círculo, o hibisco. O nome "Xiovanna" na NPC "budega" já está nos dados
  ([estrutura], 13/11)
- [x] **[estrutura]** Combate no jogo novo, passo 2: as regras da revisão 17, em três partes (o "pode" do dono em 13/11)
  - [x] **2a — pedra com carga** (13/11): segurar puxa, soltar atira; carga cheia em 1,1 s = o dobro do dano e alcance
    de 6,5 a 9,5 m (só no mapa novo). O servidor conta a carga (`charge` → `shoot`, protocolo 21); esquiva, golpe
    recebido e desmaio soltam a pedra. PC: segurar o botão esquerdo no monstro, o direito (para o mouse) ou J (no mais
    perto); celular: segurar o botão Estilingue (toque rápido no monstro = pedra fraca na hora). Anel no pé enchendo
    e "carga perdida" (desenho provisório no `combat.ts`; a [arte] pode animar o puxar com as ações `sling-pull` e
    `sling-cancel` da view)
  - [x] **2b — defesa com energia** (13/11): segurar F (celular: botão Defesa) levanta a defesa, que protege 0,11 s
    depois, num arco de 140° na frente, virada sozinha para o monstro mais perto (sem monstro, para onde você anda).
    Golpe defendido: passa 25% (pelo menos 1) e gasta 10 + 0,75 × dano de energia; segurar gasta 6/s; sem defesa, a
    energia volta 22/s depois de 0,7 s. Acabou: a defesa quebra e só levanta de novo soltando, depois de 0,85 s e com
    20 de energia. Defendendo, anda a 70% do andar devagar e não atira nem usa habilidade; levantar solta a pedra.
    Fogo no chão não tem direção: a defesa não segura. Protocolo 22 (`guard`, `energy`, `blk` no `hit`). Desenho
    provisório: arco azul-claro no chão, faísca no bloqueio, barra de energia embaixo do pé, "defesa quebrou!" e o
    botão `#guard-button` (`src/client/novo/guard.ts`); a barra azul da HUD nova é essa energia ([arte]; a verde é a
    XP; ligada no motor com `hud.setEnergy`), e a barra embaixo do pé também ficou azul
  - [x] **2c — recuo** (13/11): golpe de monstro empurra o jogador na direção em que andava, o quanto o monstro diz
    (`"recuo"` no ataque, em cm; padrão pelo tipo: fruta 12, mordida 16, bote 22, giro 26, investida 34; também no
    painel do administrador). Defesa que segura deixa 25% do empurrão; a que quebra, 50%; parede segura. Medido no
    navegador: 12 cm por fruta, 3 cm defendendo. Os monstros não recuam (andam de tile em tile; a [arte] pode mostrar
    o tranco no desenho). **Esquiva conferida:** a do jogo rola 3 m, protege 0,35 s e recarrega em 2,5 s; a do
    protótipo anda 1 m, protege 0,2 s e recarrega em 0,2 s. Ficou a do jogo (os avisos dos monstros foram feitos para
    ela) — o dono decide se quer a do protótipo
- [x] **[arte]** O herói no combate do jogo 2.5D (13/11, pedido do dono): as animações da revisão 17 (a que o dono
  trouxe do ChatGPT: `js/slingshot.js` e `js/guard.js`) ligadas às ações que o motor já mandava. Segurar o estilingue:
  ele puxa o elástico; soltar: a pedra sai e o braço volta. A **forquilha só aparece na mão na hora do tiro** (escolha do
  dono, 13/11; no resto do tempo, mãos livres). Defesa: os braços sobem na frente, cedem no bloqueio e caem quando a
  defesa quebra; golpe recebido parado dá o tranco (andando não, para o desenho não ficar para trás do servidor). Vale
  para os outros jogadores também (o tiro deles mostra a puxada curta e o soltar). Sons novos no `sfx.ts`: zumbido do
  elástico subindo com a carga e o "plim" da carga cheia, pancada da defesa e a defesa quebrando — ligados pela
  [estrutura] no motor (pedido enviado). Conferido no PC e no celular (botão Estilingue), sem erros
- [x] **[arte]** Dois acertos pedidos pelo dono (13/11, vendo o jogo): a **placa PARQUE SANTO DIAS** na altura dos olhos
  (tábua de 1,2 a 2 m), na frente do gradil e com o cipó só nos postes e nas pontas (o nome dá para ler; o [mundo] levou
  a placa para fora do portão, ramo `mundo/placa-parque`); e a **casa abandonada da 4c**: a árvore agora nasce lá de
  dentro (o tronco sobe por um buraco de borda quebrada na laje, sem raiz nem placa solta em cima, a laje em volta
  limpa) e solta galhos e folhas pelas janelas e pela porta, com duas trincas finas na parede. A casa continua inteira
- [x] **[estrutura]** Ligar o combate do herói no motor (pedido da [arte], 13/11): `sfx.charge(carga)` a cada quadro da
  puxada e `sfx.stopCharge()` ao soltar/cancelar/desmaiar (e ao sair do jogo); `'block'` quando a defesa segura e
  `'guard-break'` quando ela quebra (um som só, na mensagem `energy`, quebrando num golpe ou segurando até acabar); a
  mira no `'sling-pull'` desde o começo e de novo quando muda mais de 5° (a mesma conta do tiro: alvo, mouse ou o
  mais perto); parado, o corpo vira junto (a view vira o parado para o ângulo do motor); o `'guard'` vai com o ângulo
  sempre que a defesa é reenviada. Conferido no PC e no celular: puxando perto de um sagui, o herói vira para ele
  antes de soltar (`__mundoNovo.me.angle`)
- [x] **[estrutura]** Arco de Bambu, as regras (14/11, pedido do dono: "o arco deve permanecer na mão, como um item /
  arma"; mesmo botão do estilingue; sem munição; vendido e dropado como o estilingue). Item `arco_bambu` (dano +5,
  preço 300, "Bambu do brejo curvado no fogo, corda de fibra de tucum.") com o campo novo `tiro` (arma com tiro
  próprio): flecha, carga cheia em 1,5 s (o estilingue é 1,1), alcance 8 a 13 m (6,5 a 9,5), 0,7 s entre tiros (0,45)
  e flecha a 20 m/s (pedra 14). O servidor atira com os números da arma equipada (`shotProfile`, a mesma conta no
  navegador, para a previsão bater); no mapa antigo, o arco atira pedra. A Budega vende o arco e o Estilingue de
  Goiabeira. Os números do tiro ficam no painel (aba Itens). Sons novos: a corda do arco rangendo na carga e o "tóim"
  ao soltar. Flecha provisória (uma haste na direção do voo) até a da [arte]; ícone provisório `estilingue` até o
  `arco` dela. Protocolo 29. Conferido no PC e no celular
- [x] **[arte]** Arco de Bambu, o desenho (14/11, na main com o "pode" do dono): o ícone `arco` (o item pintado na mochila e na loja, o botão de
  atirar com o arco; o `GEAR_ART.arco` do jogo antigo já existia), o arco sempre na mão (`view.gear(id, gear)`: bambu
  com os nós, empunhadura de couro, corda de tucum; parado, andando, correndo e na defesa), a pose de arqueiro no
  `sling-pull`/`shoot` (o braço do arco esticado, a corda até o rosto, o arco envergando com a carga, a flecha encaixada
  com as penas; as regras do arco no `slingshot.js`: carga de 1,5 s), o herói da mochila com o arco, a flecha voando e
  cravada no chão (`projectileArt.ts`) e o `actionBar.setLook`. **Ligado pela [estrutura] (14/11):** o `icone` do
  `arco_bambu` é `arco`; no `combat.ts`, `drawProjectile` antes da bolinha (saiu a flecha provisória),
  `projectileEnded` no `endShot` com o `hit` do `shot_end` (0 = em ninguém) e no fim do alcance, `drawLanded` a cada
  quadro e `landedBusy` no `busy()`; o botão vira "Arco" ao entrar e quando a sua arma muda. Conferido no PC e no
  celular: a flecha voa (com as penas e a sombra) e crava onde cai
- [ ] **[estrutura]** Arco e estilingue de goiabeira caindo dos bichos novos (quando eles entrarem)
- [x] **[estrutura]** Som, parte 1 (14/11; o som passou para a [estrutura], escolha do dono): **volume separado** para
  música, efeitos e ambiente (guardado no navegador; o botão do som da HUD abre o painel `#sound-panel`, e o `M`
  continua ligando e desligando tudo) e **som de ambiente** feito por código, pelo lugar do mapa (camada `areas`; a
  propriedade `som` do lugar manda, senão o nome): vila (bem-te-vi, sabiá, vento leve), clareira (passarinhos e um
  zumbido mágico baixinho), mata (vento, folhas, cigarras), mata profunda (vento mais forte, grilos, coruja) e água
  (água correndo, gotas, sapos). Troca suave de um lugar para o outro. Conferido no PC e no celular
- [x] **[estrutura]** Som, parte 2: a música do Capão (14/11, o dono: "pode começar pelas músicas de licença livre").
  Três músicas CC0 do OpenGameArt (`public/assets/audio/musica/`, créditos em `CREDITOS.md`, volume igualado):
  Vila do Capão → "Down The River" (Komiku); a mata, a Clareira e o Lago → "Forest Whisper Theme" (Cleyton
  Kauffman); a Mata Profunda → "Peaceful Forest" (Samza). Troca devagar de uma para a outra, toca aos poucos (não
  carrega a música inteira), pelo volume "música" do painel. Conferido no PC e no celular. Falta o dono ouvir e dizer
  se ficam
- [x] **[arte]** O botão do som na HUD do celular (14/11): o 🔊 aparece no celular (deitado e em pé) e abre o painel
  do som; conferido pela [estrutura]
- [x] **[estrutura]** Conversa com NPC, parte 1 (13/11, pedido do dono: "a câmera deve se posicionar na Xiovanna e
  vir a msg por cima com ela falando, mexendo a boca; aceitar ou desistir, mesma coisa; qualquer conversa direta com
  NPC"): ao abrir conversa (missão ou loja) a câmera chega perto em ~0,5 s (zoom 1,25) e volta quando fecha; levar
  golpe fecha a conversa. O motor avisa a view: `focus(ponto)` (olhar para quem fala; a provisória já centraliza) e
  `talk(id, ms)` (quanto tempo a boca mexe: a fala ao abrir e a resposta ao entregar, aceitar ou desistir)
- [x] **[estrutura]** Menu ADM, passo 1 (13/11, pedido do dono: "menu administrativo para pôr mais bicho, matar,
  voar, fazer coisas que player normal não faz"): quem é administrador fica salvo no personagem (`MIGRATIONS` passo 4)
  e é marcado no painel (aba Jogadores, vale na hora). No jogo, botão ADM / tecla G: criar monstros onde está (até
  10 por vez e 60 por mapa; não renascem), derrubar os de perto (a XP vai para ele), voar (atravessa tudo, 2,5× o
  correr; pousando dentro de algo vai para o chão livre), invencível (sem dano, monstros e canto ignoram), teleporte
  ao clicar e curar. Mensagem `gm` (protocolo 24), conferida no servidor e registrada. Visual provisório
  (`src/client/novo/gm.ts`) para a [arte] caprichar
- [x] **[estrutura]** Registros (13/11, pedido do dono: "logs para ter correções mais fácil"): arquivo por dia em
  `saves/registros/` (14 dias), aba **Registros** no painel (filtro, "Só erros", "Copiar tudo"), erros do servidor com
  o caminho (o tick e as mensagens não derrubam mais o servidor) e os erros do navegador de quem joga (mensagem `oops`,
  protocolo 25, com o aparelho)
- [x] **[estrutura]** Menu ADM, passo 2 (o dono escolheu "todos", 13/11): nível e XP de um jogador (cartão no
  painel), a posição dos NPCs (mapa, x e y no painel; "Trazer para cá" no menu ADM; vale na hora, com o boneco
  andando na tela de quem joga), os monstros por área (aba "Áreas de monstros": qual monstro e quantos, `mapa#n`),
  as missões (aba "Missões": textos, quantos, nível, repetir e recompensa; até com a conversa aberta) e os números
  do combate (aba "Combate": carga, defesa e quanto do empurrão a defesa segura; protocolo 28). Tudo vale na hora.
  "Ver como o servidor vê" (colisões) dentro do jogo ficou de fora: por enquanto, o `?provisorio` mostra as caixas
- [x] **[estrutura]** Tela inicial nova, parte do servidor (13/11, pedido do dono com a imagem
  `docs/referencias/tela-inicial.webp`; fundo e logo em `tela-inicial-fundo.webp` e `tela-inicial-logo.webp`): "Entrar"
  só entra com personagem que já existe (antes, nome digitado errado criava um personagem novo sem querer) e "Criar uma
  conta" só cria nome novo (protocolo 23, `mode` no `hello`); a lógica está no `main.ts` e liga quando a página tiver
  `#mode-toggle` (com `#login-title` e `#password2`); sem eles, tudo como antes. Para quem esquece a senha: **trocar
  senha** no painel do administrador. Decidido com o dono: o nome é **Pindorama: Selva de Pedra**; ficam fora, até o
  jogo estar na internet, "Entrar com Google", e-mail, "Esqueceu sua senha?" e "Sair do Jogo"
- [x] **[arte]** Tela inicial nova, o visual (13/11): o fundo e o logo da imagem do dono (`public/assets/ui`, mais leves),
  o painel de madeira escura com moldura, cipós e o medalhão do sol em espiral, o título que troca ("Entrar no mundo"
  / "Criar uma conta"), campos com ícone, o "Repita a senha" só ao criar, o botão laranja de pincelada e o link "Criar
  uma conta" / "Já tenho conta"; o "Como jogar" virou um botão no canto (embaixo do painel no celular). No PC, no
  celular em pé e deitado. O nome da aba é "Pindorama: Selva de Pedra"
- [x] **[arte]** Conversa com NPC, parte 2 (13/11): a `PD.View` leva a câmera até quem fala (`focus`, gente ou
  criatura), que fica um pouco acima do meio da tela, vira para você e mexe a boca enquanto fala (`talk`); o seu
  personagem parado na frente dele fica transparente. A fala vem embaixo, por cima da cena, sem o retrato antigo
  (`#talk.cinema`, só no jogo 2.5D): o nome numa plaquinha, a fala escrita aos poucos no ritmo da boca (tocar mostra
  tudo), os cartões das missões e botões grandes (Aceitar, Entregar/Conversar, Desistir, Ver a loja, Tchau), no PC
  e no celular. A loja do jogo 2.5D também fica sem o retrato. O jogo antigo (`?antigo`) continua igual
- [x] **[arte]** Interface nova do jogo 2.5D, no traço da HUD de referência do dono (13/11): o retrato com o herói 2.5D
  de verdade na moldura de madeira com folhas e penas, as barras brilhantes de vida (vermelha), energia da defesa
  (azul) e XP (verde) e o nível no selo; a barra de habilidades com o espiral vermelho (estilingue, bordunada, fôlego,
  esquiva, a defesa no 5º quadrado e o 6º vazio, com as teclas nas etiquetas); os frascos em anéis de corda para
  comida (3) e remédio (4); a mochila num botão redondo; a missão em andamento num painel escuro com o losango; o chat
  com a borda de bronze; e a mochila aberta com o herói 2.5D (gira no clique). Ícones novos pintados com brilho (as 5
  habilidades, banana, água de coco, arruda, garrafada e mochila; os outros itens seguem em pixel art, aumentada). As
  molduras são recortes da imagem do dono, limpos (`public/assets/ui/hud`). No celular: retrato menor e botões soltos
  em quadros dourados perto do polegar. O jogo antigo (`?antigo`) continua igual. Falta a [estrutura] ligar a barra
  azul (`hud.setEnergy(valor, máximo)`); até lá ela mostra a energia cheia
- [ ] **[arte]** Interface, próximos passos: pintar os outros ícones de item, e a loja e a conversa no mesmo painel
- [x] **[arte]** Tela inicial, acertos pedidos pela [estrutura] (13/11): no celular deitado o logo vai para a esquerda
  e o painel para a direita, mais junto (o "Entrar" e o "Criar uma conta" cabem sem rolar, também no iPhone); o "Como
  jogar" mostra os controles do jogo 2.5D (segurar e soltar o estilingue, defesa no F, 3 e 4, zoom na roda) e o
  `?antigo` continua com os de antes; no celular deitado ele começa fechado (aberto, cobria o logo). **Uma lua só**
  (o dono achou três): ficou a lua cheia do fundo; saíram a luazinha ao lado do prédio alto e a lua vermelha de trás
  do logo (os prédios do logo ficam contra o céu, com um brilho quente da cidade). As imagens originais do dono
  continuam em `docs/referencias`
- [x] **[dono]** Decisões de 12/11: a **Budega Distribuidora** (o negócio do dono) é a vendinha da praça da Vila do
  Capão, sem a palavra "Tabacaria" e sem produtos de tabaco (a lei proíbe propaganda de tabaco); o nome continua
  **Selva de Pedra**; os saguis são **encantados** pelo desequilíbrio entre os mundos e a missão é acalmar ou
  afastar, não matar (muda a história e o texto, o monstro continua); o ritual de classe na figueira fica para depois
- [x] **[dono]** Câmera (12/11): padrão no **médio** (herói com ~260 px numa tela Full HD e ~14 m de chão na largura),
  e o jogador pode afastar até o **longe** (~185 px, ~20 m). Comparação em `docs/referencias/mapa-01-camera.jpg`
- [ ] **[arte]** Aplicar a câmera decidida no 2.5D (no protótipo: zoom do jogador com padrão 1,0, afastando até 0,7) e
  combinar com o dono o enquadramento no celular (em pé, a tela mostra só uns 6 m de largura) — na `PD.View` já está
  assim; provisório até o dono decidir: aproximar até 1,4 e, em pé, uns 9 m de largura

## 📋 A lista do dono de 14/11 (distribuída pela [estrutura] entre as frentes)
Pedido: "distribui as outras tarefas para os outros chats". Cada frente pega as suas; o que passa por mais de uma diz
quem começa. (A música de licença livre, primeiro item da lista, já está acima.)

**Bugs e o que está feio (primeiro):**
- [x] **[estrutura]** Lag ao falar com NPC e o jogo travando ao dar e tirar zoom: medidos (14/11). A causa é a mesma
  e está no desenho: cada mudança de zoom apaga e refaz o chão inteiro, e a câmera da conversa muda o zoom a cada
  quadro por meio segundo (quadros de 100 a 250 ms). Passado à [arte] (abaixo)
- [ ] **[arte]** Zoom sem travar (conversa, roda e +/-): o chão (`ground.js`) esticar os pedaços velhos enquanto o zoom
  muda e refazer só quando ele parar, como os objetos já fazem; e o orçamento de refazer imagens (`buildBusy`) contar
  o primeiro desenho de cada imagem nova (é onde o navegador pinta de verdade)
- [x] **[estrutura]** Som do arco: "quando puxa parece um motor girando, feio demais" (14/11): sem tom contínuo; agora
  é a madeira do arco rangendo (estalinhos que aceleram e ficam mais fortes com a carga) e um chiado fino de corda
- [x] **[arte]** Arco: "o braço fica feio puxando" (14/11, no ramo da arte): puxando, o herói fica de lado para o
  alvo como arqueiro de verdade (o ombro do arco aponta para o alvo, o cotovelo da corda vai para trás na linha da
  flecha, a cabeça olha ao longo dela); antes o cotovelo subia e saía de lado, como asa
- [x] **[arte]** Esquiva: "está feia demais" (14/11, no ramo da arte): no jogo ela não tinha movimento (o herói
  aparecia 3 m adiante de uma vez); agora ele rola no chão (abaixa, gira uma volta e levanta, 0,5 s), para todos
- [x] **[mundo + arte]** A cama do quarto do Joaquim está invertida (14/11): o [mundo] virou a cama na planta
  (`olhando: 90`, ramo `mundo/cama-vo`) e o desenho da [arte] passou a ler o `olhando` (a cabeceira no lado oposto aos
  pés; antes ficava sempre no oeste). Os dois ramos entram juntos na main
- [x] **[mundo + arte]** A entrada da Budega ("está péssima") (14/11): o [mundo] marcou o vão da porta
  (`portaDe`/`portaAte`), tirou o varal da frente e levou o orelhão para o poste de luz da praça (ramo
  `mundo/budega-entrada`); a [arte] desenhou o vão da loja (a porta de aço enrolada, os trilhos, a soleira e, lá
  dentro, o piso de ladrilho, a geladeira, o balcão e as prateleiras acesas, sem o musgo da fachada por cima) e o
  orelhão preso no poste. Os dois ramos entram juntos na main
- [x] **[arte]** Entrada e saída dos interiores com animação (a volta para o mundo é muito repentina) (14/11, no ramo
  da arte): o telhado e a frente saem e voltam em 0,6 s suaves; saindo, a casa continua em foco até o telhado voltar
  (o escuro em volta abre como uma íris, em vez de sumir de uma vez) e a câmera volta junto

**Mundo:**
- [ ] **[mundo]** Aumentar a floresta
- [ ] **[mundo + arte]** Os interiores com partes da floresta também (plantas, cipó, raiz), como o mapa em geral
- [ ] **[estrutura + mundo + arte]** Mais bichos: a [estrutura] define os novos (dados e comportamento), o [mundo] marca
  as áreas e a [arte] desenha
- [ ] **[estrutura + mundo + arte]** As capivaras andando (bicho do ambiente, como o Joaquim): a [estrutura] faz o
  comportamento, o [mundo] marca a área e a [arte] anima
- [ ] **[estrutura + mundo + arte]** Mapa: o M abre o mapa completo, que só mostra o que você já andou, e um mini mapa.
  A [estrutura] guarda o explorado (no personagem) e a tecla; o [mundo] faz a imagem de cima de cada mapa; a [arte]
  desenha a janela e o mini mapa

**Sistemas:**
- [ ] **[estrutura + arte]** Dia e noite: à noite os bichos ficam mais fortes e dão mais XP e ouro; olhos vermelhos (a
  [arte]); lampiões (o [mundo] marca, a [arte] acende)
- [ ] **[estrutura]** Drop de itens nos bichos (e o arco e o estilingue de goiabeira nos bichos novos)
- [ ] **[estrutura + arte]** Vento forte e fraco (a [estrutura] manda a força; a [arte] balança as árvores e arruma o
  movimento delas; o som do vento acompanha)
- [x] **[estrutura]** A flecha que acerta a árvore fica presa nela, parte das regras (14/11): o `shot_end` diz onde o tiro
  parou (na casca, não 25 cm dentro) e no que bateu (`on`: o tipo do objeto da colisão, ex. 'tronco'); o motor voa o
  desenho até lá e chama o `projectileEnded` com `stuck` (protocolo 32)
- [ ] **[arte]** Desenhar a flecha cravada no tronco (na altura do voo, `stuck.z`), em vez de no chão ao pé da árvore

**Personagem e controles:**
- [x] **[estrutura]** Esquiva no Shift (configurável) e Espaço para pular (14/11): janela das teclas (botão "Teclas" no
  painel do som, só no computador; fica guardado no navegador), o pulo passa pelo servidor e quem está perto vê
  (protocolo 31; por enquanto só de enfeite), o andar devagar foi para o `C` (liga e desliga), o som ficou sem tecla
  (painel do som) e o `M` está reservado para o mapa (por enquanto só avisa)
- [ ] **[arte]** O pulo de verdade no boneco (o motor manda `action(id, 'jump')`, seu e dos outros; o animador do
  protótipo já pula com `input.jump`) e um botão de pular no celular (o tipo `ActionSlot` com 'jump' e o ícone; o motor
  põe na barra)
- [ ] **[arte]** A etiqueta da tecla da esquiva na barra: o estilo desenha a barra de espaço fixa
  (`.action[data-slot='dash'] .key`), mas a esquiva agora é o Shift e o jogador pode trocar; e o "Como jogar" da tela
  de entrada (`index.html`) com as teclas novas
- [ ] **[arte]** Tirar o J da barra de habilidades: o tiro é o ataque básico, não é habilidade (no celular continua um
  botão de atirar, à parte)

**Habilidades (combinar os detalhes com o dono antes):**
- [ ] **[estrutura + arte]** Habilidades que sobem de nível com o personagem (mais dano e o visual muda) e a primeira
  classe, o **Caçador da Floresta** (DPS à distância: arco, velocidade, precisão e espíritos dos bichos): Chuva de
  Flechas (área; evolui com mais flechas e área maior), Flecha Ancestral (dano espiritual), Olhos de Gavião (ver
  inimigos e rastros de longe), Chamado Selvagem (invoca uma onça ou uma águia espiritual) e Fúria da Onça
  (transformação: corpo a corpo, mais agressivo)

## 🎨 Design (visual)
Em etapas pequenas, cada uma jogável. Arte ainda provisória, feita por código.
- [x] **Interface:** tela de entrada com cenário (selva sobre as ruínas e a represa), "Como jogar" que abre sozinho
  para quem é novo; painéis num estilo só (madeira escura com borda dourada); nível em destaque e XP com números;
  botões de habilidade com ícones, tecla do atalho e segundos de recarga; chat que esmaece quando ninguém fala
  (no celular fica recolhido nas últimas linhas, um toque abre); faixa com o nome da zona (vermelha se for perigosa)
- [x] **Cenário com profundidade:** coberto pelos passos 1 a 3 do mapa (sombras, copas por cima, água animada,
  beiradas suaves, vila colorida, Santo Amaro com neblina e prédios de 2 andares)
- [ ] **[dono]** Arte definitiva (depende de decidir: desenhar, contratar ou usar pacotes gratuitos)

## ✅ Pindorama — a primeira zona
- [x] Mundo aprovado: **Pindorama — Selva de Pedra** (São Paulo tomada pela floresta), tom "um pouco dos dois"
  (colorido e vivo nas vilas, sombrio nas ruínas) — ver DESIGN.md
- [x] A vila virou o **Refúgio de Guarapiranga**: vila flutuante com píeres e barcos, matas com ipês, brejo,
  avenida em ruínas e a praça do Saci (arte nova: 26 tiles)
- [x] Nome da zona aparece na tela ao entrar; o mapa diz o próprio nome e se é zona segura (propriedades `nome` e `seguro`)

## ✅ M2 — Progresso salvo
- [x] Personagem com senha, salvo em banco de dados (SQLite que já vem no Node.js, arquivo `saves/meummo.db`):
  nível, XP, vida, lugar e aparência. Salva ao sair, ao subir de nível, a cada 30 s e ao desligar o servidor
- [x] Senhas protegidas (scrypt), freio para quem erra a senha muitas vezes, entrar de outro lugar tira a sessão antiga
- [x] Monstros deixam itens (cada um que ajudou sorteia os seus); mochila com 20 espaços; equipamentos em
  4 partes que somam dano, vida e defesa; banana que cura. Tudo em `data/items.json`, salvo com o personagem
- [x] Ver o equipamento no personagem: personagem redesenhado (20x24, com contorno, 5 jeitos de cabelo, olhos e
  roupa variando pelo nome, passo mais suave) e o equipamento em camadas — chapéu de palha, gorro do Saci, gibão,
  couraça, a arma na mão e o amuleto no peito — para todo mundo ver; boneco vestido na mochila (clique para girar)

## 🔧 M3 — Mundo
- [x] Vários mapas ligados: saídas e pontos de chegada desenhados no Tiled; quem desmaia num mapa sem vila acorda
  no Refúgio; o personagem fica salvo no mapa onde parou
- [x] A avenida a leste do Refúgio leva às **Ruínas de Santo Amaro** (mapa provisório, sem monstros)
- [x] Ruínas de Santo Amaro, passo 2: mapa caprichado com arte nova (22 tiles: concreto, lajes, fachadas, lojas
  fechadas, cipó, entulho, sucata, pneus, fios, postes, árvore seca, ervas, ônibus) e tom pesado
- [x] Ruínas de Santo Amaro, passo 3: Corpo-Seco, Capelobo e a Mula sem Cabeça (chefe com investida e rastro de
  fogo), com itens novos (Arruda, Sucata, Faca de Sucata, Couraça de Lata, Ferradura em Brasa)
- [x] **[estrutura]** Ouro: cada monstro deixa ouro (campo `ouro` em `data/monsters.json`) para cada um que ajudou;
  aparece no painel, na mochila e no "+N ouro"; fica salvo com o personagem
- [x] **[estrutura]** Ouro no chão: as moedas pulam do monstro (com tilintar) e cada um vê só o seu montinho; pega
  chegando perto; some em 1 minuto, piscando antes. Item que não cabe na mochila também cai no chão (2 minutos),
  em vez de se perder
- [x] **[estrutura]** Loja: a **Dona Iracema**, quitandeira do píer, na praça do Refúgio, vende banana, arruda e
  chapéu de palha e compra qualquer item pela metade do preço (`preco` em `data/items.json`; quem vende o quê e
  onde fica em `data/npcs.json`). Clicar nela leva até ela e abre a loja; afastar-se fecha
- [x] **[arte]** Caprichar a loja e o ouro: moeda desenhada (com flor de ipê em relevo) em todo lugar que mostra
  ouro, sons de moeda (pegar, comprar, vender), janela da loja de barraca de feira (toldo, retrato, fala no balão,
  abas Comprar/Vender) e a Dona Iracema com aparência própria (coque, óculos, vestido de chita com avental)
- [x] **[mundo]** Barraquinha de frutas da Dona Iracema, na praça do Refúgio (ela fica em (46, 28)): toldo listrado
  atrás dela e balcão com frutas na frente. De quebra: os píeres dos lados voltaram a encostar no deck da fogueira
  (as casas maiores do passo 2 tinham fechado a passagem) e um teste confere que todo NPC tem lugar alcançável
- [x] **[estrutura]** NPCs com diálogo: o **Curupira**, guardião da mata, na beira da mata ao norte da vila; clicar
  nele abre a conversa (falas em `data/npcs.json`); **!** em cima = missão nova, **?** = missão para entregar
- [x] **[estrutura]** Missões simples em `data/missoes.json` ("derrotar" monstros ou "entregar" itens), com
  recompensa de XP, ouro e itens, sequência (`depoisDe`), nível mínimo e repetíveis; até 5 ao mesmo tempo; lista
  na tela; progresso salvo com o personagem. Primeiras: Saguis Travessos → Couro de Jararaca → O Dono do
  Redemoinho (o Saci) → Guardião da Mata (repetível)
- [x] **[arte]** Desenho do Curupira (cabelo de fogo que tremula, pés virados para trás, descalço, túnica de folhas)
  e caprichar a conversa (painel da loja com cipó, retrato, fala no balão, cartões com barra de progresso e a
  recompensa em fichas), a lista de missões (com barrinha) e os sinais ! e ? (selo dourado; verde quando é para entregar)
- [ ] **[mundo]** Opcional: enfeite em volta do Curupira (árvore oca, cantinho de mata fechada) em (45, 12)
- [x] **[mundo]** Represa Billings: zona nova ao sul do brejo (labirinto de canais e ilhas com passarelas,
  buritis, aguapés, casas afundadas, usina, ponte da rodovia quebrada, prainha de frente para a pedra da Iara,
  neblina e vaga-lumes), com criaturas provisórias (Jararaca, Corpo-Seco, Capelobo)
- [x] **[mundo]** Terminal Santo Amaro: mapa novo pela rua do meio de Santo Amaro, ao sul (plataformas cobertas
  A a D com a cobertura furada, ônibus enferrujados nas pistas, catracas, bilheteria e o fundo desabado com
  tambores de fogo), com criaturas provisórias (Corpo-Seco nas plataformas, Capelobo no fundo)
- [x] **[mundo]** Shopping do Largo Treze (sem nome de marca): mapa de dentro, com a porta de vidro no prédio do
  lado oeste do largo de Santo Amaro (átrio com jardim embaixo da claraboia quebrada, chafariz, escadas rolantes,
  12 lojas, supermercado, cinema e praça de alimentação), com criaturas provisórias (Corpo-Seco, Capelobo e Saci)
- [x] **[estrutura]** Jacaré Mutante e Boto Encantado em `data/monsters.json` (golpes que já existem; o jacaré
  deixa o Dente de Jacaré, que vale ouro na loja)
- [x] **[mundo]** Passar as áreas do jacaré e do boto da camada `lendas` para `monstros` na Billings (3 jacarés nos
  canais do oeste, 2 botos no lago das casas afundadas; a Iara continua marcada em `lendas`)
- [x] **[arte]** Desenhos do jacaré (papo-amarelo mutante: abre a boca no bote) e do boto (cor-de-rosa, de chapéu
  branco: enche a bochecha e cospe o jato d'água, que ganhou gotinhas e respingo); ícone do Dente de Jacaré
- [x] **[estrutura]** Iara, chefe da Billings (nível 8): jato d'água e o **canto** — aviso no chão em volta dela, quem
  fica é encantado (não anda e é puxado para perto dela) e a esquiva quebra o encanto; deixa a Escama da Iara.
  Números do canto em `data/monsters.json` (`canto`) e no painel do administrador
- [x] **[mundo]** Passar a área da Iara da camada `lendas` para `monstros` na Billings (quantidade 1, na prainha e
  na pedra; a camada `lendas` ficou vazia e saiu do mapa)
- [x] **[arte]** Desenho da Iara (sereia de cabelo comprido com vitória-régia, cauda verde-água; bola d'água na mão
  e pose de canto própria), efeito do canto (notas coloridas se espalhando pela área, com um anel no alcance), o
  jogador encantado (brilho azul, anel no chão e notinhas em cima do nome) e o ícone da Escama da Iara
- [ ] **[estrutura + arte + mundo]** Boitatá como chefe

## 🛠️ Ferramentas do administrador
- [x] **[estrutura]** Painel do administrador, passo 1 — **ajustes do jogo** (http://localhost:3000/admin, só no
  computador do servidor): monstros, itens e loja; vale na hora, valor inválido é recusado com o motivo; ajustes em
  `saves/ajustes.json` (fora do GitHub), marcados no painel, com "voltar ao padrão" e "copiar meus ajustes"
- [x] **[estrutura]** Passo 2 — **ferramentas de jogadores** (aba Jogadores): quem está online (atualiza sozinho),
  dar ouro e itens (testar a loja sem caçar), curar, levar para outro mapa ou posição, aviso para todos e expulsar;
  quem recebe fica sabendo pelo chat; tudo registrado na janela do servidor
- [ ] **[estrutura]** No M5 (internet): senha e conexão criptografada para o painel, banir, registro do que o
  administrador fez

## M4 — Social
- [ ] **[estrutura]** Grupo com XP dividido, guilda, troca entre jogadores e mensagem privada

## M5 — Teste fechado
- [ ] **[estrutura]** Servidor na internet (VPS), domínio e HTTPS (a senha passa a viajar criptografada; atrás de um proxy,
  usar o endereço real de cada jogador nos freios de senha)
- [ ] **[estrutura]** Ferramentas de admin (expulsar, banir, avisos) e registros
- [ ] **[dono]** 20 a 50 pessoas jogando juntas

## M6 — Caminhos (classes)
Ideia que voltou com o documento do ChatGPT (10/11). Só depois do movimento livre, e começando por um Caminho só.
- [ ] **[dono]** Decidir os Caminhos. Proposta da [estrutura], com a cara do folclore: **Caçador da Mata** (arco,
  agilidade, bichos), **Benzedeira/Benzedor** (cura e espíritos), **Guardião** (escudo e corpo a corpo) e
  **Capoeirista** (rápido, esquiva e golpes; no lugar do "Ladino das Sombras")
- [ ] **[estrutura]** Energia (barra azul) para as habilidades e o primeiro Caminho com 3 habilidades

## Ideias para depois (só se o básico estiver divertido)
Crafting, PvP em áreas específicas, chefões, eventos,
noite e dia (lendas da noite), montarias, casas de jogadores.

## Decisões pendentes
- **Nome do jogo** ("MeuMMO" é provisório) — sugestões em DESIGN.md
- **Arte definitiva:** hoje é arte provisória desenhada por código
- **Godot e 3D isométrico** (documento do ChatGPT, 10/11): recomendação da [estrutura] — agora não; primeiro o jogo
  gostoso de andar e com gente jogando. Se ainda quiser 3D depois, um teste pequeno e com prazo antes de decidir
- **Mundo:** São Paulo atual com o folclore (documento do ChatGPT) ou a Selva de Pedra (os 5 mapas de hoje)? A Praça
  da Sé como primeiro mapa ou como zona futura (no `DESIGN.md` ela já é o fim de jogo)?
- ~~Qual personagem fica~~: decidido — o dono escolheu o personagem em camadas da [arte] (com animações de ataque,
  expressões e mais detalhe); ele substituiu o personagem 20x24 a partir da `main`.
