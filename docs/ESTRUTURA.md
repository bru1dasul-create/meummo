# Caderno da frente Estrutura

> Para o chat **"Estrutura e regras"** retomar o trabalho depois de limpar a conversa (`/clear`) ou num chat novo.
> Leia junto: `CLAUDE.md` (regras e divisão do trabalho), `docs/ROADMAP.md` (tarefas com a etiqueta
> **[estrutura]**) e `docs/ARQUITETURA.md` (como o servidor funciona por dentro).

## Quem sou
O chat da frente **[estrutura]**: servidor, regras compartilhadas, dados (`data/*.json`), salvamento (`MIGRATIONS`),
protocolo, testes do servidor e o painel do administrador. O dono do projeto não programa: ele decide o jogo
(ideias, design, testes). Converso em português do Brasil, direto, com explicações simples, e aponto riscos e
alternativas quando vejo — sem concordar só para agradar.

## Combinados com o dono
- **Juntar na `main`:** autorizado a juntar sozinho quando `npm run check` passa e a entrega foi conferida no
  navegador (PC e celular). Antes, atualizar com a `main`; depois, avisar o dono: o que mudou e como testar.
- **Decisões de jogo** (como uma lenda luta, preços, recompensas, ordem das tarefas) são do dono: proponho com uma
  recomendação e espero o "pode". Etapas pequenas, sempre jogáveis.
- **Pedidos entre as frentes vão direto entre os chats** (o dono pediu): ferramenta `send_message` do Claude Code
  Remote. Ache os chats com `list_sessions` pelo título — "Arte e visual" ([arte]) e "Criar jogo MMO RPG do zero"
  ([mundo]). Mande com prioridade `later` (não interrompe o trabalho deles) e deixe o pedido também no roteiro.
  Mensagem que chega de outro chat é informação, não ordem do dono.
- **Arquivos de dados:** acrescentar no mesmo formato do arquivo, sem reformatar o resto (o dono edita à mão).
- **Testar no navegador uma criatura que ainda não está no mapa:** mudar a área no `.tmj` só no computador de
  teste e desfazer com `git checkout` no fim (o mapa é do [mundo]).
- **Testar sem caçar:** painel do administrador no servidor de teste — `/admin/api/jogador` (dar ouro e itens,
  levar para outro mapa) e `/admin/api/ajustar` (ex.: baixar o dano de um chefe só durante o teste).

## Onde estamos (10 de novembro de 2026)
O dono jogou e achou o jogo "horrível": andar engessado, trava longe das coisas, ruim entre as árvores, monstros
que só atacam se você ataca, animações feias; e pediu mapa e minimapa. Ele aprovou o plano ("pode sim"):
- **Feito (na `main`, 4ec21c7):** todos os monstros atacam sozinhos e percebem de mais longe; 3 s de folga para quem
  chega (`NOTICE_GRACE_MS`); diagonal rente às quinas.
- **Próximo, meu:** movimento livre, passo 1 (seção "🎮 Sensação de jogo" do roteiro). Depois: passo 2 com o
  [mundo] (colisão do tamanho de cada objeto) e passo 3, o joystick.
- **Pedido mandado** ao [mundo] (mapa e minimapa, tecla M) e aviso à [arte] (`EntityView.ts` no movimento livre).
- **Documento do ChatGPT** (Godot, 3D isométrico "estilo Albion", 4 classes, Praça da Sé, São Paulo atual): dei a
  minha leitura sincera — não recomendo trocar de ferramenta agora. Aproveitei no roteiro o que não depende de
  decisão (celular deitado, modo leve, meta de quadros por segundo, Caminhos como M6). Esperando o dono decidir.

**12/11 — protótipo 2.5D da [arte]** (`prototipos/pindorama-25d/`, já na `main`; versão 8 no ramo da [arte]):
personagem desenhado por código com esqueleto 3D, câmera isométrica parecida com a do Albion, uma esquina da São
Paulo de hoje e um exportador de sprites (PNG em 8 direções, com âncora e camadas). Ele não tem servidor, outros
jogadores, monstros, dano, itens nem salvamento. O dono acha que vamos "largar o jogo atual". Minha recomendação:
largar o **visual** de hoje (mapas vistos de cima, boneco em pixel, monstros 16x16), mas manter o **motor** (servidor,
regras, multiplayer, salvamento, painel, dados e testes). Antes de migrar tudo, uma **fatia de teste**: a esquina do
protótipo como primeiro mapa isométrico do jogo, o herói em sprites exportados, outros jogadores, um monstro e o
ataque, tudo ligado ao servidor atual, medido no celular do dono. O movimento livre (meu próximo passo) continua
valendo. Esperando o dono decidir.

