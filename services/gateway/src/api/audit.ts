import { Router } from 'express';

export const auditRouter = Router();

auditRouter.get('/', async (req, res, next) => {
  try {
    const { user, server, tool, outcome, limit = '50' } = req.query as Record<string, string>;
    const conds: string[] = [];
    const vals: unknown[] = [];
    if (user) { vals.push(`%${user}%`); conds.push(`u.email ILIKE $${vals.length}`); }
    if (server) { vals.push(`%${server}%`); conds.push(`a.server_slug ILIKE $${vals.length}`); }
    if (tool) { vals.push(`%${tool}%`); vals.push(`%${tool}%`); conds.push(`(a.exposed_tool ILIKE $${vals.length - 1} OR a.tool_name ILIKE $${vals.length})`); }
    if (outcome === 'success' || outcome === 'error') { vals.push(outcome); conds.push(`a.outcome = $${vals.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const r = await req.db!.query(
      `SELECT a.id, a.server_slug, a.tool_name, a.exposed_tool, a.outcome, a.duration_ms, a.error_summary,
              a.created_at, u.email AS user_email
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
       ${where} ORDER BY a.created_at DESC LIMIT ${lim}`, vals);
    res.json({ ok: true, data: r.rows });
  } catch (e) { next(e); }
});
