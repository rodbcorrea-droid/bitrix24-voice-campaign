/**
 * Telephony Bridge
 *
 * Abstracts telephony provider interactions.
 * Supports: Bitrix24 native, Twilio, SIP.
 */

export class TelephonyBridge {
  #config;
  #provider;
  #logger;

  constructor({ config, logger }) {
    this.#config = config;
    this.#logger = logger.child({ module: 'telephony-bridge' });
    this.#provider = this.#createProvider();
  }

  /**
   * Initiate an outbound call
   * @param {object} params
   * @param {string} params.phone - Phone number to call
   * @param {string} params.contactId - CRM contact ID
   * @returns {object} { connected: boolean, audioStream?: ReadableStream, callId?: string }
   */
  async dial({ phone, contactId }) {
    this.#logger.info({ phone, contactId, provider: this.#config.TELEPHONY_PROVIDER }, 'Initiating call');
    return this.#provider.dial({ phone, contactId });
  }

  /**
   * Hang up a call
   */
  async hangup(callId) {
    this.#logger.info({ callId }, 'Hanging up call');
    return this.#provider.hangup(callId);
  }

  /**
   * Get call status
   */
  async getStatus(callId) {
    return this.#provider.getStatus(callId);
  }

  #createProvider() {
    switch (this.#config.TELEPHONY_PROVIDER) {
      case 'twilio':
        return new TwilioProvider(this.#config, this.#logger);
      case 'bitrix24':
        return new Bitrix24TelephonyProvider(this.#config, this.#logger);
      case 'sip':
        return new SipProvider(this.#config, this.#logger);
      default:
        return new MockTelephonyProvider(this.#logger);
    }
  }
}

/**
 * Twilio Programmable Voice Provider
 */
class TwilioProvider {
  #config;
  #logger;

  constructor(config, logger) {
    this.#config = config;
    this.#logger = logger;
  }

  async dial({ phone, contactId }) {
    // Twilio API call to initiate outbound call
    const accountSid = this.#config.TWILIO_ACCOUNT_SID;
    const authToken = this.#config.TWILIO_AUTH_TOKEN;
    const fromNumber = this.#config.TWILIO_PHONE_NUMBER;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          From: fromNumber,
          Url: `${this.#config.TWILIO_WEBSOCKET_URL}/voice-webhook`,
          StatusCallback: `${this.#config.TWILIO_WEBSOCKET_URL}/call-status`,
          StatusCallbackEvent: 'initiated ringing answered completed',
          Record: 'true',
        }),
      }
    );

    const data = await response.json();

    if (data.error_code) {
      this.#logger.error({ error: data.error_message }, 'Twilio call failed');
      return { connected: false, reason: data.error_message };
    }

    return {
      connected: true,
      callId: data.sid,
      audioStream: null, // WebSocket media stream handled separately
    };
  }

  async hangup(callId) {
    const accountSid = this.#config.TWILIO_ACCOUNT_SID;
    const authToken = this.#config.TWILIO_AUTH_TOKEN;

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callId}.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ Status: 'completed' }),
      }
    );
  }

  async getStatus(callId) {
    // Implementation for checking call status
    return { status: 'unknown' };
  }
}

/**
 * Bitrix24 Native Telephony Provider
 * Uses voximplant.callback.start — limited to callbacks, no bidirectional audio
 */
class Bitrix24TelephonyProvider {
  #config;
  #logger;

  constructor(config, logger) {
    this.#config = config;
    this.#logger = logger;
  }

  async dial({ phone, contactId }) {
    this.#logger.warn('Using Bitrix24 native telephony — limited to callback, no voice AI');
    // This would call voximplant.callback.start via the Bitrix24 connector
    return {
      connected: true,
      callId: `b24-${Date.now()}`,
      audioStream: null,
      nativeOnly: true, // Flag: no voice AI possible
    };
  }

  async hangup(callId) {
    this.#logger.info({ callId }, 'Bitrix24 call hangup (managed by Bitrix24)');
  }

  async getStatus(callId) {
    return { status: 'managed-by-bitrix24' };
  }
}

/**
 * SIP Provider (generic)
 */
class SipProvider {
  #config;
  #logger;

  constructor(config, logger) {
    this.#config = config;
    this.#logger = logger;
  }

  async dial({ phone, contactId }) {
    this.#logger.info({ phone }, 'SIP dialing (implementation depends on SIP library)');
    // Would use SIP.js or similar library
    return { connected: false, reason: 'SIP provider not implemented yet' };
  }

  async hangup(callId) {}
  async getStatus(callId) { return { status: 'unknown' }; }
}

/**
 * Mock Telephony Provider (for testing)
 */
class MockTelephonyProvider {
  #logger;

  constructor(logger) {
    this.#logger = logger;
  }

  async dial({ phone, contactId }) {
    this.#logger.info({ phone, contactId }, 'Mock call initiated');
    const { Readable } = await import('node:stream');
    return {
      connected: true,
      callId: `mock-${Date.now()}`,
      audioStream: new Readable({ read() { this.push(null); } }),
    };
  }

  async hangup(callId) {
    this.#logger.info({ callId }, 'Mock call hangup');
  }

  async getStatus(callId) {
    return { status: 'completed' };
  }
}
