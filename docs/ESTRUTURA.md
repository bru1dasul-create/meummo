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

**14/11 — fila do dono: arco, Joaquim, som.** O dono preferiu não abrir um quarto chat para som: o `sfx.ts` e o
áudio passaram para a [estrutura] (CLAUDE.md). Fila: Arco de Bambu → Joaquim (o gato da vó, carinho sem bônus) → som
(volume separado, ambiente, música do Capão; antes, 2–3 opções de música para ele escolher a origem).

**14/11 — combinados com o [mundo] (a floresta maior, esperando o dono):** o Capão passa a 96 × 180 m (cresce só
para o sul; nada muda de lugar). Áreas reservadas na camada `monstros` (x0–x1 × y0–y1): A 20–38 × 112–140 (mata do
meio do parque), B 2–24 × 150–178 (mata profunda do sul e cachoeirinha, a mais forte), C 52–86 × 92–136 (mata da
estrada, norte), D 52–86 × 154–177 (mata da estrada, sul, perto do posto). Minha proposta ao dono: A quati (2), C
tatu-bola (3), D marimbondo (3), B filhote de boitatá (5, só de noite). Monstro que ainda não existe numa área: o
servidor só avisa ao ligar. **Capivaras:** por grupo, em `pontos`, o retângulo `capivaras-<lugar>` (onde andam) e o
ponto `capivaras-<lugar>-descanso`; quantidade e o resto em data/bichos.json (como o Joaquim: `area`, `descanso`).

**14/11 — itens no chão (escolha A do dono):** `World.giveLoot` agora põe tudo no chão: o ouro no lugar do monstro
e cada item num lugar livre em volta (`walkableAround`), por `ITEM_DROP_MS` (2 min). Pegar é o `pickUp` de sempre
(passando por cima, depois de `DROP_READY_MS`), que agora manda "Você pegou: ..." e o anúncio do lendário. O `loot`
não é mais mandado (o tipo ficou no protocolo; o jogo antigo ainda sabe mostrar). Sem mudar o protocolo. No 2.5D:
`addDrop(..., item)` com ícone (`itemIconUrl`), raridade e quantidade; `drawDrops` desenha caindo com quique, "×N",
brilho dourado (raro) e laranja com facho (lendário), e espalha um pouquinho dentro do lugar para não sobrepor; o
`pickup` de item mostra "+Banana" (`onLoot`). Gancho novo: `__mundoNovo.drops()`. Testes em `gold.test.ts` e
`items.test.ts`. Conferido: 8 saguis criados pelo menu ADM e derrubados → 3× banana ×2 e um chapéu de palha no
chão, tudo pego passando por cima; mochila cheia → estilingue (raro) e gorro (lendário) esperando no chão.

**14/11 — formato do mapa da tecla M (combinado com o [mundo]):** uma imagem por mapa, vista de cima com o norte
para cima e sem texto, `public/assets/maps-iso/<id>-mapa.png`, e `<id>-mapa.json` = `{ escala (px por metro; 8 no
Capão), largura, altura (metros), nomes: [{ nome, x, y, tipo? }] }`, os dois feitos pelo gerador do [mundo]. A [arte]
mostra a imagem girada para bater com a câmera isométrica (no mapa e no mini mapa) e escreve os nomes. O "explorado" é
meu: salvo no personagem (passo novo em `MIGRATIONS`), numa grade de quadradinhos de alguns metros por mapa. A [arte]
combina os outros formatos quando cada item chegar: `view.setWind(forca)`, a hora do dia e a marca dos olhos vermelhos.
Pendente do dono: como o drop de itens deve funcionar (no chão como o ouro, ou voando para a mochila) e se o pulo faz
algo no jogo.

**14/11 — flecha presa na árvore (as regras):** `SolidRect.kind` (o tipo do objeto da `colisao` no Tiled) e
`GameMap.shotBlockerAt(x, y)` (o tipo do que segura o tiro, 'bloco' sem tipo, 'borda' fora do mapa). O `advanceShot`
volta até a beirada quando bate (8 metades, ~1 mm). `shot_end` ganhou `x`, `y` (onde parou, sem acertar ninguém) e
`on` (no que bateu) — protocolo **32**. O motor (`CombatLayer.endShot`) deixa o desenho voar até o ponto e chama o
`projectileEnded(kind, x, y, ângulo, agora, stuck)` com `stuck = { on, z: SHOT_DRAW_Z }` (0,9 m, a altura do voo).
Conferido no Capão: tronco em x = 44,83, o servidor disse x = 44,824, `on: 'tronco'`. Falta a [arte] desenhar
cravada no tronco (hoje crava no chão, ao pé da árvore). `tests/flecha-presa.test.ts`.