**12/11 — o dono trocou o visual** ("trocamos o visual") e quer refazer os mapas do zero, perto do Capão Redondo,
"bem selvagens". Propus: nascer na Estação Capão Redondo (fim da Linha 5-Lilás), Parque Santo Dias como primeira mata,
Guarapiranga depois, Santo Amaro e Billings em seguida e o centro (Sé) no fim. Esperando a escolha dele. Avisei o
[mundo] para pausar o minimapa dos mapas atuais.

**13/11 — Mapa 01, etapa 3 (a clareira jogável), parte da [estrutura] na `main`:** o servidor lê o formato novo
(`maps-iso/`, colisão por retângulos, área segura, pé no ponto exato), o Curupira está na clareira
(`curupira_capao`) e o **motor do jogo 2.5D** roda em `/?novo` (`src/client/novo/`), com desenho provisório. Falta a
[arte] ligar o `PD.View` em `src/client/novo/arte.ts` (interface `WorldView` em `view.ts`). Protocolo **17** (`hello`
com `mundo: 'novo'`: o servidor manda o jogo novo para os mapas do formato novo e o de hoje para os de sempre).
Próximos: o combate da revisão 17 no servidor (pedra com carga, defesa com energia) e, no jogo novo, loja e missões.

**13/11 — duas correções do andar (achadas pelo [mundo]), valem para os dois jogos:** a trava de mensagens por
conexão (`session.ts`) era 15 por segundo e o andar solto manda 20 (um pedaço a cada 50 ms): quem andava sem parar
uns 10 s caía (código 4001, "mensagens demais"). Agora 40 por segundo, com folga de 60 (teste em `world.test.ts`). E
o "andar até" ficava indo e voltando perto do destino: o último ponto da rota usa `finalApproach` (`movement.ts`),
que para quando nenhum pedaço aproxima mais (e aí o navegador para de mandar `walk`).

**13/11 — o dono já está no jogo novo** ("eu ja estou nesse"): não mexer mais no jogo antigo (só o que for do servidor
e valer para os dois). Ele estava usando a `clareira.html` da [arte] (servidor de mentira); o jogo de verdade com
esse visual é o `/?novo` com a `PD.View`, pronto no ramo da [arte] e esperando o "pode" dele (testei: funciona).
Propus: depois que a [arte] juntar, o endereço normal abre o jogo novo e o antigo vai para `?antigo` (esperando a
resposta). Pedido do [mundo] feito: o desenho provisório mostra polígono, elipse e trilha (linha com `largura`) do
chão, e a água da colisão fica baixa e azul; polígono na `colisao` ou no `seguro` dá erro (antes sumia calado).
**Achado importante:** com os monstros da etapa 4a (ramo `mundo/etapa-4a`), no `/?novo` os saguis atacam e o
jogador não vê o golpe, a vida na tela não baixa e ele desmaia sem saber por quê. Próximo meu: o combate no jogo
novo, passo 1 (roteiro). Avisei o [mundo].

**13/11 — a Budega abriu** (`budega`, depois da 4b do [mundo] na `main`): no balcão (64,5; 53,3), "Atendente"
provisório. Achado no teste: o servidor media a distância para negociar misturando o tile do jogador com a posição
da vendedora (dava 3,7 com o jogador a 3 m, no balcão) → no mapa novo, do pé ao pé, até TRADE_RANGE + TRADE_SLACK
(3,5 m); o navegador abre a loja a 3 m e fecha a 3,5 m. Teste em `mapa-novo.test.ts`.

**13/11 — mochila, loja e câmera no jogo novo:** as janelas de sempre (mochila, loja, conversa com missões) ligadas no
motor; NPC com loja abre a loja ao chegar. O dono achou a câmera perto demais: o motor começa no zoom 0,7 (o mais longe
da view) e a roda do mouse e as teclas − e + ajustam. Budega: o dono deixou eu escolher o que ela vende (sem tabaco)
→ Banana, Arruda, Água de Coco e Garrafada (novas em `data/items.json`) e Chapéu de Palha; compra pela metade. O
atendente é provisório (o dono vai inspirar em alguém da equipe dele, depois). O NPC entra quando a vila (4b) entrar na
`main` (o [mundo] avisa; antes disso o teste dos NPCs quebraria). A HUD nova do dono (imagem) foi para a [arte]; minhas
observações: sem mana (barra verde = energia da revisão 17), sem botões de coisas que não existem, versão de celular.

