/**
 * Conversation State Manager
 *
 * Persists and retrieves conversation state for in-progress calls.
 * Uses SQLite for durability across process restarts.
 */

export class ConversationStateManager {
  #db;
  #logger;

  constructor({ db, logger }) {
    this.#db = db;
    this.#logger = logger.child({ module: 'conversation-state' });
  }

  /**
   * Get conversation state for a call task
   * @param {string} callTaskId
   * @returns {object|null}
   */
  getState(callTaskId) {
    const row = this.#db.prepare('SELECT * FROM conversation_states WHERE call_task_id = ?')
      .get(callTaskId);

    if (!row) return null;

    return {
      callTaskId: row.call_task_id,
      turns: JSON.parse(row.turns),
      slots: JSON.parse(row.slots),
      currentStep: row.current_step,
    };
  }

  /**
   * Save conversation state
   * @param {string} callTaskId
   * @param {object} state
   */
  saveState(callTaskId, state) {
    this.#db.prepare(`
      INSERT INTO conversation_states (call_task_id, turns, slots, current_step, updated_at)
      VALUES (@callTaskId, @turns, @slots, @currentStep, datetime('now'))
      ON CONFLICT(call_task_id) DO UPDATE SET
        turns = @turns,
        slots = @slots,
        current_step = @currentStep,
        updated_at = datetime('now')
    `).run({
      callTaskId,
      turns: JSON.stringify(state.turns || []),
      slots: JSON.stringify(state.slots || {}),
      currentStep: state.currentStep || 'greeting',
    });

    this.#logger.debug({ callTaskId, step: state.currentStep }, 'Conversation state saved');
  }

  /**
   * Delete conversation state (after call completes)
   */
  deleteState(callTaskId) {
    this.#db.prepare('DELETE FROM conversation_states WHERE call_task_id = ?').run(callTaskId);
    this.#logger.debug({ callTaskId }, 'Conversation state deleted');
  }

  /**
   * List all active conversation states
   */
  listActive() {
    const rows = this.#db.prepare('SELECT * FROM conversation_states ORDER BY updated_at DESC').all();
    return rows.map(row => ({
      callTaskId: row.call_task_id,
      turns: JSON.parse(row.turns),
      slots: JSON.parse(row.slots),
      currentStep: row.current_step,
      updatedAt: row.updated_at,
    }));
  }
}
