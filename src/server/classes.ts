// Lê as classes de data/classes.json (pedido do dono, 14/11: a classe Caçador da Floresta e as habilidades dela). Como
// nos outros arquivos de dados, as chaves são em português para quem não programa poder ajustar; aqui elas viram tipos
// do código e são conferidas. Habilidade sem "tipo" ainda não existe no jogo: aparece como "em breve".

import { readFileSync } from 'node:fs';
import type { ClassInfo, ClassSkillInfo, ClassSkillKind, SkillPointInfo } from '../shared/classes';
import { MAX_LEVEL } from '../shared/progression';
import type { QuestInfo } from '../shared/quests';
import { Reader } from './data-reader';
import { CLASSES_FILE } from './paths';

const FILE = 'data/classes.json';
const KINDS: readonly ClassSkillKind[] = ['chuva', 'flecha', 'olhos'];
/** No máximo tantos pontos numa habilidade (o dono combinou 5; a lista "pontos" diz quantos). */
const MAX_POINTS = 10;

function key(rawId: string, example: string): string {
  const id = rawId.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(id)) {
    throw new Error(`Erro em ${FILE}: o id "${rawId}" só pode ter letras sem acento, números, _ ou - (ex.: "${example}").`);
  }
  return id;
}

function objectOf(raw: unknown, where: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`Erro em ${FILE}: ${where} precisa ser um objeto { ... }.`);
  return raw as Record<string, unknown>;
}

function whole(r: Reader, field: string, min: number, max: number, fallback?: number): number {
  const value = r.number(field, { min, fallback });
  if (!Number.isInteger(value) || value > max) r.fail(field, `precisa ser um número inteiro de ${min} a ${max}`);
  return value;
}

function upTo(r: Reader, field: string, min: number, max: number, fallback?: number): number {
  const value = r.number(field, { min, fallback });
  if (value > max) r.fail(field, `precisa ser no máximo ${max}`);
  return value;
}

function parseSkill(rawId: string, raw: unknown, className: string): ClassSkillInfo {
  const id = key(rawId, 'chuva_de_flechas');
  const where = `habilidade "${rawId}" da classe "${className}"`;
  const r = new Reader(objectOf(raw, `a ${where}`), FILE, where);
  const base = { id, name: r.text('nome'), description: r.text('descricao'), level: whole(r, 'nivel', 1, MAX_LEVEL) };
  if (!r.has('tipo')) return { ...base, kind: null, cooldownMs: 0, range: 0, delayMs: 0, speed: 0, width: 0, points: [] };
  const kind = r.text('tipo').toLowerCase() as ClassSkillKind;
  if (!KINDS.includes(kind)) r.fail('tipo', `precisa ser ${KINDS.map((k) => `"${k}"`).join(' ou ')} (ou ficar de fora: a habilidade aparece como "em breve")`);
  const list = r.list('pontos');
  if (list.length < 1 || list.length > MAX_POINTS) r.fail('pontos', `precisa ser uma lista de 1 a ${MAX_POINTS} pontos (o primeiro é com 1 ponto)`);
  const points = list.map((value, i): SkillPointInfo => {
    const p = new Reader(objectOf(value, `o ponto ${i + 1} da ${where}`), FILE, `ponto ${i + 1} da ${where}`);
    const none = { damagePct: 0, arrows: 0, radius: 0, markPct: 0, markMs: 0, burstRadius: 0, burstPct: 0, durationMs: 0, visionPct: 0, bonusPct: 0 };
    if (kind === 'olhos') {
      // os Olhos não acertam ninguém: quanto tempo duram, quanto a mais se enxerga e (se quiser) o dano a mais
      return {
        ...none,
        durationMs: Math.round(upTo(p, 'duracaoSegundos', 1, 120) * 1000),
        visionPct: upTo(p, 'visaoPorcento', 0, 200),
        bonusPct: p.has('danoExtraPorcento') ? upTo(p, 'danoExtraPorcento', 0, 200) : 0,
      };
    }
    const point: SkillPointInfo = { ...none, damagePct: upTo(p, 'danoPorcento', 1, 1000) };
    if (kind === 'chuva') return { ...point, arrows: whole(p, 'flechas', 1, 40), radius: upTo(p, 'raio', 0.5, 8) };
    // flecha: a marca (os dois campos juntos) e a explosão no fim (os dois juntos), cada uma só se tiver
    if (p.has('marcaPorcento') || p.has('marcaSegundos')) {
      point.markPct = upTo(p, 'marcaPorcento', 1, 200);
      point.markMs = Math.round(upTo(p, 'marcaSegundos', 0.5, 30) * 1000);
    }
    if (p.has('explosaoRaio') || p.has('explosaoPorcento')) {
      point.burstRadius = upTo(p, 'explosaoRaio', 0.5, 6);
      point.burstPct = upTo(p, 'explosaoPorcento', 1, 1000);
    }
    return point;
  });
  return {
    ...base,
    kind,
    cooldownMs: Math.round(upTo(r, 'recargaSegundos', 1, 600) * 1000),
    range: kind === 'olhos' ? 0 : upTo(r, 'alcance', 1, 30),
    delayMs: kind === 'chuva' ? Math.round(upTo(r, 'demoraMs', 0, 5000)) : 0,
    speed: kind === 'flecha' ? upTo(r, 'velocidade', 5, 60) : 0,
    width: kind === 'flecha' ? upTo(r, 'largura', 0.3, 3, 0.8) : 0,
    points,
  };
}

export function parseClassDefs(json: unknown): Map<string, ClassInfo> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error(`Erro em ${FILE}: o arquivo precisa ser um objeto { "id-da-classe": { ... } }.`);
  }
  const classes = new Map<string, ClassInfo>();
  for (const [rawId, raw] of Object.entries(json as Record<string, unknown>)) {
    const id = key(rawId, 'cacador');
    const where = `classe "${rawId}"`;
    const r = new Reader(objectOf(raw, `a ${where}`), FILE, where);
    const skillsRaw = r.object('habilidades')!;
    const skills = Object.entries(skillsRaw).map(([skillId, skill]) => parseSkill(skillId, skill, rawId));
    if (skills.length === 0) r.fail('habilidades', 'precisa ter pelo menos uma habilidade');
    const unlock = r.optionalText('liberaDepoisDe').toLowerCase();
    classes.set(id, {
      id,
      name: r.text('nome'),
      description: r.text('descricao'),
      unlockQuest: unlock || null,
      levelsBetweenPoints: whole(r, 'niveisEntrePontos', 0, 10, 2),
      skills,
    });
  }
  return classes;
}

/** Confere se a missão que libera cada classe existe (o painel pode mudar as missões, mas não apagar). */
export function checkClasses(classes: ReadonlyMap<string, ClassInfo>, quests: ReadonlyMap<string, QuestInfo>): void {
  for (const cls of classes.values()) {
    if (cls.unlockQuest && !quests.has(cls.unlockQuest)) {
      throw new Error(`Erro em ${FILE} (classe "${cls.id}"): "liberaDepoisDe" é "${cls.unlockQuest}", que não é uma missão de data/missoes.json.`);
    }
  }
}

export function loadClassDefs(file = CLASSES_FILE): Map<string, ClassInfo> {
  return parseClassDefs(JSON.parse(readFileSync(file, 'utf8')));
}
