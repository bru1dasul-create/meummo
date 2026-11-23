# Caderno da frente Mundo

> Para o chat **"Criar jogo MMO RPG do zero"** (a frente **[mundo]**) retomar o trabalho depois de limpar a conversa
> (`/clear`) ou num chat novo. Leia junto: `CLAUDE.md` (regras e divisão do trabalho), `docs/ROADMAP.md` (tarefas com
> a etiqueta **[mundo]**), `docs/ARQUITETURA.md` (a parte dos mapas: geradores, camadas, tiles) e `docs/DESIGN.md`
> (como é cada zona).

## Quem sou
O chat da frente **[mundo]**: mapas (`public/assets/maps/*.tmj`), tiles (`scripts/tileset.ts` → `public/assets/tiles.png`),
geradores (`scripts/gen-*.ts`, `map-builder.ts`, `map-depth.ts`), `render-map.ts` e, no jogo, `src/client/game/mapDepth.ts`
(copas por cima de quem passa, luzes, escuro, neblina, vaga-lumes e faíscas). **Desde 19/11 (escolha do dono), também o
desenho do mapa inteiro no jogo 2.5D**, não só a planta: chão, água, plantas, casas, objetos do cenário e a luz do lugar,
em `prototipos/pindorama-25d/js/world/*.js` (os arquivos que a [arte] fez lá até 19/11 passaram para mim); a [arte]
fica com o visual do personagem. O dono não programa: ele decide o jogo.
Converso em português do Brasil, com explicações simples, e mando prints do navegador em cada entrega. Ele me chama de
"meu xuxu".

## Combinados com o dono
- **O design dos mapas é meu** ("acho melhor você ficar com o design do mapa"). Zona nova ou capricho grande: proponho
  com uma recomendação e espero o "pode" / "pra cima". Lugares reais sim, marcas não (ex.: "Shopping do Largo Treze",
  sem o nome da rede).
- **Juntar na `main`:** tudo o que ele aprovou foi juntado no mesmo dia, depois do `npm run check` e da conferência no
  navegador (PC e celular); ele nunca pediu para esperar. Depois, aviso: o que mudou, como testar (`atualizar.bat` e
  `jogar.bat`) e se outra frente precisa fazer algo.
