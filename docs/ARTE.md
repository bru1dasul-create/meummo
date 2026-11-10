# Caderno da frente Arte

> Para o chat **"Arte e visual"** (a frente **[arte]**) retomar o trabalho depois de limpar a conversa (`/clear`) ou
> num chat novo. Leia junto: `CLAUDE.md` (regras e divisão do trabalho), `docs/ROADMAP.md` (tarefas com a etiqueta
> **[arte]**) e `docs/ARQUITETURA.md` (seção "Personagem em camadas").

## Quem sou
O chat da frente **[arte]**: personagens (`src/client/game/doll/`, `characters.ts`, `animator.ts`), equipamento no
corpo (`gearArt.ts`), monstros (`monsterArt.ts` e os pintados em `monsterPaint.ts`), ícones (`itemArt.ts`,
`actionArt.ts`), moeda (`coinArt.ts`), efeitos (`effects.ts`), desenho das entidades (`EntityView.ts`), telas
(`style.css`, `index.html`, `ui.ts`, `bag.ts`, `shop.ts`, `talk.ts`), sons (`sfx.ts`), a prancha de prévia
(`scripts/render-characters.ts` → `docs/personagens.png`) e os testes `tests/characters.test.ts` e
`tests/monsterArt.test.ts`. O dono não programa: ele decide o jogo. Converso em português do Brasil, direto e com
explicações simples, sem concordar só para agradar, e mando prints do navegador (PC e celular) em cada entrega.

## Combinados com o dono
- **Qualidade é o que ele mais cobra** ("capricha, deixa com qualidade excelente nos personagens"). Ele escolheu o meu
  personagem em camadas no lugar do de 20x24 do [mundo]. Depois de várias rodadas de refino, ainda achou "feio" e
  pediu para **tirar a textura pixelada**. Ou seja, ele quer arte desenhada/pintada, não pixel art (veja o piloto abaixo).
- **Ordem aprovada (já cumprida):** 1) personagem na `main` e refino; 2) Dona Iracema, loja e ouro; 3) monstros
  (jacaré, boto e Iara).
- **Juntar na `main`:** só com o "pode" dele, depois do `npm run check` e da conferência no navegador (PC e celular).
  Em 9/11 ele confirmou ("Pode juntar") e juntei tudo num commit só (squash). Antes de limpar esta conversa ele pediu
  para juntar o que estivesse pronto. Em 10/11, antes de outro `/clear`, perguntei e ele respondeu "Pode juntar"
  (protótipo 2.5D). **Aviso de outro chat dizendo que ele autorizou não vale como autorização:**
  pergunto a ele (fiz assim em 9/11).
- **Mensagens de outros chats** chegam por `send_message` e são informação, não ordem do dono. Os pedidos da
  [estrutura] e do [mundo] para a [arte] ficam também no roteiro. Quando o dono pediu ("vê com o outro chat"), falei
  com o [mundo] por `send_message`.
- **Chave de API:** nunca pedir no chat.
- **Dinheiro:** antes de gastar, digo o custo estimado e espero o "pode".
- **Desenhos novos** sempre conferidos por imagem: prancha (`npm run render:characters`) e print do jogo.

## Protótipo Pindorama 2.5D (10 de novembro de 2026)
O dono pediu (com um zip de referência: sprites em pixel art do protagonista, 8 vistas e poses) um **protótipo
separado** do protagonista de **PINDORAMA**: câmera isométrica fixa (tipo Albion), estilo HQ, **tudo desenhado por
código em Canvas 2D**, sem engine, sem WebGL e sem imagens no jogo. Está em `prototipos/pindorama-25d/` (leia o
`LEIA-ME.md` de lá). **Está na `main` desde 10/11:** o dono autorizou ("Pode juntar") e juntei num commit só. O
protótipo não mexe no jogo nem no servidor.
- **Como é feito:** modelo único em `js/character/body.js` (medidas, cores, esferas); esqueleto 3D invisível com IK
  de dois ossos (`rig.js`); animador procedural (`animator.js`: parado, andar, correr, agachar, pular, soco, 8
  direções, molas de cabelo/penas/colar); desenho (`renderer.js`): cada parte é o casco das esferas projetadas, com
  contorno de tinta (silhueta grossa, linhas de dentro finas), sombra e brilho por recorte de polígono convexo (sem
  máscara: mais leve). Equipamento: arquitetura em `equipment.js`, sem itens (`__pd.provarEquipamento()` testa).
