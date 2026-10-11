import { Router } from 'express';
import { z } from 'zod';
import { generateApiKey } from '../security/keys.js';

export const keysRouter = Router();

// List my keys (metadata only — never hashes)
keysRouter.get('/', async (req, res, next) => {
  try {
    const r = await req.db!.query(
      `SELECT id, name, prefix, revoked_at, expires_at, last_used_at, created_at FROM api_keys WHERE user_id=$1 ORDER BY created_at DESC`, [req.user!.id]);
    res.json({ ok: true, data: r.rows });
  } catch (e) { next(e); }
});

// Create: returns plaintext ONCE
keysRouter.post('/', async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().min(1).max(80).default('default') }).parse(req.body ?? {});
    const { key, hash, prefix } = generateApiKey();
    const r = await req.db!.query(
      `INSERT INTO api_keys(user_id, name, key_hash, prefix) VALUES($1,$2,$3,$4)
       RETURNING id, name, prefix, created_at`, [req.user!.id, body.name, hash, prefix]);
    res.status(201).json({ ok: true, data: { ...r.rows[0], key, warning: 'Copy this key now — it will never be shown again.' } });
  } catch (e) { next(e); }
});

keysRouter.delete('/:id', async (req, res, next) => {
  try {
    const r = await req.db!.query(`UPDATE api_keys SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`, [req.params.id, req.user!.id]);
    if (!r.rowCount) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });
    res.json({ ok: true, data: { revoked: true } });
  } catch (e) { next(e); }
});
