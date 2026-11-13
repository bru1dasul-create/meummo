import { SAVE_FILE } from './paths';
import { startServer, type RunningServer } from './server';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST || undefined; // vazio = aceita conexões de qualquer interface
// MEUMMO_SAVE troca o arquivo dos personagens (ex.: para testar com um mundo vazio).
const saveFile = process.env.MEUMMO_SAVE || SAVE_FILE;
// MEUMMO_MAPA_INICIAL faz os personagens novos começarem em outro mapa (ex.: capao, para testar o mundo novo).
const startMap = process.env.MEUMMO_MAPA_INICIAL || undefined;

let server: RunningServer;
try {
  server = await startServer({ port, host, saveFile, startMap });
} catch (error) {
  const err = error as NodeJS.ErrnoException;
  console.error(
    err.code === 'EADDRINUSE'
      ? `\nA porta ${port} já está em uso: o jogo já está aberto em outra janela?\n`
      : `\nNão consegui ligar o servidor: ${err.message}\n`,
  );
  process.exit(1);
}

// Erro que escapou de tudo: fica nos registros (com o caminho do erro) antes de o servidor desligar.
process.on('uncaughtException', (error) => {
  server?.logbook.error('GRAVE, o servidor vai desligar', error);
  console.error(error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => server?.logbook.error('sem tratamento (promessa)', reason));

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
