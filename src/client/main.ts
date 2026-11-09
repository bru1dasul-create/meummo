// Ponto de entrada do jogo no navegador: tela de entrada → conexão → mundo.

import Phaser from 'phaser';
import { NAME_MAX, NAME_MIN, nameProblem, normalizeName, type NameProblem } from '../shared/names';
import type { WelcomeMsg } from '../shared/protocol';
import { WorldScene } from './game/WorldScene';
import { Connection, JoinError, type JoinFailure } from './net';
import { ChatBox, Hud } from './ui';

const NAME_STORAGE_KEY = 'meummo:nome';

const loginOverlay = document.getElementById('login') as HTMLDivElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const nameInput = document.getElementById('name') as HTMLInputElement;
const loginButton = document.getElementById('login-button') as HTMLButtonElement;
const loginError = document.getElementById('login-error') as HTMLParagraphElement;

const NAME_ERRORS: Record<NameProblem, string> = {
  short: `O nome precisa ter pelo menos ${NAME_MIN} letras.`,
  long: `O nome pode ter no máximo ${NAME_MAX} caracteres.`,
  chars: 'Use só letras, números, espaço ou _ (e pelo menos uma letra).',
};

const JOIN_ERRORS: Record<JoinFailure, string> = {
  name_invalid: 'Esse nome não é válido.',
  name_taken: 'Já tem alguém online com esse nome. Escolha outro!',
  full: 'O servidor está cheio agora. Tente de novo daqui a pouco.',
  version: 'Seu jogo está desatualizado. Recarregue a página.',
  offline: 'Não consegui falar com o servidor. Ele está ligado?',
  timeout: 'O servidor demorou demais para responder. Tente de novo.',
};

let game: Phaser.Game | null = null;
let session: { conn: Connection; chat: ChatBox; hud: Hud } | null = null;

nameInput.value = loadSavedName();
if (!matchMedia('(pointer: coarse)').matches) nameInput.focus();

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = normalizeName(nameInput.value);
  const problem = nameProblem(name);
  if (problem) {
    loginError.textContent = NAME_ERRORS[problem];
    return;
  }
  loginError.textContent = '';
  loginButton.disabled = true;
  loginButton.textContent = 'Entrando...';
  try {
    const { conn, welcome } = await Connection.join(name);
    saveName(name);
    startGame(conn, welcome);
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
  conn.onClose = () => endGame('A conexão com o servidor caiu. Entre de novo.');

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
  game.scene.add('world', WorldScene, true, { conn, welcome, chat, hud });
}

function endGame(message: string): void {
  game?.destroy(true);
  game = null;
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
