// O alto firme do desenho dos bichos (prototipos/pindorama-25d/js/creatures/creature.js, da [arte], 26/11): a barra de
// vida vai logo acima de cada bicho (o dono: "SIM" para os pequenos também) e não pode balançar com o passo nem com o
// bote. O alto de verdade (`overHead`, onde fica o nome) segue a cabeça (o desenho conta a cada quadro); o firme
// (`barTop`) sobe na hora junto com ele, fica lá em cima um pouco e desce devagar. A view passa ao motor o maior dos
// dois (`actorTop`, em metros): a barra nunca fica abaixo do nome.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Creature = {
  top: number;
  barTop: number;
  groundZ: number;
  update: (dt: number, near: null) => void;
  moveTo: (x: number, y: number, yaw: number, ms: number, dash?: boolean) => void;
  action: (kind: string, yaw?: number) => void;
  overHead: () => { z: number };
  parts?: (cam: unknown) => unknown;
};

/** Um caminho de mentira (o Path2D do navegador): aceita qualquer traço. */
class FakePath {
  constructor() {
    return new Proxy(this, { get: (target, prop) => (prop in target ? (target as Record<string | symbol, unknown>)[prop] : () => undefined) });
  }
}

function loadPD(): { creature: (type: string) => Creature; Base: new (x: number, y: number, yaw: number) => Creature; cam: unknown } {
  const sandbox: { window: { PD?: Record<string, unknown> }; Path2D: typeof FakePath } = { window: {}, Path2D: FakePath };
  for (const file of ['core/math.js', 'core/iso.js', 'core/shapes.js', 'creatures/creature.js', 'creatures/sagui.js', 'creatures/jararaca.js']) {
    runInNewContext(readFileSync(new URL(`../prototipos/pindorama-25d/js/${file}`, import.meta.url), 'utf8'), sandbox);
  }
  const PD = sandbox.window.PD as Record<string, unknown>;
  const C = PD.creatures as {
    Creature: new (x: number, y: number, yaw: number) => Creature;
    create: (type: string, x: number, y: number, yaw: number) => Creature;
  };
  const cam = new (PD.IsoCamera as new () => { zoom: number })();
  cam.zoom = 1;
  return { creature: (type) => C.create(type, 0, 0, 0), Base: C.Creature, cam };
}

/** O que a view passa ao motor (`actorTop`, aqui em cm): o firme, ou o alto deste quadro se passou dele. */
function barTop(c: Creature): number {
  return Math.max(c.barTop, c.overHead().z - c.groundZ);
}

describe('o alto firme dos bichos (a barra de vida acima de cada um)', () => {
  const { creature, Base, cam } = loadPD();
  /** Um quadro do jogo: o update e o desenho (que conta o alto da cabeça). */
  const frames = (c: Creature, secs: number, each?: () => void) => {
    for (let s = 0; s < secs - 1e-9; s += 1 / 60) {
      c.update(1 / 60, null);
      c.parts?.(cam);
      each?.();
    }
  };

  it('sobe na hora com o desenho, fica lá em cima um pouco e desce devagar até o alto de agora', () => {
    const c = new Base(0, 0, 0);
    let top = 50;
    (c as unknown as { animate: () => void }).animate = () => {
      c.top = top;
    };
    frames(c, 0.2);
    expect(c.barTop).toBeCloseTo(50);
    top = 80; // o bote: a cabeça sobe
    frames(c, 1 / 60);
    expect(c.barTop).toBeCloseTo(80); // na hora (a barra não fica abaixo do nome)
    top = 50;
    frames(c, 1);
    expect(c.barTop).toBeCloseTo(80); // ainda lá em cima (fica um pouco)
    frames(c, 0.6);
    expect(c.barTop).toBeLessThan(80);
    expect(c.barTop).toBeGreaterThan(50); // descendo devagar
    frames(c, 1.5);
    expect(c.barTop).toBeCloseTo(50);
  });

  it('o sagui andando: o nome balança com o passo, a barra fica parada e sempre acima dele', () => {
    const s = creature('sagui');
    frames(s, 0.5);
    const names: number[] = [];
    const bars: number[] = [];
    for (let k = 1; k <= 16; k++) {
      s.moveTo(k * 40, 0, 0, 320);
      frames(s, 0.32, () => {
        names.push(s.overHead().z - s.groundZ);
        bars.push(barTop(s));
      });
    }
    // (do segundo 2,4 em diante: parado, sentado, o sagui é mais alto; a barra desce devagar até o alto de quem corre)
    const spread = (v: number[]) => Math.max(...v.slice(144)) - Math.min(...v.slice(144));
    expect(spread(names)).toBeGreaterThan(1); // o alto de verdade mexe (a cabeça no passo)
    expect(spread(bars)).toBeLessThan(spread(names) / 3); // o firme quase não
    for (let i = 0; i < names.length; i++) expect(bars[i]! + 1e-6).toBeGreaterThanOrEqual(names[i]!);
  });

  it('a jararaca no bote: a barra sobe junto com a cabeça e nunca fica abaixo dela', () => {
    const j = creature('jararaca');
    frames(j, 0.5);
    const before = barTop(j);
    j.action('windup', 0);
    let highest = before;
    frames(j, 1.2, () => {
      expect(barTop(j) + 1e-6).toBeGreaterThanOrEqual(j.overHead().z - j.groundZ);
      highest = Math.max(highest, barTop(j));
    });
    expect(highest).toBeGreaterThanOrEqual(before);
  });
});
