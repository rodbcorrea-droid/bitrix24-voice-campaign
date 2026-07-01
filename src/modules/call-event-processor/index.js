/**
 * Call Event Processor
 *
 * Processes telephony events (call start, end, fail) and triggers
 * appropriate actions: CRM updates, metrics, notifications.
 */

export class CallEventProcessor {
  #db;
  #crmWriteback;
  #logger;

  constructor({ db, crmWriteback, logger }) {
    this.#db = db;
    this.#crmWriteback = crmWriteback;
    this.#logger = logger.child({ module: 'call-event-processor' });
  }

  /**
   * Process a call event
   * @param {object} event
   * @param {string} event.callTaskId - Associated call task
   * @param {string} event.type - Event type: call_init, call_start, call_end, call_fail
   * @param {object} event.data - Event payload
   */
  async processEvent(event) {
    const { callTaskId, type, data } = event;

    this.#logger.info({ callTaskId, type }, 'Processing call event');

    // Store event
    this.#db.prepare(`
      INSERT INTO call_events (id, call_task_id, event_type, payload)
      VALUES (@id, @callTaskId, @type, @payload)
    `).run({
      id: `${callTaskId}-${type}-${Date.now()}`,
      callTaskId,
      type,
      payload: JSON.stringify(data),
    });

    // Route to handler
    switch (type) {
      case 'call_init':
        return this.#handleCallInit(callTaskId, data);
      case 'call_start':
        return this.#handleCallStart(callTaskId, data);
      case 'call_end':
        return this.#handleCallEnd(callTaskId, data);
      case 'call_fail':
        return this.#handleCallFail(callTaskId, data);
      default:
        this.#logger.warn({ type }, 'Unknown event type');
    }
  }

  #handleCallInit(callTaskId, data) {
    this.#logger.info({ callTaskId }, 'Call initialized');
  }

  #handleCallStart(callTaskId, data) {
    this.#db.prepare('UPDATE call_tasks SET status = ? WHERE id = ?')
      .run('in-progress', callTaskId);
    this.#logger.info({ callTaskId }, 'Call started');
  }

  async #handleCallEnd(callTaskId, data) {
    this.#logger.info({ callTaskId, duration: data.duration }, 'Call ended');

    // Writeback to CRM will be handled by the orchestrator
    // after voice agent completes
  }

  #handleCallFail(callTaskId, data) {
    this.#db.prepare('UPDATE call_tasks SET status = ?, result = ? WHERE id = ?')
      .run('failed', JSON.stringify({ reason: data.reason }), callTaskId);
    this.#logger.warn({ callTaskId, reason: data.reason }, 'Call failed');
  }

  /**
   * Get event history for a call task
   */
  getEvents(callTaskId) {
    return this.#db.prepare('SELECT * FROM call_events WHERE call_task_id = ? ORDER BY created_at')
      .all(callTaskId);
  }
}
