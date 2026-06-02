const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const schemaPath = path.join(root, 'server', 'aliyun-functions', 'rds-schema.sql');
const contractPath = path.join(root, 'server', 'aliyun-functions', 'api-contract.md');

const requiredTables = [
  'profiles',
  'user_settings',
  'user_favorites',
  'play_history',
  'sleep_logs',
  'auth_sms_codes',
  'auth_sessions',
];

const requiredRoutes = [
  'POST /auth/send-code',
  'POST /auth/verify-code',
  'GET /auth/session',
  'POST /auth/logout',
  'POST /sync/merge',
];

const missing = [];

if (!fs.existsSync(schemaPath)) {
  missing.push('server/aliyun-functions/rds-schema.sql');
} else {
  const schema = fs.readFileSync(schemaPath, 'utf8').toLowerCase();
  for (const table of requiredTables) {
    if (!schema.includes(`create table if not exists ${table}`)) {
      missing.push(`missing RDS table: ${table}`);
    }
  }
}

if (!fs.existsSync(contractPath)) {
  missing.push('server/aliyun-functions/api-contract.md');
} else {
  const contract = fs.readFileSync(contractPath, 'utf8');
  for (const route of requiredRoutes) {
    if (!contract.includes(route)) {
      missing.push(`missing API route contract: ${route}`);
    }
  }
}

if (missing.length > 0) {
  console.error(`Aliyun backend validation failed:\n- ${missing.join('\n- ')}`);
  process.exit(1);
}

console.log(`Aliyun backend validation passed: ${requiredTables.length} tables, ${requiredRoutes.length} routes.`);
