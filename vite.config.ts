import { createLogger, defineConfig } from 'vite';

// Quando o servidor do jogo reinicia (acontece ao salvar um arquivo do servidor), as conexões
// repassadas pelo Vite caem e ele imprime um "Error: ECONNRESET" assustador. Isso é normal:
// o jogo mostra "A conexão caiu" e basta entrar de novo. Então escondemos só esse aviso.
const logger = createLogger();
const logError = logger.error.bind(logger);
logger.error = (message, options) => {
  if (message.includes('ws proxy') && /ECONNRESET|ECONNREFUSED|EPIPE/.test(message)) return;
  logError(message, options);
};

// O Vite compila e entrega o cliente (o jogo no navegador).
// Em desenvolvimento ele repassa o WebSocket /ws para o servidor do jogo na porta 3000.
export default defineConfig({
  customLogger: logger,
  root: 'src/client',
  publicDir: '../../public',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500, // o Phaser sozinho já é grande
  },
  server: {
    port: 5173,
    host: true, // permite abrir pelo celular na mesma rede Wi-Fi
    open: process.env.ABRIR_NAVEGADOR === '1', // o jogar.bat liga isso para abrir o navegador sozinho
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
