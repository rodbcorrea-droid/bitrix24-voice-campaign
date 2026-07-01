/**
 * ConversationStateManager tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConversationStateManager } from '../../src/modules/conversation-state-manager/index.js';
import Database from 'better-sqlite3';
import { unlinkSync, existsSync } from 'node:fs';

const TEST_DB = 'data/test-conversation.db';
const mockLogger = {
  child: () => mockLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

describe('ConversationStateManager', () => {
  let db;
  let manager;

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    db = new Database(TEST_DB);
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_states (
        call_task_id TEXT PRIMARY KEY,
        turns TEXT NOT NULL DEFAULT '[]',
        slots TEXT NOT NULL DEFAULT '{}',
        current_step TEXT NOT NULL DEFAULT 'greeting',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    manager = new ConversationStateManager({ db, logger: mockLogger });
  });

  afterEach(() => {
    db.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it('returns null for non-existent state', () => {
    const state = manager.getState('nonexistent');
    expect(state).toBeNull();
  });

  it('saves and retrieves state correctly', () => {
    const state = {
      turns: [{ role: 'agent', text: 'Ola!', timestamp: '2026-01-01T00:00:00Z' }],
      slots: { interestLevel: 'high' },
      currentStep: 'qualifying',
    };

    manager.saveState('task-1', state);
    const retrieved = manager.getState('task-1');

    expect(retrieved).toBeTruthy();
    expect(retrieved.callTaskId).toBe('task-1');
    expect(retrieved.turns).toHaveLength(1);
    expect(retrieved.turns[0].text).toBe('Ola!');
    expect(retrieved.slots.interestLevel).toBe('high');
    expect(retrieved.currentStep).toBe('qualifying');
  });

  it('updates existing state on conflict', () => {
    manager.saveState('task-2', { turns: [], slots: {}, currentStep: 'greeting' });
    manager.saveState('task-2', { turns: [{ role: 'agent', text: 'hi' }], slots: { x: 1 }, currentStep: 'closing' });

    const state = manager.getState('task-2');
    expect(state.currentStep).toBe('closing');
    expect(state.turns).toHaveLength(1);
  });

  it('deletes state', () => {
    manager.saveState('task-3', { turns: [], slots: {}, currentStep: 'greeting' });
    manager.deleteState('task-3');
    expect(manager.getState('task-3')).toBeNull();
  });

  it('lists active states', () => {
    manager.saveState('a', { turns: [], slots: {}, currentStep: 'greeting' });
    manager.saveState('b', { turns: [], slots: {}, currentStep: 'closing' });

    const active = manager.listActive();
    expect(active.length).toBeGreaterThanOrEqual(2);
  });
});
