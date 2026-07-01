/**
 * HTTP Server (Fastify)
 *
 * Serves dashboard, API endpoints, and health checks.
 */

import Fastify from 'fastify';

/**
 * Create and configure the HTTP server
 */
export async function createServer({ config, db, logger, capabilities }) {
  const server = Fastify({
    logger: config.NODE_ENV === 'development',
  });

  // Health check
  server.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    capabilities,
  }));

  // Dashboard status
  server.get('/api/status', async () => {
    const campaigns = db.prepare('SELECT COUNT(*) as count FROM campaigns WHERE status = ?').get('active');
    const pendingCalls = db.prepare('SELECT COUNT(*) as count FROM call_tasks WHERE status = ?').get('pending');
    const completedCalls = db.prepare('SELECT COUNT(*) as count FROM call_tasks WHERE status = ?').get('completed');

    return {
      campaigns: campaigns.count,
      pending_calls: pendingCalls.count,
      completed_calls: completedCalls.count,
      capabilities,
    };
  });

  // Campaign CRUD
  server.get('/api/campaigns', async () => {
    return db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  });

  server.get('/api/campaigns/:id', async (request) => {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(request.params.id);
    if (!campaign) throw new Error('Campaign not found');
    return campaign;
  });

  // Call tasks for a campaign
  server.get('/api/campaigns/:id/calls', async (request) => {
    return db.prepare('SELECT * FROM call_tasks WHERE campaign_id = ? ORDER BY created_at DESC')
      .all(request.params.id);
  });

  return server;
}
