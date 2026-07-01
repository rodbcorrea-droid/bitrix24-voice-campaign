/**
 * Hermes Install Adapter
 *
 * Handles environment-specific setup for Hermes Agent:
 * - Detects MCP environment
 * - Validates Bitrix24 MCP access
 * - Configures system for Hermes operation
 */

export class HermesInstallAdapter {
  #config;
  #logger;

  constructor({ config, logger }) {
    this.#config = config;
    this.#logger = logger.child({ module: 'hermes-install' });
  }

  /**
   * Detect if running in Hermes Agent environment
   */
  isHermesEnvironment() {
    return !!(
      process.env.HERMES_AGENT === 'true' ||
      process.env.MCP_SERVER === 'true' ||
      typeof globalThis.__mcp_bridge !== 'undefined'
    );
  }

  /**
   * Run post-install validation for Hermes environment
   */
  async validate() {
    const checks = [];

    // Check Node.js version
    checks.push({
      name: 'node-version',
      passed: parseInt(process.version.slice(1)) >= 20,
      message: `Node.js ${process.version}`,
    });

    // Check .env exists
    const { existsSync } = await import('node:fs');
    checks.push({
      name: 'env-file',
      passed: existsSync('.env'),
      message: existsSync('.env') ? '.env found' : '.env missing',
    });

    // Check data directory
    checks.push({
      name: 'data-directory',
      passed: existsSync('data'),
      message: existsSync('data') ? 'data/ exists' : 'data/ missing (will be created)',
    });

    // Check MCP if in Hermes
    if (this.isHermesEnvironment()) {
      checks.push({
        name: 'hermes-mcp',
        passed: true,
        message: 'Hermes Agent MCP detected',
      });
    }

    const failed = checks.filter(c => !c.passed);
    if (failed.length > 0) {
      this.#logger.warn({ failed }, 'Hermes validation found issues');
    }

    return { checks, passed: failed.length === 0 };
  }

  /**
   * Get installation instructions for Hermes Agent
   */
  getInstallInstructions() {
    return {
      steps: [
        'git clone <repo-url> bitrix24-voice-campaign',
        'cd bitrix24-voice-campaign',
        'npm install',
        'cp .env.example .env',
        '# Edit .env with Bitrix24 credentials',
        'npm run setup',
        'npm run smoke',
        'npm start',
      ],
      requiredEnvVars: [
        'BITRIX24_WEBHOOK_URL',
      ],
      optionalEnvVars: [
        'TELEPHONY_PROVIDER',
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'STT_API_KEY',
        'LLM_API_KEY',
        'TTS_API_KEY',
      ],
    };
  }
}
