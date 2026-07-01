/**
 * Config module tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig, resetConfig, getConfiguredFeatures } from '../../src/core/config.js';

describe('Config', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('loads with defaults when .env has minimum values', () => {
    const config = loadConfig({
      BITRIX24_WEBHOOK_URL: 'https://test.bitrix24.com/rest/1/abc/',
    });
    expect(config.PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.NODE_ENV).toBe('development');
  });

  it('validates TELEPHONY_PROVIDER enum', () => {
    expect(() => loadConfig({ TELEPHONY_PROVIDER: 'invalid' }))
      .toThrow();
  });

  it('validates STT_PROVIDER enum', () => {
    expect(() => loadConfig({ STT_PROVIDER: 'invalid' }))
      .toThrow();
  });

  it('accepts valid provider values', () => {
    const config = loadConfig({
      TELEPHONY_PROVIDER: 'twilio',
      STT_PROVIDER: 'deepgram',
      LLM_PROVIDER: 'anthropic',
      TTS_PROVIDER: 'elevenlabs',
    });
    expect(config.TELEPHONY_PROVIDER).toBe('twilio');
    expect(config.STT_PROVIDER).toBe('deepgram');
  });

  it('returns configured features', () => {
    const config = loadConfig({
      BITRIX24_WEBHOOK_URL: 'https://test.bitrix24.com/rest/1/abc/',
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: 'token',
      STT_API_KEY: 'key',
      LLM_API_KEY: 'key',
      TTS_API_KEY: 'key',
    });
    const features = getConfiguredFeatures(config);
    expect(features.bitrix24_webhook).toBe(true);
    expect(features.twilio).toBe(true);
    expect(features.deepgram).toBe(true);
    expect(features.anthropic).toBe(true);
    expect(features.elevenlabs).toBe(true);
  });
});
