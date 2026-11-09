// Painel do administrador (http://localhost:3000/admin): ajustar o jogo sem mexer nos arquivos do projeto.
//
// Segurança (por enquanto o jogo roda no PC do dono, na rede de casa):
// - só abre no próprio computador onde o servidor está ligado (endereço de quem pede = esta máquina);
// - só pelo endereço localhost (protege contra sites que tentam se passar por "localhost");
// - pedidos que mudam alguma coisa precisam da marca X-MeuMMO-Admin e não podem vir de outro site;
// - a página não pode ser aberta dentro de outro site (contra cliques disfarçados).
// Quando o jogo for para a internet (M5), o painel ganha senha e conexão criptografada.

import { readFileSync } from 'node:fs';
import type http from 'node:http';
import path from 'node:path';
import { MAX_GOLD } from '../shared/items';
import { ROOT } from './paths';
import type { AdminResult, Realm } from './realm';
import { TUNING_FILES, type Tuning, type TuningFile } from './tuning';
import { sanitizeChat } from './validate';

const PAGE_FILE = path.join(ROOT, 'src/server/admin/painel.html');
const MAX_BODY = 32 * 1024;
const LOCAL_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export interface AdminOptions {
  tuning: Tuning;
  /** Para as ferramentas de jogadores (sem isto, só os ajustes). */
  realm?: Realm;
  /** Desconecta o jogador (expulsar). false = ele não estava mais online. */
  kick?: (playerId: number) => boolean;
  log?: (message: string) => void;
}

/** Ações que o painel pode fazer num jogador. */
type PlayerAction =
  | { acao: 'ouro'; id: number; quantidade: number }
  | { acao: 'item'; id: number; item: string; quantidade: number }
  | { acao: 'curar'; id: number }
  | { acao: 'levar'; id: number; mapa: string; x?: number; y?: number }
  | { acao: 'expulsar'; id: number };

const MAX_ITEMS_GIVEN = 999;

function whole(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

/** Confere o pedido de ação num jogador (null = pedido estranho). */
function parsePlayerAction(body: unknown): PlayerAction | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!whole(b.id, 1, Number.MAX_SAFE_INTEGER)) return null;
  const id = b.id;
  switch (b.acao) {
    case 'ouro':
      return whole(b.quantidade, 1, MAX_GOLD) ? { acao: 'ouro', id, quantidade: b.quantidade } : null;
    case 'item':
      return typeof b.item === 'string' && /^[a-z0-9_-]{1,40}$/.test(b.item) && whole(b.quantidade, 1, MAX_ITEMS_GIVEN)
        ? { acao: 'item', id, item: b.item, quantidade: b.quantidade }
        : null;
    case 'curar':
      return { acao: 'curar', id };
    case 'expulsar':
      return { acao: 'expulsar', id };
    case 'levar': {
      if (typeof b.mapa !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(b.mapa)) return null;
      const hasX = b.x !== undefined && b.x !== null;
      const hasY = b.y !== undefined && b.y !== null;
      if (hasX !== hasY) return null; // as duas coordenadas, ou nenhuma
      if (hasX && (!whole(b.x, 0, 9999) || !whole(b.y, 0, 9999))) return null;
      return hasX ? { acao: 'levar', id, mapa: b.mapa, x: b.x as number, y: b.y as number } : { acao: 'levar', id, mapa: b.mapa };
    }
    default:
      return null;
  }
}

/** Por que este pedido não pode usar o painel (null = pode). */
export function accessProblem(req: Pick<http.IncomingMessage, 'method' | 'headers' | 'socket'>): string | null {
  const remote = req.socket.remoteAddress ?? '';
  if (!LOCAL_ADDRESSES.has(remote)) return 'o painel só abre no computador onde o jogo está ligado (http://localhost:3000/admin).';
  if (!LOCAL_HOST.test(req.headers.host ?? '')) return 'abra o painel pelo endereço http://localhost:3000/admin.';
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.headers['x-meummo-admin'] !== '1') return 'pedido sem a marca do painel.';
    const origin = req.headers.origin;
    if (origin !== undefined && !LOCAL_ORIGIN.test(origin)) return 'pedido vindo de outro site.';
  }
  return null;
}

const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

function send(res: http.ServerResponse, status: number, body: string, type: string, extra: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': type, ...SECURITY_HEADERS, ...extra });
  res.end(body);
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  send(res, status, JSON.stringify(data), 'application/json; charset=utf-8');
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('pedido grande demais'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('pedido em formato estranho'));
      }
    });
    req.on('error', reject);
  });
}

/** O que o painel manda para mudar (ou voltar ao padrão) um campo. */
function parseChange(body: unknown): { arquivo: TuningFile; id: string; campo: string; valor?: unknown } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { arquivo, id, campo, valor } = body as Record<string, unknown>;
  if (!TUNING_FILES.includes(arquivo as TuningFile)) return null;
  if (typeof id !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(id)) return null;
  if (typeof campo !== 'string' || !/^[a-zA-Z.]{1,40}$/.test(campo)) return null;
  return { arquivo: arquivo as TuningFile, id, campo, valor };
}

