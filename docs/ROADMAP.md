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
- [x] **[arte]** BIRIM, o personagem principal novo, no jogo para testar (19/11, na main): com `?birim` no endereço
  (ex.: `http://localhost:5173/?birim`), o seu personagem e os outros jogadores na sua tela saem com o Birim; o navegador
  guarda a escolha até abrir com `?heroi`. Veja `docs/ARTE.md`, "AGORA"
- [x] **[dono]** Jogar com `?birim` e dizer o que incomoda no tamanho real (FEITO em 19/11: a lista está no
  `docs/ARTE.md`) e escolher: (A) o Birim vira o herói de todos ou (B) cada jogador escolhe. ESCOLHIDA a (A) em 22/11
- [x] **[arte]** Birim para todos (22/11, escolha A do dono): sem nada no endereço, todo jogador sai com o Birim (no
  mundo, no retrato da barra e na mochila; os NPCs não mudam). `?heroi` volta ao herói antigo e o navegador guarda a
  escolha; `?birim` volta ao Birim. Não salva nada no servidor. FEITO em 22/11, na main (veja `docs/ARTE.md`)
- [x] **[arte]** Barba do Birim no retrato (24/11, branch `codex/barba-birim`). A barba abaixo do lábio emenda no queixo e o retrato do HUD mostra o rosto menos de cima. [Arquivos e conferência](ARTE.md#barba-do-birim-no-retrato-2411)
- [x] **[arte]** Refino do Birim em jogo (24/11). Bigode e queixo mais legíveis na câmera do mapa e bermuda com menos tecido pendendo entre as pernas na passada. [Arquivos e conferência](ARTE.md#refino-da-barba-e-da-bermuda-do-birim-no-mapa-2411)
- [x] **[arte]** Acabamento do Birim nos ângulos pedidos (24/11). Barba de frente, volta da corrente no trapézio e caimento da bermuda na caminhada de lado e de costas. [Arquivos e conferência](ARTE.md#birim-de-frente-de-lado-e-de-costas-2411)
- [x] **[arte]** Rosto do Birim (24/11). A costeleta libera o canto do olho e as sobrancelhas continuam legíveis ao virar a cabeça. [Arquivos e conferência](ARTE.md#costeleta-e-sobrancelhas-do-birim-2411)
- [x] **[arte]** Orelha do Birim (24/11). Contorno mais rente à cabeça, dobras mais leves e brinco encaixado no lóbulo. [Arquivos e conferência](ARTE.md#orelha-e-brinco-do-birim-2411)
- [x] **[arte]** Boné e rosto do Birim de perfil (24/11). Aba mais plana com encaixe na copa e olho e nariz legíveis de lado. [Arquivos e conferência](ARTE.md#aba-do-boné-e-rosto-de-perfil-do-birim-2411)
- [x] **[arte]** Peças sumindo no jogo (22/11, o dono: "o shorts some correndo, mirando ou não; o chinelo acontece o
  mesmo; as flechas atrás das costas somem quando o Birim pega a flecha"). Gravado quadro a quadro no jogo: (a) a aljava
  de costas ia para trás do tronco na hora de pegar a flecha — agora fica por cima, com um buraco no formato da mão, e a
  troca de frente/lado/costas tem folga (não pisca); (b) o chinelo de costas e na diagonal de costas não aparecia (no
  tamanho do jogo a beirada da sola virava a linha do contorno e a tira ficava atrás do pé) — sola mais grossa e a tira do
  lado que a câmera vê por cima do pé. FEITO em 22/11, na main. A bermuda não sumiu em ~2.300 quadros gravados (o que cobre é o
  braço ou a outra perna na frente, ou um pilar do cenário): **[dono]** mandar um print se vir de novo
- [x] **[arte]** Passo e junta (22/11, escopo aprovado pelo dono): mirando para o lado de onde anda (~55° a ~130°), o
  quadril fica de lado para o caminho e as pernas andam de lado sem cruzar (o pé de fora abre, o outro junta); de frente
  e de costas como antes. Vale para todos, arco e estilingue, só andando. FEITO em 22/11, na main (veja `docs/ARTE.md`)
- [x] **[estrutura]** Tiro no fim da esquiva (22/11, o dono: "no final da esquiva é possível dar um tiro de flecha;
  arrumar para só poder quando ele voltar da esquiva e fazer a animação"). FEITO em 22/11: rolando (`DASH_ROLL_MS`), o
  servidor recusa puxar e atirar, como o pulo; no navegador, apertar o tiro rolando espera a rolada acabar e, com o botão
  ainda apertado, a puxada começa nessa hora (soltou antes: nada); quem já puxava e rolou volta a puxar depois. Antes: o
  motor deixava começar a puxada durante a rolada (`startCharge`/`tryShoot` não olhavam o `dashedAt`) e o servidor só
  recusava o pulo rolando. Pedido da [arte]: recusar puxar/atirar rolando (cliente e servidor, como o pulo) e, se o botão continuar
  apertado quando a rolada acabar, começar a puxada nessa hora (a animação toda aparece e a flecha só sai depois da
  puxada mínima). O desenho da rolada acaba em 0,62 s, antes dos 700 ms do `DASH_ROLL_MS`: do lado da [arte] não precisa
  mudar nada
- [x] **[arte]** A lista do dono do Birim no jogo (19/11), em etapas: o "V" do tronco e a linha do calcanhar (FEITO em
  19/11); 1) trapézio, ombros, colar e barba de frente (FEITO em 19/11); 2) bermuda, tronco na corrida e pés (FEITO em 20/11); 3) braços
  da corrida (muda o herói também; FEITO em 20/11); 4) mirar para trás com o arco (muda o herói também; FEITO em 20/11:
  o corpo vira e ele anda de costas)
- [x] **[arte]** A boca da bermuda de novo (21/11, o dono: mirando andando S+D/A+S e de costas, no pulo e na esquiva):
  a parte de baixo do peito era pintada por cima do cós (o pescoço separava a pelve do peito na ordem de desenho). A
  bermuda vai depois da última parte do tronco e não pinta a boca dela. FEITO em 21/11 (veja `docs/ARTE.md`)
- [x] **[arte]** A aljava nas costas (21/11, pedido do dono: "coloca a flecha nas costas e ele puxando as flechas das
  costas"; sem alça): um tubo de taquara com 5 flechas, a boca atrás do ombro direito (cruza com o arco em X); a cada
  tiro a mão direita tira uma flecha por cima do ombro e leva até a corda, dentro da puxada mínima. FEITO em 21/11 (veja
  `docs/ARTE.md`)
- [x] **[arte]** O arco nas costas (21/11, pedido do dono: "coloca animação puxando o arco das costas"): parado, o arco
  fica atravessado nas costas; no tiro, a mão esquerda busca por cima do ombro e traz para a mira (dentro da puxada mínima,
  0,3 s); 4 s depois do último tiro ele guarda. Tiro de toque e de outro jogador: direto na mão; Flecha Ancestral armada:
  saca e segura. FEITO em 21/11 (veja `docs/ARTE.md`)
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
- [x] **[mundo]** Trava invisível nas moitas (print do dono, 19/11; feito em 19/11, na main: a moita virou um octógono de três caixas — a mesma largura para os quatro lados e as quinas na beira das folhas; as 54 do Capão que abririam um vão de entalar com o que está colado nelas ficam com o quadrado de antes. Na calçada da rua leste, o pé agora para encostado nas folhas): a caixa `mata-fechada` é um quadrado de 1,8 × o
  raio da moita, e as pontas passam ~30 cm das folhas. No fim da calçada oeste da rua leste do Capão (x 87–88, y ≈ 80),
  a ponta da moita 2522 cobre o fim da calçada e o meio-fio: o personagem para a ~0,5 m das folhas. Proposta da
  [estrutura], testada só no computador de teste: quadrado de 1,45 × o raio (as pontas na beirada das folhas; a cerca
  de moitas continua fechada). Em `gen-capao.ts` e `gen-guarapiranga.ts` (pedido mandado ao [mundo])
- [x] **[estrutura]** Voltar onde saiu (o "pode" do dono em 19/11): quem saía do jogo encostado numa moita, árvore ou
  parede voltava na Clareira (o servidor guarda o tile do pé e só procurava lugar dentro dele; ~1% dos lugares do
  Capão). Agora procura o lugar livre mais perto do meio do tile, até 1,5 m: no canto da calçada, voltou a 0,43 m
- [x] **[estrutura]** "Andar até" um ponto dentro de uma moita ou árvore (o "pode" do dono em 19/11): ia até o lugar
  livre mais perto em linha reta, mesmo do outro lado de uma cerca de moitas (no Capão, uma volta de 33 m). Agora cada
  metro mais longe do toque vale 4 m de caminho: para do lado de quem anda, encostado (no Capão, a 1,4 m do toque)
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
- [x] **[arte]** Ícones da Água de Coco (`agua_coco`) e da Garrafada (`garrafada`), já em `data/items.json` (pintados em
  13/11, com a interface nova; em 15/11 entraram os do Estilingue de Goiabeira e da Faca de Sucata, em `paintedIcons.ts`)
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
- [x] **[arte]** O molde de gente dos NPCs e a Xiovanna nova (15/11, pedido do dono): `js/creatures/pessoa.js`
  (`PD.creatures.definePerson('chave', aparência)`: pele, cabelo afro/curto/coque/longo/careca, rosto, jaqueta ou
  camiseta, calça/bermuda/saia, tênis ou chinelo, altura e largura); corpo de gente no traço do herói (tronco, braços
  com cotovelo, mãos com dedos), piscando e falando. A Xiovanna é a primeira aparência dele
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
- [x] **[arte]** Zoom sem travar (conversa, roda e +/-): o chão (`ground.js`) esticar os pedaços velhos enquanto o zoom
  muda e refazer só quando ele parar, como os objetos já fazem; e o orçamento de refazer imagens (`buildBusy`) contar
  o primeiro desenho de cada imagem nova (é onde o navegador pinta de verdade) (14/11): o chão guarda os pedaços do
  zoom anterior e os estica enquanto o zoom muda; os novos só são feitos com o zoom parado (180 ms), uns 6 ms por
  quadro, com os velhos por baixo (sem buraco). Os objetos e a casa cortada também esticam e não se refazem enquanto o
  zoom muda (`World.zoomSettling`), e cada imagem nova é pintada na hora em que é feita (`rasterNow`), para a conta do
  quadro ser a de verdade. Medido no Chromium sem placa de vídeo (parado, 33 a 50 ms por quadro): no zoom da conversa
  o pior quadro caiu de 200–267 ms para 83–117 ms e os acima de 100 ms de 10 para 0–2; na roda, de 183–200 ms para
  83–117 ms e de 16–23 acima de 100 ms para 0–1
- [x] **[estrutura]** Som do arco: "quando puxa parece um motor girando, feio demais" (14/11): sem tom contínuo; agora
  é a madeira do arco rangendo (estalinhos que aceleram e ficam mais fortes com a carga) e um chiado fino de corda
- [x] **[arte]** Arco: "o braço fica feio puxando" (14/11, na main): puxando, o herói fica de lado para o
  alvo como arqueiro de verdade (o ombro do arco aponta para o alvo, o cotovelo da corda vai para trás na linha da
  flecha, a cabeça olha ao longo dela); antes o cotovelo subia e saía de lado, como asa
- [x] **[arte]** Esquiva: "está feia demais" (14/11, na main): no jogo ela não tinha movimento (o herói
  aparecia 3 m adiante de uma vez); agora ele rola no chão (abaixa, gira uma volta e levanta, 0,5 s), para todos
- [x] **[mundo + arte]** A cama do quarto do Joaquim está invertida (14/11): o [mundo] virou a cama na planta
  (`olhando: 90`, ramo `mundo/cama-vo`) e o desenho da [arte] passou a ler o `olhando` (a cabeceira no lado oposto aos
  pés; antes ficava sempre no oeste). Na main (14/11), junto com o `mundo/lote1-mapa`
- [x] **[mundo + arte]** A entrada da Budega ("está péssima") (14/11): o [mundo] marcou o vão da porta
  (`portaDe`/`portaAte`), tirou o varal da frente e levou o orelhão para o poste de luz da praça (ramo
  `mundo/budega-entrada`); a [arte] desenhou o vão da loja (a porta de aço enrolada, os trilhos, a soleira e, lá
  dentro, o piso de ladrilho, a geladeira, o balcão e as prateleiras acesas, sem o musgo da fachada por cima) e o
  orelhão preso no poste. Na main (14/11), junto com o `mundo/lote1-mapa`
- [x] **[arte]** Entrada e saída dos interiores com animação (a volta para o mundo é muito repentina) (14/11, na
  main): o telhado e a frente saem e voltam em 0,6 s suaves; saindo, a casa continua em foco até o telhado voltar
  (o escuro em volta abre como uma íris, em vez de sumir de uma vez) e a câmera volta junto

**Mundo:**
- [x] **[mundo]** Aumentar a floresta (**na main em 15/11**, com o desenho da [arte]; planta aprovada em 14/11): o parque
  cresce mais 60 m para o sul (Clareira da Paineira com o parquinho antigo, Cachoeirinha, mata profunda do sul com o
  recanto do Véu, buraco no gradil), a mata ao sul da vila vira mata de andar com o posto abandonado na beira da rua, a
  rua desce até o fim novo e a vila ganha 13 árvores
- [x] **[arte]** Desenhar as coisas da floresta maior (15/11, com o `mundo/floresta-maior` junto na main): o arquivo novo
  `prototipos/pindorama-25d/js/world/sul.js` — a `paineira` (tronco de garrafa verde com espinhos e raízes de tábua, copa
  cor-de-rosa com as florzinhas, pétalas caindo e o tapete de flores no chão), o `parquinho` (balanço com a corrente
  arrebentada, escorregador, gira-gira com mato no meio; ferrugem e cipó), a `cachoeira` (pedras com musgo, a água
  descendo e a espuma mexendo), a `cobertura` do posto (mato e arvorezinhas em cima, faixa laranja, cipó pendurado;
  fica por cima de quem está embaixo e transparente com o herói embaixo ou atrás) com os 4 pilares, as `bomba`s velhas
  sem marca e a pilha de `pneus`; no props.js, a lojinha (`casa` com `posto`: vitrine quebrada e porta de enrolar meio
  aberta) e o gradil `quebrado` (barras faltando e tortas, o corrimão partido); no fundo.js, a placa `torta` em branco;
  no flora.js, a `pinguela` de `pedras`
- [x] **[mundo + arte + estrutura]** A Budega maior, igual à de verdade (15/11, com as fotos do dono; aprovada: "ficou
  ótimo, lembre-se de colocar interior com infestação da floresta"; **na main em 15/11**, com o desenho da [arte]). O
  mapa do [mundo] (ramo `mundo/budega-maior`): 8 × 5,5 m no mesmo canto da praça; a vitrine à esquerda e a porta de
  enrolar de 3 m à direita; dentro, igual à imagem aprovada, o piso branco, as prateleiras pretas e amarelas, a geladeira de duas portas, o
  ventilador, o balcão de vidro dos doces, o freezer solto, o caixa em L na frente da parede de grama com o escudo
  aceso (a Xiovanna atrás, só ela passa) e a dracena no canto, e a floresta entrando (raiz, mato, samambaia, cipó e
  musgo); na frente, o degrau com capacho, o vaso de dracena, a lousinha e dois caixotes de fruta; a fogueira andou 2 m
  para a direita, as mesas desceram e o varal do sul passa por um poste novo, entre a praça e o campinho. Fotos e
  desenhos: `docs/referencias/budega-*.jpg`
- [x] **[arte]** O desenho da Budega maior (15/11, `js/world/budega.js`, igual às imagens aprovadas): a fachada preta
  com a moldura amarela, o escudo na faixa, a vitrine de fundo amarelo, a porta de enrolar mostrando o fundo e o LED
  branco; dentro, o piso porcelanato, as paredes com azulejo e "FIADO SÓ AMANHÃ", os armários de nichos, a geladeira
  de vidro, o caixa em L, o balcão de vidro dos doces, o freezer, a parede de grama com o escudo aceso, o ventilador
  e a dracena; na calçada, o degrau com capacho, a lousinha, os caixotes de banana e laranja e o vaso de dracena; de
  noite, a vitrine e a porta acesas e o LED
- [x] **[estrutura]** A Xiovanna no lugar novo, (66,6; 50,55), atrás do caixa, no `data/npcs.json` (a [estrutura]
  autorizou o [mundo] a trocar as duas linhas no mesmo commit do mapa, no ramo `mundo/budega-maior`)
- [x] **[mundo + arte]** Os interiores com partes da floresta também (plantas, cipó, raiz), como o mapa em geral
  (14/11): o [mundo] marcou no mapa (`mundo/lote2-floresta-dentro`) a raiz `dentro`, o capim nas frestas, a samambaia
  `dentro` nos cantos e o `cipoDentro`/`musgoDentro` das casas; a [arte] desenhou: a raiz sai de baixo da parede, corre
  pelo piso levantando os pedaços (cerâmica, taco, ladrilho ou cimento, da cor do piso; no tapete, rasga e mostra a
  terra) e afunda no fim; a samambaia é da casa (aparece com o herói lá dentro, como os móveis); o cipó sobe do chão
  perto dos cantos e, nas casas com gente, desce de uma fresta do teto; o musgo sobe do rodapé na abandonada
- [x] **[estrutura]** Mais bichos, as regras (14/11, aprovados pelo dono): `quati` (nível 2, bando de 4), `tatu_bola`
  (nível 3: casca que segura 70% de frente e tonto 2 s depois da investida), `marimbondo` (nível 3: enxame, 40% das
  pedras passam pelo meio) e `filhote_boitata` (nível 5, investida com rastro de fogo, só de noite) em data/monsters.json
  (protocolo 34: os efeitos `dizzy`, `dodge` e `vanish`). Já dá para criar pelo menu ADM
- [x] **[mundo]** As áreas dos bichos novos na mata do sul do Capão (A quati, C tatu_bola, D marimbondo, B filhote_boitata)
  (**na main em 15/11**, com a floresta maior): quati 4, tatu_bola 3, marimbondo 3 e filhote_boitata 1 no recanto do Véu
- [x] **[mundo]** Mais bichos na mata do Capão (16/11, pedido do dono: "bastante mesmo"; na main): de 18 para 40 —
  sagui 8, jararaca 6, quati 10, tatu_bola 8, marimbondo 6, filhote_boitata 2 (o peso medido pela [estrutura] com `?fps`)
- [x] **[mundo]** Mapa 02 (Guarapiranga), pedaço (a), no jogo (19/11, pedido do dono: "desenhe o mapa e coloca no
  jogo"; na main): a chegada pela Estrada do M'Boi Mirim (a estrada do sul do Capão vai até a beira do mapa, sem a
  barreira) e o Refúgio na beira da represa, desenhados pelo [mundo]: casas de tábua com telhado de zinco enferrujado,
  a quitanda com o toldo e a banca de frutas (a Dona Iracema fica atrás dela), canoas, voadeira e barco afundado,
  barris, redes, varais, lampiões e janelas que acendem à
  noite e a água mexendo (ondinhas com o vento, brilhos, espuma na margem). Mapa `guarapiranga` (120 × 100 m)
- [x] **[estrutura]** (19/11, `iracema_guarapiranga` e `barqueiro` em data/npcs.json; conferido no PC e no celular) A Dona Iracema e o Barqueiro no Mapa 02 (`guarapiranga`): pés em (57,5; 50,6) e (49,6; 62,4),
  os dois olhando para o sul (combinado em 19/11: só esta parte pequena, a região 2 segue pausada)
- [ ] **[mundo]** O chão, a luz e a água com mais qualidade (17/11, pedido do dono: "chão feio, água sem
  movimentação, ambiente pífio"; direção aprovada: "é esse o caminho"). Alvo: `docs/referencias/chao-pintado-alvo.jpg`
  (o antes: `chao-pintado-antes.jpg`). Três passos, cada um jogável, começando pela Clareira dos Despertos: (1) o chão
  pintado (manchas claras e escuras na grama e na terra, sem bolinhas iguais; beiradas que se misturam, sem contorno
  escuro; marcas de uso); (2) luz e sombra no chão (sombra comprida das árvores, manchas de sol); (3) água e vida
  (ondinhas, reflexo, margem de lama; poeira de luz, borboletas, folhas caindo). Era da [arte]; desde 19/11 o desenho
  do mapa é todo do [mundo] (escolha do dono). Começado: a água mexendo (`js/world/agua.js`, no Mapa 02). **Passo 1
  na main em 19/11** ("junta agora e segue", vendo o alvo, o antes e o depois no mesmo lugar): o chão pintado que a
  [arte] começou em 17/11 (`js/world/chao.js`: tinta de aquarela por material, folhas, tufos, florzinhas e pedrinhas no
  lugar das bolinhas, beiradas que se misturam, trilhas sem contorno e pedras repintadas; o mesmo peso do chão antigo).
  Mais perto do alvo em 19/11 (na main, o dono escolheu "gráfico primeiro"): a grama oliva (sem o limão), com as pintas
  redondas claras e escuras do alvo, e a trilha com os sulcos escuros compridos; medido contra o alvo (saturação dos
  verdes 0,47 × 0,45, brilho 0,55 × 0,53). **Passo 2 na main em 19/11** ("pode seguir"): as sombras das árvores compridas
  e macias (finas no pé e largas longe), a beirada esfumada e o escurecer que guarda a cor do chão (a grama na sombra
  fica verde-escura, não roxa), e acabou a faixa clara onde duas sombras se cruzavam (junto do poste). **Passo 3 na
  main em 19/11** ("pode seguir"): a vida no ar e na água (`js/world/vida.js`): folhas secas caindo das árvores de copa
  (e boiando quando caem na água), borboletas de dia na grama, a poeira de luz, libélulas e peixe pulando na água, e
  vaga-lumes de noite que acendem o escuro em volta (0,3 ms por quadro). **O reflexo na água na main em 20/11** ("pode
  seguir com o reflexo na água"): de dia, o que fica perto da água (as casas e os postes do Refúgio, os barcos, as
  árvores da margem) aparece de ponta-cabeça na água, mais fraco e com as ondinhas por cima; de noite, cada lampião e
  janela acesa deixa a faixa de luz tremida na água (só onde é água: o deque, as casas e os barcos na frente tampam)
- [ ] **[dono + estrutura + mundo]** **Mundo aberto, sem tela de carregamento** (19/11, direção nova do dono: "vamos
  focar para ter o mapa como se fosse aberto sem carregamento"). PARADO até ele pedir; aí decidimos por qual lado ir
  primeiro. O escopo melhorado dele (o texto e o que tem na imagem: Guarapiranga de 400 × 320 m com 13 pontos) está
  em `docs/MUNDO.md`, "Próximos passos"
- [x] **[mundo]** O Guarapiranga grande, **400 × 320 m, o mapa inteiro aberto** (22/11, pedido do dono: "pode seguir com
  o Guarapiranga maior"; escolheu "mapa inteiro primeiro"; a planta: `docs/referencias/mapa-02-400-planta.jpg`; na main):
  a represa no meio com a Ilha do Véu (só de barco, depois); a estrada contorna pelo norte e pelo leste — a Comunidade da
  Represa (zona segura, com a praça do Brejo Maior, a fogueira e as bancas), o campinho, a praça em ruínas com o coreto,
  a trilha até a cachoeira e o riacho, o clube náutico em ruínas (o píer quebrado) e o prédio da Barragem de 1909 — até a
  saída para Santo Amaro (fechada por uma barreira até o mapa de lá ficar pronto; a chegada `chegada-santo-amaro` já
  está no mapa); pelo oeste, o mirante, o brejo do sul, a trilha da margem sul e a Caverna Sagrada; o muro da barragem
  fecha a volta (as duas comportas jogam água na várzea de caça, ao sul). O Refúgio, a chegada, a Dona Iracema e o
  Barqueiro no mesmo lugar (o mapa só cresceu para a direita e para baixo). 9 áreas de caça (45 bichos, os que já
  existem) e o lugar das capivaras da várzea. Os prédios especiais começam simples. O motor do mapa ganhou a grade de
  procura (cada quadro olha só o que está perto da tela: o mapa grande ficou tão leve quanto o Capão) e a água recorta
  só o pedaço da tela
- [ ] **[mundo]** Vestir cada região do Guarapiranga grande, depois de o dono andar e aprovar o tamanho e os caminhos:
  o clube, a barragem de 1909, o coreto, a caverna e o mirante com desenho próprio. **A comunidade na main em 23/11**
  ("pode seguir vestindo a comunidade primeiro"): 49 casas coladas em fileiras, de 1 a 3 andares (as altas no fundo),
  de tijolo baiano à mostra, rebocadas e pintadas ou só com o puxadinho no tijolo, laje com caixa d'água, ferro espetado,
  varal e plantas; ruelas de cimento; na praça do Brejo Maior, o Lemos Bar (com as mesas), a Peixaria, o Salão da
  Neide e o Mercadinho, as bancas de frutas, de peixe e de artesanato, o muro grafitado "BREJO", os postes com a fiação
  cheia de pipas enroscadas e as bandeirinhas; de noite, parte das janelas acesas. **O clube náutico na main em 24/11**
  ("pode seguir vestindo o clube náutico"): a sede com o letreiro pintado "CLUBE NÁUTICO", a árvore na laje e a varanda,
  o vestiário, a garagem dos barcos com as canoas amarradas, a piscina verde com a beira de azulejo, o trampolim, a
  escadinha de inox e as cadeiras, a arquibancada de cimento virada para a represa, o mastro com a bandeira rasgada e,
  perto do píer quebrado, um veleiro afundado com o mastro e a vela para fora d'água. **A Barragem de 1909 na main em
  24/11** ("pode seguir vestindo a barragem de 1909"): o prédio de comando de tijolo antigo, com as janelas altas em arco
  e moldura de pedra, a porta grande em arco, a cornija, o frontão com o ano 1909 e a árvore na laje; a torre do relógio
  parado; a praça de paralelepípedo com a grade de ferro, o portão de pilares, a placa, os postes antigos e a engrenagem
  enferrujada largada; e, no muro da barragem, os postes de ferro e o guincho em cima de cada comporta. **O coreto na
  main em 24/11** ("pode seguir vestindo o coreto / porém arruma issos"): o coreto octogonal de ferro na Praça em Ruínas
  (base de alvenaria com reboco caído e pichação, escada com o portãozinho caído, piso de ladrilho, gradil com um pedaço
  arrancado, colunas verdes com as mãos-francesas, lambrequim, telhado de zinco com ferrugem e um buraco, lanterninha),
  os quatro postes antigos e as moitas no pé; não dá para subir. E o que o dono achou feio: a água que desce (comportas
  e cachoeira) refeita — nas comportas, o muro de pedra com a boca em arco, o jato e o tanque de pedra; na cachoeira, as
  pedras com lados no lugar das bolas —, o paralelepípedo maior e com volume (e a guia de granito), o caminho da barragem
  em lajes e a ponta da trilha de terra escondida embaixo das lajes. **A Caverna Sagrada na main em 24/11** ("pode seguir
  vestindo a caverna"): o morro de pedra com a boca escura virada para o sul e a luz verde-água respirando lá no fundo;
  na pedra, as itacoatiaras gravadas (que brilham de noite) e as pinturas de ocre (gente dançando, a capivara, o veado e
  as mãos); as raízes descendo pela boca, as estalactites, o cipó e a mata em cima; na clareira de pedra, a fogueira
  apagada com brasas e fumacinha, as duas oferendas com velas acesas, a pedra ancestral, as pedras soltas e os esteios
  com fitas no vento na entrada da trilha. Não dá para entrar (a boca pode virar a entrada de uma caverna por dentro;
  o dono, 24/11: "deixa para futuramente"). **O mirante na main em 24/11** ("pode seguir vestindo o mirante"): o deque
  maior (8 m) com a torre de observação de troncos (escoras em X, dois andares, a escada, o guarda-corpo lá em cima com a
  plaquinha MIRANTE e o telhado de sapê; não dá para subir), o guarda-corpo do deque com a entrada para a trilha, a
  luneta de moedas virada para a represa, o painel com o mapa da represa e as aves, o banco, os lampiões e as
  helicônias; para o leste, a mata aberta num gramado até a margem. **Com isso, as regiões do Guarapiranga estão
  vestidas; o dono vai parar neste mapa e voltar depois para os detalhes**. **A Ilha do Véu na main em 24/11** ("pode retomar
  o Guarapiranga"): a Árvore do Véu, a maior árvore do jogo, com os símbolos acesos no tronco e o Véu na frente (a
  cortina de raízes que brilham e a luz que sobe alta), a Pedra da Ilha e as oferendas; a roda de 9 pedras em pé com as
  itacoatiaras viradas para o meio (brilham de noite) e a oferenda no meio; o atracadouro virado para o Refúgio, com a
  canoa amarrada, os esteios de fitas, a fogueira apagada e a areia; a Trilha do Véu ligando tudo; pedras com musgo na
  água rasa, taboas, aguapés e cogumelos que brilham. Continua só de barco: a chegada `chegada-ilha-do-veu` fica na ponta
  do atracadouro, para a viagem com o Barqueiro. **Os detalhes (24/11, "pode seguir com os detalhes do
  Guarapiranga"), por partes:** o campinho de várzea ganhou a arquibancada de cimento atrás do campo, o muro grafitado
  do Brejo FC atrás de um gol e o alambrado rasgado atrás do outro, a barraca de pastel e caldo de cana com a mesa, o
  mastro com a bandeira e a bola esquecida no campo
- [x] **[estrutura]** O bando de capivaras da várzea do Guarapiranga (`capivaras-varzea`, descanso em (300; 300)) em `data/bichos.json`: FEITO em 22/11 (`capivaras_varzea`, 3 capivaras, como o bando do lago do Capão). Conferido: o servidor sobe sem aviso e as três aparecem deitadas no descanso
- [x] **[mundo]** O polimento da lista do dono (23/11, com prints; na main): árvores sem a emenda "cortada" no tronco,
  sombras das árvores perto do pé e no contorno da copa (sem o "balão"), calçada da estrada com placas e meio-fio,
  rachaduras finas, peixes pulando de verdade (maiores, mais vezes, com respingo), o reflexo que balança e some longe da
  base, barcos com tábuas, cavernas e motor de popa, o ponto de ônibus redesenhado e as casas com reboco caído, sombra no
  pé da parede e o cano da laje
- [x] **[mundo]** O Capão maior (19/11, "os dois maiores": cresce para a direita, com mais rua, casas e mata). Crescer
  só para a direita e para baixo (a origem não muda: o mapa explorado de quem já joga não desalinha) e avisar a
  [estrutura] antes de juntar se um NPC ou uma chegada mudar. **Etapa 1 na `main` (23/11, planta aprovada): 96 → 192 m
  de largura, o mapa inteiro aberto.** Nada da parte antiga mudou de lugar (só saiu a mata fechada da beira leste antiga
  e o viaduto seguiu até a beira nova); nenhum NPC, chegada ou saída mudou. A rua da Budega segue até a beira nova; a
  Rua Nova e a Rua do Córrego sobem até o caminho de terra embaixo do viaduto e descem para o sul; o comércio de frente
  para a rua (padaria, bar, salão, açougue), as casas em fileira com viela, a Rua Dois, a feira livre (15 bancas), a
  escola estadual abandonada com a quadra, a pracinha e a Estação Capão Redondo (fechada: a saída para o leste fica para
  depois). Ao sul, a Mata do Córrego (de caçar: quatis, tatus-bola, marimbondos e jararacas, 25 a mais), com o córrego e
  a ponte, o ferro-velho, o morro com o escadão e a prainha
- [x] **[mundo]** Vestir as regiões do Capão maior (23/11, "pode seguir vestindo as regiões do Capão"; tudo na `main`):
  a Estação Capão Redondo (`estacao`: o prédio de concreto com a faixa lilás e o nome, as vidraças, a marquise sobre as
  portas de aço baixadas, a bilheteria e, lá em cima, a plataforma com a cobertura curva em cima dos trilhos); a Escola
  Estadual (a fachada de escola, `estilo: 'escola'`, a quadra de cimento pintada, o alambrado, a arquibancada, o pátio,
  os bancos e o mastro); a Feira Livre (as lonas listradas, a banca de pastel com caldo de cana, os caixotes, os
  carrinhos de feira e a placa); a ponte de concreto (as muretas e a lateral descendo até a água); o ferro-velho (as
  pilhas de sucata e o nome pintado no escritório); e o morro (o escadão de degraus, o corrimão e os "gatos" com pipa).
  O mapa é plano: o morro não sobe (subindo para o lado da câmera, as fileiras de cima esconderiam as de baixo)
- [x] **[arte]** Desenhar os quatro bichos novos e as ações `dizzy` (tonto), `dodge` (a pedra passou pelo enxame),
  `vanish` (o boitatá indo embora) e `block` no tatu (a casca segurou) (15/11): `quati.js`, `tatu.js`, `marimbondo.js`
  e `boitata.js` em `prototipos/pindorama-25d/js/creatures/` — o quati trota, fareja, encolhe e morde; o tatu fecha
  em bola e rola, solta a faísca do tlinc e fica com as estrelinhas; as 5 vespas fecham, abrem num anel na ferroada,
  se espalham e despencam; o boitatá é chama sem contorno com brilho no chão, investe e apaga com fumaça. Os olhos
  de todos os bichos ficam vermelhos à noite (`PD.creatures.eyes.night`, a ligar no dia e noite). Prancha:
  `node ferramentas/prancha-bichos.cjs saida.png [escala]`
- [x] **[estrutura]** As capivaras andando, as regras (14/11): os bichos de data/bichos.json ganharam `tipo`,
  `quantidade` (bando), `dentroDeCasa` e `"mia": false`; dois bandos no Capão (lago 3, campinho 2), que deitam lado a
  lado em volta do ponto de descanso, acordam cada um numa hora e gostam de carinho (estalinhos); desenho provisório
  marrom até o da [arte]. Conferido com o mapa do ramo do [mundo] (os pontos ainda não estão na main)
- [x] **[arte]** O desenho da capivara que anda (14/11): a criatura `capivara` (`js/creatures/capivara.js`, o desenho
  da capivara do cenário em bolas): anda com as patas em diagonal e o corpo subindo e descendo, corre (passada
  aberta), parada pasta (a cabeça desce e mastiga) e olha em volta, deita (`sleep`/`wake`; com `asleep` já aparece
  deitada) e fica contente com o carinho (`purr`: fecha os olhos e ergue o focinho). Prancha:
  `ferramentas/prancha-capivara.cjs`
- [x] **[mundo + arte]** Juntar os pontos das capivaras e o desenho da capivara na main, e tirar as capivaras de enfeite
  do mapa (15/11, com o "pode" do dono): `capivaras-lago` e `capivaras-campinho`, com o `-descanso`, e as cinco paradas
  fora
- [x] **[estrutura]** Mapa da tecla M e mini mapa, a parte das regras e o desenho provisório (14/11): o mapa em
  quadradinhos de 4 m, explorado a até 12 m de onde você anda, salvo no personagem (passo 5 do arquivo); o M (ou tocar
  no mini mapa) abre o mapa inteiro com a neblina, os nomes dos lugares já vistos, os NPCs (com ! e ?) e a sua seta;
  o mini mapa fica no canto (protocolo 36)
- [x] **[mundo]** A imagem de cima de cada mapa (`<id>-mapa.png` + `<id>-mapa.json`, o formato combinado): o jogo já
  procura e, quando existir, ela entra no lugar do desenho provisório. A do Capão na `main` em 15/11 (o gerador escreve
  as duas junto com o mapa, por `scripts/mapa-de-cima.ts`; os nomes saem em ordem de importância)
- [x] **[arte]** Deixar bonitos a janela do mapa (`#map-window`) e o mini mapa (`#minimap`): a moldura, o lugar na tela
  e talvez girar a imagem para bater com a câmera (15/11; o dono achou o provisório "horrível"): os dois giram 45° como
  a câmera (a rua que na tela corre de lado corre de lado no mapa), com os nomes e os sinais em pé; você é um ponto
  dourado com contorno branco, pulsando (os NPCs são verde-água); a neblina escurece sem esconder o contorno; o mini
  mapa é redondo, com anel de madeira trançada, a faixa vermelha tribal, folhas e o N (PC: embaixo da mochila; celular:
  menor, embaixo do retrato); o mapa do M é um losango na moldura da mochila (o visual do `mapWindow.ts` é da [arte])
- [x] **[estrutura]** Dia e noite, as regras (14/11, números aprovados pelo dono): 30 min de dia e 10 de noite, um relógio só
  para todos os mapas, preso ao relógio de verdade; à noite os bichos com 25% a mais de vida e dano e 50% a mais de XP
  e ouro; painel (Combate → Dia e noite); menu ADM "Virar dia / Virar noite"; aviso ao anoitecer e amanhecer; o som da
  mata troca os passarinhos pelos grilos e a coruja; o desenho provisório escurece (protocolo 33)
- [x] **[arte]** O desenho da noite (15/11): o `PD.View.setTimeOfDay({ light, night })` (view.js) escurece a tela com um
  azul frio (mais fraco em volta do herói, para ver quem chega), passa um laranja quente no meio do anoitecer e do
  amanhecer e acende as luzes: os postes (poça de luz no chão e o halo na lâmpada; os `apagado` ficam apagados), a
  fogueira tremendo, a luz saindo pela porta das casas com gente e da Budega, e o filhote de boitatá iluminando em
  volta dele; os cogumelos e os véus brilham mais. Os olhos dos bichos (sagui, jararaca e os quatro novos) ficam
  vermelhos enquanto `night` (`PD.creatures.eyes.night`). Lampião novo é só o [mundo] marcar um `poste`/`poste-praca`
  com `luz` (ou uma `fogueira`)
- [x] **[estrutura]** Drop de itens nos bichos (14/11, escolha do dono: "no chão, como o ouro"): os itens caem em volta do
  bicho, com o desenho de cada um (caindo com quique, "×2", brilho no raro e facho de luz no lendário), e você pega
  passando por cima; ficam 2 minutos; com a mochila cheia, esperam no chão
- [ ] **[estrutura]** O arco e o estilingue de goiabeira nos bichos novos, quando eles chegarem (hoje o estilingue cai do
  sagui, 4%; o arco só na Budega)
- [ ] **[arte]** (Opcional) restilizar o item no chão (`drawDrops` em `src/client/novo/combat.ts`: ícone, quique, brilho)
- [x] **[estrutura]** Vento forte e fraco, as regras (14/11): um vento só para o mundo, calmo, brisa ou forte por 2 a 6
  min, mudando devagar (20 s) e girando a direção; `welcome.wind` e a mensagem `wind` (protocolo 35); o motor passa
  à view `setWind(força, ângulo)`; o som do vento, das rajadas e das folhas acompanha; menu ADM "Calmo / Brisa / Vento
  forte"
- [x] **[arte]** As árvores no vento (14/11): `PD.View.setWind(força, ângulo)` (força de 0 = parado a 1 = forte;
  ângulo em graus no chão, para onde sopra); sem chamar, uma brisa (0,35). As rajadas viajam no sentido do vento (as
  árvores cedem uma depois da outra), cada árvore com o seu ritmo, inclinada para onde ele sopra; a copa balança em
  faixas (o alto mexe mais, junto do tronco quase nada). No zoom normal: parado ~1 px, brisa ~2,6 px, forte ~9 px no
  alto da copa; as pétalas do ipê voam com ele
- [x] **[estrutura]** A flecha que acerta a árvore fica presa nela, parte das regras (14/11): o `shot_end` diz onde o tiro
  parou (na casca, não 25 cm dentro) e no que bateu (`on`: o tipo do objeto da colisão, ex. 'tronco'); o motor voa o
  desenho até lá e chama o `projectileEnded` com `stuck` (protocolo 32)
- [x] **[arte]** Desenhar a flecha cravada no tronco (na altura do voo, `stuck.z`), em vez de no chão ao pé da árvore
  (14/11): na madeira (tronco, bambu, tronco caído, mata fechada e os móveis) ela crava na altura em que bateu, treme,
  solta lascas e deixa o furinho; vindo quase na direção da câmera (até uns 30°) ela bate do lado de lá e o tronco a
  esconde (só as lascas aparecem). Na pedra, na parede e no resto ela quica com faíscas e cai deitada no chão, com
  sombra; na água (`on: 'agua'`, que a [estrutura] manda também no fim do alcance em cima do lago) ela mergulha com
  um esguicho, uma coroa de gotas e três anéis; a pedra do estilingue só levanta poeira. Tudo some em uns 2 s
  (`tests/projectileArt.test.ts`)

**Personagem e controles:**
- [x] **[estrutura]** Esquiva no Shift (configurável) e Espaço para pular (14/11): janela das teclas (botão "Teclas" no
  painel do som, só no computador; fica guardado no navegador), o pulo passa pelo servidor e quem está perto vê
  (protocolo 31; por enquanto só de enfeite), o andar devagar foi para o `C` (liga e desliga), o som ficou sem tecla
  (painel do som) e o `M` está reservado para o mapa (por enquanto só avisa)
- [x] **[arte]** O pulo de verdade no boneco (o motor manda `action(id, 'jump')`, seu e dos outros; o animador do
  protótipo já pula com `input.jump`) e um botão de pular no celular (o tipo `ActionSlot` com 'jump' e o ícone; o motor
  põe na barra) (14/11): a view pula (`jumpPulse`); o `ActionSlot` 'jump' com o ícone pintado (o pé subindo); no
  computador ele vai no 6º quadrado da moldura e, no celular, em cima da coluna da esquerda (em cima da direita fica a
  mochila). Falta a [estrutura] pôr o `{ slot: 'jump' }` na barra e o `tryJump` no `onAction`
- [x] **[arte]** A etiqueta da tecla da esquiva na barra: o estilo desenha a barra de espaço fixa
  (`.action[data-slot='dash'] .key`), mas a esquiva agora é o Shift e o jogador pode trocar; e o "Como jogar" da tela
  de entrada (`index.html`) com as teclas novas (14/11): a etiqueta mostra a tecla de verdade (`data-key`): "Espaço"
  vira a barra de espaço, "Shift" a seta do Shift e os nomes compridos ficam com a letra menor; o "Como jogar" com
  Shift esquiva, Espaço pula, C anda devagar, M mapa (em breve) e as teclas no 🔊 → Teclas
- [x] **[arte]** Tirar o J da barra de habilidades: o tiro é o ataque básico, não é habilidade (no celular continua um
  botão de atirar, à parte) (14/11): no computador a barra é bordunada, fôlego, esquiva, defesa (4º quadrado) e pulo
  (5º); o 6º fica livre para a próxima habilidade; o tiro é o clique (a tecla J continua valendo). No celular, o tiro é
  o botão grande (88 px) no canto de baixo à direita; a bordunada, o fôlego, o pulo e a esquiva num 2x2 ao lado dele
  (deitado) ou em cima (em pé), com a esquiva colada no tiro (só `style.css`)

**Habilidades (combinadas com o dono em 15/11):** todo mundo começa igual; as missões do começo liberam a escolha da
classe; por enquanto só o **Caçador da Floresta** (arco e flecha ou estilingue: DPS à distância, velocidade, precisão e
os espíritos dos bichos); 1 ponto por nível para pôr nas habilidades, até 5 em cada (mais dano, e o visual muda com 3
e com 5); a Bordunada sai do jogo novo e o Fôlego fica.
- [x] **[estrutura]** Passo 1 (15/11): a classe e os pontos salvos no personagem (passo 6 de `MIGRATIONS`, protocolo
  37), a escolha depois de "Saguis Encantados" (`liberaDepoisDe` em `data/classes.json`), 1 ponto por nível (o 1º no
  nível da habilidade, os outros a cada 2 níveis), a janela das **Habilidades** (`K` ou o botão ✦: escolher, pôr
  pontos, recomeçar de graça), a Bordunada fora do jogo novo (o `Q` e o 1º quadrado da barra são da classe) e a
  **Chuva de Flechas** de ponta a ponta: segurar `Q` mira com um círculo e soltar usa (o botão e o celular miram
  sozinhos onde pega mais bichos); as flechas (pedras, com o estilingue) caem 0,45 s depois em todos do círculo, de
  cima (a casca do tatu-bola não segura); recarga 10 s. Desenho e ícones provisórios
- [x] **[arte]** Os ícones das 5 habilidades e o "Como jogar" (15/11): `paintedSkillIcon(id)` em `paintedIcons.ts` (a
  Chuva de Flechas caindo no alvo, a Flecha Ancestral com a espiral do espírito, o olho dourado do gavião, a pegada da
  onça espiritual e as três garras sobre as pintas), usados pelo `skillIconUrl` (janela e barra); o "Como jogar" com o
  `Q` (mirar a Chuva), o `K` e o ✦ (Habilidades) e o `M` (mapa); no `ui.ts`, o jeito oficial de pôr o ícone no botão
  (`ActionDef.icon`, ou `setLook(slot, { iconUrl })`) no lugar do remendo do `skill0`
- [x] **[arte]** O desenho da Chuva (flechas e pedras; muda com 3 e com 5 pontos), a janela das Habilidades e o círculo
  da mira no estilo da HUD (15/11): `src/client/novo/rainArt.ts` (o `combat.ts` guarda a conta e chama daqui) — 1 e 2
  pontos = madeira (flecha de madeira com ponta de pedra e penas de ponta vermelha, poeira), 3 e 4 = ouro (dourada,
  brilho e rastro, faíscas), 5 = espírito (verde de luz, rastro comprido, clarão e luzinhas); as pedras do estilingue
  são sempre pedra (o brilho em volta muda com a fase, para não parecer moeda) com o risco de velocidade; no chão, o
  anel que fecha até o meio mostra quando caem; a mira é o círculo dourado da HUD com os dentes girando, a estrelinha
  no meio e o arco pontilhado do tiro. A janela das Habilidades com a moldura da mochila, o "+" redondo dourado e a
  insígnia dos pontos (só o CSS do `skillsPanel.ts`)
- [x] **[arte]** Mais quadrados na barra para as habilidades da classe (15/11): os `ActionSlot` `class1` (R) e `class2`
  (T) no `ui.ts`; no PC, a moldura de 7 quadrados (Q, R, T, E, esquiva, defesa, pulo), feita da pintada de 6 com um
  quadrado a mais e o enfeite de novo no meio; no celular, uma fileira (R e T) em cima do 2×2. A [estrutura] ligou no
  motor (15/11: `CLASS_SLOTS`, o `skillButtons.ts` provisório saiu). O 4º e o 5º esperam o Chamado e a Fúria (pausados)
- [x] **[estrutura]** Passo 2 (15/11, com o "pode" do dono): a **Flecha Ancestral** (nível 6, tecla `R`): segurar mira com
  uma faixa; a flecha do espírito atravessa todos os bichos da linha (casca e enxame não seguram; parede e tronco, sim),
  com 3 pontos marca (mais dano de todo mundo por uns segundos) e com 5 explode no fim. Protocolo 38. Botão provisório
  (PC: o 6º quadrado; celular: em cima do da Chuva), desenho provisório
- [x] **[arte]** O desenho da Flecha Ancestral (15/11, `src/client/novo/spiritArt.ts`, com o "pode" da [estrutura] para
  as trocas no `combat.ts`): a flecha de luz verde com a espiral do espírito enrolando no rastro, as luzinhas e a luz no
  chão (pelo `drawProjectile`); a mira é a faixa dourada com as setas andando para a frente e o fio verde no meio; no
  fim, o espírito se desfaz em luzinhas subindo e, com 5 pontos, explode (a coluna de luz, a onda no chão até o raio e
  os raios); a marca é a runa do espírito (o losango com a espiral, como o enfeite da barra) em cima do bicho e o anel
  tracejado no pé, piscando no último segundo. O quadrado dela na barra é o `class1` (veja acima)
- [x] **[estrutura]** Passo 3 (15/11, com o "pode" do dono): os **Olhos de Gavião** (nível 10, tecla `T`): por 8 a 16 s
  enxerga mais longe (+50% a +100%: os bichos de longe chegam e aparecem no mini mapa e no mapa do M), cada bicho ganha
  a etiqueta do nível na cor do perigo (verde, amarelo, vermelho) por cima das árvores e do escuro, e com 3 pontos eles
  levam +10% a +20% de dano seu. Recarga 30 s. Protocolo 39. Etiquetas provisórias (HTML); "revelar o que está
  escondido" fica para quando houver um bicho escondido
- [x] **[arte]** Os Olhos de Gavião, o desenho (15/11, na PD.View): `highlight(lista)` desenha, por cima das copas e do
  escuro, o contorno de cada bicho na cor do perigo (a silhueta do próprio desenho, engordada), o corpo meio
  transparente na mesma cor e o selo "Nv" em cima; `setVision(porcento)` afasta a câmera com suavidade (até 1/(1 +
  0,35 × visão), passando do limite do zoom do jogador; o `setZoom` continua devolvendo só o zoom do jogador); a ação
  `'hawk'` acende os olhos de quem usou (dourados, com o risco de luz) e os seus ficam brilhando de leve enquanto valem.
  O quadrado é o `class2` e o `T` no "Como jogar" já foi. A [estrutura] ligou no motor (15/11) e apagou o `hawkTags.ts`
- [x] **[estrutura]** Ajustes do dono depois de jogar (15/11), parte 1: quem atira **vira para o tiro**; atirar
  **correndo espalha** (até 9°; andando devagar, até 3°; parado, certinho); **puxando, anda devagar**; a pedra e a
  flecha **caem onde foi mirado** (mais puxada = mais longe); o `R` **carrega a Flecha Ancestral no arco** (o próximo
  tiro é ela, com a puxada; atravessa e cai onde mirou; a explosão continua só com 5 pontos, decisão do dono); os Olhos duram menos (5 a
  10 s) e recarregam em 20 s; **dica** com o mouse em cima das habilidades da barra. Protocolo 41
- [x] **[estrutura]** O arco, a lista do dono de 19/11 ("a flecha não sai do arco, sai de baixo"; "o corpo fica
  invisível a ela"): o tiro de jogador aparece no arco (0,55 m à frente do pé, na altura do ombro, 1,35 m) e desce nos
  primeiros 3 m até a altura de sempre do voo (0,9 m, onde acerta e crava); vale para a Flecha Ancestral e o
  estilingue. Atrás de quem atirou (mais longe da câmera), a silhueta dele cobre a flecha. E o motor avisa a view quando
  a flecha especial entra no arco (`armed(id, 'ancestral')`, o tipo do tiro que vai voar)
- [x] **[arte]** Da mesma lista: o brilho da Flecha Ancestral **na flecha da mão** enquanto ela está armada (o motor
  chama `view.armed(id, tipo)`), continuando no voo; um **efeito no chão** onde ela para/explode; e **a explosão mais
  demorada** (hoje `SPIRIT_END_MS` = 720 ms, em `spiritArt.ts`). FEITO em 20/11: o arco armado brilha verde e a flecha da
  puxada é a de luz; a explosão dura 1,3 s (segundo pulso e fios do espírito subindo) e deixa a marca do espírito no chão
  (o anel de runas com a espiral), que apaga até 3,4 s (`SPIRIT_END_MS`; sem explosão, um selo pequeno)
- [x] **[arte]** O arco encaixa na mão (pedido do dono, 20/11: "o arco encaixa certo na mão do personagem e foca também pra
  resolver a pegada correndo"): o cabo passa pelo vão do punho com os dedos por cima; a mão gira (e o punho dobra de lado)
  para o arco ficar reto no punho, solto e mirando; com o arco, o braço esquerdo dobra mais e balança menos (o arco de pé
  ao lado do corpo; correndo, quase em pé); na defesa, ele bloqueia com o arco em pé. FEITO em 20/11 (veja `docs/ARTE.md`)
- [ ] **[estrutura]** Achado da [arte] (20/11): no tiro do próprio jogador, a Flecha Ancestral que para perto (3–4 m) não
  mostra a explosão — o desenho chega ao fim do alcance antes do `shot_end` do servidor e o `combat.ts` termina sem o
  `burst` (pode vir do número da habilidade na hora do tiro, ou esperar o aviso um pouco mais)
- [x] **[estrutura]** Da mesma lista (respostas do dono em 22/11: "alcance e dano, níveis de carga só na chuva e
  ancestral"): o `Q` põe a Chuva de Flechas no arco como o `R` põe a Flecha Ancestral, e ela sai no próximo tiro (botão
  direito, J ou o botão do tiro no celular), onde ele mirou; as flechas sobem quando ele solta. As duas têm **níveis de
  carga**: fraco, médio e forte (na metade e na carga cheia da arma), com um sininho a cada degrau; o nível dá o alcance
  (do alcance sem carga da arma ao da habilidade) e o dano (forte = o dano de sempre; médio, 3/4; fraco, metade — a carga
  cheia não dobra, como no tiro comum, para não ficarem fortes demais). Protocolo 46: o `shot` da Flecha Ancestral leva
  `rk` (pontos) e `lv` (nível), o `cast` da Chuva leva `lv`; o motor passa os dois ao desenho (`armed(id, tipo, pontos,
  nível)`, `drawProjectile(..., look)`, `paintChargeRing(..., nível)`, `rain.level`, `end.rank`/`end.level`)
- [x] **[estrutura]** A queda no fim do alcance (pedido do dono, 22/11: "a animação da flecha caindo não existe, ela
  simplesmente despenca"): a flecha voava reta a 0,9 m e aparecia cravada no chão de uma vez. Agora, nos últimos metros
  do voo (até 2,5 m, no máximo 30% dele), desce em curva até o chão, de ponta para baixo, e chega como a [arte] desenha a
  flecha cravada (`shotZ` com o alcance, em `combat.ts`). Vale para a pedra e os tiros dos bichos também
- [x] **[arte]** Defeito achado pelo dono (22/11): depois da Flecha Ancestral, o brilho fica no arco e o tiro comum
  seguinte puxa a flecha brilhante. Só acontece depois de usar a câmera lenta do F1: o `armed()` da `view.js` marca o
  fim do brilho com `performance.now()`, e o `frame` confere com o relógio do jogo, que fica para trás. Conserto: usar o
  relógio dos quadros (`this.last`) no `armed()`. Reproduzido e medido pela [estrutura]; pedido mandado à [arte].
  **FEITO (22/11, [arte]):** o fim do brilho (`armedOff`) e o brilho dos olhos dos Olhos de Gavião (`hawkAt`, o mesmo
  defeito) agora usam o relógio dos quadros; o clarão do degrau (`arrowLevelAt`) ficou no relógio da página, porque o
  `slingshot.js` lê com ele. Conferido no jogo depois de 4 s em 0,25x (3,3 s de atraso): antes, 2 s depois do tiro ainda
  'ancestral' e o tiro comum puxava a flecha brilhante; agora apaga em ~250 ms e o tiro comum vem com a flecha normal
- [x] **[arte]** Personagens mais leves (23/11, pedido do dono: "deixa os personagens mais leves"; escopo aprovado: 1 e
  2, o 3 "ainda não"): 1) mais rápido com a imagem idêntica — o casco das formas sem ordenar os pontos de dentro, os
  caminhos só de pintar sem `closePath` e quem está fora da tela sem pintar (−19% por personagem; ponto a ponto igual);
  2) a imagem guardada de quem está parado (`PD.DrawCache`: o personagem e o molde de gente dos NPCs). No jogo, parado,
  os personagens caíram de 8–9,5 para ~2 ms por quadro (Budega, Curupira, Dona Iracema). Veja `docs/ARTE.md`
- [x] **[estrutura]** Efeito subindo do chão ao subir de nível e ao pôr ponto numa habilidade (pedido do dono, 23/11:
  "cada nível que o personagem upar quero um efeito no personagem vindo do chão, mesma coisa quando upar uma
  habilidade"): o `levelup` só vai quando o nível sobe (o painel baixando não manda mais); `fx` `'skillup'` com `s` =
  a habilidade, para quem pôs o ponto e quem está perto (protocolo 47). O motor chama `view.levelUp(id, 'level' |
  'skill', tipo)`; sem ele, um efeito provisório no `combat.ts` (anel no chão e faíscas subindo; dourado no nível,
  na cor da habilidade no ponto). Som novo `skillup`
- [x] **[arte]** O desenho de verdade do efeito de subir de nível e de pôr ponto numa habilidade (`levelUp` na view:
  quando existir, o provisório some sozinho). Pedido mandado à [arte]. **FEITO (23/11, prévia aprovada pelo dono:
  "gostei, só afasta mais o círculo, está pegando nos braços")**: `js/levelup.js` — um círculo de luz abre nos pés,
  anéis de luz sobem pelo corpo por fora dos braços e fecham em volta da cabeça, com faíscas em espiral; no nível
  (dourado, 1,7 s) uma estrela estoura acima do nome; no ponto (1,15 s), a cor da habilidade (Ancestral verde, Chuva
  azul, Olhos laranja). De noite acende uma luz em volta. Conferido no jogo de dia e de noite, no PC e no celular, e
  visto por outro jogador. O provisório do `combat.ts` (`rise`) deixou de ser usado: a [estrutura] pode apagá-lo
- [x] **[estrutura]** O "+" e o nível de cada habilidade na barra de ações (pedido do dono, 23/11: "o upar da habilidade
  aparecer aqui embaixo como se fosse um + e o level de cada habilidade upável mostrando nesse menu"): cada habilidade
  da classe mostra os pontos em bolinhas (acesas = tem) e um "+" quando dá para pôr ponto (o toque põe o ponto, sem usar
  a habilidade); a que o nível já liberou e ainda não tem ponto aparece apagada, com o "+". `src/client/novo/skillBar.ts`:
  atributos `data-rank`, `data-max`, `data-learn` e os elementos `.skill-rank` e `.skill-plus` nos quadrados da barra,
  com um estilo provisório (`#skill-bar-provisorio`)
- [x] **[arte]** Vestir o "+" e as bolinhas do nível na barra no style.css (e apagar o estilo provisório do
  `skillBar.ts`). Pedido mandado à [arte]. **FEITO (23/11, escopo aprovado pelo dono: "pode")**: os pontos em pedrinhas
  douradas na beirada de baixo do quadrado (acesas = tem), o "+" num botão redondo verde de borda dourada dentro do canto
  de cima (não passa da moldura; pulsa de leve; só quando dá para pôr ponto) e a habilidade sem ponto com o ícone
  apagado. PC e celular conferidos; o toque no "+" põe o ponto sem usar a habilidade
- [x] **[estrutura]** Atributos (pedido do dono, 23/11: "vamos fazer sistema de pontos de força, destreza, inteligencia,
  vida etc.."; aprovado: "pode fazer assim, 3 pontos por nível, espírito"): **Força** (dano do tiro de sempre, arco e
  estilingue), **Destreza** (puxada e intervalo do tiro menores), **Espírito** (dano e recarga das habilidades da
  classe) e **Vitalidade** (vida). 3 pontos por nível, a partir do 2 (quem já tem nível ganha os dele: no nível 10, 27);
  recomeçar é de graça, por enquanto; nada de sorteio. Quanto vale cada ponto: painel do administrador (Combate ›
  Atributos; padrão 2%, 1,5% e 1%, 2% e 1%, 5 de vida; a Destreza e o Espírito tiram no máximo 40% de cada tempo).
  Janela K com duas abas, Habilidades e Atributos ("+" em cada um; o número no botão soma os pontos das duas). Regras em
  `src/shared/attributes.ts`; protocolo 48; passo 7 do arquivo de personagens
- [x] **[arte]** Vestir a aba dos Atributos da janela K (as abas, as linhas e um ícone para cada atributo no lugar da
  letra; o topo preso precisa de fundo opaco) e, se quiser, mostrar os atributos na mochila. Pedido mandado à [arte].
  **FEITO (23/11, escopo e prévia aprovados pelo dono: "pode fazer")**: um ícone pintado para cada atributo no lugar da
  letra (Força: o punho em brasa; Destreza: a pena com o vento; Espírito: a espiral lilás; Vitalidade: o coração com o
  cipó), as abas com cara de HUD, e no celular deitado os 4 atributos de uma vez, em 2 colunas (antes cabia 1 e meio).
  Na mochila, os 4 atributos e os pontos que sobram. O visual da janela K saiu do `skillsPanel.ts` para o `style.css`
  (combinado com a [estrutura]; o DOM e a lógica não mudaram). O topo preso já estava opaco
- [x] **[estrutura]** Poções, etapa 1 (pedido do dono, 23/11: "pode fazer as três garrafadas / retira o Fôlego tecla e
  como poder / a vida do personagem volta aos poucos depois de alguns segundos sem combate (lentamente)"): três
  garrafadas que curam uma parte da vida máxima — **Pequena** 25% (15 de ouro, nas lojas da vila), **Média** 40% (a
  Garrafada de antes, na Xiovanna) e **Grande** 60% (cai da Mula sem Cabeça e da Iara, 40%) —, com 10 s até o próximo
  consumível (a comida segue com 3 s); campo `curaPorcento` em `data/items.json` (e no painel). **O Fôlego saiu do jogo
  novo** (o botão, a tecla E; o servidor recusa no mapa novo; o jogo antigo continua com ele). **A vida volta sozinha só
  fora de luta:** 8 s sem apanhar e sem atacar, 1,5% da vida máxima por segundo (painel: Combate › Jogador). O `heal`
  leva o item usado (`it`) e a view ganhou o gancho `consume(id, item)` para o efeito do gole; som novo `gole`.
  Protocolo 49
- [x] **[estrutura]** Poções, etapa 2 (aprovada pelo dono: "gostei pode seguir"): efeitos com tempo — **Banana** +5 de
  Destreza por 3 min e **Água de Coco** +5 de Espírito por 3 min (não curam mais; valem com a vida cheia), e as
  **garrafadas**, além de curar, fazem a vida voltar 3× mais rápido fora de luta por 3 min. Um efeito de cada tipo por
  vez (o mais novo toma o lugar; comer de novo recomeça o tempo); continuam ao mudar de mapa; sair do jogo acaba com
  eles. Campo `efeito` em `data/items.json` (`{ "destreza": 5, "minutos": 3 }`, `{ "vidaVolta": 3, "minutos": 3 }`; no
  painel também). Mensagens `consume` (quem vê desenha o gole ou a mordida) e `effects` (a lista, com o tempo que
  falta); `stats.attrBonus`. Na tela, provisório: os efeitos com o tempo, abaixo da vida (`effectsBar.ts`), e "3 +5" na
  aba dos Atributos; som `comer`. Protocolo 50
- [x] **[estrutura]** Poções, etapa 3 (aprovada): **a Dona Iracema prepara as garrafadas** (aba "Receitas" na loja dela,
  no Refúgio e na Guarapiranga): Pequena = Arruda + Frasco Vazio + Água da Mina; Média = + Folha de Babosa; Grande = 2
  Babosas + Raiz de Jurubeba + Frasco + Água. As lojas vendem só os ingredientes (Frasco 4, Água 2, Arruda); as
  garrafadas também caem dos bichos (Pequena 4–6% nos de nível 1 a 3, Média 5% nos de 4 a 6, Grande 40% nos chefes), e
  as plantas novas também (Babosa 15–20% nos de nível 3 a 6, Jurubeba 10% nos de 5 e 6 e 60% nos chefes; no Filhote de
  Boitatá, 25% desde 23/11, pedido do dono: no jogo novo, ainda sem os chefes, é o único que deixa). Receitas em
  `data/receitas.json` (a chave é o item que sai; "precisa" diz os ingredientes) e quem prepara no campo "receitas" de
  `data/npcs.json`. Mensagens `craft` e `crafted`; `NpcInfo.recipes`. Protocolo 51
- [x] **[estrutura]** Sons gravados de licença livre (pedido do dono, 23/11: mandou sons de arco, de passos correndo e de
  floresta de dia e de tarde/noite tirados do YouTube e do Minecraft, que não dá para pôr no jogo; achei os CC0 mais
  parecidos no OpenGameArt, comparando as frequências e o ritmo, e ele escolheu pelas prévias): **a floresta gravada**
  por baixo do ambiente (de dia, pássaros com insetos e vento; de tarde e de noite, o pântano), passando de uma para a
  outra com a luz do dia, com os nossos bem-te-vis, sabiás e a coruja por cima; **os passos** do seu boneco (um a cada
  passada, no ritmo da corrida; terra, pedra ou areia conforme o chão da camada `chao` do mapa); **o arco** (o soltar
  gravado, a flecha cravada vibrando na árvore e a pancada ao acertar o bicho, feita por código). Arquivos em
  `public/assets/audio/ambiente` e `efeitos` (~670 KB), créditos em `CREDITOS-SONS.md`; `src/client/novo/ground.ts`.
  O dono achou os passos "meio bugados" na prévia: entram para ele testar no jogo e ajustar
- [x] **[estrutura]** O som de usar cada consumível nos tempos da animação da [arte] (pedido do dono, 23/11, pela [arte]:
  "o som de cura" na poção e "comendo algo, tomando algo" na banana e na água de coco): campo "som" em
  `data/items.json` ("garrafada": o "fiu" aos 0,30 s e a cura no estouro, aos 0,52 s; "mordida": duas mordidas, aos
  0,38 s e 0,66 s; "canudinho": sorvendo de 0,32 s a 0,95 s; "cura": na hora). Quem está perto também ouve, mais baixo.
  Protocolo 52
- [x] **[estrutura]** Os efeitos com tempo continuam depois de sair do jogo (pedido do dono, 23/11: "faz os efeitos
  continuarem depois de sair do jogo"): ao salvar, vai quanto falta de cada efeito; na volta, eles valem pelo tempo que
  faltava (o relógio fica parado enquanto o jogador está fora). `MIGRATIONS` passo 8 (coluna `effects`); os salvos são
  conferidos (só o que existe, nos limites de data/items.json, até 1 hora)
- [x] **[arte]** Das poções: os ícones novos — Garrafada Pequena (o vidrinho de chá verde), Garrafada Grande (o garrafão
  empalhado com lacre de cera), Frasco Vazio, Água da Mina (a moringa de barro), Folha de Babosa e Raiz de Jurubeba —
  aprovados pelo dono (23/11) e na main (`paintedIcons.ts`, com as mesmas chaves dos itens). O "icone" de cada um em
  `data/items.json` foi trocado pela [estrutura] (main 97e9971)
- [x] **[arte]** Das poções (etapa 1): o efeito de usar a poção "na mesma pegada do Priston Tale" (pedido do dono, 23/11)
  pelo gancho `view.consume(id, item)`. O dono não achou referência (lembra da poção jogada para cima, estourando), viu
  as duas ideias da [arte] prontas e escolheu "a sua sugestão": **nas garrafadas, a garrafa sobe girando, estoura em
  cima da cabeça e as folhas e gotas descem em espiral** (na cor de cada uma: Pequena verde, Média âmbar, Grande
  vermelha); **no Ramo de Arruda, o benzimento** (o círculo de luz nos pés e o redemoinho de folhas subindo); **na
  comida, um brilho pequeno** na cor dela. `js/consume.js`; conferido no jogo, também no meio da luta
- [x] **[arte]** As animações de usar (pedido do dono, 23/11: "faça animação dele jogando a poção para cima [...] e faz
  animação dele comendo a banana e tomando agua de coco"): **a garrafada** — a mão desce até o quadril, sobe por cima
  da cabeça e solta a garrafa aos 0,30 s (a cabeça acompanha, olhando para cima), e ela estoura aos 0,52 s; **a
  banana** — vai à boca e leva duas mordidas (0,38 s e 0,66 s; a banana encurta e a casca balança); **a água de coco**
  — o coco com canudinho na boca, sorvendo até 0,95 s. A boca abre na mordida e no gole; não entra no meio do tiro, da
  esquiva nem desmaiado. Os sons, nos mesmos tempos, são da [estrutura] (o item do som, acima). `consume.js`
  (`applyPose`) e o gancho no `animator.js`
- [ ] **[arte]** Inimigos redesenhados no 2.5D, um por etapa (escopo aprovado pelo dono em 23/11, "desenha direto"):
  pintados como o Birim (sem as bolinhas), com o aviso do golpe exagerado, o tranco ao apanhar e o desmaio com o encanto
  saindo em faíscas roxas; tamanho, vida, dano e regras não mudam
  - [x] **Sagui** (23/11): corpo com a beirada de pelo, a cabeça maior com o rosto escuro, a mancha branca da testa e os
    olhos acesos, os tufos brancos em leque, o rabo peludo de anéis; no aviso, ele se estica e ergue a fruta brilhando do
    lado da cabeça (de frente, aparece); o tranco vai para longe do herói. As ferramentas de pintar ficaram em
    `PD.creatures.paint` (`creature.js`) para os próximos
  - [x] **Quati** (23/11, na main):
    - o corpo de pelo, o lombo escuro e a barriga creme, as patas escuras e o rabo em pé com anéis;
    - o focinho comprido que mexe sempre e a máscara branca e escura no rosto;
    - no aviso, encolhe, arqueia, arrepia e rosna de boca aberta;
    - na mordida, dá o bote com os pés plantados;
    - o tranco e o desmaio com as faíscas roxas.
  - [x] **Tatu-bola** (24/11, na main):
    - a carapaça de ocre com as três cintas e as plaquinhas, a cabeça pontuda com o escudo e as orelhinhas, as patas
      com unhas e o rabo de casca;
    - no aviso, fecha na bola de gomos e gira no lugar levantando poeira;
    - na investida, rola de verdade até o fim (antes pulava de uma vez) e só abre tonto depois de parar;
    - a casca segurando, o tranco e o desmaio de barriga para cima com as faíscas.
  - [x] **Jararaca** (24/11, na main):
    - pintada em trechos (as voltas da rodilha passam uma na frente da outra), com as manchas em "V", a barriga creme
      e a cabeça em ponta de lança (olho de fenda, risca, lábio claro, boca que abre com as presas);
    - no aviso, a rodilha com o pescoço em gancho armando e a ponta do rabo tremendo;
    - no bote, a cabeça dispara ~1,4 m de boca aberta (antes ia ~60 cm) e volta para a rodilha;
    - o tranco e o desmaio de barriga para cima com as faíscas.
  - [x] **Marimbondos** (24/11, na main):
    - cada vespa pintada: cintura fina, abdômen de listras com o ferrão, cara amarela, olhos, antenas, asas e perninhas;
    - no aviso, o enxame se fecha e zune com os ferrões curvados para fora; na ferroada, mergulha num anel largo;
    - o tranco para longe de quem bateu e as vespas caindo com as faíscas.
  - [ ] Filhote de Boitatá
- [x] **[arte]** O selinho do "!" (23/11, pedido do dono): o "!" dos bichos que percebem o herói vira um selo amarelo em
  cima do nome, sem o balão (com vários juntos, os balões se empilhavam com o bico comprido)
- [x] **O aviso dos golpes no chão** (23/11, pedido do dono: "arruma esses golpes do quati aparece em quadrado vermelho,
  muito feio"): as casas do golpe pintadas no chão, por baixo dos bichos, com cantos redondos e o miolo que enche até o
  golpe
  - [x] **[arte]** o desenho e o `view.warn(casas, ms, { fire })` (`view.js`)
  - [x] **[estrutura]** chamar o `view.warn` nos casos `warn` e `fire` e não pintar os quadrados vermelhos no
    `combat.ts` quando a view tiver `warn` (na main em 984aab2; sem o `warn` na view, os quadrados de sempre)
- [x] **Sagui no galho** (opção 3 do dono, 23/11: "pode fazer o sagui na árvore conforme a opção 3"): calmo, ele fica
  pendurado pelo rabo num galho baixo e joga a fruta lá de cima; quando o herói chega perto ou acerta, pula para o chão
  e luta; depois de um tempo calmo, sobe de novo
  - [x] **[arte]** o desenho (23/11, na main):
    - pendurado de cabeça para baixo, balançando;
    - o aviso e o arremesso, o tranco no galho e o desmaio caindo;
    - a subida (o pulo e uma cambalhota de lado, 0,72 s) e a descida (desvira e cai de pé, 0,56 s);
    - o `view.perch(id, galho)` e o `galho` no `addActor` (veja `docs/ARTE.md`).
  - [x] **[estrutura]** (23/11, na main; conferido no navegador, PC e celular, com os 5 galhos do [mundo]: os saguis
    sobem, ficam pendurados no galho desenhado, jogam a fruta pelo lado aberto do galho — o tronco segura a fruta do
    outro lado — e descem a 2 m):
    - o mapa lê os pontos `galho-sagui` da camada `pontos` (`altura` em metros, de 1 a 4; `direcao` em graus) e diz de
      que tile se sobe (`GameMap.branchTile`: o de baixo ou o andável mais perto, porque o de baixo pode encostar no
      tronco);
    - no servidor: calmo, o sagui vai até um galho livre da área dele (um por galho), sobe e fica pendurado; lá de
      cima percebe quem chega até o alcance da fruta (5) e joga com o aviso de sempre; desce quando alguém chega a 3 m
      ou acerta nele (no meio da subida, logo que chegar lá em cima) e luta no chão; calmo por 8 s, sobe de novo.
      Subindo (0,72 s) e descendo (0,56 s) não faz nada. Os números no `data/monsters.json` (`"galho": { "desceA",
      "sobeDepoisMs" }`) e no painel. O que ele deixa cai no chão embaixo do galho;
    - o `perch` (`{ h, a }`) no estado do monstro e a mensagem `perch` (protocolo 53), chamando o `view.perch`;
    - a fruta sai da mão dele, lá em cima, e cai até a altura do voo (`shotZ` com `fromZ`); a barra de vida e os
      números ficam acima do galho;
    - a mira com o mouse no corpo pendurado (`actorAtScreen`): o tiro vai para o pé, embaixo do galho.
    Teste: `tests/sagui-galho.test.ts`.
  - [x] **[mundo]**: as árvores de sagui no Capão (o ponto embaixo do galho, a altura e a direção) e o galho baixo
    desenhado (23/11, na main): 5 pontos `galho-sagui` na camada `pontos` (`altura` 2,3 m e `direcao` em graus), em duas
    árvores da trilha dos saguis e em três árvores secas novas; o gerador escolhe a direção virada para a câmera em que o
    chão é andável, longe dos troncos, e nenhuma copa da frente esconde o sagui (o teste do Capão confere)
- [x] **As versões raras do Sagui** (24/11, na pegada das artes do dono: "Sagui Corrompido – Elite" e "Sagui Ancestral –
  Raro"; os outros bichos o dono decide depois)
  - [x] **[arte]** o desenho (24/11, na main, com o "pode juntar na main" do dono): o mesmo corpo e os mesmos golpes do
    Comum (o galho também), com outra paleta e enfeites — o **Corrompido** (pelo preto arrepiado, fendas vermelhas
    acesas, presas, cogumelos nas costas, brasas, fruta podre; 1,1×) e o **Ancestral** (espirais e faixas douradas, olho
    de espírito, musgo, colar de sementes, coroa de runas, vaga-lumes, fruta dourada; 1,18×). Chaves provisórias
    `sagui_corrompido` e `sagui_ancestral` (veja `docs/ARTE.md`); o Comum não mudou
  - [x] **[estrutura]** os dois no jogo (24/11, na main; forma B do dono, "pode fazer a B": cada um com um lugar
    próprio, um de cada, demorando para voltar). Em `data/monsters.json`, `sagui_corrompido` (Elite: nível 3, 66 de
    vida, fruta 3–6 a cada 1,4 s, 30 de XP, 5–10 de ouro, volta em 4 min) e `sagui_ancestral` (Raro: nível 4, 100 de
    vida, fruta 4–7 a cada 1,5 s, 60 de XP, 12–25 de ouro, volta em 12 min, jurubeba 30%); sobem no galho como o comum.
    O campo `"categoria"` (`elite` ou `raro`) vai no estado do monstro (`rank`, protocolo 54) e o nome aparece com
    "(Elite)" ou "(Raro)"; a fruta sai roxa com brilho vermelho (`fruta_podre`) e dourada com brilho claro
    (`fruta_dourada`). Conferido no navegador (PC e celular) com áreas de teste. Teste: `tests/sagui-raros.test.ts`.
    Pedido do [mundo]: o galho com dono (`bicho` no `galho-sagui`) é só daquele monstro, que prefere o seu; o teste dos
    galhos do Capão confere cada galho com dono perto da área do dono
  - [x] **[mundo]** onde moram (24/11, na main; o dono: "pode fazer do seu jeito, área própria pra cada um"): as
    áreas `sagui_ancestral` (em volta da Figueira do Viaduto) e `sagui_corrompido` (na Mata Profunda do noroeste, perto
    da Pedra do Véu) na camada `monstros`, com `quantidade` 1, e um `galho-sagui` com `bicho` para cada: o do Ancestral
    sai da própria figueira, o do Corrompido de uma árvore seca nova. O galho grosso da figueira passou a aparecer (o
    tmj.js mede da beira do tronco) e nenhum galho aponta mais para a câmera. Conferido no navegador (PC e celular):
    cada um pendurado no seu galho, nenhum comum nos galhos deles
  - [x] **[arte]** conferidos no jogo (24/11, na main: pendurados nos galhos, de dia e de noite, atacando, no celular) e a **luz
    própria** (pedido do dono: "pode fazer a luz própria dos saguis raros"): de noite e no escuro ou na neblina (a Mata
    Profunda), a view abre um halo em volta deles — vermelho pulsando no Corrompido, dourado no Ancestral —, como o
    filhote de boitatá e os cogumelos (antes a neblina e a noite apagavam as fendas e as runas). `creature.light()` e
    `view._creatureLights` / `_drawCreatureLights`
- [x] **[arte]** A dica com o mouse em cima (pedido do dono, 23/11: "melhorar o visual quando passa o mouse em cima da
  poção/banana utilizada"): no efeito valendo e nos frascos de comida e remédio, no lugar da dica do navegador, o
  painel da dica das habilidades — o nome na cor da raridade, o que faz em verde ("Cura 60% da vida", "+5 de Destreza
  por 3 min") e, embaixo, quanto falta (em azul) ou a tecla. O mostrador de efeitos só troca o tempo a cada segundo
  (refazer tudo apagava a dica com o mouse em cima)
- [x] **[arte]** Das poções, as correções rápidas (na main em 23/11, com o "pode" do dono): **a barra sem o
  Fôlego** (no PC, a moldura de 6 quadrados de novo: Q, R, T, esquiva, defesa e pulo; no celular, a defesa entrou no
  buraco ao lado da Chuva); **a mochila diz o que o consumível faz** ("Recupera 25% da vida", "+5 de Destreza por
  3 min"), com os botões do item presos no pé dela (em 1366 × 768 o "Usar" sumia); **o "+5" verde** na aba dos
  Atributos; **o mostrador de efeitos** com a cara da HUD (o selo do atributo no canto e o tempo numa plaquinha) e **a
  aba "Receitas"** com cada ingrediente numa plaquinha com o desenho do item. Os estilos provisórios saíram do
  `effectsBar.ts` e do `shop.ts`
- [x] **[arte]** Da mesma lista: **o visual muda a cada ponto** da Chuva e da Flecha Ancestral ("nível 1 é feio e fraco,
  nível 2 melhora, nível 3 muda e por aí vai"); **um brilho em cada degrau** da carga (fraco, médio, forte) na flecha do
  arco e no anel; a pose `'volley'` agora vem só na hora de soltar a Chuva (o `'sling-pull'` de sempre na puxada). Os
  dados chegam pelo motor (veja o item acima). Pedido mandado à [arte]. Escopo aprovado pelo dono em 22/11 ("pode, coloca
  sensação de impactos também por nível"), em 3 etapas: **1) os degraus da carga — FEITA em 22/11, na main** (o anel com as
  marcas dos degraus, a cor de cada um e o pulso quando sobe; a flecha no arco com o brilho por degrau e o clarão; o tiro
  e o impacto menores no fraco e completos no forte, com a pancada no forte; a Chuva já mira para o alto na puxada);
  **2) a Chuva com cara própria em cada ponto — FEITA em 22/11** (crua, madeira, ouro, brasa e espírito; o impacto
  crescendo com os pontos; a flecha na mão igual) e, junto, **as flechas da Chuva saindo do arco** (print do dono: saíam
  de dentro do corpo, retas para cima; agora saem da ponta da flecha, a 50°, para o lado do alvo, e a mira começa ali);
  **3) a Ancestral com cara própria em cada ponto — FEITA em 22/11** (1 luz fraca e rastro curto, 2 mais luz, 3 a espiral,
  4 a espiral dupla com o anel de luz no chão, 5 e a explosão; a pancada crescendo com os pontos; veja `docs/ARTE.md`)
- [x] **[estrutura]** Pedido da [arte] (22/11, junto com o "sensação de impactos também por nível" do dono): o tremor de
  tela, a pausa no impacto e o som crescendo com os pontos e o degrau nas habilidades — a Chuva caindo e a Flecha
  Ancestral parando/explodindo. FEITO em 22/11: a força vai de 0 (1 ponto, fraco) a 1 (5 pontos, forte;
  `skillImpactPower`, os pontos pesam um pouco mais); o tremor vai de 1/4 ao máximo e dura até o dobro, a pausa de nada
  ao máximo, e o som ganha um baque mais fundo (`sfx.impact`, e o chão da Chuva no `volley`). Ligado no padrão só nas
  habilidades (o tiro comum continua sem tremor): no F1, "Tremor das habilidades" (10 px) e "Pausa das habilidades"
  (60 ms). Tremor e pausa só nas suas; o som, nas de todos. O estouro da Flecha Ancestral toca quando o desenho chega lá
- [x] **[estrutura]** Parte 2 (15/11): NPC que passeia — `"passeio": [[x, y], ...]` em data/npcs.json (o pé, em metros):
  anda de ponto em ponto (1,2 m/s, 4 a 10 s parado em cada um) e espera parado 15 s depois que alguém fala ou negocia
  com ele. Protocolo 42 (`npc_walk`, `talk`). **Desligado de novo na Xiovanna a pedido do dono ("por enquanto deixa ela parada")**; funcionou ligado (15/11, com o passo de andar
  da [arte]): atrás do balcão, a 30 cm dele; parada, fica de frente (90°); vira o corpo para quem vem falar
- [ ] **[mundo]** Para a Xiovanna andar pela loja toda (e não só 2 m atrás do balcão): hoje ela fica num bolso fechado
  pela colisão do balcão (livre só de x 66,5 a 68, y 50 a 50,5); precisa de uma passagem no balcão (se o dono quiser)
- [x] **[arte]** Do mesmo teste do dono (15/11, na main): o fim da esquiva não trava mais (emenda na corrida; ela
  ficou em 0,62 s e não mistura com o pulo); a missão saiu de trás do mini mapa; a pose de mirar para cima na Chuva e as
  flechas mais tempo no chão (`RAIN_LINGER_MS`); as pernas da Xiovanna atrás do balcão, ela de frente e sem seguir quem
  passa; o destaque dos Olhos leve (15 → 20 ms por quadro com 17 bichos); o brilho do quadrado com a flecha carregada
  (`data-armed`); o anel da carga com efeito e sem passar por cima das pernas (`chargeArt.ts`)
- [x] **[arte]** O braço direito ao puxar o arco, de verdade (16/11, na main, depois de três consertos que não
  resolveram: "o braço direito está aparecendo nas costas do personagem; quando ele puxa de frente o braço direito some e
  vai pra trás"). Medi a pose antes de mexer: a mão da corda parava na frente do ombro ESQUERDO, e o cotovelo direito ia
  19 cm para trás das costas. A pose foi refeita na conta do arqueiro (`BOW_POSE` em `slingshot.js`): a mão da corda na
  mandíbula, logo à frente do ombro direito; o cotovelo para trás, na linha da flecha; o braço do arco quase esticado; o
  peito menos de lado (50°) e sem torcer mais que 70° (andando com o alvo à direita chegava a 140°). Andando, a mira
  alcança até 150° para a esquerda (o tiro por cima do ombro de quem foge) e 65° para a direita. Conferido fora do jogo
  (72 direções × 3 cargas: o cotovelo nunca atrás das costas nem na altura da cabeça) e no jogo (16 direções com a carga
  cheia, andando para os 4 lados, soltando e a Chuva). Medir de novo: `ferramentas/arco-medida.cjs` (do protótipo)
- [x] **[arte]** A esquiva pela referência de movimento (16/11, na main com o "pode" do dono; ele aprovou usar a
  biblioteca de animações do Quaternius, CC0, só como referência): comparei quadro a quadro o nosso rolamento com o
  dela e ele escolheu a opção **B, o mergulho curto**, nos mesmos 0,62 s e 3 m: o herói se lança com os braços à frente
  (os pés saem do chão), as mãos tocam o chão, rola pelas costas e sai agachado com a mão direita no chão, levantando
  (ou emendando na corrida). Antes ele dobrava no lugar e girava como uma bola. Conferido no jogo (correndo para os
  quatro lados e parado) e nos testes do protótipo. Detalhes, medidas e receitas em docs/ARTE.md. A puxada do arco não
  tem referência na biblioteca (não há animação de arco nos pacotes gratuitos)
- [x] **[arte]** Do mesmo teste: o zoom da conversa dá um tranco (medido pela [estrutura]: quadro de 24 para 33 ms
  durante o zoom, o mais lento 117 ms) (17/11, escolha do dono; **na main em 17/11, com o "pode sim" dele; falta ele
  conferir no PC dele**). As causas, medidas no jogo de verdade: a ordem de desenho dos 2 mil objetos era refeita a cada passo do
  zoom (~21 ms por quadro) e a caixa na tela de cada um também (13 a 20 ms); na chegada tudo era refeito de uma vez,
  até copas inteiras que estavam fora da tela; e na volta tudo era refeito de novo, com a borda da tela sem chão.
  Agora a ordem fica, a caixa estica, o jogo guarda as imagens e o chão de dois zooms (o da conversa é adiantado aos
  poucos quando o herói chega a 4 m de um NPC) e refaz uma coisa por quadro, do meio da tela para fora. Medido no
  Chromium sem placa de vídeo (parado, ~35 ms por quadro; média de 3 rodadas em 4 casos): a câmera se aproximando,
  de 57–72 para 46–52 ms por quadro; logo depois de chegar, de 55–65 para 43–52 (quadros acima de 80 ms: de 5–9 para
  0–1); voltando, de 68–73 para 54–58; depois da volta, de 51–67 para 34–38, sem refazer nenhuma imagem (eram 128 a
  146). A roda do mouse e os Olhos de Gavião também ficaram mais leves, e voltar para um zoom recém-usado é quase na
  hora; em troca, a primeira vez num zoom novo leva um pouco mais para ficar toda nítida (1,0 s contra 0,75 s na
  roda). Em celular e tablet o jogo guarda um zoom só (memória). Detalhes, limites e as ferramentas de medir
  (`prototipos/pindorama-25d/ferramentas/zoom-*.cjs`) em docs/ARTE.md
- [x] **[estrutura]** Painel de ajustes dentro do jogo, etapa 1 (17/11, pedido do dono): tecla **F1** (só administrador,
  no computador do servidor): sliders da arma, da puxada, da defesa, do bicho escolhido e do dia e noite, valendo na
  hora, com o ↺ de cada um; atalhos (modo deus, sem recarga, +1/+10/horda de 50, derrubar, dia/tarde/noite); FPS e
  bichos à vista; copiar valores e resetar tudo
- [x] **[estrutura]** Painel F1, etapa 2 (17/11): botão **Hitboxes** — por cima do desenho normal, o círculo em que o
  tiro acerta cada bicho (vermelho), a caixa do pé de todo mundo (branco; a sua, verde), a área em que o bicho que
  ataca sozinho percebe você (laranja tracejado, com a distância) e o que bloqueia perto (amarelo segura tiro, cinza
  só o passo). Continua na tela com o painel fechado
- [x] **[estrutura]** Painel F1, etapa 3 (17/11): **Jogador** — velocidade correndo e andando, vida máxima (%) e dano (%),
  valendo na hora para quem está jogando (protocolo 44; também no painel, Combate › Jogador). **Game feel** (só da
  tela, guardado no navegador): tremor ao acertar e ao tomar dano, duração do tremor, pausa no impacto, faíscas por
  acerto e o clarão ao tomar dano (liga/desliga). O padrão é o jogo de antes (tudo em zero, clarão ligado)
- [ ] **[arte]** (se o dono quiser) vestir as faíscas do acerto (hoje quadradinhos dourados, `CombatLayer.burst`) e o
  tremor/pausa com o desenho dela
- [x] **[estrutura]** Painel F1, etapa 4 (17/11): **câmera lenta** — botões 0,25x / 0,5x / 1x (em Atalhos): o servidor
  inteiro e a tela de todo mundo andam nesse ritmo (passos, tiros, recargas, golpes dos bichos). Protocolo 45. O som,
  o dia e noite e o contador de quadros continuam no relógio de verdade
- [ ] **[arte]** **Prioridade do dono (18/11): o personagem no nível da referência dele** (Dunloc Online), pelo
  processo do autor: imagem de referência do rosto → rodada focada (só o rosto, só o sul) com crítico lado a lado →
  as outras direções → corpo, arma e movimentos. O dono escolhe a referência e aprova cada rodada
- [ ] **[estrutura]** Região 2 (Santo Amaro ou Guarapiranga): **pausada pelo dono (18/11)** enquanto a [arte] faz o
  personagem (para não estourar o uso do Claude). A [estrutura] fica só em correções pequenas
- [ ] **[estrutura + arte]** Chamado Selvagem (nível 15: a onça ou a águia espiritual) e Fúria da Onça (nível 20:
  transformação, corpo a corpo). **Pausado pelo dono (15/11):** ninguém chega no nível 15–20 com o conteúdo de hoje
  (o bicho mais forte do jogo novo é nível 5; até o 15 são 12.799 XP, uns 700 bichos do Capão). Primeiro a região nova
  (níveis 5 a 10). Combinado para quando voltar: o espírito escolhido na janela (onça ou águia), ele pode apanhar e
  sumir, e a ordem águia → onça → Fúria
- [ ] **[dono]** Depois: a escolha da classe virar o ritual na figueira (decisão de 12/11); trocar de classe; recomeçar
  os pontos custar ouro?

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
- [x] **[estrutura]** O "levar" nos mapas novos (achado do [mundo], 19/11): x e y são o pé em metros, com fração
  (vírgula ou ponto); vale onde o corpo cabe, até num vão estreito ou atrás de um balcão; dentro de algo, vai para o
  chão livre mais perto. O cartão do jogador mostra a posição do mesmo jeito (dá para copiar de um e colar no outro)
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
- [x] **[dono]** O primeiro Caminho (14/11): o **Caçador da Floresta** (veja "Habilidades", acima; começou em 15/11)
- [ ] **[dono]** Os outros Caminhos. Proposta da [estrutura], com a cara do folclore: **Benzedeira/Benzedor** (cura e
  espíritos), **Guardião** (escudo e corpo a corpo) e **Capoeirista** (rápido, esquiva e golpes; no lugar do "Ladino
  das Sombras")
- [ ] **[estrutura]** Energia (barra azul) para as habilidades (hoje cada uma tem só a recarga)

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
