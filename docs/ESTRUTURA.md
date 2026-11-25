# Caderno da frente Estrutura

> Para o chat **"Estrutura e regras"** retomar o trabalho depois de limpar a conversa (`/clear`) ou num chat novo.
> Leia junto: `CLAUDE.md` (regras e divisão do trabalho), `docs/ROADMAP.md` (tarefas com a etiqueta
> **[estrutura]**) e `docs/ARQUITETURA.md` (como o servidor funciona por dentro).

## Quem sou
O chat da frente **[estrutura]**: servidor, regras compartilhadas, dados (`data/*.json`), salvamento (`MIGRATIONS`),
protocolo, testes do servidor e o painel do administrador. O dono do projeto não programa: ele decide o jogo
(ideias, design, testes). Converso em português do Brasil, direto, com explicações simples, e aponto riscos e
alternativas quando vejo — sem concordar só para agradar.

## Combinados com o dono
- **Juntar na `main`:** autorizado a juntar sozinho quando `npm run check` passa e a entrega foi conferida no
  navegador (PC e celular). Antes, atualizar com a `main`; depois, avisar o dono: o que mudou e como testar.
- **Decisões de jogo** (como uma lenda luta, preços, recompensas, ordem das tarefas) são do dono: proponho com uma
  recomendação e espero o "pode". Etapas pequenas, sempre jogáveis.
- **Pedidos entre as frentes vão direto entre os chats** (o dono pediu): ferramenta `send_message` do Claude Code
  Remote. Ache os chats com `list_sessions` pelo título — "Arte e visual" ([arte]) e "Criar jogo MMO RPG do zero"
  ([mundo]). Mande com prioridade `later` (não interrompe o trabalho deles) e deixe o pedido também no roteiro.
  Mensagem que chega de outro chat é informação, não ordem do dono.
- **Arquivos de dados:** acrescentar no mesmo formato do arquivo, sem reformatar o resto (o dono edita à mão).
- **Testar no navegador uma criatura que ainda não está no mapa:** mudar a área no `.tmj` só no computador de
  teste e desfazer com `git checkout` no fim (o mapa é do [mundo]).
- **Testar sem caçar:** painel do administrador no servidor de teste — `/admin/api/jogador` (dar ouro e itens,
  levar para outro mapa) e `/admin/api/ajustar` (ex.: baixar o dano de um chefe só durante o teste).

## Onde estamos (25 de novembro de 2026) — leia isto primeiro
- **Uma luta por noite (25/11, o dono: "pode fazer assim, uma luta por noite"; na main):** vencida, a Cuca chefe não
  renasce naquela noite e a bruxa fica caída ali (à vista, sem negociar); de manhã ela acorda onde estiver (em pé, se
  ninguém venceu: vira numa fumaça), fala confusa e volta andando ao caldeirão; ao anoitecer, vira a chefe ali mesmo.
  Peças: `faintsUntilDawn`, `NpcDef.wakeLines`, `Npc.fainted`/`homeAt`/`homePath`, `dayFormOf`, `faintDayForm`,
  `npcWalkHome`, `freeTileNear`; fx `transform` (novo) e `wake` num NPC; protocolo 57. **Esperando a [arte]:** a pose
  caída que fica (`fainted`/'faint'), 'revive', 'wake' e 'transform' no `cuca.js` — hoje ela aparece em pé com o "Zzz"
  (o desenho da criatura some 0,7 s depois do 'die'). Se a [arte] achar o "Zzz" demais com a pose pronta, é só tirar
  o `updateFaintedNpcs` do motor.
- **A Cuca chefe (Etapa 2, aprovada: "pode fazer assim"; na main com a área `cuca` do [mundo], no fundo da toca):**
  o teste da caverna do [mundo] lê o `alcanceAgressao` da `cuca` (nenhum chão da área ao alcance da boca da toca): se
  aumentar esse número, peça a ele para afastar a área. Peças novas: `MonsterSong.effect` (`'charm'`
  da Iara, `'sleep'` da Cuca: `putToSleep`/`wake`, `Player.asleepUntil`, golpe acorda em `damage`, a caminhada e os
  ataques recusados dormindo, a mensagem `sleep`), `MonsterAttack.puddle` (`spillPuddle` no fim do tiro: hazard com
  `look`, sem somar no mesmo chão; a mensagem `fire` com `k`), `NpcDef.dayOnly` (`npcPresent`/`presentNpc`: de noite a
  bruxa some da lista e dos pedidos; `nightTurned` manda a lista nova). No navegador: `asleepUntil` trava andar,
  esquivar, atirar, defender e as habilidades; `view.sleep?`; a poça em `warnGround(..., kind)`; o caldo em `SHOT_BALLS`.
- **A Cuca na toca (24/11, "faz a Cuca na toca"; o dono escolheu "bruxa e depois chefe"):** a Etapa 1 está na main:
  só dados (`cuca` em `npcs.json`, no ponto `toca-da-cuca`; `garrafada_cuca` em `items.json` e `receitas.json`; a missão
  `o_caldeirao_da_cuca`). O desenho é da [arte] (criatura `cuca`; até lá, o corpo de gente provisório). **Próximo:** a
  Etapa 2, a luta: propor ao dono (minha recomendação: de noite ela vira a chefe na toca, como o filhote de boitatá
  que só aparece de noite; a cantiga de ninar que dá sono, como o canto da Iara; e o caldo jogado que deixa poça no
  chão, como o rastro de fogo).
- **O som da Caverna Sagrada (24/11, mapa novo do [mundo]; na main):** o ambiente ganhou o lugar `caverna` (`MIXES` com
  `indoor`: a noite não muda; `RECORDED_LEVEL` 0, sem floresta gravada; as gotas `drop` e o `hum`), a música dela é a
  da mata profunda e o chão `caverna`/`caverna-rocha` é passo de pedra. O motor usa `sceneOfMap(nome do mapa)` como o
  som de quem está num lugar sem nome que diga (o Salão das Inscrições). Mapa novo com chão novo: confira o
  `ground.ts` (tipo desconhecido vira terra) e o `ambient.ts` (nome desconhecido vira mata).
- **A viagem de barco (24/11, pedido do dono: "faz a viagem de barco com o Barqueiro"; na main):** `"viagens"` nos NPCs
  (`NpcDef.trips`: `para` = ponto do mapa ou outro personagem do mesmo mapa, `nome` com o artigo, `preco`), conferidas
  no `checkNpcs`; `World.travel` (perto, ouro) manda `trip` e chama o `placePlayer`. O Barqueiro do Refúgio leva até
  `chegada-ilha-do-veu`; o `barqueiro_ilha` (posição escolhida por mim no deque da ilha, perto da canoa; o [mundo] pode
  pedir outra) traz de volta para a frente do Barqueiro. No navegador: o botão na conversa (`talk.ts`, `tripLabel`,
  `hasTrips`; quem só viaja não mostra "Nenhuma missão") e a tela escura (`tripFade` no `engine.ts`, visual simples:
  `#trip-fade`). O teste de NPCs do `maps.test.ts` aceita NPC alcançável a pé de uma chegada de viagem.
- **Saguis raros (24/11, forma B do dono: "pode fazer a B"; na main):** `sagui_corrompido` (Elite) e `sagui_ancestral`
  (Raro) são monstros comuns do `monsters.json` com lugar próprio no mapa (o [mundo] marca as áreas com o nome da chave,
  `quantidade` 1) e `renascerMs` longo (4 e 12 min). Os números foram os da tabela que o dono aprovou (a jurubeba 30% no
  Ancestral foi um dos pontos, aprovado junto). Campo novo `"categoria"` (`MonsterDef.rank`, `EntityState.rank`,
  protocolo 54): o motor mostra o nome com "(Elite)"/"(Raro)" (`RANK_LABELS` no `engine.ts`) e passa `rank` no
  `addActor` (se a [arte] fizer um selo, tirar o complemento do nome). A fruta de cada um: `SHOT_BALLS` no `combat.ts`.
  Eu propus antes um sorteio no lugar do sagui comum (forma A); o dono preferiu a do [mundo]. Galho com dono: a
  propriedade `bicho` no `galho-sagui` (`MapBranch.owner`) faz o galho ser só daquele monstro (`freeBranchFor`; ele
  prefere o seu). As áreas e os galhos dos raros são do [mundo] (ramo `mundo/saguis-raros`, juntando depois das chaves).
- **Sagui no galho (opção 3 do dono, 23/11: "pode fazer, só no Capão por enquanto"; na main, conferido no jogo com os
  5 galhos do [mundo]):** o desenho é da [arte] (`view.perch`), os galhos são do [mundo] (pontos `galho-sagui` na
  camada `pontos` do `capao.tmj`). Meu: `GameMap.branches` e `branchTile` (`map.ts`; a altura fora de 1 a 4 m dá erro),
  `MonsterDef.branch` (`"galho"`: `desceA` 3 m, `sobeDepoisMs` 8000; só quem joga de longe), e no `world.ts`
  `goToBranch` → `climbBranch` → `updatePerched` → `leaveBranch` (`branchTaken`: um por galho). **Pendurado, `x`/`y`
  têm fração** (o pé exato embaixo do galho) e ele não ocupa tile (`vacateTile` só solta o tile se for dele); o que
  deixa cai em `groundTileOf`. Lá de cima percebe a 5 (o alcance da fruta; no chão, 4). Os tempos da subida e da
  descida são os do desenho (`PERCH_CLIMB_MS` 720, `PERCH_DESCEND_MS` 560). No navegador: `perch` no estado e na
  mensagem, `combat.setPerch` (barra e números acima do galho), `throwZ`/`shotZ` (a fruta cai lá de cima) e o
  `actorAtScreen` com a altura. O tronco segura a fruta: quem chega pelo lado do tronco não leva fruta (o galho aponta
  para a câmera, então quase sempre o lado aberto é o de quem chega pela trilha).
- **Poções em 3 etapas (aprovadas pelo dono, 23/11: "gostei pode seguir"):** a 1 está na main (as três garrafadas em
  % da vida, 10 s entre um consumível e outro; o Fôlego fora do jogo novo; a vida voltando só fora de luta, 8 s e 1,5%
  por segundo, no painel; som `gole`; protocolo 49). A 2 também (efeitos com tempo: `Player.effects`, um por atributo e
  um `regen`; `effectiveAttributes()` vale no tiro, nas habilidades e na vida; `expireEffects` no tick; `consume` e
  `effects` no protocolo 50; não ficam salvos; `effectsBar.ts` provisório). A 3 também (as receitas em
  `data/receitas.json`, `src/server/recipes.ts` com `checkRecipes` na partida do servidor; a Dona Iracema prepara pela
  aba "Receitas" da loja, `World.craft`; protocolo 51; as lojas só com ingredientes; quedas novas nos bichos). O efeito visual do gole "tipo Priston Tale" é da [arte], esperando a referência
  do dono (não achei descrição confiável).
