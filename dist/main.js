"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_js_1 = require("./app.js");
const index_js_1 = require("./config/index.js");
const logger_js_1 = require("./common/logger.js");
const socket_service_js_1 = require("./modules/socket/socket.service.js");
const seed_js_1 = require("./seed.js");
async function bootstrap() {
    const app = (0, app_js_1.createApp)();
    const server = http_1.default.createServer(app);
    // Initialize WebSockets
    socket_service_js_1.socketService.initialize(server);
    // Seed baseline data
    await (0, seed_js_1.runSeed)();
    server.listen(index_js_1.config.port, () => {
        logger_js_1.logger.info(`=======================================================`);
        logger_js_1.logger.info(`  GatiGo Taxi & Mobility Platform Backend running     `);
        logger_js_1.logger.info(`  Port: ${index_js_1.config.port} | Mode: ${index_js_1.config.env}           `);
        logger_js_1.logger.info(`  REST API:   http://localhost:${index_js_1.config.port}/api/v1  `);
        logger_js_1.logger.info(`  Health:     http://localhost:${index_js_1.config.port}/health  `);
        logger_js_1.logger.info(`  WebSocket:  ws://localhost:${index_js_1.config.port}/socket.io `);
        logger_js_1.logger.info(`=======================================================`);
    });
    const shutdown = () => {
        logger_js_1.logger.info('Shutting down GatiGo backend gracefully...');
        server.close(() => {
            logger_js_1.logger.info('HTTP & WebSocket servers closed.');
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
bootstrap().catch((err) => {
    logger_js_1.logger.error('Fatal error during backend startup:', err);
    process.exit(1);
});
