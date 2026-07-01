/**
 * MCP Capability Checker
 *
 * Detects available capabilities at runtime:
 * - Bitrix24 REST API (webhook URL)
 * - Bitrix24 MCP (Hermes Agent environment)
 * - Telephony provider availability
 * - Voice AI component availability
 */

/**
 * Check all system capabilities
 * @param {object} config - Loaded configuration
 * @param {object} logger - Pino logger
 * @returns {object} Capability map
 */
export async function checkCapabilities(config, logger) {
  logger.info('Checking system capabilities...');

  const capabilities = {
    bitrix24_rest: false,
    bitrix24_mcp: false,
    telephony_native: false,
    telephony_external: false,
    voice_stt: false,
    voice_llm: false,
    voice_tts: false,
    mode: 'limited', // limited | basic | full
  };

  // Check Bitrix24 REST
  if (config.BITRIX24_WEBHOOK_URL) {
    capabilities.bitrix24_rest = await testBitrix24Rest(config, logger);
  }

  // Check Bitrix24 MCP (Hermes Agent)
  capabilities.bitrix24_mcp = await detectMcpEnvironment(logger);

  // Check Telephony
  if (config.TELEPHONY_PROVIDER === 'twilio' && config.TWILIO_ACCOUNT_SID) {
    capabilities.telephony_external = true;
  } else if (config.TELEPHONY_PROVIDER === 'sip' && config.SIP_HOST) {
    capabilities.telephony_external = true;
  } else if (config.TELEPHONY_PROVIDER === 'bitrix24') {
    capabilities.telephony_native = capabilities.bitrix24_rest || capabilities.bitrix24_mcp;
  }

  // Check Voice AI
  capabilities.voice_stt = !!config.STT_API_KEY;
  capabilities.voice_llm = !!config.LLM_API_KEY;
  capabilities.voice_tts = !!config.TTS_API_KEY;

  // Determine operating mode
  if (capabilities.telephony_external && capabilities.voice_stt && capabilities.voice_llm && capabilities.voice_tts) {
    capabilities.mode = 'full'; // Full voice AI
  } else if (capabilities.bitrix24_rest || capabilities.bitrix24_mcp) {
    capabilities.mode = 'basic'; // CRM only, no voice AI
  } else {
    capabilities.mode = 'limited'; // Mock/simulation only
  }

  logger.info({ capabilities }, 'Capability check completed');
  return capabilities;
}

/**
 * Test Bitrix24 REST API connectivity
 */
async function testBitrix24Rest(config, logger) {
  try {
    const response = await fetch(`${config.BITRIX24_WEBHOOK_URL}crm.contact.list?SELECT[]=ID&start=0`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    if (data.error) {
      logger.warn({ error: data.error_description }, 'Bitrix24 REST API returned error');
      return false;
    }
    logger.info('Bitrix24 REST API connection successful');
    return true;
  } catch (err) {
    logger.warn({ err: err.message }, 'Bitrix24 REST API not reachable');
    return false;
  }
}

/**
 * Detect if running in MCP environment (Hermes Agent)
 */
async function detectMcpEnvironment(logger) {
  // Check for MCP-specific environment variables or signals
  const mcpIndicators = [
    process.env.HERMES_AGENT === 'true',
    process.env.MCP_SERVER === 'true',
    process.env.MCP_TOOLS_AVAILABLE === 'true',
    typeof globalThis.__mcp_bridge !== 'undefined',
  ];

  const isMcp = mcpIndicators.some(Boolean);
  if (isMcp) {
    logger.info('MCP environment detected (Hermes Agent)');
  }
  return isMcp;
}