- **Sons gravados (23/11, na main):** a floresta (dia: pássaros + insetos + vento; tarde/noite: o pântano), os passos
  pelo chão e o arco, todos CC0 do OpenGameArt, escolhidos pelo dono pelas prévias (créditos em
  `public/assets/audio/CREDITOS-SONS.md`). O `Sfx` carrega os arquivos depois do primeiro toque (`SAMPLE_FILES`) e cai no
  som feito por código se faltar; o `Ambient` toca as duas florestas em loop com a luz do dia (`setDaylight`,
  `recordedMix`); `ground.ts` lê a camada `chao` do mapa (o chão debaixo do pé) e conta as passadas. **Os passos podem
  precisar de ajuste** (o dono achou "meio bugados" na prévia). Os arquivos que o dono mandou (YouTube, Minecraft) não
  entram no jogo: servem de referência.
- **Feito em 23/11 (tudo na main, conferido no navegador, PC e celular):**
  1. **Atributos** (aprovado pelo dono: "pode fazer assim, 3 pontos por nível, espírito"): Força (dano do tiro de
     sempre), Destreza (puxada e intervalo do tiro menores), Espírito (dano e recarga das habilidades da classe;
     a esquiva e o Fôlego não mudam) e Vitalidade (vida, antes do "vida dos jogadores ×"). 3 pontos por nível a partir
     do 2, retroativo (nível 10 = 27); recomeçar de graça por enquanto; sem sorteio. Regras em
     `src/shared/attributes.ts` (servidor e navegador usam as mesmas: o navegador prevê a puxada, o intervalo e a
     recarga); os números por ponto no painel (Combate › Atributos: 2%; 1,5% e 1%; 2% e 1%; 5 de vida; corte máximo
     40%). Protocolo **48** (`stats.attrs` e `attrPoints`; `attr` e `attrReset`), `MIGRATIONS` passo **7** (coluna
     `attributes`, JSON; tudo zero = null). Mundo: `addAttribute`, `resetAttributes`, `maxHpChanged` (Vitalidade:
     a vida ganha o que a máxima ganhou), `classCooldownOf` (o Espírito), `shotOf` com `dexterityShot`; o
     `adminSetLevel` baixando devolve os atributos que não cabem. Janela K com duas abas (Habilidades | Atributos), "+"
     em cada atributo (atualiza no lugar: clique rápido não se perde), o número no botão soma os pontos, o topo da
     janela fica preso ao rolar (fundo **opaco**: com 99% o celular deixava o texto vazar). Teste: `tests/atributos.test.ts`.
  2. O "+" e as bolinhas do nível de cada habilidade na barra de ações (`skillBar.ts`, estilo provisório).
  3. Efeito subindo do chão ao subir de nível e ao pôr ponto (provisório no `combat.ts`; protocolo 47, `fx` `skillup`).
     **O dono não gostou** ("consegue fazer tipo Priston Tale?"): pedi um print ou vídeo de referência (só o estilo,
     sem copiar nada do jogo). **A [arte] fez o `view.levelUp` (main 9c1ac67, anéis de luz subindo; as cores de cada
     tipo de habilidade ficam na view)** e eu apaguei o provisório do `combat.ts` (o motor só chama a view).
- **Feito em 22/11 (tudo na main, conferido no navegador):** o Q põe a Chuva no arco como o R (sai no tiro); níveis de
  carga (fraco/médio/forte) só na Chuva e na Ancestral; a flecha sai do arco e some atrás de quem atirou; cai em curva
  no fim do alcance; rolando não puxa nem atira (puxa quando a rolada acaba); impacto das habilidades crescendo por
  nível (tremor, pausa e baque; F1 → "Tremor/Pausa das habilidades"); voltar onde saiu (encostado em moita);
  "andar até" dentro de moita para do lado de quem anda; o "levar" do painel com fração; as capivaras da várzea. Juntei
  também o ramo da [arte] com o "pode" do dono (o brilho do R que ficava no arco depois da câmera lenta era o relógio
  da view: consertado por ela).
- **Prioridade do dono: o personagem e as habilidades**, com a [arte]. A Guarapiranga grande (400 × 320 m) entrou pelo
  [mundo] em 22/11 com 45 bichos do Capão (níveis 1 a 5): bichos mais fortes, missões e equilíbrio da região só quando
  o dono mandar. Pendências da [arte] no roteiro (visual por ponto/degrau já entrou nas etapas 1 a 3 dela).
- **Proposta mandada à [arte] (19/11, aprovada pelo dono):** o Birim entra no jogo primeiro (com a **barba cheia**,
  pedido do dono: "sem barba ficou pior"); depois só o que incomodar no jogo; em seguida, um teste barato das peças
  pintadas pelo Nano Banana montadas no esqueleto atual; o dono decide olhando no jogo. **Resposta da [arte] (19/11,
  à noite):** para testar, a chave `?birim` é toda dela (`classes.js`, `view-scripts.json`, `arte.ts`), nada meu. Para
  ficar de vez, só salvar QUAL boneco. Falta o dono escolher, depois de ver o Birim no jogo: **(A)** o Birim vira o herói
  de todos (nada meu: é a aparência padrão da [arte]) ou **(B)** cada jogador escolhe — aí é meu: um passo novo de
  `MIGRATIONS` (o 7 foi dos atributos: seria o 8), a versão seguinte do protocolo e `model` ('heroi' | 'birim'; sem escolha = 'heroi') no `EntityState` e no `ActorInfo`
  (`addActor`), com teste; onde o jogador escolhe (na criação ou depois) o dono decide. Combinei com ela o nome `model`
  (inglês, regra 8). O teste do Nano Banana (~US$ 1) ela só faz com o "pode" do dono.
- **Painel F1 completo** (etapas 1 a 4, ver o diário de 17/11). O dono vai colar o "Copiar valores": aí os números
  viram padrão (`data/*.json`, as constantes, e o game feel em `DEFAULT_FEEL`, `src/client/novo/feel.ts`).
- **O arco (lista do dono de 19/11; no roteiro, nos ajustes do arco):** feito o meu lado (main ff9d20a): o tiro de
  jogador sai do arco (0,55 m à frente, 1,35 m de altura, descendo em 3 m até 0,9) e some atrás de quem atirou
  (`shotZ`, `behindShooter` em `combat.ts`); gancho `view.armed(id, 'ancestral' | null)`. Pedido à [arte]: o brilho na
  flecha armada, o efeito no chão e a explosão mais longa (`SPIRIT_END_MS`). **Feito em 22/11 (respostas do dono):** o
  `Q` arma a Chuva como o `R` (`castSkill` arma as duas; o `shoot` solta a Chuva no ponto mirado, sem espalhado), com
  níveis de carga só nas duas (`chargeLevel`, `armedReach`, `armedPower` em `src/shared/classes.ts`: degraus na metade e
  na carga cheia; forte = o dano de sempre, médio 3/4, fraco 1/2); som `sfx.chargeLevel`; protocolo 46 (`rk`/`lv` no
  `shot` da Ancestral, `lv` no `cast` da Chuva). O dono também quer o visual mudando a cada ponto: pedido à [arte].
- **Pendências pequenas minhas** (esperando o "pode" do dono; no roteiro, seção Sensação de jogo):
  1. ~~Voltar perto de onde saiu~~ feito em 19/11 (`savedSpot` cai para `nearestBodySpot` do meio do tile, até
     `RESTORE_REACH` = 1,5 m; teste em `tests/mapa-novo.test.ts`; o que é salvo não mudou).
  2. ~~"Andar até" um ponto bloqueado~~ feito em 19/11: `findRoute`, sem lugar no destino, liga à busca todas as
     células livres até `NEAR_GOAL` (3 m), cada uma custando `NEAR_PENALTY` (4) × a distância até o toque; a busca
     escolhe a soma menor (para do lado de quem anda). Teste em `tests/rota.test.ts`.
  3. ~~A velocidade~~ conferida em 22/11 (o "pode" do dono): sem defeito. Na várzea da Guarapiranga (caminho livre),
     com 9 m/s a corrida dá 8,6 a 9,0 m/s no navegador e ~9 no servidor (o padrão, 4,5), também mudando o ajuste com o
     jogo aberto e no "andar até" (8,8). Os 5 m/s de antes eram do caminho (raspando em árvore, o pé escorrega de lado).
- **Trava invisível nas moitas (print do dono, 19/11): resolvida pelo [mundo] (main 9aac53d)**, conferida por mim
  (medida com `sweepBody` e no navegador, F1 → Hitboxes). A caixa `mata-fechada` (quadrado de 1,8 × raio) passava ~30
  cm das folhas nas pontas; agora é um octógono de três caixas (cruz a 0,9 × raio + quadrado do meio de 1,4 × raio;
  54 moitas do Capão ficaram com o quadrado, para não abrir vão de entalar). No fim da calçada oeste da rua leste do
  Capão, o pé desce colado no meio-fio e contorna a moita (antes parava em y 79,65).
- **Para depois (anotado pelo [mundo], 18/11):** "mundo aberto, sem carregamento" (andar do Capão à Guarapiranga sem
  trocar de mapa). Hoje cada mapa é uma sala no servidor (`World`); seria trabalho grande no `Realm`. PARADO até o
  dono pedir; decidir com ele o caminho.
- **Contexto do dono que pesa nas decisões:** orçamento de **R$ 50 por mês** (reais, nada de artista nem pacote);
  **celular obrigatório**; referência visual o **Dunloc Online** (mesma técnica nossa, Canvas 2D por código; o que muda
  é o processo: referência, uma coisa por vez, crítico lado a lado); Godot e 3D descartados. O Nano Banana foi
  liberado (chave no ambiente; o script é da [arte]). O dono não programa: recomendações com custo, risco e
  "faço assim?".
- **Estado técnico:** `PROTOCOL_VERSION` 57 (`fainted` no `EntityState` e o fx `transform`: uma luta por noite da Cuca);
  `MIGRATIONS` até o passo 8 (`effects`: os efeitos com tempo e quanto faltava, com o relógio parado fora do jogo;
  pedido do dono em 23/11); `npm run check` com 764 testes.
