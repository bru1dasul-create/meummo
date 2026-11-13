// Tela inicial nova: "Entrar" só entra com personagem que já existe e "Criar uma conta" só cria nome novo (sem modo,
// como a tela antiga e os bots: entra ou cria). E o painel do administrador troca a senha de quem esqueceu.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterStore } from '../src/server/accounts';
import { startServer, type RunningServer } from '../src/server/server';
import { Session } from '../src/server/session';
import { parseClientMsg } from '../src/server/validate';
import { PROTOCOL_VERSION } from '../src/shared/constants';
import { GameMap } from '../src/shared/map';
import type { LoginMode, ServerMsg } from '../src/shared/protocol';
import { FAST_HASH, FakeClock, FakeTransport, makeLobby, tiledFromAscii } from './helpers';

const map = GameMap.fromTiled(tiledFromAscii(['......', '......'], { x: 1, y: 1 }), 'vila');

/** Manda o hello (com o modo) e espera o welcome ou o reject. */
async function hello(session: Session, transport: FakeTransport, name: string, password: string, mode?: LoginMode) {
  const before = transport.all().length;
  session.handle(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name, password, ...(mode ? { mode } : {}) }));
  return vi.waitFor(
    () => {
      const answer = transport
        .all()
        .slice(before)
        .find((m): m is Extract<ServerMsg, { t: 'welcome' | 'reject' }> => m.t === 'welcome' || m.t === 'reject');
      if (!answer) throw new Error('sem resposta');
      return answer;
    },
    { timeout: 3000, interval: 2 },
  );
}

describe('entrar x criar uma conta', () => {
  it('no arquivo dos personagens: entrar não cria, criar não entra', async () => {
    const store = new CharacterStore(':memory:', { cost: FAST_HASH });
    expect(await store.login('Ana', 'segredo1', true, 'login')).toEqual({ ok: false, reason: 'not_found' });
    expect(store.count()).toBe(0);
    const created = await store.login('Ana', 'segredo1', true, 'create');
    expect(created).toMatchObject({ ok: true, created: true });
    expect(await store.login('ana', 'segredo1', true, 'create')).toEqual({ ok: false, reason: 'name_exists' });
    expect(await store.login('ANA', 'segredo1', true, 'login')).toMatchObject({ ok: true, created: false });
    expect(await store.login('Ana', 'errada!!', true, 'login')).toEqual({ ok: false, reason: 'wrong_password' });
    expect(await store.login('Beto', 'segredo1', false, 'create')).toEqual({ ok: false, reason: 'creation_limit' });
    // sem modo, como sempre: entra ou cria
    expect(await store.login('Caio', 'segredo1')).toMatchObject({ ok: true, created: true });
    expect(store.count()).toBe(2);
    store.close();
  });

  it('pela conexão: nome errado no Entrar avisa em vez de criar personagem novo', async () => {
    const lobby = makeLobby(map, new FakeClock());
    const a = new FakeTransport();
    expect(await hello(new Session(lobby, a, '10.0.0.1'), a, 'Ana', 'segredo1', 'login')).toEqual({ t: 'reject', reason: 'not_found' });
    const b = new FakeTransport();
    expect((await hello(new Session(lobby, b, '10.0.0.1'), b, 'Ana', 'segredo1', 'create')).t).toBe('welcome');
    const c = new FakeTransport();
    expect(await hello(new Session(lobby, c, '10.0.0.2'), c, 'Ana', 'outra-senha', 'create')).toEqual({ t: 'reject', reason: 'name_exists' });
    expect(lobby.store.count()).toBe(1);
  });

  it('a mensagem com o modo passa pela conferência (e modo estranho não)', () => {
    const base = { t: 'hello', v: PROTOCOL_VERSION, name: 'Ana', password: 'segredo1' };
    expect(parseClientMsg(JSON.stringify({ ...base, mode: 'login' }))).toEqual({ ...base, mode: 'login' });
    expect(parseClientMsg(JSON.stringify({ ...base, mode: 'create', mundo: 'novo' }))).toEqual({ ...base, mode: 'create', mundo: 'novo' });
    expect(parseClientMsg(JSON.stringify(base))).toEqual(base);
    expect(parseClientMsg(JSON.stringify({ ...base, mode: 'admin' }))).toBeNull();
  });
});

describe('trocar a senha pelo painel do administrador', () => {
  it('no arquivo: a senha antiga deixa de valer e a nova entra; nome que não existe não troca nada', async () => {
    const store = new CharacterStore(':memory:', { cost: FAST_HASH });
    await store.login('Ana', 'segredo1');
    expect(await store.setPassword('ana', 'nova-senha')).toBe('Ana');
    expect(await store.login('Ana', 'segredo1')).toEqual({ ok: false, reason: 'wrong_password' });
    expect(await store.login('Ana', 'nova-senha')).toMatchObject({ ok: true });
    expect(await store.setPassword('Ninguem', 'nova-senha')).toBeNull();
    store.close();
  });

  describe('com o servidor de verdade', () => {
    let server: RunningServer;
    beforeEach(async () => {
      server = await startServer({ port: 0, host: '127.0.0.1', log: false, saveFile: ':memory:', hashCost: FAST_HASH });
    });
    afterEach(() => server.close());

    /** Entra pelo WebSocket e devolve a primeira resposta (welcome ou reject). */
    async function join(name: string, password: string): Promise<string> {
      const { default: WebSocket } = await import('ws');
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
      const received: { t: string; reason?: string }[] = [];
      ws.on('message', (data) => received.push(...(JSON.parse(data.toString()) as { t: string }[])));
      await new Promise((resolve, reject) => ws.once('open', resolve).once('error', reject));
      ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name, password }));
      const answer = await vi.waitFor(
        () => {
          const m = received.find((r) => r.t === 'welcome' || r.t === 'reject');
          if (!m) throw new Error('sem resposta');
          return m;
        },
        { timeout: 3000 },
      );
      ws.close();
      await vi.waitFor(() => expect(server.realm.online).toBe(0), { timeout: 3000 });
      return answer.t === 'welcome' ? 'welcome' : `reject:${answer.reason}`;
    }

    it('troca a senha de quem esqueceu (offline), e confere o pedido', async () => {
      expect(await join('Ana', 'segredo1')).toBe('welcome');
      const base = `http://127.0.0.1:${server.port}`;
      const headers = { 'content-type': 'application/json', 'x-meummo-admin': '1' };
      const post = (body: unknown, h: Record<string, string> = headers) => fetch(`${base}/admin/api/senha`, { method: 'POST', headers: h, body: JSON.stringify(body) });

      const done = await post({ nome: 'ana', senha: 'nova-senha' });
      expect(await done.json()).toEqual({ ok: true, texto: 'Senha de Ana trocada. Passe a senha nova para quem joga com ele.' });
      expect(await join('Ana', 'segredo1')).toBe('reject:wrong_password');
      expect(await join('Ana', 'nova-senha')).toBe('welcome');

      const unknown = await post({ nome: 'Ninguem', senha: 'nova-senha' });
      expect(unknown.status).toBe(400);
      expect(((await unknown.json()) as { erro: string }).erro).toMatch(/Não existe/);
      const short = await post({ nome: 'Ana', senha: '123' });
      expect(short.status).toBe(400);
      const noHeader = await post({ nome: 'Ana', senha: 'outra-senha' }, { 'content-type': 'application/json' });
      expect(noHeader.status).toBe(403);
      expect(await join('Ana', 'nova-senha')).toBe('welcome'); // nada mudou com os pedidos recusados
    });
  });
});
