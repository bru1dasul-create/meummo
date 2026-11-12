# Pindorama 2.5D — guarda e peso dos impactos · revisão 17

Esta revisão adiciona defesa frontal com energia e diferencia a reação, o recuo e o som pela força da pedra. O visual aprovado da revisão 15 foi preservado. O rival continua sendo o mesmo alvo de treino; sua IA não recebeu novas ações.

Extraia a pasta e abra index.html. Não é necessário instalar dependências para jogar.

> **No repositório do MeuMMO** entram só o código, este LEIA-ME e, em `auditoria/`, os arquivos que os testes leem
> (`medir.cjs`, `medir-ritmo.cjs`, `renderer-r8-referencia.js` e as poses/tempos de referência em `.json`). Os
> relatórios, PDFs, GIFs e imagens citados abaixo ficam com o dono, no ZIP da revisão 17. Três roteiros
> (`mock-jogo.cjs` e quem o usa, `teste-exportacao-guarda.cjs`, `teste-render-morte.cjs`) pedem o pacote
> `@napi-rs/canvas`, que não está instalado no projeto.

## Mundo novo: a PD.View e a clareira (Etapa 3 do Mapa 01)

`js/view.js` é o desenho 2.5D do jogo de verdade (página `/?novo`): o motor da [estrutura] (`src/client/novo/`)
conecta ao servidor e chama, pela interface `WorldView` (`src/client/novo/view.ts`), `new PD.View(caixa, tmj)`,
`addActor(id, { kind, type, name, look, x, y, angle, me })`, `moveActor(id, x, y, angle, { durationMs, dash })`
(posição do pé em metros, a cada ~50 ms; `angle` em graus no chão, 0 = leste e 90 = sul), `removeActor`, `say`,
`follow`, `frame`, `toWorld`, `toScreen`, `groundDirOfScreen` e `destroy`. A view desenha também o nome em cima de cada um e os balões de fala.
Os scripts que ela precisa, na ordem, estão em `view-scripts.json`; no jogo, quem os carrega é
`src/client/novo/arte.ts`. No jogo, o personagem vira mais depressa que no treino (virada ágil, escolha do dono:
o servidor muda de direção na hora); `node ferramentas/seguir.cjs` mede o atraso e o pé na virada normal e na ágil. O mapa vem do `.tmj` do [mundo] (`public/assets/maps-iso/capao.tmj`), lido por
`js/world/tmj.js`: chão (mata, grama, terra, asfalto, trilhas e o círculo ancestral que acende), árvores por espécie
(a Figueira dos Despertos com raízes e símbolos que brilham, ipês, mata), arbustos, pedras, gradil, Portão I, pilares,
poste e os pontos do Véu. Para testar sem o servidor: `clareira.html`, aberta por um servidor (com o jogo ligado,
`npm run dev` e `http://localhost:5173/prototipos/pindorama-25d/clareira.html`). Um "servidor de mentira" corre a
4,5 m/s (anda a 2 m/s com Shift, como o jogo) e manda a posição a cada 50 ms, como o motor de verdade.

## Controles

