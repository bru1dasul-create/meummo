// Uma conexão de um navegador: cuida da entrada (nome + senha) e repassa os pedidos para o mundo.

import { PROTOCOL_VERSION } from '../shared/constants';
import { nameKey, nameProblem, normalizeName, passwordProblem } from '../shared/names';
import type { ByeReason, RejectReason, ServerMsg } from '../shared/protocol';
import type { CharacterStore, LoginResult, SavedCharacter } from './accounts';
import type { LoginGuard } from './login-guard';
import { TokenBucket } from './rate-limit';
import { parseClientMsg } from './validate';
import type { Player, World } from './world';

/** O canal "cru" (no servidor real, um WebSocket). */
export interface Transport {
  send(data: string): void;
  close(code: number, reason: string): void;
}

/** O que todas as sessões compartilham. */
export interface Lobby {
  world: World;
  store: CharacterStore;
  guard: LoginGuard;
  /** Quem está jogando com cada personagem salvo (para "entrou de outro lugar"). */
  online: Map<number, Session>;
  log: (message: string) => void;
}

/** Quantas mensagens ruins (inválidas ou em excesso) toleramos antes de desconectar. */
const MAX_STRIKES = 20;

export class Session {
  private player: Player | null = null;
  private characterId: number | null = null;
  /** Conferindo a senha (demora um pouquinho de propósito). */
  private authenticating = false;
  private readonly limiter: TokenBucket;
  private strikes = 0;
  private closed = false;

  constructor(
    private readonly lobby: Lobby,
    private readonly transport: Transport,
    /** Endereço de quem conectou (para frear quem erra a senha muitas vezes). */
    private readonly ip: string,
    private readonly now: () => number = () => performance.now(),
  ) {
    // Até 30 mensagens de uma vez, 15 por segundo em média (andar usa ~5/s).
    this.limiter = new TokenBucket(30, 15, now());
  }

  get playerName(): string | null {
    return this.player?.name ?? null;
  }

  handle(raw: string): void {
    if (this.closed) return;
    if (!this.limiter.take(this.now())) return this.strike('mensagens demais');
    const msg = parseClientMsg(raw);
    if (!msg) return this.strike('mensagem inválida');

    if (!this.player) {
      if (this.authenticating) return; // espera a senha ser conferida
      if (msg.t !== 'hello') return this.strike('precisa entrar primeiro');
      if (msg.v !== PROTOCOL_VERSION) return this.reject('version');
      this.authenticating = true;
      void this.login(msg.name, msg.password);
      return;
    }

    switch (msg.t) {
      case 'step':
        this.lobby.world.requestStep(this.player, msg.seq, msg.dir, msg.dash === true);
        break;
      case 'shoot':
        this.lobby.world.shoot(this.player, msg.cid, msg.a);
        break;
      case 'skill':
        this.lobby.world.useSkill(this.player, msg.n, msg.a);
        break;
      case 'chat':
        this.lobby.world.chat(this.player, msg.text);
        break;
      case 'ping':
        this.sendBatch([{ t: 'pong', id: msg.id }]);
        break;
      case 'hello':
        break; // já entrou
    }
  }

  /** A conexão caiu ou foi fechada. */
  disconnect(): void {
    this.closed = true;
    this.leaveWorld();
  }

  /** O servidor encerra esta sessão: avisa o navegador, tira o personagem do mundo (salvando) e fecha. */
  end(reason: ByeReason): void {
    if (this.closed) return;
    this.sendBatch([{ t: 'bye', reason }]);
    this.leaveWorld();
    this.close(4002, reason);
  }

  private async login(rawName: string, rawPassword: string): Promise<void> {
    const name = normalizeName(rawName);
    if (nameProblem(name)) return this.reject('name_invalid');
    const password = rawPassword.normalize('NFC'); // o mesmo acento digitado em aparelhos diferentes vira a mesma senha
    if (passwordProblem(password)) return this.reject('password_invalid');
    const { world, store, guard, online, log } = this.lobby;
    const key = nameKey(name);
    if (!guard.allowed(this.ip, key)) return this.reject('too_many_attempts');

    let result: LoginResult;
    try {
      result = await store.login(name, password, guard.canCreate(this.ip));
    } catch (error) {
      if (!this.closed) log(`erro ao conferir o personagem "${name}": ${(error as Error).message}`);
      return this.reject('unavailable');
    }
    if (this.closed) return; // fechou a aba enquanto a senha era conferida
    if (!result.ok) {
      if (result.reason === 'wrong_password') {
        guard.failed(this.ip, key);
        log(`senha errada para "${name}" (${this.ip})`);
      }
      return this.reject(result.reason);
    }
    if (result.created) guard.created(this.ip);

    // Já está jogando com esse personagem em outro lugar? Aquela sessão sai (e salva) primeiro,
    // e só depois o progresso é lido — assim nada se perde.
    online.get(result.id)?.end('replaced');
    let character: SavedCharacter | null;
    try {
      character = store.load(result.id);
    } catch (error) {
      log(`erro ao ler o personagem "${name}": ${(error as Error).message}`);
      return this.reject('unavailable');
    }
    if (!character) return this.reject('unavailable');

    const joined = world.join(character.name, { send: (batch) => this.sendBatch(batch) }, { character, created: result.created });
    if (!joined.ok) return this.reject(joined.reason);
    this.player = joined.player;
    this.characterId = result.id;
    this.authenticating = false;
    online.set(result.id, this);
  }

  private leaveWorld(): void {
    if (this.player) this.lobby.world.leave(this.player);
    this.player = null;
    if (this.characterId !== null && this.lobby.online.get(this.characterId) === this) this.lobby.online.delete(this.characterId);
    this.characterId = null;
  }

  private sendBatch(batch: ServerMsg[]): void {
    if (!this.closed) this.transport.send(JSON.stringify(batch));
  }

  private reject(reason: RejectReason): void {
    this.sendBatch([{ t: 'reject', reason }]);
    this.close(4000, reason);
  }

  private strike(why: string): void {
    if (++this.strikes > MAX_STRIKES) this.close(4001, why);
  }

  private close(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.transport.close(code, reason);
  }
}
