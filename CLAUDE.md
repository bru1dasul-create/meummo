# MeuMMO — instruções do projeto

## Contexto
- MMORPG de **ação** 2D (visão de cima; jogadores andam soltos, monstros andam de tile em tile) que roda no navegador
  (PC e celular). O visual está mudando para o 2.5D isométrico do protótipo (`prototipos/pindorama-25d/`).
- Time: o dono do projeto (ideias, design, testes) + Claude (código). Converse em **português do Brasil**,
  com explicações simples — nem toda decisão técnica precisa de jargão.
- Tema: **fantasia com folclore brasileiro** (Saci, Curupira, Iara...). Combate de ação: mira, atira, desvia;
  monstros avisam golpes no chão. O nome "MeuMMO" é provisório.
- Mundo (aprovado): **Pindorama — Selva de Pedra**, São Paulo tomada pela floresta. Tom: "um pouco dos dois" —
  colorido e vivo nas vilas, sombrio nas ruínas; sem violência explícita (quem perde a vida desmaia).
  Zonas: **Refúgio de Guarapiranga** (`public/assets/maps/refugio.tmj`, inicial), **Ruínas de Santo Amaro**
  (`santo-amaro.tmj`, níveis 4 a 8, chefe: Mula sem Cabeça), pela avenida a leste, e **Represa Billings**
  (`billings.tmj`, labirinto de canais; a Iara vai morar lá), pela trilha do brejo ao sul (camada `saidas`).
  De Santo Amaro, pela rua do meio ao sul: **Terminal Santo Amaro** (`terminal-santo-amaro.tmj`, plataformas A a D);
  pela porta de vidro do prédio a oeste do largo: **Shopping do Largo Treze** (`shopping-largo-treze.tmj`, mapa de dentro).
  Lugares reais sim, **marcas não**.
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
   `data/items.json`, vendedores e outros NPCs em `data/npcs.json`, missões em `data/missoes.json` (chaves em
   português, para o dono do projeto ajustar). Evite conteúdo fixo no código.
   Arte provisória por código: tiles em `scripts/tileset.ts`, monstros em `src/client/game/monsterArt.ts`
   (os novos, pintados como os personagens e com animação de golpe, em `monsterPaint.ts`),
   ícones de itens em `src/client/itemArt.ts`, ícones das habilidades em `src/client/actionArt.ts`, moeda em
   `src/client/coinArt.ts`, personagens em camadas em `src/client/game/doll/` (+ `characters.ts`, aparência de
   NPC em `NPC_LOOKS`) e o equipamento no corpo em `src/client/game/gearArt.ts` — equipamento com ícone novo
   precisa de um visual lá com o mesmo nome (o teste avisa). Confira com `npm run render:characters`.
   Mapas em camadas: `ground`, `sombras`, `decor` e `acima` (por cima dos personagens: copas e alto dos
   postes; nada que bloqueia vai nela). Árvores grandes e postes altos: `scripts/map-depth.ts`.
5. Antes de commitar: `npm run check` (tipos + testes) precisa passar. Regra nova no servidor vem com teste em `tests/`.
6. Mudou o formato das mensagens? Aumente `PROTOCOL_VERSION` em `src/shared/constants.ts`.
   Mudou o que fica salvo do personagem? Acrescente um passo em `MIGRATIONS` (`src/server/accounts.ts`) — nunca
   edite um passo antigo: os personagens de quem já joga são convertidos por eles.
7. Ao concluir algo do roteiro, marque em `docs/ROADMAP.md`.
8. Comentários e textos do jogo em português; nomes no código em inglês.
9. Não rode `npm run gen:map -- --force` (nem `gen:santo-amaro`, `gen:billings`, `gen:terminal`, `gen:shopping`, `gen:capao` ou `gen:guarapiranga` com `--force`) sem pedir: apaga edições feitas no Tiled. Para conferir, gere em outro
   arquivo com `--out` e compare as camadas antes de substituir.

## Divisão do trabalho (3 chats)
Três chats trabalham ao mesmo tempo, cada um numa **frente**. **Cada chat só mexe nos arquivos da sua frente.**
Precisa de algo de outra? Não faça: termine a resposta com `PEDIDO PARA [frente]: ...` e o dono do projeto repassa.
No roteiro (`docs/ROADMAP.md`) cada tarefa tem a etiqueta da frente: pegue só as suas.
Para retomar depois de limpar a conversa (`/clear`), cada chat lê este arquivo, o roteiro e o seu caderno (combinados
com o dono, onde estamos e próximos passos): `docs/ESTRUTURA.md` da [estrutura], `docs/ARTE.md` da [arte] e
`docs/MUNDO.md` do [mundo]. Antes de limpar, o chat atualiza o caderno e junta na `main`.

| Frente | Chat (hoje) | É dela |
|---|---|---|
| **[estrutura]** Estrutura e regras | "Estrutura e regras" | servidor (`src/server`), regras compartilhadas (`src/shared`: protocolo, `PROTOCOL_VERSION`, mapa, combate, progressão), dados (`data/*.json`), salvamento (`MIGRATIONS`), `tests/helpers.ts` e testes do servidor, `scripts/bots.ts`, `src/client/net.ts`, `src/client/game/input.ts` |
| **[arte]** Arte e interface | "Arte e visual" | personagens (`characters.ts`), monstros (`monsterArt.ts`), ícones (`itemArt.ts`, `actionArt.ts`), efeitos (`effects.ts`), desenho das entidades (`EntityView.ts`), telas (`style.css`, `index.html`, `ui.ts`, `bag.ts`), sons (`sfx.ts`) |
| **[mundo]** Mundo e mapas | "Criar jogo MMO RPG do zero" | mapas (`public/assets/maps/*.tmj`), tiles (`scripts/tileset.ts`, `public/assets/tiles.png`), `scripts/gen-*.ts`, `map-builder.ts`, `map-depth.ts`, `render-map.ts`, `src/client/game/mapDepth.ts`, `docs/mapa-*.png`, `docs/MUNDO.md` (caderno) |

