import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { loadEnv } from '../config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', '..', 'migrations');

async function main() {
  const env = loadEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`);
  for (const f of files) {
    const done = await pool.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [f]);
    if (done.rowCount) { console.log(`skip ${f}`); continue; }
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    console.log(`apply ${f}`);
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations(filename) VALUES($1)', [f]);
  }
  await pool.end();
  console.log('migrations done');
}

main().catch((e) => { console.error(e); process.exit(1); });
