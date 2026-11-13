# Como o jogo funciona por dentro

```
 Navegador (Phaser)                          Servidor (Node.js)
 ┌───────────────────────┐   WebSocket   ┌──────────────────────────┐
 │ src/client            │ ────────────► │ src/server               │
 │ desenha, lê teclado,  │  "quero andar"│ fila de caminhada,       │
 │ prevê a própria andada│ ◄──────────── │ colisão, visão, chat     │
 └───────────────────────┘  o que mudou  └──────────────────────────┘
              └──────── src/shared (regras iguais nos dois lados) ────────┘
```

- `src/shared` — regras que o jogo e o servidor precisam aplicar igualzinho: movimento e esquiva,
  leitura do mapa, busca de caminho, geometria do combate e voo dos projéteis (`combat.ts`),
  progressão (`progression.ts`), habilidades (`skills.ts`) e o formato das mensagens (`protocol.ts`).
- `src/server` — quem manda no mundo. `world.ts` tem as regras (movimento, combate, IA dos monstros) e
  não sabe nada de rede (fácil de testar); `entities.ts` são jogadores e monstros; `monsters.ts` lê
  `data/monsters.json` e `items.ts`, `data/items.json`; `inventory.ts` é a mochila; `accounts.ts` guarda os
  personagens; `session.ts` cuida de uma conexão; `server.ts` liga HTTP, WebSocket e o relógio.
- `src/client` — o jogo no navegador. `game/WorldScene.ts` é a cena principal; `game/effects.ts` desenha
  avisos, tiros e golpes; `game/EntityView.ts` desenha cada personagem/monstro; `ui.ts` é a interface em HTML;
  `bag.ts` é a mochila, `itemArt.ts` desenha os ícones dos itens e `actionArt.ts` os dos botões de habilidade.
  O visual da interface (painéis de madeira com borda dourada, cores, fontes) fica em `style.css`, nas variáveis do
  começo do arquivo (`--wood`, `--frame`...). O cenário da tela de entrada é um desenho em SVG dentro do `index.html`.
- `data/monsters.json` — os números de cada monstro (vida, dano, velocidade, avisos, o que deixa), em português.
- `data/items.json` — os itens (equipamentos, consumíveis e materiais), em português.

## O servidor manda (movimento livre)
Os jogadores andam soltos, não de tile em tile: a posição é um número quebrado (em tiles, 1 tile = 1 metro) e o
pé é uma caixinha de 0,6 × 0,4 que fica na faixa de baixo do tile, onde o pé é desenhado. Os monstros continuam
andando de tile em tile.

O cliente nunca diz "estou na posição X". Enquanto você segura uma direção, ele pede, a cada 50 ms, "quero andar um
pedaço nesta direção" (`walk`, com a direção em graus inteiros: 360 direções, para o joystick e o clique). O servidor:
1. coloca o pedido na fila daquele jogador (no máximo `MAX_QUEUED_WALKS`; mais que isso descarta e corrige);
2. a cada tick (20 por segundo) anda os pedaços da fila, cada um gastando 50 ms de um "orçamento" que enche com o
   relógio (até `WALK_BUDGET_MAX_MS`): ninguém anda mais rápido que 5 tiles por segundo, mas pedidos que a rede
   atrasou e entregou juntos ainda passam na hora;
3. anda a caixa do pé com `walkSlice` (`src/shared/movement.ts`): primeiro na horizontal, depois na vertical,
   parando encostado no tile bloqueado — então ela **desliza** ao longo das paredes. Andando reto e batendo de raspão
   na quina de uma passagem, escorrega de lado até 0,3 tile para entrar nela (menos do que precisaria para contornar
   um tile inteiro). Na diagonal não passa espremida entre duas paredes;
4. responde ao jogador com a posição oficial exata (`ack`) e avisa quem está vendo (`move`).

O "tile onde o jogador está" (`footTile`, o tile do centro da caixa do pé) é o que monstros, avisos de golpe,
saídas, área de visão e salvamento usam; no servidor, `player.x`/`player.y` devolvem esse tile e
`player.fx`/`player.fy` são a posição exata. Personagens salvos guardam o tile (voltam no meio dele).

Assim ninguém anda mais rápido nem atravessa parede, mesmo mexendo no código do navegador.

## Mapas do mundo 2.5D (formato novo)
Os mapas novos ficam em `public/assets/maps-iso/` (o servidor lê esta pasta e a `public/assets/maps/` de hoje). São
`.tmj` ortogonais com tile de 32 px só como grade: **1 tile = 1 metro**, e tudo vem em camadas de objetos:
- `colisao`: retângulos exatos (tronco, poste, muro...). O pé do jogador usa o retângulo exato (`isSolidTile` e
  `solidsAt` em `GameMap`); os monstros, a busca de caminho deles e os tiros usam a grade de 1 m, em que o tile que um
  retângulo toca fica bloqueado inteiro. `bloqueiaTiro: false` (grade, portão de ferro) deixa a pedra passar.
- `seguro`: áreas seguras. Dentro delas monstro não entra, não nota, não acerta (pedra passa reto, golpe não
  machuca) e quem entra se livra de quem estava atrás. A propriedade `seguro` do mapa continua sendo só a faixa e o PvP.
- Pontos com nome (`spawn`, chegadas) e a posição dos NPCs no `data/npcs.json` dizem **onde fica o pé**, exato, com
  fração (`cornerAtFeet` converte para a posição "de canto"). Quem nasce fica a até 0,8 m do `spawn`, para ninguém
  nascer em cima do outro.
