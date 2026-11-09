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
desenhadas no mapa (camada `monstros`; veja `docs/mapa-refugio.png`).

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

## Itens e equipamentos (feito no M2)
Os números ficam em `data/items.json`; o que cada monstro deixa, na lista `itens` de `data/monsters.json`.

- **Cada um com o seu:** quando um monstro cai, cada pessoa que ajudou sorteia os itens dele e eles vão direto
  para a mochila (ninguém rouba o item de ninguém, e no celular não precisa ficar catando coisa no chão).
- **Mochila** com 20 espaços (itens iguais se empilham) e 4 partes para equipar: arma, cabeça, corpo e amuleto.
- **Atributos:** equipamentos somam dano, vida e defesa. Defesa tira um pouco de cada golpe, mas sempre sobra 1.
- **Consumíveis** curam; entre um e outro há uma pequena espera (a banana não substitui a esquiva).
- **Lendário:** quando alguém consegue um, todo mundo vê no chat.
- **Dá para ver:** tudo que está equipado aparece no personagem, para todo mundo (chapéu ou gorro na cabeça,
  gibão ou couraça no corpo, a arma na mão, o amuleto no peito), e no boneco da mochila.

| Item | Tipo | O que faz | Quem deixa |
|---|---|---|---|
| Banana | consumível | cura 15 | Sagui (50%, 1–2) e Saci (sempre, 2–3) |
| Couro de Jararaca | material | (para trocas e missões, mais adiante) | Jararaca (45%) |
| Chapéu de Palha | cabeça | +10 de vida | Sagui (6%) |
| Estilingue de Goiabeira (raro) | arma | +2 de dano | Sagui (4%) |
| Colar de Presas (raro) | amuleto | +1 de dano, +1 de defesa | Jararaca (6%) |
| Gibão de Couro (raro) | corpo | +8 de vida, +2 de defesa | Jararaca (5%) |
| Gorro Vermelho do Saci (lendário) | cabeça | +2 de dano, +15 de vida | Saci (30%) |

Ideias para depois: loja e ouro (M3), artesãos que transformam couro em
roupa, equipamentos com nível mínimo, poções do Curandeiro.

## Progressão no futuro
- **Caminhos (classes)**, escolhidos depois de alguns níveis: Capoeirista (corpo a corpo, ágil),
  Curandeiro(a) (ervas, rezas e cura do grupo) e Caçador(a) (distância).
- **Mais equipamentos** que mudam o jeito de jogar, não só os números: bordunas, estilingues que atiram duas
  pedras, amuletos com poderes das lendas.

## O mundo: Pindorama — Selva de Pedra (ideia do dono do projeto, aprovada)
São Paulo, muito tempo depois do fim do mundo como conhecemos: a floresta engoliu a cidade e as lendas
voltaram a andar por aí. O mapa começa pela Zona Sul.

| Zona | Nível | Como é | Situação |
|---|---|---|---|
| **Refúgio de Guarapiranga** | inicial (zona segura) | A represa virou um lago sagrado. Vilas flutuantes de madeira e restos de barcos, cercadas por floresta densa. Lugar para aprender a jogar. | ✅ é o mapa atual |
| **Ruínas de Santo Amaro** | intermediário | O antigo centro comercial virou um labirinto de prédios caídos tomados pela vegetação. Sucata e fios da tecnologia antiga misturados com plantas medicinais. | ✅ mapa e criaturas (níveis 4 a 8) |
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

### Ruínas de Santo Amaro (o mapa)
- **A entrada:** a avenida que sai do Refúgio continua pelo oeste e corta a zona inteira; carros e um ônibus
  enferrujados, bueiros, postes tortos com fios caídos.
- **Os quarteirões:** prédios mortos vistos de cima (lajes rachadas e furadas), com a fachada virada para a rua —
  janelas quebradas, paredes engolidas pelo cipó e as portas de aço das lojas que fecharam para sempre (as placas
  apagaram: nada de marcas).
- **Os desabados:** sete prédios caíram e viraram clareiras de entulho, sucata, pneus, ossos, árvores secas e
  **ervas de cura** nascendo no concreto. É onde vivem as criaturas da zona.
- **O largo:** no meio de tudo, o chafariz seco cercado de ervas, árvores secas e ipês floridos — a única cor forte
  do lugar ("um pouco dos dois": a cidade cinza e pesada, a vida teimando no meio dela).
- Quem desmaia aqui acorda no Refúgio (não há vila em Santo Amaro).

| Criatura | Nível | Onde vive | Jeito | Golpe | Deixa |
|---|---|---|---|---|---|
| Corpo-Seco | 4 | prédios desabados do oeste | Morto-vivo lento e resistente; só nota quem chega bem perto | Agarra quem está do lado (aviso de 0,7 s) | Sucata, Ramo de Arruda, Faca de Sucata (rara, +4 de dano) |
| Capelobo | 6 | prédios desabados do leste | Rápido; cabeça de tamanduá | Língua comprida: bote em linha de 3 tiles | Ramo de Arruda, Couraça de Lata (rara, +15 vida, +3 defesa) |
| Mula sem Cabeça | 8 (chefe) | o largo do chafariz | Agressiva, nota quem entra no largo | **Investida**: marca uma linha de 6 tiles, atravessa atropelando e deixa o chão pegando fogo por 2,5 s | Arruda (sempre), **Ferradura em Brasa** (lendária, +3 dano, +2 defesa) |

Dica para a Mula: saia da linha vermelha **para o lado** (ou use a Esquiva no momento certo) e não pare em cima do fogo.

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
