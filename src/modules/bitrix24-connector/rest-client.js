/**
 * Bitrix24 REST API Client
 *
 * Wrapper with retry, rate limiting, and error handling.
 * Uses webhook URL for authentication.
 */

const DEFAULT_RATE_LIMIT = 2; // requests per second
const DEFAULT_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 1000;

export class Bitrix24RestClient {
  #webhookUrl;
  #logger;
  #rateLimit;
  #lastRequestTime = 0;

  /**
   * @param {object} opts
   * @param {string} opts.webhookUrl - Bitrix24 webhook URL
   * @param {object} opts.logger - Pino logger
   * @param {number} [opts.rateLimit] - Max requests per second
   */
  constructor({ webhookUrl, logger, rateLimit = DEFAULT_RATE_LIMIT }) {
    if (!webhookUrl) throw new Error('Bitrix24 webhook URL is required');
    // Normalize: ensure trailing slash
    this.#webhookUrl = webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`;
    this.#logger = logger;
    this.#rateLimit = rateLimit;
  }

  /**
   * Execute a Bitrix24 REST API call
   * @param {string} method - API method (e.g., 'crm.contact.list')
   * @param {object} [params] - Method parameters
   * @returns {Promise<any>} API response result
   */
  async call(method, params = {}) {
    await this.#enforceRateLimit();

    const url = `${this.#webhookUrl}${method}`;
    this.#logger.debug({ method, params }, 'Bitrix24 API call');

    for (let attempt = 1; attempt <= DEFAULT_RETRY_COUNT; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(10000),
        });

        const data = await response.json();

        if (data.error) {
          const errMsg = data.error_description || data.error;
          if (data.error === 'QUERY_LIMIT_EXCEEDED') {
            this.#logger.warn({ method, attempt }, 'Rate limit hit, backing off');
            await this.#delay(RETRY_DELAY_MS * attempt * 2);
            continue;
          }
          throw new Bitrix24Error(errMsg, data.error, method);
        }

        this.#logger.debug({ method }, 'Bitrix24 API call successful');
        return data.result;
      } catch (err) {
        if (err instanceof Bitrix24Error) throw err;
        if (attempt === DEFAULT_RETRY_COUNT) {
          throw new Bitrix24Error(
            `API call failed after ${DEFAULT_RETRY_COUNT} attempts: ${err.message}`,
            'NETWORK_ERROR',
            method
          );
        }
        this.#logger.warn({ method, attempt, err: err.message }, 'API call failed, retrying');
        await this.#delay(RETRY_DELAY_MS * attempt);
      }
    }
  }

  // --- CRM Contact Methods ---

  async listContacts(filter = {}, select = [], start = 0) {
    const params = { filter, start };
    if (select.length) params.select = select;
    return this.call('crm.contact.list', params);
  }

  async getContact(id) {
    return this.call('crm.contact.get', { id });
  }

  async updateContact(id, fields) {
    return this.call('crm.contact.update', { id, fields });
  }

  // --- CRM Lead Methods ---

  async listLeads(filter = {}, select = [], start = 0) {
    const params = { filter, start };
    if (select.length) params.select = select;
    return this.call('crm.lead.list', params);
  }

  async getLead(id) {
    return this.call('crm.lead.get', { id });
  }

  async updateLead(id, fields) {
    return this.call('crm.lead.update', { id, fields });
  }

  // --- Telephony Methods ---

  async registerCall({ phoneNumber, direction, contactId, leadId, startDate }) {
    return this.call('telephony.externalCall.register', {
      PHONE_NUMBER: phoneNumber,
      DIRECTION: direction || 'outgoing',
      CRM_ENTITY_TYPE: leadId ? 'LEAD' : 'CONTACT',
      CRM_ENTITY_ID: leadId || contactId,
      START_DATE: startDate || new Date().toISOString(),
    });
  }

  async finishCall({ callId, duration, status, recordUrl }) {
    const params = {
      CALL_ID: callId,
      DURATION: duration,
      STATUS: status || 200, // 200 = completed
    };
    if (recordUrl) params.RECORD_URL = recordUrl;
    return this.call('telephony.externalCall.finish', params);
  }

  async attachTranscription({ callId, transcription }) {
    return this.call('telephony.call.attachTranscription', {
      CALL_ID: callId,
      TRANSCRIPTION: transcription,
    });
  }

  // --- Activity Methods ---

  async createActivity({ subject, description, typeId, ownerId, ownerTypeId, responsibleId, completed, deadline }) {
    return this.call('crm.activity.add', {
      fields: {
        SUBJECT: subject,
        DESCRIPTION: description,
        TYPE_ID: typeId || 2, // 2 = Call
        OWNER_ID: ownerId,
        OWNER_TYPE_ID: ownerTypeId || 3, // 3 = Contact
        RESPONSIBLE_ID: responsibleId,
        COMPLETED: completed || 'N',
        DEADLINE: deadline,
      },
    });
  }

  // --- Pagination Helper ---

  async listAll(method, filter = {}, select = []) {
    const results = [];
    let start = 0;

    while (true) {
      const batch = await this.call(method, { filter, select, start });
      if (!batch || batch.length === 0) break;
      results.push(...batch);
      if (batch.length < 50) break; // Bitrix24 returns max 50 per page
      start += batch.length;
    }

    return results;
  }

  // --- Internal ---

  async #enforceRateLimit() {
    const now = Date.now();
    const minInterval = 1000 / this.#rateLimit;
    const elapsed = now - this.#lastRequestTime;
    if (elapsed < minInterval) {
      await this.#delay(minInterval - elapsed);
    }
    this.#lastRequestTime = Date.now();
  }

  #delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class Bitrix24Error extends Error {
  constructor(message, code, method) {
    super(message);
    this.name = 'Bitrix24Error';
    this.code = code;
    this.method = method;
  }
}
