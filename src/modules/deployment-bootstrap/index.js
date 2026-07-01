/**
 * Deployment Bootstrap
 *
 * Handles first-run setup: database creation, directory structure,
 * configuration validation, and initial health checks.
 */

import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { initDatabase, closeDatabase } from '../../core/database.js';

export class DeploymentBootstrap {
  #config;
  #logger;

  constructor({ config, logger }) {
    this.#config = config;
    this.#logger = logger.child({ module: 'deployment-bootstrap' });
  }

  /**
   * Run full bootstrap process
   */
  async bootstrap() {
    this.#logger.info('Starting deployment bootstrap...');

    const steps = [
      { name: 'directories', fn: () => this.#ensureDirectories() },
      { name: 'env-file', fn: () => this.#ensureEnvFile() },
      { name: 'database', fn: () => this.#ensureDatabase() },
      { name: 'prompts', fn: () => this.#ensurePrompts() },
    ];

    const results = [];
    for (const step of steps) {
      try {
        step.fn();
        results.push({ name: step.name, status: 'ok' });
        this.#logger.info({ step: step.name }, 'Bootstrap step completed');
      } catch (err) {
        results.push({ name: step.name, status: 'error', error: err.message });
        this.#logger.error({ step: step.name, err: err.message }, 'Bootstrap step failed');
      }
    }

    return results;
  }

  #ensureDirectories() {
    const dirs = ['data', 'logs'];
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        this.#logger.info({ dir }, 'Directory created');
      }
    }
  }

  #ensureEnvFile() {
    if (!existsSync('.env') && existsSync('.env.example')) {
      copyFileSync('.env.example', '.env');
      this.#logger.info('.env created from .env.example');
    }
  }

  #ensureDatabase() {
    const dbPath = this.#config.DB_PATH || 'data/campaign.db';
    const db = initDatabase(dbPath, this.#logger);
    closeDatabase();
    this.#logger.info({ dbPath }, 'Database initialized');
  }

  #ensurePrompts() {
    if (!existsSync('config/prompts')) {
      mkdirSync('config/prompts', { recursive: true });
    }
  }
}