- O "andar até" do jogo novo usa `src/shared/route.ts`, pelo tamanho exato do pé: se a reta até o destino está livre
  (com folga de 8 cm), vai direto; senão, A* numa grade fina de 0,2 m de lugares onde o pé cabe e, depois, "puxa o
  fio" em retas conferidas. Quem segue a rota (`followRoute`) pula para o ponto seguinte assim que o vê em linha reta
  e, no último, para quando nenhum pedaço aproxima mais. Se travar mesmo assim, o jogo recalcula a partir de onde está
  (até 2 vezes) e depois larga a rota com o aviso "Não dá para chegar aí". Tocou onde o pé não cabe (casa, árvore):
  vai até o lugar livre mais perto (até 3 m). (A rota antiga, de tile em tile com `bodyWalkable`, raspava em poste e
  banco; ela continua só no jogo de hoje.)
- Para testar o mundo novo: `MEUMMO_MAPA_INICIAL=capao` faz os personagens novos começarem nele (o Refúgio continua
  sendo de quem já joga). O jogo de hoje (Phaser) não desenha esses mapas: quem desenha é o jogo 2.5D novo.

## O jogo 2.5D novo (`src/client/novo/`)
É o que abre em `http://localhost:3000` (desde 13/11; o jogo antigo, visto de cima, fica em `/?antigo`, e o `?novo` de
antes continua valendo); `?provisorio` troca o desenho da [arte] pelo provisório, que mostra as caixas de colisão (bom
para conferir onde o pé bate). No celular, encostar e arrastar
na metade esquerda é o joystick; um toque rápido sem arrastar, em qualquer lugar, é "andar até" ali. A tela de entrada, o painel de vida e o chat
são os mesmos; a entrada manda `mundo: 'novo'` no `hello`, e o servidor põe o personagem num mapa do formato novo
(o jogo de hoje nunca recebe esses mapas, e vice-versa).
- `engine.ts` (da [estrutura]): o motor. Conversa com o servidor, prevê o próprio andar (as mesmas regras de
  `src/shared/movement.ts`), lê o teclado e o joystick (que andam **pela tela**: W é para cima na tela, e a view diz
  qual direção do chão é essa), toque/clique no chão para andar e no NPC para conversar, e avisa ao entrar e sair da
  área segura. `window.__mundoNovo` serve aos testes automáticos (como o `__meummo` do jogo de hoje).
- `view.ts`: a interface `WorldView` (posições em metros, no pé) e o desenho provisório (`ProvisionalView`).
- `arte.ts` (da [arte]): carrega os scripts do protótipo que definem o desenho de verdade, o `PD.View`; com ele
  carregado, o motor usa ele no lugar do provisório.
- `joystick.ts`: o joystick do celular (metade esquerda da tela).
- Mochila, loja e conversa com missões: as mesmas janelas do jogo antigo (`bag.ts`, `shop.ts`, `talk.ts`), ligadas
  pelo motor; chegar perto de um NPC abre a missão, a loja ou a fala dele, e afastar fecha. Câmera: o motor chama
  `setZoom` da view (opcional na `WorldView`), começando em 0,7 (longe), com roda do mouse e teclas − e +, e guarda
  a escolha no aparelho (`meummo:zoom`).
- `quick.ts`: os atalhos de consumo (1 = comida, 2 = remédio, campo `atalho` de `data/items.json`; a regra de qual item
  usar é `pickQuickItem`, em `src/shared/items.ts`). Teclas 3 e 4; a recarga é a do item (uma só para todos).
- `combat.ts`: o combate desenhado por cima (uma tela transparente sobre a view): aviso no chão, anel laranja de
  quem prepara um golpe, pedras e frutas, números de dano e cura, barras de vida, clarão dos golpes de perto e ouro
  no chão. Contas que batem com o servidor (há teste em `tests/combate-novo.test.ts`): o pé de quem está no tile
  (tx, ty) fica no quadrado [tx, tx+1] × [ty+0,2, ty+1,2] do chão; um projétil em (sx, sy) é desenhado sobre o chão em
  (sx, sy + 0,5), na altura do peito; mirar é do seu pé ao pé do alvo. A view pode ajudar com dois métodos
  opcionais: `action(id, tipo, ângulo)` (animações: 'windup', 'shoot', 'arc', 'dash', 'hurt', 'faint', 'revive' e os
  golpes dos monstros) e `actorPosition(id)` (onde o pé está desenhado, para barra e número seguirem o desenho).
  O servidor recusa ataque de quem está numa área segura (`World.shoot` e a Bordunada). No formato novo, a pedra
  bate pelo retângulo exato da `colisao` (com `bloqueiaTiro`) embaixo dela (`GameMap.blocksShotAt`, `SHOT_FEET_DY`):
  um tronco de 0,3 m segura a pedra só nos 0,3 m dele. Tocar/clicar num monstro vale tanto onde ele está desenhado
  quanto onde o servidor diz que ele está, com mais folga no dedo.
- **Velocidade** (decisão do dono em 13/11): no mundo novo, correr é o normal (`RUN_SPEED`, 4,5 m/s) e andar devagar
  (`WALK_SPEED`, 2 m/s) é segurando Shift ou empurrando pouco o joystick; o pedido `walk` leva `slow: true` (protocolo
  18) e o servidor anda o pedaço do tamanho certo (`sliceDistance`). No jogo de hoje continua 5 tiles por segundo.

## Por que não tem atraso ao andar
Esperar a resposta do servidor para mover o personagem daria sensação de lag. Por isso o cliente
**prevê**: anda na hora usando a mesma função do servidor e guarda os pedaços ainda não confirmados. Quando
chega o `ack`, refaz as contas a partir da posição oficial; se o servidor discordou (raro), o personagem é corrigido.
Para o navegador e o servidor chegarem exatamente no mesmo número, os senos e cossenos vêm de uma tabela arredondada
(programas diferentes podem errar a última casa de `Math.cos`). O desenho anda suave entre um pedaço e outro, e a
perna do personagem acompanha a distância andada (`EntityView.ts`).
O "clique para andar" calcula o caminho em tiles (busca de caminho) e vai mirando no meio de cada tile do caminho.

