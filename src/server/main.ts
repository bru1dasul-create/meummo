import { startServer } from './server';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST || undefined; // vazio = aceita conexões de qualquer interface

const server = await startServer({ port, host });

let stopping = false;
async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log('Desligando o servidor...');
  await server.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
