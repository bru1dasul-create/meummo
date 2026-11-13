// Painel do administrador: ajustes (src/server/tuning.ts), o mundo reagindo na hora e as travas do /admin.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accessProblem } from '../src/server/admin';
import { Realm } from '../src/server/realm';
import { startServer, type RunningServer } from '../src/server/server';
import { Tuning, type BaseData, type TuningFile } from '../src/server/tuning';
import { TICK_MS } from '../src/shared/constants';
import { GameMap } from '../src/shared/map';
import { FAST_HASH, FakeClock, FakeConn, tiledFromAscii } from './helpers';

const BASE: BaseData = {
  monstros: {
    bicho: { nome: 'Bicho', nivel: 1, vida: 20, xp: 5, passoMs: 1e9, ouro: [1, 2], ataque: { tipo: 'mordida', preparoMs: 400, intervaloMs: 1000, dano: [2, 3] } },
  },
  itens: {
    fruta: { nome: 'Fruta', preco: 5, tipo: 'consumivel', cura: 10 },
    chapeu: { nome: 'Chapéu', preco: 40, tipo: 'equipamento', parte: 'cabeca', vida: 10 },
    pedra: { nome: 'Pedra', tipo: 'material' },
  },
  npcs: {
    dona: { nome: 'Dona', titulo: 'quitandeira', mapa: 'vila', x: 1, y: 1, fala: 'Oi!', loja: { vende: ['fruta'], compraPor: 50 } },
  },
};

const maps = [GameMap.fromTiled(tiledFromAscii(['......', '......', '......'], { x: 1, y: 1 }, [{ monster: 'bicho', x: 4, y: 1, w: 1, h: 1 }]), 'vila')];

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'meummo-ajustes-'));
  file = path.join(dir, 'ajustes.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function tuning(saved = {}, logs: string[] = []): Tuning {
  return new Tuning(structuredClone(BASE), maps, file, saved, (m) => logs.push(m));
}

