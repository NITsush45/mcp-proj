import type { Pool } from 'pg';
import { getRegistry } from './store.js';

/** Load upstream rows (+ server-side credentials) into the live registry. */
export async function syncRegistryFromDb(db: Pool): Promise<void> {
  const rows = await db.query(
    `SELECT s.slug, s.name, s.url, s.enabled, c.auth_header
     FROM upstream_servers s LEFT JOIN upstream_credentials c ON c.server_id = s.id
     ORDER BY s.name`);
  getRegistry().sync(rows.rows.map((r) => ({
    slug: r.slug, name: r.name, url: r.url, enabled: r.enabled,
    authHeader: r.auth_header ?? null,
  })));
}
