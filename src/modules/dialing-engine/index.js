/**
 * Dialing Engine
 *
 * Manages the call queue, rate limiting, and call execution.
 * Pulls pending tasks and orchestrates actual phone calls.
 */

export class DialingEngine {
  #db;
  #config;
  #complianceGuard;
  #telephonyBridge;
  #voiceAgent;
  #logger;
  #activeTimers = new Map(); // campaignId → interval

  constructor({ db, config, complianceGuard, telephonyBridge, voiceAgent, logger }) {
    this.#db = db;
    this.#config = config;
    this.#complianceGuard = complianceGuard;
    this.#telephonyBridge = telephonyBridge;
    this.#voiceAgent = voiceAgent;
    this.#logger = logger.child({ module: 'dialing-engine' });
  }

  /**
   * Start processing calls for a campaign
   */
  async startCampaign(campaignId) {
    this.#logger.info({ campaignId }, 'Starting dialing engine for campaign');

    const campaign = this.#db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

    const limits = JSON.parse(campaign.limits);
    const intervalMs = (60 * 1000) / (limits.ratePerMinute || 5);

    // Start processing loop
    const timer = setInterval(async () => {
      try {
        await this.#processNextBatch(campaignId, limits.maxConcurrent || 10);
      } catch (err) {
        this.#logger.error({ campaignId, err: err.message }, 'Error processing call batch');
      }
    }, intervalMs);

    this.#activeTimers.set(campaignId, timer);

    // Process first batch immediately
    await this.#processNextBatch(campaignId, limits.maxConcurrent || 10);
  }

  /**
   * Pause dialing for a campaign
   */
  async pauseCampaign(campaignId) {
    const timer = this.#activeTimers.get(campaignId);
    if (timer) {
      clearInterval(timer);
      this.#activeTimers.delete(campaignId);
    }
    this.#logger.info({ campaignId }, 'Dialing engine paused');
  }

  /**
   * Process next batch of pending calls
   */
  async #processNextBatch(campaignId, maxConcurrent) {
    // Count currently active calls
    const activeCalls = this.#db.prepare(`
      SELECT COUNT(*) as count FROM call_tasks
      WHERE campaign_id = ? AND status IN ('dialing', 'in-progress')
    `).get(campaignId);

    const availableSlots = maxConcurrent - activeCalls.count;
    if (availableSlots <= 0) return;

    // Get next pending tasks
    const tasks = this.#db.prepare(`
      SELECT * FROM call_tasks
      WHERE campaign_id = ? AND status = 'pending'
        AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
      ORDER BY priority ASC
      LIMIT ?
    `).all(campaignId, availableSlots);

    for (const task of tasks) {
      // Compliance check
      const check = this.#complianceGuard.check({
        contactId: task.contact_id,
        phone: task.phone,
      });

      if (!check.allowed) {
        this.#db.prepare('UPDATE call_tasks SET status = ?, result = ? WHERE id = ?')
          .run('skipped', JSON.stringify({ reason: check.reason }), task.id);
        this.#logger.info({ taskId: task.id, reason: check.reason }, 'Call skipped (compliance)');
        continue;
      }

      // Execute call (fire and forget — don't block the batch)
      this.#executeCall(task).catch(err => {
        this.#logger.error({ taskId: task.id, err: err.message }, 'Call execution failed');
      });
    }
  }

  /**
   * Execute a single call
   */
  async #executeCall(task) {
    this.#logger.info({ taskId: task.id, phone: task.phone }, 'Initiating call');

    // Mark as dialing
    this.#db.prepare(`
      UPDATE call_tasks
      SET status = 'dialing', attempts = attempts + 1, last_attempt_at = datetime('now')
      WHERE id = ?
    `).run(task.id);

    try {
      // Dial via telephony bridge
      const callResult = await this.#telephonyBridge.dial({
        phone: task.phone,
        contactId: task.contact_id,
      });

      if (!callResult.connected) {
        this.#handleCallFailed(task, callResult.reason || 'no-answer');
        return;
      }

      // Mark as in-progress
      this.#db.prepare('UPDATE call_tasks SET status = ? WHERE id = ?')
        .run('in-progress', task.id);

      // Run voice agent conversation
      const conversationResult = await this.#voiceAgent.handleConversation({
        callTaskId: task.id,
        contactId: task.contact_id,
        audioStream: callResult.audioStream,
      });

      // Mark as completed
      this.#db.prepare(`
        UPDATE call_tasks
        SET status = 'completed', result = ?, transcript = ?
        WHERE id = ?
      `).run(
        JSON.stringify(conversationResult),
        conversationResult.transcript || '',
        task.id
      );

      this.#logger.info({ taskId: task.id, result: conversationResult.category }, 'Call completed');
    } catch (err) {
      this.#handleCallFailed(task, err.message);
    }
  }

  /**
   * Handle a failed call attempt
   */
  #handleCallFailed(task, reason) {
    const maxAttempts = task.max_attempts;
    const currentAttempts = task.attempts + 1;

    if (currentAttempts >= maxAttempts) {
      // Max attempts reached — mark as failed
      this.#db.prepare(`
        UPDATE call_tasks SET status = 'failed', result = ? WHERE id = ?
      `).run(JSON.stringify({ reason, attempts: currentAttempts }), task.id);
      this.#logger.warn({ taskId: task.id, attempts: currentAttempts }, 'Call failed (max attempts)');
    } else {
      // Schedule retry with exponential backoff
      const retryDelayMs = Math.pow(2, currentAttempts) * 60 * 1000; // 2^n minutes
      const nextRetry = new Date(Date.now() + retryDelayMs).toISOString();

      this.#db.prepare(`
        UPDATE call_tasks SET status = 'pending', next_retry_at = ?, result = ? WHERE id = ?
      `).run(nextRetry, JSON.stringify({ reason, attempt: currentAttempts }), task.id);
      this.#logger.info({ taskId: task.id, nextRetry }, 'Call scheduled for retry');
    }
  }
}
