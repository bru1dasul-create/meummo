// Como uma entidade (jogador ou monstro) aparece na tela: sprite, sombra, nome, barra de vida,
// balão de fala e números de dano. A posição "de verdade" é em tiles; aqui fazemos a animação
// suave entre um tile e outro.

import type Phaser from 'phaser';
import { TILE_SIZE } from '../../shared/constants';
import { DX, LEFT, type Dir } from '../../shared/dir';
import type { GearLook } from '../../shared/items';
import type { EntityKind, EntityState } from '../../shared/protocol';
import { CharacterAnimator, type AttackKind } from './animator';
import { acquireCharacterTexture, CHAR_TOP, CHARACTER_ORIGIN_Y, CHARACTER_SCALE, characterTextureReady, faceTexture, releaseCharacterTexture } from './characters';
import { faceFrame, FACE_W } from './doll/face';
import { FEET_Y, FRAME_W, faceOrigin, frameIndex } from './doll/poses';
import { monsterTexture } from './monsterArt';

/** Monstros que se mexem mesmo parados (o Saci pulando, o fogo da Mula). */
const ANIMATED_IDLE = new Set(['saci', 'mula_sem_cabeca']);

const BUBBLE_MS = 5000;
const FADE_MS = 450;
/** Folga entre um passo e o próximo em que ainda conta como "andando" (não pisca a pose parada). */
const WALK_GRACE_MS = 90;

/** Pixel dos pés do personagem no tile (x, y). */
export function feetOf(x: number, y: number): [number, number] {
  return [x * TILE_SIZE + TILE_SIZE / 2, (y + 1) * TILE_SIZE];
}

export interface MoveOptions {
  /** Distância (em tiles) a partir da qual pula em vez de andar. */
  snapBeyond?: number;
  /** Duração total da animação (esquiva é rápida). */
  durationMs?: number;
  /** É uma esquiva: o personagem usa a animação de correr. */
  dash?: boolean;
}

