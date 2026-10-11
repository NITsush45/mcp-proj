import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { loadEnv } from './config/env.js';
import { getPool, checkDb } from './db/pool.js';
import { authRequired, requireAdmin } from './auth/auth.js';
import { authRouter, ensureSeedAdmin } from './api/auth.js';
import { serversRouter } from './api/servers.js';
import { membersRouter } from './api/members.js';
import { keysRouter } from './api/keys.js';
import { auditRouter } from './api/audit.js';
import { chatRouter } from './api/chat.js';
import { mcpRouter } from './mcp/routes.js';
import { getRegistry } from './registry/store.js';
import { errorHandler, notFound } from './middleware/errors.js';

export function createApp() {
  const env = loadEnv();
  const db = getPool(env);
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '256kb' }));
  app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));

  app.use((req, _res, next) => { req.env = env; req.db = db; next(); });

  app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'gateway' }));
  app.get('/readyz', async (_req, res) => {
    const dbOk = await checkDb(env);
    res.status(dbOk ? 200 : 503).json({ ok: dbOk, db: dbOk ? 'up' : 'down', registryVersion: getRegistry().getVersion() });
  });

  // Public
  app.use('/api/auth', authRouter);
  // Authenticated
  app.use('/api/servers', authRequired, requireAdmin, serversRouter);
  app.use('/api/members', authRequired, requireAdmin, membersRouter);
  app.use('/api/keys', authRequired, keysRouter);
  app.use('/api/audit', authRequired, auditRouter);
  app.use('/api/chat', authRequired, chatRouter);
  app.get('/api/auth/me', authRequired, (req, res) => res.json({ ok: true, data: { user: req.user } }));
  // Single gateway MCP surface — team API keys OR dashboard JWT
  app.use('/mcp', authRequired, mcpRouter);

  app.use(notFound);
  app.use(errorHandler);

  // Fire-and-forget seed (logs only)
  ensureSeedAdmin(db, env).catch((e) => console.error(JSON.stringify({ level: 'error', msg: 'seed failed', e: String(e) })));

  return { app, env, db };
}