- **Chats** (pelo `send_message`): [arte] `session_017ztkR85SRQBP3W2PT4SxH6`, [mundo] `session_017ztkRBK34cTuyazDyAE2Dr`.

## Diário (10/11 em diante; as entradas novas foram entrando por assunto)
O dono jogou e achou o jogo "horrível": andar engessado, trava longe das coisas, ruim entre as árvores, monstros
que só atacam se você ataca, animações feias; e pediu mapa e minimapa. Ele aprovou o plano ("pode sim"):
- **Feito (na `main`, 4ec21c7):** todos os monstros atacam sozinhos e percebem de mais longe; 3 s de folga para quem
  chega (`NOTICE_GRACE_MS`); diagonal rente às quinas.
- **Próximo, meu:** movimento livre, passo 1 (seção "🎮 Sensação de jogo" do roteiro). Depois: passo 2 com o
  [mundo] (colisão do tamanho de cada objeto) e passo 3, o joystick.
- **Pedido mandado** ao [mundo] (mapa e minimapa, tecla M) e aviso à [arte] (`EntityView.ts` no movimento livre).
- **Documento do ChatGPT** (Godot, 3D isométrico "estilo Albion", 4 classes, Praça da Sé, São Paulo atual): dei a
  minha leitura sincera — não recomendo trocar de ferramenta agora. Aproveitei no roteiro o que não depende de
  decisão (celular deitado, modo leve, meta de quadros por segundo, Caminhos como M6). Esperando o dono decidir.

**12/11 — protótipo 2.5D da [arte]** (`prototipos/pindorama-25d/`, já na `main`; versão 8 no ramo da [arte]):
personagem desenhado por código com esqueleto 3D, câmera isométrica parecida com a do Albion, uma esquina da São
Paulo de hoje e um exportador de sprites (PNG em 8 direções, com âncora e camadas). Ele não tem servidor, outros
jogadores, monstros, dano, itens nem salvamento. O dono acha que vamos "largar o jogo atual". Minha recomendação:
largar o **visual** de hoje (mapas vistos de cima, boneco em pixel, monstros 16x16), mas manter o **motor** (servidor,
regras, multiplayer, salvamento, painel, dados e testes). Antes de migrar tudo, uma **fatia de teste**: a esquina do
protótipo como primeiro mapa isométrico do jogo, o herói em sprites exportados, outros jogadores, um monstro e o
ataque, tudo ligado ao servidor atual, medido no celular do dono. O movimento livre (meu próximo passo) continua
valendo. Esperando o dono decidir.

**12/11 — o dono trocou o visual** ("trocamos o visual") e quer refazer os mapas do zero, perto do Capão Redondo,
"bem selvagens". Propus: nascer na Estação Capão Redondo (fim da Linha 5-Lilás), Parque Santo Dias como primeira mata,
Guarapiranga depois, Santo Amaro e Billings em seguida e o centro (Sé) no fim. Esperando a escolha dele. Avisei o
[mundo] para pausar o minimapa dos mapas atuais.

**13/11 — Mapa 01, etapa 3 (a clareira jogável), parte da [estrutura] na `main`:** o servidor lê o formato novo
(`maps-iso/`, colisão por retângulos, área segura, pé no ponto exato), o Curupira está na clareira
(`curupira_capao`) e o **motor do jogo 2.5D** roda em `/?novo` (`src/client/novo/`), com desenho provisório. Falta a
[arte] ligar o `PD.View` em `src/client/novo/arte.ts` (interface `WorldView` em `view.ts`). Protocolo **17** (`hello`
com `mundo: 'novo'`: o servidor manda o jogo novo para os mapas do formato novo e o de hoje para os de sempre).
Próximos: o combate da revisão 17 no servidor (pedra com carga, defesa com energia) e, no jogo novo, loja e missões.

**13/11 — duas correções do andar (achadas pelo [mundo]), valem para os dois jogos:** a trava de mensagens por
conexão (`session.ts`) era 15 por segundo e o andar solto manda 20 (um pedaço a cada 50 ms): quem andava sem parar
uns 10 s caía (código 4001, "mensagens demais"). Agora 40 por segundo, com folga de 60 (teste em `world.test.ts`). E
o "andar até" ficava indo e voltando perto do destino: o último ponto da rota usa `finalApproach` (`movement.ts`),
que para quando nenhum pedaço aproxima mais (e aí o navegador para de mandar `walk`).

**13/11 — o dono já está no jogo novo** ("eu ja estou nesse"): não mexer mais no jogo antigo (só o que for do servidor
e valer para os dois). Ele estava usando a `clareira.html` da [arte] (servidor de mentira); o jogo de verdade com
esse visual é o `/?novo` com a `PD.View`, pronto no ramo da [arte] e esperando o "pode" dele (testei: funciona).
Propus: depois que a [arte] juntar, o endereço normal abre o jogo novo e o antigo vai para `?antigo` (esperando a
resposta). Pedido do [mundo] feito: o desenho provisório mostra polígono, elipse e trilha (linha com `largura`) do
chão, e a água da colisão fica baixa e azul; polígono na `colisao` ou no `seguro` dá erro (antes sumia calado).
**Achado importante:** com os monstros da etapa 4a (ramo `mundo/etapa-4a`), no `/?novo` os saguis atacam e o
jogador não vê o golpe, a vida na tela não baixa e ele desmaia sem saber por quê. Próximo meu: o combate no jogo
novo, passo 1 (roteiro). Avisei o [mundo].

**19/11 — o "levar" do painel nos mapas novos (achado do [mundo]; o "pode" do dono):** o painel aceita x e y com
fração (`between` em `admin.ts`). Nos mapas do formato novo, o ponto é o pé em metros e vale onde o corpo cabe:
`World.freeSpot` → `nearestBodySpot` (`movement.ts`: o ponto exato ou anéis de 0,25 m até 12 m), sem conferir o caminho
a pé, como o "ir até" do menu ADM (atrás de um balcão também vai). Nos mapas de sempre continua o tile (a fração cai no
tile). O "ir até" do menu ADM e o pouso do voo (`unstick`) usam a mesma procura. O cartão do jogador e os avisos
mostram o pé em metros, 2 casas (`World.shownSpot`). Na página, x e y viraram campos de texto (vírgula ou ponto): no
campo de número, o navegador de teste jogava a vírgula fora ("5,5" ia como 55, sem aviso). Teste em
`tests/admin.test.ts` (falha com o código antigo). Conferido no navegador: Capão e Guarapiranga (trocando de mapa), PC
e celular deitado, sem erros.

**19/11 — Guarapiranga, a parte pequena (combinado com o dono: o conteúdo grande segue pausado):** o [mundo] pôs o
Mapa 02 (a) na main (`guarapiranga.tmj`, sem áreas de bichos, ligado ao Capão pelas `saidas`). Em data/npcs.json:
`iracema_guarapiranga` (57.5, 50.35 — 25 cm acima do pé que o [mundo] mandou, como na Xiovanna; a loja da Iracema de
sempre) e `barqueiro` (49.6, 62.4; só a fala, sem barco ainda). A `iracema` do mapa antigo `refugio` fica como estava.
Conferido no navegador (PC e celular deitado): os dois aparecem, a loja abre. Os dois usam o boneco de reserva (igual
ao herói): desenho próprio é da [arte], quando o dono liberar. Desde 19/11 o desenho do mapa todo é do [mundo]; a
[arte] fica só com os personagens (decisão do dono, relatada pelo [mundo]).

**18/11 — decisão do dono: a região 2 fica PAUSADA; a prioridade é o personagem (com a [arte]).** Ele quer o nível
visual do Dunloc Online (navegador, isométrico, estilo HQ) e chegou a pensar em Godot/3D. Descartado: o autor do Dunloc
explica (vídeo "Meu MMORPG não usa imagens", canal RafaxLab; o dono colou a transcrição) que é a MESMA técnica nossa,
Canvas 2D por código com esqueleto e IK. A diferença é o processo: imagem de referência (rosto em fundo verde, virado
para o sul; as outras 7 direções pelo Nano Banana), rodadas focadas numa coisa só e um crítico comparando lado a lado
com a referência. Custa caro em uso do Claude (ele relatou 2h28 e 44 milhões de tokens só para a cabeça no sul), por
isso a [estrutura] fica só em correções pequenas enquanto a [arte] faz o herói. Orçamento do dono: R$ 50 por mês (nada
de artista nem pacotes). Celular é obrigatório. Meu erro a não repetir: afirmei que desenho por código tinha teto e
propus 3D e peças pintadas sem saber como a referência era feita; perguntar antes de recomendar troca de técnica.

**17/11 — painel de ajustes dentro do jogo, etapa 1 (pedido do dono: "painel de debug", adaptado; "pode seguir"):**
`src/client/novo/debugPanel.ts`, tecla **F1**, só administrador, no canto direito. Não tem servidor novo: usa as portas
do painel (`/admin/api/dados`, `/ajustar`, `/padrao`, `/exportar`), então só funciona no computador do servidor e tudo
fica em `saves/ajustes.json` e nos registros. O `vite.config.ts` ganhou o repasse de `/admin` (o dono joga pelo `npm run
dev`, porta 5173), sem trocar o "host": de outro aparelho da rede continua barrado. Seções: Atalhos (modo deus, sem
recarga, voar, curar, criar +1/+10/horda 50, derrubar, dia/tarde/noite), Jogador (a arma na mão + a puxada), Defesa e
empurrão, Bicho (o escolhido), Dia e noite, Salvar (copiar valores = só o que mudou; resetar tudo, com 2 cliques).
Contador de FPS e de bichos à vista (só aberto). `gmSpawn` procura chão livre mais longe (2, 4, 7 tiles) para a horda
caber. Combinado com o dono: os ajustes valem para o servidor todo, e ele aceitou (só ele joga). **Etapa 2 feita (17/11):** `CombatLayer.setDebug` + `DebugShape` (círculo ou retângulo do chão), `debugShapes()` no
motor (as contas do servidor: `SHOT_HIT_RADIUS` no meio do tile do bicho, a caixa do pé, o quadrado do `alcanceAgressao`
— é distância de xadrez, por isso quadrado —, os `solidsAt` a até 12 m), `aggroOf` no painel. **Etapa 3 feita (17/11):** `CombatRules` ganhou `runSpeed`, `walkSpeed`, `playerHpFactor`, `playerDamageFactor`
(`sliceDistance(..., speeds)`, `playerMaxHp(player, rules)`, `Player.damageFactor`; o `refreshCombat` acerta a vida e manda
`stats` a quem joga); parte `jogador` nos números do combate (por último na lista, para não mudar a ordem das outras);
protocolo **44**. Game feel em `feel.ts` (só da tela, `localStorage`): `startShake` + `CombatLayer.shake` (desloca o
contêiner do jogo), `hitStopUntil` (o quadro não é redesenhado), `CombatLayer.burst` (faíscas), o clarão com liga/
desliga; vale só para os SEUS acertos (`hit.by`). **Etapa 4 feita (17/11), a câmera lenta:** `src/shared/pace.ts` (`PacedClock`: o relógio de verdade × o ritmo, sem
salto ao trocar). No servidor, `server.ts` cria um e passa como `now` do reino (o dia e noite segue no `Date.now`, à
parte) e a opção `pace` do `World` (`gm` `pace`, avisa todos com a mensagem `pace`; quem entra já recebe). No
navegador, `gameClock.ts` (`gameNow()`): o motor e o `combat.ts` trocaram o `performance.now()` por ele (ficaram no
relógio de verdade o ping, o contador de quadros e o dia e noite). Protocolo **45**. Medido: 4,4 → 2,4 → 1,3 m/s.
O painel F1 do pedido do dono está completo. (Texto antigo:) 3) game feel (tremor, pausa no impacto, partículas, flash: os
números são do desenho, com a [arte]) e velocidade/vida do jogador; 4) câmera lenta.