## Área de visão
Cada jogador só recebe notícias de quem está a até 20 tiles na horizontal e 16 na vertical.
Quando alguém entra na visão chega um `spawn`; quando sai, um `despawn`. É isso que permite
muita gente no mesmo servidor sem mandar tudo para todo mundo.

## Combate (servidor manda, cliente desenha)
- **Projéteis** (estilingue, frutas do Sagui) são simulados no servidor a cada tick, em pedacinhos de
  1/4 de tile, com a mesma função que o cliente usa para desenhar (`advanceShot` em `src/shared/combat.ts`).
  Árvores, pedras e paredes seguram tiros (propriedade `bloqueiaTiro`); a água não.
- **O seu tiro aparece na hora:** o cliente desenha a pedrinha assim que você clica, mandando um número
  (`cid`). Quando o servidor confirma (`shot` com o mesmo `cid`), os dois passam a ser o mesmo tiro (e vale o
  alcance que o servidor mandou).
- **Pedra com carga (jogo novo):** apertar manda `charge` e o servidor marca a hora (`Player.chargeStart`); soltar
  manda `shoot`, e a carga é o tempo entre os dois no relógio do servidor (`chargeFraction`, cheia em
  `CHARGE_FULL_MS`). A carga dá o dano (`chargedDamage`: até o dobro) e, no mapa novo, o alcance (`chargedRange`:
  6,5 a 9,5 m), em `src/shared/combat.ts`. Esquiva, golpe recebido e desmaio zeram a carga; o toque rápido manda
  `charge` e `shoot` juntos (pedra sem carga). Quem não manda `charge` (o jogo antigo) atira como sempre.
- **Defesa com energia (jogo novo):** `guard` (on/off e o ângulo) marca `Player.guardWanted`; a cada tick,
  `updateGuard` levanta a defesa (se não estiver quebrada e tiver energia), gasta e devolve energia e quebra quando
  ela acaba. O `damage` recebe para onde o golpe anda (`travel`): se a defesa já protege (`GUARD_READY_MS`) e o golpe
  vem pela frente (`guardCovers`, 140°), `blockHit` diz quanto passa e quanta energia gasta (`src/shared/combat.ts`).
  Cada pedaço de caminhada da fila guarda se a defesa estava segura quando ele chegou (anda devagar,
  `GUARD_WALK_FACTOR`): assim o servidor anda na mesma ordem que o navegador previu. A energia vai ao navegador em
  `energy` (na hora quando a defesa muda; no máximo 4 por segundo enquanto sobe ou desce); quem vê recebe `guard`.
- **Recuo:** o `damage` também recebe quanto o golpe empurra (`push`, do `"recuo"` do monstro; a fruta leva o do
  monstro que jogou). O jogador anda esse tanto na direção do golpe (`knockBack`, com `sweepBody` parando na parede),
  menos com a defesa (`GUARD_PUSH_FACTOR`, `GUARD_BREAK_PUSH_FACTOR`). O servidor marca o ack: o navegador corrige a
  previsão sozinho, como em qualquer correção.
- **Golpes telegrafados:** quando um monstro vai atacar, o servidor manda `warn` com os quadrados que
  serão atingidos e o tempo até o golpe. Na hora, só leva dano quem ainda estiver ali (e não estiver
  invencível pela esquiva). Por isso a rede não atrapalha: o aviso dura mais que o atraso da internet.
- **Investida** (Mula sem Cabeça): o aviso é a linha inteira; na hora, quem estiver nela é atropelado e o monstro
  corre até o fim (para antes de parede, de outro monstro e de cima de alguém). Os viewers recebem `fx`
  (`charge`), o `move` com `dash` (corrida rápida) e `fire` com os tiles do caminho, que queimam quem fica em cima
  a cada 0,5 s até apagar (a esquiva protege, como de qualquer golpe).
- **Esquiva** entra na mesma fila da caminhada (`walk` com `dash`): rola 3 tiles em linha reta, deslizando no que
  tiver no caminho (`sweepBody`), sem gastar o orçamento da caminhada (tem a recarga dela). Também é prevista no
  cliente e corrigida pelo servidor se precisar. Rolar colado na parede não conta como esquiva.
- **Monstros** (`src/server/world.ts`): passeiam na área deles; os agressivos percebem quem chega perto (menos
  quem acabou de chegar de outro mapa, de acordar na vila ou de entrar onde tinha parado: 3 s de folga, `NOTICE_GRACE_MS`);
  perseguem com busca de caminho; desistem quando o alvo foge para longe e voltam para casa se curando.
  Só nascem em tiles alcançáveis a pé a partir da vila.
- **XP:** todo mundo que acertou o monstro ganha a XP inteira quando ele cai.

## Vários mapas (`src/server/realm.ts`)
- Cada mapa é um `World` completo (seus jogadores, monstros e projéteis; tudo o que já existia continua igual).
  O `Realm` junta os mapas: números de entidade únicos, chat, avisos e "online" valendo para todo mundo, e a
  troca de mapa.
- Ao ligar, o servidor lê todos os `.tmj` e confere as ligações: toda saída precisa levar a um mapa e a um ponto
  que existem, e nenhum ponto de chegada pode estar em cima de uma saída.
