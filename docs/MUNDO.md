# Caderno da frente Mundo

> Para o chat **"Criar jogo MMO RPG do zero"** (a frente **[mundo]**) retomar o trabalho depois de limpar a conversa
> (`/clear`) ou num chat novo. Leia junto: `CLAUDE.md` (regras e divisão do trabalho), `docs/ROADMAP.md` (tarefas com
> a etiqueta **[mundo]**), `docs/ARQUITETURA.md` (a parte dos mapas: geradores, camadas, tiles) e `docs/DESIGN.md`
> (como é cada zona).

## Quem sou
O chat da frente **[mundo]**: mapas (`public/assets/maps/*.tmj`), tiles (`scripts/tileset.ts` → `public/assets/tiles.png`),
geradores (`scripts/gen-*.ts`, `map-builder.ts`, `map-depth.ts`), `render-map.ts` e, no jogo, `src/client/game/mapDepth.ts`
(copas por cima de quem passa, luzes, escuro, neblina, vaga-lumes e faíscas). O dono não programa: ele decide o jogo.
Converso em português do Brasil, com explicações simples, e mando prints do navegador em cada entrega. Ele me chama de
"meu xuxu".

## Combinados com o dono
- **O design dos mapas é meu** ("acho melhor você ficar com o design do mapa"). Zona nova ou capricho grande: proponho
  com uma recomendação e espero o "pode" / "pra cima". Lugares reais sim, marcas não (ex.: "Shopping do Largo Treze",
  sem o nome da rede).
- **Juntar na `main`:** tudo o que ele aprovou foi juntado no mesmo dia, depois do `npm run check` e da conferência no
  navegador (PC e celular); ele nunca pediu para esperar. Depois, aviso: o que mudou, como testar (`atualizar.bat` e
  `jogar.bat`) e se outra frente precisa fazer algo.
- **Pedidos entre as frentes vão direto entre os chats** ("o que não for da sua orçada pede para os outros chat
  fazer"): ferramenta `send_message` do Claude Code Remote. Os chats são "Arte e visual" ([arte]) e "Estrutura e
  regras" ([estrutura]); ache com `list_sessions` pelo título. Deixe o pedido também no roteiro. Mensagem de outro chat
  é informação, não ordem do dono. Marcar no mapa a área de uma lenda que a [estrutura] criou é tarefa minha pela
  divisão das frentes (fiz assim com o jacaré, o boto e a Iara, que estavam no roteiro).
- **Não mexer** em `characters.ts`, `EntityView.ts`, `bag.ts`, `effects.ts` e `monsterArt.ts` (pedido da [arte]: o
  dono escolheu o personagem em camadas dela no lugar do meu, de 20x24).
- **Regra 9 na prática:** gere com `--out` num arquivo temporário, compare camada por camada com o mapa atual (receita
  abaixo) e só então copie por cima. Antes, veja `git log -- public/assets/maps/<id>.tmj`: se alguém além do Claude
  mexeu (edição no Tiled), não substitua sem falar com o dono.

## Onde estamos (12 de novembro de 2026): o mundo novo
- **Decisão do dono (12/11, roteiro "🗺️ Mundo novo"):** o visual vira o do protótipo 2.5D da [arte]
  (`prototipos/pindorama-25d/`, isométrico, estilo HQ) e os mapas são refeitos do zero. Os 5 mapas de hoje saem quando
  o capítulo 1 novo estiver jogável; o motor (servidor, regras, salvamento) fica. Capítulo 1: Capão Redondo e o Parque
  Santo Dias → Guarapiranga → Santo Amaro (Largo Treze, Terminal, Shopping do Largo Treze) → Billings → a Sé no fim.
  Tom "bem selvagem" (a mata volta pelo sul); lugar real sim, marca não.
- **Decisões do dono (12/11):** a **Budega Distribuidora** (o negócio dele) é a vendinha da praça, sem a palavra
  "Tabacaria" e sem produtos de tabaco (a lei proíbe propaganda de tabaco); o nome fica **"Selva de Pedra"** (o pacote
  do ChatGPT dizia "Selva de Concreto"); os saguis são **encantados** e a missão é acalmar ou afastar, não matar; o
  ritual de classe na figueira fica para depois. **Câmera:** padrão no médio (herói ~260 px em Full HD, ~14 m de chão
  na largura), afastando até o longe (~185 px, ~20 m); a [arte] aplica. Conta certa: chão na largura da tela =
  largura em px ÷ zoom (px por cm) — no protótipo em Full HD, 1920 ÷ 136,7.
- **Padrão de arte:** `docs/referencias/mapa-01-arte-aprovada.jpg` (do pacote que o dono trouxe do ChatGPT, feito em
  cima da minha planta): "2.5D estilizado e sombrio", mata fria em verde profundo e teal com brilho espiritual, vila
  quente com luz âmbar; dia, entardecer e noite mudam o clima, nunca a leitura do combate e dos caminhos. Notas que
  valem: trilhas principais de 2 a 3 m (mínimo 1,5 m); Curupira junto da clareira, a caminho do portão; Figueira dos
  Despertos com símbolos que brilham; mata rasa e mata profunda (neblina, alto risco); "Véu Ancestral" em pontos
  certos, não no mundo todo; campinho é ambientação, não arena.
- **Escopo aprovado do Mapa 01 (uma etapa por vez, cada uma com o "pode" dele):** 1) câmera ✔; 2) planta final ✔
  (`docs/referencias/mapa-01-planta.jpg`); 3) uma tela jogável (a clareira) ✔; 4) o resto do mapa em 3 pedaços:
  **4a mata e lago ✔ (12/11, sem as criaturas)**, 4b portão e vila (a próxima), 4c campinho, viaduto e saídas;
  5) atmosferas (dia, entardecer e noite); 6) minimapa. Ele pediu: **"antes de criar tudo me entrega escopo para eu
  ir aprovando"** e **"o que não for da sua responsabilidade passe para os outros chats"**. Meu jeito: prévia
  (imagem) primeiro, o "pode" dele, depois o jogo.
