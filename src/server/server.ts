// Liga tudo: servidor HTTP (entrega o jogo pronto), WebSocket (tempo real) e o relógio do mundo.

import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sirv from 'sirv';
import { WebSocketServer, type WebSocket } from 'ws';
import { TICK_MS } from '../shared/constants';
import { GameMap, type TiledMap } from '../shared/map';
import { Session } from './session';
import { World } from './world';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const MAP_FILE = path.join(ROOT, 'public/assets/maps/world.tmj');
const CLIENT_DIR = path.join(ROOT, 'dist/client');
const HEARTBEAT_MS = 30_000;

export interface ServerOptions {
  port: number;
  host?: string;
  /** false = sem mensagens no terminal (usado nos testes). */
  log?: boolean;
}

export interface RunningServer {
  port: number;
  world: World;
  close(): Promise<void>;
}

export function loadMap(file = MAP_FILE): GameMap {
  return GameMap.fromTiled(JSON.parse(readFileSync(file, 'utf8')) as TiledMap);
}

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const log =
    options.log === false ? () => {} : (message: string) => console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${message}`);
  const world = new World(loadMap(), { log });

  // Em produção (depois do `npm run build`) o próprio servidor entrega o jogo.
  // Em desenvolvimento quem entrega é o Vite (porta 5173).
  const serveClient = existsSync(path.join(CLIENT_DIR, 'index.html')) ? sirv(CLIENT_DIR, { single: true, etag: true }) : null;
  const httpServer = http.createServer((req, res) => {
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

  wss.on('connection', (ws) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    const session = new Session(world, {
      send: (data) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      },
      close: (code, reason) => ws.close(code, reason),
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) return ws.close(1003, 'binario nao suportado');
      session.handle(data.toString());
    });
    ws.on('close', () => session.disconnect());
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

  const ticker = setInterval(() => world.tick(), TICK_MS);

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(options.port, options.host, () => resolve());
  });
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : options.port;
  log(`servidor no ar em http://localhost:${port} (mapa ${world.map.width}x${world.map.height})`);

  return {
    port,
    world,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(heartbeat);
        clearInterval(ticker);
        for (const ws of wss.clients) ws.terminate();
        wss.close();
        httpServer.close(() => resolve());
      }),
  };
}
