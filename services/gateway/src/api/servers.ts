import { Router } from 'express';
import { z } from 'zod';
import { validateUpstreamUrl } from '../security/ssrf.js';
import { getRegistry } from '../registry/store.js';
import { syncRegistryFromDb } from '../registry/sync.js';

export const serversRouter = Router();

const upsertSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  url: z.string().url().max(500),
  enabled: z.boolean().optional().default(true),
  authHeader: z.string().max(500).optional(),   // static credential — stored server-side, never returned
  description: z.string().max(500).optional().default(''),
});

function safe(row: Record<string, unknown>) {
  const { credential, authHeader, ...rest } = row as Record<string, unknown> & { credential?: unknown; authHeader?: unknown };
  void credential; void authHeader;
  return rest;
}

serversRouter.get('/', async (req, res, next) => {
  try {
    // Warm the live registry first: a freshly started gateway boots with an
    // empty cache, which would otherwise report every server as Unreachable.
    try { if (req.db) await syncRegistryFromDb(req.db); } catch { /* keep cache */ }
    await getRegistry().refreshAll(req.env?.UPSTREAM_DISCOVERY_TIMEOUT_MS ?? 5000);
    const reg = getRegistry();
    const rows = await req.db!.query('SELECT id, name, slug, url, enabled, description, created_at, updated_at FROM upstream_servers ORDER BY name');
    const data = rows.rows.map((r) => ({ ...safe(r), status: reg.status(r.slug), tools: reg.toolsOf(r.slug) }));
    res.json({ ok: true, data });
  } catch (e) { next(e); }
});

serversRouter.post('/', async (req, res, next) => {
  try {
    const body = upsertSchema.parse(req.body);
    const v = validateUpstreamUrl(body.url);
    if (!v.ok) return res.status(400).json({ ok: false, error: { code: 'BAD_URL', message: v.reason } });
    const slug = (body.slug ?? body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    // NOTE: credential stored server-side only (DB row not returned). K8s Secret mounting for
    // provisioned upstreams happens in Helm; dynamic credential goes to upstream_credentials table (Phase 4/5).
    const r = await req.db!.query(
      `INSERT INTO upstream_servers(name, slug, url, enabled, description) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, url=EXCLUDED.url, enabled=EXCLUDED.enabled, description=EXCLUDED.description, updated_at=now()
       RETURNING id, name, slug, url, enabled, description, created_at, updated_at`,
      [body.name, slug, body.url, body.enabled, body.description]);
    if (body.authHeader) {
      await req.db!.query(
        `INSERT INTO upstream_credentials(server_id, auth_header) VALUES($1,$2)
         ON CONFLICT (server_id) DO UPDATE SET auth_header=EXCLUDED.auth_header, updated_at=now()`, [r.rows[0].id, body.authHeader]);
    }
    getRegistry().invalidate();
    try { await syncRegistryFromDb(req.db!); await getRegistry().refreshAll(req.env!.UPSTREAM_DISCOVERY_TIMEOUT_MS); } catch { /* keep cache */ }
    res.status(201).json({ ok: true, data: safe(r.rows[0]) });
  } catch (e) { next(e); }
});

serversRouter.patch('/:id', async (req, res, next) => {
  try {
    const body = upsertSchema.partial().parse(req.body);
    if (body.url) {
      const v = validateUpstreamUrl(body.url);
      if (!v.ok) return res.status(400).json({ ok: false, error: { code: 'BAD_URL', message: v.reason } });
    }
    const cur = await req.db!.query('SELECT * FROM upstream_servers WHERE id=$1', [req.params.id]);
    if (!cur.rowCount) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Server not found' } });
    const c = cur.rows[0];
    const r = await req.db!.query(
      `UPDATE upstream_servers SET name=$1, url=$2, enabled=$3, description=$4, updated_at=now() WHERE id=$5
       RETURNING id, name, slug, url, enabled, description, created_at, updated_at`,
      [body.name ?? c.name, body.url ?? c.url, body.enabled ?? c.enabled, body.description ?? c.description, req.params.id]);
    if (body.authHeader !== undefined) {
      if (body.authHeader) await req.db!.query(
        `INSERT INTO upstream_credentials(server_id, auth_header) VALUES($1,$2)
         ON CONFLICT (server_id) DO UPDATE SET auth_header=EXCLUDED.auth_header, updated_at=now()`, [req.params.id, body.authHeader]);
      else await req.db!.query('DELETE FROM upstream_credentials WHERE server_id=$1', [req.params.id]);
    }
    getRegistry().invalidate();
    try { await syncRegistryFromDb(req.db!); await getRegistry().refreshAll(req.env!.UPSTREAM_DISCOVERY_TIMEOUT_MS); } catch { /* keep cache */ }
    res.json({ ok: true, data: safe(r.rows[0]) });
  } catch (e) { next(e); }
});

serversRouter.delete('/:id', async (req, res, next) => {
  try {
    await req.db!.query('DELETE FROM upstream_servers WHERE id=$1', [req.params.id]);
    getRegistry().invalidate();
    try { await syncRegistryFromDb(req.db!); } catch { /* keep cache */ }
    res.json({ ok: true, data: { deleted: true } });
  } catch (e) { next(e); }
});