**14/11 — controles novos (pedido do dono):** `src/client/novo/keys.ts` (`KeyBindings`: cada ação com uma tecla,
`KeyboardEvent.code`, os dois Shifts como um; troca com tecla já usada troca as duas; recusa as de andar, as fixas e
Ctrl/Alt/Caps/F1–F12; guarda em `meummo:teclas`) e `keysPanel.ts` (janela das teclas, aberta pelo botão "Teclas" do
painel do som, escondido no celular; avisa das "Teclas de Aderência" do Windows com a esquiva no Shift). Padrão:
Shift esquiva, Espaço pula, J atira, F defende, Q/E habilidades, I mochila, M mapa (só um aviso até o mapa existir),
C liga e desliga o andar devagar (antes, segurar Shift), som sem tecla. A barra de ações é refeita com as teclas novas
(`makeActionBar`/`keysChanged`). **Pulo** (protocolo **31**): o cliente manda `jump`, o servidor confere a recarga
(`JUMP_COOLDOWN_MS`, 0,8 s), recusa desmaiado, defendendo ou puxando o tiro, e manda `fx` `jump` a quem está perto
(`tests/pulo.test.ts`); som `jump` no `sfx.ts`; o desenho provisório dá um pulinho. Pedidos à [arte]: o pulo no boneco
(o animador já pula com `input.jump`), o botão de pular no celular, a etiqueta da tecla da esquiva (o estilo desenha a
barra de espaço fixa) e o "Como jogar" da tela de entrada.

**14/11 — lag na conversa e trava no zoom (medido) e o som do arco:** perfil no Chromium sem placa de vídeo (CDP
Profiler + tarefas longas, build com `npx vite build --minify false`): ao abrir e fechar a conversa e ao dar zoom,
quadros de 100 a 250 ms, quase tudo em `drawImage`. A causa é do desenho (da [arte]): `Ground._ensureKey()`
(`prototipos/pindorama-25d/js/world/ground.js`) apaga todos os pedaços do chão a cada zoom novo, e a câmera da conversa
muda o zoom a cada quadro por 450 ms (`CONVERSATION_ZOOM_MS`); e o `World.buildBusy()` conta só a gravação da pintura
(o Chrome pinta de verdade no primeiro `drawImage` de cada imagem). Pedido mandado à [arte]: esticar os pedaços velhos
enquanto o zoom muda e refazer quando ele parar. O motor ficou como está (se ela pedir, dou menos passos na animação
da conversa). Som da puxada do arco refeito (`Sfx.charge(power, 'flecha')`): sem tom contínuo; chiado fino de corda
(ruído num filtro estreito, 2400→3500 Hz) e estalinhos de madeira (`creak`) que aceleram com a carga.

**14/11 — música (licença livre) e a lista grande do dono:** três músicas CC0 do OpenGameArt em
`public/assets/audio/musica/` (créditos em `CREDITOS.md`; igualadas a -20 LUFS com o `loudnorm` do ffmpeg, MP3 112 kbps):
vila → Down The River (Komiku), mata/clareira/lago → Forest Whisper Theme (Cleyton Kauffman), mata profunda → Peaceful
Forest (Samza). `src/client/music.ts`: dois tocadores `HTMLAudioElement` (tocam aos poucos, sem carregar tudo) ligados
ao volume "música" por `MediaElementSource`; trocam devagar; liberados no primeiro clique (`Sfx.unlock` → `prime`, por
causa do iPhone). O Pixabay e o Freesound recusam acesso automático daqui; o OpenGameArt, o FMA e o Incompetech
funcionam. O dono mandou a lista grande (no roteiro, "A lista do dono de 14/11"): distribuí para a [arte] e o [mundo].
Minha fila, na ordem: lag ao falar com NPC e trava no zoom (medir), som do arco, controles (Shift esquiva, Espaço
pula, M mapa), flecha presa na árvore, drop de itens, dia e noite, vento, mapa explorado, capivaras, mais bichos e as
habilidades (estas duas pedem decisões do dono).

