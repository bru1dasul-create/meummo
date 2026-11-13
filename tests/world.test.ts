import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_QUEUED_WALKS, PROTOCOL_VERSION, TICK_MS, VIEW_RADIUS_X, WALK_BUDGET_MAX_MS, WALK_SLICE_MS } from '../src/shared/constants';
import { DOWN, DOWN_RIGHT, RIGHT, UP } from '../src/shared/dir';
import { GameMap } from '../src/shared/map';
import { Session } from '../src/server/session';
import { World, type Player } from '../src/server/world';
import { deg, FakeClock, FakeConn, FakeTransport, makeLobby, sendHello, tiledFromAscii } from './helpers';

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

describe('World — movimento autoritativo (movimento livre)', () => {
  const slice = 0.25; // um pedaço de caminhada (50 ms) a 5 tiles por segundo

  it('não deixa andar mais rápido que a velocidade permitida', () => {
    const { player } = join('Ana');
    const start = player.fx;
    for (let seq = 1; seq <= 10; seq++) world.requestWalk(player, seq, deg(RIGHT)); // 500 ms de caminhada de uma vez
    world.tick();
    expect(player.fx).toBe(start + slice); // acabou de entrar: só o pedaço deste tick
    clock.advance(TICK_MS);
    world.tick();
    expect(player.fx).toBe(start + 2 * slice); // um pedaço por tick, no ritmo do relógio
    clock.advance(TICK_MS / 2);
    world.tick();
    expect(player.fx).toBe(start + 2 * slice); // meio tick não paga outro pedaço
  });

  it('pedidos que a rede atrasou passam juntos, mas só até a folga', () => {
    const { player } = join('Ana');
    for (let t = 0; t < 1000; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick(); // parado um tempo: a folga enche até o limite
    }
    const start = player.fx;
    for (let seq = 1; seq <= 8; seq++) world.requestWalk(player, seq, deg(RIGHT));
    clock.advance(TICK_MS);
    world.tick();
    expect(player.fx).toBe(start + (WALK_BUDGET_MAX_MS / WALK_SLICE_MS) * slice);
    expect(player.queue.length).toBe(8 - WALK_BUDGET_MAX_MS / WALK_SLICE_MS);
  });

  it('anda solto na diagonal, na mesma velocidade', () => {
    const { player } = join('Ana');
    const start = { x: player.fx, y: player.fy };
    for (let seq = 1; seq <= 4; seq++) {
      world.requestWalk(player, seq, deg(DOWN_RIGHT));
      clock.advance(TICK_MS);
      world.tick();
    }
    expect(Math.hypot(player.fx - start.x, player.fy - start.y)).toBeCloseTo(1, 2);
    expect(player.dir).toBe(DOWN_RIGHT);
  });

  it('para encostado na parede, mas o personagem vira', () => {
    const { player } = join('Ana');
    player.x = 3;
    player.y = 2;
    for (let seq = 1; seq <= 3; seq++) {
      world.requestWalk(player, seq, deg(RIGHT)); // (4, 2) é parede
      clock.advance(TICK_MS);
      world.tick();
    }
    expect([player.x, player.y, player.dir]).toEqual([3, 2, RIGHT]);
    expect(player.fx).toBeGreaterThan(3); // chegou perto da parede
  });

  it('ignora pedidos repetidos ou fora de ordem', () => {
    const { player } = join('Ana');
    world.requestWalk(player, 5, deg(UP));
    world.requestWalk(player, 5, deg(UP));
    world.requestWalk(player, 4, deg(DOWN));
    expect(player.queue).toEqual([{ seq: 5, a: deg(UP), dash: false, slow: false, guard: false }]);
  });

  it('descarta a fila e corrige o cliente quando chegam pedidos demais', () => {
    const { player, conn } = join('Ana');
    for (let seq = 1; seq <= MAX_QUEUED_WALKS + 1; seq++) world.requestWalk(player, seq, deg(RIGHT));
    expect(player.queue).toEqual([]);
    world.tick();
    expect(conn.ofType('ack').at(-1)?.seq).toBe(MAX_QUEUED_WALKS + 1);
  });

  it('confirma a posição exata e avisa quem está vendo', () => {
    const ana = join('Ana');
    const beto = join('Beto');
    world.tick();
    world.requestWalk(beto.player, 1, deg(DOWN));
    world.tick();
    expect(beto.conn.ofType('ack').at(-1)).toMatchObject({ seq: 1, x: beto.player.fx, y: beto.player.fy });
    expect(ana.conn.ofType('move').at(-1)).toMatchObject({ id: beto.player.id, x: beto.player.fx, y: beto.player.fy });
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

  it('andar sem parar (20 pedidos por segundo, com tiro e ping) não derruba ninguém', async () => {
    const { s, transport } = session();
    expect((await sendHello(s, transport, 'Ana', 'segredo1')).t).toBe('welcome');
    let seq = 0;
    for (let t = 0; t < 60_000; t += WALK_SLICE_MS) {
      clock.advance(WALK_SLICE_MS);
      s.handle(JSON.stringify({ t: 'walk', seq: ++seq, a: seq % 2 === 0 ? 0 : 180 }));
      if (t % 500 === 0) s.handle(JSON.stringify({ t: 'shoot', cid: seq, a: 0 }));
      if (t % 2000 === 0) s.handle(JSON.stringify({ t: 'ping', id: seq }));
    }
    expect(transport.closed).toEqual([]);
  });

  it('desconecta quem manda lixo sem parar', () => {
    const { s, transport } = session();
    for (let i = 0; i < 25; i++) s.handle('isso não é json');
    expect(transport.closed).toEqual([4001]);
  });
});