describe('ajustes do painel', () => {
  it('ajuste aceito vale na hora (nos mesmos objetos que o jogo usa), fica guardado e avisa o que mudou', () => {
    const t = tuning();
    const bicho = t.monsters.get('bicho')!;
    const changes: TuningFile[][] = [];
    t.onChange = (changed) => changes.push([...changed]);
    expect(t.set('monstros', 'bicho', 'vida', 50)).toEqual({ ok: true });
    expect(t.set('monstros', 'bicho', 'ataque.dano', [4, 6])).toEqual({ ok: true });
    expect(t.monsters.get('bicho')).toBe(bicho); // o mesmo objeto: quem já tinha a referência vê o valor novo
    expect(bicho.hp).toBe(50);
    expect(bicho.attack.damage).toEqual([4, 6]);
    expect(changes).toEqual([['monstros'], ['monstros']]);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ monstros: { bicho: { vida: 50, ataque: { dano: [4, 6] } } } });
    // mudar item também atualiza a loja (o preço aparece nela)
    expect(t.set('itens', 'fruta', 'preco', 7)).toEqual({ ok: true });
    expect(changes.at(-1)).toEqual(['itens', 'npcs']);
    expect(t.items.get('fruta')!.price).toBe(7);
  });

  it('valor inválido é recusado com o motivo em português, e nada muda', () => {
    const t = tuning();
    t.set('monstros', 'bicho', 'vida', 30);
    const before = readFileSync(file, 'utf8');
    expect(t.set('monstros', 'bicho', 'vida', 0)).toEqual({ ok: false, erro: expect.stringMatching(/"vida" precisa ser pelo menos 1/) });
    expect(t.set('monstros', 'bicho', 'vida', 'muito')).toEqual({ ok: false, erro: 'Vida: precisa ser um número inteiro.' });
    expect(t.set('monstros', 'bicho', 'ouro', [5, 2])).toEqual({ ok: false, erro: expect.stringMatching(/"ouro" precisa ser/) });
    expect(t.set('npcs', 'dona', 'loja.vende', ['pedra'])).toEqual({ ok: false, erro: expect.stringMatching(/não tem "preco"/) });
    expect(t.set('npcs', 'dona', 'loja.compraPor', 150)).toEqual({ ok: false, erro: expect.stringMatching(/de 0 a 100/) });
    expect(t.monsters.get('bicho')!.hp).toBe(30);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('só os campos do painel, de coisas que existem, e que valem para aquele item', () => {
    const t = tuning();
    expect(t.set('monstros', 'nada', 'vida', 10)).toEqual({ ok: false, erro: '"nada" não existe em monstros.' });
    expect(t.set('monstros', 'bicho', 'nome', 'Outro')).toEqual({ ok: false, erro: 'O campo "nome" não pode ser ajustado pelo painel.' });
    expect(t.set('itens', 'chapeu', 'cura', 5)).toEqual({ ok: false, erro: 'O campo "Cura" não vale para Chapéu.' });
    expect(t.set('itens', 'fruta', 'dano', 5)).toEqual({ ok: false, erro: 'O campo "Dano" não vale para Fruta.' });
  });

  it('voltar ao padrão tira o ajuste (e limpa o arquivo)', () => {
    const t = tuning();
    t.set('monstros', 'bicho', 'vida', 50);
    t.set('itens', 'fruta', 'preco', 9);
    expect(t.reset('monstros', 'bicho', 'vida')).toEqual({ ok: true });
    expect(t.monsters.get('bicho')!.hp).toBe(20);
    expect(t.exportOverrides()).toEqual({ itens: { fruta: { preco: 9 } } });
    t.reset('itens', 'fruta', 'preco');
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({});
  });

  it('o painel mostra o valor de agora, o padrão e o que foi ajustado', () => {
    const t = tuning();
    t.set('monstros', 'bicho', 'vida', 50);
    const view = t.view();
    const bicho = view.grupos.find((g) => g.arquivo === 'monstros')!.lista[0]!;
    expect(bicho).toMatchObject({ id: 'bicho', nome: 'Bicho', detalhe: 'Nível 1' });
    expect(bicho.campos.find((c) => c.campo === 'vida')).toMatchObject({ valor: 50, padrao: 20, ajustado: true });
    expect(bicho.campos.find((c) => c.campo === 'ouro')).toMatchObject({ valor: [1, 2], ajustado: false });
    const chapeu = view.grupos.find((g) => g.arquivo === 'itens')!.lista.find((i) => i.id === 'chapeu')!;
    expect(chapeu.campos.map((c) => c.campo)).toEqual(['preco', 'dano', 'vida', 'defesa']); // equipamento: sem "cura"
    const dona = view.grupos.find((g) => g.arquivo === 'npcs')!.lista[0]!;
    expect(dona.campos.map((c) => c.campo)).toEqual(['fala', 'mapa', 'x', 'y', 'loja.vende', 'loja.compraPor']);
    expect(view.itens).toEqual([
      { id: 'fruta', nome: 'Fruta', preco: 5 },
      { id: 'chapeu', nome: 'Chapéu', preco: 40 },
      { id: 'pedra', nome: 'Pedra', preco: 0 },
    ]);
  });

  it('ao ligar, os ajustes guardados valem; ajuste de algo que sumiu do jogo é deixado de lado', () => {
    const logs: string[] = [];
    const t = tuning({ monstros: { bicho: { vida: 99 }, sumiu: { vida: 5 } } }, logs);
    expect(t.problem).toBeNull();
    expect(t.monsters.get('bicho')!.hp).toBe(99);
    expect(t.exportOverrides()).toEqual({ monstros: { bicho: { vida: 99 } } });
    expect(logs.some((m) => m.includes('"sumiu"'))).toBe(true);
  });

  it('ajustes que não valem mais (o jogo mudou): liga com o padrão e guarda os antigos à parte', () => {
    writeFileSync(file, JSON.stringify({ monstros: { bicho: { vida: -5 } } }));
    const logs: string[] = [];
    const t = tuning({ monstros: { bicho: { vida: -5 } } }, logs);
    expect(t.problem).toMatch(/não valem com esta versão do jogo/);
    expect(t.monsters.get('bicho')!.hp).toBe(20);
    expect(existsSync(path.join(dir, 'ajustes-antigos.json'))).toBe(true);
    expect(logs.some((m) => m.includes('valores padrão'))).toBe(true);
  });
});

