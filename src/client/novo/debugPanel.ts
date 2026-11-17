// O painel de ajustes dentro do jogo (pedido do dono, 17/11): F1 abre e fecha, no canto da tela, para acertar os números
// jogando, sem trocar de aba. Só para administrador e só no computador do servidor: ele usa as mesmas portas do painel
// (/admin/api/dados, /ajustar, /padrao, /exportar), então as travas e os registros são os de lá, e tudo o que muda aqui
// aparece no painel e fica em saves/ajustes.json. Fechado, não faz nada (nem conta quadros).
//
// Atenção: os ajustes valem para o servidor inteiro (todo mundo que estiver jogando), não só para quem mexe.

import type { GmCommand } from '../../shared/protocol';
import { changedFeel, DEFAULT_FEEL, FEEL_LIMITS, type Feel } from './feel';

type FieldKind = 'inteiro' | 'numero' | 'faixa' | 'sim-nao' | 'texto' | 'texto-longo' | 'itens' | 'itens-qtd' | 'porcento';
interface Field {
  campo: string;
  rotulo: string;
  tipo: FieldKind;
  dica?: string;
  valor: unknown;
  padrao: unknown;
  ajustado: boolean;
}
interface Entry {
  id: string;
  nome: string;
  detalhe: string;
  campos: Field[];
}
interface Group {
  arquivo: string;
  titulo: string;
  lista: Entry[];
}
interface Data {
  grupos: Group[];
}

export interface DebugHooks {
  isAdmin(): boolean;
  gm(cmd: GmCommand): void;
  /** Os poderes ligados agora (para os botões acenderem). */
  powers(): { god: boolean; nocd: boolean; fly: boolean };
  /** Bichos que você está vendo agora. */
  monstersInView(): number;
  /** A arma equipada (a chave em data/items.json), ou null. */
  weapon(): string | null;
  /** Ligou ou desligou as hitboxes (as linhas no chão). */
  hitboxes(on: boolean): void;
  /** O game feel desta tela (tremor, pausa no impacto, faíscas, clarão). */
  feel(): Feel;
  setFeel(feel: Feel): void;
}

const HEADERS = { 'content-type': 'application/json', 'x-meummo-admin': '1' };
const SLIDER_KINDS: readonly FieldKind[] = ['inteiro', 'numero', 'porcento'];

/** Até onde o slider vai: umas 4 vezes o maior entre o padrão e o valor de agora, arredondado para um número "bonito". */
export function sliderMax(value: number, standard: number): number {
  const top = Math.max(Math.abs(value), Math.abs(standard), 1) * 4;
  const scale = 10 ** Math.floor(Math.log10(top));
  const nice = [1, 2, 5, 10].find((n) => n * scale >= top) ?? 10;
  return nice * scale;
}

/** O passo do slider: inteiro anda de 1 em 1 (de 10 em 10 nos números grandes, como os tempos em ms); o resto, 0,1. */
export function sliderStep(kind: FieldKind, max: number): number {
  if (kind === 'numero') return max <= 5 ? 0.05 : 0.1;
  return max >= 2000 ? 10 : 1;
}

export class DebugPanel {
  private readonly root = document.createElement('div');
  private readonly body = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly counters = document.createElement('div');
  private data: Data | null = null;
  private open = false;
  private monster = '';
  private showBoxes = false;
  private frames = 0;
  private fpsAt = 0;
  private fps = 0;
  private raf = 0;
  /** As seções abertas (lembradas enquanto o jogo está aberto). */
  private readonly opened = new Set<string>(['Atalhos', 'Jogador']);

