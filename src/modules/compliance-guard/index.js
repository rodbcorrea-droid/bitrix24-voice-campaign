/**
 * Compliance Guard
 *
 * Middleware that validates every outbound call against compliance rules:
 * - Time-of-day restrictions (DND hours)
 * - Opt-out / block lists
 * - Max attempts per contact
 * - LGPD consent verification
 */

export class ComplianceGuard {
  #config;
  #db;
  #logger;

  constructor({ config, db, logger }) {
    this.#config = config;
    this.#db = db;
    this.#logger = logger.child({ module: 'compliance-guard' });
  }

  /**
   * Check if a call to the given contact is allowed
   * @param {object} params
   * @param {string} params.contactId - CRM contact ID
   * @param {string} params.phone - Phone number
   * @param {string} [params.timezone] - Contact timezone
   * @returns {{ allowed: boolean, reason?: string }}
   */
  check({ contactId, phone, timezone }) {
    // 1. DND hours check
    const dndResult = this.#checkDndHours(timezone);
    if (!dndResult.allowed) return dndResult;

    // 2. Opt-out check
    const optOutResult = this.#checkOptOut(contactId, phone);
    if (!optOutResult.allowed) return optOutResult;

    // 3. Max attempts check
    const attemptsResult = this.#checkMaxAttempts(contactId);
    if (!attemptsResult.allowed) return attemptsResult;

    // 4. LGPD consent (if enabled)
    if (this.#config.COMPLIANCE_LGPD_ENABLED) {
      // LGPD check requires CRM data, so we pass through here
      // Actual verification happens in the campaign orchestrator
      this.#logger.debug({ contactId }, 'LGPD check deferred to CRM integration');
    }

    this.#logger.debug({ contactId, phone }, 'Compliance check passed');
    return { allowed: true };
  }

  /**
   * Register an opt-out for a contact
   */
  registerOptOut(contactId, phone, reason = 'contact_request') {
    this.#db.prepare(`
      INSERT OR IGNORE INTO audit_log (action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?)
    `).run('opt_out', 'contact', contactId, JSON.stringify({ phone, reason }));

    this.#logger.info({ contactId, reason }, 'Opt-out registered');
  }

  #checkDndHours(timezone) {
    if (!this.#config.COMPLIANCE_DND_HOURS_START || !this.#config.COMPLIANCE_DND_HOURS_END) {
      return { allowed: true };
    }

    const now = new Date();
    // Use configured timezone or provided timezone
    const tz = timezone || this.#config.CAMPAIGN_DEFAULT_TIMEZONE;
    const hour = parseInt(
      new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, timeZone: tz }).format(now)
    );

    const start = this.#config.COMPLIANCE_DND_HOURS_START;
    const end = this.#config.COMPLIANCE_DND_HOURS_END;

    // Handle wrap-around (e.g., 21:00 - 08:00)
    const isDnd = start > end
      ? (hour >= start || hour < end)
      : (hour >= start && hour < end);

    if (isDnd) {
      this.#logger.warn({ hour, start, end, timezone: tz }, 'Call blocked: DND hours');
      return {
        allowed: false,
        reason: `Do Not Disturb hours (${start}:00 - ${end}:00 ${tz})`,
      };
    }

    return { allowed: true };
  }

  #checkOptOut(contactId, phone) {
    const optOut = this.#db.prepare(`
      SELECT 1 FROM audit_log
      WHERE action = 'opt_out' AND entity_type = 'contact' AND entity_id = ?
      LIMIT 1
    `).get(contactId);

    if (optOut) {
      this.#logger.warn({ contactId }, 'Call blocked: contact opted out');
      return { allowed: false, reason: 'Contact has opted out' };
    }

    return { allowed: true };
  }

  #checkMaxAttempts(contactId) {
    const maxAttempts = this.#config.COMPLIANCE_MAX_CALLS_PER_CONTACT;
    if (!maxAttempts) return { allowed: true };

    const attempts = this.#db.prepare(`
      SELECT COUNT(*) as count FROM call_tasks
      WHERE contact_id = ? AND status IN ('completed', 'failed')
    `).get(contactId);

    if (attempts.count >= maxAttempts) {
      this.#logger.warn({ contactId, attempts: attempts.count, maxAttempts }, 'Call blocked: max attempts');
      return {
        allowed: false,
        reason: `Maximum attempts reached (${attempts.count}/${maxAttempts})`,
      };
    }

    return { allowed: true };
  }
}
