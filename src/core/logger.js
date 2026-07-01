/**
 * Structured logger using Pino
 *
 * Logs are JSON in production, pretty-printed in development.
 * Secrets are automatically redacted.
 */

import pino from 'pino';

const REDACTED_FIELDS = [
  'password', 'token', 'secret', 'key', 'authorization',
  'apiKey', 'api_key', 'accessToken', 'access_token',
  'refreshToken', 'refresh_token', 'authToken', 'auth_token',
];

/**
 * Create a logger instance
 * @param {object} opts
 * @param {string} opts.level - Log level
 * @param {string} opts.name - Service/module name
 * @param {boolean} opts.pretty - Pretty print (dev mode)
 */
export function createLogger({ level = 'info', name = 'voice-campaign', pretty = false } = {}) {
  const transport = pretty
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined;

  return pino({
    name,
    level,
    transport,
    redact: {
      paths: REDACTED_FIELDS,
      censor: '[REDACTED]',
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

/**
 * Create a child logger for a specific module
 * @param {pino.Logger} parent
 * @param {string} module
 */
export function moduleLogger(parent, module) {
  return parent.child({ module });
}
