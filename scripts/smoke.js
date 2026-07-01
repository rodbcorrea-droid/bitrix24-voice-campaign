/**
 * Smoke Test Script
 *
 * Validates that all components work end-to-end.
 * Run: npm run smoke
 */

import { loadConfig } from '../src/core/config.js';
import { createLogger } from '../src/core/logger.js';
import { initDatabase, closeDatabase } from '../src/core/database.js';
import { checkCapabilities } from '../src/modules/mcp-capability-checker/index.js';
import { createBitrix24Connector } from '../src/modules/bitrix24-connector/index.js';
import { ComplianceGuard } from '../src/modules/compliance-guard/index.js';
import { ConversationStateManager } from '../src/modules/conversation-state-manager/index.js';
import { v4 as uuid } from 'uuid';
import { unlinkSync, existsSync } from 'node:fs';

const logger = createLogger({ level: 'warn', pretty: true });
const TEST_DB = 'data/smoke-test.db';

const results = [];

function test(name, fn) {
  return async () => {
    try {
      await fn();
      results.push({ name, status: 'PASS' });
      console.log(`  ✅ ${name}`);
    } catch (err) {
      results.push({ name, status: 'FAIL', error: err.message });
      console.log(`  ❌ ${name}: ${err.message}`);
    }
  };
}

async function smoke() {
  console.log('\n🧪 Bitrix24 Voice Campaign — Smoke Tests\n');

  // Setup
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  process.env.DB_PATH = TEST_DB;

  const config = loadConfig({ DB_PATH: TEST_DB });
  const db = initDatabase(TEST_DB, logger);
  const capabilities = await checkCapabilities(config, logger);

  // --- Tests ---

  await test('Database: tables created', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    if (tables.length < 4) throw new Error(`Expected 4+ tables, got ${tables.length}`);
  })();

  await test('Database: can insert campaign', () => {
    db.prepare(`
      INSERT INTO campaigns (id, name, status, segment_filter, schedule, limits)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), 'Smoke Test Campaign', 'draft', '{}', '{}', '{}');
    const count = db.prepare('SELECT COUNT(*) as c FROM campaigns').get();
    if (count.c !== 1) throw new Error('Insert failed');
  })();

  await test('Database: can insert call task', () => {
    const campaignId = db.prepare('SELECT id FROM campaigns LIMIT 1').get().id;
    db.prepare(`
      INSERT INTO call_tasks (id, campaign_id, contact_id, phone, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid(), campaignId, '12345', '+5511999999999', 'pending');
    const count = db.prepare('SELECT COUNT(*) as c FROM call_tasks').get();
    if (count.c !== 1) throw new Error('Insert failed');
  })();

  await test('ComplianceGuard: blocks during DND hours', () => {
    // Temporarily set DND to current hour
    const guard = new ComplianceGuard({
      config: { ...config, COMPLIANCE_DND_HOURS_START: 0, COMPLIANCE_DND_HOURS_END: 23 },
      db,
      logger,
    });
    const result = guard.check({ contactId: '12345', phone: '+5511999999999' });
    if (result.allowed) throw new Error('Should have been blocked during DND');
  })();

  await test('ComplianceGuard: allows outside DND hours', () => {
    const guard = new ComplianceGuard({
      config: { ...config, COMPLIANCE_DND_HOURS_START: 23, COMPLIANCE_DND_HOURS_END: 0 },
      db,
      logger,
    });
    const result = guard.check({ contactId: '12345', phone: '+5511999999999' });
    if (!result.allowed) throw new Error(`Should be allowed: ${result.reason}`);
  })();

  await test('ComplianceGuard: blocks after max attempts', () => {
    const guard = new ComplianceGuard({
      config: { ...config, COMPLIANCE_MAX_CALLS_PER_CONTACT: 1 },
      db,
      logger,
    });
    // Insert a completed call for this contact
    const campaignId = db.prepare('SELECT id FROM campaigns LIMIT 1').get().id;
    db.prepare(`
      INSERT INTO call_tasks (id, campaign_id, contact_id, phone, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid(), campaignId, '99999', '+5511888888888', 'completed');

    const result = guard.check({ contactId: '99999', phone: '+5511888888888' });
    if (result.allowed) throw new Error('Should have been blocked after max attempts');
  })();

  await test('ConversationStateManager: save and retrieve', () => {
    const csm = new ConversationStateManager({ db, logger });
    const callTaskId = db.prepare('SELECT id FROM call_tasks LIMIT 1').get().id;
    const state = {
      turns: [{ role: 'agent', text: 'Olá!', timestamp: new Date().toISOString() }],
      slots: { interestLevel: 'high' },
      currentStep: 'qualifying',
    };
    csm.saveState(callTaskId, state);
    const retrieved = csm.getState(callTaskId);
    if (!retrieved) throw new Error('State not found');
    if (retrieved.currentStep !== 'qualifying') throw new Error('Step mismatch');
  })();

  await test('Bitrix24 connector: mock mode works', () => {
    const connector = createBitrix24Connector({
      config: { ...config, BITRIX24_WEBHOOK_URL: undefined },
      capabilities: { bitrix24_mcp: false, bitrix24_rest: false },
      logger,
    });
    // Should not throw
    connector.listContacts();
  })();

  await test('Capability check: returns valid mode', () => {
    if (!['full', 'basic', 'limited'].includes(capabilities.mode)) {
      throw new Error(`Invalid mode: ${capabilities.mode}`);
    }
  })();

  // Cleanup
  closeDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log(`${'='.repeat(50)}\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }

  console.log('✅ All smoke tests passed!\n');
}

smoke().catch(err => {
  console.error('Smoke test failed:', err.message);
  process.exit(1);
});
