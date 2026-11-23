// As habilidades da classe na barra de ações: o nível de cada uma (bolinhas: as acesas são os pontos) e o "+" quando dá
// para pôr um ponto nela — um toque no "+" põe o ponto, sem usar a habilidade (pedido do dono, 23/11: "o upar da
// habilidade aparecer aqui embaixo como se fosse um + e o level de cada habilidade upável mostrando nesse menu").
//
// A barra é da [arte] (ui.ts); daqui só entram, por cima dos quadrados dela, os atributos `data-rank`, `data-max` e
// `data-learn` e dois elementos: `.skill-rank` (as bolinhas, um `<i>` por ponto; `.on` = tem) e `.skill-plus` (o "+").
// O estilo abaixo é provisório (funciona já): a [arte] veste no style.css e apaga este.

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

const STYLE_ID = 'skill-bar-provisorio';

/** O estilo provisório das bolinhas e do "+" (uma vez por página). */
function installStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#actions .action .skill-rank { position: absolute; top: calc(5px * var(--as, 1)); left: 50%; transform: translateX(-50%);
  display: flex; gap: calc(3px * var(--as, 1)); pointer-events: none; z-index: 3; }
#actions .action .skill-rank i { width: calc(8px * var(--as, 1)); height: calc(8px * var(--as, 1)); border-radius: 50%;
  background: rgba(10, 6, 2, 0.75); border: 1px solid rgba(255, 220, 140, 0.55); }
#actions .action .skill-rank i.on { background: #ffd76a; border-color: #fff3c4; box-shadow: 0 0 5px #ffd76a; }
#actions .action .skill-plus { position: absolute; top: calc(-10px * var(--as, 1)); right: calc(-10px * var(--as, 1));
  width: calc(32px * var(--as, 1)); height: calc(32px * var(--as, 1)); min-width: 22px; min-height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 35% 30%, #7be26b, #1f7a2c);
  border: 2px solid #e9ffc9; box-shadow: 0 0 10px #9cff6a; color: #fff; font: 800 calc(24px * var(--as, 1))/1 sans-serif;
  text-shadow: 0 1px 2px #0b3d12; cursor: pointer; z-index: 4; pointer-events: auto; touch-action: none;
  animation: skill-plus-pulse 1.1s ease-in-out infinite; }
#actions .action .skill-plus[hidden] { display: none; }
#actions .action[data-rank='0'] .icon { filter: grayscale(1) brightness(0.55); }
@keyframes skill-plus-pulse { 50% { transform: scale(1.14); box-shadow: 0 0 16px #b9ff8a; } }
`;
  document.head.append(style);
}

/**
 * Põe (ou atualiza) o nível e o "+" nos quadrados das habilidades. `onLearn(id)`: o "+" foi tocado. Os quadrados que a
 * barra refez nascem sem nada: chame de novo depois de refazer a barra.
 */
export function decorateSkillSlots(infos: readonly SkillSlotInfo[], onLearn: (id: string) => void): void {
  installStyle();
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