describe('o mundo reage aos ajustes na hora', () => {
  function setup() {
    const clock = new FakeClock();
    const t = tuning();
    const realm = new Realm(maps, { now: clock.now, random: () => 0, monsters: t.monsters, items: t.items, npcs: t.npcs });
    t.onChange = (changed) => realm.tuningChanged(changed);
    const conn = new FakeConn();
    const joined = realm.join('Ana', conn);
    if (!joined.ok) throw new Error(joined.reason);
    const tick = () => {
      clock.advance(TICK_MS);
      realm.tick();
    };
    tick();
    return { t, realm, conn, player: joined.player, tick, world: realm.start };
  }

  it('a vida dos monstros que estão no mapa acompanha, na mesma proporção', () => {
    const { t, world, conn, tick } = setup();
    const monster = [...world.monsters.values()][0]!;
    monster.hp = 10; // metade da vida
    t.set('monstros', 'bicho', 'vida', 60);
    expect(monster.maxHp).toBe(60);
    expect(monster.hp).toBe(30);
    tick();
    expect(conn.ofType('hp').find((m) => m.id === monster.id)).toEqual({ t: 'hp', id: monster.id, hp: 30, maxHp: 60 });
  });

  it('item ajustado: o equipamento soma o valor novo e todo mundo recebe a lista nova', () => {
    const { t, player, conn, tick } = setup();
    player.inventory.add('chapeu', 1);
    player.inventory.equip(0);
    player.bonus = player.inventory.bonus();
    const before = player.maxHp;
    t.set('itens', 'chapeu', 'vida', 25);
    tick();
    expect(player.maxHp).toBe(before + 25);
    expect(conn.ofType('items').at(-1)?.items.find((i) => i.id === 'chapeu')?.bonus.hp).toBe(25);
    expect(conn.ofType('stats').at(-1)?.stats.maxHp).toBe(before + 25);
  });

  it('loja ajustada: quem está no mapa recebe o que ela vende agora', () => {
    const { t, conn, tick } = setup();
    t.set('npcs', 'dona', 'loja.vende', ['fruta', 'chapeu']);
    tick();
    expect(conn.ofType('npcs').at(-1)?.npcs[0]?.shop?.sells).toEqual(['fruta', 'chapeu']);
  });
});

describe('travas do painel', () => {
  const req = (over: { remote?: string; host?: string; method?: string; headers?: Record<string, string> } = {}) => ({
    method: over.method ?? 'GET',
    socket: { remoteAddress: over.remote ?? '127.0.0.1' },
    headers: { host: over.host ?? 'localhost:3000', ...over.headers },
  });

  it('só no próprio computador, pelo endereço localhost; mudanças só com a marca do painel e do próprio site', () => {
    const check = (r: ReturnType<typeof req>) => accessProblem(r as unknown as Parameters<typeof accessProblem>[0]);
    expect(check(req())).toBeNull();
    expect(check(req({ remote: '::1', host: '127.0.0.1:3000' }))).toBeNull();
    expect(check(req({ remote: '192.168.0.20' }))).toMatch(/só abre no computador onde o jogo está ligado/);
    expect(check(req({ host: 'site-malvado.com' }))).toMatch(/pelo endereço http:\/\/localhost/);
    expect(check(req({ method: 'POST' }))).toMatch(/sem a marca do painel/);
    expect(check(req({ method: 'POST', headers: { 'x-meummo-admin': '1', origin: 'https://site-malvado.com' } }))).toMatch(/outro site/);
    expect(check(req({ method: 'POST', headers: { 'x-meummo-admin': '1', origin: 'http://localhost:3000' } }))).toBeNull();
  });

  describe('com o servidor de verdade', () => {
    let server: RunningServer;
    beforeEach(async () => {
      server = await startServer({ port: 0, host: '127.0.0.1', log: false, saveFile: ':memory:', hashCost: FAST_HASH });
    });
    afterEach(() => server.close());

    it('abre a página e os dados; ajuste vale no jogo; sem a marca, recusa', async () => {
      const base = `http://127.0.0.1:${server.port}`;
      const page = await fetch(`${base}/admin`);
      expect(page.status).toBe(200);
      expect(page.headers.get('content-security-policy')).toMatch(/frame-ancestors 'none'/);
      expect(await page.text()).toContain('Painel do administrador');

      const data = (await (await fetch(`${base}/admin/api/dados`)).json()) as { grupos: { arquivo: string }[] };
      expect(data.grupos.map((g) => g.arquivo)).toEqual(['monstros', 'itens', 'npcs', 'areas', 'missoes']);

      const body = JSON.stringify({ arquivo: 'monstros', id: 'sagui', campo: 'vida', valor: 30 });
      const denied = await fetch(`${base}/admin/api/ajustar`, { method: 'POST', body, headers: { 'content-type': 'application/json' } });
      expect(denied.status).toBe(403);
      expect(server.tuning.monsters.get('sagui')!.hp).not.toBe(30);

      const headers = { 'content-type': 'application/json', 'x-meummo-admin': '1' };
      const ok = await fetch(`${base}/admin/api/ajustar`, { method: 'POST', body, headers });
      expect(await ok.json()).toEqual({ ok: true });
      expect(server.tuning.monsters.get('sagui')!.hp).toBe(30);

      const bad = await fetch(`${base}/admin/api/ajustar`, { method: 'POST', headers, body: JSON.stringify({ arquivo: 'monstros', id: 'sagui', campo: 'vida', valor: 0 }) });
      expect(bad.status).toBe(400);
      expect(((await bad.json()) as { erro: string }).erro).toMatch(/pelo menos 1/);

      expect((await fetch(`${base}/admin/nada`)).status).toBe(404);
    });
  });
});