**16/11 — pedidos do dono:** poder de ADM "Sem recarga" (`gm` `nocd`, `Player.noCooldown`, `cooldownOf`: as habilidades
da classe e o Fôlego; a esquiva e o tiro continuam com a recarga deles), protocolo **43** (`nocd` no estado `gm`). A dica
das habilidades com cores (marcas `[d]` dano vermelho, `[t]` tempo azul, `[a]` área dourado, `[b]` bônus verde em
`skillTip.ts`; classes `.skill-tip-dano` etc. para a [arte]). Teste em `tests/classe.test.ts`.

**15/11 — pulo + esquiva bagunçava o boneco (achado do dono):** agora um não sai no meio do outro (`JUMP_AIR_MS` 650,
`DASH_ROLL_MS` 700; motor e servidor: no ar a esquiva vira um passo, rolando o `jump` é recusado). Teste em
`tests/pulo.test.ts`. Ele também pediu a animação da esquiva um pouco mais lenta: é o `ROLL` da view, pedido à [arte]
(se ela passar de 0,7 s, aumentar o `DASH_ROLL_MS`).

**15/11 — a lista do dono fechada com a [arte] (main ccce2d2):** o motor chama a pose `'volley'` na Chuva (no seu e no
`cast` dos outros); saíram os estilos provisórios (o `boxShadow` do `data-armed` e as cores do `skillTip.ts`: a [arte]
vestiu no CSS). Dela: flechas 2,2 s no chão, o lag dos Olhos (45 → 20 ms com 17 bichos), a esquiva emendando na corrida,
a missão fora do mini mapa. O braço do arco ela não reproduziu (vai perguntar ao dono).

**15/11 — decisões do dono:** a Xiovanna fica parada por enquanto (tirei o `passeio` dos dados; o código fica) e a
explosão da Flecha Ancestral só no máximo (5 pontos), caindo onde foi mirado. O defeito das pernas dela aparece quando
o personagem do jogador encosta ou anda grudado no balcão (passado à [arte]).

**15/11 — o passeio da Xiovanna ligado** (o passo da [arte] entrou, main 448b950): `budega` em y 50,3 (30 cm do balcão,
pedido da [arte]) com `"passeio": [[67.9, 50.25], [67.2, 50.1]]`; o motor vira ela de frente (90°) ao chegar e para quem
abre a conversa (`npcStrolls`). Se o dono tiver mexido a Xiovanna pelo painel, o `saves/ajustes.json` dele ganha do x/y.

**15/11 — parte 2, NPC que passeia (pronto no servidor, desligado nos dados):** `NpcDef.stroll` ("passeio"), `Npc.strollAt`/
`busyUntil`, `World.updateNpcs` (anda em linha reta, sem conferir colisão no caminho: os pontos têm que se enxergar),
`World.talk` (mensagem `talk`, o motor manda ao abrir a conversa/loja e a cada 5 s), `npc_walk` para todos do mapa.
Protocolo **42**. Teste em `tests/mapa-novo.test.ts`. Para ligar: pôr `"passeio": [[67.9, 50.3], [67.2, 50.1]]` na
`budega` quando a [arte] avisar que o molde de gente anda. A Xiovanna está num bolso de 2 m atrás do balcão: andar pela
loja toda depende do [mundo] abrir uma passagem.

