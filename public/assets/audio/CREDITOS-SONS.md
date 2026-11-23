# Sons gravados do jogo (licença livre)

Todos em domínio público (CC0 1.0): dá para usar no jogo, inclusive comercialmente, sem pedir nem pagar. O crédito não é
obrigatório, mas fica aqui por gentileza (e para saber de onde veio cada um). Escolhidos pelo dono em 23/11, a partir de
prévias (ele mandou de referência sons tirados do YouTube e do Minecraft, que não dá para pôr no jogo; estes são os de
licença livre mais parecidos com eles). Os sons feitos por código continuam em `src/client/sfx.ts` e `ambient.ts`.

| Arquivo | Onde toca | O que é | Autor | Licença | De onde veio |
|---|---|---|---|---|---|
| `ambiente/floresta-dia.mp3` | a mata de dia (por baixo dos nossos bem-te-vis e sabiás) | mistura de três: Ambient Bird Sounds (os pássaros), cricket sounds (os insetos) e Forest Birds, "Forest 3" (o vento da mata) | isaiah658; syncopika; pauliuw | CC0 | https://opengameart.org/content/ambient-bird-sounds · https://opengameart.org/content/cricket-sounds · https://opengameart.org/content/forest-bird-sounds |
| `ambiente/floresta-noite.mp3` | a mata de tarde e de noite | Swamp Environment Audio (pântano: sapos e insetos), os primeiros 48 s | LokiF | CC0 | https://opengameart.org/content/swamp-environment-audio |
| `efeitos/arco-soltar.mp3` | a corda do arco soltando | Battle Sound Effects, "Bow" | Ogrebane | CC0 (o pacote tem várias licenças; usamos a CC0) | https://opengameart.org/content/battle-sound-effects |
| `efeitos/flecha-vibra-1.mp3`, `-2` | a sua flecha cravando numa árvore | Wood Wobbling & Rattling | qubodup | CC0 | https://opengameart.org/content/wood-wobbling-rattling |
| `efeitos/passo-terra-1.mp3` a `-3` | passos na grama, na trilha, na terra | Footsteps (01, 03 e 05) | GboxMikeFozzy | CC0 | https://opengameart.org/content/footsteps-0 |
| `efeitos/passo-pedra-1.mp3` a `-6` | passos na calçada, no asfalto, no piso, na faixa, na escada e no entulho (e no píer) | Fantozzi's Footsteps, Stone L1–L3 e R1–R3 | qubodup (Fantozzi) | CC0 | https://opengameart.org/content/fantozzis-footsteps-grasssand-stone |
| `efeitos/passo-areia-1.mp3` a `-6` | passos na lama e nas poças | Fantozzi's Footsteps, Sand L1–L3 e R1–R3 | qubodup (Fantozzi) | CC0 | https://opengameart.org/content/fantozzis-footsteps-grasssand-stone |

**Como foram preparados** (com o ffmpeg e um script curto): mono, 44,1 kHz, MP3. A floresta virou loop sem emenda (o fim
entra no começo numa troca suave de 2,5 a 3 s) e ficou com o mesmo volume médio (-28 dB RMS); os sons curtos foram
cortados no começo (sem silêncio), os passos em 0,22 s com o fim suave (para não emendar um no outro correndo) e todos
com o pico igual.

Para trocar um som, ponha o arquivo novo aqui com o mesmo nome (ou mude a lista `SAMPLE_FILES` em
`src/client/sfx.ts`) e anote a licença nesta tabela. Só sons de licença livre (CC0 ou parecida, que permita usar em
jogo): som tirado do YouTube ou de outro jogo, não.