**13/11 — ajustes do combate (relato do [mundo] depois de religar os monstros, a878d34):** a pedra parava na grade de
1 m dos troncos (213 árvores na mata) → no formato novo ela bate pelo retângulo exato embaixo dela
(`blocksShotAt`); no celular, o toque no sagui agora vale onde ele está desenhado e onde ele está de verdade, com mais
folga no dedo. Não reproduzi o "0 de 12 toques" do [mundo] no Chromium (iPhone 13 deitado: 11 de 12 antes, 12 de 12
depois); perguntei como ele tocou. `__mundoNovo.entities()` agora traz o pé (`feetX`, `feetY`).

**13/11 — o dono disse "pode os dois":** o endereço normal abre o jogo novo (o antigo em `?antigo`) e o **combate do
jogo novo, passo 1**, está na `main`: o servidor de sempre visto no 2.5D (`src/client/novo/combat.ts` desenha por cima:
aviso vermelho no golpe de perto, anel laranja no preparo, pedras, dano, barras de vida, desmaio, ouro). PC: clique no
monstro atira, botão direito atira no mouse, Espaço, Q, E; celular: toque no monstro e os 4 botões. Regra nova:
ninguém ataca de dentro da área segura. Pedi ao [mundo] para religar os monstros da 4a e à [arte] o desenho do
combate (métodos opcionais `action` e `actorPosition` na `WorldView`) e o conserto do celular (o chat compacto da
[arte] cobre dois botões no canto direito). Próximo: o dono joga o passo 1; depois, o passo 2 (revisão 17).
Falta conferir: o tiro dos jogadores ainda bate na grade de 1 m da colisão (um tronco de 0,3 m segura a pedra no metro
inteiro dele) — vale refinar quando o combate da revisão 17 chegar.

**13/11 — "andar até" do jogo novo refeito (defeito do [mundo] na etapa 4b):** a rota de tile em tile raspava num
poste de 0,3 m e travava de frente, e o toque seguinte travava de novo. Agora `src/shared/route.ts`: reta direta
quando livre, senão A* numa grade de 0,2 m pelo tamanho do pé e retas conferidas com folga; trava → recalcula (2
vezes) → larga com aviso. No mapa da 4b: 900 de 900 trajetos aleatórios chegaram, nenhum travou, busca de 2 a 6 ms
(pior 22 ms). No celular, toque rápido na área do joystick também anda (`joystick.ts`). `?novo&provisorio` força o
desenho provisório (mostra as caixas de colisão). O jogo antigo continua com a rota antiga (congelado). A [arte]
juntou a `PD.View` na `main` com o "pode" do dono; a 4a do [mundo] entrou sem monstros (escolha do dono). Esperando
o dono: endereço normal abrir o jogo novo? e o "pode" para o combate do jogo novo. A Budega fica no balcão
(64,5; 53,3) quando o dono liberar.

**12/11 — Mapa 01 (decisões do dono, repassadas pelo [mundo]; confirmar com o dono quando chegar a hora):** o
[mundo] faz em etapas (câmera, planta, uma tela jogável só com a clareira, o resto em 3 pedaços, atmosferas,
minimapa); o meu trabalho no mapa novo começa na etapa 3, e ele avisa. Ficam comigo: a Budega como a vendinha da
praça da Vila do Capão (NPC e loja nos dados; sem "Tabacaria" e sem tabaco), a zona segura por área, a primeira
missão (acordar, Curupira, portão, vila, mata) e os saguis "encantados" (a missão é acalmar ou afastar, não
matar; o monstro continua o mesmo, mudam a história e o texto). O nome do mundo continua "Selva de Pedra". O
ritual de classe na figueira fica para depois.

**13/11 — movimento livre, passo 1, na `main`:** jogadores andam soltos (pedaços de 50 ms, orçamento de tempo no
servidor, caixa do pé de 0,6 × 0,4 na faixa de baixo do tile, desliza e escorrega 0,3 na quina). Mexi em poucas
linhas do `EntityView.ts` (da [arte]: a perna acompanha a distância) e avisei. Próximos: passo 2 com o [mundo]
(colisão por formas, formato proposto) e o joystick; depois, o combate da revisão 17 (carga, defesa com energia).