  constructor(private readonly hooks: DebugHooks) {
    this.root.id = 'debug-panel';
    this.root.hidden = true;
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '8px',
      right: '8px',
      width: '340px',
      maxHeight: 'calc(100vh - 16px)',
      overflowY: 'auto',
      zIndex: '80',
      padding: '10px 12px',
      borderRadius: '10px',
      border: '1px solid rgba(255, 170, 60, 0.8)',
      background: 'rgba(18, 14, 10, 0.86)',
      color: '#f3e6cf',
      font: '13px/1.35 system-ui, sans-serif',
    });
    const title = document.createElement('div');
    title.textContent = 'AJUSTES (F1 fecha) — vale para o servidor todo';
    Object.assign(title.style, { fontWeight: '700', color: '#ffb347', marginBottom: '4px' });
    Object.assign(this.counters.style, { color: '#9fe0a0', marginBottom: '4px' });
    Object.assign(this.status.style, { minHeight: '18px', color: '#ffd98a', marginBottom: '4px' });
    this.root.append(title, this.counters, this.status, this.body);
    // mexer no painel não mexe no jogo (clicar não anda, a roda não dá zoom, as teclas dos campos não viram ação)
    for (const type of ['pointerdown', 'pointerup', 'wheel', 'contextmenu', 'keydown', 'keyup'] as const) {
      this.root.addEventListener(type, (event) => {
        if (!(event instanceof KeyboardEvent && event.code === 'F1')) event.stopPropagation();
      });
    }
    document.body.append(this.root);
    window.addEventListener('keydown', this.onKey, true);
  }

  get isOpen(): boolean {
    return this.open;
  }

  private readonly onKey = (event: KeyboardEvent) => {
    if (event.code !== 'F1') return;
    event.preventDefault(); // o F1 não abre a ajuda do navegador
    event.stopPropagation();
    if (!event.repeat) this.toggle();
  };

  toggle(): void {
    if (!this.open && !this.hooks.isAdmin()) return; // só para administrador
    this.open = !this.open;
    this.root.hidden = !this.open;
    cancelAnimationFrame(this.raf);
    if (!this.open) return;
    this.fpsAt = performance.now();
    this.frames = 0;
    this.raf = requestAnimationFrame(this.tick);
    void this.load();
  }

  /** Só com o painel aberto: conta os quadros e mostra os contadores duas vezes por segundo. */
  private readonly tick = (now: number) => {
    if (!this.open) return;
    this.frames += 1;
    if (now - this.fpsAt >= 500) {
      this.fps = Math.round((this.frames * 1000) / (now - this.fpsAt));
      this.frames = 0;
      this.fpsAt = now;
      this.counters.textContent = `${this.fps} FPS · ${this.hooks.monstersInView()} bichos à vista`;
      this.paintPowers();
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private say(text: string, bad = false): void {
    this.status.textContent = text;
    this.status.style.color = bad ? '#ff8a7a' : '#ffd98a';
  }

  private async load(): Promise<void> {
    try {
      const res = await fetch('/admin/api/dados', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.text()).trim() || `erro ${res.status}`);
      this.data = (await res.json()) as Data;
      this.render();
    } catch (error) {
      this.data = null;
      this.body.replaceChildren();
      this.say(`Não consegui ler os números: ${(error as Error).message} (o painel só funciona no computador onde o jogo está ligado)`, true);
    }
  }

  private async post(path: string, body: unknown): Promise<{ ok: boolean; erro?: string }> {
    try {
      const res = await fetch(path, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
      return (await res.json()) as { ok: boolean; erro?: string };
    } catch (error) {
      return { ok: false, erro: (error as Error).message };
    }
  }

  private group(file: string): Group | undefined {
    return this.data?.grupos.find((g) => g.arquivo === file);
  }

  private entry(file: string, id: string): Entry | undefined {
    return this.group(file)?.lista.find((e) => e.id === id);
  }

  // ---------------- desenho ----------------

  private button(text: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    Object.assign(b.style, { margin: '2px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #8a6a3a', background: '#3a2a18', color: '#f3e6cf', cursor: 'pointer', font: 'inherit' });
    b.addEventListener('click', () => {
      b.blur();
      onClick();
    });
    return b;
  }

  private section(name: string, ...children: (HTMLElement | null)[]): HTMLElement {
    const box = document.createElement('details');
    box.open = this.opened.has(name);
    box.addEventListener('toggle', () => (box.open ? this.opened.add(name) : this.opened.delete(name)));
    const head = document.createElement('summary');
    head.textContent = name;
    Object.assign(head.style, { cursor: 'pointer', fontWeight: '700', color: '#ffd98a', margin: '6px 0 2px' });
    box.append(head, ...children.filter((c): c is HTMLElement => c !== null));
    return box;
  }

  private caption(text: string): HTMLElement {
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, { color: '#c9b592', margin: '6px 0 0', fontStyle: 'italic' });
    return el;
  }

  /** Uma linha: o nome, o slider (ou a caixinha de sim/não), o valor de agora e o ↺ que volta ao padrão. */
  private row(file: string, entry: Entry, field: Field): HTMLElement | null {
    const yesNo = field.tipo === 'sim-nao';
    if (!yesNo && (!SLIDER_KINDS.includes(field.tipo) || typeof field.valor !== 'number')) return null;
    const row = document.createElement('div');
    Object.assign(row.style, { margin: '4px 0' });
    row.dataset.campo = `${file}/${entry.id}/${field.campo}`; // para achar a linha nos testes do navegador
    const label = document.createElement('div');
    const value = document.createElement('strong');
    Object.assign(value.style, { color: field.ajustado ? '#ffb347' : '#f3e6cf', float: 'right' });
    label.append(field.rotulo, value);
    if (field.dica) label.title = field.dica;
    const line = document.createElement('div');
    Object.assign(line.style, { display: 'flex', alignItems: 'center', gap: '6px' });
    const input = document.createElement('input');
    const save = async (valor: unknown) => {
      const result = await this.post('/admin/api/ajustar', { arquivo: file, id: entry.id, campo: field.campo, valor });
      this.say(result.ok ? `${entry.nome} › ${field.rotulo} = ${String(valor)} (já vale)` : `Não salvei: ${result.erro}`, !result.ok);
      await this.load(); // mostra o que o servidor aceitou
    };
    if (yesNo) {
      input.type = 'checkbox';
      input.checked = field.valor === true;
      value.textContent = input.checked ? 'sim' : 'não';
      input.addEventListener('change', () => void save(input.checked));
    } else {
      const now = field.valor as number;
      const max = sliderMax(now, typeof field.padrao === 'number' ? field.padrao : now);
      input.type = 'range';
      input.min = '0';
      input.max = String(max);
      input.step = String(sliderStep(field.tipo, max));
      input.value = String(now);
      input.style.flex = '1';
      value.textContent = String(now);
      input.addEventListener('input', () => (value.textContent = input.value)); // arrastando: só mostra
      input.addEventListener('change', () => void save(Number(input.value))); // soltou: vale
    }
    const reset = this.button('↺', async () => {
      const result = await this.post('/admin/api/padrao', { arquivo: file, id: entry.id, campo: field.campo });
      this.say(result.ok ? `${entry.nome} › ${field.rotulo} voltou ao padrão` : `Não deu: ${result.erro}`, !result.ok);
      await this.load();
    });
    reset.title = `Voltar ao padrão (${String(field.padrao)})`;
    reset.disabled = !field.ajustado;
    reset.style.opacity = field.ajustado ? '1' : '0.4';
    line.append(input, reset);
    row.append(label, line);
    return row;
  }

  /** Os sliders do game feel: não passam pelo servidor (valem só nesta tela, guardados no navegador), então é na hora. */
  private feelRows(): HTMLElement[] {
    const feel = this.hooks.feel();
    const set = (change: Partial<Feel>) => {
      this.hooks.setFeel({ ...this.hooks.feel(), ...change });
      this.render();
    };
    const rows = (Object.keys(FEEL_LIMITS) as (keyof typeof FEEL_LIMITS)[]).map((key) => {
      const limit = FEEL_LIMITS[key];
      const row = document.createElement('div');
      row.dataset.campo = `feel/${key}`;
      Object.assign(row.style, { margin: '4px 0' });
      const label = document.createElement('div');
      const value = document.createElement('strong');
      const changed = feel[key] !== DEFAULT_FEEL[key];
      Object.assign(value.style, { color: changed ? '#ffb347' : '#f3e6cf', float: 'right' });
      value.textContent = String(feel[key]);
      label.append(limit.label, value);
      const line = document.createElement('div');
      Object.assign(line.style, { display: 'flex', alignItems: 'center', gap: '6px' });
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = String(limit.max);
      input.step = String(limit.step);
      input.value = String(feel[key]);
      input.style.flex = '1';
      input.addEventListener('input', () => {
        value.textContent = input.value;
        this.hooks.setFeel({ ...this.hooks.feel(), [key]: Number(input.value) }); // arrastando já vale (é só da tela)
      });
      input.addEventListener('change', () => this.render());
      const reset = this.button('↺', () => set({ [key]: DEFAULT_FEEL[key] }));
      reset.title = `Voltar ao padrão (${DEFAULT_FEEL[key]})`;
      reset.disabled = !changed;
      reset.style.opacity = changed ? '1' : '0.4';
      line.append(input, reset);
      row.append(label, line);
      return row;
    });
    const flash = this.button(feel.hurtFlash ? 'Clarão ao tomar dano: ligado' : 'Clarão ao tomar dano: desligado', () => set({ hurtFlash: !feel.hurtFlash }));
    flash.style.background = feel.hurtFlash ? '#2f6b3a' : '#3a2a18';
    return [this.caption('Padrão = o jogo de hoje: sem tremor, sem pausa, sem faíscas.'), ...rows, flash];
  }

  private rows(file: string, id: string): (HTMLElement | null)[] {
    const entry = this.entry(file, id);
    return entry ? entry.campos.map((f) => this.row(file, entry, f)) : [];
  }

  private readonly powerButtons: { el: HTMLButtonElement; on: () => boolean; text: string }[] = [];

  private paintPowers(): void {
    for (const p of this.powerButtons) {
      const on = p.on();
      p.el.textContent = on ? `${p.text}: ligado` : p.text;
      p.el.style.background = on ? '#2f6b3a' : '#3a2a18';
    }
  }

  private render(): void {
    if (!this.data) return;
    const monsters = this.group('monstros')?.lista ?? [];
    if (!monsters.some((m) => m.id === this.monster)) this.monster = monsters[0]?.id ?? '';

    // atalhos: os poderes do menu ADM e criar bichos
    this.powerButtons.length = 0;
    const power = (text: string, on: () => boolean, cmd: (next: boolean) => GmCommand) => {
      const el = this.button(text, () => {
        const local = text === 'Hitboxes'; // só da tela: não é poder do servidor
        const command = cmd(!on());
        if (!local) this.hooks.gm(command);
        this.paintPowers();
      });
      this.powerButtons.push({ el, on, text });
      return el;
    };
    const powers = document.createElement('div');
    powers.append(
      power('Modo deus', () => this.hooks.powers().god, (on) => ({ do: 'god', on })),
      power('Sem recarga', () => this.hooks.powers().nocd, (on) => ({ do: 'nocd', on })),
      power('Voar', () => this.hooks.powers().fly, (on) => ({ do: 'fly', on })),
      this.button('Curar', () => this.hooks.gm({ do: 'heal' })),
      power('Hitboxes', () => this.showBoxes, (on) => {
        this.showBoxes = on;
        this.hooks.hitboxes(on);
        if (on) this.say('Vermelho: onde o tiro acerta · branco: a caixa do pé · laranja: onde o bicho percebe você · cinza/amarelo: o que bloqueia (amarelo segura tiro)');
        return { do: 'heal' }; // (não manda nada de verdade: veja o gm abaixo)
      }),
    );
    const pick = document.createElement('select');
    for (const m of monsters) pick.append(new Option(m.nome, m.id));
    pick.value = this.monster;
    Object.assign(pick.style, { margin: '2px', padding: '3px', background: '#2a1e12', color: '#f3e6cf', border: '1px solid #8a6a3a', borderRadius: '6px', font: 'inherit' });
    pick.addEventListener('change', () => {
      this.monster = pick.value;
      this.render();
    });
    const spawn = (n: number) => {
      // o servidor cria até 10 por pedido: a horda vai em vários
      for (let left = n; left > 0; left -= 10) this.hooks.gm({ do: 'spawn', monster: this.monster, n: Math.min(10, left) });
      this.say(`Pedi ${n} × ${monsters.find((m) => m.id === this.monster)?.nome ?? this.monster} (até 60 criados por mapa)`);
    };
    const spawns = document.createElement('div');
    spawns.append(pick, this.button('+1', () => spawn(1)), this.button('+10', () => spawn(10)), this.button('Horda 50', () => spawn(50)), this.button('Derrubar perto', () => this.hooks.gm({ do: 'clear' })));
    const time = document.createElement('div');
    time.append(
      this.button('Dia', () => this.hooks.gm({ do: 'time', phase: 'dia' })),
      this.button('Tarde', () => this.hooks.gm({ do: 'time', phase: 'tarde' })),
      this.button('Noite', () => this.hooks.gm({ do: 'time', phase: 'noite' })),
    );

    const weapon = this.hooks.weapon();
    const weaponEntry = weapon ? this.entry('itens', weapon) : undefined;
    const bicho = this.entry('monstros', this.monster);

    const save = document.createElement('div');
    save.append(
      this.button('Copiar valores', () => void this.copy()),
      this.button('Resetar tudo', () => void this.resetAll()),
    );

    this.body.replaceChildren(
      this.section('Atalhos', powers, spawns, time),
      this.section(
        'Jogador',
        ...this.rows('combate', 'jogador'),
        this.caption(weaponEntry ? `Arma na mão: ${weaponEntry.nome}` : 'Sem arma de tiro na mão: vale a pedra (abaixo)'),
        ...(weapon ? this.rows('itens', weapon) : []),
        this.caption('Puxada (pedra com carga) e atirar andando'),
        ...this.rows('combate', 'carga'),
      ),
      this.section('Defesa e empurrão', ...this.rows('combate', 'defesa'), ...this.rows('combate', 'recuo')),
      this.section(`Bicho: ${bicho?.nome ?? '—'}`, this.caption('Escolha o bicho em Atalhos. Vida nova vale para os que nascerem depois.'), ...this.rows('monstros', this.monster)),
      this.section('Dia e noite', ...this.rows('combate', 'noite')),
      this.section('Game feel (só nesta tela)', ...this.feelRows()),
      this.section('Salvar', save),
    );
    this.paintPowers();
  }

  /** Copia só o que foi mudado, no formato dos ajustes (para colar num chat e virar o padrão do projeto). */
  private async copy(): Promise<void> {
    try {
      const res = await fetch('/admin/api/exportar', { cache: 'no-store' });
      const feel = changedFeel(this.hooks.feel());
      const all = { ...((await res.json()) as Record<string, unknown>), ...(Object.keys(feel).length > 0 ? { gameFeel: feel } : {}) };
      const text = JSON.stringify(all, null, 2);
      await navigator.clipboard.writeText(text);
      this.say('Copiado: é só colar no chat.');
    } catch (error) {
      this.say(`Não consegui copiar: ${(error as Error).message}`, true);
    }
  }

  /** Volta ao padrão tudo o que foi mudado (pede para clicar de novo, para não ser sem querer). */
  private confirmResetUntil = 0;
  private async resetAll(): Promise<void> {
    if (!this.data) return;
    const changed = this.data.grupos.flatMap((g) => g.lista.flatMap((e) => e.campos.filter((f) => f.ajustado).map((f) => ({ arquivo: g.arquivo, id: e.id, campo: f.campo }))));
    const feelChanged = Object.keys(changedFeel(this.hooks.feel())).length > 0;
    if (changed.length === 0 && !feelChanged) return this.say('Nada foi mudado: já está tudo no padrão.');
    if (performance.now() > this.confirmResetUntil) {
      this.confirmResetUntil = performance.now() + 4000;
      return this.say(`São ${changed.length} ajustes (inclusive os feitos no painel)${feelChanged ? ' e o game feel' : ''}. Clique de novo em "Resetar tudo" para confirmar.`, true);
    }
    this.confirmResetUntil = 0;
    this.hooks.setFeel({ ...DEFAULT_FEEL });
    let failed = 0;
    for (const change of changed) if (!(await this.post('/admin/api/padrao', change)).ok) failed += 1;
    this.say(failed ? `${failed} não voltaram ao padrão.` : `Tudo no padrão (${changed.length} ajustes desfeitos).`, failed > 0);
    await this.load();
  }

  /**
   * A que distância (em metros) este tipo de bicho percebe o jogador, ou 0 se não ataca sozinho. Dos números do painel
   * (lidos ao abrir e a cada ajuste), então acompanha o slider na hora.
   */
  aggroOf(type: string): number {
    const fields = this.entry('monstros', type)?.campos;
    if (!fields || fields.find((f) => f.campo === 'agressivo')?.valor !== true) return 0;
    const range = fields.find((f) => f.campo === 'alcanceAgressao')?.valor;
    return typeof range === 'number' ? range : 0;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true);
    this.root.remove();
  }
}