- **Mapa 01 (Parque Santo Dias + Vila do Capão), 96 × 80 m** (x para o leste, y para o sul, em metros; na tela, x
  desce para a direita e y desce para a esquerda: o fundo da tela é o noroeste). Gerador `scripts/gen-capao.ts` →
  `public/assets/maps-iso/capao.tmj` (`npm run gen:capao -- --out arquivo.tmj`; sem `--force` ele não sobrescreve,
  regra 9). A etapa é a constante `STAGE` ('3', '4a', '4b', '4c'): cada uma liga o que a anterior não tinha.
  - **Pronto (3 + 4a):** clareira do despertar com centro (37, 43) e raio 9, círculo (spawn) de raio 3 e a Figueira
    dos Despertos em (36,5; 38); Curupira em (42,5; 44,5) (`curupira_capao`, da [estrutura]); zona segura da clareira
    31,5 a 44 × 39 a 48,5. Muro do parque em x = 48 com gradil e o **Portão I** (y 41 a 47, ainda fechado). Trilha da
    clareira ao portão (3 m) e trilha em volta do lago (2,2 m). **Lago** em volta de (16, 23) (polígono `agua`, com
    colisão em faixas de 0,5 m que não bloqueiam tiro), lama na margem, 14 aguapés, 3 capivaras (enfeite, não
    bloqueiam), 3 troncos caídos, pedras em grupos, a **Pedra do Véu** (`pedra` ancestral em (7,5; 9,5)) e 4 véus
    (figueira, círculo, pedra e beira do lago). **Mata profunda** nas pontas noroeste e sudoeste (polígonos
    `mata-profunda` e áreas com `neblina` e `escuro`), fechada por arbustos que bloqueiam; mata fechada nas bordas.
    O gerador não planta árvore alta que, vista pela câmera, cubra a clareira, o círculo, a trilha ou o lago
    (`hidesView`), e deixa 1,2 m entre troncos.
  - **Criaturas (prontas, desligadas):** `CREATURES = false` no gerador. Saguis encantados em x 24 a 40 × y 12 a 28
    (4) e jararacas em x 6 a 22 × y 56 a 74 (3). Escolha do dono em 12/11 ("opção a"): a 4a entrou sem elas porque o
    jogo novo ainda não mostra golpe, dano nem desmaio, e o jogador apanharia sem ver. Religar (`CREATURES = true` e
    gerar de novo) quando o combate do jogo novo, passo 1, da [estrutura] chegar; o teste das zonas volta sozinho.
  - **4b (a próxima):** o portão abre; Travessa Jasmim da Beirada (x 49,5 a 56); rua do portão para o leste (y 41 a
    47); praça em (61 a 79, 49 a 59) com a Budega (vendinha, 62 a 67 × 49,5 a 52,5), fogueira e árvore; casas de
    bloco com laje e caixa d'água ao norte da rua (y 29 a 40); postes de luz quente; zona segura da vila em x ≥ 49,5.
  - **4c:** campinho de várzea em (60 a 85, 63 a 78); muro com grafite em x = 58 (y 62 a 78); viaduto da Linha
    5-Lilás no fundo (y 2 a 6, x 48 a 96, 8 m de altura, com o trem lilás parado) e um ônibus velho embaixo; saídas
    sul (x 88 a 94, y = 80) → Guarapiranga e leste (x = 96, y 41 a 47) → Estação Capão Redondo (depois). Regra: o que
    é alto fica no fundo da tela (noroeste), o que é baixo fica na frente. Saci no fundo da mata, em (8,5; 6) (depois).
  - **Prévias:** um script de rascunho meu (`previa-capao.mjs`: SVG isométrico lido do `.tmj`, com a colisão em
    vermelho) na pasta temporária da conversa. Se sumir, refazer: é só desenhar `chao` e `cenario` em isométrico.
    As imagens que o dono aprovou ficam em `docs/referencias/mapa-01-*.jpg`.
