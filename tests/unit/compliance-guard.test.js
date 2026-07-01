/**
 * ComplianceGuard tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComplianceGuard } from '../../src/modules/compliance-guard/index.js';
import Database from 'better-sqlite3';
import { unlinkSync, existsSync } from 'node:fs';

const TEST_DB = 'data/test-compliance.db';
const mockLogger = {
  child: () => mockLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

describe('ComplianceGuard', () => {
  let db;

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    db = new Database(TEST_DB);
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS call_tasks (
        id TEXT PRIMARY KEY,
        campaign_id TEXT,
        contact_id TEXT,
        phone TEXT,
        status TEXT,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3
      );
    `);
  });

  afterEach(() => {
    db.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it('allows call when no restrictions apply', () => {
    const guard = new ComplianceGuard({
      config: {
        COMPLIANCE_DND_HOURS_START: 0,
        COMPLIANCE_DND_HOURS_END: 0,
        COMPLIANCE_MAX_CALLS_PER_CONTACT: 0,
        COMPLIANCE_LGPD_ENABLED: false,
      },
      db,
      logger: mockLogger,
    });

    const result = guard.check({ contactId: '123', phone: '+5511999999999' });
    expect(result.allowed).toBe(true);
  });

  it('blocks call during DND hours', () => {
    const guard = new ComplianceGuard({
      config: {
        COMPLIANCE_DND_HOURS_START: 0,
        COMPLIANCE_DND_HOURS_END: 23,
        COMPLIANCE_MAX_CALLS_PER_CONTACT: 0,
        CAMPAIGN_DEFAULT_TIMEZONE: 'America/Sao_Paulo',
      },
      db,
      logger: mockLogger,
    });

    const result = guard.check({ contactId: '123', phone: '+5511999999999' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('DND');
  });

  it('blocks call after max attempts', () => {
    db.prepare('INSERT INTO call_tasks (id, campaign_id, contact_id, phone, status) VALUES (?, ?, ?, ?, ?)')
      .run('c1', 'camp1', '123', '+5511999999999', 'completed');
    db.prepare('INSERT INTO call_tasks (id, campaign_id, contact_id, phone, status) VALUES (?, ?, ?, ?, ?)')
      .run('c2', 'camp1', '123', '+5511999999999', 'completed');

    const guard = new ComplianceGuard({
      config: {
        COMPLIANCE_DND_HOURS_START: 0,
        COMPLIANCE_DND_HOURS_END: 0,
        COMPLIANCE_MAX_CALLS_PER_CONTACT: 2,
      },
      db,
      logger: mockLogger,
    });

    const result = guard.check({ contactId: '123', phone: '+5511999999999' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Maximum attempts');
  });

  it('blocks call for opted-out contact', () => {
    db.prepare('INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)')
      .run('opt_out', 'contact', '123', '{"reason":"test"}');

    const guard = new ComplianceGuard({
      config: {
        COMPLIANCE_DND_HOURS_START: 0,
        COMPLIANCE_DND_HOURS_END: 0,
        COMPLIANCE_MAX_CALLS_PER_CONTACT: 0,
      },
      db,
      logger: mockLogger,
    });

    const result = guard.check({ contactId: '123', phone: '+5511999999999' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('opted out');
  });

  it('registers opt-out correctly', () => {
    const guard = new ComplianceGuard({
      config: {},
      db,
      logger: mockLogger,
    });

    guard.registerOptOut('456', '+5511888888888', 'customer_request');

    const record = db.prepare('SELECT * FROM audit_log WHERE entity_id = ?').get('456');
    expect(record).toBeTruthy();
    expect(record.action).toBe('opt_out');
  });
});
