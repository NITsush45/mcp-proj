import { Router } from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getRegistry } from '../registry/store.js';
import { parseExposedToolName } from '../security/keys.js';
import { callUpstreamTool } from './upstream.js';
import { jsonSchemaToShape } from './schema.js';
import { syncRegistryFromDb } from '../registry/sync.js';
import { logger } from '../utils/logger.js';

export const mcpRouter = Router();

async function audit(
  db: { query: (t: string, v: unknown[]) => Promise<unknown> } | undefined,
  row: { userId: string; apiKeyId?: string; slug: string; tool: string; exposed: string; outcome: 'success' | 'error'; ms: number; err?: string },
) {
  if (!db) return;
  const safeErr = row.err ? String(row.err).replace(/urumi_[A-Za-z0-9_-]+/g, '[redacted]').replace(/Basic\s+\S+/gi, '[redacted]').slice(0, 300) : null;
  await db.query(
    `INSERT INTO audit_logs(user_id, api_key_id, server_slug, tool_name, exposed_tool, outcome, duration_ms, error_summary)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [row.userId, row.apiKeyId ?? null, row.slug, row.tool, row.exposed, row.outcome, row.ms, safeErr],
  ).catch((e) => logger.warn('audit write failed', { err: String(e).slice(0, 150) }));
}

async function ensureFresh(req: { db?: import('pg').Pool; env?: { UPSTREAM_DISCOVERY_TIMEOUT_MS: number } }) {
  try {
    if (req.db) await syncRegistryFromDb(req.db);
  } catch { /* offline/test mode: keep cache */ }
  await getRegistry().refreshAll(req.env?.UPSTREAM_DISCOVERY_TIMEOUT_MS ?? 5000);
}

// GET /mcp/tools — aggregated, namespaced tool list (dashboard + debugging)
mcpRouter.get('/tools', async (req, res, next) => {
  try {
    await ensureFresh(req);
    res.json({ ok: true, data: getRegistry().aggregatedTools() });
  } catch (e) { next(e); }
});

// POST /mcp/call — dashboard-shaped call: { tool: "<slug>__<tool>", arguments: {...} }
mcpRouter.post('/call', async (req, res, next) => {
  try {
    const body = z.object({ tool: z.string().min(1).max(200), arguments: z.record(z.unknown()).default({}) }).parse(req.body);
    const parsed = parseExposedToolName(body.tool);
    if (!parsed) return res.status(400).json({ ok: false, error: { code: 'BAD_TOOL_NAME', message: 'Use the namespaced form <server>__<tool>' } });
    await ensureFresh(req);
    const started = Date.now();
    const target = getRegistry().findTool(body.tool);
    if (!target) {
      await audit(req.db, { userId: req.user!.id, apiKeyId: req.user!.apiKeyId, slug: parsed.slug, tool: parsed.tool, exposed: body.tool, outcome: 'error', ms: Date.now() - started, err: 'Unknown or disabled tool' });
      return res.status(404).json({ ok: false, error: { code: 'TOOL_NOT_FOUND', message: 'Tool is unknown, disabled, or its server is unreachable' } });
    }
    const entry = getRegistry().entryOf(target.slug);
    try {
      const result = await callUpstreamTool(entry!.def.url, entry!.def.authHeader, target.tool, body.arguments, req.env!.UPSTREAM_TIMEOUT_MS);
      await audit(req.db, { userId: req.user!.id, apiKeyId: req.user!.apiKeyId, slug: target.slug, tool: target.tool, exposed: target.exposed, outcome: 'success', ms: Date.now() - started });
      res.json({ ok: true, data: result });
    } catch (e) {
      await audit(req.db, { userId: req.user!.id, apiKeyId: req.user!.apiKeyId, slug: target.slug, tool: target.tool, exposed: target.exposed, outcome: 'error', ms: Date.now() - started, err: e instanceof Error ? e.message : String(e) });
      const msg = e instanceof Error ? e.message : String(e);
      res.status(502).json({ ok: false, error: { code: 'UPSTREAM_ERROR', message: msg.slice(0, 300) } });
    }
  } catch (e) { next(e); }
});
/**
 * POST /mcp — real MCP endpoint (Streamable HTTP) for Claude Code, Cursor,
 * MCP Inspector. Auth: `Authorization: Bearer urumi_…` (or dashboard JWT).
 */
mcpRouter.post('/', async (req, res) => {
  const started = Date.now();
  try { await ensureFresh(req); }
  catch (e) { logger.warn('mcp discovery failed', { err: String(e).slice(0, 150) }); }
  const server = new McpServer({ name: 'urumi-gateway', version: '0.1.0' });
  for (const t of getRegistry().aggregatedTools()) {
    const handler = (async (args: unknown) => {
      const callStarted = Date.now();
      const entry = getRegistry().entryOf(t.slug);
      if (!entry) {
        await audit(req.db, { userId: req.user!.id, apiKeyId: req.user!.apiKeyId, slug: t.slug, tool: t.tool, exposed: t.exposed, outcome: 'error', ms: Date.now() - callStarted, err: 'Tool vanished (server disabled/removed)' });
        return { content: [{ type: 'text' as const, text: 'Tool is unknown, disabled, or its server is unreachable' }], isError: true as const };
      }
      try {
        const out = await callUpstreamTool(entry.def.url, entry.def.authHeader, t.tool, (args ?? {}) as Record<string, unknown>, req.env!.UPSTREAM_TIMEOUT_MS);
        await audit(req.db, { userId: req.user!.id, apiKeyId: req.user!.apiKeyId, slug: t.slug, tool: t.tool, exposed: t.exposed, outcome: 'success', ms: Date.now() - callStarted });
        const maybe = out as { content?: unknown };
        if (maybe && Array.isArray(maybe.content)) return out as never;
        return { content: [{ type: 'text' as const, text: typeof out === 'string' ? out : JSON.stringify(out).slice(0, 8000) }] };
      } catch (e) {
        await audit(req.db, { userId: req.user!.id, apiKeyId: req.user!.apiKeyId, slug: t.slug, tool: t.tool, exposed: t.exposed, outcome: 'error', ms: Date.now() - callStarted, err: e instanceof Error ? e.message : String(e) });
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: `Upstream error: ${msg.slice(0, 300)}` }], isError: true as const };
      }
    }) as never;
    // The SDK's registerTool expects a Zod raw shape — upstream JSON Schemas
    // must be converted first. A bad schema must never crash the gateway:
    // skip that tool (it stays reachable via /mcp/call) instead.
    try {
      const inputShape = jsonSchemaToShape(t.inputSchema);
      const config: Record<string, unknown> = { description: t.description ?? `Upstream tool ${t.tool} on ${t.slug}` };
      if (inputShape) config.inputSchema = inputShape;
      server.registerTool(t.exposed, config as never, handler);
    } catch (e) {
      logger.warn('tool registration failed', { tool: t.exposed, err: String(e).slice(0, 200) });
    }
  }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close().catch(() => undefined));
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    logger.warn('mcp request failed', { ms: Date.now() - started, err: String(e).slice(0, 200) });
    if (!res.headersSent) res.status(500).json({ ok: false, error: { code: 'INTERNAL', message: 'MCP request failed' } });
  }
});


