import { Router } from 'express';
import { z } from 'zod';
import { runAgent } from '../chat/agent.js';
import { syncRegistryFromDb } from '../registry/sync.js';
import { getRegistry } from '../registry/store.js';
import { logger } from '../utils/logger.js';

export const chatRouter = Router();

chatRouter.post('/', async (req, res, next) => {
  try {
    const body = z.object({ message: z.string().min(1).max(4000) }).parse(req.body);
    try {
      if (req.db) await syncRegistryFromDb(req.db);
    } catch { /* offline/test: keep cache */ }
    await getRegistry().refreshAll(req.env!.UPSTREAM_DISCOVERY_TIMEOUT_MS);
    const audit = async (row: { slug: string; tool: string; exposed: string; outcome: 'success' | 'error'; ms: number; err?: string }) => {
      if (!req.db) return;
      const safeErr = row.err ? String(row.err).replace(/urumi_[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 300) : null;
      await req.db.query(
        `INSERT INTO audit_logs(user_id, api_key_id, server_slug, tool_name, exposed_tool, outcome, duration_ms, error_summary)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.user!.id, req.user!.apiKeyId ?? null, row.slug, row.tool, row.exposed, row.outcome, row.ms, safeErr],
      ).catch((e) => logger.warn('audit write failed', { err: String(e).slice(0, 150) }));
    };
    const out = await runAgent(req.env!, audit, body.message);
    res.json({ ok: true, data: out });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'LLM_NOT_CONFIGURED') {
      return res.status(503).json({ ok: false, error: { code, message: (e as Error).message } });
    }
    next(e);
  }
});
