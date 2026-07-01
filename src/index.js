/**
 * Bitrix24 Voice Campaign — Main Entry Point
 *
 * Initializes all modules and starts the system.
 */

import { loadConfig } from './core/config.js';
import { createLogger } from './core/logger.js';
import { initDatabase, closeDatabase } from './core/database.js';
import { createServer } from './core/server.js';
import { checkCapabilities } from './modules/mcp-capability-checker/index.js';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.NODE_ENV === 'development',
});

async function main() {
  logger.info('Starting Bitrix24 Voice Campaign System...');

  // 1. Load configuration
  const config = loadConfig();
  logger.info({ env: config.NODE_ENV, port: config.PORT }, 'Configuration loaded');

  // 2. Initialize database
  const db = initDatabase(config.DB_PATH, logger);

  // 3. Check capabilities
  const capabilities = await checkCapabilities(config, logger);
  logger.info({ capabilities }, 'Capability check completed');

  // 4. Start HTTP server
  const server = await createServer({ config, db, logger, capabilities });
  await server.listen({ port: config.PORT, host: config.HOST });

  logger.info({ port: config.PORT }, 'System ready');

  // 5. Graceful shutdown
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down...');
    await server.close();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error during startup');
  process.exit(1);
});
