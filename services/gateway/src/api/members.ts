import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../security/keys.js';

export const membersRouter = Router();

membersRouter.get('/', async (req, res, next) => {
  try {
    const r = await req.db!.query('SELECT id, email, role, created_at FROM users ORDER BY created_at');
    res.json({ ok: true, data: r.rows });
  } catch (e) { next(e); }
});

// Admin creates a member directly (invite-token flow is a Phase-5 extension)
membersRouter.post('/', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(8), role: z.enum(['admin', 'member']).default('member') }).parse(req.body);
    const hash = await hashPassword(body.password);
    const r = await req.db!.query(
      `INSERT INTO users(email, password_hash, role) VALUES($1,$2,$3) RETURNING id, email, role, created_at`,
      [body.email.toLowerCase(), hash, body.role]);
    res.status(201).json({ ok: true, data: r.rows[0] });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('duplicate key')) return res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: 'Email already registered' } });
    next(e);
  }
});

membersRouter.patch('/:id/role', async (req, res, next) => {
  try {
    const body = z.object({ role: z.enum(['admin', 'member']) }).parse(req.body);
    if (req.params.id === req.user!.id && body.role !== 'admin') {
      return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'You cannot demote yourself' } });
    }
    const r = await req.db!.query('UPDATE users SET role=$1 WHERE id=$2 RETURNING id, email, role', [body.role, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json({ ok: true, data: r.rows[0] });
  } catch (e) { next(e); }
});