**14/11 — arco e Joaquim desenhados (da [arte], com o "pode" do dono):** liguei a flecha de verdade
(`projectileArt.ts`: `drawProjectile` no `drawShots`, `projectileEnded` no `endShot(id, hit)` e no fim do alcance,
`drawLanded`, `landedBusy` no `busy()`), o ícone `arco` no item e o `actionBar.setLook` (ao entrar e na mensagem `gear`
sua). O Joaquim agora é desenhado pela view (`canDraw('pet', 'joaquim')`), e o gatinho provisório do `combat.ts` só
aparece se a view não souber desenhar. Observação para o equilíbrio: no zoom padrão a tela mostra uns 10 m para os
lados e para baixo (13 m nas diagonais do chão); a flecha com carga cheia (13 m) pode sair da tela.

**14/11 — som, parte 1 (volume e ambiente):** `sfx.ts` ganhou um volume por parte (`efeitos`, `ambiente`, `musica`,
`localStorage` `meummo:volumes`), cada uma num `GainNode` antes do geral; o "desligar" abaixa o geral (o ambiente
continua por baixo). `src/client/ambient.ts`: `sceneOfPlace` (propriedade `som` do lugar, senão o nome) e `Ambient`
(sons contínuos com volume por lugar, trocando com `setTargetAtTime`, e bichos sorteados por minuto). `GameMap.places`
e `placeAt` (camada `areas`, o menor lugar que contém o ponto). Painel `src/client/novo/soundPanel.ts` (o botão do som
da HUD abre). Gancho de teste `__mundoNovo.sound()`. Falta a música (o dono escolhe a origem). Pendência da [arte]: o
botão do som some no celular.

**14/11 — Joaquim, o gato da vó (o comportamento):** `src/server/pets.ts` (`PetDef`, `parsePetDefs`, `Pet`,
`petHome`): a cama é um ponto da camada `pontos` (pode estar dentro de um móvel sólido: o gato pula, `dashed`), o chão
livre ao lado é procurado em anéis em volta; ele anda com `walkSlice` (o mesmo corpo do jogador) e nunca sai do
retângulo (`GameMap.regions`, novo). Modos: sleep → stretch → (pula) rest/walk × passeios → volta → (pula) sleep.
Mia uma vez por chegada (conjunto `near`), com espera; carinho com espera (`petEveryS`). World: `pets`, `updatePets`,
`seePet`, `petFx`, `cuddle`. Protocolo 30: kind `pet`, `asleep`/`home` no EntityState, fx `meow`/`purr`/`wake`/`sleep`,
mensagem `pet`. Motor: sem `view.canDraw('pet', tipo)`, desenha o gatinho provisório no `combat.ts` (só com você
dentro do `home`); tocar nele anda até lá (corrige o caminho se ele andar) e manda `pet`. Sons `meow` e `purr`.

**14/11 — Arco de Bambu (as regras):** `WeaponShot` em `ItemInfo.shot` (campo `tiro` em data/items.json, conferido por
`parseWeaponShot`, limites em `WEAPON_SHOT_LIMITS`, os mesmos do painel). `shotProfile` em `src/shared/combat.ts`;
`chargeFraction`/`chargedRange`/`chargedDamage` recebem o perfil do tiro (não mais as regras do combate). Servidor:
`World.shotOf` (arma equipada, só no mapa novo). Motor: `engine.shot()`; o anel da carga recebe o tempo da arma
(`setCharge(id, since, fullMs)`); `myShot(..., kind)`; sons `bow-release` e `sfx.charge(power, kind)`; flecha provisória
no `drawShots`; `view.gear(id, gear)` ao aparecer e na mensagem `gear`. Pendências com a [arte]: ícone `arco` (trocar o
`icone`), `projectileArt.ts` (ligar no `drawShots`) e `actionBar.setLook`. Protocolo 29.