- Entrar no jogo: no mapa salvo do personagem (pelo id; saves antigos com o nome da zona também valem) ou no mapa
  `inicial`. O `welcome` diz o id do mapa e o navegador carrega `assets/maps/<id>.tmj`.
- Trocar de mapa: pisou numa saída → no fim do tick o Realm tira o jogador de um mapa (`detach`: quem via recebe
  `despawn`) e coloca no outro (`adopt`), no ponto de chegada, com 2 s de proteção, e já salva a zona nova.
  O jogador recebe `zone` (mapa, posição, números e mochila); o navegador troca a cena inteira pela do mapa novo
  e responde `loaded`. Até o `loaded`, pedidos dele (andar, atirar...) são ignorados — eram do mapa antigo.
- Desmaiar num mapa com `renascerEm`: acorda no mapa indicado (o mesmo `adopt`, com a vida cheia).

## Itens e mochila
- Os tipos de item vêm de `data/items.json` (lido por `src/server/items.ts`) e vão para o navegador no `welcome`.
  O servidor confere ao ligar se todo item que os monstros deixam existe.
- Quando um monstro cai, **cada jogador que ajudou** sorteia a lista `itens` do monstro: os itens vão direto para
  a mochila dele (`loot` para o efeito do item voando, `inv` com a mochila nova). Mochila cheia: o item se perde,
  com aviso. Item raro ou lendário salva o personagem na hora.
- **Ouro:** cada um que ajudou também sorteia o `ouro` do monstro (`MonsterDef.gold`). O ouro fica em
  `Inventory.gold` (não ocupa espaço; máximo `MAX_GOLD` em `src/shared/items.ts`), vai no `inv` (`gold`) e é salvo
  dentro do JSON da mochila — save de antes do ouro entra com 0.
- **No chão (`World.drops`):** o ouro sorteado e o item que não coube na mochila viram um `GroundDrop` com dono:
  só ele recebe o `drop` (posição, ouro ou item, tempo que falta) e só ele pega. A cada tick, o dono a
  `PICKUP_RANGE` tile (depois de `DROP_READY_MS`, o tempo das moedas caírem) pega: `pickup` (com o que pegou) e `inv`.
  Some em `GOLD_DROP_MS` / `ITEM_DROP_MS` (`drop_gone`). Item com a mochila ainda cheia continua no chão (avisa
  uma vez por chegada); dono que sai do mapa ou do jogo perde o que estava no chão. O navegador desenha em
  `src/client/game/drops.ts` (montinho de moedas por código, pulinho, pisca nos últimos 10 s).
- `src/server/inventory.ts`: 20 espaços com pilhas e 4 partes equipadas (`weapon`, `head`, `body`, `charm`).
  Equipar troca com o que estava naquela parte. A soma dos equipamentos (`Player.bonus`) entra na vida máxima,
  no dano do estilingue e da Bordunada e na defesa (cada golpe recebido perde `defesa`, mínimo 1).
- O navegador só pede (`item` com `equip`/`use`/`drop` e o espaço; `unequip` com a parte); o servidor confere
  tudo (espaço vazio, desmaiado, vida cheia, espera entre consumíveis) e responde com `inv` ou `fail` (`item: true`).
- Salva junto com o personagem (coluna `inventory`, JSON; versão 2 do arquivo). Ao carregar, itens que não existem
  mais em `data/items.json` saem e pilhas grandes demais são cortadas.
- O equipamento aparece no personagem: o estado de cada jogador (`spawn`, `welcome`, `zone`) leva `gear`, o `icone`
  de cada parte equipada (`gearLookOf` em `src/shared/items.ts`), e quando muda o servidor manda `gear` para quem
  está vendo (e para o próprio). O navegador procura o visual com o mesmo nome em `src/client/game/gearArt.ts`
  e desenha o personagem em camadas (veja "Personagem em camadas" abaixo). O boneco da mochila usa o mesmo desenho.

## Personagem em camadas (`src/client/game/doll/`)
O personagem é um "boneco de papel" desenhado por código, com o dobro de pixels do mapa (quadro 64x64, mostrado
na metade do tamanho; por isso o zoom da câmera é sempre par). Corpo de ~26 px do mapa, com cabeça, cabelo em
mechas, rosto em camada separada (pisca, careta, sorriso, fala) e dois tipos de corpo, tudo vindo do nome.
- `poses.ts` — o esqueleto: para cada animação (`idle` 4 quadros, `walk` 6, `run` 4 na esquiva, `shoot` 3,
  `swing` 4, `hurt`, `ko`) e vista (`down`, `up`, `side`), onde ficam mãos e pés; cotovelos e joelhos são
  calculados. `raster.ts` é o pincel (formas com volume, sombra projetada, contorno); `compose.ts` monta o corpo
  na ordem certa de cada vista; `gear.ts` desenha cada tipo de equipamento preso aos ossos (acompanha tudo).
- `src/client/game/characters.ts` junta numa textura por combinação (dividida entre quem é igual, desenhada aos
  poucos para não engasgar). NPCs podem ter aparência própria pela chave deles (`NPC_LOOKS`: a Dona Iracema; o Curupira, com
  cabelo de fogo — penteado `fogo`, que tremula a cada quadro — e `feetBackward`/`barefoot`).
- `npm run render:characters` desenha uma prancha de exemplo em `docs/personagens.png`.
- Monstros novos usam o mesmo pincel (`src/client/game/monsterPaint.ts`): olham para a direita (o jogo espelha) e
  têm quadros de parado, andando, armando o golpe (enquanto o aviso está no chão) e golpeando, e podem ter um golpe
  especial (`special`: o canto da Iara, ligado pelo `fx` `song`). `monsterArt.ts` escolhe o quadro (`monsterLook`);
  monstro sem pintura usa o desenho antigo 16x16, e um sem desenho, a bolha.