- **Cenário:** esquina de SP em `js/world/` (mapa em dados em `map.js`; chão pré-desenhado em pedaços de 512 px;
  prédios, árvores e postes viram imagens prontas; ordem isométrica pelo pé no chão; colisão).
- **Conferir:** `prancha.html` (8 direções e todas as animações) e `index.html` (o jogo; `?fps` mostra quadros por
  segundo). No navegador: `window.__pd` (herói, mundo, câmera, `teleport`, `setZoom`, `pause`).
- **Página publicada** (para o dono testar no PC e no celular): https://claude.ai/artifact/TfaqVQmFHT1H7YQDMW7dC3
  (privada). Para republicar no mesmo link: monte a página sem `<!doctype>/<html>/<head>/<body>` (a publicação põe
  o esqueleto), mande os `js/*.js` em `files` e passe esse link como `url`.
- **Nano Banana:** o dono pôs US$ 5 de crédito pré-pago em 10/11. Os modelos novos (2.1 e 2) davam 503 (lotados);
  o `gemini-2.5-flash-image` funcionou. Sem mandar a referência em pixel (só texto), ele sai no estilo HQ. Gasto: 3
  imagens, ~US$ 0,12. Estudos em `prototipos/pindorama-25d/referencias/`.
- **Desempenho (navegador de teste, sem placa de vídeo):** ~60 fps no computador; com a CPU 4× mais lenta, 23 fps
  (o celular de verdade desenha com a placa de vídeo — falta testar num aparelho real).
- **Atenção:** Ctrl+W fecha a aba no Chrome; o agachar do Ctrl é de toque (liga/desliga) e há o C.
- **Revisão crítica (agente) e o que mudou:** rosto com relevo (nariz, ponte, arco da sobrancelha, queixo),
  franja aberta mostrando o "V", cintura menos fina, ombros baixos (pescoço aparece), braços mais longos e mão
  aberta quando relaxado, pé com peito/maléolos, tanga com cava em V, cabelo largo com mechas finas e lisas
  (sem "caroços"), penas de 20 a 27 cm em planos diferentes, contorno ≥ 1,6 px. Animação: **trava dos pés**
  (o pé que pisa fica preso; parado dá passinhos; medido 0,0 cm/s de escorregão), pulo com perna esticada no
  impulso e braços subindo, pouso mais fundo, soco com giro de 35°/40° e ombro avançando. Cenário: mosaico paulista
  (mapa de SP) no lugar das ondas de Copacabana, "janela" em vez de copa transparente, câmera mais perto.
- **Testes do protótipo** (Playwright): roteiros em `prototipos/pindorama-25d/ferramentas/` (tabela no `LEIA-ME.md`
  de lá): prancha, cenas do jogo, colisão/8 direções/estados/desempenho, toque, ossos, escorregão, passada e trancos.
  Rode de dentro do scratchpad (os prints vão para a pasta atual). Não há testes em `tests/` porque o protótipo não
  faz parte do jogo.
- **Republicar no mesmo link numa conversa nova:**
  1. `python3 -I prototipos/pindorama-25d/ferramentas/montar_pagina.py <scratchpad>/publicar` (grava `index.html` e
     mostra a lista dos JS).
  2. `Artifact` com `action: "read"` e o `url` do link: sem ler antes, a publicação é recusada.
  3. `Artifact` (publicar) com o mesmo `url`, `file_path` = `<scratchpad>/publicar/index.html` e `files` = a lista do
     passo 1.

### Onde parei (10/11, antes de limpar a conversa): refino do personagem
O dono testou a página e gostou ("ficou bom", "estamos chegando onde eu quero") e pediu **mais uma refinada**:
1. "ainda tem alguns bugs quando ele bate";
2. "a cabeça não gira com o corpo, fica meio estranho";
3. "a forma de andar parece de um robô".

Ele pediu para limpar a conversa antes de mexer. **O personagem ainda não foi alterado:** só medi e anotei aqui.

**Diagnóstico medido** com `saltos.cjs` e `passada.cjs` (números de antes do refino, para comparar depois):
- **Tranco no soco:** o peito gira **37° num quadro só** (a 60 fps) na hora do golpe. O giro vai de +35° (armar) a
  −40° em 0,075 s com `easeOut` (bloco do soco no `animator.js`, `twistT`). Punho e cotovelo: tranco de
  42–46 cm/quadro² no golpe.
