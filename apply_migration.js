const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const password = process.argv[2];
if (!password) {
  console.log('Usage: node apply_migration.js YOUR_DB_PASSWORD');
  console.log('Find it at: Supabase Dashboard > Project Settings > Database > Connection string');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(__dirname, 'migrations/030_cross_session_learning.sql'), 'utf8');

const client = new Client({
  host: 'db.sdhdylsfngiybvoltoks.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: password,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await client.connect();
    console.log('Connected!');
    await client.query(sql);
    console.log('Migration 030 applied successfully!');

    const cols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('session_momentum', 'engagement_count', 'topic_saturation')"
    );
    console.log('New columns:', cols.rows.map(r => r.column_name));
    await client.end();
    console.log('Done!');
  } catch (e) {
    console.error('Error:', e.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
})();
