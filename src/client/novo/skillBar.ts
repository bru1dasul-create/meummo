// As habilidades da classe na barra de ações: o nível de cada uma (bolinhas: as acesas são os pontos) e o "+" quando dá
// para pôr um ponto nela — um toque no "+" põe o ponto, sem usar a habilidade (pedido do dono, 23/11: "o upar da
// habilidade aparecer aqui embaixo como se fosse um + e o level de cada habilidade upável mostrando nesse menu").
//
// A barra é da [arte] (ui.ts); daqui só entram, por cima dos quadrados dela, os atributos `data-rank`, `data-max` e
// `data-learn` e dois elementos: `.skill-rank` (as bolinhas, um `<i>` por ponto; `.on` = tem) e `.skill-plus` (o "+").
// O estilo fica no style.css (a [arte] vestiu em 23/11: "o nível e o "+" das habilidades da classe").

import type { ActionSlot } from '../ui';

/** O que o quadrado de uma habilidade mostra. */
export interface SkillSlotInfo {
  slot: ActionSlot;
  /** O id da habilidade (o "+" manda o `learn` com ele). */
  id: string;
  name: string;
  /** Pontos que ela tem e o máximo. */
  rank: number;
  max: number;
  /** Dá para pôr um ponto agora (o nível chegou e sobra ponto)? */
  canLearn: boolean;
}

/**
 * Põe (ou atualiza) o nível e o "+" nos quadrados das habilidades. `onLearn(id)`: o "+" foi tocado. Os quadrados que a
 * barra refez nascem sem nada: chame de novo depois de refazer a barra.
 */
export function decorateSkillSlots(infos: readonly SkillSlotInfo[], onLearn: (id: string) => void): void {
  for (const info of infos) {
    const el = document.querySelector<HTMLElement>(`#actions .action[data-slot="${info.slot}"]`);
    if (!el) continue;
    el.dataset.skill = info.id;
    el.dataset.rank = String(info.rank);
    el.dataset.max = String(info.max);
    if (info.canLearn) el.dataset.learn = '1';
    else delete el.dataset.learn;
    let pips = el.querySelector<HTMLElement>('.skill-rank');
    if (!pips) {
      pips = document.createElement('span');
      pips.className = 'skill-rank';
      el.append(pips);
    }
    pips.replaceChildren(
      ...Array.from({ length: info.max }, (_, k) => {
        const dot = document.createElement('i');
        if (k < info.rank) dot.className = 'on';
        return dot;
      }),
    );
    let plus = el.querySelector<HTMLElement>('.skill-plus');
    if (!plus) {
      plus = document.createElement('span');
      plus.className = 'skill-plus';
      plus.textContent = '+';
      plus.setAttribute('role', 'button');
      // o toque no "+" não chega no quadrado (que usaria a habilidade): só põe o ponto
      const stop = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      plus.addEventListener('pointerdown', (event) => {
        stop(event);
        const id = el.dataset.skill;
        if (id && el.dataset.learn) onLearn(id);
      });
      plus.addEventListener('pointerup', stop);
      plus.addEventListener('contextmenu', stop);
      el.append(plus);
    }
    plus.title = `Pôr um ponto em ${info.name} (${info.rank} de ${info.max})`;
    plus.hidden = !info.canLearn;
  }
}