**13/11 — painel, parte 5 (números do combate):** `CombatRules` (`src/shared/combatRules.ts`, padrão das constantes
`CHARGE_*`/`GUARD_*`, menos `GUARD_MAX_ENERGY`, que é a escala da barra). `chargeFraction`, `chargedRange`,
`chargedDamage`, `guardCovers` e `blockHit` recebem as regras (sem padrão escondido: quem esquece não compila).
`World.combat` (opção `combat`; o servidor passa `tuning.combat`, o mesmo objeto, mudado no lugar). Grupo `combate`
no `Tuning`: partes `carga`, `defesa`, `recuo`, em unidades do dono (ms, %, graus, metros), com limites por número
(`COMBAT_NUMBERS`); `parseCombat` converte e o teste confere que o padrão do painel volta exatamente ao do jogo.
`welcome.combat` e mensagem `combat` (protocolo 28); o motor e o `CombatLayer` usam o mesmo objeto
(`Object.assign` ao chegar). Gancho de teste: `__mundoNovo.combat()`.

**13/11 — painel, parte 4 (missões):** grupo `missoes` no `Tuning` (as missões passam a ser montadas junto com
monstros, itens e NPCs, conferidas por `parseQuestDefs`/`checkQuests`). Campos: nome, pedido e concluída (`texto-longo`,
até 600 letras), `objetivo.rotulo` (vazio = automático), `objetivo.quantidade`/`monstro`/`item`, `nivelMinimo`,
`repetivel` e `recompensa.xp`/`ouro`/`itens` (tipo novo `itens-qtd`: lista de `{ item, quantidade }`). Fica de fora:
quem dá, com quem falar e `depoisDe` (mudam a ordem da história: só no arquivo). Mensagem nova `questDefs`
(protocolo 27): o cliente troca a lista dentro do mesmo array (a conversa e o rastreador usam ele) e redesenha.
`replaceInPlace(..., exact)` tira campo que sumiu (o `goalLabel` que voltou ao automático).

**13/11 — painel, parte 3 (monstros por área):** grupo novo `areas` no `Tuning` (o padrão vem dos mapas; chave
`mapa#n`, n = a ordem da área no mapa, de 1 em diante): `monstro` e `quantidade` (0 a 50). O mundo monta as áreas com
os ajustes e `refreshAreas` vale na hora (troca o tipo, completa ou tira, sem ninguém ganhar nada). O lugar da área
continua sendo do mapa ([mundo]).

**13/11 — painel, partes 1 e 2:** nível e XP (ações `nivel` e `xp` no cartão do jogador) e a posição dos NPCs
(campos `mapa`, `x`, `y` — tipo novo `numero`, com vírgula; `Tuning.setMany` muda os três juntos; `refreshNpcs` tira,
põe e move; o navegador move o boneco). Menu ADM "Trazer para cá" (`gm` `npc`, protocolo 26) grava pelo `setNpcSpot`.

**13/11 — registros (logs), pedido do dono para corrigir mais fácil:** `Logbook` (tela + `saves/registros/` um
arquivo por dia, 14 dias + memória para a aba Registros do painel). O tick e cada mensagem estão em try/catch:
o erro vai para o registro com o caminho e o servidor continua (antes, um defeito num tick derrubava tudo). Erros do
navegador chegam pela mensagem `oops` (protocolo 25), com a tela e o aparelho. O dono também pediu, para o painel,
"todos" os itens que propus (nível/XP, posição dos NPCs, monstros por área, missões, números do combate): faço em
partes, nessa ordem.

**13/11 — Xiovanna atrás do balcão (Budega com interior, do [mundo] e da [arte]):** `budega` em (64,6; 51), logo
depois do mapa entrar na main, como combinado. O teste dos NPCs no mapa novo passou a pedir "o corpo cabe e dá para
chegar a pé a até 3 m" (atrás do balcão ninguém chega no pé dela, de propósito). Missão, loja (a 2,9 m) e o lugar
exato conferidos no navegador.

**13/11 — menu ADM, passo 1 (pedido do dono: "pôr mais bicho, matar, voar, coisas que player normal não faz"):**
administrador salvo no personagem (`MIGRATIONS` passo **4**: coluna `admin`, todo mundo começa como jogador normal),
marcado no painel (`POST /admin/api/adm`; online, vale na hora). Comando `gm` (protocolo 24), sempre conferido no
servidor (quem não é administrador é ignorado e registrado) e registrado no log: `spawn` (monstros numa área
temporária em volta, que não renascem; até 10 por vez e 60 por mapa), `clear` (dano igual à vida dos monstros a até
8 m: XP e itens normais), `fly` (o pedaço da fila guarda o voo, como a defesa; `flySlice` atravessa tudo; pousar
dentro de algo leva ao chão livre), `god` (sem dano; monstros e o canto ignoram), `tp` (o pé exato, ou o chão livre
mais perto; voando, qualquer ponto do mapa), `heal`. No navegador, `src/client/novo/gm.ts` (botão ADM e tecla G);
voando, o "andar até" vai reto. Conferido no PC e no celular. Testes em `tests/gm.test.ts`.