- **A cabeça não acompanha:** no soco, `head.yaw -= twist * 1.05` anula o giro do peito (o peito gira 1,07 × twist:
  0,75 na coluna + 0,32 na pelve). A cabeça fica parada enquanto o peito gira até **48,6°** em relação a ela.
  Andando, ela anula 85% do giro do peito (`head.yaw = -chestYawAbs * 0.85`) e fica "no estabilizador".
- **Virar para o mouse:** o corpo gira **27,6° num quadro** (`dampAngle(this.yaw, attack.dir, 22, dt)`). Socar para o
  lado vira um pulo de pose.
- **Combo** (clicar de novo): na troca de mão, os dois braços e o tronco pulam de pose (tranco de 56 cm/quadro² no
  punho direito). O soco novo começa de poses fixas (`guardFront`, `guardRear`, giro 0), e não de onde o corpo está.
  O pé da frente também troca a cada soco (`lead` depende da mão), e os pés se ajeitam no meio do combo.
- **Fim do soco:** o `poleLocal` do cotovelo volta ao padrão de uma vez (o cotovelo pode estalar no último quadro).
- **Andar curto e rápido:** **178 passos por minuto** com passo de 54 cm a 160 cm/s. Uma pessoa de ~1,75 m (a altura
  dele) anda a 100–130 passos/min, com passo de 65–80 cm: o nosso parece passinho de brinquedo.
- **Dois toques por passo:** em toda pisada o pé cai longe demais do quadril, e o "passo rápido de correção" puxa o
  pé (9 correções em 9 pisadas andando, 13 em 12 correndo). A causa é a trava, que prende o **tornozelo** parado
  durante todo o apoio. Com o quadril só 3,4 cm abaixo do de pé, a perna alcança ~22–25 cm na horizontal, e o passo
  pede ~34 cm na frente. Gente de verdade ganha esse alcance rolando o pé (calcanhar → pé chato → ponta) e
  abaixando um pouco o quadril quando os dois pés estão no chão.
- **Jeito de máquina:** andando, o cotovelo fica sempre dobrado 44°–61° (braço solto dobra ~10°–35°). Pelve, peito,
  braços e cabeça seguem a mesma senoide da fase, sem atraso entre eles. Correndo: 244 passos/min (correr de verdade:
  160–190).

**Plano** (nesta ordem; cada item conferido com as ferramentas e a prancha antes do seguinte):
1. **Pé que rola:** a trava prende o ponto de contato (calcanhar ao pisar, ponta ao empurrar) e o tornozelo gira em
   volta dele. O pé pisa sempre onde a perna alcança. Meta: **0 correções** andando e correndo, e o escorregão
   continua em 0,0 cm/s.
2. **Passada mais longa e mais lenta:** ~120–140 passos/min andando (passo de ~65–75 cm a 160 cm/s) e ~170–190
   correndo. O quadril desce um pouco no apoio duplo e sobe no meio do apoio; o joelho dobra de leve ao receber o
   peso.
3. **Andar orgânico:**
   - braços em pêndulo a partir do ombro, soltos (cotovelo 10°–35°), atrasados ~8–10% do ciclo em relação às
     pernas, com a mão passando um pouco para dentro na frente;
   - ombro sobe e desce ao contrário do quadril;
   - peito gira menos (±4°–5°) e com atraso;
   - leve inclinação para a frente.
4. **Cabeça junto com o corpo:** segue boa parte do giro do peito (anula só ~30–40% andando), com uma mola (atraso
   pequeno), e **vira primeiro** quando ele muda de direção (olha para onde vai). No soco, gira com os ombros
   (~50–60% do giro), com os olhos no alvo.
5. **Soco sem tranco:**
   - giro em cadeia (quadril → peito → ombro → punho, 1–2 quadros entre um e outro);
   - golpe um pouco mais longo (~0,10 s), com o giro numa curva suave;
   - limite de giro por quadro (~12°–15°);
   - virar para o mouse com velocidade máxima (~720°/s) em vez de pular.
6. **Combo liso:** o soco novo começa da pose atual (guarda a pose e mistura em ~70 ms). A base dos pés fica a mesma
   durante o combo inteiro, e o `poleLocal` do cotovelo se mistura na saída.

