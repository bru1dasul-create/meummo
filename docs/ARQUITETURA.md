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
  `data/monsters.json`; `session.ts` cuida de uma conexão; `server.ts` liga HTTP, WebSocket e o relógio.
- `src/client` — o jogo no navegador. `game/WorldScene.ts` é a cena principal; `game/effects.ts` desenha
  avisos, tiros e golpes; `game/EntityView.ts` desenha cada personagem/monstro; `ui.ts` é a interface em HTML.
- `data/monsters.json` — os números de cada monstro (vida, dano, velocidade, avisos), em português.

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

## Mensagens
O cliente envia uma mensagem por vez; o servidor envia uma lista de mensagens por tick.

| Quem envia | Mensagem | Para quê |
|---|---|---|
| cliente | `hello` | entrar com um nome |
| cliente | `step` | pedir um passo (com número de sequência); com `dash: true` é a esquiva |
| cliente | `shoot` | atirar com o estilingue no ângulo `a` |
| cliente | `skill` | usar a habilidade `n` mirando no ângulo `a` |
| cliente | `chat` / `ping` | falar / medir a latência |
| servidor | `welcome` / `reject` | entrou (com seus números) / recusado (nome inválido, repetido, servidor cheio, versão) |
| servidor | `spawn` / `despawn` | alguém (jogador ou monstro) entrou / saiu da sua área de visão |
| servidor | `move` | alguém que você vê andou, virou ou rolou |
| servidor | `ack` / `teleport` | sua posição oficial depois do passo `seq` / você foi levado para outro lugar |
| servidor | `shot` / `shot_end` | um projétil saiu / acabou (e em quem acertou) |
| servidor | `warn` | aviso no chão: golpe vindo nestes quadrados |
| servidor | `fx` | efeito visual (arco, giro, bote, esquiva, redemoinho) |
| servidor | `hit` / `heal` / `hp` | dano / cura / vida atual de alguém |
| servidor | `death` / `levelup` | alguém caiu / subiu de nível |
| servidor | `stats` / `cd` / `fail` | sua XP e nível / recarga de habilidade / pedido recusado (ex.: recarregando) |
| servidor | `say` / `chat` / `sys` | balão de fala / chat / aviso do sistema |
| servidor | `online` / `pong` | quantos estão online / resposta do ping |

Os tipos exatos estão em `src/shared/protocol.ts`.

## Segurança que já existe
- Toda mensagem do cliente é validada (`src/server/validate.ts`); mensagens grandes são recusadas.
- Limite de mensagens por segundo e limite próprio para o chat; quem insiste em mandar lixo é desconectado.
- Tiros, habilidades e esquiva respeitam as recargas no servidor (o cliente não consegue atirar mais rápido).
- O chat é limpo no servidor e sempre mostrado como texto, nunca como HTML.
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