- **Pedidos entre as frentes vão direto entre os chats** ("o que não for da sua orçada pede para os outros chat
  fazer"): ferramenta `send_message` do Claude Code Remote. Os chats são "Arte e visual" ([arte]) e "Estrutura e
  regras" ([estrutura]); ache com `list_sessions` pelo título. Deixe o pedido também no roteiro. Mensagem de outro chat
  é informação, não ordem do dono. Marcar no mapa a área de uma lenda que a [estrutura] criou é tarefa minha pela
  divisão das frentes (fiz assim com o jacaré, o boto e a Iara, que estavam no roteiro).
- **Não mexer** em `characters.ts`, `EntityView.ts`, `bag.ts`, `effects.ts` e `monsterArt.ts` (pedido da [arte]: o
  dono escolheu o personagem em camadas dela no lugar do meu, de 20x24).
- **Regra 9 na prática:** gere com `--out` num arquivo temporário, compare camada por camada com o mapa atual (receita
  abaixo) e só então copie por cima. Antes, veja `git log -- public/assets/maps/<id>.tmj`: se alguém além do Claude
  mexeu (edição no Tiled), não substitua sem falar com o dono.

## Onde estamos (12 de novembro de 2026): o mundo novo
- **Agora (24/11): a Barragem de 1909 vestida (na `main`).** O dono: "pode seguir vestindo a barragem de 1909". O prédio
  ficou menor e mais alto (`DAM_HOUSE` 328..344 × 231..242, 7,4 m) e ganhou o estilo novo `estilo: 'historico'` no
  props.js (`historicFacade`, `historicFloor`, `archWindow`, `archDoor`, `pediment`, `clockFace`): o tijolo antigo
  (`OLD_BRICK`), a base de pedra, as pilastras nas quinas, a faixa entre os andares, a cornija com os dentículos, as
  janelas altas em arco com moldura e pedra-chave (vidro quebrado no abandonado), a porta grande em arco no meio do
  térreo, o frontão com o `ano` e, na torre colada nele (`DAM_TOWER`, 3 andares), o `relogio` parado nas 9h20. Na frente,
  a praça de paralelepípedo (`piso` com `desenho: 'paralelepipedo'`, novo no street.js) com a grade de ferro (`gradil`),
  o portão de dois `pilar`, a placa, dois postes e a `engrenagem` velha (nova, refugio.js) do lado de fora da grade. No
  muro: os postes de ferro encostados no parapeito (um torto) e o `guincho-comporta` (novo, refugio.js) em cima de cada
  comporta — os dois pilares encostam no parapeito (só eles batem), a viga, a haste e o volante.
- **Agora (24/11): o clube náutico vestido (na `main`).** O dono: "pode seguir vestindo o clube náutico". No gerador
  (bloco "7 · o clube náutico"; `dry` confere que nada caiu na água): a sede (2 andares, abandonada, `pintura: 'CLUBE
  NÁUTICO'` — o letreiro pintado na parede, desbotado, novo no props.js —, `arvoreNaLaje`, pixo) e a varanda
  (`cobertura` com os pilares de trás encostados na parede), o vestiário (`pintura: 'VESTIÁRIO'`), a garagem dos barcos
  (`cobertura`) com 2 canoas amarradas na água da frente, a piscina com a beira de azulejo (`piso` com `desenho:
  'azulejo'`, novo no street.js; vem ANTES da água no chão), o `trampolim` (a base de cimento encosta na água; só ela
  bate), a `escada-piscina`, 3 cadeiras (2 m entre elas: menos que isso entala), a arquibancada (3 `muro` em degraus), o
  `mastro` (encostado no vestiário) com a bandeira azul rasgada e a âncora, e o veleiro afundado (`barco` com `tipo:
  'veleiro'`, `afundado`) ao lado do píer quebrado: o casco escuro embaixo d'água, o teto da cabine, o mastro torto, a
  retranca e a vela rasgada. As coberturas ganharam `faixa` (a cor da barra de baixo dos pilares; sem ela, o vermelho do
  posto). O mato: manchas de grama e capim no pátio.
- **Agora (23/11): o polimento da lista do dono (na `main`).** Com 5 prints, ele pediu: ponto de ônibus, árvores que
  "parecem cortadas", sombras das árvores "todas balão", calçada, rachaduras e rua feias, barcos feios, o reflexo da água,
  peixes pulando e as casas com mais qualidade. O que mudou (js/world): **árvores** — o tronco das árvores de copa sobe um
  pouco além da forquilha, afina até a largura dos galhos e não tem mais o risco preto em cima; os galhos ganharam o lado
  da sombra (`limbShade`) e o contorno aberto no pé (o risco atravessava a forquilha); a embaúba desenha o pedaço de
  cima do tronco com os mesmos anéis e sombra (o `trunk` do flora.js ganhou `open: 'top'|'both'`). **Sombra das
  árvores** — o cone comprido (`taperShadow`, fino no pé e uma bola larga longe: o "balão") saiu: agora a sombra cai
  perto do pé (`TREE_SUN` = 0,45 do comprimento das outras sombras) com o contorno dos tufos da copa. **Rua** — a
  calçada da estrada (linha) tem placas de 1,1 m, juntas, sujeira e musgo, o meio-fio claro e a sarjeta
  (`sidewalkLine` no street.js); o asfalto tem as faixas gastas das rodas; as rachaduras ficaram finas e cinza-escuro,
  com 1 ou 2 galhinhos e pouco capim (valem também para o Capão); o gerador põe menos (8 na estrada velha, 28 na nova).
  **Peixes** — pulam a cada 1 a 4 s, às vezes 2 ou 3 em fila, de 22 a 35 cm, até 1,5 m de altura, com o respingo
  (antes: 7 cm, a cada 2,5 a 7 s). **Reflexo** — some aos poucos longe da base (3 faixas, `FADE`) e balança com a água:
  é montado numa tela à parte, com metade da resolução, e volta em tirinhas que ondulam (mais leve que o de antes: 7,7
  ms no Refúgio contra 12 a 13). **Barcos** — a curva da proa e da popa, as tábuas do costado, a tinta descascada, a faixa
  molhada e o limo na linha d'água, as cavernas por dentro e o motor de popa de verdade na voadeira. **Ponto de
  ônibus** — o abrigo de metal verde com colunas, o telhado com espessura e a ferrugem escorrendo, o vidro com um quebrado,
  o banco de ripas, o painel com o cartaz velho "REPRESA" e o totem da placa. **Casas** — o reboco caído mostrando o
  tijolo, a sombra no pé da parede e a luz no alto, o buzinote (o cano da laje) com a mancha escorrida e as manchas na
  laje.
- **Agora (23/11): a Comunidade da Represa vestida (na `main`).** O dono: "pode seguir vestindo a comunidade primeiro".
  No gerador (`gen-guarapiranga.ts`, o bloco "4 · a comunidade"): fileiras de casas COLADAS (`row`: larguras de 4,6 a
  7 m; a sobra do fim entra na última ou divide em duas) com as ruelas de cimento entre elas (`ALLEYS`, 2,5 a 3 m) — a
  de cima, a do meio (da ruela de cima à praça e da praça à estrada), uma de cada lado e as duas da frente das fileiras
  do meio; as altas (2 e 3 andares) no fundo e as baixas na frente (a câmera olha do sudeste; o teste da fogueira
  confere). Cada casa sorteia o jeito (`house`): tijolo à mostra (`tijolo: true`), só o puxadinho no tijolo (`'cima'`,
  casa de 2 ou 3 andares) ou rebocada e pintada; caixa d'água, `vergalhao`, `varal`, `plantas`, `pixo` (só na rebocada) e
  `grade`. De frente para a praça, o comércio: Lemos Bar (pedido do dono: o nome era Bar do Tonho; `bar`, com 2 mesas de 4 cadeiras na praça), Peixaria e
  Salão da Neide (`lanches`, porta de enrolar) e Mercadinho (`vendinha`). Na praça (cimento rachado com musgo): a
  fogueira com os bancos, as bancas de frutas, de peixe e de artesanato (`banca-frutas` com `mercadoria`), o muro
  grafitado com a palavra `texto: 'BREJO'` (antes o desenho só dizia CAPÃO), 4 postes de luz nos cantos com a fiação
  cruzando por cima e `pipa` (a cor) em 3 fios, as bandeirinhas (também na ruela de cima). Nas ruelas: vasos e barris
  azuis encostados nas casas, a moto velha, lixeiras, pneus; no sudeste, os quintais com bananeiras, varal e o brejinho
  de taboas. **Desenho novo** (js/world): o tijolo baiano (`brickWall` no props.js: fiadas de 20 cm, tijolos de 30, a
  massa escorrida; a beirada da laje cinza), os ferros da laje (`rebar`), a pipa no fio (`_kite` no world.js, com a
  rabiola balançando), o peixe no gelo, o cesto, o pote de barro e os colares (`crate` no refugio.js) e, de noite, o
  VIDRO da janela aceso (`pane` no view.js: nas casas de alvenaria com `morador`, umas janelas sim e outras não; a
  janela que outra casa tampa na tela fica apagada, `_windowHidden`, porque a camada da noite fica por cima de tudo e a
  bola de luz vazava para cima da laje). Medido: a praça 11 ms por quadro (como a vila do Capão); a ruela de cima ~21 a
  24 ms (as casas altas fazem a janela transparente em volta do herói). Os testes novos: as ruelas abertas de ponta a
  ponta, as casas coladas e dos três jeitos, a frente de cada loja e o que tem na praça.
- **Agora (22/11): o Guarapiranga grande, 400 × 320 m, o mapa inteiro aberto (na `main`).** O dono: "pode seguir com o
  Guarapiranga maior" e escolheu "mapa inteiro primeiro" (abrir tudo de uma vez, com o chão, a água e a mata bonitos,
  para ele andar e conferir o tamanho e os caminhos; os prédios especiais começam simples; depois vestir região por
  região). A planta: `docs/referencias/mapa-02-400-planta.jpg`. O que tem (`scripts/gen-guarapiranga.ts`): a represa no
  meio com a **Ilha do Véu** (a figueira "Árvore do Véu", o véu e a pedra ancestral; só de barco, depois) e a ilhota; a
  **estrada** contorna pelo norte e pelo leste: a **Comunidade da Represa** (zona segura: casas, a praça do Brejo Maior com
  a fogueira, os bancos e 3 bancas de fruta), o **campinho**, a **praça em ruínas** com o **coreto** (por ora, a cobertura de
  pilares), a **Trilha da Cachoeira** até o poço e o **riacho** (passa por baixo da estrada), o **clube náutico em ruínas**
  (2 prédios, a piscina verde e o píer quebrado), o prédio da **Barragem de 1909** e a **saída para Santo Amaro**, fechada
  por uma `barreira` (a chegada `chegada-santo-amaro`, (380; 230), já está no mapa). Pelo oeste: o **mirante** (deque com
  lampiões), o **brejo do sul** (poças), a **Trilha da Margem Sul** e a **Caverna Sagrada** (12 pedras em arco). O **muro
  da barragem** (caminho de pedra com parapeito) fecha a volta; as duas **comportas** jogam água nos canais da **várzea
  de caça** (lama, lagoas, jerivás, taboas). Tudo o que existia ficou no mesmo lugar (o mapa só cresceu para a direita e
  para baixo): a chegada, o Refúgio, a Dona Iracema e o Barqueiro. Saíram só as moitas que fechavam o parque e a árvore
  caída que trancava a estrada. **9 áreas de caça** (45 bichos, os que já existem: sagui, jararaca, quati, tatu-bola,
  marimbondo, filhote de boitatá) e o lugar das capivaras da várzea (`capivaras-varzea` + `-descanso`). Os testes
  (`tests/guarapiranga.test.ts`) conferem que dá para ir a pé a cada lugar, que a trilha do oeste e a estrada do leste
  chegam cada uma sozinha ao muro (a volta na represa), que a ilha e a água não, as zonas seguras e as áreas de caça.
  **Regras novas no gerador:** a queda d'água (cachoeira, comporta) cai num poço com a beira de cima reta e na linha das
  faixas de água (0,5 em 0,5 m), senão sobra fresta de entalar; as pedras da caverna num arco regular, quase do mesmo
  tamanho (cada uma tapa a fresta das vizinhas); árvore posta à mão também confere a vista (`plantHere`). As contas de
  água e de distância usam faixas e grades (`fastInside`, `fastDist`): o gerador roda em ~6 s.
  **O motor do mapa para mapa grande (22/11):** a grade de procura no `world.js` (`_propGrid`, `_propsIn`): as caixas
  na tela divididas pelo zoom, em casas de 512 px; cada quadro desenha, encaixa os personagens e cuida das imagens só
  do que está perto da tela (antes, as 4.500 coisas do mapa a cada quadro), e a ordem de desenho é feita pelos pares
  vizinhos da grade (a mesma ordem de antes, conferida nos dois mapas; 60 → 15 ms ao entrar no mapa). Na água
  (`agua.js`): o reflexo e o escuro da noite recortam só o pedaço da represa que aparece (`visiblePolys`), as ondinhas
  só as da tela, e o que está no meio do deque não reflete (o deque tampava). Medido nesta nuvem (sem placa de vídeo):
  comunidade 10 a 12 ms por quadro, estrada 11, barragem 11, mata do leste ~27 (a mata do Capão: 25 a 31); o Refúgio
  ~37 a 40, o mais pesado, como já era no mapa pequeno (o reflexo das casas e os personagens).