## NPCs e loja
- Os NPCs vêm de `data/npcs.json` (lido por `src/server/npcs.ts`; `checkNpcs` confere ao ligar se o mapa existe,
  se tudo que a loja vende existe e tem `preco`, e se o que ela veste é equipamento). Cada mapa (World) fica com
  os seus (`World.npcs`, classe `Npc` em `entities.ts`); lugar bloqueado vira o chão livre mais perto, com aviso.
- NPC não anda, não luta e não entra na área de visão: a lista do mapa vai inteira no `welcome` e no `zone`
  (`npcs`, com o desenho, o título, a fala e a loja). O navegador desenha como personagem (`kind: 'npc'`,
  sem barra de vida) e abre a janela da loja (`src/client/shop.ts`) quando você clica nele e chega perto.
- Comprar e vender são pedidos (`buy` com o item e a quantidade; `sell` com o espaço da mochila e a quantidade).
  O servidor confere tudo: distância (`TRADE_RANGE`), acordado, item à venda, ouro, espaço na mochila (compra
  tudo ou nada) e o limite de ouro (vende só o que cabe). A loja paga `compraPor`% do preço (`sellPrice`, mínimo 1).
  Recusa vem em `fail` (`no_gold`, `too_far`, `cant_trade`, `bag_full`, `dead`), com `item: true`.

## O canto da Iara (`world.ts`: `startSong`, `resolveSong`, `updateCharm`, `breakCharm`)
- Monstro com `canto` (`MonsterDef.song`), de tempos em tempos (`nextSpecialAt`), com alguém a até `alcance` tiles,
  para e canta: `warn` com a área em volta dele, `fx` `song` e um balão. No fim do aviso, quem está na área e não
  está invencível (esquivando) fica **encantado**: `Player.charmedBy`/`charmedUntil` e a mensagem `charm` (ms).
- Encantado: a caminhada é recusada (o servidor manda `charm` de novo para o navegador se acertar) e, a cada
  `puxaACadaMs`, o servidor puxa o jogador 1 tile em linha reta na direção de quem cantou, deslizando no que tiver
  no caminho (`pull`, e `move` para quem vê).
  A esquiva que de fato rola solta na hora (`charm` 0); acabar o tempo, desmaiar ou quem cantou sumir também.
- No navegador: enquanto `charmedUntil` não passa, não anda nem prevê a caminhada (só a esquiva); o `pull` desliza
  o personagem até a posição nova.

## Missões (`src/server/quests.ts` e `src/shared/quests.ts`)
- As missões vêm de `data/missoes.json` (lido e conferido ao ligar: `parseQuestDefs`, `checkQuests` — NPC, monstro,
  itens e `depoisDe` existem, sem sequência em círculo; `nameQuestGoals` põe o nome do alvo) e vão inteiras no
  `welcome` (`quests`). O progresso de cada um (`Player.quests`, um `QuestLog`: missão → `active`/`done` e a
  contagem) vai no `welcome` e no `zone` (`questLog`) e, quando muda, em `quests`.
- Objetivos: `kill` (derrotar), `deliver` (entregar) e `talk` (falar com alguém: aceita com quem dá, conclui com a
  pessoa procurada — `questFinisher`). `goalLabel` (campo `rotulo`) é o texto do objetivo na tela, quando a missão
  escolhe. No jogo novo, a conversa e o quadro são as mesmas janelas (`talk.ts`); os sinais ! e ? em cima dos NPCs
  são desenhados por cima pelo motor (`combat.ts`), ou pela view, se ela tiver `mark`.
- Pedidos: `quest` com `accept` ou `complete` (perto do NPC que dá a missão, `TRADE_RANGE`) e `abandon` (em
  qualquer lugar). O servidor confere tudo (`questBlocker`: já fazendo, já feita e não repetível, falta a anterior,
  nível, limite de 5). "Derrotar" conta em `killMonster` para cada um que ajudou; "entregar" conta pela mochila
  e tira os itens na hora de entregar. Recompensa: XP, ouro e itens (o que não couber cai no chão, ao lado).
  Concluir salva o personagem na hora.
- No navegador, `src/client/talk.ts`: a conversa (missões para entregar, em andamento, novas e as que esperam
  nível; botão da loja se o NPC tiver uma), a lista na tela e o sinal ! / ? em cima do NPC (`npcMark`).
- Salvo na coluna `quests` (JSON) — passo 3 de `MIGRATIONS`; o mundo confere ao carregar (missão que sumiu sai,
  contagem fora do limite é corrigida).

## Painel do administrador (`src/server/admin.ts` e `tuning.ts`)
- `GET /admin` entrega a página (`src/server/admin/painel.html`, HTML e JavaScript sem nada externo); a página só
  mostra e pede (`GET /admin/api/dados`, `POST /admin/api/ajustar`, `POST /admin/api/padrao`, `GET /admin/api/exportar`;
  jogadores: `GET /admin/api/jogadores`, `POST /admin/api/jogador` com `acao` = `ouro`, `item`, `curar`, `levar` ou
  `expulsar`, e `POST /admin/api/aviso`).
- **Ferramentas de jogadores** ficam no `Realm` (`playersOnline`, `adminGiveGold`, `adminGiveItem`, `adminHeal`,
  `adminMove`, `notice`) e no `World` de cada mapa; expulsar é `Session.end('kicked')` (o navegador mostra o motivo).
  Cada ação vira uma linha na janela do servidor ("painel: ...") e uma mensagem no chat de quem recebeu.
