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

## Itens e mochila
- Os tipos de item vêm de `data/items.json` (lido por `src/server/items.ts`) e vão para o navegador no `welcome`.
  O servidor confere ao ligar se todo item que os monstros deixam existe.
- Quando um monstro cai, **cada jogador que ajudou** sorteia a lista `itens` do monstro: os itens vão direto para
  a mochila dele (`loot` para o efeito do item voando, `inv` com a mochila nova). Mochila cheia: o item se perde,
  com aviso. Item raro ou lendário salva o personagem na hora.
- `src/server/inventory.ts`: 20 espaços com pilhas e 7 partes equipadas (`head`, `body`, `hands`, `feet`,
  `weapon`, `offhand`, `charm`). Equipar troca com o que estava naquela parte; arma de duas mãos (`duasMaos`)
  e escudo não andam juntos (o outro volta para a mochila; sem espaço, o servidor recusa com `bag_full`). A soma dos equipamentos (`Player.bonus`) entra na vida máxima,
  no dano do estilingue e da Bordunada e na defesa (cada golpe recebido perde `defesa`, mínimo 1).
- O navegador só pede (`item` com `equip`/`use`/`drop` e o espaço; `unequip` com a parte); o servidor confere
  tudo (espaço vazio, desmaiado, vida cheia, espera entre consumíveis) e responde com `inv` ou `fail` (`item: true`).
- Salva junto com o personagem (coluna `inventory`, JSON; versão 2 do arquivo). Ao carregar, itens que não existem
  mais em `data/items.json` saem e pilhas grandes demais são cortadas. As partes novas (luvas, botas, escudo)
  não precisaram de passo novo em `MIGRATIONS`: o JSON antigo só não tem essas chaves, e elas começam vazias.
- **O que cada um veste aparece para os outros:** `EntityState.gear` (parte → id do item) vai no `spawn`/`welcome`,
  e a mensagem `gear` avisa quem está vendo quando alguém troca. O navegador descobre o desenho pelo `aparencia`
  do item (que chega no `welcome`).
- `MEUMMO_ITENS_TESTE=1 npm start`: todo personagem que entra ganha um de cada equipamento (só para testar).

## Personagem em camadas (`src/client/game/doll/`)
O personagem é um "boneco de papel" desenhado por código, com o dobro de pixels do mapa (quadro 64x64, mostrado
na metade do tamanho; por isso o zoom da câmera é sempre par). O corpo tem ~52 px de altura (cabeça de 12 px,
pernas longas) e a sobra dos lados do quadro é para armas e golpes.
- `poses.ts` — o esqueleto: para cada animação (`idle` 4 quadros, `walk` 6, `run` 4, `shoot` 3, `swing` 4,
  `hurt`, `ko`) e cada vista (`down`, `up`, `side`; a esquerda é a direita espelhada), onde ficam mãos e pés, a
  inclinação do corpo e o ângulo da arma. Cotovelos e joelhos são calculados (cinemática inversa).
- `raster.ts` — o "pincel": esferas, cápsulas e polígonos com volume, em 5 tons de cada material (`palette.ts`,
  sombras puxando para o roxo e brilhos para o amarelo); contorno colorido e linha interna onde uma parte cobre outra.
- `body.ts` — cores que vêm do nome (as mesmas de antes), dois tipos de corpo (`forte` e `esguio`) e penteados
  feitos de mechas (cada mecha é uma parte, então aparece a linha que separa os fios). `shapes.ts` tem o contorno
  do tronco, que o colete e a armadura seguem. `compose.ts` monta o corpo
  e decide a ordem das camadas em cada vista; `gear.ts` desenha cada tipo de equipamento preso aos ossos (por isso
  tudo acompanha as animações). Os parâmetros de cada visual ficam em `src/client/game/gearArt.ts`.
- `face.ts` — o rosto é outra camada (pisca, careta, sorriso, boca falando), então não precisa de uma textura
  por expressão. `animator.ts` (fora da pasta) escolhe quadro e expressão a cada momento.
- `characters.ts` junta tudo numa textura por combinação aparência + roupa (dividida entre quem é igual),
  desenhada aos poucos (uma vista por quadro do jogo) para não engasgar; na troca de roupa, a antiga fica na tela
  até a nova ficar pronta. `gearIcon.ts` faz o ícone da mochila a partir do mesmo desenho.
- `npm run render:characters` desenha uma prancha com exemplos em `docs/personagens.png`.

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
| cliente | `chat` / `ping` | falar / medir a latência |
| servidor | `welcome` / `reject` | entrou (com seus números) / recusado (nome inválido, senha errada ou curta, tentativas demais, servidor cheio, versão) |
| servidor | `bye` | sua sessão acabou: entrou com o personagem em outro lugar, ou o servidor está desligando |
| servidor | `spawn` / `despawn` | alguém (jogador ou monstro) entrou / saiu da sua área de visão |
| servidor | `move` | alguém que você vê andou, virou ou rolou |
| servidor | `ack` / `teleport` | sua posição oficial depois do passo `seq` / você foi levado para outro lugar |
| servidor | `shot` / `shot_end` | um projétil saiu / acabou (e em quem acertou) |
| servidor | `warn` | aviso no chão: golpe vindo nestes quadrados |
| servidor | `fx` | efeito visual (arco, giro, bote, esquiva, redemoinho) |
| servidor | `hit` / `heal` / `hp` | dano / cura / vida atual de alguém |
| servidor | `death` / `levelup` | alguém caiu / subiu de nível |
| servidor | `stats` / `cd` / `fail` | sua XP, nível, dano e defesa / recarga de habilidade / pedido recusado (ex.: recarregando) |
| servidor | `inv` / `loot` | sua mochila mudou / você pegou estes itens do monstro que caiu em (x, y) |
| servidor | `gear` | alguém (ou você) trocou o que está vestindo: redesenhe o personagem |
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
- Arquivo: `public/assets/maps/world.tmj`, tileset embutido chamado `tiles` (imagem `public/assets/tiles.png`).
- Camadas de tiles: `ground` (chão) e `decor` (árvores, casas, flores…). Pode criar outras.
- Propriedades dos tiles: `colide` (bloqueia a passagem) e `bloqueiaTiro` (segura projéteis).
- Um objeto do tipo ponto chamado `spawn` marca onde os jogadores nascem.
- Camada de objetos `monstros`: cada retângulo é uma área de nascimento. O nome do retângulo é o id do
  monstro em `data/monsters.json` (ex.: `jararaca`) e a propriedade inteira `quantidade` diz quantos.
- Propriedades do próprio mapa (Map > Map Properties): `nome` (texto) é o nome da zona — aparece na tela ao
  entrar e nas boas-vindas do chat — e `seguro` (booleano) marca zona segura (para o PvP, quando existir).
  Sem `nome`, a zona se chama "Pindorama".
- Salve em formato CSV e não use mapa infinito (o servidor explica o erro se isso acontecer).
- O mapa atual (Refúgio de Guarapiranga, 96×72) foi gerado por `scripts/gen-map.ts` e pode ser editado à mão
  no Tiled. Gerar de novo por cima apaga essas edições: use `npm run gen:map -- --out outro.tmj` para comparar.
- A arte provisória dos tiles é desenhada por `scripts/tileset.ts` (`npm run gen:tiles`). Tiles novos entram
  sempre **no fim** da lista: os mapas guardam o número de cada tile, então mudar a ordem bagunça o mapa.
- O servidor lê o mapa e os monstros quando liga: depois de editar, reinicie o servidor e recarregue o jogo.
