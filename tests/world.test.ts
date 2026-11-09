import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_QUEUED_STEPS, PROTOCOL_VERSION, STEP_MS, TICK_MS, VIEW_RADIUS_X } from '../src/shared/constants';
import { DOWN, DOWN_LEFT, RIGHT, UP } from '../src/shared/dir';
import { GameMap } from '../src/shared/map';
import { Session } from '../src/server/session';
import { World, type Player } from '../src/server/world';
import { FakeClock, FakeConn, FakeTransport, makeLobby, sendHello, tiledFromAscii } from './helpers';

// Corredor largo: dá para testar a área de visão afastando os jogadores.
const map = GameMap.fromTiled(
  tiledFromAscii(
    [
      '.'.repeat(60),
      '.'.repeat(60),
      '....#' + '.'.repeat(55), // parede em (4, 2)
      '.'.repeat(60),
    ],
    { x: 2, y: 0 },
  ),
);

let clock: FakeClock;
let world: World;

function join(name: string): { player: Player; conn: FakeConn } {
  const conn = new FakeConn();
  const result = world.join(name, conn);
  if (!result.ok) throw new Error(`não entrou: ${result.reason}`);
  return { player: result.player, conn };
}

beforeEach(() => {
  clock = new FakeClock();
  world = new World(map, { now: clock.now, random: () => 0 });
});

describe('World — entrar e sair', () => {
  it('recusa nomes inválidos e repetidos (sem diferenciar maiúsculas)', () => {
    expect(world.join('A', new FakeConn())).toEqual({ ok: false, reason: 'name_invalid' });
    join('Lúcia');
    expect(world.join('LÚCIA', new FakeConn())).toEqual({ ok: false, reason: 'name_taken' });
  });

  it('envia boas-vindas com a posição inicial num tile livre', () => {
    const { player, conn } = join('Ana');
    const [welcome] = conn.ofType('welcome');
    expect(welcome?.id).toBe(player.id);
    expect(map.isWalkable(welcome!.you.x, welcome!.you.y)).toBe(true);
  });

  it('mostra quem está perto e avisa quando alguém sai', () => {
    const ana = join('Ana');
    const beto = join('Beto');
    world.tick();
    expect(ana.conn.ofType('spawn').map((m) => m.e.name)).toEqual(['Beto']);
    expect(beto.conn.ofType('spawn').map((m) => m.e.name)).toEqual(['Ana']);

    world.leave(beto.player);
    world.tick();
    expect(ana.conn.ofType('despawn')).toEqual([{ t: 'despawn', id: beto.player.id }]);
    expect(ana.conn.ofType('online').at(-1)).toEqual({ t: 'online', n: 1 });
  });
});

describe('World — movimento autoritativo', () => {
  it('não deixa andar mais rápido que a velocidade permitida', () => {
    const { player, conn } = join('Ana');
    const start = player.x;
    world.requestStep(player, 1, RIGHT);
    world.requestStep(player, 2, RIGHT);
    world.requestStep(player, 3, RIGHT);

    world.tick();
    expect(player.x).toBe(start + 1); // só um passo, mesmo com três pedidos

    clock.advance(TICK_MS);
    world.tick();
    expect(player.x).toBe(start + 1); // ainda não deu o tempo do passo

    clock.advance(STEP_MS - TICK_MS);
    world.tick();
    expect(player.x).toBe(start + 2);

    clock.advance(STEP_MS);
    world.tick();
    expect(player.x).toBe(start + 3);
    expect(conn.ofType('ack').at(-1)).toEqual({ t: 'ack', seq: 3, x: start + 3, y: player.y, dir: RIGHT });
  });

  it('anda na diagonal no ritmo certo (√2 mais devagar por passo)', () => {
    const { player } = join('Ana');
    const start = { x: player.x, y: player.y }; // (2, 0)
    world.requestStep(player, 1, DOWN_LEFT);
    world.requestStep(player, 2, DOWN_LEFT);
    world.tick();
    expect([player.x, player.y]).toEqual([start.x - 1, start.y + 1]);
    clock.advance(STEP_MS); // 200 ms ainda não basta para outra diagonal (283 ms)
    world.tick();
    expect([player.x, player.y]).toEqual([start.x - 1, start.y + 1]);
    clock.advance(100);
    world.tick();
    expect([player.x, player.y]).toEqual([start.x - 2, start.y + 2]);
  });

  it('bloqueia passos contra paredes, mas o personagem vira', () => {
    const { player } = join('Ana');
    player.x = 3;
    player.y = 2;
    world.requestStep(player, 1, RIGHT); // (4, 2) é parede
    world.tick();
    expect([player.x, player.y, player.dir]).toEqual([3, 2, RIGHT]);
  });

  it('ignora pedidos repetidos ou fora de ordem', () => {
    const { player } = join('Ana');
    world.requestStep(player, 5, UP);
    world.requestStep(player, 5, UP);
    world.requestStep(player, 4, DOWN);
    expect(player.queue).toEqual([{ seq: 5, dir: UP, dash: false }]);
  });

  it('descarta a fila e corrige o cliente quando chegam passos demais', () => {
    const { player, conn } = join('Ana');
    for (let seq = 1; seq <= MAX_QUEUED_STEPS + 1; seq++) world.requestStep(player, seq, RIGHT);
    expect(player.queue).toEqual([]);
    world.tick();
    expect(conn.ofType('ack').at(-1)?.seq).toBe(MAX_QUEUED_STEPS + 1);
  });

  it('avisa quem está vendo quando alguém anda', () => {
    const ana = join('Ana');
    const beto = join('Beto');
    world.tick();
    world.requestStep(beto.player, 1, DOWN);
    world.tick();
    expect(ana.conn.ofType('move').at(-1)).toMatchObject({ id: beto.player.id, x: beto.player.x, y: beto.player.y });
  });
});

