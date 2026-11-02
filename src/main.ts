import http from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './common/logger.js';
import { socketService } from './modules/socket/socket.service.js';
import { runSeed } from './seed.js';

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize WebSockets
  socketService.initialize(server);

  // Seed baseline data
  await runSeed();

  server.listen(config.port, () => {
    logger.info(`=======================================================`);
    logger.info(`  GatiGo Taxi & Mobility Platform Backend running     `);
    logger.info(`  Port: ${config.port} | Mode: ${config.env}           `);
    logger.info(`  REST API:   http://localhost:${config.port}/api/v1  `);
    logger.info(`  Health:     http://localhost:${config.port}/health  `);
    logger.info(`  WebSocket:  ws://localhost:${config.port}/socket.io `);
    logger.info(`=======================================================`);
  });

  const shutdown = () => {
    logger.info('Shutting down GatiGo backend gracefully...');
    server.close(() => {
      logger.info('HTTP & WebSocket servers closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  logger.error('Fatal error during backend startup:', err);
  process.exit(1);
});
