# MeuMMO — instruções do projeto

## Contexto
- MMORPG 2D (visão de cima, movimento em grade de tiles) que roda no navegador.
- Time: o dono do projeto (ideias, design, testes) + Claude (código). Converse em **português do Brasil**,
  com explicações simples — nem toda decisão técnica precisa de jargão.
- Tema provisório: fantasia medieval. O nome "MeuMMO" também é provisório.
- Onde estamos e o que vem depois: `docs/ROADMAP.md`. Como funciona por dentro: `docs/ARQUITETURA.md`.
- Tentativas anteriores de MMO não deram certo por excesso de escopo. Por isso: etapas pequenas, sempre jogáveis.

## Regras
1. **Toda etapa termina jogável.** Nada quebrado na `main`.
2. **Servidor autoritativo:** o cliente só envia intenções ("quero andar", "quero atacar"); o servidor decide.
   Toda mensagem do cliente passa por `src/server/validate.ts`.
3. **Regras compartilhadas** (movimento, mapa, protocolo, busca de caminho) ficam em `src/shared`,
   que não pode importar nada de navegador, Phaser ou Node.
4. **Conteúdo é dado:** mapas no Tiled (`public/assets/maps`); monstros e itens virão em JSON. Evite conteúdo fixo no código.
5. Antes de commitar: `npm run check` (tipos + testes) precisa passar. Regra nova no servidor vem com teste em `tests/`.
6. Mudou o formato das mensagens? Aumente `PROTOCOL_VERSION` em `src/shared/constants.ts`.
7. Ao concluir algo do roteiro, marque em `docs/ROADMAP.md`.
8. Comentários e textos do jogo em português; nomes no código em inglês.
9. Não rode `npm run gen:map -- --force` sem pedir: apaga edições feitas no Tiled.

## Comandos
- `npm install` — instala dependências (Node 22+)
- `npm run dev` — servidor (porta 3000, reinicia sozinho) + jogo (Vite, porta 5173, abre em http://localhost:5173)
- `npm run check` — confere tipos e roda os testes
- `npm run build && npm start` — produção: um servidor só, na porta 3000, entregando o jogo compilado
- `npm run bots -- 10` — 10 jogadores automáticos andando e conversando (precisa do servidor ligado)
- `npm run gen:tiles` — redesenha a arte provisória (`scripts/tileset.ts` → `public/assets/tiles.png`)
- `npm run render:map` — desenha o mapa inteiro em `docs/mapa.png`

## Instalação no PC do dono do projeto (Windows)
- O jogo fica em `E:\mmorpg`, instalado por `instalar-windows.ps1` (comando de uma linha no README).
- Atalhos na área de trabalho: `jogar.bat` (liga tudo e abre o navegador) e `atualizar.bat` (git pull + npm install).
- Scripts `.bat`/`.ps1` sem acentos (compatibilidade) e com CRLF (veja `.gitattributes`).
- Se mudar algo que exige passo extra na instalação, atualize o `instalar-windows.ps1` e o `atualizar.bat`.

## Conferir no navegador
Para ver de verdade (além dos testes): `npm run build && npm start`, ligue alguns bots e abra
http://localhost:3000 com o Playwright/Chromium, entre com um nome e tire prints (computador e celular).
