// Capivara que anda (bicho do ambiente, como o Joaquim; lote 2 da lista do dono, 14/11). O desenho é o da capivara do
// cenário (props.js, `_capybara`: corpo de barril, cabeça quadradona mais baixa na frente, focinho escuro, orelhinhas e
// perninhas curtas), agora em bolas que se mexem:
//   - andando: as patas em diagonal (a da frente de um lado com a de trás do outro), o corpo sobe e desce, a cabeça
//     acompanha; depressa ('dash' ou correndo), a passada abre;
//   - parada: pasta (a cabeça desce até o chão e mastiga) e de vez em quando levanta a cabeça e olha em volta;
//   - descansando: deita ('sleep' ou 'deitar'; 'wake' ou 'levantar' põe de pé, e andar também levanta).
// Do servidor vêm a casa, o lado e as ações (a [estrutura]: o grupo `capivaras-<lugar>` em data/bichos.json, como o
// Joaquim). Tudo em centímetros, como o protótipo.
//   PD.creatures.create('capivara', xCm, yCm, yaw)
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  if (!C) return;
  const { tube } = C;

  // as cores da capivara do cenário (props.js, CAPY): o pelo, a cabeça um tom mais escura, as patas e as orelhas
  const COL = {
    fur: { base: '#8a6a45', shade: '#68502f', light: '#a8865b' },
    head: { base: '#6e5334', shade: '#54401f', light: '#88693f' },
    leg: { base: '#5c4530', shade: '#3b2c1c', light: '#7a5f43' },
    ear: { base: '#4a3626', shade: '#3b2c1c', light: '#62492f' },
  };
  const NOSE = '#3a2a1c';
  const EYE = '#120c08';

  class Capivara extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 40;
      this.top = 64;
      /** De pé (0) a deitada (1), e para onde está indo. */
      this.lie = 0;
      this.lieTarget = 0;
      /** Cabeça alta (0) a pastando (1). */
      this.graze = 0;
      /** Segundos parada (para começar a pastar). */
      this.still = 0;
      /** Parada (0) a andando (1), e correndo (0 a 1). */
      this.walk = 0;
      this.run = 0;
      this.acts = { sleep: { dur: 0.8 }, wake: { dur: 0.8 }, eat: { dur: 6 }, dash: { dur: 0.5 } };
    }

    /** Aparece já deitada, descansando (como o Joaquim dormindo: `addActor` com `asleep`). */
    setAsleep(v) {
      this.lieTarget = v ? 1 : 0;
      this.lie = this.lieTarget;
    }

    action(kind, yaw) {
      if (kind === 'sleep' || kind === 'deitar') this.lieTarget = 1;
      else if (kind === 'wake' || kind === 'levantar') this.lieTarget = 0;
      super.action(kind === 'deitar' ? 'sleep' : kind === 'levantar' ? 'wake' : kind === 'pastar' ? 'eat' : kind, yaw);
    }

    animate(dt) {
      this.walk = M.smoothstep(4, 40, this.speed);
      this.run = Math.max(M.smoothstep(90, 220, this.speed), this.act && this.act.kind === 'dash' ? 1 : 0);
      this.still = this.walk > 0.1 ? 0 : this.still + dt;
      if (this.walk > 0.3) this.lieTarget = 0; // andando, levanta
      this.lie = M.damp(this.lie, this.lieTarget, 2.6, dt);
      // parada um pouco, pasta (e às vezes levanta a cabeça para olhar em volta); a ação 'eat' faz pastar na hora
      const eating = !!(this.act && this.act.kind === 'eat');
      const wantGraze = this.lie < 0.5 && this.walk < 0.2 && (eating || (this.still > 1.2 && M.noise1(this.time * 0.11 + this.seed * 30) > 0.4));
      this.graze = M.damp(this.graze, wantGraze ? 1 : 0, wantGraze ? 2.2 : 4.5, dt);
      // a passada: uns 64 cm por ciclo (correndo, mais comprida)
      this.phase = (this.phase + (this.speed * dt) / (64 + 40 * this.run)) % 1;
      this.label = this.lie > 0.5 ? 'deitada' : this.run > 0.5 ? 'correndo' : this.walk > 0.5 ? 'andando' : this.graze > 0.5 ? 'pastando' : 'parada';
    }

    /** As bolas do corpo nesta pose. */
    parts() {
      const t = this.time;
      const walk = this.walk;
      const run = this.run;
      const lie = M.smoothstep(0, 1, this.lie);
      const graze = M.smoothstep(0, 1, this.graze) * (1 - lie);
      const ph = this.phase * M.TAU;
      const hurt = this.hurtT < 0.35 ? 1 - this.hurtT / 0.35 : 0;
      const breath = Math.sin(t * 1.7 + this.seed * 6) * 0.7 * (1 - walk);
      // o corpo sobe e desce duas vezes por passada (uma em cada par de patas)
      const bob = Math.sin(ph * 2) * (1.8 + run * 1.6) * walk;
      // deitada, o corpo desce até a barriga encostar no chão
      const drop = lie * 12;
      const at = (a, s, z) => this.at(a, s, z);
      const groups = [];

      // corpo: as fatias da capivara do cenário; pastando, a frente desce um pouco
      const body = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        const front = Math.max(0, u - 0.55) / 0.45;
        const z = 32 + Math.sin(u * Math.PI) * 4 + bob + breath * Math.sin(u * Math.PI) - drop - graze * front * 6 - hurt * 2;
        const r = 26 * Math.pow(Math.sin(Math.PI * (0.12 + 0.82 * u)), 0.6) * (1 + lie * 0.05);
        body.push({ c: at(-48 + u * 78, 0, z), r, col: COL.fur });
      }
      groups.push({ balls: body, ref: at(-9, 0, 30 - drop), body: true });

      // patas: as de trás em -34 e as da frente em +16; em diagonal andando, recolhidas embaixo do corpo deitada
      const stride = (11 + run * 9) * walk;
      for (const [a, s, off] of [[-34, -12, 0], [-34, 12, 0.5], [16, -11, 0.5], [16, 11, 0]]) {
        const q = ph + off * M.TAU;
        const swing = Math.sin(q) * stride;
        const lift = Math.max(0, Math.cos(q)) * (5 + run * 4) * walk;
        const hip = at(a, s * 0.9, 22 - drop + bob * 0.5);
        const stand = at(a + swing, s, 2 + lift);
        const tucked = at(a * 0.92 + (a > 0 ? 8 : -4), s * 0.78, 6);
        const foot = M.lerp3(stand, tucked, lie);
        groups.push({ balls: tube(hip, foot, 4.6, 3.8, COL.leg), ref: foot });
      }

      // cabeça: abaixa em volta do pescoço (pastando) e, parada de cabeça alta, olha em volta
      const look = (M.noise1(t * 0.3 + this.seed * 17) - 0.5) * 0.9 * (1 - walk) * (1 - graze) * (1 - lie * 0.6);
      const hy = this.yaw + look;
      const pitch = graze * 0.95 + lie * 0.22 - hurt * 0.15;
      const neck = at(28, 0, 36 - drop * 0.9 - graze * 3 + bob * 0.8 + breath * 0.5);
      const fwd = { x: Math.cos(hy), y: Math.sin(hy), z: 0 };
      const side = { x: -Math.sin(hy), y: Math.cos(hy), z: 0 };
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const chew = Math.sin(t * 9) * 1.1 * graze;
      /** Ponto da cabeça: `da` à frente do pescoço, `ds` para o lado e `dz` para cima, antes de abaixar. */
      const onHead = (da, ds, dz) => {
        const a2 = da * cp + dz * sp;
        const z2 = -da * sp + dz * cp;
        return M.add(neck, M.add(M.scale(fwd, a2), M.add(M.scale(side, ds), { x: 0, y: 0, z: z2 })));
      };
      const head = [];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6;
        head.push({ c: onHead(2 + u * 30, 0, -u * 6 + (k === 6 ? chew : 0)), r: 16 - u * 4, col: COL.head });
      }
      const ahead = M.norm(M.sub(onHead(30, 0, -6), onHead(20, 0, -4)));
      const up = M.norm(M.sub(onHead(20, 0, 10), onHead(20, 0, 0)));
      const nose = onHead(32, 0, -6 + chew);
      const decals = [{ c: M.add(nose, M.scale(ahead, 10.6)), n: ahead, u: side, v: up, ru: 7, rv: 5.5, color: NOSE, minFacing: 0.02 }];
      for (const sgn of [-1, 1]) {
        const out = M.scale(side, sgn);
        decals.push({ c: M.add(onHead(17, 0, 5), M.scale(out, 12.6)), n: out, u: ahead, v: up, ru: 2.6, rv: 2.6, color: EYE, minFacing: 0.08 });
      }
      groups.push({ balls: head, ref: onHead(16, 0, 0), decals });
      // orelhinhas pequenas no alto, atrás na cabeça (giram junto); pastando, ficam da cor da cabeça (de frente, as
      // escuras pareciam dois olhos)
      const earCol = graze > 0.02 ? { base: M.mix(COL.ear.base, COL.head.base, graze), shade: M.mix(COL.ear.shade, COL.head.shade, graze), light: M.mix(COL.ear.light, COL.head.light, graze) } : COL.ear;
      groups.push({ balls: [-1, 1].map((sgn) => ({ c: onHead(2, sgn * 10, 13), r: 3.8, col: earCol })), ref: onHead(1, 0, 15), noShadow: true });
      return { groups };
    }
  }

  C.define('capivara', Capivara);
})(window.PD = window.PD || {});
