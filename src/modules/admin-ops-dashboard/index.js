/**
 * Admin Operations Dashboard
 *
 * API endpoints for operational monitoring:
 * - Campaign status and statistics
 * - Call metrics and KPIs
 * - Compliance audit trail
 * - System health
 */

export class AdminOpsDashboard {
  #db;
  #logger;

  constructor({ db, logger }) {
    this.#db = db;
    this.#logger = logger.child({ module: 'admin-ops' });
  }

  /**
   * Get system overview
   */
  getOverview() {
    const campaigns = this.#db.prepare(`
      SELECT status, COUNT(*) as count FROM campaigns GROUP BY status
    `).all();

    const calls = this.#db.prepare(`
      SELECT status, COUNT(*) as count FROM call_tasks GROUP BY status
    `).all();

    const recentCalls = this.#db.prepare(`
      SELECT * FROM call_tasks ORDER BY created_at DESC LIMIT 10
    `).all();

    return {
      campaigns: Object.fromEntries(campaigns.map(c => [c.status, c.count])),
      calls: Object.fromEntries(calls.map(c => [c.status, c.count])),
      recentCalls,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get campaign statistics
   */
  getCampaignStats(campaignId) {
    const campaign = this.#db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) return null;

    const stats = this.#db.prepare(`
      SELECT
        status,
        COUNT(*) as count,
        AVG(attempts) as avg_attempts
      FROM call_tasks
      WHERE campaign_id = ?
      GROUP BY status
    `).all(campaignId);

    const results = this.#db.prepare(`
      SELECT
        json_extract(result, '$.category') as category,
        COUNT(*) as count
      FROM call_tasks
      WHERE campaign_id = ? AND result IS NOT NULL
      GROUP BY json_extract(result, '$.category')
    `).all(campaignId);

    return {
      campaign,
      stats: Object.fromEntries(stats.map(s => [s.status, { count: s.count, avgAttempts: s.avg_attempts }])),
      results: Object.fromEntries(results.map(r => [r.category || 'unknown', r.count])),
    };
  }

  /**
   * Get compliance audit trail
   */
  getAuditTrail(limit = 100) {
    return this.#db.prepare(`
      SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?
    `).all(limit);
  }

  /**
   * Get active conversations
   */
  getActiveConversations() {
    return this.#db.prepare(`
      SELECT cs.*, ct.phone, ct.contact_id
      FROM conversation_states cs
      JOIN call_tasks ct ON cs.call_task_id = ct.id
      ORDER BY cs.updated_at DESC
    `).all();
  }

  /**
   * Register dashboard routes on a Fastify server
   */
  registerRoutes(server) {
    server.get('/api/dashboard/overview', async () => this.getOverview());
    server.get('/api/dashboard/campaign/:id', async (req) => this.getCampaignStats(req.params.id));
    server.get('/api/dashboard/audit', async (req) => this.getAuditTrail(req.query.limit));
    server.get('/api/dashboard/conversations', async () => this.getActiveConversations());
  }
}