- **Travas** (`accessProblem`): só aceita quem pede do próprio computador (127.0.0.1/::1) e pelo nome `localhost`
  (contra sites que se fingem de localhost); pedidos que mudam algo precisam do cabeçalho `X-MeuMMO-Admin: 1` e de
  origem local (outro site não consegue mandar esse cabeçalho sem permissão). A página não abre dentro de outro
  site. No M5 entram senha e HTTPS.
- **Ajustes** (`Tuning`): os arquivos `data/*.json` são o padrão; os ajustes (só o que mudou, no mesmo formato em
  português) ficam em `ajustes.json` ao lado do arquivo dos personagens e são misturados por cima. Cada ajuste é
  montado e conferido pelos mesmos leitores de quando o servidor liga (`parseMonsterDefs`, `checkNpcs`...): erro =
  recusa com a mensagem, nada muda. Aceito: os objetos que o jogo usa são atualizados no lugar (quem guardou a
  referência — monstros vivos, mochilas, NPCs — vê o valor novo), o arquivo é gravado (temporário + troca) e o
  `Realm.tuningChanged` avisa os mapas: vida dos monstros vivos acompanha na proporção, equipamentos recalculam,
  e os jogadores recebem `items` e `npcs` com as listas novas.
- Só campos de uma lista fechada (`MONSTER_FIELDS`, `ITEM_FIELDS`, `NPC_FIELDS`) podem ser ajustados; criar
  monstro ou item novo continua sendo nos arquivos de dados.

## Personagens salvos (`src/server/accounts.ts`)
- Ficam num arquivo SQLite (`saves/meummo.db`; `MEUMMO_SAVE=outro.db npm start` usa outro). O SQLite é o que já
  vem dentro do Node.js (`node:sqlite`, Node 22.13+): nada para instalar ou compilar, nem no Windows.
- Entrar = `hello` com nome e senha. Se o nome não existe, o personagem é criado com essa senha; se existe, a senha
  precisa bater. "Ana", "ANA" e "ana" são o mesmo personagem.
- Senhas: guardadas com **scrypt** e um "sal" aleatório (`scrypt$N$r$p$sal$resultado`), nunca o texto. Conferir
  leva ~50 ms de propósito e roda fora da linha principal, então o jogo não engasga.
- Freios (`src/server/login-guard.ts`): quem erra a senha muitas vezes (por endereço ou por personagem) espera uns
  minutos; há limite de personagens novos por endereço.
- O que salva: nível, XP, vida, zona, posição, direção e aparência. Quando: ao sair, ao subir de nível, a cada 30 s e
  ao desligar o servidor (Ctrl+C ou fechar a janela). Quem sai desmaiado volta na vila com a vida cheia.
- Ao carregar, tudo é conferido: se o lugar salvo virou parede (o mapa mudou) ou é de outra zona, o personagem nasce
  na vila; se a conta de XP mudou, a XP que sobrar vira nível.
- Entrar com o mesmo personagem em outro lugar: a sessão antiga recebe `bye` (`replaced`), sai do mundo e é salva
  **antes** de a nova ler o progresso — nada se perde.
- **Mudar o formato** (aparência escolhida, missões...): acrescente um passo no fim de `MIGRATIONS`. A versão
  do arquivo fica em `PRAGMA user_version` e quem já tem personagens é convertido ao ligar o servidor.

## Mensagens
O cliente envia uma mensagem por vez; o servidor envia uma lista de mensagens por tick.

| Quem envia | Mensagem | Para quê |
|---|---|---|
| cliente | `hello` | entrar com nome e senha; `mode: 'login'` só entra, `mode: 'create'` só cria (a tela com "Criar uma conta"); sem `mode`, cria o personagem se o nome ainda não existir |
| cliente | `walk` | andar um pedaço (50 ms) na direção `a` (graus inteiros, 0 = direita, 90 = baixo), com número de sequência; com `dash: true` é a esquiva |
| cliente | `charge` | começar a puxar o estilingue (a carga conta até o `shoot`) |
| cliente | `guard` | segurar (`on: true`) ou soltar a defesa, virada para o ângulo `a` |
| cliente | `gm` | poder do administrador (`cmd`: criar monstros, derrubar os de perto, voar, invencível, ir até um ponto, curar); o servidor confere se ele é administrador e registra |
| cliente | `shoot` | atirar com o estilingue no ângulo `a` |
| cliente | `skill` | usar a habilidade `n` mirando no ângulo `a` |
| cliente | `item` / `unequip` | equipar, usar ou jogar fora o item do espaço `i` / tirar o que está numa parte |
| cliente | `buy` / `sell` | comprar `n` de um item do vendedor `npc` / vender `n` do item do espaço `i` para ele |
| cliente | `quest` | aceitar, entregar (perto de quem dá a missão) ou abandonar uma missão |
| cliente | `loaded` | terminei de carregar o mapa novo (depois de um `zone`) |
| cliente | `chat` / `ping` | falar / medir a latência |
| servidor | `welcome` / `reject` | entrou (com seus números e os NPCs do mapa) / recusado (nome inválido, senha errada ou curta, tentativas demais, servidor cheio, versão, nome que não existe no Entrar, nome que já tem dono no Criar) |
| servidor | `bye` | sua sessão acabou: entrou com o personagem em outro lugar, o servidor está desligando, ou o administrador desconectou |
| servidor | `spawn` / `despawn` | alguém (jogador ou monstro) entrou / saiu da sua área de visão |
| servidor | `move` | alguém que você vê andou, virou ou rolou |
| servidor | `ack` / `teleport` | sua posição oficial (exata) depois do pedido `seq` / você foi levado para outro lugar no mesmo mapa |
| servidor | `zone` | você foi para outro mapa: carregue o mapa novo (e responda `loaded`); vem com os NPCs de lá |
| servidor | `shot` / `shot_end` | um projétil saiu / acabou (e em quem acertou) |
| servidor | `warn` | aviso no chão: golpe vindo nestes quadrados |
| servidor | `fire` | chão pegando fogo nestes quadrados por `ms` (rastro da investida) |
| servidor | `fx` | efeito visual (arco, giro, bote, esquiva, redemoinho, investida), com o alcance do golpe quando precisa |
| servidor | `hit` / `heal` / `hp` | dano / cura / vida atual de alguém |
| servidor | `gm` | você é administrador: o menu ADM aparece, com o voo, o invencível e os monstros que dá para criar (só administrador recebe) |
| servidor | `guard` / `energy` | outro jogador levantou ou baixou a defesa / a sua energia e a defesa (baixada, levantada, quebrada); no `hit`, `blk` diz se a defesa segurou (1) ou segurou e quebrou (2) |
| servidor | `death` / `levelup` | alguém caiu / subiu de nível |
| servidor | `stats` / `cd` / `fail` | sua XP, nível, dano e defesa / recarga de habilidade / pedido recusado (ex.: recarregando) |
| servidor | `inv` / `loot` | sua mochila (e seu ouro) mudou / estes itens do monstro que caiu em (x, y) foram para a sua mochila |
| servidor | `drop` / `pickup` / `drop_gone` | caiu ouro ou item no chão para você / você pegou / sumiu (o tempo acabou) |
| servidor | `items` / `npcs` | o administrador ajustou os itens / os NPCs deste mapa: use as listas novas |
| servidor | `notice` | aviso do administrador para todo mundo (aparece na tela) |
| servidor | `quests` | seu progresso nas missões mudou |
| servidor | `charm` / `pull` | você foi encantado pelo canto por `ms` (0 = acabou) / o canto te puxou para esta posição |
| servidor | `gear` | alguém que você vê (ou você) trocou de equipamento: o desenho de cada parte |
| servidor | `say` / `chat` / `sys` | balão de fala / chat / aviso do sistema |
| servidor | `online` / `pong` | quantos estão online / resposta do ping |

