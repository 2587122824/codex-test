const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const schemaPath = path.join(root, 'server', 'aliyun-functions', 'rds-schema.sql');
const contractPath = path.join(root, 'server', 'aliyun-functions', 'api-contract.md');
const implementationPlanPath = path.join(root, 'server', 'aliyun-functions', 'IMPLEMENTATION_PLAN.md');
const packagePath = path.join(root, 'server', 'aliyun-functions', 'package.json');
const indexPath = path.join(root, 'server', 'aliyun-functions', 'index.js');
const handlerPath = path.join(root, 'server', 'aliyun-functions', 'handler.js');
const postgresAdapterPath = path.join(root, 'server', 'aliyun-functions', 'postgres-adapter.js');
const smsAdapterPath = path.join(root, 'server', 'aliyun-functions', 'aliyun-sms-adapter.js');
const smokePath = path.join(root, 'scripts', 'smoke-aliyun-handler.js');

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
  if (!schema.includes('theme_mode text not null default')) {
    missing.push('missing RDS settings theme_mode column');
  }
  if (
    !schema.includes('create table if not exists sleep_logs') ||
    !schema.includes('id text not null') ||
    !schema.includes('primary key (user_id, id)')
  ) {
    missing.push('sleep_logs must use a user-scoped opaque text primary key');
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
  if (!contract.includes('"message": "Human-readable error message."')) {
    missing.push('missing API error response shape');
  }
  if (!contract.includes('opaque client strings')) {
    missing.push('missing opaque client ID sync contract note');
  }
}

if (!fs.existsSync(implementationPlanPath)) {
  missing.push('server/aliyun-functions/IMPLEMENTATION_PLAN.md');
} else {
  const plan = fs.readFileSync(implementationPlanPath, 'utf8');
  for (const phrase of ['Node.js 20', 'opaque random tokens', 'POST /sync/merge', 'First Manual Smoke Test']) {
    if (!plan.includes(phrase)) {
      missing.push(`implementation plan missing: ${phrase}`);
    }
  }
}

if (!fs.existsSync(handlerPath)) {
  missing.push('server/aliyun-functions/handler.js');
} else {
  const handler = fs.readFileSync(handlerPath, 'utf8');
  for (const phrase of [
    "path === '/auth/send-code'",
    "path === '/auth/verify-code'",
    "path === '/auth/session'",
    "path === '/auth/logout'",
    "path === '/sync/merge'",
    'exports.handler',
    'createMemoryAdapter',
  ]) {
    if (!handler.includes(phrase)) {
      missing.push(`handler missing: ${phrase}`);
    }
  }
}

if (!fs.existsSync(indexPath)) {
  missing.push('server/aliyun-functions/index.js');
} else {
  const index = fs.readFileSync(indexPath, 'utf8');
  for (const phrase of ['createPostgresAdapter()', 'createAliyunSmsAdapter()', 'exports.handler']) {
    if (!index.includes(phrase)) {
      missing.push(`production entry missing: ${phrase}`);
    }
  }
}

if (!fs.existsSync(packagePath)) {
  missing.push('server/aliyun-functions/package.json');
} else {
  const packageJson = fs.readFileSync(packagePath, 'utf8');
  for (const phrase of ['"main": "index.js"', '"pg"', '"@alicloud/dysmsapi20170525"', '"@alicloud/openapi-client"']) {
    if (!packageJson.includes(phrase)) {
      missing.push(`backend package missing: ${phrase}`);
    }
  }
}

if (!fs.existsSync(smokePath)) {
  missing.push('scripts/smoke-aliyun-handler.js');
}

if (!fs.existsSync(postgresAdapterPath)) {
  missing.push('server/aliyun-functions/postgres-adapter.js');
} else {
  const adapter = fs.readFileSync(postgresAdapterPath, 'utf8');
  for (const phrase of [
    'createPostgresAdapter',
    'auth_sms_codes',
    'auth_sessions',
    'user_favorites',
    'play_history',
    'sleep_logs',
    'user_settings',
  ]) {
    if (!adapter.includes(phrase)) {
      missing.push(`postgres adapter missing: ${phrase}`);
    }
  }
}

if (!fs.existsSync(smsAdapterPath)) {
  missing.push('server/aliyun-functions/aliyun-sms-adapter.js');
} else {
  const adapter = fs.readFileSync(smsAdapterPath, 'utf8');
  for (const phrase of [
    'createAliyunSmsAdapter',
    '@alicloud/dysmsapi20170525',
    'ALIYUN_SMS_SIGN_NAME',
    'ALIYUN_SMS_TEMPLATE_CODE',
    'sendSms',
  ]) {
    if (!adapter.includes(phrase)) {
      missing.push(`sms adapter missing: ${phrase}`);
    }
  }
}

if (missing.length > 0) {
  console.error(`Aliyun backend validation failed:\n- ${missing.join('\n- ')}`);
  process.exit(1);
}

console.log(`Aliyun backend validation passed: ${requiredTables.length} tables, ${requiredRoutes.length} routes.`);
