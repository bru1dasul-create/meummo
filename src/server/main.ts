import { SAVE_FILE } from './paths';
import { startServer, type RunningServer } from './server';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST || undefined; // vazio = aceita conexões de qualquer interface
// MEUMMO_SAVE troca o arquivo dos personagens (ex.: para testar com um mundo vazio).
const saveFile = process.env.MEUMMO_SAVE || SAVE_FILE;

let server: RunningServer;
try {
  server = await startServer({ port, host, saveFile });
} catch (error) {
  const err = error as NodeJS.ErrnoException;
  console.error(
    err.code === 'EADDRINUSE'
      ? `\nA porta ${port} já está em uso: o jogo já está aberto em outra janela?\n`
      : `\nNão consegui ligar o servidor: ${err.message}\n`,
  );
  process.exit(1);
}

let stopping = false;
async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log('Salvando os personagens e desligando o servidor...');
  await server.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown); // no Windows: a janela do jogo foi fechada