Os tipos exatos estão em `src/shared/protocol.ts`.

## Segurança que já existe
- Toda mensagem do cliente é validada (`src/server/validate.ts`); mensagens grandes são recusadas.
- Limite de mensagens por segundo e limite próprio para o chat; quem insiste em mandar lixo é desconectado.
- Tiros, habilidades e esquiva respeitam as recargas no servidor (o cliente não consegue atirar mais rápido).
- O chat é limpo no servidor e sempre mostrado como texto, nunca como HTML.
- Senhas guardadas com scrypt; freio para quem erra a senha muitas vezes. Na rede local a senha ainda viaja sem
  criptografia: antes de ir para a internet (M5), HTTPS/WSS.
- Conexões "zumbis" são derrubadas a cada 30 segundos.

## Mapas (Tiled)
- Arquivos: `public/assets/maps/<id>.tmj` (um por zona; o nome do arquivo é o id), cada um com o tileset
  embutido chamado `tiles` (imagem `public/assets/tiles.png`).
- Camadas de tiles, de baixo para cima: `ground` (chão), `sombras`, `decor` (troncos, casas, flores…) e
  `acima`. Para o servidor só importa se algum tile do lugar bloqueia (em qualquer camada); no navegador
  (`src/client/game/mapDepth.ts`) a camada `acima` é desenhada por cima dos personagens (copas, alto dos postes)
  e fica transparente perto de quem está embaixo dela e dos avisos/fogo no chão (`CanopyFader`). Pode criar
  outras camadas (ficam embaixo dos personagens, na ordem do arquivo).
- Propriedades dos tiles: `colide` (bloqueia a passagem), `bloqueiaTiro` (segura projéteis), `luz` (cor) e
  `luzRaio` (pixels): um brilho em volta do tile (`MapLights`; tremula se o tile for animado); `faiscas`: solta
  faíscas subindo (`MapSparks`).
- Propriedades do mapa só de aparência: `neblina` e `escuro` (0 a 1), em `MapWeather`. Altura de desenho (depth):
  chão e enfeites embaixo (negativo), personagens pela posição y, copas 3000, escuro 3100, luzes 3200, neblina 3300,
  faíscas 3400, golpes e tiros 4000+.
- Animação de tiles (água, fogueira): a `animation` do próprio Tiled no tileset; o Phaser 4 já anima sozinho.
- Um objeto do tipo ponto chamado `spawn` marca onde os jogadores nascem.
- Camada de objetos `monstros`: cada retângulo é uma área de nascimento. O nome do retângulo é o id do
  monstro em `data/monsters.json` (ex.: `jararaca`) e a propriedade inteira `quantidade` diz quantos.
- Camada de objetos `saidas`: cada retângulo leva para outro mapa (`mapa` = id do destino, `chegada` = nome
  de um ponto lá; sem `chegada`, perto do `spawn`). O nome do retângulo é a placa mostrada no jogo.
- Pontos com nome, em qualquer camada de objetos, são lugares de chegada.
- Propriedades do próprio mapa (Map > Map Properties): `nome` (texto) é o nome da zona — aparece na tela ao
  entrar e nas boas-vindas do chat —, `seguro` (booleano) marca zona segura (para o PvP, quando existir),
  `inicial` (booleano) marca onde os personagens novos começam e `renascerEm` (texto, id de um mapa) diz onde
  acorda quem desmaia ali. Sem `nome`, a zona se chama "Pindorama".
