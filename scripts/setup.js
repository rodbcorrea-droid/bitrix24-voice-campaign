/**
 * Setup Script
 *
 * Validates environment, creates database, tests connections.
 * Run: npm run setup
 */

import { loadConfig, getConfiguredFeatures } from '../src/core/config.js';
import { createLogger } from '../src/core/logger.js';
import { initDatabase, closeDatabase } from '../src/core/database.js';
import { checkCapabilities } from '../src/modules/mcp-capability-checker/index.js';
import { existsSync, copyFileSync } from 'node:fs';

const logger = createLogger({ level: 'info', pretty: true });

async function setup() {
  console.log('\n🔧 Bitrix24 Voice Campaign — Setup\n');

  // 1. Check .env file
  console.log('📋 Step 1: Checking configuration...');
  if (!existsSync('.env')) {
    if (existsSync('.env.example')) {
      copyFileSync('.env.example', '.env');
      console.log('   ✅ Created .env from .env.example');
      console.log('   ⚠️  Please edit .env with your credentials before running\n');
    } else {
      console.log('   ❌ No .env or .env.example found');
      process.exit(1);
    }
  } else {
    console.log('   ✅ .env file exists');
  }

  // 2. Load and validate config
  console.log('\n📋 Step 2: Validating configuration...');
  let config;
  try {
    config = loadConfig();
    console.log('   ✅ Configuration is valid');
  } catch (err) {
    console.log(`   ❌ Configuration error: ${err.message}`);
    console.log('   ℹ️  Copy .env.example to .env and fill in your values');
    process.exit(1);
  }

  const features = getConfiguredFeatures(config);
  console.log('\n   Configured features:');
  for (const [feature, enabled] of Object.entries(features)) {
    console.log(`   ${enabled ? '✅' : '⬜'} ${feature}`);
  }

  // 3. Initialize database
  console.log('\n📋 Step 3: Initializing database...');
  try {
    const db = initDatabase(config.DB_PATH, logger);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`   ✅ Database created at ${config.DB_PATH}`);
    console.log(`   📊 Tables: ${tables.map(t => t.name).join(', ')}`);
    closeDatabase();
  } catch (err) {
    console.log(`   ❌ Database error: ${err.message}`);
    process.exit(1);
  }

  // 4. Check capabilities
  console.log('\n📋 Step 4: Checking capabilities...');
  try {
    const capabilities = await checkCapabilities(config, logger);
    console.log('\n   System capabilities:');
    for (const [cap, available] of Object.entries(capabilities)) {
      if (typeof available === 'boolean') {
        console.log(`   ${available ? '✅' : '⬜'} ${cap}`);
      }
    }
    console.log(`\n   🎯 Operating mode: ${capabilities.mode}`);
  } catch (err) {
    console.log(`   ⚠️  Capability check warning: ${err.message}`);
  }

  // 5. Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Setup completed successfully!');
  console.log('='.repeat(50));
  console.log('\nNext steps:');
  console.log('  1. Edit .env with your credentials');
  console.log('  2. Run: npm run smoke');
  console.log('  3. Run: npm start\n');
}

setup().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
