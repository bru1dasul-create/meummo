// Pulo (Espaço, pedido do dono em 14/11): por enquanto só de enfeite. O navegador pula na hora e avisa o servidor,
// que confere a recarga e manda o pulo para quem está perto ver (o próprio jogador não recebe de volta).

import { describe, expect, it } from 'vitest';
import { parseClientMsg } from '../src/server/validate';
import { World } from '../src/server/world';
import { JUMP_COOLDOWN_MS, TICK_MS } from '../src/shared/constants';
import { GameMap, type TiledObject } from '../src/shared/map';
import { FakeClock, FakeConn } from './helpers';

const PX = 32;

/** Mapa do formato novo (1 tile = 1 metro), aberto. */
function metricMap(): GameMap {
  const spawn: TiledObject = { id: 0, name: 'spawn', x: 8 * PX, y: 5 * PX, point: true };
  return GameMap.fromTiled(
    {
      width: 30,
      height: 12,
      tilewidth: PX,
      tileheight: PX,
      orientation: 'orthogonal',
      properties: [{ name: 'nome', type: 'string', value: 'Teste' }],
      tilesets: [],
      layers: [
        { type: 'objectgroup', name: 'colisao', objects: [] },
        { type: 'objectgroup', name: 'pontos', objects: [spawn] },
      ],
    },
    'teste',
  );
}

function setup() {
  const clock = new FakeClock();
  const world = new World(metricMap(), { now: clock.now, random: () => 0 });
  const join = (name: string) => {
    const conn = new FakeConn();
    const joined = world.join(name, conn);
    if (!joined.ok) throw new Error(joined.reason);
    return { player: joined.player, conn };
  };
  const ana = join('Ana');
  const beto = join('Beto');
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += TICK_MS) {
      clock.advance(TICK_MS);
      world.tick();
    }
  };
  run(TICK_MS * 2); // um já vê o outro
  /** Quantos pulos da Ana o Beto viu até agora. */
  const jumpsSeen = () => beto.conn.ofType('fx').filter((m) => m.kind === 'jump' && m.id === ana.player.id).length;
  return { world, ana, beto, run, jumpsSeen };
}

describe('pulo', () => {
  it('quem está perto vê o pulo; quem pulou não recebe de volta (já pulou no navegador)', () => {
    const { world, ana, run, jumpsSeen } = setup();
    world.jump(ana.player);
    run(TICK_MS);
    expect(jumpsSeen()).toBe(1);
    expect(ana.conn.ofType('fx').some((m) => m.kind === 'jump')).toBe(false);
  });

  it('a recarga vale: pular de novo logo em seguida não manda outro pulo; depois dela, manda', () => {
    const { world, ana, run, jumpsSeen } = setup();
    world.jump(ana.player);
    run(JUMP_COOLDOWN_MS / 2);
    world.jump(ana.player);
    run(TICK_MS);
    expect(jumpsSeen()).toBe(1);
    run(JUMP_COOLDOWN_MS);
    world.jump(ana.player);
    run(TICK_MS);
    expect(jumpsSeen()).toBe(2);
  });

  it('não pula desmaiado, defendendo nem puxando o tiro', () => {
    const { world, ana, run, jumpsSeen } = setup();
    ana.player.deadUntil = 1; // desmaiada
    world.jump(ana.player);
    ana.player.deadUntil = 0;
    world.guard(ana.player, true, 0);
    world.jump(ana.player);
    world.guard(ana.player, false, 0);
    world.charge(ana.player);
    world.jump(ana.player);
    run(TICK_MS);
    expect(jumpsSeen()).toBe(0);
  });

  it('a mensagem do navegador é só { t: "jump" } (o resto é ignorado)', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'jump' }))).toEqual({ t: 'jump' });
    expect(parseClientMsg(JSON.stringify({ t: 'jump', alto: 99 }))).toEqual({ t: 'jump' });
  });
});