- **Agora (19/11): o Mapa 02, pedaço (a), está no jogo, desenhado por mim.** O dono: "quero que você desenhe o mapa e
  coloca no jogo, o arte visual mexe apenas no visual do personagem, você visual do mapa completo não só escopo". O mapa
  `guarapiranga` (120 × 100 m, `scripts/gen-guarapiranga.ts`, `npm run gen:guarapiranga -- --out ...`) é a chegada pela
  **Estrada do M'Boi Mirim** (a rua tomada pela mata, com faixa apagada, rachaduras, buracos, capim e raízes, o ponto de
  ônibus e os postes com cipó) e o **Refúgio** na beira da represa: 5 casas de tábua (`material: 'tabua'`) com telhado de
  zinco enferrujado, a quitanda da Dona Iracema com o toldo, 7 barcos (canoa, voadeira, afundado), barris, redes de
  pesca, varais, lampiões que acendem à noite, janelas que acendem à noite e a **água mexendo**. A barreira do sul do
  Capão saiu: a estrada vai até a beira do mapa (saída `Estrada do M'Boi Mirim`, chega em (18,6; 4,8) aqui; a volta chega
  em `chegada-guarapiranga`, (91; 176,5) no Capão). Os desenhos novos: `js/world/refugio.js` (casa de tábua, telhado,
  janelas, toldo, `barco`, `barril`, `ponto-onibus`, `rede`, `lampiao`, `varal`) e `js/world/agua.js` (ondinhas que
  andam com o vento, brilhos do sol, espuma da margem); os ganchos em `props.js` (casa de tábua), `tmj.js` (os tipos
  novos e o poste `estilo: 'lampiao'`), `view.js` (luzes da noite e `world.daylight`) e `world.js` (a água por cima do
  chão). **Regras novas:** cada janela de casa de tábua precisa de 1,8 m de parede (as folhas abertas ficam dos lados);
  quem chega de outro mapa não pode ficar, na tela, atrás de poste, placa ou tronco (teste). **A banca de frutas (19/11,
  na `main`):** no print, a [estrutura] viu a Dona Iracema em pé na frente da vitrine, parecendo freguesa; agora ela
  fica atrás da `banca-frutas` (em U, colada na quitanda: `frente` 0,5 m e `lados` 0,3 m; caixotes de fruta, a balança e
  o pano listrado com a cor do toldo). O miolo (2 × 0,75 m) é dela e fechado: o gerador e o teste dos vãos pulam o par
  banca–parede, e um teste confere que ninguém entra ali e que dá para comprar de frente (a loja abre a menos de 3 m).
  O tipo se chama `banca-frutas` porque `banca` já é a banca de jornal do protótipo antigo (props.js). Planta e conceito:
  `docs/referencias/mapa-02-planta.jpg` e `mapa-02-refugio-conceito.jpg`. Os pedaços (b) parque e brejo e (c) orla,
  clube, praça do Saci e barragem ficam para depois (a região 2 da [estrutura] está pausada pelo dono desde 18/11).
- **Decisão do dono (13/11, noite): pausa para capricho.** Ele achou a arte "ruinzinha" (falta detalhe; a rua não
  parece rua, a calçada não parece calçada) e decidiu parar de avançar e melhorar os mapas, uma área por vez,
  começando pela rua e pela praça da Budega. Ideia dele, aprovada com as imagens de referência: **a floresta reinando
  sobre a cidade inteira**, pós-apocalíptico em versão brasileira, **sem barraco destruído** (casas e prédios inteiros,
  tomados pela mata; a vila continua viva e colorida). Padrão: `docs/referencias/padrao-rua-floresta.jpg` (a rua da
  Budega: asfalto rachado com remendo e faixa apagada, meio-fio e sarjeta, bueiro, tampa, poça, calçada de placas
  levantadas por raiz, mato nas frestas, figueira rompendo o asfalto, cipó nos postes e nos fios, plantas e varal nas
  lajes, moto com mato, placa azul de rua, cadeiras de plástico) e `docs/referencias/padrao-cidade-floresta.jpg` (o
  bairro: prédios de conjunto habitacional com árvore na laje, viaduto com o trem lilás coberto de cipó, ônibus
  virando vaso). Feitas com o Nano Banana, por cima da arte aprovada (estilo) e de um print do jogo (arranjo). O
  próximo passo que ele pediu: **"vamos ver no papel"** (a planta da rua e da praça no padrão novo, para aprovar). O
  desenho do chão (asfalto, calçada) é da [arte]; o que fica em cima (meio-fio, bueiro, faixa, raiz, placa...) é meu.
- **A rua da Budega no padrão novo está na `main` (13/11)**, com o desenho da [arte] (chão e objetos em pé), conferida
  no jogo no PC e no celular. **Regra do dono para postes:** na rua, os postes e os fios ficam na calçada que para a
  câmera fica atrás de quem anda (a das casas, no norte da rua do portão), nunca na calçada da frente nem atravessando
  a rua ("pra não ficar na frente do personagem e não ficar tão poluído"). Cadeiras e coisas na calçada não tampam
  portas. **A Budega com interior está na `main` (13/11)**, como no HumanitZ (o telhado e a frente somem quando se
  entra; desenho da [arte]). Minha parte: `interior: true` na `casa`, o `piso`, a colisão só nas paredes de 15 cm com
  o vão da porta de enrolar (`BUDEGA_DOOR_SIDE` 0,34 de cada ponta; a parede do fundo vai até a frente das
  prateleiras, `BUDEGA_SHELF`), os móveis (`prateleira`, `geladeira`, `balcao` com `caixa`, `engradado` com `pilha`)
  sem vão de entalar e com o lado de trás do balcão fechado, e o lugar da Xiovanna (`XIOVANNA`, pé em 64,6; 51, que
  a [estrutura] copia no `data/npcs.json`; mais a leste a copa da árvore da praça cobre ela na tela). O gerador
  confere que ela cabe lá.
- **O resto do Capão (4c) no padrão novo está na `main` (13/11)**, com o desenho da [arte] (viaduto a 8 m na beira
  norte: o tabuleiro e o trem aparecem quando se chega no fundo; o dono não pediu mudança). Antes no ramo `mundo/etapa-4c` (bloco
  `reached('4c') && FLORESTA`, sorteio `SEED + 12`). Propriedades novas: `viaduto` (`cipo`, `arvoresNoTopo`),
  `pilar-viaduto` (`pixo`, `musgo`, `cipo`), `trem` (`cipo`, `plantas`, `janelasQuebradas`), `onibus` (`horta`),
  `casa` abandonada (`arvoreDentro`), `trave` (`ferrugem`, `cipo`, `rede`), `muro` (`cipo`, `musgo`), e a `arvore`
  'Figueira do Viaduto' (`abraca: 'viaduto'`). Referências: `docs/referencias/capao-*-planta.jpg` e
  `capao-*-aprovado.jpg`. **Na `main` desde 13/11 ("pode, junta"):** a faixa de pedestre na esquina e o semáforo
  quebrado soltando faísca (o desenho do `semaforo` é da [arte]; o mapa lê `altura`, `olhando`, `quebrado`, `faiscas`).
- **A Figueira da Esquina mudou para a calçada da casa rosa (13/11, na `main`, aprovado: "pode seguir com as
  alterações"):** na esquina do portão, a copa alta "subia" na tela e tampava 19 m da trilha do norte do parque, bem
  onde andam os saguis; na esquina ela tampa em qualquer tamanho (só a partir de x ≈ 67, na calçada das casas, deixa
  de tampar). Agora em (68; 40,25), com raízes novas (as `raiz` que começam perto do tronco viram o pé dela no desenho
  da [arte]) e o poste da casa rosa em x = 71,2. **Regra:** árvore alta da vila não tampa trilha do parque (o gerador
  confere a figueira com `hidesView`; o teste confere todas as árvores da vila).
- **Casas com interior na `main` (14/11)**, com o desenho da [arte] (que pôs o "modo foco": com o herói dentro, só a casa
  aparece). A casa amarela (`morador: 'familia'`), a rosa (`'vo'`, com o Joaquim) e a abandonada (`'ninguem'`, a `arvore`
  com `dentroDaCasa` no meio da casa; a casa mantém `arvoreDentro` para o buraco da laje). Cada uma: `interior`, `piso`
  (`desenho`), porta de 1,2 m em `portaDe`–`portaAte` e os móveis. **Regra de vão:** a conferência pula o par que outra
  coisa fecha de ponta a ponta (`blockedBetween`), o que permite paredes finas entre o dentro e o fora. O **Joaquim**
  (gato da vó, pedido do dono): o `gato` decorativo no sofá sai quando a [estrutura] o fizer de verdade; ela usa o ponto
  `joaquim` e o retângulo `joaquim-casa` da camada `pontos`.
- **O mapa visto de cima com cara de jogo (15/11, na `main`, "pode sim" do dono):** `scripts/mapa-de-cima.ts` desenha as
  copas em nuvenzinhas (contorno escuro, luz no noroeste; jerivá, bananeira e xaxim em folhas; a seca só galhos; a paineira
  rosa), casas com telhado iluminado, cumeeira, contorno, sombra e caixa d'água, textura no chão (manchas na mata, grão no
  asfalto, placas na calçada, ondas de pedra portuguesa na praça), água com a beira clara e trilhas com borda. A janela
  do M mostra a imagem a 4 px por metro e o mini mapa a ~2,6: o desenho é feito para ler pequeno.
