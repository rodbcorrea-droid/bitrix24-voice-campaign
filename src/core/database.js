/**
 * SQLite database manager
 *
 * Creates and manages the local SQLite database for campaign state,
 * call logs, and audit trail. Auto-creates on first use.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let _db = null;

/**
 * Initialize database connection and run migrations
 * @param {string} dbPath - Path to SQLite file
 * @param {object} logger - Pino logger instance
 * @returns {Database.Database}
 */
export function initDatabase(dbPath, logger) {
  if (_db) return _db;

  // Ensure directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  logger.info({ dbPath }, 'Database initialized');
  runMigrations(_db, logger);

  return _db;
}

/**
 * Get current database instance
 */
export function getDatabase() {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Run schema migrations
 */
function runMigrations(db, logger) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      segment_filter TEXT NOT NULL,
      script_id TEXT,
      schedule TEXT NOT NULL,
      limits TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_tasks (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id),
      contact_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 1,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      last_attempt_at TEXT,
      next_retry_at TEXT,
      result TEXT,
      crm_activity_id TEXT,
      transcript TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_states (
      call_task_id TEXT PRIMARY KEY REFERENCES call_tasks(id),
      turns TEXT NOT NULL DEFAULT '[]',
      slots TEXT NOT NULL DEFAULT '{}',
      current_step TEXT NOT NULL DEFAULT 'greeting',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_events (
      id TEXT PRIMARY KEY,
      call_task_id TEXT REFERENCES call_tasks(id),
      event_type TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_call_tasks_campaign ON call_tasks(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_call_tasks_status ON call_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_call_tasks_contact ON call_tasks(contact_id);
    CREATE INDEX IF NOT EXISTS idx_call_events_task ON call_events(call_task_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
  `);

  logger.info('Database migrations completed');
}