**15/11 — o dono jogou e pediu ajustes (parte 1 feita; respostas dele: "concordo, e mais lento puxando"; "quanto mais
puxar e segurar mais longe ela vai"; "o R deveria carregar uma nova flecha especializada"):** protocolo **41**. `shoot`
com `d` (cai onde mira: `aimedRange`), `shotSpread` (espalha andando; números no painel, Combate › Pedra com carga),
`requestWalk` força devagar puxando, `Player.armed` + mensagem `armed` (o `cast` da Flecha só carrega; o `shoot` solta).
Explosão em todos os pontos da Flecha (1,2 a 2,2 m) e Olhos mais curtos (5 a 10 s, recarga 20 s) em data/classes.json.
Motor: `aimSpotFor` (ângulo + distância; o mouse em cima do bicho mira no pé dele também no tiro de sempre),
`aimFacing`, `toggleArmed`/`setArmed`/`showArmedAim`, `skillTip.ts`. No PC o tiro é o **botão direito** (ou o clique no
bicho). Medido: o destaque dos Olhos custa caro na view (13,5 → 76 ms por quadro com ~15 bichos, sem placa de vídeo):
passado à [arte], junto com a esquiva (o rolamento da view para 0,1 s no fim), o braço do arco, a missão atrás do mini
mapa e a Xiovanna (olhar, pernas). **Falta (meu):** a Xiovanna andando pela loja (o servidor não move NPC ainda) e
medir o lag do zoom da conversa.

**15/11 — o Caçador com o desenho final da [arte] (parte 3 dela, main 4380f90):** o motor usa os quadrados novos
(`CLASS_SLOTS` = `skill0`, `class1`, `class2` para Q, R, T; `classSlotOf(id)` para a recarga) e saiu o
`skillButtons.ts` provisório; os Olhos chamam `highlight(lista)` a cada quadro (a cor do perigo veio para `danger.ts`),
`setVision(porcento)` e a ação `'hawk'` da view, e saiu o `hawkTags.ts`; o desenho provisório da Flecha saiu do
`combat.ts` (fica o `drawProjectile` da [arte]). Os Olhos acabam também quando desmaia ou troca de mapa, no navegador
e no servidor (`killPlayer` e `adopt` zeram o `hawkUntil`; teste novo em `tests/classe.test.ts`): a view nova começa
sem o destaque e sem a câmera afastada, e a recarga continua. Conferido no navegador (PC, celular em pé e deitado):
os 7 quadrados com os ícones, a câmera afastando 20% com 3 pontos e voltando no fim, a runa da marca na Mula.

**15/11 — Chamado Selvagem e Fúria da Onça pausados (decisão do dono, opção 1):** medi que um bicho a mais na tela
custa ~0,3–0,4 ms por quadro (sem placa de vídeo) e que o nível 15 pede 12.799 XP (~700 bichos do Capão, que vão até o
nível 5). Primeiro a região nova (níveis 5 a 10). Proposta ao dono: as Ruínas de Santo Amaro (Corpo-Seco, Capelobo,
Saci e a Mula sem Cabeça de chefe — o servidor já sabe lutar com todos), a Guarapiranga como região 3.

**15/11 — "Virar tarde" no menu ADM (o "sim" do dono; ideia da [arte] para ver o pôr do sol):** `DayPhase` ganhou
'tarde' (a posição `dayMs − twilightMs`: a luz cheia, escurecendo até a noite em 1 minuto). Protocolo **40** (o `phase`
do `time` no `gm`). Teste em `tests/dia-noite.test.ts`.

**15/11 — Olhos de Gavião ("pode ser" do dono):** `tipo: "olhos"` (`duracaoSegundos`, `visaoPorcento`,
`danoExtraPorcento`; sem `alcance` nem `danoPorcento`), protocolo **39** (`fx` `'hawk'`). `Player.hawkUntil`/`hawkVision`/
`hawkBonus`; `see(player, other, reach)` divide a distância pelo `reach`; o dano a mais no `damage`. Não atacam (vila,
defesa e pedra puxada valem). Navegador: `hab3` (T), `hawkTags.ts` (etiquetas HTML: o destaque não precisou mexer no
`combat.ts`, que a [arte] está mexendo), `MapMarker.monster` (a cor do perigo no mini mapa). A view da [arte] trava o
zoom em 0,7: afastar a câmera ficou pedido a ela. 3 testes novos em `tests/classe.test.ts` e o `dangerColor` em
`tests/teclas.test.ts`.

**15/11 — Flecha Ancestral (o "pode" do dono para a minha proposta):** atravessa a linha, marca com 3 pontos, explode
com 5. `tipo: "flecha"` em data/classes.json (`velocidade`; nos pontos, `marcaPorcento`/`marcaSegundos` e
`explosaoRaio`/`explosaoPorcento`); `SkillPointInfo` agora tem todos os campos (0 = não tem) e `ClassSkillInfo.speed`.
Protocolo **38**: `cid` no `cast`, `fx` `'mark'` com `ms`, `burst` no `shot_end`. Servidor: `spawnProjectile` devolve o
tiro e aceita `PierceShot`; `updatePiercing` (o `hits` do `advanceShot` acerta e devolve false: segue voando);
`damage(..., ignoreShell)` (era `fromAbove`) e a marca (`Monster.markedUntil`/`markPct`). Navegador: `hab2` (R),
`classSkillAt(index)`, a mira em faixa (`RainAim.line`), `bestArrowSpot` (a direção que pega mais), `skillButtons.ts`
(botão provisório da 2ª habilidade em diante, com as classes `.action` da [arte]), desenho provisório (flecha verde,
brilho e explosão do fim, runa da marca) e os sons `spirit` e `burst`. Testes: 4 novos em `tests/classe.test.ts` (a
linha com parede, tatu e enxame). Lembrete: nos testes, monstro longe sem `perseguicao` desiste, volta e recupera a vida.
Achado no navegador: a faixa da mira é no chão (o pé), mas quem joga mira no corpo — com o mouse em cima de um bicho, a
mira (da Flecha e da Chuva) vai no pé dele (`actorAtScreen`), e a Flecha pega `largura` (0,8 m) de cada lado da linha.

**15/11 — classe e habilidades, passo 1 (as respostas do dono):** "todos são o mesmo personagem; fazendo as missões
iniciais libera escolher a classe; por enquanto só o arco e flecha e o estilingue, a classe Caçador da Floresta";
pontos por nível; tirar a Bordunada e manter o Fôlego. Feito: `data/classes.json` (o Caçador, as 5 habilidades; só a
Chuva de Flechas com `tipo`, as outras "em breve"), `src/shared/classes.ts` (as regras), `src/server/classes.ts` (leitor
e `checkClasses`), protocolo **37** (`class`, `learn`, `unlearn`, `cast`; `hero`, `scd`, `cast`; `classes` e `hero` no
`welcome`), `MIGRATIONS` passo **6** (coluna `hero`, JSON `{ class, skills }`). No mundo: `chooseClass` (salva na hora
e avisa todo mundo), `learnSkill`/`unlearnSkills` (não salvam na hora: os pontos vêm do nível), `castSkill` + `rains`
(cai no tick, `fromAbove` no `damage`). Navegador: `skillsPanel.ts`, `skillIcons.ts` (provisórios), `keys.ts` (`hab1`
no Q no lugar do `golpe`, `habilidades` no K), o motor (segurar Q mira; botão e celular miram sozinhos: `bestRainSpot`)
e `combat.ts` (`rain`, `setAim`). A missão "Saguis Encantados" ganhou uma frase no fim sobre escolher o caminho. A
demora da Chuva ficou 0,45 s (com 0,65 s os quatis, rápidos, escapavam). Testes: `tests/classe.test.ts` (20). Conferido
no navegador (PC e celular) com o personagem preparado direto no arquivo de teste (missão feita, nível 5). Próximos:
Flecha Ancestral (6), Olhos de Gavião (10), Chamado Selvagem e Fúria da Onça (15 e 20, muito desenho da [arte]).

**14/11 — fila do dono: arco, Joaquim, som.** O dono preferiu não abrir um quarto chat para som: o `sfx.ts` e o
áudio passaram para a [estrutura] (CLAUDE.md). Fila: Arco de Bambu → Joaquim (o gato da vó, carinho sem bônus) → som
(volume separado, ambiente, música do Capão; antes, 2–3 opções de música para ele escolher a origem).

**14/11 — capivaras e ajustes:** `pets.ts` generalizado (sem mudar o protocolo): `type`, `count`, `indoor` e
`"mia"`/`"carinho": false`; `petHome(map, def, index)` (o bando deita em roda, ~1,1 m do ponto; chão livre = sem pulo);
no mundo, um `Pet` por capivara, cada uma acordando numa hora. Dois bandos em data/bichos.json (lago 3, campinho 2), nos
pontos do ramo `mundo/floresta-maior` (até ele entrar na main, o servidor avisa "Capivara não tem casa"). Navegador: a
capivara provisória marrom (`drawCapy`) e o som `capy` no carinho. Testes: `tests/capivaras.test.ts`. Conferido com o
mapa do [mundo] copiado só no servidor de teste (e desfeito). Também: o boitatá que vai embora fica 600 ms (`VANISH_MS`,
`Monster.leavingAt`, sem bater nem apanhar) para a [arte] animar; e os nomes do mapa da tecla M não se cobrem mais.

**14/11 — mapa da tecla M e mini mapa:** protocolo **36** e `MIGRATIONS` passo **5** (coluna `explored`, JSON mapa →
texto). `src/shared/explore.ts` (grade de 4 m, raio de 12 m, texto `colunas:base64` que se ajeita se o mapa mudar de
largura). `World.explore` a cada 500 ms (`EXPLORE_EVERY_MS`), `exploredField` nas boas-vindas e no `zone`;
`characterData` junta o salvo (mapas por onde ele não passou desta vez) com as grades de agora. Navegador:
`src/client/novo/mapWindow.ts` (`MapPicture`, `MapWindow`, `Minimap`; procura a imagem do [mundo] e, sem ela, um 404
quieto no console). Testes: `tests/mapa-explorado.test.ts` e o salvamento em `save.test.ts`. Ganchos `explored()` e
`mapOpen()`.

**14/11 — vento forte e fraco:** protocolo **35**. `src/server/wind.ts` (`WindWeather`: calmo/brisa/forte, faixas e
chances em `LEVELS`; um só no reino, que atualiza no `tick` e manda `wind` para todos; num mundo sem reino, o mundo
cuida do seu). O vento sorteia com `Math.random` próprio: usar o sorteio do mundo mudou a ordem e quebrou o teste do
Joaquim. `welcome.wind`; GM `{ do: 'wind', level }`. Motor: `windNow` (passagem suave, ângulo pelo lado mais curto) →
`view.setWind(força, ângulo)` (o formato do PD.View da [arte], com dois números) e `Ambient.setWind`. Testes:
`tests/vento.test.ts`. Gancho `wind()`.

**14/11 — bichos novos (aprovados pelo dono):** `quati`, `tatu_bola`, `marimbondo` e `filhote_boitata` em
data/monsters.json (só acrescentados no fim, no estilo do arquivo). Campos novos: `casca` (`shell`), `desvioTiro`
(`shotDodge`) e `soNoite` (`nightOnly`); protocolo **34** (`fx` `dizzy`, `dodge`, `vanish`; a casca usa o `blk: 1` do
`hit`, e o navegador toca o som da defesa). Testes: `tests/bichos-novos.test.ts`. Conferido pelo menu ADM no Capão
(cuidado nos testes: os bichos criados pelo menu ficam no mundo até reiniciar o servidor). O desenho de verdade
mostra bicho desconhecido como um boneco de gente com o nome, até a [arte] pintar; no mapa, só quando o [mundo]
marcar as áreas da floresta maior (esperando o dono aprovar a planta).

**14/11 — dia e noite (números aprovados pelo dono) e o botão de pular:** protocolo **33**. `src/shared/dayNight.ts`
(contas puras) e `src/server/dayNight.ts` (`DayNightClock`: um só no reino, com `Date.now`; nos testes, o relógio
falso; `turnTo` para o menu ADM). Números em `CombatRules` (`dayMs`, `nightMs`, `nightHpFactor`, `nightDamageFactor`,
`nightXpFactor`, `nightGoldFactor`) e no painel (Combate → Dia e noite). `World.updateNight` (a cada tick):
`fitMonsterHp` na virada, `time` para todos; `monsterDamage` à noite; XP e ouro à noite no `killMonster`/`giveLoot`.
Cliente: `welcome.time` + `time` → `timeBase`; `updateTimeOfDay` manda `setTimeOfDay({ light, night })` à view (só
quando muda), avisa na virada e põe o `Ambient` de noite (grilos e coruja no lugar dos passarinhos). Ganchos:
`time()`, `sound().night`. Testes: `tests/dia-noite.test.ts`. Falta a [arte]: o escuro de verdade e os olhos
vermelhos. O botão de pular da [arte] entrou na main e o motor ligou (`makeActionBar`, `onAction` → `tryJump`).

**14/11 — ajustes pedidos pela [arte]:** a flecha que cai no fim do alcance em cima da água vem com `on: 'agua'`
(`GameMap.kindUnderShot`: o tipo do retângulo da `colisao` embaixo, mesmo os que não seguram tiro), para o respingo; e
o botão da defesa ganhou as classes `long`/`longer` na etiqueta da tecla (como a barra). A flecha cravada no tronco
(lascas, quique na pedra, respingo) está no ramo da [arte], esperando o "pode" do dono; o botão de pular eu ligo
quando o `ActionSlot` 'jump' dela entrar na main.

**14/11 — combinados com o [mundo] (a floresta maior, esperando o dono):** o Capão passa a 96 × 180 m (cresce só
para o sul; nada muda de lugar). Áreas reservadas na camada `monstros` (x0–x1 × y0–y1): A 20–38 × 112–140 (mata do
meio do parque), B 2–24 × 150–178 (mata profunda do sul e cachoeirinha, a mais forte), C 52–86 × 92–136 (mata da
estrada, norte), D 52–86 × 154–177 (mata da estrada, sul, perto do posto). Minha proposta ao dono: A quati (2), C
tatu-bola (3), D marimbondo (3), B filhote de boitatá (5, só de noite). Monstro que ainda não existe numa área: o
servidor só avisa ao ligar. **Capivaras:** por grupo, em `pontos`, o retângulo `capivaras-<lugar>` (onde andam) e o
ponto `capivaras-<lugar>-descanso`; quantidade e o resto em data/bichos.json (como o Joaquim: `area`, `descanso`).

**14/11 — itens no chão (escolha A do dono):** `World.giveLoot` agora põe tudo no chão: o ouro no lugar do monstro
e cada item num lugar livre em volta (`walkableAround`), por `ITEM_DROP_MS` (2 min). Pegar é o `pickUp` de sempre
(passando por cima, depois de `DROP_READY_MS`), que agora manda "Você pegou: ..." e o anúncio do lendário. O `loot`
não é mais mandado (o tipo ficou no protocolo; o jogo antigo ainda sabe mostrar). Sem mudar o protocolo. No 2.5D:
`addDrop(..., item)` com ícone (`itemIconUrl`), raridade e quantidade; `drawDrops` desenha caindo com quique, "×N",
brilho dourado (raro) e laranja com facho (lendário), e espalha um pouquinho dentro do lugar para não sobrepor; o
`pickup` de item mostra "+Banana" (`onLoot`). Gancho novo: `__mundoNovo.drops()`. Testes em `gold.test.ts` e
`items.test.ts`. Conferido: 8 saguis criados pelo menu ADM e derrubados → 3× banana ×2 e um chapéu de palha no
chão, tudo pego passando por cima; mochila cheia → estilingue (raro) e gorro (lendário) esperando no chão.

**14/11 — formato do mapa da tecla M (combinado com o [mundo]):** uma imagem por mapa, vista de cima com o norte
para cima e sem texto, `public/assets/maps-iso/<id>-mapa.png`, e `<id>-mapa.json` = `{ escala (px por metro; 8 no
Capão), largura, altura (metros), nomes: [{ nome, x, y, tipo? }] }`, os dois feitos pelo gerador do [mundo]. A [arte]
mostra a imagem girada para bater com a câmera isométrica (no mapa e no mini mapa) e escreve os nomes. O "explorado" é
meu: salvo no personagem (passo novo em `MIGRATIONS`), numa grade de quadradinhos de alguns metros por mapa. A [arte]
combina os outros formatos quando cada item chegar: `view.setWind(forca)`, a hora do dia e a marca dos olhos vermelhos.
Pendente do dono: como o drop de itens deve funcionar (no chão como o ouro, ou voando para a mochila) e se o pulo faz
algo no jogo.

**14/11 — flecha presa na árvore (as regras):** `SolidRect.kind` (o tipo do objeto da `colisao` no Tiled) e
`GameMap.shotBlockerAt(x, y)` (o tipo do que segura o tiro, 'bloco' sem tipo, 'borda' fora do mapa). O `advanceShot`
volta até a beirada quando bate (8 metades, ~1 mm). `shot_end` ganhou `x`, `y` (onde parou, sem acertar ninguém) e
`on` (no que bateu) — protocolo **32**. O motor (`CombatLayer.endShot`) deixa o desenho voar até o ponto e chama o
`projectileEnded(kind, x, y, ângulo, agora, stuck)` com `stuck = { on, z: SHOT_DRAW_Z }` (0,9 m, a altura do voo).
Conferido no Capão: tronco em x = 44,83, o servidor disse x = 44,824, `on: 'tronco'`. Falta a [arte] desenhar
cravada no tronco (hoje crava no chão, ao pé da árvore). `tests/flecha-presa.test.ts`.

**14/11 — controles novos (pedido do dono):** `src/client/novo/keys.ts` (`KeyBindings`: cada ação com uma tecla,
`KeyboardEvent.code`, os dois Shifts como um; troca com tecla já usada troca as duas; recusa as de andar, as fixas e
Ctrl/Alt/Caps/F1–F12; guarda em `meummo:teclas`) e `keysPanel.ts` (janela das teclas, aberta pelo botão "Teclas" do
painel do som, escondido no celular; avisa das "Teclas de Aderência" do Windows com a esquiva no Shift). Padrão:
Shift esquiva, Espaço pula, J atira, F defende, Q/E habilidades, I mochila, M mapa (só um aviso até o mapa existir),
C liga e desliga o andar devagar (antes, segurar Shift), som sem tecla. A barra de ações é refeita com as teclas novas
(`makeActionBar`/`keysChanged`). **Pulo** (protocolo **31**): o cliente manda `jump`, o servidor confere a recarga
(`JUMP_COOLDOWN_MS`, 0,8 s), recusa desmaiado, defendendo ou puxando o tiro, e manda `fx` `jump` a quem está perto
(`tests/pulo.test.ts`); som `jump` no `sfx.ts`; o desenho provisório dá um pulinho. Pedidos à [arte]: o pulo no boneco
(o animador já pula com `input.jump`), o botão de pular no celular, a etiqueta da tecla da esquiva (o estilo desenha a
barra de espaço fixa) e o "Como jogar" da tela de entrada.

**14/11 — lag na conversa e trava no zoom (medido) e o som do arco:** perfil no Chromium sem placa de vídeo (CDP
Profiler + tarefas longas, build com `npx vite build --minify false`): ao abrir e fechar a conversa e ao dar zoom,
quadros de 100 a 250 ms, quase tudo em `drawImage`. A causa é do desenho (da [arte]): `Ground._ensureKey()`
(`prototipos/pindorama-25d/js/world/ground.js`) apaga todos os pedaços do chão a cada zoom novo, e a câmera da conversa
muda o zoom a cada quadro por 450 ms (`CONVERSATION_ZOOM_MS`); e o `World.buildBusy()` conta só a gravação da pintura
(o Chrome pinta de verdade no primeiro `drawImage` de cada imagem). Pedido mandado à [arte]: esticar os pedaços velhos
enquanto o zoom muda e refazer quando ele parar. O motor ficou como está (se ela pedir, dou menos passos na animação
da conversa). Som da puxada do arco refeito (`Sfx.charge(power, 'flecha')`): sem tom contínuo; chiado fino de corda
(ruído num filtro estreito, 2400→3500 Hz) e estalinhos de madeira (`creak`) que aceleram com a carga.

**14/11 — música (licença livre) e a lista grande do dono:** três músicas CC0 do OpenGameArt em
`public/assets/audio/musica/` (créditos em `CREDITOS.md`; igualadas a -20 LUFS com o `loudnorm` do ffmpeg, MP3 112 kbps):
vila → Down The River (Komiku), mata/clareira/lago → Forest Whisper Theme (Cleyton Kauffman), mata profunda → Peaceful
Forest (Samza). `src/client/music.ts`: dois tocadores `HTMLAudioElement` (tocam aos poucos, sem carregar tudo) ligados
ao volume "música" por `MediaElementSource`; trocam devagar; liberados no primeiro clique (`Sfx.unlock` → `prime`, por
causa do iPhone). O Pixabay e o Freesound recusam acesso automático daqui; o OpenGameArt, o FMA e o Incompetech
funcionam. O dono mandou a lista grande (no roteiro, "A lista do dono de 14/11"): distribuí para a [arte] e o [mundo].
Minha fila, na ordem: lag ao falar com NPC e trava no zoom (medir), som do arco, controles (Shift esquiva, Espaço
pula, M mapa), flecha presa na árvore, drop de itens, dia e noite, vento, mapa explorado, capivaras, mais bichos e as
habilidades (estas duas pedem decisões do dono).

**14/11 — arco e Joaquim desenhados (da [arte], com o "pode" do dono):** liguei a flecha de verdade
(`projectileArt.ts`: `drawProjectile` no `drawShots`, `projectileEnded` no `endShot(id, hit)` e no fim do alcance,
`drawLanded`, `landedBusy` no `busy()`), o ícone `arco` no item e o `actionBar.setLook` (ao entrar e na mensagem `gear`
sua). O Joaquim agora é desenhado pela view (`canDraw('pet', 'joaquim')`), e o gatinho provisório do `combat.ts` só
aparece se a view não souber desenhar. Observação para o equilíbrio: no zoom padrão a tela mostra uns 10 m para os
lados e para baixo (13 m nas diagonais do chão); a flecha com carga cheia (13 m) pode sair da tela.

**14/11 — som, parte 1 (volume e ambiente):** `sfx.ts` ganhou um volume por parte (`efeitos`, `ambiente`, `musica`,
`localStorage` `meummo:volumes`), cada uma num `GainNode` antes do geral; o "desligar" abaixa o geral (o ambiente
continua por baixo). `src/client/ambient.ts`: `sceneOfPlace` (propriedade `som` do lugar, senão o nome) e `Ambient`
(sons contínuos com volume por lugar, trocando com `setTargetAtTime`, e bichos sorteados por minuto). `GameMap.places`
e `placeAt` (camada `areas`, o menor lugar que contém o ponto). Painel `src/client/novo/soundPanel.ts` (o botão do som
da HUD abre). Gancho de teste `__mundoNovo.sound()`. Falta a música (o dono escolhe a origem). Pendência da [arte]: o
botão do som some no celular.

**14/11 — Joaquim, o gato da vó (o comportamento):** `src/server/pets.ts` (`PetDef`, `parsePetDefs`, `Pet`,
`petHome`): a cama é um ponto da camada `pontos` (pode estar dentro de um móvel sólido: o gato pula, `dashed`), o chão
livre ao lado é procurado em anéis em volta; ele anda com `walkSlice` (o mesmo corpo do jogador) e nunca sai do
retângulo (`GameMap.regions`, novo). Modos: sleep → stretch → (pula) rest/walk × passeios → volta → (pula) sleep.
Mia uma vez por chegada (conjunto `near`), com espera; carinho com espera (`petEveryS`). World: `pets`, `updatePets`,
`seePet`, `petFx`, `cuddle`. Protocolo 30: kind `pet`, `asleep`/`home` no EntityState, fx `meow`/`purr`/`wake`/`sleep`,
mensagem `pet`. Motor: sem `view.canDraw('pet', tipo)`, desenha o gatinho provisório no `combat.ts` (só com você
dentro do `home`); tocar nele anda até lá (corrige o caminho se ele andar) e manda `pet`. Sons `meow` e `purr`.

**14/11 — Arco de Bambu (as regras):** `WeaponShot` em `ItemInfo.shot` (campo `tiro` em data/items.json, conferido por
`parseWeaponShot`, limites em `WEAPON_SHOT_LIMITS`, os mesmos do painel). `shotProfile` em `src/shared/combat.ts`;
`chargeFraction`/`chargedRange`/`chargedDamage` recebem o perfil do tiro (não mais as regras do combate). Servidor:
`World.shotOf` (arma equipada, só no mapa novo). Motor: `engine.shot()`; o anel da carga recebe o tempo da arma
(`setCharge(id, since, fullMs)`); `myShot(..., kind)`; sons `bow-release` e `sfx.charge(power, kind)`; flecha provisória
no `drawShots`; `view.gear(id, gear)` ao aparecer e na mensagem `gear`. Pendências com a [arte]: ícone `arco` (trocar o
`icone`), `projectileArt.ts` (ligar no `drawShots`) e `actionBar.setLook`. Protocolo 29.

**13/11 — painel, parte 5 (números do combate):** `CombatRules` (`src/shared/combatRules.ts`, padrão das constantes
`CHARGE_*`/`GUARD_*`, menos `GUARD_MAX_ENERGY`, que é a escala da barra). `chargeFraction`, `chargedRange`,
`chargedDamage`, `guardCovers` e `blockHit` recebem as regras (sem padrão escondido: quem esquece não compila).
`World.combat` (opção `combat`; o servidor passa `tuning.combat`, o mesmo objeto, mudado no lugar). Grupo `combate`
no `Tuning`: partes `carga`, `defesa`, `recuo`, em unidades do dono (ms, %, graus, metros), com limites por número
(`COMBAT_NUMBERS`); `parseCombat` converte e o teste confere que o padrão do painel volta exatamente ao do jogo.
`welcome.combat` e mensagem `combat` (protocolo 28); o motor e o `CombatLayer` usam o mesmo objeto
(`Object.assign` ao chegar). Gancho de teste: `__mundoNovo.combat()`.

**13/11 — painel, parte 4 (missões):** grupo `missoes` no `Tuning` (as missões passam a ser montadas junto com
monstros, itens e NPCs, conferidas por `parseQuestDefs`/`checkQuests`). Campos: nome, pedido e concluída (`texto-longo`,
até 600 letras), `objetivo.rotulo` (vazio = automático), `objetivo.quantidade`/`monstro`/`item`, `nivelMinimo`,
`repetivel` e `recompensa.xp`/`ouro`/`itens` (tipo novo `itens-qtd`: lista de `{ item, quantidade }`). Fica de fora:
quem dá, com quem falar e `depoisDe` (mudam a ordem da história: só no arquivo). Mensagem nova `questDefs`
(protocolo 27): o cliente troca a lista dentro do mesmo array (a conversa e o rastreador usam ele) e redesenha.
`replaceInPlace(..., exact)` tira campo que sumiu (o `goalLabel` que voltou ao automático).

**13/11 — painel, parte 3 (monstros por área):** grupo novo `areas` no `Tuning` (o padrão vem dos mapas; chave
`mapa#n`, n = a ordem da área no mapa, de 1 em diante): `monstro` e `quantidade` (0 a 50). O mundo monta as áreas com
os ajustes e `refreshAreas` vale na hora (troca o tipo, completa ou tira, sem ninguém ganhar nada). O lugar da área
continua sendo do mapa ([mundo]).

**13/11 — painel, partes 1 e 2:** nível e XP (ações `nivel` e `xp` no cartão do jogador) e a posição dos NPCs
(campos `mapa`, `x`, `y` — tipo novo `numero`, com vírgula; `Tuning.setMany` muda os três juntos; `refreshNpcs` tira,
põe e move; o navegador move o boneco). Menu ADM "Trazer para cá" (`gm` `npc`, protocolo 26) grava pelo `setNpcSpot`.

**13/11 — registros (logs), pedido do dono para corrigir mais fácil:** `Logbook` (tela + `saves/registros/` um
arquivo por dia, 14 dias + memória para a aba Registros do painel). O tick e cada mensagem estão em try/catch:
o erro vai para o registro com o caminho e o servidor continua (antes, um defeito num tick derrubava tudo). Erros do
navegador chegam pela mensagem `oops` (protocolo 25), com a tela e o aparelho. O dono também pediu, para o painel,
"todos" os itens que propus (nível/XP, posição dos NPCs, monstros por área, missões, números do combate): faço em
partes, nessa ordem.

**13/11 — Xiovanna atrás do balcão (Budega com interior, do [mundo] e da [arte]):** `budega` em (64,6; 51), logo
depois do mapa entrar na main, como combinado. O teste dos NPCs no mapa novo passou a pedir "o corpo cabe e dá para
chegar a pé a até 3 m" (atrás do balcão ninguém chega no pé dela, de propósito). Missão, loja (a 2,9 m) e o lugar
exato conferidos no navegador.

**13/11 — menu ADM, passo 1 (pedido do dono: "pôr mais bicho, matar, voar, coisas que player normal não faz"):**
administrador salvo no personagem (`MIGRATIONS` passo **4**: coluna `admin`, todo mundo começa como jogador normal),
marcado no painel (`POST /admin/api/adm`; online, vale na hora). Comando `gm` (protocolo 24), sempre conferido no
servidor (quem não é administrador é ignorado e registrado) e registrado no log: `spawn` (monstros numa área
temporária em volta, que não renascem; até 10 por vez e 60 por mapa), `clear` (dano igual à vida dos monstros a até
8 m: XP e itens normais), `fly` (o pedaço da fila guarda o voo, como a defesa; `flySlice` atravessa tudo; pousar
dentro de algo leva ao chão livre), `god` (sem dano; monstros e o canto ignoram), `tp` (o pé exato, ou o chão livre
mais perto; voando, qualquer ponto do mapa), `heal`. No navegador, `src/client/novo/gm.ts` (botão ADM e tecla G);
voando, o "andar até" vai reto. Conferido no PC e no celular. Testes em `tests/gm.test.ts`.

**13/11 — desempenho (pergunta do dono: "como fica em FPS? o que fazer para ficar leve?"):** medido no navegador
de teste, sem placa de vídeo (pessimista): PC 1280×720 de 31 (combate) a 58 (praça) quadros por segundo; 1920×1080
de 26 a 43; celular emulado de 33 a 57. Quase todo o quadro é o desenho da view (8 a 30 ms de JavaScript); o motor e
a minha camada de combate, menos de 0,2 ms. A camada de combate estava com mais pixels que o cenário no celular
(2265×945 contra 1726×720) e custava 2 a 4 ms juntando as duas: agora usa até ~1,3 milhão de pixels e some quando
não tem nada (+2 a 5 quadros no celular). `?fps` no endereço mostra o medidor (para o dono medir no PC e no celular
dele). Perfil do combate mandado à [arte]: `get bounds` em `props.js` (texto do zoom a cada leitura, ~1000 objetos),
a escolha do que aparece passando por todos os objetos, e personagens pintados a cada quadro.

**13/11 — tela inicial nova (imagem do dono), a parte do servidor:** o dono confirmou o nome (**Selva de Pedra**; a
primeira imagem dizia "Selva de Concreto" por engano) e concordou em deixar fora o que só funciona com o jogo na
internet (Google, e-mail, "esqueceu a senha") e o "Sair do Jogo". Mandou o fundo limpo e o logo (em
`docs/referencias/`; o fundo veio com alfa de 170 a 250, avisei a [arte]). Feito por mim: `mode` no `hello`
(protocolo 23): 'login' não cria (nome errado deixava de criar personagem sem querer), 'create' não entra (nome com
dono = `name_exists`, sem conferir a senha); sem `mode`, como sempre (tela de hoje e bots). No `main.ts`, a troca
Entrar/Criar liga sozinha quando a [arte] puser `#mode-toggle`, `#login-title` e `#password2`; quem nunca entrou no
aparelho começa em Criar. Painel: **trocar senha** de qualquer personagem salvo (`POST /admin/api/senha`; a senha não
vai para o registro; as tentativas erradas daquele nome são esquecidas). Teste em `tests/conta.test.ts`; no navegador,
conferido com os elementos colocados pelo teste (o `route.fulfill` do Playwright não serve: o Chromium trata a
página como de fora e bloqueia o WebSocket local — `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`; use `addInitScript`).

**13/11 — conversa com NPC, parte 1 (pedido do dono no meio do 2c):** "a câmera deve se posicionar na Xiovanna e
vir a msg por cima com ela falando (mexendo a boca)", igual ao aceitar/desistir e em qualquer conversa direta. Minha
parte: modo conversa no motor (`updateConversation`): ao abrir missão ou loja, zoom suave até 1,25 e `focus` na
pessoa; ao fechar, volta ao zoom do jogador; golpe recebido fecha a conversa (fora da área segura, não dá para ficar
sem ver o perigo). `talk(id, ms)` diz à view quanto tempo a boca mexe (fala ao abrir; `done` ao entregar; resposta
curta ao aceitar ou desistir). A `PD.View` só segue "gente" (criatura não é seguida) e ainda não tem `focus` nem
`talk`: pedi à [arte], junto com a fala por cima da cena no lugar do painel com retrato antigo. Conferido: PC 53 → 95
px por metro e volta; celular 28 → 49; na provisória o Curupira fica no centro da tela.

**13/11 — combate passo 2c, o recuo (fecha o passo 2):** golpe de monstro empurra o jogador na direção do golpe, o
quanto o monstro diz (`"recuo"` no ataque, em centímetros; padrão pelo tipo, de 12 a 34 como as pedras do protótipo;
no painel também). Defesa: 25% do empurrão; quebrando no golpe, 50%. Parede segura (o `sweepBody` ganhou o mínimo
como parâmetro: a esquiva continua exigindo 20 cm, o recuo aceita qualquer pedacinho). O navegador não precisou
mudar: o servidor marca o ack e a previsão se corrige sozinha, sem cancelar o "andar até". Monstros não recuam
(andam de tile em tile). Esquiva: a do jogo (3 m, 0,35 s protegido, 2,5 s de recarga) é bem diferente da do
protótipo (1 m, 0,2 s, 0,2 s); deixei a do jogo e perguntei ao dono. Testes em `tests/recuo.test.ts`.

**13/11 — combate passo 2b, a defesa com energia:** os números do `guard.js` da revisão 17 (energia 100, 6/s
segurando, 22/s de volta depois de 0,7 s, protege 0,11 s depois de levantar, arco de 140°, passa 25%, golpe gasta
10 + 0,75 × dano, quebra e rearma com 20 depois de 0,85 s soltando; anda a 70% do andar devagar). Decisões minhas,
para o dono sentir jogando: F e um botão Defesa (o botão direito continua puxando a pedra, porque aqui o esquerdo
no chão anda); a defesa vira sozinha para o monstro mais perto (até 8 m), senão para onde anda; segurando o botão
anda devagar mesmo com a defesa quebrada (o navegador prevê sem esperar o servidor); defendendo não atira nem usa
habilidade (nem o Fôlego). Por dentro: a mensagem `guard` marca cada pedaço de caminhada da fila (o servidor anda na
mesma ordem que o navegador) e o `damage` recebe a direção do golpe (fruta: para onde voa; golpe de perto e
investida: do monstro para o jogador; fogo no chão: sem direção, a defesa não segura). Conferido no PC e no celular:
4 frutas de sagui defendidas (1 de dano cada), energia caindo até quebrar e voltando; andar 4,7 m/s livre e 1,5
defendendo. Testes em `tests/defesa.test.ts`.

**13/11 — combate passo 2a, a pedra com carga** (o dono: "pode fazer o combate passo 2"; dividi em 2a carga, 2b
defesa com energia, 2c recuo): segurar puxa o estilingue e soltar atira; a carga enche em 1,1 s (pode segurar mais) e
leva o dano até o **dobro** do de hoje e o alcance de 6,5 a 9,5 m (no mapa antigo nada muda). O servidor conta a carga
pelo relógio dele, do `charge` até o `shoot` (protocolo 21); esquiva, golpe recebido e desmaio soltam a pedra sem
atirar (como no protótipo: para puxar de novo, aperte de novo). Controles: PC segura o botão esquerdo no monstro, o
direito (mira no mouse) ou J (mira no mais perto); celular segura o botão Estilingue e o toque rápido no monstro é
uma pedra fraca na hora. Na tela: anel em volta do pé que enche como relógio e fica dourado quando cheio, e "carga
perdida" embaixo do pé quando um golpe solta a pedra. Conferido no PC (mouse, botão direito e J) e no celular: cheia
= 9,5 m e dano dobrado; rápida = 6,5 m. **Para o 2b:** no protótipo o botão direito é a defesa; aqui ele puxa a pedra
— decidir com o dono quando a defesa entrar.

**13/11 — primeira missão do jogo novo** (pedida pelo dono): "O Despertar" (Curupira → falar com a atendente da
Budega) e "Saguis Encantados" (a Budega pede 4 saguis acalmados; Garrafada). Tipo novo de objetivo "falar" (aceita
com quem dá, conclui com a pessoa procurada: `questFinisher`) e "rotulo" (texto do objetivo). O sagui virou "Sagui
Encantado" (decisão do dono: muda o texto, não o monstro). Mexi só na lógica do `talk.ts` (qual missão aparece com
quem; "Para concluir"), não no visual. Conferido de ponta a ponta no PC e no celular (~20 s de caça).