- **Formato do mapa novo** (combinado com a [estrutura] em 12/11, no roteiro): `.tmj` ortogonal, 1 tile = 1 m (tile
  de 32 px no Tiled, só como grade); `colisao` com retângulos (`bloqueiaTiro`, padrão true; água com false) que **o meu
  gerador** tira do cenário (tronco 0,4 a 0,6 m, poste 0,3 m, base de casa e muro, lago em retângulos de ~0,5 m);
  `seguro` com retângulos (zona segura por área: monstro não entra, não nota e não acerta); `saidas`, `monstros`,
  pontos e propriedades de sempre; `chao` e `cenario` só para o desenho (o formato delas eu combino com a [arte]).
  Medidas para o pé de 0,6 × 0,4: passagem com pelo menos 1,5 m e 1,2 m entre troncos.
- **Minimapa:** protótipo pronto no ramo `mundo/minimapa` (commit 1c94ebe), **pausado** até o mapa novo existir. A
  janela, o mapa grande (tecla M), as marcações e os nomes que não se sobrepõem servem para o mapa novo; o terreno hoje
  sai da cor dos tiles (`terrainImage`) e vai precisar ler `chao`/`cenario`.
- **Nano Banana** funciona nesta nuvem (chave nos Segredos de rede):
  `python3 -I scripts/nano-banana.py --model gemini-nano-banana-2.1 --aspect 16:9 --size 1K --out x.png --ref estilo.png
  arranjo.png --prompt "..."` (~US$ 0,034 por imagem). Bom jeito: um print do protótipo como estilo e uma planta sem
  texto como arranjo. Gastei 2 imagens (~US$ 0,07) em 12/11; o crédito de US$ 5 é dividido com a [arte], e cada
  máquina conta o seu gasto em `saves/nano-banana.json` (até 12/11 gastei US$ 0,25 em 4 imagens, uma delas em 4K).