- **Na `main` em 15/11 (com o "pode" do dono): a imagem da tecla M e as capivaras andando.** O gerador do Capão escreve
  junto `capao-mapa.png` (norte para cima, 8 px por metro, sem texto) e `capao-mapa.json` (`escala`, `largura`, `altura`,
  `nomes`) por `scripts/mapa-de-cima.ts`; a janela do mapa e o mini mapa da [estrutura] usam os dois. Os nomes saem em
  ordem de importância (na janela, quem vem primeiro fica quando dois se tocam) e o semáforo não entra. As capivaras de
  enfeite saíram: em `pontos`, `capivaras-lago` e `capivaras-campinho` (retângulo onde o bando anda) e os pontos
  `-descanso` (o bando de data/bichos.json, da [estrutura], usa os dois). **O dono achou o mini mapa "horrível"** (15/11,
  ainda sem a imagem): o jeito dele (moldura, lugar, girar para bater com a câmera, a neblina) é da [arte] e da
  [estrutura]; do meu lado, dá para redesenhar a imagem num jeito mais de jogo, se ele quiser.
- **A Budega maior, igual à de verdade (15/11, com as fotos do dono; aprovada: "ficou ótimo, lembre-se de colocar
  interior com infestação da floresta"). **Na `main` em 15/11**, com o desenho da [arte] (2d52691), conferido por mim
  no jogo de dia e de noite; a Xiovanna foi junto para o lugar novo (a [estrutura] autorizou a troca das duas linhas
  do `data/npcs.json` no mesmo commit):** de
  5 × 3 m para 8 × 5,5 m no mesmo canto da praça (60,5 a 68,5 × 48,9 a 54,4), sem toldo: fachada
  preta (`fachada: 'preta'`), moldura amarela (`moldura`), faixa de luz (`led`) e o escudo (`logo`); a vitrine à
  esquerda e a porta de enrolar de 3 m à direita (`portaDe` 65, `portaAte` 68). Dentro: `piso` (`desenho: 'porcelanato'`,
  `folhas`), duas `prateleira` pretas com nichos amarelos (`cor`, `nichos`, `cipo`), a `geladeira` de duas portas de
  vidro no canto do fundo (`portas`, `vidro`, `cipo`), o `ventilador` na parede (`parede`, `dentro`), a `vitrine`
  (fundo amarelo, `fundo`; `frente`: sai com a parede da frente quando o herói entra) atrás do vidro da frente, o
  `balcao-vidro` dos doces no meio (`doces`), o caixa em L (dois `balcao` com `cor` e `faixa`: a frente com `caixa`,
  50 cm de fundo, e a volta até a parede do fundo), a `dracena` no `vaso` do canto do caixa (`dentro`), a
  `parede-verde` (grama com o escudo aceso, `neon`, e as flores amarelas) no fundo atrás do caixa (a câmera vê a parede
  do fundo e a da esquerda; a da direita, não) e o `freezer` solto na frente das prateleiras da esquerda. **O
  arranjo segue as duas imagens aprovadas** (`budega-maior-fachada.jpg` e `budega-maior-dentro.jpg`): o dono pediu de
  novo, "era pra ser parecido". A Xiovanna fica atrás do caixa, em (66,6; 50,55), fechada pelo caixa em L, pela
  dracena e pelas paredes; quem toca nela para 1 m ao sul, em (66,6; 51,55), e o pé cabe ali. A floresta entrando:
  `cipoDentro` 0,7 e `musgoDentro`, cinco raízes, sete tufos de capim e duas samambaias. Na frente, como na imagem da
  fachada: o `degrau` com `capacho` (chão), o `vaso` de `dracena` à esquerda da porta, a `lousa` (`cavalete`) à
  direita e dois `caixote` (`fruta`: banana e laranja) na frente da vitrine, tudo encostado na fachada. Na praça: a fogueira foi para
  (71,5; 56), as mesas para (62,4; 56,9) e (64,6; 58,3), a lixeira para a parede oeste, a árvore da praça ficou em
  (77; 58) e ganhou um terceiro poste de luz em (71; 61,5), entre a praça e o campinho. **Regras novas:** as
  bandeirinhas são desenhadas por cima de tudo, então nenhum varal pode passar, na tela, por cima da fachada nem de
  quem está na porta (o varal do sul desce até o poste novo); e a copa da árvore da praça cobre, na tela, o telhado do
  lado do caixa, mas com o herói lá dentro o jogo mostra só a casa (por isso o teste confere a porta, não o caixa).
  Fotos (borradas: pessoas, telas, número da casa, placas, cartazes e telefones) e desenhos:
  `docs/referencias/budega-real-*.jpg`, `budega-maior-fachada.jpg`, `budega-maior-dentro.jpg` e `budega-maior-planta.jpg`
  (as duas imagens são o alvo do desenho; "Tabacaria", narguilé e marcas não entram no jogo).
- **A floresta maior (14/11, planta aprovada: "pode seguir com a planta da floresta maior"; na `main` em 15/11, junto
  com o desenho da [arte], 7ce727a, conferido por ela no jogo no PC e no celular).** O mapa passou de 96 × 120 para
  **96 × 180** (só para o sul; nada muda de lugar). Planta: `docs/referencias/floresta-maior-planta.jpg`; conceitos: `floresta-maior-paineira.jpg` e
  `floresta-maior-posto.jpg`. O que entrou: a **Clareira da Paineira** (32, 150; a `arvore` 'Paineira' de `especie:
  'paineira'` com `flores`, e o parquinho antigo: `parquinho` com `brinquedo` 'balanco' (só os dois pés seguram),
  'escorregador' e 'gira-gira'), a **Cachoeirinha** (o poço em 14,3; 159,5 e a `cachoeira` na ponta norte dele), as
  **pedras de atravessar** (`pinguela` com `pedras: true`, abaixo do poço), a **mata profunda do sul** com o recanto do
  Véu (6,5; 173), o **buraco no gradil** (y 160 a 162,4, com um pedaço `estado: 'quebrado'` em cada ponta), a **mata
  da estrada** (a mata ao sul da vila, x 48 a 88, agora de andar), o **posto abandonado** (pátio de `calcada` rachada
  em 73 a 88 × 139 a 150, `cobertura` com 4 pilares, duas `bomba`, a lojinha como `casa` com `posto: true`, `pneus` e
  uma `placa` com `texto: ''`; a parede de mata da rua abre na frente dele), a estrada até a `barreira` em y 173,85
  e **13 árvores novas na vila** (o terreno dos fundos virou bosque). Dá para dar a volta inteira a pé (parque → buraco
  → mata da estrada → posto → rua → vila); o teste prova as duas passagens. **Regras novas no gerador:** tudo o que é
  sorteado até y = 120 usa `H0` (o sorteio antigo sai igual; a faixa nova usa `SEED + 14` e `SEED + 15`); a mata só
  "conhece" o riacho novo e o poço depois de sorteada a antiga (`STREAMS`/`PONDS`); `pruneWedges` tira as plantas
  sorteadas que ficam num vão de entalar e para tudo se o vão for entre duas coisas postas à mão; `pocketOpen`: só é
  vão de entalar se couber um quadrado de 0,3 m entre as duas coisas, fora das outras (os dentes entre os arbustos da
  parede não contam). Bichos (escolhidos pelo dono em 14/11; dados da [estrutura]): `quati` 4 (20 a 38 × 112 a 140, a mata
  do meio do parque), `tatu_bola` 3 (52 a 86 × 92 a 136), `marimbondo` 3 (52 a 86 × 154 a 177, perto do posto) e
  `filhote_boitata` 1 (2 a 12 × 167 a 178, o recanto do Véu; só de noite). **Capivaras andando** (formato
  da [estrutura]): em `pontos`, `capivaras-lago` e `capivaras-campinho` (retângulos) e os pontos `-descanso`; as de
  enfeite saem quando as dela entrarem. **Mapa da tecla M:** o gerador escreve junto `capao-mapa.png` (8 px por metro,
  sem texto) e `capao-mapa.json` (`escala`, `largura`, `altura`, `nomes`), por `scripts/mapa-de-cima.ts`.
- **O parque antigo está na `main` (13/11)**, com o desenho da [arte]. Antes no ramo `mundo/parque-antigo` (bloco
  `FLORESTA` antes da etapa 4b, sorteio `SEED + 13`; tudo fora das trilhas e sem vão de entalar, com a função `near`
  procurando lugar em espiral). Tipos e propriedades: `placa` (`tamanho: 'grande'`, `mato`), `bebedouro` (`quebrado`,
  `musgo`), `banco` (`material: 'concreto'`, `mato`), `lixeira` (`mato`), `poste-praca` (`apagado`, `torto`, `cipo`),
  `academia` (`aparelho`, `ferrugem`, `cipo`) e `calcada` em polígono (`desenho: 'placas'`, `quebrada`). Referências:
  `docs/referencias/parque-*.jpg`. A placa grande fica alta, acima do pilar do portão; o poste do parque da entrada
  fica em (46,2; 34,6), fora da linha do poste do portão na tela.
- **A planta da rua da Budega foi aprovada (13/11, "pode mandar se for essa aqui, show"):** a imagem do Nano Banana
  feita por cima da minha prévia de perto (`docs/referencias/rua-budega-aprovada.jpg`, com a planta numerada em
  `rua-budega-planta.jpg`) é o alvo. No gerador, a constante `FLORESTA` (sorteio `SEED + 11`, nada muda de lugar); ramo
  **`mundo/rua-budega`** (por cima da `main`, sem a 4c: entra assim que o chão da [arte] ficar pronto; o
  `mundo/rua-floresta` é o mesmo por cima da 4c, só de guarda). Tipos novos no `chao`: `meio-fio`, `faixa-rua`, `remendo`, `buraco`, `poca`, `rachadura`,
  `bueiro`, `tampa`, `raiz` e `planta` capim (com `largura` e `cor`, para um desenho que ainda não os conhece mostrar
  só um traço fino); no `cenario`: `predio`, `moto`, `placa-rua`, `cadeira`, `vaso`, `lixo` e a figueira com
  `rompendo`; propriedades novas em `casa` (`cipo`, `plantas`, `arvoreNaLaje`, `varal`, `musgo`, `grade`,
  `portao`), `poste`/`fiacao` (`cipo`), `carro` (`arvore`), `calcada` (`desenho: 'placas'`) e `praca` (`musgo`).
  Prévias: meu `previa-floresta.mjs` (aceita um JSON de números com legenda) na pasta temporária da conversa.
- **Decisão do dono (12/11, roteiro "🗺️ Mundo novo"):** o visual vira o do protótipo 2.5D da [arte]
  (`prototipos/pindorama-25d/`, isométrico, estilo HQ) e os mapas são refeitos do zero. Os 5 mapas de hoje saem quando
  o capítulo 1 novo estiver jogável; o motor (servidor, regras, salvamento) fica. Capítulo 1: Capão Redondo e o Parque
  Santo Dias → Guarapiranga → Santo Amaro (Largo Treze, Terminal, Shopping do Largo Treze) → Billings → a Sé no fim.
  Tom "bem selvagem" (a mata volta pelo sul); lugar real sim, marca não.
- **Decisões do dono (12/11):** a **Budega Distribuidora** (o negócio dele) é a vendinha da praça, sem a palavra
  "Tabacaria" e sem produtos de tabaco (a lei proíbe propaganda de tabaco); o nome fica **"Selva de Pedra"** (o pacote
  do ChatGPT dizia "Selva de Concreto"); os saguis são **encantados** e a missão é acalmar ou afastar, não matar; o
  ritual de classe na figueira fica para depois. **Câmera:** padrão no médio (herói ~260 px em Full HD, ~14 m de chão
  na largura), afastando até o longe (~185 px, ~20 m); a [arte] aplica. Conta certa: chão na largura da tela =
  largura em px ÷ zoom (px por cm) — no protótipo em Full HD, 1920 ÷ 136,7.
- **Padrão de arte:** `docs/referencias/mapa-01-arte-aprovada.jpg` (do pacote que o dono trouxe do ChatGPT, feito em
  cima da minha planta): "2.5D estilizado e sombrio", mata fria em verde profundo e teal com brilho espiritual, vila
  quente com luz âmbar; dia, entardecer e noite mudam o clima, nunca a leitura do combate e dos caminhos. Notas que
  valem: trilhas principais de 2 a 3 m (mínimo 1,5 m); Curupira junto da clareira, a caminho do portão; Figueira dos
  Despertos com símbolos que brilham; mata rasa e mata profunda (neblina, alto risco); "Véu Ancestral" em pontos
  certos, não no mundo todo; campinho é ambientação, não arena.
- **Escopo aprovado do Mapa 01 (uma etapa por vez, cada uma com o "pode" dele):** 1) câmera ✔; 2) planta final ✔
  (`docs/referencias/mapa-01-planta.jpg`); 3) uma tela jogável (a clareira) ✔; 4) o resto do mapa em 3 pedaços:
  **4a mata e lago ✔ (12/11, sem as criaturas)**, 4b portão e vila (a próxima), 4c campinho, viaduto e saídas;
  5) atmosferas (dia, entardecer e noite); 6) minimapa. Ele pediu: **"antes de criar tudo me entrega escopo para eu
  ir aprovando"** e **"o que não for da sua responsabilidade passe para os outros chats"**. Meu jeito: prévia
  (imagem) primeiro, o "pode" dele, depois o jogo.
