# MeuMMO — instruções do projeto

## Contexto
- MMORPG de **ação** 2D (visão de cima, movimento em grade de tiles) que roda no navegador (PC e celular).
- Time: o dono do projeto (ideias, design, testes) + Claude (código). Converse em **português do Brasil**,
  com explicações simples — nem toda decisão técnica precisa de jargão.
- Tema: **fantasia com folclore brasileiro** (Saci, Curupira, Iara...). Combate de ação: mira, atira, desvia;
  monstros avisam golpes no chão. O nome "MeuMMO" é provisório.
- Mundo (aprovado): **Pindorama — Selva de Pedra**, São Paulo tomada pela floresta. Tom: "um pouco dos dois" —
  colorido e vivo nas vilas, sombrio nas ruínas; sem violência explícita (quem perde a vida desmaia).
  Zonas: **Refúgio de Guarapiranga** (`public/assets/maps/refugio.tmj`, inicial) e **Ruínas de Santo Amaro**
  (`santo-amaro.tmj`, níveis 4 a 8, chefe: Mula sem Cabeça), ligadas pela avenida (camada `saidas`). Lugares reais sim, **marcas não**.
- Visão do jogo: `docs/DESIGN.md`. Onde estamos e o que vem depois: `docs/ROADMAP.md`.
  Como funciona por dentro: `docs/ARQUITETURA.md`.
- Tentativas anteriores de MMO não deram certo por excesso de escopo. Por isso: etapas pequenas, sempre jogáveis.

## Regras
1. **Toda etapa termina jogável.** Nada quebrado na `main`.
2. **Servidor autoritativo:** o cliente só envia intenções ("quero andar", "quero atirar"); o servidor decide
   dano, recargas e posições. Toda mensagem do cliente passa por `src/server/validate.ts`.
3. **Regras compartilhadas** (movimento, esquiva, mapa, combate/projéteis, progressão, protocolo, busca de
   caminho) ficam em `src/shared`, que não pode importar nada de navegador, Phaser ou Node.
4. **Conteúdo é dado:** mapas no Tiled (`public/assets/maps`), monstros em `data/monsters.json`, itens em
   `data/items.json` (chaves em português, para o dono do projeto ajustar). Evite conteúdo fixo no código.
   Arte provisória por código: tiles em `scripts/tileset.ts`, monstros em `src/client/game/monsterArt.ts`,
   ícones de itens em `src/client/itemArt.ts`, personagens (20x24) e o equipamento no corpo em
   `src/client/game/characters.ts` — equipamento com ícone novo precisa de desenho lá (o teste avisa).
   Mapas em camadas: `ground`, `sombras`, `decor` e `acima` (por cima dos personagens: copas e alto dos
   postes; nada que bloqueia vai nela). Árvores grandes e postes altos: `scripts/map-depth.ts`.
5. Antes de commitar: `npm run check` (tipos + testes) precisa passar. Regra nova no servidor vem com teste em `tests/`.
6. Mudou o formato das mensagens? Aumente `PROTOCOL_VERSION` em `src/shared/constants.ts`.
   Mudou o que fica salvo do personagem? Acrescente um passo em `MIGRATIONS` (`src/server/accounts.ts`) — nunca
   edite um passo antigo: os personagens de quem já joga são convertidos por eles.
7. Ao concluir algo do roteiro, marque em `docs/ROADMAP.md`.
8. Comentários e textos do jogo em português; nomes no código em inglês.
9. Não rode `npm run gen:map -- --force` (nem `gen:santo-amaro -- --force`) sem pedir: apaga edições feitas no Tiled. Para conferir, gere em outro
   arquivo com `--out` e compare as camadas antes de substituir.

## Personagens salvos
- Arquivo SQLite em `saves/meummo.db` (fora do Git; `MEUMMO_SAVE` troca o arquivo). Usa o `node:sqlite` embutido
  (Node 22.13+), sem dependência nativa — importante para o PC Windows do dono do projeto.
- Testes usam `':memory:'` e `FAST_HASH` (`tests/helpers.ts`); nunca o arquivo de verdade.
- Os bots são personagens salvos ("Bot ...", senha `bots-do-meummo`).

## Comandos
- `npm install` — instala dependências (Node 22.13+)
- `npm run dev` — servidor (porta 3000, reinicia sozinho) + jogo (Vite, porta 5173, abre em http://localhost:5173)
- `npm run check` — confere tipos e roda os testes
- `npm run build && npm start` — produção: um servidor só, na porta 3000. **Reinicie o `npm start` depois de cada
  build** (o servidor guarda a lista de arquivos ao ligar).
- `npm run bots -- 10` — bots passeando; `npm run bots -- 6 --cacar` — bots caçando monstros
- `npm run gen:tiles` — redesenha a arte provisória (`scripts/tileset.ts` → `public/assets/tiles.png`).
  Tiles novos sempre no fim da lista (os mapas guardam o número de cada tile).
- `npm run gen:map -- --out arquivo.tmj` — gera o mapa do Refúgio em outro arquivo (veja a regra 9)
- `npm run gen:santo-amaro -- --out arquivo.tmj` — idem para as Ruínas de Santo Amaro
- `npm run render:map` — desenha todos os mapas em `docs/mapa-<id>.png` (azul-claro = saídas)

## Instalação no PC do dono do projeto (Windows)
- O jogo fica em `E:\mmorpg`, instalado por `instalar-windows.ps1` (comando de uma linha no README).
- Atalhos na área de trabalho: `jogar.bat` (liga tudo e abre o navegador) e `atualizar.bat` (git pull + npm install).
- Scripts `.bat`/`.ps1` sem acentos (compatibilidade) e com CRLF (veja `.gitattributes`).
- Se mudar algo que exige passo extra na instalação, atualize o `instalar-windows.ps1` e o `atualizar.bat`.

## Conferir no navegador
Além dos testes: `npm run build && npm start`, ligue bots (`--cacar` para ver combate) e abra
http://localhost:3000 com o Playwright/Chromium, entre com nome e senha (`#name`, `#password`) e tire prints (computador e celular).
No navegador existe `window.__meummo` (só leitura + "andar até"): `__meummo.me`, `__meummo.entities()`,
`__meummo.walkTo(x, y)`, `__meummo.walking()`, `__meummo.screenOf(x, y)` — útil para testes automáticos.
