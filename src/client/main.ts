// Ponto de entrada do jogo no navegador: tela de entrada → conexão → mundo.

import Phaser from 'phaser';
import {
  NAME_MAX,
  NAME_MIN,
  nameProblem,
  normalizeName,
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordProblem,
  type NameProblem,
  type PasswordProblem,
} from '../shared/names';
import type { ByeReason, WelcomeMsg } from '../shared/protocol';
import { WorldScene, type WorldSceneData } from './game/WorldScene';
import { Connection, JoinError, type JoinFailure } from './net';
import { Sfx } from './sfx';
import { ChatBox, Hud } from './ui';

const NAME_STORAGE_KEY = 'meummo:nome';
/**
 * Qual jogo abre: o 2.5D novo é o padrão (decisão do dono, 13/11). O jogo de hoje, visto de cima, fica em
 * `?antigo` (ex.: http://localhost:5173/?antigo), só para consulta, até o capítulo 1 novo ficar pronto.
 * O `?novo` de antes continua abrindo o novo.
 */
const NEW_WORLD = !new URLSearchParams(location.search).has('antigo');

const loginOverlay = document.getElementById('login') as HTMLDivElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const nameInput = document.getElementById('name') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const loginButton = document.getElementById('login-button') as HTMLButtonElement;
const loginError = document.getElementById('login-error') as HTMLParagraphElement;

const NAME_ERRORS: Record<NameProblem, string> = {
  short: `O nome precisa ter pelo menos ${NAME_MIN} letras.`,
  long: `O nome pode ter no máximo ${NAME_MAX} caracteres.`,
  chars: 'Use só letras, números, espaço ou _ (e pelo menos uma letra).',
};

const PASSWORD_ERRORS: Record<PasswordProblem, string> = {
  short: `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`,
  long: `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`,
};

const JOIN_ERRORS: Record<JoinFailure, string> = {
  name_invalid: 'Esse nome não é válido.',
  name_taken: 'Já tem alguém online com esse nome. Escolha outro!',
  password_invalid: PASSWORD_ERRORS.short,
  wrong_password: 'Senha errada para esse personagem. Se ele não for seu, escolha outro nome.',
  too_many_attempts: 'Muitas tentativas com a senha errada. Espere alguns minutos e tente de novo.',
  creation_limit: 'Muitos personagens novos criados daqui. Espere um pouco ou entre com um que você já tem.',
  unavailable: 'O servidor não conseguiu abrir os personagens salvos. Tente de novo daqui a pouco.',
  full: 'O servidor está cheio agora. Tente de novo daqui a pouco.',
  version: 'Seu jogo está desatualizado. Recarregue a página.',
  offline: 'Não consegui falar com o servidor. Ele está ligado?',
  timeout: 'O servidor demorou demais para responder. Tente de novo.',
};

const BYE_MESSAGES: Record<ByeReason, string> = {
  replaced: 'Você entrou com esse personagem em outro lugar (outra aba ou aparelho).',
  shutdown: 'O servidor foi desligado ou reiniciou. Seu progresso está salvo: entre de novo daqui a pouco.',
  kicked: 'Você foi desconectado pelo administrador. Seu progresso está salvo.',
};

let game: Phaser.Game | null = null;
const sfx = new Sfx();
let session: { conn: Connection; chat: ChatBox; hud: Hud } | null = null;
/** O jogo 2.5D novo, quando é ele que está aberto. */
let newWorld: { destroy(): void } | null = null;
/** A cena do mapa atual (cada mapa ganha uma cena nova, com uma chave nova). */
let sceneKey: string | null = null;
let scenes = 0;

nameInput.value = loadSavedName();
// Quem nunca entrou vê "Como jogar" aberto; quem já joga, fechado (tela mais limpa)
(document.getElementById('how-to') as HTMLDetailsElement | null)?.toggleAttribute('open', !nameInput.value);
if (!matchMedia('(pointer: coarse)').matches) (nameInput.value ? passwordInput : nameInput).focus();

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = normalizeName(nameInput.value);
  const problem = nameProblem(name);
  if (problem) {
    loginError.textContent = NAME_ERRORS[problem];
    return;
  }
  const password = passwordInput.value;
  const badPassword = passwordProblem(password);
  if (badPassword) {
    loginError.textContent = PASSWORD_ERRORS[badPassword];
    return;
  }
  loginError.textContent = '';
  sfx.unlock(); // clique do jogador: agora o navegador deixa tocar som
  loginButton.disabled = true;
  loginButton.textContent = 'Entrando...';
  try {
    const { conn, welcome } = await Connection.join(name, password, undefined, undefined, NEW_WORLD);
    saveName(name);
    if (NEW_WORLD) await startNewWorldGame(conn, welcome);
    else startGame(conn, welcome);
  } catch (error) {
    loginError.textContent = error instanceof JoinError ? JOIN_ERRORS[error.reason] : 'Algo deu errado. Tente de novo.';
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Entrar no mundo';
  }
});

function startGame(conn: Connection, welcome: WelcomeMsg): void {
  loginOverlay.hidden = true;
  const chat = new ChatBox((text) => conn.send({ t: 'chat', text }));
  const hud = new Hud(welcome.you.name);
  session = { conn, chat, hud };
  conn.onClose = (reason) => endGame(reason ? BYE_MESSAGES[reason] : 'A conexão com o servidor caiu. Entre de novo.');

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#101a12',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    input: { keyboard: false }, // o teclado é lido por nós (para não brigar com o chat)
    audio: { noAudio: true },
    banner: false,
  });
  showWorld(conn, welcome, 0, false);
}

/** O jogo 2.5D novo (src/client/novo): carrega só quando é ele que vai abrir. */
async function startNewWorldGame(conn: Connection, welcome: WelcomeMsg): Promise<void> {
  loginOverlay.hidden = true;
  const chat = new ChatBox((text) => conn.send({ t: 'chat', text }));
  const hud = new Hud(welcome.you.name);
  session = { conn, chat, hud };
  conn.onClose = (reason) => endGame(reason ? BYE_MESSAGES[reason] : 'A conexão com o servidor caiu. Entre de novo.');
  try {
    const { startNewWorld } = await import('./novo/engine');
    newWorld = await startNewWorld({ conn, welcome, chat, hud });
  } catch (error) {
    endGame((error as Error).message);
  }
}

/** Mostra o mapa de `welcome.map` (trocando de cena quando o personagem muda de mapa). */
function showWorld(conn: Connection, welcome: WelcomeMsg, seq: number, arrived: boolean): void {
  if (!game || !session) return;
  if (sceneKey) game.scene.remove(sceneKey);
  sceneKey = `mapa-${++scenes}`;
  const data: WorldSceneData = {
    conn,
    welcome,
    chat: session.chat,
    hud: session.hud,
    sfx,
    seq,
    arrived,
    travel: (next, nextSeq) => showWorld(conn, next, nextSeq, true),
  };
  game.scene.add(sceneKey, WorldScene, true, data);
}

function endGame(message: string): void {
  game?.destroy(true);
  game = null;
  newWorld?.destroy();
  newWorld = null;
  sceneKey = null;
  if (session) {
    session.conn.close();
    session.chat.destroy();
    session.hud.destroy();
    session = null;
  }
  document.getElementById('labels')?.replaceChildren();
  loginOverlay.hidden = false;
  loginError.textContent = message;
}

function loadSavedName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // sem armazenamento (aba anônima etc.): tudo bem, só não lembra o nome
  }
}
