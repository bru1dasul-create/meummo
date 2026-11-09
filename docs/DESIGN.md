# Design do jogo

> Nome provisório: **MeuMMO**. Sugestões de nome no fim. Tudo aqui pode mudar — é o ponto de partida.

## A ideia em uma frase
Um MMORPG de **ação** em 2D, que abre no navegador do PC e do celular, onde você e seus amigos enfrentam
as **lendas do folclore brasileiro**.

## Por que alguém jogaria o nosso
- **Folclore brasileiro.** Saci, Curupira, Iara, Boitatá, Mula sem Cabeça, Mapinguari... quase nenhum jogo
  explora isso. É familiar para quem é daqui e misterioso para quem não é.
- **Ação fácil de aprender:** mira, atira e desvia. Os monstros **avisam** os golpes (quadrados vermelhos
  no chão), então dá para jogar bem mesmo com internet ruim ou no celular.
- **Abre com um link.** Sem instalar nada.
- **Jogar junto vale a pena:** todo mundo que ajudou a derrubar um monstro ganha a XP inteira.

## Tom
Aventura leve e colorida, com humor (o Saci é travesso) e um pouco de mistério (lendas da noite, no futuro).
Para todas as idades.

## O que o jogador faz (o "loop")
1. Sai da vila e explora.
2. Enfrenta criaturas, aprende os avisos de cada uma e desvia.
3. Ganha XP, sobe de nível e fica mais forte (mais vida e mais dano).
4. Vai para áreas mais perigosas e enfrenta lendas maiores (chefes).
5. Volta para a vila para conversar, juntar grupo e se recuperar.

## Combate (feito no M1)
| Ação | Computador | Celular | Como funciona |
|---|---|---|---|
| Estilingue | mira com o mouse, clique (segure para continuar) | toque no monstro ou segure o botão | pedrinha que voa 7 quadrados; árvores e paredes seguram, água não |
| Bordunada | `Q` (mira no mouse) | botão (mira no monstro mais perto) | acerta os 3 quadrados à frente; 2,2× o dano; recarga 4 s |
| Fôlego | `E` | botão | cura 30% da vida; recarga 20 s |
| Esquiva | `Espaço` | botão | rola 3 quadrados, fica invencível por 0,35 s; recarga 2,5 s |

- **Avisos:** antes de cada golpe, o monstro marca no chão onde vai acertar e o vermelho vai enchendo.
  Quem sai da área a tempo não leva dano.
- **Desmaio:** com a vida zerada, você desmaia e volta para a vila em 3 s, com 2 s de proteção.
  Por enquanto não perde nada.
- **Recuperação:** depois de 6 s sem apanhar, a vida volta sozinha.
- **Sons:** cada ação tem um som curto; um bip avisa quando um golpe vai cair exatamente onde você está.
- **Níveis:** cada nível dá mais vida e dano. A XP necessária cresce aos poucos (fórmula em
  `src/shared/progression.ts`).

## Criaturas da primeira região
Os números ficam em `data/monsters.json` (dá para ajustar sem programar).

| Criatura | Nível | Jeito | Golpe |
|---|---|---|---|
| Sagui Travesso | 1 | Na dele até apanhar; depois mantém distância | Joga frutas (projétil lento, dá para desviar) |
| Jararaca | 2 | Agressiva e lenta; fica no capinzal | Bote em linha (2 quadrados), aviso de 0,65 s |
| Saci | 5 (mini-chefe) | Agressivo e rápido | Giro em volta dele (3×3); depois some num redemoinho e reaparece longe. Se você fugir, ele surge do seu lado |

## Próximas lendas (ideias para os próximos marcos)
- **Curupira** — guardião da mata. Pode ser um NPC de missões ("proteja a floresta") ou um chefe com
  pegadas ao contrário que confundem quem tenta segui-lo.
- **Iara** — no lago e nos rios. Canto que puxa o jogador para perto da água; a esquiva quebra o encanto.
- **Boitatá** — serpente de fogo, chefe. Deixa rastros de fogo no chão (áreas que machucam).
- **Mula sem Cabeça** — aparece à noite; investida em linha reta soltando fogo.
- **Mapinguari** — chefe gigante da mata fechada; golpes lentos, fortes e com área grande.
- **Lobisomem** — noites de lua cheia; rápido e agressivo.
- **Cuca** — chefe de caverna (primeira "masmorra").
- Bichos comuns: quati, capivara, tamanduá, arara e onça (elite).

## Progressão no futuro
- **Caminhos (classes)**, escolhidos depois de alguns níveis: Capoeirista (corpo a corpo, ágil),
  Curandeiro(a) (ervas, rezas e cura do grupo) e Caçador(a) (distância).
- **Equipamentos** que mudam o jeito de jogar: estilingues melhores, bordunas, chapéu de palha, amuletos.

## O mundo
- Nome sugerido para o mundo: **Pindorama** ("terra das palmeiras", nome tupi para estas terras).
- Regiões inspiradas nos biomas: Mata Atlântica (início), Cerrado, Pantanal, Caatinga, Amazônia e Litoral.
- Primeira cidade: a vila do poço (o mapa atual).

## Sugestões de nome do jogo
Pindorama Online · Lendas de Pindorama · Encantados · Mata Adentro · Terra Encantada

## Fora de escopo por enquanto
PvP, crafting, economia complexa, montarias e casas de jogadores. Só depois que o básico estiver divertido.
