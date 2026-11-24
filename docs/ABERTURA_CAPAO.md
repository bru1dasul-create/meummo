# Abertura do Capão Redondo

Entrega preparada na branch `codex/abertura-capao` sobre a `main` de base `207ee7c`. O Curupira recebe o Desperto na clareira. A Xiovanna apresenta a vila no balcão, e os Saguis Encantados são o primeiro combate da missão.

## O que mudou no jogo

- **Visita à Budega.** A fachada indica a entrada pela praça. Ao clicar na Xiovanna do lado de fora, o Birim calcula a rota pela porta. Conversa, missão e loja abrem na área do freguês junto ao balcão. O servidor valida a mesma área em cada interação. O marcador de missão nos mapas indica a entrada enquanto o jogador está fora do balcão.
- **Birim na clareira.** A pele e a bermuda recebem um reflexo da cor do Círculo do Despertar. A intensidade diminui à medida que o Birim se afasta do centro.
- **Saguis Encantados.** Ao receber o evento de derrota de um sagui no Capão, o cliente mostra o encanto se desfazendo. O sagui pousa se estiver no galho, recupera a postura e corre por um trecho livre antes de desaparecer. A missão e as recompensas usam o resultado de combate calculado pelo servidor.

## Arquivos alterados

| Frente | Arquivo | Ajuste |
| --- | --- | --- |
| Mundo | [`public/assets/maps-iso/capao.tmj`](../public/assets/maps-iso/capao.tmj) | Dois objetos novos na camada `pontos`. `atendimento-budega` delimita o espaço do freguês no intervalo `x=65.9–67.3`, `y=51.55–52.55`. `entrada-budega` marca o ponto `x=66.5`, `y=55.2` na praça. As medidas são em metros. Os objetos receberam IDs 6742 e 6743. |
| Mundo | [`scripts/gen-capao.ts`](../scripts/gen-capao.ts) | Emite os mesmos dois objetos quando gera a vila com o interior da Budega. |
| Mundo | [`prototipos/pindorama-25d/js/world/budega.js`](../prototipos/pindorama-25d/js/world/budega.js) | Placa lateral com seta para a praça, destaque quente no vão da porta de enrolar e luz no degrau. |
| Estrutura | [`src/shared/map.ts`](../src/shared/map.ts) | `GameMap.npcCounter` consulta `atendimento-<id do NPC>` na camada `pontos`. `regionContains` aplica os mesmos limites no cliente e no servidor. |
| Estrutura | [`src/server/world.ts`](../src/server/world.ts) | `nearNpc` exige posição dentro da área de atendimento quando há um balcão marcado. A função atende as chamadas de conversa, missões, loja e receitas. |
| Estrutura | [`src/client/novo/engine.ts`](../src/client/novo/engine.ts) | `tapAt`, `checkNpcArrival` e `checkNpcDistance` levam o personagem ao balcão e validam a abertura e o fechamento da conversa. `drawMaps` posiciona o sinal na entrada. `onDeath` e `saguiRetreat` acionam a pacificação do sagui no Capão e escolhem um trecho livre, dando preferência à mata. |
| Estrutura | [`src/client/novo/view.ts`](../src/client/novo/view.ts) | Expõe `pacifySagui` no contrato opcional da vista 2,5D. |
| Arte | [`src/client/talk.ts`](../src/client/talk.ts) | Objetivos de conversa mostram a instrução em vez de aparecer com a barra cheia assim que são aceitos. |
| Arte | [`prototipos/pindorama-25d/js/view.js`](../prototipos/pindorama-25d/js/view.js) | `_awakeningLight` calcula e reaproveita as paletas de reflexo do Birim. `pacifySagui` retira a etiqueta e encerra o desenho ao fim da animação. |
| Arte | [`prototipos/pindorama-25d/js/creatures/sagui.js`](../prototipos/pindorama-25d/js/creatures/sagui.js) | Sequência de quebra do encanto, pouso, recuperação e corrida. Os olhos perdem o brilho, e as faíscas ficam no ponto em que o encanto se soltou. |
| Arte | [`prototipos/pindorama-25d/js/creatures/creature.js`](../prototipos/pindorama-25d/js/creatures/creature.js) | O desenho e a sombra aceitam a opacidade da corrida de saída. |
| Validação | [`tests/capao.test.ts`](../tests/capao.test.ts) | Confere que o marcador fica diante do vão da porta e que há rota até a área do caixa. |
| Validação | [`tests/shop.test.ts`](../tests/shop.test.ts) | Exercita conversa, missão e loja a partir da lateral, da entrada e do balcão no mapa real. |
| Validação | [`tests/sagui-art.test.ts`](../tests/sagui-art.test.ts) | Confere o clarão, a corrida e o desaparecimento do sagui no chão e no galho. |
| Registro | [`docs/ROADMAP.md`](ROADMAP.md) e este arquivo | Registram a entrega e localizam as mudanças para revisão pelas frentes. |

## Como conferir no jogo

`npm run check` passou com 663 testes, e `npm run build` gerou a versão de produção. Em uma cópia local com personagens de teste, o Chromium concluiu **O Despertar** a partir da lateral da Budega usando mouse e toque em tela de celular simulada. Nos dois casos, a conversa abriu no caixa.

No Chromium, o comando de teste **Derrubar monstros perto** disparou o evento do servidor para um sagui. A animação manteve o desenho durante a fuga, removeu o desenho ao fim e a missão avançou para `1/4`. Os testes de animação também conferiram a sequência de um sagui no galho.

1. Inicie o jogo com `npm run dev` e crie um personagem de teste. Na Clareira dos Despertos, caminhe do centro do círculo até a borda para conferir a transição de luz.
2. Aceite **O Despertar** com o Curupira. Vá pelo Portão I, contorne a Budega pela rua lateral e clique na Xiovanna. Observe o caminho até a porta. O diálogo abre quando o Birim chega em frente ao caixa. Clique em **Conversar** para receber a água de coco.
3. Aceite **Saguis Encantados**. Na mata do Capão, acerte um sagui até quebrar o encanto. Confira as faíscas, a corrida e o avanço da missão. Se estiver no galho, ele pousa antes de correr.

## Revisão com Claude Code

```bash
git fetch origin main refs/heads/codex/abertura-capao:refs/remotes/origin/codex/abertura-capao
git diff origin/main...origin/codex/abertura-capao --stat
git log --oneline origin/main..origin/codex/abertura-capao
```

O ponto de integração entre as frentes é a camada `pontos` do Capão. Se outro trabalho mexer no `capao.tmj`, confira os dois objetos pelo nome e preserve as alterações dos dois ramos no Tiled. Cliente e servidor devem carregar o mesmo mapa.