describe('World — área de visão', () => {
  it('esconde quem está longe e mostra de novo quando se aproxima', () => {
    const ana = join('Ana');
    const beto = join('Beto');
    world.tick();
    ana.conn.clear();

    beto.player.x = ana.player.x + VIEW_RADIUS_X + 3; // longe demais
    beto.player.changed = true;
    world.tick();
    expect(ana.conn.ofType('despawn')).toEqual([{ t: 'despawn', id: beto.player.id }]);

    beto.player.x = ana.player.x + 1;
    world.tick();
    expect(ana.conn.ofType('spawn').map((m) => m.e.id)).toEqual([beto.player.id]);
  });
});

describe('World — chat', () => {
  it('entrega a mensagem limpa para todos e segura o spam', () => {
    const ana = join('Ana');
    const beto = join('Beto');
    world.chat(ana.player, '  oi\n‮gente  ');
    world.tick();
    expect(beto.conn.ofType('chat')).toEqual([{ t: 'chat', id: ana.player.id, name: 'Ana', text: 'oi gente' }]);

    for (let i = 0; i < 10; i++) world.chat(ana.player, `spam ${i}`);
    world.tick();
    expect(beto.conn.ofType('chat').length).toBeLessThan(6);
    expect(ana.conn.ofType('sys').some((m) => m.text.includes('rápido demais'))).toBe(true);
  });
});

describe('Session', () => {
  function session() {
    const lobby = makeLobby(map, clock);
    const transport = new FakeTransport();
    const s = new Session(lobby, transport, '10.0.0.1', clock.now);
    return { s, transport, lobby };
  }

  it('recusa versão de protocolo diferente', () => {
    const { s, transport } = session();
    s.handle(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION + 1, name: 'Ana', password: 'segredo1' }));
    expect(transport.batches).toEqual([[{ t: 'reject', reason: 'version' }]]);
    expect(transport.closed).toEqual([4000]);
  });

  it('entra, responde ping e remove o jogador ao desconectar', async () => {
    const { s, transport, lobby } = session();
    expect((await sendHello(s, transport, 'Ana', 'segredo1')).t).toBe('welcome');
    expect(lobby.realm.start.players.size).toBe(1);
    s.handle(JSON.stringify({ t: 'ping', id: 7 }));
    expect(transport.batches.at(-1)).toEqual([{ t: 'pong', id: 7 }]);
    s.disconnect();
    expect(lobby.realm.start.players.size).toBe(0);
  });

  it('desconecta quem manda lixo sem parar', () => {
    const { s, transport } = session();
    for (let i = 0; i < 25; i++) s.handle('isso não é json');
    expect(transport.closed).toEqual([4001]);
  });
});