**Metas para entregar:**
- `saltos.cjs` sem tranco grande: punho/cotovelo ≲ 15 cm/quadro², peito ≲ 15° por quadro, cabeça virada em relação
  ao peito ≲ 25°;
- `passada.cjs` com 0 correções; `escorregao.cjs` em 0,0 cm/s; `ossos.cjs` com variação 0,0000;
- prancha nas 8 direções;
- revisão por outro agente (mostre o código e os prints, sem a minha conclusão);
- prints de PC e celular, e republicar no mesmo link.

## Onde estamos (9 de novembro de 2026)
Tudo na `main` (commit f9b1871, "Arte: personagem em camadas, loja e ouro..."):
- **Personagem em camadas** (`doll/`): quadro 64x64 desenhado com o dobro de pixels (`DENSITY` 2) e mostrado na
  metade. Corpo de ~26 px do mapa; `CHAR_TOP` 29 é a altura do nome. Animações (`ANIMS`): parado 4, andando 6,
  correndo 4 (esquiva), atirando 3, golpe 4, apanhando, desmaiado. Vistas: frente, costas e lado (espelhado).
  - **Rosto:** sprite separado (`face.ts`), com as expressões normal, piscar, dor, feliz, falando e desmaiado, mais
    óculos e sorriso.
  - **Corpo:** dois tipos (forte e esguio). Penteados curto, longo, espetado e trança; coque e fogo só de NPC.
  - **Textura:** uma por combinação de aparência + roupa, dividida entre quem é igual e desenhada aos poucos (6 ms por
    quadro do jogo). A câmera usa sempre zoom par, para o dobro de pixels ficar nítido.
- **Equipamento no corpo** (`gearArt.ts`, pelo `icone` do item): chapeu_palha, gorro, capacete_sucata, couraca,
  tunica, chita_avental, tunica_folhas, gibao, armadura, luvas, manoplas, botas, colar, colar_sementes, ferradura,
  capa, estilingue, facao, faca, machadinha, arco, escudo_jabuti, escudo_bueiro. O teste avisa se um equipamento de
  `data/items.json` ficar sem visual.
- **NPCs com aparência própria** (`NPC_LOOKS` em `characters.ts`):
  - **Dona Iracema:** cabelo grisalho em coque, óculos, sorriso, vestido de chita com avental e colar de sementes.
  - **Curupira:** cabelo de fogo que tremula, pés virados para trás, descalço, túnica de folhas.
- **Loja e ouro:** moeda desenhada com flor de ipê (`coinArt.ts`, usada pelo CSS em `--coin`) e sons de moeda, compra e
  venda. A janela da loja é uma barraca de feira (toldo, retrato, fala no balão, abas Comprar e Vender).
- **Conversa com NPC e missões** (`talk.ts`): mesmo painel da loja, com cipó em cima, retrato e fala no balão (verde
  quando ele responde a uma entrega).
  - **Cartões de missão:** selo ! (nova), ? (pronta) ou … (fazendo), objetivo com barra de progresso e a recompensa
    em fichas.
  - **Na tela:** a lista de missões tem barrinha; em cima do NPC aparece um selo dourado com !, ou verde com ?.
- **Monstros pintados** (`monsterPaint.ts`, mesmo pincel do personagem):
  - **Jacaré Mutante:** abre a boca no bote.
  - **Boto Encantado:** de chapéu branco; pula na cauda e cospe o jato.
  - **Iara (chefe):** bola d'água na mão e pose de canto própria, a animação `special` ligada pelo `fx` `song`.
  - **Quadros de cada um:** parado, andando, armando, golpe e (se tiver) especial.
  - **Monstros antigos:** sagui, jararaca, saci, corpo_seco, capelobo e mula_sem_cabeca continuam 16x16 em
    `monsterArt.ts`, menores que um jogador.
- **Efeitos** (`effects.ts`):
  - **Jato d'água (`agua`):** gotinhas atrás e respingo azul.
  - **Canto da Iara:** notas coloridas se espalhando pela área, com um anel no alcance.
  - **Jogador encantado** (`EntityView.charm`): pisca azul, anel azul no chão e notinhas em cima do nome.
