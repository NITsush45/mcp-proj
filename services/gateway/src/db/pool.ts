import { Pool } from 'pg';
import type { Env } from '../config/env.js';

let pool: Pool | null = null;

export function getPool(env: Env): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: env.DATABASE_URL, max: 10, idleTimeoutMillis: 30000 });
    pool.on('error', (e) => console.error(JSON.stringify({ level: 'error', msg: 'pg pool error', e: String(e) })));
  }
  return pool;
}

export async function checkDb(env: Env): Promise<boolean> {
  try {
    const p = getPool(env);
    await p.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