- **Mapa 01 (Parque Santo Dias + Vila do Capão), 96 × 80 m** (x para o leste, y para o sul, em metros; na tela, x
  desce para a direita e y desce para a esquerda: o fundo da tela é o noroeste). Gerador `scripts/gen-capao.ts` →
  `public/assets/maps-iso/capao.tmj` (`npm run gen:capao -- --out arquivo.tmj`; sem `--force` ele não sobrescreve,
  regra 9). A etapa é a constante `STAGE` ('3', '4a', '4b', '4c'): cada uma liga o que a anterior não tinha.
  - **Pronto (3 + 4a):** clareira do despertar com centro (37, 43) e raio 9, círculo (spawn) de raio 3 e a Figueira
    dos Despertos em (36,5; 38); Curupira em (42,5; 44,5) (`curupira_capao`, da [estrutura]); zona segura da clareira
    31,5 a 44 × 39 a 48,5. Muro do parque em x = 48 com gradil e o **Portão I** (y 41 a 47, ainda fechado). Trilha da
    clareira ao portão (3 m) e trilha em volta do lago (2,2 m). **Lago** em volta de (16, 23) (polígono `agua`, com
    colisão em faixas de 0,5 m que não bloqueiam tiro), lama na margem, 14 aguapés, 3 capivaras (enfeite, não
    bloqueiam), 3 troncos caídos, pedras em grupos, a **Pedra do Véu** (`pedra` ancestral em (7,5; 9,5)) e 4 véus
    (figueira, círculo, pedra e beira do lago). **Mata profunda** nas pontas noroeste e sudoeste (polígonos
    `mata-profunda` e áreas com `neblina` e `escuro`), fechada por arbustos que bloqueiam; mata fechada nas bordas.
    O gerador não planta árvore alta que, vista pela câmera, cubra a clareira, o círculo, a trilha ou o lago
    (`hidesView`), e deixa 1,2 m entre troncos.
  - **Criaturas (religadas em 13/11):** `CREATURES = true` no gerador. Saguis encantados em x 24 a 40 × y 12 a 28
    (4) e jararacas em x 6 a 22 × y 56 a 74 (3). Ficaram desligadas de 12/11 ("opção a" do dono) até o combate do jogo
    novo, passo 1, da [estrutura] chegar (9de98f5). Conferi no jogo: os saguis atacam, as pedras acertam e a vida cai;
    mas na mata fechada eles ficam escondidos embaixo das copas e muita pedra bate nas árvores: a mata nova resolve.
  - **4b (na `main` em 13/11, depois do desenho da vila pela [arte]):** o Portão I abre; faixa de pedestre
    atravessando a Travessa; rua do portão para o leste (y 41 a 47) e rua de baixo (x 88 a 94, ainda fechada no mato
    lá no fim); calçadas estreitas; praça de pedra portuguesa (61 a 79 × 48,5 a 59) com a Budega (vendinha,
    letreiro "BUDEGA DISTRIBUIDORA", escolha do dono, 62 a 67 × 49,5 a 52,5; balcão em (64,5; 53,3), onde a [estrutura] põe quem atende), fogueira
    com 4 bancos em (69,5; 56), árvore da praça (sibipiruna) em (77; 58), 2 mesas, orelhão e lixeira encostados na
    Budega; 5 casas coladas ao norte da rua com uma viela de 2 m (x 79 a 81), uma casa verde ao sul e uma casa
    abandonada no terreno dos fundos; 7 postes com fiação; carro largado na Travessa; árvores e mato nos fundos; a
    beira da vila fechada por mata. Regras novas: a câmera não pode ter o portão, a rua, o balcão, o letreiro e a
    fogueira tampados (por isso a árvore da praça ficou no canto sudeste), e nenhum vão de 0,3 a 1,2 m entre duas
    coisas sólidas de frente uma para a outra (um orelhão a 40 cm de um poste entalou o personagem).
  - **Mata nova (pedido do dono em 13/11; aprovada por ele no mesmo dia; na `main` em 13/11 com o desenho da [arte], conferida no jogo no PC e no celular):** o dono não gostou da
    mata ("muito pequena, muita árvore, caminho sem árvore, cores fortes, plantas diferentes, mais sombria, árvore normal
    e não redonda, árvore seca") e escolheu: 50% maior para o sul (o mapa passa a 96 × 120 e a vila continua até y = 80;
    o pedaço ao sul da vila é mata fechada de enfeite), todas as plantas e "mudar a trilha e o lago" para a figueira não
    tampar. O que mudou: ~100 árvores grandes em 48 × 120 (antes 213 em 48 × 80); trilhas novas (norte pelos saguis,
    lago, sul até a Clareira das Bananeiras e, pela pinguela, ao recanto do Véu); lago em (16, 50) com deque; riacho até
    a beira sul; jerivá, embaúba, xaxim, bananeira e árvore seca (`arvore`), `bambu` (bloqueia), `planta` (samambaia,
    helicônia, taboa e cogumelo que brilha), `deque` e `pinguela` (dá para andar em cima); escuro e neblina nas áreas
    (vale a menor). Regras novas no gerador e nos testes: nenhuma copa tampa trilha ou lago, nem de cima nem da
    câmera, e a figueira não tampa nada além da própria clareira. Saguis em x 32 a 46 × y 6 a 24, jararacas em
    x 16 a 26 × y 92 a 112. Entra na `main` depois da 4b e do desenho dessas coisas pela [arte] (senão o bambu vira
    parede invisível e o deque parece água). Para aumentar de novo depois (o dono perguntou): subir `H` e pôr as
    coisas novas no sul; o que existe não muda de lugar, nem os NPCs (`data/npcs.json`).
  - **4c (aprovada pelo dono em 13/11; ramo `mundo/etapa-4c`, por cima da mata nova; espera o desenho da [arte]):** campinho de várzea
    (60 a 85 × 63 a 78, `campinho` com linhas, duas `trave`, capivaras pastando, bancos) e o `muro` com grafite a oeste
    dele (pintura virada para o campo); `viaduto` da Linha 5-Lilás (y 2 a 6, a 8 m, quebrado na ponta do parque, com
    mato), 4 `pilar-viaduto`, o `trem` lilás (3 vagões) e `cipo`; o `onibus` velho (70 a 86 × 12,5 a 15,5); a rua para
    Guarapiranga segue pela mata ao sul da vila (x 88 a 94) até uma `barreira` com `placa` em y 114,5 (a saída abre
    quando o Mapa 02 existir) e a rua leste termina no mato com a placa "ESTAÇÃO CAPÃO REDONDO". O plano antigo era:
  - **4c (plano de 12/11):** campinho de várzea em (60 a 85, 63 a 78); muro com grafite em x = 58 (y 62 a 78); viaduto da Linha
    5-Lilás no fundo (y 2 a 6, x 48 a 96, 8 m de altura, com o trem lilás parado) e um ônibus velho embaixo; saídas
    sul (x 88 a 94, y = 80) → Guarapiranga e leste (x = 96, y 41 a 47) → Estação Capão Redondo (depois). Regra: o que
    é alto fica no fundo da tela (noroeste), o que é baixo fica na frente. Saci no fundo da mata, em (8,5; 6) (depois).
  - **Prévias:** um script de rascunho meu (`previa-capao.mjs`: SVG isométrico lido do `.tmj`, com a colisão em
    vermelho) na pasta temporária da conversa. Se sumir, refazer: é só desenhar `chao` e `cenario` em isométrico.
    As imagens que o dono aprovou ficam em `docs/referencias/mapa-01-*.jpg`.