**13/11 — a Budega abriu** (`budega`, depois da 4b do [mundo] na `main`): no balcão (64,5; 53,3), "Atendente"
provisório. Achado no teste: o servidor media a distância para negociar misturando o tile do jogador com a posição
da vendedora (dava 3,7 com o jogador a 3 m, no balcão) → no mapa novo, do pé ao pé, até TRADE_RANGE + TRADE_SLACK
(3,5 m); o navegador abre a loja a 3 m e fecha a 3,5 m. Teste em `mapa-novo.test.ts`.

**13/11 — mochila, loja e câmera no jogo novo:** as janelas de sempre (mochila, loja, conversa com missões) ligadas no
motor; NPC com loja abre a loja ao chegar. O dono achou a câmera perto demais: o motor começa no zoom 0,7 (o mais longe
da view) e a roda do mouse e as teclas − e + ajustam. Budega: o dono deixou eu escolher o que ela vende (sem tabaco)
→ Banana, Arruda, Água de Coco e Garrafada (novas em `data/items.json`) e Chapéu de Palha; compra pela metade. O
atendente é provisório (o dono vai inspirar em alguém da equipe dele, depois). O NPC entra quando a vila (4b) entrar na
`main` (o [mundo] avisa; antes disso o teste dos NPCs quebraria). A HUD nova do dono (imagem) foi para a [arte]; minhas
observações: sem mana (barra verde = energia da revisão 17), sem botões de coisas que não existem, versão de celular.