- WASD ou setas movem; Shift corre; C/Ctrl agacha; Espaço pula; Q esquiva.
- Enter ou Começar treino inicia a rodada. O rival também usa estilingue.
- Segure F ou o botão direito do mouse para defender. No celular, segure Defender. O botão direito aponta a guarda para a mira; F parado acompanha o rival vivo. Ao caminhar, F acompanha a frente do personagem.
- A guarda leva aproximadamente 0,13 segundo para subir. Protege um arco frontal de 140 graus. Laterais mais abertas e costas recebem dano normal.
- Um bloqueio com energia suficiente reduz cerca de 75% do dano. Ainda existe dano residual. Você anda mais devagar enquanto defende.
- A barra mostra 100 de energia. Sustentar a guarda gasta 6 por segundo; receber um golpe gasta 10 + 0,75 vezes o dano original. Uma pedra de 40 consome 40 de energia e causa 10 de dano ao ser bloqueada por completo.
- Se faltar energia, a proteção é parcial e a guarda quebra. Solte a defesa e recupere pelo menos 20 de energia para levantá-la novamente. A recuperação começa após 0,7 segundo sem guarda ativa, a 22 por segundo. Manter F pressionado depois da quebra não rearma sozinho.
- 2 ou Estilingue equipa a arma; 1 ou Punhos retorna aos socos. A troca fica indisponível durante ações e guarda ativa.
- Segure J, o botão esquerdo do mouse ou Pedra no celular; solte para disparar. A carga completa leva cerca de 1,1 segundo e pode ser mantida. O dano vai de 20 a 40.
- A força também decide a reação do corpo, o recuo e o som: sem defesa, pedras leves recuam 12 cm e pedras fortes 34 cm. A guarda reduz bastante esse recuo. Paredes e personagens continuam bloqueando o trajeto.
- Defender cancela uma pedra carregada sem disparar. Q, golpe recebido, cancelamento do toque, ajuda, perda de foco e reinício também cancelam a carga. Uma nova puxada precisa de um novo aperto.
- A faixa laranja anuncia o tiro do rival. Defenda de frente, saia da linha ou esquive com Q.
- O som começa no primeiro toque ou tecla. Som ligado/desligado controla os efeitos; a escolha é lembrada neste navegador. Há variações de timbre, impacto conforme a carga e sons próprios para bloqueio e quebra.
- Depois da vitória, continue andando e atirando. O corpo caído fica fixo, bloqueia passagem e recebe efeitos sem perder mais vida. Se ele cair sobre você, é possível sair do contato inicial.
- R ou Enter começa outra rodada depois da queda. A arma escolhida é conservada. Abrir a ajuda ou sair da janela pausa os projéteis e cancela as ações.

A pedra sai da bolsa do estilingue. O alcance de dano continua em 6,5 a 9,5 metros conforme a carga. O arco visual pode terminar no chão além dessa distância, sem ampliar o alcance de dano.

E demonstra o impacto e K a queda padrão. No combate, a direção real da pedra decide entre cair para a frente ou para trás. Caminhada, soco lateral, emenda da esquiva na corrida e a anatomia da morte preservam os ajustes anteriores.

## Código e verificações

js/guard.js reúne a energia, o arco frontal e a pose de defesa. js/combat.js resolve danos e projéteis; o animador aplica o recuo no trajeto com colisão. js/audio.js sintetiza e encerra os efeitos. Os scripts HTML usam guarda-impacto-r17 para atualizar o cache.

    node ferramentas/teste-guarda-impacto.cjs
    node ferramentas/teste-guarda-controles.cjs
    node ferramentas/teste-som-controles.cjs
    node ferramentas/teste-efeitos-morte.cjs
    node ferramentas/teste-carga.cjs
    node ferramentas/teste-carga-controles.cjs
    node ferramentas/teste-refino-movimento.cjs
    node ferramentas/teste-colisoes.cjs
    node ferramentas/teste-combate.cjs
    node ferramentas/teste-fluxo.cjs
    node ferramentas/testes.cjs

Passaram 553 cenários novos de defesa e impacto, 16 integrações novas de entrada e som e 2.774 verificações anteriores: 3.343 ao todo, sem falhas. A física foi simulada em oito direções e a 30/60/120 Hz. A exportação adicional verificou 64 quadros de defesa e 16 reconstruções por camadas sem cortes ou diferenças de pixels.

As prévias usam o Canvas real em execução local, com legendas de demonstração sobrepostas. O AudioContext foi simulado. Não houve teste interativo ou audição em navegador nesta revisão; o GIF não contém som. Os dados e o relatório estão em auditoria/REFINAMENTO-17-GUARDA-IMPACTO.pdf.

## Exportação e histórico

prancha.html inclui a guarda em oito direções. exportar.html inclui o ciclo defender, sem arma. O pacote pindorama-guarda-sprites.zip da página contém 64 PNGs transparentes; o jogo faz as transições, a energia e os bloqueios ao vivo. Os pacotes antigos de esquiva, morte e impacto continuam identificados como revisão 10.

O ZIP principal contém jogo, código, testes, exportador, prancha, relatórios e mídia atual. As imagens antigas ficam em ZIPs opcionais: pindorama-historico-auditorias.zip, pindorama-historico-combate.zip (revisões 11 a 13) e pindorama-historico-estilingue.zip (14 e 15). Extraia ao lado de pindorama-25d para restaurar os caminhos dos relatórios antigos. PDFs e dados históricos permanecem no principal.