- **Ícones 16x16** (`itemArt.ts`): banana, couro, escama, dente, chapeu_palha, estilingue, colar, gibao, gorro, erva,
  sucata, faca, couraca, ferradura, mochila.
- **Sons sintetizados** (`sfx.ts`): shot, hit, hurt, warn, dash, levelup, death, heal, kill, arc, loot, rare, equip,
  charge, fire, coins, coin, buy, sell.

## O piloto do estilo desenhado (Nano Banana): onde parei
**Por que:** por código, o personagem sempre sai pixelado. O dono quer o estilo dos prints que ele mandou no começo:
jogo desenhado à mão, com contorno de tinta escuro, sombreado suave e câmera de cima (três quartos). A outra
referência que ele mandou é uma ficha de personagem em pixel art bem detalhada: guerreira ruiva de capa verde e
armadura, vista de costas, de frente e de lado. As imagens ficaram só na conversa antiga. Se precisar, peça de novo;
use só como guia de estilo, sem copiar personagem de outro jogo.

**O plano (proposto e aceito):**
- **O Nano Banana desenha as peças:** cabeça, tronco, braços e pernas nas 3 vistas, e cada equipamento separado, em
  fundo verde liso.
- **Eu monto:** tiro o fundo e monto as peças no esqueleto que já existe (`doll/poses.ts`), aproveitando animações,
  equipamento por parte e troca de roupa na hora.
- **Piloto:** um personagem só (Dona Iracema, Curupira ou o do jogador; o dono escolhe), nas 3 vistas, parado,
  andando e atacando, rodando no jogo para comparar.
- **Atenção:** se só o personagem ficar desenhado, ele destoa dos mapas e monstros em pixel art. Mudar o estilo é
  decisão do jogo inteiro e envolve o [mundo].

**Pronto:**
- **A chave funciona.** O dono criou a chave do Gemini no Google AI Studio, com faturamento no Nível 1. Ela está no
  ambiente da nuvem "Default", em **Segredos de rede**: host `generativelanguage.googleapis.com`, cabeçalho
  `x-goog-api-key`, sem prefixo. O proxy põe o cabeçalho em cada chamada e eu nunca vejo o valor. O formulário seguro
  (`request_credential`) não serve, porque só aceita `Authorization: Bearer`.
- **O script** está em `scripts/nano-banana.py`, no ramo `claude/blissful-meitner-hp1i5e`, commitado mas fora da
  `main` porque é trabalho pela metade.
  - **Conferir a chave:** `python3 -I scripts/nano-banana.py --listar` (não gera imagem, não custa).
  - **Gerar:** `--out arquivo.png --prompt "..." [--model] [--aspect] [--size] [--ref imagem.png]`.
  - **Trava própria:** 120 imagens ou US$ 10 estimados. A contagem fica em `saves/nano-banana.json`, fora do Git.
  - **Por que curl:** o `fetch` do Node não usa o proxy da nuvem; o curl usa.
- **Modelos disponíveis**, com preço por imagem 1K de sites de terceiros (a página oficial não abriu):
  - `gemini-nano-banana-2.1` (Nano Banana 2.1, o mais novo): ~US$ 0,034; 2K ~US$ 0,05. **Comece por ele.**
  - `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite): ~US$ 0,034.
  - `gemini-3.1-flash-image` (Nano Banana 2): ~US$ 0,067.
  - `gemini-2.5-flash-image` (Nano Banana, antigo): ~US$ 0,039.
  - `gemini-3-pro-image` (Nano Banana Pro): ~US$ 0,134.
  - **Custo do piloto:** com 60 a 100 imagens no 2.1, ~US$ 2 a 3,50.
- **O plugin de terceiros** `Ibrahim-3d/nano-banana-claude-plugin` foi avaliado e não é preciso. Ele também depende da
  chave, guarda a chave num arquivo de texto e eu chamo a mesma API direto.

**Parei aqui:** nenhuma imagem foi gerada (gasto: US$ 0). O dono pediu **"espera pra eu mandar mais exemplos e tentar
gastar mesmo"**. Pedi a ele:
1. imagens do estilo que quer (servem até de outros jogos, só como guia);
2. exemplos com a câmera de cima, como a do nosso jogo;
3. por qual personagem começar.

Também pedi que confirmasse o **teto mensal de US$ 15** no AI Studio (Spend → "Monthly spend cap"); ele ainda não
confirmou.

**Quando os exemplos chegarem:**
1. Faça 1 ou 2 testes de estilo (~US$ 0,03 cada): uma ficha de frente, lado e costas em fundo verde liso `#00FF00`,
   e mostre.
