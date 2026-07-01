/**
 * Campaign Orchestrator
 *
 * Central coordinator for call campaigns.
 * Manages campaign lifecycle: create → activate → monitor → complete.
 */

import { v4 as uuid } from 'uuid';

export class CampaignOrchestrator {
  #db;
  #bitrix24;
  #complianceGuard;
  #dialingEngine;
  #logger;

  constructor({ db, bitrix24, complianceGuard, dialingEngine, logger }) {
    this.#db = db;
    this.#bitrix24 = bitrix24;
    this.#complianceGuard = complianceGuard;
    this.#dialingEngine = dialingEngine;
    this.#logger = logger.child({ module: 'campaign-orchestrator' });
  }

  /**
   * Create a new campaign
   */
  async createCampaign({ name, segmentFilter, scriptId, schedule, limits }) {
    const id = uuid();
    const campaign = {
      id,
      name,
      status: 'draft',
      segment_filter: JSON.stringify(segmentFilter),
      script_id: scriptId || null,
      schedule: JSON.stringify(schedule || {
        start: '09:00',
        end: '18:00',
        timezone: 'America/Sao_Paulo',
      }),
      limits: JSON.stringify(limits || {
        maxConcurrent: 10,
        ratePerMinute: 5,
        maxAttempts: 3,
      }),
    };

    this.#db.prepare(`
      INSERT INTO campaigns (id, name, status, segment_filter, script_id, schedule, limits)
      VALUES (@id, @name, @status, @segment_filter, @script_id, @schedule, @limits)
    `).run(campaign);

    this.#logger.info({ id, name }, 'Campaign created');
    return campaign;
  }

  /**
   * Activate a campaign: segment contacts, create call tasks, start dialing
   */
  async activateCampaign(campaignId) {
    const campaign = this.#db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
    if (campaign.status !== 'draft' && campaign.status !== 'paused') {
      throw new Error(`Campaign cannot be activated (status: ${campaign.status})`);
    }

    this.#logger.info({ campaignId }, 'Activating campaign...');

    // 1. Segment contacts from Bitrix24
    const contacts = await this.#segmentContacts(JSON.parse(campaign.segment_filter));
    this.#logger.info({ campaignId, count: contacts.length }, 'Contacts segmented');

    // 2. Create call tasks for each contact
    const stmt = this.#db.prepare(`
      INSERT INTO call_tasks (id, campaign_id, contact_id, phone, status, priority, max_attempts)
      VALUES (@id, @campaign_id, @contact_id, @phone, @status, @priority, @max_attempts)
    `);

    const limits = JSON.parse(campaign.limits);
    const insertMany = this.#db.transaction((items) => {
      for (const item of items) stmt.run(item);
    });

    const tasks = contacts.map((contact, index) => ({
      id: uuid(),
      campaign_id: campaignId,
      contact_id: String(contact.ID),
      phone: this.#extractPhone(contact),
      status: 'pending',
      priority: index + 1,
      max_attempts: limits.maxAttempts || 3,
    })).filter(t => t.phone); // Skip contacts without phone

    insertMany(tasks);

    // 3. Update campaign status
    this.#db.prepare('UPDATE campaigns SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('active', campaignId);

    // 4. Start dialing engine for this campaign
    await this.#dialingEngine.startCampaign(campaignId);

    this.#logger.info({ campaignId, tasksCreated: tasks.length }, 'Campaign activated');
    return { campaignId, contactsFound: contacts.length, tasksCreated: tasks.length };
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId) {
    this.#db.prepare('UPDATE campaigns SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('paused', campaignId);
    await this.#dialingEngine.pauseCampaign(campaignId);
    this.#logger.info({ campaignId }, 'Campaign paused');
  }

  /**
   * Get campaign status with statistics
   */
  getCampaignStatus(campaignId) {
    const campaign = this.#db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

    const stats = this.#db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM call_tasks
      WHERE campaign_id = ?
      GROUP BY status
    `).all(campaignId);

    const statusMap = Object.fromEntries(stats.map(s => [s.status, s.count]));

    return {
      ...campaign,
      stats: {
        pending: statusMap.pending || 0,
        dialing: statusMap.dialing || 0,
        'in-progress': statusMap['in-progress'] || 0,
        completed: statusMap.completed || 0,
        failed: statusMap.failed || 0,
        skipped: statusMap.skipped || 0,
      },
    };
  }

  /**
   * Segment contacts from Bitrix24 based on filter criteria
   */
  async #segmentContacts(segmentFilter) {
    const { entityType, filter } = segmentFilter;

    if (entityType === 'lead') {
      return this.#bitrix24.listLeads(filter || {}, ['ID', 'NAME', 'PHONE', 'STATUS_ID', 'ASSIGNED_BY_ID']);
    }

    // Default to contacts
    return this.#bitrix24.listContacts(filter || {}, ['ID', 'NAME', 'PHONE', 'ASSIGNED_BY_ID']);
  }

  /**
   * Extract primary phone number from a CRM entity
   */
  #extractPhone(entity) {
    if (entity.PHONE && Array.isArray(entity.PHONE) && entity.PHONE.length > 0) {
      return entity.PHONE[0].VALUE;
    }
    if (entity.PHONE && typeof entity.PHONE === 'string') {
      return entity.PHONE;
    }
    return null;
  }
}