## Antes, em 9 de novembro de 2026 (os mapas de hoje, que vão sair)
Feito pelo [mundo], tudo na `main`:
- **Mapa, passos 1 a 3:** profundidade (copas e alto dos postes na camada `acima`, que fica transparente perto de quem
  passa), água e fogo animados, luzes, sombras; Refúgio caprichado (beiradas suaves, vila colorida, barraquinha da
  Dona Iracema, píeres ligados ao deck da fogueira); Santo Amaro caprichado (prédios de 2 andares, neblina, brasas).
- **Represa Billings**, **Terminal Santo Amaro** e **Shopping do Largo Treze** (mapa de dentro), cada um com o seu gerador.
- **Criaturas da Billings no mapa:** as áreas da Iara, do jacaré e do boto saíram da camada `lendas` para `monstros`
  quando a [estrutura] criou cada um. A camada `lendas` ficou vazia e saiu do mapa.
- Antes da divisão em frentes eu fiz o personagem de 20x24 com o equipamento no corpo; hoje vale o da [arte].

| Mapa | Tamanho | Gerador (semente) | Clima | Saídas (→ mapa / chegada) |
|---|---|---|---|---|
| `refugio` | 96×72 | `gen-map.ts` (20261110) | — | leste → `santo-amaro`/`oeste`; sul → `billings`/`norte` |
| `santo-amaro` | 80×60 | `gen-santo-amaro.ts` (20261112) | neblina 0.22, escuro 0.14 | oeste → `refugio`/`leste`; sul (40-42, 59) → terminal/`norte`; porta do shopping (26-27, 22) → shopping/`entrada` |
| `billings` | 88×64 | `gen-billings.ts` (20261120) | neblina 0.16, escuro 0.08, vaga-lumes 0.7 | norte → `refugio`/`sul` |
| `terminal-santo-amaro` | 64×48 | `gen-terminal.ts` (20261130) | neblina 0.18, escuro 0.12 | norte → `santo-amaro`/`sul` |
| `shopping-largo-treze` | 64×44 | `gen-shopping.ts` (20261213) | neblina 0.08, escuro 0.26 | portas de vidro (30-33, 43) → `santo-amaro`/`shopping` (26, 24) |

- **Criaturas por mapa:** Billings: Iara 1 (prainha e pedra, x 35-53, y 34-45), jacaré 3 (canais do oeste), boto 2 (lago
  das casas afundadas), jararaca, corpo-seco e capelobo. Shopping: corpo-seco no supermercado e na ala leste, capelobo
  no cinema e na ala oeste, saci na praça de alimentação. Terminal: corpo-seco nas plataformas, capelobo no fundo.
- **NPCs** (posição em `data/npcs.json`, da [estrutura]; o teste confere que o lugar é livre e alcançável): Dona Iracema
  em (46, 28), no meio da barraquinha (a fileira de trás da barraca não bloqueia, só o balcão), e o Curupira em
  (45, 12), na beira da mata ao norte da vila.
- **Tileset:** 552 tiles (imagem 144×1242). Tile novo sempre no fim. Quando a imagem cresce, o tileset embutido em todos
  os `.tmj` precisa ser atualizado (o teste "a imagem dos tiles está em dia" avisa), sem mexer nas camadas.
- **Testes do [mundo]:** `tests/maps.test.ts` (ordem das camadas, nada que bloqueia na `acima`, árvore com copa e tronco,
  beirada da areia, ligações entre mapas, criaturas da Billings, portas do shopping, NPCs alcançáveis, animações,
  luzes e a imagem dos tiles).

## Como confiro (receitas)
- **Comparar um mapa gerado com o atual** (`node compara.cjs atual.tmj novo.tmj`):
  ```js
  const fs = require('fs');
  const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const semId = (l) => JSON.stringify(l.objects.map(({ id, ...o }) => o));
  for (const la of a.layers) {
    const lb = b.layers.find((l) => l.name === la.name);
    if (!lb) console.log(la.name, 'sumiu');
    else if (la.data) console.log(la.name, la.data.filter((g, i) => g !== lb.data[i]).length, 'tiles diferentes');
    else console.log(la.name, semId(la) === semId(lb) ? 'igual' : 'mudou');
  }
  ```