- Salve em formato CSV e não use mapa infinito (o servidor explica o erro se isso acontecer).
- Os mapas atuais foram gerados por código e podem ser editados à mão no Tiled: Refúgio de Guarapiranga (96×72,
  `scripts/gen-map.ts`), Ruínas de Santo Amaro (80×60, `scripts/gen-santo-amaro.ts`), Represa Billings (88×64,
  `scripts/gen-billings.ts`), Terminal Santo Amaro (64×48, `scripts/gen-terminal.ts`) e Shopping do Largo Treze
  (64×44, `scripts/gen-shopping.ts`), os quatro últimos usando `scripts/map-builder.ts`. Gerar de novo por cima apaga as
  edições: gere com `--out outro.tmj` e compare. Cada gerador confere no fim se dá para chegar a pé nos lugares
  importantes; o da Billings também liga cada ilha à entrada com passarelas e guarda os caminhos antes de plantar
  as árvores. Mexeu num gerador? Cuidado com a ordem dos sorteios: um sorteio a mais (ou a menos) no meio muda
  tudo o que vem depois (por isso alguns passos sorteiam "à toa", para o resto do mapa ficar igual).
- Camada de objetos `lendas` (opcional): áreas de criaturas que ainda vão existir; o servidor ignora. A Billings
  marcou assim a Iara, o boto e os jacarés até eles existirem; hoje nenhum mapa tem essa camada.
- Mapa de dentro (o shopping): a planta sai de constantes no gerador (corredores, átrio, faixas de lojas) e cada
  loja tem a frente em duas linhas: o letreiro na camada `acima` (em cima da porta dá para passar por baixo dele;
  no resto da linha, a `decor` tem parede, que bloqueia) e a frente na `decor` (porta de aço, vitrine, entrada).
  Os objetos que bloqueiam só entram se todo o chão continuar alcançável a pé a partir da entrada.
- A arte provisória dos tiles é desenhada por `scripts/tileset.ts` (`npm run gen:tiles`). Tiles novos entram
  sempre **no fim** da lista: os mapas guardam o número de cada tile, então mudar a ordem bagunça o mapa.
  Objetos maiores que um tile (árvores grandes 2x3, postes 1x2, varal 3x2, ônibus) são desenhados inteiros e
  cortados em pedaços; os geradores colocam cada pedaço na camada certa com `scripts/map-depth.ts` (árvores,
  postes e sombras; `clearArea` tira árvores e postes inteiros de um retângulo, para abrir um caminho sem deixar
  copa sem tronco). Beiradas suaves entre terrenos: para cada par (ex.: areia que encosta na água) há 15 tiles
  pelos lados que encostam (bits 1 norte, 2 leste, 4 sul, 8 oeste) e 4 de canto; `softenEdges` troca o chão no
  fim do gerador (ou põe a beirada noutra camada, como a parte funda da represa na `sombras`). `npm run render:map -- arquivo.tmj saida.png` desenha qualquer arquivo de mapa (bom para comparar).
- O servidor lê o mapa e os monstros quando liga: depois de editar, reinicie o servidor e recarregue o jogo.

## Mapas do mundo novo (2.5D isométrico)
- Formato combinado entre a [estrutura] e o [mundo] (12/11): Tiled ortogonal, **1 tile = 1 metro** (tile de 32 px,
  só como grade), tudo em camadas de objetos, sem tiles. A câmera isométrica é só o jeito de desenhar: para o
  servidor, o mapa é visto de cima.
- Camadas: `chao` (áreas do chão, de baixo para cima: mata, grama, terra, calcada, asfalto, `faixa` de pedestre com
  `listras` no sentido da rua, `praca` de pedra portuguesa, trilha em polilinha com `largura`, `circulo`), `cenario`
  (coisas com altura: `arvore` com `especie`, `copa` = **raio** da copa, `altura` e `tronco` em metros, `gradil`,
  `portao` com `aberto`, `pilar`, `arbusto`, `pedra`, `poste` com `luz`, `fiacao` em polilinha ligando os postes, `veu`;
  na vila, `casa` com `altura`, `andares`, `cor`, `caixaDagua`, `pixo`, `bloco`, `abandonada` e, no comércio,
  `comercio`, `letreiro` e `toldo` (a frente é sempre o lado sul, o que a câmera vê), `banco` e `capivara` com
  `olhando` em graus (0 = leste, 90 = sul), `mesa`, `fogueira`, `orelhao`, `lixeira`, `poste-praca` e `carro`),
  `colisao` (retângulos onde o pé bate; `bloqueiaTiro` false onde a pedrinha passa; `altura` nos da vila, para o
  desenho provisório), `seguro` (zona segura por área), `areas` (nome do lugar para a faixa) e `pontos` (`spawn` e
  chegadas). `chao` e `cenario` são do desenho (o servidor ignora).
- A `colisao` sai do gerador a partir do `cenario` (tronco, poste, pedra, gradil, portão…), para desenho e colisão
  nunca desencontrarem. Medidas para o pé de 0,6 × 0,4: passagem com pelo menos 1,5 m e 1,2 m entre troncos; duas
  coisas sólidas de frente uma para a outra ficam coladas ou a pelo menos 1,2 m (num vão menor o pé entra e entala).
- Mapa 01 (Parque Santo Dias e Vila do Capão, 96 × 80 m): `scripts/gen-capao.ts` (`npm run gen:capao`) →
  `public/assets/maps-iso/capao.tmj` (o servidor lê essa pasta para o jogo novo). Câmera: o gerador não põe árvore
  nem casa que, vista de cima na diagonal, cubra a clareira, o círculo, a trilha, o lago, o portão, a rua da vila ou o
  balcão da Budega (`hidesView`, `canopyHides`, `boxHides`). Testes em `tests/capao.test.ts` (inclusive por onde o pé
  consegue ir a partir do nascimento).
