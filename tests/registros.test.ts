// Registros (logs) para corrigir mais fácil: um arquivo por dia, os erros com o caminho (sem encher com repetição),
// os erros do navegador de quem joga e a aba Registros do painel do administrador.

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logbook } from '../src/server/logbook';
import { startServer, type RunningServer } from '../src/server/server';
import { Session } from '../src/server/session';
import { parseClientMsg } from '../src/server/validate';
import { PROTOCOL_VERSION } from '../src/shared/constants';
import { GameMap } from '../src/shared/map';
import { FAST_HASH, FakeClock, FakeTransport, makeLobby, tiledFromAscii } from './helpers';

describe('registros', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'meummo-registros-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('anota com data e hora, num arquivo por dia, e guarda as últimas linhas para o painel', () => {
    let now = new Date(2026, 10, 13, 9, 5, 7);
    const book = new Logbook({ dir, now: () => now });
    book.write('entrou: Ana');
    now = new Date(2026, 10, 14, 0, 0, 1);
    book.write('ADM Ana: criei 3 Sagui');
    expect(readFileSync(path.join(dir, '2026-11-13.log'), 'utf8')).toBe('[2026-11-13 09:05:07] entrou: Ana\n');
    expect(readFileSync(path.join(dir, '2026-11-14.log'), 'utf8')).toContain('ADM Ana');
    expect(book.recent()).toEqual(['[2026-11-13 09:05:07] entrou: Ana', '[2026-11-14 00:00:01] ADM Ana: criei 3 Sagui']);
    expect(book.recent(10, 'adm')).toHaveLength(1);
    expect(book.recent(1)).toHaveLength(1);
  });

  it('apaga os arquivos mais velhos que 14 dias ao ligar', () => {
    writeFileSync(path.join(dir, '2026-10-01.log'), 'velho\n');
    writeFileSync(path.join(dir, '2026-11-10.log'), 'novo\n');
    writeFileSync(path.join(dir, 'outra-coisa.txt'), 'fica\n');
    new Logbook({ dir, now: () => new Date(2026, 10, 13) });
    expect(readdirSync(dir).sort()).toEqual(['2026-11-10.log', 'outra-coisa.txt']);
  });

  it('erro: anota o caminho dele; repetindo, só uma vez por minuto, dizendo quantas vezes repetiu', () => {
    let t = new Date(2026, 10, 13, 10, 0, 0).getTime();
    const book = new Logbook({ dir: null, now: () => new Date(t) });
    const boom = () => new Error('quebrou');
    book.error('no passo do mundo (tick)', boom());
    t += 50;
    book.error('no passo do mundo (tick)', boom());
    book.error('no passo do mundo (tick)', boom());
    const first = book.recent();
    expect(first).toHaveLength(1);
    expect(first[0]).toContain('ERRO no passo do mundo (tick): quebrou');
    expect(first[0]).toContain('registros.test.ts'); // o caminho do erro (onde aconteceu)
    t += 61_000;
    book.error('no passo do mundo (tick)', boom());
    expect(book.recent().at(-1)).toContain('repetiu 2 vez(es)');
    expect(existsSync(path.join(dir, 'x'))).toBe(false);
  });
});

describe('erros do navegador vão para os registros', () => {
  it('a mensagem passa pela conferência (texto comprido é cortado)', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'oops', text: 'x is not a function' }))).toEqual({ t: 'oops', text: 'x is not a function' });
    expect((parseClientMsg(JSON.stringify({ t: 'oops', text: 'a'.repeat(900) })) as { text: string }).text).toHaveLength(800);
    expect(parseClientMsg(JSON.stringify({ t: 'oops', text: 'a'.repeat(5000) }))).toBeNull(); // grande demais: nem lê
    expect(parseClientMsg(JSON.stringify({ t: 'oops', text: '' }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'oops' }))).toBeNull();
  });

  it('quem está jogando manda; o servidor anota com o nome (no máximo alguns por vez)', async () => {
    const lines: string[] = [];
    const clock = new FakeClock();
    const lobby = { ...makeLobby(GameMap.fromTiled(tiledFromAscii(['......', '......'], { x: 1, y: 1 }), 'vila'), clock), log: (m: string) => lines.push(m) };
    const transport = new FakeTransport();
    const session = new Session(lobby, transport, '10.0.0.1', clock.now);
    session.handle(JSON.stringify({ t: 'oops', text: 'antes de entrar' })); // antes de entrar não conta
    session.handle(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name: 'Ana', password: 'segredo1' }));
    await vi.waitFor(() => expect(transport.ofType('welcome')).toHaveLength(1), { timeout: 3000 });
    for (let i = 0; i < 20; i++) session.handle(JSON.stringify({ t: 'oops', text: `erro ${i}` }));
    const reported = lines.filter((l) => l.startsWith('erro no navegador de Ana'));
    expect(reported.length).toBe(5);
    expect(reported[0]).toBe('erro no navegador de Ana: erro 0');
    expect(lines.some((l) => l.includes('antes de entrar'))).toBe(false);
  });
});

describe('aba Registros do painel', () => {
  let server: RunningServer;
  beforeEach(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', log: false, saveFile: ':memory:', hashCost: FAST_HASH });
  });
  afterEach(() => server.close());

  it('mostra as últimas linhas, com filtro; só no computador do servidor', async () => {
    server.logbook.write('entrou: Ana em Teste');
    server.logbook.write('ADM Ana: derrubou 2 monstro(s)');
    const base = `http://127.0.0.1:${server.port}`;
    const all = (await (await fetch(`${base}/admin/api/registros`)).json()) as { linhas: string[]; pasta: string | null };
    expect(all.linhas.some((l) => l.includes('servidor no ar'))).toBe(true);
    expect(all.linhas.at(-1)).toContain('ADM Ana');
    expect(all.pasta).toBeNull(); // ':memory:' não guarda em arquivo
    const only = (await (await fetch(`${base}/admin/api/registros?filtro=adm`)).json()) as { linhas: string[] };
    expect(only.linhas).toHaveLength(1);
  });
});
