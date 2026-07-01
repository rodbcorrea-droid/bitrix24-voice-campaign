/**
 * Configuration loader
 *
 * Loads from .env, validates required variables, provides typed access.
 * Never exposes secrets in logs or error messages.
 */

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Bitrix24
  BITRIX24_WEBHOOK_URL: z.string().url().optional(),
  BITRIX24_OAUTH_CLIENT_ID: z.string().optional(),
  BITRIX24_OAUTH_CLIENT_SECRET: z.string().optional(),
  BITRIX24_OAUTH_ACCESS_TOKEN: z.string().optional(),
  BITRIX24_OAUTH_REFRESH_TOKEN: z.string().optional(),

  // Telephony
  TELEPHONY_PROVIDER: z.enum(['bitrix24', 'twilio', 'sip']).default('twilio'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_WEBSOCKET_URL: z.string().optional(),
  SIP_HOST: z.string().optional(),
  SIP_PORT: z.coerce.number().default(5060),
  SIP_USERNAME: z.string().optional(),
  SIP_PASSWORD: z.string().optional(),

  // Voice AI
  STT_PROVIDER: z.enum(['deepgram', 'whisper']).default('deepgram'),
  STT_API_KEY: z.string().optional(),
  STT_MODEL: z.string().default('nova-2'),
  STT_LANGUAGE: z.string().default('pt-BR'),
  LLM_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  LLM_MAX_TOKENS: z.coerce.number().default(500),
  LLM_SYSTEM_PROMPT_PATH: z.string().default('config/prompts/agent-system.txt'),
  TTS_PROVIDER: z.enum(['elevenlabs', 'playht']).default('elevenlabs'),
  TTS_API_KEY: z.string().optional(),
  TTS_VOICE_ID: z.string().default('21m00Tcm4TlvDq8ikWAM'),
  TTS_MODEL: z.string().default('eleven_multilingual_v2'),

  // Campaign defaults
  CAMPAIGN_DEFAULT_TIMEZONE: z.string().default('America/Sao_Paulo'),
  CAMPAIGN_DEFAULT_START_HOUR: z.coerce.number().default(9),
  CAMPAIGN_DEFAULT_END_HOUR: z.coerce.number().default(18),
  CAMPAIGN_DEFAULT_MAX_CONCURRENT: z.coerce.number().default(10),
  CAMPAIGN_DEFAULT_RATE_PER_MINUTE: z.coerce.number().default(5),
  CAMPAIGN_DEFAULT_MAX_ATTEMPTS: z.coerce.number().default(3),

  // Compliance
  COMPLIANCE_LGPD_ENABLED: z.coerce.boolean().default(true),
  COMPLIANCE_DND_HOURS_START: z.coerce.number().default(21),
  COMPLIANCE_DND_HOURS_END: z.coerce.number().default(8),
  COMPLIANCE_MAX_CALLS_PER_CONTACT: z.coerce.number().default(3),
  COMPLIANCE_OPT_OUT_CHECK: z.coerce.boolean().default(true),

  // Database
  DB_PATH: z.string().default('data/campaign.db'),

  // Dashboard
  DASHBOARD_ENABLED: z.coerce.boolean().default(true),
  DASHBOARD_USERNAME: z.string().default('admin'),
  DASHBOARD_PASSWORD: z.string().default('change-me-in-production'),
});

let _config = null;

/**
 * Load and validate configuration. Cached after first call.
 * @param {object} [override] - Override values (for testing)
 * @returns {z.infer<typeof envSchema>}
 */
export function loadConfig(override = {}) {
  if (_config && !override || Object.keys(override).length === 0) {
    if (_config) return _config;
  }

  const result = envSchema.safeParse({ ...process.env, ...override });

  if (!result.success) {
    const missing = result.error.issues.map(i => i.path.join('.'));
    throw new Error(
      `Configuration errors: ${missing.join(', ')}. ` +
      `Check your .env file against .env.example`
    );
  }

  _config = result.data;
  return _config;
}

/**
 * Reset config cache (for testing)
 */
export function resetConfig() {
  _config = null;
}

/**
 * Check which features are configured
 */
export function getConfiguredFeatures(config) {
  return {
    bitrix24_webhook: !!config.BITRIX24_WEBHOOK_URL,
    bitrix24_oauth: !!config.BITRIX24_OAUTH_ACCESS_TOKEN,
    twilio: !!(config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN),
    sip: !!(config.SIP_HOST && config.SIP_USERNAME),
    deepgram: !!config.STT_API_KEY,
    whisper: config.STT_PROVIDER === 'whisper' && !!config.STT_API_KEY,
    anthropic: config.LLM_PROVIDER === 'anthropic' && !!config.LLM_API_KEY,
    openai: config.LLM_PROVIDER === 'openai' && !!config.LLM_API_KEY,
    elevenlabs: config.TTS_PROVIDER === 'elevenlabs' && !!config.TTS_API_KEY,
    playht: config.TTS_PROVIDER === 'playht' && !!config.TTS_API_KEY,
  };
}