**13/11 — desempenho (pergunta do dono: "como fica em FPS? o que fazer para ficar leve?"):** medido no navegador
de teste, sem placa de vídeo (pessimista): PC 1280×720 de 31 (combate) a 58 (praça) quadros por segundo; 1920×1080
de 26 a 43; celular emulado de 33 a 57. Quase todo o quadro é o desenho da view (8 a 30 ms de JavaScript); o motor e
a minha camada de combate, menos de 0,2 ms. A camada de combate estava com mais pixels que o cenário no celular
(2265×945 contra 1726×720) e custava 2 a 4 ms juntando as duas: agora usa até ~1,3 milhão de pixels e some quando
não tem nada (+2 a 5 quadros no celular). `?fps` no endereço mostra o medidor (para o dono medir no PC e no celular
dele). Perfil do combate mandado à [arte]: `get bounds` em `props.js` (texto do zoom a cada leitura, ~1000 objetos),
a escolha do que aparece passando por todos os objetos, e personagens pintados a cada quadro.

**13/11 — tela inicial nova (imagem do dono), a parte do servidor:** o dono confirmou o nome (**Selva de Pedra**; a
primeira imagem dizia "Selva de Concreto" por engano) e concordou em deixar fora o que só funciona com o jogo na
internet (Google, e-mail, "esqueceu a senha") e o "Sair do Jogo". Mandou o fundo limpo e o logo (em
`docs/referencias/`; o fundo veio com alfa de 170 a 250, avisei a [arte]). Feito por mim: `mode` no `hello`
(protocolo 23): 'login' não cria (nome errado deixava de criar personagem sem querer), 'create' não entra (nome com
dono = `name_exists`, sem conferir a senha); sem `mode`, como sempre (tela de hoje e bots). No `main.ts`, a troca
Entrar/Criar liga sozinha quando a [arte] puser `#mode-toggle`, `#login-title` e `#password2`; quem nunca entrou no
aparelho começa em Criar. Painel: **trocar senha** de qualquer personagem salvo (`POST /admin/api/senha`; a senha não
vai para o registro; as tentativas erradas daquele nome são esquecidas). Teste em `tests/conta.test.ts`; no navegador,
conferido com os elementos colocados pelo teste (o `route.fulfill` do Playwright não serve: o Chromium trata a
página como de fora e bloqueia o WebSocket local — `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`; use `addInitScript`).

**13/11 — conversa com NPC, parte 1 (pedido do dono no meio do 2c):** "a câmera deve se posicionar na Xiovanna e
vir a msg por cima com ela falando (mexendo a boca)", igual ao aceitar/desistir e em qualquer conversa direta. Minha
parte: modo conversa no motor (`updateConversation`): ao abrir missão ou loja, zoom suave até 1,25 e `focus` na
pessoa; ao fechar, volta ao zoom do jogador; golpe recebido fecha a conversa (fora da área segura, não dá para ficar
sem ver o perigo). `talk(id, ms)` diz à view quanto tempo a boca mexe (fala ao abrir; `done` ao entregar; resposta
curta ao aceitar ou desistir). A `PD.View` só segue "gente" (criatura não é seguida) e ainda não tem `focus` nem
`talk`: pedi à [arte], junto com a fala por cima da cena no lugar do painel com retrato antigo. Conferido: PC 53 → 95
px por metro e volta; celular 28 → 49; na provisória o Curupira fica no centro da tela.

**13/11 — combate passo 2c, o recuo (fecha o passo 2):** golpe de monstro empurra o jogador na direção do golpe, o
quanto o monstro diz (`"recuo"` no ataque, em centímetros; padrão pelo tipo, de 12 a 34 como as pedras do protótipo;
no painel também). Defesa: 25% do empurrão; quebrando no golpe, 50%. Parede segura (o `sweepBody` ganhou o mínimo
como parâmetro: a esquiva continua exigindo 20 cm, o recuo aceita qualquer pedacinho). O navegador não precisou
mudar: o servidor marca o ack e a previsão se corrige sozinha, sem cancelar o "andar até". Monstros não recuam
(andam de tile em tile). Esquiva: a do jogo (3 m, 0,35 s protegido, 2,5 s de recarga) é bem diferente da do
protótipo (1 m, 0,2 s, 0,2 s); deixei a do jogo e perguntei ao dono. Testes em `tests/recuo.test.ts`.

