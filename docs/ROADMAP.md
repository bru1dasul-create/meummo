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
- [ ] **[dono]** Medir em aparelho de verdade: meta de 30 quadros por segundo num celular intermediário e 60 no PC

## 🗺️ Mundo novo (2.5D isométrico) — decidido pelo dono em 12/11
O visual muda para o do protótipo 2.5D (`prototipos/pindorama-25d/`) e os mapas são refeitos do zero; o motor
(servidor, regras, salvamento, dados) fica. Os 5 mapas atuais saem quando o capítulo 1 novo estiver jogável.
- [x] **[dono]** Região: zona sul de SP, perto do Capão Redondo, com mapas "bem selvagens" (a mata volta pelo sul)
- [x] **[dono]** Nascimento no **Parque Santo Dias** (Capão Redondo). Capítulo 1, do mais fácil ao mais difícil:
  Capão Redondo e o parque → Guarapiranga → Santo Amaro (Largo Treze, Terminal e o Shopping do Largo Treze, sem
  o nome da rede) → Billings → o centro (Sé) no fim do jogo
- [ ] **[mundo]** Primeiro mapa (a fatia de teste): a clareira do despertar na beira do parque, com caminho claro
  até a vila do Capão (zona segura); a mata fechada do parque é a primeira área de caça. Escopo aprovado pelo dono
  em 12/11, uma etapa por vez e cada uma com a aprovação dele: 1) distância da câmera ✔; 2) planta final no papel ✔
  (`docs/referencias/mapa-01-planta.jpg`); 3) uma tela jogável (a clareira, em `/?novo`) ✔ (`npm run gen:capao` →
  `public/assets/maps-iso/capao.tmj`); 4) o resto do mapa em 3 pedaços: mata e lago ✔ (12/11; os saguis encantados e
  as jararacas voltaram em 13/11, com o combate do jogo novo), portão e vila ✔ (13/11: a Budega Distribuidora na praça,
  desenhada pela [arte]), campinho, viaduto e saídas; 5) atmosferas (dia, entardecer e noite); 6) minimapa.
  Mata nova (pedido do dono, 13/11: 50% maior para o sul, menos árvores, trilhas sem copa, plantas variadas, mais
  sombria): prévia no ramo `mundo/mata-nova`, entra depois do desenho das plantas novas pela [arte]. Padrão: a arte conceitual
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
- [x] **[arte]** Xiovanna, a vendedora da Budega (13/11, pedido do dono, com fotos de referência que não vão para o
  repositório): morena, black power grande, flor de hibisco, uniforme preto (jaqueta de zíper com capuz, escudo
  dourado no peito, emblema na manga), jeans e tênis. Vira para quem chega, acena, leva a mão ao cabelo e gesticula
  ao falar. E o escudo da Budega numa placa em cima da laje (`logo` = "budega" na casa, do [mundo]), sem
  "tabacaria" e sem o narguilé: no círculo, o hibisco. Falta o nome "Xiovanna" na NPC "budega" ([estrutura])
- [ ] **[estrutura]** Combate no jogo novo, passo 2: as regras da revisão 17 (pedra com carga, defesa com energia,
  esquiva e recuo). Antes, pedir ao dono para jogar o passo 1
- [x] **[dono]** Decisões de 12/11: a **Budega Distribuidora** (o negócio do dono) é a vendinha da praça da Vila do
  Capão, sem a palavra "Tabacaria" e sem produtos de tabaco (a lei proíbe propaganda de tabaco); o nome continua
  **Selva de Pedra**; os saguis são **encantados** pelo desequilíbrio entre os mundos e a missão é acalmar ou
  afastar, não matar (muda a história e o texto, o monstro continua); o ritual de classe na figueira fica para depois
- [x] **[dono]** Câmera (12/11): padrão no **médio** (herói com ~260 px numa tela Full HD e ~14 m de chão na largura),
  e o jogador pode afastar até o **longe** (~185 px, ~20 m). Comparação em `docs/referencias/mapa-01-camera.jpg`
- [ ] **[arte]** Aplicar a câmera decidida no 2.5D (no protótipo: zoom do jogador com padrão 1,0, afastando até 0,7) e
  combinar com o dono o enquadramento no celular (em pé, a tela mostra só uns 6 m de largura) — na `PD.View` já está
  assim; provisório até o dono decidir: aproximar até 1,4 e, em pé, uns 9 m de largura

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
