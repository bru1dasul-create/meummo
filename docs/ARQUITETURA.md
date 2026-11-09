# Como o jogo funciona por dentro

```
 Navegador (Phaser)                          Servidor (Node.js)
 ┌───────────────────────┐   WebSocket   ┌──────────────────────────┐
 │ src/client            │ ────────────► │ src/server               │
 │ desenha, lê teclado,  │  "quero andar"│ fila de passos, colisão, │
 │ prevê o próprio passo │ ◄──────────── │ área de visão, chat      │
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

## O servidor manda
O cliente nunca diz "estou na posição X". Ele pede "quero andar para a direita" (`step`). O servidor:
1. coloca o pedido na fila daquele jogador;
2. a cada tick (20 por segundo) processa os passos no ritmo certo: no máximo 1 tile a cada 200 ms
   (na diagonal, 283 ms — √2 a mais — para a velocidade ser a mesma em qualquer direção);
3. confere no mapa se o tile está livre (na diagonal, os dois tiles do lado também: ninguém corta quinas);
4. responde ao jogador com a posição oficial (`ack`) e avisa quem está vendo (`move`).

Assim ninguém anda mais rápido nem atravessa parede, mesmo mexendo no código do navegador.

## Por que não tem atraso ao andar
Esperar a resposta do servidor para mover o personagem daria sensação de lag. Por isso o cliente
**prevê**: anda na hora usando a mesma função do servidor (`src/shared/movement.ts`) e guarda os passos
ainda não confirmados. Quando chega o `ack`, refaz as contas a partir da posição oficial; se o servidor
discordou (raro), o personagem é corrigido.

## Área de visão
Cada jogador só recebe notícias de quem está a até 20 tiles na horizontal e 16 na vertical.
Quando alguém entra na visão chega um `spawn`; quando sai, um `despawn`. É isso que permite
muita gente no mesmo servidor sem mandar tudo para todo mundo.

## Combate (servidor manda, cliente desenha)
- **Projéteis** (estilingue, frutas do Sagui) são simulados no servidor a cada tick, em pedacinhos de
  1/4 de tile, com a mesma função que o cliente usa para desenhar (`advanceShot` em `src/shared/combat.ts`).
  Árvores, pedras e paredes seguram tiros (propriedade `bloqueiaTiro`); a água não.
- **O seu tiro aparece na hora:** o cliente desenha a pedrinha assim que você clica, mandando um número
  (`cid`). Quando o servidor confirma (`shot` com o mesmo `cid`), os dois passam a ser o mesmo tiro.
- **Golpes telegrafados:** quando um monstro vai atacar, o servidor manda `warn` com os quadrados que
  serão atingidos e o tempo até o golpe. Na hora, só leva dano quem ainda estiver ali (e não estiver
  invencível pela esquiva). Por isso a rede não atrapalha: o aviso dura mais que o atraso da internet.
- **Investida** (Mula sem Cabeça): o aviso é a linha inteira; na hora, quem estiver nela é atropelado e o monstro
  corre até o fim (para antes de parede, de outro monstro e de cima de alguém). Os viewers recebem `fx`
  (`charge`), o `move` com `dash` (corrida rápida) e `fire` com os tiles do caminho, que queimam quem fica em cima
  a cada 0,5 s até apagar (a esquiva protege, como de qualquer golpe).
- **Esquiva** entra na mesma fila dos passos (`step` com `dash`), então também é prevista no cliente e
  corrigida pelo servidor se precisar.
- **Monstros** (`src/server/world.ts`): passeiam na área deles; os agressivos percebem quem chega perto;
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
  está vendo (e para o próprio). O navegador desenha em camadas (`src/client/game/characters.ts`): cabeça, corpo,
  cabelo, roupa (gibão/couraça), braço, amuleto, arma e chapéu por cima; cada look + equipamento vira uma textura
  criada uma vez só. O boneco da mochila usa o mesmo desenho.

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
| cliente | `hello` | entrar com nome e senha (cria o personagem se o nome ainda não existir) |
| cliente | `step` | pedir um passo (com número de sequência); com `dash: true` é a esquiva |
| cliente | `shoot` | atirar com o estilingue no ângulo `a` |
| cliente | `skill` | usar a habilidade `n` mirando no ângulo `a` |
| cliente | `item` / `unequip` | equipar, usar ou jogar fora o item do espaço `i` / tirar o que está numa parte |
| cliente | `buy` / `sell` | comprar `n` de um item do vendedor `npc` / vender `n` do item do espaço `i` para ele |
| cliente | `loaded` | terminei de carregar o mapa novo (depois de um `zone`) |
| cliente | `chat` / `ping` | falar / medir a latência |
| servidor | `welcome` / `reject` | entrou (com seus números e os NPCs do mapa) / recusado (nome inválido, senha errada ou curta, tentativas demais, servidor cheio, versão) |
| servidor | `bye` | sua sessão acabou: entrou com o personagem em outro lugar, ou o servidor está desligando |
| servidor | `spawn` / `despawn` | alguém (jogador ou monstro) entrou / saiu da sua área de visão |
| servidor | `move` | alguém que você vê andou, virou ou rolou |
| servidor | `ack` / `teleport` | sua posição oficial depois do passo `seq` / você foi levado para outro lugar no mesmo mapa |
| servidor | `zone` | você foi para outro mapa: carregue o mapa novo (e responda `loaded`); vem com os NPCs de lá |
| servidor | `shot` / `shot_end` | um projétil saiu / acabou (e em quem acertou) |
| servidor | `warn` | aviso no chão: golpe vindo nestes quadrados |
| servidor | `fire` | chão pegando fogo nestes quadrados por `ms` (rastro da investida) |
| servidor | `fx` | efeito visual (arco, giro, bote, esquiva, redemoinho, investida), com o alcance do golpe quando precisa |
| servidor | `hit` / `heal` / `hp` | dano / cura / vida atual de alguém |
| servidor | `death` / `levelup` | alguém caiu / subiu de nível |
| servidor | `stats` / `cd` / `fail` | sua XP, nível, dano e defesa / recarga de habilidade / pedido recusado (ex.: recarregando) |
| servidor | `inv` / `loot` | sua mochila (e seu ouro) mudou / estes itens do monstro que caiu em (x, y) foram para a sua mochila |
| servidor | `drop` / `pickup` / `drop_gone` | caiu ouro ou item no chão para você / você pegou / sumiu (o tempo acabou) |
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
  `scripts/gen-map.ts`), Ruínas de Santo Amaro (80×60, `scripts/gen-santo-amaro.ts`) e Represa Billings (88×64,
  `scripts/gen-billings.ts`), os dois últimos usando `scripts/map-builder.ts`. Gerar de novo por cima apaga as
  edições: gere com `--out outro.tmj` e compare. Cada gerador confere no fim se dá para chegar a pé nos lugares
  importantes; o da Billings também liga cada ilha à entrada com passarelas e guarda os caminhos antes de plantar
  as árvores. Mexeu num gerador? Cuidado com a ordem dos sorteios: um sorteio a mais (ou a menos) no meio muda
  tudo o que vem depois (por isso alguns passos sorteiam "à toa", para o resto do mapa ficar igual).
- Camada de objetos `lendas` (Billings): áreas de criaturas que ainda vão existir; o servidor ignora.
- A arte provisória dos tiles é desenhada por `scripts/tileset.ts` (`npm run gen:tiles`). Tiles novos entram
  sempre **no fim** da lista: os mapas guardam o número de cada tile, então mudar a ordem bagunça o mapa.
  Objetos maiores que um tile (árvores grandes 2x3, postes 1x2, varal 3x2, ônibus) são desenhados inteiros e
  cortados em pedaços; os geradores colocam cada pedaço na camada certa com `scripts/map-depth.ts` (árvores,
  postes e sombras). Beiradas suaves entre terrenos: para cada par (ex.: areia que encosta na água) há 15 tiles
  pelos lados que encostam (bits 1 norte, 2 leste, 4 sul, 8 oeste) e 4 de canto; `softenEdges` troca o chão no
  fim do gerador (ou põe a beirada noutra camada, como a parte funda da represa na `sombras`). `npm run render:map -- arquivo.tmj saida.png` desenha qualquer arquivo de mapa (bom para comparar).
- O servidor lê o mapa e os monstros quando liga: depois de editar, reinicie o servidor e recarregue o jogo.
