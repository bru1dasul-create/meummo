// Liga tudo: servidor HTTP (entrega o jogo pronto), WebSocket (tempo real) e o relógio do mundo.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import sirv from 'sirv';
import { WebSocketServer, type WebSocket } from 'ws';
import { TICK_MS } from '../shared/constants';
import { GameMap, type TiledMap } from '../shared/map';
import { CharacterStore, type HashCost } from './accounts';
import { createAdminHandler } from './admin';
import { LoginGuard, type GuardLimits } from './login-guard';
import { CLIENT_DIR, MAPS_DIR } from './paths';
import { Realm } from './realm';
import { Session, type Lobby } from './session';
import { Tuning } from './tuning';
import type { World } from './world';

export { MAPS_DIR, ROOT, SAVE_FILE } from './paths';
const HEARTBEAT_MS = 30_000;

export interface ServerOptions {
  port: number;
  host?: string;
  /** false = sem mensagens no terminal (usado nos testes). */
  log?: boolean;
  /** Arquivo dos personagens salvos (SAVE_FILE no jogo de verdade; ':memory:' nos testes). */
  saveFile: string;
  /** Custo para proteger as senhas (os testes usam um menor, para rodar rápido). */
  hashCost?: HashCost;
  /** Limites de tentativas de senha e de personagens novos. */
  guardLimits?: GuardLimits;
  /**
   * Onde o painel do administrador guarda os ajustes. Padrão: ajustes.json ao lado do arquivo dos personagens
   * (saves/ajustes.json); null = só na memória (testes com ':memory:').
   */
  tuningFile?: string | null;
}

export interface RunningServer {
  port: number;
  /** Todos os mapas. */
  realm: Realm;
  /** Os ajustes do painel do administrador. */
  tuning: Tuning;
  /** O mapa inicial (onde os personagens novos começam). */
  world: World;
  close(): Promise<void>;
}

/** Lê um mapa pelo id (o nome do arquivo em public/assets/maps, sem .tmj). */
export function loadMap(id = 'refugio', dir = MAPS_DIR): GameMap {
  try {
    return GameMap.fromTiled(JSON.parse(readFileSync(path.join(dir, `${id}.tmj`), 'utf8')) as TiledMap, id);
  } catch (error) {
    throw new Error(`Erro no mapa "${id}.tmj": ${(error as Error).message}`);
  }
}

/** Lê todos os mapas de public/assets/maps. */
export function loadMaps(dir = MAPS_DIR): GameMap[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.tmj'))
    .sort()
    .map((file) => loadMap(file.slice(0, -4), dir));
}

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const log =
    options.log === false ? () => {} : (message: string) => console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${message}`);
  const maps = loadMaps();
  // Monstros, itens e NPCs: os arquivos de data/ com os ajustes do painel por cima (tudo conferido).
  const tuningFile =
    options.tuningFile !== undefined ? options.tuningFile : options.saveFile === ':memory:' ? null : path.join(path.dirname(options.saveFile), 'ajustes.json');
  const tuning = Tuning.load(tuningFile, maps, log);
  const store = new CharacterStore(options.saveFile, { cost: options.hashCost });
  const realm = new Realm(maps, { log, monsters: tuning.monsters, items: tuning.items, npcs: tuning.npcs, saver: store });
  tuning.onChange = (changed) => realm.tuningChanged(changed);
  const admin = createAdminHandler({ tuning, log });
  const world = realm.start;
  const lobby: Lobby = {
    realm,
    store,
    guard: new LoginGuard(() => performance.now(), options.guardLimits),
    online: new Map(),
    log,
  };
  const sessions = new Set<Session>();

  // Em produção (depois do `npm run build`) o próprio servidor entrega o jogo.
  // Em desenvolvimento quem entrega é o Vite (porta 5173).
  const serveClient = existsSync(path.join(CLIENT_DIR, 'index.html')) ? sirv(CLIENT_DIR, { single: true, etag: true }) : null;
  const httpServer = http.createServer((req, res) => {
    if (admin(req, res)) return; // painel do administrador (/admin): só no próprio computador
    if (serveClient) return serveClient(req, res);
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(
      'Servidor do MeuMMO rodando.\n' +
        'O jogo ainda não foi compilado: use "npm run dev" e abra http://localhost:5173,\n' +
        'ou rode "npm run build" antes de "npm start".\n',
    );
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 4 * 1024 });
  const alive = new WeakMap<WebSocket, boolean>();

  wss.on('connection', (ws, req) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    const transport = {
      send: (data: string) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      },
      close: (code: number, reason: string) => ws.close(code, reason),
    };
    const session = new Session(lobby, transport, req.socket.remoteAddress ?? 'desconhecido');
    sessions.add(session);
    ws.on('message', (data, isBinary) => {
      if (isBinary) return ws.close(1003, 'binario nao suportado');
      session.handle(data.toString());
    });
    ws.on('close', () => {
      session.disconnect();
      sessions.delete(session);
    });
    ws.on('error', (err) => log(`erro numa conexão: ${err.message}`));
  });

  // Derruba conexões "zumbis" (o navegador sumiu sem avisar).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_MS);

  const ticker = setInterval(() => realm.tick(), TICK_MS);

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(options.port, options.host, () => resolve());
  });
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : options.port;
  log(
    `servidor no ar em http://localhost:${port} (mapas: ` +
      [...realm.worlds.values()].map((w) => `${w.map.name} ${w.map.width}x${w.map.height}, ${w.monsters.size} monstros`).join('; ') +
      ` — ${store.count()} personagens salvos)`,
  );

  let closing: Promise<void> | null = null;
  return {
    port,
    realm,
    tuning,
    world,
    close: () =>
      (closing ??= (async () => {
        clearInterval(heartbeat);
        clearInterval(ticker);
        // Todo mundo sai do mundo do jeito certo (e é salvo) antes de desligar.
        for (const session of sessions) session.end('shutdown');
        realm.saveAll();
        await new Promise((resolve) => setTimeout(resolve, 100)); // deixa o aviso de "desligando" chegar
        for (const ws of wss.clients) ws.terminate();
        wss.close();
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
        store.close();
      })()),
  };
}