- **Formato do mapa novo** (combinado com a [estrutura] em 12/11, no roteiro): `.tmj` ortogonal, 1 tile = 1 m (tile
  de 32 px no Tiled, só como grade); `colisao` com retângulos (`bloqueiaTiro`, padrão true; água com false) que **o meu
  gerador** tira do cenário (tronco 0,4 a 0,6 m, poste 0,3 m, base de casa e muro, lago em retângulos de ~0,5 m);
  `seguro` com retângulos (zona segura por área: monstro não entra, não nota e não acerta); `saidas`, `monstros`,
  pontos e propriedades de sempre; `chao` e `cenario` só para o desenho (o formato delas eu combino com a [arte]).
  Medidas para o pé de 0,6 × 0,4: passagem com pelo menos 1,5 m e 1,2 m entre troncos.
- **Minimapa:** protótipo pronto no ramo `mundo/minimapa` (commit 1c94ebe), **pausado** até o mapa novo existir. A
  janela, o mapa grande (tecla M), as marcações e os nomes que não se sobrepõem servem para o mapa novo; o terreno hoje
  sai da cor dos tiles (`terrainImage`) e vai precisar ler `chao`/`cenario`.
- **Nano Banana** funciona nesta nuvem (chave nos Segredos de rede):
  `python3 -I scripts/nano-banana.py --model gemini-nano-banana-2.1 --aspect 16:9 --size 1K --out x.png --ref estilo.png
  arranjo.png --prompt "..."` (~US$ 0,034 por imagem). Bom jeito: um print do protótipo como estilo e uma planta sem
  texto como arranjo. Gastei 2 imagens (~US$ 0,07) em 12/11; o crédito de US$ 5 é dividido com a [arte], e cada
  máquina conta o seu gasto em `saves/nano-banana.json` (até 12/11 gastei US$ 0,25 em 4 imagens, uma delas em 4K).

## Antes, em 9 de novembro de 2026 (os mapas de hoje, que vão sair)
Feito pelo [mundo], tudo na `main`:
- **Mapa, passos 1 a 3:** profundidade (copas e alto dos postes na camada `acima`, que fica transparente perto de quem
  passa), água e fogo animados, luzes, sombras; Refúgio caprichado (beiradas suaves, vila colorida, barraquinha da
  Dona Iracema, píeres ligados ao deck da fogueira); Santo Amaro caprichado (prédios de 2 andares, neblina, brasas).
- **Represa Billings**, **Terminal Santo Amaro** e **Shopping do Largo Treze** (mapa de dentro), cada um com o seu gerador.
- **Criaturas da Billings no mapa:** as áreas da Iara, do jacaré e do boto saíram da camada `lendas` para `monstros`
  quando a [estrutura] criou cada um. A camada `lendas` ficou vazia e saiu do mapa.
- Antes da divisão em frentes eu fiz o personagem de 20x24 com o equipamento no corpo; hoje vale o da [arte].

| Mapa | Tamanho | Gerador (semente) | Clima | Saídas (→ mapa / chegada) |
|---|---|---|---|---|
| `refugio` | 96×72 | `gen-map.ts` (20261110) | — | leste → `santo-amaro`/`oeste`; sul → `billings`/`norte` |
| `santo-amaro` | 80×60 | `gen-santo-amaro.ts` (20261112) | neblina 0.22, escuro 0.14 | oeste → `refugio`/`leste`; sul (40-42, 59) → terminal/`norte`; porta do shopping (26-27, 22) → shopping/`entrada` |
| `billings` | 88×64 | `gen-billings.ts` (20261120) | neblina 0.16, escuro 0.08, vaga-lumes 0.7 | norte → `refugio`/`sul` |
| `terminal-santo-amaro` | 64×48 | `gen-terminal.ts` (20261130) | neblina 0.18, escuro 0.12 | norte → `santo-amaro`/`sul` |
| `shopping-largo-treze` | 64×44 | `gen-shopping.ts` (20261213) | neblina 0.08, escuro 0.26 | portas de vidro (30-33, 43) → `santo-amaro`/`shopping` (26, 24) |

- **Criaturas por mapa:** Billings: Iara 1 (prainha e pedra, x 35-53, y 34-45), jacaré 3 (canais do oeste), boto 2 (lago
  das casas afundadas), jararaca, corpo-seco e capelobo. Shopping: corpo-seco no supermercado e na ala leste, capelobo
  no cinema e na ala oeste, saci na praça de alimentação. Terminal: corpo-seco nas plataformas, capelobo no fundo.
- **NPCs** (posição em `data/npcs.json`, da [estrutura]; o teste confere que o lugar é livre e alcançável): Dona Iracema
  em (46, 28), no meio da barraquinha (a fileira de trás da barraca não bloqueia, só o balcão), e o Curupira em
  (45, 12), na beira da mata ao norte da vila.
