import { Router } from 'express';
import { z } from 'zod';
import { verifyPassword, hashPassword } from '../auth/../security/keys.js';
import { signToken } from '../auth/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const r = await req.db!.query('SELECT id, email, role, password_hash FROM users WHERE email=$1', [body.email.toLowerCase()]);
    const u = r.rows[0];
    if (!u || !(await verifyPassword(body.password, u.password_hash))) {
      return res.status(401).json({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    const token = signToken(req.env!, { id: u.id, email: u.email, role: u.role });
    res.json({ ok: true, data: { token, user: { id: u.id, email: u.email, role: u.role } } });
  } catch (e) { next(e); }
});

// NOTE: /me is served by app.ts as app.get('/api/auth/me', authRequired, …).
// A route here without authRequired would shadow it and echo an empty user.

export async function ensureSeedAdmin(db: import('pg').Pool, env: import('../config/env.js').Env) {
  const r = await db.query('SELECT 1 FROM users WHERE email=$1', [env.SEED_ADMIN_EMAIL.toLowerCase()]);
  if (r.rowCount) return;
  const hash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  await db.query(`INSERT INTO users(email, password_hash, role) VALUES($1,$2,'admin')`, [env.SEED_ADMIN_EMAIL.toLowerCase(), hash]);
  console.log(JSON.stringify({ level: 'info', msg: 'seed admin created', email: env.SEED_ADMIN_EMAIL }));
}
