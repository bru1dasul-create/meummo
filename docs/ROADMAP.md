# Roteiro

Cada etapa termina com algo jogável. Só passamos para a próxima quando a atual estiver boa de jogar.
A visão do jogo está em [DESIGN.md](DESIGN.md).

## ✅ M0 — Mundo vivo
- [x] Servidor autoritativo, atualizando o mundo 20 vezes por segundo
- [x] Mapa feito no Tiled, lido do mesmo arquivo pelo jogo e pelo servidor
- [x] Andar em grade com teclado (WASD/setas) ou clicando/tocando no chão (busca de caminho A*)
- [x] Movimento sem atraso: o jogo prevê o passo e o servidor confirma ou corrige
- [x] Ver outros jogadores em tempo real, só quem está perto (área de visão)
- [x] Chat com balão de fala e proteção contra spam
- [x] Funciona no computador e no celular
- [x] Bots para testar e testes automáticos

## ✅ M1 — Combate de ação (folclore brasileiro)
- [x] Tema decidido: fantasia com folclore brasileiro (ver DESIGN.md)
- [x] Monstros definidos em `data/monsters.json`, com áreas de nascimento desenhadas no Tiled (camada `monstros`)
- [x] Sagui Travesso (joga frutas e mantém distância), Jararaca (bote com aviso) e Saci (mini-chefe com giro e redemoinho)
- [x] IA: passear, perceber o jogador, perseguir, desistir e voltar para casa se curando
- [x] Estilingue com mira (mouse ou automática no celular); projéteis param em árvores e paredes
- [x] Golpes dos monstros avisados no chão (quadrados vermelhos) — dá para desviar
- [x] Esquiva com invencibilidade, Bordunada (arco) e Fôlego (cura), com recargas visíveis
- [x] Vida, dano, XP e nível; desmaio e volta para a vila; vida que volta sozinha
- [x] Números de dano, barras de vida, painel com vida/XP/nível, botões grandes no celular
- [x] Testes automáticos de combate e teste no navegador (PC e celular); bots caçadores (`npm run bots -- 6 --cacar`)

## 🔧 Refinamento do M1 (para jogar e ajustar juntos)
Tudo isto se ajusta mexendo em números, sem programar:
- [ ] A velocidade do personagem e dos monstros está boa? (`STEP_MS` em `src/shared/constants.ts`; `passoMs` em `data/monsters.json`)
- [ ] Os avisos dão tempo de desviar? (`preparoMs` de cada monstro)
- [ ] O dano e a vida estão justos? (`vida`, `dano` nos monstros; `src/shared/progression.ts` para o jogador)
- [ ] Subir de nível está rápido ou devagar demais? (`xp` dos monstros e `xpToNext`)
- [ ] O Saci está forte demais para quem é nível 1? (ele é para nível 3+ ou para grupo)
- [x] Sons sintetizados (estilingue, acerto, aviso embaixo de você, esquiva, nível, desmaio) — tecla M desliga
- [ ] Música da vila e sons de verdade (gravados ou de banco gratuito)
- [ ] Arte de verdade para personagens e monstros

## ⏭️ M2 — Progresso salvo
- [ ] Conta com senha e personagem salvo em banco de dados (SQLite no começo)
- [ ] Monstros deixam itens; inventário; equipamento que muda os atributos

## M3 — Mundo
- [ ] Vários mapas ligados (portas e saídas)
- [ ] NPCs com diálogo (o Curupira!), missões simples, loja e ouro
- [ ] Novas lendas: Iara no lago, Boitatá como chefe

## M4 — Social
- [ ] Grupo com XP dividido, guilda, troca entre jogadores e mensagem privada

## M5 — Teste fechado
- [ ] Servidor na internet (VPS), domínio e HTTPS
- [ ] Ferramentas de admin (expulsar, banir, avisos) e registros
- [ ] 20 a 50 pessoas jogando juntas

## Ideias para depois (só se o básico estiver divertido)
Caminhos (Capoeirista, Curandeiro, Caçador), crafting, PvP em áreas específicas, chefões, eventos,
noite e dia (lendas da noite), montarias, casas de jogadores.

## Decisões pendentes
- **Nome do jogo** ("MeuMMO" é provisório) — sugestões em DESIGN.md
- **Arte definitiva:** hoje é arte provisória desenhada por código
