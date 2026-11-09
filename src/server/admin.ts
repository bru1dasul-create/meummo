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
import { ROOT } from './paths';
import { TUNING_FILES, type Tuning, type TuningFile } from './tuning';

const PAGE_FILE = path.join(ROOT, 'src/server/admin/painel.html');
const MAX_BODY = 32 * 1024;
const LOCAL_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export interface AdminOptions {
  tuning: Tuning;
  log?: (message: string) => void;
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
