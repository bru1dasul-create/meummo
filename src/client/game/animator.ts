// Decide qual animação e qual expressão o personagem mostra a cada quadro: parado (respirando e
// piscando), andando, correndo (na esquiva), atacando, apanhando ou desmaiado. Não desenha nada e não
// conhece o Phaser: só escolhe. Assim dá para testar e ajustar os tempos aqui sem mexer no resto.

import { dirFromAngle } from '../../shared/combat';
import { facingOf, LEFT, type Dir } from '../../shared/dir';
import type { Expression } from './doll/face';
import { ANIMS, type AnimName, type View } from './doll/poses';

export type AttackKind = 'shoot' | 'swing';

/** Duração de cada quadro do ataque, em ms (a soma é quanto o golpe dura na tela). */
const ATTACK_FRAMES: Record<AttackKind, number[]> = { shoot: [90, 110, 120], swing: [80, 90, 110, 120] };
const HURT_POSE_MS = 160;
const HURT_FACE_MS = 450;
const IDLE_FRAME_MS = 320;
const RUN_FRAME_MS = 35;
const BLINK_MS = 120;
const TALK_FRAME_MS = 140;

export interface AnimState {
  now: number;
  dir: Dir;
  moving: boolean;
  /** Andando: quanto do passo atual já foi (0 a 1). */
  progress: number;
  /** Quantos passos já deu (alterna a perna). */
  steps: number;
  dashing: boolean;
  fainted: boolean;
}

export interface AnimPick {
  view: View;
  /** Olhando para a esquerda: desenho de lado espelhado. */
  flip: boolean;
  anim: AnimName;
  frame: number;
  expression: Expression;
}

export function viewOf(dir: Dir): { view: View; flip: boolean } {
  const facing = facingOf(dir);
  return { view: facing === 0 ? 'up' : facing === 2 ? 'down' : 'side', flip: facing === LEFT };
}

export class CharacterAnimator {
  private attack: { kind: AttackKind; start: number; dir: Dir } | null = null;
  private hurtAt = -Infinity;
  private happyUntil = 0;
  private talkUntil = 0;
  private readonly blinkEvery: number;

  /** `seed` deixa cada personagem respirar e piscar num ritmo um pouco diferente. */
  constructor(private readonly seed: number) {
    this.blinkEvery = 3000 + (seed % 7) * 230;
  }

  /** Começa um ataque mirando no ângulo (radianos): o personagem vira para lá enquanto golpeia. */
  startAttack(kind: AttackKind, angle: number, now: number): void {
    this.attack = { kind, start: now, dir: dirFromAngle(angle) };
  }

  hurt(now: number): void {
    this.hurtAt = now;
  }

  /** Cara de feliz por um tempo (subiu de nível, se curou...). */
  cheer(now: number, ms: number): void {
    this.happyUntil = Math.max(this.happyUntil, now + ms);
  }

  /** Mexe a boca por um tempo (falou no chat). */
  talk(now: number, ms: number): void {
    this.talkUntil = now + ms;
  }

  pick(s: AnimState): AnimPick {
    const { now } = s;
    let dir = s.dir;
    let anim: AnimName = 'idle';
    let frame = 0;

    const attack = this.attack;
    const attackFrame = attack ? frameAt(ATTACK_FRAMES[attack.kind], now - attack.start) : -1;
    if (attack && attackFrame < 0) this.attack = null;

    if (s.fainted) {
      anim = 'ko';
    } else if (attack && attackFrame >= 0) {
      anim = attack.kind;
      frame = attackFrame;
      dir = attack.dir;
    } else if (now - this.hurtAt < HURT_POSE_MS) {
      anim = 'hurt';
    } else if (s.moving && s.dashing) {
      anim = 'run';
      frame = Math.floor(now / RUN_FRAME_MS) % ANIMS.run;
    } else if (s.moving) {
      // três quadros por passo: as pernas se alternam a cada passo
      const perStep = ANIMS.walk / 2;
      anim = 'walk';
      frame = (s.steps * perStep + Math.min(perStep - 1, Math.floor(s.progress * perStep))) % ANIMS.walk;
    } else {
      frame = Math.floor((now + this.seed * 131) / IDLE_FRAME_MS) % ANIMS.idle;
    }
    return { ...viewOf(dir), anim, frame, expression: this.expression(now, s.fainted) };
  }

  private expression(now: number, fainted: boolean): Expression {
    if (fainted) return 'ko';
    if (now - this.hurtAt < HURT_FACE_MS) return 'hurt';
    if (now < this.happyUntil) return 'happy';
    if (now < this.talkUntil) return Math.floor(now / TALK_FRAME_MS) % 2 === 0 ? 'talk' : 'normal';
    if ((now + this.seed * 97) % this.blinkEvery < BLINK_MS) return 'blink';
    return 'normal';
  }
}

/** Qual quadro está passando `elapsed` ms depois do começo (−1 = já acabou). */
function frameAt(durations: number[], elapsed: number): number {
  if (elapsed < 0) return 0;
  let t = 0;
  for (let i = 0; i < durations.length; i++) {
    t += durations[i]!;
    if (elapsed < t) return i;
  }
  return -1;
}
