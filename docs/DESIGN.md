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
| Esquiva | `Shift` (dá para trocar) | botão | rola 3 quadrados, fica invencível por 0,35 s; recarga 2,5 s |

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
| Sagui Travesso | 1 | matas ao norte da represa | Implica com quem chega perto (4 quadrados) e mantém distância | Joga frutas (projétil lento, dá para desviar) |
| Jararaca | 2 | brejo ao sul da represa | Agressiva e lenta | Bote em linha (2 quadrados), aviso de 0,65 s |
| Saci | 5 (mini-chefe) | praça em ruínas perto da avenida, a leste | Agressivo e rápido | Giro em volta dele (3×3); depois some num redemoinho e reaparece longe. Se você fugir, ele surge do seu lado |

## Missões (feito no M3)
O **Curupira**, guardião da mata, fica na beira da mata ao norte da vila e dá missões: espantar os saguis,
trazer couro de jararaca, enfrentar o Saci e, depois, cuidar da mata de vez em quando (repetível). Missão nova
aparece com **!** em cima dele; pronta para entregar, com **?**. A recompensa é XP, ouro e itens (o Gibão de
Couro vem do Curupira para quem traz os couros). Tudo em `data/missoes.json`, para ajustar sem programar.

## Próximas lendas (ideias para os próximos marcos)
- **Curupira** — já é o NPC de missões da vila. Mais adiante pode ganhar uma versão chefe, com pegadas ao
  contrário que confundem quem tenta segui-lo.
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
| **Ruínas de Santo Amaro** | intermediário | O antigo centro comercial virou um labirinto de prédios caídos tomados pela vegetação. Sucata e fios da tecnologia antiga misturados com plantas medicinais. Ao sul, o Terminal Santo Amaro, com os ônibus parados para sempre; ao lado do largo, o Shopping do Largo Treze. | ✅ mapa e criaturas (níveis 4 a 8), o terminal e o shopping |
| **Represa Billings** (os Labirintos) | farm e perigo | Canais e pântanos ao sul do brejo, com jacarés mutantes e espíritos da água (Iara, Boto, Lobisomem da Mata). | ✅ mapa e criaturas (Iara, a chefe; jacarés e botos) |
| **Selva do Centro** (Paulista e Sé) | alto nível / fim de jogo | Arranha-céus viraram masmorras verticais: escalar as ruínas do MASP e das torres de antena até os chefes no topo. | fim de jogo |

### Refúgio de Guarapiranga (feito)
- **A vila** flutua no meio da represa: decks de madeira sobre palafitas, casas de tábua pintadas (azul, verde,
  terracota, amarelo) com telhado de zinco e janelas acesas, uma fogueira no centro com bandeirinhas de festa
  junina entre as lamparinas, varais de roupa, redes de pesca secando, cestos de peixe e barcos velhos
  amarrados. É onde todo mundo nasce e volta depois de desmaiar.
- **Quatro píeres** levam às margens. Ao norte, matas com ipês amarelos e rosas (saguis); ao sul, um brejo de
  lama e taboas (jararacas); a oeste, trilhas pela mata.
- **A avenida a leste:** asfalto rachado, postes, carros enferrujados e muros pichados — a cidade antiga
  aparecendo no meio do verde. Perto dela fica a praça em ruínas do Saci, com ossos pelo chão. A avenida segue
  até a borda do mapa: é por ali que vai ficar a saída para as Ruínas de Santo Amaro.
- **A represa:** a água funda é mais escura; dá para atirar por cima da água, mas não para nadar.
  Barcos afundados aparecem pelo caminho.
- Ao entrar, o nome da zona aparece na tela ("Refúgio de Guarapiranga — Zona segura"). O nome e o "zona
  segura" são propriedades do mapa no Tiled (`nome` e `seguro`), então cada zona nova já nasce com os seus.