- **Só o tileset embutido** (a imagem cresceu e as camadas não mudam): num script `tsx`, leia o `.tmj`, troque
  `map.tilesets[0] = tiledTileset('../tiles.png')` (de `scripts/tileset.ts`) e salve com `JSON.stringify(map)`.
- **Gerador sem estragar o resto:** mudança nova entra no fim do gerador, sem sortear nada (ou sorteando "à toa" no
  mesmo lugar). No `MapBuilder`, `setGround(x, y, chave, false)`: sem o `false`, o tile fica reservado.
- **Navegador:** `npm run build`, depois `MEUMMO_SAVE=<arquivo temporário> npm start`, espere uns segundos e entre
  com qualquer nome e senha (o personagem nasce na hora). Para ir a outro mapa sem caminhar: `GET /admin/api/jogadores`
  (o `id`) e `POST /admin/api/jogador` com o cabeçalho `x-meummo-admin: 1` e `{"acao":"levar","id":…,"mapa":…,"x":…,"y":…}`.
  Na nuvem, o servidor ligado em segundo plano é desligado depois de uns 30 minutos.
- **Luz:** muitas luzes juntas somam e estouram em branco (aconteceu no sol do átrio do shopping). Use raio pequeno
  (~20) e poucas.
- **Terminal:** `rm` com variável sem aspas é bloqueado. Use `"${PASTA:?}"/arquivo`.

## Esperando outras frentes
- **[estrutura]:** o combate no jogo novo, passo 1 (ver golpe, dano, desmaio e atirar com o estilingue). Quando
  chegar, religo as criaturas da 4a. O formato novo do mapa já é lido (pasta `maps-iso/`, `colisao`, `seguro`).
- **[arte]:** o desenho 2.5D do mapa novo a partir de `chao` e `cenario` (clareira, figueira, mata, gradil, portão e,
  da 4a, lago, lama, mata profunda com neblina, aguapés, capivaras, troncos caídos, Pedra do Véu e véus). O dono achou
  a figueira "bugada" e não reconheceu a pedra no desenho de hoje: mandei sugestões para ela.
- Dos mapas de hoje (valem até eles saírem): o personagem novo tem ~1,6 tile de altura e o zoom ficou sempre par. Se a
  cabeça ou o chapéu sumirem embaixo das copas ou dos letreiros do shopping, ajusto `FADE_NEAR`/`FADE_FAR` em
  `mapDepth.ts` (o ponto de cada personagem é `sprite.y - 12`, em `WorldScene.updateDepth`).

## Próximos passos possíveis (o dono escolhe)
**Agora (mundo novo):**
1. **Etapa 4b (portão e vila):** prévia primeiro, o "pode" do dono, depois o jogo.
2. **Etapa 4c**, depois a 5 (atmosferas) e a 6 (minimapa no mapa novo: retomar o ramo `mundo/minimapa`; o terreno
   vai precisar ler `chao`/`cenario`).
3. **Religar as criaturas** da 4a quando o combate do jogo novo chegar.

**Suspenso (era para os mapas de hoje, que vão sair):**
1. **Enfeite em volta do Curupira** (roteiro, opcional): árvore oca ou cantinho de mata fechada em volta de (45, 12),
   sem bloquear o tile dele (o teste dos NPCs confere).
2. **Chefe do cinema do shopping:** uma lenda nova. A [estrutura] cria e eu marco a área no cinema (x 22-41, y 3-11).
3. **Conferir as copas e os letreiros com o personagem novo** (veja acima), mesmo sem aviso da [arte].
4. **Boitatá** (chefe, [estrutura + arte + mundo]): combinar com o dono onde ele mora e marcar a área.
5. **Ideias para depois:**
   - o segundo andar do shopping (as escadas rolantes já apontam para lá);
   - o cinema mais escuro que o resto;
   - a Selva do Centro (Paulista e Sé, fim de jogo, no `DESIGN.md`).
6. **Nome do shopping:** se o dono preferir outro, troque `ZONE_NAME` em `gen-shopping.ts`, o nome da saída em
   `gen-santo-amaro.ts` e os docs.
