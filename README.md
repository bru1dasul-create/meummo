# MeuMMO

MMORPG 2D de fantasia que roda no navegador, feito em dupla: ideias, design e testes de um lado,
código do Claude do outro. O nome é provisório.

![Jogadores na praça da vila](docs/screenshot.png)

## Onde estamos: M0 — Mundo vivo ✅

- Entrar com um nome e aparecer na vila
- Andar com **WASD / setas** ou **clicando/tocando no chão** (o personagem acha o caminho sozinho)
- Ver os outros jogadores andando em tempo real, com nome e balão de fala
- Chat (aperte **Enter** para falar)
- Funciona no computador e no celular

O que vem depois está em [docs/ROADMAP.md](docs/ROADMAP.md). Próxima etapa: **M1 — Combate**.

## Como jogar no seu computador

Precisa do [Node.js](https://nodejs.org) versão 22 ou mais nova. No terminal, dentro da pasta do projeto:

```bash
npm install
```

```bash
npm run dev
```

Abra **http://localhost:5173**. Para jogar com alguém na mesma rede Wi-Fi (inclusive pelo celular),
use o endereço que aparece como `Network` no terminal, por exemplo `http://192.168.0.10:5173`.

Quer ver o mundo com gente andando? Com o jogo rodando, abra outro terminal:

```bash
npm run bots -- 10
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | jogo + servidor em modo de desenvolvimento (recarregam sozinhos ao salvar) |
| `npm run check` | confere os tipos e roda todos os testes automáticos |
| `npm run build` e depois `npm start` | versão de produção: um único servidor na porta 3000 |
| `npm run bots -- 10` | 10 jogadores automáticos andando e conversando |
| `npm run gen:tiles` | redesenha a arte provisória (`public/assets/tiles.png`) |
| `npm run render:map` | desenha o mapa inteiro em `docs/mapa.png` |

## Editar o mapa

O mapa é feito no [Tiled](https://www.mapeditor.org/), um editor gratuito. Abra `public/assets/maps/world.tmj`:

- camada `ground`: o chão; camada `decor`: árvores, casas, flores…
- tiles com a propriedade `collides` bloqueiam a passagem (água, árvores, paredes)
- o ponto `spawn`, na camada `objects`, é onde os jogadores nascem

Depois de salvar, reinicie o servidor e recarregue o jogo.

![Mapa da vila inicial](docs/mapa.png)

## Organização

| Pasta | O que tem |
|---|---|
| `src/shared` | regras usadas pelo jogo e pelo servidor (movimento, mapa, mensagens) |
| `src/server` | o servidor (Node.js + WebSocket): quem manda no mundo |
| `src/client` | o jogo no navegador (Phaser) |
| `public/assets` | arte e mapas |
| `scripts` | gerador de arte, gerador de mapa e bots |
| `tests` | testes automáticos |
| `docs` | roteiro e explicação de como tudo funciona ([ARQUITETURA.md](docs/ARQUITETURA.md)) |