### Represa Billings (o mapa)
- **A chegada:** a trilha do brejo do Refúgio desce até a borda de cima da Billings.
- **O labirinto:** canais de água verde (cheia de vida depois de anos parada) cortam o mato de brejo em ilhas,
  ligadas por passarelas de madeira — tem caminho que dá a volta e tem ilha que só se alcança pela passarela
  certa. Buritis na beira d'água, aguapés com flor lilás boiando, taboas e vaga-lumes piscando na neblina.
- **O lago:** a represa aberta, no sul, com a parte funda escurecendo. A ponte da rodovia antiga atravessa o lago e
  caiu no meio (dá para andar até a ponta quebrada). Casas afundadas mostram só o telhado.
- **A usina velha:** um prédio de concreto numa ilha do nordeste, com sucata em volta.
- **A prainha da Iara:** areia de frente para uma pedra grande no meio d'água, onde ela canta.
- **Criaturas:** a Iara (a chefe, uma só) na prainha e na pedra, o Jacaré Mutante nos canais do oeste (3) e o Boto
  Encantado no lago das casas afundadas (2); e as de fora: Jararacas nas ilhas perto da entrada, Corpo-Seco no
  leste (usina e casas afundadas) e Capelobo nas matas da beira do lago. Quem desmaia aqui acorda no Refúgio.
- **As criaturas de lá** (em `data/monsters.json`):

  | Criatura | Nível | Jeito | Golpe | Deixa |
  |---|---|---|---|---|
  | Jacaré Mutante (`jacare`) | 5 | Agressivo de perto, lento na terra, não persegue longe da água | Abocanhada em linha (2 quadrados), aviso de 0,75 s, dano alto | Dente de Jacaré (vale ouro), arruda |
  | Boto Encantado (`boto`) | 6 | Ataca quem chega perto (6 quadrados) e mantém distância | Jato d'água (projétil) | Arruda, Colar de Presas (raro) |
  | Iara (`iara`, chefe) | 8 | Agressiva; fica a 2 tiles de quem enfrenta | Jato d'água forte; a cada 10 s **canta**: o chão em volta dela (5 tiles) fica marcado por 1,3 s e quem ficar é **encantado** por 3 s — não anda e é puxado um passo para perto dela a cada 0,45 s. A **esquiva** quebra o encanto na hora (e quem estiver esquivando quando o canto acaba escapa) | Escama da Iara (rara, vale 45 na loja), arruda, Colar de Presas |

### Ruínas de Santo Amaro (o mapa)
- **A entrada:** a avenida que sai do Refúgio continua pelo oeste e corta a zona inteira; carros e um ônibus
  enferrujados, bueiros, postes tortos com fios caídos.
- **Os quarteirões:** prédios mortos vistos de cima (lajes rachadas e furadas), com a fachada de dois andares virada
  para a rua — janelas quebradas e pichação lá no alto, a marquise de concreto, lambe-lambes rasgados, paredes
  engolidas pelo cipó e as portas de aço das lojas que fecharam para sempre (as placas apagaram: nada de marcas).
- **Os desabados:** sete prédios caíram e viraram clareiras de entulho, sucata, pneus, ossos, árvores secas e
  **ervas de cura** nascendo no concreto. É onde vivem as criaturas da zona.
- **O largo:** no meio de tudo, o chafariz seco cercado de ervas, árvores secas e ipês floridos — a única cor forte
  do lugar ("um pouco dos dois": a cidade cinza e pesada, a vida teimando no meio dela). Brasas da Mula pelo chão,
  soltando faíscas, e tambores com fogo na beirada.
- **O clima:** neblina passando devagar por cima de tudo e o lugar um pouco mais escuro que o Refúgio; as luzes
  (fogo, brasas) aparecem no meio da penumbra.
- Quem desmaia aqui acorda no Refúgio (não há vila em Santo Amaro).

