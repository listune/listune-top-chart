/**
 * Standalone refresh script for GitHub Actions.
 * Runs the same scraping logic as /api/cron/refresh but without needing to build/start Next.js.
 * 
 * Usage: node refresh-data.js
 * 
 * Required env vars:
 * - DATABASE_URL (MySQL/PostgreSQL/SQLite connection string)
 * - SCRAPE_COUNTRIES (optional, defaults to "global,id")
 * - TOP_TRACKS_LIMIT (optional, defaults to 25)
 */

require('dotenv').config();
const { execSync } = require('child_process');

// Use tsx to run TypeScript directly
try {
  console.log('🔄 Starting data refresh via standalone script...');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🌍 Countries: ${process.env.SCRAPE_COUNTRIES || 'global,id'}`);
  console.log(`📊 Track limit: ${process.env.TOP_TRACKS_LIMIT || '25'}`);
  console.log('');
  
  execSync('npx tsx refresh-worker.ts', {
    stdio: 'inherit',
    env: process.env,
  });
  
  console.log('');
  console.log('✅ Data refresh completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Data refresh failed:', error.message);
  process.exit(1);
}