**13/11 — ajustes do combate (relato do [mundo] depois de religar os monstros, a878d34):** a pedra parava na grade de
1 m dos troncos (213 árvores na mata) → no formato novo ela bate pelo retângulo exato embaixo dela
(`blocksShotAt`); no celular, o toque no sagui agora vale onde ele está desenhado e onde ele está de verdade, com mais
folga no dedo. Não reproduzi o "0 de 12 toques" do [mundo] no Chromium (iPhone 13 deitado: 11 de 12 antes, 12 de 12
depois); perguntei como ele tocou. `__mundoNovo.entities()` agora traz o pé (`feetX`, `feetY`).

**13/11 — o dono disse "pode os dois":** o endereço normal abre o jogo novo (o antigo em `?antigo`) e o **combate do
jogo novo, passo 1**, está na `main`: o servidor de sempre visto no 2.5D (`src/client/novo/combat.ts` desenha por cima:
aviso vermelho no golpe de perto, anel laranja no preparo, pedras, dano, barras de vida, desmaio, ouro). PC: clique no
monstro atira, botão direito atira no mouse, Espaço, Q, E; celular: toque no monstro e os 4 botões. Regra nova:
ninguém ataca de dentro da área segura. Pedi ao [mundo] para religar os monstros da 4a e à [arte] o desenho do
combate (métodos opcionais `action` e `actorPosition` na `WorldView`) e o conserto do celular (o chat compacto da
[arte] cobre dois botões no canto direito). Próximo: o dono joga o passo 1; depois, o passo 2 (revisão 17).
Falta conferir: o tiro dos jogadores ainda bate na grade de 1 m da colisão (um tronco de 0,3 m segura a pedra no metro
inteiro dele) — vale refinar quando o combate da revisão 17 chegar.

