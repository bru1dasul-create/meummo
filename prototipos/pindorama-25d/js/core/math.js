// Matemática do protótipo: vetores 3D, ângulos, suavização, molas e ruído.
//
// Mundo: x e y no chão (em centímetros), z para cima. O eixo x desce para a direita na tela e o y desce
// para a esquerda (como num mapa isométrico). Atenção: com esse jeito de olhar, a "direita" de quem olha
// para a frente f é cross(cima, f) — veja `rightOf`. Todas as contas de lado (braço direito, penas no lado
// direito da cabeça) passam por aqui, para o personagem nunca sair espelhado.
(function (PD) {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
  const addScaled = (a, b, s) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const len = (a) => Math.hypot(a.x, a.y, a.z);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  function norm(a, fallback) {
    const l = len(a);
    return l > 1e-9 ? { x: a.x / l, y: a.y / l, z: a.z / l } : fallback || { x: 0, y: 0, z: 1 };
  }
  const lerp3 = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  const UP = Object.freeze({ x: 0, y: 0, z: 1 });

  /** Direita de quem olha na direção f (veja o comentário do topo). */
  const rightOf = (f) => norm(cross(UP, f), { x: -f.y, y: f.x, z: 0 });

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => clamp01((v - a) / (b - a));
  function smoothstep(e0, e1, x) {
    const t = clamp01((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }
  const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
  const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = (t) => Math.pow(clamp01(t), 3);
  /** Passa um pouco do ponto e volta (golpe com "chicote"). */
  function easeOutBack(t, s = 1.6) {
    const u = clamp01(t) - 1;
    return 1 + u * u * ((s + 1) * u + s);
  }

  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const angleDiff = (from, to) => wrapAngle(to - from);
  /** Aproxima `current` de `target` sem depender da taxa de quadros (lambda maior = mais rápido). */
  const damp = (current, target, lambda, dt) => target + (current - target) * Math.exp(-lambda * dt);
  const dampAngle = (current, target, lambda, dt) => current + angleDiff(current, target) * (1 - Math.exp(-lambda * dt));
  const damp3 = (c, t, lambda, dt) => {
    const k = Math.exp(-lambda * dt);
    return { x: t.x + (c.x - t.x) * k, y: t.y + (c.y - t.y) * k, z: t.z + (c.z - t.z) * k };
  };

  /** Gira o vetor v em volta do eixo (unitário) pelo ângulo a (fórmula de Rodrigues). */
  function rotate(v, axis, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const k = dot(axis, v) * (1 - c);
    const cr = cross(axis, v);
    return { x: v.x * c + cr.x * s + axis.x * k, y: v.y * c + cr.y * s + axis.y * k, z: v.z * c + cr.z * s + axis.z * k };
  }

  // ---- bases (frames): origem + direita (r), frente (f) e cima (u) ----

  /** Base a partir da frente e de uma dica de "cima". */
  function frameFrom(o, f, upHint = UP) {
    const fn = norm(f, { x: 1, y: 0, z: 0 });
    let r = cross(upHint, fn);
    if (len(r) < 1e-6) r = cross({ x: 0, y: 1, z: 0 }, fn);
    r = norm(r);
    const u = cross(fn, r);
    return { o, r, f: fn, u };
  }
  /** Base olhando para o ângulo `yaw` no chão (0 = +x). */
  function frameYaw(o, yaw) {
    const f = { x: Math.cos(yaw), y: Math.sin(yaw), z: 0 };
    return { o, r: rightOf(f), f, u: UP };
  }
  /** Ponto no espaço da base (x = direita, y = frente, z = cima). */
  const at = (fr, x, y, z) => ({
    x: fr.o.x + fr.r.x * x + fr.f.x * y + fr.u.x * z,
    y: fr.o.y + fr.r.y * x + fr.f.y * y + fr.u.y * z,
    z: fr.o.z + fr.r.z * x + fr.f.z * y + fr.u.z * z,
  });
  /** Direção no espaço da base. */
  const dirIn = (fr, x, y, z) => ({
    x: fr.r.x * x + fr.f.x * y + fr.u.x * z,
    y: fr.r.y * x + fr.f.y * y + fr.u.y * z,
    z: fr.r.z * x + fr.f.z * y + fr.u.z * z,
  });
  /** Inclina para a frente (positivo = nariz para baixo). */
  function pitch(fr, a) {
    return { o: fr.o, r: fr.r, f: rotate(fr.f, fr.r, a), u: rotate(fr.u, fr.r, a) };
  }
  /** Vira para a direita (positivo). */
  function yawBy(fr, a) {
    return { o: fr.o, r: rotate(fr.r, fr.u, a), f: rotate(fr.f, fr.u, a), u: fr.u };
  }
  /** Tomba para a direita (positivo = o alto vai para a direita). */
  function roll(fr, a) {
    return { o: fr.o, r: rotate(fr.r, fr.f, -a), f: fr.f, u: rotate(fr.u, fr.f, -a) };
  }
  const moved = (fr, o) => ({ o, r: fr.r, f: fr.f, u: fr.u });

  // ---- mola para movimento secundário (cabelo, penas, colar) ----

  /** Mola amortecida de 1 dimensão. `freq` em Hz; `zeta` < 1 balança, = 1 não passa do ponto. */
  class Spring {
    constructor(x = 0) {
      this.x = x;
      this.v = 0;
    }
    step(target, freq, zeta, dt) {
      const w = TAU * freq;
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const acc = w * w * (target - this.x) - 2 * zeta * w * this.v;
        this.v += acc * h;
        this.x += this.v * h;
      }
      return this.x;
    }
  }

  /** Mola de 3 dimensões (um ponto que segue outro com atraso). */
  class Spring3 {
    constructor(p) {
      this.x = new Spring(p.x);
      this.y = new Spring(p.y);
      this.z = new Spring(p.z);
    }
    step(t, freq, zeta, dt) {
      return { x: this.x.step(t.x, freq, zeta, dt), y: this.y.step(t.y, freq, zeta, dt), z: this.z.step(t.z, freq, zeta, dt) };
    }
    get value() {
      return { x: this.x.x, y: this.y.x, z: this.z.x };
    }
  }

  // ---- ruído suave (vento, respiração com variação) ----
  function hash(i) {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  /** Ruído suave entre -1 e 1. */
  function noise1(x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return lerp(hash(i), hash(i + 1), u) * 2 - 1;
  }
  /** Gerador de números "aleatórios" repetível (o cenário sai sempre igual). */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  /** Clareia (t > 0) ou escurece (t < 0) uma cor #rrggbb. */
  function shade(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    if (t >= 0) {
      r += (255 - r) * t;
      g += (255 - g) * t;
      b += (255 - b) * t;
    } else {
      r *= 1 + t;
      g *= 1 + t;
      b *= 1 + t;
    }
    return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
  }
  /** Mistura duas cores #rrggbb. */
  function mix(a, b, t) {
    const na = parseInt(a.slice(1), 16);
    const nb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((na >> s) & 255) + ((((nb >> s) & 255) - ((na >> s) & 255)) * t));
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  }

  PD.math = {
    TAU, DEG, UP, v3, add, sub, scale, addScaled, dot, cross, len, dist, norm, lerp3, rightOf,
    clamp, clamp01, lerp, invLerp, smoothstep, easeInOut, easeOut, easeIn, easeOutBack,
    wrapAngle, angleDiff, damp, dampAngle, damp3, rotate,
    frameFrom, frameYaw, at, dirIn, pitch, yawBy, roll, moved,
    Spring, Spring3, noise1, rng, shade, mix,
  };
})(window.PD = window.PD || {});