- **Tileset:** 552 tiles (imagem 144×1242). Tile novo sempre no fim. Quando a imagem cresce, o tileset embutido em todos
  os `.tmj` precisa ser atualizado (o teste "a imagem dos tiles está em dia" avisa), sem mexer nas camadas.
- **Testes do [mundo]:** `tests/maps.test.ts` (ordem das camadas, nada que bloqueia na `acima`, árvore com copa e tronco,
  beirada da areia, ligações entre mapas, criaturas da Billings, portas do shopping, NPCs alcançáveis, animações,
  luzes e a imagem dos tiles).

## Como confiro (receitas)
- **Moita fechada (19/11):** a colisão é `bushBoxes` (no `iso-map.ts` e uma cópia no `gen-capao.ts`): três caixas em
  octógono (a cruz a 0,9 × o raio e o quadrado do meio de 1,4 × o raio). No Capão, a moita cuja cruz abre um vão de
  entalar com o que está colado nela (casa, tronco) volta ao quadrado de 1,8 × o raio (regra da vila: vão de 0,3 a
  MIN_GAP que nada fecha; no resto: se cabe o pé). Para ver onde o pé para em linha reta, sem o navegador: `bodyFits`
  com `cornerAtFeet` (src/shared/movement) passo a passo sobre o `GameMap.fromTiled` do mapa.
- **Comparar um mapa gerado com o atual** (`node compara.cjs atual.tmj novo.tmj`):
  ```js
  const fs = require('fs');
  const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const semId = (l) => JSON.stringify(l.objects.map(({ id, ...o }) => o));
  for (const la of a.layers) {
    const lb = b.layers.find((l) => l.name === la.name);
    if (!lb) console.log(la.name, 'sumiu');
    else if (la.data) console.log(la.name, la.data.filter((g, i) => g !== lb.data[i]).length, 'tiles diferentes');
    else console.log(la.name, semId(la) === semId(lb) ? 'igual' : 'mudou');
  }
  ```
- **Só o tileset embutido** (a imagem cresceu e as camadas não mudam): num script `tsx`, leia o `.tmj`, troque
  `map.tilesets[0] = tiledTileset('../tiles.png')` (de `scripts/tileset.ts`) e salve com `JSON.stringify(map)`.
- **Gerador sem estragar o resto:** mudança nova entra no fim do gerador, sem sortear nada (ou sorteando "à toa" no
  mesmo lugar). No `MapBuilder`, `setGround(x, y, chave, false)`: sem o `false`, o tile fica reservado.
- **Navegador:** `npm run build`, depois `MEUMMO_SAVE=<arquivo temporário> npm start`, espere uns segundos e entre
  com qualquer nome e senha (o personagem nasce na hora). Para ir a outro mapa sem caminhar: `GET /admin/api/jogadores`
  (o `id`) e `POST /admin/api/jogador` com o cabeçalho `x-meummo-admin: 1` e `{"acao":"levar","id":…,"mapa":…,"x":…,"y":…}`.
  Na nuvem, o servidor ligado em segundo plano é desligado depois de uns 30 minutos.
- **Luz:** muitas luzes juntas somam e estouram em branco (aconteceu no sol do átrio do shopping). Use raio pequeno
  (~20) e poucas.
- **Terminal:** `rm` com variável sem aspas é bloqueado. Use `"${PASTA:?}"/arquivo`.
- **Medir o desenho (22/11):** no jogo compilado, `PD.view.world.forceFlush = true` termina o desenho a cada etapa, e
  `PD.view.world.timing` dá a média de cada uma (`chao`, `sombra` — a água, o reflexo e a vida no chão —, `objetos`,
  `personagem`, `cima`) em ms. `?fps` mostra o quadro inteiro. Para saber se a culpa é do MAPA, meça o mesmo lugar com o
  mapa de antes (`git show HEAD:public/assets/maps-iso/<id>.tmj`, compilar e religar o servidor) e com o novo. O
  `levar` do painel pede o `id` da entrada atual (muda a cada vez que entra: pegue de `__mundoNovo.me.id`).

## Esperando outras frentes
- **[estrutura] (feito em 22/11, 02855f2):** o bando de capivaras da várzea do Guarapiranga (`capivaras_varzea`, 3
  capivaras, nos meus pontos `capivaras-varzea` e `-descanso`). **Ainda a combinar:** quando o mapa de Santo Amaro novo
  existir, a saída do leste (a barreira sai e a chegada `chegada-santo-amaro` já está lá); NPCs para os lugares novos,
  quando houver missões.
- **[estrutura] (feito em 19/11, 987be1e):** a Dona Iracema e o Barqueiro no Mapa 02 (`guarapiranga`), com o pé em
  (57,5; 50,35) e (49,6; 62,4). O pedaço (a) ainda não tem área de bichos. Os dois usam o boneco de reserva (o desenho
  próprio é da [arte], depois do personagem).
- **[estrutura]:** o combate no jogo novo, passo 1 (ver golpe, dano, desmaio e atirar com o estilingue). Quando
  chegar, religo as criaturas da 4a. O formato novo do mapa já é lido (pasta `maps-iso/`, `colisao`, `seguro`).
  Resolvido em 13/11 (e13888e, conferido por mim no mapa da 4b): o "andar até" enroscava em poste e banco e depois
  parava de responder; agora vai pelo tamanho exato do pé (`src/shared/route.ts`). O desenho provisório usa a
  `altura` das colisões e a `copa` como raio, e `/?novo&provisorio` mostra as caixas de colisão (bom para conferir).
- **[arte]:** a 4a já está desenhada na `main` (4a6b80f). Para a 4b, ela espera o "pode" do dono e a minha lista final;
  a PD.View ainda não desenha `casa`, `banco`, `mesa`, `fogueira`, `orelhao`, `lixeira`, `carro`, `fiacao`, `praca`
  e `faixa`. Por isso a 4b só entra na `main` junto com o desenho da vila (senão viram paredes invisíveis).
- Dos mapas de hoje (valem até eles saírem): o personagem novo tem ~1,6 tile de altura e o zoom ficou sempre par. Se a
  cabeça ou o chapéu sumirem embaixo das copas ou dos letreiros do shopping, ajusto `FADE_NEAR`/`FADE_FAR` em
  `mapDepth.ts` (o ponto de cada personagem é `sprite.y - 12`, em `WorldScene.updateDepth`).

