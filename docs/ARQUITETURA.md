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
  `bag.ts` é a mochila e `itemArt.ts` desenha os ícones dos itens.
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
- `src/server/inventory.ts`: 20 espaços com pilhas e 4 partes equipadas (`weapon`, `head`, `body`, `charm`).
  Equipar troca com o que estava naquela parte. A soma dos equipamentos (`Player.bonus`) entra na vida máxima,
  no dano do estilingue e da Bordunada e na defesa (cada golpe recebido perde `defesa`, mínimo 1).
- O navegador só pede (`item` com `equip`/`use`/`drop` e o espaço; `unequip` com a parte); o servidor confere
  tudo (espaço vazio, desmaiado, vida cheia, espera entre consumíveis) e responde com `inv` ou `fail` (`item: true`).
- Salva junto com o personagem (coluna `inventory`, JSON; versão 2 do arquivo). Ao carregar, itens que não existem
  mais em `data/items.json` saem e pilhas grandes demais são cortadas.

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
| cliente | `loaded` | terminei de carregar o mapa novo (depois de um `zone`) |
| cliente | `chat` / `ping` | falar / medir a latência |
| servidor | `welcome` / `reject` | entrou (com seus números) / recusado (nome inválido, senha errada ou curta, tentativas demais, servidor cheio, versão) |
| servidor | `bye` | sua sessão acabou: entrou com o personagem em outro lugar, ou o servidor está desligando |
| servidor | `spawn` / `despawn` | alguém (jogador ou monstro) entrou / saiu da sua área de visão |
| servidor | `move` | alguém que você vê andou, virou ou rolou |
| servidor | `ack` / `teleport` | sua posição oficial depois do passo `seq` / você foi levado para outro lugar no mesmo mapa |
| servidor | `zone` | você foi para outro mapa: carregue o mapa novo (e responda `loaded`) |
| servidor | `shot` / `shot_end` | um projétil saiu / acabou (e em quem acertou) |
| servidor | `warn` | aviso no chão: golpe vindo nestes quadrados |
| servidor | `fx` | efeito visual (arco, giro, bote, esquiva, redemoinho) |
| servidor | `hit` / `heal` / `hp` | dano / cura / vida atual de alguém |
| servidor | `death` / `levelup` | alguém caiu / subiu de nível |
| servidor | `stats` / `cd` / `fail` | sua XP, nível, dano e defesa / recarga de habilidade / pedido recusado (ex.: recarregando) |
| servidor | `inv` / `loot` | sua mochila mudou / você pegou estes itens do monstro que caiu em (x, y) |
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
- Camadas de tiles: `ground` (chão) e `decor` (árvores, casas, flores…). Pode criar outras.
- Propriedades dos tiles: `colide` (bloqueia a passagem) e `bloqueiaTiro` (segura projéteis).
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
  `scripts/gen-map.ts`) e Ruínas de Santo Amaro (80×60, provisório, `scripts/gen-santo-amaro.ts`, usando
  `scripts/map-builder.ts`). Gerar de novo por cima apaga as edições: gere com `--out outro.tmj` e compare.
- A arte provisória dos tiles é desenhada por `scripts/tileset.ts` (`npm run gen:tiles`). Tiles novos entram
  sempre **no fim** da lista: os mapas guardam o número de cada tile, então mudar a ordem bagunça o mapa.
- O servidor lê o mapa e os monstros quando liga: depois de editar, reinicie o servidor e recarregue o jogo.