| Criatura | Nível | Onde vive | Jeito | Golpe | Deixa |
|---|---|---|---|---|---|
| Corpo-Seco | 4 | prédios desabados do oeste | Morto-vivo lento e resistente; só nota quem chega bem perto | Agarra quem está do lado (aviso de 0,7 s) | Sucata, Ramo de Arruda, Faca de Sucata (rara, +4 de dano) |
| Capelobo | 6 | prédios desabados do leste | Rápido; cabeça de tamanduá | Língua comprida: bote em linha de 3 tiles | Ramo de Arruda, Couraça de Lata (rara, +15 vida, +3 defesa) |
| Mula sem Cabeça | 8 (chefe) | o largo do chafariz | Agressiva, nota quem entra no largo | **Investida**: marca uma linha de 6 tiles, atravessa atropelando e deixa o chão pegando fogo por 2,5 s | Arruda (sempre), **Ferradura em Brasa** (lendária, +3 dano, +2 defesa) |

Dica para a Mula: saia da linha vermelha **para o lado** (ou use a Esquiva no momento certo) e não pare em cima do fogo.

### Terminal Santo Amaro (o mapa)
- **A chegada:** a rua do meio de Santo Amaro desce para o sul, atravessa a mata da borda e chega na calçada larga
  do terminal, com canteiros tomados pelo mato.
- **A entrada:** o muro com as catracas no meio (e dois buracos nos lados, por onde o povo pulava) e a bilheteria
  com o vidro quebrado.
- **As plataformas A, B, C e D:** a cobertura de concreto ainda de pé, com a letra de cada plataforma na faixa
  (passa por baixo dela, como nas copas), furada e cheia de cipó; pilares, bancos e a faixa amarela da beirada.
  A última plataforma está mais destruída que as outras.
- **As pistas:** ônibus enferrujados parados onde estavam no dia em que tudo parou; faixas de pedestre cruzando as
  pistas e ruas dos lados ligando todas elas.
- **O fundo:** a parte que desabou virou mato, com entulho, árvores secas, um ônibus tombado e um acampamento com
  tambores de fogo (alguém ainda vive por ali?).
- **O clima:** neblina e penumbra como em Santo Amaro, só que um pouco menos.
- **Criaturas por enquanto:** Corpo-Seco nas plataformas e Capelobo no fundo. Quem desmaia aqui acorda no Refúgio.

### Shopping do Largo Treze (o mapa)
Lugar real, sem marca: é "o shopping do Largo Treze", o prédio do lado oeste do largo do chafariz.
- **A entrada:** em Santo Amaro, a fachada de vidro com o letreiro SHOPPING (o "I" caiu na marquise) e a porta no
  meio, de frente para a avenida. Lá dentro, o totem "você está aqui" e um tambor de fogo de quem acampa na porta.
- **O átrio:** a claraboia caiu e a mata entrou. No meio, o jardim onde o piso afundou: um ipê-amarelo, um ipê-rosa
  e uma árvore grande, com mato passando por cima do piso. O sol entra pelo buraco (o único lugar claro), a chuva
  enche o chafariz (com aguapés) e deixa poças; cacos de vidro e pedaços da estrutura pelo chão; as escadas
  rolantes paradas sobem para o andar de cima, que desabou.
- **Os corredores e as lojas:** três corredores com quiosques, bancos e floreiras; doze lojas com o letreiro apagado
  (sem nome de ninguém), porta de aço, vitrine quebrada com manequim e a entrada aberta: roupas (manequins e
  araras), farmácia (virou horta de ervas de cura), eletrônicos (sucata e fios), calçados (caixas) e as vazias,
  onde alguém acendeu fogo num tambor.
- **No norte:** o supermercado (gôndolas desbotadas, caixas e carrinhos largados), o cinema (letreiro CINEMA,
  cartazes de lenda — o Saci na lua, a Mula pegando fogo —, carpete vinho, poltronas, a tela rasgada e o carrinho
  de pipoca) e a praça de alimentação (lanchonetes com o cardápio desbotado, mesas viradas e o acampamento).
- **O clima:** escuro lá dentro (a luz vem do sol no átrio, das portas e dos tambores de fogo) e poeira no ar.
- **Criaturas por enquanto:** Corpo-Seco no supermercado e na ala leste, Capelobo no cinema e na ala oeste e o
  Saci na praça de alimentação. Quem desmaia aqui acorda no Refúgio.

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