## Próximos passos possíveis (o dono escolhe)
**22/11: o Guarapiranga grande (etapa 1, o mapa inteiro aberto) está na `main`.** Próximo, quando o dono andar e
aprovar o tamanho e os caminhos: **vestir região por região** (o clube, a barragem de 1909, o coreto, a caverna e o
mirante com desenho próprio; a comunidade com cara de comunidade). Depois, o **Capão maior** (para a direita). O
**mundo aberto** continua parado até ele pedir (precisa da [estrutura]).
- **A direção nova dele: o mundo ABERTO, sem tela de carregamento** ("vamos focar para ter o mapa como se fosse aberto
  sem carregamento"): andar do Capão até o Guarapiranga sem trocar de mapa. Hoje cada mapa é uma sala no servidor e a
  troca é pela camada `saidas`; mudar isso é da [estrutura] (servidor, motor) e meu (mapas em setores que se emendam).
  Ainda não falei com as outras frentes sobre isso (ele pediu para não gastar).
- **O escopo melhorado que ele mandou** (texto dele): o mapa tem que funcionar como fase de MMORPG, não só ilustração;
  dividir em setores reutilizáveis, com caminhos de verdade, colisões, entradas e saídas, áreas seguras, zonas de caça e
  lugares de missão; validar a escala e as ligações antes do desenho final; separar o mapa do mundo (regiões e pontos
  de interesse) dos mapas jogáveis; não pôr todos os bichos, missões e segredos no mesmo lugar (áreas vazias, descoberta
  e motivos para voltar); Mapa 01 Capão (começo, primeiras missões, escolha de classe), Mapa 02 Guarapiranga
  (exploração, navegação, caça, ruínas e mistérios), Mapa 03 Santo Amaro (cidade, comércio, conflitos); não fazer tudo
  de uma vez: uma região pequena jogável, testar andar, combate, exploração e desempenho no PC e no celular, depois
  crescer.
- **A imagem dele (não ficou em arquivo; o que tem nela):** "Mapa 02 — Represa de Guarapiranga, versão expandida,
  400 × 320 m (≈ 32 ha), uns 4× a de 200 × 160", 8 regiões, uns 12 a 16 telas de PC para atravessar. A vila do Capão
  (urbana) no alto à esquerda, a estrada contornando a represa pelo leste até Santo Amaro, a represa no meio. Os 13
  pontos: 1 Chegada (Estrada do M'Boi Mirim, do Capão); 2 Mirante (oeste; observação e missões); 3 O Refúgio (palafitas;
  comércio, pesca, missões secundárias); 4 Brejo Maior (perto da vila; barracas, fogueira, artesãos, pescadores,
  informantes); 5 Campinho (campo de terra; eventos e desafios); 6 Praça em Ruínas (nordeste, com uma cachoeira; relíquias
  e segredos); 7 Clube Náutico em Ruínas (leste da represa; piscina vazia, píer quebrado, alto risco); 8 Ilha do Véu (ilha
  grande no meio, com uma árvore enorme; rituais, visões, missões principais); 9 Barragem de 1909 (leste; passagens por
  dentro e a saída para Santo Amaro); 10 Represa/Barragem (sul; a comporta, exploração por dentro, eventos); 11 Trilha da
  Margem Sul (caça e coleta rara); 12 Caverna Sagrada (sudoeste; inscrições, energia ancestral, missões de classe); 13
  Várzea de Caça (sul, embaixo da barragem; alagado com muitos bichos: capivaras, saguis, aves). Biomas: urbano
  (comunidade), mata densa, margem e brejo, represa, ruínas. Conteúdo: caça, coleta (ervas, madeira, fibras, minérios),
  pesca, exploração e eventos (invasões, rituais, aparições). Missões: os pescadores do Refúgio, o clube náutico, o
  segredo da Ilha do Véu, ativar a barragem, o ritual de classe. Ligações: Capão (Mapa 01) e Santo Amaro (Mapa 03);
  depois, Interlagos, Grajaú e Parelheiros.
- **O que eu já tinha feito antes de parar:** a planta de 200 × 160 m (`docs/referencias/mapa-02-maior-planta.jpg`,
  feita por cima do mapa de cima de hoje; o dono não chegou a aprovar e mandou o escopo novo no lugar) e as tarefas
  "Guarapiranga maior" e "Capão maior" no roteiro, agora paradas. Nada foi construído nos mapas.
**Agora (19/11):**
1. **Os dois mapas maiores** (pedido do dono em 19/11, "deixa o mapa maior" → "os dois maiores"): primeiro o Guarapiranga
   (uns 200 × 160 m: o parque, o brejo e a orla abertos), depois o Capão (para a direita). Só para a direita e para baixo
   (pedido da [estrutura]: a origem não muda, senão o mapa explorado salvo desalinha) e, se a quitanda, o deque ou uma
   chegada mudarem, mandar os pés novos para a [estrutura] antes de juntar. Limites que ela passou: o servidor aguenta até
   uns 250 × 250 m (estimativa); o que pesa é o desenho (objetos à vista; ~0,3 ms por bicho na tela); até 50 bichos por área.
2. **O chão, a luz e a água com mais qualidade** (roteiro; passou da [arte] para mim com a divisão nova). Alvo:
   `docs/referencias/chao-pintado-alvo.jpg`. **O chão pintado da [arte] está na `main` (19/11)**: `js/world/chao.js`
   (`PAINT` no alto é onde se mexe nas cores), `ground.js` chama os pintores, as pedras em `props.js` (`_rock`); as
   receitas e as lições estão na seção dela no `docs/ARTE.md` (ferramentas `chao-prancha.cjs`, `chao-foto.cjs` e
   `chao-custo.cjs`; no "levar" do painel, x e y são o pé em metros, com fração: corrigido pela [estrutura] em 19/11, 6227e40). Medido no jogo: 14,4 ms por pedaço de chão (antes
   14,9; pior 44,9). **Mais perto do alvo (19/11, na `main`):** a grama com a demão oliva (`wash`), o sol sem o limão, mais
   grão, uma camada de pintas claras (`speck`) e as folhinhas redondas e mais numerosas (`round`, `n: 8`); a trilha com
   dois sulcos escuros. Conferi pelos números contra o alvo (receita: a média e a saturação dos verdes e das terras e o
   "detalhe fino", a diferença da imagem para ela borrada), na prancha (`chao-prancha.cjs`, rápido) e no jogo. A clareira
   do Capão é `grama` (não existe `clareira` no mapa). **Luz e sombra (passo 2, 19/11, na `main`):** as sombras do chão
   vão para uma máscara de 1/4 do ponto da tela (`_softShadows` no `ground.js`) e voltam esticadas (beirada macia) e
   multiplicando (`SHADE_RGB`); a árvore grande tem a sombra que afina (`taperShadow` no `props.js`); e todas as sombras
   giram no mesmo sentido (a faixa do tronco e do poste girava ao contrário e apagava a da copa onde se cruzavam;
   `quadShadow` acerta a volta de quatro pontos). **Água e vida (passo 3, 19/11, na `main`):** `js/world/vida.js`
   (`update` no World.update; `ground` logo depois da água: o peixe pulando e as folhas no chão e boiando; `live` por
   cima de tudo: o que voa; `glows`: as luzinhas dos vaga-lumes no escuro da noite, em `_drawNightLights` do view.js).
   Só perto da tela, quantos de cada (`flyWant`, `moteWant`, `bugWant`...); borboleta e libélula maiores que as de
   verdade, senão nem aparecem. Medido: 0,34 ms por quadro de dia e 0,21 de noite. **O reflexo (20/11, na `main`):**
   `PD.agua.reflect` (World.draw, logo depois do chão) vira a imagem PRONTA de quem está perto da água (escolhidos uma
   vez por mapa, `reflectables`; o aguapé e os móveis de dentro não): a árvore no pé do tronco, o barco na linha d'água
   e o que é largo (casa, barco comprido) em duas metades, cada uma virada em torno da sua beira da base (`flipAlong`:
   uma transformação do canvas, sem degrau), recortado na água (`waterPolys`). De noite, `_drawLightReflections` (view.js)
   põe a faixa tremida de cada luz alta no ponto espelhado (a mesma posição com a altura negativa), numa tela à parte
   recortada na água; as imagens prontas que passam por cima da faixa (deque, casa, barco) apagam o pedaço delas (sem
   isso, a luz aparecia por cima do deque: a camada da noite fica por cima de tudo). Medido no Refúgio: 0,2 ms (dia) e
   0,36 ms (luzes de noite) por quadro. Falta: as emendas entre pedaços do chão (`EMENDA=3`)
   (passo 2: a sombra das casas e das árvores, também no deque) e a vida no ar (passo 3). **A referência do dono para o
   visual** (contada pela [estrutura]): o Dunloc Online — estilo de quadrinho (contorno escuro grosso, 2 ou 3 tons
   chapados, cores vivas), chão cheio de detalhe (pedrinhas soltas, flores de várias cores em manchas, tufos, trilha de
   pedras, manchas de terra), sombra suave e luz quente no chão, e cada canto com algo para olhar. Não copiar a arte
   dele: a nossa é São Paulo tomada pela floresta e o folclore. Método que deu certo no personagem: referência, antes e
   agora lado a lado, na mesma câmera, uma coisa por vez.

**Antes (mundo novo):**
1. **Etapa 4b (portão e vila):** prévia primeiro, o "pode" do dono, depois o jogo.
2. **Etapa 4c**, depois a 5 (atmosferas) e a 6 (minimapa no mapa novo: retomar o ramo `mundo/minimapa`; o terreno
   vai precisar ler `chao`/`cenario`).
3. **Religar as criaturas** da 4a quando o combate do jogo novo chegar.

**Suspenso (era para os mapas de hoje, que vão sair):**
1. **Enfeite em volta do Curupira** (roteiro, opcional): árvore oca ou cantinho de mata fechada em volta de (45, 12),
   sem bloquear o tile dele (o teste dos NPCs confere).
2. **Chefe do cinema do shopping:** uma lenda nova. A [estrutura] cria e eu marco a área no cinema (x 22-41, y 3-11).
3. **Conferir as copas e os letreiros com o personagem novo** (veja acima), mesmo sem aviso da [arte].
4. **Boitatá** (chefe, [estrutura + arte + mundo]): combinar com o dono onde ele mora e marcar a área.
5. **Ideias para depois:**
   - o segundo andar do shopping (as escadas rolantes já apontam para lá);
   - o cinema mais escuro que o resto;
   - a Selva do Centro (Paulista e Sé, fim de jogo, no `DESIGN.md`).
6. **Nome do shopping:** se o dono preferir outro, troque `ZONE_NAME` em `gen-shopping.ts`, o nome da saída em
   `gen-santo-amaro.ts` e os docs.
