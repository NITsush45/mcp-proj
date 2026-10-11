import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { hashApiKey } from '../security/keys.js';
import type { Env } from '../config/env.js';
import type { Pool } from 'pg';

export interface AuthUser { id: string; email: string; role: 'admin' | 'member'; authMethod: 'jwt' | 'api-key'; apiKeyId?: string; }

declare global {
  namespace Express { interface Request { user?: AuthUser; env?: Env; db?: Pool; } }
}

export function signToken(env: Env, user: { id: string; email: string; role: string }): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as never });
}

async function userFromApiKey(db: Pool, header: string | undefined): Promise<AuthUser | null> {
  if (!header) return null;
  const m = /^Bearer\s+(urumi_[A-Za-z0-9_-]+)\s*$/.exec(header);
  if (!m) return null;
  const hash = hashApiKey(m[1]);
  const r = await db.query(
    `SELECT ak.id AS key_id, u.id, u.email, u.role, ak.revoked_at, ak.expires_at
     FROM api_keys ak JOIN users u ON u.id = ak.user_id
     WHERE ak.key_hash=$1`, [hash]);
  const row = r.rows[0];
  if (!row || row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  await db.query('UPDATE api_keys SET last_used_at=now() WHERE key_hash=$1', [hash]);
  return { id: row.id, email: row.email, role: row.role, authMethod: 'api-key', apiKeyId: row.key_id };
}

/** Accepts either JWT (dashboard) or team API key (external MCP clients). */
export function authRequired(req: Request, res: Response, next: NextFunction) {
  (async () => {
    const { env, db } = { env: req.env!, db: req.db! };
    // 1. try API key
    const viaKey = await userFromApiKey(db, req.headers.authorization).catch(() => null);
    if (viaKey) { req.user = viaKey; return next(); }
    // 2. try JWT
    const h = req.headers.authorization ?? '';
    const m = /^Bearer\s+(.+)$/.exec(h);
    if (!m) return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing credentials' } });
    try {
      const p = jwt.verify(m[1], env.JWT_SECRET) as { sub: string; email: string; role: string };
      req.user = { id: p.sub, email: p.email, role: p.role as never, authMethod: 'jwt' };
      return next();
    } catch {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired credentials' } });
    }
  })().catch(next);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin only' } });
  next();
}
