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
- [ ] **[dono → estrutura]** A velocidade do personagem e dos monstros está boa? (`STEP_MS` em `src/shared/constants.ts`; `passoMs` em `data/monsters.json`)
- [ ] **[dono → estrutura]** Os avisos dão tempo de desviar? (`preparoMs` de cada monstro)
- [ ] **[dono → estrutura]** O dano e a vida estão justos? (`vida`, `dano` nos monstros; `src/shared/progression.ts` para o jogador)
- [ ] **[dono → estrutura]** Subir de nível está rápido ou devagar demais? (`xp` dos monstros e `xpToNext`)
- [ ] **[dono → estrutura]** O Saci está forte demais para quem é nível 1? (ele é para nível 3+ ou para grupo)
- [x] Sons sintetizados (estilingue, acerto, aviso embaixo de você, esquiva, nível, desmaio) — tecla M desliga
- [ ] **[arte]** Música da vila e sons de verdade (gravados ou de banco gratuito)
- [ ] **[arte]** Arte de verdade para personagens e monstros
- [ ] **[arte]** Monstros redesenhados no mesmo capricho dos personagens novos (hoje são 16x16, menores que um jogador)
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
- [x] **[estrutura]** Loja: a **Dona Iracema**, quitandeira do píer, na praça do Refúgio, vende banana, arruda e
  chapéu de palha e compra qualquer item pela metade do preço (`preco` em `data/items.json`; quem vende o quê e
  onde fica em `data/npcs.json`). Clicar nela leva até ela e abre a loja; afastar-se fecha
- [ ] **[arte]** Caprichar a loja e o ouro: moeda desenhada, som de moeda, janela da loja e a aparência da
  Dona Iracema (hoje é o personagem padrão com chapéu de palha)
- [ ] **[mundo]** Uma barraquinha de frutas atrás da Dona Iracema, na praça do Refúgio (ela fica em (46, 28))
- [ ] **[estrutura]** NPCs com diálogo (o Curupira!), com as falas num arquivo de dados
- [ ] **[estrutura]** Missões simples ("derrote 5 Saguis", "traga 3 couros"), também em arquivo de dados
- [ ] **[estrutura + arte + mundo]** Novas lendas: Iara no lago, Boitatá como chefe

## M4 — Social
- [ ] **[estrutura]** Grupo com XP dividido, guilda, troca entre jogadores e mensagem privada

## M5 — Teste fechado
- [ ] **[estrutura]** Servidor na internet (VPS), domínio e HTTPS (a senha passa a viajar criptografada; atrás de um proxy,
  usar o endereço real de cada jogador nos freios de senha)
- [ ] **[estrutura]** Ferramentas de admin (expulsar, banir, avisos) e registros
- [ ] **[dono]** 20 a 50 pessoas jogando juntas

## Ideias para depois (só se o básico estiver divertido)
Caminhos (Capoeirista, Curandeiro, Caçador), crafting, PvP em áreas específicas, chefões, eventos,
noite e dia (lendas da noite), montarias, casas de jogadores.

## Decisões pendentes
- **Nome do jogo** ("MeuMMO" é provisório) — sugestões em DESIGN.md
- **Arte definitiva:** hoje é arte provisória desenhada por código
- **Qual personagem fica:** o da `main` ("Equipamento aparece no personagem e personagem redesenhado") ou o do ramo
  `claude/blissful-meitner-hp1i5e` (camadas e animações)? Os dois fizeram a mesma tarefa ao mesmo tempo; a [arte]
  mostra prints dos dois e o dono escolhe. Seja qual for, o trabalho continua a partir da `main`.
