/**
 * Bitrix24 MCP Adapter
 *
 * Provides the same interface as Bitrix24RestClient but routes
 * through MCP tools when running in Hermes Agent environment.
 *
 * Falls back to REST client when MCP is not available.
 */

export class Bitrix24McpAdapter {
  #logger;
  #restClient;

  constructor({ logger, restClient }) {
    this.#logger = logger;
    this.#restClient = restClient;
  }

  /**
   * Check if MCP tools are available for a given method
   */
  async hasMcpTool(method) {
    // In Hermes environment, MCP tools would be injected
    // This checks for their presence
    try {
      const mcpBridge = globalThis.__mcp_bridge;
      if (!mcpBridge) return false;
      return typeof mcpBridge[method.replace(/\./g, '_')] === 'function' ||
             typeof mcpBridge.call === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Execute via MCP or fallback to REST
   */
  async call(method, params = {}) {
    const hasMcp = await this.hasMcpTool(method);

    if (hasMcp) {
      this.#logger.debug({ method }, 'Executing via MCP');
      try {
        return await this.#callMcp(method, params);
      } catch (err) {
        this.#logger.warn({ method, err: err.message }, 'MCP call failed, falling back to REST');
        return this.#restClient.call(method, params);
      }
    }

    this.#logger.debug({ method }, 'Executing via REST (MCP not available)');
    return this.#restClient.call(method, params);
  }

  async #callMcp(method, params) {
    const mcpBridge = globalThis.__mcp_bridge;
    if (typeof mcpBridge.call === 'function') {
      return mcpBridge.call(method, params);
    }
    // Direct tool call
    const toolName = method.replace(/\./g, '_');
    if (typeof mcpBridge[toolName] === 'function') {
      return mcpBridge[toolName](params);
    }
    throw new Error(`MCP tool not found: ${method}`);
  }

  // Delegate convenience methods to call()
  async listContacts(filter, select, start) { return this.call('crm.contact.list', { filter, select, start }); }
  async getContact(id) { return this.call('crm.contact.get', { id }); }
  async updateContact(id, fields) { return this.call('crm.contact.update', { id, fields }); }
  async listLeads(filter, select, start) { return this.call('crm.lead.list', { filter, select, start }); }
  async getLead(id) { return this.call('crm.lead.get', { id }); }
  async updateLead(id, fields) { return this.call('crm.lead.update', { id, fields }); }
  async registerCall(params) { return this.call('telephony.externalCall.register', params); }
  async finishCall(params) { return this.call('telephony.externalCall.finish', params); }
  async attachTranscription(params) { return this.call('telephony.call.attachTranscription', params); }
  async createActivity(params) { return this.call('crm.activity.add', params); }
}
