// Liga tudo: servidor HTTP (entrega o jogo pronto), WebSocket (tempo real) e o relógio do mundo.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import sirv from 'sirv';
import { WebSocketServer, type WebSocket } from 'ws';
import { TICK_MS } from '../shared/constants';
import { GameMap, type TiledMap } from '../shared/map';
import { nameKey } from '../shared/names';
import { CharacterStore, type HashCost } from './accounts';
import { createAdminHandler } from './admin';
import { Logbook } from './logbook';
import { LoginGuard, type GuardLimits } from './login-guard';
import { CLIENT_DIR, ISO_MAPS_DIR, MAPS_DIR } from './paths';
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
  /** Mapa onde os personagens novos começam (para testar um mapa novo); sem isto, o que tem `inicial`. */
  startMap?: string;
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
  /** Os registros (tela, arquivo do dia e a aba Registros do painel). */
  logbook: Logbook;
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

/**
 * Lê todos os mapas: os de public/assets/maps (o mundo de hoje) e os de public/assets/maps-iso (o mundo 2.5D novo,
 * no formato novo). Os ids (nome do arquivo) não podem se repetir entre as pastas.
 */
export function loadMaps(dirs: string | string[] = [MAPS_DIR, ISO_MAPS_DIR]): GameMap[] {
  return (Array.isArray(dirs) ? dirs : [dirs])
    .filter((dir) => existsSync(dir))
    .flatMap((dir) =>
      readdirSync(dir)
        .filter((file) => file.endsWith('.tmj'))
        .sort()
        .map((file) => loadMap(file.slice(0, -4), dir)),
    );
}

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  // registros: na tela, num arquivo por dia ao lado dos personagens salvos (saves/registros) e na aba do painel
  const logbook = new Logbook({
    dir: options.log === false || options.saveFile === ':memory:' ? null : path.join(path.dirname(options.saveFile), 'registros'),
    console: options.log !== false,
  });
  const log = logbook.write;
  const maps = loadMaps();
  // Monstros, itens, NPCs, áreas e missões: os arquivos de data/ (e os mapas) com os ajustes do painel por cima (tudo conferido).
  const tuningFile =
    options.tuningFile !== undefined ? options.tuningFile : options.saveFile === ':memory:' ? null : path.join(path.dirname(options.saveFile), 'ajustes.json');
  const tuning = Tuning.load(tuningFile, maps, log);
  const store = new CharacterStore(options.saveFile, { cost: options.hashCost });
  const realm = new Realm(maps, {
    log,
    monsters: tuning.monsters,
    items: tuning.items,
    npcs: tuning.npcs,
    areas: tuning.areas,
    quests: tuning.quests,
    combat: tuning.combat,
    saver: store,
    startMap: options.startMap,
    // menu ADM "trazer para cá": vira um ajuste do painel (mapa, x e y juntos)
    setNpcSpot: (npc, map, x, y) => {
      const result = tuning.setMany('npcs', npc, { mapa: map, x, y });
      return result.ok ? null : result.erro;
    },
  });
  tuning.onChange = (changed) => realm.tuningChanged(changed);
  const sessions = new Set<Session>();
  const guard = new LoginGuard(() => performance.now(), options.guardLimits);
  const admin = createAdminHandler({
    tuning,
    realm,
    log,
    logs: (limit, filter) => logbook.recent(limit, filter),
    logDir: logbook.dir,
    setAdmin: (name, admin) => {
      const saved = store.setAdmin(name, admin);
      if (saved) realm.setAdmin(saved, admin); // se ele está jogando, vale na hora
      return saved;
    },
    admins: () => store.admins(),
    setPassword: async (name, password) => {
      const saved = await store.setPassword(name, password);
      if (saved) guard.forgive(nameKey(saved)); // as tentativas erradas de antes não travam a senha nova
      return saved;
    },
    kick: (playerId) => {
      for (const session of sessions) {
        if (session.playerId === playerId) {
          session.end('kicked');
          return true;
        }
      }
      return false;
    },
  });
  const world = realm.start;
  const lobby: Lobby = {
    realm,
    store,
    guard,
    online: new Map(),
    log,
  };

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
      try {
        session.handle(data.toString());
      } catch (error) {
        // um defeito ao tratar uma mensagem fica anotado (com o caminho do erro) e não derruba o servidor
        logbook.error(`ao tratar uma mensagem de ${session.playerName ?? 'alguém entrando'}`, error);
      }
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

  const ticker = setInterval(() => {
    try {
      realm.tick();
    } catch (error) {
      logbook.error('no passo do mundo (tick)', error); // anotado; o mundo continua no próximo passo
    }
  }, TICK_MS);

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
    logbook,
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
