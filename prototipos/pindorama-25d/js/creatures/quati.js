// Quati (o bicho da mata do sul do Capão, em bando de 4; a [estrutura] fez as regras em 15/11): o corpo comprido
// marrom-alaranjado, a barriga mais clara, o focinho comprido e virado para cima com a ponta escura, a máscara escura
// no rosto com as marcas claras em volta dos olhos, as orelhinhas redondas e o rabo comprido em pé, com anéis escuros.
// Anda num trotezinho rápido (as patas em diagonal) e, parado, fareja com o focinho baixo e o rabo balançando. Golpe:
// no aviso ('windup') se encolhe para trás; na mordida ('bite') avança, abre a boca e volta. Ao cair ('die'), tomba.
//   PD.creatures.create('quati', xCm, yCm, yaw)
(function (PD) {
  'use strict';
  const M = PD.math;
  const C = PD.creatures;
  if (!C) return;
  const { tube } = C;

  /** Tamanho de jogo: maior que o de verdade (uns 45 cm de corpo), para ler com a câmera longe. */
  const S = 1.35;
  const COL = {
    fur: { base: '#a8652f', shade: '#73411b', light: '#cf8a48' },
    belly: { base: '#d6aa72', shade: '#a77e4c', light: '#ecc995' },
    dark: { base: '#3d2a1c', shade: '#271a10', light: '#5a3f2a' },
    ringL: { base: '#c7894d', shade: '#93602f', light: '#e2a96a' },
    ringD: { base: '#4a3020', shade: '#2f1e13', light: '#684632' },
    mask: { base: '#46301f', shade: '#2c1d12', light: '#62452e' },
  };
  const EYE = '#1a0f08';
  const MARK = '#efe2c6';

  class Quati extends C.Creature {
    constructor(x, y, yaw) {
      super(x, y, yaw);
      this.radius = 30 * S;
      this.top = 52 * S;
      this.acts = { windup: { dur: 0.45, hold: 0.4 }, bite: { dur: 0.32, hold: 0.25 } };
      /** Parado (0) a trotando (1). */
      this.trot = 0;
      /** Focinho baixo farejando (0 a 1). */
      this.sniff = 0;
    }

    animate(dt) {
      this.trot = M.smoothstep(6, 60, this.speed);
      const want = this.dying === null && !this.act && this.trot < 0.2 && M.noise1(this.time * 0.2 + this.seed * 40) > 0.45;
      this.sniff = M.damp(this.sniff, want ? 1 : 0, want ? 3 : 6, dt);
      // passada curta e rápida: uns 38 cm por ciclo
      this.phase = (this.phase + (this.speed * dt) / (38 * S)) % 1;
      const act = this.act;
      this.label = this.dying !== null ? 'caído' : act ? (act.kind === 'windup' ? 'preparando' : 'mordendo') : this.trot > 0.5 ? 'trotando' : this.sniff > 0.5 ? 'farejando' : 'parado';
    }

    parts() {
      const t = this.time;
      const act = this.act;
      const trot = this.trot;
      const sniff = M.smoothstep(0, 1, this.sniff);
      const ph = this.phase * M.TAU;
      const hurt = this.hurtT < 0.3 ? 1 - this.hurtT / 0.3 : 0;
      // aviso: encolhe para trás; mordida: avança e volta
      let crouch = 0;
      let lunge = 0;
      let open = 0;
      if (act && act.kind === 'windup') crouch = M.easeOut(M.clamp01(act.t / act.dur));
      else if (act && act.kind === 'bite') {
        const k = act.t;
        lunge = k < 0.09 ? M.easeOut(k / 0.09) : k < 0.15 ? 1 : 1 - M.easeInOut(M.clamp01((k - 0.15) / 0.3));
        open = k < 0.12 ? M.clamp01(k / 0.07) : 1 - M.clamp01((k - 0.12) / 0.12);
      }
      const bob = Math.sin(ph * 2) * 1.6 * trot;
      const shift = (lunge * 14 - crouch * 8 - hurt * 5) * S;
      const low = crouch * 4 * S;
      const at = (a, s, z) => this.at(a * S + shift, s * S, z * S - low);
      const groups = [];

      // corpo: comprido e baixo, mais alto atrás (as ancas)
      const body = [];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        const r = 10.5 * Math.pow(Math.sin(Math.PI * (0.14 + 0.8 * u)), 0.55);
        const z = 21 + Math.sin(u * Math.PI) * 2 - u * 1.5 + bob;
        body.push({ c: at(-22 + u * 40, 0, z), r: r * S, col: COL.fur });
      }
      const belly = [];
      for (let k = 1; k <= 6; k++) belly.push({ c: at(-18 + k * 5.5, 0, 16.5 + bob), r: 6.8 * S, col: COL.belly });
      groups.push({ balls: belly.concat(body), ref: at(-2, 0, 20), body: true });

      // patas: trote em diagonal (a da frente de um lado com a de trás do outro); escuras embaixo
      const stride = 9 * trot;
      for (const [a, s, off] of [[-15, -6, 0], [-15, 6, 0.5], [12, -5.5, 0.5], [12, 5.5, 0]]) {
        const q = ph + off * M.TAU;
        const hip = at(a, s * 0.85, 15 + bob * 0.5);
        const foot = at(a + Math.sin(q) * stride + crouch * (a > 0 ? 3 : -2), s, 1.5 + Math.max(0, Math.cos(q)) * 4 * trot);
        const knee = M.lerp3(hip, foot, 0.5);
        groups.push({ balls: tube(hip, knee, 3.4 * S, 3 * S, COL.fur).concat(tube(knee, foot, 3 * S, 2.6 * S, COL.dark)), ref: foot });
      }

      // rabo em pé, curvado para trás, com os anéis (balança andando e farejando)
      const tail = [];
      const sway = Math.sin(t * 2.2 + this.seed * 7) * (0.25 + trot * 0.2) + Math.sin(ph) * 0.15 * trot;
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const back = -22 - u * 15 - Math.sin(u * 1.4) * 5;
        const up = 22 + u * 26 - Math.pow(u, 3) * 7;
        const sd = Math.sin(u * 1.6) * sway * 14;
        const ring = Math.floor(u * 7) % 2 === 0 ? COL.ringL : COL.ringD;
        tail.push({ c: at(back, sd, up + bob * (1 - u)), r: (5.4 - u * 2.6) * S, col: i === n ? COL.ringD : ring });
      }
      groups.push({ balls: tail, ref: at(-28, 0, 30) });

      // cabeça: o focinho comprido e virado para cima; abaixa farejando
      const look = (M.noise1(t * 0.4 + this.seed * 11) - 0.5) * 0.7 * (1 - trot) * (1 - sniff) * (act ? 0 : 1);
      const hy = this.yaw + look;
      const fwd = { x: Math.cos(hy), y: Math.sin(hy), z: 0 };
      const side = { x: -fwd.y, y: fwd.x, z: 0 };
      const pitch = sniff * 0.55 - lunge * 0.15 + crouch * 0.1 + Math.sin(t * 7) * 0.05 * sniff;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const neck = at(17, 0, 24 + bob - sniff * 3);
      const onHead = (da, ds, dz) => {
        const a2 = da * cp + dz * sp;
        const z2 = -da * sp + dz * cp;
        return M.add(neck, M.add(M.scale(fwd, a2 * S), M.add(M.scale(side, ds * S), { x: 0, y: 0, z: z2 * S })));
      };
      const head = [];
      for (let k = 0; k <= 7; k++) {
        const u = k / 7;
        // o focinho afina e sobe um pouquinho na ponta (o do quati é virado para cima)
        head.push({ c: onHead(2 + u * 20, 0, 2 - u * 2 + Math.pow(u, 3) * 3), r: (8.4 - u * 5.6) * S, col: u > 0.55 ? COL.mask : COL.fur });
      }
      // a boca abrindo na mordida: o queixo desce
      if (open > 0.02) head.push({ c: onHead(14, 0, -3.5 - open * 3), r: 3.2 * S, col: COL.mask });
      const up = M.norm(M.sub(onHead(8, 0, 10), onHead(8, 0, 0)));
      const ahead = M.norm(M.sub(onHead(20, 0, 1), onHead(10, 0, 1)));
      const decals = [];
      // a ponta do focinho escura e as marcas claras do rosto
      decals.push({ c: M.add(onHead(22, 0, 1.2), M.scale(ahead, 2.6 * S)), n: ahead, u: side, v: up, ru: 2.4 * S, rv: 2 * S, color: '#160c06', minFacing: 0.02 });
      for (const sgn of [-1, 1]) {
        const out = M.scale(side, sgn);
        decals.push({ c: M.add(onHead(7, 0, 3), M.scale(out, 6.6 * S)), n: out, u: ahead, v: up, ru: 3.4 * S, rv: 2.4 * S, color: MARK, minFacing: 0.1 });
        decals.push({ c: M.add(onHead(7.4, 0, 3.4), M.scale(out, 7 * S)), n: out, u: ahead, v: up, ru: 1.5 * S, rv: 1.5 * S, color: C.eyeColor(EYE), glow: C.eyeGlow(undefined), minFacing: 0.12 });
        decals.push({ c: M.add(onHead(13, 0, 0.5), M.scale(out, 4.2 * S)), n: out, u: ahead, v: up, ru: 3.2 * S, rv: 1.2 * S, color: MARK, minFacing: 0.1 });
      }
      groups.push({ balls: head, ref: onHead(10, 0, 0), decals });
      // as orelhinhas redondas
      groups.push({ balls: [-1, 1].map((sgn) => ({ c: onHead(2, sgn * 5.5, 8), r: 2.8 * S, col: COL.dark })), ref: onHead(2, 0, 9), noShadow: true });
      return { groups };
    }
  }

  C.define('quati', Quati);
})(window.PD = window.PD || {});
