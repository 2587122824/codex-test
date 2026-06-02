const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

const tables = ['profiles', 'user_settings', 'user_favorites', 'play_history', 'sleep_logs'];
const missing = [];

for (const table of tables) {
  if (!schema.includes(`create table if not exists public.${table}`)) {
    missing.push(`missing table ${table}`);
  }

  if (!schema.includes(`alter table public.${table} enable row level security`)) {
    missing.push(`missing RLS enable for ${table}`);
  }

  if (!schema.includes(`on public.${table}`) || !schema.includes('auth.uid() = user_id')) {
    missing.push(`missing owner policy for ${table}`);
  }
}

if (!schema.includes('deleted_at timestamptz')) {
  missing.push('missing soft delete deleted_at columns');
}

if (missing.length > 0) {
  console.error(`Supabase schema validation failed:\n- ${missing.join('\n- ')}`);
  process.exit(1);
}

console.log(`Supabase schema validation passed: ${tables.length} protected tables.`);