**12/11 — decidido pelo dono:** nascer no Parque Santo Dias; capítulo 1 = Capão Redondo e o parque → Guarapiranga →
Santo Amaro (Largo Treze, Terminal, Shopping do Largo Treze) → Billings → centro no fim. Ele quer a Budega
Distribuidora (o negócio dele) no Capão; recomendei sem "Tabacaria" e sem produtos de tabaco (Lei 9.294/1996).
Mandei as decisões ao [mundo] (roteiro, seção "🗺️ Mundo novo").

**12/11 — o ChatGPT evoluiu o protótipo até a revisão 17** (ZIP enviado pelo dono, fora do repositório): duelo de
treino com vida, soco, estilingue com carga (até 1,1 s, dano 20 a 40, alcance 6,5 a 9,5 m), defesa frontal com
energia (100; arco de 140°; bloqueia ~75%; quebra sem energia), esquiva no Q, recuo pela força e aviso laranja do
rival. Os números estão no `LEIA-ME.md` da revisão 17. No MMO, essas regras vão para o servidor, com os mesmos
números: o movimento livre usa a escala do protótipo (metros), para eles servirem direto. Uma regra não serve para
MMO: o corpo caído bloquear a passagem. Recomendei ao dono tornar a revisão 17 a oficial e levá-la para o
repositório pelo chat de Arte, só com o código e o LEIA-ME, sem os 19,6 MB de relatórios.

Antes, em 9/11:
Feito pela Estrutura, tudo na `main`:
- Interface nova (tela de entrada, painel de vida, botões com ícones, chat discreto).
- Ouro: cai no chão onde o monstro estava (cada um vê e pega o seu); item que não cabe na mochila também cai.
- Loja da Dona Iracema (`data/npcs.json`, `preco` em `data/items.json`).
- Painel do administrador (`/admin`): ajustes de monstros, itens e loja na hora (em `saves/ajustes.json`) e
  ferramentas de jogadores (dar ouro e itens, curar, levar, aviso para todos, expulsar).
- Curupira e missões (`data/missoes.json`): derrotar ou entregar, recompensa, sequência, repetível.
- Billings: Jacaré Mutante, Boto Encantado e a Iara (chefe, com o canto que encanta e puxa; a esquiva solta).

Números para não se perder: protocolo na versão **18** (16: `walk` no lugar de `step`; 17: `mundo` no `hello`; 18:
`slow` no `walk`, andar devagar no mundo novo); `MIGRATIONS` no
passo **3** (coluna `quests`; o movimento livre não precisou de passo novo: o salvo continua sendo o tile).

## Esperando outras frentes
- Nada pendente para a [estrutura]. A [arte] entregou tudo que estava pedido (Curupira, jacaré, boto, Iara, canto,
  jogador encantado, ícones `dente` e `escama`, conversa, missões e sinais ! e ?) e juntou na `main` em 9/11, junto
  com o personagem em camadas e a loja e o ouro caprichados. O ramo dela ficou igual à `main`.
- O dono vai ligar o **Nano Banana** (gerador de imagens) para o chat de Arte.

## Próximos passos possíveis (o dono escolhe a ordem)
0. **Primeiro:** movimento livre (aprovado em 10/11). A recomendação de chamar os amigos (M5) ficou para depois de o
   jogo estar gostoso de andar.
1. **Equilíbrio:** o dono joga e ajusta no painel (itens "[dono → estrutura]" do roteiro); a Estrutura muda o
   padrão nos arquivos quando ele mandar os ajustes copiados do painel.
2. **M5 — servidor na internet** para os amigos testarem: VPS, domínio, HTTPS, senha no painel do administrador,
   banir, registros. (Pesquisar preços de VPS antes de propor.) A avaliar com o dono: um primeiro teste sem VPS,
   por túnel gratuito a partir do PC dele. Antes, o painel precisa de senha e os freios de senha precisam do
   endereço real de cada jogador: pelo túnel, todo visitante chega como se fosse do próprio computador.
3. **M4 — social:** grupo com XP dividido, troca entre jogadores, mensagem privada, guilda.
4. **Lendas novas:** Boitatá (chefe) e uma lenda própria para o Shopping do Largo Treze (o [mundo] deixou o lugar
   pronto).