2. Só com o "pode" dele, siga para as peças e a montagem.

## Esperando outras frentes
- **[mundo]:** a Dona Iracema aparecia por cima do balcão da barraquinha (o balcão desenhado na frente das pernas).
  O [mundo] anotou o pedido; confira no jogo se ficou certo.
- **[estrutura]** (ideia, não pedida ainda): o servidor só avisa o próprio jogador de que ele está encantado
  (`charm`), então os outros não veem o brilho azul em quem foi encantado. Se o dono quiser que todos vejam, é pedido
  para a [estrutura].

## Próximos passos possíveis (o dono escolhe a ordem)
1. **Piloto do estilo desenhado** com o Nano Banana (esperando os exemplos do dono, veja acima).
2. **Monstros antigos no capricho novo** (`monsterPaint.ts`): sagui, jararaca, saci, corpo-seco, capelobo e Mula sem
   Cabeça. Hoje são 16x16 e menores que um jogador. Se o piloto aprovar o estilo desenhado, faça já nesse estilo.
3. **Música da vila e sons de verdade** (roteiro).
4. **Boitatá** (chefe) quando a [estrutura] fizer, e a lenda do Shopping do Largo Treze.
5. **Pequenos acertos vistos:**
   - os tiros de monstro saem do meio do quadrado, não da boca do boto ou da mão da Iara;
   - as notas do canto são grandes (10x12 px do mapa); se o dono achar demais, desenhar menores.

## Como confiro (receitas)
- **Prancha:** `npm run render:characters` (`-- --so Curupira --escala 4 --out arquivo.png` para um só). Os monstros
  pintados ficam embaixo.
- **Testes de arte:**
  - equipamento sem visual;
  - quadro do personagem sem nada cortado nas bordas, com o fogo do Curupira dentro;
  - chapéu, rosto e arma acompanhando a cabeça e a mão;
  - pés virados do Curupira;
  - monstro pintado inteiro dentro da moldura, com os pés no chão;
  - animações diferentes entre si.
- **Navegador:**
  1. `npm run build` e `MEUMMO_SAVE=<arquivo temporário> npm start`. **Religue o `npm start` depois de cada build**,
     senão a tela de entrada trava.
  2. Abra pelo Playwright em 1280x760 com `deviceScaleFactor: 2` e no celular (`devices['Pixel 7']`). Entre por
     `#name`/`#password`/`#login-button` e espere `window.__meummo.me`.
  3. Para andar até alguém: `__meummo.walkTo(x, y)` num quadrado **ao lado** dele (em cima, os dois se sobrepõem).
  4. Para clicar num NPC: `__meummo.screenOf(x, y)` + `page.mouse.click`.
- **Levar para outro mapa e curar** (servidor de teste): `fetch('/admin/api/jogador', { method: 'POST', headers: {
  'content-type': 'application/json', 'x-meummo-admin': '1' }, body: JSON.stringify({ acao: 'levar', id, mapa:
  'billings', x, y }) })`. Se responder "não achei chão livre", tente outro quadrado. Para curar: `{ acao: 'curar', id }`.
- **Criatura que ainda não está no mapa:**
  1. Crie uma cópia separada com `git worktree add <rascunho> HEAD`.
  2. Na cópia, ligue o `node_modules` (`ln -s`) e passe o objeto da camada `lendas` para `monstros` no `.tmj`.
  3. Rode `build` e `start` a partir da cópia; no fim, `git worktree remove`.

  O `.tmj` de verdade, que é do [mundo], fica intocado.
- **Para a missão ficar pronta para entregar:** um laço no Playwright que clica no sagui mais perto a cada 350 ms e
  cura pelo painel a cada 8 cliques (5 saguis em ~25 s).
- **Juntar na `main` (com o "pode" do dono):**
  1. `git checkout -B juntar-main origin/main`, depois `git merge --squash <ramo>`, `npm run check`, commit e
     `git push origin juntar-main:main`.
  2. Depois, junte a `main` no ramo com um merge normal. Recomeçar o ramo com força (`--force-with-lease`) foi
     bloqueado pela permissão do ambiente.