**13/11 — "andar até" do jogo novo refeito (defeito do [mundo] na etapa 4b):** a rota de tile em tile raspava num
poste de 0,3 m e travava de frente, e o toque seguinte travava de novo. Agora `src/shared/route.ts`: reta direta
quando livre, senão A* numa grade de 0,2 m pelo tamanho do pé e retas conferidas com folga; trava → recalcula (2
vezes) → larga com aviso. No mapa da 4b: 900 de 900 trajetos aleatórios chegaram, nenhum travou, busca de 2 a 6 ms
(pior 22 ms). No celular, toque rápido na área do joystick também anda (`joystick.ts`). `?novo&provisorio` força o
desenho provisório (mostra as caixas de colisão). O jogo antigo continua com a rota antiga (congelado). A [arte]
juntou a `PD.View` na `main` com o "pode" do dono; a 4a do [mundo] entrou sem monstros (escolha do dono). Esperando
o dono: endereço normal abrir o jogo novo? e o "pode" para o combate do jogo novo. A Budega fica no balcão
(64,5; 53,3) quando o dono liberar.

**12/11 — Mapa 01 (decisões do dono, repassadas pelo [mundo]; confirmar com o dono quando chegar a hora):** o
[mundo] faz em etapas (câmera, planta, uma tela jogável só com a clareira, o resto em 3 pedaços, atmosferas,
minimapa); o meu trabalho no mapa novo começa na etapa 3, e ele avisa. Ficam comigo: a Budega como a vendinha da
praça da Vila do Capão (NPC e loja nos dados; sem "Tabacaria" e sem tabaco), a zona segura por área, a primeira
missão (acordar, Curupira, portão, vila, mata) e os saguis "encantados" (a missão é acalmar ou afastar, não
matar; o monstro continua o mesmo, mudam a história e o texto). O nome do mundo continua "Selva de Pedra". O
ritual de classe na figueira fica para depois.

**13/11 — movimento livre, passo 1, na `main`:** jogadores andam soltos (pedaços de 50 ms, orçamento de tempo no
servidor, caixa do pé de 0,6 × 0,4 na faixa de baixo do tile, desliza e escorrega 0,3 na quina). Mexi em poucas
linhas do `EntityView.ts` (da [arte]: a perna acompanha a distância) e avisei. Próximos: passo 2 com o [mundo]
(colisão por formas, formato proposto) e o joystick; depois, o combate da revisão 17 (carga, defesa com energia).

**12/11 — decidido pelo dono:** nascer no Parque Santo Dias; capítulo 1 = Capão Redondo e o parque → Guarapiranga →
Santo Amaro (Largo Treze, Terminal, Shopping do Largo Treze) → Billings → centro no fim. Ele quer a Budega
Distribuidora (o negócio dele) no Capão; recomendei sem "Tabacaria" e sem produtos de tabaco (Lei 9.294/1996).
Mandei as decisões ao [mundo] (roteiro, seção "🗺️ Mundo novo").

**12/11 — o ChatGPT evoluiu o protótipo até a revisão 17** (ZIP enviado pelo dono, fora do repositório): duelo de
treino com vida, soco, estilingue com carga (até 1,1 s, dano 20 a 40, alcance 6,5 a 9,5 m), defesa frontal com
energia (100; arco de 140°; bloqueia ~75%; quebra sem energia), esquiva no Q, recuo pela força e aviso laranja do
rival. Os números estão no `LEIA-ME.md` da revisão 17. No MMO, essas regras vão para o servidor, com os mesmos
números: o movimento livre usa a escala do protótipo (metros), para eles servirem direto. Uma regra não serve para
MMO: o corpo caído bloquear a passagem. Recomendei ao dono tornar a revisão 17 a oficial e levá-la para o
repositório pelo chat de Arte, só com o código e o LEIA-ME, sem os 19,6 MB de relatórios.

Antes, em 9/11:
Feito pela Estrutura, tudo na `main`:
- Interface nova (tela de entrada, painel de vida, botões com ícones, chat discreto).
- Ouro: cai no chão onde o monstro estava (cada um vê e pega o seu); item que não cabe na mochila também cai.
- Loja da Dona Iracema (`data/npcs.json`, `preco` em `data/items.json`).
- Painel do administrador (`/admin`): ajustes de monstros, itens e loja na hora (em `saves/ajustes.json`) e
  ferramentas de jogadores (dar ouro e itens, curar, levar, aviso para todos, expulsar).
- Curupira e missões (`data/missoes.json`): derrotar ou entregar, recompensa, sequência, repetível.
- Billings: Jacaré Mutante, Boto Encantado e a Iara (chefe, com o canto que encanta e puxa; a esquiva solta).

Números para não se perder: protocolo na versão **26** (16: `walk` no lugar de `step`; 17: `mundo` no `hello`; 18:
`slow` no `walk`, andar devagar no mundo novo; 19: `quick` no item, os atalhos de consumo; 20: objetivo `talk` e
`goalLabel` nas missões; 21: `charge`, começar a puxar o estilingue; 22: `guard` e `energy`, a defesa, e `blk` no
`hit`; 23: `mode` no `hello`, entrar ou criar conta; 24: `gm`, o menu ADM; 25: `oops`, erros do navegador; 26: `npc` no `gm`);
`MIGRATIONS` no
passo **4** (3: coluna `quests`; 4: coluna `admin`; o movimento livre não precisou de passo novo: o salvo continua
sendo o tile).

## Esperando outras frentes
- Nada pendente para a [estrutura]. A [arte] entregou tudo que estava pedido (Curupira, jacaré, boto, Iara, canto,
  jogador encantado, ícones `dente` e `escama`, conversa, missões e sinais ! e ?) e juntou na `main` em 9/11, junto
  com o personagem em camadas e a loja e o ouro caprichados. O ramo dela ficou igual à `main`.
- O dono vai ligar o **Nano Banana** (gerador de imagens) para o chat de Arte.

## Próximos passos possíveis (o dono escolhe a ordem)
0. **Primeiro:** movimento livre (aprovado em 10/11). A recomendação de chamar os amigos (M5) ficou para depois de o
   jogo estar gostoso de andar.
1. **Equilíbrio:** o dono joga e ajusta no painel (itens "[dono → estrutura]" do roteiro); a Estrutura muda o
   padrão nos arquivos quando ele mandar os ajustes copiados do painel.
2. **M5 — servidor na internet** para os amigos testarem: VPS, domínio, HTTPS, senha no painel do administrador,
   banir, registros. (Pesquisar preços de VPS antes de propor.) A avaliar com o dono: um primeiro teste sem VPS,
   por túnel gratuito a partir do PC dele. Antes, o painel precisa de senha e os freios de senha precisam do
   endereço real de cada jogador: pelo túnel, todo visitante chega como se fosse do próprio computador.
3. **M4 — social:** grupo com XP dividido, troca entre jogadores, mensagem privada, guilda.
4. **Lendas novas:** Boitatá (chefe) e uma lenda própria para o Shopping do Largo Treze (o [mundo] deixou o lugar
   pronto).
