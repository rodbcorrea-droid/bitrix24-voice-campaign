/**
 * Build Check Script
 *
 * Validates that the project is ready for deployment.
 * Run: npm run build:check
 */

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push({ name, status: 'PASS' });
    console.log(`  ✅ ${name}`);
  } catch (err) {
    checks.push({ name, status: 'FAIL', error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

console.log('\n🔍 Build Check\n');

check('package.json exists', () => {
  if (!existsSync('package.json')) throw new Error('Missing');
});

check('.env.example exists', () => {
  if (!existsSync('.env.example')) throw new Error('Missing');
});

check('.gitignore exists', () => {
  if (!existsSync('.gitignore')) throw new Error('Missing');
});

check('README.md exists', () => {
  if (!existsSync('README.md')) throw new Error('Missing');
});

check('src/index.js exists', () => {
  if (!existsSync('src/index.js')) throw new Error('Missing');
});

check('All modules have index.js', () => {
  const modules = [
    'campaign-orchestrator', 'dialing-engine', 'bitrix24-connector',
    'mcp-capability-checker', 'voice-agent-runtime', 'conversation-state-manager',
    'crm-writeback-service', 'call-event-processor', 'transcript-summarizer',
    'compliance-guard', 'admin-ops-dashboard',
  ];
  const missing = modules.filter(m => !existsSync(`src/modules/${m}/index.js`));
  if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
});

check('No .env with secrets committed', () => {
  if (existsSync('.env')) {
    // Check if .env is in gitignore
    const gitignore = existsSync('.gitignore') ? require('node:fs').readFileSync('.gitignore', 'utf8') : '';
    if (!gitignore.includes('.env')) {
      throw new Error('.env exists but not in .gitignore');
    }
  }
});

check('Node.js version >= 20', () => {
  const version = process.version;
  const major = parseInt(version.slice(1));
  if (major < 20) throw new Error(`Node.js ${version} found, need >= 20`);
});

// Summary
const passed = checks.filter(c => c.status === 'PASS').length;
const failed = checks.filter(c => c.status === 'FAIL').length;

console.log(`\n${'='.repeat(50)}`);
console.log(`Build Check: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) process.exit(1);
console.log('✅ Build check passed!\n');
