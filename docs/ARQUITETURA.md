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

- `src/shared` — regras que o jogo e o servidor precisam aplicar igualzinho: movimento, leitura do mapa,
  busca de caminho, validação de nomes e o formato das mensagens.
- `src/server` — quem manda no mundo. `world.ts` não sabe nada de rede (fácil de testar);
  `session.ts` cuida de uma conexão; `server.ts` liga HTTP, WebSocket e o relógio.
- `src/client` — o jogo no navegador. `game/WorldScene.ts` é a cena principal.

## O servidor manda
O cliente nunca diz "estou na posição X". Ele pede "quero andar para a direita" (`step`). O servidor:
1. coloca o pedido na fila daquele jogador;
2. a cada tick (20 por segundo) processa os passos no ritmo certo: no máximo 1 tile a cada 200 ms;
3. confere no mapa se o tile está livre;
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

## Mensagens
O cliente envia uma mensagem por vez; o servidor envia uma lista de mensagens por tick.

| Quem envia | Mensagem | Para quê |
|---|---|---|
| cliente | `hello` | entrar com um nome |
| cliente | `step` | pedir um passo (com número de sequência) |
| cliente | `chat` | falar |
| cliente | `ping` | medir a latência |
| servidor | `welcome` / `reject` | entrou / recusado (nome inválido, repetido, servidor cheio, versão) |
| servidor | `spawn` / `despawn` | alguém entrou / saiu da sua área de visão |
| servidor | `move` | alguém que você vê andou ou virou |
| servidor | `ack` | sua posição oficial depois do passo `seq` |
| servidor | `chat` / `sys` | fala de jogador / aviso do sistema |
| servidor | `online` / `pong` | quantos estão online / resposta do ping |

Os tipos exatos estão em `src/shared/protocol.ts`.

## Segurança que já existe
- Toda mensagem do cliente é validada (`src/server/validate.ts`); mensagens grandes são recusadas.
- Limite de mensagens por segundo e limite próprio para o chat; quem insiste em mandar lixo é desconectado.
- O chat é limpo no servidor e sempre mostrado como texto, nunca como HTML.
- Conexões "zumbis" são derrubadas a cada 30 segundos.

## Mapas (Tiled)
- Arquivo: `public/assets/maps/world.tmj`, tileset embutido chamado `tiles` (imagem `public/assets/tiles.png`).
- Camadas de tiles: `ground` (chão) e `decor` (árvores, casas, flores…). Pode criar outras.
- Tiles com a propriedade booleana `collides = true` bloqueiam a passagem.
- Um objeto do tipo ponto chamado `spawn` marca onde os jogadores nascem.
- Salve em formato CSV e não use mapa infinito (o servidor explica o erro se isso acontecer).
- O servidor lê o mapa quando liga: depois de editar, reinicie o servidor e recarregue o jogo.