/** Cuida dos endereços /admin...; devolve false para os outros (o servidor segue com o jogo). */
export function createAdminHandler(options: AdminOptions): (req: http.IncomingMessage, res: http.ServerResponse) => boolean {
  const { tuning } = options;
  const log = options.log ?? (() => {});
  return (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/admin' && !url.pathname.startsWith('/admin/')) return false;

    const denied = accessProblem(req);
    if (denied) {
      send(res, 403, `Painel do administrador: ${denied}\n`, 'text/plain; charset=utf-8');
      return true;
    }

    const route = `${req.method} ${url.pathname}`;
    if (route === 'GET /admin' || route === 'GET /admin/') {
      let page: string;
      try {
        page = readFileSync(PAGE_FILE, 'utf8');
      } catch (error) {
        send(res, 500, `Não achei a página do painel: ${(error as Error).message}\n`, 'text/plain; charset=utf-8');
        return true;
      }
      send(res, 200, page, 'text/html; charset=utf-8', {
        'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
      return true;
    }
    if (route === 'GET /admin/api/dados') {
      sendJson(res, 200, tuning.view());
      return true;
    }
    if (route === 'GET /admin/api/exportar') {
      sendJson(res, 200, tuning.exportOverrides());
      return true;
    }
    const { realm } = options;
    if (route === 'GET /admin/api/jogadores' && realm) {
      sendJson(res, 200, {
        jogadores: realm.playersOnline(),
        mapas: [...realm.worlds.values()].map((w) => ({ id: w.map.id, nome: w.map.name, largura: w.map.width, altura: w.map.height })),
        itens: [...tuning.items.values()].map((i) => ({ id: i.id, nome: i.name })),
      });
      return true;
    }
    if (route === 'POST /admin/api/jogador' && realm) {
      readBody(req)
        .then((body) => {
          const action = parsePlayerAction(body);
          if (!action) return sendJson(res, 400, { ok: false, erro: 'Pedido incompleto ou com números fora do limite.' });
          const result = runPlayerAction(action, realm, tuning, options.kick);
          if (result.ok) log(`painel: ${result.texto}`);
          sendJson(res, result.ok ? 200 : 400, result);
        })
        .catch((error: Error) => sendJson(res, 400, { ok: false, erro: error.message }));
      return true;
    }
    if (route === 'POST /admin/api/aviso' && realm) {
      readBody(req)
        .then((body) => {
          const raw = (body as { texto?: unknown } | null)?.texto;
          const text = typeof raw === 'string' ? sanitizeChat(raw) : '';
          if (!text) return sendJson(res, 400, { ok: false, erro: 'Escreva o aviso.' });
          realm.notice(text);
          log(`painel: aviso para todos: ${text}`);
          sendJson(res, 200, { ok: true, texto: `Aviso enviado para ${realm.online} ${realm.online === 1 ? 'jogador' : 'jogadores'}.` });
        })
        .catch((error: Error) => sendJson(res, 400, { ok: false, erro: error.message }));
      return true;
    }
    if (route === 'POST /admin/api/ajustar' || route === 'POST /admin/api/padrao') {
      const reset = url.pathname.endsWith('/padrao');
      readBody(req)
        .then((body) => {
          const change = parseChange(body);
          if (!change) return sendJson(res, 400, { ok: false, erro: 'Pedido incompleto.' });
          const result = reset
            ? tuning.reset(change.arquivo, change.id, change.campo)
            : tuning.set(change.arquivo, change.id, change.campo, change.valor);
          if (result.ok) {
            log(
              reset
                ? `painel: ${change.arquivo} › ${change.id} › ${change.campo} voltou ao padrão`
                : `painel: ${change.arquivo} › ${change.id} › ${change.campo} = ${JSON.stringify(change.valor)}`,
            );
          }
          sendJson(res, result.ok ? 200 : 400, result);
        })
        .catch((error: Error) => sendJson(res, 400, { ok: false, erro: error.message }));
      return true;
    }
    send(res, 404, 'Não existe esta página no painel.\n', 'text/plain; charset=utf-8');
    return true;
  };
}

function runPlayerAction(action: PlayerAction, realm: Realm, tuning: Tuning, kick?: (id: number) => boolean): AdminResult {
  switch (action.acao) {
    case 'ouro':
      return realm.adminGiveGold(action.id, action.quantidade);
    case 'item': {
      const def = tuning.items.get(action.item);
      if (!def) return { ok: false, erro: `O item "${action.item}" não existe.` };
      return realm.adminGiveItem(action.id, def, action.quantidade);
    }
    case 'curar':
      return realm.adminHeal(action.id);
    case 'levar':
      return realm.adminMove(action.id, action.mapa, action.x, action.y);
    case 'expulsar': {
      const name = realm.playersOnline().find((p) => p.id === action.id)?.nome;
      if (!name || !kick?.(action.id)) return { ok: false, erro: 'Esse jogador não está mais online.' };
      return { ok: true, texto: `Desconectei ${name} (o progresso fica salvo e pode entrar de novo).` };
    }
  }
}