describe('ferramentas de jogadores', () => {
  const vila = GameMap.fromTiled(tiledFromAscii(['........', '........', '...##...', '........'], { x: 1, y: 1 }), 'vila');
  const mata = GameMap.fromTiled(tiledFromAscii(['......', '......', '......'], { x: 2, y: 1 }), 'mata');

  function setup() {
    const clock = new FakeClock();
    const t = tuning();
    const realm = new Realm([vila, mata], { now: clock.now, random: () => 0, items: t.items, monsters: t.monsters });
    const join = (name: string) => {
      const conn = new FakeConn();
      const result = realm.join(name, conn);
      if (!result.ok) throw new Error(result.reason);
      return { player: result.player, conn };
    };
    const tick = () => {
      clock.advance(TICK_MS);
      realm.tick();
    };
    return { t, realm, join, tick, clock };
  }

  it('mostra quem está online, em que mapa e com quanto de vida e ouro', () => {
    const { realm, join } = setup();
    const ana = join('Ana');
    ana.player.inventory.gold = 12;
    join('Beto');
    expect(realm.playersOnline().map((p) => p.nome)).toEqual(['Ana', 'Beto']);
    expect(realm.playersOnline()[0]).toMatchObject({ id: ana.player.id, mapa: 'vila', nivel: 1, ouro: 12, desmaiado: false });
  });

  it('dar ouro e itens (o que não cabe na mochila cai no chão perto dele); quem recebe fica sabendo', () => {
    const { t, realm, join, tick } = setup();
    const ana = join('Ana');
    expect(realm.adminGiveGold(ana.player.id, 100)).toEqual({ ok: true, texto: 'Ana recebeu 100 de ouro.' });
    expect(ana.player.inventory.gold).toBe(100);
    for (let i = 0; i < 19; i++) ana.player.inventory.add('chapeu', 1); // sobra 1 espaço
    const fruta = t.items.get('fruta')!;
    // pilha da fruta é 20: cabem 20 no espaço livre; 25 → 5 no chão
    expect(realm.adminGiveItem(ana.player.id, fruta, 25)).toEqual({ ok: true, texto: 'Ana recebeu: Fruta ×25 (5 não couberam na mochila e ficaram no chão, ao lado).' });
    tick();
    expect(ana.conn.ofType('drop').at(-1)).toMatchObject({ x: ana.player.x, y: ana.player.y, item: { item: 'fruta', n: 5 } });
    expect(ana.conn.ofType('sys').map((m) => m.text)).toEqual(expect.arrayContaining(['O administrador te deu 100 de ouro.', 'O administrador te deu: Fruta ×25.']));
    expect(realm.adminGiveGold(9999, 5)).toEqual({ ok: false, erro: 'Esse jogador não está mais online.' });
  });

  it('curar enche a vida; desmaiado não dá', () => {
    const { realm, join, clock } = setup();
    const ana = join('Ana');
    ana.player.hp = 5;
    expect(realm.adminHeal(ana.player.id)).toEqual({ ok: true, texto: 'Ana está com a vida cheia.' });
    expect(ana.player.hp).toBe(ana.player.maxHp);
    ana.player.deadUntil = clock.now() + 5000;
    expect(realm.adminHeal(ana.player.id)).toEqual({ ok: false, erro: 'Ana desmaiou: espere acordar na vila.' });
  });

  it('levar para outro lugar do mesmo mapa (chão bloqueado vira o livre mais perto) ou para outro mapa', () => {
    const { realm, join, tick } = setup();
    const ana = join('Ana');
    expect(realm.adminMove(ana.player.id, 'vila', 6, 3)).toEqual({ ok: true, texto: `Ana agora está em ${vila.name} (6, 3).` });
    tick();
    expect(ana.conn.ofType('teleport').at(-1)).toMatchObject({ x: 6, y: 3 });
    const blocked = realm.adminMove(ana.player.id, 'vila', 3, 2); // parede
    expect(blocked.ok).toBe(true);
    expect(vila.isWalkable(ana.player.x, ana.player.y)).toBe(true);
    expect(realm.adminMove(ana.player.id, 'vila', 50, 50)).toEqual({ ok: false, erro: `(50, 50) fica fora do mapa ${vila.name} (8×4).` });
    expect(realm.adminMove(ana.player.id, 'lua', 1, 1)).toEqual({ ok: false, erro: 'O mapa "lua" não existe.' });

    expect(realm.adminMove(ana.player.id, 'mata')).toMatchObject({ ok: true });
    expect(realm.worldOf(ana.player)?.map.id).toBe('mata');
    expect(ana.conn.ofType('zone').at(-1)).toMatchObject({ map: 'mata' });
    expect(realm.playersOnline()[0]!.mapa).toBe('mata');
  });

  it('aviso para todos chega em todo mundo, em qualquer mapa', () => {
    const { realm, join, tick } = setup();
    const ana = join('Ana');
    const beto = join('Beto');
    realm.adminMove(beto.player.id, 'mata');
    realm.notice('O servidor vai reiniciar em 5 minutos');
    tick();
    for (const { conn } of [ana, beto]) expect(conn.ofType('notice')).toEqual([{ t: 'notice', text: 'O servidor vai reiniciar em 5 minutos' }]);
  });

  describe('pelo painel, com o servidor de verdade', () => {
    let server: RunningServer;
    beforeEach(async () => {
      server = await startServer({ port: 0, host: '127.0.0.1', log: false, saveFile: ':memory:', hashCost: FAST_HASH });
    });
    afterEach(() => server.close());

    it('dá ouro para quem está jogando e expulsa (ele recebe o aviso de que foi desconectado)', async () => {
      const { default: WebSocket } = await import('ws');
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
      const received: { t: string; [k: string]: unknown }[] = [];
      ws.on('message', (data) => received.push(...(JSON.parse(data.toString()) as { t: string }[])));
      await new Promise((resolve, reject) => ws.once('open', resolve).once('error', reject));
      ws.send(JSON.stringify({ t: 'hello', v: (await import('../src/shared/constants')).PROTOCOL_VERSION, name: 'Ana', password: 'segredo1' }));
      await vi.waitFor(() => expect(received.some((m) => m.t === 'welcome')).toBe(true), { timeout: 3000 });
      const closed = new Promise((resolve) => ws.once('close', resolve));

      const base = `http://127.0.0.1:${server.port}`;
      const headers = { 'content-type': 'application/json', 'x-meummo-admin': '1' };
      const list = (await (await fetch(`${base}/admin/api/jogadores`)).json()) as { jogadores: { id: number; nome: string }[]; mapas: { id: string }[] };
      expect(list.jogadores.map((p) => p.nome)).toEqual(['Ana']);
      expect(list.mapas.length).toBeGreaterThan(1);
      const id = list.jogadores[0]!.id;

      const gold = await fetch(`${base}/admin/api/jogador`, { method: 'POST', headers, body: JSON.stringify({ acao: 'ouro', id, quantidade: 250 }) });
      expect(await gold.json()).toEqual({ ok: true, texto: 'Ana recebeu 250 de ouro.' });
      await vi.waitFor(() => expect(received.some((m) => m.t === 'inv' && (m.inv as { gold: number }).gold === 250)).toBe(true), { timeout: 3000 });

      const bad = await fetch(`${base}/admin/api/jogador`, { method: 'POST', headers, body: JSON.stringify({ acao: 'ouro', id, quantidade: -5 }) });
      expect(bad.status).toBe(400);
      const noHeader = await fetch(`${base}/admin/api/jogador`, { method: 'POST', body: JSON.stringify({ acao: 'expulsar', id }) });
      expect(noHeader.status).toBe(403);

      const kick = await fetch(`${base}/admin/api/jogador`, { method: 'POST', headers, body: JSON.stringify({ acao: 'expulsar', id }) });
      expect(await kick.json()).toEqual({ ok: true, texto: 'Desconectei Ana (o progresso fica salvo e pode entrar de novo).' });
      await closed;
      expect(received.some((m) => m.t === 'bye' && m.reason === 'kicked')).toBe(true);
      expect(server.realm.online).toBe(0);
    });
  });
});
