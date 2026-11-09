# Roteiro

Cada etapa termina com algo jogável. Só passamos para a próxima quando a atual estiver boa de jogar.

## ✅ M0 — Mundo vivo (concluído)
- [x] Servidor autoritativo, atualizando o mundo 20 vezes por segundo
- [x] Mapa feito no Tiled, lido do mesmo arquivo pelo jogo e pelo servidor
- [x] Andar em grade com teclado (WASD/setas) ou clicando/tocando no chão (busca de caminho A*)
- [x] Movimento sem atraso: o jogo prevê o passo e o servidor confirma ou corrige
- [x] Ver outros jogadores em tempo real, só quem está perto (área de visão)
- [x] Chat com balão de fala e proteção contra spam
- [x] Funciona no computador e no celular
- [x] Bots para testar e testes automáticos (regras, servidor e conexão de verdade)

## ⏭️ M1 — Combate (próximo)
- [ ] Monstros definidos em JSON, com áreas de nascimento marcadas no Tiled
- [ ] IA simples: passear, perseguir quem chega perto, desistir quando o jogador foge
- [ ] Atacar (clicar no monstro ou tecla), vida, dano, morte e renascimento na vila
- [ ] XP e nível, com barras de vida e XP na tela
- [ ] Números de dano subindo na tela
- [ ] Testes de combate no servidor

## M2 — Progresso salvo
- [ ] Conta com senha e personagem salvo em banco de dados (SQLite no começo)
- [ ] Monstros deixam itens; inventário; equipamento que muda os atributos

## M3 — Mundo
- [ ] Vários mapas ligados (portas e saídas)
- [ ] NPCs com diálogo, missões simples, loja e ouro

## M4 — Social
- [ ] Grupo com XP dividido, guilda, troca entre jogadores e mensagem privada

## M5 — Teste fechado
- [ ] Servidor na internet (VPS), domínio e HTTPS
- [ ] Ferramentas de admin (expulsar, banir, avisos) e registros
- [ ] 20 a 50 pessoas jogando juntas

## Ideias para depois (só se o básico estiver divertido)
Classes e habilidades, crafting, PvP em áreas específicas, chefões, eventos, montarias, casas de jogadores.

## Decisões pendentes
- **Nome do jogo** ("MeuMMO" é provisório)
- **Tema e diferencial:** o que faz alguém escolher o nosso jogo e não outro?
- **Arte definitiva:** hoje é arte provisória desenhada por código
