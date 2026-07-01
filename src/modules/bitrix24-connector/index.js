/**
 * Bitrix24 Connector — Unified Entry Point
 *
 * Provides a single interface for all Bitrix24 operations.
 * Automatically selects REST or MCP based on capabilities.
 */

import { Bitrix24RestClient } from './rest-client.js';
import { Bitrix24McpAdapter } from './mcp-adapter.js';

/**
 * Create a Bitrix24 connector based on available capabilities
 * @param {object} opts
 * @param {object} opts.config - Application config
 * @param {object} opts.capabilities - Capability map from checker
 * @param {object} opts.logger - Pino logger
 * @returns {Bitrix24RestClient|Bitrix24McpAdapter}
 */
export function createBitrix24Connector({ config, capabilities, logger }) {
  const childLogger = logger.child({ module: 'bitrix24-connector' });

  // Always create REST client if webhook is configured
  const restClient = config.BITRIX24_WEBHOOK_URL
    ? new Bitrix24RestClient({
        webhookUrl: config.BITRIX24_WEBHOOK_URL,
        logger: childLogger,
      })
    : null;

  // If MCP is available, wrap with adapter
  if (capabilities.bitrix24_mcp) {
    childLogger.info('Using MCP adapter for Bitrix24');
    return new Bitrix24McpAdapter({ logger: childLogger, restClient });
  }

  // If REST is available, use directly
  if (restClient) {
    childLogger.info('Using direct REST client for Bitrix24');
    return restClient;
  }

  // No Bitrix24 connection available
  childLogger.warn('No Bitrix24 connection configured — returning mock');
  return createMockConnector(childLogger);
}

/**
 * Mock connector for development/testing without Bitrix24 access
 */
function createMockConnector(logger) {
  logger.warn('Using mock Bitrix24 connector — no real CRM operations');

  const noop = async (...args) => {
    logger.debug({ args }, 'Mock call (noop)');
    return [];
  };

  return {
    call: noop,
    listContacts: noop,
    getContact: noop,
    updateContact: noop,
    listLeads: noop,
    getLead: noop,
    updateLead: noop,
    registerCall: noop,
    finishCall: noop,
    attachTranscription: noop,
    createActivity: noop,
  };
}

export { Bitrix24RestClient, Bitrix24McpAdapter };