- **De todos** (só mudança pequena, e junta na `main` no mesmo dia): `WorldScene.ts`, `main.ts`, `CLAUDE.md`,
  `docs/*.md`, `README.md`. Dependência nova no `package.json` só com o dono de acordo (pesa na instalação do Windows).
- **Só a [estrutura]** muda protocolo, `PROTOCOL_VERSION`, `MIGRATIONS` e servidor — dois ramos mexendo nisso ao
  mesmo tempo podem estragar personagens salvos. **Só o [mundo]** cria tiles e mexe nos `.tmj` (o mapa é uma linha
  só no arquivo: duas mudanças ao mesmo tempo não se juntam; tile novo em dois ramos ganha o mesmo número).
- **Conteúdo que passa pelas três frentes** (ex.: uma lenda nova): a [estrutura] define a chave (ex.: `iara`), o
  comportamento e os dados; a [arte] desenha com a mesma chave; o [mundo] marca a área no mapa. Cada um no seu arquivo.
- A [estrutura] entrega sistemas funcionando com visual simples (ex.: a janela da loja); a [arte] deixa bonito depois.
- Cada frente testa o próprio código em `tests/`.

### Como entregar (todas as frentes)
1. **Uma tarefa por vez**, começando da `main` mais nova. Atualize com a `main` antes de começar e antes de entregar.
2. **Entrega pequena e jogável:** `npm run check` passando e conferida no navegador (PC e celular).
3. **Junte na `main` no mesmo dia**, com o dono de acordo. Ramo parado longe da `main` vira conflito e retrabalho.
4. Marque a tarefa no roteiro e avise o dono: o que mudou, como testar e se outra frente precisa fazer algo.

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
- `npm run gen:billings -- --out arquivo.tmj` — idem para a Represa Billings
- `npm run gen:terminal -- --out arquivo.tmj` — idem para o Terminal Santo Amaro
- `npm run gen:shopping -- --out arquivo.tmj` — idem para o Shopping do Largo Treze
- `npm run gen:capao -- --out arquivo.tmj` — Mapa 01 do mundo novo (2.5D), em `public/assets/maps-iso/` (formato novo)
- `npm run gen:guarapiranga -- --out arquivo.tmj` — Mapa 02 do mundo novo (a Represa de Guarapiranga, com o Refúgio)
- `npm run render:map` — desenha todos os mapas em `docs/mapa-<id>.png` (azul-claro = saídas)
- `npm run render:characters` — prancha de personagens (animações, equipamentos, Dona Iracema) e dos monstros pintados em `docs/personagens.png`
  (`-- --escala 6 --so Beto` para ver um de perto, `-- --tudo` para todos os quadros)

## Instalação no PC do dono do projeto (Windows)
- O jogo fica em `E:\mmorpg`, instalado por `instalar-windows.ps1` (comando de uma linha no README).
- Atalhos na área de trabalho: `jogar.bat` (liga tudo e abre o navegador) e `atualizar.bat` (git pull + npm install).
- Scripts `.bat`/`.ps1` sem acentos (compatibilidade) e com CRLF (veja `.gitattributes`).
- Se mudar algo que exige passo extra na instalação, atualize o `instalar-windows.ps1` e o `atualizar.bat`.

## Painel do administrador
- http://localhost:3000/admin, só no computador do servidor (travas em `src/server/admin.ts`). Ajusta monstros,
  itens e loja na hora; os ajustes ficam em `saves/ajustes.json` (fora do Git) por cima de `data/*.json`.
- Campo novo no painel: acrescente na lista de `src/server/tuning.ts` (e ele já é conferido pelo leitor do arquivo).
- Testes usam `tuningFile: null` (ajustes só na memória) quando o servidor sobe com `':memory:'`.

## Conferir no navegador
Além dos testes: `npm run build && npm start`, ligue bots (`--cacar` para ver combate) e abra
http://localhost:3000 com o Playwright/Chromium, entre com nome e senha (`#name`, `#password`) e tire prints (computador e celular).
O jogo 2.5D novo é o que abre em http://localhost:3000 (`window.__mundoNovo`: `me`, `walkTo(x, y)` em metros, `walking()`,
`safe()`, `entities()` (com a vida e o pé: `feetX`, `feetY`), `hp()`, `dead()`, `zoom()`, `marks()` (! e ? dos NPCs), `screenOf(x, y)` — do pé, em metros); `?provisorio` mostra as caixas de colisão no lugar do desenho. O jogo antigo
(visto de cima) fica em `?antigo` e tem `window.__meummo` (só leitura + "andar até"): `__meummo.me`, `__meummo.entities()`,
`__meummo.walkTo(x, y)`, `__meummo.walking()`, `__meummo.screenOf(x, y)`, `__meummo.drops()` (ouro e itens no chão),
`__meummo.charmed()` (encantado pelo canto) — útil para testes automáticos. Para testar com ouro, itens ou em outro
mapa sem caçar, use o painel do administrador (`/admin/api/jogador`) no servidor de teste.