**13/11 — combate passo 2b, a defesa com energia:** os números do `guard.js` da revisão 17 (energia 100, 6/s
segurando, 22/s de volta depois de 0,7 s, protege 0,11 s depois de levantar, arco de 140°, passa 25%, golpe gasta
10 + 0,75 × dano, quebra e rearma com 20 depois de 0,85 s soltando; anda a 70% do andar devagar). Decisões minhas,
para o dono sentir jogando: F e um botão Defesa (o botão direito continua puxando a pedra, porque aqui o esquerdo
no chão anda); a defesa vira sozinha para o monstro mais perto (até 8 m), senão para onde anda; segurando o botão
anda devagar mesmo com a defesa quebrada (o navegador prevê sem esperar o servidor); defendendo não atira nem usa
habilidade (nem o Fôlego). Por dentro: a mensagem `guard` marca cada pedaço de caminhada da fila (o servidor anda na
mesma ordem que o navegador) e o `damage` recebe a direção do golpe (fruta: para onde voa; golpe de perto e
investida: do monstro para o jogador; fogo no chão: sem direção, a defesa não segura). Conferido no PC e no celular:
4 frutas de sagui defendidas (1 de dano cada), energia caindo até quebrar e voltando; andar 4,7 m/s livre e 1,5
defendendo. Testes em `tests/defesa.test.ts`.

**13/11 — combate passo 2a, a pedra com carga** (o dono: "pode fazer o combate passo 2"; dividi em 2a carga, 2b
defesa com energia, 2c recuo): segurar puxa o estilingue e soltar atira; a carga enche em 1,1 s (pode segurar mais) e
leva o dano até o **dobro** do de hoje e o alcance de 6,5 a 9,5 m (no mapa antigo nada muda). O servidor conta a carga
pelo relógio dele, do `charge` até o `shoot` (protocolo 21); esquiva, golpe recebido e desmaio soltam a pedra sem
atirar (como no protótipo: para puxar de novo, aperte de novo). Controles: PC segura o botão esquerdo no monstro, o
direito (mira no mouse) ou J (mira no mais perto); celular segura o botão Estilingue e o toque rápido no monstro é
uma pedra fraca na hora. Na tela: anel em volta do pé que enche como relógio e fica dourado quando cheio, e "carga
perdida" embaixo do pé quando um golpe solta a pedra. Conferido no PC (mouse, botão direito e J) e no celular: cheia
= 9,5 m e dano dobrado; rápida = 6,5 m. **Para o 2b:** no protótipo o botão direito é a defesa; aqui ele puxa a pedra
— decidir com o dono quando a defesa entrar.

**13/11 — primeira missão do jogo novo** (pedida pelo dono): "O Despertar" (Curupira → falar com a atendente da
Budega) e "Saguis Encantados" (a Budega pede 4 saguis acalmados; Garrafada). Tipo novo de objetivo "falar" (aceita
com quem dá, conclui com a pessoa procurada: `questFinisher`) e "rotulo" (texto do objetivo). O sagui virou "Sagui
Encantado" (decisão do dono: muda o texto, não o monstro). Mexi só na lógica do `talk.ts` (qual missão aparece com
quem; "Para concluir"), não no visual. Conferido de ponta a ponta no PC e no celular (~20 s de caça).

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

Números para não se perder: protocolo na versão **26** (16: `walk` no lugar de `step`; 17: `mundo` no `hello`; 18:
`slow` no `walk`, andar devagar no mundo novo; 19: `quick` no item, os atalhos de consumo; 20: objetivo `talk` e
`goalLabel` nas missões; 21: `charge`, começar a puxar o estilingue; 22: `guard` e `energy`, a defesa, e `blk` no
`hit`; 23: `mode` no `hello`, entrar ou criar conta; 24: `gm`, o menu ADM; 25: `oops`, erros do navegador; 26: `npc` no `gm`);
`MIGRATIONS` no
passo **4** (3: coluna `quests`; 4: coluna `admin`; o movimento livre não precisou de passo novo: o salvo continua
sendo o tile).

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
