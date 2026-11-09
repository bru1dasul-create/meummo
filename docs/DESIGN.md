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
**Um pouco dos dois** (decidido com o dono do projeto): colorido e vivo onde tem gente — a floresta bonita
tomando a cidade, ipês floridos, vilas cheias de vida — e mais sombrio e pesado longe delas: ruínas, carros
enferrujados, ossos, água escura e lendas da noite. O humor continua (o Saci é travesso).
Sem violência explícita: quem perde a vida **desmaia** e acorda na vila.

## O que o jogador faz (o "loop")
1. Sai da vila flutuante pelos píeres e explora as margens da represa.
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

## Criaturas do Refúgio de Guarapiranga
Os números ficam em `data/monsters.json` (dá para ajustar sem programar). As áreas de cada uma estão
desenhadas no mapa (camada `monstros`; veja `docs/mapa.png`).

| Criatura | Nível | Onde vive | Jeito | Golpe |
|---|---|---|---|---|
| Sagui Travesso | 1 | matas ao norte da represa | Na dele até apanhar; depois mantém distância | Joga frutas (projétil lento, dá para desviar) |
| Jararaca | 2 | brejo ao sul da represa | Agressiva e lenta | Bote em linha (2 quadrados), aviso de 0,65 s |
| Saci | 5 (mini-chefe) | praça em ruínas perto da avenida, a leste | Agressivo e rápido | Giro em volta dele (3×3); depois some num redemoinho e reaparece longe. Se você fugir, ele surge do seu lado |

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

## O mundo: Pindorama — Selva de Pedra (ideia do dono do projeto, aprovada)
São Paulo, muito tempo depois do fim do mundo como conhecemos: a floresta engoliu a cidade e as lendas
voltaram a andar por aí. O mapa começa pela Zona Sul.

| Zona | Nível | Como é | Situação |
|---|---|---|---|
| **Refúgio de Guarapiranga** | inicial (zona segura) | A represa virou um lago sagrado. Vilas flutuantes de madeira e restos de barcos, cercadas por floresta densa. Lugar para aprender a jogar. | ✅ é o mapa atual |
| **Ruínas de Santo Amaro** | intermediário | O antigo centro comercial virou um labirinto de prédios caídos tomados pela vegetação. Sucata e fios da tecnologia antiga misturados com plantas medicinais. | próxima zona (M3) |
| **Labirintos da Billings** | farm e perigo | Canais e pântanos no extremo sul, com jacarés mutantes e espíritos da água (Boto, Lobisomem da Mata). | depois |
| **Selva do Centro** (Paulista e Sé) | alto nível / fim de jogo | Arranha-céus viraram masmorras verticais: escalar as ruínas do MASP e das torres de antena até os chefes no topo. | fim de jogo |

### Refúgio de Guarapiranga (feito)
- **A vila** flutua no meio da represa: decks de madeira sobre palafitas, casas de tábua com telhado de zinco,
  uma fogueira no centro e barcos velhos amarrados. É onde todo mundo nasce e volta depois de desmaiar.
- **Quatro píeres** levam às margens. Ao norte, matas com ipês amarelos e rosas (saguis); ao sul, um brejo de
  lama e taboas (jararacas); a oeste, trilhas pela mata.
- **A avenida a leste:** asfalto rachado, postes, carros enferrujados e muros pichados — a cidade antiga
  aparecendo no meio do verde. Perto dela fica a praça em ruínas do Saci, com ossos pelo chão. A avenida segue
  até a borda do mapa: é por ali que vai ficar a saída para as Ruínas de Santo Amaro.
- **A represa:** a água funda é mais escura; dá para atirar por cima da água, mas não para nadar.
  Barcos afundados aparecem pelo caminho.
- Ao entrar, o nome da zona aparece na tela ("Refúgio de Guarapiranga — Zona segura"). O nome e o "zona
  segura" são propriedades do mapa no Tiled (`nome` e `seguro`), então cada zona nova já nasce com os seus.

**Facções (PvP por território, mais adiante):**
- **Tecnocratas — os Herdeiros da Pedra:** reconstroem a tecnologia antiga; armaduras de lataria de carro,
  armas de plasma improvisadas; querem desmatar para reerguer as fábricas.
- **Escolhidos de Pindorama — os Guardiões:** fundidos com a magia da floresta; armaduras de troncos e ossos,
  magia xamânica e arcos reforçados; querem que a floresta tome o planeta.

**Notas para fazer por partes (para não repetir o excesso de escopo):**
- ✅ A vila virou o Refúgio de Guarapiranga. As outras zonas entram uma por vez no M3 (vários mapas),
  começando pelas Ruínas de Santo Amaro. Facções e PvP de território ficam para o M4/M5, depois de existir
  gente jogando.
- Usar nomes de lugares reais é ótimo para a identidade; evitar **marcas** (ex.: nome de operadora de telefone
  numa torre): chamar de "torre de antenas", "torre da Paulista" etc.

Ideia anterior (substituída por Pindorama): regiões inspiradas nos biomas (Mata Atlântica, Cerrado, Pantanal,
Caatinga, Amazônia e Litoral). Pode voltar no futuro como terras além de São Paulo.

## Sugestões de nome do jogo
Pindorama Online · Lendas de Pindorama · Encantados · Mata Adentro · Terra Encantada

## Fora de escopo por enquanto
PvP, crafting, economia complexa, montarias e casas de jogadores. Só depois que o básico estiver divertido.