export class EntityView {
  readonly id: number;
  readonly kind: EntityKind;
  readonly type: string;
  readonly name: string;
  readonly sprite: Phaser.GameObjects.Sprite;
  tileX: number;
  tileY: number;
  dir: Dir;
  level: number;
  hp: number;
  maxHp: number;
  /** Tempo para andar um tile (monstros têm velocidades diferentes). */
  readonly stepMs: number | undefined;
  /** Morrendo: some aos poucos e depois é destruída. */
  dying = false;
  /** Jogadores: o look (vem do nome), para redesenhar quando o equipamento muda. */
  private readonly look: number;
  /** Altura do desenho acima dos pés (onde o nome fica). */
  private readonly height: number;

  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly tag: HTMLDivElement;
  private readonly nameEl: HTMLDivElement;
  private readonly hpBar: HTMLDivElement;
  private readonly hpFill: HTMLDivElement;
  private bubble: HTMLDivElement | null = null;
  private bubbleTimer: number | undefined;
  private fromX: number;
  private fromY: number;
  private toX: number;
  private toY: number;
  private moveStart = 0;
  private moveDuration = 0;
  private steps = 0;
  private facingLeft = false;
  private flashUntil = 0;
  private windupUntil = 0;
  private windupStart = 0;
  private fadeStart = 0;
  private ghostUntil = 0;
  private fainted = false;
  private cachedLabelWidth: number | null = null;
  // jogadores e NPCs: animações, rosto e a textura da roupa
  private readonly animator: CharacterAnimator | null = null;
  private readonly face: Phaser.GameObjects.Sprite | null = null;
  private textureKey = '';
  /** Roupa nova ainda sendo desenhada: a antiga continua na tela até ela ficar pronta. */
  private pendingKey = '';
  private dashing = false;
  private lastMovingAt = -Infinity;
  /** Personagens aparecem na metade do tamanho da textura (que tem o dobro de detalhe). */
  private baseScale = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    labels: HTMLElement,
    state: EntityState,
    private readonly isSelf: boolean,
  ) {
    this.id = state.id;
    this.kind = state.kind;
    this.type = state.type;
    this.name = state.name;
    this.tileX = state.x;
    this.tileY = state.y;
    this.dir = state.dir;
    this.level = state.level;
    this.hp = state.hp;
    this.maxHp = state.maxHp;
    this.stepMs = state.stepMs;
    this.look = state.look;
    this.height = state.kind === 'monster' ? TILE_SIZE : CHAR_TOP;
    this.facingLeft = state.dir === LEFT;
    const [px, py] = feetOf(state.x, state.y);
    this.fromX = this.toX = px;
    this.fromY = this.toY = py;

    this.shadow = scene.add.ellipse(px, py - 1.5, 10, 4, 0x000000, 0.28);
    if (state.kind === 'monster') {
      this.sprite = scene.add.sprite(px, py, monsterTexture(scene, state.type), 0).setOrigin(0.5, 1);
    } else {
      // jogadores e NPCs (vendedora...) usam o mesmo desenho de personagem; NPC pode ter aparência própria
      const npc = state.kind === 'npc' ? state.type : undefined;
      this.textureKey = acquireCharacterTexture(scene, state.look, state.gear, npc);
      this.sprite = scene.add.sprite(px, py, this.textureKey, 0).setOrigin(0.5, CHARACTER_ORIGIN_Y).setScale(CHARACTER_SCALE);
      this.face = scene.add.sprite(px, py, faceTexture(scene, state.look, npc), 0).setOrigin(0, 0).setScale(CHARACTER_SCALE);
      this.animator = new CharacterAnimator(state.id);
      this.baseScale = CHARACTER_SCALE;
    }

    this.tag = document.createElement('div');
    this.tag.className = `tag ${state.kind}${isSelf ? ' self' : ''}`;
    this.nameEl = document.createElement('div');
    this.nameEl.className = 'name';
    this.hpBar = document.createElement('div');
    this.hpBar.className = 'hpbar';
    this.hpFill = document.createElement('div');
    this.hpBar.append(this.hpFill);
    this.tag.append(this.nameEl, this.hpBar);
    labels.append(this.tag);
    this.renderName();
    this.setHp(state.hp, state.maxHp);
    this.update(performance.now());
  }

  /** Manda a entidade para o tile (x, y), andando suavemente (ou pulando, se for longe). */
  moveTo(x: number, y: number, dir: Dir, now: number, stepMs: number, options: MoveOptions = {}): void {
    this.setDir(dir);
    // em passos (uma diagonal conta como 1 passo); a animação dura proporcional à distância de verdade
    const distance = Math.max(Math.abs(x - this.tileX), Math.abs(y - this.tileY));
    const length = Math.hypot(x - this.tileX, y - this.tileY);
    if (distance === 0) return;
    this.tileX = x;
    this.tileY = y;
    const [px, py] = feetOf(x, y);
    if (distance > (options.snapBeyond ?? 2)) {
      this.fromX = this.toX = px;
      this.fromY = this.toY = py;
      this.moveDuration = 0;
      return;
    }
    const current = this.position(now);
    this.dashing = options.dash ?? false;
    this.fromX = current.x;
    this.fromY = current.y;
    this.toX = px;
    this.toY = py;
    this.moveStart = now;
    this.moveDuration = options.durationMs ?? Math.round(stepMs * length);
    this.steps++;
  }

  /** Pula direto para um tile (voltar para a vila, teleporte). */
  teleportTo(x: number, y: number, dir: Dir): void {
    this.setDir(dir);
    this.tileX = x;
    this.tileY = y;
    const [px, py] = feetOf(x, y);
    this.fromX = this.toX = px;
    this.fromY = this.toY = py;
    this.moveDuration = 0;
  }

  /** Trocou de equipamento: redesenha com as peças novas, sem interromper a animação. */
  setGear(gear: GearLook): void {
    if (this.kind === 'monster') return;
    const next = acquireCharacterTexture(this.scene, this.look, gear, this.kind === 'npc' ? this.type : undefined);
    if (this.pendingKey) releaseCharacterTexture(this.scene, this.pendingKey);
    this.pendingKey = '';
    if (next === this.textureKey) {
      releaseCharacterTexture(this.scene, next); // mesma combinação: só devolve a referência extra
      return;
    }
    this.pendingKey = next;
    this.swapWhenReady();
  }

  private swapWhenReady(): void {
    if (!this.pendingKey || !characterTextureReady(this.pendingKey)) return;
    this.sprite.setTexture(this.pendingKey, this.sprite.frame.name);
    releaseCharacterTexture(this.scene, this.textureKey);
    this.textureKey = this.pendingKey;
    this.pendingKey = '';
  }

  /** Animação de ataque: `shoot` = estilingue/arco, `swing` = golpe (Bordunada). */
  attack(kind: AttackKind, angle: number, now: number): void {
    this.animator?.startAttack(kind, angle, now);
  }

  /** Cara de feliz por um tempo (subiu de nível, se curou). */
  cheer(now: number, ms: number): void {
    this.animator?.cheer(now, ms);
  }

  setDir(dir: Dir): void {
    this.dir = dir;
    if (DX[dir] < 0) this.facingLeft = true;
    else if (DX[dir] > 0) this.facingLeft = false;
  }

  /** Atualiza sprite e sombra para o momento `now`. Chamado todo quadro. Devolve false quando já pode sumir. */
  update(now: number): boolean {
    const { x, y, moving, t } = this.position(now);
    this.sprite.setPosition(x, y);
    this.shadow.setPosition(x, y - 1.5);
    this.sprite.setDepth(y);
    this.shadow.setDepth(y - 0.5);

    if (this.animator) {
      this.swapWhenReady();
      if (moving) this.lastMovingAt = now;
      this.drawCharacter(now, moving || now - this.lastMovingAt < WALK_GRACE_MS, t);
    } else {
      this.sprite.setFrame(moving || (now % 900 < 450 && ANIMATED_IDLE.has(this.type)) ? 1 : 0);
      this.sprite.setFlipX(this.facingLeft);
    }

    // preparando golpe: pulsa
    if (now < this.windupUntil) {
      const progress = (now - this.windupStart) / Math.max(1, this.windupUntil - this.windupStart);
      this.sprite.setScale(this.baseScale * (1 + 0.12 * Math.abs(Math.sin(progress * Math.PI * 4))));
    } else {
      this.sprite.setScale(this.baseScale);
    }

    if (now < this.flashUntil) {
      this.sprite.setTint(0xff6b6b);
      this.face?.setTint(0xff6b6b);
    } else {
      this.sprite.clearTint();
      this.face?.clearTint();
    }

    let alpha = 1;
    if (this.fainted) alpha = 0.45;
    if (now < this.ghostUntil) alpha = Math.min(alpha, 0.55);
    if (this.dying) {
      const t = (now - this.fadeStart) / FADE_MS;
      alpha = Math.max(0, 1 - t);
      this.tag.style.opacity = String(alpha);
      if (t >= 1) return false;
    }
    this.sprite.setAlpha(alpha);
    this.face?.setAlpha(alpha);
    this.shadow.setAlpha(alpha);
    return true;
  }

  /** Escolhe o quadro do corpo e a expressão, e cola o rosto em cima da cabeça desse quadro. */
  private drawCharacter(now: number, moving: boolean, progress: number): void {
    const pick = this.animator!.pick({
      now,
      dir: this.dir,
      moving,
      progress,
      steps: this.steps,
      dashing: this.dashing,
      fainted: this.fainted,
    });
    this.sprite.setFrame(frameIndex(pick.view, pick.anim, pick.frame));
    this.sprite.setFlipX(pick.flip);
    const face = this.face!;
    // de costas não tem rosto; e enquanto o corpo ainda está sendo desenhado, o rosto espera
    if (pick.view === 'up' || !characterTextureReady(this.textureKey)) {
      face.setVisible(false);
      return;
    }
    const [fx, fy] = faceOrigin(pick.view, pick.anim, pick.frame);
    const k = CHARACTER_SCALE;
    const left = this.sprite.x - (FRAME_W / 2) * k;
    const top = this.sprite.y - (FEET_Y + 1) * k;
    face
      .setVisible(true)
      .setFrame(faceFrame(pick.view, pick.expression))
      .setFlipX(pick.flip)
      .setPosition(left + (pick.flip ? FRAME_W - fx - FACE_W : fx) * k, top + fy * k)
      .setDepth(this.sprite.depth + 0.01);
  }

  /** Ponto da tela (em pixels) logo acima da cabeça, onde o nome fica normalmente. */
  labelAnchor(camera: Phaser.Cameras.Scene2D.Camera): { x: number; y: number } {
    return {
      x: (this.sprite.x - camera.worldView.x) * camera.zoom,
      y: (this.sprite.y - this.height - camera.worldView.y) * camera.zoom,
    };
  }

  /** Largura do nome na tela (medida uma vez; muda só quando o nome/nível muda). */
  labelWidth(): number {
    if (this.cachedLabelWidth === null) this.cachedLabelWidth = this.nameEl.offsetWidth || 60;
    return this.cachedLabelWidth;
  }

  /** Coloca nome, barra e balão num ponto da tela (o "pé" do texto fica em y). */
  placeLabel(x: number, y: number): void {
    this.tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  setHp(hp: number, maxHp = this.maxHp): void {
    this.hp = hp;
    this.maxHp = maxHp;
    const fraction = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.hpFill.style.width = `${(fraction * 100).toFixed(1)}%`;
    this.hpFill.className = fraction > 0.5 ? 'ok' : fraction > 0.25 ? 'mid' : 'low';
    // monstros sempre mostram a vida; jogadores só quando estão machucados (o seu fica no painel)
    this.hpBar.hidden = this.isSelf || this.kind === 'npc' || (this.kind === 'player' && fraction >= 1);
  }

  /** Linha pequena embaixo do nome (NPCs: "quitandeira do píer"). */
  setSubtitle(text: string): void {
    this.tag.querySelector('.subtitle')?.remove();
    if (!text) return;
    const sub = document.createElement('div');
    sub.className = 'subtitle';
    sub.textContent = text;
    this.nameEl.after(sub);
    this.cachedLabelWidth = null;
  }

  setLevel(level: number): void {
    this.level = level;
    this.renderName();
  }

  /** Cor do nome do monstro conforme a diferença de nível para você. */
  setThreat(myLevel: number): void {
    if (this.kind !== 'monster') return;
    const diff = this.level - myLevel;
    this.tag.dataset.threat = diff <= -3 ? 'easy' : diff <= 1 ? 'normal' : diff <= 3 ? 'hard' : 'deadly';
  }

  /** Piscada vermelha de quando apanha (personagens também fazem careta e recuam). */
  flash(now: number): void {
    this.flashUntil = now + 140;
    this.animator?.hurt(now);
  }

  /** Pulsa enquanto prepara um golpe. */
  windup(now: number, ms: number): void {
    this.windupStart = now;
    this.windupUntil = now + ms;
  }

  /** Meio transparente por um tempo (esquiva, proteção). */
  ghost(now: number, ms: number): void {
    this.ghostUntil = now + ms;
  }

  setFainted(fainted: boolean): void {
    this.fainted = fainted;
  }

  /** Começa a sumir (monstro derrotado). */
  die(now: number): void {
    if (this.dying) return;
    this.dying = true;
    this.fadeStart = now;
    this.hpBar.hidden = true;
  }

  /** Texto que sobe e some (dano, cura, XP). */
  floatText(text: string, className: string): void {
    const el = document.createElement('div');
    el.className = `float ${className}`;
    el.textContent = text;
    el.style.left = `calc(50% + ${Math.round((Math.random() - 0.5) * 18)}px)`;
    this.tag.append(el);
    window.setTimeout(() => el.remove(), 1100);
  }

  say(text: string): void {
    if (!this.bubble) {
      this.bubble = document.createElement('div');
      this.bubble.className = 'bubble';
      this.tag.prepend(this.bubble);
    }
    this.bubble.textContent = text;
    // mexe a boca mais ou menos o tempo de "falar" o texto
    this.animator?.talk(performance.now(), Math.min(2500, 400 + text.length * 45));
    window.clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => {
      this.bubble?.remove();
      this.bubble = null;
    }, BUBBLE_MS);
  }

  /** Posição atual em pixels (centro do personagem), para efeitos. */
  center(now: number): { x: number; y: number } {
    const { x, y } = this.position(now);
    return { x, y: y - TILE_SIZE / 2 };
  }

  destroy(): void {
    window.clearTimeout(this.bubbleTimer);
    this.sprite.destroy();
    this.face?.destroy();
    if (this.textureKey) releaseCharacterTexture(this.scene, this.textureKey);
    if (this.pendingKey) releaseCharacterTexture(this.scene, this.pendingKey);
    this.shadow.destroy();
    this.tag.remove();
  }

  private renderName(): void {
    this.cachedLabelWidth = null;
    this.nameEl.textContent = '';
    this.nameEl.append(this.name);
    if (this.kind === 'monster' || this.level > 1) {
      const badge = document.createElement('span');
      badge.className = 'lvl';
      badge.textContent = ` Nv ${this.level}`;
      this.nameEl.append(badge);
    }
  }

  /** Onde a entidade está agora; `t` é quanto do passo atual já foi andado (0 a 1). */
  private position(now: number): { x: number; y: number; moving: boolean; t: number } {
    if (this.moveDuration <= 0) return { x: this.toX, y: this.toY, moving: false, t: 1 };
    const t = Math.min(1, (now - this.moveStart) / this.moveDuration);
    return {
      x: this.fromX + (this.toX - this.fromX) * t,
      y: this.fromY + (this.toY - this.fromY) * t,
      moving: t < 1,
      t,
    };
  }
}
