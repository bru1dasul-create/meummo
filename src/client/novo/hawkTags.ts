// Os Olhos de Gavião no jogo novo: enquanto valem, cada bicho à vista ganha uma etiqueta por cima de tudo (das copas
// das árvores e do escuro da noite) com o nível dele, na cor do perigo: verde (fácil), amarelo (parelho) ou vermelho
// (perigoso). PROVISÓRIO: etiquetas de HTML por cima da tela; a [arte] faz o destaque de verdade (o contorno do bicho).

export interface HawkTag {
  id: number;
  /** Onde a etiqueta fica na tela (em cima da cabeça do bicho). */
  x: number;
  y: number;
  level: number;
  color: string;
}

/** A cor do perigo de um bicho deste nível para quem está no nível `mine`. */
export function dangerColor(level: number, mine: number): string {
  const diff = level - mine;
  if (diff >= 2) return '#ff5a4a'; // perigoso
  if (diff <= -2) return '#7bd389'; // fácil
  return '#f2c14e'; // parelho
}

export class HawkTags {
  private readonly root = document.createElement('div');
  private readonly style = document.createElement('style');
  private readonly tags = new Map<number, HTMLSpanElement>();

  constructor() {
    this.style.textContent = `
      #hawk-tags { position: fixed; inset: 0; z-index: 4; pointer-events: none; overflow: hidden; }
      #hawk-tags .hawk-tag { --c: #f2c14e; position: absolute; left: 0; top: 0; padding: 1px 7px; border-radius: 9px; border: 2px solid rgba(12, 10, 6, 0.75); background: var(--c); box-shadow: 0 0 10px var(--c); font: 800 12px system-ui, sans-serif; color: #15110a; white-space: nowrap; will-change: transform; }
      #hawk-tags .hawk-tag::after { content: ''; position: absolute; left: 50%; bottom: -9px; margin-left: -5px; border: 5px solid transparent; border-top-color: var(--c); }`;
    document.head.append(this.style);
    this.root.id = 'hawk-tags';
    document.body.append(this.root);
  }

  /** As etiquetas deste quadro (as que sumiram da lista saem da tela). */
  show(list: HawkTag[]): void {
    const keep = new Set<number>();
    for (const tag of list) {
      keep.add(tag.id);
      let el = this.tags.get(tag.id);
      if (!el) {
        el = document.createElement('span');
        el.className = 'hawk-tag';
        this.root.append(el);
        this.tags.set(tag.id, el);
      }
      const text = `Nv ${tag.level}`;
      if (el.textContent !== text) el.textContent = text;
      if (el.dataset.color !== tag.color) {
        el.dataset.color = tag.color;
        el.style.setProperty('--c', tag.color); // o fundo, o brilho e a pontinha de baixo
      }
      el.style.transform = `translate(${Math.round(tag.x)}px, ${Math.round(tag.y)}px) translate(-50%, -100%)`;
    }
    for (const [id, el] of this.tags) {
      if (keep.has(id)) continue;
      el.remove();
      this.tags.delete(id);
    }
  }

  clear(): void {
    if (this.tags.size > 0) this.show([]);
  }

  destroy(): void {
    this.root.remove();
    this.style.remove();
  }
}
